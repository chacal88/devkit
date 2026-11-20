// flow-check: which stage of a devkit change passed and which comes next, from stage headers and facts.
// This file holds the header reader, the stage declaration reader, the task rule, the walk over files, git
// and GitHub, the readout and the command line; it runs nothing when imported. It calls no AI: its imports
// are node built-ins and the pack's hook modules, and the only programs it starts are git, openspec and gh.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { schemaFile, findRoot, DEVKIT_SCHEMAS } from './guard.mjs';
import { gitFacts, staleness, locateChange, schemaOf, shipConfig, ShipConfigError, findChangePr, checksItem, waitingFor } from './deliver-check.mjs';
import { makeGh } from './merge-setup.mjs';

export class FlowUsageError extends Error {
  constructor(message) { super(message); this.name = 'FlowUsageError'; }
}

// Line 1 of every stage file (design D-3).
export const STAGE_HEADER = /^<!-- devkit-stage ([a-z0-9][a-z0-9-]*) result=(passed|failed|not-applicable|pending) attempt=([1-9][0-9]{0,2}) commit=([0-9a-f]{7,40}|none) -->\r?$/;

// { stage, result, attempt, commit } for a well-formed header, { malformed: true } for a line that
// starts like one and is not, null for any other first line (or no text).
export function parseStageHeader(text) {
  const first = String(text ?? '').split('\n', 1)[0];
  if (!first.startsWith('<!-- devkit-stage')) return null;
  const m = STAGE_HEADER.exec(first);
  if (!m) return { malformed: true };
  return { stage: m[1], result: m[2], attempt: Number(m[3]), commit: m[4] };
}

const SOURCES = ['folder', 'artifact', 'tasks', 'github'];
const PARTS = ['open', 'plan', 'build', 'after', 'delivery', 'close'];
const STAGE_KEYS = ['id', 'source', 'file', 'role', 'skills', 'helpers', 'part', 'title', 'shipped', 'owner',
  'ceiling', 'onFail', 'staleAfter', 'codeBound'];
const LANGS = ['en', 'pt-BR'];

// The script's declaration of its stages (design D-5): flow.json next to the schema's schema.yaml.
// null when the schema folder has none; a FlowUsageError when it is malformed.
export function readFlow(root, schema) {
  const sf = schema ? schemaFile(root, schema) : null;
  if (!sf) return null;
  const f = join(dirname(sf), 'flow.json');
  if (!existsSync(f)) return null;
  const bad = (why) => new FlowUsageError(`flow.json of ${schema} is malformed: ${why}`);
  let flow;
  try { flow = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw bad(`not JSON (${e.message})`); }
  if (!flow || typeof flow !== 'object' || !Array.isArray(flow.stages) || flow.stages.length === 0) throw bad('no stages');
  if (flow.version !== 1) throw bad(`version ${flow.version} is not 1`);
  if (!Number.isInteger(flow.ceilings?.default) || flow.ceilings.default < 1) throw bad('ceilings.default is not a positive integer');
  const index = new Map();
  flow.stages.forEach((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw bad(`stage ${i + 1} has no id`);
    if (index.has(s.id)) throw bad(`duplicate stage id ${s.id}`);
    index.set(s.id, i);
    for (const k of Object.keys(s)) if (!STAGE_KEYS.includes(k)) throw bad(`stage ${s.id} has an unknown key ${k}`);
    if (!SOURCES.includes(s.source)) throw bad(`stage ${s.id} has an unknown source ${s.source}`);
    if (!PARTS.includes(s.part)) throw bad(`stage ${s.id} has an unknown part ${s.part}`);
    if (s.source === 'artifact' && typeof s.file !== 'string') throw bad(`stage ${s.id} has no file`);
    if (typeof s.role !== 'string' || !s.role) throw bad(`stage ${s.id} has no role`);
    for (const l of LANGS) if (typeof s.title?.[l] !== 'string' || !s.title[l]) throw bad(`stage ${s.id} has no ${l} title`);
  });
  flow.stages.forEach((s, i) => {
    if (s.onFail !== undefined && !(index.has(s.onFail) && index.get(s.onFail) <= i)) {
      throw bad(`stage ${s.id} has an onFail that is unknown or later: ${s.onFail}`);
    }
    for (const a of s.staleAfter ?? []) {
      if (!(index.has(a) && index.get(a) < i)) throw bad(`stage ${s.id} has a staleAfter that is unknown or later: ${a}`);
    }
  });
  return flow;
}

// The 1-based lines of `text` that sit inside a fenced block (and the fence lines themselves). A line
// opening with three or more backticks or tildes opens a fence; the next line opening with at least as
// many of the same character closes it.
function fencedLines(text) {
  const inside = new Set();
  let open = null;
  String(text).split('\n').forEach((line, i) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (open) {
      inside.add(i + 1);
      if (m && m[1][0] === open.char && m[1].length >= open.len) open = null;
    } else if (m) {
      inside.add(i + 1);
      open = { char: m[1][0], len: m[1].length };
    }
  });
  return inside;
}

