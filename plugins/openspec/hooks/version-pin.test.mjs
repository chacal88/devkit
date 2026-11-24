// node --test --test-name-pattern="^version-pin" plugins/openspec/hooks/version-pin.test.mjs
// change-version-pin: the flow a change opened with. Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/hooks/version-pin.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as GUARD from './guard.mjs';
import * as CL from './change-loop.mjs';
import * as ROADMAP from './roadmap-loop.mjs';
import * as PL from './project-loop.mjs';
import * as DC from './deliver-check.mjs';
import { tmpFolder } from './test-tmp.mjs';
import { gitRepo, put, commitAll, git, fakeGh, roundRepo } from './test-fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const PLUGIN_SCHEMAS = join(HERE, '..', 'schemas');
const SCRIPT = (name) => join(HERE, name);

// Every process a test spawns, and every in-process reader that takes an env, gets this one: no ambient branch, change or CI variable.
const ENV_SET = { DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const ENV = { ...process.env, ...ENV_SET };

// ---------------------------------------------------------------- helpers (one per mechanism)

// Invariant (T-21, D-13): a change keeps the flow it opened with across an upgrade, and the repository check refuses a flow change that keeps its version.
// Layer: the version-pin fixtures. Suite: version-pin. Each fixture stands for a project installed at release 1 of the pack, as this suite was written:
// `devkit` and `devkit-lite` are at flow version 1, `treeFlow` reads `flows/1.json`, and `flows/2.json` does not exist until a test writes the synthetic
// version 2 of `flowV2()`. The tree ships version 2 of both scripts since devkit-openspec 0.33.0 (the triage); `upfront AC-5 open` and `version-pin AC-7
// check: the tree's flows pass` read the tree as it is.
const RELEASE_1_SCRIPTS = ['devkit', 'devkit-lite'];
const treeFlow = (schema = 'devkit') => JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, schema, 'flows', '1.json'), 'utf8'));
// Puts release 1 into the `schemas` folder at `folder` (a copy of the tree's): flow.json is flows/1.json and there is no flows/2.json.
function installRelease1(folder) {
  for (const script of RELEASE_1_SCRIPTS) {
    copyFileSync(join(folder, script, 'flows', '1.json'), join(folder, script, 'flow.json'));
    rmSync(join(folder, script, 'flows', '2.json'), { force: true });
  }
}

// The version 2 of `devkit` the upgrade tests install: a stage added after design, the readiness removed, a lower review ceiling.
function flowV2() {
  const flow = treeFlow();
  const stages = flow.stages
    .filter((s) => s.id !== 'readiness')
    .map((s) => (s.id === 'approval' ? { ...s, staleAfter: ['tasks'] } : s.id === 'review' ? { ...s, ceiling: 1 } : s));
  const at = stages.findIndex((s) => s.id === 'design');
  stages.splice(at + 1, 0, {
    id: 'threat-model', source: 'artifact', file: 'threat-model.md', role: 'change-planner', skills: [], part: 'plan',
    title: { en: 'Threat model', 'pt-BR': 'Modelo de ameaças' },
  });
  return { ...flow, version: 2, stages };
}

// A re-install of the schemas that ships version 2, as merged into the change's branch.
function upgradeTo2(checkout) {
  const text = JSON.stringify(flowV2(), null, 2);
  const folder = join(checkout, 'openspec', 'schemas', 'devkit');
  mkdirSync(join(folder, 'flows'), { recursive: true });
  writeFileSync(join(folder, 'flow.json'), text);
  writeFileSync(join(folder, 'flows', '2.json'), text);
}

// A newer pack (9.9.9) shipping version 2 of the devkit flow: its setup script, change loop and readout are the "setup re-run" and the "pack update".
// Made once at module level (CONTRIBUTING: a shared fixture is never made lazily inside a test).
function makePackV2() {
  const dir = tmpFolder('devkit-version-pin-pack-');
  cpSync(join(HERE, '..'), dir, { recursive: true });
  const manifest = join(dir, '.claude-plugin', 'plugin.json');
  writeFileSync(manifest, JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), version: '9.9.9' }, null, 2));
  installRelease1(join(dir, 'schemas'));
  const text = JSON.stringify(flowV2(), null, 2);
  mkdirSync(join(dir, 'schemas', 'devkit', 'flows'), { recursive: true });
  writeFileSync(join(dir, 'schemas', 'devkit', 'flow.json'), text);
  writeFileSync(join(dir, 'schemas', 'devkit', 'flows', '2.json'), text);
  return dir;
}
const PACK_V2 = makePackV2();
const packV2 = () => PACK_V2;

