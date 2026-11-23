// deliver-check: is a change a ready PR? (ship-modes, design D2 and D4)
//
// Reads files and git; never writes, pushes or posts. No dependencies.
// Imports its helpers from guard.mjs, which runs a mode only when executed
// directly, so importing it here has no side effects.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mergeSetup, readRepoSettings, makeGh, ghError, GH_TIMEOUT_MS, DEVKIT_REVIEWS_CHECK } from './merge-setup.mjs';

// The shared gh runner (merge-setup.mjs), kept importable from here.
export { makeGh };
// The `Commit:` line reader moved to guard.mjs, which the slice contract reads it from; still importable from here.
export { parseCommitLine };
import { archiveBranchChange, mainCheckout, parseDevkitBlock, deliverySettings, changeDir, parseCommitLine, sliceProblems, changeSchema, changeSchemaAt, DEVKIT_SCHEMAS, findRoot, readValue, resolveChange, schemaHasArtifact, REQUIRED_REVIEWERS } from './guard.mjs';

// ---------------------------------------------------------------- ship config

export const SHIP_MODES = ['plan', 'pr', 'merge'];
export const MERGE_METHOD_VALUES = ['squash', 'merge', 'rebase'];
const CONFIG = 'openspec/config.yaml';

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

// { model, ship, mergeMethod, base, testBranch } for a schema: the delivery model of `devkit.delivery` next to the `ship:`
// map (delivery-models D-1). `ship` is what every existing branch reads (`two-prs` is `pr`, so auto-merge is never enabled).
// A `ship:` entry that disagrees with the model, and any problem of the delivery settings, is a ShipConfigError.
const MODEL_SHIP = { trunk: 'pr', 'trunk-auto': 'merge', 'two-prs': 'pr' };

