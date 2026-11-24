// roadmap-loop: the decision core and the commands of `/devkit roadmap` and `/devkit status` (design roadmap-coordinator D-3 to D-12).
//
// The pure part: the load limit and its reading, the word of the command, which line of the roadmap is in which class (D-4),
// what a run does next (D-7), the board `/devkit status` prints (D-8) and the draft roadmap (D-9). The facts come in, the
// decision goes out. The rest reads files, the repository and (through gh) GitHub, and writes one bookkeeping file outside
// every working tree, in the repository's common directory (D-5). It calls no AI; its imports are Node built-ins and the
// pack's hook modules.
//
// Subcommands: `run` (the owner's arguments on standard input), `next [--after <id>=<key>]... [--turn typed|event] [--start-anyway]`, `status`, `draft`,
// `reply <key>`, `wait --change <id> [--interval <s>]`, `hold [--interval <s>]`, `checkout --change <id> --machines <json>` (the worktree of a change placed on another machine, remote-worker D-8) and, for a change session a run started (roadmap-sessions-upfront D-6),
// `session-next --change <id> [--after <key>]`, `session-wait --change <id> [--interval <s>] [--session <id>]` and `merge-base --change <id>`, and for the coordinating
// session `push --change <id> --what grill|plan` and `check` (the periodic check, design D-5 and D-9); each takes `--lang <l>` and `--load-limit <p>`; `run`, `next`, `check` and `status`
// also `--machines <json>` (the person's machines, design remote-worker D-4), `run` also `--session <id> [--fresh] [--change-sessions] [--cron]`, `next` `[--check-id <job>] [--check-refused] [--check-deleted] [--check-gone]`. `run`, `next` and
// `check` print `devkit-roadmap: <places>` (or `stop`) and then the decision as JSON; exit 0, or 3 with `{ version, error, reply }`. `status` writes nothing; `status --json` is what another machine's probe runs (remote-worker D-6).
//
// The facts of one decision (`decideRoadmap`, `boardOf`):
//   lang, places, stopping, holding, load, limit, hasRoadmap,
//   lines      - `classifyLines` of the roadmap, in file order,
//   actions    - { <id>: the action `change-loop.nextAction` returned } for each open change,
//   inflight   - { <id>: { kind: 'agent' | 'wait', stage, agentType, at } } the stages and waits under way,
//   declared   - { <id>: { state: 'blocked' | 'waiting-for-owner', why, params } } the ends the session declared,
//   announced  - { <id>: <event key> }, starting - [ids], held, asking - the run's bookkeeping,
//   after      - { <id>: <progress key> } the stages that just came back (their `actions` were read with that key), and the
//                `session-start`, `session-found` and `session-refused` keys of a change session the host started, found running or refused,
//                and the `session-model` and `session-model-refused` keys of a switch of its model done or refused,
//   tickets, occupied, queued, waits, cron, check, waitsFor, unpushed - a run that opens every change at its start (ADR 0021): the start tickets, the places held, the
//                changes waiting for one, the wait loops, whether the host offers a session cron, the periodic check ({ id } or { refused }), { <id>: the dependency a
//                plan waits for } and { <id>: 'grill' | 'plan' } what is not on origin yet,
//   changeSessions, startedSessions, coordinator, turn - a run with a session per change (ADR 0014): whether each change runs in a session
//                of its own, { <id>: { at, model?, refused? } } the change sessions started with the model each runs on (stage-models D-6),
//                the coordinating session's id and what started this turn (`typed` for a message the owner typed, else `event`),
//   stageModels - { <id>: { stage, models, stages, root } } for each change session recorded with a model (and the one just reported started):
//                the stage its change is at, the table of its stage models, its script's stage order and its checkout (`collectRoadmap`'s
//                `models` option); `stepDownOf` turns it into the one switch a session may get, down only,
//   wheres     - { <id>: where it stopped } and phaseTotals - { <id>: phases of tasks.md } for the lines that name them,
//   unfinished - [{ id, where }] every unfinished change, for the board's "outside the roadmap".

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { loadavg as osLoadavg, cpus as osCpus } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { findRoot, readRoadmap, changeFlow, changeSchemaAt, readFlow, roadmapRunOf, runOf, isChangeId, firstMessageOf, startedTaskOf, parseStageHeader, START_LINE, ENTRY_SKILL, namesEntrySkill, sessionTranscript, handOffsOf, typedSince, STAGE_OF } from './guard.mjs';
import { collectFlow, computeFlow, makeOpenspec, spendBlock } from './flow-check.mjs';
import { locateChange, readPhases } from './deliver-check.mjs';
import {
  render, LoopUsageError, LoopRefusal, normalizeLang, nextAction, baseFetches, unfinished, archivedOnDefault, whereOf, waitLoop, readDevkitSettings, sessionTitle, changeState, runFactsOf, PLAN_NOT_HELD, partOfStage, isPlanStage,
  HOOKS_DIR, PACKS, locate, cleanOf, runFilePath, readRun, emptyRun, OUTLIVES, isObject, GATE_OF_WHY, DECLARED, gateOf, allow, refuseOnce, subagentStopFor, handOffFor, readStdin, withLockFile, HELD_TEXT,
  loopOutput, exitCodeOf, mainRoot, defaultBase, tryGit, stopDecision, hasTriageSection, remoteClaims, thisMachine, MACHINE_NAME, READINESS_KEY, unplacedAction,
  modelsOf, MODEL_STAGES, MODEL_VALUES, SESSION_RUN_STAGES, cheaper, strongest,
} from './change-loop.mjs';
import { readiness, liveRuns, startRun, pauseRun, resumeRun, cancelRun, pendingRequests, CHANGE_LOOP } from './compozy-driver.mjs';

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

// ---------------------------------------------------------------- the person's machines (remote-worker D-4)

// The `machines` setting, a JSON list of { host, folder, places }: { machines } or { error: { key, params } }. Unset, empty, `[]` and a
// placeholder never substituted are no machines. The first problem of an entry wins; a host named twice is refused.
export function parseMachines(text) {
  const raw = text === undefined || text === null ? '' : String(text).trim();
  if (raw === '' || raw.startsWith('${')) return { machines: [] };
  let list;
  try { list = JSON.parse(raw); } catch { return { error: { key: 'machines-unreadable', params: {} } }; }
  if (!Array.isArray(list)) return { error: { key: 'machines-unreadable', params: {} } };
  const machines = [];
  for (const [index, entry] of list.entries()) {
    const host = isObject(entry) && typeof entry.host === 'string' ? entry.host : null;
    const named = host ?? `#${index + 1}`;
    const problem = (field) => ({ error: { key: 'machine-incomplete', params: { entry: named, field } } });
    if (host === null || !MACHINE_NAME.test(host)) return problem('host');
    if (typeof entry.folder !== 'string' || !entry.folder.startsWith('/')) return problem('folder');
    if (!Number.isInteger(entry.places) || entry.places < 1 || entry.places > 99) return problem('places');
    if (machines.some((m) => m.host === host)) return { error: { key: 'machine-duplicate', params: { entry: host } } };
    machines.push({ host, folder: entry.folder, places: entry.places });
  }
  return { machines };
}

// ---------------------------------------------------------------- asking another machine (remote-worker D-6)

