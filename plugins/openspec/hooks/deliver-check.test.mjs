// Tests for deliver-check.mjs. Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs both files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync as fsRm, chmodSync, readFileSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ghError } from './merge-setup.mjs';
import { parseShip, parseMergeMethod, shipConfig, SHIP_MODES, shipMode, ShipConfigError, parseCommitLine, gitFacts, staleness, reviewsItem, tasksItem, parseTasks, readPhases, findingsItem, acceptanceItem, makeGh, fetchPr, prItem, checksItem, conversationItem, bodyItem, nextStep, waitingFor, summarize, collectState, buildReport, detectHost, watchMinutes } from './deliver-check.mjs';

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

test('parseShip: merge is a mode now, in block and flow maps, for both schemas (AC-1)', () => {
  assert.deepEqual(SHIP_MODES, ['plan', 'pr', 'merge']);
  assert.deepEqual(parseShip('ship:\n  devkit-lite: merge\n'), { 'devkit-lite': 'merge' });
  assert.deepEqual(parseShip('ship: { devkit-lite: merge }\n'), { 'devkit-lite': 'merge' });
  assert.deepEqual(parseShip('ship:\n  devkit: merge\n'), { devkit: 'merge' });
  assert.deepEqual(parseShip('ship: {devkit: merge, devkit-lite: pr}\n'), { devkit: 'merge', 'devkit-lite': 'pr' });
});

test('parseMergeMethod: no key or an empty one is squash; the three methods are read with quotes and comments (AC-8)', () => {
  assert.equal(parseMergeMethod(''), 'squash');
  assert.equal(parseMergeMethod('schema: devkit\n'), 'squash');
  assert.equal(parseMergeMethod('merge_method:\n'), 'squash');
  assert.equal(parseMergeMethod('merge_method:   # default\ncontext: x\n'), 'squash');
  assert.equal(parseMergeMethod('merge_method: squash\n'), 'squash');
  assert.equal(parseMergeMethod('merge_method: merge\n'), 'merge');
  assert.equal(parseMergeMethod('merge_method: "rebase"  # linear\n'), 'rebase');
  assert.equal(parseMergeMethod("schema: devkit\nmerge_method: 'merge'\r\nship:\n"), 'merge');
  assert.equal(parseMergeMethod('context: |\n  merge_method: fast\n'), 'squash', 'an indented line is not the top-level key');
});

test('parseMergeMethod: an unknown value or a nested value is a ShipConfigError naming the key (AC-1)', () => {
  for (const text of ['merge_method: fast\n', 'merge_method: Squash\n', 'merge_method:\n  squash: yes\n', 'merge_method:\n  - squash\n', 'merge_method: { a: b }\n', 'merge_method: [squash]\n']) {
    assert.throws(() => parseMergeMethod(text), (e) => e instanceof ShipConfigError && e.message.startsWith('openspec/config.yaml: merge_method:') && /squash, merge or rebase/.test(e.message), text);
  }
  assert.throws(() => parseMergeMethod('merge_method: fast\n'), /merge_method: unknown value "fast"; use squash, merge or rebase/);
});

test('shipConfig: reads the mode for the schema and the method, and validates both keys whatever the schema (design D2)', () => {
  const ok = gitRepo({ config: 'schema: devkit\nship:\n  devkit: merge\nmerge_method: rebase\n' });
  assert.deepEqual(shipConfig(ok, 'devkit'), { ship: 'merge', mergeMethod: 'rebase' });
  assert.deepEqual(shipConfig(ok, 'devkit-lite'), { ship: 'plan', mergeMethod: 'rebase' });
  assert.deepEqual(shipConfig(gitRepo({ config: null }), 'devkit'), { ship: 'plan', mergeMethod: 'squash' });
  const bad = gitRepo({ config: 'ship:\n  devkit: plan\nmerge_method: fast\n' });
  assert.throws(() => shipConfig(bad, 'devkit'), /merge_method: unknown value "fast"/, 'invalid even when the mode is plan');
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
  const root = gitRepo({ config: 'ship:\n  devkit-lite: pr\n  devkit: auto\n' });
  assert.throws(() => shipMode(root, 'devkit-lite'), /ship\.devkit: unknown mode "auto"; use plan, pr or merge/);
});

// ---------------------------------------------------------------- guard ignores ship (AC-1)

