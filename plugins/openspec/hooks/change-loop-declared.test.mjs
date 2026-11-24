// coordinator-loop-fixes: the loop-level tests of the steps and ends the session declares outside the stage gates (design
// D-1 to D-16): the `reply` and `declare` commands of change-loop.mjs and roadmap-loop.mjs, the stop hook on a transcript that
// holds their output, the state a declared end gives, and the devkit skills' text. Every test is named
// `coordinator-loop-fixes AC-<n> T<k> ...` after the design's D-16 table. Run by `node scripts/test-suite.mjs`, in a process of
// its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-declared.test.mjs`.
//
// This file imports only fixtures modules, never a test file. It reads the modules under test through namespace imports, so it
// loads before an export it tests exists; every folder it makes goes through test-tmp.mjs (by the fixtures' helpers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import {
  planChange, transcriptOf, typedLine, runLine, toolResultLine, stopInput, sandbox, cleanEnvLoop as cleanEnv,
  cmd, FLAGS, projectWith, roadmapText, putRun, stateOf, runFileOf,
  git, put, commitAll, head as stageHead, rowOf, run, endOf, scenario, conflictOnTest, mergeIntoSupport, resolveSupport, reviewResolution,
} from './test-fixtures.mjs';
import { hook, skillText, section, deliveredChange, check, next as loopNext, parsed, build, TDD, REPO_ROOT } from './change-loop-fixtures.mjs';
import { inFlight, sessionSkillMd } from './roadmap-loop-fixtures.mjs';
import * as CL from './change-loop.mjs';
import * as DC from './deliver-check.mjs';

const LANGS = ['en', 'pt-BR'];
const reply = (argv, lang = 'en') => CL.main(['reply', ...argv, '--lang', lang], { cwd: tmpFolder('devkit-declared-reply-'), env: cleanEnv });
const errorOf = (r) => JSON.parse(r.stdout).error;
const DECISION = 'the dependency upgrade';

// ---------------------------------------------------------------- AC-1: the two new owner waits (D-1)
// Invariant: `reply waiting-pause` and `reply waiting-owner-decision` print `devkit-end: <id> waiting-for-owner` first, then the
// reply in the person's language, exit 0; a key outside DECLARED prints no marker; a key DECLARED records goes through declare.
// Layer: the loop CLI (`main` of change-loop.mjs and roadmap-loop.mjs). Suite: change-loop-declared.

test('coordinator-loop-fixes AC-1 T1 reply waiting-pause prints the end line first, then the reply, in both languages', () => {
  for (const lang of LANGS) {
    const r = reply(['waiting-pause', '--param', 'id=feat'], lang);
    assert.equal(r.code, 0, `${lang}: ${r.stdout}`);
    const [first, ...rest] = r.stdout.split('\n');
    assert.equal(first, 'devkit-end: feat waiting-for-owner', lang);
    assert.equal(rest.join('\n'), `${CL.render(lang, 'waiting-pause', { id: 'feat' })}\n`, lang);
    assert.ok(rest[0].includes('feat'), `${lang}: ${rest[0]}`);
  }
  assert.notEqual(CL.render('en', 'waiting-pause', { id: 'feat' }), CL.render('pt-BR', 'waiting-pause', { id: 'feat' }));
});

test('coordinator-loop-fixes AC-1 T2 reply waiting-owner-decision carries the decision\'s words, and needs them', () => {
  for (const lang of LANGS) {
    const r = reply(['waiting-owner-decision', '--param', 'id=feat', '--param', `decision=${DECISION}`], lang);
    assert.equal(r.code, 0, `${lang}: ${r.stdout}`);
    const [first, ...rest] = r.stdout.split('\n');
    assert.equal(first, 'devkit-end: feat waiting-for-owner', lang);
    assert.ok(rest[0].includes(DECISION), `${lang}: ${rest[0]}`);
    assert.equal(rest.join('\n'), `${CL.render(lang, 'waiting-owner-decision', { id: 'feat', decision: DECISION })}\n`, lang);
    const without = reply(['waiting-owner-decision', '--param', 'id=feat'], lang);
    assert.equal(without.code, 3, `${lang} without the decision`);
    assert.match(errorOf(without), /\bdecision\b/, lang);
    assert.doesNotMatch(without.stdout, /devkit-end:/, `${lang}: no marker on a refusal`);
  }
});

test('coordinator-loop-fixes AC-1 T9 reply refuses the keys that declare records, naming declare, in both loops', () => {
  for (const key of ['gate-red', 'review-round']) {
    const r = reply([key, '--param', 'id=feat']);
    assert.equal(r.code, 3, `${key}: ${r.stdout}`);
    assert.match(errorOf(r), /\bdeclare\b/, key);
    assert.doesNotMatch(r.stdout, /devkit-end:/, key);
  }
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  putRun(root, { session: 'S1', places: 2, inflight: { a: inFlight() } });
  const raw = readFileSync(runFileOf(root), 'utf8');
  const roadmap = cmd(root, ['reply', 'gate-red', ...FLAGS, '--param', 'id=a', '--param', 'phase=1']);
  assert.equal(roadmap.code, 3, roadmap.stdout);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, 'nothing recorded');
});

