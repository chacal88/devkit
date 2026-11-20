// node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs
// flow-script-checker: the stage header, the stage declaration and the checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync, utimesSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as FC from './flow-check.mjs';
import { parseStageHeader, readFlow, pendingTasks, FlowUsageError, collectFlow, computeFlow, TEXT, reasonText } from './flow-check.mjs';
import { makeGh } from './deliver-check.mjs';
import { gitRepo, put, commitAll, git, fakeGh } from './deliver-check.test.mjs';
import { collectState, nextStep, approvalState } from './deliver-check.mjs';
import { roundRepo } from './conduct-check.test.mjs';
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
  const root = mkdtempSync(join(tmpdir(), 'flow-check-'));
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
const LITE_STAGES = DEVKIT_STAGES.filter((s) => !['design', 'readiness', 'approval'].includes(s));
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
  const root = mkdtempSync(join(tmpdir(), 'devkit-flow-'));
  run(root, 'git', 'init', '-q');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  run(root, 'bash', INSTALL, '.');
  run(root, 'openspec', 'new', 'change', 'x', '--schema', 'devkit');
  run(root, 'openspec', 'new', 'change', 'y', '--schema', 'devkit-lite');
  const status = (id) => JSON.parse(run(root, 'openspec', 'status', '--change', id, '--json'));
  projectCache = { root, x: status('x'), y: status('y') };
  return projectCache;
}

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
  const root = mkdtempSync(join(tmpdir(), 'flow-session-'));
  git(root, 'init', '-q', '-b', 'main');
  cpSync(PLUGIN_SCHEMAS, join(root, 'openspec', 'schemas'), { recursive: true });
  put(root, { 'openspec/config.yaml': 'schema: devkit\n', 'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n' });
  const { code, out } = guardRun('session', root);
  assert.equal(code, 0);
  assert.match(out, /flow-check\.mjs/);
  assert.match(out, /a role is the devkit-core agent of the same name/);
  assert.match(out, /`ship-change` or `\/conduct` drives the change today/);
  assert.match(out, /`flow-check` is the read-only readout of the stages/);
  assert.doesNotMatch(out, /the next step is what `openspec status` says/);
});

// ---- AC-6: a stage header changes no step of today's readers

const HEADER = (stage, result = 'passed') => `<!-- devkit-stage ${stage} result=${result} attempt=1 commit=none -->\n`;
const headed = (on, stage, text) => (on ? HEADER(stage) + text : text);
const SHIP_ENV = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
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
  const root = mkdtempSync(join(tmpdir(), 'flow-gate-'));
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
  assert.deepEqual(stageOf(r, 'review').params, { attempt: 1, ceiling: 2 });
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

test('flow-check stages: a stage whose role is not shipped and has no file does not apply', () => {
  const r = walk({ mockup: null, decisions: null, design: null });
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
  assert.deepEqual(r.end.params, { stage: 'review', attempt: 2, ceiling: 2 });
  assert.equal(walk({ review: { result: 'failed', attempt: 1 } }).end, null);
});

