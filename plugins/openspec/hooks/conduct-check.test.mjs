// Tests for conduct-check.mjs (conduct-rounds design D2-D12). Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/hooks/conduct-check.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, utimesSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { createHash } from 'node:crypto';
import { gitRepo, put, commitAll, git, fakeGh, PR_FILES_KEY, TASKS_ON_KEY, filesFixture, tasksFixture, tasksText, CONFIG, TWO_PRS, cleanEnv, real, roundRepo, pinDoc, underOwnTmp, MERGE_CONFIG, MERGE_FILES, presetMerge } from './test-fixtures.mjs';
import { makeGh } from './merge-setup.mjs';
import { parseRoadmap, readRoadmap } from './guard.mjs';
import { conductState, planningStep, dependencyStep, deliveryStep, deliveryRow, actorOf, selectDispatch, sessionPrefixes, main as conductMain } from './conduct-check.mjs';

// ---------------------------------------------------------------- fixture harness (task 2.1)

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
  const files = { '.openspec.yaml': `schema: ${schema}\n`, 'requirements.md': '# Requirements\n', 'proposal.md': PROPOSAL, 'tasks.md': tasks };
  if (schema === 'devkit') files['design.md'] = '# Design\n';
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
  assert.equal(res.version, 2);
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
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit-lite\n', 'requirements.md': '# Requirements\n', 'proposal.md': PROPOSAL, 'tasks.md': TASKS });
  const res = t.state({ round: 2 });
  assert.equal(byId(res, 'b').state, 'waiting on a, ghost');
});

test('conduct: plan files come from the stage declaration', () => {
  const t = oneChange();
  const b = t.addWt('b');
  const missing = (schema, flow = null) => {
    writeChange(b, 'b', { '.openspec.yaml': `schema: ${schema}\n`, 'requirements.md': '# Requirements\n' });
    if (flow) put(b, { [`openspec/schemas/${schema}/flow.json`]: JSON.stringify(flow) });
    return byId(t.state(), 'b').next.missing;
  };
  // Invariant (T-5, conduct-check, conduct-check.test.mjs): the plan files are the plan stages that always apply and that the change has not passed.
  assert.deepEqual(missing('devkit'), ['decisions.md', 'proposal.md', 'design.md', 'tasks.md']);
  assert.deepEqual(missing('devkit-lite'), ['proposal.md', 'tasks.md']);
  const stage = (id, file, extra = {}) => ({ id, source: 'artifact', file, role: 'change-planner', part: 'plan', title: { en: id, 'pt-BR': id }, ...extra });
  const flow = { version: 1, script: 'devkit-lite', ceilings: { default: 3 }, stages: [
    stage('requirements', 'requirements.md'), stage('mockup', 'mockup.md', { shipped: false }), stage('proposal', 'proposal.md'),
    stage('specs', 'specs/**/*.md'), stage('extra', 'extra.md'), stage('approval', 'approval.md', { role: 'owner' }),
    stage('evidence', 'evidence.md', { part: 'after' }),
  ] };
  assert.deepEqual(missing('devkit-lite', flow), ['proposal.md', 'extra.md']);
});

