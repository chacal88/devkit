// node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs
// flow-script-checker: the stage header, the stage declaration and the checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync, utimesSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as FC from './flow-check.mjs';
import { parseStageHeader, readFlow, pendingTasks, FlowUsageError, collectFlow, computeFlow, renderText, TEXT, reasonText } from './flow-check.mjs';
import { makeGh } from './deliver-check.mjs';
import { gitRepo, put, commitAll, git, fakeGh, openspecStub, PR_FILES_KEY, TASKS_ON_KEY, filesFixture, tasksFixture, tasksText, roundRepo } from './test-fixtures.mjs';
import { collectState, nextStep, approvalState } from './deliver-check.mjs';
import { conductState } from './conduct-check.mjs';

const SHA7 = 'a1b2c3d';
const SHA40 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('flow-check header: a well-formed line is read', () => {
  for (const result of ['passed', 'failed', 'not-applicable', 'pending']) {
    const h = parseStageHeader(`<!-- devkit-stage review result=${result} attempt=2 commit=${SHA7} -->\n# Review\n`);
    assert.deepEqual(h, { stage: 'review', result, attempt: 2, commit: SHA7 });
  }
  assert.equal(parseStageHeader(`<!-- devkit-stage tasks result=passed attempt=1 commit=${SHA40} -->\n`).commit, SHA40);
  assert.equal(parseStageHeader('<!-- devkit-stage tasks result=pending attempt=1 commit=none -->\n').commit, 'none');
  assert.deepEqual(
    parseStageHeader(`<!-- devkit-stage specs result=passed attempt=12 commit=${SHA7} -->\r\n# Spec\r\n`),
    { stage: 'specs', result: 'passed', attempt: 12, commit: SHA7 },
  );
});

test('flow-check header: a malformed line, another first line and no line', () => {
  assert.deepEqual(parseStageHeader('<!-- devkit-stage x result=done attempt=1 commit=none -->\n'), { malformed: true });
  assert.deepEqual(parseStageHeader('<!-- devkit-stage x result=passed|failed attempt=1 commit=none -->\n'), { malformed: true });
  assert.deepEqual(parseStageHeader('<!-- devkit-stage x result=passed attempt=0 commit=none -->\n'), { malformed: true });
  assert.deepEqual(parseStageHeader('<!-- devkit-stage x result=passed attempt=1 commit=abc -->\n'), { malformed: true });
  assert.equal(parseStageHeader('# Proposal\n'), null);
  assert.equal(parseStageHeader(''), null);
});

function flowRoot(flow, schema = 'devkit') {
  const root = tmpFolder('devkit-flow-check-');
  const dir = join(root, 'openspec', 'schemas', schema);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'schema.yaml'), `name: ${schema}\nversion: 1\nartifacts: []\n`);
  if (flow !== undefined) writeFileSync(join(dir, 'flow.json'), typeof flow === 'string' ? flow : JSON.stringify(flow));
  return root;
}

const title = (en) => ({ en, 'pt-BR': en });
const stage = (id, extra = {}) => ({ id, source: 'artifact', file: `${id}.md`, role: 'change-planner', skills: [], part: 'plan', title: title(id), ...extra });
const flowOf = (...stages) => ({ version: 1, script: 'devkit', ceilings: { default: 3 }, stages });

test('flow-check declaration: readFlow refuses a malformed flow.json', () => {
  const good = flowOf(stage('a'), stage('b', { onFail: 'a', staleAfter: ['a'] }));
  const flow = readFlow(flowRoot(good), 'devkit');
  assert.equal(flow.stages.length, 2);
  assert.equal(readFlow(flowRoot(undefined), 'devkit'), null);
  assert.equal(readFlow(flowRoot(good), 'nonexistent'), null);

  const bad = {
    'a duplicate id': flowOf(stage('a'), stage('a')),
    'an unknown source': flowOf(stage('a', { source: 'wiki' })),
    'an onFail naming a later stage': flowOf(stage('a', { onFail: 'b' }), stage('b')),
    'a staleAfter naming an unknown stage': flowOf(stage('a'), stage('b', { staleAfter: ['zzz'] })),
    'a title without pt-BR': flowOf(stage('a', { title: { en: 'A' } })),
  };
  for (const [why, f] of Object.entries(bad)) {
    assert.throws(() => readFlow(flowRoot(f), 'devkit'), FlowUsageError, why);
  }
  assert.throws(() => readFlow(flowRoot('{ not json'), 'devkit'), FlowUsageError);
});

test('flow-check tasks: a checkbox inside a fenced block is not a task', () => {
  const text = [
    '# Tasks',                // 1
    '',                       // 2
    '- [ ] 1.1 real',         // 3
    '',                       // 4
    '```md',                  // 5
    '- [ ] 9.1 in backticks', // 6
    '```',                    // 7
    '~~~',                    // 8
    '- [ ] 9.2 in tildes',    // 9
    '~~~',                    // 10
    '````',                   // 11
    '```',                    // 12 shorter fence: does not close
    '- [ ] 9.3 still fenced', // 13
    '```',                    // 14
    '````',                   // 15
    '- [ ] 1.2 after',        // 16
    '- [x] 1.3 done',         // 17
  ].join('\n');
  const tasks = [
    { id: '1', done: false, line: 3 }, { id: '2', done: false, line: 6 },
    { id: '3', done: false, line: 9 }, { id: '4', done: false, line: 13 },
    { id: '5', done: false, line: 16 }, { id: '6', done: true, line: 17 },
  ];
  assert.deepEqual(pendingTasks(tasks, text).map((t) => t.line), [3, 16]);
});

// ---------------------------------------------------------------- the two scripts (phase 2)

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_SCHEMAS = join(HERE, '..', 'schemas');
const REPO_SCHEMAS = join(HERE, '..', '..', '..', 'openspec', 'schemas');
const INSTALL = join(HERE, '..', 'skills', 'openspec-setup', 'scripts', 'install-schemas.sh');

const DEVKIT_STAGES = ['requirements', 'mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness',
  'approval', 'unit-tests', 'e2e-tests', 'evidence', 'review', 'retro'];
// Invariant (T-1, schema, flow-check.test.mjs): the short script declares neither the plan review, nor the design, nor the stages the full script alone runs (mock-up, decisions).
const LITE_STAGES = DEVKIT_STAGES.filter((s) => !['design', 'readiness', 'approval', 'mockup', 'decisions'].includes(s));
const STAGES_OF = { devkit: DEVKIT_STAGES, 'devkit-lite': LITE_STAGES };

const run = (cwd, cmd, ...args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout;
};

// One temporary project with both schemas installed and one new change per schema (`x` devkit, `y` devkit-lite).
let projectCache = null;
function schemaProject() {
  if (projectCache) return projectCache;
  const root = tmpFolder('devkit-flow-');
  run(root, 'git', 'init', '-q');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  run(root, 'bash', INSTALL, '.');
  run(root, 'openspec', 'new', 'change', 'x', '--schema', 'devkit');
  run(root, 'openspec', 'new', 'change', 'y', '--schema', 'devkit-lite');
  const status = (id) => JSON.parse(run(root, 'openspec', 'status', '--change', id, '--json'));
  projectCache = { root, x: status('x'), y: status('y') };
  return projectCache;
}
// test-fixture-cleanup: made at module level, so the sweep removes it and no test's end does.
schemaProject();


test('flow-check schema: AC-1 a new devkit change lists every stage in order', () => {
  const { x } = schemaProject();
  assert.deepEqual(x.artifacts.map((a) => a.id), DEVKIT_STAGES);
  assert.deepEqual(x.applyRequires, ['approval']);
});

test('flow-check schema: AC-8 a new devkit-lite change lists the short script', () => {
  const { y } = schemaProject();
  const ids = y.artifacts.map((a) => a.id);
  assert.deepEqual(ids, LITE_STAGES);
  for (const gone of ['readiness', 'approval', 'design']) assert.ok(!ids.includes(gone), `no ${gone}`);
  assert.deepEqual(y.applyRequires, ['tasks']);
});

test('flow-check schema: flow.json matches the schema', () => {
  const { root, x, y } = schemaProject();
  for (const [schema, status] of [['devkit', x], ['devkit-lite', y]]) {
    const flow = readFlow(root, schema);
    assert.ok(flow, `${schema} has a flow.json`);
    assert.equal(flow.script, schema);
    const declared = flow.stages.filter((s) => s.source === 'artifact');
    assert.deepEqual(declared.map((s) => s.id), status.artifacts.map((a) => a.id), `${schema} ids in order`);
    for (const [i, s] of declared.entries()) assert.equal(s.file, status.artifacts[i].outputPath, `${schema} ${s.id} file`);
    assert.deepEqual(flow.stages.filter((s) => s.source !== 'artifact').map((s) => s.id), ['open', 'implementation', 'delivery']);
  }
});

test('flow-check schema: AC-3 every template starts with its stage header', () => {
  for (const schema of ['devkit', 'devkit-lite']) {
    const dir = join(PLUGIN_SCHEMAS, schema, 'templates');
    const files = readdirSync(dir).sort();
    const want = STAGES_OF[schema].map((s) => (s === 'specs' ? 'spec.md' : `${s}.md`)).sort();
    assert.deepEqual(files, want, `${schema} templates`);
    for (const f of files) {
      const stage = f === 'spec.md' ? 'specs' : f.replace(/\.md$/, '');
      const text = readFileSync(join(dir, f), 'utf8');
      assert.deepEqual(parseStageHeader(text), { stage, result: 'pending', attempt: 1, commit: 'none' }, `${schema}/${f} line 1`);
      for (const l of text.split('\n').slice(1)) {
        assert.ok(!/^\s*(Status|Verdict)\s*:/i.test(l), `${schema}/${f}: no Status/Verdict line`);
        if (f !== 'evidence.md') assert.ok(!/^\s*Commit\s*:/i.test(l), `${schema}/${f}: no Commit line`);
      }
    }
  }
});

test('flow-check schema: the openspec/schemas copies are byte-identical', () => {
  const list = (dir, rel = '') => readdirSync(join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? list(dir, join(rel, e.name)) : [join(rel, e.name)])).sort();
  const plugin = list(PLUGIN_SCHEMAS);
  assert.ok(plugin.includes(join('devkit', 'flow.json')) && plugin.includes(join('devkit-lite', 'flow.json')));
  assert.deepEqual(list(REPO_SCHEMAS), plugin);
  for (const f of plugin) {
    assert.ok(readFileSync(join(REPO_SCHEMAS, f)).equals(readFileSync(join(PLUGIN_SCHEMAS, f))), `${f} is identical`);
  }
});

// ---------------------------------------------------------------- roles and today's readers (phase 3)

const REPO_ROOT = join(HERE, '..', '..', '..');
const GUARD = join(HERE, 'guard.mjs');

const filesUnder = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));

// The first line of each instruction of a schema.yaml, keyed by the artifact id ('apply' for the apply block).
function instructionFirstLines(yaml) {
  const lines = yaml.split('\n');
  const out = {};
  let owner = null;
  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].match(/^ {2}- id: (\S+)/);
    if (id) owner = id[1];
    if (/^apply:/.test(lines[i])) owner = 'apply';
    if (owner && /^\s+instruction: \|\s*$/.test(lines[i])) {
      const first = lines.slice(i + 1).find((l) => l.trim() !== '');
      out[owner] = first.trim();
    }
  }
  return out;
}

const FORBIDDEN = ['devkit-core:', 'subagent_type', 'Agent tool', 'AskUserQuestion', 'Workflow tool', 'Claude'];

test('flow-check AC-2: no schema text names a platform tool', () => {
  for (const base of [PLUGIN_SCHEMAS, REPO_SCHEMAS]) {
    for (const schema of ['devkit', 'devkit-lite']) {
      for (const file of filesUnder(join(base, schema))) {
        const text = readFileSync(file, 'utf8');
        for (const word of FORBIDDEN) assert.ok(!text.includes(word), `${file} names ${word}`);
      }
      const flow = readFlow(join(base, '..', '..'), schema);
      const roleOf = Object.fromEntries(flow.stages.map((s) => [s.id, s.role]));
      const first = instructionFirstLines(readFileSync(join(base, schema, 'schema.yaml'), 'utf8'));
      assert.ok(first.apply, `${schema} has an apply instruction`);
      for (const [id, line] of Object.entries(first)) {
        const role = id === 'apply' ? roleOf.implementation : roleOf[id];
        assert.ok(role, `${schema}/${id} has a role in flow.json`);
        assert.ok(line.startsWith(`Role: ${role}.`), `${schema}/${id} first line "${line}" names ${role}`);
      }
      for (const s of flow.stages.filter((x) => x.source === 'artifact')) assert.ok(first[s.id], `${schema}/${s.id} has an instruction`);
    }
  }
});

test('flow-check AC-2: the role document covers every role', () => {
  const doc = readFileSync(join(REPO_ROOT, 'docs', 'roles.md'), 'utf8');
  const headings = new Set(doc.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()));
  const wanted = new Set();
  for (const schema of ['devkit', 'devkit-lite']) {
    for (const s of readFlowOf(schema)) {
      wanted.add(s.role);
      for (const h of s.helpers ?? []) wanted.add(h);
    }
  }
  assert.ok(wanted.size >= 20, 'both declarations name their roles');
  for (const role of wanted) assert.ok(headings.has(role), `docs/roles.md has "## ${role}"`);
});

// flow.json of a shipped schema, read directly (readFlow looks in the project's openspec/schemas).
function readFlowOf(schema) {
  return JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, schema, 'flow.json'), 'utf8')).stages;
}

