// node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop.test.mjs
// roadmap-coordinator, part 1 of 3 (suite-speed D-11; the other parts are roadmap-loop-followups.test.mjs and roadmap-loop-upfront.test.mjs): the roadmap loop, its commands and its locks (phase 1: the previous-script fixtures and the pure core; phase 2: the commands; phase 3: the locks). What the three parts share is in roadmap-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, utimesSync, realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  gitRepo, put, commitAll, git, FLOWS, cleanEnvLoop as cleanEnv, agentAct, grillAct, endAct, ownerAct, classify, world, OFFLINE, FLAGS, roadmapText,
  projectWith, cmd, doRun, doNext, doStatus, jsonOf, runFileOf, stateOf, putRun, events, addOpen,
  roundRepo,
} from './test-fixtures.mjs';
import { parseRoadmap } from './guard.mjs';
import * as guardModule from './guard.mjs';
import { nextAction, render, MESSAGES, LoopUsageError, HOOKS_DIR, main as changeMain, baseFetches } from './change-loop.mjs';
import { deliveredChange, gitShim, staleBase, implementingChange } from './change-loop-fixtures.mjs';
import { makeOpenspec } from './flow-check.mjs';
import * as loopModule from './roadmap-loop.mjs';
import { limitOf, readLoad, parseWord, gateOf, isPrevious, decideRoadmap, boardOf, draftText } from './roadmap-loop.mjs';
import {
  sessionAct, githubAct, blockedAct, archivedAct, FLYING, say, changesOf, rowAt, LOOP_FILE, inFlight, picture, LK_SESSION, lkSandbox, lkStored,
  lkCommandText, lkTyped, lkPlain, lkSkillBody, lkAssistant, lkResult, lkMarker, lkChangeMarker, lkTranscript, lkRun, RUNNING, lkBase, lkStopInput,
  lkAgentInput, BRIEF, PLANNER_TYPE, UP_TO_TASKS, UP_TO_READINESS, lkProject, LK_ENV, lkOpts, withTmp, recordOf, nothingRecorded, stopOf, agentOf,
  lkHook, lkEdit, lkBash,
} from './roadmap-loop-fixtures.mjs';

// ---------------------------------------------------------------- the previous-script fixtures (design D-4)

// The nine change folders of D-4's table, committed in `root`: P1 to P6 are of the previous script in each form
// `flow-check.mjs#isPreviousScript` recognises, Q1, Q2 and `other-work` are current. "Headerless" is a file whose first
// line is `# <Title>`; "headed" one whose first line is a well-formed stage header of its own stage with result=passed.
// Built from the rule only: no checkout's state is read and no id of another project is used.
function previousForms(root) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  const headed = (stage, title) => `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${c0} -->\n# ${title}\n`;
  const bare = (title) => `# ${title}\n`;
  const plan = { 'proposal.md': bare('Proposal'), 'design.md': bare('Design'), 'tasks.md': `${bare('Tasks')}\n- [ ] 1.1 a\n` };
  const forms = {
    'old-lone-proposal': { script: 'devkit', files: { 'proposal.md': bare('Proposal') } },
    'old-headerless-plan': { script: 'devkit', files: plan },
    'old-plan-headed-later': { script: 'devkit', files: { ...plan, 'readiness.md': headed('readiness', 'Readiness') } },
    'old-lite-form': { script: 'devkit-lite', files: { 'proposal.md': bare('Proposal'), 'tasks.md': `${bare('Tasks')}\n- [ ] 1.1 a\n`, 'evidence.md': headed('evidence', 'Evidence') } },
    'old-headerless-requirements': { script: 'devkit', files: { 'requirements.md': bare('Requirements'), 'proposal.md': headed('proposal', 'Proposal') } },
    'old-specs-only': { script: 'devkit', files: { 'specs/a/spec.md': bare('Spec A'), 'specs/b/spec.md': bare('Spec B') } },
    'new-headed-requirements': { script: 'devkit', files: { 'requirements.md': headed('requirements', 'Requirements'), 'proposal.md': bare('Proposal') } },
    'new-specs-mixed': { script: 'devkit', files: { 'specs/a/spec.md': headed('specs', 'Spec A'), 'specs/b/spec.md': bare('Spec B') } },
    'other-work': { script: 'devkit', files: { 'requirements.md': headed('requirements', 'Requirements') } },
  };
  put(root, Object.fromEntries(Object.entries(forms).flatMap(([id, { script, files }]) => [
    [`openspec/changes/${id}/.openspec.yaml`, `schema: ${script}\n`],
    ...Object.entries(files).map(([file, body]) => [`openspec/changes/${id}/${file}`, body]),
  ])));
  commitAll(root, 'previous-script and current forms');
  return {
    previous: ['old-lone-proposal', 'old-headerless-plan', 'old-plan-headed-later', 'old-lite-form', 'old-headerless-requirements', 'old-specs-only'],
    current: ['new-headed-requirements', 'new-specs-mixed', 'other-work'],
  };
}

test('roadmap-loop lines: the previous-script forms are the ones flow-check recognises', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const { previous, current } = previousForms(root);
  assert.equal(previous.length + current.length, 9);
  for (const id of [...previous, ...current]) assert.ok(existsSync(join(root, 'openspec', 'changes', id, '.openspec.yaml')), `${id} has its folder`);
  const read = (id) => nextAction(root, id, { env: cleanEnv, lang: 'en' });
  for (const id of previous) {
    const a = read(id);
    assert.deepEqual([a.kind, a.end?.state, a.end?.why], ['end', 'blocked', 'previous-script'], id);
  }
  for (const id of current) {
    const a = read(id);
    assert.notEqual(a.end?.why, 'previous-script', `${id} is on the current script`);
  }
});

// ---------------------------------------------------------------- builders for the pure tests

const clsOf = (classified) => Object.fromEntries(classified.map((l) => [l.id, l.cls]));

// ---------------------------------------------------------------- lines (design D-4): C1 to C8

test('roadmap-loop lines: C1 a ticked line of an archived change is archived', () => {
  assert.deepEqual(clsOf(classify({ lines: ['[x] a'], archived: ['a'] })), { a: 'archived' });
});

test('roadmap-loop lines: C2 an unticked line of an archived change is archived, its line not ticked yet', () => {
  assert.deepEqual(clsOf(classify({ lines: ['[ ] a'], archived: ['a'], open: ['a'] })), { a: 'archived-unticked' });
});

test('roadmap-loop lines: C3 a ticked line that is not archived is never started, open or not', () => {
  assert.deepEqual(clsOf(classify({ lines: ['[x] a', '[x] b'], open: ['b'] })), { a: 'ticked', b: 'ticked' });
});

test('roadmap-loop lines: C4 an open change on the previous script is skipped and fills no place', () => {
  const [line] = classify({ lines: ['[ ] a'], open: ['a'], previous: ['a'] });
  assert.equal(line.cls, 'previous');
  assert.equal(isPrevious(blockedAct('a', 'previous-script')), true, 'the end blocked, why previous-script, is the previous script');
  for (const other of [blockedAct('a', 'ceiling'), agentAct('a'), ownerAct('a'), archivedAct('a'), undefined, null]) assert.equal(isPrevious(other), false);
});

test('roadmap-loop lines: C5 an open change on the current script is open', () => {
  assert.deepEqual(clsOf(classify({ lines: ['[ ] a'], open: ['a'] })), { a: 'open' });
});

test('roadmap-loop lines: C6 a change that could not be opened and was declared is blocked', () => {
  const declared = { a: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } };
  assert.deepEqual(clsOf(classify({ lines: ['[ ] a'], declared })), { a: 'blocked' });
  assert.deepEqual(clsOf(classify({ lines: ['[ ] a'], declared, open: ['a'] })), { a: 'open' }, 'once open, it is C5 and its declared end applies as N2');
});

test('roadmap-loop lines: C7 a line with every dependency archived, or none, is ready', () => {
  const c = classify({ lines: ['[ ] a', '[ ] b (after: x, y)'], archived: ['x', 'y'] });
  assert.deepEqual(clsOf(c), { a: 'ready', b: 'ready' });
});

test('roadmap-loop lines: C8 a line waits for the first dependency, in written order, that is not archived', () => {
  const c = classify({ lines: ['[ ] a (after: x, y)', '[ ] b (after: x, y)', '[ ] c (after: z)', '[ ] d'], archived: ['x'] });
  assert.deepEqual(c.map((l) => [l.id, l.cls, l.waitsFor ?? null]), [['a', 'waiting', 'y'], ['b', 'waiting', 'y'], ['c', 'waiting', 'z'], ['d', 'ready', null]]);
  // A dependency that is ticked on the roadmap but not archived, or on the previous script, still waits: the tick gates nothing.
  const ticked = classify({ lines: ['[x] p', '[ ] q (after: p)', '[ ] r', '[ ] s (after: r)'], open: ['r'], previous: ['r'] });
  assert.deepEqual(ticked.map((l) => [l.id, l.cls, l.waitsFor ?? null]), [['p', 'ticked', null], ['q', 'waiting', 'p'], ['r', 'previous', null], ['s', 'waiting', 'r']]);
});

test('roadmap-loop lines: archived is read from the archived set, never from the tick, and an id counts at its first line', () => {
  const c = classify({ lines: ['[x] a', '[ ] b', '[ ] a', '[x] b'], archived: ['b'] });
  assert.deepEqual(c.map((l) => [l.id, l.cls]), [['a', 'ticked'], ['b', 'archived-unticked']], 'the second line of an id is dropped');
});

test('roadmap-loop lines: a change that is not on the roadmap has no line', () => {
  const c = classify({ lines: ['[ ] a'], open: ['a', 'other-work'] });
  assert.deepEqual(c.map((l) => l.id), ['a']);
});

test('roadmap-loop lines: a line keeps its request, its notes, its round and its dependencies', () => {
  const c = classify({ lines: ['[ ] a (after: z) - first line\n  more words', '[ ] b'], archived: ['z'] });
  assert.deepEqual([c[0].id, c[0].text, c[0].notes, c[0].round, c[0].after], ['a', 'first line', 'more words', 'Round 1: flags', ['z']]);
  assert.deepEqual([c[1].text, c[1].notes], ['', '']);
});

// ---------------------------------------------------------------- setting, load and the word of the command

test('roadmap-loop setting: limitOf reads a whole number from 1 to 1000 and anything else as 80', () => {
  for (const bad of [undefined, null, '', 'abc', '80%', '0', '1001', '-5', '8.5', '${user_config.load_limit}', ' ', 0, 1001]) assert.equal(limitOf(bad), 80, String(bad));
  assert.equal(limitOf('150'), 150);
  assert.equal(limitOf(' 90 '), 90);
  assert.equal(limitOf('1'), 1);
  assert.equal(limitOf('1000'), 1000);
  assert.equal(limitOf(150), 150);
});

test('roadmap-loop load: readLoad is the load of the last minute per logical core, as a whole percentage', () => {
  const cores = (n) => () => new Array(n).fill({});
  assert.equal(readLoad({ loadavg: () => [1.84, 0, 0], cpus: cores(2) }), 92);
  assert.equal(readLoad({ loadavg: () => [0.4, 9, 9], cpus: cores(8) }), 5);
  assert.equal(readLoad({ loadavg: () => [0, 0, 0], cpus: cores(8) }), 0, 'a system that reports no load never counts as loaded');
  assert.equal(readLoad({ loadavg: () => [3, 0, 0], cpus: cores(0) }), 0, 'no core is no load');
  assert.equal(typeof readLoad(), 'number');
});

test('roadmap-loop decide: parseWord reads the number, stop and refuses every other word', () => {
  assert.deepEqual(parseWord(''), { kind: 'places', places: 1 });
  assert.deepEqual(parseWord('  \n'), { kind: 'places', places: 1 });
  assert.deepEqual(parseWord('3'), { kind: 'places', places: 3 });
  assert.deepEqual(parseWord(' 99 '), { kind: 'places', places: 99 });
  for (const stop of ['stop', 'STOP', 'Stop']) assert.deepEqual(parseWord(stop), { kind: 'stop' }, stop);
  for (const word of ['many', '0', '-1', '1.5', '+2', '100', '2 3', '03x', 'stopp']) assert.deepEqual(parseWord(word), { kind: 'invalid', word }, word);
});

// ---------------------------------------------------------------- decide: starts, places and load (design D-7, D-6)

test('roadmap-loop decide: starts take the ready lines in file order, with their request, never a ticked, archived or waiting line', () => {
  const lines = ['[x] ticked-one', '[ ] archived-one', '[ ] a', '[ ] b - second\n  more words', '[ ] c (after: a)', '[ ] d'];
  const facts = (places) => world({ lines, archived: ['archived-one'], places });
  assert.deepEqual(changesOf(decideRoadmap(facts(2))), [['a', 'start'], ['b', 'start']]);
  assert.deepEqual(changesOf(decideRoadmap(facts(1))), [['a', 'start']]);
  assert.deepEqual(changesOf(decideRoadmap(facts(5))), [['a', 'start'], ['b', 'start'], ['d', 'start']], 'c waits for a, which is not archived');
  const r = decideRoadmap(facts(2));
  assert.deepEqual(r.actions.map((a) => a.request), ['a', 'second\nmore words'], 'a line with no description is asked for by its id');
  assert.deepEqual(r.state.starting, ['a', 'b']);
  assert.equal(r.end, null);
  assert.deepEqual([r.version, r.places, r.stopping, r.open], [1, 2, false, []]);
});

test('roadmap-loop decide: starts keep going until the places are filled, and an archived dependency makes its line ready', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b (after: z)'], archived: ['z'], places: 5 }));
  assert.deepEqual(changesOf(r), [['a', 'start'], ['b', 'start']]);
});

test('roadmap-loop decide: places are filled by an owner wait, a GitHub wait, a blocked change and a declared one', () => {
  const fillers = {
    'an owner wait': { actions: { a: ownerAct('a') } },
    'a GitHub wait': { actions: { a: githubAct('a') } },
    'a blocked change': { actions: { a: blockedAct('a', 'ceiling', { stage: 'Plan readiness', attempt: 3 }) } },
    'a declared change': { actions: { a: agentAct('a') }, declared: { a: { state: 'blocked', why: 'role-failed', params: { stage: 'Proposal' } } } },
    'a change that could not be opened': { declared: { a: { state: 'blocked', why: 'cannot-open', params: { error: 'taken' } } } },
  };
  for (const [what, over] of Object.entries(fillers)) {
    const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], places: 1, ...over }));
    assert.ok(!r.actions.some((a) => a.kind === 'start'), `${what} fills the only place`);
    assert.equal(r.open.length, 1, what);
    assert.equal(decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], places: 2, ...over })).actions.filter((a) => a.kind === 'start').length, 1, `${what}: a second place is free`);
  }
});

