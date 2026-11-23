// node --test --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs
// project-phases: the `devkit-project` schema, the slice's records, the checker's reading of them (phase 1).
// Imported by guard.test.mjs, so the whole suite runs this file too. Phase 3 adds the tests of the loop (`project-loop.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, cpSync, mkdirSync, realpathSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as GUARD from './guard.mjs';
import * as FC from './flow-check.mjs';
import * as CL from './change-loop.mjs';
import * as PL from './project-loop.mjs';
import * as RL from './roadmap-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_SCHEMAS = join(HERE, '..', 'schemas');
const REPO_ROOT = join(HERE, '..', '..', '..');
const REPO_SCHEMAS = join(REPO_ROOT, 'openspec', 'schemas');
const CORE_AGENTS = join(HERE, '..', '..', 'core', 'agents');

const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const ENV = { ...process.env, ...BLANKS };

const SLICE_ARTIFACTS = ['business', 'domain-model', 'architecture', 'implementation-plan', 'roadmap', 'review'];
const SLICE_FILES = SLICE_ARTIFACTS.map((s) => `${s}.md`);
const SLICE_STAGES = ['open', ...SLICE_ARTIFACTS, 'delivery'];
const FORBIDDEN = ['devkit-core:', 'subagent_type', 'Agent tool', 'AskUserQuestion', 'Workflow tool', 'Claude'];

const flowOf = (base) => JSON.parse(readFileSync(join(base, 'devkit-project', 'flow.json'), 'utf8'));
const filesUnder = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));

const run = (cwd, cmd, ...args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout;
};

// One scratch project with the slice schema copied in from the pack (the installer is task 1.4's) and one slice.
let sliceCache = null;
function scratchSlice() {
  if (sliceCache) return sliceCache;
  const root = realpathSync(tmpFolder('devkit-slice-'));
  run(root, 'git', 'init', '-q');
  run(root, 'openspec', 'init', '--tools', 'none', '--no-animation', '.');
  mkdirSync(join(root, 'openspec', 'schemas'), { recursive: true });
  cpSync(join(PLUGIN_SCHEMAS, 'devkit-project'), join(root, 'openspec', 'schemas', 'devkit-project'), { recursive: true });
  run(root, 'openspec', 'new', 'change', 'billing', '--schema', 'devkit-project');
  const status = JSON.parse(run(root, 'openspec', 'status', '--change', 'billing', '--json'));
  sliceCache = { root, status };
  return sliceCache;
}
// test-fixture-cleanup: made at module level, so the sweep removes it and no test's end does.
scratchSlice();

// The first line of each instruction of a schema.yaml, keyed by the artifact id.
function instructionsOf(yaml) {
  const lines = yaml.split('\n');
  const out = {};
  let owner = null;
  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].match(/^ {2}- id: (\S+)/);
    if (id) owner = id[1];
    if (owner && /^\s+instruction: \|\s*$/.test(lines[i])) {
      const body = [];
      for (const l of lines.slice(i + 1)) { if (l.trim() !== '' && !/^\s{6}/.test(l)) break; body.push(l); }
      out[owner] = body.map((l) => l.slice(6)).join('\n').trim();
    }
  }
  return out;
}

test('project-loop schema: a new slice created with the shipped schema has the six artifacts in order and skips the specs', () => {
  const { root, status } = scratchSlice();
  assert.deepEqual(status.artifacts.map((a) => a.id), SLICE_ARTIFACTS);
  assert.equal(status.schemaName, 'devkit-project');
  const meta = readFileSync(join(root, 'openspec', 'changes', 'billing', '.openspec.yaml'), 'utf8');
  assert.match(meta, /^schema: devkit-project$/m);
  assert.match(meta, /^skip_specs: true$/m);
});

test('project-loop schema: the declaration lists open, the six stages and the delivery, the review at ceiling 2 and back to architecture', () => {
  const flow = flowOf(PLUGIN_SCHEMAS);
  assert.equal(flow.script, 'devkit-project');
  assert.deepEqual(flow.stages.map((s) => s.id), SLICE_STAGES);
  const review = flow.stages.find((s) => s.id === 'review');
  assert.equal(review.ceiling, 2);
  assert.equal(review.onFail, 'architecture');
  assert.equal(review.codeBound, true);
  assert.deepEqual(review.staleAfter, ['business', 'domain-model', 'architecture', 'implementation-plan', 'roadmap']);
  assert.doesNotThrow(() => FC.readFlowFile(join(PLUGIN_SCHEMAS, 'devkit-project', 'flow.json'), 'devkit-project'));
});

test('project-loop schema: each artifact generates the file of its stage', () => {
  const flow = flowOf(PLUGIN_SCHEMAS);
  const yaml = readFileSync(join(PLUGIN_SCHEMAS, 'devkit-project', 'schema.yaml'), 'utf8');
  const generated = [...yaml.matchAll(/^ {2}- id: (\S+)\n {4}generates: (\S+)/gm)].map((m) => [m[1], m[2]]);
  assert.deepEqual(generated, flow.stages.filter((s) => s.source === 'artifact').map((s) => [s.id, s.file]));
  assert.equal(yaml.includes('\napply:'), false, 'no apply block');
});

test('project-loop schema: each instruction opens with the role of its stage and carries the stage header paragraph of the other scripts', () => {
  const flow = flowOf(PLUGIN_SCHEMAS);
  const mine = instructionsOf(readFileSync(join(PLUGIN_SCHEMAS, 'devkit-project', 'schema.yaml'), 'utf8'));
  const lite = instructionsOf(readFileSync(join(PLUGIN_SCHEMAS, 'devkit-lite', 'schema.yaml'), 'utf8'));
  const paragraph = (text, stage) => {
    const at = text.indexOf("The file's first line is the stage header");
    assert.ok(at >= 0, `${stage} has the header paragraph`);
    return text.slice(at, text.indexOf('\n\n', at)).replaceAll(stage, '<stage>');
  };
  const want = paragraph(lite.requirements, 'requirements');
  for (const s of flow.stages.filter((x) => x.source === 'artifact')) {
    assert.ok(mine[s.id], `${s.id} has an instruction`);
    assert.ok(mine[s.id].startsWith(`Role: ${s.role}.`), `${s.id} names ${s.role}`);
    assert.equal(paragraph(mine[s.id], s.id), want, `${s.id} header paragraph`);
  }
  assert.match(mine.business, /^Role: project-coordinator\. Skills: design-business-discovery\./);
  assert.match(mine['domain-model'], /^Role: project-coordinator\. Skills: design-domain-model, ddd-strategic-design\./);
});

test('project-loop schema: each template starts with the pending header of its stage', () => {
  for (const base of [PLUGIN_SCHEMAS, REPO_SCHEMAS]) {
    const dir = join(base, 'devkit-project', 'templates');
    assert.deepEqual(readdirSync(dir).sort(), SLICE_FILES.slice().sort());
    for (const stage of SLICE_ARTIFACTS) {
      const text = readFileSync(join(dir, `${stage}.md`), 'utf8');
      assert.equal(text.split('\n')[0], `<!-- devkit-stage ${stage} result=pending attempt=1 commit=none -->`, `${stage} line 1`);
      assert.deepEqual(GUARD.parseStageHeader(text), { stage, result: 'pending', attempt: 1, commit: 'none' });
    }
  }
  const roadmap = readFileSync(join(PLUGIN_SCHEMAS, 'devkit-project', 'templates', 'roadmap.md'), 'utf8');
  assert.ok(roadmap.includes('<!-- devkit-rounds:begin -->') && roadmap.includes('<!-- devkit-rounds:end -->'), 'the two round markers');
});

test('project-loop schema: no file of the schema names a platform tool', () => {
  for (const base of [PLUGIN_SCHEMAS, REPO_SCHEMAS]) {
    const files = filesUnder(join(base, 'devkit-project'));
    assert.ok(files.length >= 8, 'the schema folder holds its eight files');
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const word of FORBIDDEN) assert.ok(!text.includes(word), `${file} names ${word}`);
    }
  }
});

test('project-loop schema: docs/roles.md has a section for every role and helper of the declaration', () => {
  const doc = readFileSync(join(REPO_ROOT, 'docs', 'roles.md'), 'utf8');
  const headings = new Set(doc.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()));
  const wanted = new Set(flowOf(PLUGIN_SCHEMAS).stages.flatMap((s) => [s.role, ...(s.helpers ?? [])]));
  assert.ok(wanted.has('project-coordinator') && wanted.has('adr-reviewer') && wanted.has('commit-and-pr'));
  for (const role of wanted) assert.ok(headings.has(role), `docs/roles.md has "## ${role}"`);
});

test('project-loop schema: the agents of the shipped roles list exactly their stages\' skills and only project-coordinator has no agent file', () => {
  const flow = flowOf(PLUGIN_SCHEMAS);
  const noAgentByDesign = ['owner', 'change-coordinator', 'review-bench'];
  const roles = [...new Set(flow.stages.flatMap((s) => [s.role, ...(s.helpers ?? [])]))].filter((r) => !noAgentByDesign.includes(r));
  assert.deepEqual(roles.filter((r) => !existsSync(join(CORE_AGENTS, `${r}.md`))), ['project-coordinator']);
  const skillsOf = (text) => {
    const front = text.split('---')[1] ?? '';
    const at = front.split('\n').findIndex((l) => l === 'skills:');
    if (at < 0) return [];
    return front.split('\n').slice(at + 1).filter((l) => l.startsWith('  - ')).map((l) => l.slice(4).trim());
  };
  for (const role of roles.filter((r) => r !== 'project-coordinator')) {
    const stage = flow.stages.find((s) => s.role === role);
    assert.deepEqual(skillsOf(readFileSync(join(CORE_AGENTS, `${role}.md`), 'utf8')), stage.skills, `${role} skills`);
  }
  assert.deepEqual(CL.scriptAgents(flow), ['adr-reviewer', 'commit-and-pr'], 'a hand-off list never names the project coordinator');
});

test('project-loop schema: the two copies of the schema are byte-identical', () => {
  const a = filesUnder(join(PLUGIN_SCHEMAS, 'devkit-project')).map((f) => f.slice(join(PLUGIN_SCHEMAS, 'devkit-project').length)).sort();
  const b = filesUnder(join(REPO_SCHEMAS, 'devkit-project')).map((f) => f.slice(join(REPO_SCHEMAS, 'devkit-project').length)).sort();
  assert.deepEqual(b, a);
  for (const f of a) {
    assert.equal(readFileSync(join(REPO_SCHEMAS, 'devkit-project', f), 'utf8'), readFileSync(join(PLUGIN_SCHEMAS, 'devkit-project', f), 'utf8'), f);
  }
});

test('project-loop schema: PROJECT_STAGE_FILES are the artifact files of the declaration', () => {
  const files = flowOf(PLUGIN_SCHEMAS).stages.filter((s) => s.source === 'artifact').map((s) => s.file);
  assert.deepEqual(GUARD.PROJECT_STAGE_FILES, files);
  assert.deepEqual(GUARD.PROJECT_STAGE_FILES, SLICE_FILES);
});

test('project-loop schema: the stage header reader of guard.mjs and flow-check.mjs is one function', () => {
  assert.equal(typeof GUARD.parseStageHeader, 'function');
  assert.equal(GUARD.parseStageHeader, FC.parseStageHeader);
  assert.equal(GUARD.STAGE_HEADER, FC.STAGE_HEADER);
});

// ---------------------------------------------------------------- the checker over a slice's records (D-3)

const T0 = 1_000_000_000_000;
function sliceFacts(extra = {}, flow = flowOf(PLUGIN_SCHEMAS)) {
  const files = {};
  for (const s of flow.stages.filter((x) => x.source === 'artifact')) {
    files[s.id] = [{ path: s.file, header: { stage: s.id, result: 'passed', attempt: 1, commit: 'c000000' }, mtimeMs: T0 }];
  }
  return {
    id: 'billing', schema: 'devkit-project', archived: false, head: 'c000000', opened: true, skipped: [], files,
    tasks: { exists: false, total: 0, done: 0, pending: [] }, dirty: [], staleness: () => null,
    fingerprint: '0123456789ab', delivery: () => ({ state: 'passed' }), ...extra,
  };
}

test('project-loop schema: an active slice with every stage passed ends blocked on the retro stage its script does not declare', () => {
  const r = FC.computeFlow(sliceFacts(), flowOf(PLUGIN_SCHEMAS), {});
  assert.equal(r.next ?? null, null);
  assert.equal(r.end.state, 'blocked');
  assert.equal(r.end.reasonCode, 'undeclared-stage');
  assert.equal(r.end.params.stage, 'retro');
  assert.match(r.end.reason, /declares no retro stage/);
});

test('project-loop schema: a failing check on the delivery ends blocked naming the implementation stage and the check', () => {
  const delivery = () => ({ next: { stage: 'implementation', reasonCode: 'check-failing', params: { checks: 'check (https://example.test/run/1)' } } });
  const r = FC.computeFlow(sliceFacts({ delivery }), flowOf(PLUGIN_SCHEMAS), {});
  assert.equal(r.end.state, 'blocked');
  assert.equal(r.end.reasonCode, 'undeclared-stage');
  assert.equal(r.end.params.stage, 'implementation');
  assert.match(r.end.reason, /declares no implementation stage/);
  assert.match(r.end.reason, /check \(https:\/\/example\.test\/run\/1\)/);
});

test('project-loop schema: the undeclared-stage sentence exists in both languages', () => {
  const params = { stage: 'retro', why: 'every stage passed' };
  assert.match(FC.reasonText('en', 'undeclared-stage', params), /retro/);
  assert.match(FC.reasonText('pt-BR', 'undeclared-stage', params), /retro/);
  assert.notEqual(FC.reasonText('pt-BR', 'undeclared-stage', params), FC.reasonText('en', 'undeclared-stage', params));
});

test('project-loop schema: devkit and devkit-lite still offer the retro after every stage passed', () => {
  for (const schema of ['devkit', 'devkit-lite']) {
    const flow = JSON.parse(readFileSync(join(PLUGIN_SCHEMAS, schema, 'flow.json'), 'utf8'));
    const facts = { ...sliceFacts({}, flow), schema, tasks: { exists: true, total: 0, done: 0, pending: [] } };
    facts.files.retro = [];
    const r = FC.computeFlow(facts, flow, {});
    assert.equal(r.next?.stage, 'retro', schema);
  }
});

// ---------------------------------------------------------------- phase 2: the slice contract in CI and in the hook (D-11, D-12)

const DELIVER_FILE = join(HERE, 'deliver-check.mjs');
const GUARD_FILE = join(HERE, 'guard.mjs');
const BASE_ROADMAP = '# Roadmap\n\n## Round 1\n- [ ] first\n';
const ARCHIVE = 'openspec/changes/archive/2026-11-21-billing';
const header = (stage, result = 'passed') => `<!-- devkit-stage ${stage} result=${result} attempt=1 commit=none -->\n# ${stage}\n`;

