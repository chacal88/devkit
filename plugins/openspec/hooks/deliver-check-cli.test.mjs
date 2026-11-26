// Tests for deliver-check.mjs, part 2 of 3 (suite-speed D-11; the others are deliver-check.test.mjs and deliver-check-archive.test.mjs): the wait at wait-merge, the merge walkthrough, the command line, the host and the watch, the field items, --ci, the change selection, the reviews check of the change's script and the checkout preflight. What the three parts share is in deliver-check-fixtures.mjs.
// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { ghError } from './merge-setup.mjs';
import { makeGh, nextStep, collectState, detectHost, watchMinutes } from './deliver-check.mjs';
import * as DC from './deliver-check.mjs';
import { GIT_ENV, git, gitRepo, put, commitAll, proposalWith, fakeGh, check, presetSetup, shipRepo, cli, runCli } from './test-fixtures.mjs';
import {
  here, review, reviews, withReviews, head, gateRow, ev, acRow, prJson, reviewAt, fullEvidence, PR_BODY, driveToReady, MERGE_FIELDS, noMergeCall,
  mergeReady, presetArchiveReads, repoRoot, coreAgent, CI_TASKS, CI_ENV, runCi, ciGate, ciProve, changeFilesOf, ciRepo, X_RETRO, archivePrRepo,
  bothEntries, GUARD_FILE, s7, ownFilesRepo, ownBrings, ownLines,
} from './deliver-check-fixtures.mjs';

// ---- the wait: --watch at wait-merge (AC-4)

const POLL = ['pr', 'view', '12', '--json', 'state,autoMergeRequest,mergeStateStatus,headRefOid'];
const on = { autoMergeRequest: { enabledAt: 'x' } };
const polls = (t) => t.gh.calls().filter((c) => c.join(' ') === POLL.join(' '));
// 8/8, auto-merge on, with DEVKIT_POLL_SECONDS=0.
function waiting(over = {}) {
  const t = mergeReady({ ...on, ...over });
  t.pr = (extra) => prJson({ headRefOid: head(t.root), body: PR_BODY, ...extra });
  t.run = (watch = '--watch=1') => runCli(t, ['feat', '--json', watch], { env: { DEVKIT_POLL_SECONDS: '0' } });
  t.gh.resetCount('pr-view');
  return t;
}

test('--watch at wait-merge: polls gh pr view <n> until MERGED, then collects again and goes on to the retro (AC-4, AC-1)', () => {
  const t = waiting();
  presetArchiveReads(t);
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr(on) }, 2);
  t.gh.set('pr-view', { stdout: t.pr({ state: 'MERGED' }) });
  const r = t.run();
  assert.equal(r.code, 0, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step], ['merged: archive step retro', 'retro']);
  assert.equal(polls(t).length, 2, 'one open poll, one merged poll');
  assert.ok(t.gh.calls().some((c) => c.join(' ') === `pr view 12 --json ${MERGE_FIELDS}`), 'the final collect reads the PR by number');
});

test('--watch at wait-merge: the cap ends the wait with "auto-merge on: waiting for ..." (AC-4)', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) });
  const started = Date.now();
  const r = t.run('--watch=0.02');
  assert.ok(Date.now() - started < 20000);
  const j = JSON.parse(r.out);
  assert.equal(j.summary, 'auto-merge on: waiting for GitHub to merge');
  assert.ok(polls(t).length >= 1);
  assert.deepEqual(j.watch, { minutes: 0.02, timedOut: true });
});

test('--watch at wait-merge: stops early when auto-merge goes off, and the next step is enable-auto-merge again', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr({ autoMergeRequest: null }) });
  const j = JSON.parse(t.run().out);
  assert.equal(j.next.step, 'enable-auto-merge');
  assert.equal(polls(t).length, 1);
});

test('--watch at wait-merge: stops early when the PR head changes (a push), and item 5 is no longer met', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr({ ...on, headRefOid: '0123456789abcdef0123456789abcdef01234567' }) });
  const j = JSON.parse(t.run().out);
  assert.equal(polls(t).length, 1);
  assert.notEqual(j.items[4].status, 'met');
  assert.notEqual(j.next.step, 'wait-merge');
});

test('--watch at wait-merge: a gh error while polling stops the wait and the state is collected again', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { exit: 1, stderr: 'gh: network down\n' });
  const j = JSON.parse(t.run().out);
  assert.equal(polls(t).length, 1);
  assert.equal(j.items[4].status, 'blocked');
  assert.match(j.items[4].reason, /network down/);
});

test('makeGh: a gh call that outlives its timeout is cut, reported as timedOut and read as "timed out" (one runner in merge-setup.mjs)', () => {
  const gh = fakeGh();
  gh.set('api-GET-repos__owner___repo_', { stdout: {}, sleep: 8000 });
  const started = Date.now();
  const r = makeGh(tmpRoot(), gh.env, 400)(['api', 'repos/{owner}/{repo}']);
  assert.ok(Date.now() - started < 5000, 'cut near the timeout, not after the 8s sleep');
  assert.equal(r.timedOut, true);
  assert.notEqual(r.status, 0);
  assert.match(ghError(r), /timed out/);
});

test('one gh runner: deliver-check.mjs and github-setup.mjs do not spawn gh themselves (architecture)', () => {
  for (const f of [join(here, 'deliver-check.mjs'), join(here, '..', 'skills', 'devkit', 'scripts', 'github-setup.mjs')]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /spawnSync\(\s*'gh'/, f);
  }
});

test('--watch at wait-merge: one stalled gh poll is cut at the cap, so the wait ends near it and not when gh answers (R-4)', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr(on), sleep: 15000 }, 2);
  t.gh.set('pr-view', { stdout: t.pr(on) });
  const started = Date.now();
  const r = t.run('--watch=0.025');
  assert.ok(Date.now() - started < 9000, `took ${Date.now() - started} ms`);
  const j = JSON.parse(r.out);
  assert.deepEqual(j.watch, { minutes: 0.025, timedOut: true });
  assert.equal(j.summary, 'auto-merge on: waiting for GitHub to merge');
});

test('--watch outside wait-merge never polls (enable-auto-merge, and no --watch at all)', () => {
  const t = mergeReady();
  runCli(t, ['feat', '--json', '--watch=1'], { env: { DEVKIT_POLL_SECONDS: '0' } });
  assert.equal(polls(t).length, 0);
  const u = waiting();
  u.gh.set('pr-view', { stdout: u.pr(on) });
  runCli(u, ['feat', '--json'], { env: { DEVKIT_POLL_SECONDS: '0' } });
  assert.equal(polls(u).length, 0, 'without --watch there is no wait');
});

// ---------------------------------------------------------------- the merge walkthrough (auto-merge 2.7: AC-2, AC-3, AC-4)

test('walkthrough (merge): enable at 8/8, wait, a product commit disables first, the loop re-runs, enable again, then the retro', () => {
  const t = shipRepo({ ship: 'merge' });
  const taken = driveToReady(t);
  assert.deepEqual(taken, ['implement', 'gate', 'implement', 'gate', 'commit', 'verify', 'commit', 'review', 'open-pr', 'enable-auto-merge']);

  const pr = (extra = {}, sha = head(t.root)) => t.gh.set('pr-view', { stdout: prJson({ headRefOid: sha, body: PR_BODY, ...extra }) });
  const step = () => nextStep(collectState(t.root, 'feat', { env: t.env }));
  const prHead = head(t.root);
  const seen = [step().step];

  pr(on); // the skill ran gh pr merge --auto and GitHub accepted it
  seen.push(step().step);

  put(t.root, { 'src/a.ts': 'changed after auto-merge was enabled\n' });
  commitAll(t.root, 'product change');
  let n = step();
  seen.push(n.step);
  assert.equal(n.number, 12);
  pr({ autoMergeRequest: null }, prHead); // the skill ran gh pr merge --disable-auto

  n = step();
  seen.push(n.step);
  fullEvidence(t.root, t.env);
  seen.push(step().step); // the change folder is committed before the review round
  commitAll(t.root, 'evidence');
  n = step();
  seen.push(n.step);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
  reviewAt(t.root, n.reviewers);
  seen.push(step().step);

  commitAll(t.root, 'ship change files'); // the push
  pr({}, head(t.root));
  n = step();
  seen.push(n.step);
  assert.deepEqual([n.number, n.method, n.head], [12, 'squash', head(t.root)]);

  pr(on, head(t.root));
  seen.push(step().step);
  pr({ state: 'MERGED' }, head(t.root));
  presetArchiveReads(t);
  seen.push(step().step);

  assert.deepEqual(seen, ['enable-auto-merge', 'wait-merge', 'disable-auto-merge', 'verify', 'commit', 'review', 'push', 'enable-auto-merge', 'wait-merge', 'retro']);
  assert.deepEqual(noMergeCall(t), [], 'deliver-check never merges; the skill runs gh pr merge');
});

