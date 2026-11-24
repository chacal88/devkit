// node scripts/test-suite.mjs plugins/openspec/hooks/change-state-stages.test.mjs
// run-status-bar, phase 1 (design D-4, D-11 S-1 to S-12): the `stages` field of the state command and its `--offline` flag.
// The stage helper itself is tested in flow-check.test.mjs (H-1 to H-8); the exact contract of one entry in
// change-loop-remote-state.test.mjs (E-1). What the parts share is in test-fixtures.mjs and change-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitRepo, put, commitAll, git, head, planChange, roundRepo, fakeGh, cleanEnvLoop as cleanEnv, SET_LOOP as SET } from './test-fixtures.mjs';
import { main, runFilePath } from './change-loop.mjs';
import { LOOP, IDENT, approvedChange, deliveredChange, next, parsed, read } from './change-loop-fixtures.mjs';

for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

const stateCmd = (cwd, extra = [], env = cleanEnv, opts = {}) => main(['state', '--lang', 'en', ...extra], { cwd, env, ...opts });
const entriesOfRun = (r) => { assert.equal(r.code, 0, r.stdout + r.stderr); return JSON.parse(r.stdout).changes; };
const entryOf = (r) => { const list = entriesOfRun(r); assert.equal(list.length, 1); return list[0]; };
const noGh = () => ({ status: 1, stdout: '', stderr: 'offline' });
const stagesOf = (root, extra = [], env = cleanEnv, opts = {}) => entryOf(stateCmd(root, ['--change', 'feat', ...extra], env, opts)).stages;

// The ids of the `devkit` flow, in order, and the three conditions that drop one (flow.json of schemas/devkit).
const FULL = ['open', 'requirements', 'mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness', 'approval', 'implementation',
  'unit-tests', 'e2e-tests', 'evidence', 'review', 'delivery', 'retro'];
const without = (...ids) => FULL.filter((id) => !ids.includes(id));

// A `devkit` change `feat` at the grill: no file, or only its requirements file (with its stage header, so the change is not
// read as one begun under the previous script), which carries the classification line when `flags` is given.
const withClassification = (root, flags) => {
  const body = `# Requirements\n\nClassification: size=m flags=[${flags}]\n`;
  put(root, { 'openspec/changes/feat/requirements.md': `${head('requirements', git(root, 'rev-parse', 'HEAD'))}${body}` });
  commitAll(root, 'classification');
};
function grillChange({ flags = null, config = 'schema: devkit\n' } = {}) {
  const root = gitRepo({ config, changes: { feat: { '.openspec.yaml': 'schema: devkit\n' } } });
  if (flags !== null) withClassification(root, flags);
  return root;
}

// Invariant (S-1, command, change-state-stages.test.mjs): the list is the flow's, less the stages whose condition does not hold.
test('run-status-bar AC-3 stages: a devkit change with the flags ui and contract and no test settings lists the 15 ids', () => {
  const stages = stagesOf(grillChange({ flags: 'ui, contract' }));
  assert.deepEqual(stages, without('unit-tests', 'e2e-tests'));
  assert.equal(stages.length, 15);
  assert.equal(stages[0], 'open');
  assert.equal(stages[14], 'retro');
});

// Invariant (S-2): a mock-up stage with no file and no ui flag does not apply.
test('run-status-bar AC-3 stages: without the ui flag and no mockup.md, mockup is not listed', () => {
  for (const [label, root] of [['another flag', grillChange({ flags: 'contract' })], ['no classification line', grillChange()]]) {
    const stages = stagesOf(root);
    assert.equal(stages.includes('mockup'), false, label);
    assert.equal(stages.includes('decisions'), true, `${label}: the decisions stage still applies at the grill`);
  }
});