const PROBE_FILE = join(HOOKS_DIR, 'machine-probe.mjs');
const ASK_TIMEOUT_MS = { state: 20_000, checkout: 120_000 };
const shellWord = (word) => (/^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`);

// The real `ssh`: no prompt, five seconds to connect; the words go through the other machine's shell, so each is quoted.
function realSsh(host, argv, { input, timeout }) {
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', host, ...argv.map(shellWord)], { input, timeout, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr || (r.error ? r.error.message : '') };
}

// Sends the probe to `machine` and runs `verb` there: { ok: true, data } for one JSON object with `version` 1 and no `error`, else
// { ok: false, error } (the reason). `ssh(host, argv, { input, timeout })` returns { status, stdout, stderr }; tests inject it.
export function askMachine(machine, verb, args, { ssh = realSsh } = {}) {
  let r;
  try { r = ssh(machine.host, ['node', '--input-type=module', '-', verb, ...args], { input: readFileSync(PROBE_FILE, 'utf8'), timeout: ASK_TIMEOUT_MS[verb] ?? 20_000 }); } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  let data = null;
  try { data = JSON.parse(r.stdout); } catch { /* not JSON: the exit status and standard error say why */ }
  const valid = isObject(data) && data.version === 1;
  if (r.status === 0 && valid && data.error === undefined) return { ok: true, data };
  return { ok: false, error: valid && typeof data.error === 'string' ? data.error : (String(r.stderr ?? '').split('\n')[0] || `exit ${r.status}`) };
}

// ---------------------------------------------------------------- gates and the previous script (D-12, D-4)

// True when the action says the change began under the previous script (the end blocked, why previous-script).
export const isPrevious = (action) => action?.kind === 'end' && action.end?.state === 'blocked' && action.end?.why === 'previous-script';

// ---------------------------------------------------------------- the lines of the roadmap (D-4)

// Each line of the roadmap in its class, in file order (an id counts at its first line). `rounds` is guard.mjs#parseRoadmap's
// result; `archived` the ids archived on the default branch; `open` the ids that are open in some checkout; `previous` the open
// ones on the previous script; `declared` the ends the session declared. First match wins:
//   archived, archived-unticked, ticked, previous, open, elsewhere (a claim on `origin`, its change open on another machine: `elsewhere` is
//   a Map of id to claim, and the line carries the claim's `machine`), blocked, ready, waiting (with `waitsFor`, the first dependency not archived).
export function classifyLines(rounds, { archived, open, previous, declared, elsewhere }) {
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
      else if (elsewhere?.has(item.id)) { line.cls = 'elsewhere'; line.machine = elsewhere.get(item.id).machine ?? null; }
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
// a session per change, `own` (the change runs in a session of its own; its action only when it was read). A line open on another
// machine is `remote` (with its `machine` and, when that machine answered, its `where` and `waitsForPlace`): it fills no place of this run.
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
    if (line.cls === 'elsewhere') {
      const known = f.machines?.find((m) => m.host === line.machine)?.changes?.find((c) => c.id === id);
      entries.push({ id, state: 'remote', machine: line.machine ?? null, where: known?.where || null, waitsForPlace: Boolean(known?.waitsForPlace), line });
      continue;
    }
    if (line.cls !== 'open') continue;
    const action = f.actions?.[id] ?? null;
    const d = f.declared?.[id];
    // A change in a session of its own (ADR 0014): recorded as started, or just reported started by this call.
    const claimed = Boolean(f.tickets?.[id]?.claimedBy); // a session that claimed the run's ticket is the change's own
    if (f.changeSessions && !d && (f.startedSessions?.[id] || isSessionStart(f.after?.[id]) || claimed)) { entries.push({ id, state: 'own', action, line }); continue; }
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
    + 'which started this one: in the desktop app every change of a roadmap run has a session of its own (ADR 0014, ADR 0021). '
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
      ...(a.model ? { model: a.model } : {}), // the model of the stage the change is at (stage-models D-6)
    },
  };
}

// The `session-start` action of a change placed on another machine: the exact input of the start tool (on that machine's SSH connection, in the
// worktree `checkout` makes there), and the command that makes the worktree first (remote-worker D-8).
function remoteSessionStartOf(e, machine, f, lang) {
  const cwd = `${machine.folder.replace(/\/+$/, '')}/.claude/worktrees/${e.id}`;
  const title = sessionTitle('❓', e.id);
  return {
    change: e.id, kind: 'session-start', machine: machine.host, cwd, title, progressKey: 'session-start',
    checkout: ['node', join(HOOKS_DIR, 'roadmap-loop.mjs'), 'checkout', '--change', e.id, '--machines', f.machinesText ?? '', '--lang', lang],
    input: {
      initiation: 'user_asked', context: 'fresh', title, name: sessionName(e.id), cwd, use_worktree: false,
      prompt: `/devkit-openspec:devkit change ${e.id}`,
      background: sessionBackground({ id: e.id, root: cwd, branch: e.id, coordinator: f.coordinator, lang }),
      target: 'ssh', host: machine.host,
    },
  };
}
const requestOf = (line) => [line.text, line.notes].filter(Boolean).join('\n') || line.id;

// The model a change session is switched to, or null for no switch (ADR 0023 decision 4 and the owner's floor of 2026-11-23, stage-models
// D-6). The one place that says whether a session is switched and to what. `current` is the model the run recorded for the session,
// `stage` the stage its change is at, `models` the table of the change, `stages` its script's stage order and `refused` the switch the
// host refused. A session never steps below the strongest model among the stage it is at and the session-run stages still ahead
// (the stage itself included; every stage of the script when `stage` is not one of them), and it only ever steps down.
export function stepDownOf({ current, stage, models, stages, refused }) {
  if (typeof stage !== 'string' || !MODEL_VALUES.includes(models?.[stage])) return null;
  const at = stages.indexOf(stage);
  const ahead = (at < 0 ? stages : stages.slice(at)).filter((s) => SESSION_RUN_STAGES.includes(s));
  const floor = strongest([models[stage], ...ahead.map((s) => models[s])]);
  return cheaper(floor, current) && refused !== floor ? floor : null;
}

// The model the start of a change session carries, from the stage its change is at: the table's model of that stage, when it is one.
const startModelOf = (sm) => (MODEL_VALUES.includes(sm?.models?.[sm.stage]) ? sm.models[sm.stage] : undefined);

// The periodic check of a run (D-9): about every thirty minutes, at minutes the host's other schedules rarely use, with a prompt that is no typed command.
const CHECK_CRON = '13,43 * * * *';
export function checkPrompt(lang, limit, machinesText = '') {
  const machines = machinesText === '' ? '' : ` --machines ${shellWord(machinesText)}`; // the person's machines setting, as the typed calls pass it (remote-worker D-4)
  return `devkit-roadmap-check: the periodic check of this roadmap run, started by its schedule and not typed by the owner. Run \`node ${join(HOOKS_DIR, 'roadmap-loop.mjs')} check --lang ${normalizeLang(lang)} --load-limit ${limit}${machines}\` `
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
  const placed = entries.filter((e) => e.state !== 'archived' && e.state !== 'remote'); // a change open on another machine fills no place here
  const open = placed.map((e) => e.id);
  const free = places - open.length;
  const lineOf = (id) => f.lines.find((l) => l.id === id);
  const machinesOn = (f.machines?.length ?? 0) > 0;
  const machineOf = (host) => f.machines?.find((m) => m.host === host);
  const remote = entries.filter((e) => e.state === 'remote');
  // The changes this run opened for another machine: the record of the run file, and the start the previous call handed that is claimed by a
  // listed machine now (D-8).
  const handed = machinesOn ? remote.filter((e) => (f.starting ?? []).includes(e.id) && machineOf(e.machine) && !f.placed?.[e.id]) : [];
  const placedIds = new Set([...Object.keys(f.placed ?? {}), ...handed.map((e) => e.id)]);

  // The actions of the changes that are open, then the starts or the hold.
  let actions = [];
  if (!stopping) {
    for (const e of entries) {
      if (sessionMode) { // a change's own session hands its stages, carries out its steps and waits on GitHub (D-3)
        const machine = e.state === 'remote' ? machineOf(e.machine) : null;
        if (machine) {
          if (machine.answered && placedIds.has(e.id) && !f.startedSessions?.[e.id] && f.after?.[e.id] !== 'session-start') actions.push(remoteSessionStartOf(e, machine, f, lang));
        } else if (e.state !== 'own' && e.state !== 'archived' && e.state !== 'remote' && !e.declared) actions.push(sessionStartOf(e, f, lang));
      } else if (e.state === 'agent' || e.state === 'session') actions.push({ ...e.action, change: e.id });
      else if (e.state === 'wait') actions.push({ ...e.action, change: e.id, kind: 'wait', progressKey: waitKey(e.action) });
    }
  }
  const ready = f.lines.filter((l) => l.cls === 'ready');
  const loaded = f.load >= f.limit && !f.startAnyway;
  const startable = !stopping && free > 0 && ready.length > 0;
  // In a run with a session per change every pending line opens, whatever the number, the load and the dependencies; the load holds a place, not an opening (D-2).
  const pending = sessionMode ? (stopping ? [] : f.lines.filter((l) => l.cls === 'ready' || l.cls === 'waiting')) : ready;
  let holdNow = !sessionMode && startable && loaded;
  let wanted = sessionMode ? pending : (startable && !loaded ? ready.slice(0, free) : []);
  // With the machines setting set a line goes to the machine with the fewest open changes, this one first on a tie; this machine is not a
  // candidate while loaded, a listed one only when it answered and the host starts a session there; a start is held only when no machine is a
  // candidate (remote-worker D-7). The machines setting is where the load picks the machine, so it also holds an opening of a run with a session
  // per change when no machine can take it; the lines waiting for a dependency open with the ready ones (D-2).
  const placement = new Map();
  if (machinesOn) {
    const openOn = (name) => remote.filter((e) => e.machine === name).length;
    const counts = new Map([[f.thisMachine, placed.length + openOn(f.thisMachine)]]);
    const candidates = loaded ? [] : [{ machine: f.thisMachine, remote: false, places: 'run' }];
    for (const m of f.machines) {
      counts.set(m.host, openOn(m.host));
      if (sessionMode && m.answered) candidates.push({ machine: m.host, remote: true, places: m.places });
    }
    holdNow = !stopping && ready.length > 0 && candidates.length === 0;
    wanted = !stopping && candidates.length > 0 ? (sessionMode ? pending : ready) : [];
    for (const l of wanted) {
      const target = candidates.reduce((best, c) => (counts.get(c.machine) < counts.get(best.machine) ? c : best));
      counts.set(target.machine, counts.get(target.machine) + 1);
      placement.set(l.id, target);
    }
  }
  // On a turn nobody typed every start and session start is taken out: a line says it starts at the owner's next message (D-6).
  const withheld = withhold ? [...actions.map((a) => a.change), ...wanted.map((l) => l.id)] : [];
  if (withhold) actions = [];
  const starts = withhold ? [] : wanted;
  for (const l of starts) actions.push({ change: l.id, kind: 'start', request: requestOf(l), progressKey: 'start', ...placement.get(l.id) });
  if (holdNow && !f.holding) actions.push({ change: ready[0].id, kind: 'hold', load: f.load, limit: f.limit, progressKey: 'hold' });

  // The switch of a change session's model (stage-models D-6), after the withholding so that it is carried out on any turn: down only,
  // never while stopping, never for a session reported started in this call or recorded with no model. A reported switch or refusal of it
  // is what the run records; the target is the one the facts give now.
  const sessionModels = [];
  const modelsRefused = [];
  if (sessionMode) {
    for (const e of entries) {
      const sm = f.stageModels?.[e.id];
      const record = f.startedSessions?.[e.id];
      if (e.state !== 'own' || !sm || !record?.model || isSessionStart(f.after?.[e.id])) continue;
      const to = stepDownOf({ ...sm, current: record.model, refused: record.refused });
      if (to === null) continue;
      const key = f.after?.[e.id];
      if (key === 'session-model') sessionModels.push({ id: e.id, model: to });
      else if (key === 'session-model-refused') modelsRefused.push({ id: e.id, model: to });
      else if (!stopping) actions.push({ change: e.id, kind: 'session-model', cwd: sm.root, model: to, progressKey: 'session-model' });
    }
  }

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
  const sessionsStarted = sessionMode ? entries.filter((e) => e.state === 'own' && isSessionStart(f.after?.[e.id])) : [];
  const sessionsNew = sessionsStarted.filter((e) => announced[e.id] !== 'session');
  let counted = open.length - begun.length - resumes.length - sessionsNew.length;
  for (const e of begun) emit(e.id, 'started', 'roadmap-started', { id: e.id, open: ++counted, places });
  for (const e of resumes) emit(e.id, 'resumed', 'roadmap-resumed', { id: e.id, where: f.wheres?.[e.id] ?? '', open: ++counted, places });
  for (const e of sessionsNew) emit(e.id, 'session', 'roadmap-session-opened', { id: e.id });
  const remoteStarted = sessionMode ? remote.filter((e) => f.after?.[e.id] === 'session-start') : [];
  for (const e of remoteStarted) emit(e.id, 'session', 'roadmap-session-started-on', { id: e.id, machine: e.machine });
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
    const far = remote.find((e) => e.id === id);
    if (refused.has(id) || announced[id] === 'waits-refused') emit(id, 'waits-refused', 'roadmap-waits-refused', { id });
    else if (far) emit(id, 'waits-turn', 'roadmap-waits-turn-on', { id, machine: far.machine });
    else emit(id, 'waits-turn', 'roadmap-waits-turn', { id });
  }
  // A listed machine that does not answer is said once while it stays silent; the record goes when it answers (D-10).
  for (const m of f.machines ?? []) {
    if (m.answered) delete announced[`machine:${m.host}`];
    else emit(`machine:${m.host}`, 'silent', 'roadmap-machine-silent', { machine: m.host });
  }
  // A freed place tells the first change waiting for one on each machine to go on, once per state of that machine's places (D-10). Only in
  // a run with a session per change: the message goes to that change's session, and it starts no session, so no turn rule holds it back.
  if (sessionMode && machinesOn && !stopping) {
    const waitingOn = (name) => entries.filter((e) => (name === f.thisMachine
      ? e.state === 'own' && e.action?.kind === 'end' && e.action.end?.why === 'no-place'
      : e.state === 'remote' && e.machine === name && e.waitsForPlace));
    for (const name of [f.thisMachine, ...f.machines.map((m) => m.host)]) {
      const c = waitingOn(name)[0];
      if (!c) continue;
      const claimed = f.claims?.[c.id]?.places;
      const total = claimed === 'run' ? places : claimed;
      if (!Number.isInteger(total)) continue;
      const held = Object.values(f.claims ?? {}).filter((x) => x.machine === name && x.placed === true).length;
      if (total - held <= 0) { if (String(announced[c.id]).startsWith('woken:')) delete announced[c.id]; continue; }
      if (announced[c.id] === `woken:${held}`) continue;
      actions.push({ change: c.id, kind: 'wake', machine: name, message: `/devkit-openspec:devkit change ${c.id}`, progressKey: 'wake' });
      emit(c.id, `woken:${held}`, 'roadmap-woken', { id: c.id, machine: name });
    }
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
  const underWay = sessionMode && !stopping ? entries.filter((e) => e.state === 'own' || (e.state === 'remote' && machineOf(e.machine))).length : 0;
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
    if (f.cron && !f.check) extras.push({ change: null, kind: 'schedule-check', input: { cron: CHECK_CRON, prompt: checkPrompt(lang, f.limit, f.machinesText ?? ''), recurring: true }, progressKey: 'schedule-check' });
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
      clearDeclared: f.lines.filter((l) => l.cls === 'elsewhere' && f.declared?.[l.id]).map((l) => l.id),
      sessionsStarted: [...sessionsStarted, ...remoteStarted].map((e) => ({ id: e.id, model: f.after?.[e.id] === 'session-start' ? startModelOf(f.stageModels?.[e.id]) : undefined })),
      sessionModels, modelsRefused, turn: mayStart ? 'typed' : 'event',
      openLines: f.lines.filter((l) => l.cls === 'open' || l.cls === 'elsewhere').map((l) => l.id), elsewhere: remote.map((e) => e.id),
      archivedLines: f.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls)).map((l) => l.id),
      placed: Object.fromEntries(handed.map((e) => [e.id, e.machine])),
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
  const placed = entries.filter((e) => e.state !== 'archived' && e.state !== 'remote');
  const remote = entries.filter((e) => e.state === 'remote');
  const machinesOn = (f.machines?.length ?? 0) > 0;
  const showMachine = machinesOn || remote.length > 0;
  const free = f.places - placed.length;
  const ready = f.lines.filter((l) => l.cls === 'ready');
  // With machines set a ready line is held only when no machine can take it: this one is loaded and none of the others answers (remote-worker D-5, D-7).
  // In a run with a session per change, every pending line opens and no start is held; a line left for the owner's next message says so (D-2, D-6, D-11).
  const sessionMode = Boolean(f.changeSessions);
  const noMachine = machinesOn && ready.length > 0 && f.load >= f.limit && !(f.changeSessions && f.machines.some((m) => m.answered));
  const held = machinesOn ? noMachine : !sessionMode && free > 0 && ready.length > 0 && f.load >= f.limit;
  const takes = new Set(ready.slice(0, Math.max(free, 0)).map((l) => l.id));
  const waitsTurn = (id) => sessionMode && ['waits-turn', 'waits-refused'].includes(f.announced?.[id]);
  const readyKey = (id) => {
    if (machinesOn) return noMachine ? 'queue.no-machine' : waitsTurn(id) ? 'queue.turn' : 'queue.ready';
    return sessionMode ? (waitsTurn(id) ? 'queue.turn' : 'queue.ready') : !takes.has(id) ? 'queue.place' : held ? 'queue.load' : 'queue.ready';
  };
  const entryOf = (id) => placed.find((e) => e.id === id);
  // The row of an open change names its machine whenever another machine is listed or holds a change (D-5).
  const tagged = (e, text) => (showMachine ? `${text} · ${e.state === 'remote' ? (e.machine ?? say('machine.unknown')) : f.thisMachine}` : text);
  const rows = { owner: [], running: [], blocked: [], queue: [], outside: [] };
  for (const l of f.lines) {
    const e = entryOf(l.id);
    const far = remote.find((r) => r.id === l.id);
    if (far) rows.running.push({ id: l.id, text: tagged(far, remoteText(far, f, say)) });
    else if (e) { const [block, text] = stateRow(e, f, say, lang); rows[block].push({ id: l.id, text: tagged(e, text) }); }
    else if (l.cls === 'ready') rows.queue.push({ id: l.id, text: say(readyKey(l.id)) });
    else if (l.cls === 'waiting') rows.queue.push({ id: l.id, text: waitsTurn(l.id) ? say('queue.turn') : say('queue.after', { after: l.waitsFor }) });
    else if (l.cls === 'archived-unticked') rows.outside.push({ id: l.id, text: say('outside.unticked') });
    else if (l.cls === 'ticked') rows.outside.push({ id: l.id, text: say('outside.ticked') });
    else if (l.cls === 'previous') rows.outside.push({ id: l.id, text: say('outside.previous') });
  }
  const onRoadmap = new Set(f.lines.map((l) => l.id));
  for (const u of unfinished) if (!onRoadmap.has(u.id)) rows.outside.push({ id: u.id, text: say('outside.other', { where: u.where }) });

  const queued = f.lines.filter((l) => l.cls === 'ready' || l.cls === 'waiting').length;
  const archivedCount = f.lines.filter((l) => ARCHIVED_CLASSES.includes(l.cls)).length;
  const count = machinesOn
    ? say('status-count-machines', { open: placed.length + remote.length, queue: queued, archived: archivedCount })
    : say('status-count', { open: placed.length, places: f.places, queue: queued, archived: archivedCount });
  const intro = [count, ...(f.claimsReadable === false ? [say('status-claims-unreadable')] : []), ...(held ? [say('status-held', { load: f.load, limit: f.limit })] : [])];
  // This machine first, then each listed one: the places its changes took (a claim whose branch holds the approved plan) and its open changes.
  const takenBy = (name) => Object.values(f.claims ?? {}).filter((c) => c.machine === name && c.placed === true).length;
  // In a run with a session per change this machine's places are the run's own count (roadmap-sessions-upfront D-18): the changes in `occupied` (the ones on the
  // run's ticket) and the placed claims of this machine whose ticket no session claimed, each change once.
  const takenHere = () => {
    if (!f.changeSessions) return takenBy(f.thisMachine);
    const held = new Set(Object.keys(f.occupied ?? {}));
    for (const [id, c] of Object.entries(f.claims ?? {})) if (c.machine === f.thisMachine && c.placed === true && !f.tickets?.[id]?.claimedBy) held.add(id);
    return held.size;
  };
  const openOn = (name) => remote.filter((e) => e.machine === name).length;
  const machineRows = machinesOn ? [
    { id: say('machine.this', { name: f.thisMachine }), text: say('machine.row', { taken: takenHere(), places: f.places, open: placed.length + openOn(f.thisMachine) }) },
    ...f.machines.map((m) => ({ id: m.name, text: m.answered ? say('machine.row', { taken: takenBy(m.host), places: m.places, open: openOn(m.host) }) : say('machine.no-answer') })),
  ] : [];
  const blocks = [['status-machines', machineRows], ['status-owner', rows.owner], ['status-running', rows.running], ['status-blocked', rows.blocked], ['status-queue', rows.queue], ['status-outside', rows.outside]]
    .filter(([, list]) => list.length > 0);
  const width = Math.max(0, ...blocks.flatMap(([, list]) => list.map((r) => r.id.length))) + 3;
  const out = [...intro];
  if (blocks.length) out.push('');
  for (const [key, list] of blocks) out.push(say(key), ...list.map((r) => `  ${r.id.padEnd(width)}${r.text}`));
  return out.join('\n');
}