function guardRun(mode, cwd, input = {}, env = {}) {
  const clean = { DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
  const r = spawnSync('node', [GUARD, mode], { cwd, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...clean, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('flow-check AC-2: the session hook names the checker and the roles', () => {
  const root = tmpFolder('devkit-flow-session-');
  git(root, 'init', '-q', '-b', 'main');
  cpSync(PLUGIN_SCHEMAS, join(root, 'openspec', 'schemas'), { recursive: true });
  put(root, { 'openspec/config.yaml': 'schema: devkit\n', 'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n' });
  const { code, out } = guardRun('session', root);
  assert.equal(code, 0);
  assert.match(out, /flow-check\.mjs/);
  assert.match(out, /a role is the devkit-core agent of the same name/);
  assert.match(out, /`\/devkit change` runs a change/);
  assert.match(out, /`flow-check` is the read-only readout of the stages/);
  assert.doesNotMatch(out, /the next step is what `openspec status` says/);
});

// ---- AC-6: a stage header changes no step of today's readers

const HEADER = (stage, result = 'passed') => `<!-- devkit-stage ${stage} result=${result} attempt=1 commit=none -->\n`;
const headed = (on, stage, text) => (on ? HEADER(stage) + text : text);
const SHIP_ENV = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', CLAUDE_CODE_SESSION_ID: '' };
const CHANGE = 'openspec/changes/feat';
const PLAN_PROPOSAL = '# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n';
const hashOfFile = (file) => `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)}`;
const gateRowOf = (cmd) => `| 1.2 | \`${cmd}\` | pass: ok |\n`;
const evidenceText = (sha, on, defect = false) => `${on ? HEADER('evidence') : ''}Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${gateRowOf('node -e 0')}\n### Acceptance\n| AC-1 | proof | ${defect ? 'fail: red' : 'pass: t'} |\n`;
const reviewText = (verdict, sha) => `Verdict: ${verdict}\nCommit: ${sha}\n\n# Review\n`;
const PR_BODY = 'feat\n- AC-1\nopenspec/changes/feat/evidence.md\n';

// A committed devkit change `feat` on ship/feat, in the state named by `kind`; `on` puts the header on every stage file.
function fixture(kind, on) {
  const rank = ['stop-not-approved', 'stop-plan-approval', 'implement', 'gate', 'verify', 'review', 'fix-review', 'fix-defect', 'open-pr', 'ready'].indexOf(kind);
  const root = gitRepo({
    config: 'schema: devkit\nship:\n  devkit: pr\n',
    changes: { feat: {
      '.openspec.yaml': 'schema: devkit\n',
      'requirements.md': headed(on, 'requirements', '# Requirements\n'),
      'proposal.md': headed(on, 'proposal', PLAN_PROPOSAL),
      'design.md': headed(on, 'design', '# Design\n'),
      'tasks.md': headed(on, 'tasks', `# Tasks\n\n## 1. First\n- [${kind === 'implement' ? ' ' : 'x'}] 1.1 code\n- [${rank <= 3 ? ' ' : 'x'}] 1.2 Gate: \`node -e 0\` green\n`),
      ...(rank >= 1 ? { 'readiness.md': headed(on, 'readiness', '# Readiness\n\n- Status: APPROVED\n') } : {}),
    } },
    files: { 'src/a.ts': 'a\n' },
  });
  git(root, 'switch', '-q', '-c', 'ship/feat');
  if (rank >= 2) {
    put(root, { [`${CHANGE}/approval.md`]: headed(on, 'approval', `# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hashOfFile(join(root, CHANGE, 'readiness.md'))}\n- Date: 2026-11-09\n- Owner's words: "ok"\n`) });
  }
  if (kind === 'stop-plan-approval') put(root, { [`${CHANGE}/tasks.md`]: headed(on, 'tasks', '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n') });
  commitAll(root, 'plan and code');
  const sha = git(root, 'rev-parse', 'HEAD');
  if (rank >= 5) put(root, { [`${CHANGE}/evidence.md`]: evidenceText(sha, on, kind === 'fix-defect') });
  if (kind === 'review') commitAll(root, 'evidence');
  if (rank >= 8) {
    for (const r of ['code-quality-reviewer', 'test-coverage-reviewer']) put(root, { [`${CHANGE}/reviews/${r}.md`]: reviewText('approved', sha) });
  }
  if (kind === 'fix-review') {
    put(root, {
      [`${CHANGE}/reviews/code-quality-reviewer.md`]: reviewText('rejected', sha),
      [`${CHANGE}/reviews/test-coverage-reviewer.md`]: reviewText('approved', sha),
      [`${CHANGE}/review.md`]: headed(on, 'review', '# Review: feat\n\nConsensus: FAIL (round 1/2)\n'),
    });
  }
  if (kind === 'fix-defect') put(root, { [`${CHANGE}/evidence.md`]: evidenceText(sha, on, true) });
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  gh.set('pr-list', { stdout: [] });
  if (kind === 'ready') {
    commitAll(root, 'ship change files');
    gh.set('pr-view', { stdout: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: git(root, 'rev-parse', 'HEAD'), baseRefName: 'main', mergeable: 'MERGEABLE', body: PR_BODY, autoMergeRequest: null, mergeStateStatus: 'CLEAN' } });
    gh.set('pr-checks', { stdout: [{ name: 'build', state: 'PASS', bucket: 'pass', link: 'https://ci/build' }] });
    gh.set('api-graphql', { stdout: { data: { viewer: { login: 'me' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } } });
  }
  return { root, env: { ...gh.env, ...SHIP_ENV } };
}

test('flow-check AC-6: deliver-check gives the same step with and without stage headers', () => {
  const kinds = ['stop-not-approved', 'stop-plan-approval', 'implement', 'gate', 'verify', 'review', 'fix-review', 'fix-defect', 'open-pr', 'ready'];
  for (const kind of kinds) {
    const steps = [false, true].map((on) => {
      const { root, env } = fixture(kind, on);
      return nextStep(collectState(root, 'feat', { env })).step;
    });
    assert.equal(steps[0], kind, `${kind} without headers`);
    assert.equal(steps[1], steps[0], `${kind} with headers`);
  }
});

test('flow-check AC-6: the readiness gate reads Status under a header', () => {
  const root = tmpFolder('devkit-flow-gate-');
  git(root, 'init', '-q', '-b', 'main');
  cpSync(PLUGIN_SCHEMAS, join(root, 'openspec', 'schemas'), { recursive: true });
  const write = (status) => put(root, {
    'openspec/config.yaml': 'schema: devkit\n',
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/feat/readiness.md': `${HEADER('readiness')}## 1. Decision\n- Status: ${status}\n`,
  });
  const edit = () => guardRun('edit', root, { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src/a.ts') }, agent_type: 'devkit-core:tdd-implementer', agent_id: 'x' });
  write('APPROVED');
  assert.equal(edit().code, 0);
  write('NEEDS-REVISION');
  assert.equal(edit().code, 2);
});

test('flow-check AC-6: approvalState reads a headed approval.md', () => {
  const t = fixture('implement', true);
  const dir = join(t.root, CHANGE);
  const hash = hashOfFile(join(dir, 'readiness.md'));
  assert.ok(readFileSync(join(dir, 'approval.md'), 'utf8').startsWith('<!-- devkit-stage approval'));
  assert.deepEqual(approvalState(dir), { status: 'APPROVED', recorded: hash, readiness: hash, ok: true });
});

test('flow-check AC-6: conduct-check gives the same planning step with headers', () => {
  const at = (file, seconds) => { const d = new Date(seconds * 1000); utimesSync(file, d, d); };
  const T0 = Math.floor(Date.now() / 1000) - 10000;
  const steps = (on, stage) => {
    const t = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] c\n' });
    const wt = t.addWt('c');
    const dir = join(wt, 'openspec', 'changes', 'c');
    const files = { '.openspec.yaml': 'schema: devkit\n' };
    if (stage !== 'grill') Object.assign(files, {
      'requirements.md': headed(on, 'requirements', '# R\n'),
      'proposal.md': headed(on, 'proposal', PLAN_PROPOSAL),
      'design.md': headed(on, 'design', '# Design\n'),
      'tasks.md': headed(on, 'tasks', '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n'),
    });
    put(wt, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/c/${f}`, b])));
    for (const f of ['proposal.md', 'design.md', 'tasks.md', 'requirements.md']) if (existsSync(join(dir, f))) at(join(dir, f), T0);
    if (stage === 'approve' || stage === 'deliver') {
      put(wt, { 'openspec/changes/c/readiness.md': headed(on, 'readiness', '# Readiness\n\n- Status: APPROVED\n') });
      at(join(dir, 'readiness.md'), T0 + 5);
    }
    if (stage === 'deliver') {
      put(wt, { 'openspec/changes/c/approval.md': headed(on, 'approval', `# Plan approval: c\n\n- Status: APPROVED\n- Readiness: ${hashOfFile(join(dir, 'readiness.md'))}\n- Date: 2026-11-09\n- Owner's words: "ok"\n`) });
      at(join(dir, 'approval.md'), T0 + 6);
    }
    return conductState(t.main, { env: { ...process.env, ...SHIP_ENV, DEVKIT_BYPASS: '', DEVKIT_HOST: 'cli' }, ghFor: t.ghFor }).changes.find((c) => c.id === 'c').next.step;
  };
  const want = { grill: 'grill', readiness: 'readiness', approve: 'approve' };
  for (const stage of ['grill', 'readiness', 'approve', 'deliver']) {
    const plain = steps(false, stage);
    if (want[stage]) assert.equal(plain, want[stage], `${stage} plain`);
    assert.equal(steps(true, stage), plain, `${stage} with headers`);
  }
});

// ---------------------------------------------------------------- the walk over files and git (phase 4)

const FLOW_DEVKIT = JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, 'devkit', 'flow.json'), 'utf8'));
const T0 = 1_000_000_000_000;

// Synthetic facts for computeFlow: every artifact stage has a passed file at commit c000000, written at T0.
// `over[id]`: null (no file), or { result, attempt, commit, at (ms after T0), header (a raw parse result) }.
function synth(over = {}, extra = {}) {
  const files = {};
  for (const s of FLOW_DEVKIT.stages.filter((x) => x.source === 'artifact')) {
    const o = over[s.id] === undefined ? {} : over[s.id];
    if (o === null) { files[s.id] = []; continue; }
    const one = (f, i) => {
      const header = 'header' in f ? f.header : { stage: s.id, result: f.result ?? 'passed', attempt: f.attempt ?? 1, commit: f.commit ?? 'c000000' };
      return { path: s.file.replace('**/*.md', i === 0 ? 'x/spec.md' : `x${i}/spec.md`), header, mtimeMs: T0 + (f.at ?? 0) };
    };
    files[s.id] = (o.files ?? [o]).map(one);
  }
  return {
    id: 'feat', schema: 'devkit', archived: false, head: 'c000000', opened: true, skipped: [], files,
    tasks: { exists: true, total: 0, done: 0, pending: [] }, dirty: [], staleness: () => null,
    fingerprint: '0123456789ab', delivery: () => ({ state: 'passed' }), ...extra,
  };
}
const walk = (over, extra, opts) => computeFlow(synth(over, extra), FLOW_DEVKIT, opts);
const stageOf = (report, id) => report.stages.find((s) => s.id === id);

test('flow-check stages: a failed header does not pass its stage', () => {
  const r = walk({ review: { result: 'failed' }, retro: null });
  assert.equal(stageOf(r, 'review').state, 'failed');
  assert.equal(stageOf(r, 'review').reasonCode, 'header-failed');
  assert.deepEqual(stageOf(r, 'review').params, { attempt: 1, failures: 1, ceiling: 2 });
  assert.equal(r.next.stage, 'implementation');
  assert.equal(r.next.reasonCode, 'fix-after-failure');
  assert.equal(r.end, null);
  assert.equal(stageOf(r, 'delivery').state, 'blocked');
  assert.equal(stageOf(r, 'retro').state, 'blocked');
});

test('flow-check stages: not applicable counts as passed', () => {
  const r = walk({ specs: { result: 'not-applicable' }, design: null });
  assert.equal(stageOf(r, 'specs').state, 'not-applicable');
  assert.equal(r.next.stage, 'design');
  assert.equal(r.next.reasonCode, 'no-file');
});

// The shipped declaration with `shipped: false` set on the named stages and their conditions removed (T-2, T-3): a stage a
// project's own declaration marks as not shipped.
const unshippedFlow = (ids) => ({ ...FLOW_DEVKIT, stages: FLOW_DEVKIT.stages.map((s) => (ids.includes(s.id)
  ? { ...Object.fromEntries(Object.entries(s).filter(([k]) => !['appliesWhen', 'notAfter', 'ceiling'].includes(k))), shipped: false } : s)) });

// Invariant (T-2, checker, flow-check.test.mjs): an unshipped role's stage with no file does not apply.
test('flow-check stages: a stage whose role is not shipped and has no file does not apply', () => {
  const r = computeFlow(synth({ mockup: null, decisions: null, design: null }), unshippedFlow(['mockup', 'decisions']), {});
  for (const id of ['mockup', 'decisions']) {
    assert.equal(stageOf(r, id).state, 'not-applicable', id);
    assert.equal(stageOf(r, id).reasonCode, 'role-not-shipped', id);
  }
  assert.equal(stageOf(r, 'mockup').params.role, 'screen-designer');
  assert.equal(r.next.stage, 'design');
});

test('flow-check stages: no stage after the implementation while a task is pending', () => {
  const r = walk({}, { tasks: { exists: true, total: 3, done: 2, pending: ['1.2'] } });
  assert.equal(stageOf(r, 'implementation').state, 'pending');
  assert.equal(stageOf(r, 'implementation').reasonCode, 'tasks-pending');
  assert.deepEqual(stageOf(r, 'implementation').params, { count: 1, ids: ['1.2'] });
  assert.equal(r.next.stage, 'implementation');
  assert.equal(r.next.role, 'tdd-implementer');
  for (const id of ['evidence', 'review', 'delivery', 'retro']) assert.equal(stageOf(r, id).state, 'blocked', id);
});

test('flow-check stages: uncommitted product changes keep the implementation pending', () => {
  const root = liveChange();
  put(root, { 'src/b.ts': 'b\n' });
  const r = liveReport(root);
  assert.equal(stageOf(r, 'implementation').state, 'pending');
  assert.equal(stageOf(r, 'implementation').reasonCode, 'uncommitted');
  assert.equal(r.next.stage, 'implementation');
});

test('flow-check stages: a fenced example in tasks.md does not hold the implementation', () => {
  const root = liveChange({ tasks: '# Tasks\n\n- [x] 1.1 a\n\n```md\n- [ ] 9.9 an example\n```\n' });
  put(root, { 'openspec/changes/feat/evidence.md': '<!-- devkit-stage evidence result=pending attempt=1 commit=none -->\nCommit: <sha>\n' });
  const r = liveReport(root);
  assert.equal(stageOf(r, 'implementation').state, 'passed');
  assert.deepEqual(stageOf(r, 'implementation').params, { total: 1, done: 1 });
  assert.equal(r.next.stage, 'evidence');
});

test('flow-check stages: a stale stage is the only one offered again', () => {
  const root = liveChange();
  put(root, { 'src/a.ts': 'a\n' });
  const c2 = commitAll(root, 'product');
  put(root, { 'openspec/changes/feat/review.md': `<!-- devkit-stage review result=passed attempt=1 commit=${c2} -->\n# Review\n` });
  const r = liveReport(root);
  assert.equal(stageOf(r, 'implementation').state, 'passed');
  assert.equal(stageOf(r, 'evidence').state, 'stale');
  assert.equal(stageOf(r, 'evidence').reasonCode, 'stale-code');
  assert.equal(stageOf(r, 'review').state, 'passed');
  assert.equal(r.next.stage, 'evidence');
  assert.equal(r.next.reasonCode, 'stale-code');
});

test('flow-check stages: a plan file newer than readiness makes readiness stale', () => {
  const r = walk({ design: { at: 10_000 } });
  assert.equal(stageOf(r, 'readiness').state, 'stale');
  assert.equal(stageOf(r, 'readiness').reasonCode, 'stale-plan');
  assert.equal(stageOf(r, 'readiness').params.by, 'design');
  assert.equal(r.next.stage, 'readiness');
  // Within the 2 s tolerance the readiness is current.
  assert.equal(stageOf(walk({ design: { at: 1_500 } }), 'readiness').state, 'passed');
});

test('flow-check stages: ticking tasks after the plan review does not make the plan stale', () => {
  const r = walk({ tasks: { at: 60_000 } }, { tasks: { exists: true, total: 3, done: 1, pending: ['1.2', '1.3'] } });
  assert.equal(stageOf(r, 'readiness').state, 'passed');
  assert.equal(r.next.stage, 'implementation');
});

test('flow-check stages: a failed stage past its ceiling ends blocked', () => {
  const r = walk({ review: { result: 'failed', attempt: 2 } });
  assert.equal(r.next, null);
  assert.equal(r.end.state, 'blocked');
  assert.equal(r.end.stage, 'review');
  assert.equal(r.end.reasonCode, 'ceiling-reached');
  assert.deepEqual(r.end.params, { stage: 'review', attempt: 2, failures: 2, ceiling: 2 });
  assert.equal(walk({ review: { result: 'failed', attempt: 1 } }).end, null);
});

test('flow-check stages: a failed stage offers its fix, then itself after the fix', () => {
  const failed = { review: { result: 'failed', commit: 'c111111' } };
  const before = walk(failed);
  assert.equal(before.next.stage, 'implementation');
  assert.equal(before.next.reasonCode, 'fix-after-failure');
  assert.deepEqual(before.next.params, { failed: 'review', attempt: 1, failures: 1, ceiling: 2 });
  const after = walk(failed, { staleness: (sha) => (sha === 'c111111' ? 'c111111 is behind c222222' : null) });
  assert.equal(stageOf(after, 'review').state, 'failed');
  assert.equal(after.next.stage, 'review');
  assert.equal(after.next.reasonCode, 'rerun-after-fix');
});

test('flow-check stages: the same stage with nothing changed ends blocked', () => {
  const root = liveChange({ review: 'failed' });
  const first = liveReport(root);
  assert.equal(first.next.stage, 'implementation');
  assert.match(first.next.progressKey, /^implementation@[0-9a-f]{12}$/);
  assert.equal(liveReport(root).next.progressKey, first.next.progressKey, 'the key is stable');
  const same = liveReport(root, first.next.progressKey);
  assert.equal(same.next, null);
  assert.equal(same.end.state, 'blocked');
  assert.equal(same.end.reasonCode, 'no-progress');
  assert.equal(same.end.stage, 'implementation');
  put(root, { 'src/a.ts': 'one edit\n' });
  const moved = liveReport(root, first.next.progressKey);
  assert.equal(moved.end, null);
  assert.equal(moved.next.stage, 'implementation');
  assert.notEqual(moved.next.progressKey, first.next.progressKey);
  // Bytes inside an already untracked file move it; so does an edit of a tracked file.
  put(root, { 'src/a.ts': 'another edit\n' });
  const rewritten = liveReport(root, first.next.progressKey).next.progressKey;
  assert.notEqual(rewritten, moved.next.progressKey);
  put(root, { 'openspec/config.yaml': 'schema: devkit\n# edited\n' });
  const tracked = liveReport(root, first.next.progressKey).next.progressKey;
  assert.notEqual(tracked, rewritten);
  // A file under .claude/ is not work: once listed, its bytes leave the key alone.
  put(root, { '.claude/scratch.md': 'one\n' });
  const listed = liveReport(root, first.next.progressKey).next.progressKey;
  put(root, { '.claude/scratch.md': 'two\n' });
  assert.equal(liveReport(root, first.next.progressKey).next.progressKey, listed);
});

test('flow-check stages: the owner\'s approval and an unanswered retro wait for the owner', () => {
  const noApproval = walk({ approval: null });
  assert.equal(noApproval.next, null);
  assert.equal(noApproval.end.state, 'waiting-for-owner');
  assert.equal(noApproval.end.stage, 'approval');
  assert.equal(noApproval.end.reasonCode, 'owner-pending');
  const pendingApproval = walk({ approval: { result: 'pending' } });
  assert.equal(pendingApproval.end.state, 'waiting-for-owner');
  const retro = walk({ retro: { result: 'pending' } });
  assert.equal(retro.next, null);
  assert.equal(retro.end.state, 'waiting-for-owner');
  assert.equal(retro.end.stage, 'retro');
  // A retro with no file yet is the coordinator's to write.
  assert.equal(walk({ retro: null }).next.stage, 'retro');
});

test('flow-check stages: a stale approval waits for the owner', () => {
  const r = walk({ readiness: { at: 10_000 } });
  assert.equal(stageOf(r, 'approval').state, 'stale');
  assert.equal(r.next, null);
  assert.equal(r.end.state, 'waiting-for-owner');
  assert.equal(r.end.stage, 'approval');
  assert.equal(r.end.reasonCode, 'approval-stale');
  // A failed approval is not a stale one.
  const failed = walk({ approval: { result: 'failed' } });
  assert.equal(failed.end.state, 'waiting-for-owner');
  assert.equal(failed.end.stage, 'approval');
  assert.equal(failed.end.reasonCode, 'no-role');
});

test('flow-check stages: a stage file with no header, a bad header or another stage\'s header is pending', () => {
  const cases = [
    ['no-header', { header: null }, {}],
    ['bad-header', { header: { malformed: true } }, {}],
    ['header-other-stage', { header: { stage: 'proposal', result: 'passed', attempt: 1, commit: 'c000000' } }, { found: 'proposal' }],
  ];
  for (const [code, review, params] of cases) {
    const r = walk({ review });
    const st = stageOf(r, 'review');
    assert.equal(st.state, 'pending', code);
    assert.equal(st.reasonCode, code);
    assert.deepEqual(st.params, { file: 'review.md', ...params }, code);
    assert.equal(r.next.stage, 'review', code);
    assert.equal(r.next.reasonCode, code);
    assert.equal(stageOf(r, 'delivery').state, 'blocked', code);
  }
});

test('flow-check stages: a stage of several files takes the worst result of its files', () => {
  const two = (a, b) => walk({ specs: { files: [a, b] } });
  const pendingOne = two({ result: 'passed' }, { result: 'pending' });
  assert.equal(stageOf(pendingOne, 'specs').state, 'pending');
  assert.equal(stageOf(pendingOne, 'specs').reasonCode, 'not-judged');
  assert.equal(pendingOne.next.stage, 'specs');
  const failedOne = two({ result: 'passed' }, { result: 'failed' });
  assert.equal(stageOf(failedOne, 'specs').state, 'failed');
  assert.equal(stageOf(failedOne, 'specs').reasonCode, 'header-failed');
  assert.equal(two({ result: 'failed' }, { result: 'pending' }).stages.find((s) => s.id === 'specs').state, 'failed');
  const mixed = two({ result: 'passed' }, { result: 'not-applicable' });
  assert.equal(stageOf(mixed, 'specs').state, 'passed');
  const none = two({ result: 'not-applicable' }, { result: 'not-applicable' });
  assert.equal(stageOf(none, 'specs').state, 'not-applicable');
  assert.equal(none.next.reasonCode, 'archive');
  // A header in the second file that is not specs' own is read too.
  const other = two({ result: 'passed' }, { header: null });
  assert.equal(stageOf(other, 'specs').reasonCode, 'no-header');
});

test('flow-check stages: staleness is read for every file of a stage, not the first', () => {
  const codeBound = { ...FLOW_DEVKIT, stages: FLOW_DEVKIT.stages.map((s) => (s.id === 'specs' ? { ...s, codeBound: true } : s)) };
  const staleSecond = computeFlow(synth({ specs: { files: [{ commit: 'c000000' }, { commit: 'c111111' }] } }, { staleness: (sha) => (sha === 'c111111' ? 'behind' : null) }), codeBound, {});
  assert.equal(stageOf(staleSecond, 'specs').state, 'stale');
  assert.equal(stageOf(staleSecond, 'specs').reasonCode, 'stale-code');
  assert.equal(staleSecond.next.stage, 'specs');
  // A plan file stale for readiness only through the second spec file.
  const late = walk({ specs: { files: [{ at: 0 }, { at: 10_000 }] } });
  assert.equal(stageOf(late, 'readiness').state, 'stale');
  assert.equal(stageOf(late, 'readiness').params.by, 'specs');
  assert.equal(stageOf(walk({ specs: { files: [{ at: 0 }, { at: 1_000 }] } }), 'readiness').state, 'passed');
});

test('flow-check stages: after a merged pull request a newer plan file does not make a stage stale', () => {
  const newerDesign = { design: { at: 10_000 } };
  const control = walk(newerDesign);
  assert.equal(stageOf(control, 'readiness').state, 'stale');
  assert.equal(stageOf(control, 'readiness').reasonCode, 'stale-plan');
  const merged = walk(newerDesign, { postMerge: true });
  assert.equal(stageOf(merged, 'readiness').state, 'passed');
  assert.equal(merged.next.reasonCode, 'archive');
});

test('flow-check stages: an artifact that OpenSpec reports skipped does not apply', () => {
  const r = walk({ mockup: null }, { skipped: ['mockup'] });
  assert.equal(stageOf(r, 'mockup').state, 'not-applicable');
  assert.equal(stageOf(r, 'mockup').reasonCode, 'skipped');
  assert.equal(r.next.reasonCode, 'archive');
  const withFile = walk({}, { skipped: ['design'] });
  assert.equal(stageOf(withFile, 'design').reasonCode, 'skipped');
});

test('flow-check stages: a code-bound stage whose header records no commit is stale', () => {
  const root = liveChange();
  put(root, { 'openspec/changes/feat/evidence.md': '<!-- devkit-stage evidence result=passed attempt=1 commit=none -->\n# Evidence\n' });
  commitAll(root, 'evidence with no commit');
  const r = liveReport(root);
  assert.equal(stageOf(r, 'evidence').state, 'stale');
  assert.equal(stageOf(r, 'evidence').reasonCode, 'stale-code');
  assert.match(stageOf(r, 'evidence').params.why, /no commit/);
  assert.equal(r.next.stage, 'evidence');
});

test('flow-check parity: each stage file of flow.json is the generates of its artifact in schema.yaml', () => {
  for (const schema of ['devkit', 'devkit-lite']) {
    const flow = JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, schema, 'flow.json'), 'utf8'));
    const yaml = readFileSync(join(PLUGIN_SCHEMAS, schema, 'schema.yaml'), 'utf8');
    const generates = new Map();
    let id = null;
    for (const line of yaml.split('\n')) {
      const m = /^  - id:\s*(\S+)/.exec(line);
      if (m) id = m[1];
      const g = /^    generates:\s*["']?([^"'\s]+)["']?/.exec(line);
      if (g && id) generates.set(id, g[1]);
    }
    const artifacts = flow.stages.filter((s) => s.source === 'artifact');
    assert.ok(artifacts.length > 0, schema);
    for (const s of artifacts) assert.equal(s.file, generates.get(s.id), `${schema}: ${s.id}`);
  }
});

