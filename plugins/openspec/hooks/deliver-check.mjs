// deliver-check: is a change a ready PR? (ship-modes, design D2 and D4)
//
// Reads files and git; never writes, pushes, posts or fetches. No dependencies.
// Imports its helpers from guard.mjs, which runs a mode only when executed
// directly, so importing it here has no side effects.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mergeSetup, readRepoSettings, requiredChecks, makeGh, ghError, ghVersion, GH_MIN_VERSION, GH_TIMEOUT_MS, DEVKIT_REVIEWS_CHECK } from './merge-setup.mjs';

// The shared gh runner (merge-setup.mjs), kept importable from here.
export { makeGh };
// The `Commit:` line reader moved to guard.mjs, which the slice contract reads it from; still importable from here.
export { parseCommitLine };
import { archiveBranchChange, mainCheckout, parseDevkitBlock, deliverySettings, trainSetting, releaseTagSetting, changeDir, parseCommitLine, parseStageHeader, sliceProblems, changeSchema, changeSchemaAt, DEVKIT_SCHEMAS, findRoot, readValue, valueIn, resolveChange, changeDeclares, REQUIRED_REVIEWERS } from './guard.mjs';

// ---------------------------------------------------------------- ship config

export const SHIP_MODES = ['plan', 'pr', 'merge'];
export const MERGE_METHOD_VALUES = ['squash', 'merge', 'rebase'];
const CONFIG = 'openspec/config.yaml';
// The folders that hold a project's decision records, and the lines of a change's decisions.md that list them (moved here from conduct-check.mjs
// and change-loop.mjs, release-at-merge D-2).
export const ADR_DIRS = ['docs/adr', 'docs/decisions'];
export const ADR_LINES = /^[ \t]*(?:[-*][ \t]+)?ADR:[ \t]*`([^`\n]+)`/gm;
// The files that hold an ADR citation (`ADR [<slug>]`, `<slug>.md` and their numbered forms; release-at-merge D-18): every tracked text file
// outside openspec/changes/ but test files and fixtures (a name matching `*.test.*` or `*-fixtures.*`, a file under a folder named test or
// tests), whose literals are test data and name no record. CITATION_PATHSPEC is read with `git grep -I`, which skips binary files; a caller
// that reads a file's text through holdsCitations skips a text holding a NUL byte the same way. The scan (citationsOf), the "still cited"
// check (citedAt), the rewrite of the step and the join, their give-back and the ADR part of maskRelease all read this one rule.
export const CITATION_PATHSPEC = ['.', ':(exclude)openspec/changes', ':(exclude,glob)**/*.test.*', ':(exclude,glob)**/*-fixtures.*', ':(exclude,glob)**/test/**', ':(exclude,glob)**/tests/**'];
export function holdsCitations(path) {
  if (path.startsWith('openspec/changes/')) return false;
  const folders = path.split('/');
  const name = folders.pop();
  return !name.includes('.test.') && !name.includes('-fixtures.') && !folders.some((f) => f === 'test' || f === 'tests');
}
const holdsCitationText = (path, text) => holdsCitations(path) && !text.includes('\0');

export class ShipConfigError extends Error {
  constructor(message) {
    super(`${CONFIG}: ${message}`);
    this.name = 'ShipConfigError';
  }
}

// Text with a trailing "# comment" removed; a "#" inside quotes is kept.
function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function unquote(text) {
  const t = text.trim();
  const m = t.match(/^(["'])(.*)\1$/);
  return m ? m[2] : t;
}

function setMode(map, schema, raw) {
  if (Object.hasOwn(map, schema)) throw new ShipConfigError(`ship.${schema}: duplicate key`);
  const value = unquote(raw);
  if (value === '' || /[{}[\]]/.test(value)) {
    throw new ShipConfigError(`ship.${schema}: expected one of ${SHIP_MODES.join(', ')}, not a nested map or list`);
  }
  if (!SHIP_MODES.includes(value)) {
    throw new ShipConfigError(`ship.${schema}: unknown mode "${value}"; use ${SHIP_MODES.slice(0, -1).join(', ')} or ${SHIP_MODES.at(-1)}`);
  }
  map[schema] = value;
}

// The `ship` map of openspec/config.yaml: { <schema>: 'plan' | 'pr' }.
// No key, or an empty one, is {}. Any invalid entry throws ShipConfigError.
export function parseShip(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^ship\s*:/.test(l));
  if (at < 0) return {};
  const map = {};
  const rest = stripComment(lines[at].replace(/^ship\s*:/, '')).trim();
  if (rest.startsWith('{')) {
    if (!rest.endsWith('}')) throw new ShipConfigError('ship: unterminated { ... } map');
    const inner = rest.slice(1, -1).trim();
    if (inner === '') return map;
    for (const part of inner.split(',')) {
      const m = part.match(/^\s*(["']?)([\w.-]+)\1\s*:(.*)$/);
      if (!m) throw new ShipConfigError(`ship: cannot read "${part.trim()}"; expected <schema>: ${SHIP_MODES.join(' | ')}`);
      setMode(map, m[2], m[3]);
    }
    return map;
  }
  if (rest !== '') {
    throw new ShipConfigError(`ship: expected a map from schema to mode (${SHIP_MODES.join(' or ')}), not "${unquote(rest)}"`);
  }
  let indent = null;
  let last = 'ship';
  for (const raw of lines.slice(at + 1)) {
    const line = stripComment(raw);
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break; // next top-level key
    const lead = line.match(/^\s*/)[0].length;
    if (indent === null) indent = lead;
    if (lead > indent) throw new ShipConfigError(`ship.${last}: expected one of ${SHIP_MODES.join(', ')}, not a nested map`);
    const m = line.trim().match(/^(["']?)([\w.-]+)\1\s*:(.*)$/);
    if (!m) throw new ShipConfigError(`ship: cannot read "${line.trim()}"; expected <schema>: ${SHIP_MODES.join(' | ')}`);
    last = m[2];
    setMode(map, last, m[3]);
  }
  return map;
}

// The top-level `merge_method:` of openspec/config.yaml: squash (no key or an
// empty one), merge or rebase. Anything else, a nested map or a list included,
// throws ShipConfigError.
export function parseMergeMethod(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^merge_method\s*:/.test(l));
  if (at < 0) return 'squash';
  const expected = `use ${MERGE_METHOD_VALUES.slice(0, -1).join(', ')} or ${MERGE_METHOD_VALUES.at(-1)}`;
  const rest = stripComment(lines[at].replace(/^merge_method\s*:/, '')).trim();
  if (rest === '') {
    const next = lines.slice(at + 1).map(stripComment).find((l) => l.trim() !== '');
    if (next !== undefined && (/^\s/.test(next) || /^-/.test(next))) throw new ShipConfigError(`merge_method: expected one value, not a nested map or list; ${expected}`);
    return 'squash';
  }
  const value = unquote(rest);
  if (/[{}[\]]/.test(value) || !MERGE_METHOD_VALUES.includes(value)) throw new ShipConfigError(`merge_method: unknown value "${value}"; ${expected}`);
  return value;
}

// 'plan' | 'pr' | 'merge' for a schema in the project's config; plan when unset.
export function shipMode(root, schema) {
  const file = join(root, CONFIG);
  const map = existsSync(file) ? parseShip(readFileSync(file, 'utf8')) : {};
  return map[schema] ?? 'plan';
}

// { ship, mergeMethod } for a schema. Both keys are validated on every run,
// whatever the schema's mode (design D2); the method is used only in merge mode.
export function shipConfig(root, schema) {
  const file = join(root, CONFIG);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const map = parseShip(text);
  return { ship: map[schema] ?? 'plan', mergeMethod: parseMergeMethod(text) };
}

// { model, ship, mergeMethod, base, testBranch, train } for a schema: the delivery model of `devkit.delivery` next to the `ship:`
// map (delivery-models D-1). `ship` is what every existing branch reads (`two-prs` is `pr`, so auto-merge is never enabled).
// `train` is the whole-suite command of the delivery train, or null (delivery-train D-1).
// A `ship:` entry that disagrees with the model, and any problem of the delivery or train settings, is a ShipConfigError.
const MODEL_SHIP = { trunk: 'pr', 'trunk-auto': 'merge', 'two-prs': 'pr' };

// The refusal text of a train problem (delivery-train D-1); the quote problem names the value it could not close.
function trainProblemText(problem) {
  if (problem.kind === 'unknown') return `devkit.delivery.train: "${problem.value}" opens a quote it never closes`;
  return problem.model === 'two-prs'
    ? 'devkit.delivery.train: the train runs only with the model trunk or trunk-auto (two-prs delivers each change through pull requests of its own)'
    : 'devkit.delivery.train: needs devkit.delivery.model trunk or trunk-auto';
}

export function deliveryConfig(root, schema) {
  const file = join(root, CONFIG);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const map = parseShip(text);
  const mergeMethod = parseMergeMethod(text);
  const devkit = parseDevkitBlock(text);
  const { model, base, testBranch, problems } = deliverySettings(devkit);
  if (problems[0]) {
    const p = problems[0];
    throw new ShipConfigError(p.kind === 'missing'
      ? `devkit.delivery: two-prs needs the ${p.setting.replace('delivery-', '').replace('-', '_')}`
      : `devkit.delivery: unknown ${p.setting.replace('delivery-', '').replace('-', '_')} "${p.value}"`);
  }
  const { suite: train, problem } = trainSetting(devkit);
  if (problem) throw new ShipConfigError(trainProblemText(problem));
  if (!model) return { model: null, ship: map[schema] ?? 'plan', mergeMethod, base: null, testBranch: null, train };
  const ship = MODEL_SHIP[model];
  const entry = map[schema];
  const agrees = entry === undefined || (model !== 'two-prs' && entry === ship);
  if (!agrees) throw new ShipConfigError(`ship.${schema}: "${entry}" disagrees with devkit.delivery.model ${model}; remove the ship entry or set it to ${model === 'two-prs' ? 'nothing' : ship}`);
  return { model, ship, mergeMethod, base, testBranch, train };
}

// The JSON file the release is read from (`devkit.release_tag`, release-tags D-1), or null when the project names none. A value that
// is not a path from the repository root to a JSON file is a ShipConfigError. Read only after the merge, so a bad value never
// changes a run before it (`/devkit change` already refused it at its start).
export function releaseTagOf(root) {
  const file = join(root, CONFIG);
  const { file: path, problem } = releaseTagSetting(parseDevkitBlock(existsSync(file) ? readFileSync(file, 'utf8') : ''));
  if (problem) throw new ShipConfigError(`devkit.release_tag: "${problem.value}" is not a path from the repository root to a .json file`);
  return path;
}

// Whether the project at `root` names `devkit.release_tag` (release-at-merge D-9, D-22; moved here from change-loop.mjs). A value the
// setting reader refuses names nothing here, as in releaseFacts; a null root (a folder outside a project's layout) names nothing.
export function namesReleaseTag(root) {
  if (root === null) return false;
  try { return releaseTagOf(root) !== null; } catch (e) {
    if (e instanceof ShipConfigError) return false;
    throw e;
  }
}

// The project folder of a change folder: the folder above `openspec/changes/<id>` or `openspec/changes/archive/<id>`, or null for a folder
// outside that layout (release-at-merge D-22).
export function changeRoot(dir) {
  let up = dirname(resolve(dir));
  if (basename(up) === 'archive' && basename(dirname(up)) === 'changes') up = dirname(up);
  return basename(up) === 'changes' && basename(dirname(up)) === 'openspec' ? dirname(dirname(up)) : null;
}

// ---------------------------------------------------------------- git facts and staleness

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gitOk(root, args) {
  try { git(root, args); return true; } catch { return false; }
}

// ---------------------------------------------------------------- worktrees (moved from conduct-check.mjs, delivery-models D-11)

// The branch a worktree stopped in the middle of a rebase is rebasing ('' when it is not).
function rebaseBranch(path) {
  try {
    const gitDir = git(path, ['rev-parse', '--absolute-git-dir']).trim();
    for (const d of ['rebase-merge', 'rebase-apply']) {
      const f = join(gitDir, d, 'head-name');
      if (existsSync(f)) return readFileSync(f, 'utf8').trim().replace(/^refs\/heads\//, '');
    }
  } catch { /* not a worktree */ }
  return '';
}

// git worktree list --porcelain, minus prunable and bare entries: [{ path, branch, rebasing }].
// A worktree stopped in the middle of a rebase is detached; its rebase says which branch it is.
export function listWorktrees(root) {
  let out;
  try { out = git(root, ['worktree', 'list', '--porcelain']); } catch { return []; }
  const entries = [];
  for (const block of out.split(/\n\s*\n/)) {
    const e = { path: '', branch: '', prunable: false, bare: false, rebasing: false };
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) e.path = line.slice('worktree '.length);
      else if (line.startsWith('branch refs/heads/')) e.branch = line.slice('branch refs/heads/'.length);
      else if (line === 'bare') e.bare = true;
      else if (line.startsWith('prunable')) e.prunable = true;
    }
    if (!e.path || e.bare || e.prunable) continue;
    const rebasing = rebaseBranch(e.path);
    if (rebasing) { e.rebasing = true; if (!e.branch) e.branch = rebasing; }
    entries.push({ path: e.path, branch: e.branch, rebasing: e.rebasing });
  }
  return entries;
}

const isOpenspec = (p) => p.startsWith('openspec/');

// A test file (review-writer-prompt D-6): `.test.` or `.spec.` in its file name, or a folder named
// test, tests, __tests__ or fixtures on its path. A fixed pattern, no setting.
const TEST_FOLDERS = ['test', 'tests', '__tests__', 'fixtures'];
export function isTestFile(path) {
  const parts = String(path).split('/');
  const name = parts.pop();
  return name.includes('.test.') || name.includes('.spec.') || parts.some((f) => TEST_FOLDERS.includes(f));
}
// The reviewers whose verdict a commit of test files only (and openspec/) leaves current.
export const TEST_SPARED_REVIEWERS = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];

// A verdict that passes the reviews item: approved, or declined (no surface).
const approved = (verdict) => verdict === 'APPROVED' || verdict === 'DECLINED';

// The change's own review record (review-openspec-fix D-1): its reviews/ folder, review.md and evidence.md.
function reviewRecord(id) {
  const dir = `openspec/changes/${id}/`;
  return (p) => p.startsWith(`${dir}reviews/`) || p === `${dir}review.md` || p === `${dir}evidence.md`;
}

// Which later commits leave reviewer `name`'s verdict current (review-openspec-fix D-1): for an approved or
// declined verdict, commits of openspec/ (and of test files, for the test-spared reviewers), as before;
// for any other verdict, a missing one included, and for an approved one that still lists an undisposed
// finding (`open`), commits of the change's own review record only (jira-entry-followups D-2).
function verdictAllowed(id, name, verdict, open = false) {
  if (!approved(verdict) || open) return reviewRecord(id);
  return TEST_SPARED_REVIEWERS.includes(name) ? (p) => isOpenspec(p) || isTestFile(p) : isOpenspec;
}

// Paths the working tree changes outside openspec/ (and outside .claude/ for
// untracked files). Rename sources count as changed paths.
function dirtyPaths(root) {
  const entries = git(root, ['status', '--porcelain', '-z', '-uall']).split('\0').filter(Boolean);
  const dirty = [];
  for (let i = 0; i < entries.length; i++) {
    const xy = entries[i].slice(0, 2);
    const path = entries[i].slice(3);
    const moved = /[RC]/.test(xy) ? entries[++i] : null;
    if (xy === '??') {
      if (!isOpenspec(path) && !path.startsWith('.claude/')) dirty.push(path);
      continue;
    }
    for (const p of [path, moved]) if (p && !isOpenspec(p)) dirty.push(p);
  }
  return dirty;
}

// What every staleness check shares: the head sha (null before the first
// commit), the uncommitted paths that count and the base branch whose merges
// the own-files rule may exempt (null: no merge is exempted, stale-only-on-own-files D-4).
export function gitFacts(root, { base = null } = {}) {
  let head = null;
  try { head = git(root, ['rev-parse', 'HEAD']).trim(); } catch { /* no commit yet */ }
  return { head, dirty: dirtyPaths(root), base };
}

// The remote-tracking tip of `base`, or null when this checkout has none (the checkers never fetch).
const baseTip = (root, base) => {
  try { return git(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${base}^{commit}`]).trim() || null; } catch { return null; }
};

// The branch whose merges the own-files rule may exempt, or null (stale-only-on-own-files D-1); first match wins:
// the pull request's base in CI, the configured base (`two-prs`), the branch origin/HEAD points at, then main or master.
export function stalenessBase(root, env = process.env, configuredBase = null) {
  if (env.GITHUB_BASE_REF) return env.GITHUB_BASE_REF;
  if (configuredBase) return configuredBase;
  try {
    const named = git(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, '');
    if (named) return named;
  } catch { /* a clone without origin/HEAD */ }
  return ['main', 'master'].find((name) => baseTip(root, name)) ?? null;
}

// Whether the checkout's head is contained in origin/<facts.base> (coordinator-loop-fixes D-21); false with no
// head, no base or no origin/<base>.
export function headInBase(root, facts) {
  const tip = facts.base && facts.head ? baseTip(root, facts.base) : null;
  return Boolean(tip) && gitOk(root, ['merge-base', '--is-ancestor', facts.head, tip]);
}

// The paths that differ between the merge base of `tip` and `head` and the head, both sides of a move included, less the release
// files (stale-only-on-own-files D-2). Throws as git does when there is no merge base. The one command both the staleness rule
// (`ownFiles`) and the selective test run (`branchOwnPaths`) read.
export function ownDiffPaths(root, tip, head) {
  return new Set(git(root, ['diff', '--name-only', '-z', '--no-renames', `${tip}...${head}`]).split('\0').filter((p) => p && !RELEASE_FILE.test(p)));
}

// What the selective test run reads (selective-tests-by-map-2 D-2): `{ base, paths }`, the sorted own paths, or `{ base, why }` when
// the rule cannot tell. Own are the paths of the committed diff off origin/<facts.base> (`ownDiffPaths`) and the uncommitted ones
// (`facts.dirty`, which holds none under openspec/), less the release files; a head already in origin/<base> has the dirty ones only.
export function branchOwnPaths(root, facts) {
  const base = facts.base;
  if (!base) return { base: null, why: 'no base branch' };
  const tip = baseTip(root, base);
  if (!tip) return { base, why: `origin/${base} is missing` };
  if (!facts.head) return { base, why: 'no commit' };
  const dirty = facts.dirty.filter((p) => !RELEASE_FILE.test(p));
  if (headInBase(root, facts)) return { base, paths: [...new Set(dirty)].sort() };
  let committed;
  try {
    committed = ownDiffPaths(root, tip, facts.head);
  } catch {
    return { base, why: `no merge base with origin/${base}` };
  }
  return { base, paths: [...new Set([...committed, ...dirty])].sort() };
}

// The change's own files (stale-only-on-own-files D-2): { base, tip, isOwn(path) }, or null when the rule cannot
// tell (no base, no origin/<base>, no head, the head already in the base, no merge base). Own are the paths that
// differ between the merge base and the head, both sides of a move included, less the release files, and
// everything under the change's folder. Memoized per change on `facts`.
export function ownFiles(root, id, facts) {
  const cache = (facts.ownCache ??= new Map());
  if (cache.has(id)) return cache.get(id);
  let own = null;
  const tip = facts.base && facts.head ? baseTip(root, facts.base) : null;
  if (tip && !headInBase(root, facts)) {
    try {
      const paths = ownDiffPaths(root, tip, facts.head);
      const folder = `openspec/changes/${id}/`;
      own = { base: facts.base, tip, isOwn: (p) => paths.has(p) || p.startsWith(folder) };
    } catch { /* unrelated histories: no merge base */ }
  }
  cache.set(id, own);
  return own;
}

// The paths commit `c` counts as touching: a merge (more than one parent) against its first
// parent, what it brought into the branch; any other commit as before (merge-staleness-first-parent).
function touchedPaths(root, c, parents) {
  const args = parents.length > 1
    ? ['diff-tree', '-r', '-z', '--name-only', '--no-commit-id', parents[0], c]
    : ['diff-tree', '-m', '-r', '-z', '--root', '--name-only', '--no-commit-id', c];
  return git(root, args).split('\0').filter(Boolean);
}

// The two commit sets the own-files walk reads for one recorded sha (stale-only-on-own-files D-3), memoized on
// `facts`: `line`, the commits on the branch's own first-parent line, and `offBase`, the commits of the range that
// `origin/<base>` does not contain.
function ownWalk(root, facts, full, tip) {
  const cache = (facts.walkCache ??= new Map());
  if (!cache.has(full)) {
    const set = (args) => new Set(git(root, args).split('\n').filter(Boolean));
    cache.set(full, {
      line: set(['rev-list', '--first-parent', `${full}..${facts.head}`]),
      offBase: set(['rev-list', `${full}..${facts.head}`, `^${tip}`]),
    });
  }
  return cache.get(full);
}

// Why a recorded Commit is not current at HEAD, or null when it is: it
// resolves, is an ancestor of HEAD, every commit since touches only
// openspec/ (or, with `allowed`, only paths it accepts), it is not marked
// uncommitted, and the working tree has no change outside openspec/ and .claude/.
// A merge commit counts what it brought into the branch (its first-parent diff);
// every commit in the range is still checked. With `own` (ownFiles), a merge of the base and
// the base commits it brings in count only the change's own files; every other commit is judged as before. With `release` (a noted change's
// releaseEditOf: release-at-merge D-5), a path it accepts for a commit and its first parent counts as not touched, in a plain commit as in a merge.
export function staleness(root, recorded, facts = gitFacts(root), { allowed = isOpenspec, own = null, release = null } = {}) {
  if (!recorded) return 'no Commit: line';
  const short = recorded.sha.slice(0, 7);
  if (recorded.uncommitted) return `${short} was recorded with uncommitted changes`;
  if (facts.dirty.length) return `uncommitted changes outside openspec/ (${facts.dirty.slice(0, 3).join(', ')})`;
  if (!facts.head) return 'no commit at HEAD yet';
  let full;
  try { full = git(root, ['rev-parse', '--verify', '--quiet', `${recorded.sha}^{commit}`]).trim(); } catch { full = ''; }
  if (!full) return `${short} does not resolve to a commit`;
  if (!gitOk(root, ['merge-base', '--is-ancestor', full, facts.head])) return `${short} is not an ancestor of HEAD`;
  const walk = own ? ownWalk(root, facts, full, own.tip) : null;
  const inBase = (sha) => gitOk(root, ['merge-base', '--is-ancestor', sha, own.tip]);
  for (const line of git(root, ['rev-list', '--parents', `${full}..${facts.head}`]).split('\n').filter(Boolean)) {
    const [c, ...parents] = line.split(' ');
    const fromBase = walk && ((!walk.line.has(c) && !walk.offBase.has(c))
      || (walk.line.has(c) && parents.length > 1 && !inBase(parents[0]) && parents.slice(1).every(inBase)));
    const product = touchedPaths(root, c, parents).find((f) => !allowed(f) && (!fromBase || own.isOwn(f)) && !(release && release(parents[0], c, f)));
    if (product) return `${short} is behind ${c.slice(0, 7)}, which touches ${product}`;
  }
  return null;
}

// ---------------------------------------------------------------- locating a change (archive-after-merge D3)

const ARCHIVED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

// Where change `id` lives in this checkout: { dir, archived: false } for
// openspec/changes/<id>/, { dir, archived: true } for the newest
// openspec/changes/archive/<YYYY-MM-DD>-<id>/ (exact id), else null.
export function locateChange(root, id) {
  if (!/^[\w.-]+$/.test(id) || id === '.' || id === '..' || id === 'archive') return null;
  const live = changeDir(root, id);
  if (existsSync(live) && statSync(live).isDirectory()) return { dir: live, archived: false };
  const archive = join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(archive)) return null;
  const dated = readdirSync(archive).map((n) => ARCHIVED.exec(n)).filter((m) => m && m[2] === id).map((m) => m[0]).sort();
  const newest = dated.at(-1);
  return newest && statSync(join(archive, newest)).isDirectory() ? { dir: join(archive, newest), archived: true } : null;
}

// The schema of a located change.
export const schemaOf = (root, located) => changeSchemaAt(root, located.dir);

// ---------------------------------------------------------------- items

const item = (id, name, status, reason, details = {}) => ({ id, name, status, reason, details });

// The *.md verdict files of a folder, by name: [{ name, verdict, commit }], `commit` the parsed Commit: line or null.
export function verdictFiles(dir) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  return files.map((f) => {
    const file = join(dir, f);
    return { name: basename(f, '.md'), verdict: readValue(file, 'Verdict'), commit: parseCommitLine(readFileSync(file, 'utf8')) };
  });
}

// Every reviews/*.md: { name, verdict, why } where why is null when its
// Commit: is current and the reason otherwise. Which later commits leave it
// current is the rule verdictAllowed picks from its name, its verdict and whether it lists an undisposed finding.
export function readReviews(root, id, facts = gitFacts(root)) {
  const dir = join(changeDir(root, id), 'reviews');
  return verdictFiles(dir).map(({ name, verdict, commit }) => {
    const open = approved(verdict) && undisposedIn(root, join(dir, `${name}.md`), facts.head).length > 0;
    // An approved verdict with an open finding keeps the rejected rule: neither the own-files nor the release-edit exemption (release-at-merge D-5).
    const exempt = approved(verdict) && !open;
    return { name, verdict, why: staleness(root, commit, facts, { allowed: verdictAllowed(id, name, verdict, open), own: exempt ? ownFiles(root, id, facts) : null, release: exempt ? releaseEditOf(root, id, facts) : null }) };
  });
}

// Item 2: every review approved (or declined) at the head.
export function reviewsItem(root, id, facts = gitFacts(root)) {
  const found = readReviews(root, id, facts);
  const missing = REQUIRED_REVIEWERS.filter((r) => !found.some((x) => x.name === r));
  const rejected = found.filter((x) => !approved(x.verdict)).map((x) => x.name);
  const stale = found.filter((x) => x.why);
  const reasons = [
    missing.length ? `missing ${missing.join(', ')}` : '',
    rejected.length ? `not approved: ${found.filter((x) => rejected.includes(x.name)).map((x) => `${x.name} (${(x.verdict || 'no verdict line').toLowerCase()})`).join(', ')}` : '',
    ...stale.map((x) => `stale ${x.name} (${x.why})`),
  ].filter(Boolean);
  const details = { stale: stale.map((x) => x.name), rejected, missing };
  if (reasons.length === 0) return item(2, 'reviews', 'met', `${found.length} reviews at head`, details);
  return item(2, 'reviews', 'open', reasons.join('; '), details);
}

// The 1-based lines of `text` that sit inside a fenced block (and the fence lines themselves). A line
// opening with three or more backticks or tildes opens a fence; the next line opening with at least as
// many of the same character closes it. An opening line with no closing line before the end of the text
// opens no fence.
export function fencedLines(text) {
  const lines = String(text).split('\n');
  const inside = new Set();
  let from = 0;
  for (;;) {
    let open = null;
    let openedAt = -1;
    const added = [];
    for (let i = from; i < lines.length; i++) {
      const m = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
      if (open) {
        added.push(i + 1);
        if (m && m[1][0] === open.char && m[1].length >= open.len) open = null;
      } else if (m) {
        added.push(i + 1);
        open = { char: m[1][0], len: m[1].length };
        openedAt = i;
      }
    }
    if (!open) {
      for (const n of added) inside.add(n);
      return inside;
    }
    // Unclosed: drop the opening line and every line added after it, then rescan after the opening line.
    for (const n of added) if (n <= openedAt) inside.add(n);
    from = openedAt + 1;
  }
}

