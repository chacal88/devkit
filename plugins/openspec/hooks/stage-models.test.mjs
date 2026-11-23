// stage-models: the model of each stage, one table with a built-in default that a project and a change override
// (design D-1 to D-5, D-9, D-12; ADR 0020). Tests of the table, of reading it, of the model every action carries, of reading a
// subagent's run and of the retry a model up.
// Every scenario runs on real files and Git in a temporary folder; the env of each test blanks every branch variable, as a
// pull-request run on CI sets them. Tests marked (kept) pass on the code before the change too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { put } from './deliver-check.test.mjs';
import { roundRepo } from './conduct-check.test.mjs';
import { FLOWS, cleanEnv, planChange, actionOf, run, nextOf, endOf, rowOf, reportOf } from './change-loop.test.mjs';
import { typedLine, runLine, transcriptOf, stopInput, assistantLine } from './change-loop.test.mjs';
import { doNext, doStatus, putRun, jsonOf, addOpen, world, agentAct, doRun, stateOf, projectWith, roadmapText, events } from './roadmap-loop.test.mjs';
import * as guard from './guard.mjs';
import * as loop from './change-loop.mjs';
import * as roadmap from './roadmap-loop.mjs';
import * as flowCheck from './flow-check.mjs';
import * as projectLoop from './project-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(HERE, '..', 'skills', 'devkit', 'SKILL.md'), 'utf8');
const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline' });

// ---------------------------------------------------------------- the fixtures

const STAGES = ['requirements', 'mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness', 'approval', 'implementation', 'unit-tests', 'e2e-tests', 'evidence', 'review', 'delivery', 'retro'];
const VALUES = ['haiku', 'sonnet', 'sonnet[1m]', 'opus', 'opus[1m]'];
const DEFAULTS = {
  requirements: 'opus', mockup: 'sonnet', decisions: 'opus', proposal: 'opus', specs: 'opus', design: 'opus', tasks: 'opus', readiness: 'sonnet', approval: 'sonnet',
  implementation: 'sonnet', 'unit-tests': 'haiku', 'e2e-tests': 'sonnet', evidence: 'sonnet', review: 'sonnet', delivery: 'haiku', retro: 'sonnet',
};
const STAGES_TEXT = STAGES.join(', ');
const VALUES_TEXT = VALUES.join(', ');

// The `devkit:` block of a settings file holding a `models:` table of `entries` (stage -> written value).
const tableText = (entries) => `devkit:\n  models:\n${Object.entries(entries).map(([stage, value]) => `    ${stage}: ${value}`).join('\n')}\n`;

// A project folder with a settings file and the `.openspec.yaml` of each change (id -> the text after `schema: devkit`).
function modelProject({ project = '', changes = {} } = {}) {
  const root = tmpFolder('devkit-stage-models-');
  mkdirSync(join(root, 'openspec', 'changes'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), `schema: devkit\n${project}`);
  for (const [id, text] of Object.entries(changes)) {
    mkdirSync(join(root, 'openspec', 'changes', id), { recursive: true });
    writeFileSync(join(root, 'openspec', 'changes', id, '.openspec.yaml'), `schema: devkit\n${text}`);
  }
  return { root, dir: (id) => join(root, 'openspec', 'changes', id) };
}