// Invariant (T-3, checker, flow-check.test.mjs): a pending file no shipped role can finish waits for the owner.
test('flow-check stages: a pending file of an unshipped role waits for the owner', () => {
  const declared = unshippedFlow(['mockup', 'decisions', 'unit-tests']);
  for (const id of ['decisions', 'mockup', 'unit-tests']) {
    const r = computeFlow(synth({ [id]: { result: 'pending' } }), declared, {});
    assert.equal(r.next, null, id);
    assert.equal(r.end.state, 'waiting-for-owner', id);
    assert.equal(r.end.stage, id);
    assert.equal(r.end.reasonCode, 'unshipped-role-pending', id);
  }
  // No next stage across these fixtures names the owner or an unshipped role.
  const fixtures = [
    {}, { approval: null }, { approval: { result: 'failed' } }, { readiness: { at: 10_000 } }, { mockup: { result: 'pending' } },
    { 'unit-tests': { result: 'failed' } }, { 'unit-tests': { result: 'failed', commit: 'c111111' } }, { review: { result: 'failed' } },
    { decisions: { header: null } }, { retro: { result: 'pending' } }, { requirements: { result: 'pending' } },
  ];
  const byId = Object.fromEntries(declared.stages.map((s) => [s.id, s]));
  for (const over of fixtures) {
    const r = computeFlow(synth(over, { staleness: (sha) => (sha === 'c111111' ? 'behind' : null) }), declared, {});
    if (r.next) {
      assert.notEqual(r.next.role, 'owner', JSON.stringify(over));
      assert.notEqual(byId[r.next.stage].shipped, false, JSON.stringify(over));
    }
  }
});

test('flow-check stages: an archived change ends archived', () => {
  const r = computeFlow({ id: 'feat', schema: 'devkit', archived: true }, FLOW_DEVKIT, {});
  assert.equal(r.version, 1);
  assert.equal(r.script, 'current');
  assert.deepEqual(r.stages, []);
  assert.equal(r.next, null);
  assert.equal(r.end.state, 'archived');
  assert.equal(r.end.reasonCode, 'archived');
});

test('flow-check stages: a schema that is neither shipped nor declared is a usage error', () => {
  const root = gitRepo({ config: 'schema: weird\n', changes: { feat: { '.openspec.yaml': 'schema: weird\n' } } });
  assert.throws(() => collectFlow(root, 'feat', { openspec: () => { throw new Error('not asked'); } }), FlowUsageError);
});

// ---- AC-7: a change begun under the previous script

test('flow-check AC-7: a folder in the previous form is recognised', () => {
  const root = liveChange({ headerless: true });
  const r = liveReport(root);
  assert.equal(r.script, 'previous');
  assert.deepEqual(r.stages, []);
  assert.equal(r.next, null);
  assert.equal(r.end, null);
  assert.equal(r.previous.reasonCode, 'previous-script');
  assert.equal(r.previous.finishedBy, 'ship-change');
  // One headed file makes it current; a change with no stage file yet is current too.
  const files = synth({ requirements: { header: null }, proposal: { header: null } }).files;
  const headless = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.map((f) => ({ ...f, header: null }))]));
  assert.equal(computeFlow({ ...synth(), files: headless }, FLOW_DEVKIT, {}).script, 'previous');
  const none = Object.fromEntries(Object.keys(files).map((k) => [k, []]));
  assert.equal(computeFlow({ ...synth(), files: none }, FLOW_DEVKIT, {}).script, 'current');
  assert.equal(walk({ proposal: { header: null } }).script, 'current', 'a headed earliest file makes it current');
  assert.equal(walk({ requirements: { header: null } }).script, 'previous', 'a headerless earliest file with later headed ones is the previous script (D-2)');
});

test('flow-check AC-7: a schema without flow.json is the previous script', () => {
  const r = computeFlow(synth(), null, {});
  assert.equal(r.script, 'previous');
  assert.equal(r.previous.reasonCode, 'schema-without-declaration');
  assert.deepEqual(r.stages, []);
  assert.equal(r.next, null);
  assert.equal(r.end, null);
});

// ---- fixtures over a real repository

const DONE_STAGES = ['requirements', 'proposal', 'design', 'tasks', 'readiness', 'approval', 'evidence', 'review', 'retro'];

// A committed devkit change `feat` whose stage files are all passed at the initial commit. `over`:
// `review` a result, `reviewAttempt` its attempt, `tasks` the text of tasks.md, `headerless` writes no header
// line, `ship` the project's ship mode, `skip` the stage files not written.
function liveChange(over = {}) {
  const config = over.config ?? `schema: devkit\n${over.ship ? `ship:\n  devkit: ${over.ship}\n` : ''}`;
  const root = gitRepo({ config });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const text = (id, result = 'passed', body = `# ${id}\n`) => `${over.headerless ? '' : `<!-- devkit-stage ${id} result=${result} attempt=${id === 'review' ? (over.reviewAttempt ?? 1) : 1} commit=${c0} -->\n`}${body}`;
  const files = { '.openspec.yaml': 'schema: devkit\n', 'specs/s/spec.md': text('specs') };
  for (const id of DONE_STAGES.filter((x) => !(over.skip ?? []).includes(x))) files[`${id}.md`] = text(id, id === 'review' ? (over.review ?? 'passed') : 'passed', id === 'tasks' ? (over.tasks ?? '# Tasks\n\n- [x] 1.1 a\n- [x] 1.2 b\n') : undefined);
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/feat/${f}`, b])));
  commitAll(root, 'change files');
  return root;
}

// What `openspec status` and `openspec instructions apply` would say about the change (OpenSpec counts fenced lines).
function fakeOpenspec(root, id = 'feat') {
  const dir = join(root, 'openspec', 'changes', id);
  return (args) => {
    const flow = readFlow(root, 'devkit');
    if (args[0] === 'status') {
      const artifacts = flow.stages.filter((s) => s.source === 'artifact').map((s) => ({ id: s.id, outputPath: s.file, status: existsSync(join(dir, s.file)) ? 'done' : 'ready', requires: [] }));
      return { status: 0, stdout: JSON.stringify({ changeName: id, schemaName: 'devkit', artifacts }), stderr: '' };
    }
    const tasksFile = join(dir, 'tasks.md');
    const lines = existsSync(tasksFile) ? readFileSync(tasksFile, 'utf8').split('\n') : [];
    const tasks = [];
    lines.forEach((l, i) => { const m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(l); if (m) tasks.push({ id: String(tasks.length + 1), description: m[2], done: m[1] !== ' ', sourcePath: 'tasks.md', line: i + 1 }); });
    return { status: 0, stdout: JSON.stringify({ state: 'blocked', tasks }), stderr: '' };
  };
}

function liveReport(root, after) {
  const { facts, flow } = collectFlow(root, 'feat', { openspec: fakeOpenspec(root) });
  return computeFlow(facts, flow, { after });
}

// ---------------------------------------------------------------- the delivery, the command line and the readout (phase 5)

const prView = (head, over = {}) => ({ number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: head, baseRefName: 'main', mergeable: 'MERGEABLE', body: '', autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over });
const check = (name, bucket) => ({ name, state: bucket.toUpperCase(), bucket, link: `https://ci/${name}` });
const NO_PR = { exit: 1, stderr: 'no pull requests found for branch "feat"\n' };

// A live change whose stages before the delivery all passed, on branch `feat`, with a fake gh. `gh(head, set)` fills the fixtures.
function deliveryReport({ ship = 'merge', fill = () => {}, branch = 'feat' } = {}) {
  const root = liveChange({ ship });
  if (branch !== 'main') git(root, 'checkout', '-q', '-b', branch);
  const gh = fakeGh();
  fill(gh.set.bind(gh), git(root, 'rev-parse', 'HEAD'));
  const env = { ...gh.env, ...SHIP_ENV };
  const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
  return { report: computeFlow(facts, flow, {}), gh, root };
}
const outcome = (r) => (r.next ? { next: r.next.stage, reasonCode: r.next.reasonCode } : { end: r.end.state, reasonCode: r.end.reasonCode });

// The GitHub answers of a merged pull request #12 that is the change's own with every task ticked on the default
// branch (field-fixes D-4: the files say whose it is, tasks.md on the default branch says it is done).
const ownMerged = (set) => {
  set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  set(PR_FILES_KEY(12), filesFixture(['openspec/changes/feat/tasks.md', 'src/a.ts']));
  set(TASKS_ON_KEY('feat'), tasksFixture(tasksText({ ticked: ['1.1', '1.2'] })));
};

const DELIVERY_ROWS = [
  ['ship plan waits for the owner', { ship: 'plan' }, { end: 'waiting-for-owner', reasonCode: 'ship-plan' }],
  ['a gh error blocks', { fill: (set) => set('pr-view', { exit: 1, stderr: 'HTTP 502: bad gateway\n' }) }, { end: 'blocked', reasonCode: 'gh-error' }],
  ['no pull request offers the delivery', { fill: (set) => { set('pr-view', NO_PR); set('pr-list', { stdout: [] }); } }, { next: 'delivery', reasonCode: 'no-pr' }],
  ['a head that is not local HEAD offers the delivery', { fill: (set) => set('pr-view', { stdout: prView('1'.repeat(40)) }) }, { next: 'delivery', reasonCode: 'not-pushed' }],
  ['unreadable checks block', { fill: (set, head) => { set('pr-view', { stdout: prView(head) }); set('pr-checks', { exit: 1, stderr: 'HTTP 502: bad gateway\n' }); } }, { end: 'blocked', reasonCode: 'checks-unreadable' }],
  ['a failing check offers the implementation', { fill: (set, head) => { set('pr-view', { stdout: prView(head) }); set('pr-checks', { exit: 1, stdout: [check('build', 'fail'), check('lint', 'pass')] }); } }, { next: 'implementation', reasonCode: 'check-failing' }],
  ['a pending check waits on GitHub', { fill: (set, head) => { set('pr-view', { stdout: prView(head) }); set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }); } }, { end: 'waiting-on-github', reasonCode: 'checks-pending' }],
  ['a green pull request in pr mode waits for the owner to merge', { ship: 'pr', fill: (set, head) => { set('pr-view', { stdout: prView(head) }); set('pr-checks', { stdout: [check('build', 'pass')] }); } }, { end: 'waiting-for-owner', reasonCode: 'owner-merges' }],
  ['a green pull request with auto-merge on waits on GitHub', { fill: (set, head) => { set('pr-view', { stdout: prView(head, { autoMergeRequest: { enabledAt: 'x' } }) }); set('pr-checks', { stdout: [check('build', 'pass')] }); } }, { end: 'waiting-on-github', reasonCode: 'auto-merge-on' }],
  ['a green pull request with auto-merge off offers the delivery', { fill: (set, head) => { set('pr-view', { stdout: prView(head) }); set('pr-checks', { stdout: [check('build', 'pass')] }); } }, { next: 'delivery', reasonCode: 'enable-auto-merge' }],
  ['a merged pull request passes the delivery and the walk goes to the archive', { fill: (set, head) => { set('pr-view', { stdout: prView(head, { state: 'MERGED' }) }); ownMerged(set); } }, { next: 'retro', reasonCode: 'archive' }],
  ['a closed pull request blocks', { fill: (set, head) => set('pr-view', { stdout: prView(head, { state: 'CLOSED' }) }) }, { end: 'blocked', reasonCode: 'pr-closed' }],
];
for (const [row, opts, want] of DELIVERY_ROWS) {
  test(`flow-check delivery: ${row}`, () => {
    const { report, gh } = deliveryReport(opts);
    assert.deepEqual(outcome(report), want);
    assert.equal(report.stages.find((s) => s.id === 'review').state, 'passed');
    if (opts.ship === 'plan') assert.deepEqual(gh.calls(), [], 'ship plan reads nothing from GitHub');
    if (want.reasonCode === 'check-failing') assert.match(report.next.reason, /build/);
    if (want.end === 'waiting-on-github' && want.reasonCode === 'auto-merge-on') assert.match(report.end.reason, /GitHub to merge/);
  });
}

// ---- gh-version: a gh older than 2.50.0 ends with its own reason (AC-4, AC-5)

const OLD_GH_FILL = (version) => (set, head) => {
  set('pr-view', { stdout: prView(head) });
  set('pr-checks', { exit: 1, stderr: 'unknown flag: --json\n\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]\n' });
  if (version) set('version', version);
};

test('gh-version 10: an old gh ends blocked gh-too-old and the readout names both versions (AC-4)', () => {
  const { report, root } = deliveryReport({ fill: OLD_GH_FILL({ stdout: 'gh version 2.46.0 (2024-03-18)\n' }) });
  assert.deepEqual(outcome(report), { end: 'blocked', reasonCode: 'gh-too-old' });
  assert.deepEqual(report.end.params, { installed: '2.46.0', minimum: '2.50.0' });
  const flow = readFlow(root, 'devkit');
  for (const lang of ['en', 'pt-BR']) {
    const text = renderText(report, flow, lang);
    assert.ok(text.includes('2.46.0') && text.includes('2.50.0'), `${lang}: ${text}`);
    assert.ok(!text.includes('the checks cannot be read') && !text.includes('não foi possível ler os checks:'), `${lang}: ${text}`);
  }
});

test('gh-version 11: an unreadable gh version reads as unknown in both languages (AC-5)', () => {
  const { report } = deliveryReport({ fill: OLD_GH_FILL({ exit: 1, stderr: 'boom\n' }) });
  assert.deepEqual(outcome(report), { end: 'blocked', reasonCode: 'gh-too-old' });
  assert.equal(report.end.params.installed, null);
  assert.ok(reasonText('en', 'gh-too-old', report.end.params, {}).includes('unknown version'));
  assert.ok(reasonText('pt-BR', 'gh-too-old', report.end.params, {}).includes('versão desconhecida'));
});

