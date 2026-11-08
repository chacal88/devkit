// Tests for deliver-check.mjs. Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs both files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync as fsRm, chmodSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseShip, shipMode, ShipConfigError, parseCommitLine, gitFacts, staleness, reviewsItem, tasksItem, parseTasks, readPhases, findingsItem, acceptanceItem, makeGh, fetchPr, prItem, checksItem, conversationItem, bodyItem, nextStep, summarize, collectState, detectHost, watchMinutes } from './deliver-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const schemas = join(here, '..', 'schemas');

// Commits must not depend on a global git identity.
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid',
  GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

export function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// A repo with openspec/, the schemas, an optional config and change files,
// and (unless commit is false) one initial commit. Returns the root.
export function gitRepo({ config = 'schema: devkit-lite\n', changes = {}, files = {}, branch = 'main', commit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'devkit-deliver-'));
  git(root, 'init', '-q', '-b', branch);
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  cpSync(schemas, join(root, 'openspec', 'schemas'), { recursive: true });
  if (config !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), config);
  for (const [name, fs] of Object.entries(changes)) put(root, Object.fromEntries(Object.entries(fs).map(([f, b]) => [`openspec/changes/${name}/${f}`, b])));
  put(root, files);
  if (commit) commitAll(root, 'initial');
  return root;
}

// Write files (path relative to root -> content) without committing.
export function put(root, files) {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
}

// Stage everything and commit; returns the new full sha.
export function commitAll(root, message) {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

test('test helpers: commits work without a global git identity and return the head sha', () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': '- [ ] 1.1 a\n' } } });
  const first = git(root, 'rev-parse', 'HEAD');
  put(root, { 'src/a.ts': 'x\n' });
  const second = commitAll(root, 'code');
  assert.match(second, /^[0-9a-f]{40}$/);
  assert.notEqual(first, second);
  assert.equal(git(root, 'rev-list', '--count', 'HEAD'), '2');
});

// ---------------------------------------------------------------- ship config (D2)

test('parseShip: no key, empty key and unrelated keys give an empty map', () => {
  assert.deepEqual(parseShip(''), {});
  assert.deepEqual(parseShip('schema: devkit\n'), {});
  assert.deepEqual(parseShip('schema: devkit\nship:\ncontext: |\n  x\n'), {});
  assert.deepEqual(parseShip('ship:   # nothing yet\n'), {});
});

test('parseShip: block map', () => {
  const text = 'schema: devkit\nship:\n  devkit-lite: pr\n  devkit: plan\ncontext: |\n  ship: merge\n';
  assert.deepEqual(parseShip(text), { 'devkit-lite': 'pr', devkit: 'plan' });
});

test('parseShip: flow map', () => {
  assert.deepEqual(parseShip('ship: { devkit-lite: pr }\n'), { 'devkit-lite': 'pr' });
  assert.deepEqual(parseShip('ship: {devkit-lite: pr, devkit: plan}\n'), { 'devkit-lite': 'pr', devkit: 'plan' });
  assert.deepEqual(parseShip('ship: {}\n'), {});
});

test('parseShip: quotes, comments and blank lines are ignored', () => {
  const text = 'ship:  # modes\n  # devkit: merge\n\n  "devkit-lite": "pr"  # opt in\n  \'devkit\': \'plan\'\n';
  assert.deepEqual(parseShip(text), { 'devkit-lite': 'pr', devkit: 'plan' });
  assert.deepEqual(parseShip('ship: { "devkit-lite": "pr" } # c\n'), { 'devkit-lite': 'pr' });
});

test('parseShip: tolerates CRLF line endings', () => {
  assert.deepEqual(parseShip('ship:\r\n  devkit-lite: pr\r\n'), { 'devkit-lite': 'pr' });
});

test('parseShip: merge is rejected with the round-2 message (AC-10)', () => {
  assert.throws(() => parseShip('ship:\n  devkit-lite: merge\n'), (e) => {
    assert.ok(e instanceof ShipConfigError);
    assert.equal(e.message, 'openspec/config.yaml: ship.devkit-lite: merge arrives in a later round (round 2, auto-merge); use plan or pr');
    return true;
  });
  assert.throws(() => parseShip('ship: { devkit: merge }\n'), /ship\.devkit: merge arrives in a later round \(round 2, auto-merge\)/);
});

test('parseShip: unknown mode names the key and the allowed values', () => {
  for (const text of ['ship:\n  devkit: auto\n', 'ship: { devkit: auto }\n', 'ship:\n  devkit: PR\n']) {
    assert.throws(() => parseShip(text), (e) => e instanceof ShipConfigError && /ship\.devkit/.test(e.message) && /plan.*pr/.test(e.message), text);
  }
});

test('parseShip: scalar, nested map and duplicate key are errors naming the key', () => {
  assert.throws(() => parseShip('ship: pr\n'), (e) => e instanceof ShipConfigError && /^openspec\/config\.yaml: ship:/.test(e.message) && /plan.*pr/.test(e.message));
  assert.throws(() => parseShip('ship:\n  devkit:\n    mode: pr\n'), /ship\.devkit/);
  assert.throws(() => parseShip('ship:\n  devkit-lite: pr\n  devkit-lite: plan\n'), /ship\.devkit-lite: duplicate/);
  assert.throws(() => parseShip('ship: { devkit: pr, devkit: plan }\n'), /ship\.devkit: duplicate/);
  assert.throws(() => parseShip('ship:\n  devkit\n'), ShipConfigError);
});

test('shipMode: no config file, no key or a schema absent from the map give plan (AC-1)', () => {
  assert.equal(shipMode(gitRepo({ config: null }), 'devkit'), 'plan');
  assert.equal(shipMode(gitRepo({ config: 'schema: devkit\n' }), 'devkit'), 'plan');
  assert.equal(shipMode(gitRepo({ config: 'schema: devkit\nship:\n' }), 'devkit-lite'), 'plan');
  assert.equal(shipMode(gitRepo({ config: 'ship: { devkit-lite: pr }\n' }), 'devkit'), 'plan');
});

test('shipMode: reads the mode for the schema', () => {
  const root = gitRepo({ config: 'schema: devkit\nship:\n  devkit-lite: pr\n  devkit: plan\n' });
  assert.equal(shipMode(root, 'devkit-lite'), 'pr');
  assert.equal(shipMode(root, 'devkit'), 'plan');
});

test('shipMode: an invalid entry fails the whole config, whatever the schema asked for', () => {
  const root = gitRepo({ config: 'ship:\n  devkit-lite: pr\n  devkit: merge\n' });
  assert.throws(() => shipMode(root, 'devkit-lite'), /ship\.devkit: merge arrives in a later round/);
});

// ---------------------------------------------------------------- guard ignores ship (AC-1)

test('guard session, edit, bash and ci behave identically with and without ship (AC-1)', () => {
  const guard = join(here, 'guard.mjs');
  const root = gitRepo({ config: 'schema: devkit\n', changes: {
    feat: { '.openspec.yaml': 'schema: devkit\n', 'readiness.md': '- Status: APPROVED\n' },
  } });
  const env = { ...process.env, DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '' };
  const agent = (a) => (a ? { agent_type: `devkit-core:${a}`, agent_id: 'x' } : {});
  const calls = [
    ['session', { cwd: root }],
    ['edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src/a.ts') } }],
    ['edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'src/a.ts') }, ...agent('tdd-implementer') }],
    ['edit', { cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'openspec/changes/feat/readiness.md') } }],
    ['bash', { cwd: root, tool_name: 'Bash', tool_input: { command: 'git push --force' } }],
    ['bash', { cwd: root, tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } }],
    ['bash', { cwd: root, tool_name: 'Bash', tool_input: { command: 'git status' } }],
    ['ci', {}],
  ];
  const runAll = () => calls.map(([mode, input]) => {
    const r = spawnSync('node', [guard, mode], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', env });
    return { mode, status: r.status, stdout: r.stdout, stderr: r.stderr };
  });
  const without = runAll();
  for (const ship of ['ship: { devkit-lite: pr, devkit: pr }\n', 'ship:\n  devkit-lite: pr\n  devkit: pr\n']) {
    writeFileSync(join(root, 'openspec', 'config.yaml'), `schema: devkit\n${ship}`);
    assert.deepEqual(runAll(), without, ship);
  }
  assert.deepEqual(without.map((r) => r.status), [0, 2, 0, 2, 2, 2, 0, 1], 'the gates themselves are active in this fixture');
});

// ---------------------------------------------------------------- staleness and item 2 (D4, D5)

const review = (verdict, sha, extra = '') => `Verdict: ${verdict}\nCommit: ${sha}${extra}\n\n# Review\n`;
const reviews = (sha, over = {}) => ({
  'code-quality-reviewer': review('approved', sha),
  'test-coverage-reviewer': review('approved', sha),
  ...over,
});
const withReviews = (rs) => Object.fromEntries(Object.entries(rs).map(([n, body]) => [`openspec/changes/feat/reviews/${n}.md`, body]));
const base = () => gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } }, files: { 'src/a.ts': 'a\n' } });
const head = (root) => git(root, 'rev-parse', 'HEAD');
const stale = (root, sha) => staleness(root, parseCommitLine(`Commit: ${sha}\n`), gitFacts(root));

test('parseCommitLine: reads the header only, with the uncommitted marker', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(parseCommitLine(`Verdict: approved\nCommit: ${sha}\n`), { sha, uncommitted: false });
  assert.deepEqual(parseCommitLine(`Verdict: approved\n- **Commit:** ${sha} (uncommitted changes)\n`), { sha, uncommitted: true });
  assert.equal(parseCommitLine('Verdict: approved\n'), null);
  assert.equal(parseCommitLine(`Verdict: approved\n\n# Findings\nCommit: ${sha}\n`), null, 'a Commit: line after the first heading is not the header');
  assert.equal(parseCommitLine('Commit: main\n'), null, 'a branch name is not a sha');
});

test('staleness: the head, and later commits touching only openspec/, are current (AC-7)', () => {
  const root = base();
  const sha = head(root);
  assert.equal(stale(root, sha), null);
  put(root, { 'openspec/changes/feat/notes.md': 'n\n' });
  commitAll(root, 'plan only');
  assert.equal(stale(root, sha), null);
});

test('staleness: a later commit touching src/ or openspecx/ makes it stale (AC-7)', () => {
  for (const path of ['src/a.ts', 'src/new.ts', 'openspecx/notes.md', 'openspec-extra/x.md']) {
    const root = base();
    const sha = head(root);
    put(root, { [path]: 'changed\n' });
    const later = commitAll(root, 'later');
    const why = stale(root, sha);
    assert.ok(why, path);
    assert.ok(why.includes(later.slice(0, 7)) && why.includes(path), `${path}: ${why}`);
  }
});

