// The tick's prompt hook (helper-conductor D-4, AC-3): a `UserPromptSubmit` hook that lets a scheduled tick's prompt reach the model
// only when something is ready, by reading the run file with `node:fs` and no process. It prints nothing for any other prompt.
//
// Interim home of D-3's functions (task 2.17, before `multi-roadmaps` merges): `commonDirOf`, `localRunFilePath`, `localFacts` and
// `tickReady` live here with their minimal copies of what they call (`limitOf`, `isChangeId`, the claim's stale bound). Task 2.1 moves
// them to `guard.mjs` and `run-file.mjs` and deletes this copy. This module imports nothing from `roadmap-loop.mjs` or `run-file.mjs`;
// `guard.mjs` comes by a dynamic `import()` on the main path, after the raw match, so any other prompt loads nothing.
// Runs nothing when imported.

import { readFileSync, readdirSync, existsSync, statSync, appendFileSync, realpathSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadavg, cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------- minimal copies (deleted by task 2.1)

const DEFAULT_LIMIT = 80;

// The same lines as `roadmap-loop.mjs` `limitOf`: a whole number from 1 to 1000; anything else is 80.
function limitOf(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return DEFAULT_LIMIT;
  const n = Number(text);
  return n >= 1 && n <= 1000 ? n : DEFAULT_LIMIT;
}

// The same line as `guard.mjs` `isChangeId`.
const isChangeId = (id) => typeof id === 'string' && /^[A-Za-z0-9][\w.-]*$/.test(id);

const CLAIM_STALE_MS = 2 * 60 * 60 * 1000;

// D-2: `DEVKIT_CLAIM_STALE_MS`, a whole number of milliseconds from 1000 up, replaces the two hours; any other value is ignored.
function claimStaleMs(env = process.env) {
  const text = env.DEVKIT_CLAIM_STALE_MS;
  return typeof text === 'string' && /^\d+$/.test(text) && Number(text) >= 1000 ? Number(text) : CLAIM_STALE_MS;
}

// ---------------------------------------------------------------- the run, as far as D-3 reads it

const HOLD_KINDS = ['github', 'place', 'load', 'after', 'owner', 'blocked', 'delegated', 'archived', 'boarded', 'escalated', 'skipped', 'elsewhere'];

const stringOrNull = (v) => (typeof v === 'string' ? v : null);

function claimOf(v) {
  return isObject(v) && typeof v.session === 'string' ? { session: v.session, at: stringOrNull(v.at), heartbeat: stringOrNull(v.heartbeat) } : null;
}

// D-2's type rules for the fields D-3 reads, from a parsed run file that is an object: an entry is kept only when it is whole and of the
// right type. Task 2.1 replaces this with `readRun`.
function runOf(parsed) {
  const run = { task: null, ended: null, queue: [], claims: {}, holds: {}, ownerWaits: {}, train: null, places: 1, stopping: false, anyway: [], occupied: {} };
  if (isObject(parsed.task) && typeof parsed.task.id === 'string') run.task = { id: parsed.task.id, cron: stringOrNull(parsed.task.cron), at: stringOrNull(parsed.task.at) };
  const e = parsed.ended;
  if (isObject(e) && (e.why === 'done' || e.why === 'stopped') && typeof e.at === 'string' && typeof e.task === 'string') run.ended = { why: e.why, at: e.at, task: e.task };
  if (Array.isArray(parsed.queue)) run.queue = parsed.queue.filter((id) => typeof id === 'string');
  if (isObject(parsed.claims)) for (const [id, v] of Object.entries(parsed.claims)) { const c = claimOf(v); if (isChangeId(id) && c) run.claims[id] = c; }
  if (isObject(parsed.holds)) {
    for (const [id, v] of Object.entries(parsed.holds)) {
      if (isChangeId(id) && isObject(v) && HOLD_KINDS.includes(v.kind)) run.holds[id] = { kind: v.kind, at: stringOrNull(v.at), recheckAt: stringOrNull(v.recheckAt), params: isObject(v.params) ? v.params : {} };
    }
  }
  if (isObject(parsed.ownerWaits)) {
    for (const [id, v] of Object.entries(parsed.ownerWaits)) if ((isChangeId(id) || id === '@train' || id === '@run') && isObject(v) && typeof v.gate === 'string') run.ownerWaits[id] = v;
  }
  if (isObject(parsed.train)) {
    const h = parsed.train.hold;
    const hold = isObject(h) && (h.kind === 'github' || h.kind === 'owner') ? { kind: h.kind, at: stringOrNull(h.at), recheckAt: stringOrNull(h.recheckAt) } : null;
    run.train = { claim: claimOf(parsed.train.claim), hold };
  }
  if (Number.isInteger(parsed.places) && parsed.places >= 1) run.places = parsed.places;
  if (typeof parsed.stopping === 'boolean') run.stopping = parsed.stopping;
  if (Array.isArray(parsed.anyway)) run.anyway = parsed.anyway.filter(isChangeId);
  if (isObject(parsed.occupied)) for (const [id, v] of Object.entries(parsed.occupied)) if (isChangeId(id) && isObject(v)) run.occupied[id] = { at: stringOrNull(v.at) };
  return run;
}

const emptyRunOf = () => runOf({});

// ---------------------------------------------------------------- the common git directory and the facts (D-3)

// `<root>/.git` a folder → that folder; a file `gitdir: <path>` → `<path>/commondir` resolved against `<path>` when it exists, else
// `<path>`; anything unreadable → null.
export function commonDirOf(root) {
  const dotGit = join(root, '.git');
  try {
    if (statSync(dotGit).isDirectory()) return dotGit;
    const pointer = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\s*$/m)?.[1];
    if (!pointer) return null;
    const gitdir = resolve(root, pointer);
    try { return resolve(gitdir, readFileSync(join(gitdir, 'commondir'), 'utf8').trim()); } catch { return statSync(gitdir).isDirectory() ? gitdir : null; }
  } catch { return null; }
}

