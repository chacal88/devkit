// The tests of the replay cut in proof/gh-shim.mjs (design D-13): with REPLAY_MAX_PR set, a live replay of pull request <n> sees
// no pull request numbered above n. Run them with `node --test openspec/changes/forced-merge-path/proof/gh-shim.test.mjs`
// (scripts/test-suite.mjs reads only four plugin folders, so the suite does not pick this file up).
import assert from 'node:assert/strict';
import test from 'node:test';
import { REFUSED, shim } from './gh-shim.mjs';

const LIVE = { REPLAY_REAL_GH: '/usr/bin/gh', REPLAY_MAX_PR: '88' };
const PRS = [
  { number: 92, url: 'u92', state: 'MERGED', headRefName: 'chore/archive-x' },
  { number: 88, url: 'u88', state: 'MERGED', headRefName: 'x' },
  { number: 70, url: 'u70', state: 'MERGED', headRefName: 'y' },
];

// A fake real gh: answers canned stdout per call and records the calls it received.
function fake(answer) {
  const calls = [];
  const runReal = (args) => {
    calls.push(args);
    const a = typeof answer === 'function' ? answer(args) : answer;
    return { status: a.status ?? 0, stdout: typeof a.stdout === 'string' ? a.stdout : JSON.stringify(a.stdout ?? ''), stderr: a.stderr ?? '' };
  };
  return { runReal, calls };
}
const live = (args, answer, env = LIVE) => { const f = fake(answer); return { out: shim(args, env, { runReal: f.runReal }), calls: f.calls }; };
// Like gh, a list answers only the JSON fields asked for.
const only = (fields) => (args) => {
  const eq = args.find((a) => a.startsWith('--json='));
  const asked = (eq ? eq.slice('--json='.length) : args[args.indexOf('--json') + 1]).split(',');
  return { stdout: PRS.map((p) => Object.fromEntries(asked.filter((f) => f in p).map((f) => [f, p[f]]))) };
};

test('pr list drops every pull request above the cut when --json asks for number', () => {
  const { out, calls } = live(['pr', 'list', '--state', 'all', '--json', 'number,url'], only(['number', 'url']));
  assert.equal(out.exit, 0);
  assert.deepEqual(JSON.parse(out.stdout), [{ number: 88, url: 'u88' }, { number: 70, url: 'u70' }]);
  assert.deepEqual(calls[0], ['pr', 'list', '--state', 'all', '--json', 'number,url']);
});

test('pr list adds number to the real call when --json does not ask for it, and strips it from the answer', () => {
  const { out, calls } = live(['pr', 'list', '--state', 'merged', '--json', 'url,state'], only(['url', 'state']));
  assert.equal(out.exit, 0);
  assert.deepEqual(JSON.parse(out.stdout), [{ url: 'u88', state: 'MERGED' }, { url: 'u70', state: 'MERGED' }]);
  assert.ok(calls[0][calls[0].indexOf('--json') + 1].split(',').includes('number'), 'the real call asks for number');
});

test('pr list written --json=<fields> is cut the same way', () => {
  const { out, calls } = live(['pr', 'list', '--json=url'], only(['url']));
  assert.deepEqual(JSON.parse(out.stdout), [{ url: 'u88' }, { url: 'u70' }]);
  assert.ok(calls[0].some((a) => a.startsWith('--json=') && a.split('=')[1].split(',').includes('number')));
});

test('pr list that cannot be cut (no --json, or --jq) is refused, never passed through', () => {
  for (const args of [['pr', 'list'], ['pr', 'list', '--json', 'url', '--jq', '.[].url'], ['pr', 'list', '--json', 'url', '-q', '.[]'], ['pr', 'list', '--json', 'url', '--template', '{{.}}']]) {
    const { out, calls } = live(args, only(['url']));
    assert.equal(out.exit, REFUSED, args.join(' '));
    assert.match(out.stderr, /REPLAY_MAX_PR/);
    assert.equal(calls.length, 0);
  }
});

test('pr list keeps an error of the real gh as it is', () => {
  const { out } = live(['pr', 'list', '--json', 'url'], { status: 1, stderr: 'gh: boom\n' });
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'gh: boom\n');
});

