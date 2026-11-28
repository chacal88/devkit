// node scripts/test-suite.mjs plugins/openspec/hooks/change-state-listing.test.mjs
// state-listing-speed, phase 1 (design D-1 to D-7): the `state` listing reads its changes at once, each in a process of its own,
// and prints what reading them one after another prints. What the parts share is in test-fixtures.mjs and change-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gitRepo, put, commitAll, roundRepo, cleanEnvLoop as cleanEnv, SET_LOOP as SET } from './test-fixtures.mjs';
import * as changeLoopModule from './change-loop.mjs';
import { main, runFilePath } from './change-loop.mjs';
import { LOOP, IDENT, addChange } from './change-loop-fixtures.mjs';

for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

// The real CLI, read once: the stand-in below hands every call to it.
const REAL_OPENSPEC = execFileSync('sh', ['-c', 'command -v openspec'], { encoding: 'utf8', env: process.env }).trim();
const LOG_VAR = 'STATE_LISTING_STANDIN_LOG';

// An `openspec` stand-in in a fresh folder: logs `start <change> <ms> <GIT_OPTIONAL_LOCKS or ->`, waits 400 ms, runs the real CLI
// with the same arguments, logs `end <change> <ms>` and exits with the real CLI's status. `<change>` is the value after
// `--change`, or `-`.
function standIn() {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-listing-standin-'));
  const log = join(dir, 'calls.log');
  writeFileSync(log, '');
  const script = `#!${process.execPath}
const { appendFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const at = args.indexOf('--change');
const change = at === -1 ? '-' : args[at + 1];
const log = process.env.${LOG_VAR};
appendFileSync(log, 'start ' + change + ' ' + Date.now() + ' ' + (process.env.GIT_OPTIONAL_LOCKS ?? '-') + '\\n');
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
const r = spawnSync(${JSON.stringify(REAL_OPENSPEC)}, args, { stdio: 'inherit' });
appendFileSync(log, 'end ' + change + ' ' + Date.now() + '\\n');
process.exit(r.status ?? 1);
`;
  const bin = join(dir, 'openspec');
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return { dir, log, env: (base) => ({ ...base, PATH: `${dir}:${base.PATH}`, [LOG_VAR]: log }), done: () => rmSync(dir, { recursive: true, force: true }) };
}

// The largest number of distinct changes with a `start` and no `end` at one instant (an end goes first at a tie).
const overlapOf = (logText) => {
  const events = logText.split('\n').filter(Boolean).map((l) => l.split(' ')).filter(([, change]) => change !== '-')
    .map(([kind, change, at]) => ({ kind, change, at: Number(at) }))
    .sort((a, b) => a.at - b.at || (a.kind === 'end' ? -1 : 1) - (b.kind === 'end' ? -1 : 1));
  const open = new Map();
  let most = 0;
  for (const e of events) {
    open.set(e.change, (open.get(e.change) ?? 0) + (e.kind === 'start' ? 1 : -1));
    if (open.get(e.change) === 0) open.delete(e.change);
    most = Math.max(most, open.size);
  }
  return most;
};

const grill = { '.openspec.yaml': 'schema: devkit\n' };

// Three changes at the grill (a, b, c), a start `d` the run file names with no folder, and change `x` in the worktree `side`
// (a branch that is not its own: blocked, wrong-branch). The ids of the listing are a, b, c, d, x.
function listing() {
  const t = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] d\n', config: 'schema: devkit\n', changes: { a: grill, b: grill, c: grill } });
  const file = runFilePath(t.main);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, places: 1, starting: ['d'], inflight: { d: { kind: 'agent', stage: 'open', at: '2026-11-21T10:00:00.000Z' } } }));
  const side = t.addWt('side');
  addChange(side, 'x');
  return t;
}

const realLoop = (cwd, env, extra) => spawnSync(process.execPath, [LOOP, 'state', ...extra], { cwd, env: { ...env, ...SET }, encoding: 'utf8' });