test('staleness: a commit mixing openspec/ and src/ is stale', () => {
  const root = base();
  const sha = head(root);
  put(root, { 'openspec/changes/feat/notes.md': 'n\n', 'src/a.ts': 'b\n' });
  commitAll(root, 'mixed');
  assert.ok(stale(root, sha));
});

test('staleness: a merge from the base branch that brings product code is stale; openspec-only is current', () => {
  for (const [path, expected] of [['src/base.ts', 'stale'], ['openspec/changes/other.md', 'current']]) {
    const root = base();
    git(root, 'switch', '-q', '-c', 'feat');
    const sha = head(root);
    git(root, 'switch', '-q', 'main');
    put(root, { [path]: 'from base\n' });
    commitAll(root, 'base moves');
    git(root, 'switch', '-q', 'feat');
    put(root, { 'openspec/changes/feat/own.md': 'own\n' });
    commitAll(root, 'own plan edit');
    git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
    assert.equal(git(root, 'rev-list', '--merges', '--count', `${sha}..HEAD`), '1');
    assert.equal(stale(root, sha) === null, expected === 'current', path);
  }
});

test('staleness: an unresolvable, non-ancestor or non-sha value is stale', () => {
  const root = base();
  assert.match(stale(root, '0123456789abcdef0123456789abcdef01234567'), /does not resolve|unknown/);
  git(root, 'switch', '-q', '-c', 'other');
  put(root, { 'src/other.ts': 'o\n' });
  const elsewhere = commitAll(root, 'other branch');
  git(root, 'switch', '-q', 'main');
  assert.match(stale(root, elsewhere), /not an ancestor|not in/);
  assert.equal(stale(root, head(root).slice(0, 7)), null, 'a unique short prefix is accepted');
  assert.ok(staleness(root, null, gitFacts(root)), 'no Commit: line');
  assert.ok(staleness(root, { sha: head(root), uncommitted: true }, gitFacts(root)), 'uncommitted marker');
});

test('staleness: uncommitted work outside openspec/ and .claude/ makes everything stale', () => {
  const dirty = [
    ['tracked change', { 'src/a.ts': 'edited\n' }],
    ['untracked file', { 'src/new.ts': 'n\n' }],
    ['untracked in openspecx/', { 'openspecx/n.md': 'n\n' }],
    ['untracked file with a space', { 'my notes.txt': 'n\n' }],
  ];
  for (const [label, files] of dirty) {
    const root = base();
    const sha = head(root);
    put(root, files);
    assert.ok(stale(root, sha), label);
  }
  for (const [label, files] of [['untracked in openspec/', { 'openspec/changes/feat/x.md': 'x\n' }], ['untracked in .claude/', { '.claude/settings.local.json': '{}\n' }]]) {
    const root = base();
    const sha = head(root);
    put(root, files);
    assert.equal(stale(root, sha), null, label);
  }
  const root = base();
  const sha = head(root);
  put(root, { 'openspec/changes/feat/tasks.md': '- [ ] 1.1 edited\n' });
  assert.equal(stale(root, sha), null, 'a tracked edit inside openspec/ is allowed');
});

test('item 2: met when both required reviewers are approved at the head', () => {
  const root = base();
  put(root, withReviews(reviews(head(root))));
  const it = reviewsItem(root, 'feat');
  assert.equal(it.id, 2);
  assert.equal(it.status, 'met');
  assert.deepEqual(it.details, { stale: [], rejected: [], missing: [] });
});

test('item 2: reviews written before an openspec/-only commit are still met', () => {
  const root = base();
  const sha = head(root);
  put(root, withReviews(reviews(sha)));
  commitAll(root, 'reviews');
  assert.equal(reviewsItem(root, 'feat').status, 'met');
});

test('item 2: a product commit after the reviews lists the stale reviewers (AC-7)', () => {
  const root = base();
  const old = head(root);
  put(root, withReviews(reviews(old, { 'security-reviewer': review('approved', head(root)) })));
  commitAll(root, 'reviews');
  put(root, { 'src/a.ts': 'fix\n' });
  commitAll(root, 'code after reviews');
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.stale, ['code-quality-reviewer', 'security-reviewer', 'test-coverage-reviewer']);
  assert.ok(it.reason.includes('code-quality-reviewer') && it.reason.includes(old.slice(0, 7)), it.reason);
});

test('item 2: missing required reviewers, a rejected review and a missing Commit: line are open', () => {
  const root = base();
  put(root, withReviews({ 'code-quality-reviewer': review('approved', head(root)) }));
  let it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.missing, ['test-coverage-reviewer']);

  put(root, withReviews(reviews(head(root), { 'test-coverage-reviewer': review('rejected', head(root)) })));
  it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.rejected, ['test-coverage-reviewer']);
  assert.deepEqual(it.details.missing, []);

  put(root, withReviews(reviews(head(root), { 'test-coverage-reviewer': 'Verdict: approved\n\n# Review\n' })));
  it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.stale, ['test-coverage-reviewer']);
  assert.match(it.reason, /no Commit/);
});

test('item 2: no reviews directory means both required reviewers are missing', () => {
  const root = base();
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.missing, ['code-quality-reviewer', 'test-coverage-reviewer']);
});

test('item 2: declined is accepted when its Commit: is current, and stale otherwise', () => {
  const root = base();
  const sha = head(root);
  put(root, withReviews(reviews(sha, { 'security-reviewer': review('declined', sha) })));
  assert.equal(reviewsItem(root, 'feat').status, 'met');
  put(root, { 'src/a.ts': 'later\n' });
  commitAll(root, 'code');
  assert.deepEqual(reviewsItem(root, 'feat').details.stale.includes('security-reviewer'), true);
});

test('item 2: uncommitted product work makes every review stale', () => {
  const root = base();
  put(root, withReviews(reviews(head(root))));
  put(root, { 'src/a.ts': 'wip\n' });
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.stale, ['code-quality-reviewer', 'test-coverage-reviewer']);
});

// ---------------------------------------------------------------- item 1: tasks and gates (D4)

const gateRow = (cmd, result) => `| 1.4 | \`${cmd}\` | ${result} |\n`;
const evidenceFile = (sha, rows = '') => `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${rows}`;
const ev = (root, content) => put(root, { 'openspec/changes/feat/evidence.md': content });
const tasksOf = (lines) => ({ 'openspec/changes/feat/tasks.md': `# Tasks\n\n## 1. Phase\n\n${lines.join('\n')}\n` });

test('item 1: unticked task ids are listed', () => {
  const root = base();
  put(root, tasksOf(['- [x] 1.1 done', '- [ ] 1.2 todo', '- [ ] 2.1 later', '- [X] 2.2 done too']));
  const it = tasksItem(root, 'feat');
  assert.equal(it.id, 1);
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.unticked, ['1.2', '2.1']);
  assert.match(it.reason, /1\.2, 2\.1/);
});

test('item 1: met when everything is ticked and each gate sub-command has a passing row at a current commit', () => {
  const root = base();
  put(root, tasksOf(['- [x] 1.1 code', '- [x] 1.4 Gate: `node --test a.mjs && python3 scripts/check.py` green; covers AC-1']));
  ev(root, evidenceFile(head(root), gateRow('node --test a.mjs', 'pass: 30 tests') + gateRow('python3 scripts/check.py', 'pass: ok')));
  const it = tasksItem(root, 'feat');
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details, { unticked: [], missingGates: [], evidence: 'current' });
});

test('item 1: a gate sub-command without a passing row is open (missing, failing, or no row at all)', () => {
  const tasks = tasksOf(['- [x] 1.4 Gate: `node --test a.mjs && python3 scripts/check.py`']);
  for (const [label, rows, missing] of [
    ['one part missing', gateRow('node --test a.mjs', 'pass: ok'), ['python3 scripts/check.py']],
    ['one part failing', gateRow('node --test a.mjs', 'pass: ok') + gateRow('python3 scripts/check.py', 'fail: 2 problems'), ['python3 scripts/check.py']],
    ['no rows', '', ['node --test a.mjs', 'python3 scripts/check.py']],
  ]) {
    const root = base();
    put(root, tasks);
    ev(root, evidenceFile(head(root), rows));
    const it = tasksItem(root, 'feat');
    assert.equal(it.status, 'open', label);
    assert.deepEqual(it.details.missingGates, missing, label);
  }
});

test('item 1: missing or stale evidence is open', () => {
  const root = base();
  put(root, tasksOf(['- [x] 1.4 Gate: `node --test a.mjs`']));
  let it = tasksItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.equal(it.details.evidence, 'missing');
  const sha = head(root);
  ev(root, evidenceFile(sha, gateRow('node --test a.mjs', 'pass: ok')));
  commitAll(root, 'evidence');
  assert.equal(tasksItem(root, 'feat').status, 'met');
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'code after evidence');
  it = tasksItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.equal(it.details.evidence, 'stale');
  assert.match(it.reason, new RegExp(sha.slice(0, 7)));
});

test('item 1: no tasks.md, or a gate task without a backticked command, is blocked', () => {
  const root = base();
  fsRm(join(root, 'openspec/changes/feat/tasks.md'));
  let it = tasksItem(root, 'feat');
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /tasks\.md/);
  put(root, tasksOf(['- [x] 1.1 code', '- [x] 1.2 Gate: tests green']));
  it = tasksItem(root, 'feat');
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /1\.2/);
});

test('item 1: lines that are not checkbox tasks never count', () => {
  const root = base();
  put(root, tasksOf(['Gate: `echo not a task`', '- [x] 1.1 code', 'Notes - [ ] 9.9 not at line start']));
  ev(root, evidenceFile(head(root)));
  assert.equal(tasksItem(root, 'feat').status, 'met');
});

test('parseTasks: only a description that starts with Gate: is a gate; a mid-sentence `Gate:` is not', () => {
  const tasks = parseTasks([
    '## 1. Phase',
    '- [x] 1.1 Parse the first backticks after `Gate:` and split on `&&`',
    '- [ ] 1.2 Gate: `node --test a.mjs && python3 scripts/check.py` green',
    '* [x] 1.3 Notes mention Gate: `echo no` in passing',
  ].join('\n'));
  assert.deepEqual(tasks.map((t) => [t.id, t.isGate, t.command]), [
    ['1.1', false, null],
    ['1.2', true, 'node --test a.mjs && python3 scripts/check.py'],
    ['1.3', false, null],
  ]);
});