const gitq = (cwd, ...args) => run(cwd, 'git', '-c', 'user.name=t', '-c', 'user.email=t@t.t', ...args);
const put = (root, files) => {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
};
const commitAll = (root, message) => { gitq(root, 'add', '-A'); gitq(root, 'commit', '-q', '-m', message); return gitq(root, 'rev-parse', 'HEAD').trim(); };

// A slice branch `billing` over a base `main` (also `origin/main`): one commit with the slice's documents and an ADR, then
// the archive commit holding the six records and the ADR review of that first commit. `records` replaces a record's text
// (null removes it), `review` is (ctx) => text | null, `before(root)` runs before the archive commit, `after(root)` after it.
function sliceRepo({ records = {}, review, before, after, baseRoadmap = BASE_ROADMAP, roadmap, extra = {} } = {}) {
  const root = realpathSync(tmpFolder('devkit-slice-ci-'));
  gitq(root, 'init', '-q', '-b', 'main');
  put(root, { 'openspec/changes/archive/.gitkeep': '', 'openspec/config.yaml': 'schema: devkit\n', 'src/app.ts': 'a\n', ...(baseRoadmap === null ? {} : { 'openspec/roadmap.md': baseRoadmap }) });
  cpSync(join(PLUGIN_SCHEMAS, 'devkit-project'), join(root, 'openspec', 'schemas', 'devkit-project'), { recursive: true });
  commitAll(root, 'base');
  gitq(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  gitq(root, 'switch', '-q', '-c', 'billing');
  put(root, { 'docs/design/billing/1-business-vision.md': 'vision\n', 'docs/adr/0001-first.md': 'adr\n' });
  const docSha = commitAll(root, 'documents');
  const files = { '.openspec.yaml': 'schema: devkit-project\n' };
  for (const stage of SLICE_ARTIFACTS) files[`${stage}.md`] = header(stage);
  for (const [file, text] of Object.entries(records)) { if (text === null) delete files[file]; else files[file] = text; }
  const reviewText = review ? review({ root, docSha }) : `Verdict: APPROVED\nCommit: ${docSha}\n\n# ADR review\n`;
  if (reviewText !== null) files['reviews/adr-reviewer.md'] = reviewText;
  put(root, Object.fromEntries(Object.entries(files).map(([f, t]) => [`${ARCHIVE}/${f}`, t])));
  if (roadmap !== undefined) put(root, { 'openspec/roadmap.md': roadmap });
  put(root, extra);
  before?.(root);
  commitAll(root, 'archive the slice');
  after?.(root);
  return root;
}

const headOf = (root) => gitq(root, 'rev-parse', 'HEAD').trim();
function ciEnv(root, env = {}) {
  const event = join(tmpFolder('devkit-project-loop-event-'), `event-${headOf(root).slice(0, 7)}.json`);
  writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: headOf(root) } } }));
  return { ...ENV, GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'billing', GITHUB_EVENT_PATH: event, ...env };
}
// The same check through both entries: deliver-check.mjs --ci and guard.mjs ci.
const bothCi = (root, env = {}) => [[DELIVER_FILE, '--ci'], [GUARD_FILE, 'ci']].map((argv) => {
  const r = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8', env: ciEnv(root, env) });
  return { code: r.status, out: r.stdout, err: r.stderr };
});
const failsWith = (root, pattern, env) => {
  for (const r of bothCi(root, env)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, pattern);
    assert.doesNotMatch(r.out, /passed the slice contract/);
  }
};
const hook = (mode, root, input, env = {}) => {
  const r = spawnSync(process.execPath, [GUARD_FILE, mode], { cwd: root, encoding: 'utf8', env: { ...ENV, ...env }, input: JSON.stringify({ cwd: root, ...input }) });
  return { code: r.status, err: r.stderr, out: r.stdout };
};
const prCreate = (root, env) => hook('bash', root, { tool_name: 'Bash', tool_input: { command: 'gh pr create --title t --body b' } }, env);
const writeEdit = (root, file, agent) => hook('edit', root, { tool_name: 'Write', tool_input: { file_path: join(root, file) }, ...(agent ? { agent_type: `devkit-core:${agent}`, agent_id: 'x' } : {}) });
const withNewCommit = (root, file, text = 'x\n') => { put(root, { [file]: text }); commitAll(root, `touch ${file}`); };

test('project-loop ci: a complete slice passes the slice contract from both entries', () => {
  const root = sliceRepo();
  for (const r of bothCi(root)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /slice billing: passed the slice contract/);
  }
});

test('project-loop ci: a slice record missing is named', () => {
  failsWith(sliceRepo({ records: { 'domain-model.md': null } }), /domain-model\.md is missing/);
});

test('project-loop ci: a record that opens with another stage\'s header is named', () => {
  failsWith(sliceRepo({ records: { 'domain-model.md': header('architecture') } }), /domain-model\.md opens with the header of stage architecture, not domain-model/);
});

test('project-loop ci: a phase record that says pending is named with its result', () => {
  failsWith(sliceRepo({ records: { 'architecture.md': header('architecture', 'pending') } }), /architecture\.md says result=pending/);
});

test('project-loop ci: review.md that is not passed is named', () => {
  failsWith(sliceRepo({ records: { 'review.md': header('review', 'failed') } }), /review\.md says result=failed, not passed/);
});

test('project-loop ci: a missing ADR verdict file is named', () => {
  failsWith(sliceRepo({ review: () => null }), /reviews\/adr-reviewer\.md is missing/);
});

test('project-loop ci: a rejected first Verdict line is named even when a later line approves', () => {
  failsWith(sliceRepo({ review: ({ docSha }) => `Verdict: BLOCKED\nCommit: ${docSha}\n\nVerdict: APPROVED\n` }), /reviews\/adr-reviewer\.md: Verdict is BLOCKED, not APPROVED or DECLINED/);
});

test('project-loop ci: an ADR verdict with no Commit line is named', () => {
  failsWith(sliceRepo({ review: () => 'Verdict: APPROVED\n\n# ADR review\n' }), /reviews\/adr-reviewer\.md has no Commit: line/);
});

test('project-loop ci: an ADR verdict whose commit is not an ancestor of the head is named', () => {
  const side = { sha: '' };
  const root = sliceRepo({ review: ({ root: r }) => {
    side.sha = gitq(r, 'commit-tree', 'HEAD^{tree}', '-m', 'elsewhere').trim();
    return `Verdict: APPROVED\nCommit: ${side.sha}\n`;
  } });
  failsWith(root, new RegExp(`Commit ${side.sha.slice(0, 7)} is not an ancestor of HEAD`));
});

for (const folder of ['docs/design/billing/2-domain-model.md', 'docs/adr/0002-later.md', 'docs/decisions/0002-later.md']) {
  test(`project-loop ci: a later commit touching ${folder.split('/').slice(0, -1).join('/')}/ makes the ADR review stale`, () => {
    const root = sliceRepo({ after: (r) => withNewCommit(r, folder) });
    failsWith(root, new RegExp(`the ADR review is behind [0-9a-f]{7}, which changes ${folder.replace(/\./g, '\\.')}`));
  });
}

test('project-loop ci: a file outside the slice\'s paths is named', () => {
  failsWith(sliceRepo({ extra: { 'src/app.ts': 'changed\n' } }), /src\/app\.ts is outside the slice's files/);
});

test('project-loop ci: a flat docs/design file is outside the slice\'s paths', () => {
  failsWith(sliceRepo({ extra: { 'docs/design/1-business-vision.md': 'flat\n' } }), /docs\/design\/1-business-vision\.md is outside the slice's files/);
});

test('project-loop ci: an existing roadmap line rewritten is refused', () => {
  failsWith(sliceRepo({ roadmap: '# Roadmap\n\n## Round 1\n- [x] first\n' }), /openspec\/roadmap\.md may only be appended to by a slice/);
});

test('project-loop ci: the roadmap touched while roadmap.md is not applicable is refused', () => {
  const root = sliceRepo({ records: { 'roadmap.md': header('roadmap', 'not-applicable') }, roadmap: `${BASE_ROADMAP}\n## Round 2\n- [ ] second\n` });
  failsWith(root, /openspec\/roadmap\.md must stay as it was: roadmap\.md of the slice is not applicable/);
});

test('project-loop ci: a slice that deletes the roadmap is refused, not thrown', () => {
  const root = sliceRepo({ before: (r) => rmSync(join(r, 'openspec', 'roadmap.md')) });
  failsWith(root, /openspec\/roadmap\.md may only be appended to by a slice: the slice deleted it/);
});

test('project-loop hook: gh pr create is refused when the slice deletes the roadmap', () => {
  const root = sliceRepo({ before: (r) => rmSync(join(r, 'openspec', 'roadmap.md')) });
  const r = prCreate(root);
  assert.equal(r.code, 2);
  assert.match(r.err, /openspec\/roadmap\.md may only be appended to by a slice: the slice deleted it/);
});

test('project-loop ci: rounds appended after the base\'s bytes pass', () => {
  const root = sliceRepo({ roadmap: `${BASE_ROADMAP}\n## Round 2\n- [ ] second\n` });
  for (const r of bothCi(root)) { assert.equal(r.code, 0, r.out + r.err); assert.match(r.out, /passed the slice contract/); }
});

test('project-loop ci: a roadmap absent at the base passes when the slice adds it', () => {
  const root = sliceRepo({ baseRoadmap: null, roadmap: BASE_ROADMAP });
  for (const r of bothCi(root)) { assert.equal(r.code, 0, r.out + r.err); assert.match(r.out, /passed the slice contract/); }
});

test('project-loop ci: a merge of a base with an unrelated product commit keeps the review current', () => {
  const root = sliceRepo({ after: (r) => {
    gitq(r, 'switch', '-q', 'main');
    withNewCommit(r, 'src/other.ts');
    gitq(r, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitq(r, 'switch', '-q', 'billing');
    gitq(r, 'merge', '-q', '--no-edit', 'main');
  } });
  for (const r of bothCi(root)) { assert.equal(r.code, 0, r.out + r.err); assert.match(r.out, /passed the slice contract/); }
});

const ADR_VERDICT_UNCOMMITTED = ({ docSha }) => `Verdict: APPROVED\nCommit: ${docSha} (uncommitted changes)\n\n# ADR review\n`;

test('project-loop ci: followups 1: an ADR verdict whose Commit resolves to no commit is named', () => {
  failsWith(sliceRepo({ review: () => 'Verdict: APPROVED\nCommit: ' + 'ab12'.repeat(10) + '\n\n# ADR review\n' }), /reviews\/adr-reviewer\.md: Commit ab12ab1 does not resolve to a commit/);
});

test('project-loop ci: followups 2: a record whose first line is not a stage header is named', () => {
  for (const text of ['# business\n', '', '\n' + header('business')]) {
    failsWith(sliceRepo({ records: { 'business.md': text } }), /business\.md has no stage header on its first line/);
  }
});

test('project-loop ci: followups 3: a record whose first line starts like a stage header and is not one is named malformed', () => {
  for (const text of ['<!-- devkit-stage architecture result=done attempt=1 commit=none -->\n# a\n', '<!-- devkit-stage architecture result=passed attempt=1 commit=none\n# a\n']) {
    failsWith(sliceRepo({ records: { 'architecture.md': text } }), /architecture\.md has a malformed stage header/);
  }
});

test('project-loop ci: followups 4: the slice contract with no base ref names it and does not throw', () => {
  const root = sliceRepo();
  let problems;
  assert.doesNotThrow(() => { problems = GUARD.sliceProblems(root, ARCHIVE, { base: 'origin/nope' }); });
  assert.deepEqual(problems, ['origin/nope is not available to compare the slice with; fetch the full history']);
});

test('project-loop hook: followups 5: gh pr create is refused when the default branch shares no history with the slice', () => {
  const root = sliceRepo({ after: (r) => gitq(r, 'update-ref', 'refs/remotes/origin/main', gitq(r, 'commit-tree', 'HEAD^{tree}', '-m', 'unrelated').trim()) });
  const r = prCreate(root);
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /origin\/main is not available to compare the slice with; fetch the full history/);
});

test('project-loop ci: followups 6: an ADR verdict recorded with uncommitted changes is named, whatever its commit', () => {
  const seen = { docSha: '' };
  const marked = sliceRepo({ review: (ctx) => { seen.docSha = ctx.docSha; return ADR_VERDICT_UNCOMMITTED(ctx); } });
  failsWith(marked, new RegExp(`reviews/adr-reviewer\\.md: Commit ${seen.docSha.slice(0, 7)} was recorded with uncommitted changes`));
  const root = sliceRepo({ review: () => 'Verdict: APPROVED\nCommit: ' + 'ab12'.repeat(10) + ' (uncommitted changes)\n\n# ADR review\n' });
  failsWith(root, /Commit ab12ab1 was recorded with uncommitted changes/);
  for (const r of bothCi(root)) assert.doesNotMatch(r.out, /does not resolve/);
});

test('project-loop hook: followups 7: gh pr create is refused for an ADR verdict recorded with uncommitted changes', () => {
  const seen = { docSha: '' };
  const root = sliceRepo({ review: (ctx) => { seen.docSha = ctx.docSha; return ADR_VERDICT_UNCOMMITTED(ctx); } });
  const r = prCreate(root);
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, new RegExp(`reviews/adr-reviewer\\.md: Commit ${seen.docSha.slice(0, 7)} was recorded with uncommitted changes`));
});

test('project-loop ci: followups 10: a merge of a base that brings an ADR makes the review stale', () => {
  const root = sliceRepo({ after: (r) => {
    gitq(r, 'switch', '-q', 'main');
    withNewCommit(r, 'docs/adr/0002-other.md');
    gitq(r, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitq(r, 'switch', '-q', 'billing');
    gitq(r, 'merge', '-q', '--no-edit', 'main');
  } });
  failsWith(root, new RegExp('the ADR review is behind ' + headOf(root).slice(0, 7) + ', which changes docs/adr/0002-other\\.md'));
});

test('project-loop ci: a selected active slice fails saying it reaches the default branch archived', () => {
  const root = sliceRepo({ before: (r) => { renameSync(join(r, ARCHIVE), join(r, 'openspec/changes/billing')); } });
  failsWith(root, /a slice reaches the default branch with its folder archived in its pull request.*\/devkit project billing/s);
});

test('project-loop ci: a slice touched among several changes is a note, not judged', () => {
  const root = sliceRepo({ before: (r) => { renameSync(join(r, ARCHIVE), join(r, 'openspec/changes/billing')); put(r, { 'openspec/changes/other/.openspec.yaml': 'schema: devkit-lite\n', 'openspec/changes/other/notes.md': 'n\n' }); } });
  for (const r of bothCi(root, { GITHUB_HEAD_REF: 'chore/tidy' })) {
    assert.match(r.out, /note: billing is on the devkit-project script, not a devkit script/, r.out + r.err);
    assert.doesNotMatch(r.out, /slice billing/);
  }
});

test('project-loop ci: a spec-driven archived folder is still a note', () => {
  const root = sliceRepo({ before: (r) => put(r, { [`${ARCHIVE}/.openspec.yaml`]: 'schema: spec-driven\n' }) });
  for (const r of bothCi(root)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /note: billing is on the spec-driven script, not a devkit script/);
  }
});

test('project-loop hook: gh pr create in the slice\'s checkout passes the contract while another change is active', () => {
  const root = sliceRepo();
  put(root, { 'openspec/changes/other/.openspec.yaml': 'schema: devkit\n' });
  const r = prCreate(root);
  assert.equal(r.code, 0, r.err);
});

test('project-loop hook: gh pr create in the slice\'s checkout is refused naming review.md when it is missing', () => {
  const root = sliceRepo({ records: { 'review.md': null } });
  put(root, { 'openspec/changes/other/.openspec.yaml': 'schema: devkit\n' });
  const r = prCreate(root);
  assert.equal(r.code, 2);
  assert.match(r.err, /review\.md is missing/);
});

test('project-loop hook: the session writing an archived ADR verdict file is refused with no active change', () => {
  const root = sliceRepo();
  const r = writeEdit(root, `${ARCHIVE}/reviews/adr-reviewer.md`);
  assert.equal(r.code, 2);
  assert.match(r.err, /reviews\/adr-reviewer\.md is written only by the adr-reviewer agent/);
});

test('project-loop hook: the session writing an archived ADR verdict file is refused with another change active', () => {
  const root = sliceRepo();
  put(root, { 'openspec/changes/other/.openspec.yaml': 'schema: devkit\n' });
  assert.equal(writeEdit(root, `${ARCHIVE}/reviews/adr-reviewer.md`).code, 2);
});

test('project-loop hook: the session writing an archived ADR verdict file through the shell is refused', () => {
  const root = sliceRepo();
  const r = hook('bash', root, { tool_name: 'Bash', tool_input: { command: `echo x > ${ARCHIVE}/reviews/adr-reviewer.md` } });
  assert.equal(r.code, 2);
  assert.match(r.err, /written only by the adr-reviewer agent/);
});

test('project-loop hook: the adr-reviewer agent writing its archived verdict file is not refused', () => {
  const root = sliceRepo();
  assert.equal(writeEdit(root, `${ARCHIVE}/reviews/adr-reviewer.md`, 'adr-reviewer').code, 0);
});

// ---- the locks of a change run and a roadmap run do not hold a project run (D-12)

const jl = (record) => JSON.stringify(record);
const typedLine = (args) => jl({ type: 'user', message: { role: 'user', content: `<command-message>devkit</command-message>\n<command-name>/devkit</command-name>\n<command-args>${args}</command-args>` } });
const printed = (text) => jl({ type: 'user', message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: text }] }, toolUseResult: { stdout: text } });
const transcript = (...lines) => {
  const file = join(realpathSync(tmpFolder('devkit-locks-')), 'session.jsonl');
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
const afterChangeRun = () => transcript(typedLine('change add billing'), printed('devkit-run: add-billing\n{"version":1}'), typedLine('project billing'));
const afterRoadmapRun = () => transcript(typedLine('roadmap'), printed('devkit-roadmap: 2\n{"version":1}'), typedLine('project billing'));

test('project-loop locks: a typed project command after a change run leaves no change run', () => {
  assert.equal(GUARD.runOf({ transcript_path: afterChangeRun() }), null);
});

test('project-loop locks: a typed project command after a roadmap run leaves no roadmap run', () => {
  assert.equal(GUARD.roadmapRunOf({ transcript_path: afterRoadmapRun() }), null);
});

const RUNNING = [{ id: 'agent-0001', type: 'subagent', status: 'running', description: 'a stage', agent_type: 'devkit-core:change-planner' }];
const lockInput = (root, file, extra = {}) => ({ session_id: 'locks-1', transcript_path: file, permission_mode: 'bypassPermissions', ...extra });

test('project-loop locks: the stop and hand-off hooks refuse nothing in a project run', () => {
  const root = sliceRepo();
  for (const file of [afterChangeRun(), afterRoadmapRun()]) {
    const stop = hook('stop', root, lockInput(root, file, { hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'Launched.', background_tasks: RUNNING, session_crons: [] }));
    assert.deepEqual([stop.code, stop.err], [0, ''], 'stop');
    const agent = hook('agent', root, lockInput(root, file, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'a stage', prompt: 'Change x (devkit script), stage proposal: write it.', subagent_type: 'devkit-core:tdd-implementer' } }));
    assert.deepEqual([agent.code, agent.err], [0, ''], 'hand-off');
  }
});

