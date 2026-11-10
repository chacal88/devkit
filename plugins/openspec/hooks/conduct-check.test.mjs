// Tests for conduct-check.mjs (conduct-rounds design D2-D12). Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, utimesSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gitRepo, put, commitAll, git, fakeGh } from './deliver-check.test.mjs';
import { makeGh } from './merge-setup.mjs';
import { parseRoadmap, readRoadmap } from './guard.mjs';
import { conductState, planningStep, dependencyStep, deliveryStep, actorOf, selectDispatch, wakeOf, main as conductMain } from './conduct-check.mjs';

// ---------------------------------------------------------------- fixture harness (task 2.1)

const CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n  devkit: pr\n';
const cleanEnv = { ...process.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', DEVKIT_BYPASS: '' };
const real = (p) => realpathSync(p);

// A bare origin with main, a clone (the "main checkout") and, per path, its own fake gh.
export function roundRepo({ roadmap, config = CONFIG, files = {}, changes = {} } = {}) {
  const clone = gitRepo({ config, changes, files: { 'openspec/roadmap.md': roadmap, ...files } });
  const originDir = mkdtempSync(join(tmpdir(), 'devkit-origin-'));
  git(originDir, 'init', '-q', '--bare', '-b', 'main');
  git(clone, 'remote', 'add', 'origin', originDir);
  git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'fetch', '-q', 'origin');
  const main = real(clone);
  const ghs = new Map();
  const ghAt = (path) => {
    const key = real(path);
    if (!ghs.has(key)) {
      const g = fakeGh();
      g.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true } });
      g.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "x"\n' });
      g.set('pr-list', { stdout: [] });
      ghs.set(key, g);
    }
    return ghs.get(key);
  };
  const t = {
    main, originDir, ghAt,
    ghFor: (r) => makeGh(r, ghAt(r).env),
    wtPath: (id) => join(main, '.claude', 'worktrees', id),
    addWt(id, { path = t.wtPath(id), from = 'origin/main', branch = id } = {}) {
      git(main, 'worktree', 'add', '-q', '-b', branch, path, from);
      return real(path);
    },
    // Put files on origin/main (committed in the main checkout, then pushed).
    commitOrigin(files, message = 'origin change') {
      put(main, files);
      const sha = commitAll(main, message);
      git(main, 'push', '-q', 'origin', 'main');
      return sha;
    },
    originSha: () => git(main, 'rev-parse', 'origin/main'),
    state: (opts = {}, root = main) => conductState(root, { env: cleanEnv, ghFor: t.ghFor, ...opts }),
  };
  return t;
}

const roadmapOf = (...rounds) => `# Roadmap\n\n${rounds.map(([title, ...lines]) => `## ${title}\n${lines.join('\n')}\n`).join('\n')}`;
const byId = (res, id) => res.changes.find((c) => c.id === id);
const planStep = (c) => [c.next.step, c.next.actor];

// Write change files into a worktree (path -> content under openspec/changes/<id>/), untracked.
function writeChange(wt, id, files) {
  put(wt, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])));
}
const at = (file, seconds) => { const d = new Date(seconds * 1000); utimesSync(file, d, d); };
const cf = (wt, id, f) => join(wt, 'openspec', 'changes', id, f);
const T0 = Math.floor(Date.now() / 1000) - 10000;
const hashOf = (file) => `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)}`;

const PROPOSAL = '# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n';
const TASKS = '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n';

// A change whose plan files exist in `wt`, mtimes fixed (plan files at T0, readiness at T0+5, approval and audit later).
function planFiles(wt, id, { schema = 'devkit-lite', readiness = null, approved = false, tasks = TASKS } = {}) {
  const files = { '.openspec.yaml': `schema: ${schema}\n`, 'proposal.md': PROPOSAL, 'tasks.md': tasks };
  if (schema === 'devkit') Object.assign(files, { 'requirements.md': '# Requirements\n', 'design.md': '# Design\n' });
  writeChange(wt, id, files);
  for (const f of ['proposal.md', 'tasks.md', 'requirements.md', 'design.md']) if (existsSync(cf(wt, id, f))) at(cf(wt, id, f), T0);
  if (readiness) {
    writeChange(wt, id, { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` });
    at(cf(wt, id, 'readiness.md'), T0 + 5);
    if (approved) {
      writeChange(wt, id, { 'approval.md': `# Plan approval: ${id}\n\n- Status: APPROVED\n- Readiness: ${hashOf(cf(wt, id, 'readiness.md'))}\n- Date: 2026-11-09\n- Owner's words: "ok"\n` });
      at(cf(wt, id, 'approval.md'), T0 + 6);
    }
  }
}

test('conduct: harness: two worktrees read different pr-view fixtures through ghFor', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b']) });
  const a = t.addWt('a');
  const b = t.addWt('b');
  t.ghAt(a).set('pr-view', { stdout: { number: 1 } });
  t.ghAt(b).set('pr-view', { stdout: { number: 2 } });
  assert.equal(JSON.parse(t.ghFor(a)(['pr', 'view']).stdout).number, 1);
  assert.equal(JSON.parse(t.ghFor(b)(['pr', 'view']).stdout).number, 2);
  assert.equal(JSON.parse(t.ghFor(t.main)(['api', 'repos/{owner}/{repo}']).stdout).default_branch, 'main');
  assert.notEqual(t.ghAt(a).dir, t.ghAt(b).dir);
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), git(t.main, 'rev-parse', 'main'));
});

// ---------------------------------------------------------------- roadmap text (guard.mjs)

test('conduct: parseRoadmap reads text and readRoadmap is the same parse of the file', () => {
  const text = '## R1\n- [x] a\n- [ ] b (after: a) - do it\n  more notes\n';
  const root = gitRepo({ files: { 'openspec/roadmap.md': text } });
  assert.deepEqual(parseRoadmap(text), readRoadmap(root));
  assert.deepEqual(parseRoadmap(text)[0].items[1], { id: 'b', done: false, after: ['a'], text: 'do it', notes: 'more notes' });
});

// ---------------------------------------------------------------- base, roadmap, rounds, worktrees (task 2.2)

const TWO_ROUNDS = (r1 = '- [x] a', r2 = ['- [ ] b', '- [ ] c']) => roadmapOf(['Round 1: first', r1], ['Round 2: second', ...r2]);

test('conduct: the roadmap is read from origin/main, not the working tree', () => {
  const t = roundRepo({ roadmap: TWO_ROUNDS('- [ ] a', ['- [ ] b']) });
  put(t.main, { 'openspec/roadmap.md': roadmapOf(['Round 1: first', '- [x] a'], ['Round 2: second', '- [x] b']) });
  const res = t.state();
  assert.equal(res.version, 1);
  assert.equal(res.base, 'main');
  assert.equal(res.round.n, 1);
  assert.deepEqual(res.changes.map((c) => c.id), ['a']);
  assert.equal(res.roadmapDone, false);
});

test('conduct: the current round is the first with an unticked line', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: first', '- [x] a', '- [ ] b'], ['Round 2: second', '- [ ] c']) });
  const res = t.state();
  assert.deepEqual(res.round, { n: 1, title: 'Round 1: first', done: 1, total: 2 });
  assert.deepEqual(res.changes.map((c) => c.id), ['b']);
  assert.equal(res.startedAt, 1);
  assert.deepEqual(res.skipped, []);
});

