#!/usr/bin/env node
// devkit guard for OpenSpec projects. Claude Code hook, no dependencies.
//
//   node guard.mjs edit     PreToolUse on Edit|Write|MultiEdit|NotebookEdit
//   node guard.mjs bash     PreToolUse on Bash
//   node guard.mjs session  SessionStart: prints where the active change stands,
//                           and the current round of openspec/roadmap.md if any
//   node guard.mjs ci       CI: the devkit-reviews check, run by deliver-check.mjs --ci (exit 1)
//   node guard.mjs stop          Stop: in a `/devkit change` run, the session does not end its turn while a stage is ready
//   node guard.mjs subagent-stop SubagentStop: a stage agent does not stop before its stage file is delivered
//   node guard.mjs agent         PreToolUse on Agent: in a run, work goes only to the roles of the change's script
//   node guard.mjs skill         PreToolUse on Skill: devkit-session runs only on the ticket a roadmap run wrote for its change
//
// It only vetoes (exit 2 + reason on stderr). The flow lives in the OpenSpec
// schema; this file enforces what the CLI can't see:
//
// 1. Roles. Claude Code tells a hook which subagent is acting (agent_type), so
//    each gate file has exactly one writer and the author of a plan can't
//    approve it:
//      readiness.md              plan-readiness-reviewer
//      reviews/<reviewer>.md     that reviewer
//      evidence.md               pr-verifier
//      product code              tdd-implementer (devkit schema, once approved)
//      decision records          adr-author (a Markdown file in a folder named adr, adrs or decisions)
//      test files                e2e-tester (devkit schema, once approved; a test folder or a test file name)
// 2. Gates. Product code stays closed until readiness.md says
//    "- Status: APPROVED"; `gh pr create` needs every review in reviews/ to be
//    approved (code-quality-reviewer and test-coverage-reviewer at least) and an
//    evidence.md.
// 3. Destructive git is refused.
// 4. A `/devkit change` run (the newest slash command typed in the session, and the
//    `devkit-run: <id>` line the loop printed after it, both read from the transcript):
//    the session itself writes no product code, hands work only to the script's roles,
//    and does not stop while the loop has a stage ready; a stage agent does not stop
//    before delivering its file. These locks refuse at most once for an unchanged state
//    and let everything through on any error of their own (design change-coordinator D-8).
//    A `/devkit roadmap` run (`devkit-roadmap: <n>` printed after the typed command) holds the same
//    locks for every change the run has open (design roadmap-coordinator D-11).
//
// Only in projects whose openspec/config.yaml selects the devkit or devkit-lite
// schema (ADR 0004). Anywhere else session, edit and bash print nothing and
// block nothing, destructive git included, even when the plugin is loaded at
// user scope. `ci` does not depend on it.
//
// Active change: $DEVKIT_CHANGE, else the change whose name the git branch
// ends with (or contains), else the only open change. No open change means
// the work is outside the flow and nothing is gated.
//
// Bypass: start Claude Code with DEVKIT_BYPASS=1 (a prefix inside the command
// string does not reach this process). CI ignores it.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync, appendFileSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];

export const REQUIRED_REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer'];
export const REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer',
  'security-reviewer', 'adr-reviewer', 'spec-reviewer'];

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function block(reason) {
  process.stderr.write(`devkit guard: ${reason}\n`);
  process.exit(2);
}

// "devkit-core:tdd-implementer" -> "tdd-implementer"; main session -> "".
export function role(input) {
  return String(input.agent_type || '').split(':').pop();
}

