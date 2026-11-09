// node --test plugins/openspec/hooks/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitViolation, readValue, resolveChange, sanitize, bashWrites, reviewConsensus, readRoadmap, findRoot, changeSchema, changeDir } from './guard.mjs';

import { gitRepo, put, commitAll, git as gitIn } from './deliver-check.test.mjs'; // ship-modes tests ride on the same command
import './merge-setup.test.mjs'; // auto-merge: the GitHub facts and the workflow files
import '../skills/openspec-setup/scripts/github-setup.test.mjs'; // auto-merge: the GitHub setup script

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, 'guard.mjs');
const schemas = join(here, '..', 'schemas');

function repo({ changes = {}, branch = 'main', roadmap, archived = [] } = {}) {
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
  for (const a of archived) mkdirSync(join(root, 'openspec', 'changes', 'archive', `2026-01-01-${a}`), { recursive: true });
  if (roadmap !== undefined) writeFileSync(join(root, 'openspec', 'roadmap.md'), roadmap);
  return root;
}

const clean = { DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
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

const CI_TASKS = '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n';
// A committed devkit change `feat` (readiness APPROVED) on branch ship/feat.
function ciRepo() {
  const root = gitRepo({
    config: 'schema: devkit\n',
    changes: { feat: { '.openspec.yaml': 'schema: devkit\n', 'readiness.md': '## 1. Decision\n- Status: APPROVED\n', 'proposal.md': '## Acceptance criteria\n- AC-1: x\n', 'tasks.md': CI_TASKS } },
    files: { 'src/a.ts': 'a\n' },
  });
  gitIn(root, 'switch', '-q', '-c', 'ship/feat');
  return root;
}
const proveHead = (root) => {
  const sha = gitIn(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': `Verdict: approved\nCommit: ${sha}\n`,
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': `Verdict: approved\nCommit: ${sha}\n`,
    'openspec/changes/feat/evidence.md': `Commit: ${sha}\n\n# Evidence\n| 1.2 | \`node -e 0\` | pass: ok |\n| AC-1 | test | pass: t |\n`,
  });
  commitAll(root, 'prove');
};

test('ci mode runs the devkit-reviews check: current reviews and evidence pass, a later product commit makes them stale, bypass is ignored (AC-5)', () => {
  const root = ciRepo();
  const ci = (env = {}, script = guard) => spawnSync('node', [script, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean, ...env } });
  assert.equal(ci().status, 1, 'no reviews yet');
  proveHead(root);
  const ok = ci();
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^devkit-reviews: feat \(schema devkit, head [0-9a-f]{7}\)$/m);
  assert.match(ok.stdout, /^pass$/m);
  assert.equal(ci({ DEVKIT_BYPASS: '1' }).status, 0);
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  for (const env of [{}, { DEVKIT_BYPASS: '1' }]) {
    const stale = ci(env);
    assert.equal(stale.status, 1, 'verdicts are all approved, but the reviews are stale');
    assert.match(stale.stdout, /stale code-quality-reviewer/);
  }
  put(root, { 'openspec/changes/feat/readiness.md': '- Status: BLOCKED\n' });
  assert.equal(ci({ DEVKIT_BYPASS: '1' }).status, 1);
});

test('ci mode: a repository without openspec/ passes with a note, so the devkit-reviews job never breaks a repo that has not adopted OpenSpec (R-3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-plain-'));
  gitIn(dir, 'init', '-q', '-b', 'main');
  for (const script of [guard, join(dirname(guard), 'deliver-check.mjs')]) {
    const r = spawnSync('node', [script, ...(script === guard ? ['ci'] : ['--ci'])], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...clean } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no openspec\/ folder; nothing to check/);
  }
});