// ---------------------------------------------------------------- CLI (D4, AC-6, AC-10)

test('CLI: eight item lines, the N/8 summary and next', () => {
  const t = shipRepo();
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 1);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], /^deliver-check: feat \(schema devkit-lite, ship pr, host cli, head [0-9a-f]{7}\)$/);
  const itemLines = lines.filter((l) => /^ {2}[1-8] (met|open|blocked)\s+\S/.test(l));
  assert.equal(itemLines.length, 8, r.out);
  assert.match(lines.at(-2), /^\d\/8 met: in progress: item 1$/);
  assert.match(lines.at(-1), /^next: implement/);
});

test('CLI --json carries the items, phases and next, with version 1', () => {
  const t = shipRepo();
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.version, 1);
  assert.deepEqual([j.change, j.schema, j.ship, j.host], ['feat', 'devkit-lite', 'pr', 'cli']);
  assert.equal(j.head, head(t.root));
  assert.equal(j.pr, null);
  assert.equal(j.items.length, 8);
  assert.deepEqual(Object.keys(j.items[0]).sort(), ['details', 'id', 'name', 'reason', 'status']);
  assert.equal(j.met + j.items.filter((i) => i.status !== 'met').length, 8);
  assert.equal(j.summary, 'in progress: item 1');
  assert.equal(j.next.step, 'implement');
  assert.deepEqual(j.phases[0], { n: 1, title: 'First', open: ['1.1'], conductor: [], gate: { id: '1.2', done: false, command: 'node -e 0' } });
});

test('CLI: exit 0 only at 8/8, with the PR in the JSON', () => {
  const t = shipRepo();
  driveToReady(t);
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.met, j.summary, j.next.step], [8, 'ready', 'ready']);
  assert.equal(j.pr.number, 12);
  assert.match(runCli(t, ['feat']).out, /^8\/8 met: ready$/m);
});

test('CLI: exit 2 when an item is blocked', () => {
  const t = shipRepo();
  t.gh.set('pr-view', { exit: 1, stderr: 'boom: network down\n' });
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 2);
  assert.match(r.out, /^ {2}5 blocked\s+PR open at local head: .*boom/m);
});

test('CLI: exit 3 for an unknown change, a missing id, no openspec/ and an archived-only change', () => {
  const t = shipRepo();
  assert.equal(runCli(t, ['nope']).code, 3);
  assert.match(runCli(t, ['nope']).err, /nope/);
  assert.equal(runCli(t, []).code, 3);
  for (const dots of ['.', '..']) {
    const r = runCli(t, [dots]);
    assert.equal(r.code, 3, dots);
    assert.match(r.err, /unknown change/, dots);
    assert.equal(runCli(t, [dots, '--json']).code, 3, dots);
  }
  mkdirSync(join(t.root, 'openspec/changes/archive/2026-01-01-gone'), { recursive: true });
  assert.notEqual(runCli(t, ['gone']).code, 3, 'an archived change answers (archive-after-merge D3)');
  assert.equal(runCli(t, ['neverexisted']).code, 3);
  const bare = tmpFolder('devkit-bare-');
  const r = runCli(t, ['feat'], { cwd: bare });
  assert.equal(r.code, 3);
  assert.match(r.err, /openspec/);
});

test('CLI: openspec/ without a git repo is a clear usage error, not a raw git fatal', () => {
  const dir = tmpFolder('devkit-nogit-');
  mkdirSync(join(dir, 'openspec/changes/feat'), { recursive: true });
  writeFileSync(join(dir, 'openspec/config.yaml'), 'schema: devkit\n');
  const r = spawnSync(process.execPath, [join(here, 'deliver-check.mjs'), 'feat'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not a git repository/i);
  assert.doesNotMatch(r.stderr, /fatal:/);
});

test('CLI: runs from a subdirectory of the repo', () => {
  const t = shipRepo();
  assert.equal(runCli(t, ['feat'], { cwd: join(t.root, 'src') }).code, 1);
});

test('CLI: an invalid ship or merge_method is exit 3 with the key named, and { version, error } in JSON (AC-1)', () => {
  const t = shipRepo();
  for (const [config, pattern] of [
    ['schema: devkit-lite\nship: { devkit-lite: auto }\n', /ship\.devkit-lite: unknown mode "auto"; use plan, pr or merge/],
    ['schema: devkit-lite\nship: { devkit-lite: pr }\nmerge_method: fast\n', /^openspec\/config\.yaml: merge_method: unknown value "fast"/],
  ]) {
    writeFileSync(join(t.root, 'openspec/config.yaml'), config);
    const r = runCli(t, ['feat']);
    assert.equal(r.code, 3);
    assert.match(r.err.replace(/^deliver-check: /, ''), pattern);
    assert.equal(r.out, '');
    const j = runCli(t, ['feat', '--json']);
    assert.equal(j.code, 3);
    const parsed = JSON.parse(j.out);
    assert.equal(parsed.version, 1);
    assert.match(parsed.error, pattern);
    assert.deepEqual(Object.keys(parsed).sort(), ['error', 'version']);
  }
});

test('CLI: ship merge no longer exits 3 and does not stop as plan mode (AC-1, design D2 row 1)', () => {
  const t = shipRepo({ ship: 'merge', method: 'rebase' }); // a prepared repository: merge mode reads the settings now (2.3)
  const r = runCli(t, ['feat', '--json']);
  assert.notEqual(r.code, 3, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.ship, 'merge');
  assert.equal(j.next.step, 'implement');
  assert.equal(collectState(t.root, 'feat', { env: t.env }).mergeMethod, 'rebase');
});

test('CLI: DEVKIT_BYPASS=1 changes nothing', () => {
  const t = shipRepo();
  const plain = runCli(t, ['feat', '--json']);
  const bypass = runCli(t, ['feat', '--json'], { env: { DEVKIT_BYPASS: '1' } });
  assert.deepEqual(bypass, plain);
  assert.equal(runCli(t, ['feat'], { env: { DEVKIT_BYPASS: '1' } }).code, 1);
});

test('CLI: a plan-mode project reports stop-plan-mode, with the items still computed', () => {
  const t = shipRepo();
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\n');
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.ship, 'plan');
  assert.equal(j.next.step, 'stop-plan-mode');
});

// ---------------------------------------------------------------- host and watch (D7, AC-9)

test('host: app for the desktop entrypoint, cli otherwise, DEVKIT_HOST overrides', () => {
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop' }), 'app');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'cli' }), 'cli');
  assert.equal(detectHost({}), 'cli');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: 'cli' }), 'cli');
  assert.equal(detectHost({ DEVKIT_HOST: 'app' }), 'app');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: 'nonsense' }), 'app');
});

test('CLI: host in the JSON follows the environment', () => {
  const t = shipRepo();
  const host = (env) => JSON.parse(runCli(t, ['feat', '--json'], { env }).out).host;
  assert.equal(host({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: '' }), 'app');
  assert.equal(host({ DEVKIT_HOST: 'app' }), 'app');
  assert.equal(host({}), 'cli');
});

test('watchMinutes: default 9, capped at 30, positive numbers only', () => {
  assert.equal(watchMinutes(undefined), 9);
  assert.equal(watchMinutes(''), 9);
  assert.equal(watchMinutes('5'), 5);
  assert.equal(watchMinutes('0.5'), 0.5);
  assert.equal(watchMinutes('99'), 30);
  for (const bad of ['abc', '0', '-3', 'NaN', '1e999x']) assert.throws(() => watchMinutes(bad), /--watch/, bad);
});

// A shipped-ready change whose checks are still running.
function pendingChecks() {
  const t = shipRepo();
  driveToReady(t);
  const pending = [check('build', 'pass'), check('e2e', 'pending')];
  t.gh.set('pr-checks', { exit: 8, stdout: pending });
  t.gh.resetCount('pr-checks');
  return t;
}
const watchCalls = (t) => t.gh.calls().filter((c) => c.includes('--watch'));

