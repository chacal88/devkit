// node --test --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs
// roadmap-coordinator: the roadmap loop, its commands and its locks (phase 1: the previous-script fixtures and the pure core; phase 2: the commands; phase 3: the locks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitRepo, put, commitAll, git } from './deliver-check.test.mjs';
import { parseRoadmap } from './guard.mjs';
import * as guardModule from './guard.mjs';
import { nextAction, render, MESSAGES, LoopUsageError, HOOKS_DIR, main as changeMain } from './change-loop.mjs';
import { readCounter } from './change-loop.test.mjs';
import { makeOpenspec } from './flow-check.mjs';
import * as loopModule from './roadmap-loop.mjs';
import { limitOf, readLoad, parseWord, gateOf, isPrevious, classifyLines, decideRoadmap, boardOf, draftText } from './roadmap-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS = join(HERE, '..', 'schemas');

// Every env a test of this file builds blanks the branch variables together (CONTRIBUTING.md, testing rules).
const SET = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const cleanEnv = { ...process.env, ...SET };

const FLOWS = Object.fromEntries(['devkit', 'devkit-lite'].map((s) => [s, JSON.parse(readFileSync(join(SCHEMAS, s, 'flow.json'), 'utf8'))]));

// ---------------------------------------------------------------- the previous-script fixtures (design D-4)

