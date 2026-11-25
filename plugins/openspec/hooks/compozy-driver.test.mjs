// node scripts/test-suite.mjs --test-name-pattern="^compozy-driver" plugins/openspec/hooks/compozy-driver.test.mjs
// compozy-driver D-2: the one module that calls CompozyOS. Every test runs the real module against a fake `compozy`
// binary (a node script in a temporary folder, given as COMPOZY_BIN); no test calls the real `compozy`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { fakeCompozy } from './test-fixtures.mjs';
import { readiness, liveRuns, startRun, pauseRun, resumeRun, cancelRun, pendingRequests, LIVE_STATES } from './compozy-driver.mjs';
import { LoopUsageError } from './change-loop.mjs';

const READY = {
  'workspace info': { stdout: { workspace: { name: 'devkit' } } },
  'loop inspect': { stdout: { name: 'devkit-change' } },
};
const MAIN = import.meta.dirname; // any folder that exists: the fake binary is spawned there

test('compozy-driver readiness: not-installed when the binary cannot be spawned, with its fixing command', () => {
  const k = fakeCompozy(READY);
  const env = { ...k.env, COMPOZY_BIN: join(k.dir, 'no-such-compozy') };
  const r = readiness(k.dir, { env });
  assert.deepEqual([r.ok, r.reason], [false, 'not-installed']);
  assert.equal(r.fix, 'brew install compozy/compozy/compozy');
});

test('compozy-driver readiness: daemon-stopped when the socket is absent, or a file nobody listens on', () => {
  const k = fakeCompozy(READY);
  const absent = readiness(k.dir, { env: k.env });
  assert.deepEqual([absent.ok, absent.reason, absent.fix], [false, 'daemon-stopped', 'compozy daemon start']);
  writeFileSync(join(k.home, 'daemon.sock'), 'not a socket');
  assert.equal(readiness(k.dir, { env: k.env }).reason, 'daemon-stopped', 'a file with no listener refuses the connection');
  assert.deepEqual(k.argvs().map((a) => a[0]), ['--version', '--version'], 'the check starts nothing: it only spawned the binary for --version');
});

test('compozy-driver readiness: workspace-unknown when workspace info exits non-zero, run in the main checkout', async (t) => {
  const k = fakeCompozy({ ...READY, 'workspace info': { code: 1, stderr: 'not registered\n' } });
  await k.daemon(t);
  const r = readiness(k.dir, { env: k.env });
  assert.deepEqual([r.ok, r.reason, r.fix], [false, 'workspace-unknown', `compozy workspace add ${k.dir}`]);
  const call = k.calls().find((c) => c.argv[0] === 'workspace');
  assert.deepEqual(call.argv, ['workspace', 'info', '-o', 'json']);
  assert.equal(call.cwd, realpathSync(k.dir));
});

test('compozy-driver readiness: kit-missing when the change loop is not in the workspace', async (t) => {
  const k = fakeCompozy({ ...READY, 'loop inspect': { code: 69, stderr: 'loop definition not found\n' } });
  await k.daemon(t);
  const r = readiness(k.dir, { env: k.env });
  assert.deepEqual([r.ok, r.reason], [false, 'kit-missing']);
  assert.match(r.fix, /\/devkit setup/);
  assert.deepEqual(k.argvs().find((a) => a[1] === 'inspect'), ['loop', 'inspect', '--name', 'devkit-change', '--workspace', k.dir, '-o', 'json']);
});

test('compozy-driver readiness: ready when the binary, the daemon, the workspace and the kit are all there', async (t) => {
  const k = fakeCompozy(READY);
  await k.daemon(t);
  assert.deepEqual(readiness(k.dir, { env: k.env }), { ok: true });
});

test('compozy-driver readiness: the rows are checked in order, the first failure wins', async (t) => {
  const everyWrong = { ...READY, 'workspace info': { code: 1 }, 'loop inspect': { code: 1 } };
  const k = fakeCompozy(everyWrong);
  const missing = { ...k.env, COMPOZY_BIN: join(k.dir, 'no-such-compozy') };
  assert.equal(readiness(k.dir, { env: missing }).reason, 'not-installed', 'before the daemon');
  assert.equal(readiness(k.dir, { env: k.env }).reason, 'daemon-stopped', 'before the workspace');
  await k.daemon(t);
  assert.equal(readiness(k.dir, { env: k.env }).reason, 'workspace-unknown', 'before the kit');
  k.set({ ...everyWrong, 'workspace info': { stdout: {} } });
  assert.equal(readiness(k.dir, { env: k.env }).reason, 'kit-missing');
});

test('compozy-driver readiness: the socket is $COMPOZY_HOME/daemon.sock, and ~/.compozy when unset', async (t) => {
  const k = fakeCompozy(READY);
  await k.daemon(t);
  const home = tmpFolder('devkit-compozy-user-');
  const unset = { COMPOZY_BIN: k.bin, HOME: home };
  assert.equal(readiness(k.dir, { env: unset }).reason, 'daemon-stopped', 'nothing listens under the default home');
  assert.equal(readiness(k.dir, { env: k.env }).ok, true);
});