test('CLI --watch: one gh pr checks --watch --interval 30 (required), then 8/8 when the checks turn green (AC-9)', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const r = runCli(t, ['feat', '--watch=1']);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^8\/8 met: ready$/m);
  assert.deepEqual(watchCalls(t), [['pr', 'checks', '12', '--watch', '--interval', '30', '--required']]);
});

test('CLI --watch: a watch that outlives its cap is killed and the result is in progress: item 6 (AC-9)', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, sleep: 20000 });
  const started = Date.now();
  const r = runCli(t, ['feat', '--watch=0.02']);
  assert.ok(Date.now() - started < 15000, 'the cap ended the watch');
  assert.equal(r.code, 1);
  assert.match(r.out, /^\d\/8 met: in progress: item 6$/m);
  assert.equal(watchCalls(t).length, 1, 'exactly one watch');
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.next.step, 'wait-checks');
});

test('CLI --watch: a bare --watch uses the default; --watch=abc is a usage error', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  runCli(t, ['feat', '--watch']);
  assert.equal(watchCalls(t).length, 1);
  const bad = runCli(t, ['feat', '--watch=abc']);
  assert.equal(bad.code, 3);
  assert.match(bad.err, /--watch/);
});

test('CLI --watch: no PR, or a step before waiting, never starts a watch', () => {
  const t = shipRepo();
  runCli(t, ['feat', '--watch=1']);
  assert.equal(watchCalls(t).length, 0);
  const u = pendingChecks();
  put(u.root, { 'src/a.ts': 'dirty\n' });
  runCli(u, ['feat', '--watch=1']);
  assert.equal(watchCalls(u).length, 0, 'a commit is due before waiting makes sense');
});

test('CLI without --watch never watches', () => {
  const t = pendingChecks();
  runCli(t, ['feat']);
  assert.equal(watchCalls(t).length, 0);
});

// ---- field item 9: --watch also waits at stop-merge-setup (merge-setup-field-fixes, D-1)

// A merge-mode change whose repository has no rule requiring devkit-reviews, with a check pending.
function setupPending() {
  const t = mergeReady();
  presetSetup(t.gh, { rules: [] });
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] });
  t.gh.resetCount('pr-checks');
  return t;
}

test('field-fixes 9 watch: at stop-merge-setup with a check pending, one gh pr checks --watch runs and the report shows the final checks (AC-1)', () => {
  const t = setupPending();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const r = runCli(t, ['feat', '--watch=1']);
  assert.equal(r.code, 2, r.out + r.err);
  assert.deepEqual(watchCalls(t), [['pr', 'checks', '12', '--watch', '--interval', '30', '--required']]);
  assert.match(r.out, /^ {2}6 met\s/m);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.match(r.out, /^8\/8 met: blocked: merge setup$/m);
  assert.match(r.out, /^watch: ended$/m);
  const u = setupPending();
  u.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  u.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  u.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const j = JSON.parse(runCli(u, ['feat', '--json', '--watch=1']).out);
  assert.equal(j.next.step, 'stop-merge-setup');
  assert.deepEqual(j.watch, { minutes: 1, timedOut: false });
});

test('field-fixes 9 watch: the cap stops the watch, item 6 still names the pending check and the step is stop-merge-setup (AC-1)', () => {
  const t = setupPending();
  t.gh.set('pr-checks-watch', { exit: 0, sleep: 20000 });
  const started = Date.now();
  const r = runCli(t, ['feat', '--watch=0.02']);
  assert.ok(Date.now() - started < 15000, 'the cap ended the watch');
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out, /^watch: stopped after 0\.02 minutes$/m);
  assert.match(r.out, /^ {2}6 \S+\s.*e2e/m);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.equal(watchCalls(t).length, 1, 'exactly one watch');
});

test('field-fixes 9 watch: no pending check, or no pull request, starts no watch (AC-1)', () => {
  const t = mergeReady();
  presetSetup(t.gh, { rules: [] });
  runCli(t, ['feat', '--watch=1']);
  assert.equal(watchCalls(t).length, 0, 'no check pending');
  const u = shipRepo({ ship: 'merge' });
  presetSetup(u.gh, { rules: [] });
  runCli(u, ['feat', '--watch=1']);
  assert.equal(watchCalls(u).length, 0, 'no pull request');
});

test('field-fixes 9 watch: without --watch no watch starts at stop-merge-setup (AC-1)', () => {
  const t = setupPending();
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.equal(watchCalls(t).length, 0);
});

test('field-fixes 9 watch: no watch target in the archive phase or for a MERGED or CLOSED pull request, even with a check pending (AC-1)', () => {
  const t = setupPending();
  const state = DC.collectState(t.root, 'feat', { env: t.env });
  const next = { step: 'stop-merge-setup' };
  assert.deepEqual(DC.checksToWatch(state, next), { number: 12, required: state.items[5].details.required }, 'the open pull request with a check pending is watched');
  assert.deepEqual(state.items[5].details.pending, ['e2e']);
  for (const prState of ['MERGED', 'CLOSED']) {
    assert.equal(DC.checksToWatch({ ...state, pr: { ...state.pr, state: prState } }, next), null, `${prState} pull request`);
  }
  assert.equal(DC.checksToWatch({ ...state, archive: { branch: 'chore/archive-feat' } }, next), null, 'archive phase');
});

// ---------------------------------------------------------------------------
// Format contracts: the agent and skill markdown that deliver-check parses
// (design D5, D8, D9). A rename here must fail a test, not a live run.
// ---------------------------------------------------------------------------

// The first fenced block under "## Output", as lines.
function outputBlock(md) {
  const start = md.indexOf('\n## Output');
  assert.ok(start >= 0, 'has an Output section');
  const m = md.slice(start).match(/```[^\n]*\n([\s\S]*?)\n```/);
  assert.ok(m, 'Output section has a fenced block');
  return m[1].split('\n');
}

const REVIEWERS = ['code-quality', 'test-coverage', 'security', 'architecture', 'adr', 'spec'].map((n) => `${n}-reviewer`);

for (const name of REVIEWERS) {
  test(`format: ${name} Output block has Verdict first and Commit: second`, () => {
    const lines = outputBlock(coreAgent(name));
    assert.match(lines[0], /^Verdict: /);
    assert.match(lines[1], /^Commit: <sha>/);
  });

  test(`format: ${name} documents the Commit line, its uncommitted marker, and dispositions`, () => {
    const md = coreAgent(name);
    const verdictFile = md.slice(md.indexOf('## Verdict file'), md.indexOf('\n## Output'));
    assert.match(verdictFile, /Commit: <sha>/);
    assert.match(verdictFile, /\(uncommitted changes\)/);
    assert.match(md, /· fixed in <sha>/);
    assert.match(md, /· refuted: /);
  });
}

test('format: security-reviewer declined output carries the Commit line', () => {
  const md = coreAgent('security-reviewer');
  const declined = md.split('\n').find((l) => /When declining/.test(l));
  assert.ok(declined, 'has the declining sentence');
  assert.match(declined, /Commit:/);
});