// Invariant (S-3): a test stage applies when its setting is set.
test('run-status-bar AC-3 stages: with tests.unit set, unit-tests is listed and e2e-tests is not', () => {
  const root = grillChange({ flags: 'ui', config: 'schema: devkit\ndevkit:\n  tests:\n    unit: "npm test"\n' });
  const stages = stagesOf(root);
  assert.equal(stages.includes('unit-tests'), true);
  assert.equal(stages.includes('e2e-tests'), false);
  assert.deepEqual(stages, without('e2e-tests'));
  assert.equal(stagesOf(grillChange({ flags: 'ui' })).includes('unit-tests'), false, 'without the setting');
});

// Invariant (S-4): a stage that the file itself declares not applicable is part of the list, as a done mark.
test('run-status-bar AC-3 stages: a decisions.md with result not-applicable keeps decisions in the list', () => {
  const kept = stagesOf(planChange({ have: ['requirements', 'decisions', 'proposal'], results: { decisions: 'not-applicable' } }));
  assert.equal(kept.includes('decisions'), true);
  const missing = stagesOf(planChange({ have: ['requirements', 'proposal'] }));
  assert.equal(missing.includes('decisions'), false, 'with no decisions file the proposal has passed its point');
});

// Invariant (S-5): `stages` is null where no flow is read, through the command.
test('run-status-bar AC-3 stages: stages is null for an archived change, a start with no folder and a previous-script change', async (t) => {
  await t.test('archived', () => {
    const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
    const entry = entryOf(stateCmd(archived, ['--change', 'feat'], cleanEnv, { openspec: noGh, gh: noGh }));
    assert.deepEqual([entry.state, entry.stages], ['archived', null]);
  });
  await t.test('a start the run file names with no folder', () => {
    const r = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] d\n', config: 'schema: devkit\n' });
    const file = runFilePath(r.main);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, places: 1, starting: ['d'], inflight: { d: { kind: 'agent', stage: 'open', at: '2026-11-21T10:00:00.000Z' } } }));
    const entry = entryOf(stateCmd(r.main, ['--change', 'd'], cleanEnv, { gh: noGh }));
    assert.deepEqual([entry.script, entry.stages], [null, null]);
  });
  await t.test('a change begun under the previous script', () => {
    const entry = entryOf(stateCmd(planChange({ have: ['requirements', 'proposal'], headerless: true }), ['--change', 'feat']));
    assert.deepEqual([entry.state, entry.script, entry.stages], ['blocked', 'devkit', null]);
  });
  await t.test('a current change, as the contrast', () => {
    assert.ok(Array.isArray(stagesOf(approvedChange())));
  });
});

// Invariant (S-6): `next` is not the state command; its action has no `stages` key.
test('run-status-bar AC-3 stages: next prints no stages key', () => {
  const root = approvedChange();
  const r = next(root);
  assert.doesNotMatch(r.stdout, /"stages"/);
  assert.equal('stages' in parsed(r).action, false);
});

// The logging gh and a real process: what the status line's call looks like (design D-4).
const realState = (cwd, env, extra) => spawnSync(process.execPath, [LOOP, 'state', '--lang', 'en', ...extra], { cwd, env: { ...env, ...SET }, encoding: 'utf8' });

