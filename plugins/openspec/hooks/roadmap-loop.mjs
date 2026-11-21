// roadmap-loop: the decision core and the commands of `/devkit roadmap` and `/devkit status` (design roadmap-coordinator D-3 to D-12).
//
// The pure part: the load limit and its reading, the word of the command, which line of the roadmap is in which class (D-4),
// what a run does next (D-7), the board `/devkit status` prints (D-8) and the draft roadmap (D-9). The facts come in, the
// decision goes out. The rest reads files, the repository and (through gh) GitHub, and writes one bookkeeping file outside
// every working tree, in the repository's common directory (D-5). It calls no AI; its imports are Node built-ins and the
// pack's hook modules.
//
// Subcommands: `run` (the word after `roadmap` on standard input), `next [--after <id>=<key>]...`, `status`, `draft`,
// `reply <key>`, `wait --change <id> [--interval <s>]` and `hold [--interval <s>]`; each takes `--lang <l>` and
// `--load-limit <p>`, and `run` also `--session <id> [--fresh]`. `run` and `next` print `devkit-roadmap: <places>` (or `stop`)
// and then the decision as JSON; exit 0, or 3 with `{ version, error, reply }`. `status` writes nothing.
//
// The facts of one decision (`decideRoadmap`, `boardOf`):
//   lang, places, stopping, holding, load, limit, hasRoadmap,
//   lines      - `classifyLines` of the roadmap, in file order,
//   actions    - { <id>: the action `change-loop.nextAction` returned } for each open change,
//   inflight   - { <id>: { kind: 'agent' | 'wait', stage, agentType, at } } the stages and waits under way,
//   declared   - { <id>: { state: 'blocked' | 'waiting-for-owner', why, params } } the ends the session declared,
//   announced  - { <id>: <event key> }, starting - [ids], held, asking - the run's bookkeeping,
//   after      - { <id>: <progress key> } the stages that just came back (their `actions` were read with that key),
//   wheres     - { <id>: where it stopped } and phaseTotals - { <id>: phases of tasks.md } for the lines that name them,
//   unfinished - [{ id, where }] every unfinished change, for the board's "outside the roadmap".

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadavg as osLoadavg, cpus as osCpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findRoot, readRoadmap, changeSchemaAt, roadmapRunOf } from './guard.mjs';
import { readFlow, collectFlow, computeFlow, makeOpenspec } from './flow-check.mjs';
import { locateChange, readPhases } from './deliver-check.mjs';
import {
  render, LoopUsageError, LoopRefusal, normalizeLang, nextAction, unfinished, archivedOnDefault, whereOf, waitLoop, readDevkitSettings,
  HOOKS_DIR, locate, cleanOf, allow, refuseOnce, subagentStopFor, handOffFor, readStdin,
} from './change-loop.mjs';

// ---------------------------------------------------------------- the setting, the load and the word (D-6, D-3)

const DEFAULT_LIMIT = 80;

// The limit of the load, in percent: a whole number from 1 to 1000; anything else (a `%`, a zero, a placeholder that was
// never substituted) is 80.
export function limitOf(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return DEFAULT_LIMIT;
  const n = Number(text);
  return n >= 1 && n <= 1000 ? n : DEFAULT_LIMIT;
}

// The processor load of the last minute per logical core, as a whole percentage. A system that reports no load
// (Windows gives 0) is never loaded; so is one that reports no core.
export function readLoad({ loadavg = osLoadavg, cpus = osCpus } = {}) {
  const cores = cpus().length;
  if (!cores) return 0;
  return Math.round((loadavg()[0] / cores) * 100);
}

// The word after `roadmap`: nothing is 1 place, a whole number from 1 to 99 is that number, `stop` any case is the stop;
// anything else (a word, 0, a sign, a decimal, a hundred) is invalid and names itself.
export function parseWord(text) {
  const word = String(text ?? '').trim();
  if (word === '') return { kind: 'places', places: 1 };
  if (word.toLowerCase() === 'stop') return { kind: 'stop' };
  if (/^[1-9]\d?$/.test(word)) return { kind: 'places', places: Number(word) };
  return { kind: 'invalid', word };
}

// ---------------------------------------------------------------- gates and the previous script (D-12, D-4)

// The gate code of each end that waits for the owner: every `waiting-` key of the message table but `waiting-github`.
const GATE_OF_WHY = {
  'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge',
  'waiting-archive-merge': 'merge', 'waiting-pr-decision': 'decision', 'waiting-review-dispute': 'dispute',
  'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand',
};

// The gate the owner is asked for by an action: the grill, or an end waiting for the owner. Any other action, or a wait
// the table does not know, is a LoopUsageError, so a new owner wait added later fails a test instead of printing a wrong phrase.
export function gateOf(action) {
  if (action?.kind === 'grill') return 'grill';
  const why = action?.kind === 'end' && action.end?.state === 'waiting-for-owner' ? action.end.why : undefined;
  const code = why === undefined ? undefined : GATE_OF_WHY[why];
  if (!code) throw new LoopUsageError(`no gate for the action ${action?.kind ?? 'none'} ${action?.end?.why ?? ''}`.trim());
  return code;
}

// True when the action says the change began under the previous script (the end blocked, why previous-script).
export const isPrevious = (action) => action?.kind === 'end' && action.end?.state === 'blocked' && action.end?.why === 'previous-script';

// ---------------------------------------------------------------- the lines of the roadmap (D-4)