test('roadmap-loop decide: places a change open before the run is resumed first and counts', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], places: 1, actions: { b: agentAct('b') }, wheres: { b: 'next is the proposal' } }));
  assert.deepEqual(changesOf(r), [['b', 'agent']], 'b is resumed and no new change starts');
  assert.deepEqual(r.open, ['b']);
  assert.deepEqual(r.lines, [say('roadmap-resumed', { id: 'b', where: 'next is the proposal', open: 1, places: 1 })]);
});

test('roadmap-loop decide: the count on a started or resumed line is the open changes up to that line, as the lines print', () => {
  const lines = ['[ ] a', '[ ] b'];
  const started = decideRoadmap(world({ lines, places: 2, actions: { a: agentAct('a'), b: agentAct('b') }, starting: ['a', 'b'] }));
  assert.deepEqual(started.lines, [say('roadmap-started', { id: 'a', open: 1, places: 2 }), say('roadmap-started', { id: 'b', open: 2, places: 2 })]);
  const resumed = decideRoadmap(world({ lines, places: 2, actions: { a: agentAct('a'), b: agentAct('b') }, wheres: { a: 'next is the proposal', b: 'next is the proposal' } }));
  assert.deepEqual(resumed.lines, [
    say('roadmap-resumed', { id: 'a', where: 'next is the proposal', open: 1, places: 2 }),
    say('roadmap-resumed', { id: 'b', where: 'next is the proposal', open: 2, places: 2 }),
  ]);
  const earlier = decideRoadmap(world({ lines, places: 2, actions: { a: agentAct('a'), b: agentAct('b') }, announced: { a: 'started' }, starting: ['b'] }));
  assert.deepEqual(earlier.lines, [say('roadmap-started', { id: 'b', open: 2, places: 2 })], 'a change open and announced before counts first');
});

test('roadmap-loop decide: the resumed line reads right for every form of where, in both languages', () => {
  const stage = { en: 'Delivery', 'pt-BR': 'Entrega' };
  for (const lang of ['en', 'pt-BR']) {
    const wheres = [
      render(lang, 'where.next', { stage: stage[lang] }), render(lang, 'where.owner', { stage: stage[lang] }), render(lang, 'where.github'),
      render(lang, 'where.finishing', { stage: stage[lang] }), render(lang, 'where.blocked', { stage: stage[lang] }),
      render(lang, 'where.previous'), render(lang, 'where.archiving'), render(lang, 'where.archived'),
    ];
    for (const where of wheres) {
      const line = render(lang, 'roadmap-resumed', { id: 'a', where, open: 1, places: 2 });
      assert.ok(line.includes(where), line);
      if (lang === 'pt-BR') assert.doesNotMatch(line, /\bem (a|o|as|os) /, line);
    }
    if (lang === 'pt-BR') {
      assert.equal(render(lang, 'where.blocked', { stage: 'Entrega' }), 'parada na etapa Entrega');
      assert.equal(render(lang, 'where.owner', { stage: 'Entrega' }), 'esperando você na etapa Entrega');
    }
  }
});

test('roadmap-loop decide: places a lower number starts nothing, interrupts nothing and hands no stop', () => {
  const actions = { a: agentAct('a'), b: sessionAct('b'), c: agentAct('c', 'design') };
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b', '[ ] c', '[ ] d'], places: 1, actions }));
  assert.deepEqual(changesOf(r), [['a', 'agent'], ['b', 'session'], ['c', 'agent']], 'the open changes still go on');
  assert.equal(r.stopping, false);
  assert.equal(r.end, null);
  assert.deepEqual(r.open, ['a', 'b', 'c']);
  assert.ok(!r.actions.some((a) => a.kind === 'start' || a.kind === 'hold'));
});

test('roadmap-loop decide: load at or above the limit holds the start, also with nothing open, and says so once', () => {
  const lines = ['[ ] a', '[ ] b'];
  for (const load of [80, 92, 500]) {
    const r = decideRoadmap(world({ lines, load, limit: 80 }));
    assert.deepEqual(changesOf(r), [['a', 'hold']], `load ${load}`);
    assert.deepEqual(r.lines, [say('roadmap-held', { id: 'a', load, limit: 80 })]);
    assert.equal(r.state.held, true);
    assert.deepEqual(r.state.starting, []);
    assert.equal(r.end, null, 'a hold is work for the session');
  }
  const below = decideRoadmap(world({ lines, load: 79, limit: 80 }));
  assert.deepEqual(changesOf(below), [['a', 'start'], ['b', 'start']]);
  assert.equal(below.state.held, false);
  // The next decisions: the line is not said again; a hold already watched in the background is not asked for again.
  const again = decideRoadmap(world({ lines, load: 92, held: true }));
  assert.deepEqual(again.lines, []);
  assert.deepEqual(changesOf(again), [['a', 'hold']]);
  const watched = decideRoadmap(world({ lines, load: 92, held: true, holding: true }));
  assert.deepEqual([watched.actions, watched.lines, watched.end], [[], [], null], 'a held start being watched has no action and no end');
});

test('roadmap-loop decide: a load that falls clears the hold and starts the change', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a'], load: 40, held: true }));
  assert.deepEqual(changesOf(r), [['a', 'start']]);
  assert.equal(r.state.held, false);
  assert.deepEqual(r.lines, []);
});

test('roadmap-loop decide: the load never touches a change under way and holds nothing when there is nothing to start', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: agentAct('a') }, load: 99, places: 1 }));
  assert.deepEqual(changesOf(r), [['a', 'agent']], 'the stage is handed whatever the load, and no place is free for a hold');
  assert.equal(r.state.held, false);
  assert.deepEqual(changesOf(decideRoadmap(world({ lines: ['[x] a'], load: 99 }))), []);
  const waiting = decideRoadmap(world({ lines: ['[ ] a (after: z)'], load: 99 }));
  assert.deepEqual([changesOf(waiting), waiting.state.held], [[], false], 'a waiting line is not ready, so nothing is held');
});

// ---------------------------------------------------------------- decide: one change at a time (D-7 N1 to N8)

const only = (action, over = {}) => decideRoadmap(world({ lines: ['[ ] a'], actions: { a: action }, announced: { a: 'started' }, ...over }));

test('roadmap-loop decide: per change N1 a change in flight is under way and gets no action', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: agentAct('a') }, inflight: { a: FLYING } }));
  assert.deepEqual(r.actions, []);
  assert.deepEqual(r.open, ['a']);
  assert.equal(r.end, null, 'something is in flight');
  assert.equal(r.entries.find((e) => e.id === 'a').state, 'running');
});

test('roadmap-loop decide: per change N2 a declared change keeps its declared state, blocked or waiting for the owner', () => {
  const declaredBlocked = { a: { state: 'blocked', why: 'role-failed', params: { stage: 'Proposal' } } };
  const blocked = only(agentAct('a'), { declared: declaredBlocked });
  assert.deepEqual(blocked.actions, []);
  assert.equal(blocked.ask, null);
  assert.deepEqual(blocked.lines, [say('roadmap-blocked', { id: 'a', why: 'role-failed', stage: 'Proposal' })]);
  const declaredOwner = { a: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: { gate: 'decision', url: 'u' } } };
  const owner = only(agentAct('a'), { declared: declaredOwner });
  assert.deepEqual(owner.actions, []);
  assert.equal(owner.entries.find((e) => e.id === 'a').gate, 'decision');
  assert.deepEqual(owner.lines, [say('roadmap-gate', { id: 'a', gate: 'decision' })]);
});

test('roadmap-loop decide: per change N3 an agent hand-off is an agent action with its brief and key unchanged', () => {
  const action = agentAct('a');
  const [handed] = only(action).actions;
  assert.deepEqual([handed.change, handed.kind, handed.agent, handed.brief, handed.progressKey], ['a', 'agent', action.agent, action.brief, action.progressKey]);
  assert.equal(handed.stage, 'proposal');
});

test('roadmap-loop decide: per change N4 a session step is a session action', () => {
  const [handed] = only(sessionAct('a', 'review')).actions;
  assert.deepEqual([handed.change, handed.kind, handed.step, handed.progressKey], ['a', 'session', 'review', 'review/review@abc123']);
});

test('roadmap-loop decide: per change N5 the end waiting on GitHub is a wait action', () => {
  const [handed] = only(githubAct('a', 'checks')).actions;
  assert.deepEqual([handed.change, handed.kind], ['a', 'wait']);
  assert.equal(handed.end.why, 'waiting-github');
  assert.equal(typeof handed.progressKey, 'string');
  assert.ok(handed.progressKey.length > 0);
  assert.equal(only(githubAct('a')).ask, null, 'a wait on GitHub is not a gate of the owner');
});

test('roadmap-loop decide: per change N6 the grill and an end waiting for the owner join the owner queue, with no action', () => {
  const grill = only(grillAct('a'));
  assert.deepEqual(grill.actions, []);
  assert.deepEqual([grill.ask.change, grill.ask.kind, grill.ask.action.kind], ['a', 'grill', 'grill']);
  const gate = only(ownerAct('a', 'waiting-retro'));
  assert.deepEqual([gate.ask.change, gate.ask.kind, gate.ask.action.end.why], ['a', 'gate', 'waiting-retro']);
  assert.deepEqual(gate.lines, [say('roadmap-gate', { id: 'a', gate: 'retro' })]);
});

test('roadmap-loop decide: per change N7 a blocked end is blocked with its own reason, and no action', () => {
  const r = only(blockedAct('a', 'ceiling', { stage: 'Plan readiness', attempt: 3 }));
  assert.deepEqual(r.actions, []);
  assert.deepEqual(r.lines, [say('roadmap-blocked', { id: 'a', why: 'ceiling', stage: 'Plan readiness', attempt: 3 })]);
  assert.equal(r.ask, null);
});

test('roadmap-loop decide: per change N8 an archived end frees its place at once and is announced', () => {
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: archivedAct('a') }, places: 1, announced: { a: 'started' } }));
  assert.deepEqual(r.open, [], 'its place is free');
  assert.deepEqual(r.lines, [say('roadmap-archived', { id: 'a' })]);
  assert.equal(r.end, null, 'the next call sees its archive on the default branch');
  assert.deepEqual(changesOf(r), [['b', 'start']]);
});

test('roadmap-loop decide: an open change with no action and no entry in the run is a usage error', () => {
  assert.throws(() => decideRoadmap(world({ lines: ['[ ] a'], openExtra: ['a'] })), LoopUsageError);
});

// ---------------------------------------------------------------- decide: the owner queue and the events

test('roadmap-loop decide: owner queue is in roadmap order, names its change and hands the others stages in the same decision', () => {
  const actions = { a: agentAct('a', 'design'), b: grillAct('b'), c: ownerAct('c'), d: sessionAct('d') };
  const r = decideRoadmap(world({ lines: ['[ ] a', '[ ] b', '[ ] c', '[ ] d'], actions }));
  assert.deepEqual([r.ask.change, r.ask.kind], ['b', 'grill']);
  assert.deepEqual(changesOf(r), [['a', 'agent'], ['d', 'session']]);
  assert.equal(r.state.asking, 'b');
});

test('roadmap-loop decide: owner queue keeps its head while that gate is open, even when an earlier change reaches a gate', () => {
  const lines = ['[ ] a', '[ ] b'];
  const grillOfB = decideRoadmap(world({ lines, actions: { a: agentAct('a'), b: grillAct('b') } }));
  assert.equal(grillOfB.ask.change, 'b');
  const meanwhile = decideRoadmap(world({ lines, actions: { a: ownerAct('a'), b: grillAct('b') }, asking: grillOfB.state.asking }));
  assert.equal(meanwhile.ask.change, 'b', 'a, earlier in the file, waits for the grill of b to end');
  const after = decideRoadmap(world({ lines, actions: { a: ownerAct('a'), b: agentAct('b') }, asking: 'b' }));
  assert.deepEqual([after.ask.change, after.ask.kind], ['a', 'gate'], 'the head left the queue: the first entry is next');
  assert.equal(after.state.asking, 'a');
  const none = decideRoadmap(world({ lines, actions: { a: agentAct('a'), b: agentAct('b') }, asking: 'a' }));
  assert.deepEqual([none.ask, none.state.asking], [null, null]);
});

test('roadmap-loop decide: events each of the table once, in order, none for a stage change or a GitHub wait', () => {
  const blockedD = blockedAct('d', 'ceiling', { stage: 'Plan readiness', attempt: 3 });
  const facts = (over = {}) => world({
    lines: ['[ ] a', '[ ] b', '[ ] c', '[ ] d', '[x] e', '[ ] f', '[ ] g'],
    archived: ['e'],
    actions: { a: grillAct('a'), b: agentAct('b'), c: ownerAct('c'), d: blockedD },
    previous: ['f'], places: 5, load: 92, limit: 80, starting: ['a'],
    announced: { c: 'started', d: 'started', e: 'started' }, wheres: { b: 'next is the proposal' }, ...over,
  });
  const r = decideRoadmap(facts());
  assert.deepEqual(r.lines, [
    say('roadmap-started', { id: 'a', open: 3, places: 5 }),
    say('roadmap-resumed', { id: 'b', where: 'next is the proposal', open: 4, places: 5 }),
    say('roadmap-gate-others', { id: 'a', gate: 'grill' }),
    say('roadmap-gate-others', { id: 'c', gate: 'approval' }),
    say('roadmap-blocked-others', { id: 'd', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }),
    say('roadmap-archived', { id: 'e' }),
    say('roadmap-skipped', { id: 'f' }),
    say('roadmap-held', { id: 'g', load: 92, limit: 80 }),
  ]);
  assert.deepEqual(r.state.starting, [], 'the started change is open now');
  assert.deepEqual(r.state.announced, { a: 'gate:grill', b: 'resumed', c: 'gate:approval', d: 'blocked:ceiling', e: 'archived', f: 'skipped' });
  assert.equal(r.state.held, true);
  // The same state at the next decision: no line. A stage change of b and a wait on GitHub of c are no event.
  const next = (over) => facts({ announced: r.state.announced, starting: r.state.starting, held: r.state.held, ...over });
  assert.deepEqual(decideRoadmap(next()).lines, []);
  const moved = decideRoadmap(next({ actions: { a: grillAct('a'), b: agentAct('b', 'specs'), c: githubAct('c'), d: blockedD } }));
  assert.deepEqual(moved.lines, []);
  // A new state of the same change is a new line.
  const worse = decideRoadmap(next({ actions: { a: grillAct('a'), b: blockedAct('b', 'no-progress', { stage: 'Proposal' }), c: ownerAct('c'), d: blockedD } }));
  assert.deepEqual(worse.lines, [say('roadmap-blocked', { id: 'b', why: 'no-progress', stage: 'Proposal' })]);
});