test('coordinator-loop-fixes AC-1 T11 a key outside the declared table prints no marker', () => {
  const params = { id: 'feat', number: '12', url: 'https://example.test/pr/12' };
  const r = reply(['waiting-merge', ...Object.entries(params).flatMap(([k, v]) => ['--param', `${k}=${v}`])]);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.stdout, `${CL.render('en', 'waiting-merge', params)}\n`);
  assert.doesNotMatch(r.stdout, /devkit-end:/);
});

test('coordinator-loop-fixes AC-1 T114 RECORDED_KEYS of deliver-check.mjs are the declare rows of DECLARED', () => {
  const declareRows = Object.entries(CL.DECLARED ?? {}).filter(([, row]) => row.via === 'declare').map(([key]) => key);
  assert.ok(declareRows.length > 0, 'DECLARED has declare rows');
  assert.deepEqual([...(DC.RECORDED_KEYS ?? [])].sort(), [...declareRows].sort());
});

// ---------------------------------------------------------------- AC-1: the state a declared wait gives (D-1)
// Invariant: a declared `waiting-pause` or `waiting-owner-decision` is a wait for the owner at its gate, as every other wait.
// Layer: changeState, the one place a change's state is derived (ADR 0017). Suite: change-loop-declared.

test('coordinator-loop-fixes AC-1 T6 changeState reads a declared pause and a declared decision as waits for the owner, each at its gate', () => {
  assert.equal(CL.GATE_OF_WHY['waiting-pause'], 'pause');
  assert.equal(CL.GATE_OF_WHY['waiting-owner-decision'], 'decision');
  const facts = (why) => ({ sessionMode: false, started: false, inflight: null, declared: { state: 'waiting-for-owner', why, params: {} }, waits: false });
  for (const lang of LANGS) {
    for (const [why, gate] of [['waiting-pause', 'pause'], ['waiting-owner-decision', 'decision']]) {
      const s = CL.changeState(null, facts(why), { lang, id: 'feat' });
      assert.equal(s.state, 'waiting-for-owner', `${lang} ${why}`);
      assert.deepEqual(s.reason, { code: why, text: CL.render(lang, `gate.${gate}`) }, `${lang} ${why}`);
    }
  }
});

// ---------------------------------------------------------------- AC-1: the roadmap's record of a declared wait (D-1)
// Invariant: `roadmap-loop.mjs reply` records `run.declared[id]` with the end and gate of the key's DECLARED row.
// Layer: the loop CLI (`main` of roadmap-loop.mjs) and its run file. Suite: change-loop-declared.

const roadmapRun = () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  putRun(root, { session: 'S1', places: 2, inflight: { a: inFlight(), b: inFlight() } });
  return root;
};

test('coordinator-loop-fixes AC-1 T7 roadmap-loop reply waiting-pause records the wait at the gate of a pause', () => {
  const root = roadmapRun();
  const r = cmd(root, ['reply', 'waiting-pause', ...FLAGS, '--param', 'id=a']);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.stdout.split('\n')[0], 'devkit-end: a waiting-for-owner');
  assert.deepEqual(stateOf(root).declared.a, { state: 'waiting-for-owner', why: 'waiting-pause', params: { gate: 'pause' } });
  assert.equal(stateOf(root).inflight.a, undefined, 'a declared end clears the change');
});

test('coordinator-loop-fixes AC-1 T8 roadmap-loop reply waiting-owner-decision records the gate decision, and waiting-pr-decision keeps it', () => {
  const root = roadmapRun();
  const decision = cmd(root, ['reply', 'waiting-owner-decision', ...FLAGS, '--param', 'id=a', '--param', `decision=${DECISION}`]);
  assert.equal(decision.code, 0, decision.stdout);
  assert.equal(decision.stdout.split('\n')[0], 'devkit-end: a waiting-for-owner');
  assert.deepEqual(stateOf(root).declared.a, { state: 'waiting-for-owner', why: 'waiting-owner-decision', params: { decision: DECISION, gate: 'decision' } });
  const pr = cmd(root, ['reply', 'waiting-pr-decision', ...FLAGS, '--param', 'id=b', '--param', 'url=https://example.test/pr/1']);
  assert.equal(pr.code, 0, pr.stdout);
  assert.deepEqual(stateOf(root).declared.b, { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: { url: 'https://example.test/pr/1', gate: 'decision' } });
});