test('pr view of a number above the cut answers like gh for a missing pull request, without calling GitHub', () => {
  const { out, calls } = live(['pr', 'view', '92', '--json', 'state'], { stdout: { state: 'MERGED' } });
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'Could not resolve to a pull request with the number of 92.\n');
  assert.equal(out.stdout, '');
  assert.equal(calls.length, 0);
});

test('pr view of a pull request URL above the cut is missing too', () => {
  const { out, calls } = live(['pr', 'view', 'https://github.com/o/r/pull/93'], {});
  assert.equal(out.exit, 1);
  assert.match(out.stderr, /number of 93\./);
  assert.equal(calls.length, 0);
});

test('pr view of the cut number and below goes to the real gh unchanged', () => {
  for (const k of ['88', '12']) {
    const { out, calls } = live(['pr', 'view', k, '--json', 'state'], { stdout: { state: 'MERGED' } });
    assert.equal(out.exit, 0);
    assert.deepEqual(JSON.parse(out.stdout), { state: 'MERGED' });
    assert.deepEqual(calls, [['pr', 'view', k, '--json', 'state']]);
  }
});

test('pr view of a branch whose pull request is above the cut answers "no pull requests found"', () => {
  const probe = (args) => (args.includes('number,headRefName') ? { stdout: { number: 92, headRefName: 'chore/archive-x' } } : { stdout: { state: 'MERGED' } });
  const { out, calls } = live(['pr', 'view', 'chore/archive-x', '--json', 'state'], probe);
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'no pull requests found for branch "chore/archive-x"\n');
  assert.equal(out.stdout, '');
  assert.ok(calls.every((c) => c.includes('number,headRefName')), 'only the probe ran: the answer itself never left the shim');
});

test('pr view with no selector (the current branch) above the cut names the branch the probe found', () => {
  const probe = (args) => (args.includes('number,headRefName') ? { stdout: { number: 95, headRefName: 'some-branch' } } : { stdout: { state: 'OPEN' } });
  const { out } = live(['pr', 'view', '--json', 'state'], probe);
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'no pull requests found for branch "some-branch"\n');
});

test('pr view of a branch at or below the cut goes through with the real answer', () => {
  const probe = (args) => (args.includes('number,headRefName') ? { stdout: { number: 88, headRefName: 'x' } } : { stdout: { state: 'MERGED' } });
  const { out, calls } = live(['pr', 'view', 'x', '--json', 'state'], probe);
  assert.equal(out.exit, 0);
  assert.deepEqual(JSON.parse(out.stdout), { state: 'MERGED' });
  assert.deepEqual(calls.at(-1), ['pr', 'view', 'x', '--json', 'state']);
});

test('pr view of a branch with no pull request keeps the real gh error', () => {
  const probe = () => ({ status: 1, stderr: 'no pull requests found for branch "z"\n' });
  const { out } = live(['pr', 'view', 'z'], probe);
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'no pull requests found for branch "z"\n');
});

test('pr checks and pr diff of a number above the cut are missing too', () => {
  for (const sub of ['checks', 'diff']) {
    const { out, calls } = live(['pr', sub, '92'], {});
    assert.equal(out.exit, 1, sub);
    assert.match(out.stderr, /number of 92\./);
    assert.equal(calls.length, 0);
  }
});

test('api pulls list drops entries above the cut; commits/<sha>/pulls too', () => {
  for (const route of ['repos/{owner}/{repo}/pulls?state=all', 'repos/{owner}/{repo}/commits/abc123/pulls']) {
    const { out } = live(['api', route], { stdout: PRS });
    assert.equal(out.exit, 0, route);
    assert.deepEqual(JSON.parse(out.stdout).map((p) => p.number), [88, 70], route);
  }
});

test('api pulls/<k> above the cut answers 404 without calling GitHub; below it passes', () => {
  const missing = live(['api', 'repos/{owner}/{repo}/pulls/92'], { stdout: PRS[0] });
  assert.equal(missing.out.exit, 1);
  assert.equal(missing.out.stderr, 'gh: Not Found (HTTP 404)\n');
  assert.equal(missing.calls.length, 0);
  const sub = live(['api', 'repos/{owner}/{repo}/pulls/93/files', '--paginate'], {});
  assert.equal(sub.out.exit, 1);
  assert.equal(sub.calls.length, 0);
  const ok = live(['api', 'repos/{owner}/{repo}/pulls/88'], { stdout: PRS[1] });
  assert.equal(ok.out.exit, 0);
  assert.deepEqual(JSON.parse(ok.out.stdout), PRS[1]);
});