// The row of a change open on another machine: its stage there when that machine answered, "no answer" when a listed machine did not,
// else that it is open there.
function remoteText(e, f, say) {
  const listed = f.machines?.find((m) => m.host === e.machine);
  if (listed && !listed.answered) return say('machine.no-answer');
  if (listed && e.where) return e.where;
  return say('remote.open', { machine: e.machine ?? say('machine.unknown') });
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

// The `--after` keys of a step the session carried out that is no stage: a change session the host started, found running or refused, a switch of its
// model done or refused (ADR 0014, stage-models D-6), the push of a grill or a plan, and the archive of a change's session or its refusal (ADR 0021):
// no stage came back.
const SESSION_KEYS = ['session-start', 'session-found', 'session-model', 'session-model-refused', 'session-refused', 'push', 'session-archived', 'session-archive-later'];
// A change session the host just started or found already running: the change runs in a session of its own either way.
const isSessionStart = (key) => key === 'session-start' || key === 'session-found';

// The title of `stage` in the language of the person, from the change's own script; the id when it cannot be read.
export function stageTitleOf(found, stage, lang) {
  try {
    const dir = locateChange(found.root, found.id)?.dir ?? join(found.root, 'openspec', 'changes', found.id);
    return changeFlow(found.root, dir).flow?.stages.find((s) => s.id === stage)?.title[lang] ?? stage;
  } catch { return stage; }
}

// What the switch of a change session's model reads of the change `found` (an item of `unfinished`): { stage, models, stages, root }, the
// stage its change is at (`null` when the action names none), its table of stage models (lenient: a bad table is ignored whole), its
// script's stage order (every stage of the table when the script cannot be read) and its checkout. Null when the action cannot be read.
function stageModelsOf(start, found, { env, lang, openspec, gh }) {
  try {
    const action = nextAction(start, found.id, { env, lang, openspec, gh });
    const dir = locateChange(found.root, found.id)?.dir ?? join(found.root, 'openspec', 'changes', found.id);
    let stages = null;
    try { stages = changeFlow(found.root, dir).flow?.stages.map((s) => s.id) ?? null; } catch { /* the table's own order answers */ }
    return { stage: action.stage ?? null, models: modelsOf(found.root, dir, { strict: false }), stages: stages ?? [...MODEL_STAGES], root: action.root };
  } catch (e) {
    if (e instanceof LoopUsageError) return null;
    throw e;
  }
}

// Every fact `decideRoadmap` and `boardOf` need, read from the roadmap, the checkouts, the run file and the load. `after` is
// { <id>: <progress key> }; `wheres` is `new` (the open changes never announced), `open` (every open change) or `board` (the
// unfinished changes that are not on the roadmap); `readFlying` also reads the action of a change in flight (the board shows it); `readOwn` (the default) reads
// the action of every open change in a session of its own too, the Stop hook leaving that to the decisions that follow (D-3), unless machines are listed
// (the ones waiting for a place are told, remote-worker D-10).
// `retry` (`run` and `next` only: a lock and the board pass none) reads the session's stage hand-offs once for every change when the
// coordinating session hands the stages, so a failed one is handed again a model up (stage-models D-5). `models` (`run` and `next` only)
// reads, for each change session recorded with a model and the one just reported started, the stage its change is at, its table and its
// script's stage order, so that `decideRoadmap` can switch the session down (`stageModels`, stage-models D-6).
// `fetchBase` is a `baseFetches()` record: given, each change's action fetches the base before it judges (once per record); `status` and the locks leave it out.
export function collectRoadmap(cwd, {
  env = process.env, lang = 'pt-BR', load = 0, limit = DEFAULT_LIMIT, openspec, gh, after = {}, wheres = 'new', readFlying = false, readOwn = true, turn,
  machines = [], machinesText = '', probe = true, ssh, claimsGh, retry = false, models = false, fetchBase = false,
} = {}) {
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
    tickets: run.tickets, occupied: run.occupied, queued: run.queued, waits: run.waits, cron: run.cron, check: run.check,
  };
  // A change in a session of its own: recorded as started, just reported started, or whose session claimed the run's ticket (D-1, D-3).
  const ownOf = (id) => Boolean(run.changeSessions && (run.startedSessions[id] || isSessionStart(after[id]) || run.tickets[id]?.claimedBy));
  if (rounds === null) return { ...common, hasRoadmap: false, lines: [], unfinished: list.map((u) => ({ id: u.id, where: whereFor(u) })) };

  const archived = archivedOnDefault(start, { env, gh });
  const onRoadmap = new Set(rounds.flatMap((r) => r.items.map((i) => i.id)));
  const open = new Set(list.map((u) => u.id));
  const byId = new Map(list.map((u) => [u.id, u]));
  // The branches on `origin` that hold a roadmap line's change: a change not open in this clone is open on another machine (D-5).
  const read = remoteClaims(start, { env, gh: claimsGh ?? gh, ids: [...onRoadmap] });
  const elsewhere = new Map([...read.claims].filter(([id]) => !open.has(id) && !archived.has(id)));
  const asked = machines.map((m) => {
    const answer = probe ? askMachine(m, 'state', [m.folder, l], { ssh }) : { ok: false };
    return { name: m.host, host: m.host, folder: m.folder, places: m.places, answered: answer.ok, changes: answer.ok && Array.isArray(answer.data.changes) ? answer.data.changes : [] };
  });
  // First every open line, to read each one's action (a change in flight or declared is not read: N1 and N2 come first), then
  // the classes again with the changes on the previous script known.
  const actions = {};
  const stageModels = {};
  const previous = new Set();
  let handOffs;
  if (retry && !run.changeSessions) {
    const path = sessionTranscript(env);
    handOffs = path ? handOffsOf(path, typedSince(path)) : undefined;
  }
  for (const line of classifyLines(rounds, { archived, open, previous, declared: run.declared, elsewhere })) {
    if (line.cls !== 'open' || run.declared[line.id]) continue;
    if (run.changeSessions) {
      // The action of a change in a session of its own is read for its gates (D-3) and, for the Stop hook, left unread unless machines are listed (the ones
      // waiting for a place are told, remote-worker D-10); every other open change is read. The stage and the models of a change session recorded with a
      // model are read for the switch of its model (stage-models D-6).
      if (ownOf(line.id) && !readFlying) {
        if (models && (run.startedSessions[line.id]?.model || after[line.id] === 'session-start')) {
          const read = stageModelsOf(start, byId.get(line.id), { env, lang: l, openspec, gh });
          if (read) stageModels[line.id] = read;
        }
        if (!readOwn && machines.length === 0) continue;
      }
    } else if (run.inflight[line.id] && !(line.id in after) && !readFlying) continue;
    const progress = SESSION_KEYS.includes(after[line.id]) ? null : (after[line.id] ?? null); // the session keys are no progress key of a stage
    const action = unplacedAction(start, line.id) ?? nextAction(start, line.id, { env, lang: l, after: progress, openspec, gh, ...(handOffs ? { handOffs } : {}), fetchBase });
    if (isPrevious(action)) previous.add(line.id); else actions[line.id] = action;
  }
  const lines = classifyLines(rounds, { archived, open, previous, declared: run.declared, elsewhere });
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
    ...common, hasRoadmap: true, lines, actions, ...(models ? { stageModels } : {}), machines: asked, thisMachine: thisMachine(), machinesText, placed: run.placed, claims: Object.fromEntries(read.claims), claimsReadable: !read.origin || read.readable,
    inflight: run.inflight, declared: run.declared, announced: run.announced, starting: run.starting,
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
export function readyText(action) {
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
  if (action.kind === 'wake') return `the change ${c} waits for a place that is free now: tell it to go on`;
  return `the start of ${c} is held by the load: watch it with hold`;
}

// `guard.mjs stop` (RS1 to RS5).
export function roadmapStopDecision(input, { env = process.env, run, gh, openspec, load = () => readLoad(), ssh } = {}) {
  try {
    const current = run ?? roadmapRunOf(input);
    if (!current) return allow('no-run');
    if (current.stopping) return allow('stopping'); // RS1
    const cwd = input.cwd ?? process.cwd();
    const { start, file } = strictRunFile(cwd);
    if (readRun(file).stopping) return allow('stopping');
    const lang = normalizeLang(env.CLAUDE_PLUGIN_OPTION_LANGUAGE);
    const limit = limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT);
    // The machines setting is read, but no machine is asked and no claim is read through gh: every listed machine is out of reach here, so
    // nothing only another machine could take refuses the stop (remote-worker D-11). An unreadable setting is no setting.
    const machines = parseMachines(env.CLAUDE_PLUGIN_OPTION_MACHINES).machines ?? [];
    const facts = collectRoadmap(start, { env, lang, load: load(), limit, openspec, gh, wheres: 'none', readOwn: false, machines, probe: false, ssh, claimsGh: OFFLINE_GH });
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
// owner said to start anyway). Returns { claimed, why?, occupied, queued, anyway } as new records: a claim records its place and leaves the queue and the
// permission; a refusal queues it (keeping the time it first queued) with why `place` (no place for it) or `load`.
export function placeDecision({ id, places, occupied, queued, load, limit, anyway = [], now }) {
  const free = places - entriesCount(occupied);
  const mine = queued[id];
  const since = timeOf(mine?.at ?? now);
  const ahead = Object.entries(queued).filter(([other, entry]) => other !== id && timeOf(entry.at) < since).length;
  if (free > ahead && (load < limit || anyway.includes(id))) {
    const rest = { ...queued };
    delete rest[id];
    return { claimed: true, occupied: { ...occupied, [id]: { at: now } }, queued: rest, anyway: anyway.filter((other) => other !== id) };
  }
  const why = free > ahead ? 'load' : 'place';
  return { claimed: false, why, occupied: { ...occupied }, queued: { ...queued, [id]: { at: mine?.at ?? now, why } }, anyway: [...anyway] };
}

// What a change session does next (D-6), pure, first match wins. The facts: id, action (the change loop's), part (of the action's stage in the
// change's script), waitsFor (the first dependency not archived), notInHead (a dependency's archive folder is missing from the branch),
// hasProposal, places, occupied, queued, anyway, load, limit, now, lang. Returns { action, occupied, queued, anyway }: the action to carry out
// (the change loop's, a `held` one that waits, or the `merge-base` step) and the places as they are after it.
export function sessionDecide(f) {
  const a = f.action;
  const lang = normalizeLang(f.lang);
  const say = (key, params) => render(lang, key, { id: f.id, ...params });
  const records = { occupied: { ...f.occupied }, queued: { ...f.queued }, anyway: [...(f.anyway ?? [])] };
  const given = (action) => ({ action, ...records });
  // The held action carries the state changeState derives for the change after this decision (D-11): its title and icon are the state's.
  const held = (why, extra, key, params) => {
    const heldRun = { changeSessions: true, startedSessions: { [f.id]: { at: f.now } }, occupied: records.occupied, queued: records.queued, waitsFor: { [f.id]: f.waitsFor ?? null } };
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
  if (loads && (a.kind === 'agent' || a.kind === 'session') && !records.occupied[f.id]) {
    const r = placeDecision({ id: f.id, places: f.places, occupied: records.occupied, queued: records.queued, load: f.load, limit: f.limit, anyway: records.anyway, now: f.now });
    Object.assign(records, { occupied: r.occupied, queued: r.queued, anyway: r.anyway });
    if (r.claimed) return given(a);
    return r.why === 'place'
      ? held('place', {}, 'session-held-place', { places: entriesCount(r.occupied) })
      : held('load', {}, 'session-held-load', { load: f.load, limit: f.limit });
  }
  if (!loads) { delete records.occupied[f.id]; delete records.queued[f.id]; } // the stage or the archive that leaves the load stages frees the place
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
  const decide = (state) => sessionDecide({ id, action, ...facts, places: state.places, occupied: state.occupied, queued: state.queued, anyway: state.anyway, load, limit, now, lang: l });
  const places = (r) => JSON.stringify([r.occupied, r.queued, r.anyway]);
  const first = decide(run);
  if (!write || places(first) === places(run)) return first.action;
  let result = first;
  updateRun(file, (current) => {
    result = decide(current);
    Object.assign(current, { occupied: result.occupied, queued: result.queued, anyway: result.anyway });
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

// A change no longer open holds no place (D-7): in a run with a session per change, deletes the `occupied` and `queued` entries of every id that is not in
// `openIds`. Its session is gone, so it never reaches the branch of `sessionDecide` that releases the place. `anyway` is not pruned: it gives no place by itself
// and a claim uses it up. A run without a session per change keeps its records as they are. Changes `run` in place.
export function pruneRecords(run, openIds) {
  if (!run.changeSessions) return;
  const open = new Set(openIds);
  for (const key of ['occupied', 'queued']) for (const id of Object.keys(run[key])) if (!open.has(id)) delete run[key][id];
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

const USAGE = 'usage: roadmap-loop.mjs run --lang <l> --load-limit <p> [--machines <json>] --session <id> [--fresh] [--change-sessions] [--cron] (the owner\'s arguments on standard input) | next --lang <l> --load-limit <p> [--machines <json>] [--after <id>=<key>]... [--turn typed|event] [--start-anyway] [--check-id <job>] [--check-refused] [--check-deleted] [--check-gone] '
  + '| status --lang <l> --load-limit <p> [--machines <json>] [--json] | draft --lang <l> | reply <key> --lang <l> [--param name=value]... | wait --change <id> --lang <l> [--interval <seconds>] '
  + '| hold --lang <l> --load-limit <p> [--interval <seconds>] | checkout --change <id> --machines <json> --lang <l> | session-next --change <id> --lang <l> --load-limit <p> [--after <progress key>] '
  + '| session-wait --change <id> --lang <l> --load-limit <p> [--interval <seconds>] [--session <id>] | merge-base --change <id> --lang <l> '
  + '| push --change <id> --what grill|plan --lang <l> | check --lang <l> --load-limit <p> [--machines <json>] [--check-gone] '
  + '| compozy-start --lang <l> --load-limit <p> (the owner\'s arguments on standard input) | compozy-tick --places <n> --load-limit <p> --lang <l> | compozy-state --lang <l>';

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
    for (const id of decision.state.clearDeclared) delete run.declared[id]; // a line open on another machine is no cannot-open end (remote-worker D-5)
    // The change sessions reported started are recorded; a change whose line is neither open nor archived leaves the record (D-3, D-9).
    for (const { id, model } of decision.state.sessionsStarted) run.startedSessions[id] = { at: new Date().toISOString(), ...(model ? { model } : {}) };
    // A switch of a session's model reported done is its new model; one reported refused is remembered, so it is not returned again (stage-models D-6).
    for (const { id, model } of decision.state.sessionModels) if (run.startedSessions[id]) { run.startedSessions[id].model = model; delete run.startedSessions[id].refused; }
    for (const { id, model } of decision.state.modelsRefused) if (run.startedSessions[id]) run.startedSessions[id].refused = model;
    // The changes opened for another machine are recorded; both records leave with the line, unless the claims could not be read (then
    // no line reads as open elsewhere, and nothing is forgotten).
    for (const [id, machine] of Object.entries(decision.state.placed)) run.placed[id] = { machine, at: new Date().toISOString() };
    const forgotten = (id) => facts.claimsReadable === false && id in run.placed;
    const stays = new Set([...decision.state.openLines, ...decision.state.archivedLines]);
    for (const key of ['startedSessions', 'tickets']) for (const id of Object.keys(run[key])) if (!stays.has(id) && !forgotten(id)) delete run[key][id];
    for (const id of Object.keys(run.placed)) if (!decision.state.openLines.includes(id) && !forgotten(id)) delete run.placed[id];
    pruneRecords(run, decision.state.openLines); // a change that left the roadmap, was ticked, archived or moved to the previous script holds no place (D-7)
    // The session of an archived change was archived: its entries leave the record (D-9).
    for (const [id, key] of Object.entries(facts.after ?? {})) if (key === 'session-archived') { delete run.startedSessions[id]; delete run.tickets[id]; }
    tidyWaits(run, decision, facts);
    // Each session start gets a fresh ticket recorded before it is printed; an unclaimed ticket of the same change is replaced, a claimed one never (D-1).
    // A change opened on another machine gets none: that machine's hook cannot read this run file, so its session starts with the typed form (remote-worker D-8).
    for (const a of decision.actions) {
      if (a.kind !== 'session-start' || a.machine) continue;
      const held = run.tickets[a.change];
      if (held?.claimedBy == null) run.tickets[a.change] = { ticket: mintTicket(), at: new Date().toISOString(), claimedBy: null };
      tickets[a.change] = run.tickets[a.change].ticket;
    }
    return run;
  }, { sleep: ctx.lockSleep });
  return { ...decision, actions: decision.actions.map((a) => (a.kind === 'session-start' && tickets[a.change] ? withTicket(a, tickets[a.change]) : a)) };
}

// The machines setting of a command, or the reply that refuses it (nothing is read or written then, D-4).
function machinesOf(opts, lang) {
  const parsed = parseMachines(opts.value['--machines']);
  return parsed.error ? { reply: plain(render(lang, parsed.error.key, parsed.error.params)) } : { machines: parsed.machines, text: opts.value['--machines'] ?? '' };
}

const settingsOf = (ctx, opts) => ({ lang: normalizeLang(opts.value['--lang']), limit: limitOf(opts.value['--load-limit']), load: ctx.load() });

function hasRoadmapFile(start) { return readRoadmap(start) !== null; }

function runCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--session', '--machines'], flags: ['--fresh', '--change-sessions', '--cron'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const listed = machinesOf(opts, lang);
  if (listed.reply) return listed.reply;
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
    else { // U5: the change sessions, their tickets, places, queue and waits, and the changes placed on other machines outlive the session that started them; the session cron and the anyway do not
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
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: word.kind === 'stop' ? 'open' : 'new', turn: 'typed', machines: listed.machines, machinesText: listed.text, ssh: ctx.ssh, retry: true, fetchBase: baseFetches(), models: true }); // `run` is a message the owner typed
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
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--turn', '--check-id', '--machines'], multi: ['--after'], flags: ['--start-anyway', '--check-refused', '--check-deleted', '--check-gone'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const listed = machinesOf(opts, normalizeLang(opts.value['--lang']));
  if (listed.reply) return listed.reply;
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
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, after, wheres: stopping ? 'open' : 'new', turn, machines: listed.machines, machinesText: listed.text, ssh: ctx.ssh, retry: true, models: true, fetchBase: baseFetches() });
  facts.startAnyway = Boolean(opts.flag['--start-anyway']);
  const decision = decide(start, facts, ctx);
  return { code: 0, stdout: `${decisionText(decision)}${decisionJson(decision)}`, stderr: '' };
}