// OpenSpec's task list ({ id, done, line }) is the source; a checkbox inside a fenced example of
// tasks.md is not a task. Returns the tasks still open.
export function countedTasks(openspecTasks, tasksText) {
  const fenced = fencedLines(tasksText);
  return openspecTasks.filter((t) => !fenced.has(t.line));
}

export function pendingTasks(openspecTasks, tasksText) {
  return countedTasks(openspecTasks, tasksText).filter((t) => !t.done);
}

// ---------------------------------------------------------------- facts (design D-6)

const MAX_BUFFER = 64 * 1024 * 1024;
const OPENSPEC_TIMEOUT_MS = 60000;

// The runner of the `openspec` CLI, shaped like makeGh: (args) => { status, stdout, stderr, missing, timedOut }.
export function makeOpenspec(cwd, env = process.env, timeoutMs = OPENSPEC_TIMEOUT_MS) {
  return (args) => {
    const r = spawnSync('openspec', args, { cwd, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: MAX_BUFFER });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', missing: r.error?.code === 'ENOENT', timedOut: r.error?.code === 'ETIMEDOUT' };
  };
}

// The JSON an openspec call printed, or a FlowUsageError quoting what it said.
function openspecJson(run, args, need) {
  const r = run(args);
  const what = `openspec ${args.slice(0, 2).join(' ')}`;
  if (r.missing) throw new FlowUsageError('the openspec CLI is not installed or not on PATH');
  if (r.timedOut) throw new FlowUsageError(`${what} timed out`);
  let body = null;
  try { body = JSON.parse(r.stdout); } catch { /* not JSON */ }
  if (!body || !Array.isArray(body[need])) {
    const said = body?.status?.[0]?.message ?? body?.error ?? (r.stderr.trim().split('\n')[0] || r.stdout.trim().split('\n')[0] || `exit ${r.status}`);
    throw new FlowUsageError(`${what} gave no ${need} list: ${said}`);
  }
  return body;
}

// The files of one artifact stage: every .md under a glob's base folder, or the one named file.
function stageFiles(dir, file) {
  const paths = [];
  if (file.includes('*')) {
    const base = file.slice(0, file.indexOf('*')).replace(/\/+$/, '');
    const walkDir = (rel) => {
      const abs = join(dir, rel);
      if (!existsSync(abs)) return;
      for (const e of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isDirectory()) walkDir(join(rel, e.name));
        else if (e.name.endsWith('.md')) paths.push(join(rel, e.name));
      }
    };
    walkDir(base);
  } else if (existsSync(join(dir, file))) {
    paths.push(file);
  }
  return paths.map((path) => ({ path, header: parseStageHeader(readFileSync(join(dir, path), 'utf8')), mtimeMs: statSync(join(dir, path)).mtimeMs }));
}

const hasStageFile = (files) => Object.values(files).some((fs) => fs.length > 0);
const hasHeader = (files) => Object.values(files).some((fs) => fs.some((f) => f.header !== null));
const isPreviousScript = (files) => hasStageFile(files) && !hasHeader(files);