test('flow-check delivery: after a squash merge the walk resumes at the retro', () => {
  const root = liveChange({ ship: 'merge', skip: ['retro'] });
  for (const f of ['evidence.md', 'review.md']) {
    const file = join(root, 'openspec', 'changes', 'feat', f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+/, 'commit=deadbee'));
  }
  commitAll(root, 'headers of squashed commits');
  const merged = { number: 12, url: 'https://github.com/o/r/pull/12', state: 'MERGED', headRefOid: 'f'.repeat(40), baseRefName: 'main', mergeable: 'UNKNOWN', autoMergeRequest: null, mergeStateStatus: 'UNKNOWN', headRefName: 'feat', mergedAt: '2026-11-19T10:00:00Z', body: 'evidence: openspec/changes/feat/evidence.md' };
  const reportWith = (list) => {
    const gh = fakeGh();
    gh.set('pr-list-state-merged', { stdout: list });
    ownMerged(gh.set.bind(gh));
    const env = { ...gh.env, ...SHIP_ENV };
    const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
    return computeFlow(facts, flow, {});
  };
  const after = reportWith([merged]);
  assert.deepEqual(outcome(after), { next: 'retro', reasonCode: 'no-file' });
  for (const id of ['tasks', 'evidence', 'review', 'delivery']) assert.equal(after.stages.find((s) => s.id === id).state, 'passed', id);
  // Without the merged pull request the same files read as stale: the header commits are not ancestors.
  const before = reportWith([]);
  assert.equal(before.stages.find((s) => s.id === 'evidence').state, 'stale');
  assert.equal(before.next.stage, 'evidence');
});

test('flow-check delivery: a merged pull request seen from the change\'s own branch keeps the staleness checks', () => {
  const root = liveChange({ ship: 'merge', skip: ['retro'] });
  for (const f of ['evidence.md', 'review.md']) {
    const file = join(root, 'openspec', 'changes', 'feat', f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+/, 'commit=deadbee'));
  }
  commitAll(root, 'headers of squashed commits');
  const report = (branch) => {
    git(root, 'checkout', '-q', ...(branch === 'main' ? [] : ['-B']), branch);
    const gh = fakeGh();
    gh.set('pr-view', { stdout: prView(git(root, 'rev-parse', 'HEAD'), { state: 'MERGED', headRefName: 'feat' }) });
    gh.set('pr-list-state-merged', { stdout: [prView('f'.repeat(40), { state: 'MERGED', headRefName: 'feat', body: 'evidence: openspec/changes/feat/evidence.md' })] });
    ownMerged(gh.set.bind(gh));
    const env = { ...gh.env, ...SHIP_ENV };
    const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
    return computeFlow(facts, flow, {});
  };
  const own = report('feat');
  assert.equal(own.stages.find((s) => s.id === 'evidence').state, 'stale');
  assert.equal(own.next.stage, 'evidence');
  const off = report('main');
  assert.equal(off.stages.find((s) => s.id === 'evidence').state, 'passed');
});

// ---- merge-staleness-first-parent: the stage readout reads a merge of main by what it brought in

// liveChange() on main; feat with a product commit R, the evidence and review headers rewritten to R; the base's file
// on main; then main merged into feat. Returns the readout's stages.
function mergedReadout(baseFile) {
  const root = liveChange({ ship: 'plan' });
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': 'changed\n' });
  const R = commitAll(root, 'product commit');
  for (const f of ['evidence.md', 'review.md']) {
    const file = join(root, 'openspec', 'changes', 'feat', f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+/, `commit=${R}`));
  }
  commitAll(root, 'headers at the product commit');
  git(root, 'switch', '-q', 'main');
  put(root, { [baseFile]: 'b\n' });
  commitAll(root, 'base commit');
  git(root, 'switch', '-q', 'feat');
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
  const gh = fakeGh();
  const env = { ...gh.env, ...SHIP_ENV };
  const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
  return computeFlow(facts, flow, {});
}

test('merge-staleness 9: the stage readout keeps evidence and review passed after a merge of main that brings only openspec/', () => {
  const report = mergedReadout('openspec/changes/other/notes.md');
  for (const id of ['evidence', 'review']) assert.equal(report.stages.find((s) => s.id === id).state, 'passed', id);
});

test('merge-staleness 10: the stage readout reports evidence stale after a merge of main that brings a product file', () => {
  const report = mergedReadout('src/base.ts');
  const evidence = report.stages.find((s) => s.id === 'evidence');
  assert.equal(evidence.state, 'stale');
  assert.equal(evidence.reasonCode, 'stale-code');
  assert.equal(report.next.stage, 'evidence');
});

// ---- stale-only-on-own-files: the stage readout reads a merge of origin/main by the change's own files

// liveChange() on main with src/a.ts committed; feat edits its first line (R), the unit-tests, evidence and review
// headers are rewritten to R; main edits src/a.ts's last line (an own file) or src/base.ts (not one); origin/main is
// set to main's tip, then main is merged into feat. Returns the readout and the merge sha.
// With `base` other than main, origin/<base> is that tip and origin/main the commit before it, so a run that judges
// against main finds the base commit off its base; `config` replaces the project's config.yaml and `env` is added to the run's.
function ownMergedReadout(baseFile, { base = 'main', config = null, env: extraEnv = {} } = {}) {
  const lines = (first, last) => Array.from({ length: 12 }, (_, i) => (i === 0 ? first : i === 11 ? last : `line ${i + 1}`)).join('\n') + '\n';
  const root = liveChange({ ship: 'plan', config });
  put(root, { 'src/a.ts': lines('line 1', 'line 12') });
  commitAll(root, 'product file on main');
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': lines('branch 1', 'line 12'), 'openspec/changes/feat/unit-tests.md': '<!-- devkit-stage unit-tests result=passed attempt=1 commit=none -->\n# unit-tests\n' });
  const R = commitAll(root, 'product commit');
  for (const f of ['unit-tests.md', 'evidence.md', 'review.md']) {
    const file = join(root, 'openspec', 'changes', 'feat', f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+|commit=none/, `commit=${R}`));
  }
  commitAll(root, 'headers at the product commit');
  git(root, 'switch', '-q', 'main');
  put(root, { [baseFile]: baseFile === 'src/a.ts' ? lines('line 1', 'main 12') : 'b\n' });
  commitAll(root, 'base commit');
  git(root, 'update-ref', `refs/remotes/origin/${base}`, git(root, 'rev-parse', 'HEAD'));
  if (base !== 'main') git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD~1'));
  git(root, 'switch', '-q', 'feat');
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
  const merged = git(root, 'rev-parse', 'HEAD');
  const gh = fakeGh();
  const env = { ...gh.env, ...SHIP_ENV, ...extraEnv };
  const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
  return { report: computeFlow(facts, flow, {}), merged };
}

test('own-files AC-1 stages: an unrelated merge of origin/main keeps unit-tests, evidence and review passed', () => {
  const { report } = ownMergedReadout('src/base.ts');
  for (const id of ['unit-tests', 'evidence', 'review']) assert.equal(stageOf(report, id).state, 'passed', id);
});

const OWN_FLOW_TWO_PRS = 'schema: devkit\ndevkit:\n  delivery:\n    model: two-prs\n    base: develop\n    test_branch: staging\n';
const ownStages = (report) => ['unit-tests', 'evidence', 'review'].map((id) => stageOf(report, id).state);

test('own-files AC-7 stages: the configured base (two-prs) is the branch collectFlow exempts the merge of, not main', () => {
  const current = ownMergedReadout('src/base.ts', { base: 'develop', config: OWN_FLOW_TWO_PRS });
  assert.deepEqual(ownStages(current.report), ['passed', 'passed', 'passed'], 'base develop: the unrelated merge keeps the stages');
  const viaMain = ownMergedReadout('src/base.ts', { base: 'develop', config: 'schema: devkit\nship:\n  devkit: plan\n' });
  assert.equal(stageOf(viaMain.report, 'unit-tests').state, 'stale', 'without the configured base the main fallback judges the same repository stale');
});

test('own-files AC-7 stages: GITHUB_BASE_REF is the base collectFlow exempts the merge of, ahead of main', () => {
  const via = ownMergedReadout('src/base.ts', { base: 'develop', env: { GITHUB_BASE_REF: 'develop' } });
  assert.deepEqual(ownStages(via.report), ['passed', 'passed', 'passed'], 'GITHUB_BASE_REF=develop');
  assert.equal(stageOf(ownMergedReadout('src/base.ts', { base: 'develop' }).report, 'unit-tests').state, 'stale', 'the same repository without it falls back to main');
});

test('own-files AC-2 stages: an own-file merge reports the first code-bound stage stale-code naming the merge', () => {
  const { report, merged } = ownMergedReadout('src/a.ts');
  const first = report.stages.find((s) => s.state === 'stale');
  assert.equal(first.id, 'unit-tests');
  assert.equal(first.reasonCode, 'stale-code');
  assert.match(first.params.why, new RegExp(`is behind ${merged.slice(0, 7)}, which touches src/a\\.ts$`));
  assert.equal(report.next.stage, 'unit-tests');
});

// ---- field-fixes 4: a merged pull request delivers only when it is the change's own and every task is ticked

const MERGED_OWN = { number: 12, url: 'https://github.com/o/r/pull/12', state: 'MERGED', headRefOid: 'f'.repeat(40), baseRefName: 'main', mergeable: 'UNKNOWN', autoMergeRequest: null, mergeStateStatus: 'UNKNOWN', headRefName: 'feat', mergedAt: '2026-11-19T10:00:00Z', body: 'evidence: openspec/changes/feat/evidence.md' };
const repoMain = { stdout: { default_branch: 'main' } };

// The rules of the default branch and the rollup of merged pull request #12, as the forced-merge read asks for them.
const REQUIRED_RULES = { stdout: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }] };
const NO_CLASSIC = { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' };
const runOf = (name, conclusion) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion });

test('field-fixes 4 delivered: a merged pull request with tasks left is not delivered; the next stage is the implementation naming the pull request and the tasks', () => {
  const { report } = deliveryReport({ branch: 'main', fill: (set) => {
    set('pr-list-state-merged', { stdout: [MERGED_OWN] });
    set('api-GET-repos__owner___repo_', repoMain);
    set(PR_FILES_KEY(12), filesFixture(['openspec/changes/feat/tasks.md', 'src/a.ts']));
    set(TASKS_ON_KEY('feat'), tasksFixture(tasksText({ ticked: ['1.1'], unticked: ['3.1', '3.2'] })));
    // Every required check was green on the merged head: not an owner's forced merge, so the readout keeps its partial-merge answer.
    set('api-GET-repos__owner___repo__rules_branches_main', REQUIRED_RULES);
    set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', NO_CLASSIC);
    set('pr-view-12', { stdout: { statusCheckRollup: [runOf('check', 'SUCCESS'), runOf('devkit-reviews', 'SUCCESS')] } });
  } });
  assert.deepEqual(outcome(report), { next: 'implementation', reasonCode: 'tasks-left-after-merge' });
  assert.match(report.next.reason, /#12/);
  assert.match(report.next.reason, /3\.1, 3\.2/);
  assert.notEqual(report.stages.find((s) => s.id === 'delivery').state, 'passed');
});

test('forced-merge-path 1: a forced merge read that fails ends the readout blocked gh-error, quoting the error', () => {
  for (const [name, fill] of Object.entries({
    'a rollup read that fails': (set) => set('pr-view-12', { exit: 1, stderr: 'gh: boom\n' }),
    'a rollup with no check list': (set) => set('pr-view-12', { stdout: { number: 12 } }),
  })) {
    const { report } = deliveryReport({ branch: 'main', fill: (set) => {
      set('pr-list-state-merged', { stdout: [MERGED_OWN] });
      set('api-GET-repos__owner___repo_', repoMain);
      set('api-GET-repos__owner___repo__rules_branches_main', REQUIRED_RULES);
      set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', NO_CLASSIC);
      set(PR_FILES_KEY(12), filesFixture(['openspec/changes/feat/tasks.md', 'src/a.ts']));
      set(TASKS_ON_KEY('feat'), tasksFixture(tasksText({ ticked: ['1.1'], unticked: ['3.1'] })));
      fill(set);
    } });
    assert.deepEqual(outcome(report), { end: 'blocked', reasonCode: 'gh-error' }, name);
    assert.match(report.end.params.error, /boom|statusCheckRollup/, name);
  }
});

test('field-fixes 4 delivered: a pull request that only links the evidence does not switch to the walk after the merge', () => {
  const root = liveChange({ ship: 'merge', skip: ['retro'] });
  for (const f of ['evidence.md', 'review.md']) {
    const file = join(root, 'openspec', 'changes', 'feat', f);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+/, 'commit=deadbee'));
  }
  commitAll(root, 'headers of squashed commits');
  const gh = fakeGh();
  gh.set('pr-list-state-merged', { stdout: [MERGED_OWN] });
  gh.set('api-GET-repos__owner___repo_', repoMain);
  gh.prFiles(12, ['docs/notes.md']);
  const env = { ...gh.env, ...SHIP_ENV };
  const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
  const report = computeFlow(facts, flow, {});
  assert.equal(report.stages.find((s) => s.id === 'evidence').state, 'stale', 'the squashed header commits still read as stale');
  assert.notEqual(report.next?.reasonCode, 'archive');
  assert.equal(report.next.stage, 'evidence');
});

// ---- the walk always ends

test('flow-check stages: termination simulation: every run ends in one of four states or names one next stage', () => {
  const failed = (attempt) => ({ result: 'failed', attempt });
  const delivery = (st) => () => (st.delivered ? { state: 'passed' } : st.delivery());
  const fixtures = [
    { over: {} },
    { over: { requirements: null } },
    { over: { design: null, tasks: null } },
    { over: { approval: null } },
    { over: { readiness: failed(1) } },
    { over: { review: failed(1) } },
    { over: { review: failed(2) } },
    { over: {}, tasks: { exists: true, total: 3, done: 2, pending: ['1.2'] } },
    { over: { mockup: null, decisions: null } },
    { over: { retro: null } },
    { over: {}, delivery: () => ({ end: { state: 'waiting-on-github', reasonCode: 'checks-pending', params: { checks: 'build' } } }) },
    { over: {}, opened: false, delivery: () => ({ next: { stage: 'delivery', reasonCode: 'no-pr', params: {} } }) },
  ];
  assert.equal(fixtures.length, 12);
  const STATES = ['archived', 'waiting-for-owner', 'waiting-on-github', 'blocked'];
  let clock = 0;
  for (const [i, fx] of fixtures.entries()) {
    const st = { over: { ...fx.over }, tasks: fx.tasks ?? { exists: true, total: 0, done: 0, pending: [] }, opened: fx.opened ?? true, delivered: false, archived: false, delivery: fx.delivery ?? (() => ({ state: 'passed' })) };
    let ended = false;
    for (let step = 0; step < 40 && !ended; step++) {
      const facts = synth(st.over, { tasks: st.tasks, opened: st.opened, archived: st.archived, staleness: (sha) => (sha === 'old' ? 'behind' : null), delivery: delivery(st) });
      const r = computeFlow(facts, FLOW_DEVKIT, {});
      assert.equal(Boolean(r.next) !== Boolean(r.end), true, `fixture ${i}: exactly one of next and end`);
      for (const part of [...r.stages, r.next ?? r.end]) {
        for (const lang of ['en', 'pt-BR']) assert.equal(typeof TEXT[lang][part.reasonCode], 'function', `${part.reasonCode} in ${lang}`);
      }
      if (r.end) {
        assert.ok(STATES.includes(r.end.state), `fixture ${i}: ${r.end.state}`);
        assert.ok(r.end.reasonCode && r.end.reason, `fixture ${i}: an end has its reason`);
        ended = true;
        break;
      }
      const n = r.next.stage;
      clock += 10000;
      if (n === 'open') st.opened = true;
      else if (n === 'implementation') {
        st.tasks = { exists: true, total: 3, done: 3, pending: [] };
        for (const [id, o] of Object.entries(st.over)) if (o?.result === 'failed') st.over[id] = { ...o, commit: 'old' };
      } else if (n === 'delivery') st.delivered = true;
      else if (n === 'retro' && r.next.reasonCode === 'archive') st.archived = true;
      else st.over[n] = { at: clock };
    }
    assert.ok(ended, `fixture ${i} did not end in 40 steps`);
  }
});

// ---- the command line

const withVersion = (inner) => (args) => (args[0] === '--version' ? { status: 0, stdout: '2.0.0\n', stderr: '' } : inner(args));
const cli = (root, argv, extra = {}) => FC.main(argv, { cwd: root, env: { ...process.env, ...SHIP_ENV }, openspec: withVersion(fakeOpenspec(root)), ...extra });

test('flow-check readout: exit codes', () => {
  const code = (root, ...argv) => cli(root, ['feat', ...argv]).code;
  assert.equal(code(liveChange({ review: 'failed' })), 0, 'a next stage');
  assert.equal(code(gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } })), 0, 'archived');
  assert.equal(code(liveChange({ headerless: true })), 0, 'previous script');
  assert.equal(code(liveChange()), 1, 'waiting: ship plan, the owner opens the pull request');
  assert.equal(code(liveChange({ review: 'failed', reviewAttempt: 2 })), 2, 'blocked: ceiling reached');
  assert.equal(cli(liveChange(), ['nope']).code, 3, 'unknown change');
  const bad = cli(liveChange(), ['feat', '--lang', 'fr', '--json']);
  assert.equal(bad.code, 3);
  assert.equal(JSON.parse(bad.stdout).version, 1);
  assert.match(JSON.parse(bad.stdout).error, /fr/);
  assert.equal(cli(liveChange(), []).code, 3, 'no change id');
});

test('flow-check readout: --json carries the same facts', () => {
  const root = liveChange({ review: 'failed' });
  const r = cli(root, ['feat', '--json']);
  assert.equal(r.code, 0);
  const json = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(json), ['version', 'change', 'schema', 'script', 'head', 'stages', 'next', 'end', 'previous', 'flow']);
  assert.equal(json.version, 1);
  assert.equal(Boolean(json.next) !== Boolean(json.end), true);
  assert.deepEqual(json, JSON.parse(JSON.stringify(liveReport(root))));
  assert.deepEqual(Object.keys(json.stages[0]), ['n', 'id', 'title', 'file', 'state', 'result', 'attempt', 'commit', 'role', 'skills', 'reasonCode', 'params', 'reason']);
  assert.deepEqual(Object.keys(json.next), ['n', 'stage', 'role', 'skills', 'reasonCode', 'params', 'reason', 'progressKey']);
  // --after with the key just printed stops the run.
  const again = JSON.parse(cli(root, ['feat', '--json', '--after', json.next.progressKey]).stdout);
  assert.equal(again.end.reasonCode, 'no-progress');
  assert.equal(cli(root, ['feat', '--json', '--after', json.next.progressKey]).code, 2);
});

