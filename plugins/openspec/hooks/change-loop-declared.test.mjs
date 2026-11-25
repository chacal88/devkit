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
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpFolder } from './test-tmp.mjs';
import {
  planChange, transcriptOf, typedLine, runLine, toolResultLine, stopInput, sandbox, cleanEnvLoop as cleanEnv,
  cmd, FLAGS, projectWith, roadmapText, putRun, stateOf, runFileOf,
  git, put, commitAll, head as stageHead, rowOf, run, endOf, scenario, conflictOnTest, mergeIntoSupport, resolveSupport, reviewResolution,
  gitRepo, fakeGh, tasksText, roundRepo, jsonOf,
} from './test-fixtures.mjs';
import { hook, skillText, section, deliveredChange, check, next as loopNext, parsed, build, TDD, COMMIT, REPO_ROOT, prJson } from './change-loop-fixtures.mjs';
import { inFlight, sessionSkillMd } from './roadmap-loop-fixtures.mjs';
import * as CL from './change-loop.mjs';
import * as DC from './deliver-check.mjs';
import * as GUARD from './guard.mjs';

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
// `waiting-review-dispute` end with `detail.resolution`), `declare review-round` with the owner's words (`--stdin words` or `--param words`) records one round of that
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

// The owner's words reach the record through standard input, so no character of them reaches the shell (review round 1,
// code-quality F1; the `--stdin` of reply, jira-entry-followups D-5). `--param words` stays for a caller with no shell between.
const SHELL_WORDS = 'yes, one more: `touch y` and $(touch x), the owner\'s "last" round';
const declareStdin = (cwd, env, stdin, extra = []) => CL.main(['declare', 'feat', 'review-round', '--lang', 'en', ...extra, '--stdin', 'words'], { cwd, env, stdin });

test('coordinator-loop-fixes AC-7 T143 declare review-round --stdin words records the owner\'s words byte for byte, as --param words does', () => {
  const viaStdin = deadlocked();
  const r = declareStdin(viaStdin.t.main, viaStdin.env, `${SHELL_WORDS}\n`);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(parsed(r).action.step, 'fix-review');
  assert.equal(stepsOf(viaStdin.wt)[0].words, SHELL_WORDS, 'one final line break removed, every other byte kept');
  const viaParam = deadlocked();
  assert.equal(declare(viaParam.t.main, viaParam.env, 'review-round', [`words=${SHELL_WORDS}`]).code, 0);
  assert.equal(stepsOf(viaParam.wt)[0].words, SHELL_WORDS, '--param words still records the words');
});