test('conduct: with round 1 fully ticked on origin/main, round 2 is conducted in the same call (AC-8)', () => {
  const t = roundRepo({ roadmap: TWO_ROUNDS() });
  const res = t.state();
  assert.deepEqual(res.round, { n: 2, title: 'Round 2: second', done: 0, total: 2 });
  assert.deepEqual(res.changes.map((c) => [c.id, c.round]), [['b', 2], ['c', 2]]);
});

test('conduct: every round ticked gives roadmapDone and nothing to conduct', () => {
  const t = roundRepo({ roadmap: TWO_ROUNDS('- [x] a', ['- [x] b']) });
  const res = t.state();
  assert.equal(res.roadmapDone, true);
  assert.equal(res.round, null);
  assert.deepEqual(res.changes, []);
  assert.equal(res.end, true);
});

test('conduct: --round 2 skips an unticked round 1 into skipped; --round 9 is a usage error', () => {
  const t = roundRepo({ roadmap: TWO_ROUNDS('- [ ] a', ['- [ ] b']) });
  const res = t.state({ round: 2 });
  assert.equal(res.startedAt, 2);
  assert.deepEqual(res.skipped, [{ n: 1, unticked: ['a'] }]);
  assert.equal(res.round.n, 2);
  assert.deepEqual(res.changes.map((c) => c.id), ['b']);
  assert.throws(() => t.state({ round: 9 }), { name: 'UsageError', message: /round 9/ });
});

test('conduct: an after: id that is missing from the roadmap or in a skipped round keeps its dependent waiting', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: first', '- [ ] a'], ['Round 2: second', '- [ ] b (after: a, ghost)']) });
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': TASKS });
  const res = t.state({ round: 2 });
  assert.equal(byId(res, 'b').state, 'waiting on a, ghost');
});

test('conduct: a worktree at a non-standard path is reused: no worktree or create step (AC-11)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const odd = join(mkdtempSync(join(tmpdir(), 'devkit-odd-')), 'random-name');
  t.addWt('b', { path: odd });
  const b = byId(t.state(), 'b');
  assert.equal(b.worktree, real(odd));
  assert.equal(b.branch, 'b');
  assert.ok(!['worktree', 'create'].includes(b.next.step), b.next.step);
  assert.equal(b.next.step, 'new-change');
});

test('conduct: a worktree on chore/archive-<id> is found', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const wt = t.addWt('chore-b', { branch: 'chore/archive-b' });
  const b = byId(t.state(), 'b');
  assert.equal(b.worktree, wt);
  assert.ok(!['worktree', 'create'].includes(b.next.step));
});

test('conduct: a local branch only gives worktree with git worktree add <path> <id>', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  git(t.main, 'branch', 'b', 'origin/main');
  const b = byId(t.state(), 'b');
  assert.deepEqual(planStep(b), ['worktree', 'main']);
  assert.deepEqual(b.next.command, ['git', 'worktree', 'add', t.wtPath('b'), 'b']);
  assert.equal(b.next.path, t.wtPath('b'));
  assert.equal(b.state, 'ready to run: worktree');
});

test('conduct: origin/<id> only gives worktree --track', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  git(t.main, 'branch', 'b', 'origin/main');
  git(t.main, 'push', '-q', 'origin', 'b');
  git(t.main, 'branch', '-q', '-D', 'b');
  assert.ok(git(t.main, 'rev-parse', '--verify', 'refs/remotes/origin/b'));
  const b = byId(t.state(), 'b');
  assert.equal(b.next.step, 'worktree');
  assert.deepEqual(b.next.command, ['git', 'worktree', 'add', '--track', '-b', 'b', t.wtPath('b'), 'origin/b']);
});

test('conduct: a change folder on origin/main gives worktree -b <id> <path> origin/main', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']), changes: { b: { 'proposal.md': PROPOSAL } } });
  const b = byId(t.state(), 'b');
  assert.equal(b.next.step, 'worktree');
  assert.deepEqual(b.next.command, ['git', 'worktree', 'add', '-b', 'b', t.wtPath('b'), 'origin/main']);
});

test('conduct: nothing at all gives create', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = byId(t.state(), 'b');
  assert.deepEqual(planStep(b), ['create', 'owner']);
  assert.equal(b.worktree, t.wtPath('b'));
});

test('conduct: a prunable worktree entry is ignored', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const wt = t.addWt('b');
  rmSync(wt, { recursive: true, force: true });
  assert.match(git(t.main, 'worktree', 'list', '--porcelain'), /prunable/);
  const b = byId(t.state(), 'b');
  assert.equal(b.next.step, 'worktree', 'the entry is not reused');
});

test('conduct: the creation path is <main>/.claude/worktrees/<id> when run from a linked worktree', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b', '- [ ] c']) });
  const c = t.addWt('c');
  const res = t.state({}, c);
  assert.equal(byId(res, 'b').worktree, join(t.main, '.claude', 'worktrees', 'b'));
  assert.equal(byId(res, 'c').worktree, c);
});

// ---------------------------------------------------------------- planning rows C1, C2, P-1..P-5 (task 2.3)

const oneChange = (extra = '', config = CONFIG) => roundRepo({ roadmap: roadmapOf(['Round 1: x', `- [ ] b${extra}`]), config });

test('conduct: devkit: no requirements.md is a grill for the owner', () => {
  const t = oneChange(' - a big thing\n  with notes');
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit\n' });
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['grill', 'owner']);
  assert.equal(c.next.askable, true);
  assert.equal(c.next.text, 'a big thing');
  assert.equal(c.next.notes, 'with notes');
  assert.equal(c.state, 'waiting for the owner: grill');
});

test('conduct: devkit: requirements.md but no design.md is a plan for change-planner with the requirements path', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b', { schema: 'devkit' });
  rmSync(cf(b, 'b', 'design.md'));
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['plan', 'subagent']);
  assert.equal(c.next.agent, 'devkit-core:change-planner');
  assert.equal(c.next.request, cf(b, 'b', 'requirements.md'));
  assert.deepEqual(c.next.missing, ['design.md']);
  assert.equal(c.state, 'ready to run: plan');
});

test('conduct: devkit: all plan files and no readiness.md is a readiness review; a readiness older than tasks.md by more than 2 s is too', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b', { schema: 'devkit' });
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['readiness', 'subagent']);
  assert.equal(c.next.agent, 'devkit-core:plan-readiness-reviewer');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED' });
  at(cf(b, 'b', 'tasks.md'), T0 + 5 + 3);
  c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'readiness', 'tasks.md is 3 s newer');
  at(cf(b, 'b', 'tasks.md'), T0 + 5 + 1);
  assert.notEqual(byId(t.state(), 'b').next.step, 'readiness', 'within the 2 s tolerance');
});

test('conduct: devkit: NEEDS-REVISION is revise-plan with readiness.md as findings; BLOCKED waits for the owner', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'NEEDS-REVISION' });
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['revise-plan', 'subagent']);
  assert.equal(c.next.agent, 'devkit-core:change-planner');
  assert.equal(c.next.findings, cf(b, 'b', 'readiness.md'));
  planFiles(b, 'b', { schema: 'devkit', readiness: 'BLOCKED' });
  c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['stop-readiness-blocked', 'owner']);
  assert.equal(c.next.askable, false);
  assert.equal(c.state, 'waiting for the owner: readiness BLOCKED');
});

