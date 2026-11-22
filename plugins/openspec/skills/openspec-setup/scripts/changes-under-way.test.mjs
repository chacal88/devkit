// Tests for changes-under-way.mjs and the schema upgrade over changes under way (field-fixes 7, design D-7).
// Imported by hooks/guard.test.mjs so that `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
// The scratch project starts on the v0.13.0 schemas (a committed fixture: CI checks out without tags).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, cpSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gitRepo, put, commitAll, git, fakeGh } from '../../../hooks/deliver-check.test.mjs';
import * as flowCheck from '../../../hooks/flow-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hooks = join(here, '..', '..', '..', 'hooks');
const script = join(here, 'changes-under-way.mjs');
const installer = join(here, 'install-schemas.sh');
const fixtureSchemas = join(here, 'fixtures', 'schemas-0.13.0');
const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };

const READY = '# Readiness\n\n- Status: APPROVED\n';
const CONFIG = 'schema: devkit-lite\nship:\n  devkit: pr\n  devkit-lite: pr\n';
const real = (p) => realpathSync(p);

// A project on the v0.13.0 schemas with four changes under way: `short` (devkit-lite, begun on the previous script)
// and `custom` (another schema) in the main checkout, `started` (devkit, a ticked task) and `planready` (devkit,
// readiness approved, no ticked task) each in a worktree on a branch named after it.
function scratch() {
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "x"\n' });
  gh.set('pr-list', { stdout: [] });
  const root = gitRepo({
    config: CONFIG,
    changes: {
      short: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': '# Proposal\n', 'tasks.md': '# Tasks\n\n- [ ] 1.1 a\n' },
      custom: { '.openspec.yaml': 'schema: acme-flow\n', 'tasks.md': '- [ ] 1.1 a\n' },
    },
  });
  rmSync(join(root, 'openspec', 'schemas'), { recursive: true });
  cpSync(fixtureSchemas, join(root, 'openspec', 'schemas'), { recursive: true });
  commitAll(root, 'schemas of 0.13.0');
  const worktree = (id, files) => {
    const dir = join(mkdtempSync(join(tmpdir(), 'devkit-wt-')), id);
    git(root, 'worktree', 'add', '-q', '-b', id, dir);
    put(dir, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])));
    commitAll(dir, `change ${id}`);
    return dir;
  };
  const started = worktree('started', { '.openspec.yaml': 'schema: devkit\n', 'proposal.md': '# Proposal\n', 'tasks.md': '## 1. First\n- [x] 1.1 code\n- [ ] 1.2 more\n', 'readiness.md': READY });
  const planready = worktree('planready', { '.openspec.yaml': 'schema: devkit\n', 'proposal.md': '# Proposal\n', 'tasks.md': '## 1. First\n- [ ] 1.1 code\n', 'readiness.md': READY });
  const env = { ...gh.env, ...BLANKS, DEVKIT_HOST: 'cli', CLAUDE_CODE_ENTRYPOINT: '' };
  const run = (args, cwd = root) => {
    const r = spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
  };
  const exec = (cmd, args, cwd) => {
    const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const row = (id) => run([root, '--json']).json().changes.find((c) => c.id === id);
  return { root, started, planready, gh, env, run, exec, row };
}

// What the main session writes for the owner's plan approval of `id`: the readiness hash and the owner's words.
const approvalFor = (dir, id) => {
  const hash = `sha256:${createHash('sha256').update(readFileSync(join(dir, 'openspec', 'changes', id, 'readiness.md'))).digest('hex').slice(0, 12)}`;
  return `# Plan approval: ${id}\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: 2026-11-20\n- Owner's words: "Aprovo"\n`;
};
const stepOf = (t, dir, id) => {
  const r = t.exec(process.execPath, [join(hooks, 'deliver-check.mjs'), id, '--json'], dir);
  return JSON.parse(r.out).next.step;
};