test('guard session, edit, bash and ci behave identically with and without ship (AC-1)', () => {
  const guard = join(here, 'guard.mjs');
  const root = gitRepo({ config: 'schema: devkit\n', changes: {
    feat: { '.openspec.yaml': 'schema: devkit\n', 'readiness.md': '- Status: APPROVED\n' },
  } });
  const env = { ...process.env, DEVKIT_BYPASS: '', DEVKIT_CHANGE: '', DEVKIT_BRANCH: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
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
const apiKey = () => {
  if (args[1] === 'graphql') return 'api-graphql';
  const x = args.indexOf('-X');
  const method = x >= 0 ? args[x + 1] : 'GET';
  const route = args.slice(1).find((a, i, all) => !a.startsWith('-') && all[i - 1] !== '-X' && all[i - 1] !== '-F' && all[i - 1] !== '-f' && all[i - 1] !== '--jq' && all[i - 1] !== '--input');
  return 'api-' + method + '-' + String(route).replace(/[\\/{}?]/g, '_');
};
const key = args[0] === 'api' ? apiKey() : args[0] + '-' + args[1] + (args.includes('--watch') ? '-watch' : '');
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

test('fake gh: api fixtures are keyed by method and path with / { } ? replaced by _ (auto-merge 2.1)', () => {
  const gh = fakeGh();
  gh.set('api-GET-repos__owner___repo__rules_branches_main', { stdout: '[]' });
  gh.set('api-PATCH-repos__owner___repo_', { stdout: '{}' });
  gh.set('api-GET-repos__owner___repo__contents_x.yml_ref=main', { stdout: 'q' });
  assert.equal(callGh(gh, 'api', 'repos/{owner}/{repo}/rules/branches/main').stdout, '[]');
  assert.equal(callGh(gh, 'api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'allow_auto_merge=true').stdout, '{}');
  assert.equal(callGh(gh, 'api', 'repos/{owner}/{repo}/contents/x.yml?ref=main').stdout, 'q', '? becomes _');
  assert.deepEqual(gh.calls()[1], ['api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'allow_auto_merge=true'], 'the log keeps the full args');
});

test('fake gh: api graphql keeps its key, and a missing api fixture fails loudly naming the key (auto-merge 2.1)', () => {
  const gh = fakeGh();
  gh.set('api-graphql', { stdout: 'g' });
  assert.equal(callGh(gh, 'api', 'graphql', '-f', 'query=x').stdout, 'g');
  const r = callGh(gh, 'api', 'repos/{owner}/{repo}');
  assert.equal(r.status, 99);
  assert.match(r.stderr, /no fixture for "api-GET-repos__owner___repo_"/);
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
const prJson = (over = {}) => ({ number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE', body: '', autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over });
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

test('nextStep row 1: a merge-mode change does not stop as plan mode (design D2)', () => {
  assert.equal(nextStep(state({ ship: 'merge' })).step, 'enable-auto-merge', 'at 8/8 merge mode enables auto-merge instead of reporting ready (row 21a)');
  assert.equal(nextStep(state({ ship: 'merge', dirty: ['src/a.ts'] })).step, 'commit');
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
// The fake gh answers of a repository ready for merge mode (auto-merge allowed, devkit-reviews required).
function presetSetup(gh, { repo = {}, rules = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }] } = {}) {
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true, ...repo } });
  gh.set('api-GET-repos__owner___repo__rules_branches_main', { stdout: rules });
  gh.set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' });
}
// A devkit-lite change `feat` with ship: pr, on branch ship/feat, committed.
function shipRepo({ ship = 'pr', method = '' } = {}) {
  const root = gitRepo({
    config: `schema: devkit-lite\nship:\n  devkit-lite: ${ship}\n${method ? `merge_method: ${method}\n` : ''}`,
    changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1', 'AC-2']), 'tasks.md': TASKS } },
    files: { 'src/a.ts': 'a\n', ...(ship === 'merge' ? { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' } : {}) },
  });
  git(root, 'switch', '-q', '-c', 'ship/feat');
  const gh = fakeGh();
  if (ship === 'merge') { presetSetup(gh); gh.set('pr-list', { stdout: [] }); }
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '' };
  return { root, gh, env, next: () => nextStep(collectState(root, 'feat', { env })) };
}
// A schema `devkit` change `feat` (readiness artifact declared), ship: pr, on
// branch ship/feat, committed. Readiness and the branch are the variables.
function devkitRepo({ readiness = null, branch = 'ship/feat', others = [], ship = 'pr' } = {}) {
  const root = gitRepo({
    config: `schema: devkit\nship:\n  devkit: ${ship}\n`,
    changes: Object.fromEntries([['feat', {
      '.openspec.yaml': 'schema: devkit\n',
      'proposal.md': proposalWith(['AC-1']),
      'tasks.md': '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n',
      ...(readiness === null ? {} : { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` }),
    }], ...others.map((o) => [o, { 'tasks.md': '- [ ] 1.1 x\n' }])]),
    files: {
      'src/a.ts': 'a\n',
      ...(ship === 'merge' ? { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' } : {}),
      'openspec/schemas/devkit/schema.yaml': 'name: devkit\nversion: 1\nartifacts:\n  - id: readiness\n    generates: readiness.md\n',
    },
  });
  if (branch !== 'main') git(root, 'switch', '-q', '-c', branch);
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: `no pull requests found for branch "${branch}"\n` });
  if (ship === 'merge') { presetSetup(gh); gh.set('pr-list', { stdout: [] }); }
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

const PR_BODY = 'feat\n- AC-1\n- AC-2\nopenspec/changes/feat/evidence.md\n';
// Applies each step's effect until ready; returns the steps taken.
function driveToReady(t) {
  const taken = [];
  const prBody = PR_BODY;
  const setPr = () => {
    t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: prBody }) });
    t.gh.set('pr-checks', { stdout: [check('build', 'pass')] });
    t.gh.set('api-graphql', { stdout: conversation({}) });
  };
  for (let i = 0; i < 30; i++) {
    const state = collectState(t.root, 'feat', { env: t.env });
    const n = nextStep(state);
    taken.push(n.step);
    if (['ready', 'enable-auto-merge'].includes(n.step)) break;
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

// ---------------------------------------------------------------- merge mode: facts and items (auto-merge 2.3, design D6)

const MERGE_FIELDS = `${PR_FIELDS},autoMergeRequest,mergeStateStatus`;
const prM = (t, opts = { merge: true }) => prItem(t.root, 'feat', fetchPr(t.run, opts), gitFacts(t.root), opts);

test('merge facts: fetchPr asks for autoMergeRequest and mergeStateStatus only in merge mode', () => {
  const t = withPr({});
  fetchPr(t.run, { merge: true });
  fetchPr(t.run);
  assert.deepEqual(t.gh.calls(), [['pr', 'view', '--json', MERGE_FIELDS], ['pr', 'view', '--json', PR_FIELDS]]);
});

test('item 5 (merge): a MERGED PR at the local head is met; at another head it is blocked naming both shas', () => {
  const met = prM(withPr({ state: 'MERGED' }));
  assert.equal(met.status, 'met', met.reason);
  assert.match(met.reason, /PR #12 merged/);
  assert.equal(met.details.merged, true);
  const t = withPr({ state: 'MERGED', headRefOid: '0123456789abcdef0123456789abcdef01234567' });
  const blocked = prM(t);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, `PR #12 merged at 0123456; local head ${head(t.root).slice(0, 7)} differs`);
});

test('item 5 (merge): OPEN and BEHIND is open with details.behind; in pr mode BEHIND is not read and MERGED stays blocked', () => {
  const behind = prM(withPr({ mergeStateStatus: 'BEHIND' }));
  assert.equal(behind.status, 'open');
  assert.equal(behind.details.behind, true);
  assert.match(behind.reason, /branch is behind main; update it/);
  assert.equal(prM(withPr({ mergeStateStatus: 'CLEAN' })).details.behind, false);
  assert.equal(pr5(withPr({ mergeStateStatus: 'BEHIND' })).status, 'met', 'pr mode ignores BEHIND');
  assert.equal(pr5(withPr({ state: 'MERGED' })).status, 'blocked', 'pr mode: MERGED is blocked as in 0.4.0');
  assert.equal(prM(withPr({ state: 'CLOSED' })).status, 'blocked');
});

test('merge mode through the collector: a MERGED PR at the head meets items 5, 6 and 7 and asks gh for neither checks nor the conversation', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  const before = t.gh.calls().length;
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.deepEqual(s.items.map((i) => i.status), Array(8).fill('met'));
  assert.match(s.items[5].reason, /merged/);
  assert.match(s.items[6].reason, /merged/);
  const asked = t.gh.calls().slice(before).map((c) => c.slice(0, 2).join(' '));
  assert.ok(asked.includes('pr view'), 'asks for the PR');
  assert.ok(!asked.includes('pr checks') && !asked.includes('api graphql'), asked.join(', '));
});

test('plan and pr modes: the PR is asked with the 0.4.0 fields, no settings are read and the JSON has no merge facts (design D6)', () => {
  for (const ship of ['plan', 'pr']) {
    const t = shipRepo({ ship: 'pr' });
    driveToReady(t);
    if (ship === 'plan') writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit-lite: plan\n');
    const state = collectState(t.root, 'feat', { env: t.env });
    const views = t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'view');
    assert.ok(views.length > 0 && views.every((c) => c.join(' ') === `pr view --json ${PR_FIELDS}`), ship);
    assert.ok(!t.gh.calls().some((c) => c[0] === 'api' && c[1] !== 'graphql'), `${ship}: no settings read`);
    assert.equal(state.setup, undefined, ship);
    assert.deepEqual(Object.keys(buildReport(state)), ['version', 'change', 'schema', 'ship', 'host', 'head', 'pr', 'phases', 'items', 'met', 'summary', 'next'], ship);
    assert.deepEqual(Object.keys(buildReport(state).pr), ['number', 'url'], ship);
  }
});

test('merge mode through the collector: the settings are read and state carries setup, method and the PR merge facts', () => {
  const t = shipRepo({ ship: 'merge', method: 'rebase' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: PR_BODY, autoMergeRequest: { enabledAt: 'x' }, mergeStateStatus: 'BLOCKED' }) });
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.mergeMethod, 'rebase');
  assert.deepEqual(s.setup, { ok: true, missing: [], defaultBranch: 'main' });
  assert.deepEqual([s.pr.autoMerge, s.pr.state, s.pr.mergeStateStatus], [true, 'OPEN', 'BLOCKED']);
});

// ---------------------------------------------------------------- merge mode: next-step rows (auto-merge 2.4, design D6)

const SHA = 'a'.repeat(40);
const itemOf = (id, name, details = {}, status = 'met') => ({ id, name, status, reason: `item ${id} ${status}`, details });
// A merge-mode state at 8/8, PR open and clean, auto-merge off. `over` replaces top-level facts.
function metState(over = {}) {
  return {
    id: 'feat', schema: 'devkit-lite', ship: 'merge', mergeMethod: 'squash', branch: 'ship/feat', branchOk: true,
    needsReadiness: false, readiness: null, phases: [], dirty: [], reviewMd: null, reviews: [], head: SHA,
    pr: { number: 12, url: 'https://github.com/o/r/pull/12', autoMerge: false, state: 'OPEN', mergeStateStatus: 'CLEAN', headRefOid: SHA },
    setup: { ok: true, missing: [], defaultBranch: 'main' },
    items: [
      itemOf(1, 'tasks', { evidence: 'current', missingGates: [] }),
      itemOf(2, 'reviews', { missing: [], stale: [] }),
      itemOf(3, 'findings', { undisposed: [] }),
      itemOf(4, 'acceptance', { defects: [], ids: ['AC-1'], evidence: 'current', missing: [], noProof: [] }),
      itemOf(5, 'pr', { none: false, ahead: false, behind: false, uncommitted: [] }),
      itemOf(6, 'checks', { required: true, failing: [], pending: [] }),
      itemOf(7, 'conversation', { threads: [], comments: [], changesRequested: [] }),
      itemOf(8, 'body', { missing: [] }),
    ],
    ...over,
  };
}
// metState with one item replaced (status and details merged into the default details).
function withItem(n, status, details = {}, over = {}) {
  const s = metState(over);
  s.items = s.items.map((i) => (i.id === n ? { ...i, status, details: { ...i.details, ...details } } : i));
  return s;
}
const autoOn = { autoMerge: true };
const prOf = (extra) => ({ ...metState().pr, ...extra });

test('nextStep row 0a: a PR merged at the local head is merged, before every other row (AC-4)', () => {
  const s = withItem(5, 'met', { merged: true }, { pr: prOf({ state: 'MERGED' }), dirty: ['src/a.ts'] });
  assert.equal(nextStep(s).step, 'merged');
});

test('nextStep row 0b: auto-merge on and any item not met disables it first, ahead of every stop and of push (AC-3)', () => {
  const on = { pr: prOf(autoOn) };
  const cases = {
    'a stale review': withItem(2, 'open', { stale: ['code-quality-reviewer'] }, on),
    'a push the PR lacks': withItem(5, 'open', { ahead: true }, on),
    'a new comment': withItem(7, 'open', { comments: [{ url: 'u' }] }, on),
    'a re-run pending': withItem(6, 'open', { pending: ['build'] }, on),
    'behind the base': withItem(5, 'open', { behind: true }, on),
    'a stop: not approved': withItem(2, 'open', { stale: ['x'] }, { ...on, needsReadiness: true, readiness: 'BLOCKED' }),
    'a stop: wrong branch': withItem(2, 'open', { stale: ['x'] }, { ...on, branchOk: false }),
    'a stop: setup missing': withItem(2, 'open', { stale: ['x'] }, { ...on, setup: { ok: false, missing: ['m'] } }),
    'dirty files': withItem(1, 'open', {}, { ...on, dirty: ['src/a.ts'] }),
  };
  for (const [label, state] of Object.entries(cases)) {
    const n = nextStep(state);
    assert.deepEqual([n.step, n.number], ['disable-auto-merge', 12], label);
  }
});

test('nextStep row 0b: auto-merge on at 8/8 waits; auto-merge off never disables; a closed PR does not disable', () => {
  assert.equal(nextStep(metState({ pr: prOf(autoOn) })).step, 'wait-merge');
  assert.notEqual(nextStep(withItem(2, 'open', { stale: ['x'] })).step, 'disable-auto-merge');
  assert.notEqual(nextStep(withItem(5, 'blocked', {}, { pr: prOf({ autoMerge: true, state: 'CLOSED' }) })).step, 'disable-auto-merge');
});

test('nextStep row 0b: outside merge mode the auto-merge flag is never read', () => {
  const s = withItem(2, 'open', { stale: ['x'] }, { ship: 'pr', pr: prOf(autoOn) });
  assert.equal(nextStep(s).step, 'review');
});

test('nextStep row 3a: merge setup missing stops after the approval stops and before any work (AC-6)', () => {
  const missing = ['auto-merge is not allowed (allow_auto_merge); run the openspec-setup skill (GitHub step) to configure it'];
  const setup = { ok: false, missing };
  const n = nextStep(withItem(1, 'open', {}, { setup, phases: [{ n: 1, open: ['1.1'], gate: null }] }));
  assert.deepEqual([n.step, n.missing], ['stop-merge-setup', missing]);
  assert.match(n.reason, /openspec-setup/);
  assert.equal(nextStep(metState({ setup, branchOk: false })).step, 'stop-branch');
  assert.equal(nextStep(metState({ setup, needsReadiness: true, readiness: null })).step, 'stop-not-approved');
  assert.equal(nextStep(metState({ setup, ship: 'pr' })).step, 'ready', 'outside merge mode the setup is not read');
});

test('nextStep row 15a: behind the base, and nothing else open, updates the branch; ahead as well pushes first', () => {
  const n = nextStep(withItem(5, 'open', { behind: true }));
  assert.deepEqual([n.step, n.number], ['update-branch', 12]);
  assert.equal(nextStep(withItem(5, 'open', { behind: true, ahead: true })).step, 'push');
  assert.equal(nextStep(withItem(5, 'open', { behind: true, uncommitted: ['openspec/changes/feat/x.md'] })).step, 'push');
});

test('nextStep row 17a: devkit-reviews failing while items 1-4 are met stops as blocked item 6, in every mode (R-7)', () => {
  const failing = [{ name: 'devkit-reviews', link: 'https://ci/devkit-reviews' }];
  for (const ship of ['pr', 'merge']) {
    const n = nextStep(withItem(6, 'open', { failing }, { ship }));
    assert.deepEqual([n.step, n.item], ['blocked', 6], ship);
    assert.match(n.reason, /devkit-reviews fails in CI while items 1-4 are met locally: https:\/\/ci\/devkit-reviews/, ship);
  }
  const other = nextStep(withItem(6, 'open', { failing: [{ name: 'build', link: 'u' }] }));
  assert.equal(other.step, 'fix-checks', 'another failing check still goes to a fix');
  const both = nextStep(withItem(6, 'open', { failing: [...failing, { name: 'build', link: 'u' }] }));
  assert.equal(both.step, 'blocked');
});

test('nextStep rows 21, 21a, 21b: ready for pr; enable-auto-merge with number, method and head; wait-merge with what it waits for (AC-2, AC-8)', () => {
  assert.equal(nextStep(metState({ ship: 'pr' })).step, 'ready');
  const n = nextStep(metState({ mergeMethod: 'rebase' }));
  assert.deepEqual([n.step, n.number, n.method, n.head], ['enable-auto-merge', 12, 'rebase', SHA]);
  assert.equal(nextStep(metState()).method, 'squash');
  const w = nextStep(metState({ pr: prOf({ autoMerge: true, mergeStateStatus: 'BLOCKED' }) }));
  assert.equal(w.step, 'wait-merge');
  assert.match(w.waitingFor, /branch rules outside the delivery contract/);
});

test('waitingFor: the wait text per mergeStateStatus (design D6)', () => {
  for (const v of ['CLEAN', 'HAS_HOOKS', 'UNSTABLE']) assert.equal(waitingFor(v), 'GitHub to merge', v);
  assert.equal(waitingFor('BLOCKED'), 'branch rules outside the delivery contract (for example a required approval)');
  assert.equal(waitingFor('UNKNOWN'), 'GitHub to compute mergeability');
  assert.equal(waitingFor('DIRTY'), 'GitHub (mergeStateStatus DIRTY)');
  assert.equal(waitingFor(undefined), 'GitHub (mergeStateStatus undefined)');
});

test('AC-2: with any one of items 1-8 open or blocked and the other seven met, auto-merge is never enabled', () => {
  for (let n = 1; n <= 8; n++) {
    for (const status of ['open', 'blocked']) {
      const step = nextStep(withItem(n, status)).step;
      assert.notEqual(step, 'enable-auto-merge', `item ${n} ${status} -> ${step}`);
      assert.notEqual(step, 'wait-merge', `item ${n} ${status} -> ${step}`);
    }
  }
  assert.equal(nextStep(metState()).step, 'enable-auto-merge', 'the control: 8/8 enables');
});

// ---------------------------------------------------------------- merge mode: the stops and the summary through the real collector (auto-merge 2.5, 2.6)

const noMergeCall = (t) => t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge');

test('merge setup stops: each missing piece goes through collectState and the CLI to stop-merge-setup, exit 2, and gh pr merge is never called (AC-6)', () => {
  const cases = [
    ['auto-merge off', (t) => presetSetup(t.gh, { repo: { allow_auto_merge: false } }), /auto-merge is not allowed \(allow_auto_merge\)/],
    ['no rule', (t) => presetSetup(t.gh, { rules: [] }), /no active rule requires the devkit-reviews check on main/],
    ['a rule for another check only', (t) => presetSetup(t.gh, { rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }] } }] }), /no active rule requires/],
    ['workflow not committed', (t) => { git(t.root, 'rm', '-q', '.github/workflows/devkit-reviews.yml'); commitAll(t.root, 'drop the workflow'); }, /devkit-reviews\.yml is not committed/],
  ];
  for (const [label, arrange, text] of cases) {
    const t = shipRepo({ ship: 'merge' });
    arrange(t);
    const n = nextStep(collectState(t.root, 'feat', { env: t.env }));
    assert.equal(n.step, 'stop-merge-setup', label);
    assert.match(n.missing.join(' '), text, label);
    const human = runCli(t, ['feat']);
    assert.equal(human.code, 2, label);
    assert.match(human.out, /^\d\/8 met: blocked: merge setup$/m, label);
    assert.match(human.out, /^next: stop-merge-setup: /m, label);
    const j = JSON.parse(runCli(t, ['feat', '--json']).out);
    assert.deepEqual([j.summary, j.next.step], ['blocked: merge setup', 'stop-merge-setup'], label);
    assert.equal(j.merge.setup.ok, false, label);
    assert.match(j.merge.setup.missing.join(' '), text, label);
    assert.deepEqual(noMergeCall(t), [], label);
  }
});

test('merge setup stops: merge_method rebase with rebase merges off goes through the collector to stop-merge-setup, naming the method (AC-6, AC-8)', () => {
  const t = shipRepo({ ship: 'merge', method: 'rebase' });
  presetSetup(t.gh, { repo: { allow_rebase_merge: false } });
  const n = nextStep(collectState(t.root, 'feat', { env: t.env }));
  assert.equal(n.step, 'stop-merge-setup');
  assert.match(n.missing.join(' '), /rebase merges are not allowed \(allow_rebase_merge\)/);
  assert.doesNotMatch(n.missing.join(' '), /squash/);
  assert.deepEqual(noMergeCall(t), []);
});

test('merge setup stops: an unreadable repository fails closed as a stop, not as a pass (AC-6)', () => {
  const t = shipRepo({ ship: 'merge' });
  t.gh.set('api-GET-repos__owner___repo_', { exit: 1, stderr: 'gh: connection reset\n' });
  const n = nextStep(collectState(t.root, 'feat', { env: t.env }));
  assert.equal(n.step, 'stop-merge-setup');
  assert.match(n.missing[0], /^cannot read the repository settings: gh: connection reset/);
});

test('merge mode keeps the human plan gate: a devkit change without APPROVED readiness stops as not approved, even with a prepared repository (AC-3 of round 1)', () => {
  for (const readiness of [null, 'BLOCKED']) {
    const t = devkitRepo({ ship: 'merge', readiness });
    assert.equal(nextStep(t.state()).step, 'stop-not-approved', String(readiness));
    presetSetup(t.gh, { rules: [] });
    assert.equal(nextStep(t.state()).step, 'stop-not-approved', 'the approval stop comes before the setup stop');
  }
  const approved = devkitRepo({ ship: 'merge', readiness: 'APPROVED' });
  assert.notEqual(nextStep(approved.state()).step, 'stop-not-approved');
});

// A merge-mode repo at 8/8 with the PR open and clean.
function mergeReady(over = {}) {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: PR_BODY, ...over }) });
  return t;
}

test('merge mode: 8/8 with auto-merge off is exit 0, step enable-auto-merge, summary ready, and the merge object (AC-2, AC-8)', () => {
  const t = mergeReady();
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.version, 1);
  assert.deepEqual([j.met, j.summary, j.next.step], [8, 'ready', 'enable-auto-merge']);
  assert.deepEqual(j.next, { step: 'enable-auto-merge', reason: j.next.reason, number: 12, method: 'squash', head: head(t.root) });
  assert.deepEqual(j.merge, { method: 'squash', setup: { ok: true, missing: [] }, autoMerge: false, state: 'OPEN', mergeStateStatus: 'CLEAN', waitingFor: null });
  assert.deepEqual(j.pr, { number: 12, url: 'https://github.com/o/r/pull/12' });
  assert.match(runCli(t, ['feat']).out, /^next: enable-auto-merge PR #12 with --squash at [0-9a-f]{7}$/m);
});

test('merge mode: merge_method rebase reaches the step (AC-8)', () => {
  const t = shipRepo({ ship: 'merge', method: 'rebase' });
  driveToReady(t);
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.next.method, 'rebase');
  assert.equal(j.merge.method, 'rebase');
});

test('merge mode: 8/8 with auto-merge on is exit 0 and "auto-merge on: waiting for ..." with the reason from mergeStateStatus (AC-4)', () => {
  const t = mergeReady({ autoMergeRequest: { enabledAt: '2026-11-09T00:00:00Z' }, mergeStateStatus: 'BLOCKED' });
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.summary, 'auto-merge on: waiting for branch rules outside the delivery contract (for example a required approval)');
  assert.equal(j.next.step, 'wait-merge');
  assert.deepEqual([j.merge.autoMerge, j.merge.waitingFor], [true, j.next.waitingFor]);
  assert.match(runCli(t, ['feat']).out, /^8\/8 met: auto-merge on: waiting for branch rules/m);
});

test('merge mode: a MERGED PR is "merged", exit 0, and the merge object says so (AC-4)', () => {
  const t = mergeReady({ state: 'MERGED' });
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.met, j.summary, j.next.step, j.merge.state], [8, 'merged', 'merged', 'MERGED']);
  assert.match(runCli(t, ['feat']).out, /^8\/8 met: merged$/m);
});

