// node scripts/test-suite.mjs plugins/openspec/hooks/tick-gate.test.mjs
// helper-conductor D-3 and D-4 (AC-3): the tick's prompt hook `tick-gate.mjs` and, until task 2.1 moves them, the functions it holds
// (`commonDirOf`, `localRunFilePath`, `localFacts`, `tickReady`). The unit cases build run objects and fixture run files; the process
// cases run the hook with a payload on stdin, on one fixture repository (a main checkout, two linked worktrees, one removed folder)
// and with a PATH whose `git` and `gh` exit 1, so the hook is shown to start neither. Every fixture is a folder of the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { git, GIT_ENV } from './test-fixtures.mjs';
import { commonDirOf, localRunFilePath, localFacts, tickReady } from './tick-gate.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'tick-gate.mjs');
const NOW = Date.parse('2026-11-28T16:00:00.000Z');
const minutes = (n) => new Date(NOW + n * 60_000).toISOString();
const LIVE = { session: 's1', at: minutes(-5), heartbeat: minutes(-1) };
const STALE = { session: 's2', at: minutes(-600), heartbeat: minutes(-300) };
const TASK = { id: 'devkit-roadmap-tick-x-00000000', cron: '*/5 * * * *', at: minutes(-60) };

const run = (over = {}) => ({
  task: TASK, ended: null, queue: [], claims: {}, holds: {}, ownerWaits: {}, train: null, places: 1, stopping: false, anyway: [], occupied: {}, ...over,
});
const facts = (over = {}) => ({ archived: new Set(), open: new Set(), load: 10, limit: 80, heldPlaces: 0, escalationsAnswered: new Set(), ...over });
const ready = (r, f = facts()) => tickReady(r, f, NOW);
const hold = (kind, over = {}) => ({ kind, at: minutes(-20), recheckAt: null, params: {}, ...over });

// ---------------------------------------------------------------- tickReady (D-3)

test('tick-gate AC-3 rule 1: no task is no-task, before the task is installed and after the run ended', () => {
  assert.deepEqual(ready(run({ task: null, queue: ['a'] })), { ready: null, why: 'no-task' });
  assert.deepEqual(ready(run({ task: null, queue: ['a'], ended: { why: 'done', at: minutes(-1), task: TASK.id } })), { ready: null, why: 'no-task' });
});

test('tick-gate AC-3 rule 2: stopping with a live claim or a live train claim is stopping-busy, with neither it is stopping', () => {
  assert.equal(ready(run({ stopping: true, queue: ['a'], claims: { a: LIVE } })).why, 'stopping-busy');
  assert.equal(ready(run({ stopping: true, queue: ['a'], train: { claim: LIVE, hold: null } })).why, 'stopping-busy');
  assert.deepEqual(ready(run({ stopping: true, queue: ['a'] })), { ready: null, why: 'stopping' });
  assert.equal(ready(run({ stopping: true, queue: ['a'], claims: { a: STALE } })).why, 'stopping');
});

test('tick-gate AC-3 rule 3: every queued id archived, or held archived or skipped, is done', () => {
  assert.deepEqual(ready(run({ queue: ['a', 'b'] }), facts({ archived: new Set(['a', 'b']) })), { ready: null, why: 'done' });
  assert.equal(ready(run({ queue: ['a', 'b'], holds: { a: hold('archived'), b: hold('skipped') } })).why, 'done');
  assert.equal(ready(run({ queue: ['a', 'b'], holds: { b: hold('skipped') } }), facts({ archived: new Set(['a']) })).why, 'done');
  assert.notEqual(ready(run({ queue: ['a', 'b'], holds: { a: hold('skipped') } })).why, 'done');
});

test('tick-gate AC-3 rule 4: live claims at the number of places is helpers-full, a stale claim is not a live one', () => {
  assert.deepEqual(ready(run({ queue: ['a', 'b'], claims: { a: LIVE } })), { ready: null, why: 'helpers-full' });
  assert.equal(ready(run({ queue: ['a', 'b'], claims: { a: STALE } })).ready, 'a');
  assert.equal(ready(run({ queue: ['a', 'b'], claims: { a: LIVE }, places: 2 })).ready, 'b');
  assert.equal(ready(run({ queue: ['a'], claims: { a: { ...LIVE, heartbeat: 'not a time' } } })).ready, 'a');
});