test('conduct: devkit: APPROVED without approval.md asks the owner to approve; with a current approval it goes to delivery', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED' });
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['approve', 'owner']);
  assert.equal(c.next.askable, true);
  assert.equal(c.next.readiness, hashOf(cf(b, 'b', 'readiness.md')));
  assert.match(c.next.file, /openspec\/changes\/b\/approval\.md$/);
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED', approved: true });
  c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['implement', 'subagent']);
  assert.equal(c.next.agent, 'devkit-core:tdd-implementer');
  assert.equal(c.deliver.next.step, 'implement');
});

test('conduct: every new change asks the schema as an askable owner row, with proposedSchema and reason (AC-1)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x',
    '- [ ] contract - changes the public contract of the checker',
    '- [ ] docs-only - docs: fix a typo in the getting started',
    '- [ ] bare',
  ]) });
  const res = t.state();
  const [contract, docs, bare] = ['contract', 'docs-only', 'bare'].map((id) => byId(res, id));
  for (const c of [contract, docs, bare]) {
    assert.deepEqual(planStep(c), ['create', 'owner']);
    assert.equal(c.next.askable, true);
    assert.ok(c.next.reason.length > 0);
    assert.equal(c.state, 'waiting for the owner: schema');
  }
  assert.equal(contract.next.proposedSchema, 'devkit');
  assert.match(contract.next.reason, /public contract/);
  assert.equal(docs.next.proposedSchema, 'devkit-lite');
  assert.equal(bare.next.proposedSchema, 'devkit');
  assert.equal(bare.next.text, '');
  assert.equal(bare.next.notes, '');
});

test('conduct: a worktree with no change folder gives new-change, askable, with proposedSchema and the openspec command', () => {
  const t = oneChange(' - docs: a small fix');
  t.addWt('b');
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['new-change', 'owner']);
  assert.equal(c.next.askable, true);
  assert.equal(c.next.proposedSchema, 'devkit-lite');
  assert.match(c.next.command, /^openspec new change b --schema /);
});

test('conduct: devkit-lite: proposal and tasks go straight to delivery; no planning row of it is an owner row (AC-4)', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b');
  assert.deepEqual(planStep(byId(t.state(), 'b')), ['implement', 'subagent']);
  rmSync(cf(b, 'b', 'tasks.md'));
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['plan', 'subagent']);
  assert.deepEqual(c.next.missing, ['tasks.md']);
  assert.equal(c.next.text, '');
  assert.ok(!['grill', 'approve', 'readiness'].includes(c.next.step));
});

test('conduct: a ticked task skips every planning row', () => {
  const t = oneChange();
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit\n', 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n- [ ] 1.2 more\n' });
  const c = byId(t.state(), 'b');
  assert.ok(!['grill', 'plan', 'readiness', 'approve', 'revise-plan'].includes(c.next.step), c.next.step);
  assert.ok(c.deliver, 'delivery was asked');
});

test('conduct: planningStep is pure: it reads the facts it is given', () => {
  const base = { id: 'x', worktree: '/w', schema: 'devkit-lite', hasFolder: true, started: false, planArtifacts: ['proposal.md', 'tasks.md'], missingArtifacts: [], text: '', notes: '' };
  assert.equal(planningStep(base), null, 'nothing to plan: delivery');
  assert.equal(planningStep({ ...base, missingArtifacts: ['tasks.md'] }).step, 'plan');
  assert.equal(planningStep({ ...base, started: true, missingArtifacts: ['tasks.md'] }), null);
});

// ---------------------------------------------------------------- dependency rows D-1..D-5 (task 2.4)

const DEPS = roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b (after: a)']);
const TICKED_A = roadmapOf(['Round 1: x', '- [x] a', '- [ ] b (after: a)']);

test('conduct: B (after: A): early planning rows still come up while A is unticked, then B waits on A and never implements (AC-3)', () => {
  const t = roundRepo({ roadmap: DEPS });
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit\n' });
  assert.equal(byId(t.state(), 'b').next.step, 'grill');
  writeChange(b, 'b', { 'requirements.md': '# R\n' });
  assert.equal(byId(t.state(), 'b').next.step, 'plan');
  planFiles(b, 'b', { schema: 'devkit' });
  assert.equal(byId(t.state(), 'b').next.step, 'readiness');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED' });
  assert.equal(byId(t.state(), 'b').next.step, 'approve');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED', approved: true });
  const c = byId(t.state(), 'b');
  assert.equal(c.state, 'waiting on a');
  assert.notEqual(c.next.step, 'implement');
  assert.equal(c.next.actor, 'none');
});

test('conduct: after A\'s tick lands on origin/main, B\'s worktree without the tick gives rebase; after the rebase, audit', () => {
  const t = roundRepo({ roadmap: DEPS });
  const b = t.addWt('b');
  planFiles(b, 'b');
  t.commitOrigin({ 'openspec/roadmap.md': TICKED_A }, 'tick a');
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['rebase', 'main']);
  assert.deepEqual(c.next.command, ['git', '-C', b, 'rebase', '--autostash', 'origin/main']);
  git(b, 'rebase', '--autostash', 'origin/main');
  c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['audit', 'subagent']);
  assert.equal(c.next.agent, 'devkit-core:plan-reality-auditor');
  assert.equal(c.next.base, t.originSha());
});

function auditMd(t, b, verdict, base = t.originSha()) {
  writeChange(b, 'b', { 'audit.md': `# Plan audit: b\n\n- Verdict: ${verdict}\n- Base: ${base}\n- Date: 2026-11-09\n\n| item | status |\n|---|---|\n` });
  at(cf(b, 'b', 'audit.md'), T0 + 100);
}
function rebased() {
  const t = roundRepo({ roadmap: DEPS });
  const b = t.addWt('b');
  planFiles(b, 'b');
  t.commitOrigin({ 'openspec/roadmap.md': TICKED_A }, 'tick a');
  git(b, 'rebase', '--autostash', 'origin/main');
  return { t, b };
}

test('conduct: audit.md ACCURATE with a Base that has the tick goes to delivery', () => {
  const { t, b } = rebased();
  auditMd(t, b, 'ACCURATE');
  assert.deepEqual(planStep(byId(t.state(), 'b')), ['implement', 'subagent']);
});

test('conduct: an audit whose Base lacks the tick, or older than a plan file by more than 2 s, is audited again', () => {
  const { t, b } = rebased();
  auditMd(t, b, 'ACCURATE', git(t.main, 'rev-parse', 'origin/main~1'));
  assert.equal(byId(t.state(), 'b').next.step, 'audit', 'Base before the tick');
  auditMd(t, b, 'ACCURATE');
  at(cf(b, 'b', 'tasks.md'), T0 + 100 + 3);
  assert.equal(byId(t.state(), 'b').next.step, 'audit', 'a plan file is newer');
});

