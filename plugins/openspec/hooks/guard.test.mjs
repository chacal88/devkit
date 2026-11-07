// node --test plugins/openspec/hooks/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitViolation, readValue, resolveChange, sanitize, bashWrites, reviewConsensus } from './guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, 'guard.mjs');
const schemas = join(here, '..', 'schemas');

function repo({ changes = {}, branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'devkit-guard-'));
  execFileSync('git', ['init', '-q', '-b', branch, root]);
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  cpSync(schemas, join(root, 'openspec', 'schemas'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: devkit\n');
  for (const [name, files] of Object.entries(changes)) {
    const dir = join(root, 'openspec', 'changes', name);
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), body);
    }
    mkdirSync(dir, { recursive: true });
  }
  return root;
}

const clean = { DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '' };
function run(mode, input, env = {}, cwd) {
  const r = spawnSync('node', [guard, mode], { cwd, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...clean, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
const agent = (a) => (a ? { agent_type: `devkit-core:${a}`, agent_id: 'x' } : {});
const edit = (root, file, a) => run('edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, file) }, ...agent(a) });
const bash = (root, command, a, env) => run('bash', { cwd: root, tool_name: 'Bash', tool_input: { command }, ...agent(a) }, env);

const devkit = { '.openspec.yaml': 'schema: devkit\n' };
const lite = { '.openspec.yaml': 'schema: devkit-lite\nskip_specs: true\n' };
const approved = { ...devkit, 'readiness.md': '## 1. Decision\n- Status: APPROVED\n' };
const goodReviews = {
  'reviews/code-quality-reviewer.md': 'Verdict: approved\n',
  'reviews/test-coverage-reviewer.md': 'Verdict: approved\n',
};
const evidence = { 'evidence.md': '# Evidence\n| AC-1 | test green | ci |\n' };

// ---------------------------------------------------------------- parsing

test('readValue: unfilled template line is not a value; full token kept', () => {
  const root = repo({ changes: { a: { 't.md': '- Status: APPROVED | NEEDS-REVISION | BLOCKED\n', 'n.md': '- Status: NEEDS-REVISION\n', 'b.md': '**Status:** APPROVED — high\n' } } });
  assert.equal(readValue(join(root, 'openspec/changes/a/t.md'), 'Status'), null);
  assert.equal(readValue(join(root, 'openspec/changes/a/n.md'), 'Status'), 'NEEDS-REVISION');
  assert.equal(readValue(join(root, 'openspec/changes/a/b.md'), 'Status'), 'APPROVED');
});

test('sanitize drops heredoc bodies and quoted text', () => {
  const cmd = "cat > tasks.md <<'EOF'\n- [ ] 9.1 run gh pr create\ngit push --force\nEOF\necho \"git add -A\"";
  const s = sanitize(cmd);
  assert.doesNotMatch(s, /gh pr create|push --force|add -A/);
  assert.match(s, /cat > tasks.md/);
});

test('bashWrites finds redirections, tee, sed -i, cp/mv', () => {
  assert.deepEqual(bashWrites("cat > src/a.js <<'EOF'\nx > y\nEOF"), ['src/a.js']);
  assert.deepEqual(bashWrites('echo hi >> notes.md 2>&1'), ['notes.md']);
  assert.deepEqual(bashWrites('npm test 2>&1 | tail -5'), []);
  assert.deepEqual(bashWrites('ls > /dev/null'), []);
  assert.deepEqual(bashWrites("echo x | tee -a log.txt"), ['log.txt']);
  assert.deepEqual(bashWrites("sed -i '' 's/a/b/' src/a.js"), ['src/a.js']);
  assert.deepEqual(bashWrites('cp tmp/a.js src/a.js && mv b c'), ['src/a.js', 'c']);
  assert.deepEqual(bashWrites('cat src/a.js | grep x'), []);
  assert.deepEqual(bashWrites("cd openspec/changes/x && cat > requirements.md <<'EOF'\nhi\nEOF", '/r'), ['/r/openspec/changes/x/requirements.md']);
  assert.deepEqual(bashWrites('cd src; cd ..; echo a > b.txt', '/r'), ['/r/b.txt']);
  assert.deepEqual(bashWrites('cp src/a.js "$SCRATCH"/a.js && echo x > $TMPDIR/out', '/r'), []);
});

// ---------------------------------------------------------------- code gate

test('no open change: nothing gated', () => {
  assert.equal(edit(repo(), 'src/a.ts').code, 0);
});

test('devkit: code closed until readiness APPROVED; planning always open', () => {
  const root = repo({ changes: { feat: { ...devkit, 'readiness.md': '- Status: NEEDS-REVISION\n' } } });
  const r = edit(root, 'src/a.ts', 'tdd-implementer');
  assert.equal(r.code, 2);
  assert.match(r.err, /Status: NEEDS-REVISION/);
  assert.equal(edit(root, 'openspec/changes/feat/tasks.md').code, 0);
  assert.equal(edit(root, '.claude/settings.json').code, 0);
});

test('devkit: after approval, only tdd-implementer writes code', () => {
  const root = repo({ changes: { feat: approved } });
  const main = edit(root, 'src/a.ts');
  assert.equal(main.code, 2);
  assert.match(main.err, /tdd-implementer/);
  assert.equal(edit(root, 'src/a.ts', 'tdd-implementer').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/tasks.md', 'tdd-implementer').code, 0, 'implementer ticks tasks');
});

test('devkit-lite: no readiness, main session may code', () => {
  assert.equal(edit(repo({ changes: { fix: lite } }), 'src/a.ts').code, 0);
});

test('shell writes are gated like Write', () => {
  const root = repo({ changes: { feat: { ...devkit } } });
  assert.equal(bash(root, "cat > src/a.js <<'EOF'\nx\nEOF").code, 2);
  assert.equal(bash(root, "cat > openspec/changes/feat/tasks.md <<'EOF'\n- [ ] gh pr create\nEOF").code, 0, 'heredoc text is not a command');
  assert.equal(bash(root, 'npm test 2>&1 | tail -5').code, 0);
  assert.equal(bash(root, "cd openspec/changes/feat && cat > requirements.md <<'EOF'\nx\nEOF").code, 0, 'cd is followed');
  assert.equal(bash(root, "cd openspec/changes/feat && cat > ../../../src/a.js <<'EOF'\nx\nEOF").code, 2);
});

// ---------------------------------------------------------------- roles

test('readiness.md is written only by plan-readiness-reviewer', () => {
  const root = repo({ changes: { feat: { ...devkit } } });
  const r = edit(root, 'openspec/changes/feat/readiness.md');
  assert.equal(r.code, 2);
  assert.match(r.err, /plan-readiness-reviewer/);
  assert.equal(bash(root, "cat > openspec/changes/feat/readiness.md <<'EOF'\n- Status: APPROVED\nEOF").code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/readiness.md', 'change-planner').code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/readiness.md', 'plan-readiness-reviewer').code, 0);
});

test('each reviewer writes only its own verdict file', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'openspec/changes/feat/reviews/security-reviewer.md', 'security-reviewer').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/reviews/code-quality-reviewer.md', 'security-reviewer').code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/reviews/code-quality-reviewer.md').code, 2, 'main session');
  assert.equal(edit(root, 'src/a.ts', 'security-reviewer').code, 2, 'reviewers never write code');
  assert.equal(edit(root, 'openspec/changes/feat/proposal.md', 'security-reviewer').code, 2);
});