test('project-loop locks: the session writes a phase document in the slice\'s checkout and no lock refuses it', () => {
  const root = realpathSync(tmpFolder('devkit-slice-edit-'));
  gitq(root, 'init', '-q', '-b', 'billing');
  put(root, { 'openspec/config.yaml': 'schema: devkit\n', 'openspec/changes/billing/.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n' });
  cpSync(join(PLUGIN_SCHEMAS, 'devkit-project'), join(root, 'openspec', 'schemas', 'devkit-project'), { recursive: true });
  const file = transcript(typedLine('change add billing'), printed('devkit-run: add-billing\n{"version":1}'), typedLine('project billing'));
  const r = hook('edit', root, { tool_name: 'Write', tool_input: { file_path: join(root, 'docs/design/billing/1-business-vision.md') }, transcript_path: file });
  assert.deepEqual([r.code, r.err], [0, '']);
});

// ================================================================ phase 3: the loop and the entry (project-loop.mjs)

const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline' });
const DESIGN_ON = JSON.stringify({ enabledPlugins: { 'devkit-design@devkit': true } });
const FIVE = ['business', 'domain-model', 'architecture', 'implementation-plan', 'roadmap'];
const DOC_OF = { business: '1-business-vision.md', 'domain-model': '2-domain-model.md', architecture: '3-architecture.md', 'implementation-plan': '4-implementation-plan.md' };
const ROUNDS_BLOCK = '## Round 2: billing\n- [ ] invoice-export — export invoices\n- [ ] invoice-mail (after: invoice-export) — mail them\n';
const headOf2 = (cwd) => gitq(cwd, 'rev-parse', 'HEAD').trim();

const body = (r) => JSON.parse(r.stdout);
const lp = (cwd, argv, { lang = 'en', ...opts } = {}) => PL.main([...argv, '--lang', lang], { cwd, env: ENV, gh: OFFLINE, ...opts });
const startP = (cwd, text, opts) => lp(cwd, ['start'], { stdin: text, ...opts });
const nextP = (cwd, slice, { after, ...opts } = {}) => lp(cwd, ['next', '--slice', slice, ...(after ? ['--after', after] : [])], opts);
const act = (cwd, slice, opts) => body(nextP(cwd, slice, opts));
const state = (cwd) => [gitq(cwd, 'status', '--porcelain'), gitq(cwd, 'branch', '--list', '--all'), gitq(cwd, 'worktree', 'list', '--porcelain'),
  existsSync(join(cwd, '.claude', 'worktrees')) ? readdirSync(join(cwd, '.claude', 'worktrees')).join(',') : ''].join('\n--\n');