test('conduct: a worktree at a non-standard path is reused: no worktree or create step (AC-11)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const odd = join(tmpFolder('devkit-odd-'), 'random-name');
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

test('conduct: devkit-lite: with its requirements written, proposal and tasks go straight to delivery; the grill is its only owner row (AC-4)', () => {
  const t = oneChange();
  const b = t.addWt('b');
  planFiles(b, 'b');
  assert.deepEqual(planStep(byId(t.state(), 'b')), ['implement', 'subagent']);
  rmSync(cf(b, 'b', 'requirements.md'));
  assert.deepEqual(planStep(byId(t.state(), 'b')), ['grill', 'owner']);
  writeChange(b, 'b', { 'requirements.md': '# Requirements\n' });
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
    ...['edit-pr-body', 'enable-auto-merge', 'disable-auto-merge', 'update-branch', 'archive', 'tick-roadmap', 'tag-release'].map((s) => [{ step: s }, 'main', undefined, `ready to run: ${s}`]),
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
  assert.match(c.next.command[1], /release-merge\.mjs$/);
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

// Invariant (release-merge-leftovers AC-3): under the two-PR delivery model the release-merge override merges the
// base branch (the repository's default branch, ADR 0018 decision 2), never the test branch, and a conflict outside
// the release files stays blocked. Layer: conduct-check's releaseConflict over deliver-check's two-prs item 5.
// Suite: conduct-check.test.mjs (loaded by guard.test.mjs).
const TWO_PRS_CONFIG = `schema: devkit-lite\n${TWO_PRS}`;
function twoPrsConflict(conflicts) {
  const { t, b } = conflictRepo(conflicts, { config: TWO_PRS_CONFIG });
  // The test branch exists on origin, at the base's tip, as in a two-prs project.
  git(t.main, 'push', '-q', 'origin', 'main:refs/heads/develop');
  // In two-prs deliver-check finds the change PR with `gh pr list --head b --base main` (never `gh pr view`).
  t.ghAt(b).set('pr-list-head-b', { stdout: [prJson('b', { headRefOid: headOf(b), mergeable: 'CONFLICTING' })] });
  return { t, b };
}
// The --base of every `gh pr list` call deliver-check made in worktree b.
const listedBases = (t, b) => t.ghAt(b).calls()
  .filter((a) => a[0] === 'pr' && a[1] === 'list' && a.includes('--base'))
  .map((a) => a[a.indexOf('--base') + 1]);

test('conduct: under two-prs, a change PR in conflict only in release files is resolve-release-conflict on the base branch, never the test branch (release-merge-leftovers AC-3)', () => {
  const { t, b } = twoPrsConflict(['CHANGELOG.md', '.claude-plugin/marketplace.json']);
  const c = byId(t.state(), 'b');
  assert.deepEqual(new Set(listedBases(t, b)), new Set(['main', 'develop']), 'deliver-check read the PRs to main and to develop: the two-prs model is in force');
  assert.deepEqual(planStep(c), ['resolve-release-conflict', 'subagent']);
  assert.equal(c.next.agent, TDD);
  assert.deepEqual(c.next.paths, ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
  assert.equal(c.next.base, 'main');
  assert.match(c.next.command[1], /release-merge\.mjs$/);
  assert.equal(c.next.command[c.next.command.indexOf('--base') + 1], 'main', c.next.command.join(' '));
  assert.ok(!c.next.command.includes('develop'), `the merge command never names the test branch: ${c.next.command.join(' ')}`);
  assert.equal(c.deliver.next.step, 'blocked', 'deliver-check alone says blocked');
  assert.equal(c.deliver.next.conflict, true);
});

test('conduct: under two-prs, a conflict that also has README.md is blocked (release-merge-leftovers AC-3)', () => {
  const { t, b } = twoPrsConflict(['CHANGELOG.md', 'README.md']);
  const c = byId(t.state(), 'b');
  assert.ok(listedBases(t, b).includes('develop'), 'the two-prs model is in force');
  assert.deepEqual(planStep(c), ['blocked', 'stop']);
  assert.equal(c.state, 'blocked: item 5 (conflict in README.md)');
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
  // The merged PR is the change's own (it changed the folder) and every task is ticked on main (field-fixes D-4).
  g.set(PR_FILES_KEY(12), filesFixture([`openspec/changes/${id}/tasks.md`]));
  g.set(TASKS_ON_KEY(id), tasksFixture(tasksText({ ticked: ['1.1'] })));
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

// The state after the release merge, not pushed yet: the branch holds origin/main merged in and the CHANGELOG
// resolved, and the PR still has the old head and still reads CONFLICTING (release-merge-conflict D-5).
function mergedChange({ config = CONFIG, shared = false } = {}) {
  const lines = (first, last) => Array.from({ length: 12 }, (_, i) => (i === 0 ? first : i === 11 ? last : `line ${i + 1}`)).join('\n') + '\n';
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', '- [ ] b']), config,
    files: { 'CHANGELOG.md': '# c\n', ...(shared ? { 'src/shared.ts': lines('line 1', 'line 12') } : {}), ...(config === CONFIG ? {} : MERGE_FILES) },
  });
  const b = t.addWt('b');
  readyChange(b, 'b', { files: { 'CHANGELOG.md': '# c\nb entry\n', ...(shared ? { 'src/shared.ts': lines('b 1', 'line 12') } : {}) } });
  const oldHead = headOf(b);
  t.commitOrigin({ 'CHANGELOG.md': '# c\norigin entry\n', ...(shared ? { 'src/shared.ts': lines('line 1', 'origin 12') } : {}) }, 'origin edits the changelog');
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  try { git(b, 'merge', '-q', '--no-ff', '--no-commit', 'origin/main'); } catch { /* the conflict is the point */ }
  put(b, { 'CHANGELOG.md': '# c\nb entry\norigin entry\n' });
  git(b, 'add', '--', 'CHANGELOG.md');
  git(b, 'commit', '-q', '--no-edit');
  return { t, b, oldHead };
}

// Reviews and evidence at the merge head, committed, as `verify` and `review` leave them.
function reviewedAt(b) {
  writeReviews(b, 'b', headOf(b));
  commitAll(b, 'reviews and evidence');
}

test('release-merge-conflict 8: after a release merge that is not pushed, the records stay current and push hands a plain git push', () => {
  const { t, b } = mergedChange();
  const c = byId(t.state(), 'b');
  assert.equal(c.deliver.next.step, 'blocked');
  assert.equal(c.deliver.next.conflict, true);
  assert.deepEqual(planStep(c), ['push', 'subagent']);
  assert.equal(c.next.agent, CAP);
  assert.deepEqual(c.next.command, ['git', 'push', 'origin', 'b']);
  assert.equal(c.next.number, 12);
  assert.doesNotMatch(JSON.stringify(c.next), /--force/);
});

test('release-merge-conflict 8b: after a release merge that also brings a file the branch changed, verify and review run again, then push hands a plain git push', () => {
  const { t, b } = mergedChange({ shared: true });
  let c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['verify', 'subagent']);
  reviewedAt(b);
  c = byId(t.state(), 'b');
  assert.equal(c.deliver.next.step, 'blocked');
  assert.equal(c.deliver.next.conflict, true);
  assert.deepEqual(planStep(c), ['push', 'subagent']);
  assert.equal(c.next.agent, CAP);
  assert.deepEqual(c.next.command, ['git', 'push', 'origin', 'b']);
  assert.doesNotMatch(JSON.stringify(c.next), /--force/);
});

test('release-merge-conflict 9: a merge already pushed while GitHub still reports the conflict keeps update-branch in merge mode', () => {
  const { t, b } = mergedChange({ config: MERGE_CONFIG });
  presetMerge(t.ghAt(b));
  reviewedAt(b);
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  const c = byId(t.state(), 'b');
  assert.deepEqual([c.next.step, c.next.actor], ['update-branch', 'main']);
});

test('release-merge-conflict 10: a local commit ahead of the PR head without origin/<base> is not pushed by the override', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const b = t.addWt('b');
  readyChange(b, 'b');
  const oldHead = headOf(b);
  t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  put(b, { 'openspec/changes/b/notes.md': 'n\n' });
  commitAll(b, 'notes');
  openPr(t, b, 'b', { headRefOid: oldHead, mergeable: 'CONFLICTING' });
  const c = byId(t.state(), 'b');
  assert.equal(c.next.step, 'blocked');
  assert.match(c.state, /merge conflicts/);
});

test('release-merge-conflict 11: a PR head that is not in the local history is stopped, neither pushed nor updated, in pr and in merge mode', () => {
  for (const config of [CONFIG, MERGE_CONFIG]) {
    const { t, b } = mergedChange({ config });
    if (config !== CONFIG) presetMerge(t.ghAt(b));
    reviewedAt(b);
    openPr(t, b, 'b', { headRefOid: 'f'.repeat(40), mergeable: 'CONFLICTING' });
    const c = byId(t.state(), 'b');
    assert.equal(c.next.step, 'blocked', config);
    assert.equal(c.next.actor, 'stop', config);
    assert.match(c.state, /not in local history/, config);
  }
});

function mergedArchive({ config = CONFIG } = {}) {
  const r = archiveRepo({ config, archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n' } });
  const oldHead = headOf(r.wt);
  r.t.commitOrigin({ 'CHANGELOG.md': '# c\norigin edit\n' }, 'origin edits the changelog');
  try { git(r.wt, 'merge', '-q', '--no-ff', '--no-commit', 'origin/main'); } catch { /* the conflict is the point */ }
  put(r.wt, { 'CHANGELOG.md': '# c\narchive edit\norigin edit\n' });
  git(r.wt, 'add', '--', 'CHANGELOG.md');
  git(r.wt, 'commit', '-q', '--no-edit');
  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: oldHead, mergeable: 'CONFLICTING' })]);
  return { ...r, oldHead };
}

