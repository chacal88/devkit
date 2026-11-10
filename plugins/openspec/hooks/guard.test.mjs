// node --test plugins/openspec/hooks/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, symlinkSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitViolation, readValue, resolveChange, sanitize, bashWrites, reviewConsensus, readRoadmap, findRoot, changeSchema, changeDir, archiveBranchChange, commandSegments, classify, DEVKIT_SCHEMAS, projectSchema, optedIn } from './guard.mjs';

import { gitRepo, put, commitAll, git as gitIn } from './deliver-check.test.mjs'; // ship-modes tests ride on the same command
import './merge-setup.test.mjs'; // auto-merge: the GitHub facts and the workflow files
import './conduct-check.test.mjs'; // conduct-rounds: the round computation
import './release-rebase.test.mjs'; // conduct-rounds: release-file conflicts
import '../skills/openspec-setup/scripts/github-setup.test.mjs'; // auto-merge: the GitHub setup script
import '../skills/openspec-setup/scripts/install-schemas.test.mjs'; // devkit per project: install-schemas.sh forms
import '../skills/openspec-setup/scripts/project-settings.test.mjs'; // devkit per project: the settings writer

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
    { id: 'a', done: true, after: [], text: '', notes: '' },
    { id: 'b', done: false, after: ['a'], text: '', notes: '' },
    { id: 'c', done: false, after: [], text: '', notes: '' },
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

// ---------------------------------------------------------------- the archive branch (archive-after-merge D2)

test('archiveBranchChange: chore/archive-<x> names x while x is active or archived, an exact suffix only', () => {
  const root = repo({ changes: { x: devkit, merge: devkit }, archived: ['old'] });
  assert.equal(archiveBranchChange(root, 'chore/archive-x'), 'x');
  assert.equal(archiveBranchChange(root, 'chore/archive-old'), 'old', 'archived: the id after the date prefix');
  assert.equal(archiveBranchChange(root, 'chore/archive-ol'), null, 'not a suffix match');
  assert.equal(archiveBranchChange(root, 'chore/archive-y'), null, 'unknown change');
  assert.equal(archiveBranchChange(root, 'archive-x'), null, 'only the chore/ form');
  assert.equal(archiveBranchChange(root, 'feat/x'), null);
  assert.equal(archiveBranchChange(root, ''), null);
  const dated = repo({ archived: ['xx'] });
  assert.equal(archiveBranchChange(dated, 'chore/archive-x'), null, 'archive/2026-01-01-xx is not x');
});

test('resolveChange on an archive branch: the change while active, null once it moved, never another change', () => {
  const active = repo({ changes: { x: devkit, merge: devkit } });
  assert.deepEqual(resolveChange(active, {}, 'chore/archive-x'), { name: 'x' });
  const moved = repo({ changes: { merge: devkit }, archived: ['x'] });
  assert.equal(resolveChange(moved, {}, 'chore/archive-x'), null, 'no only-open-change fallback');
  const contained = repo({ changes: { merge: devkit, other: devkit }, archived: ['auto-merge'] });
  assert.equal(resolveChange(contained, {}, 'chore/archive-auto-merge'), null, 'no contained-name rule');
  const unknown = repo({ changes: { only: devkit } });
  assert.deepEqual(resolveChange(unknown, {}, 'chore/archive-y'), { name: 'only' }, 'unknown y resolves as today');
  assert.equal(resolveChange(moved, { DEVKIT_CHANGE: 'merge' }, 'chore/archive-x').name, 'merge', 'DEVKIT_CHANGE wins');
});

test('hooks on an archive branch: another open change gates neither gh pr create nor product edits (AC-7)', () => {
  const root = repo({ branch: 'chore/archive-x', changes: { merge: approved }, archived: ['x'] });
  assert.equal(bash(root, 'gh pr create --title t --body b').code, 0, 'merge is unreviewed but not selected');
  assert.equal(edit(root, 'CONTRIBUTING.md').code, 0, 'merge readiness does not gate product files here');
  assert.equal(edit(root, 'src/a.ts').code, 0);
});

test('before the move, the archive branch still gates its change: product code to tdd-implementer, gh pr create to reviews (AC-7)', () => {
  const root = repo({ branch: 'chore/archive-x', changes: { x: approved } });
  assert.equal(edit(root, 'src/a.ts').code, 2, 'main session cannot write code');
  assert.equal(edit(root, 'src/a.ts', 'tdd-implementer').code, 0);
  assert.equal(bash(root, 'gh pr create --title t --body b').code, 2, 'the archive PR goes through gh pr create, not around it');
});

test('ADR 0003 exists with Status: accepted, ADR 0002 points to it and has no "until round 3", and the places that list ADRs name it (3.6, 3.7, AC-8)', () => {
  const root = join(here, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const adr = join(root, 'docs', 'adr', '0003-auto-merge-the-archive-pr.md');
  assert.ok(existsSync(adr), 'ADR 0003 file');
  const body = readFileSync(adr, 'utf8');
  assert.match(body, /^- Status: accepted$/m);
  assert.match(body, /^# ADR 0003: Auto-merge the archive PR/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) assert.ok(body.includes(h), h);
  for (const f of [['README.md'], ['docs', 'openspec-flow.md'], ['openspec', 'config.yaml'], ['CONTRIBUTING.md']]) {
    assert.match(read(...f), /0003/, `${f.join('/')} names ADR 0003`);
  }
  assert.match(read('openspec', 'config.yaml'), /0003 auto-merge the archive PR/);
  assert.match(read('docs', 'openspec-flow.md'), /adr\/0003-auto-merge-the-archive-pr\.md/);
  assert.doesNotMatch(body, /gates nothing|outside `openspec\/`/, 'ADR 0003 describes the archive-PR check as it is');
  assert.match(body, /`devkit-reviews --ci` checks archive PRs/);
  assert.match(body, /`openspec\/changes\/\*\*`, `openspec\/roadmap\.md`/);
  const adr2 = read('docs', 'adr', '0002-merge-without-the-owner-opt-in.md');
  assert.doesNotMatch(adr2, /until round 3/);
  assert.match(adr2, /0003-auto-merge-the-archive-pr\.md/);
  assert.match(adr2, /^- Status: accepted$/m);
});

// ---------------------------------------------------------------- opt-in (ADR 0004)

// A project whose openspec/config.yaml says `configText` (null: no config.yaml).
function project({ config, changes = {}, roadmap, base } = {}) {
  const root = base || mkdtempSync(join(tmpdir(), 'devkit-optin-'));
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  if (config !== null && config !== undefined) writeFileSync(join(root, 'openspec', 'config.yaml'), config);
  for (const [name, files] of Object.entries(changes)) {
    const dir = join(root, 'openspec', 'changes', name);
    mkdirSync(dir, { recursive: true });
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), body);
    }
  }
  if (roadmap !== undefined) writeFileSync(join(root, 'openspec', 'roadmap.md'), roadmap);
  return root;
}