// Invariant (S-7, GitHub silence of the flag): with --offline no gh process starts, listing or one change, plan stage or delivery.
test('run-status-bar AC-5 offline: --offline makes no gh call, listing and --change, at a plan stage and at the delivery', async (t) => {
  await t.test('the logging gh sees the delivery calls without the flag', () => {
    const d = deliveredChange();
    const r = realState(d.t.main, d.env, ['--change', 'feat']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(d.gh.calls().length > 0, 'the contrast: GitHub is read when the flag is absent');
  });
  const plan = () => { const root = planChange({ have: ['requirements', 'proposal'] }); const gh = fakeGh(); return { cwd: root, env: gh.env, gh }; };
  const delivery = () => { const d = deliveredChange(); return { cwd: d.t.main, env: d.env, gh: d.gh }; };
  for (const [label, make] of [['a plan stage', plan], ['the delivery', delivery]]) {
    for (const [what, extra] of [['--change', ['--change', 'feat', '--offline']], ['the listing', ['--offline']]]) {
      await t.test(`${label}, ${what}`, () => {
        const c = make();
        const r = realState(c.cwd, c.env, extra);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.ok(JSON.parse(r.stdout).changes.length >= 1);
        assert.deepEqual(c.gh.calls(), [], 'no gh call recorded');
      });
    }
  }
});

// Invariant (S-8): offline keeps every stage that needs no GitHub as it was.
test('run-status-bar AC-5 offline: at the plan approval --offline gives the same state, reason, stage and title', () => {
  const root = approvedChange();
  const calls = [];
  const spy = (args) => { calls.push(args); return { status: 0, stdout: '[]', stderr: '' }; };
  const offline = entryOf(stateCmd(root, ['--change', 'feat', '--offline'], cleanEnv, { gh: spy }));
  const online = entryOf(stateCmd(root, ['--change', 'feat'], cleanEnv, { gh: spy }));
  const fields = (e) => [e.state, e.reason, e.stage, e.stageTitle];
  assert.equal(offline.state, 'waiting-for-owner');
  assert.deepEqual(fields(offline), fields(online));
  assert.deepEqual(offline, online, 'the whole entry');
});

// Invariant (S-9): a stage that needs GitHub reads it as silent.
test('run-status-bar AC-5 offline: at the delivery checks --offline reads waiting-on-github, silent', () => {
  const d = deliveredChange();
  const online = entryOf(stateCmd(d.t.main, ['--change', 'feat'], d.env));
  assert.notEqual(online.reason?.code, 'silent', 'the contrast: GitHub answering');
  const offline = entryOf(stateCmd(d.t.main, ['--change', 'feat', '--offline'], d.env));
  assert.deepEqual([offline.state, offline.reason.code], ['waiting-on-github', 'silent']);
});

// Invariant (S-10): --offline is a flag, not an option with a value.
test('run-status-bar AC-5 offline: --offline yes exits 3 with the plain reply and prints no state', () => {
  const r = stateCmd(approvedChange(), ['--change', 'feat', '--offline', 'yes']);
  assert.equal(r.code, 3, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.changes, undefined);
  assert.match(out.reply, /./);
  assert.match(out.error, /\bstate\b/);
});

// Invariant (S-11): the offline stub lives in one place (design D-4).
test('run-status-bar AC-5 offline: roadmap-loop defines no offline stub of its own and imports OFFLINE_GH from merge-setup', () => {
  const roadmap = read('roadmap-loop.mjs');
  const loop = read('change-loop.mjs');
  const setup = read('merge-setup.mjs');
  assert.match(setup, /^export const OFFLINE_GH = /m, 'merge-setup exports it');
  const importedFromSetup = /^import \{[^}]*\bOFFLINE_GH\b[^}]*\} from '\.\/merge-setup\.mjs';/m;
  assert.match(roadmap, importedFromSetup);
  assert.match(loop, importedFromSetup);
  for (const [name, text] of [['roadmap-loop', roadmap], ['change-loop', loop]]) {
    assert.doesNotMatch(text, /^(?:export )?(?:const|function) OFFLINE_GH\b/m, `${name} defines none`);
    assert.doesNotMatch(text, /stderr: 'offline'/, `${name} holds no copy of the stub's body`);
  }
});

// Invariant (S-12): the list is read anew on every call and follows the change (design D-5).
test('run-status-bar AC-1 stages: the list follows the classification line, from 14 stages to 15', () => {
  const root = grillChange();
  const before = stagesOf(root);
  assert.equal(before.includes('mockup'), false);
  assert.equal(before.length, 14);
  withClassification(root, 'ui');
  const after = stagesOf(root);
  assert.equal(after.includes('mockup'), true);
  assert.equal(after.length, 15);
  assert.deepEqual(after, without('unit-tests', 'e2e-tests'));
});
