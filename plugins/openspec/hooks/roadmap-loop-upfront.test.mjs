// node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs
// roadmap-coordinator, part 3 of 3 (suite-speed D-11; the others are roadmap-loop.test.mjs and roadmap-loop-followups.test.mjs): the check (waits, places, actions), the second half of the upfront sessions, the remote worker's roadmap side and change-state. What the three parts share is in roadmap-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpFolder } from './test-tmp.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import {
  put, commitAll, git, roundRepo, SET_LOOP as SET, cleanEnvLoop as cleanEnv, agentAct, grillAct, endAct, ownerAct, ROUND, world, OFFLINE, FLAGS,
  roadmapText, projectWith, cmd, doRun, doNext, doStatus, jsonOf, runFileOf, stateOf, putRun, events, pinLine, addOpen,
} from './test-fixtures.mjs';
import * as guardModule from './guard.mjs';
import { render, HOOKS_DIR, GATE_OF_WHY, main as changeMain, openChange, thisMachine } from './change-loop.mjs';
import * as changeLoopModule from './change-loop.mjs';
import * as loopModule from './roadmap-loop.mjs';
import { classifyLines, decideRoadmap, boardOf } from './roadmap-loop.mjs';
import {
  HERE, sessionAct, githubAct, blockedAct, archivedAct, FLYING, say, changesOf, rowAt, inFlight, picture, GUARD, LK_SESSION, lkSandbox, lkAssistant,
  lkRun, lkStopInput, lkAgentInput, BRIEF, PLANNER_TYPE, lkProject, LK_PLAN, LK_ENV, lkOpts, withTmp, recordOf, nothingRecorded, agentOf, lkHook, skillMd,
  sessionSkillMd, sectionOf, deadPid, lockFileOf, AT, START_FIELDS, sessionWorld, stopOf, UP_SESSION, UP_TICKET, upTickets, upEntry, entryOf, labelOf, sd,
  implAct, upChange, approve, doSessionNext, upBase, sessionNextOf, upStopInput, AT2, JOB, gateLine, upPushed, pushesOf, PUSH_OPTS,
} from './roadmap-loop-fixtures.mjs';

const pinFlow = (root, id, flow) => { put(root, { [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${pinLine(flow)}` }); commitAll(root, `${id} follows flow ${flow}`); };

// ---- the check: waits, places, actions (design D-9)

// Invariant (D-13 T-17): a stale or doomed wait loop is stopped, a kept one keeps running, and a change's live wait counts as watching. Layer: check and
// decide. Suite: roadmap-loop. A wait loop is a process whose command line is the run's `roadmap-loop.mjs session-wait` or `wait` (D-9 step 1), so the
// sleeper spawns one; a `stranger()` is a plain process that no wait loop is.
const sleeper = (kind = 'session') => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)', join(HOOKS_DIR, 'roadmap-loop.mjs'), kind === 'github' ? 'wait' : 'session-wait'], { stdio: 'ignore' });
const stranger = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'ignore' });
const alive = (child) => child.exitCode === null && child.signalCode === null;
const exited = (child) => new Promise((resolve) => { if (!alive(child)) return resolve(); const timer = setTimeout(resolve, 5000); return child.once('exit', () => { clearTimeout(timer); resolve(); }); });
const reap = (...children) => { for (const c of children) if (alive(c)) c.kill('SIGKILL'); };
const waitOf = (child, kind = 'session', at = AT, session = 'S-x') => ({ pid: child.pid, kind, at, session });
const doCheck = (cwd, extra = [], opts = {}) => cmd(cwd, ['check', ...FLAGS, ...extra], opts);
const archiveOn = (root, ...ids) => { put(root, Object.fromEntries(ids.map((id) => [`openspec/changes/archive/2026-11-20-${id}/proposal.md`, `# ${id}\n`]))); commitAll(root, `archive ${ids.join(', ')}`); };
const startedIn = (...ids) => ({ startedSessions: Object.fromEntries(ids.map((id) => [id, { at: AT }])), tickets: Object.assign({}, ...ids.map((id) => upTickets(id, { claimedBy: `S-${id}` }))) });

test('upfront AC-14 staleWaits: a wait of a change that is not open is stale', () => {
  const stale = loopModule.staleWaits({ gone: [{ pid: 11, kind: 'session', at: AT }] }, { open: ['a'], archived: [] });
  assert.deepEqual(stale.map((w) => [w.id, w.pid]), [['gone', 11]]);
});

test('upfront AC-14 staleWaits: a wait of an archived change is stale, though its line is open', () => {
  const stale = loopModule.staleWaits({ a: [{ pid: 12, kind: 'github', at: AT }] }, { open: ['a'], archived: ['a'] });
  assert.deepEqual(stale.map((w) => [w.id, w.pid]), [['a', 12]]);
});

test('upfront AC-14 staleWaits: of one kind of one change every wait older than the newest is stale, and another kind is not a duplicate', () => {
  const waits = { a: [{ pid: 1, kind: 'session', at: AT }, { pid: 2, kind: 'session', at: AT2 }, { pid: 3, kind: 'github', at: AT }, { pid: 4, kind: 'session', at: '2026-11-21T09:00:00.000Z' }] };
  const stale = loopModule.staleWaits(waits, { open: new Set(['a']), archived: new Set() });
  assert.deepEqual(stale.map((w) => w.pid).sort(), [1, 4], 'the newest session wait and the github wait stay');
  assert.deepEqual(loopModule.staleWaits({ a: [{ pid: 5, kind: 'session', at: AT }] }, { open: ['a'], archived: [] }), [], 'a lone wait of an open change is kept');
  assert.deepEqual(loopModule.staleWaits({}, { open: [], archived: [] }), []);
});

test('upfront AC-14 check: a stale wait is killed and the newest of each kind kept', async () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] c', '[ ] z'));
  addOpen(root, 'a');
  addOpen(root, 'c');
  archiveOn(root, 'z');
  const [older, newer, other, archived] = [sleeper(), sleeper(), sleeper(), sleeper()];
  const dead = spawnSync(process.execPath, ['-e', '']).pid;
  try {
    putRun(root, {
      changeSessions: true, places: 2, ...startedIn('a', 'c'),
      waits: { a: [waitOf(older), waitOf(newer, 'session', AT2), waitOf(other, 'github')], z: [waitOf(archived)], c: [{ pid: dead, kind: 'session', at: AT, session: 'S-c' }] },
    });
    const r = doCheck(root);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    await Promise.all([exited(older), exited(archived)]);
    assert.deepEqual([alive(older), alive(archived), alive(newer), alive(other)], [false, false, true, true]);
    const waits = stateOf(root).waits;
    assert.deepEqual(waits.a.map((w) => w.pid).sort(), [newer.pid, other.pid].sort());
    assert.deepEqual([waits.z, waits.c], [undefined, undefined], 'an archived change\'s wait and a dead process leave the record');
    assert.ok(events(r.stdout).includes(say('roadmap-check-stopped-waits', { n: 2 })), events(r.stdout).join('|'));
  } finally { reap(older, newer, other, archived); }
});

test('upfront AC-14 check: a freed place goes to the first queued change, and one with no live wait gets its idle line', async () => {
  const root = projectWith(roadmapText('[ ] b', '[ ] c'));
  addOpen(root, 'b');
  addOpen(root, 'c');
  const watcher = sleeper();
  try {
    putRun(root, { changeSessions: true, places: 1, ...startedIn('b', 'c'), queued: { c: { at: AT2, why: 'place' }, b: { at: AT, why: 'place' } }, waits: {} });
    const r = doCheck(root);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.deepEqual([Object.keys(stateOf(root).occupied), Object.keys(stateOf(root).queued)], [['b'], ['c']], 'the first to queue takes the place');
    assert.ok(events(r.stdout).includes(say('roadmap-check-idle', { id: 'b' })), events(r.stdout).join('|'));
    // The same with the change's own wait loop alive: it sees the place at its next poll, and no line asks for a message.
    putRun(root, { changeSessions: true, places: 1, ...startedIn('b', 'c'), queued: { b: { at: AT, why: 'place' } }, waits: { b: [waitOf(watcher, 'session', AT, 'S-b')] } });
    const watched = doCheck(root);
    assert.deepEqual(Object.keys(stateOf(root).occupied), ['b']);
    assert.ok(!events(watched.stdout).includes(say('roadmap-check-idle', { id: 'b' })));
    // A loaded machine hands no place.
    putRun(root, { changeSessions: true, places: 1, ...startedIn('b', 'c'), queued: { b: { at: AT, why: 'place' } } });
    doCheck(root, [], { load: 95 });
    assert.deepEqual([stateOf(root).occupied, stateOf(root).queued.b.why], [{}, 'load']);
  } finally { reap(watcher); }
});

// (T-20, D-13: the change the check gives a triage for, `b`, records flow 2; the others keep their files.)
test('upfront AC-14 check: its actions are only triage, archive-session, push and delete-check, and it starts no session on its event turn', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b', '[ ] e', '[ ] c', '[ ] d'));
  for (const id of ['a', 'b', 'e']) addOpen(root, id, id === 'b' ? 2 : null);
  put(root, { 'openspec/changes/e/requirements.md': '# Requirements\n\n### Answered by triage\n\n1. [scope] q → a (source: `x.md`)\n' });
  archiveOn(root, 'd');
  putRun(root, { changeSessions: true, places: 3, turn: 'typed', ...startedIn('a', 'b', 'e', 'd') });
  const r = doCheck(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const j = jsonOf(r.stdout);
  assert.equal(r.stdout.split('\n')[0], 'devkit-roadmap: 3');
  assert.ok(j.actions.every((a) => ['triage', 'archive-session', 'push', 'delete-check'].includes(a.kind)), j.actions.map((a) => a.kind).join(','));
  assert.deepEqual(j.actions.filter((a) => a.kind === 'triage').map((a) => [a.change, a.root, a.progressKey]), [['b', realpathSync(root), 'triage']], 'a is asked now, e has its triage');
  assert.deepEqual(j.actions.filter((a) => a.kind === 'archive-session').map((a) => a.change), ['d']);
  assert.equal(j.ask.change, 'a');
  assert.ok(events(r.stdout).includes(say('roadmap-waits-turn', { id: 'c' })), 'c starts at the owner\'s next message');
  assert.equal(stateOf(root).turn, 'event', 'the firing is no turn the owner typed');
  assert.equal(typeof stateOf(root).announced.c, 'string');
});

test('upfront AC-14 check: nothing changed prints no line and no end reply', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { changeSessions: true, places: 1, ...startedIn('a') });
  const first = doCheck(root);
  assert.ok(events(first.stdout).includes(gateLine('a', 'grill')), events(first.stdout).join('|'));
  const quiet = doCheck(root);
  assert.equal(quiet.code, 0, quiet.stdout);
  assert.deepEqual(events(quiet.stdout), []);
  const j = jsonOf(quiet.stdout);
  assert.deepEqual([j.end, j.actions, j.lines], [null, [], []]);
});

test('upfront AC-14 decide: an archived line with a recorded session kills its recorded waits, then gives archive-session with its reason until session-archived is reported', async () => {
  const root = projectWith(roadmapText('[ ] z'));
  archiveOn(root, 'z');
  const waiter = sleeper();
  try {
    putRun(root, { changeSessions: true, places: 1, turn: 'typed', ...startedIn('z'), waits: { z: [waitOf(waiter)] } });
    const r = doNext(root, ['--turn', 'typed']);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    await exited(waiter);
    assert.equal(alive(waiter), false, 'the wait loop is stopped before the archive is asked');
    assert.equal(stateOf(root).waits.z, undefined);
    const [a] = jsonOf(r.stdout).actions.filter((x) => x.kind === 'archive-session');
    assert.deepEqual([a.change, a.title, a.input, a.progressKey], ['z', '📦 z', { reason: 'devkit roadmap: z is archived' }, 'session-archived']);
    assert.deepEqual(Object.keys(a.input), ['reason']);
    assert.ok(stateOf(root).tickets.z && stateOf(root).startedSessions.z, 'the entries stay until the session is archived');
    const again = doNext(root, ['--turn', 'typed']);
    assert.equal(jsonOf(again.stdout).actions.filter((x) => x.kind === 'archive-session').length, 1, 'asked again while not reported');
    const done = doNext(root, ['--turn', 'typed', '--after', 'z=session-archived']);
    assert.deepEqual(jsonOf(done.stdout).actions.filter((x) => x.kind === 'archive-session'), []);
    assert.ok(events(done.stdout).includes(say('roadmap-check-session-archived', { id: 'z' })), events(done.stdout).join('|'));
    assert.deepEqual([stateOf(root).tickets.z, stateOf(root).startedSessions.z], [undefined, undefined], 'the entries leave the record');
    assert.deepEqual(jsonOf(doNext(root, ['--turn', 'typed']).stdout).actions.filter((x) => x.kind === 'archive-session'), []);
  } finally { reap(waiter); }
});

test('upfront AC-14 next: --after <id>=session-archive-later keeps the entry, asks no second archive in that decision, says the line once, and a later decision asks again', () => {
  const root = projectWith(roadmapText('[ ] z'));
  archiveOn(root, 'z');
  putRun(root, { changeSessions: true, places: 1, turn: 'typed', ...startedIn('z') });
  const later = doNext(root, ['--turn', 'typed', '--after', 'z=session-archive-later']);
  assert.equal(later.code, 0, later.stdout);
  assert.deepEqual(jsonOf(later.stdout).actions.filter((x) => x.kind === 'archive-session'), []);
  assert.deepEqual(events(later.stdout).filter((l) => l === say('roadmap-check-archive-later', { id: 'z' })), [say('roadmap-check-archive-later', { id: 'z' })]);
  assert.ok(stateOf(root).tickets.z && stateOf(root).startedSessions.z, 'the entry is kept');
  const next = doNext(root, ['--turn', 'typed']);
  assert.equal(jsonOf(next.stdout).actions.filter((x) => x.kind === 'archive-session').length, 1, 'a later decision asks again');
  assert.deepEqual(events(next.stdout).filter((l) => l.includes('not archived yet')), [], 'the line is said once per state');
});

test('upfront AC-15 decide: the end done gives delete-check, archive-session per kept session and stop-own-tasks, and decide kills every recorded wait', async () => {
  const root = projectWith(roadmapText('[ ] y', '[ ] z'));
  archiveOn(root, 'y', 'z');
  const [one, two] = [sleeper(), sleeper()];
  try {
    putRun(root, { changeSessions: true, places: 1, turn: 'typed', cron: true, check: JOB, ...startedIn('y', 'z'), waits: { y: [waitOf(one)], q: [waitOf(two)] } });
    const r = doNext(root, ['--turn', 'typed']);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const j = jsonOf(r.stdout);
    assert.equal(j.end.why, 'done');
    assert.deepEqual(j.actions.map((a) => [a.kind, a.change]), [['delete-check', null], ['archive-session', 'y'], ['archive-session', 'z'], ['stop-own-tasks', null]]);
    assert.deepEqual(j.actions[0].input, { id: 'job-1' });
    await Promise.all([exited(one), exited(two)]);
    assert.deepEqual([alive(one), alive(two)], [false, false]);
    assert.deepEqual(stateOf(root).waits, {});
    const deleted = doNext(root, ['--turn', 'typed', '--check-deleted']);
    assert.equal(stateOf(root).check, null);
    assert.ok(!jsonOf(deleted.stdout).actions.some((a) => a.kind === 'delete-check'));
  } finally { reap(one, two); }
  // A stuck end kills the wait of a change that is still open, too.
  const stuck = projectWith(roadmapText('[ ] a'));
  addOpen(stuck, 'a');
  const open = sleeper();
  try {
    putRun(stuck, { changeSessions: true, places: 1, turn: 'typed', declared: { a: { state: 'blocked', why: 'not-opened', params: {} } }, waits: { a: [waitOf(open)] } });
    const s = doNext(stuck, ['--turn', 'typed']);
    assert.equal(jsonOf(s.stdout).end.why, 'stuck');
    await exited(open);
    assert.equal(alive(open), false);
  } finally { reap(open); }
});

test('upfront AC-15 decide: a stop kills only stale waits and keeps the sessions of changes that go on', async () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] c'));
  addOpen(root, 'a');
  archiveOn(root, 'c');
  const [going, finished] = [sleeper(), sleeper()];
  try {
    putRun(root, { changeSessions: true, places: 2, turn: 'typed', check: JOB, ...startedIn('a', 'c'), waits: { a: [waitOf(going)], c: [waitOf(finished)] } });
    const r = doRun(root, 'stop');
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const j = jsonOf(r.stdout);
    assert.equal(j.end.why, 'stopped');
    assert.deepEqual(j.actions.map((a) => [a.kind, a.change]), [['delete-check', null], ['archive-session', 'c']], 'no archive of a, and no task of a stopped');
    await exited(finished);
    assert.deepEqual([alive(going), alive(finished)], [true, false]);
    assert.deepEqual(Object.keys(stateOf(root).waits), ['a']);
  } finally { reap(going, finished); }
});

test('upfront AC-15 lock stop: a cleanup action left refuses the end of the turn once', () => {
  const root = projectWith(roadmapText('[ ] z'));
  archiveOn(root, 'z');
  putRun(root, { changeSessions: true, places: 1, turn: 'typed', cron: true, check: JOB, ...startedIn('z') });
  const transcript = lkRun(1);
  withTmp((tmp) => {
    const first = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([first.decision, first.why], ['refuse', 'stage-ready']);
    assert.match(first.reason, /periodic check|archive/i, first.reason);
    assert.ok(recordOf(tmp));
    assert.equal(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).decision, 'allow', 'once per state');
  });
});

