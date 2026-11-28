// Tests for deliver-check.mjs, part 3 of 3 (suite-speed D-11; the others are deliver-check.test.mjs and deliver-check-cli.test.mjs): the archive steps after the merge (the archive PR, the phase and its rows, the file check, the wait), the skills, agents and docs of those steps, the later field fixes, the verdict files and the commit attribution. What the three parts share is in deliver-check-fixtures.mjs.
// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, appendFileSync, rmSync as fsRm, readFileSync, renameSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { spawnSync } from 'node:child_process';
import { ghError } from './merge-setup.mjs';
import { archiveBranchChange, resolveChange } from './guard.mjs';
import {
  parseCommitLine, gitFacts, staleness, reviewsItem, tasksItem, parseTasks, readPhases, makeGh, nextStep, collectState, findChangePr, readRetro,
  RELEASE_FILE, unnamedFiles,
} from './deliver-check.mjs';
import * as DC from './deliver-check.mjs';
import { pendingTasks } from './flow-check.mjs';
import { main as loopMain } from './change-loop.mjs';
import { recordText, SUITE as TRAIN_SUITE } from './delivery-train-fixtures.mjs';
import {
  git, gitRepo, put, commitAll, fakeGh, PR_FILES_KEY, TASKS_ON_KEY, tasksText, tasksFixture, check, presetSetup, shipRepo, cli, runCli, mergedPr, archivePrJson,
  ARCHIVE_LISTING, ACTIVE_ON_MAIN, ARCHIVE_PRS, ARCHIVED_DIR, NOT_FOUND, retroMd, retroPath, writeRetro, pm, proposal, SET_LOOP, actionOf,
} from './test-fixtures.mjs';
import {
  here, review, reviews, withReviews, base, head, mergeHistory, mergeMain, onlyOpenspec, s7, acRow, changeFiles, callGh, prJson, OLD_FLAG, versionsOf,
  tick, approvalMd, planRepo, fullEvidence, PR_BODY, driveToReady, readyRepo, committedChange, bothEvidenceCurrent, presetArchiveReads, repoRoot,
  coreAgent, runCi, ciGate, ciRepo, archivePrRepo, bothEntries, CI_ENV, state, open, rejectedState, BOTH, ev, reviewAt, itemsOf,
} from './deliver-check-fixtures.mjs';

// ================================================================ after the merge: the archive steps (archive-after-merge phase 2)

// What `openspec archive feat --yes` does to the working tree.
const archiveFolder = (t) => renameSync(join(t.root, 'openspec/changes/feat'), join(t.root, ARCHIVED_DIR));
const ticked = '## Round 3\n- [x] feat\n';

// The archive branch with the folder moved. `files` are committed on it (or left dirty).
function onArchiveBranch({ ship = 'merge', proposals = [proposal(['CONTRIBUTING.md'], { answer: 'approved', applied: true })], files = { 'CONTRIBUTING.md': 'new\n' }, commit = true, archivePrs = [], onDefault = 'active' } = {}) {
  const t = pm({ ship, branch: 'chore/archive-feat', archivePrs, onDefault });
  archiveFolder(t);
  put(t.root, { [retroPath(true)]: retroMd(...proposals), 'openspec/roadmap.md': ticked, ...files });
  if (commit) commitAll(t.root, 'archive feat');
  return t;
}

const merges = (t) => t.gh.calls().filter((c) => c[0] === 'pr' && (c[1] === 'merge' || c[1] === 'create'));

// ---- findChangePr (2.3, design D4)

const AUTO = { number: 5, url: 'https://github.com/o/r/pull/5', state: 'MERGED', headRefName: 'auto-merge', headRefOid: 'a'.repeat(40), mergedAt: '2026-11-09T14:56:00Z', body: 'auto-merge\nopenspec/changes/auto-merge/evidence.md\n' };
const AUTO_ARCHIVE = { number: 6, url: 'https://github.com/o/r/pull/6', state: 'MERGED', headRefName: 'archive-auto-merge', headRefOid: 'd'.repeat(40), mergedAt: '2026-11-09T17:00:00Z', body: 'Archive auto-merge with its retro.\n' };
const AUTO_DOCS = { number: 9, url: 'https://github.com/o/r/pull/9', state: 'MERGED', headRefName: 'feat/auto-merge-docs', headRefOid: 'e'.repeat(40), mergedAt: '2026-11-10T09:00:00Z', body: 'docs\n' };

function findRepo(prs, { ship = 'merge' } = {}) {
  const root = gitRepo({ changes: { 'auto-merge': { '.openspec.yaml': 'schema: devkit-lite\n' } } });
  const gh = fakeGh();
  gh.set('pr-list-state-merged', { stdout: prs });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch\n' });
  // Each PR changed a file of the change only when it is #5 (field-fixes D-4: files, not names, prove ownership);
  // the default branch holds every task ticked.
  for (const p of prs) gh.prFiles(p.number, p.number === 5 ? ['openspec/changes/auto-merge/evidence.md', 'src/a.ts'] : ['src/other.ts']);
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  gh.tasksOnDefault('auto-merge', tasksText({ ticked: ['1.1', '1.2'] }));
  return { root, gh, run: makeGh(root, gh.env), find: (branch, over = {}) => findChangePr(makeGh(root, gh.env), root, 'auto-merge', { ship, branch, env: {}, ...over }) };
}

test('findChangePr: this repository\'s history — id auto-merge is PR #5, never the archive PR #6 nor feat/auto-merge-docs, from main and from chore/archive-auto-merge (D4)', () => {
  for (const branch of ['main', 'chore/archive-auto-merge', 'archive-auto-merge']) {
    const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, AUTO]);
    const found = t.find(branch);
    assert.equal(found.pr?.number, 5, `${branch}: ${JSON.stringify(found)}`);
    assert.ok(t.gh.calls().some((c) => c.slice(0, 5).join(' ') === 'pr list --state merged --limit'), 'one merged list call');
    assert.ok(!t.gh.calls().some((c) => c[1] === 'view' && !/^\d+$/.test(c[2])), `${branch}: the archive branch is never read as the change branch (only bodies, by number)`);
  }
});

test('findChangePr: a head name is never proof of ownership; the files are (D4, field-fixes D-4)', () => {
  const noLink = { ...AUTO, body: 'nothing\n' };
  const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, noLink]);
  assert.equal(t.find('main').pr.number, 5, 'PR #5 changed a file of the change');
  const other = findRepo([AUTO_DOCS, AUTO_ARCHIVE]);
  assert.deepEqual(other.find('main'), { none: true });
  const slash = findRepo([{ ...AUTO, number: 8, headRefName: 'ship/auto-merge', body: '' }, AUTO_DOCS]);
  assert.deepEqual(slash.find('main'), { none: true }, 'the last segment of ship/auto-merge names the change but its files do not');
});

test('findChangePr: among several own PRs the newest mergedAt wins; a body link is not proof (D4, field-fixes D-4)', () => {
  const older = { ...AUTO, number: 3, mergedAt: '2026-11-01T00:00:00Z' };
  const own = (n) => ['openspec/changes/auto-merge/tasks.md', `src/${n}.ts`];
  const both = (prs) => { const t = findRepo(prs); t.gh.prFiles(3, own(3)); t.gh.prFiles(5, own(5)); return t; };
  assert.equal(both([older, AUTO]).find('main').pr.number, 5);
  assert.equal(both([AUTO, older]).find('main').pr.number, 5);
  const linkOnly = { ...AUTO, number: 8, mergedAt: '2026-12-01T00:00:00Z' };
  assert.equal(findRepo([linkOnly, AUTO]).find('main').pr.number, 5, 'the newer PR links the evidence but changes no file of the change');
});

test('findChangePr: on the change branch a MERGED PR is found by pr view, and by pr list --head --state all once the branch is deleted, in pr mode too (D4)', () => {
  for (const ship of ['pr', 'merge']) {
    const view = findRepo([AUTO], { ship });
    view.gh.set('pr-view', { stdout: { ...AUTO, mergeable: 'UNKNOWN', baseRefName: 'main' } });
    assert.equal(view.find('ship/auto-merge').pr.number, 5, ship);
    assert.ok(!view.gh.calls().some((c) => c[1] === 'list'), `${ship}: pr view answered`);
    const gone = findRepo([AUTO], { ship });
    gone.gh.set('pr-list-head-ship_auto-merge', { stdout: [AUTO] });
    assert.equal(gone.find('ship/auto-merge').pr.number, 5, ship);
    const call = gone.gh.calls().find((c) => c[1] === 'list');
    assert.deepEqual(call.slice(2, 6), ['--head', 'ship/auto-merge', '--state', 'all'], ship);
  }
});

test('findChangePr: plan mode makes no list call, and a number reads the PR by number (D4)', () => {
  const plan = findRepo([], { ship: 'plan' });
  plan.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "main"\n' });
  assert.deepEqual(plan.find('main'), { none: true });
  assert.ok(!plan.gh.calls().some((c) => c[1] === 'list'));
  const byNumber = findRepo([AUTO]);
  byNumber.gh.set('pr-view', { stdout: AUTO });
  assert.equal(byNumber.find('main', { number: 5 }).pr.number, 5);
  assert.deepEqual(byNumber.gh.calls()[0].slice(0, 3), ['pr', 'view', '5']);
});

test('findChangePr: a failing list is an error, never a silent none (D4)', () => {
  const t = findRepo([]);
  t.gh.set('pr-list-state-merged', { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

test('findChangePr: lists light fields only and reads the files of one candidate at a time, newest first, so 100 long bodies never overflow the buffer (review finding 4, field-fixes D-4)', () => {
  const filler = 'x'.repeat(12000);
  const mk = (n, over = {}) => ({ ...AUTO, number: n, headRefName: `feat/other-${n}`, headRefOid: String(n).padStart(40, '0'), mergedAt: `2026-11-01T00:${String(n % 60).padStart(2, '0')}:00Z`, body: `${filler}\nnothing\n`, ...over });
  const prs = Array.from({ length: 99 }, (_, i) => mk(i + 100));
  const target = mk(1, { headRefName: 'ship/auto-merge', mergedAt: '2026-10-01T00:00:00Z', body: `${filler}\nopenspec/changes/auto-merge/evidence.md\n` });
  const t = findRepo([...prs, target]);
  t.gh.prFiles(1, ['openspec/changes/auto-merge/tasks.md']);
  assert.ok(JSON.stringify([...prs, target]).length > 1024 * 1024, 'the full list is past 1 MiB');
  const found = t.find('main');
  assert.equal(found.pr?.number, 1, JSON.stringify(found).slice(0, 200));
  const list = t.gh.calls().find((c) => c[1] === 'list');
  assert.doesNotMatch(list[list.indexOf('--json') + 1], /\bbody\b/, 'the list asks for no body');
  assert.ok(!t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view'), 'no body is read');
  const reads = t.gh.calls().filter((c) => c[0] === 'api');
  assert.equal(reads.length, 100, 'the files of one candidate per call');
  assert.ok(reads.every((c) => /^repos\/\{owner\}\/\{repo\}\/pulls\/\d+\/files$/.test(c[1])), 'by number');
  assert.equal(reads.at(-1)[1], 'repos/{owner}/{repo}/pulls/1/files', 'newest first: the oldest is read last');
});

test('findChangePr: a files read that cannot be read is an error, never a silent miss (review finding 4, field-fixes D-4)', () => {
  const t = findRepo([AUTO]);
  t.gh.set(PR_FILES_KEY(5), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

test('findChangePr: on a branch that names neither the change nor an archive head the merged PR is still found by its files, never reported as none (compozy-loop-v2 retro, field-fixes D-4)', () => {
  const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, AUTO]);
  const found = t.find('calm-badger');
  assert.equal(found.pr?.number, 5, JSON.stringify(found));
  assert.equal(found.via, 'list');
});

test('makeGh/ghError: output past maxBuffer is named, not a bare exit code (review finding 4)', () => {
  const t = findRepo([AUTO]);
  const r = t.run(['pr', 'list', '--state', 'merged', '--json', 'number'], { maxBuffer: 4 });
  assert.equal(r.overflowed, true);
  assert.match(ghError(r), /output too large/);
});

// ---- readRetro (2.5, design D6)

const readRetroText = (text) => {
  const dir = tmpFolder('devkit-retro-');
  writeFileSync(join(dir, 'retro.md'), text);
  return readRetro(join(dir, 'retro.md'));
};

test('readRetro: proposals are the ### headings under ## Proposed updates, with targets, kind, answer and applied (D6)', () => {
  const r = readRetroText(retroMd(
    proposal(['CONTRIBUTING.md'], { answer: 'approved', applied: true }),
    proposal(['plugins/core/agents/adr-reviewer.md', 'plugins/core/agents/code-quality-reviewer.md'], { answer: 'rejected: too broad', kind: 'bug-class' }),
    proposal(['user memory'], { kind: 'memory-only' }),
  ));
  assert.deepEqual([r.exists, r.readable], [true, true]);
  assert.deepEqual(r.proposals, [
    { n: 1, targets: ['CONTRIBUTING.md'], kind: 'process-friction', answer: 'approved', applied: true },
    { n: 2, targets: ['plugins/core/agents/adr-reviewer.md', 'plugins/core/agents/code-quality-reviewer.md'], kind: 'bug-class', answer: 'rejected', applied: false },
    { n: 3, targets: ['user memory'], kind: 'memory-only', answer: null, applied: false },
  ]);
});

test('readRetro: the last Answer: and the last Applied: line of a block count; unknown answers are unanswered (D6)', () => {
  const r = readRetroText(`## Proposed updates\n\n### \`a.md\` (x)\n- Answer: rejected\n- Answer: approved\n- Applied: yes\n- Applied: no\n\n### \`b.md\` (x)\n- Answer: rejected\n- Answer: maybe\n\n### \`c.md\` (x)\n- Answer: approved\n- Answer: rejected: no thanks\n- Applied: no\n- Applied: yes\n`);
  assert.deepEqual(r.proposals.map((p) => [p.answer, p.applied]), [['approved', false], [null, false], ['rejected', true]]);
});

test('readRetro: None. is zero proposals; no ## Proposed updates is unreadable; a missing file does not exist (D6)', () => {
  assert.deepEqual(readRetroText(retroMd()), { exists: true, readable: true, proposals: [] });
  assert.deepEqual(readRetroText('# Retro\n\n## Learnings\n\n### `a.md` (x)\n- Answer: approved\n'), { exists: true, readable: false, proposals: [] });
  assert.deepEqual(readRetro(join(tmpRoot(), 'devkit-no-such-retro.md')), { exists: false, readable: false, proposals: [] });
});

test('readRetro: diff lines are never read as answers, and headings outside the section are not proposals (D6, AC-2)', () => {
  const r = readRetroText(`### \`early.md\` (x)\n\n## Proposed updates\n\n### \`a.md\` (x)\n- before: - Answer: approved\n+ after: - Applied: yes\n- before: Answer: approved\n\n## Notes\n\n### \`late.md\` (x)\n- Answer: approved\n`);
  assert.deepEqual(r.proposals, [{ n: 1, targets: ['a.md'], kind: 'x', answer: null, applied: false }]);
});

// ---- the default branch and the archive PR, read from GitHub (2.4, design D4)

test('post-merge: the default branch name comes from repos/{owner}/{repo}, read once in merge mode (D4)', () => {
  const t = pm();
  t.state();
  assert.equal(t.gh.calls().filter((c) => c.join(' ') === 'api repos/{owner}/{repo}').length, 1);
  const p = pm({ ship: 'pr' });
  p.state();
  assert.equal(p.gh.calls().filter((c) => c.join(' ') === 'api repos/{owner}/{repo}').length, 1, 'pr mode reads it once, after the PR is known merged');
});

test('post-merge: the archive listing on the default branch makes the change archived; else the folder is active (200) or absent (HTTP 404) (D4)', () => {
  const a = pm({ onDefault: 'archived' }).state();
  assert.deepEqual([a.archive.onDefault, a.archive.folder], ['archived', '2026-11-09-feat']);
  assert.equal(pm().state().archive.onDefault, 'active');
  assert.equal(pm({ onDefault: 'absent' }).state().archive.onDefault, 'absent');
  const empty = pm();
  empty.gh.set(ARCHIVE_LISTING, NOT_FOUND);
  assert.equal(empty.state().archive.onDefault, 'active', 'no archive directory on the default branch yet');
});

test('post-merge: any other read error, or a stalled gh, is stop-archive read-default-branch naming the first stderr line or "gh timed out" (D4, AC-7)', () => {
  const t = pm();
  t.gh.set(ARCHIVE_LISTING, { exit: 1, stderr: 'gh: connection reset\nmore\n' });
  let n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'read-default-branch']);
  assert.equal(n.reason, 'cannot read main on GitHub: gh: connection reset');
  const u = pm();
  u.gh.set(ACTIVE_ON_MAIN, { exit: 1, stderr: 'gh: Server Error (HTTP 500)\n' });
  assert.match(u.next().reason, /cannot read main on GitHub: gh: Server Error \(HTTP 500\)/);
  const s = pm();
  s.gh.set(ARCHIVE_LISTING, { stdout: [], sleep: 8000 });
  const started = Date.now();
  n = nextStep(collectState(s.root, 'feat', { env: s.env, gh: makeGh(s.root, s.env, 1500) }));
  assert.ok(Date.now() - started < 7000, 'cut at the timeout');
  assert.equal(n.step, 'stop-archive');
  assert.match(n.reason, /cannot read main on GitHub: gh timed out/);
});

test('post-merge: the archive PR is the OPEN one, else the newest MERGED, else the newest CLOSED; an OPEN one carries its checks (D4)', () => {
  const open = archivePrJson({ number: 21 });
  const merged = archivePrJson({ number: 22, state: 'MERGED' });
  const closed = archivePrJson({ number: 23, state: 'CLOSED' });
  assert.equal(pm({ archivePrs: [closed, merged, open] }).state().archive.pr.number, 21);
  assert.equal(pm({ archivePrs: [closed, merged] }).state().archive.pr.number, 22);
  assert.equal(pm({ archivePrs: [closed] }).state().archive.pr.number, 23);
  assert.equal(pm({ archivePrs: [] }).state().archive.pr, null);
  const t = pm({ archivePrs: [open] });
  t.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail', 'https://ci/9')] });
  const s = t.state();
  assert.deepEqual(s.archive.pr.checks.failing, [{ name: 'check', link: 'https://ci/9' }]);
  assert.deepEqual(t.gh.calls().find((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('--head')).slice(2, 8), ['--head', 'chore/archive-feat', '--state', 'all', '--limit', '10']);
});

test('gh-version 20: an old gh on the open archive PR is named in the collected checks error, not reported as an unreadable GitHub (AC-1)', () => {
  const t = pm({ archivePrs: [archivePrJson({ number: 21 })] });
  t.gh.set('pr-checks', { exit: 1, stderr: OLD_FLAG('json') });
  t.gh.set('version', { stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  const { error } = t.state().archive.pr.checks;
  for (const part of ['2.46.0', '2.50.0', 'update gh']) assert.ok(error?.includes(part), String(error));
  assert.equal(versionsOf(t).length, 1);
});

// ---- the phase and its rows P0-P14 (2.6, 2.8, design D7)

test('AC-1: a merged change PR with the folder still on the default branch is "retro", in pr and merge mode, with all eight items met and nothing read from tasks or reviews', () => {
  for (const ship of ['pr', 'merge']) {
    const t = pm({ ship });
    const s = t.state();
    assert.deepEqual(s.items.map((i) => i.status), Array(8).fill('met'), ship);
    assert.match(s.items[4].reason, /PR #12 merged/, ship);
    for (const i of [0, 1, 2, 3, 5, 6, 7]) assert.match(s.items[i].reason, /checked before PR #12 merged/, `${ship} item ${i + 1}`);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.number, n.base], ['retro', 12, 'main'], ship);
    const r = runCli(t, ['feat', '--json']);
    assert.equal(r.code, 0, ship);
    const j = JSON.parse(r.out);
    assert.deepEqual([j.version, j.met, j.summary, j.next.step], [1, 8, 'merged: archive step retro', 'retro'], ship);
    assert.ok(!t.gh.calls().some((c) => c[1] === 'checks' || c[1] === 'graphql' || c[0] === 'api' && c[1] === 'graphql'), `${ship}: no checks or conversation read`);
    assert.deepEqual(merges(t), [], ship);
  }
});

test('P0: archived on the default branch is "archived" from main, from the change branch and from chore/archive-<id>, exit 0 (AC-6)', () => {
  for (const [branch, local] of [['main', 'active'], ['ship/feat', 'active'], ['chore/archive-feat', 'archived']]) {
    for (const ship of ['pr', 'merge']) {
      const t = pm({ ship, branch, onDefault: 'archived' });
      if (branch === 'ship/feat') t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: head(t.root) }) });
      if (local === 'archived') archiveFolder(t);
      const r = runCli(t, ['feat', '--json']);
      assert.equal(r.code, 0, `${branch} ${ship}: ${r.out}${r.err}`);
      const j = JSON.parse(r.out);
      assert.deepEqual([j.summary, j.next.step, j.archive.onDefault, j.archive.local], ['archived', 'archived', 'archived', local], `${branch} ${ship}`);
      assert.equal(j.next.folder, '2026-11-09-feat');
      assert.match(runCli(t, ['feat']).out, /^8\/8 met: archived$/m);
      assert.deepEqual(merges(t), []);
    }
  }
});

test('P0: archived on the default branch needs no merged PR and no retro, and wins over everything below it', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  archiveFolder(t);
  assert.equal(t.next().step, 'archived');
  assert.equal(t.json().archive.changePr, null);
});

test('P1: an unreadable default branch is stop-archive, summary "blocked: archive (read-default-branch)", exit 2 (AC-7)', () => {
  const t = pm();
  t.gh.set(ARCHIVE_LISTING, { exit: 1, stderr: 'gh: connection reset\n' });
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 2);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step, j.next.archiveStep], ['blocked: archive (read-default-branch)', 'stop-archive', 'read-default-branch']);
  assert.match(runCli(t, ['feat']).out, /^next: stop-archive/m);
  assert.deepEqual(merges(t), []);
});

test('P1b: on the change branch, a PR merged at another head than the local head is blocked item 5 (design D4)', () => {
  for (const ship of ['pr', 'merge']) {
    const t = pm({ ship, branch: 'ship/feat' });
    t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: '0123456789abcdef0123456789abcdef01234567' }) });
    const r = runCli(t, ['feat', '--json']);
    const j = JSON.parse(r.out);
    assert.equal(r.code, 2, ship);
    assert.deepEqual([j.summary, j.next.step, j.next.item], ['blocked: item 5', 'blocked', 5], ship);
    assert.match(j.items[4].reason, /merged at 0123456; local head/, ship);
  }
});

test('P2: merge mode with the repository not prepared stops at stop-merge-setup after the default branch is read (design D7)', () => {
  const t = pm();
  presetSetup(t.gh, { repo: { allow_auto_merge: false } });
  const j = t.json();
  assert.deepEqual([j.summary, j.next.step], ['blocked: merge setup', 'stop-merge-setup']);
  assert.equal(runCli(t, ['feat']).code, 2);
  const p = pm({ ship: 'pr' });
  presetSetup(p.gh, { repo: { allow_auto_merge: false } });
  assert.equal(p.next().step, 'retro', 'pr mode never reads the setup');
});

test('P3a: an open archive PR with auto-merge on is disabled first when it conflicts, fails a check, is not at the local head or has uncommitted files (design D7)', () => {
  const cases = {
    'conflict': (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), mergeable: 'CONFLICTING', autoMergeRequest: { enabledAt: 'x' } })] }),
    'failing check': (t) => t.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail')] }),
    'local ahead of the PR head': (t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); },
    'uncommitted file': (t) => put(t.root, { 'CONTRIBUTING.md': 'dirty\n' }),
    'head not in local history': (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: '0123456789abcdef0123456789abcdef01234567', autoMergeRequest: { enabledAt: 'x' } })] }),
  };
  for (const [label, arrange] of Object.entries(cases)) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
    arrange(t);
    const n = t.next();
    assert.deepEqual([n.step, n.number], ['disable-auto-merge', 13], label);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3b, P3c, P3e: an open archive PR that conflicts, is not in local history or fails a check is stop-archive archive-pr, exit 2 (AC-7)', () => {
  const cases = [
    ['conflict', (t) => archivePrJson({ headRefOid: head(t.root), mergeable: 'CONFLICTING' }), /PR #13 has merge conflicts with main/],
    ['not in local history', () => archivePrJson({ headRefOid: '0123456789abcdef0123456789abcdef01234567' }), /PR #13 head 0123456 is not in local history/],
  ];
  for (const [label, make, reason] of cases) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [make(t)] });
    const r = runCli(t, ['feat', '--json']);
    const j = JSON.parse(r.out);
    assert.equal(r.code, 2, label);
    assert.deepEqual([j.summary, j.next.step, j.next.archiveStep], ['blocked: archive (archive-pr)', 'stop-archive', 'archive-pr'], label);
    assert.match(j.next.reason, reason, label);
  }
  const f = onArchiveBranch();
  f.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(f.root) })] });
  f.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail', 'https://ci/7')] });
  const n = f.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive-pr']);
  assert.match(n.reason, /failing check \(https:\/\/ci\/7\)/);
  assert.equal(runCli(f, ['feat']).code, 2);
});

test('P3d: an open archive PR with the local branch ahead of it, or uncommitted files, goes back to open-archive-pr (push) (design D7)', () => {
  for (const arrange of [(t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); }, (t) => put(t.root, { 'CONTRIBUTING.md': 'dirty\n' })]) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    arrange(t);
    const n = t.next();
    assert.deepEqual([n.step, n.branch, n.number], ['open-archive-pr', 'chore/archive-feat', 13]);
  }
});

// ---- the file check and the answers hold while the archive PR is open (review round 1, blocker 1)

const UNNAMED = { 'CONTRIBUTING.md': 'new\n', 'src/other.ts': 'o\n' };