test('format: pr-verifier names the Commit line, the Gates table and the per-AC rows', () => {
  const md = coreAgent('pr-verifier');
  assert.match(md, /Commit: <sha>/);
  assert.match(md, /\(uncommitted changes\)/);
  assert.match(md, /### Gates/);
  assert.match(md, /split on `&&`/);
  assert.match(md, /no proof: <reason>/);
  assert.match(md, /\bpass\b[\s\S]*\bfail\b/);
});

test('format: pr-verifier puts the Commit line before the first heading of evidence.md, where parseCommitLine reads it', () => {
  const md = coreAgent('pr-verifier');
  assert.match(md, /before the first (markdown )?heading/i);
  assert.doesNotMatch(md, /Near the top/);
});

test('format: every reviewer agent puts Commit on the second line of its verdict file', () => {
  for (const name of ['adr-reviewer', 'architecture-reviewer', 'code-quality-reviewer', 'security-reviewer', 'spec-reviewer', 'test-coverage-reviewer']) {
    assert.match(coreAgent(name), /Its second line is `Commit: <sha>`/, name);
  }
});

test('format: commit-and-pr names commit-only, an open PR, and the PR body contents', () => {
  const md = coreAgent('commit-and-pr');
  assert.match(md, /commit-only/i);
  assert.match(md, /PR: none \(commit only\)/);
  assert.match(md, /already has an open PR/i);
  assert.match(md, /reviews are current at HEAD/);
  assert.match(md, /change id/);
  assert.match(md, /acceptance criterion id/i);
  assert.match(md, /evidence\.md/);
  assert.match(md, /Merge the PR, or enable auto-merge/, 'the Never list still forbids merging');
});

test('format: tdd-implementer reports the gate in Validation, not in evidence.md', () => {
  const md = coreAgent('tdd-implementer');
  const gate = md.slice(md.indexOf('## Stop at the phase gate'), md.indexOf('## Returns'));
  assert.doesNotMatch(gate, /evidence\.md/);
  assert.match(gate, /Validation section/);
  assert.match(gate, /coordinating skill/);
});

test('format: review-change defines stale by the Commit line, dispositions, scoped calls and rounds', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'), 'utf8');
  assert.match(md, /Commit:/);
  assert.match(md, /### Finding dispositions/);
  assert.match(md, /· fixed in <sha>/);
  assert.match(md, /· refuted: /);
  assert.match(md, /scoped call/i);
  assert.match(md, /starts at round 1/);
});

test('format: ship-change skill exists, says "Use when", and its deliver-check path resolves', () => {
  const dir = join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change');
  const skill = join(dir, 'SKILL.md');
  assert.ok(existsSync(skill), 'SKILL.md exists');
  const md = readFileSync(skill, 'utf8');
  assert.match(md, /^---\nname: ship-change\n/);
  assert.match(md, /description: [^\n]*Use when/);
  const rel = '../../hooks/deliver-check.mjs';
  assert.ok(md.includes(rel), 'names the relative path');
  assert.ok(existsSync(join(dir, rel)), 'the path resolves from the skill directory');
});

// AC-6 instructions-follow: every text that sequences the delivery steps says evidence first, then review (design D6)
const OLD_ORDER = [
  'review → evidence', 'review + evidence', 'reviews + evidence', 'pr-verifier ◀── review-change',
  '1. Run the review-change skill', 'then dispatch devkit-core:pr-verifier',
  '`review-change`, `pr-verifier`', 'for only the reviewers that went stale, `pr-verifier`',
  'reviews, verifies', 'scoped re-review, `verify`', '`review` and `verify` follow',
  'then dispatch `pr-verifier`', 'review with a bench of specialist reviewers, verify',
  '`review-change` with six specialist reviewers, `pr-verifier`',
  // the panel's old phrases (design D7)
  "'review', 'proofs'", 'Revisão, Provas', 'revisão, provas', 'review, proofs',
];
const textOf = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');
const before = (text, first, second, what) => {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  assert.ok(a >= 0, `${what}: has ${first}`);
  assert.ok(b >= 0, `${what}: has ${second}`);
  assert.ok(a < b, `${what}: ${first} comes before ${second}`);
};

test('AC-6 instructions-follow: the schema copies are identical and dispatch pr-verifier before review-change', () => {
  for (const s of ['devkit', 'devkit-lite']) {
    const plugin = textOf('plugins', 'openspec', 'schemas', s, 'schema.yaml');
    assert.equal(textOf('openspec', 'schemas', s, 'schema.yaml'), plugin, `${s} copies are byte-identical`);
    const apply = plugin.slice(plugin.indexOf('\napply:'));
    before(apply, 'pr-verifier', 'review-change', `${s} apply`);
    assert.match(plugin, /^description: .*evidence \+ review before the PR/m, `${s} description`);
  }
});

test('AC-6 instructions-follow: configs, ship-change, devkit, flow doc and READMEs name evidence before review', () => {
  for (const f of [['plugins', 'openspec', 'skills', 'devkit', 'templates', 'config.yaml'], ['openspec', 'config.yaml']]) {
    const t = textOf(...f);
    const line = t.split('\n').find((l) => l.includes('devkit-core:pr-verifier') && l.includes('review-change'));
    assert.ok(line, `${f.join('/')} guidance line`);
    before(line, 'devkit-core:pr-verifier', 'review-change', f.join('/'));
    assert.match(t, /apply →\s*(?:#\s*)?evidence \+ reviews/, `${f.join('/')} header`);
  }
  const ship = textOf('plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md');
  const mode = ship.split('\n').find((l) => l.includes('`tdd-implementer`') && l.includes('`review-change`'));
  assert.ok(mode, 'ship-change Mode paragraph');
  before(mode, '`pr-verifier`', '`review-change`', 'ship-change Mode');
  assert.match(ship, /verifies, reviews, opens the PR/);
  const devkit = textOf('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const loop = devkit.slice(devkit.indexOf('## Loop'), devkit.indexOf('## Owner gates'));
  before(loop, '`verify`', '`review`', 'devkit Loop');
  const flow = textOf('docs', 'openspec-flow.md');
  const applyLine = flow.split('\n').find((l) => l.startsWith('`apply` requires `approval`'));
  assert.ok(applyLine, 'flow doc apply paragraph');
  before(applyLine, '`pr-verifier`', '`review-change`', 'flow doc apply');
  assert.match(flow, /\*\*Order of the delivery steps\.\*\*/);
  for (const f of [['plugins', 'core', 'README.md'], ['README.md']]) {
    assert.ok(textOf(...f).includes('review-change ◀── pr-verifier'), `${f.join('/')} diagram`);
  }
});

test('AC-6 instructions-follow: no tracked file outside the records still says review before evidence', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => !f.startsWith('openspec/changes/') && f !== 'CHANGELOG.md' && !f.startsWith('plugins/panel/hooks/fixtures/')
      && f !== 'plugins/openspec/hooks/deliver-check-cli.test.mjs' && existsSync(join(repoRoot, f)));
  const hits = [];
  for (const f of files) {
    let t;
    try { t = readFileSync(join(repoRoot, f), 'utf8'); } catch { continue; }
    for (const p of OLD_ORDER) if (t.includes(p)) hits.push(`${f}: ${p}`);
  }
  assert.deepEqual(hits, []);
});

test('own-files AC-9 docs: the flow doc states the rule, the fail-safe cases and the check backstop', () => {
  const flow = textOf('docs', 'openspec-flow.md');
  const at = flow.indexOf('**The own-files rule.**');
  assert.ok(at >= 0, 'the flow doc has the own-files paragraph');
  const para = flow.slice(at, flow.indexOf('\n\n', at));
  for (const [what, pattern] of [
    ['the own files are the net diff against the base', /own files/],
    ['a release file is never own', /release files/],
    ['the merge and the base commits it brings are exempt', /base commits/],
    ['the base is named', /`origin\/<base>`/],
    ['a rejected review keeps the strict rule', /rejected review/],
    ['no origin ref fails safe', /no `origin\/<base>`/],
    ['an unfetched base fails safe', /not fetched|unfetched/],
    ['a merge of another branch fails safe', /another branch/],
    ['a head inside the base fails safe', /head (is )?(already )?(in|inside) the base/],
    ['the check is the backstop', /backstop/],
    ['the check runs on the merged ref', /`check`/],
    ['the decision is cited', /ADR 0025/],
  ]) assert.match(para, pattern, what);
  const everyMerge = /every merge of the base that touches a file outside `openspec\/` makes its evidence and all its reviews stale/;
  for (const file of [['docs', 'openspec-flow.md'], ['CONTRIBUTING.md'], ['plugins', 'core', 'skills', 'review-change', 'SKILL.md']]) {
    assert.doesNotMatch(textOf(...file), everyMerge, file.join('/'));
  }
  assert.match(textOf('docs', 'openspec-flow.md'), /every merge of the base that brings one of its own files/, 'the release paragraph');
  assert.match(textOf('CONTRIBUTING.md'), /own files/, 'CONTRIBUTING names the own files');
  assert.match(textOf('plugins', 'core', 'skills', 'review-change', 'SKILL.md'), /brings none of the change's own files/, 'the review skill');
  const ci = textOf('docs', 'openspec-flow.md');
  assert.match(ci.slice(ci.indexOf('\n## CI')), /`GITHUB_BASE_REF`[^\n]*own files|own files[^\n]*`GITHUB_BASE_REF`/, 'the CI section');
});

test('format: ship-change names every next.step the checker can return', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const steps = ['stop-plan-mode', 'stop-branch', 'stop-not-approved', 'stop-plan-approval', 'implement', 'gate', 'commit', 'stop-review-deadlock', 'fix-review', 'review', 'fix-defect', 'verify', 'blocked', 'open-pr', 'push', 'edit-pr-body', 'fix-checks', 'answer', 'wait-checks', 'ready',
    'stop-merge-setup', 'disable-auto-merge', 'update-branch', 'enable-auto-merge', 'wait-merge',
    'retro', 'stop-retro-answers', 'archive', 'tick-roadmap', 'apply-proposals', 'open-archive-pr', 'archive-pr-ready', 'stop-archive', 'archived', 'tag-release'];
  for (const s of steps) assert.ok(md.includes(`\`${s}\``), `names step ${s}`);
  assert.ok(!steps.includes('merged') && !/^\|[^|]*`merged`[^|]*\|/m.test(md), 'no `merged` row: it is a state now, not an end (D7)');
  // whatever nextStep can emit has a row in the table, so a new step cannot ship without the skill
  const src = readFileSync(join(repoRoot, 'plugins', 'openspec', 'hooks', 'deliver-check.mjs'), 'utf8');
  const emitted = [...new Set([...src.matchAll(/\bstep\('([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(emitted.length >= steps.length - 1, 'found the steps in nextStep');
  for (const s of emitted) assert.match(md, new RegExp(`^\\|[^|]*\`${s}\`[^|]*\\|`, 'm'), `a table row for ${s}`);
});

// Invariant: the texts that tell the conducting session what to do say what the checker does: the loop hands
// `commit` before a review round while the change folder is uncommitted. Owner: the ship-change skill and the
// flow doc (text pins). Suite: deliver-check.test.mjs.
test('loop-evidence 16: the ship-change review row leaves the commit to the loop and the commit row allows empty paths', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const row = (step) => md.split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';
  const review = row('review');
  assert.ok(review.length > 0, 'the review row exists');
  assert.ok(!review.includes('Commit every modified or untracked file under the change folder first'), 'the review row no longer commits by prose');
  assert.ok(review.includes('The loop hands the `commit` step first while anything under the change folder is uncommitted'), 'the review row names the loop\'s commit step');
  const commit = row('commit');
  assert.ok(commit.includes('`next.paths` may be empty: before a review round the loop hands `commit` with no paths while only the change folder is uncommitted'), 'the commit row allows empty paths');
  assert.ok(commit.includes('are still staged from `git status`'), 'the commit row still stages the folder from git status');
});

test('loop-evidence 17: the flow doc\'s order of the delivery steps names the commit before the review round', () => {
  const doc = readFileSync(join(repoRoot, 'docs', 'openspec-flow.md'), 'utf8');
  const para = doc.split('\n').find((l) => l.startsWith('**Order of the delivery steps.**')) ?? '';
  assert.ok(para.length > 0, 'the paragraph exists');
  assert.ok(para.includes('`commit` (a reviewer missing or stale while a path under `openspec/changes/<id>/` is uncommitted'), 'the order names the commit step');
  assert.ok(para.includes('A review round never starts on an uncommitted change folder'), 'the order states the rule');
});

test('format: ship-change enables auto-merge with one exact command, only at enable-auto-merge, and disables it at disable-auto-merge (AC-2, AC-3, AC-8)', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  assert.ok(md.includes('gh pr merge <next.number> --auto --<next.method> --match-head-commit <next.head>'), 'the enable command, verbatim');
  const row = (step) => md.split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';
  assert.match(row('disable-auto-merge'), /gh pr merge <next\.number> --disable-auto/);
  assert.match(row('enable-auto-merge'), /--match-head-commit <next\.head>/);
  assert.match(row('update-branch'), /gh pr update-branch <next\.number>/);
  assert.match(row('stop-merge-setup'), /blocked: merge setup/);
  assert.match(row('wait-merge'), /--watch/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /`gh pr merge` except at `enable-auto-merge` \(`--auto`\) and `disable-auto-merge` \(`--disable-auto`\)/);
  assert.match(never, /--admin/);
  assert.match(md, /`merge`/);
  assert.doesNotMatch(md, /`merge` is not available yet/);
  for (const report of ['archived', 'archive PR open: waiting for', 'archive PR ready', 'archive: waiting for the owner', 'blocked: archive (', 'auto-merge on: waiting for', 'blocked: merge setup']) assert.ok(md.includes(report), `Report names ${report}`);
});

// ---------------------------------------------------------------- --ci: the devkit-reviews check (auto-merge D5)

test('--ci: passes at the head when items 1 to 4 are met, with the D5 human output (AC-5)', () => {
  const root = ciRepo();
  const r = runCi(root);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], /^devkit-reviews: feat \(schema devkit-lite, head [0-9a-f]{7}\)$/);
  assert.equal(lines.filter((l) => /^ {2}[1-4] met\s+\S/.test(l)).length, 4, r.out);
  assert.equal(lines.at(-1), 'pass');
  assert.doesNotMatch(r.out, /readiness/, 'devkit-lite has no readiness artifact');
});

test('--ci --json: version 1, mode ci, change, schema, head, readiness, items 1 to 4 and pass (design D5)', () => {
  const root = ciRepo();
  const j = runCi(root, ['--json']).json();
  assert.deepEqual(Object.keys(j).sort(), ['change', 'head', 'items', 'mode', 'pass', 'readiness', 'schema', 'version']);
  assert.deepEqual([j.version, j.mode, j.change, j.schema, j.pass], [1, 'ci', 'feat', 'devkit-lite', true]);
  assert.equal(j.head, head(root));
  assert.deepEqual(j.items.map((i) => [i.id, i.status]), [[1, 'met'], [2, 'met'], [3, 'met'], [4, 'met']]);
  assert.deepEqual(j.readiness, { status: null, met: true });
});

test('--ci: a product commit after the reviews makes them stale and fails with exit 1 (AC-5)', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  const r = runCi(root);
  assert.equal(r.code, 1);
  assert.match(r.out, /^ {2}2 open\s+reviews at head: .*stale code-quality-reviewer/m);
  assert.match(r.out, /^fail: item 1, item 2, item 4$/m, 'evidence is stale too');
  assert.equal(runCi(root, ['--json']).json().pass, false);
});

test('AC-5 guards-kept: --ci with only the reviews re-recorded at a later product commit fails with items 1 and 4', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  put(root, withReviews(reviews(head(root))));
  commitAll(root, 'reviews only');
  const r = runCi(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^fail: item 1, item 4$/m);
});

test('AC-5 guards-kept: --ci with only the evidence re-recorded at a later product commit fails with item 2', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  const sha = head(root);
  ev(root, `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}`);
  commitAll(root, 'evidence only');
  const r = runCi(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^fail: item 2$/m);
});