test('conduct: OUTDATED is revise-plan with audit.md as findings; once a plan file is touched, devkit B gives readiness, then approve, then audit', () => {
  const t = roundRepo({ roadmap: DEPS });
  const b = t.addWt('b');
  planFiles(b, 'b', { schema: 'devkit', readiness: 'APPROVED', approved: true });
  t.commitOrigin({ 'openspec/roadmap.md': TICKED_A }, 'tick a');
  git(b, 'rebase', '--autostash', 'origin/main');
  auditMd(t, b, 'OUTDATED');
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['revise-plan', 'subagent']);
  assert.equal(c.next.findings, cf(b, 'b', 'audit.md'));
  // the planner revises design.md
  writeFileSync(cf(b, 'b', 'design.md'), '# Design\n\nrevised\n');
  at(cf(b, 'b', 'design.md'), T0 + 200);
  assert.equal(byId(t.state(), 'b').next.step, 'readiness');
  // the reviewer rewrites readiness.md
  writeFileSync(cf(b, 'b', 'readiness.md'), '# Readiness\n\n- Status: APPROVED\n- Round: 2\n');
  at(cf(b, 'b', 'readiness.md'), T0 + 205);
  assert.equal(byId(t.state(), 'b').next.step, 'approve', 'the hash changed');
  writeFileSync(cf(b, 'b', 'approval.md'), `# Plan approval: b\n\n- Status: APPROVED\n- Readiness: ${hashOf(cf(b, 'b', 'readiness.md'))}\n- Date: 2026-11-09\n- Owner's words: "ok"\n`);
  at(cf(b, 'b', 'approval.md'), T0 + 206);
  assert.equal(byId(t.state(), 'b').next.step, 'audit');
});

test('conduct: UNVERIFIABLE waits for the owner', () => {
  const { t, b } = rebased();
  auditMd(t, b, 'UNVERIFIABLE');
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['stop-audit-unverifiable', 'owner']);
  assert.equal(c.next.askable, false);
  assert.equal(c.state, 'waiting for the owner: plan audit UNVERIFIABLE');
});

test('conduct: a rebase left in progress is blocked, and the worktree is still found', () => {
  const t = roundRepo({ roadmap: DEPS, files: { 'src/x.txt': 'base\n' } });
  const b = t.addWt('b');
  planFiles(b, 'b');
  put(b, { 'src/x.txt': 'from b\n' });
  commitAll(b, 'b edits x');
  t.commitOrigin({ 'openspec/roadmap.md': TICKED_A, 'src/x.txt': 'from origin\n' }, 'tick a and edit x');
  assert.throws(() => git(b, 'rebase', 'origin/main'));
  const c = byId(t.state(), 'b');
  assert.equal(c.worktree, b);
  assert.match(c.state, /^blocked: rebase of b stopped/);
  assert.equal(c.next.step, 'blocked');
});

test('conduct: dependencyStep: rows over the facts it is given', () => {
  const f = { id: 'b', worktree: '/w', after: ['a'], ticked: new Set(), headTicked: new Set(), audit: null, started: false };
  assert.deepEqual([dependencyStep(f).step, dependencyStep(f).ids], ['wait-dependencies', ['a']]);
  assert.equal(dependencyStep({ ...f, ticked: new Set(['a']) }).step, 'rebase');
  assert.equal(dependencyStep({ ...f, ticked: new Set(['a']), headTicked: new Set(['a']) }).step, 'audit');
  assert.equal(dependencyStep({ ...f, after: [] }), null);
  assert.equal(dependencyStep({ ...f, started: true }), null);
});

// ---------------------------------------------------------------- delivery mapping (task 2.5)

const REPORT = (next, over = {}) => ({ next: { reason: 'R', ...next }, summary: 'S', schema: 'devkit-lite', pr: { number: 12, url: 'https://github.com/o/r/pull/12' }, ...over });
const TDD = 'devkit-core:tdd-implementer';
const CAP = 'devkit-core:commit-and-pr';

test('conduct: deliveryStep maps every deliver-check step to its actor, agent and final state (design D9 table)', () => {
  const rows = [
    ...['implement', 'fix-review', 'fix-defect', 'fix-checks', 'apply-proposals'].map((s) => [{ step: s }, 'subagent', TDD, `ready to run: ${s}`]),
    ...['commit', 'open-pr', 'push', 'open-archive-pr'].map((s) => [{ step: s }, 'subagent', CAP, `ready to run: ${s}`]),
    [{ step: 'verify' }, 'subagent', 'devkit-core:pr-verifier', 'ready to run: verify'],
    [{ step: 'retro' }, 'subagent', 'general-purpose', 'ready to run: retro'],
    [{ step: 'review' }, 'review', undefined, 'ready to run: review'],
    [{ step: 'gate' }, 'gate', undefined, 'ready to run: gate'],
    ...['edit-pr-body', 'enable-auto-merge', 'disable-auto-merge', 'update-branch', 'archive', 'tick-roadmap'].map((s) => [{ step: s }, 'main', undefined, `ready to run: ${s}`]),
    [{ step: 'answer' }, 'owner', undefined, 'waiting for the owner: PR decision https://github.com/o/r/pull/12'],
    [{ step: 'stop-retro-answers' }, 'owner', undefined, 'waiting for the owner: retro answers'],
    [{ step: 'stop-plan-approval' }, 'owner', undefined, 'waiting for the owner: plan approval'],
    [{ step: 'wait-checks' }, 'github', undefined, 'waiting on GitHub: checks'],
    [{ step: 'wait-merge', waitingFor: 'GitHub to merge' }, 'github', undefined, 'waiting on GitHub: GitHub to merge'],
    [{ step: 'ready' }, 'owner', undefined, 'waiting for the owner: merge PR #12'],
    [{ step: 'archive-pr-ready', number: 13 }, 'owner', undefined, 'waiting for the owner: merge archive PR #13'],
    [{ step: 'stop-review-deadlock', reviewers: ['a', 'b'] }, 'owner', undefined, 'waiting for the owner: review deadlock (a, b)'],
    [{ step: 'stop-plan-mode' }, 'stop', undefined, 'blocked: ship mode plan for devkit-lite'],
    ...['stop-branch', 'stop-merge-setup', 'stop-archive', 'blocked', 'stop-not-approved'].map((s) => [{ step: s }, 'stop', undefined, 'blocked: S: R']),
    [{ step: 'archived' }, 'none', undefined, 'archived'],
  ];
  for (const [next, actor, agent, state] of rows) {
    const got = deliveryStep({ id: 'x' }, REPORT(next));
    assert.deepEqual([got.next.step, got.next.actor, got.next.agent, got.state], [next.step, actor, agent, state], next.step);
    assert.equal(got.next.reason, 'R', 'deliver-check fields pass through');
  }
  assert.deepEqual(actorOf('stop-retro-answers'), { actor: 'owner', askable: true });
  assert.equal(actorOf('ready').askable, false);
  assert.equal(actorOf('plan').agent, 'devkit-core:change-planner');
  assert.deepEqual(actorOf('archived'), { actor: 'none' });
  assert.deepEqual(actorOf('wait-dependencies'), { actor: 'none' });
});

test('conduct: a deliver-check step with no actor mapping stops the change with "unknown step <name>"', () => {
  assert.deepEqual(actorOf('bogus'), { actor: 'stop', reason: 'unknown step bogus' });
  const got = deliveryStep({ id: 'x' }, REPORT({ step: 'bogus' }));
  assert.equal(got.next.actor, 'stop');
  assert.equal(got.next.reason, 'unknown step bogus');
  assert.equal(got.state, 'blocked: S: unknown step bogus');
  assert.deepEqual(selectDispatch([{ id: 'x', next: got.next }]), [], 'never dispatched');
});

test('conduct: DEVKIT_BRANCH in the parent env does not change a worktree\'s selection', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = t.addWt('b');
  planFiles(b, 'b');
  const leaked = { ...cleanEnv, DEVKIT_BRANCH: 'other', DEVKIT_CHANGE: 'other', GITHUB_HEAD_REF: 'other' };
  const res = conductState(t.main, { env: leaked, ghFor: t.ghFor });
  assert.equal(byId(res, 'b').next.step, 'implement');
});