// A scripted gh: it answers the reads the loop makes from `s` (a pull request, its checks, the repository's settings and
// the archive listing of the default branch) and records every call.
function scriptedGh(s = {}) {
  const calls = [];
  const out = (value) => ({ status: 0, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: '' });
  const fail = (stderr) => ({ status: 1, stdout: '', stderr });
  const pr = () => (typeof s.pr === 'function' ? s.pr() : s.pr);
  const fn = (args) => {
    calls.push(args);
    const a = args.join(' ');
    if (args[0] === 'api') {
      if (/contents\/openspec\/changes\/archive/.test(a)) return s.archived ? out(s.archived.map((name) => ({ name }))) : fail('HTTP 404');
      if (/rules\/branches/.test(a)) return out(s.rules ?? [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'devkit-reviews' }] } }]);
      if (/protection\/required_status_checks/.test(a)) return fail('HTTP 404 Not Found');
      if (a === 'api repos/{owner}/{repo}') return out(s.repo ?? { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true });
    }
    if (args[0] === 'pr' && args[1] === 'view') { const p = pr(); return p ? out(p) : fail('no pull requests found for branch "x"'); }
    if (args[0] === 'pr' && args[1] === 'list') { const p = pr(); return out(p ? [p] : []); }
    if (args[0] === 'pr' && args[1] === 'checks') return out(s.checks ?? []);
    return fail(`unexpected gh call: ${a}`);
  };
  fn.calls = calls;
  return fn;
}
const GREEN = [{ name: 'devkit-reviews', bucket: 'pass', link: 'https://checks.test/1' }];
const prOf = (wt, over = {}) => ({ number: 7, url: 'https://github.test/o/r/pull/7', state: 'OPEN', headRefOid: headOf2(wt), baseRefName: 'main', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', autoMergeRequest: null, body: '', ...over });

// A scratch project with a bare origin, the shipped schemas, a flat docs/design and the pack enabled.
function loopProject({ ship = 'merge', files = {}, settings = DESIGN_ON } = {}) {
  const root = realpathSync(tmpFolder('devkit-loop-'));
  gitq(root, 'init', '-q', '-b', 'main');
  put(root, {
    'openspec/config.yaml': `schema: devkit\nship:\n  devkit-project: ${ship}\n`, 'openspec/changes/archive/.gitkeep': '', 'openspec/roadmap.md': BASE_ROADMAP,
    '.gitignore': '.claude/worktrees/\n', '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n', 'docs/design/STATE.md': 'flat state\n',
    ...(settings ? { '.claude/settings.json': settings } : {}), ...files,
  });
  cpSync(join(PLUGIN_SCHEMAS, 'devkit-project'), join(root, 'openspec', 'schemas', 'devkit-project'), { recursive: true });
  commitAll(root, 'base');
  const origin = realpathSync(tmpFolder('devkit-loop-origin-'));
  gitq(origin, 'init', '-q', '--bare', '-b', 'main');
  gitq(root, 'remote', 'add', 'origin', origin);
  gitq(root, 'push', '-q', 'origin', 'main');
  gitq(root, 'fetch', '-q', 'origin');
  return { main: root, origin };
}
const openIn = (t, id = 'billing') => {
  const r = lp(t.main, ['open', id]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return body(r).worktree;
};
const rec = (wt, slice, stage, result = 'passed', text) => put(wt, { [`openspec/changes/${slice}/${stage}.md`]: text ?? header(stage, result) });
const roadmapRecord = (result = 'passed', block = ROUNDS_BLOCK) => `${header('roadmap', result)}\n## Source\nplan\n\n## Rounds to append\n<!-- devkit-rounds:begin -->\n${block}<!-- devkit-rounds:end -->\n\n## Owner's approval\n- "ok"\n`;
const settle = (wt, slice, stages = FIVE, { result = 'passed', notApplicable = [] } = {}) => {
  for (const s of stages) {
    const r = notApplicable.includes(s) ? 'not-applicable' : result;
    rec(wt, slice, s, r, s === 'roadmap' ? roadmapRecord(r) : undefined);
  }
};
const verdictFor = (wt, slice, sha, word = 'APPROVED', dir = `openspec/changes/${slice}`) => put(wt, { [`${dir}/reviews/adr-reviewer.md`]: `Verdict: ${word}\nCommit: ${sha}\n\n# ADR review\n` });
// A slice whose five stages are settled, its rounds written and its documents committed.
function readySlice(t, slice = 'billing', { notApplicable = [], write = true } = {}) {
  const wt = openIn(t, slice);
  settle(wt, slice, FIVE, { notApplicable });
  put(wt, { [`docs/design/${slice}/1-business-vision.md`]: 'vision\n' });
  if (write && !notApplicable.includes('roadmap')) assert.equal(lp(wt, ['rounds', slice, '--write']).code, 0);
  commitAll(wt, 'documents');
  return wt;
}
// The same slice reviewed and archived on its branch (the archive move uncommitted unless `commit`).
function archivedSlice(t, slice = 'billing', { commit = false, ...opts } = {}) {
  const wt = readySlice(t, slice, opts);
  verdictFor(wt, slice, headOf2(wt));
  assert.equal(lp(wt, ['record-review', slice]).code, 0);
  assert.equal(lp(wt, ['archive', slice]).code, 0);
  if (commit) commitAll(wt, 'archive the slice');
  return wt;
}
const archivedDirOf = (wt, slice = 'billing') => join(wt, 'openspec', 'changes', 'archive', readdirSync(join(wt, 'openspec', 'changes', 'archive')).find((n) => n.endsWith(`-${slice}`)));
const abs = (root, action) => {
  const d = action.detail;
  return [d.document, d.record, d.notes, d.adrFolder, d.findings, d.source, ...(d.earlier ?? [])].filter((p) => p !== undefined);
};

// ---------------------------------------------------------------- the entry in change-loop.mjs (D-4)

test('project-loop start: /devkit change start routes project to the project gate and runs nothing', () => {
  const t = loopProject();
  const before = state(t.main);
  const b = body(CL.main(['start', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: 'PROJECT  billing', gh: OFFLINE }));
  assert.deepEqual([b.mode, b.verb, b.text, b.change], ['project', 'project', 'billing', null]);
  assert.equal(b.reply, undefined, 'no reply: the skill calls project-loop');
  for (const config of ['schema: spec-driven\n', 'schema: devkit\ndevkit:\n  driver: robot\n', 'schema: devkit\ndevkit:\n  driver: compozy\n']) {
    const cwd = loopProject({ files: { 'openspec/config.yaml': config } }).main;
    const asked = body(CL.main(['start', '--lang', 'en'], { cwd, env: ENV, stdin: 'change add a thing', gh: OFFLINE }));
    const got = body(CL.main(['start', '--lang', 'en'], { cwd, env: ENV, stdin: 'project billing', gh: OFFLINE }));
    assert.deepEqual([got.mode, got.reply], [asked.mode, asked.reply], config);
  }
  assert.equal(state(t.main), before);
});

test('project-loop start: /devkit change <slice> says it is a slice and runs nothing', () => {
  const t = loopProject();
  put(t.main, { 'openspec/changes/billing/.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n' });
  commitAll(t.main, 'a slice');
  const before = state(t.main);
  const b = body(CL.main(['start', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: 'change billing', gh: OFFLINE }));
  assert.deepEqual([b.mode, b.change], ['is-slice', 'billing']);
  assert.equal(b.reply, CL.render('en', 'is-slice', { id: 'billing' }));
  assert.equal(state(t.main), before);
  put(t.main, { 'openspec/changes/archive/2026-01-01-old-slice/.openspec.yaml': 'schema: devkit-project\n' });
  assert.equal(body(CL.main(['start', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: 'change old-slice', gh: OFFLINE })).mode, 'is-slice', 'an archived slice too');
});

test('project-loop start: unfinished leaves a slice out of /devkit change and of the roadmap board, and keeps it on request', () => {
  const t = loopProject();
  put(t.main, { 'openspec/changes/billing/.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n', 'openspec/changes/add-export/.openspec.yaml': 'schema: devkit\n' });
  commitAll(t.main, 'a slice and a change');
  assert.deepEqual(CL.unfinished(t.main, { env: ENV, gh: OFFLINE }).map((u) => u.id), ['add-export']);
  assert.deepEqual(CL.unfinished(t.main, { env: ENV, gh: OFFLINE, slices: true }).map((u) => u.id), ['add-export', 'billing']);
  const ask = (text) => body(CL.main(['start', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: text, gh: OFFLINE }));
  assert.equal(ask('change').mode, 'resume');
  assert.equal(ask('change').change, 'add-export', 'a slice is not offered when /devkit change continues');
  assert.deepEqual(ask('change add a thing').unfinished.map((u) => u.id), ['add-export']);
  const only = loopProject();
  put(only.main, { 'openspec/changes/billing/.openspec.yaml': 'schema: devkit-project\n' });
  commitAll(only.main, 'a slice');
  assert.equal(body(CL.main(['start', '--lang', 'en'], { cwd: only.main, env: ENV, stdin: 'change', gh: OFFLINE })).mode, 'nothing');
  assert.equal(body(CL.main(['start', '--lang', 'en'], { cwd: only.main, env: ENV, stdin: 'change add a thing', gh: OFFLINE })).mode, 'new');
  const board = RL.main(['status', '--lang', 'en', '--load-limit', '80'], { cwd: only.main, env: ENV, stdin: '', gh: OFFLINE, load: () => 10 });
  assert.doesNotMatch(board.stdout, /billing/, 'roadmap-loop status shows no row for a slice');
});

// ---------------------------------------------------------------- start (D-5)

test('project-loop start: step 1 the project gate answers first, as for /devkit change', () => {
  for (const [config, mode] of [['schema: spec-driven\n', 'not-set-up'], ['schema: devkit\ndevkit:\n  driver: robot\n', 'setting-unknown'], ['schema: devkit\ndevkit:\n  driver: compozy\n', 'driver-not-built']]) {
    const t = loopProject({ files: { 'openspec/config.yaml': config }, settings: null });
    const before = state(t.main);
    const asked = body(CL.main(['start', '--lang', 'en'], { cwd: t.main, env: ENV, stdin: 'change x', gh: OFFLINE }));
    const b = body(startP(t.main, 'billing'));
    assert.deepEqual([b.mode, b.reply], [mode, asked.reply], config);
    assert.equal(state(t.main), before);
  }
});

test('project-loop start: step 2 without the design pack nothing runs and the reply names the pack', () => {
  for (const settings of [null, JSON.stringify({ enabledPlugins: { 'devkit-design@devkit': false } }), 'not json']) {
    const t = loopProject({ settings });
    const before = state(t.main);
    const b = body(startP(t.main, 'billing'));
    assert.equal(b.mode, 'design-pack-missing', String(settings));
    assert.equal(b.reply, CL.render('en', 'design-pack-missing'));
    assert.match(b.reply, /devkit-design/);
    assert.match(b.reply, /\/openspec-setup/);
    assert.equal(state(t.main), before);
  }
  const local = loopProject({ settings: null, files: { '.claude/settings.local.json': DESIGN_ON } });
  assert.equal(body(startP(local.main, 'billing')).mode, 'new', 'the local settings file enables it too');
});

test('project-loop start: step 3 no words resumes the one unfinished slice, lists several, asks for a name with none', () => {
  const t = loopProject();
  assert.deepEqual([body(startP(t.main, '')).mode, body(startP(t.main, '  ')).reply], ['project-name-needed', CL.render('en', 'project-name-needed')]);
  put(t.main, { 'openspec/changes/billing/.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n' });
  commitAll(t.main, 'one slice');
  const one = body(startP(t.main, ''));
  assert.deepEqual([one.mode, one.slice], ['resume', 'billing']);
  assert.match(one.reply, /^Continuing the slice billing: /);
  put(t.main, { 'openspec/changes/invoices/.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n' });
  commitAll(t.main, 'two slices');
  const many = body(startP(t.main, ''));
  assert.equal(many.mode, 'choose');
  assert.deepEqual(many.unfinished.map((u) => u.id), ['billing', 'invoices']);
  assert.match(many.reply, /^2 slices are unfinished: billing \(.+\); invoices \(.+\)\. Which one should I continue\?$/);
});

test('project-loop start: step 4 a text that is not one valid name, or is archive, is refused', () => {
  const t = loopProject();
  const before = state(t.main);
  for (const text of ['two words', 'Billing', 'a', '-x', 'x--y', 'archive', 'a'.repeat(49)]) {
    const b = body(startP(t.main, text));
    assert.equal(b.mode, 'name-invalid', text);
    assert.equal(b.reply, CL.render('en', 'name-invalid', { id: text }));
  }
  assert.equal(state(t.main), before);
});

test('project-loop start: step 5 the name of an unfinished slice resumes it, and the slice\'s own checkout is not needed', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  settle(wt, 'billing', ['business']);
  const b = body(startP(t.main, 'billing'));
  assert.deepEqual([b.mode, b.slice], ['resume', 'billing']);
  assert.match(b.reply, /^Continuing the slice billing: next is the domain model\.$/);
  assert.equal(body(startP(wt, 'billing')).mode, 'resume', 'the same from the slice\'s worktree');
});

test('project-loop start: step 6 a slice archived on the default branch is done already', () => {
  const t = loopProject();
  put(t.main, { 'openspec/changes/archive/2026-01-01-billing/.openspec.yaml': 'schema: devkit-project\n', 'openspec/changes/archive/2026-01-01-billing/roadmap.md': header('roadmap') });
  commitAll(t.main, 'archived slice');
  const b = body(startP(t.main, 'billing'));
  assert.deepEqual([b.mode, b.reply], ['project-done-already', CL.render('en', 'project-done-already', { id: 'billing' })]);
});

test('project-loop start: step 7 a change of that name is named as a change', () => {
  const t = loopProject();
  put(t.main, { 'openspec/changes/archive/2026-01-01-old-change/.openspec.yaml': 'schema: devkit\n' });
  commitAll(t.main, 'an archived change');
  const b = body(startP(t.main, 'old-change'));
  assert.deepEqual([b.mode, b.reply], ['is-change', CL.render('en', 'is-change', { id: 'old-change' })]);
  put(t.main, { 'openspec/changes/add-export/.openspec.yaml': 'schema: devkit\n' });
  commitAll(t.main, 'an active change');
  assert.equal(body(startP(t.main, 'add-export')).mode, 'is-change');
});

test('project-loop start: step 8 a design folder of that name on the default branch is refused', () => {
  const t = loopProject();
  put(t.main, { 'docs/design/billing/1-business-vision.md': 'x\n' });
  commitAll(t.main, 'a design folder');
  gitq(t.main, 'push', '-q', 'origin', 'main');
  const b = body(startP(t.main, 'billing'));
  assert.deepEqual([b.mode, b.reply], ['project-folder-exists', CL.render('en', 'project-folder-exists', { id: 'billing' })]);
  const local = loopProject();
  gitq(local.main, 'remote', 'remove', 'origin');
  put(local.main, { 'docs/design/invoices/STATE.md': 'x\n' });
  assert.equal(body(startP(local.main, 'invoices')).mode, 'project-folder-exists', 'the main checkout is read when there is no remote branch');
});

test('project-loop start: step 9 a new name gives new and creates nothing', () => {
  const t = loopProject();
  const before = state(t.main);
  const b = body(startP(t.main, 'billing'));
  assert.deepEqual([b.mode, b.slice, b.verb], ['new', null, 'project']);
  assert.equal(state(t.main), before);
});

test('project-loop start: a usage error exits 3 and creates nothing', () => {
  const t = loopProject();
  const before = state(t.main);
  const r = PL.main(['start', '--lang', 'en', '--bogus'], { cwd: t.main, env: ENV, stdin: 'billing', gh: OFFLINE });
  assert.equal(r.code, 3);
  assert.match(body(r).error, /unknown option --bogus/);
  assert.equal(body(r).reply, CL.render('en', 'project-unreadable'));
  assert.equal(state(t.main), before);
});

// ---------------------------------------------------------------- open (D-5)

test('project-loop start: open makes the slice\'s worktree, branch and change on the project script', () => {
  const t = loopProject();
  const r = lp(t.main, ['open', 'billing']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const b = body(r);
  const wt = join(t.main, '.claude', 'worktrees', 'billing');
  assert.deepEqual([b.slice, b.worktree, b.branch, b.base], ['billing', wt, 'billing', 'origin/main']);
  assert.equal(b.reply, CL.render('en', 'project-opened', { id: 'billing' }));
  assert.equal(gitq(wt, 'symbolic-ref', '--short', 'HEAD').trim(), 'billing');
  const meta = readFileSync(join(wt, 'openspec', 'changes', 'billing', '.openspec.yaml'), 'utf8');
  assert.match(meta, /^schema: devkit-project$/m);
  assert.deepEqual(readdirSync(join(wt, 'openspec', 'changes', 'billing')), ['.openspec.yaml'], 'no first file: the slice has no requirements');
  assert.equal(gitq(t.main, 'status', '--porcelain'), '', 'the main checkout stays clean');
  assert.doesNotMatch(r.stdout, /devkit-run:|devkit-end:/, 'no run line: no lock holds a project run');
});

test('project-loop start: open refuses a taken or invalid name and a failed open leaves nothing', () => {
  const t = loopProject();
  openIn(t, 'billing');
  const before = state(t.main);
  for (const [id, key] of [['billing', 'name-taken'], ['Bad Name', 'name-invalid'], ['archive', 'name-invalid']]) {
    const r = lp(t.main, ['open', id]);
    assert.equal(r.code, 3, id);
    assert.equal(body(r).reply, CL.render('en', key, { id }), id);
  }
  assert.equal(state(t.main), before);
  const failing = () => ({ status: 1, stdout: '', stderr: 'boom', missing: false, timedOut: false });
  const r = lp(t.main, ['open', 'invoices'], { openspec: failing });
  assert.equal(r.code, 3);
  assert.equal(state(t.main), before, 'the worktree, its registration and the branch are gone');
  assert.equal(gitq(t.main, 'branch', '--list', 'invoices').trim(), '');
});

test('project-loop start: unfinishedSlices lists an active slice and one archived on its branch, not one archived on the default branch', () => {
  const t = loopProject();
  const a = openIn(t, 'alpha');
  const b = archivedSlice(t, 'beta', { commit: true });
  put(t.main, { 'openspec/changes/archive/2026-01-01-gamma/.openspec.yaml': 'schema: devkit-project\n' });
  commitAll(t.main, 'gamma is archived on the default branch');
  const list = PL.unfinishedSlices(t.main, { env: ENV, gh: OFFLINE });
  assert.deepEqual(list.map((u) => [u.id, u.root, u.branch]), [['alpha', a, 'alpha'], ['beta', b, 'beta']]);
  assert.deepEqual(PL.unfinishedSlices(a, { env: ENV, gh: OFFLINE }).map((u) => u.id), ['alpha', 'beta'], 'the same from a worktree');
});

// ---------------------------------------------------------------- next (D-6)

test('project-loop next: S1 a slice found in no checkout, or a change, exits 3', () => {
  const t = loopProject();
  put(t.main, { 'openspec/changes/add-export/.openspec.yaml': 'schema: devkit\n' });
  commitAll(t.main, 'a change');
  for (const id of ['ghost', 'add-export']) {
    const r = nextP(t.main, id);
    assert.equal(r.code, 3, id);
    assert.equal(body(r).reply, CL.render('en', 'project-not-found', { id }));
  }
});

test('project-loop next: S2 a slice archived on the default branch ends delivered, with or without rounds', () => {
  for (const [result, key, code] of [['passed', 'project-delivered', 0], ['not-applicable', 'project-delivered-no-rounds', 0]]) {
    const t = loopProject();
    put(t.main, { 'openspec/changes/archive/2026-01-01-billing/.openspec.yaml': 'schema: devkit-project\n', 'openspec/changes/archive/2026-01-01-billing/roadmap.md': header('roadmap', result) });
    commitAll(t.main, 'archived slice');
    const r = nextP(t.main, 'billing');
    assert.equal(r.code, code);
    const a = body(r);
    assert.deepEqual([a.kind, a.end.state, a.end.why, a.reply], ['end', 'delivered', key, CL.render('en', key, { id: 'billing' })], result);
  }
});

test('project-loop next: S3 a folder without its metadata file ends blocked, not opened', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  rmSync(join(wt, 'openspec', 'changes', 'billing', '.openspec.yaml'));
  const r = nextP(t.main, 'billing');
  assert.equal(r.code, 2);
  const a = body(r);
  assert.deepEqual([a.kind, a.end.state, a.end.why, a.stage], ['end', 'blocked', 'not-opened', 'open']);
});

test('project-loop next: S4 a phase with no record is an interview with absolute paths under the slice\'s worktree', () => {
  const t = loopProject({ files: { 'docs/design/1-business-vision.md': 'flat\n' } });
  const wt = openIn(t, 'billing');
  const r = nextP(t.main, 'billing');
  assert.equal(r.code, 0);
  const a = body(r);
  assert.deepEqual([a.kind, a.step, a.stage, a.slice, a.root, a.branch], ['phase', 'interview', 'business', 'billing', wt, 'billing']);
  assert.deepEqual(a.detail.skills, ['design-business-discovery']);
  assert.equal(a.detail.document, join(wt, 'docs/design/billing/1-business-vision.md'));
  assert.equal(a.detail.record, join(wt, 'openspec/changes/billing/business.md'));
  assert.equal(a.detail.notes, join(wt, 'docs/design/billing/STATE.md'));
  assert.equal(a.detail.adrFolder, join(wt, 'docs/adr'));
  assert.deepEqual([a.detail.earlier, a.detail.flat], [[], true]);
  for (const p of abs(wt, a)) assert.ok(p.startsWith(`${wt}/`), `${p} is under ${wt}`);
  assert.match(a.progressKey, /^business\/interview@[0-9a-f]{12}$/);
  assert.equal(gitq(t.main, 'status', '--porcelain'), '', 'next writes nothing');
});

test('project-loop next: S4 a pending record waits for the owner\'s approval, a passed or not applicable one moves on', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  rec(wt, 'billing', 'business', 'pending');
  put(wt, { 'docs/design/billing/1-business-vision.md': 'v\n' });
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['phase', 'approval', 'business']);
  assert.equal(a.reply, CL.render('en', 'phase-approval', { id: 'billing', stage: 'Business' }));
  assert.deepEqual(a.detail.earlier, [], 'the document of the phase itself is not an earlier one');
  rec(wt, 'billing', 'business', 'passed');
  const b = act(t.main, 'billing');
  assert.deepEqual([b.step, b.stage, b.detail.skills], ['interview', 'domain-model', ['design-domain-model', 'ddd-strategic-design']]);
  assert.deepEqual(b.detail.earlier, [join(wt, 'docs/design/billing/1-business-vision.md')]);
  rec(wt, 'billing', 'domain-model', 'not-applicable');
  const c = act(t.main, 'billing');
  assert.deepEqual([c.step, c.stage], ['interview', 'architecture']);
  put(wt, { 'docs/decisions/0001-x.md': 'adr\n' });
  rmSync(join(wt, 'docs', 'adr'), { recursive: true, force: true });
  assert.equal(act(t.main, 'billing').detail.adrFolder, join(wt, 'docs/decisions'), 'the project\'s own ADR folder');
});