// Each line of the roadmap in its class, in file order (an id counts at its first line). `rounds` is guard.mjs#parseRoadmap's
// result; `archived` the ids archived on the default branch; `open` the ids that are open in some checkout; `previous` the open
// ones on the previous script; `declared` the ends the session declared. First match wins:
//   archived, archived-unticked, ticked, previous, open, blocked, ready, waiting (with `waitsFor`, the first dependency not archived).
export function classifyLines(rounds, { archived, open, previous, declared }) {
  const seen = new Set();
  const out = [];
  for (const round of rounds ?? []) {
    for (const item of round.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const line = { id: item.id, round: round.title, done: item.done, after: item.after, text: item.text, notes: item.notes, cls: 'ready', waitsFor: null };
      if (archived.has(item.id)) line.cls = item.done ? 'archived' : 'archived-unticked';
      else if (item.done) line.cls = 'ticked';
      else if (open.has(item.id)) line.cls = previous.has(item.id) ? 'previous' : 'open';
      else if (declared?.[item.id]) line.cls = 'blocked';
      else {
        const missing = item.after.find((d) => !archived.has(d));
        if (missing !== undefined) { line.cls = 'waiting'; line.waitsFor = missing; }
      }
      out.push(line);
    }
  }
  return out;
}

// ---------------------------------------------------------------- what each open change is doing (D-7 N1 to N8)

const ARCHIVED_CLASSES = ['archived', 'archived-unticked'];

// One entry per line that fills a place (class open or blocked): { id, state, ... } with the state `running` (N1), `agent`,
// `session`, `wait` (N3 to N5), `owner` (N6, with `gate`), `blocked` (N2 and N7, with `why` and `params`) or `archived` (N8).
function entriesOf(f) {
  const inflight = { ...(f.inflight ?? {}) };
  for (const id of Object.keys(f.after ?? {})) delete inflight[id];
  const entries = [];
  for (const line of f.lines) {
    const id = line.id;
    if (line.cls === 'blocked') {
      const d = f.declared[id];
      entries.push({ id, state: 'blocked', why: d.why, params: { ...d.params, id, why: d.why }, declared: true, line });
      continue;
    }
    if (line.cls !== 'open') continue;
    const action = f.actions?.[id] ?? null;
    const d = f.declared?.[id];
    if (inflight[id]) { entries.push({ id, state: 'running', inflight: inflight[id], action, line }); continue; }
    if (d) {
      if (d.state === 'waiting-for-owner') {
        const gate = d.params?.gate ?? GATE_OF_WHY[d.why];
        if (!gate) throw new LoopUsageError(`the declared wait of ${id} names no gate`);
        entries.push({ id, state: 'owner', gate, declared: true, action, line });
      } else entries.push({ id, state: 'blocked', why: d.why, params: { ...d.params, id, why: d.why }, declared: true, action, line });
      continue;
    }
    if (!action) throw new LoopUsageError(`the open change ${id} has no action and nothing in flight`);
    if (action.kind === 'agent') entries.push({ id, state: 'agent', action, line });
    else if (action.kind === 'session') entries.push({ id, state: 'session', action, line });
    else if (action.kind === 'grill') entries.push({ id, state: 'owner', gate: 'grill', action, line });
    else if (action.kind === 'end' && action.end.state === 'waiting-on-github') entries.push({ id, state: 'wait', action, line });
    else if (action.kind === 'end' && action.end.state === 'waiting-for-owner') entries.push({ id, state: 'owner', gate: gateOf(action), action, line });
    else if (action.kind === 'end' && action.end.state === 'blocked') {
      entries.push({ id, state: 'blocked', why: action.end.why, params: { ...action.params, id, why: action.end.why }, action, line });
    } else if (action.kind === 'end' && action.end.state === 'archived') entries.push({ id, state: 'archived', action, line });
    else throw new LoopUsageError(`the action of ${id} is not one a run knows: ${action.kind}`);
  }
  return { entries, inflight };
}

const waitKey = (action) => `${action.stage ?? 'delivery'}/${action.end.why}`;
const requestOf = (line) => [line.text, line.notes].filter(Boolean).join('\n') || line.id;