const specDriven = { '.openspec.yaml': 'schema: spec-driven\n' };
const pending = '## Round 1\n- [ ] x\n';
const silent = (r, what) => {
  assert.equal(r.code, 0, `${what}: exit 0 (${r.err})`);
  assert.equal(r.out, '', `${what}: no stdout`);
  assert.equal(r.err, '', `${what}: no stderr`);
};
const noGitHere = () => mkdtempSync(join(tmpdir(), 'devkit-nogit-'));
const hookCases = (root) => {
  const out = [];
  for (const c of ['git push --force', 'git push -f origin x', 'git reset --hard HEAD~1', 'git add -A', 'gh pr merge 3 --admin', 'gh pr create --title t --body b']) {
    out.push([`bash ${c}`, bash(root, c)]);
  }
  out.push(['edit src/a.ts', edit(root, 'src/a.ts')]);
  out.push(['session', session(root)]);
  return out;
};

test('not opted in: a folder with no openspec/ and a spec-driven repo are silent in every mode (AC-1)', () => {
  const plain = noGitHere();
  for (const [what, r] of hookCases(plain)) silent(r, `no openspec: ${what}`);
  const sd = project({ config: 'schema: spec-driven\n', changes: { x: specDriven }, roadmap: pending });
  for (const [what, r] of hookCases(sd)) silent(r, `spec-driven: ${what}`);
});

test('not opted in: no config.yaml, a custom schema name, and a comment-only devkit are silent (AC-1)', () => {
  for (const [label, config] of [['no config.yaml', null], ['schema: devkit-lite-custom', 'schema: devkit-lite-custom\n'], ['comment only', '# schema: devkit\n']]) {
    const root = project({ config, changes: { x: specDriven }, roadmap: pending });
    for (const [what, r] of hookCases(root)) silent(r, `${label}: ${what}`);
  }
});

test('spec-driven: the main session writes the gate files and opens a PR; session prints no [devkit] line (AC-2)', () => {
  const root = project({ config: 'schema: spec-driven\n', changes: { x: specDriven }, roadmap: pending });
  for (const f of ['openspec/changes/x/readiness.md', 'openspec/changes/x/evidence.md', 'openspec/changes/x/reviews/code-quality-reviewer.md']) {
    assert.equal(edit(root, f).code, 0, f);
  }
  assert.equal(bash(root, 'gh pr create --title t --body b').code, 0);
  assert.doesNotMatch(session(root).out, /\[devkit\]/);
});

test('opted in with a quoted schema and a change on another schema: still gated (AC-3)', () => {
  const root = project({ config: 'schema: "devkit-lite"\n', changes: { x: { '.openspec.yaml': 'schema: representante-digital\n' } } });
  const f = bash(root, 'git push --force');
  assert.equal(f.code, 2);
  assert.match(f.err, /force push/);
  assert.equal(bash(root, 'gh pr create --title t --body b').code, 2, 'no reviews');
  assert.match(session(root).out, /\[devkit\]/);
});

test('opted in: a subdirectory cwd is gated, and so is a repo with no active change (AC-3)', () => {
  const root = project({ config: 'schema: devkit\n', changes: { x: devkit } });
  const deep = join(root, 'src', 'deep');
  mkdirSync(deep, { recursive: true });
  assert.equal(run('bash', { cwd: deep, tool_input: { command: 'git reset --hard' } }).code, 2);
  assert.equal(run('edit', { cwd: deep, tool_input: { file_path: join(root, 'openspec/changes/x/readiness.md') } }).code, 2);
  const none = project({ config: 'schema: devkit-lite\n' });
  assert.equal(bash(none, 'git push --force').code, 2, 'destructive git refused with no active change');
  assert.equal(edit(none, 'src/a.ts').code, 0, 'nothing else is gated');
});

test('a nested checkout with its own spec-driven config is judged by its own config, not the outer repo (AC-3)', () => {
  const outer = project({ config: 'schema: devkit\n', changes: { x: devkit } });
  const inner = project({ config: 'schema: spec-driven\n', changes: { w: specDriven }, base: join(outer, '.claude', 'worktrees', 'w') });
  for (const [what, r] of hookCases(inner)) silent(r, `nested: ${what}`);
  assert.equal(bash(outer, 'git push --force').code, 2, 'the outer repo is still gated');
});

test('optedIn and projectSchema read the config.yaml next to openspec/changes (D2, D3)', () => {
  assert.deepEqual(DEVKIT_SCHEMAS, ['devkit', 'devkit-lite']);
  const cases = [
    ['schema: devkit\n', 'devkit', true], ['schema: devkit-lite\n', 'devkit-lite', true],
    ['schema: "devkit-lite"\n', 'devkit-lite', true], ["schema: 'devkit'\n", 'devkit', true],
    ['schema: spec-driven\n', 'spec-driven', false], ['schema: devkit-lite-custom\n', 'devkit-lite-custom', false],
    ['# schema: devkit\n', null, false], ['context: x\n', null, false], [null, null, false],
  ];
  for (const [config, schema, on] of cases) {
    const root = project({ config });
    assert.equal(projectSchema(root), schema, `projectSchema(${JSON.stringify(config)})`);
    assert.equal(optedIn(root), on, `optedIn(${JSON.stringify(config)})`);
  }
  assert.equal(optedIn(project({ config: 'schema: spec-driven\n', changes: { x: devkit } })), false, 'a change schema does not opt in');
});

test('DEVKIT_BYPASS and ci keep their meaning in an opted-in project (D3)', () => {
  const root = project({ config: 'schema: devkit\n' });
  assert.equal(bash(root, 'git push --force', undefined, { DEVKIT_BYPASS: '1' }).code, 0);
});