test('conduct: a deliver-check error in one worktree blocks that change while another still gets its row', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b', '- [ ] c']) });
  const b = t.addWt('b');
  const c = t.addWt('c');
  planFiles(b, 'b');
  planFiles(c, 'c');
  put(b, { 'openspec/config.yaml': 'schema: devkit-lite\nmerge_method: bogus\n' });
  const res = t.state();
  assert.match(byId(res, 'b').state, /^blocked: .*merge_method/);
  assert.equal(byId(res, 'b').next.actor, 'stop');
  assert.equal(byId(res, 'c').next.step, 'implement');
  assert.deepEqual(res.dispatch, ['c']);
});

// ---------------------------------------------------------------- the three overrides (task 2.6)

const PR_BODY = (id) => `${id}\n- AC-1\nopenspec/changes/${id}/evidence.md\n`;
const prJson = (id, over = {}) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE',
  body: PR_BODY(id), autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
const check = (name, bucket) => ({ name, state: bucket.toUpperCase(), bucket, link: `https://ci/${name}` });
const headOf = (wt) => git(wt, 'rev-parse', 'HEAD');
const NO_TALK = { data: { viewer: { login: 'me' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } };
const MERGE_CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: merge\n  devkit: merge\nmerge_method: squash\n';
const MERGE_FILES = { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' };

function writeReviews(wt, id, sha) {
  const review = `Verdict: approved\nCommit: ${sha}\n\n# Review\n`;
  writeChange(wt, id, {
    'reviews/code-quality-reviewer.md': review,
    'reviews/test-coverage-reviewer.md': review,
    'evidence.md': `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`,
  });
}
// Items 1 to 4 met in `wt`: tasks ticked, code committed, reviews and evidence at that commit, committed.
function readyChange(wt, id, { files = {} } = {}) {
  writeChange(wt, id, { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n' });
  put(wt, { [`src/${id}.ts`]: 'code\n', ...files });
  const sha = commitAll(wt, 'code');
  writeReviews(wt, id, sha);
  commitAll(wt, 'reviews and evidence');
}
function presetMerge(g) {
  g.set('api-GET-repos__owner___repo__rules_branches_main', { stdout: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }] });
  g.set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' });
}
function openPr(t, wt, id, over = {}) {
  const g = t.ghAt(wt);
  g.set('pr-view', { stdout: prJson(id, { headRefOid: headOf(wt), ...over }) });
  g.set('pr-checks', { stdout: [check('build', 'pass')] });
  g.set('api-graphql', { stdout: NO_TALK });
}

function conflictRepo(conflicts, { config = CONFIG } = {}) {
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', '- [ ] b', '- [ ] c']), config,
    files: { 'CHANGELOG.md': '# c\n', '.claude-plugin/marketplace.json': '{"v":1}\n', 'README.md': 'r\n', ...(config === CONFIG ? {} : MERGE_FILES) },
  });
  const b = t.addWt('b');
  const own = Object.fromEntries(conflicts.map((f) => [f, `b edits ${f}\n`]));
  readyChange(b, 'b', { files: own });
  t.commitOrigin(Object.fromEntries(conflicts.map((f) => [f, `origin edits ${f}\n`])), 'origin edits');
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  return { t, b };
}

test('conduct: a change PR in conflict only in release files is resolve-release-conflict with the paths (AC-6)', () => {
  const { t, b } = conflictRepo(['CHANGELOG.md', '.claude-plugin/marketplace.json']);
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['resolve-release-conflict', 'subagent']);
  assert.equal(c.next.agent, TDD);
  assert.deepEqual(c.next.paths, ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
  assert.equal(c.next.base, 'main');
  assert.ok(c.next.command.includes('--base') && c.next.command.includes('main'));
  assert.match(c.next.command[1], /release-rebase\.mjs$/);
  assert.equal(c.deliver.next.step, 'blocked', 'deliver-check alone says blocked');
  assert.equal(c.deliver.next.conflict, true, 'deliver-check names the conflict in a field, not only in prose');
  assert.equal(headOf(b), c.deliver ? headOf(b) : '', 'nothing was touched');
});

test('conduct: a conflict that also has README.md is blocked, and an independent change in the round is still dispatched', () => {
  const { t } = conflictRepo(['CHANGELOG.md', 'README.md']);
  const c = t.addWt('c');
  planFiles(c, 'c');
  const res = t.state();
  assert.equal(byId(res, 'b').state, 'blocked: item 5 (conflict in README.md)');
  assert.equal(byId(res, 'b').next.actor, 'stop');
  assert.deepEqual(res.dispatch, ['c']);
});

test('conduct: git merge-tree exit 0 (GitHub is stale) keeps what deliver-check says in pr mode', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = t.addWt('b');
  readyChange(b, 'b');
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  const c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'blocked');
  assert.match(c.state, /^blocked: .*merge conflicts/);
});

test('conduct: git merge-tree exit 0 gives update-branch in merge mode (GitHub\'s conflict view is stale)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']), config: MERGE_CONFIG, files: MERGE_FILES });
  const b = t.addWt('b');
  readyChange(b, 'b');
  presetMerge(t.ghAt(b));
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  const c = byId(t.state(), 'b');
  assert.equal(c.deliver.next.step, 'blocked');
  assert.deepEqual([c.next.step, c.next.number, c.next.actor], ['update-branch', 12, 'main']);
});

// The state right after release-rebase: rebased onto origin/main, release files dirty, reviews at the old head,
// the PR still at the old head.
function rebasedChange({ config = CONFIG, dirty = true, commit = false } = {}) {
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', '- [ ] b']), config,
    files: { 'CHANGELOG.md': '# c\n', '.claude-plugin/marketplace.json': '{"v":1}\n', ...(config === CONFIG ? {} : MERGE_FILES) },
  });
  const b = t.addWt('b');
  readyChange(b, 'b');
  const oldHead = headOf(b);
  t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  git(b, 'rebase', 'origin/main');
  if (dirty) put(b, { 'CHANGELOG.md': '# c\nb entry\n', '.claude-plugin/marketplace.json': '{"v":2}\n' });
  if (commit) commitAll(b, 'release files after the rebase');
  return { t, b, oldHead };
}

test('conduct: right after release-rebase deliver-check says commit, conduct-check says push-rebased with oldHead, paths and a lease (override 2a)', () => {
  const { t, b, oldHead } = rebasedChange();
  const c = byId(t.state(), 'b');
  assert.equal(c.deliver.next.step, 'commit', 'deliver-check alone: a plain push would be rejected');
  assert.deepEqual(planStep(c), ['push-rebased', 'subagent']);
  assert.equal(c.next.agent, CAP);
  assert.equal(c.next.oldHead, oldHead);
  assert.deepEqual([...c.next.paths].sort(), ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
  assert.deepEqual(c.next.command, ['git', 'push', `--force-with-lease=b:${oldHead}`, 'origin', 'b']);
  assert.ok(git(b, 'reflog', 'show', '--format=%H', 'refs/heads/b').split('\n').includes(oldHead));
});

test('conduct: killed after the commit and before the push is push-rebased with no paths (override 2b)', () => {
  const { t, oldHead } = rebasedChange({ commit: true });
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['push-rebased', 'subagent']);
  assert.deepEqual(c.next.paths, []);
  assert.equal(c.next.oldHead, oldHead);
});