test('own-files AC-8 ci: the check passes after an unrelated merge and fails naming the merge after an own-file merge, from both entries', () => {
  const run = (root) => {
    const event = join(tmpFolder('devkit-event-'), 'event.json');
    writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: head(root) } } }));
    const env = { ...process.env, ...CI_ENV, GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'feat', GITHUB_EVENT_PATH: event };
    const a = spawnSync(process.execPath, [cli, '--ci'], { cwd: root, encoding: 'utf8', env });
    const b = spawnSync(process.execPath, [GUARD_FILE, 'ci'], { cwd: root, encoding: 'utf8', env, input: '{}' });
    return { deliver: a, guard: b };
  };
  const ok = run(ownFilesRepo().root);
  for (const [entry, r] of Object.entries(ok)) assert.equal(r.status, 0, `${entry}: ${r.stdout}${r.stderr}`);
  const bad = ownFilesRepo({ onMain: ownBrings({ 'src/a.ts': ownLines('line 1', 'main 12') }) });
  const failed = run(bad.root);
  for (const [entry, r] of Object.entries(failed)) {
    assert.equal(r.status, 1, `${entry}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, new RegExp(`${s7(bad.R)} is behind ${s7(bad.merged)}, which touches src/a\\.ts`), entry);
  }
});

test('--ci: fails for each of an undisposed blocking finding, an AC without a pass row, a no proof AC and a gate without a passing row (AC-5)', () => {
  const cases = [
    ['finding', (root) => { put(root, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': `${review('approved', head(root))}- [blocking] src/a.ts:1 broken\n` }); commitAll(root, 'finding'); }, /^ {2}3 open\s+findings disposed: undisposed/m, 'item 3'],
    ['missing AC row', (root) => ciProve(root, 'feat', { acs: [] }), /^ {2}4 open\s+acceptance criteria proven: no proof row for AC-1/m, 'item 4'],
    ['no proof', (root) => ciProve(root, 'feat', { ac: (id) => acRow(id, 'no proof: later') }), /^ {2}4 blocked\s+acceptance criteria proven: no proof for AC-1/m, 'item 4'],
    ['gate row', (root) => ciProve(root, 'feat', { rows: gateRow('node -e 0', 'fail: red') }), /^ {2}1 open\s+tasks and gates: .*no passing row in evidence\.md for `node -e 0`/m, 'item 1'],
  ];
  for (const [label, arrange, pattern, failed] of cases) {
    const root = ciRepo();
    arrange(root);
    const r = runCi(root);
    assert.equal(r.code, 1, `${label}: ${r.out}${r.err}`);
    assert.match(r.out, pattern, label);
    assert.match(r.out, new RegExp(`^fail: ${failed}$`, 'm'), label);
  }
});

test('--ci: a devkit change whose readiness is not APPROVED fails; APPROVED passes (AC-5)', () => {
  const devkitFiles = { '.openspec.yaml': 'schema: devkit\n', 'proposal.md': proposalWith(['AC-1']), 'tasks.md': CI_TASKS };
  const make = (readiness) => {
    const root = gitRepo({
      config: 'schema: devkit\n',
      changes: { feat: { ...devkitFiles, ...(readiness ? { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` } : {}) } },
      files: { 'src/a.ts': 'a\n', 'openspec/schemas/devkit/schema.yaml': 'name: devkit\nversion: 1\nartifacts:\n  - id: readiness\n    generates: readiness.md\n' },
    });
    git(root, 'switch', '-q', '-c', 'ship/feat');
    ciProve(root);
    return root;
  };
  for (const readiness of ['NEEDS-REVISION', null]) {
    const r = runCi(make(readiness));
    assert.equal(r.code, 1, String(readiness));
    assert.match(r.out, new RegExp(`^ {2}readiness open\\s+Status: ${readiness || 'missing'}`, 'm'));
    assert.match(r.out, /^fail: readiness$/m);
  }
  const ok = runCi(make('APPROVED'), ['--json']);
  assert.equal(ok.code, 0);
  assert.deepEqual(ok.json().readiness, { status: 'APPROVED', met: true });
});