// The nine change folders of D-4's table, committed in `root`: P1 to P6 are of the previous script in each form
// `flow-check.mjs#isPreviousScript` recognises, Q1, Q2 and `other-work` are current. "Headerless" is a file whose first
// line is `# <Title>`; "headed" one whose first line is a well-formed stage header of its own stage with result=passed.
// Built from the rule only: no checkout's state is read and no id of another project is used.
export function previousForms(root) {
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

// A roadmap of one round: each argument is the text after "- " of a line, so it carries its own checkbox.
const ROUND = (...lines) => parseRoadmap(`# Roadmap\n\n## Round 1: flags\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
const classify = ({ lines, archived = [], open = [], previous = [], declared = {} }) => (
  classifyLines(ROUND(...lines), { archived: new Set(archived), open: new Set(open), previous: new Set(previous), declared }));
const clsOf = (classified) => Object.fromEntries(classified.map((l) => [l.id, l.cls]));

// The actions of change-loop as decideRoadmap reads them (the fields of a real action, nothing the loop does not read).
const base = (id) => ({ version: 1, change: id, script: 'devkit', root: `/w/${id}`, branch: id, filesLanguage: 'en' });
const agentAct = (id, stage = 'proposal', over = {}) => ({
  ...base(id), kind: 'agent', stage, stageTitle: 'Proposal', role: 'change-planner', skills: [], agent: 'devkit-core:change-planner',
  brief: `Change ${id} (devkit script), stage ${stage}: write the plan.`, progressKey: `${stage}/${stage}@abc123`, ...over,
});
const sessionAct = (id, step = 'review', over = {}) => ({
  ...base(id), kind: 'session', stage: 'review', stageTitle: 'Code review', role: 'change-coordinator', skills: [], step, progressKey: `review/${step}@abc123`, ...over,
});
const grillAct = (id) => ({
  ...base(id), kind: 'grill', stage: 'requirements', stageTitle: 'Requirements', role: 'change-coordinator', skills: ['requirements-grill'], progressKey: 'requirements@abc123',
});
const endAct = (id, state, why, params = {}, over = {}) => ({
  ...base(id), kind: 'end', stage: null, stageTitle: null, role: null, skills: [], end: { state, why }, params: { id, ...params }, reply: 'x', ...over,
});
const ownerAct = (id, why = 'waiting-approval') => endAct(id, 'waiting-for-owner', why, {}, { stage: 'approval', stageTitle: 'Plan approval' });
const githubAct = (id, what = 'merge') => endAct(id, 'waiting-on-github', 'waiting-github', { what }, { stage: 'delivery', stageTitle: 'Delivery' });
const blockedAct = (id, why, params = {}) => endAct(id, 'blocked', why, { why, ...params });
const archivedAct = (id) => endAct(id, 'archived', 'archived');
const FLYING = { kind: 'agent', stage: 'proposal', agentType: 'change-planner', at: '2026-11-21T10:00:00.000Z' };

// The facts of one decision: a roadmap, what is archived, the open changes' actions and the run's bookkeeping.
function world(over = {}) {
  const { lines = [], archived = [], actions = {}, previous = [], declared = {}, inflight = {}, openExtra = [], ...rest } = over;
  const open = [...Object.keys(actions), ...Object.keys(inflight), ...previous, ...openExtra];
  return {
    lang: 'en', places: 3, stopping: false, holding: false, load: 10, limit: 80, hasRoadmap: true,
    lines: classify({ lines, archived, open, previous, declared }),
    actions, inflight, declared, announced: {}, starting: [], held: false, asking: null, after: {}, wheres: {}, phaseTotals: {}, unfinished: [],
    ...rest,
  };
}
const say = (key, params, lang = 'en') => `▸ ${render(lang, key, params)}`;
const changesOf = (r) => r.actions.map((a) => [a.change, a.kind]);

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

const BLOCKED_PARAMS = { id: 'x', stage: 'Code review', attempt: 3, error: 'timeout', number: 12, phase: 2, list: 'build', base: 'main' };

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
    'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-mockup': 'mockup',
  };
  const waits = Object.keys(MESSAGES.en).filter((k) => k.startsWith('waiting-') && k !== 'waiting-github');
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

const rowAt = (width) => (id, text) => `  ${id.padEnd(width)}${text}`;
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

const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline' });
const LOOP_FILE = join(HERE, 'roadmap-loop.mjs');
const FLAGS = ['--lang', 'en', '--load-limit', '80'];
const roadmapText = (...lines) => `# Roadmap\n\n## Round 1: flags\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
const projectWith = (roadmap, { config = 'schema: devkit\n' } = {}) => gitRepo({ config, files: roadmap === null ? {} : { 'openspec/roadmap.md': roadmap } });
const titleEn = (stage) => FLOWS.devkit.stages.find((s) => s.id === stage).title.en;

// One command of roadmap-loop, with no GitHub and the load handed in (a percentage).
const cmd = (cwd, argv, { stdin = '', load = 10, env = cleanEnv, ...rest } = {}) => loopModule.main(argv, { cwd, env, stdin, gh: OFFLINE, load: () => load, ...rest });
const doRun = (cwd, word = '', { session = 'S1', extra = [], ...opts } = {}) => cmd(cwd, ['run', ...FLAGS, '--session', session, ...extra], { stdin: word, ...opts });
const doNext = (cwd, extra = [], opts = {}) => cmd(cwd, ['next', ...FLAGS, ...extra], opts);
const doStatus = (cwd, opts = {}) => cmd(cwd, ['status', ...FLAGS], opts);
const jsonOf = (stdout) => { const lines = stdout.split('\n'); return JSON.parse(lines.slice(lines.indexOf('{')).join('\n')); };
const runFileOf = (cwd) => loopModule.runFilePath(cwd);
const stateOf = (cwd) => JSON.parse(readFileSync(runFileOf(cwd), 'utf8'));
const putRun = (cwd, patch) => {
  mkdirSync(dirname(runFileOf(cwd)), { recursive: true });
  writeFileSync(runFileOf(cwd), JSON.stringify({
    version: 1, session: 'S1', places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [], held: false, holding: false,
    changeSessions: false, startedSessions: {}, turn: null, ...patch,
  }));
};
// The event lines a command shows: the ones it printed itself, then the `lines` of its decision.
const events = (stdout) => [...stdout.split('\n').filter((l) => l.startsWith('▸ ')), ...jsonOf(stdout).lines];
const addOpen = (root, id) => { put(root, { [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit\n' }); commitAll(root, `open ${id}`); };
// The mark of a watch of the load that runs: this process (design roadmap-coordinator-followups D-7).
const WATCH = { pid: process.pid, at: '2026-11-21T10:00:00.000Z' };
const inFlight = (stage = 'proposal') => ({ kind: 'agent', stage, agentType: 'change-planner', at: '2026-11-21T10:00:00.000Z' });
const picture = (cwd) => [git(cwd, 'status', '--porcelain'), git(cwd, 'branch', '--list', '--all'), git(cwd, 'worktree', 'list'), git(cwd, 'rev-list', '--count', '--all')].join('\n--\n');

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
  for (const config of ['schema: spec-driven\n', 'schema: devkit\ndevkit:\n  driver: robot\n', 'schema: devkit\ndevkit:\n  driver: compozy\n']) {
    const cwd = gitRepo({ config });
    const asked = JSON.parse(startRun(cwd, 'change add a thing').stdout);
    for (const verb of ['roadmap', 'status']) {
      const b = JSON.parse(startRun(cwd, verb).stdout);
      assert.deepEqual([b.mode, b.reply], [asked.mode, asked.reply], `${verb} in ${config}`);
    }
  }
  // The verbs of later rounds keep their round; an unknown verb names the three commands that exist.
  for (const [verb, round] of [['help', 23]]) assert.equal(JSON.parse(startRun(root, verb).stdout).reply, render('en', 'verb-not-built', { verb, round }));
  assert.notEqual(JSON.parse(startRun(root, 'project').stdout).mode, 'not-built', 'project leaves the not-built row');
  assert.match(render('en', 'verb-unknown'), /\/devkit change.*\/devkit roadmap.*\/devkit status.*\/devkit project/);
  assert.match(render('pt-BR', 'verb-unknown'), /^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status e \/devkit project/);
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
  putRun(root, {
    session: 'S1', places: 2, stopping: true, held: true, holding: WATCH, inflight: { a: inFlight() }, announced: { a: 'resumed' },
    declared: { c: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } },
  });
  const again = doRun(root, '3');
  assert.equal(again.stdout.split('\n')[0], 'devkit-roadmap: 3');
  assert.ok(events(again.stdout).includes(`▸ ${render('en', 'roadmap-places', { places: 3, open: 1 })}`), 'the number changed: said once');
  assert.ok(!events(again.stdout).some((l) => l.includes('Resumed a')), 'a was announced before: not again');
  const kept = stateOf(root);
  assert.deepEqual([kept.places, kept.stopping, kept.declared, kept.holding, Object.keys(kept.inflight)], [3, false, {}, WATCH, ['a']]);
  assert.deepEqual(jsonOf(again.stdout).actions.map((x) => [x.change, x.kind]), [['b', 'start'], ['c', 'start']], 'a stays in flight; the cleared declared change is handed again');
  assert.ok(!events(doRun(root, '3').stdout).some((l) => l.includes('changes at once')), 'the same number says nothing');

  const other = doRun(root, '2', { session: 'S2' });
  assert.ok(!events(other.stdout).some((l) => l.includes('changes at once')));
  assert.deepEqual([stateOf(root).session, stateOf(root).places, stateOf(root).inflight, stateOf(root).holding], ['S2', 2, {}, null]);
  putRun(root, { session: 'S2', places: 2, inflight: { a: inFlight() }, holding: WATCH });
  doRun(root, '2', { session: 'S2', extra: ['--fresh'] });
  assert.deepEqual([stateOf(root).inflight, stateOf(root).holding], [{}, null], '--fresh starts from empty in the same session');
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

const GUARD = join(HERE, 'guard.mjs');
const LK_SESSION = 'session-roadmap-0001';
const lkSandbox = () => mkdtempSync(join(tmpdir(), 'roadmap-loop-lock-'));

// Transcript lines and hook inputs in the stored forms the probe of this change recorded (Claude Code 2.1.326, ids replaced).
const LK_BASE = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'claude-desktop', cwd: '/scratch/project', sessionId: LK_SESSION, version: '2.1.326', gitBranch: 'main' };
const lkStored = (extra) => JSON.stringify({ ...LK_BASE, uuid: 'uuid-0001', timestamp: '2026-11-21T10:00:00.000Z', ...extra });
const lkCommandText = (name, args) => `<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`;
const lkTyped = (args, name = '/devkit') => lkStored({ type: 'user', message: { role: 'user', content: lkCommandText(name, args) } });
const lkPlain = (text) => lkStored({ type: 'user', message: { role: 'user', content: text } });
const lkSkillBody = (args = 'roadmap') => lkStored({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: `Base directory for this skill: /plugin/skills/devkit\n\nA line devkit-roadmap: 2 is printed by the loop.\n\nARGUMENTS: ${args}` }] } });
const lkAssistant = () => lkStored({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
const lkBlob = (text) => lkStored({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text }] } });
// The tool result of a command that printed `text`, in one of the three stored forms: `both`, `stdout` (only in toolUseResult) and `blocks`.
const lkResult = (text, form = 'both') => lkStored({
  type: 'user',
  message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: form === 'blocks' ? [{ type: 'text', text: 'first block' }, { type: 'text', text }] : form === 'stdout' ? 'ok' : text, is_error: false }] },
  ...(form === 'blocks' ? {} : { toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }),
});
const lkMarker = (places = 2, form = 'both') => lkResult(`devkit-roadmap: ${places}\n{"version":1}`, form);
const lkChangeMarker = (id) => lkResult(`devkit-run: ${id}\n{"version":1}`);
const lkTranscript = (lines) => {
  const file = join(lkSandbox(), `${LK_SESSION}.jsonl`);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
const lkRun = (places = 2) => lkTranscript([lkTyped('roadmap'), lkSkillBody(), lkAssistant(), lkMarker(places)]);
// The first line of a subagent's own transcript: its prompt (a sidechain line, content a string).
const lkAgentTranscript = (prompt) => {
  const file = join(lkSandbox(), 'agent-0001.jsonl');
  writeFileSync(file, `${lkStored({ type: 'user', isSidechain: true, agentId: 'agent-0001', message: { role: 'user', content: prompt } })}\n${lkAssistant()}\n`);
  return file;
};
const lkGone = () => join(lkSandbox(), 'gone.jsonl');

const RUNNING = [{ id: 'agent-0001', type: 'subagent', status: 'running', description: 'Change a stage proposal', agent_type: 'devkit-core:change-planner' }];
const lkBase = (root, transcript, extra = {}) => ({ session_id: LK_SESSION, transcript_path: transcript, cwd: root, permission_mode: 'bypassPermissions', ...extra });
const lkStopInput = (root, transcript, extra = {}) => lkBase(root, transcript, { hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'Launched.', background_tasks: RUNNING, session_crons: [], ...extra });
const lkSubInput = (root, transcript, agentType, prompt, extra = {}) => lkBase(root, transcript, {
  hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'agent-0001', agent_type: agentType, agent_transcript_path: lkAgentTranscript(prompt),
  last_assistant_message: 'done', background_tasks: RUNNING, session_crons: [], ...extra,
});
const lkAgentInput = (root, transcript, subagentType, prompt, extra = {}) => lkBase(root, transcript, {
  hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu-0002',
  tool_input: { description: 'a stage', ...(prompt === undefined ? {} : { prompt }), ...(subagentType === undefined ? {} : { subagent_type: subagentType }), run_in_background: true }, ...extra,
});
const BRIEF = (id, stage = 'proposal', script = 'devkit') => `Change ${id} (${script} script), stage ${stage}: write it. Work only in /somewhere on branch ${id}.`;
const PLANNER_TYPE = 'devkit-core:change-planner';
const READINESS_TYPE = 'devkit-core:plan-readiness-reviewer';
const flying = (agentType = PLANNER_TYPE, stage = 'proposal') => ({ kind: 'agent', stage, agentType, at: '2026-11-21T10:00:00.000Z' });

// Invariant (T-9, roadmap lock, roadmap-loop.test.mjs): a fixture change opened at the grill stands right before its proposal,
// so the planner is its next role.
const LK_PLAN = { requirements: 'requirements.md', decisions: 'decisions.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md' };
const UP_TO_TASKS = ['requirements', 'proposal', 'specs', 'design', 'tasks'];
const UP_TO_READINESS = [...UP_TO_TASKS, 'readiness'];
// A project whose roadmap holds `lines`, with the open changes of `changes` ({ id: { have, script } }) committed in its main checkout.
function lkProject(lines, changes = {}, { config = 'schema: devkit\n' } = {}) {
  const root = projectWith(lines === null ? null : roadmapText(...lines), { config });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = {};
  for (const [id, { have = ['requirements', 'decisions'], script = 'devkit' } = {}] of Object.entries(changes)) {
    files[`openspec/changes/${id}/.openspec.yaml`] = `schema: ${script}\n`;
    for (const stage of have) {
      const body = stage === 'readiness' ? '# Readiness\n\n- Status: APPROVED\n' : stage === 'tasks' ? '# Tasks\n\n- [ ] 1.1 a\n' : `# ${stage}\n`;
      files[`openspec/changes/${id}/${LK_PLAN[stage]}`] = `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${c0} -->\n${body}`;
    }
  }
  put(root, files);
  commitAll(root, 'open changes');
  return root;
}
const LK_ENV = { ...cleanEnv, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' };
const lkOpts = (over = {}) => ({ env: LK_ENV, gh: OFFLINE, load: () => 10, ...over });
// Runs `work(tmp)` with a fresh temporary folder, where the refusal records are written (os.tmpdir() reads TMPDIR at each call).
function withTmp(work) {
  const saved = process.env.TMPDIR;
  const tmp = lkSandbox();
  process.env.TMPDIR = tmp;
  try { return work(tmp); } finally { if (saved === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = saved; }
}
const recordOf = (tmp, name = `${LK_SESSION}.json`) => JSON.parse(readFileSync(join(tmp, 'devkit-stop', name), 'utf8'));
const nothingRecorded = (tmp) => assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing was refused, nothing recorded');
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

const stopOf = (root, transcript, { opts, extra } = {}) => withTmp((tmp) => ({ tmp, d: loopModule.roadmapStopDecision(lkStopInput(root, transcript, extra), lkOpts(opts)) }));

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
  putRun(declared, { places: 1, declared: { a: { state: 'blocked', why: 'ceiling', params: {} } } });
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

const agentOf = (input, opts) => loopModule.roadmapAgentDecision(input, lkOpts(opts));

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

function lkHook(mode, input, env = {}) {
  const r = spawnSync(process.execPath, [GUARD, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
const lkEdit = (root, file, transcript, role) => ({
  cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, file) }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
const lkBash = (root, command, transcript, role) => ({
  cwd: root, tool_name: 'Bash', tool_input: { command }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
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

// ---------------------------------------------------------------- the skill and the setting (design D-13, D-6)

const SKILL_PATH = join(HERE, '..', 'skills', 'devkit', 'SKILL.md');
const skillMd = () => readFileSync(SKILL_PATH, 'utf8');
const SK_LANG = '--lang ${user_config.language}';
const SK_LIMIT = '--load-limit ${user_config.load_limit}';
const sectionOf = (md, from, to) => {
  const a = md.indexOf(from);
  assert.ok(a >= 0, `section ${from}`);
  const b = md.indexOf(to, a + from.length);
  return md.slice(a, b < 0 ? md.length : b);
};

test('roadmap-loop skill: every roadmap-loop command carries the person\'s language and the load limit', () => {
  const md = skillMd();
  const calls = md.split('\n').filter((l) => /roadmap-loop\.mjs (run|next|status|draft|reply|wait|hold)\b/.test(l));
  for (const sub of ['run', 'next', 'status', 'draft', 'reply', 'wait', 'hold']) assert.ok(calls.some((l) => l.includes(`roadmap-loop.mjs ${sub}`)), `the body runs ${sub}`);
  for (const l of calls) {
    assert.ok(l.includes(SK_LANG), `--lang on: ${l}`);
    assert.ok(l.includes(SK_LIMIT), `--load-limit on: ${l}`);
  }
  assert.doesNotMatch(md, /--lang (pt-BR|en)\b/);
  assert.doesNotMatch(md, /--load-limit \d/, 'the limit is the setting, never a number');
  const lines = md.split('\n');
  const run = lines.findIndex((l) => l.includes('roadmap-loop.mjs run'));
  assert.ok(lines[run].includes('--session ${CLAUDE_SESSION_ID}'), 'run carries the session id');
  assert.ok(lines[run].endsWith("<<'DEVKIT_ARGS'"), 'run reads the word through a quoted heredoc');
  assert.equal(lines[run + 1], '$ARGUMENTS');
  assert.equal(lines[run + 2], 'DEVKIT_ARGS');
  assert.doesNotMatch(md, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
});

test('roadmap-loop skill: the frontmatter and the start modes name the roadmap and the status', () => {
  const md = skillMd();
  const fm = md.split('---')[1];
  assert.match(fm, /^argument-hint: "change \[<request> \| <change-id>\] \| roadmap \[<n> \| stop\] \| status \| project \[<name>\]"$/m);
  const desc = /^description: (.*)$/m.exec(fm)[1];
  assert.match(desc, /\/devkit roadmap \[<n>\] runs the roadmap's ready changes, several at once, and \/devkit status shows where everything is/);
  assert.match(desc, /Use when the owner types \/devkit.*\/devkit roadmap.*\/devkit status/);
  const start = sectionOf(md, '## Start', '## A new change');
  assert.match(start, /- `roadmap`: the Roadmap section/);
  assert.match(start, /- `status`: the Status section/);
});

test('roadmap-loop skill: background hand-offs, one change per question, and the message that ends a turn', () => {
  const md = skillMd();
  // Invariant: where the host cannot start sessions, the coordinator hands each stage in the background, asks one change at a time and ends a
  // turn with its message. Layer: skill text. Suite: roadmap-loop. The opening paragraph and step 1 plus the part of today's steps 2 to 5.
  const roadmap = sectionOf(md, '## Roadmap', '### A session per change') + sectionOf(md, '### Every change in this session', '## Status');
  // The stages of every change are handed in the background, in one message; the starts and the session steps one at a time.
  assert.match(roadmap, /hand every one to its agent in one message, each as an Agent call with `run_in_background: true`/);
  assert.match(roadmap, /`subagent_type` set to the action's `agent` field and the prompt `brief` exactly as given/);
  assert.match(roadmap, /open the changes one after the other, never two at once/);
  assert.match(roadmap, /`session`: only then, one at a time/);
  assert.match(roadmap, /`wait`: start `node <skill-dir>\/\.\.\/\.\.\/hooks\/roadmap-loop\.mjs wait --change <id>[^`]*` with the Bash tool's background option/);
  assert.match(roadmap, /`hold`: start `node <skill-dir>\/\.\.\/\.\.\/hooks\/roadmap-loop\.mjs hold[^`]*` with the Bash tool's background option/);
  assert.ok(roadmap.includes('--after <id>=<progressKey of its action>'), 'a returned subagent passes the key of its action');
  assert.match(roadmap, /when a wait or a hold ends, run the same call with no `--after`/);
  assert.match(roadmap, /`Outcome: failure` is declared with `node [^`]*roadmap-loop\.mjs reply blocked --param id=<id> --param why=role-failed/);
  // One change per question; the answer belongs to that change only.
  assert.match(roadmap, /The owner is asked one change at a time\. `ask` names the change at the head of the owner's queue/);
  assert.match(roadmap, /naming that change in the question \(the grill's questions included/);
  assert.match(roadmap, /The answer is for that change only: record it as `## Owner gates` says/);
  // The message that ends a turn: the events, the plain lines, the end reply, and last the question, asked again after other events.
  const message = roadmap.split('\n').find((l) => l.startsWith('5. The message that ends a turn'));
  assert.ok(message, 'an item for the message that ends a turn');
  const at = (text) => { const i = message.indexOf(text); assert.ok(i >= 0, text); return i; };
  assert.ok(at('every `lines` entry') < at('the plain lines a call printed') && at('the plain lines a call printed') < at('the `end.reply`') && at('the `end.reply`') < at('last the `ask` question'));
  assert.match(message, /asked again when other events came after it/);
  assert.match(roadmap, /`run` with `stop` prints the rows of the changes that stay[^.]*\.[^.]*may repeat them: show them once/);
  // The run line is a record for the lock, never shown.
  assert.match(roadmap, /The first line printed is `devkit-roadmap: <n>` \(or `stop`\); it is the record the locks read: never show it/);
  // The Never list holds the roadmap rules.
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /In a roadmap run: hand two stages of one change at once, start a change `next` did not return, dispatch a subagent for a whole change, write the run file by hand, ask the owner about two changes in one question/);
  assert.match(sectionOf(md, '## Status', '## Never'), /show its output exactly as it is/);
});

test('roadmap-loop setting: the load_limit user setting', () => {
  const plugin = JSON.parse(readFileSync(join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.deepEqual(Object.keys(plugin.userConfig), ['language', 'load_limit']);
  const { load_limit: limit, language } = plugin.userConfig;
  assert.deepEqual(language, { type: 'string', title: 'Language', description: 'Language of the /devkit replies and of the stage readout: pt-BR or en', default: 'pt-BR' });
  assert.equal(limit.type, 'string');
  assert.equal(limit.default, '80');
  assert.ok(typeof limit.title === 'string' && limit.title.length > 0, 'a title');
  assert.match(limit.description, /whole number/);
  assert.equal(limitOf(limit.default), 80, 'the default reads as the default limit');
  const used = new Set([...skillMd().matchAll(/\$\{user_config\.(\w+)\}/g)].map((m) => m[1]));
  for (const key of used) assert.ok(key in plugin.userConfig, `the skill uses ${key}, which the plugin declares`);
  assert.ok(used.has('load_limit'));
});

test('roadmap-loop skill: every hand-off of a roadmap run starts with the change\'s brief line, and an unfilled setting is used silently', () => {
  const roadmap = sectionOf(skillMd(), '## Roadmap', '## Status');
  assert.match(roadmap, /every hand-off, the reviewers and verifiers of a review round included, starts with the line of the change's brief that names the change and its script \(`Change <id> \(<script> script\), stage \.\.\.`\)/);
  assert.match(roadmap, /a setting that arrives unfilled is used at its default without a word to the owner/);
});

// ---------------------------------------------------------------- the documents (phase 5: design D-14, D-15, D-16)

// Invariant (AC-16): the design, ADR 0013, the two Notes, the config, the flow page, the role document and both READMEs
// say what the roadmap coordinator is. Layer: the documents. Suite: this file.
test('roadmap-loop docs: the documents follow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const part = (md, from, to) => { const a = md.indexOf(from); assert.ok(a >= 0, from); const b = md.indexOf(to, a + from.length); return md.slice(a, b < 0 ? md.length : b); };
  const design = read('docs', 'coordination-design.md');
  assert.match(design, /Built in round 18\s+\(`roadmap-coordinator`\)/, 'section 2 says built');
  assert.doesNotMatch(design, /To be built in round 18/);
  assert.match(design, /Decided by\s+`roadmap-coordinator` on 2026-11-2\d \(A-6, grill questions 8 and 9\)/, 'the load is decided');
  assert.doesNotMatch(design, /How it measures load is open/);
  assert.match(design, /roadmap coordinator \(built, round 18\)/, 'stage 0 is built');
  assert.match(part(design, '## 10. ', '## 11. '), /each stage runs as a subagent in the\s+background/, 'section 10 names the background stages');
  assert.doesNotMatch(design, /each change has its change coordinator as a subagent/);
  assert.match(part(design, '## 13. ', '## Open points'), /Many background subagent ends in a row over whole changes \(not proved by round 19, whose phases run in the session; the first `\/devkit roadmap` run that carries several changes to their ends records it\)/);
  const open = part(design, '## Open points', '## What stays shipped');
  assert.doesNotMatch(open, /How the roadmap coordinator measures load/, 'the load point left Open points');
  assert.match(open, /how the load is measured/, 'the sentence names the load among the answered ones');
  const adr = read('docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md');
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0013 has ${h}`);
  }
  const link = '[ADR 0013](0013-the-roadmap-coordinator-is-the-owners-session.md)';
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  const adr11 = read('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  for (const t of [adr10, adr11]) {
    assert.match(t, /Note \(roadmap-coordinator, \d{4}-\d{2}-\d{2}\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0013');
  }
  if (/^- Status: accepted$/m.test(adr)) {
    for (const t of [adr10, adr11]) assert.match(t, /^- Amended by ADR 0013 \(0013-the-roadmap-coordinator-is-the-owners-session\.md\)$/m);
    assert.match(adr, /^- Accepted by: /m);
  }
  const adrs = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0013/, 'the ADRs line names 0013');
  const flow = read('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('## The roadmap coordinator: `/devkit roadmap` and `/devkit status`'), 'the flow page has the section');
  assert.match(read('docs', 'roles.md'), /^## roadmap-coordinator$/m);
  for (const f of [['plugins', 'openspec', 'README.md'], ['README.md']]) {
    const md = read(...f);
    assert.match(md, /\/devkit roadmap/, `${f.join('/')} names /devkit roadmap`);
    assert.match(md, /\/devkit status/, `${f.join('/')} names /devkit status`);
  }
});

test('roadmap-loop run: a word written to the pipe after a delay is still read', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  const late = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LOOP_FILE, 'run', ...FLAGS, '--session', 'S1'], { cwd: root, env: cleanEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout }));
    setTimeout(() => child.stdin.end('many'), 400);
  });
  assert.deepEqual([late.code, late.stdout], [0, `${render('en', 'roadmap-invalid', { word: 'many' })}\n`]);
});

test('stage-roles loop: gateOf names the mock-up approval as its own gate, said in both languages', () => {
  const act = endAct('x', 'waiting-for-owner', 'waiting-mockup', {}, { stage: 'mockup', stageTitle: 'Screen mock-up' });
  assert.equal(gateOf(act), 'mockup');
  for (const lang of ['en', 'pt-BR']) assert.ok(MESSAGES[lang]['gate.mockup'], `${lang} has gate.mockup`);
});

// ================================================================ roadmap-coordinator-followups: phase 1 (the run file and its locks)

const BAD_IDS = ['__proto__', '../x', '-a'];
// A process that has ended: its pid names no live process.
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;
const heldRoot = (over = {}) => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { session: 'S1', places: 1, ...over });
  return root;
};
const lockFileOf = (root) => join(dirname(runFileOf(root)), 'roadmap-run.lock');

test('followups AC-4 next: an --after id that is not a change id exits 3 and writes nothing', () => {
  for (const id of BAD_IDS) {
    const root = heldRoot();
    addOpen(root, 'a');
    const raw = readFileSync(runFileOf(root), 'utf8');
    const r = doNext(root, ['--after', `${id}=proposal`]);
    assert.equal(r.code, 3, `${id}: ${r.stdout}`);
    assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: the message names the id: ${r.stderr}`);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id}: the run file's bytes are unchanged`);
  }
});

test('followups AC-4 reply: an end declared for an id that is not a change id exits 3 and records nothing', () => {
  for (const id of BAD_IDS) {
    for (const extra of [['blocked', '--param', 'why=cannot-open', '--param', 'error=taken'], ['waiting-pr-decision', '--param', 'url=https://example.test/pr/1']]) {
      const root = heldRoot();
      const raw = readFileSync(runFileOf(root), 'utf8');
      const r = cmd(root, ['reply', extra[0], ...FLAGS, '--param', `id=${id}`, ...extra.slice(1)]);
      assert.equal(r.code, 3, `${id} ${extra[0]}: ${r.stdout}`);
      assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: ${r.stderr}`);
      assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id} ${extra[0]}: nothing recorded`);
    }
  }
});

test('followups AC-4 wait: a --change that is not a change id exits 3 and marks nothing in flight', async () => {
  for (const id of BAD_IDS) {
    const root = heldRoot();
    const raw = readFileSync(runFileOf(root), 'utf8');
    const marked = [];
    const r = await loopModule.runCommand(['wait', '--change', id, ...FLAGS, '--interval', '5'], {
      cwd: root, env: cleanEnv, gh: OFFLINE, sleep: async () => { marked.push(stateOf(root).inflight); },
    });
    assert.equal(r.code, 3, `${id}: ${r.stdout}`);
    assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: ${r.stderr}`);
    assert.deepEqual(marked, [], `${id}: it never waited`);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id}: marks nothing in flight`);
  }
});

test('followups AC-5 run file: a write that fails leaves no temporary file and throws', () => {
  const root = heldRoot();
  const file = join(root, 'scratch-run', 'roadmap-run.json');
  mkdirSync(file, { recursive: true }); // the path of the run file is a directory: the rename fails
  assert.throws(() => loopModule.updateRun(file, (run) => run));
  assert.deepEqual(readdirSync(dirname(file)).filter((name) => name.endsWith('.tmp')), [], 'no temporary file is left');
  assert.equal(existsSync(join(dirname(file), 'roadmap-run.lock')), false, 'the lock is released');
});

test('followups AC-6 lock: the run file\'s wait is at most half the agent hook\'s timeout', () => {
  const hooks = JSON.parse(readFileSync(join(HERE, 'hooks.json'), 'utf8')).hooks;
  const entry = hooks.PreToolUse.find((h) => h.matcher === 'Agent');
  const timeout = entry.hooks[0].timeout;
  assert.ok(Number.isInteger(timeout) && timeout > 0, 'the agent hook has a timeout');
  assert.ok(loopModule.LOCK.waitMs <= (timeout * 1000) / 2, `${loopModule.LOCK.waitMs} ms is more than half of ${timeout} s`);
});

test('followups AC-6 lock agent: a hand-off while the run file is locked is let through within the hook\'s time and logged run-file-busy', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  writeFileSync(lockFileOf(root), ''); // another call holds the run file: a fresh lock
  const log = join(lkSandbox(), 'hooks.jsonl');
  const started = Date.now();
  const r = lkHook('agent', lkAgentInput(root, lkRun(1), PLANNER_TYPE, BRIEF('a')), { TMPDIR: lkSandbox(), DEVKIT_HOOK_LOG: log, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' });
  const took = Date.now() - started;
  assert.equal(r.code, 0, r.err);
  assert.ok(took < 10_000, `answered in ${took} ms`);
  const records = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(records.map((x) => [x.mode, x.decision, x.why, x.change]), [['agent', 'allow', 'run-file-busy', 'a']]);
  assert.deepEqual(stateOf(root).inflight, {}, 'the stage is not marked in flight');
});

test('followups AC-7 next: a hold whose process ended asks for a new hold while loaded, and starts below the limit', () => {
  const dead = { pid: deadPid(), at: '2026-11-21T10:00:00.000Z' };
  for (const [name, holding] of [['an object with a dead pid', dead], ['the boolean of 0.18.0', true]]) {
    const root = heldRoot({ held: true, holding });
    const loaded = jsonOf(doNext(root, [], { load: 95 }).stdout);
    assert.deepEqual(loaded.actions.map((x) => [x.change, x.kind]), [['a', 'hold']], `${name}: a new watch is asked for`);
    const below = jsonOf(doNext(root, [], { load: 40 }).stdout);
    assert.deepEqual(below.actions.map((x) => [x.change, x.kind]), [['a', 'start']], `${name}: the held change starts`);
  }
  const alive = heldRoot({ held: true, holding: { pid: process.pid, at: '2026-11-21T10:00:00.000Z' } });
  assert.deepEqual(jsonOf(doNext(alive, [], { load: 95 }).stdout).actions, [], 'a watch still running: no second watch');
});

test('followups AC-7 hold: a killed hold process leaves a mark the next next does not trust', async () => {
  const root = heldRoot();
  const child = spawn(process.execPath, [LOOP_FILE, 'hold', '--lang', 'en', '--load-limit', '1', '--interval', '5'], { cwd: root, env: cleanEnv, stdio: 'ignore' });
  const ended = new Promise((resolve) => { child.on('exit', resolve); });
  try {
    let named = false;
    for (let i = 0; i < 80 && !named; i++) {
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      named = stateOf(root).holding?.pid === child.pid;
    }
    assert.ok(named, 'the run file names the pid of the hold');
  } finally {
    child.kill('SIGKILL');
    await ended;
  }
  assert.equal(stateOf(root).holding?.pid, child.pid, 'a killed process cleared nothing');
  assert.deepEqual(jsonOf(doNext(root, [], { load: 95 }).stdout).actions.map((x) => x.kind), ['hold']);
  assert.deepEqual(jsonOf(doNext(root, [], { load: 40 }).stdout).actions.map((x) => x.kind), ['start']);
});

test('followups AC-7 lock stop: a held start whose watch process ended is refused once, naming the watch to start', () => {
  const lkRoot = (holding) => { const root = lkProject(['[ ] a'], {}); putRun(root, { places: 1, held: true, holding }); return root; };
  for (const [name, holding] of [['a dead pid', { pid: deadPid(), at: '2026-11-21T10:00:00.000Z' }], ['the boolean of 0.18.0', true]]) {
    const root = lkRoot(holding);
    withTmp(() => {
      const opts = { opts: { load: () => 95 } };
      const first = stopOf(root, lkRun(1), opts).d;
      assert.deepEqual([first.decision, first.change], ['refuse', 'a'], name);
      assert.match(first.reason, /watch it with hold/, name);
    });
  }
  const alive = lkRoot({ pid: process.pid, at: '2026-11-21T10:00:00.000Z' });
  assert.equal(stopOf(alive, lkRun(1), { opts: { load: () => 95 } }).d.decision, 'allow', 'a watch still running lets the stop through');
});

test('followups AC-10 run: run without --session exits 3 and writes no run file', () => {
  const root = projectWith(roadmapText('[ ] a'));
  const r = cmd(root, ['run', ...FLAGS], { stdin: '2' });
  assert.equal(r.code, 3, r.stdout);
  assert.match(r.stderr, /run needs --session/);
  assert.equal(existsSync(runFileOf(root)), false, 'no run file');
});

test('followups AC-10 lock: updateRun on a held lock throws RunFileBusy after its wait, without sleeping for real', () => {
  const root = heldRoot();
  const lock = lockFileOf(root);
  writeFileSync(lock, '');
  const sleeps = [];
  assert.throws(() => loopModule.updateRun(runFileOf(root), (run) => run, { sleep: (ms) => { sleeps.push(ms); } }), loopModule.RunFileBusy);
  assert.equal(sleeps.reduce((a, b) => a + b, 0), loopModule.LOCK.waitMs, 'the sleeps add up to the wait');
  assert.equal(existsSync(lock), true, 'the other holder\'s lock is untouched');
});

test('followups AC-10 lock: next on a held run file lock exits 3 and leaves the file as it was', () => {
  const root = heldRoot();
  addOpen(root, 'a');
  writeFileSync(lockFileOf(root), '');
  const raw = readFileSync(runFileOf(root), 'utf8');
  const sleeps = [];
  const r = doNext(root, [], { lockSleep: (ms) => { sleeps.push(ms); } });
  assert.equal(r.code, 3, r.stdout);
  assert.match(r.stderr, /the run file is locked by another call/);
  assert.equal(sleeps.reduce((a, b) => a + b, 0), loopModule.LOCK.waitMs, 'it waited through the injected sleep');
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw);
});

test('followups AC-10 draft: an unknown files\' language writes the draft in English', () => {
  const root = gitRepo({ config: 'schema: devkit\ndevkit:\n  language: fr\n' });
  put(root, { 'openspec/changes/one/.openspec.yaml': 'schema: devkit\n' });
  commitAll(root, 'one');
  const r = cmd(root, ['draft', '--lang', 'pt-BR', '--load-limit', '80']);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.stdout, `${render('pt-BR', 'roadmap-drafted', { list: 'one' })}\n`, 'the reply is in the person\'s language');
  assert.equal(readFileSync(join(root, 'openspec', 'roadmap.md'), 'utf8'), '# Roadmap\n\n## Round 1: unfinished changes\n\n- [ ] one\n');
});

test('followups AC-10 guard: an edit and a shell write in a roadmap run read the transcript once', () => {
  const root = lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } });
  for (const [mode, input] of [
    ['edit', (t) => lkEdit(root, 'src/a.ts', t)],
    ['bash', (t) => lkBash(root, 'echo x > src/a.ts', t)],
  ]) {
    const transcript = lkRun(2);
    const spy = readCounter();
    const r = lkHook(mode, input(transcript), { TMPDIR: lkSandbox(), ...spy.env(transcript) });
    assert.equal(r.code, 2, `${mode}: ${r.err}`);
    assert.equal(spy.reads(), 1, `${mode}: the transcript is read once`);
  }
});

// ================================================================ roadmap-coordinator-followups, phase 2: the arguments, start anyway, the board

test('followups F-1 run: the arguments as typed start the run on the first call', () => {
  const roadmap = roadmapText('[ ] a', '[ ] b', '[ ] c');
  for (const [typed, marker, places] of [['roadmap 2', 'devkit-roadmap: 2', 2], ['Roadmap 3', 'devkit-roadmap: 3', 3], ['roadmap', 'devkit-roadmap: 1', 1], ['roadmap\n', 'devkit-roadmap: 1', 1], ['2', 'devkit-roadmap: 2', 2]]) {
    const root = projectWith(roadmap);
    const r = doRun(root, typed);
    assert.equal(r.code, 0, `${typed}: ${r.stdout}`);
    assert.equal(r.stdout.split('\n')[0], marker, typed);
    assert.equal(stateOf(root).places, places, typed);
  }
  // `roadmap many` is answered by name, nothing written.
  const many = projectWith(roadmap);
  const refused = doRun(many, 'roadmap many');
  assert.deepEqual([refused.code, refused.stdout], [0, `${render('en', 'roadmap-invalid', { word: 'many' })}\n`]);
  assert.equal(existsSync(runFileOf(many)), false);
  // `roadmap roadmap` drops one word only: the second is the invalid word.
  assert.equal(doRun(projectWith(roadmap), 'roadmap roadmap').stdout, `${render('en', 'roadmap-invalid', { word: 'roadmap' })}\n`);
  // `ROADMAP stop` after a run stops it.
  const run = projectWith(roadmap);
  doRun(run, 'roadmap 2');
  const stopped = doRun(run, 'ROADMAP stop');
  assert.equal(stopped.stdout.split('\n')[0], 'devkit-roadmap: stop');
  assert.equal(stateOf(run).stopping, true);
  // The parser itself.
  assert.deepEqual(loopModule.parseRunInput('roadmap 2'), { kind: 'places', places: 2 });
  assert.deepEqual(loopModule.parseRunInput('roadmap'), { kind: 'places', places: 1 });
  assert.deepEqual(loopModule.parseRunInput('ROADMAP stop'), { kind: 'stop' });
  assert.deepEqual(loopModule.parseRunInput('roadmap many'), { kind: 'invalid', word: 'many' });
  assert.deepEqual(loopModule.parseRunInput('2'), { kind: 'places', places: 2 });
  assert.deepEqual(loopModule.parseRunInput(undefined), { kind: 'places', places: 1 });
});

test('followups F-2 decide: start anyway starts the held changes once', () => {
  const lines = ['[ ] a', '[ ] b'];
  const held = decideRoadmap(world({ lines, places: 2, load: 95, limit: 80 }));
  assert.deepEqual(changesOf(held), [['a', 'hold']]);
  const anyway = decideRoadmap(world({ lines, places: 2, load: 95, limit: 80, startAnyway: true }));
  assert.deepEqual(changesOf(anyway), [['a', 'start'], ['b', 'start']], 'both held changes start whatever the load');
  assert.deepEqual(anyway.lines, [], 'no hold line is shown');
  assert.equal(anyway.state.held, false, 'the next hold is said again');
  assert.deepEqual(anyway.state.starting, ['a', 'b']);
  // Only the places that are free: the rest stays in the queue.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines: [...lines, '[ ] c'], places: 2, load: 95, limit: 80, startAnyway: true }))), [['a', 'start'], ['b', 'start']]);
  // A start never goes past the stop.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines, places: 2, load: 95, limit: 80, startAnyway: true, stopping: true }))), []);
});

test('followups AC-8 next: start anyway starts what is held now, and a change ready later is held and said again', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  putRun(root, { places: 3 });
  const before = Object.keys(stateOf(root)).sort();
  const first = doNext(root, ['--start-anyway'], { load: 95 });
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(jsonOf(first.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'start'], ['b', 'start']]);
  assert.ok(!events(first.stdout).some((l) => l.includes('machine is loaded')), 'no line about the hold');
  assert.deepEqual(Object.keys(stateOf(root)).filter((k) => k !== 'updatedAt').sort(), before, 'the run file gains no field but the time of its write');
  assert.equal(JSON.stringify(stateOf(root)).toLowerCase().includes('anyway'), false, 'nothing keeps the permission');
  // Later in the same run: a and b are open, c is ready, a place is free, the load is still high, and the call has no flag.
  addOpen(root, 'a');
  addOpen(root, 'b');
  writeFileSync(join(root, 'openspec', 'roadmap.md'), roadmapText('[ ] a', '[ ] b', '[ ] c'));
  const later = doNext(root, [], { load: 95 });
  assert.ok(jsonOf(later.stdout).actions.some((x) => x.change === 'c' && x.kind === 'hold'), 'c is held');
  assert.ok(events(later.stdout).includes(`▸ ${render('en', 'roadmap-held', { id: 'c', load: 95, limit: 80 })}`), 'its hold line is shown again');
  // The hold line ends with the start-anyway sentence, in both languages.
  assert.match(render('en', 'roadmap-held', { id: 'c', load: 95, limit: 80 }), /Tell me to start anyway and it starts now\.$/);
  assert.match(render('pt-BR', 'roadmap-held', { id: 'c', load: 95, limit: 80 }), /Se quiser começar mesmo assim, é só dizer\.$/);
  // Only `next` takes the flag.
  assert.equal(cmd(root, ['status', ...FLAGS, '--start-anyway']).code, 3);
});

test('followups AC-1 status: a ready line waits for a place only when the places are taken', () => {
  const lines = ['[ ] d', '[ ] a', '[ ] b', '[ ] c'];
  const text = boardOf(world({ lines, places: 3, load: 10, actions: { d: agentAct('d') } }));
  assert.match(text, /a {3}ready to start\n/);
  assert.match(text, /b {3}ready to start\n/);
  assert.match(text, /c {3}ready, waits for a place$/);
  assert.doesNotMatch(text, /Starts held|held by the load/);
  const pt = boardOf(world({ lang: 'pt-BR', lines, places: 3, load: 10, actions: { d: agentAct('d') } }));
  assert.match(pt, /a {3}pronta para começar\n/);
  assert.match(pt, /c {3}pronta, espera vaga$/);
  // Every place taken: waits for a place whatever the load.
  for (const load of [10, 95]) assert.match(boardOf(world({ lines: ['[ ] d', '[ ] a'], places: 1, load, actions: { d: agentAct('d') } })), /a {3}ready, waits for a place$/, `load ${load}`);
  // A free place and a loaded machine: the load holds both.
  const loaded = boardOf(world({ lines: ['[ ] a', '[ ] b'], places: 2, load: 92 }));
  assert.match(loaded, /Starts held/);
  assert.match(loaded, /a {3}ready, held by the load\n/);
  assert.match(loaded, /b {3}ready, held by the load$/);
});

test('followups AC-2 decide: a gate or blocked line says the others go on only when another change is under way', () => {
  const ceiling = (id) => blockedAct(id, 'ceiling', { stage: 'Plan readiness', attempt: 3 });
  const gateLine = (r) => r.lines.find((l) => /waits for|espera/.test(l));
  const blockedLine = (r) => r.lines.find((l) => /stopped|parou/.test(l));
  const announced = { a: 'started', b: 'started' };
  const alone = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ownerAct('a') }, announced }));
  assert.equal(gateLine(alone), say('roadmap-gate', { id: 'a', gate: 'approval' }));
  assert.doesNotMatch(gateLine(alone), /others go on/);
  const aloneBlocked = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ceiling('a') }, announced }));
  assert.equal(blockedLine(aloneBlocked), say('roadmap-blocked', { id: 'a', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }));
  assert.doesNotMatch(blockedLine(aloneBlocked), /others go on/);
  assert.match(blockedLine(aloneBlocked), /The changes after it wait\.$/);
  // Another change under way: a stage handed, a stage in flight, a wait on GitHub, a start.
  const others = [
    ['a stage handed', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: agentAct('b') }) }],
    ['a stage in flight', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: agentAct('b') }), inflight: { b: FLYING } }],
    ['a wait', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: githubAct('b') }) }],
    ['a start', { lines: ['[ ] a', '[ ] b'], places: 2, actions: (own) => ({ a: own }) }],
  ];
  for (const [name, { actions, ...rest }] of others) {
    const gate = decideRoadmap(world({ ...rest, actions: actions(ownerAct('a')), announced }));
    assert.equal(gateLine(gate), say('roadmap-gate-others', { id: 'a', gate: 'approval' }), name);
    assert.match(gateLine(gate), /The others go on\.$/, name);
    const blocked = decideRoadmap(world({ ...rest, actions: actions(ceiling('a')), announced }));
    assert.equal(blockedLine(blocked), say('roadmap-blocked-others', { id: 'a', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }), name);
    assert.match(blockedLine(blocked), /The others go on, and the changes after it wait\.$/, name);
    assert.equal(blocked.state.announced.a, 'blocked:ceiling', `${name}: the announced key does not change`);
  }
  // The same state is still said once.
  const first = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced }));
  assert.equal(decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced: first.state.announced })).lines.length, 0);
  // Brazilian Portuguese.
  const pt = decideRoadmap(world({ lang: 'pt-BR', lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced }));
  assert.match(gateLine(pt), /^▸ a espera a sua aprovação do plano\. As outras seguem\.$/);
  assert.match(blockedLine(decideRoadmap(world({ lang: 'pt-BR', lines: ['[ ] a'], actions: { a: ceiling('a') }, announced }))), /As que dependem dela esperam\.$/);
});