// ---------------------------------------------------------------- AC-1, AC-2: the stop hook after a declared end (D-1, D-2)
// Invariant: the stop lock lets a turn end at the first attempt after the session's own declared end of the run's change, and
// refuses it once (`stage-ready`) when the record holds no such end, or an end that names another change. Layer: `guard.mjs stop`
// on a transcript, a planner stage of `feat` ready. Suite: change-loop-declared.

const readyChange = () => planChange({ have: ['requirements', 'decisions'] });
const stopAfter = (root, lines, env = {}) => {
  const tmp = sandbox();
  const log = join(tmp, 'hook-log.jsonl');
  const r = hook('stop', stopInput(root, transcriptOf([typedLine('change add the feature'), runLine('feat'), ...lines])), { ...env, TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  let why = null;
  try { why = JSON.parse(readFileSync(log, 'utf8').trim().split('\n').at(-1)).why; } catch { why = null; }
  return { ...r, why };
};

test('coordinator-loop-fixes AC-1 T3 the stop is allowed after the session declared a pause', () => {
  const declared = reply(['waiting-pause', '--param', 'id=feat']);
  assert.equal(declared.code, 0, declared.stdout);
  const r = stopAfter(readyChange(), [toolResultLine(declared.stdout)]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.why, 'end-recorded');
});

test('coordinator-loop-fixes AC-1 T4 the stop is allowed after the session declared a decision outside the gates', () => {
  const declared = reply(['waiting-owner-decision', '--param', 'id=feat', '--param', `decision=${DECISION}`]);
  assert.equal(declared.code, 0, declared.stdout);
  const r = stopAfter(readyChange(), [toolResultLine(declared.stdout)]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.why, 'end-recorded');
});

test('coordinator-loop-fixes AC-1 T5 the same transcript without a declared end is refused, the stage ready', () => {
  const r = stopAfter(readyChange(), []);
  assert.equal(r.code, 2, r.err);
  assert.equal(r.why, 'stage-ready');
});

test('coordinator-loop-fixes AC-2 T22 an end line naming another change does not let the run of feat stop', () => {
  const r = stopAfter(readyChange(), [toolResultLine('devkit-end: other blocked\nThe change other stopped.')]);
  assert.equal(r.code, 2, r.err);
  assert.equal(r.why, 'stage-ready');
});

test('coordinator-loop-fixes AC-2 T23 an end line naming the run\'s change lets it stop', () => {
  const r = stopAfter(readyChange(), [toolResultLine('devkit-end: feat blocked\nThe change feat stopped.')]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.why, 'end-recorded');
});

// ---------------------------------------------------------------- AC-1: the skills' text (D-1, "The skill")
// Invariant: the devkit skill's Loop and its roadmap item 3 name the two new reply keys, the decision travels as `decision`,
// never `what`. Layer: the skills' text. Suite: change-loop-declared.

test('coordinator-loop-fixes AC-1 T12 the skills name reply waiting-pause and waiting-owner-decision, the decision never as what', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  for (const key of ['reply waiting-pause --param id=<id>', 'reply waiting-owner-decision --param id=<id> --param decision=']) {
    assert.ok(loop.includes(key), `the Loop names ${key}`);
  }
  const every = section(md, '### Every change in this session', '### The periodic check');
  const item3 = every.split('\n').find((l) => l.startsWith('3. '));
  assert.ok(item3, 'item 3 of Every change in this session');
  for (const key of ['roadmap-loop.mjs reply waiting-pause --param id=<id>', 'roadmap-loop.mjs reply waiting-owner-decision --param id=<id> --param decision=']) {
    assert.ok(item3.includes(key), `item 3 names ${key}`);
  }
  assert.ok(item3.includes('both flags'), 'item 3 asks for both flags');
  for (const [name, text] of [['devkit', md], ['devkit-session', sessionSkillMd()]]) {
    assert.doesNotMatch(text, /waiting-owner-decision[^\n]*--param what=/, `${name} passes no --param what= to waiting-owner-decision`);
  }
});

// ---------------------------------------------------------------- AC-1, AC-10: the declare command and one fix after a red gate (D-1, D-3)
// Invariant: `change-loop.mjs declare <id> gate-red --param phase=<n>` records the red gate only when the loop's next step is that
// phase's gate, then prints the action that follows: the implementer's `fix-gate` after the first red of the phase, the blocked end
// `tests-red` after a second; `next` never gives `fix-gate`. A key whose row is `reply`, or no row, is a usage error, and an
// unreadable record refuses with nothing written. Layer: the loop CLI (`main` of change-loop.mjs) on a delivered change in a
// worktree, and the stop hook on its output. Suite: change-loop-declared.

const declare = (cwd, env, key, params = [], lang = 'en') => CL.main(['declare', 'feat', key, '--lang', lang, ...params.flatMap((p) => ['--param', p])], { cwd, env });
const linesOf = (r) => r.stdout.split('\n');
const recordOf = (wt) => join(wt, 'openspec', 'changes', 'feat', 'declared.json');
const stepsOf = (wt) => JSON.parse(readFileSync(recordOf(wt), 'utf8')).steps;
const GATE_1 = ['## 1. First', '- [x] 1.1 code', '- [ ] 1.2 Gate: `true` green'];

// A delivered change (`deliveredChange`) whose tasks.md is `lines`, committed with its stage header at the code's commit.
function withTasks(lines) {
  const d = deliveredChange({ checks: [check('build', 'pass')] });
  const sha = git(d.wt, 'rev-parse', 'HEAD');
  put(d.wt, { 'openspec/changes/feat/tasks.md': `${stageHead('tasks', sha)}# Tasks\n\n${lines.join('\n')}\n` });
  commitAll(d.wt, 'tasks');
  return d;
}

test('coordinator-loop-fixes AC-1 T10 declare refuses a reply key and a key the table lacks, as usage errors', () => {
  const cwd = tmpFolder('devkit-declared-usage-');
  for (const key of ['waiting-pause', 'no-such-key']) {
    const r = CL.main(['declare', 'feat', key, '--lang', 'en', '--param', 'id=feat'], { cwd, env: cleanEnv });
    assert.equal(r.code, 3, `${key}: ${r.stdout}`);
    assert.ok(errorOf(r).startsWith(`${key} is not a step declare records`), errorOf(r));
    assert.doesNotMatch(r.stdout, /devkit-(run|end):/, key);
  }
});

test('coordinator-loop-fixes AC-1 T17 declare on an unreadable record exits 3 with declare-unreadable and leaves the file byte for byte', () => {
  const { wt, env } = withTasks(GATE_1);
  writeFileSync(recordOf(wt), '{"version": 1, "steps": [');
  const r = declare(wt, env, 'gate-red', ['phase=1']);
  assert.equal(r.code, 3, r.stdout);
  assert.equal(errorOf(r), 'declare-unreadable');
  assert.equal(JSON.parse(r.stdout).reply, CL.render('en', 'declare-unreadable', { id: 'feat', error: DC.readDeclared(join(wt, 'openspec', 'changes', 'feat')).error }));
  assert.equal(readFileSync(recordOf(wt), 'utf8'), '{"version": 1, "steps": [');
});

test('coordinator-loop-fixes AC-10 T25 the first red gate of a phase hands the implementer fix-gate and records one entry', () => {
  const { t, wt, env } = withTasks(GATE_1);
  const r = declare(t.main, env, 'gate-red', ['phase=1']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(linesOf(r)[0], 'devkit-run: feat');
  assert.doesNotMatch(r.stdout, /devkit-end:/);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.agent, action.step, action.stage], ['agent', TDD, 'fix-gate', 'implementation']);
  assert.deepEqual(action.detail, { phase: 1, task: '1.2', command: 'true' });
  assert.match(action.brief, /the gate of phase 1 is red: run its command, find the cause, fix it test first within the approved tasks, and leave the gate task unticked; the gate runs again after you/);
  const steps = stepsOf(wt);
  assert.equal(steps.length, 1);
  assert.deepEqual([steps[0].key, steps[0].phase, typeof steps[0].at], ['gate-red', 1, 'string']);
});