test('merge mode: a PR behind its base is update-branch with the item 5 reason', () => {
  const t = mergeReady({ mergeStateStatus: 'BEHIND' });
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.deepEqual([j.next.step, j.next.number], ['update-branch', 12]);
  assert.match(j.items[4].reason, /behind main/);
});

// ---- carry-over from the readiness review: a PR merged right after enable-auto-merge must still be found

test('carry-over: after an immediate merge the branch no longer finds the PR; merge mode looks it up by head branch among merged PRs and reports merged (AC-4)', () => {
  const t = mergeReady();
  const merged = prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY });
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  t.gh.set('pr-list', { stdout: [merged] });
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.deepEqual([j.summary, j.next.step, j.pr.number], ['merged', 'merged', 12]);
  assert.ok(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('--head') && c.includes('ship/feat') && c.includes('all')), 'the lookup includes merged and closed states');
});

test('carry-over: the head-branch lookup prefers an open PR over an older merged or closed one', () => {
  const t = mergeReady();
  const old = prJson({ number: 3, state: 'MERGED', headRefOid: '0123456789abcdef0123456789abcdef01234567' });
  const open = prJson({ number: 12, headRefOid: head(t.root), body: PR_BODY });
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  t.gh.set('pr-list', { stdout: [old, open] });
  assert.equal(collectState(t.root, 'feat', { env: t.env }).pr.number, 12);
  t.gh.set('pr-list', { stdout: [] });
  assert.equal(collectState(t.root, 'feat', { env: t.env }).pr, null, 'no PR at all stays "no pull request yet"');
  t.gh.set('pr-list', { exit: 1, stderr: 'boom\n' });
  assert.equal(collectState(t.root, 'feat', { env: t.env }).items[4].status, 'blocked', 'a lookup error is a blocked item, never a silent none');
});