test('P3j: an open archive PR is held to the file check at the same head, with local ahead and with a dirty tree (review blocker 1)', () => {
  const arrange = {
    'same head': () => {},
    'local ahead of the PR head': (t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); },
    'dirty tree': (t) => put(t.root, { 'src/untracked.ts': 'u\n' }),
  };
  for (const [label, act] of Object.entries(arrange)) {
    const t = onArchiveBranch({ files: UNNAMED });
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    act(t);
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${n.reason}`);
    assert.match(n.reason, /^files no approved proposal names: .*(src\/other\.ts|src\/untracked\.ts)/, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3j: with auto-merge on, an unnamed file disables it first, in every case; a named file does not (review blocker 1)', () => {
  const on = (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
  const same = onArchiveBranch({ files: UNNAMED });
  on(same);
  let n = same.next();
  assert.deepEqual([n.step, n.number], ['disable-auto-merge', 13], 'same head');
  const ahead = onArchiveBranch({ files: UNNAMED });
  on(ahead);
  put(ahead.root, { 'CONTRIBUTING.md': 'newer\n' });
  commitAll(ahead.root, 'more');
  assert.equal(ahead.next().step, 'disable-auto-merge', 'ahead');
  const dirty = onArchiveBranch({ files: UNNAMED });
  on(dirty);
  put(dirty.root, { 'src/untracked.ts': 'u\n' });
  assert.equal(dirty.next().step, 'disable-auto-merge', 'dirty tree');
  const named = onArchiveBranch();
  on(named);
  assert.equal(named.next().step, 'wait-merge', 'every file named: auto-merge stays on');
});

test('P3j: an open archive PR with an unanswered proposal is stop-retro-answers, and a rejected proposal does not name its file (review blocker 1)', () => {
  const t = onArchiveBranch({ proposals: [proposal(['CONTRIBUTING.md'])] });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
  const n = t.next();
  assert.equal(n.step, 'stop-retro-answers');
  assert.deepEqual(n.proposals.map((p) => p.n), [1]);
  const on = onArchiveBranch({ proposals: [proposal(['CONTRIBUTING.md'])] });
  on.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(on.root), autoMergeRequest: { enabledAt: 'x' } })] });
  assert.equal(on.next().step, 'disable-auto-merge', 'auto-merge on and an unanswered proposal');
  const rejected = onArchiveBranch({ proposals: [proposal(['docs/x.md'], { answer: 'rejected: no' })], files: { 'docs/x.md': 'x\n' } });
  rejected.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(rejected.root) })] });
  const r = rejected.next();
  assert.deepEqual([r.step, r.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(r.reason.includes('docs/x.md'));
  assert.deepEqual(merges(t).concat(merges(rejected)), []);
});

test('P3j: an open archive PR whose folder is not archived locally, or whose archived retro is unreadable, never reaches enable-auto-merge (review round 2, security)', () => {
  const cases = {
    'folder still active locally': () => {
      const t = pm({ ship: 'merge', branch: 'chore/archive-feat', archivePrs: [], onDefault: 'active' });
      commitAll(t.root, 'work');
      return [t, 'archive'];
    },
    'archived folder, retro without the proposals section': () => {
      const t = onArchiveBranch();
      put(t.root, { [retroPath(true)]: '# Retro: feat\n\nno section here\n' });
      commitAll(t.root, 'break the retro');
      return [t, 'retro'];
    },
  };
  for (const [label, arrange] of Object.entries(cases)) {
    const [t, archiveStep] = arrange();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', archiveStep], `${label}: ${n.reason}`);
    assert.match(n.reason, /#13/, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
    const on = t.next();
    assert.deepEqual([on.step, on.number], ['disable-auto-merge', 13], `${label}: auto-merge on`);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3f, P3g, P3h: merge mode — BEHIND updates the branch, clean enables auto-merge with method and head, auto-merge on waits (AC-5)', () => {
  const t = onArchiveBranch();
  const h = head(t.root);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, mergeStateStatus: 'BEHIND' })] });
  let n = t.next();
  assert.deepEqual([n.step, n.number], ['update-branch', 13]);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h })] });
  n = t.next();
  assert.deepEqual([n.step, n.number, n.method, n.head], ['enable-auto-merge', 13, 'squash', h]);
  const j = t.json();
  assert.deepEqual([j.summary, j.met], ['merged: archive step enable-auto-merge', 8]);
  assert.equal(runCli(t, ['feat']).code, 0);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, autoMergeRequest: { enabledAt: 'x' }, mergeStateStatus: 'BLOCKED' })] });
  n = t.next();
  assert.deepEqual([n.step, n.number, n.head], ['wait-merge', 13, h]);
  const w = t.json();
  assert.equal(w.summary, 'archive PR open: waiting for branch rules outside the delivery contract (for example a required approval)');
  assert.equal(w.archive.waitingFor, n.waitingFor);
  assert.deepEqual(merges(t), []);
});

test('P3i: pr mode with the archive PR open is archive-pr-ready and no pr merge is ever called (AC-5)', () => {
  const t = onArchiveBranch({ ship: 'pr' });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
  const j = t.json();
  assert.deepEqual([j.summary, j.next.step, j.next.number, j.next.url], ['archive PR ready', 'archive-pr-ready', 13, 'https://github.com/o/r/pull/13']);
  assert.equal(runCli(t, ['feat']).code, 0);
  assert.deepEqual(merges(t), []);
});

test('P4, P5: a merged archive PR whose folder is not on the default branch, and a closed one, are stop-archive archive-pr (AC-7)', () => {
  const merged = onArchiveBranch({ archivePrs: [archivePrJson({ state: 'MERGED' })] });
  let n = merged.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive-pr']);
  assert.match(n.reason, /PR #13 is merged but main still has openspec\/changes\/feat\/; run again/);
  const closed = onArchiveBranch({ archivePrs: [archivePrJson({ state: 'CLOSED' })] });
  n = closed.next();
  assert.equal(n.step, 'stop-archive');
  assert.match(n.reason, /PR #13 was closed without merging; reopen it \(the flow opens no second archive PR\)/);
  const r = runCli(closed, ['feat', '--json']);
  assert.equal(r.code, 2);
  assert.equal(JSON.parse(r.out).summary, 'blocked: archive (archive-pr)');
});

test('P6, P7: no retro.md is "retro"; a retro.md without ## Proposed updates is stop-archive retro (AC-1, AC-7)', () => {
  const t = pm();
  assert.equal(t.next().step, 'retro');
  writeRetro(t, '# Retro\n\n## Learnings\n- x\n');
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'retro']);
  assert.match(n.reason, /retro\.md has no "## Proposed updates" section/);
  assert.equal(runCli(t, ['feat']).code, 2);
});

test('P8 / AC-2: any proposal without an Answer: stops at stop-retro-answers listing it, and no archive PR is ever opened or merged, whichever one is left out', () => {
  const answers = ['approved', 'rejected: no', 'approved'];
  for (const ship of ['pr', 'merge']) {
    for (let left = 0; left < answers.length; left++) {
      const t = pm({ ship });
      writeRetro(t, retroMd(...answers.map((a, i) => proposal([`docs/p${i + 1}.md`], { answer: i === left ? null : a }))));
      const j = t.json();
      assert.equal(j.next.step, 'stop-retro-answers', `${ship} left ${left + 1}`);
      assert.deepEqual(j.next.proposals, [{ n: left + 1, targets: [`docs/p${left + 1}.md`], kind: 'process-friction' }], `${ship} left ${left + 1}`);
      assert.equal(j.summary, "archive: waiting for the owner's answers");
      assert.equal(runCli(t, ['feat']).code, 0);
      assert.deepEqual(merges(t), [], `${ship} left ${left + 1}`);
      assert.ok(!['open-archive-pr', 'enable-auto-merge', 'archive-pr-ready'].includes(j.next.step));
    }
  }
  const all = pm();
  writeRetro(all, retroMd(proposal(['a.md']), proposal(['b.md'])));
  assert.deepEqual(all.next().proposals.map((p) => p.n), [1, 2], 'every unanswered proposal is listed');
});

test('P9: a change still active locally, all answered, is "archive" with the branch, base and whether to create it (AC-1)', () => {
  const t = pm();
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved' })));
  let n = t.next();
  assert.deepEqual([n.step, n.branch, n.base, n.create], ['archive', 'chore/archive-feat', 'main', true]);
  const on = pm({ branch: 'chore/archive-feat' });
  writeRetro(on, retroMd());
  n = on.next();
  assert.deepEqual([n.step, n.create], ['archive', false], 'the branch exists: switch, do not create');
  assert.equal(t.json().summary, 'merged: archive step archive');
});

test('P10: archived in the working tree of another branch is stop-archive archive (AC-7)', () => {
  const t = pm();
  writeRetro(t, retroMd());
  archiveFolder(t);
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive']);
  assert.match(n.reason, /the change is archived in the working tree of main, not on chore\/archive-feat/);
  const j = t.json();
  assert.equal(j.archive.local, 'archived');
  assert.equal(runCli(t, ['feat']).code, 2);
});

test('P11, AC-4: tick-roadmap only when the roadmap lists the change unticked; nothing when it is not listed or already ticked', () => {
  const unticked = onArchiveBranch({ files: {} });
  put(unticked.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat (after: x)\n' });
  let n = unticked.next();
  assert.deepEqual([n.step, n.line], ['tick-roadmap', '- [ ] feat (after: x)']);
  assert.deepEqual(unticked.json().archive.roadmap, { listed: true, ticked: false });
  const gone = onArchiveBranch({ files: {}, proposals: [] });
  put(gone.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] other\n' });
  n = gone.next();
  assert.notEqual(n.step, 'tick-roadmap');
  assert.deepEqual(gone.json().archive.roadmap, { listed: false, ticked: false });
  const done = onArchiveBranch({ files: {}, proposals: [] });
  n = done.next();
  assert.notEqual(n.step, 'tick-roadmap');
  assert.deepEqual(done.json().archive.roadmap, { listed: true, ticked: true });
  const none = onArchiveBranch({ files: {}, proposals: [] });
  fsRm(join(none.root, 'openspec/roadmap.md'));
  assert.deepEqual(none.json().archive.roadmap, { listed: false, ticked: false });
  assert.notEqual(none.next().step, 'tick-roadmap');
});

test('P12, AC-3: apply-proposals lists only the approved and unapplied proposals', () => {
  const t = onArchiveBranch({
    files: {},
    proposals: [
      proposal(['a.md'], { answer: 'approved' }),
      proposal(['b.md'], { answer: 'rejected: no' }),
      proposal(['c.md'], { answer: 'approved', applied: true }),
      proposal(['user memory'], { answer: 'approved', kind: 'memory-only' }),
    ],
  });
  const n = t.next();
  assert.equal(n.step, 'apply-proposals');
  assert.deepEqual(n.proposals, [{ n: 1, targets: ['a.md'], kind: 'process-friction' }, { n: 4, targets: ['user memory'], kind: 'memory-only' }]);
  assert.equal(t.json().summary, 'merged: archive step apply-proposals');
});

test('P14: everything answered, applied and committed is open-archive-pr with branch, base and title (AC-4)', () => {
  const t = onArchiveBranch();
  const n = t.next();
  assert.deepEqual([n.step, n.branch, n.base, n.title], ['open-archive-pr', 'chore/archive-feat', 'main', 'chore(openspec): archive feat with its retro']);
  const j = t.json();
  assert.deepEqual(Object.keys(j.archive), ['base', 'branch', 'changePr', 'onDefault', 'folder', 'local', 'retro', 'roadmap', 'pr', 'waitingFor']);
  assert.deepEqual([j.archive.changePr, j.archive.pr, j.archive.waitingFor, j.archive.local], [{ number: 12, url: 'https://github.com/o/r/pull/12' }, null, null, 'archived']);
  assert.equal(runCli(t, ['feat']).code, 0);
  assert.deepEqual(merges(t), []);
});

test('plan mode with a merged PR still stops at stop-plan-mode and reads nothing after the merge (design D7)', () => {
  const t = pm();
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit-lite: plan\n');
  t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: head(t.root) }) });
  const j = t.json();
  assert.equal(j.next.step, 'stop-plan-mode');
  assert.equal(j.archive, undefined);
  assert.ok(!t.gh.calls().some((c) => c[1] === 'list' || (c[0] === 'api' && c[1] !== 'graphql')));
});

// ---- the P13 file check (2.7, design D6, D8)

const approvedBy = (targets, files) => onArchiveBranch({ proposals: [proposal(targets, { answer: 'approved', applied: true })], files });

// The archive branch over a base that already holds `base` (the pin files): the base is committed on main and
// origin/main, the branch holds the archived folder, one approved proposal naming CONTRIBUTING.md, and `files`.
function pinArchive({ base, files, commit = true }) {
  const t = pm({ branch: 'main' });
  put(t.root, base);
  commitAll(t.root, 'pin files');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(t.root, 'switch', '-q', '-c', 'chore/archive-feat');
  archiveFolder(t);
  put(t.root, { [retroPath(true)]: retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved', applied: true })), 'openspec/roadmap.md': ticked, ...files });
  if (commit) commitAll(t.root, 'archive feat');
  return t;
}

test('P13 passes to open-archive-pr: an exact path, ./path normalised, a regression gate with both files, the release files, and openspec/changes/** and openspec/roadmap.md (AC-3)', () => {
  const ok = [
    ['an approved proposal\'s path', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n' }],
    ['./CONTRIBUTING.md against CONTRIBUTING.md', ['./CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n' }],
    ['a regression gate naming both files', ['CONTRIBUTING.md', 'plugins/openspec/hooks/guard.test.mjs'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/hooks/guard.test.mjs': 't\n' }],
    ['openspec/config.yaml named by an approved proposal', ['openspec/config.yaml'], { 'openspec/config.yaml': 'schema: devkit-lite\nship:\n  devkit-lite: merge\n# edited\n' }],
    ['the release files', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/.claude-plugin/plugin.json': '{}\n', 'plugins/core/.claude-plugin/plugin.json': '{}\n', '.claude-plugin/marketplace.json': '{}\n', 'CHANGELOG.md': 'c\n', 'docs/catalog.md': 'g\n' }],
    ['openspec/changes/** and the roadmap', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/roadmap.md': ticked, 'openspec/changes/other/notes.md': 'o\n' }],
  ];
  for (const [label, targets, files] of ok) {
    const t = approvedBy(targets, files);
    const n = t.next();
    assert.equal(n.step, 'open-archive-pr', `${label}: ${n.reason}`);
  }
});

test('P13 stops with stop-archive apply-proposals listing every offending path (AC-3)', () => {
  const bad = [
    ['a file named by no proposal', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'src/other.ts': 'o\n' }, ['src/other.ts']],
    ['a regression-gate test the proposal did not name', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/hooks/guard.test.mjs': 't\n' }, ['plugins/openspec/hooks/guard.test.mjs']],
    ['a file inside a directory a proposal names', ['docs/'], { 'docs/x.md': 'x\n' }, ['docs/x.md']],
    ['a path a target only prefixes', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'CONTRIBUTING.md.bak': 'b\n' }, ['CONTRIBUTING.md.bak']],
    ['a glob-looking target', ['docs/*.md'], { 'docs/a.md': 'a\n', 'docs/b.md': 'b\n' }, ['docs/a.md', 'docs/b.md']],
    ['openspec/config.yaml, which needs a named approved proposal', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/config.yaml': 'schema: devkit-lite\nship:\n  devkit-lite: merge\n# edited\n' }, ['openspec/config.yaml']],
    ['a file under openspec/schemas/', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/schemas/devkit/schema.yaml': 's\n' }, ['openspec/schemas/devkit/schema.yaml']],
    ['any other file under openspec/', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/other.md': 'o\n' }, ['openspec/other.md']],
    ['a plugin.json lookalike that is not a pack manifest', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/a/b/.claude-plugin/plugin.json': '{}\n' }, ['plugins/a/b/.claude-plugin/plugin.json']],
  ];
  for (const [label, targets, files, offending] of bad) {
    const t = approvedBy(targets, files);
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${n.reason}`);
    for (const p of offending) assert.ok(n.reason.includes(p), `${label}: names ${p} in "${n.reason}"`);
    assert.match(n.reason, /^files no approved proposal names: /, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    assert.equal(t.json().summary, 'blocked: archive (apply-proposals)', label);
  }
});

// openspec archive writes the canonical spec of each capability the change has a delta for.
const DELTA = `${ARCHIVED_DIR}/specs/cap/spec.md`;

test('unnamedFiles: the canonical spec of a capability the archived folder has a delta for is part of the archive record; nothing else under openspec/specs/ is', () => {
  const d = 'openspec/changes/archive/2026-11-09-feat/specs/cap/spec.md';
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/cap/spec.md'], []), []);
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/other/spec.md'], []), ['openspec/specs/other/spec.md']);
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/cap/notes.md', 'openspec/specs/cap/sub/spec.md'], []), ['openspec/specs/cap/notes.md', 'openspec/specs/cap/sub/spec.md']);
  assert.deepEqual(unnamedFiles(['openspec/specs/cap/spec.md'], []), ['openspec/specs/cap/spec.md']);
});