test('evidence.md is written only by pr-verifier', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'openspec/changes/feat/evidence.md').code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/evidence.md', 'change-planner').code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/evidence.md', 'pr-verifier').code, 0);
});

test('several changes: branch selects, otherwise code is blocked', () => {
  const changes = { one: approved, two: { ...devkit } };
  assert.equal(edit(repo({ changes }), 'src/a.ts', 'tdd-implementer').code, 2);
  assert.equal(edit(repo({ changes, branch: 'feat/one' }), 'src/a.ts', 'tdd-implementer').code, 0);
  assert.equal(edit(repo({ changes, branch: 'feat/two' }), 'src/a.ts', 'tdd-implementer').code, 2);
});

test('resolveChange: DEVKIT_CHANGE, then GITHUB_HEAD_REF', () => {
  const root = repo({ changes: { one: {}, two: {} } });
  assert.deepEqual(resolveChange(root, { DEVKIT_CHANGE: 'two' }, 'main'), { name: 'two' });
  assert.deepEqual(resolveChange(root, { GITHUB_HEAD_REF: 'feat/two' }), { name: 'two' });
});

// ---------------------------------------------------------------- PR gate

test('reviewConsensus needs the required reviewers, all approved', () => {
  const root = repo({ changes: { a: { 'reviews/code-quality-reviewer.md': 'Verdict: approved\n' }, b: { ...goodReviews, 'reviews/security-reviewer.md': 'Verdict: rejected\n' }, c: goodReviews } });
  const d = (n) => join(root, 'openspec/changes', n);
  assert.deepEqual(reviewConsensus(d('a')).missing, ['test-coverage-reviewer']);
  assert.equal(reviewConsensus(d('b')).ok, false);
  assert.equal(reviewConsensus(d('c')).ok, true);
  writeFileSync(join(d('c'), 'reviews/security-reviewer.md'), 'Verdict: declined\n');
  assert.equal(reviewConsensus(d('c')).ok, true, 'declined is non-blocking');
});

