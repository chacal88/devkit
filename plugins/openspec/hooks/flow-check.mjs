// flow-check: which stage of a devkit change passed and which comes next, from stage headers and facts.
// This file holds the header reader, the stage declaration reader, the task rule, the walk over files, git
// and GitHub, the readout and the command line; it runs nothing when imported. It calls no AI: its imports
// are node built-ins and the pack's hook modules, and the only programs it starts are git, openspec and gh.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { findRoot, DEVKIT_SCHEMAS, openspecCli, openspecRefusal, STAGE_HEADER, parseStageHeader, FlowUsageError, readFlow, readFlowFile, FLOW_LANGS, changeFlow, changeSchemaAt, parseDevkitBlock, budgetValue, spendOf, spendSources, spendLines } from './guard.mjs';
import { gitFacts, staleness, fencedLines, readReviews, locateChange, schemaOf, deliveryConfig, ShipConfigError, deliveryOf, findTestPr, checksItem, waitingFor, currentBranch, defaultBranches, archiveHeads, trainFacts, isDevkitScript } from './deliver-check.mjs';
import { makeGh } from './merge-setup.mjs';

// The flow file reader and its error live in guard.mjs (the CI job downloads that file, not this one); one reader, re-exported.
export { FlowUsageError, readFlow, readFlowFile };

// The stage header reader lives in guard.mjs for the same reason.
export { STAGE_HEADER, parseStageHeader };

const LANGS = FLOW_LANGS;

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

// The runner of the project's `openspec` CLI (guard.mjs#openspecCli), shaped like makeGh:
// (args) => { status, stdout, stderr, missing, timedOut, refused? }. `refused` is the message of a CLI the packs
// cannot use (a declared pin not installed, a pinned CLI that is not 2.x); nothing is started then. `.cli` says which.
export function makeOpenspec(cwd, env = process.env, timeoutMs = OPENSPEC_TIMEOUT_MS) {
  const cli = openspecCli(findRoot(cwd) ?? cwd);
  // A pinned CLI runs by its folder going first on PATH, so the program started is still the one named `openspec`
  // (the AC-9 scan lists the programs this checker starts) and is never the PATH one.
  const startEnv = cli.pinned ? { ...env, PATH: `${dirname(cli.bin)}${delimiter}${env.PATH ?? ''}` } : env;
  const start = (args) => {
    const r = spawnSync('openspec', args, { cwd, env: startEnv, encoding: 'utf8', timeout: timeoutMs, maxBuffer: MAX_BUFFER });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', missing: r.error?.code === 'ENOENT', timedOut: r.error?.code === 'ETIMEDOUT' };
  };
  const refusedAnswer = (message) => ({ status: null, stdout: '', stderr: '', missing: false, timedOut: false, refused: message });
  let pinRefusal; // undefined until the pinned CLI's version was read once
  const run = (args) => {
    if (cli.error) return refusedAnswer(cli.error);
    if (cli.pinned) {
      pinRefusal ??= openspecRefusal(cli, start(['--version']).stdout);
      if (pinRefusal) return refusedAnswer(pinRefusal);
    }
    return start(args);
  };
  run.cli = cli;
  return run;
}

// The JSON an openspec call printed, or a FlowUsageError quoting what it said.
function openspecJson(run, args, need) {
  const r = run(args);
  const what = `openspec ${args.slice(0, 2).join(' ')}`;
  if (r.refused) throw new FlowUsageError(r.refused);
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
export function stageFiles(dir, file) {
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

// The value of a `key: value` line: quoted or not, with an optional trailing `# comment`.
export function plainValue(raw) {
  const text = raw.replace(/\r$/, '').trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    return end === -1 ? text.slice(1) : text.slice(1, end);
  }
  return text.replace(/(^|\s)#.*$/, '').trim();
}

// The flags of the grill's `Classification: ... flags=[..]` line in the change's requirements.md, lower-cased: none
// when the file or the line is missing. No other line of the file is read.
export function classificationFlags(dir) {
  const file = join(dir, 'requirements.md');
  if (!existsSync(file)) return [];
  const m = /^.*Classification:.*flags=\[([^\]]*)\]/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1].split(',').map((f) => f.trim().toLowerCase()).filter(Boolean) : [];
}