test('P13 passes to open-archive-pr when the archived change has a delta and the tree changes its canonical spec; any other canonical file stops (archive record)', () => {
  const ok = approvedBy(['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', [DELTA]: 'd\n', 'openspec/specs/cap/spec.md': 'c\n' });
  const n = ok.next();
  assert.equal(n.step, 'open-archive-pr', n.reason);
  for (const [label, extra, offending] of [
    ['a canonical spec the change has no delta for', { 'openspec/specs/other/spec.md': 'o\n' }, 'openspec/specs/other/spec.md'],
    ['another file under the capability', { 'openspec/specs/cap/notes.md': 'o\n' }, 'openspec/specs/cap/notes.md'],
  ]) {
    const t = approvedBy(['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', [DELTA]: 'd\n', 'openspec/specs/cap/spec.md': 'c\n', ...extra });
    const b = t.next();
    assert.deepEqual([b.step, b.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${b.reason}`);
    assert.ok(b.reason.includes(offending), label);
    assert.ok(!b.reason.includes('openspec/specs/cap/spec.md'), label);
  }
});

test('--ci on an archive branch: the canonical spec of a delta the archived folder holds passes; a canonical spec it has no delta for fails, naming it (archive record)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  const delta = { 'openspec/changes/archive/2026-11-09-x/specs/cap/spec.md': 'd\n', 'openspec/specs/cap/spec.md': 'c\n' };
  const ok = runCi(archivePrRepo({ files: delta }), [], env);
  assert.equal(ok.code, 0, ok.out + ok.err);
  const bad = archivePrRepo({ files: { ...delta, 'openspec/specs/other/spec.md': 'o\n' } });
  const r = runCi(bad, [], env);
  assert.equal(r.code, 1, r.out + r.err);
  assert.deepEqual(runCi(bad, ['--json'], env).json().archive.unnamed, ['openspec/specs/other/spec.md']);
});

test('P13: a file named only by a rejected proposal stops; so do uncommitted and untracked product files (AC-3)', () => {
  const t = onArchiveBranch({ proposals: [proposal(['docs/x.md'], { answer: 'rejected: no' })], files: { 'docs/x.md': 'x\n' } });
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(n.reason.includes('docs/x.md'));
  const dirty = onArchiveBranch({ files: { 'CONTRIBUTING.md': 'n\n' } });
  put(dirty.root, { 'src/untracked.ts': 'u\n' });
  const d = dirty.next();
  assert.deepEqual([d.step, d.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(d.reason.includes('src/untracked.ts'));
});

test('P13: origin/<base> that does not resolve stops with the fetch hint (AC-3)', () => {
  const t = onArchiveBranch();
  git(t.root, 'update-ref', '-d', 'refs/remotes/origin/main');
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive']);
  assert.equal(n.reason, 'origin/main is not available; git fetch origin main');
});

// ---- summary, exit codes and JSON (2.8, design D7)

test('JSON: the archive object appears only after the merge, version stays 1, and merged is never a next.step', () => {
  const before = shipRepo({ ship: 'merge' });
  driveToReady(before);
  const b = JSON.parse(runCli(before, ['feat', '--json']).out);
  assert.equal(b.archive, undefined);
  assert.equal(b.version, 1);
  const after = pm().json();
  assert.equal(after.version, 1);
  assert.equal(after.archive.onDefault, 'active');
  assert.deepEqual(after.archive.retro, { exists: false, readable: false, proposals: [] });
  const src = readFileSync(join(here, 'deliver-check.mjs'), 'utf8');
  assert.doesNotMatch(src, /step\('merged'/);
});

test('human output: a post-merge run shows the next archive step (design D7)', () => {
  const t = pm();
  assert.match(runCli(t, ['feat']).out, /^next: retro PR #12$/m);
  writeRetro(t, retroMd(proposal(['a.md'])));
  assert.match(runCli(t, ['feat']).out, /^next: stop-retro-answers: /m);
  assert.match(runCli(onArchiveBranch(), ['feat']).out, /^next: open-archive-pr chore\/archive-feat$/m);
});

// ---- an archived change answers (2.2, AC-6)

test('deliver-check on an id that is only archived does not exit 3; an id in neither place does, with the new message; --ci ignores archived changes (AC-6)', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  archiveFolder(t);
  assert.equal(runCli(t, ['feat', '--json']).code, 0);
  const missing = runCli(t, ['nope', '--json']);
  assert.equal(missing.code, 3);
  assert.equal(JSON.parse(missing.out).error, 'unknown change "nope": no openspec/changes/nope/ and no openspec/changes/archive/<date>-nope/ in this checkout; switch to the default branch and pull, or to the change\'s branch');
  const ci = spawnSync('node', [cli, '--ci', 'feat'], { cwd: t.root, encoding: 'utf8', env: { ...t.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' } });
  assert.equal(ci.status, 3, 'an archived change is not selectable by --ci');
  assert.match(ci.stderr, /archived changes do not count/);
});

test('the schema of an archived change comes from its own folder: a devkit change in a devkit-lite project reads ship.devkit (D3)', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit: pr\n  devkit-lite: plan\n');
  writeFileSync(join(t.root, 'openspec/changes/feat/.openspec.yaml'), 'schema: devkit\n');
  archiveFolder(t);
  const j = t.json();
  assert.deepEqual([j.schema, j.ship, j.next.step], ['devkit', 'pr', 'archived']);
});

// ---- wait-merge on the archive PR and the walkthrough (2.9, AC-5, AC-6, AC-9 pre-merge)

const ARCHIVE_POLL = ['pr', 'view', '13', '--json', 'state,autoMergeRequest,mergeStateStatus,headRefOid'];
const archivePolls = (t) => t.gh.calls().filter((c) => c.join(' ') === ARCHIVE_POLL.join(' '));

function waitingArchive() {
  const t = onArchiveBranch();
  const h = head(t.root);
  const view = (extra = {}) => ({ number: 13, state: 'OPEN', headRefOid: h, mergeStateStatus: 'CLEAN', autoMergeRequest: { enabledAt: 'x' }, ...extra });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, autoMergeRequest: { enabledAt: 'x' } })] });
  t.view = view;
  t.run = (watch = '--watch=1') => runCli(t, ['feat', '--json', watch], { env: { DEVKIT_POLL_SECONDS: '0' } });
  return t;
}

test('--watch at wait-merge on the archive PR polls gh pr view <archive PR> until MERGED, then reports archived once the listing has the folder (AC-5, AC-6)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view() }, 1);
  t.gh.set('pr-view', { stdout: t.view({ state: 'MERGED' }) });
  // the first collection finds no folder; after GitHub merged, the default branch lists it
  t.gh.set(ARCHIVE_LISTING, { stdout: [] }, 1);
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  const r = t.run();
  assert.equal(r.code, 0, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step], ['archived', 'archived']);
  assert.equal(archivePolls(t).length, 2);
  assert.deepEqual(j.watch.timedOut, false);
});

test('--watch at wait-merge on the archive PR: at the cap it reports "archive PR open: waiting for <what>" (AC-5)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view() });
  const j = JSON.parse(t.run('--watch=0.02').out);
  assert.equal(j.summary, 'archive PR open: waiting for GitHub to merge');
  assert.equal(j.watch.timedOut, true);
  assert.ok(archivePolls(t).length >= 1);
});

test('--watch at wait-merge on the archive PR: merged but the default branch does not list the folder yet is P4, not archived (R1)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view({ state: 'MERGED' }) });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ state: 'MERGED' })] }, 2);
  const j = JSON.parse(t.run().out);
  assert.equal(j.next.step, 'stop-archive');
  assert.match(j.next.reason, /is merged but main still has/);
});

// A full run of a devkit-lite change in merge mode, each step's effect applied the way ship-change does.
test('walkthrough (merge): enable at 8/8, merged, retro, owner answers, archive, tick, apply, open the archive PR, enable, wait, archived (AC-1..AC-7, AC-9 pre-merge)', () => {
  const t = shipRepo({ ship: 'merge' });
  const taken = driveToReady(t);
  assert.equal(taken.at(-1), 'enable-auto-merge');

  // the change PR merges; the default branch gets the change folder and the roadmap
  git(t.root, 'switch', '-q', 'main');
  git(t.root, 'merge', '-q', '--ff-only', 'ship/feat');
  put(t.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat\n', 'CONTRIBUTING.md': 'old\n' });
  commitAll(t.root, 'roadmap');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "main"\n' });
  t.gh.set('pr-list-state-merged', { stdout: [mergedPr()] });
  presetArchiveReads(t);
  t.gh.set('pr-checks', { stdout: [check('check', 'pass')] });
  const next = () => nextStep(collectState(t.root, 'feat', { env: t.env }));
  const seen = [];
  const take = () => { const n = next(); seen.push(n.step); return n; };

  let n = take();
  assert.deepEqual([n.step, n.number], ['retro', 12]);
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md']), proposal(['docs/extra.md'])));
  n = take();
  assert.equal(n.step, 'stop-retro-answers');
  assert.equal(n.proposals.length, 2);
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved' }), proposal(['docs/extra.md'], { answer: 'rejected: not now' })));
  n = take();
  assert.deepEqual([n.step, n.branch, n.create], ['archive', 'chore/archive-feat', true]);
  git(t.root, 'switch', '-q', '-c', n.branch);
  archiveFolder(t);
  n = take();
  assert.deepEqual([n.step, n.line], ['tick-roadmap', '- [ ] feat']);
  put(t.root, { 'openspec/roadmap.md': ticked });
  n = take();
  assert.equal(n.step, 'apply-proposals');
  assert.deepEqual(n.proposals.map((p) => p.targets), [['CONTRIBUTING.md']], 'only the approved one');
  put(t.root, { 'CONTRIBUTING.md': 'new\n' });
  writeRetro(t, readFileSync(join(t.root, retroPath(true)), 'utf8').replace('- Answer: approved\n', '- Answer: approved\n- Applied: yes\n'), true);
  n = take();
  assert.deepEqual([n.step, n.title], ['open-archive-pr', 'chore(openspec): archive feat with its retro']);
  const archiveHead = commitAll(t.root, 'archive feat');
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead })] });
  n = take();
  assert.deepEqual([n.step, n.number, n.method, n.head], ['enable-auto-merge', 13, 'squash', archiveHead]);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead, autoMergeRequest: { enabledAt: 'x' } })] });
  n = take();
  assert.equal(n.step, 'wait-merge');
  // GitHub merges the archive PR
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead, state: 'MERGED' })] });
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  n = take();
  assert.deepEqual([n.step, n.folder], ['archived', '2026-11-09-feat']);

  assert.deepEqual(seen, ['retro', 'stop-retro-answers', 'archive', 'tick-roadmap', 'apply-proposals', 'open-archive-pr', 'enable-auto-merge', 'wait-merge', 'archived']);
  assert.deepEqual(t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'create'), []);
  assert.deepEqual(t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge'), [], 'deliver-check never merges');
  assert.ok(!t.gh.calls().some((c) => c.join(' ').includes('push')), 'nothing is pushed');
});

test('walkthrough (pr): the same run ends at archive-pr-ready, then archived after the owner merges it (AC-5, AC-6)', () => {
  const t = onArchiveBranch({ ship: 'pr' });
  const h = head(t.root);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h })] });
  assert.equal(t.next().step, 'archive-pr-ready');
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, state: 'MERGED' })] });
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  assert.equal(t.next().step, 'archived');
  assert.deepEqual(merges(t), []);
});

// ================================================================ skills, agents and docs of the archive steps (archive-after-merge phase 3)

const shipSkill = () => readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
const skillRow = (md, step) => md.split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';

test('format: ship-change archive rows name the commands and the owner-answer rule (3.1, AC-2, AC-3, AC-4)', () => {
  const md = shipSkill();
  assert.match(skillRow(md, 'archive'), /openspec archive <id> --yes/);
  assert.match(skillRow(md, 'archive'), /git switch -c <next\.branch> origin\/<next\.base>/);
  assert.match(skillRow(md, 'stop-retro-answers'), /owner's own message/);
  assert.match(skillRow(md, 'stop-retro-answers'), /Never answer for the owner/);
  assert.match(skillRow(md, 'tick-roadmap'), /- \[x\] <id>/);
  assert.match(skillRow(md, 'apply-proposals'), /exactly these approved retro proposals/);
  assert.match(skillRow(md, 'apply-proposals'), /Applied: yes/);
  assert.match(skillRow(md, 'open-archive-pr'), /devkit-core:commit-and-pr/);
  assert.match(skillRow(md, 'open-archive-pr'), /next\.title/);
  assert.match(skillRow(md, 'retro'), /devkit-core:retro/);
  assert.match(skillRow(md, 'archive-pr-ready'), /archive PR ready/);
  assert.match(skillRow(md, 'stop-archive'), /blocked: archive \(<next\.archiveStep>\)/);
  assert.match(skillRow(md, 'archived'), /archived/);
});

test('forced-merge-path 2: D2 the ship-change retro row names next.forced, Went wrong, items and the files\' language', () => {
  const row = skillRow(shipSkill(), 'retro');
  assert.match(row, /next\.forced/);
  assert.match(row, /Went wrong/);
  assert.match(row, /next\.forced\.items/);
  assert.match(row, /files' language/);
  assert.match(row, /filesLanguage/);
  assert.match(row, /Merged by the owner with <count> items open:/);
  assert.match(row, /tick no task and change no file but `retro\.md`/);
});

test('format: ship-change reused merge rows say next.number is the archive PR after the merge, and the enable command stays verbatim (3.1, AC-5)', () => {
  const md = shipSkill();
  assert.ok(md.includes('gh pr merge <next.number> --auto --<next.method> --match-head-commit <next.head>'));
  for (const step of ['disable-auto-merge', 'update-branch', 'enable-auto-merge', 'wait-merge']) {
    assert.match(skillRow(md, step), /archive PR/, `${step} names the archive PR`);
  }
});

test('format: ship-change Start takes the id from a chore/archive-<id> branch, Stops, Never and Hosts cover the archive (3.1, AC-6, AC-7)', () => {
  const md = shipSkill();
  const start = md.slice(md.indexOf('## Start'), md.indexOf('## Go-ahead'));
  assert.match(start, /chore\/archive-<id>/);
  assert.match(start, /no argument|else/);
  const stops = md.slice(md.indexOf('## Stops'), md.indexOf('## Resume'));
  assert.match(stops, /blocked: archive \(<step>\)/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Push to the default branch, or commit on it/);
  assert.match(never, /chore\/archive-<id>/);
  assert.match(never, /Apply a retro proposal the owner did not approve, or record an answer the owner did not give/);
  const hosts = md.slice(md.indexOf('## Hosts'), md.indexOf('## Report'));
  assert.match(hosts, /archive PR/);
  assert.match(hosts, /two|twice/);
  assert.match(md.slice(0, md.indexOf('## Start')), /archive/i, 'description and intro mention the archive');
  assert.match(md.split('\n')[2], /archive/, 'the description mentions the archive');
});

test('round trip: on chore/archive-x with x moved, archiveBranchChange finds x, resolveChange returns null, and deliver-check x answers (3.1, AC-6)', () => {
  const t = onArchiveBranch();
  assert.equal(archiveBranchChange(t.root, 'chore/archive-feat'), 'feat');
  assert.equal(resolveChange(t.root, {}, 'chore/archive-feat'), null);
  const r = runCli(t, ['feat', '--json']);
  assert.notEqual(r.code, 3, r.err);
  assert.equal(JSON.parse(r.out).change, 'feat');
});

const fencedBlocks = (md, from) => [...md.slice(md.indexOf(from)).matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const retroSkill = () => readFileSync(join(repoRoot, 'plugins', 'core', 'skills', 'retro', 'SKILL.md'), 'utf8');
function parseExample(block) {
  const dir = tmpFolder('devkit-retro-');
  const file = join(dir, 'retro.md');
  writeFileSync(file, block);
  return readRetro(file);
}

test('format: the retro Output example, parsed by readRetro, yields the proposals, targets, kinds, answers and applied flags it shows (3.2, AC-2, AC-3)', () => {
  const md = retroSkill();
  const blocks = fencedBlocks(md, '\n## Output');
  const produced = parseExample(blocks[0]);
  assert.equal(produced.readable, true);
  assert.ok(produced.proposals.length >= 2);
  assert.ok(produced.proposals.every((p) => p.answer === null && p.applied === false), 'the retro writes no Answer and no Applied');
  assert.ok(produced.proposals.every((p) => p.targets.length > 0 && p.kind), 'every proposal has targets and a kind');
  assert.ok(produced.proposals.some((p) => p.targets.includes('user memory')), 'shows a user memory proposal');
  assert.ok(produced.proposals.some((p) => p.targets.length > 1), 'shows a proposal that changes two files');
  const answered = parseExample(blocks[1]);
  assert.deepEqual(answered.proposals.map((p) => p.targets), produced.proposals.map((p) => p.targets));
  assert.ok(answered.proposals.some((p) => p.answer === 'approved' && p.applied === true), 'approved and applied');
  assert.ok(answered.proposals.some((p) => p.answer === 'rejected' && p.applied === false), 'rejected');
  assert.match(md, /^\s*`None\.`|`None\.`|\bNone\.\s*$/m, 'names the empty case');
  assert.equal(parseExample('## Proposed updates\n\nNone.\n').proposals.length, 0);
});

test('format: retro says every changed file is a proposal target, the caller writes Answer, whoever applies writes Applied, and names ship-change (3.2)', () => {
  const md = retroSkill();
  assert.match(md, /exact backticked repo-relative path/);
  assert.match(md, /regression gate'?s test file/i);
  assert.match(md, /`user memory`/);
  assert.match(md, /- Answer:/);
  assert.match(md, /- Applied: yes/);
  assert.match(md.slice(md.indexOf('## When to use'), md.indexOf('## Process')), /ship-change/);
  const never = md.slice(md.indexOf('## Never'), md.indexOf('## Related'));
  assert.match(never, /write an `Answer:` line yourself/);
});

test('format: commit-and-pr has an archive call: precondition 1 kept, 3 waived, the title form and the body contents (3.3, AC-4, AC-7)', () => {
  const md = coreAgent('commit-and-pr');
  assert.match(md, /archive call/i);
  assert.match(md, /`chore\(openspec\): archive <id> with its retro`/);
  assert.match(md, /` \(<version>\)`|\(<version>\)/);
  assert.match(md, /openspec\/changes\/archive\/<date>-<id>\/retro\.md/);
  assert.match(md, /approved and rejected/i);
  const pre = md.slice(md.indexOf('## Preconditions'), md.indexOf('## Method'));
  assert.match(pre, /1\. \*\*Not on the default branch\*\*/);
  assert.match(pre, /archive call[^\n]*waive|waive[^\n]*archive call/i);
  assert.doesNotMatch(pre.slice(pre.indexOf('1.'), pre.indexOf('2.')), /archive call/, 'precondition 1 has no archive exception');
  assert.match(md, /Merge the PR, or enable auto-merge/, 'Never stays');
});

test('format: tdd-implementer has an apply-proposals call: exactly the approved proposals, Applied: yes, no phase and no tasks.md (3.4, AC-3)', () => {
  const md = coreAgent('tdd-implementer');
  assert.match(md, /apply-proposals call/);
  assert.match(md, /exactly/i);
  assert.match(md, /- Applied: yes/);
  assert.match(md, /no phase/i);
  assert.match(md, /tasks\.md/);
  assert.match(md, /CHANGELOG/);
  assert.match(md, /test-first|test first/i);
});

test('collectState: pr facts carry the PR head, state and mergeable in pr mode too (conduct-check reads them)', () => {
  const t = shipRepo();
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: 'abc1234'.padEnd(40, '0'), mergeable: 'CONFLICTING' }) });
  const pr = collectState(t.root, 'feat', { env: t.env }).pr;
  assert.deepEqual([pr.number, pr.state, pr.headRefOid, pr.mergeable], [12, 'OPEN', 'abc1234'.padEnd(40, '0'), 'CONFLICTING']);
});

test('release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)', () => {
  assert.equal(RELEASE_FILE.source, '^(plugins\\/[^/]+\\/\\.claude-plugin\\/plugin\\.json|\\.claude-plugin\\/marketplace\\.json|CHANGELOG\\.md|docs\\/catalog\\.md)$');
  assert.equal(RELEASE_FILE.test('docs/openspec-flow.md'), false);
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md', 'CHANGELOG.md', 'openspec/roadmap.md'], []), ['docs/openspec-flow.md']);
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md'], [{ answer: 'approved', targets: ['docs/openspec-flow.md'] }]), []);
  // ADR 0027: the doc passes by its content when only its CI pins moved, never as a whole file (AC-6).
  const pinOnly = { 'docs/openspec-flow.md': { before: PIN_DOC('0.33.0'), after: PIN_DOC('0.34.0') } };
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md'], [], pinOnly), []);
  const beyond = { 'docs/openspec-flow.md': { before: PIN_DOC('0.33.0'), after: PIN_DOC('0.34.0').replace('A paragraph about the check.', 'Another paragraph.') } };
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md'], [], beyond), ['docs/openspec-flow.md']);
});

// ================================================================ archive-release-pin: the CI pin lines pass the archive check unnamed (ADR 0027)

const FLOW_PATH = 'docs/openspec-flow.md';
// The CI pin test (suite-speed moved it here from change-loop.test.mjs). Since ADR 0030 it reads the manifest and no release edits it, so it is never pin-only.
const LOOP_PATH = 'plugins/openspec/hooks/change-loop-compozy.test.mjs';
const textOf = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');
const fixtureText = (name) => readFileSync(join(here, 'fixtures', 'c561553', name), 'utf8');
const dotted = (v) => v.replaceAll('.', '\\.');

// A flow page with the three pin line shapes of the real doc (two snippet lines, one prose line).
const PIN_DOC = (v) => [
  '# Flow', '',
  'A paragraph about the check.', '',
  `          # pinned to the commit of v${v} (a tag can move; a commit cannot)`,
  `          base=https://raw.githubusercontent.com/chacal88/devkit/<commit sha of v${v}>/plugins/openspec/hooks`,
  '',
  `Pin the commit sha of the release tag (\`v${v}\` above), not the tag; by hand, run \`gh api repos/chacal88/devkit/git/ref/tags/v${v}\`.`,
  '',
].join('\n');

// The lines of a test file with the pin block of change-loop.test.mjs, one line per element (the last is the empty one after the final newline).
const loopLines = (v, prev) => [
  "test('change-loop docs: the design records the answers', () => {",
  "  const flow = readRepo('docs', 'openspec-flow.md');",
  "  assert.match(adrs, /0011/, 'the ADRs line names 0011');",
  `  // Invariant: the CI snippet pins the current release (docs, change-loop.test.mjs); x moves it to ${v}, above y's ${prev}`,
  `  assert.match(flow, /v${dotted(v)}/, 'the CI snippet pins the current release (x: ${v})');`,
  `  assert.doesNotMatch(flow, /v${dotted(prev)}/, 'no pin left on the previous release (y)');`,
  '});',
  '',
];
const loopText = (v, prev) => loopLines(v, prev).join('\n');
const PIN_LOOP_BEFORE = loopText('0.33.0', '0.32.0');
const PIN_LOOP_AFTER = loopText('0.34.0', '0.33.0');
const pinHas = (path, before, after) => DC.pinLinesOnly(path, { before, after });

test('archive-release-pin 1: pinLinesOnly passes a flow page whose only change is its CI pins, and the real c561553 hunks', () => {
  assert.equal(typeof DC.pinLinesOnly, 'function', 'deliver-check.mjs exports pinLinesOnly');
  assert.equal(pinHas(FLOW_PATH, PIN_DOC('0.33.0'), PIN_DOC('0.34.0')), true, 'the three pin line shapes moved from v0.33.0 to v0.34.0');
  assert.equal(pinHas(FLOW_PATH, fixtureText('openspec-flow.before.txt'), fixtureText('openspec-flow.after.txt')), true, 'the hunks of c561553');
});

test('archive-release-pin 2: pinLinesOnly names a flow page changed beyond its pins', () => {
  assert.equal(typeof DC.pinLinesOnly, 'function', 'deliver-check.mjs exports pinLinesOnly');
  const before = PIN_DOC('0.33.0');
  const after = PIN_DOC('0.34.0');
  const afterFixture = fixtureText('openspec-flow.after.txt');
  const cases = {
    'a changed sentence': after.replace('A paragraph about the check.', 'A different paragraph about the check.'),
    'an added paragraph': `${after}\nA new paragraph.\n`,
    'a marker line with other words changed': after.replace('(a tag can move; a commit cannot)', '(a tag can drift; a commit cannot)'),
    'an added pin line': after.replace('\n\nPin the commit', '\n          # pinned to the commit of v0.34.0 again\n\nPin the commit'),
    'a pin removed from a marker line': after.replace('pinned to the commit of v0.34.0 (a tag', 'pinned to the commit of v (a tag'),
  };
  for (const [label, text] of Object.entries(cases)) assert.equal(pinHas(FLOW_PATH, before, text), false, label);
  assert.equal(pinHas(FLOW_PATH, fixtureText('openspec-flow.before.txt'), afterFixture.replace('older releases pass a slice', 'older releases wave a slice')), false, 'the fixture with one non-pin word changed');
});

test('archive-release-pin 3: pinLinesOnly names a test file whose only changed lines are the old pin forms', () => {
  assert.equal(typeof DC.pinLinesOnly, 'function', 'deliver-check.mjs exports pinLinesOnly');
  // ADR 0030: the pin test reads the manifest and no release edits it, so the one pin file is the flow page.
  assert.deepEqual(DC.PIN_LINE_FILES, [FLOW_PATH], 'the flow page is the only file read by its content');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, PIN_LOOP_AFTER), false, 'the pin block moved to the next release');
});

test('archive-release-pin 5: a flow page missing or unreadable on either side, another path, a CRLF pin line or a changed final newline is never pin-only, and an empty base is a text', () => {
  assert.equal(typeof DC.pinLinesOnly, 'function', 'deliver-check.mjs exports pinLinesOnly');
  const doc = PIN_DOC('0.34.0');
  assert.equal(DC.pinLinesOnly(FLOW_PATH, undefined), false, 'pair undefined');
  assert.equal(pinHas(FLOW_PATH, null, doc), false, 'before null');
  assert.equal(pinHas(FLOW_PATH, doc, null), false, 'after null');
  assert.equal(pinHas(FLOW_PATH, null, null), false, 'both null');
  assert.equal(pinHas(FLOW_PATH, 7, doc), false, 'before not a string');
  assert.equal(pinHas('docs/other.md', doc, doc), false, 'equal texts under another path');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, PIN_LOOP_BEFORE), false, 'equal texts under the test file, which is another path now');
  const crlf = doc.replace('(a tag can move; a commit cannot)', '(a tag can move; a commit cannot)\r');
  assert.equal(pinHas(FLOW_PATH, PIN_DOC('0.33.0'), crlf), false, 'a pin line ending in a carriage return');
  assert.equal(pinHas(FLOW_PATH, 'a\nb\n', 'a\nb'), false, 'a lost final newline');
  assert.equal(pinHas(FLOW_PATH, 'a\nb', 'a\nb\n'), false, 'a gained final newline');
  assert.equal(pinHas(FLOW_PATH, '', 'a\n'), false, 'an empty base against a text');
  assert.equal(pinHas(FLOW_PATH, '', ''), true, 'an empty base against an empty file is not missing');
  assert.equal(pinHas(LOOP_PATH, '', ''), false, 'the test file is another path, empty or not');
});

test('archive-release-pin 6: unnamedFiles takes the pin rule from the texts, and c561553\'s file list names only its test file when no proposal names the flow page', () => {
  const paths = [FLOW_PATH, LOOP_PATH];
  const pinOnly = { [FLOW_PATH]: { before: PIN_DOC('0.33.0'), after: PIN_DOC('0.34.0') }, [LOOP_PATH]: { before: PIN_LOOP_BEFORE, after: PIN_LOOP_AFTER } };
  assert.deepEqual(unnamedFiles(paths, [], pinOnly), [LOOP_PATH], 'pin-only texts: the flow page passes, the test file never does');
  assert.deepEqual(unnamedFiles(paths, []), paths, 'no texts');
  assert.deepEqual(unnamedFiles(paths, [], {}), paths, 'empty texts');
  const beyond = { [FLOW_PATH]: { before: PIN_DOC('0.33.0'), after: PIN_DOC('0.34.0').replace('A paragraph', 'Another paragraph') }, [LOOP_PATH]: { before: PIN_LOOP_BEFORE, after: `${PIN_LOOP_AFTER}// note\n` } };
  assert.deepEqual(unnamedFiles(paths, [], beyond), paths, 'each file whose text goes beyond');
  const archived = 'openspec/changes/archive/2026-11-22-review-writer-prompt';
  const c561553 = [
    '.claude-plugin/marketplace.json', 'CHANGELOG.md', FLOW_PATH, 'openspec/config.yaml', 'openspec/roadmap.md',
    'openspec/specs/change-delivery/spec.md', 'openspec/specs/change-stages/spec.md', 'openspec/specs/review-round/spec.md', 'openspec/specs/verdict-files/spec.md',
    'plugins/openspec/.claude-plugin/plugin.json', LOOP_PATH, 'plugins/openspec/skills/ship-change/SKILL.md',
    ...['change-delivery', 'change-stages', 'review-round', 'verdict-files'].map((c) => `${archived}/specs/${c}/spec.md`),
  ];
  const proposals = [
    { answer: 'approved', targets: ['plugins/openspec/skills/ship-change/SKILL.md'] },
    { answer: 'approved', targets: ['openspec/roadmap.md'] },
    { answer: 'approved', targets: ['openspec/config.yaml'] },
  ];
  const texts = { [FLOW_PATH]: { before: fixtureText('openspec-flow.before.txt'), after: fixtureText('openspec-flow.after.txt') } };
  assert.equal(c561553.length, 16);
  assert.deepEqual(unnamedFiles(c561553, proposals, texts), [LOOP_PATH], 'the file list of c561553 with its flow page texts names only the test file');
  assert.deepEqual(unnamedFiles(c561553.filter((p) => p !== LOOP_PATH), proposals, texts), [], 'the same list without the test file passes');
  assert.deepEqual(unnamedFiles(c561553, proposals), [FLOW_PATH, LOOP_PATH], 'the same list without texts names both files');
});

// The flow page as at a base on `main`, then `files` on the archive branch (ADR 0030: the one file read by its content).
const PIN_BASE = { [FLOW_PATH]: PIN_DOC('0.33.0') };
const PIN_EDITS = { [FLOW_PATH]: PIN_DOC('0.34.0') };
const PIN_BEYOND_DOC = PIN_DOC('0.34.0').replace('A paragraph about the check.', 'A different paragraph about the check.');
// The test file with only its old pin assertion lines changed: it is named, as any other edit of a test file.
const LOOP_EDIT = { base: { [LOOP_PATH]: PIN_LOOP_BEFORE }, files: { [LOOP_PATH]: PIN_LOOP_AFTER } };

test('archive-release-pin 7: the local archive stop: pin-only edits open the archive PR, an edit beyond the pin stops on apply-proposals, committed or in the tree, and a deleted pin file stops', () => {
  for (const commit of [true, false]) {
    const label = commit ? 'committed' : 'in the tree';
    const ok = pinArchive({ base: PIN_BASE, files: PIN_EDITS, commit }).next();
    assert.equal(ok.step, 'open-archive-pr', `pin-only ${label}: ${ok.reason}`);
    const bad = pinArchive({ base: PIN_BASE, files: { ...PIN_EDITS, [FLOW_PATH]: PIN_BEYOND_DOC }, commit }).next();
    assert.deepEqual([bad.step, bad.archiveStep, bad.reason], ['stop-archive', 'apply-proposals', `files no approved proposal names: ${FLOW_PATH}`], `beyond the pin ${label}`);
    const loop = pinArchive({ ...LOOP_EDIT, commit }).next();
    assert.deepEqual([loop.step, loop.archiveStep, loop.reason], ['stop-archive', 'apply-proposals', `files no approved proposal names: ${LOOP_PATH}`], `the test file with only its old pin lines changed ${label}`);
  }
  const gone = pinArchive({ base: PIN_BASE, files: PIN_EDITS, commit: false });
  git(gone.root, 'rm', '-q', '-f', FLOW_PATH);
  const n = gone.next();
  assert.deepEqual([n.step, n.archiveStep, n.reason], ['stop-archive', 'apply-proposals', `files no approved proposal names: ${FLOW_PATH}`], 'a deleted pin file');
});

test('archive-release-pin 8: --ci on an archive branch applies the same pin rule', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  const run = (opts) => runCi(archivePrRepo(opts), ['--json'], env);
  const ok = run({ base: PIN_BASE, files: PIN_EDITS });
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.deepEqual([ok.json().pass, ok.json().archive.unnamed], [true, []], 'pin-only edits');
  const doc = run({ base: PIN_BASE, files: { ...PIN_EDITS, [FLOW_PATH]: PIN_BEYOND_DOC } });
  assert.equal(doc.code, 1, doc.out + doc.err);
  assert.deepEqual(doc.json().archive.unnamed, [FLOW_PATH], 'a doc changed beyond its pin');
  const other = run(LOOP_EDIT);
  assert.equal(other.code, 1, other.out + other.err);
  assert.deepEqual(other.json().archive.unnamed, [LOOP_PATH], 'the test file with only its old pin lines changed');
  const added = run({ base: {}, files: PIN_EDITS });
  assert.equal(added.code, 1, added.out + added.err);
  assert.deepEqual(added.json().archive.unnamed, [FLOW_PATH], 'the flow page added only on the branch');
});

test('archive-release-pin 9: --ci from only the three downloaded files passes a pin-only archive and fails one beyond the pin', () => {
  const dir = tmpFolder('devkit-downloaded-');
  for (const n of ['guard.mjs', 'deliver-check.mjs', 'merge-setup.mjs']) cpSync(join(here, n), join(dir, n));
  const env = { ...process.env, ...CI_ENV, GITHUB_BASE_REF: 'main' };
  const from = (root) => spawnSync(process.execPath, [join(dir, 'deliver-check.mjs'), '--ci', '--json'], { cwd: root, encoding: 'utf8', env });
  const ok = from(archivePrRepo({ base: PIN_BASE, files: PIN_EDITS }));
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout).archive.unnamed, [], 'pin-only');
  const bad = from(archivePrRepo({ base: PIN_BASE, files: { ...PIN_EDITS, [FLOW_PATH]: PIN_BEYOND_DOC } }));
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.deepEqual(JSON.parse(bad.stdout).archive.unnamed, [FLOW_PATH], 'beyond the pin');
  assert.doesNotMatch(bad.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
});

test('archive-release-pin 11: the flow page, ADR 0003 and the config state the pin-line rule', () => {
  const ADR_0027 = 'adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md';
  const ADR_0030 = 'adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md';
  const flowLines = textOf('docs', 'openspec-flow.md').split('\n');
  const startsWith = (prefix) => flowLines.find((l) => l.startsWith(prefix)) ?? '';
  const row = startsWith('| P13 |');
  assert.ok(row.includes(FLOW_PATH), 'the P13 row names the flow page');
  assert.ok(!row.includes(LOOP_PATH), 'the P13 row no longer names the pin test');
  const para = startsWith('**The file check (P13, AC-3).**');
  for (const part of [ADR_0027, ADR_0030, 'One file passes by its content']) {
    assert.ok(para.includes(part), `the file check paragraph holds ${part}`);
  }
  for (const gone of ['change-loop-compozy.test.mjs', 'assert.match(flow,', '// Invariant: the CI snippet pins the current release']) {
    assert.ok(!para.includes(gone), `the file check paragraph no longer holds ${gone}`);
  }
  assert.ok(!startsWith('- **Classification.**').includes('and the ADR 0003 exemption, do not change'), 'the Classification bullet no longer says the exemption does not change');
  const adr = textOf('docs', 'adr', '0003-auto-merge-the-archive-pr.md');
  const head = adr.split('\n').slice(0, 9);
  assert.ok(head.includes(`- Amended by ADR 0027 (${ADR_0027.slice(4)})`), 'ADR 0003 header names ADR 0027');
  assert.ok(head.includes(`- Amended by ADR 0030 (${ADR_0030.slice(4)})`), 'ADR 0003 header names ADR 0030');
  const note = adr.split('\n').find((l) => l.startsWith('Note (archive-release-pin, ')) ?? '';
  assert.ok(note.endsWith('The Decision is otherwise unchanged.'), 'ADR 0003 holds the archive-release-pin Note');
  assert.ok(note.includes('ADR 0030'), 'the Note names ADR 0030');
  assert.ok(!note.includes('change-loop-compozy.test.mjs'), 'the Note no longer names the pin test');
  const adr27 = textOf('docs', 'adr', '0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md').split('\n');
  assert.ok(adr27.slice(0, 10).includes(`- Amended by ADR 0030 (${ADR_0030.slice(4)})`), 'ADR 0027 header names ADR 0030');
  assert.ok(adr27.some((l) => l.startsWith('Note (archive-release-pin, ') && l.includes('ADR 0030')), 'ADR 0027 holds the Note that names ADR 0030');
  const adrsLine = textOf('openspec', 'config.yaml').split('\n').find((l) => l.trimStart().startsWith('ADRs:')) ?? '';
  assert.ok(adrsLine.includes('0027 the archive check lets the release pin lines pass unnamed, amends 0003, amended by 0030'), 'the config ADRs line names 0027 as amended');
  assert.ok(adrsLine.includes('0030 the pin test reads the manifest, so only the flow page pins pass unnamed, amends 0003 and 0027'), 'the config ADRs line names 0030');
});