test('tick-gate AC-3 rule 5: the first queued item with no hold is ready, a claimed or archived one is skipped, in order', () => {
  assert.deepEqual(ready(run({ queue: ['a'] })), { ready: 'a', why: 'ready' });
  assert.equal(ready(run({ queue: ['a', 'b', 'c'], places: 2, claims: { a: LIVE } }), facts({ archived: new Set(['b']) })).ready, 'c');
  assert.equal(ready(run({ queue: ['b', 'a'] })).ready, 'b');
});

test('tick-gate AC-3 rule 5: a queue entry that is no change id is skipped', () => {
  assert.equal(ready(run({ queue: ['../etc', '', 7, 'a'] })).ready, 'a');
  assert.deepEqual(ready(run({ queue: ['../etc', 'a'] }), facts({ archived: new Set(['a']) })), { ready: null, why: 'done' });
});

test('tick-gate AC-3 rule 5 delegated: a delegated hold is ready', () => {
  assert.equal(ready(run({ queue: ['a'], holds: { a: hold('delegated') } })).ready, 'a');
});

test('tick-gate AC-3 rule 5 github, after, elsewhere: ready at recheckAt and not before', () => {
  for (const kind of ['github', 'after', 'elsewhere']) {
    assert.equal(ready(run({ queue: ['a'], holds: { a: hold(kind, { recheckAt: minutes(-1) }) } })).ready, 'a', kind);
    assert.equal(ready(run({ queue: ['a'], holds: { a: hold(kind, { recheckAt: minutes(5) }) } })).why, 'nothing-ready', kind);
    assert.equal(ready(run({ queue: ['a'], holds: { a: hold(kind, { recheckAt: minutes(0) }) } })).ready, 'a', `${kind} at the instant`);
  }
});

test('tick-gate AC-3 rule 5 place: ready while the held places are fewer than the run\'s places', () => {
  const r = run({ queue: ['a'], places: 2, holds: { a: hold('place') } });
  assert.equal(ready(r, facts({ heldPlaces: 1 })).ready, 'a');
  assert.equal(ready(r, facts({ heldPlaces: 2 })).why, 'nothing-ready');
});

test('tick-gate AC-3 rule 5 load: ready under the limit, or when the id is in anyway', () => {
  const r = run({ queue: ['a'], holds: { a: hold('load') } });
  assert.equal(ready(r, facts({ load: 79, limit: 80 })).ready, 'a');
  assert.equal(ready(r, facts({ load: 80, limit: 80 })).why, 'nothing-ready');
  assert.equal(ready({ ...r, anyway: ['a'] }, facts({ load: 300, limit: 80 })).ready, 'a');
});

test('tick-gate AC-3 rule 5 owner: ready once the owner line of the item is gone', () => {
  const waits = { a: { gate: 'merge', questions: [], request: null, summary: null, at: minutes(-9), shown: [], pushedAt: null } };
  assert.equal(ready(run({ queue: ['a'], holds: { a: hold('owner') }, ownerWaits: waits })).why, 'nothing-ready');
  assert.equal(ready(run({ queue: ['a'], holds: { a: hold('owner') } })).ready, 'a');
});

test('tick-gate AC-3 rule 5 escalated: ready once the answer file and the Reopened item exist', () => {
  const r = run({ queue: ['a'], holds: { a: hold('escalated', { params: { request: '1-decision' } }) } });
  assert.equal(ready(r).why, 'nothing-ready');
  assert.equal(ready(r, facts({ escalationsAnswered: new Set(['a']) })).ready, 'a');
});