test('carry-over: once the number is known the PR is read by number, so a changed or deleted branch cannot hide it', () => {
  const t = mergeReady();
  const before = t.gh.calls().length;
  const s = collectState(t.root, 'feat', { env: t.env, prNumber: 12 });
  assert.equal(s.pr.number, 12);
  assert.deepEqual(t.gh.calls().slice(before).find((c) => c[1] === 'view'), ['pr', 'view', '12', '--json', MERGE_FIELDS]);
});

test('carry-over: pr mode still reports a MERGED PR as blocked item 5 and plan mode stops, and neither looks the PR up by branch', () => {
  const t = shipRepo({ ship: 'pr' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  let j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(runCli(t, ['feat']).code, 2);
  assert.deepEqual([j.summary, j.next.step], ['blocked: item 5', 'blocked']);
  assert.match(j.items[4].reason, /is merged/);
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.items[4].details.none, true, 'as in 0.4.0: no PR found is open');
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit-lite: plan\n');
  j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.next.step, 'stop-plan-mode');
  assert.ok(!t.gh.calls().some((c) => c[1] === 'list'), 'no pr list outside merge mode');
});

// Items 6, 7 and 8 through the real collector in merge mode: nothing enables auto-merge over open work.
test('merge mode: an unresolved thread and a failing check, read by the collector, answer / fix-checks and never enable-auto-merge (R-2, AC-3)', () => {
  const answer = mergeReady();
  answer.gh.set('api-graphql', { stdout: conversation({ threads: [thread(false, ann, undefined, 'https://gh/t9')] }) });
  const a = JSON.parse(runCli(answer, ['feat', '--json']).out);
  assert.deepEqual([a.next.step, a.next.threads], ['answer', ['https://gh/t9']]);
  assert.equal(a.items[6].status, 'open');

  const fix = mergeReady();
  fix.gh.set('pr-checks', { exit: 1, stdout: [check('build', 'fail', 'https://ci/1')] });
  const f = JSON.parse(runCli(fix, ['feat', '--json']).out);
  assert.equal(f.next.step, 'fix-checks');
  assert.deepEqual(f.next.failing, [{ name: 'build', link: 'https://ci/1' }]);

  const body = mergeReady({ body: 'nothing here' });
  const b = JSON.parse(runCli(body, ['feat', '--json']).out);
  assert.equal(b.next.step, 'edit-pr-body');

  for (const t of [answer, fix, body]) assert.deepEqual(noMergeCall(t), []);
});