// What the run does next. Pure: the caller writes `state` (the run file's fields) and carries the actions out.
// Returns { version, places, open, stopping, lines, actions, ask, end, state, entries }.
export function decideRoadmap(f) {
  const lang = normalizeLang(f.lang);
  const say = (key, params) => render(lang, key, params);
  const { entries, inflight } = entriesOf(f);
  const stopping = Boolean(f.stopping);
  const places = f.places;
  const placed = entries.filter((e) => e.state !== 'archived');
  const open = placed.map((e) => e.id);
  const free = places - open.length;
  const lineOf = (id) => f.lines.find((l) => l.id === id);

  // The actions of the changes that are open, then the starts or the hold.
  const actions = [];
  if (!stopping) {
    for (const e of entries) {
      if (e.state === 'agent' || e.state === 'session') actions.push({ ...e.action, change: e.id });
      else if (e.state === 'wait') actions.push({ ...e.action, change: e.id, kind: 'wait', progressKey: waitKey(e.action) });
    }
  }
  const ready = f.lines.filter((l) => l.cls === 'ready');
  const loaded = f.load >= f.limit;
  const startable = !stopping && free > 0 && ready.length > 0;
  const holdNow = startable && loaded;
  const starts = startable && !loaded ? ready.slice(0, free) : [];
  for (const l of starts) actions.push({ change: l.id, kind: 'start', request: requestOf(l), progressKey: 'start' });
  if (holdNow && !f.holding) actions.push({ change: ready[0].id, kind: 'hold', load: f.load, limit: f.limit, progressKey: 'hold' });

  // The starts handed and not yet open stay in `starting`; a change that is open now was started.
  const opened = new Set(entries.filter((e) => e.line.cls === 'open').map((e) => e.id));
  const startedNow = (f.starting ?? []).filter((id) => opened.has(id));
  const starting = [...new Set([...(f.starting ?? []).filter((id) => lineOf(id)?.cls === 'ready'), ...starts.map((l) => l.id)])];

  // The owner's queue: the entries waiting at a gate in roadmap order; the head is the one being asked while it stays there.
  const queue = entries.filter((e) => e.state === 'owner' && !e.declared);
  const head = queue.find((e) => e.id === f.asking) ?? queue[0] ?? null;
  const ask = head && !stopping ? { change: head.id, kind: head.gate === 'grill' ? 'grill' : 'gate', action: head.action } : null;

  // The events, one line each, in the order of the table; each only when the change's announced state differs.
  const announced = { ...(f.announced ?? {}) };
  const lines = [];
  const emit = (id, key, message, params) => {
    if (announced[id] === key) return;
    announced[id] = key;
    lines.push(`▸ ${say(message, params)}`);
  };
  // A started or resumed line counts the open changes up to its own change, in the order the lines print: the changes already
  // open and announced count first.
  const begun = entries.filter((e) => startedNow.includes(e.id) && e.line.cls === 'open' && announced[e.id] !== 'started');
  const resumes = entries.filter((e) => e.line.cls === 'open' && e.state !== 'archived' && announced[e.id] === undefined && !begun.includes(e));
  let counted = open.length - begun.length - resumes.length;
  for (const e of begun) emit(e.id, 'started', 'roadmap-started', { id: e.id, open: ++counted, places });
  for (const e of resumes) emit(e.id, 'resumed', 'roadmap-resumed', { id: e.id, where: f.wheres?.[e.id] ?? '', open: ++counted, places });
  for (const e of entries) if (e.state === 'owner') emit(e.id, `gate:${e.gate}`, 'roadmap-gate', { id: e.id, gate: e.gate });
  for (const e of entries) if (e.state === 'blocked') emit(e.id, `blocked:${e.why}`, 'roadmap-blocked', e.params);
  for (const l of f.lines) {
    const archivedEntry = entries.some((e) => e.id === l.id && e.state === 'archived');
    if (archivedEntry || (ARCHIVED_CLASSES.includes(l.cls) && announced[l.id] !== undefined)) emit(l.id, 'archived', 'roadmap-archived', { id: l.id });
  }
  for (const l of f.lines) if (l.cls === 'previous') emit(l.id, 'skipped', 'roadmap-skipped', { id: l.id });
  if (holdNow && !f.held) lines.push(`▸ ${say('roadmap-held', { id: ready[0].id, load: f.load, limit: f.limit })}`);

  // The end of the run (D-7 E1 to E3): nothing in flight (while stopping a wait does not count), no action, no hold watched.
  const flying = Object.values(inflight).filter((e) => !(stopping && e.kind === 'wait')).length;
  const idle = flying === 0 && actions.length === 0 && !f.holding && !entries.some((e) => e.state === 'archived');
  let end = null;
  if (idle && stopping) {
    end = { why: 'stopped', reply: [say('roadmap-ended-stopped'), ...placed.map((e) => say('roadmap-stayed', { id: e.id, where: f.wheres?.[e.id] ?? '' }))].join('\n') };
  } else if (idle && f.lines.every((l) => ARCHIVED_CLASSES.includes(l.cls))) {
    end = { why: 'done', reply: say('roadmap-ended-done') };
  } else if (idle) {
    const filling = new Set(open);
    const needs = [];
    for (const l of f.lines) {
      const e = placed.find((x) => x.id === l.id);
      if (e?.state === 'owner') needs.push(say('need.owner', { id: e.id, gate: e.gate }));
      else if (e?.state === 'blocked') needs.push(say('need.blocked', e.params));
      else if (!e && l.cls === 'waiting' && !filling.has(l.waitsFor)) needs.push(say('need.after', { id: l.id, after: l.waitsFor }));
    }
    end = { why: 'stuck', reply: say('roadmap-ended-stuck', { list: needs.join('; ') }) };
  }

  return {
    version: 1, places, open, stopping, lines, actions, ask, end,
    state: { asking: head?.id ?? null, announced, starting, held: holdNow, clearInflight: Object.keys(f.after ?? {}).filter((id) => f.inflight?.[id]) },
    entries: entries.map(({ line, ...entry }) => entry),
  };
}

// ---------------------------------------------------------------- the board (D-8)

