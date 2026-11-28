// node scripts/test-suite.mjs plugins/openspec/hooks/test-slots.test.mjs
// helper-conductor D-25 (AC-22): the machine's test-slot ledger, `test-slots.json` in the state folder. It drives the module's
// exports with `DEVKIT_STATE_DIR` a folder of the test, `gates` passed in, an injected `alive` and `sleep` and a recording `log`.
// The `test-run` verb that calls the module is a later task's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { SLOTS_LOCK, SLOT_STEP_MS, slotsPaths, readSlots, tryTakeSlot, releaseSlots, waitForSlot } from './test-slots.mjs';

const NOW = new Date('2026-11-28T16:00:00.000Z');
const EMPTY = { version: 1, suite: null, trainWaiting: null, gates: [] };
const always = () => true;

function ledger({ clone = '/clone-a' } = {}) {
  const dir = tmpFolder('devkit-slots-');
  const env = { DEVKIT_STATE_DIR: dir };
  const take = (owner, kind, pid, over = {}) => tryTakeSlot({ owner, kind, clone, pid, gates: 2, env, alive: always, now: NOW, ...over });
  return { dir, env, take, read: () => readSlots({ env, alive: always }), file: join(dir, 'test-slots.json') };
}

test('capacity AC-22 constants: the lock and the 15-second step', () => {
  assert.deepEqual(SLOTS_LOCK, { stepMs: 100, waitMs: 5_000, staleMs: 60_000 });
  assert.equal(SLOT_STEP_MS, 15_000);
});

test('capacity AC-22 paths: DEVKIT_STATE_DIR, else XDG_STATE_HOME/devkit, else ~/.local/state/devkit', () => {
  assert.deepEqual(slotsPaths({ DEVKIT_STATE_DIR: '/s', XDG_STATE_HOME: '/x', HOME: '/h' }), { dir: '/s', ledger: '/s/test-slots.json', lock: '/s/test-slots.lock' });
  assert.equal(slotsPaths({ XDG_STATE_HOME: '/x', HOME: '/h' }).dir, '/x/devkit');
  assert.equal(slotsPaths({ HOME: '/h' }).dir, '/h/.local/state/devkit');
});

test('capacity AC-22 ledger: a missing one and one that does not parse read as empty, and reading writes nothing', () => {
  const { env, file } = ledger();
  assert.deepEqual(readSlots({ env, alive: always }), EMPTY);
  assert.equal(existsSync(file), false);
  writeFileSync(file, '{ not json');
  assert.deepEqual(readSlots({ env, alive: always }), EMPTY);
  writeFileSync(file, '[1]');
  assert.deepEqual(readSlots({ env, alive: always }), EMPTY);
  assert.equal(readFileSync(file, 'utf8'), '[1]');
});

test('capacity AC-22 suite: a second whole suite waits while the first holds the slot and takes it after the first is released', () => {
  const { take, read, env } = ledger();
  assert.deepEqual(take('a', 'suite', 101), { taken: true });
  assert.deepEqual(take('b', 'suite', 102), { taken: false, wait: 'devkit-test: waiting for a whole-suite slot (a)' });
  assert.equal(read().suite.pid, 101);
  releaseSlots({ pid: 101, env });
  assert.deepEqual(take('b', 'suite', 102), { taken: true });
  assert.deepEqual(
    { owner: read().suite.owner, pid: read().suite.pid, clone: read().suite.clone, at: read().suite.at },
    { owner: 'b', pid: 102, clone: '/clone-a', at: '2026-11-28T16:00:00.000Z' },
  );
});

test('capacity AC-22 train: a train suite waiting keeps a change suite from the slot, and the train takes it first once it is free', () => {
  const { take, read, env } = ledger();
  take('a', 'suite', 101);
  const wait = take('@train', 'suite', 200, { clone: '/clone-t' });
  assert.deepEqual(wait, { taken: false, wait: 'devkit-test: waiting for a whole-suite slot (a)' });
  assert.deepEqual(read().trainWaiting, { pid: 200, clone: '/clone-t', at: '2026-11-28T16:00:00.000Z' });
  releaseSlots({ pid: 101, env });
  assert.deepEqual(take('b', 'suite', 102), { taken: false, wait: "devkit-test: waiting for the train's suite" });
  assert.deepEqual(take('@train', 'suite', 200, { clone: '/clone-t' }), { taken: true });
  assert.equal(read().trainWaiting, null);
  assert.equal(read().suite.owner, '@train');
});