// ---- the readout in both languages

// Invariant (T-8, readout, flow-check.test.mjs): the sample change prints the approved readout in both languages, and a stage
// the change was already past when it arrived says so and is never offered.
const SAMPLE_PT = `Change add-csv-export (roteiro devkit)

 1  Abrir a change          passou
 2  Requisitos (grill)      passou
 3  Mock-up de tela         não se aplica: a change já tinha passado da etapa proposta quando esta etapa chegou
 4  Decisões e ADRs         não se aplica: a change já tinha passado da etapa proposta quando esta etapa chegou
 5  Proposta                passou
 6  Specs                   passou
 7  Design                  passou
 8  Tarefas                 passou
 9  Revisão do plano        passou na tentativa 2
10  Aprovação do dono       passou
11  Implementação           passou: 6 de 6 tarefas feitas
12  Testes unitários        não se aplica: a change já tinha passado da etapa demonstração quando esta etapa chegou
13  Testes E2E              não se aplica: a change já tinha passado da etapa demonstração quando esta etapa chegou
14  Demonstração            passou
15  Revisão de código       falhou na tentativa 1; falhas seguidas: 1 de 2
16  Entrega                 bloqueada: espera a etapa 15
17  Retro e arquivo         bloqueada: espera a etapa 16

Próxima etapa: 11 Implementação
Quem executa: tdd-implementer
Por quê: a revisão de código falhou na tentativa 1 (falhas seguidas: 1 de 2) e nada mudou no código desde então; a correção vem antes de uma nova revisão.
`;
const SAMPLE_EN = `Change add-csv-export (devkit script)

 1  Open the change         passed
 2  Requirements (grill)    passed
 3  Screen mock-up          does not apply: the change was already past the proposal when this stage arrived
 4  Decisions and ADRs      does not apply: the change was already past the proposal when this stage arrived
 5  Proposal                passed
 6  Specs                   passed
 7  Design                  passed
 8  Tasks                   passed
 9  Plan readiness          passed at attempt 2
10  Owner's approval        passed
11  Implementation          passed: 6 of 6 tasks done
12  Unit tests              does not apply: the change was already past the demonstration when this stage arrived
13  E2E tests               does not apply: the change was already past the demonstration when this stage arrived
14  Demonstration           passed
15  Code review             failed at attempt 1; failures in a row: 1 of 2
16  Delivery                blocked: waits for stage 15
17  Retro and archive       blocked: waits for stage 16

Next stage: 11 Implementation
Who runs it: tdd-implementer
Why: the code review failed at attempt 1 (failures in a row: 1 of 2) and the code has not changed since; the fix comes before another review.
`;
const PREVIOUS_PT = `Esta change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa. O fluxo de hoje a termina (ship-change, guiado pelo deliver-check). Este comando não para nada.
`;
const PREVIOUS_EN = `This change began under the previous script: its files carry no stage header. Today's flow finishes it (ship-change, led by deliver-check). This command stops nothing.
`;

let sampleCache = null;
// `add-csv-export` (design D-7 and D-12): a devkit change written with the new script, every stage up to the
// demonstration passed, the plan readiness at attempt 2, the code review failed at attempt 1. Invariant (T-22, D-13): the readout of the approved
// sample change reads as the owner approved it; layer: the readout; suite: flow-check. The change records `x-devkit-flow: 2`, as a change opened with
// this release does: with no pin it follows flow 1 under the installed flow 2 and its readout gains the newer-flow line (D-17).
function sampleChange() {
  if (sampleCache) return sampleCache;
  const root = tmpFolder('devkit-flow-check-sample-');
  git(root, 'init', '-q', '-b', 'main');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  run(root, 'bash', INSTALL, '.');
  const c0 = commitAll(root, 'initial');
  run(root, 'openspec', 'new', 'change', 'add-csv-export', '--schema', 'devkit');
  const opened = join(root, 'openspec', 'changes', 'add-csv-export', '.openspec.yaml');
  writeFileSync(opened, `${readFileSync(opened, 'utf8')}x-devkit-flow: 2\n`);
  const head = (stage, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
  const files = {
    'requirements.md': `${head('requirements')}# Requirements\n`,
    'proposal.md': `${head('proposal')}# Proposal\n`,
    'specs/csv/spec.md': `${head('specs')}# CSV export\n`,
    'design.md': `${head('design')}# Design\n`,
    'tasks.md': `${head('tasks')}# Tasks\n\n${[1, 2, 3, 4, 5, 6].map((n) => `- [x] 1.${n} step ${n}`).join('\n')}\n`,
    'readiness.md': `${head('readiness', 'passed', 2)}# Readiness\n\n- Status: APPROVED\n`,
    'approval.md': `${head('approval')}# Plan approval\n\n- Status: APPROVED\n`,
    'evidence.md': `${head('evidence')}# Evidence\n`,
    'review.md': `${head('review', 'failed', 1)}# Review\n`,
  };
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/add-csv-export/${f}`, b])));
  commitAll(root, 'change files');
  sampleCache = root;
  return root;
}
// test-fixture-cleanup: made at module level, so the sweep removes it and no test's end does.
sampleChange();

const FLOW_CHECK = join(HERE, 'flow-check.mjs');
const runCli = (cwd, args, env = { ...process.env, ...SHIP_ENV }) => spawnSync(process.execPath, [FLOW_CHECK, ...args], { cwd, env, encoding: 'utf8' });

test('flow-check readout: the sample change prints the approved text', () => {
  const root = sampleChange();
  for (const [lang, want] of [['pt-BR', SAMPLE_PT], ['en', SAMPLE_EN]]) {
    const r = runCli(root, ['add-csv-export', '--lang', lang]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, want, lang);
    if (process.env.FLOW_CHECK_SAMPLE_DIR) writeFileSync(join(process.env.FLOW_CHECK_SAMPLE_DIR, `flow-check-sample.${lang}.txt`), r.stdout);
  }
  // pt-BR is the default language.
  assert.equal(runCli(root, ['add-csv-export']).stdout, SAMPLE_PT);
});

test('flow-check readout: a previous-script change prints one paragraph', () => {
  const root = liveChange({ headerless: true });
  assert.equal(cli(root, ['feat', '--lang', 'en']).stdout, `Change feat (devkit script)\n\n${PREVIOUS_EN}`);
  assert.equal(cli(root, ['feat']).stdout, `Change feat (roteiro devkit)\n\n${PREVIOUS_PT}`);
});

test('flow-check readout: both languages cover every reason code', () => {
  const en = Object.keys(TEXT.en).sort();
  assert.deepEqual(Object.keys(TEXT['pt-BR']).sort(), en);
  const names = { review: 'code review', proposal: 'proposal', delivery: 'delivery' };
  const P = {
    passed: { attempt: 2 }, 'not-applicable': {}, skipped: {}, 'role-not-shipped': { role: 'screen-designer' }, 'no-file': { file: 'x.md' },
    'no-header': { file: 'x.md' }, 'bad-header': { file: 'x.md' }, 'header-other-stage': { file: 'x.md', found: 'review' }, 'not-judged': { file: 'x.md' },
    'header-failed': { attempt: 1, failures: 1, ceiling: 2 }, 'stale-code': { why: 'abc1234 is behind def5678' }, 'stale-plan': { by: 'proposal' },
    'tasks-pending': { count: 2, ids: ['1.1', '1.2'] }, uncommitted: { paths: ['src/a.ts'] }, 'tasks-done': { done: 6, total: 6 }, 'waits-for': { n: 15 },
    'fix-after-failure': { failed: 'review', attempt: 1, failures: 1, ceiling: 2 }, 'rerun-after-fix': { stage: 'review' }, 'ceiling-reached': { stage: 'review', attempt: 2, failures: 2, ceiling: 2 },
    'no-progress': { stage: 'review' }, 'owner-pending': { stage: 'review' }, 'approval-stale': { stage: 'review' }, 'unshipped-role-pending': { stage: 'review' },
    'no-role': { stage: 'review', role: 'owner' },
    // The five codes of stage-roles (T-4): every reason code is said in both languages.
    'past-point': { after: 'proposal' }, 'flag-absent': { flag: 'ui' }, 'setting-absent': { setting: 'tests.unit' }, 'changes-asked': { attempt: 2 },
    'owner-changes': { stage: 'mockup', attempt: 2 }, archive: {}, archived: {}, 'previous-script': {}, 'schema-without-declaration': {},
    'undeclared-stage': { stage: 'retro', why: 'every stage passed' },
    'ship-plan': {}, 'gh-error': { error: 'gh exited 1' }, 'no-pr': {}, 'not-pushed': { number: 12 }, 'checks-unreadable': { error: 'HTTP 502' }, 'gh-too-old': { installed: '2.46.0', minimum: '2.50.0' },
    'check-failing': { checks: 'build (https://ci/build)' }, 'checks-pending': { checks: 'e2e' }, 'owner-merges': { number: 12 },
    'auto-merge-on': { number: 12, waiting: 'GitHub to merge' }, 'enable-auto-merge': { number: 12 }, 'pr-closed': { number: 12 }, 'tasks-left-after-merge': { number: 12, tasks: '3.1, 3.2' },
    'no-test-pr': {}, 'owner-merges-test-branch': { number: 13, branch: 'develop', base: 'main' }, 'owner-merges-base': { number: 12, base: 'main' },
    'stale-reviewers': { names: ['spec-reviewer'] },
    // The delivery train (delivery-train D-2): a change that boards, rides a train or was taken off one.
    boarded: {}, 'on-train': { number: 40 }, 'left-train': { train: 4, number: 40 }, 'disable-auto-merge': { number: 12 },
  };
  assert.deepEqual(Object.keys(P).sort(), en, 'the table below names every code');
  for (const code of en) {
    const said = ['en', 'pt-BR'].map((lang) => reasonText(lang, code, P[code], names));
    for (const s of said) assert.ok(typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object/.test(s), `${code}: ${s}`);
    assert.notEqual(said[0], said[1], `${code} is translated`);
  }
});

// ---- the openspec preflight

function wrapperDir(script) {
  const dir = tmpFolder('devkit-flow-check-wrap-');
  writeFileSync(join(dir, 'openspec'), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, 'openspec'), 0o755);
  return dir;
}
const withPath = (dir, extra = {}) => ({ ...process.env, PATH: `${dir}:${process.env.PATH}`, ...SHIP_ENV, ...extra });

test('flow-check readout: an archived change ends archived without asking OpenSpec for its status', () => {
  const root = tmpFolder('devkit-flow-check-arch-');
  git(root, 'init', '-q', '-b', 'main');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  run(root, 'bash', INSTALL, '.');
  run(root, 'openspec', 'new', 'change', 'x', '--schema', 'devkit');
  run(root, 'openspec', 'archive', 'x', '--yes', '--skip-specs');
  const archived = readdirSync(join(root, 'openspec', 'changes', 'archive')).find((n) => n.endsWith('-x'));
  assert.ok(archived, 'openspec archive moved the folder');
  const log = join(root, 'wrapper.log');
  const dir = wrapperDir(`if [ "$1" = "--version" ]; then echo 2.0.0; exit 0; fi\necho "$@" >> "${log}"\nexit 1`);
  const env = withPath(dir);
  const json = runCli(root, ['x', '--json'], env);
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout);
  assert.equal(report.end.state, 'archived');
  assert.deepEqual(report.stages, []);
  assert.equal(existsSync(log), false, 'OpenSpec was asked only for its version');
  // The title line names the script, read from the archived folder's own .openspec.yaml.
  assert.equal(runCli(root, ['x', '--lang', 'en'], env).stdout.split('\n')[0], 'Change x (devkit script)');
  assert.equal(runCli(root, ['x'], env).stdout.split('\n')[0], 'Change x (roteiro devkit)');
  // When that file cannot be read the script name is left out.
  rmSync(join(root, 'openspec', 'changes', 'archive', archived, '.openspec.yaml'));
  const bare = runCli(root, ['x', '--lang', 'en'], env);
  assert.equal(bare.status, 0, bare.stderr);
  assert.equal(bare.stdout.split('\n')[0], 'Change x');
  assert.match(bare.stdout, /End: archived\./);
  assert.equal(JSON.parse(runCli(root, ['x', '--json'], env).stdout).schema, null);
});

test('flow-check readout: an OpenSpec answer without artifacts exits 3', () => {
  const root = liveChange();
  const dir = wrapperDir(`if [ "$1" = "--version" ]; then echo 2.0.0; exit 0; fi\necho '{"status":[{"severity":"error","message":"x"}]}'\nexit 0`);
  const r = runCli(root, ['feat'], withPath(dir));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /\bx\b/);
  const j = runCli(root, ['feat', '--json'], withPath(dir));
  assert.equal(j.status, 3);
  assert.match(JSON.parse(j.stdout).error, /\bx\b/);
});

test('flow-check readout: no openspec command on PATH exits 3 and names the cause', () => {
  const root = liveChange();
  const empty = tmpFolder('devkit-flow-check-nopath-');
  const env = { ...process.env, PATH: empty, ...SHIP_ENV };
  const r = runCli(root, ['feat'], env);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /the openspec CLI is not installed or not on PATH/);
  assert.equal(r.stdout, '');
  const j = runCli(root, ['feat', '--json'], env);
  assert.equal(j.status, 3);
  assert.match(JSON.parse(j.stdout).error, /not installed or not on PATH/);
});

test('flow-check readout: an OpenSpec other than 2.x exits 3', () => {
  const root = liveChange();
  const dir = wrapperDir('echo 3.0.0');
  const r = runCli(root, ['feat'], withPath(dir));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /3\.0\.0/);
});

// ---- AC-9: no AI in the checker

const ALLOWED_IMPORTS = ['./deliver-check.mjs', './guard.mjs', './merge-setup.mjs'];
const ALLOWED_PROGRAMS = ['git', 'openspec', 'gh'];
const NETWORK = /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|node:(http|https|http2|net|tls|dns|dgram)\b/;

// What a source holds that is not a node built-in, a hook module of the pack, git, openspec or gh.
function foreignCalls(source) {
  const found = [];
  for (const m of source.matchAll(/^\s*import\s[^;]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]?([^'")]*)|\brequire\s*\(\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (!spec.startsWith('node:') && !ALLOWED_IMPORTS.includes(spec)) found.push(`import ${spec}`);
  }
  for (const m of source.matchAll(/(?<![.\w])(spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)\s*\(\s*([^,)]*)/g)) {
    if (!ALLOWED_PROGRAMS.some((p) => m[2].trim() === `'${p}'`)) found.push(`${m[1]}(${m[2].trim()})`);
  }
  if (NETWORK.test(source)) found.push('network');
  return found;
}

test('flow-check AC-9: it imports only node built-ins and the pack\'s hook modules', () => {
  const source = readFileSync(FLOW_CHECK, 'utf8');
  assert.deepEqual(foreignCalls(source), []);
  // The scan would see an AI call added to the source.
  assert.ok(foreignCalls(`${source}\nimport Anthropic from '@anthropic-ai/sdk';`).length > 0, 'an SDK import');
  assert.ok(foreignCalls(`${source}\nspawnSync('claude', ['-p', 'x']);`).length > 0, 'a claude run');
  assert.ok(foreignCalls(`${source}\nexecSync(cmd);`).length > 0, 'a shell run');
  assert.ok(foreignCalls(`${source}\nawait fetch('https://api.example.com');`).length > 0, 'a network call');
  assert.ok(foreignCalls(`${source}\nconst m = await import('some-sdk');`).length > 0, 'a dynamic import');
});

test('flow-check AC-9: it runs with only node, git, openspec and a fake gh on PATH', () => {
  const root = sampleChange();
  const bin = tmpFolder('devkit-flow-check-bin-');
  const which = (name) => run(root, 'sh', '-c', `command -v ${name}`).trim();
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync(which('git'), join(bin, 'git'));
  symlinkSync(which('openspec'), join(bin, 'openspec'));
  const gh = fakeGh();
  symlinkSync(join(gh.bin, 'gh'), join(bin, 'gh'));
  const lean = { ...gh.env, PATH: bin, ...SHIP_ENV };
  const full = runCli(root, ['add-csv-export', '--json'], { ...process.env, ...SHIP_ENV });
  const small = runCli(root, ['add-csv-export', '--json'], lean);
  assert.equal(small.status, 0, small.stderr);
  assert.equal(JSON.parse(small.stdout).version, 1);
  assert.equal(small.stdout, full.stdout);
});

test('flow-check AC-3: every writer of a stage file names the stage header', () => {
  const read = (p) => readFileSync(join(REPO_ROOT, p), 'utf8');
  const row = (text, id) => {
    const line = text.split('\n').find((l) => l.startsWith(`| \`${id}\` |`));
    assert.ok(line, `row ${id} exists`);
    return line;
  };
  const ship = read('plugins/openspec/skills/ship-change/SKILL.md');
  const stageOf = { 'stop-plan-approval': 'approval', review: 'review', retro: 'retro', 'stop-retro-answers': 'retro' };
  for (const [id, stage] of Object.entries(stageOf)) {
    const line = row(ship, id);
    assert.ok(line.includes('<!-- devkit-stage'), `ship-change row ${id} names the header`);
    assert.ok(line.includes(stage), `ship-change row ${id} names ${stage}`);
  }
  const grill = read('plugins/openspec/skills/devkit/SKILL.md').split('\n').find((l) => l.startsWith('- `grill`'));
  assert.ok(grill, 'the devkit skill has a grill item');
  assert.ok(grill.includes('<!-- devkit-stage') && grill.includes('requirements'), 'devkit grill paragraph');
  const agents = { 'plan-readiness-reviewer': 'readiness', 'pr-verifier': 'evidence', 'change-planner': 'proposal' };
  for (const [name, stage] of Object.entries(agents)) {
    const text = read(`plugins/core/agents/${name}.md`);
    assert.ok(text.includes('<!-- devkit-stage'), `${name} names the header`);
    assert.ok(text.includes(stage), `${name} names ${stage}`);
  }
  const first = read('plugins/core/skills/plan-readiness-review/templates/report.md').split('\n')[0];
  assert.deepEqual(parseStageHeader(first + '\n'), { stage: 'readiness', result: 'pending', attempt: 1, commit: 'none' });
});

