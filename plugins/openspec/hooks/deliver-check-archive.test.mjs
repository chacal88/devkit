// Tests for deliver-check.mjs, part 3 of 3 (suite-speed D-11; the others are deliver-check.test.mjs and deliver-check-cli.test.mjs): the archive steps after the merge (the archive PR, the phase and its rows, the file check, the wait), the skills, agents and docs of those steps, the later field fixes, the verdict files and the commit attribution. What the three parts share is in deliver-check-fixtures.mjs.
// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync as fsRm, readFileSync, renameSync, cpSync } from 'node:fs';
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
import {
  git, gitRepo, put, commitAll, fakeGh, PR_FILES_KEY, TASKS_ON_KEY, tasksText, check, presetSetup, shipRepo, cli, runCli, mergedPr, archivePrJson,
  ARCHIVE_LISTING, ACTIVE_ON_MAIN, ARCHIVE_PRS, ARCHIVED_DIR, NOT_FOUND, retroMd, retroPath, writeRetro, pm, proposal,
} from './test-fixtures.mjs';
import {
  here, review, reviews, withReviews, base, head, mergeHistory, mergeMain, onlyOpenspec, s7, acRow, changeFiles, callGh, prJson, OLD_FLAG, versionsOf,
  tick, approvalMd, planRepo, fullEvidence, PR_BODY, driveToReady, readyRepo, committedChange, bothEvidenceCurrent, presetArchiveReads, repoRoot,
  coreAgent, runCi, ciGate, ciRepo, archivePrRepo, bothEntries, CI_ENV,
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
// The file that holds the pin block (`// Invariant: the CI snippet pins the current release`): suite-speed split change-loop.test.mjs and the block moved here.
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
  const without = (lines, i) => lines.filter((_, k) => k !== i).join('\n');
  const lines = loopLines('0.33.0', '0.32.0');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, without(lines, 5)), false, 'a removed assert.doesNotMatch line');
  const withEscaped = [...lines.slice(0, 6), "  assert.doesNotMatch(flow, /v0\\.31\\.0/, 'no pin left on main\\'s release before it (z)');", ...lines.slice(6)].join('\n');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, withEscaped), false, 'an added line whose message holds an escaped quote');
  const comment = lines.map((l) => (l.startsWith('  // Invariant:') ? l.replace('x moves it to 0.33.0', 'z moves it to 0.35.0') : l)).join('\n');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, comment), false, 'a changed Invariant comment');
  const indented = lines.map((l) => (l.startsWith('  assert.match(flow,') ? `    ${l.trimStart()}` : l)).join('\n');
  assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, indented), false, 'a form line at another indentation');
});

test('archive-release-pin 4: pinLinesOnly names a test file with any other changed line', () => {
  assert.equal(typeof DC.pinLinesOnly, 'function', 'deliver-check.mjs exports pinLinesOnly');
  const lines = loopLines('0.34.0', '0.33.0');
  const added = (line) => [...lines.slice(0, 6), line, ...lines.slice(6)].join('\n');
  const swapped = lines.slice();
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  const cases = {
    'an added assert.ok on flow': added("  assert.ok(flow.includes('x'), 'x');"),
    'an added assert.match on another subject': added("  assert.match(other, /v0\\.34\\.0/, 'm');"),
    'an added assert.match with a regular expression that is not a plain version': added("  assert.match(flow, /v0\\.34\\.\\d/, 'm');"),
    'a changed line of another test': PIN_LOOP_AFTER.replace('/0011/', '/0012/'),
    'an added comment': added('  // note'),
    'an added blank line': added(''),
    'two non-form lines swapped': swapped.join('\n'),
  };
  for (const [label, text] of Object.entries(cases)) assert.equal(pinHas(LOOP_PATH, PIN_LOOP_BEFORE, text), false, label);
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
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.pr.number, 15, 'the open pull request of the same head is the pull request');
  assert.notEqual(nextStep(s).step, 'open-pr');
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

test('review-openspec-fix 12: a plan fix written and not committed leaves a rejected verdict current', () => {
  const { root } = rejectedRepo();
  put(root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  assert.deepEqual(itemTwo(root).details.stale, []);
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

test('commit-attribution AC-2 T31 Method steps 3 and 5 point to Attribution and drop the environment rule', () => {
  const m = methodOfAgent();
  assert.equal(m.split('Attribution below').length - 1, 2, m);
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