test('project-loop next: S5 a failed ADR review sends the owner back to the architecture, with the findings file', () => {
  const t = loopProject();
  const wt = readySlice(t);
  verdictFor(wt, 'billing', headOf2(wt), 'REJECTED');
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['phase', 'revise', 'architecture']);
  assert.equal(a.detail.findings, join(wt, 'openspec/changes/billing/reviews/adr-reviewer.md'));
  for (const p of abs(wt, a)) assert.ok(p.startsWith(`${wt}/`), p);
});

test('project-loop next: S6 the roadmap stage proposes and asks for approval, with absolute paths', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  settle(wt, 'billing', FIVE.slice(0, 4));
  put(wt, { 'docs/design/billing/4-implementation-plan.md': 'plan\n', 'openspec/roadmap.md': `${BASE_ROADMAP}\n## Round 3: later\n- [ ] later-one\n` });
  commitAll(wt, 'plan');
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['rounds', 'propose', 'roadmap']);
  assert.equal(a.detail.record, join(wt, 'openspec/changes/billing/roadmap.md'));
  assert.equal(a.detail.source, join(wt, 'docs/design/billing/4-implementation-plan.md'));
  assert.equal(a.detail.nextRound, 4);
  assert.match(a.detail.checkCommand.join(' '), /project-loop\.mjs rounds billing --lang en$/);
  assert.match(a.detail.writeCommand.join(' '), /project-loop\.mjs rounds billing --lang en --write$/);
  for (const p of abs(wt, a)) assert.ok(p.startsWith(`${wt}/`), p);
  rec(wt, 'billing', 'roadmap', 'pending', roadmapRecord('pending'));
  const b = act(t.main, 'billing');
  assert.deepEqual([b.kind, b.step], ['rounds', 'approval']);
  assert.equal(b.reply, CL.render('en', 'rounds-approval', { id: 'billing', list: 'invoice-export, invoice-mail' }));
  assert.equal(act(t.main, 'billing').detail.nextRound, 4);
});

test('project-loop next: S7 an approved roadmap record with rounds not on the roadmap is written by the loop', () => {
  const t = loopProject();
  const wt = readySlice(t, 'billing', { write: false });
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['session', 'write-rounds', 'roadmap']);
  assert.match(a.detail.command.join(' '), /project-loop\.mjs rounds billing --lang en --write$/);
  assert.equal(lp(wt, ['rounds', 'billing', '--write']).code, 0);
  commitAll(wt, 'rounds');
  assert.notEqual(act(t.main, 'billing').step, 'write-rounds');
  const na = openIn(t, 'invoices');
  settle(na, 'invoices', FIVE, { notApplicable: ['roadmap'] });
  put(na, { 'docs/design/invoices/1-business-vision.md': 'v\n' });
  commitAll(na, 'docs');
  assert.notEqual(act(t.main, 'invoices').step, 'write-rounds', 'a roadmap that does not apply is never written');
});

test('project-loop next: S8 uncommitted files outside openspec ask for a commit by name, nothing pushed', () => {
  const t = loopProject();
  const wt = readySlice(t);
  put(wt, { 'docs/design/billing/2-domain-model.md': 'new\n' });
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', 'devkit-core:commit-and-pr', 'commit', 'review']);
  assert.match(a.brief, new RegExp(`^Slice billing \\(devkit-project script\\), stage review: .*Work only in ${wt} on branch billing; every file path is absolute under it; start every Bash command with cd ${wt} && ; do not fetch\\. Write the slice's files in English\\.`));
  assert.match(a.brief, /Commit by name only the files under docs\/design\/billing\/, the ADR folders, openspec\/roadmap\.md and the slice's folder; never on the default branch\./);
  assert.match(a.brief, /push nothing/);
});

test('project-loop next: S9 a verdict for the current commit is recorded by the loop', () => {
  const t = loopProject();
  const wt = readySlice(t);
  verdictFor(wt, 'billing', headOf2(wt));
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['session', 'record-review', 'review']);
  assert.match(a.detail.command.join(' '), /project-loop\.mjs record-review billing --lang en$/);
  verdictFor(wt, 'billing', '0000000');
  assert.equal(act(t.main, 'billing').kind, 'agent', 'a verdict for another commit is not recorded');
});

test('project-loop next: S10 a clean slice with no current verdict hands the review to the ADR reviewer', () => {
  const t = loopProject();
  const wt = readySlice(t);
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', 'devkit-core:adr-reviewer', 'review', 'review']);
  assert.match(a.brief, /review the slice's diff against origin\/main \(the documents under docs\/design\/billing\/ and the new or changed files of the ADR folders\) against the project's ADRs, and write your verdict file to .*openspec\/changes\/billing\/reviews\/adr-reviewer\.md/);
  assert.ok(a.brief.includes(join(wt, 'openspec/changes/billing/reviews/adr-reviewer.md')));
});

test('project-loop next: S11 a settled review archives the slice', () => {
  const t = loopProject();
  const wt = readySlice(t);
  verdictFor(wt, 'billing', headOf2(wt));
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.step, a.stage], ['session', 'archive', 'delivery']);
  assert.match(a.detail.command.join(' '), /project-loop\.mjs archive billing --lang en$/);
});

test('project-loop next: S12 a review at its ceiling ends blocked', () => {
  const t = loopProject();
  const wt = readySlice(t);
  put(wt, { 'openspec/changes/billing/review.md': `${header('review', 'failed').replace('attempt=1', 'attempt=2').replace('commit=none', `commit=${headOf2(wt)}`)}` });
  const r = nextP(t.main, 'billing');
  assert.equal(r.code, 2);
  const a = body(r);
  assert.deepEqual([a.kind, a.end.state, a.end.why, a.stage], ['end', 'blocked', 'ceiling', 'review']);
  assert.match(a.reply, /failed 2 times, which is its limit/);
});

// The archived-on-its-branch rows: the slice reviewed and archived in its worktree.

test('project-loop next: S13 and S14 ship plan stops at the archive commit', () => {
  const t = loopProject({ ship: 'plan' });
  const wt = archivedSlice(t);
  const a = act(t.main, 'billing');
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', 'devkit-core:commit-and-pr', 'commit', 'delivery']);
  commitAll(wt, 'archive the slice');
  const b = act(t.main, 'billing');
  assert.deepEqual([b.kind, b.end.state, b.end.why, b.reply], ['end', 'waiting-for-owner', 'project-plan-mode', CL.render('en', 'project-plan-mode', { id: 'billing' })]);
  assert.equal(nextP(t.main, 'billing').code, 1);
});

test('project-loop next: S15 a review behind a later ADR change goes back to the ADR reviewer, a verdict for HEAD is recorded', () => {
  const t = loopProject();
  const wt = archivedSlice(t, 'billing', { commit: true });
  put(wt, { 'docs/adr/0002-later.md': 'adr\n' });
  commitAll(wt, 'a later ADR');
  const a = act(t.main, 'billing', { gh: scriptedGh() });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', 'devkit-core:adr-reviewer', 'review', 'review']);
  assert.ok(a.brief.includes(join(archivedDirOf(wt), 'reviews/adr-reviewer.md')), 'the verdict goes to the archived folder');
  verdictFor(wt, 'billing', headOf2(wt), 'APPROVED', `openspec/changes/archive/${archivedDirOf(wt).split('/').pop()}`);
  const b = act(t.main, 'billing', { gh: scriptedGh() });
  assert.deepEqual([b.kind, b.step], ['session', 'record-review']);
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  commitAll(wt, 'record the review');
  assert.equal(act(t.main, 'billing', { gh: scriptedGh() }).step, 'open-pr');
});

test('project-loop next: followups 9: a verdict for HEAD recorded with uncommitted changes goes back to the ADR reviewer, active or archived', () => {
  const expected = ['agent', 'devkit-core:adr-reviewer', 'review', 'review'];
  const active = loopProject();
  const wtA = readySlice(active);
  verdictFor(wtA, 'billing', `${headOf2(wtA)} (uncommitted changes)`);
  const a = act(active.main, 'billing', { gh: scriptedGh() });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], expected, 'active');
  const archived = loopProject();
  const wtB = archivedSlice(archived, 'billing', { commit: true });
  verdictFor(wtB, 'billing', `${headOf2(wtB)} (uncommitted changes)`, 'APPROVED', `openspec/changes/archive/${archivedDirOf(wtB).split('/').pop()}`);
  const b = act(archived.main, 'billing', { gh: scriptedGh() });
  assert.deepEqual([b.kind, b.agent, b.step, b.stage], expected, 'archived');
});

test('project-loop next: S16 an archived slice with no pull request opens one', () => {
  const t = loopProject();
  const wt = archivedSlice(t, 'billing', { commit: true });
  const gh = scriptedGh();
  const a = act(t.main, 'billing', { gh });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', 'devkit-core:commit-and-pr', 'open-pr', 'delivery']);
  assert.match(a.brief, /open one pull request to main titled `docs\(design\): billing`/);
  assert.match(a.brief, /never merge/);
  assert.ok(!gh.calls.some((c) => c[1] === 'merge'), 'the read never merges');
  assert.equal(archivedDirOf(wt).includes('billing'), true);
});

const openPr = (t, state = {}, { ship = 'merge', over = {}, commit = true } = {}) => {
  const wt = archivedSlice(t, 'billing', { commit });
  const gh = scriptedGh({ checks: GREEN, ...state, pr: state.pr ?? prOf(wt, over) });
  return { wt, gh };
};

test('project-loop next: S17 a pull request whose head is not the local head, or with something uncommitted, is pushed', () => {
  const t = loopProject();
  const { wt, gh } = openPr(t, {}, { over: { headRefOid: '0'.repeat(40) } });
  const a = act(t.main, 'billing', { gh });
  assert.deepEqual([a.kind, a.agent, a.step], ['agent', 'devkit-core:commit-and-pr', 'push']);
  put(wt, { 'docs/design/billing/3-architecture.md': 'late\n' });
  const b = act(t.main, 'billing', { gh: scriptedGh({ checks: GREEN, pr: prOf(wt) }) });
  assert.equal(b.step, 'push', 'uncommitted files count too');
});

test('project-loop next: S18 a failing check ends blocked and names the check and its link', () => {
  const t = loopProject();
  const { gh } = openPr(t, { checks: [{ name: 'build', bucket: 'fail', link: 'https://checks.test/9' }, { name: 'lint', bucket: 'pass', link: 'x' }] });
  const r = nextP(t.main, 'billing', { gh });
  assert.equal(r.code, 2);
  const a = body(r);
  assert.deepEqual([a.end.state, a.end.why], ['blocked', 'checks-failing']);
  assert.match(a.reply, /checks failing on the pull request: build \(https:\/\/checks\.test\/9\)/);
});

test('project-loop next: S19 a conflicting pull request ends blocked naming the pull request and its base', () => {
  const t = loopProject();
  const { gh } = openPr(t, {}, { over: { mergeable: 'CONFLICTING', baseRefName: 'main' } });
  const r = nextP(t.main, 'billing', { gh });
  assert.equal(r.code, 2);
  const a = body(r);
  assert.deepEqual([a.end.state, a.end.why], ['blocked', 'branch-conflict']);
  assert.match(a.reply, /pull request #7 conflicts with main: resolve the conflict on the slice's branch, then call \/devkit project billing again/);
});

test('project-loop next: S20 a pull request behind its base is updated by the session', () => {
  const t = loopProject();
  const { gh } = openPr(t, {}, { over: { mergeStateStatus: 'BEHIND' } });
  const a = act(t.main, 'billing', { gh });
  assert.deepEqual([a.kind, a.step, a.detail], ['session', 'update-branch', { number: 7 }]);
});

test('project-loop next: S21 pending checks or auto-merge on wait on GitHub', () => {
  const t = loopProject();
  const pending = openPr(t, { checks: [{ name: 'build', bucket: 'pending', link: 'x' }] });
  const r = nextP(t.main, 'billing', { gh: pending.gh });
  assert.equal(r.code, 1);
  assert.deepEqual([body(r).end.state, body(r).end.why], ['waiting-on-github', 'waiting-github']);
  const on = act(t.main, 'billing', { gh: scriptedGh({ checks: GREEN, pr: prOf(pending.wt, { autoMergeRequest: { enabledAt: 'now' } }) }) });
  assert.deepEqual([on.end.state, on.end.why], ['waiting-on-github', 'waiting-github']);
  assert.match(on.reply, /^billing is waiting on GitHub \(the merge of the pull request\)/);
});

test('project-loop next: S22 ship pr waits for the owner to merge a green pull request', () => {
  const t = loopProject({ ship: 'pr' });
  const { gh } = openPr(t);
  const r = nextP(t.main, 'billing', { gh });
  assert.equal(r.code, 1);
  const a = body(r);
  assert.deepEqual([a.end.state, a.end.why, a.reply], ['waiting-for-owner', 'project-pr-mode', CL.render('en', 'project-pr-mode', { id: 'billing', number: 7 })]);
});

test('project-loop next: S23 ship merge with the repository not prepared ends blocked and names what is missing', () => {
  const t = loopProject();
  const { gh } = openPr(t, { rules: [], repo: { default_branch: 'main', allow_auto_merge: false, allow_squash_merge: true } });
  const r = nextP(t.main, 'billing', { gh });
  assert.equal(r.code, 2);
  const a = body(r);
  assert.deepEqual([a.end.state, a.end.why], ['blocked', 'merge-setup-missing']);
  assert.match(a.reply, /auto-merge is not allowed/);
  assert.match(a.reply, /no active rule requires the devkit-reviews check on main/);
});

test('project-loop next: S24 ship merge with a green pull request enables auto-merge at the head commit', () => {
  const t = loopProject();
  const { wt, gh } = openPr(t);
  const a = act(t.main, 'billing', { gh });
  assert.deepEqual([a.kind, a.step, a.stage, a.detail], ['session', 'enable-auto-merge', 'delivery', { number: 7, head: headOf2(wt), method: 'squash' }]);
  assert.ok(!gh.calls.some((c) => c[1] === 'merge'), 'the loop only names the call');
});

test('project-loop next: S25 a merged pull request ends delivered and S26 a closed one ends blocked', () => {
  const t = loopProject();
  const { wt, gh } = openPr(t, {}, { over: { state: 'MERGED' } });
  const a = act(t.main, 'billing', { gh });
  assert.deepEqual([a.end.state, a.end.why, a.reply], ['delivered', 'project-delivered', CL.render('en', 'project-delivered', { id: 'billing' })]);
  assert.equal(nextP(t.main, 'billing', { gh }).code, 0);
  const closed = nextP(t.main, 'billing', { gh: scriptedGh({ checks: GREEN, pr: prOf(wt, { state: 'CLOSED' }) }) });
  assert.equal(closed.code, 2);
  assert.deepEqual([body(closed).end.why], ['pr-closed']);
  const unreadable = nextP(t.main, 'billing', { gh: () => ({ status: 1, stdout: '', stderr: 'HTTP 502' }) });
  assert.equal(unreadable.code, 2);
  assert.equal(body(unreadable).end.why, 'github-unreadable');
});

test('project-loop next: the progress guard ends a repeated action blocked and a review not delivered', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  const first = act(t.main, 'billing');
  const again = act(t.main, 'billing', { after: first.progressKey });
  assert.deepEqual([again.kind, again.end.state, again.end.why], ['end', 'blocked', 'no-progress']);
  assert.equal(act(t.main, 'billing', { after: 'business/other@ffffffffffff' }).kind, 'phase', 'another key is progress');
  const ready = readySlice(t, 'invoices');
  const agent = act(t.main, 'invoices');
  assert.equal(agent.kind, 'agent');
  put(ready, { 'notes.txt': 'something changed\n' });
  commitAll(ready, 'something else changed');
  const undelivered = act(t.main, 'invoices', { after: agent.progressKey });
  assert.deepEqual([undelivered.end?.state, undelivered.end?.why], ['blocked', 'not-delivered'], 'the agent handed the review and no verdict came back');
  assert.ok(wt);
});