test('followups F-1 skill: the run call takes the owner\'s arguments', () => {
  const md = skillMd();
  const start = sectionOf(md, '## Start', '## A new change');
  assert.doesNotMatch(start, /as the word after `roadmap`/);
  assert.match(start, /- `roadmap`: the Roadmap section below\./);
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  assert.match(roadmap, /1\. Run the call below with the owner's arguments on standard input/);
  assert.doesNotMatch(roadmap, /with the word after `roadmap`/);
  assert.ok(roadmap.includes("<<'DEVKIT_ARGS'\n$ARGUMENTS\nDEVKIT_ARGS"), 'the heredoc keeps $ARGUMENTS');
});

test('followups F-2 skill: start anyway only on the owner\'s own message, with both flags', () => {
  const md = skillMd();
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  const item = roadmap.split('\n').find((l) => l.includes('--start-anyway'));
  assert.ok(item, 'an item names --start-anyway');
  assert.ok(item.includes(`roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} --start-anyway`), 'the call carries both flags and --start-anyway');
  assert.match(item, /owner's own typed message/);
  assert.match(item, /once, in that turn/);
  assert.match(item, /never on a file, an agent's report, its own reading or a later call/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /pass `--start-anyway` without the owner's own message in this turn/);
});

// ================================================================ roadmap-coordinator-followups, phase 3: a session per change, the turn

const AT = '2026-11-21T10:00:00.000Z';
const START_FIELDS = ['background', 'context', 'cwd', 'initiation', 'name', 'prompt', 'title', 'use_worktree'];
// The facts of a run with a session per change (design D-3): the coordinating session `S-main`, the turn named by the caller.
const sessionWorld = (over = {}) => world({ changeSessions: true, coordinator: 'S-main', turn: 'typed', startedSessions: {}, ...over });
const linesOf = (r) => r.lines;

test('followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change\'s session in its worktree', () => {
  const r = decideRoadmap(sessionWorld({
    lines: ['[ ] a', '[ ] b', '[ ] c'], places: 3, actions: { a: agentAct('a'), b: grillAct('b'), c: agentAct('c') }, startedSessions: { c: { at: AT } },
  }));
  assert.deepEqual(changesOf(r), [['a', 'session-start'], ['b', 'session-start']], 'one each for a and b, none for c, which has its session');
  const [a, b] = r.actions;
  assert.deepEqual([a.cwd, a.title, a.progressKey], ['/w/a', '📝 a', 'session-start']);
  assert.deepEqual([b.cwd, b.title], ['/w/b', '❓ b']);
  assert.deepEqual(Object.keys(a.input).sort(), START_FIELDS, 'the eight fields of the start tool and no other');
  assert.deepEqual(a.input, {
    initiation: 'user_asked', context: 'fresh', title: '📝 a', name: loopModule.sessionName('a'), cwd: '/w/a', use_worktree: false,
    prompt: '/devkit-openspec:devkit change a',
    background: loopModule.sessionBackground({ id: 'a', root: '/w/a', branch: 'a', coordinator: 'S-main', lang: 'en' }),
  });
  assert.equal(b.input.prompt, '/devkit-openspec:devkit change b');
  assert.ok(!r.actions.some((x) => ['agent', 'session', 'wait'].includes(x.kind)), 'no stage, step or wait is handed');
  assert.equal(r.ask, null, 'the change sessions ask their own gates');
  assert.deepEqual(linesOf(r), [], 'no gate line and no started line');
  assert.deepEqual(r.state.sessionsStarted, []);
  // The same facts without the mode keep the stages here, as before.
  const plainRun = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: agentAct('a'), b: grillAct('b') } }));
  assert.deepEqual(changesOf(plainRun), [['a', 'agent']]);
  assert.equal(plainRun.ask.change, 'b');
});