test('roadmap-loop decide: events speak the person\'s language', () => {
  const r = decideRoadmap(world({ lang: 'pt-BR', lines: ['[ ] a'], actions: { a: ownerAct('a') }, announced: { a: 'started' } }));
  assert.deepEqual(r.lines, [say('roadmap-gate', { id: 'a', gate: 'approval' }, 'pt-BR')]);
  assert.match(r.lines[0], /^▸ a espera a sua aprovação do plano\.$/);
});

// ---------------------------------------------------------------- decide: stopping, blocked, the end and --after

test('roadmap-loop decide: stopping hands no stage, starts nothing and waits for what is in flight', () => {
  const lines = ['[ ] a', '[ ] b', '[ ] c'];
  const r = decideRoadmap(world({ lines, stopping: true, actions: { a: agentAct('a'), c: agentAct('c', 'design') }, inflight: { c: FLYING } }));
  assert.deepEqual(r.actions, []);
  assert.equal(r.stopping, true);
  assert.equal(r.end, null, 'c is still finishing its stage');
  assert.equal(r.ask, null);
});

test('roadmap-loop decide: stopping ends E2 when nothing is in flight, waits ignored, with one stayed line per open change', () => {
  const lines = ['[ ] a', '[ ] b', '[ ] c', '[ ] d'];
  const wheres = { a: 'next is the proposal', b: 'waiting for you at the plan approval', c: 'waiting on GitHub' };
  const waiting = { kind: 'wait', stage: 'delivery', agentType: null, at: FLYING.at };
  const r = decideRoadmap(world({ lines, stopping: true, wheres, actions: { a: agentAct('a'), b: ownerAct('b'), c: githubAct('c') }, inflight: { c: waiting } }));
  assert.deepEqual(r.actions, []);
  assert.equal(r.end.why, 'stopped');
  assert.equal(r.end.reply, [render('en', 'roadmap-ended-stopped'), ...['a', 'b', 'c'].map((id) => render('en', 'roadmap-stayed', { id, where: wheres[id] }))].join('\n'));
  assert.deepEqual(r.open, ['a', 'b', 'c']);
  const alone = decideRoadmap(world({ lines: ['[ ] a'], stopping: true }));
  assert.equal(alone.end.why, 'stopped', 'nothing open at all: the stop is the end');
  assert.equal(alone.end.reply, render('en', 'roadmap-ended-stopped'));
});

test('roadmap-loop decide: a blocked change keeps its place, the others go on and its dependents wait', () => {
  const lines = ['[ ] a', '[ ] b', '[ ] c (after: a)', '[ ] d'];
  const actions = { a: blockedAct('a', 'ceiling', { stage: 'Plan readiness', attempt: 3 }), b: agentAct('b') };
  const wide = decideRoadmap(world({ lines, actions, places: 3 }));
  assert.deepEqual(changesOf(wide), [['b', 'agent'], ['d', 'start']], 'b goes on, d takes the free place, c waits for a');
  assert.equal(wide.lines.filter((l) => l.includes('stopped')).length, 1);
  const tight = decideRoadmap(world({ lines, actions, places: 2 }));
  assert.deepEqual(changesOf(tight), [['b', 'agent']], 'no new change takes the place of the blocked one');
  assert.deepEqual(tight.entries.map((e) => [e.id, e.state]), [['a', 'blocked'], ['b', 'agent']]);
});

test('roadmap-loop decide: end E1 every line archived ends done', () => {
  const r = decideRoadmap(world({ lines: ['[x] a', '[ ] b'], archived: ['a', 'b'] }));
  assert.deepEqual([r.end.why, r.end.reply, r.actions], ['done', render('en', 'roadmap-ended-done'), []]);
});

test('roadmap-loop decide: end E3 never comes while something is under way or a start is possible', () => {
  assert.equal(decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ownerAct('a') } })).end.why, 'stuck');
  assert.equal(decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a') }, places: 2 })).end, null, 'b can start');
  assert.equal(decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, inflight: { b: FLYING } })).end, null);
});

test('roadmap-loop decide: end E3 stuck lists each need: the owner\'s gate, the blocked reason and the change it waits for', () => {
  const r = decideRoadmap(world({
    lines: ['[ ] a', '[ ] b', '[ ] c (after: a)', '[ ] p', '[ ] d (after: p)', '[ ] e (after: zzz)'],
    actions: { a: ownerAct('a'), b: blockedAct('b', 'ceiling', { stage: 'Plan readiness', attempt: 3 }) },
    previous: ['p'], places: 2,
  }));
  const need = [
    render('en', 'need.owner', { id: 'a', gate: 'approval' }),
    render('en', 'need.blocked', { id: 'b', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }),
    render('en', 'need.after', { id: 'd', after: 'p' }),
    render('en', 'need.after', { id: 'e', after: 'zzz' }),
  ];
  assert.deepEqual([r.end.why, r.end.reply], ['stuck', render('en', 'roadmap-ended-stuck', { list: need.join('; ') })]);
  assert.deepEqual([r.ask.change, r.ask.kind], ['a', 'gate'], 'the run ends its own work and the first gate is still asked');
  assert.ok(!r.end.reply.includes('c,'), 'c waits for a, which is open: a\'s own need covers it');
  assert.ok(r.lines.includes(say('roadmap-skipped', { id: 'p' })));
});

test('roadmap-loop decide: after clears the stage in flight and passes its key, so a stage that changed nothing ends blocked', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/feat/requirements.md': `<!-- devkit-stage requirements result=passed attempt=1 commit=${c0} -->\n# requirements\n`,
  });
  commitAll(root, 'feat');
  const first = nextAction(root, 'feat', { env: cleanEnv, lang: 'en' });
  assert.equal(first.kind, 'agent');
  const inflight = { feat: { ...FLYING, stage: first.stage } };
  const kept = decideRoadmap(world({ lines: ['[ ] feat'], actions: { feat: first }, inflight }));
  assert.deepEqual([kept.actions, kept.state.clearInflight], [[], []], 'without --after the stage is still under way');
  for (const [key, why] of [[first.progressKey, 'no-progress'], [first.progressKey.replace(/@.*/, '@000000000000'), 'not-delivered']]) {
    const action = nextAction(root, 'feat', { env: cleanEnv, lang: 'en', after: key });
    assert.deepEqual([action.kind, action.end.state, action.end.why], ['end', 'blocked', why], 'K1 and K2 of change-loop');
    const r = decideRoadmap(world({ lines: ['[ ] feat'], actions: { feat: action }, inflight, after: { feat: key } }));
    assert.deepEqual(r.state.clearInflight, ['feat']);
    assert.deepEqual(r.actions, []);
    assert.ok(r.lines.some((l) => l.includes(render('en', `blocked-why.${why}`, action.params))), why);
  }
});

// ---------------------------------------------------------------- replies (D-12)

const BLOCKED_PARAMS = { id: 'x', stage: 'Code review', attempt: 3, error: 'timeout', number: 12, phase: 2, list: 'build', base: 'main', installed: '2.46.0', minimum: '2.50.0', verb: 'change', machine: 'avel', taken: 1, places: 1, tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d' };

test('roadmap-loop replies: a blocked line renders every blocked reason in both languages', () => {
  for (const lang of ['en', 'pt-BR']) {
    const codes = Object.keys(MESSAGES[lang]).filter((k) => k.startsWith('blocked-why.')).map((k) => k.slice('blocked-why.'.length));
    assert.ok(codes.includes('previous-script') && codes.includes('ceiling') && codes.includes('cannot-open'), `${lang}: the codes of the table`);
    for (const code of codes) {
      const reason = render(lang, `blocked-why.${code}`, BLOCKED_PARAMS);
      for (const key of ['roadmap-blocked', 'roadmap-blocked-others', 'need.blocked']) {
        const text = render(lang, key, { ...BLOCKED_PARAMS, why: code });
        assert.ok(text.includes(reason), `${lang} ${key} ${code}: ${text}`);
      }
    }
    assert.throws(() => render(lang, 'roadmap-blocked', { ...BLOCKED_PARAMS, why: 'small' }), LoopUsageError, 'a why. code is not a blocked reason');
    assert.throws(() => render(lang, 'roadmap-blocked-others', { ...BLOCKED_PARAMS, why: 'small' }), LoopUsageError);
    assert.throws(() => render(lang, 'need.blocked', { ...BLOCKED_PARAMS, why: 'small' }), LoopUsageError);
  }
});

test('roadmap-loop replies: every owner wait has a gate', () => {
  const expected = {
    'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge',
    'waiting-archive-merge': 'merge', 'waiting-pr-decision': 'decision', 'waiting-review-dispute': 'dispute',
    'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-mockup': 'mockup', 'waiting-budget': 'budget',
    'waiting-merge-test-branch': 'merge', 'waiting-merge-base': 'merge', 'waiting-archive-merges': 'merge', 'waiting-train': 'train',
    'waiting-pause': 'pause', 'waiting-owner-decision': 'decision',
  };
  const waits = Object.keys(MESSAGES.en).filter((k) => k.startsWith('waiting-') && k !== 'waiting-github' && k !== 'waiting-place');
  assert.deepEqual([...waits].sort(), Object.keys(expected).sort(), 'every waiting- key of the table is covered');
  for (const why of waits) {
    const code = gateOf(endAct('x', 'waiting-for-owner', why));
    assert.equal(code, expected[why], why);
    for (const lang of ['en', 'pt-BR']) assert.ok(MESSAGES[lang][`gate.${code}`], `${lang} has gate.${code}`);
  }
  assert.equal(gateOf(grillAct('x')), 'grill');
  assert.ok(MESSAGES.en['gate.grill'] && MESSAGES['pt-BR']['gate.grill']);
  assert.throws(() => gateOf(endAct('x', 'waiting-for-owner', 'waiting-something-new')), LoopUsageError);
  assert.throws(() => gateOf(endAct('x', 'waiting-on-github', 'waiting-github')), LoopUsageError, 'a GitHub wait is not a gate');
  assert.ok(MESSAGES.en['waiting-place'] && MESSAGES['pt-BR']['waiting-place'], 'the blocked end no-place has its reply key in both languages');
  assert.throws(() => gateOf(endAct('x', 'blocked', 'no-place')), LoopUsageError, 'waiting for a place is a blocked end, not a gate');
  assert.throws(() => gateOf(agentAct('x')), LoopUsageError);
});

// A committed `devkit` change `feat` with the plan files up to the tasks passed and a readiness that failed its third time.
function ceilingFixture() {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const head = (stage, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/feat/requirements.md': `${head('requirements')}# requirements\n`,
    'openspec/changes/feat/proposal.md': `${head('proposal')}# proposal\n`,
    'openspec/changes/feat/specs/s/spec.md': `${head('specs')}# specs\n`,
    'openspec/changes/feat/design.md': `${head('design')}# design\n`,
    'openspec/changes/feat/tasks.md': `${head('tasks')}# Tasks\n\n- [ ] 1.1 a\n`,
    'openspec/changes/feat/readiness.md': `${head('readiness', 'failed', 3)}# Readiness\n\n- Status: APPROVED\n`,
  });
  commitAll(root, 'feat');
  return root;
}

test('roadmap-loop decide: an end action carries the parameters of its reply', () => {
  const previous = gitRepo({ config: 'schema: devkit\n' });
  previousForms(previous);
  const p1 = nextAction(previous, 'old-lone-proposal', { env: cleanEnv, lang: 'en' });
  assert.equal(p1.params.id, 'old-lone-proposal');
  assert.equal(p1.params.why, 'previous-script');
  assert.deepEqual(p1.end, { state: 'blocked', why: 'previous-script' }, 'end keeps its two fields');
  const root = ceilingFixture();
  for (const lang of ['en', 'pt-BR']) {
    const l = nextAction(root, 'feat', { env: cleanEnv, lang });
    assert.deepEqual([l.end.state, l.end.why], ['blocked', 'ceiling']);
    assert.deepEqual([l.params.id, l.params.attempt], ['feat', 3]);
    assert.equal(typeof l.params.stage, 'string');
    const line = render(lang, 'roadmap-blocked', { ...l.params, why: l.end.why });
    assert.ok(line.includes(render(lang, 'blocked-why.ceiling', l.params)), `${lang}: ${line}`);
    assert.ok(line.includes('3'), `${lang} names the attempt`);
  }
});

// ---------------------------------------------------------------- status: the board (D-8)
const OLD = Array.from({ length: 9 }, (_, i) => `old-${i + 1}`);
// The board the owner approved (requirements.md, question 11), with its data: one change at the plan approval, one in phase 2 of 4
// of its implementation, one blocked by red tests, a ready change, a waiting one, nine archived and one of the previous script.
// Three rows read from the table, not from the example's hand-written words: the owner's gate is "a sua aprovação do plano" and the
// red tests "os testes da fase 1 falharam"; the load line and a free place go together (D-8: a start is held only when a place is
// free), so the example's "3 of 3" is "3 of 4" here and the ready change reads "segurada pela carga".
function ownerBoard(over = {}) {
  return world({
    lang: 'pt-BR', places: 4, load: 92, limit: 80,
    lines: [...OLD.map((id) => `[x] ${id}`), '[ ] stage-roles', '[ ] delivery-models', '[ ] jira-entry', '[ ] compozy-driver', '[ ] project-phases (after: roadmap-coordinator)', '[ ] conventions-trailer'],
    archived: OLD,
    actions: {
      'stage-roles': ownerAct('stage-roles'),
      'delivery-models': agentAct('delivery-models', 'implementation', { stageTitle: 'Implementação', step: 'implement', detail: { phase: 2 } }),
      'jira-entry': blockedAct('jira-entry', 'tests-red', { phase: 1 }),
    },
    previous: ['conventions-trailer'], phaseTotals: { 'delivery-models': 4 },
    ...over,
  });
}

test('roadmap-loop status: the board of the owner\'s approved example, line by line, in Brazilian Portuguese', () => {
  const row = rowAt('conventions-trailer'.length + 3);
  assert.equal(boardOf(ownerBoard()), [
    'Roadmap: 3 abertas de 4 · 2 na fila · 9 arquivadas',
    'Começos segurados: processador em 92% (limite 80%)',
    '',
    'Esperando você',
    row('stage-roles', 'a sua aprovação do plano'),
    'Em andamento',
    row('delivery-models', 'Implementação, fase 2 de 4'),
    'Travadas',
    row('jira-entry', 'os testes da fase 1 falharam'),
    'Na fila',
    row('compozy-driver', 'pronta, segurada pela carga'),
    row('project-phases', 'espera roadmap-coordinator'),
    'Fora do roadmap (o roadmap não toca)',
    row('conventions-trailer', 'começada no roteiro anterior'),
  ].join('\n'));
});