test('item 1: a task describing the Gate: rule yields no stray command, and repeated gates are listed once', () => {
  const root = base();
  const gate = '`node --test a.mjs && python3 scripts/check.py`';
  put(root, { 'openspec/changes/feat/tasks.md': [
    '# Tasks', '', '## 1. One',
    '- [x] 1.1 Take the first backticks after `Gate:` and split on `&&`',
    `- [x] 1.2 Gate: ${gate} green`, '',
    '## 2. Two',
    `- [x] 2.1 Gate: ${gate} green`, '',
    '## 3. Three',
    `- [x] 3.1 Gate: ${gate} green`,
    '- [x] 3.2 Gate: `python3 scripts/other.py`', '',
  ].join('\n') });
  let it = tasksItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.missingGates, ['node --test a.mjs', 'python3 scripts/check.py', 'python3 scripts/other.py']);
  assert.ok(!it.reason.includes('and split on'));
  assert.equal(it.reason.split('node --test a.mjs').length - 1, 1);
  ev(root, evidenceFile(head(root), gateRow('node --test a.mjs', 'pass') + gateRow('python3 scripts/check.py', 'pass') + gateRow('python3 scripts/other.py', 'pass')));
  it = tasksItem(root, 'feat');
  assert.equal(it.status, 'met', it.reason);
  assert.match(it.reason, /3 gate commands green/);
});

test('readPhases: each phase reports its real gate, not a task that merely mentions Gate:', () => {
  const root = base();
  put(root, { 'openspec/changes/feat/tasks.md': [
    '# Tasks', '', '## 1. One',
    '- [ ] 1.1 Split on `&&` after `Gate:` as the rule says',
    '- [ ] 1.2 Gate: `node --test a.mjs`', '',
    '## 2. Two',
    '- [ ] 2.1 Gate: `node --test a.mjs`', '',
  ].join('\n') });
  const phases = readPhases(join(root, 'openspec/changes/feat/tasks.md'));
  assert.deepEqual(phases.map((p) => [p.n, p.open, p.gate.id, p.gate.command]), [
    [1, ['1.1'], '1.2', 'node --test a.mjs'],
    [2, [], '2.1', 'node --test a.mjs'],
  ]);
});

// ---------------------------------------------------------------- item 3: findings disposed (D4, D5)

const findings = (lines) => `Verdict: rejected\nCommit: ${'a'.repeat(40)}\n\n# Findings\n\n${lines.join('\n')}\n`;

test('item 3: blocking and important findings need a fixed-in sha or a refutation; nits and praise are ignored', () => {
  const root = base();
  const fixed = head(root);
  put(root, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': findings([
      `- [blocking] null deref in parse() · fixed in ${fixed.slice(0, 7)}`,
      '- [important] name is misleading · refuted: renaming breaks the public API (see design D3)',
      '- [nit] spacing',
      '- [praise] good tests',
    ]),
  });
  const it = findingsItem(root, 'feat');
  assert.equal(it.id, 3);
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details, { fixed: 1, refuted: 1, undisposed: [] });
});

test('item 3: an undisposed finding lists reviewer and excerpt; a fix sha outside history does not count', () => {
  const root = base();
  const sha = head(root);
  put(root, {
    'openspec/changes/feat/reviews/code-quality-reviewer.md': findings([
      '- [blocking] leaks a handle',
      '1. [important] missing edge case · fixed in 0123456789abcdef0123456789abcdef01234567',
      `* **[important]** empty refutation · refuted:`,
      `- [blocking] good one · fixed in ${sha}`,
    ]),
    'openspec/changes/feat/reviews/test-coverage-reviewer.md': findings(['- [important] no test for AC-7']),
  });
  const it = findingsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.equal(it.details.fixed, 1);
  assert.deepEqual(it.details.undisposed.map((u) => u.reviewer), ['code-quality-reviewer', 'code-quality-reviewer', 'code-quality-reviewer', 'test-coverage-reviewer']);
  assert.match(it.reason, /code-quality-reviewer: .*leaks a handle/);
  assert.match(it.reason, /test-coverage-reviewer: .*no test for AC-7/);
});

test('item 3: no reviews, or reviews without findings, are met', () => {
  const root = base();
  assert.equal(findingsItem(root, 'feat').status, 'met');
  put(root, withReviews(reviews(head(root))));
  assert.equal(findingsItem(root, 'feat').status, 'met');
});

// ---------------------------------------------------------------- item 4: acceptance criteria proven (D4)

const proposalWith = (ids, extra = '') => `# Proposal\n\n## Why\n\nSee AC-99 elsewhere.\n\n## Acceptance criteria\n\n${ids.map((i) => `- ${i}: something`).join('\n')}\n\n## Impact\n\nMentions AC-98.\n${extra}`;
const acRow = (id, result) => `| ${id} | proof | ${result} |\n`;
const acEvidence = (sha, rows) => `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${rows}`;
const changeFiles = (files) => Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/feat/${f}`, b]));

test('item 4: met when every id has a pass or verified row at a current commit', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1', 'AC-2']) }));
  ev(root, acEvidence(head(root), acRow('AC-1', 'pass: test x') + acRow('AC-2', 'verified: read it')));
  const it = acceptanceItem(root, 'feat');
  assert.equal(it.id, 4);
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details.ids, ['AC-1', 'AC-2']);
});

test('item 4: ids come only from the Acceptance criteria section of the proposal', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1']) }));
  ev(root, acEvidence(head(root), acRow('AC-1', 'pass: ok')));
  assert.deepEqual(acceptanceItem(root, 'feat').details.ids, ['AC-1'], 'AC-99 and AC-98 sit in other sections');
});

test('item 4: falls back to requirements.md when the proposal has no ids or no file', () => {
  for (const proposal of [undefined, '# Proposal\n\n## Acceptance criteria\n\nSee requirements.\n']) {
    const root = base();
    put(root, changeFiles({ 'requirements.md': '# Requirements\n\n## Acceptance criteria\n\n- AC-3: x\n- AC-4: y\n\n## Scope\n', ...(proposal ? { 'proposal.md': proposal } : {}) }));
    ev(root, acEvidence(head(root), acRow('AC-3', 'pass: ok')));
    const it = acceptanceItem(root, 'feat');
    assert.deepEqual(it.details.ids, ['AC-3', 'AC-4']);
    assert.deepEqual(it.details.missing, ['AC-4']);
    assert.equal(it.status, 'open');
  }
});

test('item 4: AC-1 is not proven by a row for AC-12, and AC-12 is not proven by AC-1', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1', 'AC-12']) }));
  ev(root, acEvidence(head(root), acRow('AC-12', 'pass: ok')));
  let it = acceptanceItem(root, 'feat');
  assert.deepEqual(it.details.missing, ['AC-1']);
  ev(root, acEvidence(head(root), acRow('AC-1', 'pass: ok')));
  it = acceptanceItem(root, 'feat');
  assert.deepEqual(it.details.missing, ['AC-12']);
  assert.equal(it.status, 'open');
});

test('item 4: a fail or defect row is open even beside a pass row', () => {
  for (const bad of ['fail: wrong output', 'defect: crashes']) {
    const root = base();
    put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1', 'AC-2']) }));
    ev(root, acEvidence(head(root), acRow('AC-1', 'pass: ok') + acRow('AC-2', 'pass: ok') + acRow('AC-2', bad)));
    const it = acceptanceItem(root, 'feat');
    assert.equal(it.status, 'open', bad);
    assert.deepEqual(it.details.defects, ['AC-2']);
  }
});

test('item 4: an id with only "no proof" rows is blocked; a pass row beside it clears it', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1']) }));
  ev(root, acEvidence(head(root), acRow('AC-1', 'no proof: needs a human with a phone')));
  let it = acceptanceItem(root, 'feat');
  assert.equal(it.status, 'blocked');
  assert.deepEqual(it.details.noProof, ['AC-1']);
  ev(root, acEvidence(head(root), acRow('AC-1', 'no proof: x') + acRow('AC-1', 'pass: later')));
  assert.equal(acceptanceItem(root, 'feat').status, 'met');
});

test('item 4: missing or stale evidence is open', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': proposalWith(['AC-1']) }));
  let it = acceptanceItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.equal(it.details.evidence, 'missing');
  ev(root, acEvidence(head(root), acRow('AC-1', 'pass: ok')));
  commitAll(root, 'evidence');
  assert.equal(acceptanceItem(root, 'feat').status, 'met');
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'code');
  it = acceptanceItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.equal(it.details.evidence, 'stale');
});

test('item 4: no AC ids anywhere is blocked', () => {
  const root = base();
  put(root, changeFiles({ 'proposal.md': '# Proposal\n\n## Acceptance criteria\n\nnone\n' }));
  ev(root, acEvidence(head(root), ''));
  const it = acceptanceItem(root, 'feat');
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /no acceptance criteria/i);
});

// ---------------------------------------------------------------- fake gh (D9)

const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = process.env.FAKE_GH_DIR;
const args = process.argv.slice(2);
const key = args[0] === 'api' ? 'api-' + args[1] : args[0] + '-' + args[1] + (args.includes('--watch') ? '-watch' : '');
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify(args) + '\\n');
const counter = path.join(dir, key + '.count');
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1;
fs.writeFileSync(counter, String(n));
const file = [key + '.' + n + '.json', key + '.json'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
if (!file) {
  process.stderr.write('fake gh: no fixture for "' + key + '" (call ' + n + '): ' + args.join(' ') + '\\n');
  process.exit(99);
}
const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
const finish = () => {
  if (fx.stdout !== undefined) process.stdout.write(typeof fx.stdout === 'string' ? fx.stdout : JSON.stringify(fx.stdout));
  if (fx.stderr) process.stderr.write(fx.stderr);
  process.exit(fx.exit === undefined ? 0 : fx.exit);
};
if (fx.sleep) setTimeout(finish, fx.sleep); else finish();
`;

// A gh on PATH answering from JSON fixtures: set('pr-view', { stdout, stderr, exit, sleep }, n?)
// writes pr-view.json (every call) or pr-view.<n>.json (that call only).
export function fakeGh() {
  const base = mkdtempSync(join(tmpdir(), 'devkit-gh-'));
  const bin = join(base, 'bin');
  const dir = join(base, 'fixtures');
  mkdirSync(bin);
  mkdirSync(dir);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  return {
    bin,
    dir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_DIR: dir },
    set(key, fixture, n) { writeFileSync(join(dir, n ? `${key}.${n}.json` : `${key}.json`), JSON.stringify(fixture)); },
    // Start counting calls to `key` from 1 again (per-call fixtures).
    resetCount(key) { fsRm(join(dir, `${key}.count`), { force: true }); },
    calls() {
      const f = join(dir, 'calls.log');
      return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
  };
}

const callGh = (gh, ...args) => spawnSync('gh', args, { env: gh.env, encoding: 'utf8' });

test('fake gh: answers from a fixture with stdout, stderr and exit code', () => {
  const gh = fakeGh();
  gh.set('pr-view', { stdout: { number: 7 } });
  gh.set('pr-checks', { stdout: '[]', stderr: 'warn\n', exit: 8 });
  let r = callGh(gh, 'pr', 'view', '--json', 'number');
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { number: 7 });
  r = callGh(gh, 'pr', 'checks', '7');
  assert.deepEqual([r.status, r.stdout, r.stderr], [8, '[]', 'warn\n']);
  assert.deepEqual(gh.calls(), [['pr', 'view', '--json', 'number'], ['pr', 'checks', '7']]);
});