// Invariant (archive-release-pin, ADR 0030 decision 1): no release edits the pin test, so it holds no release version literal and no change name; it reads the manifest.
test('archive-release-pin 12: the pin test reads the manifest and holds no release version literal and no change name outside the v0.20.0 floor', () => {
  const lines = textOf('plugins', 'openspec', 'hooks', 'change-loop-compozy.test.mjs').split('\n');
  const from = lines.findIndex((l) => l.startsWith("test('change-loop docs: the design records the answers'"));
  assert.ok(from >= 0, 'the pin test is in the file');
  const to = lines.findIndex((l, i) => i > from && l === '});');
  assert.ok(to > from, 'the pin test ends');
  const body = lines.slice(from, to + 1);
  const outsideFloor = body.filter((l) => !l.includes('0\\.20\\.0') && !l.includes('0.20.0'));
  const changeIds = ['archive-release-pin', 'change-budget', 'change-state', 'change-state-retro-fixes', 'change-version-pin', 'commit-attribution', 'compozy-driver', 'delivery-models', 'delivery-train', 'gh-version-check', 'jira-entry', 'release-merge-conflict', 'release-tags', 'remote-worker', 'review-openspec-fix', 'roadmap-sessions-upfront', 'stage-models', 'stage-roles', 'stale-only-on-own-files', 'suite-speed', 'test-fixture-cleanup'];
  for (const line of outsideFloor) {
    assert.doesNotMatch(line, /\d+\\?\.\d+\\?\.\d+/, `a version literal: ${line.trim()}`);
    assert.ok(!/^\s*\/\/ Invariant: the CI snippet pins the current release/.test(line), `the release Invariant comment: ${line.trim().slice(0, 60)}`);
    for (const id of changeIds) assert.ok(!line.includes(id), `the change name ${id}: ${line.trim().slice(0, 60)}`);
  }
  const text = body.join('\n');
  for (const part of ["readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')", 'assert.deepEqual(pinMismatches(flow, version), []', 'const staleV20 =', 'moves this pin to']) {
    assert.ok(text.includes(part), `the pin test holds ${part}`);
  }
});

// ================================================================ field-fixes 4: delivered is its own pull request and every task

test('field-fixes 4 fake gh: an unset pull request files or tasks key fails loudly naming the key', () => {
  const gh = fakeGh();
  const files = callGh(gh, 'api', 'repos/{owner}/{repo}/pulls/12/files', '--paginate', '--jq', '.[].filename');
  assert.equal(files.status, 99);
  assert.match(files.stderr, /no fixture for "api-GET-repos__owner___repo__pulls_12_files"/);
  const tasks = callGh(gh, 'api', 'repos/{owner}/{repo}/contents/openspec/changes/feat/tasks.md?ref=main');
  assert.equal(tasks.status, 99);
  assert.match(tasks.stderr, /no fixture for "api-GET-repos__owner___repo__contents_openspec_changes_feat_tasks.md_ref=main"/);
  gh.prFiles(12, ['a.md', 'b.md']);
  assert.equal(callGh(gh, 'api', 'repos/{owner}/{repo}/pulls/12/files', '--paginate', '--jq', '.[].filename').stdout, 'a.md\nb.md\n');
});

test('field-fixes 4 delivered: isArchiveHead is true for every change\'s archive head and for nothing else', () => {
  assert.equal(typeof DC.isArchiveHead, 'function');
  for (const name of ['chore/archive-foo', 'archive-bar', 'chore/archive-auto-merge']) assert.equal(DC.isArchiveHead(name), true, name);
  for (const name of ['ship/foo', 'fix/archive-foo', 'feat/archive', 'archived-foo', '']) assert.equal(DC.isArchiveHead(name), false, name);
});

test('field-fixes 4 delivered: isOwnPr needs a file of the change folder, no file of its own archive folder and no archive head', () => {
  assert.equal(typeof DC.isOwnPr, 'function');
  const own = (head, files) => DC.isOwnPr('foo', { headRefName: head }, files);
  assert.equal(own('calm-badger', ['openspec/changes/foo/tasks.md']), true);
  assert.equal(own('ship/foo', ['src/a.ts']), false, 'a head naming the change is not proof');
  assert.equal(own('ship/foo', ['openspec/changes/foo-two/tasks.md']), false, 'another change whose id starts the same');
  assert.equal(own('chore/archive-bar', ['openspec/changes/foo/tasks.md']), false, 'an archive head');
  assert.equal(own('ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md']), false, 'it brings its own archive folder');
});

test('field-fixes 4 own archive 1: the change\'s own archive folder refuses its pull request', () => {
  const own = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);
  const tasks = 'openspec/changes/foo/tasks.md';
  assert.equal(own('foo', 'ship/foo', [tasks, 'openspec/changes/archive/2026-11-09-foo/retro.md']), false);
  assert.equal(own('foo', 'ship/foo', [tasks, 'openspec/changes/archive/2026-11-09-foo/specs/cap/spec.md']), false);
});

test('field-fixes 4 own archive 2: another change\'s archived files do not refuse its pull request', () => {
  const own = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);
  const files = ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md'];
  assert.equal(own('foo', 'ship/foo', files), true);
  assert.equal(own('foo', 'calm-badger', [...files, 'openspec/changes/archive/2026-11-01-baz/design.md']), true);
});

test('field-fixes 4 own archive 3: an id that starts another change\'s id is not confused with it', () => {
  const own = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);
  assert.equal(own('foo', 'ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo-two/retro.md']), true);
  assert.equal(own('foo-two', 'ship/foo-two', ['openspec/changes/foo-two/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md']), true);
  assert.equal(own('foo-two', 'ship/foo-two', ['openspec/changes/foo-two/tasks.md', 'openspec/changes/archive/2026-11-09-foo-two/retro.md']), false);
});

test('field-fixes 4 own archive 4: an archive head is refused whatever its files', () => {
  const own = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);
  for (const head of ['chore/archive-bar', 'archive-bar']) {
    assert.equal(own('foo', head, ['openspec/changes/foo/tasks.md']), false, head);
    assert.equal(own('foo', head, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md']), false, head);
  }
});

test('field-fixes 4 own archive 5: a path in no change\'s archive folder does not refuse its pull request', () => {
  const own = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);
  for (const extra of ['openspec/changes/archive/README.md', 'openspec/changes/archive/2026-11-09-foo', 'openspec/changes/archive/foo/retro.md']) {
    assert.equal(own('foo', 'ship/foo', ['openspec/changes/foo/tasks.md', extra]), true, extra);
  }
  assert.equal(own('a.b', 'ship/a.b', ['openspec/changes/a.b/tasks.md', 'openspec/changes/archive/2026-11-09-axb/retro.md']), true, 'the id is no pattern');
  assert.equal(own('a.b', 'ship/a.b', ['openspec/changes/a.b/tasks.md', 'openspec/changes/archive/2026-11-09-a.b/retro.md']), false);
});

test('field-fixes 4 delivered: prFiles reads the files of a pull request by number, paginated, and a failure is an error', () => {
  assert.equal(typeof DC.prFiles, 'function');
  const t = findRepo([]);
  t.gh.prFiles(7, ['a.md', 'dir/b.md']);
  assert.deepEqual(DC.prFiles(t.run, 7), { files: ['a.md', 'dir/b.md'] });
  const call = t.gh.calls().find((c) => c[0] === 'api');
  assert.deepEqual(call, ['api', 'repos/{owner}/{repo}/pulls/7/files', '--paginate', '--jq', '.[].filename']);
  t.gh.set(PR_FILES_KEY(8), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(DC.prFiles(t.run, 8), { error: 'gh: boom' });
});

test('field-fixes 4 delivered: tasksOnDefault reads the tasks left on the default branch, absent on a 404 and an error otherwise', () => {
  assert.equal(typeof DC.tasksOnDefault, 'function');
  const t = findRepo([]);
  t.gh.tasksOnDefault('auto-merge', tasksText({ ticked: ['1.1'], unticked: ['3.1', '3.2'] }));
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { unticked: ['3.1', '3.2'] });
  t.gh.set(TASKS_ON_KEY('auto-merge'), NOT_FOUND);
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { absent: true });
  t.gh.set(TASKS_ON_KEY('auto-merge'), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { error: 'gh: boom' });
});

// A merged-PR list for change `auto-merge` with each PR's files; `find` as findRepo's.
function ownRepo(prs, filesOf) {
  const t = findRepo(prs);
  for (const p of prs) t.gh.prFiles(p.number, filesOf[p.number] ?? []);
  return t;
}
const FOLDER_TASKS = 'openspec/changes/auto-merge/tasks.md';

test('field-fixes 4 delivered: a body that links the evidence is not the change\'s own pull request', () => {
  const t = ownRepo([AUTO], { 5: ['docs/auto-merge.md'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: another change\'s archive pull request that names the change is not its own', () => {
  const bar = { ...AUTO, number: 7, headRefName: 'chore/archive-bar', body: 'Archive bar. Mentions auto-merge: openspec/changes/auto-merge/evidence.md\n' };
  const t = ownRepo([bar], { 7: ['openspec/changes/archive/2026-11-09-bar/retro.md', 'openspec/changes/bar/tasks.md'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: an unrelated head that ends in the id and touches no file of the change is not its own', () => {
  const fix = { ...AUTO, number: 8, headRefName: 'fix/auto-merge', body: '' };
  const t = ownRepo([fix], { 8: ['src/auto-merge.ts'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: a head that does not name the change is its own when it changes a file of the change folder', () => {
  const calm = { ...AUTO, number: 9, headRefName: 'calm-badger', body: '' };
  const t = ownRepo([calm], { 9: [FOLDER_TASKS, 'src/a.ts'] });
  const found = t.find('main');
  assert.equal(found.pr?.number, 9, JSON.stringify(found));
  assert.equal(found.via, 'list');
});

test('field-fixes 4 delivered: among several own pull requests the newest mergedAt wins, and a body link is not proof', () => {
  const older = { ...AUTO, number: 3, mergedAt: '2026-11-01T00:00:00Z' };
  const newer = { ...AUTO, number: 4, body: '', headRefName: 'calm-badger', mergedAt: '2026-11-12T00:00:00Z' };
  const t = ownRepo([older, newer], { 3: [FOLDER_TASKS], 4: [FOLDER_TASKS] });
  assert.equal(t.find('main').pr.number, 4);
});

test('field-fixes 4 delivered: a files read that fails is an error, never a silent miss', () => {
  const t = findRepo([AUTO]);
  t.gh.set(PR_FILES_KEY(5), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

test('field-fixes 4 own archive 6: findChangePr finds the change\'s own merged pull request that also edits another change\'s archive', () => {
  const pr = { ...AUTO, number: 11, headRefName: 'calm-badger', body: '' };
  const t = ownRepo([pr], { 11: [FOLDER_TASKS, 'openspec/changes/archive/2026-11-09-bar/retro.md'] });
  const found = t.find('main');
  assert.equal(found.pr?.number, 11, JSON.stringify(found));
  assert.equal(found.via, 'list');
  const own = ownRepo([pr], { 11: [FOLDER_TASKS, 'openspec/changes/archive/2026-11-09-auto-merge/retro.md'] });
  assert.deepEqual(own.find('main'), { none: true }, 'its own archive folder still refuses it');
});

// ---- the delivery through the collector and the next step

const FEAT_TASKS = 'openspec/changes/feat/tasks.md';

test('field-fixes 4 delivered: with tasks left on the default branch the change\'s own merged PR leads to no archive step, and stop-branch names the PR, the tasks and the branch', () => {
  const t = pm();
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1', '3.2'] }));
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), OKRUN('devkit-reviews')])); // every required check was green: not an owner's forced merge
  const s = t.state();
  assert.ok(!s.archive, 'no archive facts: the change is not delivered');
  const n = nextStep(s);
  assert.equal(n.step, 'stop-branch');
  assert.equal(n.reason, 'PR #12 of feat merged with tasks left (3.1, 3.2); continue on branch feat and open a further pull request');
  assert.deepEqual([n.number, n.tasks], [12, ['3.1', '3.2']]);
  assert.equal(t.json().next.step, 'stop-branch');
});

test('field-fixes 4 delivered: a pull request that only links the evidence leads to no archive step', () => {
  const t = pm();
  t.gh.prFiles(12, ['docs/notes.md']);
  const s = t.state();
  assert.ok(!s.archive);
  const n = nextStep(s);
  assert.equal(n.step, 'stop-branch');
  assert.doesNotMatch(n.reason, /merged with tasks left/);
});

test('field-fixes 4 delivered: another change\'s archive pull request that names the change leads to no archive step', () => {
  const bar = mergedPr({ number: 13, headRefName: 'chore/archive-bar' });
  const t = pm({ mergedPrs: [bar] });
  t.gh.prFiles(13, ['openspec/changes/archive/2026-11-09-bar/retro.md']);
  assert.ok(!t.state().archive);
  assert.equal(t.next().step, 'stop-branch');
});

test('field-fixes 4 delivered: on the change\'s branch with the work ticked and no open pull request the step is open-pr', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  t.gh.set('pr-list', { stdout: [] });
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), OKRUN('devkit-reviews')])); // every required check was green: not an owner's forced merge
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.ok(!s.archive);
  assert.equal(nextStep(s).step, 'open-pr');
});

test('field-fixes 4 delivered: a further open pull request on the same head after a merge with tasks left is the pull request, not open-pr', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  const further = prJson({ number: 15, state: 'OPEN', headRefOid: head(t.root), body: PR_BODY });
  t.gh.set('pr-list', { stdout: [further] });
  // Merged #12 has a task left and a required check red: still no forced merge while a further pull request is open (it is not delivered).
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.pr.number, 15, 'the open pull request of the same head is the pull request');
  assert.notEqual(nextStep(s).step, 'open-pr');
  assert.equal(s.forced, null);
  assert.equal(s.unreadMerge, null);
  assert.equal(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, 'no pr view 12 call: the rollup is not read');
});

test('field-fixes 4 delivered: with no open pull request on the head after a merge with tasks left, the answer names the merged one and the tasks', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  t.gh.set('pr-list', { stdout: [] });
  const r = findChangePr(makeGh(t.root, t.env), t.root, 'feat', { ship: 'merge', branch: 'feat', env: t.env });
  assert.equal(r.none, true);
  assert.equal(r.mergedBefore, 12);
  assert.equal(r.merged.number, 12, 'the merged pull request itself, so the delivery judges it without a second lookup');
  assert.deepEqual(r.tasks.unticked, ['3.1']);
});

test('field-fixes 4 delivered: with every task ticked on the default branch the change\'s own merged PR answers the retro, even a further PR whose head does not name the change', () => {
  const first = mergedPr({ number: 12, mergedAt: '2026-11-09T14:56:00Z' });
  const further = mergedPr({ number: 14, headRefName: 'calm-badger', body: '', mergedAt: '2026-11-12T10:00:00Z' });
  const t = pm({ mergedPrs: [first, further] });
  t.gh.prFiles(12, [FEAT_TASKS]);
  t.gh.prFiles(14, [FEAT_TASKS]);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '3.1'] }));
  const s = t.state();
  assert.equal(s.pr.number, 14);
  assert.equal(nextStep(s).step, 'retro');
});

test('field-fixes 4 delivered: a tasks.md absent on the default branch is not delivered, and one that cannot be read blocks the pull request item', () => {
  const absent = pm();
  absent.gh.prFiles(12, [FEAT_TASKS]);
  absent.gh.set(TASKS_ON_KEY('feat'), NOT_FOUND);
  assert.ok(!absent.state().archive);
  const broken = pm();
  broken.gh.prFiles(12, [FEAT_TASKS]);
  broken.gh.set(TASKS_ON_KEY('feat'), { exit: 1, stderr: 'gh: boom\n' });
  const s = broken.state();
  assert.ok(!s.archive);
  assert.equal(s.items[4].status, 'blocked');
  assert.match(s.items[4].reason, /gh: boom/);
});

// ---- field-fixes 10: a verdict file is read from its first Verdict line (spec verdict-files, design D-3)
const SECOND = (verdict) => `\n\n### Findings\nVerdict: ${verdict}`;

test('field-fixes 10 verdict: item 2 counts the first Verdict line, approved then rejected, and prints nothing about the second (AC-3)', () => {
  const t = shipRepo();
  put(t.root, withReviews(reviews(head(t.root), { 'test-coverage-reviewer': review('approved', head(t.root), SECOND('rejected')) })));
  commitAll(t.root, 'reviews');
  const r = runCli(t, ['feat']);
  const line = r.out.split('\n').find((l) => /^ {2}2 /.test(l));
  assert.match(line, /^ {2}2 met\s/, r.out);
  assert.doesNotMatch(r.out + r.err, /rejected/);
  assert.deepEqual(JSON.parse(runCli(t, ['feat', '--json']).out).items[1].details.rejected, []);
});

test('field-fixes 10 verdict: item 2 counts the first Verdict line, rejected then approved, and reports the reviewer as rejected (AC-3)', () => {
  const t = shipRepo();
  put(t.root, withReviews(reviews(head(t.root), { 'test-coverage-reviewer': review('rejected', head(t.root), SECOND('approved')) })));
  commitAll(t.root, 'reviews');
  const it = JSON.parse(runCli(t, ['feat', '--json']).out).items[1];
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.rejected, ['test-coverage-reviewer']);
  assert.deepEqual(it.details.missing, []);
});

test('field-fixes 10 verdict: the devkit-reviews check from both entries passes on approved then rejected and fails on the reverse naming the reviewer (AC-3)', () => {
  const rewrite = (first, second) => {
    const root = ciRepo();
    const sha = head(root);
    put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': review(first, sha, SECOND(second)) });
    commitAll(root, 'rewrite one reviewer');
    return root;
  };
  for (const r of bothEntries(rewrite('approved', 'rejected'))) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.doesNotMatch(r.out + r.err, /rejected/);
  }
  for (const r of bothEntries(rewrite('rejected', 'approved'))) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
  }
});

// ---- review-writer-prompt D-8: a checkbox inside a fenced block is not a task (spec change-delivery)

const FENCE = '`'.repeat(3);
const fencedTasks = (fence, inner) => `# Tasks\n\n## 1. First\n\n- [x] 1.1 code\n- [x] 1.2 Gate: \`node -e 0\` green\n\n${fence}md\n${inner}\n${fence}\n`;

test('review-writer-prompt AC-9 an unticked checkbox inside a backtick fence is not a task of the delivery checker', () => {
  const text = fencedTasks(FENCE, '- [ ] 1.9 example task');
  assert.deepEqual(parseTasks(text).map((t) => t.id), ['1.1', '1.2']);
  const root = gitRepo({ changes: { feat: { 'tasks.md': text } }, files: { 'src/a.ts': 'a\n' } });
  const r = tasksItem(root, 'feat', gitFacts(root));
  assert.deepEqual(r.details.unticked ?? [], [], r.reason);
  assert.doesNotMatch(r.reason, /unticked/);
});

test('review-writer-prompt AC-9 a gate inside a fence has no command to run and is not a gate of any phase', () => {
  const text = fencedTasks(FENCE, '- [ ] 9.9 Gate: run it');
  const tasks = parseTasks(text);
  assert.ok(!tasks.some((t) => t.id === '9.9'));
  const root = gitRepo({ changes: { feat: { 'tasks.md': text } } });
  const phases = readPhases(join(root, 'openspec/changes/feat/tasks.md'));
  assert.ok(!phases.some((p) => p.gate?.id === '9.9'), JSON.stringify(phases));
  assert.doesNotMatch(tasksItem(root, 'feat', gitFacts(root)).reason, /9\.9|without a command/);
});

test('review-writer-prompt AC-9 a tilde fence hides the checkbox too, and a fenced heading does not start a phase', () => {
  const text = fencedTasks('~~~~', '## 7. Fenced phase\n- [ ] 7.1 example');
  assert.deepEqual(parseTasks(text).map((t) => [t.phase, t.id]), [[1, '1.1'], [1, '1.2']]);
});

test('review-writer-prompt AC-9 a checkbox after the closing fence is counted', () => {
  const text = `${fencedTasks(FENCE, '- [ ] 1.9 example')}\n- [ ] 1.3 real task\n`;
  assert.deepEqual(parseTasks(text).filter((t) => !t.done).map((t) => t.id), ['1.3']);
});

test('review-writer-prompt AC-9 a fenced unticked line on the default branch still answers the retro', () => {
  const t = pm();
  t.gh.prFiles(12, [FEAT_TASKS]);
  t.gh.tasksOnDefault('feat', fencedTasks(FENCE, '- [ ] 1.9 example'));
  const s = t.state();
  assert.equal(nextStep(s).step, 'retro');
});

test('review-writer-prompt AC-9 fencedLines is exported by deliver-check.mjs and flow-check.mjs holds no copy', () => {
  assert.equal(typeof DC.fencedLines, 'function');
  assert.deepEqual([...DC.fencedLines('a\n```\nb\n```\nc\n')], [2, 3, 4]);
  const flow = readFileSync(join(here, 'flow-check.mjs'), 'utf8');
  assert.doesNotMatch(flow, /function fencedLines/);
  assert.match(flow, /fencedLines[^;]*from '\.\/deliver-check\.mjs'/s);
});

// ---- review-writer-prompt D-8: an unclosed fence hides nothing (spec change-delivery, review round 1)

const UNCLOSED = `# Tasks\n\n## 1. First\n\n- [x] 1.1 code\n${FENCE}md\n- [ ] 1.2 more\n- [ ] 1.3 Gate: \`node -e 0\` green\n`;

test('review-writer-prompt AC-9 fencedLines: an opening line with no closing line opens no fence', () => {
  assert.deepEqual([...DC.fencedLines(UNCLOSED)], []);
  assert.deepEqual([...DC.fencedLines('a\n```\nb\nc\n')], []);
});

test('review-writer-prompt AC-9 fencedLines: a closed fence after an unclosed one still hides its own lines', () => {
  assert.deepEqual([...DC.fencedLines('a\n```\nb\n~~~\nc\n~~~\nd\n')], [4, 5, 6]);
});

test('review-writer-prompt AC-9 parseTasks counts the task and the gate after an unclosed fence', () => {
  assert.deepEqual(parseTasks(UNCLOSED).map((t) => [t.id, t.done, t.isGate]), [['1.1', true, false], ['1.2', false, false], ['1.3', false, true]]);
});

test('review-writer-prompt AC-9 readPhases gives the gate after an unclosed fence to its phase', () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': UNCLOSED } } });
  const [p] = readPhases(join(root, 'openspec/changes/feat/tasks.md'));
  assert.deepEqual(p.open, ['1.2']);
  assert.equal(p.gate?.id, '1.3');
  assert.equal(p.gate?.command, 'node -e 0');
});

test('review-writer-prompt AC-9 tasksItem lists the tasks after an unclosed fence as unticked', () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': UNCLOSED } }, files: { 'src/a.ts': 'a\n' } });
  const r = tasksItem(root, 'feat', gitFacts(root));
  assert.notEqual(r.status, 'met', r.reason);
  assert.deepEqual(r.details.unticked, ['1.2', '1.3']);
});

test('review-writer-prompt AC-9 nextStep is implement and names 1.2 after an unclosed fence', () => {
  const t = planRepo({ tasks: UNCLOSED, approval: approvalMd });
  const n = nextStep(t.state());
  assert.equal(n.step, 'implement');
  assert.match(n.reason, /1\.2/);
});

test('review-writer-prompt AC-9 the stage checker counts the tasks after an unclosed fence as pending', () => {
  const lines = UNCLOSED.split('\n');
  const at = (needle) => lines.findIndex((l) => l.includes(needle)) + 1;
  const open = [{ id: '1.1', line: at('1.1'), done: true }, { id: '1.2', line: at('1.2'), done: false }, { id: '1.3', line: at('1.3'), done: false }];
  assert.deepEqual(pendingTasks(open, UNCLOSED).map((t) => t.id), ['1.2', '1.3']);
});

// ---- review-writer-prompt D-6: test files and the scoped staleness (spec verdict-files)

const SIX = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer', 'code-quality-reviewer', 'test-coverage-reviewer'];
const TEST_READERS = ['code-quality-reviewer', 'test-coverage-reviewer'];
const sixAt = (root, sha = head(root)) => put(root, withReviews(Object.fromEntries(SIX.map((n) => [n, review('approved', sha)]))));
const staleOf = (root) => reviewsItem(root, 'feat', gitFacts(root)).details.stale.slice().sort();
// A repo whose six reviewers are recorded and committed at the commit before the head.
function sixRepo() {
  const root = base();
  sixAt(root);
  commitAll(root, 'reviews');
  return root;
}
const testOnlyCommit = (root, files = { 'src/a.test.ts': 't\n' }) => {
  put(root, { ...files, 'openspec/changes/feat/tasks.md': '- [x] 1.1 a\n- [x] 1.2 b\n' });
  return commitAll(root, 'tests only');
};

test('review-writer-prompt AC-8 isTestFile names the test paths of the spec and refuses the others', () => {
  for (const p of ['src/a.test.ts', 'plugins/x/b.spec.mjs', 'test/c.js', 'pkg/tests/d.py', 'src/__tests__/e.tsx', 'plugins/panel/hooks/fixtures/f.json']) assert.equal(DC.isTestFile(p), true, p);
  for (const p of ['src/a.ts', 'src/testing/b.ts', 'src/latest.ts', 'docs/spec.md', 'openspec/specs/x/spec.md', 'src/contest/c.ts']) assert.equal(DC.isTestFile(p), false, p);
  assert.deepEqual(DC.TEST_SPARED_REVIEWERS, ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer']);
});

test('review-writer-prompt AC-8 a commit of tests only stales only the two reviewers that read tests', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  assert.deepEqual(staleOf(root), [...TEST_READERS].sort());
});

test('review-writer-prompt AC-8 after a test-only commit the evidence goes stale first, then the review step names the two reviewers', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  fullEvidence(t.root, t.env);
  put(t.root, withReviews(Object.fromEntries(SIX.map((n) => [n, review('approved', head(t.root))]))));
  commitAll(t.root, 'reviews');
  assert.equal(t.next().step, 'open-pr', 'control: everything current');
  put(t.root, { 'tests/b.mjs': 't\n' });
  commitAll(t.root, 'tests only');
  assert.equal(t.next().step, 'verify', 'the evidence is stale before any review');
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', TEST_READERS]);
});

test('review-writer-prompt AC-8 the evidence keeps the default rule and goes stale after a test-only commit', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  put(t.root, { 'tests/b.mjs': 't\n' });
  commitAll(t.root, 'tests only');
  assert.deepEqual(bothEvidenceCurrent(t), ['stale', 'stale']);
});

test('review-writer-prompt AC-8 a product commit later in the range stales all six reviewers', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'product');
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 a commit that mixes a test file and a product file stales all six', () => {
  const root = sixRepo();
  put(root, { 'src/a.test.ts': 't\n', 'src/a.ts': 'changed\n' });
  commitAll(root, 'mixed');
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 an uncommitted product edit stales all six after a test-only commit', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  put(root, { 'src/a.ts': 'edited, not committed\n' });
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 a reviewer outside the six keeps the default rule', () => {
  const root = base();
  put(root, withReviews({ 'perf-reviewer': review('approved', head(root)), ...reviews(head(root)) }));
  commitAll(root, 'reviews');
  testOnlyCommit(root);
  assert.deepEqual(staleOf(root), ['code-quality-reviewer', 'perf-reviewer', 'test-coverage-reviewer']);
});

test('review-writer-prompt AC-8 staleness takes an allowed option and keeps the default without it', () => {
  const root = base();
  const sha = head(root);
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests');
  const recorded = parseCommitLine(`Commit: ${sha}\n`);
  assert.match(staleness(root, recorded, gitFacts(root)), /touches src\/a\.test\.ts/);
  assert.equal(staleness(root, recorded, gitFacts(root), { allowed: (p) => p.startsWith('openspec/') || DC.isTestFile(p) }), null);
});