// The real change `feat` of `planChange`, with the project's settings text and the change's own text written over its files.
function featWith({ have, project = null, change = null }) {
  const root = planChange({ have });
  if (project !== null) put(root, { 'openspec/config.yaml': `schema: devkit\n${project}` });
  if (change !== null) put(root, { 'openspec/changes/feat/.openspec.yaml': `schema: devkit\n${change}` });
  return root;
}
const nextIn = (root, { lang = 'en', env = cleanEnv } = {}) => loop.main(['next', '--change', 'feat', '--lang', lang], { cwd: root, env });
const PLAN_OF = { requirements: [], decisions: ['requirements'], proposal: ['requirements', 'decisions'], specs: ['requirements', 'decisions', 'proposal'], design: ['requirements', 'decisions', 'proposal', 'specs'], tasks: ['requirements', 'decisions', 'proposal', 'specs', 'design'], readiness: ['requirements', 'decisions', 'proposal', 'specs', 'design', 'tasks'], approval: ['requirements', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness'] };

// The action `decide` gives at each stage of a script, from the stage checker's and the delivery checker's own facts.
const devkit = FLOWS.devkit;
const lite = FLOWS['devkit-lite'];
const AT = {
  requirements: (flow) => ({ rep: { next: nextOf(flow, 'requirements', 'no-file') } }),
  mockup: (flow) => ({ rep: { next: nextOf(flow, 'mockup', 'no-file') } }),
  decisions: (flow) => ({ rep: { next: nextOf(flow, 'decisions', 'no-file') } }),
  proposal: (flow) => ({ rep: { next: nextOf(flow, 'proposal', 'no-file') } }),
  specs: (flow) => ({ rep: { next: nextOf(flow, 'specs', 'no-file') } }),
  design: (flow) => ({ rep: { next: nextOf(flow, 'design', 'no-file') } }),
  tasks: (flow) => ({ rep: { next: nextOf(flow, 'tasks', 'no-file') } }),
  readiness: (flow) => ({ rep: { next: nextOf(flow, 'readiness', 'no-file') } }),
  approval: () => ({ rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') } }),
  implementation: (flow) => ({ rep: { next: nextOf(flow, 'implementation', 'no-file') }, facts: { row: rowOf('implement', { phase: 1 }) } }),
  'unit-tests': (flow) => ({ rep: { next: nextOf(flow, 'unit-tests', 'no-file') } }),
  'e2e-tests': (flow) => ({ rep: { next: nextOf(flow, 'e2e-tests', 'no-file') } }),
  evidence: (flow) => ({ rep: { next: nextOf(flow, 'evidence', 'no-file') }, facts: { row: rowOf('verify') } }),
  review: (flow) => ({ rep: { next: nextOf(flow, 'review', 'no-file') }, facts: { row: rowOf('review') } }),
  delivery: (flow) => ({ rep: { next: nextOf(flow, 'delivery', 'no-file') }, facts: { row: rowOf('commit') } }),
  retro: (flow) => ({ rep: { next: nextOf(flow, 'retro', 'no-file') }, facts: { row: rowOf('retro') } }),
};
const decideAt = (stage, models, flow = devkit) => {
  const at = AT[stage](flow);
  return run({ flow, ctx: { script: flow === lite ? 'devkit-lite' : 'devkit' }, rep: { ...at.rep, schema: flow === lite ? 'devkit-lite' : 'devkit' }, facts: { ...at.facts, ...(models ? { models } : {}) } });
};
const defaultModels = () => {
  const { root, dir } = modelProject();
  return loop.modelsOf(root, dir('none'));
};

// A session transcript on `model`, under a config folder of the test's own: the env that names it.
function sessionEnv(model) {
  const config = tmpFolder('devkit-stage-models-cfg-');
  const folder = join(config, 'projects', '-scratch-project');
  mkdirSync(folder, { recursive: true });
  const line = JSON.stringify({ type: 'assistant', isSidechain: false, message: { id: 'msg-1', role: 'assistant', model, content: [{ type: 'text', text: 'working' }], usage: { input_tokens: 5, output_tokens: 7 } } });
  writeFileSync(join(folder, 'session-models.jsonl'), `${line}\n`);
  return { ...cleanEnv, CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'session-models' };
}

// ---------------------------------------------------------------- the table (D-1)

test('stage-models AC-1 MODEL_STAGES equals the union of the two flows stage ids minus open, in flow order', () => {
  const union = new Set([...devkit.stages, ...lite.stages].map((s) => s.id));
  union.delete('open');
  assert.deepEqual([...loop.MODEL_STAGES].sort(), [...union].sort());
  assert.deepEqual([...loop.MODEL_STAGES], devkit.stages.map((s) => s.id).filter((id) => id !== 'open'));
  assert.deepEqual([...loop.MODEL_STAGES], STAGES);
});

test('stage-models AC-1 DEFAULT_MODELS holds the table of the design for every stage, frozen', () => {
  assert.deepEqual({ ...loop.DEFAULT_MODELS }, DEFAULTS);
  assert.ok(Object.isFrozen(loop.DEFAULT_MODELS));
  assert.deepEqual(Object.keys(loop.DEFAULT_MODELS), STAGES);
});

test('stage-models AC-1 the action at each stage of a devkit change carries the default, with no table anywhere', () => {
  const models = defaultModels();
  for (const stage of STAGES) {
    const action = decideAt(stage, models);
    assert.equal(action.stage, stage, `${stage}: the action is at its stage`);
    assert.equal(action.model, DEFAULTS[stage], stage);
  }
});

test('stage-models AC-1 the action at the unit tests and the delivery of a devkit-lite change carries the default', () => {
  const models = defaultModels();
  for (const stage of ['unit-tests', 'delivery']) {
    const action = decideAt(stage, models, lite);
    assert.equal(action.stage, stage);
    assert.equal(action.model, DEFAULTS[stage], stage);
  }
});

test('stage-models AC-1 next at the plan stages of a real change carries the default, the approval end included', () => {
  for (const [stage, have] of Object.entries(PLAN_OF)) {
    const r = nextIn(featWith({ have }));
    const action = actionOf(r.stdout);
    assert.equal(action.stage, stage, `${stage}: where the change stands`);
    assert.equal(action.model, DEFAULTS[stage], stage);
  }
});

test('stage-models AC-1 every entry of SESSION_RUN_STAGES is in MODEL_STAGES, in flow order', () => {
  assert.deepEqual([...loop.SESSION_RUN_STAGES], ['requirements', 'approval', 'review', 'delivery', 'retro']);
  assert.ok(Object.isFrozen(loop.SESSION_RUN_STAGES));
  const at = loop.SESSION_RUN_STAGES.map((s) => loop.MODEL_STAGES.indexOf(s));
  assert.ok(at.every((i) => i >= 0), 'each is a stage of the table');
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'in flow order');
});

test('stage-models AC-4 no default value ends in [1m]', () => {
  for (const [stage, value] of Object.entries(loop.DEFAULT_MODELS)) assert.ok(!value.endsWith('[1m]'), stage);
});

test('stage-models AC-4 MODEL_VALUES holds the five values, cheapest first', () => {
  assert.deepEqual([...loop.MODEL_VALUES], VALUES);
});

test('stage-models AC-4 modelRank and cheaper order every pair of values, and know no other value', () => {
  VALUES.forEach((a, i) => {
    assert.equal(loop.modelRank(a), i, a);
    VALUES.forEach((b, j) => assert.equal(loop.cheaper(a, b), i < j, `${a} < ${b}`));
    assert.equal(loop.cheaper(a, 'gpt'), false);
    assert.equal(loop.cheaper('gpt', a), false);
  });
  assert.equal(loop.modelRank('gpt'), -1);
  assert.equal(loop.modelRank('haiku[1m]'), -1);
  assert.equal(loop.modelRank(undefined), -1);
});

test('stage-models AC-4 familyOf drops the 1M suffix and oneUp gives the next family up, keeping it', () => {
  assert.deepEqual(VALUES.map((v) => loop.familyOf(v)), ['haiku', 'sonnet', 'sonnet', 'opus', 'opus']);
  assert.deepEqual(VALUES.map((v) => loop.oneUp(v)), ['sonnet', 'opus', 'opus[1m]', null, null]);
});

test('stage-models AC-4 strongest gives the highest known value, and null for an unknown or an empty list', () => {
  assert.equal(loop.strongest(['haiku', 'sonnet']), 'sonnet');
  assert.equal(loop.strongest(['gpt', 'haiku', 'unknown']), 'haiku', 'an unknown value is skipped');
  assert.equal(loop.strongest(['opus', 'opus[1m]', 'haiku']), 'opus[1m]');
  assert.equal(loop.strongest(['sonnet', 'sonnet[1m]', 'opus']), 'opus');
  assert.equal(loop.strongest(['gpt']), null);
  assert.equal(loop.strongest([]), null);
  for (const a of VALUES) for (const b of VALUES) assert.equal(loop.strongest([a, b]), loop.cheaper(a, b) ? b : a, `${a} ${b}`);
});

// ---------------------------------------------------------------- the parser and the table (D-2)

test('stage-models AC-2 the parser gives a models map in file order, a later duplicate winning', () => {
  const block = guard.parseDevkitBlock('devkit:\n  models:\n    design: opus\n    tasks: sonnet\n    design: haiku\n');
  assert.ok(block.models instanceof Map);
  assert.deepEqual([...block.models], [['design', 'haiku'], ['tasks', 'sonnet']]);
});

test('stage-models AC-2 the parser reads no table without a block, a models line or a file', () => {
  for (const text of ['', 'schema: devkit\n', 'devkit:\n', 'devkit:\n  driver: claude\n', 'devkit:\n  models:\n']) {
    const { models } = guard.parseDevkitBlock(text);
    assert.ok(models instanceof Map && models.size === 0, JSON.stringify(text));
  }
});

test('stage-models AC-2 the parser reads an empty value as undefined, a quoted value and a comment as the value', () => {
  const block = guard.parseDevkitBlock('devkit:   # the settings\n  models:   # one model per stage\n    design:\n    tasks: "sonnet"   # cheaper\n    review: \'haiku\'\n    retro: opus # strong\n');
  assert.deepEqual([...block.models], [['design', undefined], ['tasks', 'sonnet'], ['review', 'haiku'], ['retro', 'opus']]);
});

test('stage-models AC-2 the parser ignores an entry nested deeper than the table and a table nested under another key', () => {
  const deeper = guard.parseDevkitBlock('devkit:\n  models:\n    design: opus\n      tasks: haiku\n');
  assert.deepEqual([...deeper.models], [['design', 'opus']]);
  const under = guard.parseDevkitBlock('devkit:\n  delivery:\n    models:\n      design: haiku\n');
  assert.equal(under.models.size, 0);
});

test('stage-models AC-2 the parser records an inline models value under the empty key', () => {
  assert.deepEqual([...guard.parseDevkitBlock('devkit:\n  models: opus\n').models], [['', 'opus']]);
});

test('stage-models AC-2 the parser reads the delivery and the budget as before with a models table beside them (kept for the delivery part)', () => {
  const block = guard.parseDevkitBlock('devkit:\n  budget: 500000\n  models:\n    design: sonnet\n  delivery:\n    model: trunk\n    base: main\n');
  assert.equal(block.budget, '500000');
  assert.equal(block.delivery.model, 'trunk');
  assert.equal(block.delivery.base, 'main');
  assert.equal(block.driver, undefined);
});

test('stage-models AC-2 a model written under the table never sets the delivery, the budget, the driver or the language', () => {
  const block = guard.parseDevkitBlock('devkit:\n  models:\n    model: opus\n    budget: 5\n    driver: robot\n  delivery:\n    model: trunk\n');
  assert.equal(block.delivery.model, 'trunk');
  assert.equal(block.budget, undefined);
  assert.equal(block.driver, undefined);
  assert.deepEqual([...block.models.keys()], ['model', 'budget', 'driver'], 'they are entries of the table, for modelProblems to refuse');
});

test('stage-models AC-2 the project entry changes one stage and the others keep the default', () => {
  const { root, dir } = modelProject({ project: tableText({ design: 'sonnet' }), changes: { feat: '' } });
  const models = loop.modelsOf(root, dir('feat'));
  assert.deepEqual({ ...models }, { ...DEFAULTS, design: 'sonnet' });
});

test('stage-models AC-2 the change entry wins for that change and another change keeps the project entry', () => {
  const { root, dir } = modelProject({ project: tableText({ design: 'sonnet' }), changes: { a: tableText({ design: 'opus' }), b: '' } });
  assert.equal(loop.modelsOf(root, dir('a')).design, 'opus');
  assert.equal(loop.modelsOf(root, dir('b')).design, 'sonnet');
});

test('stage-models AC-2 an empty value is absent: the next layer answers', () => {
  const { root, dir } = modelProject({ project: tableText({ design: 'haiku' }), changes: { a: 'devkit:\n  models:\n    design:\n', b: 'devkit:\n  models:\n    design:\n' } });
  assert.equal(loop.modelsOf(root, dir('a')).design, 'haiku');
  const bare = modelProject({ changes: { a: 'devkit:\n  models:\n    design:\n' } });
  assert.equal(loop.modelsOf(bare.root, bare.dir('a')).design, 'opus', 'and the default when no layer sets it');
});

test('stage-models AC-2 a quoted value and a comment read the model', () => {
  const { root, dir } = modelProject({ project: 'devkit:   # the settings\n  models:   # one per stage\n    design: "sonnet"   # cheaper\n    tasks: \'haiku\'\n', changes: { a: '' } });
  const models = loop.modelsOf(root, dir('a'));
  assert.deepEqual([models.design, models.tasks], ['sonnet', 'haiku']);
});

test('stage-models AC-2 modelsOf reads a change with no folder of its own and a project with no file as the default', () => {
  const root = tmpFolder('devkit-stage-models-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  assert.deepEqual({ ...loop.modelsOf(root, join(root, 'openspec', 'changes', 'none')) }, DEFAULTS);
});

test('stage-models AC-2 next at the design stage carries the project entry, and the change entry over it', () => {
  const have = PLAN_OF.design;
  assert.equal(actionOf(nextIn(featWith({ have, project: tableText({ design: 'sonnet' }) })).stdout).model, 'sonnet');
  const over = featWith({ have, project: tableText({ design: 'sonnet' }), change: tableText({ design: 'haiku' }) });
  assert.equal(actionOf(nextIn(over).stdout).model, 'haiku');
  assert.equal(actionOf(nextIn(featWith({ have, project: tableText({ tasks: 'haiku' }) })).stdout).model, 'opus', 'another stage keeps the default');
});

test('stage-models AC-4 opus[1m] and sonnet[1m] are returned as written, by modelsOf and on the action', () => {
  const { root, dir } = modelProject({ project: tableText({ implementation: 'sonnet[1m]', design: 'opus[1m]' }), changes: { a: '' } });
  const models = loop.modelsOf(root, dir('a'));
  assert.deepEqual([models.implementation, models.design], ['sonnet[1m]', 'opus[1m]']);
  assert.equal(decideAt('implementation', models).model, 'sonnet[1m]');
  assert.equal(actionOf(nextIn(featWith({ have: PLAN_OF.design, project: tableText({ design: 'opus[1m]' }) })).stdout).model, 'opus[1m]');
});

// ---------------------------------------------------------------- a table the loop refuses (D-2)

const BAD = [
  ['an unknown stage', tableText({ implement: 'sonnet' }), 'model-stage', 'implement', STAGES_TEXT],
  ['an unknown value', tableText({ design: 'gpt' }), 'model-value', 'design: gpt', VALUES_TEXT],
  ['haiku with the 1M suffix', tableText({ design: 'haiku[1m]' }), 'model-value', 'design: haiku[1m]', VALUES_TEXT],
  ['an inline value on the models line', 'devkit:\n  models: opus\n', 'model-stage', 'opus', STAGES_TEXT],
];
const startIn = (cwd, text, lang = 'en') => loop.main(['start', '--lang', lang], { cwd, env: cleanEnv, stdin: text, gh: OFFLINE });
const body = (r) => JSON.parse(r.stdout);
const projectOf = (block) => roundRepo({ roadmap: '# Roadmap\n', config: `schema: devkit\n${block}` });
const worktreeOf = (t, id) => join(t.main, '.claude', 'worktrees', id);

test('stage-models AC-3 modelProblems lists an unknown stage and an unknown value, in map order', () => {
  const problems = loop.modelProblems(guard.parseDevkitBlock(`${tableText({ design: 'gpt', implement: 'sonnet', tasks: 'opus' })}`).models);
  assert.deepEqual(problems, [
    { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT },
    { setting: 'model-stage', value: 'implement', accepted: STAGES_TEXT },
  ]);
  assert.deepEqual(loop.modelProblems(new Map()), []);
  assert.deepEqual(loop.modelProblems(new Map([['design', undefined]])), [], 'an empty value is no problem');
});

test('stage-models AC-3 readDevkitSettings lists the table problems after the budget and before the tests', () => {
  const root = projectOf(`devkit:\n  budget: nope\n  models:\n    design: gpt\n  tests:\n    coverage: x\n`).main;
  const unknown = loop.readDevkitSettings(root).unknown;
  const at = (setting) => unknown.findIndex((u) => u.setting === setting);
  assert.ok(at('budget') >= 0 && at('model-value') > at('budget'), JSON.stringify(unknown));
  assert.deepEqual(unknown[at('model-value')], { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT });
});

test('stage-models AC-3 a bad project table makes start answer setting-unknown naming the setting and the accepted values, and open create nothing', () => {
  for (const [label, block, setting, value, accepted] of BAD) {
    const t = projectOf(block);
    const reply = loop.render('en', 'setting-unknown', { setting, value, accepted });
    const s = body(startIn(t.main, 'change add an export'));
    assert.deepEqual([s.mode, s.reply], ['setting-unknown', reply], label);
    assert.ok(reply.includes(value) && reply.includes(accepted), label);
    assert.ok(reply.includes(loop.MESSAGES.en[`setting.${setting}`]), `${label}: names the setting`);
    const o = loop.main(['open', 'add-export', '--script', 'devkit', '--why', 'doubt', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'Add a thing\n' });
    assert.equal(o.code, 3, label);
    assert.equal(body(o).reply, reply, label);
    assert.equal(existsSync(worktreeOf(t, 'add-export')), false, label);
  }
});

test('stage-models AC-3 the same reply in Brazilian Portuguese names the setting in its own words', () => {
  const t = projectOf(tableText({ design: 'gpt' }));
  const s = body(startIn(t.main, 'change add an export', 'pt-BR'));
  assert.equal(s.mode, 'setting-unknown');
  assert.equal(s.reply, loop.render('pt-BR', 'setting-unknown', { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT }));
  assert.ok(s.reply.includes('modelo de uma etapa') && s.reply.includes('design: gpt'));
});

test('stage-models AC-3 a bad project table makes /devkit roadmap, /devkit status and /devkit project answer setting-unknown and start nothing', () => {
  const t = projectOf(tableText({ design: 'gpt' }));
  const reply = loop.render('en', 'setting-unknown', { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT });
  for (const text of ['roadmap', 'status', 'project billing']) {
    const s = body(startIn(t.main, text));
    assert.deepEqual([s.mode, s.reply], ['setting-unknown', reply], text);
  }
  const p = body(projectLoop.main(['start', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'billing', gh: OFFLINE }));
  assert.deepEqual([p.mode, p.reply], ['setting-unknown', reply], 'project-loop start');
  assert.equal(existsSync(join(t.main, '.claude', 'worktrees')), false, 'nothing was created');
});

test('stage-models AC-3 a bad change table makes next exit 3 with the reply in both languages and no hand-off', () => {
  for (const [label, text, setting, value, accepted] of BAD) {
    for (const lang of ['en', 'pt-BR']) {
      const root = featWith({ have: PLAN_OF.design, change: text });
      const r = nextIn(root, { lang });
      assert.equal(r.code, 3, `${label} ${lang}`);
      const b = body(r);
      assert.equal(b.reply, loop.render(lang, 'setting-unknown', { setting, value, accepted }), `${label} ${lang}`);
      assert.equal(b.kind, undefined, 'no action');
      assert.doesNotMatch(r.stdout, /"agent"/, 'no hand-off');
    }
  }
});

test('stage-models AC-3 a bad project table makes next exit 3 too', () => {
  const r = nextIn(featWith({ have: PLAN_OF.design, project: tableText({ design: 'gpt' }) }));
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, loop.render('en', 'setting-unknown', { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT }));
});

test('stage-models AC-3 a lenient read ignores a bad change table whole and takes the project table or the default', () => {
  const { root, dir } = modelProject({ project: tableText({ design: 'sonnet' }), changes: { bad: tableText({ design: 'gpt', tasks: 'haiku' }) } });
  const lenient = loop.modelsOf(root, dir('bad'), { strict: false });
  assert.deepEqual([lenient.design, lenient.tasks], ['sonnet', 'opus'], 'the whole bad table is ignored, the good entry beside it too');
  const none = modelProject({ changes: { bad: tableText({ design: 'gpt' }) } });
  assert.equal(loop.modelsOf(none.root, none.dir('bad')).design, 'opus');
  assert.throws(() => loop.modelsOf(root, dir('bad'), { strict: true, lang: 'en' }), (e) => e instanceof loop.LoopRefusal && e.reply === loop.render('en', 'setting-unknown', { setting: 'model-value', value: 'design: gpt', accepted: VALUES_TEXT }));
});

test('stage-models AC-3 strict reads the change table first, then the project table', () => {
  const both = modelProject({ project: tableText({ tasks: 'gpt' }), changes: { a: tableText({ design: 'gpt' }) } });
  assert.throws(() => loop.modelsOf(both.root, both.dir('a'), { strict: true, lang: 'en' }), (e) => /design: gpt/.test(e.reply));
  const mine = modelProject({ project: tableText({ tasks: 'gpt' }), changes: { a: '' } });
  assert.throws(() => loop.modelsOf(mine.root, mine.dir('a'), { strict: true, lang: 'en' }), (e) => /tasks: gpt/.test(e.reply));
});

test('stage-models AC-3 nextAction and the stop lock read a bad change table leniently and the roadmap too', () => {
  const root = featWith({ have: PLAN_OF.design, change: tableText({ design: 'gpt' }) });
  const action = loop.nextAction(root, 'feat', { env: cleanEnv, lang: 'en' });
  assert.deepEqual([action.kind, action.stage, action.model], ['agent', 'design', 'opus'], 'nextAction without strictModels');

  const sandbox = tmpFolder('devkit-stage-models-tmp-');
  const before = process.env.TMPDIR;
  process.env.TMPDIR = sandbox;
  try {
    const transcript = transcriptOf([typedLine('change x'), runLine('feat'), assistantLine()]);
    const stop = loop.stopDecision(stopInput(root, transcript), { env: cleanEnv });
    assert.deepEqual([stop.decision, stop.why], ['refuse', 'stage-ready'], 'the lock read the stage and did not fail open');
  } finally {
    if (before === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = before;
  }

  put(root, { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1: x\n- [ ] feat\n' });
  const world = roadmap.collectRoadmap(root, { env: cleanEnv, lang: 'en', gh: OFFLINE, load: 10, limit: 80 });
  assert.deepEqual([world.actions.feat?.stage, world.actions.feat?.model], ['design', 'opus'], 'collectRoadmap');
});

// ---------------------------------------------------------------- the model on every action (D-3)

test('stage-models AC-5 every action next prints over the plan stages of a real change carries a model, the hand-offs included', () => {
  const seen = [];
  for (const [stage, have] of Object.entries(PLAN_OF)) {
    const action = actionOf(nextIn(featWith({ have })).stdout);
    seen.push(action.kind);
    assert.equal(typeof action.model, 'string', stage);
    if (action.kind === 'agent') assert.equal(action.model, DEFAULTS[action.stage], `${stage}: an agent action's model is its stage's`);
  }
  assert.ok(seen.includes('agent') && seen.includes('grill') && seen.includes('end'));
});

test('stage-models AC-5 every agent action decide gives at a stage with an agent carries the stage model', () => {
  const models = defaultModels();
  const agents = STAGES.map((stage) => decideAt(stage, models)).filter((a) => a.kind === 'agent');
  assert.deepEqual(agents.map((a) => a.stage), ['mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness', 'implementation', 'unit-tests', 'e2e-tests', 'evidence', 'delivery']);
  for (const action of agents) assert.equal(action.model, DEFAULTS[action.stage], action.stage);
});

test('stage-models AC-5 an end at a stage with a row carries the model, and an end with no stage carries none', () => {
  const models = defaultModels();
  const waiting = run({ rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') }, facts: { models } });
  assert.equal(waiting.model, 'sonnet');
  const none = run({ report: { ...reportOf(devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } }, facts: { models } });
  assert.equal(none.stage, null);
  assert.ok(!('model' in none), 'a null stage has no row');
  const opened = run({ rep: { next: nextOf(devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } }, facts: { models } });
  assert.ok(!('model' in opened), 'open has no row');
});

test('stage-models AC-5 the skill Loop agent item sets the Agent call model from the action, without the 1M suffix', () => {
  const loopText = SKILL.slice(SKILL.indexOf('\n## Loop'), SKILL.indexOf('\n## Owner gates'));
  const item = loopText.split('\n').find((l) => l.startsWith('- `agent`:'));
  assert.ok(item, 'the Loop has an agent item');
  assert.match(item, /its `model` set to the action's `model` with any `\[1m\]` suffix removed/);
});

test('stage-models AC-5 the skill step 2 agent item of a session of its own says the same', () => {
  const section = SKILL.slice(SKILL.indexOf('\n### Every change in this session'), SKILL.indexOf('\n## Status'));
  const item = section.split('\n').find((l) => l.trimStart().startsWith('- `agent`:'));
  assert.ok(item, 'the section has an agent item');
  assert.match(item, /its `model` set to the action's `model` with any `\[1m\]` suffix removed/);
});

test('stage-models AC-8 a design hand-off carries opus whatever the session runs on, and no action switches the session', () => {
  const root = featWith({ have: PLAN_OF.design });
  for (const sessionModel of ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5']) {
    const action = actionOf(nextIn(root, { env: sessionEnv(sessionModel) }).stdout);
    assert.deepEqual([action.kind, action.stage, action.model], ['agent', 'design', 'opus'], sessionModel);
  }
});

test('stage-models AC-9 no action of the change loop has a kind that switches a session, and the loop names no session-model tool', () => {
  const models = defaultModels();
  const kinds = new Set(STAGES.map((stage) => decideAt(stage, models).kind));
  for (const kind of kinds) assert.ok(['agent', 'session', 'grill', 'end'].includes(kind), kind);
  const source = readFileSync(join(HERE, 'change-loop.mjs'), 'utf8');
  assert.doesNotMatch(source, /set_session_model|session-model|start_session/);
});

test('stage-models AC-9 the skill change sections name no session-model tool', () => {
  const change = SKILL.slice(0, SKILL.indexOf('\n## Roadmap'));
  assert.match(change, /its `model` set to the action's `model`/, 'the sections speak of the Agent call model only');
  assert.doesNotMatch(change, /set_session_model|session-model|start_session|session_model/);
});

test('stage-models AC-9 decide without models prints no model on any action (kept)', () => {
  for (const stage of STAGES) assert.ok(!('model' in decideAt(stage, null)), stage);
});

// ---------------------------------------------------------------- transcripts and hand-offs (D-4, D-12)

// The second `n` of one fixed minute: a timestamp that sorts as `n` does.
const at = (n) => new Date(Date.UTC(2026, 10, 23, 10, 0, n)).toISOString();
const userLine = (content, when, extra = {}) => JSON.stringify({ type: 'user', isSidechain: false, userType: 'external', timestamp: when, message: { role: 'user', content }, ...extra });
const typedAt = (args, when, name = '/devkit') => userLine(`<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`, when);
const resultAt = (text, when) => userLine([{ type: 'tool_result', tool_use_id: 'toolu_1', content: text }], when);
const modelLine = ({ id, model, input = 0, output = 0, cacheWrite = 0, at: when, text = 'working', sidechain = true } = {}) => JSON.stringify({
  type: 'assistant', isSidechain: sidechain, timestamp: when,
  message: { id, role: 'assistant', ...(model === undefined ? {} : { model }), content: [{ type: 'text', text }], usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheWrite } },
});
const FAILED = 'I could not finish.\nOutcome: failure — the plan did not hold';
const DONE = 'Delivered.\nOutcome: success';

// The subagent file `agent-<n>.jsonl` of `dir`: its prompt on a first user line started at `start`, then `lines`.
function subagentFile(dir, n, { prompt, start, lines = [] }) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `agent-${n}.jsonl`);
  writeFileSync(file, `${[userLine(prompt, start, { isSidechain: true }), ...lines].join('\n')}\n`);
  return file;
}

// A session of its own: its transcript under a config folder of the test's, and the folder its subagents write to.
function sessionWorld(lines = [typedAt('change feat', at(0))]) {
  const config = tmpFolder('devkit-stage-models-cfg-');
  const id = 'session-retry';
  const folder = join(config, 'projects', '-scratch-retry');
  mkdirSync(folder, { recursive: true });
  const transcript = join(folder, `${id}.jsonl`);
  writeFileSync(transcript, `${lines.join('\n')}\n`);
  const subagents = join(folder, id, 'subagents');
  return {
    env: { ...cleanEnv, CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: id }, transcript, subagents,
    append: (more) => appendFileSync(transcript, `${more.join('\n')}\n`),
    // A stage subagent that was handed `prompt` at second `start`, ran on `model` and ended with `text`.
    handOff: (n, { prompt, model, text, start, tokens = 100 }) => subagentFile(subagents, n, { prompt, start: at(start), lines: [modelLine({ id: `msg-${n}`, model, input: tokens, at: at(start + 1), text })] }),
  };
}

// The lone change `feat` at its design stage, whose design model is `design` in the project's table (none: the default).
function designWorld({ design = null, project = '', lines } = {}) {
  const root = featWith({ have: PLAN_OF.design, project: design ? tableText({ design }) : project || null });
  const w = sessionWorld(lines);
  const first = actionOf(nextIn(root, { env: w.env }).stdout);
  return { root, w, first };
}
const nextAfter = (root, env, key) => loop.main(['next', '--change', 'feat', '--lang', 'en', ...(key ? ['--after', key] : [])], { cwd: root, env });
const markers = (r) => r.stdout.split('\n').filter((l) => /^devkit-(run|end): /.test(l));

// Runs `fn` and counts the reads of each of `files` through `readFileSync`, as the hooks make them.
function countReads(files, fn) {
  const real = fs.readFileSync;
  const counts = Object.fromEntries(files.map((f) => [f, 0]));
  fs.readFileSync = (file, ...rest) => { if (String(file) in counts) counts[String(file)] += 1; return real(file, ...rest); };
  syncBuiltinESMExports();
  try { fn(); } finally { fs.readFileSync = real; syncBuiltinESMExports(); }
  return counts;
}
// Runs `fn` with a temporary folder of its own as TMPDIR, where the stop locks keep their record.
function withTmpDir(fn) {
  const before = process.env.TMPDIR;
  process.env.TMPDIR = tmpFolder('devkit-stage-models-tmp-');
  try { return fn(); } finally { if (before === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = before; }
}

// ---------------------------------------------------------------- reading a subagent's run (D-4)

test('stage-models AC-10 familyOfId names the family a model id holds, whatever its case, and null for any other', () => {
  assert.deepEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'Claude-SONNET-9', 'us.anthropic.claude-haiku-5-5-v1:0'].map((id) => guard.familyOfId(id)), ['opus', 'sonnet', 'haiku', 'sonnet', 'haiku']);
  for (const other of ['gpt-5', '', undefined, null, 42, {}]) assert.equal(guard.familyOfId(other), null, String(other));
});

test('stage-models AC-10 the usage scan of a transcript carries the model of each message, null when it has none or none that is text', () => {
  const none = JSON.stringify({ type: 'assistant', timestamp: at(2), message: { id: 'm2', usage: { input_tokens: 4 } } });
  const odd = JSON.stringify({ type: 'assistant', timestamp: at(3), message: { id: 'm3', model: 7, usage: { output_tokens: 1 } } });
  const file = transcriptOf([modelLine({ id: 'm1', model: 'claude-opus-5-5', input: 10, output: 20, at: at(1), sidechain: false }), none, odd]);
  const events = guard.transcriptEvents({ transcript_path: file }, { usage: true });
  assert.deepEqual(events.filter((e) => e.usage).map((e) => e.usage), [
    { id: 'm1', tokens: 30, model: 'claude-opus-5-5' }, { id: 'm2', tokens: 4, model: null }, { id: 'm3', tokens: 1, model: null },
  ]);
});

test('stage-models AC-10 subagentRun gives the start, the prompt, the family of the newest model, whether it failed, and the usage of each message', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const file = subagentFile(dir, 1, { prompt: 'The brief.', start: at(5), lines: [
    modelLine({ id: 'm1', model: 'claude-haiku-5-5', input: 10, output: 20, cacheWrite: 5, at: at(6) }),
    modelLine({ id: 'm2', model: 'claude-sonnet-5-5', input: 1, output: 2, cacheWrite: 3, at: at(7), text: 'I tried.\nOutcome: failure — gave up' }),
  ] });
  assert.deepEqual(guard.subagentRun(file), {
    start: at(5), prompt: 'The brief.', family: 'sonnet', failed: true,
    usage: [{ id: 'm1', tokens: 35, family: 'haiku' }, { id: 'm2', tokens: 6, family: 'sonnet' }],
  });
});

test('stage-models AC-10 subagentRun joins the text blocks of a prompt given as a list', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const file = subagentFile(dir, 1, { prompt: [{ type: 'text', text: 'First block.' }, { type: 'image' }, { type: 'text', text: 'Second block.' }], start: at(1) });
  assert.equal(guard.subagentRun(file).prompt, 'First block.\nSecond block.');
});

test('stage-models AC-10 subagentRun skips a cut-off last line and a broken one, and reads the rest', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const file = subagentFile(dir, 1, { prompt: 'The brief.', start: at(1), lines: ['{not json', modelLine({ id: 'm1', model: 'claude-opus-5-5', input: 3, at: at(2), text: DONE })] });
  appendFileSync(file, '{"type":"assistant","message":{"id":"m3","mod');
  const run = guard.subagentRun(file);
  assert.deepEqual([run.family, run.failed, run.usage.length], ['opus', false, 1]);
});

test('stage-models AC-10 subagentRun reads an empty file as not failed, and null for a file it cannot read', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const empty = join(dir, 'agent-1.jsonl');
  writeFileSync(empty, '');
  assert.deepEqual(guard.subagentRun(empty), { start: null, prompt: null, family: null, failed: false, usage: [] });
  assert.equal(guard.subagentRun(join(dir, 'agent-9.jsonl')), null);
});

test('stage-models AC-10 a failure is a line that starts with Outcome: failure, and only in the newest message that holds text', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const failedOf = (texts, extra = []) => guard.subagentRun(subagentFile(dir, 1, { prompt: 'p', start: at(1), lines: [...texts.map((text, i) => modelLine({ id: `m${i}`, model: 'claude-haiku-5-5', at: at(2 + i), text })), ...extra] })).failed;
  for (const text of ['Outcome: failure', 'Some words.\nOutcome: failure — why', '**Outcome: failure**', '**Outcome:** failure', '> Outcome: failure', '`Outcome: failure`']) assert.equal(failedOf([text]), true, text);
  for (const text of ['Outcome: success', 'Outcome: green', 'the Outcome: failure line is quoted here', 'Outcome: failures are rare', '']) assert.equal(failedOf([text]), false, text);
  assert.equal(failedOf([FAILED, DONE]), false, 'a later success');
  assert.equal(failedOf([DONE, FAILED]), true, 'a later failure');
  const toolOnly = JSON.stringify({ type: 'assistant', isSidechain: true, timestamp: at(9), message: { id: 'tool', model: 'claude-haiku-5-5', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }], usage: { input_tokens: 1 } } });
  assert.equal(failedOf([FAILED], [toolOnly]), true, 'a message with no text does not erase the failure');
});