export function localRunFilePath(root) {
  const common = commonDirOf(root);
  return common === null ? null : join(common, 'devkit', 'roadmap-run.json');
}

function foldersIn(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}

// The checkouts of the clone: the main checkout and each linked worktree whose folder still exists (the same list as
// `git worktree list --porcelain` minus the prunable and the bare ones), read from the common directory.
function checkoutsOf(root, common) {
  const main = basename(common) === '.git' ? dirname(common) : root;
  const found = [main];
  for (const name of foldersIn(join(common, 'worktrees'))) {
    try {
      const folder = dirname(readFileSync(join(common, 'worktrees', name, 'gitdir'), 'utf8').trim());
      if (existsSync(folder) && !found.includes(folder)) found.push(folder);
    } catch { /* a worktree record with no gitdir file is no checkout */ }
  }
  return { main, checkouts: found };
}

// An escalated item (D-23) is answered when its request's answer file exists and `requirements.md` holds a `## Reopened` item naming it.
function escalationAnswered(folders, request) {
  if (typeof request !== 'string' || !/^[\w.-]+$/.test(request)) return false;
  const answer = `requests/${request}.answer.md`;
  return folders.some((folder) => {
    if (!existsSync(join(folder, answer))) return false;
    let section = false;
    let text;
    try { text = readFileSync(join(folder, 'requirements.md'), 'utf8'); } catch { return false; }
    for (const line of text.split(/\r?\n/)) {
      if (/^#{1,6}\s/.test(line)) section = /^##\s+Reopened\s*$/.test(line);
      else if (section && /^\s*-\s/.test(line) && line.includes(answer)) return true;
    }
    return false;
  });
}

// What D-3's rules need from the files, with `node:fs` only and no process: `{ archived, open, load, limit, heldPlaces,
// escalationsAnswered }`. `escalationsAnswered` holds the ids of the escalated holds of `run` that are answered (D-23).
export function localFacts(root, run, env = process.env) {
  const common = commonDirOf(root);
  const { main, checkouts } = common === null ? { main: root, checkouts: [root] } : checkoutsOf(root, common);
  const archived = new Set();
  for (const name of foldersIn(join(main, 'openspec', 'changes', 'archive'))) {
    const id = name.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)?.[1];
    if (id && isChangeId(id)) archived.add(id);
  }
  const open = new Set();
  const folderOf = new Map();
  for (const checkout of checkouts) {
    for (const id of foldersIn(join(checkout, 'openspec', 'changes'))) {
      if (id === 'archive' || !isChangeId(id)) continue;
      open.add(id);
      folderOf.set(id, [...(folderOf.get(id) ?? []), join(checkout, 'openspec', 'changes', id)]);
    }
  }
  const cores = cpus().length;
  const load = cores > 0 ? (loadavg()[0] / cores) * 100 : 0;
  const heldPlaces = Object.keys(run.occupied ?? {}).filter((id) => open.has(id)).length;
  const escalationsAnswered = new Set();
  for (const [id, hold] of Object.entries(run.holds ?? {})) {
    if (hold.kind === 'escalated' && escalationAnswered(folderOf.get(id) ?? [], hold.params?.request)) escalationsAnswered.add(id);
  }
  return { archived, open, load, limit: limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT), heldPlaces, escalationsAnswered };
}