// The checkbox lines of tasks.md outside fenced blocks: { phase, id, done, isGate, command, isConductor }. A gate
// task's description (the text after its id) starts with "Gate:"; its command is the first backticked text after it.
// A task whose description starts with "Conductor:" is the conducting session's (coordinator-loop-fixes D-6).
export function parseTasks(text) {
  const tasks = [];
  let phase = 1;
  const fenced = fencedLines(text);
  for (const [i, line] of String(text).split(/\r?\n/).entries()) {
    if (fenced.has(i + 1)) continue;
    const h = line.match(/^##\s+(\d+)\./);
    if (h) { phase = Number(h[1]); continue; }
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(\S+)\s*(.*)$/);
    if (!m) continue;
    const description = m[3];
    const isGate = description.startsWith('Gate:');
    tasks.push({ phase, id: m[2], done: m[1] !== ' ', isGate, command: isGate ? (description.match(/^Gate:[^`]*`([^`]+)`/)?.[1] ?? null) : null, isConductor: description.startsWith('Conductor:') });
  }
  return tasks;
}

// Phases for the JSON report and nextStep: [{ n, title, open, conductor, gate }]; `conductor` lists the open tasks the
// conducting session does (D-6), [] when none.
export function readPhases(file) {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const titles = new Map([...text.matchAll(/^##\s+(\d+)\.\s*(.*)$/gm)].map((m) => [Number(m[1]), m[2].trim()]));
  const phases = new Map();
  for (const t of parseTasks(text)) {
    if (!phases.has(t.phase)) phases.set(t.phase, { n: t.phase, title: titles.get(t.phase) || '', open: [], conductor: [], gate: null });
    const p = phases.get(t.phase);
    if (t.isGate) p.gate ??= { id: t.id, done: t.done, command: t.command };
    else if (!t.done) {
      p.open.push(t.id);
      if (t.isConductor) p.conductor.push(t.id);
    }
  }
  return [...phases.values()].sort((a, b) => a.n - b.n);
}

// Item 1: every task ticked, every gate command green in evidence.md at a
// current commit. A gate part equal to one of `trainParts` (the `&&` parts of the train's whole-suite command, trimmed)
// is proven by the train: it needs no row, and `details.trainParts` lists the ones that would have needed one
// (present only when `trainParts` is not empty; delivery-train D-11).
export function tasksItem(root, id, facts = gitFacts(root), { trainParts = [] } = {}) {
  const dir = changeDir(root, id);
  const tasksFile = join(dir, 'tasks.md');
  if (!existsSync(tasksFile)) return item(1, 'tasks', 'blocked', `openspec/changes/${id}/tasks.md does not exist`, { unticked: [], missingGates: [], evidence: 'missing' });
  const tasks = parseTasks(readFileSync(tasksFile, 'utf8'));
  const unticked = tasks.filter((t) => !t.done).map((t) => t.id);
  const noCommand = tasks.filter((t) => t.isGate && !t.command).map((t) => t.id);
  const commands = [...new Set(tasks.flatMap((t) => (t.command ? t.command.split('&&').map((c) => c.trim()).filter(Boolean) : [])))];
  const evFile = join(dir, 'evidence.md');
  const text = existsSync(evFile) ? readFileSync(evFile, 'utf8') : null;
  let evidence = 'missing';
  const staleWhy = text === null ? null : staleness(root, parseCommitLine(text), facts, { own: ownFiles(root, id, facts), release: releaseEditOf(root, id, facts) });
  if (text !== null) evidence = staleWhy ? 'stale' : 'current';
  const passing = text === null ? [] : tableRows(text).filter((cells) => /^pass/i.test(cells.at(-1) || ''));
  const withoutRow = commands.filter((c) => !passing.some((cells) => cells.some((cell) => cell.includes(`\`${c}\``))));
  const byTrain = withoutRow.filter((c) => trainParts.includes(c));
  const missingGates = withoutRow.filter((c) => !trainParts.includes(c));
  const details = { unticked, missingGates, evidence, ...(trainParts.length ? { trainParts: byTrain } : {}) };
  if (noCommand.length) {
    return item(1, 'tasks', 'blocked', `gate task ${noCommand.join(', ')} names no command in backticks after "Gate:"`, details);
  }
  const reasons = [
    unticked.length ? `unticked tasks: ${unticked.join(', ')}` : '',
    evidence === 'missing' ? 'evidence.md is missing' : '',
    evidence === 'stale' ? `evidence.md is stale (${staleWhy})` : '',
    ...missingGates.map((c) => `no passing row in evidence.md for \`${c}\``),
  ].filter(Boolean);
  if (reasons.length) return item(1, 'tasks', 'open', reasons.join('; '), details);
  const inRows = commands.length - byTrain.length;
  const proven = [
    inRows ? `${inRows} gate command${inRows > 1 ? 's' : ''} green in evidence.md` : '',
    byTrain.length ? `${byTrain.length} proven by the train` : '',
  ].filter(Boolean).map((part) => `; ${part}`).join('');
  return item(1, 'tasks', 'met', `all tasks ticked${proven}`, details);
}

// Cells of every markdown table row in the text.
function tableRows(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'))
    .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
}

// The [blocking] / [important] findings of a verdict text, by disposition: { fixed, refuted, undisposed }. A "fixed in <sha>"
// counts only when `inHead(sha)` says the sha is in the history of the head the caller reads.
function findingsOfText(reviewer, text, inHead) {
  const undisposed = [];
  let fixed = 0;
  let refuted = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*(?:[-*+]|\d+[.)])\s+\**\[(?:blocking|important)\]/i.test(line)) continue;
    const fix = line.match(/·\s*fixed in\s+([0-9a-f]{7,40})\b/i);
    if (fix && inHead(fix[1])) { fixed++; continue; }
    if (!fix && /·\s*refuted:\s*\S/.test(line)) { refuted++; continue; }
    undisposed.push({ reviewer, excerpt: line.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, '').slice(0, 100) });
  }
  return { fixed, refuted, undisposed };
}

// The same, for a verdict file read from disk; a "fixed in <sha>" counts only when the sha is in the history of `head`.
function findingsOfFile(root, file, head) {
  return findingsOfText(basename(file, '.md'), readFileSync(file, 'utf8'), (sha) => inHistory(root, sha, head));
}

// The findings of one verdict file that have no disposition: [{ reviewer, excerpt }] (jira-entry-followups D-2).
export function undisposedIn(root, file, head) {
  return findingsOfFile(root, file, head).undisposed;
}

// The [blocking] / [important] findings of the *.md files of a folder, by disposition: { fixed, refuted, undisposed }.
export function findingsIn(root, dir, head) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  const total = { fixed: 0, refuted: 0, undisposed: [] };
  for (const f of files) {
    const one = findingsOfFile(root, join(dir, f), head);
    total.fixed += one.fixed;
    total.refuted += one.refuted;
    total.undisposed.push(...one.undisposed);
  }
  return total;
}

// Item 3: every [blocking] / [important] finding has a disposition.
export function findingsItem(root, id, facts = gitFacts(root)) {
  const details = findingsIn(root, join(changeDir(root, id), 'reviews'), facts.head);
  const { fixed, refuted, undisposed } = details;
  if (undisposed.length) {
    return item(3, 'findings', 'open', `undisposed: ${undisposed.map((u) => `${u.reviewer}: ${u.excerpt}`).join('; ')}`, details);
  }
  return item(3, 'findings', 'met', `${fixed} fixed, ${refuted} refuted`, details);
}

function inHistory(root, sha, head) {
  if (!head) return false;
  return gitOk(root, ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]) && gitOk(root, ['merge-base', '--is-ancestor', sha, head]);
}

// The "## Acceptance criteria" section of a markdown file, or ''.
function acceptanceSection(file) {
  if (!existsSync(file)) return '';
  const out = [];
  let inside = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^##\s+Acceptance criteria\s*$/i.test(line)) { inside = true; continue; }
    if (inside && /^##\s/.test(line)) break;
    if (inside) out.push(line);
  }
  return out.join('\n');
}

// Item 4: every acceptance criterion has proof in evidence.md.
export function acceptanceItem(root, id, facts = gitFacts(root)) {
  const dir = changeDir(root, id);
  let ids = [];
  for (const f of ['proposal.md', 'requirements.md']) {
    ids = [...new Set(acceptanceSection(join(dir, f)).match(/\bAC-\d+/g) || [])];
    if (ids.length) break;
  }
  const evFile = join(dir, 'evidence.md');
  const text = existsSync(evFile) ? readFileSync(evFile, 'utf8') : null;
  const why = text === null ? null : staleness(root, parseCommitLine(text), facts, { own: ownFiles(root, id, facts), release: releaseEditOf(root, id, facts) });
  const evidence = text === null ? 'missing' : why ? 'stale' : 'current';
  const rows = text === null ? [] : tableRows(text);
  const resultsFor = (ac) => rows.filter((cells) => cells.some((c) => new RegExp(`\\b${ac}(?!\\d)`).test(c)))
    .map((cells) => (cells.at(-1) || '').toLowerCase());
  const details = { ids, proven: [], missing: [], defects: [], noProof: [], evidence };
  for (const ac of ids) {
    const results = resultsFor(ac);
    if (results.some((r) => /^(fail|defect)/.test(r))) details.defects.push(ac);
    else if (results.some((r) => /^(pass|verified)/.test(r))) details.proven.push(ac);
    else if (results.some((r) => /^no proof/.test(r))) details.noProof.push(ac);
    else details.missing.push(ac);
  }
  if (ids.length === 0) {
    return item(4, 'acceptance', 'blocked', 'no acceptance criteria ids found in proposal.md or requirements.md (## Acceptance criteria)', details);
  }
  const open = [
    evidence === 'missing' ? 'evidence.md is missing' : '',
    evidence === 'stale' ? `evidence.md is stale (${why})` : '',
    details.missing.length ? `no proof row for ${details.missing.join(', ')}` : '',
    details.defects.length ? `fail/defect row for ${details.defects.join(', ')}` : '',
  ].filter(Boolean);
  if (details.noProof.length) {
    return item(4, 'acceptance', 'blocked', [`no proof for ${details.noProof.join(', ')} (the owner weighs it)`, ...open].join('; '), details);
  }
  if (open.length) return item(4, 'acceptance', 'open', open.join('; '), details);
  return item(4, 'acceptance', 'met', `${ids.length} criteria proven`, details);
}

// ---------------------------------------------------------------- GitHub

const PR_FIELDS = 'number,url,state,headRefOid,baseRefName,mergeable,body';
const MERGE_FIELDS = `${PR_FIELDS},autoMergeRequest,mergeStateStatus`;

function parsePr(r) {
  try { return { pr: JSON.parse(r.stdout) }; } catch { return { error: 'gh pr view returned unreadable JSON' }; }
}

// The PR of the current branch: { pr } | { none: true } | { error }.
// Plan and pr modes ask exactly as 0.4.0 did. In merge mode the PR also reports
// auto-merge and the merge state, and is looked up by its number once known; when
// the branch no longer finds it (it was merged and the branch deleted), by head
// branch among open, merged and closed PRs (design D6, readiness carry-over).
// `list: true` allows that fallback in pr mode too (archive-after-merge D4).
export function fetchPr(gh, { merge = false, number = null, branch = '', list: lookup = merge, base = null, mergeFields = merge } = {}) {
  const fields = mergeFields ? MERGE_FIELDS : PR_FIELDS;
  // Two pull requests share the head in `two-prs`, and `gh pr view` picks one: with a base the pull requests of the branch
  // to that base are listed, the open one first, else the newest (delivery-models D-4).
  if (base && branch && !number) return listFound(gh, ['--head', branch, '--base', base], fields);
  const r = gh(['pr', 'view', ...(merge && number ? [String(number)] : []), '--json', fields]);
  if (r.status === 0) return parsePr(r);
  if (!r.missing && /no pull requests? found/i.test(r.stderr)) {
    if (!lookup || !branch) return { none: true };
    return listFound(gh, ['--head', branch], fields);
  }
  return { error: ghError(r) };
}