test('coordinator-loop-fixes AC-7 T144 a spawned declare review-round --stdin words reads the words from a quoted heredoc', () => {
  const { t, wt, env } = deadlocked();
  const script = `node '${join(REPO_ROOT, 'plugins', 'openspec', 'hooks', 'change-loop.mjs')}' declare feat review-round --stdin words --lang en <<'DEVKIT_ARGS'\n${SHELL_WORDS}\nDEVKIT_ARGS\n`;
  const r = spawnSync('bash', ['-c', script], { cwd: t.main, encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(linesOf({ stdout: r.stdout })[0], 'devkit-run: feat');
  assert.equal(stepsOf(wt)[0].words, SHELL_WORDS);
  for (const f of ['x', 'y']) assert.equal(existsSync(join(t.main, f)), false, `no command of the words ran: no file ${f} in the shell's folder`);
});

test('coordinator-loop-fixes AC-7 T145 declare --stdin refuses another name, the words named twice and an empty input, recording nothing', () => {
  const { t, wt, env } = deadlocked();
  const cases = [
    { name: 'another name', extra: [], stdin: 'text', args: ['declare', 'feat', 'review-round', '--lang', 'en', '--stdin', 'decision'], message: 'declare --stdin reads only words' },
    { name: 'a bad name', extra: [], stdin: 'text', args: ['declare', 'feat', 'review-round', '--lang', 'en', '--stdin', 'Words'], message: '--stdin needs a parameter name of letters, starting with a lower-case one' },
    { name: 'the words twice', extra: ['--param', 'words=x'], stdin: 'text', message: '--param words and --stdin words name the same parameter' },
    { name: 'an empty input', extra: [], stdin: '\n', message: 'declare --stdin words needs the text on standard input' },
  ];
  for (const c of cases) {
    const r = c.args ? CL.main(c.args, { cwd: t.main, env, stdin: c.stdin }) : declareStdin(t.main, env, c.stdin, c.extra);
    assert.equal(r.code, 3, `${c.name}: ${r.stdout}`);
    assert.ok(r.stderr.includes(c.message), `${c.name}: ${r.stderr}`);
    assert.doesNotMatch(r.stdout, /devkit-(run|end):/, c.name);
  }
  assert.equal(existsSync(recordOf(wt)), false, 'nothing recorded');
  assert.ok(isCeilingOfReview(parsed(loopNext(t.main, [], env)).action), 'the deadlock stays');
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
  // D-1 (plan revision of 2026-11-24): the uncommitted record is a change-folder file the pull request lacks, so the
  // delivery checker's item 5 gives `push` first; the push is the resolution path's commit of the owner's words.
  const pushed = parsed(r).action;
  assert.equal(pushed.step, 'push', JSON.stringify(pushed));
  assert.match(pushed.brief, /uncommitted files in the change folder: [^"]*openspec\/changes\/feat\/declared\.json/, 'the push names the record');
  const steps = stepsOf(s.wt);
  assert.deepEqual(steps.map((x) => [x.key, x.scope, x.round]), [['review-round', 'resolution', 3]]);
  assert.equal(parsed(loopNext(s.wt, [], s.env)).action.step, 'push', 'push while the record is uncommitted');
  git(s.wt, 'add', 'openspec/changes/feat/declared.json');
  git(s.wt, 'commit', '-q', '-m', 'the owner\'s words', '--', 'openspec/changes/feat/declared.json');
  git(s.wt, 'push', '-q', 'origin', 'feat');
  assert.equal(parsed(loopNext(s.wt, [], s.env)).action.step, 'fix-resolution', 'fix-resolution once the record is committed and pushed');
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
  assert.ok(deadlock.includes("change-loop.mjs declare <id> review-round --stdin words` with their words on standard input, through the quoted heredoc `<<'DEVKIT_ARGS'` and its terminator rule"), deadlock);
  assert.doesNotMatch(deadlock, /--param words/, 'the words never go on the command line');
  assert.ok(deadlock.includes("the owner's own typed message"), deadlock);
  assert.ok(deadlock.includes('`declared.reply`'), deadlock);
  assert.ok(deadlock.includes('after its last round (2 unless the owner authorized more)'), deadlock);
  for (const step of ['review', 'review-resolution']) assert.ok(row(step).includes('`next.limit`'), `${step} passes next.limit`);
  const gates = section(skillText(), '## Owner gates', '## Waiting on GitHub');
  assert.ok(gates.includes("hooks/change-loop.mjs declare <id> review-round --stdin words --lang ${user_config.language} <<'DEVKIT_ARGS'` with their words as the heredoc body, through its terminator rule"), 'the Owner gates pass the words through the quoted heredoc');
  assert.doesNotMatch(gates, /--param words/, 'the words never go on the command line');
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

// ---------------------------------------------------------------- AC-8: a plan revised after the start (D-7)
// Invariant: once a task is ticked, an approval that records the plan's digest sends a revised plan back to the readiness reviewer
// ("out of date"), then asks the owner again with the readiness hash and the plan digest, in the Claude and the CompozyOS driver
// alike; the CompozyOS driver writes the digest of the plan files it approves. A merge-defect fix of a spec delta is such a revision,
// read before the merge check. Layer: the loop CLI (`next`, `next --view compozy`, `record-approval`), `approvalText`, and the skills'
// text. Suite: change-loop-declared.

const PLAN_STAGES = ['requirements', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness'];
const READINESS = 'devkit-core:plan-readiness-reviewer';
// A `devkit` change in `pr` mode on its branch `feat`, its plan passed, task 1.1 of three ticked, and approval.md recording the
// readiness hash and, unless `plan` is false, the plan's digest; committed, with a fake gh that knows no pull request.
function revisedPlan({ plan = true } = {}) {
  const root = planChange({ have: PLAN_STAGES });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const dir = join(root, 'openspec', 'changes', 'feat');
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, {
    'openspec/config.yaml': 'schema: devkit\nship:\n  devkit: pr\n',
    'openspec/changes/feat/tasks.md': `${stageHead('tasks', c0)}# Tasks\n\n## 1. First\n- [x] 1.1 a\n- [ ] 1.2 b\n- [ ] 1.3 c\n`,
  });
  const digest = plan ? `- Plan: ${DC.planDigest?.(dir)}\n` : '';
  put(root, { 'openspec/changes/feat/approval.md': `${stageHead('approval', c0)}# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${DC.approvalState(dir).readiness}\n${digest}- Date: 2026-11-24\n- Owner's words: "\`go\`"\n` });
  commitAll(root, 'the plan approved, one task ticked');
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "feat"\n' });
  gh.set('pr-list', { stdout: [] });
  return { root, dir, c0, gh, env: { ...cleanEnv, PATH: gh.env.PATH, FAKE_GH_DIR: gh.env.FAKE_GH_DIR } };
}
const reviseDesign = ({ root, c0 }) => { put(root, { 'openspec/changes/feat/design.md': `${stageHead('design', c0)}# design\n\nRevised after the start.\n` }); commitAll(root, 'a plan revision'); };
const reviewAgain = ({ root, c0 }) => { put(root, { 'openspec/changes/feat/readiness.md': `${stageHead('readiness', c0, 'passed', 2)}# Readiness\n\n- Status: APPROVED\n\nThe revised design, reviewed.\n` }); commitAll(root, 'the readiness review again'); };
const compozyView = (cwd, env) => CL.main(['next', '--change', 'feat', '--lang', 'en', '--view', 'compozy'], { cwd, env });

test('coordinator-loop-fixes AC-8 T60 loop: the revised plan hands the readiness reviewer "out of date"; after its rewrite, the owner is asked again with the readiness and the plan', () => {
  const p = revisedPlan();
  const before = parsed(loopNext(p.root, [], p.env)).action;
  assert.deepEqual([before.kind, before.agent, before.step], ['agent', TDD, 'implement'], 'the approved plan goes on');
  reviseDesign(p);
  const revised = parsed(loopNext(p.root, [], p.env)).action;
  assert.deepEqual([revised.kind, revised.agent, revised.stage], ['agent', READINESS, 'readiness']);
  assert.match(revised.brief, /readiness is out of date: bring it up to date/);
  reviewAgain(p);
  const again = parsed(loopNext(p.root, [], p.env)).action;
  assert.deepEqual([again.kind, again.end?.state, again.end?.why], ['end', 'waiting-for-owner', 'waiting-approval-again']);
  assert.equal(again.detail.readiness, DC.approvalState(p.dir).readiness);
  assert.match(String(again.detail.plan), /^sha256:[0-9a-f]{12}$/);
  assert.equal(again.detail.plan, DC.planDigest(p.dir));
});

test('coordinator-loop-fixes AC-8 T61 ship-change\'s stop-plan-approval row writes - Plan: <next.plan>; the devkit skill names ask.action.detail.plan', () => {
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const row = ship.split('\n').find((l) => l.startsWith('| `stop-plan-approval` |'));
  assert.ok(row, 'the stop-plan-approval row');
  assert.ok(row.includes('`- Readiness: <next.readiness>`, `- Plan: <next.plan>` (omitted when `next.plan` is null), `- Date: <YYYY-MM-DD>`'), row);
  assert.ok(ship.includes('A change whose tasks are already ticked is resumed without it, unless its approval records a plan the plan files no longer match.'));
  const perChange = section(skillText(), '### A session per change', '### Every change in this session');
  assert.ok(perChange.includes('`ask.action.detail.readiness`, `ask.action.detail.plan`'), 'A session per change names the plan digest beside the readiness hash');
});

test('coordinator-loop-fixes AC-8 T115 approvalText writes the plan line right after the readiness line; record-approval writes the digest of the plan it approves', () => {
  const fields = { id: 'feat', attempt: 2, commit: 'a'.repeat(40), readiness: 'sha256:111111111111', date: '2026-11-24', words: 'go' };
  const today = `<!-- devkit-stage approval result=passed attempt=2 commit=${'a'.repeat(40)} -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: sha256:111111111111\n- Date: 2026-11-24\n- Owner's words: "\`go\`"\n`;
  assert.equal(CL.approvalText(fields), today, 'no plan: today\'s text byte for byte');
  assert.equal(CL.approvalText({ ...fields, plan: null }), today);
  assert.equal(CL.approvalText({ ...fields, plan: 'sha256:222222222222' }), today.replace('- Readiness: sha256:111111111111\n', '- Readiness: sha256:111111111111\n- Plan: sha256:222222222222\n'));
  const p = revisedPlan();
  reviseDesign(p);
  reviewAgain(p);
  assert.equal(JSON.parse(compozyView(p.root, p.env).stdout).kind, 'approval');
  const r = CL.main(['record-approval', '--change', 'feat', '--words', 'go', '--lang', 'en'], { cwd: p.root, env: p.env });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const text = readFileSync(join(p.dir, 'approval.md'), 'utf8');
  assert.ok(text.includes(`- Readiness: ${DC.approvalState(p.dir).readiness}\n- Plan: ${DC.planDigest(p.dir)}\n`), text);
  assert.equal(DC.planRevision(p.dir).changed, false);
});

test('coordinator-loop-fixes AC-8 T116 the CompozyOS view of a revised plan: the readiness reviewer, then the approval; a tick alone gives the implementation', () => {
  const p = revisedPlan();
  reviseDesign(p);
  const first = JSON.parse(compozyView(p.root, p.env).stdout);
  assert.deepEqual([first.kind, first.stage], ['agent', 'readiness']);
  assert.match(first.brief, /readiness is out of date/);
  reviewAgain(p);
  assert.equal(JSON.parse(compozyView(p.root, p.env).stdout).kind, 'approval');
  const ticked = revisedPlan();
  const tasks = join(ticked.dir, 'tasks.md');
  writeFileSync(tasks, readFileSync(tasks, 'utf8').replace('- [ ] 1.2', '- [x] 1.2'));
  commitAll(ticked.root, 'a tick');
  const third = JSON.parse(compozyView(ticked.root, ticked.env).stdout);
  assert.deepEqual([third.kind, third.stage], ['agent', 'implementation']);
});

// A `devkit` change delivered up to its open pull request (`deliveredChange` with its script switched to `devkit` and the plan
// stages added), its approval recording the plan's digest unless `plan` is false, then a merge of origin/main into its branch.
function mergedDevkitChange({ plan = true } = {}) {
  const d = deliveredChange({ checks: [check('build', 'pending')] });
  const sha = git(d.wt, 'rev-parse', 'HEAD');
  const dir = join(d.wt, 'openspec', 'changes', 'feat');
  put(d.wt, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/feat/decisions.md': `${stageHead('decisions', sha)}# Decisions\n`,
    'openspec/changes/feat/design.md': `${stageHead('design', sha)}# Design\n`,
    'openspec/changes/feat/readiness.md': `${stageHead('readiness', sha)}# Readiness\n\n- Status: APPROVED\n`,
  });
  const digest = plan ? `- Plan: ${DC.planDigest?.(dir)}\n` : '';
  put(d.wt, { 'openspec/changes/feat/approval.md': `${stageHead('approval', sha)}# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${DC.approvalState(dir).readiness}\n${digest}- Date: 2026-11-24\n` });
  commitAll(d.wt, 'the devkit plan files');
  // The base moves on in openspec/ alone (a file outside it would make the evidence stale, which this test is not about).
  const file = 'openspec/specs/other/spec.md';
  put(d.t.main, { [file]: '# Other\n' });
  git(d.t.main, 'add', '--', file);
  git(d.t.main, 'commit', '-q', '-m', 'main moves on', '--', file);
  git(d.t.main, 'push', '-q', 'origin', 'main');
  git(d.wt, 'merge', '-q', '--no-ff', '--no-edit', 'origin/main');
  const reheaded = () => d.gh.set('pr-view', { stdout: prJson('feat', { headRefOid: git(d.wt, 'rev-parse', 'HEAD') }) });
  reheaded();
  // The check of the plan after that merge, red at the current files (a fake CLI that reports one issue).
  const red = () => ({ status: 1, stdout: JSON.stringify({ items: [{ id: 'feat', valid: false, issues: [{ level: 'ERROR', path: 'specs/s/spec.md', message: 'a scenario the base added is missing' }] }] }), stderr: '' });
  assert.equal(CL.mergeCheck(d.wt, 'feat', { env: d.env, openspec: red }).result, 'red');
  const spec = join(dir, 'specs', 's', 'spec.md');
  writeFileSync(spec, `${readFileSync(spec, 'utf8')}\n### Requirement: copied from the base\n`);
  commitAll(d.wt, 'the merge-defect fix of the spec delta');
  reheaded();
  return d;
}

test('coordinator-loop-fixes AC-8 T134 a merge-defect fix of the spec delta goes to the readiness reviewer when the approval records the plan, else to the merge check', () => {
  const withPlan = mergedDevkitChange();
  const revised = parsed(loopNext(withPlan.t.main, [], withPlan.env)).action;
  assert.deepEqual([revised.kind, revised.agent, revised.stage], ['agent', READINESS, 'readiness'], JSON.stringify(revised));
  assert.match(revised.brief, /readiness is out of date/);
  assert.notEqual(revised.step, 'merge-check');
  assert.notEqual(revised.step, 'merge-defect');
  const without = mergedDevkitChange({ plan: false });
  const checked = parsed(loopNext(without.t.main, [], without.env)).action;
  assert.deepEqual([checked.kind, checked.step], ['session', 'merge-check'], JSON.stringify(checked));
});

// ---------------------------------------------------------------- AC-9: a task for the conducting session (D-6)
// Invariant: the delivery checker's `conductor-task` row is a session step of the implementation, and every text that hands tasks
// (the implementer, the ship-change rows, the schemas' tasks instruction) names the `Conductor:` marker. Layer: `decide` and the
// texts. Suite: change-loop-declared.

test('coordinator-loop-fixes AC-9 T68 decide on a conductor-task row is a session step of the implementation', () => {
  const a = build(rowOf('conductor-task', { phase: 4, tasks: ['4.1', '4.2'] }));
  assert.deepEqual([a.kind, a.step, a.stage], ['session', 'conductor-task', 'implementation']);
  assert.deepEqual([a.detail.phase, a.detail.tasks], [4, ['4.1', '4.2']]);
});

const SCHEMA_SENTENCE = 'A task only the conducting session can do (a run in the host, a host setting, a real session) starts its description with `Conductor:`; the loop never hands it to the implementer.';
const oneLine = (text) => text.replace(/\s+/g, ' ');

test('coordinator-loop-fixes AC-9 T69 the implementer, the ship-change rows, the devkit session item and both schemas name the Conductor: marker', () => {
  const tdd = readFileSync(join(REPO_ROOT, 'plugins', 'core', 'agents', 'tdd-implementer.md'), 'utf8');
  assert.ok(oneLine(tdd).includes('A task whose description starts with `Conductor:` is the conducting session\'s: never do it or tick it; stop before the first open one, report the phase as stopped there, and return `success` for the tasks before it.'), 'tdd-implementer');
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8').split('\n');
  const conductor = ship.find((l) => l.startsWith('| `conductor-task` |'));
  assert.ok(conductor, 'a conductor-task row');
  assert.ok(conductor.includes('Do each task of `next.tasks` yourself in the worktree, as its text says, and tick it in `tasks.md` when it is done; never edit product code for it, the edit lock refuses it. A task you cannot do is declared with `reply waiting-owner-decision --param id=<id> --param decision="<the task in plain words>"`.'), conductor);
  const implement = ship.find((l) => l.startsWith('| `implement` |'));
  assert.ok(implement.includes('with `next.stopAt`, stop before that task'), implement);
  const session = section(skillText(), '## Loop', '## Owner gates').split('\n').find((l) => l.startsWith('- `session`'));
  assert.ok(session.includes('`conductor-task`'), session);
  for (const f of ['plugins/openspec/schemas/devkit/schema.yaml', 'plugins/openspec/schemas/devkit-lite/schema.yaml', 'openspec/schemas/devkit/schema.yaml', 'openspec/schemas/devkit-lite/schema.yaml']) {
    assert.ok(oneLine(readFileSync(join(REPO_ROOT, f), 'utf8')).includes(SCHEMA_SENTENCE), f);
  }
});

// ---------------------------------------------------------------- AC-17, AC-18: the delivered change found and walked after the merge (D-20, D-21)
// Invariant: `next` on a change delivered by its merged pull request reaches the retro, for a change whose id starts with
// `archive-` seen from the default branch, and for a change whose own branch was advanced into the base. Layer: the loop CLI on a
// git fixture with a fake gh. Suite: change-loop-declared.

// A `devkit-lite` change `id` in `pr` mode, every stage passed at the code's commit and every task ticked, committed on main;
// `branch` (when given) is cut from it. The fake gh answers merged pull request #31 of head `head` as the change's own, every task
// ticked on main, and an archive not started.
function deliveredOnMain(id, { head: headName = id } = {}) {
  const root = gitRepo({ config: 'schema: devkit-lite\nship:\n  devkit-lite: pr\n' });
  const dir = (f) => `openspec/changes/${id}/${f}`;
  put(root, { [dir('.openspec.yaml')]: 'schema: devkit-lite\n', 'src/a.ts': 'code\n' });
  const sha = commitAll(root, 'code');
  const review = `Verdict: approved\nCommit: ${sha}\n\n# Review\n`;
  put(root, {
    [dir('requirements.md')]: `${stageHead('requirements', sha)}# Requirements\n`,
    [dir('proposal.md')]: `${stageHead('proposal', sha)}# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n`,
    [dir('specs/s/spec.md')]: `${stageHead('specs', sha)}# Spec\n`,
    [dir('tasks.md')]: `${stageHead('tasks', sha)}# Tasks\n\n## 1. First\n- [x] 1.1 code\n`,
    [dir('evidence.md')]: `${stageHead('evidence', sha)}Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`,
    [dir('review.md')]: `${stageHead('review', sha)}Consensus: PASS (round 1/2)\n\n# Review\n`,
    [dir('reviews/code-quality-reviewer.md')]: review, [dir('reviews/test-coverage-reviewer.md')]: review,
  });
  const reviewed = commitAll(root, 'reviews, evidence and stage headers');
  const gh = fakeGh();
  const pr = { number: 31, url: 'https://github.com/o/r/pull/31', state: 'MERGED', headRefName: headName, headRefOid: reviewed, baseRefName: 'main', mergedAt: '2026-11-24T10:00:00Z', mergeable: 'UNKNOWN', autoMergeRequest: null, mergeStateStatus: 'UNKNOWN', body: '' };
  gh.set('pr-list-state-merged', { stdout: [pr] });
  gh.set('pr-view', { stdout: pr });
  gh.prFiles(31, [dir('tasks.md'), 'src/a.ts']);
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  gh.tasksOnDefault(id, tasksText({ ticked: ['1.1'] }));
  gh.set('api-GET-repos__owner___repo__contents_openspec_changes_archive_ref=main', { stdout: [] });
  gh.set(`api-GET-repos__owner___repo__contents_openspec_changes_${id}_ref=main`, { stdout: { name: id } });
  gh.set(`pr-list-head-chore_archive-${id}`, { stdout: [] });
  return { root, gh, reviewed, env: { ...cleanEnv, PATH: gh.env.PATH, FAKE_GH_DIR: gh.env.FAKE_GH_DIR } };
}
const nextOfId = (cwd, id, env) => CL.main(['next', '--change', id, '--lang', 'en'], { cwd, env });
const isRetro = (a) => a.kind === 'session' && a.step === 'retro' && a.stage === 'retro';

test('coordinator-loop-fixes AC-17 T124 next on a change archive-x whose own pull request merged, from the default branch, is the retro', () => {
  const d = deliveredOnMain('archive-x');
  const r = nextOfId(d.root, 'archive-x', d.env);
  const { action } = parsed(r);
  assert.ok(isRetro(action), `${JSON.stringify(action)}\n${r.stderr}`);
  assert.notEqual(action.step, 'open-pr');
});

test('coordinator-loop-fixes AC-18 T130 next on a delivered change whose own branch was advanced into the base is the retro, with no verify or review', () => {
  const d = deliveredOnMain('feat');
  git(d.root, 'switch', '-q', '-c', 'feat');
  git(d.root, 'switch', '-q', 'main');
  put(d.root, { 'src/a.ts': 'the base edits a after the merge\n' });
  git(d.root, 'update-ref', 'refs/remotes/origin/main', commitAll(d.root, 'a base commit after the merge'));
  git(d.root, 'switch', '-q', 'feat');
  git(d.root, 'merge', '-q', '--ff-only', 'main');
  const r = loopNext(d.root, [], d.env);
  const { action } = parsed(r);
  assert.ok(isRetro(action), `${JSON.stringify(action)}\n${r.stderr}`);
  for (const step of ['verify', 'review']) assert.notEqual(action.step, step);
  assert.notEqual(action.kind, 'agent', 'no reviewer hand-off');
});

// ---------------------------------------------------------------- AC-4: the agent map from the pack table (D-9)
// Invariant: the loop's agent of every role is `<pack>:<role>` with the pack PACKS names for it, from the one helper agentOf;
// a drift between the map and PACKS fails; project-loop's ADR reviewer comes from the same helper. Layer: change-loop.mjs and
// project-loop.mjs exports and project-loop's decideSlice. Suite: change-loop-declared.

const NINE_ROLES = ['change-planner', 'plan-readiness-reviewer', 'tdd-implementer', 'pr-verifier', 'commit-and-pr', 'screen-designer', 'adr-author', 'test-runner', 'e2e-tester'];
const mapOf = (packs) => Object.fromEntries(NINE_ROLES.map((r) => [r, `${packs[r]}:${r}`]));

test('coordinator-loop-fixes AC-4 T75 every role of AGENT_ROLES has the agent PACKS names, and COMMIT_AGENT is agentOf(commit-and-pr)', () => {
  assert.deepEqual(CL.AGENT_ROLES, NINE_ROLES, 'the nine roles of the map');
  for (const role of CL.AGENT_ROLES) assert.equal(CL.AGENT[role], `${CL.PACKS[role]}:${role}`, role);
  assert.deepEqual(Object.keys(CL.AGENT), NINE_ROLES);
  assert.equal(CL.COMMIT_AGENT, CL.agentOf('commit-and-pr'));
  assert.ok(Object.isFrozen(CL.AGENT), 'the shipped map is frozen');
});

test('coordinator-loop-fixes AC-4 T76 a map built from a PACKS with one pack changed differs from the shipped one; agentOf(owner) is undefined', () => {
  assert.equal(typeof CL.agentOf, 'function', 'agentOf is exported');
  assert.deepEqual({ ...CL.AGENT }, mapOf(CL.PACKS), 'the shipped map is the one PACKS gives');
  const drifted = mapOf({ ...CL.PACKS, 'pr-verifier': 'devkit-openspec' });
  assert.notDeepEqual({ ...CL.AGENT }, drifted, 'a drift fails');
  assert.equal(CL.agentOf('owner'), undefined);
  assert.equal(CL.agentOf('review-bench'), undefined);
});

test('coordinator-loop-fixes AC-4 T77 project-loop\'s ADR reviewer agent is agentOf(adr-reviewer)', async () => {
  const PL = await import('./project-loop.mjs');
  const a = PL.decideSlice({
    ctx: { slice: 'billing', root: tmpFolder('devkit-declared-slice-'), branch: 'billing', lang: 'en', filesLanguage: 'en', base: 'main' }, flow: null, after: null,
    fingerprint: 'f', kind: 'active', report: { next: { stage: 'review', reasonCode: 'no-file' } }, rounds: { passed: false, ids: [], missing: [] },
    dirty: [], verdict: { usable: false }, docs: [],
  });
  assert.deepEqual([a.kind, a.step], ['agent', 'review'], JSON.stringify(a));
  assert.equal(typeof CL.agentOf, 'function', 'agentOf is exported');
  assert.equal(a.agent, CL.agentOf('adr-reviewer'));
});

// ---------------------------------------------------------------- AC-5: the Note of ADR 0011 (D-12)
// Invariant: ADR 0011 carries a dated Note of this change on the stop lock after a recorded end, linking the change's ADR by the
// number its file has, and its `## Decision` section is the text held here. Layer: the ADR document. Suite: change-loop-declared.

const ADR_DIR = join(REPO_ROOT, 'docs', 'adr');
const ADR_0011 = join(ADR_DIR, '0011-the-change-coordinator-is-the-owners-session.md');
const ADR_0011_DECISION = `## Decision

1. In the Claude driver the change coordinator is the session the owner typed /devkit change in.
2. Its product edits, by an edit tool or a shell write, and its hand-offs to any agent whose role
   the change's script does not list are refused by a hook while a /devkit change run is under
   way. A run is under way when the newest slash command typed in the session is /devkit change
   and the loop has named the change after it, both read from the session's transcript.
3. That refusal replaces "it has no edit tool" as the reason there is no side door. Product code
   is still written only by the implementer role under the same hooks; the rest of decision 8,
   and decisions 1 to 7 of ADR 0010, are unchanged.

`;

test('coordinator-loop-fixes AC-5 T78 ADR 0011 has the dated Note on the stop lock and its Decision section is unchanged', () => {
  const adr = readFileSync(ADR_0011, 'utf8');
  const file = readdirSync(ADR_DIR).find((f) => /^\d{4}-the-loop-declares-the-decisions-outside-the-stage-gates\.md$/.test(f));
  assert.ok(file, 'the change\'s ADR file');
  const number = file.slice(0, 4);
  const context = section(adr, '## Context', '## Decision');
  const note = context.split('\n\n').map((p) => p.replace(/\s+/g, ' ')).find((p) => p.startsWith('Note (coordinator-loop-fixes, '));
  assert.ok(note, 'a Note of this change in Context');
  assert.match(note, /^Note \(coordinator-loop-fixes, \d{4}-\d{2}-\d{2}\): /);
  assert.ok(note.includes('the stop lock lets the session end its turn after a recorded end only when that end\'s `devkit-end:` line names the run\'s change'), note);
  assert.ok(note.includes(`the ends a session declares outside the stage gates are those of [ADR ${number}](${file}).`), note);
  assert.ok(note.includes('Decisions 1 to 3 are unchanged.'), note);
  const notes = context.split('\n\n').filter((p) => p.startsWith('Note ('));
  assert.ok(notes.at(-1).startsWith('Note (coordinator-loop-fixes, '), 'after the last Note');
  assert.equal(section(adr, '## Decision', '## Consequences'), ADR_0011_DECISION);
});

// ---------------------------------------------------------------- AC-6: the person's language never set (D-11)
// Invariant: with the language option never set (an empty value, or the unsubstituted `${user_config.language}`), every reply the
// loop prints is the one of the default devkit-openspec's plugin.json declares, with no placeholder left. Layer: normalizeLang and
// the loop CLI. Suite: change-loop-declared.

const PLACEHOLDER = '${user_config.language}';
const pluginDefault = () => JSON.parse(readFileSync(join(REPO_ROOT, 'plugins', 'openspec', '.claude-plugin', 'plugin.json'), 'utf8')).userConfig.language.default;
const REPLY_PARAMS = {
  blocked: { id: 'feat', why: 'tests-red', phase: '1' },
  'waiting-pr-decision': { id: 'feat', number: '12', url: 'https://example.test/pr/12' },
  'waiting-pause': { id: 'feat' },
  'waiting-owner-decision': { id: 'feat', decision: DECISION },
};
const paramArgs = (params) => Object.entries(params).flatMap(([k, v]) => ['--param', `${k}=${v}`]);

test('coordinator-loop-fixes AC-6 T79 normalizeLang\'s fallback equals the language default of devkit-openspec\'s plugin.json', () => {
  const fallback = pluginDefault();
  for (const value of [undefined, '', PLACEHOLDER]) assert.equal(CL.normalizeLang(value), fallback, String(value));
});

test('coordinator-loop-fixes AC-6 T80 each declared reply key with the placeholder or an empty language equals the pt-BR text, with no ${ left', () => {
  const keys = Object.keys(CL.DECLARED).filter((k) => CL.DECLARED[k].via === 'reply');
  assert.deepEqual(keys.slice().sort(), Object.keys(REPLY_PARAMS).sort(), 'every reply key has its parameters here');
  for (const key of keys) {
    const args = paramArgs(REPLY_PARAMS[key]);
    const ptBR = reply([key, ...args], 'pt-BR');
    assert.equal(ptBR.code, 0, `${key}: ${ptBR.stdout}`);
    for (const lang of [PLACEHOLDER, '']) {
      const r = reply([key, ...args], lang);
      assert.equal(r.code, 0, `${key} ${JSON.stringify(lang)}: ${r.stdout}`);
      assert.equal(r.stdout, ptBR.stdout, `${key} ${JSON.stringify(lang)}`);
      assert.ok(!r.stdout.includes('${'), `${key}: ${r.stdout}`);
    }
  }
});

test('coordinator-loop-fixes AC-6 T81 next with the unsubstituted language gives the pt-BR reply of the same action', () => {
  const d = deliveredChange({ checks: [check('build', 'pending')] });
  const at = (lang) => parsed(CL.main(['next', '--change', 'feat', '--lang', lang], { cwd: d.t.main, env: d.env })).action;
  const unset = at(PLACEHOLDER);
  const ptBR = at('pt-BR');
  assert.equal(typeof unset.reply, 'string', JSON.stringify(unset));
  assert.deepEqual(unset, ptBR);
  assert.ok(!unset.reply.includes('${'), unset.reply);
  assert.notEqual(unset.reply, at('en').reply, 'not the English reply');
});

// ---------------------------------------------------------------- AC-11: a host with its own pull-request monitor (D-10)
// Invariant: the devkit skill's `## Waiting on GitHub` keeps its first paragraph and adds the host-monitor exception (no wait, one
// sentence saying so, end the turn, the next turn runs `next`); devkit-session's item 3 holds the same exception. Layer: the
// skills' text. Suite: change-loop-declared.

const WAIT_FIRST = 'When `next` ends waiting on GitHub, start the wait with the Bash tool\'s background option, then say `reply`:';
const WAIT_AFTER = 'The wait has no time limit of its own and exits as soon as GitHub\'s answer changes the decision; its end starts the next turn, which then runs `next` and goes on. Calling `/devkit change` again at any time is safe: it re-reads everything and starts a new wait if GitHub still waits.';
const HOST_MONITOR = 'When the host\'s own instructions to this session say it has a pull-request monitor that wakes the session, and tell it not to poll the checks, start no wait: say `reply`, add one sentence saying that the host\'s pull-request monitor holds the wait and that no wait was started, and end the turn. The turn the host\'s event or the owner\'s next message starts runs `next` and goes on.';

test('coordinator-loop-fixes AC-11 T82 Waiting on GitHub holds the host-monitor paragraph after its first one; devkit-session item 3 the same exception', () => {
  const wait = section(skillText(), '## Waiting on GitHub', '## Train');
  const paragraphs = wait.split('\n\n').map((p) => p.trim());
  assert.equal(paragraphs[1], WAIT_FIRST, 'the first paragraph is unchanged');
  const after = paragraphs.indexOf(WAIT_AFTER);
  assert.ok(after > 1, 'the wait paragraph is unchanged');
  assert.equal(paragraphs[after + 1], HOST_MONITOR, 'the host-monitor paragraph follows');
  const item3 = section(sessionSkillMd(), '## Loop', '## Never').split('\n').find((l) => l.startsWith('3. '));
  const clause = item3.slice(item3.indexOf('`waiting-on-github` starts'));
  assert.ok(clause.includes('roadmap-loop.mjs wait --change <id>'), 'the background wait stays');
  for (const part of ['the host\'s own instructions to this session say it has a pull-request monitor that wakes the session', 'not to poll the checks',
    'starts no wait', 'the host\'s pull-request monitor holds the wait and that no wait was started', 'ends the turn']) {
    assert.ok(clause.includes(part), `item 3 says: ${part}`);
  }
});

// ---------------------------------------------------------------- AC-15, AC-16: the two devkit-lite decisions, recorded only (D-12)
// Invariant: docs/openspec-flow.md's devkit-lite section records that the script has no plan approval of its own by decision and
// that a first-spec change follows the ordinary choice rule; the devkit-lite flow keeps the stages it had. Layer: the flow page and
// the script's flow.json. Suite: change-loop-declared.

const LITE_STAGES = [
  ['open', 'change-coordinator', 'folder'], ['requirements', 'change-coordinator', 'artifact'], ['proposal', 'change-planner', 'artifact'],
  ['specs', 'change-planner', 'artifact'], ['tasks', 'change-planner', 'artifact'], ['implementation', 'tdd-implementer', 'tasks'],
  ['unit-tests', 'test-runner', 'artifact'], ['e2e-tests', 'e2e-tester', 'artifact'], ['evidence', 'pr-verifier', 'artifact'],
  ['review', 'review-bench', 'artifact'], ['delivery', 'commit-and-pr', 'github'], ['retro', 'change-coordinator', 'artifact'],
];

test('coordinator-loop-fixes AC-15 T83 the devkit-lite section of the flow page records both decisions', () => {
  const lite = section(readFileSync(join(REPO_ROOT, 'docs', 'openspec-flow.md'), 'utf8'), '## The `devkit-lite` schema', '## The `devkit-project` schema').replace(/\s+/g, ' ');
  assert.ok(lite.includes('`devkit-lite` has no plan approval of its own, by decision: the owner\'s message that sends the change is its go-ahead.'), 'the plan approval decision');
  assert.ok(lite.includes('A change that creates the project\'s first spec follows the ordinary choice rule (the `why` codes of `change-loop.mjs`, `WHY_CODES`): the first spec is not a reason of its own.'), 'the first-spec decision');
});

test('coordinator-loop-fixes AC-16 T84 the devkit-lite flow declares the same stages as before', () => {
  for (const root of [join(REPO_ROOT, 'plugins', 'openspec', 'schemas'), join(REPO_ROOT, 'openspec', 'schemas')]) {
    const flow = JSON.parse(readFileSync(join(root, 'devkit-lite', 'flow.json'), 'utf8'));
    assert.deepEqual(flow.stages.map((s) => [s.id, s.role, s.source]), LITE_STAGES, root);
  }
});

// ---------------------------------------------------------------- AC-14: the nits (D-13)
// Invariant: `createdAfter` is exported and reads an unreadable `.openspec.yaml` as no creation day, so `unfinished` never lists
// an archived id whose old folder cannot be read; the change-coordination requirement words the archive sources as their union;
// a roadmap run hands a change's commit step with the change loop's brief, attribution request included. Layer: the loop
// (`createdAfter`, `unfinished`, the roadmap's `next`) and the spec text. Suite: change-loop-declared.

const OFFLINE_GH = () => ({ status: 1, stdout: '', stderr: 'offline', missing: false, timedOut: false, overflowed: false });

test('coordinator-loop-fixes AC-14 T85 createdAfter with an unreadable .openspec.yaml is false and does not throw', () => {
  assert.equal(typeof CL.createdAfter, 'function', 'createdAfter is exported');
  const root = tmpFolder('devkit-declared-created-');
  mkdirSync(join(root, 'openspec', 'changes', 'foo', '.openspec.yaml'), { recursive: true });
  assert.equal(CL.createdAfter(root, 'foo', '2026-01-01'), false);
  put(root, { 'openspec/changes/bar/.openspec.yaml': 'schema: devkit\ncreated: 2026-11-24\n' });
  assert.equal(CL.createdAfter(root, 'bar', '2026-01-01'), true, 'a readable later day is a reuse');
  assert.equal(CL.createdAfter(root, 'none', '2026-01-01'), false, 'no file at all');
});

test('coordinator-loop-fixes AC-14 T86 unfinished does not list an archived id whose .openspec.yaml cannot be read', () => {
  assert.equal(typeof CL.createdAfter, 'function', 'createdAfter is exported');
  const t = roundRepo({ roadmap: '# Roadmap\n' });
  t.commitOrigin({ 'openspec/changes/archive/2026-01-01-foo/proposal.md': '# Proposal\n', 'openspec/changes/archive/2026-01-01-bar/proposal.md': '# Proposal\n' });
  const foo = t.addWt('foo');
  mkdirSync(join(foo, 'openspec', 'changes', 'foo', '.openspec.yaml'), { recursive: true });
  put(foo, { 'openspec/changes/foo/proposal.md': '# Proposal\n' });
  const bar = t.addWt('bar');
  put(bar, { 'openspec/changes/bar/.openspec.yaml': 'schema: devkit\ncreated: 2026-11-24\n', 'openspec/changes/bar/proposal.md': '# Proposal\n' });
  assert.equal(CL.createdAfter(foo, 'foo', '2026-01-01'), false);
  assert.deepEqual(CL.unfinished(t.main, { env: cleanEnv, gh: OFFLINE_GH }).map((u) => u.id), ['bar'], 'foo is the stale copy; bar reuses its archived id');
});

const UNION = 'read as the union of every source that can be read (GitHub\'s default branch, the remote-tracking default branch, the local default branch and the main checkout\'s working tree; a source that cannot be read adds nothing)';

test('coordinator-loop-fixes AC-14 T87 the change-coordination requirement words the archive sources as their union', () => {
  const delta = join(REPO_ROOT, 'openspec', 'changes', 'coordinator-loop-fixes', 'specs', 'change-coordination', 'spec.md');
  const file = existsSync(delta) ? delta : join(REPO_ROOT, 'openspec', 'specs', 'change-coordination', 'spec.md');
  const requirement = section(readFileSync(file, 'utf8'), '### Requirement: A change archived on the default branch is not unfinished', '#### Scenario:').replace(/\s+/g, ' ');
  assert.ok(requirement.includes(UNION), requirement);
});

test('coordinator-loop-fixes AC-14 T92 a roadmap run hands a change\'s commit step with the change loop\'s brief, ending with the attribution request', () => {
  const d = deliveredChange();
  put(d.wt, { 'src/extra.ts': 'more\n' });
  const own = parsed(CL.main(['next', '--change', 'feat', '--lang', 'en'], { cwd: d.wt, env: d.env })).action;
  assert.deepEqual([own.kind, own.step, own.agent], ['agent', 'commit', COMMIT], JSON.stringify(own));
  assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported');
  assert.ok(own.brief.endsWith(CL.ATTRIBUTION_ASK), own.brief);
  putRun(d.t.main, { session: 'S1', places: 1 });
  const r = cmd(d.t.main, ['next', ...FLAGS], { env: d.env, gh: undefined });
  const handed = jsonOf(r.stdout).actions.find((a) => a.change === 'feat');
  assert.ok(handed, r.stdout);
  assert.deepEqual([handed.kind, handed.step, handed.agent], ['agent', 'commit', COMMIT]);
  assert.equal(handed.brief, own.brief, 'the change loop\'s brief, unchanged');
});

// ---------------------------------------------------------------- AC-19: a change's own settings in an `x-devkit:` block (D-22)
// Invariant: a change sets `budget` and `models:` in an `x-devkit:` block of its `.openspec.yaml`, which the strict validation of
// OpenSpec accepts and the loop reads; a `devkit:` block there is still read when the file has no `x-devkit:` block, and fails the
// strict validation; the documents and ADR 0023's Note say so. Layer: `budgetOf`, `modelsOf`, `next`, `writePin` and `readPin`, the
// real `openspec` CLI, and the documents. Suite: change-loop-declared.

const FLOW_PAGE = () => readFileSync(join(REPO_ROOT, 'docs', 'openspec-flow.md'), 'utf8');
const paragraphOf = (md, start) => md.split('\n\n').find((p) => p.startsWith(start)) ?? '';
const OWN_SETTINGS = '**A change\'s own settings.**';
const ownExample = () => {
  const md = FLOW_PAGE();
  const at = md.indexOf(OWN_SETTINGS);
  assert.ok(at >= 0, 'the paragraph A change\'s own settings');
  const m = /```yaml\n([\s\S]*?)```/.exec(md.slice(at));
  assert.ok(m, 'its fenced example');
  return m[1];
};

// A project naming devkit-lite, with change `feat` (a proposal, one ADDED delta) whose `.openspec.yaml` is `yaml`.
function settingsProject(yaml) {
  const root = tmpFolder('devkit-declared-settings-');
  put(root, {
    'openspec/config.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/.openspec.yaml': yaml,
    'openspec/changes/feat/proposal.md': '# Proposal\n\n## Why\n\nThe thing needs to work in a new way, which this sentence explains at enough length.\n\n## What Changes\n\n- The thing works differently.\n',
    'openspec/changes/feat/specs/cap/spec.md': '## ADDED Requirements\n\n### Requirement: Thing works\nThe system SHALL make the thing work.\n\n#### Scenario: It works\n- **WHEN** the thing runs\n- **THEN** it works\n',
  });
  return { root, dir: join(root, 'openspec', 'changes', 'feat') };
}
const strictValidate = (root) => spawnSync('openspec', ['validate', 'feat', '--type', 'change', '--strict'], { cwd: root, env: process.env, encoding: 'utf8' });

test('coordinator-loop-fixes AC-19 T136 the flow page\'s example validates strictly and the loop reads it; the same lines under devkit: fail the CLI and still read', () => {
  const example = ownExample();
  const own = settingsProject(example);
  const valid = strictValidate(own.root);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.deepEqual(CL.modelsOf(own.root, own.dir, { strict: true }), { ...CL.DEFAULT_MODELS, review: 'opus' });
  assert.deepEqual(CL.budgetOf(own.root, own.dir, 'en'), { cap: 2000000, from: 'change', file: join(own.dir, '.openspec.yaml') });
  const old = settingsProject(example.replace(/^x-devkit:/m, 'devkit:'));
  const refused = strictValidate(old.root);
  assert.equal(refused.status, 1, 'the strict validation refuses a devkit: key');
  assert.match(refused.stdout + refused.stderr, /Unrecognized key name\(s\) in \.openspec\.yaml.*devkit/);
  assert.deepEqual(CL.budgetOf(old.root, old.dir, 'en'), { cap: 2000000, from: 'change', file: join(old.dir, '.openspec.yaml') }, 'a devkit: block is still read');
});

const X_BLOCK = (...lines) => `schema: devkit\nx-devkit:\n${lines.map((l) => `  ${l}\n`).join('')}`;

test('coordinator-loop-fixes AC-19 T137 the x-devkit block is refused as the devkit block was, the budget stop names it, and the pin lives beside it', () => {
  const zero = planChange({ have: ['requirements', 'decisions'] });
  put(zero, { 'openspec/changes/feat/.openspec.yaml': X_BLOCK('budget: 0') });
  commitAll(zero, 'zero budget');
  const r = loopNext(zero);
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).reply, CL.render('en', 'setting-unknown', { setting: 'budget', value: '0', accepted: '1, 2, 3, …' }));
  const gpt = planChange({ have: ['requirements', 'decisions'] });
  put(gpt, { 'openspec/changes/feat/.openspec.yaml': X_BLOCK('models:', '  design: gpt') });
  commitAll(gpt, 'unknown model');
  const m = loopNext(gpt);
  assert.equal(m.code, 3, m.stdout + m.stderr);
  const [problem] = CL.modelProblems(new Map([['design', 'gpt']]));
  assert.equal(JSON.parse(m.stdout).reply, CL.render('en', 'setting-unknown', problem));
  assert.ok(JSON.parse(m.stdout).reply.includes('design: gpt'));
  const file = '/w/feat/openspec/changes/feat/.openspec.yaml';
  for (const lang of LANGS) {
    const said = CL.render(lang, 'waiting-budget', { id: 'feat', spent: 1200, cap: 1000, file });
    assert.ok(said.includes('x-devkit') && said.includes(file), `${lang}: ${said}`);
  }
  const dir = tmpFolder('devkit-declared-pin-');
  const text = `schema: devkit\ncreated: 2026-11-24\nx-devkit:\n  budget: 3000000\n  models:\n    review: opus\n`;
  writeFileSync(join(dir, '.openspec.yaml'), text);
  CL.writePin(dir, { devkit: '0.29.0', flow: 1 });
  assert.equal(readFileSync(join(dir, '.openspec.yaml'), 'utf8'), `${text}x-devkit-version: 0.29.0\nx-devkit-flow: 1\n`, 'the block stays byte for byte');
  assert.deepEqual(GUARD.readPin(dir), { flow: 1, devkit: '0.29.0' });
  assert.equal(CL.budgetOf(dir, dir, 'en')?.cap, 3000000, 'the budget still reads beside the pin');
});

const ADR_DECISION_0023 = [
  "## Decision",
  "",
  "1. **A stage-to-model table.** The `models:` key of the `devkit:` block of `openspec/config.yaml`",
  "   maps a stage to a model family (`opus`, `sonnet`, `haiku`); the loop code holds a built-in",
  "   default for every stage, and the `devkit:` block of a change's `.openspec.yaml` overrides single",
  "   stages, as `budget` does. The default: Opus for the grill, the plan and the ADRs; Sonnet to",
  "   coordinate, implement, review and deliver; Haiku for the commit and pull-request hand-off, the",
  "   unit-test run and validation. An unknown stage or value is refused with `setting-unknown`. The",
  "   exact key set (the schema's artifact ids plus `implement`, `deliver` and `archive`, or the agent",
  "   names) is the plan's.",
  "2. **No 1M context by default.** No default row uses a `[1m]` variant; a table value may carry",
  "   `[1m]` on `opus` or `sonnet` as an explicit per-stage opt-in. A long session relies on the",
  "   host's compaction.",
  "3. **The model is part of the loop's contract.** Every `agent` action that `next` prints carries a",
  "   `model` field, and the session passes it on the Agent call, overriding the agent's frontmatter",
  "   model.",
  "4. **Sessions only step down, never below the stages they still run** (amends ADR 0014 decision 1;",
  "   the step-down floor is the owner's choice of 2026-11-23). A change session performs some stages",
  "   itself: the grill, the owner's approvals, the review round, the retro and the delivery steps",
  "   (its session-run stages); the others run as stage subagents. In a roadmap run with a session per",
  "   change, the coordinating session starts a change session on the model of the change's first",
  "   stage. When the change's stage changes, it switches that session down only to the strongest",
  "   model among the new stage and the session-run stages still ahead of it (the floor), and only",
  "   when that model is cheaper than the session's current one. In practice a change session does",
  "   not go from Sonnet to Haiku while any session-run stage remains; the table's Haiku rows apply",
  "   only to stages that run as stage subagents. A stage whose table model is above the session's",
  "   current model runs as a stage subagent on that model, never as an upward switch; no session is",
  "   ever switched up, so no confirmation is asked. A lone `/devkit change` keeps the model it was",
  "   opened with; only its stage subagents follow the table. The coordinating session's own model",
  "   stays the owner's choice in the app.",
  "5. **One retry a model up.** A stage subagent that returns `Outcome: failure` on Haiku or Sonnet is",
  "   handed again once on the next family up (Haiku to Sonnet, Sonnet to Opus). A second failure, or",
  "   a failure on Opus, ends the run blocked with `role-failed`, as today. The retry is derived from",
  "   the transcripts, with no new stored state, and its tokens count toward `budget`.",
  "6. **The spend is read, not stored.** `flow-check` and `/devkit status` report tokens per stage and",
  "   per model, the retries and the total against the `budget` cap, read from the session and",
  "   subagent transcripts; nothing is written to the change.",
  "7. ADR 0014's other decisions, and ADR 0010's, are unchanged.",
  "",
  "Note (stage-models, 2026-11-23): decision 5's retry reaches a stage subagent",
  "that stops with `Outcome: failure` without writing its stage file. A subagent that writes its",
  "stage file with `result=failed`, as the `subagent-stop` hook asks of one that stops without it,",
  "is a failed stage and takes the stage's existing fix path, with no retry. Decision 2's `[1m]`",
  "opt-in reaches a session's own model and the retry's mapping, never a stage subagent: the Agent",
  "call takes no suffix. So the Consequences' mitigation \"one retry a model up\" reaches only an",
  "agent that cannot finish; a stage agent that obeys the hook and records `result=failed` takes the",
  "fix path, bounded by the stage's ceiling. No decision's text changes.",
  "",
].join('\n');
const SETTINGS_ADR = /^\d{4}-a-changes-own-settings-live-in-an-x-devkit-block\.md$/;

test('coordinator-loop-fixes AC-19 T139 the flow page, the config comments, the coordination design and ADR 0023 name the x-devkit block', () => {
  const md = FLOW_PAGE();
  const budget = paragraphOf(md, '**The token budget.**');
  const models = paragraphOf(md, '**The model of each stage.**');
  for (const [name, p] of [['token budget', budget], ['model of each stage', models]]) {
    assert.ok(p.includes('the `x-devkit:` block of a change\'s own `.openspec.yaml`'), name);
    assert.ok(!p.includes('`devkit:` block of a change\'s own'), name);
  }
  const paragraphs = md.split('\n\n');
  const own = paragraphs.findIndex((p) => p.startsWith(OWN_SETTINGS));
  assert.ok(own > 0, 'the paragraph A change\'s own settings');
  assert.ok(paragraphs[own - 1].startsWith('**The model of each stage.**'), 'it follows The model of each stage');
  const ownText = paragraphs.slice(own, own + 4).join('\n\n').replace(/\s+/g, ' ');
  assert.ok(ownText.includes('`openspec validate <id> --type change --strict`'), ownText);
  assert.ok(ownText.includes('a `devkit:` block written there before is still read when the file has no `x-devkit:` block'), ownText);
  const config = readFileSync(join(REPO_ROOT, 'openspec', 'config.yaml'), 'utf8').split('\n');
  assert.ok(config.find((l) => l.startsWith('# An optional token budget'))?.includes("a change's own .openspec.yaml can override it in its x-devkit: block"), 'the budget comment');
  assert.ok(config.find((l) => l.startsWith('# An optional models: table'))?.includes("a change's own .openspec.yaml can override a stage in its x-devkit: block"), 'the models comment');
  const design = readFileSync(join(REPO_ROOT, 'docs', 'coordination-design.md'), 'utf8').replace(/\s+/g, ' ');
  assert.equal(design.split('its override in a change\'s own `.openspec.yaml` (its `x-devkit:` block)').length - 1, 2, 'both settings sentences');
  const adrFile = readdirSync(ADR_DIR).find((f) => SETTINGS_ADR.test(f));
  assert.ok(adrFile, 'the change\'s settings ADR file');
  const decision = section(readFileSync(join(ADR_DIR, '0023-the-model-is-chosen-by-stage.md'), 'utf8'), '## Decision', '## Consequences');
  assert.ok(decision.startsWith(`${ADR_DECISION_0023}\n`), 'decisions 1 to 7 and the stage-models Note are unchanged');
  const note = decision.slice(ADR_DECISION_0023.length + 1).trim().replace(/\s+/g, ' ');
  assert.match(note, /^Note \(coordinator-loop-fixes, \d{4}-\d{2}-\d{2}\): /);
  assert.ok(note.includes(`decision 1's override in a change's \`.openspec.yaml\` is written in an \`x-devkit:\` block, not a \`devkit:\` block, as [ADR ${adrFile.slice(0, 4)}](${adrFile}) decides`), note);
  assert.ok(note.endsWith('Decision 1 is otherwise unchanged.'), note);
});

// ---------------------------------------------------------------- review round 1: the plan's limits on record (adr-reviewer F1, F3)
// Invariant: ADR 0032's `## Decision` section is decisions 1 to 8 as accepted (held here), followed by one dated Note that records
// the three limits of the approved plan with their sources; docs/compozy-kit.md points at that Note for the declared steps and
// still names ADR 0024 for the limits it lists. Layer: the documents. Suite:
// change-loop-declared.

const ADR_0032_DECISION = [
  '## Decision',
  '',
  '1. Every decision the loop meets outside the script\'s stage gates is a declared key of',
  '   `change-loop.mjs reply` or a declared step of `next`; the session never stops on an undeclared',
  '   end, and no stage header is edited by hand to move a change on. A pause the owner asks for and a',
  '   decision outside the gates each have their own declared end, both in the state "waiting for the',
  '   owner" of ADR 0010 decision 3: no fifth end state is added, and their state and title are derived',
  '   where ADR 0017 derives every other.',
  '2. The stop lock lets the session end its turn on a declared end only when the end\'s `devkit-end:`',
  '   marker names the run\'s change; a marker with another change\'s id releases nothing. A turn that',
  '   ends without a declared end while a stage is ready is still refused. The hook still vetoes and',
  '   does not drive (ADR 0010 decision 5).',
  '3. After the second review round, the review\'s deadlock (`stop-review-deadlock`, or for the code',
  '   review the stage walk\'s attempt ceiling of the `review` stage, which the loop meets first) stays',
  '   until the owner authorizes one more round in their own typed message, recorded from the owner\'s',
  '   session in the same way as the plan approval; a message from another session or agent is no',
  '   authorization. Each authorization hands exactly one round of the review it answers: it raises',
  '   that review\'s round limit, and for the code review its stage ceiling, by one; the round script',
  '   accepts the round, and the loop leaves the deadlock for it by its own step.',
  '4. A first red gate hands one declared fix step to `devkit-core:tdd-implementer`, then the gate runs',
  '   again; a second red gate ends the run `blocked` with `why=tests-red`. The bound lives in the loop',
  '   and may be widened by a later decision, never removed.',
  '5. A pull request that conflicts with the base outside the release files gets a declared resolve',
  '   step, in the same way as `resolve-release-conflict`; its role\'s `Outcome: failure` ends the run',
  '   `blocked` with `why=role-failed`. A conflict in the release files keeps `resolve-release-conflict`.',
  '6. A task line of `tasks.md` carrying the marker the plan names is the conducting session\'s: the loop',
  '   never hands it to the implementer and counts it done only when ticked. The marker lifts no lock:',
  '   the session does such a task under ADR 0011 decision 2, so a task that needs a product edit is',
  '   never marked for it.',
  '7. A plan file (`proposal.md`, `design.md`, `tasks.md`, a spec delta) edited after the implementation',
  '   started makes the readiness review and the owner\'s approval stale, and `next` hands the plan back',
  '   to its own gates, the owner\'s approval included. A `tasks.md` tick and an evidence file do not.',
  '8. ADR 0010\'s and ADR 0011\'s decisions are otherwise unchanged; ADR 0011 gains a dated Note on the',
  '   stop lock after a recorded end, its Decision section untouched.',
].join('\n');
const LOOP_ADR = () => readdirSync(ADR_DIR).find((f) => /^\d{4}-the-loop-declares-the-decisions-outside-the-stage-gates\.md$/.test(f));

test('coordinator-loop-fixes AC-7 T147 ADR 0032 keeps its decisions and records the plan\'s three limits in a dated Note, which the CompozyOS page names', () => {
  const file = LOOP_ADR();
  const decision = section(readFileSync(join(ADR_DIR, file), 'utf8'), '## Decision', '## Consequences');
  assert.ok(decision.startsWith(`${ADR_0032_DECISION}\n\n`), 'decisions 1 to 8 are unchanged');
  const note = decision.slice(ADR_0032_DECISION.length).trim().replace(/\s+/g, ' ');
  assert.match(note, /^Note \(coordinator-loop-fixes, 2026-11-25\): /);
  for (const words of [
    'the CompozyOS driver has no `declare` step', 'asks the owner at a red gate', 'stops its review at two rounds',
    'an archive that left a delivery train', 'keeps its blocked `stop-archive`', 'outside the release files',
    '[ADR 0022](0022-reviewed-changes-leave-on-a-delivery-train.md), decision 8',
    'an approval written without a `- Plan:` line never goes stale',
    'proposal AC-7 and AC-10', 'design.md',
  ]) assert.ok(note.includes(words), `${words}: ${note}`);
  assert.ok(note.endsWith('No decision\'s text changes.'), note);
  const kit = readFileSync(join(REPO_ROOT, 'docs', 'compozy-kit.md'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(kit.includes('[ADR 0024](adr/0024-compozy-runs-the-short-loop.md) lists each limit'), 'the ADR 0024 sentence stays');
  assert.ok(kit.includes(`the dated Note of [ADR ${file.slice(0, 4)}](adr/${file}) records this limit`), 'the page points at the Note');
});

// ---------------------------------------------------------------- AC-20: no test pins the state of a live roadmap line (D-23)
// Invariant: the `context:` of openspec/config.yaml holds the `Live roadmap:` rule right after `Test history:`. Layer: the
// project's config, read as text. Suite: change-loop-declared.

const LIVE_ROADMAP = '  Live roadmap: A test never asserts the tick or the done state of a line of openspec/roadmap.md, which the line\'s own archive changes; it finds a line whatever its tick, and a line\'s old content is held as a fixture or a constant.';

test('coordinator-loop-fixes AC-20 T140 the config context holds the Live roadmap rule right after Test history', () => {
  const lines = readFileSync(join(REPO_ROOT, 'openspec', 'config.yaml'), 'utf8').split('\n');
  const at = lines.findIndex((l) => l.startsWith('  Test history: '));
  assert.ok(at >= 0, 'the Test history line');
  assert.equal(lines[at + 1], LIVE_ROADMAP);
});