test('fake gh: a per-call fixture wins for that call, then the default applies', () => {
  const gh = fakeGh();
  gh.set('pr-checks', { stdout: 'default' });
  gh.set('pr-checks', { stdout: 'first', exit: 8 }, 1);
  assert.deepEqual(['first', 'default', 'default'].map(() => callGh(gh, 'pr', 'checks').stdout), ['first', 'default', 'default']);
});

test('fake gh: a missing fixture fails loudly (exit 99, names the key)', () => {
  const gh = fakeGh();
  const r = callGh(gh, 'api', 'graphql', '-f', 'query=x');
  assert.equal(r.status, 99);
  assert.match(r.stderr, /no fixture for "api-graphql"/);
  const w = callGh(gh, 'pr', 'checks', '7', '--watch');
  assert.match(w.stderr, /no fixture for "pr-checks-watch"/);
});

test('fake gh: sleep delays the answer', () => {
  const gh = fakeGh();
  gh.set('pr-view', { stdout: 'ok', sleep: 300 });
  const t = Date.now();
  assert.equal(callGh(gh, 'pr', 'view').stdout, 'ok');
  assert.ok(Date.now() - t >= 250);
});

// ---------------------------------------------------------------- item 5: PR open at local head (D4)

const PR_FIELDS = 'number,url,state,headRefOid,baseRefName,mergeable,body';
const prJson = (over = {}) => ({ number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE', body: '', ...over });
// A repo with the change and a fake gh answering `pr view` with `over` (headRefOid defaults to HEAD).
function withPr(over, { root = base() } = {}) {
  const gh = fakeGh();
  if (over !== null) gh.set('pr-view', { stdout: prJson({ headRefOid: head(root), ...over }) });
  return { root, gh, run: makeGh(root, gh.env) };
}
const pr5 = ({ root, run }) => prItem(root, 'feat', fetchPr(run), gitFacts(root));

test('item 5: no pull request for the branch is open, not blocked', () => {
  const t = withPr(null);
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  const it = pr5(t);
  assert.equal(it.id, 5);
  assert.equal(it.status, 'open');
  assert.equal(it.details.none, true);
  assert.match(it.reason, /no pull request/i);
});

test('item 5: an OPEN PR whose head is the local head is met; asks gh for the documented fields', () => {
  const t = withPr({});
  const it = pr5(t);
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(t.gh.calls(), [['pr', 'view', '--json', PR_FIELDS]]);
});

test('item 5: local commits ahead of the PR head are open', () => {
  const root = base();
  const prHead = head(root);
  put(root, { 'src/a.ts': 'ahead\n' });
  commitAll(root, 'local only');
  const it = pr5(withPr({ headRefOid: prHead }, { root }));
  assert.equal(it.status, 'open');
  assert.equal(it.details.ahead, true);
});

test('item 5: a PR head missing from local history is blocked, whether unknown or on another branch', () => {
  const root = base();
  assert.equal(pr5(withPr({ headRefOid: '0123456789abcdef0123456789abcdef01234567' }, { root })).status, 'blocked');
  git(root, 'switch', '-q', '-c', 'other');
  put(root, { 'src/other.ts': 'o\n' });
  const elsewhere = commitAll(root, 'other');
  git(root, 'switch', '-q', 'main');
  const it = pr5(withPr({ headRefOid: elsewhere }, { root }));
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /not in local history|someone else/i);
});

test('item 5: a CLOSED or MERGED PR, or a merge conflict, is blocked', () => {
  for (const over of [{ state: 'CLOSED' }, { state: 'MERGED' }, { mergeable: 'CONFLICTING' }]) {
    const it = pr5(withPr(over));
    assert.equal(it.status, 'blocked', JSON.stringify(over));
    assert.match(it.reason, /closed|merged|conflict/i);
  }
});

test('item 5: gh missing, not authenticated or failing is blocked with the error text', () => {
  const root = base();
  const nodeOnly = join(mkdtempSync(join(tmpdir(), 'devkit-nodeonly-')), 'bin');
  mkdirSync(nodeOnly);
  symlinkSync(process.execPath, join(nodeOnly, 'node'));
  let it = prItem(root, 'feat', fetchPr(makeGh(root, { ...process.env, PATH: nodeOnly })), gitFacts(root));
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /gh/);

  for (const [exit, stderr] of [[4, 'To get started with GitHub CLI, please run:  gh auth login\n'], [1, 'boom: network down\n']]) {
    const t = withPr(null);
    t.gh.set('pr-view', { exit, stderr });
    it = pr5(t);
    assert.equal(it.status, 'blocked', stderr);
    assert.ok(it.reason.includes(stderr.trim().split('\n')[0]), it.reason);
  }
});

test('item 5: uncommitted files in the change folder are open even when the heads match', () => {
  const t = withPr({});
  put(t.root, { 'openspec/changes/feat/evidence.md': 'new\n' });
  const it = pr5(t);
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.uncommitted, ['openspec/changes/feat/evidence.md']);
});

// ---------------------------------------------------------------- item 6: required checks (D4)

const check = (name, bucket, link = `https://ci/${name}`) => ({ name, state: bucket.toUpperCase(), bucket, link });
const pr6 = (t) => checksItem(fetchPr(t.run), t.run);
const argsOf = (t, cmd) => t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === cmd);

test('item 6: asks for --required first; all pass or skipping is met', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('lint', 'skipping')] });
  const it = pr6(t);
  assert.equal(it.id, 6);
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(argsOf(t, 'checks'), [['pr', 'checks', '12', '--required', '--json', 'name,state,bucket,link']]);
  assert.equal(it.details.required, true);
});

test('item 6: with no required checks, falls back to all checks', () => {
  for (const [first, label] of [[{ exit: 1, stderr: "no required checks reported on the 'ship/feat' branch\n" }, 'gh error'], [{ stdout: [] }, 'empty list']]) {
    const t = withPr({});
    t.gh.set('pr-checks', first, 1);
    t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'fail')] }, 2);
    const it = pr6(t);
    assert.equal(it.status, 'open', label);
    assert.deepEqual(argsOf(t, 'checks').map((c) => c.includes('--required')), [true, false], label);
    assert.equal(it.details.required, false);
    assert.deepEqual(it.details.failing.map((f) => f.name), ['e2e']);
  }
});

test('item 6: no checks at all is met, and says so', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stderr: "no required checks reported on the 'b' branch\n" }, 1);
  t.gh.set('pr-checks', { exit: 1, stderr: "no checks reported on the 'b' branch\n" }, 2);
  const it = pr6(t);
  assert.equal(it.status, 'met');
  assert.match(it.reason, /no checks reported/);
});

test('item 6: pending checks are open and named (gh exit 8)', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending'), check('lint', 'pending')] });
  const it = pr6(t);
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.pending, ['e2e', 'lint']);
  assert.deepEqual(it.details.failing, []);
  assert.match(it.reason, /pending e2e, lint/);
});

test('item 6: fail and cancel are open with names and links, even when gh exits 1 with the list', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stdout: [check('build', 'fail', 'https://ci/run/1'), check('lint', 'cancel', 'https://ci/run/2'), check('e2e', 'pending')] });
  const it = pr6(t);
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.failing, [{ name: 'build', link: 'https://ci/run/1' }, { name: 'lint', link: 'https://ci/run/2' }]);
  assert.deepEqual(it.details.pending, ['e2e']);
  assert.ok(it.reason.includes('build (https://ci/run/1)'), it.reason);
});

test('item 6: a gh error, an unknown bucket or unreadable output is blocked; no PR is open, not blocked', () => {
  let t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stderr: 'HTTP 502: bad gateway\n' });
  let it = pr6(t);
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /502/);

  t = withPr({});
  t.gh.set('pr-checks', { stdout: [check('build', 'weird')] });
  assert.equal(pr6(t).status, 'blocked');

  t = withPr({});
  t.gh.set('pr-checks', { stdout: 'not json' });
  assert.equal(pr6(t).status, 'blocked');

  t = withPr(null);
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "b"\n' });
  it = pr6(t);
  assert.equal(it.status, 'open');
  assert.equal(argsOf(t, 'checks').length, 0);

  t = withPr(null);
  t.gh.set('pr-view', { exit: 4, stderr: 'gh auth login\n' });
  assert.equal(pr6(t).status, 'blocked');
});

// ---------------------------------------------------------------- item 7: conversation answered (D4)

const who = (login, type = 'User') => ({ __typename: type, login });
// People are repo MEMBERs unless a test says otherwise; bots carry NONE.
const assoc = (author, a) => a ?? (author?.__typename === 'Bot' ? 'NONE' : 'MEMBER');
const thread = (resolved, author, at = '2026-01-02T00:00:00Z', url = 'https://gh/t1', a) => ({ isResolved: resolved, comments: { nodes: [{ author, authorAssociation: assoc(author, a), createdAt: at, url }] } });
const comment = (author, at, url = 'https://gh/c1', a) => ({ author, authorAssociation: assoc(author, a), createdAt: at, url });
const rev = (author, state, at, body = '', a) => ({ author, authorAssociation: assoc(author, a), state, submittedAt: at, body });
function conversation({ threads = [], comments = [], reviews = [], more = false, viewer = 'me' } = {}) {
  return { data: { viewer: { login: viewer }, repository: { pullRequest: {
    reviewThreads: { pageInfo: { hasNextPage: more }, nodes: threads },
    comments: { nodes: comments },
    reviews: { nodes: reviews },
  } } } };
}
const me = who('me');
const ann = who('ann');
const bot = who('coverage-bot', 'Bot');
const pr7 = (graphql) => {
  const t = withPr({});
  if (graphql) t.gh.set('api-graphql', { stdout: conversation(graphql) });
  return { t, it: conversationItem(fetchPr(t.run), t.run) };
};