test('api: a single pull request object above the cut answers 404 even on a route the shim does not know by number', () => {
  const { out } = live(['api', 'repos/{owner}/{repo}/commits/abc/pulls'], { stdout: PRS[0] });
  assert.equal(out.exit, 1);
  assert.equal(out.stderr, 'gh: Not Found (HTTP 404)\n');
});

test('api pulls/<k>/files below the cut with --jq passes unchanged', () => {
  const { out, calls } = live(['api', 'repos/{owner}/{repo}/pulls/88/files', '--paginate', '--jq', '.[].filename'], { stdout: 'a.ts\nb.ts\n' });
  assert.equal(out.exit, 0);
  assert.equal(out.stdout, 'a.ts\nb.ts\n');
  assert.equal(calls.length, 1);
});

test('api pulls list with --jq cannot be cut and is refused', () => {
  const { out, calls } = live(['api', 'repos/{owner}/{repo}/pulls', '--jq', '.[].number'], { stdout: '92\n88\n' });
  assert.equal(out.exit, REFUSED);
  assert.match(out.stderr, /REPLAY_MAX_PR/);
  assert.equal(calls.length, 0);
});

test('graphql and every other api call pass unchanged', () => {
  const graphql = ['api', 'graphql', '-F', 'number=92', '-f', 'query=query { viewer { login } }'];
  const g = live(graphql, { stdout: { data: { viewer: { login: 'x' } } } });
  assert.equal(g.out.exit, 0);
  assert.deepEqual(g.calls, [graphql]);
  const contents = live(['api', 'repos/{owner}/{repo}/contents/openspec/changes?ref=main'], { stdout: PRS });
  assert.deepEqual(JSON.parse(contents.out.stdout), PRS, 'an array that is not a pull request route is not cut');
  const version = live(['--version'], { stdout: 'gh version 2.60.0\n' });
  assert.equal(version.out.exit, 0);
});

test('without REPLAY_MAX_PR nothing is cut', () => {
  const env = { REPLAY_REAL_GH: '/usr/bin/gh' };
  const list = live(['pr', 'list', '--json', 'number'], only(['number']), env);
  assert.equal(list.out.exit, 0);
  assert.equal(JSON.parse(list.out.stdout).length, 3);
  const view = live(['pr', 'view', '92', '--json', 'state'], { stdout: { state: 'MERGED' } }, env);
  assert.equal(view.out.exit, 0);
  const empty = live(['pr', 'view', '92'], { stdout: 'x' }, { ...env, REPLAY_MAX_PR: '' });
  assert.equal(empty.out.exit, 0);
});

test('a REPLAY_MAX_PR that is not a number is refused', () => {
  const { out, calls } = live(['pr', 'list', '--json', 'number'], only(['number']), { ...LIVE, REPLAY_MAX_PR: 'abc' });
  assert.equal(out.exit, REFUSED);
  assert.match(out.stderr, /REPLAY_MAX_PR/);
  assert.equal(calls.length, 0);
});

test('the read-only policy still refuses a write, with or without the cut', () => {
  for (const args of [['pr', 'merge', '88'], ['api', 'repos/{owner}/{repo}/pulls/88', '-X', 'POST']]) {
    const { out, calls } = live(args, {});
    assert.equal(out.exit, REFUSED);
    assert.equal(calls.length, 0);
  }
});

test('fixture mode is unaffected by REPLAY_MAX_PR', () => {
  const answers = { 'pr-list': { stdout: PRS }, 'pr-view-92': { stdout: { state: 'MERGED' } } };
  const env = { REPLAY_ANSWERS: 'x', REPLAY_MAX_PR: '50' };
  const f = fake({});
  const list = shim(['pr', 'list', '--json', 'number'], env, { runReal: f.runReal, answers });
  assert.deepEqual(JSON.parse(list.stdout).map((p) => p.number), [92, 88, 70]);
  const view = shim(['pr', 'view', '92', '--json', 'state'], env, { runReal: f.runReal, answers });
  assert.equal(view.exit, 0);
  assert.equal(f.calls.length, 0);
});