test('capacity AC-22 train: while the train suite runs or waits a new gate waits, and takes a slot after the train is released', () => {
  const { take, read, env } = ledger();
  take('@train', 'suite', 200);
  assert.deepEqual(take('a', 'gate', 301), { taken: false, wait: "devkit-test: waiting for the train's suite" });
  releaseSlots({ pid: 200, env });
  assert.deepEqual(take('a', 'gate', 301), { taken: true });
  // a train that waits for the gate in flight also holds a new gate back
  assert.deepEqual(take('@train', 'suite', 201), { taken: false, wait: 'devkit-test: the train waits for 1 test runs to end' });
  assert.deepEqual(take('b', 'gate', 302), { taken: false, wait: "devkit-test: waiting for the train's suite" });
  assert.equal(read().gates.length, 1);
});

test('capacity AC-22 train: the train waits for the gates in flight and takes the slot once they are released, clearing its trainWaiting', () => {
  const { take, read, env } = ledger();
  take('a', 'gate', 301);
  take('b', 'gate', 302);
  assert.deepEqual(take('@train', 'suite', 200), { taken: false, wait: 'devkit-test: the train waits for 2 test runs to end' });
  assert.equal(read().trainWaiting.pid, 200);
  releaseSlots({ pid: 301, env });
  assert.equal(take('@train', 'suite', 200).taken, false);
  releaseSlots({ pid: 302, env });
  assert.deepEqual(take('@train', 'suite', 200), { taken: true });
  assert.deepEqual({ suite: read().suite.owner, waiting: read().trainWaiting }, { suite: '@train', waiting: null });
});

test('capacity AC-22 gates: a third gate waits at gates 2 with the count of runs in flight', () => {
  const { take } = ledger();
  assert.equal(take('a', 'gate', 301).taken, true);
  assert.equal(take('b', 'gate', 302).taken, true);
  assert.deepEqual(take('c', 'gate', 303), { taken: false, wait: 'devkit-test: waiting for a gate slot (2 of 2 in flight)' });
  assert.equal(take('c', 'gate', 303, { gates: 3 }).taken, true);
});

test('capacity AC-22 gates: a gate and a whole suite do not hold each other back when no train is involved', () => {
  const { take } = ledger();
  assert.equal(take('a', 'suite', 101).taken, true);
  assert.equal(take('b', 'gate', 301).taken, true);
});

test('capacity AC-22 dead pid: its slot is taken, the injected alive deciding', () => {
  const { take, read } = ledger();
  take('a', 'suite', 101);
  assert.equal(take('b', 'suite', 102, { alive: (pid) => pid !== 101 }).taken, true);
  assert.equal(read().suite.pid, 102);
  const dead = ledger();
  dead.take('a', 'gate', 301);
  dead.take('b', 'gate', 302);
  assert.equal(dead.take('c', 'gate', 303, { alive: (pid) => pid === 302 }).taken, true);
  assert.deepEqual(dead.read().gates.map((g) => g.pid), [302, 303]);
});

test('capacity AC-22 dead pid: with the default alive, a child that has exited holds no slot and this process does', () => {
  const { env, file } = ledger();
  const child = spawnSync(process.execPath, ['-e', '']);
  assert.equal(child.status, 0);
  const dead = child.pid;
  writeFileSync(file, JSON.stringify({ version: 1, suite: { owner: 'x', pid: dead, clone: '/c', at: 'a' }, trainWaiting: { pid: dead, clone: '/c', at: 'a' }, gates: [{ owner: 'y', pid: process.pid, clone: '/c', at: 'a' }, { owner: 'z', pid: dead, clone: '/c', at: 'a' }] }));
  const read = readSlots({ env });
  assert.deepEqual({ suite: read.suite, trainWaiting: read.trainWaiting, gates: read.gates.map((g) => g.owner) }, { suite: null, trainWaiting: null, gates: ['y'] });
  assert.equal(tryTakeSlot({ owner: 'b', kind: 'suite', clone: '/c', pid: process.pid, gates: 2, env, now: NOW }).taken, true);
});