test('conduct: after the force push every reviewer is stale (review), and then verify (override 2c)', () => {
  const { t, b } = rebasedChange({ commit: true });
  openPr(t, b, 'b');
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['review', 'review']);
  assert.deepEqual([...c.next.reviewers].sort(), ['code-quality-reviewer', 'test-coverage-reviewer']);
  const sha = headOf(b);
  const review = `Verdict: approved\nCommit: ${sha}\n\n# Review\n`;
  writeChange(b, 'b', { 'reviews/code-quality-reviewer.md': review, 'reviews/test-coverage-reviewer.md': review });
  c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'verify');
});

test('conduct: auto-merge still on gives disable-auto-merge first (override 2d)', () => {
  const { t } = rebasedChange({ config: MERGE_CONFIG, commit: true });
  presetMerge(t.ghAt(t.wtPath('b')));
  const b = t.wtPath('b');
  t.ghAt(b).set('pr-view', { stdout: prJson('b', { headRefOid: git(b, 'reflog', 'show', '--format=%H', 'refs/heads/b').split('\n').at(-3) ?? '', autoMergeRequest: { enabledAt: 'x' }, mergeable: 'CONFLICTING' }) });
  const c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'disable-auto-merge');
});

test('conduct: a PR head that is not in the local reflog stays blocked, not in local history (override 2e)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = t.addWt('b');
  readyChange(b, 'b');
  openPr(t, b, 'b', { headRefOid: 'f'.repeat(40) });
  const c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'blocked');
  assert.match(c.state, /not in local history/);
  assert.equal(c.next.actor, 'stop');
});

// ---- the same on an archive PR (P3b, P3c)

const MERGED_PR = (id) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'MERGED', headRefName: id, headRefOid: 'b'.repeat(40), baseRefName: 'main',
  mergeable: 'UNKNOWN', mergedAt: '2026-11-09T14:56:00Z', body: `${id}\nopenspec/changes/${id}/evidence.md\n`, autoMergeRequest: null, mergeStateStatus: 'UNKNOWN',
});
const ARCHIVE_PR = (over = {}) => ({
  number: 13, url: 'https://github.com/o/r/pull/13', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE',
  autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
const CONTENTS = 'api-GET-repos__owner___repo__contents_';
function archiveGh(t, wt, id, prs, { onDefault = 'active' } = {}) {
  const g = t.ghAt(wt);
  g.set('pr-list-state-merged', { stdout: [MERGED_PR(id)] });
  g.set(`${CONTENTS}openspec_changes_archive_ref=main`, { stdout: onDefault === 'archived' ? [{ name: `2026-11-09-${id}` }] : [] });
  g.set(`${CONTENTS}openspec_changes_${id}_ref=main`, { stdout: { name: id } });
  g.set(`pr-list-head-chore_archive-${id}`, { stdout: prs });
  g.set('pr-checks', { stdout: [check('check', 'pass'), check('devkit-reviews', 'pass')] });
  g.set('api-graphql', { stdout: NO_TALK });
}
const RETRO_NONE = '# Retro: x\n\n## Proposed updates\n\nNone.\n';

// An archive worktree: the change merged on origin/main, its folder moved and the roadmap ticked on chore/archive-<id>.
function archiveRepo({ config = CONFIG, files = {}, id = 'b', archiveFiles = {} } = {}) {
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', `- [ ] ${id}`]), config,
    changes: { [id]: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n', 'retro.md': RETRO_NONE } },
    files: { 'CHANGELOG.md': '# c\n', ...(config === CONFIG ? {} : MERGE_FILES), ...files },
  });
  const wt = t.addWt('a', { branch: `chore/archive-${id}` });
  mkdirSync(join(wt, 'openspec/changes/archive'), { recursive: true });
  git(wt, 'mv', `openspec/changes/${id}`, `openspec/changes/archive/2026-11-09-${id}`);
  put(wt, { 'openspec/roadmap.md': roadmapOf(['Round 1: x', `- [x] ${id}`]), ...archiveFiles });
  commitAll(wt, `archive ${id}`);
  if (config !== CONFIG) presetMerge(t.ghAt(wt));
  return { t, wt, id };
}

test('conduct: an archive PR in conflict only in release files is resolve-release-conflict; a README conflict is blocked (P3b)', () => {
  let { t, wt } = archiveRepo({ archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n' } });
  t.commitOrigin({ 'CHANGELOG.md': '# c\norigin edit\n' }, 'origin edits the changelog');
  archiveGh(t, wt, 'b', [ARCHIVE_PR({ headRefOid: headOf(wt), mergeable: 'CONFLICTING' })]);
  let c = byId(t.state(), 'b');
  assert.equal(c.deliver.next.step, 'stop-archive');
  assert.equal(c.deliver.next.conflict, true, 'the archive PR conflict is a field too');
  assert.deepEqual(planStep(c), ['resolve-release-conflict', 'subagent']);
  assert.deepEqual(c.next.paths, ['CHANGELOG.md']);

  const named = '# Retro: b\n\n## Proposed updates\n\n### `README.md` (process-friction)\nSummary of README.md.\n- before: old\n+ after: new\n- Answer: approved\n- Applied: yes\n';
  ({ t, wt } = archiveRepo({ files: { 'README.md': 'r\n' }, archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n', 'README.md': 'archive\n', 'openspec/changes/archive/2026-11-09-b/retro.md': named } }));
  t.commitOrigin({ 'CHANGELOG.md': '# c\norigin edit\n', 'README.md': 'origin\n' }, 'origin edits both');
  archiveGh(t, wt, 'b', [ARCHIVE_PR({ headRefOid: headOf(wt), mergeable: 'CONFLICTING' })]);
  c = byId(t.state(), 'b');
  assert.equal(c.state, 'blocked: archive (archive-pr): conflict in README.md');
});

function rebasedArchive({ config = CONFIG, commit = false } = {}) {
  const r = archiveRepo({ config });
  const oldHead = headOf(r.wt);
  r.t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  git(r.wt, 'rebase', 'origin/main');
  put(r.wt, { 'CHANGELOG.md': '# c\nb entry\n' });
  if (commit) commitAll(r.wt, 'release files after the rebase');
  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: oldHead, mergeable: 'CONFLICTING' })]);
  return { ...r, oldHead };
}

test('conduct: the same push-rebased override holds on an archive PR (override 2f, P3c)', () => {
  let r = rebasedArchive();
  let c = byId(r.t.state(), 'b');
  assert.deepEqual(planStep(c), ['push-rebased', 'subagent']);
  assert.equal(c.next.oldHead, r.oldHead);
  assert.deepEqual(c.next.paths, ['CHANGELOG.md']);
  assert.deepEqual(c.next.command, ['git', 'push', `--force-with-lease=chore/archive-b:${r.oldHead}`, 'origin', 'chore/archive-b']);

  r = rebasedArchive({ commit: true });
  c = byId(r.t.state(), 'b');
  assert.deepEqual([c.next.step, c.next.paths], ['push-rebased', []]);

  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: headOf(r.wt) })]);
  c = byId(r.t.state(), 'b');
  assert.notEqual(c.next.step, 'push-rebased', 'after the force push the PR head is HEAD');

  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: 'f'.repeat(40) })]);
  c = byId(r.t.state(), 'b');
  assert.equal(c.next.step, 'stop-archive');
  assert.match(c.state, /not in local history/);
});