// The test settings of the `devkit:` block of openspec/config.yaml, read by indentation (design stage-roles D-3):
// { unit, e2e, coverage: { command, target }, paths, unknown }. Missing values are null; `paths` maps every dotted path
// under `devkit` that holds a value to its text; `target` is a number only when the text is a whole number from 0 to 100,
// else null and the text is listed in `unknown` as { setting, value, accepted }.
export function readTestSettings(root) {
  let text = '';
  try { text = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8'); } catch (e) {
    if (e?.code !== 'ENOENT') throw new FlowUsageError(`openspec/config.yaml cannot be read (${e?.code ?? e})`);
  }
  const paths = {};
  const open = [];
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (/^devkit:\s*(#.*)?\r?$/.test(line)) { inBlock = true; open.length = 0; continue; }
    if (!inBlock) continue;
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) { inBlock = false; continue; }
    const m = /^(\s+)([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!m) continue;
    while (open.length && open[open.length - 1].indent >= m[1].length) open.pop();
    const value = plainValue(m[3]);
    if (value === '') open.push({ indent: m[1].length, key: m[2] });
    else paths[[...open.map((o) => o.key), m[2]].join('.')] = value;
  }
  const unknown = [];
  let target = null;
  const targetText = paths['tests.coverage.target'];
  if (targetText !== undefined) {
    if (/^\d+$/.test(targetText) && Number(targetText) <= 100) target = Number(targetText);
    else unknown.push({ setting: 'coverage-target', value: targetText, accepted: 'a whole number from 0 to 100' });
  }
  return { unit: paths['tests.unit'] ?? null, e2e: paths['tests.e2e'] ?? null, coverage: { command: paths['tests.coverage.command'] ?? null, target }, paths, unknown };
}

// A change begun under the previous script (D-2): the earliest artifact stage that has a file, in the order the
// declaration lists them, has no header on any of its files. A header on a later file (a readiness, an evidence or a
// review the current agents wrote) does not change that. No file at all is a change being opened: current.
export function isPreviousScript(files, flow) {
  const order = flow.stages.filter((s) => s.source === 'artifact').map((s) => s.id);
  const earliest = order.find((id) => (files[id] ?? []).length > 0);
  return earliest !== undefined && files[earliest].every((f) => f.header === null);
}

// What changes the work: the head, the working tree against it and the bytes of every untracked file
// outside .claude/ (design D-6, no progress). Twelve hex characters.
export function fingerprint(root, head) {
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

// The line-1 headers the stage file `rel` (a path relative to `root`) carried in the commits of the checked-out
// history, newest first (design D-2). Two git processes: the log of the commits that touched the file, then one
// `cat-file --batch` over `<sha>:./<rel>`. Every header is kept as parseStageHeader gives it (a missing line is null,
// a malformed one `{ malformed: true }`); a commit where the file is absent is skipped. Any failure (git missing, not
// a repository, no commit yet, an output that cannot be walked) is `[]`, never a throw.
export function stageHistory(root, rel, env = process.env) {
  const git = (args, input) => execFileSync('git', ['-C', root, ...args], { env, input, maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'ignore'] });
  let out;
  try {
    const shas = git(['log', '--topo-order', '--format=%H', '--', rel]).toString('utf8').split('\n').filter(Boolean);
    if (shas.length === 0) return [];
    out = git(['cat-file', '--batch'], shas.map((sha) => `${sha}:./${rel}\n`).join(''));
  } catch { return []; }
  const headers = [];
  let at = 0;
  while (at < out.length) {
    const eol = out.indexOf(0x0a, at);
    if (eol === -1) break;
    const line = out.toString('latin1', at, eol);
    at = eol + 1;
    if (/ missing$/.test(line)) continue;
    const answer = /^\S+ blob (\d+)$/.exec(line);
    if (!answer) break;
    const end = at + Number(answer[1]);
    if (end > out.length) break;
    headers.push(parseStageHeader(out.toString('utf8', at, end)));
    at = end + 1;
  }
  return headers;
}

// The failures in a row of a failed stage (design D-3): the distinct `attempt commit` keys of the failed headers, the
// current one included, from `current` back through `earlier` (newest first) up to the first passed header of the
// stage. A null, malformed or other-stage header, and a not-applicable or pending one, neither stops nor counts.
// With no passed header seen the count is at least `attempt`: today's rule.
export function failuresInARow(current, earlier) {
  const failed = new Set();
  let reached = false;
  for (const h of [current, ...earlier]) {
    if (!h || h.malformed || h.stage !== current.stage || h.result === 'not-applicable' || h.result === 'pending') continue;
    if (h.result === 'passed') { reached = true; break; }
    if (h.result === 'failed') failed.add(`${h.attempt} ${h.commit}`);
  }
  return reached ? failed.size : Math.max(current.attempt, failed.size);
}

// The schema an archived folder's own .openspec.yaml names, or null when it cannot be read: an archived
// change shows its script name only when its folder says which one it was.
function archivedSchema(dir) {
  try { return /^schema:\s*["']?([\w.-]+)/m.exec(readFileSync(join(dir, '.openspec.yaml'), 'utf8'))?.[1] ?? null; } catch { return null; }
}

// A checkout that is not on the change's own branch: no branch, a default branch or the archive branch.
// The rule has one owner, deliver-check (currentBranch, defaultBranches, archiveHeads).
function offOwnBranch(root, id, branch) {
  return !branch || defaultBranches(root).includes(branch) || archiveHeads(id).includes(branch);
}

// The delivery of design D-6, read only when the walk reaches it:
// { state: 'passed' } | { next: { stage, reasonCode, params } } | { end: { state, reasonCode, params } }.
// In `two-prs` (`twoPrs` given) the pull request to the test branch is read too: it is merged first, and the base pull request's own
// `devkit-reviews` check waits for it, so the base checks count only once it has merged (delivery-models D-5).
// With the delivery train (`train` given: reads the train facts of the pull request head) a change boards instead of merging:
// pending checks do not hold it, a train that took it off sends it back, one that carries it is a wait on GitHub (delivery-train D-2).
function readDelivery({ ship, gh, head, delivery, twoPrs = null, train = null }) {
  const next = (stage, reasonCode, params = {}) => ({ next: { stage, reasonCode, params } });
  const end = (state, reasonCode, params = {}) => ({ end: { state, reasonCode, params } });
  if (ship === 'plan') return end('waiting-for-owner', 'ship-plan');
  const { fetched: found, delivered, left } = delivery();
  if (found.error) return end('blocked', 'gh-error', { error: found.error });
  if (found.none) return next('delivery', 'no-pr');
  const pr = found.pr;
  if (pr.state === 'MERGED') return delivered ? { state: 'passed' } : next('implementation', 'tasks-left-after-merge', { number: pr.number, tasks: left.join(', ') });
  if (pr.state !== 'OPEN') return end('blocked', 'pr-closed', { number: pr.number });
  if (pr.headRefOid !== head) return next('delivery', 'not-pushed', { number: pr.number });
  let testMerged = false;
  if (twoPrs) {
    const test = twoPrs.testPr();
    if (test.error) return end('blocked', 'gh-error', { error: test.error });
    if (test.none) return next('delivery', 'no-test-pr');
    testMerged = test.pr.state === 'MERGED';
    if (test.pr.state === 'CLOSED') return end('blocked', 'pr-closed', { number: test.pr.number });
    if (!testMerged) {
      if (test.checks.status === 'blocked') return end('blocked', 'checks-unreadable', { error: test.checks.reason });
      if (test.checks.details.failing.length) return next('implementation', 'check-failing', { checks: test.checks.details.failing.map((c) => `${c.name} (${c.link})`).join(', ') });
      if (test.checks.details.pending.length) return end('waiting-on-github', 'checks-pending', { checks: test.checks.details.pending.join(', ') });
      return end('waiting-for-owner', 'owner-merges-test-branch', { number: test.pr.number, branch: twoPrs.testBranch, base: twoPrs.base });
    }
  }
  const boarding = train ? train(pr.headRefOid) : null;
  if (boarding?.error) return end('blocked', 'gh-error', { error: boarding.error });
  if (boarding?.left) {
    const { n, number, state } = boarding.left;
    if (state === 'OPEN') return end('waiting-on-github', 'on-train', { number });
    return next('implementation', 'left-train', { train: n, number });
  }
  const checks = checksItem(found, gh);
  if (checks.status === 'blocked') {
    const old = checks.details.ghTooOld;
    if (old) return end('blocked', 'gh-too-old', { installed: old.installed, minimum: old.minimum });
    return end('blocked', 'checks-unreadable', { error: checks.reason });
  }
  if (checks.details.failing.length) return next('implementation', 'check-failing', { checks: checks.details.failing.map((c) => `${c.name} (${c.link})`).join(', ') });
  if (boarding) {
    if (pr.autoMergeRequest != null) return next('delivery', 'disable-auto-merge', { number: pr.number });
    return boarding.onTrain ? end('waiting-on-github', 'on-train', { number: boarding.onTrain.number }) : end('waiting-for-owner', 'boarded');
  }
  if (checks.details.pending.length) return end('waiting-on-github', 'checks-pending', { checks: checks.details.pending.join(', ') });
  if (twoPrs) return end('waiting-for-owner', 'owner-merges-base', { number: pr.number, base: twoPrs.base });
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
  // An archived change ends `archived` before any stage is read; an active one follows the flow its pin names (guard.mjs#changeFlow).
  const followed = located.archived ? null : changeFlow(root, located.dir);
  const flow = followed ? followed.flow : readFlow(root, schema);
  if (!located.archived && !flow && !DEVKIT_SCHEMAS.includes(schema)) throw new FlowUsageError(`schema ${schema} has no flow.json and is not a devkit schema`);
  const facts = { id, schema, archived: located.archived };
  if (located.archived || !flow) return { facts, flow };
  const files = {};
  for (const s of flow.stages) if (s.source === 'artifact') files[s.id] = stageFiles(located.dir, s.file);
  Object.assign(facts, { files, opened: existsSync(join(located.dir, '.openspec.yaml')), skipped: [], tasks: null, dirty: [], head: null,
    flags: classificationFlags(located.dir), settings: readTestSettings(root).paths,
    flowVersion: { version: followed.version, installed: followed.installed, pinned: followed.pinned } });
  if (isPreviousScript(files, flow)) return { facts, flow };
  let config;
  try { config = deliveryConfig(root, schema); } catch (e) {
    if (e instanceof ShipConfigError) throw new FlowUsageError(e.message);
    throw e;
  }
  const gf = gitFacts(root);
  // The change's pull request, asked once and only when needed. Off the change's own branch a merged pull
  // request switches to the post-merge walk: the header commits were squashed away, so the stale check and
  // the task count give way to the headers themselves.
  const branch = currentBranch(root, env);
  let lookup = null;
  const two = config.model === 'two-prs';
  const trainOn = config.train !== null && isDevkitScript(schema);
  const delivery = () => (lookup ??= deliveryOf(gh, root, id, { ship: config.ship, branch, env, located, mergeFields: config.ship === 'merge' || trainOn, ...(trainOn ? { trainSuite: config.train } : {}), ...(two ? { base: config.base } : {}) }));
  let testLookup = null;
  const twoPrs = two ? { base: config.base, testBranch: config.testBranch, testPr: () => (testLookup ??= findTestPr(gh, { id, testBranch: config.testBranch })) } : null;
  const histories = new Map(); // the earlier headers of a stage file, read once and only for a failed stage (design D-1)
  const postMerge = config.ship !== 'plan' && offOwnBranch(root, id, branch) && delivery().delivered;
  Object.assign(facts, {
    head: gf.head, dirty: gf.dirty, fingerprint: fingerprint(root, gf.head), postMerge,
    staleness: (sha) => (postMerge ? null : sha === 'none' ? 'the header records no commit' : staleness(root, { sha, uncommitted: false }, gf)),
    staleReviewers: () => (postMerge ? [] : readReviews(root, id, gf).filter((r) => r.why).map((r) => r.name)),
    delivery: () => readDelivery({ ship: config.ship, gh, head: gf.head, delivery, twoPrs, train: trainOn ? (prHead) => trainFacts(gh, root, id, { suite: config.train, prHead, kind: 'change' }) : null }),
    history: (path) => {
      if (!histories.has(path)) histories.set(path, stageHistory(root, join(relative(root, located.dir), path), env));
      return histories.get(path);
    },
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
export const inSentence = (title) => (/^.[A-Z0-9]/.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1));
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
    'header-failed': (p) => `failed at attempt ${p.attempt}; failures in a row: ${p.failures} of ${p.ceiling}`,
    'stale-code': (p) => `the code changed since it ran (${p.why})`,
    'stale-plan': (p, n) => `${nameOf(n, p.by)} changed after it`,
    'stale-reviewers': (p) => `the reviews of ${p.names.join(', ')} are stale`,
    'tasks-pending': (p) => `${p.count} task${p.count === 1 ? '' : 's'} pending (${p.ids.join(', ')})`,
    uncommitted: (p) => `code changed and is not committed (${p.paths.join(', ')})`,
    'tasks-done': (p) => `${p.done} of ${p.total} tasks done`,
    'waits-for': (p) => `waits for stage ${p.n}`,
    'fix-after-failure': (p, n) => `the ${nameOf(n, p.failed)} failed at attempt ${p.attempt} (failures in a row: ${p.failures} of ${p.ceiling}) and the code has not changed since; the fix comes before another review`,
    'rerun-after-fix': (p, n) => `the ${nameOf(n, p.stage)} failed and the work changed since; it runs again`,
    'ceiling-reached': (p, n) => `the ${nameOf(n, p.stage)} failed at attempt ${p.attempt}; its failures in a row (${p.failures}) reached its ceiling of ${p.ceiling}`,
    'no-progress': (p, n) => `the ${nameOf(n, p.stage)} came back with nothing changed since the last run`,
    'past-point': (p, n) => `the change was already past the ${nameOf(n, p.after)} when this stage arrived`,
    'flag-absent': (p) => `the requirements' classification has no ${p.flag} flag`,
    'setting-absent': (p) => `openspec/config.yaml declares no devkit.${p.setting}`,
    'changes-asked': (p) => `the owner asked for changes at attempt ${p.attempt}`,
    'owner-changes': (p, n) => `the owner asked for changes to the ${nameOf(n, p.stage)} at attempt ${p.attempt}; it is drawn again`,
    'owner-pending': (p, n) => `the ${nameOf(n, p.stage)} waits for the owner`,
    'approval-stale': (p, n) => `the ${nameOf(n, p.stage)} is stale: the owner approves the revised plan again`,
    'undeclared-stage': (p) => `the script declares no ${p.stage} stage (${p.why})`,
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
    'gh-too-old': (p) => `the installed gh (${p.installed ?? 'unknown version'}) cannot read the checks; ${p.minimum} is the first version that can, so update gh`,
    'check-failing': (p) => `checks failing: ${p.checks}`,
    'checks-pending': (p) => `checks pending: ${p.checks}`,
    'owner-merges': (p) => `pull request #${p.number} is green; the owner merges it`,
    'no-test-pr': () => 'there is no pull request to the test branch for this change yet',
    'owner-merges-test-branch': (p) => `pull request #${p.number} to ${p.branch} is green; the owner merges it first, and the pull request to ${p.base} waits for it`,
    'owner-merges-base': (p) => `pull request #${p.number} to ${p.base} is green; the owner merges it`,
    'auto-merge-on': (p) => `auto-merge is on for pull request #${p.number}; waiting for ${p.waiting}`,
    'enable-auto-merge': (p) => `pull request #${p.number} is green; auto-merge is not on yet`,
    'pr-closed': (p) => `pull request #${p.number} was closed without merging`,
    'tasks-left-after-merge': (p) => `pull request #${p.number} merged with tasks left (${p.tasks}); they go in a further pull request`,
    boarded: () => 'every check of the contract is met; the change waits for the next delivery train',
    'on-train': (p) => `the change rides a delivery train; pull request #${p.number} of the train is open`,
    'left-train': (p) => `delivery train ${p.train} took the change off: it merges the base and fixes what the train's record says`,
    'disable-auto-merge': (p) => `auto-merge is on for pull request #${p.number}, and a change of a delivery train never merges by itself`,
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
    'header-failed': (p) => `falhou na tentativa ${p.attempt}; falhas seguidas: ${p.failures} de ${p.ceiling}`,
    'stale-code': (p) => `o código mudou desde que ela rodou (${p.why})`,
    'stale-plan': (p, n) => `${nameOf(n, p.by)} mudou depois dela`,
    'stale-reviewers': (p) => `as revisões de ${p.names.join(', ')} estão desatualizadas`,
    'tasks-pending': (p) => `${p.count} ${p.count === 1 ? 'tarefa pendente' : 'tarefas pendentes'} (${p.ids.join(', ')})`,
    uncommitted: (p) => `há código alterado e não commitado (${p.paths.join(', ')})`,
    'tasks-done': (p) => `${p.done} de ${p.total} tarefas feitas`,
    'waits-for': (p) => `espera a etapa ${p.n}`,
    'fix-after-failure': (p, n) => `a ${nameOf(n, p.failed)} falhou na tentativa ${p.attempt} (falhas seguidas: ${p.failures} de ${p.ceiling}) e nada mudou no código desde então; a correção vem antes de uma nova revisão`,
    'rerun-after-fix': (p, n) => `a etapa ${nameOf(n, p.stage)} falhou e o trabalho mudou desde então; ela roda de novo`,
    'ceiling-reached': (p, n) => `a etapa ${nameOf(n, p.stage)} falhou na tentativa ${p.attempt}; as falhas seguidas (${p.failures}) chegaram ao limite de ${p.ceiling}`,
    'no-progress': (p, n) => `a etapa ${nameOf(n, p.stage)} voltou sem nada ter mudado desde a última execução`,
    'past-point': (p, n) => `a change já tinha passado da etapa ${nameOf(n, p.after)} quando esta etapa chegou`,
    'flag-absent': (p) => `a classificação dos requisitos não tem a marca ${p.flag}`,
    'setting-absent': (p) => `o openspec/config.yaml não declara devkit.${p.setting}`,
    'changes-asked': (p) => `o dono pediu mudanças na tentativa ${p.attempt}`,
    'owner-changes': (p, n) => `o dono pediu mudanças na etapa ${nameOf(n, p.stage)} na tentativa ${p.attempt}; ela é refeita`,
    'owner-pending': (p, n) => `a etapa ${nameOf(n, p.stage)} espera o dono`,
    'approval-stale': (p, n) => `a etapa ${nameOf(n, p.stage)} está desatualizada: o dono aprova de novo o plano revisado`,
    'undeclared-stage': (p) => `o roteiro não declara a etapa ${p.stage} (${p.why})`,
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
    'gh-too-old': (p) => `o gh instalado (${p.installed ?? 'versão desconhecida'}) não consegue ler os checks; ${p.minimum} é a primeira versão que consegue, então atualize o gh`,
    'check-failing': (p) => `checks falhando: ${p.checks}`,
    'checks-pending': (p) => `checks pendentes: ${p.checks}`,
    'owner-merges': (p) => `o pull request #${p.number} está verde; o dono o mescla`,
    'no-test-pr': () => 'ainda não há pull request para a branch de teste desta change',
    'owner-merges-test-branch': (p) => `o pull request #${p.number} para ${p.branch} está verde; o dono o mescla primeiro, e o pull request para ${p.base} espera por ele`,
    'owner-merges-base': (p) => `o pull request #${p.number} para ${p.base} está verde; o dono o mescla`,
    'auto-merge-on': (p) => `o auto-merge está ligado no pull request #${p.number}; esperando ${p.waiting}`,
    'enable-auto-merge': (p) => `o pull request #${p.number} está verde; o auto-merge ainda não está ligado`,
    'pr-closed': (p) => `o pull request #${p.number} foi fechado sem mesclar`,
    'tasks-left-after-merge': (p) => `o pull request #${p.number} foi mesclado com tarefas pendentes (${p.tasks}); elas vão num novo pull request`,
    boarded: () => 'todos os itens do contrato estão cumpridos; a change espera o próximo trem de entrega',
    'on-train': (p) => `a change vai num trem de entrega; o pull request #${p.number} do trem está aberto`,
    'left-train': (p) => `o trem de entrega ${p.train} tirou a change: ela mescla a base e corrige o que o registro do trem diz`,
    'disable-auto-merge': (p) => `o auto-merge está ligado no pull request #${p.number}, e uma change de trem de entrega nunca mescla sozinha`,
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
    // First match wins (design stage-roles D-2): a stage the change was already past, a flag or a setting that does not
    // hold, a role that is not shipped; else the file is the next thing to write. A file that exists skips all of these.
    if (stage.notAfter && (facts.files[stage.notAfter] ?? []).length > 0) return out('not-applicable', 'past-point', { after: stage.notAfter });
    const when = stage.appliesWhen;
    if (when?.flag && !(facts.flags ?? []).includes(when.flag.toLowerCase())) return out('not-applicable', 'flag-absent', { flag: when.flag });
    if (when?.setting && !(when.setting in (facts.settings ?? {}))) return out('not-applicable', 'setting-absent', { setting: when.setting });
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
  // The review stage is also stale while a reviewer's own file is (the header can be current when a file is not).
  if (!stale && stage.id === 'review' && facts.staleReviewers) {
    const names = facts.staleReviewers();
    if (names.length) stale = { code: 'stale-reviewers', params: { names } };
  }
  // Once the work has started, ticking tasks.md must not make the plan review stale (conduct-check's rule).
  if (!stale && !started && !facts.postMerge) {
    const mine = maxMtime(files);
    for (const a of stage.staleAfter ?? []) {
      const other = maxMtime(facts.files[a] ?? []);
      if (mine !== null && other !== null && other - mine > FRESH_MS) { stale = { code: 'stale-plan', params: { by: a } }; break; }
    }
  }
  const ceiling = stage.ceiling === 'owner' ? null : stage.ceiling ?? flow.ceilings.default;
  if (result === 'failed' && stage.ceiling === 'owner') return out('failed', 'changes-asked', { attempt: h.attempt }, info);
  if (result === 'failed') {
    // The failures in a row since the stage file last passed, from git (design D-1, D-3); a facts with no history counts none earlier.
    const f = files.find((x) => x.header.result === 'failed');
    const failures = failuresInARow(h, facts.history?.(f.path) ?? []);
    return out('failed', 'header-failed', { attempt: h.attempt, failures, ceiling }, { ...info, failures, fixed: stale !== null });
  }
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
  const report = { version: 1, change: facts.id, schema: facts.schema, script: 'current', head: facts.head ?? null, stages: [], next: null, end: null, previous: null, flow: null };
  if (facts.archived) {
    report.end = { state: 'archived', stage: null, ...note('archived', {}) };
    return report;
  }
  const previous = (code) => ({ ...report, script: 'previous', previous: { finishedBy: 'ship-change', ...note(code, {}) } });
  if (!flow) return previous('schema-without-declaration');
  if (isPreviousScript(facts.files, flow)) return previous('previous-script');
  report.flow = facts.flowVersion ?? null;

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
    // A script that declares no such stage (a slice has no retro and no implementation) ends blocked, not thrown (D-3).
    if (i === -1) return finishEnd('blocked', stageId, 'undeclared-stage', { stage: stageId, why: reasonText('en', code, params, names) });
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
    // The owner ends the attempts of a stage declared `ceiling: "owner"`: it is drawn again, never blocked by a number.
    if (s.ceiling === 'owner') return offer(s.id, 'owner-changes', { stage: s.id, attempt: raw.attempt });
    const ceiling = ceilingOf(s);
    if (raw.failures >= ceiling) return finishEnd('blocked', s.id, 'ceiling-reached', { stage: s.id, attempt: raw.attempt, failures: raw.failures, ceiling });
    if (raw.fixed) return offer(s.id, 'rerun-after-fix', { stage: s.id });
    return offer(s.onFail ?? s.id, 'fix-after-failure', { failed: s.id, attempt: raw.attempt, failures: raw.failures, ceiling });
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
    newer: (version, installed, schema, id) => `Flow: this change follows version ${version} of the ${schema} script; version ${installed} is installed. To move it: change-loop.mjs flow ${id}.`,
    ends: { archived: 'End: archived.', 'waiting-for-owner': 'End: waiting for the owner.', 'waiting-on-github': 'End: waiting on GitHub.', blocked: 'End: blocked.' },
    previous: "This change began under the previous script: its files carry no stage header. Today's flow finishes it (ship-change, led by deliver-check). This command stops nothing.",
  },
  'pt-BR': {
    script: (name) => `roteiro ${name}`,
    states: { passed: 'passou', failed: 'falhou', 'not-applicable': 'não se aplica', stale: 'desatualizada', pending: 'pendente', blocked: 'bloqueada' },
    next: 'Próxima etapa', who: 'Quem executa', why: 'Por quê',
    newer: (version, installed, schema, id) => `Fluxo: esta change segue a versão ${version} do roteiro ${schema}; a versão ${installed} está instalada. Para mudá-la: change-loop.mjs flow ${id}.`,
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
  if (entry.reasonCode === 'passed' || entry.reasonCode === 'header-failed' || entry.reasonCode === 'changes-asked') return said;
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
  const flowAt = report.flow;
  if (Number.isInteger(flowAt?.version) && Number.isInteger(flowAt?.installed) && flowAt.installed > flowAt.version) {
    lines.splice(1, 0, w.newer(flowAt.version, flowAt.installed, report.schema, report.change));
  }
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

// ---------------------------------------------------------------- the spend block (stage-models D-7)

// The token cap of change `id`: its own `budget:`, else the project's; null when none is set or the value is no cap (a file that cannot
// be read and an invalid value show no cap here: the loop's own `next` is what refuses them).
function capOf(root, id) {
  const budgetIn = (file) => { try { return budgetValue(parseDevkitBlock(readFileSync(file, 'utf8')).budget); } catch { return null; } };
  const dir = locateChange(root, id)?.dir ?? join(root, 'openspec', 'changes', id);
  const picked = budgetIn(join(dir, '.openspec.yaml')) ?? budgetIn(join(root, 'openspec', 'config.yaml'));
  return picked?.cap ?? null;
}

// The lines of the spend block of change `id` in its checkout `root` (none when no token was counted), the stages named by their titles
// in `lang` as the change's flow gives them (`flow` when the caller has read it). It writes nothing.
export function spendBlock(root, id, { lang = 'pt-BR', env = process.env, flow } = {}) {
  let stages = flow;
  if (stages === undefined) {
    try {
      const dir = locateChange(root, id)?.dir ?? join(root, 'openspec', 'changes', id);
      stages = readFlow(root, changeSchemaAt(root, dir));
    } catch { stages = null; }
  }
  const titleOf = (stage) => { const title = stages?.stages.find((s) => s.id === stage)?.title; return title?.[lang] ?? title?.en ?? stage; };
  try { return spendLines(lang, spendOf(spendSources(env, root), id), { cap: capOf(root, id), titleOf }); } catch { return []; }
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
  if (r.refused) throw new FlowUsageError(r.refused);
  if (r.missing) throw new FlowUsageError('the openspec CLI is not installed or not on PATH');
  const refusal = openspecRefusal(openspec.cli ?? { pinned: false, where: 'PATH' }, r.stdout);
  if (refusal) throw new FlowUsageError(refusal);
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
    const spend = json ? [] : spendBlock(root, opts.id, { lang: opts.lang, env, flow });
    const text = json ? `${JSON.stringify(report, null, 2)}\n` : `${renderText(report, flow, opts.lang)}${spend.length ? `\n${spend.join('\n')}\n` : ''}`;
    return { code, stdout: text, stderr: '' };
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