test('stage-models AC-10 handOffKey is the brief, cut off before whatever the session appended to it', () => {
  const models = defaultModels();
  const brief = decideAt('design', models).brief;
  assert.equal(guard.handOffKey(brief), brief);
  assert.equal(guard.handOffKey(`${brief} Run it in the background.`), brief, 'the dispatch sentence');
  assert.equal(guard.handOffKey(`${brief}\n\nAttribution (from the caller): none`), brief, 'the attribution block');
  assert.equal(guard.handOffKey(`${brief} First.\nSecond. Write the change's files in Klingon.`), brief, 'the first match');
  const commit = decideAt('delivery', models).brief;
  assert.ok(commit.endsWith(loop.ATTRIBUTION_ASK), 'the commit hand-off asks for the attribution block');
  assert.equal(guard.handOffKey(commit), commit.slice(0, commit.length - loop.ATTRIBUTION_ASK.length));
});

test('stage-models AC-10 handOffKey keys a brief whose files language is a raw tag, and gives null for a text that is no brief', () => {
  const brief = run({ ctx: { filesLanguage: 'zh-CN' }, rep: { next: nextOf(devkit, 'design', 'no-file') }, facts: { models: defaultModels() } }).brief;
  assert.ok(brief.endsWith("Write the change's files in zh-CN."), brief);
  assert.equal(guard.handOffKey(`${brief} Then stop.`), brief);
  for (const other of ['hello', 'Change feat (devkit script), stage design: x.', '', undefined, null, 5]) assert.equal(guard.handOffKey(other), null, String(other));
});