test('conduct: auto-merge on an archive PR whose head we rewrote is disabled first (override 2f, P3a)', () => {
  const r = rebasedArchive({ config: MERGE_CONFIG, commit: true });
  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: r.oldHead, autoMergeRequest: { enabledAt: 'x' } })]);
  assert.equal(byId(r.t.state(), 'b').next.step, 'disable-auto-merge');
});

// ---- archives are serialized (override 3)

// `id` merged and answered, still active on its own branch: its next step is archive.
function atArchive(t, id) {
  const wt = t.addWt(id);
  writeChange(wt, id, { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n', 'retro.md': RETRO_NONE });
  commitAll(wt, `${id} work`);
  const g = t.ghAt(wt);
  g.set('pr-view', { stdout: prJson(id, { state: 'MERGED', headRefOid: headOf(wt) }) });
  archiveGh(t, wt, id, []);
  return wt;
}

test('conduct: with another change\'s archive PR open, a change at archive waits on it, and its retro is not held (override 3)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b', '- [ ] c']), config: CONFIG });
  // a: archive branch, folder moved, its archive PR open
  const aw = t.addWt('a-archive', { branch: 'chore/archive-a' });
  put(aw, { 'openspec/changes/archive/2026-11-09-a/retro.md': RETRO_NONE, 'openspec/changes/archive/2026-11-09-a/.openspec.yaml': 'schema: devkit-lite\n' });
  commitAll(aw, 'archive a');
  archiveGh(t, aw, 'a', [ARCHIVE_PR({ headRefOid: headOf(aw) })]);
  // b: at archive
  atArchive(t, 'b');
  let res = t.state();
  assert.equal(byId(res, 'b').deliver.next.step, 'archive');
  assert.equal(byId(res, 'b').state, 'waiting on a (archive)');
  assert.equal(byId(res, 'b').next.actor, 'none');
  // c: at retro (no retro.md yet): not held
  const cw = t.addWt('c');
  writeChange(cw, 'c', { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n' });
  commitAll(cw, 'c work');
  t.ghAt(cw).set('pr-view', { stdout: prJson('c', { state: 'MERGED', headRefOid: headOf(cw) }) });
  archiveGh(t, cw, 'c', []);
  res = t.state();
  assert.equal(byId(res, 'c').next.step, 'retro');
  assert.equal(byId(res, 'c').state, 'ready to run: retro');
});

test('conduct: two changes at archive: the first in roadmap order keeps it, the second waits on it', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b']) });
  atArchive(t, 'a');
  atArchive(t, 'b');
  const res = t.state();
  assert.equal(byId(res, 'a').next.step, 'archive');
  assert.equal(byId(res, 'b').state, 'waiting on a (archive)');
});

// ---------------------------------------------------------------- dispatch, owner, github, stopped, end (task 2.7)

function lites(ids, roadmapLines = ids.map((i) => `- [ ] ${i}`)) {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', ...roadmapLines]) });
  for (const id of ids) planFiles(t.addWt(id), id);
  return t;
}

test('conduct: two independent changes at implement and plan are both dispatched, each in its own worktree on its own branch (AC-2)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b']) });
  planFiles(t.addWt('a'), 'a');
  const b = t.addWt('b');
  planFiles(b, 'b');
  rmSync(cf(b, 'b', 'tasks.md'));
  const res = t.state();
  assert.deepEqual(res.dispatch, ['a', 'b']);
  assert.deepEqual(res.changes.map((c) => [c.id, c.next.step, c.branch]), [['a', 'implement', 'a'], ['b', 'plan', 'b']]);
  assert.notEqual(byId(res, 'a').worktree, byId(res, 'b').worktree);
  assert.equal(res.end, false);
});

test('conduct: four runnable changes give three in dispatch; with --busy x it gives two and x is running', () => {
  const t = lites(['a', 'b', 'c', 'd']);
  let res = t.state();
  assert.deepEqual(res.dispatch, ['a', 'b', 'c']);
  res = t.state({ busy: ['a'] });
  assert.deepEqual(res.dispatch, ['b', 'c']);
  assert.equal(byId(res, 'a').state, 'running');
  assert.deepEqual(res.busy, ['a']);
  assert.equal(res.end, false);
  assert.deepEqual(selectDispatch([{ id: 'x', next: { actor: 'subagent' } }, { id: 'y', next: { actor: 'review' } }], ['z', 'w', 'v']), []);
});

test('conduct: main steps are not capped by the three-at-a-time limit', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', ...ids.map((i) => `- [ ] ${i}`)]) });
  for (const id of ids) git(t.main, 'branch', id, 'origin/main');
  const res = t.state();
  assert.ok(res.changes.every((c) => c.next.step === 'worktree'));
  assert.deepEqual(res.dispatch, ids);
});

function fiveKinds() {
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', '- [ ] done', '- [ ] dep (after: blk)', '- [ ] own', '- [ ] gh', '- [ ] blk']),
    config: CONFIG,
  });
  // done: the change PR is merged and the default branch lists the archived folder
  const d = t.addWt('done');
  writeChange(d, 'done', { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': '# Tasks\n\n## 1. First\n- [x] 1.1 code\n' });
  commitAll(d, 'done work');
  t.ghAt(d).set('pr-view', { stdout: prJson('done', { state: 'MERGED', headRefOid: headOf(d) }) });
  archiveGh(t, d, 'done', [], { onDefault: 'archived' });
  // dep waits on blk
  planFiles(t.addWt('dep'), 'dep');
  // own: readiness BLOCKED
  planFiles(t.addWt('own'), 'own', { schema: 'devkit', readiness: 'BLOCKED' });
  // gh: ready, checks pending
  const g = t.addWt('gh');
  readyChange(g, 'gh');
  openPr(t, g, 'gh');
  t.ghAt(g).set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] });
  // blk: a broken config in its worktree
  const b = t.addWt('blk');
  planFiles(b, 'blk');
  put(b, { 'openspec/config.yaml': 'schema: devkit-lite\nmerge_method: bogus\n' });
  return t;
}

test('conduct: a round with one change of each kind at end gives exactly one of the five AC-7 forms per change', () => {
  const res = fiveKinds().state();
  const forms = [/^archived$/, /^waiting on [\w, -]+$/, /^waiting for the owner: .+/, /^waiting on GitHub: .+/, /^blocked: .+/];
  const states = Object.fromEntries(res.changes.map((c) => [c.id, c.state]));
  assert.equal(states.done, 'archived');
  assert.equal(states.dep, 'waiting on blk');
  assert.equal(states.own, 'waiting for the owner: readiness BLOCKED');
  assert.equal(states.gh, 'waiting on GitHub: checks');
  assert.match(states.blk, /^blocked: /);
  for (const c of res.changes) assert.equal(forms.filter((f) => f.test(c.state)).length, 1, `${c.id}: ${c.state}`);
  assert.equal(res.end, true);
  assert.deepEqual([res.dispatch, res.owner, res.github, res.stopped], [[], [], ['gh'], ['blk']]);
});

test('conduct: A blocked makes B (after: A) read waiting on A while independent C is dispatched (AC-7)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] b (after: a)', '- [ ] c']) });
  const a = t.addWt('a');
  planFiles(a, 'a');
  put(a, { 'openspec/config.yaml': 'schema: devkit-lite\nmerge_method: bogus\n' });
  planFiles(t.addWt('b'), 'b');
  planFiles(t.addWt('c'), 'c');
  const res = t.state();
  assert.match(byId(res, 'a').state, /^blocked/);
  assert.equal(byId(res, 'b').state, 'waiting on a');
  assert.deepEqual(res.dispatch, ['c']);
});