test('ADR 0004 exists with its sections and the places that list ADRs name it (1.6)', () => {
  const root = join(here, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const adr = join(root, 'docs', 'adr', '0004-devkit-per-project.md');
  assert.ok(existsSync(adr), 'ADR 0004 file');
  const body = readFileSync(adr, 'utf8');
  assert.match(body, /^- Status: (accepted|proposed)$/m);
  assert.match(body, /^# ADR 0004: devkit is opt-in per project/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) assert.ok(body.includes(h), h);
  for (const f of [['README.md'], ['docs', 'openspec-flow.md'], ['openspec', 'config.yaml'], ['CONTRIBUTING.md']]) {
    assert.match(read(...f), /0004/, `${f.join('/')} names ADR 0004`);
  }
  assert.match(read('openspec', 'config.yaml'), /0004 devkit per project/);
  assert.match(read('docs', 'openspec-flow.md'), /adr\/0004-devkit-per-project\.md/);
  assert.match(read('README.md'), /in projects that opted in/);
});

test('the hook docs say where the hooks act (1.7)', () => {
  const root = join(here, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const flow = read('docs', 'openspec-flow.md');
  assert.match(flow, /Where the hooks act/);
  assert.match(flow, /renamed schema[^\n]*hooks|hooks[^\n]*renamed schema/i);
  assert.match(read('plugins', 'openspec', 'README.md'), /openspec\/config\.yaml/);
  assert.match(read('plugins', 'openspec', 'hooks', 'hooks.json'), /opted-in|opted in/);
});

test('openspec-setup SKILL.md teaches the per-project opt-in (2.4)', () => {
  const root = join(here, '..', '..', '..');
  const skill = readFileSync(join(root, 'plugins', 'openspec', 'skills', 'openspec-setup', 'SKILL.md'), 'utf8');
  assert.match(skill, /scripts\/project-settings\.mjs/);
  assert.match(skill, /--user/);
  assert.match(skill, /\.claude\/settings\.json/);
  assert.doesNotMatch(skill, /\/plugin install/);
  for (const line of skill.split('\n').filter((l) => /install-schemas\.sh/.test(l) && /bash /.test(l))) {
    assert.match(line, /install-schemas\.sh (<project-root>|--user)/, `install-schemas.sh call needs an argument: ${line}`);
  }
  const never = skill.slice(skill.indexOf('## Never'));
  assert.match(never, /user scope/);
  assert.match(never, /~\/\.claude/);
});

test('this repository opts in through .claude/settings.json (2.5, ADR 0004)', () => {
  const root = join(here, '..', '..', '..');
  const file = join(root, '.claude', 'settings.json');
  assert.ok(existsSync(file), '.claude/settings.json exists');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(s.extraKnownMarketplaces.devkit.source, { source: 'github', repo: 'chacal88/devkit' });
  assert.equal(s.enabledPlugins['devkit-core@devkit'], true);
  assert.equal(s.enabledPlugins['devkit-openspec@devkit'], true);
  const script = join(root, 'plugins', 'openspec', 'skills', 'openspec-setup', 'scripts', 'project-settings.mjs');
  const r = spawnSync('node', [script, root, '--dry-run'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /file: unchanged /);
});

// --- 3.1: the install-scope lint in scripts/check.py (D8) ---
const checkPy = join(here, '..', '..', '..', 'scripts', 'check.py');

function lintRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'devkit-lint-'));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  return root;
}

function lint(files) {
  const r = spawnSync('python3', [checkPy, '--root', lintRoot(files)], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('install-scope lint: a user-scope install passes only in the migration doc', () => {
  const line = 'claude plugin install devkit-core@devkit --scope user\n';
  assert.equal(lint({ 'docs/migrate-to-project-scope.md': line }).code, 0);
  const r = lint({ 'README.md': line });
  assert.equal(r.code, 1);
  assert.match(r.out, /README\.md:1: plugin install must use --scope project/);
});

test('install-scope lint: the migration doc itself needs --scope user', () => {
  const r = lint({ 'docs/migrate-to-project-scope.md': 'claude plugin install devkit-core@devkit --scope project\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /docs\/migrate-to-project-scope\.md:1:/);
});

test('install-scope lint: /plugin install and no scope fail, --scope project passes, fenced blocks count', () => {
  assert.equal(lint({ 'README.md': 'text\n\n```text\n/plugin install devkit-core@devkit\n```\n' }).code, 1);
  assert.match(lint({ 'README.md': 'a\nb\n```bash\nclaude plugin install devkit-core@devkit\n```\n' }).out, /README\.md:4:/);
  assert.equal(lint({ 'README.md': 'claude plugin install devkit-core@devkit --scope project\n' }).code, 0);
  assert.equal(lint({ 'README.md': 'claude plugin install devkit-core@devkit --scope local\n' }).code, 1);
});

test('install-scope lint: change folders, worktrees, generated skills and commands are ignored', () => {
  const bad = '/plugin install devkit-core@devkit\n';
  const r = lint({
    'openspec/changes/x/notes.md': bad,
    '.claude/worktrees/w/README.md': bad,
    '.claude/skills/s/SKILL.md': bad,
    '.claude/commands/c/cmd.md': bad,
  });
  assert.equal(r.code, 0, r.out);
});

test('changelog lint: the marketplace version needs a "## <version>" heading in CHANGELOG.md', () => {
  const market = JSON.stringify({ metadata: { version: '1.2.3' }, plugins: [] });
  const r = lint({ '.claude-plugin/marketplace.json': market, 'CHANGELOG.md': '# Changelog\n\n## 1.2.2\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /CHANGELOG\.md: no "## 1\.2\.3" entry for marketplace version 1\.2\.3/);
  const ok = lint({ '.claude-plugin/marketplace.json': market, 'CHANGELOG.md': '# Changelog\n\n## 1.2.3 \u2014 x\n' });
  assert.equal(ok.code, 0, ok.out);
});

// --- 3.1 docs: why per project, and the link to the migration doc ---
test('README and getting-started say the packs load only in the projects that chose them and link the migration doc (3.1)', () => {
  const root = join(here, '..', '..', '..');
  for (const f of [['README.md'], ['docs', 'getting-started.md']]) {
    const body = readFileSync(join(root, ...f), 'utf8');
    assert.match(body, /only in the projects that (chose|opted in to) (them|it)|load only in the projects that chose them/, `${f.join('/')} says why per project`);
    assert.match(body, /migrate-to-project-scope\.md/, `${f.join('/')} links the migration doc`);
  }
});

// --- 3.3 / 3.4: docs/migrate-to-project-scope.md ---
const repoRoot = join(here, '..', '..', '..');
const migrationPath = join(repoRoot, 'docs', 'migrate-to-project-scope.md');

function migrationItems(body) {
  const parts = body.split(/^(?=### \d+\. )/m).slice(1);
  return parts.map((p) => {
    const blocks = {};
    for (const label of ['Command', 'Check', 'Undo']) {
      const m = p.match(new RegExp(`\\*\\*${label}\\*\\*[^\\n]*\\n+\`\`\`bash\\n([\\s\\S]*?)\`\`\``));
      blocks[label] = m ? m[1] : null;
    }
    return { head: p.split('\n')[0], text: p, ...blocks };
  });
}

test('migration doc: rule, preconditions, four items with Command/Check/Undo (3.3)', () => {
  assert.ok(existsSync(migrationPath), 'docs/migrate-to-project-scope.md exists');
  const body = readFileSync(migrationPath, 'utf8');
  assert.match(body, /only after the owner says yes to that item/);
  assert.match(body, /an agent never runs one on its own/);
  assert.match(body, /0\.7\.0/);
  assert.match(body, /git -C ~\/Documents\/devkit pull/);
  assert.match(body, /\.claude\/settings\.json/);
  const items = migrationItems(body);
  assert.equal(items.length, 4, 'four numbered item headings');
  items.forEach((it, i) => {
    assert.match(it.head, new RegExp(`^### ${i + 1}\\. `));
    for (const label of ['Command', 'Check', 'Undo']) assert.ok(it[label], `item ${i + 1} has a bash block under **${label}**`);
  });
  assert.match(items[0].Command, /claude plugin uninstall devkit-core@devkit --scope user/);
  assert.match(items[0].Command, /claude plugin uninstall devkit-openspec@devkit --scope user/);
  // Item 2 as run on the owner's machine: `--scope user` fails for a marketplace added with /plugin, so it runs
  // without --scope from a new empty folder, and it says it also removes the install records (item 4).
  assert.match(items[1].Command, /mktemp -d\) && cd "\$d" && claude plugin marketplace remove devkit\s*$/);
  assert.match(items[1].text, /not declared in user settings/);
  assert.match(items[1].text, /Without `--scope`/);
  assert.match(items[1].text, /already does item 4/);
  assert.match(items[3].text, /Skip this item if item 2 ran/);
  assert.match(body, /claude plugin update devkit-core@devkit --scope user/);
  assert.match(body, /claude plugin update devkit-openspec@devkit --scope user/);
  assert.match(items[2].text, /~\/Documents\/recruit\/\.claude\/settings\.local\.json/);
  assert.match(items[2].text, /backup/i);
  assert.match(items[3].text, /installed_plugins\.json/);
  assert.match(items[3].text, /no Claude Code session open/);
  assert.match(items[3].text, /backup/i);
  const lines = body.split('\n');
  for (const l of lines.filter((x) => /claude plugin (uninstall|update)/.test(x))) assert.match(l, /--scope/, `scope on: ${l}`);
  // A marketplace remove either names its scope or runs from a new empty folder (item 2).
  for (const l of lines.filter((x) => /claude plugin marketplace remove/.test(x))) assert.match(l, /--scope|mktemp -d\) && cd "\$d"/, `scope or empty folder on: ${l}`);
  for (const l of lines.filter((x) => /claude plugin install/.test(x))) assert.match(l, /--scope user/, `install scope on: ${l}`);
  assert.match(body, /## Final check/);
  assert.match(body, /claude plugin list/);
  assert.match(body, /~\/Documents\/projects\/margi/);
});

test('migration doc: it passes the install-scope lint (3.3)', () => {
  const r = spawnSync('python3', [checkPy], { encoding: 'utf8' });
  assert.doesNotMatch(r.stdout, /migrate-to-project-scope\.md:\d+: plugin install/);
});

test('migration doc: every fenced bash block parses, and the jq filters work on fixtures (3.4)', () => {
  const body = readFileSync(migrationPath, 'utf8');
  const blocks = [...body.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 13, `expected the preconditions, 4x3 item blocks and the final check, got ${blocks.length}`);
  for (const b of blocks) {
    const r = spawnSync('bash', ['-n'], { input: b, encoding: 'utf8' });
    assert.equal(r.status, 0, `bash -n failed: ${r.stderr}\n${b}`);
  }

  // Fixtures live in a temp HOME; `claude plugin list --json` is replaced by a file, every other `claude` is a failing stub.
  const home = mkdtempSync(join(tmpdir(), 'devkit-migrate-home-'));
  const bin = join(home, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\necho "claude must not run" >&2\nexit 99\n', { mode: 0o755 });
  const listFile = join(home, 'list.json');
  const rd = join(home, 'Documents', 'representante-digital');
  const list = (rows) => writeFileSync(listFile, JSON.stringify(rows));
  const put2 = (rel, obj) => {
    mkdirSync(dirname(join(home, rel)), { recursive: true });
    writeFileSync(join(home, rel), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  };
  const run = (script, extra = {}) => spawnSync('bash', ['-c', script.replaceAll('claude plugin list --json', `cat ${listFile}`)], {
    encoding: 'utf8', cwd: home, env: { PATH: `${bin}:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin`, HOME: home, ...extra },
  });
  const items = migrationItems(body);

  // preconditions: the version filter
  list([{ id: 'devkit-openspec@devkit', scope: 'user', version: '0.7.0' }, { id: 'devkit-core@devkit', scope: 'user', version: '0.5.1' }]);
  const pre = body.match(/## Preconditions[\s\S]*?```bash\n([\s\S]*?)```/)[1];
  const preLines = pre.split('\n').filter((l) => /claude plugin list --json/.test(l));
  assert.equal(preLines.length, 1);
  assert.equal(run(preLines[0]).stdout.trim(), '0.7.0');

  // item 1 check
  list([{ id: 'devkit-core@devkit', scope: 'project', projectPath: '/x' }, { id: 'other@x', scope: 'user' }]);
  put2('.claude/settings.json', { enabledPlugins: { 'other@x': true } });
  let r = run(items[0].Check);
  assert.deepEqual(r.stdout.trim().split('\n'), ['0', '[]'], r.stderr);
  list([{ id: 'devkit-core@devkit', scope: 'user' }]);
  put2('.claude/settings.json', { enabledPlugins: { 'devkit-core@devkit': true } });
  r = run(items[0].Check);
  assert.deepEqual(r.stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean).join(''), '1["devkit-core@devkit"]');

  // item 2 check
  put2('.claude/plugins/known_marketplaces.json', { other: {} });
  assert.equal(run(items[1].Check).stdout.trim(), 'false');
  put2('.claude/plugins/known_marketplaces.json', { devkit: {} });
  assert.equal(run(items[1].Check).stdout.trim(), 'true');

  // item 3: command, check, undo against recruit's settings.local.json fixture (backup first)
  const local = join(home, 'Documents', 'recruit', '.claude', 'settings.local.json');
  const original = { permissions: { allow: ['Bash(ls)'] }, enabledPlugins: { 'devkit-openspec@devkit': false, 'other@x': true } };
  put2('Documents/recruit/.claude/settings.local.json', original);
  r = run(items[2].Command);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(local, 'utf8')), { permissions: original.permissions, enabledPlugins: { 'other@x': true } });
  assert.equal(run(items[2].Check).stdout.split('\n')[0].trim(), 'false');
  assert.ok(existsSync(`${local}.bak-devkit-opt-in`));
  r = run(items[2].Undo);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(local, 'utf8')), original);
  // an enabledPlugins that becomes empty is dropped
  put2('Documents/recruit/.claude/settings.local.json', { enabledPlugins: { 'devkit-openspec@devkit': false } });
  run(items[2].Command);
  assert.deepEqual(JSON.parse(readFileSync(local, 'utf8')), {});
  assert.equal(run(items[2].Check).stdout.split('\n')[0].trim(), 'false');

  // item 4: command and undo against an installed_plugins.json fixture
  const reg = join(home, '.claude', 'plugins', 'installed_plugins.json');
  const registry = {
    version: 2,
    plugins: {
      'devkit-core@devkit': [
        { scope: 'user' },
        { scope: 'project', projectPath: `${rd}` },
        { scope: 'project', projectPath: `${rd}/.claude/worktrees/a` },
        { scope: 'project', projectPath: `${rd}/.claude/worktrees/b` },
      ],
      'other@x': [{ scope: 'project', projectPath: `${rd}/.claude/worktrees/a` }],
    },
  };
  put2('.claude/plugins/installed_plugins.json', registry);
  r = run(items[3].Command);
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(readFileSync(reg, 'utf8'));
  assert.deepEqual(after.plugins['devkit-core@devkit'], [{ scope: 'user' }, { scope: 'project', projectPath: rd }]);
  assert.deepEqual(after.plugins['other@x'], registry.plugins['other@x'], 'other packs untouched');
  r = run(items[3].Undo);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(reg, 'utf8')), registry);
  // item 4 check: counts only worktree entries of representante-digital
  list([{ id: 'devkit-core@devkit', scope: 'project', projectPath: `${rd}/.claude/worktrees/a` }, { id: 'devkit-core@devkit', scope: 'project', projectPath: rd }]);
  assert.equal(run(items[3].Check).stdout.trim().split('\n')[0], '1');
  list([{ id: 'devkit-core@devkit', scope: 'project', projectPath: rd }]);
  assert.equal(run(items[3].Check).stdout.trim().split('\n')[0], '0');

  // final check: the margi loop reads each file on its own
  const margi = join(home, 'Documents', 'projects', 'margi');
  mkdirSync(join(margi, '.claude'), { recursive: true });
  const fin = body.slice(body.indexOf('## Final check'));
  const finBlocks = [...fin.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  const loop = finBlocks.find((b) => /enabledPlugins/.test(b));
  assert.ok(loop, 'final check has the margi loop');
  put2('.claude/settings.json', { enabledPlugins: { 'other@x': true } });
  r = spawnSync('bash', ['-c', loop], { encoding: 'utf8', cwd: margi, env: { PATH: `${bin}:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin`, HOME: home } });
  assert.equal(r.stdout.trim(), '', r.stderr);
  writeFileSync(join(margi, '.claude', 'settings.local.json'), JSON.stringify({ enabledPlugins: { 'devkit-openspec@devkit': true } }));
  r = spawnSync('bash', ['-c', loop], { encoding: 'utf8', cwd: margi, env: { PATH: `${bin}:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin`, HOME: home } });
  assert.equal(r.stdout.trim(), 'devkit-openspec@devkit');
});

// --- migration items 3 and 4 are safe to run twice: first backup kept, write through a temp file ---

test('migration items 3 and 4 keep the first backup (cp -n) and write through a temp file then mv', () => {
  const items = migrationItems(readFileSync(migrationPath, 'utf8'));
  for (const n of [3, 4]) {
    const item = items.find((i) => i.head.startsWith(`### ${n}.`));
    assert.ok(item, `item ${n} exists`);
    assert.match(item.Command, /cp -n "\$[fr]" "\$[fr]\.bak-devkit-opt-in"/, `item ${n} keeps the first backup`);
    assert.doesNotMatch(item.Command, /cp "\$/, `item ${n} never overwrites the backup`);
    assert.match(item.Command, /> "\$[fr]\.tmp" && mv "\$[fr]\.tmp" "\$[fr]"/, `item ${n} writes through a temp file then mv`);
    assert.doesNotMatch(item.Command, /> "\$[fr]"\s*$/m, `item ${n} never writes the target directly`);
    assert.ok(item.Undo, `item ${n} keeps its Undo`);
  }
});

// ---------------------------------------------------------------- worktrees (conduct-rounds D5)

// The main checkout is on `main` with no open change; `.claude/worktrees/feat`
// is a real linked worktree on branch `feat` holding the devkit change `feat`.
function worktreeRepo({ readiness = '- Status: NEEDS-REVISION\n', config = 'schema: devkit\n' } = {}) {
  const main = gitRepo({ config });
  const wt = join(main, '.claude', 'worktrees', 'feat');
  gitIn(main, 'worktree', 'add', '-q', wt, '-b', 'feat');
  put(wt, { 'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/feat/readiness.md': readiness });
  return { main, wt };
}
const editAt = (cwd, file, a) => run('edit', { cwd, tool_name: 'Write', tool_input: { file_path: file }, ...agent(a) });
const bashAt = (cwd, command, a) => run('bash', { cwd, tool_name: 'Bash', tool_input: { command }, ...agent(a) });

test('commandSegments: yields text and dir per segment, following cd; bashWrites output is unchanged', () => {
  assert.deepEqual(commandSegments('cd a && echo x > b.txt; ls\npwd', '/r'), [
    { text: 'echo x > b.txt', dir: '/r/a' }, { text: 'ls', dir: '/r/a' }, { text: 'pwd', dir: '/r/a' },
  ]);
  assert.deepEqual(commandSegments("echo 'a && b'", '/r').map((s) => s.dir), ['/r']);
  assert.deepEqual(commandSegments('ls').map((s) => s.dir), [undefined]);
  assert.deepEqual(bashWrites('cd /w && echo x > src/a.ts', '/main'), ['/w/src/a.ts']);
});

test('worktree: an Edit of a file in a worktree is gated by the worktree change, whatever the session cwd (D5)', () => {
  const { main, wt } = worktreeRepo();
  const r = editAt(main, join(wt, 'src', 'a.ts'), 'tdd-implementer');
  assert.equal(r.code, 2);
  assert.match(r.err, /Status: NEEDS-REVISION/);
  assert.equal(editAt(main, join(main, 'src', 'a.ts')).code, 0, 'a file in the main checkout, no open change: not gated');
  assert.equal(editAt(main, join(wt, 'openspec/changes/feat/tasks.md')).code, 0, 'planning files stay open');
  assert.equal(editAt(main, join(tmpdir(), 'devkit-elsewhere', 'a.ts')).code, 0, 'a file in no OpenSpec tree');
});

test('worktree: a shell write through cd <wt> is gated by the worktree change (D5)', () => {
  const { main, wt } = worktreeRepo();
  assert.equal(bashAt(main, `cd ${wt} && echo x > src/a.ts`, 'tdd-implementer').code, 2);
  assert.equal(bashAt(main, `echo x > ${wt}/src/a.ts`, 'tdd-implementer').code, 2);
  assert.equal(bashAt(main, `cd ${wt} && echo x > openspec/changes/feat/tasks.md`).code, 0);
  assert.equal(bashAt(main, 'echo x > src/a.ts').code, 0, 'the main checkout has no open change');
});

test('worktree: gh pr create after cd <wt> is checked against the worktree change (D5)', () => {
  const { main, wt } = worktreeRepo({ readiness: '- Status: APPROVED\n' });
  const r = bashAt(main, `cd ${wt} && gh pr create --title t --body b`);
  assert.equal(r.code, 2);
  assert.match(r.err, /review not approved/);
  assert.equal(bashAt(main, 'gh pr create --title t --body b').code, 0, 'no cd: the main checkout has no open change');
  assert.equal(bashAt(main, `gh pr create --title t --body b && cd ${wt}`).code, 0, 'a cd after the command does not move it');
});

test('worktree: with readiness APPROVED the tdd-implementer may edit and the main session may not (D5)', () => {
  const { main, wt } = worktreeRepo({ readiness: '- Status: APPROVED\n' });
  assert.equal(editAt(main, join(wt, 'src', 'a.ts'), 'tdd-implementer').code, 0);
  const r = editAt(main, join(wt, 'src', 'a.ts'));
  assert.equal(r.code, 2);
  assert.match(r.err, /tdd-implementer/);
  assert.equal(bashAt(main, `cd ${wt} && echo x > src/a.ts`).code, 2);
  assert.equal(bashAt(main, `cd ${wt} && echo x > src/a.ts`, 'tdd-implementer').code, 0);
  // a child session (conduct-sessions D4): its hook input cwd is the worktree itself
  const own = editAt(wt, join(wt, 'src', 'a.ts'));
  assert.equal(own.code, 2, 'a child with no agent_type is refused');
  assert.match(own.err, /tdd-implementer/);
  assert.equal(editAt(wt, join(wt, 'src', 'a.ts'), 'devkit-core:tdd-implementer').code, 0, 'the implementer it dispatches passes');
  assert.equal(bashAt(wt, 'echo x > src/a.ts').code, 2);
  assert.equal(bashAt(wt, 'echo x > src/a.ts', 'devkit-core:tdd-implementer').code, 0);
});

test('worktree: a devkit-lite change refuses nothing to a child session with no agent_type (conduct-sessions D4)', () => {
  const main = gitRepo({ config: 'schema: devkit-lite\n' });
  const wt = join(main, '.claude', 'worktrees', 'fix');
  gitIn(main, 'worktree', 'add', '-q', wt, '-b', 'fix');
  put(wt, { 'openspec/changes/fix/.openspec.yaml': 'schema: devkit-lite\nskip_specs: true\n' });
  assert.equal(editAt(wt, join(wt, 'src', 'a.ts')).code, 0);
  assert.equal(bashAt(wt, 'echo x > src/a.ts').code, 0);
});

test('worktree + opt-in: the opt-in check applies to each target root, not to the session cwd (D5, ADR 0004)', () => {
  const { main, wt } = worktreeRepo();
  assert.equal(editAt(main, join(wt, 'src', 'a.ts'), 'tdd-implementer').code, 2, 'opted-in project: its worktree is gated with cwd in the main checkout');
  assert.equal(bashAt(main, `cd ${wt} && echo x > src/a.ts`, 'tdd-implementer').code, 2);
  const out = worktreeRepo({ config: 'schema: spec-driven\n' });
  assert.equal(editAt(out.main, join(out.wt, 'src', 'a.ts'), 'tdd-implementer').code, 0, 'a root that is not opted in is not gated');
  assert.equal(bashAt(out.main, `cd ${out.wt} && echo x > src/a.ts`, 'tdd-implementer').code, 0);
  assert.equal(bashAt(out.main, `cd ${out.wt} && gh pr create --title t --body b`).code, 0);
  // a session in a project that is not opted in, writing into one that is
  assert.equal(editAt(out.main, join(wt, 'src', 'a.ts'), 'tdd-implementer').code, 2, 'the target root decides, not the session');
  assert.equal(bashAt(out.main, `cd ${wt} && echo x > src/a.ts`, 'tdd-implementer').code, 2);
});

// ---------------------------------------------------------------- approval.md (conduct-rounds D7)

test('approval.md: classify gives a gate with no agent owner', () => {
  assert.deepEqual(classify('/r', 'feat', '/r/openspec/changes/feat/approval.md'), { kind: 'gate', owner: '' });
});

test('approval.md: only the main session writes it, by Write and by shell redirect (D7)', () => {
  const root = repo({ changes: { feat: approved } });
  const f = 'openspec/changes/feat/approval.md';
  for (const a of ['change-planner', 'plan-readiness-reviewer', 'tdd-implementer']) {
    const r = edit(root, f, a);
    assert.equal(r.code, 2, a);
    assert.match(r.err, /approval\.md is written only by the main session, from the owner's own message; not by /);
    assert.match(r.err, new RegExp(`not by ${a}`));
    assert.equal(bash(root, `echo '- Status: APPROVED' > ${f}`, a).code, 2, `${a} by redirect`);
  }
  assert.equal(edit(root, f).code, 0, 'the main session');
  assert.equal(bash(root, `cat > ${f} <<'EOF'\n- Status: APPROVED\nEOF`).code, 0);
});

test('approval.md: main-session only even with several active changes or in another change folder (D7)', () => {
  const several = repo({ changes: { feat: approved, other: approved } }); // branch main: ambiguous
  const one = repo({ changes: { feat: approved, other: approved }, branch: 'feat' });
  for (const [root, f] of [[several, 'openspec/changes/feat/approval.md'], [one, 'openspec/changes/other/approval.md']]) {
    for (const a of ['change-planner', 'tdd-implementer']) {
      const r = edit(root, f, a);
      assert.equal(r.code, 2, `${a} by Write on ${f}`);
      assert.match(r.err, /approval\.md is written only by the main session/);
      assert.equal(bash(root, `echo '- Status: APPROVED' > ${f}`, a).code, 2, `${a} by redirect on ${f}`);
    }
    assert.equal(edit(root, f).code, 0, 'the main session by Write');
    assert.equal(bash(root, `echo ok > ${f}`).code, 0, 'the main session by redirect');
  }
});

test('gh pr create after cd to a directory with no project still meets the session root gate (D5)', () => {
  const root = repo({ changes: { feat: approved }, branch: 'feat' });
  const r = bash(root, 'cd /tmp && gh pr create --title t --body b');
  assert.equal(r.code, 2);
  assert.match(r.err, /review not approved/);
});

// ---------------------------------------------------------------- roadmap text and notes (conduct-rounds D3)

test('readRoadmap keeps the description as text and the indented lines as notes', () => {
  const root = repo({ roadmap: '## R\n- [ ] a — docs: x\n- [ ] b (after: a) — y\n- [x] c - dash text\n- [ ] d: colon text\n  first note\n    second note\n- [ ] e\n\n  late note\n## S\n- [ ] f\n  of f\n' });
  const [r, s] = readRoadmap(root);
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.equal(by.a.text, 'docs: x');
  assert.equal(by.b.text, 'y');
  assert.deepEqual(by.b.after, ['a']);
  assert.equal(by.c.text, 'dash text');
  assert.equal(by.d.text, 'colon text');
  assert.equal(by.d.notes, 'first note\n  second note');
  assert.equal(by.e.text, '', 'no description');
  assert.equal(by.e.notes, 'late note', 'a blank line does not end the notes');
  assert.equal(by.a.notes, '');
  assert.equal(s.items[0].notes, 'of f', 'notes stop at the next heading');
});

// ---------------------------------------------------------------- ship-change: the recorded approval (conduct-rounds D7)

test('ship-change SKILL.md pins the stop-plan-approval row: only the owner\'s own message writes approval.md', () => {
  const md = readFileSync(join(here, '..', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const row = md.split('\n').find((l) => l.startsWith('| `stop-plan-approval`')) ?? '';
  assert.ok(row, 'a table row for stop-plan-approval');
  assert.match(row, /only when the owner's own message approves/i);
  assert.match(row, /approval\.md/);
  assert.match(row, /next\.readiness/);
  assert.match(md, /waiting for the owner's plan approval/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Write `approval\.md` except from the owner's own message/);
  assert.match(md.slice(0, md.indexOf('## Loop')), /approval\.md/, 'the go-ahead names the recorded approval');
});

// ---------------------------------------------------------------- the conduct skill (conduct-rounds D14)

const conductMd = () => readFileSync(join(here, '..', 'skills', 'conduct', 'SKILL.md'), 'utf8');

test('conduct SKILL.md: at most three steps at once, the worktree preamble, never a subagent for a whole change', () => {
  const md = conductMd();
  assert.match(md, /at most three/);
  assert.ok(md.includes('Work only in `<worktree>` on branch `<branch>`; every file path is absolute under it; start every Bash command with `cd <worktree> && `; do not fetch.'));
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Dispatch a subagent for a whole change/);
  assert.match(never, /Create a conduct cron/);
  assert.doesNotMatch(never, /Create a second conduct cron/);
  assert.match(never, /Run a phase as a subagent in the app host/);
  assert.match(never, /Start a session from a step other than `implement`/);
  assert.match(never, /Start a session from a turn the owner did not type, except the continuation of a child's end/);
  assert.doesNotMatch(never, /Start or drive another session/);
});

test('conduct SKILL.md: the cron migration rule, and no cron is ever created (D7, AC-8)', () => {
  const md = conductMd();
  assert.doesNotMatch(md, /\| (true|false) \|/, 'the reconciliation table is gone');
  assert.match(md, /`CronList`/);
  assert.match(md, /delete every job whose prompt starts with `\/conduct`/);
  assert.match(md, /never create one/);
  assert.doesNotMatch(md, /CronCreate|every 20 minutes|`--wake`|--wake|wake\.cron|wake-up cron/);
  const desc = md.split('\n').find((l) => l.startsWith('description:'));
  assert.doesNotMatch(desc, /cron|wake-up/);
  assert.match(desc, /\bUse when\b/);
});

test('conduct SKILL.md: approval.md and retro answers only from the owner\'s own message', () => {
  const md = conductMd();
  assert.match(md, /Plan approval and retro answers are written only from the owner's own message/);
  assert.match(md, /Write `approval\.md` or a retro answer except from the owner's own message/);
  assert.doesNotMatch(md, /cron-started run/);
  assert.match(md, /The owner's typed `\/conduct` is the only go-ahead/);
  assert.match(md, /a continuation turn advances what is under way and may start the next session of a change under way/i);
  assert.match(md, /an `approval\.md` recording the current readiness/);
  assert.match(md, /never writes `approval\.md` or a retro answer/);
  assert.match(md, /An Auto-fix wake or any other turn the owner did not type runs GitHub-side steps only and starts no session/);
  assert.match(md, /a schema, grill, approval or retro gate reached by a turn the owner did not type is asked and left for the owner/i);
  assert.match(md, /by the message that started the turn, never by a flag in the prompt/);
});

test('conduct SKILL.md: the schema is asked for every new change before git worktree add, devkit-lite included; then /conduct is the go-ahead', () => {
  const md = conductMd();
  const create = md.split('\n').find((l) => l.startsWith('| `create`')) ?? '';
  assert.match(create, /for every new change, `devkit-lite` included/);
  assert.match(create, /Only after the answer run `git worktree add -b <id> <path> origin\/<base>`/);
  assert.ok(create.indexOf('Ask the owner') < create.indexOf('git worktree add'), 'the question comes first');
  assert.match(md, /After that answer, the owner invoking `\/conduct` is the go-ahead for every `devkit-lite` change/);
});

test('conduct SKILL.md: the report names the five states', () => {
  const rep = conductMd().split('## Report')[1].split('## Never')[0];
  for (const form of ['`archived`', '`waiting on <ids>`', '`waiting for the owner: <what>`', '`waiting on GitHub: <what>`', '`blocked: <why>`']) {
    assert.ok(rep.includes(form), form);
  }
  assert.doesNotMatch(rep, /wake-up:/);
  assert.match(rep, /Auto-fix wakes this session on a CI failure, a merge conflict or a review comment; green checks do not wake it: run `\/conduct` again to go on/);
  assert.match(rep, /not archived: <name> \(<why>\)/);
  assert.match(rep, /not grouped: <name> \(<why>\)/);
  assert.match(rep, /not bound: <url> \(<why>\)/);
  assert.match(rep, /sessions left to start/);
});

test('conduct SKILL.md: the GitHub wait is one capped watch, then Auto-fix; the PR is bound after open-pr (AC-9)', () => {
  const md = conductMd();
  assert.match(md, /one capped watch/);
  assert.match(md, /mcp__ccd_pr__get_status/);
  assert.match(md, /mcp__ccd_pr__bind_pr/);
  assert.ok(md.indexOf('`open-pr`') < md.indexOf('mcp__ccd_pr__bind_pr'), 'bound after open-pr');
  assert.match(md, /one PR bound per session/);
  assert.match(md, /the PR opened last/);
  const rep = md.split('## Report')[1].split('## Never')[0];
  assert.match(rep, /the PR opened last/, 'the report names the bound PR');
  assert.match(md, /waiting on GitHub: <what>/);
});

// ---------------------------------------------------------------- the conduct skill: child sessions (conduct-sessions D5, D6, D13)

test('conduct SKILL.md: the app starts one child session per session row, with the start fields (AC-3)', () => {
  const md = conductMd();
  assert.match(md, /mcp__ccd_session__start_session/);
  for (const f of ['initiation: "user_asked"', 'context: "fresh"', 'use_worktree: false', 'wake_when_done: true', '`session.brief`', '`session.background`', '`session.name`', '`session.title`', '`session.cwd`']) {
    assert.ok(md.includes(f), f);
  }
  assert.match(md, /`model`, `effort` and `permission_mode` are omitted/);
  assert.match(md, /In the app:/);
});

test('conduct SKILL.md: --busy comes from list_sessions by isRunning, isArchived and sessionPrefix (AC-7)', () => {
  const md = conductMd();
  assert.ok(md.includes('mcp__ccd_session_mgmt__list_sessions({ linked: true, limit: 100 })'));
  assert.match(md, /`isRunning`/);
  assert.match(md, /`isArchived`/);
  assert.match(md, /`sessionPrefix`/);
  assert.match(md, /followed by digits only/);
  assert.ok(md.includes('^<prefix>[0-9]+$'));
  assert.match(md, /never a bare starts-with/);
  assert.match(md, /recomputes once without `--busy`/);
  assert.match(md, /recomputes again with `--busy`/);
});

test('conduct SKILL.md: a refused start waits for the owner and never becomes a subagent (AC-6)', () => {
  const md = conductMd();
  assert.ok(md.includes('waiting for the owner: start session <id> phase <n>'));
  assert.match(md, /never a subagent in its place/);
  assert.match(md, /each is attempted once/);
  assert.match(md, /sessions left to start/);
});

test('conduct SKILL.md: a continuation turn reads Outcome, recomputes and starts the next session of a change under way (AC-5)', () => {
  const md = conductMd();
  assert.match(md, /`<side-sessions-event>`/);
  assert.match(md, /reads the child's `Outcome:` line/);
  assert.match(md, /the next phase of the same change starts with no message from the owner/);
  assert.match(md, /under way/);
  assert.match(md, /a ticked task in `tasks\.md`, or, in the `devkit` schema, an `approval\.md` that records the current readiness/);
  assert.match(md, /never from the app's list of sessions/);
  assert.ok(md.includes('blocked: phase <n>: <reason>'));
  assert.ok(md.includes('blocked: phase <n>: child ended without ticking tasks'));
});

test('conduct SKILL.md: the sidebar group, the archive and the one rule for a refused call (AC-8)', () => {
  const md = conductMd();
  assert.match(md, /mcp__ccd_sidebar__list_groups/);
  assert.match(md, /mcp__ccd_sidebar__create_group/);
  assert.match(md, /mcp__ccd_sidebar__move_sessions/);
  assert.match(md, /group named exactly `<id>`/);
  assert.match(md, /mcp__ccd_session_mgmt__archive_session/);
  assert.match(md, /gate task of the phase is ticked/);
  assert.match(md, /every idle linked session/);
  assert.ok(md.includes('whose `name` is `<sessionPrefix><n>`, where `n` is the phase whose gate task just ticked'), 'archive names the phase from the gate task');
  assert.ok(!md.includes("is that phase's `session.name`"), 'the old wording read a name a non-session row lacks');
  assert.ok(md.includes('phase <n> of <id>: gate green'));
  assert.match(md, /stopped phase is left unarchived/);
  for (const f of ['not archived: <name> (<why>)', 'not grouped: <name> (<why>)', 'not bound: <url> (<why>)']) assert.ok(md.includes(f), f);
  assert.match(md, /not retried in the run/);
  assert.match(md, /never a stop/);
  assert.match(md, /git worktree list/);
});

test('README and the pack README describe the session flow with no cron (2.5)', () => {
  const root = join(here, '..', '..', '..');
  const top = readFileSync(join(root, 'README.md'), 'utf8');
  const para = top.split('\n').find((l) => l.startsWith('For a roadmap round, `/conduct`')) ?? '';
  assert.match(para, /child session/);
  assert.match(para, /0006-phases-as-child-sessions\.md/);
  assert.doesNotMatch(para, /every 20 minutes|session cron/);
  const pack = readFileSync(join(root, 'plugins', 'openspec', 'README.md'), 'utf8');
  const rows = pack.split('\n').filter((l) => /conduct/.test(l) && l.startsWith('|'));
  assert.ok(rows.length >= 3);
  for (const r of rows) assert.doesNotMatch(r, /every 20 minutes|session cron|`wake`/);
  assert.match(pack.split('\n').find((l) => l.startsWith('| `conduct` skill')), /child session/);
  assert.match(pack.split('\n').find((l) => l.startsWith('| [`hooks/conduct-check.mjs`')), /`session`/);
});

// ---------------------------------------------------------------- ADR 0005 (conduct-rounds D13)

test('ADR 0006 supersedes ADR 0005, and ADR 0001 and the config point to it', () => {
  const root = join(here, '..', '..', '..');
  const n5 = '0005-parallel-steps-and-a-session-wake-up.md';
  const n6 = '0006-phases-as-child-sessions.md';
  const adr1 = readFileSync(join(root, 'docs', 'adr', '0001-coordination-without-a-harness.md'), 'utf8');
  assert.ok(adr1.includes(n6), 'ADR 0001 names ADR 0006');
  assert.match(adr1, /^## Decision$/m);
  const adr5 = readFileSync(join(root, 'docs', 'adr', n5), 'utf8');
  assert.match(adr5, /^- Status: superseded by ADR 0006/m);
  const adr6 = readFileSync(join(root, 'docs', 'adr', n6), 'utf8');
  assert.match(adr6, /^- Status: accepted$/m);
  for (const h of ['Decision', 'Consequences', 'Review trigger', 'Alternatives considered']) {
    assert.match(adr6, new RegExp(`^#+ ${h}$`, 'm'), `ADR 0006 has ${h}`);
  }
  const cfg = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
  assert.match(cfg, /0005 parallel steps/);
  assert.match(cfg, /0006 phases as child sessions/);
  const nums = readdirSync(join(root, 'docs', 'adr')).map((f) => f.slice(0, 4));
  assert.equal(new Set(nums).size, nums.length, 'no duplicate ADR number');
});