test('stage-models AC-10 handOffsOf lists the subagents in the order they started, each with its key, from the time asked', () => {
  const dir = tmpFolder('devkit-stage-models-sub-');
  const transcript = join(dir, 'session-x.jsonl');
  const folder = join(dir, 'session-x', 'subagents');
  const brief = decideAt('design', defaultModels()).brief;
  subagentFile(folder, 2, { prompt: `${brief} Go.`, start: at(20) });
  subagentFile(folder, 3, { prompt: 'Not a brief.', start: at(10) });
  subagentFile(folder, 1, { prompt: brief, start: at(10) });
  writeFileSync(join(folder, 'notes.txt'), 'ignored');
  const all = guard.handOffsOf(transcript, null);
  assert.deepEqual(all.map((r) => [r.start, r.prompt]), [[at(10), brief], [at(10), 'Not a brief.'], [at(20), `${brief} Go.`]], 'by start, then by file name');
  assert.deepEqual(all.map((r) => r.key), [brief, null, brief]);
  assert.deepEqual(guard.handOffsOf(transcript, at(10)).length, 3, 'at the time itself');
  assert.deepEqual(guard.handOffsOf(transcript, at(11)).map((r) => r.start), [at(20)]);
  assert.deepEqual(guard.handOffsOf(transcript, at(21)), []);
  assert.deepEqual(guard.handOffsOf(join(dir, 'session-none.jsonl'), null), [], 'a folder that cannot be listed');
});

test('stage-models AC-10 typedSince gives the time of the newest /devkit command, and a /devkit status typed after it does not move it', () => {
  const since = (...lines) => guard.typedSince(transcriptOf(lines));
  assert.equal(since(typedAt('change feat', at(1))), at(1));
  assert.equal(since(typedAt('change feat', at(1)), typedAt('status', at(2))), at(1), 'a status check starts no window');
  assert.equal(since(typedAt('change feat', at(1)), typedAt('status', at(2)), typedAt('roadmap 2', at(3))), at(3));
  assert.equal(since(typedAt('change feat', at(1)), typedAt('change x', at(4), '/devkit-openspec:devkit')), at(4), 'the plugin-scoped command');
  assert.equal(since(typedAt('change feat', at(1)), typedAt('', at(2), '/clear')), at(1), 'another command is no /devkit command');
  assert.equal(since(typedAt('', at(1))), at(1), 'a bare /devkit');
  assert.equal(since(typedAt('status', at(1))), null);
  assert.equal(since(modelLine({ id: 'm', model: 'claude-opus-5-5', at: at(1), sidechain: false })), null, 'no typed command');
  assert.equal(guard.typedSince(join(tmpFolder('devkit-stage-models-sub-'), 'none.jsonl')), null, 'a file that cannot be read');
});

// ---------------------------------------------------------------- the retry a model up (D-5)

test('stage-models AC-10 a failure on haiku gives the same stage on sonnet, marked, with the same brief and key, and the call passes that key', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  assert.deepEqual([first.kind, first.stage, first.model], ['agent', 'design', 'haiku']);
  assert.ok(!('retry' in first), 'a first hand-off is no retry');
  w.handOff(1, { prompt: `${first.brief} Run it in the background.`, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  const r = nextAfter(root, w.env, first.progressKey);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(markers(r), ['devkit-run: feat'], 'a retry is no end');
  const retry = actionOf(r.stdout);
  assert.deepEqual([retry.kind, retry.stage, retry.agent, retry.model], ['agent', 'design', first.agent, 'sonnet']);
  assert.deepEqual(retry.retry, { failedOn: 'haiku', attempt: 2 });
  assert.equal(retry.progressKey, first.progressKey, 'the same key');
  assert.equal(retry.brief, first.brief, 'the same brief');
});

test('stage-models AC-10 the family a failed run recorded gives the retry, and the table model when it recorded none', () => {
  const { root, w, first } = designWorld({ design: 'sonnet' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  assert.deepEqual([actionOf(nextAfter(root, w.env, first.progressKey).stdout).model, actionOf(nextAfter(root, w.env, first.progressKey).stdout).retry.failedOn], ['sonnet', 'haiku'], 'it ran on haiku in fact');
  const bare = designWorld({ design: 'haiku' });
  subagentFile(bare.w.subagents, 1, { prompt: bare.first.brief, start: at(10), lines: [JSON.stringify({ type: 'assistant', isSidechain: true, timestamp: at(11), message: { id: 'm', content: [{ type: 'text', text: FAILED }] } })] });
  const retry = actionOf(nextAfter(bare.root, bare.w.env, bare.first.progressKey).stdout);
  assert.deepEqual([retry.model, retry.retry.failedOn], ['sonnet', 'haiku'], 'no model recorded: the table model is the family it failed on');
});

test('stage-models AC-10 a failure on sonnet[1m] gives opus[1m], and on sonnet gives opus', () => {
  const big = designWorld({ design: 'sonnet[1m]' });
  big.w.handOff(1, { prompt: big.first.brief, model: 'claude-sonnet-5-5', text: FAILED, start: 10 });
  const retry = actionOf(nextAfter(big.root, big.w.env, big.first.progressKey).stdout);
  assert.deepEqual([retry.model, retry.retry], ['opus[1m]', { failedOn: 'sonnet', attempt: 2 }]);
  const plain = designWorld({ design: 'sonnet' });
  plain.w.handOff(1, { prompt: plain.first.brief, model: 'claude-sonnet-5-5', text: FAILED, start: 10 });
  assert.equal(actionOf(nextAfter(plain.root, plain.w.env, plain.first.progressKey).stdout).model, 'opus');
});

test('stage-models AC-10 two failures in a row end the run blocked with role-failed, exit 2 and the end line', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  w.handOff(2, { prompt: first.brief, model: 'claude-sonnet-5-5', text: FAILED, start: 20 });
  const r = nextAfter(root, w.env, first.progressKey);
  assert.equal(r.code, 2, r.stdout);
  assert.deepEqual(markers(r), ['devkit-run: feat', 'devkit-end: feat blocked']);
  const end = actionOf(r.stdout);
  assert.deepEqual([end.kind, end.end.state, end.end.why, end.stage], ['end', 'blocked', 'role-failed', 'design']);
  assert.equal(end.reply, loop.render('en', 'blocked', { id: 'feat', why: 'role-failed', stage: end.stageTitle }));
  assert.match(end.reply, /could not finish its work/);
  assert.ok(!('retry' in end));
});

test('stage-models AC-10 a failure on opus ends the run blocked, and no retry is handed', () => {
  const { root, w, first } = designWorld();
  assert.equal(first.model, 'opus');
  w.handOff(1, { prompt: first.brief, model: 'claude-opus-5-5', text: FAILED, start: 10 });
  const r = nextAfter(root, w.env, first.progressKey);
  assert.equal(r.code, 2);
  assert.deepEqual(markers(r), ['devkit-run: feat', 'devkit-end: feat blocked']);
  assert.deepEqual([actionOf(r.stdout).end.why, actionOf(r.stdout).kind], ['role-failed', 'end']);
  const big = designWorld({ design: 'opus[1m]' });
  big.w.handOff(1, { prompt: big.first.brief, model: 'claude-opus-5-5', text: FAILED, start: 10 });
  assert.equal(actionOf(nextAfter(big.root, big.w.env, big.first.progressKey).stdout).end.why, 'role-failed', 'and on opus[1m]');
});

test('stage-models AC-10 a success between two failures gives one retry again', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  w.handOff(2, { prompt: first.brief, model: 'claude-sonnet-5-5', text: DONE, start: 20 });
  w.handOff(3, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 30 });
  const r = nextAfter(root, w.env, first.progressKey);
  assert.equal(r.code, 0, r.stdout);
  const retry = actionOf(r.stdout);
  assert.deepEqual([retry.kind, retry.model, retry.retry], ['agent', 'sonnet', { failedOn: 'haiku', attempt: 2 }]);
});