test('roadmap-loop status: the same board in English', () => {
  const row = rowAt('conventions-trailer'.length + 3);
  assert.equal(boardOf(ownerBoard({ lang: 'en' })), [
    'Roadmap: 3 open of 4 · 2 in the queue · 9 archived',
    'Starts held: processor at 92% (limit 80%)',
    '',
    'Waiting for you',
    row('stage-roles', 'your approval of the plan'),
    'Under way',
    row('delivery-models', 'Implementação, phase 2 of 4'),
    'Blocked',
    row('jira-entry', 'the tests of phase 1 failed'),
    'In the queue',
    row('compozy-driver', 'ready, held by the load'),
    row('project-phases', 'waits for roadmap-coordinator'),
    'Outside the roadmap (the roadmap does not touch them)',
    row('conventions-trailer', 'began under the previous script'),
  ].join('\n'));
});

test('roadmap-loop status: the board keeps its ids aligned and prints a block only when it has a row', () => {
  const text = boardOf(world({ lines: ['[x] z', '[ ] a-long-id', '[ ] b'], archived: ['z'], actions: { 'a-long-id': agentAct('a-long-id'), b: githubAct('b', 'checks') } }));
  const rows = text.split('\n').filter((l) => l.startsWith('  '));
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((r) => /^ {2}\S+ +/.exec(r)[0].length)), new Set(['a-long-id'.length + 3 + 2]), 'the texts start in one column');
  assert.doesNotMatch(text, /Waiting for you|Blocked|In the queue|Outside the roadmap/);
  assert.match(text, /^Roadmap: 2 open of 3 · 0 in the queue · 1 archived\n\nUnder way\n/);
  assert.match(rows[0], /Proposal$/);
  assert.match(rows[1], /waiting on GitHub \(the checks of the pull request\)$/);
});

test('roadmap-loop status: the load line only appears while a start is held', () => {
  const lines = ['[ ] a', '[ ] b'];
  assert.doesNotMatch(boardOf(world({ lines, load: 30 })), /Starts held/, 'a low load');
  assert.equal(boardOf(world({ lines, load: 90 })), [
    'Roadmap: 0 open of 3 · 2 in the queue · 0 archived', 'Starts held: processor at 90% (limit 80%)', '',
    'In the queue', '  a   ready, held by the load', '  b   ready, held by the load',
  ].join('\n'));
  const full = boardOf(world({ lines, load: 90, places: 1, actions: { a: agentAct('a') } }));
  assert.doesNotMatch(full, /Starts held/, 'no place is free: the load is not what holds b');
  assert.match(full, /b {3}ready, waits for a place$/);
});

test('roadmap-loop status: the outside block lists a ticked line, an unticked archived line and a change not on the roadmap', () => {
  const text = boardOf(world({
    lines: ['[x] t', '[ ] u', '[ ] r'], archived: ['u'], unfinished: [{ id: 'other-work', where: 'next is the proposal' }, { id: 'r', where: 'x' }],
  }));
  const all = text.split('\n');
  const rows = all.slice(all.indexOf('Outside the roadmap (the roadmap does not touch them)') + 1);
  assert.deepEqual(rows.map((r) => r.trim().replace(/\s+/g, ' ')), [
    't ticked on the roadmap but not archived', 'u archived, its line not ticked yet', 'other-work not on the roadmap: next is the proposal',
  ]);
  assert.match(text, /^Roadmap: 0 open of 3 · 1 in the queue · 1 archived\n/, 'u counts as archived, r is in the queue');
});

test('roadmap-loop status: no roadmap lists the unfinished changes, or says there are none', () => {
  const none = { lang: 'en', hasRoadmap: false, unfinished: [] };
  assert.equal(boardOf(none), render('en', 'status-nothing'));
  assert.equal(boardOf({ ...none, lang: 'pt-BR' }), render('pt-BR', 'status-nothing'));
  const some = boardOf({ ...none, unfinished: [{ id: 'a', where: 'next is the proposal' }, { id: 'longer-id', where: 'waiting on GitHub' }] });
  assert.equal(some, [render('en', 'status-no-roadmap'), `  ${'a'.padEnd(12)}next is the proposal`, `  ${'longer-id'.padEnd(12)}waiting on GitHub`].join('\n'));
});

// ---------------------------------------------------------------- the draft (D-9)

test('roadmap-loop draft: the text is one round with an unticked line per change, in each language', () => {
  assert.equal(draftText('en', ['a', 'b']), '# Roadmap\n\n## Round 1: unfinished changes\n\n- [ ] a\n- [ ] b\n');
  assert.equal(draftText('pt-BR', ['a']), '# Roadmap\n\n## Rodada 1: changes por terminar\n\n- [ ] a\n');
  assert.equal(draftText('en', []), '# Roadmap\n\n## Round 1: unfinished changes\n');
  const rounds = parseRoadmap(draftText('en', ['a', 'b']));
  assert.deepEqual(rounds.flatMap((r) => r.items).map((i) => [i.id, i.done, i.after]), [['a', false, []], ['b', false, []]]);
});

// ================================================================ phase 2: the commands, the run file and the open lock
const titleEn = (stage) => FLOWS.devkit.stages.find((s) => s.id === stage).title.en;
// The mark of a watch of the load that runs: this process (design roadmap-coordinator-followups D-7).
const WATCH = { pid: process.pid, at: '2026-11-21T10:00:00.000Z' };

test('roadmap-loop start: roadmap and status are routed', () => {
  const root = projectWith(null);
  const startRun = (cwd, text, lang = 'en') => changeMain(['start', '--lang', lang], { cwd, env: cleanEnv, stdin: text, gh: OFFLINE });
  const before = picture(root);
  for (const [text, mode, rest] of [['roadmap', 'roadmap', ''], ['ROADMAP 3', 'roadmap', '3'], ['roadmap  stop ', 'roadmap', 'stop'], ['status', 'status', ''], ['Status now', 'status', 'now']]) {
    const r = startRun(root, text);
    assert.equal(r.code, 0, text);
    const b = JSON.parse(r.stdout);
    assert.deepEqual([b.mode, b.verb, b.text, b.change], [mode, mode, rest, null], text);
    assert.equal(b.reply, undefined, 'no reply: the skill calls roadmap-loop');
  }
  // After the project gate, as for the change verb.
  for (const config of ['schema: spec-driven\n', 'schema: devkit\ndevkit:\n  driver: robot\n', 'schema: devkit\ndevkit:\n  driver: script\n']) {
    const cwd = gitRepo({ config });
    const asked = JSON.parse(startRun(cwd, 'change add a thing').stdout);
    for (const verb of ['roadmap', 'status']) {
      const b = JSON.parse(startRun(cwd, verb).stdout);
      assert.deepEqual([b.mode, b.reply], [asked.mode, asked.reply], `${verb} in ${config}`);
    }
  }
  // The compozy driver passes the gate for both verbs: the modes are the Claude driver's, with the driver named for the skill (compozy-driver D-1, D-7).
  const onCompozy = gitRepo({ config: 'schema: devkit\ndevkit:\n  driver: compozy\n' });
  for (const verb of ['roadmap', 'status']) {
    const b = JSON.parse(startRun(onCompozy, verb).stdout);
    assert.deepEqual([b.mode, b.verb, b.settings.driver, b.reply], [verb, verb, 'compozy', undefined], `${verb} on compozy`);
  }
  // The verbs of later rounds keep their round; an unknown verb names the three commands that exist.
  for (const [verb, round] of [['help', 23]]) assert.equal(JSON.parse(startRun(root, verb).stdout).reply, render('en', 'verb-not-built', { verb, round }));
  assert.notEqual(JSON.parse(startRun(root, 'project').stdout).mode, 'not-built', 'project leaves the not-built row');
  assert.match(render('en', 'verb-unknown'), /\/devkit change.*\/devkit roadmap.*\/devkit status.*\/devkit project/);
  assert.match(render('pt-BR', 'verb-unknown'), /^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit project e \/devkit train/);
  assert.equal(JSON.parse(startRun(root, 'frobnicate', 'pt-BR').stdout).reply, render('pt-BR', 'verb-unknown'));
  assert.equal(picture(root), before, 'start creates nothing');
});

// ---------------------------------------------------------------- run (D-9 U1 to U5)

test('roadmap-loop run: U1 a word, 0, -1, 1.5 or a hundred is refused with nothing written and no marker', () => {
  const root = projectWith(roadmapText('[ ] a'));
  for (const word of ['many', '0', '-1', '1.5', '100', '2 3']) {
    const r = doRun(root, word);
    assert.deepEqual([r.code, r.stdout], [0, `${render('en', 'roadmap-invalid', { word })}\n`], word);
    assert.equal(existsSync(runFileOf(root)), false, word);
  }
});

test('roadmap-loop run: U2 without a roadmap it offers a draft, writes nothing and prints no marker', () => {
  const root = projectWith(null);
  for (const word of ['', '2', 'stop']) {
    const r = doRun(root, word);
    assert.deepEqual([r.code, r.stdout], [0, `${render('en', 'roadmap-none')}\n`], word);
    assert.equal(existsSync(runFileOf(root)), false, word);
  }
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('roadmap-loop run: U3 stop sets stopping and says where each change stays', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b', '[ ] c'));
  addOpen(root, 'a');
  addOpen(root, 'b');
  doRun(root, '2');
  putRun(root, { session: 'S1', places: 2, inflight: { a: inFlight('proposal') }, announced: { a: 'resumed', b: 'resumed' } });
  const r = doRun(root, 'STOP');
  assert.equal(r.code, 0);
  const lines = r.stdout.split('\n');
  assert.deepEqual(lines.slice(0, 4), [
    'devkit-roadmap: stop',
    render('en', 'roadmap-stopping'),
    render('en', 'roadmap-stayed', { id: 'a', where: render('en', 'where.finishing', { stage: titleEn('proposal') }) }),
    render('en', 'roadmap-stayed', { id: 'b', where: render('en', 'where.next', { stage: titleEn('requirements') }) }),
  ]);
  const body = jsonOf(r.stdout);
  assert.deepEqual([body.stopping, body.actions, body.end], [true, [], null], 'nothing new is handed and a is still in flight');
  assert.equal(stateOf(root).stopping, true);
  assert.deepEqual(Object.keys(stateOf(root).inflight), ['a'], 'stopping interrupts nothing');
  assert.match(lines[2], /finishing the proposal\.$/);
});

test('roadmap-loop run: U4 the same session keeps what is under way and changes the number; another session or --fresh starts from empty', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b', '[ ] c'));
  addOpen(root, 'a');
  doRun(root, '2');
  assert.deepEqual([stateOf(root).session, stateOf(root).places], ['S1', 2]);
  const under = {
    tickets: { a: { ticket: '0123456789abcdef', at: '2026-11-21T10:00:00.000Z', claimedBy: 'S-a' } }, occupied: { a: { at: '2026-11-21T10:00:00.000Z' } },
    queued: { b: { at: '2026-11-21T10:00:00.000Z', why: 'place' } }, waits: { a: [{ pid: process.pid, kind: 'session', at: '2026-11-21T10:00:00.000Z', session: 'S-a' }] },
  };
  const check = { id: 'job-1', at: '2026-11-21T10:00:00.000Z' };
  putRun(root, {
    session: 'S1', places: 2, stopping: true, held: true, holding: WATCH, inflight: { a: inFlight() }, announced: { a: 'resumed' },
    declared: { c: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } }, ...under, check,
  });
  const again = doRun(root, '3');
  assert.equal(again.stdout.split('\n')[0], 'devkit-roadmap: 3');
  assert.ok(events(again.stdout).includes(`▸ ${render('en', 'roadmap-places', { places: 3, open: 1 })}`), 'the number changed: said once');
  assert.ok(!events(again.stdout).some((l) => l.includes('Resumed a')), 'a was announced before: not again');
  const kept = stateOf(root);
  assert.deepEqual([kept.places, kept.stopping, kept.declared, kept.holding, Object.keys(kept.inflight)], [3, false, {}, WATCH, ['a']]);
  assert.deepEqual(jsonOf(again.stdout).actions.map((x) => [x.change, x.kind]), [['b', 'start'], ['c', 'start']], 'a stays in flight; the cleared declared change is handed again');
  assert.ok(!events(doRun(root, '3').stdout).some((l) => l.includes('changes at once')), 'the same number says nothing');
  assert.deepEqual([stateOf(root).tickets, stateOf(root).occupied, stateOf(root).queued, stateOf(root).waits, stateOf(root).check], [under.tickets, under.occupied, under.queued, under.waits, check], 'the same session keeps them all');

  const other = doRun(root, '2', { session: 'S2' });
  assert.ok(!events(other.stdout).some((l) => l.includes('changes at once')));
  assert.deepEqual([stateOf(root).session, stateOf(root).places, stateOf(root).inflight, stateOf(root).holding], ['S2', 2, {}, null]);
  const survived = stateOf(root);
  assert.deepEqual([survived.tickets, survived.occupied, survived.queued, survived.waits], [under.tickets, under.occupied, under.queued, under.waits], 'another session keeps what outlives the one that started it');
  assert.equal(survived.check, null, 'a session cron dies with its session');
  putRun(root, { session: 'S2', places: 2, inflight: { a: inFlight() }, holding: WATCH, ...under, check });
  doRun(root, '2', { session: 'S2', extra: ['--fresh'] });
  assert.deepEqual([stateOf(root).inflight, stateOf(root).holding], [{}, null], '--fresh starts from empty in the same session');
  assert.deepEqual([stateOf(root).tickets, stateOf(root).occupied, stateOf(root).queued, stateOf(root).waits, stateOf(root).check], [{}, {}, {}, {}, null], '--fresh empties them');
});

// ---------------------------------------------------------------- the run file (D-5)

test('roadmap-loop run file: its path is in the git common directory, shared by two worktrees', () => {
  const root = projectWith(roadmapText('[ ] a'));
  const side = join(root, '.claude', 'worktrees', 'side');
  git(root, 'worktree', 'add', '-q', '-b', 'side', side);
  const file = runFileOf(root);
  assert.equal(realpathSync(dirname(dirname(runFileOf(side)))), realpathSync(dirname(dirname(file))), 'both name the one .git directory');
  assert.equal(runFileOf(side), file);
  assert.match(file, /[\\/]\.git[\\/]devkit[\\/]roadmap-run\.json$/);
  doRun(root, '3');
  assert.match(doStatus(side).stdout, /^Roadmap: 0 open of 3 ·/);
  assert.equal(git(root, 'status', '--porcelain').includes('roadmap-run'), false, 'no commit ever holds it');
});