test('release-merge-conflict 12: an archive PR after its release merge hands open-archive-pr with a plain push; a foreign head stays stopped', () => {
  const r = mergedArchive();
  let c = byId(r.t.state(), 'b');
  assert.deepEqual(planStep(c), ['open-archive-pr', 'subagent']);
  assert.deepEqual(c.next.command, ['git', 'push', 'origin', 'chore/archive-b']);
  assert.doesNotMatch(JSON.stringify(c.next), /--force/);

  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: 'f'.repeat(40), mergeable: 'CONFLICTING' })]);
  c = byId(r.t.state(), 'b');
  assert.deepEqual([c.next.step, c.next.actor], ['blocked', 'stop']);
  assert.match(c.state, /^blocked: archive \(archive-pr\): .*not in local history/);
});

test('release-merge-conflict 13: auto-merge still on is switched off before the push, on a change PR and on an archive PR', () => {
  const { t, b } = mergedChange({ config: MERGE_CONFIG });
  presetMerge(t.ghAt(b));
  openPr(t, b, 'b', { mergeable: 'CONFLICTING', autoMergeRequest: { enabledAt: 'x' } });
  assert.equal(byId(t.state(), 'b').next.step, 'disable-auto-merge');

  const r = mergedArchive({ config: MERGE_CONFIG });
  archiveGh(r.t, r.wt, 'b', [ARCHIVE_PR({ headRefOid: r.oldHead, mergeable: 'CONFLICTING', autoMergeRequest: { enabledAt: 'x' } })]);
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

// ---------------------------------------------------------------- watch (task 2.8)

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
  return conductMain(args, { ...t.ghAt(t.main).env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', DEVKIT_BYPASS: '', DEVKIT_HOST: 'cli', ...env }, cwd);
}

test('conduct: --json prints version 2 with the D2 fields, no wake and a sessionPrefix per change', () => {
  const t = lites(['a', 'b']);
  const r = cli(t, ['--json']);
  assert.equal(r.code, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.version, 2);
  for (const k of ['base', 'mode', 'change', 'round', 'startedAt', 'skipped', 'roadmapDone', 'changes', 'dispatch', 'owner', 'github', 'stopped', 'busy', 'end']) assert.ok(k in j, k);
  assert.deepEqual([j.mode, j.change], ['round', null]);
  assert.ok(!('wake' in j), 'wake is removed');
  for (const c of j.changes) assert.equal(c.sessionPrefix, `${c.id}-p`);
  assert.deepEqual(Object.keys(j.changes[0]).sort(), ['after', 'base', 'branch', 'deliver', 'id', 'next', 'notes', 'round', 'schema', 'sessionPrefix', 'state', 'text', 'unfinished', 'worktree']);
  for (const c of j.changes) assert.equal(c.unfinished, null, 'a clean worktree has nothing unfinished');
  for (const k of ['step', 'actor', 'reason']) assert.ok(k in j.changes[0].next, k);
  assert.deepEqual(j.dispatch, ['a', 'b']);
});

test('conduct: human output has one line per change, then dispatch, owner and github', () => {
  const t = lites(['a', 'b']);
  const r = cli(t, []);
  assert.equal(r.code, 0);
  const lines = r.stdout.trimEnd().split('\n');
  assert.deepEqual(lines.slice(0, 2), ['a: ready to run: implement', 'b: ready to run: implement']);
  assert.deepEqual(lines.slice(2).map((l) => l.split(':')[0]), ['dispatch', 'owner', 'github']);
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
  const none = tmpFolder('devkit-none-');
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

// ---------------------------------------------------------------- sessions (conduct-sessions phase 1)

const appEnv = { ...cleanEnv, DEVKIT_HOST: 'app' };

test('conduct: under the app host implement is a session row of tdd-implementer; under cli it is the subagent', () => {
  assert.deepEqual(actorOf('implement', 'app'), { actor: 'session', agent: TDD });
  assert.deepEqual(actorOf('implement', 'cli'), { actor: 'subagent', agent: TDD });
  assert.deepEqual(actorOf('implement'), { actor: 'subagent', agent: TDD });
  assert.equal(actorOf('commit', 'app').actor, 'subagent', 'only implement becomes a session');
  const app = deliveryStep({ id: 'x' }, REPORT({ step: 'implement' }, { host: 'app' }));
  assert.deepEqual([app.next.actor, app.next.agent, app.state], ['session', TDD, 'ready to run: implement']);
  const cliRow = deliveryStep({ id: 'x' }, REPORT({ step: 'implement' }, { host: 'cli' }));
  assert.equal(cliRow.next.actor, 'subagent');
  assert.equal(deliveryStep({ id: 'x' }, REPORT({ step: 'implement' })).next.actor, 'subagent', 'no host means cli');
});

test('conduct: app host: a change at implement has next.actor session, and running when its id is in --busy', () => {
  const t = lites(['a', 'b']);
  let res = t.state({ env: appEnv });
  assert.equal(byId(res, 'a').next.actor, 'session');
  assert.equal(byId(res, 'a').state, 'ready to run: implement');
  assert.deepEqual(res.dispatch, ['a', 'b']);
  res = t.state({ env: appEnv, busy: ['a'] });
  assert.equal(byId(res, 'a').state, 'running');
  assert.deepEqual(res.dispatch, ['b']);
  assert.equal(t.state().changes[0].next.actor, 'subagent', 'cli keeps the 0.8.0 actor');
  assert.equal(t.state().changes[0].session, undefined);
});

test('conduct: sessionPrefixes: plain, cut at 20, a two-digit phase keeps the prefix', () => {
  const p = sessionPrefixes(['add-login', 'conduct-sessions-with-a-long-id', 'twenty-chars-exactly-1']);
  assert.equal(p.get('add-login'), 'add-login-p');
  assert.equal(p.get('conduct-sessions-with-a-long-id'), 'conduct-sessions-wit-p');
  assert.equal(p.get('twenty-chars-exactly-1'), 'twenty-chars-exactly-p');
  assert.equal(sessionPrefixes(['abcdefghijklmnopqrs-xyz']).get('abcdefghijklmnopqrs-xyz'), 'abcdefghijklmnopqrs-p', 'trailing dash removed');
  for (const n of ['1', '9', '10', '99']) assert.ok(`${p.get('conduct-sessions-with-a-long-id')}${n}`.length <= 24, n);
});

test('conduct: sessionPrefixes: a collision of the cut ids gives both the 18-cut plus two SHA-1 hex characters', () => {
  const a = 'a-very-long-change-id-one';
  const b = 'a-very-long-change-id-two';
  const p = sessionPrefixes([a, b]);
  const hh = (id) => createHash('sha1').update(id).digest('hex').slice(0, 2);
  assert.equal(p.get(a), `a-very-long-change${hh(a)}-p`);
  assert.equal(p.get(b), `a-very-long-change${hh(b)}-p`);
  assert.ok(p.get(a).length + 2 <= 24);
  assert.equal(sessionPrefixes([a]).get(a), 'a-very-long-change-i-p', 'alone, the plain rule applies');
});

test('conduct: one id extending another gets a distinct prefix that the shorter one cannot match', () => {
  const p = sessionPrefixes(['add-x', 'add-x-pagination']);
  assert.notEqual(p.get('add-x'), p.get('add-x-pagination'));
  const short = new RegExp(`^${p.get('add-x')}[0-9]+$`);
  const long = new RegExp(`^${p.get('add-x-pagination')}[0-9]+$`);
  assert.ok(!short.test(`${p.get('add-x-pagination')}1`));
  assert.ok(!long.test(`${p.get('add-x')}1`));
});

test('conduct: app host: the session descriptor has title, name, cwd, branch, phase, brief and background', () => {
  const t = lites(['a']);
  const row = byId(t.state({ env: appEnv }), 'a');
  const s = row.session;
  assert.deepEqual(Object.keys(s).sort(), ['background', 'branch', 'brief', 'cwd', 'name', 'phase', 'title']);
  assert.equal(s.title, 'a: phase 1');
  assert.equal(s.name, 'a-p1');
  assert.equal(s.cwd, row.worktree);
  assert.equal(s.branch, 'a');
  assert.equal(s.phase, 1);
  assert.equal(row.sessionPrefix, 'a-p');
  assert.match(s.name, /^[a-z0-9-]{1,24}$/);
  for (const phrase of ['phase 1', 'change `a`', row.worktree, 'devkit-core:tdd-implementer', 'Outcome: success', 'Outcome: failure: <reason>', 'Head: <sha',
    'in the `devkit` schema the project\'s hooks refuse it', `cd ${row.worktree} && `]) assert.ok(s.brief.includes(phrase), phrase);
  assert.match(s.background, /round 1/i);
  assert.match(s.background, /devkit-lite/);
  assert.match(s.background, /recomputes the next step/);
});

test('conduct: app host: a change with phase 1 ticked and phase 2 open describes phase 2 (name, title, phase, brief)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a']) });
  const tasks = '# Tasks\n\n## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `true` green\n\n## 2. Second\n- [ ] 2.1 more\n- [ ] 2.2 Gate: `true` green\n';
  planFiles(t.addWt('a'), 'a', { tasks });
  const row = byId(t.state({ env: appEnv }), 'a');
  assert.equal(row.next.step, 'implement');
  assert.equal(row.session.name, 'a-p2');
  assert.equal(row.session.phase, 2);
  assert.equal(row.session.title, 'a: phase 2');
  assert.ok(row.session.brief.includes('phase 2 of change `a`'), 'brief names phase 2');
  assert.ok(row.session.brief.includes('Implement phase 2 of change a'), 'subagent line names phase 2');
  assert.ok(!row.session.brief.includes('phase 1'), 'brief never names phase 1');
});