test('followups AC-13 name: sessionName gives the start\'s name, [a-z0-9-] and at most 24 characters', () => {
  assert.equal(loopModule.sessionName('roadmap-coordinator-followups'), 'roadmap-coordinator-foll');
  assert.equal(loopModule.sessionName('A_b.c'), 'a-b-c');
  assert.equal(loopModule.sessionName('___'), 'change');
  assert.equal(loopModule.sessionName('x'.repeat(40)), 'x'.repeat(24));
  assert.equal(loopModule.sessionName('abcdefghijklmnopqrstuvw-xyz'), 'abcdefghijklmnopqrstuvw', 'a dash left at the cut is removed');
  for (const id of ['a', 'roadmap-coordinator-followups', 'A_b.c', '9.x', 'x'.repeat(60)]) assert.match(loopModule.sessionName(id), /^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$/, id);
});

test('followups AC-13 run: --change-sessions is recorded, and a run without it keeps the stages in the session', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const plainRun = doRun(root, 'roadmap');
  assert.deepEqual([stateOf(root).changeSessions, stateOf(root).turn], [false, 'typed']);
  assert.deepEqual(jsonOf(plainRun.stdout).actions, [], 'the grill is asked here, nothing is handed');
  assert.equal(jsonOf(plainRun.stdout).ask.change, 'a');
  const sessions = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(sessions.code, 0, sessions.stdout);
  assert.equal(stateOf(root).changeSessions, true);
  const j = jsonOf(sessions.stdout);
  assert.deepEqual(j.actions.map((x) => [x.change, x.kind]), [['a', 'session-start']]);
  assert.equal(j.ask, null);
  assert.equal(j.actions[0].cwd, realpathSync(root));
  // A stop leaves the mode as it was, and a later run without the flag goes back to the stages in the session.
  doRun(root, 'stop');
  assert.equal(stateOf(root).changeSessions, true);
  doRun(root, 'roadmap');
  assert.equal(stateOf(root).changeSessions, false);
});