test('tick-gate AC-3 rule 5 blocked, boarded, archived, skipped: never ready for the change itself', () => {
  for (const kind of ['blocked', 'archived', 'skipped']) {
    assert.equal(ready(run({ queue: ['a', 'b'], holds: { a: hold(kind) } })).ready, 'b', kind);
    assert.equal(ready(run({ queue: ['a'], holds: { a: hold(kind) } })).ready, null, kind);
  }
  const boarded = run({ queue: ['a'], holds: { a: hold('boarded') }, train: { claim: LIVE, hold: null } });
  assert.deepEqual(ready(boarded), { ready: null, why: 'nothing-ready' });
});

test('tick-gate AC-3 rule 4a: a boarded hold with no live train claim and no train hold makes @train ready, before any change', () => {
  const r = run({ queue: ['a', 'b'], places: 2, holds: { b: hold('boarded') } });
  assert.deepEqual(ready(r), { ready: '@train', why: 'train' });
  assert.equal(ready({ ...r, train: { claim: null, hold: null } }).ready, '@train');
  assert.equal(ready({ ...r, train: { claim: STALE, hold: null } }).ready, '@train');
  assert.equal(ready({ ...r, train: { claim: LIVE, hold: null } }).ready, 'a');
});

test('tick-gate AC-3 rule 4a train.hold: github at recheckAt, owner once @train\'s line is gone, else the train waits', () => {
  const r = (trainHold, ownerWaits = {}) => run({ queue: ['a'], holds: { a: hold('boarded') }, train: { claim: null, hold: trainHold }, ownerWaits });
  assert.equal(ready(r({ kind: 'github', at: minutes(-12), recheckAt: minutes(-2) })).ready, '@train');
  assert.equal(ready(r({ kind: 'github', at: minutes(-1), recheckAt: minutes(9) })).why, 'nothing-ready');
  const line = { '@train': { gate: 'merge', questions: [], request: null, summary: null, at: minutes(-3), shown: [], pushedAt: null } };
  assert.equal(ready(r({ kind: 'owner', at: minutes(-3), recheckAt: null }, line)).why, 'nothing-ready');
  assert.equal(ready(r({ kind: 'owner', at: minutes(-3), recheckAt: null })).ready, '@train');
});

test('tick-gate AC-3 rule 4a: the train does not dispatch when the places are full, nor when nothing is boarded', () => {
  assert.equal(ready(run({ queue: ['a', 'b'], claims: { a: LIVE }, holds: { b: hold('boarded') } })).why, 'helpers-full');
  assert.equal(ready(run({ queue: ['a'] })).ready, 'a');
});

test('tick-gate AC-3 rule 6: nothing ready is nothing-ready', () => {
  assert.deepEqual(ready(run({ queue: ['a'], holds: { a: hold('blocked') } })), { ready: null, why: 'nothing-ready' });
});

test('tick-gate AC-3 claims: DEVKIT_CLAIM_STALE_MS from 1000 up replaces the two hours, anything else is ignored', () => {
  const claim = { session: 's', at: minutes(-9), heartbeat: minutes(-5) };
  const r = run({ queue: ['a'], claims: { a: claim } });
  const before = process.env.DEVKIT_CLAIM_STALE_MS;
  try {
    assert.equal(ready(r).why, 'helpers-full');
    process.env.DEVKIT_CLAIM_STALE_MS = '60000';
    assert.equal(ready(r).ready, 'a');
    for (const bad of ['999', '1.5', 'x', '']) {
      process.env.DEVKIT_CLAIM_STALE_MS = bad;
      assert.equal(ready(r).why, 'helpers-full', bad);
    }
  } finally {
    if (before === undefined) delete process.env.DEVKIT_CLAIM_STALE_MS; else process.env.DEVKIT_CLAIM_STALE_MS = before;
  }
});

// ---------------------------------------------------------------- a fixture repository

const sh = (root, ...args) => git(root, ...args);