export function deliveryConfig(root, schema) {
  const file = join(root, CONFIG);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const map = parseShip(text);
  const mergeMethod = parseMergeMethod(text);
  const { model, base, testBranch, problems } = deliverySettings(parseDevkitBlock(text));
  if (problems[0]) {
    const p = problems[0];
    throw new ShipConfigError(p.kind === 'missing'
      ? `devkit.delivery: two-prs needs the ${p.setting.replace('delivery-', '').replace('-', '_')}`
      : `devkit.delivery: unknown ${p.setting.replace('delivery-', '').replace('-', '_')} "${p.value}"`);
  }
  if (!model) return { model: null, ship: map[schema] ?? 'plan', mergeMethod, base: null, testBranch: null };
  const ship = MODEL_SHIP[model];
  const entry = map[schema];
  const agrees = entry === undefined || (model !== 'two-prs' && entry === ship);
  if (!agrees) throw new ShipConfigError(`ship.${schema}: "${entry}" disagrees with devkit.delivery.model ${model}; remove the ship entry or set it to ${model === 'two-prs' ? 'nothing' : ship}`);
  return { model, ship, mergeMethod, base, testBranch };
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
// commit) and the uncommitted paths that count.
export function gitFacts(root) {
  let head = null;
  try { head = git(root, ['rev-parse', 'HEAD']).trim(); } catch { /* no commit yet */ }
  return { head, dirty: dirtyPaths(root) };
}

// The paths commit `c` counts as touching: a merge (more than one parent) against its first
// parent, what it brought into the branch; any other commit as before (merge-staleness-first-parent).
function touchedPaths(root, c, parents) {
  const args = parents.length > 1
    ? ['diff-tree', '-r', '-z', '--name-only', '--no-commit-id', parents[0], c]
    : ['diff-tree', '-m', '-r', '-z', '--root', '--name-only', '--no-commit-id', c];
  return git(root, args).split('\0').filter(Boolean);
}

// Why a recorded Commit is not current at HEAD, or null when it is: it
// resolves, is an ancestor of HEAD, every commit since touches only
// openspec/ (or, with `allowed`, only paths it accepts), it is not marked
// uncommitted, and the working tree has no change outside openspec/ and .claude/.
// A merge commit counts what it brought into the branch (its first-parent diff);
// every commit in the range is still checked.
export function staleness(root, recorded, facts = gitFacts(root), { allowed = isOpenspec } = {}) {
  if (!recorded) return 'no Commit: line';
  const short = recorded.sha.slice(0, 7);
  if (recorded.uncommitted) return `${short} was recorded with uncommitted changes`;
  if (facts.dirty.length) return `uncommitted changes outside openspec/ (${facts.dirty.slice(0, 3).join(', ')})`;
  if (!facts.head) return 'no commit at HEAD yet';
  let full;
  try { full = git(root, ['rev-parse', '--verify', '--quiet', `${recorded.sha}^{commit}`]).trim(); } catch { full = ''; }
  if (!full) return `${short} does not resolve to a commit`;
  if (!gitOk(root, ['merge-base', '--is-ancestor', full, facts.head])) return `${short} is not an ancestor of HEAD`;
  for (const line of git(root, ['rev-list', '--parents', `${full}..${facts.head}`]).split('\n').filter(Boolean)) {
    const [c, ...parents] = line.split(' ');
    const product = touchedPaths(root, c, parents).find((f) => !allowed(f));
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
// Commit: is current and the reason otherwise.
export function readReviews(root, id, facts = gitFacts(root)) {
  return verdictFiles(join(changeDir(root, id), 'reviews')).map(({ name, verdict, commit }) => ({
    name,
    verdict,
    why: staleness(root, commit, facts, TEST_SPARED_REVIEWERS.includes(name) ? { allowed: (p) => isOpenspec(p) || isTestFile(p) } : {}),
  }));
}

// Item 2: every review approved (or declined) at the head.
export function reviewsItem(root, id, facts = gitFacts(root)) {
  const found = readReviews(root, id, facts);
  const missing = REQUIRED_REVIEWERS.filter((r) => !found.some((x) => x.name === r));
  const rejected = found.filter((x) => x.verdict !== 'APPROVED' && x.verdict !== 'DECLINED').map((x) => x.name);
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

// The checkbox lines of tasks.md outside fenced blocks: { phase, id, done, isGate, command }. A gate
// task's description (the text after its id) starts with "Gate:"; its command is the first backticked text after it.
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
    tasks.push({ phase, id: m[2], done: m[1] !== ' ', isGate, command: isGate ? (description.match(/^Gate:[^`]*`([^`]+)`/)?.[1] ?? null) : null });
  }
  return tasks;
}

// Phases for the JSON report and nextStep: [{ n, title, open, gate }].
export function readPhases(file) {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const titles = new Map([...text.matchAll(/^##\s+(\d+)\.\s*(.*)$/gm)].map((m) => [Number(m[1]), m[2].trim()]));
  const phases = new Map();
  for (const t of parseTasks(text)) {
    if (!phases.has(t.phase)) phases.set(t.phase, { n: t.phase, title: titles.get(t.phase) || '', open: [], gate: null });
    const p = phases.get(t.phase);
    if (t.isGate) p.gate ??= { id: t.id, done: t.done, command: t.command };
    else if (!t.done) p.open.push(t.id);
  }
  return [...phases.values()].sort((a, b) => a.n - b.n);
}

// Item 1: every task ticked, every gate command green in evidence.md at a
// current commit.
export function tasksItem(root, id, facts = gitFacts(root)) {
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
  const staleWhy = text === null ? null : staleness(root, parseCommitLine(text), facts);
  if (text !== null) evidence = staleWhy ? 'stale' : 'current';
  const passing = text === null ? [] : tableRows(text).filter((cells) => /^pass/i.test(cells.at(-1) || ''));
  const missingGates = commands.filter((c) => !passing.some((cells) => cells.some((cell) => cell.includes(`\`${c}\``))));
  const details = { unticked, missingGates, evidence };
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
  return item(1, 'tasks', 'met', `all tasks ticked${commands.length ? `; ${commands.length} gate command${commands.length > 1 ? 's' : ''} green in evidence.md` : ''}`, details);
}

// Cells of every markdown table row in the text.
function tableRows(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'))
    .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
}

// The [blocking] / [important] findings of the *.md files of a folder, by disposition: { fixed, refuted, undisposed }.
// A "fixed in <sha>" counts only when the sha is in the history of `head`.
export function findingsIn(root, dir, head) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  const undisposed = [];
  let fixed = 0;
  let refuted = 0;
  for (const f of files) {
    const reviewer = basename(f, '.md');
    for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/)) {
      if (!/^\s*(?:[-*+]|\d+[.)])\s+\**\[(?:blocking|important)\]/i.test(line)) continue;
      const fix = line.match(/·\s*fixed in\s+([0-9a-f]{7,40})\b/i);
      if (fix && inHistory(root, fix[1], head)) { fixed++; continue; }
      if (!fix && /·\s*refuted:\s*\S/.test(line)) { refuted++; continue; }
      undisposed.push({ reviewer, excerpt: line.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, '').slice(0, 100) });
    }
  }
  return { fixed, refuted, undisposed };
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
  const why = text === null ? null : staleness(root, parseCommitLine(text), facts);
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
export function fetchPr(gh, { merge = false, number = null, branch = '', list: lookup = merge, base = null } = {}) {
  const fields = merge ? MERGE_FIELDS : PR_FIELDS;
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

// The files a pull request changed, read by number and paginated (gh pr view --json files stops at 100):
// { files } | { error }.
export function prFiles(gh, number) {
  const r = gh(['api', `repos/{owner}/{repo}/pulls/${number}/files`, '--paginate', '--jq', '.[].filename']);
  if (r.status !== 0) return { error: ghError(r) };
  return { files: String(r.stdout).split(/\r?\n/).filter(Boolean) };
}

// The change's own pull request (field-fixes D-4): not an archive head, no archive folder among its files,
// and some file under the change's active folder. A body or a head name that names the change is never proof.
export function isOwnPr(id, pr, files) {
  if (isArchiveHead(pr?.headRefName)) return false;
  if (files.some((f) => f.startsWith('openspec/changes/archive/'))) return false;
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
// branch is the change's own, 'list' when found among the merged PRs. "The
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
const branchNamesChange = (branch, id) => branch.split('/').pop() === id || branch.includes(id);

function mergedOnBranch(gh, id, found, branch, merge, base = null) {
  const files = prFiles(gh, found.pr.number);
  if (files.error) return { error: files.error };
  if (!isOwnPr(id, { headRefName: found.pr.headRefName ?? branch }, files.files)) return { none: true };
  const tasks = defaultTasks(gh, id);
  if (tasks.error) return { error: tasks.error };
  const known = { tasks, repo: tasks.repo };
  if (tasks.unticked?.length === 0 || !branch) return { ...found, ...known };
  const l = gh(['pr', 'list', '--head', branch, ...(base ? ['--base', base] : []), '--state', 'open', '--limit', '10', '--json', merge ? MERGE_FIELDS : PR_FIELDS]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  const open = Array.isArray(list) ? list.find((p) => p.state === 'OPEN') : null;
  return open ? { pr: open, via: 'branch' } : { none: true, mergedBefore: found.pr.number, ...known };
}

// In `two-prs` `base` is the base branch: only the pull requests to it are the change's own (the one to the test branch is not).
export function findChangePr(gh, root, id, { ship = 'plan', branch = '', env = process.env, number = null, base = null } = {}) {
  const merge = ship === 'merge';
  const selected = resolveChange(root, env, branch);
  const own = selected?.name === id && Boolean(branch) && branchNamesChange(branch, id) && !defaultBranches(root).includes(branch) && !archiveHeads(id).includes(branch);
  if (ship === 'plan' || number || own) {
    const r = fetchPr(gh, { merge, number, branch: own ? branch : '', list: ship !== 'plan', base });
    if (!r.pr) return r;
    const found = { ...r, via: 'branch' };
    return ship !== 'plan' && r.pr.state === 'MERGED' ? mergedOnBranch(gh, id, found, own ? branch : '', merge, base) : found;
  }
  // Light fields only: 100 PRs with their bodies can pass spawnSync's buffer. A PR's files are read,
  // by number and newest first, only while no PR has been found to be the change's own.
  const light = `${(merge ? MERGE_FIELDS : PR_FIELDS).replace(',body', '')},headRefName,mergedAt`;
  const l = gh(['pr', 'list', '--state', 'merged', '--limit', '100', '--json', light]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
  const rest = list.filter((p) => !isArchiveHead(p.headRefName) && (!base || p.baseRefName === base)).sort((a, b) => when(b.mergedAt) - when(a.mergedAt));
  for (const p of rest) {
    const f = prFiles(gh, p.number);
    if (f.error) return { error: f.error };
    if (isOwnPr(id, p, f.files)) return { pr: p, via: 'list' };
  }
  return { none: true };
}

// What the delivery of change `id` is (field-fixes D-4): its PR as findChangePr answers it, and whether the
// change is delivered: archived, or its own PR merged with every task ticked on the default branch.
// { fetched, delivered, merged, left: [ids], absent, repo, error }.
export function deliveryOf(gh, root, id, { ship = 'plan', branch = '', env = process.env, located = null, number = null, base = null } = {}) {
  let fetched = findChangePr(gh, root, id, { ship, branch, env, number, base });
  const archived = Boolean(located?.archived);
  const mergedPr = fetched.pr?.state === 'MERGED';
  let tasks = fetched.tasks ?? null;
  if (mergedPr && !archived && ship !== 'plan' && !tasks) tasks = defaultTasks(gh, id);
  if (tasks?.error) fetched = { error: tasks.error };
  const left = tasks?.unticked ?? [];
  const delivered = archived || (ship !== 'plan' && mergedPr && Boolean(tasks) && !tasks.error && !tasks.absent && left.length === 0);
  return {
    fetched,
    delivered,
    merged: mergedPr || fetched.mergedBefore != null,
    left,
    absent: Boolean(tasks?.absent),
    repo: tasks?.repo ?? null,
    error: fetched.error ?? null,
  };
}

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
    if (pr.headRefOid === facts.head) return item(5, name, 'met', `PR #${pr.number} merged`, { pr: ref, merged: true });
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

// Checks of a PR: { checks: [...] } | { none: 'required' | 'any' } | { error }.
// gh prints the JSON list with exit 8 (pending) and exit 1 (a failure), so the
// list wins over the exit code when it parses.
function readChecks(gh, number, required) {
  const r = gh(['pr', 'checks', String(number), ...(required ? ['--required'] : []), '--json', 'name,state,bucket,link']);
  try {
    const list = JSON.parse(r.stdout);
    if (Array.isArray(list)) return { checks: list };
  } catch { /* not JSON: look at the error */ }
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

// The paths the archive branch changes against origin/<base>, committed or not:
// { paths } | { missing: true } when origin/<base> does not resolve.
function archiveChanges(root, base) {
  const ref = `origin/${base}`;
  if (!gitOk(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return { missing: true };
  let mergeBase;
  try { mergeBase = git(root, ['merge-base', ref, 'HEAD']).trim(); } catch { return { missing: true }; }
  const committed = git(root, ['diff', '--name-only', '-z', '--no-renames', `${mergeBase}..HEAD`]).split('\0').filter(Boolean);
  return { paths: [...new Set([...committed, ...changedInTree(root)])].sort() };
}

// What an archive always changes without a proposal: the change folders (the move) and the
// roadmap tick. Everything else under openspec/ (config.yaml, schemas/) needs a named proposal.
const isArchiveRecord = (p) => p.startsWith('openspec/changes/') || p === 'openspec/roadmap.md';
const normalizePath = (p) => p.replace(/^(\.\/)+/, '');
// Files a version bump or a regenerated catalog changes without a proposal naming them (design D8).
export const RELEASE_FILE = /^(plugins\/[^/]+\/\.claude-plugin\/plugin\.json|\.claude-plugin\/marketplace\.json|CHANGELOG\.md|docs\/catalog\.md)$/;

// The changed paths that no approved proposal names exactly (AC-3):
// no directory, prefix or glob matching.
export function unnamedFiles(paths, proposals) {
  const named = new Set(proposals.filter((p) => p.answer === 'approved').flatMap((p) => p.targets.map(normalizePath)));
  const canonical = canonicalSpecs(paths);
  return paths.filter((p) => !isArchiveRecord(p) && !canonical.has(p) && !RELEASE_FILE.test(p) && !named.has(p));
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
function readContents(gh, path, base) {
  const r = gh(['api', `repos/{owner}/{repo}/contents/${path}?ref=${encodeURIComponent(base)}`]);
  if (r.status !== 0) return !r.missing && !r.timedOut && /HTTP 404\b/.test(r.stderr) ? { notFound: true } : { error: ghError(r) };
  try { return { json: JSON.parse(r.stdout) }; } catch { return { error: `${path} returned unreadable JSON` }; }
}

// The archive PR of the head branch (`chore/archive-<id>`, or the test branch's own): the OPEN one, else the newest MERGED,
// else the newest CLOSED.
function archivePrFacts(gh, root, id, base, facts, branch = `chore/archive-${id}`) {
  const l = gh(['pr', 'list', '--head', branch, '--state', 'all', '--limit', '10', '--json', 'number,url,state,headRefOid,mergeable,autoMergeRequest,mergeStateStatus']);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
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

function archiveBaseFacts(gh, root, id, { located, repo, facts, changePr, branch, env }) {
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
  const here = { ...common, base };
  const unreadable = (e) => ({ ...here, onDefault: null, ...stop('read-default-branch', `cannot read ${base} on GitHub: ${e}`) });

  const on = changeOn(gh, id, base);
  if (on.error) return unreadable(on.error);
  if (on.state === 'archived') return { ...here, onDefault: 'archived', folder: on.folder };
  const onDefault = on.state;

  const prs = archivePrFacts(gh, root, id, base, facts);
  if (prs.error) return { ...here, onDefault, ...stop('archive-pr', `cannot read the archive PR: ${prs.error}`) };
  return { ...here, onDefault, pr: prs.pr, changed: located.archived || prs.pr ? archiveChanges(root, base) : null };
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

const approved = (verdict) => verdict === 'APPROVED' || verdict === 'DECLINED';
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
  const brief = (ps) => ps.map(({ n, targets, kind }) => ({ n, targets, kind }));
  const unanswered = a.retro.proposals.filter((p) => p.answer === null);
  const answersStop = () => step('stop-retro-answers', `${unanswered.length} retro proposal${unanswered.length > 1 ? 's' : ''} waiting for the owner's answer`, { proposals: brief(unanswered) });
  const filesStop = () => {
    if (a.changed?.missing) return stopArchive('archive', `origin/${a.base} is not available; git fetch origin ${a.base}`);
    const offending = unnamedFiles(a.changed?.paths ?? [], a.retro.proposals);
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
    if (merge && pr.autoMerge && (held || conflicts || failing || pr.headRel !== 'same' || uncommitted)) {
      return step('disable-auto-merge', `auto-merge is on but the archive PR #${pr.number} no longer qualifies`, { number: pr.number });
    }
    if (held) return held;
    if (conflicts) return stopArchive('archive-pr', `PR #${pr.number} has merge conflicts with ${a.base}`, { conflict: true });
    if (pr.headRel === 'foreign') return stopArchive('archive-pr', `PR #${pr.number} head ${String(pr.headRefOid).slice(0, 7)} is not in local history (someone else pushed?)`);
    if (pr.headRel === 'ahead' || uncommitted) {
      return step('open-archive-pr', `${pr.headRel === 'ahead' ? `local is ahead of PR head ${String(pr.headRefOid).slice(0, 7)}` : `uncommitted files: ${a.dirty.slice(0, 3).join(', ')}`}; commit and push`, { branch: a.branch, number: pr.number });
    }
    if (failing) {
      const f = pr.checks.failing.map((c) => `${c.name} (${c.link})`).join(', ');
      return stopArchive('archive-pr', pr.checks.error ? `cannot read the checks: ${pr.checks.error}` : `failing ${f}`);
    }
    if (merge && pr.mergeStateStatus === 'BEHIND') return step('update-branch', `archive PR #${pr.number} is behind ${a.base}; update it`, { number: pr.number });
    if (two && !merge) return two.testPr ? readyBoth() : openTestArchive();
    if (!merge) return step('archive-pr-ready', `archive PR #${pr.number} is open; merge it, then run again`, { number: pr.number, url: pr.url });
    if (!pr.autoMerge) return step('enable-auto-merge', `archive PR #${pr.number} qualifies`, { number: pr.number, method: state.mergeMethod, head: state.head });
    return step('wait-merge', 'auto-merge is on; GitHub merges once its rules pass', { number: pr.number, head: pr.headRefOid, waitingFor: waitingFor(pr.mergeStateStatus) });
  }
  if (pr?.state === 'MERGED') return stopArchive('archive-pr', `PR #${pr.number} is merged but ${a.base} still has openspec/changes/${state.id}/; run again`);
  if (pr?.state === 'CLOSED') return stopArchive('archive-pr', `PR #${pr.number} was closed without merging; reopen it (the flow opens no second archive PR)`);

  if (!a.retro.exists) return step('retro', 'the change PR is merged; run the retro', { number: a.changePr?.number ?? null, base: a.base });
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
// hash, so the owner is asked again.
export function approvalState(dir) {
  const readinessFile = join(dir, 'readiness.md');
  const readiness = existsSync(readinessFile)
    ? `sha256:${createHash('sha256').update(readFileSync(readinessFile)).digest('hex').slice(0, 12)}`
    : null;
  const file = join(dir, 'approval.md');
  const status = readValue(file, 'Status');
  const recorded = readValue(file, 'Readiness')?.toLowerCase() ?? null;
  return { status, recorded, readiness, ok: status === 'APPROVED' && readiness !== null && recorded === readiness };
}

// The one step to take now, computed from facts only (see design D4, first
// match wins; evidence-before-review design D2 puts fix-defect and verify ahead
// of review). `state` is what collectState builds.
export function nextStep(state) {
  const it = (n) => state.items[n - 1];
  const step = (name, reason, extra = {}) => ({ step: name, reason, ...extra });

  const merge = state.ship === 'merge';
  const allMet = state.items.every((i) => i.status === 'met');
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
  if (state.archive) return archiveNext(state);
  if (!state.branchOk) {
    const m = state.mergedLeft;
    if (m) return step('stop-branch', `PR #${m.number} of ${state.id} merged with tasks left (${m.tasks.join(', ')}); continue on branch ${state.id} and open a further pull request`, { number: m.number, tasks: m.tasks });
    return step('stop-branch', `the current branch does not select change ${state.id} for the hooks; create or switch to a branch named after it`);
  }
  if (state.needsReadiness && state.readiness !== 'APPROVED') {
    return step('stop-not-approved', `readiness.md Status is ${state.readiness || 'missing'}, expected APPROVED; the plan needs its approval first`);
  }
  if (state.needsReadiness && state.readiness === 'APPROVED' && state.approval && !state.approval.ok && !state.started) {
    const earlier = state.approval.status === 'APPROVED' && state.approval.recorded;
    return step('stop-plan-approval', earlier ? 'approval.md is for an earlier readiness.md' : 'no recorded owner approval', {
      readiness: state.approval.readiness,
      file: `openspec/changes/${state.id}/approval.md`,
    });
  }
  if (merge && state.setup && !state.setup.ok) {
    return step('stop-merge-setup', `merge mode needs the repository prepared: ${state.setup.missing.join('; ')}`, { missing: state.setup.missing });
  }
  for (const p of state.phases) {
    if (p.open.length) return step('implement', `phase ${p.n} has unticked tasks: ${p.open.join(', ')}`, { phase: p.n });
    if (p.gate && !p.gate.done) {
      return step('gate', `phase ${p.n} is implemented; run its gate ${p.gate.id}`, { phase: p.n, task: p.gate.id, command: p.gate.command });
    }
  }
  if (state.dirty.length) return step('commit', `uncommitted changes outside openspec/: ${state.dirty.slice(0, 3).join(', ')}`, { paths: state.dirty });

  const rejectedNow = state.reviews.filter((r) => r.current && !approved(r.verdict)).map((r) => r.name);
  if (rejectedNow.length && state.reviewMd?.consensus === 'FAIL' && state.reviewMd.round >= 2) {
    return step('stop-review-deadlock', `${rejectedNow.join(', ')} still rejects after round 2; the owner decides`, { reviewers: rejectedNow });
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
    const reRejected = toReview.some((n) => {
      const r = state.reviews.find((x) => x.name === n);
      return r && !approved(r.verdict);
    });
    const round = state.reviewMd?.consensus === 'FAIL' && state.reviewMd.round === 1 && reRejected ? 2 : 1;
    return step('review', `review needed from ${toReview.join(', ')}`, { reviewers: toReview, round });
  }
  const stuck = [1, 2, 3, 4].find((n) => it(n).status === 'blocked');
  if (stuck) return step('blocked', it(stuck).reason, { item: stuck });
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
  if (it(5).status === 'blocked') return step('blocked', it(5).reason, { item: 5, ...(it(5).details.conflict ? { conflict: true } : {}) });
  const five = it(5).details;
  if (merge && it(5).status === 'open' && five.behind && !five.ahead && !five.uncommitted.length) {
    return step('update-branch', it(5).reason, { number: state.pr.number });
  }
  if (it(5).status === 'open') return step('push', it(5).reason);
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
        if (res.rejected.length && res.round?.consensus === 'FAIL' && res.round.round >= 2) {
          return step('stop-review-deadlock', `${res.rejected.join(', ')} still rejects the resolution after round 2; the owner decides`, { reviewers: res.rejected, resolution: true });
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
        const round = res.round?.consensus === 'FAIL' && res.round.round === 1 && again ? 2 : 1;
        return step('review-resolution', `the resolution on ${sup.branch} needs a review from ${uniq([...res.missing, ...res.stale]).join(', ')}`, {
          root: two.root, support: sup.branch, commits: res.commits.map(({ sha, subject }) => ({ sha, subject })), diffs: res.commits.map((c) => c.diff), commit: res.newest, round,
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
  if (it(6).details.pending.length) return step('wait-checks', it(6).reason, { pending: it(6).details.pending });
  const left = state.items.find((i) => i.status !== 'met');
  if (left) return step('blocked', left.reason, { item: left.id });
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
  const facts = gitFacts(root);
  const located = locateChange(root, id) ?? { dir: changeDir(root, id), archived: false };
  const dir = located.dir;
  const schema = schemaOf(root, located);
  const { ship, mergeMethod, model, base: configuredBase, testBranch } = deliveryConfig(root, schema);
  const two = model === 'two-prs';
  const branch = currentBranch(root, env);
  const selected = resolveChange(root, env, branch);
  const merge = ship === 'merge';
  const delivery = deliveryOf(gh, root, id, { ship, branch, env, located, number: prNumber, ...(two ? { base: configuredBase } : {}) });
  const fetched = delivery.fetched;
  // The post-merge phase: the change is delivered, its own PR merged with every task ticked on the default
  // branch, or its folder already moved (design D4, field-fixes D-4).
  const postMerge = ship !== 'plan' && delivery.delivered;
  const repo = merge || postMerge || two ? (delivery.repo ?? readRepoSettings(gh)) : null;
  const mergedLeft = delivery.merged && !delivery.delivered && delivery.left.length
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
    ...(merge ? { setup: mergeSetup(gh, root, mergeMethod, repo) } : {}),
  };
  // The facts of the two-pull-request delivery (D-4): the base is the repository's default branch, the pull request to the test
  // branch and, once it merged, the base checks that ran before it. `checks` is the base pull request's item 6.
  const twoPrsOf = (acIds, checks) => {
    const defaultBranch = repo?.settings?.default_branch ?? null;
    const test = findTestPr(gh, { id, testBranch, acIds });
    const support = supportState(root, id, testBranch);
    const taskRef = gitOk(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${id}`]) ? `refs/heads/${id}` : 'HEAD';
    const resolution = resolutionState(root, id, { taskRef, supportRef: support.exists ? `refs/heads/${support.branch}` : null });
    return {
      base: configuredBase, testBranch, defaultBranch, defaultOk: defaultBranch === configuredBase, defaultError: repo?.error ?? null,
      foreign: testBranchCommit(root, { base: configuredBase, testBranch, head: 'HEAD' }),
      test, rerun: checks ? reviewsRerun(gh, checks, test) : null,
      root, support, resolution,
    };
  };
  const prFacts = (f) => (f.pr
    ? { number: f.pr.number, url: f.pr.url, state: f.pr.state, headRefOid: f.pr.headRefOid, mergeable: f.pr.mergeable ?? null, ...(merge ? { autoMerge: f.pr.autoMergeRequest != null, mergeStateStatus: f.pr.mergeStateStatus ?? null } : {}) }
    : null);

  if (postMerge) {
    const pr = fetched.pr;
    const checked = (n, name, details) => item(n, name, 'met', pr ? `checked before PR #${pr.number} merged` : 'checked before the change was archived', details);
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
      pr: prFacts(fetched),
      ...(two ? { twoPrs: twoPrsOf([], null) } : {}),
      archive: archiveFacts(gh, root, id, { located, repo, facts, changePr: pr, branch, env, testBranch: two ? testBranch : null }),
      items: [
        checked(1, 'tasks', { unticked: [], missingGates: [], evidence: 'current' }),
        checked(2, 'reviews', { stale: [], rejected: [], missing: [] }),
        checked(3, 'findings', { fixed: 0, refuted: 0, undisposed: [] }),
        checked(4, 'acceptance', { ids: [], proven: [], missing: [], defects: [], noProof: [], evidence: 'current' }),
        five,
        checked(6, 'checks', { required: false, failing: [], pending: [] }),
        checked(7, 'conversation', { threads: [], comments: [], changesRequested: [], waiting: [] }),
        checked(8, 'body', { missing: [] }),
      ],
    };
  }

  const acceptance = acceptanceItem(root, id, facts);
  const items = [
    tasksItem(root, id, facts),
    reviewsItem(root, id, facts),
    findingsItem(root, id, facts),
    acceptance,
    prItem(root, id, fetched, facts, { merge }),
    checksItem(fetched, gh),
    conversationItem(fetched, gh),
    bodyItem(id, fetched, acceptance.details.ids),
  ];
  const needsReadiness = schemaHasArtifact(root, schema, 'readiness');
  return {
    ...common,
    branchOk: selected?.name === id && Boolean(branch) && !defaultBranches(root).includes(branch),
    needsReadiness,
    readiness: needsReadiness ? readValue(join(dir, 'readiness.md'), 'Status') : null,
    approval: needsReadiness ? approvalState(dir) : null,
    started: existsSync(join(dir, 'tasks.md')) && parseTasks(readFileSync(join(dir, 'tasks.md'), 'utf8')).some((t) => t.done),
    phases: readPhases(join(dir, 'tasks.md')),
    reviewMd: readReviewMd(join(dir, 'review.md')),
    reviews: readReviews(root, id, facts).map((r) => ({ name: r.name, verdict: r.verdict, current: !r.why })),
    pr: prFacts(fetched),
    ...(two ? { twoPrs: twoPrsOf(acceptance.details.ids, items[5]) } : {}),
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
    retro: n.number ? `PR #${n.number}` : '',
    'open-archive-pr': n.branch,
    'open-test-archive-pr': n.branch,
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
    unnamed: devkit.length ? unnamedFiles(changes.paths, proposals) : [],
    slices,
    notes,
  };
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
  const facts = gitFacts(root);
  ciPreflight(root, env, facts.head);
  const two = twoPrsContext(root, env);
  let selected;
  try { selected = selectCiChange(root, opts.id, env, currentBranch(root, env)); } catch (e) {
    if (!(e instanceof CiFailure)) throw e;
    return { code: 1, stdout: opts.json ? `${JSON.stringify({ version: 1, mode: 'ci', pass: false, error: e.message })}\n` : '', stderr: `deliver-check: ${e.message}\n` };
  }
  if (selected.none && env.GITHUB_BASE_REF) {
    const a = archivePrCheck(root, env.GITHUB_BASE_REF);
    if (a) {
      const retroOf = (f) => `${f}/retro.md`;
      const problems = [
        ...a.missingRetro.map((f) => `${retroOf(f)} is missing: it holds the change's retro, with a "## Proposed updates" section listing each proposal and the owner's answer to it; the retro step of the archive writes it (/devkit change, or ship-change for a change begun under the previous script, after the change's pull request merges)`),
        ...a.noRetro.filter((f) => !a.missingRetro.includes(f)).map((f) => `${retroOf(f)} has no "## Proposed updates" section: it must list each proposal with the owner's answer; the retro step of the archive writes it`),
        ...(a.unanswered.length ? [`unanswered proposals: ${a.unanswered.length}`] : []),
        ...(a.unnamed.length ? [`files no approved proposal names: ${a.unnamed.join(', ')}`] : []),
        ...a.slices.flatMap((s) => s.problems.map((m) => `slice ${s.id}: ${m}`)),
      ];
      const sliceLines = a.slices.filter((s) => !s.problems.length).map((s) => `  slice ${s.id}: passed the slice contract`);
      const pass = problems.length === 0;
      const text = [`devkit-reviews: archive ${a.folders.join(', ')}`, ...a.notes.map((n) => `  note: ${otherScriptNote(n.change, n.schema)}`), ...sliceLines, ...problems.map((m) => `  ${m}`), pass ? 'pass' : `fail: ${problems.join('; ')}`].join('\n') + '\n';
      return finish(pass ? 0 : 1, { version: 1, mode: 'ci', change: null, pass, archive: a }, text);
    }
  }
  if (selected.several) return runSeveral(root, selected.several, facts, finish, two);
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
  const one = checkOne(root, id, facts, two);
  return finish(one.pass ? 0 : 1, one.report, [...one.lines, one.pass ? 'pass' : `fail: ${one.failed.join(', ')}`].join('\n') + '\n');
}

// Today's single-change check, unchanged: { report, lines, failed, pass } for a change on a devkit script. On a pull request to the
// test branch of a two-prs project (D-7) it judges the resolution instead.
function checkOne(root, id, facts, two = null) {
  if (two && two.env.GITHUB_BASE_REF === two.testBranch && !(two.defaultName && two.defaultName !== two.base)) return testBranchPr(root, id, facts, two);
  const schema = changeSchema(root, id);
  const needsReadiness = schemaHasArtifact(root, schema, 'readiness');
  const status = needsReadiness ? readValue(join(changeDir(root, id), 'readiness.md'), 'Status') : null;
  const readinessMet = !needsReadiness || status === 'APPROVED';
  const items = [tasksItem(root, id, facts), reviewsItem(root, id, facts), findingsItem(root, id, facts), acceptanceItem(root, id, facts)];
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
function runSeveral(root, ids, facts, finish, two = null) {
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
  const results = judged.map((id) => ({ id, ...checkOne(root, id, facts, two) }));
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
    const code = report.summary.startsWith('blocked') || report.items.some((i) => i.status === 'blocked') ? 2 : report.met === 8 && report.next.step !== 'stop-plan-approval' ? 0 : 1;
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