test('coordinator-loop-fixes AC-10 T26 a second red gate of the same phase ends the run blocked with tests-red', () => {
  const { t, wt, env } = withTasks(GATE_1);
  assert.equal(declare(t.main, env, 'gate-red', ['phase=1']).code, 0);
  const r = declare(t.main, env, 'gate-red', ['phase=1']);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.deepEqual(linesOf(r).slice(0, 2), ['devkit-run: feat', 'devkit-end: feat blocked']);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.end.state, action.end.why, action.params.phase], ['end', 'blocked', 'tests-red', 1]);
  assert.equal(stepsOf(wt).length, 2);
});

test('coordinator-loop-fixes AC-10 T27 with one red recorded, next at the gate still gives the gate, never fix-gate', () => {
  const { t, env } = withTasks(GATE_1);
  assert.equal(declare(t.main, env, 'gate-red', ['phase=1']).code, 0);
  const r = loopNext(t.main, [], env);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.step], ['session', 'gate']);
  assert.doesNotMatch(r.stdout, /fix-gate/);
});

test('coordinator-loop-fixes AC-10 T28 a red recorded for phase 1 leaves the first red of phase 2 its own fix', () => {
  const { t, wt, env } = withTasks(['## 1. First', '- [x] 1.1 code', '- [x] 1.2 Gate: `true` green', '', '## 2. Second', '- [x] 2.1 more', '- [ ] 2.2 Gate: `true && true` green']);
  writeFileSync(recordOf(wt), JSON.stringify({ version: 1, steps: [{ key: 'gate-red', phase: 1, at: '2026-11-24T10:00:00.000Z' }] }));
  const r = declare(t.main, env, 'gate-red', ['phase=2']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.step, action.detail], ['fix-gate', { phase: 2, task: '2.2', command: 'true && true' }]);
  assert.deepEqual(stepsOf(wt).map((x) => x.phase), [1, 2]);
});