test('followups AC-13 run: a run from another session keeps the started change sessions and gives them no second session, and --fresh forgets them', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { session: 'S1', places: 1, changeSessions: true, startedSessions: { a: { at: AT } }, turn: 'typed', announced: { a: 'session' } });
  const other = doRun(root, 'roadmap', { session: 'S2', extra: ['--change-sessions'] });
  assert.equal(other.code, 0, other.stdout);
  assert.equal(stateOf(root).session, 'S2');
  assert.deepEqual(stateOf(root).startedSessions, { a: { at: AT } }, 'kept');
  assert.deepEqual(stateOf(root).announced, {}, 'everything else starts empty');
  assert.deepEqual(jsonOf(other.stdout).actions, [], 'a is not given a second session');
  const fresh = doRun(root, 'roadmap', { session: 'S2', extra: ['--change-sessions', '--fresh'] });
  assert.deepEqual(stateOf(root).startedSessions, {}, '--fresh forgets them');
  assert.deepEqual(jsonOf(fresh.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'session-start']]);
});

test('followups AC-13 next: a reported session start is recorded once, said once and never started again, and a change no longer open leaves the record', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  addOpen(root, 'a');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { gone: { at: AT } } });
  const first = doNext(root, ['--turn', 'typed', '--after', 'a=session-start']);
  assert.equal(first.code, 0, first.stdout);
  assert.ok(events(first.stdout).includes(say('roadmap-session-started', { id: 'a', open: 1, places: 2 })), events(first.stdout).join('|'));
  assert.equal(typeof stateOf(root).startedSessions.a.at, 'string');
  assert.equal('gone' in stateOf(root).startedSessions, false, 'a change that is not an open line leaves the record');
  assert.deepEqual(jsonOf(first.stdout).actions.map((x) => [x.change, x.kind]), [['b', 'start']], 'only the ready line starts; a gets no second session');
  const again = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(events(again.stdout), [], 'said once');
  assert.ok(!jsonOf(again.stdout).actions.some((x) => x.change === 'a'));
  assert.deepEqual(Object.keys(stateOf(root).startedSessions), ['a']);
});