test('upfront AC-9 next: start anyway records the changes queued by the load now, and a change queued later is held again', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { changeSessions: true, places: 1, turn: 'typed', queued: { b: { at: AT, why: 'load' }, c: { at: AT, why: 'place' } } });
  const r = doNext(root, ['--turn', 'typed', '--start-anyway']);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(stateOf(root).anyway, ['b'], 'only what the load holds, at that moment');
  const later = loopModule.placeDecision({ id: 'd', places: 1, occupied: {}, queued: {}, load: 95, limit: 80, anyway: stateOf(root).anyway, now: AT });
  assert.deepEqual([later.claimed, later.why], [false, 'load'], 'd, queued later, is held again');
  const claimed = loopModule.placeDecision({ id: 'b', places: 1, occupied: {}, queued: { b: { at: AT, why: 'load' } }, load: 95, limit: 80, anyway: stateOf(root).anyway, now: AT2 });
  assert.deepEqual([claimed.claimed, claimed.anyway], [true, []], 'b takes its place despite the load, once');
  const plain = projectWith(roadmapText('[ ] a'));
  putRun(plain, { places: 1, turn: 'typed' });
  doNext(plain, ['--turn', 'typed', '--start-anyway']);
  assert.deepEqual(stateOf(plain).anyway, [], 'a run without a session per change records no permission');
});

test('upfront AC-13 skill: the periodic check names CronCreate, CronList, CronDelete, archive_session and TaskStop, re-creates a missing check, and approves nothing', () => {
  const md = skillMd();
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  const first = roadmap.indexOf('### A session per change');
  const second = roadmap.indexOf('### Every change in this session');
  const one = roadmap.slice(roadmap.indexOf('1. Run the call below'), first);
  assert.ok(one.includes('select:CronCreate'), 'step 1 loads the cron tool before run');
  assert.ok(one.includes('`--cron`'), 'and adds the flag when it loads');
  const part = roadmap.slice(first, second);
  for (const text of [
    'select:CronList', '`CronList`', '`--check-gone`', '`CronCreate` with the action\'s `input` exactly as given', '--check-id <job id>', '`--check-refused`', '`CronDelete` with `{ id }`', '`--check-deleted`',
    'select:mcp__ccd_session_mgmt__archive_session', '`mcp__ccd_session_mgmt__archive_session` with `{ session_id, reason }`', '--after <id>=session-archived', '--after <id>=session-archive-later',
    '`TaskStop`', '`push`', '`schedule-check`', '`delete-check`', '`archive-session`', '`stop-own-tasks`', '`triage`',
  ]) assert.ok(part.includes(text), `the part says ${text}`);
  const check = roadmap.slice(roadmap.indexOf('### The periodic check'));
  assert.ok(check.startsWith('### The periodic check'), 'the subsection exists');
  for (const text of ['`devkit-roadmap-check:`', 'roadmap-loop.mjs check --lang ${user_config.language} --load-limit ${user_config.load_limit}', '`CronList`', '`--check-gone`', '`schedule-check`', 'a job already gone is no error', 'ends the turn with no message']) {
    assert.ok(check.includes(text), `the subsection says ${text}`);
  }
  assert.match(check, /write(s)? no `approval\.md` and no retro answer/);
  assert.match(check, /hand(s)? no stage/);
  assert.match(check, /start(s)? no session/);
  const never = md.slice(md.indexOf('## Never'));
  assert.ok(never.includes('Create a cron or any scheduled wake-up, except the one periodic check of a roadmap run that `roadmap-loop.mjs` asks for, which only the run\'s end deletes.'));
  // The one message tool is remote-worker's `wake` item (a change waiting for a place on its machine, told to go on); the check sends no message of its own.
  const wakeItem = md.split('\n').find((l) => l.startsWith('- `wake`:')) ?? '';
  assert.doesNotMatch(md.replace(wakeItem, ''), /wake_when_done|SendMessage/, 'no wake-up field and no message tool outside the wake item');
  assert.ok(check.includes('`wake`') && !/SendMessage/.test(check), 'the check carries out a wake as the part above says, and names no message tool itself');
});

test('upfront AC-16 skill: no section before the Roadmap names a scheduling tool', () => {
  const md = skillMd();
  const before = md.slice(0, md.indexOf('## Roadmap'));
  assert.ok(before.length > 1000, 'the sections of one change are read');
  assert.doesNotMatch(before, /CronCreate|CronList|CronDelete|ScheduleWakeup|schedule-check|wake_when_done/);
  const session = readFileSync(join(HERE, '..', 'skills', 'devkit-session', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(session, /CronCreate|CronList|CronDelete|ScheduleWakeup|schedule-check/, 'the change session schedules nothing either');
});

// ================================================================ roadmap-sessions-upfront, phase 4: the grill's triage hand-off (design D-4, AC-4)

const TRIAGE_TYPE = 'devkit-core:requirements-triage';

// Invariant (AC-4, roadmapAgentDecision, roadmap-loop): in a run with a session per change the coordinating session hands the triage
// of an open change's grill and nothing else, and the hand-off marks nothing under way.
// (T-19, D-13: change `a` records flow 2, as an open with this release does; with no pin it follows flow 1, which does not list the triage, D-17.)
test('upfront AC-4 lock agent: the coordinating session may hand requirements-triage with a brief naming an open change, and marks nothing under way', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  pinFlow(root, 'a', 2);
  putRun(root, { places: 1, changeSessions: true });
  const transcript = lkRun(1);
  const brief = 'Change a (devkit script), stage requirements: triage of the grill. Work only in /somewhere on branch a.';
  for (const type of [TRIAGE_TYPE, 'requirements-triage']) {
    const d = agentOf(lkAgentInput(root, transcript, type, brief));
    assert.deepEqual([d.decision, d.why, d.change], ['allow', 'grill-helper', 'a'], type);
  }
  assert.deepEqual(stateOf(root).inflight, {}, 'nothing is marked under way');
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, brief)).why, 'own-sessions', 'a stage agent of the same brief is still refused');
  assert.equal(agentOf(lkAgentInput(root, transcript, 'devkit-core:codebase-researcher', brief)).why, 'grill-helper', 'any helper of the requirements stage');
  assert.equal(agentOf(lkAgentInput(root, transcript, 'devkit-openspec:requirements-triage', brief)).why, 'own-sessions', 'another pack\'s prefix');
  putRun(root, { places: 1 });
  assert.equal(agentOf(lkAgentInput(root, transcript, TRIAGE_TYPE, brief)).why, 'script-role', 'without the mode the hand-off goes through RH3 and is marked as before');
});

// Invariant (change-version-pin D-3 x AC-4, roadmapAgentDecision, roadmap-loop): the helpers of the requirements stage are those of the flow
// the change follows (its pin), not of the flow installed after it opened.
test('upfront AC-4 lock agent: a helper of the requirements stage is read from the flow the change is pinned to', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  const folder = join(root, 'openspec', 'schemas', 'devkit');
  const kept = JSON.parse(readFileSync(join(folder, 'flow.json'), 'utf8'));
  assert.deepEqual(kept.stages.find((s) => s.id === 'requirements').helpers, ['codebase-researcher', 'requirements-triage'], 'the fixture flow names both helpers');
  // The installed flow is the shipped version (the newest the reader reads); a is pinned to the one before it, which still names the researcher.
  const pinned = { ...kept, version: kept.version - 1 };
  const changed = { ...kept, stages: kept.stages.map((s) => (s.id === 'requirements' ? { ...s, helpers: ['requirements-triage'] } : s)) };
  put(root, {
    'openspec/schemas/devkit/flow.json': JSON.stringify(changed),
    [`openspec/schemas/devkit/flows/${pinned.version}.json`]: JSON.stringify(pinned),
    [`openspec/schemas/devkit/flows/${changed.version}.json`]: JSON.stringify(changed),
    'openspec/changes/a/.openspec.yaml': `schema: devkit\nx-devkit-flow: ${pinned.version}\n`,
  });
  commitAll(root, 'a newer flow is installed, a follows the one it opened with');
  putRun(root, { places: 1, changeSessions: true });
  const brief = 'Change a (devkit script), stage requirements: triage of the grill. Work only in /somewhere on branch a.';
  const d = agentOf(lkAgentInput(root, lkRun(1), 'devkit-core:codebase-researcher', brief));
  assert.deepEqual([d.decision, d.why, d.change], ['allow', 'grill-helper', 'a'], 'the pinned flow names the researcher, the installed one no longer does');
});

// Invariant (change-version-pin D-3 x design D-5, partOfStage, change-loop): the part a stage belongs to is the one of the flow the change
// follows, so a newer installed flow that moves the stage does not move it for a change that opened before.
test('upfront partOfStage: the part of a stage is read from the flow the change is pinned to', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  const folder = join(root, 'openspec', 'schemas', 'devkit');
  const kept = JSON.parse(readFileSync(join(folder, 'flow.json'), 'utf8'));
  assert.equal(kept.stages.find((s) => s.id === 'design').part, 'plan', 'the fixture flow puts design in the plan part');
  const pinned = { ...kept, version: kept.version - 1 };
  const changed = { ...kept, stages: kept.stages.map((s) => (s.id === 'design' ? { ...s, part: 'build' } : s)) };
  put(root, {
    'openspec/schemas/devkit/flow.json': JSON.stringify(changed),
    [`openspec/schemas/devkit/flows/${pinned.version}.json`]: JSON.stringify(pinned),
    [`openspec/schemas/devkit/flows/${changed.version}.json`]: JSON.stringify(changed),
    'openspec/changes/a/.openspec.yaml': `schema: devkit\nx-devkit-flow: ${pinned.version}\n`,
  });
  commitAll(root, 'a newer flow is installed, a follows the one it opened with');
  assert.equal(changeLoopModule.partOfStage({ root }, 'a', 'design'), 'plan', 'a follows the flow it opened with');
});

test('upfront AC-4 lock agent: the triage with no brief is refused own-sessions', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, changeSessions: true });
  const transcript = lkRun(1);
  for (const prompt of ['do it', undefined, 'Change (devkit script), stage requirements: x']) {
    const d = agentOf(lkAgentInput(root, transcript, TRIAGE_TYPE, prompt));
    assert.deepEqual([d.decision, d.why, d.change], ['refuse', 'own-sessions', null], String(prompt));
  }
  assert.deepEqual(stateOf(root).inflight, {});
});

test('upfront AC-4 lock agent: the triage for a change not open is refused not-open', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, changeSessions: true });
  const d = agentOf(lkAgentInput(root, lkRun(1), TRIAGE_TYPE, BRIEF('zzz', 'requirements')));
  assert.deepEqual([d.decision, d.why, d.change], ['refuse', 'not-open', 'zzz']);
  assert.match(d.reason, /zzz is not one; the open changes are: a/);
  assert.deepEqual(stateOf(root).inflight, {});
});

// Invariant (AC-4, D-17): the coordinating session's hand-off of the triage follows the flow the change follows: a change on flow 1 (no pin, or
// `x-devkit-flow: 1`) has no triage among its grill's helpers, so the hand-off is refused own-sessions as any other, while the grill's other
// helper stays allowed; a change on flow 2 is allowed. Layer: `roadmapAgentDecision` RH6. Suite: roadmap-loop.
test('upfront AC-4 lock agent: the coordinating session\'s triage for a change on flow 1 is refused own-sessions', () => {
  const brief = 'Change a (devkit script), stage requirements: triage of the grill. Work only in /somewhere on branch a.';
  for (const pin of [null, 1]) {
    const root = lkProject(['[ ] a'], { a: {} });
    pinFlow(root, 'a', pin);
    putRun(root, { places: 1, changeSessions: true });
    const transcript = lkRun(1);
    for (const type of [TRIAGE_TYPE, 'requirements-triage']) {
      const d = agentOf(lkAgentInput(root, transcript, type, brief));
      assert.deepEqual([d.decision, d.why, d.change], ['refuse', 'own-sessions', 'a'], `${type} on flow ${pin ?? 'none'}`);
    }
    assert.deepEqual(stateOf(root).inflight, {}, 'nothing is marked under way');
    assert.equal(agentOf(lkAgentInput(root, transcript, 'devkit-core:codebase-researcher', brief)).why, 'grill-helper', 'the other helper of the flow-1 grill stays allowed');
  }
  const root = lkProject(['[ ] a'], { a: {} });
  pinFlow(root, 'a', 2);
  putRun(root, { places: 1, changeSessions: true });
  const d = agentOf(lkAgentInput(root, lkRun(1), TRIAGE_TYPE, brief));
  assert.deepEqual([d.decision, d.why, d.change], ['allow', 'grill-helper', 'a'], 'a change on flow 2');
});

// ================================================================ remote-worker, phase 3: the claims, the machines setting, the board and the probe

// A project with a bare `origin` and a roadmap, and a second clone of it (the "other machine") in which each id of `claims` is opened for
// the machine named: its branch is pushed to `origin` with the claim. The main checkout fetches, so its remote-tracking refs are current.
// (The commits of `openChange` use the git identity of the fixtures module, `GIT_ENV` in test-fixtures.mjs.)
function remoteProject(lines, claims = {}) {
  const t = roundRepo({ roadmap: roadmapText(...lines), config: 'schema: devkit\n' });
  const dir = tmpFolder('devkit-roadmap-machine-');
  git(dir, 'clone', '-q', t.originDir, join(dir, 'clone'));
  const other = realpathSync(join(dir, 'clone'));
  mkdirSync(join(other, 'openspec', 'changes', 'archive'), { recursive: true });
  for (const [id, machine] of Object.entries(claims)) {
    openChange(other, id, { script: 'devkit', why: 'doubt', request: `Do ${id}\n`, lang: 'en', env: cleanEnv, machine });
  }
  git(t.main, 'fetch', '-q', 'origin');
  return { ...t, other };
}
const MACHINES_AVEL = JSON.stringify([{ host: 'avel', folder: '/home/me/repo', places: 2 }]);
const silentSsh = () => ({ status: 255, stdout: '', stderr: 'ssh: connect to host avel port 22: no route to host\n' });
const classesOf = (cwd, extra = {}) => Object.fromEntries(loopModule.collectRoadmap(cwd, { env: cleanEnv, lang: 'en', gh: OFFLINE, ...extra }).lines.map((l) => [l.id, l.cls]));

test('remote AC-5 status: a line open only on another machine is listed under way with its machine, never in the queue', () => {
  const t = remoteProject(['[ ] aaa', '[ ] bbb'], { aaa: 'avel' });
  const r = doStatus(t.main);
  assert.equal(r.code, 0, r.stderr);
  const row = rowAt('aaa'.length + 3);
  assert.equal(r.stdout, [
    render('en', 'status-count', { open: 0, places: 1, queue: 1, archived: 0 }),
    '',
    render('en', 'status-running'),
    row('aaa', `${render('en', 'remote.open', { machine: 'avel' })} · avel`),
    render('en', 'status-queue'),
    row('bbb', render('en', 'queue.ready')),
    '',
  ].join('\n'));
  assert.equal(classesOf(t.main).aaa, 'elsewhere');
});

test('remote AC-5 status: GitHub unreadable prints the board with its line', () => {
  const t = remoteProject(['[ ] aaa'], {});
  git(t.main, 'remote', 'set-url', 'origin', join(t.originDir, 'missing'));
  const r = doStatus(t.main);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.stdout.split('\n').slice(0, 2), [render('en', 'status-count', { open: 0, places: 1, queue: 1, archived: 0 }), render('en', 'status-claims-unreadable')]);
  assert.equal(doStatus(remoteProject(['[ ] aaa'], {}).main).stdout.includes(render('en', 'status-claims-unreadable')), false, 'a readable origin prints no such line');
});

test('remote AC-5 status: the machines block and the machine of each row', () => {
  const claim = (machine, placed) => ({ id: 'xxx', machine, places: null, placed });
  const lines = classifyLines(ROUND('[ ] aaa', '[ ] bbb', '[ ] ccc', '[ ] ddd'), {
    archived: new Set(), open: new Set(['aaa']), previous: new Set(), declared: {},
    elsewhere: new Map([['bbb', claim('avel', true)], ['ccc', claim('avel', false)], ['ddd', claim('avel', false)]]),
  });
  const answered = (id, where) => ({ id, where, icon: '📝', waitsForPlace: false });
  const f = {
    ...world({ places: 1, actions: { aaa: agentAct('aaa') }, lines: ['[ ] aaa'] }), lines, thisMachine: 'mac', claimsReadable: true,
    claims: { aaa: claim('mac', false), bbb: claim('avel', true), ccc: claim('avel', false), ddd: claim('avel', false) },
    machines: [{ name: 'avel', host: 'avel', folder: '/r', places: 2, answered: true, changes: [answered('bbb', 'Code review'), answered('ccc', 'Requirements'), answered('ddd', 'Proposal')] }],
  };
  const row = rowAt('mac (this one)'.length + 3);
  assert.equal(boardOf(f), [
    render('en', 'status-count-machines', { open: 4, queue: 0, archived: 0 }),
    '',
    render('en', 'status-machines'),
    row(render('en', 'machine.this', { name: 'mac' }), render('en', 'machine.row', { taken: 0, places: 1, open: 1 })),
    row('avel', render('en', 'machine.row', { taken: 1, places: 2, open: 3 })),
    render('en', 'status-running'),
    row('aaa', 'Proposal · mac'),
    row('bbb', 'Code review · avel'),
    row('ccc', 'Requirements · avel'),
    row('ddd', 'Proposal · avel'),
  ].join('\n'));
  const silent = { ...f, machines: [{ ...f.machines[0], answered: false, changes: [] }] };
  assert.match(boardOf(silent), new RegExp(`avel +${render('en', 'machine.no-answer')}\\n`));
  assert.match(boardOf({ ...f, lang: 'pt-BR' }), /Máquinas\n/);
});