// A main checkout with openspec/changes/{a, archive/<date>-old}, a linked worktree `wt1` holding an uncommitted change `b`, a linked
// worktree `wt2` whose folder was removed and a stub folder for `git` and `gh` that exit 1.
function repo() {
  const base = realpathSync(tmpFolder('devkit-tickgate-'));
  const main = join(base, 'Main Repo');
  mkdirSync(join(main, 'openspec', 'changes', 'a'), { recursive: true });
  mkdirSync(join(main, 'openspec', 'changes', 'archive', '2026-11-01-old'), { recursive: true });
  writeFileSync(join(main, 'openspec', 'config.yaml'), 'schema: devkit-lite\n');
  writeFileSync(join(main, 'openspec', 'changes', 'a', 'proposal.md'), '# a\n');
  writeFileSync(join(main, 'openspec', 'changes', 'archive', '2026-11-01-old', 'proposal.md'), '# old\n');
  sh(main, 'init', '-q', '-b', 'main');
  sh(main, 'add', '-A');
  sh(main, 'commit', '-q', '-m', 'initial');
  const wt1 = join(base, 'wt1');
  const wt2 = join(base, 'wt2');
  sh(main, 'worktree', 'add', '-q', '-b', 'wt1', wt1);
  sh(main, 'worktree', 'add', '-q', '-b', 'wt2', wt2);
  mkdirSync(join(wt1, 'openspec', 'changes', 'b'), { recursive: true });
  mkdirSync(join(wt2, 'openspec', 'changes', 'c'), { recursive: true });
  rmSync(wt2, { recursive: true, force: true });
  const stubs = join(base, 'stubs');
  mkdirSync(stubs);
  for (const tool of ['git', 'gh']) {
    writeFileSync(join(stubs, tool), '#!/bin/sh\nexit 1\n');
    chmodSync(join(stubs, tool), 0o755);
  }
  const runFile = join(main, '.git', 'devkit', 'roadmap-run.json');
  const put = (object) => { mkdirSync(dirname(runFile), { recursive: true }); writeFileSync(runFile, typeof object === 'string' ? object : JSON.stringify(object)); };
  return { base, main, wt1, wt2, stubs, runFile, put };
}

test('tick-gate AC-3 commonDirOf: from the main checkout and from a worktree it equals git rev-parse --git-common-dir', () => {
  const { main, wt1 } = repo();
  const real = (cwd) => realpathSync(execGit(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  assert.equal(realpathSync(commonDirOf(main)), real(main));
  assert.equal(realpathSync(commonDirOf(wt1)), real(wt1));
  assert.equal(realpathSync(commonDirOf(wt1)), realpathSync(join(main, '.git')));
});

function execGit(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: GIT_ENV }).stdout.trim();
}

test('tick-gate AC-3 commonDirOf: no git folder, or a .git file that names nothing, is null', () => {
  const dir = tmpFolder('devkit-tickgate-');
  assert.equal(commonDirOf(dir), null);
  assert.equal(localRunFilePath(dir), null);
  writeFileSync(join(dir, '.git'), 'gibberish\n');
  assert.equal(commonDirOf(dir), null);
});

test('tick-gate AC-3 localRunFilePath: <common dir>/devkit/roadmap-run.json, the same file from the main checkout and a worktree', () => {
  const { main, wt1, runFile } = repo();
  assert.equal(localRunFilePath(main), runFile);
  assert.equal(localRunFilePath(wt1), runFile);
});

test('tick-gate AC-3 localFacts: archived names the archive folders, open lists the main checkout and the living worktrees', () => {
  const { main, wt1 } = repo();
  for (const root of [main, wt1]) {
    const f = localFacts(root, run(), {});
    assert.deepEqual([...f.archived], ['old'], root);
    assert.deepEqual([...f.open].sort(), ['a', 'b'], root);
  }
});

test('tick-gate AC-3 localFacts: heldPlaces counts the occupied entries of open changes and leaves out one no longer open', () => {
  const { main } = repo();
  const f = localFacts(main, run({ occupied: { a: { at: null }, b: { at: null }, c: { at: null }, gone: { at: null } } }), {});
  assert.equal(f.heldPlaces, 2);
  assert.equal(localFacts(main, run(), {}).heldPlaces, 0);
});