// The text of `/devkit status`: the count line, the load line while a start is held, then the blocks that have a row,
// ids padded to the longest id of the board plus three spaces. Without a roadmap: the unfinished changes, or nothing.
export function boardOf(f) {
  const lang = normalizeLang(f.lang);
  const say = (key, params) => render(lang, key, params);
  const unfinished = f.unfinished ?? [];
  const table = (rows, intro) => {
    const width = Math.max(0, ...rows.map((r) => r.id.length)) + 3;
    return [...intro, ...rows.map((r) => `  ${r.id.padEnd(width)}${r.text}`)].join('\n');
  };
  if (f.hasRoadmap === false) {
    if (unfinished.length === 0) return say('status-nothing');
    return table(unfinished.map((u) => ({ id: u.id, text: u.where })), [say('status-no-roadmap')]);
  }
  const { entries } = entriesOf(f);
  const placed = entries.filter((e) => e.state !== 'archived');
  const free = f.places - placed.length;
  const ready = f.lines.filter((l) => l.cls === 'ready');
  const held = free > 0 && ready.length > 0 && f.load >= f.limit;
  const heldIds = new Set(held ? ready.slice(0, free).map((l) => l.id) : []);
  const entryOf = (id) => placed.find((e) => e.id === id);
  const rows = { owner: [], running: [], blocked: [], queue: [], outside: [] };
  for (const l of f.lines) {
    const e = entryOf(l.id);
    if (e?.state === 'owner') rows.owner.push({ id: l.id, text: say(`gate.${e.gate}`) });
    else if (e?.state === 'blocked') rows.blocked.push({ id: l.id, text: say(`blocked-why.${e.why}`, e.params) });
    else if (e) rows.running.push({ id: l.id, text: runningText(e, f, say) });
    else if (l.cls === 'ready') rows.queue.push({ id: l.id, text: say(heldIds.has(l.id) ? 'queue.load' : 'queue.place') });
    else if (l.cls === 'waiting') rows.queue.push({ id: l.id, text: say('queue.after', { after: l.waitsFor }) });
    else if (l.cls === 'archived-unticked') rows.outside.push({ id: l.id, text: say('outside.unticked') });
    else if (l.cls === 'ticked') rows.outside.push({ id: l.id, text: say('outside.ticked') });
    else if (l.cls === 'previous') rows.outside.push({ id: l.id, text: say('outside.previous') });
  }
  const onRoadmap = new Set(f.lines.map((l) => l.id));
  for (const u of unfinished) if (!onRoadmap.has(u.id)) rows.outside.push({ id: u.id, text: say('outside.other', { where: u.where }) });

  const count = say('status-count', {
    open: placed.length, places: f.places, queue: f.lines.filter((l) => l.cls === 'ready' || l.cls === 'waiting').length,
    archived: f.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls)).length,
  });
  const intro = [count, ...(held ? [say('status-held', { load: f.load, limit: f.limit })] : [])];
  const blocks = [['status-owner', rows.owner], ['status-running', rows.running], ['status-blocked', rows.blocked], ['status-queue', rows.queue], ['status-outside', rows.outside]]
    .filter(([, list]) => list.length > 0);
  const width = Math.max(0, ...blocks.flatMap(([, list]) => list.map((r) => r.id.length))) + 3;
  const out = [...intro];
  if (blocks.length) out.push('');
  for (const [key, list] of blocks) out.push(say(key), ...list.map((r) => `  ${r.id.padEnd(width)}${r.text}`));
  return out.join('\n');
}

// A row of "under way": the stage's title, with its phase when the action names one and tasks.md's phases are known, or the wait on GitHub.
function runningText(e, f, say) {
  const action = e.action;
  if (e.state === 'wait' || (e.state === 'running' && (e.inflight.kind === 'wait' || action?.end?.state === 'waiting-on-github'))) {
    return say('running.github', { what: action?.params?.what ?? e.inflight?.what ?? 'merge' });
  }
  const title = action?.stageTitle ?? e.inflight?.stage ?? '';
  const phase = action?.detail?.phase;
  const total = f.phaseTotals?.[e.id];
  if (typeof phase === 'number' && total) return say('running.phase', { title, phase, phases: total });
  return say('running.stage', { title });
}

// ---------------------------------------------------------------- the draft (D-9)

// The draft roadmap: one round with an unticked line per change, no `after:`. The round's title is in the files' language.
export function draftText(lang, ids) {
  const title = lang === 'pt-BR' ? 'Rodada 1: changes por terminar' : 'Round 1: unfinished changes';
  const lines = ids.length ? `\n${ids.map((id) => `- [ ] ${id}`).join('\n')}\n` : '';
  return `# Roadmap\n\n## ${title}\n${lines}`;
}

// ---------------------------------------------------------------- the run file (D-5)

// Waits between tries without a busy loop, as deliver-check.mjs does, so the writers of the file stay synchronous.
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LOCK = { stepMs: 100, waitMs: 10_000, staleMs: 60_000 };

// One run's bookkeeping and nothing the files, the repository or GitHub can say.
const emptyRun = () => ({
  version: 1, session: null, places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [],
  held: false, holding: false, updatedAt: null,
});

// `<common git directory>/devkit/roadmap-run.json`: every checkout of the clone and every session see the same file, and no commit holds it.
export function runFilePath(cwd) {
  let common;
  try {
    common = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { throw new LoopUsageError(`${cwd} is not inside a git repository`); }
  return join(common, 'devkit', 'roadmap-run.json');
}

// The file as it is; a missing or broken one is an empty run with one place, and a field of the wrong type is dropped.
export function readRun(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return emptyRun(); }
  if (!isObject(parsed)) return emptyRun();
  const run = emptyRun();
  if (Number.isInteger(parsed.places) && parsed.places >= 1) run.places = parsed.places;
  if (typeof parsed.session === 'string') run.session = parsed.session;
  if (typeof parsed.asking === 'string') run.asking = parsed.asking;
  if (typeof parsed.updatedAt === 'string') run.updatedAt = parsed.updatedAt;
  for (const key of ['stopping', 'held', 'holding']) if (typeof parsed[key] === 'boolean') run[key] = parsed[key];
  for (const key of ['inflight', 'declared', 'announced']) if (isObject(parsed[key])) run[key] = parsed[key];
  if (Array.isArray(parsed.starting)) run.starting = parsed.starting.filter((id) => typeof id === 'string');
  return run;
}