test('remote AC-6 next: a line claimed on origin is never started, and its dependent waits', () => {
  const t = remoteProject(['[ ] aaa', '[ ] bbb', '[ ] ccc (after: aaa)'], { aaa: 'avel' });
  const r = doRun(t.main, '3');
  assert.equal(r.code, 0, r.stderr);
  const d = jsonOf(r.stdout);
  assert.deepEqual(d.actions.map((a) => [a.change, a.kind]), [['bbb', 'start']]);
  assert.deepEqual(d.open, [], 'the claimed line fills no place');
  assert.deepEqual(classesOf(t.main), { aaa: 'elsewhere', bbb: 'ready', ccc: 'waiting' });
  assert.equal(loopModule.collectRoadmap(t.main, { env: cleanEnv, lang: 'en', gh: OFFLINE }).lines.find((l) => l.id === 'ccc').waitsFor, 'aaa');
  assert.equal(events(r.stdout).some((e) => /\baaa\b/.test(e)), false, 'no line says a started');
});

test('remote AC-6 next: a declared cannot-open of a line claimed elsewhere is dropped', () => {
  const t = remoteProject(['[ ] aaa'], { aaa: 'avel' });
  putRun(t.main, { declared: { aaa: { state: 'blocked', why: 'cannot-open', params: { error: 'taken' } } } });
  const r = doNext(t.main);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(stateOf(t.main).declared, {}, 'the declared end left the run file');
  assert.equal(classesOf(t.main).aaa, 'elsewhere');
  assert.equal(events(r.stdout).some((e) => /could not be opened|blocked/i.test(e)), false);
});

test('remote AC-7 machines: unset, empty, [] and a placeholder read as unset', () => {
  for (const unset of [undefined, null, '', '  ', '[]', ' [ ] ', '${user_config.machines}']) assert.deepEqual(loopModule.parseMachines(unset), { machines: [] }, String(unset));
  const entry = { host: 'avel', folder: '/home/kaue/repos/devkit', places: 2 };
  assert.deepEqual(loopModule.parseMachines(JSON.stringify([entry, { host: 'a.b-c_1', folder: '/x y/z', places: 99 }])), { machines: [entry, { host: 'a.b-c_1', folder: '/x y/z', places: 99 }] });
});

test('remote AC-7 machines: an entry without a field is refused naming it, and nothing is written', () => {
  const bad = (text) => loopModule.parseMachines(text).error;
  assert.deepEqual(bad('avel:/home/kaue/repos/devkit:2'), { key: 'machines-unreadable', params: {} });
  assert.deepEqual(bad('{"host":"avel"}'), { key: 'machines-unreadable', params: {} });
  assert.deepEqual(bad('[{"host":"avel","folder":"/r"}]'), { key: 'machine-incomplete', params: { entry: 'avel', field: 'places' } });
  assert.deepEqual(bad('[{"host":"avel","places":2}]'), { key: 'machine-incomplete', params: { entry: 'avel', field: 'folder' } });
  assert.deepEqual(bad('[{"host":"avel","folder":"repo","places":2}]'), { key: 'machine-incomplete', params: { entry: 'avel', field: 'folder' } });
  assert.deepEqual(bad('[{"folder":"/r","places":2}]'), { key: 'machine-incomplete', params: { entry: '#1', field: 'host' } });
  assert.deepEqual(bad('[{"host":"-avel","folder":"/r","places":2}]'), { key: 'machine-incomplete', params: { entry: '-avel', field: 'host' } });
  assert.deepEqual(bad('["avel"]'), { key: 'machine-incomplete', params: { entry: '#1', field: 'host' } });
  for (const places of [0, 100, 1.5, '2']) assert.equal(bad(JSON.stringify([{ host: 'avel', folder: '/r', places }])).params.field, 'places', String(places));
  assert.deepEqual(bad('[{"host":"avel","folder":"/r","places":1},{"host":"avel","folder":"/s","places":1}]'), { key: 'machine-duplicate', params: { entry: 'avel' } });
  // The commands print the reply, exit 0 and read and write nothing else.
  const t = remoteProject(['[ ] aaa'], {});
  const before = picture(t.main);
  const calls = [];
  const ssh = (...a) => { calls.push(a); return silentSsh(); };
  const incomplete = '[{"host":"avel","folder":"/home/kaue/repos/devkit"}]';
  for (const [text, key, params] of [[incomplete, 'machine-incomplete', { entry: 'avel', field: 'places' }], ['avel:/r:2', 'machines-unreadable', {}]]) {
    for (const r of [doRun(t.main, '', { extra: ['--machines', text], ssh }), doNext(t.main, ['--machines', text], { ssh }), cmd(t.main, ['status', ...FLAGS, '--machines', text], { ssh })]) {
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.stdout, `${render('en', key, params)}\n`);
    }
  }
  assert.equal(existsSync(runFileOf(t.main)), false, 'no run file');
  assert.equal(picture(t.main), before);
  assert.deepEqual(calls, [], 'no machine was reached');
});

test('remote AC-7 next: with machines unset the decision is today\'s', () => {
  const outputs = [[], ['--machines', ''], ['--machines', '[]'], ['--machines', '${user_config.machines}']].map((extra) => {
    const t = remoteProject(['[ ] aaa', '[ ] bbb'], {});
    return doNext(t.main, extra, { ssh: () => assert.fail('no machine is reached') });
  });
  assert.equal(outputs[0].code, 0, outputs[0].stderr);
  for (const o of outputs) assert.equal(o.stdout, outputs[0].stdout);
  assert.deepEqual(jsonOf(outputs[0].stdout).actions.map((a) => [a.change, a.kind]), [['aaa', 'start']]);
});

test('remote AC-12 status: a silent machine and its changes read no answer', () => {
  const t = remoteProject(['[ ] aaa', '[ ] bbb', '[ ] eee'], { aaa: 'avel', bbb: 'avel' });
  const calls = [];
  const r = cmd(t.main, ['status', ...FLAGS, '--machines', MACHINES_AVEL], { ssh: (host, argv, o) => { calls.push([host, argv[3]]); return silentSsh(host, argv, o); } });
  assert.equal(r.code, 0, r.stderr);
  const name = thisMachine();
  const noAnswer = render('en', 'machine.no-answer');
  const row = rowAt(Math.max(`${name} (this one)`.length, 'avel'.length) + 3);
  assert.equal(r.stdout, [
    render('en', 'status-count-machines', { open: 2, queue: 1, archived: 0 }),
    '',
    render('en', 'status-machines'),
    row(render('en', 'machine.this', { name }), render('en', 'machine.row', { taken: 0, places: 1, open: 0 })),
    row('avel', noAnswer),
    render('en', 'status-running'),
    row('aaa', `${noAnswer} · avel`),
    row('bbb', `${noAnswer} · avel`),
    render('en', 'status-queue'),
    row('eee', render('en', 'queue.ready')),
    '',
  ].join('\n'));
  assert.deepEqual(calls, [['avel', 'state']], 'avel was asked once, for its state');
});

// The "other machine" is this machine: the injected ssh runs what ssh would run there, with the pack installed by a fixture file.
function localSsh(calls = []) {
  const home = tmpFolder('devkit-roadmap-home-');
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2, plugins: { 'devkit-openspec@devkit': [{ scope: 'user', installPath: join(HERE, '..'), version: '0.0.0' }] },
  }));
  return (host, argv, { input, timeout } = {}) => {
    calls.push({ host, argv, timeout });
    const r = spawnSync(process.execPath, argv.slice(1), { input, encoding: 'utf8', env: { ...cleanEnv, HOME: home }, cwd: HERE });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
}

test('remote AC-12 probe: state through the injected ssh returns the other clone\'s changes, and a failing ssh is no answer', () => {
  const t = remoteProject(['[ ] aaa'], {});
  openChange(t.other, 'xxx', { script: 'devkit', why: 'doubt', request: 'Do x\n', lang: 'en', env: cleanEnv, machine: 'avel' });
  const calls = [];
  const ssh = localSsh(calls);
  const machine = { host: 'avel', folder: t.other, places: 2 };
  const ok = loopModule.askMachine(machine, 'state', [t.other, 'en'], { ssh });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.data.version, 1);
  assert.equal(ok.data.machine, thisMachine());
  assert.deepEqual(ok.data.changes.map((c) => [c.id, c.icon, c.waitsForPlace]), [['xxx', '❓', false]]);
  assert.ok(typeof ok.data.changes[0].where === 'string' && ok.data.changes[0].where.length > 0, 'where is a phrase');
  assert.deepEqual([calls[0].host, calls[0].argv.slice(0, 4), calls[0].timeout], ['avel', ['node', '--input-type=module', '-', 'state'], 20_000]);
  // A machine that fails, answers in another form or reports an error is no answer.
  for (const bad of [silentSsh, () => ({ status: 0, stdout: 'not json', stderr: '' }), () => ({ status: 0, stdout: '{"version":2}', stderr: '' }),
    () => ({ status: 3, stdout: '{"version":1,"error":"no pack"}', stderr: '' }), () => ({ status: 0, stdout: '{"version":1,"error":"no pack"}', stderr: '' })]) {
    assert.equal(loopModule.askMachine(machine, 'state', [t.other, 'en'], { ssh: bad }).ok, false);
  }
  // The roadmap's facts carry the answer, and none when the probe is off.
  const facts = loopModule.collectRoadmap(t.main, { env: cleanEnv, lang: 'en', gh: OFFLINE, machines: [machine], ssh });
  assert.deepEqual(facts.machines.map((m) => [m.name, m.host, m.folder, m.places, m.answered, m.changes.map((c) => c.id)]), [['avel', 'avel', t.other, 2, true, ['xxx']]]);
  const asked = calls.length;
  const off = loopModule.collectRoadmap(t.main, { env: cleanEnv, lang: 'en', gh: OFFLINE, machines: [machine], ssh, probe: false });
  assert.deepEqual(off.machines.map((m) => [m.answered, m.changes]), [[false, []]]);
  assert.equal(calls.length, asked, 'no ssh with the probe off');
  // `status --json` is what the probe runs: one object, with this clone's changes.
  const j = cmd(t.other, ['status', '--json', '--lang', 'en']);
  assert.equal(j.code, 0, j.stderr);
  assert.deepEqual(JSON.parse(j.stdout).changes.map((c) => c.id), ['xxx']);
});

// The probe run by itself, as ssh would run it: `installed` is the content of the other machine's installed_plugins.json (null: no
// file); a pack is a folder whose roadmap-loop.mjs is `script`. Returns the exit status and the parsed stdout.
function probeState({ installed, folder }) {
  const home = tmpFolder('devkit-probe-home-');
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  if (installed !== null) writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), typeof installed === 'string' ? installed : JSON.stringify(installed));
  const r = spawnSync(process.execPath, [join(HERE, 'machine-probe.mjs'), 'state', folder, 'en'], { encoding: 'utf8', env: { ...cleanEnv, HOME: home }, cwd: HERE });
  return { status: r.status, out: JSON.parse(r.stdout) };
}
function fakePack(script) {
  const dir = tmpFolder('devkit-probe-pack-');
  mkdirSync(join(dir, 'hooks'), { recursive: true });
  writeFileSync(join(dir, 'hooks', 'roadmap-loop.mjs'), script);
  return dir;
}
const sayPack = (name) => fakePack(`process.stdout.write(JSON.stringify({ version: 1, pack: ${JSON.stringify(name)} }) + '\\n');\n`);

test('remote AC-12 probe: the installation is the project-scoped one at or above the folder, else the user-scoped one', () => {
  const folder = tmpFolder('devkit-probe-folder-');
  const user = sayPack('user');
  const project = sayPack('project');
  const elsewhere = sayPack('elsewhere');
  const entry = (scope, installPath, projectPath) => ({ scope, installPath, version: '0.0.0', ...(projectPath ? { projectPath } : {}) });
  const run = (list) => probeState({ installed: { version: 2, plugins: { 'devkit-openspec@devkit': list } }, folder });
  const packOf = (list) => { const r = run(list); assert.equal(r.status, 0, JSON.stringify(r.out)); return r.out.pack; };
  assert.equal(packOf([entry('user', user), entry('project', project, folder)]), 'project', 'project scope wins over user scope, whatever the order');
  assert.equal(packOf([entry('project', project, folder), entry('user', user)]), 'project');
  assert.equal(packOf([entry('user', user), entry('project', project, dirname(folder))]), 'project', 'a project path above the folder serves it');
  assert.equal(packOf([entry('user', user), entry('project', project, `${dirname(folder)}/`)]), 'project', 'a trailing slash still matches');
  assert.equal(packOf([entry('user', user), entry('project', elsewhere, `${folder}-other`)]), 'user', 'a sibling that shares the prefix does not serve it');
  assert.equal(packOf([entry('user', user), entry('project', elsewhere, join(folder, 'deeper'))]), 'user', 'a project path below the folder does not serve it');
});

test('remote AC-12 probe: the probe itself answers with an error and exit 3 when the pack is missing, the file unreadable or the status fails', () => {
  const folder = tmpFolder('devkit-probe-folder-');
  const failing = fakePack("process.stderr.write('boom happened\\nsecond line\\n'); process.exit(1);\n");
  const cases = [
    ['not installed', { version: 2, plugins: { 'other@x': [{ scope: 'user', installPath: '/x' }] } }, /pack is not installed/],
    ['no installPath', { version: 2, plugins: { 'devkit-openspec@devkit': [{ scope: 'user' }] } }, /pack is not installed/],
    ['no file', null, /installed_plugins\.json cannot be read/],
    ['not json', 'not json', /installed_plugins\.json cannot be read/],
    ['status fails', { version: 2, plugins: { 'devkit-openspec@devkit': [{ scope: 'user', installPath: failing }] } }, /^status failed in .*: boom happened$/],
  ];
  for (const [name, installed, why] of cases) {
    const r = probeState({ installed, folder });
    assert.equal(r.status, 3, name);
    assert.equal(r.out.version, 1, name);
    assert.match(r.out.error, why, name);
  }
});

// ================================================================ remote-worker, phase 4: placement, the session on another machine, the wake

const claimOf = (machine, over = {}) => ({ id: 'x', machine, places: 2, placed: false, ...over });
const avelAnswers = (changes = [], over = {}) => ({ name: 'avel', host: 'avel', folder: '/home/me/repo', places: 2, answered: true, changes, ...over });
const avelSilent = () => avelAnswers([], { answered: false });
const waitingOnAvel = (id) => ({ id, where: 'Waiting for a place', icon: '⏳', waitsForPlace: true });
// The facts of a decision with the machines setting set: `local` are this machine's open changes ({ id: action }), `claims` the claims on
// `origin` ({ id: claim }); a claimed id that is not local is open elsewhere.
function machinesWorld({ lines, local = {}, claims = {}, machines = [avelAnswers()], changeSessions = true, ...over }) {
  const elsewhere = new Map(Object.entries(claims).filter(([id]) => !(id in local)));
  const classified = classifyLines(ROUND(...lines), { archived: new Set(), open: new Set(Object.keys(local)), previous: new Set(), declared: {}, elsewhere });
  return {
    ...world({ places: 3, actions: local }), lines: classified, thisMachine: 'mac', claims, claimsReadable: true, machines, machinesText: MACHINES_AVEL,
    changeSessions, coordinator: 'S-main', turn: 'typed', startedSessions: Object.fromEntries(Object.keys(local).map((id) => [id, { at: AT }])), placed: {}, ...over,
  };
}
const startsOf = (r) => r.actions.filter((a) => a.kind === 'start').map((a) => [a.change, a.machine, a.remote, a.places]);

test('remote AC-8 next: each ready line goes to the answering machine with the fewest open changes', () => {
  const f = machinesWorld({ lines: ['[ ] aaa', '[ ] r1', '[ ] r2', '[ ] r3'], local: { aaa: agentAct('aaa') } });
  assert.deepEqual(startsOf(decideRoadmap(f)), [['r1', 'avel', true, 2], ['r2', 'mac', false, 'run'], ['r3', 'avel', true, 2]],
    'this machine holds one, avel none: avel first, then the tie goes to this machine, then avel again');
  // Changes open on a machine, local or claimed, count; a machine with more open changes gets the next one last.
  const loadedAvel = machinesWorld({ lines: ['[ ] x', '[ ] y', '[ ] z'], claims: { x: claimOf('avel'), y: claimOf('avel') } });
  assert.deepEqual(startsOf(decideRoadmap(loadedAvel)), [['z', 'mac', false, 'run']], 'avel holds two claimed changes');
  const here = machinesWorld({ lines: ['[ ] x', '[ ] z'], claims: { x: claimOf('mac') } });
  assert.deepEqual(startsOf(decideRoadmap(here)), [['z', 'avel', true, 2]], 'a change claimed by this machine counts here');
  // Each start carries the fields the skill passes to open.
  const first = decideRoadmap(f).actions.find((a) => a.change === 'r1');
  assert.deepEqual([first.kind, first.request, first.progressKey], ['start', 'r1', 'start']);
});