test('tick-gate AC-3 localFacts: the limit is the setting\'s whole number from 1 to 1000, else 80, and the load is a number', () => {
  const { main } = repo();
  const limit = (value) => localFacts(main, run(), { CLAUDE_PLUGIN_OPTION_LOAD_LIMIT: value }).limit;
  assert.deepEqual([limit('90'), limit(' 1 '), limit('1000'), limit('1001'), limit('0'), limit('80%'), limit('${user_config.load_limit}'), limit(undefined)], [90, 1, 1000, 80, 80, 80, 80, 80]);
  const { load } = localFacts(main, run(), {});
  assert.ok(Number.isFinite(load) && load >= 0);
});

test('tick-gate AC-3 localFacts: an escalated hold is answered when its answer file and its Reopened item exist', () => {
  const { main, wt1 } = repo();
  const r = run({ holds: { a: hold('escalated', { params: { request: '1-decision' } }), b: hold('escalated', { params: { request: '2-decision' } }) } });
  const put = (root, id, files) => { for (const [f, text] of Object.entries(files)) { mkdirSync(dirname(join(root, 'openspec', 'changes', id, f)), { recursive: true }); writeFileSync(join(root, 'openspec', 'changes', id, f), text); } };
  assert.equal(localFacts(main, r, {}).escalationsAnswered.size, 0);
  put(main, 'a', { 'requests/1-decision.answer.md': '<!-- devkit-answer by=owner line=none at=x -->\n## Answer\nyes\n' });
  assert.equal(localFacts(main, r, {}).escalationsAnswered.has('a'), false);
  put(main, 'a', { 'requirements.md': '# R\n\n## Reopened\n- the question → yes (source: requests/1-decision.answer.md)\n' });
  assert.deepEqual([...localFacts(main, r, {}).escalationsAnswered], ['a']);
  put(wt1, 'b', { 'requests/2-decision.answer.md': 'x\n', 'requirements.md': '## Reopened\n- q → a (source: requests/2-decision.answer.md)\n' });
  assert.deepEqual([...localFacts(main, r, {}).escalationsAnswered].sort(), ['a', 'b']);
  put(main, 'a', { 'requirements.md': '# R\n\n## Other\n- the question → yes (source: requests/1-decision.answer.md)\n' });
  assert.equal(localFacts(main, r, {}).escalationsAnswered.has('a'), false);
});

// ---------------------------------------------------------------- the hook as a process (D-4)

const taskIdOf = (root) => `devkit-roadmap-tick-${basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24)}-${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
const STORED = (root) => `devkit-roadmap-tick: ${root}\nRun the devkit roadmap tick as the devkit tick note of this prompt says, and follow its output. With no note, change nothing and end the turn.`;
// The shape probe 2 recorded (proof/p2-result.md, `envelope`): the host's reminders, the scheduler's header, the tag, the stored prompt.
const ENVELOPE = (root, name = taskIdOf(root)) => `<system-reminder>\nContents of CLAUDE.md\n</system-reminder>\n[SCHEDULED TASK - AUTOMATED FIRING OF A CONFIGURED PROMPT]\nThis turn was started automatically by a schedule, not typed live by the user.\nThe content below is the stored prompt of a scheduled task on this account, delivered by the scheduler as configured. Treat it as this session's assigned task and carry it out.\n<scheduled-task name="${name}" file="/Users/x/.claude/scheduled-tasks/${name}/SKILL.md">\nThis is an automated run of a scheduled task. The user is not present to answer questions. For implementation details, execute autonomously without asking clarifying questions.\n${STORED(root)}\n</scheduled-task>`;