// Read, change and write the file under its lock (created with `wx`, retried, taken over when old), through a temporary file and a rename.
// `change` receives the run and may return a new one; the run written is returned.
export function updateRun(file, change, { sleep = sleepSync } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  const lock = join(dirname(file), 'roadmap-run.lock');
  for (let waited = 0; ;) {
    try { closeSync(openSync(lock, 'wx')); break; } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - statSync(lock).mtimeMs; } catch { continue; } // released between the two calls
      if (age > LOCK.staleMs) { try { unlinkSync(lock); } catch { /* another call took it over first */ } continue; }
      if (waited >= LOCK.waitMs) throw new LoopUsageError('the run file is locked by another call');
      sleep(LOCK.stepMs);
      waited += LOCK.stepMs;
    }
  }
  try {
    const run = readRun(file);
    const next = change(run) ?? run;
    next.updatedAt = new Date().toISOString();
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temporary, file);
    return next;
  } finally { try { unlinkSync(lock); } catch { /* already gone */ } }
}

// ---------------------------------------------------------------- the facts of a run (D-4, D-7)

// The title of `stage` in the language of the person, from the change's own script; the id when it cannot be read.
function stageTitleOf(found, stage, lang) {
  try {
    const dir = locateChange(found.root, found.id)?.dir ?? join(found.root, 'openspec', 'changes', found.id);
    return readFlow(found.root, changeSchemaAt(found.root, dir))?.stages.find((s) => s.id === stage)?.title[lang] ?? stage;
  } catch { return stage; }
}

// Every fact `decideRoadmap` and `boardOf` need, read from the roadmap, the checkouts, the run file and the load. `after` is
// { <id>: <progress key> }; `wheres` is `new` (the open changes never announced), `open` (every open change) or `board` (the
// unfinished changes that are not on the roadmap); `readFlying` also reads the action of a change in flight (the board shows it).
export function collectRoadmap(cwd, { env = process.env, lang = 'pt-BR', load = 0, limit = DEFAULT_LIMIT, openspec, gh, after = {}, wheres = 'new', readFlying = false } = {}) {
  const l = normalizeLang(lang);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const run = readRun(runFilePath(start));
  const rounds = readRoadmap(start);
  const list = unfinished(start, { env, gh });
  const whereFor = (u) => {
    const flying = run.inflight[u.id];
    if (flying?.kind === 'agent') return render(l, 'where.finishing', { stage: stageTitleOf(u, flying.stage, l) });
    try { return whereOf(u, u.id, { lang: l, env, openspec, gh }); } catch (e) { if (e instanceof LoopUsageError) return ''; throw e; }
  };
  const common = { lang: l, places: run.places, stopping: run.stopping, holding: run.holding, load, limit, run };
  if (rounds === null) return { ...common, hasRoadmap: false, lines: [], unfinished: list.map((u) => ({ id: u.id, where: whereFor(u) })) };

  const archived = archivedOnDefault(start, { env, gh });
  const onRoadmap = new Set(rounds.flatMap((r) => r.items.map((i) => i.id)));
  const open = new Set(list.map((u) => u.id));
  const byId = new Map(list.map((u) => [u.id, u]));
  // First every open line, to read each one's action (a change in flight or declared is not read: N1 and N2 come first), then
  // the classes again with the changes on the previous script known.
  const actions = {};
  const previous = new Set();
  for (const line of classifyLines(rounds, { archived, open, previous, declared: run.declared })) {
    if (line.cls !== 'open' || run.declared[line.id]) continue;
    if (run.inflight[line.id] && !(line.id in after) && !readFlying) continue;
    const action = nextAction(start, line.id, { env, lang: l, after: after[line.id] ?? null, openspec, gh });
    if (isPrevious(action)) previous.add(line.id); else actions[line.id] = action;
  }
  const lines = classifyLines(rounds, { archived, open, previous, declared: run.declared });
  const openLines = new Set(lines.filter((x) => x.cls === 'open').map((x) => x.id));
  const wanted = (u) => wheres !== 'none' && (wheres === 'board' ? !onRoadmap.has(u.id) : openLines.has(u.id) && (wheres === 'open' || run.announced[u.id] === undefined));
  const wheresMap = Object.fromEntries(list.filter(wanted).map((u) => [u.id, whereFor(u)]));
  const phaseTotals = {};
  if (wheres === 'board') {
    for (const id of openLines) {
      try {
        const dir = locateChange(byId.get(id).root, id)?.dir;
        const total = dir ? readPhases(join(dir, 'tasks.md')).length : 0;
        if (total) phaseTotals[id] = total;
      } catch { /* a tasks.md that cannot be read shows no phase */ }
    }
  }
  return {
    ...common, hasRoadmap: true, lines, actions, inflight: run.inflight, declared: run.declared, announced: run.announced, starting: run.starting,
    held: run.held, asking: run.asking, after, wheres: wheresMap, phaseTotals, unfinished: list.map((u) => ({ id: u.id, where: wheresMap[u.id] ?? '' })),
  };
}

// ---------------------------------------------------------------- the locks of a roadmap run (D-11)

// What the guard asks of a roadmap run: `roadmapStopDecision` (the session does not end its turn while work is ready),
// `roadmapAgentDecision` (a hand-off names its change through the loop's brief and goes to a role of that change's script, and is
// recorded in flight) and `roadmapSubagentStopDecision` (a stage agent delivers its file before it stops). Each returns
// { decision, why, change, reason }, takes `run` (the guard's `roadmapRunOf`, read again when absent) and lets everything through on
// any error of its own, an unreadable run file included. The two stop locks refuse once per state (change-loop's record).
const BRIEF_OF = /^Change ([A-Za-z0-9][\w.-]*) \(/;
const STAGE_OF = /^Change \S+ \([^)]*\), stage ([\w-]+):/;
const OFFLINE_GH = () => ({ status: 1, stdout: '', stderr: 'offline' });

// The run file of the repository, which must exist and hold a JSON object: a lock does not guess over a file it cannot read.
function strictRunFile(cwd) {
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const file = runFilePath(start);
  if (!isObject(JSON.parse(readFileSync(file, 'utf8')))) throw new LoopUsageError('the run file does not hold an object');
  return { start, file };
}