test('review-writer-prompt AC-8 a merge whose first-parent diff is only test files is current with allowed and stale without it', () => {
  const { root, R } = mergeHistory((r) => { put(r, { 'src/a.test.ts': 't\n' }); commitAll(r, 'tests only on main'); }, mergeMain);
  const recorded = parseCommitLine(`Commit: ${R}\n`);
  assert.match(git(root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), /^src\/a\.test\.ts$/m);
  assert.match(staleness(root, recorded, gitFacts(root)), /touches src\/a\.test\.ts/);
  assert.equal(staleness(root, recorded, gitFacts(root), { allowed: (p) => p.startsWith('openspec/') || DC.isTestFile(p) }), null);
});

test('review-writer-prompt AC-8 the devkit-reviews check from both entries names only the two reviewers after a test-only commit', () => {
  const root = ciRepo();
  const sha = head(root);
  put(root, Object.fromEntries(SIX.map((n) => [`openspec/changes/feat/reviews/${n}.md`, review('approved', sha)])));
  commitAll(root, 'six reviews');
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  const at = head(root);
  put(root, { 'openspec/changes/feat/evidence.md': `Commit: ${at}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}` });
  commitAll(root, 'evidence again');
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /stale code-quality-reviewer/);
    assert.match(r.out, /stale test-coverage-reviewer/);
    assert.doesNotMatch(r.out, /stale (spec|adr|architecture|security)-reviewer/);
  }
});

// ---- review-openspec-fix: a rejected verdict and the change's review record (spec verdict-files)

// base(); A = head; the two readers recorded at A (over: `{ name: verdict }`), committed with nothing else.
function rejectedRepo(over = { 'code-quality-reviewer': 'rejected' }) {
  const root = base();
  const A = head(root);
  const verdicts = { 'code-quality-reviewer': 'approved', 'test-coverage-reviewer': 'approved', ...over };
  put(root, withReviews(Object.fromEntries(Object.entries(verdicts).map(([n, v]) => [n, review(v, A)]))));
  commitAll(root, 'review round');
  return { root, A };
}
// A fix committed in the plan files (or in `path`).
function planFix(root, path = 'openspec/changes/feat/design.md') {
  put(root, { [path]: 'fixed\n' });
  return commitAll(root, 'plan fix');
}
const itemTwo = (root) => reviewsItem(root, 'feat', gitFacts(root));
const NOTED = (A) => `${review('rejected', A)}- [nit] noted\n`;

test('review-openspec-fix 1: a rejected verdict is stale after a commit that touches only openspec/ outside the change\'s review record', () => {
  const { root, A } = rejectedRepo();
  assert.deepEqual(itemTwo(root).details.stale, [], 'control: current before the fix');
  const D = planFix(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(D)}, which touches openspec/changes/feat/design.md)`), r.reason);
});

test('review-openspec-fix 2: a commit of the change\'s reviews/ folder only leaves a rejected verdict current', () => {
  const { root, A } = rejectedRepo();
  put(root, withReviews({ 'code-quality-reviewer': NOTED(A) }));
  commitAll(root, 'record again');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/reviews/code-quality-reviewer.md');
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, []);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
});

test('review-openspec-fix 3: a commit of review.md only leaves a rejected verdict current', () => {
  const { root } = rejectedRepo();
  put(root, { 'openspec/changes/feat/review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n' });
  commitAll(root, 'review.md');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/review.md');
  assert.deepEqual(itemTwo(root).details.stale, []);
});

test('review-openspec-fix 4: a commit of evidence.md only leaves a rejected verdict current', () => {
  const { root, A } = rejectedRepo();
  put(root, { 'openspec/changes/feat/evidence.md': `Commit: ${A}\n\n# Evidence\n` });
  commitAll(root, 'evidence');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/evidence.md');
  assert.deepEqual(itemTwo(root).details.stale, []);
});

test('review-openspec-fix 5: a commit of the record together with another openspec/ file makes a rejected verdict stale and names that file', () => {
  const { root, A } = rejectedRepo();
  put(root, { ...withReviews({ 'code-quality-reviewer': NOTED(A) }), 'openspec/changes/feat/tasks.md': '- [x] 1.1 a\n- [x] 1.2 b\n' });
  const C = commitAll(root, 'record and a fix');
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(C)}, which touches openspec/changes/feat/tasks.md)`), r.reason);
});

test('review-openspec-fix 6: paths that only look like the change\'s review record make a rejected verdict stale', () => {
  for (const p of [
    'openspec/changes/other/reviews/code-quality-reviewer.md',
    'openspec/changes/feat/reviews.md',
    'openspec/changes/feat/reviewsx/a.md',
    'openspec/changes/featx/review.md',
    'openspec/changes/feat/proof/evidence.md',
  ]) {
    const { root } = rejectedRepo();
    planFix(root, p);
    const r = itemTwo(root);
    assert.deepEqual(r.details.stale, ['code-quality-reviewer'], p);
    assert.ok(r.reason.includes(`which touches ${p}`), `${p}: ${r.reason}`);
  }
});

test('review-openspec-fix 7: a test-spared reviewer\'s rejected verdict is stale after a commit of test files only, and its approved peers stay current', () => {
  const root = base();
  const A = head(root);
  put(root, withReviews(Object.fromEntries(SIX.map((n) => [n, review(n === 'spec-reviewer' ? 'rejected' : 'approved', A)]))));
  commitAll(root, 'review round');
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  assert.deepEqual(staleOf(root), ['code-quality-reviewer', 'spec-reviewer', 'test-coverage-reviewer']);
});

test('review-openspec-fix 8: a verdict file with no Verdict line is stale after an openspec/-only commit', () => {
  const root = base();
  const A = head(root);
  put(root, withReviews(reviews(A, { 'code-quality-reviewer': `Commit: ${A}\n\n# Review\n` })));
  commitAll(root, 'review round');
  planFix(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
});

test('review-openspec-fix 9: a rejecting reviewer outside the six is stale after an openspec/-only commit', () => {
  const { root } = rejectedRepo({ 'perf-reviewer': 'rejected' });
  planFix(root);
  assert.deepEqual(itemTwo(root).details.stale, ['perf-reviewer']);
});

test('review-openspec-fix 10: approved and declined verdicts stay current after an openspec/-only commit outside the record', () => {
  const { root } = rejectedRepo({ 'code-quality-reviewer': 'approved', 'security-reviewer': 'declined' });
  planFix(root);
  const r = itemTwo(root);
  assert.equal(r.status, 'met', r.reason);
  assert.deepEqual(r.details.stale, []);
});

test('review-openspec-fix 11: a test-spared reviewer\'s approved verdict stays current after a commit of test files only', () => {
  const root = sixRepo();
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  assert.deepEqual(staleOf(root), [...TEST_READERS].sort());
});