test('stage-models AC-10 a new typed /devkit change after two failures hands the table model as a first hand-off', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  w.handOff(2, { prompt: first.brief, model: 'claude-sonnet-5-5', text: FAILED, start: 20 });
  const ended = nextAfter(root, w.env, first.progressKey);
  assert.deepEqual([ended.code, actionOf(ended.stdout).end.why], [2, 'role-failed'], 'the run ended blocked, by the failures');
  w.append([typedAt('change feat', at(40))]);
  const again = nextAfter(root, w.env, null);
  assert.equal(again.code, 0, again.stdout);
  const action = actionOf(again.stdout);
  assert.deepEqual([action.kind, action.stage, action.model], ['agent', 'design', 'haiku']);
  assert.ok(!('retry' in action));
});

test('stage-models AC-10 a /devkit status typed between a failure and the next call keeps the retry', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  w.append([typedAt('status', at(15)), typedAt('status', at(16), '/devkit-openspec:devkit')]);
  const retry = actionOf(nextAfter(root, w.env, first.progressKey).stdout);
  assert.deepEqual([retry.kind, retry.model, retry.retry.failedOn], ['agent', 'sonnet', 'haiku']);
});

test("stage-models AC-10 another change's subagents between a failure and the next call do not break the chain", () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  const other = first.brief.replace('Change feat', 'Change other').replaceAll('/feat', '/other').replace('branch feat', 'branch other');
  w.handOff(2, { prompt: other, model: 'claude-sonnet-5-5', text: DONE, start: 20 });
  w.handOff(3, { prompt: 'Review the diff.', model: 'claude-sonnet-5-5', text: DONE, start: 30 });
  const retry = actionOf(nextAfter(root, w.env, first.progressKey).stdout);
  assert.deepEqual([retry.kind, retry.model, retry.retry.attempt], ['agent', 'sonnet', 2]);
});

test('stage-models AC-10 a failure of the same brief before the newest typed command is not read', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  assert.equal(actionOf(nextAfter(root, w.env, first.progressKey).stdout).retry.attempt, 2, 'inside the window the failure gives the retry');
  w.append([typedAt('change feat', at(30))]);
  const again = nextAfter(root, w.env, first.progressKey);
  assert.equal(actionOf(again.stdout).end?.why, 'no-progress', 'the old failure is outside the window: the key ends for no progress');
});

test('stage-models AC-10 with no readable transcript the progress key ends the run for no progress (kept)', () => {
  const root = featWith({ have: PLAN_OF.design, project: tableText({ design: 'haiku' }) });
  const first = actionOf(nextIn(root).stdout);
  for (const env of [cleanEnv, { ...cleanEnv, CLAUDE_CONFIG_DIR: tmpFolder('devkit-stage-models-cfg-'), CLAUDE_CODE_SESSION_ID: 'session-none' }]) {
    const r = nextAfter(root, env, first.progressKey);
    assert.equal(r.code, 2, r.stdout);
    assert.deepEqual([actionOf(r.stdout).end.why, markers(r)], ['no-progress', ['devkit-run: feat', 'devkit-end: feat blocked']]);
  }
});

test('stage-models AC-10 nextAction reads the subagent folder only when asked to retry, and next asks only with --after', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  const file = w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  const read = (opts) => { let action; const reads = countReads([file], () => { action = loop.nextAction(root, 'feat', { env: w.env, lang: 'en', after: first.progressKey, ...opts }); }); return { action, reads: reads[file] }; };
  const lenient = read({});
  assert.deepEqual([lenient.reads, lenient.action.end?.why], [0, 'no-progress'], 'a lock reads no hand-off');
  const strict = read({ retry: true });
  assert.deepEqual([strict.reads, strict.action.model, strict.action.retry?.attempt], [1, 'sonnet', 2], 'asked to retry, it reads the folder once');
  const given = read({ handOffs: [] });
  assert.deepEqual([given.reads, given.action.end?.why], [0, 'no-progress'], 'a list handed in is read as given');
  const listed = read({ handOffs: guard.handOffsOf(w.transcript, null) });
  assert.deepEqual([listed.reads, listed.action.model], [0, 'sonnet'], 'the list already read is not read again');
});

test('stage-models AC-10 a next with no --after after a failed hand-off, with no budget set, reads neither the transcript nor the subagent folder and hands the table model, while the same call with --after reads them and hands the retry', () => {
  const { root, w, first } = designWorld({ design: 'haiku' });
  const file = w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  let bare;
  const bareReads = countReads([file, w.transcript], () => { bare = nextAfter(root, w.env, null); });
  assert.equal(bare.code, 0, bare.stdout);
  const plain = actionOf(bare.stdout);
  assert.deepEqual([plain.kind, plain.stage, plain.model], ['agent', 'design', 'haiku'], 'the stage on its table model');
  assert.ok(!('retry' in plain), 'no retry mark');
  assert.deepEqual([bareReads[file], bareReads[w.transcript]], [0, 0], 'no hand-off and no transcript read');
  let keyed;
  const keyedReads = countReads([file], () => { keyed = nextAfter(root, w.env, first.progressKey); });
  const retry = actionOf(keyed.stdout);
  assert.deepEqual([retry.model, retry.retry?.attempt], ['sonnet', 2], 'with --after the retry');
  assert.equal(keyedReads[file], 1, 'with --after the folder is read once');
});

test('stage-models AC-11 a retry at the cap is held by the budget, and the retry counts its tokens', () => {
  const capped = (cap) => designWorld({ project: `devkit:\n  budget: ${cap}\n  models:\n    design: haiku\n`, lines: [typedAt('change feat', at(0)), resultAt('devkit-run: feat\n{"version":1}', at(1))] });
  const { root, w, first } = capped(1000);
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10, tokens: 1200 });
  const held = nextAfter(root, w.env, first.progressKey);
  assert.equal(held.code, 1, held.stdout);
  assert.deepEqual([actionOf(held.stdout).end.why, actionOf(held.stdout).stage], ['waiting-budget', 'design']);
  const roomy = capped(5000);
  roomy.w.handOff(1, { prompt: roomy.first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10, tokens: 1200 });
  assert.equal(actionOf(nextAfter(roomy.root, roomy.w.env, roomy.first.progressKey).stdout).retry.attempt, 2, 'under the cap the retry is handed');
  roomy.w.handOff(2, { prompt: roomy.first.brief, model: 'claude-sonnet-5-5', text: DONE, start: 20, tokens: 700 });
  assert.equal(guard.spentOf(roomy.w.transcript, 'feat').spent, 1900, 'the retry is counted with the failed hand-off');
});

// ---------------------------------------------------------------- the retry in a roadmap run (D-5)

// A project of the roadmap `feat` (design stage, its design model haiku) and `other`, in one session.
function roadmapWorld() {
  const root = featWith({ have: PLAN_OF.design, project: tableText({ design: 'haiku' }) });
  put(root, { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1: x\n- [ ] feat\n- [ ] other\n' });
  addOpen(root, 'other');
  const w = sessionWorld([typedAt('roadmap 2', at(0))]);
  putRun(root, { session: 'S1', places: 2 });
  return { root, w };
}
const featOf = (r) => jsonOf(r.stdout).actions.find((a) => a.change === 'feat');

test('stage-models AC-10 in a one-session roadmap run next after a failed hand-off returns the retry, reading the subagent folder once for every change', () => {
  const { root, w } = roadmapWorld();
  const first = featOf(doNext(root, [], { env: w.env }));
  assert.deepEqual([first.kind, first.model, 'retry' in first], ['agent', 'haiku', false]);
  const file = w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  let r;
  const reads = countReads([file, w.transcript], () => { r = doNext(root, ['--after', `feat=${first.progressKey}`], { env: w.env }); });
  assert.equal(r.code, 0, r.stdout);
  const retry = featOf(r);
  assert.deepEqual([retry.kind, retry.stage, retry.model, retry.retry], ['agent', 'design', 'sonnet', { failedOn: 'haiku', attempt: 2 }]);
  assert.equal(retry.progressKey, first.progressKey);
  assert.deepEqual([reads[file], reads[w.transcript]], [1, 1], 'two open changes, one read of each file');
});

test('stage-models AC-10 in a one-session roadmap run two failures end that change blocked, and no other hand-off follows for it', () => {
  const { root, w } = roadmapWorld();
  const first = featOf(doNext(root, [], { env: w.env }));
  w.handOff(1, { prompt: first.brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  w.handOff(2, { prompt: first.brief, model: 'claude-sonnet-5-5', text: FAILED, start: 20 });
  const blocked = doNext(root, ['--after', `feat=${first.progressKey}`], { env: w.env });
  const body = jsonOf(blocked.stdout);
  assert.equal(body.actions.find((a) => a.change === 'feat'), undefined, 'no third hand-off');
  assert.ok(body.lines.some((l) => /^▸ feat stopped: .*could not finish its work/.test(l)), body.lines.join('\n'));
});

test('stage-models AC-10 the stop lock and /devkit status decide and print the same with a failed hand-off in the folder, and the lock reads no hand-off (kept)', () => {
  const { root, w } = roadmapWorld();
  const brief = loop.nextAction(root, 'feat', { env: w.env, lang: 'en' }).brief;
  const stop = () => withTmpDir(() => roadmap.roadmapStopDecision({ session_id: 'S-stage-models', cwd: root, transcript_path: w.transcript }, { env: w.env, run: { command: 'roadmap 2', stopping: false }, gh: OFFLINE, load: () => 10 }));
  const stopBefore = stop();
  const statusBefore = doStatus(root, { env: w.env });
  assert.equal(stopBefore.decision, 'refuse', 'the lock saw work ready');
  // A failed hand-off that spent no token: the board prints no spend for it (the spend readout reads the folder, D-7), so only a retry
  // decision taken from its failure could change what the lock decides or the board prints.
  const file = w.handOff(1, { prompt: brief, model: 'claude-haiku-5-5', text: FAILED, start: 10, tokens: 0 });
  let stopAfter;
  const reads = countReads([file, w.transcript], () => { stopAfter = stop(); });
  const statusAfter = doStatus(root, { env: w.env });
  assert.deepEqual(stopAfter, stopBefore);
  assert.deepEqual([statusAfter.code, statusAfter.stdout], [statusBefore.code, statusBefore.stdout]);
  assert.equal(reads[file], 0, 'the lock reads no hand-off');
});

test('stage-models AC-10 with a session per change next reads no subagent folder and no transcript', () => {
  const { root, w } = roadmapWorld();
  const brief = loop.nextAction(root, 'feat', { env: w.env, lang: 'en' }).brief;
  putRun(root, { session: 'S1', places: 2, changeSessions: true, startedSessions: { feat: { at: at(1) } } });
  const file = w.handOff(1, { prompt: brief, model: 'claude-haiku-5-5', text: FAILED, start: 10 });
  let r;
  const reads = countReads([file, w.transcript], () => { r = doNext(root, ['--turn', 'typed'], { env: w.env }); });
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual([reads[file], reads[w.transcript]], [0, 0]);
});

// ---------------------------------------------------------------- the roadmap's session models (D-6)

const AT0 = '2026-11-23T10:00:00.000Z';
const ORDER = { devkit: devkit.stages.map((s) => s.id), 'devkit-lite': lite.stages.map((s) => s.id) };
const sayAs = (key, params) => `▸ ${loop.render('en', key, params)}`;
// The facts of a run with a session per change (the coordinating session `S-main`).
const sessionFacts = (over = {}) => world({ changeSessions: true, coordinator: 'S-main', turn: 'event', startedSessions: {}, ...over });
// An own-session change `a` recorded on `model` (the record's other fields from `entry`), at `stage` of the script `order`, its table the default over `table`.
function ownFacts({ model, stage, table = {}, order = 'devkit', entry = {}, ...over }) {
  return sessionFacts({
    lines: ['[ ] a'], actions: { a: null }, startedSessions: { a: { at: AT0, model, ...entry } },
    stageModels: { a: { stage, models: { ...DEFAULTS, ...table }, stages: ORDER[order], root: '/w/a' } }, ...over,
  });
}
const switchesOf = (r) => r.actions.filter((a) => a.kind === 'session-model');
const startsOf = (r) => r.actions.filter((a) => a.kind === 'session-start');

// A project of the roadmap `a` (open, at its grill) in a run with a session per change, recorded on `model`.
function switchWorld({ model = 'opus[1m]', run = {}, entry = {} } = {}) {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { places: 1, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT0, model, ...entry } }, ...run });
  return root;
}

test('stage-models AC-6 a new change session starts on the model of its grill, the start input holding it beside context fresh', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const r = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(r.code, 0, r.stdout);
  const start = jsonOf(r.stdout).actions[0];
  assert.deepEqual([start.kind, start.input.model, start.input.context], ['session-start', 'opus', 'fresh']);
  const table = projectWith(roadmapText('[ ] a'), { config: `schema: devkit\n${tableText({ requirements: 'sonnet' })}` });
  addOpen(table, 'a');
  assert.equal(jsonOf(doRun(table, 'roadmap', { extra: ['--change-sessions'] }).stdout).actions[0].input.model, 'sonnet', 'the project table sets the start model');
});