// What changes the work: the head, the working tree against it and the bytes of every untracked file
// outside .claude/ (design D-6, no progress). Twelve hex characters.
function fingerprint(root, head) {
  const git = (args) => {
    try { return execFileSync('git', ['-C', root, ...args], { maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return Buffer.alloc(0); }
  };
  const h = createHash('sha256');
  h.update(`${head ?? ''}\0`);
  h.update(git(['status', '--porcelain=v1', '-z', '-uall']));
  h.update(git(['diff', 'HEAD', '--binary']));
  for (const f of git(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean)) {
    if (f.startsWith('.claude/')) continue;
    h.update(`\0${f}\0`);
    try { h.update(readFileSync(join(root, f))); } catch { /* vanished */ }
  }
  return h.digest('hex').slice(0, 12);
}

// The schema an archived folder's own .openspec.yaml names, or null when it cannot be read: an archived
// change shows its script name only when its folder says which one it was.
function archivedSchema(dir) {
  try { return /^schema:\s*["']?([\w.-]+)/m.exec(readFileSync(join(dir, '.openspec.yaml'), 'utf8'))?.[1] ?? null; } catch { return null; }
}

function branchOf(root, env) {
  if (env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF) return env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF;
  try { return execFileSync('git', ['-C', root, 'symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

// A checkout that is not on the change's own branch: no branch, a default branch or the archive branch.
function offOwnBranch(root, id, branch) {
  if (!branch || ['main', 'master', `chore/archive-${id}`, `archive-${id}`].includes(branch)) return true;
  try {
    const head = execFileSync('git', ['-C', root, 'symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().replace(/^origin\//, '');
    return head === branch;
  } catch { return false; }
}

// The delivery of design D-6, read only when the walk reaches it:
// { state: 'passed' } | { next: { stage, reasonCode, params } } | { end: { state, reasonCode, params } }.
function readDelivery({ ship, gh, head, fetched }) {
  const next = (stage, reasonCode, params = {}) => ({ next: { stage, reasonCode, params } });
  const end = (state, reasonCode, params = {}) => ({ end: { state, reasonCode, params } });
  if (ship === 'plan') return end('waiting-for-owner', 'ship-plan');
  const found = fetched();
  if (found.error) return end('blocked', 'gh-error', { error: found.error });
  if (found.none) return next('delivery', 'no-pr');
  const pr = found.pr;
  if (pr.state === 'MERGED') return { state: 'passed' };
  if (pr.state !== 'OPEN') return end('blocked', 'pr-closed', { number: pr.number });
  if (pr.headRefOid !== head) return next('delivery', 'not-pushed', { number: pr.number });
  const checks = checksItem(found, gh);
  if (checks.status === 'blocked') return end('blocked', 'checks-unreadable', { error: checks.reason });
  if (checks.details.failing.length) return next('implementation', 'check-failing', { checks: checks.details.failing.map((c) => `${c.name} (${c.link})`).join(', ') });
  if (checks.details.pending.length) return end('waiting-on-github', 'checks-pending', { checks: checks.details.pending.join(', ') });
  if (ship === 'pr') return end('waiting-for-owner', 'owner-merges', { number: pr.number });
  if (pr.autoMergeRequest != null) return end('waiting-on-github', 'auto-merge-on', { number: pr.number, waiting: waitingFor(pr.mergeStateStatus) });
  return next('delivery', 'enable-auto-merge', { number: pr.number });
}

// The facts computeFlow reads, and the declaration: { facts, flow }. The only function that runs programs
// (git, openspec and gh). An archived change is decided from its folder alone, with no OpenSpec call.
export function collectFlow(root, id, { env = process.env, openspec = makeOpenspec(root, env), gh = makeGh(root, env) } = {}) {
  const located = locateChange(root, id);
  if (!located) throw new FlowUsageError(`no change named ${id}, active or archived`);
  const schema = located.archived ? archivedSchema(located.dir) : schemaOf(root, located);
  const flow = readFlow(root, schema);
  if (!located.archived && !flow && !DEVKIT_SCHEMAS.includes(schema)) throw new FlowUsageError(`schema ${schema} has no flow.json and is not a devkit schema`);
  const facts = { id, schema, archived: located.archived };
  if (located.archived || !flow) return { facts, flow };
  const files = {};
  for (const s of flow.stages) if (s.source === 'artifact') files[s.id] = stageFiles(located.dir, s.file);
  Object.assign(facts, { files, opened: existsSync(join(located.dir, '.openspec.yaml')), skipped: [], tasks: null, dirty: [], head: null });
  if (isPreviousScript(files)) return { facts, flow };
  let config;
  try { config = shipConfig(root, schema); } catch (e) {
    if (e instanceof ShipConfigError) throw new FlowUsageError(e.message);
    throw e;
  }
  const gf = gitFacts(root);
  // The change's pull request, asked once and only when needed. Off the change's own branch a merged pull
  // request switches to the post-merge walk: the header commits were squashed away, so the stale check and
  // the task count give way to the headers themselves.
  const branch = branchOf(root, env);
  let lookup = null;
  const fetched = () => (lookup ??= findChangePr(gh, root, id, { ship: config.ship, branch, env }));
  const postMerge = config.ship !== 'plan' && offOwnBranch(root, id, branch) && fetched().pr?.state === 'MERGED';
  Object.assign(facts, {
    head: gf.head, dirty: gf.dirty, fingerprint: fingerprint(root, gf.head), postMerge,
    staleness: (sha) => (postMerge ? null : sha === 'none' ? 'the header records no commit' : staleness(root, { sha, uncommitted: false }, gf)),
    delivery: () => readDelivery({ ship: config.ship, gh, head: gf.head, fetched }),
  });
  const status = openspecJson(openspec, ['status', '--change', id, '--json'], 'artifacts');
  facts.skipped = status.artifacts.filter((a) => a.status === 'skipped').map((a) => a.id);
  if (flow.stages.some((s) => s.source === 'tasks')) {
    const tasksFile = join(located.dir, 'tasks.md');
    const apply = openspecJson(openspec, ['instructions', 'apply', '--change', id, '--json'], 'tasks');
    const text = existsSync(tasksFile) ? readFileSync(tasksFile, 'utf8') : '';
    const counted = countedTasks(apply.tasks, text);
    const first = (t) => String(t.description ?? t.id).trim().split(/\s+/)[0];
    facts.tasks = { exists: existsSync(tasksFile), total: counted.length, done: counted.filter((t) => t.done).length, pending: pendingTasks(apply.tasks, text).map(first) };
  }
  return { facts, flow };
}

// ---------------------------------------------------------------- the walk (design D-6)

const FRESH_MS = 2000; // the tolerance conduct-check uses for "newer"

// A stage's title as it reads inside a sentence: "Code review" becomes "code review", "E2E tests" stays.
const inSentence = (title) => (/^.[A-Z0-9]/.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1));
const nameOf = (names, id) => names[id] ?? id;

// One sentence per reason code, in each language (design D-7); the readout and the JSON `reason` both read it.
// `names` maps a stage id to its title inside a sentence. The pt-BR strings are data.
export const TEXT = {
  en: {
    passed: (p) => (p.attempt > 1 ? `passed at attempt ${p.attempt}` : 'passed'),
    'not-applicable': () => 'does not apply',
    skipped: () => 'the change skips this stage',
    'role-not-shipped': (p) => `nobody runs this stage yet (no ${p.role} role in this version)`,
    'no-file': (p) => `${p.file} does not exist yet`,
    'no-header': (p) => `${p.file} has no stage header`,
    'bad-header': (p) => `${p.file} has a malformed stage header`,
    'header-other-stage': (p) => `${p.file} carries the header of stage ${p.found}`,
    'not-judged': (p) => `${p.file} is written and not judged yet`,
    'header-failed': (p) => `failed at attempt ${p.attempt} of ${p.ceiling}`,
    'stale-code': (p) => `the code changed since it ran (${p.why})`,
    'stale-plan': (p, n) => `${nameOf(n, p.by)} changed after it`,
    'tasks-pending': (p) => `${p.count} task${p.count === 1 ? '' : 's'} pending (${p.ids.join(', ')})`,
    uncommitted: (p) => `code changed and is not committed (${p.paths.join(', ')})`,
    'tasks-done': (p) => `${p.done} of ${p.total} tasks done`,
    'waits-for': (p) => `waits for stage ${p.n}`,
    'fix-after-failure': (p, n) => `the ${nameOf(n, p.failed)} failed at attempt ${p.attempt} of ${p.ceiling} and the code has not changed since; the fix comes before another review`,
    'rerun-after-fix': (p, n) => `the ${nameOf(n, p.stage)} failed and the work changed since; it runs again`,
    'ceiling-reached': (p, n) => `the ${nameOf(n, p.stage)} failed at attempt ${p.attempt} and its ceiling is ${p.ceiling}`,
    'no-progress': (p, n) => `the ${nameOf(n, p.stage)} came back with nothing changed since the last run`,
    'owner-pending': (p, n) => `the ${nameOf(n, p.stage)} waits for the owner`,
    'approval-stale': (p, n) => `the ${nameOf(n, p.stage)} is stale: the owner approves the revised plan again`,
    'unshipped-role-pending': (p, n) => `the ${nameOf(n, p.stage)} is pending and no role in this version can finish it: the owner sets its result or removes the file`,
    'no-role': (p, n) => `the ${nameOf(n, p.stage)} needs ${p.role}, which cannot act here`,
    archive: () => 'every stage passed; the change is archived with openspec archive',
    archived: () => 'the change is archived',
    'previous-script': () => 'the change began under the previous script: its files carry no stage header',
    'schema-without-declaration': () => 'the schema has no flow.json: the project has not re-run openspec-setup',
    'ship-plan': () => 'the owner opens and merges the pull request',
    'gh-error': (p) => `GitHub cannot be read: ${p.error}`,
    'no-pr': () => 'there is no pull request for this change yet',
    'not-pushed': (p) => `pull request #${p.number} is not at the local commit; push first`,
    'checks-unreadable': (p) => `the checks cannot be read: ${p.error}`,
    'check-failing': (p) => `checks failing: ${p.checks}`,
    'checks-pending': (p) => `checks pending: ${p.checks}`,
    'owner-merges': (p) => `pull request #${p.number} is green; the owner merges it`,
    'auto-merge-on': (p) => `auto-merge is on for pull request #${p.number}; waiting for ${p.waiting}`,
    'enable-auto-merge': (p) => `pull request #${p.number} is green; auto-merge is not on yet`,
    'pr-closed': (p) => `pull request #${p.number} was closed without merging`,
  },
  'pt-BR': {
    passed: (p) => (p.attempt > 1 ? `passou na tentativa ${p.attempt}` : 'passou'),
    'not-applicable': () => 'não se aplica',
    skipped: () => 'a change dispensa esta etapa',
    'role-not-shipped': (p) => `ninguém executa esta etapa ainda (o papel ${p.role} não existe nesta versão)`,
    'no-file': (p) => `${p.file} ainda não existe`,
    'no-header': (p) => `${p.file} não tem o cabeçalho de etapa`,
    'bad-header': (p) => `${p.file} tem um cabeçalho de etapa malformado`,
    'header-other-stage': (p) => `${p.file} traz o cabeçalho da etapa ${p.found}`,
    'not-judged': (p) => `${p.file} está escrito e ainda não foi julgado`,
    'header-failed': (p) => `falhou na tentativa ${p.attempt} de ${p.ceiling}`,
    'stale-code': (p) => `o código mudou desde que ela rodou (${p.why})`,
    'stale-plan': (p, n) => `${nameOf(n, p.by)} mudou depois dela`,
    'tasks-pending': (p) => `${p.count} ${p.count === 1 ? 'tarefa pendente' : 'tarefas pendentes'} (${p.ids.join(', ')})`,
    uncommitted: (p) => `há código alterado e não commitado (${p.paths.join(', ')})`,
    'tasks-done': (p) => `${p.done} de ${p.total} tarefas feitas`,
    'waits-for': (p) => `espera a etapa ${p.n}`,
    'fix-after-failure': (p, n) => `a ${nameOf(n, p.failed)} falhou na tentativa ${p.attempt} de ${p.ceiling} e nada mudou no código desde então; a correção vem antes de uma nova revisão`,
    'rerun-after-fix': (p, n) => `a etapa ${nameOf(n, p.stage)} falhou e o trabalho mudou desde então; ela roda de novo`,
    'ceiling-reached': (p, n) => `a etapa ${nameOf(n, p.stage)} falhou na tentativa ${p.attempt} e o limite é ${p.ceiling}`,
    'no-progress': (p, n) => `a etapa ${nameOf(n, p.stage)} voltou sem nada ter mudado desde a última execução`,
    'owner-pending': (p, n) => `a etapa ${nameOf(n, p.stage)} espera o dono`,
    'approval-stale': (p, n) => `a etapa ${nameOf(n, p.stage)} está desatualizada: o dono aprova de novo o plano revisado`,
    'unshipped-role-pending': (p, n) => `a etapa ${nameOf(n, p.stage)} está pendente e nenhum papel desta versão consegue concluí-la: o dono define o resultado ou remove o arquivo`,
    'no-role': (p, n) => `a etapa ${nameOf(n, p.stage)} precisa de ${p.role}, que não pode agir aqui`,
    archive: () => 'todas as etapas passaram; a change é arquivada com openspec archive',
    archived: () => 'a change está arquivada',
    'previous-script': () => 'a change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa',
    'schema-without-declaration': () => 'o schema não tem flow.json: o projeto ainda não rodou openspec-setup de novo',
    'ship-plan': () => 'o dono abre e mescla o pull request',
    'gh-error': (p) => `não foi possível ler o GitHub: ${p.error}`,
    'no-pr': () => 'ainda não há pull request desta change',
    'not-pushed': (p) => `o pull request #${p.number} não está no commit local; é preciso enviar antes`,
    'checks-unreadable': (p) => `não foi possível ler os checks: ${p.error}`,
    'check-failing': (p) => `checks falhando: ${p.checks}`,
    'checks-pending': (p) => `checks pendentes: ${p.checks}`,
    'owner-merges': (p) => `o pull request #${p.number} está verde; o dono o mescla`,
    'auto-merge-on': (p) => `o auto-merge está ligado no pull request #${p.number}; esperando ${p.waiting}`,
    'enable-auto-merge': (p) => `o pull request #${p.number} está verde; o auto-merge ainda não está ligado`,
    'pr-closed': (p) => `o pull request #${p.number} foi fechado sem mesclar`,
  },
};
export const reasonText = (lang, code, params = {}, names = {}) => (TEXT[lang] ?? TEXT.en)[code](params, names);

const maxMtime = (files) => (files.length ? Math.max(...files.map((f) => f.mtimeMs)) : null);

// The raw state of one artifact stage, before the walk: { state, result, attempt, commit, reasonCode, params, fixed }.
function artifactState(stage, files, facts, flow, started) {
  const base = { result: null, attempt: null, commit: null, fixed: false };
  const out = (state, reasonCode, params = {}, more = {}) => ({ ...base, state, reasonCode, params, ...more });
  if (facts.skipped.includes(stage.id)) return out('not-applicable', 'skipped');
  if (files.length === 0) {
    return stage.shipped === false ? out('not-applicable', 'role-not-shipped', { role: stage.role }) : out('pending', 'no-file', { file: stage.file });
  }
  for (const f of files) {
    const h = f.header;
    if (h === null) return out('pending', 'no-header', { file: f.path });
    if (h.malformed) return out('pending', 'bad-header', { file: f.path });
    if (h.stage !== stage.id) return out('pending', 'header-other-stage', { file: f.path, found: h.stage });
  }
  const results = files.map((f) => f.header.result);
  const worst = ['failed', 'pending'].find((r) => results.includes(r));
  const result = worst ?? (results.every((r) => r === 'not-applicable') ? 'not-applicable' : 'passed');
  const h = files.find((f) => f.header.result === result).header;
  const info = { result, attempt: h.attempt, commit: h.commit };
  if (result === 'pending') return out('pending', 'not-judged', { file: files[0].path }, info);
  if (result === 'not-applicable') return out('not-applicable', 'not-applicable', {}, info);
  // passed or failed: the stale check
  let stale = null;
  if (stage.codeBound) {
    for (const f of files) {
      const why = facts.staleness(f.header.commit);
      if (why) { stale = { code: 'stale-code', params: { why } }; break; }
    }
  }
  // Once the work has started, ticking tasks.md must not make the plan review stale (conduct-check's rule).
  if (!stale && !started && !facts.postMerge) {
    const mine = maxMtime(files);
    for (const a of stage.staleAfter ?? []) {
      const other = maxMtime(facts.files[a] ?? []);
      if (mine !== null && other !== null && other - mine > FRESH_MS) { stale = { code: 'stale-plan', params: { by: a } }; break; }
    }
  }
  const ceiling = stage.ceiling ?? flow.ceilings.default;
  if (result === 'failed') return out('failed', 'header-failed', { attempt: h.attempt, ceiling }, { ...info, fixed: stale !== null });
  if (stale) return out('stale', stale.code, stale.params, info);
  return out('passed', 'passed', { attempt: h.attempt }, info);
}

function tasksState(facts) {
  const t = facts.tasks;
  const out = (state, reasonCode, params) => ({ state, reasonCode, params, result: null, attempt: null, commit: null, fixed: false });
  if (!t?.exists) return out('pending', 'no-file', { file: 'tasks.md' });
  if (facts.postMerge) return out('passed', 'tasks-done', { done: t.done, total: t.total });
  if (t.pending.length) return out('pending', 'tasks-pending', { count: t.pending.length, ids: t.pending });
  if (facts.dirty.length) return out('pending', 'uncommitted', { paths: facts.dirty.slice(0, 3) });
  return out('passed', 'tasks-done', { done: t.done, total: t.total });
}

const stageEntry = (s, i, raw, names) => ({
  n: i + 1, id: s.id, title: s.title.en, file: s.file ?? null, state: raw.state, result: raw.result, attempt: raw.attempt,
  commit: raw.commit, role: s.role, skills: s.skills ?? [], reasonCode: raw.reasonCode, params: raw.params,
  reason: reasonText('en', raw.reasonCode, raw.params, names),
});

const progressKeyOf = (stage, facts) => `${stage}@${facts.fingerprint}`;

// The report for a change (design D-6): the stages in order, and exactly one of `next` and `end` (none for a
// change begun under the previous script). Pure: every fact comes in `facts`.
// facts.delivery is a function called only when the walk reaches the delivery; it answers
// { state: 'passed' } | { next: { stage, reasonCode, params } } | { end: { state, reasonCode, params } }.
export function computeFlow(facts, flow, { after = null } = {}) {
  const names = Object.fromEntries(flow ? flow.stages.map((s) => [s.id, inSentence(s.title.en)]) : []);
  const note = (code, params) => ({ reasonCode: code, params, reason: reasonText('en', code, params, names) });
  const report = { version: 1, change: facts.id, schema: facts.schema, script: 'current', head: facts.head ?? null, stages: [], next: null, end: null, previous: null };
  if (facts.archived) {
    report.end = { state: 'archived', stage: null, ...note('archived', {}) };
    return report;
  }
  const previous = (code) => ({ ...report, script: 'previous', previous: { finishedBy: 'ship-change', ...note(code, {}) } });
  if (!flow) return previous('schema-without-declaration');
  if (isPreviousScript(facts.files)) return previous('previous-script');

  const stages = flow.stages;
  const started = Boolean(facts.tasks?.done);
  const raws = stages.map((s) => {
    if (s.source === 'folder') return { state: facts.opened ? 'passed' : 'pending', reasonCode: facts.opened ? 'passed' : 'no-file', params: facts.opened ? { attempt: 1 } : { file: '.openspec.yaml' }, result: null, attempt: null, commit: null, fixed: false };
    if (s.source === 'tasks') return tasksState(facts);
    if (s.source === 'github') return { state: 'pending', reasonCode: 'waits-for', params: {}, result: null, attempt: null, commit: null, fixed: false };
    return artifactState(s, facts.files[s.id] ?? [], facts, flow, started);
  });
  const settled = (r) => r.state === 'passed' || r.state === 'not-applicable';
  const ceilingOf = (s) => s.ceiling ?? flow.ceilings.default;

  // The current stage: the first that is not settled. The delivery is read only when reached.
  let cur = -1;
  let delivered = null;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].source === 'github') {
      if (typeof facts.delivery !== 'function') throw new FlowUsageError('the delivery is not read yet');
      delivered = facts.delivery();
      if (delivered.state === 'passed') { raws[i] = { ...raws[i], state: 'passed', reasonCode: 'passed', params: { attempt: 1 } }; continue; }
      const why = delivered.next ?? delivered.end;
      raws[i] = { ...raws[i], state: 'pending', reasonCode: why.reasonCode, params: why.params ?? {} };
      cur = i;
      break;
    }
    if (!settled(raws[i])) { cur = i; break; }
  }

  // Report each stage: the ones after the current stay as they are when settled, else blocked behind the
  // nearest earlier stage that is not settled; nothing after a pending implementation counts.
  const implIdx = stages.findIndex((s) => s.source === 'tasks');
  const shown = raws.map((r, i) => {
    if (cur !== -1 && i > cur && stages[i].source !== 'github') {
      const heldByTasks = implIdx !== -1 && raws[implIdx].state !== 'passed' && stages[i].part !== 'open' && stages[i].part !== 'plan' && i > implIdx;
      if (!settled(r) || heldByTasks) return { ...r, state: 'blocked' };
    }
    return r;
  });
  const blocked = (i) => {
    for (let j = i - 1; j >= 0; j--) if (!settled(raws[j]) || shown[j].state === 'blocked') return j;
    return i - 1;
  };
  stages.forEach((s, i) => {
    if (shown[i].state === 'blocked' || (cur !== -1 && i > cur && s.source === 'github')) {
      shown[i] = { ...shown[i], state: 'blocked', reasonCode: 'waits-for', params: { n: blocked(i) + 1 } };
    }
  });
  report.stages = stages.map((s, i) => stageEntry(s, i, shown[i], names));

  const finishEnd = (state, stage, code, params) => { report.end = { state, stage, ...note(code, params) }; return report; };
  const offer = (stageId, code, params) => {
    const i = stages.findIndex((x) => x.id === stageId);
    const s = stages[i];
    // Last guard: a next stage never names the owner or a role that is not shipped.
    if (s.shipped === false) return finishEnd('waiting-for-owner', s.id, 'unshipped-role-pending', { stage: s.id });
    if (s.role === 'owner') {
      const stale = report.stages[i].state === 'stale';
      const code2 = stale ? 'approval-stale' : report.stages[i].state === 'pending' ? 'owner-pending' : 'no-role';
      return finishEnd('waiting-for-owner', s.id, code2, { stage: s.id, role: s.role });
    }
    const key = progressKeyOf(s.id, facts);
    if (after && after === key) return finishEnd('blocked', s.id, 'no-progress', { stage: s.id });
    report.next = { n: i + 1, stage: s.id, role: s.role, skills: s.skills ?? [], ...note(code, params), progressKey: key };
    return report;
  };

  if (cur === -1) return offer('retro', 'archive', {});
  const s = stages[cur];
  const raw = raws[cur];
  if (s.source === 'github') {
    if (delivered.next) return offer(delivered.next.stage, delivered.next.reasonCode, delivered.next.params);
    return finishEnd(delivered.end.state, s.id, delivered.end.reasonCode, delivered.end.params);
  }
  if (raw.state === 'failed') {
    const ceiling = ceilingOf(s);
    if (raw.attempt >= ceiling) return finishEnd('blocked', s.id, 'ceiling-reached', { stage: s.id, attempt: raw.attempt, ceiling });
    if (raw.fixed) return offer(s.id, 'rerun-after-fix', { stage: s.id });
    return offer(s.onFail ?? s.id, 'fix-after-failure', { failed: s.id, attempt: raw.attempt, ceiling });
  }
  const ownerFile = (s.owner || s.role === 'owner') && raw.reasonCode === 'not-judged';
  if (ownerFile) {
    return s.shipped === false
      ? finishEnd('waiting-for-owner', s.id, 'unshipped-role-pending', { stage: s.id })
      : finishEnd('waiting-for-owner', s.id, 'owner-pending', { stage: s.id });
  }
  return offer(s.id, raw.reasonCode, raw.params);
}

// ---------------------------------------------------------------- the readout (design D-7)

// The words around the sentences, per language. The pt-BR strings are data.
const WORDS = {
  en: {
    script: (name) => `${name} script`,
    states: { passed: 'passed', failed: 'failed', 'not-applicable': 'does not apply', stale: 'stale', pending: 'pending', blocked: 'blocked' },
    next: 'Next stage', who: 'Who runs it', why: 'Why',
    ends: { archived: 'End: archived.', 'waiting-for-owner': 'End: waiting for the owner.', 'waiting-on-github': 'End: waiting on GitHub.', blocked: 'End: blocked.' },
    previous: "This change began under the previous script: its files carry no stage header. Today's flow finishes it (ship-change, led by deliver-check). This command stops nothing.",
  },
  'pt-BR': {
    script: (name) => `roteiro ${name}`,
    states: { passed: 'passou', failed: 'falhou', 'not-applicable': 'não se aplica', stale: 'desatualizada', pending: 'pendente', blocked: 'bloqueada' },
    next: 'Próxima etapa', who: 'Quem executa', why: 'Por quê',
    ends: { archived: 'Fim: arquivada.', 'waiting-for-owner': 'Fim: esperando o dono.', 'waiting-on-github': 'Fim: esperando o GitHub.', blocked: 'Fim: bloqueada.' },
    previous: 'Esta change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa. O fluxo de hoje a termina (ship-change, guiado pelo deliver-check). Este comando não para nada.',
  },
};

const sentence = (text) => {
  const t = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

// The situation of one stage line: the state word, then the reason unless the sentence already starts with it.
function situation(lang, entry, names) {
  const words = WORDS[lang].states;
  const said = reasonText(lang, entry.reasonCode, entry.params, names);
  if (entry.reasonCode === 'passed' || entry.reasonCode === 'header-failed') return said;
  if (entry.reasonCode === 'not-applicable') return words[entry.state];
  return `${words[entry.state]}: ${said}`;
}

// The text readout of a report: a title line, a line per stage, then the next stage or the end (design D-7).
export function renderText(report, flow, lang = 'pt-BR') {
  const w = WORDS[lang] ?? WORDS['pt-BR'];
  const titles = Object.fromEntries((flow?.stages ?? []).map((s) => [s.id, s.title[lang] ?? s.title.en]));
  const names = Object.fromEntries(Object.entries(titles).map(([id, t]) => [id, inSentence(t)]));
  const lines = [`Change ${report.change}${report.schema ? ` (${w.script(report.schema)})` : ''}`, ''];
  if (report.script === 'previous') return `${lines.join('\n')}\n${w.previous}\n`;
  if (report.stages.length) {
    const width = Math.max(24, ...report.stages.map((s) => (titles[s.id] ?? s.title).length + 2));
    for (const s of report.stages) {
      lines.push(`${String(s.n).padStart(2)}  ${(titles[s.id] ?? s.title).padEnd(width)}${situation(lang, s, names)}`);
    }
    lines.push('');
  }
  if (report.next) {
    const n = report.next;
    lines.push(`${w.next}: ${n.n} ${titles[n.stage] ?? n.stage}`, `${w.who}: ${n.role}`, `${w.why}: ${reasonText(lang, n.reasonCode, n.params, names)}.`);
  } else if (report.end.state === 'archived') {
    lines.push(w.ends.archived);
  } else {
    lines.push(`${w.ends[report.end.state]} ${sentence(reasonText(lang, report.end.reasonCode, report.end.params, names))}`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- the command line (design D-6)

const USAGE = 'usage: flow-check.mjs <change-id> [--json] [--lang pt-BR|en] [--after <progress-key>]';

function parseArgs(argv) {
  const opts = { id: null, json: false, lang: 'pt-BR', after: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--lang' || a === '--after') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new FlowUsageError(`${a} needs a value; ${USAGE}`);
      if (a === '--lang') {
        if (!LANGS.includes(v)) throw new FlowUsageError(`unknown language ${v}; use pt-BR or en`);
        opts.lang = v;
      } else opts.after = v;
    } else if (a.startsWith('--')) throw new FlowUsageError(`unknown option ${a}; ${USAGE}`);
    else if (opts.id === null) opts.id = a;
    else throw new FlowUsageError(`one change id at a time; ${USAGE}`);
  }
  if (opts.id === null) throw new FlowUsageError(USAGE);
  return opts;
}

// Fails unless the openspec CLI answers a 2.x version.
function checkOpenspecVersion(openspec) {
  const r = openspec(['--version']);
  if (r.missing) throw new FlowUsageError('the openspec CLI is not installed or not on PATH');
  const version = /\d+\.\d+\.\d+\S*/.exec(r.stdout)?.[0];
  if (!version) throw new FlowUsageError(`cannot read the openspec version from "${r.stdout.trim().slice(0, 60)}"`);
  if (version.split('.')[0] !== '2') throw new FlowUsageError(`openspec ${version} is not supported: flow-check reads OpenSpec 2.x`);
}

const EXIT = { archived: 0, 'waiting-for-owner': 1, 'waiting-on-github': 1, blocked: 2 };

// Runs the checker: { code, stdout, stderr }. Exit 0 a next stage, archived or a previous-script change;
// 1 waiting for the owner or GitHub; 2 blocked; 3 a usage or preflight error.
export function main(argv, { env = process.env, cwd = process.cwd(), openspec, gh } = {}) {
  let json = argv.includes('--json');
  try {
    const opts = parseArgs(argv);
    json = opts.json;
    const root = findRoot(cwd);
    if (!root) throw new FlowUsageError(`no openspec/ folder found from ${cwd}`);
    const run = openspec ?? makeOpenspec(root, env);
    checkOpenspecVersion(run);
    const { facts, flow } = collectFlow(root, opts.id, { env, openspec: run, ...(gh ? { gh } : {}) });
    const report = computeFlow(facts, flow, { after: opts.after });
    const code = report.end ? EXIT[report.end.state] : 0;
    return { code, stdout: json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report, flow, opts.lang), stderr: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 3, stdout: json ? `${JSON.stringify({ version: 1, error: message })}\n` : '', stderr: `flow-check: ${message}\n` };
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const r = main(process.argv.slice(2));
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.code;
}