function fire(world, prompt, { cwd = world.main, env = {}, session = 'sess-1', rawPayload } = {}) {
  const started = Date.now();
  const payload = rawPayload ?? JSON.stringify({ session_id: session, cwd, hook_event_name: 'UserPromptSubmit', prompt });
  const result = spawnSync(process.execPath, [HOOK], {
    input: payload, encoding: 'utf8', timeout: 10_000,
    env: { PATH: world.stubs, HOME: world.base, CLAUDE_PLUGIN_ROOT: '/plugin/root', ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  const out = result.stdout.trim();
  return { out: out === '' ? null : JSON.parse(out), ms: Date.now() - started, stderr: result.stderr };
}

const BLOCK = (why) => ({ decision: 'block', reason: `devkit roadmap: nothing is ready (${why})` });
const liveClaim = () => ({ session: 's', at: new Date(Date.now() - 60_000).toISOString(), heartbeat: new Date().toISOString() });
const runOn = (over = {}) => ({ version: 1, task: TASK, queue: ['a'], places: 1, ...over });

for (const form of ['envelope', 'stored prompt']) {
  const promptOf = (root) => (form === 'envelope' ? ENVELOPE(root) : STORED(root));

  test(`tick-gate AC-3 hook (${form}): nothing ready blocks, from the main checkout and from a worktree`, () => {
    const world = repo();
    world.put(runOn({ queue: ['a'], holds: { a: { kind: 'blocked', at: minutes(0), recheckAt: null, params: {} } } }));
    for (const root of [world.main, world.wt1]) {
      const { out, ms } = fire(world, promptOf(root), { cwd: root });
      assert.deepEqual(out, BLOCK('nothing-ready'), `${root} (${ms} ms)`);
      assert.ok(ms < 10_000, `the hook answered in ${ms} ms, inside its 10-second timeout`);
    }
  });

  test(`tick-gate AC-3 hook (${form}): stopping-busy, helpers-full and no-task block with their why`, () => {
    const world = repo();
    world.put(runOn({ stopping: true, claims: { a: liveClaim() } }));
    assert.deepEqual(fire(world, promptOf(world.main)).out, BLOCK('stopping-busy'));
    world.put(runOn({ claims: { a: liveClaim() }, queue: ['a', 'b'] }));
    assert.deepEqual(fire(world, promptOf(world.main)).out, BLOCK('helpers-full'));
    world.put(runOn({ task: null }));
    assert.deepEqual(fire(world, promptOf(world.main)).out, BLOCK('no-task'));
  });

  test(`tick-gate AC-3 hook (${form}): a missing run file reads as no run and blocks`, () => {
    const world = repo();
    assert.deepEqual(fire(world, promptOf(world.main)).out, BLOCK('no-task'));
  });

  test(`tick-gate AC-3 hook (${form}): a run that ended blocks and names the deletion in the app`, () => {
    const world = repo();
    world.put(runOn({ task: null, ended: { why: 'done', at: minutes(-1), task: TASK.id } }));
    assert.deepEqual(fire(world, promptOf(world.main)).out, { decision: 'block', reason: 'devkit roadmap: the run is over; delete its scheduled task in the app' });
  });

  test(`tick-gate AC-3 hook (${form}): an item ready, a run done and a run stopping with no live claim let the firing through with the tick's note`, () => {
    const world = repo();
    for (const [object, label] of [[runOn(), 'ready'], [runOn({ queue: ['old'] }), 'done'], [runOn({ stopping: true }), 'stopping']]) {
      world.put(object);
      const { out } = fire(world, promptOf(world.main), { session: 'sess-9', env: { CLAUDE_PLUGIN_OPTION_LANGUAGE: 'pt-BR', CLAUDE_PLUGIN_OPTION_LOAD_LIMIT: '70', CLAUDE_PLUGIN_OPTION_MACHINES: "a b's" } });
      assert.equal(out.decision, undefined, label);
      assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit', label);
      const note = out.hookSpecificOutput.additionalContext;
      assert.ok(note.startsWith('devkit tick note: session sess-9. Run: node "/plugin/root/hooks/roadmap-loop.mjs" tick --session sess-9 --lang pt-BR --load-limit 70 --machines \'a b\'\\\'\'s\'. Then read the part "A tick" of /plugin/root/skills/devkit/SKILL.md'), `${label}: ${note}`);
      assert.match(note, /never ask anything\.$/, label);
    }
  });

  test(`tick-gate AC-3 hook (${form}): an unset setting is left out of the tick call`, () => {
    const world = repo();
    world.put(runOn());
    const note = fire(world, promptOf(world.main), { session: 'sess-2', env: { CLAUDE_PLUGIN_OPTION_LANGUAGE: '' } }).out.hookSpecificOutput.additionalContext;
    assert.match(note, /tick --session sess-2\. Then read/);
    assert.doesNotMatch(note, /--lang|--load-limit|--machines/);
  });

  test(`tick-gate AC-3 hook (${form}): a run file that exists but does not parse to an object prints nothing`, () => {
    const world = repo();
    for (const text of ['', 'not json', '[1,2]', '"text"', 'null']) {
      world.put(text);
      assert.equal(fire(world, promptOf(world.main)).out, null, JSON.stringify(text));
    }
  });

  test(`tick-gate AC-3 hook (${form}): a first line naming another root, or a project that is not opted in, prints nothing`, () => {
    const world = repo();
    world.put(runOn({ task: null }));
    assert.equal(fire(world, promptOf(join(world.base, 'elsewhere'))).out, null);
    assert.equal(fire(world, promptOf(world.main), { cwd: world.base }).out, null);
    writeFileSync(join(world.main, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
    assert.equal(fire(world, promptOf(world.main)).out, null);
  });
}

test('tick-gate AC-3 hook: a tag of another task\'s name prints nothing', () => {
  const world = repo();
  world.put(runOn({ task: null }));
  assert.equal(fire(world, ENVELOPE(world.main, 'devkit-roadmap-tick-other-12345678')).out, null);
  assert.equal(fire(world, ENVELOPE(world.main, 'some-other-task')).out, null);
});

test('tick-gate AC-3 hook: any other prompt, a payload that does not parse and an empty stdin print nothing', () => {
  const world = repo();
  world.put(runOn({ task: null }));
  for (const prompt of ['hello', '', '/devkit roadmap', `please explain devkit-roadmap-tick: ${world.main}`, `x\ndevkit-roadmap-tick: ${world.main}`]) {
    assert.equal(fire(world, prompt).out, null, prompt);
  }
  assert.equal(fire(world, null, { rawPayload: '{ nope' }).out, null);
  assert.equal(fire(world, null, { rawPayload: '' }).out, null);
  assert.equal(fire(world, null, { rawPayload: JSON.stringify({ cwd: world.main }) }).out, null);
  assert.equal(fire(world, null, { rawPayload: JSON.stringify({ cwd: world.main, prompt: 42 }) }).out, null);
});

test('tick-gate AC-3 hook: no common git folder prints nothing', () => {
  const world = repo();
  const bare = join(world.base, 'plain');
  mkdirSync(join(bare, 'openspec', 'changes'), { recursive: true });
  writeFileSync(join(bare, 'openspec', 'config.yaml'), 'schema: devkit-lite\n');
  assert.equal(fire(world, ENVELOPE(bare), { cwd: bare }).out, null);
});

test('tick-gate AC-3 hook: DEVKIT_HOOK_LOG gets one JSON line per decision, none for a prompt it ignores', () => {
  const world = repo();
  const log = join(world.base, 'hook.log');
  world.put(runOn({ task: null }));
  fire(world, ENVELOPE(world.main), { session: 'sess-5', env: { DEVKIT_HOOK_LOG: log } });
  world.put(runOn());
  fire(world, ENVELOPE(world.main), { session: 'sess-6', env: { DEVKIT_HOOK_LOG: log } });
  fire(world, 'hello', { env: { DEVKIT_HOOK_LOG: log } });
  const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map(({ mode, session, change, decision, why }) => ({ mode, session, change, decision, why })), [
    { mode: 'prompt', session: 'sess-5', change: null, decision: 'block', why: 'no-task' },
    { mode: 'prompt', session: 'sess-6', change: null, decision: 'allow', why: 'ready' },
  ]);
  assert.ok(lines.every((l) => Number.isFinite(Date.parse(l.at))));
});

test('tick-gate AC-3 hook: importing the module runs nothing and reads no stdin', async () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(HOOK)}); console.log('imported');`], { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(result.stdout.trim(), 'imported');
});