test('stage-models AC-6 a change resumed at its implementation starts on sonnet, and an action with no model adds no model field', () => {
  const facts = (act) => sessionFacts({ lines: ['[ ] b'], actions: { b: act }, turn: 'typed' });
  const resumed = roadmap.decideRoadmap(facts(agentAct('b', 'implementation', { model: 'sonnet' })));
  assert.deepEqual([resumed.actions[0].kind, resumed.actions[0].input.model], ['session-start', 'sonnet']);
  const plain = roadmap.decideRoadmap(facts(agentAct('b', 'implementation', { model: undefined })));
  assert.ok(!('model' in plain.actions[0].input), 'no model on the action, none in the start input');
});

test('stage-models AC-6 a reported session start records the model of the change stage, a reported found session records none', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  addOpen(root, 'a');
  addOpen(root, 'b');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed' });
  const r = doNext(root, ['--turn', 'typed', '--after', 'a=session-start', '--after', 'b=session-found']);
  assert.equal(r.code, 0, r.stdout);
  const recorded = stateOf(root).startedSessions;
  assert.equal(recorded.a.model, 'opus');
  assert.deepEqual(Object.keys(recorded.b), ['at'], 'a found session has no known model');
});

test('stage-models AC-6 a session found running is the change own: no second start, no stage of its, one started line, at the three sites', () => {
  // entriesOf (the own entry) and decideRoadmap (the record and the announcement), on facts.
  const facts = sessionFacts({ lines: ['[ ] a'], actions: { a: agentAct('a', 'proposal', { model: 'opus' }) }, turn: 'typed', after: { a: 'session-found' } });
  const r = roadmap.decideRoadmap(facts);
  assert.deepEqual(r.actions, [], 'no second session start and no stage');
  assert.deepEqual(r.state.sessionsStarted.map((e) => [e.id, e.model]), [['a', undefined]]);
  assert.deepEqual(r.lines, [sayAs('roadmap-session-started', { id: 'a', open: 1, places: 3 })]);
  // collectRoadmap (the skip of a started change's action), on files.
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  const collected = roadmap.collectRoadmap(root, { env: cleanEnv, lang: 'en', gh: OFFLINE, after: { a: 'session-found' }, turn: 'typed' });
  assert.equal(collected.actions.a, undefined, 'the change of a found session is not read for a stage');
  // and the whole call.
  const first = doNext(root, ['--turn', 'typed', '--after', 'a=session-found']);
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(events(first.stdout), [sayAs('roadmap-session-started', { id: 'a', open: 1, places: 1 })]);
  assert.ok(!jsonOf(first.stdout).actions.some((a) => a.change === 'a'));
  const again = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(events(again.stdout), [], 'said once');
  assert.deepEqual(jsonOf(again.stdout).actions, []);
});

test('stage-models AC-6 a run file entry written before this change reads back as { at }, a model or a refused one is kept only when it is a model', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { startedSessions: { a: { at: AT0 }, b: { at: AT0, model: 'sonnet', refused: 'haiku' }, c: { at: AT0, model: 'gpt', refused: 4 } } });
  assert.deepEqual(loop.readRun(loop.runFilePath(root)).startedSessions, { a: { at: AT0 }, b: { at: AT0, model: 'sonnet', refused: 'haiku' }, c: { at: AT0 } });
});

// ---------------------------------------------------------------- the step-down rule (D-6)

test('stage-models AC-7 stepDownOf, with every session-run stage on the stage model, gives that model only when it is cheaper than the session and not the refused one', () => {
  for (const m of VALUES) {
    const models = Object.fromEntries(STAGES.map((stage) => [stage, m]));
    for (const current of VALUES) {
      for (const stage of STAGES) {
        assert.equal(roadmap.stepDownOf({ current, stage, models, stages: STAGES, refused: undefined }), loop.cheaper(m, current) ? m : null, `${current} to ${m} at ${stage}`);
        assert.equal(roadmap.stepDownOf({ current, stage, models, stages: STAGES, refused: m }), null, `${m} refused at ${stage}`);
      }
    }
  }
});

test('stage-models AC-7 stepDownOf with the default table never gives haiku: from opus it gives sonnet or nothing at each stage of each script, and sonnet at the unit tests and the delivery', () => {
  for (const [script, order] of Object.entries(ORDER)) {
    for (const stage of STAGES.filter((s) => order.includes(s))) {
      const fromOpus = roadmap.stepDownOf({ current: 'opus', stage, models: DEFAULTS, stages: order });
      assert.equal(fromOpus, DEFAULTS[stage] === 'opus' ? null : 'sonnet', `${script} ${stage} from opus`);
      assert.equal(roadmap.stepDownOf({ current: 'sonnet', stage, models: DEFAULTS, stages: order }), null, `${script} ${stage} from sonnet never goes to haiku`);
    }
    for (const stage of ['unit-tests', 'delivery']) assert.equal(roadmap.stepDownOf({ current: 'opus', stage, models: DEFAULTS, stages: order }), 'sonnet', `${script} ${stage}`);
  }
  // A stage the script does not have: every session-run stage of the script is ahead, the grill's Opus included.
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'mockup', models: DEFAULTS, stages: ORDER['devkit-lite'] }), null);
});

test('stage-models AC-7 stepDownOf gives haiku once no session-run stage ahead needs more, and nothing while one does', () => {
  assert.equal(roadmap.stepDownOf({ current: 'sonnet', stage: 'delivery', models: { ...DEFAULTS, retro: 'haiku' }, stages: ORDER.devkit }), 'haiku');
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'unit-tests', models: { ...DEFAULTS, review: 'opus' }, stages: ORDER.devkit }), null);
});

test('stage-models AC-7 stepDownOf gives nothing for a null stage, a stage with no valid model, and a refused floor', () => {
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: null, models: DEFAULTS, stages: ORDER.devkit }), null);
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'approval', models: { ...DEFAULTS, approval: 'gpt' }, stages: ORDER.devkit }), null);
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'approval', models: DEFAULTS, stages: ORDER.devkit }), 'sonnet');
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'approval', models: DEFAULTS, stages: ORDER.devkit, refused: 'sonnet' }), null);
});

test('stage-models AC-7 stepDownOf counts the approval only in the script that has it', () => {
  const table = { ...DEFAULTS, tasks: 'sonnet', approval: 'opus' };
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'tasks', models: table, stages: ORDER['devkit-lite'] }), 'sonnet', 'devkit-lite has no approval');
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'tasks', models: table, stages: ORDER.devkit }), null, 'the approval is ahead in devkit');
  assert.equal(roadmap.stepDownOf({ current: 'opus', stage: 'implementation', models: table, stages: ORDER.devkit }), 'sonnet', 'the approval is behind');
});

// ---------------------------------------------------------------- the switch, in the decision (D-6)

test('stage-models AC-7 a session on opus with its change at the approval gets one session-model to sonnet, on an event turn and on a typed one', () => {
  for (const turn of ['event', 'typed']) {
    const r = roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval', turn }));
    assert.deepEqual(switchesOf(r), [{ change: 'a', kind: 'session-model', cwd: '/w/a', model: 'sonnet', progressKey: 'session-model' }], turn);
    assert.deepEqual(startsOf(r), []);
  }
});

test('stage-models AC-7 a session on sonnet with its change at its unit tests or its delivery gets no switch, the retro ahead being on sonnet', () => {
  for (const stage of ['unit-tests', 'delivery']) {
    assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'sonnet', stage }))), [], stage);
    assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus', stage }))).map((a) => a.model), ['sonnet'], `${stage}: the same stage switches a session on opus to the floor`);
  }
  const model = 'haiku';
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model, stage: 'delivery' }))), [], 'a session on haiku is never switched up');
});

test('stage-models AC-7 a session on opus at its unit tests with review on opus in the table gets no switch, and with retro on haiku at the delivery from sonnet it gets haiku', () => {
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'unit-tests', table: { review: 'opus' } }))), []);
  const r = roadmap.decideRoadmap(ownFacts({ model: 'sonnet', stage: 'delivery', table: { retro: 'haiku' } }));
  assert.deepEqual(switchesOf(r).map((a) => a.model), ['haiku']);
});

test('stage-models AC-7 no session is switched to haiku by the default table, whichever stage its change is at', () => {
  let switched = 0;
  for (const order of Object.keys(ORDER)) {
    for (const stage of STAGES.filter((s) => ORDER[order].includes(s))) {
      for (const model of ['opus', 'opus[1m]', 'sonnet']) {
        const models = switchesOf(roadmap.decideRoadmap(ownFacts({ model, stage, order }))).map((a) => a.model);
        assert.ok(!models.includes('haiku'), `${order} ${stage} from ${model}`);
        switched += models.length;
      }
    }
  }
  assert.ok(switched > 0, 'the walk does switch sessions to sonnet');
});

test('stage-models AC-7 a session on sonnet with its change at its retro and retro on opus in the table gets no switch, and no upward floor gives one', () => {
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'sonnet', stage: 'retro', table: { retro: 'opus' } }))), []);
  for (const [model, stage] of [['sonnet', 'design'], ['sonnet', 'approval'], ['haiku', 'approval'], ['opus', 'design'], ['opus[1m]', 'design']]) {
    const to = switchesOf(roadmap.decideRoadmap(ownFacts({ model, stage }))).map((a) => a.model);
    assert.deepEqual(to, model === 'opus[1m]' ? ['opus'] : [], `${model} at ${stage}`);
  }
});