test('merge mode: auto-merge already on with an unresolved thread or a failing check disables it first (R-2, AC-3)', () => {
  const answer = mergeReady(on0());
  answer.gh.set('api-graphql', { stdout: conversation({ threads: [thread(false, ann)] }) });
  assert.deepEqual([JSON.parse(runCli(answer, ['feat', '--json']).out).next.step], ['disable-auto-merge']);
  const fix = mergeReady(on0());
  fix.gh.set('pr-checks', { exit: 1, stdout: [check('build', 'fail')] });
  const n = JSON.parse(runCli(fix, ['feat', '--json']).out).next;
  assert.deepEqual([n.step, n.number], ['disable-auto-merge', 12]);
  for (const t of [answer, fix]) assert.deepEqual(noMergeCall(t), []);
});
function on0() { return { autoMergeRequest: { enabledAt: '2026-11-09T00:00:00Z' } }; }

// ---- the wait: --watch at wait-merge (AC-4)

const POLL = ['pr', 'view', '12', '--json', 'state,autoMergeRequest,mergeStateStatus,headRefOid'];
const on = { autoMergeRequest: { enabledAt: 'x' } };
const polls = (t) => t.gh.calls().filter((c) => c.join(' ') === POLL.join(' '));
// 8/8, auto-merge on, with DEVKIT_POLL_SECONDS=0.
function waiting(over = {}) {
  const t = mergeReady({ ...on, ...over });
  t.pr = (extra) => prJson({ headRefOid: head(t.root), body: PR_BODY, ...extra });
  t.run = (watch = '--watch=1') => runCli(t, ['feat', '--json', watch], { env: { DEVKIT_POLL_SECONDS: '0' } });
  t.gh.resetCount('pr-view');
  return t;
}

test('--watch at wait-merge: polls gh pr view <n> until MERGED, then collects again and reports merged (AC-4)', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr(on) }, 2);
  t.gh.set('pr-view', { stdout: t.pr({ state: 'MERGED' }) });
  const r = t.run();
  assert.equal(r.code, 0, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step], ['merged', 'merged']);
  assert.equal(polls(t).length, 2, 'one open poll, one merged poll');
  assert.ok(t.gh.calls().some((c) => c.join(' ') === `pr view 12 --json ${MERGE_FIELDS}`), 'the final collect reads the PR by number');
});

test('--watch at wait-merge: the cap ends the wait with "auto-merge on: waiting for ..." (AC-4)', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) });
  const started = Date.now();
  const r = t.run('--watch=0.02');
  assert.ok(Date.now() - started < 20000);
  const j = JSON.parse(r.out);
  assert.equal(j.summary, 'auto-merge on: waiting for GitHub to merge');
  assert.ok(polls(t).length >= 1);
  assert.deepEqual(j.watch, { minutes: 0.02, timedOut: true });
});

test('--watch at wait-merge: stops early when auto-merge goes off, and the next step is enable-auto-merge again', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr({ autoMergeRequest: null }) });
  const j = JSON.parse(t.run().out);
  assert.equal(j.next.step, 'enable-auto-merge');
  assert.equal(polls(t).length, 1);
});

test('--watch at wait-merge: stops early when the PR head changes (a push), and item 5 is no longer met', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr({ ...on, headRefOid: '0123456789abcdef0123456789abcdef01234567' }) });
  const j = JSON.parse(t.run().out);
  assert.equal(polls(t).length, 1);
  assert.notEqual(j.items[4].status, 'met');
  assert.notEqual(j.next.step, 'wait-merge');
});

test('--watch at wait-merge: a gh error while polling stops the wait and the state is collected again', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { exit: 1, stderr: 'gh: network down\n' });
  const j = JSON.parse(t.run().out);
  assert.equal(polls(t).length, 1);
  assert.equal(j.items[4].status, 'blocked');
  assert.match(j.items[4].reason, /network down/);
});

test('makeGh: a gh call that outlives its timeout is cut, reported as timedOut and read as "timed out" (one runner in merge-setup.mjs)', () => {
  const gh = fakeGh();
  gh.set('api-GET-repos__owner___repo_', { stdout: {}, sleep: 8000 });
  const started = Date.now();
  const r = makeGh(tmpdir(), gh.env, 400)(['api', 'repos/{owner}/{repo}']);
  assert.ok(Date.now() - started < 5000, 'cut near the timeout, not after the 8s sleep');
  assert.equal(r.timedOut, true);
  assert.notEqual(r.status, 0);
  assert.match(ghError(r), /timed out/);
});

test('one gh runner: deliver-check.mjs and github-setup.mjs do not spawn gh themselves (architecture)', () => {
  for (const f of [join(here, 'deliver-check.mjs'), join(here, '..', 'skills', 'openspec-setup', 'scripts', 'github-setup.mjs')]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /spawnSync\(\s*'gh'/, f);
  }
});

test('--watch at wait-merge: one stalled gh poll is cut at the cap, so the wait ends near it and not when gh answers (R-4)', () => {
  const t = waiting();
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr(on), sleep: 15000 }, 2);
  t.gh.set('pr-view', { stdout: t.pr(on) });
  const started = Date.now();
  const r = t.run('--watch=0.025');
  assert.ok(Date.now() - started < 9000, `took ${Date.now() - started} ms`);
  const j = JSON.parse(r.out);
  assert.deepEqual(j.watch, { minutes: 0.025, timedOut: true });
  assert.equal(j.summary, 'auto-merge on: waiting for GitHub to merge');
});

test('--watch outside wait-merge never polls (enable-auto-merge, and no --watch at all)', () => {
  const t = mergeReady();
  runCli(t, ['feat', '--json', '--watch=1'], { env: { DEVKIT_POLL_SECONDS: '0' } });
  assert.equal(polls(t).length, 0);
  const u = waiting();
  u.gh.set('pr-view', { stdout: u.pr(on) });
  runCli(u, ['feat', '--json'], { env: { DEVKIT_POLL_SECONDS: '0' } });
  assert.equal(polls(u).length, 0, 'without --watch there is no wait');
});