test('--ci: ship and merge_method are not read, so a typo there does not fail the check (design D2, D5)', () => {
  const root = ciRepo({ config: 'schema: devkit-lite\nship: { devkit-lite: auto }\nmerge_method: fast\n' });
  const r = runCi(root);
  assert.equal(r.code, 0, r.out + r.err);
});

test('--ci: DEVKIT_BYPASS=1 changes nothing', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later');
  assert.equal(runCi(root, [], { DEVKIT_BYPASS: '1' }).code, 1);
  assert.equal(runCi(root, ['--json'], { DEVKIT_BYPASS: '1' }).out, runCi(root, ['--json']).out);
});

test('--ci --watch is a usage error (exit 3)', () => {
  const r = runCi(ciRepo(), ['--watch']);
  assert.equal(r.code, 3);
  assert.match(r.err, /--ci cannot be combined with --watch/);
  assert.equal(runCi(ciRepo(), ['--watch=5', '--json']).code, 3);
});

test('--ci: a repo without openspec/ passes with a note, like guard.mjs ci; a repo that has not adopted OpenSpec is never broken (R-3)', () => {
  const dir = tmpFolder('devkit-noopenspec-');
  git(dir, 'init', '-q', '-b', 'main');
  const r = runCi(dir);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /devkit-reviews: no openspec\/ folder; nothing to check/);
  const j = runCi(dir, ['--json']).json();
  assert.deepEqual([j.version, j.mode, j.change, j.pass], [1, 'ci', null, true]);
  assert.match(j.note, /no openspec\/ folder/);
  // The non-CI mode keeps its exit 3 in the same repo.
  assert.equal(spawnSync(process.execPath, [cli, 'feat'], { cwd: dir, encoding: 'utf8' }).status, 3);
});

test('--ci: openspec/ without a git repository is exit 3', () => {
  const dir = tmpFolder('devkit-nogit-ci-');
  mkdirSync(join(dir, 'openspec/changes/feat'), { recursive: true });
  const r = spawnSync(process.execPath, [cli, '--ci'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...CI_ENV, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not a git repository/i);
});

// ---- change selection (design D5, 1.2)

test('--ci selection 1: <change-id> and DEVKIT_CHANGE select; an unknown or archived change is exit 3', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  assert.equal(runCi(root, ['other', '--json']).json().change, 'other');
  assert.equal(runCi(root, ['--json'], { DEVKIT_CHANGE: 'feat' }).json().change, 'feat');
  assert.equal(runCi(root, ['nope']).code, 3);
  assert.match(runCi(root, ['nope']).err, /unknown change "nope"/);
  assert.equal(runCi(root, [], { DEVKIT_CHANGE: 'nope' }).code, 3);
  mkdirSync(join(root, 'openspec/changes/archive/2026-01-01-gone'), { recursive: true });
  assert.equal(runCi(root, ['gone']).code, 3);
  assert.equal(runCi(root, ['archive']).code, 3);
  assert.equal(runCi(root, ['..']).code, 3);
});

test('--ci selection 2: the branch tail, or the single change the branch contains, selects; several contained fail', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  const on = (b, env = {}) => runCi(root, ['--json'], { DEVKIT_BRANCH: b, ...env });
  assert.equal(on('ship/other').json().change, 'other');
  assert.equal(on('user-feat-work').json().change, 'feat');
  assert.equal(on('', { GITHUB_HEAD_REF: 'ci/feat' }).json().change, 'feat', 'GITHUB_HEAD_REF');
  const several = on('feat-and-other');
  assert.equal(several.code, 1);
  assert.match(several.err, /several changes match branch feat-and-other; name the branch after one/);
  assert.equal(several.json().pass, false);
});

// Invariant (field-fixes 3, ADR 0012): the one touched change is selected; two touched changes are each judged when delivered.
test('--ci selection 3: with GITHUB_BASE_REF the one active change the PR diff touches is selected, two are each judged (R-3)', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/tidy');
  put(root, { 'openspec/changes/other/notes.md': 'n\n' });
  commitAll(root, 'touch other');
  const env = { GITHUB_BASE_REF: 'main' };
  const one = runCi(root, ['--json'], env);
  assert.equal(one.json().change, 'other');
  put(root, { 'openspec/changes/feat/notes.md': 'n\n', 'openspec/changes/archive/2026-01-01-old/x.md': 'x\n' });
  commitAll(root, 'touch feat');
  const two = runCi(root, [], env);
  assert.equal(two.code, 0, two.out + two.err);
  assert.match(two.out, /^devkit-reviews: 2 changes touched by this PR \(feat, other\)$/m);
});

test('--ci selection 3: a squash-merged change still active on the base and untouched by the PR is not checked; the run passes with a note (AC-5, R-3)', () => {
  // `merged` has reviews recorded at a commit that is not an ancestor of HEAD, as after a squash merge.
  const root = ciRepo({ branch: 'main', names: ['merged'], prove: false });
  put(root, { 'openspec/changes/merged/reviews/code-quality-reviewer.md': review('approved', 'a'.repeat(40)) });
  commitAll(root, 'merged change stays active');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/docs');
  put(root, { 'README.md': 'docs\n' });
  commitAll(root, 'docs only');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /devkit-reviews: no change selected by branch chore\/docs or touched by this PR; nothing to check/);
  const j = runCi(root, ['--json'], { GITHUB_BASE_REF: 'main' }).json();
  assert.deepEqual([j.change, j.pass], [null, true]);
  assert.match(j.note, /nothing to check/);
  // The same repo run locally (no GITHUB_BASE_REF) falls back to the only open change and fails on it.
  assert.equal(runCi(root).code, 1);
});

test('--ci on an archive branch: the PR that moves a squash-merged change passes when every file is named and every proposal answered, even beside an open change `merge` (archive-after-merge D2, AC-9)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  for (const [branch, others] of [['chore/archive-x', []], ['chore/archive-x', ['merge']], ['archive-x', []]]) {
    const root = archivePrRepo({ branch, others });
    const r = runCi(root, [], env);
    assert.equal(r.code, 0, `${branch} + ${others}: ${r.out}${r.err}`);
    assert.match(r.out, /archive.*2026-11-09-x/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
    const j = runCi(root, ['--json'], env).json();
    assert.deepEqual([j.change, j.pass, j.archive.unnamed, j.archive.unanswered], [null, true, [], []]);
  }
});