test('review-openspec-fix 12: a plan fix written and not committed leaves a rejected verdict current and hands it to commit', () => {
  const { root } = rejectedRepo();
  put(root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  assert.deepEqual(itemTwo(root).details.stale, []);
  const t = readyRepo();
  rejectedLoop(t);
  commitAll(t.root, 'review round');
  put(t.root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  assert.deepEqual(reviewsItem(t.root, 'feat', gitFacts(t.root)).details.stale, []);
  const n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', ['openspec/changes/feat/design.md']]);
});

test('review-openspec-fix 13: a merge of main that brings only openspec/ makes a rejected verdict stale and names the merge', () => {
  const root = base();
  git(root, 'switch', '-q', '-c', 'feat');
  const A = head(root);
  put(root, withReviews(reviews(A, { 'code-quality-reviewer': review('rejected', A) })));
  commitAll(root, 'review round');
  git(root, 'switch', '-q', 'main');
  onlyOpenspec(root);
  git(root, 'switch', '-q', 'feat');
  mergeMain(root);
  const M = head(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(M)}, which touches openspec/changes/other.md)`), r.reason);
});

// The loop on a ready change: A = head, a rejecting round recorded and committed (record only).
function rejectedLoop(t, reviewMd = '# Review: feat\n\nConsensus: FAIL (round 1/2)\n') {
  const A = head(t.root);
  put(t.root, withReviews({ 'code-quality-reviewer': review('rejected', A), 'test-coverage-reviewer': review('approved', A) }));
  put(t.root, changeFiles({ 'review.md': reviewMd }));
  return A;
}

test('review-openspec-fix 14: a rejected round fixed by an openspec/-only commit gets review at round 2 naming only the rejecting reviewer', () => {
  const t = readyRepo();
  rejectedLoop(t);
  commitAll(t.root, 'review round');
  const first = t.next();
  assert.deepEqual([first.step, first.reviewers], ['fix-review', ['code-quality-reviewer']]);
  put(t.root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  commitAll(t.root, 'plan fix');
  assert.equal(git(t.root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/design.md');
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 2, ['code-quality-reviewer']]);
});

test('review-openspec-fix 15: committing a rejecting round\'s record alone, twice, keeps fix-review', () => {
  const t = readyRepo();
  rejectedLoop(t);
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'review round');
  let n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['fix-review', ['code-quality-reviewer']]);
  put(t.root, changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nNext: fix.\n' }));
  commitAll(t.root, 'review.md again');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['fix-review', ['code-quality-reviewer']]);
  const paths = git(t.root, 'diff', '--name-only', 'HEAD~2', 'HEAD').split('\n');
  assert.ok(paths.every((p) => p.startsWith('openspec/changes/feat/reviews/') || p === 'openspec/changes/feat/review.md' || p === 'openspec/changes/feat/evidence.md'), paths.join(', '));
});

const FAIL_TWICE = '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nConsensus: FAIL (round 2/2)\n';

test('review-openspec-fix 16: a round-2 rejection committed with its record stops on stop-review-deadlock', () => {
  const t = readyRepo();
  rejectedLoop(t, FAIL_TWICE);
  commitAll(t.root, 'review round 2');
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['stop-review-deadlock', ['code-quality-reviewer']]);
});

test('review-openspec-fix 17: after the round-2 stop, an openspec/-only commit opens a review at round 1, as a product commit does', () => {
  const t = readyRepo();
  rejectedLoop(t, FAIL_TWICE);
  commitAll(t.root, 'review round 2');
  assert.equal(t.next().step, 'stop-review-deadlock', 'control');
  planFix(t.root);
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 1, ['code-quality-reviewer']]);
});

test('review-openspec-fix 18: the devkit-reviews check fails a rejected review after an openspec/-only fix and names it stale', () => {
  const root = ciRepo();
  const A = head(root);
  put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': review('rejected', A) });
  commitAll(root, 'rejecting round');
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
    assert.doesNotMatch(r.out, /stale test-coverage-reviewer/);
  }
  planFix(root);
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
    assert.match(r.out, /stale test-coverage-reviewer \(/);
  }
});

// ================================================================ jira-entry-followups D-2: a plan fix reaches commit (AC-3, AC-4)

const PLAN_FILE = 'openspec/changes/feat/design.md';

test('jira-entry-followups AC-3 a plan fix edited after a rejecting round is handed to commit, not fix-review', () => {
  const t = readyRepo();
  rejectedLoop(t);
  commitAll(t.root, 'review round');
  assert.equal(t.next().step, 'fix-review', 'control: the rejecting round is committed');
  put(t.root, { [PLAN_FILE]: 'fixed\n' });
  const n = t.next();
  assert.equal(n.step, 'commit', n.reason);
  assert.deepEqual(n.paths, [PLAN_FILE]);
});

// A readyRepo whose code-quality-reviewer rejected at A with the record committed, round 1 of 2.
function roundOneRejected(reviewMd) {
  const t = readyRepo();
  rejectedLoop(t, reviewMd);
  commitAll(t.root, 'review round');
  return t;
}
// A readyRepo whose test-coverage-reviewer approved at A and lists `line` as a finding, the record committed.
function approvedWithFinding(line = '- [important] x\n') {
  const t = readyRepo();
  const A = head(t.root);
  put(t.root, withReviews({ 'code-quality-reviewer': review('approved', A), 'test-coverage-reviewer': `${review('approved', A)}${line}` }));
  commitAll(t.root, 'review round');
  return t;
}

test('jira-entry-followups AC-3 an approved verdict\'s undisposed finding fixed in the plan is handed to commit', () => {
  const t = approvedWithFinding();
  const control = t.next();
  assert.deepEqual([control.step, control.reviewers], ['fix-review', ['test-coverage-reviewer']]);
  put(t.root, { [PLAN_FILE]: 'fixed\n' });
  const n = t.next();
  assert.equal(n.step, 'commit', n.reason);
  assert.deepEqual(n.paths, [PLAN_FILE]);
});

const RECORD_EDITS = {
  'reviews/code-quality-reviewer.md': (A) => `${review('rejected', A)}- [nit] noted\n`,
  'review.md': () => '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nNext: fix.\n',
  'evidence.md': (A, t) => `${readFileSync(join(t.root, 'openspec/changes/feat/evidence.md'), 'utf8')}\nnote\n`,
};
for (const [file, content] of Object.entries(RECORD_EDITS)) {
  test(`jira-entry-followups AC-3 only the review record uncommitted keeps fix-review: ${file}`, () => {
    const t = roundOneRejected();
    const A = git(t.root, 'rev-parse', 'HEAD~1');
    put(t.root, { [`openspec/changes/feat/${file}`]: content(A, t) });
    const n = t.next();
    assert.deepEqual([n.step, n.reviewers], ['fix-review', ['code-quality-reviewer']]);
  });
}

test('jira-entry-followups AC-3 a plan edit after the round-2 stop still stops', () => {
  const t = roundOneRejected(FAIL_TWICE);
  assert.equal(t.next().step, 'stop-review-deadlock', 'control');
  put(t.root, { [PLAN_FILE]: 'fixed\n' });
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['stop-review-deadlock', ['code-quality-reviewer']]);
});

test('jira-entry-followups AC-3 a plan edit with nothing to fix is not a commit step', () => {
  const t = readyRepo();
  assert.equal(t.next().step, 'ready', 'control');
  put(t.root, { [PLAN_FILE]: 'edited\n' });
  // The step is the one item 5 already gave for uncommitted files in the change folder (push), not the new commit row.
  const n = t.next();
  assert.equal(n.step, 'push', n.reason);
  assert.equal(n.paths, undefined);
});

test('jira-entry-followups AC-4 the committed plan fix gets review at round 2, never fix-review again', () => {
  const t = roundOneRejected();
  assert.equal(t.next().step, 'fix-review', 'control');
  put(t.root, { [PLAN_FILE]: 'fixed\n' });
  assert.equal(t.next().step, 'commit');
  commitAll(t.root, 'plan fix');
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 2, ['code-quality-reviewer']]);
});

test('jira-entry-followups AC-4 an approved verdict with an undisposed finding goes stale after a plan commit, and its record alone keeps it', () => {
  const t = approvedWithFinding();
  const A = git(t.root, 'rev-parse', 'HEAD~1');
  const recordOnly = approvedWithFinding();
  put(recordOnly.root, withReviews({ 'test-coverage-reviewer': `${review('approved', git(recordOnly.root, 'rev-parse', 'HEAD~1'))}- [important] x\n- [nit] noted\n` }));
  commitAll(recordOnly.root, 'record again');
  const kept = DC.readReviews(recordOnly.root, 'feat').find((r) => r.name === 'test-coverage-reviewer');
  assert.equal(kept.why, null, 'a commit of the record alone keeps it current');
  assert.deepEqual([recordOnly.next().step, recordOnly.next().reviewers], ['fix-review', ['test-coverage-reviewer']]);
  const D = planFix(t.root);
  const stale = DC.readReviews(t.root, 'feat').find((r) => r.name === 'test-coverage-reviewer');
  assert.ok(stale.why.includes(`${s7(A)} is behind ${s7(D)}, which touches ${PLAN_FILE}`), stale.why);
  assert.equal(DC.readReviews(t.root, 'feat').find((r) => r.name === 'code-quality-reviewer').why, null, 'the reviewer with no finding keeps the approved rule');
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', ['test-coverage-reviewer']]);
});

for (const [kind, line] of [['fixed in a commit of the history', (A) => `- [important] x · fixed in ${A}\n`], ['refuted', () => '- [important] x · refuted: the test shows it\n']]) {
  test(`jira-entry-followups AC-4 a disposed finding keeps the approved rule: ${kind}`, () => {
    const root = base();
    const A = head(root);
    put(root, withReviews({ 'code-quality-reviewer': review('approved', A), 'test-coverage-reviewer': `${review('approved', A)}${line(A)}` }));
    commitAll(root, 'review round');
    planFix(root);
    assert.deepEqual(itemTwo(root).details.stale, []);
  });
}

test('jira-entry-followups AC-4 a test-spared reviewer\'s approved verdict with an undisposed finding goes stale after a test-only commit', () => {
  const root = base();
  const A = head(root);
  put(root, withReviews({ 'spec-reviewer': `${review('approved', A)}- [important] x\n`, 'adr-reviewer': review('approved', A) }));
  commitAll(root, 'review round');
  testOnlyCommit(root);
  assert.deepEqual(staleOf(root), ['spec-reviewer']);
});

test('jira-entry-followups docs: the ship-change commit row and the flow document name the commit of a plan fix', () => {
  const md = shipSkill();
  assert.match(skillRow(md, 'commit'), /`next\.paths` lists the paths outside `openspec\/`, or, after a review asked for a fix, the change folder's own files the fix left uncommitted; the rest of the change folder and `openspec\/config\.yaml` are staged from `git status`/);
  assert.doesNotMatch(skillRow(md, 'commit'), /lists only the paths outside/);
  const fix = skillRow(md, 'fix-review');
  assert.match(fix, /Then run the loop again: it hands `commit` for what the fix left uncommitted \(or `push` once a PR exists\)/);
  assert.match(fix, /approved review/, 'the words the review-round test pins');
  const flow = readFileSync(join(repoRoot, 'docs', 'openspec-flow.md'), 'utf8');
  const rule = flow.split('\n').find((l) => l.startsWith('**The `Commit:` staleness rule.**')) ?? '';
  assert.match(rule, /an approved or declined verdict that lists an undisposed `blocking` or `important` finding \(no `fixed in <sha>` of a commit in the history of the head, no `refuted:`\), follows the same narrower rule/);
  assert.match(rule, /and `next` stays on `fix-review` while only the record is uncommitted; a plan file edited and not committed is handed to `commit` first/);
  const order = flow.split('\n').find((l) => l.startsWith('**Order of the delivery steps.**')) ?? '';
  assert.match(order, /`commit` for a plan fix before `fix-review`/);
  const review = readFileSync(join(repoRoot, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'), 'utf8');
  assert.match(review, /for a rejected verdict, or an approved one that still lists an undisposed finding, anything outside the change's own review record/);
});

// ================================================================ commit-attribution (D-7, T26 to T36)

const attributionOfAgent = () => {
  const md = coreAgent('commit-and-pr');
  const a = md.indexOf('## Attribution');
  const b = md.indexOf('## Escalate');
  return a >= 0 && b > a ? md.slice(a, b) : '';
};
const methodOfAgent = () => {
  const md = coreAgent('commit-and-pr');
  return md.slice(md.indexOf('## Method'), md.indexOf('## Attribution'));
};

test('commit-attribution AC-2 T26 the agent\'s Receives names the attribution block', () => {
  const md = coreAgent('commit-and-pr');
  const receives = md.slice(md.indexOf('## Receives'), md.indexOf('## Preconditions'));
  for (const part of ['Attribution (from the caller):', 'Commit trailer:', 'PR footer:', 'Attribution (from the caller): none']) assert.ok(receives.includes(part), part);
});

test('commit-attribution AC-2 T27 with lines given the agent writes exactly those and no other', () => {
  const s = attributionOfAgent();
  assert.ok(s.includes('exactly the text after each `Commit trailer:` line'), s);
  assert.ok(s.includes('Add no other `Co-Authored-By` line, attribution trailer or footer'), s);
});

test('commit-attribution AC-2 T28 with none the agent writes no attribution line', () => {
  assert.ok(attributionOfAgent().includes('Write no `Co-Authored-By` line, no attribution trailer and no footer'));
});

test('commit-attribution AC-2 T29 with no block the agent keeps its earlier rule', () => {
  const s = attributionOfAgent();
  const bullet = s.split('\n').find((l) => l.startsWith('- **No block**')) ?? '';
  assert.ok(bullet.includes('the environment or the user requires'), bullet);
});

test('commit-attribution AC-2 T30 the caller\'s block wins over the agent\'s environment', () => {
  assert.ok(attributionOfAgent().includes('wins over the lines your own environment gives you'));
});

// The text of step `n` of the agent's Method, from its number to the next step's (or the section's end).
const methodStep = (m, n) => {
  const at = m.search(new RegExp(`^${n}\\. `, 'm'));
  assert.ok(at >= 0, `Method step ${n}`);
  const after = m.slice(at).search(new RegExp(`^${n + 1}\\. `, 'm'));
  return after >= 0 ? m.slice(at, at + after) : m.slice(at);
};

test('commit-attribution AC-2 T31 Method steps 3 and 5 point to Attribution and drop the environment rule', () => {
  const m = methodOfAgent();
  assert.match(coreAgent('commit-and-pr'), /^## Attribution$/m, 'the Attribution section exists');
  for (const n of [3, 5]) assert.ok(methodStep(m, n).includes('Attribution below'), `step ${n} points to Attribution: ${methodStep(m, n)}`);
  assert.ok(!m.includes('the environment or the user requires'), m);
});

test('commit-attribution AC-2 T32 Never forbids a line the block does not give', () => {
  const md = coreAgent('commit-and-pr');
  assert.ok(md.slice(md.indexOf('## Never')).includes("add one the caller's attribution block does not give"));
});

for (const [n, step] of [[33, 'commit'], [34, 'open-pr'], [35, 'open-archive-pr']]) {
  test(`commit-attribution AC-1 T${n} the ship-change ${step} row ends the prompt with the attribution block`, () => {
    assert.ok(skillRow(shipSkill(), step).includes('End the prompt with the attribution block (Attribution, above).'));
  });
}

test('commit-attribution AC-1 T36 the ship-change Attribution section holds the block and names no model', () => {
  const md = shipSkill();
  const a = md.indexOf('## Attribution');
  const b = md.indexOf('\n## Loop');
  const s = a >= 0 && b > a ? md.slice(a, b) : '';
  for (const part of ['Attribution (from the caller):', 'Commit trailer: <one line this session ends its commit messages with>', 'PR footer: <one line this session ends its pull-request descriptions with>',
    "The caller's lines win over your own environment's, as the owner's choice: write exactly these and no other Co-Authored-By line, attribution trailer or footer.",
    'Attribution (from the caller): none', 'verbatim', "never take the agent's"]) assert.ok(s.includes(part), part);
  assert.doesNotMatch(s, /Opus|Sonnet|Haiku|noreply/);
});

// ================================================================ forced-merge-path phase 1: an owner's forced merge (design D-1 to D-5, D-12)
// The facts come from fakeGh keys only: the rollup is `pr-view-<n>`, the rules are presetSetup's, contents, compare and commits follow
// the key rule of the fake (`/ { } ?` become `_`). No test reads this repository's git history.

const FMP = 'forced-merge-path 1';
const fmpRoute = (route) => `api-GET-${`repos/{owner}/{repo}/${route}`.replace(/[\/{}?]/g, '_')}`;
const contentsKey = (path, ref) => fmpRoute(`contents/${path}?ref=${ref}`);
const folderFx = (names) => ({ stdout: names.map((name) => ({ name, type: 'file' })) });
const fileFx = (text) => tasksFixture(text);
const OKRUN = (name) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion: 'SUCCESS' });
const RUNOF = (name, conclusion) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion });
const STATUS = (context, state) => ({ __typename: 'StatusContext', context, state });
const rollupFx = (list) => ({ stdout: { statusCheckRollup: list } });
const rule = (...contexts) => [{ type: 'required_status_checks', parameters: { required_status_checks: contexts.map((context) => ({ context })) } }];
const STAGE = (result, sha, commit = sha) => `<!-- devkit-stage evidence result=${result} attempt=1 commit=${sha} -->\nCommit: ${commit}\n\n# Evidence\n`;
const verdictText = (verdict, sha) => `Verdict: ${verdict}\nCommit: ${sha}\n\n# Review\n`;
const BOOM = { exit: 1, stderr: 'gh: boom\n' };
const RULES_KEY = 'api-GET-repos__owner___repo__rules_branches_main';
const EVIDENCE_PATH = 'openspec/changes/feat/evidence.md';
const REVIEWS_PATH = 'openspec/changes/feat/reviews';

// The gate files of change `feat` at `head`: evidence undefined is a passed one recorded at `head`, null is not found, a string is
// its text; `reviews` maps a reviewer to the file text (none: the folder is not found).
function gatesAt(gh, head, { evidence, reviews = {} } = {}) {
  gh.set(contentsKey('openspec/changes/feat/release.md', head), NOT_FOUND);
  gh.set(contentsKey(EVIDENCE_PATH, head), evidence === null ? NOT_FOUND : fileFx(evidence ?? STAGE('passed', head)));
  const names = Object.keys(reviews);
  gh.set(contentsKey(REVIEWS_PATH, head), names.length ? folderFx(names.map((n) => `${n}.md`)) : NOT_FOUND);
  for (const [name, text] of Object.entries(reviews)) gh.set(contentsKey(`${REVIEWS_PATH}/${name}.md`, head), fileFx(text));
}
const approvedAt = (head) => ({ 'code-quality-reviewer': verdictText('approved', head), 'test-coverage-reviewer': verdictText('approved', head) });

// What forcedMerge reads for a merged pull request `n`: its tasks on the default branch, its rollup and its gate files at `head`. The default
// shape is PR 88's: task 9.6 left, `check` SUCCESS, `devkit-reviews` FAILURE, no evidence, one reviewer REJECTED.
const PR88_HEAD = '8'.repeat(40);
const pr88Gates = (head) => ({ evidence: null, reviews: { 'code-quality-reviewer': verdictText('rejected', head), 'test-coverage-reviewer': verdictText('approved', head) } });
function forcedFixtures(t, { n = 12, head = 'b'.repeat(40), rollup = [OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')], ticked = ['1.1', '1.2'], unticked = ['9.6'], gates = pr88Gates(head) } = {}) {
  t.gh.tasksOnDefault('feat', tasksText({ ticked, unticked }));
  t.gh.set(`pr-view-${n}`, rollupFx(rollup));
  gatesAt(t.gh, head, gates);
  return t;
}
const PR88 = mergedPr({ number: 88, url: 'https://github.com/o/r/pull/88', headRefOid: PR88_HEAD });
// PR 88's shape from a checkout on the default branch (the list arm), or on `branch`.
const forcedPm = (opts = {}) => forcedFixtures(pm({ mergedPrs: [PR88], ...opts }), { n: 88, head: PR88_HEAD });
const PR88_TEXTS = ['task 9.6', 'devkit-reviews (FAILURE)', 'evidence.md (missing)', 'reviews/code-quality-reviewer.md (verdict REJECTED)'];
const PR88_REASON = `PR #88 merged by the owner with 4 items open: ${PR88_TEXTS.join('; ')}; run the retro`;
const unreadReason = (n, error) => `cannot tell whether PR #${n} of feat was merged by the owner: ${error}`;

// PR 88 merged, the checkout on the change's own branch `ship/feat`: GitHub still holds the branch (`pr view` finds it, no further pull
// request is open), or deleted it (`pr view` finds none, `pr list --head` lists it merged).
function forcedOnBranch({ n = 88, deleted = false, extra = '', ...fixtures } = {}) {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  // Settings that change what a ready change does (the train boards it) come after the drive.
  if (extra) {
    appendFileSync(join(t.root, 'openspec/config.yaml'), extra);
    commitAll(t.root, 'settings');
  }
  const sha = head(t.root);
  const merged = prJson({ number: n, url: `https://github.com/o/r/pull/${n}`, state: 'MERGED', headRefOid: sha, body: PR_BODY });
  if (deleted) {
    t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
    t.gh.set('pr-list', { stdout: [{ ...merged, headRefName: 'ship/feat', mergedAt: '2026-11-09T14:56:00Z' }] });
  } else {
    t.gh.set('pr-view', { stdout: merged });
    t.gh.set('pr-list', { stdout: [] });
  }
  t.gh.prFiles(n, [FEAT_TASKS, 'src/a.ts']);
  // The default branch still holds the change, and no archive pull request exists (the facts of the post-merge rows).
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-10-01-other' }] });
  t.gh.set(ACTIVE_ON_MAIN, { stdout: { name: 'feat' } });
  t.gh.set(ARCHIVE_PRS, { stdout: [] });
  return forcedFixtures(t, { n, head: sha, gates: pr88Gates(sha), ...fixtures });
}
const stateOf = (t) => collectState(t.root, 'feat', { env: t.env });

// ---- F: the forced signal (D-2)

// A runner of fixtures for forcedChecks: the rules of the default branch, and the rollup of pull request 12 when given.
function checksRepo({ rules, rollup } = {}) {
  const t = findRepo([]);
  presetSetup(t.gh, rules ? { rules } : {});
  if (rollup !== undefined) t.gh.set('pr-view-12', rollupFx(rollup));
  return t;
}
const forcedOf = (t) => DC.forcedChecks(t.run, 12, 'main');

test(`${FMP}: F1 devkit-reviews FAILURE beside a green check is forced by devkit-reviews (FAILURE)`, () => {
  const t = checksRepo({ rollup: [OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')] });
  assert.deepEqual(forcedOf(t), { checks: [{ name: 'devkit-reviews', conclusion: 'FAILURE' }] });
  assert.deepEqual(t.gh.calls().filter((c) => c[0] === 'pr'), [['pr', 'view', '12', '--json', 'statusCheckRollup']]);
});

test(`${FMP}: F2 check FAILURE alone is forced by check (FAILURE)`, () => {
  const t = checksRepo({ rollup: [RUNOF('check', 'FAILURE'), OKRUN('devkit-reviews')] });
  assert.deepEqual(forcedOf(t), { checks: [{ name: 'check', conclusion: 'FAILURE' }] });
});

test(`${FMP}: F3 a required check with no entry is absent`, () => {
  assert.deepEqual(forcedOf(checksRepo({ rollup: [OKRUN('devkit-reviews')] })), { checks: [{ name: 'check', conclusion: 'absent' }] });
});

test(`${FMP}: F4 a required devkit-reviews with no entry is absent`, () => {
  assert.deepEqual(forcedOf(checksRepo({ rollup: [OKRUN('check')] })), { checks: [{ name: 'devkit-reviews', conclusion: 'absent' }] });
});

test(`${FMP}: F5 every required check SUCCESS is not forced`, () => {
  assert.deepEqual(forcedOf(checksRepo({ rollup: [OKRUN('check'), OKRUN('devkit-reviews'), RUNOF('lint', 'FAILURE')] })), { checks: [] }, 'a check no rule requires is not read');
});

test(`${FMP}: F6 devkit-reviews that no rule requires counts only when it reported and is not green`, () => {
  const only = (rollup) => forcedOf(checksRepo({ rules: rule('check'), rollup }));
  assert.deepEqual(only([OKRUN('check')]), { checks: [] }, 'absent');
  assert.deepEqual(only([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]), { checks: [{ name: 'devkit-reviews', conclusion: 'FAILURE' }] }, 'reported FAILURE');
  assert.deepEqual(only([OKRUN('check'), OKRUN('devkit-reviews')]), { checks: [] }, 'reported SUCCESS');
});

test(`${FMP}: F7 a status context entry is read like a check run of that name`, () => {
  assert.deepEqual(forcedOf(checksRepo({ rollup: [STATUS('check', 'FAILURE'), OKRUN('devkit-reviews')] })), { checks: [{ name: 'check', conclusion: 'FAILURE' }] });
  assert.deepEqual(forcedOf(checksRepo({ rollup: [STATUS('check', 'SUCCESS'), OKRUN('devkit-reviews')] })), { checks: [] });
});

test(`${FMP}: F8 two entries of one name are green only when both are SUCCESS`, () => {
  const want = { checks: [{ name: 'check', conclusion: 'FAILURE' }] };
  assert.deepEqual(forcedOf(checksRepo({ rollup: [OKRUN('check'), RUNOF('check', 'FAILURE'), OKRUN('devkit-reviews')] })), want);
  assert.deepEqual(forcedOf(checksRepo({ rollup: [RUNOF('check', 'FAILURE'), OKRUN('check'), OKRUN('devkit-reviews')] })), want);
});

test(`${FMP}: F9 SKIPPED, NEUTRAL and an empty conclusion are not green`, () => {
  assert.deepEqual(DC.notGreen([RUNOF('check', 'SKIPPED'), RUNOF('devkit-reviews', 'NEUTRAL')], ['check', 'devkit-reviews']),
    [{ name: 'check', conclusion: 'SKIPPED' }, { name: 'devkit-reviews', conclusion: 'NEUTRAL' }]);
  assert.deepEqual(DC.notGreen([RUNOF('check', null), OKRUN('devkit-reviews')], ['check', 'devkit-reviews']), [{ name: 'check', conclusion: 'PENDING' }]);
  assert.deepEqual(DC.notGreen([], []), []);
  assert.deepEqual(DC.notGreen([OKRUN('check')], ['check']), []);
});

test(`${FMP}: F9 notGreen lists the required checks in rule order, then devkit-reviews when no rule requires it`, () => {
  const rollup = [RUNOF('devkit-reviews', 'FAILURE'), RUNOF('lint', 'FAILURE'), RUNOF('check', 'FAILURE'), OKRUN('build')];
  assert.deepEqual(DC.notGreen(rollup, ['check', 'build']), [{ name: 'check', conclusion: 'FAILURE' }, { name: 'devkit-reviews', conclusion: 'FAILURE' }]);
  assert.deepEqual(DC.notGreen(rollup, ['devkit-reviews', 'check']), [{ name: 'devkit-reviews', conclusion: 'FAILURE' }, { name: 'check', conclusion: 'FAILURE' }]);
});

test(`${FMP}: F10 forcedChecks answers an error for a missing rollup, a rules read that fails and a rollup read that fails`, () => {
  const noField = checksRepo();
  noField.gh.set('pr-view-12', { stdout: { number: 12 } });
  assert.deepEqual(forcedOf(noField), { error: 'gh pr view 12 returned no statusCheckRollup' });
  const notList = checksRepo();
  notList.gh.set('pr-view-12', { stdout: { statusCheckRollup: null } });
  assert.deepEqual(forcedOf(notList), { error: 'gh pr view 12 returned no statusCheckRollup' });
  const noRules = checksRepo({ rollup: [OKRUN('check')] });
  noRules.gh.set(RULES_KEY, BOOM);
  assert.deepEqual(forcedOf(noRules), { error: 'gh: boom' });
  const noView = checksRepo();
  noView.gh.set('pr-view-12', BOOM);
  assert.deepEqual(forcedOf(noView), { error: 'gh: boom' });
});

test(`${FMP}: F10 from the default branch a failed forced read blocks naming pull request 12 and reports no mergedLeft`, () => {
  const variants = {
    'a rollup answer without the field': [(t) => t.gh.set('pr-view-12', { stdout: { number: 12 } }), 'gh pr view 12 returned no statusCheckRollup'],
    'a rules read that fails': [(t) => t.gh.set(RULES_KEY, BOOM), 'gh: boom'],
    'a rollup read that fails': [(t) => t.gh.set('pr-view-12', BOOM), 'gh: boom'],
  };
  for (const [name, [break_, error]] of Object.entries(variants)) {
    const t = forcedFixtures(pm());
    break_(t);
    const s = stateOf(t);
    assert.deepEqual(s.unreadMerge, { number: 12, error }, name);
    assert.equal(s.mergedLeft, null, name);
    assert.equal(s.forced, null, name);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.reason], ['blocked', unreadReason(12, error)], name);
    assert.equal(n.number, 12, name);
    assert.doesNotMatch(JSON.stringify(n), /undefined/, name);
    assert.match(s.items[4].reason, new RegExp(`cannot read the PR: ${error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), name);
  }
});

test(`${FMP}: F11 on the change's own branch the same failed read blocks and never answers implement`, () => {
  const t = forcedOnBranch();
  t.gh.set('pr-view-88', BOOM);
  const s = stateOf(t);
  assert.deepEqual(s.unreadMerge, { number: 88, error: 'gh: boom' });
  const n = nextStep(s);
  assert.deepEqual([n.step, n.reason], ['blocked', unreadReason(88, 'gh: boom')]);
});

// ---- G: the open items at the merged head (D-3)

const GHEAD = 'c'.repeat(40);
const OLD = 'd'.repeat(40);
const OLDER = 'e'.repeat(40);
const gatesRepo = (gates) => {
  const t = findRepo([]);
  gatesAt(t.gh, GHEAD, gates);
  return t;
};
const gatesOf = (t, head = GHEAD) => DC.gatesAtHead(t.run, 'feat', head);
const compareKey = (a, b) => fmpRoute(`compare/${a}...${b}`);
const compareFx = (status, files = []) => ({ stdout: { status, files: files.map((filename) => ({ filename })) } });
const compareCalls = (t) => t.gh.calls().filter((c) => c[0] === 'api' && /\/compare\//.test(c[1]));

test(`${FMP}: G0 a passed evidence and both required reviews approved at the head are no open gate`, () => {
  assert.deepEqual(gatesOf(gatesRepo({ reviews: approvedAt(GHEAD) })), { gates: [] });
});

test(`${FMP}: G1 a missing evidence.md is one gate item`, () => {
  assert.deepEqual(gatesOf(gatesRepo({ evidence: null, reviews: approvedAt(GHEAD) })), { gates: [{ file: 'evidence.md', why: 'missing' }] });
});

test(`${FMP}: G2 an evidence.md whose stage header result is failed is one gate item naming the result`, () => {
  assert.deepEqual(gatesOf(gatesRepo({ evidence: STAGE('failed', GHEAD), reviews: approvedAt(GHEAD) })), { gates: [{ file: 'evidence.md', why: 'result failed' }] });
});

test(`${FMP}: G3 an evidence.md with no stage header, or a malformed one, is one gate item`, () => {
  for (const evidence of [`Commit: ${GHEAD}\n\n# Evidence\n`, `<!-- devkit-stage evidence result=maybe -->\nCommit: ${GHEAD}\n`]) {
    assert.deepEqual(gatesOf(gatesRepo({ evidence, reviews: approvedAt(GHEAD) })), { gates: [{ file: 'evidence.md', why: 'no stage header' }] }, evidence);
  }
});

test(`${FMP}: G3 a passed evidence with no Commit line, or recorded with uncommitted changes, is one gate item`, () => {
  const noLine = `<!-- devkit-stage evidence result=passed attempt=1 commit=${GHEAD} -->\n\n# Evidence\n`;
  assert.deepEqual(gatesOf(gatesRepo({ evidence: noLine, reviews: approvedAt(GHEAD) })), { gates: [{ file: 'evidence.md', why: 'no Commit: line' }] });
  const dirty = `<!-- devkit-stage evidence result=passed attempt=1 commit=${GHEAD} -->\nCommit: ${OLD} (uncommitted changes)\n\n# Evidence\n`;
  assert.deepEqual(gatesOf(gatesRepo({ evidence: dirty, reviews: approvedAt(GHEAD) })), { gates: [{ file: 'evidence.md', why: `${OLD.slice(0, 7)} was recorded with uncommitted changes` }] });
});

test(`${FMP}: G4 an evidence Commit equal to the head, or that the head starts with, is current with no compare call`, () => {
  const t = gatesRepo({ evidence: STAGE('passed', GHEAD), reviews: approvedAt(GHEAD) });
  assert.deepEqual(gatesOf(t), { gates: [] });
  const short = gatesRepo({ evidence: STAGE('passed', GHEAD, GHEAD.slice(0, 7)), reviews: approvedAt(GHEAD.slice(0, 7)) });
  assert.deepEqual(gatesOf(short), { gates: [] });
  assert.deepEqual([compareCalls(t), compareCalls(short)], [[], []]);
});

test(`${FMP}: G5 an older Commit behind only openspec/ files is current, and one compare answers every file recorded at that sha`, () => {
  const t = gatesRepo({ evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(OLD) });
  t.gh.set(compareKey(OLD, GHEAD), compareFx('ahead', ['openspec/changes/feat/evidence.md', 'openspec/specs/x/spec.md']));
  assert.deepEqual(gatesOf(t), { gates: [] });
  assert.equal(compareCalls(t).length, 1, 'cached per sha within the run');
  assert.deepEqual(compareCalls(t)[0], ['api', `repos/{owner}/{repo}/compare/${OLD}...${GHEAD}`]);
  const same = gatesRepo({ evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(OLD) });
  same.gh.set(compareKey(OLD, GHEAD), compareFx('identical'));
  assert.deepEqual(gatesOf(same), { gates: [] });
});

test(`${FMP}: G6 an older Commit behind a product file is stale and names the file`, () => {
  const t = gatesRepo({ evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(GHEAD) });
  t.gh.set(compareKey(OLD, GHEAD), compareFx('ahead', ['openspec/changes/feat/tasks.md', 'src/a.ts']));
  assert.deepEqual(gatesOf(t), { gates: [{ file: 'evidence.md', why: `${OLD.slice(0, 7)} is behind the merged head, which changes src/a.ts` }] });
});

test(`${FMP}: G7 a Commit that is not an ancestor of the head, one too far behind and one that does not resolve are stale`, () => {
  const stale = (answer) => {
    const t = gatesRepo({ evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(GHEAD) });
    t.gh.set(compareKey(OLD, GHEAD), answer);
    return gatesOf(t).gates;
  };
  const why = (text) => [{ file: 'evidence.md', why: text }];
  assert.deepEqual(stale(compareFx('diverged', ['src/a.ts'])), why(`${OLD.slice(0, 7)} is not an ancestor of the merged head`));
  assert.deepEqual(stale(compareFx('behind')), why(`${OLD.slice(0, 7)} is not an ancestor of the merged head`));
  const many = Array.from({ length: 300 }, (_, i) => `openspec/n${i}.md`);
  assert.deepEqual(stale(compareFx('ahead', many)), why(`${OLD.slice(0, 7)} is too far behind the merged head to read`));
  assert.deepEqual(stale(NOT_FOUND), why(`${OLD.slice(0, 7)} does not resolve to a commit`));
});

test(`${FMP}: G8 a missing required reviewer, a REJECTED one and an approved one behind a product file are three gate items; a test-spared reviewer behind a test file only is current`, () => {
  const t = gatesRepo({
    evidence: STAGE('passed', GHEAD),
    reviews: {
      'test-coverage-reviewer': verdictText('rejected', GHEAD),
      'perf-reviewer': verdictText('approved', OLDER),
      'spec-reviewer': verdictText('approved', OLD),
    },
  });
  t.gh.set(compareKey(OLDER, GHEAD), compareFx('ahead', ['openspec/a.md', 'src/a.ts']));
  t.gh.set(compareKey(OLD, GHEAD), compareFx('ahead', ['openspec/a.md', 'plugins/x/a.test.mjs']));
  assert.deepEqual(gatesOf(t), {
    gates: [
      { file: 'reviews/code-quality-reviewer.md', why: 'missing' },
      { file: 'reviews/test-coverage-reviewer.md', why: 'verdict REJECTED' },
      { file: 'reviews/perf-reviewer.md', why: `${OLDER.slice(0, 7)} is behind the merged head, which changes src/a.ts` },
    ],
  });
});

test(`${FMP}: G8 a review with no Verdict line, a DECLINED one and a non-md entry`, () => {
  const t = findRepo([]);
  gatesAt(t.gh, GHEAD, { evidence: STAGE('passed', GHEAD), reviews: { 'code-quality-reviewer': `Commit: ${GHEAD}\n\n# Review\n`, 'test-coverage-reviewer': verdictText('declined', GHEAD) } });
  t.gh.set(contentsKey(REVIEWS_PATH, GHEAD), { stdout: [{ name: 'code-quality-reviewer.md' }, { name: 'test-coverage-reviewer.md' }, { name: 'notes.txt' }] });
  assert.deepEqual(gatesOf(t), { gates: [{ file: 'reviews/code-quality-reviewer.md', why: 'no verdict line' }] });
});

// One currency rule (jira-entry-followups D-2): an approved verdict that still lists an undisposed [blocking] / [important] finding is
// current only through commits of the change's own review record, on the forced path as in readReviews.
const FIX = 'f'.repeat(40);
const withFinding = (disposition, commit = OLD) => `Verdict: approved\nCommit: ${commit}\n\n# Review\n\n- [important] the retro under-reports a gate${disposition}\n`;
const openGateRepo = (text, files) => {
  const t = gatesRepo({ evidence: STAGE('passed', GHEAD), reviews: { 'code-quality-reviewer': text, 'test-coverage-reviewer': verdictText('approved', GHEAD) } });
  t.gh.set(compareKey(OLD, GHEAD), compareFx('ahead', files));
  return t;
};

test(`${FMP}: G11 an approved verdict that lists an undisposed finding is stale behind a commit outside the review record, and the count includes it`, () => {
  const t = openGateRepo(withFinding(''), ['openspec/changes/feat/tasks.md']);
  assert.deepEqual(gatesOf(t), { gates: [{ file: 'reviews/code-quality-reviewer.md', why: `${OLD.slice(0, 7)} is behind the merged head, which changes openspec/changes/feat/tasks.md` }] });
  const pr = { number: 12, url: 'https://github.com/o/r/pull/12', headRefOid: GHEAD };
  const f = openGateRepo(withFinding(''), ['openspec/changes/feat/tasks.md']);
  presetSetup(f.gh);
  f.gh.set('pr-view-12', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  const got = DC.forcedMerge(f.run, 'feat', pr, { base: 'main', unticked: [] });
  assert.equal(got.forced.count, 2);
  assert.ok(got.forced.items.some((i) => i.kind === 'gate' && i.file === 'reviews/code-quality-reviewer.md'));
  // Behind only the change's own review record, it is current.
  assert.deepEqual(gatesOf(openGateRepo(withFinding(''), ['openspec/changes/feat/reviews/code-quality-reviewer.md'])), { gates: [] });
});

test(`${FMP}: G12 the same verdict with the finding disposed (fixed in a sha in history, or refuted) is current as before`, () => {
  const fixed = openGateRepo(withFinding(` · fixed in ${FIX.slice(0, 12)}`), ['openspec/changes/feat/tasks.md']);
  fixed.gh.set(compareKey(FIX.slice(0, 12), GHEAD), compareFx('ahead', ['src/a.ts']));
  assert.deepEqual(gatesOf(fixed), { gates: [] });
  const refuted = openGateRepo(withFinding(' · refuted: the rule is the same'), ['openspec/changes/feat/tasks.md']);
  assert.deepEqual(gatesOf(refuted), { gates: [] });
});

test(`${FMP}: G13 a fixed-in sha that is behind, diverged from or unknown to the merged head leaves the finding undisposed`, () => {
  const fixedIn = FIX.slice(0, 12);
  const cases = [
    ['behind', compareFx('behind', ['src/a.ts'])],
    ['diverged', compareFx('diverged', ['src/a.ts'])],
    ['a sha GitHub does not find (404)', NOT_FOUND],
  ];
  for (const [name, answer] of cases) {
    const t = openGateRepo(withFinding(` · fixed in ${fixedIn}`), ['openspec/changes/feat/tasks.md']);
    t.gh.set(compareKey(fixedIn, GHEAD), answer);
    assert.deepEqual(gatesOf(t), { gates: [{ file: 'reviews/code-quality-reviewer.md', why: `${OLD.slice(0, 7)} is behind the merged head, which changes openspec/changes/feat/tasks.md` }] }, name);
  }
});

test(`${FMP}: G14 a fixed-in sha whose compare fails with anything but a 404 blocks, quoting the error`, () => {
  const fixedIn = FIX.slice(0, 12);
  const t = openGateRepo(withFinding(` · fixed in ${fixedIn}`), ['openspec/changes/feat/tasks.md']);
  t.gh.set(compareKey(fixedIn, GHEAD), BOOM);
  assert.deepEqual(gatesOf(t), { error: 'gh: boom' });
  // From the default branch the same unreadable compare blocks and never forces.
  const f = forcedFixtures(pm(), { gates: { evidence: STAGE('passed', 'b'.repeat(40)), reviews: { 'code-quality-reviewer': withFinding(` · fixed in ${fixedIn}`, 'b'.repeat(40)), 'test-coverage-reviewer': verdictText('approved', 'b'.repeat(40)) } } });
  f.gh.set(compareKey(fixedIn, 'b'.repeat(40)), BOOM);
  const s = stateOf(f);
  assert.deepEqual(s.unreadMerge, { number: 12, error: 'gh: boom' });
  assert.equal(s.forced, null);
  assert.deepEqual([nextStep(s).step, nextStep(s).reason], ['blocked', unreadReason(12, 'gh: boom')]);
});

// forced-merge-release-edit (D-7): on an owner's forced merge the release-edit rule of ADR 0034 decision 5 applies, so a noted change whose
// compare from the evidence commit lists only the files of the assign-release step's commit opens no gate. The fixture sets the compare
// `<recorded>...<head>` and every contents answer the step's commit needs at the recorded commit and at the head.
const STEP_FILES = ['.claude-plugin/marketplace.json', 'plugins/openspec/.claude-plugin/plugin.json', 'CHANGELOG.md', 'docs/adr/0035-feat.md', 'docs/openspec-flow.md'];
const FMRE = 'forced-merge-release-edit';
const RELEASE_PATH = 'openspec/changes/feat/release.md';
const CONFIG_PATH = 'openspec/config.yaml';
const MARKET_PATH = '.claude-plugin/marketplace.json';
const PACK_PATH = 'plugins/openspec/.claude-plugin/plugin.json';
const marketAt = (version) => fileFx(JSON.stringify({ name: 'm', metadata: { version }, plugins: [{ name: 'devkit-openspec', version }] }));
const packAt = (version) => fileFx(JSON.stringify({ name: 'devkit-openspec', version }));
const CONFIGS = {
  tag: fileFx('devkit:\n  release_tag: plugins/openspec/.claude-plugin/plugin.json\n'),
  none: fileFx('devkit:\n  language: en\n'),
  bad: fileFx('devkit:\n  release_tag: notes.txt\n'),
  absent: NOT_FOUND,
};
function releaseStepAt(gh, head, { flow = 'release', extra = [], note = true, config = 'tag', base = true, recorded = OLD } = {}) {
  const set = (path, rev, answer) => gh.set(contentsKey(path, rev), answer);
  set(RELEASE_PATH, head, note ? fileFx('# Release note\n\npacks:\n- devkit-openspec: patch\n\n## t\n\nbody\n') : NOT_FOUND);
  set(CONFIG_PATH, head, CONFIGS[config]);
  set(MARKET_PATH, OLD, marketAt('1.0.0'));
  set(MARKET_PATH, head, marketAt('1.1.0'));
  set(PACK_PATH, OLD, packAt('1.0.0'));
  set(PACK_PATH, head, packAt('1.1.0'));
  const record = fileFx('# Feat\n\nThe record.\n');
  set('docs/adr/0035-feat.md', OLD, NOT_FOUND);
  set('docs/adr/0035-feat.md', head, record);
  set('docs/adr/feat.md', OLD, record);
  set('docs/adr/feat.md', head, NOT_FOUND);
  set('docs/adr', OLD, folderFx(['feat.md']));
  set('docs/adr', head, folderFx(['0035-feat.md']));
  set('docs/decisions', OLD, NOT_FOUND);
  set('docs/decisions', head, NOT_FOUND);
  set(FLOW_PATH, OLD, fileFx('See ADR [feat].\nuses: x # pinned to the commit of v1.0.0\nThe gate reads it.\n'));
  set(FLOW_PATH, head, fileFx(`See ADR 0035.\nuses: x # pinned to the commit of v1.1.0\nThe gate reads it${flow === 'sentence' ? ' twice' : ''}.\n`));
  for (const path of extra) { set(path, OLD, NOT_FOUND); set(path, head, fileFx('export {};\n')); }
  gh.set(compareKey(recorded, head), {
    stdout: {
      status: 'ahead',
      ...(base ? { base_commit: { sha: OLD } } : {}),
      files: [...STEP_FILES.map((filename) => (filename === 'docs/adr/0035-feat.md' ? { filename, status: 'renamed', previous_filename: 'docs/adr/feat.md' } : { filename, status: 'modified' })), ...extra.map((filename) => ({ filename, status: 'added' }))],
    },
  });
}
const stepRepo = (opts = {}, gates = { evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(OLD) }) => {
  const t = gatesRepo(gates);
  releaseStepAt(t.gh, GHEAD, opts);
  return t;
};
const GATE_FILES = ['evidence.md', 'reviews/code-quality-reviewer.md', 'reviews/test-coverage-reviewer.md'];
const behindWhy = (path, sha = OLD) => `${sha.slice(0, 7)} is behind the merged head, which changes ${path}`;
const contentsCalls = (t) => t.gh.calls().filter((c) => c[0] === 'api' && /\/contents\//.test(c[1])).map((c) => c[1]);

test(`${FMRE} AC-1 a noted change behind only the assign-release step's files opens no gate, and forcedMerge counts only the red check`, () => {
  const t = stepRepo();
  assert.deepEqual(gatesOf(t), { gates: [] });
  const reads = contentsCalls(t);
  assert.equal(new Set(reads).size, reads.length, 'each contents key is read at most once');
  presetSetup(t.gh);
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  const got = DC.forcedMerge(t.run, 'feat', { number: 12, url: 'https://github.com/o/r/pull/12', headRefOid: GHEAD }, { base: 'main', unticked: [] });
  assert.deepEqual(got.forced.items.filter((i) => i.kind === 'gate'), []);
  assert.equal(got.forced.count, 1, 'only the red devkit-reviews check');
});

test(`${FMRE} AC-2 a step's commit that also edits a sentence of docs/openspec-flow.md opens the evidence and each approved review, naming that file`, () => {
  const t = stepRepo({ flow: 'sentence' });
  assert.deepEqual(gatesOf(t), { gates: GATE_FILES.map((file) => ({ file, why: behindWhy(FLOW_PATH) })) });
});

test(`${FMRE} AC-3 a product commit after the step's opens the evidence naming plugins/x.mjs`, () => {
  const t = stepRepo({ extra: ['plugins/x.mjs'] });
  assert.deepEqual(gatesOf(t), { gates: GATE_FILES.map((file) => ({ file, why: behindWhy('plugins/x.mjs') })) });
});

test(`${FMRE} AC-4 no note, no config, no release_tag or a refused one: the same items as before, naming the first step file`, () => {
  const variants = { 'no note': { note: false }, 'no config': { config: 'absent' }, 'no release_tag': { config: 'none' }, 'a refused release_tag': { config: 'bad' } };
  for (const [name, opts] of Object.entries(variants)) {
    const t = stepRepo(opts);
    assert.deepEqual(gatesOf(t), { gates: GATE_FILES.map((file) => ({ file, why: behindWhy(MARKET_PATH) })) }, name);
    if (opts.note === false) {
      const stepReads = contentsCalls(t).filter((r) => STEP_FILES.some((f) => r.includes(`/contents/${f}?`)));
      assert.deepEqual(stepReads, [], 'with no note, no step file is read');
    }
  }
});

test(`${FMRE} AC-4 a compare of only openspec/ files reads no release note`, () => {
  const t = gatesRepo({ evidence: STAGE('passed', GHEAD, OLD), reviews: approvedAt(OLD) });
  t.gh.set(compareKey(OLD, GHEAD), compareFx('ahead', ['openspec/changes/feat/evidence.md', 'openspec/specs/x/spec.md']));
  assert.deepEqual(gatesOf(t), { gates: [] });
  assert.deepEqual(contentsCalls(t).filter((r) => r.includes('release.md')), []);
});

test(`${FMRE} AC-5 a REJECTED review and an approved one with an undisposed finding stay open across the step's commit`, () => {
  const t = stepRepo({}, { evidence: STAGE('passed', GHEAD, OLD), reviews: { 'code-quality-reviewer': verdictText('rejected', OLD), 'test-coverage-reviewer': withFinding('') } });
  assert.deepEqual(gatesOf(t), {
    gates: [
      { file: 'reviews/code-quality-reviewer.md', why: 'verdict REJECTED' },
      { file: 'reviews/test-coverage-reviewer.md', why: behindWhy(MARKET_PATH) },
    ],
  });
});

test(`${FMRE} AC-1 the compare's base_commit sha is the recorded side's ref, and the recorded sha is without it`, () => {
  const short = OLD.slice(0, 7);
  const t = stepRepo({ recorded: short }, { evidence: STAGE('passed', GHEAD, short), reviews: approvedAt(short) });
  assert.deepEqual(gatesOf(t), { gates: [] });
  assert.deepEqual(contentsCalls(t).filter((r) => r.endsWith(`ref=${short}`)), [], 'no contents key at the short sha');
  const bare = stepRepo({ base: false });
  assert.deepEqual(gatesOf(bare), { gates: [] });
});

test(`${FMRE} blocked a failed or empty read of the release comparison ends gatesAtHead with the error`, () => {
  const short = GHEAD.slice(0, 7);
  const cases = [
    ['release.md fails', (t) => t.gh.set(contentsKey(RELEASE_PATH, GHEAD), BOOM), 'gh: boom'],
    ['the config fails', (t) => t.gh.set(contentsKey(CONFIG_PATH, GHEAD), BOOM), 'gh: boom'],
    ['the config has no content string', (t) => t.gh.set(contentsKey(CONFIG_PATH, GHEAD), { stdout: { name: 'config.yaml' } }), `${CONFIG_PATH} at ${short} has no content`],
    ['the marketplace at the recorded commit fails', (t) => t.gh.set(contentsKey(MARKET_PATH, OLD), BOOM), 'gh: boom'],
    ['the marketplace at the head has no content string', (t) => t.gh.set(contentsKey(MARKET_PATH, GHEAD), { stdout: [] }), `${MARKET_PATH} at ${short} has no content`],
    ['docs/adr at the recorded commit fails', (t) => t.gh.set(contentsKey('docs/adr', OLD), BOOM), 'gh: boom'],
  ];
  for (const [name, break_, error] of cases) {
    const t = stepRepo();
    break_(t);
    assert.deepEqual(gatesOf(t), { error }, name);
  }
});

test(`${FMRE} blocked from the default branch a failed release read blocks naming pull request 12 and never forces`, () => {
  const head = 'b'.repeat(40);
  const t = forcedFixtures(pm(), { gates: { evidence: STAGE('passed', head, OLD), reviews: approvedAt(head) } });
  releaseStepAt(t.gh, head);
  t.gh.set(contentsKey(MARKET_PATH, OLD), BOOM);
  const s = stateOf(t);
  assert.deepEqual(s.unreadMerge, { number: 12, error: 'gh: boom' });
  assert.equal(s.forced, null);
  const n = nextStep(s);
  assert.deepEqual([n.step, n.reason], ['blocked', unreadReason(12, 'gh: boom')]);
});

test(`${FMP}: G9 gatesAtHead answers an error for a contents read that fails, a folder where a file is expected and a file where the folder is expected`, () => {
  const short = GHEAD.slice(0, 7);
  const base = () => gatesRepo({ reviews: approvedAt(GHEAD) });
  const cases = [
    ['a contents read that fails', (t) => t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), BOOM), 'gh: boom'],
    ['a review read that fails', (t) => t.gh.set(contentsKey(`${REVIEWS_PATH}/code-quality-reviewer.md`, GHEAD), BOOM), 'gh: boom'],
    ['a reviews listing that fails', (t) => t.gh.set(contentsKey(REVIEWS_PATH, GHEAD), BOOM), 'gh: boom'],
    ['evidence answered as a folder', (t) => t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), { stdout: [{ name: 'x' }] }), `${EVIDENCE_PATH} at ${short} has no content`],
    ['evidence with no content string', (t) => t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), { stdout: { name: 'evidence.md' } }), `${EVIDENCE_PATH} at ${short} has no content`],
    ['a review answered as a folder', (t) => t.gh.set(contentsKey(`${REVIEWS_PATH}/code-quality-reviewer.md`, GHEAD), { stdout: [] }), `${REVIEWS_PATH}/code-quality-reviewer.md at ${short} has no content`],
    ['reviews answered as a file', (t) => t.gh.set(contentsKey(REVIEWS_PATH, GHEAD), { stdout: { name: 'reviews', content: 'x' } }), `${REVIEWS_PATH} at ${short} is not a folder`],
    ['a compare read that fails', (t) => { t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), fileFx(STAGE('passed', GHEAD, OLD))); t.gh.set(compareKey(OLD, GHEAD), BOOM); }, 'gh: boom'],
    ['a compare answer with no file list', (t) => { t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), fileFx(STAGE('passed', GHEAD, OLD))); t.gh.set(compareKey(OLD, GHEAD), { stdout: { status: 'ahead' } }); }, `compare ${OLD.slice(0, 7)}...${short} has no file list`],
    ['a compare answer that is not JSON', (t) => { t.gh.set(contentsKey(EVIDENCE_PATH, GHEAD), fileFx(STAGE('passed', GHEAD, OLD))); t.gh.set(compareKey(OLD, GHEAD), { stdout: 'not json' }); }, 'compare returned unreadable JSON'],
  ];
  for (const [name, break_, error] of cases) {
    const t = base();
    break_(t);
    assert.deepEqual(gatesOf(t), { error }, name);
  }
});

test(`${FMP}: G9 from the default branch an unreadable gate file blocks naming pull request 12 and never forces`, () => {
  const t = forcedFixtures(pm());
  t.gh.set(contentsKey(EVIDENCE_PATH, 'b'.repeat(40)), BOOM);
  const s = stateOf(t);
  assert.deepEqual(s.unreadMerge, { number: 12, error: 'gh: boom' });
  assert.equal(s.forced, null);
  const n = nextStep(s);
  assert.deepEqual([n.step, n.reason], ['blocked', unreadReason(12, 'gh: boom')]);
  const folder = forcedFixtures(pm());
  folder.gh.set(contentsKey(EVIDENCE_PATH, 'b'.repeat(40)), { stdout: [{ name: 'x' }] });
  assert.equal(nextStep(stateOf(folder)).step, 'blocked');
});

test(`${FMP}: G10 on the change's own branch an unreadable gate file blocks and never answers implement`, () => {
  const t = forcedOnBranch();
  t.gh.set(contentsKey(EVIDENCE_PATH, head(t.root)), BOOM);
  const n = nextStep(stateOf(t));
  assert.deepEqual([n.step, n.reason], ['blocked', unreadReason(88, 'gh: boom')]);
});

// ---- forcedMerge combines the two reads (D-3)

test(`${FMP}: forcedMerge is not forced with every required check green, and forced lists tasks, then checks, then gates`, () => {
  const t = findRepo([]);
  presetSetup(t.gh);
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), OKRUN('devkit-reviews')]));
  const pr = { number: 12, url: 'https://github.com/o/r/pull/12', headRefOid: GHEAD };
  assert.deepEqual(DC.forcedMerge(t.run, 'feat', pr, { base: 'main', unticked: ['9.6'] }), { forced: null });
  assert.equal(t.gh.calls().some((c) => /contents/.test(c[1] ?? '')), false, 'no gate file is read when the merge is not forced');
  t.gh.set('pr-view-12', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  gatesAt(t.gh, GHEAD, { evidence: null, reviews: approvedAt(GHEAD) });
  const got = DC.forcedMerge(t.run, 'feat', pr, { base: 'main', unticked: ['9.6', '9.7'] });
  assert.deepEqual(got.forced.items, [
    { kind: 'task', id: '9.6', text: 'task 9.6' },
    { kind: 'task', id: '9.7', text: 'task 9.7' },
    { kind: 'check', name: 'devkit-reviews', conclusion: 'FAILURE', text: 'devkit-reviews (FAILURE)' },
    { kind: 'gate', file: 'evidence.md', why: 'missing', text: 'evidence.md (missing)' },
  ]);
  assert.deepEqual([got.forced.number, got.forced.url, got.forced.head, got.forced.count], [12, pr.url, GHEAD, 4]);
  t.gh.set('pr-view-12', BOOM);
  assert.deepEqual(DC.forcedMerge(t.run, 'feat', pr, { base: 'main', unticked: ['9.6'] }), { error: 'gh: boom' });
});

