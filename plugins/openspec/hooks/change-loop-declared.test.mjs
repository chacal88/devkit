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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import {
  planChange, transcriptOf, typedLine, runLine, toolResultLine, stopInput, sandbox, cleanEnvLoop as cleanEnv,
  cmd, FLAGS, projectWith, roadmapText, putRun, stateOf, runFileOf,
} from './test-fixtures.mjs';
import { hook, skillText, section } from './change-loop-fixtures.mjs';
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
const stopAfter = (root, lines) => {
  const tmp = sandbox();
  const log = join(tmp, 'hook-log.jsonl');
  const r = hook('stop', stopInput(root, transcriptOf([typedLine('change add the feature'), runLine('feat'), ...lines])), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
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