test('--ci on an archive branch: a changed file no approved proposal names fails the check, naming it (review blocker 3)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  for (const [label, opts, unnamed] of [
    ['an extra product file', { files: { 'src/other.ts': 'o\n' } }, ['src/other.ts']],
    ['openspec/config.yaml', { files: { 'openspec/config.yaml': 'schema: x\n' } }, ['openspec/config.yaml']],
    ['a file only a rejected proposal names', { retro: '## Proposed updates\n\n### `src/a.ts` (process-friction)\n- Answer: rejected: no\n' }, ['src/a.ts']],
    ['a file under a directory a proposal names', { retro: X_RETRO.replace('`src/a.ts`', '`src/`'), files: { 'src/b.ts': 'b\n' } }, ['src/a.ts', 'src/b.ts']],
  ]) {
    const root = archivePrRepo(opts);
    const r = runCi(root, [], env);
    assert.equal(r.code, 1, `${label}: ${r.out}${r.err}`);
    for (const p of unnamed) assert.ok(r.out.includes(p), `${label}: names ${p}`);
    assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: files no approved proposal names/, label);
    const j = runCi(root, ['--json'], env).json();
    assert.deepEqual([j.pass, j.archive.unnamed], [false, unnamed], label);
  }
});

test('--ci on an archive branch: an unanswered proposal, a retro without the section and a missing retro fail the check (review blocker 3)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  const unanswered = archivePrRepo({ retro: X_RETRO.replace('- Answer: approved\n', '') });
  const u = runCi(unanswered, [], env);
  assert.equal(u.code, 1, u.out + u.err);
  assert.match(u.out, /unanswered proposals: 1/);
  assert.deepEqual(runCi(unanswered, ['--json'], env).json().archive.unanswered, [1]);
  for (const retro of ['# Retro\n', null]) {
    const r = runCi(archivePrRepo({ retro }), [], env);
    assert.equal(r.code, 1, `${retro}: ${r.out}${r.err}`);
    assert.match(r.out, /retro\.md.*(missing|no "## Proposed updates")/);
  }
});

test('--ci: a PR that archives nothing, or a run without GITHUB_BASE_REF, keeps the "nothing to check" note (review blocker 3)', () => {
  const root = gitRepo({ branch: 'main', changes: { x: changeFilesOf() }, files: { 'src/a.ts': 'a\n' } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/docs');
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'docs');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /nothing to check/);
  const local = archivePrRepo({ files: { 'src/other.ts': 'o\n' } });
  assert.match(runCi(local).out, /nothing to check/, 'no base to compare with');
});

test('--ci on an archive branch never takes a contained open change, and a PR touching an active change\'s folder still selects it', () => {
  // `auto-merge` archived on chore/archive-auto-merge while `merge` is open: the contained-name rule must not pick `merge`.
  const root = gitRepo({ branch: 'main', changes: { 'auto-merge': changeFilesOf(), merge: changeFilesOf() } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/archive-auto-merge');
  git(root, 'mv', 'openspec/changes/auto-merge', 'openspec/changes/archive/2026-11-09-auto-merge');
  put(root, { 'openspec/changes/archive/2026-11-09-auto-merge/retro.md': '## Proposed updates\n\nNone.\n' });
  commitAll(root, 'archive');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  // Touching an active change's folder still selects it, archive branch or not.
  put(root, { 'openspec/changes/merge/notes.md': 'n\n' });
  commitAll(root, 'touch merge');
  assert.equal(runCi(root, ['--json'], { GITHUB_BASE_REF: 'main' }).json().change, 'merge');
});

test('--ci selection 3: GITHUB_BASE_REF without an origin/<base> ref is exit 3 naming the ref', () => {
  const root = ciRepo({ branch: 'main', names: ['feat'] });
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 3);
  assert.match(r.err, /origin\/main/);
});

test('--ci selection 4: without GITHUB_BASE_REF the only open change is checked; several are ambiguous (exit 1)', () => {
  const one = ciRepo({ branch: 'main', names: ['feat'] });
  assert.equal(runCi(one, ['--json']).json().change, 'feat');
  const two = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  const r = runCi(two);
  assert.equal(r.code, 1);
  assert.match(r.err, /several open changes \(feat, other\); name the branch after one/);
  const n = runCi(gitRepo({ branch: 'main' }));
  assert.equal(n.code, 0);
  assert.match(n.out, /nothing to check/);
});

// ---- field-fixes 3: the devkit-reviews check follows the change's script (spec reviews-check, ADR 0012)
const PLAN_TASKS = '## 1. First\n- [ ] 1.1 code\n- [ ] 1.2 Gate: `node -e 0` green\n';
// A repo whose `spec` changes sit on `main`, a PR branch that touches each of them, and (for `prove`) proves them at head.
// spec: { name: { schema = 'devkit-lite', tasks = CI_TASKS } }
function severalRepo(spec, { prove = [], branch = 'chore/tidy' } = {}) {
  const changes = Object.fromEntries(Object.entries(spec).map(([n, o]) => [n, { ...changeFilesOf(), '.openspec.yaml': `schema: ${o.schema ?? 'devkit-lite'}\n`, 'tasks.md': o.tasks ?? CI_TASKS }]));
  const root = gitRepo({ branch: 'main', changes, files: { 'src/a.ts': 'a\n' } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', branch);
  put(root, Object.fromEntries(Object.keys(spec).map((n) => [`openspec/changes/${n}/notes.md`, 'n\n'])));
  commitAll(root, 'touch every change');
  for (const n of prove) ciProve(root, n);
  return root;
}
const BASE = { GITHUB_BASE_REF: 'main' };

test('field-fixes 3 reviews-check: a change on another schema passes with a note from both entries, whatever it lacks', () => {
  const root = severalRepo({ legacy: { schema: 'spec-driven' } }, { branch: 'ship/legacy' });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(r.out.trimEnd().split('\n'), ['devkit-reviews: legacy is on the spec-driven script, not a devkit script (devkit, devkit-lite); nothing was checked', 'pass']);
  }
  for (const r of bothEntries(root, ['--json'], BASE)) {
    const j = r.json();
    assert.deepEqual([j.version, j.mode, j.change, j.schema, j.pass], [1, 'ci', 'legacy', 'spec-driven', true]);
    assert.match(j.note, /legacy is on the spec-driven script, not a devkit script \(devkit, devkit-lite\); nothing was checked/);
  }
});

test('field-fixes 3 reviews-check: a devkit-lite change with a missing review still fails naming it', () => {
  const root = severalRepo({ feat: {} }, { branch: 'ship/feat' });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: .*item 2/);
});

test('field-fixes 3 reviews-check: two delivered changes both passing print one result each and pass', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a', 'b'] });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.equal(lines[0], 'devkit-reviews: 2 changes touched by this PR (a, b)');
  assert.ok(lines.some((l) => /^devkit-reviews: a \(schema devkit-lite, head [0-9a-f]{7}\)$/.test(l)), r.out);
  assert.ok(lines.some((l) => /^devkit-reviews: b \(schema devkit-lite, head [0-9a-f]{7}\)$/.test(l)), r.out);
  assert.equal(lines.at(-1), 'pass');
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.version, j.mode, j.change, j.pass, j.changes.map((c) => c.change), j.notes], [1, 'ci', null, true, ['a', 'b'], []]);
});

test('field-fixes 3 reviews-check: one of two delivered changes failing prints both results, names what it lacks and fails', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a'] });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /devkit-reviews: a \(schema/);
  assert.match(r.out, /devkit-reviews: b \(schema/);
  const last = r.out.trimEnd().split('\n').at(-1);
  assert.match(last, /^fail: b: item /);
  assert.doesNotMatch(last, /\ba:/);
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.pass, j.changes.map((c) => [c.change, c.pass])], [false, [['a', true], ['b', false]]]);
});

test('field-fixes 3 reviews-check: a plan and a change on another schema ride along as notes and fail nothing', () => {
  const root = severalRepo({ a: {}, next: { schema: 'devkit', tasks: PLAN_TASKS }, legacy: { schema: 'spec-driven' } }, { prove: ['a'] });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /devkit-reviews: a \(schema/);
    assert.doesNotMatch(r.out, /devkit-reviews: (next|legacy) \(schema/);
    assert.match(r.out, /^ {2}note: next holds only a plan \(no ticked task in tasks\.md\); not checked$/m);
    assert.match(r.out, /^ {2}note: legacy is on the spec-driven script, not a devkit script; nothing was checked$/m);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual(j.changes.map((c) => c.change), ['a']);
  assert.deepEqual(j.notes, [{ change: 'legacy', why: 'other-script', schema: 'spec-driven' }, { change: 'next', why: 'plan-only', schema: 'devkit' }]);
});

test('field-fixes 3 reviews-check: the branch named after one change still selects it, and the other touched change is not judged', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a'], branch: 'ship/a' });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^devkit-reviews: a \(schema devkit-lite/);
  assert.doesNotMatch(r.out, /touched by this PR/);
});