test('stage-models AC-7 after a reported switch the record holds the target and no switch follows, after a refused one the same target is not returned again', () => {
  const done = roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval', after: { a: 'session-model' } }));
  assert.deepEqual(switchesOf(done), []);
  assert.deepEqual(done.state.sessionModels, [{ id: 'a', model: 'sonnet' }]);
  const refused = roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval', after: { a: 'session-model-refused' } }));
  assert.deepEqual(switchesOf(refused), []);
  assert.deepEqual(refused.state.modelsRefused, [{ id: 'a', model: 'sonnet' }]);
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval', entry: { refused: 'sonnet' } }))), [], 'the refused target is not returned again');
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus[1m]', stage: 'approval', entry: { refused: 'sonnet' } }))).map((a) => a.model), [], 'a refused floor stays refused');
});

test('stage-models AC-7 a stopping run returns no switch', () => {
  assert.equal(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval' }))).length, 1, 'the same facts switch while the run goes on');
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(ownFacts({ model: 'opus', stage: 'approval', stopping: true }))), []);
});

test('stage-models AC-7 a session whose record holds no model is never switched', () => {
  const facts = ownFacts({ model: 'opus', stage: 'approval' });
  assert.equal(switchesOf(roadmap.decideRoadmap(facts)).length, 1, 'a recorded model is switched');
  facts.startedSessions = { a: { at: AT0 } };
  assert.deepEqual(switchesOf(roadmap.decideRoadmap(facts)), []);
});

test('stage-models AC-7 collectRoadmap reads the stage, the table and the script order of a change recorded with a model, only when asked to', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'), { config: `schema: devkit\n${tableText({ design: 'sonnet' })}` });
  addOpen(root, 'a');
  addOpen(root, 'b');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT0, model: 'opus[1m]' }, b: { at: AT0 } } });
  const ask = (over = {}) => roadmap.collectRoadmap(root, { env: cleanEnv, lang: 'en', gh: OFFLINE, wheres: 'none', turn: 'typed', ...over });
  assert.equal(ask().stageModels, undefined, 'the stop lock and the board read none');
  const facts = ask({ models: true });
  assert.deepEqual(Object.keys(facts.stageModels), ['a'], 'b has no recorded model');
  const a = facts.stageModels.a;
  assert.deepEqual([a.stage, a.models.design, a.models.requirements, a.stages, a.root], ['requirements', 'sonnet', 'opus', ORDER.devkit, realpathSync(root)]);
});

test('stage-models AC-7 next returns one switch for a session recorded on opus[1m] at its grill, takes the report as done and the refusal as final', () => {
  const root = switchWorld();
  const first = doNext(root, ['--turn', 'event']);
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(jsonOf(first.stdout).actions, [{ change: 'a', kind: 'session-model', cwd: realpathSync(root), model: 'opus', progressKey: 'session-model' }]);
  const done = doNext(root, ['--turn', 'event', '--after', 'a=session-model']);
  assert.deepEqual(jsonOf(done.stdout).actions, []);
  assert.deepEqual(stateOf(root).startedSessions.a, { at: AT0, model: 'opus' });
  assert.deepEqual(jsonOf(doNext(root, ['--turn', 'event']).stdout).actions, []);
  const refusing = switchWorld();
  const refused = doNext(refusing, ['--turn', 'event', '--after', 'a=session-model-refused']);
  assert.deepEqual(jsonOf(refused.stdout).actions, []);
  assert.deepEqual(stateOf(refusing).startedSessions.a, { at: AT0, model: 'opus[1m]', refused: 'opus' });
  assert.deepEqual(jsonOf(doNext(refusing, ['--turn', 'event']).stdout).actions, [], 'the refused switch is not returned again');
});

test('stage-models AC-7 a stopping run and the stop lock return no switch', () => {
  const stopping = switchWorld({ run: { stopping: true } });
  assert.deepEqual(jsonOf(doNext(stopping, ['--turn', 'event']).stdout).actions, []);
  const root = switchWorld();
  assert.equal(jsonOf(doNext(switchWorld(), ['--turn', 'event']).stdout).actions.length, 1, 'a run that goes on is switched');
  const d = withTmpDir(() => roadmap.roadmapStopDecision({ session_id: 'S-stage-models', cwd: root }, { env: cleanEnv, run: { command: 'roadmap', stopping: false }, gh: OFFLINE, load: () => 10 }));
  assert.equal(d.decision, 'allow', 'no switch is work the stop lock holds the session for');
});

// ---------------------------------------------------------------- the spend readout (D-7)

const runResult = (id, stage, when) => resultAt(`devkit-run: ${id}\n${JSON.stringify({ version: 1, ...(stage ? { stage } : {}) })}`, when);
const briefFor = (id, stage) => `Change ${id} (devkit script), stage ${stage}: do it. Work only in /w/${id} on branch ${id}. Write the change's files in English.`;
const titleOf = (stage) => ({ design: 'Design', 'unit-tests': 'Unit tests' })[stage] ?? stage;

// The spec's known numbers: one Opus message of 3210 tokens at the design stage, a subagent of 1105 at the tasks stage.
function knownWorld() {
  const w = sessionWorld([typedAt('change feat', at(0)), runResult('feat', 'design', at(1)), modelLine({ id: 'm1', model: 'claude-opus-5-5', input: 10, output: 200, cacheWrite: 3000, at: at(2), sidechain: false })]);
  subagentFile(w.subagents, 1, { prompt: briefFor('feat', 'tasks'), start: at(5), lines: [modelLine({ id: 's1', model: 'claude-opus-5-5', input: 5, output: 100, cacheWrite: 1000, at: at(6) })] });
  return w;
}
const KNOWN = { change: 'feat', stages: [{ stage: 'design', models: { opus: 3210 } }, { stage: 'tasks', models: { opus: 1105 } }], retries: [], total: 4315 };

test('stage-models AC-12 the spend of a change is read per stage and per model: the known numbers give 3210 and 1105, 4315 in all', () => {
  assert.deepEqual(guard.spendOf([knownWorld().transcript], 'feat'), KNOWN);
});

test('stage-models AC-12 another change run line and the lines before the first run line do not count, and a message id counts once', () => {
  const dupe = modelLine({ id: 'm-a', model: 'claude-sonnet-5-5', input: 100, at: at(3) });
  const w = sessionWorld([
    typedAt('change feat', at(0)), modelLine({ id: 'm-pre', model: 'claude-opus-5-5', input: 50, at: at(1) }), runResult('feat', 'design', at(2)), dupe, dupe,
    runResult('other', 'design', at(4)), modelLine({ id: 'm-b', model: 'claude-opus-5-5', input: 500, at: at(5) }), runResult('feat', 'tasks', at(6)), modelLine({ id: 'm-c', model: 'claude-opus-5-5', input: 7, at: at(7) }),
  ]);
  assert.deepEqual(guard.spendOf([w.transcript], 'feat'), { change: 'feat', stages: [{ stage: 'design', models: { sonnet: 100 } }, { stage: 'tasks', models: { opus: 7 } }], retries: [], total: 107 });
  assert.equal(guard.spendOf([w.transcript], 'other').total, 500);
  assert.equal(guard.spendOf([w.transcript], 'absent').total, 0);
});

test('stage-models AC-12 a session message with no stage on the run line counts under the null stage, and a model it cannot tell under other', () => {
  const w = sessionWorld([typedAt('change feat', at(0)), runResult('feat', null, at(1)), modelLine({ id: 'x', model: 'mystery-1', input: 9, at: at(2) })]);
  assert.deepEqual(guard.spendOf([w.transcript], 'feat').stages, [{ stage: null, models: { other: 9 } }]);
});

test('stage-models AC-12 a transcript or a subagent that cannot be read adds nothing, and a cut-off last line adds its whole lines only', () => {
  const w = knownWorld();
  appendFileSync(w.transcript, '{"type":"assistant","message":{"id":"cut","model":"claude-opus-5-5","usage":{"input_tokens":9');
  writeFileSync(join(w.subagents, 'agent-2.jsonl'), '{"type":"user","message":{"content":"Change feat (devkit script), stage tasks: x. Write the change\'s files in English."}');
  assert.deepEqual(guard.spendOf(['/no/such/transcript.jsonl', w.transcript, w.transcript], 'feat'), KNOWN);
});

test('stage-models AC-11 a retry is listed with its families and its tokens, and the stage shows both models', () => {
  const w = sessionWorld();
  const brief = briefFor('feat', 'unit-tests');
  subagentFile(w.subagents, 1, { prompt: brief, start: at(10), lines: [modelLine({ id: 'h1', model: 'claude-haiku-5-5', input: 4000, at: at(11), text: FAILED })] });
  subagentFile(w.subagents, 2, { prompt: brief, start: at(20), lines: [modelLine({ id: 's2', model: 'claude-sonnet-5-5', input: 9000, at: at(21), text: DONE })] });
  assert.deepEqual(guard.spendOf([w.transcript], 'feat'), {
    change: 'feat', stages: [{ stage: 'unit-tests', models: { haiku: 4000, sonnet: 9000 } }], retries: [{ stage: 'unit-tests', from: 'haiku', to: 'sonnet', tokens: 9000 }], total: 13000,
  });
});

test('stage-models AC-12 the total line holds the cap when there is one and says no budget is set when there is none, and nothing is printed for no token', () => {
  const spend = { change: 'feat', stages: [{ stage: 'design', models: { opus: 3210 } }], retries: [], total: 3210 };
  assert.equal(guard.spendLines('en', spend, { cap: 2000000, titleOf }).at(-1), 'Total: 3210 tokens of the budget 2000000');
  assert.equal(guard.spendLines('en', spend, { cap: null, titleOf }).at(-1), 'Total: 3210 tokens; no budget is set');
  assert.equal(guard.spendLines('pt-BR', spend, { cap: 2000000, titleOf }).at(-1), 'Total: 3210 tokens do orçamento 2000000');
  assert.equal(guard.spendLines('pt-BR', spend, { titleOf }).at(-1), 'Total: 3210 tokens; nenhum orçamento definido');
  assert.deepEqual(guard.spendLines('en', { ...spend, stages: [], total: 0 }, { cap: 5, titleOf }), []);
});

test('stage-models AC-12 every spend row of either language is the text render gives it, and a stage line reads Stage Design or Etapa Design with no doubled stage phrase', () => {
  const spend = {
    change: 'feat', stages: [{ stage: 'design', models: { opus: 3210, sonnet: 1105 } }, { stage: null, models: { opus: 40, other: 2 } }],
    retries: [{ stage: 'design', from: 'haiku', to: 'sonnet', tokens: 9000 }], total: 4357,
  };
  for (const lang of ['en', 'pt-BR']) {
    const expected = [
      loop.render(lang, 'spend-head', { id: 'feat' }), loop.render(lang, 'spend-stage', { title: 'Design', models: 'sonnet 1105, opus 3210' }),
      loop.render(lang, 'spend-stage-none', { models: 'opus 40, other 2' }), loop.render(lang, 'spend-retry', { title: 'Design', from: 'haiku', to: 'sonnet', tokens: 9000 }),
      loop.render(lang, 'spend-total', { tokens: 4357, cap: 2000000 }),
    ];
    const lines = guard.spendLines(lang, spend, { cap: 2000000, titleOf });
    assert.deepEqual(lines, expected, lang);
    assert.equal(lines[1], lang === 'en' ? 'Stage Design: sonnet 1105, opus 3210' : 'Etapa Design: sonnet 1105, opus 3210');
    const none = guard.spendLines(lang, spend, { titleOf });
    assert.equal(none.at(-1), loop.render(lang, 'spend-total-none', { tokens: 4357 }));
    assert.deepEqual(Object.keys(guard.SPEND_MESSAGES[lang]).sort(), ['spend-head', 'spend-retry', 'spend-stage', 'spend-stage-none', 'spend-total', 'spend-total-none']);
    for (const [key, text] of Object.entries(guard.SPEND_MESSAGES[lang])) assert.equal(loop.MESSAGES[lang][key], text, `${lang} ${key} is a row of the one message table`);
  }
});