test('project-loop next: the action prints one JSON object with exit 0 for an action, no run line', () => {
  const t = loopProject();
  openIn(t, 'billing');
  const r = nextP(t.main, 'billing');
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.stdout, /devkit-run:|devkit-end:/);
  assert.equal(JSON.parse(r.stdout).version, 1);
  assert.equal(PL.exitCodeOf({ kind: 'end', end: { state: 'blocked', why: 'unreadable' } }), 3);
});

// ---------------------------------------------------------------- rounds (D-7)

const roadmapOf = (wt) => readFileSync(join(wt, 'openspec', 'roadmap.md'), 'utf8');
// A slice at the roadmap stage with `block` between the markers and the record's result; returns its worktree.
function roundsSlice(t, block = ROUNDS_BLOCK, result = 'passed', slice = 'billing') {
  const wt = openIn(t, slice);
  settle(wt, slice, FIVE.slice(0, 4));
  rec(wt, slice, 'roadmap', result, roadmapRecord(result, block));
  return wt;
}
const roundsRun = (wt, extra = [], opts = {}) => lp(wt, ['rounds', 'billing', ...extra], opts);

test('project-loop rounds: a valid block is checked and nothing is written', () => {
  const t = loopProject();
  const wt = roundsSlice(t, ROUNDS_BLOCK, 'pending');
  const before = [roadmapOf(wt), gitq(wt, 'status', '--porcelain')];
  const r = roundsRun(wt);
  assert.equal(r.code, 0, r.stdout);
  const b = body(r);
  assert.deepEqual([b.result, b.ids], ['rounds-ok', ['invoice-export', 'invoice-mail']]);
  assert.equal(b.reply, CL.render('en', 'rounds-ok', { id: 'billing', list: 'invoice-export, invoice-mail (after: invoice-export)' }));
  assert.deepEqual([roadmapOf(wt), gitq(wt, 'status', '--porcelain')], before);
});

test('project-loop rounds: each refusal of the grammar exits 2 and writes nothing', () => {
  const bad = [
    ['no round or item', 'just some text\n', /text outside rounds|no round/],
    ['a round with no item', '## Round 2: empty\n', /no change/],
    ['text outside rounds', '## Round 2: a\n- [ ] one-change — x\nstray words\n', /stray words/],
    ['a ticked item', '## Round 2: a\n- [x] one-change — x\n', /one-change.*ticked/],
    ['an id that fails the name rule', '## Round 2: a\n- [ ] Bad_Id — x\n', /Bad_Id/],
    ['an id twice', '## Round 2: a\n- [ ] one-change — x\n- [ ] one-change — y\n', /one-change.*twice/],
    ['an id already on the roadmap', '## Round 2: a\n- [ ] first — x\n', /first.*already/],
    ['an after that names nothing known', '## Round 2: a\n- [ ] one-change (after: ghost) — x\n', /ghost/],
    ['an after that names a later line', '## Round 2: a\n- [ ] one-change (after: two-change) — x\n- [ ] two-change — y\n', /two-change/],
  ];
  for (const [what, block, pattern] of bad) {
    const t = loopProject();
    const wt = roundsSlice(t, block);
    const before = [roadmapOf(wt), gitq(wt, 'status', '--porcelain')];
    for (const extra of [[], ['--write']]) {
      const r = roundsRun(wt, extra);
      assert.equal(r.code, 2, `${what} ${extra}: ${r.stdout}`);
      const b = body(r);
      assert.equal(b.result, 'rounds-invalid', what);
      assert.match(b.reply, pattern, what);
      assert.ok(b.problems.length > 0, what);
    }
    assert.deepEqual([roadmapOf(wt), gitq(wt, 'status', '--porcelain')], before, what);
  }
});

test('project-loop rounds: an after that names the roadmap, an archived change or an earlier line is accepted', () => {
  const t = loopProject();
  const block = '## Round 2: a\n- [ ] one-change (after: first) — on the roadmap\n- [ ] two-change (after: one-change, old-done) — earlier line and archived\n';
  const wt = roundsSlice(t, block);
  const r = roundsRun(wt, [], { gh: scriptedGh({ archived: ['2026-01-01-old-done'] }) });
  assert.equal(r.code, 0, r.stdout);
  assert.equal(roundsRun(wt).code, 2, 'without the archive listing the archived id is unknown');
});

test('project-loop rounds: a record that is missing, not applicable or without markers is exit 3', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  settle(wt, 'billing', FIVE.slice(0, 4));
  for (const text of [null, roadmapRecord('not-applicable'), `${header('roadmap', 'passed')}\n## Rounds to append\nno markers\n`]) {
    if (text !== null) rec(wt, 'billing', 'roadmap', 'passed', text);
    const r = roundsRun(wt, ['--write']);
    assert.equal(r.code, 3, String(text));
    assert.equal(body(r).reply, CL.render('en', 'rounds-missing', { id: 'billing' }));
  }
  assert.equal(roadmapOf(wt), BASE_ROADMAP, 'not applicable is never written');
});

test('project-loop rounds: --write is refused while the record is pending', () => {
  const t = loopProject();
  const wt = roundsSlice(t, ROUNDS_BLOCK, 'pending');
  const r = roundsRun(wt, ['--write']);
  assert.equal(r.code, 2);
  assert.deepEqual([body(r).result, body(r).reply], ['rounds-not-approved', CL.render('en', 'rounds-not-approved', { id: 'billing' })]);
  assert.equal(roadmapOf(wt), BASE_ROADMAP);
});

test('project-loop rounds: --write appends the block keeping every old byte, and a second --write writes nothing', () => {
  const t = loopProject();
  const wt = roundsSlice(t);
  const old = roadmapOf(wt);
  const r = roundsRun(wt, ['--write']);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(body(r).result, 'rounds-ok');
  assert.equal(roadmapOf(wt), `${old}\n${ROUNDS_BLOCK}`);
  const again = roundsRun(wt, ['--write']);
  assert.equal(again.code, 0);
  assert.deepEqual([body(again).result, body(again).reply], ['rounds-already', CL.render('en', 'rounds-already', { id: 'billing' })]);
  assert.equal(roadmapOf(wt), `${old}\n${ROUNDS_BLOCK}`);
  const roadmap = RL.main(['status', '--lang', 'en', '--load-limit', '80'], { cwd: wt, env: ENV, stdin: '', gh: OFFLINE, load: () => 10 });
  assert.match(roadmap.stdout, /invoice-export/);
});

test('project-loop rounds: --write adds a newline when the file lacks one and creates the file when absent', () => {
  const t = loopProject({ files: { 'openspec/roadmap.md': '# Roadmap\n\n## Round 1\n- [ ] first' } });
  const wt = roundsSlice(t);
  assert.equal(roundsRun(wt, ['--write']).code, 0);
  assert.equal(roadmapOf(wt), `# Roadmap\n\n## Round 1\n- [ ] first\n\n${ROUNDS_BLOCK}`);
  const none = loopProject();
  const wt2 = roundsSlice(none);
  rmSync(join(wt2, 'openspec', 'roadmap.md'));
  assert.equal(roundsRun(wt2, ['--write']).code, 0);
  assert.equal(roadmapOf(wt2), `# Roadmap\n\n${ROUNDS_BLOCK}`);
});

// ---------------------------------------------------------------- record-review (D-8)