// The headed stage files of a change, written into `dir`; `c0` is the commit every header names.
function planFiles(dir, stages, c0) {
  const head = (stage, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
  const tasks = `# Tasks\n\n${[1, 2, 3, 4, 5, 6].map((n) => `- [x] 1.${n} step ${n}`).join('\n')}\n`;
  const files = {
    requirements: ['requirements.md', `${head('requirements')}# Requirements\n`],
    proposal: ['proposal.md', `${head('proposal')}# Proposal\n`],
    specs: ['specs/csv/spec.md', `${head('specs')}# CSV export\n`],
    design: ['design.md', `${head('design')}# Design\n`],
    'threat-model': ['threat-model.md', `${head('threat-model')}# Threat model\n`],
    tasks: ['tasks.md', `${head('tasks')}${tasks}`],
    readiness: ['readiness.md', `${head('readiness')}# Readiness\n\n- Status: APPROVED\n`],
    approval: ['approval.md', `${head('approval')}# Plan approval\n\n- Status: APPROVED\n`],
    evidence: ['evidence.md', `${head('evidence')}# Evidence\n`],
    review: ['review.md', `${head('review', 'failed', 1)}# Review\n`],
  };
  for (const stage of stages) {
    const [file, text] = files[stage];
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
}

// The bytes of a change's .openspec.yaml, compared before and after a command.
const pinOf = (dir) => readFileSync(join(dir, '.openspec.yaml'), 'utf8');

const PLAN_V1 = ['requirements', 'proposal', 'specs', 'design', 'tasks']; // no readiness yet: the next stage of version 1 is the readiness
const FULL_V1 = [...PLAN_V1, 'readiness', 'approval', 'evidence', 'review']; // the code review failed at attempt 1
const PLAN_V2 = ['requirements', 'proposal', 'specs', 'design', 'tasks']; // no threat-model yet: the next stage of version 2 is the threat model
const FULL_V2 = ['requirements', 'proposal', 'specs', 'design', 'threat-model', 'tasks', 'approval', 'evidence', 'review'];

// The .openspec.yaml of a change as the open writes it (D-1); `pin` null writes none.
const yamlOf = (schema, pin) => `schema: ${schema}\ncreated: 2026-11-22\n${pin === null ? '' : `x-devkit-version: 0.23.0\nx-devkit-flow: ${pin}\n`}`;

// A committed project holding change(s) `feat` (pinned as `pin`) and the extra `others` ({ id: pin }); `to2` installs version 2 after the change files.
function scratch({ pin = null, to2 = false, stages = PLAN_V1, schema = 'devkit', others = {}, config = `schema: ${schema}\n`, ship = false } = {}) {
  const root = gitRepo({ config, files: { 'src/a.js': 'a\n' }, commit: false });
  installRelease1(join(root, 'openspec', 'schemas'));
  const c0 = commitAll(root, 'initial');
  for (const [id, p] of Object.entries({ feat: pin, ...others })) {
    const dir = join(root, 'openspec', 'changes', id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.openspec.yaml'), yamlOf(schema, p));
    planFiles(dir, stages, c0);
  }
  if (to2) upgradeTo2(root);
  commitAll(root, 'change files');
  if (ship) git(root, 'switch', '-q', '-c', 'ship/feat');
  return root;
}

// Scratch projects that tests only read are built once, at module level: the temporary-folder helper removes a folder when the
// test that made it ends, so a fixture shared by several tests is never made lazily inside the first one (CONTRIBUTING).
const SHARED = [
  { pin: 1, to2: true, stages: PLAN_V1 },
  { pin: 1, to2: true, stages: FULL_V1 },
  { pin: 1, to2: true, stages: PLAN_V1, ship: true },
  { pin: 2, to2: true, stages: PLAN_V2 },
  { pin: 2, to2: true, stages: FULL_V2 },
  { pin: 2, to2: true, stages: PLAN_V2, ship: true },
  { pin: null, stages: FULL_V1 },
  { pin: null, to2: true, stages: PLAN_V1 },
  { pin: null, stages: PLAN_V1 },
  { pin: null, stages: PLAN_V1, ship: true },
];
const built = new Map(SHARED.map((opts) => [JSON.stringify(opts), scratch(opts)]));
const shared = (opts) => {
  const key = JSON.stringify(opts);
  if (!built.has(key)) throw new Error(`version-pin: the shared scratch project ${key} is not in SHARED`);
  return built.get(key);
};

// A copy of `root` with `edit(copy)` applied, for a test that changes a file.
function variant(root, edit) {
  const copy = tmpFolder('devkit-version-pin-');
  cpSync(root, copy, { recursive: true });
  edit(copy);
  return copy;
}
const withYaml = (root, text) => variant(root, (c) => writeFileSync(join(c, 'openspec', 'changes', 'feat', '.openspec.yaml'), text));
const changeDirOf = (root, id = 'feat') => join(root, 'openspec', 'changes', id);

const spawn = (script, cwd, args, input) => spawnSync(process.execPath, [SCRIPT(script), ...args], { cwd, env: ENV, encoding: 'utf8', ...(input === undefined ? {} : { input }) });
const readout = (root, ...args) => spawn('flow-check.mjs', root, ['feat', ...args]);
const readoutJson = (root, lang = 'en') => {
  const r = readout(root, '--lang', lang, '--json');
  return { code: r.status, json: JSON.parse(r.stdout), r };
};
const stageIds = (json) => json.stages.map((s) => s.id);

// A main-session write of product code (no agent), as the code gate sees it.
const writeCode = (root) => spawn('guard.mjs', root, ['edit'], JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src', 'a.js') } }));
const ciCheck = (root) => spawn('deliver-check.mjs', root, ['--ci']);
const failedOf = (out) => (/^fail: (.*)$/m.exec(out)?.[1] ?? '').split(', ').filter(Boolean);

const CODE_CLOSED = /no approved readiness|Product code stays closed/;

// ================================================================ AC-2: a change opened on version 1 keeps it after the upgrade

test('version-pin AC-2 readout: a version-1 change after the upgrade is asked the removed stage, not the added one', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 0, r.stdout + r.stderr);
  assert.ok(stageIds(json).includes('readiness'), 'readiness is listed');
  assert.ok(!stageIds(json).includes('threat-model'), 'the added stage is not');
  assert.equal(json.next.stage, 'readiness');
});

test('version-pin AC-2 readout: the version-1 ceiling holds after the upgrade', () => {
  const root = shared({ pin: 1, to2: true, stages: FULL_V1 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 0, r.stdout + r.stderr);
  assert.equal(json.next.stage, 'implementation');
  assert.equal(json.next.reasonCode, 'fix-after-failure');
  assert.equal(json.next.params.ceiling, 2);
  assert.match(readout(root, '--lang', 'en').stdout, /failed at attempt 1; failures in a row: 1 of 2/);
});

test('version-pin AC-2 loop: next hands the readiness to its reviewer after the upgrade', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const r = spawn('change-loop.mjs', root, ['next', '--change', 'feat', '--lang', 'en']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const action = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  assert.equal(action.agent, 'devkit-core:plan-readiness-reviewer');
  assert.equal(action.stage, 'readiness');
});

test('version-pin AC-2 guard: a version-1 change keeps the code closed after the upgrade', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const r = writeCode(root);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, CODE_CLOSED);
});

test('version-pin AC-2 ci: a version-1 change is asked its readiness after the upgrade', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1, ship: true });
  const r = ciCheck(root);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^\s*readiness\s+open/m);
  assert.ok(failedOf(r.stdout).includes('readiness'), r.stdout);
});

test('version-pin AC-2 locks: a version-1 change may hand the readiness to its reviewer', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const input = { cwd: root, tool_name: 'Agent', tool_input: { subagent_type: 'devkit-core:plan-readiness-reviewer', prompt: 'review' } };
  assert.equal(CL.handOffFor(input, 'feat').decision, 'allow');
});

test('version-pin AC-2 locks: a version-1 readiness reviewer delivers before it stops', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const input = { cwd: root, agent_type: 'devkit-core:plan-readiness-reviewer', agent_id: 'agent-pin-1', session_id: `pin-${process.pid}-${Date.now()}-a` };
  // The refusal is recorded under the temporary root of this process, which `env` does not move: point it at a folder the helper removes.
  const stopRoot = tmpFolder('devkit-version-pin-stop-');
  const before = process.env.TMPDIR;
  process.env.TMPDIR = stopRoot;
  let d;
  try {
    d = CL.subagentStopFor(input, 'feat', { env: ENV });
  } finally {
    if (before === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = before;
  }
  assert.equal(d.decision, 'refuse');
  assert.equal(d.why, 'no-file');
  assert.match(d.reason, /readiness\.md/);
  assert.deepEqual(readdirSync(join(stopRoot, 'devkit-stop')), [`${input.session_id}-${input.agent_id}.json`], 'the refusal is recorded in the folder of this test');
});

test('version-pin AC-2 where: a version-1 change after the upgrade stops at its readiness', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const said = CL.whereOf({ root, branch: 'main' }, 'feat', { lang: 'en', env: ENV });
  assert.match(said, /plan readiness/i, said);
  assert.doesNotMatch(said, /threat model/i, said);
});

test('version-pin AC-2 roadmap: a version-1 change after the upgrade titles its readiness in flight', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const readiness = treeFlow().stages.find((s) => s.id === 'readiness');
  assert.equal(ROADMAP.stageTitleOf({ root, id: 'feat' }, 'readiness', 'en'), 'Plan readiness');
  assert.equal(ROADMAP.stageTitleOf({ root, id: 'feat' }, 'readiness', 'pt-BR'), readiness.title['pt-BR']);
});

// The conductor's scratch: change `a` on `devkit` in a worktree, version 2 installed on origin/main when `to2`.
const ROUNDS = '# Roadmap\n\n## Round 1: x\n- [ ] a\n';
const PLAN_PROPOSAL = '# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n';
// The files the installed schema.yaml names besides the plan's: the conductor asks for them when a pin it cannot read sends it back to that list.
const SCHEMA_LIST_FILES = ['mockup.md', 'decisions.md', 'approval.md', 'unit-tests.md', 'e2e-tests.md', 'evidence.md', 'review.md', 'retro.md'];
function conductor({ pin, to2 = true, files = ['requirements.md', 'proposal.md', 'design.md', 'tasks.md'] }) {
  const v2 = JSON.stringify(flowV2(), null, 2);
  const t = roundRepo({
    roadmap: ROUNDS,
    config: 'schema: devkit\nship:\n  devkit: pr\n',
    files: to2 ? { 'openspec/schemas/devkit/flow.json': v2, 'openspec/schemas/devkit/flows/2.json': v2 } : {},
  });
  const a = t.addWt('a');
  const body = { 'requirements.md': '# Requirements\n', 'proposal.md': PLAN_PROPOSAL, 'design.md': '# Design\n', 'tasks.md': '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n', 'threat-model.md': '# Threat model\n' };
  put(a, { 'openspec/changes/a/.openspec.yaml': yamlOf('devkit', pin), ...Object.fromEntries([...files, ...SCHEMA_LIST_FILES].map((f) => [`openspec/changes/a/${f}`, body[f] ?? `# ${f}\n`])) });
  const next = () => t.state().changes.find((c) => c.id === 'a').next;
  return { t, a, next };
}

test('version-pin AC-2 conductor: a version-1 change after the upgrade is asked its readiness, not the added plan file', () => {
  const { next } = conductor({ pin: 1 });
  const n = next();
  assert.equal(n.step, 'readiness', JSON.stringify(n));
});