test('coordinator-loop-fixes AC-10 T29 a red gate declared away from that phase\'s gate is refused and records nothing', () => {
  const atGate1 = withTasks(GATE_1);
  const r = declare(atGate1.t.main, atGate1.env, 'gate-red', ['phase=2']);
  assert.equal(r.code, 3, r.stdout);
  assert.equal(errorOf(r), 'declare-not-at-gate');
  assert.equal(JSON.parse(r.stdout).reply, CL.render('en', 'declare-not-at-gate', { id: 'feat', phase: '2' }));
  assert.equal(existsSync(recordOf(atGate1.wt)), false);
  const atImplement = withTasks(['## 1. First', '- [ ] 1.1 code', '- [ ] 1.2 Gate: `true` green']);
  assert.equal(parsed(loopNext(atImplement.t.main, [], atImplement.env)).action.step, 'implement');
  const away = declare(atImplement.t.main, atImplement.env, 'gate-red', ['phase=1']);
  assert.equal(away.code, 3, away.stdout);
  assert.equal(errorOf(away), 'declare-not-at-gate');
  assert.equal(existsSync(recordOf(atImplement.wt)), false);
});

test('coordinator-loop-fixes AC-10 T30 the stop is refused after a first red with the fix not handed, and allowed after a second', () => {
  const { t, env } = withTasks(GATE_1);
  const first = declare(t.main, env, 'gate-red', ['phase=1']);
  assert.equal(first.code, 0, first.stdout);
  const refused = stopAfter(t.main, [toolResultLine(first.stdout)], env);
  assert.equal(refused.code, 2, refused.err);
  const second = declare(t.main, env, 'gate-red', ['phase=1']);
  assert.equal(second.code, 2, second.stdout);
  const allowed = stopAfter(t.main, [toolResultLine(first.stdout), toolResultLine(second.stdout)], env);
  assert.equal(allowed.code, 0, allowed.err);
  assert.equal(allowed.why, 'end-recorded');
});

test('coordinator-loop-fixes AC-10 T31 the skill\'s gate item and the roadmap item 3 name declare gate-red and the exit-3 fallback', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  const gate = loop.split('\n').find((l) => l.startsWith('- `gate`'));
  assert.ok(gate, 'a gate item');
  assert.ok(gate.includes('change-loop.mjs declare <id> gate-red --param phase=<n>'), gate);
  assert.ok(gate.includes('reply blocked --param id=<id> --param why=tests-red --param phase=<n>'), 'the exit-3 fallback');
  assert.match(gate, /exit 3/);
  assert.match(gate, /Declare once per red run of the gate/);
  const item3 = section(md, '### Every change in this session', '### The periodic check').split('\n').find((l) => l.startsWith('3. '));
  assert.ok(item3.includes('change-loop.mjs declare <id> gate-red --param phase=<n>'), item3);
  assert.ok(item3.includes('roadmap-loop.mjs reply blocked --param id=<id> --param why=tests-red --param phase=<n>'), item3);
});

// ---------------------------------------------------------------- AC-7: one more review round on the owner's word (D-4)
// Invariant: at the code review's deadlock (the blocked `ceiling` end of the `review` stage) or the resolution review's (the
// `waiting-review-dispute` end with `detail.resolution`), `declare review-round --param words=...` records one round of that
// review's scope and prints the action that follows, which then runs exactly one more round; away from a deadlock, or without the
// owner's words, it refuses and records nothing. Layer: the loop CLI on a delivered change in a worktree, `decide`, and
// `deadlockScope`. Suite: change-loop-declared.

const WORDS = 'one more round';
// A delivered change whose code review failed at rounds 1 and 2, `code-quality-reviewer` rejecting at the head the reviews were
// written on (only the review record is committed after it, so the rejection stays current): the `review` stage's header
// `result=failed attempt=2`, committed after a `result=failed attempt=1` take.
function deadlocked() {
  const d = deliveredChange({ checks: [check('build', 'pass')] });
  const sha = git(d.wt, 'rev-parse', 'HEAD');
  const rejected = (at) => `Verdict: rejected\nCommit: ${at}\n\n# Review\n\n### Findings\n- [blocking] F1 src/feat.ts:1 a thing is wrong\n`;
  put(d.wt, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': rejected(sha),
    'openspec/changes/feat/review.md': `${stageHead('review', sha, 'failed', 1)}Consensus: FAIL (round 1/2)\n`,
  });
  commitAll(d.wt, 'review round 1');
  put(d.wt, { 'openspec/changes/feat/review.md': `${stageHead('review', sha, 'failed', 2)}Consensus: FAIL (round 1/2)\n\nConsensus: FAIL (round 2/2)\n` });
  commitAll(d.wt, 'review round 2');
  return { ...d, sha, rejected };
}
const isCeilingOfReview = (action) => action.kind === 'end' && action.end.state === 'blocked' && action.end.why === 'ceiling' && action.stage === 'review';