test('conduct: sessionPrefix is on every change row of the round, whatever its step', () => {
  const t = lites(['a', 'b']);
  rmSync(cf(real(t.wtPath('b')), 'b', 'tasks.md'));
  const res = conductState(t.main, { env: appEnv, ghFor: t.ghFor });
  assert.notEqual(byId(res, 'b').next.step, 'implement');
  assert.equal(byId(res, 'b').sessionPrefix, 'b-p');
  assert.equal(byId(res, 'b').session, undefined);
});

test('conduct: version 2 in the report and in the exit-3 error object; wake is gone', () => {
  const t = lites(['a']);
  assert.equal(t.state().version, 2);
  assert.ok(!('wake' in t.state()));
  const r = conductMain(['--json', '--round', '9'], { ...cleanEnv }, t.main);
  assert.equal(r.code, 3);
  assert.equal(JSON.parse(r.stdout).version, 2);
});

test('conduct: a dispatch of two sessions and one subagent is capped at three; a fourth waits', () => {
  const t = lites(['a', 'b', 'c', 'd']);
  const c = t.state({ env: appEnv });
  assert.deepEqual(c.dispatch, ['a', 'b', 'c']);
  assert.equal(selectDispatch([
    { id: 'a', next: { actor: 'session' } }, { id: 'b', next: { actor: 'session' } },
    { id: 'c', next: { actor: 'subagent' } }, { id: 'd', next: { actor: 'session' } },
  ]).join(), 'a,b,c');
  assert.deepEqual(selectDispatch([{ id: 'a', next: { actor: 'session' } }], ['x', 'y', 'z']), []);
});