test('item 7: nothing to answer is met; the query asks for the viewer and the PR number', () => {
  const { t, it } = pr7({});
  assert.equal(it.id, 7);
  assert.equal(it.status, 'met', it.reason);
  const call = t.gh.calls().find((c) => c[0] === 'api');
  assert.deepEqual(call.slice(0, 2), ['api', 'graphql']);
  assert.ok(call.some((a) => /viewer\s*{\s*login/.test(a)), 'queries viewer.login');
  assert.ok(call.includes('number=12'), 'passes the PR number');
});

test('item 7: an unresolved thread whose last comment is not the viewer is open; resolved or viewer-last is met', () => {
  assert.equal(pr7({ threads: [thread(false, ann)] }).it.status, 'open');
  assert.deepEqual(pr7({ threads: [thread(false, ann, undefined, 'https://gh/x')] }).it.details.threads, ['https://gh/x']);
  assert.equal(pr7({ threads: [thread(true, ann)] }).it.status, 'met');
  assert.equal(pr7({ threads: [thread(false, me)] }).it.status, 'met');
});

test('item 7: a bot\'s unresolved review thread counts like a person\'s', () => {
  assert.equal(pr7({ threads: [thread(false, bot)] }).it.status, 'open');
});

test('item 7: a person\'s top-level comment or review body newer than the viewer\'s latest is open', () => {
  const older = '2026-01-01T00:00:00Z';
  const newer = '2026-01-03T00:00:00Z';
  assert.equal(pr7({ comments: [comment(me, '2026-01-02T00:00:00Z'), comment(ann, newer)] }).it.status, 'open');
  assert.equal(pr7({ comments: [comment(ann, older), comment(me, '2026-01-02T00:00:00Z')] }).it.status, 'met');
  assert.equal(pr7({ comments: [comment(ann, older)] }).it.status, 'open', 'no word from the viewer yet');
  assert.equal(pr7({ reviews: [rev(ann, 'COMMENTED', newer, 'please look at this')], comments: [comment(me, '2026-01-02T00:00:00Z')] }).it.status, 'open');
  assert.equal(pr7({ reviews: [rev(ann, 'APPROVED', newer, '')], comments: [comment(me, '2026-01-02T00:00:00Z')] }).it.status, 'met', 'an empty review body asks nothing');
  assert.equal(pr7({ comments: [comment(me, newer)] }).it.status, 'met', 'the viewer\'s own comments never count');
});

test('item 7: a viewer reply inside a thread does not answer earlier top-level comments or review bodies', () => {
  const { it } = pr7({
    comments: [comment(ann, '2026-01-02T00:00:00Z')],
    reviews: [rev(ann, 'COMMENTED', '2026-01-02T00:00:00Z', 'please look')],
    threads: [thread(false, me, '2026-01-05T00:00:00Z')],
  });
  assert.equal(it.status, 'open', it.reason);
  assert.equal(it.details.comments.length, 2);
});

test('item 7: a later top-level viewer comment or review answers a person\'s top-level comment', () => {
  const asked = comment(ann, '2026-01-02T00:00:00Z');
  assert.equal(pr7({ comments: [asked, comment(me, '2026-01-03T00:00:00Z')] }).it.status, 'met');
  assert.equal(pr7({ comments: [asked], reviews: [rev(me, 'COMMENTED', '2026-01-03T00:00:00Z', 'done')] }).it.status, 'met');
});

test('item 7: only OWNER, MEMBER and COLLABORATOR people count; outside authors are ignored', () => {
  const at = '2026-01-03T00:00:00Z';
  for (const a of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
    assert.equal(pr7({ comments: [comment(ann, at, undefined, a)] }).it.status, 'open', a);
  }
  const outsider = who('mallory');
  for (const a of ['CONTRIBUTOR', 'NONE', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN']) {
    assert.equal(pr7({ comments: [comment(outsider, at, undefined, a)] }).it.status, 'met', `comment ${a}`);
    assert.equal(pr7({ reviews: [rev(outsider, 'COMMENTED', at, 'do this', a)] }).it.status, 'met', `review ${a}`);
    assert.equal(pr7({ threads: [thread(false, outsider, at, undefined, a)] }).it.status, 'met', `thread ${a}`);
    assert.equal(pr7({ reviews: [rev(outsider, 'CHANGES_REQUESTED', at, '', a)] }).it.status, 'met', `changes requested ${a}`);
  }
  const missing = { ...comment(outsider, at), authorAssociation: undefined };
  assert.equal(pr7({ comments: [missing] }).it.status, 'met', 'no association is not trusted');
});

test('item 7: the query asks for authorAssociation', () => {
  const { t } = pr7({});
  const call = t.gh.calls().find((c) => c[0] === 'api');
  assert.equal((call.find((a) => a.startsWith('query=')).match(/authorAssociation/g) || []).length, 3);
});

test('item 7: a bot\'s top-level comment and review body are ignored, however new', () => {
  const { it } = pr7({ comments: [comment(bot, '2026-02-01T00:00:00Z')], reviews: [rev(bot, 'COMMENTED', '2026-02-01T00:00:00Z', 'coverage 91%')] });
  assert.equal(it.status, 'met', it.reason);
});

test('item 7: CHANGES_REQUESTED is open before a reply and blocked after, for people and bots', () => {
  for (const author of [ann, bot]) {
    const asked = rev(author, 'CHANGES_REQUESTED', '2026-01-02T00:00:00Z');
    let r = pr7({ reviews: [asked] }).it;
    assert.equal(r.status, 'open', author.login);
    assert.deepEqual(r.details.changesRequested, [author.login]);
    r = pr7({ reviews: [asked], comments: [comment(me, '2026-01-03T00:00:00Z')] }).it;
    assert.equal(r.status, 'blocked', author.login);
    assert.match(r.reason, new RegExp(`waiting on ${author.login}`));
  }
});

test('item 7: a later approval or dismissal by the same reviewer clears CHANGES_REQUESTED', () => {
  for (const state of ['APPROVED', 'DISMISSED']) {
    const { it } = pr7({ reviews: [rev(ann, 'CHANGES_REQUESTED', '2026-01-02T00:00:00Z'), rev(ann, state, '2026-01-04T00:00:00Z')], comments: [comment(me, '2026-01-05T00:00:00Z')] });
    assert.equal(it.status, 'met', state);
  }
});

test('item 7: more than 100 threads is blocked', () => {
  const { it } = pr7({ more: true });
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /100/);
});

test('item 7: a gh error is blocked and no PR is open', () => {
  const t = withPr({});
  t.gh.set('api-graphql', { exit: 1, stderr: 'GraphQL: rate limited\n' });
  const it = conversationItem(fetchPr(t.run), t.run);
  assert.equal(it.status, 'blocked');
  assert.match(it.reason, /rate limited/);
  const none = withPr(null);
  none.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "b"\n' });
  assert.equal(conversationItem(fetchPr(none.run), none.run).status, 'open');
});

// ---------------------------------------------------------------- item 8: PR body complete (D4)

test('item 8: a body naming the change id, every AC id and the evidence link is met', () => {
  const body = 'Ship feat.\n- AC-1: x\n- AC-12: y\nEvidence: openspec/changes/feat/evidence.md\n';
  const it = bodyItem('feat', fetchPr(withPr({ body }).run), ['AC-1', 'AC-12']);
  assert.equal(it.id, 8);
  assert.equal(it.status, 'met', it.reason);
});

test('item 8: lists what the body misses; AC-1 is not covered by AC-12', () => {
  const none = bodyItem('feat', fetchPr(withPr({ body: 'AC-12 only' }).run), ['AC-1', 'AC-12']);
  assert.equal(none.status, 'open');
  assert.deepEqual(none.details.missing, ['feat', 'AC-1', 'openspec/changes/feat/evidence.md']);
  assert.match(none.reason, /AC-1/);
  const ok = bodyItem('feat', fetchPr(withPr({ body: 'feat AC-1 openspec/changes/feat/evidence.md' }).run), ['AC-1']);
  assert.equal(ok.status, 'met');
});

test('item 8: no PR is open and a gh error is blocked', () => {
  const t = withPr(null);
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "b"\n' });
  assert.equal(bodyItem('feat', fetchPr(t.run), []).status, 'open');
  t.gh.set('pr-view', { exit: 1, stderr: 'boom\n' });
  assert.equal(bodyItem('feat', fetchPr(t.run), []).status, 'blocked');
});

// ---------------------------------------------------------------- nextStep and summary (D4)

const BASE_DETAILS = {
  1: { unticked: [], missingGates: [], evidence: 'current' },
  2: { stale: [], rejected: [], missing: [] },
  3: { fixed: 0, refuted: 0, undisposed: [] },
  4: { ids: ['AC-1'], proven: ['AC-1'], missing: [], defects: [], noProof: [], evidence: 'current' },
  5: { pr: { number: 12, url: 'u' }, ahead: false, uncommitted: [] },
  6: { required: true, failing: [], pending: [] },
  7: { threads: [], comments: [], changesRequested: [], waiting: [] },
  8: { missing: [] },
};
// A state where all eight items are met; `over.items[n]` = { status, details } merges into item n.
function state(over = {}) {
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: n, name: `item${n}`, status: 'met', reason: `item ${n} reason`,
    ...over.items?.[n], details: { ...BASE_DETAILS[n], ...over.items?.[n]?.details },
  }));
  const { items: _ignored, ...rest } = over;
  return {
    id: 'feat', schema: 'devkit-lite', ship: 'pr', branchOk: true, needsReadiness: false, readiness: null,
    phases: [{ n: 1, title: 'One', open: [], gate: { id: '1.2', done: true, command: 'npm test' } }],
    dirty: [], reviewMd: null,
    reviews: [{ name: 'code-quality-reviewer', verdict: 'APPROVED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
    pr: { number: 12, url: 'u' },
    ...rest, items,
  };
}
const open = (details = {}) => ({ status: 'open', details });
const blocked = (details = {}) => ({ status: 'blocked', details });

test('nextStep: all eight met is ready (row 21)', () => {
  assert.equal(nextStep(state()).step, 'ready');
});

test('nextStep row 1: a schema whose ship mode is plan stops, before anything else (AC-1)', () => {
  const n = nextStep(state({ ship: 'plan', branchOk: false, dirty: ['src/a.ts'] }));
  assert.equal(n.step, 'stop-plan-mode');
  assert.match(n.reason, /plan/);
});

test('nextStep row 2: a branch that does not select the change stops', () => {
  assert.equal(nextStep(state({ branchOk: false })).step, 'stop-branch');
});

test('nextStep row 3: a devkit change without APPROVED readiness stops (AC-3); devkit-lite is not asked', () => {
  const n = nextStep(state({ schema: 'devkit', needsReadiness: true, readiness: 'NEEDS-REVISION' }));
  assert.equal(n.step, 'stop-not-approved');
  assert.match(n.reason, /NEEDS-REVISION/);
  assert.equal(nextStep(state({ schema: 'devkit', needsReadiness: true, readiness: 'APPROVED' })).step, 'ready');
  assert.equal(nextStep(state({ needsReadiness: false, readiness: null })).step, 'ready');
  assert.match(nextStep(state({ needsReadiness: true, readiness: null })).reason, /missing/);
});

test('nextStep row 4: the first phase with an unticked non-gate task is implemented, never a later one', () => {
  const phases = [
    { n: 1, title: 'One', open: [], gate: { id: '1.2', done: true, command: 'a' } },
    { n: 2, title: 'Two', open: ['2.1'], gate: { id: '2.2', done: false, command: 'b' } },
    { n: 3, title: 'Three', open: ['3.1'], gate: { id: '3.2', done: false, command: 'c' } },
  ];
  const n = nextStep(state({ phases }));
  assert.deepEqual([n.step, n.phase], ['implement', 2]);
});

test('nextStep row 5: a phase whose tasks are ticked but whose gate is not runs the gate', () => {
  const phases = [
    { n: 1, title: 'One', open: [], gate: { id: '1.2', done: false, command: 'npm test' } },
    { n: 2, title: 'Two', open: ['2.1'], gate: { id: '2.2', done: false, command: 'b' } },
  ];
  const n = nextStep(state({ phases }));
  assert.deepEqual([n.step, n.phase, n.task, n.command], ['gate', 1, '1.2', 'npm test']);
});

test('nextStep row 6: uncommitted changes outside openspec/ are committed first', () => {
  const n = nextStep(state({ dirty: ['src/a.ts'], items: { 2: open({ stale: ['code-quality-reviewer'] }) } }));
  assert.equal(n.step, 'commit');
});

const rejectedState = (over = {}) => state({
  reviewMd: { consensus: 'FAIL', round: 1 },
  reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
  items: { 2: open({ rejected: ['code-quality-reviewer'] }), 3: open({ undisposed: [{ reviewer: 'code-quality-reviewer', excerpt: '[blocking] x' }] }) },
  ...over,
});

test('nextStep row 8: a rejected review at a current commit goes to fix-review with its findings', () => {
  const n = nextStep(rejectedState());
  assert.equal(n.step, 'fix-review');
  assert.deepEqual(n.reviewers, ['code-quality-reviewer']);
  assert.deepEqual(n.findings, [{ reviewer: 'code-quality-reviewer', excerpt: '[blocking] x' }]);
});

test('nextStep row 7: FAIL (round 2/2) with a current rejected review stops (AC-4)', () => {
  const n = nextStep(rejectedState({ reviewMd: { consensus: 'FAIL', round: 2 } }));
  assert.equal(n.step, 'stop-review-deadlock');
  assert.match(n.reason, /code-quality-reviewer/);
});

test('nextStep rows 7 and 9: after a later product commit the rejected review is stale, so the run resumes as round 1 (AC-5)', () => {
  const n = nextStep(state({
    reviewMd: { consensus: 'FAIL', round: 2 },
    reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: false }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: false }],
    items: { 2: open({ stale: ['code-quality-reviewer', 'test-coverage-reviewer'], rejected: ['code-quality-reviewer'] }) },
  }));
  assert.deepEqual([n.step, n.round], ['review', 1]);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
});