test('roadmap-loop run file: a missing or broken file reads as an empty run with one place', () => {
  const root = projectWith(roadmapText('[ ] a'));
  assert.match(doStatus(root).stdout, /^Roadmap: 0 open of 1 ·/);
  assert.equal(existsSync(runFileOf(root)), false, 'status wrote nothing');
  mkdirSync(dirname(runFileOf(root)), { recursive: true });
  for (const broken of ['{not json', '[]', 'null', '{"places":"many","inflight":3}']) {
    writeFileSync(runFileOf(root), broken);
    assert.match(doStatus(root).stdout, /^Roadmap: 0 open of 1 ·/, broken);
    const r = doNext(root);
    assert.equal(r.code, 0, broken);
    assert.equal(r.stdout.split('\n')[0], 'devkit-roadmap: 1', broken);
    assert.equal(stateOf(root).places, 1, `${broken}: next rewrote a valid file`);
  }
});

test('roadmap-loop run file: two writers at once both land under the lock', async () => {
  const root = projectWith(null);
  const file = runFileOf(root);
  const script = `import { updateRun } from ${JSON.stringify(pathToFileURL(LOOP_FILE).href)};
const [file, id] = process.argv.slice(1);
for (let i = 0; i < 5; i++) updateRun(file, (run) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25); run.inflight[id + i] = { kind: 'agent' }; });`;
  const writer = (id) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, file, id], { stdio: 'ignore' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`writer ${id} exited ${code}`))));
  });
  await Promise.all([writer('x'), writer('y')]);
  assert.equal(Object.keys(loopModule.readRun(file).inflight).length, 10, 'no update was lost');
  assert.deepEqual(readdirSync(dirname(file)), ['roadmap-run.json'], 'the lock and the temporary file are gone');
});

test('roadmap-loop run file: a lock older than a minute is taken over', () => {
  const root = projectWith(null);
  const file = runFileOf(root);
  mkdirSync(dirname(file), { recursive: true });
  const lock = join(dirname(file), 'roadmap-run.lock');
  writeFileSync(lock, '');
  const old = new Date(Date.now() - 120_000);
  utimesSync(lock, old, old);
  loopModule.updateRun(file, (run) => { run.places = 4; });
  assert.equal(stateOf(root).places, 4);
  assert.equal(existsSync(lock), false);
});

// ---------------------------------------------------------------- next (D-7)

test('roadmap-loop next: prints the run line, then the decision, and writes the run file fields', () => {
  const root = projectWith(roadmapText('[ ] a - first\n  with notes', '[ ] b', '[ ] c (after: a)'));
  putRun(root, { session: 'S1', places: 2 });
  const r = doNext(root);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.split('\n')[0], 'devkit-roadmap: 2');
  const body = jsonOf(r.stdout);
  assert.deepEqual([body.version, body.places, body.open, body.stopping, body.lines, body.ask, body.end], [1, 2, [], false, [], null, null]);
  assert.deepEqual(body.actions.map((x) => [x.change, x.kind, x.request, x.progressKey]), [['a', 'start', 'first\nwith notes', 'start'], ['b', 'start', 'b', 'start']]);
  const state = stateOf(root);
  assert.deepEqual([state.starting, state.held, state.asking, state.announced, state.places, state.session], [['a', 'b'], false, null, {}, 2, 'S1']);

  addOpen(root, 'a');
  putRun(root, { session: 'S1', places: 1, inflight: { a: inFlight() } });
  const after = doNext(root, ['--after', 'a=proposal/old@abc']);
  assert.deepEqual(Object.keys(stateOf(root).inflight), [], '--after clears the entry of that change');
  const asked = jsonOf(after.stdout);
  assert.deepEqual([asked.ask.change, asked.ask.kind, stateOf(root).asking], ['a', 'grill', 'a']);

  putRun(root, { session: 'S1', places: 1, stopping: true });
  assert.equal(doNext(root).stdout.split('\n')[0], 'devkit-roadmap: stop');
});

test('roadmap-loop next: a usage error exits 3 with the form of change-loop and writes nothing', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { session: 'S1', places: 2 });
  const before = readFileSync(runFileOf(root), 'utf8');
  for (const extra of [['--bogus'], ['--after', 'no-equals'], ['--after']]) {
    const r = doNext(root, extra);
    assert.equal(r.code, 3, extra.join(' '));
    const body = JSON.parse(r.stdout);
    assert.deepEqual([body.version, body.reply], [1, render('en', 'request-unreadable')]);
    assert.ok(body.error.length > 0);
  }
  assert.equal(cmd(root, ['teleport', ...FLAGS]).code, 3);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), before);
});

test('roadmap-loop resume: killed between next and open, no change is opened twice', () => {
  const root = projectWith(roadmapText('[ ] alpha', '[ ] beta'));
  putRun(root, { session: 'S1', places: 1 });
  const startsOf = (r) => jsonOf(r.stdout).actions.map((x) => [x.change, x.kind]);
  assert.deepEqual(startsOf(doNext(root)), [['alpha', 'start']]);
  assert.deepEqual(startsOf(doNext(root)), [['alpha', 'start']], 'killed before open: the same start comes once more, no other');
  assert.deepEqual(stateOf(root).starting, ['alpha']);
  const open = () => changeMain(['open', 'alpha', '--script', 'devkit', '--why', 'doubt', '--lang', 'en'], { cwd: root, env: cleanEnv, stdin: 'alpha' });
  assert.equal(open().code, 0);
  const next = doNext(root);
  assert.deepEqual(startsOf(next), [], 'alpha is open now: no start, and beta has no place');
  assert.deepEqual(events(next.stdout), [
    `▸ ${render('en', 'roadmap-started', { id: 'alpha', open: 1, places: 1 })}`,
    `▸ ${render('en', 'roadmap-gate', { id: 'alpha', gate: 'grill' })}`,
  ]);
  assert.deepEqual(jsonOf(next.stdout).ask.change, 'alpha');
  assert.deepEqual(events(doNext(root).stdout), [], 'said once');
  assert.equal(open().code, 3, 'opening it again is refused');
  assert.equal(git(root, 'worktree', 'list').split('\n').length, 2);
  assert.equal(stateOf(root).starting.length, 0);
});

// ---------------------------------------------------------------- status (D-8)

test('roadmap-loop status: nothing written', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b (after: a)'));
  addOpen(root, 'a');
  doRun(root, '2');
  const raw = readFileSync(runFileOf(root), 'utf8');
  const before = picture(root);
  const r = doStatus(root);
  assert.equal(r.code, 0);
  assert.ok(!r.stdout.includes('devkit-roadmap:'), 'no marker');
  assert.match(r.stdout, /^Roadmap: 1 open of 2 · 1 in the queue · 0 archived\n/);
  assert.match(r.stdout, /Waiting for you\n {2}a {3}your answers about its request/);
  assert.match(r.stdout, /In the queue\n {2}b {3}waits for a/);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, 'the run file is as it was');
  assert.equal(picture(root), before);
  const fresh = projectWith(null);
  const none = doStatus(fresh);
  assert.equal(none.stdout.trim(), render('en', 'status-nothing'));
  assert.equal(existsSync(runFileOf(fresh)), false);
});

test('roadmap-loop status: the load line shows while a ready change has a free place and the machine is loaded', () => {
  const root = projectWith(roadmapText('[ ] a'));
  assert.match(doStatus(root, { load: 92 }).stdout, /^Roadmap: .*\nStarts held: processor at 92% \(limit 80%\)\n/);
  assert.ok(!doStatus(root, { load: 40 }).stdout.includes('Starts held'));
});

// ---------------------------------------------------------------- the changes left alone (D-4, AC-11)

const FORMS = ['old-lone-proposal', 'old-headerless-plan', 'old-plan-headed-later', 'old-lite-form', 'old-headerless-requirements', 'old-specs-only'];
function leftAlone() {
  const root = gitRepo({ config: 'schema: devkit\n' });
  previousForms(root);
  put(root, { 'openspec/roadmap.md': roadmapText(...FORMS.map((id) => `[ ] ${id}`), '[ ] new-headed-requirements', '[ ] after-old (after: old-lone-proposal)') });
  commitAll(root, 'roadmap');
  putRun(root, { session: 'S1', places: 3 });
  return root;
}

test('roadmap-loop next: changes left alone', () => {
  const root = leftAlone();
  const r = doNext(root);
  assert.equal(r.code, 0);
  const body = jsonOf(r.stdout);
  assert.deepEqual(body.actions.map((x) => [x.change, x.kind]), [['new-headed-requirements', 'agent']], 'P1 to P6 get no action; Q1 is open on the current script; after-old waits');
  assert.deepEqual(body.open, ['new-headed-requirements'], 'only Q1 fills a place');
  assert.equal(body.ask, null);
  assert.equal(body.end, null);
  const lines = events(r.stdout);
  assert.equal(lines.length, 7);
  assert.match(lines[0], /^▸ Resumed new-headed-requirements, which was already open: .* \(1 of 3 under way\)\.$/);
  assert.deepEqual(lines.slice(1), FORMS.map((id) => `▸ ${render('en', 'roadmap-skipped', { id })}`), 'one line each, in roadmap order');
  assert.ok(!r.stdout.includes('other-work') && !r.stdout.includes('after-old'), 'a change that is not on the roadmap is not touched, and a waiting line is silent');
  assert.deepEqual(events(doNext(root).stdout), [], 'said once per run');
  assert.deepEqual(Object.entries(stateOf(root).announced).filter(([, key]) => key === 'skipped').map(([id]) => id), FORMS);
});

test('roadmap-loop status: changes left alone', () => {
  const root = leftAlone();
  doNext(root);
  const raw = readFileSync(runFileOf(root), 'utf8');
  const r = doStatus(root);
  assert.match(r.stdout, /^Roadmap: 1 open of 3 · 1 in the queue · 0 archived\n/);
  const rows = (heading) => {
    const all = r.stdout.split('\n');
    const from = all.indexOf(heading) + 1;
    const to = all.findIndex((l, i) => i >= from && !l.startsWith('  '));
    return all.slice(from, to === -1 ? undefined : to).map((l) => l.trim().replace(/\s+/g, ' '));
  };
  assert.deepEqual(rows('In the queue'), ['after-old waits for old-lone-proposal']);
  const outside = rows('Outside the roadmap (the roadmap does not touch them)');
  assert.deepEqual(outside.slice(0, 6), FORMS.map((id) => `${id} began under the previous script`));
  assert.match(outside[6], /^new-specs-mixed not on the roadmap: .+/, 'Q2 is current and not on this roadmap');
  assert.match(outside[7], /^other-work not on the roadmap: .+/);
  assert.equal(outside.length, 8);
  assert.deepEqual(rows('Under way'), ['new-headed-requirements Proposal']);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw);
});

// ---------------------------------------------------------------- draft (D-9)

test('roadmap-loop draft: the unfinished changes of the current script, the previous ones named and left out, nothing committed', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  previousForms(root);
  const commits = git(root, 'rev-list', '--count', 'HEAD');
  const r = cmd(root, ['draft', ...FLAGS]);
  assert.equal(r.code, 0);
  const file = join(root, 'openspec', 'roadmap.md');
  assert.equal(readFileSync(file, 'utf8'), draftText('en', ['new-headed-requirements', 'new-specs-mixed', 'other-work']));
  assert.equal(r.stdout, `${render('en', 'roadmap-drafted', { list: 'new-headed-requirements, new-specs-mixed, other-work' })}\n${render('en', 'roadmap-drafted-left', { list: FORMS.slice().sort().join(', ') })}\n`);
  assert.equal(git(root, 'status', '--porcelain', '--', 'openspec/roadmap.md'), '?? openspec/roadmap.md');
  assert.equal(git(root, 'rev-list', '--count', 'HEAD'), commits, 'nothing is committed');
  assert.equal(existsSync(runFileOf(root)), false, 'nothing is started');
  // An existing file is never overwritten.
  const written = readFileSync(file, 'utf8');
  writeFileSync(file, `${written}- [ ] mine\n`);
  const second = cmd(root, ['draft', ...FLAGS]);
  assert.equal(second.code, 3);
  assert.equal(readFileSync(file, 'utf8'), `${written}- [ ] mine\n`);
});

test('roadmap-loop draft: no unfinished change gives an empty draft, and a pt-BR project gets the round title in pt-BR', () => {
  const empty = projectWith(null);
  const r = cmd(empty, ['draft', ...FLAGS]);
  assert.equal(r.stdout, `${render('en', 'roadmap-drafted-empty')}\n`);
  assert.equal(readFileSync(join(empty, 'openspec', 'roadmap.md'), 'utf8'), draftText('en', []));
  const pt = gitRepo({ config: 'schema: devkit\ndevkit:\n  language: pt-BR\n' });
  put(pt, { 'openspec/changes/one/.openspec.yaml': 'schema: devkit\n' });
  commitAll(pt, 'one');
  const p = cmd(pt, ['draft', '--lang', 'pt-BR', '--load-limit', '80']);
  assert.equal(p.stdout, `${render('pt-BR', 'roadmap-drafted', { list: 'one' })}\n`);
  assert.equal(readFileSync(join(pt, 'openspec', 'roadmap.md'), 'utf8'), '# Roadmap\n\n## Rodada 1: changes por terminar\n\n- [ ] one\n');
});

// ---------------------------------------------------------------- wait and hold (D-6, D-7)

test('roadmap-loop wait: the change is in flight while it waits, cleared at its end and on error, and its action printed', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { session: 'S1', places: 1 });
  const args = ['wait', '--change', 'a', ...FLAGS, '--interval', '5'];
  const seen = [];
  const real = makeOpenspec(root, cleanEnv);
  const spy = (a) => { seen.push(stateOf(root).inflight.a?.kind ?? null); return real(a); };
  const r = await loopModule.runCommand(args, { cwd: root, env: cleanEnv, gh: OFFLINE, openspec: spy, sleep: async () => {} });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(seen.length > 0 && seen.every((k) => k === 'wait'), `in flight at every read: ${seen}`);
  assert.deepEqual(stateOf(root).inflight, {});
  const action = JSON.parse(r.stdout);
  assert.deepEqual([action.change, action.kind], ['a', 'grill']);
  const boom = await loopModule.runCommand(args, { cwd: root, env: cleanEnv, gh: OFFLINE, openspec: () => { throw new Error('boom'); }, sleep: async () => {} });
  assert.equal(boom.code, 3);
  assert.deepEqual(stateOf(root).inflight, {}, 'cleared on error');
});