// ---------------------------------------------------------------- one change (conduct-one-change phase 1)

test('conduct: --change gives the same single row as the round mode, without a round (AC-1)', () => {
  const t = lites(['a', 'b']);
  const inRound = byId(t.state({ env: appEnv }), 'a');
  const res = t.state({ env: appEnv, change: 'a' });
  assert.deepEqual([res.version, res.mode, res.change, res.round, res.startedAt, res.skipped, res.roadmapDone], [2, 'change', 'a', null, null, [], false]);
  assert.equal(res.changes.length, 1);
  assert.equal(res.changes[0].id, 'a');
  assert.equal(res.changes[0].round, null);
  for (const k of ['next', 'state', 'sessionPrefix']) assert.deepEqual(res.changes[0][k], inRound[k], k);
  const { background, ...session } = res.changes[0].session;
  const { background: _round, ...roundSession } = inRound.session;
  assert.deepEqual(session, roundSession);
  assert.equal(background, 'Change `a`, conducted on its own: no roadmap round. Schema: devkit-lite. The coordinating session recomputes the next step when you end; it runs the gate and the commit.');
  assert.deepEqual(res.dispatch, ['a']);
  const roundRes = t.state({ env: appEnv });
  assert.deepEqual([roundRes.mode, roundRes.change], ['round', null]);
});

test('conduct: --change reads no roadmap: a repository without one on origin/main still exits 0 (AC-1)', () => {
  const t = lites(['a']);
  git(t.main, 'rm', '-q', 'openspec/roadmap.md');
  commitAll(t.main, 'drop the roadmap');
  git(t.main, 'push', '-q', 'origin', 'main');
  git(t.main, 'fetch', '-q', 'origin');
  const r = cli(t, ['--json', '--change', 'a']);
  assert.equal(r.code, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepEqual([j.mode, j.change, j.round, j.changes[0].id, j.changes[0].next.step], ['change', 'a', null, 'a', 'implement']);
  assert.equal(cli(t, ['--json']).code, 3, 'the round mode still needs it');
});

test('conduct: --change through the CLI: --change=<id>, the usage line, and exit 3 for --round or a bad id (AC-1)', () => {
  const t = lites(['a']);
  assert.equal(JSON.parse(cli(t, ['--json', '--change=a']).stdout).change, 'a');
  assert.match(cli(t, ['--bogus']).stderr, /\[--change <id>\]/);
  let r = cli(t, ['--json', '--change', 'a', '--round', '1']);
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.stdout).error, /--change and --round do not combine/);
  assert.equal(cli(t, ['--json', '--round', '1', '--change', 'a']).code, 3);
  for (const bad of ['..', '.', 'archive', 'a/b', '', 'a b']) {
    r = cli(t, ['--json', '--change', bad]);
    assert.equal(r.code, 3, `"${bad}"`);
    assert.match(JSON.parse(r.stdout).error, /--change expects a change id/);
  }
  r = cli(t, ['--json', '--change', '--json']);
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.stdout).error, /--change expects a change id, not "--json"/);
  for (const args of [['--change', '-x'], ['--change=-rf']]) {
    r = cli(t, ['--json', ...args]);
    assert.equal(r.code, 3, args.join(' '));
    assert.match(JSON.parse(r.stdout).error, /--change expects a change id, not "-/);
  }
  assert.equal(cli(t, ['--json', '--change', 'a']).code, 0, 'a plain id still works');
});

test('conduct: --change <id> --watch returns the recomputed single row when the checks flip (AC-2)', () => {
  let { t } = waitingOnChecks(3);
  let res = conductState(t.main, { env: watchEnv, ghFor: t.ghFor, watch: 0.05, change: 'b' });
  assert.equal(res.watch.timedOut, false);
  assert.equal(res.mode, 'change');
  assert.equal(res.changes.length, 1);
  assert.equal(byId(res, 'b').next.step, 'ready', 'the one row is recomputed');
  ({ t } = waitingOnChecks());
  res = conductState(t.main, { env: watchEnv, ghFor: t.ghFor, watch: 0.01, change: 'b' });
  assert.equal(res.watch.timedOut, true);
  assert.equal(byId(res, 'b').next.step, 'wait-checks');
});

// ---------------------------------------------------------------- existence (design D3)

const errorOf = (t, id, args = []) => {
  const r = cli(t, ['--json', '--change', id, ...args]);
  assert.equal(r.code, 3, r.stdout);
  return JSON.parse(r.stdout).error;
};

test('conduct: --change of an id that exists nowhere is exit 3 "no change <id>:" and never create (AC-2)', () => {
  const t = lites(['a']);
  const e = errorOf(t, 'ghost');
  assert.ok(e.startsWith('no change ghost:'), e);
  assert.match(e, /openspec new change ghost --schema <devkit\|devkit-lite>/);
  assert.equal(cli(t, ['--json']).code, 0, 'the round mode is unchanged');
});

test('conduct: --change of a worktree with no folder is exit 3 "change <id> has a worktree without a folder:" (AC-2)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']) });
  const wt = t.addWt('b');
  const e = errorOf(t, 'b');
  assert.ok(e.startsWith('change b has a worktree without a folder:'), e);
  assert.ok(e.includes(wt));
  assert.match(e, /openspec new change b --schema/);
  assert.equal(byId(t.state(), 'b').next.step, 'new-change', 'the round mode still asks');
});