test('nextStep row 9: after FAIL (round 1/2) and a fix commit the rejected reviewer is re-run as round 2', () => {
  const n = nextStep(state({
    reviewMd: { consensus: 'FAIL', round: 1 },
    reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: false }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: false }],
    items: { 2: open({ stale: ['code-quality-reviewer', 'test-coverage-reviewer'], rejected: ['code-quality-reviewer'] }) },
  }));
  assert.deepEqual([n.step, n.round], ['review', 2]);
});

test('nextStep row 9: reviewers stale only after an approval re-run at round 1, and only the stale ones (AC-7)', () => {
  const n = nextStep(state({
    reviewMd: { consensus: 'FAIL', round: 1 },
    reviews: [{ name: 'code-quality-reviewer', verdict: 'APPROVED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: false }],
    items: { 2: open({ stale: ['test-coverage-reviewer'] }) },
  }));
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 1, ['test-coverage-reviewer']]);
  const first = nextStep(state({ reviewMd: null, items: { 2: open({ stale: ['test-coverage-reviewer'] }) } }));
  assert.equal(first.round, 1);
});

test('nextStep row 9: missing reviewers and approved reviewers with undisposed findings are reviewed', () => {
  let n = nextStep(state({ reviews: [], items: { 2: open({ missing: ['code-quality-reviewer', 'test-coverage-reviewer'] }) } }));
  assert.deepEqual([n.step, n.reviewers], ['review', ['code-quality-reviewer', 'test-coverage-reviewer']]);
  n = nextStep(state({ items: { 3: open({ undisposed: [{ reviewer: 'security-reviewer', excerpt: '[important] y' }] }) } }));
  assert.deepEqual([n.step, n.reviewers], ['review', ['security-reviewer']]);
});

test('nextStep row 10: a fail or defect row at current evidence goes to fix-defect', () => {
  const n = nextStep(state({ items: { 4: open({ defects: ['AC-1'], proven: [] }) } }));
  assert.deepEqual([n.step, n.defects], ['fix-defect', ['AC-1']]);
});

test('nextStep row 11: missing or stale evidence, or a missing gate or AC row, goes to verify', () => {
  for (const items of [
    { 1: open({ evidence: 'missing' }) },
    { 1: open({ evidence: 'stale' }) },
    { 1: open({ missingGates: ['npm test'] }) },
    { 4: open({ evidence: 'stale' }) },
    { 4: open({ missing: ['AC-1'], proven: [] }) },
  ]) assert.equal(nextStep(state({ items })).step, 'verify', JSON.stringify(items));
});

test('nextStep row 11 before row 10: a defect row on stale evidence is verified again, not fixed', () => {
  assert.equal(nextStep(state({ items: { 4: open({ defects: ['AC-1'], evidence: 'stale' }) } })).step, 'verify');
});

test('nextStep row 12: a blocked item 1 to 4 stops with that item', () => {
  for (const n of [1, 2, 3, 4]) {
    const r = nextStep(state({ items: { [n]: blocked() } }));
    assert.deepEqual([r.step, r.item], ['blocked', n], `item ${n}`);
  }
});

test('nextStep row 13: no PR opens one (item 5 none)', () => {
  const n = nextStep(state({ pr: null, items: { 5: open({ none: true }), 6: open(), 7: open(), 8: open() } }));
  assert.equal(n.step, 'open-pr');
});

test('nextStep row 14: a blocked item 5 stops', () => {
  const n = nextStep(state({ items: { 5: blocked() } }));
  assert.deepEqual([n.step, n.item], ['blocked', 5]);
});

test('nextStep row 15: local ahead or uncommitted change files push', () => {
  assert.equal(nextStep(state({ items: { 5: open({ ahead: true }) } })).step, 'push');
  assert.equal(nextStep(state({ items: { 5: open({ uncommitted: ['openspec/changes/feat/evidence.md'] }) } })).step, 'push');
});

test('nextStep row 16: an incomplete PR body is edited', () => {
  const n = nextStep(state({ items: { 8: open({ missing: ['AC-1'] }) } }));
  assert.deepEqual([n.step, n.missing], ['edit-pr-body', ['AC-1']]);
});

test('nextStep row 17: failing checks go to fix-checks with names and links, before open conversation', () => {
  const failing = [{ name: 'build', link: 'https://ci/1' }];
  const n = nextStep(state({ items: { 6: open({ failing }), 7: open({ threads: ['https://gh/t'] }) } }));
  assert.deepEqual([n.step, n.failing], ['fix-checks', failing]);
});

test('nextStep row 18: an open conversation is answered, listing threads and comments', () => {
  const n = nextStep(state({ items: { 7: open({ threads: ['https://gh/t'], comments: ['https://gh/c'] }) } }));
  assert.deepEqual([n.step, n.threads, n.comments], ['answer', ['https://gh/t'], ['https://gh/c']]);
  assert.equal(nextStep(state({ items: { 7: open({ changesRequested: ['ann'] }) } })).step, 'answer');
});

test('nextStep row 19: a blocked item 6 or 7 stops', () => {
  assert.deepEqual(['blocked', 6], [nextStep(state({ items: { 6: blocked() } })).step, nextStep(state({ items: { 6: blocked() } })).item]);
  const n = nextStep(state({ items: { 7: blocked({ waiting: ['ann'] }) } }));
  assert.deepEqual([n.step, n.item], ['blocked', 7]);
});

test('nextStep row 20: pending checks wait', () => {
  const n = nextStep(state({ items: { 6: open({ pending: ['e2e'] }) } }));
  assert.deepEqual([n.step, n.pending], ['wait-checks', ['e2e']]);
});

test('nextStep: open work on a blocked-and-open item 7 is answered before the stop', () => {
  const n = nextStep(state({ items: { 7: blocked({ threads: ['https://gh/t'], waiting: ['ann'] }) } }));
  assert.equal(n.step, 'answer');
});

test('summarize: ready only at 8/8, else the lowest blocked item, else the lowest open item (AC-8)', () => {
  const sum = (items) => summarize(state({ items }).items);
  assert.deepEqual(sum({}), { met: 8, summary: 'ready' });
  assert.deepEqual(sum({ 2: open(), 5: open() }), { met: 6, summary: 'in progress: item 2' });
  assert.deepEqual(sum({ 2: open(), 6: blocked(), 7: blocked() }), { met: 5, summary: 'blocked: item 6' });
});

// ---------------------------------------------------------------- resume and walkthrough (AC-2, AC-5)