test('capacity AC-22 clones: two clone roots on one state folder share the whole-suite slot', () => {
  const dir = tmpFolder('devkit-slots-');
  const env = { DEVKIT_STATE_DIR: dir };
  const base = { kind: 'suite', gates: 2, env, alive: always, now: NOW };
  assert.equal(tryTakeSlot({ ...base, owner: 'a', clone: '/clone-a', pid: 101 }).taken, true);
  assert.deepEqual(tryTakeSlot({ ...base, owner: 'a', clone: '/clone-b', pid: 102 }), { taken: false, wait: 'devkit-test: waiting for a whole-suite slot (a)' });
  assert.equal(readSlots({ env, alive: always }).suite.clone, '/clone-a');
});

test('capacity AC-22 release: it removes that pid\'s suite, gate and trainWaiting entries and no other, and a missing ledger is no error', () => {
  const { env, file, read } = ledger();
  assert.doesNotThrow(() => releaseSlots({ pid: 1, env }));
  assert.equal(existsSync(file), false);
  writeFileSync(file, JSON.stringify({
    version: 1, suite: { owner: 'a', pid: 7, clone: '/c', at: 't' }, trainWaiting: { pid: 7, clone: '/c', at: 't' },
    gates: [{ owner: 'g', pid: 7, clone: '/c', at: 't' }, { owner: 'h', pid: 8, clone: '/c', at: 't' }],
  }));
  releaseSlots({ pid: 7, env });
  assert.deepEqual(read(), { version: 1, suite: null, trainWaiting: null, gates: [{ owner: 'h', pid: 8, clone: '/c', at: 't' }] });
  const other = ledger();
  writeFileSync(other.file, JSON.stringify({ version: 1, suite: { owner: 'a', pid: 9, clone: '/c', at: 't' }, trainWaiting: null, gates: [] }));
  releaseSlots({ pid: 7, env: other.env });
  assert.equal(other.read().suite.pid, 9);
});

test('capacity AC-22 wait: waitForSlot logs its first wait line once, nothing on later rounds, and sleeps the step between rounds', async () => {
  const { take, env } = ledger();
  take('a', 'suite', 101);
  const logs = [];
  const sleeps = [];
  let rounds = 0;
  const sleep = async (ms) => { sleeps.push(ms); if (++rounds === 3) releaseSlots({ pid: 101, env }); };
  await waitForSlot({ owner: 'b', kind: 'suite', clone: '/c', pid: 102, gates: 2, env, alive: always, sleep, log: (line) => logs.push(line) });
  assert.deepEqual(logs, ['devkit-test: waiting for a whole-suite slot (a)']);
  assert.deepEqual(sleeps, [SLOT_STEP_MS, SLOT_STEP_MS, SLOT_STEP_MS]);
  assert.equal(readSlots({ env, alive: always }).suite.pid, 102);
});

test('capacity AC-22 wait: a free slot resolves at once with no log and no sleep, and stepMs overrides the step', async () => {
  const { env } = ledger();
  const logs = [];
  const sleeps = [];
  await waitForSlot({ owner: 'a', kind: 'gate', clone: '/c', pid: 1, gates: 2, env, alive: always, sleep: async (ms) => sleeps.push(ms), log: (l) => logs.push(l) });
  assert.deepEqual({ logs, sleeps }, { logs: [], sleeps: [] });
  await waitForSlot({ owner: 'b', kind: 'gate', clone: '/c', pid: 2, gates: 1, env, alive: always, stepMs: 5, sleep: async (ms) => { sleeps.push(ms); releaseSlots({ pid: 1, env }); }, log: (l) => logs.push(l) });
  assert.deepEqual(sleeps, [5]);
  assert.deepEqual(logs, ['devkit-test: waiting for a gate slot (1 of 1 in flight)']);
});

test('capacity AC-22 ledger: a ledger written by a take is the version-1 shape on disk', () => {
  const { take, file } = ledger();
  take('a', 'gate', 301);
  const disk = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(Object.keys(disk).sort(), ['gates', 'suite', 'trainWaiting', 'version']);
  assert.equal(disk.version, 1);
});