test('conduct: --change reads a chore/archive-<id> worktree that holds only the archived folder (D2)', () => {
  const { t, wt, id } = archiveRepo();
  archiveGh(t, wt, id, [ARCHIVE_PR({ headRefOid: headOf(wt) })]);
  const row = t.state({ change: id });
  assert.equal(row.changes.length, 1);
  const round = byId(t.state(), id);
  assert.equal(row.changes[0].next.step, round.next.step);
  assert.equal(row.changes[0].state, round.state);
});

test('conduct: --change of the active folder in a checkout on another branch is exit 3 "is on another branch" naming git switch -c (AC-2)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] x']) });
  writeChange(t.main, 'x', { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': PROPOSAL, 'tasks.md': TASKS });
  const e = errorOf(t, 'x');
  assert.ok(e.startsWith('change x is on another branch:'), e);
  assert.ok(e.includes('git switch -c x'));
  assert.ok(e.includes('on branch main'));
});

test('conduct: --change keeps the three worktree rows, a local branch without the folder included (AC-2)', () => {
  const t = lites(['a']);
  git(t.main, 'branch', 'loc', 'origin/main');
  let c = t.state({ change: 'loc' }).changes[0];
  assert.deepEqual([c.next.step, c.next.actor, c.next.command], ['worktree', 'main', ['git', 'worktree', 'add', t.wtPath('loc'), 'loc']]);
  git(t.main, 'branch', 'rem', 'origin/main');
  git(t.main, 'push', '-q', 'origin', 'rem');
  git(t.main, 'branch', '-q', '-D', 'rem');
  c = t.state({ change: 'rem' }).changes[0];
  assert.deepEqual(c.next.command, ['git', 'worktree', 'add', '--track', '-b', 'rem', t.wtPath('rem'), 'origin/rem']);
  t.commitOrigin({ 'openspec/changes/onbase/proposal.md': PROPOSAL });
  c = t.state({ change: 'onbase' }).changes[0];
  assert.deepEqual(c.next.command, ['git', 'worktree', 'add', '-b', 'onbase', t.wtPath('onbase'), 'origin/main']);
  assert.equal(c.unfinished, null);
});

test('conduct: --change of a change archived on origin/main with no worktree reads archived (AC-2)', () => {
  const t = lites(['a']);
  t.commitOrigin({ 'openspec/changes/archive/2026-11-09-old/proposal.md': PROPOSAL, 'openspec/changes/archive/2026-11-09-older-old/proposal.md': PROPOSAL });
  const res = t.state({ change: 'old' });
  const c = res.changes[0];
  assert.deepEqual([c.next.step, c.next.actor, c.state, c.unfinished], ['archived', 'none', 'archived', null]);
  assert.equal(c.worktree, t.wtPath('old'));
  assert.equal(res.end, true);
  assert.equal(errorOf(t, 'ol').slice(0, 10), 'no change ', 'a name that only ends the same way is not it');
});

// ---------------------------------------------------------------- unfinished (design D4)

const HALF_TASKS = '# Tasks\n\n## 1. First\n- [x] 1.1 code\n- [x] 1.9 Gate: `true` green\n\n## 2. Second\n- [x] 2.1 more\n- [ ] 2.9 Gate: `true` green\n';
const GATE_TASKS = '# Tasks\n\n## 1. First\n- [x] 1.1 code\n- [ ] 1.9 Gate: `true` green\n';

test('conduct: unfinished is null on a clean worktree and on rows without a worktree, in both modes (AC-3)', () => {
  const t = lites(['a']);
  git(t.main, 'branch', 'loc', 'origin/main');
  assert.equal(byId(t.state(), 'a').unfinished, null);
  assert.equal(t.state({ change: 'a' }).changes[0].unfinished, null);
  assert.equal(t.state({ change: 'loc' }).changes[0].unfinished, null);
});

test('conduct: unfinished.dirty lists product files, not files under openspec/changes/<id>/ (AC-3)', () => {
  const t = lites(['a']);
  const wt = real(t.wtPath('a'));
  writeChange(wt, 'a', { 'notes.md': 'x\n' });
  assert.equal(t.state({ change: 'a' }).changes[0].unfinished, null, 'a plan file is not unfinished work');
  put(wt, { 'src/a.ts': 'x\n', 'src/b.ts': 'x\n' });
  const u = t.state({ change: 'a' }).changes[0].unfinished;
  assert.deepEqual(u.dirty.sort(), ['src/a.ts', 'src/b.ts']);
  assert.deepEqual(u.phases, []);
  assert.equal(u.summary, `2 uncommitted paths outside openspec/: ${u.dirty.join(', ')}`);
  assert.ok(!u.dirty.some((f) => f.startsWith('openspec/')));
});

test('conduct: unfinished.phases is [2] for a half-done phase 2 with phase 1 fully ticked, and [1] when only the gate is open (AC-3)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a', '- [ ] g']) });
  planFiles(t.addWt('a'), 'a', { tasks: HALF_TASKS });
  planFiles(t.addWt('g'), 'g', { tasks: GATE_TASKS });
  const a = t.state({ change: 'a' }).changes[0].unfinished;
  assert.deepEqual([a.dirty, a.phases], [[], [2]]);
  assert.equal(a.summary, 'phase 2 half done (2.1 ticked, 2.9 open)');
  const g = t.state({ change: 'g' }).changes[0].unfinished;
  assert.deepEqual([g.dirty, g.phases], [[], [1]]);
  assert.equal(g.summary, 'phase 1 half done (1.1 ticked, 1.9 open)');
  const inRound = t.state();
  assert.deepEqual(byId(inRound, 'a').unfinished, a, 'the same row in round mode');
  assert.deepEqual(byId(inRound, 'g').unfinished, g);
  assert.equal(inRound.version, 2);
});