const TASKS = `# Tasks

## 1. First
- [ ] 1.1 code one
- [ ] 1.2 Gate: \`node -e 0\` green

## 2. Second
- [ ] 2.1 code two
- [ ] 2.2 code three
- [ ] 2.3 Gate: \`node -v && node -e 0\` green
`;
const tick = (root, ...ids) => {
  const f = join(root, 'openspec/changes/feat/tasks.md');
  let text = readFileSync(f, 'utf8');
  for (const id of ids) text = text.replace(`- [ ] ${id} `, `- [x] ${id} `);
  writeFileSync(f, text);
};
// A devkit-lite change `feat` with ship: pr, on branch ship/feat, committed.
function shipRepo() {
  const root = gitRepo({
    config: 'schema: devkit-lite\nship:\n  devkit-lite: pr\n',
    changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1', 'AC-2']), 'tasks.md': TASKS } },
    files: { 'src/a.ts': 'a\n' },
  });
  git(root, 'switch', '-q', '-c', 'ship/feat');
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '' };
  return { root, gh, env, next: () => nextStep(collectState(root, 'feat', { env })) };
}
// A schema `devkit` change `feat` (readiness artifact declared), ship: pr, on
// branch ship/feat, committed. Readiness and the branch are the variables.
function devkitRepo({ readiness = null, branch = 'ship/feat', others = [] } = {}) {
  const root = gitRepo({
    config: 'schema: devkit\nship:\n  devkit: pr\n',
    changes: Object.fromEntries([['feat', {
      '.openspec.yaml': 'schema: devkit\n',
      'proposal.md': proposalWith(['AC-1']),
      'tasks.md': '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n',
      ...(readiness === null ? {} : { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` }),
    }], ...others.map((o) => [o, { 'tasks.md': '- [ ] 1.1 x\n' }])]),
    files: {
      'src/a.ts': 'a\n',
      'openspec/schemas/devkit/schema.yaml': 'name: devkit\nversion: 1\nartifacts:\n  - id: readiness\n    generates: readiness.md\n',
    },
  });
  if (branch !== 'main') git(root, 'switch', '-q', '-c', branch);
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: `no pull requests found for branch "${branch}"\n` });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '' };
  return { root, gh, env, state: (over = {}) => collectState(root, 'feat', { env: { ...env, ...over } }) };
}

test('AC-3: a devkit change without readiness.md stops as not approved', () => {
  const { state } = devkitRepo();
  const s = state();
  assert.equal(s.needsReadiness, true);
  assert.equal(s.readiness, null);
  const next = nextStep(s);
  assert.equal(next.step, 'stop-not-approved');
  assert.match(next.reason, /missing/);
});

test('AC-3: a devkit change whose readiness Status is not APPROVED stops as not approved', () => {
  for (const status of ['BLOCKED', 'NEEDS_CHANGES', 'APPROVED | BLOCKED']) {
    const next = nextStep(devkitRepo({ readiness: status }).state());
    assert.equal(next.step, 'stop-not-approved', status);
  }
  assert.match(nextStep(devkitRepo({ readiness: 'BLOCKED' }).state()).reason, /BLOCKED/);
});

test('AC-3: an APPROVED readiness lets a devkit change proceed past the stop', () => {
  const s = devkitRepo({ readiness: 'APPROVED' }).state();
  assert.equal(s.readiness, 'APPROVED');
  assert.notEqual(nextStep(s).step, 'stop-not-approved');
  assert.notEqual(nextStep(s).step, 'stop-branch');
});

test('AC-3: a schema without a readiness artifact never asks for readiness.md', () => {
  const t = shipRepo();
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.needsReadiness, false);
});

test('CLI --json: a devkit change reports next.step stop-not-approved, then moves on when APPROVED', () => {
  const t = devkitRepo();
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.schema, 'devkit');
  assert.equal(j.next.step, 'stop-not-approved');
  put(t.root, { 'openspec/changes/feat/readiness.md': '# Readiness\n\n- Status: APPROVED\n' });
  assert.notEqual(JSON.parse(runCli(t, ['feat', '--json']).out).next.step, 'stop-not-approved');
});

test('branchOk: the default branch and an unrelated branch stop with stop-branch; the change branch does not', () => {
  const onMain = devkitRepo({ branch: 'main', readiness: 'APPROVED' }).state();
  assert.equal(onMain.branchOk, false);
  assert.equal(nextStep(onMain).step, 'stop-branch');
  const unrelated = devkitRepo({ branch: 'wip/other-thing', readiness: 'APPROVED', others: ['second'] }).state();
  assert.equal(unrelated.branchOk, false);
  assert.equal(nextStep(unrelated).step, 'stop-branch');
  const own = devkitRepo({ branch: 'ship/feat', readiness: 'APPROVED', others: ['second'] }).state();
  assert.equal(own.branchOk, true);
});

test('currentBranch: DEVKIT_BRANCH wins over GITHUB_HEAD_REF, which wins over the git branch', () => {
  const t = devkitRepo({ branch: 'wip/other-thing', readiness: 'APPROVED', others: ['second'] });
  assert.equal(t.state().branch, 'wip/other-thing');
  assert.equal(t.state({ GITHUB_HEAD_REF: 'ci/feat' }).branch, 'ci/feat');
  assert.equal(t.state({ GITHUB_HEAD_REF: 'ci/feat' }).branchOk, true);
  const both = t.state({ DEVKIT_BRANCH: 'ship/second', GITHUB_HEAD_REF: 'ci/feat' });
  assert.equal(both.branch, 'ship/second');
  assert.equal(both.branchOk, false);
  assert.equal(nextStep(both).step, 'stop-branch');
  assert.equal(t.state({ DEVKIT_BRANCH: 'main' }).branchOk, false, 'a default branch named by the env still stops');
});

const reviewAt = (root, names, sha = head(root)) => put(root, withReviews(Object.fromEntries(names.map((n) => [n, review('approved', sha)]))));
const fullEvidence = (root, env, sha = head(root)) => {
  const state = collectState(root, 'feat', { env });
  const cmds = state.phases.flatMap((p) => (p.gate ? p.gate.command.split('&&').map((c) => c.trim()) : []));
  ev(root, `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${cmds.map((c) => gateRow(c, 'pass: ok')).join('')}\n### Acceptance\n${acRow('AC-1', 'pass: t')}${acRow('AC-2', 'verified: r')}`);
};

test('resume: phase 1 gate ticked and phase 2 half done continues phase 2 and never redoes phase 1 (AC-5)', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1');
  const n = t.next();
  assert.deepEqual([n.step, n.phase], ['implement', 2]);
  tick(t.root, '2.2');
  const g = t.next();
  assert.deepEqual([g.step, g.phase, g.task, g.command], ['gate', 2, '2.3', 'node -v && node -e 0']);
});

test('resume: code committed with one review current runs only the other reviewer (AC-5, AC-7)', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  reviewAt(t.root, ['code-quality-reviewer']);
  let n = t.next();
  assert.deepEqual([n.step, n.reviewers, n.round], ['review', ['test-coverage-reviewer'], 1]);

  // both reviewed, then product code changes: only the reviewer left behind is stale
  const old = head(t.root);
  reviewAt(t.root, ['code-quality-reviewer', 'test-coverage-reviewer'], old);
  commitAll(t.root, 'reviews');
  put(t.root, { 'src/a.ts': 'fixed\n' });
  commitAll(t.root, 'fix after review');
  reviewAt(t.root, ['code-quality-reviewer']);
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', ['test-coverage-reviewer']]);
});

test('resume: reviews and evidence current and no PR opens the PR (AC-5)', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  reviewAt(t.root, ['code-quality-reviewer', 'test-coverage-reviewer']);
  fullEvidence(t.root, t.env);
  const n = t.next();
  assert.equal(n.step, 'open-pr', n.reason);
});

// Applies each step's effect until ready; returns the steps taken.
function driveToReady(t) {
  const taken = [];
  const prBody = 'feat\n- AC-1\n- AC-2\nopenspec/changes/feat/evidence.md\n';
  const setPr = () => {
    t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: prBody }) });
    t.gh.set('pr-checks', { stdout: [check('build', 'pass')] });
    t.gh.set('api-graphql', { stdout: conversation({}) });
  };
  for (let i = 0; i < 30; i++) {
    const state = collectState(t.root, 'feat', { env: t.env });
    const n = nextStep(state);
    taken.push(n.step);
    if (n.step === 'ready') break;
    assert.ok(!n.step.startsWith('stop-') && n.step !== 'blocked', `${n.step}: ${n.reason}`);
    switch (n.step) {
      case 'implement': {
        const phase = state.phases.find((p) => p.n === n.phase);
        put(t.root, { [`src/phase${n.phase}.ts`]: `export const p = ${n.phase};\n` });
        tick(t.root, ...phase.open);
        break;
      }
      case 'gate': tick(t.root, n.task); break;
      case 'commit': commitAll(t.root, 'code'); break;
      case 'review': reviewAt(t.root, n.reviewers); break;
      case 'verify': fullEvidence(t.root, t.env); break;
      case 'open-pr': commitAll(t.root, 'ship change files'); setPr(); break;
      default: assert.fail(`unexpected step ${n.step}: ${n.reason}`);
    }
  }
  return taken;
}

test('walkthrough: a devkit-lite change goes from no ticked task to ready without a stop step (AC-2)', () => {
  assert.deepEqual(driveToReady(shipRepo()), ['implement', 'gate', 'implement', 'gate', 'commit', 'review', 'verify', 'open-pr', 'ready']);
});

test('resume: a round-2 deadlock on disk stops while current and re-reviews as round 1 after the owner\'s product commit (AC-4, AC-5)', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  put(t.root, withReviews({ 'code-quality-reviewer': review('rejected', head(t.root)), 'test-coverage-reviewer': review('approved', head(t.root)) }));
  put(t.root, changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\n## Next\nFix.\n\nConsensus: FAIL (round 2/2)\n' }));
  let n = t.next();
  assert.equal(n.step, 'stop-review-deadlock');
  put(t.root, { 'src/a.ts': 'owner fixed it by hand\n' });
  commitAll(t.root, 'owner fix');
  n = t.next();
  assert.deepEqual([n.step, n.round], ['review', 1]);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
});

// ---------------------------------------------------------------- CLI (D4, AC-6, AC-10)

const cli = join(here, 'deliver-check.mjs');
function runCli(t, args, { env = {}, cwd = t.root } = {}) {
  const r = spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8', env: { ...t.env, DEVKIT_HOST: 'cli', CLAUDE_CODE_ENTRYPOINT: '', ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('CLI: eight item lines, the N/8 summary and next', () => {
  const t = shipRepo();
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 1);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], /^deliver-check: feat \(schema devkit-lite, ship pr, host cli, head [0-9a-f]{7}\)$/);
  const itemLines = lines.filter((l) => /^ {2}[1-8] (met|open|blocked)\s+\S/.test(l));
  assert.equal(itemLines.length, 8, r.out);
  assert.match(lines.at(-2), /^\d\/8 met: in progress: item 1$/);
  assert.match(lines.at(-1), /^next: implement/);
});

test('CLI --json carries the items, phases and next, with version 1', () => {
  const t = shipRepo();
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.version, 1);
  assert.deepEqual([j.change, j.schema, j.ship, j.host], ['feat', 'devkit-lite', 'pr', 'cli']);
  assert.equal(j.head, head(t.root));
  assert.equal(j.pr, null);
  assert.equal(j.items.length, 8);
  assert.deepEqual(Object.keys(j.items[0]).sort(), ['details', 'id', 'name', 'reason', 'status']);
  assert.equal(j.met + j.items.filter((i) => i.status !== 'met').length, 8);
  assert.equal(j.summary, 'in progress: item 1');
  assert.equal(j.next.step, 'implement');
  assert.deepEqual(j.phases[0], { n: 1, title: 'First', open: ['1.1'], gate: { id: '1.2', done: false, command: 'node -e 0' } });
});

test('CLI: exit 0 only at 8/8, with the PR in the JSON', () => {
  const t = shipRepo();
  driveToReady(t);
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.met, j.summary, j.next.step], [8, 'ready', 'ready']);
  assert.equal(j.pr.number, 12);
  assert.match(runCli(t, ['feat']).out, /^8\/8 met: ready$/m);
});

test('CLI: exit 2 when an item is blocked', () => {
  const t = shipRepo();
  t.gh.set('pr-view', { exit: 1, stderr: 'boom: network down\n' });
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 2);
  assert.match(r.out, /^ {2}5 blocked\s+PR open at local head: .*boom/m);
});