test('followups AC-13 decide: a change in its own session counts as under way for the end of the run, and a stop ends the run with each change staying in its session', () => {
  const facts = (over = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: null, b: null }, startedSessions: { a: { at: AT }, b: { at: AT } }, announced: { a: 'session', b: 'session' }, wheres: { a: 'plan', b: 'code' }, ...over });
  const running = decideRoadmap(facts());
  assert.deepEqual([running.end, running.actions, running.open], [null, [], ['a', 'b']]);
  const stopped = decideRoadmap(facts({ stopping: true }));
  assert.equal(stopped.end.why, 'stopped');
  assert.equal(stopped.end.reply, [render('en', 'roadmap-ended-stopped'), render('en', 'roadmap-stayed', { id: 'a', where: 'plan' }), render('en', 'roadmap-stayed', { id: 'b', where: 'code' })].join('\n'));
  assert.deepEqual(stopped.actions, [], 'no session is started');
});

test('followups AC-13 decide: a change archived in its session frees its place, and on the event turn its report starts, the next ready line gets its line and waits for the owner\'s next message', () => {
  const facts = (turn, announced = { a: 'session' }) => sessionWorld({ lines: ['[ ] a', '[ ] c'], archived: ['a'], places: 1, turn, announced, startedSessions: { a: { at: AT } } });
  const event = decideRoadmap(facts('event'));
  assert.deepEqual(event.lines, [say('roadmap-archived', { id: 'a' }), say('roadmap-waits-turn', { id: 'c' })]);
  assert.deepEqual(event.actions, [], 'c is not opened on that turn');
  assert.deepEqual(event.state.starting, []);
  assert.equal(event.end, null, 'a change waiting for the owner\'s next message is not the end of the run');
  assert.deepEqual(decideRoadmap(facts('event', event.state.announced)).lines, [], 'said once');
  const typed = decideRoadmap(facts('typed', event.state.announced));
  assert.deepEqual(changesOf(typed), [['c', 'start']], 'the owner\'s next message starts it');
  assert.deepEqual(typed.state.starting, ['c']);
});