test('field-fixes 7 listing: every change under way with its script, checkout and what the upgrade changes for it; nothing is written', () => {
  const t = scratch();
  const r = t.run([t.root]);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^4 changes under way:$/m);
  assert.match(r.out, /^- started \(devkit, .*, branch started\): continues where it was; .*approval\.md is written as not applying$/m);
  assert.match(r.out, /^- planready \(devkit, .*, branch planready\): asks the owner's approval once, before its implementation$/m);
  assert.match(r.out, /^- short \(devkit-lite, .*, branch main\): continues where it was; it is not sent back to the grill$/m);
  assert.match(r.out, /^- custom \(acme-flow, .*, branch main\): untouched by the upgrade/m);
  const j = t.run([t.root, '--json']).json();
  assert.deepEqual(j.changes.map((c) => [c.id, c.script, c.write]), [['custom', 'acme-flow', 'none'], ['planready', 'devkit', 'none'], ['short', 'devkit-lite', 'none'], ['started', 'devkit', 'approval-not-applicable']]);
  const started = j.changes.find((c) => c.id === 'started');
  assert.deepEqual([started.started, started.readiness, started.approval, real(started.checkout.root), started.checkout.branch], [true, 'APPROVED', false, real(t.started), 'started']);
  assert.deepEqual([t.row('planready').started, t.row('planready').approval], [false, false]);
  assert.equal(t.row('short').previous, true);
  assert.equal(t.row('custom').previous, false, 'another schema has no previous script of ours');
  for (const dir of [t.root, t.started, t.planready]) assert.equal(git(dir, 'status', '--porcelain'), '', `${dir} is untouched`);
});

test('field-fixes 7 listing: a slice under way on devkit-project is listed as continuing on the new project script and nothing is written for it', () => {
  const root = gitRepo({
    config: CONFIG,
    changes: { billing: { '.openspec.yaml': 'schema: devkit-project\nskip_specs: true\n', 'business.md': '<!-- devkit-stage business result=passed attempt=1 commit=none -->\n# Business: billing\n' } },
  });
  const env = { ...fakeGh().env, ...BLANKS };
  const run = (...args) => spawnSync(process.execPath, [script, root, ...args], { cwd: root, env, encoding: 'utf8' });
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^- billing \(devkit-project, .*, branch main\): continues on the new project script; its stage records and documents stay$/m);
  const j = JSON.parse(run('--json').stdout);
  assert.deepEqual(j.changes.map((c) => [c.id, c.script, c.write]), [['billing', 'devkit-project', 'none']]);
  const applied = run('--apply', '--owner-answer', 'sim');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(git(root, 'status', '--porcelain'), '', 'nothing is written for a slice');
});