// ---------------------------------------------------------------- what is ready (D-3)

const timeOf = (now) => (now instanceof Date ? now.getTime() : Number(now));

function liveClaim(claim, now) {
  if (!claim) return false;
  const beat = Date.parse(claim.heartbeat ?? '');
  return Number.isFinite(beat) && now - beat < claimStaleMs();
}

// The check a hold's `recheckAt` makes: due at or before now, and a time that does not parse is due (the tick decides).
function due(recheckAt, now) {
  const at = Date.parse(recheckAt ?? '');
  return !Number.isFinite(at) || at <= now;
}

function holdReady(id, hold, run, facts, now) {
  switch (hold.kind) {
    case 'delegated': return true;
    case 'github': case 'after': case 'elsewhere': return due(hold.recheckAt, now);
    case 'place': return facts.heldPlaces < run.places;
    case 'load': return facts.load < facts.limit || run.anyway.includes(id);
    case 'owner': return !(id in run.ownerWaits);
    case 'escalated': return facts.escalationsAnswered?.has(id) === true;
    default: return false; // blocked, boarded, archived, skipped
  }
}

function trainReady(run, now) {
  if (!Object.values(run.holds).some((h) => h.kind === 'boarded')) return false;
  const train = run.train ?? { claim: null, hold: null };
  if (liveClaim(train.claim, now)) return false;
  const hold = train.hold;
  if (hold === null) return true;
  if (hold.kind === 'github') return due(hold.recheckAt, now);
  return hold.kind === 'owner' && !('@train' in run.ownerWaits);
}

// The one rule the hook and the `tick` verb share: `{ ready: <id> | '@train' | null, why }`, `why` one of `no-task`, `stopping-busy`,
// `stopping`, `done`, `helpers-full`, `ready`, `train`, `nothing-ready`.
export function tickReady(run, facts, now = Date.now()) {
  const at = timeOf(now);
  if (!run.task) return { ready: null, why: 'no-task' };
  const live = Object.values(run.claims).filter((c) => liveClaim(c, at));
  const trainBusy = liveClaim(run.train?.claim, at);
  if (run.stopping) return { ready: null, why: live.length || trainBusy ? 'stopping-busy' : 'stopping' };
  const queue = run.queue.filter(isChangeId);
  const over = (id) => facts.archived.has(id) || run.holds[id]?.kind === 'archived' || run.holds[id]?.kind === 'skipped';
  if (queue.every(over)) return { ready: null, why: 'done' };
  if (live.length >= run.places) return { ready: null, why: 'helpers-full' };
  if (trainReady(run, at)) return { ready: '@train', why: 'train' };
  for (const id of queue) {
    if (facts.archived.has(id) || liveClaim(run.claims[id], at)) continue;
    const hold = run.holds[id];
    if (!hold || holdReady(id, hold, run, facts, at)) return { ready: id, why: 'ready' };
  }
  return { ready: null, why: 'nothing-ready' };
}

// ---------------------------------------------------------------- the hook (D-4)