test('ci mode: guard.mjs alone fails closed naming deliver-check.mjs; a symlinked guard.mjs works (design D3)', () => {
  const root = ciRepo();
  proveHead(root);
  const lone = join(mkdtempSync(join(tmpdir(), 'devkit-lone-')), 'guard.mjs');
  cpSync(guard, lone);
  const r = spawnSync('node', [lone, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /devkit ci: guard\.mjs ci needs deliver-check\.mjs and merge-setup\.mjs in the same folder \(download all three; see docs\/openspec-flow\.md#ci\)/);
  const link = join(mkdtempSync(join(tmpdir(), 'devkit-cilink-')), 'guard.mjs');
  symlinkSync(guard, link);
  const ok = spawnSync('node', [link, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^pass$/m);
});

test('ci mode passes its arguments on: --json prints the deliver-check report', () => {
  const root = ciRepo();
  proveHead(root);
  const r = spawnSync('node', [guard, 'ci', '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(r.status, 0);
  assert.deepEqual([JSON.parse(r.stdout).mode, JSON.parse(r.stdout).pass], ['ci', true]);
});

// ---------------------------------------------------------------- roadmap

const session = (root, env) => run('session', { cwd: root }, env);
const ROADMAP = `# Roadmap

## Round 1: auth
- [x] auth-scopes

## Round 2: exports
- [x] export-csv-base
- [ ] add-csv-export (after: auth-scopes, export-csv-base)
- [ ] export-audit-log
- [ ] export-pdf (after: export-audit-log)
- [ ] export-json

## Round 3: later
- [ ] something-else
`;

test('readRoadmap parses rounds, ticks and dependencies, skipping junk', () => {
  const root = repo({ roadmap: '# R\nintro text\n- [ ] orphan-before-any-round\n## Round A\n- [X] a\n- [ ] b (after: a)\nnot a line\n- [ ]\n* [ ] c\n' });
  assert.deepEqual(readRoadmap(root), [{ title: 'Round A', items: [
    { id: 'a', done: true, after: [] },
    { id: 'b', done: false, after: ['a'] },
    { id: 'c', done: false, after: [] },
  ] }]);
  assert.equal(readRoadmap(repo()), null, 'no roadmap file');
});

test('session prints the current round with one state per pending change (AC-1)', () => {
  const root = repo({ roadmap: ROADMAP, changes: { 'export-audit-log': lite }, archived: ['export-json'] });
  const { code, out } = session(root);
  assert.equal(code, 0);
  assert.match(out, /Roadmap: Round 2: exports \(1\/5 done\)/);
  assert.match(out, /add-csv-export: not started/);
  assert.match(out, /export-audit-log: open/);
  assert.match(out, /export-pdf: waiting on export-audit-log/);
  assert.match(out, /export-json: archived, tick it/);
  assert.doesNotMatch(out, /something-else|auth-scopes:/, 'only the current round, only pending lines');
});

test('a pending change waiting on a dependency is reported as waiting, even if open', () => {
  const root = repo({ roadmap: '## R\n- [ ] a\n- [ ] b (after: a)\n', changes: { a: lite, b: lite } });
  const { out } = session(root, { DEVKIT_CHANGE: 'b' });
  assert.match(out, /b: waiting on a/);
  assert.match(out, /a: open/);
});

test('roadmap is printed with no change, one change, or several (AC-1)', () => {
  const rm = '## Only\n- [ ] x\n';
  assert.match(session(repo({ roadmap: rm })).out, /Roadmap: Only \(0\/1 done\)/);
  assert.match(session(repo({ roadmap: rm, changes: { x: lite } })).out, /Active OpenSpec change: x[\s\S]*Roadmap: Only/);
  const several = session(repo({ roadmap: rm, changes: { x: lite, y: lite } })).out;
  assert.match(several, /Open OpenSpec changes: x, y/);
  assert.match(several, /Roadmap: Only/);
});

test('without a roadmap the session output is unchanged; all ticked adds one line (AC-2)', () => {
  const root = repo({ changes: { x: lite } });
  const before = session(root).out;
  assert.doesNotMatch(before, /Roadmap/);
  writeFileSync(join(root, 'openspec', 'roadmap.md'), '## A\n- [x] x\n## B\n- [x] y\n');
  assert.equal(session(root).out, `${before}[devkit] Roadmap: all rounds done.\n`);
  assert.equal(session(repo()).out, '', 'no change, no roadmap: silent');
});

test('the roadmap never blocks and never breaks the hook (AC-3)', () => {
  for (const roadmap of [undefined, ROADMAP, '', 'garbage\n- [ ] (after: )\n## \n- [ ] x (after: nope, )\n', '\u0000\u00ff## ]]\n']) {
    const root = repo({ roadmap, changes: { feat: { ...devkit } } });
    assert.equal(session(root).code, 0, `session with ${JSON.stringify(roadmap)}`);
    assert.equal(edit(root, 'src/a.ts', 'tdd-implementer').code, 2, 'code still gated by readiness');
    assert.equal(edit(root, 'openspec/roadmap.md').code, 0, 'roadmap stays editable');
    assert.equal(bash(root, 'git push --force').code, 2);
    assert.equal(bash(root, 'git status').code, 0);
    const ci = spawnSync('node', [guard, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean } }).status;
    assert.equal(ci, 1, 'ci verdict unchanged');
  }
});

test('archived means the exact id after the date prefix, never a suffix match', () => {
  const root = repo({ roadmap: '## R\n- [ ] csv-export\n- [ ] json\n- [ ] add-csv-export\n', archived: ['add-csv-export', 'big-json'] });
  mkdirSync(join(root, 'openspec', 'changes', 'archive', 'json'), { recursive: true });
  const { out } = session(root);
  assert.match(out, /csv-export: not started/);
  assert.match(out, /json: not started/, 'undated archive folder is not an archive');
  assert.match(out, /add-csv-export: archived, tick it/);
});

test('an unreadable roadmap prints nothing and keeps the change report', () => {
  const root = repo({ changes: { x: lite } });
  mkdirSync(join(root, 'openspec', 'roadmap.md'));
  const r = session(root);
  assert.equal(r.code, 0);
  assert.match(r.out, /Active OpenSpec change: x/);
  assert.doesNotMatch(r.out, /Roadmap/);
});

// ---------------------------------------------------------------- direct execution (ship-modes D3)

test('guard run through a symlinked path still gates code (exit 2)', () => {
  const root = repo({ changes: { feat: { ...approved } } });
  const link = join(mkdtempSync(join(tmpdir(), 'devkit-link-')), 'guard.mjs');
  symlinkSync(guard, link);
  const input = { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src/a.ts') } };
  const r = spawnSync('node', [link, 'edit'], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /tdd-implementer/);
});

test('importing guard.mjs runs no mode: no exit, no output, even with DEVKIT_BYPASS=1 and argv ci', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-import-'));
  const script = join(dir, 'importer.mjs');
  writeFileSync(script, "await import(process.env.GUARD_URL);\nconsole.log('alive');\n");
  const r = spawnSync('node', [script, 'ci'], { cwd: dir, encoding: 'utf8',
    env: { ...process.env, ...clean, DEVKIT_BYPASS: '1', GUARD_URL: pathToFileURL(guard).href } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'alive\n');
  assert.equal(r.stderr, '');
});

test('guard exports findRoot, changeSchema and changeDir', () => {
  const root = repo({ changes: { feat: { ...lite } } });
  assert.equal(findRoot(join(root, 'openspec', 'changes')), root);
  assert.equal(changeSchema(root, 'feat'), 'devkit-lite');
  assert.equal(changeDir(root, 'feat'), join(root, 'openspec', 'changes', 'feat'));
});