// ================================================================ AC-3: a change opened after the upgrade follows version 2

test('version-pin AC-3 readout: a version-2 change is asked the added stage, not the removed one', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 0, r.stdout + r.stderr);
  assert.equal(json.next.stage, 'threat-model');
  assert.ok(stageIds(json).includes('threat-model'));
  assert.ok(!stageIds(json).includes('readiness'));
});

test('version-pin AC-3 readout: the version-2 ceiling blocks', () => {
  const root = shared({ pin: 2, to2: true, stages: FULL_V2 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 2, r.stdout + r.stderr);
  assert.equal(json.end.state, 'blocked');
  assert.equal(json.end.reasonCode, 'ceiling-reached');
  assert.equal(json.end.params.ceiling, 1);
});

test('version-pin AC-3 guard: a version-2 change does not ask readiness', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2 });
  const r = writeCode(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('version-pin AC-3 ci: a version-2 change prints no readiness line', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2, ship: true });
  const r = ciCheck(root);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /^\s*readiness\b/m);
  assert.ok(!failedOf(r.stdout).includes('readiness'), r.stdout);
  assert.ok(failedOf(r.stdout).length > 0, 'the other items still fail the check');
});

test('version-pin AC-3 locks: a version-2 change refuses the removed stage\'s reviewer', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2 });
  const input = { cwd: root, tool_name: 'Agent', tool_input: { subagent_type: 'devkit-core:plan-readiness-reviewer', prompt: 'review' } };
  const d = CL.handOffFor(input, 'feat');
  assert.equal(d.decision, 'refuse');
  assert.equal(d.why, 'not-a-role');
});

test('version-pin AC-3 conductor: a version-2 change is asked the added plan file', () => {
  const { next } = conductor({ pin: 2 });
  const n = next();
  assert.equal(n.step, 'plan', JSON.stringify(n));
  assert.ok(n.missing.includes('threat-model.md'), JSON.stringify(n.missing));
});

test('version-pin AC-3 conductor: a version-2 change is not asked readiness', () => {
  const { next } = conductor({ pin: 2, files: ['requirements.md', 'proposal.md', 'design.md', 'threat-model.md', 'tasks.md'] });
  const n = next();
  assert.notEqual(n.step, 'plan', `every plan file of version 2 is there: ${JSON.stringify(n)}`);
  assert.notEqual(n.step, 'readiness', JSON.stringify(n));
  assert.notEqual(n.step, 'approve', JSON.stringify(n));
});

// A devkit project on ship/feat whose gh answers "no pull request"; `feat` is pinned to 2 and `old` to 1, both after the upgrade.
function deliverScratch() {
  const root = scratch({ pin: 2, to2: true, stages: PLAN_V2, others: { old: 1 }, config: 'schema: devkit\nship:\n  devkit: pr\n', ship: true });
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  gh.set('pr-list', { stdout: [] });
  return { root, env: { ...gh.env, ...ENV_SET } };
}

test('version-pin AC-3 deliver: a version-2 change\'s state does not need readiness', () => {
  const { root, env } = deliverScratch();
  const two = DC.collectState(root, 'feat', { env });
  assert.equal(two.needsReadiness, false);
  assert.equal(two.readiness, null);
  assert.equal(two.approval, null);
  const one = DC.collectState(root, 'old', { env });
  assert.equal(one.needsReadiness, true);
});

// ================================================================ AC-4: a change with no pin follows version 1; a recorded flow that cannot be read stops

test('version-pin AC-4 readout: an unpinned change on version 1 reads as before', () => {
  const root = shared({ pin: null, stages: FULL_V1 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 0, r.stdout + r.stderr);
  assert.deepEqual(json.flow, { version: 1, installed: 1, pinned: false });
  assert.deepEqual(Object.keys(json).slice(-2), ['previous', 'flow']);
  assert.doesNotMatch(readout(root, '--lang', 'en').stdout, /^(Flow|Fluxo):/m);
  assert.doesNotMatch(readout(root, '--lang', 'pt-BR').stdout, /^(Flow|Fluxo):/m);
});

test('version-pin AC-4 readout: an unpinned change after the upgrade follows version 1', () => {
  const root = shared({ pin: null, to2: true, stages: PLAN_V1 });
  const { code, json, r } = readoutJson(root);
  assert.equal(code, 0, r.stdout + r.stderr);
  assert.equal(json.next.stage, 'readiness');
  assert.ok(!stageIds(json).includes('threat-model'));
  assert.deepEqual(json.flow, { version: 1, installed: 2, pinned: false });
});

test('version-pin AC-4 changeDeclares: equals the schema\'s readiness for unpinned changes', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const stub = (name, ids) => put(root, { [`openspec/schemas/${name}/schema.yaml`]: `name: ${name}\nversion: 1\nartifacts:\n${ids.map((i) => `  - id: ${i}\n    generates: ${i}.md\n`).join('')}` });
  stub('with-readiness', ['proposal', 'readiness']);
  stub('without-readiness', ['proposal']);
  const declares = (schema) => {
    const dir = changeDirOf(root, schema);
    put(root, { [`openspec/changes/${schema}/.openspec.yaml`]: `schema: ${schema}\n` });
    const got = GUARD.changeDeclares(root, dir, 'readiness');
    assert.equal(got, GUARD.schemaHasArtifact(root, schema, 'readiness'), `${schema}: the same answer as the installed schema.yaml`);
    return got;
  };
  assert.equal(declares('devkit'), true);
  assert.equal(declares('devkit-lite'), false);
  assert.equal(declares('devkit-project'), false);
  assert.equal(declares('with-readiness'), true, 'a schema with no flow.json');
  assert.equal(declares('without-readiness'), false, 'a schema with no flow.json');
});

test('version-pin AC-4 readPin: the parse rules of D-1', () => {
  const dir = join(tmpFolder('devkit-version-pin-pin-'), 'feat');
  mkdirSync(dir, { recursive: true });
  const read = (text) => { writeFileSync(join(dir, '.openspec.yaml'), text); return GUARD.readPin(dir); };
  assert.deepEqual(GUARD.readPin(join(dir, 'missing')), { flow: null, devkit: null }, 'a missing file');
  assert.deepEqual(read(''), { flow: null, devkit: null }, 'an empty file');
  assert.deepEqual(read('schema: devkit\ncreated: 2026-11-22\n'), { flow: null, devkit: null }, 'no pin');
  assert.deepEqual(read('schema: devkit\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n'), { flow: 2, devkit: '0.23.0' });
  assert.deepEqual(read('x-devkit-flow: "2"\n'), { flow: 2, devkit: null }, 'double quotes');
  assert.deepEqual(read("x-devkit-flow: '2'\n"), { flow: 2, devkit: null }, 'single quotes');
  assert.deepEqual(read('x-devkit-flow: 3 # moved by hand\n'), { flow: 3, devkit: null }, 'a trailing comment');
  assert.deepEqual(read('schema: devkit\r\nx-devkit-version: 0.23.0\r\nx-devkit-flow: 2\r\n'), { flow: 2, devkit: '0.23.0' }, 'CRLF');
  assert.deepEqual(read('x-devkit-flow: 2'), { flow: 2, devkit: null }, 'no final newline');
  assert.deepEqual(read('x-devkit-flow: 2\nx-devkit-flow: 5\n'), { flow: 2, devkit: null }, 'the first of two lines');
  assert.deepEqual(read('x-devkit-version:\nx-devkit-flow: 1\n'), { flow: 1, devkit: null }, 'an empty version is null, never an error');
  for (const bad of ['', '0', 'abc', '1.5', '-1']) {
    assert.throws(() => read(`schema: devkit\nx-devkit-flow: ${bad}\n`), (e) => e instanceof GUARD.FlowUsageError
      && e.message === `feat's .openspec.yaml has x-devkit-flow "${bad}", not a flow version (a whole number from 1)`, `refused: "${bad}"`);
  }
});