// `status --json` (D-6): what another machine's probe prints, one object with every unfinished change of this clone, its place in words, its
// icon and whether it waits for a place. It reads no roadmap and no run file, probes nothing and writes nothing; the claims are read once.
function statusJson(ctx, opts) {
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const claims = remoteClaims(start, { env: ctx.env, gh: ctx.gh });
  const changes = unfinished(start, { env: ctx.env, gh: ctx.gh }).map((u) => {
    const entry = { id: u.id, where: '', icon: null, waitsForPlace: false };
    try { entry.where = whereOf(u, u.id, { lang, env: ctx.env, openspec: ctx.openspec, gh: ctx.gh }); } catch { /* a change that cannot be read has no place in words */ }
    try {
      const action = nextAction(start, u.id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh, claims });
      entry.icon = action.icon ?? null;
      entry.waitsForPlace = action.kind === 'end' && action.end?.why === 'no-place';
    } catch { /* nor an icon */ }
    return entry;
  });
  return { code: 0, stdout: json({ version: 1, machine: thisMachine(), changes }), stderr: '' };
}

// `checkout` (D-8): makes the worktree of a change placed on another machine, there, from its branch. It names the machine by the claim on
// `origin`, asks nothing else and writes nothing here; a refusal is exit 3 with the `checkout-failed` reply.
function checkoutCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--change', '--lang', '--machines'] });
  if (!opts.value['--change'] || opts.positional.length) throw new LoopUsageError(USAGE);
  const id = changeIdOf('--change', opts.value['--change']);
  const lang = normalizeLang(opts.value['--lang']);
  const listed = machinesOf(opts, lang);
  if (listed.reply) return listed.reply;
  const refuse = (machine, error) => new LoopRefusal('checkout-failed', render(lang, 'checkout-failed', { id, machine: machine ?? '?', error }));
  const claim = remoteClaims(rootOf(ctx.cwd), { env: ctx.env, gh: ctx.gh, ids: [id] }).claims.get(id);
  if (!claim) throw refuse(null, 'no claim of this change is on the remote');
  const machine = listed.machines.find((m) => m.host === claim.machine);
  if (!machine) throw refuse(claim.machine, 'the machines setting does not list it');
  const answer = askMachine(machine, 'checkout', [machine.folder, id], { ssh: ctx.ssh });
  if (!answer.ok) throw refuse(machine.host, answer.error);
  return { code: 0, stdout: json({ version: 1, change: id, machine: machine.host, worktree: answer.data.worktree }), stderr: '' };
}

function statusCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--machines'], flags: ['--json'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  if (opts.flag['--json']) return statusJson(ctx, opts);
  const listed = machinesOf(opts, normalizeLang(opts.value['--lang']));
  if (listed.reply) return listed.reply;
  const { lang, limit, load } = settingsOf(ctx, opts);
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: 'board', readFlying: true, machines: listed.machines, ssh: ctx.ssh });
  // After the board, the spend of each change it lists as open that counted a token (stage-models D-7); with none, the board as it was.
  const start = rootOf(ctx.cwd);
  const open = facts.hasRoadmap === false ? facts.unfinished.map((u) => u.id) : entriesOf(facts).entries.filter((e) => e.state !== 'archived').map((e) => e.id);
  const blocks = [];
  for (const id of open) {
    const lines = spendBlock(locate(start, id).root, id, { lang, env: ctx.env });
    if (lines.length) blocks.push([id, ...lines.map((line) => `  ${line}`)].join('\n'));
  }
  const board = blocks.length ? `${boardOf(facts)}\n\n${blocks.join('\n')}` : boardOf(facts);
  if (readDevkitSettings(start).driver !== 'compozy') return plain(board);
  return plain(`${board}\n${compozyStatusLine(start, lang, ctx)}`);
}

// ---------------------------------------------------------------- the roadmap on CompozyOS (compozy-driver D-7)