// One ready action in words: the stage and who runs it, or what the session must start.
function readyText(action) {
  const c = action.change;
  if (action.kind === 'agent') return `the change ${c} has the stage ${action.stage} ready (${action.agent})`;
  if (action.kind === 'session') return `the change ${c} has the stage ${action.stage ?? action.step} ready (${action.step})`;
  if (action.kind === 'wait') return `the change ${c} waits on GitHub: start its wait`;
  if (action.kind === 'start') return `the change ${c} is ready to start: open it`;
  return `the start of ${c} is held by the load: watch it with hold`;
}

// `guard.mjs stop` (RS1 to RS5).
export function roadmapStopDecision(input, { env = process.env, run, gh, openspec, load = () => readLoad() } = {}) {
  try {
    const current = run ?? roadmapRunOf(input);
    if (!current) return allow('no-run');
    if (current.stopping) return allow('stopping'); // RS1
    const cwd = input.cwd ?? process.cwd();
    const { start, file } = strictRunFile(cwd);
    if (readRun(file).stopping) return allow('stopping');
    const lang = normalizeLang(env.CLAUDE_PLUGIN_OPTION_LANGUAGE);
    const limit = limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT);
    const facts = collectRoadmap(start, { env, lang, load: load(), limit, openspec, gh, wheres: 'none' });
    if (facts.hasRoadmap === false) return allow('no-roadmap');
    const { actions } = decideRoadmap(facts); // read-only: nothing is written
    if (actions.length === 0) return allow('nothing-ready'); // RS2
    const key = `roadmap:${actions.map((a) => `${a.change}:${a.kind}:${a.progressKey}`).sort().join(',')}`;
    const reason = `${readyText(actions[0])}; run it, or end the run as blocked and say why. `
      + `The next actions come from: node ${HOOKS_DIR}/roadmap-loop.mjs next --lang ${lang} --load-limit ${limit}`;
    return refuseOnce(input, key, 'stage-ready', actions[0].change, reason); // RS3, RS4
  } catch { return allow('error'); } // RS5
}

// The ids of the changes open on the roadmap (C5 without the previous script, which `isPreviousScript` tells per change).
function openOnRoadmap(start, env, gh) {
  const rounds = readRoadmap(start);
  if (rounds === null) throw new LoopUsageError('no roadmap');
  const open = new Set(unfinished(start, { env, gh }).map((u) => u.id));
  const archived = archivedOnDefault(start, { env, gh });
  return classifyLines(rounds, { archived, open, previous: new Set(), declared: {} }).filter((l) => l.cls === 'open').map((l) => l.id);
}

const isPreviousScript = (start, id, env) => {
  const found = locate(start, id);
  const clean = cleanOf(env);
  const { facts, flow } = collectFlow(found.root, id, { env: clean, openspec: makeOpenspec(found.root, clean) });
  return computeFlow(facts, flow, {}).script === 'previous';
};

const refusal = (why, change, reason) => ({ decision: 'refuse', why, change, reason });

// `guard.mjs agent` (RH0 to RH5).
export function roadmapAgentDecision(input, { env = process.env, run, gh = OFFLINE_GH } = {}) {
  let change = null;
  try {
    if (input.agent_type) return allow('subagent'); // RH0
    const current = run ?? roadmapRunOf(input);
    if (!current) return allow('no-run');
    const { start, file } = strictRunFile(input.cwd ?? process.cwd());
    const prompt = input.tool_input?.prompt;
    change = typeof prompt === 'string' ? (BRIEF_OF.exec(prompt)?.[1] ?? null) : null;
    if (!change) return refusal('no-brief', null, 'in a /devkit roadmap run every hand-off starts with the brief the loop gave, which names its change'); // RH1
    const open = openOnRoadmap(start, env, gh);
    if (!open.includes(change) || isPreviousScript(start, change, env)) {
      return refusal('not-open', change, `in a /devkit roadmap run a hand-off names a change open on the roadmap: ${change} is not one; the open changes are: ${open.join(', ') || 'none'}`); // RH2
    }
    const decision = handOffFor(input, change, { command: 'roadmap' }); // RH3
    if (decision.decision === 'allow') { // RH4
      const entry = { kind: 'agent', stage: STAGE_OF.exec(prompt)?.[1] ?? null, agentType: input.tool_input.subagent_type, at: new Date().toISOString() };
      updateRun(file, (state) => { state.inflight[change] = entry; return state; });
    }
    return decision;
  } catch { return allow('error', change); } // RH5
}

// The change a stage agent was started for: the `Change <id>` of the first user line of its own transcript, else the one change
// whose entry in flight is an agent of the same type; null when neither says.
function changeOfSubagent(input, file) {
  try {
    const first = readFileSync(input.agent_transcript_path, 'utf8').split('\n', 1)[0];
    const content = JSON.parse(first)?.message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join('\n') : '';
    const id = BRIEF_OF.exec(text)?.[1];
    if (id) return id;
  } catch { /* no readable prompt: the entries in flight answer */ }
  const same = Object.entries(readRun(file).inflight).filter(([, e]) => e?.kind === 'agent' && e.agentType === input.agent_type);
  return same.length === 1 ? same[0][0] : null;
}

