// The guard's own tests. Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/guard.test.mjs`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, cpSync, symlinkSync, readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitViolation, readValue, resolveChange, sanitize, bashWrites, reviewConsensus, readRoadmap, findRoot, changeSchema, changeDir, archiveBranchChange, commandSegments, classify, DEVKIT_SCHEMAS, projectSchema, optedIn } from './guard.mjs';

import * as GUARD from './guard.mjs';
import { gitRepo, put, commitAll, git as gitIn, openspecStub } from './test-fixtures.mjs'; // ship-modes tests ride on the same command

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, 'guard.mjs');
const schemas = join(here, '..', 'schemas');

function repo({ changes = {}, branch = 'main', roadmap, archived = [] } = {}) {
  const root = tmpFolder('devkit-guard-');
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

const clean = { DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', COMPOZY_SESSION_ID: '' };
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

test('forced-merge-path 1: V1 valueIn reads a text as readValue reads the same file, and an empty text is null', () => {
  assert.equal(typeof GUARD.valueIn, 'function');
  const texts = {
    't.md': '- Status: APPROVED | NEEDS-REVISION | BLOCKED\n',
    'n.md': '- Status: NEEDS-REVISION\n',
    'b.md': '**Status:** APPROVED — high\n',
    'v.md': twoVerdicts('approved', 'rejected'),
    'none.md': '# Review\nno value here\n',
  };
  const root = repo({ changes: { a: texts } });
  for (const [name, text] of Object.entries(texts)) {
    for (const key of ['Status', 'Verdict']) {
      assert.equal(GUARD.valueIn(text, key), readValue(join(root, 'openspec/changes/a', name), key), `${name} ${key}`);
    }
  }
  assert.equal(GUARD.valueIn('', 'Verdict'), null);
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

test('AC-5 guards-kept: gh pr create is refused with evidence first and no reviews, and with approved reviews and no evidence (design D4)', () => {
  const evidenceFirst = repo({ changes: { feat: { ...approved, ...evidence } } });
  assert.match(bash(evidenceFirst, 'gh pr create --title x --body y').err, /review not approved/);
  const reviewsOnly = repo({ changes: { feat: { ...approved, ...goodReviews } } });
  assert.match(bash(reviewsOnly, 'gh pr create --title x --body y').err, /evidence\.md/);
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
  const dir = tmpFolder('devkit-plain-');
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
  const lone = join(tmpFolder('devkit-lone-'), 'guard.mjs');
  cpSync(guard, lone);
  const r = spawnSync('node', [lone, 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /devkit ci: guard\.mjs ci needs deliver-check\.mjs and merge-setup\.mjs in the same folder \(download all three; see docs\/openspec-flow\.md#ci\)/);
  const link = join(tmpFolder('devkit-cilink-'), 'guard.mjs');
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
  const link = join(tmpFolder('devkit-link-'), 'guard.mjs');
  symlinkSync(guard, link);
  const input = { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src/a.ts') } };
  const r = spawnSync('node', [link, 'edit'], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...clean } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /tdd-implementer/);
});

test('importing guard.mjs runs no mode: no exit, no output, even with DEVKIT_BYPASS=1 and argv ci', () => {
  const dir = tmpFolder('devkit-import-');
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
  const root = base || tmpFolder('devkit-optin-');
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
const noGitHere = () => tmpFolder('devkit-nogit-');
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
  const root = tmpFolder('devkit-lint-');
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

test('language lint: a pt-BR marker inside backticks or a fenced block is a quotation; outside them it is refused, with the line number kept', () => {
  assert.equal(lint({ 'docs/x.md': 'The pane says `n\u00e3o` here\n' }).code, 0);
  assert.equal(lint({ 'docs/x.md': 'text\n\n```text\nvoc\u00ea tamb\u00e9m\n```\n' }).code, 0);
  const r = lint({ 'docs/x.md': 'this is n\u00e3o English\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /docs\/x\.md:1: non-English text/);
  const after = lint({ 'docs/x.md': '```text\nvoc\u00ea\n```\nthis is n\u00e3o English\n' });
  assert.equal(after.code, 1);
  assert.match(after.out, /docs\/x\.md:4: non-English text/);
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
  const home = tmpFolder('devkit-migrate-home-');
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
  assert.equal(editAt(main, join(tmpRoot(), 'devkit-elsewhere', 'a.ts')).code, 0, 'a file in no OpenSpec tree');
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

// Invariant: in a CompozyOS session approval.md is written only by the kit's record step (compozy-driver D-11, coordination-locks).
// Layer: guard's writeViolation, through `guard edit` and `guard bash`. Suite: guard. The variable is the one a CompozyOS seat sees (probe P-1).
const COMPOZY_ENV = { COMPOZY_SESSION_ID: 'sess_probe' };
const COMPOZY_REASON = /in a CompozyOS session approval\.md is written only by the kit's record step, from the owner's answer/;

test('guard compozy approval: the Write tool of the main session is refused in a CompozyOS session', () => {
  const root = repo({ changes: { feat: approved } });
  const r = run('edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'openspec/changes/feat/approval.md') } }, COMPOZY_ENV);
  assert.equal(r.code, 2);
  assert.match(r.err, COMPOZY_REASON);
});

test('guard compozy approval: a Bash redirect of the main session is refused in a CompozyOS session', () => {
  const root = repo({ changes: { feat: approved } });
  const r = bash(root, "echo '- Status: APPROVED' > openspec/changes/feat/approval.md", undefined, COMPOZY_ENV);
  assert.equal(r.code, 2);
  assert.match(r.err, COMPOZY_REASON);
});

test('guard compozy approval: a subagent is refused in a CompozyOS session with the same reason', () => {
  const root = repo({ changes: { feat: approved } });
  const r = run('edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'openspec/changes/feat/approval.md') }, ...agent('tdd-implementer') }, COMPOZY_ENV);
  assert.equal(r.code, 2);
  assert.match(r.err, COMPOZY_REASON);
});

test('guard compozy approval: the main session outside a CompozyOS session still writes it', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'openspec/changes/feat/approval.md').code, 0);
  const blank = run('edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'openspec/changes/feat/approval.md') } }, { COMPOZY_SESSION_ID: '' });
  assert.equal(blank.code, 0, 'an empty variable is no CompozyOS session');
});

test('guard compozy approval: a subagent outside a CompozyOS session is refused with the reason of the main-session rule', () => {
  const root = repo({ changes: { feat: approved } });
  const r = edit(root, 'openspec/changes/feat/approval.md', 'tdd-implementer');
  assert.equal(r.code, 2);
  assert.match(r.err, /approval\.md is written only by the main session, from the owner's own message; not by tdd-implementer/);
  assert.doesNotMatch(r.err, /CompozyOS/);
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

test('README and the pack README describe how one change runs, with no cron', () => {
  const root = join(here, '..', '..', '..');
  const top = readFileSync(join(root, 'README.md'), 'utf8');
  const para = top.split('\n').find((l) => l.startsWith('`/devkit change`')) ?? '';
  assert.ok(para, 'a paragraph that starts with /devkit change');
  assert.match(para, /0010-openspec-as-the-harness\.md/);
  assert.match(para, /worktree/);
  assert.doesNotMatch(para, /every 20 minutes|session cron|\bcron\b/);
  const pack = readFileSync(join(root, 'plugins', 'openspec', 'README.md'), 'utf8');
  const rows = pack.split('\n').filter((l) => /conduct-check/.test(l) && l.startsWith('|'));
  assert.ok(rows.length >= 1);
  for (const r of rows) assert.doesNotMatch(r, /every 20 minutes|session cron|`wake`/);
  const skill = pack.split('\n').find((l) => l.startsWith('| `devkit` skill'));
  assert.ok(skill, 'a devkit skill row');
  assert.match(skill, /docs\/openspec-flow\.md#the-change-coordinator-devkit-change/);
  const check = pack.split('\n').find((l) => l.startsWith('| [`hooks/conduct-check.mjs`'));
  assert.match(check, /`session`/);
  assert.match(check, /--change/);
  assert.match(check, /`unfinished`/);
});

test('ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the config names it', () => {
  const root = join(here, '..', '..', '..');
  const dir = join(root, 'docs', 'adr');
  const file = join(dir, '0010-openspec-as-the-harness.md');
  assert.ok(existsSync(file), 'ADR 0010 file');
  const adr10 = readFileSync(file, 'utf8');
  assert.match(adr10, /^- Status: accepted$/m);
  for (const h of ['Decision', 'Consequences', 'Review trigger', 'Alternatives considered']) {
    assert.match(adr10, new RegExp(`^#+ ${h}$`, 'm'), `ADR 0010 has ${h}`);
  }
  for (const f of ['0001-coordination-without-a-harness.md', '0007-one-change-on-request.md']) {
    assert.match(readFileSync(join(dir, f), 'utf8'), /^- Status: superseded by ADR 0010/m, `${f} is superseded by ADR 0010`);
  }
  const cfg = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
  const adrs = cfg.split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0010/, 'the ADRs line names 0010');
});

test('config.yaml rules: no list item is an unquoted string holding ": " (YAML would read a mapping)', () => {
  const root = join(here, '..', '..', '..');
  const lines = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8').split('\n');
  const start = lines.findIndex((l) => /^rules:\s*$/.test(l));
  assert.ok(start >= 0, 'config.yaml has a rules: block');
  let items = 0;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) break; // next top-level key ends the block
    const m = /^\s+-\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    items++;
    const text = m[1].trim();
    if (/^["']/.test(text)) continue; // quoted: always a string
    assert.ok(!/:(\s|$)/.test(text), `line ${i + 1} is unquoted and holds ": ", YAML reads it as a mapping: ${text}`);
  }
  assert.ok(items > 0, 'rules: has list items');
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
  assert.match(cfg, /0007 one change on request/);
  const adr7 = readFileSync(join(root, 'docs', 'adr', '0007-one-change-on-request.md'), 'utf8');
  for (const h of ['Decision', 'Consequences', 'Review trigger', 'Alternatives considered']) {
    assert.match(adr7, new RegExp(`^#+ ${h}$`, 'm'), `ADR 0007 has ${h}`);
  }
  assert.match(adr6, /^- Amended by ADR 0007 \(0007-one-change-on-request\.md\)/m);
  const nums = readdirSync(join(root, 'docs', 'adr')).map((f) => f.slice(0, 4));
  assert.equal(new Set(nums).size, nums.length, 'no duplicate ADR number');
});

test('ADR 0008 records the reviewer round as a Workflow script; ADR 0001 and the config point to it', () => {
  const root = join(here, '..', '..', '..');
  const n8 = '0008-reviews-as-a-workflow.md';
  const adr1 = readFileSync(join(root, 'docs', 'adr', '0001-coordination-without-a-harness.md'), 'utf8');
  assert.ok(adr1.includes(n8), 'ADR 0001 names ADR 0008');
  const adr8 = readFileSync(join(root, 'docs', 'adr', n8), 'utf8');
  assert.match(adr8, /^- Status: accepted$/m);
  for (const h of ['Decision', 'Consequences', 'Review trigger', 'Alternatives considered']) {
    assert.match(adr8, new RegExp(`^#+ ${h}$`, 'm'), `ADR 0008 has ${h}`);
  }
  const cfg = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
  assert.match(cfg, /0008 reviews as a workflow/);
  const nums = readdirSync(join(root, 'docs', 'adr')).map((f) => f.slice(0, 4));
  assert.equal(new Set(nums).size, nums.length, 'no duplicate ADR number');
});

// ---- a test fixture never depends on the branch variables of the machine that runs it

const BLANKS_BRANCH = /DEVKIT_BRANCH:\s*(''|"")/;
const BLANKS_HEAD_REF = /GITHUB_HEAD_REF:\s*(''|"")/;

// The lines of a test file that blank DEVKIT_BRANCH without blanking GITHUB_HEAD_REF, directly or by
// spreading a constant of the same file that holds both.
function branchBlankedAlone(text) {
  const lines = text.split('\n');
  const safeSets = new Set();
  for (const line of lines) {
    const def = /^\s*(?:export\s+)?const\s+(\w+)\s*=/.exec(line);
    if (def && BLANKS_BRANCH.test(line) && BLANKS_HEAD_REF.test(line)) safeSets.add(def[1]);
  }
  const bad = [];
  lines.forEach((line, i) => {
    if (!BLANKS_BRANCH.test(line) || BLANKS_HEAD_REF.test(line)) return;
    const spread = [...line.matchAll(/\.\.\.(\w+)/g)].some((m) => safeSets.has(m[1]));
    if (!spread) bad.push(i + 1);
  });
  return bad;
}

function testFilesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules') return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? testFilesUnder(p) : e.name.endsWith('.test.mjs') || e.name.endsWith('-fixtures.mjs') ? [p] : [];
  });
}

test('no test env blanks DEVKIT_BRANCH without also blanking GITHUB_HEAD_REF', () => {
  const alone = ['const env = { ...base, DEVKIT_BRANCH', ": '' };"].join('');
  const both = ['const env = { ...base, DEVKIT_BRANCH', ": '', GITHUB_HEAD_REF: '' };"].join('');
  const set = ['const SET = { DEVKIT_BRANCH', ": '', GITHUB_HEAD_REF: '' };\nconst env = { ...SET };"].join('');
  assert.deepEqual(branchBlankedAlone(alone), [1], 'a line that blanks DEVKIT_BRANCH alone is refused');
  assert.deepEqual(branchBlankedAlone(both), [], 'both blanked on the line is accepted');
  assert.deepEqual(branchBlankedAlone(set), [], 'a spread of a set that holds both is accepted');
  const plugins = join(here, '..', '..');
  const offenders = testFilesUnder(plugins).flatMap((f) => branchBlankedAlone(readFileSync(f, 'utf8')).map((n) => `${f.slice(plugins.length + 1)}:${n}`));
  assert.deepEqual(offenders, [], 'blank GITHUB_HEAD_REF next to DEVKIT_BRANCH (CONTRIBUTING.md, testing rules)');
});

test('suite-speed AC-3 the branch-blank scan reads test-fixtures.mjs and every *-fixtures.mjs', () => {
  const root = tmpFolder('devkit-branch-scan-');
  mkdirSync(join(root, 'x'), { recursive: true });
  const fixtures = join(root, 'x', 'test-fixtures.mjs');
  const split = join(root, 'x', 'x-fixtures.mjs');
  writeFileSync(fixtures, ['export const env = { ...base, DEVKIT_BRANCH', ": '' };\n"].join(''));
  writeFileSync(split, ['export const env = { ...base, DEVKIT_BRANCH', ": '' };\n"].join(''));
  writeFileSync(join(root, 'x', 'notes.mjs'), ['const env = { ...base, DEVKIT_BRANCH', ": '' };\n"].join(''));
  const found = testFilesUnder(root).sort();
  assert.deepEqual(found, [fixtures, split].sort(), 'both fixtures modules are scanned, another .mjs file is not');
  assert.deepEqual(branchBlankedAlone(readFileSync(fixtures, 'utf8')), [1], 'its offending line is found');
  assert.deepEqual(branchBlankedAlone(readFileSync(split, 'utf8')), [1], 'the offending line of the split module is found');
});

// ---------------------------------------------------------------- field-fixes 6: the project's OpenSpec CLI (D-1)

const SEEN = (marker) => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');
const pinnedBin = (root) => join(root, 'node_modules', '.bin', 'openspec');
function cliWorld(version = '2.0.0') {
  const root = repo({ changes: { x: lite } });
  const marker = join(root, 'seen.log');
  const pathDir = openspecStub(tmpFolder('devkit-cli-path-'), { version: '2.1.0', label: 'path', marker });
  const env = { PATH: `${pathDir}:${process.env.PATH}` };
  const pin = (v = version) => openspecStub(join(root, 'node_modules', '.bin'), { version: v, label: 'pinned', marker });
  return { root, marker, env, pin };
}

test('field-fixes 6 cli: a checkout\'s node_modules/.bin/openspec wins over the one on PATH', () => {
  const w = cliWorld();
  w.pin();
  assert.deepEqual(GUARD.openspecCli(w.root), { bin: pinnedBin(w.root), where: pinnedBin(w.root), pinned: true });
});

test('field-fixes 6 cli: a worktree with none finds the main checkout\'s', () => {
  const main = gitRepo();
  const wt = join(tmpFolder('devkit-cli-wt-'), 'wt');
  gitIn(main, 'worktree', 'add', '-q', '-b', 'wt', wt);
  assert.equal(GUARD.openspecCli(wt).pinned, false, 'no pin anywhere: PATH');
  openspecStub(join(main, 'node_modules', '.bin'), { version: '2.0.0', label: 'pinned', marker: join(main, 'seen.log') });
  const want = pinnedBin(realpathSync(main));
  assert.deepEqual(GUARD.openspecCli(wt), { bin: want, where: want, pinned: true });
});

test('field-fixes 6 cli: a package.json declaring the pin with nothing installed is an error naming the file, the range and the install', () => {
  const w = cliWorld();
  writeFileSync(join(w.root, 'package.json'), JSON.stringify({ devDependencies: { '@fission-ai/openspec': '^2.0.0' } }));
  const r = GUARD.openspecCli(w.root);
  assert.equal(r.bin, undefined);
  assert.ok(r.error.includes(`pins @fission-ai/openspec ^2.0.0 in ${join(w.root, 'package.json')}`), r.error);
  assert.match(r.error, /not installed; run the project install/);
});

test('field-fixes 6 cli: no pin gives the openspec on PATH', () => {
  const w = cliWorld();
  writeFileSync(join(w.root, 'package.json'), JSON.stringify({ dependencies: { left: '1' } }));
  assert.deepEqual(GUARD.openspecCli(w.root), { bin: 'openspec', where: 'PATH', pinned: false });
});

test('field-fixes 6 cli: the session text runs the pinned CLI, never the one on PATH', () => {
  const w = cliWorld();
  w.pin('2.0.0');
  const { out } = session(w.root, w.env);
  assert.match(out, /Active OpenSpec change: x/);
  assert.match(SEEN(w.marker), /^pinned status --change x/m);
  assert.doesNotMatch(SEEN(w.marker), /^path /m);
});

test('field-fixes 6 cli: the session text over a pinned 1.16.0 is one line naming the version, the path and the move to 2.x', () => {
  const w = cliWorld();
  w.pin('1.16.0');
  const { code, out } = session(w.root, w.env);
  assert.equal(code, 0);
  assert.match(out, /^\[devkit\] [^\n]*\n$/);
  assert.match(out, /1\.16\.0/);
  assert.ok(out.includes(pinnedBin(w.root)), out);
  assert.match(out, /2\.x/);
  assert.equal(SEEN(w.marker), '', 'no openspec status was run, by either CLI');
});

test('field-fixes 6 cli: the session text over a declared, uninstalled pin is one line naming the install and starts no openspec', () => {
  const w = cliWorld();
  writeFileSync(join(w.root, 'package.json'), JSON.stringify({ devDependencies: { '@fission-ai/openspec': '^2.0.0' } }));
  const { code, out } = session(w.root, w.env);
  assert.equal(code, 0);
  assert.match(out, /^\[devkit\] [^\n]*\n$/);
  assert.match(out, /package\.json/);
  assert.match(out, /install/);
  assert.equal(SEEN(w.marker), '', 'no openspec was started');
});

// ---------------------------------------------------------------- field-fixes 12: the roadmap line (AC-12)
test('field-fixes 12 roadmap: the round 17b line is read before round 18', () => {
  const rounds = readRoadmap(join(here, '..', '..', '..'));
  const titles = rounds.map((r) => r.title);
  const at17b = titles.indexOf('Round 17b: field fixes of 0.16.0');
  assert.ok(at17b >= 0, `no round 17b in ${titles.join(' | ')}`);
  assert.ok(titles.findIndex((t) => t.startsWith('Round 17:')) < at17b, 'after round 17');
  assert.ok(at17b < titles.findIndex((t) => t.startsWith('Round 18:')), 'before round 18');
  const item = rounds[at17b].items.find((i) => i.id === 'coordinator-field-fixes');
  assert.ok(item, 'the change is on the line');
  assert.deepEqual(item.after, ['change-coordinator']);
});

// ---------------------------------------------------------------- field-fixes 10: the first Verdict line (spec verdict-files, design D-3)

const twoVerdicts = (first, second) => `Verdict: ${first}\n\n### Findings\nVerdict: ${second}\n`;
const verdictReviews = (first, second) => ({ ...goodReviews, 'reviews/security-reviewer.md': twoVerdicts(first, second) });

test('field-fixes 10 verdict: readValue returns the first Verdict line whichever order the two come in (AC-3)', () => {
  const root = repo({ changes: { a: { 'x.md': twoVerdicts('approved', 'rejected') }, b: { 'x.md': twoVerdicts('rejected', 'approved') } } });
  assert.equal(readValue(join(root, 'openspec/changes/a/x.md'), 'Verdict'), 'APPROVED');
  assert.equal(readValue(join(root, 'openspec/changes/b/x.md'), 'Verdict'), 'REJECTED');
});

test('field-fixes 10 verdict: reviewConsensus passes on approved then rejected and fails on the reverse, naming the reviewer (AC-3)', () => {
  const root = repo({ changes: { a: verdictReviews('approved', 'rejected'), b: verdictReviews('rejected', 'approved') } });
  const d = (n) => join(root, 'openspec/changes', n);
  assert.equal(reviewConsensus(d('a')).ok, true);
  assert.equal(JSON.stringify(reviewConsensus(d('a'))).includes('rejected'), false, 'nothing is said about the second line');
  const b = reviewConsensus(d('b'));
  assert.equal(b.ok, false);
  assert.match(JSON.stringify(b), /security-reviewer/);
});

test('field-fixes 10 verdict: gh pr create is not refused for a reviewer whose first Verdict line approves, and is refused naming one whose first rejects (AC-3)', () => {
  const ok = repo({ changes: { feat: { ...approved, ...verdictReviews('approved', 'rejected'), ...evidence } } });
  const pass = bash(ok, 'gh pr create --title x --body y');
  assert.equal(pass.code, 0, pass.err);
  assert.doesNotMatch(pass.err, /rejected/);
  const bad = repo({ changes: { feat: { ...approved, ...verdictReviews('rejected', 'approved'), ...evidence } } });
  const refused = bash(bad, 'gh pr create --title x --body y');
  assert.equal(refused.code, 2);
  assert.match(refused.err, /security-reviewer/);
});

// ---------------------------------------------------------------- delivery-models P11: the resolution verdict files (D-8)

test('delivery-models P11 classify: reviews/resolution/<name>.md belongs to the reviewer <name>', () => {
  assert.deepEqual(classify('/r', 'feat', '/r/openspec/changes/feat/reviews/resolution/code-quality-reviewer.md'), { kind: 'gate', owner: 'code-quality-reviewer' });
  assert.deepEqual(classify('/r', 'feat', '/r/openspec/changes/feat/reviews/resolution/test-coverage-reviewer.md'), { kind: 'gate', owner: 'test-coverage-reviewer' });
});

test('delivery-models P11 classify: another path under reviews/ keeps its rule (neg)', () => {
  assert.equal(classify('/r', 'feat', '/r/openspec/changes/feat/reviews/other/x.md').owner, '(a reviewer, as reviews/<its-name>.md)');
  assert.deepEqual(classify('/r', 'feat', '/r/openspec/changes/feat/reviews/code-quality-reviewer.md'), { kind: 'gate', owner: 'code-quality-reviewer' });
  assert.equal(classify('/r', 'feat', '/r/openspec/changes/feat/reviews/resolution/deeper/x.md').owner, '(a reviewer, as reviews/<its-name>.md)');
});

test('delivery-models P11 the hook: a reviewer writes its own resolution verdict only', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'openspec/changes/feat/reviews/resolution/code-quality-reviewer.md', 'code-quality-reviewer').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/reviews/resolution/code-quality-reviewer.md', 'test-coverage-reviewer').code, 2);
  assert.equal(edit(root, 'openspec/changes/feat/reviews/resolution/code-quality-reviewer.md').code, 2, 'main session');
});

// ---------------------------------------------------------------- stage-roles: the writers (design D-6; tasks 2.1, 2.5)

test('stage-roles guard: isDecisionRecord holds for a Markdown file in an adr, adrs or decisions folder in any letter case', () => {
  for (const ok of ['docs/adr/0014-x.md', 'ADR/x.md', 'docs/Adrs/x.md', 'decisions/x.md', 'docs/decisions/deep/x.md', 'adr/x.md']) assert.equal(GUARD.isDecisionRecord(ok), true, ok);
  for (const no of ['docs/adr/x.png', 'docs/adr/x.mdx', 'src/a.ts', 'docs/adr.md', 'docs/adr-notes/x.md', 'adr', 'docs/x.md', 'docs/adrx/x.md']) assert.equal(GUARD.isDecisionRecord(no), false, no);
});

test('stage-roles guard: isTestFile holds for a test folder or a test file name', () => {
  for (const ok of ['test/a.ts', 'tests/a.ts', '__tests__/a.ts', 'e2e/a.ts', 'spec/a.rb', 'specs/a.rb', 'cypress/a.js', 'playwright/a.ts', 'web/TESTS/a.ts', 'src/deep/e2e/a.ts',
    'src/a.test.ts', 'src/a.spec.ts', 'web/export.e2e.ts', 'src/a.cy.ts', 'test_a.py', 'pkg/test_a.py', 'pkg/a_test.go', 'src/a-test.js', 'src/a_spec.rb']) assert.equal(GUARD.isTestFile(ok), true, ok);
  for (const no of ['src/export.ts', 'src/latest.ts', 'src/contest.ts', 'src/spec.ts', 'src/testing.ts', 'src/attest/a.ts', 'README.md', 'test']) assert.equal(GUARD.isTestFile(no), false, no);
});

test('stage-roles guard: adr-author is allowed a decision record before the readiness review and after the approval, on both scripts', () => {
  for (const [label, files] of [['devkit no readiness', devkit], ['devkit approved', approved], ['devkit-lite', lite]]) {
    const root = repo({ changes: { feat: files } });
    for (const f of ['docs/adr/0014-x.md', 'ADR/0014-x.md', 'decisions/x.md', 'docs/adrs/x.md']) assert.equal(edit(root, f, 'adr-author').code, 0, `${label}: ${f}`);
  }
});

test('stage-roles guard: adr-author is refused a product file, naming what it writes', () => {
  const root = repo({ changes: { feat: devkit } });
  const r = edit(root, 'src/a.ts', 'adr-author');
  assert.equal(r.code, 2);
  assert.match(r.err, /adr-author writes only the project's decision records/);
  assert.match(r.err, /src\/a\.ts/);
  assert.equal(edit(repo({ changes: { feat: approved } }), 'src/a.ts', 'adr-author').code, 2, 'past the approval too');
  assert.equal(edit(repo({ changes: { feat: lite } }), 'src/a.ts', 'adr-author').code, 2, 'and on devkit-lite');
});

test('stage-roles guard: adr-author is refused a file that is not Markdown in the folder', () => {
  const root = repo({ changes: { feat: devkit } });
  assert.equal(edit(root, 'docs/adr/diagram.png', 'adr-author').code, 2);
  assert.equal(edit(root, 'docs/notes.md', 'adr-author').code, 2, 'Markdown outside an ADR folder');
});

test('stage-roles guard: adr-author keeps writing the change\'s own files and is refused the gate files of others', () => {
  const root = repo({ changes: { feat: devkit } });
  assert.equal(edit(root, 'openspec/changes/feat/decisions.md', 'adr-author').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/readiness.md', 'adr-author').code, 2);
});

test('stage-roles guard: shell writes of adr-author follow the same rule', () => {
  const root = repo({ changes: { feat: devkit } });
  assert.equal(bash(root, 'echo x > docs/adr/0014-x.md', 'adr-author').code, 0);
  assert.equal(bash(root, 'echo x > src/a.ts', 'adr-author').code, 2);
});

test('stage-roles guard: e2e-tester is allowed a test file past the approved readiness, in each folder name and each file form', () => {
  const root = repo({ changes: { feat: approved } });
  for (const f of ['test/a.ts', 'tests/a.ts', '__tests__/a.ts', 'e2e/export.spec.ts', 'spec/a.rb', 'specs/a.rb', 'cypress/a.js', 'playwright/a.ts',
    'web/export.e2e.ts', 'src/a.test.ts', 'src/a.spec.ts', 'src/a.cy.ts', 'test_a.py', 'pkg/a_test.go', 'src/a-test.js']) {
    assert.equal(edit(root, f, 'e2e-tester').code, 0, f);
  }
});

test('stage-roles guard: e2e-tester is refused a product file past the approved readiness, naming the implementer', () => {
  const root = repo({ changes: { feat: approved } });
  const r = edit(root, 'src/export.ts', 'e2e-tester');
  assert.equal(r.code, 2);
  assert.match(r.err, /e2e-tester writes only test files/);
  assert.match(r.err, /src\/export\.ts/);
  assert.match(r.err, /tdd-implementer/);
});

test('stage-roles guard: e2e-tester is refused a test file before the approved readiness, with the reason product code is refused today', () => {
  for (const files of [devkit, { ...devkit, 'readiness.md': '- Status: NEEDS-REVISION\n' }]) {
    const r = edit(repo({ changes: { feat: files } }), 'e2e/export.spec.ts', 'e2e-tester');
    assert.equal(r.code, 2);
    assert.match(r.err, /no approved readiness|Product code stays closed/);
  }
});

test('stage-roles guard: e2e-tester is unrestricted on devkit-lite, as every agent is', () => {
  const root = repo({ changes: { feat: lite } });
  assert.equal(edit(root, 'src/export.ts', 'e2e-tester').code, 0);
  assert.equal(edit(root, 'e2e/a.spec.ts', 'e2e-tester').code, 0);
});

test('stage-roles guard: shell writes of e2e-tester follow the same rule', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(bash(root, 'echo x > e2e/a.spec.ts', 'e2e-tester').code, 0);
  assert.equal(bash(root, 'echo x > src/export.ts', 'e2e-tester').code, 2);
});

test('stage-roles guard: the test runner and the screen designer are refused a code path past the approval, naming the implementer', () => {
  const root = repo({ changes: { feat: approved } });
  for (const [a, f] of [['test-runner', 'src/a.test.ts'], ['test-runner', 'src/a.ts'], ['screen-designer', 'src/view.tsx']]) {
    const r = edit(root, f, a);
    assert.equal(r.code, 2, `${a} ${f}`);
    assert.match(r.err, /tdd-implementer/);
  }
  assert.equal(edit(repo({ changes: { feat: devkit } }), 'src/view.tsx', 'screen-designer').code, 2, 'before the approval too');
});

test('stage-roles guard: the test runner and the screen designer keep writing the change\'s own folder', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'openspec/changes/feat/unit-tests.md', 'test-runner').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/mockup.md', 'screen-designer').code, 0);
  assert.equal(edit(root, 'openspec/changes/feat/mock/a.html', 'screen-designer').code, 0);
});

test('stage-roles guard: the implementer is unchanged, and the main session is still refused code past the approval', () => {
  const root = repo({ changes: { feat: approved } });
  assert.equal(edit(root, 'src/a.ts', 'tdd-implementer').code, 0);
  assert.equal(edit(root, 'src/a.ts').code, 2);
  assert.equal(edit(root, 'docs/adr/x.md').code, 2, 'a decision record is the adr-author\'s, not the main session\'s');
});

// ---------------------------------------------------------------- stage-roles: the setup (design D-3; tasks 2.1, 2.8)

const setupRoot = join(here, '..', 'skills', 'openspec-setup');
const setupStep5 = () => {
  const md = readFileSync(join(setupRoot, 'SKILL.md'), 'utf8');
  const from = md.indexOf('5. **Write `openspec/config.yaml`.**');
  assert.ok(from >= 0, 'step 5 exists');
  return md.slice(from, md.indexOf('6. **Check.**', from));
};

test('stage-roles setup: step 5 fills the four test keys from the repository and asks the owner to confirm each', () => {
  const step = setupStep5();
  for (const key of ['tests:', '`unit`', '`coverage.command`', '`coverage.target`', '`e2e`']) assert.ok(step.includes(key), key);
  assert.match(step, /Show each proposed value and\s+ask the owner to confirm or change it/);
  assert.match(step, /Write only what the owner confirmed/);
  assert.match(step, /`e2e` only when the\s+project has an E2E tool configured/);
});

test('stage-roles setup: step 5 keeps every value the block already holds and says that a stage with no command does not run', () => {
  const step = setupStep5();
  assert.match(step, /keep every value the block already holds and ask nothing about\s+it/);
  assert.match(step, /A stage whose command is absent does not run/);
});

test('stage-roles setup: the starting config shows the four test keys as a commented block with its heading', () => {
  const text = readFileSync(join(setupRoot, 'templates', 'config.yaml'), 'utf8');
  const lines = text.split('\n');
  const heading = lines.findIndex((l) => l === '# The settings of /devkit change; a test stage whose command is absent does not run.');
  assert.ok(heading > lines.findIndex((l) => l.startsWith('# merge_method')), 'the block comes after the ship comment');
  const block = lines.slice(heading, heading + 14).join('\n');
  for (const line of ['# devkit:', '#   language:', '#   driver:', '#   tests:', '#     unit:', '#     coverage:', '#       command:', '#       target:', '#     e2e:']) assert.ok(block.includes(line), line);
  assert.equal(lines.some((l) => /^devkit:/.test(l)), false, 'every line of the block is a comment: the file stays valid with no devkit settings');
  assert.equal(/^\s+(unit|e2e|target):/m.test(text), false, 'no key of the block is active');
});

// ---------------------------------------------------------------- stage-roles: the owner gates (design D-5, D-7; tasks 2.1, 2.6, 2.7)

const shipChange = () => readFileSync(join(here, '..', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
const rowOfShip = (step) => shipChange().split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';

test('stage-roles gates: the stop-mockup-approval row comes after stop-plan-approval and is written only from the owner\'s own message', () => {
  const lines = shipChange().split('\n');
  const plan = lines.findIndex((l) => l.startsWith('| `stop-plan-approval`'));
  const mockup = lines.findIndex((l) => l.startsWith('| `stop-mockup-approval`'));
  assert.ok(plan >= 0 && mockup === plan + 1, 'the row follows stop-plan-approval');
  const row = lines[mockup];
  assert.match(row, /Only from the owner's own message/);
  assert.match(row, /Never answer for the owner/);
});

test('stage-roles gates: the mock-up row shows each file mockup.md lists, an .html one by its path', () => {
  const row = rowOfShip('stop-mockup-approval');
  assert.match(row, /each file `mockup\.md` lists/);
  assert.match(row, /an `\.html` screen by its path/);
  assert.match(row, /private Artifact/);
});

test('stage-roles gates: an approved mock-up sets result=passed with the same attempt and the current commit, and records the owner\'s words', () => {
  const row = rowOfShip('stop-mockup-approval');
  assert.match(row, /<!-- devkit-stage mockup result=passed attempt=<same n> commit=<git rev-parse HEAD> -->/);
  assert.match(row, /## Owner's approval/);
  assert.match(row, /- Date: <YYYY-MM-DD>/);
  assert.match(row, /- Owner's words: "<up to 200 characters>"/);
});

test('stage-roles gates: changes asked for set result=failed with the same attempt and append the owner\'s notes', () => {
  const row = rowOfShip('stop-mockup-approval');
  assert.match(row, /result=failed/);
  assert.match(row, /## Owner's notes \(attempt <n>\)/);
});

test('stage-roles gates: an approved mock-up adds what it revealed to the requirements', () => {
  const row = rowOfShip('stop-mockup-approval');
  assert.match(row, /append to `requirements\.md`, under `## What the mock-up revealed`/);
  assert.match(row, /none: say so in one line/);
});

test('stage-roles gates: the stop-plan-approval row names the records the approval accepts and the loop\'s accept-decisions step, keeping what it pinned', () => {
  const row = rowOfShip('stop-plan-approval');
  assert.match(row, /the records\s+`decisions\.md` lists, which the approval accepts/);
  assert.match(row, /accept-decisions/);
  assert.match(row, /only when the owner's own message approves/i);
});

test('stage-roles gates: the verify row allows no pull-request comment', () => {
  const row = rowOfShip('verify');
  assert.ok(row, 'a verify row');
  assert.match(row, /no PR comment/);
  assert.doesNotMatch(row, /a PR comment is allowed/);
  assert.doesNotMatch(row, /screenshot/i);
});

test('stage-roles gates: the devkit skill names the mock-up among the owner\'s gates and the accept-decisions step', () => {
  const md = readFileSync(join(here, '..', 'skills', 'devkit', 'SKILL.md'), 'utf8');
  const description = /^description: "(.*)"$/m.exec(md)?.[1] ?? '';
  assert.match(description, /the grill, the mock-up, the plan approval, the retro answers/);
  const gates = md.slice(md.indexOf('## Owner gates'), md.indexOf('## Waiting on GitHub'));
  assert.match(gates, /the mock-up \(`waiting-mockup`/);
  assert.match(gates, /`stop-mockup-approval`/);
  assert.match(gates, /AskUserQuestion/);
  assert.match(gates, /approve/);
  const loop = md.slice(md.indexOf('## Loop'), md.indexOf('## Owner gates'));
  const session = loop.split('\n').find((l) => l.startsWith('- `session`')) ?? '';
  assert.match(session, /`accept-decisions`/);
  assert.match(session, /`detail\.command`/);
  assert.match(session, /reply blocked --param id=<id> --param why=cannot-accept --param error="<the JSON's error field>"/);
});

// ================================================================ roadmap-sessions-upfront, phase 1: the readers of a started session (design D-1)

test('upfront AC-2 guard: startedTaskOf and firstMessageOf read only the first message\'s started form', () => {
  const STARTED = GUARD.STARTED_BY_SESSION;
  const form = (task) => [STARTED, 'A background paragraph.', '', 'Task:', ...task, '', 'Notes.'].join('\n');
  // startedTaskOf: the lines after the `Task:` line of the started form, else null.
  assert.deepEqual(GUARD.startedTaskOf(form(['/devkit change a', 'devkit-start: a 0123456789abcdef'])), ['/devkit change a', 'devkit-start: a 0123456789abcdef', '', 'Notes.']);
  assert.deepEqual(GUARD.startedTaskOf(`${STARTED}\n  Task:  \n/devkit change a`), ['/devkit change a'], 'the Task line is read trimmed');
  assert.equal(GUARD.startedTaskOf('Background.\n\nTask:\n/devkit change a'), null, 'no started form');
  assert.equal(GUARD.startedTaskOf(`hello\n${form(['/devkit change a'])}`), null, 'the started line is not the first line');
  assert.equal(GUARD.startedTaskOf(`${STARTED}\nSome words.\n/devkit change a`), null, 'the started form with no Task line');
  assert.equal(GUARD.startedTaskOf('/devkit change a'), null);
  // START_LINE: one line, the change id and a 16-character lowercase hexadecimal ticket.
  assert.deepEqual(GUARD.START_LINE.exec('devkit-start: a-b.c_1 0123456789abcdef')?.slice(1), ['a-b.c_1', '0123456789abcdef']);
  assert.deepEqual(GUARD.START_LINE.exec('devkit-start: a 0123456789abcdef \r')?.slice(1), ['a', '0123456789abcdef'], 'trailing blanks and a carriage return');
  for (const text of ['devkit-start: a 0123456789abcde', 'devkit-start: a 0123456789ABCDEF', 'devkit-start: 0123456789abcdef', ' devkit-start: a 0123456789abcdef', 'devkit-start: a 0123456789abcdef x']) {
    assert.equal(GUARD.START_LINE.exec(text), null, text);
  }
  // firstMessageOf: the string content of the first `user` line that is neither meta nor a sidechain.
  const user = (content, extra = {}) => JSON.stringify({ type: 'user', message: { role: 'user', content }, ...extra });
  const transcript = (lines) => {
    const file = join(tmpFolder('devkit-guard-first-message-'), 'session.jsonl');
    writeFileSync(file, `${lines.join('\n')}\n`);
    return { transcript_path: file };
  };
  const assistant = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
  assert.equal(GUARD.firstMessageOf(transcript([assistant, user('first'), user('second')])), 'first');
  assert.equal(GUARD.firstMessageOf(transcript([user('skill body', { isMeta: true }), user('side', { isSidechain: true }), user('real'), user('later')])), 'real', 'meta and sidechain lines are skipped');
  assert.equal(GUARD.firstMessageOf(transcript(['{not json', user('first')])), 'first', 'a broken line is skipped');
  assert.equal(GUARD.firstMessageOf(transcript([user([{ type: 'text', text: 'blocks' }]), user('second')])), null, 'the first message is not a string: no later one stands in');
  assert.equal(GUARD.firstMessageOf(transcript([assistant])), null, 'no user line');
  assert.equal(GUARD.firstMessageOf({}), null, 'no transcript path');
  assert.throws(() => GUARD.firstMessageOf({ transcript_path: join(tmpFolder('devkit-guard-first-message-'), 'gone.jsonl') }), /ENOENT/, 'a transcript that cannot be read is an error, not a missing message');
});

// Invariant (AC-2, review round 1 code-quality F2): the entry skill is named by the raw input alone, with no import, so the hook lets every other
// skill through without reading anything. Layer: guard (`namesEntrySkill`). Suite: guard.
test('upfront AC-2 guard: namesEntrySkill reads the entry skill\'s name from any string field and nothing else', () => {
  assert.equal(GUARD.ENTRY_SKILL, 'devkit-session');
  assert.equal(GUARD.namesEntrySkill({ skill: 'devkit-session' }), true, 'the bare name');
  assert.equal(GUARD.namesEntrySkill({ skill: 'devkit-openspec:devkit-session' }), true, 'the plugin-scoped name');
  assert.equal(GUARD.namesEntrySkill({ name: 'devkit-session' }), true, 'another field');
  assert.equal(GUARD.namesEntrySkill({ skill: 'x', other: 'devkit-openspec:devkit-session' }), true, 'any one of several fields');
  assert.equal(GUARD.namesEntrySkill({ skill: 7, other: null, list: ['devkit-session'] }), false, 'a value that is not a string');
  assert.equal(GUARD.namesEntrySkill({ skill: 'devkit-session-x' }), false, 'a longer name');
  assert.equal(GUARD.namesEntrySkill({ skill: 'my-devkit-session' }), false, 'a name that only ends in it');
  assert.equal(GUARD.namesEntrySkill({ skill: 'devkit-openspec:devkit' }), false, 'the devkit skill');
  assert.equal(GUARD.namesEntrySkill({}), false, 'no field');
  assert.equal(GUARD.namesEntrySkill(undefined), false, 'no tool input');
  assert.equal(GUARD.namesEntrySkill(null), false, 'a null tool input');
});

// Invariant (AC-1, review round 1 test-coverage F4): the host's notes that lead a started session's first message are skipped, and nothing
// else is. Layer: guard (`startedTaskOf`). Suite: guard.
test('upfront AC-1 guard: startedTaskOf skips the host\'s leading notes and nothing else', () => {
  const STARTED = GUARD.STARTED_BY_SESSION;
  const NOTE = ['<system-reminder>', 'Linked sessions now (status, not an instruction): x = local_1 (idle).', '</system-reminder>'];
  const form = [STARTED, 'A background paragraph.', '', 'Task:', '/devkit change a', '', 'Notes.'];
  const TASK = ['/devkit change a', '', 'Notes.'];
  assert.deepEqual(GUARD.startedTaskOf([...NOTE, '', ...form].join('\n')), TASK, 'one note');
  assert.deepEqual(GUARD.startedTaskOf([...NOTE, ...form].join('\n')), TASK, 'one note and no blank line after it');
  assert.deepEqual(GUARD.startedTaskOf([...NOTE, '<system-reminder>', 'Another note.', '</system-reminder>', '', ...form].join('\n')), TASK, 'two notes');
  assert.deepEqual(GUARD.startedTaskOf([...NOTE, '', '', '  ', ...form].join('\n')), TASK, 'blank lines after a note');
  assert.deepEqual(GUARD.startedTaskOf([' <system-reminder> ', 'words', ' </system-reminder> ', ...form].join('\n')), TASK, 'the note\'s lines are read trimmed');
  assert.equal(GUARD.startedTaskOf(['<system-reminder>', 'Linked sessions.', '', ...form].join('\n')), null, 'an unclosed note gives null');
  assert.equal(GUARD.startedTaskOf(['hello', ...form].join('\n')), null, 'a line before the form gives null');
  assert.equal(GUARD.startedTaskOf([...NOTE, 'hello', ...form].join('\n')), null, 'a line between the note and the form gives null');
  assert.equal(GUARD.startedTaskOf([...NOTE, '', 'Background.', '', 'Task:', '/devkit change a'].join('\n')), null, 'a note and no started form');
  assert.deepEqual(GUARD.startedTaskOf([STARTED, '<system-reminder>', 'Late note.', '</system-reminder>', 'Task:', '/devkit change a'].join('\n')), ['/devkit change a'], 'a note after the form\'s first line is no leading note: the form reads as before');
  assert.deepEqual(GUARD.startedTaskOf(`${STARTED}\nA paragraph.\n\nTask:\n<system-reminder>\nin the task\n</system-reminder>\n/devkit change a`), ['<system-reminder>', 'in the task', '</system-reminder>', '/devkit change a'], 'a note inside the task is part of the task');
});

// ---------------------------------------------------------------- roadmap-sessions-upfront phase 4: the triage (AC-5, AC-6)

test('upfront AC-6 guard: approval.md refuses a write by devkit-core:requirements-triage', () => {
  const root = repo({ changes: { feat: approved } });
  const f = 'openspec/changes/feat/approval.md';
  const r = edit(root, f, 'requirements-triage');
  assert.equal(r.code, 2);
  assert.match(r.err, /approval\.md is written only by the main session, from the owner's own message; not by requirements-triage/);
  assert.equal(bash(root, `echo '- Status: APPROVED' > ${f}`, 'requirements-triage').code, 2, 'by redirect');
  assert.equal(edit(root, f).code, 0, 'the main session still may');
});

test('upfront AC-5 skill: the grill rule of config.yaml and of the four schema files names the triage and forbids answering yourself', () => {
  const root = join(here, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8').replace(/\s+/g, ' ');
  const RULE = 'Ask the owner every question that nothing written settles; the requirements-triage agent answers the others first, each with its source. Never answer a question yourself.';
  assert.ok(read('openspec', 'config.yaml').includes(RULE), 'openspec/config.yaml rules.requirements');
  for (const dir of [['plugins', 'openspec', 'schemas'], ['openspec', 'schemas']]) {
    for (const script of ['devkit', 'devkit-lite']) {
      const text = read(...dir, script, 'schema.yaml');
      const stage = text.slice(text.indexOf('- id: requirements'), text.indexOf('- id:', text.indexOf('- id: requirements') + 5));
      assert.ok(stage.includes('Helpers: codebase-researcher, requirements-triage.'), `${dir[0]}/${script}: the helpers line`);
      assert.ok(stage.includes(RULE), `${dir[0]}/${script}: the rule`);
      assert.ok(!stage.includes('Do not answer the questions yourself.'), `${dir[0]}/${script}: the old sentence is replaced`);
    }
  }
  const skill = readFileSync(join(root, 'plugins', 'core', 'skills', 'requirements-grill', 'SKILL.md'), 'utf8');
  for (const part of ['### 2b. Triage first', 'devkit-core:requirements-triage', 'Change <id> (<script> script), stage requirements: triage of the grill', '### Answered by triage',
    '`<n>. [<axis>] <question> → <answer> (source: \\`<path>[:<line>]\\`)`', '**Answered by triage:**']) {
    assert.ok(skill.includes(part), `the grill skill holds: ${part}`);
  }
  assert.ok(skill.indexOf('### 2b. Triage first') > skill.indexOf('### 2. Gather the ammunition') && skill.indexOf('### 2b. Triage first') < skill.indexOf('### 3. Grill on the four axes'), 'step 2b sits between 2 and 3');
  assert.match(skill, /- Answer a question yourself/, 'the Never list keeps it');
});

// Invariant (AC-5, D-17, D-14): the documents say that devkit and devkit-lite are at flow version 2 from devkit-openspec 0.33.0 on, with the triage added
// to the grill, that a change on flow 1 keeps its grill with no triage until the owner moves it, and that devkit-project stays at version 1.
// Layer: the flow doc, the changelog entry and ADR 0021's Note. Suite: guard.
test('upfront AC-5 docs: the flow doc names the released flow versions, the 0.37.0 entry names flow version 2, and ADR 0021\'s Note names flow 1', () => {
  const root = join(here, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const flat = (text) => text.replace(/\s+/g, ' ');
  // docs/openspec-flow.md: the paragraph right after "A change to a `flow.json` raises its `version`"
  const doc = read('docs', 'openspec-flow.md');
  const raises = doc.indexOf('A change to a `flow.json` raises its `version`');
  const adopting = doc.indexOf('## Adopting it in a project');
  assert.ok(raises !== -1 && adopting > raises, 'the flow doc has the versions paragraph and the next section');
  const paragraphs = doc.slice(raises, adopting).trim().split(/\n\n+/);
  assert.equal(paragraphs.length, 2, 'one paragraph follows the one about raising a version');
  const versions = flat(paragraphs[1]);
  for (const part of [
    '`devkit` and `devkit-lite` are at version 2 from devkit-openspec 0.33.0 on',
    'version 2 adds the `requirements-triage` helper to the grill',
    'a change on version 1 keeps its grill with no triage until it is moved with `change-loop.mjs flow <id>`',
    '`devkit-project` stays at version 1',
  ]) assert.ok(versions.includes(part), `the flow doc says: ${part}`);
  // CHANGELOG.md: the 0.37.0 entry's sentence under devkit-openspec 0.33.0 and its Projects line
  const log = read('CHANGELOG.md');
  const start = log.indexOf('## 0.37.0');
  const entry = flat(log.slice(start, log.indexOf('\n## ', start + 1)));
  const openspec = entry.slice(entry.indexOf('**devkit-openspec** 0.33.0'), entry.indexOf('- **devkit-core**'));
  assert.ok(openspec.includes('The `devkit` and `devkit-lite` flows are released as flow version 2, which adds the `requirements-triage` helper to the grill'), 'the devkit-openspec bullet names flow version 2');
  assert.ok(openspec.includes('a change opened before keeps flow 1 and its grill with no triage until the owner moves it with `change-loop.mjs flow <id>`'), 'and what a change under way keeps');
  assert.ok(entry.includes('- Projects: re-run `openspec-setup` to install `flows/2.json`; changes under way keep flow 1 and their grill'), 'the Projects line');
  // ADR 0021: the Note after the Decision list
  const adr = read('docs', 'adr', '0021-a-roadmap-run-opens-every-change-at-its-start.md');
  const noteAt = adr.indexOf('Note (roadmap-sessions-upfront, 2026-11-23):');
  assert.ok(noteAt > adr.indexOf('8. The change session\'s own loop') && noteAt < adr.indexOf('## Consequences'), 'the Note sits after the Decision list');
  const note = flat(adr.slice(noteAt, adr.indexOf('## Consequences')));
  for (const part of [
    'decision 3\'s triage in every grill holds for a change that follows flow version 2 or later of its script',
    'a change on flow 1 (opened before devkit-openspec 0.33.0, or with no recorded flow) keeps its grill with no triage until the owner moves it',
  ]) assert.ok(note.includes(part), `ADR 0021's Note says: ${part}`);
  assert.match(adr, /^- Status: accepted$/m, 'its status stays');
});