test('gh pr create needs approved reviews and evidence', () => {
  const root = repo({ changes: { feat: approved } });
  const pr = () => bash(root, 'gh pr create --title x --body y');
  assert.match(pr().err, /review not approved/);
  mkdirSync(join(root, 'openspec/changes/feat/reviews'), { recursive: true });
  for (const [f, b] of Object.entries(goodReviews)) writeFileSync(join(root, 'openspec/changes/feat', f), b);
  assert.match(pr().err, /evidence.md/);
  writeFileSync(join(root, 'openspec/changes/feat/evidence.md'), evidence['evidence.md']);
  assert.equal(pr().code, 0);
});

test('destructive git is refused, quoted mentions are not', () => {
  for (const c of ['git push --force', 'git push -f origin x', 'git commit --no-verify -m x', 'git reset --hard HEAD~1',
    'git clean -fd', 'git branch -D x', 'git checkout -- .', 'git add -A', 'git add .', 'gh pr merge 3 --admin']) {
    assert.ok(gitViolation(c), c);
  }
  for (const c of ['git push --force-with-lease', 'git add src/a.ts', 'git push -u origin feat', 'git reset --soft HEAD~1',
    'git status', 'git commit -m "never use --no-verify"', "echo 'git push --force is bad'"]) {
    assert.equal(gitViolation(c), null, c);
  }
});

test('bypass only from the hook process env', () => {
  const root = repo();
  assert.equal(bash(root, 'DEVKIT_BYPASS=1 git push --force').code, 2);
  assert.equal(bash(root, 'git push --force', undefined, { DEVKIT_BYPASS: '1' }).code, 0);
});

// ---------------------------------------------------------------- CI

test('ci mode checks the branch change and ignores bypass', () => {
  const root = repo({ changes: { feat: approved } });
  const ci = (env = {}) => spawnSync('node', [guard, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean, ...env } }).status;
  assert.equal(ci(), 1);
  mkdirSync(join(root, 'openspec/changes/feat/reviews'), { recursive: true });
  for (const [f, b] of Object.entries({ ...goodReviews, ...evidence })) writeFileSync(join(root, 'openspec/changes/feat', f), b);
  assert.equal(ci(), 0);
  writeFileSync(join(root, 'openspec/changes/feat/readiness.md'), '- Status: BLOCKED\n');
  assert.equal(ci({ DEVKIT_BYPASS: '1' }), 1);
});