// ---------------------------------------------------------------- the merge walkthrough (auto-merge 2.7: AC-2, AC-3, AC-4)

test('walkthrough (merge): enable at 8/8, wait, a product commit disables first, the loop re-runs, enable again, then merged', () => {
  const t = shipRepo({ ship: 'merge' });
  const taken = driveToReady(t);
  assert.deepEqual(taken, ['implement', 'gate', 'implement', 'gate', 'commit', 'review', 'verify', 'open-pr', 'enable-auto-merge']);

  const pr = (extra = {}, sha = head(t.root)) => t.gh.set('pr-view', { stdout: prJson({ headRefOid: sha, body: PR_BODY, ...extra }) });
  const step = () => nextStep(collectState(t.root, 'feat', { env: t.env }));
  const prHead = head(t.root);
  const seen = [step().step];

  pr(on); // the skill ran gh pr merge --auto and GitHub accepted it
  seen.push(step().step);

  put(t.root, { 'src/a.ts': 'changed after auto-merge was enabled\n' });
  commitAll(t.root, 'product change');
  let n = step();
  seen.push(n.step);
  assert.equal(n.number, 12);
  pr({ autoMergeRequest: null }, prHead); // the skill ran gh pr merge --disable-auto

  n = step();
  seen.push(n.step);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
  reviewAt(t.root, n.reviewers);
  seen.push(step().step);
  fullEvidence(t.root, t.env);
  seen.push(step().step);

  commitAll(t.root, 'ship change files'); // the push
  pr({}, head(t.root));
  n = step();
  seen.push(n.step);
  assert.deepEqual([n.number, n.method, n.head], [12, 'squash', head(t.root)]);

  pr(on, head(t.root));
  seen.push(step().step);
  pr({ state: 'MERGED' }, head(t.root));
  seen.push(step().step);

  assert.deepEqual(seen, ['enable-auto-merge', 'wait-merge', 'disable-auto-merge', 'review', 'verify', 'push', 'enable-auto-merge', 'wait-merge', 'merged']);
  assert.deepEqual(noMergeCall(t), [], 'deliver-check never merges; the skill runs gh pr merge');
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

test('CLI: openspec/ without a git repo is a clear usage error, not a raw git fatal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-nogit-'));
  mkdirSync(join(dir, 'openspec/changes/feat'), { recursive: true });
  writeFileSync(join(dir, 'openspec/config.yaml'), 'schema: devkit\n');
  const r = spawnSync(process.execPath, [join(here, 'deliver-check.mjs'), 'feat'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not a git repository/i);
  assert.doesNotMatch(r.stderr, /fatal:/);
});

test('CLI: runs from a subdirectory of the repo', () => {
  const t = shipRepo();
  assert.equal(runCli(t, ['feat'], { cwd: join(t.root, 'src') }).code, 1);
});

test('CLI: an invalid ship or merge_method is exit 3 with the key named, and { version, error } in JSON (AC-1)', () => {
  const t = shipRepo();
  for (const [config, pattern] of [
    ['schema: devkit-lite\nship: { devkit-lite: auto }\n', /ship\.devkit-lite: unknown mode "auto"; use plan, pr or merge/],
    ['schema: devkit-lite\nship: { devkit-lite: pr }\nmerge_method: fast\n', /^openspec\/config\.yaml: merge_method: unknown value "fast"/],
  ]) {
    writeFileSync(join(t.root, 'openspec/config.yaml'), config);
    const r = runCli(t, ['feat']);
    assert.equal(r.code, 3);
    assert.match(r.err.replace(/^deliver-check: /, ''), pattern);
    assert.equal(r.out, '');
    const j = runCli(t, ['feat', '--json']);
    assert.equal(j.code, 3);
    const parsed = JSON.parse(j.out);
    assert.equal(parsed.version, 1);
    assert.match(parsed.error, pattern);
    assert.deepEqual(Object.keys(parsed).sort(), ['error', 'version']);
  }
});