test('coordinator-loop-fixes AC-7 T38 at the code review\'s deadlock declare review-round records round 3 and hands fix-review', () => {
  const { t, wt, env } = deadlocked();
  assert.ok(isCeilingOfReview(parsed(loopNext(t.main, [], env)).action), 'the deadlock first');
  const r = declare(t.main, env, 'review-round', [`words=${WORDS}`]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(linesOf(r)[0], 'devkit-run: feat');
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.step, action.agent], ['agent', 'fix-review', TDD]);
  assert.deepEqual(action.declared, { key: 'review-round', reply: CL.render('en', 'review-round-authorized', { id: 'feat', round: 3 }) });
  const steps = stepsOf(wt);
  assert.equal(steps.length, 1);
  assert.deepEqual([steps[0].key, steps[0].scope, steps[0].round, steps[0].words], ['review-round', 'review', 3, WORDS]);
});

test('coordinator-loop-fixes AC-7 T39 without the owner\'s words declare review-round records nothing and the deadlock stays', () => {
  const { t, wt, env } = deadlocked();
  for (const params of [[], ['words=']]) {
    const r = declare(t.main, env, 'review-round', params);
    assert.equal(r.code, 3, r.stdout);
    assert.equal(errorOf(r), 'declare-no-words');
    assert.equal(JSON.parse(r.stdout).reply, CL.render('en', 'declare-no-words', { id: 'feat' }));
  }
  assert.equal(existsSync(recordOf(wt)), false);
  assert.ok(isCeilingOfReview(parsed(loopNext(t.main, [], env)).action));
});

test('coordinator-loop-fixes AC-7 T40 away from a deadlock, and a second call right after the first, declare review-round is refused', () => {
  const away = withTasks(['## 1. First', '- [ ] 1.1 code']);
  const r = declare(away.t.main, away.env, 'review-round', [`words=${WORDS}`]);
  assert.equal(r.code, 3, r.stdout);
  assert.equal(errorOf(r), 'declare-not-at-deadlock');
  assert.equal(JSON.parse(r.stdout).reply, CL.render('en', 'declare-not-at-deadlock', { id: 'feat' }));
  assert.equal(existsSync(recordOf(away.wt)), false);
  const { t, wt, env } = deadlocked();
  assert.equal(declare(t.main, env, 'review-round', [`words=${WORDS}`]).code, 0);
  const before = readFileSync(recordOf(wt), 'utf8');
  const again = declare(t.main, env, 'review-round', [`words=${WORDS}`]);
  assert.equal(again.code, 3, again.stdout);
  assert.equal(errorOf(again), 'declare-not-at-deadlock');
  assert.equal(readFileSync(recordOf(wt), 'utf8'), before);
});

test('coordinator-loop-fixes AC-7 T111 one authorized round runs a round 3 through the loop, and its failure is the deadlock again', () => {
  const { t, wt, env, rejected } = deadlocked();
  const stuck = loopNext(t.main, [], env);
  assert.equal(stuck.code, 2, stuck.stdout);
  assert.ok(isCeilingOfReview(parsed(stuck).action));
  assert.equal(parsed(declare(t.main, env, 'review-round', [`words=${WORDS}`])).action.step, 'fix-review', 'the record is no plan fix');
  put(wt, { 'src/feat.ts': 'fixed\n' });
  git(wt, 'commit', '-q', '-m', 'fix', '--', 'src/feat.ts');
  const fix = git(wt, 'rev-parse', 'HEAD');
  put(wt, { 'openspec/changes/feat/evidence.md': `${stageHead('evidence', fix)}Commit: ${fix}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n` });
  const commit = parsed(loopNext(t.main, [], env)).action;
  assert.deepEqual([commit.kind, commit.step], ['agent', 'commit'], JSON.stringify(commit));
  commitAll(wt, 'the record and the evidence');
  const review = parsed(loopNext(t.main, [], env)).action;
  assert.deepEqual([review.kind, review.step, review.detail.round, review.detail.limit], ['session', 'review', 3, 3]);
  const at = git(wt, 'rev-parse', 'HEAD');
  put(wt, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': rejected(at),
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': `Verdict: approved\nCommit: ${at}\n\n# Review\n`,
    'openspec/changes/feat/review.md': `${stageHead('review', at, 'failed', 3)}Consensus: FAIL (round 2/2)\n\nConsensus: FAIL (round 3/3)\n`,
  });
  commitAll(wt, 'review round 3');
  const again = loopNext(t.main, [], env);
  assert.equal(again.code, 2, again.stdout);
  const end = parsed(again).action;
  assert.ok(isCeilingOfReview(end), JSON.stringify(end));
  assert.equal(end.params.attempt, 3);
});