// Invariant (AC-1, AC-3, D-2): the listing's reads overlap, never beyond the bound, and no child takes the index lock.
test('state-listing-speed AC-1 the reads of the listing overlap', () => {
  const t = listing();
  const s = standIn();
  try {
    const r = realLoop(t.main, s.env(cleanEnv), ['--offline', '--lang', 'en']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).changes.map((e) => e.change), ['a', 'b', 'c', 'd', 'x']);
    const text = readFileSync(s.log, 'utf8');
    const overlap = overlapOf(text);
    assert.ok(overlap >= Math.min(2, Math.max(1, availableParallelism())), `overlap ${overlap}`);
    const bound = changeLoopModule.listingBound();
    assert.ok(overlap <= bound, `overlap ${overlap} over the bound ${bound}`);
    const starts = text.split('\n').filter((l) => l.startsWith('start ') && l.split(' ')[1] !== '-');
    assert.ok(starts.length > 0);
    for (const l of starts) assert.equal(l.split(' ')[3], '0', l);
  } finally { s.done(); }
});

// Invariant (AC-2, D-1): the listing's bytes are the sequential read's, offline and with the fake gh.
test('state-listing-speed AC-2 the listing is byte-identical to the sequential read', async (t) => {
  const r = listing();
  const cases = [['with --offline', ['--offline', '--lang', 'en'], cleanEnv], ['without --offline', ['--lang', 'en'], { ...r.ghAt(r.main).env, ...SET }]];
  for (const [label, extra, env] of cases) {
    await t.test(label, () => {
      const real = realLoop(r.main, env, extra);
      const sequential = main(['state', ...extra], { cwd: r.main, env });
      assert.equal(real.status, sequential.code, real.stdout + real.stderr);
      assert.equal(real.stdout, sequential.stdout);
      assert.equal(real.stderr, sequential.stderr);
      assert.equal(real.stderr, '');
    });
  }
});

test('state-listing-speed AC-2 each entry is the one state --change prints', () => {
  const t = listing();
  const all = JSON.parse(realLoop(t.main, cleanEnv, ['--offline', '--lang', 'en']).stdout).changes;
  assert.deepEqual(all.map((e) => e.change), ['a', 'b', 'c', 'd', 'x']);
  for (const e of all) {
    const one = realLoop(t.main, cleanEnv, ['--change', e.change, '--offline', '--lang', 'en']);
    assert.equal(one.status, 0, one.stdout + one.stderr);
    assert.deepEqual(JSON.parse(one.stdout).changes, [e]);
  }
});

// Invariant (AC-3, D-4): the pool starts no more than its limit and keeps item order.
test('state-listing-speed AC-3 the pool never runs more than its limit', async (t) => {
  const pool = async (limit) => {
    let now = 0;
    let most = 0;
    const results = await changeLoopModule.boundedMap([1, 2, 3, 4, 5, 6], limit, async (item) => {
      now++;
      most = Math.max(most, now);
      await new Promise((done) => setTimeout(done, 50));
      now--;
      return item * 10;
    });
    return { most, results };
  };
  await t.test('limit 2', async () => {
    const { most, results } = await pool(2);
    assert.equal(most, 2);
    assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
  });
  await t.test('limit 0 and limit 1 run one at a time', async () => {
    assert.equal((await pool(0)).most, 1);
    assert.equal((await pool(1)).most, 1);
  });
  await t.test('the bound is the machine cores, at least one', () => {
    assert.equal(changeLoopModule.listingBound(), Math.max(1, availableParallelism()));
  });
});

test('state-listing-speed AC-3 the pool stops starting after a stop', async () => {
  const started = [];
  const results = await changeLoopModule.boundedMap([1, 2, 3, 4, 5, 6], 1, async (item) => { started.push(item); return item; }, { stopWhen: (r) => r === 2 });
  assert.deepEqual(started, [1, 2]);
  assert.deepEqual(results, [1, 2, null, null, null, null]);
});

// The three-change repository of the join tests, and the reader that answers for it without a process.
const threeChanges = () => gitRepo({ config: 'schema: devkit\n', changes: { a: grill, b: grill, c: grill } });
const ARGV = ['state', '--offline', '--lang', 'en'];
const entryAnswer = (id, extra = {}) => ({ id, code: 0, signal: null, stdout: `${JSON.stringify({ version: 1, changes: [{ change: id, state: 'ok', ...extra }] }, null, 2)}\n`, stderr: '', error: null });
const reader = (answers) => async (id) => answers[id] ?? entryAnswer(id);