const STDIN_MAX = 64 * 1024;
const PROBE = /[{,]\s*"prompt"\s*:\s*"[\s\S]*devkit-roadmap-tick/;

function readStdin() {
  try { return readFileSync(0, 'utf8').slice(0, STDIN_MAX); } catch { return ''; }
}

// D-5's task id of a root.
function taskIdOf(root) {
  const slug = basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24);
  return `devkit-roadmap-tick-${slug}-${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
}

// The root a tick's prompt names, or null: the envelope (the scheduler's `<scheduled-task name="devkit-roadmap-tick-…">` tag, then
// at the start of a line `devkit-roadmap-tick: <root>`, the root's task id being the tag's name) or the bare stored prompt (its first
// line is exactly `devkit-roadmap-tick: <root>`).
export function rootOfPrompt(prompt) {
  if (typeof prompt !== 'string') return null;
  const tag = prompt.match(/<scheduled-task name="(devkit-roadmap-tick-[^"]*)"/);
  if (tag) {
    const line = prompt.slice(tag.index + tag[0].length).match(/^devkit-roadmap-tick: (.+?)\s*$/m);
    return line && taskIdOf(line[1]) === tag[1] ? line[1] : null;
  }
  const first = prompt.match(/^devkit-roadmap-tick: (.+?)\s*(?:\n|$)/);
  return first && first.index === 0 ? first[1] : null;
}

const shellQuote = (text) => `'${text.replace(/'/g, `'\\''`)}'`;

// The tick's note (prompt form S-B): the call of the tick and where its drive is written. A setting left unset is left out.
function noteOf(session, env) {
  const pack = env.CLAUDE_PLUGIN_ROOT ?? '';
  const flags = [['--lang', env.CLAUDE_PLUGIN_OPTION_LANGUAGE, (v) => v], ['--load-limit', env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT, (v) => v], ['--machines', env.CLAUDE_PLUGIN_OPTION_MACHINES, shellQuote]]
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '').map(([flag, value, fmt]) => ` ${flag} ${fmt(value)}`).join('');
  return `devkit tick note: session ${session}. Run: node "${pack}/hooks/roadmap-loop.mjs" tick --session ${session}${flags}. Then read the part "A tick" of ${pack}/skills/devkit/SKILL.md and carry out the tick's output as it says; never ask anything.`;
}

function logDecision(env, session, decision, why) {
  if (!env.DEVKIT_HOOK_LOG) return;
  try { appendFileSync(env.DEVKIT_HOOK_LOG, `${JSON.stringify({ at: new Date().toISOString(), mode: 'prompt', session, change: null, decision, why })}\n`); } catch { /* a log that cannot be written never blocks anything */ }
}

const sameFolder = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return resolve(a) === resolve(b); } };

// The hook's decision for a payload text: the JSON to print, or null for nothing.
export async function gate(raw, env = process.env) {
  if (!PROBE.test(raw)) return null;
  let payload;
  try { payload = JSON.parse(raw); } catch { return null; }
  if (!isObject(payload)) return null;
  const root = rootOfPrompt(payload.prompt);
  if (root === null) return null;
  const { findRoot, optedIn } = await import('./guard.mjs');
  const found = findRoot(typeof payload.cwd === 'string' ? payload.cwd : process.cwd());
  if (found === null || !sameFolder(found, root) || !optedIn(root)) return null;
  const file = localRunFilePath(root);
  if (file === null) return null;
  let run;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!isObject(parsed)) return null;
    run = runOf(parsed);
  } catch (e) {
    if (e?.code !== 'ENOENT') return null;
    run = emptyRunOf();
  }
  const session = typeof payload.session_id === 'string' ? payload.session_id : null;
  const verdict = tickReady(run, localFacts(root, run, env), Date.now());
  const passes = verdict.ready !== null || verdict.why === 'done' || verdict.why === 'stopping';
  logDecision(env, session, passes ? 'allow' : 'block', verdict.why);
  if (passes) return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: noteOf(session ?? '', env) } };
  const reason = run.ended ? 'devkit roadmap: the run is over; delete its scheduled task in the app' : `devkit roadmap: nothing is ready (${verdict.why})`;
  return { decision: 'block', reason };
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const out = await gate(readStdin());
  if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
}