test('CLI: exit 3 for an unknown change, a missing id, no openspec/ and an archived-only change', () => {
  const t = shipRepo();
  assert.equal(runCli(t, ['nope']).code, 3);
  assert.match(runCli(t, ['nope']).err, /nope/);
  assert.equal(runCli(t, []).code, 3);
  for (const dots of ['.', '..']) {
    const r = runCli(t, [dots]);
    assert.equal(r.code, 3, dots);
    assert.match(r.err, /unknown change/, dots);
    assert.equal(runCli(t, [dots, '--json']).code, 3, dots);
  }
  mkdirSync(join(t.root, 'openspec/changes/archive/2026-01-01-gone'), { recursive: true });
  assert.equal(runCli(t, ['gone']).code, 3);
  const bare = mkdtempSync(join(tmpdir(), 'devkit-bare-'));
  const r = runCli(t, ['feat'], { cwd: bare });
  assert.equal(r.code, 3);
  assert.match(r.err, /openspec/);
});

test('CLI: runs from a subdirectory of the repo', () => {
  const t = shipRepo();
  assert.equal(runCli(t, ['feat'], { cwd: join(t.root, 'src') }).code, 1);
});

test('CLI: an invalid ship config is exit 3 with the AC-10 message, and { version, error } in JSON', () => {
  const t = shipRepo();
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship: { devkit-lite: merge }\n');
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 3);
  assert.match(r.err, /merge arrives in a later round \(round 2, auto-merge\)/);
  assert.equal(r.out, '');
  const j = runCli(t, ['feat', '--json']);
  assert.equal(j.code, 3);
  const parsed = JSON.parse(j.out);
  assert.equal(parsed.version, 1);
  assert.match(parsed.error, /merge arrives in a later round/);
  assert.deepEqual(Object.keys(parsed).sort(), ['error', 'version']);
});

test('CLI: DEVKIT_BYPASS=1 changes nothing', () => {
  const t = shipRepo();
  const plain = runCli(t, ['feat', '--json']);
  const bypass = runCli(t, ['feat', '--json'], { env: { DEVKIT_BYPASS: '1' } });
  assert.deepEqual(bypass, plain);
  assert.equal(runCli(t, ['feat'], { env: { DEVKIT_BYPASS: '1' } }).code, 1);
});

test('CLI: a plan-mode project reports stop-plan-mode, with the items still computed', () => {
  const t = shipRepo();
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\n');
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.ship, 'plan');
  assert.equal(j.next.step, 'stop-plan-mode');
});

// ---------------------------------------------------------------- host and watch (D7, AC-9)

test('host: app for the desktop entrypoint, cli otherwise, DEVKIT_HOST overrides', () => {
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop' }), 'app');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'cli' }), 'cli');
  assert.equal(detectHost({}), 'cli');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: 'cli' }), 'cli');
  assert.equal(detectHost({ DEVKIT_HOST: 'app' }), 'app');
  assert.equal(detectHost({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: 'nonsense' }), 'app');
});

test('CLI: host in the JSON follows the environment', () => {
  const t = shipRepo();
  const host = (env) => JSON.parse(runCli(t, ['feat', '--json'], { env }).out).host;
  assert.equal(host({ CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', DEVKIT_HOST: '' }), 'app');
  assert.equal(host({ DEVKIT_HOST: 'app' }), 'app');
  assert.equal(host({}), 'cli');
});

test('watchMinutes: default 9, capped at 30, positive numbers only', () => {
  assert.equal(watchMinutes(undefined), 9);
  assert.equal(watchMinutes(''), 9);
  assert.equal(watchMinutes('5'), 5);
  assert.equal(watchMinutes('0.5'), 0.5);
  assert.equal(watchMinutes('99'), 30);
  for (const bad of ['abc', '0', '-3', 'NaN', '1e999x']) assert.throws(() => watchMinutes(bad), /--watch/, bad);
});

// A shipped-ready change whose checks are still running.
function pendingChecks() {
  const t = shipRepo();
  driveToReady(t);
  const pending = [check('build', 'pass'), check('e2e', 'pending')];
  t.gh.set('pr-checks', { exit: 8, stdout: pending });
  t.gh.resetCount('pr-checks');
  return t;
}
const watchCalls = (t) => t.gh.calls().filter((c) => c.includes('--watch'));

test('CLI --watch: one gh pr checks --watch --interval 30 (required), then 8/8 when the checks turn green (AC-9)', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const r = runCli(t, ['feat', '--watch=1']);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^8\/8 met: ready$/m);
  assert.deepEqual(watchCalls(t), [['pr', 'checks', '12', '--watch', '--interval', '30', '--required']]);
});

test('CLI --watch: a watch that outlives its cap is killed and the result is in progress: item 6 (AC-9)', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, sleep: 20000 });
  const started = Date.now();
  const r = runCli(t, ['feat', '--watch=0.02']);
  assert.ok(Date.now() - started < 15000, 'the cap ended the watch');
  assert.equal(r.code, 1);
  assert.match(r.out, /^\d\/8 met: in progress: item 6$/m);
  assert.equal(watchCalls(t).length, 1, 'exactly one watch');
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.next.step, 'wait-checks');
});

test('CLI --watch: a bare --watch uses the default; --watch=abc is a usage error', () => {
  const t = pendingChecks();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  runCli(t, ['feat', '--watch']);
  assert.equal(watchCalls(t).length, 1);
  const bad = runCli(t, ['feat', '--watch=abc']);
  assert.equal(bad.code, 3);
  assert.match(bad.err, /--watch/);
});

test('CLI --watch: no PR, or a step before waiting, never starts a watch', () => {
  const t = shipRepo();
  runCli(t, ['feat', '--watch=1']);
  assert.equal(watchCalls(t).length, 0);
  const u = pendingChecks();
  put(u.root, { 'src/a.ts': 'dirty\n' });
  runCli(u, ['feat', '--watch=1']);
  assert.equal(watchCalls(u).length, 0, 'a commit is due before waiting makes sense');
});

test('CLI without --watch never watches', () => {
  const t = pendingChecks();
  runCli(t, ['feat']);
  assert.equal(watchCalls(t).length, 0);
});

// ---------------------------------------------------------------------------
// Format contracts: the agent and skill markdown that deliver-check parses
// (design D5, D8, D9). A rename here must fail a test, not a live run.
// ---------------------------------------------------------------------------

const repoRoot = join(here, '..', '..', '..');
const coreAgent = (name) => readFileSync(join(repoRoot, 'plugins', 'core', 'agents', `${name}.md`), 'utf8');

// The first fenced block under "## Output", as lines.
function outputBlock(md) {
  const start = md.indexOf('\n## Output');
  assert.ok(start >= 0, 'has an Output section');
  const m = md.slice(start).match(/```[^\n]*\n([\s\S]*?)\n```/);
  assert.ok(m, 'Output section has a fenced block');
  return m[1].split('\n');
}

const REVIEWERS = ['code-quality', 'test-coverage', 'security', 'architecture', 'adr', 'spec'].map((n) => `${n}-reviewer`);

for (const name of REVIEWERS) {
  test(`format: ${name} Output block has Verdict first and Commit: second`, () => {
    const lines = outputBlock(coreAgent(name));
    assert.match(lines[0], /^Verdict: /);
    assert.match(lines[1], /^Commit: <sha>/);
  });

  test(`format: ${name} documents the Commit line, its uncommitted marker, and dispositions`, () => {
    const md = coreAgent(name);
    const verdictFile = md.slice(md.indexOf('## Verdict file'), md.indexOf('\n## Output'));
    assert.match(verdictFile, /Commit: <sha>/);
    assert.match(verdictFile, /\(uncommitted changes\)/);
    assert.match(md, /· fixed in <sha>/);
    assert.match(md, /· refuted: /);
  });
}

test('format: security-reviewer declined output carries the Commit line', () => {
  const md = coreAgent('security-reviewer');
  const declined = md.split('\n').find((l) => /When declining/.test(l));
  assert.ok(declined, 'has the declining sentence');
  assert.match(declined, /Commit:/);
});

test('format: pr-verifier names the Commit line, the Gates table and the per-AC rows', () => {
  const md = coreAgent('pr-verifier');
  assert.match(md, /Commit: <sha>/);
  assert.match(md, /\(uncommitted changes\)/);
  assert.match(md, /### Gates/);
  assert.match(md, /split on `&&`/);
  assert.match(md, /no proof: <reason>/);
  assert.match(md, /\bpass\b[\s\S]*\bfail\b/);
});

test('format: commit-and-pr names commit-only, an open PR, and the PR body contents', () => {
  const md = coreAgent('commit-and-pr');
  assert.match(md, /commit-only/i);
  assert.match(md, /PR: none \(commit only\)/);
  assert.match(md, /already has an open PR/i);
  assert.match(md, /reviews are current at HEAD/);
  assert.match(md, /change id/);
  assert.match(md, /acceptance criterion id/i);
  assert.match(md, /evidence\.md/);
  assert.match(md, /Merge the PR, or enable auto-merge/, 'the Never list still forbids merging');
});

test('format: tdd-implementer reports the gate in Validation, not in evidence.md', () => {
  const md = coreAgent('tdd-implementer');
  const gate = md.slice(md.indexOf('## Stop at the phase gate'), md.indexOf('## Returns'));
  assert.doesNotMatch(gate, /evidence\.md/);
  assert.match(gate, /Validation section/);
  assert.match(gate, /coordinating skill/);
});

test('format: review-change defines stale by the Commit line, dispositions, scoped calls and rounds', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'), 'utf8');
  assert.match(md, /Commit:/);
  assert.match(md, /### Finding dispositions/);
  assert.match(md, /· fixed in <sha>/);
  assert.match(md, /· refuted: /);
  assert.match(md, /scoped call/i);
  assert.match(md, /starts at round 1/);
});

test('format: ship-change skill exists, says "Use when", and its deliver-check path resolves', () => {
  const dir = join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change');
  const skill = join(dir, 'SKILL.md');
  assert.ok(existsSync(skill), 'SKILL.md exists');
  const md = readFileSync(skill, 'utf8');
  assert.match(md, /^---\nname: ship-change\n/);
  assert.match(md, /description: [^\n]*Use when/);
  const rel = '../../hooks/deliver-check.mjs';
  assert.ok(md.includes(rel), 'names the relative path');
  assert.ok(existsSync(join(dir, rel)), 'the path resolves from the skill directory');
});

test('format: ship-change names every next.step the checker can return', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const steps = ['stop-plan-mode', 'stop-branch', 'stop-not-approved', 'implement', 'gate', 'commit', 'stop-review-deadlock', 'fix-review', 'review', 'fix-defect', 'verify', 'blocked', 'open-pr', 'push', 'edit-pr-body', 'fix-checks', 'answer', 'wait-checks', 'ready'];
  for (const s of steps) assert.ok(md.includes(`\`${s}\``), `names step ${s}`);
});