test('version-pin AC-4 readFlowFile: a version is a whole number from 1', () => {
  const dir = tmpFolder('devkit-version-pin-flow-');
  const write = (version) => { const f = join(dir, 'flow.json'); writeFileSync(f, JSON.stringify({ ...treeFlow(), version })); return f; };
  assert.equal(GUARD.readFlowFile(write(1), 'x').version, 1);
  assert.equal(GUARD.readFlowFile(write(2), 'x').version, 2);
  for (const bad of [0, 1.5, '1', -1]) {
    assert.throws(() => GUARD.readFlowFile(write(bad), 'x'), (e) => e instanceof GUARD.FlowUsageError && /is not a whole number from 1/.test(e.message), `refused: ${JSON.stringify(bad)}`);
  }
});

// Invariant (jira-entry-followups D-3, AC-5 and AC-6, readFlowFile in guard.mjs): a flow file newer than the reader knows for its script is refused
// with the update to make before any other check, never as "malformed"; a file at a known version keeps every check it had. Layer: the flow reader.
// Suite: version-pin. The fixtures are the shipped devkit flow (version FLOW_VERSIONS.devkit) with a stage key this reader does not know.
const SHIPPED_DEVKIT = () => JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, 'devkit', 'flow.json'), 'utf8'));
const withColour = (flow) => ({ ...flow, stages: flow.stages.map((s) => (s.id === 'mockup' ? { ...s, colour: 'red' } : s)) });
const flowFile = (flow) => { const f = join(tmpFolder('devkit-followups-flow-'), 'flow.json'); writeFileSync(f, JSON.stringify(flow)); return f; };
const newerText = (v, newest, tail) => `flow.json of devkit is version ${v} of the devkit flow, and this devkit-openspec reads that flow up to version ${newest}: ${tail}; update the plugin and restart the session`;
const refusedWith = (message) => (e) => e instanceof GUARD.FlowUsageError && e.message === message;

test('jira-entry-followups AC-5 readFlowFile refuses a newer flow with the update to make', () => {
  const newest = GUARD.FLOW_VERSIONS.devkit;
  const f = flowFile(withColour({ ...SHIPPED_DEVKIT(), version: newest + 1 }));
  assert.throws(() => GUARD.readFlowFile(f, 'devkit'), refusedWith(newerText(newest + 1, newest, 'it needs a later devkit-openspec')));
  try { GUARD.readFlowFile(f, 'devkit'); } catch (e) { assert.doesNotMatch(e.message, /malformed|unknown key/); }
});

test('jira-entry-followups AC-5 a newer flow that names its release gets it in the message', () => {
  const newest = GUARD.FLOW_VERSIONS.devkit;
  const f = flowFile(withColour({ ...SHIPPED_DEVKIT(), version: newest + 1, readerRelease: '9.1.0' }));
  assert.throws(() => GUARD.readFlowFile(f, 'devkit'), refusedWith(newerText(newest + 1, newest, 'it needs devkit-openspec 9.1.0 or later')));
});

test('jira-entry-followups AC-5 a newer flow with a release field that is not a release number gets the text with no release', () => {
  const newest = GUARD.FLOW_VERSIONS.devkit;
  for (const readerRelease of ['soon', 9, '1.2', '1.2.3.4', null]) {
    const f = flowFile({ ...SHIPPED_DEVKIT(), version: newest + 1, readerRelease });
    assert.throws(() => GUARD.readFlowFile(f, 'devkit'), refusedWith(newerText(newest + 1, newest, 'it needs a later devkit-openspec')), JSON.stringify(readerRelease));
  }
});

test('jira-entry-followups AC-5 a script outside FLOW_VERSIONS has no ceiling', () => {
  const f = flowFile({ ...SHIPPED_DEVKIT(), script: 'mine', version: 99 });
  assert.equal(GUARD.readFlowFile(f, 'mine').version, 99);
});

test('jira-entry-followups AC-5 a release number that cannot be read at a known version is malformed', () => {
  for (const readerRelease of ['soon', '1.2']) {
    const f = flowFile({ ...SHIPPED_DEVKIT(), readerRelease });
    assert.throws(() => GUARD.readFlowFile(f, 'devkit'),
      refusedWith(`flow.json of devkit is malformed: readerRelease ${JSON.stringify(readerRelease)} is not a release number such as 1.2.3`), readerRelease);
  }
});

test('jira-entry-followups AC-5 a release number at a known version is accepted', () => {
  const f = flowFile({ ...SHIPPED_DEVKIT(), readerRelease: '1.2.3' });
  assert.equal(GUARD.readFlowFile(f, 'devkit').version, GUARD.FLOW_VERSIONS.devkit);
});

test('jira-entry-followups AC-6 an unknown stage key at a known version is still malformed', () => {
  const f = flowFile(withColour(SHIPPED_DEVKIT()));
  assert.throws(() => GUARD.readFlowFile(f, 'devkit'), refusedWith('flow.json of devkit is malformed: stage mockup has an unknown key colour'));
});

test('jira-entry-followups AC-5 FLOW_VERSIONS equals the version of each shipped flow.json', () => {
  assert.deepEqual(Object.keys(GUARD.FLOW_VERSIONS).sort(), ['devkit', 'devkit-lite', 'devkit-project']);
  for (const copy of [join(PLUGIN_SCHEMAS), join(REPO, 'openspec', 'schemas')]) {
    for (const script of Object.keys(GUARD.FLOW_VERSIONS)) {
      const shipped = JSON.parse(readFileSync(join(copy, script, 'flow.json'), 'utf8'));
      assert.equal(shipped.version, GUARD.FLOW_VERSIONS[script], `${script} in ${copy}`);
    }
  }
});

test('jira-entry-followups AC-5 the shipped flow.json files stay byte-identical to flows/2.json', () => {
  for (const copy of [join(PLUGIN_SCHEMAS), join(REPO, 'openspec', 'schemas')]) {
    for (const script of ['devkit', 'devkit-lite']) {
      const shipped = readFileSync(join(copy, script, 'flow.json'));
      assert.equal(JSON.parse(shipped).version, 2, `${script} in ${copy}`);
      assert.equal(JSON.parse(shipped).readerRelease, undefined, `${script} in ${copy} names no release`);
      assert.ok(shipped.equals(readFileSync(join(copy, script, 'flows', '2.json'))), `${script} in ${copy} equals flows/2.json`);
    }
  }
});

test('version-pin AC-4 readout: a recorded flow that is not installed stops the checker', () => {
  const root = withYaml(shared({ pin: null, stages: PLAN_V1 }), yamlOf('devkit', 7));
  const r = readout(root, '--lang', 'en');
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /flow 7/);
  assert.match(r.stdout + r.stderr, /flows\/7\.json/);
  const j = readoutJson(root);
  assert.equal(j.code, 3);
  assert.match(j.json.error, /flows\/7\.json/);
});

test('version-pin AC-4 readout: a malformed recorded flow stops the checker', () => {
  for (const bad of ['abc', '0']) {
    const root = withYaml(shared({ pin: null, stages: PLAN_V1 }), yamlOf('devkit', bad));
    const r = readout(root, '--lang', 'en');
    assert.equal(r.status, 3, `${bad}: ${r.stdout}${r.stderr}`);
    assert.ok((r.stdout + r.stderr).includes(`"${bad}"`), `${bad}: ${r.stdout}${r.stderr}`);
  }
});

test('version-pin AC-4 readout: a kept file that declares another version stops the checker', () => {
  const root = variant(shared({ pin: 1, to2: true, stages: PLAN_V1 }), (c) => writeFileSync(join(c, 'openspec', 'schemas', 'devkit', 'flows', '1.json'), JSON.stringify(flowV2(), null, 2)));
  const r = readout(root, '--lang', 'en');
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /flows\/1\.json declares version 2, not 1/);
});