// `guard.mjs subagent-stop` (RU1 to RU7).
export function roadmapSubagentStopDecision(input, { env = process.env, run } = {}) {
  let change = null;
  try {
    const current = run ?? roadmapRunOf(input);
    if (!current) return allow('no-run');
    const { file } = strictRunFile(input.cwd ?? process.cwd());
    change = changeOfSubagent(input, file);
    if (!change) return allow('no-change'); // RU1
    const decision = subagentStopFor(input, change, { env }); // RU2 to RU5
    if (decision.decision === 'allow') { // RU6
      updateRun(file, (state) => { if (state.inflight[change]?.agentType === input.agent_type) delete state.inflight[change]; return state; });
    }
    return decision;
  } catch { return allow('error', change); } // RU7
}

// ---------------------------------------------------------------- the command line

const USAGE = 'usage: roadmap-loop.mjs run --lang <l> --load-limit <p> --session <id> [--fresh] (the word on standard input) | next --lang <l> --load-limit <p> [--after <id>=<key>]... '
  + '| status --lang <l> --load-limit <p> | draft --lang <l> | reply <key> --lang <l> [--param name=value]... | wait --change <id> --lang <l> [--interval <seconds>] '
  + '| hold --lang <l> --load-limit <p> [--interval <seconds>]';

function parseOpts(argv, { values = [], multi = [], flags = [] } = {}) {
  const out = { positional: [], value: {}, many: {}, flag: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.includes(a)) out.flag[a] = true;
    else if (values.includes(a) || multi.includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new LoopUsageError(`${a} needs a value; ${USAGE}`);
      if (multi.includes(a)) (out.many[a] ??= []).push(v); else out.value[a] = v;
    } else if (a.startsWith('--')) throw new LoopUsageError(`unknown option ${a}; ${USAGE}`);
    else out.positional.push(a);
  }
  return out;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const plain = (text) => ({ code: 0, stdout: `${text}\n`, stderr: '' });
const MIN_INTERVAL = 5;
const DEFAULT_INTERVAL = 60;
const realSleep = (seconds) => new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });

function intervalOf(value) {
  const interval = value === undefined ? DEFAULT_INTERVAL : Number(value);
  if (!Number.isFinite(interval) || interval < MIN_INTERVAL) throw new LoopUsageError(`--interval needs a number of seconds, at least ${MIN_INTERVAL}`);
  return interval;
}

const rootOf = (cwd) => {
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  return start;
};

// What `run` and `next` print: the run line, then the decision as JSON.
const decisionText = (d) => `devkit-roadmap: ${d.stopping ? 'stop' : d.places}\n`;
const decisionJson = (d) => json({ version: 1, places: d.places, open: d.open, stopping: d.stopping, lines: d.lines, actions: d.actions, ask: d.ask, end: d.end });

// Decide over the current facts and record what the decision says about the run (D-7): the head of the owner's queue, the events
// announced, the starts handed, the hold and the stages that came back.
function decide(start, facts) {
  const decision = decideRoadmap(facts);
  updateRun(runFilePath(start), (run) => {
    run.asking = decision.state.asking;
    run.announced = decision.state.announced;
    run.starting = decision.state.starting;
    run.held = decision.state.held;
    for (const id of decision.state.clearInflight) delete run.inflight[id];
    return run;
  });
  return decision;
}

const settingsOf = (ctx, opts) => ({ lang: normalizeLang(opts.value['--lang']), limit: limitOf(opts.value['--load-limit']), load: ctx.load() });

function hasRoadmapFile(start) { return readRoadmap(start) !== null; }

function runCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--session'], flags: ['--fresh'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const word = parseWord(ctx.stdin);
  if (word.kind === 'invalid') return plain(render(lang, 'roadmap-invalid', { word: word.word })); // U1
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none')); // U2
  const session = opts.value['--session'];
  if (!session) throw new LoopUsageError(`run needs --session; ${USAGE}`);
  const { limit, load } = settingsOf(ctx, opts);
  let placesBefore = null;
  updateRun(runFilePath(start), (run) => {
    if (word.kind === 'stop') { run.stopping = true; return run; } // U3: nothing is reset
    const same = run.session === session && !opts.flag['--fresh'];
    if (same) placesBefore = run.places; // U4
    else Object.assign(run, emptyRun(), { session }); // U5
    run.places = word.places;
    run.stopping = false;
    run.held = false;
    run.declared = {};
    return run;
  });
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: word.kind === 'stop' ? 'open' : 'new' });
  const decision = decide(start, facts);
  const say = (key, params) => render(lang, key, params);
  let preface = '';
  if (word.kind === 'stop') {
    const stayed = decision.entries.filter((e) => e.state !== 'archived').map((e) => say('roadmap-stayed', { id: e.id, where: facts.wheres[e.id] ?? '' }));
    preface = `${[say('roadmap-stopping'), ...stayed].join('\n')}\n`;
  } else if (placesBefore !== null && placesBefore !== word.places) preface = `▸ ${say('roadmap-places', { places: word.places, open: decision.open.length })}\n`;
  return { code: 0, stdout: `${decisionText(decision)}${preface}${decisionJson(decision)}`, stderr: '' };
}

function nextCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'], multi: ['--after'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const after = {};
  for (const pair of opts.many['--after'] ?? []) {
    const eq = pair.indexOf('=');
    if (eq < 1 || eq === pair.length - 1) throw new LoopUsageError(`--after needs <change>=<progress key>, got ${pair}`);
    after[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  const { lang, limit, load } = settingsOf(ctx, opts);
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none'));
  const stopping = readRun(runFilePath(start)).stopping;
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, after, wheres: stopping ? 'open' : 'new' });
  const decision = decide(start, facts);
  return { code: 0, stdout: `${decisionText(decision)}${decisionJson(decision)}`, stderr: '' };
}

function statusCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const { lang, limit, load } = settingsOf(ctx, opts);
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: 'board', readFlying: true });
  return plain(boardOf(facts));
}