export function findRoot(start) {
  let dir = resolve(start || process.cwd());
  for (;;) {
    if (existsSync(join(dir, 'openspec', 'changes'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
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

// True when the raw value starts with a quote and has no second quote of the same kind.
function unclosedQuote(raw) {
  const text = raw.replace(/\r$/, '').trim();
  const quote = text[0];
  return (quote === '"' || quote === "'") && text.indexOf(quote, 1) === -1;
}

const DELIVERY_KEYS = ['model', 'base', 'test_branch', 'train'];

// The `devkit:` block of openspec/config.yaml, read with one level of nesting (delivery-models D-1, D-11):
// { driver, language, budget, release_tag, delivery: { model, base, test_branch, train, trainUnclosed? }, models } (`budget` from change-budget,
// `release_tag` from release-tags D-1, `models` from stage-models D-2). `models` is a Map from each key written under a `models:` line to its
// value, in file order, a later duplicate winning; an inline value (`models: opus`) is recorded under the key ''. A value that is
// not set, or empty, is undefined; a key nested under `delivery:` or `models:` never sets `driver`, `language`, `budget` or
// `release_tag`; an entry nested deeper than the table is ignored; other keys of the block are ignored. `trainUnclosed` is set
// (delivery-train D-1) when the raw value of `train` opens a quote it never closes, which `plainValue` would read as the rest of the line.
export function parseDevkitBlock(text) {
  const block = { driver: undefined, language: undefined, budget: undefined, release_tag: undefined, delivery: { model: undefined, base: undefined, test_branch: undefined }, models: new Map() };
  let inBlock = false;
  let indent = null;
  let inDelivery = false;
  let inModels = false;
  let modelsIndent = null;
  for (const line of String(text).split('\n')) {
    if (/^devkit:\s*(#.*)?\r?$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) { inBlock = false; continue; }
    const m = /^(\s+)([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!m) continue;
    if (indent === null) indent = m[1].length;
    const value = plainValue(m[3]) || undefined;
    if (m[1].length > indent) {
      if (inDelivery && DELIVERY_KEYS.includes(m[2])) {
        block.delivery[m[2]] = value;
        if (m[2] === 'train') block.delivery.trainUnclosed = unclosedQuote(m[3]);
      }
      if (inModels) {
        if (modelsIndent === null) modelsIndent = m[1].length;
        if (m[1].length === modelsIndent) block.models.set(m[2], value);
      }
      continue;
    }
    inDelivery = m[2] === 'delivery';
    inModels = m[2] === 'models';
    modelsIndent = null;
    if (inModels && value !== undefined) block.models.set('', value);
    if (m[2] === 'driver' || m[2] === 'language' || m[2] === 'budget' || m[2] === 'release_tag') block[m[2]] = value;
  }
  return block;
}

// A path from the repository root to a JSON file (release-tags D-1): every segment is made of letters, digits, `.`, `_` and `-`
// and is neither `.` nor `..`, so nothing leaves the repository or breaks the contents URL; the last one ends with `.json`.
function isJsonPath(value) {
  const segments = value.split('/');
  return segments.every((s) => /^[A-Za-z0-9._-]+$/.test(s) && s !== '.' && s !== '..') && segments[segments.length - 1].endsWith('.json');
}

// { file } from a parsed block: the JSON file the release is read from, or `file: null` when `release_tag` is not set. A value
// that is not such a path is `{ file: null, problem: { kind: 'unknown', setting: 'release-tag', value } }`.
export function releaseTagSetting(block) {
  const value = block?.release_tag;
  if (value === undefined) return { file: null };
  if (isJsonPath(value)) return { file: value };
  return { file: null, problem: { kind: 'unknown', setting: 'release-tag', value } };
}

export const DELIVERY_MODELS = ['two-prs', 'trunk', 'trunk-auto'];

// { model, base, testBranch, problems } from a parsed block: the table of delivery-models D-1. `base` and `testBranch`
// are read for `two-prs` only. A problem is { kind: 'unknown', setting, value } or { kind: 'missing', setting }.
export function deliverySettings(block) {
  const { model, base, test_branch: testBranch } = block?.delivery ?? {};
  const none = { model: null, base: null, testBranch: null, problems: [] };
  if (!model) return none;
  if (model === 'trunk' || model === 'trunk-auto') return { ...none, model };
  if (model !== 'two-prs') return { ...none, problems: [{ kind: 'unknown', setting: 'delivery-model', value: model }] };
  const problems = [];
  if (!base) problems.push({ kind: 'missing', setting: 'delivery-base' });
  if (!testBranch) problems.push({ kind: 'missing', setting: 'delivery-test-branch' });
  if (base && testBranch && base === testBranch) problems.push({ kind: 'unknown', setting: 'delivery-test-branch', value: testBranch });
  return { model, base: base ?? null, testBranch: testBranch ?? null, problems };
}

// The delivery settings of the project at `root`; no file, or one that cannot be read, is no model.
export function readDeliverySettings(root) {
  try { return deliverySettings(parseDevkitBlock(readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8'))); } catch {
    return deliverySettings(null);
  }
}

// { suite, problem } from a parsed block: the table of delivery-train D-1. `suite` is the whole-suite command of the train
// (the train is on) and `problem` is { kind: 'train-model', model } or { kind: 'unknown', setting, value }; both are null
// without the key or with an empty value. The value is never split or run here.
export function trainSetting(block) {
  const { model, train, trainUnclosed } = block?.delivery ?? {};
  if (!train) return { suite: null, problem: null };
  if (trainUnclosed) return { suite: null, problem: { kind: 'unknown', setting: 'delivery-train', value: train } };
  if (model === 'trunk' || model === 'trunk-auto') return { suite: train, problem: null };
  return { suite: null, problem: { kind: 'train-model', model: model === 'two-prs' ? model : null } };
}

// The train setting of the project at `root`; no file, or one that cannot be read, is no train.
export function readTrainSetting(root) {
  try { return trainSetting(parseDevkitBlock(readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8'))); } catch {
    return trainSetting(null);
  }
}

function activeChanges(root) {
  const dir = join(root, 'openspec', 'changes');
  return readdirSync(dir).filter((n) => n !== 'archive' && !n.startsWith('.')
    && statSync(join(dir, n)).isDirectory());
}

function gitBranch(root) {
  try {
    // symbolic-ref also works before the first commit; detached HEAD gives ''.
    return execFileSync('git', ['-C', root, 'symbolic-ref', '--short', '-q', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

function archivedIds(root) {
  const dir = join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((a) => a.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)?.[1]).filter(Boolean);
}

// The change a `chore/archive-<id>` branch is for: <id> when it is a known
// change, active or archived (exact id after the date prefix), else null.
export function archiveBranchChange(root, branch) {
  const id = /^chore\/archive-(.+)$/.exec(branch || '')?.[1];
  if (!id) return null;
  return activeChanges(root).includes(id) || archivedIds(root).includes(id) ? id : null;
}

// Returns { name } | { ambiguous: [...] } | null
export function resolveChange(root, env = process.env,
  branch = env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF || gitBranch(root)) {
  const changes = activeChanges(root);
  if (changes.length === 0) return null;
  if (env.DEVKIT_CHANGE) {
    return changes.includes(env.DEVKIT_CHANGE) ? { name: env.DEVKIT_CHANGE } : null;
  }
  const archiving = archiveBranchChange(root, branch);
  if (archiving) return changes.includes(archiving) ? { name: archiving } : null;
  const tail = branch.split('/').pop();
  const exact = changes.filter((c) => c === tail);
  if (exact.length === 1) return { name: exact[0] };
  const contained = changes.filter((c) => branch.includes(c));
  if (contained.length === 1) return { name: contained[0] };
  if (changes.length === 1) return { name: changes[0] };
  return { ambiguous: changes };
}

export function changeSchema(root, name) {
  return changeSchemaAt(root, join(root, 'openspec', 'changes', name));
}

// The schema of the change whose folder is `dir` (active or archived): its
// own .openspec.yaml, else the project's default.
export function changeSchemaAt(root, dir) {
  for (const f of [join(dir, '.openspec.yaml'), join(root, 'openspec', 'config.yaml')]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^schema:\s*["']?([\w.-]+)/m);
    if (m) return m[1];
  }
  return 'spec-driven';
}

export const DEVKIT_SCHEMAS = ['devkit', 'devkit-lite'];

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

// The six stage records of a `devkit-project` slice, in order (the CI job reads no schema, so the names are
// a constant; a test pins them to the artifact files of schemas/devkit-project/flow.json).
export const PROJECT_STAGE_FILES = ['business.md', 'domain-model.md', 'architecture.md', 'implementation-plan.md', 'roadmap.md', 'review.md'];

// The `Commit: <sha>` line of a verdict or evidence file header (before the
// first markdown heading): { sha, uncommitted } or null.
export function parseCommitLine(text) {
  const header = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) break;
    header.push(line);
  }
  const re = /^[ \t]*(?:[-*][ \t]+)?\**Commit[ \t]*:\**[ \t]*`?([0-9a-f]{7,40})\b(.*)$/i;
  for (const line of header) {
    const m = line.match(re);
    if (m) return { sha: m[1].toLowerCase(), uncommitted: /\(uncommitted changes\)/i.test(m[2]) };
  }
  return null;
}

// ---------------------------------------------------------------- the slice contract (design D-8, D-11)

const gitRead = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gitPasses = (root, args) => { try { gitRead(root, args); return true; } catch { return false; } };
// The paths a commit changes against its first parent (a root commit: against nothing).
const commitPaths = (root, sha) => (gitPasses(root, ['rev-parse', '--verify', '--quiet', `${sha}^1`])
  ? gitRead(root, ['diff', '--name-only', '-z', '--no-renames', `${sha}^1`, sha])
  : gitRead(root, ['diff-tree', '-r', '-z', '--root', '--name-only', '--no-commit-id', sha])).split('\0').filter(Boolean);

// The folders a later commit must not touch once the ADR review is written.
const reviewedPaths = (slice) => [`docs/design/${slice}/`, 'docs/adr/', 'docs/decisions/'];

// Why the ADR review of `slice`, written at commit `sha`, is behind `head`, or null: a commit after `sha` changes, against its
// first parent, a file under the slice's design folder or an ADR folder.
// A merge counts what it brought into the branch (its first-parent diff): a merge of the default branch that brings none
// of those files keeps the review current, and one that brings a file under an ADR folder (another change's new ADR) makes
// it stale, because a new ADR may conflict with the slice and the ADR reviewer must read it (project-phases-followups).
export function sliceReviewStale(root, sha, slice, head = 'HEAD') {
  const folders = reviewedPaths(slice);
  for (const c of gitRead(root, ['rev-list', `${sha}..${head}`]).split('\n').filter(Boolean)) {
    const file = commitPaths(root, c).find((f) => folders.some((d) => f.startsWith(d)));
    if (file) return `the ADR review is behind ${c.slice(0, 7)}, which changes ${file}`;
  }
  return null;
}

// The problems of the archived `devkit-project` folder `folder` (relative to `root`) at `head` against `base`: its records, the
// ADR verdict, the paths of the pull request and its roadmap. An empty list is a slice that meets the contract.
export function sliceProblems(root, folder, { base, head = 'HEAD' }) {
  const problems = [];
  const slice = basename(folder).replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const results = {};
  for (const file of PROJECT_STAGE_FILES) {
    const stage = file.replace(/\.md$/, '');
    const path = join(root, folder, file);
    if (!existsSync(path)) { problems.push(`${file} is missing`); continue; }
    const h = parseStageHeader(readFileSync(path, 'utf8'));
    if (!h) { problems.push(`${file} has no stage header on its first line`); continue; }
    if (h.malformed) { problems.push(`${file} has a malformed stage header`); continue; }
    if (h.stage !== stage) { problems.push(`${file} opens with the header of stage ${h.stage}, not ${stage}`); continue; }
    results[stage] = h.result;
    const allowed = stage === 'review' ? ['passed'] : ['passed', 'not-applicable'];
    if (!allowed.includes(h.result)) problems.push(`${file} says result=${h.result}, not ${allowed.join(' or ')}`);
  }
  const verdictFile = join(root, folder, 'reviews', 'adr-reviewer.md');
  if (!existsSync(verdictFile)) problems.push('reviews/adr-reviewer.md is missing');
  else {
    const verdict = readValue(verdictFile, 'Verdict');
    if (verdict !== 'APPROVED' && verdict !== 'DECLINED') problems.push(`reviews/adr-reviewer.md: Verdict is ${verdict ?? 'missing'}, not APPROVED or DECLINED`);
    const recorded = parseCommitLine(readFileSync(verdictFile, 'utf8'));
    if (!recorded) problems.push('reviews/adr-reviewer.md has no Commit: line');
    else {
      const short = recorded.sha.slice(0, 7);
      let full = '';
      try { full = gitRead(root, ['rev-parse', '--verify', '--quiet', `${recorded.sha}^{commit}`]).trim(); } catch { /* unresolved */ }
      if (recorded.uncommitted) problems.push(`reviews/adr-reviewer.md: Commit ${short} was recorded with uncommitted changes`);
      else if (!full) problems.push(`reviews/adr-reviewer.md: Commit ${short} does not resolve to a commit`);
      else if (!gitPasses(root, ['merge-base', '--is-ancestor', full, head])) problems.push(`reviews/adr-reviewer.md: Commit ${short} is not an ancestor of ${head}`);
      else { const why = sliceReviewStale(root, full, slice, head); if (why) problems.push(why); }
    }
  }
  let paths = [];
  let mergeBase = null;
  try {
    mergeBase = gitRead(root, ['merge-base', base, head]).trim();
    paths = gitRead(root, ['diff', '--name-only', '-z', '--no-renames', `${base}...${head}`]).split('\0').filter(Boolean);
  } catch { problems.push(`${base} is not available to compare the slice with; fetch the full history`); }
  const allowedPaths = [...reviewedPaths(slice), `${folder}/`];
  for (const p of paths.filter((f) => f !== 'openspec/roadmap.md' && !allowedPaths.some((d) => f.startsWith(d)))) {
    problems.push(`${p} is outside the slice's files (${[...reviewedPaths(slice), folder, 'openspec/roadmap.md'].join(', ')})`);
  }
  if (paths.includes('openspec/roadmap.md')) {
    if (results.roadmap === 'not-applicable') problems.push('openspec/roadmap.md must stay as it was: roadmap.md of the slice is not applicable');
    else if (mergeBase) {
      let before = null;
      try { before = gitRead(root, ['show', `${mergeBase}:openspec/roadmap.md`]); } catch { /* absent at the base: anything goes */ }
      let after = null;
      try { after = gitRead(root, ['show', `${head}:openspec/roadmap.md`]); } catch { /* absent at the head: the slice deleted it */ }
      if (after === null) problems.push('openspec/roadmap.md may only be appended to by a slice: the slice deleted it');
      else if (before !== null && !after.startsWith(before)) problems.push('openspec/roadmap.md may only be appended to by a slice: an existing line changed');
    }
  }
  return problems;
}

// The archived folder of the slice a branch is for (the branch is named after the slice), as { id, folder } relative to
// `root`, when that folder is on `devkit-project`; else null.
export function archivedSliceOf(root, branch) {
  if (!branch || branch === 'main' || branch === 'master' || !/^[\w.-]+$/.test(branch)) return null;
  const dir = join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir).filter((a) => a.replace(/^\d{4}-\d{2}-\d{2}-/, '') === branch && /^\d{4}-\d{2}-\d{2}-/.test(a)).sort();
  const name = found[found.length - 1];
  if (!name || changeSchemaAt(root, join(dir, name)) !== 'devkit-project') return null;
  return { id: branch, folder: `openspec/changes/archive/${name}` };
}

// The default branch's remote ref (`origin/<name>`), or null when none resolves.
function defaultRef(root) {
  const names = [];
  try { names.push(gitRead(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']).trim()); } catch { /* no remote HEAD */ }
  names.push('origin/main', 'origin/master');
  return names.find((n) => n && gitPasses(root, ['rev-parse', '--verify', '--quiet', `${n}^{commit}`])) ?? null;
}

// The project's default schema: openspec/config.yaml `schema:`, else null.
export function projectSchema(root) {
  const f = join(root, 'openspec', 'config.yaml');
  if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8').match(/^schema:\s*["']?([\w.-]+)/m)?.[1] ?? null;
}

// Has this project chosen devkit? Its openspec/config.yaml selects a devkit schema.
export function optedIn(root) { return DEVKIT_SCHEMAS.includes(projectSchema(root)); }

export function schemaFile(root, schema) {
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  for (const p of [
    join(root, 'openspec', 'schemas', schema, 'schema.yaml'),
    join(dataHome, 'openspec', 'schemas', schema, 'schema.yaml'),
  ]) if (existsSync(p)) return p;
  return null;
}

export function schemaHasArtifact(root, schema, id) {
  const f = schemaFile(root, schema);
  if (!f) return false;
  return new RegExp(`^\\s*-\\s*id:\\s*${id}\\s*$`, 'm').test(readFileSync(f, 'utf8'));
}

// ---------------------------------------------------------------- the flow a change follows (change-version-pin D-1 to D-3)

export class FlowUsageError extends Error {
  constructor(message) { super(message); this.name = 'FlowUsageError'; }
}

// The flow file reader lives here because the devkit-reviews job downloads this file; flow-check.mjs imports and re-exports it.
const SOURCES = ['folder', 'artifact', 'tasks', 'github'];
const PARTS = ['open', 'plan', 'build', 'after', 'delivery', 'close'];
const STAGE_KEYS = ['id', 'source', 'file', 'role', 'skills', 'helpers', 'part', 'title', 'shipped', 'owner',
  'ceiling', 'onFail', 'staleAfter', 'codeBound', 'appliesWhen', 'notAfter'];
const SETTING_PATH = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;
export const FLOW_LANGS = ['en', 'pt-BR'];

// The script's declaration of its stages (design D-5): flow.json next to the schema's schema.yaml.
// null when the schema folder has none; a FlowUsageError when it is malformed.
export function readFlow(root, schema) {
  const sf = schema ? schemaFile(root, schema) : null;
  if (!sf) return null;
  const f = join(dirname(sf), 'flow.json');
  if (!existsSync(f)) return null;
  return readFlowFile(f, schema);
}

// The declaration in the flow.json at `f`, checked; `name` is what its error messages call it (a schema name or a path).
export function readFlowFile(f, name = f) {
  const bad = (why) => new FlowUsageError(`flow.json of ${name} is malformed: ${why}`);
  let flow;
  try { flow = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw bad(`not JSON (${e.message})`); }
  if (!flow || typeof flow !== 'object' || !Array.isArray(flow.stages) || flow.stages.length === 0) throw bad('no stages');
  if (!Number.isInteger(flow.version) || flow.version < 1) throw bad(`version ${flow.version} is not a whole number from 1`);
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
    for (const l of FLOW_LANGS) if (typeof s.title?.[l] !== 'string' || !s.title[l]) throw bad(`stage ${s.id} has no ${l} title`);
    if (s.ceiling !== undefined && s.ceiling !== 'owner' && !(Number.isInteger(s.ceiling) && s.ceiling >= 1)) {
      throw bad(`stage ${s.id} has a ceiling that is neither a whole number from 1 nor "owner": ${JSON.stringify(s.ceiling)}`);
    }
    if (s.appliesWhen !== undefined) {
      const w = s.appliesWhen;
      const keys = w && typeof w === 'object' && !Array.isArray(w) ? Object.keys(w) : [];
      const value = keys.length === 1 ? w[keys[0]] : undefined;
      const ok = (keys[0] === 'flag' && typeof value === 'string' && value !== '') || (keys[0] === 'setting' && typeof value === 'string' && SETTING_PATH.test(value));
      if (!ok) throw bad(`stage ${s.id} has an appliesWhen that is not exactly one of a flag or a dotted setting, each a non-empty string`);
    }
  });
  flow.stages.forEach((s, i) => {
    if (s.onFail !== undefined && !(index.has(s.onFail) && index.get(s.onFail) <= i)) {
      throw bad(`stage ${s.id} has an onFail that is unknown or later: ${s.onFail}`);
    }
    for (const a of s.staleAfter ?? []) {
      if (!(index.has(a) && index.get(a) < i)) throw bad(`stage ${s.id} has a staleAfter that is unknown or later: ${a}`);
    }
    if (s.notAfter !== undefined && !(index.has(s.notAfter) && index.get(s.notAfter) > i && flow.stages[index.get(s.notAfter)].source === 'artifact')) {
      throw bad(`stage ${s.id} has a notAfter that is not a later artifact stage: ${JSON.stringify(s.notAfter)}`);
    }
  });
  return flow;
}

// The pin of the change whose folder is `dir`: the x-devkit-flow and x-devkit-version lines of its .openspec.yaml (D-1).
// { flow: number | null, devkit: string | null }; a flow that is not a whole number from 1 throws a FlowUsageError.
export function readPin(dir) {
  let text;
  try { text = readFileSync(join(dir, '.openspec.yaml'), 'utf8'); } catch { return { flow: null, devkit: null }; }
  const valueOf = (key) => {
    const m = new RegExp(`^${key}:(.*)$`, 'm').exec(text);
    if (!m) return null;
    const bare = m[1].replace(/\r$/, '').replace(/(^|\s)#.*$/, '').trim();
    return bare.replace(/^(["'])(.*)\1$/, '$2');
  };
  const flow = valueOf('x-devkit-flow');
  if (flow !== null && !/^[1-9][0-9]{0,5}$/.test(flow)) {
    throw new FlowUsageError(`${basename(dir)}'s .openspec.yaml has x-devkit-flow "${flow}", not a flow version (a whole number from 1)`);
  }
  return { flow: flow === null ? null : Number(flow), devkit: valueOf('x-devkit-version') || null };
}

// The flow the change in `dir` follows (D-3): the one its pin names (version 1 with no pin), from the installed flow.json when
// that is the version, else from the kept flows/<n>.json. flow is null for a script with no flow.json and no pin.
export function changeFlow(root, dir) {
  const schema = changeSchemaAt(root, dir);
  const pin = readPin(dir);
  const sf = schemaFile(root, schema);
  const folder = sf ? dirname(sf) : null;
  const installedFile = folder ? join(folder, 'flow.json') : null;
  const installed = installedFile && existsSync(installedFile) ? readFlowFile(installedFile, schema) : null;
  if (!installed && pin.flow === null) return { schema, flow: null, version: null, installed: null, pinned: false, devkit: pin.devkit };
  const want = pin.flow ?? 1;
  let flow = installed;
  if (installed?.version !== want) {
    const kept = folder ? join(folder, 'flows', `${want}.json`) : null;
    const rel = kept ? relative(root, kept) : '';
    const shown = kept ? (rel.startsWith('..') ? kept : rel) : `openspec/schemas/${schema}/flows/${want}.json`;
    if (!kept || !existsSync(kept)) {
      throw new FlowUsageError(`${basename(dir)} follows flow ${want} of the ${schema} script, and this checkout has no ${shown}: re-run openspec-setup with a devkit-openspec that ships it`);
    }
    flow = readFlowFile(kept, `${schema} flow ${want}`);
    if (flow.version !== want) throw new FlowUsageError(`${shown} declares version ${flow.version}, not ${want}`);
  }
  return { schema, flow, version: want, installed: installed?.version ?? null, pinned: pin.flow !== null, devkit: pin.devkit };
}

// Does the flow the change follows declare a stage `stageId`? With no flow declared, the installed schema.yaml answers, as before.
export function changeDeclares(root, dir, stageId) {
  const { flow, schema } = changeFlow(root, dir);
  return flow ? flow.stages.some((s) => s.id === stageId) : schemaHasArtifact(root, schema, stageId);
}

// changeDeclares for a reader that is not a hard gate (the code gate, the conductor's planning rows): a FlowUsageError
// (a malformed pin, a missing or wrong kept file, a malformed flow.json) falls back to the installed schema.yaml.
export function changeDeclaresOrInstalled(root, dir, stageId) {
  try { return changeDeclares(root, dir, stageId); } catch (e) {
    if (!(e instanceof FlowUsageError)) throw e;
    return schemaHasArtifact(root, changeSchemaAt(root, dir), stageId);
  }
}

// The single value of a "Status:" / "Verdict:" line, upper-cased. A template
// line with the alternatives still in it ("APPROVED | BLOCKED") is not a value.
export function readValue(file, key) {
  if (!existsSync(file)) return null;
  const re = new RegExp(`^\\s*[-*]?\\s*\\**${key}\\**\\s*:\\s*\\**\\s*(.+?)\\s*\\**\\s*$`, 'im');
  const m = readFileSync(file, 'utf8').match(re);
  if (!m) return null;
  const v = m[1].replace(/[`*]/g, '').trim();
  if (v.includes('|')) return null;
  return v.split(/\s+/)[0].replace(/[.,;:]$/, '').toUpperCase();
}

export function changeDir(root, name) { return join(root, 'openspec', 'changes', name); }

// Consensus from reviews/<reviewer>.md, each written by that reviewer.
export function reviewConsensus(dir) {
  const rdir = join(dir, 'reviews');
  const found = existsSync(rdir) ? readdirSync(rdir).filter((f) => f.endsWith('.md')) : [];
  const verdicts = Object.fromEntries(found.map((f) => [basename(f, '.md'), readValue(join(rdir, f), 'Verdict')]));
  const missing = REQUIRED_REVIEWERS.filter((r) => !(r in verdicts));
  // "declined" = no surface for that reviewer (e.g. security on a docs diff): non-blocking.
  const notApproved = Object.entries(verdicts).filter(([, v]) => v !== 'APPROVED' && v !== 'DECLINED')
    .map(([r, v]) => `${r}: ${v ? v.toLowerCase() : 'no verdict line'}`);
  return { ok: missing.length === 0 && notApproved.length === 0, missing, notApproved, verdicts };
}

function evidenceOk(dir) {
  const ev = join(dir, 'evidence.md');
  return existsSync(ev) && readFileSync(ev, 'utf8').trim().length >= 20;
}

// ---------------------------------------------------------------- paths

// What a path is, relative to the active change.
export function classify(root, change, file) {
  const abs = isAbsolute(file) ? file : resolve(root, file);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) return { kind: 'outside' };
  const parts = rel.split(sep);
  if (parts[0] === '.claude') return { kind: 'exempt' };
  if (parts[0] !== 'openspec') return { kind: 'code' };
  // approval.md is main-session only wherever it sits: any change's folder, whatever the active change is.
  if (parts[1] === 'changes' && parts.length === 4 && parts[3] === 'approval.md') return { kind: 'gate', owner: '' };
  // An archived slice's ADR verdict file belongs to its reviewer, wherever the active change is (as approval.md above).
  const archivedVerdict = parts[1] === 'changes' && parts[2] === 'archive' && parts.length === 6 && parts[4] === 'reviews'
    ? /^([\w-]+)\.md$/.exec(parts[5]) : null;
  if (archivedVerdict) return { kind: 'gate', owner: archivedVerdict[1], archived: true };
  if (!change || parts[1] !== 'changes' || parts[2] !== change) return { kind: 'planning' };
  const inner = parts.slice(3).join('/');
  if (inner === 'readiness.md') return { kind: 'gate', owner: 'plan-readiness-reviewer' };
  if (inner === 'evidence.md') return { kind: 'gate', owner: 'pr-verifier' };
  if (inner === 'approval.md') return { kind: 'gate', owner: '' }; // the main session only
  const rv = inner.match(/^reviews\/(?:resolution\/)?([\w-]+)\.md$/); // reviews/resolution/<name>.md is <name>'s too (delivery-models D-8)
  if (rv) return { kind: 'gate', owner: rv[1] };
  if (inner.startsWith('reviews/')) return { kind: 'gate', owner: '(a reviewer, as reviews/<its-name>.md)' };
  return { kind: 'planning' };
}

// A decision record: a Markdown file in a folder named adr, adrs or decisions, in any letter case (design stage-roles D-6).
export function isDecisionRecord(rel) {
  const parts = rel.split(/[\\/]/);
  const name = parts.pop() ?? '';
  return /\.md$/i.test(name) && parts.some((d) => /^(adr|adrs|decisions)$/i.test(d));
}

// A test file: a folder named test, tests, __tests__, e2e, spec, specs, cypress or playwright, or a file name in a test form.
export function isTestFile(rel) {
  const parts = rel.split(/[\\/]/);
  const name = parts.pop() ?? '';
  return parts.some((d) => /^(tests?|__tests__|e2e|specs?|cypress|playwright)$/i.test(d)) || /^test_|_test\.[^.]+$|[._-](test|spec|e2e|cy)\.[^.]+$/i.test(name);
}

// Why `actor` may not write `file` now, or null.
function writeViolation(root, ch, actor, file) {
  const c = classify(root, ch.name, file);
  if (c.kind === 'outside' || c.kind === 'exempt') return null;
  const who = actor || 'the main session';
  if (c.kind === 'gate' && c.owner === '') {
    return actor === '' ? null
      : `approval.md is written only by the main session, from the owner's own message; not by ${who}`;
  }
  if (c.kind === 'gate') {
    return actor === c.owner ? null
      : `${relative(root, resolve(root, file))} is written only by the ${c.owner} agent, not by ${who}. Dispatch it with the Agent tool (subagent_type devkit-core:${c.owner}).`;
  }
  if (REVIEWERS.includes(actor) || actor === 'plan-readiness-reviewer' || actor === 'pr-verifier') {
    return `${who} only writes its own verdict file, not ${relative(root, resolve(root, file))}.`;
  }
  if (c.kind !== 'code') return null;
  const rel = relative(root, resolve(root, file));
  if (actor === 'adr-author') {
    return isDecisionRecord(rel) ? null : `adr-author writes only the project's decision records (a Markdown file in a folder named adr, adrs or decisions), not ${rel}.`;
  }
  const schema = changeSchema(root, ch.name);
  if (!changeDeclaresOrInstalled(root, changeDir(root, ch.name), 'readiness')) return null; // devkit-lite and friends; a hook never blocks on an unreadable pin (ADR 0011)
  const status = readValue(join(changeDir(root, ch.name), 'readiness.md'), 'Status');
  if (status !== 'APPROVED') {
    return `change "${ch.name}" has no approved readiness (Status: ${status || 'missing'}). Product code stays closed until the plan-readiness-reviewer agent writes "- Status: APPROVED" in openspec/changes/${ch.name}/readiness.md. Run: openspec status --change ${ch.name}`;
  }
  if (actor === 'e2e-tester') {
    return isTestFile(rel) ? null : `e2e-tester writes only test files, not ${rel}. Product code is written by the tdd-implementer agent.`;
  }
  if (actor !== 'tdd-implementer') {
    return `in schema ${schema}, product code is written by the tdd-implementer agent, one phase at a time. Dispatch it with the Agent tool (subagent_type devkit-core:tdd-implementer).`;
  }
  return null;
}

// ---------------------------------------------------------------- bash

// The command with heredoc bodies and quoted strings removed, so text being
// written to a file is not mistaken for a command.
export function sanitize(cmd) {
  let out = '';
  const lines = cmd.split('\n');
  for (let i = 0; i < lines.length; i++) {
    out += lines[i] + '\n';
    const hd = [...lines[i].matchAll(/<<-?\s*(['"]?)([\w.-]+)\1/g)].map((m) => m[2]);
    for (const tag of hd) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== tag) i++;
      i++; // the terminator line
    }
  }
  return out.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

// The command's segments (split on `&&`, `||`, `;` and newlines, quoted text
// and heredoc bodies removed) as { text, dir }, where `dir` is the directory the
// segment runs in: `cwd`, moved by any `cd <dir>` before it. `cd` segments
// themselves are not yielded. Without `cwd`, `dir` is undefined.
export function commandSegments(cmd, cwd) {
  const out = [];
  let dir = cwd;
  for (const seg of sanitize(cmd).split(/&&|\|\||[;\n]/)) {
    const text = seg.trim();
    const cdm = text.match(/^cd\s+([^\s|<>()]+)\s*$/);
    if (cdm) { if (dir) dir = resolve(dir, cdm[1].replace(/^~(?=\/|$)/, homedir())); continue; }
    if (text) out.push({ text, dir });
  }
  return out;
}

// Paths a command writes to (redirections, tee, sed -i, cp/mv/install/touch/
// truncate destinations), resolved against `cwd` and any `cd <dir>` earlier in
// the command. Returns absolute paths when `cwd` is given.
export function bashWrites(cmd, cwd) {
  const targets = [];
  for (const { text, dir } of commandSegments(cmd, cwd)) {
    const at = (t) => (dir ? resolve(dir, t) : t);
    for (const m of text.matchAll(/(?:^|[^<>&\d])\d?>>?\s*([^\s;&|<>()]+)/g)) targets.push(at(m[1]));
    for (const m of text.matchAll(/\btee\s+(?:-a\s+)?([^\s;&|<>()]+)/g)) targets.push(at(m[1]));
    const words = text.split(/\s+/).filter(Boolean);
    const c = words[0];
    const inPlace = (c === 'sed' || c === 'perl') && words.some((w) => /^-[a-zA-Z]*i/.test(w));
    if ((inPlace || ['cp', 'mv', 'install', 'touch', 'truncate'].includes(c)) && words.length > 1) {
      targets.push(at(words[words.length - 1]));
    }
  }
  // A target built from a variable or a quoted string can't be resolved from
  // the command text: skip it (CI is the backstop) rather than guess.
  return targets.filter((t) => {
    if (/[$`]|''|""/.test(t)) return false;
    const base = t.split('/').pop();
    return t && !t.startsWith('/dev/') && !/^['"]{2}$/.test(base) && !/^&\d$/.test(base) && !base.startsWith('-');
  });
}

const GIT_RULES = [
  [/\bgit\s+push\b[^\n;&|]*\s(--force(?!-with-lease)\b|-f\b)/, 'force push (use --force-with-lease on your own branch)'],
  [/\s--no-verify\b/, '--no-verify skips the project hooks'],
  [/\bgit\s+reset\s+[^\n;&|]*--hard\b/, 'git reset --hard discards work'],
  [/\bgit\s+clean\s+[^\n;&|]*-[a-z]*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+branch\s+[^\n;&|]*-D\b/, 'git branch -D deletes an unmerged branch'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discarding every change in the tree'],
  [/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/, 'stage files by name, not all at once'],
  [/\bgh\s+pr\s+merge\b[^\n;&|]*--admin\b/, 'gh pr merge --admin bypasses branch protection'],
];

export function gitViolation(cmd) {
  const s = sanitize(cmd);
  for (const [re, why] of GIT_RULES) if (re.test(s)) return why;
  return null;
}

// A git word that names the test branch: `src:dst` cut to `src`, a trailing `~n`, `^n` or `@{...}` cut, then the branch, its
// full ref or the same through one of the remotes (delivery-models D-6 rule 4).
function namesTestBranch(word, test, remotes) {
  const ref = word.split(':')[0].replace(/(?:~\d*|\^\d*|@\{[^}]*\})+$/, '');
  return ref === test || ref === `refs/heads/${test}` || remotes.some((r) => ref === `${r}/${test}` || ref === `refs/remotes/${r}/${test}`);
}

const gitOut = (dir, args) => {
  try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
};

// The task branch never receives the test branch (delivery-models D-6): `git merge`, `rebase` or `pull` that names the test
// branch, run on a branch that is neither the test branch nor a support branch (`<…>-<test>`), in a `two-prs` project. A
// reason, or null: anything the rule cannot read (a settings problem, no git, a quoted ref) is allowed.
export function testBranchViolation(cmd, cwd) {
  for (const { text, dir } of commandSegments(cmd, cwd)) {
    const m = /^(?:\w+=\S*\s+)*git\s+((?:-C\s+\S+\s+)*)(merge|rebase|pull)(?:\s+(.*))?$/.exec(text);
    if (!m) continue;
    let at = dir ?? process.cwd();
    for (const c of m[1].matchAll(/-C\s+(\S+)/g)) at = resolve(at, c[1].replace(/^~(?=\/|$)/, homedir()));
    const root = findRoot(at);
    if (!root || !optedIn(root)) continue;
    const { model, testBranch, problems } = readDeliverySettings(root);
    if (model !== 'two-prs' || problems.length) continue;
    const branch = gitOut(at, ['symbolic-ref', '--short', '-q', 'HEAD']);
    if (!branch || branch === testBranch || branch.endsWith(`-${testBranch}`)) continue;
    const remotes = gitOut(at, ['remote']).split('\n').filter(Boolean);
    const words = (m[3] ?? '').split(/\s+/).filter(Boolean);
    const bare = m[2] === 'pull' && !words.some((w) => !w.startsWith('-'));
    const named = bare
      ? remotes.some((r) => gitOut(at, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']) === `${r}/${testBranch}`)
      : words.some((w) => namesTestBranch(w, testBranch, remotes));
    if (named) return `the task branch never receives ${testBranch}: merge ${testBranch} into the support branch ${branch}-${testBranch} instead (the flow creates it when the pull request to ${testBranch} has a conflict)`;
  }
  return null;
}

function prViolation(root, ch) {
  if (ch.ambiguous) return `several active OpenSpec changes (${ch.ambiguous.join(', ')}); name the branch after the change before opening the PR.`;
  const dir = changeDir(root, ch.name);
  const rc = reviewConsensus(dir);
  if (!rc.ok) {
    const why = [rc.missing.length ? `missing ${rc.missing.join(', ')}` : '', ...rc.notApproved].filter(Boolean).join('; ');
    return `change "${ch.name}": review not approved (${why}). Run the review-change skill: each reviewer agent writes openspec/changes/${ch.name}/reviews/<reviewer>.md.`;
  }
  if (!evidenceOk(dir)) return `change "${ch.name}": evidence.md is missing or empty. Run the pr-verifier agent first.`;
  return null;
}

// ---------------------------------------------------------------- the run (D-2)

// The run a session is in, read from its transcript (`input.transcript_path`): { change, command, ended } when the newest
// slash command typed in the session is `/devkit change ...` (bare or plugin-scoped) and a tool result carrying a
// line `devkit-run: <id>` follows it (the newest such id is the run's change), else null. `ended` is the state of the
// newest of the `devkit-run:` and `devkit-end: <id> <state>` lines after that command when it is an end line (printed
// by the loop on an end, or by the session's own `reply` of an end key), else null: the run's last recorded action is
// an end until a later `devkit-run:` line. Only lines of type `user`
// count: a typed command has a string `message.content`, the printed line sits in a `tool_result` block (or its
// `toolUseResult.stdout`). The skill's own body (`isMeta`), the `api-request-*` lines and a sidechain are not read.
// The run and end marker lines of a text, in order: { run } for `devkit-run: <id>`, { end } for `devkit-end: <id> <state>`.
const runMarkers = (s) => [...String(s).matchAll(/^(?:devkit-run: ([A-Za-z0-9][\w.-]*)|devkit-end: [A-Za-z0-9][\w.-]* (archived|waiting-for-owner|waiting-on-github|blocked))[ \t]*\r?$/gm)]
  .map((m) => (m[1] ? { run: m[1] } : { end: m[2] }));

// Pure: it interprets the events of `transcriptEvents` (scanned when not given) and returns null when it cannot read them (the locks then let everything through).
export function runOf(input, events = transcriptEvents(input)) {
  if (!events) return null;
  let command = null;
  let change = null;
  let ended = null;
  for (const event of events) {
    if (event.typed) {
      command = isDevkitVerb(event.typed, 'change') ? event.typed : null;
      change = null;
      ended = null;
      continue;
    }
    if (!command) continue;
    for (const mark of marksOf(event, runMarkers)) {
      if (mark.run) { change = mark.run; ended = null; } else ended = mark.end;
    }
  }
  return command && change ? { change, command: `change ${command.args.replace(/^change\s*/, '')}`.trim(), ended } : null;
}

// The one scan of a transcript (`input.transcript_path`), shared by `runOf` and `roadmapRunOf`: the events of its `user` lines in
// order, null when the file cannot be read. An event is { typed: { name, args } } for a typed slash command (a string
// `message.content`) or { texts, stdout } for a line of tool results (the text of each `tool_result` block, and its
// `toolUseResult.stdout`). The skill's own body (`isMeta`), the `api-request-*` lines and a sidechain are not read.
//
// With `usage` true the scan also reads the model lines (change-budget D-3): the first line with a string `timestamp` gives
// `{ start }` first, every other event carries `at` (its line's timestamp or null), and an `assistant` line with a `message.usage`
// object gives `{ usage: { id, tokens, model }, at }` (sidechain lines included; `model` is the line's `message.model` when a string, else
// null: stage-models D-7). Without it the result is what it always was.
export function transcriptEvents(input, { usage = false } = {}) {
  const file = input && input.transcript_path;
  if (typeof file !== 'string' || !file) return null;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return null; }
  const events = [];
  const wanted = usage ? /"type"\s*:\s*"(user|assistant)"/ : /"type"\s*:\s*"user"/;
  let started = false;
  for (const line of text.split('\n')) {
    if (!wanted.test(line)) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const stamp = usage && typeof rec?.timestamp === 'string' ? rec.timestamp : null;
    if (usage && !started && stamp) { started = true; events.push({ start: stamp }); }
    const at = usage ? { at: stamp } : {};
    if (rec?.type === 'assistant') {
      if (usage && rec.message?.usage && typeof rec.message.usage === 'object') {
        const model = typeof rec.message.model === 'string' ? rec.message.model : null;
        events.push({ usage: { id: rec.message.id ?? null, tokens: tokensOf(rec.message.usage), model }, ...at });
      }
      continue;
    }
    if (rec?.type !== 'user' || rec.isMeta || rec.isSidechain) continue;
    const content = rec.message?.content;
    if (typeof content === 'string') {
      const typed = typedOf(content);
      if (typed) events.push({ typed, ...at });
    } else if (Array.isArray(content)) {
      events.push({
        texts: content.filter((block) => block?.type === 'tool_result').map(textOf),
        stdout: typeof rec.toolUseResult?.stdout === 'string' ? rec.toolUseResult.stdout : '',
        ...at,
      });
    }
  }
  return events;
}

// The tokens a usage object counts: input, output and cache-creation tokens, each a finite number of at least 0, else 0.
// `cache_read_input_tokens` is never read.
const tokensOf = (u) => ['input_tokens', 'output_tokens', 'cache_creation_input_tokens']
  .reduce((sum, key) => sum + (Number.isFinite(u[key]) && u[key] >= 0 ? u[key] : 0), 0);

// The family a model id names, `opus`, `sonnet` or `haiku` (any case), null for any other text and for a value that is no string
// (stage-models D-4).
export function familyOfId(id) {
  const found = typeof id === 'string' ? /opus|sonnet|haiku/i.exec(id) : null;
  return found ? found[0].toLowerCase() : null;
}

// The key of a stage hand-off: the text of its prompt from its start through the brief's last sentence (`change-loop.mjs#decide`'s
// inner `brief`), which cuts off what the session appends (the dispatch sentence, the attribution block) and the commit hand-off's
// own attribution ask. `[^.\n]+` and not letters and spaces: the files language may be a raw tag such as `zh-CN`. Null when the text
// holds no such sentence (stage-models D-4).
const BRIEF_END = /\. Write the change's files in [^.\n]+\./;
export function handOffKey(text) {
  const found = typeof text === 'string' ? BRIEF_END.exec(text) : null;
  return found ? text.slice(0, found.index + found[0].length) : null;
}

// A line that starts (after quoting marks) with `Outcome: failure`, the way a stage agent ends a run it could not finish.
const FAILURE_LINE = /^[ \t>*_`]*Outcome:[ \t*_`]*failure\b/m;

// One subagent file read in one pass (stage-models D-4): null when it cannot be read, else { start, prompt, family, failed, usage }.
// `start` is the first string timestamp, `prompt` the first user line's content (the text blocks of a list joined by a line break),
// `family` that of the newest assistant line's model, `failed` whether the newest assistant line that holds text has a failure line,
// and `usage` the `{ id, tokens, family }` of every assistant line with a usage object. A cut-off or broken line is skipped.
export function subagentRun(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return null; }
  const run = { start: null, prompt: null, family: null, failed: false, usage: [] };
  let seenUser = false;
  for (const line of text.split('\n')) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (rec === null || typeof rec !== 'object') continue;
    if (run.start === null && typeof rec.timestamp === 'string') run.start = rec.timestamp;
    const content = rec.message?.content;
    if (rec.type === 'user' && !seenUser) {
      seenUser = true;
      if (typeof content === 'string') run.prompt = content;
      else if (Array.isArray(content)) run.prompt = content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
    } else if (rec.type === 'assistant') {
      run.family = familyOfId(rec.message?.model);
      const blocks = Array.isArray(content) ? content.filter((b) => b?.type === 'text' && typeof b.text === 'string') : [];
      if (blocks.length) run.failed = FAILURE_LINE.test(blocks.map((b) => b.text).join('\n'));
      const usage = rec.message?.usage;
      if (usage && typeof usage === 'object') run.usage.push({ id: rec.message.id ?? null, tokens: tokensOf(usage), family: familyOfId(rec.message.model) });
    }
  }
  return run;
}

// The stage hand-offs of the session `transcript` names, in the order they started (then by file name): each `agent-*.jsonl` of its
// `subagents` folder as `subagentRun` reads it plus `key` (`handOffKey` of its prompt), those that started at or after `since` (all
// when `since` is null). A folder that cannot be listed gives [] (stage-models D-4).
export function handOffsOf(transcript, since) {
  let folder;
  let names;
  try {
    folder = join(dirname(transcript), basename(transcript, '.jsonl'), 'subagents');
    names = readdirSync(folder).filter((name) => /^agent-.*\.jsonl$/.test(name)).sort();
  } catch { return []; }
  const runs = [];
  for (const name of names) {
    const run = subagentRun(join(folder, name));
    if (run && (since === null || (typeof run.start === 'string' && run.start >= since))) runs.push({ ...run, key: handOffKey(run.prompt) });
  }
  return runs.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')); // stable: equal starts stay in file-name order
}

// The time of the newest typed `/devkit` command that is not `/devkit status`, null when there is none or the file cannot be read:
// the start of the window a retry is read in. A status check typed mid-run starts no window and erases no failure (stage-models D-4).
export function typedSince(transcript) {
  const events = transcriptEvents({ transcript_path: transcript }, { usage: true });
  if (!events) return null;
  let since = null;
  for (const event of events) {
    if (event.typed && /^(?:[\w-]+:)?devkit$/.test(event.typed.name) && !isDevkitVerb(event.typed, 'status')) since = event.at ?? null;
  }
  return since;
}

// The folder the host keeps its session folders in: `<config>/projects`, `<config>` being CLAUDE_CONFIG_DIR, else `~/.claude`.
const projectsDir = (env) => join(env?.CLAUDE_CONFIG_DIR || join(env?.HOME || homedir(), '.claude'), 'projects');

// The transcript of the session `env` names (CLAUDE_CODE_SESSION_ID): `<config>/projects/<folder>/<id>.jsonl`, null when the id is
// unsafe, no such file exists or a read throws. It reads no file content (change-budget D-2).
export function sessionTranscript(env) {
  const id = env?.CLAUDE_CODE_SESSION_ID;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][\w-]*$/.test(id)) return null;
  try {
    const projects = projectsDir(env);
    for (const folder of readdirSync(projects).sort()) {
      const file = join(projects, folder, `${id}.jsonl`);
      if (existsSync(file)) return file;
    }
  } catch { return null; }
  return null;
}

// The token budget a `budget:` value gives (change-budget D-1): null when absent or empty, { cap } for a whole number above
// zero that is a safe integer, else { invalid: raw }. Here and not in change-loop.mjs so that the stage readout, which change-loop.mjs
// imports, reads the cap without importing it (stage-models D-7).
export function budgetValue(raw) {
  if (raw === undefined || raw === '') return null;
  if (!/^\d+$/.test(raw)) return { invalid: raw };
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? { cap: n } : { invalid: raw };
}

// The run's spend in tokens (change-budget D-3): { spent, since } counted from the change's first `devkit-run:` line in the
// transcript and from the subagent transcripts of the session started after it; null when the transcript cannot be read.
export function spentOf(transcript, change) {
  const events = transcriptEvents({ transcript_path: transcript }, { usage: true });
  if (!events) return null;
  const first = events.findIndex((event) => event.texts && marksOf(event, runMarkers).some((mark) => mark.run === change));
  if (first < 0) return { spent: 0, since: null };
  const since = events[first].at;
  const seen = new Set();
  const sum = (list) => list.reduce((total, event) => {
    if (!event.usage) return total;
    if (event.usage.id !== null) {
      if (seen.has(event.usage.id)) return total;
      seen.add(event.usage.id);
    }
    return total + event.usage.tokens;
  }, 0);
  let spent = sum(events.slice(first + 1));
  const folder = join(dirname(transcript), basename(transcript, '.jsonl'), 'subagents');
  let files = [];
  try { files = readdirSync(folder).filter((name) => /^agent-.*\.jsonl$/.test(name)).sort(); } catch { files = []; }
  for (const name of files) {
    const scan = transcriptEvents({ transcript_path: join(folder, name) }, { usage: true });
    const start = scan?.[0]?.start;
    if (typeof since === 'string' && typeof start === 'string' && start >= since) spent += sum(scan);
  }
  return { spent, since };
}

// ---------------------------------------------------------------- the spend readout (stage-models D-7)

// The stage a hand-off's brief names: `Change <id> (<script>), stage <stage>:` (the loop's brief, `change-loop.mjs#decide`'s inner `brief`).
export const STAGE_OF = /^Change \S+ \([^)]*\), stage ([\w-]+):/;

// The families a spend line lists, in the order of the model values (cheapest first), `other` for a model id that names none.
const FAMILY_ORDER = ['haiku', 'sonnet', 'opus', 'other'];

// The text after the first `{` of a text, parsed: the action JSON the loop prints after its marker lines; null when it is not JSON.
function jsonAfterMarkers(text) {
  const from = text.indexOf('{');
  if (from < 0) return null;
  try { return JSON.parse(text.slice(from)); } catch { return null; }
}

// Where a change's tokens went (stage-models D-7): reads each transcript of `transcripts` (deduplicated) and the subagent files of its
// session, and returns { change, stages: [{ stage, models: { <family>: tokens } }] in first-seen order, retries: [{ stage, from, to, tokens }], total }.
// A session message counts in the stage of the change's newest `next` before it (the `devkit-run:` line and the JSON after it); a
// subagent counts in the stage its brief names; each message id counts once per transcript, as the budget counts. A transcript that
// cannot be read adds nothing and a cut-off line is skipped. A retry is a hand-off whose brief the hand-off before it of that brief
// failed.
export function spendOf(transcripts, change) {
  const stages = [];
  const retries = [];
  let total = 0;
  const add = (stage, family, tokens) => {
    let entry = stages.find((e) => e.stage === stage);
    if (!entry) { entry = { stage, models: {} }; stages.push(entry); }
    entry.models[family] = (entry.models[family] ?? 0) + tokens;
    total += tokens;
  };
  for (const transcript of new Set(transcripts)) {
    const events = transcriptEvents({ transcript_path: transcript }, { usage: true });
    if (!events) continue;
    const seen = new Set();
    const once = (usage) => {
      if (usage.id === null) return true;
      if (seen.has(usage.id)) return false;
      seen.add(usage.id);
      return true;
    };
    let current = null;
    let stage = null;
    for (const event of events) {
      if (event.texts) {
        const text = [...event.texts, event.stdout].find((t) => runMarkers(t).some((mark) => mark.run));
        const run = text === undefined ? undefined : runMarkers(text).filter((mark) => mark.run).at(-1)?.run;
        if (run !== undefined) {
          current = run;
          const stated = run === change ? jsonAfterMarkers(text)?.stage : null;
          stage = typeof stated === 'string' ? stated : null;
        }
      } else if (event.usage && current === change && once(event.usage)) {
        add(stage, familyOfId(event.usage.model) ?? 'other', event.usage.tokens);
      }
    }
    const lastOfKey = new Map();
    for (const record of handOffsOf(transcript, null)) {
      if (typeof record.prompt !== 'string' || !record.prompt.startsWith(`Change ${change} (`)) continue;
      const handed = STAGE_OF.exec(record.prompt)?.[1] ?? null;
      let tokens = 0;
      for (const usage of record.usage) {
        if (!once(usage)) continue;
        add(handed, usage.family ?? 'other', usage.tokens);
        tokens += usage.tokens;
      }
      const before = record.key === null ? undefined : lastOfKey.get(record.key);
      if (before?.failed) retries.push({ stage: handed, from: before.family ?? 'other', to: record.family ?? 'other', tokens });
      if (record.key !== null) lastOfKey.set(record.key, record);
    }
  }
  return { change, stages, retries, total };
}

// The transcripts a change's spend is read from (stage-models D-7): the calling session's, and every `*.jsonl` directly in the folder the
// host keeps for the change's checkout `root`, each once. The main checkout's folder is not read by a worktree's readout.
export function spendSources(env, root) {
  const found = new Set();
  const own = sessionTranscript(env);
  if (own) found.add(own);
  try {
    const folder = join(projectsDir(env), String(root).replace(/[^A-Za-z0-9]/g, '-'));
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) found.add(join(folder, entry.name));
    }
  } catch { /* the host kept no folder for this checkout */ }
  return [...found];
}

// The rows of the spend block, in both languages (stage-models D-8). `{title}` is the stage's plain title, never `{stage}`.
export const SPEND_MESSAGES = {
  en: {
    'spend-head': 'Spend of {id}, in tokens:',
    'spend-stage': 'Stage {title}: {models}',
    'spend-stage-none': 'Outside a stage: {models}',
    'spend-retry': 'Stage {title}, a retry from {from} to {to}: {tokens}',
    'spend-total': 'Total: {tokens} tokens of the budget {cap}',
    'spend-total-none': 'Total: {tokens} tokens; no budget is set',
  },
  'pt-BR': {
    'spend-head': 'Gasto de {id}, em tokens:',
    'spend-stage': 'Etapa {title}: {models}',
    'spend-stage-none': 'Fora de uma etapa: {models}',
    'spend-retry': 'Etapa {title}, uma repetição de {from} para {to}: {tokens}',
    'spend-total': 'Total: {tokens} tokens do orçamento {cap}',
    'spend-total-none': 'Total: {tokens} tokens; nenhum orçamento definido',
  },
};

// The lines of a change's spend block (stage-models D-7): none when no token was counted; else the head, one line per stage, one per
// retry and the total against `cap` (a number) or without one. `titleOf` gives a stage's title in the person's language.
export function spendLines(lang, spend, { cap, titleOf }) {
  if (!spend.total) return [];
  const rows = SPEND_MESSAGES[lang === 'en' ? 'en' : 'pt-BR'];
  // `change-loop.mjs#render` cannot be called from here (it imports this file): the rows use only plain parameters, which it fills the same way.
  const fill = (key, params) => rows[key].replace(/\{(\w+)\}/g, (_, name) => {
    if (params[name] === undefined || params[name] === null) throw new TypeError(`spend row ${key} needs the parameter ${name}`);
    return String(params[name]);
  });
  const modelsText = (models) => FAMILY_ORDER.filter((family) => family in models).map((family) => `${family} ${models[family]}`).join(', ');
  return [
    fill('spend-head', { id: spend.change }),
    ...spend.stages.map((entry) => (entry.stage === null
      ? fill('spend-stage-none', { models: modelsText(entry.models) })
      : fill('spend-stage', { title: titleOf(entry.stage), models: modelsText(entry.models) }))),
    ...spend.retries.map((retry) => fill('spend-retry', { title: titleOf(retry.stage), from: retry.from, to: retry.to, tokens: retry.tokens })),
    cap ? fill('spend-total', { tokens: spend.total, cap }) : fill('spend-total-none', { tokens: spend.total }),
  ];
}

// The marker lines of a tool-result event, read with `markers`: those in the `tool_result` blocks, else those in the stdout.
function marksOf(event, markers) {
  const found = event.texts.flatMap((text) => markers(text));
  return found.length ? found : markers(event.stdout);
}

// The first line of the first message of a session another session started, in the desktop app's form: this line, a background
// paragraph, a line `Task:` and the task (roadmap-coordinator-followups D-4, ADR 0014). The app may put notes of its own before it, each a
// `<system-reminder>` block (its list of linked sessions: roadmap-sessions-upfront D-1, review round 1 test-coverage F4); `startedTaskOf` skips them.
export const STARTED_BY_SESSION = 'Background (from the session that started this one):';

const NOTE_OPEN = '<system-reminder>';
const NOTE_CLOSE = '</system-reminder>';

// `lines` without the host's notes that lead the message: while the first non-blank line, trimmed, is `<system-reminder>`, the lines up to and including the
// next line that, trimmed, is `</system-reminder>` are dropped, then the blank lines after them. null when a note is never closed; the lines as they are
// when none leads.
function withoutLeadingNotes(lines) {
  let rest = lines;
  let dropped = false;
  for (;;) {
    const first = rest.findIndex((line) => line.trim() !== '');
    if (first < 0 || rest[first].trim() !== NOTE_OPEN) return dropped ? rest.slice(Math.max(first, 0)) : rest;
    const close = rest.findIndex((line, at) => at > first && line.trim() === NOTE_CLOSE);
    if (close < 0) return null;
    rest = rest.slice(close + 1);
    dropped = true;
  }
}

// A slash command on one line: { name, args } when the line starts with `/`, else null.
function commandOfLine(line) {
  const found = /^\s*\/([A-Za-z][\w:-]*)(?:[ \t]+([^\n]*))?$/m.exec(line);
  return found ? { name: found[1], args: (found[2] ?? '').trim() } : null;
}

// The lines after the `Task:` line of a message in the started form (`STARTED_BY_SESSION` first line, after the host's leading notes), else null: the one
// reader of that form (roadmap-sessions-upfront D-1). A session's task may be followed by lines of its own, such as the run's `devkit-start:` line.
export function startedTaskOf(content) {
  const lines = withoutLeadingNotes(String(content).split('\n'));
  if (lines === null || lines[0]?.trim() !== STARTED_BY_SESSION) return null;
  const task = lines.findIndex((line) => line.trim() === 'Task:');
  return task < 0 ? null : lines.slice(task + 1);
}

// The line a roadmap run writes below the task of a change session it starts: the change id and the run's ticket for it.
export const START_LINE = /^devkit-start: ([A-Za-z0-9][\w.-]*) ([0-9a-f]{16})[ \t]*\r?$/;

// The string `message.content` of the first `user` line of the transcript that is neither `isMeta` nor a sidechain; null when that line's
// content is no string, when there is no such line or no transcript path. A transcript that cannot be read throws (the entry fails closed).
export function firstMessageOf(input) {
  const file = input && input.transcript_path;
  if (typeof file !== 'string' || !file) return null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!/"type"\s*:\s*"user"/.test(line)) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (rec?.type !== 'user' || rec.isMeta || rec.isSidechain) continue;
    return typeof rec.message?.content === 'string' ? rec.message.content : null;
  }
  return null;
}

// The slash command typed in a `user` line of the transcript: { name, args } from the `<command-name>` tag, else, in the form of a session another session
// started (after the host's leading notes), from the first non-blank line after `Task:`, else from the message's first line, which must start with `/`;
// null when the line is no typed command. A command on a later line of any other message is no command.
function typedOf(content) {
  const tag = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/.exec(content);
  if (tag) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(content)?.[1] ?? '';
    return { name: tag[1], args: args.trim() };
  }
  const task = startedTaskOf(content);
  const line = task === null ? content.split('\n')[0] : task.find((l) => l.trim() !== '');
  return line === undefined ? null : commandOfLine(line);
}

// The text of a tool result block (a string, or a list of text blocks).
const textOf = (block) => (typeof block.content === 'string' ? block.content
  : Array.isArray(block.content) ? block.content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join('\n') : '');

// True when the typed command is `/devkit <verb> ...`, bare or plugin-scoped.
const isDevkitVerb = (typed, verb) => /^(?:[\w-]+:)?devkit$/.test(typed.name) && new RegExp(`^${verb}(?:\\s|$)`).test(typed.args);

// The roadmap run a session is in, read from the transcript's events like `runOf` (design roadmap-coordinator D-11): { command, stopping }
// when the newest typed slash command is `/devkit roadmap ...` (bare or plugin-scoped) and a tool result carrying a line
// `devkit-roadmap: <n>` or `devkit-roadmap: stop` follows it; `stopping` is whether the newest such line says stop. A typed
// `/devkit status` or `/devkit train` neither starts nor ends a run; any other typed slash command ends it. Pure: null when it cannot read the file.
export function roadmapRunOf(input, events = transcriptEvents(input)) {
  if (!events) return null;
  const markers = (s) => [...String(s).matchAll(/^devkit-roadmap: (\d{1,2}|stop)[ \t]*\r?$/gm)].map((m) => m[1]);
  let command = null;
  let stopping = null;
  for (const event of events) {
    if (event.typed) {
      if (!isDevkitVerb(event.typed, 'status') && !isDevkitVerb(event.typed, 'train')) {
        command = isDevkitVerb(event.typed, 'roadmap') ? event.typed : null;
        stopping = null;
      }
      continue;
    }
    if (!command) continue;
    for (const word of marksOf(event, markers)) stopping = word === 'stop';
  }
  return command && stopping !== null ? { command: `roadmap ${command.args.replace(/^roadmap\s*/, '')}`.trim(), stopping } : null;
}

const runCodeReason = (kind) => `in a /devkit ${kind} run this session writes no product code; the implementation is handed to tdd-implementer by the loop`;

// The main session (no agent_type) in a run: 'change', 'roadmap' or null. Fails open: an unreadable record is no run.
function mainInRun(input) {
  if (role(input) || typeof input.transcript_path !== 'string') return null;
  try {
    const events = transcriptEvents(input); // one read for both answers
    if (runOf(input, events) !== null) return 'change';
    if (roadmapRunOf(input, events) !== null) return 'roadmap';
  } catch { /* an unreadable record is no run */ }
  return null;
}

// ---------------------------------------------------------------- modes

function guardEdit(input) {
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || ti.path;
  if (!file) return;
  // The root comes from the file, not the session: a file in a linked worktree
  // is gated by that worktree's change, and by that root's own opt-in.
  const root = findRoot(dirname(resolve(input.cwd || process.cwd(), file)));
  if (!root || !optedIn(root)) return;
  if (classify(root, null, file).kind === 'code') {
    const run = mainInRun(input);
    if (run) block(runCodeReason(run));
  }
  if (classify(root, null, file).archived) {
    const why = writeViolation(root, { name: null }, role(input), file);
    if (why) block(why);
  }
  const ch = resolveChange(root);
  if (!ch) return;
  if (ch.ambiguous) {
    const c = classify(root, null, file);
    if (c.kind === 'code') block(`several active OpenSpec changes (${ch.ambiguous.join(', ')}). Name the branch after the change you are implementing, or start Claude Code with DEVKIT_CHANGE=<name>.`);
    const why = c.kind === 'gate' && c.owner === '' ? writeViolation(root, { name: null }, role(input), file) : null;
    if (why) block(why);
    return;
  }
  const why = writeViolation(root, ch, role(input), file);
  if (why) block(why);
}

function guardBash(input) {
  const cmd = (input.tool_input || {}).command || '';
  // The git rules follow the session's project; writes and PRs follow their own target root.
  const sessionRoot = findRoot(input.cwd);
  const why = sessionRoot && optedIn(sessionRoot) ? gitViolation(cmd) ?? testBranchViolation(cmd, input.cwd) : null;
  if (why) block(`blocked: ${why}. If you really need it, ask the user to run it.`);
  const cwd = input.cwd || process.cwd();
  // Each root's change is resolved once; a target or a segment is judged by its own root.
  const changes = new Map();
  const changeAt = (root) => {
    if (!changes.has(root)) changes.set(root, resolveChange(root));
    return changes.get(root);
  };
  let inRun; // the run's command, asked once, and only when a write targets product code
  for (const t of bashWrites(cmd, cwd)) {
    const root = findRoot(dirname(t));
    if (root && optedIn(root) && classify(root, null, t).kind === 'code') {
      inRun ??= mainInRun(input) ?? '';
      if (inRun) block(`${runCodeReason(inRun)}. (Writing it through the shell is gated the same way.)`);
    }
    if (root && optedIn(root) && classify(root, null, t).archived) {
      const a = writeViolation(root, { name: null }, role(input), t);
      if (a) block(`${a} (Writing it through the shell is gated the same way.)`);
    }
    const ch = root && optedIn(root) && changeAt(root);
    if (!ch) continue;
    if (ch.ambiguous) {
      // Only the approval record is judged without a single active change.
      const c = classify(root, null, t);
      const a = c.kind === 'gate' && c.owner === '' ? writeViolation(root, { name: null }, role(input), t) : null;
      if (a) block(`${a} (Writing it through the shell is gated the same way.)`);
      continue;
    }
    const v = writeViolation(root, ch, role(input), t);
    if (v) block(`${v} (Writing it through the shell is gated the same way.)`);
  }
  for (const { text, dir } of commandSegments(cmd, cwd)) {
    if (!/\bgh\s+pr\s+create\b/.test(text)) continue;
    // A `cd` into a folder with no project does not leave the session's: fall back to its root.
    const root = findRoot(dir) ?? sessionRoot;
    // A slice's pull request is judged by the slice contract alone, whatever other change is active (design D-11).
    const slice = root && optedIn(root) ? archivedSliceOf(root, process.env.DEVKIT_BRANCH || process.env.GITHUB_HEAD_REF || gitBranch(root)) : null;
    if (slice) {
      const base = defaultRef(root);
      const problems = base ? sliceProblems(root, slice.folder, { base }) : ['no origin/<default branch> to compare the slice with'];
      if (problems.length) block(`slice ${slice.id} does not meet the slice contract: ${problems.join('; ')}`);
      continue;
    }
    const ch = root && optedIn(root) && changeAt(root);
    if (!ch) continue;
    const v = prViolation(root, ch);
    if (v) block(v);
  }
}

// ---------------------------------------------------------------- the stop and hand-off locks (D-8)

const LOCKS = { stop: 'stopDecision', 'subagent-stop': 'subagentStopDecision', agent: 'agentDecision' };
const ROADMAP_LOCKS = { stop: 'roadmapStopDecision', 'subagent-stop': 'roadmapSubagentStopDecision', agent: 'roadmapAgentDecision' };

// With DEVKIT_HOOK_LOG naming a file, every decision is appended to it as one JSON line; a log that cannot be written never blocks anything.
function logDecision(mode, input, d) {
  const file = process.env.DEVKIT_HOOK_LOG;
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify({
      at: new Date().toISOString(), mode, session: input.session_id ?? null,
      agentType: input.agent_type ?? input.tool_input?.subagent_type ?? null, change: d.change ?? null,
      decision: d.decision, why: d.why,
    })}\n`);
  } catch { /* a log that cannot be written never blocks anything */ }
}

// The entry skill of a change session a roadmap run started (roadmap-sessions-upfront D-1), and whether the input of a Skill call names it: some string value
// of `tool_input` is that name or ends in `:devkit-session`. The host's field name for the skill is not documented, so any string field counts.
export const ENTRY_SKILL = 'devkit-session';
export function namesEntrySkill(toolInput) {
  return Object.values(toolInput ?? {}).some((v) => typeof v === 'string' && (v === ENTRY_SKILL || v.endsWith(`:${ENTRY_SKILL}`)));
}

// `skill`: PreToolUse on the Skill tool. The entry skill of a change session a roadmap run started runs only on the run's ticket
// (`entryDecision` of roadmap-loop.mjs); every other skill is let through. The raw input is tested first, with no import, so a roadmap-loop.mjs that cannot
// load never refuses another skill (review round 1, code-quality F2); a call of the entry skill fails closed on any error, the import included: the owner's
// typed `/devkit change` still runs the change. It does not depend on the project's opt-in.
async function skillEntry(input) {
  let d;
  if (!namesEntrySkill(input?.tool_input)) d = { decision: 'allow', why: 'not-entry' };
  else {
    try {
      const loop = await import('./roadmap-loop.mjs');
      d = loop.entryDecision(input, { env: process.env });
    } catch { d = { decision: 'refuse', why: 'unreadable', reason: 'the entry could not be checked; the owner can run this change by typing /devkit change <id> in this session' }; }
  }
  logDecision('skill', input, d);
  if (d.decision === 'refuse') block(d.reason);
}

// `stop`, `subagent-stop` and `agent`: the decision is roadmap-loop.mjs's in a `/devkit roadmap` run (`roadmapRunOf`), else
// change-loop.mjs's, which gets the scanned `events` and does not read the transcript again (each imported dynamically, as `ci` imports deliver-check.mjs), refusing with exit 2 and the reason on stderr.
// Any error of the lock lets the action through; each decision is logged as `logDecision` says.
async function lock(mode, input) {
  const root = findRoot(input.cwd);
  if (!root || !optedIn(root)) return;
  let d;
  try {
    const events = transcriptEvents(input); // the one read of the transcript in this hook call
    const run = roadmapRunOf(input, events);
    if (run) {
      const loop = await import('./roadmap-loop.mjs');
      d = loop[ROADMAP_LOCKS[mode]](input, { env: process.env, run });
    } else if (mode === 'stop') { // a change session a roadmap run started may stop while it waits; any other is the change loop's (roadmap-sessions-upfront D-6)
      const loop = await import('./roadmap-loop.mjs');
      d = loop.changeSessionStopDecision(input, { env: process.env, events });
    } else {
      const loop = await import('./change-loop.mjs');
      d = loop[LOCKS[mode]](input, { env: process.env, events });
    }
  } catch { d = { decision: 'allow', why: 'error' }; }
  logDecision(mode, input, d);
  if (d.decision === 'refuse') block(d.reason);
}

// ---------------------------------------------------------------- roadmap

// openspec/roadmap.md groups changes into rounds ("## " headings) of checklist
// lines ("- [ ] <change-id> (after: a, b)"). It is read for the session report
// only: it never gates anything and this file never writes it. Lines it does
// not recognise are skipped. Returns [{ title, items: [{ id, done, after }] }]
// or null when there is no roadmap.
export function readRoadmap(root) {
  const file = join(root, 'openspec', 'roadmap.md');
  if (!existsSync(file)) return null;
  return parseRoadmap(readFileSync(file, 'utf8'));
}

// The form of a change id on the roadmap and in the loop's brief: a letter or a digit, then letters, digits, `_`, `.` or `-`.
export const isChangeId = (id) => typeof id === 'string' && /^[A-Za-z0-9][\w.-]*$/.test(id);

// The same parse over roadmap text (conduct-check reads origin/<base>:openspec/roadmap.md).
export function parseRoadmap(text) {
  const rounds = [];
  let item = null;
  const notes = [];
  const close = () => { if (item) item.notes = notes.join('\n').trim(); item = null; notes.length = 0; };
  for (const line of String(text).split(/\r?\n/)) {
    const h = line.match(/^##\s+(\S.*?)\s*$/);
    if (h) { close(); rounds.push({ title: h[1], items: [] }); continue; }
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+([A-Za-z0-9][\w.-]*)(?:\s+\(after:\s*([^)]*)\))?(.*)$/);
    if (m && rounds.length > 0) {
      close();
      const after = (m[3] || '').split(',').map((d) => d.trim()).filter((d) => /^[A-Za-z0-9][\w.-]*$/.test(d));
      item = { id: m[2], done: m[1] !== ' ', after, text: m[4].replace(/^\s*[—:-]?\s*/, '').trim(), notes: '' };
      rounds[rounds.length - 1].items.push(item);
      continue;
    }
    if (item && /^( {2,}|\t)\S/.test(line)) notes.push(line.replace(/^ {2}/, '').replace(/\s+$/, ''));
    else if (item && line.trim() !== '') close();
  }
  close();
  return rounds;
}

function roadmapReport(root) {
  const rounds = readRoadmap(root);
  if (!rounds) return '';
  const all = rounds.flatMap((r) => r.items);
  if (all.length === 0) return '';
  const done = new Set(all.filter((i) => i.done).map((i) => i.id));
  const current = rounds.find((r) => r.items.some((i) => !i.done));
  if (!current) return '[devkit] Roadmap: all rounds done.\n';
  const open = new Set(activeChanges(root));
  const archiveDir = join(root, 'openspec', 'changes', 'archive');
  // `openspec archive` moves a change to archive/YYYY-MM-DD-<id>.
  const archived = new Set((existsSync(archiveDir) ? readdirSync(archiveDir) : [])
    .map((a) => a.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)?.[1]).filter(Boolean));
  const state = (i) => {
    if (!open.has(i.id) && archived.has(i.id)) return 'archived, tick it';
    const waiting = i.after.filter((d) => !done.has(d));
    if (waiting.length) return `waiting on ${waiting.join(', ')}`;
    return open.has(i.id) ? 'open' : 'not started';
  };
  const n = current.items.filter((i) => i.done).length;
  return `[devkit] Roadmap: ${current.title} (${n}/${current.items.length} done). Pending:\n`
    + current.items.filter((i) => !i.done).map((i) => `  - ${i.id}: ${state(i)}\n`).join('')
    + 'openspec/roadmap.md only reports; it gates nothing. Tick a change there once it is archived.\n';
}

// ---------------------------------------------------------------- the project's OpenSpec CLI (design D-1)

const OPENSPEC_PACKAGE = '@fission-ai/openspec';
const PIN_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

// The main checkout of a worktree: the parent of git's common dir. Null outside a git checkout.
export function mainCheckout(root) {
  try {
    const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return common ? dirname(common) : null;
  } catch { return null; }
}

// The range of @fission-ai/openspec a package.json declares, or null (also when the file is unreadable).
function declaredPin(packageJson) {
  try {
    const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
    for (const section of PIN_SECTIONS) {
      const range = pkg?.[section]?.[OPENSPEC_PACKAGE];
      if (typeof range === 'string') return range;
    }
  } catch { /* no file, or not JSON: no pin declared there */ }
  return null;
}

// Which OpenSpec CLI the packs start for the checkout `root`: the project's installed one when there is one,
// the one on PATH when the project pins none, an { error } when it declares a pin that is not installed.
export function openspecCli(root) {
  const main = mainCheckout(root);
  const roots = main && main !== root ? [root, main] : [root];
  for (const r of roots) {
    const bin = join(r, 'node_modules', '.bin', 'openspec');
    if (existsSync(bin)) return { bin, where: bin, pinned: true };
  }
  for (const r of roots) {
    const file = join(r, 'package.json');
    const range = declaredPin(file);
    if (range !== null) {
      return { error: `the project pins ${OPENSPEC_PACKAGE} ${range} in ${file} but it is not installed; run the project install (npm install, or its package manager) and run again` };
    }
  }
  return { bin: 'openspec', where: 'PATH', pinned: false };
}

// Null when `versionText` is an OpenSpec 2.x, else the message that refuses it.
export function openspecRefusal(cli, versionText) {
  const version = /\d+\.\d+\.\d+\S*/.exec(versionText ?? '')?.[0];
  if (version?.split('.')[0] === '2') return null;
  if (cli.pinned) {
    return `openspec ${version ?? 'with no readable version'} at ${cli.where} is not supported: devkit needs OpenSpec 2.x; move the project's pin to 2.x (npm i -D ${OPENSPEC_PACKAGE}@2)`;
  }
  if (!version) return `cannot read the openspec version from "${String(versionText ?? '').trim().slice(0, 60)}"`;
  return `openspec ${version} is not supported: flow-check reads OpenSpec 2.x`;
}

// The one line the session prints over a CLI it cannot use, or null when the CLI is usable (a PATH one is not checked).
function cliRefusalLine(root, cli) {
  if (cli.error) return cli.error;
  if (!cli.pinned) return null;
  let text = '';
  try {
    text = execFileSync(cli.bin, ['--version'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
  } catch { /* an unreadable version is refused below */ }
  return openspecRefusal(cli, text);
}

function session(input) {
  const root = findRoot(input.cwd);
  if (!root || !optedIn(root)) return;
  sessionChange(root);
  let report = '';
  try { report = roadmapReport(root); } catch { /* a broken roadmap never breaks the hook */ }
  process.stdout.write(report);
}

function sessionChange(root) {
  const ch = resolveChange(root);
  if (!ch) return;
  if (ch.ambiguous) {
    process.stdout.write(`[devkit] Open OpenSpec changes: ${ch.ambiguous.join(', ')}. Ask which one to work on; the branch name (or DEVKIT_CHANGE) selects it for the guards.\n`);
    return;
  }
  const cli = openspecCli(root);
  const refusal = cliRefusalLine(root, cli);
  if (refusal) {
    process.stdout.write(`[devkit] ${refusal}\n`);
    return;
  }
  let status = '';
  try {
    status = execFileSync(cli.bin, ['status', '--change', ch.name],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
  } catch { /* openspec not installed: still point at the change */ }
  process.stdout.write(`[devkit] Active OpenSpec change: ${ch.name} (schema ${changeSchema(root, ch.name)}).\n${status}`
    + `Follow the schema: \`/devkit change\` runs a change from your request to its archive (\`ship-change\` still finishes a change begun under the previous script), and \`flow-check\` is the read-only readout of the stages (\`node ${dirname(fileURLToPath(import.meta.url))}/flow-check.mjs ${ch.name}\` says which passed and which is next); \`openspec instructions <artifact> --change <name>\` says how each stage is written. `
    + 'A stage\'s instruction names its role; in Claude Code a role is the devkit-core agent of the same name, dispatched with the Agent tool (`owner` is you asking the owner, `change-coordinator` is this session, `review-bench` is the review-change skill). '
    + 'Gate files have one writer each (readiness.md: plan-readiness-reviewer; reviews/<reviewer>.md: that reviewer; evidence.md: pr-verifier); '
    + 'in the devkit schema, product code is written by tdd-implementer after readiness is APPROVED. Dispatch those agents with the Agent tool.\n');
}

// The devkit-reviews check (deliver-check --ci): readiness, then contract items
// 1-4 with the staleness rule. Imported dynamically so this file keeps no static
// import of deliver-check.mjs, which imports it. Without deliver-check.mjs and
// merge-setup.mjs (which deliver-check.mjs imports) in the same folder it fails closed.
async function ci() {
  let ciMain;
  try {
    ({ ciMain } = await import('./deliver-check.mjs'));
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    console.error('devkit ci: guard.mjs ci needs deliver-check.mjs and merge-setup.mjs in the same folder (download all three; see docs/openspec-flow.md#ci)');
    process.exitCode = 1;
    return;
  }
  const r = ciMain(process.argv.slice(3));
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.code;
}

// Run a mode only when executed directly, so other scripts can import the
// helpers above without inheriting the dispatch (or DEVKIT_BYPASS's exit 0).
// Symlinked paths (plugin caches) are resolved before comparing.
function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  // Not awaited at the top level: deliver-check.mjs imports this file, and a
  // top-level await here would wait on an import that waits on this module.
  if (mode === 'ci') ci().then(() => process.exit(process.exitCode || 0));
  else if (process.env.DEVKIT_BYPASS === '1') process.exit(0);
  else if (mode === 'edit') guardEdit(readStdin());
  else if (mode === 'bash') guardBash(readStdin());
  else if (mode === 'session') session(readStdin());
  else if (mode === 'skill') skillEntry(readStdin());
  else if (Object.hasOwn(LOCKS, mode)) lock(mode, readStdin());
}