const ROADMAP_LOOP = 'devkit-roadmap';
const DONE_CLASSES = [...ARCHIVED_CLASSES, 'ticked'];
const refused = (text) => ({ code: 3, stdout: `${text}\n`, stderr: '' });

// `{ ok: true }`, or `{ ok: false, text }` with the reply of the first failing row of the CompozyOS check (D-2).
function compozyCheck(main, lang, env) {
  const ready = readiness(main, { env });
  return ready.ok ? { ok: true } : { ok: false, text: render(lang, READINESS_KEY[ready.reason], { fix: ready.fix }) };
}

// The line `status` adds on the compozy driver: the pending requests, or the reason CompozyOS cannot be reached.
function compozyStatusLine(start, lang, ctx) {
  const main = mainRoot(start);
  const check = compozyCheck(main, lang, ctx.env);
  if (!check.ok) return check.text;
  try { return render(lang, 'compozy-requests', { n: pendingRequests(main, { env: ctx.env }) }); } catch (e) { if (e instanceof LoopUsageError) return ''; throw e; }
}

// The roadmap's lines in their classes, with the open changes (nothing is on the previous script or declared here: the runs say so).
function compozyLines(start, ctx) {
  const rounds = readRoadmap(start);
  if (rounds === null) throw new LoopRefusal('roadmap-none', render(ctx.lang, 'roadmap-none'));
  const archived = archivedOnDefault(start, { env: ctx.env, gh: ctx.gh });
  const list = unfinished(start, { env: ctx.env, gh: ctx.gh });
  const lines = classifyLines(rounds, { archived, open: new Set(list.map((u) => u.id)), previous: new Set(), declared: {} });
  return { lines, list };
}