test('roadmap-loop hold: polls the load, exits below the limit or on stop, and sets and clears holding', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { session: 'S1', places: 1 });
  const args = ['hold', ...FLAGS, '--interval', '5'];
  const holdingAt = [];
  const sleeps = [];
  const sleep = (stop = false) => async (s) => {
    sleeps.push(s);
    holdingAt.push(stateOf(root).holding?.pid ?? null);
    if (stop && sleeps.length === 2) loopModule.updateRun(runFileOf(root), (run) => { run.stopping = true; });
  };
  const loads = [95, 90, 70];
  const below = await loopModule.runCommand(args, { cwd: root, env: cleanEnv, load: () => loads.shift(), sleep: sleep() });
  assert.equal(below.code, 0);
  assert.deepEqual(JSON.parse(below.stdout), { load: 70, limit: 80 });
  assert.deepEqual([sleeps, holdingAt, stateOf(root).holding], [[5, 5, 5], [process.pid, process.pid, process.pid], null]);

  sleeps.length = 0;
  holdingAt.length = 0;
  const stopped = await loopModule.runCommand(args, { cwd: root, env: cleanEnv, load: () => 99, sleep: sleep(true) });
  assert.equal(stopped.code, 0);
  assert.deepEqual([sleeps.length, stateOf(root).holding], [2, null], 'a stop ends the hold with the load still high');

  const broken = await loopModule.runCommand(args, { cwd: root, env: cleanEnv, load: () => { throw new Error('no load'); }, sleep: async () => {} });
  assert.deepEqual([broken.code, stateOf(root).holding], [3, null], 'cleared on error');

  const raw = readFileSync(runFileOf(root), 'utf8');
  for (const interval of ['4', '0', 'x']) {
    const bad = await loopModule.runCommand(['hold', ...FLAGS, '--interval', interval], { cwd: root, env: cleanEnv, load: () => 1, sleep: async () => {} });
    assert.equal(bad.code, 3, interval);
  }
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw);
});

// ---------------------------------------------------------------- reply (D-12)

test('roadmap-loop reply: an end key records declared and prints the end line first; the draft-declined key prints the reply alone', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  putRun(root, { session: 'S1', places: 2, inflight: { a: inFlight() } });
  const blocked = cmd(root, ['reply', 'blocked', ...FLAGS, '--param', 'id=a', '--param', 'why=cannot-open', '--param', 'error=taken']);
  assert.equal(blocked.code, 0);
  assert.equal(blocked.stdout, `devkit-end: a blocked\n${render('en', 'blocked', { id: 'a', why: 'cannot-open', error: 'taken' })}\n`);
  assert.deepEqual(stateOf(root).declared.a, { state: 'blocked', why: 'cannot-open', params: { error: 'taken' } });
  assert.deepEqual(stateOf(root).inflight, {}, 'a declared end clears the change');

  const decision = cmd(root, ['reply', 'waiting-pr-decision', ...FLAGS, '--param', 'id=b', '--param', 'url=https://example.test/pr/1']);
  assert.equal(decision.stdout.split('\n')[0], 'devkit-end: b waiting-for-owner');
  assert.deepEqual(stateOf(root).declared.b, { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: { url: 'https://example.test/pr/1', gate: 'decision' } });

  const raw = readFileSync(runFileOf(root), 'utf8');
  const declined = cmd(root, ['reply', 'roadmap-draft-declined', ...FLAGS]);
  assert.deepEqual([declined.code, declined.stdout], [0, `${render('en', 'roadmap-draft-declined')}\n`]);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw);
  assert.equal(cmd(root, ['reply', 'blocked', ...FLAGS, '--param', 'why=cannot-open', '--param', 'error=x']).code, 3, 'an end key needs the id');
  assert.equal(cmd(root, ['reply', 'no-such-key', ...FLAGS]).code, 3);
});

// ================================================================ phase 3: the locks of a roadmap run (design D-11)
const lkBlob = (text) => lkStored({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text }] } });
// The first line of a subagent's own transcript: its prompt (a sidechain line, content a string).
const lkAgentTranscript = (prompt) => {
  const file = join(lkSandbox(), 'agent-0001.jsonl');
  writeFileSync(file, `${lkStored({ type: 'user', isSidechain: true, agentId: 'agent-0001', message: { role: 'user', content: prompt } })}\n${lkAssistant()}\n`);
  return file;
};
const lkGone = () => join(lkSandbox(), 'gone.jsonl');
const lkSubInput = (root, transcript, agentType, prompt, extra = {}) => lkBase(root, transcript, {
  hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'agent-0001', agent_type: agentType, agent_transcript_path: lkAgentTranscript(prompt),
  last_assistant_message: 'done', background_tasks: RUNNING, session_crons: [], ...extra,
});
const READINESS_TYPE = 'devkit-core:plan-readiness-reviewer';
const flying = (agentType = PLANNER_TYPE, stage = 'proposal') => ({ kind: 'agent', stage, agentType, at: '2026-11-21T10:00:00.000Z' });
const progressOf = (root, id) => nextAction(root, id, { env: cleanEnv, lang: 'en', gh: OFFLINE }).progressKey;

// ---------------------------------------------------------------- the run, read from the transcript (D-11 "Knowing the run")

const runOfLines = (...lines) => guardModule.roadmapRunOf({ transcript_path: lkTranscript(lines) });

test('roadmap-loop lock run: the typed command and the printed line make a run, its command and whether it is stopping', () => {
  assert.deepEqual(runOfLines(lkTyped('roadmap 3'), lkSkillBody('roadmap 3'), lkAssistant(), lkMarker(3)), { command: 'roadmap 3', stopping: false });
  assert.deepEqual(runOfLines(lkTyped('roadmap'), lkMarker(1)), { command: 'roadmap', stopping: false });
  assert.deepEqual(runOfLines(lkTyped('roadmap  2 '), lkMarker(2)), { command: 'roadmap 2', stopping: false });
  assert.deepEqual(runOfLines(lkTyped('roadmap stop'), lkMarker('stop')), { command: 'roadmap stop', stopping: true });
  assert.equal(runOfLines(lkTyped('roadmap stop'), lkMarker('stop'), lkAssistant(), lkMarker(2))?.stopping, false, 'the newest line wins');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkMarker('stop'))?.stopping, true);
  for (const form of ['both', 'stdout', 'blocks']) assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2, form))?.command, 'roadmap 2', form);
});

test('roadmap-loop lock run: the plugin-scoped command and a first line in plain text are runs too', () => {
  assert.equal(runOfLines(lkTyped('roadmap 2', '/devkit-openspec:devkit'), lkMarker(2))?.command, 'roadmap 2');
  assert.equal(runOfLines(lkPlain('/devkit roadmap 4\nsecond line'), lkMarker(4))?.command, 'roadmap 4');
});

test('roadmap-loop lock run: no run without the command, its printed line, or a readable transcript', () => {
  assert.equal(guardModule.roadmapRunOf({}), null);
  assert.equal(guardModule.roadmapRunOf({ transcript_path: lkGone() }), null);
  assert.equal(guardModule.roadmapRunOf({ transcript_path: lkSandbox() }), null, 'a folder');
  assert.equal(runOfLines(lkAssistant()), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkSkillBody(), lkAssistant()), null, 'no printed line');
  assert.equal(runOfLines(lkMarker(2), lkTyped('roadmap 2')), null, 'a line before the command is not after it');
  assert.equal(runOfLines(lkTyped('change x'), lkMarker(2)), null, 'another verb');
  assert.equal(runOfLines(lkTyped(''), lkMarker(2)), null, 'no verb');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkResult('devkit-roadmap: many\n')), null, 'only a number or stop');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkResult('see devkit-roadmap: 2 in the text\n')), null, 'only a line that starts with the marker');
  assert.equal(runOfLines('{not json', lkTyped('roadmap 2'), '{"type":"user", broken', lkMarker(2))?.command, 'roadmap 2', 'a broken line is skipped');
});

test('roadmap-loop lock run: the skill body and the api-request lines are neither the command nor the printed line', () => {
  assert.equal(runOfLines(lkBlob(lkCommandText('/devkit', 'roadmap 2')), lkMarker(2)), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkBlob('devkit-roadmap: 2\n'), lkSkillBody()), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkBlob('devkit-roadmap: stop\n'))?.stopping, false);
});

test('roadmap-loop lock run: a typed /devkit status is skipped, any other typed command ends the run', () => {
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkTyped('status'), lkSkillBody('status'), lkAssistant())?.command, 'roadmap 2', 'status does not end it');
  assert.equal(runOfLines(lkTyped('status'), lkMarker(2)), null, 'nor does it start one');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkTyped('status'), lkMarker(2))?.command, 'roadmap 2', 'status between the command and its line');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkTyped('', '/clear')), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkPlain('/review the plan')), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkTyped('change x')), null);
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkTyped('roadmap 3')), null, 'the new command has no line yet');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkTyped('roadmap 3'), lkMarker(3))?.command, 'roadmap 3');
  assert.equal(runOfLines(lkTyped('roadmap 2'), lkMarker(2), lkPlain('yes, go on'), lkPlain('/Users/me/notes.txt is the file'))?.command, 'roadmap 2', 'an owner message is not a command');
});

test('roadmap-loop lock run: a change run is still ended by /devkit status, and a roadmap run is no change run', () => {
  const transcript = (...lines) => ({ transcript_path: lkTranscript(lines) });
  assert.equal(guardModule.runOf(transcript(lkTyped('change x'), lkChangeMarker('feat'), lkTyped('status'))), null);
  assert.equal(guardModule.runOf(transcript(lkTyped('change x'), lkChangeMarker('feat')))?.change, 'feat');
  assert.equal(guardModule.runOf(transcript(lkTyped('roadmap 2'), lkMarker(2))), null);
  assert.equal(guardModule.roadmapRunOf(transcript(lkTyped('change x'), lkChangeMarker('feat'))), null);
  assert.equal(guardModule.roadmapRunOf(transcript(lkTyped('roadmap 2'), lkMarker(2), lkTyped('change x'), lkChangeMarker('feat'))), null);
  assert.equal(guardModule.runOf(transcript(lkTyped('roadmap 2'), lkMarker(2), lkTyped('change x'), lkChangeMarker('feat')))?.change, 'feat');
});

// ---------------------------------------------------------------- the stop lock (D-11 RS1 to RS5)

test('roadmap-loop lock stop: RS3 one change in flight and another ready is refused once, naming the change, the stage and the command', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, inflight: { a: flying() } });
  const transcript = lkRun(2);
  withTmp((tmp) => {
    const first = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([first.decision, first.why, first.change], ['refuse', 'stage-ready', 'b'], 'the running subagent of a does not let it through');
    assert.match(first.reason, /the change b has the stage proposal ready \(devkit-core:change-planner\)/);
    assert.ok(first.reason.includes(`node ${HOOKS_DIR}/roadmap-loop.mjs next --lang en --load-limit 80`), first.reason);
    assert.deepEqual(recordOf(tmp), { key: `roadmap:b:agent:${progressOf(root, 'b')}` });
    const again = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([again.decision, again.why], ['allow', 'same-state'], 'RS4 the same key');
  });
});

test('roadmap-loop lock stop: RS3 the key is every ready action of the run, sorted, so another state is refused again; the language and limit come from the settings', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2 });
  const transcript = lkRun(2);
  withTmp((tmp) => {
    const first = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts({ env: { ...LK_ENV, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'pt-BR', CLAUDE_PLUGIN_OPTION_LOAD_LIMIT: '65' } }));
    assert.equal(first.decision, 'refuse');
    assert.equal(first.change, 'a', 'the first action of the run');
    assert.ok(first.reason.includes('next --lang pt-BR --load-limit 65'), first.reason);
    assert.equal(recordOf(tmp).key, `roadmap:a:agent:${progressOf(root, 'a')},b:agent:${progressOf(root, 'b')}`);
    putRun(root, { places: 2, inflight: { a: flying() } });
    assert.equal(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).decision, 'refuse', 'b alone is another key');
    assert.equal(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).decision, 'allow');
  });
});

test('roadmap-loop lock stop: RS2 every change in flight, waiting for the owner or blocked lets the stop through', () => {
  const both = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(both, { places: 2, inflight: { a: flying(), b: flying() } });
  const waiting = lkProject(['[ ] a', '[ ] b'], { a: {}, b: { have: UP_TO_READINESS } });
  putRun(waiting, { places: 2, inflight: { a: flying() } });
  const owner = lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } });
  putRun(owner, { places: 1 });
  const declared = lkProject(['[ ] a'], { a: {} });
  putRun(declared, { places: 1, declared: { a: { state: 'blocked', why: 'not-opened', params: {} } } });
  for (const [name, root] of [['both in flight', both], ['one in flight, one waiting for the approval', waiting], ['the owner\'s queue alone', owner], ['a blocked change', declared]]) {
    const { d, tmp } = stopOf(root, lkRun(2));
    assert.equal(d.decision, 'allow', `${name}: ${d.reason ?? d.why}`);
    nothingRecorded(tmp);
  }
});

test('roadmap-loop lock stop: RS2 a change that could start is refused, and a start held by the load is allowed only while its hold is watched', () => {
  const root = lkProject(['[ ] a'], {});
  putRun(root, { places: 1 });
  const { d } = stopOf(root, lkRun(1));
  assert.deepEqual([d.decision, d.change], ['refuse', 'a']);
  assert.match(d.reason, /the change a is ready to start/);

  const loaded = { opts: { load: () => 95 } };
  assert.equal(stopOf(root, lkRun(1), loaded).d.decision, 'refuse', 'a held start nobody watches is a hold to start');
  putRun(root, { places: 1, holding: WATCH });
  const watched = stopOf(root, lkRun(1), loaded);
  assert.equal(watched.d.decision, 'allow', 'a watched hold');
  nothingRecorded(watched.tmp);
});

test('roadmap-loop lock stop: RS2 an archived change releases no other, a ready change is still refused', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { b: {} });
  put(root, { 'openspec/changes/archive/2026-11-20-a/proposal.md': '# a\n' });
  commitAll(root, 'a is archived');
  putRun(root, { places: 2 });
  const { d } = stopOf(root, lkRun(2));
  assert.deepEqual([d.decision, d.change], ['refuse', 'b']);
});