test('CLI: ship merge no longer exits 3 and does not stop as plan mode (AC-1, design D2 row 1)', () => {
  const t = shipRepo({ ship: 'merge', method: 'rebase' }); // a prepared repository: merge mode reads the settings now (2.3)
  const r = runCli(t, ['feat', '--json']);
  assert.notEqual(r.code, 3, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.ship, 'merge');
  assert.equal(j.next.step, 'implement');
  assert.equal(collectState(t.root, 'feat', { env: t.env }).mergeMethod, 'rebase');
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

test('format: pr-verifier puts the Commit line before the first heading of evidence.md, where parseCommitLine reads it', () => {
  const md = coreAgent('pr-verifier');
  assert.match(md, /before the first (markdown )?heading/i);
  assert.doesNotMatch(md, /Near the top/);
});

test('format: every reviewer agent puts Commit on the second line of its verdict file', () => {
  for (const name of ['adr-reviewer', 'architecture-reviewer', 'code-quality-reviewer', 'security-reviewer', 'spec-reviewer', 'test-coverage-reviewer']) {
    assert.match(coreAgent(name), /Its second line is `Commit: <sha>`/, name);
  }
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
  const steps = ['stop-plan-mode', 'stop-branch', 'stop-not-approved', 'implement', 'gate', 'commit', 'stop-review-deadlock', 'fix-review', 'review', 'fix-defect', 'verify', 'blocked', 'open-pr', 'push', 'edit-pr-body', 'fix-checks', 'answer', 'wait-checks', 'ready',
    'stop-merge-setup', 'disable-auto-merge', 'update-branch', 'enable-auto-merge', 'wait-merge', 'merged'];
  for (const s of steps) assert.ok(md.includes(`\`${s}\``), `names step ${s}`);
  // whatever nextStep can emit has a row in the table, so a new step cannot ship without the skill
  const src = readFileSync(join(repoRoot, 'plugins', 'openspec', 'hooks', 'deliver-check.mjs'), 'utf8');
  const emitted = [...new Set([...src.matchAll(/\bstep\('([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(emitted.length >= steps.length, 'found the steps in nextStep');
  for (const s of emitted) assert.match(md, new RegExp(`^\\|[^|]*\`${s}\`[^|]*\\|`, 'm'), `a table row for ${s}`);
});

test('format: ship-change enables auto-merge with one exact command, only at enable-auto-merge, and disables it at disable-auto-merge (AC-2, AC-3, AC-8)', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  assert.ok(md.includes('gh pr merge <next.number> --auto --<next.method> --match-head-commit <next.head>'), 'the enable command, verbatim');
  const row = (step) => md.split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';
  assert.match(row('disable-auto-merge'), /gh pr merge <next\.number> --disable-auto/);
  assert.match(row('enable-auto-merge'), /--match-head-commit <next\.head>/);
  assert.match(row('update-branch'), /gh pr update-branch <next\.number>/);
  assert.match(row('stop-merge-setup'), /blocked: merge setup/);
  assert.match(row('wait-merge'), /--watch/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /`gh pr merge` except at `enable-auto-merge` \(`--auto`\) and `disable-auto-merge` \(`--disable-auto`\)/);
  assert.match(never, /--admin/);
  assert.match(md, /`merge`/);
  assert.doesNotMatch(md, /`merge` is not available yet/);
  for (const report of ['merged', 'auto-merge on: waiting for', 'blocked: merge setup']) assert.ok(md.includes(report), `Report names ${report}`);
});

// ---------------------------------------------------------------- --ci: the devkit-reviews check (auto-merge D5)

const CI_TASKS = '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n';
const CI_ENV = { DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', DEVKIT_BYPASS: '' };
function runCi(root, args = [], env = {}) {
  const r = spawnSync(process.execPath, [cli, '--ci', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...CI_ENV, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
const ciGate = (cmd = 'node -e 0') => `${gateRow(cmd, 'pass: ok')}`;
// Reviews and evidence for `name` at the current head, committed (an openspec/-only commit).
function ciProve(root, name = 'feat', { rows = ciGate(), acs = ['AC-1'], ac = (id) => acRow(id, 'pass: t') } = {}) {
  const sha = head(root);
  const dir = `openspec/changes/${name}`;
  put(root, {
    [`${dir}/reviews/code-quality-reviewer.md`]: review('approved', sha),
    [`${dir}/reviews/test-coverage-reviewer.md`]: review('approved', sha),
    [`${dir}/evidence.md`]: `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${rows}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acs.map(ac).join('')}`,
  });
  commitAll(root, `prove ${name}`);
}
function changeFilesOf() {
  return { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1']), 'tasks.md': CI_TASKS };
}
// A repo on `branch` with the given changes (default: one complete change `feat`, proven at head).
function ciRepo({ branch = 'ship/feat', names = ['feat'], config = 'schema: devkit-lite\n', prove = true } = {}) {
  const root = gitRepo({ config, changes: Object.fromEntries(names.map((n) => [n, changeFilesOf()])), files: { 'src/a.ts': 'a\n' } });
  if (branch !== 'main') git(root, 'switch', '-q', '-c', branch);
  if (prove) for (const n of names) ciProve(root, n);
  return root;
}

test('--ci: passes at the head when items 1 to 4 are met, with the D5 human output (AC-5)', () => {
  const root = ciRepo();
  const r = runCi(root);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.match(lines[0], /^devkit-reviews: feat \(schema devkit-lite, head [0-9a-f]{7}\)$/);
  assert.equal(lines.filter((l) => /^ {2}[1-4] met\s+\S/.test(l)).length, 4, r.out);
  assert.equal(lines.at(-1), 'pass');
  assert.doesNotMatch(r.out, /readiness/, 'devkit-lite has no readiness artifact');
});

test('--ci --json: version 1, mode ci, change, schema, head, readiness, items 1 to 4 and pass (design D5)', () => {
  const root = ciRepo();
  const j = runCi(root, ['--json']).json();
  assert.deepEqual(Object.keys(j).sort(), ['change', 'head', 'items', 'mode', 'pass', 'readiness', 'schema', 'version']);
  assert.deepEqual([j.version, j.mode, j.change, j.schema, j.pass], [1, 'ci', 'feat', 'devkit-lite', true]);
  assert.equal(j.head, head(root));
  assert.deepEqual(j.items.map((i) => [i.id, i.status]), [[1, 'met'], [2, 'met'], [3, 'met'], [4, 'met']]);
  assert.deepEqual(j.readiness, { status: null, met: true });
});

test('--ci: a product commit after the reviews makes them stale and fails with exit 1 (AC-5)', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  const r = runCi(root);
  assert.equal(r.code, 1);
  assert.match(r.out, /^ {2}2 open\s+reviews at head: .*stale code-quality-reviewer/m);
  assert.match(r.out, /^fail: item 1, item 2, item 4$/m, 'evidence is stale too');
  assert.equal(runCi(root, ['--json']).json().pass, false);
});

test('--ci: fails for each of an undisposed blocking finding, an AC without a pass row, a no proof AC and a gate without a passing row (AC-5)', () => {
  const cases = [
    ['finding', (root) => { put(root, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': `${review('approved', head(root))}- [blocking] src/a.ts:1 broken\n` }); commitAll(root, 'finding'); }, /^ {2}3 open\s+findings disposed: undisposed/m, 'item 3'],
    ['missing AC row', (root) => ciProve(root, 'feat', { acs: [] }), /^ {2}4 open\s+acceptance criteria proven: no proof row for AC-1/m, 'item 4'],
    ['no proof', (root) => ciProve(root, 'feat', { ac: (id) => acRow(id, 'no proof: later') }), /^ {2}4 blocked\s+acceptance criteria proven: no proof for AC-1/m, 'item 4'],
    ['gate row', (root) => ciProve(root, 'feat', { rows: gateRow('node -e 0', 'fail: red') }), /^ {2}1 open\s+tasks and gates: .*no passing row in evidence\.md for `node -e 0`/m, 'item 1'],
  ];
  for (const [label, arrange, pattern, failed] of cases) {
    const root = ciRepo();
    arrange(root);
    const r = runCi(root);
    assert.equal(r.code, 1, `${label}: ${r.out}${r.err}`);
    assert.match(r.out, pattern, label);
    assert.match(r.out, new RegExp(`^fail: ${failed}$`, 'm'), label);
  }
});

test('--ci: a devkit change whose readiness is not APPROVED fails; APPROVED passes (AC-5)', () => {
  const devkitFiles = { '.openspec.yaml': 'schema: devkit\n', 'proposal.md': proposalWith(['AC-1']), 'tasks.md': CI_TASKS };
  const make = (readiness) => {
    const root = gitRepo({
      config: 'schema: devkit\n',
      changes: { feat: { ...devkitFiles, ...(readiness ? { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` } : {}) } },
      files: { 'src/a.ts': 'a\n', 'openspec/schemas/devkit/schema.yaml': 'name: devkit\nversion: 1\nartifacts:\n  - id: readiness\n    generates: readiness.md\n' },
    });
    git(root, 'switch', '-q', '-c', 'ship/feat');
    ciProve(root);
    return root;
  };
  for (const readiness of ['NEEDS-REVISION', null]) {
    const r = runCi(make(readiness));
    assert.equal(r.code, 1, String(readiness));
    assert.match(r.out, new RegExp(`^ {2}readiness open\\s+Status: ${readiness || 'missing'}`, 'm'));
    assert.match(r.out, /^fail: readiness$/m);
  }
  const ok = runCi(make('APPROVED'), ['--json']);
  assert.equal(ok.code, 0);
  assert.deepEqual(ok.json().readiness, { status: 'APPROVED', met: true });
});

test('--ci: ship and merge_method are not read, so a typo there does not fail the check (design D2, D5)', () => {
  const root = ciRepo({ config: 'schema: devkit-lite\nship: { devkit-lite: auto }\nmerge_method: fast\n' });
  const r = runCi(root);
  assert.equal(r.code, 0, r.out + r.err);
});

test('--ci: DEVKIT_BYPASS=1 changes nothing', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later');
  assert.equal(runCi(root, [], { DEVKIT_BYPASS: '1' }).code, 1);
  assert.equal(runCi(root, ['--json'], { DEVKIT_BYPASS: '1' }).out, runCi(root, ['--json']).out);
});

test('--ci --watch is a usage error (exit 3)', () => {
  const r = runCi(ciRepo(), ['--watch']);
  assert.equal(r.code, 3);
  assert.match(r.err, /--ci cannot be combined with --watch/);
  assert.equal(runCi(ciRepo(), ['--watch=5', '--json']).code, 3);
});

test('--ci: a repo without openspec/ passes with a note, like guard.mjs ci; a repo that has not adopted OpenSpec is never broken (R-3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-noopenspec-'));
  git(dir, 'init', '-q', '-b', 'main');
  const r = runCi(dir);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /devkit-reviews: no openspec\/ folder; nothing to check/);
  const j = runCi(dir, ['--json']).json();
  assert.deepEqual([j.version, j.mode, j.change, j.pass], [1, 'ci', null, true]);
  assert.match(j.note, /no openspec\/ folder/);
  // The non-CI mode keeps its exit 3 in the same repo.
  assert.equal(spawnSync(process.execPath, [cli, 'feat'], { cwd: dir, encoding: 'utf8' }).status, 3);
});

test('--ci: openspec/ without a git repository is exit 3', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-nogit-ci-'));
  mkdirSync(join(dir, 'openspec/changes/feat'), { recursive: true });
  const r = spawnSync(process.execPath, [cli, '--ci'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...CI_ENV, GIT_CEILING_DIRECTORIES: dirname(dir) } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not a git repository/i);
});

// ---- change selection (design D5, 1.2)

test('--ci selection 1: <change-id> and DEVKIT_CHANGE select; an unknown or archived change is exit 3', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  assert.equal(runCi(root, ['other', '--json']).json().change, 'other');
  assert.equal(runCi(root, ['--json'], { DEVKIT_CHANGE: 'feat' }).json().change, 'feat');
  assert.equal(runCi(root, ['nope']).code, 3);
  assert.match(runCi(root, ['nope']).err, /unknown change "nope"/);
  assert.equal(runCi(root, [], { DEVKIT_CHANGE: 'nope' }).code, 3);
  mkdirSync(join(root, 'openspec/changes/archive/2026-01-01-gone'), { recursive: true });
  assert.equal(runCi(root, ['gone']).code, 3);
  assert.equal(runCi(root, ['archive']).code, 3);
  assert.equal(runCi(root, ['..']).code, 3);
});

test('--ci selection 2: the branch tail, or the single change the branch contains, selects; several contained fail', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  const on = (b, env = {}) => runCi(root, ['--json'], { DEVKIT_BRANCH: b, ...env });
  assert.equal(on('ship/other').json().change, 'other');
  assert.equal(on('user-feat-work').json().change, 'feat');
  assert.equal(on('', { GITHUB_HEAD_REF: 'ci/feat' }).json().change, 'feat', 'GITHUB_HEAD_REF');
  const several = on('feat-and-other');
  assert.equal(several.code, 1);
  assert.match(several.err, /several changes match branch feat-and-other; name the branch after one/);
  assert.equal(several.json().pass, false);
});

test('--ci selection 3: with GITHUB_BASE_REF the one active change the PR diff touches is selected, two fail (R-3)', () => {
  const root = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/tidy');
  put(root, { 'openspec/changes/other/notes.md': 'n\n' });
  commitAll(root, 'touch other');
  const env = { GITHUB_BASE_REF: 'main' };
  const one = runCi(root, ['--json'], env);
  assert.equal(one.json().change, 'other');
  put(root, { 'openspec/changes/feat/notes.md': 'n\n', 'openspec/changes/archive/2026-01-01-old/x.md': 'x\n' });
  commitAll(root, 'touch feat');
  const two = runCi(root, [], env);
  assert.equal(two.code, 1);
  assert.match(two.err, /several changes are touched by this PR \(feat, other\); name the branch after one/);
});

test('--ci selection 3: a squash-merged change still active on the base and untouched by the PR is not checked; the run passes with a note (AC-5, R-3)', () => {
  // `merged` has reviews recorded at a commit that is not an ancestor of HEAD, as after a squash merge.
  const root = ciRepo({ branch: 'main', names: ['merged'], prove: false });
  put(root, { 'openspec/changes/merged/reviews/code-quality-reviewer.md': review('approved', 'a'.repeat(40)) });
  commitAll(root, 'merged change stays active');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/docs');
  put(root, { 'README.md': 'docs\n' });
  commitAll(root, 'docs only');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /devkit-reviews: no change selected by branch chore\/docs or touched by this PR; nothing to check/);
  const j = runCi(root, ['--json'], { GITHUB_BASE_REF: 'main' }).json();
  assert.deepEqual([j.change, j.pass], [null, true]);
  assert.match(j.note, /nothing to check/);
  // The same repo run locally (no GITHUB_BASE_REF) falls back to the only open change and fails on it.
  assert.equal(runCi(root).code, 1);
});

test('--ci selection 3: GITHUB_BASE_REF without an origin/<base> ref is exit 3 naming the ref', () => {
  const root = ciRepo({ branch: 'main', names: ['feat'] });
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 3);
  assert.match(r.err, /origin\/main/);
});

test('--ci selection 4: without GITHUB_BASE_REF the only open change is checked; several are ambiguous (exit 1)', () => {
  const one = ciRepo({ branch: 'main', names: ['feat'] });
  assert.equal(runCi(one, ['--json']).json().change, 'feat');
  const two = ciRepo({ branch: 'main', names: ['feat', 'other'] });
  const r = runCi(two);
  assert.equal(r.code, 1);
  assert.match(r.err, /several open changes \(feat, other\); name the branch after one/);
  const n = runCi(gitRepo({ branch: 'main' }));
  assert.equal(n.code, 0);
  assert.match(n.out, /nothing to check/);
});

// ---- checkout preflight (design D5)

test('--ci preflight: a shallow clone is exit 3 naming fetch-depth: 0', () => {
  const root = ciRepo();
  put(root, { 'src/b.ts': 'b\n' });
  commitAll(root, 'second');
  const clone = join(mkdtempSync(join(tmpdir(), 'devkit-shallow-')), 'c');
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, clone], { env: GIT_ENV });
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true');
  const r = runCi(clone);
  assert.equal(r.code, 3);
  assert.match(r.err, /fetch the full history \(actions\/checkout with fetch-depth: 0\)/);
  assert.match(runCi(clone, ['--json']).json().error, /fetch-depth: 0/);
});

test('--ci preflight: a PR head sha that is not HEAD is exit 3 naming the ref: fix; the matching sha passes', () => {
  const root = ciRepo();
  const event = join(mkdtempSync(join(tmpdir(), 'devkit-event-')), 'event.json');
  writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: 'b'.repeat(40) } } }));
  const r = runCi(root, [], { GITHUB_EVENT_PATH: event });
  assert.equal(r.code, 3);
  assert.match(r.err, /check out the PR head \(actions\/checkout with ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\), not the merge commit/);
  writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: head(root) } } }));
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0);
  writeFileSync(event, JSON.stringify({ push: true }));
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0, 'an event without a pull_request is not checked');
  writeFileSync(event, 'not json');
  assert.equal(runCi(root, [], { GITHUB_EVENT_PATH: event }).code, 0, 'an unreadable event is not checked');
});

// Docs sweep (AC-9): ship mode no longer means "the owner always merges".
function sweepFiles() {
  const repo = join(here, '..', '..', '..');
  const out = [];
  const add = (p) => { if (existsSync(p)) out.push(p); };
  add(join(repo, 'README.md'));
  for (const f of readdirSync(join(repo, 'docs'))) if (f.endsWith('.md')) add(join(repo, 'docs', f));
  add(join(repo, 'plugins', 'openspec', 'README.md'));
  add(join(repo, 'plugins', 'core', 'README.md'));
  add(join(repo, 'plugins', 'core', 'skills', 'review-change', 'SKILL.md'));
  const skills = join(repo, 'plugins', 'openspec', 'skills');
  for (const d of readdirSync(skills)) add(join(skills, d, 'SKILL.md'));
  return out;
}

test('docs sweep: "never merges" and "the merge is the owner\'s" lines name a ship mode or are about commit-and-pr', () => {
  const claim = /never merges|merge is (always )?(the owner's|the human's|yours)/i;
  const names = /`(plan|pr|merge)`[^.\n]*\bmode\b|\bship mode\b|commit-and-pr/i;
  const bad = [];
  for (const file of sweepFiles()) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (claim.test(line) && !names.test(line)) bad.push(`${file}:${i + 1}: ${line.slice(0, 120)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('ADR 0002 exists, is cited by README and docs/openspec-flow.md, and says Status: accepted', () => {
  const repo = join(here, '..', '..', '..');
  const adr = join(repo, 'docs', 'adr', '0002-merge-without-the-owner-opt-in.md');
  assert.ok(existsSync(adr), 'ADR 0002 file');
  assert.match(readFileSync(adr, 'utf8'), /^- Status: accepted$/m);
  for (const f of ['README.md', join('docs', 'openspec-flow.md')]) {
    assert.match(readFileSync(join(repo, f), 'utf8'), /adr\/0002-merge-without-the-owner-opt-in\.md/, f);
  }
});

test('the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, with the tag in a comment, never the tag in the URL (R-10, security)', () => {
  const repo = join(here, '..', '..', '..');
  const v = JSON.parse(readFileSync(join(here, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const doc = readFileSync(join(repo, 'docs', 'openspec-flow.md'), 'utf8');
  const pins = [...doc.matchAll(/chacal88\/devkit\/([^/\n]+)\/plugins\/openspec\/hooks/g)].map((m) => m[1]);
  assert.ok(pins.length > 0);
  assert.deepEqual([...new Set(pins)], [`<commit sha of v${v}>`]);
  assert.match(doc, new RegExp(`# .*v${v.replaceAll('.', '\\.')}`), 'a comment in the snippet names the tag');
});