test('coordinator-loop-fixes AC-7 T112 deadlockScope names the review the owner\'s word answers, and nothing else', () => {
  const dispute = (extra) => build(rowOf('stop-review-deadlock', { reviewers: ['code-quality-reviewer'], ...extra }));
  assert.equal(CL.deadlockScope(dispute({ resolution: true })), 'resolution');
  assert.equal(CL.deadlockScope(dispute()), 'review');
  const ceiling = (stage, flow) => run({ ...(flow ? { flow } : {}), rep: { end: endOf('blocked', stage, 'ceiling-reached', { stage, attempt: 2, failures: 2, ceiling: 2 }) } });
  const codeReview = ceiling('review');
  assert.deepEqual([codeReview.end.why, codeReview.role], ['ceiling', 'review-bench']);
  assert.equal(CL.deadlockScope(codeReview), 'review');
  const project = JSON.parse(readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'schemas', 'devkit-project', 'flow.json'), 'utf8'));
  const adr = ceiling('review', project);
  assert.equal(adr.role, 'adr-reviewer');
  for (const [what, action] of [
    ['the readiness at its ceiling', ceiling('readiness')], ['the evidence at its ceiling', ceiling('evidence')], ['an ADR review at its ceiling', adr],
    ['a review with no progress', run({ rep: { end: endOf('blocked', 'review', 'no-progress', { stage: 'review' }) } })],
    ['an agent step', build(rowOf('implement', { phase: 1 }))],
  ]) assert.equal(CL.deadlockScope(action), null, what);
});

test('coordinator-loop-fixes AC-7 T95 decide on a resolution deadlock carries detail.resolution; the code review\'s carries no detail', () => {
  const res = build(rowOf('stop-review-deadlock', { reviewers: ['code-quality-reviewer'], resolution: true }));
  assert.deepEqual([res.kind, res.end.state, res.end.why, res.detail], ['end', 'waiting-for-owner', 'waiting-review-dispute', { resolution: true }]);
  const code = build(rowOf('stop-review-deadlock', { reviewers: ['code-quality-reviewer'] }));
  assert.equal(code.end.why, 'waiting-review-dispute');
  assert.equal(Object.hasOwn(code, 'detail'), false);
});

// A two-prs change (`scenario`) whose stage files all passed at its code commit, both pull requests open, the test branch in conflict
// and the resolution on the support branch still rejected after round 2: the loop's next action is the resolution's deadlock.
function resolutionDeadlock() {
  const s = scenario();
  const code = git(s.wt, 'rev-parse', 'HEAD~1');
  const dir = 'openspec/changes/feat/';
  put(s.wt, {
    [`${dir}requirements.md`]: `${stageHead('requirements', code)}# Requirements\n`,
    [`${dir}specs/s/spec.md`]: `${stageHead('specs', code)}# Spec\n`,
    [`${dir}tasks.md`]: `${stageHead('tasks', code)}# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n`,
    [`${dir}evidence.md`]: `${stageHead('evidence', code)}${readFileSync(join(s.wt, dir, 'evidence.md'), 'utf8')}`,
    [`${dir}review.md`]: `${stageHead('review', code)}Consensus: PASS (round 1/2)\n`,
  });
  commitAll(s.wt, 'stage headers');
  git(s.wt, 'push', '-q', 'origin', 'feat');
  s.openBoth();
  conflictOnTest(s);
  mergeIntoSupport(s, s.next());
  const resolved = resolveSupport(s.next());
  reviewResolution(s, resolved, {
    verdict: { 'code-quality-reviewer': 'rejected' }, findings: { 'code-quality-reviewer': '- [blocking] F1 src/a.ts:1 a line of the task branch was lost\n' }, consensus: 'FAIL (round 2/2)',
  });
  return s;
}