// The facts of a tick and of the state: the lines, the ids whose change run is live, the lines that fill a place and the ones that can start.
function compozyFacts(start, main, ctx) {
  const env = cleanOf(ctx.env);
  if (tryGit(main, ['remote']).split('\n').includes('origin')) {
    try { execFileSync('git', ['-C', main, 'fetch', 'origin', '--prune', '--quiet'], { stdio: 'ignore', env }); } catch { /* offline: the local refs answer */ }
  }
  const { lines, list } = compozyLines(start, ctx);
  const live = new Set(liveRuns(main, CHANGE_LOOP, { env: ctx.env }).map((r) => r.inputs.change_id).filter(Boolean));
  const filled = lines.filter((x) => x.cls === 'open' || (live.has(x.id) && !DONE_CLASSES.includes(x.cls)));
  const ready = lines.filter((x) => x.cls === 'ready' && !live.has(x.id));
  return { lines, list, live, filled, ready };
}

// The roadmap's own prefix of an open change: where it stays, one `roadmap-stayed` line each.
function stayedLines(lang, facts, ctx) {
  const byId = new Map(facts.list.map((u) => [u.id, u]));
  return facts.lines.filter((x) => x.cls === 'open').map((x) => {
    let where = '';
    try { where = whereOf(byId.get(x.id), x.id, { lang, env: ctx.env, openspec: ctx.openspec, gh: ctx.gh }); } catch (e) { if (!(e instanceof LoopUsageError)) throw e; }
    return render(lang, 'roadmap-stayed', { id: x.id, where });
  });
}

function compozyStartCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang', '--load-limit'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const word = parseRunInput(ctx.stdin);
  if (word.kind === 'invalid') return plain(render(lang, 'roadmap-invalid', { word: word.word }));
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none'));
  const main = mainRoot(start);
  const check = compozyCheck(main, lang, ctx.env);
  if (!check.ok) return refused(check.text);
  const env = { env: ctx.env };
  for (const run of liveRuns(main, ROADMAP_LOOP, env)) cancelRun(main, run.runId, env);
  const changeRuns = liveRuns(main, CHANGE_LOOP, env);
  if (word.kind === 'stop') {
    const { lines, list } = compozyLines(start, { ...ctx, lang });
    const onRoadmap = new Set(lines.map((x) => x.id));
    for (const run of changeRuns) if (run.status !== 'paused' && onRoadmap.has(run.inputs.change_id)) pauseRun(main, run.runId, env);
    return plain([render(lang, 'roadmap-stopping'), ...stayedLines(lang, { lines, list }, ctx)].join('\n'));
  }
  for (const run of changeRuns) if (run.status === 'paused') resumeRun(main, run.runId, env);
  const { runId, url } = startRun(main, ROADMAP_LOOP, { places: word.places, load_limit: limitOf(opts.value['--load-limit']), lang }, env);
  return plain(render(lang, 'compozy-roadmap-started', { places: word.places, url: url ?? `run ${runId}` }));
}

function compozyTickCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--places', '--load-limit', '--lang'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const places = Number(opts.value['--places']);
  if (!Number.isInteger(places) || places < 1) throw new LoopUsageError(`compozy-tick needs --places, a whole number from 1; ${USAGE}`);
  const limit = limitOf(opts.value['--load-limit']);
  const start = rootOf(ctx.cwd);
  const main = mainRoot(start);
  const check = compozyCheck(main, lang, ctx.env);
  if (!check.ok) return refused(check.text);
  const facts = compozyFacts(start, main, { ...ctx, lang });
  const free = places - facts.filled.length;
  if (free <= 0 || facts.ready.length === 0) return { code: 0, stdout: '', stderr: '' };
  const load = ctx.load();
  if (load > limit) return plain(render(lang, 'roadmap-held', { id: facts.ready[0].id, load, limit }));
  const out = facts.ready.slice(0, free).map((line, i) => {
    startRun(main, CHANGE_LOOP, { change_id: line.id, request: requestOf(line), lang }, { env: ctx.env });
    return render(lang, 'roadmap-started', { id: line.id, open: facts.filled.length + i + 1, places });
  });
  return plain(out.join('\n'));
}

// Exit 0 while something is under way or can start, 10 when every line is archived, 11 when nothing can start and no run is live.
function compozyStateCmd(args, ctx) {
  const opts = parseOpts(args, { values: ['--lang'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const lang = normalizeLang(opts.value['--lang']);
  const start = rootOf(ctx.cwd);
  const main = mainRoot(start);
  const check = compozyCheck(main, lang, ctx.env);
  if (!check.ok) return refused(check.text);
  const facts = compozyFacts(start, main, { ...ctx, lang });
  if (facts.lines.every((x) => DONE_CLASSES.includes(x.cls))) return { code: 10, stdout: '', stderr: '' };
  if (facts.ready.length > 0 || facts.lines.some((x) => facts.live.has(x.id))) return { code: 0, stdout: '', stderr: '' };
  const said = stayedLines(lang, facts, ctx);
  return { code: 11, stdout: said.length ? `${said.join('\n')}\n` : '', stderr: '' };
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
  // The ends a change of the run declares are the `reply` rows of change-loop.mjs's DECLARED; a `declare` row is recorded by
  // `change-loop.mjs declare` only (coordinator-loop-fixes D-1).
  const row = DECLARED[key];
  if (row?.via === 'declare') throw new LoopUsageError(`${key} is recorded with change-loop.mjs declare, never with reply`);
  const text = render(opts.value['--lang'], key, params);
  if (!row) return plain(text);
  const state = row.end;
  if (!params.id) throw new LoopUsageError(`${key} needs --param id=<change>`);
  changeIdOf('--param id', params.id);
  const { id, why, ...rest } = params;
  const declared = state === 'blocked' ? { state, why, params: rest } : { state, why: key, params: { ...rest, gate: row.gate } };
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
    const poll = async () => nextAction(start, id, { env: ctx.env, lang, openspec: ctx.openspec, gh: ctx.gh, fetchBase: baseFetches() });
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
  const opts = parseOpts(args, { values: ['--lang', '--load-limit', '--machines'], flags: ['--check-gone'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const { lang, limit, load } = settingsOf(ctx, opts);
  const listed = machinesOf(opts, lang);
  if (listed.reply) return listed.reply;
  const start = rootOf(ctx.cwd);
  if (!hasRoadmapFile(start)) return plain(render(lang, 'roadmap-none'));
  const file = runFilePath(start);
  const run = recordFlags(start, opts, ctx);
  const facts = collectRoadmap(ctx.cwd, { env: ctx.env, lang, load, limit, openspec: ctx.openspec, gh: ctx.gh, wheres: run.stopping ? 'open' : 'new', turn: 'event', machines: listed.machines, machinesText: listed.text, ssh: ctx.ssh });
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
        const r = placeDecision({ id, places: current.places, occupied: current.occupied, queued: current.queued, load, limit, anyway: current.anyway, now });
        Object.assign(current, { occupied: r.occupied, queued: r.queued, anyway: r.anyway });
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

const contextOf = ({ env = process.env, cwd = process.cwd(), stdin = '', openspec, gh, load, sleep, lockSleep, ssh } = {}) => ({ env, cwd, stdin, openspec, gh, sleep, lockSleep, ssh, load: load ?? (() => readLoad()) });

// Runs the command: { code, stdout, stderr }. `wait` and `hold` sleep, so they run through `runCommand`.
export function main(argv, opts = {}) {
  try {
    const [sub, ...rest] = argv;
    const ctx = contextOf(opts);
    if (sub === 'run') return runCmd(rest, ctx);
    if (sub === 'next') return nextCmd(rest, ctx);
    if (sub === 'status') return statusCmd(rest, ctx);
    if (sub === 'checkout') return checkoutCmd(rest, ctx);
    if (sub === 'draft') return draftCmd(rest, ctx);
    if (sub === 'reply') return replyCmd(rest, ctx);
    if (sub === 'compozy-start') return compozyStartCmd(rest, ctx);
    if (sub === 'compozy-tick') return compozyTickCmd(rest, ctx);
    if (sub === 'compozy-state') return compozyStateCmd(rest, ctx);
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
  runCommand(argv, { stdin: argv[0] === 'run' || argv[0] === 'compozy-start' ? readStdin() : '' }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