test('conduct: unfinished names the dirty paths and the half-done phase together (AC-3)', () => {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] a']) });
  const wt = t.addWt('a');
  planFiles(wt, 'a', { tasks: GATE_TASKS });
  put(wt, { 'src/one.ts': 'x\n' });
  const u = t.state({ change: 'a' }).changes[0].unfinished;
  assert.equal(u.summary, '1 uncommitted path outside openspec/: src/one.ts; phase 1 half done (1.1 ticked, 1.9 open)');
});

// ---------------------------------------------------------------- the CI pin (release-rebase-pin)

const PIN_DOC = 'docs/openspec-flow.md';

// A round whose change and origin both edit CHANGELOG.md and docs/openspec-flow.md.
function pinConflictRepo({ change, origin }) {
  const t = roundRepo({
    roadmap: roadmapOf(['Round 1: x', '- [ ] b']),
    files: { 'CHANGELOG.md': '# c\n', [PIN_DOC]: pinDoc('0.10.0') },
  });
  const b = t.addWt('b');
  readyChange(b, 'b', { files: { 'CHANGELOG.md': '# c\nchange edit\n', [PIN_DOC]: change } });
  t.commitOrigin({ 'CHANGELOG.md': '# c\norigin edit\n', [PIN_DOC]: origin }, 'origin edits');
  openPr(t, b, 'b', { mergeable: 'CONFLICTING' });
  return { t, b };
}

test('conduct pin: a change PR whose only conflicts are release files and the CI pin is resolve-release-conflict, and nothing is touched (AC-1)', () => {
  const { t, b } = pinConflictRepo({ change: pinDoc('0.10.1', { bottom: 'BOTTOM B' }), origin: pinDoc('0.11.0', { top: 'TOP A' }) });
  const head = headOf(b);
  const status = git(b, 'status', '--porcelain');
  const { value: c, left } = underOwnTmp(() => byId(t.state(), 'b'));
  assert.deepEqual(planStep(c), ['resolve-release-conflict', 'subagent']);
  assert.deepEqual(c.next.paths, ['CHANGELOG.md', PIN_DOC]);
  assert.match(c.next.reason, /and the CI pin/);
  assert.equal(headOf(b), head);
  assert.equal(git(b, 'status', '--porcelain'), status);
  // The state read also makes the folder of its fake gh (devkit-gh-*, the harness's own); the invariant is the pin folder.
  assert.deepEqual(left.filter((f) => f.startsWith('devkit-pin-')), [], 'the state read leaves no devkit-pin-* folder');
});

test('conduct pin: both sides editing one paragraph of docs/openspec-flow.md is blocked (AC-2)', () => {
  const { t } = pinConflictRepo({ change: pinDoc('0.10.1', { top: 'TOP B' }), origin: pinDoc('0.11.0', { top: 'TOP A' }) });
  const c = byId(t.state(), 'b');
  assert.equal(c.state, `blocked: item 5 (conflict in ${PIN_DOC})`);
  assert.equal(c.next.actor, 'stop');
});