// ---- field-fixes 6: the project's OpenSpec CLI (D-1)

// A live change with a 2.x `openspec` on PATH that logs to `marker` and the project's own, labelled `pinned`.
function pinWorld({ version = '1.16.0', pin = true } = {}) {
  const root = liveChange();
  const marker = join(tmpFolder('devkit-flow-check-marker-'), `seen-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
  const pathDir = openspecStub(tmpFolder('devkit-flow-check-pathcli-'), { version: '2.1.0', label: 'path', marker });
  if (pin) openspecStub(join(root, 'node_modules', '.bin'), { version, label: 'pinned', marker });
  const env = { ...process.env, PATH: `${pathDir}:${process.env.PATH}`, ...SHIP_ENV };
  return { root, marker, env };
}
const seen = (marker) => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');

test('field-fixes 6 flow-check: a pinned 1.16.0 and a 2.x on PATH exits 3 naming the version, the path and the move, and the PATH one never runs', () => {
  const w = pinWorld();
  const r = runCli(w.root, ['feat'], w.env);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /1\.16\.0/);
  assert.ok(r.stderr.includes(join(w.root, 'node_modules', '.bin', 'openspec')), r.stderr);
  assert.match(r.stderr, /2\.x/);
  assert.equal(seen(w.marker), '', 'neither CLI was asked anything but its version');
  const j = runCli(w.root, ['feat', '--json'], w.env);
  assert.equal(j.status, 3);
  assert.match(JSON.parse(j.stdout).error, /1\.16\.0/);
});

test('field-fixes 6 flow-check: a declared pin that is not installed exits 3 and the PATH one never runs', () => {
  const w = pinWorld({ pin: false });
  writeFileSync(join(w.root, 'package.json'), JSON.stringify({ devDependencies: { '@fission-ai/openspec': '^2.0.0' } }));
  const r = runCli(w.root, ['feat'], w.env);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /package\.json/);
  assert.match(r.stderr, /\^2\.0\.0/);
  assert.match(r.stderr, /install/);
  assert.equal(seen(w.marker), '', 'no openspec was started');
});

test('field-fixes 6 flow-check: a pinned 2.x answers the status calls, never the one on PATH', () => {
  const w = pinWorld({ version: '2.0.0' });
  runCli(w.root, ['feat'], w.env);
  assert.match(seen(w.marker), /^pinned status --change feat/m);
  assert.doesNotMatch(seen(w.marker), /^path /m);
});

// ---- field-fixes 2: the previous script, read from the earliest stage file (D-2)

// A committed change `feat` with exactly the files of `files` (name -> { stage, body } written with a header, or a
// string written as is), for the reading of the script.
function formChange(files, schema = 'devkit') {
  const root = gitRepo({ config: `schema: ${schema}\n` });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const out = { '.openspec.yaml': `schema: ${schema}\n` };
  for (const [name, f] of Object.entries(files)) out[name] = typeof f === 'string' ? f : `<!-- devkit-stage ${f.stage} result=passed attempt=1 commit=${c0} -->\n${f.body ?? `# ${f.stage}\n`}`;
  put(root, Object.fromEntries(Object.entries(out).map(([f, b]) => [`openspec/changes/feat/${f}`, b])));
  commitAll(root, 'change files');
  return root;
}
const PLAIN_PLAN = { 'proposal.md': '# Proposal\n', 'design.md': '# Design\n', 'tasks.md': '# Tasks\n\n- [x] 1.1 a\n' };

test('field-fixes 2 previous-script: a headed evidence.md over a headerless plan is still the previous script', () => {
  const root = formChange({ ...PLAIN_PLAN, 'evidence.md': { stage: 'evidence' } });
  const r = liveReport(root);
  assert.equal(r.script, 'previous');
  assert.deepEqual([r.stages, r.next, r.end], [[], null, null]);
});

test('field-fixes 2 previous-script: a headed readiness.md over a headerless plan is still the previous script', () => {
  const root = formChange({ ...PLAIN_PLAN, 'readiness.md': { stage: 'readiness', body: '# Readiness\n\n- Status: APPROVED\n' } });
  assert.equal(liveReport(root).script, 'previous');
});

test('field-fixes 2 previous-script: a headed reviews file over a headerless plan is still the previous script', () => {
  const root = formChange({ ...PLAIN_PLAN, 'reviews/code-quality-reviewer.md': { stage: 'review' } });
  assert.equal(liveReport(root).script, 'previous');
});

test('field-fixes 2 previous-script: a headed requirements.md with a headerless proposal.md stays current and reports no-header', () => {
  const root = formChange({ 'requirements.md': { stage: 'requirements' }, 'proposal.md': '# Proposal\n' });
  const r = liveReport(root);
  assert.equal(r.script, 'current');
  const proposal = r.stages.find((s) => s.id === 'proposal');
  assert.deepEqual([proposal.state, proposal.reasonCode], ['pending', 'no-header']);
});

test('field-fixes 2 previous-script: isPreviousScript reads only the earliest stage file the flow lists', () => {
  const file = (header) => [{ path: 'x.md', header, mtimeMs: 0 }];
  const headed = { stage: 'x', result: 'passed', attempt: 1, commit: 'none' };
  const flow = { stages: [{ id: 'open', source: 'folder' }, { id: 'a', source: 'artifact' }, { id: 'b', source: 'artifact' }] };
  assert.equal(FC.isPreviousScript({ a: file(null), b: file(headed) }, flow), true);
  assert.equal(FC.isPreviousScript({ a: file(headed), b: file(null) }, flow), false);
  assert.equal(FC.isPreviousScript({ a: [], b: file(null) }, flow), true, 'the first stage with a file decides');
  assert.equal(FC.isPreviousScript({ a: [], b: [] }, flow), false, 'no file at all is a change being opened');
});

// ---------------------------------------------------------------- stage-roles: the declarations, the checker and the settings

const NEW_STAGES = {
  mockup: { id: 'mockup', source: 'artifact', file: 'mockup.md', role: 'screen-designer', owner: true, skills: ['screen-mockup'], part: 'plan',
    appliesWhen: { flag: 'ui' }, notAfter: 'proposal', ceiling: 'owner', title: { en: 'Screen mock-up', 'pt-BR': 'Mock-up de tela' } },
  decisions: { id: 'decisions', source: 'artifact', file: 'decisions.md', role: 'adr-author', skills: ['adr-authoring'], part: 'plan',
    notAfter: 'proposal', title: { en: 'Decisions and ADRs', 'pt-BR': 'Decisões e ADRs' } },
  'unit-tests': { id: 'unit-tests', source: 'artifact', file: 'unit-tests.md', role: 'test-runner', skills: ['test-and-coverage', 'systematic-debugging'],
    part: 'after', codeBound: true, onFail: 'implementation', appliesWhen: { setting: 'tests.unit' }, notAfter: 'evidence', title: { en: 'Unit tests', 'pt-BR': 'Testes unitários' } },
  'e2e-tests': { id: 'e2e-tests', source: 'artifact', file: 'e2e-tests.md', role: 'e2e-tester', skills: ['e2e-testing'],
    part: 'after', codeBound: true, onFail: 'implementation', appliesWhen: { setting: 'tests.e2e' }, notAfter: 'evidence', title: { en: 'E2E tests', 'pt-BR': 'Testes E2E' } },
};

const withStage = (extra) => readFlow(flowRoot(flowOf(stage('a'), stage('b', extra), { ...stage('tail'), source: 'folder' }, stage('c'))), 'devkit');

test('stage-roles flow declaration: appliesWhen holds exactly one of a flag or a setting, each a non-empty string', () => {
  assert.deepEqual(withStage({ appliesWhen: { flag: 'ui' } }).stages[1].appliesWhen, { flag: 'ui' });
  assert.deepEqual(withStage({ appliesWhen: { setting: 'tests.unit' } }).stages[1].appliesWhen, { setting: 'tests.unit' });
  const bad = {
    'a string': 'ui', 'an array': [], 'no key': {}, 'both keys': { flag: 'ui', setting: 'tests.unit' }, 'an empty flag': { flag: '' },
    'a number flag': { flag: 3 }, 'an empty setting': { setting: '' }, 'an unknown key': { when: 'ui' },
  };
  for (const [why, appliesWhen] of Object.entries(bad)) {
    assert.throws(() => withStage({ appliesWhen }), (e) => e instanceof FlowUsageError && /stage b/.test(e.message) && /appliesWhen/.test(e.message), why);
  }
});

test('stage-roles flow declaration: notAfter names an artifact stage after this one', () => {
  assert.equal(withStage({ notAfter: 'c' }).stages[1].notAfter, 'c');
  const bad = { 'an unknown id': 'zzz', 'an earlier stage': 'a', 'its own id': 'b', 'a stage that is not an artifact': 'tail', 'a number': 4 };
  for (const [why, notAfter] of Object.entries(bad)) {
    assert.throws(() => withStage({ notAfter }), (e) => e instanceof FlowUsageError && /stage b/.test(e.message) && /notAfter/.test(e.message), why);
  }
});

test('stage-roles flow declaration: ceiling is a whole number from 1 or the string owner', () => {
  for (const ok of [1, 3, 'owner']) assert.equal(withStage({ ceiling: ok }).stages[1].ceiling, ok);
  for (const bad of [0, -1, 1.5, 'x', '3', 'Owner', null]) {
    assert.throws(() => withStage({ ceiling: bad }), (e) => e instanceof FlowUsageError && /stage b/.test(e.message) && /ceiling/.test(e.message), String(bad));
  }
});

test('stage-roles flow declaration: both shipped declarations carry no shipped key and match the four stages of the design', () => {
  const devkit = readFlowOf('devkit');
  const lite = readFlowOf('devkit-lite');
  for (const [name, stages] of [['devkit', devkit], ['devkit-lite', lite]]) {
    for (const s of stages) assert.equal('shipped' in s, false, `${name}/${s.id} has no shipped key`);
  }
  const pick = (stages, id) => stages.find((s) => s.id === id);
  for (const id of ['unit-tests', 'e2e-tests']) {
    assert.deepEqual(pick(devkit, id), NEW_STAGES[id], `devkit/${id}`);
    assert.deepEqual(pick(lite, id), NEW_STAGES[id], `devkit-lite/${id}`);
  }
  for (const id of ['mockup', 'decisions']) {
    assert.deepEqual(pick(devkit, id), NEW_STAGES[id], `devkit/${id}`);
    assert.equal(pick(lite, id), undefined, `devkit-lite has no ${id}`);
  }
  assert.deepEqual(pick(devkit, 'readiness').staleAfter, ['mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks']);
  assert.deepEqual(pick(lite, 'unit-tests').part, 'after');
});

test('stage-roles flow declaration: the lite status lists no mock-up and no decisions, read live through OpenSpec', () => {
  const { y } = schemaProject();
  const ids = y.artifacts.map((a) => a.id);
  assert.deepEqual(ids, ['requirements', 'proposal', 'specs', 'tasks', 'unit-tests', 'e2e-tests', 'evidence', 'review', 'retro']);
  assert.ok(!ids.includes('mockup') && !ids.includes('decisions'));
});

test('stage-roles flow declaration: every schema instruction states the stage condition, not the old not-shipped sentence', () => {
  for (const base of [PLUGIN_SCHEMAS, REPO_SCHEMAS]) {
    for (const schema of ['devkit', 'devkit-lite']) {
      const yaml = readFileSync(join(base, schema, 'schema.yaml'), 'utf8');
      assert.ok(!/Until this stage's role ships/.test(yaml), `${schema}: no stage waits for its role`);
      assert.match(yaml, /applies only when `devkit\.tests\.unit` is declared/, schema);
      assert.match(yaml, /applies only when `devkit\.tests\.e2e` is declared/, schema);
      assert.match(yaml, /not once\s+`evidence\.md` exists/, schema);
      assert.match(yaml, /as text: per acceptance criterion what was done/, schema);
      assert.match(yaml, /no screenshot, no image, no pull-request comment/, schema);
    }
    const full = readFileSync(join(base, 'devkit', 'schema.yaml'), 'utf8');
    assert.match(full, /applies only when the grill's classification lists `ui`/);
    assert.match(full, /does not apply once\s+`proposal\.md` exists/);
    assert.match(full, /includes `mockup\.md` and the records\s+`decisions\.md` lists/);
    assert.match(full, /which the approval accepts/);
    const lite = readFileSync(join(base, 'devkit-lite', 'schema.yaml'), 'utf8');
    assert.ok(!/id: mockup|id: decisions/.test(lite), 'the lite schema has neither artifact');
  }
  for (const base of [PLUGIN_SCHEMAS, REPO_SCHEMAS]) {
    assert.equal(existsSync(join(base, 'devkit-lite', 'templates', 'mockup.md')), false);
    assert.equal(existsSync(join(base, 'devkit-lite', 'templates', 'decisions.md')), false);
    for (const [f, re] of [['mockup.md', /`mock\/`|under `mock\/`|its file under `mock\/`/], ['decisions.md', /proposed/], ['unit-tests.md', /\| Command \| Exit \| Summary \|/],
      ['e2e-tests.md', /\| Scenario \| Criterion \| File \| Result \|/], ['evidence.md', /as text, no image/]]) {
      assert.match(readFileSync(join(base, 'devkit', 'templates', f), 'utf8'), re, `devkit/templates/${f}`);
    }
  }
});

// A declaration to walk: the shipped one, or fixtures of it.
const without = (flow, id, keys) => ({ ...flow, stages: flow.stages.map((s) => (s.id === id ? Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k))) : s)) });
const walkOn = (flow, over, extra, opts) => computeFlow(synth(over, extra), flow, opts);
const UI = { flags: ['ui'] };
const TESTS = { settings: { 'tests.unit': 'npm test', 'tests.e2e': 'npm run e2e' } };

test('stage-roles flow rules: (2) a stage past its point is not applicable, naming the stage it was past', () => {
  const r = walk({ mockup: null, decisions: null }, UI);
  for (const id of ['mockup', 'decisions']) {
    assert.deepEqual([stageOf(r, id).state, stageOf(r, id).reasonCode, stageOf(r, id).params], ['not-applicable', 'past-point', { after: 'proposal' }], id);
  }
  assert.equal(r.next.reasonCode, 'archive');
  const late = walk({ 'unit-tests': null, 'e2e-tests': null }, TESTS);
  for (const id of ['unit-tests', 'e2e-tests']) {
    assert.deepEqual([stageOf(late, id).state, stageOf(late, id).reasonCode, stageOf(late, id).params], ['not-applicable', 'past-point', { after: 'evidence' }], id);
  }
});

test('stage-roles flow rules: (2) off, a stage not past its point is offered', () => {
  const r = walk({ proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null, decisions: null, mockup: null }, UI);
  assert.equal(stageOf(r, 'mockup').state, 'pending');
  assert.equal(r.next.stage, 'mockup');
  assert.equal(r.next.role, 'screen-designer');
  const dec = walk({ proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null, decisions: null, mockup: null });
  assert.equal(dec.next.stage, 'decisions');
  assert.equal(dec.next.role, 'adr-author');
  assert.equal(dec.next.reasonCode, 'no-file');
  assert.equal(stageOf(dec, 'mockup').reasonCode, 'flag-absent', 'with no ui flag the next stage after the requirements is the decisions');
});

test('stage-roles flow rules: (3) a flag stage with no file applies only when its flag is listed', () => {
  const none = { proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null, mockup: null };
  const off = walk(none, { flags: ['contract'] });
  assert.deepEqual([stageOf(off, 'mockup').state, stageOf(off, 'mockup').reasonCode, stageOf(off, 'mockup').params], ['not-applicable', 'flag-absent', { flag: 'ui' }]);
  assert.equal(off.next.stage, 'proposal');
  const on = walk(none, UI);
  assert.equal(stageOf(on, 'mockup').state, 'pending');
  assert.equal(on.next.stage, 'mockup');
  assert.equal(on.next.reasonCode, 'no-file');
  assert.equal(walk(none, { flags: [] }).next.stage, 'proposal');
});

test('stage-roles flow rules: (3) the facts hold no flags at all and the stage does not apply', () => {
  const none = { proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null, mockup: null };
  const facts = synth(none);
  assert.equal('flags' in facts, false);
  assert.equal(computeFlow(facts, FLOW_DEVKIT, {}).stages.find((s) => s.id === 'mockup').reasonCode, 'flag-absent');
});

test('stage-roles flow rules: (4) a setting stage with no file applies only when its setting is declared', () => {
  const open = { evidence: null, review: null, retro: null, 'unit-tests': null, 'e2e-tests': null };
  const off = walk(open);
  for (const [id, setting] of [['unit-tests', 'tests.unit'], ['e2e-tests', 'tests.e2e']]) {
    assert.deepEqual([stageOf(off, id).state, stageOf(off, id).reasonCode, stageOf(off, id).params], ['not-applicable', 'setting-absent', { setting }], id);
  }
  assert.equal(off.next.stage, 'evidence');
  const both = walk(open, TESTS);
  assert.equal(both.next.stage, 'unit-tests');
  assert.equal(both.next.role, 'test-runner');
  assert.deepEqual(both.next.skills, ['test-and-coverage', 'systematic-debugging']);
  const e2eOnly = walk(open, { settings: { 'tests.e2e': 'npm run e2e' } });
  assert.equal(stageOf(e2eOnly, 'unit-tests').reasonCode, 'setting-absent');
  assert.equal(e2eOnly.next.stage, 'e2e-tests');
  assert.equal(e2eOnly.next.role, 'e2e-tester');
  const unitOnly = walk({ ...open, 'unit-tests': { result: 'passed' } }, { settings: { 'tests.unit': 'npm test' } });
  assert.equal(unitOnly.next.stage, 'evidence', 'with no E2E command the next stage is the demonstration');
});

test('stage-roles flow rules: (5) a stage marked not shipped and with no file is reported as such, where no condition decides first', () => {
  const unshipped = { ...FLOW_DEVKIT, stages: FLOW_DEVKIT.stages.map((s) => (s.id === 'tasks' ? { ...s, shipped: false } : s)) };
  const r = walkOn(unshipped, { tasks: null, readiness: null, approval: null });
  assert.deepEqual([stageOf(r, 'tasks').reasonCode, stageOf(r, 'tasks').params], ['role-not-shipped', { role: 'change-planner' }]);
  const conditioned = { ...FLOW_DEVKIT, stages: FLOW_DEVKIT.stages.map((s) => (s.id === 'mockup' ? { ...s, shipped: false } : s)) };
  assert.equal(stageOf(walkOn(conditioned, { mockup: null, proposal: null }), 'mockup').reasonCode, 'flag-absent', 'a condition that does not hold wins over shipped:false');
  assert.equal(stageOf(walkOn(conditioned, { mockup: null, proposal: null }, UI), 'mockup').reasonCode, 'role-not-shipped');
  assert.equal(stageOf(walk({ tasks: null }), 'tasks').reasonCode, 'no-file', 'rule (6): a stage that ships and has no file is pending');
});

test('stage-roles flow rules: (1) a stage OpenSpec skips does not apply, whatever its conditions say', () => {
  const r = walk({ mockup: null, 'unit-tests': null, proposal: null }, { ...UI, ...TESTS, skipped: ['mockup', 'unit-tests'] });
  assert.equal(stageOf(r, 'mockup').reasonCode, 'skipped');
  assert.equal(stageOf(r, 'unit-tests').reasonCode, 'skipped');
});

test('stage-roles flow rules: a file present wins over each condition and is read from its header', () => {
  const noFlag = walk({ mockup: { result: 'passed' } });
  assert.equal(stageOf(noFlag, 'mockup').state, 'passed', 'a mock-up written with no ui flag is passed');
  assert.equal(stageOf(walk({ mockup: { result: 'failed', attempt: 1 } }), 'mockup').state, 'failed');
  assert.equal(stageOf(walk({ decisions: { result: 'passed' } }), 'decisions').state, 'passed', 'past its point, a decisions file still reads');
  assert.equal(stageOf(walk({ decisions: { result: 'not-applicable' } }), 'decisions').state, 'not-applicable');
  assert.equal(stageOf(walk({ 'unit-tests': { result: 'passed' } }), 'unit-tests').state, 'passed', 'no setting, a file is read');
  assert.equal(stageOf(walk({ 'e2e-tests': { result: 'failed' } }, { staleness: () => null }), 'e2e-tests').state, 'failed');
  assert.equal(stageOf(walk({ 'e2e-tests': { header: null } }), 'e2e-tests').reasonCode, 'no-header');
});

test('stage-roles flow rules: a change past the point of a stage is never sent back to it', () => {
  const r = walk({ mockup: null, decisions: null, 'unit-tests': null, 'e2e-tests': null, review: null, retro: null }, { ...UI, ...TESTS });
  assert.equal(r.next.stage, 'review');
  for (const id of ['mockup', 'decisions', 'unit-tests', 'e2e-tests']) assert.equal(stageOf(r, id).state, 'not-applicable', id);
});

test('stage-roles flow rules: the decisions of a change not past its proposal are the next stage', () => {
  const r = walk({ proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null, decisions: null });
  assert.equal(r.next.stage, 'decisions');
});

test('stage-roles flow owner: a mock-up the owner sent back at attempt 1 is drawn again, with no ceiling', () => {
  const r = walk({ mockup: { result: 'failed', attempt: 1 }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null });
  assert.equal(stageOf(r, 'mockup').state, 'failed');
  assert.equal(stageOf(r, 'mockup').reasonCode, 'changes-asked');
  assert.deepEqual(stageOf(r, 'mockup').params, { attempt: 1 });
  assert.equal(r.end, null);
  assert.deepEqual([r.next.stage, r.next.role, r.next.reasonCode, r.next.params], ['mockup', 'screen-designer', 'owner-changes', { stage: 'mockup', attempt: 1 }]);
});

test('stage-roles flow owner: a mock-up sent back at attempt 3 and at attempt 40 is never blocked by a ceiling', () => {
  for (const attempt of [3, 40]) {
    const r = walk({ mockup: { result: 'failed', attempt }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null });
    assert.equal(r.end, null, `attempt ${attempt}`);
    assert.equal(r.next.stage, 'mockup', `attempt ${attempt}`);
    assert.equal(r.next.reasonCode, 'owner-changes', `attempt ${attempt}`);
    assert.equal(r.next.params.attempt, attempt);
  }
  assert.equal(walk({ review: { result: 'failed', attempt: 2 } }).end.reasonCode, 'ceiling-reached', 'a numeric ceiling still blocks');
});

test('stage-roles flow owner: the no-progress rule still ends a mock-up that came back with nothing changed', () => {
  const over = { mockup: { result: 'failed', attempt: 2 }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null };
  const first = walk(over);
  const again = walk(over, {}, { after: first.next.progressKey });
  assert.equal(again.next, null);
  assert.deepEqual([again.end.state, again.end.reasonCode, again.end.stage], ['blocked', 'no-progress', 'mockup']);
});

test('stage-roles flow owner: a drawn mock-up waits for the owner and no next stage is given', () => {
  const r = walk({ mockup: { result: 'pending' }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null });
  assert.equal(r.next, null);
  assert.deepEqual([r.end.state, r.end.stage, r.end.reasonCode], ['waiting-for-owner', 'mockup', 'owner-pending']);
});

test('stage-roles flow owner: the readout says the owner asked for changes at the attempt, in both languages, and names no ceiling', () => {
  const r = walk({ mockup: { result: 'failed', attempt: 2 }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null });
  const en = FC.renderText(r, FLOW_DEVKIT, 'en').split('\n').find((l) => l.includes('Screen mock-up'));
  assert.match(en, /^\s*3\s+Screen mock-up\s+the owner asked for changes at attempt 2$/);
  const pt = FC.renderText(r, FLOW_DEVKIT, 'pt-BR').split('\n').find((l) => l.includes('Mock-up de tela'));
  assert.match(pt, /^\s*3\s+Mock-up de tela\s+o dono pediu mudanças na tentativa 2$/);
  assert.equal(/ceiling|limite|failed|falhou/.test(en + pt), false);
  assert.match(FC.renderText(r, FLOW_DEVKIT, 'en'), /Why: the owner asked for changes to the screen mock-up at attempt 2; it is drawn again\./);
  assert.match(FC.renderText(r, FLOW_DEVKIT, 'pt-BR'), /Por quê: o dono pediu mudanças na etapa mock-up de tela na tentativa 2; ela é refeita\./);
});

test('stage-roles flow readout: the stage that does not apply says why, in both languages', () => {
  const r = walk({ mockup: null, decisions: null, 'unit-tests': null, 'e2e-tests': null, evidence: null, review: null, retro: null, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null }, { settings: { 'tests.e2e': 'x' } });
  const lines = (lang) => FC.renderText(r, FLOW_DEVKIT, lang).split('\n');
  const line = (lang, title) => lines(lang).find((l) => l.includes(title));
  assert.match(line('en', 'Screen mock-up'), /does not apply: the requirements' classification has no ui flag$/);
  assert.match(line('en', 'Unit tests'), /does not apply: openspec\/config\.yaml declares no devkit\.tests\.unit$/);
  assert.match(line('pt-BR', 'Mock-up de tela'), /não se aplica: a classificação dos requisitos não tem a marca ui$/);
  assert.match(line('pt-BR', 'Testes unitários'), /não se aplica: o openspec\/config\.yaml não declara devkit\.tests\.unit$/);
  const past = walk({ mockup: null, decisions: null });
  assert.match(FC.renderText(past, FLOW_DEVKIT, 'en').split('\n').find((l) => l.includes('Decisions and ADRs')), /does not apply: the change was already past the proposal when this stage arrived$/);
  assert.match(FC.renderText(past, FLOW_DEVKIT, 'pt-BR').split('\n').find((l) => l.includes('Decisões e ADRs')), /não se aplica: a change já tinha passado da etapa proposta quando esta etapa chegou$/);
});

test('stage-roles flow stale: a mock-up or a decisions file newer than the readiness makes the readiness stale, naming it', () => {
  for (const id of ['mockup', 'decisions']) {
    const r = walk({ [id]: { at: 10_000 } });
    assert.equal(stageOf(r, 'readiness').state, 'stale', id);
    assert.equal(stageOf(r, 'readiness').reasonCode, 'stale-plan', id);
    assert.equal(stageOf(r, 'readiness').params.by, id);
    assert.equal(r.next.stage, 'readiness', id);
    assert.equal(stageOf(walk({ [id]: { at: 1_500 } }), 'readiness').state, 'passed', `${id} within the tolerance`);
    assert.equal(stageOf(walk({ [id]: { at: 10_000 } }, { tasks: { exists: true, total: 3, done: 1, pending: ['1.2'] } }), 'readiness').state, 'passed', `${id} once a task is ticked`);
  }
});

// ---- the facts: the flags line and the settings

const reqText = (line) => `<!-- devkit-stage requirements result=passed attempt=1 commit=none -->\n# Requirements\n\n${line}\n`;
const dirWith = (text) => {
  const dir = tmpFolder('devkit-stage-roles-req-');
  if (text !== null) writeFileSync(join(dir, 'requirements.md'), text);
  return dir;
};

test('stage-roles flow facts: the flags are read from the classification line, lower-cased', () => {
  assert.deepEqual(FC.classificationFlags(dirWith(reqText('Classification: domain=process type=feature flags=[ui, contract] (confirmed)'))), ['ui', 'contract']);
  assert.deepEqual(FC.classificationFlags(dirWith(reqText('Classification: domain=x type=y flags=[UI , Contract ]'))), ['ui', 'contract']);
  assert.deepEqual(FC.classificationFlags(dirWith(reqText('Classification: domain=x type=y flags=[]'))), []);
});

test('stage-roles flow facts: no flag comes from a missing file, a missing line or a skipped grill', () => {
  assert.deepEqual(FC.classificationFlags(dirWith(null)), []);
  assert.deepEqual(FC.classificationFlags(dirWith(reqText('Grill: skipped by owner'))), []);
  assert.deepEqual(FC.classificationFlags(dirWith(reqText('Notes: flags=[ui] is what I would say'))), [], 'a line with no Classification: is not read');
});

test('stage-roles flow facts: only the classification line changes the flags', () => {
  const text = reqText('Classification: domain=x type=y flags=[contract]\n\nOther: flags=[ui]\n- the ui flag is not set');
  assert.deepEqual(FC.classificationFlags(dirWith(text)), ['contract']);
});

const configRoot = (body) => {
  const root = tmpFolder('devkit-stage-roles-cfg-');
  if (body !== null) { mkdirSync(join(root, 'openspec')); writeFileSync(join(root, 'openspec', 'config.yaml'), body); }
  return root;
};

test('stage-roles flow settings: the nested tests block is read, quoted or not, with comments dropped', () => {
  const s = FC.readTestSettings(configRoot([
    'schema: devkit', 'devkit:', '  language: en', '  driver: claude', '  tests:', '    unit: "npm test"   # the whole suite',
    '    coverage:  # printed total', '      command: npm run coverage', "      target: 80", '    e2e: \'npm run e2e\'', 'other: 1', ''].join('\n')));
  assert.equal(s.unit, 'npm test');
  assert.equal(s.e2e, 'npm run e2e');
  assert.deepEqual(s.coverage, { command: 'npm run coverage', target: 80 });
  assert.equal(s.paths['tests.unit'], 'npm test');
  assert.equal(s.paths['tests.e2e'], 'npm run e2e');
  assert.equal(s.paths['tests.coverage.command'], 'npm run coverage');
  assert.equal(s.paths['tests.coverage.target'], '80');
  assert.deepEqual(s.unknown, []);
});

test('stage-roles flow settings: a key after the tests block closes it, and keys outside the devkit block are not read', () => {
  const s = FC.readTestSettings(configRoot(['devkit:', '  tests:', '    unit: npm test', '  driver: claude', '  e2e: not-a-tests-key', 'tests:', '  unit: elsewhere', ''].join('\n')));
  assert.equal(s.unit, 'npm test');
  assert.equal(s.e2e, null);
  assert.equal('tests.e2e' in s.paths, false);
});

test('stage-roles flow settings: no file, no block or no tests key gives null values and no path', () => {
  for (const body of [null, '', 'schema: devkit\n', 'devkit:\n  language: en\n']) {
    const s = FC.readTestSettings(configRoot(body));
    assert.deepEqual([s.unit, s.e2e, s.coverage, s.unknown], [null, null, { command: null, target: null }, []], String(body));
    assert.equal('tests.unit' in s.paths, false);
  }
});

test('stage-roles flow settings: a target is a whole number from 0 to 100, else null and named in unknown', () => {
  const target = (text) => FC.readTestSettings(configRoot(`devkit:\n  tests:\n    coverage:\n      target: ${text}\n`));
  assert.equal(target('0').coverage.target, 0);
  assert.equal(target('100').coverage.target, 100);
  assert.deepEqual(target('0').unknown, []);
  for (const bad of ['101', '80%', '-1', '80.5', 'high', '"eighty"']) {
    const s = target(bad);
    assert.equal(s.coverage.target, null, bad);
    assert.equal(s.unknown.length, 1, bad);
    assert.equal(s.unknown[0].setting, 'coverage-target', bad);
    assert.equal(s.unknown[0].accepted, 'a whole number from 0 to 100', bad);
  }
  assert.equal(target('101').unknown[0].value, '101');
  assert.equal(target('80%').unknown[0].value, '80%');
});

test('stage-roles flow settings: an empty value is not declared', () => {
  const s = FC.readTestSettings(configRoot('devkit:\n  tests:\n    unit: ""\n    e2e:\n'));
  assert.equal(s.unit, null);
  assert.equal(s.e2e, null);
  assert.equal('tests.unit' in s.paths, false);
  assert.equal('tests.e2e' in s.paths, false);
});

test('stage-roles flow settings: plainValue is the rule of the devkit block, moved to the checker', () => {
  assert.equal(FC.plainValue(' "npm test" # x'), 'npm test');
  assert.equal(FC.plainValue(" 'a b'"), 'a b');
  assert.equal(FC.plainValue(' npm run x # note\r'), 'npm run x');
  assert.equal(FC.plainValue(''), '');
});

test('stage-roles flow facts: collectFlow reads the flags and the settings and the walk offers the unit tests with their role', () => {
  const root = liveChange({ skip: ['evidence', 'review', 'retro'] });
  put(root, {
    'openspec/changes/feat/requirements.md': `<!-- devkit-stage requirements result=passed attempt=1 commit=none -->\nClassification: domain=x type=y flags=[ui, contract]\n`,
    'openspec/config.yaml': 'schema: devkit\ndevkit:\n  tests:\n    unit: "npm test"\n    coverage:\n      target: 80\n',
  });
  commitAll(root, 'requirements and settings');
  const { facts, flow } = collectFlow(root, 'feat', { openspec: fakeOpenspec(root) });
  assert.deepEqual(facts.flags, ['ui', 'contract']);
  assert.equal(facts.settings['tests.unit'], 'npm test');
  assert.equal(facts.settings['tests.coverage.target'], '80');
  const r = computeFlow(facts, flow, {});
  assert.equal(stageOf(r, 'mockup').reasonCode, 'past-point');
  assert.equal(stageOf(r, 'decisions').reasonCode, 'past-point');
  assert.equal(stageOf(r, 'e2e-tests').reasonCode, 'setting-absent');
  assert.deepEqual([r.next.stage, r.next.role], ['unit-tests', 'test-runner']);
});

test('stage-roles flow facts: a change with no classification line and no settings reads empty facts', () => {
  const root = liveChange({ skip: ['evidence', 'review', 'retro'] });
  const { facts } = collectFlow(root, 'feat', { openspec: fakeOpenspec(root) });
  assert.deepEqual(facts.flags, []);
  assert.deepEqual(facts.settings, {});
});

// ---- review-writer-prompt D-7: the review stage is stale while a reviewer is stale (spec change-stages)

const reviewFile = (sha, extra = '') => `Verdict: APPROVED\nCommit: ${sha}${extra}\n\n# Review\n`;
const rewriteHeaders = (root, ids, sha) => {
  for (const id of ids) {
    const file = join(root, 'openspec', 'changes', 'feat', `${id}.md`);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/commit=[0-9a-f]+/, `commit=${sha}`));
  }
};
const reviewersAt = (root, shas) => put(root, Object.fromEntries(Object.entries(shas).map(([n, sha]) => [`openspec/changes/feat/reviews/${n}.md`, reviewFile(sha)])));

