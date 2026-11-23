// roadmap-loop: the decision core and the commands of `/devkit roadmap` and `/devkit status` (design roadmap-coordinator D-3 to D-12).
//
// The pure part: the load limit and its reading, the word of the command, which line of the roadmap is in which class (D-4),
// what a run does next (D-7), the board `/devkit status` prints (D-8) and the draft roadmap (D-9). The facts come in, the
// decision goes out. The rest reads files, the repository and (through gh) GitHub, and writes one bookkeeping file outside
// every working tree, in the repository's common directory (D-5). It calls no AI; its imports are Node built-ins and the
// pack's hook modules.
//
// Subcommands: `run` (the owner's arguments on standard input), `next [--after <id>=<key>]... [--turn typed|event] [--start-anyway]`, `status`, `draft`,
// `reply <key>`, `wait --change <id> [--interval <s>]` and `hold [--interval <s>]`; each takes `--lang <l>` and
// `--load-limit <p>`, and `run` also `--session <id> [--fresh] [--change-sessions]`. `run` and `next` print `devkit-roadmap: <places>` (or `stop`)
// and then the decision as JSON; exit 0, or 3 with `{ version, error, reply }`. `status` writes nothing.
//
// The facts of one decision (`decideRoadmap`, `boardOf`):
//   lang, places, stopping, holding, load, limit, hasRoadmap,
//   lines      - `classifyLines` of the roadmap, in file order,
//   actions    - { <id>: the action `change-loop.nextAction` returned } for each open change,
//   inflight   - { <id>: { kind: 'agent' | 'wait', stage, agentType, at } } the stages and waits under way,
//   declared   - { <id>: { state: 'blocked' | 'waiting-for-owner', why, params } } the ends the session declared,
//   announced  - { <id>: <event key> }, starting - [ids], held, asking - the run's bookkeeping,
//   after      - { <id>: <progress key> } the stages that just came back (their `actions` were read with that key), and the
//                `session-start` and `session-refused` keys of a change session the host started or refused,
//   changeSessions, startedSessions, coordinator, turn - a run with a session per change (ADR 0014): whether each change runs in a session
//                of its own, { <id>: { at } } the change sessions started, the coordinating session's id and what started this turn
//                (`typed` for a message the owner typed, else `event`),
//   wheres     - { <id>: where it stopped } and phaseTotals - { <id>: phases of tasks.md } for the lines that name them,
//   unfinished - [{ id, where }] every unfinished change, for the board's "outside the roadmap".

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadavg as osLoadavg, cpus as osCpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findRoot, readRoadmap, changeSchemaAt, roadmapRunOf, isChangeId } from './guard.mjs';
import { readFlow, collectFlow, computeFlow, makeOpenspec } from './flow-check.mjs';
import { locateChange, readPhases } from './deliver-check.mjs';
import {
  render, LoopUsageError, LoopRefusal, normalizeLang, nextAction, unfinished, archivedOnDefault, whereOf, waitLoop, readDevkitSettings, stageIcon, sessionTitle,
  HOOKS_DIR, locate, cleanOf, allow, refuseOnce, subagentStopFor, handOffFor, readStdin, withLockFile,
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

// The owner's arguments as typed (`roadmap 2`, `roadmap stop`, `roadmap`, or the word alone): one leading `roadmap` is dropped,
// the rest is read by `parseWord` (D-1).
export function parseRunInput(text) {
  return parseWord(String(text ?? '').trim().replace(/^roadmap(?=\s|$)/i, ''));
}

// ---------------------------------------------------------------- gates and the previous script (D-12, D-4)

// The gate code of each end that waits for the owner: every `waiting-` key of the message table but `waiting-github`.
const GATE_OF_WHY = {
  'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge',
  'waiting-archive-merge': 'merge', 'waiting-pr-decision': 'decision', 'waiting-review-dispute': 'dispute',
  'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-budget': 'budget',
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
// `session`, `wait` (N3 to N5), `owner` (N6, with `gate`), `blocked` (N2 and N7, with `why` and `params`), `archived` (N8) or, in a run with
// a session per change, `own` (the change runs in a session of its own; its action only when it was read).
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
    // A change in a session of its own (ADR 0014): recorded as started, or just reported started by this call.
    if (f.changeSessions && !d && (f.startedSessions?.[id] || f.after?.[id] === 'session-start')) { entries.push({ id, state: 'own', action, line }); continue; }
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

// The name of a change session (the start tool's `name`): the id lowercased, each run of characters outside [a-z0-9-] one `-`, cut to
// 24 characters, the dashes at both ends removed; `change` when nothing is left (D-3).
export function sessionName(id) {
  const name = String(id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 24).replace(/^-+|-+$/g, '');
  return name === '' ? 'change' : name;
}

// The brief a change session starts with (the start tool's `background`, at least 80 characters): what it is, where it works, what it says
// first, how it keeps its title and how it ends the turn that archives the change (D-3).
export function sessionBackground({ id, root, branch, coordinator, lang }) {
  return `This session runs the devkit change \`${id}\` for a \`/devkit roadmap\` run. The owner typed that command in the session \`${coordinator ?? 'unknown'}\`, `
    + 'which started this one: in the desktop app every change of a roadmap run has a session of its own (ADR 0014). '
    + `Work only in \`${root}\`, the change's worktree, on branch \`${branch}\`. Before your first question to the owner, say in two or three plain sentences, `
    + `in the owner's language (${normalizeLang(lang)}), who started this session, why and what it will do. Run the change with the task below and the devkit skill's Loop: `
    + "its stages, questions and approvals happen here. Keep this session's title as the `sessionTitle` of each `next`, renaming it yourself as the Loop says. "
    + 'The report that ends each of your turns returns to the session that started this one: when the change is archived, '
    + `end that turn with the line \`devkit roadmap: ${id} archived\`.`;
}

// The `session-start` action of an open change with no session of its own: the exact input of the host's start tool, and nothing else (D-3).
function sessionStartOf(e, f, lang) {
  const a = e.action;
  if (!a?.root) throw new LoopUsageError(`the open change ${e.id} has no worktree to start a session in`);
  const title = sessionTitle(stageIcon(a) ?? '❓', e.id);
  return {
    change: e.id, kind: 'session-start', cwd: a.root, title, progressKey: 'session-start',
    input: {
      initiation: 'user_asked', context: 'fresh', title, name: sessionName(e.id), cwd: a.root, use_worktree: false,
      prompt: `/devkit-openspec:devkit change ${e.id}`,
      background: sessionBackground({ id: e.id, root: a.root, branch: a.branch, coordinator: f.coordinator, lang }),
    },
  };
}
const requestOf = (line) => [line.text, line.notes].filter(Boolean).join('\n') || line.id;

// What the run does next. Pure: the caller writes `state` (the run file's fields) and carries the actions out.
// Returns { version, places, open, stopping, lines, actions, ask, end, state, entries }.
export function decideRoadmap(f) {
  const lang = normalizeLang(f.lang);
  const say = (key, params) => render(lang, key, params);
  const { entries, inflight } = entriesOf(f);
  const sessionMode = Boolean(f.changeSessions);
  // A session starts only on a turn the owner typed, and not on the turn the host just refused one (D-6).
  const refused = new Set(Object.entries(f.after ?? {}).filter(([, key]) => key === 'session-refused').map(([id]) => id));
  const mayStart = f.turn === 'typed' && refused.size === 0;
  const withhold = sessionMode && !mayStart;
  const stopping = Boolean(f.stopping);
  const places = f.places;
  const placed = entries.filter((e) => e.state !== 'archived');
  const open = placed.map((e) => e.id);
  const free = places - open.length;
  const lineOf = (id) => f.lines.find((l) => l.id === id);

  // The actions of the changes that are open, then the starts or the hold.
  let actions = [];
  if (!stopping) {
    for (const e of entries) {
      if (sessionMode) { // a change's own session hands its stages, carries out its steps and waits on GitHub (D-3)
        if (e.state !== 'own' && e.state !== 'archived' && !e.declared) actions.push(sessionStartOf(e, f, lang));
      } else if (e.state === 'agent' || e.state === 'session') actions.push({ ...e.action, change: e.id });
      else if (e.state === 'wait') actions.push({ ...e.action, change: e.id, kind: 'wait', progressKey: waitKey(e.action) });
    }
  }
  const ready = f.lines.filter((l) => l.cls === 'ready');
  const loaded = f.load >= f.limit && !f.startAnyway;
  const startable = !stopping && free > 0 && ready.length > 0;
  const holdNow = startable && loaded;
  const wanted = startable && !loaded ? ready.slice(0, free) : [];
  // On a turn nobody typed every start and session start is taken out: a line says it starts at the owner's next message (D-6).
  const withheld = withhold ? [...actions.map((a) => a.change), ...wanted.map((l) => l.id)] : [];
  if (withhold) actions = [];
  const starts = withhold ? [] : wanted;
  for (const l of starts) actions.push({ change: l.id, kind: 'start', request: requestOf(l), progressKey: 'start' });
  if (holdNow && !f.holding) actions.push({ change: ready[0].id, kind: 'hold', load: f.load, limit: f.limit, progressKey: 'hold' });

  // The starts handed and not yet open stay in `starting`; a change that is open now was started.
  const opened = new Set(entries.filter((e) => e.line.cls === 'open').map((e) => e.id));
  const startedNow = (f.starting ?? []).filter((id) => opened.has(id));
  const starting = [...new Set([...(f.starting ?? []).filter((id) => lineOf(id)?.cls === 'ready'), ...starts.map((l) => l.id)])];

  // The owner's queue: the entries waiting at a gate in roadmap order; the head is the one being asked while it stays there.
  const queue = sessionMode ? [] : entries.filter((e) => e.state === 'owner' && !e.declared); // a change's own session asks its gates
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
  // In a run with a session per change the started and resumed lines are one line per change session just started.
  const begun = sessionMode ? [] : entries.filter((e) => startedNow.includes(e.id) && e.line.cls === 'open' && announced[e.id] !== 'started');
  const resumes = sessionMode ? [] : entries.filter((e) => e.line.cls === 'open' && e.state !== 'archived' && announced[e.id] === undefined && !begun.includes(e));
  const sessionsStarted = sessionMode ? entries.filter((e) => e.state === 'own' && f.after?.[e.id] === 'session-start') : [];
  const sessionsNew = sessionsStarted.filter((e) => announced[e.id] !== 'session');
  let counted = open.length - begun.length - resumes.length - sessionsNew.length;
  for (const e of begun) emit(e.id, 'started', 'roadmap-started', { id: e.id, open: ++counted, places });
  for (const e of resumes) emit(e.id, 'resumed', 'roadmap-resumed', { id: e.id, where: f.wheres?.[e.id] ?? '', open: ++counted, places });
  for (const e of sessionsNew) emit(e.id, 'session', 'roadmap-session-started', { id: e.id, open: ++counted, places });
  // The others go on only when another change is under way: one that runs, or has a stage, step, wait or start in this decision.
  const othersGoOn = (id) => entries.some((e) => e.id !== id && e.state === 'running')
    || actions.some((a) => a.change !== id && ['agent', 'session', 'wait', 'start'].includes(a.kind));
  if (!sessionMode) {
    for (const e of entries) if (e.state === 'owner') emit(e.id, `gate:${e.gate}`, othersGoOn(e.id) ? 'roadmap-gate-others' : 'roadmap-gate', { id: e.id, gate: e.gate });
    for (const e of entries) if (e.state === 'blocked') emit(e.id, `blocked:${e.why}`, othersGoOn(e.id) ? 'roadmap-blocked-others' : 'roadmap-blocked', e.params);
  }
  for (const l of f.lines) {
    const archivedEntry = entries.some((e) => e.id === l.id && e.state === 'archived');
    if (archivedEntry || (ARCHIVED_CLASSES.includes(l.cls) && announced[l.id] !== undefined)) emit(l.id, 'archived', 'roadmap-archived', { id: l.id });
  }
  for (const l of f.lines) if (l.cls === 'previous') emit(l.id, 'skipped', 'roadmap-skipped', { id: l.id });
  for (const id of withheld) { // a refused change keeps its line until it starts: a later turn nobody typed does not say another
    if (refused.has(id) || announced[id] === 'waits-refused') emit(id, 'waits-refused', 'roadmap-waits-refused', { id });
    else emit(id, 'waits-turn', 'roadmap-waits-turn', { id });
  }
  if (holdNow && !f.held) lines.push(`▸ ${say('roadmap-held', { id: ready[0].id, load: f.load, limit: f.limit })}`);

  // The end of the run (D-7 E1 to E3): nothing in flight (while stopping a wait does not count), no action, no hold watched.
  // A change in a session of its own counts as under way, except while stopping; a start waiting for the owner's next message is no end.
  const flying = sessionMode ? 0 : Object.values(inflight).filter((e) => !(stopping && e.kind === 'wait')).length;
  const underWay = sessionMode && !stopping ? entries.filter((e) => e.state === 'own').length : 0;
  const idle = flying === 0 && underWay === 0 && withheld.length === 0 && actions.length === 0 && !f.holding && !entries.some((e) => e.state === 'archived');
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
    state: {
      asking: head?.id ?? null, announced, starting, held: holdNow, clearInflight: Object.keys(f.after ?? {}).filter((id) => f.inflight?.[id]),
      sessionsStarted: sessionsStarted.map((e) => e.id), turn: mayStart ? 'typed' : 'event', openLines: f.lines.filter((l) => l.cls === 'open').map((l) => l.id),
    },
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
  const takes = new Set(ready.slice(0, Math.max(free, 0)).map((l) => l.id));
  // In a run with a session per change, a line left for the owner's next message says so (D-6, D-11).
  const sessionMode = Boolean(f.changeSessions);
  const waitsTurn = (id) => sessionMode && ['waits-turn', 'waits-refused'].includes(f.announced?.[id]);
  const readyKey = (id) => (!takes.has(id) ? 'queue.place' : held ? 'queue.load' : waitsTurn(id) ? 'queue.turn' : 'queue.ready');
  const entryOf = (id) => placed.find((e) => e.id === id);
  const rows = { owner: [], running: [], blocked: [], queue: [], outside: [] };
  for (const l of f.lines) {
    const e = entryOf(l.id);
    if (e?.state === 'own') { const [block, text] = ownRow(e, f, say); rows[block].push({ id: l.id, text }); }
    else if (sessionMode && e && !e.declared) rows.running.push({ id: l.id, text: say('running.no-session') });
    else if (e?.state === 'owner') rows.owner.push({ id: l.id, text: say(`gate.${e.gate}`) });
    else if (e?.state === 'blocked') rows.blocked.push({ id: l.id, text: say(`blocked-why.${e.why}`, e.params) });
    else if (e) rows.running.push({ id: l.id, text: runningText(e, f, say) });
    else if (l.cls === 'ready') rows.queue.push({ id: l.id, text: say(readyKey(l.id)) });
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

// The block and the row of a change in a session of its own, from its action when it was read: its gate, its blocked reason or its stage.
function ownRow(e, f, say) {
  const a = e.action;
  if (a?.kind === 'grill' || (a?.kind === 'end' && a.end.state === 'waiting-for-owner')) return ['owner', say(`gate.${gateOf(a)}`)];
  if (a?.kind === 'end' && a.end.state === 'blocked') return ['blocked', say(`blocked-why.${a.end.why}`, { ...a.params, id: e.id, why: a.end.why })];
  return ['running', runningText(e, f, say)];
}

// A row of "under way": the stage's title, with its phase when the action names one and tasks.md's phases are known, or the wait on GitHub.
function runningText(e, f, say) {
  const action = e.action;
  if (e.state === 'wait' || action?.end?.state === 'waiting-on-github' || (e.state === 'running' && e.inflight.kind === 'wait')) {
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

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// The wait is at most half the `agent` hook's timeout in hooks.json (10 s), so a hand-off answers before the host gives up (D-8).
export const LOCK = { stepMs: 100, waitMs: 3_000, staleMs: 60_000 };

// The run file is locked by another call for longer than the wait: exit 3 for a command, `run-file-busy` for a hook.
export class RunFileBusy extends LoopUsageError {}

// One run's bookkeeping and nothing the files, the repository or GitHub can say.
const emptyRun = () => ({
  version: 1, session: null, places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [],
  held: false, holding: null, changeSessions: false, startedSessions: {}, turn: null, updatedAt: null,
});

// `<common git directory>/devkit/roadmap-run.json`: every checkout of the clone and every session see the same file, and no commit holds it.
export function runFilePath(cwd) {
  let common;
  try {
    common = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { throw new LoopUsageError(`${cwd} is not inside a git repository`); }
  return join(common, 'devkit', 'roadmap-run.json');
}

// True only for a watch record whose process still lives: `process.kill(pid, 0)` throws nothing, or EPERM (alive, not ours).
// ESRCH and every other error count as dead, so a watch killed before it cleared its mark holds nothing.
export function watchAlive(holding) {
  if (!isObject(holding) || !Number.isInteger(holding.pid) || holding.pid <= 0) return false;
  try { process.kill(holding.pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
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
  for (const key of ['stopping', 'held', 'changeSessions']) if (typeof parsed[key] === 'boolean') run[key] = parsed[key];
  if (parsed.turn === 'typed' || parsed.turn === 'event') run.turn = parsed.turn;
  // The change sessions the run started (D-3): { <change id>: { at } }; a key that is no change id is dropped.
  if (isObject(parsed.startedSessions)) {
    for (const [id, entry] of Object.entries(parsed.startedSessions)) {
      if (isChangeId(id) && isObject(entry)) run.startedSessions[id] = { at: typeof entry.at === 'string' ? entry.at : null };
    }
  }
  // The watch of the load: { pid, at } (D-7); the boolean of 0.18.0, or anything else, is no watch.
  if (isObject(parsed.holding) && Number.isInteger(parsed.holding.pid) && parsed.holding.pid > 0) {
    run.holding = { pid: parsed.holding.pid, at: typeof parsed.holding.at === 'string' ? parsed.holding.at : null };
  }
  for (const key of ['inflight', 'declared', 'announced']) if (isObject(parsed[key])) run[key] = parsed[key];
  if (Array.isArray(parsed.starting)) run.starting = parsed.starting.filter((id) => typeof id === 'string');
  return run;
}

// Read, change and write the file under its lock (created with `wx`, retried, taken over when old), through a temporary file and a rename.
// `change` receives the run and may return a new one; the run written is returned.
export function updateRun(file, change, { sleep } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  return withLockFile({
    ...LOCK, lock: join(dirname(file), 'roadmap-run.lock'), sleep,
    timeout: () => new RunFileBusy('the run file is locked by another call'),
  }, () => {
    const run = readRun(file);
    const next = change(run) ?? run;
    next.updatedAt = new Date().toISOString();
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
      renameSync(temporary, file);
    } catch (e) {
      rmSync(temporary, { force: true }); // the bookkeeping is written whole or not at all (D-10)
      throw e;
    }
    return next;
  });
}

// ---------------------------------------------------------------- the facts of a run (D-4, D-7)

// The `--after` keys of a change session the host started or refused (ADR 0014): no stage came back.
const SESSION_KEYS = ['session-start', 'session-refused'];

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
export function collectRoadmap(cwd, { env = process.env, lang = 'pt-BR', load = 0, limit = DEFAULT_LIMIT, openspec, gh, after = {}, wheres = 'new', readFlying = false, turn } = {}) {
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
  // The turn is the one the caller names, else the one the last decision recorded; a turn never recorded is one nobody typed.
  const common = {
    lang: l, places: run.places, stopping: run.stopping, holding: watchAlive(run.holding), load, limit, run,
    changeSessions: run.changeSessions, startedSessions: run.startedSessions, coordinator: run.session, turn: turn ?? run.turn ?? 'event',
  };
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
    if (run.changeSessions) {
      // A change in a session of its own is not read (its own session knows where it is); every other open change is, in flight or not.
      if ((run.startedSessions[line.id] || after[line.id] === 'session-start') && !readFlying) continue;
    } else if (run.inflight[line.id] && !(line.id in after) && !readFlying) continue;
    const progress = SESSION_KEYS.includes(after[line.id]) ? null : (after[line.id] ?? null); // the session keys are no progress key of a stage
    const action = nextAction(start, line.id, { env, lang: l, after: progress, openspec, gh });
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
  if (action.kind === 'session-start') return `the change ${c} has no session of its own yet: start it`;
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

// `guard.mjs agent` (RH0 to RH6).
export function roadmapAgentDecision(input, { env = process.env, run, gh = OFFLINE_GH } = {}) {
  let change = null;
  try {
    if (input.agent_type) return allow('subagent'); // RH0
    const current = run ?? roadmapRunOf(input);
    if (!current) return allow('no-run');
    const { start, file } = strictRunFile(input.cwd ?? process.cwd());
    const prompt = input.tool_input?.prompt;
    change = typeof prompt === 'string' ? (BRIEF_OF.exec(prompt)?.[1] ?? null) : null;
    if (readRun(file).changeSessions) { // RH6: every change has a session of its own, which hands its stages
      return refusal('own-sessions', change, 'in this /devkit roadmap run each change runs in a session of its own: its stages are handed in that session, not here');
    }
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
  } catch (e) { return allow(e instanceof RunFileBusy ? 'run-file-busy' : 'error', change); } // RH5
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
  } catch (e) { return allow(e instanceof RunFileBusy ? 'run-file-busy' : 'error', change); } // RU7
}

// ---------------------------------------------------------------- the command line

const USAGE = 'usage: roadmap-loop.mjs run --lang <l> --load-limit <p> --session <id> [--fresh] [--change-sessions] (the owner\'s arguments on standard input) | next --lang <l> --load-limit <p> [--after <id>=<key>]... [--turn typed|event] [--start-anyway] '
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

// A change id the session passes in: refused with a message naming it, before anything is read or written (D-9).
function changeIdOf(flag, id) {
  if (!isChangeId(id)) throw new LoopUsageError(`${flag} needs a change id (a letter or digit, then letters, digits, _, . or -): got ${JSON.stringify(id)}`);
  return id;
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
function decide(start, facts, ctx) {
  const decision = decideRoadmap(facts);
  updateRun(runFilePath(start), (run) => {
    run.asking = decision.state.asking;
    run.announced = decision.state.announced;
    run.starting = decision.state.starting;
    run.held = decision.state.held;
    run.turn = decision.state.turn;
    for (const id of decision.state.clearInflight) delete run.inflight[id];
    // The change sessions reported started are recorded; a change that is no longer an open line leaves the record (D-3).
    for (const id of decision.state.sessionsStarted) run.startedSessions[id] = { at: new Date().toISOString() };
    for (const id of Object.keys(run.startedSessions)) if (!decision.state.openLines.includes(id)) delete run.startedSessions[id];
    return run;
  }, { sleep: ctx.lockSleep });
  return decision;
}

const settingsOf = (ctx, opts) => ({ lang: normalizeLang(opts.value['--lang']), limit: limitOf(opts.value['--load-limit']), load: ctx.load() });

function hasRoadmapFile(start) { return readRoadmap(start) !== null; }

function runCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--session'], flags: ['--fresh', '--change-sessions'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const word = parseRunInput(ctx.stdin);
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
    else Object.assign(run, emptyRun(), { session, startedSessions: opts.flag['--fresh'] ? {} : run.startedSessions }); // U5: the change sessions outlive the session that started them
    run.changeSessions = Boolean(opts.flag['--change-sessions']);
    run.places = word.places;
    run.stopping = false;
    run.held = false;
    run.declared = {};
    return run;
  }, { sleep: ctx.lockSleep });
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: word.kind === 'stop' ? 'open' : 'new', turn: 'typed' }); // `run` is a message the owner typed
  const decision = decide(start, facts, ctx);
  const say = (key, params) => render(lang, key, params);
  let preface = '';
  if (word.kind === 'stop') {
    const stayed = decision.entries.filter((e) => e.state !== 'archived').map((e) => say('roadmap-stayed', { id: e.id, where: facts.wheres[e.id] ?? '' }));
    preface = `${[say('roadmap-stopping'), ...stayed].join('\n')}\n`;
  } else if (placesBefore !== null && placesBefore !== word.places) preface = `▸ ${say('roadmap-places', { places: word.places, open: decision.open.length })}\n`;
  return { code: 0, stdout: `${decisionText(decision)}${preface}${decisionJson(decision)}`, stderr: '' };
}

function nextCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--turn'], multi: ['--after'], flags: ['--start-anyway'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  // The turn the session names: one the owner typed or not; no word is a turn nobody typed (D-6).
  const turn = opts.value['--turn'] ?? 'event';
  if (turn !== 'typed' && turn !== 'event') throw new LoopUsageError(`--turn takes typed or event: got ${turn}`);
  const after = {};
  for (const pair of opts.many['--after'] ?? []) {
    const eq = pair.indexOf('=');
    if (eq < 1 || eq === pair.length - 1) throw new LoopUsageError(`--after needs <change>=<progress key>, got ${pair}`);
    after[changeIdOf('--after', pair.slice(0, eq))] = pair.slice(eq + 1);
  }
  const { lang, limit, load } = settingsOf(ctx, opts);
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none'));
  const stopping = readRun(runFilePath(start)).stopping;
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, after, wheres: stopping ? 'open' : 'new', turn });
  facts.startAnyway = Boolean(opts.flag['--start-anyway']);
  const decision = decide(start, facts, ctx);
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
  changeIdOf('--param id', params.id);
  const { id, why, ...rest } = params;
  const declared = state === 'blocked' ? { state, why, params: rest } : { state, why: key, params: { ...rest, gate: 'decision' } };
  updateRun(runFilePath(ctx.cwd), (run) => { run.declared[id] = declared; delete run.inflight[id]; return run; }, { sleep: ctx.lockSleep });
  return { code: 0, stdout: `devkit-end: ${id} ${state}\n${text}\n`, stderr: '' };
}

// `wait`: a wait on GitHub with no limit of its own, the change marked in flight while it lasts and cleared when it ends, also on error.
async function waitCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang', '--load-limit', '--interval'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const interval = intervalOf(opts.value['--interval']);
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const file = runFilePath(start);
  updateRun(file, (run) => { run.inflight[id] = { kind: 'wait', stage: 'delivery', agentType: null, at: new Date().toISOString() }; return run; }, { sleep: ctx.lockSleep });
  try {
    const poll = async () => nextAction(start, id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh });
    const action = await waitLoop({ poll, sleep: ctx.sleep ?? realSleep, interval, id, lang });
    return { code: 0, stdout: json(action), stderr: '' };
  } finally {
    updateRun(file, (run) => { delete run.inflight[id]; return run; }, { sleep: ctx.lockSleep });
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
  updateRun(file, (run) => { run.holding = { pid: process.pid, at: new Date().toISOString() }; return run; }, { sleep: ctx.lockSleep });
  try {
    for (; ;) {
      await sleep(interval);
      const stopping = readRun(file).stopping;
      const load = ctx.load();
      if (stopping || load < limit) return { code: 0, stdout: json({ load, limit }), stderr: '' };
    }
  } finally {
    updateRun(file, (run) => { if (run.holding?.pid === process.pid) run.holding = null; return run; }, { sleep: ctx.lockSleep });
  }
}

// The usage-error form of every subcommand: exit 3 with `{ version: 1, error, reply }`, nothing run.
function failure(argv, e) {
  const message = e instanceof Error ? e.message : String(e);
  const lang = argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1];
  const reply = e instanceof LoopRefusal ? e.reply : render(lang, 'request-unreadable'); // the raw message stays in `error`, never shown
  return { code: 3, stdout: `${JSON.stringify({ version: 1, error: message, reply })}\n`, stderr: `roadmap-loop: ${message}\n` };
}

const contextOf = ({ env = process.env, cwd = process.cwd(), stdin = '', openspec, gh, load, sleep, lockSleep } = {}) => ({ env, cwd, stdin, openspec, gh, sleep, lockSleep, load: load ?? (() => readLoad()) });

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