test('roadmap-loop lock stop: RS2 an end that never arrived is found at the next stop, naming the stage that is ready', () => {
  const root = lkProject(['[ ] a'], { a: { have: UP_TO_TASKS } });
  putRun(root, { places: 1, inflight: { a: flying(PLANNER_TYPE, 'design') } });
  const transcript = lkRun(1);
  withTmp(() => {
    assert.equal(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).decision, 'allow', 'the planner is still under way');
    const stopped = loopModule.roadmapSubagentStopDecision(lkSubInput(root, transcript, PLANNER_TYPE, BRIEF('a', 'design')), lkOpts());
    assert.equal(stopped.decision, 'allow', 'the planner delivered; its end never reached the session');
    assert.deepEqual(stateOf(root).inflight, {}, 'the lock cleared its entry');
    const lost = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([lost.decision, lost.change], ['refuse', 'a']);
    assert.match(lost.reason, /the change a has the stage readiness ready \(devkit-core:plan-readiness-reviewer\)/);
    assert.equal(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).why, 'same-state', 'once');
  });
});

test('roadmap-loop lock stop: RS1 a run that is stopping lets the stop through, by the transcript or by the run file', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2 });
  const byTranscript = stopOf(root, lkTranscript([lkTyped('roadmap stop'), lkMarker('stop')]));
  assert.deepEqual([byTranscript.d.decision, byTranscript.d.why], ['allow', 'stopping']);
  putRun(root, { places: 2, stopping: true });
  assert.equal(stopOf(root, lkRun(2)).d.decision, 'allow', 'the run file says stopping');
});

test('roadmap-loop lock stop: RS2 the end of the run and a session outside a run let the stop through', () => {
  const done = lkProject(['[x] a'], {});
  put(done, { 'openspec/changes/archive/2026-11-20-a/proposal.md': '# a\n' });
  commitAll(done, 'a is archived');
  putRun(done, { places: 1 });
  assert.equal(stopOf(done, lkRun(1)).d.decision, 'allow', 'every line archived');
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  for (const transcript of [lkTranscript([lkAssistant()]), lkTranscript([lkTyped('roadmap 1'), lkMarker(1), lkTyped('', '/clear')]), lkTranscript([lkTyped('change x'), lkChangeMarker('a')]), undefined]) {
    const r = stopOf(root, transcript);
    assert.deepEqual([r.d.decision, r.d.why], ['allow', 'no-run']);
  }
});

test('roadmap-loop lock stop: RS5 any error lets the stop through and records nothing', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  const folderRunFile = lkProject(['[ ] a'], { a: {} });
  mkdirSync(runFileOf(folderRunFile), { recursive: true });
  const brokenRunFile = lkProject(['[ ] a'], { a: {} });
  mkdirSync(dirname(runFileOf(brokenRunFile)), { recursive: true });
  writeFileSync(runFileOf(brokenRunFile), '{ not json');
  const noRunFile = lkProject(['[ ] a'], { a: {} });
  for (const [name, cwd] of [['a run file that is a folder', folderRunFile], ['a run file that is broken', brokenRunFile], ['no run file', noRunFile], ['no project', lkSandbox()]]) {
    const { d, tmp } = stopOf(cwd, lkRun(1));
    assert.deepEqual([d.decision, d.why], ['allow', 'error'], name);
    nothingRecorded(tmp);
  }
  assert.equal(stopOf(root, lkRun(1)).d.decision, 'refuse', 'the same fixture with a good run file is refused');
});

// ---------------------------------------------------------------- the hand-off lock (D-11 RH0 to RH5)

test('roadmap-loop lock agent: RH4 a brief of an open change and a role of its script is allowed and recorded in flight', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2 });
  const transcript = lkRun(2);
  for (const type of [PLANNER_TYPE, 'change-planner']) {
    const d = agentOf(lkAgentInput(root, transcript, type, BRIEF('a')));
    assert.deepEqual([d.decision, d.why, d.change], ['allow', 'script-role', 'a'], type);
  }
  const entry = stateOf(root).inflight.a;
  assert.deepEqual({ ...entry, at: typeof entry.at }, { kind: 'agent', stage: 'proposal', agentType: 'change-planner', at: 'string' }, 'the last call wins');
  assert.ok(!Number.isNaN(Date.parse(entry.at)));
  assert.equal(agentOf(lkAgentInput(root, transcript, READINESS_TYPE, BRIEF('b', 'readiness'))).decision, 'allow');
  assert.deepEqual(Object.keys(stateOf(root).inflight).sort(), ['a', 'b'], 'two changes in flight at once');
  assert.equal(stateOf(root).inflight.b.stage, 'readiness');
});

test('roadmap-loop lock agent: RH1 a hand-off with no brief of the loop is refused', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  const transcript = lkRun(1);
  for (const prompt of ['do it', '', undefined, 42, 'Please do Change a (devkit script)', 'change a (devkit script), stage proposal: x', 'Change a stage proposal']) {
    const d = agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, prompt));
    assert.deepEqual([d.decision, d.why], ['refuse', 'no-brief'], String(prompt));
    assert.match(d.reason, /in a \/devkit roadmap run every hand-off starts with the brief the loop gave, which names its change/);
  }
  assert.deepEqual(stateOf(root).inflight, {}, 'nothing recorded');
});

test('roadmap-loop lock agent: RH2 a change that is not open on the roadmap is refused, naming the open ones', () => {
  const root = lkProject(['[ ] a', '[ ] b', '[ ] c', '[x] d'], { a: {}, b: {}, d: {}, e: {} });
  putRun(root, { places: 3 });
  const transcript = lkRun(3);
  for (const id of ['c', 'd', 'e', 'nope']) {
    const d = agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF(id)));
    assert.deepEqual([d.decision, d.why], ['refuse', 'not-open'], `${id}: unopened, ticked or off the roadmap`);
    assert.match(d.reason, /the open changes are: a, b/, id);
  }
  assert.deepEqual(stateOf(root).inflight, {});
});

test('roadmap-loop lock agent: RH2 a change that began under the previous script is not open', () => {
  const root = lkProject(['[ ] a'], {});
  const forms = previousForms(root);
  put(root, { 'openspec/roadmap.md': roadmapText('[ ] a', `[ ] ${forms.previous[0]}`) });
  commitAll(root, 'the roadmap names an old change');
  putRun(root, { places: 2 });
  const d = agentOf(lkAgentInput(root, lkRun(2), PLANNER_TYPE, BRIEF(forms.previous[0])));
  assert.deepEqual([d.decision, d.why], ['refuse', 'not-open']);
});

test('roadmap-loop lock agent: RH3 a role of another script, a general-purpose agent and no agent type are refused, naming the change, its script and its roles', () => {
  const root = lkProject(['[ ] a', '[ ] l'], { a: {}, l: { script: 'devkit-lite' } });
  putRun(root, { places: 2 });
  const transcript = lkRun(2);
  const refused = (type, prompt, matcher) => {
    const d = agentOf(lkAgentInput(root, transcript, type, prompt));
    assert.equal(d.decision, 'refuse', `${type}: ${d.why}`);
    assert.match(d.reason, matcher, String(type));
  };
  refused(READINESS_TYPE, BRIEF('l', 'proposal', 'devkit-lite'), /roadmap run this session hands work for l only to the roles of the devkit-lite script: .*change-planner.*tdd-implementer.*; devkit-core:plan-readiness-reviewer is not one of them/);
  refused('general-purpose', BRIEF('a'), /for a only to the roles of the devkit script: .*change-planner.*; general-purpose is not one of them/);
  refused('devkit-openspec:change-planner', BRIEF('a'), /not one of them/);
  refused('devkit-core:change-coordinator', BRIEF('a'), /not one of them/);
  refused(undefined, BRIEF('a'), /for a only to the roles of the devkit script: .*; name one of them as subagent_type/);
  refused('', BRIEF('a'), /name one of them as subagent_type/);
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('l', 'proposal', 'devkit-lite'))).decision, 'allow', 'a role both scripts share');
  assert.equal(agentOf(lkAgentInput(root, transcript, READINESS_TYPE, BRIEF('a', 'readiness'))).decision, 'allow', 'a role of the full script');
  assert.deepEqual(Object.keys(stateOf(root).inflight).sort(), ['a', 'l'], 'only the two allowed hand-offs were recorded');
});

test('roadmap-loop lock agent: RH0 a subagent\'s own call is allowed and records nothing, and outside a run any agent is allowed', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  const inner = agentOf(lkAgentInput(root, lkRun(1), 'general-purpose', 'say ok', { agent_id: 'agent-0001', agent_type: PLANNER_TYPE }));
  assert.deepEqual([inner.decision, inner.why], ['allow', 'subagent']);
  assert.deepEqual(stateOf(root).inflight, {});
  for (const transcript of [undefined, lkTranscript([lkAssistant()]), lkTranscript([lkTyped('roadmap 1'), lkMarker(1), lkTyped('', '/clear')])]) {
    const d = agentOf(lkAgentInput(root, transcript, 'general-purpose', 'do it'));
    assert.deepEqual([d.decision, d.why], ['allow', 'no-run']);
  }
});

test('roadmap-loop lock agent: RH5 an error lets the hand-off through and records nothing', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  put(root, { 'openspec/schemas/devkit/flow.json': '{ not json' });
  const d = agentOf(lkAgentInput(root, lkRun(1), 'general-purpose', BRIEF('a')));
  assert.deepEqual([d.decision, d.why], ['allow', 'error'], 'a malformed flow.json');
  assert.deepEqual(stateOf(root).inflight, {});
  const elsewhere = lkSandbox();
  assert.equal(agentOf(lkAgentInput(elsewhere, lkRun(1), PLANNER_TYPE, BRIEF('a'))).decision, 'allow', 'no project');
});

// ---------------------------------------------------------------- the stage agent's stop lock (D-11 RU1 to RU7)

const subOf = (root, transcript, type, prompt, extra) => loopModule.roadmapSubagentStopDecision(lkSubInput(root, transcript, type, prompt, extra), lkOpts());

test('roadmap-loop lock subagent-stop: RU1 two planners of two changes are judged each by its own change, from the prompt', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: { have: UP_TO_TASKS }, b: {} });
  putRun(root, { places: 2, inflight: { a: flying(PLANNER_TYPE, 'design'), b: flying() } });
  const transcript = lkRun(2);
  withTmp((tmp) => {
    const b = subOf(root, transcript, PLANNER_TYPE, BRIEF('b'), { agent_id: 'agent-0002' });
    assert.deepEqual([b.decision, b.why, b.change], ['refuse', 'no-file', 'b']);
    assert.match(b.reason, /proposal\.md of stage proposal does not exist: write it, with its stage header, before you stop/);
    assert.ok(existsSync(join(tmp, 'devkit-stop', `${LK_SESSION}-agent-0002.json`)), 'the record of a subagent carries its id');
    const a = subOf(root, transcript, PLANNER_TYPE, BRIEF('a', 'design'), { agent_id: 'agent-0001' });
    assert.deepEqual([a.decision, a.why, a.change], ['allow', 'delivered', 'a']);
  });
  assert.deepEqual(Object.keys(stateOf(root).inflight), ['b'], 'RU6 only the entry of a was cleared');
});

test('roadmap-loop lock subagent-stop: RU1 with no readable prompt the one in-flight entry of that agent type gives the change', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, inflight: { b: flying(), a: { kind: 'wait', stage: 'delivery', agentType: null, at: '2026-11-21T10:00:00.000Z' } } });
  const transcript = lkRun(2);
  const withoutPrompt = (type, path) => withTmp(() => loopModule.roadmapSubagentStopDecision(lkSubInput(root, transcript, type, 'x', { agent_transcript_path: path }), lkOpts()));
  for (const path of [lkGone(), lkAgentTranscript('no brief here')]) {
    const d = withoutPrompt(PLANNER_TYPE, path);
    assert.deepEqual([d.decision, d.change], ['refuse', 'b'], path);
  }
  assert.equal(withoutPrompt('devkit-core:pr-verifier', lkGone()).decision, 'allow', 'no entry of that type');
  putRun(root, { places: 2, inflight: { a: flying(), b: flying() } });
  assert.equal(withoutPrompt(PLANNER_TYPE, lkGone()).decision, 'allow', 'two entries of that type: the change cannot be told');
});

test('roadmap-loop lock subagent-stop: RU1 an unknown change, a nested subagent and a session outside a run are allowed', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  const transcript = lkRun(1);
  const quiet = (work) => withTmp((tmp) => { const d = work(); nothingRecorded(tmp); return d; });
  assert.equal(quiet(() => subOf(root, transcript, PLANNER_TYPE, BRIEF('zzz'))).decision, 'allow');
  assert.equal(quiet(() => subOf(root, transcript, 'general-purpose', 'say ok')).decision, 'allow', 'a subagent started inside a subagent has its own agent_type and no brief');
  const outside = subOf(root, lkTranscript([lkAssistant()]), PLANNER_TYPE, BRIEF('a'));
  assert.deepEqual([outside.decision, outside.why], ['allow', 'no-run']);
});

test('roadmap-loop lock subagent-stop: RU2 to RU5 the rows of a change run, over the change the brief names', () => {
  const transcript = lkRun(1);
  const at = (have) => { const root = lkProject(['[ ] a'], { a: { have } }); putRun(root, { places: 1 }); return root; };
  const noFile = at(['requirements']);
  for (const type of ['devkit-core:code-quality-reviewer', 'devkit-core:tdd-implementer', 'general-purpose']) {
    assert.deepEqual(withTmp(() => { const d = subOf(noFile, transcript, type, BRIEF('a', 'implementation')); return [d.decision, d.why]; }), ['allow', 'no-stage-file'], `RU2 ${type}`);
  }
  assert.equal(withTmp(() => subOf(at(UP_TO_TASKS), transcript, PLANNER_TYPE, BRIEF('a', 'design')).why), 'delivered', 'RU3 the next stage is another role\'s');
  assert.equal(withTmp(() => subOf(at(UP_TO_READINESS), transcript, READINESS_TYPE, BRIEF('a', 'readiness')).decision), 'allow', 'RU3 the stage is delivered');
  const pending = lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } });
  put(pending, { 'openspec/changes/a/readiness.md': `<!-- devkit-stage readiness result=pending attempt=1 commit=${git(pending, 'rev-parse', 'HEAD')} -->\n# Readiness\n` });
  commitAll(pending, 'readiness is pending');
  putRun(pending, { places: 1 });
  withTmp(() => {
    const d = subOf(pending, transcript, READINESS_TYPE, BRIEF('a', 'readiness'));
    assert.deepEqual([d.decision, d.change], ['refuse', 'a']);
    assert.match(d.reason, /readiness\.md of stage readiness still says result=pending \(or has no valid header\): set its header before you stop/);
    assert.equal(subOf(pending, transcript, READINESS_TYPE, BRIEF('a', 'readiness')).why, 'same-state', 'RU5 the same state again');
    assert.equal(subOf(pending, transcript, READINESS_TYPE, BRIEF('a', 'readiness'), { agent_id: 'agent-0002' }).decision, 'refuse', 'the record is per agent');
  });
});