test('review-writer-prompt AC-8 a commit of test files only after the review makes the review stage stale', () => {
  const root = liveChange();
  const a = git(root, 'rev-parse', 'HEAD');
  reviewersAt(root, { 'code-quality-reviewer': a, 'spec-reviewer': a });
  commitAll(root, 'reviewers');
  assert.equal(stageOf(liveReport(root), 'review').state, 'passed', 'control');
  put(root, { 'src/a.test.ts': 't\n' });
  const b = commitAll(root, 'tests only');
  rewriteHeaders(root, ['evidence'], b);
  commitAll(root, 'evidence again');
  const r = liveReport(root);
  assert.equal(stageOf(r, 'evidence').state, 'passed');
  assert.equal(stageOf(r, 'review').state, 'stale');
  assert.equal(r.next.stage, 'review');
});

test('review-writer-prompt AC-8 a stale reviewer under a current header makes the review stage stale and names it', () => {
  const root = liveChange();
  const a = git(root, 'rev-parse', 'HEAD');
  put(root, { 'src/a.ts': 'product\n' });
  const b = commitAll(root, 'product');
  rewriteHeaders(root, ['evidence', 'review'], b);
  reviewersAt(root, { 'code-quality-reviewer': b, 'spec-reviewer': a });
  commitAll(root, 'headers and reviewers');
  const r = liveReport(root);
  assert.equal(stageOf(r, 'evidence').state, 'passed');
  const review = stageOf(r, 'review');
  assert.equal(review.state, 'stale');
  assert.equal(review.reasonCode, 'stale-reviewers');
  assert.deepEqual(review.params.names, ['spec-reviewer']);
  assert.match(review.reason, /spec-reviewer/);
  assert.equal(r.next.stage, 'review');
});