test('flow-check stages: a failed stage offers its fix, then itself after the fix', () => {
  const failed = { review: { result: 'failed', commit: 'c111111' } };
  const before = walk(failed);
  assert.equal(before.next.stage, 'implementation');
  assert.equal(before.next.reasonCode, 'fix-after-failure');
  assert.deepEqual(before.next.params, { failed: 'review', attempt: 1, ceiling: 2 });
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

test('flow-check stages: a pending file of an unshipped role waits for the owner', () => {
  for (const id of ['decisions', 'mockup', 'unit-tests']) {
    const r = walk({ [id]: { result: 'pending' } });
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
  const byId = Object.fromEntries(FLOW_DEVKIT.stages.map((s) => [s.id, s]));
  for (const over of fixtures) {
    const r = walk(over, { staleness: (sha) => (sha === 'c111111' ? 'behind' : null) });
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
  assert.equal(walk({ requirements: { header: null } }).script, 'current');
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
  const config = `schema: devkit\n${over.ship ? `ship:\n  devkit: ${over.ship}\n` : ''}`;
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
  ['a merged pull request passes the delivery and the walk goes to the archive', { fill: (set, head) => set('pr-view', { stdout: prView(head, { state: 'MERGED' }) }) }, { next: 'retro', reasonCode: 'archive' }],
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
  assert.deepEqual(Object.keys(json), ['version', 'change', 'schema', 'script', 'head', 'stages', 'next', 'end', 'previous']);
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

const SAMPLE_PT = `Change add-csv-export (roteiro devkit)

 1  Abrir a change          passou
 2  Requisitos (grill)      passou
 3  Mock-up de tela         não se aplica: ninguém executa esta etapa ainda (o papel screen-designer não existe nesta versão)
 4  Decisões e ADRs         não se aplica: ninguém executa esta etapa ainda (o papel adr-author não existe nesta versão)
 5  Proposta                passou
 6  Specs                   passou
 7  Design                  passou
 8  Tarefas                 passou
 9  Revisão do plano        passou na tentativa 2
10  Aprovação do dono       passou
11  Implementação           passou: 6 de 6 tarefas feitas
12  Testes unitários        não se aplica: ninguém executa esta etapa ainda (o papel test-runner não existe nesta versão)
13  Testes E2E              não se aplica: ninguém executa esta etapa ainda (o papel e2e-tester não existe nesta versão)
14  Demonstração            passou
15  Revisão de código       falhou na tentativa 1 de 2
16  Entrega                 bloqueada: espera a etapa 15
17  Retro e arquivo         bloqueada: espera a etapa 16

Próxima etapa: 11 Implementação
Quem executa: tdd-implementer
Por quê: a revisão de código falhou na tentativa 1 de 2 e nada mudou no código desde então; a correção vem antes de uma nova revisão.
`;
const SAMPLE_EN = `Change add-csv-export (devkit script)

 1  Open the change         passed
 2  Requirements (grill)    passed
 3  Screen mock-up          does not apply: nobody runs this stage yet (no screen-designer role in this version)
 4  Decisions and ADRs      does not apply: nobody runs this stage yet (no adr-author role in this version)
 5  Proposal                passed
 6  Specs                   passed
 7  Design                  passed
 8  Tasks                   passed
 9  Plan readiness          passed at attempt 2
10  Owner's approval        passed
11  Implementation          passed: 6 of 6 tasks done
12  Unit tests              does not apply: nobody runs this stage yet (no test-runner role in this version)
13  E2E tests               does not apply: nobody runs this stage yet (no e2e-tester role in this version)
14  Demonstration           passed
15  Code review             failed at attempt 1 of 2
16  Delivery                blocked: waits for stage 15
17  Retro and archive       blocked: waits for stage 16

Next stage: 11 Implementation
Who runs it: tdd-implementer
Why: the code review failed at attempt 1 of 2 and the code has not changed since; the fix comes before another review.
`;
const PREVIOUS_PT = `Esta change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa. O fluxo de hoje a termina (ship-change, guiado pelo deliver-check). Este comando não para nada.
`;
const PREVIOUS_EN = `This change began under the previous script: its files carry no stage header. Today's flow finishes it (ship-change, led by deliver-check). This command stops nothing.
`;

let sampleCache = null;
// `add-csv-export` (design D-7 and D-12): a devkit change written with the new script, every stage up to the
// demonstration passed, the plan readiness at attempt 2, the code review failed at attempt 1.
export function sampleChange() {
  if (sampleCache) return sampleCache;
  const root = mkdtempSync(join(tmpdir(), 'flow-check-sample-'));
  git(root, 'init', '-q', '-b', 'main');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  run(root, 'bash', INSTALL, '.');
  const c0 = commitAll(root, 'initial');
  run(root, 'openspec', 'new', 'change', 'add-csv-export', '--schema', 'devkit');
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
    'header-failed': { attempt: 1, ceiling: 2 }, 'stale-code': { why: 'abc1234 is behind def5678' }, 'stale-plan': { by: 'proposal' },
    'tasks-pending': { count: 2, ids: ['1.1', '1.2'] }, uncommitted: { paths: ['src/a.ts'] }, 'tasks-done': { done: 6, total: 6 }, 'waits-for': { n: 15 },
    'fix-after-failure': { failed: 'review', attempt: 1, ceiling: 2 }, 'rerun-after-fix': { stage: 'review' }, 'ceiling-reached': { stage: 'review', attempt: 2, ceiling: 2 },
    'no-progress': { stage: 'review' }, 'owner-pending': { stage: 'review' }, 'approval-stale': { stage: 'review' }, 'unshipped-role-pending': { stage: 'review' },
    'no-role': { stage: 'review', role: 'owner' }, archive: {}, archived: {}, 'previous-script': {}, 'schema-without-declaration': {},
    'ship-plan': {}, 'gh-error': { error: 'gh exited 1' }, 'no-pr': {}, 'not-pushed': { number: 12 }, 'checks-unreadable': { error: 'HTTP 502' },
    'check-failing': { checks: 'build (https://ci/build)' }, 'checks-pending': { checks: 'e2e' }, 'owner-merges': { number: 12 },
    'auto-merge-on': { number: 12, waiting: 'GitHub to merge' }, 'enable-auto-merge': { number: 12 }, 'pr-closed': { number: 12 },
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
  const dir = mkdtempSync(join(tmpdir(), 'flow-check-wrap-'));
  writeFileSync(join(dir, 'openspec'), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, 'openspec'), 0o755);
  return dir;
}
const withPath = (dir, extra = {}) => ({ ...process.env, PATH: `${dir}:${process.env.PATH}`, ...SHIP_ENV, ...extra });

test('flow-check readout: an archived change ends archived without asking OpenSpec for its status', () => {
  const root = mkdtempSync(join(tmpdir(), 'flow-check-arch-'));
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
  const empty = mkdtempSync(join(tmpdir(), 'flow-check-nopath-'));
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
  const bin = mkdtempSync(join(tmpdir(), 'flow-check-bin-'));
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
  const grill = row(read('plugins/openspec/skills/conduct/SKILL.md'), 'grill');
  assert.ok(grill.includes('<!-- devkit-stage') && grill.includes('requirements'), 'conduct grill row');
  const agents = { 'plan-readiness-reviewer': 'readiness', 'pr-verifier': 'evidence', 'change-planner': 'proposal' };
  for (const [name, stage] of Object.entries(agents)) {
    const text = read(`plugins/core/agents/${name}.md`);
    assert.ok(text.includes('<!-- devkit-stage'), `${name} names the header`);
    assert.ok(text.includes(stage), `${name} names ${stage}`);
  }
  const first = read('plugins/core/skills/plan-readiness-review/templates/report.md').split('\n')[0];
  assert.deepEqual(parseStageHeader(first + '\n'), { stage: 'readiness', result: 'pending', attempt: 1, commit: 'none' });
});
