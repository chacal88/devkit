// deliver-check: is a change a ready PR? (ship-modes, design D2 and D4)
//
// Reads files and git; never writes, pushes or posts. No dependencies.
// Imports its helpers from guard.mjs, which runs a mode only when executed
// directly, so importing it here has no side effects.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mergeSetup, readRepoSettings, makeGh, ghError, GH_TIMEOUT_MS, DEVKIT_REVIEWS_CHECK } from './merge-setup.mjs';

// The shared gh runner (merge-setup.mjs), kept importable from here.
export { makeGh };
import { archiveBranchChange, changeDir, changeSchema, changeSchemaAt, findRoot, readValue, resolveChange, schemaHasArtifact, REQUIRED_REVIEWERS } from './guard.mjs';

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

// ---------------------------------------------------------------- git facts and staleness

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gitOk(root, args) {
  try { git(root, args); return true; } catch { return false; }
}

const isOpenspec = (p) => p.startsWith('openspec/');

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

// Why a recorded Commit is not current at HEAD, or null when it is: it
// resolves, is an ancestor of HEAD, every commit since touches only
// openspec/, it is not marked uncommitted, and the working tree has no change
// outside openspec/ and .claude/.
export function staleness(root, recorded, facts = gitFacts(root)) {
  if (!recorded) return 'no Commit: line';
  const short = recorded.sha.slice(0, 7);
  if (recorded.uncommitted) return `${short} was recorded with uncommitted changes`;
  if (facts.dirty.length) return `uncommitted changes outside openspec/ (${facts.dirty.slice(0, 3).join(', ')})`;
  if (!facts.head) return 'no commit at HEAD yet';
  let full;
  try { full = git(root, ['rev-parse', '--verify', '--quiet', `${recorded.sha}^{commit}`]).trim(); } catch { full = ''; }
  if (!full) return `${short} does not resolve to a commit`;
  if (!gitOk(root, ['merge-base', '--is-ancestor', full, facts.head])) return `${short} is not an ancestor of HEAD`;
  for (const c of git(root, ['rev-list', `${full}..${facts.head}`]).split('\n').filter(Boolean)) {
    // -m: a merge commit lists the files it brings against each parent.
    const files = git(root, ['diff-tree', '-m', '-r', '-z', '--root', '--name-only', '--no-commit-id', c]).split('\0').filter(Boolean);
    const product = files.find((f) => !isOpenspec(f));
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

// Every reviews/*.md: { name, verdict, why } where why is null when its
// Commit: is current and the reason otherwise.
export function readReviews(root, id, facts = gitFacts(root)) {
  const dir = join(changeDir(root, id), 'reviews');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  return files.map((f) => {
    const file = join(dir, f);
    return {
      name: basename(f, '.md'),
      verdict: readValue(file, 'Verdict'),
      why: staleness(root, parseCommitLine(readFileSync(file, 'utf8')), facts),
    };
  });
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

// The checkbox lines of tasks.md: { phase, id, done, isGate, command }. A gate
// task's description (the text after its id) starts with "Gate:"; its command is the first backticked text after it.
export function parseTasks(text) {
  const tasks = [];
  let phase = 1;
  for (const line of String(text).split(/\r?\n/)) {
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

// Item 3: every [blocking] / [important] finding has a disposition.
export function findingsItem(root, id, facts = gitFacts(root)) {
  const dir = join(changeDir(root, id), 'reviews');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
  const undisposed = [];
  let fixed = 0;
  let refuted = 0;
  for (const f of files) {
    const reviewer = basename(f, '.md');
    for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/)) {
      if (!/^\s*(?:[-*+]|\d+[.)])\s+\**\[(?:blocking|important)\]/i.test(line)) continue;
      const fix = line.match(/·\s*fixed in\s+([0-9a-f]{7,40})\b/i);
      if (fix && inHistory(root, fix[1], facts.head)) { fixed++; continue; }
      if (!fix && /·\s*refuted:\s*\S/.test(line)) { refuted++; continue; }
      undisposed.push({ reviewer, excerpt: line.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, '').slice(0, 100) });
    }
  }
  const details = { fixed, refuted, undisposed };
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
export function fetchPr(gh, { merge = false, number = null, branch = '', list: lookup = merge } = {}) {
  const fields = merge ? MERGE_FIELDS : PR_FIELDS;
  const r = gh(['pr', 'view', ...(merge && number ? [String(number)] : []), '--json', fields]);
  if (r.status === 0) return parsePr(r);
  if (!r.missing && /no pull requests? found/i.test(r.stderr)) {
    if (!lookup || !branch) return { none: true };
    const l = gh(['pr', 'list', '--head', branch, '--state', 'all', '--limit', '10', '--json', fields]);
    if (l.status !== 0) return { error: ghError(l) };
    let list;
    try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
    const found = Array.isArray(list) ? (list.find((p) => p.state === 'OPEN') ?? list[0]) : null;
    return found ? { pr: found } : { none: true };
  }
  return { error: ghError(r) };
}

const NO_PR = 'no pull request for this branch yet';

// The branches the archive PR of change `id` is opened from: never the change branch.
const archiveHeads = (id) => [`chore/archive-${id}`, `archive-${id}`];

// The change's PR, whichever branch the checkout is on (archive-after-merge D4):
// { pr, via } | { none: true } | { error }. `via` is 'branch' when the current
// branch is the change's own, 'list' when found among the merged PRs.
//  1. plan mode, a known number, or the change branch: fetchPr as before (the
//     head-branch fallback also runs in pr mode);
//  2. otherwise, in pr and merge modes: the newest merged PR whose body links
//     the change's evidence.md, else the newest whose head's last segment is the
//     id. Archive heads are dropped first and there is no "contains" match.
export function findChangePr(gh, root, id, { ship = 'plan', branch = '', env = process.env, number = null } = {}) {
  const merge = ship === 'merge';
  const selected = resolveChange(root, env, branch);
  const own = selected?.name === id && Boolean(branch) && !defaultBranches(root).includes(branch) && !archiveHeads(id).includes(branch);
  if (ship === 'plan' || number || own) {
    const r = fetchPr(gh, { merge, number, branch: own ? branch : '', list: ship !== 'plan' });
    return r.pr ? { ...r, via: 'branch' } : r;
  }
  // Light fields only: 100 PRs with their bodies can pass spawnSync's buffer. A body is read,
  // by number and newest first, only while no PR has been found by its link.
  const light = `${(merge ? MERGE_FIELDS : PR_FIELDS).replace(',body', '')},headRefName,mergedAt`;
  const l = gh(['pr', 'list', '--state', 'merged', '--limit', '100', '--json', light]);
  if (l.status !== 0) return { error: ghError(l) };
  let list;
  try { list = JSON.parse(l.stdout); } catch { return { error: 'gh pr list returned unreadable JSON' }; }
  if (!Array.isArray(list)) return { error: 'gh pr list returned unreadable JSON' };
  const heads = archiveHeads(id);
  const rest = list.filter((p) => !heads.includes(p.headRefName)).sort((a, b) => when(b.mergedAt) - when(a.mergedAt));
  const link = `openspec/changes/${id}/evidence.md`;
  for (const p of rest) {
    const b = gh(['pr', 'view', String(p.number), '--json', 'body']);
    if (b.status !== 0) return { error: ghError(b) };
    let body;
    try { body = JSON.parse(b.stdout)?.body; } catch { return { error: 'gh pr view returned unreadable JSON' }; }
    if (String(body ?? '').includes(link)) return { pr: { ...p, body }, via: 'list' };
  }
  const byHead = rest.find((p) => String(p.headRefName).split('/').pop() === id);
  return byHead ? { pr: byHead, via: 'list' } : { none: true };
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
  return paths.filter((p) => !isArchiveRecord(p) && !RELEASE_FILE.test(p) && !named.has(p));
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

// The archive PR of the branch: the OPEN one, else the newest MERGED, else the newest CLOSED.
function archivePrFacts(gh, root, id, base, facts) {
  const branch = `chore/archive-${id}`;
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

// Everything the post-merge rows read (design D4, D7): the default branch and
// the archive PR from GitHub, the rest from the working tree.
function archiveFacts(gh, root, id, { located, repo, facts, changePr, branch, env }) {
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

  const listing = readContents(gh, 'openspec/changes/archive', base);
  if (listing.error) return unreadable(listing.error);
  const wanted = ARCHIVE_NAME(id);
  const archived = Array.isArray(listing.json) ? listing.json.map((e) => e?.name).filter((n) => typeof n === 'string' && wanted.test(n)).sort().at(-1) : null;
  if (archived) return { ...here, onDefault: 'archived', folder: archived };
  const live = readContents(gh, `openspec/changes/${id}`, base);
  if (live.error) return unreadable(live.error);
  const onDefault = live.notFound ? 'absent' : 'active';

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

  if (a.onDefault === 'archived') return step('archived', `${a.folder} is on ${a.base}`, { folder: a.folder });
  if (a.stop) return stopArchive(a.stop.archiveStep, a.stop.reason);
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
  if (state.archive) return archiveNext(state);
  if (!state.branchOk) return step('stop-branch', `the current branch does not select change ${state.id} for the hooks; create or switch to a branch named after it`);
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

  if (it(5).details.none) return step('open-pr', 'no pull request yet');
  if (it(5).status === 'blocked') return step('blocked', it(5).reason, { item: 5, ...(it(5).details.conflict ? { conflict: true } : {}) });
  const five = it(5).details;
  if (merge && it(5).status === 'open' && five.behind && !five.ahead && !five.uncommitted.length) {
    return step('update-branch', it(5).reason, { number: state.pr.number });
  }
  if (it(5).status === 'open') return step('push', it(5).reason);
  if (it(8).status === 'open') return step('edit-pr-body', it(8).reason, { missing: it(8).details.missing });
  const reviewsCheck = it(6).details.failing.find((f) => f.name === DEVKIT_REVIEWS_CHECK);
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
  if (!merge) return step('ready', 'all eight items are met');
  if (state.pr.autoMerge) return step('wait-merge', 'auto-merge is on; GitHub merges once its rules pass', { number: state.pr.number, head: state.pr.headRefOid, waitingFor: waitingFor(state.pr.mergeStateStatus) });
  return step('enable-auto-merge', 'all eight items are met', { number: state.pr.number, method: state.mergeMethod, head: state.head });
}

// ---------------------------------------------------------------- collecting the facts

function currentBranch(root, env) {
  if (env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF) return env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF;
  try { return git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).trim(); } catch { return ''; }
}

function defaultBranches(root) {
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
  const { ship, mergeMethod } = shipConfig(root, schema);
  const branch = currentBranch(root, env);
  const selected = resolveChange(root, env, branch);
  const merge = ship === 'merge';
  const fetched = findChangePr(gh, root, id, { ship, branch, env, number: prNumber });
  // The post-merge phase: the change PR is merged, or the folder already moved (design D4).
  const postMerge = ship !== 'plan' && (located.archived || fetched.pr?.state === 'MERGED');
  const repo = merge || postMerge ? readRepoSettings(gh) : null;
  const common = {
    id,
    schema,
    ship,
    mergeMethod,
    branch,
    head: facts.head,
    dirty: facts.dirty,
    ...(merge ? { setup: mergeSetup(gh, root, mergeMethod, repo) } : {}),
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
      archive: archiveFacts(gh, root, id, { located, repo, facts, changePr: pr, branch, env }),
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

// The summary line (design D6, D7). Merge mode and the archive steps name their own
// end states; every other summary is the items'.
function summaryOf(state, next, itemsSummary) {
  if (state.archive) {
    switch (next.step) {
      case 'archived': return 'archived';
      case 'wait-merge': return `archive PR open: waiting for ${next.waitingFor}`;
      case 'archive-pr-ready': return 'archive PR ready';
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
    blocked: `item ${n.item}: ${n.reason}`,
    'disable-auto-merge': `PR #${n.number}: ${n.reason}`,
    'update-branch': `PR #${n.number}`,
    'enable-auto-merge': `PR #${n.number} with --${n.method} at ${String(n.head).slice(0, 7)}`,
    'wait-merge': `waiting for ${n.waitingFor}`,
    retro: n.number ? `PR #${n.number}` : '',
    'open-archive-pr': n.branch,
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

// { name } | { none: true }; throws UsageError (exit 3) or CiFailure (exit 1).
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
    if (touched.length > 1) throw new CiFailure(`several changes are touched by this PR (${touched.join(', ')}); name the branch after one`);
    return { none: true };
  }
  if (archiving) return { none: true };
  if (active.length === 1) return { name: active[0] };
  if (active.length > 1) throw new CiFailure(`several open changes (${active.join(', ')}); name the branch after one, or set DEVKIT_CHANGE`);
  return { none: true };
}

// A shallow clone, or a checkout of something other than the PR head, would
// make every recorded Commit: read as stale: refuse both (exit 3).
function ciPreflight(root, env, head) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    throw new UsageError('fetch the full history (actions/checkout with fetch-depth: 0): reviews and evidence are checked against every commit since they were recorded');
  }
  if (!env.GITHUB_EVENT_PATH) return;
  let sha;
  try { sha = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.pull_request?.head?.sha; } catch { return; }
  if (typeof sha === 'string' && head && sha.toLowerCase() !== head.toLowerCase()) {
    throw new UsageError('check out the PR head (actions/checkout with ref: ${{ github.event.pull_request.head.sha }}), not the merge commit');
  }
}

// An archive PR (design D8): the archived folders the PR diff brings and the same exact-path
// file check and answer check the local run makes, read from the PR's own files. Null when
// the PR archives nothing. The retro of every archived folder must be readable and answered.
function archivePrCheck(root, base) {
  const changes = archiveChanges(root, base);
  if (changes.missing) throw new UsageError(`GITHUB_BASE_REF is ${base} but origin/${base} is not available; fetch the full history (actions/checkout with fetch-depth: 0)`);
  const folders = [...new Set(changes.paths.map((p) => /^(openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[^/]+)\//.exec(p)?.[1]).filter(Boolean))].sort();
  if (!folders.length) return null;
  const retros = folders.map((f) => ({ folder: f, retro: readRetro(join(root, f, 'retro.md')) }));
  const proposals = retros.flatMap((r) => r.retro.proposals);
  return {
    folders,
    noRetro: retros.filter((r) => !r.retro.readable).map((r) => r.folder),
    unanswered: proposals.filter((p) => p.answer === null).map((p) => p.n),
    unnamed: unnamedFiles(changes.paths, proposals),
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
  let selected;
  try { selected = selectCiChange(root, opts.id, env, currentBranch(root, env)); } catch (e) {
    if (!(e instanceof CiFailure)) throw e;
    return { code: 1, stdout: opts.json ? `${JSON.stringify({ version: 1, mode: 'ci', pass: false, error: e.message })}\n` : '', stderr: `deliver-check: ${e.message}\n` };
  }
  if (selected.none && env.GITHUB_BASE_REF) {
    const a = archivePrCheck(root, env.GITHUB_BASE_REF);
    if (a) {
      const problems = [
        ...a.noRetro.map((f) => `${f}/retro.md is missing or has no "## Proposed updates"`),
        ...(a.unanswered.length ? [`unanswered proposals: ${a.unanswered.length}`] : []),
        ...(a.unnamed.length ? [`files no approved proposal names: ${a.unnamed.join(', ')}`] : []),
      ];
      const pass = problems.length === 0;
      const text = [`devkit-reviews: archive ${a.folders.join(', ')}`, ...problems.map((m) => `  ${m}`), pass ? 'pass' : `fail: ${problems.join('; ')}`].join('\n') + '\n';
      return finish(pass ? 0 : 1, { version: 1, mode: 'ci', change: null, pass, archive: a }, text);
    }
  }
  if (selected.none) {
    const note = `no change selected by branch ${currentBranch(root, env) || '(detached)'} or touched by this PR; nothing to check`;
    return finish(0, { version: 1, mode: 'ci', change: null, pass: true, note }, `devkit-reviews: ${note}\n`);
  }
  const id = selected.name;
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
  const text = [
    `devkit-reviews: ${id} (schema ${schema}, head ${facts.head ? facts.head.slice(0, 7) : 'none'})`,
    ...(needsReadiness ? [`  readiness ${(readinessMet ? 'met' : 'open').padEnd(9)}Status: ${status || 'missing'}`] : []),
    ...items.map((i) => `  ${i.id} ${i.status.padEnd(9)}${LABELS[i.id - 1]}: ${i.reason}`),
    pass ? 'pass' : `fail: ${failed.join(', ')}`,
  ].join('\n') + '\n';
  return finish(pass ? 0 : 1, report, text);
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
    if (next?.step === 'wait-checks' && state.pr) {
      // One capped watch; the contract is computed again afterwards, whatever happened.
      const args = ['pr', 'checks', String(state.pr.number), '--watch', '--interval', '30', ...(state.items[5].details.required ? ['--required'] : [])];
      const r = gh(args, { timeout: opts.watch * 60000, killSignal: 'SIGTERM' });
      watch = { minutes: opts.watch, timedOut: r.timedOut };
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