test('followups AC-13 background: the brief names the change, its worktree and branch, the coordinating session, the person\'s language, the title rule and the archive line, and has at least 80 characters', () => {
  const text = loopModule.sessionBackground({ id: 'a-change', root: '/w/a-change', branch: 'a-change-branch', coordinator: 'S-main', lang: 'pt-BR' });
  for (const part of ['`a-change`', '/w/a-change', 'a-change-branch', 'S-main', 'pt-BR', '`sessionTitle`', 'devkit roadmap: a-change archived', 'a session of its own', 'who started this session']) {
    assert.ok(text.includes(part), `names ${part}`);
  }
  assert.ok(text.length >= 80);
  assert.ok(loopModule.sessionBackground({ id: 'x', root: '/', branch: 'x', coordinator: null, lang: 'en' }).length >= 80, 'also for the smallest input');
});

test('followups AC-13 lock agent: in a run with a session per change every hand-off of the coordinating session is refused and nothing is marked under way', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, changeSessions: true });
  const transcript = lkRun(1);
  const d = agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a')));
  assert.deepEqual([d.decision, d.why, d.change], ['refuse', 'own-sessions', 'a']);
  assert.match(d.reason, /each change runs in a session of its own: its stages are handed in that session, not here/);
  assert.deepEqual(stateOf(root).inflight, {}, 'nothing is marked under way');
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, 'do it')).why, 'own-sessions', 'with no brief too');
  const sub = agentOf({ ...lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a')), agent_type: PLANNER_TYPE });
  assert.deepEqual([sub.decision, sub.why], ['allow', 'subagent'], 'a subagent\'s own hand-off is let through');
  putRun(root, { places: 1 });
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a'))).decision, 'allow', 'without the mode the hand-off is allowed as before');
});

test('followups AC-13 lock stop: a change session to start on a typed turn is refused once, and every change in its own session lets the stop through', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT } } });
  const transcript = lkRun(2);
  withTmp(() => {
    const first = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([first.decision, first.why, first.change], ['refuse', 'stage-ready', 'b']);
    assert.match(first.reason, /the change b has no session of its own yet: start it/);
    assert.deepEqual(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).why, 'same-state', 'once');
  });
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT }, b: { at: AT } } });
  withTmp((tmp) => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], 'every change in its own session');
    nothingRecorded(tmp);
  });
});

test('followups AC-15 decide: on a turn nobody typed a start and a session start become one line each, said once, and on the owner\'s next turn they start', () => {
  const facts = (turn, announced = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b'], places: 3, turn, announced, actions: { a: grillAct('a') } });
  const typed = decideRoadmap(facts('typed'));
  assert.deepEqual(changesOf(typed), [['a', 'session-start'], ['b', 'start']]);
  assert.equal(typed.state.turn, 'typed');
  const event = decideRoadmap(facts('event'));
  assert.deepEqual(event.actions, [], 'neither is carried out');
  assert.deepEqual(event.lines, [say('roadmap-waits-turn', { id: 'a' }), say('roadmap-waits-turn', { id: 'b' })]);
  assert.deepEqual([event.state.turn, event.state.starting, event.state.announced], ['event', [], { a: 'waits-turn', b: 'waits-turn' }], 'a withheld start is not recorded as handed');
  assert.deepEqual(decideRoadmap(facts('event', event.state.announced)).lines, [], 'said once');
  const next = decideRoadmap(facts('typed', event.state.announced));
  assert.deepEqual(changesOf(next), [['a', 'session-start'], ['b', 'start']], 'the owner\'s next turn starts them');
  assert.deepEqual(next.lines, []);
  assert.match(say('roadmap-waits-turn', { id: 'a' }, 'pt-BR'), /^▸ a está pronta e começa numa sessão própria na sua próxima mensagem: o app só abre sessão num turno que você digitou\.$/);
  // In a run that keeps the stages in this session, the turn changes nothing.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines: ['[ ] a'], places: 1, turn: 'event' }))), [['a', 'start']]);
});

test('followups AC-15 decide: the load eases on a turn nobody typed and the held change waits for the owner\'s next message with its line', () => {
  const facts = (over) => sessionWorld({ lines: ['[ ] a'], places: 1, turn: 'event', ...over });
  const held = decideRoadmap(facts({ load: 95, limit: 80 }));
  assert.deepEqual(changesOf(held), [['a', 'hold']], 'a loaded machine is still watched');
  const eased = decideRoadmap(facts({ load: 40, limit: 80, held: true, holding: false }));
  assert.deepEqual(eased.actions, []);
  assert.deepEqual(eased.lines, [say('roadmap-waits-turn', { id: 'a' })]);
  assert.equal(eased.state.held, false);
  assert.match(eased.lines[0], /the app starts a session only on a turn you typed/);
  assert.deepEqual(changesOf(decideRoadmap(facts({ load: 40, limit: 80, held: true, holding: false, turn: 'typed' }))), [['a', 'start']], 'the owner\'s message starts it');
});

test('followups AC-15 next: a refused session start gives its line, records the turn as event and asks for no other start on that turn', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  addOpen(root, 'a');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed' });
  const r = doNext(root, ['--turn', 'typed', '--after', 'a=session-refused']);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(events(r.stdout), [say('roadmap-waits-refused', { id: 'a' }), say('roadmap-waits-turn', { id: 'b' })]);
  assert.deepEqual(jsonOf(r.stdout).actions, [], 'no session start and no start on that turn');
  const state = stateOf(root);
  assert.deepEqual([state.turn, state.announced.a, state.announced.b, state.startedSessions], ['event', 'waits-refused', 'waits-turn', {}]);
  assert.deepEqual(events(doNext(root, ['--turn', 'event']).stdout), [], 'said once');
  assert.match(say('roadmap-waits-refused', { id: 'a' }, 'pt-BR'), /^▸ a não pôde começar numa sessão própria: o app recusou\. Ela começa na sua próxima mensagem\.$/);
});

test('followups AC-15 next: a start that gave no session id is reported as session-refused, the line shows once and the change starts on the owner\'s next typed turn', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  // The key is the outcome of the call, never its text: the skill reports every result but a session id.
  const skill = readFileSync(new URL('../skills/devkit/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('when the call returns anything but a session id (a refusal of any wording, an error or a missing tool)'), 'the skill keys the refusal on the outcome of the call');
  const refused = doNext(root, ['--turn', 'event', '--after', 'a=session-refused']);
  assert.equal(refused.code, 0, refused.stdout);
  assert.deepEqual(events(refused.stdout), [say('roadmap-waits-refused', { id: 'a' })]);
  assert.deepEqual(jsonOf(refused.stdout).actions, [], 'nothing starts on the refused turn');
  assert.equal(stateOf(root).announced.a, 'waits-refused');
  const again = doNext(root, ['--turn', 'event']);
  assert.deepEqual([events(again.stdout), jsonOf(again.stdout).actions], [[], []], 'said once, still waiting for a typed turn');
  const typed = doNext(root, ['--turn', 'typed']);
  assert.equal(typed.code, 0, typed.stdout);
  assert.deepEqual(changesOf(jsonOf(typed.stdout)), [['a', 'session-start']], 'the owner\'s typed message starts it');
});

test('followups AC-15 next: --turn takes typed or event, refuses any other word (message and an empty word included) with exit 3 and the run file\'s bytes unchanged, and no --turn reads as event', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  const raw = readFileSync(runFileOf(root), 'utf8');
  for (const word of ['message', '', 'Typed', 'both']) {
    const r = doNext(root, ['--turn', word]);
    assert.equal(r.code, 3, `${JSON.stringify(word)}: ${r.stdout}`);
    assert.ok(r.stderr.includes(`--turn takes typed or event: got ${word}`), r.stderr);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${JSON.stringify(word)}: the run file's bytes are unchanged`);
  }
  const none = doNext(root);
  assert.equal(none.code, 0, none.stdout);
  assert.deepEqual(jsonOf(none.stdout).actions, [], 'no start without a typed turn');
  assert.deepEqual(events(none.stdout), [say('roadmap-waits-turn', { id: 'a' })]);
  assert.equal(stateOf(root).turn, 'event');
  const typed = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(jsonOf(typed.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'start']]);
  assert.equal(stateOf(root).turn, 'typed');
});

test('followups AC-15 decide: every withheld start has its line in the same decision or an announced one', () => {
  const table = {
    'two ready lines': { lines: ['[ ] a', '[ ] b'], places: 2 },
    'a ready line and an open change at its grill': { lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: grillAct('a') } },
    'open changes at a stage, a gate, a wait and blocked': {
      lines: ['[ ] a', '[ ] b', '[ ] c', '[ ] d', '[ ] e'], places: 5,
      actions: { a: agentAct('a'), b: ownerAct('b'), c: githubAct('c'), d: blockedAct('d', 'ceiling', { stage: 'Plan readiness', attempt: 3 }) },
    },
    'a change in flight from an earlier run': { lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: agentAct('a') }, inflight: { a: FLYING } },
    'a start held by the load, then eased': { lines: ['[ ] a'], places: 1, load: 30, held: true },
  };
  for (const [name, spec] of Object.entries(table)) {
    const typed = decideRoadmap(sessionWorld({ ...spec, turn: 'typed' }));
    const withheld = typed.actions.filter((x) => x.kind === 'start' || x.kind === 'session-start').map((x) => x.change);
    assert.ok(withheld.length > 0, `${name}: the typed turn starts something`);
    const event = decideRoadmap(sessionWorld({ ...spec, turn: 'event' }));
    assert.deepEqual(event.actions.filter((x) => x.kind === 'start' || x.kind === 'session-start'), [], `${name}: nothing starts on a turn nobody typed`);
    for (const id of withheld) {
      assert.ok(event.lines.some((l) => l.includes(` ${id} `) && /next message/.test(l)) && event.state.announced[id] === 'waits-turn', `${name}: ${id} has its line`);
      const again = decideRoadmap(sessionWorld({ ...spec, turn: 'event', announced: event.state.announced }));
      assert.deepEqual(again.lines.filter((l) => /next message/.test(l)), [], `${name}: said once, the state was announced`);
      assert.equal(again.state.announced[id], 'waits-turn', `${name}: ${id} stays announced`);
    }
  }
});