test('project-loop review: an approved or declined verdict for HEAD is recorded as passed, any other as failed', () => {
  for (const [word, result] of [['APPROVED', 'passed'], ['DECLINED', 'passed'], ['REJECTED', 'failed']]) {
    const t = loopProject();
    const wt = readySlice(t);
    const sha = headOf2(wt);
    verdictFor(wt, 'billing', sha, word);
    const verdictText = readFileSync(join(wt, 'openspec/changes/billing/reviews/adr-reviewer.md'), 'utf8');
    const r = lp(wt, ['record-review', 'billing']);
    assert.equal(r.code, 0, r.stdout);
    const text = readFileSync(join(wt, 'openspec/changes/billing/review.md'), 'utf8');
    assert.equal(text.split('\n')[0], `<!-- devkit-stage review result=${result} attempt=1 commit=${sha} -->`, word);
    assert.match(text, /^## Verdict$/m);
    assert.match(text, new RegExp(`${word}`));
    assert.match(text, /openspec\/changes\/billing\/reviews\/adr-reviewer\.md/);
    assert.equal(readFileSync(join(wt, 'openspec/changes/billing/reviews/adr-reviewer.md'), 'utf8'), verdictText, 'the verdict file stays as written');
    assert.deepEqual([body(r).result, body(r).verdict, body(r).attempt], [result, word, 1]);
  }
});

test('project-loop review: the attempt is one more than the replaced header\'s', () => {
  const t = loopProject();
  const wt = readySlice(t);
  verdictFor(wt, 'billing', headOf2(wt), 'REJECTED');
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  assert.match(readFileSync(join(wt, 'openspec/changes/billing/review.md'), 'utf8').split('\n')[0], /result=failed attempt=2 /);
});

test('project-loop review: a verdict that is missing, has no verdict word, no commit or another commit is refused', () => {
  const t = loopProject();
  const wt = readySlice(t);
  const file = 'openspec/changes/billing/reviews/adr-reviewer.md';
  const cases = [
    [null, 'no-verdict-file'],
    ['Commit: ' + headOf2(wt) + '\n\n# x\n', 'no-verdict'],
    ['Verdict: APPROVED\n\n# x\n', 'no-commit'],
    ['Verdict: APPROVED\nCommit: ' + '1'.repeat(40) + '\n\n# x\n', 'other-commit'],
  ];
  for (const [text, why] of cases) {
    if (text !== null) put(wt, { [file]: text });
    const r = lp(wt, ['record-review', 'billing']);
    assert.equal(r.code, 2, why);
    assert.deepEqual([body(r).result, body(r).reply], ['verdict-unusable', CL.render('en', 'verdict-unusable', { id: 'billing', why })], why);
    assert.equal(existsSync(join(wt, 'openspec/changes/billing/review.md')), false, 'nothing recorded');
  }
});

test('project-loop review: followups 8: a verdict recorded with uncommitted changes is refused and nothing is recorded', () => {
  const t = loopProject();
  const wt = readySlice(t);
  for (const sha of [headOf2(wt), '1'.repeat(40)]) {
    verdictFor(wt, 'billing', `${sha} (uncommitted changes)`);
    const en = lp(wt, ['record-review', 'billing']);
    assert.equal(en.code, 2, sha);
    assert.equal(body(en).result, 'verdict-unusable', sha);
    assert.equal(body(en).reply, CL.render('en', 'verdict-unusable', { id: 'billing', why: 'uncommitted' }), sha);
    assert.equal(existsSync(join(wt, 'openspec/changes/billing/review.md')), false, 'nothing recorded');
    const pt = lp(wt, ['record-review', 'billing'], { lang: 'pt-BR' });
    assert.equal(pt.code, 2, sha);
    assert.equal(body(pt).reply, CL.render('pt-BR', 'verdict-unusable', { id: 'billing', why: 'uncommitted' }), sha);
    assert.notEqual(body(pt).reply, body(en).reply, sha);
    assert.equal(existsSync(join(wt, 'openspec/changes/billing/review.md')), false, 'nothing recorded');
  }
});

// ---------------------------------------------------------------- archive (D-9)

test('project-loop archive: it is refused while a stage is unsettled and leaves the folder active', () => {
  const t = loopProject();
  const wt = readySlice(t);
  const r = lp(wt, ['archive', 'billing']);
  assert.equal(r.code, 2);
  const b = body(r);
  assert.equal(b.result, 'archive-refused');
  assert.match(b.reply, /the slice cannot be archived yet: the ADR review not settled/);
  assert.equal(existsSync(join(wt, 'openspec/changes/billing')), true);
  assert.deepEqual(readdirSync(join(wt, 'openspec/changes/archive')).filter((n) => n !== '.gitkeep'), []);
});

test('project-loop archive: with every stage settled it archives the folder on the branch', () => {
  const t = loopProject();
  const wt = readySlice(t);
  verdictFor(wt, 'billing', headOf2(wt));
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  const r = lp(wt, ['archive', 'billing']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(body(r).reply, CL.render('en', 'archived-slice', { id: 'billing' }));
  assert.equal(existsSync(join(wt, 'openspec/changes/billing')), false);
  assert.match(readdirSync(join(wt, 'openspec/changes/archive')).filter((n) => n !== '.gitkeep').join(','), /^\d{4}-\d{2}-\d{2}-billing$/);
  assert.equal(lp(wt, ['archive', 'billing']).code, 3, 'an archived slice is not active');
});

// ---------------------------------------------------------------- status (D-10)

test('project-loop status: one line per stage with passed, not applicable, ready and blocked, and nothing after the five', () => {
  const t = loopProject();
  const wt = openIn(t, 'billing');
  rec(wt, 'billing', 'business', 'passed');
  rec(wt, 'billing', 'domain-model', 'not-applicable');
  const r = lp(t.main, ['status', 'billing']);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(r.stdout.trimEnd().split('\n'), [
    'Slice billing', 'Business: passed', 'Domain model: not applicable', `Architecture: ready (${FC.reasonText('en', 'no-file', { file: 'architecture.md' })})`,
    'Implementation plan: blocked', 'Roadmap: blocked',
  ]);
  const pt = lp(t.main, ['status', 'billing'], { lang: 'pt-BR' }).stdout.split('\n');
  assert.deepEqual([pt[0], pt[1], pt[2], pt[4], pt[5]], ['Fatia billing', 'Negócio: passou', 'Modelo de domínio: não se aplica', 'Plano de implementação: bloqueada', 'Roadmap: bloqueada']);
  assert.match(pt[3], /^Arquitetura: pronta \(/);
});

test('project-loop status: the line after the five names the ADR review, the pull request or delivered', () => {
  const t = loopProject();
  const wt = readySlice(t);
  assert.equal(lp(t.main, ['status', 'billing']).stdout.trimEnd().split('\n').at(-1), 'next: the ADR review');
  verdictFor(wt, 'billing', headOf2(wt));
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  assert.equal(lp(wt, ['archive', 'billing']).code, 0);
  commitAll(wt, 'archive');
  const pr = scriptedGh({ pr: prOf(wt), checks: GREEN });
  const lines = lp(t.main, ['status', 'billing'], { gh: pr }).stdout.trimEnd().split('\n');
  assert.equal(lines.at(-1), 'pull request #7: waits for you', 'ship merge with auto-merge off waits for the session');
  const merged = lp(t.main, ['status', 'billing'], { gh: scriptedGh({ pr: prOf(wt, { state: 'MERGED' }) }) }).stdout.trimEnd().split('\n');
  assert.equal(merged.at(-1), 'delivered');
});

// ---------------------------------------------------------------- wait (D-9)

test('project-loop wait: it ends when the decision changes and holds no state', async () => {
  const t = loopProject();
  const { wt } = openPr(t, {}, { over: { autoMergeRequest: { enabledAt: 'now' } } });
  let polls = 0;
  const gh = scriptedGh({ checks: GREEN, pr: () => { polls += 1; return prOf(wt, polls < 3 ? { autoMergeRequest: { enabledAt: 'now' } } : { state: 'MERGED' }); } });
  const slept = [];
  const r = await PL.runCommand(['wait', '--slice', 'billing', '--lang', 'en', '--interval', '5'], { cwd: t.main, env: ENV, gh, sleep: async (s) => { slept.push(s); } });
  assert.equal(r.code, 0);
  const a = body(r);
  assert.deepEqual([a.kind, a.end.state, a.end.why], ['end', 'delivered', 'project-delivered']);
  assert.deepEqual(slept, [5, 5]);
  const first = await PL.runCommand(['wait', '--slice', 'billing', '--lang', 'en'], { cwd: t.main, env: ENV, gh: scriptedGh({ checks: GREEN, pr: prOf(wt, { state: 'MERGED' }) }), sleep: async () => { throw new Error('no wait'); } });
  assert.equal(body(first).end.state, 'delivered', 'a decision that is not a wait comes back at once');
  const slow = await PL.runCommand(['wait', '--slice', 'billing', '--lang', 'en', '--interval', '1'], { cwd: t.main, env: ENV, gh });
  assert.equal(slow.code, 3, 'an interval under the minimum is a usage error');
});

// ---------------------------------------------------------------- the messages (D-13)

const NEW_KEYS = ['project-opened', 'project-resumed', 'project-choose', 'project-name-needed', 'project-done-already', 'project-folder-exists', 'is-slice', 'is-change', 'project-waiting-github',
  'design-pack-missing', 'phase-approval', 'rounds-approval', 'rounds-invalid', 'rounds-not-approved', 'project-plan-mode', 'project-pr-mode', 'project-delivered',
  'project-delivered-no-rounds', 'where.slice-pr', 'where.slice-archived', 'project-not-found', 'rounds-missing', 'rounds-ok', 'rounds-already', 'archived-slice',
  'verdict-unusable', 'project-unreadable', 'slice-title', 'slice-passed', 'slice-na', 'slice-ready', 'slice-blocked', 'slice-next-review', 'slice-next-pr', 'slice-pr',
  'slice-delivered', 'state.github', 'state.owner', 'state.blocked', 'verdict-unusable', 'blocked-why.checks-failing', 'blocked-why.merge-setup-missing',
  'blocked-why.branch-conflict', 'blocked-why.archive-refused', 'blocked-why.undeclared-stage'];

test('project-loop start: every new message key renders in both languages with no internal term', () => {
  const projectFlow = flowOf(PLUGIN_SCHEMAS);
  const internal = [...new Set([...projectFlow.stages.flatMap((s) => [s.id, s.role, ...(s.skills ?? [])]), 'project-loop', 'change-loop', 'devkit-core', 'devkit-openspec', 'devkit-lite', 'progressKey', 'reasonCode'])]
    .filter((n) => n.includes('-'));
  assert.ok(internal.includes('domain-model') && internal.includes('adr-reviewer'));
  const sample = { id: 'billing', n: 2, list: 'one, two', number: 7, where: 'next is the domain model', stage: 'Domain model', base: 'main', state: 'github', why: 'no-commit', what: 'merge' };
  for (const lang of ['en', 'pt-BR']) {
    for (const key of NEW_KEYS) {
      assert.ok(CL.MESSAGES[lang][key] !== undefined, `${lang} has ${key}`);
      const text = key.startsWith('blocked-why.') ? CL.render(lang, 'blocked', { ...sample, why: key.slice('blocked-why.'.length) }) : CL.render(lang, key, sample);
      assert.ok(text.length > 0 && !/undefined|NaN|\[object|\{\w+\}/.test(text), `${lang} ${key}: ${text}`);
      assert.ok(!text.includes('`'), `${lang} ${key} has a backtick`);
      assert.ok(!/[\w.-]+\.(md|json|mjs|js|ts|ya?ml)\b/.test(text), `${lang} ${key} names a file: ${text}`);
      assert.ok(!/(^|\s)--[a-z]/i.test(text), `${lang} ${key} holds an option`);
      for (const name of internal) assert.ok(!new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(text), `${lang} ${key} holds ${name}: ${text}`);
    }
  }
  assert.deepEqual(Object.keys(CL.MESSAGES.en).sort(), Object.keys(CL.MESSAGES['pt-BR']).sort());
  assert.match(CL.render('en', 'verb-unknown'), /\/devkit project/);
});

// ---------------------------------------------------------------- the skills (D-14, phase 4)

const DEVKIT_SKILL = join(HERE, '..', 'skills', 'devkit', 'SKILL.md');
const DESIGN_DIR = join(HERE, '..', '..', 'design');
const DESIGN_SKILLS = ['design-business-discovery', 'design-domain-model', 'design-architecture', 'design-implementation-plan', 'ddd-strategic-design'];
const designSkill = (name) => readFileSync(join(DESIGN_DIR, 'skills', name, 'SKILL.md'), 'utf8');
const between = (md, from, to) => {
  const a = md.indexOf(from);
  assert.ok(a >= 0, `section ${from}`);
  const b = to ? md.indexOf(to, a + from.length) : md.length;
  return md.slice(a, b < 0 ? md.length : b);
};
const projectSection = () => between(readFileSync(DEVKIT_SKILL, 'utf8'), '## Project', '## Never');

test('project-loop skill: the section sits between Status and Never and every call carries the language', () => {
  const md = readFileSync(DEVKIT_SKILL, 'utf8');
  const heads = md.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(heads.slice(-3), ['## Status', '## Project', '## Never']);
  const fm = md.split('---')[1];
  assert.match(fm, /^argument-hint: ".*\| project \[<name>\]"$/m);
  assert.match(/^description: (.*)$/m.exec(fm)[1], /\/devkit project/);
  const calls = projectSection().split('\n').filter((l) => /project-loop\.mjs (start|open|next|status|wait|rounds|record-review|archive)/.test(l));
  assert.ok(calls.length >= 3, 'the section calls the script');
  for (const l of calls) assert.ok(l.includes('--lang ${user_config.language}'), `no --lang: ${l}`);
});

test('project-loop skill: the start reads the words through the quoted heredoc and carries every start mode', () => {
  const s = projectSection();
  assert.match(s, /project-loop\.mjs start --lang \$\{user_config\.language\} <<'DEVKIT_ARGS'/);
  assert.doesNotMatch(s, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
  for (const mode of ['not-set-up', 'setting-unknown', 'driver-not-built', 'design-pack-missing', 'project-name-needed', 'name-invalid', 'project-done-already', 'is-change', 'project-folder-exists', 'choose', 'resume', 'new']) {
    assert.ok(s.includes(`\`${mode}\``), `start mode ${mode}`);
  }
  assert.match(s, /project-loop\.mjs open <id>/);
});

test('project-loop skill: each action kind and each end state is carried', () => {
  const s = projectSection();
  for (const kind of ['phase', 'rounds', 'agent', 'session', 'end']) assert.ok(s.includes(`- \`${kind}\``), `kind ${kind}`);
  for (const state of ['delivered', 'blocked', 'waiting-for-owner', 'waiting-on-github']) assert.ok(s.includes(`\`${state}\``), `end state ${state}`);
  assert.match(s, /result=pending/);
  assert.match(s, /result=passed/);
  assert.match(s, /never a relative path/);
  assert.match(s, /enable-auto-merge/);
  assert.match(s, /update-branch/);
  assert.match(s, /project-loop\.mjs wait --slice <id>/);
  assert.doesNotMatch(s, /devkit-run:|devkit-end:/, 'the project loop prints no marker line');
});

test('project-loop skill: the end names /devkit roadmap and never starts it', () => {
  const s = projectSection();
  assert.match(s, /`\/devkit roadmap`/);
  assert.match(s, /never starts it/);
});

test('project-loop skill: the Never section holds the project items of D-14', () => {
  const md = readFileSync(DEVKIT_SKILL, 'utf8');
  const never = between(md, '## Never');
  assert.match(never, /In a project run: start `\/devkit roadmap`, edit `openspec\/roadmap\.md` by hand, set a stage record to passed without the owner's approval, or edit a file of a flat `docs\/design\/` or of another slice\./);
});

for (const name of DESIGN_SKILLS) {
  test(`project-loop design skills: ${name} works on a slice's folder and alone`, () => {
    const md = designSkill(name);
    const fm = md.split('---')[1];
    const desc = /^description: (.*)$/m.exec(fm)[1];
    assert.match(desc, /\b(Use|use) (when|after)\b/, 'the description says when to use it');
    assert.match(md, /docs\/design\/<slice>\//);
    assert.doesNotMatch(md, /docs\/design\/\d-/, 'a top-level numbered output');
    assert.doesNotMatch(md, /docs\/design\/STATE\.md/, 'a top-level STATE.md');
    assert.doesNotMatch(md, /docs\/design\/(1-business-vision|2-domain-model|3-architecture|4-implementation-plan)/);
    const step = between(md, 'The slice');
    assert.match(step, /ask the owner first for the slice's name/);
    assert.match(step, /2 to 48 lowercase letters and digits, words joined by single dashes/);
    assert.match(md, /write nothing to `openspec\/roadmap\.md` and open no pull request/);
    assert.match(md, /flat `docs\/design\/`[^.]*context[^.]*never edited/);
    assert.match(md, /not applicable|does not apply to this slice/i);
    assert.doesNotMatch(md, /openspec-propose|change-planner/);
  });
}

test('project-loop design skills: the plan skill hands off to /devkit project and the architecture skill defaults to docs/adr', () => {
  const plan = between(designSkill('design-implementation-plan'), '### Handing off to execution', '\n### ');
  assert.match(plan, /4-implementation-plan\.md/);
  assert.match(plan, /\/devkit project <slice>/);
  assert.match(plan, /\/devkit change/);
  const arch = designSkill('design-architecture');
  assert.match(arch, /`docs\/adr\/` when it has none/);
  assert.doesNotMatch(arch, /default to `docs\/decisions\/`/);
  const ddd = designSkill('ddd-strategic-design');
  assert.match(ddd, /docs\/design\/<slice>\/strategic-design\.md/);
  assert.match(ddd, /2-domain-model\.md/);
});

test('project-loop design skills: the STATE template links the project ADR index and names the slice', () => {
  const t = readFileSync(join(DESIGN_DIR, 'skills', 'design-business-discovery', 'templates', 'STATE.md'), 'utf8');
  assert.match(t, /\.\.\/\.\.\/adr\//);
  assert.doesNotMatch(t, /\.\.\/decisions\//);
  assert.match(t, /\{\{SLICE\}\}/);
});

test('project-loop design skills: the pack README shows the slice layout and /devkit project', () => {
  const r = readFileSync(join(DESIGN_DIR, 'README.md'), 'utf8');
  assert.match(r, /docs\/design\/<slice>\//);
  assert.match(r, /\/devkit project/);
  assert.doesNotMatch(r, /openspec-propose|change-planner/);
});

// ================================================================ phase 5: the scripted run (design D-19)

// The run of one slice from its name to the merge, with written files standing in for the session's writing and the owner's
// answers, a bare local origin and a faked gh. Returns the transcript lines. `rounds: false` runs the same path with the
// roadmap record not applicable.
function scriptedRun({ rounds }) {
  const lines = [];
  const t = loopProject();
  const mask = (text) => String(text).split(t.main).join('<project>').split(t.origin).join('<origin>').replace(/\b[0-9a-f]{40}\b/g, (sha) => sha.slice(0, 7));
  const say = (n, text) => lines.push(`${n}. ${mask(text)}`);
  const kindOf = (a) => (a.kind === 'end' ? `end ${a.end.state} (${a.end.why})` : `${a.kind} ${a.step} (stage ${a.stage}${a.agent ? `, ${a.agent}` : ''})`);
  const flat = (root) => readFileSync(join(root, 'docs', 'design', 'STATE.md'), 'utf8');
  const flatBefore = flat(t.main);
  const roadmapBefore = readFileSync(join(t.main, 'openspec', 'roadmap.md'), 'utf8');
  const gh = scriptedGh({ checks: GREEN, pr: () => pr });
  let pr = null;

  // 1: start gives new, open makes the worktree and the change.
  const started = body(startP(t.main, 'billing'));
  assert.deepEqual([started.mode, started.slice], ['new', null]);
  say(1, `start billing: mode ${started.mode}`);
  const wt = openIn(t, 'billing');
  assert.equal(wt, join(t.main, '.claude', 'worktrees', 'billing'));
  assert.equal(gitq(wt, 'symbolic-ref', '--short', 'HEAD').trim(), 'billing');
  assert.equal(gitq(t.main, 'status', '--porcelain'), '');
  say(1, `open billing: worktree ${wt}, schema devkit-project`);
  const session = hook('session', wt, {});
  assert.deepEqual([session.code, session.err], [0, ''], 'the session report on the checkout with an open slice');
  say(1, 'session report on the open slice: exit 0');

  // 2-4: the phases, each an interview that writes its files at the paths of the action, then the owner's word.
  const phaseFiles = (a, text) => {
    assert.ok(abs(wt, a).every((p) => p.startsWith(`${wt}/`)), 'every path is under the slice\'s worktree');
    put(wt, { [a.detail.document.slice(wt.length + 1)]: `${text}\n`, [a.detail.notes.slice(wt.length + 1)]: 'state\n' });
    return a;
  };
  const interview = act(t.main, 'billing');
  assert.deepEqual([interview.kind, interview.step, interview.stage], ['phase', 'interview', 'business']);
  say(2, `next from the main checkout: ${kindOf(interview)}`);
  phaseFiles(interview, 'vision');
  rec(wt, 'billing', 'business', 'pending');
  assert.equal(gitq(t.main, 'status', '--porcelain'), '', 'the main checkout stays clean');
  const approval = act(t.main, 'billing');
  assert.deepEqual([approval.kind, approval.step, approval.stage], ['phase', 'approval', 'business']);
  say(2, `next after the document and a pending record: ${kindOf(approval)}`);
  const board = lp(t.main, ['status', 'billing']).stdout.trimEnd().split('\n');
  assert.match(board.find((l) => l.startsWith('Business')), /ready/);
  assert.ok(board.filter((l) => /^(Domain model|Architecture|Implementation plan|Roadmap)/.test(l)).every((l) => /blocked/.test(l)), 'the rest is blocked');
  say(2, `status: ${board.slice(1, 3).join(' | ')} ...`);
  rec(wt, 'billing', 'business', 'passed');
  const domain = act(t.main, 'billing');
  assert.deepEqual([domain.kind, domain.step, domain.stage], ['phase', 'interview', 'domain-model']);
  say(2, `next after the owner approves business: ${kindOf(domain)}`);

  rec(wt, 'billing', 'domain-model', 'not-applicable');
  put(wt, { 'docs/design/billing/2-domain-model.md': 'not applicable\n' });
  const architecture = act(t.main, 'billing');
  assert.deepEqual([architecture.step, architecture.stage], ['interview', 'architecture']);
  say(3, `domain model not applicable: next is ${kindOf(architecture)}`);

  put(wt, { 'docs/design/billing/3-architecture.md': 'architecture\n', 'docs/adr/0001-store.md': 'adr one\n', 'docs/adr/0002-queue.md': 'adr two\n' });
  rec(wt, 'billing', 'architecture', 'passed');
  const plan = act(t.main, 'billing');
  assert.deepEqual([plan.step, plan.stage], ['interview', 'implementation-plan']);
  say(4, `architecture with two ADRs passed: next is ${kindOf(plan)}`);
  put(wt, { 'docs/design/billing/4-implementation-plan.md': 'plan\n' });
  rec(wt, 'billing', 'implementation-plan', 'passed');

  // 5: the rounds.
  if (rounds) {
    const propose = act(t.main, 'billing');
    assert.deepEqual([propose.kind, propose.step], ['rounds', 'propose']);
    say(5, `next after the plan: ${kindOf(propose)}`);
    rec(wt, 'billing', 'roadmap', 'pending', roadmapRecord('pending'));
    const refused = lp(wt, ['rounds', 'billing', '--write']);
    assert.notEqual(refused.code, 0, 'a pending record is not written');
    assert.equal(roadmapOf(wt), roadmapBefore, 'the roadmap\'s bytes are unchanged');
    say(5, `rounds --write with the record pending: exit ${refused.code}, roadmap unchanged`);
    rec(wt, 'billing', 'roadmap', 'passed', roadmapRecord('passed'));
    const write = act(t.main, 'billing');
    assert.deepEqual([write.kind, write.step], ['session', 'write-rounds']);
    say(5, `next after the owner approves the rounds: ${kindOf(write)}`);
    assert.equal(lp(wt, ['rounds', 'billing', '--write']).code, 0);
    assert.equal(roadmapOf(wt), `${roadmapBefore}\n${ROUNDS_BLOCK}`, 'the file starts with its old bytes');
    const status = RL.main(['status', '--lang', 'en', '--load-limit', '80'], { cwd: wt, env: ENV, stdin: '', gh: OFFLINE, load: () => 10 }).stdout;
    assert.match(status, /invoice-export/);
    assert.match(status, /invoice-mail/);
    assert.match(status, /invoice-mail +waits for invoice-export/);
    say(5, 'roadmap-loop status lists invoice-export and invoice-mail, which waits for invoice-export');
  } else {
    rec(wt, 'billing', 'roadmap', 'not-applicable', roadmapRecord('not-applicable'));
    say(5, 'the roadmap record is not applicable: no rounds are written');
  }

  // 6: the commit hand-off, the ADR review, its record, the archive.
  const commit = act(t.main, 'billing');
  assert.deepEqual([commit.kind, commit.agent, commit.step], ['agent', 'devkit-core:commit-and-pr', 'commit']);
  say(6, `next: ${kindOf(commit)}`);
  commitAll(wt, 'slice documents');
  const review = act(t.main, 'billing');
  assert.deepEqual([review.kind, review.agent, review.step], ['agent', 'devkit-core:adr-reviewer', 'review']);
  say(6, `next after the commit: ${kindOf(review)}`);
  verdictFor(wt, 'billing', headOf2(wt));
  const record = act(t.main, 'billing');
  assert.deepEqual([record.kind, record.step], ['session', 'record-review']);
  say(6, `next after the verdict file for HEAD: ${kindOf(record)}`);
  assert.equal(lp(wt, ['record-review', 'billing']).code, 0);
  const archive = act(t.main, 'billing');
  assert.deepEqual([archive.kind, archive.step], ['session', 'archive']);
  say(6, `next after the record: ${kindOf(archive)}`);
  assert.equal(lp(wt, ['archive', 'billing']).code, 0);

  // 7: a new session is a start with no text.
  const resumed = body(startP(t.main, ''));
  assert.deepEqual([resumed.mode, resumed.slice], ['resume', 'billing']);
  say(7, `start with no text: mode ${resumed.mode}, slice ${resumed.slice}`);

  // 8: the pull request, the contract in the hook and in CI, auto-merge, the merge.
  commitAll(wt, 'archive the slice');
  const open = act(t.main, 'billing', { gh });
  assert.deepEqual([open.kind, open.agent, open.step], ['agent', 'devkit-core:commit-and-pr', 'open-pr']);
  say(8, `next: ${kindOf(open)}`);
  gitq(wt, 'push', '-q', 'origin', 'billing');
  gh.calls.push(['pr', 'create', '--title', 'docs(design): billing']);
  pr = prOf(wt);
  assert.deepEqual(gh.calls.at(-1).slice(0, 2), ['pr', 'create']);
  const hooked = prCreate(wt);
  assert.deepEqual([hooked.code, hooked.err], [0, ''], 'the hook passes the slice contract');
  say(8, 'the pull request hook (sliceProblems): passes');
  for (const r of bothCi(wt)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /slice billing: passed the slice contract/);
  }
  say(8, 'deliver-check.mjs --ci and guard.mjs ci: passed the slice contract');
  const auto = act(t.main, 'billing', { gh });
  assert.deepEqual([auto.kind, auto.step, auto.detail.head], ['session', 'enable-auto-merge', headOf2(wt)]);
  say(8, `next with green checks: ${kindOf(auto)} at ${headOf2(wt).slice(0, 7)}`);
  assert.ok(!gh.calls.some((c) => c[1] === 'merge'), 'the loop only names the call');
  pr = prOf(wt, { state: 'MERGED' });
  const delivered = act(t.main, 'billing', { gh });
  assert.deepEqual([delivered.kind, delivered.end.state, delivered.end.why], ['end', 'delivered', rounds ? 'project-delivered' : 'project-delivered-no-rounds']);
  say(8, `next after the merge: ${kindOf(delivered)}`);

  // 9 and AC-6: the flat files and, with no rounds, the roadmap keep their bytes.
  assert.equal(flat(t.main), flatBefore);
  assert.equal(flat(wt), flatBefore);
  say(9, 'docs/design/STATE.md (the flat file) has the bytes it had before');
  if (!rounds) {
    assert.equal(roadmapOf(wt), roadmapBefore);
    say(9, 'openspec/roadmap.md has the bytes it had before');
    put(wt, { 'openspec/roadmap.md': `${roadmapBefore}\n## Round 2\n- [ ] sneaked\n` });
    commitAll(wt, 'touch the roadmap');
    failsWith(wt, /openspec\/roadmap\.md must stay as it was: roadmap\.md of the slice is not applicable/);
    say(9, 'a roadmap change while the record is not applicable: both CI entries refuse it');
  }
  return lines;
}

const proofOut = (lines) => {
  const out = process.env.DEVKIT_PROOF_OUT;
  if (!out) return;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${lines.join('\n')}\n`);
};

test('project-loop scripted: a slice from its name to the merge', () => {
  proofOut(scriptedRun({ rounds: true }));
});

test('project-loop scripted: a slice whose roadmap does not apply', () => {
  proofOut(scriptedRun({ rounds: false }));
});

// ---------------------------------------------------------------- the documents (D-16, D-17, D-18, phase 6)

// Invariant (AC-2, AC-7, AC-9): the design page, ADR 0015 and its two Notes, the config, the flow page, the role
// document, both READMEs and the changelog say what the project flow is. Layer: the documents. Suite: this file.
test('project-loop docs: the documents follow', () => {
  const read = (...p) => readFileSync(join(REPO_ROOT, ...p), 'utf8');
  const design = read('docs', 'coordination-design.md');
  assert.match(between(design, 'Tense:', '## 1. '), /`\/devkit project`/, 'the tense paragraph names the command');
  assert.match(between(design, '## 1. ', '## 2. '), /\| `\/devkit project <name>` \|[^\n]*\| 19 \(built\) \|/, 'section 1 says built');
  const seven = between(design, '## 7. ', '## 8. ');
  assert.match(seven, /built in round 19/, 'section 7 says built');
  assert.doesNotMatch(seven, /\*\*Today\.\*\*|\*\*The proposal\.\*\*/, 'section 7 drops Today and The proposal');
  assert.match(seven, /Decided by `project-phases` on 2026-11-21/, 'section 7 records the answers');
  for (let n = 1; n <= 9; n += 1) assert.match(seven, new RegExp(`grill question ${n}\\b`), `section 7 lists answer ${n}`);

  const adr = read('docs', 'adr', '0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md');
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0015 has ${h}`);
  }
  const link = '[ADR 0015](0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)';
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  const adr12 = read('docs', 'adr', '0012-the-reviews-check-follows-the-change-script.md');
  for (const t of [adr10, adr12]) {
    assert.match(t, /Note \(project-phases, \d{4}-\d{2}-\d{2}\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0015');
  }
  if (/^- Status: accepted$/m.test(adr)) {
    for (const t of [adr10, adr12]) assert.match(t, /^- Amended by ADR 0015 \(0015-a-project-slice-is-a-change-delivered-in-one-pull-request\.md\)$/m);
    assert.match(adr, /^- Accepted by: /m);
  }
  const config = read('openspec', 'config.yaml').split('\n');
  assert.match(config.find((l) => l.trim().startsWith('ADRs:')), /0015/, 'the ADRs line names 0015');
  assert.ok(config.some((l) => /^ {2}devkit-project: merge$/.test(l)), 'ship names devkit-project: merge');

  const flow = read('docs', 'openspec-flow.md').split('\n');
  assert.ok(flow.includes('## The `devkit-project` schema'), 'the flow page has the schema section');
  assert.ok(flow.includes('## Defining a project: `/devkit project`'), 'the flow page has the project section');
  assert.match(read('docs', 'roles.md'), /^## project-coordinator$/m);
  for (const f of [['plugins', 'openspec', 'README.md'], ['README.md']]) {
    assert.match(read(...f), /\/devkit project/, `${f.join('/')} names /devkit project`);
  }
  const entry = between(read('CHANGELOG.md'), '## 0.24.0', '\n## 0.23.1');
  assert.match(entry.replace(/\s+/g, ' '), /moves its CI pin to `v0\.20\.0` before it sets `ship: devkit-project: merge`/, 'the entry says to move the CI pin first');
});

// ================================================================ commit-attribution (D-7, T21 to T25)

test('commit-attribution AC-1 T21 the S8 commit before the review ends with the attribution request after the commit rule', () => {
  const t = loopProject();
  const wt = readySlice(t);
  put(wt, { 'docs/design/billing/2-domain-model.md': 'new\n' });
  const a = act(t.main, 'billing');
  assert.equal(a.step, 'commit');
  assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported');
  assert.ok(a.brief.endsWith(CL.ATTRIBUTION_ASK), a.brief);
  assert.ok(a.brief.slice(0, -CL.ATTRIBUTION_ASK.length).endsWith('never on the default branch.'), a.brief);
});

test('commit-attribution AC-1 T22 the S13 commit in plan ship mode ends with the attribution request', () => {
  const t = loopProject({ ship: 'plan' });
  archivedSlice(t);
  const a = act(t.main, 'billing');
  assert.equal(a.step, 'commit');
  assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported');
  assert.ok(a.brief.endsWith(CL.ATTRIBUTION_ASK), a.brief);
});

test('commit-attribution AC-1 T23 the S16 open-pr ends with the attribution request', () => {
  const t = loopProject();
  archivedSlice(t, 'billing', { commit: true });
  const a = act(t.main, 'billing', { gh: scriptedGh() });
  assert.equal(a.step, 'open-pr');
  assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported');
  assert.ok(a.brief.endsWith(CL.ATTRIBUTION_ASK), a.brief);
});

test('commit-attribution AC-1 T24 the S17 push ends with the attribution request', () => {
  const t = loopProject();
  const { gh } = openPr(t, {}, { over: { headRefOid: '0'.repeat(40) } });
  const a = act(t.main, 'billing', { gh });
  assert.equal(a.step, 'push');
  assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported');
  assert.ok(a.brief.endsWith(CL.ATTRIBUTION_ASK), a.brief);
});

test('commit-attribution AC-1 T25 the S10 ADR reviewer hand-off does not carry the attribution request', () => {
  const t = loopProject();
  readySlice(t);
  const a = act(t.main, 'billing');
  assert.equal(a.agent, 'devkit-core:adr-reviewer');
  assert.ok(!a.brief.includes(CL.ATTRIBUTION_ASK ?? '\u0000'), a.brief);
});