test('conduct pin: an archive PR conflicting in the CI pin only is resolve-release-conflict, beyond the pin it is blocked (AC-3)', () => {
  const retro = `# Retro: b\n\n## Proposed updates\n\n### \`${PIN_DOC}\` (process-friction)\nSummary of ${PIN_DOC}.\n- before: old\n+ after: new\n- Answer: approved\n- Applied: yes\n`;
  const retroPath = 'openspec/changes/archive/2026-11-09-b/retro.md';
  const conflict = (mine, theirs) => {
    const { t, wt } = archiveRepo({ files: { [PIN_DOC]: pinDoc('0.10.0') }, archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n', [PIN_DOC]: mine, [retroPath]: retro } });
    t.commitOrigin({ 'CHANGELOG.md': '# c\norigin edit\n', [PIN_DOC]: theirs }, 'origin edits both');
    archiveGh(t, wt, 'b', [ARCHIVE_PR({ headRefOid: headOf(wt), mergeable: 'CONFLICTING' })]);
    return byId(t.state(), 'b');
  };
  const pinOnly = conflict(pinDoc('0.10.1', { bottom: 'BOTTOM B' }), pinDoc('0.11.0', { top: 'TOP A' }));
  assert.deepEqual(planStep(pinOnly), ['resolve-release-conflict', 'subagent']);
  assert.ok(pinOnly.next.paths.includes(PIN_DOC));
  const beyond = conflict(pinDoc('0.10.1', { top: 'TOP B' }), pinDoc('0.11.0', { top: 'TOP A' }));
  assert.equal(beyond.state, `blocked: archive (archive-pr): conflict in ${PIN_DOC}`);
});

// ---- field-fixes 10: the plan audit is read from its first Verdict line (spec verdict-files, design D-3)
function twoVerdictAudit(first, second) {
  const { t, b } = rebased();
  writeChange(b, 'b', { 'audit.md': `# Plan audit: b\n\n- Verdict: ${first}\n- Base: ${t.originSha()}\n- Date: 2026-11-09\n\n### Notes\n- Verdict: ${second}\n` });
  at(cf(b, 'b', 'audit.md'), T0 + 100);
  return byId(t.state(), 'b');
}

test('field-fixes 10 verdict: an audit with ACCURATE first and OUTDATED later is not revise-plan, and the reverse is (AC-3)', () => {
  const accurate = twoVerdictAudit('ACCURATE', 'OUTDATED');
  assert.deepEqual(planStep(accurate), ['implement', 'subagent']);
  assert.doesNotMatch(JSON.stringify(accurate.next), /OUTDATED/);
  assert.deepEqual(planStep(twoVerdictAudit('OUTDATED', 'ACCURATE')), ['revise-plan', 'subagent']);
});

// ---------------------------------------------------------------- stage-roles: plan files of a stage that may not apply

test('stage-roles flow conduct-check: a full-script change before its proposal is asked for decisions.md and never for mockup.md', () => {
  const t = oneChange();
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit\n', 'requirements.md': '# Requirements\n\nClassification: domain=x type=y flags=[ui]\n' });
  const missing = byId(t.state(), 'b').next.missing;
  assert.deepEqual(missing, ['decisions.md', 'proposal.md', 'design.md', 'tasks.md']);
  assert.ok(!missing.includes('mockup.md'), 'the mock-up is the screen designer\'s, never the planner\'s');
});

test('stage-roles flow conduct-check: with proposal.md present the change is past the decisions and is never asked for them', () => {
  const t = oneChange();
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit\n', 'requirements.md': '# Requirements\n', 'proposal.md': PROPOSAL });
  const missing = byId(t.state(), 'b').next.missing;
  assert.deepEqual(missing, ['design.md', 'tasks.md']);
});

test('stage-roles flow conduct-check: the short script is asked for no decisions file', () => {
  const t = oneChange();
  const b = t.addWt('b');
  writeChange(b, 'b', { '.openspec.yaml': 'schema: devkit-lite\n', 'requirements.md': '# Requirements\n' });
  assert.deepEqual(byId(t.state(), 'b').next.missing, ['proposal.md', 'tasks.md']);
});

// ---------------------------------------------------------------- ADR numbers the base took (roadmap-sessions-upfront D-10, AC-11)

const ADR_BODY = (n, name) => `# ADR ${n}: ${name}\n\nStatus: proposed\n`;
// A round whose change `b` adds `branch` files (path -> text) after it forked, while origin/main gains `origin`.
function adrRepo({ branch, origin = {} }) {
  const t = roundRepo({ roadmap: roadmapOf(['Round 1: x', '- [ ] b']), files: { 'docs/adr/0001-first.md': ADR_BODY('1', 'first') } });
  const b = t.addWt('b');
  readyChange(b, 'b', { files: branch });
  if (Object.keys(origin).length) t.commitOrigin(origin, 'origin adds records');
  openPr(t, b, 'b');
  return { t, b };
}

// Invariant (AC-11, conduct-check, conduct): an ADR number the default branch gave another file is renumbered by the implementer, never asked of the owner.
test('upfront AC-11 adr: a number the base gave another file is renumbered to the next free one', () => {
  const { t } = adrRepo({
    branch: { 'docs/adr/0016-a.md': ADR_BODY('16', 'a') },
    origin: { 'docs/adr/0016-b.md': ADR_BODY('16', 'b'), 'docs/adr/0017-c.md': ADR_BODY('17', 'c') },
  });
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['renumber-adr', 'subagent']);
  assert.equal(c.next.agent, TDD);
  assert.deepEqual(c.next.files, [{ from: 'docs/adr/0016-a.md', to: 'docs/adr/0018-a.md', number: '0018' }]);
  assert.match(c.next.reason, /an ADR number the base took: renumber docs\/adr\/0016-a\.md to docs\/adr\/0018-a\.md and every reference/);
});

test('upfront AC-11 adr: the folder docs/decisions is read like docs/adr', () => {
  const { t } = adrRepo({
    branch: { 'docs/decisions/0005-a.md': ADR_BODY('5', 'a') },
    origin: { 'docs/decisions/0005-b.md': ADR_BODY('5', 'b') },
  });
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['renumber-adr', 'subagent']);
  assert.deepEqual(c.next.files, [{ from: 'docs/decisions/0005-a.md', to: 'docs/decisions/0006-a.md', number: '0006' }]);
});

test('upfront AC-11 adr: no clash gives no step', () => {
  const { t } = adrRepo({
    branch: { 'docs/adr/0016-a.md': ADR_BODY('16', 'a') },
    origin: { 'docs/adr/0015-b.md': ADR_BODY('15', 'b'), 'docs/decisions/0016-c.md': ADR_BODY('16', 'c') },
  });
  const c = byId(t.state(), 'b');
  assert.notEqual(c.next.step, 'renumber-adr', 'a number in another folder is no clash');
  assert.equal(c.next.files, undefined);
});

test('upfront AC-11 adr: the same file on both gives no step', () => {
  const same = { 'docs/adr/0016-a.md': ADR_BODY('16', 'a') };
  const { t } = adrRepo({ branch: same, origin: same });
  assert.notEqual(byId(t.state(), 'b').next.step, 'renumber-adr');
});

test('upfront AC-11 adr: two clashes take the next two numbers in order', () => {
  const { t } = adrRepo({
    branch: { 'docs/adr/0017-b.md': ADR_BODY('17', 'b'), 'docs/adr/0016-a.md': ADR_BODY('16', 'a') },
    origin: { 'docs/adr/0016-x.md': ADR_BODY('16', 'x'), 'docs/adr/0017-y.md': ADR_BODY('17', 'y') },
  });
  const c = byId(t.state(), 'b');
  assert.deepEqual(planStep(c), ['renumber-adr', 'subagent']);
  assert.deepEqual(c.next.files, [
    { from: 'docs/adr/0016-a.md', to: 'docs/adr/0018-a.md', number: '0018' },
    { from: 'docs/adr/0017-b.md', to: 'docs/adr/0019-b.md', number: '0019' },
  ]);
});

test('upfront AC-11 adr: an unresolvable base gives no step', () => {
  const { t } = adrRepo({
    branch: { 'docs/adr/0016-a.md': ADR_BODY('16', 'a') },
    origin: { 'docs/adr/0016-b.md': ADR_BODY('16', 'b') },
  });
  const wt = t.wtPath('b');
  const ctx = { root: t.main, ref: 'origin/no-such-branch', base: 'no-such-branch' };
  const row = { id: 'b', worktree: wt };
  const report = { summary: 's', met: [], next: { step: 'wait-checks', reason: 'r' } };
  const out = deliveryRow(ctx, row, { state: {}, report });
  assert.notEqual(out.next.step, 'renumber-adr');
});