test('review-writer-prompt AC-8 every reviewer current under a current header leaves the review stage passed', () => {
  const root = liveChange();
  put(root, { 'src/a.ts': 'product\n' });
  const b = commitAll(root, 'product');
  rewriteHeaders(root, ['evidence', 'review'], b);
  reviewersAt(root, { 'code-quality-reviewer': b, 'spec-reviewer': b });
  commitAll(root, 'headers and reviewers');
  assert.equal(stageOf(liveReport(root), 'review').state, 'passed');
});

test('jira-entry-followups AC-4 the stage readout offers the review again after an approved verdict\'s finding is fixed in the plan', () => {
  const root = liveChange();
  const a = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': reviewFile(a),
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': `${reviewFile(a)}- [important] x\n`,
  });
  commitAll(root, 'reviewers');
  assert.equal(stageOf(liveReport(root), 'review').state, 'passed', 'control: the approved verdict is current');
  const design = join(root, 'openspec', 'changes', 'feat', 'design.md');
  writeFileSync(design, `${readFileSync(design, 'utf8')}\nfixed\n`);
  commitAll(root, 'plan fix');
  const review = stageOf(liveReport(root), 'review');
  assert.equal(review.state, 'stale');
  assert.equal(review.reasonCode, 'stale-reviewers');
  assert.deepEqual(review.params.names, ['test-coverage-reviewer']);
});

test('review-writer-prompt AC-8 the review stage without a staleReviewers fact keeps today\'s result', () => {
  assert.equal(stageOf(walk({}), 'review').state, 'passed');
  const named = walk({ retro: null }, { staleReviewers: () => ['spec-reviewer', 'adr-reviewer'] });
  assert.equal(stageOf(named, 'review').reasonCode, 'stale-reviewers');
  assert.equal(reasonText('en', 'stale-reviewers', { names: ['spec-reviewer', 'adr-reviewer'] }, {}), 'the reviews of spec-reviewer, adr-reviewer are stale');
  assert.equal(stageOf(walk({}, { staleReviewers: () => [] }), 'review').state, 'passed');
});

test('review-writer-prompt AC-8 after the merge the review stage is read from its header alone', () => {
  const root = liveChange({ ship: 'merge', skip: ['retro'] });
  rewriteHeaders(root, ['evidence', 'review'], 'deadbee');
  reviewersAt(root, { 'spec-reviewer': 'deadbee' });
  commitAll(root, 'squashed away');
  git(root, 'checkout', '-q', 'main');
  const gh = fakeGh();
  gh.set('pr-view', { stdout: prView(git(root, 'rev-parse', 'HEAD'), { state: 'MERGED', headRefName: 'feat' }) });
  gh.set('pr-list-state-merged', { stdout: [prView('f'.repeat(40), { state: 'MERGED', headRefName: 'feat', body: 'evidence: openspec/changes/feat/evidence.md' })] });
  ownMerged(gh.set.bind(gh));
  const env = { ...gh.env, ...SHIP_ENV };
  const { facts, flow } = collectFlow(root, 'feat', { env, gh: makeGh(root, env), openspec: fakeOpenspec(root) });
  assert.equal(stageOf(computeFlow(facts, flow, {}), 'review').state, 'passed');
});

// ---- review-openspec-fix: the stage readout after a rejected review (spec verdict-files)

// A failed review stage whose code-quality-reviewer rejected at A (record committed): the fix is offered.
function rejectedStage() {
  const root = liveChange({ review: 'failed' });
  const A = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': `Verdict: REJECTED\nCommit: ${A}\n\n# Review\n`,
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': reviewFile(A),
  });
  commitAll(root, 'review round');
  const control = liveReport(root).next;
  assert.deepEqual([control.stage, control.reasonCode], ['implementation', 'fix-after-failure'], 'control');
  return root;
}

test('review-openspec-fix 19: the stage readout offers the review again after a failed review is fixed by an openspec/-only commit', () => {
  const root = rejectedStage();
  const design = join(root, 'openspec', 'changes', 'feat', 'design.md');
  writeFileSync(design, `${readFileSync(design, 'utf8')}fixed\n`);
  commitAll(root, 'plan fix');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/design.md');
  const r = liveReport(root);
  assert.equal(stageOf(r, 'review').state, 'failed');
  assert.equal(r.next.stage, 'review');
  assert.equal(r.next.reasonCode, 'rerun-after-fix');
});

test('review-openspec-fix 20: the stage readout keeps the fix after a commit of the rejecting round\'s record only', () => {
  const root = rejectedStage();
  const file = join(root, 'openspec', 'changes', 'feat', 'reviews', 'code-quality-reviewer.md');
  writeFileSync(file, `${readFileSync(file, 'utf8')}- [nit] noted\n`);
  commitAll(root, 'record again');
  const r = liveReport(root);
  assert.equal(r.next.stage, 'implementation');
  assert.equal(r.next.reasonCode, 'fix-after-failure');
});

// ---------------------------------------------------------------- stage-ceiling-consecutive: the ceiling counts failures in a row

// A committed devkit change `feat` whose `stage` file is in no commit before the first take (liveChange commits every
// stage passed at attempt 1, which would reset every count), then one take per entry of `takes`: a result, or
// { result, attempt, commit, commitIt }. A take is written with attempt `i + 1` and the head as its commit unless it
// says otherwise, and committed unless `commitIt` is false. With `merges`, the change is on branch `feat` and main
// moves a product file and is merged (a real merge commit) before every take after the first.
function takesChange(stage, takes, { merges = false } = {}) {
  const root = liveChange({ skip: [stage] });
  if (merges) {
    git(root, 'branch', 'main-moves');
    git(root, 'checkout', '-q', '-b', 'feat');
  }
  takes.forEach((take, i) => {
    const t = typeof take === 'string' ? { result: take } : take;
    if (merges && i > 0) {
      git(root, 'checkout', '-q', 'main-moves');
      put(root, { [`src/main-${i}.ts`]: `export const moved${i} = ${i};\n` });
      commitAll(root, `main moves ${i}`);
      git(root, 'checkout', '-q', 'feat');
      git(root, 'merge', '--no-ff', '--no-edit', '-q', 'main-moves');
    }
    put(root, { [`openspec/changes/feat/${stage}.md`]: `<!-- devkit-stage ${stage} result=${t.result} attempt=${t.attempt ?? i + 1} commit=${t.commit ?? git(root, 'rev-parse', 'HEAD')} -->\n# ${stage}\n` });
    if (t.commitIt ?? true) commitAll(root, `take ${i + 1}`);
  });
  return root;
}

// A shallow clone of `root` (the checkout CI starts from), `depth` commits deep.
function shallowClone(root, depth) {
  const parent = tmpFolder('devkit-flow-check-clone-');
  run(parent, 'git', 'clone', '-q', '--depth', String(depth), `file://${root}`, 'clone');
  return join(parent, 'clone');
}

const EVIDENCE_FILE = 'openspec/changes/feat/evidence.md';
const failedHeader = (attempt, commit, stage = 'evidence') => ({ stage, result: 'failed', attempt, commit });
const passedHeader = (attempt, commit, stage = 'evidence') => ({ stage, result: 'passed', attempt, commit });

test('stage-ceiling-consecutive AC-1: a failure after two passed takes is offered its fix', () => {
  const root = takesChange('evidence', ['passed', 'passed', 'failed']);
  assert.deepEqual(FC.stageHistory(root, EVIDENCE_FILE).map((h) => [h.result, h.attempt]), [['failed', 3], ['passed', 2], ['passed', 1]], 'newest first');
  const r = liveReport(root);
  assert.equal(r.end, null);
  assert.equal(r.next.stage, 'implementation');
  assert.equal(r.next.reasonCode, 'fix-after-failure');
  assert.deepEqual(r.next.params, { failed: 'evidence', attempt: 3, failures: 1, ceiling: 3 });
  assert.deepEqual(stageOf(r, 'evidence').params, { attempt: 3, failures: 1, ceiling: 3 });
});

test('stage-ceiling-consecutive AC-2: failures in a row still end blocked', () => {
  const evidence = liveReport(takesChange('evidence', ['failed', 'failed', 'failed']));
  assert.equal(evidence.next, null);
  assert.equal(evidence.end.state, 'blocked');
  assert.equal(evidence.end.reasonCode, 'ceiling-reached');
  assert.deepEqual(evidence.end.params, { stage: 'evidence', attempt: 3, failures: 3, ceiling: 3 });
  const review = liveReport(takesChange('review', ['failed', 'failed']));
  assert.equal(review.end.reasonCode, 'ceiling-reached');
  assert.deepEqual(review.end.params, { stage: 'review', attempt: 2, failures: 2, ceiling: 2 });
  // H-6: the review stage restarts its round at 1 after a pass, and the count does not subtract attempts.
  const restarted = liveReport(takesChange('review', [{ result: 'passed', attempt: 1 }, { result: 'failed', attempt: 1 }, { result: 'failed', attempt: 2 }]));
  assert.equal(restarted.end.reasonCode, 'ceiling-reached');
  assert.deepEqual(restarted.end.params, { stage: 'review', attempt: 2, failures: 2, ceiling: 2 });
});

test('stage-ceiling-consecutive AC-3: a pass between failures resets the count', () => {
  const between = liveReport(takesChange('evidence', ['failed', 'passed', 'failed']));
  assert.equal(between.end, null);
  assert.equal(between.next.reasonCode, 'fix-after-failure');
  assert.equal(between.next.params.failures, 1);
  const passed = liveReport(takesChange('evidence', ['failed', 'failed', 'passed']));
  assert.equal(stageOf(passed, 'evidence').state, 'passed');
  assert.notEqual(passed.next?.stage, 'evidence');
  assert.notEqual(passed.end?.stage, 'evidence');
  const after = liveReport(takesChange('evidence', ['failed', 'failed', 'passed', 'failed']));
  assert.equal(after.end, null);
  assert.equal(after.next.params.failures, 1);
});

test('stage-ceiling-consecutive AC-4: history that cannot be read keeps the attempt', async (t) => {
  await t.test('stage-ceiling-consecutive AC-4 F-1: a folder that is not a repository reads as no history', () => {
    assert.deepEqual(FC.stageHistory(tmpFolder('devkit-flow-check-norepo-'), EVIDENCE_FILE), []);
  });
  await t.test('stage-ceiling-consecutive AC-4 F-2: no git on PATH reads as no history', () => {
    const root = takesChange('evidence', ['passed', 'passed', 'failed']);
    assert.equal(FC.stageHistory(root, EVIDENCE_FILE).length, 3, 'with git, the same folder has a history');
    assert.deepEqual(FC.stageHistory(root, EVIDENCE_FILE, { ...process.env, PATH: tmpFolder('devkit-flow-check-nopath-') }), []);
  });
  await t.test('stage-ceiling-consecutive AC-4 F-3: a depth-1 clone gives today\'s rule', () => {
    const r = liveReport(shallowClone(takesChange('evidence', ['passed', 'passed', 'failed']), 1));
    assert.equal(r.end.reasonCode, 'ceiling-reached');
    assert.equal(r.end.params.failures, 3);
  });
  await t.test('stage-ceiling-consecutive AC-4 F-4: a stage file never committed gives today\'s rule', () => {
    const r = liveReport(takesChange('evidence', [{ result: 'passed', commitIt: false }, { result: 'passed', commitIt: false }, { result: 'failed', commitIt: false }]));
    assert.equal(r.end.reasonCode, 'ceiling-reached');
    assert.equal(r.end.params.failures, 3);
  });
  await t.test('stage-ceiling-consecutive AC-4 no history fact: the walk blocks exactly when attempt reaches the ceiling', () => {
    for (const attempt of [1, 2, 3]) {
      const r = walk({ evidence: { result: 'failed', attempt } });
      if (attempt >= 3) {
        assert.equal(r.end.reasonCode, 'ceiling-reached', `attempt ${attempt}`);
        assert.equal(r.end.params.failures, attempt);
      } else {
        assert.equal(r.end, null, `attempt ${attempt}`);
        assert.equal(r.next.params.failures, attempt);
      }
    }
  });
});

test('stage-ceiling-consecutive AC-4: what the history shows is counted', async (t) => {
  await t.test('stage-ceiling-consecutive AC-4 H-3: a depth-2 clone shows the last pass', () => {
    const r = liveReport(shallowClone(takesChange('evidence', ['passed', 'passed', 'failed']), 2));
    assert.equal(r.end, null);
    assert.equal(r.next.params.failures, 1);
  });
  await t.test('stage-ceiling-consecutive AC-4 H-4: a pass whose commit is not in the history still counts as a pass', () => {
    const r = liveReport(takesChange('evidence', ['passed', { result: 'passed', commit: SHA40 }, 'failed']));
    assert.equal(r.end, null);
    assert.equal(r.next.params.failures, 1);
  });
  await t.test('stage-ceiling-consecutive AC-4 H-5: a take overwritten without a commit is not counted', () => {
    const r = liveReport(takesChange('evidence', ['passed', { result: 'failed', commitIt: false }, 'failed']));
    assert.equal(r.end, null);
    assert.equal(r.next.params.failures, 1);
  });
});

test('stage-ceiling-consecutive AC-7: takes retaken after merges of main do not count', () => {
  const one = liveReport(takesChange('evidence', ['passed', 'passed', 'failed'], { merges: true }));
  assert.equal(one.next.params.failures, 1);
  const three = liveReport(takesChange('evidence', ['passed', 'passed', 'passed', 'failed'], { merges: true }));
  assert.equal(three.end, null);
  assert.equal(three.next.reasonCode, 'fix-after-failure');
  assert.equal(three.next.params.failures, 1);
});

test('stage-ceiling-consecutive: failuresInARow counts the distinct failed headers since the last pass', () => {
  const count = FC.failuresInARow;
  // Headers that are null, malformed or of another stage, and not-applicable or pending ones, neither stop the walk nor count.
  const noise = [null, { malformed: true }, failedHeader(5, 'cOther0', 'review'), passedHeader(1, 'cOther1', 'review'),
    { stage: 'evidence', result: 'not-applicable', attempt: 1, commit: 'cNa0000' }, { stage: 'evidence', result: 'pending', attempt: 1, commit: 'cPend00' }];
  assert.equal(count(failedHeader(1, 'c111111'), [...noise, failedHeader(2, 'c222222'), passedHeader(1, 'c000000')]), 2);
  // The first passed header stops the walk, whatever its attempt.
  assert.equal(count(failedHeader(1, 'c111111'), [passedHeader(2, 'c222222')]), 1);
  assert.equal(count(failedHeader(1, 'c111111'), [passedHeader(2, 'c222222'), failedHeader(1, 'c000000')]), 1);
  // A restarted round: no attempt is subtracted.
  assert.equal(count(failedHeader(2, 'c222222'), [failedHeader(1, 'c111111'), passedHeader(1, 'c000000')]), 2);
  // The current header repeated, and one failed header carried by two commits, count once.
  assert.equal(count(failedHeader(3, 'c333333'), [failedHeader(3, 'c333333'), passedHeader(2, 'c222222')]), 1);
  assert.equal(count(failedHeader(3, 'c333333'), [failedHeader(3, 'c333333'), failedHeader(3, 'c333333'), passedHeader(2, 'c222222')]), 1);
  // With no passed header the count is the larger of the attempt and the distinct failed headers.
  assert.equal(count(failedHeader(3, 'c333333'), []), 3);
  assert.equal(count(failedHeader(1, 'c111111'), [failedHeader(2, 'c222222'), failedHeader(1, 'c000000')]), 3);
});

test('stage-ceiling-consecutive: the history is read only for a failed stage with a numeric ceiling', () => {
  const spy = () => { const calls = []; return { calls, history: (path) => { calls.push(path); return []; } }; };
  const none = spy();
  walk({}, { history: none.history });
  assert.deepEqual(none.calls, [], 'every stage passed');
  const owner = spy();
  walk({ mockup: { result: 'failed', attempt: 2 }, proposal: null, specs: null, design: null, tasks: null, readiness: null, approval: null }, { history: owner.history });
  assert.deepEqual(owner.calls, [], 'a mock-up sent back has the owner as its ceiling');
  const failed = spy();
  walk({ evidence: { result: 'failed' } }, { history: failed.history });
  assert.deepEqual(failed.calls, ['evidence.md']);
});

test('stage-ceiling-consecutive AC-6: the readout says the failures in a row in both languages', () => {
  const root = takesChange('evidence', ['passed', 'passed', 'failed']);
  const report = liveReport(root);
  const flow = readFlow(root, 'devkit');
  const en = renderText(report, flow, 'en');
  assert.match(en, /Demonstration {2,}failed at attempt 3; failures in a row: 1 of 3\n/);
  assert.match(en, /\nWhy: the demonstration failed at attempt 3 \(failures in a row: 1 of 3\) and the code has not changed since; the fix comes before another review\.\n$/);
  const pt = renderText(report, flow, 'pt-BR');
  assert.match(pt, /Demonstração {2,}falhou na tentativa 3; falhas seguidas: 1 de 3\n/);
  assert.match(pt, /\nPor quê: a demonstração falhou na tentativa 3 \(falhas seguidas: 1 de 3\) e nada mudou no código desde então; a correção vem antes de uma nova revisão\.\n$/);
  const blockedRoot = takesChange('review', ['failed', 'failed']);
  const blocked = liveReport(blockedRoot);
  const blockedFlow = readFlow(blockedRoot, 'devkit');
  assert.match(renderText(blocked, blockedFlow, 'en'), /\nEnd: blocked\. The code review failed at attempt 2; its failures in a row \(2\) reached its ceiling of 2\.\n$/);
  assert.match(renderText(blocked, blockedFlow, 'pt-BR'), /\nFim: bloqueada\. A etapa revisão de código falhou na tentativa 2; as falhas seguidas \(2\) chegaram ao limite de 2\.\n$/);
});