// The draft (D-9): written only when `openspec/roadmap.md` is absent, never committed, naming the changes it left out.
function draftCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const file = join(start, 'openspec', 'roadmap.md');
  if (existsSync(file)) throw new LoopUsageError('openspec/roadmap.md exists already: a draft never overwrites it');
  const settings = readDevkitSettings(start);
  const filesLanguage = settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language;
  const current = [];
  const left = [];
  for (const u of unfinished(start, { env: ctx.env, gh: ctx.gh })) {
    (isPrevious(nextAction(start, u.id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh })) ? left : current).push(u.id);
  }
  writeFileSync(file, draftText(filesLanguage, current), { flag: 'wx' });
  const out = [current.length ? render(lang, 'roadmap-drafted', { list: current.join(', ') }) : render(lang, 'roadmap-drafted-empty')];
  if (left.length) out.push(render(lang, 'roadmap-drafted-left', { list: left.join(', ') }));
  return plain(out.join('\n'));
}

// The keys the session renders itself that end a change of the run, and the state each one declares.
const END_OF_KEY = { blocked: 'blocked', 'waiting-pr-decision': 'waiting-for-owner' };

function replyCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'], multi: ['--param'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const params = {};
  for (const p of opts.many['--param'] ?? []) {
    const eq = p.indexOf('=');
    if (eq < 1) throw new LoopUsageError(`--param needs name=value, got ${p}`);
    params[p.slice(0, eq)] = p.slice(eq + 1);
  }
  const key = opts.positional[0];
  const text = render(opts.value['--lang'], key, params);
  const state = END_OF_KEY[key];
  if (!state) return plain(text);
  if (!params.id) throw new LoopUsageError(`${key} needs --param id=<change>`);
  const { id, why, ...rest } = params;
  const declared = state === 'blocked' ? { state, why, params: rest } : { state, why: key, params: { ...rest, gate: 'decision' } };
  updateRun(runFilePath(ctx.cwd), (run) => { run.declared[id] = declared; delete run.inflight[id]; return run; });
  return { code: 0, stdout: `devkit-end: ${id} ${state}\n${text}\n`, stderr: '' };
}

// `wait`: a wait on GitHub with no limit of its own, the change marked in flight while it lasts and cleared when it ends, also on error.
async function waitCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang', '--load-limit', '--interval'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = opts.value['--change'];
  const interval = intervalOf(opts.value['--interval']);
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const file = runFilePath(start);
  updateRun(file, (run) => { run.inflight[id] = { kind: 'wait', stage: 'delivery', agentType: null, at: new Date().toISOString() }; return run; });
  try {
    const poll = async () => nextAction(start, id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh });
    const action = await waitLoop({ poll, sleep: ctx.sleep ?? realSleep, interval, id, lang });
    return { code: 0, stdout: json(action), stderr: '' };
  } finally {
    updateRun(file, (run) => { delete run.inflight[id]; return run; });
  }
}

// `hold`: watches the load while a start is held (D-6): `holding` is set, the load read every interval, and the call ends below the
// limit or when the run was asked to stop; `holding` is cleared at its end, also on error.
async function holdCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--interval'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const interval = intervalOf(opts.value['--interval']);
  const limit = limitOf(opts.value['--load-limit']);
  const file = runFilePath(rootOf(ctx.cwd));
  const sleep = ctx.sleep ?? realSleep;
  updateRun(file, (run) => { run.holding = true; return run; });
  try {
    for (; ;) {
      await sleep(interval);
      const stopping = readRun(file).stopping;
      const load = ctx.load();
      if (stopping || load < limit) return { code: 0, stdout: json({ load, limit }), stderr: '' };
    }
  } finally {
    updateRun(file, (run) => { run.holding = false; return run; });
  }
}

// The usage-error form of every subcommand: exit 3 with `{ version: 1, error, reply }`, nothing run.
function failure(argv, e) {
  const message = e instanceof Error ? e.message : String(e);
  const lang = argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1];
  const reply = e instanceof LoopRefusal ? e.reply : render(lang, 'request-unreadable'); // the raw message stays in `error`, never shown
  return { code: 3, stdout: `${JSON.stringify({ version: 1, error: message, reply })}\n`, stderr: `roadmap-loop: ${message}\n` };
}

const contextOf = ({ env = process.env, cwd = process.cwd(), stdin = '', openspec, gh, load, sleep } = {}) => ({ env, cwd, stdin, openspec, gh, sleep, load: load ?? (() => readLoad()) });

// Runs the command: { code, stdout, stderr }. `wait` and `hold` sleep, so they run through `runCommand`.
export function main(argv, opts = {}) {
  try {
    const [sub, ...rest] = argv;
    const ctx = contextOf(opts);
    if (sub === 'run') return runCmd(rest, ctx);
    if (sub === 'next') return nextCmd(rest, ctx);
    if (sub === 'status') return statusCmd(rest, ctx);
    if (sub === 'draft') return draftCmd(rest, ctx);
    if (sub === 'reply') return replyCmd(rest, ctx);
    throw new LoopUsageError(USAGE);
  } catch (e) {
    return failure(argv, e);
  }
}

// `main`, and `wait` and `hold` too: the one entry point of the command line.
export async function runCommand(argv, opts = {}) {
  const [sub, ...rest] = argv;
  if (sub !== 'wait' && sub !== 'hold') return main(argv, opts);
  try {
    return await (sub === 'wait' ? waitCmd : holdCmd)(rest, contextOf(opts));
  } catch (e) {
    return failure(argv, e);
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const argv = process.argv.slice(2);
  runCommand(argv, { stdin: argv[0] === 'run' ? readStdin() : '' }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