test('remote AC-8 next: this machine is skipped while loaded, and a start is held only when nothing can take it', () => {
  const loaded = { load: 90, limit: 80 };
  const toAvel = decideRoadmap(machinesWorld({ lines: ['[ ] r1', '[ ] r2'], ...loaded }));
  assert.deepEqual(startsOf(toAvel), [['r1', 'avel', true, 2], ['r2', 'avel', true, 2]], 'the loaded machine takes none');
  assert.equal(toAvel.actions.some((a) => a.kind === 'hold'), false);
  const none = decideRoadmap(machinesWorld({ lines: ['[ ] r1', '[ ] r2'], machines: [avelSilent()], ...loaded }));
  assert.deepEqual(changesOf(none).filter(([, kind]) => kind !== 'wake'), [['r1', 'hold']], 'no machine can take the first ready line');
  assert.ok(none.lines.includes(say('roadmap-held', { id: 'r1', load: 90, limit: 80 })), none.lines.join('|'));
  const anyway = decideRoadmap(machinesWorld({ lines: ['[ ] r1'], machines: [avelSilent()], startAnyway: true, ...loaded }));
  assert.deepEqual(startsOf(anyway), [['r1', 'mac', false, 'run']], 'start anyway puts this machine back');
  // A host that cannot start sessions uses no other machine: a change there could run only in a session of its own (D-8).
  const alone = decideRoadmap(machinesWorld({ lines: ['[ ] r1', '[ ] r2'], changeSessions: false }));
  assert.deepEqual(startsOf(alone), [['r1', 'mac', false, 'run'], ['r2', 'mac', false, 'run']]);
  assert.deepEqual(changesOf(decideRoadmap(machinesWorld({ lines: ['[ ] r1'], changeSessions: false, ...loaded }))), [['r1', 'hold']]);
  // The board says it when nothing can take a ready line.
  const board = (f) => boardOf(f);
  assert.ok(board(machinesWorld({ lines: ['[ ] r1'], machines: [avelSilent()], ...loaded })).includes(render('en', 'queue.no-machine')));
  assert.ok(board(machinesWorld({ lines: ['[ ] r1'], changeSessions: false, ...loaded })).includes(render('en', 'queue.no-machine')), 'avel answers but cannot start sessions');
  assert.equal(board(machinesWorld({ lines: ['[ ] r1'], ...loaded })).includes(render('en', 'queue.no-machine')), false);
});

const RRR_CWD = '/home/me/repo/.claude/worktrees/rrr';
test('remote AC-9 next: a placed change gets a session-start with its checkout, target ssh, host and the remote cwd, only on a typed turn', () => {
  const claims = { rrr: claimOf('avel') };
  const placed = { rrr: { machine: 'avel', at: AT } };
  const r = decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, placed }));
  assert.deepEqual(r.actions, [{
    change: 'rrr', kind: 'session-start', machine: 'avel', cwd: RRR_CWD, title: '❓ rrr', progressKey: 'session-start',
    checkout: ['node', join(HOOKS_DIR, 'roadmap-loop.mjs'), 'checkout', '--change', 'rrr', '--machines', MACHINES_AVEL, '--lang', 'en'],
    input: {
      initiation: 'user_asked', context: 'fresh', title: '❓ rrr', name: 'rrr', cwd: RRR_CWD, use_worktree: false, prompt: '/devkit-openspec:devkit change rrr',
      background: loopModule.sessionBackground({ id: 'rrr', root: RRR_CWD, branch: 'rrr', coordinator: 'S-main', lang: 'en' }), target: 'ssh', host: 'avel',
    },
  }]);
  // A change placed on another machine has no action read here, so its start carries no `model` (stage-models D-6: a session recorded with no model is never switched).
  assert.deepEqual(Object.keys(r.actions[0].input).sort(), [...START_FIELDS.filter((k) => k !== 'model'), 'host', 'target'].sort());
  // Not recorded as placed by this run, a session already started, or a machine that does not list it: none.
  assert.deepEqual(decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims })).actions, []);
  assert.deepEqual(decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, placed, startedSessions: { rrr: { at: AT } } })).actions, []);
  assert.deepEqual(decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims: { rrr: claimOf('other') }, placed })).actions, []);
  // The start the previous call handed, found claimed now, is placed at once and recorded.
  const handed = decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, starting: ['rrr'] }));
  assert.deepEqual(changesOf(handed), [['rrr', 'session-start']]);
  assert.deepEqual(handed.state.placed, { rrr: 'avel' });
  // On a turn nobody typed it waits, and says so.
  const event = decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, placed, turn: 'event' }));
  assert.deepEqual(event.actions, []);
  assert.ok(event.lines.includes(say('roadmap-waits-turn-on', { id: 'rrr', machine: 'avel' })), event.lines.join('|'));
  // The host reported it started: a line, the change recorded, and no second action.
  const started = decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, placed, after: { rrr: 'session-start' } }));
  assert.deepEqual(started.actions, []);
  assert.ok(started.lines.includes(say('roadmap-session-started-on', { id: 'rrr', machine: 'avel' })), started.lines.join('|'));
  assert.deepEqual(started.state.sessionsStarted.map((e) => e.id), ['rrr']); // each entry is { id, model } (stage-models D-6); a change placed on another machine carries no model
  assert.ok(started.state.openLines.includes('rrr'), 'the record of a started session is kept while the line is open elsewhere');
});

test('remote AC-9 next: the run file keeps placed, which another session keeps and --fresh clears', () => {
  const t = remoteProject(['[ ] rrr'], { rrr: 'avel' });
  const machines = JSON.stringify([{ host: 'avel', folder: t.other, places: 2 }]);
  const ssh = localSsh();
  putRun(t.main, { changeSessions: true, turn: 'typed', starting: ['rrr'] });
  const first = doNext(t.main, ['--turn', 'typed', '--machines', machines], { ssh });
  assert.equal(first.code, 0, first.stderr);
  const action = jsonOf(first.stdout).actions[0];
  assert.deepEqual([action.change, action.kind, action.machine, action.input.host, action.input.cwd], ['rrr', 'session-start', 'avel', 'avel', join(t.other, '.claude', 'worktrees', 'rrr')]);
  assert.equal(stateOf(t.main).placed.rrr.machine, 'avel');
  const after = doNext(t.main, ['--turn', 'typed', '--after', 'rrr=session-start', '--machines', machines], { ssh });
  assert.equal(after.code, 0, after.stderr);
  assert.deepEqual(Object.keys(stateOf(t.main).startedSessions), ['rrr']);
  assert.equal(stateOf(t.main).placed.rrr.machine, 'avel', 'kept while its line is open elsewhere');
  const other = doRun(t.main, '', { session: 'S2', extra: ['--change-sessions', '--machines', machines], ssh });
  assert.equal(other.code, 0, other.stderr);
  assert.equal(stateOf(t.main).placed.rrr?.machine, 'avel', 'a run from another session keeps it');
  const fresh = doRun(t.main, '', { session: 'S3', extra: ['--fresh', '--change-sessions', '--machines', machines], ssh });
  assert.equal(fresh.code, 0, fresh.stderr);
  assert.deepEqual(stateOf(t.main).placed, {}, '--fresh clears it');
  // A file of the earlier form, or a damaged field, reads as nothing placed.
  putRun(t.main, { placed: { rrr: 'avel', 'not an id!': { machine: 'avel' }, ok: { machine: 'avel', at: AT }, bad: { machine: 3 } } });
  assert.deepEqual(Object.keys(loopModule.readRun(runFileOf(t.main)).placed), ['ok']);
  putRun(t.main, {});
  assert.deepEqual(loopModule.readRun(runFileOf(t.main)).placed, {});
});

test('remote AC-9 checkout: the worktree is made on the other clone from its branch', () => {
  const t = remoteProject(['[ ] rrr'], {});
  openChange(t.main, 'rrr', { script: 'devkit', why: 'doubt', request: 'Do rrr\n', lang: 'en', env: cleanEnv, machine: 'avel', places: '2', remote: true });
  assert.equal(git(t.main, 'branch', '--list', 'rrr'), '', 'the open left no local branch');
  assert.equal(git(t.other, 'branch', '--list', 'rrr'), '', 'the other clone has none either');
  const machines = JSON.stringify([{ host: 'avel', folder: t.other, places: 2 }]);
  const calls = [];
  const run = (extra = [], opts = {}) => cmd(t.main, ['checkout', '--change', 'rrr', '--lang', 'en', '--machines', machines, ...extra], { ssh: localSsh(calls), ...opts });
  const worktree = join(t.other, '.claude', 'worktrees', 'rrr');
  const r = run();
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'rrr', machine: 'avel', worktree });
  assert.equal(git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD'), 'rrr');
  assert.equal(git(worktree, 'rev-parse', 'HEAD'), git(t.main, 'ls-remote', 'origin', 'refs/heads/rrr').split('\t')[0], 'from the claim\'s branch');
  assert.equal(existsSync(join(worktree, 'openspec', 'changes', 'rrr', '.openspec.yaml')), true);
  assert.deepEqual([calls[0].host, calls[0].argv.slice(0, 4), calls[0].argv.slice(4), calls[0].timeout], ['avel', ['node', '--input-type=module', '-', 'checkout'], [t.other, 'rrr'], 120_000]);
  assert.deepEqual(JSON.parse(run().stdout), { version: 1, change: 'rrr', machine: 'avel', worktree }, 'asked again, it is the same worktree');
  // Refusals: no claim, a machine that is not listed, a machine that fails. Exit 3, the reply names the change, and nothing is written locally.
  const refusals = [
    ['no claim', cmd(t.main, ['checkout', '--change', 'nothing', '--lang', 'en', '--machines', machines], { ssh: localSsh() })],
    ['not listed', cmd(t.main, ['checkout', '--change', 'rrr', '--lang', 'en', '--machines', JSON.stringify([{ host: 'other', folder: '/x', places: 1 }])], { ssh: localSsh() })],
    ['ssh fails', run([], { ssh: silentSsh })],
  ];
  for (const [name, r] of refusals) {
    assert.equal(r.code, 3, name);
    const reply = JSON.parse(r.stdout).reply;
    assert.match(reply, /I could not make the folder of (nothing|rrr) on /, name);
  }
  assert.match(JSON.parse(refusals[2][1].stdout).reply, /no route to host/);
  assert.equal(existsSync(runFileOf(t.main)), false, 'nothing is written locally');
  assert.equal(cmd(t.main, ['checkout', '--change', 'rrr', '--lang', 'en', '--machines', 'avel:/r:2'], { ssh: localSsh() }).stdout, `${render('en', 'machines-unreadable')}\n`);
});

test('remote AC-11 next: a freed place gives one wake per state for the first waiting change', () => {
  const waiting = [waitingOnAvel('w1'), waitingOnAvel('w2')];
  const claims = { w1: claimOf('avel', { places: 1 }), w2: claimOf('avel', { places: 1 }) };
  const holder = { h: claimOf('avel', { places: 1, placed: true }) };
  const build = ({ claims: extra = {}, ...over } = {}) => machinesWorld({ lines: ['[ ] w1', '[ ] w2'], machines: [avelAnswers(waiting)], claims: { ...claims, ...extra }, ...over });
  const wakesOf = (r) => r.actions.filter((a) => a.kind === 'wake');
  const held = decideRoadmap(build({ claims: holder }));
  assert.deepEqual(wakesOf(held), [], 'the place is held by h');
  const freed = decideRoadmap(build());
  assert.deepEqual(wakesOf(freed), [{ change: 'w1', kind: 'wake', machine: 'avel', message: '/devkit-openspec:devkit change w1', progressKey: 'wake' }], 'one, for the first in file order');
  assert.ok(freed.lines.includes(say('roadmap-woken', { id: 'w1', machine: 'avel' })), freed.lines.join('|'));
  assert.equal(freed.state.announced.w1, 'woken:0');
  assert.deepEqual(wakesOf(decideRoadmap(build({ announced: freed.state.announced }))), [], 'never two for one state');
  // Another change takes the place: the record of the wake is dropped, so the next freeing wakes again.
  const taken = decideRoadmap(build({ claims: holder, announced: freed.state.announced }));
  assert.equal(taken.state.announced.w1, undefined);
  assert.deepEqual(wakesOf(decideRoadmap(build({ announced: taken.state.announced }))).map((a) => a.change), ['w1']);
  // A wake starts no session: it is not held back on a turn nobody typed.
  assert.deepEqual(wakesOf(decideRoadmap(build({ turn: 'event' }))).map((a) => a.change), ['w1']);
  // A change waiting on this machine is woken too, with this machine's places from the run.
  const local = machinesWorld({
    lines: ['[ ] w0'], local: { w0: endAct('w0', 'blocked', 'no-place', { machine: 'mac', taken: 1, places: 1 }) }, claims: { w0: claimOf('mac', { places: 'run' }) }, machines: [avelAnswers()], places: 1,
  });
  assert.deepEqual(wakesOf(decideRoadmap(local)), [{ change: 'w0', kind: 'wake', machine: 'mac', message: '/devkit-openspec:devkit change w0', progressKey: 'wake' }]);
  assert.deepEqual(wakesOf(decideRoadmap({ ...local, claims: { w0: claimOf('mac', { places: 'run' }), h: claimOf('mac', { placed: true }) } })), []);
  // A machine that does not answer shows no waiting change.
  assert.deepEqual(wakesOf(decideRoadmap(build({ machines: [avelSilent()] }))), []);
});

test('remote AC-11 next: no wake without session mode', () => {
  const f = machinesWorld({
    lines: ['[ ] w0', '[ ] w1'], local: { w0: endAct('w0', 'blocked', 'no-place', { machine: 'mac', taken: 0, places: 1 }) },
    claims: { w0: claimOf('mac', { places: 'run' }), w1: claimOf('avel', { places: 1 }) }, machines: [avelAnswers([waitingOnAvel('w1')])], places: 1,
  });
  assert.deepEqual(decideRoadmap({ ...f, changeSessions: true }).actions.filter((a) => a.kind === 'wake').map((a) => [a.change, a.machine]), [['w0', 'mac'], ['w1', 'avel']], 'one per machine in session mode');
  const plain = decideRoadmap({ ...f, changeSessions: false });
  assert.deepEqual(plain.actions.filter((a) => a.kind === 'wake'), []);
  assert.equal(plain.lines.some((l) => l.includes(render('en', 'roadmap-woken', { id: 'w0', machine: 'mac' }))), false);
});

test('remote AC-12 next: a silent machine gets no change, and its placed change no session', () => {
  const claims = { rrr: claimOf('avel') };
  const f = machinesWorld({ lines: ['[ ] rrr', '[ ] bbb'], claims, machines: [avelSilent()], placed: { rrr: { machine: 'avel', at: AT } } });
  const r = decideRoadmap(f);
  assert.deepEqual(changesOf(r), [['bbb', 'start']], 'no session for rrr');
  assert.deepEqual(startsOf(r), [['bbb', 'mac', false, 'run']], 'the new change stays on this machine');
  assert.ok(r.lines.includes(say('roadmap-machine-silent', { machine: 'avel' })), r.lines.join('|'));
  assert.equal(r.state.announced['machine:avel'], 'silent');
  assert.equal(r.lines.some((l) => /rrr/.test(l) && /started/i.test(l)), false);
  const again = decideRoadmap({ ...f, announced: r.state.announced });
  assert.equal(again.lines.includes(say('roadmap-machine-silent', { machine: 'avel' })), false, 'once per silence');
  // It answers again: the record goes, so a later silence is said again, and its placed change gets its session.
  const back = decideRoadmap({ ...f, machines: [avelAnswers()], announced: r.state.announced });
  assert.equal(back.state.announced['machine:avel'], undefined);
  assert.deepEqual(changesOf(back).filter(([id]) => id === 'rrr'), [['rrr', 'session-start']]);
  // The run does not end while the changes of a listed machine are only out of reach.
  const quiet = decideRoadmap(machinesWorld({ lines: ['[ ] rrr'], claims, machines: [avelSilent()], placed: { rrr: { machine: 'avel', at: AT } }, startedSessions: { rrr: { at: AT } } }));
  assert.equal(quiet.end, null);
});

test('remote locks stop: no ssh from the stop hook, and a start only another machine could take does not refuse the stop', () => {
  const t = remoteProject(['[ ] rr'], {});
  openChange(t.other, 'rr', { script: 'devkit', why: 'doubt', request: 'Do rr\n', lang: 'en', env: cleanEnv, machine: 'avel' }); // pushed after this clone's fetch
  putRun(t.main, { places: 1, changeSessions: true, turn: 'typed', placed: { rr: { machine: 'avel', at: AT } } });
  const transcript = lkRun(1);
  const routes = [];
  const gh = (args) => { routes.push(args[1] ?? ''); return OFFLINE(); };
  const ssh = () => assert.fail('the stop hook never reaches another machine');
  withTmp((tmp) => {
    const d = loopModule.roadmapStopDecision(lkStopInput(t.main, transcript), lkOpts({ env: { ...LK_ENV, CLAUDE_PLUGIN_OPTION_MACHINES: MACHINES_AVEL }, gh, ssh }));
    assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], 'the placed change of a machine nobody asked has no session to start here');
    nothingRecorded(tmp);
  });
  assert.deepEqual(routes.filter((r) => /changes\/rr/.test(r)), [], 'the claims are read with one ls-remote and no gh call');
  assert.match(loopModule.readyText({ change: 'w1', kind: 'wake' }), /w1[^.]*place[^.]*free/);
});

