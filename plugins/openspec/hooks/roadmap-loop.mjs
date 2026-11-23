// roadmap-loop: the decision core and the commands of `/devkit roadmap` and `/devkit status` (design roadmap-coordinator D-3 to D-12).
//
// The pure part: the load limit and its reading, the word of the command, which line of the roadmap is in which class (D-4),
// what a run does next (D-7), the board `/devkit status` prints (D-8) and the draft roadmap (D-9). The facts come in, the
// decision goes out. The rest reads files, the repository and (through gh) GitHub, and writes one bookkeeping file outside
// every working tree, in the repository's common directory (D-5). It calls no AI; its imports are Node built-ins and the
// pack's hook modules.
//
// Subcommands: `run` (the owner's arguments on standard input), `next [--after <id>=<key>]... [--turn typed|event] [--start-anyway]`, `status`, `draft`,
// `reply <key>`, `wait --change <id> [--interval <s>]`, `hold [--interval <s>]` and, for a change session a run started (roadmap-sessions-upfront D-6),
// `session-next --change <id> [--after <key>]`, `session-wait --change <id> [--interval <s>] [--session <id>]` and `merge-base --change <id>`, and for the coordinating
// session `push --change <id> --what grill|plan` and `check` (the periodic check, design D-5 and D-9); each takes `--lang <l>` and `--load-limit <p>`, and `run`
// also `--session <id> [--fresh] [--change-sessions] [--cron]`, `next` `[--check-id <job>] [--check-refused] [--check-deleted] [--check-gone]`. `run`, `next` and
// `check` print `devkit-roadmap: <places>` (or `stop`) and then the decision as JSON; exit 0, or 3 with `{ version, error, reply }`. `status` writes nothing.
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
//   tickets, placed, queued, waits, cron, check, waitsFor, unpushed - a run that opens every change at its start (ADR 0020): the start tickets, the places held, the
//                changes waiting for one, the wait loops, whether the host offers a session cron, the periodic check ({ id } or { refused }), { <id>: the dependency a
//                plan waits for } and { <id>: 'grill' | 'plan' } what is not on origin yet,
//   changeSessions, startedSessions, coordinator, turn - a run with a session per change (ADR 0014): whether each change runs in a session
//                of its own, { <id>: { at } } the change sessions started, the coordinating session's id and what started this turn
//                (`typed` for a message the owner typed, else `event`),
//   wheres     - { <id>: where it stopped } and phaseTotals - { <id>: phases of tasks.md } for the lines that name them,
//   unfinished - [{ id, where }] every unfinished change, for the board's "outside the roadmap".

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { loadavg as osLoadavg, cpus as osCpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { findRoot, readRoadmap, changeFlow, changeSchemaAt, readFlow, roadmapRunOf, runOf, isChangeId, firstMessageOf, startedTaskOf, parseStageHeader, START_LINE, ENTRY_SKILL, namesEntrySkill } from './guard.mjs';
import { collectFlow, computeFlow, makeOpenspec } from './flow-check.mjs';
import { locateChange, readPhases } from './deliver-check.mjs';
import {
  render, LoopUsageError, LoopRefusal, normalizeLang, nextAction, unfinished, archivedOnDefault, whereOf, waitLoop, readDevkitSettings, sessionTitle, changeState, runFactsOf, PLAN_NOT_HELD, partOfStage, isPlanStage,
  HOOKS_DIR, PACKS, locate, cleanOf, runFilePath, readRun, emptyRun, OUTLIVES, isObject, GATE_OF_WHY, gateOf, allow, refuseOnce, subagentStopFor, handOffFor, readStdin, withLockFile, HELD_TEXT,
  loopOutput, exitCodeOf, mainRoot, defaultBase, tryGit, stopDecision, hasTriageSection,
} from './change-loop.mjs';

// The run file's reader and the gate of an owner wait live in change-loop.mjs (change-state D-2); the callers of this module keep importing them from here.
export { runFilePath, readRun, gateOf, ENTRY_SKILL };

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
    const claimed = Boolean(f.tickets?.[id]?.claimedBy); // a session that claimed the run's ticket is the change's own
    if (f.changeSessions && !d && (f.startedSessions?.[id] || f.after?.[id] === 'session-start' || claimed)) { entries.push({ id, state: 'own', action, line }); continue; }
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

// The brief a change session starts with (the start tool's `background`, at least 80 characters): what it is, where it works, how it starts
// with no message from the owner, where the owner's gates are asked, what it says first, how it keeps its title and how it ends the turn that
// archives the change (design roadmap-sessions-upfront D-6).
export function sessionBackground({ id, root, branch, coordinator, lang }) {
  return `This session runs the devkit change \`${id}\` for a \`/devkit roadmap\` run. The owner typed that command in the session \`${coordinator ?? 'unknown'}\`, `
    + 'which started this one: in the desktop app every change of a roadmap run has a session of its own (ADR 0014, ADR 0020). '
    + 'Start at once, with no message from the owner: call the Skill tool with `devkit-openspec:devkit-session`; the devkit skill itself runs only from the owner\'s typed command. '
    + `Work only in \`${root}\`, the change's worktree, on branch \`${branch}\`. `
    + 'The grill, the plan approval and the retro answers are asked in the session that started this one. '
    + `Before your first question to the owner, say in two or three plain sentences, in the owner's language (${normalizeLang(lang)}), who started this session, why and what it will do. `
    + "Keep this session's title as the `sessionTitle` of each step, renaming it yourself as the skill says. "
    + 'The report that ends each of your turns returns to the session that started this one: when the change is archived, '
    + `end that turn with the line \`devkit roadmap: ${id} archived\`.`;
}

// The `session-start` action of an open change with no session of its own: the exact input of the host's start tool, and nothing else (D-3).
function sessionStartOf(e, f, lang) {
  const a = e.action;
  if (!a?.root) throw new LoopUsageError(`the open change ${e.id} has no worktree to start a session in`);
  const title = changeState(a, null, { lang, id: e.id }).title ?? sessionTitle('❓', e.id);
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

// The periodic check of a run (D-9): about every thirty minutes, at minutes the host's other schedules rarely use, with a prompt that is no typed command.
const CHECK_CRON = '13,43 * * * *';
export function checkPrompt(lang, limit) {
  return `devkit-roadmap-check: the periodic check of this roadmap run, started by its schedule and not typed by the owner. Run \`node ${join(HOOKS_DIR, 'roadmap-loop.mjs')} check --lang ${normalizeLang(lang)} --load-limit ${limit}\` `
    + 'and carry out its actions as the devkit skill\'s "The periodic check" says; approve no plan, answer no retro, hand no stage and start no session.';
}

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
  // In a run with a session per change every pending line opens, whatever the number, the load and the dependencies; the load holds a place, not an opening (D-2).
  const holdNow = !sessionMode && startable && loaded;
  const wanted = sessionMode ? (stopping ? [] : f.lines.filter((l) => l.cls === 'ready' || l.cls === 'waiting')) : (startable && !loaded ? ready.slice(0, free) : []);
  // On a turn nobody typed every start and session start is taken out: a line says it starts at the owner's next message (D-6).
  const withheld = withhold ? [...actions.map((a) => a.change), ...wanted.map((l) => l.id)] : [];
  if (withhold) actions = [];
  const starts = withhold ? [] : wanted;
  for (const l of starts) actions.push({ change: l.id, kind: 'start', request: requestOf(l), progressKey: 'start' });
  if (holdNow && !f.holding) actions.push({ change: ready[0].id, kind: 'hold', load: f.load, limit: f.limit, progressKey: 'hold' });

  // The starts handed and not yet open stay in `starting`; a change that is open now was started.
  const opened = new Set(entries.filter((e) => e.line.cls === 'open').map((e) => e.id));
  const startedNow = (f.starting ?? []).filter((id) => opened.has(id));
  const starting = [...new Set([...(f.starting ?? []).filter((id) => ['ready', 'waiting'].includes(lineOf(id)?.cls)), ...starts.map((l) => l.id)])];

  // The owner's queue: the entries waiting at a gate in roadmap order; the head is the one being asked while it stays there.
  // In a run with a session per change the grill, the plan approval and the retro answers are asked here; every other gate in the change's session (D-3).
  const gateAt = (e) => (sessionMode && e.action ? roadmapGateOf(e.action) : null);
  const queue = sessionMode ? entries.filter((e) => !e.declared && gateAt(e) !== null) : entries.filter((e) => e.state === 'owner' && !e.declared);
  const head = queue.find((e) => e.id === f.asking) ?? queue[0] ?? null;
  const headGate = head ? (head.gate ?? gateAt(head)) : null;
  const ask = head && !stopping ? { change: head.id, kind: headGate === 'grill' ? 'grill' : 'gate', ...(sessionMode ? { gate: headGate } : {}), action: head.action } : null;

  // The events, one line each, in the order of the table; each only when the change's announced state differs.
  const announced = { ...(f.announced ?? {}) };
  const lines = [];
  const emit = (id, key, message, params, slot = id) => {
    if (announced[slot] === key) return;
    announced[slot] = key;
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
  for (const e of sessionsNew) emit(e.id, 'session', 'roadmap-session-opened', { id: e.id });
  // The others go on only when another change is under way: one that runs, or has a stage, step, wait or start in this decision.
  const othersGoOn = (id) => entries.some((e) => e.id !== id && e.state === 'running')
    || actions.some((a) => a.change !== id && ['agent', 'session', 'wait', 'start'].includes(a.kind));
  if (sessionMode) { // a change session at a roadmap gate: its question is asked here; the others go on when another session is not at one
    const goesOn = (id) => entries.some((e) => e.id !== id && e.state === 'own' && gateAt(e) === null);
    for (const e of entries) if (e.state === 'own' && gateAt(e) !== null) emit(e.id, `gate:${gateAt(e)}`, goesOn(e.id) ? 'roadmap-gate-others' : 'roadmap-gate', { id: e.id, gate: gateAt(e) });
  } else {
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
  // What the session reported about the periodic check and the sessions it archives: one line each, once per state (D-9).
  if (f.check?.refused) emit('*check', 'refused', 'roadmap-check-refused', {}, '*check');
  for (const [id, key] of Object.entries(f.after ?? {})) {
    if (key === 'session-archived') { emit(id, 'archived', 'roadmap-check-session-archived', { id }, `~archived:${id}`); delete announced[`~later:${id}`]; }
    if (key === 'session-archive-later') emit(id, 'later', 'roadmap-check-archive-later', { id }, `~later:${id}`);
  }

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

  // Beside the actions of the changes: the push of a grill or a plan, the periodic check and the cleanup (D-5, D-9). The end is computed without them.
  const kept = sessionMode ? f.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls) && f.tickets?.[l.id]) : [];
  const extras = [];
  if (!end && !stopping) {
    for (const [id, what] of Object.entries(f.unpushed ?? {})) {
      if (f.after?.[id] !== 'push') extras.push({ change: id, kind: 'push', what, command: ['node', join(HOOKS_DIR, 'roadmap-loop.mjs'), 'push', '--change', id, '--what', what, '--lang', lang], progressKey: 'push' });
    }
    if (f.cron && !f.check) extras.push({ change: null, kind: 'schedule-check', input: { cron: CHECK_CRON, prompt: checkPrompt(lang, f.limit), recurring: true }, progressKey: 'schedule-check' });
  }
  if ((end || stopping) && f.check?.id) extras.push({ change: null, kind: 'delete-check', input: { id: f.check.id }, progressKey: 'delete-check' });
  for (const l of kept) {
    if (['session-archive-later', 'session-archived'].includes(f.after?.[l.id])) continue;
    extras.push({ change: l.id, kind: 'archive-session', cwd: f.actions?.[l.id]?.root ?? null, title: sessionTitle('📦', l.id), input: { reason: `devkit roadmap: ${l.id} is archived` }, progressKey: 'session-archived' });
  }
  if (end && ['done', 'stuck'].includes(end.why) && (f.check?.id || kept.length > 0)) extras.push({ change: null, kind: 'stop-own-tasks', progressKey: 'stop-own-tasks' });

  return {
    version: 1, places, open, stopping, lines, actions: [...actions, ...extras], ask, end, check: f.check?.id ?? null,
    state: {
      asking: head?.id ?? null, announced, starting, held: holdNow, clearInflight: Object.keys(f.after ?? {}).filter((id) => f.inflight?.[id]),
      sessionsStarted: sessionsStarted.map((e) => e.id), turn: mayStart ? 'typed' : 'event', openLines: f.lines.filter((l) => l.cls === 'open').map((l) => l.id),
      archivedLines: f.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls)).map((l) => l.id),
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
  // In a run with a session per change, every pending line opens and no start is held; a line left for the owner's next message says so (D-2, D-6, D-11).
  const sessionMode = Boolean(f.changeSessions);
  const held = !sessionMode && free > 0 && ready.length > 0 && f.load >= f.limit;
  const takes = new Set(ready.slice(0, Math.max(free, 0)).map((l) => l.id));
  const waitsTurn = (id) => sessionMode && ['waits-turn', 'waits-refused'].includes(f.announced?.[id]);
  const readyKey = (id) => (sessionMode ? (waitsTurn(id) ? 'queue.turn' : 'queue.ready') : !takes.has(id) ? 'queue.place' : held ? 'queue.load' : 'queue.ready');
  const entryOf = (id) => placed.find((e) => e.id === id);
  const rows = { owner: [], running: [], blocked: [], queue: [], outside: [] };
  for (const l of f.lines) {
    const e = entryOf(l.id);
    if (e) { const [block, text] = stateRow(e, f, say, lang); rows[block].push({ id: l.id, text }); }
    else if (l.cls === 'ready') rows.queue.push({ id: l.id, text: say(readyKey(l.id)) });
    else if (l.cls === 'waiting') rows.queue.push({ id: l.id, text: waitsTurn(l.id) ? say('queue.turn') : say('queue.after', { after: l.waitsFor }) });
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

// The block and the words of a placed change's row, from its state (change-state D-6): the owner and blocked rows say the state's
// reason, a wait on GitHub says what it waits for, and under way is the stage's title with its phase when the action names one and
// tasks.md's phases are known (or the change has no session of its own yet).
const BLOCK_OF_STATE = { 'waiting-for-owner': 'owner', blocked: 'blocked', running: 'running', 'waiting-on-github': 'running' };
function stateRow(e, f, say, lang) {
  const facts = runFactsOf(f, e.id, { onRoadmap: true });
  const s = changeState(f.actions?.[e.id] ?? null, facts, { lang, id: e.id });
  const block = BLOCK_OF_STATE[s.state];
  if (block === 'owner' || block === 'blocked') return [block, s.reason.text];
  if (block === 'running' && Object.hasOwn(HELD_TEXT, s.reason?.code ?? '')) return ['queue', s.reason.text];
  if (s.state === 'waiting-on-github') return [block, say('running.github', { what: s.reason.code })];
  if (s.reason?.code === 'ready' && facts.sessionMode) return [block, say('running.no-session')];
  const title = s.stageTitle ?? '';
  const total = f.phaseTotals?.[e.id];
  if (s.phase !== null && total) return [block, say('running.phase', { title, phase: s.phase, phases: total })];
  return [block, say('running.stage', { title })];
}

// ---------------------------------------------------------------- the draft (D-9)

// The draft roadmap: one round with an unticked line per change, no `after:`. The round's title is in the files' language.
export function draftText(lang, ids) {
  const title = lang === 'pt-BR' ? 'Rodada 1: changes por terminar' : 'Round 1: unfinished changes';
  const lines = ids.length ? `\n${ids.map((id) => `- [ ] ${id}`).join('\n')}\n` : '';
  return `# Roadmap\n\n## ${title}\n${lines}`;
}

// ---------------------------------------------------------------- the run file (D-5)

// The wait is at most half the `agent` hook's timeout in hooks.json (10 s), so a hand-off answers before the host gives up (D-8).
export const LOCK = { stepMs: 100, waitMs: 3_000, staleMs: 60_000 };

// The run file is locked by another call for longer than the wait: exit 3 for a command, `run-file-busy` for a hook.
export class RunFileBusy extends LoopUsageError {}

// True only for a watch record whose process still lives: `process.kill(pid, 0)` throws nothing, or EPERM (alive, not ours).
// ESRCH and every other error count as dead, so a watch killed before it cleared its mark holds nothing.
export function watchAlive(holding) {
  if (!isObject(holding) || !Number.isInteger(holding.pid) || holding.pid <= 0) return false;
  try { process.kill(holding.pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
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

// The `--after` keys of a step the session carried out that is no stage: a change session the host started or refused (ADR 0014), the push of a grill or a
// plan, and the archive of a change's session or its refusal (ADR 0020): no stage came back.
const SESSION_KEYS = ['session-start', 'session-refused', 'push', 'session-archived', 'session-archive-later'];

// The title of `stage` in the language of the person, from the change's own script; the id when it cannot be read.
export function stageTitleOf(found, stage, lang) {
  try {
    const dir = locateChange(found.root, found.id)?.dir ?? join(found.root, 'openspec', 'changes', found.id);
    return changeFlow(found.root, dir).flow?.stages.find((s) => s.id === stage)?.title[lang] ?? stage;
  } catch { return stage; }
}

// Every fact `decideRoadmap` and `boardOf` need, read from the roadmap, the checkouts, the run file and the load. `after` is
// { <id>: <progress key> }; `wheres` is `new` (the open changes never announced), `open` (every open change) or `board` (the
// unfinished changes that are not on the roadmap); `readFlying` also reads the action of a change in flight (the board shows it); `readOwn` (the default) reads
// the action of every open change in a session of its own too, the Stop hook leaving that to the decisions that follow (D-3).
export function collectRoadmap(cwd, { env = process.env, lang = 'pt-BR', load = 0, limit = DEFAULT_LIMIT, openspec, gh, after = {}, wheres = 'new', readFlying = false, readOwn = true, turn } = {}) {
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
    tickets: run.tickets, placed: run.placed, queued: run.queued, waits: run.waits, cron: run.cron, check: run.check,
  };
  // A change in a session of its own: recorded as started, just reported started, or whose session claimed the run's ticket (D-1, D-3).
  const ownOf = (id) => Boolean(run.changeSessions && (run.startedSessions[id] || after[id] === 'session-start' || run.tickets[id]?.claimedBy));
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
      // The action of a change in a session of its own is read for its gates (D-3) and, for the Stop hook, left unread; every other open change is read.
      if (ownOf(line.id) && !readFlying && !readOwn) continue;
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
  // What each change session waits for before its plan (D-11) and what of its grill or plan is not on origin yet (D-5).
  const waitsFor = {};
  const unpushed = {};
  if (run.changeSessions) {
    for (const l of lines) {
      if (l.cls !== 'open') continue;
      const dep = l.after.find((d) => !archived.has(d));
      if (dep && isPlanStage(start, l.id, actions[l.id])) waitsFor[l.id] = dep;
      const what = ownOf(l.id) && !(l.id in run.declared) ? unpushedOf(byId.get(l.id)?.root, l.id) : null;
      if (what) unpushed[l.id] = what;
    }
  }
  return {
    ...common, hasRoadmap: true, lines, actions, inflight: run.inflight, declared: run.declared, announced: run.announced, starting: run.starting,
    held: run.held, asking: run.asking, after, wheres: wheresMap, phaseTotals, unfinished: list.map((u) => ({ id: u.id, where: wheresMap[u.id] ?? '' })),
    waitsFor, unpushed,
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
  if (action.kind === 'push') return `the ${action.what} of the change ${c} is not on its branch on origin: push it`;
  if (action.kind === 'schedule-check') return 'the periodic check of the run is not scheduled: create it';
  if (action.kind === 'delete-check') return 'the periodic check of the run is still scheduled: delete it';
  if (action.kind === 'archive-session') return `the session of the archived change ${c} is still open: archive it`;
  if (action.kind === 'stop-own-tasks') return 'the run is over: stop the background tasks this session started for it';
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
    const facts = collectRoadmap(start, { env, lang, load: load(), limit, openspec, gh, wheres: 'none', readOwn: false });
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

export const isPreviousScript = (start, id, env) => {
  const found = locate(start, id);
  const clean = cleanOf(env);
  const { facts, flow } = collectFlow(found.root, id, { env: clean, openspec: makeOpenspec(found.root, clean) });
  return computeFlow(facts, flow, {}).script === 'previous';
};

const refusal = (why, change, reason) => ({ decision: 'refuse', why, change, reason });

// Whether `type` (a role, with no prefix or the prefix of the pack that ships its agent) is a helper of the `requirements` stage of the
// flow `change` follows (its pin); false with no change or a role it does not name.
function isRequirementsHelper(start, change, type) {
  if (!change || typeof type !== 'string') return false;
  const colon = type.indexOf(':');
  const role = colon === -1 ? type : type.slice(colon + 1);
  if (colon !== -1 && PACKS[role] !== type.slice(0, colon)) return false;
  const found = locate(start, change);
  const own = locateChange(found.root, change)?.dir;
  // A change with no folder has no pin: it is no change of a flow, so the installed flow of the project's script answers (the flow an open would record), and the
  // caller can still say the change is not open (design D-17).
  const flow = own ? changeFlow(found.root, own).flow : readFlow(found.root, changeSchemaAt(found.root, join(found.root, 'openspec', 'changes', change)));
  return (flow?.stages.find((x) => x.id === 'requirements')?.helpers ?? []).includes(role);
}

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
    const notOpen = (open) => refusal('not-open', change, `in a /devkit roadmap run a hand-off names a change open on the roadmap: ${change} is not one; the open changes are: ${open.join(', ') || 'none'}`); // RH2
    if (readRun(file).changeSessions) { // RH6: every change has a session of its own, which hands its stages
      // The one exception: a helper of the change's requirements stage (the grill's triage), for a change open on the roadmap; it marks nothing under way.
      if (!isRequirementsHelper(start, change, input.tool_input?.subagent_type)) {
        return refusal('own-sessions', change, 'in this /devkit roadmap run each change runs in a session of its own: its stages are handed in that session, not here');
      }
      const open = openOnRoadmap(start, env, gh);
      return !open.includes(change) || isPreviousScript(start, change, env) ? notOpen(open) : allow('grill-helper', change);
    }
    if (!change) return refusal('no-brief', null, 'in a /devkit roadmap run every hand-off starts with the brief the loop gave, which names its change'); // RH1
    const open = openOnRoadmap(start, env, gh);
    if (!open.includes(change) || isPreviousScript(start, change, env)) return notOpen(open); // RH2
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

// ---------------------------------------------------------------- the change session's loop and its places (roadmap-sessions-upfront D-6 to D-8)

// The owner's gates a change session leaves to the coordinating session: the grill, the plan approval and the retro answers.
export const ROADMAP_GATES = ['grill', 'approval', 'retro'];
// The parts of a script whose stages load the machine: a change holds a place while its stage is in one of them (D-7).
const LOAD_PARTS = ['build', 'after'];

// The roadmap gate an action waits at, or null (any action that is not one of them, a wait the table does not know included).
export function roadmapGateOf(action) {
  try {
    const gate = gateOf(action);
    return ROADMAP_GATES.includes(gate) ? gate : null;
  } catch { return null; }
}

const entriesCount = (record) => Object.keys(record).length;
const timeOf = (at) => Date.parse(at) || 0;

// The one place rule (D-6), pure: does change `id` take a place now? `free` places are the number of places less the changes that hold one;
// `ahead` the other changes queued since an earlier time; it claims when it is first in line with a place free and the machine below the limit (or the
// owner said to start anyway). Returns { claimed, why?, placed, queued, anyway } as new records: a claim records its place and leaves the queue and the
// permission; a refusal queues it (keeping the time it first queued) with why `place` (no place for it) or `load`.
export function placeDecision({ id, places, placed, queued, load, limit, anyway = [], now }) {
  const free = places - entriesCount(placed);
  const mine = queued[id];
  const since = timeOf(mine?.at ?? now);
  const ahead = Object.entries(queued).filter(([other, entry]) => other !== id && timeOf(entry.at) < since).length;
  if (free > ahead && (load < limit || anyway.includes(id))) {
    const rest = { ...queued };
    delete rest[id];
    return { claimed: true, placed: { ...placed, [id]: { at: now } }, queued: rest, anyway: anyway.filter((other) => other !== id) };
  }
  const why = free > ahead ? 'load' : 'place';
  return { claimed: false, why, placed: { ...placed }, queued: { ...queued, [id]: { at: mine?.at ?? now, why } }, anyway: [...anyway] };
}

// What a change session does next (D-6), pure, first match wins. The facts: id, action (the change loop's), part (of the action's stage in the
// change's script), waitsFor (the first dependency not archived), notInHead (a dependency's archive folder is missing from the branch),
// hasProposal, places, placed, queued, anyway, load, limit, now, lang. Returns { action, placed, queued, anyway }: the action to carry out
// (the change loop's, a `held` one that waits, or the `merge-base` step) and the places as they are after it.
export function sessionDecide(f) {
  const a = f.action;
  const lang = normalizeLang(f.lang);
  const say = (key, params) => render(lang, key, { id: f.id, ...params });
  const records = { placed: { ...f.placed }, queued: { ...f.queued }, anyway: [...(f.anyway ?? [])] };
  const given = (action) => ({ action, ...records });
  // The held action carries the state changeState derives for the change after this decision (D-11): its title and icon are the state's.
  const held = (why, extra, key, params) => {
    const heldRun = { changeSessions: true, startedSessions: { [f.id]: { at: f.now } }, placed: records.placed, queued: records.queued, waitsFor: { [f.id]: f.waitsFor ?? null } };
    const state = changeState(a, runFactsOf(heldRun, f.id, { onRoadmap: true }), { lang, id: f.id });
    const icon = Object.hasOwn(HELD_TEXT, state.reason?.code ?? '') ? state.stateIcon : state.stageIcon;
    return given({
      version: a.version, change: a.change ?? f.id, script: a.script, root: a.root, branch: a.branch, filesLanguage: a.filesLanguage, kind: 'held', held: { why, ...extra },
      stage: a.stage ?? null, stageTitle: a.stageTitle ?? null, icon, sessionTitle: state.title, state, reply: say(key, params), progressKey: `held/${why}`,
    });
  };
  const gate = roadmapGateOf(a);
  if (gate) return held('owner', { gate }, 'session-held-owner', { gate });
  const stage = (a.kind === 'agent' || a.kind === 'session') && f.part === 'plan' && !PLAN_NOT_HELD.includes(a.stage);
  if (stage && f.waitsFor) return held('after', { after: f.waitsFor }, 'session-held-after', { after: f.waitsFor });
  if (stage && f.notInHead && !f.hasProposal) {
    const fingerprint = String(a.progressKey ?? '').split('@').slice(1).join('@');
    return given({
      version: a.version, change: a.change ?? f.id, script: a.script, root: a.root, branch: a.branch, filesLanguage: a.filesLanguage, kind: 'session', step: 'merge-base',
      stage: a.stage, stageTitle: a.stageTitle, role: a.role ?? null, skills: [], icon: a.icon, sessionTitle: a.sessionTitle,
      detail: { command: ['node', join(HOOKS_DIR, 'roadmap-loop.mjs'), 'merge-base', '--change', f.id, '--lang', lang] },
      progressKey: `${a.stage}/merge-base@${fingerprint}`,
    });
  }
  const loads = LOAD_PARTS.includes(f.part);
  if (loads && (a.kind === 'agent' || a.kind === 'session') && !records.placed[f.id]) {
    const r = placeDecision({ id: f.id, places: f.places, placed: records.placed, queued: records.queued, load: f.load, limit: f.limit, anyway: records.anyway, now: f.now });
    Object.assign(records, { placed: r.placed, queued: r.queued, anyway: r.anyway });
    if (r.claimed) return given(a);
    return r.why === 'place'
      ? held('place', {}, 'session-held-place', { places: entriesCount(r.placed) })
      : held('load', {}, 'session-held-load', { load: f.load, limit: f.limit });
  }
  if (!loads) { delete records.placed[f.id]; delete records.queued[f.id]; } // the stage or the archive that leaves the load stages frees the place
  return given(a);
}

const ARCHIVE_FOLDER = /^\d{4}-\d{2}-\d{2}-(.+)$/;
// The ids whose archive folder is in the tree of HEAD in `root`.
function archivedInHead(root) {
  const names = tryGit(root, ['ls-tree', '--name-only', 'HEAD', 'openspec/changes/archive/']).split('\n');
  return new Set(names.map((n) => ARCHIVE_FOLDER.exec(n.slice(n.lastIndexOf('/') + 1))?.[1]).filter(Boolean));
}

// The facts of `sessionDecide` the files and the repository answer: the part of the stage and, for a plan stage, the dependencies of the change's line in
// the roadmap of the main checkout (D-8). GitHub is read only for a plan stage that has dependencies.
function sessionFacts(start, id, action, { env, openspec, gh }) {
  const found = locate(start, id);
  const part = partOfStage(found, id, action.stage);
  const facts = { part, waitsFor: null, notInHead: false, hasProposal: false };
  const plan = (action.kind === 'agent' || action.kind === 'session') && part === 'plan' && !PLAN_NOT_HELD.includes(action.stage);
  if (!plan) return facts;
  const dir = locateChange(found.root, id)?.dir ?? join(found.root, 'openspec', 'changes', id);
  facts.hasProposal = existsSync(join(dir, 'proposal.md'));
  const line = (readRoadmap(mainRoot(start)) ?? []).flatMap((round) => round.items).find((item) => item.id === id);
  const deps = line?.after ?? [];
  if (deps.length === 0) return facts;
  const archived = archivedOnDefault(start, { env, gh });
  facts.waitsFor = deps.find((d) => !archived.has(d)) ?? null;
  const inHead = archivedInHead(found.root);
  facts.notInHead = deps.some((d) => !inHead.has(d));
  return facts;
}

// The next action of change `id` for its own session (D-6): the change loop's action, then the places and the holds of `sessionDecide`. A change that is
// not in a run with a session per change, or whose ticket no session claimed, gets the change loop's action unchanged. With `write` the places are
// recorded (decided again on the run file as read under its lock); without it nothing is written. With `budget` (only `session-next`) the token
// budget is read as `next` reads it; the poll of `session-wait` and the stop lock never count it (change-budget D-4).
export function sessionNext(cwd, id, { env = process.env, lang = 'pt-BR', after = null, load = 0, limit = DEFAULT_LIMIT, openspec, gh, write = false, budget = false, lockSleep, now = new Date().toISOString() } = {}) {
  const l = normalizeLang(lang);
  const action = nextAction(cwd, id, { env, lang: l, after, openspec, gh, budget });
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const file = runFilePath(start);
  const run = readRun(file);
  if (!run.changeSessions || !run.tickets[id]?.claimedBy) return action;
  const facts = sessionFacts(start, id, action, { env, openspec, gh });
  const decide = (state) => sessionDecide({ id, action, ...facts, places: state.places, placed: state.placed, queued: state.queued, anyway: state.anyway, load, limit, now, lang: l });
  const places = (r) => JSON.stringify([r.placed, r.queued, r.anyway]);
  const first = decide(run);
  if (!write || places(first) === places(run)) return first.action;
  let result = first;
  updateRun(file, (current) => {
    result = decide(current);
    Object.assign(current, { placed: result.placed, queued: result.queued, anyway: result.anyway });
    return current;
  }, { sleep: lockSleep });
  return result.action;
}

// `guard.mjs stop` for a change run when no roadmap run was found (D-6): a change session that claimed its ticket may stop while its decision is to wait
// (`held`); every other session, and any error, is judged by the change loop's own lock. Read-only: a stop decision claims no place.
export function changeSessionStopDecision(input, { env = process.env, events, gh, openspec, load = () => readLoad() } = {}) {
  try {
    const run = runOf(input, events);
    const session = input?.session_id;
    const start = run && typeof session === 'string' && session !== '' ? findRoot(input.cwd ?? process.cwd()) : null;
    if (start && readRun(runFilePath(start)).tickets[run.change]?.claimedBy === session) {
      const lang = normalizeLang(env.CLAUDE_PLUGIN_OPTION_LANGUAGE);
      const action = sessionNext(input.cwd ?? process.cwd(), run.change, { env, lang, load: load(), limit: limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT), openspec, gh, write: false });
      if (action.kind === 'held') return allow('held', run.change);
    }
  } catch { /* the change loop's lock judges what this one cannot read */ }
  return stopDecision(input, { env, events });
}

// ---------------------------------------------------------------- the push of a grill and a plan (roadmap-sessions-upfront D-5)

// The files of a change's plan, as written in its folder: the grill's, the proposal, the design, the tasks, the review, the approval and the specs.
export const PLAN_FILES = ['requirements.md', 'proposal.md', 'design.md', 'tasks.md', 'readiness.md', 'approval.md', 'specs'];

const gitIn = (root, args, env) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
const gitOk = (root, args) => { try { gitIn(root, args, process.env); return true; } catch { return false; } };

// Pure git, no network: every path has no change in the tree, and `origin`'s ref of the branch holds the last commit that touched it. With no `origin`, committed is pushed.
export function filesPushed(root, branch, paths) {
  if (paths.some((path) => tryGit(root, ['status', '--porcelain', '--', path]) !== '')) return false;
  if (!tryGit(root, ['remote']).split('\n').includes('origin')) return true;
  const ref = `refs/remotes/origin/${branch}`;
  if (!gitOk(root, ['rev-parse', '--verify', '--quiet', ref])) return false;
  return paths.every((path) => {
    const last = tryGit(root, ['log', '-1', '--format=%H', '--', path]);
    return last === '' || gitOk(root, ['merge-base', '--is-ancestor', last, ref]);
  });
}

const readOr = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };

// What of change `id` is not on origin yet in its checkout `root`: `plan` once its approval passed, else `grill` once its requirements did; null when both are
// pushed, the branch is the default branch (nothing the run pushes goes there) or the checkout has none. `approval.md` on origin is the record of the plan push
// (D-5): only the coordinating session writes it and the push carries it with the plan files, so a later edit of a plan file (the implementer's tick of
// `tasks.md`) asks no second push, and an approval written again, which origin does not hold, asks one.
function unpushedOf(root, id) {
  const dir = root ? locateChange(root, id)?.dir : null;
  const branch = dir ? tryGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']) : '';
  if (!dir || !branch || branch === defaultBase(root)) return null;
  const inRoot = (file) => relative(root, join(dir, file));
  const passed = (file) => parseStageHeader(readOr(join(dir, file)))?.result === 'passed';
  if (passed('approval.md') && !filesPushed(root, branch, [inRoot('approval.md')])) return 'plan';
  if (passed('requirements.md') && !filesPushed(root, branch, [inRoot('requirements.md')])) return 'grill';
  return null;
}

// ---------------------------------------------------------------- the wait loops of a run (roadmap-sessions-upfront D-9)

// The recorded waits that no change needs any more: the waits of a change that is not an open line or is archived, and of one kind of one change every wait
// older than the newest. Pure; returns [{ id, pid, kind, at, session }].
export function staleWaits(waits, { open, archived }) {
  const openIds = new Set(open);
  const archivedIds = new Set(archived);
  const stale = [];
  for (const [id, list] of Object.entries(waits ?? {})) {
    if (!openIds.has(id) || archivedIds.has(id)) { stale.push(...list.map((w) => ({ id, ...w }))); continue; }
    for (const kind of new Set(list.map((w) => w.kind))) {
      const same = list.filter((w) => w.kind === kind);
      const newest = same.reduce((latest, w) => (timeOf(w.at) >= timeOf(latest.at) ? w : latest), same[0]);
      stale.push(...same.filter((w) => w !== newest).map((w) => ({ id, ...w })));
    }
  }
  return stale;
}

// The command line of a wait loop the skills start (`roadmap-loop.mjs wait` or `session-wait`), as `ps` prints it.
const WAIT_COMMAND = /roadmap-loop\.mjs\s+(?:session-)?wait(?:\s|$)/;

// True when `pid` is a process whose command line is a wait loop of the run (D-9 step 1): after a reboot or a long run the system may hand a recorded number
// to an unrelated process, which must never be signalled. Any error of `ps` (no such process, no `ps` on the system) gives false.
export function isWaitProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    return WAIT_COMMAND.test(execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return false; }
}

// A recorded wait whose process lives and is still a wait loop (`watchAlive` keeps the load watch's own reading).
export const waitAlive = (w) => watchAlive(w) && isWaitProcess(w.pid);

// Stops the processes of `entries` that are still wait loops with SIGTERM (never this one); a process that is none is spared, one already gone counts as
// stopped. Returns how many were signalled. A caller drops from its record every entry it passed, signalled or spared.
export function killWaits(entries) {
  let stopped = 0;
  for (const w of entries) {
    if (w.pid === process.pid || !isWaitProcess(w.pid)) continue;
    try { process.kill(w.pid, 'SIGTERM'); stopped += 1; } catch { /* already gone */ }
  }
  return stopped;
}

// A change no longer open holds no place (D-7): in a run with a session per change, deletes the `placed` and `queued` entries of every id that is not in
// `openIds`. Its session is gone, so it never reaches the branch of `sessionDecide` that releases the place. `anyway` is not pruned: it gives no place by itself
// and a claim uses it up. A run without a session per change keeps its records as they are. Changes `run` in place.
export function pruneRecords(run, openIds) {
  if (!run.changeSessions) return;
  const open = new Set(openIds);
  for (const key of ['placed', 'queued']) for (const id of Object.keys(run[key])) if (!open.has(id)) delete run[key][id];
}

const sameWait = (a, b) => a.pid === b.pid && a.kind === b.kind && a.at === b.at;
// `waits` without `gone` (entries as `staleWaits` returns them): a change with no wait left leaves the record.
function withoutWaits(waits, gone) {
  const out = {};
  for (const [id, list] of Object.entries(waits)) {
    const rest = list.filter((w) => !gone.some((g) => g.id === id && sameWait(g, w)));
    if (rest.length) out[id] = rest;
  }
  return out;
}

// ---------------------------------------------------------------- the entry of a started change session (roadmap-sessions-upfront D-1)

// The one-use ticket of a session start: 16 lowercase hexadecimal characters.
export const mintTicket = () => randomBytes(8).toString('hex');

// The `session-start` action with its task in two lines: the command, then the run's `devkit-start:` line. `typedOf` still reads the first line.
export function withTicket(action, ticket) {
  return { ...action, input: { ...action.input, prompt: `${action.input.prompt}\ndevkit-start: ${action.change} ${ticket}` } };
}

// The first non-blank line of the task of a started session. The skill it runs first, `ENTRY_SKILL`, lives in guard.mjs beside the test of a call's input.
const TASK_OF = /^\s*\/(?:[\w-]+:)?devkit[ \t]+change[ \t]+([A-Za-z0-9][\w.-]*)[ \t]*\r?$/;
const TYPING = (id) => `the owner can run this change by typing /devkit change ${id} in this session`;

// What a ticket in the run file says about the call of a session: the label, first match wins.
function ticketLabel(run, id, ticket, session) {
  const entry = run.tickets[id];
  if (!entry || entry.ticket !== ticket) return 'ticket-unknown';
  if (entry.claimedBy === null) return 'claimed';
  return entry.claimedBy === session ? 'same-session' : 'ticket-claimed';
}

const ENTRY_REFUSALS = {
  'not-started': 'devkit-session runs only in a session a /devkit roadmap run started: the first message of this session is not that form with a /devkit change task',
  'no-ticket': (id) => `the first message of this session carries no devkit-start line for ${id}`,
  'ticket-unknown': 'the run does not record the ticket of this session\'s start',
  'ticket-claimed': 'another session already claimed the ticket of this change',
  unreadable: 'the entry could not be checked: the transcript or the run file could not be read',
};

// `guard.mjs skill` (design D-1): the decision on a call of the Skill tool, { decision, why, change, reason }. A call that names no
// `devkit-session` in any string field of its input is let through (`not-entry`). The entry runs only when the session's first message is
// the host's started form whose task is `/devkit change <id>` and a `devkit-start: <id> <ticket>` line, and the run file records that ticket
// for the change, unclaimed or claimed by this very session; the first session claims it, under the run file's lock. Any other call is refused,
// and so is any error (`unreadable`): the owner's typed `/devkit change <id>` still runs the change.
export function entryDecision(input, { env = process.env } = {}) {
  let id = null;
  const refuse = (why, detail) => {
    const said = typeof detail === 'function' ? detail(id) : detail;
    return { decision: 'refuse', why, change: id, reason: `${said}; ${TYPING(id ?? '<id>')}` };
  };
  try {
    if (!namesEntrySkill(input?.tool_input)) return allow('not-entry');
    const first = firstMessageOf(input);
    const task = first === null ? null : startedTaskOf(first);
    const command = task?.find((line) => line.trim() !== '');
    id = command === undefined ? null : (TASK_OF.exec(command)?.[1] ?? null);
    if (id === null) return refuse('not-started', ENTRY_REFUSALS['not-started']);
    const start = task.map((line) => START_LINE.exec(line)).find((m) => m?.[1] === id);
    if (!start) return refuse('no-ticket', ENTRY_REFUSALS['no-ticket']);
    const session = input.session_id;
    if (typeof session !== 'string' || session === '') throw new LoopUsageError('the call names no session');
    const { file } = strictRunFile(input.cwd ?? process.cwd());
    let label = ticketLabel(readRun(file), id, start[2], session);
    if (label === 'claimed') {
      updateRun(file, (run) => { // again under the lock: two sessions can ask at once, and only the first claims
        label = ticketLabel(run, id, start[2], session);
        if (label === 'claimed') run.tickets[id].claimedBy = session;
        return run;
      });
    }
    if (label === 'claimed' || label === 'same-session') return allow(label, id);
    return refuse(label, ENTRY_REFUSALS[label]);
  } catch { return refuse('unreadable', ENTRY_REFUSALS.unreadable); }
}

// ---------------------------------------------------------------- the command line

const USAGE = 'usage: roadmap-loop.mjs run --lang <l> --load-limit <p> --session <id> [--fresh] [--change-sessions] [--cron] (the owner\'s arguments on standard input) | next --lang <l> --load-limit <p> [--after <id>=<key>]... [--turn typed|event] [--start-anyway] [--check-id <job>] [--check-refused] [--check-deleted] [--check-gone] '
  + '| status --lang <l> --load-limit <p> | draft --lang <l> | reply <key> --lang <l> [--param name=value]... | wait --change <id> --lang <l> [--interval <seconds>] '
  + '| hold --lang <l> --load-limit <p> [--interval <seconds>] | session-next --change <id> --lang <l> --load-limit <p> [--after <progress key>] '
  + '| session-wait --change <id> --lang <l> --load-limit <p> [--interval <seconds>] [--session <id>] | merge-base --change <id> --lang <l> '
  + '| push --change <id> --what grill|plan --lang <l> | check --lang <l> --load-limit <p> [--check-gone]';

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
const decisionJson = (d) => json({ version: 1, places: d.places, open: d.open, stopping: d.stopping, lines: d.lines, actions: d.actions, ask: d.ask, end: d.end, check: d.check ?? null });

// The wait loops this decision no longer leaves running (D-9): at the end of a run (done or stuck) every one; at a stop the stale ones; otherwise, in a run with a
// session per change, those of an archived change, which would keep the app from archiving its session. Their entries leave the record.
function tidyWaits(run, decision, facts) {
  const why = decision.end?.why;
  if (!facts.changeSessions && why !== 'done' && why !== 'stuck' && why !== 'stopped') return;
  const stale = staleWaits(run.waits, { open: decision.state.openLines, archived: decision.state.archivedLines });
  const every = Object.entries(run.waits).flatMap(([id, list]) => list.map((w) => ({ id, ...w })));
  const doomed = why === 'done' || why === 'stuck' ? every : why === 'stopped' ? stale : stale.filter((w) => decision.state.archivedLines.includes(w.id));
  if (doomed.length === 0) return;
  killWaits(doomed);
  run.waits = withoutWaits(run.waits, doomed);
}

// Decide over the current facts and record what the decision says about the run (D-7): the head of the owner's queue, the events
// announced, the starts handed, the hold and the stages that came back.
function decide(start, facts, ctx) {
  const decision = decideRoadmap(facts);
  const tickets = {};
  updateRun(runFilePath(start), (run) => {
    run.asking = decision.state.asking;
    run.announced = decision.state.announced;
    run.starting = decision.state.starting;
    run.held = decision.state.held;
    run.turn = decision.state.turn;
    for (const id of decision.state.clearInflight) delete run.inflight[id];
    // The change sessions reported started are recorded; a change whose line is neither open nor archived leaves the record (D-3, D-9).
    for (const id of decision.state.sessionsStarted) run.startedSessions[id] = { at: new Date().toISOString() };
    const stays = new Set([...decision.state.openLines, ...decision.state.archivedLines]);
    for (const key of ['startedSessions', 'tickets']) for (const id of Object.keys(run[key])) if (!stays.has(id)) delete run[key][id];
    pruneRecords(run, decision.state.openLines); // a change that left the roadmap, was ticked, archived or moved to the previous script holds no place (D-7)
    // The session of an archived change was archived: its entries leave the record (D-9).
    for (const [id, key] of Object.entries(facts.after ?? {})) if (key === 'session-archived') { delete run.startedSessions[id]; delete run.tickets[id]; }
    tidyWaits(run, decision, facts);
    // Each session start gets a fresh ticket recorded before it is printed; an unclaimed ticket of the same change is replaced, a claimed one never (D-1).
    for (const a of decision.actions) {
      if (a.kind !== 'session-start') continue;
      const held = run.tickets[a.change];
      if (held?.claimedBy == null) run.tickets[a.change] = { ticket: mintTicket(), at: new Date().toISOString(), claimedBy: null };
      tickets[a.change] = run.tickets[a.change].ticket;
    }
    return run;
  }, { sleep: ctx.lockSleep });
  return { ...decision, actions: decision.actions.map((a) => (a.kind === 'session-start' ? withTicket(a, tickets[a.change]) : a)) };
}

const settingsOf = (ctx, opts) => ({ lang: normalizeLang(opts.value['--lang']), limit: limitOf(opts.value['--load-limit']), load: ctx.load() });

function hasRoadmapFile(start) { return readRoadmap(start) !== null; }

function runCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--session'], flags: ['--fresh', '--change-sessions', '--cron'] });
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
    else { // U5: the change sessions, their tickets, places, queue and waits outlive the session that started them; the session cron and the anyway do not
      const kept = opts.flag['--fresh'] ? {} : Object.fromEntries(OUTLIVES.map((key) => [key, run[key]]));
      Object.assign(run, emptyRun(), { session }, kept);
    }
    run.changeSessions = Boolean(opts.flag['--change-sessions']);
    run.cron = Boolean(opts.flag['--cron']); // whether the host offers a session cron (D-9)
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

// What the session reports about the periodic check and the owner's start anyway, written before the facts are read (D-7, D-9): `--check-id` the job
// created, `--check-refused` the host's refusal, `--check-deleted` the job deleted (also one already gone), `--check-gone` the job the host's list lacks
// (a recorded refusal stays); `--start-anyway`, in a run with a session per change, records the changes the load holds now. Returns the run as written.
function recordFlags(start, opts, ctx) {
  const file = runFilePath(start);
  const id = opts.value['--check-id'];
  const flag = opts.flag;
  if (id === undefined && !flag['--check-refused'] && !flag['--check-deleted'] && !flag['--check-gone'] && !flag['--start-anyway']) return readRun(file);
  if (id === '') throw new LoopUsageError('--check-id needs the job id');
  return updateRun(file, (run) => {
    const at = new Date().toISOString();
    if (id !== undefined) run.check = { id, at };
    if (flag['--check-refused']) run.check = { refused: true, at };
    if (flag['--check-deleted'] || (flag['--check-gone'] && run.check?.id)) run.check = null;
    if (flag['--start-anyway'] && run.changeSessions) run.anyway = Object.entries(run.queued).filter(([, q]) => q.why === 'load').map(([other]) => other);
    return run;
  }, { sleep: ctx.lockSleep });
}

function nextCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--turn', '--check-id'], multi: ['--after'], flags: ['--start-anyway', '--check-refused', '--check-deleted', '--check-gone'] });
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
  const run = recordFlags(start, opts, ctx);
  const stopping = run.stopping;
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
  const opts = parseOpts(args, { values: ['--change', '--lang', '--load-limit', '--interval', '--session'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const interval = intervalOf(opts.value['--interval']);
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const file = runFilePath(start);
  const entry = { pid: process.pid, kind: 'github', at: new Date().toISOString(), session: opts.value['--session'] ?? null };
  updateRun(file, (run) => {
    run.inflight[id] = { kind: 'wait', stage: 'delivery', agentType: null, at: entry.at };
    run.waits[id] = [...(run.waits[id] ?? []), entry]; // recorded, so the periodic check can stop it when its change no longer needs it (D-9)
    return run;
  }, { sleep: ctx.lockSleep });
  try {
    const poll = async () => nextAction(start, id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh });
    const action = await waitLoop({ poll, sleep: ctx.sleep ?? realSleep, interval, id, lang });
    return { code: 0, stdout: json(action), stderr: '' };
  } finally {
    updateRun(file, (run) => { delete run.inflight[id]; run.waits = withoutWaits(run.waits, [{ id, ...entry }]); return run; }, { sleep: ctx.lockSleep });
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

// `session-next` (D-6): what `change-loop.mjs next` prints, for a change in a session of its own: `devkit-run: <id>`, the end line of an end, the JSON action.
function sessionNextCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang', '--load-limit', '--after'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const { lang, limit, load } = settingsOf(ctx, opts);
  const action = sessionNext(ctx.cwd, id, { env: ctx.env, lang, after: opts.value['--after'] ?? null, load, limit, openspec: ctx.openspec, gh: ctx.gh, write: true, budget: true, lockSleep: ctx.lockSleep });
  return { code: exitCodeOf(action), stdout: loopOutput(id, action), stderr: '' };
}

// `merge-base` (D-6, D-8): merges origin's default branch into the change's branch, in its checkout. A conflict is undone and ends exit 3 with the reason.
function mergeBaseCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const lang = normalizeLang(opts.value['--lang']);
  const root = locate(rootOf(ctx.cwd), id).root;
  const git = (...gitArgs) => gitIn(root, gitArgs, ctx.env);
  const base = defaultBase(root);
  git('fetch', 'origin', '--quiet');
  try {
    git('merge', '--no-edit', `origin/${base}`);
  } catch (e) {
    const error = [e.stdout, e.stderr].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || String(e.message);
    try { git('merge', '--abort'); } catch { /* nothing was started */ }
    const reply = render(lang, 'blocked', { id, why: 'base-conflict', error });
    return { code: 3, stdout: json({ version: 1, error, why: 'base-conflict', reply }), stderr: `roadmap-loop: ${error}\n` };
  }
  return { code: 0, stdout: json({ version: 1, merged: base }), stderr: '' };
}

// `session-wait` (D-6): the wait of a held change session. Ends when its decision changes and prints it as `session-next` does; recorded in `waits` while it
// lasts, cleared at its end, also on error.
async function sessionWaitCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang', '--load-limit', '--interval', '--session'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const interval = intervalOf(opts.value['--interval']);
  const { lang, limit } = settingsOf(ctx, opts);
  const file = runFilePath(rootOf(ctx.cwd));
  const entry = { pid: process.pid, kind: 'session', at: new Date().toISOString(), session: opts.value['--session'] ?? null };
  updateRun(file, (run) => { run.waits[id] = [...(run.waits[id] ?? []), entry]; return run; }, { sleep: ctx.lockSleep });
  try {
    const poll = async () => sessionNext(ctx.cwd, id, { env: ctx.env, lang, load: ctx.load(), limit, openspec: ctx.openspec, gh: ctx.gh, write: true, lockSleep: ctx.lockSleep });
    const action = await waitLoop({ poll, sleep: ctx.sleep ?? realSleep, interval, id, lang, waiting: (a) => a.kind === 'held', failWhy: 'unreadable' });
    return { code: exitCodeOf(action), stdout: loopOutput(id, action), stderr: '' };
  } finally {
    updateRun(file, (run) => { run.waits = withoutWaits(run.waits, [{ id, ...entry }]); return run; }, { sleep: ctx.lockSleep });
  }
}

// `push` (D-5): commits the grill's or the plan's files on the change's branch and pushes the branch to origin. A git failure is a refusal with its reply, exit 3.
function pushCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--what', '--lang'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const what = opts.value['--what'];
  if (what !== 'grill' && what !== 'plan') throw new LoopUsageError(`--what takes grill or plan: got ${what}`);
  const lang = normalizeLang(opts.value['--lang']);
  const { root, branch } = locate(rootOf(ctx.cwd), id);
  const dir = locateChange(root, id)?.dir;
  if (!dir) throw new LoopUsageError(`the change ${id} has no folder in ${root}`);
  if (!branch || branch === defaultBase(root)) throw new LoopUsageError(`the change ${id} is on ${branch || 'no branch'}: the run pushes a change's own branch only`);
  const paths = (what === 'plan' ? PLAN_FILES.filter((file) => existsSync(join(dir, file))) : ['requirements.md']).map((file) => relative(root, join(dir, file)));
  const git = (...gitArgs) => gitIn(root, gitArgs, ctx.env);
  let pushed = false;
  try {
    git('add', '--', ...paths);
    if (git('diff', '--cached', '--name-only', '--', ...paths).trim() !== '') git('commit', '-m', `docs(openspec): ${what} of ${id}`, '--', ...paths);
    pushed = git('remote').split('\n').includes('origin');
    if (pushed) git('push', '-u', 'origin', branch);
  } catch (e) {
    const error = [e.stdout, e.stderr].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || String(e.message);
    throw new LoopRefusal(`push failed: ${error}`, render(lang, 'push-failed', { id, error }));
  }
  return { code: 0, stdout: json({ version: 1, change: id, what, pushed }), stderr: '' };
}

// `check` (D-9): what the periodic check does at each firing. It stops the wait loops no change needs, hands a freed place to the first change queued for one,
// decides as `next` does on a turn nobody typed (so it starts no session) and adds the triage of the grills not being asked. It writes no approval and no retro
// answer and hands no stage; what it prints is empty when nothing changed.
function checkCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'], flags: ['--check-gone'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const { lang, limit, load } = settingsOf(ctx, opts);
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none'));
  const file = runFilePath(start);
  const run = recordFlags(start, opts, ctx);
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: run.stopping ? 'open' : 'new', turn: 'event' });
  const say = (key, params) => `▸ ${render(lang, key, params)}`;
  const openIds = facts.lines.filter((l) => l.cls === 'open').map((l) => l.id);
  const archivedIds = facts.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls)).map((l) => l.id);
  let stopped = 0;
  const given = [];
  updateRun(file, (current) => {
    pruneRecords(current, openIds); // before a place is handed: the place of a change no longer open is free already (D-7)
    // The waits whose process is gone or is no wait loop, then the stale ones, leave the record; a place freed goes to the first change that queued for it (D-9 steps 1 and 2).
    const alive = Object.fromEntries(Object.entries(current.waits).map(([id, list]) => [id, list.filter((w) => waitAlive(w))]).filter(([, list]) => list.length));
    const stale = staleWaits(alive, { open: openIds, archived: archivedIds });
    stopped = killWaits(stale);
    current.waits = withoutWaits(alive, stale);
    if (current.changeSessions) {
      const waiting = Object.entries(current.queued).filter(([id]) => openIds.includes(id)).sort((a, b) => timeOf(a[1].at) - timeOf(b[1].at)).map(([id]) => id);
      const now = new Date().toISOString();
      for (const id of waiting) {
        const r = placeDecision({ id, places: current.places, placed: current.placed, queued: current.queued, load, limit, anyway: current.anyway, now });
        Object.assign(current, { placed: r.placed, queued: r.queued, anyway: r.anyway });
        if (r.claimed && !(current.waits[id]?.length)) given.push(id);
      }
    }
    return current;
  }, { sleep: ctx.lockSleep });
  const decision = decide(start, facts, ctx);
  const asked = decision.ask?.change;
  const triage = facts.hasRoadmap === false ? [] : Object.entries(facts.actions)
    .filter(([id, action]) => action?.kind === 'grill' && action.helpers?.includes('requirements-triage') && id !== asked && !hasTriageSection(readOr(join(locateChange(action.root, id)?.dir ?? action.root, 'requirements.md'))))
    .map(([id, action]) => ({ change: id, kind: 'triage', root: action.root, progressKey: 'triage' }));
  const own = [...(stopped > 0 ? [say('roadmap-check-stopped-waits', { n: stopped })] : []), ...given.map((id) => say('roadmap-check-idle', { id }))];
  const shown = { ...decision, lines: [...own, ...decision.lines], actions: [...decision.actions, ...triage] };
  return { code: 0, stdout: `${decisionText(shown)}${decisionJson(shown)}`, stderr: '' };
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
    if (sub === 'session-next') return sessionNextCmd(rest, ctx);
    if (sub === 'merge-base') return mergeBaseCmd(rest, ctx);
    if (sub === 'push') return pushCmd(rest, ctx);
    if (sub === 'check') return checkCmd(rest, ctx);
    throw new LoopUsageError(USAGE);
  } catch (e) {
    return failure(argv, e);
  }
}

// `main`, and `wait`, `hold` and `session-wait` too: the one entry point of the command line.
const WAITING = { wait: waitCmd, hold: holdCmd, 'session-wait': sessionWaitCmd };
export async function runCommand(argv, opts = {}) {
  const [sub, ...rest] = argv;
  if (!Object.hasOwn(WAITING, sub)) return main(argv, opts);
  try {
    return await WAITING[sub](rest, contextOf(opts));
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