test('version-pin AC-4 guard: an unreadable recorded flow falls back to the installed schema', () => {
  for (const pin of [7, 'abc']) {
    const root = withYaml(shared({ pin: null, stages: PLAN_V1 }), yamlOf('devkit', pin));
    const r = writeCode(root);
    assert.equal(r.status, 2, `${pin}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, CODE_CLOSED);
  }
});

test('version-pin AC-4 ci: a recorded flow that is not installed fails the check', () => {
  const root = withYaml(shared({ pin: null, stages: PLAN_V1, ship: true }), yamlOf('devkit', 7));
  const r = ciCheck(root);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /^deliver-check: .*flow 7/m);
  assert.match(r.stderr, /flows\/7\.json/);
});

test('version-pin AC-4 conductor: an unreadable recorded flow falls back to the installed schema', () => {
  for (const pin of [7, 'abc']) {
    const { next } = conductor({ pin, to2: false });
    const n = next();
    assert.equal(n.step, 'readiness', `${pin}: ${JSON.stringify(n)}`);
  }
});

test('version-pin AC-4 roadmap: a recorded flow that is not installed stops the previous-script test', () => {
  const root = withYaml(shared({ pin: null, stages: PLAN_V1 }), yamlOf('devkit', 7));
  assert.throws(() => ROADMAP.isPreviousScript(root, 'feat', ENV), (e) => e instanceof GUARD.FlowUsageError && /flows\/7\.json/.test(e.message));
});

// A project slice of the devkit-project script, pinned to `pin` in the checkout's main folder.
const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline' });
function sliceScratch(pin) {
  return gitRepo({
    config: 'schema: devkit\nship:\n  devkit-project: merge\n',
    changes: { billing: { '.openspec.yaml': yamlOf('devkit-project', pin) } },
  });
}
const loop = (root, argv) => PL.main([...argv, '--lang', 'en'], { cwd: root, env: ENV, gh: OFFLINE });

test('version-pin AC-4 project: next of a slice whose recorded flow is not installed stops', () => {
  const root = sliceScratch(7);
  const r = loop(root, ['next', '--slice', 'billing']);
  assert.equal(r.code, 3, r.stdout + r.stderr);
  const error = JSON.parse(r.stdout).error;
  assert.match(error, /flow 7/);
  assert.match(error, /flows\/7\.json/);
});

test('version-pin AC-4 project: archive of a slice whose recorded flow is not installed stops', () => {
  const root = sliceScratch(7);
  const r = loop(root, ['archive', 'billing']);
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.match(JSON.parse(r.stdout).error, /flows\/7\.json/);
  assert.ok(existsSync(changeDirOf(root, 'billing')), 'the slice stays where it was');
  assert.deepEqual(readdirSync(join(root, 'openspec', 'changes', 'archive')), [], 'nothing archived');
});

// ================================================================ AC-5: the readout names a newer installed flow

const NEWER = {
  en: 'Flow: this change follows version 1 of the devkit script; version 2 is installed. To move it: change-loop.mjs flow feat.',
  'pt-BR': 'Fluxo: esta change segue a versão 1 do roteiro devkit; a versão 2 está instalada. Para mudá-la: change-loop.mjs flow feat.',
};

test('version-pin AC-5 readout: a newer installed flow adds one line in en and pt-BR', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  for (const lang of ['en', 'pt-BR']) {
    const lines = readout(root, '--lang', lang).stdout.split('\n');
    assert.match(lines[0], /^Change feat /, lang);
    assert.equal(lines[1], NEWER[lang], lang);
    assert.equal(lines[2], '', `${lang}: the blank line follows`);
  }
  assert.deepEqual(readoutJson(root).json.flow, { version: 1, installed: 2, pinned: true });
});

test('version-pin AC-5 readout: an equal installed flow adds no line', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2 });
  for (const lang of ['en', 'pt-BR']) assert.doesNotMatch(readout(root, '--lang', lang).stdout, /^(Flow|Fluxo):/m, lang);
  assert.deepEqual(readoutJson(root).json.flow, { version: 2, installed: 2, pinned: true });
});

// ================================================================ AC-1 and AC-3: the open records the pin

const PACK_VERSION = JSON.parse(readFileSync(join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const SKILL = readFileSync(join(HERE, '..', 'skills', 'devkit', 'SKILL.md'), 'utf8');
const PROJECT_CONFIG = 'schema: devkit\nship:\n  devkit-project: merge\n';

// A project with a bare origin; `files` are committed on origin/main (an upgrade, a removed flow, a broken one).
// It is installed at release 1 (T-21): `files` still win, so a test that installs version 2 on origin gets it.
const openProject = ({ files = {}, config = 'schema: devkit\n' } = {}) => {
  const release1 = Object.fromEntries(RELEASE_1_SCRIPTS.map((script) => [`openspec/schemas/${script}/flow.json`, readFileSync(join(PLUGIN_SCHEMAS, script, 'flows', '1.json'), 'utf8')]));
  const t = roundRepo({ roadmap: '# Roadmap\n', config, files: { ...release1, ...files } });
  for (const script of RELEASE_1_SCRIPTS) {
    if (!(`openspec/schemas/${script}/flows/2.json` in files)) rmSync(join(t.main, 'openspec', 'schemas', script, 'flows', '2.json'), { force: true });
  }
  commitAll(t.main, 'release 1 of the pack');
  git(t.main, 'push', '-q', 'origin', 'main');
  return t;
};
const openChange = (t, id, script = 'devkit') => CL.main(['open', id, '--script', script, '--why', 'doubt', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: 'Add a CSV export\n' });
const openedDir = (t, r, id) => {
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return join(JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).worktree, 'openspec', 'changes', id);
};
const removeOnOrigin = (t, file, content = null) => {
  if (content === null) rmSync(join(t.main, file)); else writeFileSync(join(t.main, file), content);
  commitAll(t.main, 'edit a flow');
  git(t.main, 'push', '-q', 'origin', 'main');
};

test('version-pin AC-1 open: a devkit and a devkit-lite change record the pack and flow versions', () => {
  const t = openProject();
  for (const [id, script] of [['full-one', 'devkit'], ['lite-one', 'devkit-lite']]) {
    const dir = openedDir(t, openChange(t, id, script), id);
    const text = pinOf(dir);
    assert.match(text, new RegExp(`^schema: ${script}\\n`), `${script}: the schema line is kept first`);
    assert.match(text, /^created: \d{4}-\d{2}-\d{2}$/m, `${script}: the created line is kept`);
    assert.ok(text.endsWith(`x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 1\n`), `${script}: ${JSON.stringify(text)}`);
    const status = spawnSync('openspec', ['status', '--change', id], { cwd: dirname(dirname(dirname(dir))), env: ENV, encoding: 'utf8' });
    assert.doesNotMatch(status.stdout + status.stderr, /Unrecognized key/, `${script}: ${status.stdout}${status.stderr}`);
  }
});

// Invariant (AC-5, D-17): the tree ships flow version 2 of devkit and devkit-lite, so a change of either opened on the tree's own schemas records
// x-devkit-flow 2 (and gets the triage), while a project slice, whose script did not change, records 1. Layer: the open, over a project with the
// tree's schemas as they are (not the release-1 fixtures of `openProject`). Suite: version-pin.
test('upfront AC-5 open: a devkit and a devkit-lite change opened on the tree\'s schemas record x-devkit-flow 2, and a project slice 1', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  for (const [id, script] of [['full-one', 'devkit'], ['lite-one', 'devkit-lite']]) {
    const dir = openedDir(t, openChange(t, id, script), id);
    assert.ok(pinOf(dir).endsWith(`x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 2\n`), `${script}: ${JSON.stringify(pinOf(dir))}`);
  }
  const slices = roundRepo({ roadmap: '# Roadmap\n', config: PROJECT_CONFIG });
  const r = PL.main(['open', 'billing', '--lang', 'en'], { cwd: slices.main, env: ENV, gh: OFFLINE });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const slice = join(JSON.parse(r.stdout).worktree, 'openspec', 'changes', 'billing');
  assert.ok(pinOf(slice).endsWith(`x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 1\n`), pinOf(slice));
});

test('version-pin AC-1 open: a project slice records the devkit-project flow', () => {
  const t = openProject({ config: PROJECT_CONFIG });
  const r = PL.main(['open', 'billing', '--lang', 'en'], { cwd: t.main, env: ENV, gh: OFFLINE });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const dir = join(JSON.parse(r.stdout).worktree, 'openspec', 'changes', 'billing');
  assert.ok(pinOf(dir).endsWith(`x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 1\n`), pinOf(dir));
  assert.match(pinOf(dir), /^schema: devkit-project\n/);
});

test('version-pin AC-1 open: a script with no installed flow.json gets no flow line', () => {
  const t = openProject();
  removeOnOrigin(t, 'openspec/schemas/devkit-lite/flow.json');
  const dir = openedDir(t, openChange(t, 'lite-one', 'devkit-lite'), 'lite-one');
  const text = pinOf(dir);
  assert.ok(text.endsWith(`x-devkit-version: ${PACK_VERSION}\n`), text);
  assert.doesNotMatch(text, /x-devkit-flow/);
});

test('version-pin AC-1 open: a malformed installed flow.json opens nothing', () => {
  const t = openProject();
  removeOnOrigin(t, 'openspec/schemas/devkit/flow.json', '{ not json');
  const r = openChange(t, 'full-one');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.ok(!existsSync(t.wtPath('full-one')), 'no worktree');
  assert.equal(git(t.main, 'branch', '--list', 'full-one'), '', 'no branch');
  assert.doesNotMatch(git(t.main, 'worktree', 'list', '--porcelain'), /full-one/);
  assert.ok(!existsSync(join(t.main, 'openspec', 'changes', 'full-one')), 'no folder in the main checkout');
});

test('version-pin AC-1 packVersion: a plugin.json with a version, and none', () => {
  const pack = tmpFolder('devkit-version-pin-pack-version-');
  const manifest = join(pack, '.claude-plugin', 'plugin.json');
  assert.equal(CL.packVersion(pack), null, 'no file');
  mkdirSync(join(pack, '.claude-plugin'));
  writeFileSync(manifest, '{ not json');
  assert.equal(CL.packVersion(pack), null, 'not JSON');
  writeFileSync(manifest, JSON.stringify({ name: 'x' }));
  assert.equal(CL.packVersion(pack), null, 'no version');
  writeFileSync(manifest, JSON.stringify({ version: 3 }));
  assert.equal(CL.packVersion(pack), null, 'a version that is not a string');
  writeFileSync(manifest, JSON.stringify({ version: '1.2.3' }));
  assert.equal(CL.packVersion(pack), '1.2.3');
  assert.equal(CL.packVersion(), PACK_VERSION, 'the default is this pack');
});

// Invariant: the change's `.openspec.yaml` holds the pin (top-level x- keys) and the owner's `devkit:` block (change-budget:
// `budget:`); the writer of one never disturbs the reader of the other. Layer: the pin writer and reader; suite: version-pin.
test('version-pin AC-1 writePin: the change budget block and the pin live in one .openspec.yaml', () => {
  const dir = tmpFolder('devkit-version-pin-budget-');
  const file = join(dir, '.openspec.yaml');
  const block = 'devkit:\n  budget: 3000000\n';
  writeFileSync(file, `schema: devkit\ncreated: 2026-11-22\n${block}`);
  CL.writePin(dir, { devkit: '0.29.0', flow: 1 });
  assert.equal(pinOf(dir), `schema: devkit\ncreated: 2026-11-22\n${block}x-devkit-version: 0.29.0\nx-devkit-flow: 1\n`, 'the pin is appended after the block, which stays byte for byte');
  assert.deepEqual(GUARD.readPin(dir), { flow: 1, devkit: '0.29.0' }, 'the pin reads back');
  assert.deepEqual(CL.budgetOf(dir, dir, 'en'), { cap: 3000000, from: 'change', file }, 'the budget still reads');
  writeFileSync(file, `schema: devkit\nx-devkit-flow: 1\n${block}`);
  CL.writePin(dir, { devkit: '0.29.0', flow: 2 });
  assert.equal(pinOf(dir), `schema: devkit\nx-devkit-flow: 2\n${block}x-devkit-version: 0.29.0\n`, 'a moved pin keeps the block after it');
  assert.deepEqual(CL.budgetOf(dir, dir, 'en'), { cap: 3000000, from: 'change', file }, 'the budget still reads after a move');
});

test('version-pin AC-1 writePin: append, replace, drop, collapse, keep', () => {
  const dir = tmpFolder('devkit-version-pin-write-');
  const write = (before, pin) => { writeFileSync(join(dir, '.openspec.yaml'), before); CL.writePin(dir, pin); return pinOf(dir); };
  const both = { devkit: '0.23.0', flow: 2 };
  assert.equal(write('schema: devkit', both), 'schema: devkit\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n', 'append to a text with no final newline');
  assert.equal(write('schema: devkit\n', both), 'schema: devkit\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n', 'append, in the order version then flow');
  assert.equal(write('schema: devkit\nx-devkit-flow: 1\ncreated: 2026-11-22\n', both), 'schema: devkit\nx-devkit-flow: 2\ncreated: 2026-11-22\nx-devkit-version: 0.23.0\n', 'replace in place, append the missing key');
  assert.equal(write('x-devkit-version: 0.22.0\nschema: devkit\nx-devkit-flow: 1\n', both), 'x-devkit-version: 0.23.0\nschema: devkit\nx-devkit-flow: 2\n', 'replace both in place');
  assert.equal(write('schema: devkit\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n', { devkit: '0.23.0', flow: null }), 'schema: devkit\nx-devkit-version: 0.23.0\n', 'null drops the flow line');
  assert.equal(write('schema: devkit\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n', { devkit: null, flow: null }), 'schema: devkit\n', 'null drops both');
  assert.equal(write('schema: devkit\n', { devkit: null, flow: 3 }), 'schema: devkit\nx-devkit-flow: 3\n', 'a null version appends nothing');
  assert.equal(write('x-devkit-flow: 1\nschema: devkit\nx-devkit-flow: 3\nx-devkit-flow: 4\n', { devkit: null, flow: 2 }), 'x-devkit-flow: 2\nschema: devkit\n', 'collapse: the first line is replaced, the later ones dropped');
  assert.equal(write('# the change\nschema: devkit\r\n\ncreated: 2026-11-22 # day\n', both), '# the change\nschema: devkit\r\n\ncreated: 2026-11-22 # day\nx-devkit-version: 0.23.0\nx-devkit-flow: 2\n', 'every other line stays byte for byte');
});

test('version-pin AC-1 skill: the roadmap opens with the same open command', () => {
  const roadmap = SKILL.slice(SKILL.indexOf('## Roadmap'), SKILL.indexOf('## Status'));
  assert.match(roadmap, /- `start`: open the changes one after the other[^\n]*change-loop\.mjs open /);
});

test('version-pin AC-3 open: a change opened after the upgrade records flow 2', () => {
  const v2 = JSON.stringify(flowV2(), null, 2);
  const t = openProject({ files: { 'openspec/schemas/devkit/flow.json': v2, 'openspec/schemas/devkit/flows/2.json': v2 } });
  const dir = openedDir(t, openChange(t, 'after-upgrade'), 'after-upgrade');
  assert.ok(pinOf(dir).endsWith(`x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 2\n`), pinOf(dir));
});

// ================================================================ AC-5: the resume reply names a newer installed flow

const startChange = (root, lang) => CL.main(['start', '--lang', lang], { cwd: root, env: ENV, stdin: 'change feat' });

test('version-pin AC-5 resume: a newer installed flow adds one line in en and pt-BR', () => {
  const root = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  for (const lang of ['en', 'pt-BR']) {
    const r = startChange(root, lang);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const b = JSON.parse(r.stdout);
    assert.equal(b.mode, 'resume', lang);
    const lines = b.reply.split('\n');
    assert.equal(lines.length, 2, `${lang}: ${b.reply}`);
    assert.equal(lines[0].startsWith(CL.render(lang, 'resumed', { id: 'feat', where: '' }).split(':')[0]), true, lang);
    assert.equal(lines[1], CL.render(lang, 'flow-newer', { version: 1, installed: 2 }), lang);
  }
});

test('version-pin AC-5 resume: an equal installed flow adds no line', () => {
  const root = shared({ pin: 2, to2: true, stages: PLAN_V2 });
  for (const lang of ['en', 'pt-BR']) {
    const b = JSON.parse(startChange(root, lang).stdout);
    assert.equal(b.mode, 'resume', lang);
    assert.ok(!b.reply.includes('\n'), `${lang}: ${b.reply}`);
    assert.equal(b.reply.startsWith(CL.render(lang, 'resumed', { id: 'feat', where: '' }).split(':')[0]), true, lang);
  }
});

// ================================================================ AC-6: a change moves only on the command

const flowCommand = (root, id = 'feat', lang = 'en') => CL.main(['flow', id, '--lang', lang], { cwd: root, env: ENV });
const bodyOf = (r) => JSON.parse(r.stdout);

test('version-pin AC-6 flow: moves an older change and records the versions', () => {
  const root = variant(shared({ pin: 1, to2: true, stages: PLAN_V1 }), () => {});
  const dir = changeDirOf(root);
  const r = flowCommand(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(bodyOf(r), { version: 1, change: 'feat', script: 'devkit', flow: 2, reply: CL.render('en', 'flow-moved', { id: 'feat', version: 1, installed: 2 }) });
  assert.equal(pinOf(dir), `schema: devkit\ncreated: 2026-11-22\nx-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 2\n`);
  const { json } = readoutJson(root);
  assert.equal(json.next.stage, 'threat-model');
  assert.ok(!stageIds(json).includes('readiness'));
});

test('version-pin AC-6 flow: an equal change is left as it is', () => {
  const root = variant(shared({ pin: 2, to2: true, stages: PLAN_V2 }), () => {});
  const before = pinOf(changeDirOf(root));
  const r = flowCommand(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(bodyOf(r), { version: 1, change: 'feat', script: 'devkit', flow: 2 });
  assert.equal(pinOf(changeDirOf(root)), before);
});

test('version-pin AC-6 flow: a change newer than the installed flow is refused', () => {
  const root = withYaml(shared({ pin: 1, to2: true, stages: PLAN_V1 }), yamlOf('devkit', 3));
  const before = pinOf(changeDirOf(root));
  const r = flowCommand(root);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.equal(bodyOf(r).reply, CL.render('en', 'flow-ahead', { id: 'feat', version: 3, installed: 2 }));
  assert.equal(pinOf(changeDirOf(root)), before);
});

test('version-pin AC-6 flow: no active change, an archived change, no installed flow and a malformed pin are usage errors', () => {
  const base = shared({ pin: 1, to2: true, stages: PLAN_V1 });
  const refused = (root, id, expected) => {
    const before = pinOf(changeDirOf(root));
    const r = flowCommand(root, id);
    assert.equal(r.code, 3, `${expected}: ${r.stdout}${r.stderr}`);
    assert.ok(bodyOf(r).error.includes(expected), `${expected}: ${bodyOf(r).error}`);
    assert.equal(pinOf(changeDirOf(root)), before, `${expected}: bytes equal`);
  };
  refused(variant(base, () => {}), 'ghost', 'ghost');
  refused(variant(base, (c) => {
    const archive = join(c, 'openspec', 'changes', 'archive', '2026-11-22-old');
    mkdirSync(dirname(archive), { recursive: true });
    cpSync(changeDirOf(c), archive, { recursive: true });
  }), 'old', 'old');
  refused(variant(base, (c) => rmSync(join(c, 'openspec', 'schemas', 'devkit', 'flow.json'))), 'feat', 'devkit');
  refused(withYaml(base, yamlOf('devkit', 'abc')), 'feat', '"abc"');
});

test('version-pin AC-6 flow: next, wait, another open, a setup re-run and a pack update leave the pin', async () => {
  const t = openProject();
  const dir = changeDirOf(t.main);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.openspec.yaml'), yamlOf('devkit', 1));
  planFiles(dir, PLAN_V1, git(t.main, 'rev-parse', 'HEAD'));
  commitAll(t.main, 'a change under way');
  const before = pinOf(dir);
  const same = (what) => assert.equal(pinOf(dir), before, what);

  const next = CL.main(['next', '--change', 'feat', '--lang', 'en'], { cwd: t.main, env: ENV });
  assert.equal(next.code, 0, next.stdout + next.stderr);
  same('next');
  const waited = await CL.runCommand(['wait', '--change', 'feat', '--interval', '5', '--lang', 'en'], { cwd: t.main, env: ENV });
  assert.equal(waited.code, 0, waited.stdout + waited.stderr);
  same('wait');
  const opened = openChange(t, 'second-one');
  assert.equal(opened.code, 0, opened.stdout + opened.stderr);
  same('another open');

  const pack = packV2();
  const setup = spawnSync('bash', [join(pack, 'skills', 'openspec-setup', 'scripts', 'install-schemas.sh'), t.main], { env: ENV, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stdout + setup.stderr);
  assert.ok(existsSync(join(t.main, 'openspec', 'schemas', 'devkit', 'flows', '2.json')), 'the re-run installed version 2');
  same('a setup re-run');
  const updated = spawnSync(process.execPath, [join(pack, 'hooks', 'change-loop.mjs'), 'next', '--change', 'feat', '--lang', 'en'], { cwd: t.main, env: ENV, encoding: 'utf8' });
  assert.equal(updated.status, 0, updated.stdout + updated.stderr);
  const readout = spawnSync(process.execPath, [join(pack, 'hooks', 'flow-check.mjs'), 'feat', '--lang', 'en'], { cwd: t.main, env: ENV, encoding: 'utf8' });
  assert.equal(readout.status, 0, readout.stdout + readout.stderr);
  assert.match(readout.stdout, /version 1 of the devkit script; version 2 is installed/);
  same('a pack update');
});

// A project with change `feat` on `schema`, no proposal yet, and version 2 of `devkit` installed.
const switchScratch = (schema) => scratch({ schema, pin: 1, to2: true, stages: ['requirements'] });
const switchTo = (root, script) => CL.main(['script', 'feat', script, '--why', 'doubt', '--lang', 'en'], { cwd: root, env: ENV });

test('version-pin AC-6 script: a switch records the new script\'s installed flow', () => {
  const root = switchScratch('devkit-lite');
  const dir = changeDirOf(root);
  assert.equal(switchTo(root, 'devkit').code, 0);
  assert.equal(pinOf(dir), `schema: devkit\ncreated: 2026-11-22\nx-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 2\n`);
  assert.equal(switchTo(root, 'devkit-lite').code, 0);
  assert.equal(pinOf(dir), `schema: devkit-lite\ncreated: 2026-11-22\nx-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 1\n`);
});

test('version-pin AC-6 script: a switch to a script with no installed flow drops the flow line', () => {
  const root = switchScratch('devkit-lite');
  rmSync(join(root, 'openspec', 'schemas', 'devkit', 'flow.json'));
  assert.equal(switchTo(root, 'devkit').code, 0);
  const text = pinOf(changeDirOf(root));
  assert.doesNotMatch(text, /x-devkit-flow/);
  assert.match(text, /^schema: devkit\ncreated: 2026-11-22\n/);
});

test('version-pin AC-6 skill: the flow command runs only on the owner\'s request', () => {
  const sentence = SKILL.split('\n').find((l) => l.startsWith('When the owner asks') && l.includes('change-loop.mjs flow <id> --lang'));
  assert.ok(sentence, 'a "When the owner asks" sentence runs change-loop.mjs flow <id> --lang');
  assert.match(sentence, /never run it unasked/);
});

// ================================================================ AC-7: every released flow version is kept

test('version-pin AC-7 schema: every kept flow is valid and named by its version', () => {
  for (const base of [PLUGIN_SCHEMAS, join(REPO, 'openspec', 'schemas')]) {
    for (const schema of readdirSync(base).sort()) {
      const folder = join(base, schema);
      if (!existsSync(join(folder, 'flow.json'))) continue;
      const kept = readdirSync(join(folder, 'flows')).sort();
      assert.ok(kept.length > 0, `${schema} keeps its released versions`);
      for (const name of kept) {
        const n = Number(name.replace(/\.json$/, ''));
        assert.match(name, /^[1-9][0-9]*\.json$/, `${schema}/flows/${name} is named by a version`);
        assert.equal(GUARD.readFlowFile(join(folder, 'flows', name), `${schema} flow ${n}`).version, n, `${schema}/flows/${name} declares ${n}`);
      }
      const current = JSON.parse(readFileSync(join(folder, 'flow.json'), 'utf8')).version;
      assert.deepEqual(readFileSync(join(folder, 'flows', `${current}.json`)), readFileSync(join(folder, 'flow.json')), `${schema}: flows/${current}.json is flow.json`);
    }
  }
});

// ================================================================ AC-7: scripts/check.py refuses a flow change that keeps its version

const CHECK_PY = join(REPO, 'scripts', 'check.py');
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const FLOWS_REL = join('plugins', 'openspec', 'schemas');

// A scratch root holding the pack's schemas and scripts/released-flows.json at release 1 (T-21): the version 2 files and digests of devkit and
// devkit-lite are left out. With `tree`, as the tree has them.
function checkScratch({ tree = false } = {}) {
  const root = tmpFolder('devkit-version-pin-check-');
  cpSync(PLUGIN_SCHEMAS, join(root, FLOWS_REL), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  cpSync(join(REPO, 'scripts', 'released-flows.json'), join(root, 'scripts', 'released-flows.json'));
  if (!tree) {
    installRelease1(join(root, FLOWS_REL));
    const released = JSON.parse(readFileSync(join(root, 'scripts', 'released-flows.json'), 'utf8'));
    for (const script of RELEASE_1_SCRIPTS) delete released[script]['2'];
    writeFileSync(join(root, 'scripts', 'released-flows.json'), `${JSON.stringify(released, null, 2)}\n`);
  }
  return root;
}
const flowPath = (root, script = 'devkit', ...more) => join(root, FLOWS_REL, script, ...(more.length ? more : ['flow.json']));
const digestsPath = (root) => join(root, 'scripts', 'released-flows.json');
const readDigests = (root) => JSON.parse(readFileSync(digestsPath(root), 'utf8'));
const writeDigests = (root, digests) => writeFileSync(digestsPath(root), `${JSON.stringify(digests, null, 2)}\n`);
const runCheck = (root) => {
  const r = spawnSync('python3', [CHECK_PY, '--root', root], { encoding: 'utf8', env: ENV });
  return { code: r.status, out: r.stdout + r.stderr };
};
// `devkit`'s flow.json with one more stage, the version as given: a flow change.
const changedFlow = (version) => ({ ...treeFlow(), version, stages: [...treeFlow().stages, { ...treeFlow().stages[0], id: 'extra-stage' }] });
// Raise `devkit` to `version`: a changed flow.json, the same bytes under flows/<version>.json, optionally its digest.
function raiseTo(root, version, { keep = true, digest = true } = {}) {
  const bytes = JSON.stringify(changedFlow(version), null, 2);
  writeFileSync(flowPath(root), bytes);
  if (keep) writeFileSync(flowPath(root, 'devkit', 'flows', `${version}.json`), bytes);
  if (digest) writeDigests(root, { ...readDigests(root), devkit: { ...readDigests(root).devkit, [version]: sha(bytes) } });
}

test('version-pin AC-7 check: the tree\'s flows pass', () => {
  const root = checkScratch({ tree: true });
  const r = runCheck(root);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /all checks passed/);
  // The pass is not vacuous: the same scratch fails once a released file is edited.
  writeFileSync(flowPath(root), JSON.stringify(changedFlow(1), null, 2));
  assert.equal(runCheck(root).code, 1, 'the check reads these flows');
});

test('version-pin AC-7 check: a flow changed without raising its version fails', () => {
  const root = checkScratch();
  writeFileSync(flowPath(root), JSON.stringify(changedFlow(1), null, 2));
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /plugins\/openspec\/schemas\/devkit\/flow\.json: differs from flows\/1\.json, the released content of version 1; a flow change raises its version/);
});

test('version-pin AC-7 check: a raised version passes', () => {
  const root = checkScratch();
  raiseTo(root, 2, { digest: false });
  assert.equal(runCheck(root).code, 1, 'until its digest is recorded the raise fails');
  raiseTo(root, 2);
  const r = runCheck(root);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /all checks passed/);
});

test('version-pin AC-7 check: a raised version with no kept file fails', () => {
  const root = checkScratch();
  raiseTo(root, 2, { keep: false });
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /devkit\/flow\.json: version 2 has no flows\/2\.json; keep each released flow version there/);
});

test('version-pin AC-7 check: a kept version with no digest fails', () => {
  const root = checkScratch();
  raiseTo(root, 2, { digest: false });
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /devkit\/flows\/2\.json: no digest in scripts\/released-flows\.json/);
});

test('version-pin AC-7 check: an edited released version fails', () => {
  const root = checkScratch();
  const bytes = JSON.stringify(changedFlow(1), null, 2);
  writeFileSync(flowPath(root), bytes);
  writeFileSync(flowPath(root, 'devkit', 'flows', '1.json'), bytes);
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /devkit\/flows\/1\.json: does not match the digest of released version 1 in scripts\/released-flows\.json/);
  assert.doesNotMatch(r.out, /differs from flows\/1\.json/, 'flow.json and flows/1.json agree; only the digest refuses');
});

test('version-pin AC-7 check: a kept file declaring another version fails', () => {
  const root = checkScratch();
  const bytes = JSON.stringify({ ...treeFlow(), version: 5 }, null, 2);
  writeFileSync(flowPath(root, 'devkit', 'flows', '3.json'), bytes);
  writeDigests(root, { ...readDigests(root), devkit: { ...readDigests(root).devkit, 3: sha(bytes) } });
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /devkit\/flows\/3\.json: its version is 5, not 3/);
});

test('version-pin AC-7 check: a kept file whose name is not a version fails', () => {
  for (const name of ['0.json', '01.json', 'x.json', '1.5.json']) {
    const root = checkScratch();
    writeFileSync(flowPath(root, 'devkit', 'flows', name), '{}');
    const r = runCheck(root);
    assert.equal(r.code, 1, `${name}: ${r.out}`);
    assert.match(r.out, new RegExp(`devkit/flows/${name.replace(/\./g, '\\.')}: not a flow version`), name);
  }
});

test('version-pin AC-7 check: a flow.json with no integer version fails', () => {
  for (const body of ['not json', JSON.stringify({ ...treeFlow(), version: '1' }), JSON.stringify({ ...treeFlow(), version: 1.5 })]) {
    const root = checkScratch();
    writeFileSync(flowPath(root), body);
    const r = runCheck(root);
    assert.equal(r.code, 1, `${body.slice(0, 20)}: ${r.out}`);
    assert.match(r.out, /devkit\/flow\.json: no integer "version"/, body.slice(0, 20));
  }
});

test('version-pin AC-7 check: a digest with no kept file fails', () => {
  const root = checkScratch();
  writeDigests(root, { ...readDigests(root), devkit: { ...readDigests(root).devkit, 2: 'sha256:abc' } });
  const r = runCheck(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /scripts\/released-flows\.json: devkit version 2 has no flows\/2\.json/);
});

test('version-pin AC-7 check: a missing or unreadable digest list fails', () => {
  const missing = checkScratch();
  rmSync(digestsPath(missing));
  const a = runCheck(missing);
  assert.equal(a.code, 1, a.out);
  assert.match(a.out, /scripts\/released-flows\.json is missing: it records the digest of every released flow version/);
  const broken = checkScratch();
  writeFileSync(digestsPath(broken), 'not json');
  const b = runCheck(broken);
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /scripts\/released-flows\.json is not JSON/);
});

test('version-pin AC-7 check: a root without the schemas skips the check', () => {
  const root = tmpFolder('devkit-version-pin-check-bare-');
  writeFileSync(join(root, 'README.md'), '# A project\n');
  const r = runCheck(root);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /released-flows/);
});