// ---------------------------------------------------------------- change-state: phase 2, the board and the start title (design D-5, D-6, D-9)

// The board text as { id: [block, row text] }, block one of owner, running, blocked, queue, outside.
const BLOCK_KEYS = { 'status-owner': 'owner', 'status-running': 'running', 'status-blocked': 'blocked', 'status-queue': 'queue', 'status-outside': 'outside' };
const placedOn = (text, lang = 'en') => {
  const headings = Object.fromEntries(Object.entries(BLOCK_KEYS).map(([key, block]) => [render(lang, key), block]));
  const out = {};
  let block = null;
  for (const line of text.split('\n')) {
    if (headings[line]) { block = headings[line]; continue; }
    const m = /^ {2}(\S+?) +(.*)$/.exec(line);
    if (m && block) out[m[1]] = [block, m[2]];
  }
  return out;
};
const boardRow = (facts, id = 'a', lang = 'en') => placedOn(boardOf({ ...facts, lang }), lang)[id];

test('change-state AC-6 board: each state\'s row sits in its block', async (t) => {
  const GH = (what) => ['running', render('en', 'running.github', { what })];
  const declaredBlocked = { a: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } };
  const cases = [
    ['waiting for the owner', world({ lines: ['[ ] a'], actions: { a: ownerAct('a') } }), ['owner', render('en', 'gate.approval')]],
    ['running', world({ lines: ['[ ] a'], actions: { a: agentAct('a') } }), ['running', 'Proposal']],
    ['waiting on the checks', world({ lines: ['[ ] a'], actions: { a: githubAct('a', 'checks') } }), GH('checks')],
    ['GitHub did not answer', world({ lines: ['[ ] a'], actions: { a: githubAct('a', 'silent') } }), ['running', 'waiting on GitHub (GitHub did not answer)']],
    ['blocked', world({ lines: ['[ ] a'], actions: { a: blockedAct('a', 'tests-red', { phase: 2 }) } }), ['blocked', 'the tests of phase 2 failed']],
    ['a declared blocked end with no folder', world({ lines: ['[ ] a'], declared: declaredBlocked }), ['blocked', 'it could not be opened (x)']],
    ['a declared wait for the owner', world({ lines: ['[ ] a'], actions: { a: agentAct('a') }, declared: { a: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: {} } } }), ['owner', render('en', `gate.${GATE_OF_WHY['waiting-pr-decision']}`)]],
    ['no session of its own', sessionWorld({ lines: ['[ ] a'], actions: { a: ownerAct('a') } }), ['running', 'no session of its own yet: it starts at your next message']],
    ['a stage in flight', world({ lines: ['[ ] a'], inflight: { a: FLYING } }), ['running', 'proposal']],
  ];
  for (const [label, facts, row] of cases) await t.test(label, () => assert.deepEqual(boardRow(facts), row));
  const archived = world({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: archivedAct('a'), b: agentAct('b') } });
  assert.equal(boardRow(archived, 'a'), undefined, 'the archived entry is in no block');
  assert.deepEqual(boardRow(archived, 'b'), ['running', 'Proposal']);
});

test('change-state AC-6 board parity: every entry kind of entriesOf keeps its block and its words', async (t) => {
  const phased = { ...agentAct('a'), detail: { phase: 2 } };
  const started = { a: { at: AT } };
  const OWN = { 'no session': 'no session of its own yet: it starts at your next message' };
  const cases = [
    // [label, facts, [block, text] in en, [block, text] in pt-BR]
    ['agent', world({ lines: ['[ ] a'], actions: { a: agentAct('a') } }), ['running', 'Proposal'], ['running', 'Proposal']],
    ['agent with a phase', world({ lines: ['[ ] a'], actions: { a: phased }, phaseTotals: { a: 3 } }), ['running', 'Proposal, phase 2 of 3'], ['running', 'Proposal, fase 2 de 3']],
    ['session step', world({ lines: ['[ ] a'], actions: { a: sessionAct('a') } }), ['running', 'Code review'], ['running', 'Code review']],
    ['wait', world({ lines: ['[ ] a'], actions: { a: githubAct('a', 'merge') } }), ['running', 'waiting on GitHub (the merge of the pull request)'], ['running', 'esperando o GitHub (o merge do pull request)']],
    ['grill', world({ lines: ['[ ] a'], actions: { a: grillAct('a') } }), ['owner', 'your answers about its request'], ['owner', 'as suas respostas sobre o pedido']],
    ['owner wait', world({ lines: ['[ ] a'], actions: { a: ownerAct('a') } }), ['owner', 'your approval of the plan'], ['owner', 'a sua aprovação do plano']],
    ['blocked', world({ lines: ['[ ] a'], actions: { a: blockedAct('a', 'tests-red', { phase: 2 }) } }), ['blocked', 'the tests of phase 2 failed'], ['blocked', 'os testes da fase 2 falharam']],
    ['stage in flight', world({ lines: ['[ ] a'], inflight: { a: FLYING } }), ['running', 'proposal'], ['running', 'proposal']],
    ['wait in flight', world({ lines: ['[ ] a'], inflight: { a: { kind: 'wait', what: 'checks', at: AT } } }), ['running', 'waiting on GitHub (the checks of the pull request)'], ['running', 'esperando o GitHub (os checks do pull request)']],
    ['declared blocked', world({ lines: ['[ ] a'], declared: { a: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } } }), ['blocked', 'it could not be opened (x)'], ['blocked', 'não foi possível abrir (x)']],
    ['session mode, no session', sessionWorld({ lines: ['[ ] a'], actions: { a: agentAct('a') } }), ['running', OWN['no session']], ['running', 'ainda sem sessão própria: começa na sua próxima mensagem']],
    ['session mode, own session at the approval', sessionWorld({ lines: ['[ ] a'], actions: { a: ownerAct('a') }, startedSessions: started }), ['owner', 'your approval of the plan'], ['owner', 'a sua aprovação do plano']],
    ['session mode, own session blocked', sessionWorld({ lines: ['[ ] a'], actions: { a: blockedAct('a', 'tests-red', { phase: 2 }) }, startedSessions: started }), ['blocked', 'the tests of phase 2 failed'], ['blocked', 'os testes da fase 2 falharam']],
    ['session mode, own session under way', sessionWorld({ lines: ['[ ] a'], actions: { a: agentAct('a') }, startedSessions: started }), ['running', 'Proposal'], ['running', 'Proposal']],
    ['session mode, own session waiting on GitHub', sessionWorld({ lines: ['[ ] a'], actions: { a: githubAct('a', 'checks') }, startedSessions: started }), ['running', 'waiting on GitHub (the checks of the pull request)'], ['running', 'esperando o GitHub (os checks do pull request)']],
    ['session mode, declared blocked', sessionWorld({ lines: ['[ ] a'], declared: { a: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } } }), ['blocked', 'it could not be opened (x)'], ['blocked', 'não foi possível abrir (x)']],
  ];
  for (const [label, facts, en, pt] of cases) {
    await t.test(label, () => {
      assert.deepEqual(boardRow(facts, 'a', 'en'), en, 'en');
      assert.deepEqual(boardRow(facts, 'a', 'pt-BR'), pt, 'pt-BR');
    });
  }
  await t.test('archived', () => assert.equal(boardRow(world({ lines: ['[ ] a'], actions: { a: archivedAct('a') } })), undefined));
});

test('change-state AC-6 status and state agree: each open roadmap change\'s block is its state\'s', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b', '[ ] c', '[ ] d'));
  for (const id of ['a', 'b', 'c', 'd']) addOpen(root, id);
  putRun(root, {
    places: 4,
    inflight: { b: inFlight('proposal'), d: { kind: 'wait', what: 'merge', at: AT } },
    declared: { c: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } },
  });
  const board = placedOn(doStatus(root).stdout);
  assert.deepEqual(Object.fromEntries(Object.entries(board).map(([id, [block]]) => [id, block])), { a: 'owner', b: 'running', c: 'blocked', d: 'running' });
  const r = changeMain(['state', '--lang', 'en'], { cwd: root, env: cleanEnv, gh: OFFLINE });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const BLOCK_OF = { 'waiting-for-owner': 'owner', blocked: 'blocked', running: 'running', 'waiting-on-github': 'running' };
  const states = Object.fromEntries(JSON.parse(r.stdout).changes.map((e) => [e.change, BLOCK_OF[e.state]]));
  assert.deepEqual(states, Object.fromEntries(Object.entries(board).map(([id, [block]]) => [id, block])));
});

// ---------------------------------------------------------------- state-skips-unlocated: the board (phase 2, design D-4, D-7)

// The setup of this section (design D-7): change `x`'s active folder only in a worktree on branch `side`, nothing of `x` in the main
// checkout; `a` is an ordinary open change of the main checkout. Layers: the board, the roadmap decision and the roadmap stop lock, over
// `collectRoadmap`; suite: roadmap-loop. Every phrase comes from `render`, never a literal.
const unplacedProject = ({ lines = ['[ ] a', '[ ] x'], changes = { a: {} }, branch = 'side' } = {}) => {
  const root = lkProject(lines, changes);
  const wt = join(root, '.claude', 'worktrees', branch);
  git(root, 'worktree', 'add', '-q', '-b', branch, wt);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  put(wt, {
    'openspec/changes/x/.openspec.yaml': 'schema: devkit\n',
    ...Object.fromEntries(['requirements', 'decisions'].map((stage) => [`openspec/changes/x/${LK_PLAN[stage]}`, `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${c0} -->\n# ${stage}\n`])),
  });
  return { root, side: realpathSync(wt) };
};
const wrongBranchText = (lang) => render(lang, 'blocked-why.wrong-branch');
const BLOCK_OF_STATE = { 'waiting-for-owner': 'owner', blocked: 'blocked', running: 'running', 'waiting-on-github': 'running' };
const stateEntriesOf = (root, lang = 'en') => {
  const r = changeMain(['state', '--lang', lang], { cwd: root, env: cleanEnv, gh: OFFLINE });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return Object.fromEntries(JSON.parse(r.stdout).changes.map((e) => [e.change, e]));
};
const boardOfRoot = (root, lang = 'en') => {
  const r = cmd(root, ['status', '--lang', lang, '--load-limit', '80']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return r.stdout;
};

test('unlocated 2: the board lists an unplaced roadmap line under Blocked and the others as before', () => {
  const { root } = unplacedProject();
  const before = placedOn(boardOfRoot(lkProject(['[ ] a', '[ ] x'], { a: {} })));
  const board = placedOn(boardOfRoot(root));
  assert.deepEqual(board.x, ['blocked', wrongBranchText('en')]);
  assert.deepEqual(board.a, before.a, 'a reads as on the same project without the worktree');
  assert.notEqual(board.a[0], 'blocked');
});

test('unlocated 2: the board in Brazilian Portuguese', () => {
  const { root } = unplacedProject();
  const text = boardOfRoot(root, 'pt-BR');
  assert.ok(text.split('\n').includes(render('pt-BR', 'status-blocked')), text);
  assert.deepEqual(placedOn(text, 'pt-BR').x, ['blocked', wrongBranchText('pt-BR')]);
  assert.notEqual(wrongBranchText('pt-BR'), wrongBranchText('en'));
});

test('unlocated 2: the board and the state command agree on every open roadmap change, and on x\'s words', () => {
  const { root } = unplacedProject();
  const board = placedOn(boardOfRoot(root));
  const states = stateEntriesOf(root);
  assert.deepEqual(Object.keys(board).sort(), ['a', 'x']);
  for (const id of ['a', 'x']) assert.equal(board[id][0], BLOCK_OF_STATE[states[id].state], `${id}: the block is the state's`);
  assert.equal(board.x[1], states.x.reason.text, 'x\'s words are the state\'s reason text');
});

test('unlocated 2: a roadmap decision says once that x stopped and hands a\'s stage', () => {
  const { root } = unplacedProject();
  putRun(root, { places: 2 });
  const first = doNext(root);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const stopped = say('roadmap-blocked-others', { id: 'x', why: 'wrong-branch' });
  assert.deepEqual(events(first.stdout).filter((l) => l === stopped), [stopped], 'x\'s stop is said once, with the others going on');
  assert.deepEqual(jsonOf(first.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'agent']]);
  const second = doNext(root);
  assert.equal(second.code, 0, second.stdout + second.stderr);
  assert.deepEqual(events(second.stdout), [], 'a second decision repeats no line');
});

test('unlocated 2: the roadmap stop lock refuses for a\'s ready stage with x unplaced', () => {
  const { root } = unplacedProject();
  putRun(root, { places: 2 });
  const { d } = stopOf(root, lkRun(2));
  assert.deepEqual([d.decision, d.change], ['refuse', 'a'], d.reason ?? d.why);
  assert.match(d.reason, /the change a has the stage proposal ready/);
});

test('unlocated 2: the roadmap stop lock lets the stop through when x is the only open line', () => {
  const { root } = unplacedProject({ lines: ['[ ] x'], changes: {} });
  putRun(root, { places: 1 });
  const { d } = stopOf(root, lkRun(1));
  assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], d.reason ?? d.why);
});

test('unlocated 2: a placed roadmap line reads as before', () => {
  const { root } = unplacedProject({ branch: 'x' });
  const board = placedOn(boardOfRoot(root));
  const s = changeLoopModule.changeState(changeLoopModule.nextAction(root, 'x', { env: cleanEnv, lang: 'en', gh: OFFLINE }), null, { lang: 'en' });
  assert.notEqual(board.x[0], 'blocked', 'x is placed: its worktree is on the branch x');
  assert.deepEqual(board.x, [BLOCK_OF_STATE[s.state], render('en', 'running.stage', { title: s.stageTitle })]);
});

test('unlocated 2: the board follows the run file first for an unplaced line, as the state command does', async (t) => {
  const { root } = unplacedProject();
  await t.test('a declared end of x wins over the stand-in', () => {
    putRun(root, { places: 2, declared: { x: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } } });
    const row = placedOn(boardOfRoot(root)).x;
    const s = stateEntriesOf(root).x;
    assert.deepEqual(row, ['blocked', render('en', 'blocked-why.tests-red', { phase: 1 })]);
    assert.deepEqual([s.state, s.reason.code, row[1]], ['blocked', 'tests-red', s.reason.text]);
  });
  await t.test('a stage of x in flight reads as running', () => {
    putRun(root, { places: 2, inflight: { x: inFlight('design') } });
    const row = placedOn(boardOfRoot(root)).x;
    const s = stateEntriesOf(root).x;
    assert.deepEqual([s.state, s.stage], ['running', 'design']);
    assert.deepEqual(row, [BLOCK_OF_STATE[s.state], render('en', 'running.stage', { title: s.stageTitle })]);
  });
});

test('change-state AC-7 start: a change session starts with its state\'s title', () => {
  const r = decideRoadmap(sessionWorld({
    lines: ['[ ] a', '[ ] b', '[ ] c'], places: 3, actions: { a: agentAct('a'), b: grillAct('b'), c: ownerAct('c') },
  }));
  const titles = Object.fromEntries(r.actions.map((x) => [x.change, [x.title, x.input.title]]));
  assert.deepEqual(titles, { a: ['📝 a', '📝 a'], b: ['🙋 ❓ b', '🙋 ❓ b'], c: ['🙋 📝 c', '🙋 📝 c'] });
});

// ================================================================ roadmap-sessions-upfront, phase 5: the held state through changeState (design D-6, D-11)

// The state changeState derives for change `id` of a run with a session per change started at AT, with the records a decision left.
const heldStateOf = (action, records, waitsFor = null, lang = 'en') => changeLoopModule.changeState(
  action,
  changeLoopModule.runFactsOf({ changeSessions: true, startedSessions: { [action.change]: { at: AT } }, occupied: records.occupied, queued: records.queued, waitsFor: { [action.change]: waitsFor } }, action.change, { onRoadmap: true }),
  { lang },
);

test('upfront AC-10 session-next: every held action carries the state changeState derives, and its title and icon come from it', () => {
  const cases = [
    ['place', implAct('a'), { occupied: { b: { at: AT } } }, 'held-place', '⏳', '⏳ a'],
    ['load', implAct('a'), { load: 95 }, 'held-load', '⏳', '⏳ a'],
    ['after', agentAct('a', 'proposal'), { waitsFor: 'x' }, 'held-after', '⏳', '⏳ a'],
    ['owner', grillAct('a'), {}, 'grill', '❓', '🙋 ❓ a'],
  ];
  for (const [name, action, over, code, icon, title] of cases) {
    const r = sd(action, over);
    const h = r.action;
    assert.equal(h.kind, 'held', name);
    const expected = heldStateOf(action, r, over.waitsFor ?? null);
    assert.equal(expected.reason?.code, code, `${name}: the state's reason`);
    assert.deepEqual(h.state, expected, `${name}: the state is changeState's`);
    assert.deepEqual([h.sessionTitle, h.icon], [title, icon], name);
    assert.equal(h.sessionTitle, h.state.title, `${name}: the title is the state's`);
  }
  const ownerState = sd(grillAct('a')).action.state;
  assert.deepEqual([ownerState.state, ownerState.stateIcon, ownerState.stageIcon], ['waiting-for-owner', '🙋', '❓']);
  assert.equal(sd(ownerAct('a')).action.sessionTitle, '🙋 📝 a');
  assert.equal(sd(implAct('a')).action.state, undefined, 'a claimed change gets the change loop\'s action back, with no state of ours');
});