test('stage-models AC-12 budgetValue is one function whether it is imported from guard or from change-loop, and reads as it always did', () => {
  assert.equal(guard.budgetValue, loop.budgetValue);
  assert.deepEqual([guard.budgetValue(undefined), guard.budgetValue('2000000'), guard.budgetValue('0'), guard.budgetValue('x')], [null, { cap: 2000000 }, { invalid: '0' }, { invalid: 'x' }]);
});

test('stage-models AC-12 spendSources names the session transcript and every transcript of the change folder of the host, each once', () => {
  const config = tmpFolder('devkit-stage-models-cfg-');
  const root = '/home/u/repos/devkit/.claude/worktrees/stage-models';
  const folder = join(config, 'projects', '-home-u-repos-devkit--claude-worktrees-stage-models');
  mkdirSync(join(folder, 'a', 'subagents'), { recursive: true });
  for (const name of ['a.jsonl', 'b.jsonl', 'c.txt']) writeFileSync(join(folder, name), '');
  const env = { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'a' };
  assert.deepEqual(guard.spendSources(env, root).sort(), [join(folder, 'a.jsonl'), join(folder, 'b.jsonl')]);
  assert.deepEqual(guard.spendSources({ CLAUDE_CONFIG_DIR: config }, root).sort(), [join(folder, 'a.jsonl'), join(folder, 'b.jsonl')], 'no session id: the folder only');
  const other = join(config, 'projects', '-elsewhere');
  mkdirSync(other);
  writeFileSync(join(other, 's.jsonl'), '');
  assert.deepEqual(guard.spendSources({ ...env, CLAUDE_CODE_SESSION_ID: 's' }, root).sort(), [join(other, 's.jsonl'), join(folder, 'a.jsonl'), join(folder, 'b.jsonl')]);
  assert.deepEqual(guard.spendSources(env, '/no/such/folder'), [join(folder, 'a.jsonl')], 'a root with no folder of its own reads only the session transcript');
  assert.deepEqual(guard.spendSources({ CLAUDE_CONFIG_DIR: config }, '/no/such/folder'), [], 'and with no session, nothing');
});

// A change `feat` at its design stage with the spend of KNOWN in the session of `w`.
function spendRoot({ project = null } = {}) {
  const root = featWith({ have: PLAN_OF.design, project });
  return { root, w: knownWorld() };
}
const porcelain = (root) => execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
const EXPECTED_BLOCK = ['Spend of feat, in tokens:', 'Stage Design: opus 3210', 'Stage Tasks: opus 1105', 'Total: 4315 tokens; no budget is set'];
const stageTitle = (flow, id, lang = 'en') => flow.stages.find((s) => s.id === id).title[lang];

test('stage-models AC-12 flow-check prints the spend block after the readout, with the cap of the project, and its --json is unchanged', () => {
  const { root, w } = spendRoot();
  const plain = flowCheck.main(['feat', '--lang', 'en'], { cwd: root, env: cleanEnv, gh: OFFLINE });
  const shown = flowCheck.main(['feat', '--lang', 'en'], { cwd: root, env: w.env, gh: OFFLINE });
  assert.equal(shown.code, plain.code);
  assert.equal(shown.stdout, `${plain.stdout}\n${['Spend of feat, in tokens:', `Stage ${stageTitle(devkit, 'design')}: opus 3210`, `Stage ${stageTitle(devkit, 'tasks')}: opus 1105`, 'Total: 4315 tokens; no budget is set'].join('\n')}\n`);
  const capped = spendRoot({ project: 'devkit:\n  budget: 2000000\n' });
  const withCap = flowCheck.main(['feat', '--lang', 'en'], { cwd: capped.root, env: capped.w.env, gh: OFFLINE });
  assert.ok(withCap.stdout.endsWith('Total: 4315 tokens of the budget 2000000\n'), withCap.stdout);
  const pt = flowCheck.main(['feat', '--lang', 'pt-BR'], { cwd: root, env: w.env, gh: OFFLINE });
  assert.match(pt.stdout, /Gasto de feat, em tokens:\nEtapa Design: opus 3210\nEtapa .*: opus 1105\nTotal: 4315 tokens; nenhum orçamento definido\n$/);
  const json = (env) => flowCheck.main(['feat', '--json'], { cwd: root, env, gh: OFFLINE });
  assert.equal(json(w.env).stdout, json(cleanEnv).stdout, '--json prints no spend');
});

test('stage-models AC-12 roadmap status prints one spend block for the open change that counted tokens, and none for the other', () => {
  const root = featWith({ have: PLAN_OF.design });
  put(root, { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1: x\n- [ ] feat\n- [ ] other\n' });
  addOpen(root, 'other');
  putRun(root, { session: 'S1', places: 2 });
  const w = knownWorld();
  const board = doStatus(root);
  const shown = doStatus(root, { env: w.env });
  assert.equal(shown.code, 0, shown.stdout);
  assert.equal(shown.stdout, `${board.stdout}\nfeat\n${EXPECTED_BLOCK.map((l) => `  ${l.replace(/^Stage Design/, `Stage ${stageTitle(devkit, 'design')}`).replace(/^Stage Tasks/, `Stage ${stageTitle(devkit, 'tasks')}`)}`).join('\n')}\n`);
  assert.ok(!/^other$/m.test(shown.stdout.slice(board.stdout.length)), 'nothing for the change with no token');
});

test('stage-models AC-12 neither command writes a file, a branch or the run file', () => {
  const { root, w } = spendRoot();
  put(root, { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1: x\n- [ ] feat\n' });
  putRun(root, { session: 'S1', places: 1 });
  const runFile = loop.runFilePath(root);
  const before = [porcelain(root), readFileSync(runFile, 'utf8'), execFileSync('git', ['-C', root, 'branch', '--list', '--all'], { encoding: 'utf8' })];
  assert.match(flowCheck.main(['feat', '--lang', 'en'], { cwd: root, env: w.env, gh: OFFLINE }).stdout, /Spend of feat/, 'the spend is printed');
  assert.match(doStatus(root, { env: w.env }).stdout, /Spend of feat/, 'on the board too');
  assert.deepEqual([porcelain(root), readFileSync(runFile, 'utf8'), execFileSync('git', ['-C', root, 'branch', '--list', '--all'], { encoding: 'utf8' })], before);
});

test('stage-models AC-12 with no transcript, or one that counts no token for the change, both outputs are what they were (kept)', () => {
  const root = featWith({ have: PLAN_OF.design });
  put(root, { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1: x\n- [ ] feat\n' });
  putRun(root, { session: 'S1', places: 1 });
  const base = { flow: flowCheck.main(['feat', '--lang', 'en'], { cwd: root, env: cleanEnv, gh: OFFLINE }), board: doStatus(root) };
  const idle = sessionWorld([typedAt('change feat', at(0)), runResult('feat', 'design', at(1))]);
  const missing = { ...idle.env, CLAUDE_CODE_SESSION_ID: 'no-such-session' };
  for (const env of [idle.env, missing]) {
    assert.deepEqual(flowCheck.main(['feat', '--lang', 'en'], { cwd: root, env, gh: OFFLINE }), base.flow);
    assert.deepEqual(doStatus(root, { env }), base.board);
  }
});

// ---------------------------------------------------------------- the skill and the documents (D-9, D-10)

const REPO = join(HERE, '..', '..', '..');
const textOf = (...path) => readFileSync(join(REPO, ...path), 'utf8');
const ADR_FILE = '0020-the-model-is-chosen-by-stage.md';
// The paragraph of the flow document that starts with `**The model of each stage.**`, up to the next blank line.
const modelParagraph = () => textOf('docs', 'openspec-flow.md').split('\n\n').find((p) => p.startsWith('**The model of each stage.**')) ?? '';

test('stage-models AC-7 the session-per-change part of the skill names session-model, session-found, session-model-refused and set_session_model', () => {
  const part = SKILL.slice(SKILL.indexOf('A session per change'));
  for (const word of ['session-model', 'session-found', 'session-model-refused', 'set_session_model']) assert.ok(part.includes(word), word);
});

test('stage-models AC-1 the ADR the change adds is numbered 0020 and no other file of docs/adr takes that number', () => {
  const files = readdirSync(join(REPO, 'docs', 'adr')).filter((f) => f.startsWith('0020-'));
  assert.deepEqual(files, [ADR_FILE]);
  assert.match(textOf('docs', 'adr', ADR_FILE), /^# ADR 0020: The model is chosen by stage/);
});

test('stage-models AC-7 the ADR 0014 header says it is amended by ADR 0020 and a Note gives the amendment', () => {
  const adr = textOf('docs', 'adr', '0014-each-roadmap-change-runs-in-a-session-of-its-own.md');
  const header = adr.slice(0, adr.indexOf('\n## Context'));
  assert.ok(header.includes(`- Amended by ADR 0020 (${ADR_FILE})`), 'the header line');
  assert.match(adr, /Note \(stage-models, 2026-11-23\): \[ADR 0020\]\(0020-the-model-is-chosen-by-stage\.md\) amends\s+decision 1/);
  assert.ok(header.includes('- Amended by ADR 0017'), 'the earlier amendment stays');
});

test('stage-models AC-2 the settings comment names the optional models table and the ADRs line names 0020', () => {
  const config = textOf('openspec', 'config.yaml');
  const comment = config.slice(0, config.indexOf('\ndevkit:\n')).split('\n').filter((l) => l.startsWith('#')).join('\n');
  assert.match(comment, /models:/);
  assert.match(comment, /\.openspec\.yaml/);
  const adrs = config.split('\n').find((l) => l.trimStart().startsWith('ADRs:'));
  assert.match(adrs, /0020 the model chosen by stage, sessions only step down and never below the stages they still run, a failed stage retried once a model up, amends 0014/);
});

test('stage-models AC-1 the flow document says what the model of each stage is: the key, the values, [1m], the retry, the step-down and its floor, the readout', () => {
  const text = modelParagraph();
  assert.ok(text, 'the paragraph exists');
  for (const word of ['models:', 'openspec/config.yaml', '.openspec.yaml', 'setting-unknown', '[1m]', 'retr', 'step', 'floor', 'session-run', 'Haiku', 'flow-check', '/devkit status', ...STAGES]) assert.ok(text.includes(word), word);
  assert.ok(textOf('docs', 'openspec-flow.md').indexOf('**The token budget.**') < textOf('docs', 'openspec-flow.md').indexOf('**The model of each stage.**'), 'it follows the token budget paragraph');
});

test('stage-models AC-10 the flow document Troubleshooting table has the four model rows', () => {
  const rows = textOf('docs', 'openspec-flow.md').split('\n').filter((l) => l.startsWith('| '));
  assert.ok(rows.some((r) => /setting-unknown/.test(r) && /models/.test(r)), 'a models setting-unknown row');
  assert.ok(rows.some((r) => /another model than the table/.test(r) && /ignores `model`/.test(r)), 'a stage on another model');
  assert.ok(rows.some((r) => /never stepped down/.test(r) && /floor/.test(r) && /session-model-refused|refused switch/.test(r)), 'a change session that never stepped down');
  assert.ok(rows.some((r) => /started on the host's default/.test(r) && /coordinating session/.test(r)), 'a change session on the host default');
});

test('stage-models AC-1 the flow document Cost section states the table, not the old one-Opus claim', () => {
  const flow = textOf('docs', 'openspec-flow.md');
  const cost = flow.slice(flow.indexOf('\n## Cost'), flow.indexOf('\n## Limits'));
  assert.ok(!flow.includes('only `change-planner` uses Opus'), 'the old claim is gone');
  assert.match(cost, /Each stage's hand-off runs on the model of the stage's row in the\s+`models:` table/);
  assert.match(cost, /reviewers of a review round keep their own `model:`/);
});

test('stage-models AC-2 the coordination design names devkit.models as final, decided by stage-models', () => {
  const design = textOf('docs', 'coordination-design.md');
  assert.match(design, /`devkit\.models`[^]*?\.openspec\.yaml[^]*?final[^]*?`stage-models` on 2026-11-23/);
});