test('roadmap-loop lock subagent-stop: RU6 an allowed stop clears the entry only when its agent type is the one that stopped', () => {
  const root = lkProject(['[ ] a'], { a: { have: UP_TO_TASKS } });
  const other = flying(READINESS_TYPE, 'readiness');
  putRun(root, { places: 1, inflight: { a: other } });
  assert.equal(withTmp(() => subOf(root, lkRun(1), PLANNER_TYPE, BRIEF('a', 'design')).decision), 'allow');
  assert.deepEqual(stateOf(root).inflight, { a: other }, 'the reviewer\'s entry stays');
  putRun(root, { places: 1, inflight: { a: flying(PLANNER_TYPE, 'design') } });
  withTmp(() => subOf(root, lkRun(1), PLANNER_TYPE, BRIEF('a', 'design')));
  assert.deepEqual(stateOf(root).inflight, {});
});

test('roadmap-loop lock subagent-stop: RU6 a refused stop keeps the entry', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, inflight: { a: flying() } });
  assert.equal(withTmp(() => subOf(root, lkRun(1), PLANNER_TYPE, BRIEF('a')).decision), 'refuse');
  assert.deepEqual(stateOf(root).inflight, { a: flying() });
});

test('roadmap-loop lock subagent-stop: RU7 an error lets the stop through and records nothing', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, inflight: { a: flying() } });
  const transcript = lkRun(1);
  withTmp((tmp) => {
    assert.equal(subOf(root, lkGone(), PLANNER_TYPE, BRIEF('a')).decision, 'allow', 'an unreadable transcript');
    put(root, { 'openspec/schemas/devkit/flow.json': '{ not json' });
    const d = subOf(root, transcript, PLANNER_TYPE, BRIEF('a'));
    assert.deepEqual([d.decision, d.why], ['allow', 'error'], 'a malformed flow.json');
    nothingRecorded(tmp);
  });
  assert.deepEqual(stateOf(root).inflight, { a: flying() }, 'the entry is left as it was');
});

// ---------------------------------------------------------------- the edit lock and the routing, as subprocesses of guard.mjs
const ROADMAP_LOCK_TEXT = /in a \/devkit roadmap run this session writes no product code; the implementation is handed to tdd-implementer by the loop/;

test('roadmap-loop lock edit: in a roadmap run the session\'s product edit and shell write are refused, with no change, one change or several', () => {
  const transcript = lkRun(2);
  const projects = {
    'no change': lkProject(['[ ] a'], {}),
    'one change': lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } }),
    'two changes': lkProject(['[ ] a', '[ ] b'], { a: { have: UP_TO_READINESS }, b: {} }),
    'a lite change': lkProject(['[ ] a'], { a: { script: 'devkit-lite' } }),
  };
  for (const [name, root] of Object.entries(projects)) {
    const w = lkHook('edit', lkEdit(root, 'src/a.ts', transcript));
    assert.equal(w.code, 2, `${name}: ${w.err}`);
    assert.match(w.err, ROADMAP_LOCK_TEXT, name);
    const b = lkHook('bash', lkBash(root, 'echo x > src/a.ts', transcript));
    assert.equal(b.code, 2, `${name}: ${b.err}`);
    assert.match(b.err, ROADMAP_LOCK_TEXT, name);
    assert.equal(lkHook('bash', lkBash(root, "sed -i '' 's/a/b/' src/a.ts", transcript)).code, 2, name);
  }
});

test('roadmap-loop lock edit: planning files and approval.md follow the existing rules in a roadmap run', () => {
  const transcript = lkRun(2);
  for (const root of [lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } }), lkProject(['[ ] a', '[ ] b'], { a: { have: UP_TO_READINESS }, b: {} })]) {
    assert.equal(lkHook('edit', lkEdit(root, 'openspec/changes/a/tasks.md', transcript)).code, 0);
    assert.equal(lkHook('edit', lkEdit(root, 'openspec/changes/a/approval.md', transcript)).code, 0, 'the main session writes approval.md');
    assert.equal(lkHook('edit', lkEdit(root, '.claude/settings.json', transcript)).code, 0);
    assert.equal(lkHook('bash', lkBash(root, 'echo x > openspec/changes/a/tasks.md', transcript)).code, 0);
    const readiness = lkHook('edit', lkEdit(root, 'openspec/changes/a/readiness.md', transcript));
    assert.equal(readiness.code, 2, 'readiness.md stays the reviewer\'s');
    assert.doesNotMatch(readiness.err, ROADMAP_LOCK_TEXT);
  }
  const lite = lkProject(['[ ] a'], { a: { script: 'devkit-lite' } });
  assert.equal(lkHook('edit', lkEdit(lite, 'openspec/changes/a/approval.md', transcript, 'tdd-implementer')).code, 2, 'a subagent still may not write approval.md');
});

test('roadmap-loop lock edit: a subagent follows the existing rules in a roadmap run, and with no run so does the session', () => {
  const transcript = lkRun(2);
  const root = lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } });
  assert.equal(lkHook('edit', lkEdit(root, 'src/a.ts', transcript, 'tdd-implementer')).code, 0, 'the implementer on the approved change');
  assert.equal(lkHook('bash', lkBash(root, 'echo x > src/a.ts', transcript, 'tdd-implementer')).code, 0);
  const planner = lkHook('edit', lkEdit(root, 'src/a.ts', transcript, 'change-planner'));
  assert.equal(planner.code, 2);
  assert.doesNotMatch(planner.err, ROADMAP_LOCK_TEXT, 'the existing rule decides for a subagent');
  const open = lkProject(['[ ] a'], {});
  for (const none of [undefined, lkTranscript([lkAssistant()]), lkTranscript([lkTyped('roadmap 2'), lkMarker(2), lkTyped('', '/clear')]), lkTranscript([lkTyped('roadmap 2'), lkAssistant()]), lkGone()]) {
    assert.equal(lkHook('edit', lkEdit(open, 'src/a.ts', none)).code, 0);
    assert.equal(lkHook('bash', lkBash(open, 'echo x > src/a.ts', none)).code, 0);
  }
  const closed = lkHook('edit', lkEdit(root, 'src/a.ts', undefined));
  assert.equal(closed.code, 2);
  assert.doesNotMatch(closed.err, ROADMAP_LOCK_TEXT, 'the existing reason, not the lock\'s');
});

test('roadmap-loop lock: the three modes reach the roadmap decisions in a roadmap run, and a change run keeps the change decisions', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, inflight: { a: flying() } });
  const tmp = lkSandbox();
  const log = join(lkSandbox(), 'hooks.jsonl');
  const env = { TMPDIR: tmp, DEVKIT_HOOK_LOG: log, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' };
  const stop = lkHook('stop', lkStopInput(root, lkRun(2)), env);
  assert.equal(stop.code, 2, stop.err);
  assert.ok(stop.err.includes(`node ${HOOKS_DIR}/roadmap-loop.mjs next --lang en --load-limit 80`), stop.err);
  assert.ok(recordOf(tmp).key.startsWith('roadmap:b:agent:'), 'the roadmap\'s key, in the session\'s record');
  assert.equal(lkHook('agent', lkAgentInput(root, lkRun(2), PLANNER_TYPE, BRIEF('b')), env).code, 0);
  assert.equal(stateOf(root).inflight.b.agentType, PLANNER_TYPE, 'the hook recorded the hand-off');
  const general = lkHook('agent', lkAgentInput(root, lkRun(2), 'general-purpose', BRIEF('b')), env);
  assert.equal(general.code, 2, general.err);
  assert.match(general.err, /roadmap run/);
  const sub = lkHook('subagent-stop', lkSubInput(root, lkRun(2), PLANNER_TYPE, BRIEF('b')), env);
  assert.equal(sub.code, 2, sub.err);
  assert.match(sub.err, /proposal\.md of stage proposal does not exist/);
  const records = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(records.map((r) => [r.mode, r.decision, r.change]), [['stop', 'refuse', 'b'], ['agent', 'allow', 'b'], ['agent', 'refuse', 'b'], ['subagent-stop', 'refuse', 'b']]);
  // A change run is still judged by the change coordinator's decisions.
  const change = lkProject(['[ ] a'], { a: {} });
  const changeStop = lkHook('stop', lkStopInput(change, lkTranscript([lkTyped('change x'), lkChangeMarker('a')]), { background_tasks: [] }), { TMPDIR: lkSandbox(), CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' });
  assert.equal(changeStop.code, 2, changeStop.err);
  assert.match(changeStop.err, /change-loop\.mjs next --change a/);
});

test('roadmap-loop lock: no trap, not opted in, DEVKIT_BYPASS, an unreadable transcript or run file let everything through', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, inflight: { a: flying() } });
  const transcript = lkRun(2);
  const tmp = lkSandbox();
  const calls = (cwd, tr, env = {}) => [
    lkHook('stop', lkStopInput(cwd, tr), { TMPDIR: tmp, ...env }),
    lkHook('subagent-stop', lkSubInput(cwd, tr, PLANNER_TYPE, BRIEF('b')), { TMPDIR: tmp, ...env }),
    lkHook('agent', lkAgentInput(cwd, tr, 'general-purpose', 'do it'), env),
    lkHook('edit', lkEdit(cwd, 'src/a.ts', tr), env),
    lkHook('bash', lkBash(cwd, 'echo x > src/a.ts', tr), env),
  ];
  assert.deepEqual(calls(root, transcript).map((r) => r.code), [2, 2, 2, 2, 2], 'the same fixture is refused by every mode');
  const free = (name, results, count = 5) => assert.deepEqual(results.slice(0, count).map((r) => r.code), Array(count).fill(0), `${name}: ${results.map((r) => r.err).join('|')}`);
  free('not opted in', calls(lkProject(['[ ] a'], {}, { config: 'schema: spec-driven\n' }), transcript));
  free('DEVKIT_BYPASS=1', calls(root, transcript, { DEVKIT_BYPASS: '1' }));
  const unreadable = calls(root, lkGone());
  free('an unreadable transcript', unreadable, 3);
  for (const r of unreadable.slice(3)) assert.doesNotMatch(r.err, ROADMAP_LOCK_TEXT, 'the existing rules decide, not the lock');
  const brokenRun = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  mkdirSync(runFileOf(brokenRun), { recursive: true });
  free('an unreadable run file', calls(brokenRun, transcript), 3);
});

// ================================================================ fresh-base-check: the roadmap fetches the base before it judges

// A roadmap of `a`, `b` and `c`, each at its implementation, the remote one commit ahead of the clone's `origin/main`.
function staleRoadmap() {
  const t = roundRepo({ roadmap: roadmapText('[ ] a', '[ ] b', '[ ] c'), config: 'schema: devkit-lite\n' });
  for (const id of ['a', 'b', 'c']) implementingChange(t, id);
  t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  return { t, ...staleBase(t) };
}
const MISSING_ORIGIN = (t) => join(t.originDir, 'no-such-folder');

test('fresh-base-check 12: roadmap next fetches the base once for the changes it reads', () => {
  const { t, remote } = staleRoadmap();
  const shim = gitShim();
  const r = doNext(t.main, [], { env: shim.env(cleanEnv) });
  assert.notEqual(r.code, 3, r.stderr);
  assert.equal(shim.fetches().length, 1, 'three changes, one fetch');
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), remote);
});

test('fresh-base-check 13: the roadmap wait fetches the base at every poll', async () => {
  const { t, wt, gh, env } = deliveredChange();
  const shim = gitShim();
  const sleeps = [];
  const sleep = async (s) => {
    sleeps.push(s);
    if (sleeps.length === 2) gh.set('pr-checks', { stdout: [{ name: 'build', state: 'PASS', bucket: 'pass', link: 'https://ci/build' }] });
  };
  const r = await loopModule.runCommand(['wait', '--change', 'feat', ...FLAGS, '--interval', '5'], { cwd: t.main, env: shim.env(env), gh: t.ghFor(wt), sleep });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(shim.fetches().length, 3, 'three polls, three fetches');
});

test('fresh-base-check 14: status, status --json and the stop lock never fetch', () => {
  const { t, stale } = staleRoadmap();
  const shim = gitShim();
  const env = shim.env(cleanEnv);
  assert.equal(doStatus(t.main, { env }).code, 0);
  assert.equal(cmd(t.main, ['status', ...FLAGS, '--json'], { env }).code, 0);
  putRun(t.main, { places: 2 });
  const d = withTmp(() => loopModule.roadmapStopDecision(lkStopInput(t.main, lkRun(2)), lkOpts({ env: shim.env(LK_ENV) })));
  assert.notEqual(d.why, 'no-run', 'the lock read the run');
  assert.deepEqual(shim.fetches(), []);
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), stale);
});

test('fresh-base-check 15: roadmap run fetches the base once', () => {
  const { t } = staleRoadmap();
  const shim = gitShim();
  const r = doRun(t.main, '', { env: shim.env(cleanEnv) });
  assert.notEqual(r.code, 3, r.stderr);
  assert.equal(shim.fetches().length, 1);
});

test('fresh-base-check 18: a remote that cannot be reached leaves every change decided from the local copy, and the failure is read once', () => {
  const { t, stale } = staleRoadmap();
  git(t.main, 'remote', 'set-url', 'origin', MISSING_ORIGIN(t));
  const shim = gitShim();
  const facts = loopModule.collectRoadmap(t.main, { env: shim.env(cleanEnv), lang: 'en', gh: OFFLINE, fetchBase: baseFetches() });
  assert.deepEqual(Object.keys(facts.actions).sort(), ['a', 'b', 'c']);
  const errors = new Set();
  for (const [id, action] of Object.entries(facts.actions)) {
    const local = nextAction(t.main, id, { env: cleanEnv, lang: 'en', gh: OFFLINE });
    assert.equal(action.baseFetch.ok, false, id);
    assert.equal(action.baseFetch.base, 'main', id);
    assert.match(action.baseFetch.error, /^[^\n]+$/, id);
    errors.add(action.baseFetch.error);
    assert.deepEqual([action.kind, action.step], [local.kind, local.step], `${id} is decided from the local copy`);
  }
  assert.equal(errors.size, 1, 'one failure, shared');
  assert.equal(shim.fetches().length, 1, 'the failure is memoized for the call');
  shim.clear();
  const r = doNext(t.main, [], { env: shim.env(cleanEnv) });
  assert.notEqual(r.code, 3, r.stderr);
  assert.equal(shim.fetches().length, 1);
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), stale);
});