test('followups AC-15 lock stop: after a decision on a turn nobody typed the stop is let through', () => {
  const root = lkProject(['[ ] c'], {});
  putRun(root, { places: 1, changeSessions: true, turn: 'event' });
  withTmp((tmp) => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, lkRun(1)), lkOpts());
    assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], 'c waits for the owner\'s next message');
    nothingRecorded(tmp);
  });
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  withTmp(() => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, lkRun(1)), lkOpts());
    assert.deepEqual([d.decision, d.change], ['refuse', 'c'], 'on a typed turn it is ready');
    assert.match(d.reason, /the change c is ready to start: open it/);
  });
});

test('followups AC-15 status: a line left for the owner\'s next message reads so in the queue, and an open change with no session says it starts at the next message', () => {
  const lines = ['[ ] a', '[ ] b', '[ ] c', '[ ] d', '[ ] e'];
  const text = boardOf(sessionWorld({
    lines, places: 5, announced: { a: 'waits-turn', b: 'waits-refused' },
    actions: { c: agentAct('c'), d: ownerAct('d'), e: agentAct('e') }, startedSessions: { d: { at: AT }, e: { at: AT } },
  }));
  assert.match(text, /a {3}ready: starts in a session of its own at your next message\n/);
  assert.match(text, /b {3}ready: starts in a session of its own at your next message(\n|$)/);
  assert.match(text, /c {3}no session of its own yet: it starts at your next message\n/);
  assert.match(text, /Waiting for you\n {2}d {3}your approval of the plan/, 'an own change at its gate shows its gate');
  assert.match(text, /e {3}Proposal/, 'an own change under way shows its stage');
  const pt = boardOf(sessionWorld({ lang: 'pt-BR', lines: ['[ ] a', '[ ] c'], places: 3, announced: { a: 'waits-turn' }, actions: { c: agentAct('c') } }));
  assert.match(pt, /a {3}pronta: começa numa sessão própria na sua próxima mensagem(\n|$)/);
  assert.match(pt, /c {3}ainda sem sessão própria: começa na sua próxima mensagem/);
  // Without the mode the same announced state changes no row.
  assert.match(boardOf(world({ lines: ['[ ] a'], places: 1, announced: { a: 'waits-turn' } })), /a {3}ready to start/);
});

test('followups AC-13 skill: the session-per-change part names the tools, the list check, the session keys and the turn, and hands nothing', () => {
  const md = skillMd();
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  const first = roadmap.indexOf('### A session per change');
  const second = roadmap.indexOf('### Every change in this session');
  assert.ok(first > 0 && second > first, 'the two parts, in this order');
  const one = roadmap.slice(roadmap.indexOf('1. Run the call below'), first);
  assert.ok(one.includes('select:mcp__ccd_session__start_session'), 'step 1 loads the start tool before run');
  assert.ok(one.includes('`--change-sessions`'), 'and adds the flag when it loads');
  const part = roadmap.slice(first, second);
  assert.doesNotMatch(part, /^5\. /m, 'no item starting 5.');
  for (const text of [
    'select:mcp__ccd_session_mgmt__list_sessions', 'select:mcp__ccd_session__start_session',
    '`mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`', '`mcp__ccd_session__start_session` with the action\'s `input` exactly as given',
    '`session-start`', '`session-refused`', '`isArchived`', '`cwd`', 'a `title` ending in the change id', 'one session start at a time',
    'devkit roadmap: <id> archived', 'the session hands no stage, asks no gate and starts no wait on GitHub',
  ]) assert.ok(part.includes(text), `the part says ${text}`);
  assert.match(part, /end-of-turn report[^\n]*`event` turn/);
  assert.match(part, /--after <id>=session-start/);
  assert.match(part, /--after <id>=session-refused/);
  // The other part keeps today's steps 2 to 5, word for word.
  const every = roadmap.slice(second);
  assert.ok(every.includes('2. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:'));
  assert.ok(every.includes('5. The message that ends a turn holds, in order:'));
  assert.ok(every.includes('Calling `/devkit roadmap` again at any time is safe'));
  assert.doesNotMatch(md, /wake_when_done|SendMessage/, 'no wake field and no message tool');
  const never = md.slice(md.indexOf('## Never'));
  assert.ok(never.includes('In a run with a session per change: hand a stage, ask a change\'s gate or start a wait on GitHub from this session, start a change session `next` did not return, or call the session-start tool with any input but the action\'s `input`'));
});

test('followups AC-14 skill: a change session renames its title from the sessionTitle of each next', () => {
  const loop = sectionOf(skillMd(), '## Loop', '## Owner gates');
  const item = loop.split('\n').find((l) => l.includes('mcp__ccd_session_mgmt__set_session_title') && l.includes('sessionTitle'));
  assert.ok(item, 'a Loop item renames the title');
  for (const text of ['select:mcp__ccd_session_mgmt__set_session_title', '`mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the action\'s `sessionTitle`', 'main thread', 'Background (from the session that started this one):', '`/devkit roadmap`']) {
    assert.ok(item.includes(text), `the item says ${text}`);
  }
  assert.match(item, /not retried for the same `sessionTitle`/);
  assert.match(item, /before carrying out the action/);
});

test('followups AC-15 skill: the turn\'s two words, event when in doubt or on another session\'s note, and next first on a typed turn', () => {
  const part = sectionOf(skillMd(), '### A session per change', '### Every change in this session');
  const item = part.split('\n').find((l) => l.includes('--turn <typed|event>'));
  assert.ok(item, 'an item names the turn flag');
  assert.ok(item.includes(`roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} --turn <typed|event>`), 'with both settings');
  assert.match(item, /`typed` when the turn began with the owner's own message/);
  assert.match(item, /`event` otherwise/);
  assert.match(item, /another session's message or end-of-turn report/);
  assert.match(item, /when in doubt/);
  assert.match(part, /on a turn the owner typed[^\n]*--turn typed` before anything else/);
  assert.match(part, /start anyway: [^\n]*item 4a of the second part[^\n]*`--turn typed`/, 'start anyway is a typed turn');
});

// ================================================================ roadmap-coordinator-followups: phase 4 (the ADRs and the documents)

// Invariant (AC-3): every field the run file holds is named in ADR 0013 decision 4, and every field named there is held.
// Layer: the documents against the run file. Suite: this file.
test('followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4, and every field named there is held', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const run = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(run.code, 0, run.stdout);
  const next = doNext(root, ['--turn', 'typed', '--after', 'a=session-start']);
  assert.equal(next.code, 0, next.stdout);
  const held = await loopModule.runCommand(['hold', ...FLAGS, '--interval', '5'], { cwd: root, env: cleanEnv, load: () => 1, sleep: async () => {} });
  assert.equal(held.code, 0, held.stdout);
  const keys = Object.keys(stateOf(root)).sort();
  assert.ok(keys.includes('holding') && keys.includes('startedSessions') && keys.includes('turn'), keys.join(','));

  const adr = readFileSync(join(HERE, '..', '..', '..', 'docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md'), 'utf8');
  const decision = adr.slice(adr.indexOf('## Decision'), adr.indexOf('## Consequences'));
  const start = decision.search(/^4\. /m);
  const end = decision.search(/^5\. /m);
  assert.ok(start >= 0 && end > start, 'decision 4 is item 4 of the Decision');
  const named = [...decision.slice(start, end).matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]).sort();
  assert.deepEqual(named, keys, 'the fields named in decision 4 are the fields the run file holds');
});

// Invariant (AC-13, AC-14, AC-15): ADR 0014 is accepted with its six icons, ADRs 0010, 0011 and 0013 carry its Note and
// header line, and the config names it. Layer: the documents. Suite: this file.
test('followups ADR 0014: the documents follow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const name = '0014-each-roadmap-change-runs-in-a-session-of-its-own.md';
  const link = `[ADR 0014](${name})`;
  const adr = read('docs', 'adr', name);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0014 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Accepted by: .*approval\.md/m);
  assert.match(adr, /^- Supersedes: ADR 0013 \(0013-the-roadmap-coordinator-is-the-owners-session\.md\)/m);
  assert.match(adr, /^- Amends: ADR 0013, decisions 3 and 4; ADR 0011 \(0011-the-change-coordinator-is-the-owners-session\.md\)/m);
  for (const icon of ['❓ requirements', '📝 plan', '🛠️ code', '🔍 review', '🚀 delivery', '📦 archive']) assert.ok(adr.includes(icon), `ADR 0014 names ${icon}`);
  const amended = `- Amended by ADR 0014 (${name})`;
  const adr13 = read('docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md');
  const adr11 = read('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  for (const t of [adr13, adr11]) assert.ok(t.split('\n').includes(amended), 'the header line');
  for (const t of [adr13, adr11, adr10]) {
    assert.match(t, /Note \(roadmap-coordinator-followups, 2026-11-21\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0014');
  }
  const adrs = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0014 in the desktop app each change of a roadmap run runs in a session of its own, amends 0011 and 0013/);
  const flow = read('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').some((l) => l.startsWith('**A session per change.**')), 'the flow page has the paragraph "A session per change."');
  assert.doesNotMatch(flow, /\(ready, waits for a place\)/);
  for (const f of [['README.md'], ['docs', 'roles.md'], ['docs', 'coordination-design.md']]) {
    assert.match(read(...f), /ADR 0014/, `${f.join('/')} cites ADR 0014`);
  }
});