test('field-fixes 3 reviews-check: one plan-only change is judged as before and fails on its unticked tasks', () => {
  const root = severalRepo({ next: { schema: 'devkit-lite', tasks: PLAN_TASKS } });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /^devkit-reviews: next \(schema devkit-lite/);
  assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: .*item 1/);
});

test('field-fixes 3 reviews-check: several plan-only changes fail saying the pull request delivers no change, naming both', () => {
  const root = severalRepo({ next: { schema: 'devkit', tasks: PLAN_TASKS }, later: { schema: 'devkit-lite', tasks: PLAN_TASKS } });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: this PR delivers no change: later, next hold only a plan \(no ticked task in tasks\.md\)$/);
  }
  assert.equal(runCi(root, ['--json'], BASE).json().pass, false);
});

test('field-fixes 3 reviews-check: a pull request touching only changes on other schemas passes with one note each', () => {
  const root = severalRepo({ legacy: { schema: 'spec-driven' }, old: { schema: 'spec-driven' } });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /note: legacy is on the spec-driven script/);
    assert.match(r.out, /note: old is on the spec-driven script/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.pass, j.changes, j.notes.map((n) => n.change)], [true, [], ['legacy', 'old']]);
});

test('field-fixes 3 reviews-check: the archive of a change on another schema passes with a note from both entries, with no retro', () => {
  const root = archivePrRepo({ retro: null, schema: 'spec-driven' });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /x is on the spec-driven script, not a devkit script; nothing was checked/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
});

test('field-fixes 3 reviews-check: the archive of a devkit change with an unanswered proposal still fails naming it', () => {
  const root = archivePrRepo({ retro: X_RETRO.replace('- Answer: approved\n', '') });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /unanswered proposals: 1/);
  }
});

test('field-fixes 3 reviews-check: a missing retro and a retro without the section each say what the file holds and which step writes it', () => {
  const folder = 'openspec/changes/archive/2026-11-09-x';
  const missing = runCi(archivePrRepo({ retro: null }), [], BASE);
  assert.equal(missing.code, 1, missing.out + missing.err);
  assert.ok(missing.out.includes(`${folder}/retro.md is missing: it holds the change's retro, with a "## Proposed updates" section listing each proposal and the owner's answer to it; the retro step of the archive writes it (/devkit change, or ship-change for a change begun under the previous script, after the change's pull request merges)`), missing.out);
  const bare = runCi(archivePrRepo({ retro: '# Retro\n' }), [], BASE);
  assert.equal(bare.code, 1, bare.out + bare.err);
  assert.ok(bare.out.includes(`${folder}/retro.md has no "## Proposed updates" section: it must list each proposal with the owner's answer; the retro step of the archive writes it`), bare.out);
});

// ---- checkout preflight (design D5)

test('--ci preflight: a shallow clone is exit 3 naming fetch-depth: 0', () => {
  const root = ciRepo();
  put(root, { 'src/b.ts': 'b\n' });
  commitAll(root, 'second');
  const clone = join(tmpFolder('devkit-shallow-'), 'c');
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, clone], { env: GIT_ENV });
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true');
  const r = runCi(clone);
  assert.equal(r.code, 3);
  assert.match(r.err, /fetch the full history \(actions\/checkout with fetch-depth: 0\)/);
  assert.match(runCi(clone, ['--json']).json().error, /fetch-depth: 0/);
});

test('--ci preflight: a PR head sha that is not HEAD is exit 3 naming the ref: fix; the matching sha passes', () => {
  const root = ciRepo();
  const event = join(tmpFolder('devkit-event-'), 'event.json');
  writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: 'b'.repeat(40) } } }));
  const r = runCi(root, [], { GITHUB_EVENT_PATH: event });
  assert.equal(r.code, 3);
  assert.match(r.err, /check out the PR head \(actions\/checkout with ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\), not the merge commit/);
  writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: head(root) } } }));
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0);
  writeFileSync(event, JSON.stringify({ push: true }));
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0, 'an event without a pull_request is not checked');
  writeFileSync(event, 'not json');
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0, 'an unreadable event is not checked');
});

// Docs sweep (AC-9): ship mode no longer means "the owner always merges".
function sweepFiles() {
  const repo = join(here, '..', '..', '..');
  const out = [];
  const add = (p) => { if (existsSync(p)) out.push(p); };
  add(join(repo, 'README.md'));
  for (const f of readdirSync(join(repo, 'docs'))) if (f.endsWith('.md')) add(join(repo, 'docs', f));
  add(join(repo, 'plugins', 'openspec', 'README.md'));
  add(join(repo, 'plugins', 'core', 'README.md'));
  add(join(repo, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'));
  const skills = join(repo, 'plugins', 'openspec', 'skills');
  for (const d of readdirSync(skills)) add(join(skills, d, 'SKILL.md'));
  return out;
}

test('docs sweep: "never merges" and "the merge is the owner\'s" lines name a ship mode or are about commit-and-pr', () => {
  const claim = /never merges|merge is (always )?(the owner's|the human's|yours)/i;
  const names = /`(plan|pr|merge)`[^.\n]*\bmode\b|\bship mode\b|commit-and-pr/i;
  const bad = [];
  for (const file of sweepFiles()) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (claim.test(line) && !names.test(line)) bad.push(`${file}:${i + 1}: ${line.slice(0, 120)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('ADR 0002 exists, is cited by README and docs/openspec-flow.md, and says Status: accepted', () => {
  const repo = join(here, '..', '..', '..');
  const adr = join(repo, 'docs', 'adr', '0002-merge-without-the-owner-opt-in.md');
  assert.ok(existsSync(adr), 'ADR 0002 file');
  assert.match(readFileSync(adr, 'utf8'), /^- Status: accepted$/m);
  for (const f of ['README.md', join('docs', 'openspec-flow.md')]) {
    assert.match(readFileSync(join(repo, f), 'utf8'), /adr\/0002-merge-without-the-owner-opt-in\.md/, f);
  }
});

test('the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, with the tag in a comment, never the tag in the URL (R-10, security)', () => {
  const repo = join(here, '..', '..', '..');
  const v = JSON.parse(readFileSync(join(here, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const doc = readFileSync(join(repo, 'docs', 'openspec-flow.md'), 'utf8');
  const pins = [...doc.matchAll(/chacal88\/devkit\/([^/\n]+)\/plugins\/openspec\/hooks/g)].map((m) => m[1]);
  assert.ok(pins.length > 0);
  assert.deepEqual([...new Set(pins)], [`<commit sha of v${v}>`]);
  assert.match(doc, new RegExp(`# .*v${v.replaceAll('.', '\\.')}`), 'a comment in the snippet names the tag');
});

test('AC-8 release-ready: every pack version matches its marketplace entry, the doc pin names the devkit-openspec version and CONTRIBUTING holds the tag rule', () => {
  const repo = join(here, '..', '..', '..');
  const market = JSON.parse(readFileSync(join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.ok(market.plugins.length > 0);
  for (const entry of market.plugins) {
    const pack = JSON.parse(readFileSync(join(repo, entry.source, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(entry.version, pack.version, entry.name);
  }
  const v = JSON.parse(readFileSync(join(repo, 'plugins', 'openspec', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const doc = readFileSync(join(repo, 'docs', 'openspec-flow.md'), 'utf8');
  assert.ok(doc.includes(`<commit sha of v${v}>`), 'the doc pin names the tag');
  assert.ok(doc.includes(`gh api repos/chacal88/devkit/git/ref/tags/v${v}`), 'the by-hand command names the tag');
  const contributing = readFileSync(join(repo, 'CONTRIBUTING.md'), 'utf8');
  assert.ok(contributing.includes(`v<that version>`) || contributing.includes(`v${v}`), 'the tag rule names the tag');
  assert.match(contributing, /merge commit/);
  assert.match(contributing, /lightweight/);
});