test('upfront AC-10 status: a held row is placed by the state\'s reason, in the queue with its words', () => {
  const impl = (id) => agentAct(id, 'implementation', { stageTitle: 'Implementation' });
  for (const lang of ['en', 'pt-BR']) {
    const facts = sessionWorld({
      lang, lines: ['[ ] a', '[ ] b', '[ ] c (after: a)', '[ ] d'], places: 1,
      actions: { a: impl('a'), b: impl('b'), c: agentAct('c'), d: impl('d') },
      startedSessions: Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, { at: AT }])),
      occupied: { a: { at: AT } }, queued: { b: { at: AT, why: 'place' }, d: { at: AT2, why: 'load' } }, waitsFor: { c: 'a' },
    });
    const rows = boardOf(facts).split('\n');
    const queueAt = rows.indexOf(render(lang, 'status-queue'));
    assert.ok(queueAt >= 0, `${lang}: the queue block`);
    for (const id of ['b', 'c', 'd']) {
      const s = heldStateOf(facts.actions[id], { occupied: facts.occupied, queued: facts.queued }, facts.waitsFor[id] ?? null, lang);
      assert.match(s.reason?.code ?? '', /^held-/, `${lang} ${id}: the state's reason`);
      const at = rows.indexOf(`  ${id.padEnd(4)}${s.reason.text}`);
      assert.ok(at > queueAt, `${lang} ${id}: ${s.reason.text}\n${rows.join('\n')}`);
    }
  }
});

test('upfront AC-10 command: the state command, session-next and the board agree on a change held for a place and one held for a dependency', () => {
  const placeRoot = upChange({ roadmap: ['[ ] a'], run: { occupied: { b: { at: AT } } } });
  approve(placeRoot);
  const next = jsonOf(doSessionNext(placeRoot).stdout);
  assert.deepEqual([next.kind, next.held.why, next.sessionTitle], ['held', 'place', '⏳ a']);
  const stateEntry = JSON.parse(changeLoopModule.main(['state', '--change', 'a', '--lang', 'en'], { cwd: placeRoot, env: cleanEnv, gh: OFFLINE }).stdout).changes[0];
  assert.deepEqual([stateEntry.state, stateEntry.reason.code, stateEntry.title], ['running', 'held-place', '⏳ a']);
  for (const key of ['state', 'reason', 'stage', 'stageTitle', 'phase', 'stageIcon', 'stateIcon', 'title']) assert.deepEqual(next.state[key], stateEntry[key], `place: ${key}`);
  assert.ok(doStatus(placeRoot).stdout.split('\n').includes(`  a   ${stateEntry.reason.text}`), doStatus(placeRoot).stdout);

  const { root, wt } = upBase({ archive: false });
  const afterNext = sessionNextOf(wt, 'b');
  assert.deepEqual([afterNext.kind, afterNext.held.why, afterNext.held.after], ['held', 'after', 'a']);
  const afterEntry = JSON.parse(changeLoopModule.main(['state', '--change', 'b', '--lang', 'en'], { cwd: wt, env: cleanEnv, gh: OFFLINE }).stdout).changes[0];
  assert.deepEqual([afterEntry.state, afterEntry.reason.code, afterEntry.reason.text, afterEntry.title], ['running', 'held-after', 'open, waits for a', '⏳ b']);
  for (const key of ['state', 'reason', 'stage', 'stageTitle', 'phase', 'stageIcon', 'stateIcon', 'title']) assert.deepEqual(afterNext.state[key], afterEntry[key], `after: ${key}`);
  const board = doStatus(root).stdout;
  assert.ok(board.split('\n').some((r) => r.startsWith('  b') && r.endsWith(afterEntry.reason.text)), board);
});

// ================================================================ roadmap-sessions-upfront, phase 7: the fixes of review round 1 (design D-16)

// A process that is still running a second after a decision that may have signalled it; false as soon as it exits.
const stillAlive = (child) => new Promise((resolve) => {
  if (!alive(child)) return resolve(false);
  const timer = setTimeout(() => resolve(alive(child)), 1000);
  return child.once('exit', () => { clearTimeout(timer); resolve(false); });
});

// Invariant (AC-12, finding 1): approval.md on origin is the record that the plan was pushed, so a tick of tasks.md asks no second push and an approval
// written again does. Layer: next command and push command. Suite: roadmap-loop.
test('upfront AC-12 next: ticks of tasks.md after the plan was pushed ask no second plan push, and an approval written again does', () => {
  const { root, origin } = upPushed();
  const approval = (attempt) => `<!-- devkit-stage approval result=passed attempt=${attempt} commit=none -->\n# Plan approval: a\n\n- Status: APPROVED\n`;
  const send = (what) => cmd(root, ['push', '--change', 'a', '--what', what, '--lang', 'en'], PUSH_OPTS);
  assert.equal(send('grill').code, 0);
  put(root, { 'openspec/changes/a/approval.md': approval(1) });
  const first = send('plan');
  assert.equal(first.code, 0, first.stdout + first.stderr);
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), [], 'the plan and its approval are on origin');
  // The implementer ticks a box of tasks.md: left in the tree, then committed and not pushed. Neither asks a second push of the plan.
  const tasks = 'openspec/changes/a/tasks.md';
  put(root, { [tasks]: readFileSync(join(root, tasks), 'utf8').replace('- [ ] 1.1 a', '- [x] 1.1 a') });
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), [], 'a tick left in the tree');
  commitAll(root, 'tick 1.1');
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), git(origin, 'rev-parse', 'a'), 'the tick is committed and origin does not hold it');
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), [], 'a tick committed and not pushed');
  // The owner approves the revised plan again: the new approval.md is not on origin, so the plan is pushed once more, with the tick.
  put(root, { 'openspec/changes/a/approval.md': approval(2) });
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)).map((a) => [a.change, a.what]), [['a', 'plan']]);
  const again = send('plan');
  assert.equal(again.code, 0, again.stdout + again.stderr);
  assert.match(git(origin, 'show', 'a:openspec/changes/a/approval.md'), /attempt=2/, 'origin holds the new approval');
  assert.match(git(origin, 'show', 'a:openspec/changes/a/tasks.md'), /- \[x\] 1\.1 a/, 'with the plan files');
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), []);
});

// Invariant (AC-2, finding 2): a module that cannot load never refuses another skill, and the entry fails closed. Layer: the guard process in `skill`
// mode. Suite: roadmap-loop.
test('upfront AC-2 guard: guard.mjs skill lets another skill through without loading roadmap-loop.mjs, and refuses devkit-session when it cannot load', () => {
  const folder = tmpFolder('devkit-upfront-skill-');
  writeFileSync(join(folder, 'guard.mjs'), readFileSync(GUARD));
  writeFileSync(join(folder, 'roadmap-loop.mjs'), 'throw new Error(\'this module cannot load\');\n');
  const log = join(folder, 'hooks.jsonl');
  const call = (skill) => spawnSync(process.execPath, [join(folder, 'guard.mjs'), 'skill'], {
    input: JSON.stringify({ session_id: UP_SESSION, cwd: folder, tool_name: 'Skill', tool_input: { skill } }), encoding: 'utf8', env: { ...process.env, ...SET, DEVKIT_HOOK_LOG: log },
  });
  const other = call('review-change');
  assert.equal(other.status, 0, other.stderr);
  const scoped = call('devkit-openspec:devkit-session');
  assert.equal(scoped.status, 2, scoped.stdout);
  assert.match(scoped.stderr, /\/devkit change <id>/, 'the reason names the owner\'s own command');
  assert.equal(call('devkit-session').status, 2, 'the bare name too');
  const records = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(records.map((r) => [r.mode, r.decision, r.why]), [['skill', 'allow', 'not-entry'], ['skill', 'refuse', 'unreadable'], ['skill', 'refuse', 'unreadable']]);
});

// Invariant (AC-14, finding 3): only a process started as the run's wait loop is signalled. Layer: isWaitProcess. Suite: roadmap-loop.
test('upfront AC-14 isWaitProcess: only a process started as roadmap-loop.mjs wait or session-wait is a wait loop', () => {
  const loop = join(HOOKS_DIR, 'roadmap-loop.mjs');
  const started = (...args) => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)', ...args], { stdio: 'ignore' });
  const children = { session: started(loop, 'session-wait'), github: started(loop, 'wait'), plain: started(), check: started(loop, 'check'), other: started(join(HOOKS_DIR, 'other.mjs'), 'wait'), longer: started(loop, 'waiting') };
  try {
    assert.equal(loopModule.isWaitProcess(children.session.pid), true, 'a session-wait child');
    assert.equal(loopModule.isWaitProcess(children.github.pid), true, 'a wait child');
    assert.equal(loopModule.isWaitProcess(children.plain.pid), false, 'a plain child');
    assert.equal(loopModule.isWaitProcess(children.check.pid), false, 'a child started as roadmap-loop.mjs check');
    assert.equal(loopModule.isWaitProcess(children.other.pid), false, 'a child started as other.mjs wait');
    assert.equal(loopModule.isWaitProcess(children.longer.pid), false, 'a child whose word only begins with wait');
  } finally { reap(...Object.values(children)); }
  assert.equal(loopModule.isWaitProcess(deadPid()), false, 'a dead pid');
  for (const pid of [0, -1, 1.5, '123', NaN, null, undefined]) assert.equal(loopModule.isWaitProcess(pid), false, `${String(pid)} is no pid`);
  const dead = deadPid();
  assert.equal(loopModule.waitAlive({ pid: dead, kind: 'session', at: AT }), false, 'waitAlive: a dead pid');
  assert.equal(loopModule.waitAlive({ pid: process.pid, kind: 'session', at: AT }), false, 'waitAlive: a live process that is no wait loop');
});

// Invariant (AC-14, finding 3): the check signals only a process that is still a wait loop, and forgets every stale entry. Layer: check. Suite: roadmap-loop.
test('upfront AC-14 check: a live process that is not a wait loop, recorded as a stale wait, is spared and forgotten', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const [lent, newer] = [stranger(), sleeper()];
  try {
    putRun(root, { changeSessions: true, places: 1, ...startedIn('a'), waits: { a: [waitOf(lent), waitOf(newer, 'session', AT2)] } });
    const r = doCheck(root);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.equal(await stillAlive(lent), true, 'a process that took the number is not signalled');
    assert.deepEqual(stateOf(root).waits.a.map((w) => w.pid), [newer.pid], 'and the record forgets it');
    assert.equal(alive(newer), true, 'the newest wait loop keeps running');
    assert.ok(!events(r.stdout).some((l) => /wait loops? of the run/.test(l)), `no wait loop was stopped: ${events(r.stdout).join('|')}`);
  } finally { reap(lent, newer); }
});

// Invariant (AC-15, finding 3): the end of the run signals no process that is not a wait loop, and the record forgets what it was asked to stop.
// Layer: decide. Suite: roadmap-loop.
test('upfront AC-15 decide: the end done spares a recorded pid that is not a wait loop and forgets it', async () => {
  const root = projectWith(roadmapText('[ ] z'));
  archiveOn(root, 'z');
  const lent = stranger();
  try {
    putRun(root, { changeSessions: true, places: 1, turn: 'typed', ...startedIn('z'), waits: { z: [waitOf(lent)] } });
    const r = doNext(root, ['--turn', 'typed']);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.equal(jsonOf(r.stdout).end.why, 'done');
    assert.equal(await stillAlive(lent), true, 'the process that took the number keeps running');
    assert.deepEqual(stateOf(root).waits, {}, 'and the run records no wait loop');
  } finally { reap(lent); }
});

// Invariant (AC-9, finding 4): a change no longer open holds no place and no queue entry. Layer: check. Suite: roadmap-loop.
test('upfront AC-9 check: a change that left the roadmap or was archived frees its place and its queue entry, and the change queued behind it takes the place', () => {
  const held = { changeSessions: true, places: 1, ...startedIn('b'), occupied: { gone: { at: AT } }, queued: { b: { at: AT2, why: 'place' } } };
  const left = projectWith(roadmapText('[ ] b'));
  addOpen(left, 'b');
  putRun(left, held);
  const r = doCheck(left);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual([Object.keys(stateOf(left).occupied), stateOf(left).queued], [['b'], {}], 'gone has no line: b takes the place');
  const archived = projectWith(roadmapText('[ ] gone', '[ ] b'));
  addOpen(archived, 'b');
  archiveOn(archived, 'gone');
  putRun(archived, held);
  const a = doCheck(archived);
  assert.equal(a.code, 0, a.stdout + a.stderr);
  assert.deepEqual([Object.keys(stateOf(archived).occupied), stateOf(archived).queued], [['b'], {}], 'gone is archived: b takes the place');
  const open = projectWith(roadmapText('[ ] gone', '[ ] b'));
  addOpen(open, 'gone');
  addOpen(open, 'b');
  putRun(open, { ...held, ...startedIn('b', 'gone') });
  doCheck(open);
  assert.deepEqual([Object.keys(stateOf(open).occupied), Object.keys(stateOf(open).queued)], [['gone'], ['b']], 'a change still open keeps its place');
});

// Invariant (AC-9, finding 4): the coordinating decision prunes the records of lines no longer open in a run with a session per change, and only there.
// Layer: next command. Suite: roadmap-loop.
test('upfront AC-9 next: a coordinating decision prunes the places and queue entries of lines no longer open, and a run without a session per change keeps them', () => {
  const records = () => ({ occupied: { a: { at: AT }, gone: { at: AT }, z: { at: AT } }, queued: { gone: { at: AT2, why: 'place' }, z: { at: AT2, why: 'load' } }, anyway: ['gone'] });
  const root = projectWith(roadmapText('[ ] a', '[ ] z'));
  addOpen(root, 'a');
  archiveOn(root, 'z');
  putRun(root, { changeSessions: true, places: 3, turn: 'typed', ...startedIn('a'), ...records() });
  const r = doNext(root, ['--turn', 'typed']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual([Object.keys(stateOf(root).occupied), stateOf(root).queued], [['a'], {}], 'only the open line keeps its record');
  assert.deepEqual(stateOf(root).anyway, ['gone'], 'anyway is no record of a place: it is not pruned');
  const plain = projectWith(roadmapText('[ ] a', '[ ] z'));
  addOpen(plain, 'a');
  archiveOn(plain, 'z');
  putRun(plain, { places: 3, turn: 'typed', ...records() });
  const p = doNext(plain, ['--turn', 'typed']);
  assert.equal(p.code, 0, p.stdout + p.stderr);
  assert.deepEqual([Object.keys(stateOf(plain).occupied).sort(), Object.keys(stateOf(plain).queued).sort()], [['a', 'gone', 'z'], ['gone', 'z']], 'a run with no session per change keeps them');
});

// Invariant (AC-14, finding 5): the check has the triage answer a grill whose requirements hold no triage section by the loop's own reader. Layer: check.
// Suite: roadmap-loop.
// (T-20, D-13: the changes the check gives a triage for, `c` and `d`, record flow 2; the others keep their files.)
test('upfront AC-14 check: a triage heading inside a fence or with words after it gives the triage action, and a plain heading does not', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] c', '[ ] d', '[ ] e'));
  for (const id of ['a', 'c', 'd', 'e']) addOpen(root, id, id === 'c' || id === 'd' ? 2 : null);
  const answer = '1. [scope] q → a (source: `x.md`)';
  const header = '<!-- devkit-stage requirements result=failed attempt=1 commit=none -->'; // a grill under way on the current script: no previous-script change, no passed stage
  put(root, {
    'openspec/changes/c/requirements.md': `${header}\n# Requirements\n\n\`\`\`md\n### Answered by triage\n\n${answer}\n\`\`\`\n`,
    'openspec/changes/d/requirements.md': `${header}\n# Requirements\n\n### Answered by triage (draft)\n\n${answer}\n`,
    'openspec/changes/e/requirements.md': `${header}\n# Requirements\n\n### Answered by triage\n\n${answer}\n`,
  });
  putRun(root, { changeSessions: true, places: 4, turn: 'typed', ...startedIn('a', 'c', 'd', 'e') });
  const r = doCheck(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const j = jsonOf(r.stdout);
  assert.equal(j.ask.change, 'a', 'a is the grill being asked');
  assert.deepEqual(events(r.stdout).filter((l) => l.includes('waits for your answers')).length, 4, 'a, c, d and e are all grills, none of the previous script');
  assert.deepEqual(j.actions.filter((a) => a.kind === 'triage').map((a) => a.change), ['c', 'd'], 'a fenced heading and a heading with words after it are no section; e has its triage');
});