test('compozy-driver liveRuns: lists the loop run in the workspace and keeps the five live states', () => {
  const k = fakeCompozy({
    'loop runs': {
      stdout: {
        items: [
          { run_id: 'r1', status: 'running', inputs: { change_id: 'a' } },
          { run_id: 'r2', status: 'done', inputs: { change_id: 'a' } },
          { run_id: 'r3', status: 'queued' },
          { run_id: 'r4', status: 'watching', inputs: { change_id: 'b' } },
          { run_id: 'r5', status: 'needs-approval', inputs: {} },
          { run_id: 'r6', status: 'paused', inputs: { change_id: 'c' } },
          { run_id: 'r7', status: 'failed', inputs: {} },
          { run_id: 'r8', status: 'cancelled', inputs: {} },
        ],
      },
    },
  });
  const runs = liveRuns(MAIN, 'devkit-change', { env: k.env });
  assert.deepEqual(LIVE_STATES, ['queued', 'running', 'watching', 'needs-approval', 'paused']);
  assert.deepEqual(runs, [
    { runId: 'r1', status: 'running', inputs: { change_id: 'a' } },
    { runId: 'r3', status: 'queued', inputs: {} },
    { runId: 'r4', status: 'watching', inputs: { change_id: 'b' } },
    { runId: 'r5', status: 'needs-approval', inputs: {} },
    { runId: 'r6', status: 'paused', inputs: { change_id: 'c' } },
  ]);
  assert.deepEqual(k.argvs(), [['loop', 'runs', '--loop', 'devkit-change', '--workspace', MAIN, '-o', 'json']]);
});

test('compozy-driver startRun: one --input per input, --no-prompt, and the run id with the web url', () => {
  const k = fakeCompozy({ 'loop run': { stdout: { resolution_source: 'flag', run: { run_id: 'looprun-1' }, web_url: 'http://localhost:2123/loop-runs/looprun-1' } } });
  const r = startRun(MAIN, 'devkit-change', { change_id: 'feat', request: 'add a thing', lang: 'en' }, { env: k.env });
  assert.deepEqual(r, { runId: 'looprun-1', url: 'http://localhost:2123/loop-runs/looprun-1' });
  assert.deepEqual(k.argvs(), [['loop', 'run', '--name', 'devkit-change', '--workspace', MAIN, '--no-prompt', '-o', 'json',
    '--input', 'change_id=feat', '--input', 'request=add a thing', '--input', 'lang=en']]);
});

test('compozy-driver startRun: url is null when the reply has no web_url', () => {
  const k = fakeCompozy({ 'loop run': { stdout: { run: { run_id: 'looprun-2' } } } });
  assert.deepEqual(startRun(MAIN, 'devkit-change', { change_id: 'x' }, { env: k.env }), { runId: 'looprun-2', url: null });
});

test('compozy-driver startRun: a reply with no run id is an error', () => {
  const k = fakeCompozy({ 'loop run': { stdout: { web_url: 'http://x' } } });
  assert.throws(() => startRun(MAIN, 'devkit-change', {}, { env: k.env }), LoopUsageError);
});

test('compozy-driver pauseRun, resumeRun and cancelRun: act on the run id in the workspace', () => {
  const k = fakeCompozy({});
  pauseRun(MAIN, 'r1', { env: k.env });
  resumeRun(MAIN, 'r2', { env: k.env });
  cancelRun(MAIN, 'r3', { env: k.env });
  assert.deepEqual(k.argvs(), [
    ['loop', 'pause', '--run-id', 'r1', '--workspace', MAIN],
    ['loop', 'resume', '--run-id', 'r2', '--workspace', MAIN],
    ['loop', 'cancel', '--run-id', 'r3', '--workspace', MAIN],
  ]);
});

test('compozy-driver pendingRequests: the count of the pending items of the workspace', () => {
  const k = fakeCompozy({ 'loop requests': { stdout: { items: [{ node_id: 'a' }, { node_id: 'b' }, { node_id: 'c' }] } } });
  assert.equal(pendingRequests(MAIN, { env: k.env }), 3);
  assert.deepEqual(k.argvs(), [['loop', 'requests', '--workspace', MAIN, '-o', 'json']]);
  k.set({ 'loop requests': { stdout: { items: [] } } });
  assert.equal(pendingRequests(MAIN, { env: k.env }), 0);
});

test('compozy-driver: any other failure throws LoopUsageError with the first stderr line of the command', () => {
  const k = fakeCompozy({ 'loop runs': { code: 1, stderr: 'daemon exploded\nsecond line\n' }, 'loop pause': { code: 2, stderr: 'no such run\n' }, 'loop requests': { code: 1 } });
  assert.throws(() => liveRuns(MAIN, 'devkit-change', { env: k.env }), (e) => e instanceof LoopUsageError && e.message === 'daemon exploded');
  assert.throws(() => pauseRun(MAIN, 'zz', { env: k.env }), (e) => e instanceof LoopUsageError && e.message === 'no such run');
  assert.throws(() => pendingRequests(MAIN, { env: k.env }), (e) => e instanceof LoopUsageError && /exited 1/.test(e.message), 'no stderr: the exit status is named');
});

test('compozy-driver: a reply that is not JSON is an error, not an empty list', () => {
  const k = fakeCompozy({ 'loop runs': { stdout: 'oops' } });
  assert.throws(() => liveRuns(MAIN, 'devkit-change', { env: k.env }), LoopUsageError);
});

test('compozy-driver: the exec option replaces the process spawn, and the binary is compozy on PATH when COMPOZY_BIN is unset', () => {
  const seen = [];
  const exec = (cmd, args, o) => { seen.push([cmd, args, o.cwd]); return { status: 0, stdout: JSON.stringify({ items: [] }), stderr: '' }; };
  assert.deepEqual(liveRuns(MAIN, 'devkit-change', { env: {}, exec }), []);
  assert.deepEqual(seen, [['compozy', ['loop', 'runs', '--loop', 'devkit-change', '--workspace', MAIN, '-o', 'json'], MAIN]]);
});