test('field-fixes 7 listing: a project with no change under way says so and --apply writes nothing', () => {
  const root = gitRepo({ config: CONFIG });
  const env = { ...fakeGh().env, ...BLANKS };
  const r = spawnSync(process.execPath, [script, root, '--apply', '--owner-answer', 'sim'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^no change under way$/m);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('field-fixes 7 apply: --apply without --owner-answer exits 2 and writes no file', () => {
  const t = scratch();
  const r = t.run([t.root, '--apply']);
  assert.equal(r.code, 2);
  assert.match(r.err, /--owner-answer/);
  assert.equal(existsSync(join(t.started, 'openspec', 'changes', 'started', 'approval.md')), false);
  const empty = t.run([t.root, '--apply', '--owner-answer', '']);
  assert.equal(empty.code, 2, 'an empty answer is no answer');
  assert.equal(git(t.started, 'status', '--porcelain'), '');
});

test('field-fixes 7 apply: with the owner answer only the started full-script change gets an approval.md that records no approval; a change on another schema gets no file', () => {
  const t = scratch();
  const r = t.run([t.root, '--apply', '--owner-answer', 'Sim, pode atualizar']);
  assert.equal(r.code, 0, r.err);
  const file = join(t.started, 'openspec', 'changes', 'started', 'approval.md');
  const text = readFileSync(file, 'utf8');
  const sha = git(t.started, 'rev-parse', 'HEAD');
  assert.equal(text.split('\n')[0], `<!-- devkit-stage approval result=not-applicable attempt=1 commit=${sha} -->`);
  assert.match(text, /^# Plan approval: started$/m);
  assert.match(text, /^- Status: not applicable$/m);
  assert.match(text, /^- Date: \d{4}-\d{2}-\d{2}$/m);
  assert.match(text, /^- Why: the implementation of this change had started \(tasks ticked in tasks\.md\) when openspec-setup replaced the devkit schemas, before the script asked for this approval\. No approval is recorded here\.$/m);
  assert.match(text, /^- Owner's words: "Sim, pode atualizar"$/m);
  assert.doesNotMatch(text, /APPROVED/);
  assert.equal(git(t.root, 'status', '--porcelain'), '', 'the main checkout (short, custom) gets nothing');
  assert.equal(git(t.planready, 'status', '--porcelain'), '', 'the plan-ready change gets nothing');
  assert.equal(existsSync(join(t.root, 'openspec', 'changes', 'custom', 'approval.md')), false);
  assert.equal(t.row('started').approval, true, 'the listing now sees the file');
});

test('field-fixes 7 apply: the owner answer is cut to 200 characters, and an existing approval.md is never overwritten', () => {
  const t = scratch();
  const long = 'a'.repeat(300);
  assert.equal(t.run([t.root, '--apply', '--owner-answer', long]).code, 0);
  const file = join(t.started, 'openspec', 'changes', 'started', 'approval.md');
  assert.match(readFileSync(file, 'utf8'), new RegExp(`^- Owner's words: "a{200}"$`, 'm'));
  writeFileSync(file, 'the owner wrote this\n');
  assert.equal(t.run([t.root, '--apply', '--owner-answer', 'again']).code, 0);
  assert.equal(readFileSync(file, 'utf8'), 'the owner wrote this\n');
  assert.match(t.run([t.root]).out, /^- started \(devkit, .*\): nothing changes for it$/m);
});

test('field-fixes 7 upgrade: after the listing, the answer and install-schemas the started change is not blocked, the plan-ready one asks the owner once, the short one is not sent to the grill', () => {
  const t = scratch();
  const apply = t.run([t.root, '--apply', '--owner-answer', 'Sim']);
  assert.equal(apply.code, 0, apply.err);
  const install = t.exec('bash', [installer, t.root], t.root);
  assert.equal(install.code, 0, install.err);
  assert.ok(existsSync(join(t.root, 'openspec', 'schemas', 'devkit', 'templates', 'approval.md')), 'the new schema is in place');
  commitAll(t.root, 'upgrade the schemas');
  // a worktree gets the new schemas when its branch takes the default branch
  for (const dir of [t.started, t.planready]) git(dir, 'merge', '-q', '--no-edit', 'main');

  const apply1 = t.exec('openspec', ['instructions', 'apply', '--change', 'started', '--json'], t.started);
  assert.notEqual(JSON.parse(apply1.out).state, 'blocked', apply1.out + apply1.err);
  const apply2 = t.exec('openspec', ['instructions', 'apply', '--change', 'planready', '--json'], t.planready);
  assert.equal(JSON.parse(apply2.out).state, 'blocked', 'the plan-ready change needs the owner approval the new schema asks for');

  assert.notEqual(stepOf(t, t.started, 'started'), 'stop-plan-approval', 'no plan-approval stop once the implementation had started');
  assert.equal(stepOf(t, t.planready, 'planready'), 'stop-plan-approval');
  put(t.planready, { 'openspec/changes/planready/approval.md': approvalFor(t.planready, 'planready') });
  assert.notEqual(stepOf(t, t.planready, 'planready'), 'stop-plan-approval', 'after the owner approval is recorded it goes on');
  const after = t.exec('openspec', ['instructions', 'apply', '--change', 'planready', '--json'], t.planready);
  assert.notEqual(JSON.parse(after.out).state, 'blocked');

  const next = t.exec(process.execPath, [join(hooks, 'change-loop.mjs'), 'next', '--change', 'short', '--lang', 'en'], t.root);
  assert.equal(next.code, 2, next.err);
  const action = JSON.parse(next.out.split('\n').filter((l) => !/^devkit-(run|end): /.test(l)).join('\n'));
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.notEqual(action.kind, 'grill');
});

test('field-fixes 7 upgrade: without the owner answer no schema is replaced and no file is written (the listing alone changes nothing)', () => {
  const t = scratch();
  assert.equal(t.run([t.root]).code, 0, 'the listing runs');
  assert.equal(existsSync(join(t.root, 'openspec', 'schemas', 'devkit', 'templates', 'approval.md')), false, 'the schemas are still the 0.13.0 ones');
  for (const dir of [t.root, t.started, t.planready]) assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('field-fixes 7 flow-check: readFlowFile reads a flow.json by path, readFlow still reads it by schema, and a malformed one names the path', () => {
  const file = join(here, '..', '..', '..', 'schemas', 'devkit', 'flow.json');
  const flow = flowCheck.readFlowFile(file);
  assert.equal(flow.version, 1);
  assert.deepEqual(flow, flowCheck.readFlow(gitRepo({ config: 'schema: devkit\n' }), 'devkit'));
  const dir = mkdtempSync(join(tmpdir(), 'devkit-flow-'));
  mkdirSync(join(dir, 'x'));
  writeFileSync(join(dir, 'x', 'flow.json'), '{"version": 1}');
  assert.throws(() => flowCheck.readFlowFile(join(dir, 'x', 'flow.json')), (e) => e instanceof flowCheck.FlowUsageError && e.message.includes('x/flow.json') && /malformed/.test(e.message));
});