// ---- E: a tasks read that fails keeps today's answer

test(`${FMP}: E1 a tasks read that fails sets no unreadMerge and keeps item 5 blocked and today's step`, () => {
  const t = pm();
  t.gh.prFiles(12, [FEAT_TASKS]);
  t.gh.set(TASKS_ON_KEY('feat'), BOOM);
  const s = stateOf(t);
  assert.equal(s.unreadMerge, null);
  assert.equal(s.forced, null);
  assert.equal(s.items[4].status, 'blocked');
  assert.match(s.items[4].reason, /gh: boom/);
  assert.equal(nextStep(s).step, 'stop-branch');
  assert.equal(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, 'no forced read was reached');
});

// ---- N: the forced retro and the rows after it (D-4, D-5)

test(`${FMP}: N1 PR 88 from the default branch answers the retro with its exact reason, count and items in order`, () => {
  const t = forcedPm();
  const n = t.next();
  assert.equal(n.step, 'retro');
  assert.equal(n.reason, PR88_REASON);
  assert.deepEqual([n.number, n.base, n.forced.count, n.forced.number, n.forced.url], [88, 'main', 4, 88, PR88.url]);
  assert.equal(n.forced.head, PR88_HEAD);
  assert.deepEqual(n.forced.items.map((i) => i.kind), ['task', 'check', 'gate', 'gate']);
  assert.deepEqual(n.forced.items.map((i) => i.text), PR88_TEXTS);
  assert.deepEqual(n.forced.items[3], { kind: 'gate', file: 'reviews/code-quality-reviewer.md', why: 'verdict REJECTED', text: PR88_TEXTS[3] });
  assert.equal(stateOf(t).mergedLeft, null);
});

// The report of a forced merge read from the change's own branch is the one N5 reads from the default branch: items 1 and 6 open, the rest met,
// exit 1 and the summary that names the retro (D-4).
function assertOpenItems1And6(t) {
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 1, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual(j.items.map((i) => i.status), ['open', 'met', 'met', 'met', 'met', 'open', 'met', 'met']);
  assert.equal(j.items[0].reason, 'not done at the merge: task 9.6; evidence.md (missing); reviews/code-quality-reviewer.md (verdict REJECTED)');
  assert.equal(j.items[5].reason, 'not green at the merge: devkit-reviews (FAILURE)');
  assert.deepEqual([j.met, j.summary, j.next.step, j.next.number], [6, 'merged: archive step retro', 'retro', 88]);
}

test(`${FMP}: N2 PR 88 on the change's own branch with no open pull request answers the retro, never implement`, () => {
  const t = forcedOnBranch();
  const n = nextStep(stateOf(t));
  assert.equal(n.step, 'retro');
  assert.match(n.reason, /^PR #88 merged by the owner with 4 items open: task 9\.6; devkit-reviews \(FAILURE\); /);
  assert.deepEqual([n.number, n.forced.count], [88, 4]);
  assertOpenItems1And6(t);
});

test(`${FMP}: N3 PR 88 from another change's branch answers the retro`, () => {
  const t = forcedPm({ branch: 'ship/other' });
  assert.equal(stateOf(t).branch, 'ship/other');
  const n = t.next();
  assert.equal(n.step, 'retro');
  assert.equal(n.reason, PR88_REASON);
});

test(`${FMP}: N4 PR 88 found with its branch deleted, from its own branch, answers the retro`, () => {
  const t = forcedOnBranch({ deleted: true });
  const n = nextStep(stateOf(t));
  assert.equal(n.step, 'retro');
  assert.equal(n.number, 88);
  assert.equal(n.forced.count, 4);
  assert.ok(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('--head')), 'found by the head branch list');
  assertOpenItems1And6(t);
});

test(`${FMP}: N5 a forced merge opens items 1 and 6 only, exits 1 and says merged: archive step retro`, () => {
  const t = forcedPm();
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 1, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual(j.items.map((i) => i.status), ['open', 'met', 'met', 'met', 'met', 'open', 'met', 'met']);
  assert.equal(j.items[0].reason, 'not done at the merge: task 9.6; evidence.md (missing); reviews/code-quality-reviewer.md (verdict REJECTED)');
  assert.deepEqual(j.items[0].details, { unticked: ['9.6'], missingGates: [], evidence: 'forced' });
  assert.equal(j.items[5].reason, 'not green at the merge: devkit-reviews (FAILURE)');
  assert.deepEqual(j.items[5].details, { required: true, failing: [], pending: [] });
  assert.deepEqual([j.met, j.summary, j.next.step, j.next.number], [6, 'merged: archive step retro', 'retro', 88]);
  assert.equal(j.next.forced.count, 4);
});

test(`${FMP}: N6 every task ticked with devkit-reviews FAILURE stays delivered with today's reason and reads no check`, () => {
  const t = pm({ mergedPrs: [PR88] });
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '9.6'] }));
  t.gh.set('pr-view-88', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  const s = stateOf(t);
  assert.equal(s.forced, null);
  assert.equal(s.unreadMerge, null);
  const n = nextStep(s);
  assert.deepEqual([n.step, n.reason, n.number], ['retro', 'the change PR is merged; run the retro', 88]);
  assert.equal('forced' in n, false);
  assert.equal(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '88'), false, 'no pr view 88 call');
});

test(`${FMP}: N7 a forced merge that bumped the release with no tag asks tag-release before the retro`, () => {
  const t = forcedFixtures(pm({ extra: 'devkit:\n  release_tag: release.json\n' }));
  const merge = '1'.repeat(40);
  const parent = '2'.repeat(40);
  const json = (v) => ({ stdout: { type: 'file', encoding: 'base64', content: Buffer.from(JSON.stringify({ version: v })).toString('base64') } });
  t.gh.set(fmpRoute('pulls/12'), { stdout: { number: 12, merged: true, base: { ref: 'main' }, merge_commit_sha: merge } });
  t.gh.set(contentsKey('release.json', merge), json('1.3.0'));
  t.gh.set(fmpRoute(`git/commits/${merge}`), { stdout: { parents: [{ sha: parent }] } });
  t.gh.set(contentsKey('release.json', parent), json('1.2.0'));
  t.gh.set(fmpRoute('git/ref/tags/v1.3.0'), NOT_FOUND);
  const n = t.next();
  assert.deepEqual([n.step, n.tag, n.number, n.merged], ['tag-release', 'v1.3.0', 12, 'change']);
  t.gh.set(fmpRoute('git/ref/tags/v1.3.0'), { stdout: { ref: 'refs/tags/v1.3.0', object: { type: 'commit', sha: merge } } });
  assert.equal(t.next().step, 'retro');
  assert.equal(t.next().forced.count, 4);
});

test(`${FMP}: N8 a forced merge with every proposal answered archives, then ticks the roadmap, then opens the archive pull request`, () => {
  const t = forcedFixtures(pm());
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved' })));
  const archive = t.next();
  assert.equal(archive.step, 'archive');
  assert.equal(archive.create, true);
  const left = tasksText({ ticked: ['1.1'], unticked: ['9.6'] });
  const unticked = onArchiveBranch({ files: { 'CONTRIBUTING.md': 'new\n', 'openspec/roadmap.md': '## Round 3\n- [ ] feat\n' } });
  unticked.gh.tasksOnDefault('feat', left);
  assert.equal(unticked.next().step, 'tick-roadmap');
  assert.equal(unticked.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, 'an archived change reads no forced merge');
  const done = onArchiveBranch();
  done.gh.tasksOnDefault('feat', left);
  assert.equal(done.next().step, 'open-archive-pr');
});

test(`${FMP}: N9 a forced merge whose retro has an unanswered proposal stops for the owner's answers`, () => {
  const t = forcedFixtures(pm());
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'])));
  const n = t.next();
  assert.equal(n.step, 'stop-retro-answers');
  assert.equal(n.proposals.length, 1);
});

test(`${FMP}: N10 a run on a forced merge leaves tasks.md, readiness.md, approval.md, evidence.md and reviews/ byte-identical`, () => {
  const t = forcedPm();
  const files = {
    'openspec/changes/feat/readiness.md': '# Readiness\n\n- Status: APPROVED\n',
    'openspec/changes/feat/approval.md': '# Approval\n\n- Status: APPROVED\n',
    'openspec/changes/feat/evidence.md': STAGE('failed', PR88_HEAD),
    'openspec/changes/feat/reviews/code-quality-reviewer.md': verdictText('rejected', PR88_HEAD),
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': verdictText('approved', PR88_HEAD),
  };
  put(t.root, files);
  const read = () => Object.fromEntries(['openspec/changes/feat/tasks.md', ...Object.keys(files)].map((f) => [f, readFileSync(join(t.root, f), 'utf8')]));
  const before = read();
  const statusBefore = git(t.root, 'status', '--short');
  const r = DC.main(['feat', '--json'], { ...t.env, DEVKIT_HOST: 'cli' }, t.root);
  assert.equal(JSON.parse(r.stdout).next.step, 'retro');
  assert.deepEqual(read(), before);
  assert.equal(git(t.root, 'status', '--short'), statusBefore, 'nothing else was written');
});

// ---- L: finding the merged pull request (D-1)

const cap = (extra = []) => [...Array.from({ length: 100 - extra.length }, (_, i) => ({ ...AUTO_ARCHIVE, number: 300 + i, headRefName: `chore/archive-n${i}` })), ...extra];
const COMMITS_KEY = (id, base = 'main') => fmpRoute(`commits?sha=${base}&path=openspec/changes/${id}/tasks.md&per_page=10`);
const PULLS_KEY = (sha) => fmpRoute(`commits/${sha}/pulls`);
const restPr = (over = {}) => ({ number: 5, html_url: 'https://github.com/o/r/pull/5', state: 'closed', merged_at: '2026-11-09T14:56:00Z', base: { ref: 'main' }, head: { ref: 'calm-badger', sha: 'a'.repeat(40) }, ...over });
const SHA1 = '1'.repeat(40);
const SHA2 = '2'.repeat(40);
const SHA3 = '3'.repeat(40);
const commitCalls = (t) => t.gh.calls().filter((c) => c[0] === 'api' && /\/commits/.test(c[1] ?? ''));

test(`${FMP}: L1 a full list of 100 with none of the change's own is searched by the commits that changed its tasks.md`, () => {
  const t = findRepo(cap([AUTO_DOCS]));
  t.gh.set(COMMITS_KEY('auto-merge'), { stdout: [{ sha: SHA1 }, { sha: SHA2 }] });
  t.gh.set(PULLS_KEY(SHA1), { stdout: [restPr()] });
  t.gh.prFiles(5, ['openspec/changes/auto-merge/tasks.md', 'src/a.ts']);
  const found = t.find('main');
  assert.equal(found.via, 'commit', JSON.stringify(found));
  assert.deepEqual(found.pr, { number: 5, url: 'https://github.com/o/r/pull/5', state: 'MERGED', headRefOid: 'a'.repeat(40), headRefName: 'calm-badger', baseRefName: 'main', mergedAt: '2026-11-09T14:56:00Z' });
  assert.deepEqual(commitCalls(t).map((c) => c[1]), [
    'repos/{owner}/{repo}/commits?sha=main&path=openspec/changes/auto-merge/tasks.md&per_page=10',
    `repos/{owner}/{repo}/commits/${SHA1}/pulls`,
  ], 'the first commit that gives an own pull request ends the search');
});

test(`${FMP}: L1 the commit arm takes the default branch from the repository settings, and the configured base in two-prs`, () => {
  const t = findRepo(cap());
  t.gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'trunk' } });
  t.gh.set(COMMITS_KEY('auto-merge', 'trunk'), { stdout: [{ sha: SHA1 }] });
  t.gh.set(PULLS_KEY(SHA1), { stdout: [restPr({ base: { ref: 'trunk' } })] });
  t.gh.prFiles(5, ['openspec/changes/auto-merge/tasks.md']);
  assert.equal(t.find('main').via, 'commit');
  const two = findRepo(cap());
  two.gh.set(COMMITS_KEY('auto-merge', 'release'), { stdout: [{ sha: SHA1 }] });
  two.gh.set(PULLS_KEY(SHA1), { stdout: [restPr({ base: { ref: 'release' } })] });
  two.gh.prFiles(5, ['openspec/changes/auto-merge/tasks.md']);
  assert.equal(two.find('main', { base: 'release' }).via, 'commit');
});

test(`${FMP}: L2 the commit arm skips an archive head, another base and an unmerged pull request, then answers none`, () => {
  const t = findRepo(cap());
  t.gh.set(COMMITS_KEY('auto-merge'), { stdout: [{ sha: SHA1 }, { sha: SHA2 }, { sha: SHA3 }] });
  t.gh.set(PULLS_KEY(SHA1), { stdout: [
    restPr({ number: 61, head: { ref: 'chore/archive-auto-merge', sha: 'a'.repeat(40) } }),
    restPr({ number: 62, base: { ref: 'develop' } }),
    restPr({ number: 63, merged_at: null, state: 'open' }),
  ] });
  t.gh.set(PULLS_KEY(SHA2), { stdout: [] });
  t.gh.set(PULLS_KEY(SHA3), { stdout: [restPr({ number: 77 })] });
  t.gh.prFiles(77, ['src/other.ts']);
  assert.deepEqual(t.find('main'), { none: true });
  assert.equal(t.gh.calls().some((c) => /pulls\/(61|62|63)\/files/.test(c[1] ?? '')), false, 'a skipped pull request is not read');
  assert.equal(t.gh.calls().some((c) => /pulls\/77\/files/.test(c[1] ?? '')), true, 'a candidate is read for its files');
});

test(`${FMP}: L3 findChangePr answers an error naming the commit arm when either commit route fails`, () => {
  const first = findRepo(cap());
  first.gh.set(COMMITS_KEY('auto-merge'), BOOM);
  assert.deepEqual(first.find('main'), { error: 'gh: boom', arm: 'commit' });
  const second = findRepo(cap());
  second.gh.set(COMMITS_KEY('auto-merge'), { stdout: [{ sha: SHA1 }] });
  second.gh.set(PULLS_KEY(SHA1), BOOM);
  assert.deepEqual(second.find('main'), { error: 'gh: boom', arm: 'commit' });
  const notList = findRepo(cap());
  notList.gh.set(COMMITS_KEY('auto-merge'), { stdout: { message: 'x' } });
  assert.equal(notList.find('main').arm, 'commit');
  const noBase = findRepo(cap());
  noBase.gh.set('api-GET-repos__owner___repo_', BOOM);
  assert.deepEqual(noBase.find('main'), { error: 'gh: boom', arm: 'commit' });
});

test(`${FMP}: L3 an unreadable commit arm blocks from the default branch and from another change's branch, and never answers stop-branch`, () => {
  const prs = cap().map((p) => mergedPr({ number: p.number, headRefName: p.headRefName }));
  for (const [branch, breakIt] of [
    ['main', (t) => t.gh.set(COMMITS_KEY('feat'), BOOM)],
    ['ship/other', (t) => { t.gh.set(COMMITS_KEY('feat'), { stdout: [{ sha: SHA1 }] }); t.gh.set(PULLS_KEY(SHA1), BOOM); }],
  ]) {
    const t = pm({ branch, mergedPrs: prs });
    breakIt(t);
    const s = stateOf(t);
    assert.deepEqual(s.unreadMerge, { number: null, error: 'gh: boom' }, branch);
    assert.equal(s.mergedLeft, null, branch);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.reason], ['blocked', 'cannot find the merged pull request of feat: gh: boom'], branch);
  }
});

// The commit arm's success path composed with the delivery: a full list of 100 merged pull requests, none the change's own (archive heads),
// the change's branch deleted, and GitHub's commits of the default branch that changed its tasks.md lead to pull request 12 (head `b`*40).
// `ticked`/`unticked` and the `rollup` of pull request 12 are the case's; the gate files at the head are PR 88's shape (evidence missing, one
// reviewer REJECTED). Returns the repository on `branch`.
function commitArmPm({ branch = 'main', ...fixtures } = {}) {
  const prs = cap().map((p) => mergedPr({ number: p.number, headRefName: p.headRefName }));
  const t = forcedFixtures(pm({ branch, mergedPrs: prs }), fixtures);
  t.gh.set(COMMITS_KEY('feat'), { stdout: [{ sha: SHA1 }] });
  t.gh.set(PULLS_KEY(SHA1), { stdout: [restPr({ number: 12, html_url: 'https://github.com/o/r/pull/12', head: { ref: 'ship/feat', sha: 'b'.repeat(40) } })] });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  return t;
}
const viaOf = (t, branch) => DC.deliveryOf(makeGh(t.root, t.env), t.root, 'feat', { ship: 'merge', branch, env: t.env, mergeFields: true }).fetched.via;
const commitRoutes = ['repos/{owner}/{repo}/commits?sha=main&path=openspec/changes/feat/tasks.md&per_page=10', `repos/{owner}/{repo}/commits/${SHA1}/pulls`];