// ---------------------------------------------------------------- wake and watch (task 2.8)

test('conduct: wake.cron is on when end holds and a change waits on GitHub, even beside one that waits on the owner (AC-9)', () => {
  const res = fiveKinds().state();
  assert.equal(res.wake.cron, true);
  assert.equal(res.wake.schedule, '*/20 * * * *');
  assert.equal(res.wake.prompt, '/conduct --wake');
});

test('conduct: wake.cron is off when the roadmap is done, when everything waits on the owner or is stopped, and when anything is dispatchable (AC-8, AC-9)', () => {
  const done = roundRepo({ roadmap: TWO_ROUNDS('- [x] a', ['- [x] b']) }).state();
  assert.equal(done.wake.cron, false);
  const owners = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] own']) });
  planFiles(owners.addWt('own'), 'own', { schema: 'devkit', readiness: 'BLOCKED' });
  assert.equal(owners.state().wake.cron, false);
  const busy = fiveKinds();
  const runnable = busy.addWt('extra', { branch: 'extra' });
  assert.ok(runnable);
  const t = lites(['a']);
  assert.equal(t.state().wake.cron, false);
  assert.equal(wakeOf({ end: false, github: ['x'] }).cron, false);
  assert.equal(wakeOf({ end: true, github: [] }).cron, false);
  assert.equal(wakeOf({ end: true, github: ['x'] }).cron, true);
});

test('conduct: the wake prompt carries --wake: /conduct round <n> --wake under --round <n>, else /conduct --wake', () => {
  assert.equal(wakeOf({ end: true, github: ['x'] }, 5).prompt, '/conduct round 5 --wake');
  assert.equal(wakeOf({ end: true, github: ['x'] }).prompt, '/conduct --wake');
  const t = roundRepo({ roadmap: TWO_ROUNDS('- [ ] a', ['- [ ] b']) });
  assert.equal(t.state({ round: 2 }).wake.prompt, '/conduct round 2 --wake');
});

// One change waiting on its pending checks; `flipAt` is the pr-checks call that turns green.
function waitingOnChecks(flipAt = null) {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = t.addWt('b');
  readyChange(b, 'b');
  openPr(t, b, 'b');
  const g = t.ghAt(b);
  g.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] });
  if (flipAt) for (let n = flipAt; n < flipAt + 40; n++) g.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, n);
  g.resetCount('pr-checks');
  return { t, b };
}
const watchEnv = { ...cleanEnv, DEVKIT_POLL_SECONDS: '0' };

test('conduct: --watch returns when a per-call fixture flips the checks, and at the cap with watch.timedOut', () => {
  let { t } = waitingOnChecks(3);
  let res = conductState(t.main, { env: watchEnv, ghFor: t.ghFor, watch: 0.05 });
  assert.equal(res.watch.timedOut, false);
  assert.equal(res.watch.minutes, 0.05);
  assert.equal(byId(res, 'b').next.step, 'ready', 'the report is recomputed');
  ({ t } = waitingOnChecks());
  const started = Date.now();
  res = conductState(t.main, { env: watchEnv, ghFor: t.ghFor, watch: 0.01 });
  assert.equal(res.watch.timedOut, true);
  assert.ok(Date.now() - started < 20000);
  assert.equal(byId(res, 'b').next.step, 'wait-checks');
});

test('conduct: --watch on a result that is not at end does not wait', () => {
  const t = lites(['a']);
  const res = conductState(t.main, { env: watchEnv, ghFor: t.ghFor, watch: 0.01 });
  assert.equal(res.watch, undefined);
  assert.equal(res.end, false);
});

// ---------------------------------------------------------------- CLI and JSON (task 2.9)

function cli(t, args, { cwd = t.main, env = {} } = {}) {
  return conductMain(args, { ...t.ghAt(t.main).env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', DEVKIT_BYPASS: '', ...env }, cwd);
}

test('conduct: --json prints version 1 with the D2 fields', () => {
  const t = lites(['a', 'b']);
  const r = cli(t, ['--json']);
  assert.equal(r.code, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.version, 1);
  for (const k of ['base', 'round', 'startedAt', 'skipped', 'roadmapDone', 'changes', 'dispatch', 'owner', 'github', 'stopped', 'busy', 'end', 'wake']) assert.ok(k in j, k);
  assert.deepEqual(Object.keys(j.changes[0]).sort(), ['after', 'base', 'branch', 'deliver', 'id', 'next', 'notes', 'round', 'schema', 'state', 'text', 'worktree']);
  for (const k of ['step', 'actor', 'reason']) assert.ok(k in j.changes[0].next, k);
  assert.deepEqual(j.dispatch, ['a', 'b']);
});

test('conduct: human output has one line per change, then dispatch, owner, github and wake', () => {
  const t = lites(['a', 'b']);
  const r = cli(t, []);
  assert.equal(r.code, 0);
  const lines = r.stdout.trimEnd().split('\n');
  assert.deepEqual(lines.slice(0, 2), ['a: ready to run: implement', 'b: ready to run: implement']);
  assert.deepEqual(lines.slice(2).map((l) => l.split(':')[0]), ['dispatch', 'owner', 'github', 'wake']);
  assert.equal(lines[2], 'dispatch: a, b');
});

test('conduct: --busy and --round are read from the command line', () => {
  const t = lites(['a', 'b']);
  const j = JSON.parse(cli(t, ['--json', '--busy', 'a,b']).stdout);
  assert.deepEqual([j.busy, j.dispatch], [['a', 'b'], []]);
  assert.equal(j.changes[0].state, 'running');
  assert.equal(JSON.parse(cli(t, ['--json', '--round', '1']).stdout).startedAt, 1);
});

test('conduct: exit 3 for no openspec/, an unreadable default branch, a missing origin/<base>, an unknown option and --round out of range', () => {
  const t = lites(['a']);
  const none = mkdtempSync(join(tmpdir(), 'devkit-none-'));
  assert.equal(cli(t, ['--json'], { cwd: none }).code, 3);
  t.ghAt(t.main).set('api-GET-repos__owner___repo_', { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' });
  let r = cli(t, ['--json']);
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.stdout).error, /default branch/);
  const lone = gitRepo({ files: { 'openspec/roadmap.md': '## R\n- [ ] a\n' } });
  const l = roundRepo({ roadmap: '## R\n- [ ] a\n' });
  git(l.main, 'remote', 'remove', 'origin');
  r = cli(l, []);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /git fetch origin main/);
  assert.ok(lone);
  assert.equal(cli(t, ['--bogus']).code, 3);
  t.ghAt(t.main).set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  r = cli(t, ['--round', '9']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /round 9/);
});

test('conduct: the checker never writes: status, refs and worktrees are unchanged after a run', () => {
  const { t } = waitingOnChecks();
  const snapshot = () => [git(t.main, 'status', '--porcelain'), git(t.main, 'for-each-ref'), git(t.main, 'worktree', 'list', '--porcelain'),
    git(t.wtPath('b'), 'status', '--porcelain')].join('\n--\n');
  const before = snapshot();
  const refs = readdirSync(join(t.main, '.git', 'refs'), { recursive: true }).sort().join(',');
  assert.equal(cli(t, ['--json']).code, 0);
  assert.equal(snapshot(), before);
  assert.equal(readdirSync(join(t.main, '.git', 'refs'), { recursive: true }).sort().join(','), refs);
});