test('coordinator-loop-fixes AC-7 T96 declare review-round answers the deadlock in front of the owner: the resolution\'s, or the code review\'s', () => {
  const s = resolutionDeadlock();
  const stuck = parsed(loopNext(s.wt, [], s.env)).action;
  assert.deepEqual([stuck.kind, stuck.end?.why, stuck.detail], ['end', 'waiting-review-dispute', { resolution: true }], JSON.stringify(stuck));
  const r = declare(s.wt, s.env, 'review-round', [`words=${WORDS}`]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(parsed(r).action.step, 'fix-resolution');
  const steps = stepsOf(s.wt);
  assert.deepEqual(steps.map((x) => [x.key, x.scope, x.round]), [['review-round', 'resolution', 3]]);
  assert.equal(parsed(loopNext(s.wt, [], s.env)).action.step, 'fix-resolution');
  const code = deadlocked();
  assert.equal(declare(code.t.main, code.env, 'review-round', [`words=${WORDS}`]).code, 0);
  assert.deepEqual(stepsOf(code.wt).map((x) => [x.scope, x.round]), [['review', 3]]);
});

test('coordinator-loop-fixes AC-7 T97 collectState on a two-prs change: the resolution\'s limit counts only its own authorized rounds', () => {
  const s = scenario();
  s.openBoth();
  const write = (scope) => writeFileSync(recordOf(s.wt), JSON.stringify({ version: 1, steps: [{ key: 'review-round', scope, round: 3, words: WORDS, at: '2026-11-24T10:00:00.000Z' }] }));
  assert.equal(s.state().twoPrs.resolution.limit, 2, 'no record');
  write('resolution');
  assert.equal(s.state().twoPrs.resolution.limit, 3, 'one resolution entry');
  write('review');
  assert.equal(s.state().twoPrs.resolution.limit, 2, 'only a review entry');
});

test('coordinator-loop-fixes AC-7 T44 the skills name declare review-round from the owner\'s own typed message, and pass the limit', () => {
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8').split('\n');
  const row = (step) => ship.find((l) => l.startsWith(`| \`${step}\` |`));
  const deadlock = row('stop-review-deadlock');
  assert.ok(deadlock.includes('change-loop.mjs declare <id> review-round --param words="<their words>"'), deadlock);
  assert.ok(deadlock.includes("the owner's own typed message"), deadlock);
  assert.ok(deadlock.includes('`declared.reply`'), deadlock);
  assert.ok(deadlock.includes('after its last round (2 unless the owner authorized more)'), deadlock);
  for (const step of ['review', 'review-resolution']) assert.ok(row(step).includes('`next.limit`'), `${step} passes next.limit`);
  const gates = section(skillText(), '## Owner gates', '## Waiting on GitHub');
  assert.ok(gates.includes('declare <id> review-round'), 'the Owner gates name the declare');
  assert.ok(gates.includes("the owner's own typed message"), 'the Owner gates name the owner\'s own typed message');
  assert.ok(gates.includes('A `blocked` end whose `end.why` is `ceiling` and whose `stage` is `review` is the code review\'s deadlock'), gates);
  const review = readFileSync(join(REPO_ROOT, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'), 'utf8');
  const args = review.split('\n').find((l) => l.startsWith('Build `args` first'));
  assert.match(args, /\blimit\b/, 'review-change\'s args name limit');
  assert.match(review, /Consensus: PASS \| FAIL \(round N\/<limit>\)/);
});

// ---------------------------------------------------------------- AC-13: a conflict outside the release files (D-5)
// Invariant: the `resolve-base-conflict` row is a hand-off to the implementer at the implementation stage, dispatched with the
// `ship-change` row of that name, whose `Outcome: failure` goes back to `next` like any agent's. Layer: `decide` and the skills'
// text. Suite: change-loop-declared.

test('coordinator-loop-fixes AC-13 T49 decide on a resolve-base-conflict row hands the implementer at the implementation stage', () => {
  const a = build(rowOf('resolve-base-conflict', { number: 12, paths: ['CHANGELOG.md', 'README.md'], others: ['README.md'], base: 'main', archive: false }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', TDD, 'resolve-base-conflict', 'implementation', 'tdd-implementer']);
  assert.deepEqual(a.detail.others, ['README.md']);
});

test('coordinator-loop-fixes AC-13 T50 the ship-change row holds the merge sentence; the devkit item names that row and declares no end', () => {
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8').split('\n');
  const row = ship.find((l) => l.startsWith('| `resolve-base-conflict` |'));
  assert.ok(row, 'a ship-change row');
  assert.ok(row.includes('Dispatch `devkit-core:tdd-implementer`: Merge `origin/<next.base>` into the branch, never rebase'), row);
  assert.ok(row.includes('`next.paths`'), row);
  assert.ok(row.includes('`resolve-release-conflict`'), row);
  assert.match(row, /never push/);
  const loop = section(skillText(), '## Loop', '## Owner gates');
  const item = loop.split('\n').find((l) => l.startsWith('- `resolve-base-conflict`'));
  assert.ok(item, 'a devkit Loop item');
  assert.ok(item.includes('the dispatch sentence of the `ship-change` row of that name'), item);
  assert.ok(item.includes('`Outcome: failure` goes back to `next`, as for any agent.'), item);
  assert.ok(!item.includes('role-failed'), item);
});