// `gh pr list` of the given filters in every state: { pr } (the open one, else the newest) | { none: true } | { error }.
function listFound(gh, filters, fields) {
  const l = gh(['pr', 'list', ...filters, '--state', 'all', '--limit', '10', '--json', fields]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  const found = Array.isArray(list) ? (list.find((p) => p.state === 'OPEN') ?? list[0]) : null;
  return found ? { pr: found } : { none: true };
}

const NO_PR = 'no pull request for this branch yet';

// The branches the archive PR of change `id` is opened from: never the change branch.
export const archiveHeads = (id) => [`chore/archive-${id}`, `archive-${id}`];

// Every change's archive head, not only one id's (`chore/archive-<name>` or `archive-<name>`).
export const isArchiveHead = (name) => /^(chore\/)?archive-/.test(String(name ?? ''));

// An archive head other than change `id`'s own branch (coordinator-loop-fixes D-20).
export const foreignArchiveHead = (id, name) => String(name ?? '') !== id && isArchiveHead(name);

// The files a pull request changed, read by number and paginated (gh pr view --json files stops at 100):
// { files } | { error }.
export function prFiles(gh, number) {
  const r = gh(['api', `repos/{owner}/{repo}/pulls/${number}/files`, '--paginate', '--jq', '.[].filename']);
  if (r.status !== 0) return { error: ghError(r) };
  return { files: String(r.stdout).split(/\r?\n/).filter(Boolean) };
}

// Whether `file` sits in the archive folder of change `id` (openspec/changes/archive/<date>-<id>/): a dated
// first folder whose name after the date is `id` exactly (no pattern is built from `id`).
function inOwnArchiveFolder(id, file) {
  const prefix = 'openspec/changes/archive/';
  if (!file.startsWith(prefix)) return false;
  const rest = file.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return false;
  return ARCHIVED.exec(rest.slice(0, slash))?.[2] === id;
}

// The change's own pull request (field-fixes D-4, own-pr-archive-paths): not an archive head other than the change's own
// branch (coordinator-loop-fixes D-20: a change whose id starts with `archive-` keeps its pull request), not a train's
// (`train/<n>`), no file in the change's own archive folder (openspec/changes/archive/<date>-<id>/, the exact id;
// another change's archived files do not count), and some file under the change's active folder. A body or a
// head name that names the change is never proof.
export function isOwnPr(id, pr, files) {
  if (foreignArchiveHead(id, pr?.headRefName)) return false;
  if (TRAIN_BRANCH.test(String(pr?.headRefName ?? ''))) return false;
  if (files.some((f) => inOwnArchiveFolder(id, f))) return false;
  return files.some((f) => f.startsWith(`openspec/changes/${id}/`));
}

// The tasks of the change still unticked in its tasks.md on `base`:
// { unticked: [ids] } | { absent: true } | { error }.
export function tasksOnDefault(gh, id, base) {
  const got = readContents(gh, `openspec/changes/${id}/tasks.md`, base);
  if (got.notFound) return { absent: true };
  if (got.error) return { error: got.error };
  if (typeof got.json?.content !== 'string') return { error: `openspec/changes/${id}/tasks.md on ${base} has no content` };
  const text = Buffer.from(got.json.content, 'base64').toString('utf8');
  return { unticked: parseTasks(text).filter((t) => !t.done).map((t) => t.id) };
}

// tasksOnDefault on the repository's default branch, with the repository settings read to find it (the
// caller reuses them): { unticked } | { absent } | { error }, each with `repo`.
function defaultTasks(gh, id) {
  const repo = readRepoSettings(gh);
  const base = repo.settings?.default_branch;
  if (!base) return { error: `cannot read the default branch on GitHub: ${repo.error ?? 'the answer has no default branch'}`, repo };
  return { ...tasksOnDefault(gh, id, base), repo };
}

// The change's PR, whichever branch the checkout is on (archive-after-merge D4, field-fixes D-4):
// { pr, via } | { none: true } | { error }. `via` is 'branch' when the current
// branch is the change's own, 'list' when found among the merged PRs, 'commit' when
// a full list of them held none and the base's commits that changed tasks.md led to it
// (an error of that search carries `arm: 'commit'`). "The
// change's own branch" means the branch's own name identifies it (the exact
// tail or a contained match, as resolveChange's own arms do) — never
// resolveChange's single-active-change fallback, which answers with the sole
// active change whatever the branch is called (compozy-loop-v2 retro).
//  1. plan mode, a known number, or the change branch: fetchPr as before (the
//     head-branch fallback also runs in pr mode). A MERGED PR found this way must be
//     the change's own (its files say so); with tasks left on the default branch an
//     open PR of the same head is the PR, else `{ none: true, mergedBefore }`;
//  2. otherwise, in pr and merge modes: the newest merged PR that is the change's
//     own (isOwnPr over its files), archive heads dropped first.
export const branchNamesChange = (branch, id) => branch.split('/').pop() === id || branch.includes(id);

function mergedOnBranch(gh, id, found, branch, mergeFields, base = null) {
  const files = prFiles(gh, found.pr.number);
  if (files.error) return { error: files.error };
  if (!isOwnPr(id, { headRefName: found.pr.headRefName ?? branch }, files.files)) return { none: true };
  const tasks = defaultTasks(gh, id);
  if (tasks.error) return { error: tasks.error };
  const known = { tasks, repo: tasks.repo };
  if (tasks.unticked?.length === 0 || !branch) return { ...found, ...known };
  const l = gh(['pr', 'list', '--head', branch, ...(base ? ['--base', base] : []), '--state', 'open', '--limit', '10', '--json', mergeFields ? MERGE_FIELDS : PR_FIELDS]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  const open = Array.isArray(list) ? list.find((p) => p.state === 'OPEN') : null;
  return open ? { pr: open, via: 'branch' } : { none: true, mergedBefore: found.pr.number, merged: found.pr, ...known };
}

// In `two-prs` `base` is the base branch: only the pull requests to it are the change's own (the one to the test branch is not).
export function findChangePr(gh, root, id, { ship = 'plan', branch = '', env = process.env, number = null, base = null, mergeFields = ship === 'merge' } = {}) {
  const merge = ship === 'merge';
  const selected = resolveChange(root, env, branch);
  const own = selected?.name === id && Boolean(branch) && branchNamesChange(branch, id) && !defaultBranches(root).includes(branch) && !archiveHeads(id).includes(branch);
  if (ship === 'plan' || number || own) {
    const r = fetchPr(gh, { merge, number, branch: own ? branch : '', list: ship !== 'plan', base, mergeFields });
    if (!r.pr) return r;
    const found = { ...r, via: 'branch' };
    return ship !== 'plan' && r.pr.state === 'MERGED' ? mergedOnBranch(gh, id, found, own ? branch : '', mergeFields, base) : found;
  }
  // Light fields only: 100 PRs with their bodies can pass spawnSync's buffer. A PR's files are read,
  // by number and newest first, only while no PR has been found to be the change's own.
  const light = `${(mergeFields ? MERGE_FIELDS : PR_FIELDS).replace(',body', '')},headRefName,mergedAt`;
  const l = gh(['pr', 'list', '--state', 'merged', '--limit', '100', '--json', light]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
  const rest = list.filter((p) => !foreignArchiveHead(id, p.headRefName) && (!base || p.baseRefName === base)).sort((a, b) => when(b.mergedAt) - when(a.mergedAt));
  for (const p of rest) {
    const f = prFiles(gh, p.number);
    if (f.error) return { error: f.error };
    if (isOwnPr(id, p, f.files)) return { pr: p, via: 'list' };
  }
  // A full list may have cut the change's pull request off (forced-merge-path D-1): look for it by the commits that changed its tasks.md.
  return list.length === 100 ? findByCommits(gh, id, base) : { none: true };
}

// The change's merged own pull request found through the commits of the base that changed its tasks.md, newest first, and the pull
// requests each commit belongs to (forced-merge-path D-1): { pr, via: 'commit' } | { none: true } | { error, arm: 'commit' }.
// `base` is the configured base, else the repository's default branch.
function findByCommits(gh, id, base) {
  const fail = (error) => ({ error, arm: 'commit' });
  let branch = base;
  if (!branch) {
    const repo = readRepoSettings(gh);
    branch = repo.settings?.default_branch;
    if (!branch) return fail(repo.error ?? 'the answer has no default branch');
  }
  const commits = ghJson(gh, `commits?sha=${encodeURIComponent(branch)}&path=openspec/changes/${id}/tasks.md&per_page=10`);
  if (commits.error) return fail(commits.error);
  if (!Array.isArray(commits.json)) return fail(`commits of ${branch} returned no list`);
  const seen = new Set();
  for (const c of commits.json) {
    if (!isSha(c?.sha)) return fail(`commits of ${branch} returned an entry with no sha`);
    const pulls = ghJson(gh, `commits/${c.sha}/pulls`);
    if (pulls.error) return fail(pulls.error);
    if (!Array.isArray(pulls.json)) return fail(`commits/${c.sha.slice(0, 7)}/pulls returned no list`);
    for (const p of pulls.json) {
      if (!p?.merged_at || p.base?.ref !== branch || foreignArchiveHead(id, p.head?.ref) || seen.has(p.number)) continue;
      seen.add(p.number);
      const f = prFiles(gh, p.number);
      if (f.error) return fail(f.error);
      const pr = { number: p.number, url: p.html_url, state: 'MERGED', headRefOid: p.head?.sha, headRefName: p.head?.ref, baseRefName: p.base.ref, mergedAt: p.merged_at };
      if (isOwnPr(id, pr, f.files)) return { pr, via: 'commit' };
    }
  }
  return { none: true };
}

// ---------------------------------------------------------------- an owner's forced merge (forced-merge-path D-2, D-3)

// The checks of a rollup that are not green: [{ name, conclusion }], `required` first, in its order, then `devkit-reviews` when no
// rule requires it but it reported. `rollup` is the `statusCheckRollup` list: a CheckRun (`name`, `conclusion`) or a StatusContext
// (`context`, `state`). A name is green only when every entry of it is SUCCESS; a required name with no entry is `absent`; an entry
// with no conclusion yet is `PENDING`.
export function notGreen(rollup, required) {
  const nameOf = (e) => e?.name ?? e?.context;
  const names = [...new Set(required)];
  if (!names.includes(DEVKIT_REVIEWS_CHECK) && rollup.some((e) => nameOf(e) === DEVKIT_REVIEWS_CHECK)) names.push(DEVKIT_REVIEWS_CHECK);
  const out = [];
  for (const name of names) {
    const entries = rollup.filter((e) => nameOf(e) === name);
    if (!entries.length) { out.push({ name, conclusion: 'absent' }); continue; }
    const bad = entries.map((e) => e.conclusion || e.state || 'PENDING').find((v) => v !== 'SUCCESS');
    if (bad) out.push({ name, conclusion: bad });
  }
  return out;
}

// The checks of merged pull request `number` that are not green, against the checks `base` requires: { checks } | { error }.
// A rollup answer with no list is an error, never "absent".
export function forcedChecks(gh, number, base) {
  const required = requiredChecks(gh, base);
  if (required.error) return { error: required.error };
  const r = gh(['pr', 'view', String(number), '--json', 'statusCheckRollup']);
  if (r.status !== 0) return { error: ghError(r) };
  let json;
  try { json = JSON.parse(r.stdout); } catch { return { error: `gh pr view ${number} returned unreadable JSON` }; }
  if (!Array.isArray(json?.statusCheckRollup)) return { error: `gh pr view ${number} returned no statusCheckRollup` };
  return { checks: notGreen(json.statusCheckRollup, required.contexts) };
}

// The gate files of change `id` at the merged head `head` that hold no passing verdict current there: { gates: [{ file, why }] } |
// { error }, read through GitHub so the answer is the same from every checkout and after a squash merge. The evidence first, then the
// required reviewers in order, then any other reviewer file. A recorded `Commit:` is current when it is `head` (or `head` starts with
// it) or when a compare of it to `head` is ahead or identical and lists no file its reader's rule rejects; the compare is read once per
// sha. A read that fails with anything but a 404, an answer of an unexpected shape and unreadable JSON end the read as an error.
// For a change with a release note in a project that names `devkit.release_tag`, a path the reader's rule refuses still leaves a passed
// evidence and an approved review with no undisposed finding current when its two texts, at the recorded commit and at the head, read
// through GitHub, are equal once the release lines are masked (forced-merge-release-edit D-1, the rule of ADR 0034 decision 5).
export function gatesAtHead(gh, id, head) {
  const short = head.slice(0, 7);
  const dir = `openspec/changes/${id}`;
  const compares = new Map();
  const gates = [];
  const textOf = (got, path) => (typeof got.json?.content === 'string'
    ? { text: Buffer.from(got.json.content, 'base64').toString('utf8') }
    : { error: `${path} at ${short} has no content` });
  // The reader `releaseOnlyEdit` takes, over GitHub contents and memoized per revision and path (D-2). The first failed read is kept in
  // `readError`: `behind` ends the whole read with it, so a failure is never read as "current" and never as "not forced".
  const reads = new Map();
  let readError = null;
  const contents = (rev, path) => {
    const key = `${rev}\0${path}`;
    if (!reads.has(key)) reads.set(key, readContents(gh, path, rev));
    const got = reads.get(key);
    if (got.error) readError ??= got.error;
    return got;
  };
  const github = {
    file(rev, path) {
      const got = contents(rev, path);
      if (got.error || got.notFound) return null;
      if (typeof got.json?.content === 'string') return Buffer.from(got.json.content, 'base64').toString('utf8');
      readError ??= `${path} at ${rev.slice(0, 7)} has no content`;
      return null;
    },
    dir(rev, path) {
      const got = contents(rev, path);
      return !got.error && !got.notFound && Array.isArray(got.json) ? got.json.map((e) => e?.name).filter((n) => typeof n === 'string') : [];
    },
  };
  // The context of the release-edit rule, read once per call when a refused file first meets an exempt verdict (D-3): null when the change
  // has no release note, the project names no `devkit.release_tag` or a read failed (then `readError` is set).
  let releaseCtx;
  const releaseAllowance = () => {
    if (releaseCtx !== undefined) return releaseCtx;
    releaseCtx = null;
    const note = contents(head, `${dir}/release.md`);
    if (!note.notFound && !note.error) {
      const config = github.file(head, CONFIG);
      const { file } = config === null ? { file: null } : releaseTagSetting(parseDevkitBlock(config));
      if (file && !readError) releaseCtx = releaseContext(null, file, github);
    }
    return releaseCtx;
  };
  // Why `recorded` is not current at `head`: { why } (null when it is) | { error }. `exempt` is true for a verdict that gets the
  // release-edit rule on the delivery path (a passed evidence, an approved review with no undisposed finding); a refused file of such a
  // verdict is current when `releaseOnlyEdit` accepts it between the compare's base and the head (forced-merge-release-edit D-1).
  const behind = (recorded, allowed, exempt) => {
    if (!recorded) return { why: 'no Commit: line' };
    const sha = recorded.sha.slice(0, 7);
    if (recorded.uncommitted) return { why: `${sha} was recorded with uncommitted changes` };
    if (head.startsWith(recorded.sha)) return { why: null };
    if (!compares.has(recorded.sha)) compares.set(recorded.sha, ghJson(gh, `compare/${recorded.sha}...${head}`));
    const compare = compares.get(recorded.sha);
    if (compare.notFound) return { why: `${sha} does not resolve to a commit` };
    if (compare.error) return { error: compare.error };
    const { status, files } = compare.json ?? {};
    if (status !== 'ahead' && status !== 'identical') return { why: `${sha} is not an ancestor of the merged head` };
    if (!Array.isArray(files)) return { error: `compare ${sha}...${short} has no file list` };
    if (files.length >= 300) return { why: `${sha} is too far behind the merged head to read` };
    const recordedRev = isSha(compare.json?.base_commit?.sha) ? compare.json.base_commit.sha : recorded.sha;
    for (const file of files.map((f) => f?.filename).filter((f) => typeof f === 'string' && !allowed(f))) {
      const ctx = exempt ? releaseAllowance() : null;
      const release = ctx ? releaseOnlyEdit(null, recordedRev, head, file, ctx) : false;
      if (readError) return { error: readError };
      if (!release) return { why: `${sha} is behind the merged head, which changes ${file}` };
    }
    return { why: null };
  };
  const add = (file, why) => { if (why) gates.push({ file, why }); };

  const evidence = readContents(gh, `${dir}/evidence.md`, head);
  if (evidence.error) return { error: evidence.error };
  if (evidence.notFound) add('evidence.md', 'missing');
  else {
    const read = textOf(evidence, `${dir}/evidence.md`);
    if (read.error) return { error: read.error };
    const header = parseStageHeader(read.text);
    if (!header || header.malformed) add('evidence.md', 'no stage header');
    else if (header.result !== 'passed') add('evidence.md', `result ${header.result}`);
    else {
      const current = behind(parseCommitLine(read.text), isOpenspec, true);
      if (current.error) return { error: current.error };
      add('evidence.md', current.why);
    }
  }

  const folder = readContents(gh, `${dir}/reviews`, head);
  if (folder.error) return { error: folder.error };
  let present = [];
  if (!folder.notFound) {
    if (!Array.isArray(folder.json)) return { error: `${dir}/reviews at ${short} is not a folder` };
    present = folder.json.map((e) => e?.name).filter((n) => typeof n === 'string' && n.endsWith('.md')).map((n) => n.slice(0, -3)).sort();
  }
  for (const name of [...REQUIRED_REVIEWERS, ...present.filter((n) => !REQUIRED_REVIEWERS.includes(n))]) {
    const file = `reviews/${name}.md`;
    if (!present.includes(name)) { add(file, 'missing'); continue; }
    const got = readContents(gh, `${dir}/${file}`, head);
    if (got.error) return { error: got.error };
    if (got.notFound) { add(file, 'missing'); continue; }
    const read = textOf(got, `${dir}/${file}`);
    if (read.error) return { error: read.error };
    const verdict = valueIn(read.text, 'Verdict');
    if (verdict === null) add(file, 'no verdict line');
    else if (!approved(verdict)) add(file, `verdict ${verdict}`);
    else {
      // The same currency rule as readReviews: an approved verdict that lists an undisposed finding is current only through
      // commits of the change's own review record. A "fixed in <sha>" counts when the sha is in the merged head's history.
      let historyError = null;
      const inHead = (sha) => {
        if (head.startsWith(sha)) return true;
        const compare = ghJson(gh, `compare/${sha}...${head}`);
        if (compare.error && !compare.notFound) historyError ??= compare.error;
        return !compare.error && (compare.json?.status === 'ahead' || compare.json?.status === 'identical');
      };
      const open = findingsOfText(name, read.text, inHead).undisposed.length > 0;
      if (historyError) return { error: historyError };
      const current = behind(parseCommitLine(read.text), verdictAllowed(id, name, verdict, open), !open);
      if (current.error) return { error: current.error };
      add(file, current.why);
    }
  }
  return { gates };
}

// Whether merged pull request `pr` of change `id` was an owner's forced merge, and what it left open (forced-merge-path D-3): the
// one place that combines the checks and the gate files. { forced: null } when every required check is green (no gate file is read) |
// { forced: { number, url, head, items, count } } | { error }. `items` are the unticked tasks, the checks that are not green, then
// the gate files, each with the `text` the answers and the retro name it by.
export function forcedMerge(gh, id, pr, { base, unticked }) {
  const checks = forcedChecks(gh, pr.number, base);
  if (checks.error) return { error: checks.error };
  if (checks.checks.length === 0) return { forced: null };
  const gates = gatesAtHead(gh, id, pr.headRefOid);
  if (gates.error) return { error: gates.error };
  const items = [
    ...unticked.map((taskId) => ({ kind: 'task', id: taskId, text: `task ${taskId}` })),
    ...checks.checks.map(({ name, conclusion }) => ({ kind: 'check', name, conclusion, text: `${name} (${conclusion})` })),
    ...gates.gates.map(({ file, why }) => ({ kind: 'gate', file, why, text: `${file} (${why})` })),
  ];
  return { forced: { number: pr.number, url: pr.url, head: pr.headRefOid, items, count: items.length } };
}

// What the delivery of change `id` is (field-fixes D-4): its PR as findChangePr answers it, and whether the
// change is delivered: archived, or its own PR merged with every task ticked on the default branch. In a train project (`trainSuite`
// set) a merged train that lists the change at its PR's head delivers it too, whatever state GitHub gives that PR (delivery-train D-2).
// A merged own PR with tasks left and a required check not green is an owner's forced merge (forced-merge-path D-4): `forced` carries what
// it left open and `fetched` is that merged PR. A forced or commit read that fails is `unreadMerge`, with `fetched` the error.
// { fetched, delivered, merged, left: [ids], absent, repo, error, carried, trainFacts, forced, unreadMerge }.
export function deliveryOf(gh, root, id, { ship = 'plan', branch = '', env = process.env, located = null, number = null, base = null, mergeFields = ship === 'merge', trainSuite = null } = {}) {
  let fetched = findChangePr(gh, root, id, { ship, branch, env, number, base, mergeFields });
  const archived = Boolean(located?.archived);
  const mergedPr = fetched.pr?.state === 'MERGED';
  const merged = mergedPr || fetched.mergedBefore != null;
  // The train facts at the PR's head, read once: a read that fails is the train row's to report (nextStep), never this one's.
  const facts = trainSuite !== null && !archived && ship !== 'plan' && fetched.pr?.headRefOid
    ? trainFacts(gh, root, id, { suite: trainSuite, prHead: fetched.pr.headRefOid, kind: 'change' })
    : null;
  const carried = facts?.carried ?? null;
  let tasks = fetched.tasks ?? null;
  if ((mergedPr || carried) && !archived && ship !== 'plan' && !tasks) tasks = defaultTasks(gh, id);
  if (tasks?.error) fetched = { error: tasks.error };
  const left = tasks?.unticked ?? [];
  const delivered = archived || (ship !== 'plan' && (mergedPr || carried !== null) && Boolean(tasks) && !tasks.error && !tasks.absent && left.length === 0);
  let forced = null;
  let unreadMerge = fetched.arm === 'commit' ? { number: null, error: fetched.error } : null;
  const mergedOwn = fetched.pr?.state === 'MERGED' ? fetched.pr : (fetched.merged ?? null);
  if (ship !== 'plan' && !archived && left.length > 0 && carried === null && mergedOwn) {
    const read = forcedMerge(gh, id, mergedOwn, { base: base ?? tasks.repo?.settings?.default_branch, unticked: left });
    if (read.error) {
      unreadMerge = { number: mergedOwn.number, error: read.error };
      fetched = { error: read.error };
    } else if (read.forced) {
      forced = read.forced;
      fetched = { pr: mergedOwn, via: fetched.via ?? 'branch', tasks };
    }
  }
  return {
    fetched,
    delivered,
    merged,
    left,
    absent: Boolean(tasks?.absent),
    repo: tasks?.repo ?? null,
    error: fetched.error ?? null,
    forced,
    unreadMerge,
    carried: delivered ? carried : null,
    trainFacts: facts,
  };
}

// ---------------------------------------------------------------- the delivery train (ADR 0022, delivery-train D-2, D-4)

// The train branch's name, and the whole-suite command split into its `&&` parts, trimmed.
export const TRAIN_BRANCH = /^train\/(\d+)$/;
export const trainParts = (suite) => String(suite ?? '').split('&&').map((c) => c.trim()).filter(Boolean);

const HEX40 = /^[0-9a-f]{40}$/;
const TRAIN_HEADER = /^<!--\s*devkit-train\s+n=(\d+)\s+base=(\S+)\s+result=(\S+)\s*-->\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const inBackticks = (text) => (/^`+([\s\S]*?)`+$/.exec(String(text).trim())?.[1] ?? String(text).trim());
const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

// The record of a train (`openspec/trains/<n>.md`, D-4) as { n, base, result, baseSha, suite, ranAt, boarded: [{ order, kind,
// id, number, head, at }], left: [{ kind, id, number, head, why, detail, failure }] }, or { error }. The tables are read outside
// fenced blocks only; `failure` is the fenced block under `## Failure of `<id>``, or null.
export function parseTrainRecord(text) {
  const src = String(text ?? '');
  if (!src.trim()) return { error: 'the train record is empty' };
  const lines = src.split(/\r?\n/);
  const header = TRAIN_HEADER.exec(lines[0]);
  if (!header) return { error: 'the train record does not start with the <!-- devkit-train n=<n> base=<base> result=<result> --> line' };
  const fenced = fencedLines(src);
  const opening = lines.findIndex((l, i) => FENCE.test(l) && !fenced.has(i + 1));
  if (opening !== -1) return { error: `a fenced block opens at line ${opening + 1} of the train record and never closes` };

  const sections = [];
  const facts = {};
  const failures = {};
  for (let i = 1; i < lines.length; i++) {
    if (fenced.has(i + 1)) continue;
    const heading = /^##\s+(.*?)\s*$/.exec(lines[i]);
    if (heading) {
      sections.push({ title: heading[1], rows: [] });
      const failed = /^Failure of `(.+)`$/.exec(heading[1]);
      if (failed) {
        const from = lines.findIndex((l, k) => k > i && FENCE.test(l));
        const close = from === -1 ? -1 : lines.findIndex((l, k) => k > from && fenced.has(k + 1) && FENCE.test(l) && FENCE.exec(l)[1][0] === FENCE.exec(lines[from])[1][0] && FENCE.exec(l)[1].length >= FENCE.exec(lines[from])[1].length);
        if (from !== -1 && close !== -1) failures[failed[1]] = lines.slice(from + 1, close).join('\n');
      }
      continue;
    }
    if (lines[i].trim().startsWith('|') && sections.length) sections.at(-1).rows.push(cellsOf(lines[i]));
    const fact = /^-\s+(Base|Suite|Ran at):\s*(.*)$/.exec(lines[i]);
    if (fact) facts[fact[1]] = fact[2];
  }
  const rowsOf = (title) => (sections.find((sec) => sec.title === title)?.rows ?? []).slice(1).filter((cells) => !cells.every((c) => /^:?-{3,}:?$/.test(c)));

  const boardedRows = rowsOf('Boarded');
  if (boardedRows.length === 0) return { error: 'the train record has no Boarded table, or an empty one' };
  const boarded = [];
  for (const [i, cells] of boardedRows.entries()) {
    const [order, kind, id, number, head, at] = cells;
    if (cells.length !== 6) return { error: `Boarded row ${i + 1} of the train record has ${cells.length} cells, not 6` };
    if (!['change', 'archive'].includes(kind)) return { error: `Boarded row ${i + 1}: the kind "${kind}" is not change or archive` };
    if (!HEX40.test(inBackticks(head))) return { error: `Boarded row ${i + 1}: the head "${head}" is not 40 hex characters` };
    boarded.push({ order: Number(order), kind, id: inBackticks(id), number: Number(String(number).replace(/^#/, '')), head: inBackticks(head), at });
  }
  if (!boarded.every((b, i) => b.order === i + 1)) return { error: `the order of the Boarded table is ${boarded.map((b) => b.order).join(', ')}, not 1 to ${boarded.length}` };

  const left = [];
  for (const [i, cells] of rowsOf('Left').entries()) {
    const [kind, id, number, head, why, detail] = cells;
    if (cells.length !== 6) return { error: `Left row ${i + 1} of the train record has ${cells.length} cells, not 6` };
    if (!['change', 'archive'].includes(kind)) return { error: `Left row ${i + 1}: the kind "${kind}" is not change or archive` };
    if (!HEX40.test(inBackticks(head))) return { error: `Left row ${i + 1}: the head "${head}" is not 40 hex characters` };
    if (!['conflict', 'red'].includes(why)) return { error: `Left row ${i + 1}: the why "${why}" is not conflict or red` };
    left.push({ kind, id: inBackticks(id), number: Number(String(number).replace(/^#/, '')), head: inBackticks(head), why, detail, failure: failures[inBackticks(id)] ?? null });
  }
  return {
    n: Number(header[1]), base: header[2], result: header[3],
    baseSha: /`([0-9a-f]{40})`\s*$/.exec(facts.Base ?? '')?.[1] ?? null,
    suite: facts.Suite === undefined ? null : inBackticks(facts.Suite),
    ranAt: facts['Ran at'] === undefined ? null : inBackticks(facts['Ran at']),
    boarded, left,
  };
}

// The train facts of a change or an archive (`kind`) whose pull request has the head `prHead` (D-2): the five newest pull
// requests with a `train/<n>` head, each with its record read at its head, and where this entry stands in them. Without a pull
// request head nothing is read. { suite, parts, kind, records, onTrain, carried, left } or the same with `error` when GitHub
// did not answer. A record that is missing or does not parse lists nobody. `onTrain` is an open train that boards it at
// `prHead`, `carried` a merged one, `left` the newest train that lists it as left at `prHead`.
export function trainFacts(gh, root, id, { suite, prHead = null, kind = 'change' }) {
  const out = { suite, parts: trainParts(suite), kind, records: [], onTrain: null, carried: null, left: null };
  if (!prHead) return out;
  const l = gh(['pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number,url,state,headRefName,headRefOid,mergedAt,mergeCommit']);
  if (l.status !== 0) return { ...out, error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { ...out, error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { ...out, error: 'gh pr list returned unreadable JSON' };
  const trains = list.map((pr) => ({ pr, n: Number(TRAIN_BRANCH.exec(pr.headRefName ?? '')?.[1]) })).filter((t) => Number.isInteger(t.n)).sort((a, b) => b.n - a.n).slice(0, 5);
  for (const { pr, n } of trains) {
    const got = readContents(gh, `openspec/trains/${n}.md`, pr.headRefOid);
    if (got.error) return { ...out, error: got.error };
    if (got.notFound || typeof got.json?.content !== 'string') continue;
    const record = parseTrainRecord(Buffer.from(got.json.content, 'base64').toString('utf8'));
    if (record.error) continue;
    out.records.push({ n, number: pr.number, url: pr.url, state: pr.state, mergeCommit: pr.mergeCommit?.oid ?? null, record });
  }
  const mine = (e) => e.kind === kind && e.id === id && e.head === prHead;
  for (const r of out.records) {
    if (r.state === 'OPEN' && !out.onTrain && r.record.boarded.some(mine)) out.onTrain = { n: r.n, number: r.number, url: r.url };
    if (r.state === 'MERGED' && !out.carried && r.record.boarded.some(mine)) out.carried = { n: r.n, number: r.number, mergeCommit: r.mergeCommit };
    const gone = r.record.left.find(mine);
    if (gone && !out.left) out.left = { n: r.n, number: r.number, state: r.state, why: gone.why, detail: gone.detail, failure: gone.failure };
  }
  return out;
}

// The paths a left entry's `detail` names (a conflict's, each in backticks).
const pathsOfDetail = (detail) => [...String(detail ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);

// ---------------------------------------------------------------- the two-pull-request delivery (delivery-models D-4)

const TEST_PR_FIELDS = 'number,url,state,headRefName,headRefOid,mergeable,mergedAt,body';

// The pull request to the test branch for change `id`, found by its head: the support branch `<head>-<test>` and the task
// branch `<head>` (`head` is the id unless CI names the head branch). An open one from the support branch, else an open one
// from the task branch, else the newest merged one, else the newest closed one, else none. An open one carries the items the
// base pull request has: { pr, checks, body } | { pr } (merged or closed) | { none: true } | { error }.
export function findTestPr(gh, { id, testBranch, head = id, acIds = [] }) {
  const lists = [];
  for (const h of [`${head}-${testBranch}`, head]) {
    const l = gh(['pr', 'list', '--base', testBranch, '--head', h, '--state', 'all', '--limit', '10', '--json', TEST_PR_FIELDS]);
    if (l.status !== 0) return { error: ghError(l) };
    let list;
    try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
    if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
    lists.push(list);
  }
  const open = lists.map((list) => list.find((p) => p.state === 'OPEN')).find(Boolean);
  if (open) return { pr: open, checks: checksItem({ pr: open }, gh), body: bodyItem(id, { pr: open }, acIds) };
  const newest = (state) => lists.flat().filter((p) => p.state === state).sort((a, b) => when(b.mergedAt) - when(a.mergedAt) || b.number - a.number)[0];
  const pr = newest('MERGED') ?? newest('CLOSED');
  return pr ? { pr } : { none: true };
}

// The first commit of `head` (not on origin/<base>) that is on the first-parent line of origin/<test> (not on origin/<base>), or
// null (D-7). That line holds every tip the test branch ever had, so a merge, a pull or a rebase of the test branch into the
// task branch puts one of them in it; the task branch's own commits reach the test branch only through a merge's second parent
// or as new commits, never on that line. Unreadable refs are no commit: { sha, subject } | null.
export function testBranchCommit(root, { base, testBranch, head }) {
  try {
    const lines = (args) => git(root, ['rev-list', ...args]).split('\n').filter(Boolean);
    const onTest = new Set(lines(['--first-parent', `origin/${testBranch}`, `^origin/${base}`]));
    const sha = lines([head, `^origin/${base}`]).find((c) => onTest.has(c));
    return sha ? { sha, subject: git(root, ['log', '-1', '--format=%s', sha]).trim() } : null;
  } catch { return null; }
}

// The support branch of the change (D-4, D-8): { branch, exists, worktree | null, path, merging | null, head, hasTask, hasTest,
// pushed }. `merging` lists the conflicted paths while its worktree holds an unfinished merge; `hasTask` is the task branch being
// an ancestor of the support head, `hasTest` the remote-tracking test branch being one, `pushed` the remote-tracking support
// branch being the head. Reads local refs only.
export function supportState(root, id, testBranch) {
  const branch = `${id}-${testBranch}`;
  const rev = (ref) => { try { return git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim() || null; } catch { return null; } };
  const head = rev(`refs/heads/${branch}`);
  const worktree = listWorktrees(root).find((w) => w.branch === branch)?.path ?? null;
  const path = worktree ?? join(mainCheckout(root) ?? root, '.claude', 'worktrees', branch);
  const state = { branch, exists: head !== null, worktree, path, merging: null, head, hasTask: false, hasTest: false, pushed: false };
  if (!head) return state;
  const within = (ref) => ref !== null && gitOk(root, ['merge-base', '--is-ancestor', ref, head]);
  if (worktree && gitOk(worktree, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'])) {
    state.merging = git(worktree, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
  }
  state.hasTask = within(rev(`refs/heads/${id}`) ?? rev('HEAD'));
  state.hasTest = within(rev(`refs/remotes/origin/${testBranch}`));
  state.pushed = rev(`refs/remotes/origin/${branch}`) === head;
  return state;
}

// Git's automatic merge of two commits as a tree (conflict markers included), or null when it cannot be computed.
function autoMergeTree(root, a, b) {
  const r = spawnSync('git', ['-C', root, 'merge-tree', '--write-tree', a, b], { encoding: 'utf8' });
  const tree = (r.stdout ?? '').split('\n')[0].trim();
  return (r.status === 0 || r.status === 1) && /^[0-9a-f]{40,64}$/.test(tree) ? tree : null;
}

// The support branch's own work (D-8): each first-parent merge of `<task>..<support>` whose commit differs from Git's automatic merge
// (the resolution), and each commit that is not a merge (a fix), newest first: [{ sha, subject, diff }], `diff` the command that
// prints it. What the test branch brought and a clean merge are not here.
function ownCommits(root, taskRef, supportRef) {
  const shas = git(root, ['rev-list', '--first-parent', `${taskRef}..${supportRef}`]).split('\n').filter(Boolean);
  const own = [];
  for (const sha of shas) {
    const [subject = '', parents = ''] = git(root, ['log', '-1', '--format=%s%n%P', sha]).split('\n');
    const [first, second] = parents.split(' ').filter(Boolean);
    if (!second) { own.push({ sha, subject, diff: `git diff ${sha}^ ${sha}` }); continue; }
    const tree = autoMergeTree(root, first, second);
    if (!tree) { own.push({ sha, subject, diff: `git diff ${first} ${sha}` }); continue; }
    if (git(root, ['diff', '--name-only', tree, sha]).trim()) own.push({ sha, subject, diff: `git diff ${tree} ${sha}` });
  }
  return own;
}

// The resolution round of the support branch (D-8): { commits (own, newest first), newest, verdicts, missing, stale, rejected,
// undisposed, round, approved } read from reviews/resolution/ of change `id` in `root`. Approved when there is no own commit, or both
// required verdicts are approved at the newest one with nothing undisposed. Refs that cannot be read give { error } and no approval.
export function resolutionState(root, id, { taskRef, supportRef }) {
  const none = { commits: [], newest: null, verdicts: [], missing: [], stale: [], rejected: [], undisposed: [], round: null, approved: true };
  if (!supportRef) return none;
  let commits;
  let head;
  try {
    commits = ownCommits(root, taskRef, supportRef);
    head = git(root, ['rev-parse', supportRef]).trim();
  } catch { return { ...none, approved: false, error: `cannot read the commits of ${supportRef} since ${taskRef}` }; }
  const round = readReviewMd(join(changeDir(root, id), 'resolution.md'));
  if (!commits.length) return { ...none, round };
  const dir = join(changeDir(root, id), 'reviews', 'resolution');
  const verdicts = verdictFiles(dir);
  const newest = commits[0].sha;
  const current = (v) => Boolean(v.commit) && !v.commit.uncommitted && newest.startsWith(v.commit.sha);
  const missing = REQUIRED_REVIEWERS.filter((r) => !verdicts.some((v) => v.name === r));
  const stale = verdicts.filter((v) => !current(v)).map((v) => v.name);
  const rejected = verdicts.filter((v) => current(v) && v.verdict !== 'APPROVED' && v.verdict !== 'DECLINED').map((v) => v.name);
  const undisposed = findingsIn(root, dir, head).undisposed;
  const approved = !missing.length && !stale.length && !rejected.length && !undisposed.length;
  return { commits, newest, verdicts, missing, stale, rejected, undisposed, round, approved };
}

// The `devkit-reviews` runs of the base pull request that failed before the test-branch pull request merged: the check reads
// the test branch's state when it runs, so such a run is run again (T17). One `gh run view` per failing run, made only here.
function reviewsRerun(gh, checks, test) {
  if (test.pr?.state !== 'MERGED') return null;
  const runs = [];
  for (const f of checks.details.failing.filter((c) => c.name === DEVKIT_REVIEWS_CHECK)) {
    const id = /\/actions\/runs\/(\d+)/.exec(f.link ?? '')?.[1];
    if (!id || runs.includes(id)) continue;
    const r = gh(['run', 'view', id, '--json', 'startedAt']);
    let startedAt = null;
    try { startedAt = JSON.parse(r.stdout).startedAt; } catch { /* unreadable: not run again */ }
    if (r.status === 0 && startedAt && when(startedAt) < when(test.pr.mergedAt)) runs.push(id);
  }
  return runs.length ? { runs } : null;
}

// Paths git sees as changed (tracked or untracked) under a pathspec.
function changedUnder(root, pathspec) {
  const entries = git(root, ['status', '--porcelain', '-z', '-uall', '--', pathspec]).split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    paths.push(entries[i].slice(3));
    if (/[RC]/.test(entries[i].slice(0, 2))) i++;
  }
  return paths;
}

// Item 5: the PR is open and its head is the local head.
// In merge mode (`merge: true`) a PR merged at the local head is met and a PR
// that fell behind its base is open with details.behind.
export function prItem(root, id, fetched, facts = gitFacts(root), { merge = false } = {}) {
  const name = 'pr';
  if (fetched.error) return item(5, name, 'blocked', `cannot read the PR: ${fetched.error}`, {});
  if (fetched.none) return item(5, name, 'open', NO_PR, { none: true });
  const pr = fetched.pr;
  const ref = { number: pr.number, url: pr.url };
  if (merge && pr.state === 'MERGED') {
    // Met at the local head, or on a branch advanced into the base that holds the pull request's head (D-21): such a head
    // holds no commit of its own, so a merge loses nothing.
    const advanced = headInBase(root, facts) && gitOk(root, ['merge-base', '--is-ancestor', String(pr.headRefOid), 'HEAD']);
    if (pr.headRefOid === facts.head || advanced) return item(5, name, 'met', `PR #${pr.number} merged`, { pr: ref, merged: true });
    return item(5, name, 'blocked', `PR #${pr.number} merged at ${String(pr.headRefOid).slice(0, 7)}; local head ${String(facts.head).slice(0, 7)} differs`, { pr: ref });
  }
  if (pr.state !== 'OPEN') return item(5, name, 'blocked', `PR #${pr.number} is ${String(pr.state).toLowerCase()}`, { pr: ref });
  if (pr.mergeable === 'CONFLICTING') return item(5, name, 'blocked', `PR #${pr.number} has merge conflicts with ${pr.baseRefName}`, { pr: ref, conflict: true });
  const details = { pr: ref, ahead: false, uncommitted: [] };
  if (merge) details.behind = pr.mergeStateStatus === 'BEHIND';
  const reasons = [];
  if (pr.headRefOid !== facts.head) {
    if (!facts.head || !inHistory(root, pr.headRefOid, facts.head)) {
      return item(5, name, 'blocked', `PR head ${String(pr.headRefOid).slice(0, 7)} is not in local history (someone else pushed?)`, details);
    }
    details.ahead = true;
    reasons.push(`local is ahead of PR head ${pr.headRefOid.slice(0, 7)}; push`);
  }
  details.uncommitted = changedUnder(root, `openspec/changes/${id}`);
  if (details.uncommitted.length) reasons.push(`uncommitted files in the change folder: ${details.uncommitted.join(', ')}`);
  if (details.behind) reasons.push(`branch is behind ${pr.baseRefName}; update it`);
  if (reasons.length) return item(5, name, 'open', reasons.join('; '), details);
  return item(5, name, 'met', `PR #${pr.number} open at ${facts.head.slice(0, 7)}`, details);
}

// gh names the first option it does not know, and the call passes --required before --json.
const OLD_GH = /unknown flag: --(json|required)\b/;

// Checks of a PR: { checks: [...] } | { none: 'required' | 'any' } | { tooOld: { installed, minimum } } | { error }.
// gh prints the JSON list with exit 8 (pending) and exit 1 (a failure), so the
// list wins over the exit code when it parses.
function readChecks(gh, number, required) {
  const r = gh(['pr', 'checks', String(number), ...(required ? ['--required'] : []), '--json', 'name,state,bucket,link']);
  try {
    const list = JSON.parse(r.stdout);
    if (Array.isArray(list)) return { checks: list };
  } catch { /* not JSON: look at the error */ }
  if (r.status !== 0 && !r.missing && !r.timedOut && !r.overflowed && OLD_GH.test(r.stderr)) {
    const v = ghVersion(gh);
    return { tooOld: { installed: v.installed, minimum: GH_MIN_VERSION } };
  }
  if (!r.missing && /no required checks reported/i.test(r.stderr)) return { none: 'required' };
  if (!r.missing && /no checks reported/i.test(r.stderr)) return { none: 'any' };
  return { error: r.status === 0 ? 'gh pr checks returned unreadable output' : ghError(r) };
}

// Item 6: the required checks (else all checks) are green on the PR head.
export function checksItem(fetched, gh) {
  const name = 'checks';
  if (fetched.error) return item(6, name, 'blocked', `cannot read the PR: ${fetched.error}`, {});
  if (fetched.none) return item(6, name, 'open', NO_PR, {});
  const number = fetched.pr.number;
  let required = true;
  let got = readChecks(gh, number, true);
  if (got.none === 'required' || got.checks?.length === 0) {
    required = false;
    got = readChecks(gh, number, false);
  }
  const details = { required, failing: [], pending: [] };
  if (got.error) return item(6, name, 'blocked', `cannot read the checks: ${got.error}`, details);
  if (got.tooOld) {
    const { installed, minimum } = got.tooOld;
    return item(6, name, 'blocked', `cannot read the checks: gh pr checks --json needs gh ${minimum} or newer and the installed gh is ${installed ?? 'of an unknown version'}; update gh`, { ...details, ghTooOld: got.tooOld });
  }
  if (got.none || got.checks.length === 0) return item(6, name, 'met', 'no checks reported on the PR', details);
  const unknown = [];
  for (const c of got.checks) {
    if (c.bucket === 'pass' || c.bucket === 'skipping') continue;
    if (c.bucket === 'fail' || c.bucket === 'cancel') details.failing.push({ name: c.name, link: c.link });
    else if (c.bucket === 'pending') details.pending.push(c.name);
    else unknown.push(`${c.name} (${c.bucket})`);
  }
  if (unknown.length) return item(6, name, 'blocked', `unrecognised check state: ${unknown.join(', ')}`, details);
  const reasons = [
    details.failing.length ? `failing ${details.failing.map((f) => `${f.name} (${f.link})`).join(', ')}` : '',
    details.pending.length ? `pending ${details.pending.join(', ')}` : '',
  ].filter(Boolean);
  if (reasons.length) return item(6, name, 'open', reasons.join('; '), details);
  return item(6, name, 'met', `${got.checks.length} ${required ? 'required ' : ''}checks green`, details);
}

const CONVERSATION_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        pageInfo { hasNextPage }
        nodes { isResolved comments(last: 1) { nodes { author { __typename login } authorAssociation createdAt url } } }
      }
      comments(last: 100) { nodes { author { __typename login } authorAssociation createdAt url } }
      reviews(last: 100) { nodes { author { __typename login } authorAssociation state body submittedAt } }
    }
  }
}`;

const when = (iso) => Date.parse(iso) || 0;
const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

// Item 7: every review thread and outstanding "changes requested" answered or
// resolved; people's top-level comments and review bodies answered. A bot's
// top-level comments and review bodies (CI, coverage and deploy summaries)
// ask nothing and are ignored; its review threads and CHANGES_REQUESTED count.
// A person counts only when GitHub says they are the repo's OWNER, MEMBER or
// COLLABORATOR: anyone else's words are not instructions for the agent.
export function conversationItem(fetched, gh) {
  const name = 'conversation';
  if (fetched.error) return item(7, name, 'blocked', `cannot read the PR: ${fetched.error}`, {});
  if (fetched.none) return item(7, name, 'open', NO_PR, {});
  const r = gh(['api', 'graphql', '-F', 'owner={owner}', '-F', 'name={repo}', '-F', `number=${fetched.pr.number}`, '-f', `query=${CONVERSATION_QUERY}`]);
  let data;
  try { data = JSON.parse(r.stdout).data; } catch { data = null; }
  const prData = data?.repository?.pullRequest;
  if (r.status !== 0 || !prData || !data.viewer) {
    return item(7, name, 'blocked', `cannot read the conversation: ${r.status === 0 ? 'unreadable GraphQL answer' : ghError(r)}`, {});
  }
  const viewer = data.viewer.login;
  const details = { threads: [], comments: [], changesRequested: [], waiting: [] };
  if (prData.reviewThreads.pageInfo?.hasNextPage) {
    return item(7, name, 'blocked', 'more than 100 review threads; cannot tell which are answered', details);
  }
  const mine = (a) => a?.login === viewer;
  const trusted = (n) => TRUSTED_ASSOCIATIONS.includes(n.authorAssociation);
  const bots = (n) => n.author?.__typename === 'Bot';
  const person = (n) => !bots(n) && trusted(n);
  const threads = prData.reviewThreads.nodes || [];
  const comments = prData.comments.nodes || [];
  const reviews = prData.reviews.nodes || [];
  const lastOf = (t) => (t.comments.nodes || []).at(-1);

  // The viewer's latest top-level comment or review (thread replies answer
  // their own thread, not the conversation).
  const spoke = [
    ...comments.filter((c) => mine(c.author)).map((c) => when(c.createdAt)),
    ...reviews.filter((v) => mine(v.author)).map((v) => when(v.submittedAt)),
  ];
  const latest = spoke.length ? Math.max(...spoke) : -Infinity;

  for (const t of threads) {
    const last = lastOf(t);
    if (last && !t.isResolved && !mine(last.author) && (bots(last) || trusted(last))) details.threads.push(last?.url || '(thread)');
  }
  for (const c of comments) {
    if (person(c) && !mine(c.author) && when(c.createdAt) > latest) details.comments.push(c.url || `comment by ${c.author?.login}`);
  }
  for (const v of reviews) {
    if (person(v) && !mine(v.author) && (v.body || '').trim() && when(v.submittedAt) > latest) {
      details.comments.push(`review by ${v.author?.login}`);
    }
  }
  const stance = new Map();
  for (const v of [...reviews].sort((a, b) => when(a.submittedAt) - when(b.submittedAt))) {
    if (!v.author || mine(v.author) || !(bots(v) || trusted(v))) continue;
    if (['CHANGES_REQUESTED', 'APPROVED', 'DISMISSED'].includes(v.state)) stance.set(v.author.login, v);
  }
  for (const [login, v] of stance) {
    if (v.state !== 'CHANGES_REQUESTED') continue;
    (when(v.submittedAt) > latest ? details.changesRequested : details.waiting).push(login);
  }

  const open = [
    details.threads.length ? `unanswered threads: ${details.threads.join(', ')}` : '',
    details.comments.length ? `unanswered comments: ${details.comments.join(', ')}` : '',
    details.changesRequested.length ? `changes requested by ${details.changesRequested.join(', ')}` : '',
  ].filter(Boolean);
  if (details.waiting.length) {
    return item(7, name, 'blocked', [`replied, waiting on ${details.waiting.join(', ')} to re-review`, ...open].join('; '), details);
  }
  if (open.length) return item(7, name, 'open', open.join('; '), details);
  return item(7, name, 'met', 'every thread and request is answered', details);
}

// Item 8: the PR body names the change, every acceptance criterion and the evidence.
export function bodyItem(id, fetched, acIds) {
  const name = 'body';
  if (fetched.error) return item(8, name, 'blocked', `cannot read the PR: ${fetched.error}`, {});
  if (fetched.none) return item(8, name, 'open', NO_PR, {});
  const body = fetched.pr.body || '';
  const link = `openspec/changes/${id}/evidence.md`;
  const missing = [
    ...(body.includes(id) ? [] : [id]),
    ...acIds.filter((ac) => !new RegExp(`\\b${ac}(?!\\d)`).test(body)),
    ...(body.includes(link) ? [] : [link]),
  ];
  if (missing.length) return item(8, name, 'open', `PR body is missing ${missing.join(', ')}`, { missing });
  return item(8, name, 'met', 'PR body names the change, its criteria and the evidence', { missing });
}

// ---------------------------------------------------------------- the archive steps (archive-after-merge D4, D6)

// retro.md (design D6): { exists, readable, proposals: [{ n, targets, kind, answer, applied }] }.
// A proposal is a `### ` heading under `## Proposed updates`; its targets are the
// backticked paths on the heading line, or `user memory`; the kind is the
// trailing parentheses. The last `- Answer:` line (approved | rejected[: why]) and
// the last `- Applied:` line of a block count; any other text is no answer.
export function readRetro(file) {
  if (!existsSync(file)) return { exists: false, readable: false, proposals: [] };
  const proposals = [];
  let inside = false;
  let readable = false;
  let current = null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^##\s+Proposed updates\s*$/i.test(line)) { inside = true; readable = true; current = null; continue; }
    if (/^##\s/.test(line)) { inside = false; current = null; continue; }
    if (!inside) continue;
    const h = line.match(/^###\s+(.*)$/);
    if (h) {
      const heading = h[1];
      const paths = [...heading.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      current = {
        n: proposals.length + 1,
        targets: paths.length ? paths : (/\buser memory\b/i.test(heading) ? ['user memory'] : []),
        kind: heading.match(/\(([^()]*)\)\s*$/)?.[1] ?? '',
        answer: null,
        applied: false,
      };
      proposals.push(current);
      continue;
    }
    if (!current) continue;
    const a = line.match(/^\s*[-*]\s+Answer\s*:\s*(.*?)\s*$/);
    if (a) current.answer = /^approved$/i.test(a[1]) ? 'approved' : /^rejected(?::|$)/i.test(a[1]) ? 'rejected' : null;
    const d = line.match(/^\s*[-*]\s+Applied\s*:\s*(.*?)\s*$/);
    if (d) current.applied = /^yes$/i.test(d[1]);
  }
  return { exists: true, readable, proposals };
}

// Every path git sees as changed in the working tree, tracked or untracked
// (openspec/ included, .claude/ left out).
function changedInTree(root) {
  const entries = git(root, ['status', '--porcelain', '-z', '-uall']).split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const xy = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    if (/[RC]/.test(xy)) paths.push(entries[++i]);
  }
  return paths.filter((p) => !p.startsWith('.claude/'));
}

// A file as it is at `rev`, or null when git cannot show it (absent there, or unreadable).
function textAt(root, rev, path) {
  try {
    return execFileSync('git', ['-C', root, 'show', `${rev}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

// The paths the archive branch changes against origin/<base>, committed or not, and for each pin file
// among them its text at the merge base and in the working tree (null when unreadable):
// { paths, texts } | { missing: true } when origin/<base> does not resolve.
function archiveChanges(root, base) {
  const ref = `origin/${base}`;
  if (!gitOk(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return { missing: true };
  let mergeBase;
  try { mergeBase = git(root, ['merge-base', ref, 'HEAD']).trim(); } catch { return { missing: true }; }
  const committed = git(root, ['diff', '--name-only', '-z', '--no-renames', `${mergeBase}..HEAD`]).split('\0').filter(Boolean);
  const paths = [...new Set([...committed, ...changedInTree(root)])].sort();
  const texts = {};
  for (const path of PIN_LINE_FILES.filter((f) => paths.includes(f))) {
    let after = null;
    try { after = readFileSync(join(root, path), 'utf8'); } catch { after = null; }
    texts[path] = { before: textAt(root, mergeBase, path), after };
  }
  return { paths, texts };
}

// What an archive always changes without a proposal: the change folders (the move) and the
// roadmap tick. Everything else under openspec/ (config.yaml, schemas/) needs a named proposal.
const isArchiveRecord = (p) => p.startsWith('openspec/changes/') || p === 'openspec/roadmap.md';
const normalizePath = (p) => p.replace(/^(\.\/)+/, '');

// ---------------------------------------------------------------- versions and manifests (moved from release-merge.mjs, release-at-merge D-3a)
// A consumer's CI downloads guard.mjs, deliver-check.mjs and merge-setup.mjs only, and the release rules run from them, so the helpers
// the checker and the delivery step share live here; release-merge.mjs imports them and re-exports each under its name.

export class ReleaseError extends Error {
  constructor(message) { super(message); this.name = 'ReleaseError'; }
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
function parseSemver(v) {
  const m = SEMVER.exec(String(v));
  if (!m) throw new ReleaseError(`not a semver version: ${JSON.stringify(v)}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function bumpKind(from, to) {
  const a = parseSemver(from);
  const b = parseSemver(to);
  const i = a.findIndex((n, k) => n !== b[k]);
  return i < 0 ? 'none' : ['major', 'minor', 'patch'][i];
}

export function applyBump(version, kind) {
  const [major, minor, patch] = parseSemver(version);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  return version;
}

// versions: { packs: { <plugin name>: version }, metadata?: version }
export function resolveManifest(baseText, versions) {
  const obj = JSON.parse(baseText);
  const packs = versions.packs ?? {};
  if (typeof obj.name === 'string' && typeof obj.version === 'string' && obj.name in packs) obj.version = packs[obj.name];
  if (obj.metadata && versions.metadata !== undefined) obj.metadata.version = versions.metadata;
  if (Array.isArray(obj.plugins)) for (const p of obj.plugins) if (p && p.name in packs) p.version = packs[p.name];
  return JSON.stringify(obj, null, 2) + (baseText.endsWith('\n') ? '\n' : '');
}

export function withoutVersions(obj) {
  const c = JSON.parse(JSON.stringify(obj));
  delete c.version;
  if (c.metadata) delete c.metadata.version;
  if (Array.isArray(c.plugins)) for (const p of c.plugins) delete p.version;
  return c;
}

// docs/openspec-flow.md pins the CI snippet to the devkit-openspec release (release-rebase-pin design D1-D4).
export const PIN_FILE = 'docs/openspec-flow.md';
export const PIN_PACK = 'plugins/openspec/.claude-plugin/plugin.json';
export const PIN_PACK_NAME = 'devkit-openspec';

// ---- the CI pin lines (archive-release-pin, ADR 0027)
// The pin definition is shared with the conflict resolution of the release tool, which re-exports it:
// this file is downloaded by the consumer CI alone, so the definition lives here.
// A pin line names a marker; a pin is a vX.Y.Z on such a line. A marker line may hold no pin.
const PIN_MARKER = /pinned to the commit of v|<commit sha of v|git\/ref\/tags\/v|\(`v\d+\.\d+\.\d+` above\)/;
const PIN_TOKEN = /(?<![A-Za-z0-9])v\d+\.\d+\.\d+(?!\d)/g;

// Every pin (`v<x.y.z>`) on every pin line of `text`, in order; [] for a text with no pin line.
export function pinsIn(text) {
  return text.split('\n').flatMap((line) => (PIN_MARKER.test(line) ? line.match(PIN_TOKEN) ?? [] : []));
}

// Every pin on every pin line becomes v<version>; every other byte stays. Masking is setPins(text, '0.0.0').
export function setPins(text, version) {
  return text.split('\n').map((line) => (PIN_MARKER.test(line) ? line.replace(PIN_TOKEN, `v${version}`) : line)).join('\n');
}

// The one file whose CI pin lines an archive may change without a proposal naming it (ADR 0027 as amended by ADR 0030).
export const PIN_LINE_FILES = ['docs/openspec-flow.md'];
// true only when `path` is the pin file, both texts are strings, and they differ only in pins.
// Anything else, missing or unreadable included, is false.
export function pinLinesOnly(path, pair) {
  if (!PIN_LINE_FILES.includes(path)) return false;
  const { before, after } = pair ?? {};
  if (typeof before !== 'string' || typeof after !== 'string') return false;
  return setPins(before, '0.0.0') === setPins(after, '0.0.0');
}

// Files a version bump or a regenerated catalog changes without a proposal naming them (design D8).
// The CI pin file is not a release file; see PIN_LINE_FILES (ADR 0027, ADR 0030).
export const RELEASE_FILE = /^(plugins\/[^/]+\/\.claude-plugin\/plugin\.json|\.claude-plugin\/marketplace\.json|CHANGELOG\.md|docs\/catalog\.md)$/;
// The file whose CI pins a release renumbers (delivery-train D-10): PIN_FILE, kept under this name for its readers.
export const TRAIN_PIN_FILE = PIN_FILE;

// The changed paths that no approved proposal names exactly (AC-3):
// no directory, prefix or glob matching. The one exception by content (ADR 0027, ADR 0030): the pin file passes
// when `texts[path]` ({ before, after }) shows only its CI pin lines changed (pinLinesOnly).
export function unnamedFiles(paths, proposals, texts = {}) {
  const named = new Set(proposals.filter((p) => p.answer === 'approved').flatMap((p) => p.targets.map(normalizePath)));
  const canonical = canonicalSpecs(paths);
  return paths.filter((p) => !isArchiveRecord(p) && !canonical.has(p) && !RELEASE_FILE.test(p) && !pinLinesOnly(p, texts[p]) && !named.has(p));
}

// openspec archive writes openspec/specs/<capability>/spec.md for each capability the archived
// folder has a spec delta for: exactly those paths, no directory or glob matching.
function canonicalSpecs(paths) {
  const caps = paths.map((p) => /^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[^/]+\/specs\/([^/]+)\/spec\.md$/.exec(p)?.[1]).filter(Boolean);
  return new Set(caps.map((c) => `openspec/specs/${c}/spec.md`));
}

const ARCHIVE_NAME = (id) => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${id.replace(/[.]/g, '\\.')}$`);

// The roadmap line of `id`: { listed, ticked, line }.
function roadmapFacts(root, id) {
  const file = join(root, 'openspec', 'roadmap.md');
  const none = { listed: false, ticked: false, line: null };
  if (!existsSync(file)) return none;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+([A-Za-z0-9][\w.-]*)/);
    if (m && m[2] === id) return { listed: true, ticked: m[1] !== ' ', line };
  }
  return none;
}

// Reads one GitHub contents path on `base`: { json } | { notFound: true } | { error }.
export function readContents(gh, path, base) {
  const r = gh(['api', `repos/{owner}/{repo}/contents/${path}?ref=${encodeURIComponent(base)}`]);
  if (r.status !== 0) return !r.missing && !r.timedOut && /HTTP 404\b/.test(r.stderr) ? { notFound: true } : { error: ghError(r) };
  try { return { json: JSON.parse(r.stdout) }; } catch { return { error: `${path} returned unreadable JSON` }; }
}

// The pull requests of an archive head branch (`gh pr list`): { list } | { error }.
function archivePrList(gh, branch) {
  const l = gh(['pr', 'list', '--head', branch, '--state', 'all', '--limit', '10', '--json', 'number,url,state,headRefOid,mergeable,autoMergeRequest,mergeStateStatus']);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
  return { list };
}

// The archive PR of the head branch (`chore/archive-<id>`, or the test branch's own): the OPEN one, else the newest MERGED,
// else the newest CLOSED.
function archivePrFacts(gh, root, id, base, facts, branch = `chore/archive-${id}`) {
  const read = archivePrList(gh, branch);
  if (read.error) return { error: read.error };
  const { list } = read;
  const pr = ['OPEN', 'MERGED', 'CLOSED'].map((st) => list.find((p) => p.state === st)).find(Boolean);
  if (!pr) return { pr: null };
  const out = {
    number: pr.number, url: pr.url, state: pr.state, mergeable: pr.mergeable ?? null,
    autoMerge: pr.autoMergeRequest != null, mergeStateStatus: pr.mergeStateStatus ?? null, headRefOid: pr.headRefOid,
    headRel: pr.headRefOid === facts.head ? 'same' : (facts.head && inHistory(root, pr.headRefOid, facts.head) ? 'ahead' : 'foreign'),
    checks: { failing: [], pending: [], error: null },
  };
  if (pr.state === 'OPEN') {
    const c = checksItem({ pr: { number: pr.number } }, gh);
    out.checks = { failing: c.details.failing, pending: c.details.pending, error: c.status === 'blocked' ? c.reason : null };
  }
  return { pr: out };
}

// One `gh api` read of a GitHub route, as JSON: { json } | { notFound: true, error } on HTTP 404 (not a missing or timed-out `gh`)
// | { error }.
function ghJson(gh, route) {
  const r = gh(['api', `repos/{owner}/{repo}/${route}`]);
  if (r.status !== 0) return { error: ghError(r), ...(!r.missing && !r.timedOut && /HTTP 404\b/.test(r.stderr) ? { notFound: true } : {}) };
  try { return { json: JSON.parse(r.stdout) }; } catch { return { error: `${route.split('/')[0]} returned unreadable JSON` }; }
}

const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

// A version `v<version>` can name as a tag and carry in a URL path segment (release-tags D-2).
const tagVersion = (v) => typeof v === 'string' && /^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(v) && !v.includes('..') && !/\.(lock)?$/.test(v);

// The top-level string `version` of a contents answer (base64 JSON), or null.
function fileVersion(json) {
  if (!json || Array.isArray(json) || typeof json.content !== 'string') return null;
  try {
    const version = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'))?.version;
    return typeof version === 'string' ? version : null;
  } catch { return null; }
}

// What the release of pull request `number` (merged to `base`) needs, read from GitHub (release-tags D-2); one of
// { state: 'none', why: 'not-merged' | 'other-base' | 'no-file' | 'unchanged' },
// { state: 'done', tag, sha, number, merged }, { state: 'missing', tag, sha, number, merged, version, file, base },
// { state: 'elsewhere', tag, sha, at, number, merged } or { state: 'unreadable', number, reason }.
// `merged` is 'change' or 'archive'. Six calls at most, each stopping as soon as the answer is known; a failure is never a pass.
function releaseTagFacts(gh, { file, number, base, merged }) {
  const unreadable = (reason) => ({ state: 'unreadable', number, reason });
  const failed = (why) => unreadable(`cannot read the release of PR #${number} on GitHub: ${why}`);
  const none = (why) => ({ state: 'none', why });

  const pull = ghJson(gh, `pulls/${number}`);
  if (!pull.json) return failed(pull.error);
  if (pull.json.merged !== true) return none('not-merged');
  if (pull.json.base?.ref !== base) return none('other-base');
  const sha = pull.json.merge_commit_sha;
  if (!isSha(sha)) return failed('the answer has no merge commit');

  const atMerge = readContents(gh, file, sha);
  if (atMerge.notFound) return none('no-file');
  if (atMerge.error) return failed(atMerge.error);
  const version = fileVersion(atMerge.json);
  if (!tagVersion(version)) return unreadable(`${file} at ${sha.slice(0, 7)} has no top-level "version" a tag can carry`);

  const commit = ghJson(gh, `git/commits/${sha}`);
  if (!commit.json) return failed(commit.error);
  const { parents } = commit.json;
  if (!Array.isArray(parents)) return failed('the merge commit answer has no parent list');
  if (parents.length > 0) {
    if (!isSha(parents[0]?.sha)) return failed('the merge commit has no readable first parent');
    const atParent = readContents(gh, file, parents[0].sha);
    if (atParent.error) return failed(atParent.error);
    if (atParent.json && fileVersion(atParent.json) === version) return none('unchanged');
  }

  const tag = `v${version}`;
  const wanted = `refs/tags/${tag}`;
  const missing = { state: 'missing', tag, sha, number, merged, version, file, base };
  const ref = ghJson(gh, `git/ref/tags/${tag}`);
  if (ref.notFound) return missing;
  if (!ref.json) return failed(ref.error);
  let entry = ref.json;
  if (Array.isArray(ref.json)) {
    entry = ref.json.find((e) => e?.ref === wanted);
    if (!entry) return missing;
  }
  if (entry?.ref !== wanted) return failed(`the answer for ${tag} names another ref`);
  const target = entry.object;
  if (!isSha(target?.sha)) return failed(`the answer for ${tag} has no object sha`);
  let at = target.sha;
  if (target.type === 'tag') {
    const annotated = ghJson(gh, `git/tags/${target.sha}`);
    if (!annotated.json) return failed(annotated.error);
    const pointed = annotated.json.object;
    if (pointed?.type !== 'commit' || !isSha(pointed.sha)) return failed(`the annotated tag ${tag} does not point at a commit`);
    at = pointed.sha;
  } else if (target.type !== 'commit') return failed(`${tag} is neither a commit nor an annotated tag`);
  return at === sha ? { state: 'done', tag, sha, number, merged } : { state: 'elsewhere', tag, sha, at, number, merged };
}

// Where change `id` stands on `ref` on GitHub: { error } | { state: 'archived', folder } | { state: 'active' | 'absent' }.
function changeOn(gh, id, ref) {
  const listing = readContents(gh, 'openspec/changes/archive', ref);
  if (listing.error) return { error: listing.error };
  const wanted = ARCHIVE_NAME(id);
  const folder = Array.isArray(listing.json) ? listing.json.map((e) => e?.name).filter((n) => typeof n === 'string' && wanted.test(n)).sort().at(-1) : null;
  if (folder) return { state: 'archived', folder };
  const live = readContents(gh, `openspec/changes/${id}`, ref);
  if (live.error) return { error: live.error };
  return { state: live.notFound ? 'absent' : 'active' };
}

// Everything the post-merge rows read (design D4, D7): the default branch and
// the archive PR from GitHub, the rest from the working tree. In `two-prs` (D-10) the test branch's side too.
function archiveFacts(gh, root, id, ctx) {
  const facts = archiveBaseFacts(gh, root, id, ctx);
  if (!ctx.testBranch || facts.onDefault === null) return facts;
  const test = testArchiveFacts(gh, root, id, ctx.testBranch, ctx.facts, facts.base);
  return { ...facts, ...test, ...(facts.stop ? { stop: facts.stop } : test.stop ? { stop: test.stop } : {}) };
}

// The test branch's side of the archive (D-10): { testBranch, onTest, testPr, testLocal } or, when GitHub cannot be read, a stop.
function testArchiveFacts(gh, root, id, testBranch, facts, base) {
  const branch = `chore/archive-${id}-${testBranch}`;
  const unread = { testBranch, onTest: null, testPr: null, testLocal: null };
  const on = changeOn(gh, id, testBranch);
  if (on.error) return { ...unread, stop: { archiveStep: 'read-default-branch', reason: `cannot read ${testBranch} on GitHub: ${on.error}` } };
  const prs = archivePrFacts(gh, root, id, base, facts, branch);
  if (prs.error) return { ...unread, onTest: on.state, stop: { archiveStep: 'archive-pr', reason: `cannot read the archive PR to ${testBranch}: ${prs.error}` } };
  const worktree = listWorktrees(root).find((w) => w.branch === branch)?.path ?? null;
  const picking = worktree && gitOk(worktree, ['rev-parse', '--verify', '-q', 'CHERRY_PICK_HEAD'])
    ? git(worktree, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean)
    : null;
  return {
    testBranch, onTest: on.state, testFolder: on.folder ?? null, testPr: prs.pr,
    testLocal: {
      exists: gitOk(root, ['rev-parse', '--verify', '-q', `refs/heads/${branch}`]),
      worktree,
      path: worktree ?? join(mainCheckout(root) ?? root, '.claude', 'worktrees', `archive-${id}-${testBranch}`),
      picking,
    },
  };
}

// The release facts of the archive's merged pull request, once the change is archived on the default branch: null without a merged one.
function archiveReleaseFacts(gh, { file, branch, base }) {
  const prs = archivePrList(gh, branch);
  if (prs.error) return { state: 'unreadable', number: null, reason: `cannot read the archive PR on GitHub: ${prs.error}` };
  const pr = prs.list.find((p) => p.state === 'MERGED');
  return pr ? releaseTagFacts(gh, { file, number: pr.number, base, merged: 'archive' }) : null;
}

function archiveBaseFacts(gh, root, id, { located, repo, facts, changePr, branch, env, releaseFile = null }) {
  const archiveBranch = `chore/archive-${id}`;
  const stop = (archiveStep, reason) => ({ stop: { archiveStep, reason } });
  const base = repo?.settings?.default_branch;
  const common = {
    branch: archiveBranch,
    changePr: changePr ? { number: changePr.number, url: changePr.url } : null,
    local: located.archived ? 'archived' : 'active',
    retro: readRetro(join(located.dir, 'retro.md')),
    roadmap: roadmapFacts(root, id),
    branchExists: gitOk(root, ['rev-parse', '--verify', '-q', `refs/heads/${archiveBranch}`]),
    dirty: changedInTree(root),
    pr: null,
    folder: located.archived ? basename(located.dir) : null,
    waitingFor: null,
  };
  if (!base) return { ...common, base: null, onDefault: null, ...stop('read-default-branch', `cannot read the default branch on GitHub: ${repo?.error ?? 'the answer has no default branch'}`) };
  // The release facts (release-tags D-3): only with `devkit.release_tag`, so a project without it reads nothing more.
  const release = releaseFile ? { change: changePr ? releaseTagFacts(gh, { file: releaseFile, number: changePr.number, base, merged: 'change' }) : null } : null;
  const here = { ...common, base, ...(release ? { release } : {}) };
  const unreadable = (e) => ({ ...here, onDefault: null, ...stop('read-default-branch', `cannot read ${base} on GitHub: ${e}`) });

  const on = changeOn(gh, id, base);
  if (on.error) return unreadable(on.error);
  if (on.state === 'archived') {
    if (release) release.archive = archiveReleaseFacts(gh, { file: releaseFile, branch: archiveBranch, base });
    return { ...here, onDefault: 'archived', folder: on.folder };
  }
  const onDefault = on.state;

  const prs = archivePrFacts(gh, root, id, base, facts);
  if (prs.error) return { ...here, onDefault, ...stop('archive-pr', `cannot read the archive PR: ${prs.error}`) };
  return { ...here, onDefault, pr: prs.pr, changed: located.archived || prs.pr ? archiveChanges(root, base) : null };
}

// ---------------------------------------------------------------- the release note (release-at-merge D-1 to D-5)
// The note a change states its release in, the lines the delivery writes from it, the state of a branch against them and the edit that
// stales nothing. Everything here runs from the three files a consumer's CI downloads (guard.mjs, deliver-check.mjs, merge-setup.mjs):
// it imports nothing but `node:` modules (D-3a).

export const RELEASE_NOTE = 'release.md';
const NOTE_KINDS = ['patch', 'minor', 'major'];
const NOTE_FENCE = /^\s*(?:`{3,}|~{3,})/;
const NOTE_VERSION_HEADING = /^##\s/;
const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The note `text` holds: { packs: [{ name, kind }], marketplace, marketplaceGiven, release, title, body }, or { error } (D-1). `marketplace`
// is the bump the note gives, else the largest pack bump, else null; `release` is null when the note gives none.
export function parseReleaseNote(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const refuse = (message) => ({ error: `release.md: ${message}` });
  const kindOf = (field, kind) => (NOTE_KINDS.includes(kind) ? null : refuse(`${field}: "${kind}" is not patch, minor or major`));
  const order = '(the fields come as packs:, marketplace:, release:)';
  const packs = [];
  const seen = { packs: false, marketplace: false, release: false };
  const given = { marketplace: null, release: null };
  let title = null;
  let bodyAt = lines.length;
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.trim() === '# Release note') i++;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const heading = /^##\s+(\S.*)$/.exec(line);
    if (heading) { title = heading[1].trim(); bodyAt = i + 1; break; }
    const field = /^(packs|marketplace|release):\s*(.*)$/.exec(line);
    if (!field) return refuse(`line ${i + 1}: "${line}" is not a field of the note`);
    const [, name, value] = field;
    if (name === 'packs') {
      if (seen.packs) return refuse('packs: given twice');
      seen.packs = true;
      if (/^\[\s*\]$/.test(value)) continue;
      if (value !== '') return refuse(`packs: line ${i + 1}: "${line}" is not "packs:" followed by a list or "packs: []"`);
      let j = i + 1;
      for (; j < lines.length; j++) {
        const item = lines[j].trim();
        if (item === '') continue;
        if (!item.startsWith('-')) break;
        const parsed = /^-\s+([^\s:]+)\s*:\s*(\S+)$/.exec(item);
        if (!parsed) return refuse(`packs: line ${j + 1}: "${item}" is not "- <pack>: patch|minor|major"`);
        const bad = kindOf(`packs: ${parsed[1]}`, parsed[2]);
        if (bad) return bad;
        if (packs.some((p) => p.name === parsed[1])) return refuse(`packs: ${parsed[1]} is listed twice`);
        packs.push({ name: parsed[1], kind: parsed[2] });
      }
      if (packs.length === 0) return refuse('packs: no pack is listed (write "packs: []" for no release)');
      i = j - 1;
      continue;
    }
    if (!seen.packs || (name === 'marketplace' && seen.release)) return refuse(`${name === 'release' && !seen.packs ? 'release' : 'marketplace'}: out of order ${order}`);
    if (seen[name]) return refuse(`${name}: given twice`);
    seen[name] = true;
    const bad = kindOf(name, value);
    if (bad) return bad;
    given[name] = value;
  }
  if (!seen.packs) return refuse('packs: missing (the note starts with "packs:" or "packs: []")');
  const releases = packs.length > 0 || given.marketplace !== null || given.release !== null;
  const body = lines.slice(bodyAt).join('\n').replace(/^\n+/, '').trimEnd();
  if (releases && title === null) return refuse('changelog title: missing (a "## <title>" line comes after the fields)');
  if (releases && body === '') return refuse('changelog body: empty (write what the release changes under the title)');
  // A `## ` line outside a fence would be another version heading in CHANGELOG.md (D-23); `### ` and a fenced line are text.
  let opened = null;
  for (let k = bodyAt; k < lines.length; k++) {
    if (NOTE_FENCE.test(lines[k])) opened = opened === null ? k + 1 : null;
    else if (opened === null && NOTE_VERSION_HEADING.test(lines[k])) return refuse(`changelog body: line ${k + 1}: "${lines[k]}" is a version heading; write ### or a list item`);
  }
  if (opened !== null) return refuse(`changelog body: a code fence opened at line ${opened} is never closed`);
  const largest = packs.reduce((top, p) => (top === null || NOTE_KINDS.indexOf(p.kind) > NOTE_KINDS.indexOf(top) ? p.kind : top), null);
  return { packs, marketplace: given.marketplace ?? largest, marketplaceGiven: given.marketplace !== null, release: given.release, title, body };
}

// `sha256:` and the first 12 hex of the note's bytes, or null with no note (D-1, D-9).
export function releaseNoteHash(dir) {
  const file = join(dir, RELEASE_NOTE);
  return existsSync(file) ? `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)}` : null;
}

// A reader of the files of a repository at a revision, the one `computeRelease` and the state read through (pure over it):
// `file(rev, path)` is the text or null, `dir(rev, path)` the names in a folder ([] when there is none).
export function repoReader(root) {
  const run = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  return {
    file(rev, path) { const r = run(['show', `${rev}:${path}`]); return r.status === 0 ? r.stdout : null; },
    dir(rev, path) {
      const r = run(['ls-tree', '--name-only', rev, `${path}/`]);
      return r.status === 0 ? r.stdout.split('\n').filter(Boolean).map((p) => p.slice(path.length + 1)) : [];
    },
  };
}

// The manifests of the packs at `rev`: [{ dir, path, name, version }].
function packsAt(reader, rev) {
  return reader.dir(rev, 'plugins').flatMap((dir) => {
    const path = `plugins/${dir}/.claude-plugin/plugin.json`;
    try {
      const obj = JSON.parse(reader.file(rev, path) ?? 'null');
      return obj && typeof obj.name === 'string' ? [{ dir, path, name: obj.name, version: obj.version }] : [];
    } catch { return []; }
  });
}

const MARKETPLACE = '.claude-plugin/marketplace.json';
const CHANGELOG = 'CHANGELOG.md';

// The note's changelog entry above the first `## ` line of `baseText` (appended when there is none): `## <version> — <title>`, a blank
// line and the body, with `- **<pack>**:` at the start of a bullet turned into `- **<pack>** <version>:` for each pack of `packVersions`.
export function changelogEntry(baseText, version, title, body, packVersions) {
  let text = body;
  for (const [name, v] of Object.entries(packVersions)) text = text.replace(new RegExp(`^([ \\t]*[-*+][ \\t]+)\\*\\*${esc(name)}\\*\\*:`, 'gm'), `$1**${name}** ${v}:`);
  const entry = `## ${version} — ${title}\n\n${text.trimEnd()}\n`;
  const at = /^## /m.exec(baseText)?.index;
  if (at === undefined) return baseText === '' ? entry : `${baseText.replace(/\n*$/, '\n\n')}${entry}`;
  return `${baseText.slice(0, at)}${entry}\n${baseText.slice(at)}`;
}

// The next free number of an ADR folder on `rev`: one more than the highest `NNNN-` file name there.
const nextAdrNumber = (reader, rev, folder) => 1 + Math.max(0, ...reader.dir(rev, folder).map((n) => Number(/^(\d{4})-/.exec(n)?.[1] ?? 0)));
const packRelease = (reader, rev, setting) => {
  const text = setting ? reader.file(rev, setting) : null;
  try { const v = JSON.parse(text ?? 'null')?.version; return typeof v === 'string' ? v : null; } catch { return null; }
};

// The text of a JSON release file with its top-level `version` set, in the file's indent and final newline (D-3).
export function withReleaseVersion(text, version) {
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 2;
  return JSON.stringify({ ...JSON.parse(text), version }, null, indent) + (text.endsWith('\n') ? '\n' : '');
}

// The files the delivery step writes on `base` for `note` (D-3): { files: { path: text }, versions: { packs, metadata?, release? }, adrs }.
// `setting` is the file `devkit.release_tag` names; `adrs` are the unnumbered paths of decisions.md, in listed order. A note the
// project cannot release is a ReleaseError whose message starts `release.md:`.
export function computeRelease(reader, base, note, setting, adrs = []) {
  const fail = (message) => new ReleaseError(`release.md: ${message}`);
  const bump = (field, version, kind) => {
    try { return applyBump(version, kind); } catch (e) { throw fail(`${field}: ${e.message}`); }
  };
  const files = {};
  const versions = { packs: {} };
  const packs = packsAt(reader, base);
  for (const { name, kind } of note.packs) {
    const found = packs.find((p) => p.name === name);
    if (!found) throw fail(`packs: ${name} is not a pack of this project`);
    versions.packs[name] = bump(`packs: ${name}`, found.version, kind);
  }
  const marketText = reader.file(base, MARKETPLACE);
  if (note.marketplaceGiven && marketText === null) throw fail('marketplace: the project has no .claude-plugin/marketplace.json');
  if (marketText !== null && note.marketplace) {
    const current = JSON.parse(marketText).metadata?.version;
    if (typeof current === 'string') versions.metadata = bump('marketplace', current, note.marketplace);
  }
  const manifest = packs.find((p) => p.path === setting);
  if (note.release && manifest) throw fail(`release: ${setting} is the manifest of ${manifest.name}; state its bump under packs:`);
  const releaseText = setting && !manifest ? reader.file(base, setting) : null;
  const releaseNow = packRelease(reader, base, setting && !manifest ? setting : null);
  if (note.release && releaseText !== null && releaseNow !== null) {
    versions.release = bump('release', releaseNow, note.release);
    files[setting] = withReleaseVersion(releaseText, versions.release);
  }
  for (const { path, name } of packs) {
    if (name in versions.packs) files[path] = resolveManifest(reader.file(base, path), { packs: { [name]: versions.packs[name] } });
  }
  if (marketText !== null && (Object.keys(versions.packs).length > 0 || versions.metadata !== undefined)) {
    files[MARKETPLACE] = resolveManifest(marketText, { packs: versions.packs, ...(versions.metadata === undefined ? {} : { metadata: versions.metadata }) });
  }
  const pinPack = packs.find((p) => p.path === PIN_PACK && p.name === PIN_PACK_NAME);
  const pinText = reader.file(base, PIN_FILE);
  if (pinPack && pinText !== null) {
    const pinned = setPins(pinText, versions.packs[PIN_PACK_NAME] ?? pinPack.version);
    if (pinned !== pinText) files[PIN_FILE] = pinned;
  }
  const changelog = reader.file(base, CHANGELOG);
  const heading = versions.metadata ?? versions.release;
  if (changelog !== null && heading && note.title) files[CHANGELOG] = changelogEntry(changelog, heading, note.title, note.body, versions.packs);
  const next = new Map();
  const numbered = adrs.map((from) => {
    const folder = from.slice(0, from.lastIndexOf('/'));
    const slug = from.slice(folder.length + 1).replace(/\.md$/, '');
    const number = String(next.get(folder) ?? nextAdrNumber(reader, base, folder)).padStart(4, '0');
    next.set(folder, Number(number) + 1);
    return { slug, folder, from, to: `${folder}/${number}-${slug}.md`, number };
  });
  return { files, versions, adrs: numbered };
}

// ---- which rule a change follows, the records it lists and the state of its branch (D-2, D-3)

// What the release rule says of change `id` (D-2), memoized on `facts` as ownFiles is: { applies: false } without devkit.release_tag
// (a value the setting reader refuses applies to nothing here: /devkit change refused it at its start); { applies, noted: false, file } for
// a change with no release.md (the old rule); { applies, noted: true, file, note, edit } with it, `note` what parseReleaseNote read and `edit`
// the predicate `staleness` takes as its `release` option (D-5).
export function releaseFacts(root, id, facts) {
  const cache = (facts.releaseCache ??= new Map());
  if (cache.has(id)) return cache.get(id);
  let file = null;
  try { file = releaseTagOf(root); } catch (e) { if (!(e instanceof ShipConfigError)) throw e; }
  let found = { applies: false };
  if (file) {
    const noteFile = join(changeDir(root, id), RELEASE_NOTE);
    found = existsSync(noteFile)
      ? { applies: true, noted: true, file, note: parseReleaseNote(readFileSync(noteFile, 'utf8')), edit: releaseEdit(root, file) }
      : { applies: true, noted: false, file };
  }
  cache.set(id, found);
  return found;
}

// The predicate `staleness` takes as `release` for a noted change, or null (D-5).
export const releaseEditOf = (root, id, facts) => releaseFacts(root, id, facts).edit ?? null;

// The unnumbered records `decisions.md` of change `id` lists, in listed order: the `- ADR:` paths in a file of ADR_DIRS whose name has no
// `NNNN-` prefix. `rev` is a revision, or null for the working tree.
export function changeAdrs(root, rev, id) {
  const file = `openspec/changes/${id}/decisions.md`;
  const text = rev ? repoReader(root).file(rev, file) : existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null;
  if (!text) return [];
  const paths = [...new Set([...text.matchAll(ADR_LINES)].map((m) => m[1].trim()))];
  return paths.filter((p) => ADR_DIRS.some((d) => p.startsWith(`${d}/`) && !p.slice(d.length + 1).includes('/')) && p.endsWith('.md') && !/^\d{4}-/.test(basename(p)));
}

// The numbered records of the ADR folders at `rev`: [{ number, slug }].
function numberedAdrs(reader, rev) {
  return ADR_DIRS.flatMap((dir) => reader.dir(rev, dir).flatMap((n) => {
    const m = /^(\d{4})-(.+)\.md$/.exec(n);
    return m ? [{ number: m[1], slug: m[2] }] : [];
  }));
}

// The file form of a citation of the record named `name` (D-19): the global RegExp of `<name>.md` as a whole token (not preceded or followed
// by a letter, a digit, `_` or `-`) whose folder part ends in the last part of an ADR_DIRS folder (`adr/`, `decisions/`: `docs/adr/feat.md`,
// `../adr/feat.md`, `adr/feat.md`), or, in a file `path` of an ADR_DIRS folder, with no folder part (`(feat.md)`). Group 1 is that last
// folder part, empty with none, so a rewrite keeps it. A document elsewhere that shares the name is not matched.
const ADR_FOLDER_NAMES = ADR_DIRS.map((d) => d.slice(d.lastIndexOf('/') + 1));
export function adrFileRe(name, path = '') {
  const folder = `(?<![A-Za-z0-9_-])((?:${ADR_FOLDER_NAMES.map(esc).join('|')})/)`;
  const inAdrFolder = path.includes('/') && ADR_DIRS.includes(path.slice(0, path.lastIndexOf('/')));
  return new RegExp(`${inAdrFolder ? `(?:${folder}|(?<![A-Za-z0-9_/-]))` : folder}${esc(name)}\\.md(?![A-Za-z0-9_-])`, 'g');
}

// The number form of a citation of the record numbered `number`: the global RegExp of `ADR <number>` not preceded by a letter or a digit
// and not followed by a digit (`ADR 0034`, not `xADR 0034` or `ADR 00345`). The one builder of maskCitations, sharedNumberMatch and
// release-merge's givenBackBySpan.
export function adrNumberRe(number) {
  return new RegExp(`(?<![A-Za-z0-9])ADR ${esc(number)}(?![0-9])`, 'g');
}

// The ADR part of maskRelease (D-5, D-18, D-19), on its own for the give-back of the step and the join: in a text of a file that holds
// citations (holdsCitations, no NUL byte), `ADR <NNNN>` back to `ADR [<slug>]` and, where adrFileRe matches, `<NNNN>-<slug>.md` back to
// `<slug>.md`, for each numbered record { number, slug } of `adrs`. Any other text is returned as it is.
export function maskCitations(text, path, adrs) {
  if (!holdsCitationText(path, text)) return text;
  let out = text;
  for (const { number, slug } of adrs) {
    out = out.replace(adrNumberRe(number), `ADR [${slug}]`);
    out = out.replace(adrFileRe(`${number}-${slug}`, path), (_, dir = '') => `${dir}${slug}.md`);
  }
  return out;
}

// The text with the edits a delivery writes taken out (D-5), the same way on both sides of a comparison: manifests and the release file
// without their version fields; the flow page with its CI pins at 0.0.0 (the mask of pinLinesOnly); and maskCitations for each numbered
// record in `map.adrs`. `map` is { adrs, file }, `file` the release file the project names.
export function maskRelease(text, path, map = { adrs: [], file: null }) {
  let out = text;
  if ((RELEASE_FILE.test(path) && path.endsWith('.json')) || path === map.file) {
    try { out = JSON.stringify(withoutVersions(JSON.parse(text))); } catch { /* not JSON: compared as it is */ }
  } else if (path === PIN_FILE) out = setPins(out, '0.0.0');
  return maskCitations(out, path, map.adrs);
}

// true when `path` differs between revisions `before` and `after` only in release lines (D-5): CHANGELOG.md and docs/catalog.md; a path whose
// two texts mask equal; an ADR added under its number whose text masks equal to the form of the same record that left (its unnumbered
// path, or its former number when the step ran again after the base numbered another record); that form deleted when the numbered one is
// added. Each side is masked with the records it holds (`ctx.adrsAt` of that revision), so a renumbered record reads as itself on both sides
// and a citation moved to another record's number does not; a number two records hold at `before` cites either (sharedNumberMatch). `ctx`
// is { file, reader, adrsAt(rev) }, which `releaseEdit` memoizes per revision; the reader is `repoReader(root)` unless the caller hands another
// (the forced-merge read hands one over GitHub, forced-merge-release-edit D-5).
export function releaseOnlyEdit(root, before, after, path, ctx = releaseContext(root)) {
  if (!before || !after) return false;
  if (path === CHANGELOG || path === 'docs/catalog.md') return true;
  const { reader } = ctx;
  const was = { rev: before, map: { adrs: ctx.adrsAt(before), file: ctx.file } };
  const now = { rev: after, map: { adrs: ctx.adrsAt(after), file: ctx.file } };
  const masked = (side, p) => { const text = reader.file(side.rev, p); return text === null ? null : maskRelease(text, p, side.map); };
  const wasText = masked(was, path);
  const nowText = masked(now, path);
  if (wasText !== null && nowText !== null) return wasText === nowText || sharedNumberMatch(reader.file(before, path), path, was.map, nowText);
  const folder = path.slice(0, path.lastIndexOf('/'));
  if (!ADR_DIRS.includes(folder)) return false;
  const name = path.slice(folder.length + 1);
  const slug = /^\d{4}-(.+)\.md$/.exec(name)?.[1] ?? name.replace(/\.md$/, '');
  // The forms of the record `slug` a side holds in the folder: `<slug>.md` and each `<NNNN>-<slug>.md`.
  const forms = (side) => reader.dir(side.rev, folder).filter((n) => n === `${slug}.md` || new RegExp(`^\\d{4}-${esc(slug)}\\.md$`).test(n)).map((n) => `${folder}/${n}`);
  const numbered = (p) => /^\d{4}-/.test(p.slice(folder.length + 1));
  if (wasText === null && nowText !== null) {
    if (!numbered(path)) return false;
    const left = forms(was).filter((p) => p !== path && reader.file(after, p) === null);
    return left.length === 1 && masked(was, left[0]) === nowText;
  }
  if (wasText !== null && nowText === null) return forms(now).filter((p) => p !== path && numbered(p) && reader.file(before, p) === null).length === 1;
  return false;
}

// Whether `nowText` (masked) is `raw` masked where `map.adrs` holds two or more records with one number (a merge by hand of a base that
// took the number the step wrote, release-at-merge D-34): there each `ADR <NNNN>` of that number cites any record that holds it, so it
// reads as whichever of them `nowText` names at that place. Found by the real-run proof (task 11.10, P-14 (d)).
function sharedNumberMatch(raw, path, map, nowText) {
  const slugsOf = new Map();
  for (const { number, slug } of map.adrs) slugsOf.set(number, [...(slugsOf.get(number) ?? []), slug]);
  const shared = [...slugsOf].filter(([, slugs]) => slugs.length > 1);
  if (!shared.length || !holdsCitationText(path, raw)) return false;
  const alts = [];
  let text = raw;
  for (const [number, slugs] of shared) {
    text = text.replace(adrNumberRe(number), () => `\u0001${alts.push(slugs) - 1}\u0001`);
  }
  const parts = maskRelease(text, path, map).split(/\u0001(\d+)\u0001/);
  const pattern = parts.map((p, i) => (i % 2 ? `ADR \\[(?:${alts[Number(p)].map(esc).join('|')})\\]` : esc(p))).join('');
  return new RegExp(`^${pattern}$`).test(nowText);
}

function releaseContext(root, file = null, reader = repoReader(root)) {
  const cache = new Map();
  return { file, reader, adrsAt: (rev) => { if (!cache.has(rev)) cache.set(rev, numberedAdrs(reader, rev)); return cache.get(rev); } };
}
const releaseEdit = (root, file) => { const ctx = releaseContext(root, file); return (before, after, path) => releaseOnlyEdit(root, before, after, path, ctx); };

// ---- the state of a noted branch

// The release lines of a tree as { key: value } (D-3): each pack manifest's version for the paths in `packPaths`, the marketplace's versions,
// the changelog's text, the CI pins and the top-level version of the release file. `read(path)` is the text of a file or null.
function linesOf(read, packPaths, file) {
  const out = new Map();
  const versionOf = (text) => { try { const v = JSON.parse(text ?? 'null')?.version; return typeof v === 'string' ? v : null; } catch { return null; } };
  for (const path of packPaths) out.set(path, versionOf(read(path)));
  const market = read(MARKETPLACE);
  if (market !== null) {
    try { const m = JSON.parse(market); out.set(MARKETPLACE, JSON.stringify([m.metadata?.version ?? null, ...(m.plugins ?? []).map((p) => [p.name, p.version ?? null])])); } catch { out.set(MARKETPLACE, market); }
  }
  const changelog = read(CHANGELOG);
  if (changelog !== null) out.set(CHANGELOG, changelog);
  const pins = read(PIN_FILE);
  if (pins !== null) out.set(PIN_FILE, pinsIn(pins).join(' '));
  if (file && !packPaths.includes(file)) out.set(file, read(file) === null ? null : versionOf(read(file)));
  return out;
}

// Whether `ADR [<slug>]` remains in a file that holds citations (CITATION_PATHSPEC) at `rev`.
function citedAt(root, rev, slug) {
  const r = spawnSync('git', ['-C', root, 'grep', '-I', '-q', '-F', '-e', `ADR [${slug}]`, rev, '--', ...CITATION_PATHSPEC], { stdio: 'ignore' });
  return r.status === 0;
}

// The head's value of an ADR the note numbers: 'unnumbered', `numbered:<path>`, or a description that is neither (D-3).
function adrValue(root, reader, head, adr) {
  const unnumbered = reader.file(head, adr.from) !== null;
  const numbered = reader.dir(head, adr.folder).filter((n) => new RegExp(`^\\d{4}-${esc(adr.slug)}\\.md$`).test(n)).map((n) => `${adr.folder}/${n}`);
  if (unnumbered && numbered.length === 0) return 'unnumbered';
  if (!unnumbered && numbered.length === 1) return citedAt(root, head, adr.slug) ? `numbered:${numbered[0]} with ADR [${adr.slug}] still cited` : `numbered:${numbered[0]}`;
  return `other:${unnumbered ? adr.from : ''}${numbered.join(',')}`;
}

// The step's own record of what it wrote (D-20): the commits of `git log --first-parent <tip>..<head>` whose message's last paragraph holds
// the trailer `Release-change: <id>`, or null when none does or `git log` fails (a clone that cannot reach the range). Their `Release-line`,
// `Release-adr` and `Release-citation` trailers each count only when the commit changed what they name from its first parent, and every
// value is read from the commit's tree, never from the trailer text. Each key takes the newest of those commits that wrote it, so a number
// the step kept in a later commit (a merge that renumbered nothing, or a give-back to the same number) stays the step's own:
// { commit, lines, adrs, citations }, `commit` the newest recorded commit. `lines` maps a key of the state (a release line, or the unnumbered
// path of a renamed record) to its value in the form linesOf and adrValue give, the changelog masked with the head's numbers as
// releaseStateAt masks it; `adrs` are the { from, to, commit } renames and `citations` the { path, commit } rewrites, each with the commit that
// wrote it (the give-back reads that commit's text).
export function stepRecord(root, { head, tip, id }) {
  const log = spawnSync('git', ['-C', root, 'log', '--first-parent', '--format=%H%x00%B%x1e', `${tip}..${head}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  if (log.status !== 0) return null;
  const recorded = [];
  for (const entry of log.stdout.split('\x1e')) {
    const at = entry.indexOf('\0');
    if (at === -1) continue;
    const paragraphs = entry.slice(at + 1).trim().split(/\n[ \t]*\n/);
    const trailers = paragraphs.length < 2 ? [] : paragraphs[paragraphs.length - 1].split('\n').flatMap((line) => {
      const m = /^(Release-[a-z]+): (.+)$/.exec(line.trim());
      return m ? [{ key: m[1], value: m[2].trim() }] : [];
    });
    if (trailers.some((t) => t.key === 'Release-change' && t.value === id)) recorded.push({ commit: entry.slice(0, at).trim(), trailers });
  }
  if (!recorded.length) return null;
  const reader = repoReader(root);
  const lines = new Map();
  const adrs = [];
  const citations = [];
  for (const { commit, trailers } of recorded) {
    const parent = `${commit}^1`;
    const named = (key) => [...new Set(trailers.filter((t) => t.key === key).map((t) => t.value))];
    const linePaths = named('Release-line').filter((p) => !lines.has(p));
    const packPaths = linePaths.filter((p) => p !== MARKETPLACE && p !== CHANGELOG && p !== PIN_FILE);
    const now = linesOf((p) => reader.file(commit, p), packPaths, null);
    const was = linesOf((p) => reader.file(parent, p), packPaths, null);
    for (const path of linePaths) {
      const value = now.get(path) ?? null;
      if (value === null || value === (was.get(path) ?? null)) continue;
      lines.set(path, path === CHANGELOG ? maskRelease(value, CHANGELOG, { adrs: numberedAdrs(reader, head), file: null }) : value);
    }
    for (const value of named('Release-adr')) {
      const m = /^(\S+) -> (\S+)$/.exec(value);
      if (!m || adrs.some((a) => a.from === m[1]) || reader.file(commit, m[2]) === null || reader.file(parent, m[2]) !== null) continue;
      adrs.push({ from: m[1], to: m[2], commit });
      lines.set(m[1], `numbered:${m[2]}`);
    }
    for (const path of named('Release-citation')) {
      if (!citations.some((c) => c.path === path) && reader.file(commit, path) !== reader.file(parent, path)) citations.push({ path, commit });
    }
  }
  return { commit: recorded[0].commit, lines, adrs, citations };
}

// The `ADR [<x>]` citations of the branch's changed files that hold citations (holdsCitations, a binary text skipped) and of the note's
// changelog title and body (the step writes them into CHANGELOG.md) for a slug `x` that is not `own`: { cited, unlanded }; a citation is
// unlanded when no `<dir>/<NNNN>-<x>.md` is on `tip`.
function citationsOf(root, reader, { mergeBase, head, tip, own, noteText = '' }) {
  const changed = spawnSync('git', ['-C', root, 'diff', '--name-only', '-z', '--no-renames', mergeBase, head], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter((p) => p && holdsCitations(p));
  const cited = [];
  const texts = [...changed.map((path) => reader.file(head, path) ?? '').filter((text) => !text.includes('\0')), noteText];
  for (const text of texts) for (const m of text.matchAll(/ADR \[([A-Za-z0-9][A-Za-z0-9._-]*)\]/g)) if (!own.has(m[1]) && !cited.includes(m[1])) cited.push(m[1]);
  const landed = (slug) => ADR_DIRS.some((dir) => reader.dir(tip, dir).some((n) => new RegExp(`^\\d{4}-${esc(slug)}\\.md$`).test(n)));
  return { cited, unlanded: cited.filter((slug) => !landed(slug)) };
}

// The state of a noted change's branch against the release (D-3, D-20), or null for a change that follows no note:
// { kind: 'unassigned' | 'assigned' | 'hand' | 'error', paths, current, base, citations, adrs, reassign, error?, why? }.
// assigned: the lines are what computeRelease writes on the merge base (a note with nothing to write is assigned at once); unassigned: each
// line is the merge base's (every ADR unnumbered) or what the step's own record wrote (stepRecord), `reassign` listing the keys taken from the
// record whose value is not the merge base's, for the step to give back; hand: anything else, `paths` the lines edited by hand or still to
// write; error: the release cannot be computed (`why` is 'note', 'base' or 'release'). `current` is assigned with origin/<base> in the head.
export function releaseState(root, id, facts) {
  const rf = releaseFacts(root, id, facts);
  if (!rf.noted) return null;
  const base = facts.base ?? 'main';
  if (rf.note.error) return releaseFailure(base, 'note', rf.note.error);
  const tip = facts.base ? baseTip(root, facts.base) : null;
  if (!tip) return releaseFailure(base, 'base', `cannot compute the release: origin/${base} is missing; git fetch origin ${base}`);
  if (!facts.head) return releaseFailure(base, 'base', 'cannot compute the release: no commit at HEAD yet');
  return releaseStateAt(root, { head: facts.head, tip, base, note: rf.note, file: rf.file, adrs: changeAdrs(root, null, id), id });
}

const releaseFailure = (base, why, error) => ({ kind: 'error', why, error, paths: [], current: false, base, citations: { cited: [], unlanded: [] }, adrs: [], reassign: [] });

// The same state for any revision `head` against any revision `tip` it is numbered above (D-3; the step and the join judge their side with
// it, D-6, D-7): `note` is what parseReleaseNote read, `file` the release file the project names, `adrs` the unnumbered records the change's
// decisions.md lists, `base` the name the messages give the tip, `id` the change whose step record is read (none without it).
export function releaseStateAt(root, { head: headRev, tip, base, note, file, adrs, id = null }) {
  const fail = (why, error) => releaseFailure(base, why, error);
  let mergeBase;
  try { mergeBase = git(root, ['merge-base', headRev, tip]).trim(); } catch { return fail('base', `cannot compute the release: HEAD and origin/${base} have no merge base`); }
  const reader = repoReader(root);
  let computed;
  try { computed = computeRelease(reader, mergeBase, note, file, adrs); } catch (e) {
    if (e instanceof ReleaseError) return fail('release', e.message);
    throw e;
  }
  const packPaths = packsAt(reader, mergeBase).map((p) => p.path);
  const atMergeBase = (path) => reader.file(mergeBase, path);
  const head = linesOf((path) => reader.file(headRev, path), packPaths, file);
  const before = linesOf(atMergeBase, packPaths, file);
  const after = linesOf((path) => computed.files[path] ?? atMergeBase(path), packPaths, file);
  // The step rewrites the citations in CHANGELOG.md too (D-4), so the changelog is compared with the head's ADR numbers masked (D-5).
  const numbers = { adrs: numberedAdrs(reader, headRev), file: null };
  for (const lines of [head, before, after]) if (lines.has(CHANGELOG)) lines.set(CHANGELOG, maskRelease(lines.get(CHANGELOG), CHANGELOG, numbers));
  for (const adr of computed.adrs) {
    before.set(adr.from, 'unnumbered');
    after.set(adr.from, `numbered:${adr.to}`);
    head.set(adr.from, adrValue(root, reader, headRev, adr));
  }
  const keys = [...new Set([...head.keys(), ...before.keys(), ...after.keys()])].sort();
  const eq = (a, b, k) => (a.get(k) ?? null) === (b.get(k) ?? null);
  // A value neither the merge base's nor the computed one counts as the step's own when its own record wrote that value (D-20).
  const record = id ? stepRecord(root, { head: headRev, tip, id }) : null;
  const recorded = (k) => Boolean(record?.lines.has(k)) && eq(head, record.lines, k);
  const unassigned = (k) => eq(head, before, k) || recorded(k);
  const outside = keys.filter((k) => !unassigned(k) && !eq(head, after, k));
  const asAfter = keys.every((k) => eq(head, after, k));
  let kind;
  let paths = [];
  if (outside.length) { kind = 'hand'; paths = outside; }
  else if (asAfter) kind = 'assigned';
  else if (keys.every(unassigned)) kind = 'unassigned';
  else { kind = 'hand'; paths = keys.filter((k) => unassigned(k) && !eq(head, after, k)); }
  const reassign = kind === 'unassigned' ? keys.filter((k) => recorded(k) && !eq(head, before, k)) : [];
  const current = kind === 'assigned' && gitOk(root, ['merge-base', '--is-ancestor', tip, headRev]);
  const citations = citationsOf(root, reader, { mergeBase, head: headRev, tip, own: new Set(computed.adrs.map((a) => a.slug)), noteText: `${note.title ?? ''}\n${note.body ?? ''}` });
  return { kind, paths, current, base, citations, adrs: computed.adrs, reassign };
}

// What `collectState` records of the release rule for nextStep (D-8): { applies: false }, or `noted` and, for a noted change, its `state` and
// the release `file` the project names (the conductor's classification reads it, D-31); for a change with no note the pack folders it
// changes with no bump of its own and the unnumbered record it lists, as `noRelease`.
function releaseDelivery(root, id, facts) {
  const rf = releaseFacts(root, id, facts);
  if (!rf.applies) return { applies: false };
  const base = facts.base ?? 'main';
  if (rf.noted) return { applies: true, noted: true, base, file: rf.file, state: releaseState(root, id, facts) };
  const things = [...unbumpedPacks(root, facts), ...changeAdrs(root, null, id).slice(0, 1)];
  return { applies: true, noted: false, base, noRelease: things.length ? `no release: ${things.join(', ')}: the change has no release note and no version bump of its own; write openspec/changes/${id}/release.md` : null };
}

// The pack folders (`plugins/<dir>`) with a file the branch changed since its merge base with origin/<base> whose manifest version is the merge base's.
function unbumpedPacks(root, facts) {
  const tip = facts.base && facts.head ? baseTip(root, facts.base) : null;
  if (!tip) return [];
  let mergeBase;
  try { mergeBase = git(root, ['merge-base', facts.head, tip]).trim(); } catch { return []; }
  const reader = repoReader(root);
  const dirs = new Set(git(root, ['diff', '--name-only', '-z', '--no-renames', mergeBase, facts.head]).split('\0').flatMap((p) => /^plugins\/([^/]+)\//.exec(p)?.[1] ?? []));
  const versionAt = (rev, dir) => { try { return JSON.parse(reader.file(rev, `plugins/${dir}/.claude-plugin/plugin.json`) ?? 'null')?.version ?? null; } catch { return null; } };
  return [...dirs].filter((dir) => reader.file(facts.head, `plugins/${dir}/.claude-plugin/plugin.json`) !== null && versionAt(mergeBase, dir) === versionAt(facts.head, dir)).sort().map((dir) => `plugins/${dir}`);
}

// ---------------------------------------------------------------- next step and summary

// { met, summary }: "ready" at 8/8, else the lowest blocked item, else the
// lowest open item.
export function summarize(items) {
  const met = items.filter((i) => i.status === 'met').length;
  if (met === items.length) return { met, summary: 'ready' };
  const blockedItem = items.find((i) => i.status === 'blocked');
  if (blockedItem) return { met, summary: `blocked: item ${blockedItem.id}` };
  return { met, summary: `in progress: item ${items.find((i) => i.status !== 'met').id}` };
}

const uniq = (list) => [...new Set(list)];

// What GitHub is waiting for, from the PR's mergeStateStatus (design D6).
export function waitingFor(status) {
  if (['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(status)) return 'GitHub to merge';
  if (status === 'BLOCKED') return 'branch rules outside the delivery contract (for example a required approval)';
  if (status === 'UNKNOWN') return 'GitHub to compute mergeability';
  return `GitHub (mergeStateStatus ${status})`;
}

// The post-merge rows P0-P14 (archive-after-merge D7), first match wins. Runs
// when the change PR is merged or the change is archived locally; every item
// is met, so the rows read `state.archive`, not the eight items.
function archiveNext(state) {
  const a = state.archive;
  const merge = state.ship === 'merge';
  const step = (name, reason, extra = {}) => ({ step: name, reason, ...extra });
  const stopArchive = (archiveStep, reason, extra = {}) => step('stop-archive', reason, { archiveStep, ...extra });

  const two = a.testBranch ? a : null; // `two-prs` (D-10): the test branch's archive is part of the answer
  const testArchiveBranch = `chore/archive-${state.id}-${a.testBranch}`;
  const openTestArchive = () => step('open-test-archive-pr', `open the archive pull request of ${state.id} to ${a.testBranch}`, {
    branch: testArchiveBranch, base: a.testBranch, from: a.branch, path: a.testLocal.path, exists: a.testLocal.exists,
    title: `chore(openspec): archive ${state.id} with its retro (${a.testBranch})`,
  });
  // The archive pull requests still open, as the owner reads them: "#5 to main, #6 to develop".
  const readyBoth = () => {
    const open = [[a.pr, a.base], [a.testPr, a.testBranch]].filter(([p]) => p?.state === 'OPEN');
    return step('archive-prs-ready', `archive pull requests ${open.map(([p, to]) => `#${p.number} to ${to}`).join(', ')} are open; merge them, then run again`, { list: open.map(([p, to]) => `#${p.number} to ${to}`).join(', ') });
  };
  // R1 to R3 (release-tags D-4): the release a merge made, the change's before the archive's, ahead of every other row.
  const release = [a.release?.change, a.release?.archive].find((r) => r && r.state !== 'none' && r.state !== 'done');
  if (release?.state === 'unreadable') return stopArchive('tag-release', release.reason, { number: release.number });
  if (release?.state === 'elsewhere') {
    const { tag, at, sha, number } = release;
    return stopArchive('tag-release', `tag ${tag} on origin is at ${at.slice(0, 7)}, not at ${sha.slice(0, 7)}, the merge commit of PR #${number}; the loop never moves a tag`, { tag, at, sha, number });
  }
  if (release?.state === 'missing') {
    const { tag, sha, number, merged, version, file, base } = release;
    return step('tag-release', `PR #${number} merged version ${version} of ${file} at ${sha.slice(0, 7)}, and origin has no tag ${tag}`, { tag, sha, number, merged, version, file, base });
  }
  if (a.onDefault === 'archived' && (!two || a.onTest === 'archived')) return step('archived', `${a.folder} is on ${a.base}`, { folder: a.folder });
  if (two?.testLocal) {
    const t = two.testPr;
    const names = (checks) => checks.failing.map((c) => c.name).join(', ');
    if (two.testLocal.picking) {
      return stopArchive('test-archive-cherry-pick', `the archive commits of ${state.id} conflict on ${two.testBranch} in ${two.testLocal.worktree}: ${two.testLocal.picking.join(', ')}; finish with git cherry-pick --continue there, or abort it and delete ${testArchiveBranch}`);
    }
    if (t?.state === 'CLOSED') return stopArchive('test-archive-pr', `archive pull request #${t.number} to ${two.testBranch} was closed without merging`);
    if (t?.state === 'OPEN' && (t.checks.failing.length > 0 || t.checks.error != null)) {
      return stopArchive('test-archive-pr', t.checks.error ? `cannot read the checks of archive pull request #${t.number} to ${two.testBranch}: ${t.checks.error}` : `archive pull request #${t.number} to ${two.testBranch} has failing checks: ${names(t.checks)}`);
    }
    if (t?.state === 'MERGED' && two.onTest !== 'archived') return stopArchive('test-archive-pr', `archive pull request #${t.number} to ${two.testBranch} is merged but ${two.testBranch} still has openspec/changes/${state.id}/; run again`);
  }
  if (a.stop) return stopArchive(a.stop.archiveStep, a.stop.reason);
  if (two && a.onDefault === 'archived') return two.testPr ? readyBoth() : openTestArchive();
  const five = state.items[4];
  if (five.status === 'blocked') return step('blocked', five.reason, { item: 5, ...(five.details.conflict ? { conflict: true } : {}) });
  if (merge && state.setup && !state.setup.ok) {
    return step('stop-merge-setup', `merge mode needs the repository prepared: ${state.setup.missing.join('; ')}`, { missing: state.setup.missing });
  }

  const pr = a.pr;
  const train = state.train ?? null;
  const brief = (ps) => ps.map(({ n, targets, kind }) => ({ n, targets, kind }));
  const unanswered = a.retro.proposals.filter((p) => p.answer === null);
  const answersStop = () => step('stop-retro-answers', `${unanswered.length} retro proposal${unanswered.length > 1 ? 's' : ''} waiting for the owner's answer`, { proposals: brief(unanswered) });
  const filesStop = () => {
    if (a.changed?.missing) return stopArchive('archive', `origin/${a.base} is not available; git fetch origin ${a.base}`);
    const offending = unnamedFiles(a.changed?.paths ?? [], a.retro.proposals, a.changed?.texts);
    return offending.length ? stopArchive('apply-proposals', `files no approved proposal names: ${offending.join(', ')}`) : null;
  };

  if (pr?.state === 'OPEN') {
    // The answers and the file check hold while the PR is open too (D8): nothing a
    // proposal does not name may reach auto-merge. Without an archived folder or a
    // readable retro there is nothing to check them against, so that state is a
    // stop, never a pass.
    let held;
    if (a.local !== 'archived') held = stopArchive('archive', `archive PR #${pr.number} is open but ${state.id} is not archived in this working tree; the answers and files cannot be checked`);
    else if (!a.retro.readable) held = stopArchive('retro', `archive PR #${pr.number} is open but retro.md has no "## Proposed updates" section; the answers and files cannot be checked`);
    else held = unanswered.length ? answersStop() : filesStop();
    const conflicts = pr.mergeable === 'CONFLICTING';
    const failing = pr.checks.failing.length > 0 || pr.checks.error != null;
    const uncommitted = a.dirty.length > 0;
    // P3a: in a train project auto-merge on an archive pull request is disabled whenever it is on (delivery-train D-2).
    if (train && pr.autoMerge) return step('disable-auto-merge', `auto-merge is on for the archive PR #${pr.number} but an archive of a delivery train never merges by itself`, { number: pr.number });
    if (merge && pr.autoMerge && (held || conflicts || failing || pr.headRel !== 'same' || uncommitted)) {
      return step('disable-auto-merge', `auto-merge is on but the archive PR #${pr.number} no longer qualifies`, { number: pr.number });
    }
    if (held) return held;
    if (conflicts && !train) return stopArchive('archive-pr', `PR #${pr.number} has merge conflicts with ${a.base}`, { conflict: true });
    if (pr.headRel === 'foreign') return stopArchive('archive-pr', `PR #${pr.number} head ${String(pr.headRefOid).slice(0, 7)} is not in local history (someone else pushed?)`);
    if (pr.headRel === 'ahead' || uncommitted) {
      return step('open-archive-pr', `${pr.headRel === 'ahead' ? `local is ahead of PR head ${String(pr.headRefOid).slice(0, 7)}` : `uncommitted files: ${a.dirty.slice(0, 3).join(', ')}`}; commit and push`, { branch: a.branch, number: pr.number });
    }
    if (failing) {
      const f = pr.checks.failing.map((c) => `${c.name} (${c.link})`).join(', ');
      return stopArchive('archive-pr', pr.checks.error ? `cannot read the checks: ${pr.checks.error}` : `failing ${f}`);
    }
    if (merge && !train && pr.mergeStateStatus === 'BEHIND') return step('update-branch', `archive PR #${pr.number} is behind ${a.base}; update it`, { number: pr.number });
    if (train) {
      // A1 to A5 take the place of P3g to P3i: where an archive stands on the trains.
      if (train.error) return stopArchive('archive-pr', `cannot read the train pull requests: ${train.error}`);
      const left = train.left;
      if (left?.state === 'OPEN') return step('wait-train', `train ${left.n} left the archive of ${state.id} at this head and its pull request #${left.number} is open`, { number: left.number, train: left.n, waitingFor: `pull request #${left.number} of train ${left.n}` });
      if (left?.why === 'red') return stopArchive('train-left', `the archive of ${state.id} left train ${left.n} because the suite failed with it; its record attaches the failure:\n${left.failure ?? '(none)'}`, { train: left.n, number: left.number });
      if (left) return step('rejoin-archive', `the archive of ${state.id} left train ${left.n} for a conflict`, { number: pr.number, branch: a.branch, base: a.base, paths: pathsOfDetail(left.detail), train: left.n });
      if (train.onTrain) return step('on-train', `the archive of ${state.id} is carried by train ${train.onTrain.n}, pull request #${train.onTrain.number}`, { number: train.onTrain.number, train: train.onTrain.n, url: train.onTrain.url, waitingFor: `pull request #${train.onTrain.number} of train ${train.onTrain.n}` });
      return step('boarded', `the archive PR #${pr.number} is ready; it leaves with the next train`, { number: pr.number });
    }
    if (two && !merge) return two.testPr ? readyBoth() : openTestArchive();
    if (!merge) return step('archive-pr-ready', `archive PR #${pr.number} is open; merge it, then run again`, { number: pr.number, url: pr.url });
    if (!pr.autoMerge) return step('enable-auto-merge', `archive PR #${pr.number} qualifies`, { number: pr.number, method: state.mergeMethod, head: state.head });
    return step('wait-merge', 'auto-merge is on; GitHub merges once its rules pass', { number: pr.number, head: pr.headRefOid, waitingFor: waitingFor(pr.mergeStateStatus) });
  }
  if (pr?.state === 'MERGED') return stopArchive('archive-pr', `PR #${pr.number} is merged but ${a.base} still has openspec/changes/${state.id}/; run again`);
  if (pr?.state === 'CLOSED') return stopArchive('archive-pr', `PR #${pr.number} was closed without merging; reopen it (the flow opens no second archive PR)`);

  if (!a.retro.exists) {
    const f = state.forced;
    return step('retro', f ? `PR #${f.number} merged by the owner with ${f.count} items open: ${f.items.map((i) => i.text).join('; ')}; run the retro` : 'the change PR is merged; run the retro',
      { number: a.changePr?.number ?? null, base: a.base, ...(f ? { forced: f } : {}) });
  }
  if (!a.retro.readable) return stopArchive('retro', 'retro.md has no "## Proposed updates" section');
  if (unanswered.length) return answersStop();
  if (a.local === 'active') return step('archive', 'archive the change on its own branch', { branch: a.branch, base: a.base, create: !a.branchExists });
  if (state.branch !== a.branch) return stopArchive('archive', `the change is archived in the working tree of ${state.branch || '(detached)'}, not on ${a.branch}`);
  if (a.roadmap.listed && !a.roadmap.ticked) return step('tick-roadmap', 'openspec/roadmap.md lists the change unticked', { line: a.roadmap.line });
  const toApply = a.retro.proposals.filter((p) => p.answer === 'approved' && !p.applied);
  if (toApply.length) return step('apply-proposals', `${toApply.length} approved proposal${toApply.length > 1 ? 's' : ''} not applied yet`, { proposals: brief(toApply) });
  const stopped = filesStop();
  if (stopped) return stopped;
  return step('open-archive-pr', 'commit the archive and open its pull request', { branch: a.branch, base: a.base, title: `chore(openspec): archive ${state.id} with its retro` });
}

// The owner's recorded plan approval (design D7): approval.md says
// "- Status: APPROVED" and its "- Readiness:" value is sha256:<first 12 hex of
// the sha256 of the current readiness.md>. A new readiness round changes the
// hash, so the owner is asked again. With `release` (the project names devkit.release_tag) the approval also covers the release note
// (release-at-merge D-9): `release` is the hash of release.md and `recordedRelease` the value of the "- Release note:" line, both present
// only when either is not null, and `ok` needs them equal; a change with no note keeps the four keys. A caller that does not say `release`
// gets the project's own setting (D-22): every reader of the approval checks the note.
export function approvalState(dir, { release } = {}) {
  const withNote = release ?? namesReleaseTag(changeRoot(dir));
  const readinessFile = join(dir, 'readiness.md');
  const readiness = existsSync(readinessFile)
    ? `sha256:${createHash('sha256').update(readFileSync(readinessFile)).digest('hex').slice(0, 12)}`
    : null;
  const file = join(dir, 'approval.md');
  const status = readValue(file, 'Status');
  const recorded = readValue(file, 'Readiness')?.toLowerCase() ?? null;
  const note = withNote ? releaseNoteHash(dir) : null;
  const recordedNote = withNote ? readValue(file, 'Release note')?.toLowerCase() ?? null : null;
  const covered = note === recordedNote;
  return {
    status, recorded, readiness,
    ...(note !== null || recordedNote !== null ? { release: note, recordedRelease: recordedNote } : {}),
    ok: status === 'APPROVED' && readiness !== null && recorded === readiness && covered,
  };
}

// An approval of the current readiness whose recorded release note is not the current one (row A1, release-at-merge D-8; D-22: the
// conductor's approve row and accept-decisions give the same reason).
export const noteMoved = (a) => a.status === 'APPROVED' && a.recorded === a.readiness && (a.release ?? null) !== (a.recordedRelease ?? null);

// The .md files under the change folder's specs/, by their path relative to the folder ('specs/<...>.md'), sorted.
function specFiles(dir) {
  const specs = join(dir, 'specs');
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { recursive: true })
    .map((p) => `specs/${String(p).split(sep).join('/')}`)
    .filter((rel) => rel.endsWith('.md') && statSync(join(dir, rel)).isFile())
    .sort();
}

// The one digest of the plan (coordinator-loop-fixes D-7): SHA-256 over proposal.md, design.md, tasks.md and every .md file
// under specs/ sorted by its path, each entry `<relative path>\0<bytes>\0` and a missing file `<relative path>\0<missing>\0`,
// with every checkbox of tasks.md read as `[ ]` (a tick is no plan edit). `sha256:<first 12 hex>`.
export function planDigest(dir) {
  const hash = createHash('sha256');
  const entry = (rel, bytes) => {
    hash.update(`${rel}\0`);
    hash.update(bytes ?? '<missing>');
    hash.update('\0');
  };
  const read = (rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel)) : null);
  entry('proposal.md', read('proposal.md'));
  entry('design.md', read('design.md'));
  const tasks = read('tasks.md');
  entry('tasks.md', tasks === null ? null : Buffer.from(tasks.toString('utf8').replace(/^(\s*[-*]\s+\[)[^\]\n]*(\])/gm, '$1 $2')));
  for (const rel of specFiles(dir)) entry(rel, read(rel));
  return `sha256:${hash.digest('hex').slice(0, 12)}`;
}

// The plan the owner approved against the plan files now (D-7): { plan, recorded, changed }. `recorded` is approval.md's
// "- Plan:" value, lowercased, or null; with no such line nothing is changed (an approval written before this rule).
export function planRevision(dir) {
  const plan = planDigest(dir);
  const recorded = readValue(join(dir, 'approval.md'), 'Plan')?.toLowerCase() ?? null;
  return { plan, recorded, changed: recorded !== null && recorded !== plan };
}

// The keys of the steps the main session records with `change-loop.mjs declare` (coordinator-loop-fixes D-1): the `declare`
// rows of change-loop.mjs's DECLARED, which this module cannot import (change-loop.mjs imports it); a test ties the two.
export const RECORDED_KEYS = ['gate-red', 'review-round'];

// The rounds of a review before the owner authorizes any more (D-4); each authorized round of a review's scope adds one.
export const REVIEW_ROUNDS = 2;

// The record of the declared steps, `<dir>/declared.json` (D-1): { steps, error }. A missing file is no step and no error; an
// empty or unparsable file, a value that is not an object, a version other than 1 or a `steps` that is not a list is no step and
// the error; an entry that is not an object, or whose key is not in RECORDED_KEYS, is skipped (a later version may add keys).
export function readDeclared(dir) {
  const file = join(dir, 'declared.json');
  if (!existsSync(file)) return { steps: [], error: null };
  const refused = (error) => ({ steps: [], error });
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) { return refused(`cannot read declared.json: ${e.code ?? e.message}`); }
  if (text.trim() === '') return refused('declared.json is empty');
  let value;
  try { value = JSON.parse(text); } catch { return refused('declared.json is not JSON'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return refused('declared.json holds no object');
  if (value.version !== 1) return refused(`declared.json has version ${JSON.stringify(value.version)}, not 1`);
  if (!Array.isArray(value.steps)) return refused('declared.json has no list of steps');
  const steps = value.steps.filter((s) => s !== null && typeof s === 'object' && !Array.isArray(s) && RECORDED_KEYS.includes(s.key));
  return { steps, error: null };
}

// The review rounds the owner authorized for the review `scope` ('review', the code review, or 'resolution', the review of a
// conflict resolution on the support branch): the `review-round` entries of declared.json of that scope, an entry with no scope
// counting as 'review'; 0 when the record cannot be read (D-4). The one count the delivery and the stage checkers read.
export function authorizedRounds(dir, scope) {
  const { steps, error } = readDeclared(dir);
  if (error) return 0;
  return steps.filter((s) => s.key === 'review-round' && (s.scope ?? 'review') === scope).length;
}

// The one step to take now, computed from facts only (see design D4, first
// match wins; evidence-before-review design D2 puts fix-defect and verify ahead
// of review). `state` is what collectState builds.
export function nextStep(state) {
  const it = (n) => state.items[n - 1];
  const step = (name, reason, extra = {}) => ({ step: name, reason, ...extra });

  const merge = state.ship === 'merge';
  const train = state.train ?? null;
  const allMet = state.items.every((i) => i.status === 'met');
  // T1: in a train project auto-merge is never on for a change's own pull request, whatever the contract says (delivery-train D-2).
  if (train && !state.archive && state.pr?.state === 'OPEN' && state.pr.autoMerge) {
    return step('disable-auto-merge', 'auto-merge is on but a change of a delivery train never merges by itself', { number: state.pr.number });
  }
  // Auto-merge is disabled before any stop or push once the contract drops below 8/8.
  if (merge && state.pr?.state === 'OPEN' && state.pr.autoMerge && !allMet) {
    return step('disable-auto-merge', `auto-merge is on but the contract is no longer met (${state.items.find((i) => i.status !== 'met').reason})`, { number: state.pr.number });
  }
  if (state.ship === 'plan') return step('stop-plan-mode', `ship mode for ${state.schema} is plan; follow the usual apply flow`);
  // The two-pull-request delivery (delivery-models D-4): present only in `two-prs`; every row of it reads `two`.
  const two = state.twoPrs ?? null;
  if (two && !two.defaultOk) {
    return step('blocked', two.defaultBranch ? `the base branch ${two.base} is not the repository's default branch ${two.defaultBranch}` : `cannot read the default branch on GitHub: ${two.defaultError ?? 'the answer has no default branch'}`);
  }
  // A change a merged train carried, whose pull request GitHub left open: closed with a comment before the post-merge rows (D-9).
  if (state.archive && state.carriedBy && state.pr?.state === 'OPEN') {
    const { n, number, mergeCommit } = state.carriedBy;
    const comment = `Delivered by train ${n} in #${number} (merge commit ${String(mergeCommit ?? '').slice(0, 7)}).`;
    return step('close-boarded-pr', `train ${n} (pull request #${number}) carried ${state.id}; close its pull request #${state.pr.number} with a comment`, { number: state.pr.number, train: n, trainNumber: number, comment });
  }
  if (state.archive) return archiveNext(state);
  // The merge of the change's pull request cannot be told from here (forced-merge-path D-4): blocked, whatever the checkout.
  if (state.unreadMerge) {
    const { number, error } = state.unreadMerge;
    return step('blocked', number == null ? `cannot find the merged pull request of ${state.id}: ${error}` : `cannot tell whether PR #${number} of ${state.id} was merged by the owner: ${error}`, { number });
  }
  if (!state.branchOk) {
    const m = state.mergedLeft;
    if (m) return step('stop-branch', `PR #${m.number} of ${state.id} merged with tasks left (${m.tasks.join(', ')}); continue on branch ${state.id} and open a further pull request`, { number: m.number, tasks: m.tasks });
    return step('stop-branch', `the current branch does not select change ${state.id} for the hooks; create or switch to a branch named after it`);
  }
  if (state.needsReadiness && state.readiness !== 'APPROVED') {
    return step('stop-not-approved', `readiness.md Status is ${state.readiness || 'missing'}, expected APPROVED; the plan needs its approval first`);
  }
  if (state.needsReadiness && state.readiness === 'APPROVED' && state.approval && !state.approval.ok) {
    const a = state.approval;
    // A1 (release-at-merge D-8): the readiness is the approved one and the release note is not the recorded one, whether or not a task is ticked.
    // A started change is otherwise resumed without its approval, unless that approval records a plan the plan files no longer match
    // (coordinator-loop-fixes D-7).
    const moved = noteMoved(a);
    if (moved || !state.started || state.plan?.changed) {
      const earlier = a.status === 'APPROVED' && a.recorded;
      return step('stop-plan-approval', moved ? 'release note changed after approval' : earlier ? 'approval.md is for an earlier readiness.md' : 'no recorded owner approval', {
        readiness: a.readiness,
        ...(a.release != null ? { release: a.release } : {}),
        plan: state.plan?.plan ?? null,
        file: `openspec/changes/${state.id}/approval.md`,
      });
    }
  }
  if (merge && state.setup && !state.setup.ok) {
    return step('stop-merge-setup', `merge mode needs the repository prepared: ${state.setup.missing.join('; ')}`, { missing: state.setup.missing });
  }
  for (const p of state.phases) {
    if (p.open.length) {
      // D-6: the tasks the conducting session does are never handed to the implementer; it stops before the first one.
      const conductor = p.conductor ?? [];
      const leading = [];
      for (const id of p.open) {
        if (!conductor.includes(id)) break;
        leading.push(id);
      }
      if (leading.length) return step('conductor-task', `phase ${p.n} has tasks the conducting session does: ${leading.join(', ')}`, { phase: p.n, tasks: leading });
      const stopAt = p.open.find((id) => conductor.includes(id));
      return step('implement', `phase ${p.n} has unticked tasks: ${p.open.join(', ')}`, { phase: p.n, ...(stopAt ? { stopAt } : {}) });
    }
    if (p.gate && !p.gate.done) {
      return step('gate', `phase ${p.n} is implemented; run its gate ${p.gate.id}`, { phase: p.n, task: p.gate.id, command: p.gate.command });
    }
  }
  if (state.dirty.length) return step('commit', `uncommitted changes outside openspec/: ${state.dirty.slice(0, 3).join(', ')}`, { paths: state.dirty });

  // N1 to N4 and N7 (release-at-merge D-8): the release a project that names devkit.release_tag holds, judged before the reviews.
  const rel = state.release?.applies ? state.release : null;
  const noted = Boolean(rel?.noted) && !train;
  if (rel && !rel.noted && rel.noRelease) return step('blocked', rel.noRelease);
  if (rel?.noted) {
    const r = rel.state;
    if (r.kind === 'error') return step('blocked', r.error);
    if (r.kind === 'hand') return step('blocked', `release lines edited by hand: ${r.paths.join(', ')}`);
    if (!train && r.citations.unlanded.length) return step('blocked', r.citations.unlanded.map((slug) => `ADR [${slug}] is cited but has not landed on ${rel.base}`).join('; '));
  }

  const rejectedNow = state.reviews.filter((r) => r.current && !approved(r.verdict)).map((r) => r.name);
  const roundLimit = state.roundLimit ?? REVIEW_ROUNDS;
  if (rejectedNow.length && state.reviewMd?.consensus === 'FAIL' && state.reviewMd.round >= roundLimit) {
    return step('stop-review-deadlock', `${rejectedNow.join(', ')} still rejects after round ${roundLimit}; the owner decides`, { reviewers: rejectedNow });
  }
  // An approved verdict at the current commit that still lists an undisposed finding is fixed, not re-reviewed.
  const approvedOpen = uniq(it(3).details.undisposed.map((f) => f.reviewer)
    .filter((n) => state.reviews.some((r) => r.name === n && r.current && approved(r.verdict))));
  const fix = uniq([...rejectedNow, ...approvedOpen]);
  if (fix.length) {
    const reason = [
      rejectedNow.length ? `${rejectedNow.join(', ')} rejected at the current commit` : '',
      approvedOpen.length ? `${approvedOpen.join(', ')} approved with an undisposed finding` : '',
    ].filter(Boolean).join('; ');
    // A fix written in the change folder and not committed goes to commit first (jira-entry-followups D-2).
    const planDirty = state.planDirty ?? [];
    if (planDirty.length) return step('commit', `the fix for ${fix.join(', ')} is not committed: ${planDirty.slice(0, 3).join(', ')}`, { paths: planDirty });
    return step('fix-review', reason, {
      reviewers: fix,
      findings: it(3).details.undisposed.filter((f) => fix.includes(f.reviewer)),
    });
  }
  const ac = it(4).details;
  if (ac.defects.length && ac.evidence === 'current') {
    return step('fix-defect', `evidence records a fail/defect for ${ac.defects.join(', ')}`, { defects: ac.defects });
  }
  const gatesOpen = it(1).status === 'open' && (it(1).details.evidence !== 'current' || it(1).details.missingGates.length > 0);
  const acOpen = ac.ids.length > 0 && (ac.evidence !== 'current' || ac.missing.length > 0);
  if (gatesOpen || acOpen) return step('verify', 'evidence.md is missing, stale or lacks a gate or criterion row');
  const toReview = uniq([
    ...it(2).details.missing, ...it(2).details.stale,
    ...it(3).details.undisposed.map((f) => f.reviewer),
  ]);
  if (toReview.length) {
    // The review round runs on a clean change folder (loop-place-and-evidence D-2): its commit first, with no product path.
    if (state.folderDirty?.length) {
      return step('commit', `uncommitted files in the change folder before the review round: ${state.folderDirty.slice(0, 3).join(', ')}`, { paths: [] });
    }
    const reRejected = toReview.some((n) => {
      const r = state.reviews.find((x) => x.name === n);
      return r && !approved(r.verdict);
    });
    const last = state.reviewMd?.round ?? 0;
    const round = state.reviewMd?.consensus === 'FAIL' && reRejected && last >= 1 && last < roundLimit ? last + 1 : 1;
    return step('review', `review needed from ${toReview.join(', ')}`, { reviewers: toReview, round, ...(roundLimit > REVIEW_ROUNDS ? { limit: roundLimit } : {}) });
  }
  const stuck = [1, 2, 3, 4].find((n) => it(n).status === 'blocked');
  if (stuck) return step('blocked', it(stuck).reason, { item: stuck });
  if (train?.error) return step('blocked', `cannot read the train pull requests: ${train.error}`);
  if (train?.left) {
    const { n, number, state: ended, why, detail, failure } = train.left;
    // T2 and T3: a train took the change off at this head; it waits while that train is open, then goes back to its cycle (D-7).
    if (ended === 'OPEN') return step('wait-train', `train ${n} left ${state.id} at this head and its pull request #${number} is open`, { number, train: n, waitingFor: `pull request #${number} of train ${n}` });
    return step('rejoin-train', `train ${n} left ${state.id} (${why === 'red' ? 'the suite failed with it' : 'it conflicts with the train'}); merge the base branch into it and fix it`, { number, train: n, why, paths: why === 'red' ? [] : pathsOfDetail(detail), failure });
  }
  if (two?.foreign) return step('blocked', `${two.foreign.sha.slice(0, 7)} (${two.foreign.subject}) is on ${two.testBranch} and not on ${two.base}; the task branch never receives ${two.testBranch}`);

  if (two?.test.error) return step('blocked', `cannot read the pull requests to ${two.testBranch}: ${two.test.error}`);
  // Before every row that opens, pushes or edits (spec: a blocked row writes nothing).
  if (two?.test.pr?.state === 'CLOSED') return step('blocked', `pull request #${two.test.pr.number} to ${two.testBranch} was closed without merging`);
  if (it(5).details.none) {
    if (!two) return step('open-pr', 'no pull request yet');
    return two.test.pr
      ? step('open-pr', 'no pull request to the base branch yet', { base: two.base })
      : step('open-prs', 'no pull request yet', { branch: state.branch, base: two.base, testBranch: two.testBranch });
  }
  // T5: in a train project a conflict with the base, or being behind it, is not a stop and not an update (D-2).
  const five = it(5).details;
  const trainGoOn = Boolean(train) && ((it(5).status === 'blocked' && five.conflict === true)
    || (it(5).status === 'open' && five.behind === true && !five.ahead && !five.uncommitted.length));
  // N5 (D-8): with a note the release step takes the place of the conflict stop and of the update of a branch behind its base.
  // `conflict: true` marks the one in place of the conflict stop: the conductor reads it for the checks that need GitHub's report (D-31).
  const assign = (reason, extra = {}) => step('assign-release', reason, {
    number: state.pr.number, base: rel.base, branch: state.branch,
    command: ['node', fileURLToPath(new URL('./release-merge.mjs', import.meta.url)), '--assign', '--base', rel.base, '--json'],
    ...extra,
  });
  if (noted && it(5).status === 'blocked' && five.conflict === true) return assign(it(5).reason, { conflict: true });
  if (it(5).status === 'blocked' && !trainGoOn) return step('blocked', it(5).reason, { item: 5, ...(five.conflict ? { conflict: true } : {}) });
  const behind = merge && !train && it(5).status === 'open' && five.behind && !five.ahead && !five.uncommitted.length;
  if (noted && behind) return assign(it(5).reason);
  if (behind) return step('update-branch', it(5).reason, { number: state.pr.number });
  if (it(5).status === 'open' && !trainGoOn) return step('push', it(5).reason);
  if (it(8).status === 'open') return step('edit-pr-body', it(8).reason, { missing: it(8).details.missing });
  const reviewsCheck = it(6).details.failing.find((f) => f.name === DEVKIT_REVIEWS_CHECK);
  if (two) {
    const t = two.test;
    const sup = two.support;
    if (t.none) return step('open-test-pr', `no pull request to ${two.testBranch} yet`, { head: sup.exists && sup.pushed ? sup.branch : state.id, base: two.testBranch });
    if (t.pr.state === 'OPEN') {
      if (sup.merging) return step('resolve-support-conflict', `the merge of ${two.testBranch} into ${sup.branch} has conflicts`, { root: sup.path, branch: sup.branch, paths: sup.merging });
      if (sup.exists && !sup.worktree) return step('checkout-support', `${sup.branch} has no worktree`, { path: sup.path, branch: sup.branch });
      const res = two.resolution;
      if (res.error) return step('blocked', res.error);
      if (!res.approved) {
        const limit = res.limit ?? REVIEW_ROUNDS;
        if (res.rejected.length && res.round?.consensus === 'FAIL' && res.round.round >= limit) {
          return step('stop-review-deadlock', `${res.rejected.join(', ')} still rejects the resolution after round ${limit}; the owner decides`, { reviewers: res.rejected, resolution: true });
        }
        const approvedOpen = uniq(res.undisposed.map((f) => f.reviewer)
          .filter((n) => res.verdicts.some((v) => v.name === n && !res.stale.includes(n) && approved(v.verdict))));
        const fix = uniq([...res.rejected, ...approvedOpen]);
        if (fix.length) {
          const why = [
            res.rejected.length ? `${res.rejected.join(', ')} rejected the resolution at its newest commit` : '',
            approvedOpen.length ? `${approvedOpen.join(', ')} approved with an undisposed finding` : '',
          ].filter(Boolean).join('; ');
          return step('fix-resolution', why, { root: sup.path, branch: sup.branch, findings: res.undisposed.filter((f) => fix.includes(f.reviewer)) });
        }
        const again = res.verdicts.some((v) => !approved(v.verdict) && [...res.stale, ...res.missing].includes(v.name));
        const last = res.round?.round ?? 0;
        const round = res.round?.consensus === 'FAIL' && again && last >= 1 && last < limit ? last + 1 : 1;
        return step('review-resolution', `the resolution on ${sup.branch} needs a review from ${uniq([...res.missing, ...res.stale]).join(', ')}`, {
          root: two.root, support: sup.branch, commits: res.commits.map(({ sha, subject }) => ({ sha, subject })), diffs: res.commits.map((c) => c.diff), commit: res.newest, round,
          ...(limit > REVIEW_ROUNDS ? { limit } : {}),
        });
      }
      if (sup.exists && !sup.hasTask) return step('merge-into-support', `${sup.branch} lacks the task branch ${state.id}`, { root: sup.path, branch: sup.branch, from: state.id });
      if (t.pr.mergeable === 'CONFLICTING' && (!sup.exists || !sup.hasTest || t.pr.headRefName === sup.branch)) {
        return step('merge-into-support', `pull request #${t.pr.number} to ${two.testBranch} conflicts with it`, { root: sup.path, branch: sup.branch, from: `origin/${two.testBranch}`, create: !sup.exists });
      }
      if (sup.exists && !sup.pushed) return step('push-support', `${sup.branch} is not on the remote`, { root: sup.path, branch: sup.branch });
      if (sup.exists && t.pr.headRefName !== sup.branch) {
        return step('move-test-pr', `pull request #${t.pr.number} to ${two.testBranch} moves to ${sup.branch}`, { head: sup.branch, base: two.testBranch, replaces: t.pr.number });
      }
      if (t.body.status === 'open') return step('edit-pr-body', t.body.reason, { number: t.pr.number, missing: t.body.details.missing });
      if (t.checks.status === 'blocked') return step('blocked', t.checks.reason);
      if (t.checks.details.failing.length) return step('fix-checks', t.checks.reason, { number: t.pr.number, failing: t.checks.details.failing });
      if (t.checks.details.pending.length) return step('wait-checks', t.checks.reason, { number: t.pr.number, pending: t.checks.details.pending });
      return step('ready-test-branch', `pull request #${t.pr.number} to ${two.testBranch} is green; the owner merges it first`, { number: t.pr.number, branch: two.testBranch, base: two.base, baseNumber: state.pr.number });
    }
    if (two.rerun && reviewsCheck) return step('rerun-checks', `${DEVKIT_REVIEWS_CHECK} failed before ${two.testBranch} merged; run it again`, { number: state.pr.number, runs: two.rerun.runs });
  }
  if (reviewsCheck && [1, 2, 3, 4].every((n) => it(n).status === 'met')) {
    return step('blocked', `${DEVKIT_REVIEWS_CHECK} fails in CI while items 1-4 are met locally: ${reviewsCheck.link}`, { item: 6 });
  }
  if (it(6).details.failing.length) {
    return step('fix-checks', it(6).reason, { failing: it(6).details.failing });
  }
  const talk = it(7).details;
  if (talk.threads.length || talk.comments.length || talk.changesRequested.length) {
    return step('answer', it(7).reason, { threads: talk.threads, comments: talk.comments, changesRequested: talk.changesRequested });
  }
  const waiting = [6, 7].find((n) => it(n).status === 'blocked');
  if (waiting) return step('blocked', it(waiting).reason, { item: waiting });
  // Pending checks board (ADR 0022 decision 2): they are never the wait of a train project.
  if (it(6).details.pending.length && !train) return step('wait-checks', it(6).reason, { pending: it(6).details.pending });
  const left = state.items.find((i) => i.status !== 'met' && !(train && ((i.id === 5 && trainGoOn) || (i.id === 6 && i.status === 'open' && !i.details.failing.length))));
  if (left) return step('blocked', left.reason, { item: left.id });
  // T8 and T9: nothing is left to do for the change itself.
  if (train?.onTrain) return step('on-train', `carried by train ${train.onTrain.n}, pull request #${train.onTrain.number}`, { number: train.onTrain.number, train: train.onTrain.n, url: train.onTrain.url, waitingFor: `pull request #${train.onTrain.number} of train ${train.onTrain.n}` });
  if (train) return step('boarded', 'every item of the contract is met; the change leaves with the next train', { number: state.pr.number });
  // N6 (D-8): the last step before the merge, until the branch holds the base and the release computed from it.
  if (noted && !rel.state.current) {
    return assign(rel.state.kind === 'unassigned' ? `the release of ${state.id} is not assigned yet; assign it before the merge` : `${rel.base} moved since the release of ${state.id} was assigned; assign it again`);
  }
  if (two) return step('ready-base', 'all eight items are met', { number: state.pr.number, base: two.base });
  if (!merge) return step('ready', 'all eight items are met');
  if (state.pr.autoMerge) return step('wait-merge', 'auto-merge is on; GitHub merges once its rules pass', { number: state.pr.number, head: state.pr.headRefOid, waitingFor: waitingFor(state.pr.mergeStateStatus) });
  return step('enable-auto-merge', 'all eight items are met', { number: state.pr.number, method: state.mergeMethod, head: state.head });
}

// ---------------------------------------------------------------- collecting the facts

export function currentBranch(root, env) {
  if (env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF) return env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF;
  try { return git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).trim(); } catch { return ''; }
}

export function defaultBranches(root) {
  const names = ['main', 'master'];
  try { names.push(git(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, '')); } catch { /* no remote */ }
  return names;
}

// The last "Consensus: PASS | FAIL (round N/2)" line of review.md, or null.
export function readReviewMd(file) {
  if (!existsSync(file)) return null;
  const all = [...readFileSync(file, 'utf8').matchAll(/^\s*\**Consensus\**\s*:\s*\**\s*(PASS|FAIL)\b(?:[^\n(]*\(\s*round\s+(\d+)\s*\/\s*\d+\s*\))?/gim)];
  const last = all.at(-1);
  return last ? { consensus: last[1].toUpperCase(), round: last[2] ? Number(last[2]) : null } : null;
}

// Everything nextStep and the report need: the eight items and the facts
// behind the step choice. Reads files, git and (through gh) GitHub; writes nothing.
export function collectState(root, id, { env = process.env, gh = makeGh(root, env), prNumber = null } = {}) {
  const located = locateChange(root, id) ?? { dir: changeDir(root, id), archived: false };
  const dir = located.dir;
  const schema = schemaOf(root, located);
  const { ship, mergeMethod, model, base: configuredBase, testBranch, train: trainSuite } = deliveryConfig(root, schema);
  const facts = gitFacts(root, { base: stalenessBase(root, env, configuredBase) });
  const two = model === 'two-prs';
  // The delivery train (delivery-train D-2): on for a change of a devkit script in a project that sets `devkit.delivery.train`.
  const trainOn = trainSuite !== null && isDevkitScript(schema);
  const branch = currentBranch(root, env);
  const selected = resolveChange(root, env, branch);
  const merge = ship === 'merge';
  const delivery = deliveryOf(gh, root, id, { ship, branch, env, located, number: prNumber, mergeFields: merge || trainOn, ...(trainOn ? { trainSuite } : {}), ...(two ? { base: configuredBase } : {}) });
  const fetched = delivery.fetched;
  // The post-merge phase: the change is delivered, its own PR merged with every task ticked on the default
  // branch, or its folder already moved (design D4, field-fixes D-4).
  // An owner's forced merge enters it too, its items 1 and 6 open (forced-merge-path D-4).
  const forced = delivery.forced;
  const postMerge = ship !== 'plan' && (delivery.delivered || Boolean(forced));
  const repo = merge || postMerge || two ? (delivery.repo ?? readRepoSettings(gh)) : null;
  const mergedLeft = delivery.merged && !delivery.delivered && delivery.left.length && !forced && !delivery.unreadMerge
    ? { number: fetched.pr?.number ?? fetched.mergedBefore, tasks: delivery.left }
    : null;
  const common = {
    id,
    schema,
    ship,
    mergeMethod,
    branch,
    head: facts.head,
    dirty: facts.dirty,
    mergedLeft,
    forced,
    unreadMerge: delivery.unreadMerge,
    ...(merge ? { setup: mergeSetup(gh, root, trainOn ? 'merge' : mergeMethod, repo) } : {}),
  };
  // The facts of the two-pull-request delivery (D-4): the base is the repository's default branch, the pull request to the test
  // branch and, once it merged, the base checks that ran before it. `checks` is the base pull request's item 6.
  const twoPrsOf = (acIds, checks) => {
    const defaultBranch = repo?.settings?.default_branch ?? null;
    const test = findTestPr(gh, { id, testBranch, acIds });
    const support = supportState(root, id, testBranch);
    const taskRef = gitOk(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${id}`]) ? `refs/heads/${id}` : 'HEAD';
    const resolution = { ...resolutionState(root, id, { taskRef, supportRef: support.exists ? `refs/heads/${support.branch}` : null }), limit: REVIEW_ROUNDS + authorizedRounds(dir, 'resolution') };
    return {
      base: configuredBase, testBranch, defaultBranch, defaultOk: defaultBranch === configuredBase, defaultError: repo?.error ?? null,
      foreign: testBranchCommit(root, { base: configuredBase, testBranch, head: 'HEAD' }),
      test, rerun: checks ? reviewsRerun(gh, checks, test) : null,
      root, support, resolution,
    };
  };
  const prFacts = (f) => (f.pr
    ? { number: f.pr.number, url: f.pr.url, state: f.pr.state, headRefOid: f.pr.headRefOid, mergeable: f.pr.mergeable ?? null, ...(merge || trainOn ? { autoMerge: f.pr.autoMergeRequest != null, mergeStateStatus: f.pr.mergeStateStatus ?? null } : {}) }
    : null);

  if (postMerge) {
    const pr = fetched.pr;
    const archive = archiveFacts(gh, root, id, { located, repo, facts, changePr: pr, branch, env, testBranch: two ? testBranch : null, releaseFile: releaseTagOf(root) });
    const checked = (n, name, details) => item(n, name, 'met', pr ? `checked before PR #${pr.number} merged` : 'checked before the change was archived', details);
    const forcedItem = (n, name, what, items, details) => item(n, name, 'open', `${what}: ${items.map((i) => i.text).join('; ')}`, details);
    const five = pr?.state === 'MERGED' && fetched.via === 'branch'
      ? prItem(root, id, fetched, facts, { merge: true })
      : item(5, 'pr', 'met', pr ? `PR #${pr.number} merged` : 'change archived; no merged PR found', { pr: pr ? { number: pr.number, url: pr.url } : null, merged: Boolean(pr) });
    return {
      ...common,
      branchOk: true,
      needsReadiness: false,
      readiness: null,
      approval: null,
      started: false,
      phases: [],
      reviewMd: null,
      reviews: [],
      planDirty: [],
      pr: prFacts(fetched),
      ...(two ? { twoPrs: twoPrsOf([], null) } : {}),
      archive,
      ...(trainOn ? { train: trainFacts(gh, root, id, { suite: trainSuite, prHead: archive.pr?.state === 'OPEN' ? archive.pr.headRefOid : null, kind: 'archive' }) } : {}),
      ...(delivery.carried ? { carriedBy: delivery.carried } : {}),
      items: [
        forced ? forcedItem(1, 'tasks', 'not done at the merge', forced.items.filter((i) => i.kind !== 'check'), { unticked: forced.items.filter((i) => i.kind === 'task').map((i) => i.id), missingGates: [], evidence: 'forced' })
          : checked(1, 'tasks', { unticked: [], missingGates: [], evidence: 'current' }),
        checked(2, 'reviews', { stale: [], rejected: [], missing: [] }),
        checked(3, 'findings', { fixed: 0, refuted: 0, undisposed: [] }),
        checked(4, 'acceptance', { ids: [], proven: [], missing: [], defects: [], noProof: [], evidence: 'current' }),
        five,
        forced ? forcedItem(6, 'checks', 'not green at the merge', forced.items.filter((i) => i.kind === 'check'), { required: true, failing: [], pending: [] })
          : checked(6, 'checks', { required: false, failing: [], pending: [] }),
        checked(7, 'conversation', { threads: [], comments: [], changesRequested: [], waiting: [] }),
        checked(8, 'body', { missing: [] }),
      ],
    };
  }

  const acceptance = acceptanceItem(root, id, facts);
  const items = [
    tasksItem(root, id, facts, { trainParts: trainOn ? trainParts(trainSuite) : [] }),
    reviewsItem(root, id, facts),
    findingsItem(root, id, facts),
    acceptance,
    prItem(root, id, fetched, facts, { merge }),
    checksItem(fetched, gh),
    conversationItem(fetched, gh),
    bodyItem(id, fetched, acceptance.details.ids),
  ];
  const needsReadiness = changeDeclares(root, dir, 'readiness'); // the flow the change follows (guard.mjs#changeFlow)
  // The train facts are read only once items 1 to 4 are met and the pull request is open: they cost one list and up to five records.
  const boardable = items.slice(0, 4).every((i) => i.status === 'met') && fetched.pr?.state === 'OPEN';
  return {
    ...common,
    branchOk: selected?.name === id && Boolean(branch) && !defaultBranches(root).includes(branch),
    needsReadiness,
    readiness: needsReadiness ? readValue(join(dir, 'readiness.md'), 'Status') : null,
    approval: needsReadiness ? approvalState(dir, { release: releaseFacts(root, id, facts).applies }) : null,
    // The plan the approval records against the plan files now (D-7); null for a flow with no readiness.
    plan: needsReadiness ? planRevision(dir) : null,
    started: existsSync(join(dir, 'tasks.md')) && parseTasks(readFileSync(join(dir, 'tasks.md'), 'utf8')).some((t) => t.done),
    phases: readPhases(join(dir, 'tasks.md')),
    reviewMd: readReviewMd(join(dir, 'review.md')),
    // The code review's round limit: REVIEW_ROUNDS plus the rounds the owner authorized for it (D-4).
    roundLimit: REVIEW_ROUNDS + authorizedRounds(dir, 'review'),
    reviews: readReviews(root, id, facts).map((r) => ({ name: r.name, verdict: r.verdict, current: !r.why })),
    release: releaseDelivery(root, id, facts),
    // The change folder's files edited and not committed, outside its own review record and the record of the declared steps
    // (coordinator-loop-fixes D-1): a plan fix waiting for its commit.
    planDirty: changedUnder(root, `openspec/changes/${id}`).filter((p) => !reviewRecord(id)(p) && p !== `openspec/changes/${id}/declared.json`),
    // The change folder's uncommitted paths (loop-place-and-evidence D-1): the review round waits for their commit.
    folderDirty: changedUnder(root, `openspec/changes/${id}`),
    pr: prFacts(fetched),
    ...(two ? { twoPrs: twoPrsOf(acceptance.details.ids, items[5]) } : {}),
    ...(trainOn ? { train: boardable && delivery.trainFacts ? delivery.trainFacts : trainFacts(gh, root, id, { suite: trainSuite, prHead: boardable ? fetched.pr.headRefOid : null, kind: 'change' }) } : {}),
    items,
  };
}

// ---------------------------------------------------------------- report and CLI

// 'app' inside the Claude desktop app, else 'cli'; DEVKIT_HOST=app|cli overrides.
export function detectHost(env = process.env) {
  if (env.DEVKIT_HOST === 'app' || env.DEVKIT_HOST === 'cli') return env.DEVKIT_HOST;
  return env.CLAUDE_CODE_ENTRYPOINT === 'claude-desktop' ? 'app' : 'cli';
}

const LABELS = ['tasks and gates', 'reviews at head', 'findings disposed', 'acceptance criteria proven',
  'PR open at local head', 'required checks green', 'conversation answered', 'PR body complete'];

// The JSON form (version 1) of a collected state.
export function buildReport(state, env = process.env) {
  const { met, summary: itemsSummary } = summarize(state.items);
  const next = nextStep(state);
  const merge = state.ship === 'merge';
  const summary = summaryOf(state, next, itemsSummary);
  return {
    version: 1,
    change: state.id,
    schema: state.schema,
    ship: state.ship,
    host: detectHost(env),
    head: state.head,
    pr: state.pr && { number: state.pr.number, url: state.pr.url },
    phases: state.phases,
    items: state.items.map(({ id, name, status, reason, details }) => ({ id, name, status, reason, details })),
    met,
    summary,
    next,
    ...(state.approval ? { approval: state.approval } : {}),
    ...(state.twoPrs ? { model: 'two-prs', twoPrs: twoPrsReport(state.twoPrs) } : {}),
    ...(merge ? {
      merge: {
        method: state.mergeMethod,
        setup: { ok: state.setup.ok, missing: state.setup.missing },
        autoMerge: state.pr?.autoMerge ?? false,
        state: state.pr?.state ?? null,
        mergeStateStatus: state.pr?.mergeStateStatus ?? null,
        waitingFor: next.step === 'wait-merge' ? next.waitingFor : null,
      },
    } : {}),
    ...(state.archive ? { archive: archiveReport(state.archive, next) } : {}),
  };
}

// The `twoPrs` object of the JSON report: the state names both pull requests, found on GitHub from the branch names (D-4).
function twoPrsReport(two) {
  const t = two.test.pr;
  return {
    base: two.base,
    testBranch: two.testBranch,
    testPr: t ? { number: t.number, url: t.url, state: t.state, head: t.headRefName } : null,
    support: two.support ? { branch: two.support.branch, exists: two.support.exists, pushed: two.support.pushed } : null,
  };
}

// The summary line (design D6, D7). Merge mode and the archive steps name their own
// end states; every other summary is the items'.
function summaryOf(state, next, itemsSummary) {
  if (state.archive) {
    switch (next.step) {
      case 'archived': return 'archived';
      case 'wait-merge': return `archive PR open: waiting for ${next.waitingFor}`;
      case 'archive-pr-ready': return 'archive PR ready';
      case 'archive-prs-ready': return 'archive PRs ready';
      case 'stop-retro-answers': return "archive: waiting for the owner's answers";
      case 'stop-archive': return `blocked: archive (${next.archiveStep})`;
      case 'stop-merge-setup': return 'blocked: merge setup';
      case 'blocked': return itemsSummary;
      default: return `merged: archive step ${next.step}`;
    }
  }
  if (next.step === 'stop-plan-approval') return "waiting for the owner's plan approval";
  if (next.step === 'boarded') return 'boarded: waiting for the next train';
  if (next.step === 'on-train') return `on train ${next.train}: waiting for its pull request #${next.number}`;
  if (next.step === 'wait-train') return `left train ${next.train}: waiting for its pull request #${next.number}`;
  if (state.ship !== 'merge') return itemsSummary;
  if (next.step === 'stop-merge-setup') return 'blocked: merge setup';
  if (next.step === 'wait-merge') return `auto-merge on: waiting for ${next.waitingFor}`;
  return itemsSummary;
}

// The `archive` object of the JSON report, present only after the merge (design D7).
function archiveReport(a, next) {
  return {
    base: a.base,
    branch: a.branch,
    changePr: a.changePr,
    onDefault: a.onDefault,
    folder: a.folder,
    local: a.local,
    retro: a.retro,
    roadmap: { listed: a.roadmap.listed, ticked: a.roadmap.ticked },
    pr: a.pr && { number: a.pr.number, url: a.pr.url, state: a.pr.state, autoMerge: a.pr.autoMerge, mergeStateStatus: a.pr.mergeStateStatus, headRefOid: a.pr.headRefOid },
    waitingFor: next.step === 'wait-merge' ? next.waitingFor : null,
  };
}

function describeNext(n) {
  const detail = {
    implement: `phase ${n.phase}`,
    gate: `phase ${n.phase}: ${n.command}`,
    review: `${(n.reviewers || []).join(', ')} (round ${n.round})`,
    'fix-review': (n.reviewers || []).join(', '),
    'fix-defect': (n.defects || []).join(', '),
    'fix-checks': (n.failing || []).map((f) => f.name).join(', '),
    'edit-pr-body': `add ${(n.missing || []).join(', ')}`,
    blocked: n.item === undefined ? n.reason : `item ${n.item}: ${n.reason}`,
    'disable-auto-merge': `PR #${n.number}: ${n.reason}`,
    'update-branch': `PR #${n.number}`,
    'enable-auto-merge': `PR #${n.number} with --${n.method} at ${String(n.head).slice(0, 7)}`,
    'wait-merge': `waiting for ${n.waitingFor}`,
    'on-train': `train ${n.train}, PR #${n.number}`,
    'wait-train': `train ${n.train}, PR #${n.number}`,
    'rejoin-train': `train ${n.train}, PR #${n.number}`,
    'close-boarded-pr': `PR #${n.number}`,
    'rejoin-archive': `PR #${n.number}, train ${n.train}`,
    retro: n.number ? `PR #${n.number}` : '',
    'open-archive-pr': n.branch,
    'open-test-archive-pr': n.branch,
    'tag-release': `${n.tag} at ${String(n.sha).slice(0, 7)} (PR #${n.number})`,
  }[n.step];
  return detail ? `${n.step} ${detail}` : n.step === 'ready' ? 'ready' : `${n.step}: ${n.reason}`;
}

export function renderHuman(report) {
  const head = report.head ? report.head.slice(0, 7) : 'none';
  return [
    `deliver-check: ${report.change} (schema ${report.schema}, ship ${report.ship}, host ${report.host}, head ${head})`,
    ...report.items.map((i) => `  ${i.id} ${i.status.padEnd(9)}${LABELS[i.id - 1]}: ${i.reason}`),
    `${report.met}/8 met: ${report.summary}`,
    `next: ${describeNext(report.next)}`,
    ...(report.watch ? [`watch: ${report.watch.timedOut ? `stopped after ${report.watch.minutes} minutes` : 'ended'}`] : []),
  ].join('\n') + '\n';
}

export const WATCH_DEFAULT_MINUTES = 9;
export const WATCH_MAX_MINUTES = 30;

// Minutes the single `gh pr checks --watch` may run: 9 by default (under the
// Bash tool's 10-minute foreground limit), at most 30.
export function watchMinutes(value) {
  if (value === undefined || value === '') return WATCH_DEFAULT_MINUTES;
  const n = /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  if (!(n > 0)) throw new UsageError(`--watch expects a positive number of minutes (default ${WATCH_DEFAULT_MINUTES}, at most ${WATCH_MAX_MINUTES}), not "${value}"`);
  return Math.min(n, WATCH_MAX_MINUTES);
}

// Seconds between polls of the merge wait: DEVKIT_POLL_SECONDS, default 30 (tests use 0).
function pollSeconds(env) {
  const n = Number(env.DEVKIT_POLL_SECONDS);
  return env.DEVKIT_POLL_SECONDS !== undefined && env.DEVKIT_POLL_SECONDS !== '' && n >= 0 ? n : 30;
}

function sleepSync(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// The capped wait at `wait-merge` (design D6): polls `gh pr view <n>` until the PR
// is no longer OPEN, auto-merge goes off, the head changes, gh fails or the cap
// is reached. Returns { minutes, timedOut }; the caller collects the state again.
function waitForMerge(gh, pr, minutes, env) {
  const every = pollSeconds(env) * 1000;
  const deadline = Date.now() + minutes * 60000;
  const done = (timedOut) => ({ minutes, timedOut });
  while (Date.now() < deadline) {
    // Each call is cut at the cap: one stalled gh never outruns the wait.
    const left = Math.max(1, Math.ceil(deadline - Date.now()));
    const r = gh(['pr', 'view', String(pr.number), '--json', 'state,autoMergeRequest,mergeStateStatus,headRefOid'], { timeout: Math.min(GH_TIMEOUT_MS, left) });
    if (r.timedOut) return done(left <= GH_TIMEOUT_MS);
    if (r.status !== 0) return done(false);
    let now;
    try { now = JSON.parse(r.stdout); } catch { return done(false); }
    if (now.state !== 'OPEN' || now.autoMergeRequest == null || now.headRefOid !== pr.headRefOid) return done(false);
    sleepSync(Math.min(every, Math.max(0, deadline - Date.now())));
  }
  return done(true);
}

export class UsageError extends Error {
  constructor(message) { super(message); this.name = 'UsageError'; }
}

function parseArgs(argv) {
  const opts = { id: null, json: false, watch: null, ci: false };
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    else if (a === '--ci') opts.ci = true;
    else if (a === '--watch' || a.startsWith('--watch=')) opts.watch = watchMinutes(a.includes('=') ? a.slice(a.indexOf('=') + 1) : undefined);
    else if (a.startsWith('-')) throw new UsageError(`unknown option ${a}`);
    else if (opts.id === null) opts.id = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  if (opts.ci && opts.watch !== null) throw new UsageError('--ci cannot be combined with --watch: the CI check reads the checkout and never waits');
  if (!opts.id && !opts.ci) throw new UsageError('usage: deliver-check <change-id> [--json] | deliver-check --ci [<change-id>] [--json]');
  return opts;
}

// ---------------------------------------------------------------- --ci: the devkit-reviews check (design D5)

// The CI check could not choose or accept a change: exit 1, a message, no state.
class CiFailure extends Error {
  constructor(message) { super(message); this.name = 'CiFailure'; }
}

function activeChangeNames(root) {
  const dir = join(root, 'openspec', 'changes');
  return readdirSync(dir).filter((n) => n !== 'archive' && !n.startsWith('.') && statSync(join(dir, n)).isDirectory());
}

// The active changes whose folder the PR diff (base...HEAD) touches.
function touchedChanges(root, base, active) {
  const ref = `origin/${base}`;
  if (!gitOk(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) {
    throw new UsageError(`GITHUB_BASE_REF is ${base} but ${ref} is not available; fetch the full history (actions/checkout with fetch-depth: 0)`);
  }
  let mergeBase;
  try { mergeBase = git(root, ['merge-base', ref, 'HEAD']).trim(); } catch { throw new UsageError(`${ref} and HEAD share no history; fetch the full history (actions/checkout with fetch-depth: 0)`); }
  const paths = git(root, ['diff', '--name-only', '-z', `${mergeBase}..HEAD`, '--', 'openspec/changes/']).split('\0').filter(Boolean);
  const names = paths.map((f) => f.split('/')[2]).filter((n) => active.includes(n));
  return [...new Set(names)].sort();
}

// { name } | { several: [ids] } | { none: true }; throws UsageError (exit 3) or CiFailure (exit 1).
// First match wins: the argument or DEVKIT_CHANGE, the branch, the folders the
// PR touches (with GITHUB_BASE_REF), the only open change (local runs).
function selectCiChange(root, id, env, branch) {
  const active = activeChangeNames(root);
  const wanted = id || env.DEVKIT_CHANGE;
  if (wanted) {
    if (!/^[\w.-]+$/.test(wanted) || !active.includes(wanted)) {
      throw new UsageError(`unknown change "${wanted}": no active openspec/changes/${wanted}/ (archived changes do not count)`);
    }
    return { name: wanted };
  }
  // An archive branch (chore/archive-<id>) selects <id> while it is active, and no
  // change by name once it moved: the PR diff decides, and an archive PR touches none.
  const archiving = archiveBranchChange(root, branch);
  if (archiving) {
    if (active.includes(archiving)) return { name: archiving };
  } else if (branch) {
    const exact = active.filter((c) => c === branch.split('/').pop());
    if (exact.length === 1) return { name: exact[0] };
    const contained = active.filter((c) => branch.includes(c));
    if (contained.length === 1) return { name: contained[0] };
    if (contained.length > 1) throw new CiFailure(`several changes match branch ${branch}; name the branch after one`);
  }
  if (env.GITHUB_BASE_REF) {
    const touched = touchedChanges(root, env.GITHUB_BASE_REF, active);
    if (touched.length === 1) return { name: touched[0] };
    if (touched.length > 1) return { several: touched };
    return { none: true };
  }
  if (archiving) return { none: true };
  if (active.length === 1) return { name: active[0] };
  if (active.length > 1) throw new CiFailure(`several open changes (${active.join(', ')}); name the branch after one, or set DEVKIT_CHANGE`);
  return { none: true };
}

// A devkit script is the schema named devkit or devkit-lite, the rule the hooks' opt-in reads (ADR 0012).
export const isDevkitScript = (schema) => DEVKIT_SCHEMAS.includes(schema);
const PROJECT_SCHEMA = 'devkit-project';
const archivedId = (folder) => basename(folder).replace(/^\d{4}-\d{2}-\d{2}-/, '');
const otherScriptNote = (id, schema) => `${id} is on the ${schema} script, not a devkit script; nothing was checked`;
const planOnlyNote = (id) => `${id} holds only a plan (no ticked task in tasks.md); not checked`;

// The `pull_request` event payload at GITHUB_EVENT_PATH: the parsed JSON, or null when it is unset or unreadable.
export function eventPayload(env) {
  if (!env.GITHUB_EVENT_PATH) return null;
  try { return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { return null; }
}

// A shallow clone, or a checkout of something other than the PR head, would
// make every recorded Commit: read as stale: refuse both (exit 3).
function ciPreflight(root, env, head) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    throw new UsageError('fetch the full history (actions/checkout with fetch-depth: 0): reviews and evidence are checked against every commit since they were recorded');
  }
  const sha = eventPayload(env)?.pull_request?.head?.sha;
  if (typeof sha === 'string' && head && sha.toLowerCase() !== head.toLowerCase()) {
    throw new UsageError('check out the PR head (actions/checkout with ref: ${{ github.event.pull_request.head.sha }}), not the merge commit');
  }
}

// The ref CI reads the delivery settings from (delivery-models D-7): the repository's default branch, never the pull request's
// head or the test branch. First match wins: S1 the default branch the event payload names, S2 the target of origin/HEAD, S3 the
// base ref as before this change. { ref, name } with `name` the default branch (S1, S2), or { ref: null } without a base ref.
export function ciSettingsRef(root, env) {
  const has = (name) => typeof name === 'string' && name !== '' && gitOk(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}^{commit}`]);
  const payload = eventPayload(env);
  const named = payload?.repository?.default_branch ?? payload?.pull_request?.base?.repo?.default_branch;
  if (has(named)) return { ref: `origin/${named}`, name: named };
  let head = null;
  try { head = git(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, ''); } catch { /* a clone without origin/HEAD */ }
  if (has(head)) return { ref: `origin/${head}`, name: head };
  return { ref: env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : null, name: null };
}

// What `--ci` judges in `two-prs` (D-7), or null when the project is in no such model, the run is not on a pull request to its
// base or test branch, or the settings cannot be read: { settingsRef, defaultName, base, testBranch, gh, env }. A settings
// problem is a usage error.
function twoPrsContext(root, env) {
  if (!env.GITHUB_BASE_REF) return null;
  const { ref, name } = ciSettingsRef(root, env);
  if (!ref) return null;
  let text;
  try { text = git(root, ['show', `${ref}:openspec/config.yaml`]); } catch { return null; }
  const { model, base, testBranch, problems } = deliverySettings(parseDevkitBlock(text));
  if (problems.length) {
    throw new UsageError(`delivery settings in openspec/config.yaml on ${ref}: ${problems.map((p) => (p.kind === 'missing' ? `${p.setting} is missing` : `${p.setting} "${p.value}" is not valid`)).join('; ')}`);
  }
  if (model !== 'two-prs' || ![base, testBranch].includes(env.GITHUB_BASE_REF)) return null;
  return { settingsRef: ref, defaultName: name, base, testBranch, env, gh: makeGh(root, env) };
}

// The two-prs rules for one judged change (D-7): { lines, failed, report } or null when none applies. The base branch must be
// the default branch (when the settings were read through it); a pull request to the base branch then must not hold a commit
// of the test branch and must wait for its pull request to the test branch to merge.
function twoPrsRules(root, id, ctx) {
  const { settingsRef, defaultName, base, testBranch, env } = ctx;
  const line = (status, text) => `  two-prs  ${status.padEnd(4)}  ${text}`;
  const report = (extra) => ({ settingsRef, base, testBranch, foreign: null, testPr: null, resolution: null, ...extra });
  if (defaultName && defaultName !== base) {
    return { lines: [line('open', `the base branch ${base} is not the repository's default branch ${defaultName}`)], failed: ['two-prs'], report: report({ pass: false }) };
  }
  if (env.GITHUB_BASE_REF !== base) return null;
  const lines = [];
  const foreign = testBranchCommit(root, { base, testBranch, head: 'HEAD' });
  if (foreign) lines.push(line('open', `${foreign.sha.slice(0, 7)} (${foreign.subject}) is on ${testBranch} and not on ${base}; the task branch never receives ${testBranch}`));
  const headRef = env.GITHUB_HEAD_REF || currentBranch(root, env);
  const test = findTestPr(ctx.gh, { id, testBranch, head: headRef });
  let wait;
  if (test.error) wait = `cannot read the pull requests to ${testBranch}: ${test.error} (the job needs pull-requests: read and GH_TOKEN)`;
  else if (test.none) wait = `no pull request to ${testBranch} from ${headRef} or ${headRef}-${testBranch}`;
  else if (test.pr.state !== 'MERGED') wait = `waits for pull request #${test.pr.number} to ${testBranch} to merge`;
  if (wait) lines.push(line('open', wait));
  const pass = lines.length === 0;
  return {
    lines: pass ? [line('met', `no ${testBranch} commit in the task branch; pull request #${test.pr.number} to ${testBranch} is merged`)] : lines,
    failed: pass ? [] : ['two-prs'],
    report: report({ foreign, testPr: test.pr ? { number: test.pr.number, state: test.pr.state, head: test.pr.headRefName } : null, pass }),
  };
}

// What `--ci` judges on a pull request to the test branch (D-7): neither items 1-4 nor readiness, which the pull request to the
// base branch carries, only the resolution of the support branch when that is the head: { report, lines, failed, pass }.
function testBranchPr(root, id, facts, two) {
  const { env, base, testBranch, settingsRef } = two;
  const schema = changeSchema(root, id);
  const support = `${id}-${testBranch}`;
  const line = (status, text) => `  two-prs  ${status.padEnd(4)}  ${text}`;
  const lines = [
    `devkit-reviews: ${id} (schema ${schema}, head ${facts.head ? facts.head.slice(0, 7) : 'none'})`,
    `  note: the delivery contract of ${id} is judged on the pull request to ${base}`,
  ];
  let resolution = null;
  let problems = [];
  if ((env.GITHUB_HEAD_REF || currentBranch(root, env)) === support) {
    resolution = resolutionState(root, id, { taskRef: `origin/${id}`, supportRef: 'HEAD' });
    problems = resolution.error ? [resolution.error] : [
      resolution.missing.length ? `missing ${resolution.missing.join(', ')}` : '',
      resolution.stale.length ? `stale ${resolution.stale.join(', ')} (not at ${resolution.newest.slice(0, 7)}, the newest commit of ${support})` : '',
      resolution.rejected.length ? `not approved: ${resolution.rejected.join(', ')}` : '',
      resolution.undisposed.length ? `undisposed: ${resolution.undisposed.map((f) => `${f.reviewer}: ${f.excerpt}`).join('; ')}` : '',
    ].filter(Boolean);
    lines.push(problems.length ? line('open', `the resolution on ${support} is not approved: ${problems.join('; ')}`)
      : line('met', resolution.commits.length ? `the resolution on ${support} is approved at ${resolution.newest.slice(0, 7)}` : `${support} holds no resolution to review`));
  }
  const pass = problems.length === 0;
  const summary = resolution && {
    commits: resolution.commits.map((c) => c.sha), newest: resolution.newest, missing: resolution.missing, stale: resolution.stale,
    rejected: resolution.rejected, undisposed: resolution.undisposed, round: resolution.round, approved: resolution.approved,
  };
  return {
    report: { version: 1, mode: 'ci', change: id, schema, head: facts.head, pass, twoPrs: { settingsRef, base, testBranch, foreign: null, testPr: null, resolution: summary, pass } },
    lines, failed: pass ? [] : ['two-prs'], pass,
  };
}

// An archive PR (design D8): the archived folders the PR diff brings and the same exact-path
// file check and answer check the local run makes, read from the PR's own files. Null when
// the PR archives nothing. The retro of every archived folder must be readable and answered.
function archivePrCheck(root, base) {
  const changes = archiveChanges(root, base);
  if (changes.missing) throw new UsageError(`GITHUB_BASE_REF is ${base} but origin/${base} is not available; fetch the full history (actions/checkout with fetch-depth: 0)`);
  const folders = [...new Set(changes.paths.map((p) => /^(openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[^/]+)\//.exec(p)?.[1]).filter(Boolean))].sort();
  if (!folders.length) return null;
  // Each folder is judged by the schema its own .openspec.yaml names (ADR 0012); another script is a note.
  const schemaOfFolder = (f) => changeSchemaAt(root, join(root, f));
  const devkit = folders.filter((f) => isDevkitScript(schemaOfFolder(f)));
  // A slice folder is judged by the slice contract against the PR's base (design D-11).
  const slices = folders.filter((f) => schemaOfFolder(f) === PROJECT_SCHEMA).map((f) => ({ folder: f, id: archivedId(f), problems: sliceProblems(root, f, { base: `origin/${base}` }) }));
  const notes = folders.filter((f) => !devkit.includes(f) && !slices.some((s) => s.folder === f)).map((f) => ({ change: archivedId(f), why: 'other-script', schema: schemaOfFolder(f) }));
  const retros = devkit.map((f) => ({ folder: f, retro: readRetro(join(root, f, 'retro.md')) }));
  const proposals = retros.flatMap((r) => r.retro.proposals);
  return {
    folders,
    noRetro: retros.filter((r) => !r.retro.readable).map((r) => r.folder),
    missingRetro: retros.filter((r) => !r.retro.exists).map((r) => r.folder),
    unanswered: proposals.filter((p) => p.answer === null).map((p) => p.n),
    unnamed: devkit.length ? unnamedFiles(changes.paths, proposals, changes.texts) : [],
    slices,
    notes,
  };
}

// What is wrong with the archived folders an archive pull request brings (`archivePrCheck`'s answer), one line each.
function archiveProblems(a) {
  const retroOf = (f) => `${f}/retro.md`;
  return [
    ...a.missingRetro.map((f) => `${retroOf(f)} is missing: it holds the change's retro, with a "## Proposed updates" section listing each proposal and the owner's answer to it; the retro step of the archive writes it (/devkit change, or ship-change for a change begun under the previous script, after the change's pull request merges)`),
    ...a.noRetro.filter((f) => !a.missingRetro.includes(f)).map((f) => `${retroOf(f)} has no "## Proposed updates" section: it must list each proposal with the owner's answer; the retro step of the archive writes it`),
    ...(a.unanswered.length ? [`unanswered proposals: ${a.unanswered.length}`] : []),
    ...(a.unnamed.length ? [`files no approved proposal names: ${a.unnamed.join(', ')}`] : []),
    ...a.slices.flatMap((s) => s.problems.map((m) => `slice ${s.id}: ${m}`)),
  ];
}

// The `&&` parts of the whole-suite command the default branch's settings name (delivery-train D-10): [] without a ref to read, a
// file or the key; a refused key is a usage error, as a refused delivery setting is in `twoPrsContext`.
export function ciTrainParts(root, env) {
  const { ref } = ciSettingsRef(root, env);
  if (!ref) return [];
  let text;
  try { text = git(root, ['show', `${ref}:openspec/config.yaml`]); } catch { return []; }
  const { suite, problem } = trainSetting(parseDevkitBlock(text));
  if (problem) throw new UsageError(`delivery settings in openspec/config.yaml on ${ref}: ${trainProblemText(problem)}`);
  return trainParts(suite);
}

// `fn(worktree)` in a scratch worktree of `head` made under the system temporary folder, removed when `fn` returns or throws;
// a head that cannot be checked out gives `fn` nothing: { error }.
function inWorktreeAt(root, head, fn) {
  const scratch = mkdtempSync(join(tmpdir(), 'devkit-train-check-'));
  const wt = join(scratch, 'w');
  try {
    try { git(root, ['worktree', 'add', '-q', '--detach', wt, head]); } catch (e) { return { error: `${head.slice(0, 7)} cannot be checked out (${String(e.stderr ?? e.message).trim().split('\n')[0]})` }; }
    return { value: fn(wt) };
  } finally {
    gitOk(root, ['worktree', 'remove', '--force', wt]);
    gitOk(root, ['worktree', 'prune']);
    rmSync(scratch, { recursive: true, force: true });
  }
}

// One boarded entry of a train judged at its own head (D-10 failures 5 and 6): { problems, report? }. A change gets the check of
// its own pull request, an archive the check of an archive pull request.
function judgeBoarded(root, entry, base, parts) {
  const found = inWorktreeAt(root, entry.head, (wt) => {
    if (entry.kind === 'archive') {
      const a = archivePrCheck(wt, base);
      if (!a) return { problems: [`the head brings no archived folder`] };
      const problems = archiveProblems(a);
      return { problems: problems.length ? [`${a.folders.join(', ')}: ${problems.join('; ')}`] : [] };
    }
    if (!existsSync(join(wt, 'openspec', 'changes', entry.id))) return { problems: [`openspec/changes/${entry.id}/ does not exist at that head`] };
    const schema = changeSchema(wt, entry.id);
    if (!isDevkitScript(schema)) return { problems: [`${entry.id} is on the ${schema} script, not a devkit script (${DEVKIT_SCHEMAS.join(', ')})`] };
    // The base is the train pull request's, with an empty env so the process's own GITHUB_BASE_REF does not change the answer:
    // the boarded change gets the own-files rule its own pull request's check applies (stale-only-on-own-files, ADR 0025).
    const one = checkOne(wt, entry.id, gitFacts(wt, { base: stalenessBase(wt, {}, base) }), null, { trainParts: parts });
    const open = [...(one.report.readiness.met ? [] : [`readiness: Status ${one.report.readiness.status || 'missing'}`]), ...one.report.items.filter((i) => i.status !== 'met').map((i) => `${LABELS[i.id - 1]}: ${i.reason}`)];
    return { problems: open, report: one.report };
  });
  return found.error ? { problems: [found.error] } : found.value;
}

// The whole judgement of a pull request from `train/<n>` (D-10): { code, report, text }. The record at the head decides what is
// judged; no GitHub call is made and no setting but the train parts is read.
function trainCheck(root, n, env, facts, parts) {
  const base = env.GITHUB_BASE_REF || '';
  const file = `openspec/trains/${n}.md`;
  const problems = [];
  let raw = null;
  try { raw = git(root, ['show', `HEAD:${file}`]); } catch { /* no record at the head */ }
  const record = raw === null ? null : parseTrainRecord(raw);
  if (raw === null) problems.push(`${file} is missing (the departure writes it: /devkit train)`);
  else if (record.error) problems.push(`the train record cannot be read: ${record.error}`);
  const entries = [];
  if (record && !record.error) {
    const ref = `origin/${base || record.base}`;
    if (!gitOk(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) {
      throw new UsageError(`${ref} is not available; fetch the full history (actions/checkout with fetch-depth: 0)`);
    }
    if (record.result !== 'passed') problems.push(`the train record did not pass (result ${record.result})`);
    else {
      const stale = staleness(root, record.ranAt ? { sha: record.ranAt } : null, facts);
      if (stale) problems.push(`the train record is not current at the pull request's head (${stale})`);
    }
    const known = record.boarded.filter((b) => gitOk(root, ['rev-parse', '--verify', '--quiet', `${b.head}^{commit}`]));
    const allowed = (p) => RELEASE_FILE.test(p) || p === TRAIN_PIN_FILE || p === 'openspec/roadmap.md' || p === file;
    // The numbering of a noted change's ADR and its citations, and the release file's version (release-at-merge D-5): an edit
    // releaseOnlyEdit accepts between Git's own merge (or the parent) and the commit.
    let releaseFile = null;
    try { releaseFile = releaseTagOf(root); } catch (e) { if (!(e instanceof ShipConfigError)) throw e; }
    const ctx = releaseContext(root, releaseFile);
    for (const line of git(root, ['rev-list', '--parents', 'HEAD', `^${ref}`, ...known.map((b) => `^${b.head}`)]).split('\n').filter(Boolean)) {
      const [c, ...parents] = line.split(' ');
      let paths;
      let before = parents[0];
      if (parents.length > 1) {
        before = autoMergeTree(root, parents[0], parents[1]) ?? parents[0];
        paths = git(root, ['diff', '--name-only', '-z', '--no-renames', before, c]).split('\0').filter(Boolean);
      } else paths = touchedPaths(root, c, parents);
      const outside = paths.filter((x) => !allowed(x) && !releaseOnlyEdit(root, before, c, x, ctx));
      if (outside.length) problems.push(`${c.slice(0, 7)} (${git(root, ['log', '-1', '--format=%s', c]).trim()}) changes ${outside.join(', ')}: the train's own commits change only release files, the CI pin, openspec/roadmap.md and ${file}`);
    }
    for (const b of record.boarded) {
      const own = [];
      if (!known.includes(b) || !gitOk(root, ['merge-base', '--is-ancestor', b.head, 'HEAD'])) {
        own.push(`head ${b.head.slice(0, 7)} is not in the train (it is not an ancestor of the pull request's head)`);
      }
      if (known.includes(b)) own.push(...judgeBoarded(root, b, base || record.base, parts).problems);
      entries.push({ kind: b.kind, id: b.id, number: b.number, head: b.head, pass: own.length === 0, problems: own });
    }
  }
  const failedEntries = entries.filter((e) => !e.pass);
  const pass = problems.length === 0 && failedEntries.length === 0;
  const lines = [
    `devkit-reviews: train ${n} (${file}, ${entries.length} boarded)`,
    ...entries.map((e) => `  ${e.kind} ${e.id} (#${e.number}, head ${e.head.slice(0, 7)}): ${e.pass ? 'pass' : `fail: ${e.problems.join('; ')}`}`),
    ...problems.map((m) => `  ${m}`),
    pass ? 'pass' : `fail: ${[...problems, ...failedEntries.map((e) => `${e.id}: ${e.problems.length} problem${e.problems.length > 1 ? 's' : ''}`)].join('; ')}`,
  ];
  const report = { version: 1, mode: 'ci', change: null, pass, train: { n, record: file, base: base || record?.base || null, ranAt: record?.ranAt ?? null, problems, boarded: entries } };
  return { code: pass ? 0 : 1, report, text: `${lines.join('\n')}\n` };
}

// Runs the devkit-reviews check: { code, stdout, stderr }. 0 pass, 1 fail,
// 3 setup or usage error. Does not read `ship` or `merge_method`, and ignores DEVKIT_BYPASS.
function runCi(opts, env, cwd) {
  const root = findRoot(cwd);
  const finish = (code, report, text) => ({ code, stdout: opts.json ? `${JSON.stringify(report)}\n` : text, stderr: '' });
  if (!root) {
    // A repository that has not adopted OpenSpec is never broken by this check (R-3), as guard.mjs ci.
    const note = 'no openspec/ folder; nothing to check';
    return finish(0, { version: 1, mode: 'ci', change: null, pass: true, note }, `devkit-reviews: ${note}\n`);
  }
  if (!gitOk(root, ['rev-parse', '--git-dir'])) throw new UsageError(`${root} is not a git repository: deliver-check reads commits and the working tree`);
  const facts = gitFacts(root, { base: stalenessBase(root, env, null) });
  ciPreflight(root, env, facts.head);
  const parts = ciTrainParts(root, env);
  const trainBranch = TRAIN_BRANCH.exec(currentBranch(root, env));
  if (trainBranch) {
    const t = trainCheck(root, Number(trainBranch[1]), env, facts, parts);
    return finish(t.code, t.report, t.text);
  }
  const two = twoPrsContext(root, env);
  let selected;
  try { selected = selectCiChange(root, opts.id, env, currentBranch(root, env)); } catch (e) {
    if (!(e instanceof CiFailure)) throw e;
    return { code: 1, stdout: opts.json ? `${JSON.stringify({ version: 1, mode: 'ci', pass: false, error: e.message })}\n` : '', stderr: `deliver-check: ${e.message}\n` };
  }
  if (selected.none && env.GITHUB_BASE_REF) {
    const a = archivePrCheck(root, env.GITHUB_BASE_REF);
    if (a) {
      const problems = archiveProblems(a);
      const sliceLines = a.slices.filter((s) => !s.problems.length).map((s) => `  slice ${s.id}: passed the slice contract`);
      const pass = problems.length === 0;
      const text = [`devkit-reviews: archive ${a.folders.join(', ')}`, ...a.notes.map((n) => `  note: ${otherScriptNote(n.change, n.schema)}`), ...sliceLines, ...problems.map((m) => `  ${m}`), pass ? 'pass' : `fail: ${problems.join('; ')}`].join('\n') + '\n';
      return finish(pass ? 0 : 1, { version: 1, mode: 'ci', change: null, pass, archive: a }, text);
    }
  }
  if (selected.several) return runSeveral(root, selected.several, facts, finish, two, parts);
  if (selected.none) {
    const note = `no change selected by branch ${currentBranch(root, env) || '(detached)'} or touched by this PR; nothing to check`;
    return finish(0, { version: 1, mode: 'ci', change: null, pass: true, note }, `devkit-reviews: ${note}\n`);
  }
  const id = selected.name;
  const schema = changeSchema(root, id);
  if (schema === PROJECT_SCHEMA) {
    const error = `${id} is a slice of a project and its folder is not archived: a slice reaches the default branch with its folder archived in its pull request; /devkit project ${id} archives it`;
    return finish(1, { version: 1, mode: 'ci', change: id, schema, pass: false, error }, `devkit-reviews: ${error}\nfail: ${error}\n`);
  }
  if (!isDevkitScript(schema)) {
    const note = `${id} is on the ${schema} script, not a devkit script (${DEVKIT_SCHEMAS.join(', ')}); nothing was checked`;
    return finish(0, { version: 1, mode: 'ci', change: id, schema, pass: true, note }, `devkit-reviews: ${note}\npass\n`);
  }
  const one = checkOne(root, id, facts, two, { trainParts: parts });
  return finish(one.pass ? 0 : 1, one.report, [...one.lines, one.pass ? 'pass' : `fail: ${one.failed.join(', ')}`].join('\n') + '\n');
}

// Today's single-change check, unchanged: { report, lines, failed, pass } for a change on a devkit script. On a pull request to the
// test branch of a two-prs project (D-7) it judges the resolution instead.
function checkOne(root, id, facts, two = null, { trainParts = [] } = {}) {
  if (two && two.env.GITHUB_BASE_REF === two.testBranch && !(two.defaultName && two.defaultName !== two.base)) return testBranchPr(root, id, facts, two);
  const schema = changeSchema(root, id);
  const needsReadiness = changeDeclares(root, changeDir(root, id), 'readiness'); // the flow the change follows; an unreadable pin fails the check
  const status = needsReadiness ? readValue(join(changeDir(root, id), 'readiness.md'), 'Status') : null;
  const readinessMet = !needsReadiness || status === 'APPROVED';
  const items = [tasksItem(root, id, facts, { trainParts }), reviewsItem(root, id, facts), findingsItem(root, id, facts), acceptanceItem(root, id, facts)];
  const pass = readinessMet && items.every((i) => i.status === 'met');
  const report = {
    version: 1, mode: 'ci', change: id, schema, head: facts.head,
    readiness: { status, met: readinessMet },
    items: items.map(({ id: n, name, status: st, reason, details }) => ({ id: n, name, status: st, reason, details })),
    pass,
  };
  const failed = [...(readinessMet ? [] : ['readiness']), ...items.filter((i) => i.status !== 'met').map((i) => `item ${i.id}`)];
  const lines = [
    `devkit-reviews: ${id} (schema ${schema}, head ${facts.head ? facts.head.slice(0, 7) : 'none'})`,
    ...(needsReadiness ? [`  readiness ${(readinessMet ? 'met' : 'open').padEnd(9)}Status: ${status || 'missing'}`] : []),
    ...items.map((i) => `  ${i.id} ${i.status.padEnd(9)}${LABELS[i.id - 1]}: ${i.reason}`),
  ];
  const rules = two ? twoPrsRules(root, id, two) : null;
  if (!rules) return { report, lines, failed, pass };
  const ruled = pass && rules.failed.length === 0;
  return { report: { ...report, twoPrs: rules.report, pass: ruled }, lines: [...lines, ...rules.lines], failed: [...failed, ...rules.failed], pass: ruled };
}

// A pull request that touches several changes and is named after none (ADR 0012): each touched devkit-script
// change with a ticked task is judged on its own; a plan or another script is a note.
function runSeveral(root, ids, facts, finish, two = null, parts = []) {
  const judged = [];
  const notes = [];
  for (const id of ids) {
    const schema = changeSchema(root, id);
    if (!isDevkitScript(schema)) { notes.push({ change: id, why: 'other-script', schema }); continue; }
    const tasksFile = join(changeDir(root, id), 'tasks.md');
    const ticked = existsSync(tasksFile) && parseTasks(readFileSync(tasksFile, 'utf8')).some((t) => t.done);
    if (ticked) judged.push(id); else notes.push({ change: id, why: 'plan-only', schema });
  }
  const plans = notes.filter((n) => n.why === 'plan-only');
  const noteLines = notes.map((n) => `  note: ${n.why === 'plan-only' ? planOnlyNote(n.change) : otherScriptNote(n.change, n.schema)}`);
  const header = `devkit-reviews: ${ids.length} changes touched by this PR (${ids.join(', ')})`;
  if (!judged.length && plans.length) {
    const message = `this PR delivers no change: ${plans.map((n) => n.change).join(', ')} hold only a plan (no ticked task in tasks.md)`;
    return finish(1, { version: 1, mode: 'ci', change: null, changes: [], notes, pass: false, error: message }, [header, ...noteLines, `fail: ${message}`].join('\n') + '\n');
  }
  const results = judged.map((id) => ({ id, ...checkOne(root, id, facts, two, { trainParts: parts }) }));
  const pass = results.every((r) => r.pass);
  const failedText = results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.failed.join(', ')}`).join('; ');
  const text = [header, ...results.flatMap((r) => r.lines), ...noteLines, pass ? 'pass' : `fail: ${failedText}`].join('\n') + '\n';
  return finish(pass ? 0 : 1, { version: 1, mode: 'ci', change: null, changes: results.map((r) => r.report), notes, pass }, text);
}

// The pull request whose checks `--watch` waits on, or null: at `wait-checks` the change PR; at
// `stop-merge-setup` the change PR when it is open with checks pending (field item 9).
export function checksToWatch(state, next) {
  if (next.step === 'wait-checks' && state.pr) {
    return { number: state.pr.number, required: state.items[5].details.required };
  }
  if (next.step === 'stop-merge-setup' && !state.archive && state.pr?.state === 'OPEN' && (state.items[5].details.pending ?? []).length > 0) {
    return { number: state.pr.number, required: state.items[5].details.required };
  }
  return null;
}

// The single capped `gh pr checks <n> --watch --interval 30 [--required]`, killed at the cap.
function watchChecks(gh, target, minutes) {
  const args = ['pr', 'checks', String(target.number), '--watch', '--interval', '30', ...(target.required ? ['--required'] : [])];
  const r = gh(args, { timeout: minutes * 60000, killSignal: 'SIGTERM' });
  return { minutes, timedOut: r.timedOut };
}

// Runs the checker: { code, stdout, stderr }. Exit 0 only when 8/8 are met,
// 1 when something is open, 2 when something is blocked, 3 on usage or
// preflight errors.
export function main(argv, env = process.env, cwd = process.cwd()) {
  let opts = { json: argv.includes('--json') };
  try {
    opts = parseArgs(argv);
    if (opts.ci) return runCi(opts, env, cwd);
    const root = findRoot(cwd);
    if (!root) throw new UsageError(`no openspec/ folder found from ${cwd}`);
    if (!gitOk(root, ['rev-parse', '--git-dir'])) throw new UsageError(`${root} is not a git repository: deliver-check reads commits and the working tree`);
    if (!locateChange(root, opts.id)) {
      throw new UsageError(`unknown change "${opts.id}": no openspec/changes/${opts.id}/ and no openspec/changes/archive/<date>-${opts.id}/ in this checkout; switch to the default branch and pull, or to the change's branch`);
    }
    const gh = makeGh(root, env);
    let state = collectState(root, opts.id, { env, gh });
    let watch = null;
    const next = opts.watch !== null ? nextStep(state) : null;
    const target = next ? checksToWatch(state, next) : null;
    if (target) {
      // One capped watch; the contract is computed again afterwards, whatever happened.
      watch = watchChecks(gh, target, opts.watch);
      state = collectState(root, opts.id, { env, gh });
    } else if (next?.step === 'wait-merge') {
      // The PR waited on is next.number: the change PR, or the archive PR after the merge.
      watch = waitForMerge(gh, { number: next.number, headRefOid: next.head }, opts.watch, env);
      state = collectState(root, opts.id, { env, gh, prNumber: state.archive ? null : state.pr.number });
    }
    const report = buildReport(state, env);
    if (watch) report.watch = watch;
    const trainWait = ['boarded', 'on-train', 'wait-train'].includes(report.next.step);
    const code = trainWait ? 1 : report.summary.startsWith('blocked') || report.items.some((i) => i.status === 'blocked') ? 2 : report.met === 8 && report.next.step !== 'stop-plan-approval' ? 0 : 1;
    return { code, stdout: opts.json ? `${JSON.stringify(report, null, 2)}\n` : renderHuman(report), stderr: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 3, stdout: opts.json ? `${JSON.stringify({ version: 1, error: message })}\n` : '', stderr: `deliver-check: ${message}\n` };
  }
}

// The devkit-reviews check for `guard.mjs ci`: same as `deliver-check --ci ...args`.
export function ciMain(args = [], env = process.env, cwd = process.cwd()) {
  return main(['--ci', ...args.filter((a) => a !== '--ci')], env, cwd);
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