test('state-listing-speed AC-4 an unreadable change is listed blocked', async () => {
  const root = threeChanges();
  const blocked = { state: 'blocked', reasonCode: 'unreadable' };
  const r = await changeLoopModule.stateListing(ARGV, { env: cleanEnv, cwd: root, readOne: reader({ b: entryAnswer('b', blocked) }) });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stderr, '');
  const changes = JSON.parse(r.stdout).changes;
  assert.deepEqual(changes.map((e) => e.change), ['a', 'b', 'c']);
  assert.deepEqual(changes[1], { change: 'b', ...blocked });
});

test('state-listing-speed AC-4 a read that fails the command fails the listing', async () => {
  const root = threeChanges();
  const failed = (id) => ({ id, code: 3, signal: null, stdout: `${JSON.stringify({ version: 1, error: `openspec/config.yaml: merge_method: unknown value "bogus" (${id})`, reply: 'x' })}\n`, stderr: `change-loop: merge_method of ${id}\n`, error: null });
  const r = await changeLoopModule.stateListing(ARGV, { env: cleanEnv, cwd: root, readOne: reader({ b: failed('b'), c: failed('c') }) });
  assert.deepEqual(r, { code: 3, stdout: failed('b').stdout, stderr: failed('b').stderr });
});

test('state-listing-speed AC-4 a child that fails in a checkout of its own fails the listing as one after another', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n', changes: { a: grill, c: grill } });
  const wt = t.addWt('b');
  addChange(wt, 'b');
  put(wt, { 'openspec/config.yaml': 'schema: devkit\nmerge_method: bogus\n' });
  commitAll(wt, 'bogus merge method');
  const alone = realLoop(t.main, cleanEnv, ['--change', 'b', '--offline', '--lang', 'en']);
  assert.equal(alone.status, 3, alone.stdout + alone.stderr);
  assert.match(JSON.parse(alone.stdout).error, /merge_method/);
  const real = realLoop(t.main, cleanEnv, ['--offline', '--lang', 'en']);
  const sequential = main(['state', '--offline', '--lang', 'en'], { cwd: t.main, env: { ...cleanEnv, ...SET } });
  assert.equal(sequential.code, 3);
  assert.match(JSON.parse(sequential.stdout).error, /merge_method/);
  assert.deepEqual([real.status, real.stdout, real.stderr], [sequential.code, sequential.stdout, sequential.stderr]);
});

test('state-listing-speed AC-4 a child that dies is a usage failure', async () => {
  const root = threeChanges();
  const dead = { id: 'b', code: null, signal: 'SIGKILL', stdout: '', stderr: '', error: null };
  const r = await changeLoopModule.stateListing(ARGV, { env: cleanEnv, cwd: root, readOne: reader({ b: dead }) });
  assert.equal(r.code, 3);
  const out = JSON.parse(r.stdout);
  assert.equal(out.error, 'state of b could not be read: signal SIGKILL');
  assert.equal('changes' in out, false);
});

// Invariant (AC-6, D-6): a listing of one change or none starts no read process and prints the sequential read's bytes.
test('state-listing-speed AC-6 a listing of one change or none starts no read process', async (t) => {
  const cases = [['one change', gitRepo({ config: 'schema: devkit\n', changes: { a: grill } })], ['no change', gitRepo({ config: 'schema: devkit\n' })]];
  for (const [label, root] of cases) {
    await t.test(label, async () => {
      const called = [];
      const readOne = async (id) => { called.push(id); return entryAnswer(id); };
      const r = await changeLoopModule.stateListing(ARGV, { env: cleanEnv, cwd: root, readOne });
      const sequential = main(ARGV, { env: cleanEnv, cwd: root });
      assert.deepEqual(called, []);
      assert.deepEqual(r, { code: sequential.code, stdout: sequential.stdout, stderr: sequential.stderr });
    });
  }
});

test('state-listing-speed AC-6 in-process state stays synchronous', () => {
  const root = threeChanges();
  const r = main(['state', '--lang', 'en'], { cwd: root, env: cleanEnv, gh: () => ({ status: 1, stdout: '', stderr: 'offline' }) });
  assert.equal(typeof r.then, 'undefined');
  assert.equal(r.code, 0, r.stdout + r.stderr);
});