// Invariant: a pull request the commit arm found is judged like one the list arm finds: with a task left and a required check red it is the
// owner's forced merge, named by its number and its real count. Layer: findChangePr's commit arm composed with deliveryOf, collectState and
// nextStep (deliver-check). Suite: deliver-check-archive.
test(`${FMP}: L5 a pull request found by the commit arm with a task left and devkit-reviews FAILURE answers the retro with the real count, from the default branch and another change's branch`, () => {
  for (const branch of ['main', 'ship/other']) {
    const t = commitArmPm({ branch });
    const s = stateOf(t);
    assert.equal(s.unreadMerge, null, branch);
    assert.equal(s.mergedLeft, null, branch);
    assert.deepEqual([s.forced?.number, s.forced?.url, s.forced?.head, s.forced?.count], [12, 'https://github.com/o/r/pull/12', 'b'.repeat(40), 4], branch);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.number, n.forced.count], ['retro', 12, 4], branch);
    assert.equal(n.reason, 'PR #12 merged by the owner with 4 items open: task 9.6; devkit-reviews (FAILURE); evidence.md (missing); reviews/code-quality-reviewer.md (verdict REJECTED); run the retro', branch);
    assert.deepEqual(commitRoutes.filter((r) => commitCalls(t).some((c) => c[1] === r)), commitRoutes, `${branch}: the commit arm found it`);
    assert.equal(viaOf(commitArmPm({ branch }), branch), 'commit', branch);
  }
});

// Invariant: a pull request the commit arm found, with a task left and every required check green, is a partial merge: stop-branch, never a forced
// merge, and its checks' gate files are not read. Layer and suite as L5.
test(`${FMP}: L6 a pull request found by the commit arm with a task left and every required check green stops at the branch, with no forced fact`, () => {
  const t = commitArmPm({ rollup: [OKRUN('check'), OKRUN('devkit-reviews')] });
  const s = stateOf(t);
  assert.equal(s.forced, null);
  assert.equal(s.unreadMerge, null);
  assert.deepEqual(s.mergedLeft, { number: 12, tasks: ['9.6'] });
  const n = nextStep(s);
  assert.deepEqual([n.step, n.number, n.tasks], ['stop-branch', 12, ['9.6']]);
  assert.equal(n.reason, 'PR #12 of feat merged with tasks left (9.6); continue on branch feat and open a further pull request');
  assert.equal('forced' in n, false);
  assert.equal(commitCalls(t).some((c) => c[1] === commitRoutes[1]), true, 'the commit arm found it');
  assert.equal(t.gh.calls().some((c) => c[0] === 'api' && /contents\/openspec\/changes\/feat\/(evidence\.md|reviews)/.test(c[1] ?? '')), false, 'no gate file read');
  assert.equal(viaOf(commitArmPm({ rollup: [OKRUN('check'), OKRUN('devkit-reviews')] }), 'main'), 'commit');
});

// Invariant: a pull request the commit arm found, with every task ticked, is delivered whatever its checks said, with today's retro reason and
// no read of its rollup. Layer and suite as L5.
test(`${FMP}: L7 a pull request found by the commit arm with every task ticked is delivered, answers today's retro row and is never forced`, () => {
  const t = commitArmPm({ ticked: ['1.1', '1.2', '9.6'], unticked: [] });
  const s = stateOf(t);
  assert.equal(s.forced, null);
  assert.equal(s.unreadMerge, null);
  assert.equal(s.mergedLeft, null);
  const n = nextStep(s);
  assert.deepEqual([n.step, n.reason, n.number], ['retro', 'the change PR is merged; run the retro', 12]);
  assert.equal('forced' in n, false);
  assert.equal(commitCalls(t).some((c) => c[1] === commitRoutes[1]), true, 'the commit arm found it');
  assert.equal(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, 'no rollup read');
  assert.equal(viaOf(commitArmPm({ ticked: ['1.1', '1.2', '9.6'], unticked: [] }), 'main'), 'commit');
});

test(`${FMP}: L4 a list of three with none of the change's own reads no commit`, () => {
  const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, { ...AUTO_DOCS, number: 10 }]);
  assert.deepEqual(t.find('main'), { none: true });
  assert.deepEqual(commitCalls(t), []);
  const own = findRepo(cap([AUTO]));
  assert.equal(own.find('main').via, 'list', 'a full list that holds the change\'s own is not searched further');
  assert.deepEqual(commitCalls(own), []);
});

// ---- R: the archive pull request's check never reads the archived tasks (D-9)

test(`${FMP}: R1 the archive check passes with an archived tasks.md that has an unticked task and no evidence, and fails on an unanswered proposal`, () => {
  const tasks = '## 9. Last\n- [x] 9.1 done\n- [ ] 9.6 left after the merge\n';
  const root = archivePrRepo({ files: { 'openspec/changes/archive/2026-11-09-x/tasks.md': tasks } });
  assert.equal(existsSync(join(root, 'openspec/changes/archive/2026-11-09-x/evidence.md')), false);
  const ok = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.equal(ok.out.trimEnd().split('\n').at(-1), 'pass');
  const open = archivePrRepo({ files: { 'openspec/changes/archive/2026-11-09-x/tasks.md': tasks }, retro: '## Proposed updates\n\n### `src/a.ts` (process-friction)\nSummary.\n' });
  const bad = runCi(open, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(bad.code, 1, bad.out + bad.err);
});

// ---- T: an owner's forced merge in a project that runs the delivery train (ADR 0022; this repository sets devkit.delivery.train)

// The settings of this repository: ship merge through the model trunk-auto, and the whole-suite command of the train.
const TRAIN_CONFIG = `devkit:\n  delivery:\n    model: trunk-auto\n    train: "${TRAIN_SUITE}"\n`;
const OWN_HEAD = 'b'.repeat(40);
const TRAIN_HEAD = 'a'.repeat(40);
const TRAIN_MERGE = '9'.repeat(40);
const trainPr = { number: 40, url: 'https://github.com/o/r/pull/40', state: 'MERGED', headRefName: 'train/4', headRefOid: TRAIN_HEAD, mergedAt: '2026-11-09T15:00:00Z', mergeCommit: { oid: TRAIN_MERGE } };

// A merged train, pull request 40 on `train/4`, whose record lists change `feat` at `head`, the head of its own pull request 12.
function carriedByTrain(t, { head = OWN_HEAD } = {}) {
  t.gh.set('pr-list-state-all', { stdout: [trainPr] });
  t.gh.set(contentsKey('openspec/trains/4.md', TRAIN_HEAD), fileFx(recordText({ n: 4, boarded: [{ id: 'feat', number: 12, head }] })));
  return t;
}

// Invariant: a project that sets the train still reads its own pull request's merge, and a merge no train carried with tasks left and a required
// check not green is an owner's forced merge, never an implement or stop-branch. Layer: deliveryOf and nextStep (deliver-check). Suite: deliver-check-archive.
test('forced-merge-path T1: a train project reads a merged own pull request with a task left and devkit-reviews FAILURE as a forced merge, from every checkout', () => {
  const REASON = /^PR #12 merged by the owner with 4 items open: task 9\.6; devkit-reviews \(FAILURE\); evidence\.md \(missing\); reviews\/code-quality-reviewer\.md \(verdict REJECTED\); run the retro$/;
  const cases = {
    'the default branch': () => forcedFixtures(pm({ extra: TRAIN_CONFIG })),
    "another change's branch": () => forcedFixtures(pm({ extra: TRAIN_CONFIG, branch: 'ship/other' })),
    "the change's own branch": () => forcedOnBranch({ n: 12, extra: TRAIN_CONFIG }),
  };
  for (const [where, build] of Object.entries(cases)) {
    const t = build();
    const s = stateOf(t);
    assert.equal(s.train?.suite, TRAIN_SUITE, `${where}: the train is on`);
    assert.equal(s.train.carried, null, `${where}: no train carries the change`);
    assert.equal(s.unreadMerge, null, where);
    assert.equal(s.forced?.count, 4, where);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.number, n.forced.count], ['retro', 12, 4], where);
    assert.match(n.reason, REASON, where);
    assert.ok(!['implement', 'stop-branch'].includes(n.step), where);
    assert.ok(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('all')), `${where}: the train list was read`);
  }
});

// Invariant: a merge carried by a merged train is the train's delivery, never a forced merge: `deliveryOf` reads no rollup for it, whatever the
// required checks said on the change's own pull request. Layer: deliveryOf and nextStep (deliver-check). Suite: deliver-check-archive.
test('forced-merge-path T2: a change a merged train carried is delivered with every task ticked, and is never forced with a task left', () => {
  // Every task ticked: delivered by the train, the retro row of today, no forced read.
  const done = carriedByTrain(pm({ extra: TRAIN_CONFIG }));
  done.gh.set('pr-view-12', rollupFx([OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')]));
  const delivered = stateOf(done);
  assert.deepEqual(delivered.carriedBy, { n: 4, number: 40, mergeCommit: TRAIN_MERGE });
  assert.equal(delivered.forced, null);
  const retro = nextStep(delivered);
  assert.deepEqual([retro.step, retro.reason, retro.number], ['retro', 'the change PR is merged; run the retro', 12]);
  assert.equal('forced' in retro, false);
  assert.equal(done.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, 'no rollup read');

  // A task left: the train's merge is not forced, whether the checks are green or one of them failed on the change's own pull request.
  const rollups = { 'checks green': [OKRUN('check'), OKRUN('devkit-reviews')], 'devkit-reviews FAILURE': [OKRUN('check'), RUNOF('devkit-reviews', 'FAILURE')] };
  const answers = {};
  for (const [name, rollup] of Object.entries(rollups)) {
    const t = forcedFixtures(carriedByTrain(pm({ extra: TRAIN_CONFIG })), { rollup });
    const s = stateOf(t);
    const d = DC.deliveryOf(makeGh(t.root, t.env), t.root, 'feat', { ship: 'merge', branch: 'main', env: t.env, mergeFields: true, trainSuite: TRAIN_SUITE });
    assert.equal(d.trainFacts.carried?.number, 40, `${name}: the train carries it`);
    assert.deepEqual([d.delivered, d.forced, d.unreadMerge], [false, null, null], name);
    assert.equal(s.forced, null, name);
    assert.equal(s.unreadMerge, null, name);
    const n = nextStep(s);
    answers[name] = [n.step, n.reason];
    assert.notEqual(n.step, 'retro', name);
    assert.doesNotMatch(n.reason, /merged by the owner/, name);
    assert.equal('forced' in n, false, name);
    assert.equal(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === '12'), false, `${name}: no rollup read`);
  }
  assert.deepEqual(answers['devkit-reviews FAILURE'], answers['checks green'], 'the answer does not depend on the checks');
  // The answer main's train path gives today for a merge with tasks left (field-fixes 4), unchanged.
  assert.deepEqual(answers['checks green'], ['stop-branch', 'PR #12 of feat merged with tasks left (9.6); continue on branch feat and open a further pull request']);
});

// A train project on the default branch after a forced merge of pull request 12: the change's stage files are passed, its tasks.md holds the
// task 9.6 the owner left, GitHub answers what forcedFixtures says.
function forcedLoopProject() {
  const t = forcedFixtures(pm({ extra: TRAIN_CONFIG }));
  const c0 = head(t.root);
  const stage = (id, body = `# ${id}\n`) => `<!-- devkit-stage ${id} result=passed attempt=1 commit=${c0} -->\n${body}`;
  put(t.root, Object.fromEntries(Object.entries({
    '.openspec.yaml': 'schema: devkit-lite\n',
    'requirements.md': stage('requirements'),
    'proposal.md': stage('proposal', proposalWithAcceptance()),
    'specs/s/spec.md': stage('specs'),
    'tasks.md': stage('tasks', '# Tasks\n\n- [x] 1.1 a\n- [x] 1.2 b\n- [ ] 9.6 left after the merge\n'),
    'evidence.md': stage('evidence'),
    'review.md': stage('review'),
  }).map(([f, body]) => [`openspec/changes/feat/${f}`, body])));
  commitAll(t.root, 'change files');
  return t;
}
const proposalWithAcceptance = () => '# Proposal\n\n## Acceptance criteria\n\n- AC-1: something\n';

// Invariant: the loop's `next` turns the forced retro row of a train project into the retro session step, whose reply tells the owner the
// pull request and the count (forced-merge-path D-6). Layer: change-loop `next` over collectState and deliveryRow. Suite: deliver-check-archive.
test('forced-merge-path T3: change-loop next in a train project answers the retro session step with the reply naming the pull request and the count', () => {
  const t = forcedLoopProject();
  const env = { ...t.env, ...SET_LOOP };
  const r = loopMain(['next', '--change', 'feat', '--lang', 'en'], { cwd: t.root, env, gh: makeGh(t.root, env) });
  const action = actionOf(r.stdout);
  assert.deepEqual([r.code, action.kind, action.step, action.stage], [0, 'session', 'retro', 'retro'], r.stdout + r.stderr);
  assert.equal(action.detail.forced.count, 4);
  assert.match(action.reply, /pull request #12 of feat with 4 items still open/);
});

// ---- loop-place-and-evidence: the change folder is committed before a review round (spec change-delivery)
// Invariant: the review round runs on a clean change folder, so no verdict carries `(uncommitted changes)` for it.
// Layer: deliver-check collectState (the folderDirty fact) and nextStep (the commit before review). Suite: deliver-check.

const FOLDER = 'openspec/changes/feat';
const folderState = (over = {}) => state({ folderDirty: [`${FOLDER}/evidence.md`], items: { 2: open({ missing: ['code-quality-reviewer'] }) }, ...over });

test('loop-evidence 1: a dirty change folder before review answers commit with no paths', () => {
  const n = nextStep(folderState());
  assert.deepEqual([n.step, n.paths], ['commit', []]);
  assert.equal(n.reason, `uncommitted files in the change folder before the review round: ${FOLDER}/evidence.md`);
});

test('loop-evidence 2: with the folder clean or the field absent the review answer is unchanged', () => {
  const missing = folderState();
  for (const s of [{ ...missing, folderDirty: [] }, (({ folderDirty: _f, ...rest }) => rest)(missing)]) {
    const n = nextStep(s);
    assert.deepEqual([n.step, n.reviewers, n.round], ['review', ['code-quality-reviewer'], 1]);
  }
  const failed = (over) => rejectedState({
    reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: false }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
    items: { 2: open({ stale: ['code-quality-reviewer'] }), 3: open({ undisposed: [] }) },
    ...over,
  });
  const base2 = failed({ folderDirty: [] });
  const { folderDirty: _g, ...absent } = base2;
  for (const s of [base2, absent]) {
    const n = nextStep(s);
    assert.deepEqual([n.step, n.reviewers, n.round], ['review', ['code-quality-reviewer'], 2]);
  }
});

test('loop-evidence 3: product paths dirty with the folder answer the product commit once', () => {
  const n = nextStep(folderState({ dirty: ['src/a.ts'] }));
  assert.deepEqual([n.step, n.paths], ['commit', ['src/a.ts']]);
  assert.match(n.reason, /^uncommitted changes outside openspec\//);
});

test('loop-evidence 4: a dirty folder never comes before verify, fix-defect, fix-review or the round-2 stop', () => {
  const folderDirty = [`${FOLDER}/tasks.md`];
  const missing = { 2: open({ missing: ['code-quality-reviewer'] }) };
  assert.equal(nextStep(state({ folderDirty, items: { ...missing, 1: open({ evidence: 'stale', missingGates: [] }) } })).step, 'verify');
  assert.equal(nextStep(state({ folderDirty, items: { ...missing, 4: open({ defects: ['AC-1'], proven: [] }) } })).step, 'fix-defect');
  assert.equal(nextStep(rejectedState({ folderDirty })).step, 'fix-review');
  assert.equal(nextStep(rejectedState({ folderDirty, reviewMd: { consensus: 'FAIL', round: 2 } })).step, 'stop-review-deadlock');
});

test('loop-evidence 5: a dirty folder with no reviewer to run changes nothing', () => {
  const folderDirty = [`${FOLDER}/reviews/code-quality-reviewer.md`];
  assert.equal(nextStep(state({ folderDirty })).step, 'ready');
  assert.equal(nextStep(state({ folderDirty, items: { 5: open({ none: true }) } })).step, 'open-pr');
});

test('loop-evidence 6: the reason names at most three folder paths', () => {
  const n = nextStep(folderState({ folderDirty: ['a.md', 'b.md', 'c.md', 'd.md'].map((f) => `${FOLDER}/${f}`) }));
  assert.equal(n.step, 'commit');
  for (const f of ['a.md', 'b.md', 'c.md']) assert.ok(n.reason.includes(`${FOLDER}/${f}`), n.reason);
  assert.ok(!n.reason.includes('d.md'), n.reason);
  assert.deepEqual(n.paths, []);
});

test('loop-evidence 7: evidence.md uncommitted alone answers commit, and once committed review with the same reviewers and round', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  assert.deepEqual(collectState(t.root, 'feat', { env: t.env }).folderDirty, [`${FOLDER}/evidence.md`]);
  let n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', []]);
  commitAll(t.root, 'evidence');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers, n.round], ['review', BOTH, 1]);
});

test('loop-evidence 8: a modified evidence.md alone answers commit', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  ev(t.root, `${readFileSync(join(t.root, FOLDER, 'evidence.md'), 'utf8')}\n`);
  const n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', []]);
});

test('loop-evidence 9: a ticked tasks.md uncommitted alone answers commit', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2');
  commitAll(t.root, 'code');
  tick(t.root, '2.3');
  fullEvidence(t.root, t.env);
  git(t.root, 'add', '--', `${FOLDER}/evidence.md`);
  git(t.root, 'commit', '-q', '-m', 'evidence');
  assert.deepEqual(git(t.root, 'status', '--porcelain').split('\n').map((l) => l.replace(/^\s*\S+\s+/, '')), [`${FOLDER}/tasks.md`]);
  let n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', []]);
  commitAll(t.root, 'tick');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers, n.round], ['review', BOTH, 1]);
});

test('loop-evidence 10: an untracked file, then the same file staged, answer commit and are named', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  put(t.root, { [`${FOLDER}/proof/red-1.txt`]: 'red\n' });
  let n = t.next();
  assert.equal(n.step, 'commit');
  assert.ok(n.reason.endsWith(`${FOLDER}/proof/red-1.txt`), n.reason);
  git(t.root, 'add', '--', `${FOLDER}/proof/red-1.txt`);
  n = t.next();
  assert.equal(n.step, 'commit');
  assert.ok(n.reason.endsWith(`${FOLDER}/proof/red-1.txt`), n.reason);
  commitAll(t.root, 'proof');
  assert.equal(t.next().step, 'review');
});

test('loop-evidence 11: product code dirty with the folder: the product commit, verify, the folder commit, then review', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  put(t.root, { 'src/a.ts': 'changed\n' });
  let n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', ['src/a.ts']]);
  commitAll(t.root, 'product');
  assert.equal(t.next().step, 'verify');
  fullEvidence(t.root, t.env);
  n = t.next();
  assert.deepEqual([n.step, n.paths], ['commit', []]);
  commitAll(t.root, 'evidence');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', BOTH]);
});

test('loop-evidence 12: paths outside the change folder do not count', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  put(t.root, { 'openspec/changes/featx/tasks.md': 'x\n', 'openspec/config.yaml': `${readFileSync(join(t.root, 'openspec/config.yaml'), 'utf8')}# x\n` });
  assert.deepEqual(collectState(t.root, 'feat', { env: t.env }).folderDirty, []);
  assert.equal(t.next().step, 'review');
});

test('loop-evidence 13: a round recorded after the commit step is current; one marked uncommitted is not', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  reviewAt(t.root, BOTH);
  assert.equal(itemsOf(t)[1].status, 'met');
  assert.equal(t.next().step, 'open-pr');
  put(t.root, withReviews(Object.fromEntries(BOTH.map((n) => [n, review('approved', head(t.root), ' (uncommitted changes)')]))));
  const two = itemsOf(t)[1];
  assert.equal(two.status, 'open');
  assert.deepEqual([...two.details.stale].sort(), BOTH);
});

test('loop-evidence 14: collectState lists the folder\'s modified, staged, untracked and renamed paths', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
  writeFileSync(join(t.root, FOLDER, 'tasks.md'), `${readFileSync(join(t.root, FOLDER, 'tasks.md'), 'utf8')}\n<!-- note -->\n`);
  put(t.root, { [`${FOLDER}/notes.md`]: 'n\n' });
  git(t.root, 'add', '--', `${FOLDER}/notes.md`);
  put(t.root, { [`${FOLDER}/proof/x.txt`]: 'x\n' });
  git(t.root, 'mv', `${FOLDER}/proposal.md`, `${FOLDER}/proposal-old.md`);
  const dirty = [...(collectState(t.root, 'feat', { env: t.env }).folderDirty ?? [])].sort();
  assert.deepEqual(dirty, [`${FOLDER}/notes.md`, `${FOLDER}/proof/x.txt`, `${FOLDER}/proposal-old.md`, `${FOLDER}/tasks.md`]);
});

// ---------------------------------------------------------------- coordinator-loop-fixes: an id that starts with archive- keeps its own pull request (D-20)
// Invariant: a head equal to the change's own id is that change's branch, whatever its prefix; any other head isArchiveHead accepts
// is an archive head and never the change's own pull request. isOwnPr and the merged-list search of findChangePr read it through
// foreignArchiveHead; the file rule is unchanged. Layer: deliver-check's exported functions, findChangePr with a fake gh.
// Suite: deliver-check-archive.

const D20_ROWS = [
  ['archive-x', 'archive-x', false],
  ['archive-x', 'chore/archive-archive-x', true],
  ['archive-x', 'archive-archive-x', true],
  ['x', 'chore/archive-x', true],
  ['x', 'archive-x', true],
  ['archive-x', 'archive-y', true],
  ['x', 'archive-y', true],
  ['x', 'ship/x', false],
];

test('coordinator-loop-fixes AC-17 T119 foreignArchiveHead: every row of the D-20 table, and an absent head is false', () => {
  assert.equal(typeof DC.foreignArchiveHead, 'function');
  for (const [id, head, want] of D20_ROWS) assert.equal(DC.foreignArchiveHead(id, head), want, `${id} / ${head}`);
  assert.equal(DC.foreignArchiveHead('archive-x', undefined), false);
  assert.equal(DC.foreignArchiveHead('archive-x', null), false);
});

const ownOf = (id, head, files) => DC.isOwnPr(id, { headRefName: head }, files);

test('coordinator-loop-fixes AC-17 T120 isOwnPr: a change named archive-x owns the pull request of its own head; its archive heads do not', () => {
  const files = ['openspec/changes/archive-x/tasks.md'];
  assert.equal(ownOf('archive-x', 'archive-x', files), true);
  assert.equal(ownOf('archive-x', 'chore/archive-archive-x', files), false);
  assert.equal(ownOf('archive-x', 'archive-archive-x', files), false);
});

test('coordinator-loop-fixes AC-17 T121 isOwnPr: the archive heads of change x stay foreign, and ship/x stays its own', () => {
  const files = ['openspec/changes/x/tasks.md'];
  assert.equal(ownOf('x', 'chore/archive-x', files), false);
  assert.equal(ownOf('x', 'archive-x', files), false);
  assert.equal(ownOf('x', 'ship/x', files), true);
});

test('coordinator-loop-fixes AC-17 T122 isOwnPr: a foreign archive head is never own, and the own head still needs a file of the change', () => {
  assert.equal(ownOf('archive-x', 'archive-y', ['openspec/changes/archive-x/tasks.md']), false);
  assert.equal(ownOf('x', 'archive-y', ['openspec/changes/x/tasks.md']), false);
  assert.equal(ownOf('archive-x', 'archive-x', ['openspec/changes/other/tasks.md']), false, 'the file rule');
});

const ARCHIVE_X = { number: 31, url: 'https://github.com/o/r/pull/31', state: 'MERGED', headRefName: 'archive-x', headRefOid: 'c'.repeat(40), baseRefName: 'main', mergedAt: '2026-11-20T10:00:00Z', mergeable: 'UNKNOWN', body: '' };
const ARCHIVE_OF_X = { ...ARCHIVE_X, number: 32, headRefName: 'chore/archive-archive-x', mergedAt: '2026-11-21T10:00:00Z' };
function archiveIdRepo(prs) {
  const root = gitRepo({ changes: { 'archive-x': { '.openspec.yaml': 'schema: devkit-lite\n' } } });
  const gh = fakeGh();
  gh.set('pr-list-state-merged', { stdout: prs });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch\n' });
  for (const p of prs) gh.prFiles(p.number, ['openspec/changes/archive-x/tasks.md', 'src/a.ts']);
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  gh.tasksOnDefault('archive-x', tasksText({ ticked: ['1.1', '1.2'] }));
  return { root, gh, find: (branch) => findChangePr(makeGh(root, gh.env), root, 'archive-x', { ship: 'merge', branch, env: {} }) };
}

test('coordinator-loop-fixes AC-17 T123 findChangePr (merge): the merged pull request of head archive-x is the change archive-x\'s, from main and on its branch', () => {
  const list = archiveIdRepo([ARCHIVE_X]).find('main');
  assert.equal(list.pr?.number, 31, JSON.stringify(list));
  assert.equal(list.via, 'list');
  const t = archiveIdRepo([ARCHIVE_X]);
  t.gh.set('pr-view', { stdout: ARCHIVE_X });
  const own = t.find('archive-x');
  assert.equal(own.pr?.number, 31, JSON.stringify(own));
  assert.equal(own.none, undefined);
  assert.deepEqual(archiveIdRepo([ARCHIVE_OF_X]).find('main'), { none: true }, 'only the archive of archive-x');
});

// Invariant: the commit lookup (the arm reached when the merged list is full) keeps the own pull request of a change whose id starts with
// `archive-`, and still skips that change's archive heads unread. Layer: findChangePr's commit arm, findByCommits (deliver-check). Suite:
// deliver-check-archive.
test('coordinator-loop-fixes AC-17 T142 findChangePr (merge): the commit lookup answers the pull request of head archive-x for the change archive-x, and skips its archive heads unread', () => {
  const ownCommitPr = restPr({ number: 41, html_url: 'https://github.com/o/r/pull/41', head: { ref: 'archive-x', sha: 'c'.repeat(40) } });
  const own = archiveIdRepo(cap());
  own.gh.set(COMMITS_KEY('archive-x'), { stdout: [{ sha: SHA1 }] });
  own.gh.set(PULLS_KEY(SHA1), { stdout: [ownCommitPr] });
  own.gh.prFiles(41, ['openspec/changes/archive-x/tasks.md', 'src/a.ts']);
  const found = own.find('main');
  assert.equal(found.pr?.number, 41, JSON.stringify(found));
  assert.equal(found.via, 'commit');
  assert.equal(found.pr.headRefName, 'archive-x');
  const archives = archiveIdRepo(cap());
  archives.gh.set(COMMITS_KEY('archive-x'), { stdout: [{ sha: SHA1 }] });
  archives.gh.set(PULLS_KEY(SHA1), { stdout: [
    restPr({ number: 42, head: { ref: 'chore/archive-archive-x', sha: 'a'.repeat(40) } }),
    restPr({ number: 43, head: { ref: 'archive-archive-x', sha: 'a'.repeat(40) } }),
  ] });
  for (const n of [42, 43]) archives.gh.prFiles(n, ['openspec/changes/archive-x/tasks.md']);
  assert.deepEqual(archives.find('main'), { none: true });
  assert.equal(archives.gh.calls().some((c) => /pulls\/(42|43)\/files/.test(c[1] ?? '')), false, 'an archive head of archive-x is not read');
});