// Invariant (AC-14, D-17): the check gives the triage only for a grill whose flow lists it: a change on flow 1 (no pin, or `x-devkit-flow: 1`) gets none, a
// change on flow 2 gets one when its requirements hold no triage section. Layer: check. Suite: roadmap-loop.
test('upfront AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b', '[ ] c', '[ ] d'));
  const header = '<!-- devkit-stage requirements result=failed attempt=1 commit=none -->'; // a grill under way on the current script
  for (const [id, flow] of [['a', 2], ['b', null], ['c', 1], ['d', 2]]) {
    addOpen(root, id, flow);
    put(root, { [`openspec/changes/${id}/requirements.md`]: `${header}\n# Requirements\n` });
  }
  commitAll(root, 'the grills');
  putRun(root, { changeSessions: true, places: 4, turn: 'typed', ...startedIn('a', 'b', 'c', 'd') });
  const r = doCheck(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const j = jsonOf(r.stdout);
  assert.equal(j.ask.change, 'a', 'a is the grill being asked');
  assert.equal(events(r.stdout).filter((l) => l.includes('waits for your answers')).length, 4, 'all four are grills');
  assert.deepEqual(j.actions.filter((a) => a.kind === 'triage').map((a) => a.change), ['d'], 'b has no pin and c is on flow 1: no triage; d is on flow 2');
});

// Invariant (AC-9, finding 6): the stop of a change session reaches changeSessionStopDecision through the real hook. Layer: the guard process in `stop`
// mode. Suite: roadmap-loop. (It pins phase 2's behaviour: it passes on the code it was written against.)
test('upfront AC-9 lock stop: guard.mjs stop lets a claimed change session held for a place stop with a held log line, and refuses a session that did not claim the ticket', () => {
  const log = join(lkSandbox(), 'hooks.jsonl');
  const env = { TMPDIR: lkSandbox(), DEVKIT_HOOK_LOG: log, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' };
  const held = upChange({ run: { tickets: upTickets('a', { claimedBy: LK_SESSION }), occupied: { b: { at: AT } } } });
  approve(held);
  const before = readFileSync(runFileOf(held), 'utf8');
  const stop = lkHook('stop', upStopInput(held), env);
  assert.equal(stop.code, 0, stop.err);
  assert.equal(readFileSync(runFileOf(held), 'utf8'), before, 'the stop writes nothing');
  const other = upChange({ run: { tickets: upTickets('a', { claimedBy: 'S-other' }), occupied: { b: { at: AT } } } });
  approve(other);
  const refused = lkHook('stop', upStopInput(other), { ...env, TMPDIR: lkSandbox() });
  assert.equal(refused.code, 2, refused.out);
  assert.match(refused.err, /implementation/i, 'the reason names the stage that is ready');
  const records = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(records.map((x) => [x.mode, x.decision, x.why, x.change]), [['stop', 'allow', 'held', 'a'], ['stop', 'refuse', 'stage-ready', 'a']]);
});

// Invariant (AC-9, finding 7): of two sessions that reach the last place at once, the one that finds it taken under the lock is held. Layer: sessionNext.
// Suite: roadmap-loop. (It pins phase 2's behaviour: it passes on the code it was written against.)
test('upfront AC-9 session-next: the place is decided again on the run file as read under its lock, so of two sessions only one takes the last place', () => {
  const root = upChange();
  approve(root);
  const lock = lockFileOf(root);
  mkdirSync(dirname(lock), { recursive: true });
  writeFileSync(lock, '');
  const calls = [];
  const lockSleep = () => { // the other session takes the place while this one waits for the lock
    calls.push(1);
    if (calls.length > 1) return;
    writeFileSync(runFileOf(root), JSON.stringify({ ...stateOf(root), occupied: { b: { at: AT } } }));
    rmSync(lock);
  };
  const action = loopModule.sessionNext(root, 'a', { env: cleanEnv, lang: 'en', load: 10, limit: 80, gh: OFFLINE, write: true, lockSleep });
  assert.equal(calls.length, 1, 'the call waited for the lock once');
  assert.deepEqual([action.kind, action.held?.why], ['held', 'place'], 'the place a first read found free was taken: the decision is made again');
  assert.deepEqual([Object.keys(stateOf(root).occupied), Object.keys(stateOf(root).queued), stateOf(root).queued.a?.why], [['b'], ['a'], 'place']);
});

// The first message of the session the roadmap run started on 2026-11-22 for this change, as the transcript recorded it (Claude Code 2.1.326):
// its text line for line, every absolute path of the owner's machine as `<home>/...`, every app session id as `local_<n>` and the names of the
// owner's two machines as `<machine-1>` and `<machine-2>` (the repository is public). The record's other keys keep their values. It begins with a
// note of the host (the list of linked sessions) before the started form, and its task is a hand-written brief, not `/devkit change <id>`.
const REAL_STARTED_2026_11_22 = {
  type: 'user',
  isSidechain: false,
  promptSource: 'sdk',
  turnOrigin: 'host_synthetic',
  entrypoint: 'claude-desktop',
  version: '2.1.326',
  userType: 'external',
  message: {
    role: 'user',
    content: [
  '<system-reminder>',
  'Linked sessions now (status, not an instruction): rcf = local_<n> (done, PR #47); msff = local_<n> (done, PR #46); rwp = local_<n> (done, PR #56); sr = local_<n> (done, PR #58); msfp = local_<n> (done, PR #51); dm = local_<n> (idle); pp = local_<n> (done, PR #55); rmc = local_<n> (idle); rof = local_<n> (working); cvp = local_<n> (working); cs = local_<n> (working); cb = local_<n> (working); ca = local_<n> (working). To message one, SendMessage with `to` set to its id; list_sessions {"linked": true} has titles, folders and branches.',
  '</system-reminder>',
  '',
  'Background (from the session that started this one):',
  'The owner is delivering the whole devkit roadmap (`chacal88/devkit`, public, every file in English) with one app session per change across two machines, the <machine-1> and a Linux worker (<machine-2>). To go faster, every ready change was opened at once: all grills and plans run now with the owner, and a coordinating session lets at most two changes per machine implement at the same time.',
  '',
  'Task:',
  'You hold the already-open devkit change `roadmap-sessions-upfront` (devkit script; its `requirements.md` holds the request, round 18d of `openspec/roadmap.md`, added by PR 60). The coordinating roadmap session on <machine-1> opened it and started you. This very run (every change opened at once, a coordinating session holding the places by message) is the manual version of what this change builds: use what the owner sees in it as grill input.',
  '',
  'First message to the owner, in Brazilian Portuguese: one line on who started you and why (the owner asked to open every ready change at once), then ask them to type `/devkit-openspec:devkit change roadmap-sessions-upfront` here. The devkit skill only runs when the owner types it; do not run its flow by hand.',
  '',
  'Once the owner has typed it, follow the skill one stage at a time. Rules:',
  '- Grill with the owner one question at a time. The owner follows from the phone, so end every message that waits on them with the question and its options in plain text. Plan approval and retro answers come only from the owner\'s own message.',
  '- Rename this session\'s title by stage: ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery, 📦 archive, ⏳ waiting for a place.',
  '- **Place limit:** after the owner approves the plan, do NOT start the implementation. Set the title to ⏳ and end the turn, saying in one line that the change waits for a free place. The coordinating session sends a message here when a place frees; only then implement. The grill and the plan never wait.',
  '- Never use a trailing `&`; start long runs (the guard suite takes about 13 minutes) with the Bash tool\'s background option. Never leave a wait loop running after its turn: stop your own background loops before you end a stage.',
  '- Many sibling changes touch the same hooks and release files. Version and ADR-number collisions are resolved at your release step, against `origin/main` of that day. Auto-merge as the flow says.',
  '- Write only in this worktree.',
  '',
  'Shared notes folder for this group of sessions (outside the repo; read siblings\' notes there, leave hand-over notes or large findings there instead of pasting them into messages): <home>/Library/Application Support/Claude/side-session-notes/local_<n>'
    ].join('\n'),
  },
};

// Invariant (AC-1, AC-2, finding 8): the entry reads the real first message of a started session through its host note, refuses its hand-written task, and
// claims it once the run's task and start line stand in its envelope. Layer: startedTaskOf and entryDecision. Suite: roadmap-loop.
test('upfront AC-1 entry: the real first message of a started session is read through its host note, background, Task line and task, refused for its hand-written task, and with the run\'s task put in refused for want of a start line and claimed with one', () => {
  const content = REAL_STARTED_2026_11_22.message.content;
  assert.ok(content.startsWith('<system-reminder>\n'), 'the message begins with a note of the host');
  const task = guardModule.startedTaskOf(content);
  assert.ok(task, 'the started form is read after the host note');
  assert.equal(task[0].startsWith('You hold the already-open devkit change'), true, 'the task is the hand-written brief');
  assert.equal(task.join('\n'), content.slice(content.indexOf('You hold the already-open devkit change')), 'from the brief to the closing notes paragraph');
  assert.ok(task.at(-1).startsWith('Shared notes folder'), 'the closing notes paragraph ends it');
  const record = (text) => JSON.stringify({ ...REAL_STARTED_2026_11_22, message: { ...REAL_STARTED_2026_11_22.message, content: text } });
  const real = upEntry({ lines: [record(content), lkAssistant()] });
  const refused = entryOf(real);
  assert.deepEqual(labelOf(refused), ['refuse', 'not-started'], 'a hand-written brief is no /devkit change task');
  assert.equal(stateOf(real.root).tickets.a.claimedBy, null, 'nothing was claimed');
  // The run's own start in the same envelope: its task and, below it, its start line.
  const head = content.slice(0, content.indexOf('You hold the already-open devkit change'));
  const closing = content.slice(content.indexOf('Shared notes folder'));
  const envelope = (...taskLines) => `${head}${taskLines.map((l) => `${l}\n`).join('')}\n${closing}`;
  const noStart = upEntry({ lines: [record(envelope('/devkit-openspec:devkit change a')), lkAssistant()] });
  assert.deepEqual(labelOf(entryOf(noStart)), ['refuse', 'no-ticket'], 'the run\'s task with no start line');
  const started = upEntry({ lines: [record(envelope('/devkit-openspec:devkit change a', `devkit-start: a ${UP_TICKET}`)), lkAssistant()] });
  const claimed = entryOf(started);
  assert.deepEqual([claimed.decision, claimed.why, claimed.change], ['allow', 'claimed', 'a']);
  assert.equal(stateOf(started.root).tickets.a.claimedBy, UP_SESSION, 'the first session claims the ticket');
});

// Invariant (AC-8, finding 9): after a merge of the default branch that conflicts, the change session declares the end blocked, so no later session-next
// hands the merge again. Layer: the skill's text and the loop's reply command. Suite: roadmap-loop.
test('upfront AC-8 skill: after a merge-base exit 3 the change session declares the end blocked with base-conflict and ends the run', () => {
  const item = sectionOf(sessionSkillMd(), '## Loop', '## Never').split('\n').find((l) => l.startsWith('3. '));
  assert.ok(item, 'Loop item 3');
  assert.ok(item.includes('exits 3'), 'it says when');
  assert.ok(item.includes('change-loop.mjs reply blocked --param id=<id> --param why=base-conflict --param error='), 'it names the declaration');
  assert.ok(item.includes('--lang ${user_config.language}'), 'in the person\'s language');
  assert.match(item, /shows its reply and ends the run/);
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const r = changeMain(['reply', 'blocked', '--param', 'id=a', '--param', 'why=base-conflict', '--param', 'error=x', '--lang', 'en'], { cwd: root, env: cleanEnv, gh: OFFLINE });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.split('\n')[0], 'devkit-end: a blocked');
  assert.ok(r.stdout.includes(render('en', 'blocked-why.base-conflict', { error: 'x' })), r.stdout);
});

// Invariant (AC-1, AC-2, review round 1): ADR 0021 is accepted by the owner's words in approval.md with its amendments of ADR 0004 and ADR 0010's decision 8,
// its Notes and the config line follow, and the changelog calls the new subcommands by name and the two actions actions. Layer: the documents. Suite: roadmap-loop.
test('upfront ADR 0021: the documents follow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const flat = (text) => text.replace(/\s+/g, ' ');
  const name = '0021-a-roadmap-run-opens-every-change-at-its-start.md';
  const adr = read('docs', 'adr', name);
  assert.match(adr, /^- Status: accepted$/m);
  const changes = join(REPO, 'openspec', 'changes');
  const archived = existsSync(join(changes, 'archive')) ? readdirSync(join(changes, 'archive')).filter((d) => /^\d{4}-\d{2}-\d{2}-roadmap-sessions-upfront$/.test(d)).sort() : [];
  const approvalPath = existsSync(join(changes, 'roadmap-sessions-upfront', 'approval.md')) ? join(changes, 'roadmap-sessions-upfront', 'approval.md') : join(changes, 'archive', archived.at(-1) ?? '', 'approval.md');
  const approval = readFileSync(approvalPath, 'utf8');
  const date = approval.match(/^- Date: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  const words = approval.match(/^- Owner's words: "(.+)"$/m)?.[1].replaceAll('`', '');
  assert.ok(date && words, 'approval.md has its date and the owner\'s words');
  const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(adr, new RegExp(`^- Accepted by: the owner, on ${date}, in the message that approved the plan of the change: \`${escaped(words)}\`; recorded in \`openspec/changes/roadmap-sessions-upfront/approval\\.md\`$`, 'm'));
  const amends = flat(adr.slice(adr.indexOf('- Amends:'), adr.indexOf('\n\n', adr.indexOf('- Amends:'))));
  assert.match(amends, /ADR 0004 \(0004-devkit-per-project\.md\)/, 'it amends ADR 0004');
  assert.match(amends, /ADR 0010 \(0010-openspec-as-the-harness\.md\)[^;]*decision 8/, 'and ADR 0010\'s decision 8');
  const decision = flat(sectionOf(adr, '## Decision', '## Consequences'));
  for (const word of ['renumber', 'follow-up']) assert.ok(decision.includes(word), `the Decision says ${word}`);
  const link = `[ADR 0021](${name})`;
  const adr4 = read('docs', 'adr', '0004-devkit-per-project.md');
  assert.ok(adr4.split('\n').slice(0, 8).includes(`- Amended by ADR 0021 (${name})`), 'ADR 0004 has the Amended by line in its header');
  const note4 = flat(adr4.slice(adr4.indexOf('Note (roadmap-sessions-upfront')));
  assert.ok(adr4.includes('Note (roadmap-sessions-upfront'), 'ADR 0004 has the Note');
  assert.ok(note4.split(' Note (')[0].includes(link), 'the Note links ADR 0021');
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  const note10 = flat(adr10.slice(adr10.indexOf('Note (roadmap-sessions-upfront'))).split(' Note (')[0];
  assert.ok(adr10.includes('Note (roadmap-sessions-upfront'), 'ADR 0010 has the Note');
  assert.ok(/decision 8/i.test(note10) && note10.replaceAll('`', '').includes('a lone /devkit change'), 'ADR 0010\'s Note names decision 8 and the lone change');
  const adrs = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.ok(adrs.includes('amends 0004, 0006, 0010, 0011, 0013, 0014, 0017 and 0020'), 'the ADRs line names the amended ADRs');
  const log = read('CHANGELOG.md');
  const entryStart = log.indexOf('## 0.37.0');
  const entry = flat(log.slice(entryStart, log.indexOf('\n## ', entryStart + 1)));
  const subcommands = /New subcommands:([^.]*)\./.exec(entry)?.[1] ?? '';
  for (const sub of ['session-next', 'session-wait', 'merge-base', 'push', 'check']) assert.ok(subcommands.includes(`\`${sub}\``), `the entry names ${sub} a subcommand`);
  for (const action of ['schedule-check', 'delete-check']) {
    assert.ok(!subcommands.includes(action), `${action} is no subcommand`);
    assert.ok(entry.includes(`\`${action}\``), `the entry still names ${action}`);
  }
});

// ================================================================ roadmap-sessions-upfront over remote-worker: the second merge of main

// Invariant (the run file): the places held (`occupied`, { at }) and the changes opened for another machine (`placed`, { machine, at }) are two records:
// readRun keeps each in its own shape, and both outlive the session that started the run. Layer: readRun and OUTLIVES. Suite: guard.
test('upfront merge run file: occupied and placed are two records that readRun keeps apart, and both outlive a session', () => {
  const root = projectWith(null);
  mkdirSync(dirname(runFileOf(root)), { recursive: true });
  const read = (obj) => { writeFileSync(runFileOf(root), JSON.stringify(obj)); return loopModule.readRun(runFileOf(root)); };
  const both = read({ occupied: { a: { at: AT } }, placed: { b: { machine: 'avel', at: AT } } });
  assert.deepEqual([both.occupied, both.placed], [{ a: { at: AT } }, { b: { machine: 'avel', at: AT } }]);
  const crossed = read({ occupied: { a: { machine: 'avel', at: AT } }, placed: { b: { at: AT } } });
  assert.deepEqual([crossed.occupied, crossed.placed], [{ a: { at: AT } }, {}], 'a place held names no machine, and a change opened elsewhere must');
  for (const key of ['occupied', 'placed']) assert.ok(changeLoopModule.OUTLIVES.includes(key), `${key} outlives the session that started the run`);
  assert.deepEqual(Object.keys(loopModule.readRun(join(lkSandbox(), 'none.json'))).filter((k) => ['occupied', 'placed'].includes(k)).sort(), ['occupied', 'placed']);
});

// Invariant (the machines setting over the one-opening rule): with the setting set the load picks the machine, so a loaded machine opens no change
// and an opening is held when no machine answers; the lines waiting for a dependency open with the ready ones. Layer: decideRoadmap. Suite: guard.
test('upfront merge placement: with the machines setting set a run with a session per change opens the waiting lines with the ready ones, a loaded machine opens none', () => {
  const lines = ['[ ] r1', '[ ] r2 (after: r1)'];
  assert.deepEqual(startsOf(decideRoadmap(machinesWorld({ lines }))), [['r1', 'mac', false, 'run'], ['r2', 'avel', true, 2]], 'both open, the waiting line too');
  assert.deepEqual(startsOf(decideRoadmap(machinesWorld({ lines, load: 90, limit: 80 }))), [['r1', 'avel', true, 2], ['r2', 'avel', true, 2]], 'the loaded machine takes none');
  const held = decideRoadmap(machinesWorld({ lines, machines: [avelSilent()], load: 90, limit: 80 }));
  assert.deepEqual(startsOf(held), [], 'no machine can take them');
  assert.deepEqual(changesOf(held).filter(([, kind]) => kind !== 'wake'), [['r1', 'hold']]);
});

// Invariant (the entry ticket): a session started on another machine cannot be claimed there (that machine's hook reads its own run file), so the
// start carries the typed form alone, no `devkit-start:` line, and the run records no ticket for it. Layer: next. Suite: guard.
test('upfront merge ticket: a session start for a change opened on another machine carries no ticket and the run records none', () => {
  const t = remoteProject(['[ ] rrr'], { rrr: 'avel' });
  const machines = JSON.stringify([{ host: 'avel', folder: t.other, places: 2 }]);
  putRun(t.main, { changeSessions: true, turn: 'typed', starting: ['rrr'] });
  const r = doNext(t.main, ['--turn', 'typed', '--machines', machines], { ssh: localSsh() });
  assert.equal(r.code, 0, r.stderr);
  const action = jsonOf(r.stdout).actions[0];
  assert.deepEqual([action.change, action.kind, action.input.prompt], ['rrr', 'session-start', '/devkit-openspec:devkit change rrr']);
  assert.deepEqual(stateOf(t.main).tickets, {}, 'no ticket recorded for it');
});

// Invariant (the periodic check over the machines setting): the check decides over the same machines as `next`, so the cron prompt and the command
// carry the setting; an unreadable one is refused as `next` refuses it. Layer: checkPrompt and check. Suite: guard.
test('upfront merge check: the periodic check carries the machines setting it was scheduled with and refuses an unreadable one', () => {
  const text = JSON.stringify([{ host: 'avel', folder: '/home/me/repo', places: 2 }]);
  assert.ok(loopModule.checkPrompt('en', 80, text).includes(`check --lang en --load-limit 80 --machines '${text}'`));
  assert.equal(loopModule.checkPrompt('en', 80).includes('--machines'), false, 'no setting, no flag');
  const t = remoteProject(['[ ] aaa'], {});
  const calls = [];
  const r = doCheck(t.main, ['--machines', 'avel:/r:2'], { ssh: (...a) => { calls.push(a); return silentSsh(); } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, `${render('en', 'machines-unreadable')}\n`);
  assert.deepEqual(calls, [], 'no machine was reached');
  assert.equal(existsSync(runFileOf(t.main)), false, 'nothing was written');
});

// ================================================================ roadmap-sessions-upfront beside remote-worker: the places of this machine (phase 9, design D-18)

// The ids are two letters long because a claim on `origin` is read only for a change name (`NAME` of the change loop): `aa` is the change session under test,
// `bb`, `cc` and `dd` are other changes of this machine.
const D18_YAML = `schema: devkit\nx-devkit-machine: ${thisMachine()}\nx-devkit-places: run\n`;
const D18_APPROVAL = '# Approval\n\n- Status: APPROVED\n';
const d18Tickets = (claimed, unclaimed = []) => Object.assign({}, ...claimed.map((id) => upTickets(id, { claimedBy: `S-${id}` })), ...unclaimed.map((id) => upTickets(id, { claimedBy: null })));

// Change `aa` on its branch (its plan approved only once the test calls `approve`) with the claim of this machine on the run's own count, `places: 1`, an `origin`
// that holds only main, and each of `others` (changes of this machine with the same claim) with its branch and approval.md on that `origin`, pushed from a second clone.
function d18Project({ roadmap = ['[ ] aa'], tickets, others = [] }) {
  const root = upChange({ id: 'aa', roadmap, files: { 'openspec/changes/aa/.openspec.yaml': D18_YAML }, run: { places: 1, tickets } });
  const origin = tmpFolder('devkit-d18-origin-');
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  const clones = tmpFolder('devkit-d18-clone-');
  const other = join(clones, 'clone');
  git(clones, 'clone', '-q', origin, other);
  for (const id of others) {
    git(other, 'checkout', '-q', '-b', id, 'origin/main');
    put(other, { [`openspec/changes/${id}/.openspec.yaml`]: D18_YAML, [`openspec/changes/${id}/approval.md`]: D18_APPROVAL });
    commitAll(other, `plan ${id}`);
    git(other, 'push', '-q', 'origin', id);
  }
  git(root, 'fetch', '-q', 'origin');
  return { root, origin, other };
}
const d18Next = (root, over = {}) => loopModule.sessionNext(root, 'aa', { env: cleanEnv, lang: 'en', gh: OFFLINE, ...over });
const d18Claims = (root) => Object.fromEntries(changeLoopModule.remoteClaims(root, { env: cleanEnv, gh: OFFLINE }).claims);
// This machine's row of the board over the claims `origin` holds, the run's `occupied` and its tickets: the text before the open count.
function d18Row(root, { occupied = {}, tickets, ids = ['aa', 'bb'] }) {
  const f = machinesWorld({
    lines: ids.map((id) => `[ ] ${id}`), local: Object.fromEntries(ids.map((id) => [id, agentAct(id)])), places: 1, claims: d18Claims(root), occupied, queued: {}, tickets, thisMachine: thisMachine(),
  });
  const name = render('en', 'machine.this', { name: thisMachine() });
  const row = boardOf(f).split('\n').find((l) => l.trim().startsWith(name));
  return row.trim().slice(name.length).trim().split(' · ')[0];
}
const d18Taken = (taken) => render('en', 'machine.row', { taken, places: 1, open: 0 }).split(' · ')[0];
const d18Shape = (action) => [action.kind, action.stage, action.step ?? action.end?.why ?? action.held?.why ?? null];

// Invariant: one gate and one count for a change session of this machine on the run's ticket: `occupied` alone, whether its plan is on `origin` or not; the board's
// row counts the same places. Layer: placeFacts (through sessionNext) and boardOf. Suite: roadmap-loop.
test('upfront D-18 place: a change session of this machine on the run\'s ticket takes its place from occupied only, before and after its plan push', () => {
  const tickets = d18Tickets(['aa', 'bb']);
  const { root } = d18Project({ tickets, others: ['bb'] });
  approve(root, 'aa');
  const run = (occupied) => putRun(root, { changeSessions: true, places: 1, tickets, occupied });
  run({});
  const free = d18Next(root);
  assert.deepEqual(d18Shape(free), ['agent', 'implementation', 'implement'], `before the push, the plan of bb on origin fills the run's number and aa still gets its hand-off: ${JSON.stringify(free)}`);
  run({ bb: { at: AT } });
  const wait = d18Next(root);
  assert.deepEqual([wait.kind, wait.held?.why, wait.sessionTitle], ['held', 'place', '⏳ aa'], 'before the push, occupied holds bb: aa waits for a place');
  git(root, 'push', '-q', 'origin', 'aa');
  run({});
  assert.deepEqual(d18Shape(d18Next(root)), ['agent', 'implementation', 'implement'], 'after the push, the hand-off');
  run({ bb: { at: AT } });
  const after = d18Next(root);
  assert.deepEqual([after.kind, after.held?.why, after.sessionTitle], ['held', 'place', '⏳ aa'], 'after the push, the wait');
  assert.equal(d18Claims(root).aa.placed, true, 'the plans of aa and bb are both on origin');
  assert.equal(d18Row(root, { occupied: { aa: { at: AT } }, tickets }), d18Taken(1), 'occupied holds aa alone: one place taken of one');
});

// Invariant: a place of this machine frees with the load stages, whatever its claim on origin, and no record of an archived change holds one. Layer: sessionDecide,
// boardOf, checkCmd. Suite: roadmap-loop.
test('upfront D-18 place: a place of this machine frees when its change leaves the load stages, whatever its claim on origin, and nothing of it counts once archived', () => {
  const tickets = d18Tickets(['aa', 'cc']);
  const { root } = d18Project({ roadmap: ['[ ] aa', '[ ] cc'], tickets });
  approve(root, 'aa');
  addOpen(root, 'cc');
  git(root, 'push', '-q', 'origin', 'aa');
  assert.equal(d18Claims(root).aa.placed, true, 'the claim of aa is placed on origin');
  const delivery = endAct('aa', 'waiting-on-github', 'waiting-github', { what: 'merge' }, { stage: 'delivery', stageTitle: 'Delivery' });
  const freed = sd(delivery, { occupied: { aa: { at: AT } }, queued: { cc: { at: AT, why: 'place' } } });
  assert.deepEqual([freed.occupied, Object.keys(freed.queued)], [{}, ['cc']], 'the delivery drops the place of aa and keeps cc queued');
  assert.equal(d18Row(root, { occupied: freed.occupied, tickets, ids: ['aa', 'cc'] }), d18Taken(0), 'the board reads no place taken while the claim of aa is placed');
  putRun(root, { changeSessions: true, places: 1, turn: 'typed', ...startedIn('aa', 'cc'), occupied: freed.occupied, queued: freed.queued });
  const checked = doCheck(root);
  assert.equal(checked.code, 0, checked.stdout + checked.stderr);
  assert.deepEqual([Object.keys(stateOf(root).occupied), stateOf(root).queued], [['cc'], {}], 'the check\'s locked update gives cc the place');
  archiveOn(root, 'aa');
  putRun(root, { changeSessions: true, places: 1, turn: 'typed', ...startedIn('aa', 'cc'), occupied: { aa: { at: AT }, cc: { at: AT } }, queued: {} });
  const archived = doCheck(root);
  assert.equal(archived.code, 0, archived.stdout + archived.stderr);
  assert.deepEqual(Object.keys(stateOf(root).occupied), ['cc'], 'pruneRecords keeps nothing of the archived aa');
  assert.equal(d18Claims(root).aa, undefined, 'the claim of an archived change is not read');
});

// Invariant: the fix never loosens the gate of a change that `sessionDecide` does not hold: a change whose ticket no session claimed meets the claims on origin.
// Layer: placeFacts (through sessionNext) and boardOf. Suite: roadmap-loop. (It pins today's gate: it passes before the change.)
test('upfront D-18 place: a change of this machine whose ticket no session claimed keeps the remote-worker gate', () => {
  const tickets = d18Tickets([], ['aa', 'bb']);
  const { root, origin } = d18Project({ tickets, others: ['bb'] });
  approve(root, 'aa');
  const full = d18Next(root);
  assert.deepEqual(d18Shape(full), ['end', 'implementation', 'no-place'], JSON.stringify(full));
  assert.deepEqual([full.params.taken, full.params.places], [1, 1], 'the plan of bb on origin fills the one place');
  assert.equal(d18Row(root, { tickets }), d18Taken(1), 'bb is counted by its claim');
  git(origin, 'branch', '-q', '-D', 'bb');
  git(root, 'fetch', '-q', '--prune', 'origin');
  assert.deepEqual(d18Shape(d18Next(root)), ['session', 'implementation', 'take-place'], 'with bb gone the place is free: take-place');
});

// Invariant: the two counts stay apart (a claimed change counts `occupied`, an unclaimed one the claims on origin) and the board shows both. Layer: sessionDecide and
// boardOf. Suite: roadmap-loop. (It pins today's two counts: it passes before the change.)
test('upfront D-18 place: a claimed change does not wait for an unclaimed one, and the board\'s row then reads above the number', () => {
  const tickets = d18Tickets(['aa'], ['dd']);
  const { root } = d18Project({ tickets, others: ['dd'] });
  approve(root, 'aa');
  git(root, 'push', '-q', 'origin', 'aa');
  const taken = d18Next(root, { write: true });
  assert.deepEqual(d18Shape(taken), ['agent', 'implementation', 'implement'], JSON.stringify(taken));
  assert.deepEqual(Object.keys(stateOf(root).occupied), ['aa'], 'aa took its place by occupied');
  assert.equal(d18Row(root, { occupied: stateOf(root).occupied, tickets, ids: ['aa', 'dd'] }), render('en', 'machine.row', { taken: 2, places: 1, open: 0 }).split(' · ')[0], 'aa by occupied and dd by its claim: two of one');
});

// Invariant: ADR 0021 records its place beside ADR 0020 (Amends and a Note), ADR 0020 names ADR 0021, and the documents qualify the triage by flow and state the two counts.
// Layer: the documents. Suite: roadmap-loop.
test('upfront D-18 docs: ADR 0021 names ADR 0020 in its Amends and a Note, ADR 0020 is amended by ADR 0021, and ADR 0010\'s Note and the config rule qualify the triage by flow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const flat = (text) => text.replace(/\s+/g, ' ');
  const plain = (text) => flat(text).replaceAll('`', '');
  const [n20, n21] = ['0020-a-change-can-run-on-another-machine.md', '0021-a-roadmap-run-opens-every-change-at-its-start.md'];
  const adr21 = read('docs', 'adr', n21);
  const amends = flat(adr21.slice(adr21.indexOf('- Amends:'), adr21.indexOf('\n\n', adr21.indexOf('- Amends:'))));
  assert.ok(amends.includes(`ADR 0020 (${n20}), decisions 5 and 8, for a change of this machine whose session claimed the run's ticket`), 'the Amends entry');
  const start = adr21.indexOf('Note (roadmap-sessions-upfront and remote-worker, 2026-11-23)');
  assert.ok(start > adr21.indexOf('## Decision') && start < adr21.indexOf('## Consequences'), 'the second Note sits after the Decision and before the Consequences');
  const note = plain(adr21.slice(start, adr21.indexOf('## Consequences')));
  for (const part of [`[ADR 0020](${n20})`, 'gets no ticket', 'no hook reaches that machine (ADR 0020 decision 7)', 'takes its place from the run\'s own count', 'ends blocked with the reason no-place, titled ⏳ <id>',
    'decision 4 keeps one session cron', 'this machine can hold more places than the run\'s number', 'the board\'s row of this machine then reads above it', 'ADR 0020\'s other decisions hold as written']) {
    assert.ok(note.includes(part), `the Note says: ${part}`);
  }
  const adr20 = read('docs', 'adr', n20);
  assert.ok(adr20.split('\n').slice(0, 8).includes(`- Amended by ADR 0021 (${n21})`), 'ADR 0020 has the Amended by line in its header');
  assert.match(adr20, /^- Status: accepted$/m);
  const noteAt = adr20.indexOf('Note (roadmap-sessions-upfront, 2026-11-23)');
  assert.ok(noteAt > adr20.indexOf('9. ADR 0010 decisions 1 to 8') && noteAt < adr20.indexOf('## Consequences'), 'ADR 0020\'s Note sits after the Decision list and before the Consequences');
  const note20 = plain(adr20.slice(noteAt, adr20.indexOf('## Consequences')));
  for (const part of [`[ADR 0021](${n21})`, 'from the run file, not from origin', 'one session cron', 'The status and the decisions above stay']) assert.ok(note20.includes(part), `ADR 0020's Note says: ${part}`);
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  const note10 = plain(adr10.slice(adr10.indexOf('Note (roadmap-sessions-upfront'))).split(' Note (')[0];
  assert.ok(note10.includes('of a change that follows flow version 2 or later of its script, the requirements-triage agent answers those first'), 'ADR 0010\'s Note qualifies the triage by flow');
  assert.ok(note10.includes('a change on flow 1 keeps its grill with no triage until the owner moves it (ADR 0021\'s Note)'), 'and says what flow 1 keeps');
  const rule = read('openspec', 'config.yaml').split('\n').find((l) => l.includes('Ask the owner every question that nothing written settles'));
  assert.ok(rule.includes('only in the grill of a change that follows flow version 2 or later of its script; in a change on flow 1 the owner answers every question.'), 'the config rule qualifies the triage by flow');
  const sentence = 'With the machines setting set, a change session of this machine on the run\'s ticket takes its place from the run\'s own count, and its plan on origin is no place taken; '
    + 'a change counted from origin (another machine\'s, or one of this machine whose session claimed no ticket) keeps ADR 0020\'s places, so with both kinds at once this machine can hold more places than the run\'s number, '
    + 'and the board\'s row of this machine then reads above it.';
  for (const file of ['openspec-flow.md', 'coordination-design.md']) {
    const paragraph = plain(read('docs', file).split('\n').find((l) => l.startsWith('**Opening every change at the start')));
    assert.ok(paragraph.includes(sentence), `${file} holds the sentence in its paragraph "Opening every change at the start"`);
  }
  const log = read('CHANGELOG.md');
  const entryStart = log.indexOf('## 0.37.0');
  const entry = plain(log.slice(entryStart, log.indexOf('\n## ', entryStart + 1)));
  const bullet = entry.slice(entry.indexOf('**devkit-openspec** 0.33.0'), entry.indexOf('- **devkit-core** 0.14.0'));
  assert.ok(bullet.includes('With the machines setting set, a change session of this machine on the run\'s ticket takes its place from the run\'s own count: its plan on origin is no place taken, and the board\'s row of this machine counts those places '
    + 'and the places of this machine\'s changes counted from origin, which a run with both kinds at once can take above the run\'s number.'), 'the 0.33.0 bullet of the changelog holds the sentence');
});
