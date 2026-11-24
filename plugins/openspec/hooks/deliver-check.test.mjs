// Tests for deliver-check.mjs. Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs both files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, cpSync, rmSync as fsRm, chmodSync, readFileSync, symlinkSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ghError } from './merge-setup.mjs';
import { archiveBranchChange, resolveChange } from './guard.mjs';
import { parseShip, parseMergeMethod, shipConfig, SHIP_MODES, shipMode, ShipConfigError, parseCommitLine, gitFacts, staleness, reviewsItem, tasksItem, parseTasks, readPhases, findingsItem, acceptanceItem, makeGh, fetchPr, prItem, checksItem, conversationItem, bodyItem, nextStep, readReviewMd, waitingFor, summarize, collectState, buildReport, detectHost, watchMinutes, locateChange, schemaOf, findChangePr, readRetro, approvalState, RELEASE_FILE, unnamedFiles, ciMain } from './deliver-check.mjs';
import * as DC from './deliver-check.mjs';
import { pendingTasks } from './flow-check.mjs';
import { createHash } from 'node:crypto';
import { findingLine, consolidate, outcomeOf, validateStage1 } from '../../core/skills/review-change/scripts/review-round.mjs';

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
  const root = tmpFolder('devkit-deliver-');
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

// An `openspec` stand-in in `dir`: `--version` answers `version`; any other call is logged as "<label> <args>" in
// `marker`, then answers one error status. It lets a test prove which CLI a pack started (field-fixes 6).
export function openspecStub(dir, { version, label, marker }) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'openspec');
  writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "${label} $*" >> "${marker}"\necho '{"status":[{"severity":"error","message":"stub"}]}'\nexit 1\n`);
  chmodSync(file, 0o755);
  return dir;
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

// ---- merge-staleness-first-parent (D-1 to D-3): a merge commit counts what it brought into the branch

// base() on main; feat with a product commit R, both reviews and evidence at R; then `onMain(root)` builds the base's
// commits on main and `merge(root)` makes the merge on feat. Returns { root, R }.
function mergeHistory(onMain, merge) {
  const root = base();
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': 'changed\n' });
  const R = commitAll(root, 'product commit');
  put(root, { ...withReviews(reviews(R)), 'openspec/changes/feat/evidence.md': `Commit: ${R}\n\n# Evidence\n` });
  commitAll(root, 'reviews and evidence');
  git(root, 'switch', '-q', 'main');
  onMain(root);
  git(root, 'switch', '-q', 'feat');
  merge(root);
  return { root, R };
}
const mergeMain = (root) => git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
const onlyOpenspec = (root) => { put(root, { 'openspec/changes/other.md': 'o\n' }); commitAll(root, 'plan only on main'); };
const s7 = (sha) => sha.slice(0, 7);

test('merge-staleness 1: a merge of main that brings only openspec/ into a branch with product commits before the record is current', () => {
  const { root, R } = mergeHistory(onlyOpenspec, mergeMain);
  assert.match(git(root, 'diff', '--name-only', 'HEAD^2', 'HEAD'), /^src\/a\.ts$/m, 'the history that broke -m');
  assert.equal(stale(root, R), null);
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details.stale, []);
  assert.equal(tasksItem(root, 'feat').details.evidence, 'current');
  assert.equal(acceptanceItem(root, 'feat').details.evidence, 'current');
});

test('merge-staleness 2: a merge of main that brings a product file is stale and names it', () => {
  const { root, R } = mergeHistory((r) => { put(r, { 'src/base.ts': 'b\n' }); commitAll(r, 'product on main'); }, mergeMain);
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(head(root))}, which touches src/base.ts`);
  assert.deepEqual(reviewsItem(root, 'feat').details.stale.length, 2);
  assert.equal(tasksItem(root, 'feat').details.evidence, 'stale');
});

test('merge-staleness 3: a merge commit that changes a product file while resolving is stale and names it', () => {
  const { root, R } = mergeHistory(onlyOpenspec, (r) => {
    git(r, 'merge', '-q', '--no-ff', '--no-commit', 'main');
    put(r, { 'src/a.ts': 'resolved\n' });
    git(r, 'add', 'src/a.ts');
    git(r, 'commit', '-q', '-m', 'merge main, resolving');
  });
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(head(root))}, which touches src/a.ts`);
});

test('merge-staleness 4: a merge that moves a product file under openspec/ is stale and names the old path', () => {
  const { root, R } = mergeHistory(onlyOpenspec, (r) => {
    git(r, 'merge', '-q', '--no-ff', '--no-commit', 'main');
    git(r, 'mv', 'src/a.ts', 'openspec/a.md');
    git(r, 'commit', '-q', '-m', 'merge main, moving');
  });
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(head(root))}, which touches src/a.ts`);
});

test('merge-staleness 5: a product commit the merge brings in is stale even when the merge itself brings only openspec/', () => {
  let X; let Y;
  const { root, R } = mergeHistory((r) => {
    put(r, { 'src/base.ts': 'b\n' });
    X = commitAll(r, 'X adds a product file');
    git(r, 'rm', '-q', 'src/base.ts');
    put(r, { 'openspec/changes/other.md': 'o\n' });
    Y = commitAll(r, 'Y removes it');
  }, mergeMain);
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), 'openspec/changes/other.md');
  const why = stale(root, R);
  assert.match(why, new RegExp(`^${s7(R)} is behind (${s7(X)}|${s7(Y)}), which touches src/base\\.ts$`));
  assert.ok(!why.includes(s7(head(root))), why);
});

test('merge-staleness 6: a merge whose first parent is the base is read against that parent', () => {
  const { root, R } = mergeHistory(onlyOpenspec, (r) => {
    git(r, 'switch', '-q', 'main');
    git(r, 'merge', '-q', '--no-ff', '-m', 'merge feat', 'feat');
    git(r, 'switch', '-q', '-C', 'feat', 'main');
  });
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(head(root))}, which touches src/a.ts`);
});

test('merge-staleness 7: a root commit a merge brings in is judged by its own files', () => {
  let O;
  const { root, R } = mergeHistory(() => {}, (r) => {
    git(r, 'switch', '-q', '--orphan', 'other');
    put(r, { 'src/x.ts': 'x\n', 'openspec/y.md': 'y\n' });
    O = commitAll(r, 'root of another history');
    git(r, 'switch', '-q', 'feat');
    git(r, 'merge', '-q', '--no-commit', '--allow-unrelated-histories', 'other');
    git(r, 'rm', '-q', '-f', 'src/x.ts');
    git(r, 'commit', '-q', '-m', 'merge other');
  });
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), 'openspec/y.md');
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(O)}, which touches src/x.ts`);
});

test('merge-staleness 8: a plain product commit after an openspec-only merge is still stale', () => {
  const { root, R } = mergeHistory(onlyOpenspec, mergeMain);
  assert.equal(stale(root, R), null);
  put(root, { 'src/a.ts': 'again\n' });
  const P = commitAll(root, 'product after the merge');
  assert.equal(stale(root, R), `${s7(R)} is behind ${s7(P)}, which touches src/a.ts`);
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
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
// pr list: the most specific fixture wins (--head, then --state), then plain pr-list.
const keys = args[0] === 'api' ? [apiKey()] : args[0] === 'pr' && args[1] === 'list'
  ? [...(opt('--head') ? ['pr-list-head-' + opt('--head').replace(/[\\/{}?]/g, '_')] : []), ...(opt('--state') ? ['pr-list-state-' + opt('--state')] : []), 'pr-list']
  : args[0] === '--version' ? ['version']
  : [args[0] + '-' + args[1] + (args.includes('--watch') ? '-watch' : '')];
// A view of a PR by number may have its own fixture (pr-view-<n>.json), ahead of the plain pr-view ones.
const own = args[0] === 'pr' && args[1] === 'view' && /^[0-9]+$/.test(args[2] || '') ? path.join(dir, 'pr-view-' + args[2] + '.json') : null;
const key = keys[0];
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify(args) + '\\n');
// A body read of a merged PR in the list is answered from it, and is not counted as a plain pr-view call.
const fields = (opt('--json') || '').split(',');
const merged = path.join(dir, 'pr-list-state-merged.json');
const project = (o) => Object.fromEntries(fields.filter((f) => f in o).map((f) => [f, o[f]]));
if (own && !fs.existsSync(own) && fs.existsSync(merged) && opt('--json') === 'body') {
  const hit = (JSON.parse(fs.readFileSync(merged, 'utf8')).stdout || []).find((p) => String(p.number) === args[2]);
  if (hit) { process.stdout.write(JSON.stringify(project(hit))); process.exit(0); }
}
const counter = path.join(dir, key + '.count');
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1;
fs.writeFileSync(counter, String(n));
const file = [own, ...keys.flatMap((k) => [k + '.' + n + '.json', k + '.json']).map((f) => path.join(dir, f))].filter(Boolean).find((f) => fs.existsSync(f));
// Like gh, answer only the JSON fields asked for: a merged-PR list carries a body only on request.
if (args[0] === 'pr' && args[1] === 'list' && opt('--state') === 'merged' && file === merged) {
  const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(fx.stdout)) { process.stdout.write(JSON.stringify(fx.stdout.map(project))); process.exit(fx.exit === undefined ? 0 : fx.exit); }
}
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
  const base = tmpFolder('devkit-gh-');
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
    // The files pull request <n> changed, and the tasks.md of <id> on the default branch (field-fixes 4).
    prFiles(n, files) { this.set(PR_FILES_KEY(n), filesFixture(files)); },
    tasksOnDefault(id, text, base = 'main') { this.set(TASKS_ON_KEY(id, base), tasksFixture(text)); },
    // Start counting calls to `key` from 1 again (per-call fixtures).
    resetCount(key) { fsRm(join(dir, `${key}.count`), { force: true }); },
    calls() {
      const f = join(dir, 'calls.log');
      return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
  };
}

// The fixture keys of the two GitHub reads the delivery makes (field-fixes 4): the files a pull request changed
// and the tasks.md of a change on the default branch. An unset key fails loudly, as every fake gh key does.
export const PR_FILES_KEY = (n) => `api-GET-repos__owner___repo__pulls_${n}_files`;
export const TASKS_ON_KEY = (id, base = 'main') => `api-GET-repos__owner___repo__contents_openspec_changes_${id}_tasks.md_ref=${base}`;
export const filesFixture = (files) => ({ stdout: files.map((f) => `${f}\n`).join('') });
export const tasksFixture = (text) => ({ stdout: { name: 'tasks.md', encoding: 'base64', content: Buffer.from(text).toString('base64') } });
// A tasks.md with the given ticked and unticked task ids, one task per line under phase headings.
export const tasksText = ({ ticked = [], unticked = [] } = {}) => `# Tasks\n\n${[...ticked.map((id) => `- [x] ${id} done`), ...unticked.map((id) => `- [ ] ${id} left`)].join('\n')}\n`;

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

test('fake gh: pr list calls get their own keys by --head and --state, and an existing pr-list fixture still answers them (archive-after-merge 2.1)', () => {
  const gh = fakeGh();
  gh.set('pr-list', { stdout: 'any' });
  assert.equal(callGh(gh, 'pr', 'list', '--head', 'ship/feat', '--state', 'all').stdout, 'any', 'the old fixture answers a call with --head');
  assert.equal(callGh(gh, 'pr', 'list', '--state', 'merged', '--limit', '100').stdout, 'any', 'and a call without --head');
  gh.set('pr-list-head-chore_archive-x', { stdout: 'archive' });
  gh.set('pr-list-state-merged', { stdout: 'merged' });
  assert.equal(callGh(gh, 'pr', 'list', '--head', 'chore/archive-x', '--state', 'all').stdout, 'archive', '/ becomes _ in the head');
  assert.equal(callGh(gh, 'pr', 'list', '--state', 'merged').stdout, 'merged');
  assert.equal(callGh(gh, 'pr', 'list', '--head', 'ship/feat', '--state', 'all').stdout, 'any', 'another head falls back to pr-list');
  assert.equal(callGh(gh, 'pr', 'view').status, 99, 'pr view is untouched by the pr-list keys');
});

test('fake gh: a pr list call with no fixture fails loudly naming its most specific key (archive-after-merge 2.1)', () => {
  const gh = fakeGh();
  const r = callGh(gh, 'pr', 'list', '--head', 'chore/archive-x', '--state', 'all');
  assert.equal(r.status, 99);
  assert.match(r.stderr, /no fixture for "pr-list-head-chore_archive-x"/);
  const s = callGh(gh, 'pr', 'list', '--state', 'merged');
  assert.match(s.stderr, /no fixture for "pr-list-state-merged"/);
  assert.match(callGh(gh, 'pr', 'list').stderr, /no fixture for "pr-list"/);
});

test('fake gh: sleep delays the answer', () => {
  const gh = fakeGh();
  gh.set('pr-view', { stdout: 'ok', sleep: 300 });
  const t = Date.now();
  assert.equal(callGh(gh, 'pr', 'view').stdout, 'ok');
  assert.ok(Date.now() - t >= 250);
});

// ---------------------------------------------------------------- locating a change, active or archived (archive-after-merge 2.2, D3)

test('locateChange: active folder, newest dated archive folder with the exact id, or null (D3)', () => {
  const root = gitRepo({ changes: { live: { 'tasks.md': 'x\n' } } });
  for (const d of ['archive/2026-01-02-x', 'archive/2026-03-04-x', 'archive/2026-05-06-xx', 'archive/2026-03-04-y']) {
    put(root, { [`openspec/changes/${d}/proposal.md`]: 'p\n' });
  }
  assert.deepEqual(locateChange(root, 'live'), { dir: join(root, 'openspec/changes/live'), archived: false });
  assert.deepEqual(locateChange(root, 'x'), { dir: join(root, 'openspec/changes/archive/2026-03-04-x'), archived: true }, 'the newest date wins and xx is not x');
  assert.equal(locateChange(root, 'nope'), null);
  assert.equal(locateChange(root, 'archive'), null, 'the archive folder is not a change');
  put(root, { 'openspec/changes/x/proposal.md': 'p\n' });
  assert.equal(locateChange(root, 'x').archived, false, 'an active folder wins over an archived one');
});

test('schemaOf: an archived change reads its own .openspec.yaml, so a devkit change in a devkit-lite project keeps ship.devkit (D3)', () => {
  const root = gitRepo({ config: 'schema: devkit-lite\nship:\n  devkit: merge\n  devkit-lite: pr\n', changes: { live: { '.openspec.yaml': 'schema: devkit\n' } } });
  put(root, { 'openspec/changes/archive/2026-11-09-x/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/archive/2026-11-09-bare/proposal.md': 'p\n' });
  assert.equal(schemaOf(root, locateChange(root, 'live')), 'devkit');
  assert.equal(schemaOf(root, locateChange(root, 'x')), 'devkit');
  assert.equal(schemaOf(root, locateChange(root, 'bare')), 'devkit-lite', 'no file in the folder: the project default');
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
  const nodeOnly = join(tmpFolder('devkit-nodeonly-'), 'bin');
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

// ---- gh-version: a gh older than 2.50.0 has its own blocked reason (AC-1, AC-5, AC-6)

const OLD_FLAG = (flag) => `unknown flag: --${flag}\n\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]\n`;
const versionsOf = (t) => t.gh.calls().filter((c) => c[0] === '--version');

test('gh-version 5: an unknown --json flag on gh 2.46.0 is blocked with its own reason (AC-1)', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stderr: OLD_FLAG('json') });
  t.gh.set('version', { stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  const it = pr6(t);
  assert.equal(it.status, 'blocked');
  for (const part of ['2.46.0', '2.50.0', 'update gh']) assert.ok(it.reason.includes(part), it.reason);
  assert.deepEqual(it.details.ghTooOld, { installed: '2.46.0', minimum: '2.50.0' });
  assert.equal(versionsOf(t).length, 1);
  assert.equal(argsOf(t, 'checks').length, 1);
});

test('gh-version 6: an unknown --required flag is told apart the same way (AC-1)', () => {
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stderr: OLD_FLAG('required') });
  t.gh.set('version', { stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  const it = pr6(t);
  assert.equal(it.status, 'blocked');
  assert.deepEqual(it.details.ghTooOld, { installed: '2.46.0', minimum: '2.50.0' });
  assert.equal(versionsOf(t).length, 1);
  assert.equal(argsOf(t, 'checks').length, 1);
});

test('gh-version 7: an unreadable version still names the old gh, as an unknown version (AC-5)', () => {
  const cases = [{ exit: 1, stderr: 'boom\n' }, { stdout: 'gh version DEV\n' }, null];
  for (const answer of cases) {
    const t = withPr({});
    t.gh.set('pr-checks', { exit: 1, stderr: OLD_FLAG('json') });
    if (answer) t.gh.set('version', answer);
    const it = pr6(t);
    assert.equal(it.status, 'blocked', JSON.stringify(answer));
    assert.equal(it.details.ghTooOld.installed, null);
    assert.equal(it.details.ghTooOld.minimum, '2.50.0');
    assert.ok(it.reason.includes('of an unknown version') && it.reason.includes('2.50.0'), it.reason);
  }
});

test('gh-version 8: every other failure keeps today\'s reason and asks for no version (AC-6)', () => {
  const asked = (t) => versionsOf(t).length;
  const cases = [
    ['HTTP 502: bad gateway\n', 'cannot read the checks: HTTP 502: bad gateway'],
    ['HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with:  gh auth login\n', 'cannot read the checks: HTTP 401: Bad credentials (https://api.github.com/graphql)'],
  ];
  for (const [stderr, reason] of cases) {
    const t = withPr({});
    t.gh.set('pr-checks', { exit: 1, stderr });
    const it = pr6(t);
    assert.equal(it.status, 'blocked');
    assert.equal(it.reason, reason);
    assert.equal(it.details.ghTooOld, undefined);
    assert.equal(asked(t), 0);
  }
  const t = withPr({});
  t.gh.set('pr-checks', { stdout: 'not json' });
  const it = pr6(t);
  assert.equal(it.reason, 'cannot read the checks: gh pr checks returned unreadable output');
  assert.equal(it.details.ghTooOld, undefined);
  assert.equal(asked(t), 0);
  // A missing gh and a timeout, through a stub: the unknown-flag text does not matter then.
  const calls = [];
  const stub = (r) => (args) => { calls.push(args); return { status: null, stdout: '', stderr: OLD_FLAG('json'), missing: false, timedOut: false, overflowed: false, ...r }; };
  for (const [r, why] of [[{ missing: true }, 'gh is not installed or not on PATH'], [{ timedOut: true }, 'gh timed out']]) {
    calls.length = 0;
    const got = checksItem({ pr: { number: 12 } }, stub(r));
    assert.equal(got.status, 'blocked');
    assert.equal(got.reason, `cannot read the checks: ${why}`);
    assert.equal(got.details.ghTooOld, undefined);
    assert.deepEqual(calls.filter((c) => c[0] === '--version'), []);
  }
});

test('gh-version 9: a readable answer asks for no version (AC-6)', () => {
  const lists = [
    [{ stdout: [check('build', 'pass')] }, 'met'],
    [{ exit: 8, stdout: [check('build', 'pending')] }, 'open'],
  ];
  for (const [answer, status] of lists) {
    const t = withPr({});
    t.gh.set('pr-checks', answer);
    assert.equal(pr6(t).status, status);
    assert.equal(versionsOf(t).length, 0);
  }
  const t = withPr({});
  t.gh.set('pr-checks', { exit: 1, stderr: "no required checks reported on the 'b' branch\n" }, 1);
  t.gh.set('pr-checks', { stdout: [check('build', 'pass')] }, 2);
  assert.equal(pr6(t).status, 'met');
  assert.equal(versionsOf(t).length, 0);
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

// The real round-1 line of release-rebase-pin (af4055a, test-coverage-reviewer.md): approved, with an open important.
// Copied here because CI checks out shallow.
const REAL_ROUND1_LINE = "- [important] [6] \"at every rebase stop\" has no multi-stop test: every pin test in release-rebase.test.mjs:440-520 has one change commit, so the pin branch of the loop at release-rebase.mjs:270 runs once. With two change commits that both touch docs/openspec-flow.md, a bug that reuses a stale `pinMerged` or `baseVersion`, or that fails at the second stop, stays green. · write in: release-rebase.test.mjs, with releaseRepo plus a second commit on feature (style of the \"second entry\" test near :304), asserting exit 0 and both edits present.";

function approvedWithOpenFinding(severity) {
  const root = gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } } });
  const text = REAL_ROUND1_LINE.replace('[important]', `[${severity}]`);
  put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': `Verdict: approved\nCommit: ${'c'.repeat(40)}\n\n### Findings\n${text}\n` });
  const item3 = findingsItem(root, 'feat');
  assert.equal(item3.status, 'open');
  return item3;
}

test('nextStep: an approved review at the current commit with an undisposed important finding goes to fix-review with that finding (AC-6)', () => {
  for (const severity of ['important', 'blocking']) {
    const n = nextStep(state({
      reviews: [{ name: 'code-quality-reviewer', verdict: 'APPROVED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
      items: { 3: approvedWithOpenFinding(severity) },
    }));
    assert.equal(n.step, 'fix-review', severity);
    assert.deepEqual(n.reviewers, ['test-coverage-reviewer']);
    assert.equal(n.findings.length, 1);
    assert.ok(n.findings[0].excerpt.startsWith(`[${severity}] [6] "at every rebase stop"`), n.findings[0].excerpt);
    assert.match(n.reason, /test-coverage-reviewer approved with an undisposed finding/);
  }
});

test('nextStep: a rejected review and an approved one with an open finding give one fix-review with both reviewers and both findings', () => {
  const item3 = approvedWithOpenFinding('important');
  const undisposed = [{ reviewer: 'code-quality-reviewer', excerpt: '[blocking] x' }, ...item3.details.undisposed];
  const n = nextStep(state({
    reviewMd: { consensus: 'FAIL', round: 1 },
    reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
    items: { 3: open({ undisposed }) },
  }));
  assert.equal(n.step, 'fix-review');
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
  assert.deepEqual(n.findings.map((f) => f.reviewer), ['code-quality-reviewer', 'test-coverage-reviewer']);
  assert.match(n.reason, /code-quality-reviewer rejected at the current commit; test-coverage-reviewer approved with an undisposed finding/);
});

test('nextStep: an approved but stale review with an undisposed finding is still reviewed', () => {
  const n = nextStep(state({
    reviews: [{ name: 'code-quality-reviewer', verdict: 'APPROVED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: false }],
    items: { 2: open({ stale: ['test-coverage-reviewer'] }), 3: approvedWithOpenFinding('important') },
  }));
  assert.deepEqual([n.step, n.reviewers], ['review', ['test-coverage-reviewer']]);
});

test("review round: findingsItem reads findingLine's refuted line as refuted and its open line as undisposed", () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } } });
  const f = (over) => ({ id: 'F1', severity: 'important', location: 'a.mjs:1', text: 'a problem', disposition: null, ...over });
  const lines = [
    findingLine(f({ disposition: 'refuted: a.mjs:1 shows it is fine / the test passes' })),
    findingLine(f({ id: 'F2', severity: 'blocking', text: 'still open' })),
    findingLine(f({ id: 'F3', severity: 'nit', text: 'only a nit' })),
  ];
  put(root, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': `Verdict: rejected\nCommit: ${'d'.repeat(40)}\n\n### Findings\n${lines.join('\n')}\n` });
  const it = findingsItem(root, 'feat');
  assert.equal(it.details.refuted, 1);
  assert.equal(it.details.undisposed.length, 1);
  assert.ok(it.details.undisposed[0].excerpt.startsWith('[blocking] a.mjs:1 — still open'), it.details.undisposed[0].excerpt);
});

test("review round: readReviewMd reads consolidate's Consensus line and round", () => {
  const root = gitRepo();
  const mk = (round, text) => {
    const args = { change: 'feat', changeDir: 'openspec/changes/feat', round, path: 'agents', range: 'main..HEAD', structural: 'PASS', preamble: '', bench: [{ reviewer: 'code-quality-reviewer', previous: null, range: null }] };
    const s = validateStage1('code-quality-reviewer', { declined: false, commit: 'e'.repeat(40), uncommitted: false, heading: '## h', read: ['a.mjs'], notRead: [], findings: [{ severity: 'important', location: 'x', text }], sections: '' }, 'e'.repeat(40));
    return consolidate({ args, outcomes: [outcomeOf(args, s, {})], failed: [], notes: [] }).text;
  };
  const file = join(root, 'openspec/changes/feat/review.md');
  put(root, { 'openspec/changes/feat/review.md': mk(1, 'one') });
  assert.deepEqual(readReviewMd(file), { consensus: 'FAIL', round: 1 });
  put(root, { 'openspec/changes/feat/review.md': `${mk(1, 'one')}\n${mk(2, 'two')}` });
  assert.deepEqual(readReviewMd(file), { consensus: 'FAIL', round: 2 });
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

const BOTH = ['code-quality-reviewer', 'test-coverage-reviewer'];
const noReviews = (kind) => (kind === 'stale'
  ? { reviews: BOTH.map((name) => ({ name, verdict: 'APPROVED', current: false })), 2: open({ stale: BOTH }) }
  : { reviews: [], 2: open({ missing: BOTH }) });

test('AC-1 evidence-first: missing or stale evidence with both reviewers missing or stale goes to verify, not review', () => {
  for (const evidence of [{ 1: open({ evidence: 'missing' }) }, { 4: open({ evidence: 'stale', proven: [] }) }]) {
    for (const kind of ['missing', 'stale']) {
      const r = noReviews(kind);
      const n = nextStep(state({ reviews: r.reviews, items: { ...evidence, 2: r[2] } }));
      assert.equal(n.step, 'verify', `${JSON.stringify(evidence)} ${kind}`);
    }
  }
});

test('AC-1 evidence-first: current evidence with no defect and the reviewers missing goes to review with both, round 1', () => {
  const r = noReviews('missing');
  const n = nextStep(state({ reviews: r.reviews, items: { 2: r[2] } }));
  assert.deepEqual([n.step, n.reviewers, n.round], ['review', BOTH, 1]);
});

test('AC-2 defect-before-review: a defect row at current evidence goes to fix-defect with the reviewers missing, stale, or approved', () => {
  const defect = { 4: open({ defects: ['AC-1'], proven: [] }) };
  for (const kind of ['missing', 'stale']) {
    const r = noReviews(kind);
    const n = nextStep(state({ reviews: r.reviews, items: { ...defect, 2: r[2] } }));
    assert.deepEqual([n.step, n.defects], ['fix-defect', ['AC-1']], kind);
  }
  assert.equal(nextStep(state({ items: defect })).step, 'fix-defect', 'approved, nothing undisposed');
});

test('D2: a current rejected review beside a current defect gives fix-review, before fix-defect', () => {
  const n = nextStep(rejectedState({ items: { 4: open({ defects: ['AC-1'], proven: [] }) } }));
  assert.equal(n.step, 'fix-review');
});

test('D2: a round-2 deadlock stays first, with the evidence missing', () => {
  const n = nextStep(rejectedState({ reviewMd: { consensus: 'FAIL', round: 2 }, items: { 1: open({ evidence: 'missing' }) } }));
  assert.equal(n.step, 'stop-review-deadlock');
});

test('D2: a no-proof criterion at current evidence still reviews, then blocks at item 4', () => {
  const noProof = blocked({ noProof: ['AC-1'], proven: [] });
  const r = noReviews('missing');
  assert.equal(nextStep(state({ reviews: r.reviews, items: { 2: r[2], 4: noProof } })).step, 'review');
  const stuck = nextStep(state({ items: { 4: noProof } }));
  assert.deepEqual([stuck.step, stuck.item], ['blocked', 4]);
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
// A devkit-lite change `feat` with ship: pr, on branch ship/feat, committed. `extra` is config text appended to
// openspec/config.yaml before the first commit (release-tags: a `devkit:` block).
function shipRepo({ ship = 'pr', method = '', extra = '' } = {}) {
  const root = gitRepo({
    config: `schema: devkit-lite\nship:\n  devkit-lite: ${ship}\n${method ? `merge_method: ${method}\n` : ''}${extra}`,
    changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1', 'AC-2']), 'tasks.md': TASKS } },
    files: { 'src/a.ts': 'a\n', ...(ship === 'merge' ? { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' } : {}) },
  });
  git(root, 'switch', '-q', '-c', 'ship/feat');
  const gh = fakeGh();
  if (ship === 'merge') presetSetup(gh);
  if (ship !== 'plan') gh.set('pr-list', { stdout: [] });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
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
  if (ship === 'merge') presetSetup(gh);
  if (ship !== 'plan') gh.set('pr-list', { stdout: [] });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
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

// ---------------------------------------------------------------- plan approval on disk (conduct-rounds D7, AC-5)

const readinessHash = (root, id = 'feat') => `sha256:${createHash('sha256').update(readFileSync(join(root, 'openspec', 'changes', id, 'readiness.md'))).digest('hex').slice(0, 12)}`;
const approvalMd = (hash) => `# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: 2026-11-09\n- Owner's words: "Aprovo"\n`;
// An approved devkit change with phase 1 not started, unless `tasks` says otherwise.
function planRepo({ tasks = '## 1. First\n- [ ] 1.1 code\n', approval } = {}) {
  const t = devkitRepo({ readiness: 'APPROVED' });
  put(t.root, { 'openspec/changes/feat/tasks.md': tasks });
  if (approval) put(t.root, { 'openspec/changes/feat/approval.md': typeof approval === 'function' ? approval(readinessHash(t.root)) : approval });
  return t;
}

test('stop-plan-approval: APPROVED readiness with no approval.md waits for the owner, naming the readiness hash (AC-5)', () => {
  const t = planRepo();
  const next = nextStep(t.state());
  assert.equal(next.step, 'stop-plan-approval');
  assert.equal(next.readiness, readinessHash(t.root));
  assert.match(next.readiness, /^sha256:[0-9a-f]{12}$/);
  assert.equal(next.file, 'openspec/changes/feat/approval.md');
  assert.match(next.reason, /no recorded owner approval/);
  const j = buildReport(t.state());
  assert.equal(j.summary, "waiting for the owner's plan approval");
  assert.equal(j.version, 1);
  assert.deepEqual(j.approval, { status: null, recorded: null, readiness: readinessHash(t.root), ok: false });
});

test('stop-plan-approval: the row sits after stop-not-approved and before the merge setup stop', () => {
  const t = planRepo();
  put(t.root, { 'openspec/changes/feat/readiness.md': '- Status: BLOCKED\n' });
  assert.equal(nextStep(t.state()).step, 'stop-not-approved');
  const m = devkitRepo({ ship: 'merge', readiness: 'APPROVED' });
  put(m.root, { 'openspec/changes/feat/tasks.md': '## 1. First\n- [ ] 1.1 code\n' });
  assert.equal(nextStep(m.state()).step, 'stop-plan-approval', 'before stop-merge-setup');
});

test('stop-plan-approval: a current approval.md lets implement start (AC-5)', () => {
  const t = planRepo({ approval: approvalMd });
  const s = t.state();
  assert.equal(s.approval.ok, true);
  assert.equal(nextStep(s).step, 'implement');
  assert.equal(buildReport(s).approval.ok, true);
});

test('stop-plan-approval: an approval of an earlier readiness.md asks the owner again (AC-5)', () => {
  const t = planRepo({ approval: approvalMd('sha256:000000000000') });
  const next = nextStep(t.state());
  assert.equal(next.step, 'stop-plan-approval');
  assert.match(next.reason, /earlier readiness/);
  assert.equal(next.readiness, readinessHash(t.root));
  assert.equal(buildReport(t.state()).approval.recorded, 'sha256:000000000000');
  put(t.root, { 'openspec/changes/feat/approval.md': approvalMd(readinessHash(t.root)).replace('APPROVED', 'REJECTED') });
  assert.equal(nextStep(t.state()).step, 'stop-plan-approval', 'a Status other than APPROVED is no approval');
  put(t.root, { 'openspec/changes/feat/approval.md': approvalMd(readinessHash(t.root)).toUpperCase() });
  assert.equal(nextStep(t.state()).step, 'implement', 'the hash is compared without case');
});

test('stop-plan-approval: a change with a ticked task keeps running without approval.md (the started exemption)', () => {
  const t = planRepo({ tasks: '## 1. First\n- [x] 1.1 code\n- [ ] 1.2 more\n' });
  const s = t.state();
  assert.equal(s.started, true);
  assert.equal(nextStep(s).step, 'implement');
  assert.equal(planRepo().state().started, false);
});

test('stop-plan-approval: devkit-lite never gets this row, and its JSON has no approval object', () => {
  const t = shipRepo();
  put(t.root, { 'openspec/changes/feat/tasks.md': '## 1. First\n- [ ] 1.1 code\n' });
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.notEqual(nextStep(s).step, 'stop-plan-approval');
  assert.equal('approval' in buildReport(s), false);
});

test('stop-plan-approval: the CLI exits 1 with the summary and the approval object', () => {
  const t = planRepo();
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.next.step, 'stop-plan-approval');
  assert.equal(j.summary, "waiting for the owner's plan approval");
  assert.equal(j.approval.ok, false);
  assert.match(runCli(t, ['feat']).out, /next: stop-plan-approval/);
});

test('approvalState: no file, a current file and a stale file', () => {
  const t = planRepo();
  const dir = join(t.root, 'openspec', 'changes', 'feat');
  const hash = readinessHash(t.root);
  assert.deepEqual(approvalState(dir), { status: null, recorded: null, readiness: hash, ok: false });
  put(t.root, { 'openspec/changes/feat/approval.md': approvalMd(hash) });
  assert.deepEqual(approvalState(dir), { status: 'APPROVED', recorded: hash, readiness: hash, ok: true });
  put(t.root, { 'openspec/changes/feat/approval.md': approvalMd('sha256:abc') });
  assert.equal(approvalState(dir).ok, false);
  assert.equal(RELEASE_FILE.test('CHANGELOG.md'), true, 'RELEASE_FILE is exported');
});

test('--ci output is unchanged by the approval row: no approval object, same pass or fail (AC-5)', () => {
  const t = planRepo();
  const r = ciMain(['--json'], t.env, t.root);
  const j = JSON.parse(r.stdout);
  assert.equal('approval' in j, false);
  assert.deepEqual(Object.keys(j.readiness), ['status', 'met']);
  assert.equal(j.readiness.met, true);
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
  fullEvidence(t.root, t.env);
  let n = t.next();
  assert.deepEqual([n.step, n.reviewers, n.round], ['review', ['test-coverage-reviewer'], 1]);

  // both reviewed, then product code changes: only the reviewer left behind is stale
  const old = head(t.root);
  reviewAt(t.root, ['code-quality-reviewer', 'test-coverage-reviewer'], old);
  commitAll(t.root, 'reviews');
  put(t.root, { 'src/a.ts': 'fixed\n' });
  commitAll(t.root, 'fix after review');
  reviewAt(t.root, ['code-quality-reviewer']);
  fullEvidence(t.root, t.env);
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
  assert.deepEqual(driveToReady(shipRepo()), ['implement', 'gate', 'implement', 'gate', 'commit', 'verify', 'review', 'open-pr', 'ready']);
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
  assert.equal(t.next().step, 'verify');
  fullEvidence(t.root, t.env);
  n = t.next();
  assert.deepEqual([n.step, n.round], ['review', 1]);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
});

// A devkit-lite change driven to ready: code, reviews and evidence current, PR open, one commit ahead of nothing.
function readyRepo() {
  const t = shipRepo();
  assert.equal(driveToReady(t).at(-1), 'ready');
  return t;
}
const productCommit = (t, text = 'a later product change\n') => { put(t.root, { 'src/a.ts': text }); return commitAll(t.root, 'product change'); };

test('AC-3 fix-restales-both (a): after a rejected review and its fix commit, verify comes first and then review at round 2', () => {
  const t = readyRepo();
  put(t.root, withReviews({ 'code-quality-reviewer': review('rejected', head(t.root)), 'test-coverage-reviewer': review('approved', head(t.root)) }));
  put(t.root, changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n' }));
  assert.equal(t.next().step, 'fix-review');
  productCommit(t);
  assert.equal(t.next().step, 'verify');
  fullEvidence(t.root, t.env);
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 2, ['code-quality-reviewer', 'test-coverage-reviewer']]);
});

test('AC-3 fix-restales-both (b): after a fail row and its fix commit, verify comes first and then review', () => {
  const t = readyRepo();
  ev(t.root, `Commit: ${head(t.root)}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${gateRow('node -e 0', 'pass: ok')}${gateRow('node -v', 'pass: ok')}\n### Acceptance\n${acRow('AC-1', 'fail: red')}${acRow('AC-2', 'verified: r')}`);
  assert.equal(t.next().step, 'fix-defect');
  productCommit(t);
  assert.equal(t.next().step, 'verify');
  fullEvidence(t.root, t.env);
  assert.deepEqual([t.next().step], ['review']);
});

test('AC-3 fix-restales-both (c): after a failing check and its fix commit, verify, then review, then push', () => {
  const t = readyRepo();
  t.gh.set('pr-checks', { exit: 1, stdout: [check('build', 'fail')] });
  assert.equal(t.next().step, 'fix-checks');
  productCommit(t);
  let n = t.next();
  assert.equal(n.step, 'verify');
  fullEvidence(t.root, t.env);
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', ['code-quality-reviewer', 'test-coverage-reviewer']]);
  reviewAt(t.root, n.reviewers);
  assert.equal(t.next().step, 'push');
});

// ---- AC-4: evidence.md and reviews/*.md written one after the other never stale each other (design D3)

function committedChange() {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  return t;
}
const itemsOf = (t) => collectState(t.root, 'feat', { env: t.env }).items;
const bothEvidenceCurrent = (t) => { const i = itemsOf(t); return [i[0].details.evidence, i[3].details.evidence]; };

test('AC-4 no-mutual-staleness: reviews written after the evidence leave the evidence current, uncommitted and committed', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  reviewAt(t.root, BOTH);
  assert.deepEqual(bothEvidenceCurrent(t), ['current', 'current'], 'reviews uncommitted');
  commitAll(t.root, 'reviews');
  assert.deepEqual(bothEvidenceCurrent(t), ['current', 'current'], 'reviews committed');
});

test('AC-4 no-mutual-staleness: evidence written after the reviews leave item 2 met, uncommitted and committed', () => {
  const t = committedChange();
  reviewAt(t.root, BOTH);
  fullEvidence(t.root, t.env);
  assert.equal(itemsOf(t)[1].status, 'met', 'evidence uncommitted');
  commitAll(t.root, 'evidence');
  assert.equal(itemsOf(t)[1].status, 'met', 'evidence committed');
});

test('AC-4 no-mutual-staleness: control, a product commit in between does make them stale', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  productCommit(t);
  assert.deepEqual(bothEvidenceCurrent(t), ['stale', 'stale']);
  const u = committedChange();
  reviewAt(u.root, BOTH);
  productCommit(u);
  assert.equal(itemsOf(u)[1].status, 'open');
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
  t.gh.prFiles(12, ['openspec/changes/feat/tasks.md', 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '1.2'] }));
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

test('nextStep: a merged PR leads to the archive steps and never to a final "merged" step, before every other row (archive-after-merge R-9)', () => {
  const archive = { base: 'main', branch: 'chore/archive-feat', onDefault: 'active', retro: { exists: false, readable: false, proposals: [] }, roadmap: { listed: false, ticked: false, line: null }, dirty: [], pr: null, local: 'active', changePr: { number: 12, url: 'u' } };
  const s = withItem(5, 'met', { merged: true }, { pr: prOf({ state: 'MERGED' }), dirty: ['src/a.ts'], archive });
  assert.deepEqual([nextStep(s).step, nextStep(s).number], ['retro', 12]);
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

test('merge mode: a MERGED PR is the first archive step (retro), exit 0, and the merge object says so (AC-1)', () => {
  const t = mergeReady({ state: 'MERGED' });
  presetArchiveReads(t);
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.met, j.summary, j.next.step, j.merge.state], [8, 'merged: archive step retro', 'retro', 'MERGED']);
  assert.match(runCli(t, ['feat']).out, /^8\/8 met: merged: archive step retro$/m);
});

// The GitHub reads of the post-merge phase for a change whose folder is still on main and has no archive PR.
function presetArchiveReads(t) {
  // The change's own pull request #12 changed its folder and every task is ticked on main (field-fixes D-4).
  t.gh.prFiles(12, ['openspec/changes/feat/tasks.md', 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '1.2'] }));
  t.gh.set(ARCHIVE_LISTING, { stdout: [] });
  t.gh.set(ACTIVE_ON_MAIN, { stdout: {} });
  t.gh.set(ARCHIVE_PRS, { stdout: [] });
}

test('merge mode: a PR behind its base is update-branch with the item 5 reason', () => {
  const t = mergeReady({ mergeStateStatus: 'BEHIND' });
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.deepEqual([j.next.step, j.next.number], ['update-branch', 12]);
  assert.match(j.items[4].reason, /behind main/);
});

// ---- carry-over from the readiness review: a PR merged right after enable-auto-merge must still be found

test('carry-over: after an immediate merge the branch no longer finds the PR; it is looked up by head branch among merged PRs and leads to the retro (AC-4, AC-1)', () => {
  const t = mergeReady();
  presetArchiveReads(t);
  const merged = prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY });
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  t.gh.set('pr-list', { stdout: [merged] });
  const j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.deepEqual([j.summary, j.next.step, j.pr.number], ['merged: archive step retro', 'retro', 12]);
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

test('carry-over: pr mode with a MERGED PR leads to the archive steps (R-3), plan mode still stops, and plan mode never looks the PR up by branch', () => {
  const t = shipRepo({ ship: 'pr' });
  driveToReady(t);
  presetSetup(t.gh);
  presetArchiveReads(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  let j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(runCli(t, ['feat']).code, 0);
  assert.deepEqual([j.summary, j.next.step], ['merged: archive step retro', 'retro']);
  assert.match(j.items[4].reason, /PR #12 merged/);
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.items[4].details.none, true, 'as in 0.4.0: no PR found is open');
  const before = t.gh.calls().length;
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit-lite: plan\n');
  j = JSON.parse(runCli(t, ['feat', '--json']).out);
  assert.equal(j.next.step, 'stop-plan-mode');
  assert.ok(!t.gh.calls().slice(before).some((c) => c[1] === 'list'), 'no pr list in plan mode');
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

test('--watch at wait-merge: polls gh pr view <n> until MERGED, then collects again and goes on to the retro (AC-4, AC-1)', () => {
  const t = waiting();
  presetArchiveReads(t);
  t.gh.set('pr-view', { stdout: t.pr(on) }, 1);
  t.gh.set('pr-view', { stdout: t.pr(on) }, 2);
  t.gh.set('pr-view', { stdout: t.pr({ state: 'MERGED' }) });
  const r = t.run();
  assert.equal(r.code, 0, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step], ['merged: archive step retro', 'retro']);
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
  const r = makeGh(tmpRoot(), gh.env, 400)(['api', 'repos/{owner}/{repo}']);
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

test('walkthrough (merge): enable at 8/8, wait, a product commit disables first, the loop re-runs, enable again, then the retro', () => {
  const t = shipRepo({ ship: 'merge' });
  const taken = driveToReady(t);
  assert.deepEqual(taken, ['implement', 'gate', 'implement', 'gate', 'commit', 'verify', 'review', 'open-pr', 'enable-auto-merge']);

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
  fullEvidence(t.root, t.env);
  n = step();
  seen.push(n.step);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
  reviewAt(t.root, n.reviewers);
  seen.push(step().step);

  commitAll(t.root, 'ship change files'); // the push
  pr({}, head(t.root));
  n = step();
  seen.push(n.step);
  assert.deepEqual([n.number, n.method, n.head], [12, 'squash', head(t.root)]);

  pr(on, head(t.root));
  seen.push(step().step);
  pr({ state: 'MERGED' }, head(t.root));
  presetArchiveReads(t);
  seen.push(step().step);

  assert.deepEqual(seen, ['enable-auto-merge', 'wait-merge', 'disable-auto-merge', 'verify', 'review', 'push', 'enable-auto-merge', 'wait-merge', 'retro']);
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
  assert.notEqual(runCli(t, ['gone']).code, 3, 'an archived change answers (archive-after-merge D3)');
  assert.equal(runCli(t, ['neverexisted']).code, 3);
  const bare = tmpFolder('devkit-bare-');
  const r = runCli(t, ['feat'], { cwd: bare });
  assert.equal(r.code, 3);
  assert.match(r.err, /openspec/);
});

test('CLI: openspec/ without a git repo is a clear usage error, not a raw git fatal', () => {
  const dir = tmpFolder('devkit-nogit-');
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

// ---- field item 9: --watch also waits at stop-merge-setup (merge-setup-field-fixes, D-1)

// A merge-mode change whose repository has no rule requiring devkit-reviews, with a check pending.
function setupPending() {
  const t = mergeReady();
  presetSetup(t.gh, { rules: [] });
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] });
  t.gh.resetCount('pr-checks');
  return t;
}

test('field-fixes 9 watch: at stop-merge-setup with a check pending, one gh pr checks --watch runs and the report shows the final checks (AC-1)', () => {
  const t = setupPending();
  t.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  t.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  t.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const r = runCli(t, ['feat', '--watch=1']);
  assert.equal(r.code, 2, r.out + r.err);
  assert.deepEqual(watchCalls(t), [['pr', 'checks', '12', '--watch', '--interval', '30', '--required']]);
  assert.match(r.out, /^ {2}6 met\s/m);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.match(r.out, /^8\/8 met: blocked: merge setup$/m);
  assert.match(r.out, /^watch: ended$/m);
  const u = setupPending();
  u.gh.set('pr-checks-watch', { exit: 0, stdout: '' });
  u.gh.set('pr-checks', { stdout: [check('build', 'pass'), check('e2e', 'pass')] }, 2);
  u.gh.set('pr-checks', { exit: 8, stdout: [check('build', 'pass'), check('e2e', 'pending')] }, 1);
  const j = JSON.parse(runCli(u, ['feat', '--json', '--watch=1']).out);
  assert.equal(j.next.step, 'stop-merge-setup');
  assert.deepEqual(j.watch, { minutes: 1, timedOut: false });
});

test('field-fixes 9 watch: the cap stops the watch, item 6 still names the pending check and the step is stop-merge-setup (AC-1)', () => {
  const t = setupPending();
  t.gh.set('pr-checks-watch', { exit: 0, sleep: 20000 });
  const started = Date.now();
  const r = runCli(t, ['feat', '--watch=0.02']);
  assert.ok(Date.now() - started < 15000, 'the cap ended the watch');
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out, /^watch: stopped after 0\.02 minutes$/m);
  assert.match(r.out, /^ {2}6 \S+\s.*e2e/m);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.equal(watchCalls(t).length, 1, 'exactly one watch');
});

test('field-fixes 9 watch: no pending check, or no pull request, starts no watch (AC-1)', () => {
  const t = mergeReady();
  presetSetup(t.gh, { rules: [] });
  runCli(t, ['feat', '--watch=1']);
  assert.equal(watchCalls(t).length, 0, 'no check pending');
  const u = shipRepo({ ship: 'merge' });
  presetSetup(u.gh, { rules: [] });
  runCli(u, ['feat', '--watch=1']);
  assert.equal(watchCalls(u).length, 0, 'no pull request');
});

test('field-fixes 9 watch: without --watch no watch starts at stop-merge-setup (AC-1)', () => {
  const t = setupPending();
  const r = runCli(t, ['feat']);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.out, /^next: stop-merge-setup: /m);
  assert.equal(watchCalls(t).length, 0);
});

test('field-fixes 9 watch: no watch target in the archive phase or for a MERGED or CLOSED pull request, even with a check pending (AC-1)', () => {
  const t = setupPending();
  const state = DC.collectState(t.root, 'feat', { env: t.env });
  const next = { step: 'stop-merge-setup' };
  assert.deepEqual(DC.checksToWatch(state, next), { number: 12, required: state.items[5].details.required }, 'the open pull request with a check pending is watched');
  assert.deepEqual(state.items[5].details.pending, ['e2e']);
  for (const prState of ['MERGED', 'CLOSED']) {
    assert.equal(DC.checksToWatch({ ...state, pr: { ...state.pr, state: prState } }, next), null, `${prState} pull request`);
  }
  assert.equal(DC.checksToWatch({ ...state, archive: { branch: 'chore/archive-feat' } }, next), null, 'archive phase');
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

// AC-6 instructions-follow: every text that sequences the delivery steps says evidence first, then review (design D6)
const OLD_ORDER = [
  'review → evidence', 'review + evidence', 'reviews + evidence', 'pr-verifier ◀── review-change',
  '1. Run the review-change skill', 'then dispatch devkit-core:pr-verifier',
  '`review-change`, `pr-verifier`', 'for only the reviewers that went stale, `pr-verifier`',
  'reviews, verifies', 'scoped re-review, `verify`', '`review` and `verify` follow',
  'then dispatch `pr-verifier`', 'review with a bench of specialist reviewers, verify',
  '`review-change` with six specialist reviewers, `pr-verifier`',
  // the panel's old phrases (design D7)
  "'review', 'proofs'", 'Revisão, Provas', 'revisão, provas', 'review, proofs',
];
const textOf = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');
const before = (text, first, second, what) => {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  assert.ok(a >= 0, `${what}: has ${first}`);
  assert.ok(b >= 0, `${what}: has ${second}`);
  assert.ok(a < b, `${what}: ${first} comes before ${second}`);
};

test('AC-6 instructions-follow: the schema copies are identical and dispatch pr-verifier before review-change', () => {
  for (const s of ['devkit', 'devkit-lite']) {
    const plugin = textOf('plugins', 'openspec', 'schemas', s, 'schema.yaml');
    assert.equal(textOf('openspec', 'schemas', s, 'schema.yaml'), plugin, `${s} copies are byte-identical`);
    const apply = plugin.slice(plugin.indexOf('\napply:'));
    before(apply, 'pr-verifier', 'review-change', `${s} apply`);
    assert.match(plugin, /^description: .*evidence \+ review before the PR/m, `${s} description`);
  }
});

test('AC-6 instructions-follow: configs, ship-change, devkit, flow doc and READMEs name evidence before review', () => {
  for (const f of [['plugins', 'openspec', 'skills', 'openspec-setup', 'templates', 'config.yaml'], ['openspec', 'config.yaml']]) {
    const t = textOf(...f);
    const line = t.split('\n').find((l) => l.includes('devkit-core:pr-verifier') && l.includes('review-change'));
    assert.ok(line, `${f.join('/')} guidance line`);
    before(line, 'devkit-core:pr-verifier', 'review-change', f.join('/'));
    assert.match(t, /apply →\s*(?:#\s*)?evidence \+ reviews/, `${f.join('/')} header`);
  }
  const ship = textOf('plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md');
  const mode = ship.split('\n').find((l) => l.includes('`tdd-implementer`') && l.includes('`review-change`'));
  assert.ok(mode, 'ship-change Mode paragraph');
  before(mode, '`pr-verifier`', '`review-change`', 'ship-change Mode');
  assert.match(ship, /verifies, reviews, opens the PR/);
  const devkit = textOf('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const loop = devkit.slice(devkit.indexOf('## Loop'), devkit.indexOf('## Owner gates'));
  before(loop, '`verify`', '`review`', 'devkit Loop');
  const flow = textOf('docs', 'openspec-flow.md');
  const applyLine = flow.split('\n').find((l) => l.startsWith('`apply` requires `approval`'));
  assert.ok(applyLine, 'flow doc apply paragraph');
  before(applyLine, '`pr-verifier`', '`review-change`', 'flow doc apply');
  assert.match(flow, /\*\*Order of the delivery steps\.\*\*/);
  for (const f of [['plugins', 'core', 'README.md'], ['README.md']]) {
    assert.ok(textOf(...f).includes('review-change ◀── pr-verifier'), `${f.join('/')} diagram`);
  }
});

test('AC-6 instructions-follow: no tracked file outside the records still says review before evidence', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => !f.startsWith('openspec/changes/') && f !== 'CHANGELOG.md' && !f.startsWith('plugins/panel/hooks/fixtures/')
      && f !== 'plugins/openspec/hooks/deliver-check.test.mjs' && existsSync(join(repoRoot, f)));
  const hits = [];
  for (const f of files) {
    let t;
    try { t = readFileSync(join(repoRoot, f), 'utf8'); } catch { continue; }
    for (const p of OLD_ORDER) if (t.includes(p)) hits.push(`${f}: ${p}`);
  }
  assert.deepEqual(hits, []);
});

test('format: ship-change names every next.step the checker can return', () => {
  const md = readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const steps = ['stop-plan-mode', 'stop-branch', 'stop-not-approved', 'stop-plan-approval', 'implement', 'gate', 'commit', 'stop-review-deadlock', 'fix-review', 'review', 'fix-defect', 'verify', 'blocked', 'open-pr', 'push', 'edit-pr-body', 'fix-checks', 'answer', 'wait-checks', 'ready',
    'stop-merge-setup', 'disable-auto-merge', 'update-branch', 'enable-auto-merge', 'wait-merge',
    'retro', 'stop-retro-answers', 'archive', 'tick-roadmap', 'apply-proposals', 'open-archive-pr', 'archive-pr-ready', 'stop-archive', 'archived', 'tag-release'];
  for (const s of steps) assert.ok(md.includes(`\`${s}\``), `names step ${s}`);
  assert.ok(!steps.includes('merged') && !/^\|[^|]*`merged`[^|]*\|/m.test(md), 'no `merged` row: it is a state now, not an end (D7)');
  // whatever nextStep can emit has a row in the table, so a new step cannot ship without the skill
  const src = readFileSync(join(repoRoot, 'plugins', 'openspec', 'hooks', 'deliver-check.mjs'), 'utf8');
  const emitted = [...new Set([...src.matchAll(/\bstep\('([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(emitted.length >= steps.length - 1, 'found the steps in nextStep');
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
  for (const report of ['archived', 'archive PR open: waiting for', 'archive PR ready', 'archive: waiting for the owner', 'blocked: archive (', 'auto-merge on: waiting for', 'blocked: merge setup']) assert.ok(md.includes(report), `Report names ${report}`);
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

test('AC-5 guards-kept: --ci with only the reviews re-recorded at a later product commit fails with items 1 and 4', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  put(root, withReviews(reviews(head(root))));
  commitAll(root, 'reviews only');
  const r = runCi(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^fail: item 1, item 4$/m);
});

test('AC-5 guards-kept: --ci with only the evidence re-recorded at a later product commit fails with item 2', () => {
  const root = ciRepo();
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'later product commit');
  const sha = head(root);
  ev(root, `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}`);
  commitAll(root, 'evidence only');
  const r = runCi(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^fail: item 2$/m);
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
  const dir = tmpFolder('devkit-noopenspec-');
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
  const dir = tmpFolder('devkit-nogit-ci-');
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

// Invariant (field-fixes 3, ADR 0012): the one touched change is selected; two touched changes are each judged when delivered.
test('--ci selection 3: with GITHUB_BASE_REF the one active change the PR diff touches is selected, two are each judged (R-3)', () => {
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
  assert.equal(two.code, 0, two.out + two.err);
  assert.match(two.out, /^devkit-reviews: 2 changes touched by this PR \(feat, other\)$/m);
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

// A base where `x` was squash-merged (still active, unproven) next to the `others`, and a PR branch that archives it.
// The retro approves `src/a.ts` by default; `retro` and `files` override what the PR carries.
const X_RETRO = '## Proposed updates\n\n### `src/a.ts` (process-friction)\nSummary.\n- Answer: approved\n- Applied: yes\n';
function archivePrRepo({ branch = 'chore/archive-x', others = [], retro = X_RETRO, files = {}, schema = 'devkit-lite' } = {}) {
  const root = gitRepo({ branch: 'main', changes: Object.fromEntries(['x', ...others].map((n) => [n, { ...changeFilesOf(), ...(n === 'x' ? { '.openspec.yaml': `schema: ${schema}\n` } : {}) }])), files: { 'src/a.ts': 'a\n', 'openspec/roadmap.md': '## R\n- [ ] x\n' } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', branch);
  git(root, 'mv', 'openspec/changes/x', 'openspec/changes/archive/2026-11-09-x');
  put(root, { ...(retro === null ? {} : { 'openspec/changes/archive/2026-11-09-x/retro.md': retro }), 'openspec/roadmap.md': '## R\n- [x] x\n', 'src/a.ts': 'changed\n', ...files });
  commitAll(root, 'archive x');
  return root;
}

test('--ci on an archive branch: the PR that moves a squash-merged change passes when every file is named and every proposal answered, even beside an open change `merge` (archive-after-merge D2, AC-9)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  for (const [branch, others] of [['chore/archive-x', []], ['chore/archive-x', ['merge']], ['archive-x', []]]) {
    const root = archivePrRepo({ branch, others });
    const r = runCi(root, [], env);
    assert.equal(r.code, 0, `${branch} + ${others}: ${r.out}${r.err}`);
    assert.match(r.out, /archive.*2026-11-09-x/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
    const j = runCi(root, ['--json'], env).json();
    assert.deepEqual([j.change, j.pass, j.archive.unnamed, j.archive.unanswered], [null, true, [], []]);
  }
});

test('--ci on an archive branch: a changed file no approved proposal names fails the check, naming it (review blocker 3)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  for (const [label, opts, unnamed] of [
    ['an extra product file', { files: { 'src/other.ts': 'o\n' } }, ['src/other.ts']],
    ['openspec/config.yaml', { files: { 'openspec/config.yaml': 'schema: x\n' } }, ['openspec/config.yaml']],
    ['a file only a rejected proposal names', { retro: '## Proposed updates\n\n### `src/a.ts` (process-friction)\n- Answer: rejected: no\n' }, ['src/a.ts']],
    ['a file under a directory a proposal names', { retro: X_RETRO.replace('`src/a.ts`', '`src/`'), files: { 'src/b.ts': 'b\n' } }, ['src/a.ts', 'src/b.ts']],
  ]) {
    const root = archivePrRepo(opts);
    const r = runCi(root, [], env);
    assert.equal(r.code, 1, `${label}: ${r.out}${r.err}`);
    for (const p of unnamed) assert.ok(r.out.includes(p), `${label}: names ${p}`);
    assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: files no approved proposal names/, label);
    const j = runCi(root, ['--json'], env).json();
    assert.deepEqual([j.pass, j.archive.unnamed], [false, unnamed], label);
  }
});

test('--ci on an archive branch: an unanswered proposal, a retro without the section and a missing retro fail the check (review blocker 3)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  const unanswered = archivePrRepo({ retro: X_RETRO.replace('- Answer: approved\n', '') });
  const u = runCi(unanswered, [], env);
  assert.equal(u.code, 1, u.out + u.err);
  assert.match(u.out, /unanswered proposals: 1/);
  assert.deepEqual(runCi(unanswered, ['--json'], env).json().archive.unanswered, [1]);
  for (const retro of ['# Retro\n', null]) {
    const r = runCi(archivePrRepo({ retro }), [], env);
    assert.equal(r.code, 1, `${retro}: ${r.out}${r.err}`);
    assert.match(r.out, /retro\.md.*(missing|no "## Proposed updates")/);
  }
});

test('--ci: a PR that archives nothing, or a run without GITHUB_BASE_REF, keeps the "nothing to check" note (review blocker 3)', () => {
  const root = gitRepo({ branch: 'main', changes: { x: changeFilesOf() }, files: { 'src/a.ts': 'a\n' } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/docs');
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'docs');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /nothing to check/);
  const local = archivePrRepo({ files: { 'src/other.ts': 'o\n' } });
  assert.match(runCi(local).out, /nothing to check/, 'no base to compare with');
});

test('--ci on an archive branch never takes a contained open change, and a PR touching an active change\'s folder still selects it', () => {
  // `auto-merge` archived on chore/archive-auto-merge while `merge` is open: the contained-name rule must not pick `merge`.
  const root = gitRepo({ branch: 'main', changes: { 'auto-merge': changeFilesOf(), merge: changeFilesOf() } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', 'chore/archive-auto-merge');
  git(root, 'mv', 'openspec/changes/auto-merge', 'openspec/changes/archive/2026-11-09-auto-merge');
  put(root, { 'openspec/changes/archive/2026-11-09-auto-merge/retro.md': '## Proposed updates\n\nNone.\n' });
  commitAll(root, 'archive');
  const r = runCi(root, [], { GITHUB_BASE_REF: 'main' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  // Touching an active change's folder still selects it, archive branch or not.
  put(root, { 'openspec/changes/merge/notes.md': 'n\n' });
  commitAll(root, 'touch merge');
  assert.equal(runCi(root, ['--json'], { GITHUB_BASE_REF: 'main' }).json().change, 'merge');
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

// ---- field-fixes 3: the devkit-reviews check follows the change's script (spec reviews-check, ADR 0012)

const GUARD_FILE = join(here, 'guard.mjs');
// The same check through both entries: deliver-check.mjs --ci and guard.mjs ci.
function bothEntries(root, args = [], env = {}) {
  const viaDeliver = runCi(root, args, env);
  const r = spawnSync(process.execPath, [GUARD_FILE, 'ci', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...CI_ENV, ...env } });
  return [viaDeliver, { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) }];
}
const PLAN_TASKS = '## 1. First\n- [ ] 1.1 code\n- [ ] 1.2 Gate: `node -e 0` green\n';
// A repo whose `spec` changes sit on `main`, a PR branch that touches each of them, and (for `prove`) proves them at head.
// spec: { name: { schema = 'devkit-lite', tasks = CI_TASKS } }
function severalRepo(spec, { prove = [], branch = 'chore/tidy' } = {}) {
  const changes = Object.fromEntries(Object.entries(spec).map(([n, o]) => [n, { ...changeFilesOf(), '.openspec.yaml': `schema: ${o.schema ?? 'devkit-lite'}\n`, 'tasks.md': o.tasks ?? CI_TASKS }]));
  const root = gitRepo({ branch: 'main', changes, files: { 'src/a.ts': 'a\n' } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', branch);
  put(root, Object.fromEntries(Object.keys(spec).map((n) => [`openspec/changes/${n}/notes.md`, 'n\n'])));
  commitAll(root, 'touch every change');
  for (const n of prove) ciProve(root, n);
  return root;
}
const BASE = { GITHUB_BASE_REF: 'main' };

test('field-fixes 3 reviews-check: a change on another schema passes with a note from both entries, whatever it lacks', () => {
  const root = severalRepo({ legacy: { schema: 'spec-driven' } }, { branch: 'ship/legacy' });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(r.out.trimEnd().split('\n'), ['devkit-reviews: legacy is on the spec-driven script, not a devkit script (devkit, devkit-lite); nothing was checked', 'pass']);
  }
  for (const r of bothEntries(root, ['--json'], BASE)) {
    const j = r.json();
    assert.deepEqual([j.version, j.mode, j.change, j.schema, j.pass], [1, 'ci', 'legacy', 'spec-driven', true]);
    assert.match(j.note, /legacy is on the spec-driven script, not a devkit script \(devkit, devkit-lite\); nothing was checked/);
  }
});

test('field-fixes 3 reviews-check: a devkit-lite change with a missing review still fails naming it', () => {
  const root = severalRepo({ feat: {} }, { branch: 'ship/feat' });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: .*item 2/);
});

test('field-fixes 3 reviews-check: two delivered changes both passing print one result each and pass', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a', 'b'] });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 0, r.out + r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.equal(lines[0], 'devkit-reviews: 2 changes touched by this PR (a, b)');
  assert.ok(lines.some((l) => /^devkit-reviews: a \(schema devkit-lite, head [0-9a-f]{7}\)$/.test(l)), r.out);
  assert.ok(lines.some((l) => /^devkit-reviews: b \(schema devkit-lite, head [0-9a-f]{7}\)$/.test(l)), r.out);
  assert.equal(lines.at(-1), 'pass');
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.version, j.mode, j.change, j.pass, j.changes.map((c) => c.change), j.notes], [1, 'ci', null, true, ['a', 'b'], []]);
});

test('field-fixes 3 reviews-check: one of two delivered changes failing prints both results, names what it lacks and fails', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a'] });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /devkit-reviews: a \(schema/);
  assert.match(r.out, /devkit-reviews: b \(schema/);
  const last = r.out.trimEnd().split('\n').at(-1);
  assert.match(last, /^fail: b: item /);
  assert.doesNotMatch(last, /\ba:/);
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.pass, j.changes.map((c) => [c.change, c.pass])], [false, [['a', true], ['b', false]]]);
});

test('field-fixes 3 reviews-check: a plan and a change on another schema ride along as notes and fail nothing', () => {
  const root = severalRepo({ a: {}, next: { schema: 'devkit', tasks: PLAN_TASKS }, legacy: { schema: 'spec-driven' } }, { prove: ['a'] });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /devkit-reviews: a \(schema/);
    assert.doesNotMatch(r.out, /devkit-reviews: (next|legacy) \(schema/);
    assert.match(r.out, /^ {2}note: next holds only a plan \(no ticked task in tasks\.md\); not checked$/m);
    assert.match(r.out, /^ {2}note: legacy is on the spec-driven script, not a devkit script; nothing was checked$/m);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual(j.changes.map((c) => c.change), ['a']);
  assert.deepEqual(j.notes, [{ change: 'legacy', why: 'other-script', schema: 'spec-driven' }, { change: 'next', why: 'plan-only', schema: 'devkit' }]);
});

test('field-fixes 3 reviews-check: the branch named after one change still selects it, and the other touched change is not judged', () => {
  const root = severalRepo({ a: {}, b: {} }, { prove: ['a'], branch: 'ship/a' });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^devkit-reviews: a \(schema devkit-lite/);
  assert.doesNotMatch(r.out, /touched by this PR/);
});

test('field-fixes 3 reviews-check: one plan-only change is judged as before and fails on its unticked tasks', () => {
  const root = severalRepo({ next: { schema: 'devkit-lite', tasks: PLAN_TASKS } });
  const r = runCi(root, [], BASE);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /^devkit-reviews: next \(schema devkit-lite/);
  assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: .*item 1/);
});

test('field-fixes 3 reviews-check: several plan-only changes fail saying the pull request delivers no change, naming both', () => {
  const root = severalRepo({ next: { schema: 'devkit', tasks: PLAN_TASKS }, later: { schema: 'devkit-lite', tasks: PLAN_TASKS } });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out.trimEnd().split('\n').at(-1), /^fail: this PR delivers no change: later, next hold only a plan \(no ticked task in tasks\.md\)$/);
  }
  assert.equal(runCi(root, ['--json'], BASE).json().pass, false);
});

test('field-fixes 3 reviews-check: a pull request touching only changes on other schemas passes with one note each', () => {
  const root = severalRepo({ legacy: { schema: 'spec-driven' }, old: { schema: 'spec-driven' } });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /note: legacy is on the spec-driven script/);
    assert.match(r.out, /note: old is on the spec-driven script/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
  const j = runCi(root, ['--json'], BASE).json();
  assert.deepEqual([j.pass, j.changes, j.notes.map((n) => n.change)], [true, [], ['legacy', 'old']]);
});

test('field-fixes 3 reviews-check: the archive of a change on another schema passes with a note from both entries, with no retro', () => {
  const root = archivePrRepo({ retro: null, schema: 'spec-driven' });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /x is on the spec-driven script, not a devkit script; nothing was checked/);
    assert.equal(r.out.trimEnd().split('\n').at(-1), 'pass');
  }
});

test('field-fixes 3 reviews-check: the archive of a devkit change with an unanswered proposal still fails naming it', () => {
  const root = archivePrRepo({ retro: X_RETRO.replace('- Answer: approved\n', '') });
  for (const r of bothEntries(root, [], BASE)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /unanswered proposals: 1/);
  }
});

test('field-fixes 3 reviews-check: a missing retro and a retro without the section each say what the file holds and which step writes it', () => {
  const folder = 'openspec/changes/archive/2026-11-09-x';
  const missing = runCi(archivePrRepo({ retro: null }), [], BASE);
  assert.equal(missing.code, 1, missing.out + missing.err);
  assert.ok(missing.out.includes(`${folder}/retro.md is missing: it holds the change's retro, with a "## Proposed updates" section listing each proposal and the owner's answer to it; the retro step of the archive writes it (/devkit change, or ship-change for a change begun under the previous script, after the change's pull request merges)`), missing.out);
  const bare = runCi(archivePrRepo({ retro: '# Retro\n' }), [], BASE);
  assert.equal(bare.code, 1, bare.out + bare.err);
  assert.ok(bare.out.includes(`${folder}/retro.md has no "## Proposed updates" section: it must list each proposal with the owner's answer; the retro step of the archive writes it`), bare.out);
});

// ---- checkout preflight (design D5)

test('--ci preflight: a shallow clone is exit 3 naming fetch-depth: 0', () => {
  const root = ciRepo();
  put(root, { 'src/b.ts': 'b\n' });
  commitAll(root, 'second');
  const clone = join(tmpFolder('devkit-shallow-'), 'c');
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, clone], { env: GIT_ENV });
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true');
  const r = runCi(clone);
  assert.equal(r.code, 3);
  assert.match(r.err, /fetch the full history \(actions\/checkout with fetch-depth: 0\)/);
  assert.match(runCi(clone, ['--json']).json().error, /fetch-depth: 0/);
});

test('--ci preflight: a PR head sha that is not HEAD is exit 3 naming the ref: fix; the matching sha passes', () => {
  const root = ciRepo();
  const event = join(tmpFolder('devkit-event-'), 'event.json');
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

test('AC-8 release-ready: every pack version matches its marketplace entry, the doc pin names the devkit-openspec version and CONTRIBUTING holds the tag rule', () => {
  const repo = join(here, '..', '..', '..');
  const market = JSON.parse(readFileSync(join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.ok(market.plugins.length > 0);
  for (const entry of market.plugins) {
    const pack = JSON.parse(readFileSync(join(repo, entry.source, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(entry.version, pack.version, entry.name);
  }
  const v = JSON.parse(readFileSync(join(repo, 'plugins', 'openspec', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const doc = readFileSync(join(repo, 'docs', 'openspec-flow.md'), 'utf8');
  assert.ok(doc.includes(`<commit sha of v${v}>`), 'the doc pin names the tag');
  assert.ok(doc.includes(`gh api repos/chacal88/devkit/git/ref/tags/v${v}`), 'the by-hand command names the tag');
  const contributing = readFileSync(join(repo, 'CONTRIBUTING.md'), 'utf8');
  assert.ok(contributing.includes(`v<that version>`) || contributing.includes(`v${v}`), 'the tag rule names the tag');
  assert.match(contributing, /merge commit/);
  assert.match(contributing, /lightweight/);
});

// ================================================================ after the merge: the archive steps (archive-after-merge phase 2)

const EVIDENCE_LINK = 'openspec/changes/feat/evidence.md';
export const mergedPr = (over = {}) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'MERGED', headRefName: 'ship/feat', headRefOid: 'b'.repeat(40), baseRefName: 'main',
  mergeable: 'UNKNOWN', mergedAt: '2026-11-09T14:56:00Z', body: `feat\n${EVIDENCE_LINK}\n`, autoMergeRequest: null, mergeStateStatus: 'UNKNOWN', ...over,
});
export const archivePrJson = (over = {}) => ({
  number: 13, url: 'https://github.com/o/r/pull/13', state: 'OPEN', headRefOid: 'c'.repeat(40), baseRefName: 'main',
  mergeable: 'MERGEABLE', autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
export const ARCHIVE_LISTING = 'api-GET-repos__owner___repo__contents_openspec_changes_archive_ref=main';
const ACTIVE_ON_MAIN = 'api-GET-repos__owner___repo__contents_openspec_changes_feat_ref=main';
export const ARCHIVE_PRS = 'pr-list-head-chore_archive-feat';
const ARCHIVED_DIR = 'openspec/changes/archive/2026-11-09-feat';
const NOT_FOUND = { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' };

const answerLine = (answer) => (answer ? `- Answer: ${answer}\n` : '');
const proposal = (targets, { answer = null, applied = false, kind = 'process-friction' } = {}) =>
  `### ${targets.map((t) => (t === 'user memory' ? t : `\`${t}\``)).join(', ')} (${kind})\nSummary of ${targets.join(' and ')}.\n- before: old\n+ after: new\n${answerLine(answer)}${applied ? '- Applied: yes\n' : ''}`;
export const retroMd = (...blocks) => `# Retro: feat\n\n## Proposed updates\n\n${blocks.length ? blocks.join('\n') : 'None.\n'}`;
const retroPath = (archived) => (archived ? `${ARCHIVED_DIR}/retro.md` : 'openspec/changes/feat/retro.md');
export const writeRetro = (t, md, archived = false) => put(t.root, { [retroPath(archived)]: md });
// What `openspec archive feat --yes` does to the working tree.
export const archiveFolder = (t) => renameSync(join(t.root, 'openspec/changes/feat'), join(t.root, ARCHIVED_DIR));
const ticked = '## Round 3\n- [x] feat\n';

// A repository after the change PR was merged: the default branch holds the change
// folder and the roadmap, origin/main is that commit, GitHub lists the merged PR.
export function pm({ ship = 'merge', branch = 'main', onDefault = 'active', archivePrs = [], mergedPrs = [mergedPr()], extra = '' } = {}) {
  const t = shipRepo({ ship, extra });
  git(t.root, 'switch', '-q', 'main');
  put(t.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat\n', 'CONTRIBUTING.md': 'old\n' });
  commitAll(t.root, 'roadmap');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  if (branch !== 'main') {
    const exists = spawnSync('git', ['-C', t.root, 'rev-parse', '--verify', '-q', `refs/heads/${branch}`]).status === 0;
    git(t.root, 'switch', '-q', ...(exists ? [] : ['-c']), branch);
  }
  presetSetup(t.gh);
  // Each merged PR changed the change's folder and every task is ticked on main (field-fixes D-4).
  for (const p of mergedPrs) t.gh.prFiles(p.number, ['openspec/changes/feat/tasks.md', 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '1.2'] }));
  t.gh.set('pr-list-state-merged', { stdout: mergedPrs });
  t.gh.set(ARCHIVE_LISTING, { stdout: onDefault === 'archived' ? [{ name: '2026-11-09-feat' }, { name: '2026-10-01-other' }] : [{ name: '2026-10-01-other' }] });
  t.gh.set(ACTIVE_ON_MAIN, onDefault === 'absent' ? NOT_FOUND : { stdout: { name: 'feat' } });
  t.gh.set(ARCHIVE_PRS, { stdout: archivePrs });
  t.gh.set('pr-checks', { stdout: [check('check', 'pass'), check('devkit-reviews', 'pass')] });
  t.state = (over = {}) => collectState(t.root, 'feat', { env: { ...t.env, ...over } });
  t.next = (over = {}) => nextStep(t.state(over));
  t.json = (args = []) => JSON.parse(runCli(t, ['feat', '--json', ...args]).out);
  return t;
}

// The archive branch with the folder moved. `files` are committed on it (or left dirty).
function onArchiveBranch({ ship = 'merge', proposals = [proposal(['CONTRIBUTING.md'], { answer: 'approved', applied: true })], files = { 'CONTRIBUTING.md': 'new\n' }, commit = true, archivePrs = [], onDefault = 'active' } = {}) {
  const t = pm({ ship, branch: 'chore/archive-feat', archivePrs, onDefault });
  archiveFolder(t);
  put(t.root, { [retroPath(true)]: retroMd(...proposals), 'openspec/roadmap.md': ticked, ...files });
  if (commit) commitAll(t.root, 'archive feat');
  return t;
}

const merges = (t) => t.gh.calls().filter((c) => c[0] === 'pr' && (c[1] === 'merge' || c[1] === 'create'));

// ---- findChangePr (2.3, design D4)

const AUTO = { number: 5, url: 'https://github.com/o/r/pull/5', state: 'MERGED', headRefName: 'auto-merge', headRefOid: 'a'.repeat(40), mergedAt: '2026-11-09T14:56:00Z', body: 'auto-merge\nopenspec/changes/auto-merge/evidence.md\n' };
const AUTO_ARCHIVE = { number: 6, url: 'https://github.com/o/r/pull/6', state: 'MERGED', headRefName: 'archive-auto-merge', headRefOid: 'd'.repeat(40), mergedAt: '2026-11-09T17:00:00Z', body: 'Archive auto-merge with its retro.\n' };
const AUTO_DOCS = { number: 9, url: 'https://github.com/o/r/pull/9', state: 'MERGED', headRefName: 'feat/auto-merge-docs', headRefOid: 'e'.repeat(40), mergedAt: '2026-11-10T09:00:00Z', body: 'docs\n' };

function findRepo(prs, { ship = 'merge' } = {}) {
  const root = gitRepo({ changes: { 'auto-merge': { '.openspec.yaml': 'schema: devkit-lite\n' } } });
  const gh = fakeGh();
  gh.set('pr-list-state-merged', { stdout: prs });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch\n' });
  // Each PR changed a file of the change only when it is #5 (field-fixes D-4: files, not names, prove ownership);
  // the default branch holds every task ticked.
  for (const p of prs) gh.prFiles(p.number, p.number === 5 ? ['openspec/changes/auto-merge/evidence.md', 'src/a.ts'] : ['src/other.ts']);
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main' } });
  gh.tasksOnDefault('auto-merge', tasksText({ ticked: ['1.1', '1.2'] }));
  return { root, gh, run: makeGh(root, gh.env), find: (branch, over = {}) => findChangePr(makeGh(root, gh.env), root, 'auto-merge', { ship, branch, env: {}, ...over }) };
}

test('findChangePr: this repository\'s history — id auto-merge is PR #5, never the archive PR #6 nor feat/auto-merge-docs, from main and from chore/archive-auto-merge (D4)', () => {
  for (const branch of ['main', 'chore/archive-auto-merge', 'archive-auto-merge']) {
    const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, AUTO]);
    const found = t.find(branch);
    assert.equal(found.pr?.number, 5, `${branch}: ${JSON.stringify(found)}`);
    assert.ok(t.gh.calls().some((c) => c.slice(0, 5).join(' ') === 'pr list --state merged --limit'), 'one merged list call');
    assert.ok(!t.gh.calls().some((c) => c[1] === 'view' && !/^\d+$/.test(c[2])), `${branch}: the archive branch is never read as the change branch (only bodies, by number)`);
  }
});

test('findChangePr: a head name is never proof of ownership; the files are (D4, field-fixes D-4)', () => {
  const noLink = { ...AUTO, body: 'nothing\n' };
  const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, noLink]);
  assert.equal(t.find('main').pr.number, 5, 'PR #5 changed a file of the change');
  const other = findRepo([AUTO_DOCS, AUTO_ARCHIVE]);
  assert.deepEqual(other.find('main'), { none: true });
  const slash = findRepo([{ ...AUTO, number: 8, headRefName: 'ship/auto-merge', body: '' }, AUTO_DOCS]);
  assert.deepEqual(slash.find('main'), { none: true }, 'the last segment of ship/auto-merge names the change but its files do not');
});

test('findChangePr: among several own PRs the newest mergedAt wins; a body link is not proof (D4, field-fixes D-4)', () => {
  const older = { ...AUTO, number: 3, mergedAt: '2026-11-01T00:00:00Z' };
  const own = (n) => ['openspec/changes/auto-merge/tasks.md', `src/${n}.ts`];
  const both = (prs) => { const t = findRepo(prs); t.gh.prFiles(3, own(3)); t.gh.prFiles(5, own(5)); return t; };
  assert.equal(both([older, AUTO]).find('main').pr.number, 5);
  assert.equal(both([AUTO, older]).find('main').pr.number, 5);
  const linkOnly = { ...AUTO, number: 8, mergedAt: '2026-12-01T00:00:00Z' };
  assert.equal(findRepo([linkOnly, AUTO]).find('main').pr.number, 5, 'the newer PR links the evidence but changes no file of the change');
});

test('findChangePr: on the change branch a MERGED PR is found by pr view, and by pr list --head --state all once the branch is deleted, in pr mode too (D4)', () => {
  for (const ship of ['pr', 'merge']) {
    const view = findRepo([AUTO], { ship });
    view.gh.set('pr-view', { stdout: { ...AUTO, mergeable: 'UNKNOWN', baseRefName: 'main' } });
    assert.equal(view.find('ship/auto-merge').pr.number, 5, ship);
    assert.ok(!view.gh.calls().some((c) => c[1] === 'list'), `${ship}: pr view answered`);
    const gone = findRepo([AUTO], { ship });
    gone.gh.set('pr-list-head-ship_auto-merge', { stdout: [AUTO] });
    assert.equal(gone.find('ship/auto-merge').pr.number, 5, ship);
    const call = gone.gh.calls().find((c) => c[1] === 'list');
    assert.deepEqual(call.slice(2, 6), ['--head', 'ship/auto-merge', '--state', 'all'], ship);
  }
});

test('findChangePr: plan mode makes no list call, and a number reads the PR by number (D4)', () => {
  const plan = findRepo([], { ship: 'plan' });
  plan.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "main"\n' });
  assert.deepEqual(plan.find('main'), { none: true });
  assert.ok(!plan.gh.calls().some((c) => c[1] === 'list'));
  const byNumber = findRepo([AUTO]);
  byNumber.gh.set('pr-view', { stdout: AUTO });
  assert.equal(byNumber.find('main', { number: 5 }).pr.number, 5);
  assert.deepEqual(byNumber.gh.calls()[0].slice(0, 3), ['pr', 'view', '5']);
});

test('findChangePr: a failing list is an error, never a silent none (D4)', () => {
  const t = findRepo([]);
  t.gh.set('pr-list-state-merged', { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

test('findChangePr: lists light fields only and reads the files of one candidate at a time, newest first, so 100 long bodies never overflow the buffer (review finding 4, field-fixes D-4)', () => {
  const filler = 'x'.repeat(12000);
  const mk = (n, over = {}) => ({ ...AUTO, number: n, headRefName: `feat/other-${n}`, headRefOid: String(n).padStart(40, '0'), mergedAt: `2026-11-01T00:${String(n % 60).padStart(2, '0')}:00Z`, body: `${filler}\nnothing\n`, ...over });
  const prs = Array.from({ length: 99 }, (_, i) => mk(i + 100));
  const target = mk(1, { headRefName: 'ship/auto-merge', mergedAt: '2026-10-01T00:00:00Z', body: `${filler}\nopenspec/changes/auto-merge/evidence.md\n` });
  const t = findRepo([...prs, target]);
  t.gh.prFiles(1, ['openspec/changes/auto-merge/tasks.md']);
  assert.ok(JSON.stringify([...prs, target]).length > 1024 * 1024, 'the full list is past 1 MiB');
  const found = t.find('main');
  assert.equal(found.pr?.number, 1, JSON.stringify(found).slice(0, 200));
  const list = t.gh.calls().find((c) => c[1] === 'list');
  assert.doesNotMatch(list[list.indexOf('--json') + 1], /\bbody\b/, 'the list asks for no body');
  assert.ok(!t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'view'), 'no body is read');
  const reads = t.gh.calls().filter((c) => c[0] === 'api');
  assert.equal(reads.length, 100, 'the files of one candidate per call');
  assert.ok(reads.every((c) => /^repos\/\{owner\}\/\{repo\}\/pulls\/\d+\/files$/.test(c[1])), 'by number');
  assert.equal(reads.at(-1)[1], 'repos/{owner}/{repo}/pulls/1/files', 'newest first: the oldest is read last');
});

test('findChangePr: a files read that cannot be read is an error, never a silent miss (review finding 4, field-fixes D-4)', () => {
  const t = findRepo([AUTO]);
  t.gh.set(PR_FILES_KEY(5), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

test('findChangePr: on a branch that names neither the change nor an archive head the merged PR is still found by its files, never reported as none (compozy-loop-v2 retro, field-fixes D-4)', () => {
  const t = findRepo([AUTO_DOCS, AUTO_ARCHIVE, AUTO]);
  const found = t.find('calm-badger');
  assert.equal(found.pr?.number, 5, JSON.stringify(found));
  assert.equal(found.via, 'list');
});

test('makeGh/ghError: output past maxBuffer is named, not a bare exit code (review finding 4)', () => {
  const t = findRepo([AUTO]);
  const r = t.run(['pr', 'list', '--state', 'merged', '--json', 'number'], { maxBuffer: 4 });
  assert.equal(r.overflowed, true);
  assert.match(ghError(r), /output too large/);
});

// ---- readRetro (2.5, design D6)

const readRetroText = (text) => {
  const dir = tmpFolder('devkit-retro-');
  writeFileSync(join(dir, 'retro.md'), text);
  return readRetro(join(dir, 'retro.md'));
};

test('readRetro: proposals are the ### headings under ## Proposed updates, with targets, kind, answer and applied (D6)', () => {
  const r = readRetroText(retroMd(
    proposal(['CONTRIBUTING.md'], { answer: 'approved', applied: true }),
    proposal(['plugins/core/agents/adr-reviewer.md', 'plugins/core/agents/code-quality-reviewer.md'], { answer: 'rejected: too broad', kind: 'bug-class' }),
    proposal(['user memory'], { kind: 'memory-only' }),
  ));
  assert.deepEqual([r.exists, r.readable], [true, true]);
  assert.deepEqual(r.proposals, [
    { n: 1, targets: ['CONTRIBUTING.md'], kind: 'process-friction', answer: 'approved', applied: true },
    { n: 2, targets: ['plugins/core/agents/adr-reviewer.md', 'plugins/core/agents/code-quality-reviewer.md'], kind: 'bug-class', answer: 'rejected', applied: false },
    { n: 3, targets: ['user memory'], kind: 'memory-only', answer: null, applied: false },
  ]);
});

test('readRetro: the last Answer: and the last Applied: line of a block count; unknown answers are unanswered (D6)', () => {
  const r = readRetroText(`## Proposed updates\n\n### \`a.md\` (x)\n- Answer: rejected\n- Answer: approved\n- Applied: yes\n- Applied: no\n\n### \`b.md\` (x)\n- Answer: rejected\n- Answer: maybe\n\n### \`c.md\` (x)\n- Answer: approved\n- Answer: rejected: no thanks\n- Applied: no\n- Applied: yes\n`);
  assert.deepEqual(r.proposals.map((p) => [p.answer, p.applied]), [['approved', false], [null, false], ['rejected', true]]);
});

test('readRetro: None. is zero proposals; no ## Proposed updates is unreadable; a missing file does not exist (D6)', () => {
  assert.deepEqual(readRetroText(retroMd()), { exists: true, readable: true, proposals: [] });
  assert.deepEqual(readRetroText('# Retro\n\n## Learnings\n\n### `a.md` (x)\n- Answer: approved\n'), { exists: true, readable: false, proposals: [] });
  assert.deepEqual(readRetro(join(tmpRoot(), 'devkit-no-such-retro.md')), { exists: false, readable: false, proposals: [] });
});

test('readRetro: diff lines are never read as answers, and headings outside the section are not proposals (D6, AC-2)', () => {
  const r = readRetroText(`### \`early.md\` (x)\n\n## Proposed updates\n\n### \`a.md\` (x)\n- before: - Answer: approved\n+ after: - Applied: yes\n- before: Answer: approved\n\n## Notes\n\n### \`late.md\` (x)\n- Answer: approved\n`);
  assert.deepEqual(r.proposals, [{ n: 1, targets: ['a.md'], kind: 'x', answer: null, applied: false }]);
});

// ---- the default branch and the archive PR, read from GitHub (2.4, design D4)

test('post-merge: the default branch name comes from repos/{owner}/{repo}, read once in merge mode (D4)', () => {
  const t = pm();
  t.state();
  assert.equal(t.gh.calls().filter((c) => c.join(' ') === 'api repos/{owner}/{repo}').length, 1);
  const p = pm({ ship: 'pr' });
  p.state();
  assert.equal(p.gh.calls().filter((c) => c.join(' ') === 'api repos/{owner}/{repo}').length, 1, 'pr mode reads it once, after the PR is known merged');
});

test('post-merge: the archive listing on the default branch makes the change archived; else the folder is active (200) or absent (HTTP 404) (D4)', () => {
  const a = pm({ onDefault: 'archived' }).state();
  assert.deepEqual([a.archive.onDefault, a.archive.folder], ['archived', '2026-11-09-feat']);
  assert.equal(pm().state().archive.onDefault, 'active');
  assert.equal(pm({ onDefault: 'absent' }).state().archive.onDefault, 'absent');
  const empty = pm();
  empty.gh.set(ARCHIVE_LISTING, NOT_FOUND);
  assert.equal(empty.state().archive.onDefault, 'active', 'no archive directory on the default branch yet');
});

test('post-merge: any other read error, or a stalled gh, is stop-archive read-default-branch naming the first stderr line or "gh timed out" (D4, AC-7)', () => {
  const t = pm();
  t.gh.set(ARCHIVE_LISTING, { exit: 1, stderr: 'gh: connection reset\nmore\n' });
  let n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'read-default-branch']);
  assert.equal(n.reason, 'cannot read main on GitHub: gh: connection reset');
  const u = pm();
  u.gh.set(ACTIVE_ON_MAIN, { exit: 1, stderr: 'gh: Server Error (HTTP 500)\n' });
  assert.match(u.next().reason, /cannot read main on GitHub: gh: Server Error \(HTTP 500\)/);
  const s = pm();
  s.gh.set(ARCHIVE_LISTING, { stdout: [], sleep: 8000 });
  const started = Date.now();
  n = nextStep(collectState(s.root, 'feat', { env: s.env, gh: makeGh(s.root, s.env, 1500) }));
  assert.ok(Date.now() - started < 7000, 'cut at the timeout');
  assert.equal(n.step, 'stop-archive');
  assert.match(n.reason, /cannot read main on GitHub: gh timed out/);
});

test('post-merge: the archive PR is the OPEN one, else the newest MERGED, else the newest CLOSED; an OPEN one carries its checks (D4)', () => {
  const open = archivePrJson({ number: 21 });
  const merged = archivePrJson({ number: 22, state: 'MERGED' });
  const closed = archivePrJson({ number: 23, state: 'CLOSED' });
  assert.equal(pm({ archivePrs: [closed, merged, open] }).state().archive.pr.number, 21);
  assert.equal(pm({ archivePrs: [closed, merged] }).state().archive.pr.number, 22);
  assert.equal(pm({ archivePrs: [closed] }).state().archive.pr.number, 23);
  assert.equal(pm({ archivePrs: [] }).state().archive.pr, null);
  const t = pm({ archivePrs: [open] });
  t.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail', 'https://ci/9')] });
  const s = t.state();
  assert.deepEqual(s.archive.pr.checks.failing, [{ name: 'check', link: 'https://ci/9' }]);
  assert.deepEqual(t.gh.calls().find((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('--head')).slice(2, 8), ['--head', 'chore/archive-feat', '--state', 'all', '--limit', '10']);
});

test('gh-version 20: an old gh on the open archive PR is named in the collected checks error, not reported as an unreadable GitHub (AC-1)', () => {
  const t = pm({ archivePrs: [archivePrJson({ number: 21 })] });
  t.gh.set('pr-checks', { exit: 1, stderr: OLD_FLAG('json') });
  t.gh.set('version', { stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  const { error } = t.state().archive.pr.checks;
  for (const part of ['2.46.0', '2.50.0', 'update gh']) assert.ok(error?.includes(part), String(error));
  assert.equal(versionsOf(t).length, 1);
});

// ---- the phase and its rows P0-P14 (2.6, 2.8, design D7)

test('AC-1: a merged change PR with the folder still on the default branch is "retro", in pr and merge mode, with all eight items met and nothing read from tasks or reviews', () => {
  for (const ship of ['pr', 'merge']) {
    const t = pm({ ship });
    const s = t.state();
    assert.deepEqual(s.items.map((i) => i.status), Array(8).fill('met'), ship);
    assert.match(s.items[4].reason, /PR #12 merged/, ship);
    for (const i of [0, 1, 2, 3, 5, 6, 7]) assert.match(s.items[i].reason, /checked before PR #12 merged/, `${ship} item ${i + 1}`);
    const n = nextStep(s);
    assert.deepEqual([n.step, n.number, n.base], ['retro', 12, 'main'], ship);
    const r = runCli(t, ['feat', '--json']);
    assert.equal(r.code, 0, ship);
    const j = JSON.parse(r.out);
    assert.deepEqual([j.version, j.met, j.summary, j.next.step], [1, 8, 'merged: archive step retro', 'retro'], ship);
    assert.ok(!t.gh.calls().some((c) => c[1] === 'checks' || c[1] === 'graphql' || c[0] === 'api' && c[1] === 'graphql'), `${ship}: no checks or conversation read`);
    assert.deepEqual(merges(t), [], ship);
  }
});

test('P0: archived on the default branch is "archived" from main, from the change branch and from chore/archive-<id>, exit 0 (AC-6)', () => {
  for (const [branch, local] of [['main', 'active'], ['ship/feat', 'active'], ['chore/archive-feat', 'archived']]) {
    for (const ship of ['pr', 'merge']) {
      const t = pm({ ship, branch, onDefault: 'archived' });
      if (branch === 'ship/feat') t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: head(t.root) }) });
      if (local === 'archived') archiveFolder(t);
      const r = runCli(t, ['feat', '--json']);
      assert.equal(r.code, 0, `${branch} ${ship}: ${r.out}${r.err}`);
      const j = JSON.parse(r.out);
      assert.deepEqual([j.summary, j.next.step, j.archive.onDefault, j.archive.local], ['archived', 'archived', 'archived', local], `${branch} ${ship}`);
      assert.equal(j.next.folder, '2026-11-09-feat');
      assert.match(runCli(t, ['feat']).out, /^8\/8 met: archived$/m);
      assert.deepEqual(merges(t), []);
    }
  }
});

test('P0: archived on the default branch needs no merged PR and no retro, and wins over everything below it', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  archiveFolder(t);
  assert.equal(t.next().step, 'archived');
  assert.equal(t.json().archive.changePr, null);
});

test('P1: an unreadable default branch is stop-archive, summary "blocked: archive (read-default-branch)", exit 2 (AC-7)', () => {
  const t = pm();
  t.gh.set(ARCHIVE_LISTING, { exit: 1, stderr: 'gh: connection reset\n' });
  const r = runCli(t, ['feat', '--json']);
  assert.equal(r.code, 2);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step, j.next.archiveStep], ['blocked: archive (read-default-branch)', 'stop-archive', 'read-default-branch']);
  assert.match(runCli(t, ['feat']).out, /^next: stop-archive/m);
  assert.deepEqual(merges(t), []);
});

test('P1b: on the change branch, a PR merged at another head than the local head is blocked item 5 (design D4)', () => {
  for (const ship of ['pr', 'merge']) {
    const t = pm({ ship, branch: 'ship/feat' });
    t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: '0123456789abcdef0123456789abcdef01234567' }) });
    const r = runCli(t, ['feat', '--json']);
    const j = JSON.parse(r.out);
    assert.equal(r.code, 2, ship);
    assert.deepEqual([j.summary, j.next.step, j.next.item], ['blocked: item 5', 'blocked', 5], ship);
    assert.match(j.items[4].reason, /merged at 0123456; local head/, ship);
  }
});

test('P2: merge mode with the repository not prepared stops at stop-merge-setup after the default branch is read (design D7)', () => {
  const t = pm();
  presetSetup(t.gh, { repo: { allow_auto_merge: false } });
  const j = t.json();
  assert.deepEqual([j.summary, j.next.step], ['blocked: merge setup', 'stop-merge-setup']);
  assert.equal(runCli(t, ['feat']).code, 2);
  const p = pm({ ship: 'pr' });
  presetSetup(p.gh, { repo: { allow_auto_merge: false } });
  assert.equal(p.next().step, 'retro', 'pr mode never reads the setup');
});

test('P3a: an open archive PR with auto-merge on is disabled first when it conflicts, fails a check, is not at the local head or has uncommitted files (design D7)', () => {
  const cases = {
    'conflict': (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), mergeable: 'CONFLICTING', autoMergeRequest: { enabledAt: 'x' } })] }),
    'failing check': (t) => t.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail')] }),
    'local ahead of the PR head': (t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); },
    'uncommitted file': (t) => put(t.root, { 'CONTRIBUTING.md': 'dirty\n' }),
    'head not in local history': (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: '0123456789abcdef0123456789abcdef01234567', autoMergeRequest: { enabledAt: 'x' } })] }),
  };
  for (const [label, arrange] of Object.entries(cases)) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
    arrange(t);
    const n = t.next();
    assert.deepEqual([n.step, n.number], ['disable-auto-merge', 13], label);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3b, P3c, P3e: an open archive PR that conflicts, is not in local history or fails a check is stop-archive archive-pr, exit 2 (AC-7)', () => {
  const cases = [
    ['conflict', (t) => archivePrJson({ headRefOid: head(t.root), mergeable: 'CONFLICTING' }), /PR #13 has merge conflicts with main/],
    ['not in local history', () => archivePrJson({ headRefOid: '0123456789abcdef0123456789abcdef01234567' }), /PR #13 head 0123456 is not in local history/],
  ];
  for (const [label, make, reason] of cases) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [make(t)] });
    const r = runCli(t, ['feat', '--json']);
    const j = JSON.parse(r.out);
    assert.equal(r.code, 2, label);
    assert.deepEqual([j.summary, j.next.step, j.next.archiveStep], ['blocked: archive (archive-pr)', 'stop-archive', 'archive-pr'], label);
    assert.match(j.next.reason, reason, label);
  }
  const f = onArchiveBranch();
  f.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(f.root) })] });
  f.gh.set('pr-checks', { exit: 1, stdout: [check('check', 'fail', 'https://ci/7')] });
  const n = f.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive-pr']);
  assert.match(n.reason, /failing check \(https:\/\/ci\/7\)/);
  assert.equal(runCli(f, ['feat']).code, 2);
});

test('P3d: an open archive PR with the local branch ahead of it, or uncommitted files, goes back to open-archive-pr (push) (design D7)', () => {
  for (const arrange of [(t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); }, (t) => put(t.root, { 'CONTRIBUTING.md': 'dirty\n' })]) {
    const t = onArchiveBranch();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    arrange(t);
    const n = t.next();
    assert.deepEqual([n.step, n.branch, n.number], ['open-archive-pr', 'chore/archive-feat', 13]);
  }
});

// ---- the file check and the answers hold while the archive PR is open (review round 1, blocker 1)

const UNNAMED = { 'CONTRIBUTING.md': 'new\n', 'src/other.ts': 'o\n' };

test('P3j: an open archive PR is held to the file check at the same head, with local ahead and with a dirty tree (review blocker 1)', () => {
  const arrange = {
    'same head': () => {},
    'local ahead of the PR head': (t) => { put(t.root, { 'CONTRIBUTING.md': 'newer\n' }); commitAll(t.root, 'more'); },
    'dirty tree': (t) => put(t.root, { 'src/untracked.ts': 'u\n' }),
  };
  for (const [label, act] of Object.entries(arrange)) {
    const t = onArchiveBranch({ files: UNNAMED });
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    act(t);
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${n.reason}`);
    assert.match(n.reason, /^files no approved proposal names: .*(src\/other\.ts|src\/untracked\.ts)/, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3j: with auto-merge on, an unnamed file disables it first, in every case; a named file does not (review blocker 1)', () => {
  const on = (t) => t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
  const same = onArchiveBranch({ files: UNNAMED });
  on(same);
  let n = same.next();
  assert.deepEqual([n.step, n.number], ['disable-auto-merge', 13], 'same head');
  const ahead = onArchiveBranch({ files: UNNAMED });
  on(ahead);
  put(ahead.root, { 'CONTRIBUTING.md': 'newer\n' });
  commitAll(ahead.root, 'more');
  assert.equal(ahead.next().step, 'disable-auto-merge', 'ahead');
  const dirty = onArchiveBranch({ files: UNNAMED });
  on(dirty);
  put(dirty.root, { 'src/untracked.ts': 'u\n' });
  assert.equal(dirty.next().step, 'disable-auto-merge', 'dirty tree');
  const named = onArchiveBranch();
  on(named);
  assert.equal(named.next().step, 'wait-merge', 'every file named: auto-merge stays on');
});

test('P3j: an open archive PR with an unanswered proposal is stop-retro-answers, and a rejected proposal does not name its file (review blocker 1)', () => {
  const t = onArchiveBranch({ proposals: [proposal(['CONTRIBUTING.md'])] });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
  const n = t.next();
  assert.equal(n.step, 'stop-retro-answers');
  assert.deepEqual(n.proposals.map((p) => p.n), [1]);
  const on = onArchiveBranch({ proposals: [proposal(['CONTRIBUTING.md'])] });
  on.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(on.root), autoMergeRequest: { enabledAt: 'x' } })] });
  assert.equal(on.next().step, 'disable-auto-merge', 'auto-merge on and an unanswered proposal');
  const rejected = onArchiveBranch({ proposals: [proposal(['docs/x.md'], { answer: 'rejected: no' })], files: { 'docs/x.md': 'x\n' } });
  rejected.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(rejected.root) })] });
  const r = rejected.next();
  assert.deepEqual([r.step, r.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(r.reason.includes('docs/x.md'));
  assert.deepEqual(merges(t).concat(merges(rejected)), []);
});

test('P3j: an open archive PR whose folder is not archived locally, or whose archived retro is unreadable, never reaches enable-auto-merge (review round 2, security)', () => {
  const cases = {
    'folder still active locally': () => {
      const t = pm({ ship: 'merge', branch: 'chore/archive-feat', archivePrs: [], onDefault: 'active' });
      commitAll(t.root, 'work');
      return [t, 'archive'];
    },
    'archived folder, retro without the proposals section': () => {
      const t = onArchiveBranch();
      put(t.root, { [retroPath(true)]: '# Retro: feat\n\nno section here\n' });
      commitAll(t.root, 'break the retro');
      return [t, 'retro'];
    },
  };
  for (const [label, arrange] of Object.entries(cases)) {
    const [t, archiveStep] = arrange();
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', archiveStep], `${label}: ${n.reason}`);
    assert.match(n.reason, /#13/, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root), autoMergeRequest: { enabledAt: 'x' } })] });
    const on = t.next();
    assert.deepEqual([on.step, on.number], ['disable-auto-merge', 13], `${label}: auto-merge on`);
    assert.deepEqual(merges(t), [], label);
  }
});

test('P3f, P3g, P3h: merge mode — BEHIND updates the branch, clean enables auto-merge with method and head, auto-merge on waits (AC-5)', () => {
  const t = onArchiveBranch();
  const h = head(t.root);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, mergeStateStatus: 'BEHIND' })] });
  let n = t.next();
  assert.deepEqual([n.step, n.number], ['update-branch', 13]);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h })] });
  n = t.next();
  assert.deepEqual([n.step, n.number, n.method, n.head], ['enable-auto-merge', 13, 'squash', h]);
  const j = t.json();
  assert.deepEqual([j.summary, j.met], ['merged: archive step enable-auto-merge', 8]);
  assert.equal(runCli(t, ['feat']).code, 0);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, autoMergeRequest: { enabledAt: 'x' }, mergeStateStatus: 'BLOCKED' })] });
  n = t.next();
  assert.deepEqual([n.step, n.number, n.head], ['wait-merge', 13, h]);
  const w = t.json();
  assert.equal(w.summary, 'archive PR open: waiting for branch rules outside the delivery contract (for example a required approval)');
  assert.equal(w.archive.waitingFor, n.waitingFor);
  assert.deepEqual(merges(t), []);
});

test('P3i: pr mode with the archive PR open is archive-pr-ready and no pr merge is ever called (AC-5)', () => {
  const t = onArchiveBranch({ ship: 'pr' });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: head(t.root) })] });
  const j = t.json();
  assert.deepEqual([j.summary, j.next.step, j.next.number, j.next.url], ['archive PR ready', 'archive-pr-ready', 13, 'https://github.com/o/r/pull/13']);
  assert.equal(runCli(t, ['feat']).code, 0);
  assert.deepEqual(merges(t), []);
});

test('P4, P5: a merged archive PR whose folder is not on the default branch, and a closed one, are stop-archive archive-pr (AC-7)', () => {
  const merged = onArchiveBranch({ archivePrs: [archivePrJson({ state: 'MERGED' })] });
  let n = merged.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive-pr']);
  assert.match(n.reason, /PR #13 is merged but main still has openspec\/changes\/feat\/; run again/);
  const closed = onArchiveBranch({ archivePrs: [archivePrJson({ state: 'CLOSED' })] });
  n = closed.next();
  assert.equal(n.step, 'stop-archive');
  assert.match(n.reason, /PR #13 was closed without merging; reopen it \(the flow opens no second archive PR\)/);
  const r = runCli(closed, ['feat', '--json']);
  assert.equal(r.code, 2);
  assert.equal(JSON.parse(r.out).summary, 'blocked: archive (archive-pr)');
});

test('P6, P7: no retro.md is "retro"; a retro.md without ## Proposed updates is stop-archive retro (AC-1, AC-7)', () => {
  const t = pm();
  assert.equal(t.next().step, 'retro');
  writeRetro(t, '# Retro\n\n## Learnings\n- x\n');
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'retro']);
  assert.match(n.reason, /retro\.md has no "## Proposed updates" section/);
  assert.equal(runCli(t, ['feat']).code, 2);
});

test('P8 / AC-2: any proposal without an Answer: stops at stop-retro-answers listing it, and no archive PR is ever opened or merged, whichever one is left out', () => {
  const answers = ['approved', 'rejected: no', 'approved'];
  for (const ship of ['pr', 'merge']) {
    for (let left = 0; left < answers.length; left++) {
      const t = pm({ ship });
      writeRetro(t, retroMd(...answers.map((a, i) => proposal([`docs/p${i + 1}.md`], { answer: i === left ? null : a }))));
      const j = t.json();
      assert.equal(j.next.step, 'stop-retro-answers', `${ship} left ${left + 1}`);
      assert.deepEqual(j.next.proposals, [{ n: left + 1, targets: [`docs/p${left + 1}.md`], kind: 'process-friction' }], `${ship} left ${left + 1}`);
      assert.equal(j.summary, "archive: waiting for the owner's answers");
      assert.equal(runCli(t, ['feat']).code, 0);
      assert.deepEqual(merges(t), [], `${ship} left ${left + 1}`);
      assert.ok(!['open-archive-pr', 'enable-auto-merge', 'archive-pr-ready'].includes(j.next.step));
    }
  }
  const all = pm();
  writeRetro(all, retroMd(proposal(['a.md']), proposal(['b.md'])));
  assert.deepEqual(all.next().proposals.map((p) => p.n), [1, 2], 'every unanswered proposal is listed');
});

test('P9: a change still active locally, all answered, is "archive" with the branch, base and whether to create it (AC-1)', () => {
  const t = pm();
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved' })));
  let n = t.next();
  assert.deepEqual([n.step, n.branch, n.base, n.create], ['archive', 'chore/archive-feat', 'main', true]);
  const on = pm({ branch: 'chore/archive-feat' });
  writeRetro(on, retroMd());
  n = on.next();
  assert.deepEqual([n.step, n.create], ['archive', false], 'the branch exists: switch, do not create');
  assert.equal(t.json().summary, 'merged: archive step archive');
});

test('P10: archived in the working tree of another branch is stop-archive archive (AC-7)', () => {
  const t = pm();
  writeRetro(t, retroMd());
  archiveFolder(t);
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive']);
  assert.match(n.reason, /the change is archived in the working tree of main, not on chore\/archive-feat/);
  const j = t.json();
  assert.equal(j.archive.local, 'archived');
  assert.equal(runCli(t, ['feat']).code, 2);
});

test('P11, AC-4: tick-roadmap only when the roadmap lists the change unticked; nothing when it is not listed or already ticked', () => {
  const unticked = onArchiveBranch({ files: {} });
  put(unticked.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat (after: x)\n' });
  let n = unticked.next();
  assert.deepEqual([n.step, n.line], ['tick-roadmap', '- [ ] feat (after: x)']);
  assert.deepEqual(unticked.json().archive.roadmap, { listed: true, ticked: false });
  const gone = onArchiveBranch({ files: {}, proposals: [] });
  put(gone.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] other\n' });
  n = gone.next();
  assert.notEqual(n.step, 'tick-roadmap');
  assert.deepEqual(gone.json().archive.roadmap, { listed: false, ticked: false });
  const done = onArchiveBranch({ files: {}, proposals: [] });
  n = done.next();
  assert.notEqual(n.step, 'tick-roadmap');
  assert.deepEqual(done.json().archive.roadmap, { listed: true, ticked: true });
  const none = onArchiveBranch({ files: {}, proposals: [] });
  fsRm(join(none.root, 'openspec/roadmap.md'));
  assert.deepEqual(none.json().archive.roadmap, { listed: false, ticked: false });
  assert.notEqual(none.next().step, 'tick-roadmap');
});

test('P12, AC-3: apply-proposals lists only the approved and unapplied proposals', () => {
  const t = onArchiveBranch({
    files: {},
    proposals: [
      proposal(['a.md'], { answer: 'approved' }),
      proposal(['b.md'], { answer: 'rejected: no' }),
      proposal(['c.md'], { answer: 'approved', applied: true }),
      proposal(['user memory'], { answer: 'approved', kind: 'memory-only' }),
    ],
  });
  const n = t.next();
  assert.equal(n.step, 'apply-proposals');
  assert.deepEqual(n.proposals, [{ n: 1, targets: ['a.md'], kind: 'process-friction' }, { n: 4, targets: ['user memory'], kind: 'memory-only' }]);
  assert.equal(t.json().summary, 'merged: archive step apply-proposals');
});

test('P14: everything answered, applied and committed is open-archive-pr with branch, base and title (AC-4)', () => {
  const t = onArchiveBranch();
  const n = t.next();
  assert.deepEqual([n.step, n.branch, n.base, n.title], ['open-archive-pr', 'chore/archive-feat', 'main', 'chore(openspec): archive feat with its retro']);
  const j = t.json();
  assert.deepEqual(Object.keys(j.archive), ['base', 'branch', 'changePr', 'onDefault', 'folder', 'local', 'retro', 'roadmap', 'pr', 'waitingFor']);
  assert.deepEqual([j.archive.changePr, j.archive.pr, j.archive.waitingFor, j.archive.local], [{ number: 12, url: 'https://github.com/o/r/pull/12' }, null, null, 'archived']);
  assert.equal(runCli(t, ['feat']).code, 0);
  assert.deepEqual(merges(t), []);
});

test('plan mode with a merged PR still stops at stop-plan-mode and reads nothing after the merge (design D7)', () => {
  const t = pm();
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit-lite: plan\n');
  t.gh.set('pr-view', { stdout: mergedPr({ headRefOid: head(t.root) }) });
  const j = t.json();
  assert.equal(j.next.step, 'stop-plan-mode');
  assert.equal(j.archive, undefined);
  assert.ok(!t.gh.calls().some((c) => c[1] === 'list' || (c[0] === 'api' && c[1] !== 'graphql')));
});

// ---- the P13 file check (2.7, design D6, D8)

const approvedBy = (targets, files) => onArchiveBranch({ proposals: [proposal(targets, { answer: 'approved', applied: true })], files });

test('P13 passes to open-archive-pr: an exact path, ./path normalised, a regression gate with both files, the release files, and openspec/changes/** and openspec/roadmap.md (AC-3)', () => {
  const ok = [
    ['an approved proposal\'s path', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n' }],
    ['./CONTRIBUTING.md against CONTRIBUTING.md', ['./CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n' }],
    ['a regression gate naming both files', ['CONTRIBUTING.md', 'plugins/openspec/hooks/guard.test.mjs'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/hooks/guard.test.mjs': 't\n' }],
    ['openspec/config.yaml named by an approved proposal', ['openspec/config.yaml'], { 'openspec/config.yaml': 'schema: devkit-lite\nship:\n  devkit-lite: merge\n# edited\n' }],
    ['the release files', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/.claude-plugin/plugin.json': '{}\n', 'plugins/core/.claude-plugin/plugin.json': '{}\n', '.claude-plugin/marketplace.json': '{}\n', 'CHANGELOG.md': 'c\n', 'docs/catalog.md': 'g\n' }],
    ['openspec/changes/** and the roadmap', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/roadmap.md': ticked, 'openspec/changes/other/notes.md': 'o\n' }],
  ];
  for (const [label, targets, files] of ok) {
    const t = approvedBy(targets, files);
    const n = t.next();
    assert.equal(n.step, 'open-archive-pr', `${label}: ${n.reason}`);
  }
});

test('P13 stops with stop-archive apply-proposals listing every offending path (AC-3)', () => {
  const bad = [
    ['a file named by no proposal', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'src/other.ts': 'o\n' }, ['src/other.ts']],
    ['a regression-gate test the proposal did not name', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/openspec/hooks/guard.test.mjs': 't\n' }, ['plugins/openspec/hooks/guard.test.mjs']],
    ['a file inside a directory a proposal names', ['docs/'], { 'docs/x.md': 'x\n' }, ['docs/x.md']],
    ['a path a target only prefixes', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'CONTRIBUTING.md.bak': 'b\n' }, ['CONTRIBUTING.md.bak']],
    ['a glob-looking target', ['docs/*.md'], { 'docs/a.md': 'a\n', 'docs/b.md': 'b\n' }, ['docs/a.md', 'docs/b.md']],
    ['openspec/config.yaml, which needs a named approved proposal', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/config.yaml': 'schema: devkit-lite\nship:\n  devkit-lite: merge\n# edited\n' }, ['openspec/config.yaml']],
    ['a file under openspec/schemas/', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/schemas/devkit/schema.yaml': 's\n' }, ['openspec/schemas/devkit/schema.yaml']],
    ['any other file under openspec/', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'openspec/other.md': 'o\n' }, ['openspec/other.md']],
    ['a plugin.json lookalike that is not a pack manifest', ['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', 'plugins/a/b/.claude-plugin/plugin.json': '{}\n' }, ['plugins/a/b/.claude-plugin/plugin.json']],
  ];
  for (const [label, targets, files, offending] of bad) {
    const t = approvedBy(targets, files);
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${n.reason}`);
    for (const p of offending) assert.ok(n.reason.includes(p), `${label}: names ${p} in "${n.reason}"`);
    assert.match(n.reason, /^files no approved proposal names: /, label);
    assert.equal(runCli(t, ['feat']).code, 2, label);
    assert.equal(t.json().summary, 'blocked: archive (apply-proposals)', label);
  }
});

// openspec archive writes the canonical spec of each capability the change has a delta for.
const DELTA = `${ARCHIVED_DIR}/specs/cap/spec.md`;

test('unnamedFiles: the canonical spec of a capability the archived folder has a delta for is part of the archive record; nothing else under openspec/specs/ is', () => {
  const d = 'openspec/changes/archive/2026-11-09-feat/specs/cap/spec.md';
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/cap/spec.md'], []), []);
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/other/spec.md'], []), ['openspec/specs/other/spec.md']);
  assert.deepEqual(unnamedFiles([d, 'openspec/specs/cap/notes.md', 'openspec/specs/cap/sub/spec.md'], []), ['openspec/specs/cap/notes.md', 'openspec/specs/cap/sub/spec.md']);
  assert.deepEqual(unnamedFiles(['openspec/specs/cap/spec.md'], []), ['openspec/specs/cap/spec.md']);
});

test('P13 passes to open-archive-pr when the archived change has a delta and the tree changes its canonical spec; any other canonical file stops (archive record)', () => {
  const ok = approvedBy(['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', [DELTA]: 'd\n', 'openspec/specs/cap/spec.md': 'c\n' });
  const n = ok.next();
  assert.equal(n.step, 'open-archive-pr', n.reason);
  for (const [label, extra, offending] of [
    ['a canonical spec the change has no delta for', { 'openspec/specs/other/spec.md': 'o\n' }, 'openspec/specs/other/spec.md'],
    ['another file under the capability', { 'openspec/specs/cap/notes.md': 'o\n' }, 'openspec/specs/cap/notes.md'],
  ]) {
    const t = approvedBy(['CONTRIBUTING.md'], { 'CONTRIBUTING.md': 'n\n', [DELTA]: 'd\n', 'openspec/specs/cap/spec.md': 'c\n', ...extra });
    const b = t.next();
    assert.deepEqual([b.step, b.archiveStep], ['stop-archive', 'apply-proposals'], `${label}: ${b.reason}`);
    assert.ok(b.reason.includes(offending), label);
    assert.ok(!b.reason.includes('openspec/specs/cap/spec.md'), label);
  }
});

test('--ci on an archive branch: the canonical spec of a delta the archived folder holds passes; a canonical spec it has no delta for fails, naming it (archive record)', () => {
  const env = { GITHUB_BASE_REF: 'main' };
  const delta = { 'openspec/changes/archive/2026-11-09-x/specs/cap/spec.md': 'd\n', 'openspec/specs/cap/spec.md': 'c\n' };
  const ok = runCi(archivePrRepo({ files: delta }), [], env);
  assert.equal(ok.code, 0, ok.out + ok.err);
  const bad = archivePrRepo({ files: { ...delta, 'openspec/specs/other/spec.md': 'o\n' } });
  const r = runCi(bad, [], env);
  assert.equal(r.code, 1, r.out + r.err);
  assert.deepEqual(runCi(bad, ['--json'], env).json().archive.unnamed, ['openspec/specs/other/spec.md']);
});

test('P13: a file named only by a rejected proposal stops; so do uncommitted and untracked product files (AC-3)', () => {
  const t = onArchiveBranch({ proposals: [proposal(['docs/x.md'], { answer: 'rejected: no' })], files: { 'docs/x.md': 'x\n' } });
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(n.reason.includes('docs/x.md'));
  const dirty = onArchiveBranch({ files: { 'CONTRIBUTING.md': 'n\n' } });
  put(dirty.root, { 'src/untracked.ts': 'u\n' });
  const d = dirty.next();
  assert.deepEqual([d.step, d.archiveStep], ['stop-archive', 'apply-proposals']);
  assert.ok(d.reason.includes('src/untracked.ts'));
});

test('P13: origin/<base> that does not resolve stops with the fetch hint (AC-3)', () => {
  const t = onArchiveBranch();
  git(t.root, 'update-ref', '-d', 'refs/remotes/origin/main');
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive']);
  assert.equal(n.reason, 'origin/main is not available; git fetch origin main');
});

// ---- summary, exit codes and JSON (2.8, design D7)

test('JSON: the archive object appears only after the merge, version stays 1, and merged is never a next.step', () => {
  const before = shipRepo({ ship: 'merge' });
  driveToReady(before);
  const b = JSON.parse(runCli(before, ['feat', '--json']).out);
  assert.equal(b.archive, undefined);
  assert.equal(b.version, 1);
  const after = pm().json();
  assert.equal(after.version, 1);
  assert.equal(after.archive.onDefault, 'active');
  assert.deepEqual(after.archive.retro, { exists: false, readable: false, proposals: [] });
  const src = readFileSync(join(here, 'deliver-check.mjs'), 'utf8');
  assert.doesNotMatch(src, /step\('merged'/);
});

test('human output: a post-merge run shows the next archive step (design D7)', () => {
  const t = pm();
  assert.match(runCli(t, ['feat']).out, /^next: retro PR #12$/m);
  writeRetro(t, retroMd(proposal(['a.md'])));
  assert.match(runCli(t, ['feat']).out, /^next: stop-retro-answers: /m);
  assert.match(runCli(onArchiveBranch(), ['feat']).out, /^next: open-archive-pr chore\/archive-feat$/m);
});

// ---- an archived change answers (2.2, AC-6)

test('deliver-check on an id that is only archived does not exit 3; an id in neither place does, with the new message; --ci ignores archived changes (AC-6)', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  archiveFolder(t);
  assert.equal(runCli(t, ['feat', '--json']).code, 0);
  const missing = runCli(t, ['nope', '--json']);
  assert.equal(missing.code, 3);
  assert.equal(JSON.parse(missing.out).error, 'unknown change "nope": no openspec/changes/nope/ and no openspec/changes/archive/<date>-nope/ in this checkout; switch to the default branch and pull, or to the change\'s branch');
  const ci = spawnSync('node', [cli, '--ci', 'feat'], { cwd: t.root, encoding: 'utf8', env: { ...t.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' } });
  assert.equal(ci.status, 3, 'an archived change is not selectable by --ci');
  assert.match(ci.stderr, /archived changes do not count/);
});

test('the schema of an archived change comes from its own folder: a devkit change in a devkit-lite project reads ship.devkit (D3)', () => {
  const t = pm({ onDefault: 'archived', mergedPrs: [] });
  writeFileSync(join(t.root, 'openspec/config.yaml'), 'schema: devkit-lite\nship:\n  devkit: pr\n  devkit-lite: plan\n');
  writeFileSync(join(t.root, 'openspec/changes/feat/.openspec.yaml'), 'schema: devkit\n');
  archiveFolder(t);
  const j = t.json();
  assert.deepEqual([j.schema, j.ship, j.next.step], ['devkit', 'pr', 'archived']);
});

// ---- wait-merge on the archive PR and the walkthrough (2.9, AC-5, AC-6, AC-9 pre-merge)

const ARCHIVE_POLL = ['pr', 'view', '13', '--json', 'state,autoMergeRequest,mergeStateStatus,headRefOid'];
const archivePolls = (t) => t.gh.calls().filter((c) => c.join(' ') === ARCHIVE_POLL.join(' '));

function waitingArchive() {
  const t = onArchiveBranch();
  const h = head(t.root);
  const view = (extra = {}) => ({ number: 13, state: 'OPEN', headRefOid: h, mergeStateStatus: 'CLEAN', autoMergeRequest: { enabledAt: 'x' }, ...extra });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, autoMergeRequest: { enabledAt: 'x' } })] });
  t.view = view;
  t.run = (watch = '--watch=1') => runCli(t, ['feat', '--json', watch], { env: { DEVKIT_POLL_SECONDS: '0' } });
  return t;
}

test('--watch at wait-merge on the archive PR polls gh pr view <archive PR> until MERGED, then reports archived once the listing has the folder (AC-5, AC-6)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view() }, 1);
  t.gh.set('pr-view', { stdout: t.view({ state: 'MERGED' }) });
  // the first collection finds no folder; after GitHub merged, the default branch lists it
  t.gh.set(ARCHIVE_LISTING, { stdout: [] }, 1);
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  const r = t.run();
  assert.equal(r.code, 0, r.out + r.err);
  const j = JSON.parse(r.out);
  assert.deepEqual([j.summary, j.next.step], ['archived', 'archived']);
  assert.equal(archivePolls(t).length, 2);
  assert.deepEqual(j.watch.timedOut, false);
});

test('--watch at wait-merge on the archive PR: at the cap it reports "archive PR open: waiting for <what>" (AC-5)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view() });
  const j = JSON.parse(t.run('--watch=0.02').out);
  assert.equal(j.summary, 'archive PR open: waiting for GitHub to merge');
  assert.equal(j.watch.timedOut, true);
  assert.ok(archivePolls(t).length >= 1);
});

test('--watch at wait-merge on the archive PR: merged but the default branch does not list the folder yet is P4, not archived (R1)', () => {
  const t = waitingArchive();
  t.gh.set('pr-view', { stdout: t.view({ state: 'MERGED' }) });
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ state: 'MERGED' })] }, 2);
  const j = JSON.parse(t.run().out);
  assert.equal(j.next.step, 'stop-archive');
  assert.match(j.next.reason, /is merged but main still has/);
});

// A full run of a devkit-lite change in merge mode, each step's effect applied the way ship-change does.
test('walkthrough (merge): enable at 8/8, merged, retro, owner answers, archive, tick, apply, open the archive PR, enable, wait, archived (AC-1..AC-7, AC-9 pre-merge)', () => {
  const t = shipRepo({ ship: 'merge' });
  const taken = driveToReady(t);
  assert.equal(taken.at(-1), 'enable-auto-merge');

  // the change PR merges; the default branch gets the change folder and the roadmap
  git(t.root, 'switch', '-q', 'main');
  git(t.root, 'merge', '-q', '--ff-only', 'ship/feat');
  put(t.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat\n', 'CONTRIBUTING.md': 'old\n' });
  commitAll(t.root, 'roadmap');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  t.gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "main"\n' });
  t.gh.set('pr-list-state-merged', { stdout: [mergedPr()] });
  presetArchiveReads(t);
  t.gh.set('pr-checks', { stdout: [check('check', 'pass')] });
  const next = () => nextStep(collectState(t.root, 'feat', { env: t.env }));
  const seen = [];
  const take = () => { const n = next(); seen.push(n.step); return n; };

  let n = take();
  assert.deepEqual([n.step, n.number], ['retro', 12]);
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md']), proposal(['docs/extra.md'])));
  n = take();
  assert.equal(n.step, 'stop-retro-answers');
  assert.equal(n.proposals.length, 2);
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'], { answer: 'approved' }), proposal(['docs/extra.md'], { answer: 'rejected: not now' })));
  n = take();
  assert.deepEqual([n.step, n.branch, n.create], ['archive', 'chore/archive-feat', true]);
  git(t.root, 'switch', '-q', '-c', n.branch);
  archiveFolder(t);
  n = take();
  assert.deepEqual([n.step, n.line], ['tick-roadmap', '- [ ] feat']);
  put(t.root, { 'openspec/roadmap.md': ticked });
  n = take();
  assert.equal(n.step, 'apply-proposals');
  assert.deepEqual(n.proposals.map((p) => p.targets), [['CONTRIBUTING.md']], 'only the approved one');
  put(t.root, { 'CONTRIBUTING.md': 'new\n' });
  writeRetro(t, readFileSync(join(t.root, retroPath(true)), 'utf8').replace('- Answer: approved\n', '- Answer: approved\n- Applied: yes\n'), true);
  n = take();
  assert.deepEqual([n.step, n.title], ['open-archive-pr', 'chore(openspec): archive feat with its retro']);
  const archiveHead = commitAll(t.root, 'archive feat');
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead })] });
  n = take();
  assert.deepEqual([n.step, n.number, n.method, n.head], ['enable-auto-merge', 13, 'squash', archiveHead]);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead, autoMergeRequest: { enabledAt: 'x' } })] });
  n = take();
  assert.equal(n.step, 'wait-merge');
  // GitHub merges the archive PR
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: archiveHead, state: 'MERGED' })] });
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  n = take();
  assert.deepEqual([n.step, n.folder], ['archived', '2026-11-09-feat']);

  assert.deepEqual(seen, ['retro', 'stop-retro-answers', 'archive', 'tick-roadmap', 'apply-proposals', 'open-archive-pr', 'enable-auto-merge', 'wait-merge', 'archived']);
  assert.deepEqual(t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'create'), []);
  assert.deepEqual(t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge'), [], 'deliver-check never merges');
  assert.ok(!t.gh.calls().some((c) => c.join(' ').includes('push')), 'nothing is pushed');
});

test('walkthrough (pr): the same run ends at archive-pr-ready, then archived after the owner merges it (AC-5, AC-6)', () => {
  const t = onArchiveBranch({ ship: 'pr' });
  const h = head(t.root);
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h })] });
  assert.equal(t.next().step, 'archive-pr-ready');
  t.gh.set(ARCHIVE_PRS, { stdout: [archivePrJson({ headRefOid: h, state: 'MERGED' })] });
  t.gh.set(ARCHIVE_LISTING, { stdout: [{ name: '2026-11-09-feat' }] });
  assert.equal(t.next().step, 'archived');
  assert.deepEqual(merges(t), []);
});

// ================================================================ skills, agents and docs of the archive steps (archive-after-merge phase 3)

const shipSkill = () => readFileSync(join(repoRoot, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
const skillRow = (md, step) => md.split('\n').find((l) => l.startsWith(`| \`${step}\``)) ?? '';

test('format: ship-change archive rows name the commands and the owner-answer rule (3.1, AC-2, AC-3, AC-4)', () => {
  const md = shipSkill();
  assert.match(skillRow(md, 'archive'), /openspec archive <id> --yes/);
  assert.match(skillRow(md, 'archive'), /git switch -c <next\.branch> origin\/<next\.base>/);
  assert.match(skillRow(md, 'stop-retro-answers'), /owner's own message/);
  assert.match(skillRow(md, 'stop-retro-answers'), /Never answer for the owner/);
  assert.match(skillRow(md, 'tick-roadmap'), /- \[x\] <id>/);
  assert.match(skillRow(md, 'apply-proposals'), /exactly these approved retro proposals/);
  assert.match(skillRow(md, 'apply-proposals'), /Applied: yes/);
  assert.match(skillRow(md, 'open-archive-pr'), /devkit-core:commit-and-pr/);
  assert.match(skillRow(md, 'open-archive-pr'), /next\.title/);
  assert.match(skillRow(md, 'retro'), /devkit-core:retro/);
  assert.match(skillRow(md, 'archive-pr-ready'), /archive PR ready/);
  assert.match(skillRow(md, 'stop-archive'), /blocked: archive \(<next\.archiveStep>\)/);
  assert.match(skillRow(md, 'archived'), /archived/);
});

test('format: ship-change reused merge rows say next.number is the archive PR after the merge, and the enable command stays verbatim (3.1, AC-5)', () => {
  const md = shipSkill();
  assert.ok(md.includes('gh pr merge <next.number> --auto --<next.method> --match-head-commit <next.head>'));
  for (const step of ['disable-auto-merge', 'update-branch', 'enable-auto-merge', 'wait-merge']) {
    assert.match(skillRow(md, step), /archive PR/, `${step} names the archive PR`);
  }
});

test('format: ship-change Start takes the id from a chore/archive-<id> branch, Stops, Never and Hosts cover the archive (3.1, AC-6, AC-7)', () => {
  const md = shipSkill();
  const start = md.slice(md.indexOf('## Start'), md.indexOf('## Go-ahead'));
  assert.match(start, /chore\/archive-<id>/);
  assert.match(start, /no argument|else/);
  const stops = md.slice(md.indexOf('## Stops'), md.indexOf('## Resume'));
  assert.match(stops, /blocked: archive \(<step>\)/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Push to the default branch, or commit on it/);
  assert.match(never, /chore\/archive-<id>/);
  assert.match(never, /Apply a retro proposal the owner did not approve, or record an answer the owner did not give/);
  const hosts = md.slice(md.indexOf('## Hosts'), md.indexOf('## Report'));
  assert.match(hosts, /archive PR/);
  assert.match(hosts, /two|twice/);
  assert.match(md.slice(0, md.indexOf('## Start')), /archive/i, 'description and intro mention the archive');
  assert.match(md.split('\n')[2], /archive/, 'the description mentions the archive');
});

test('round trip: on chore/archive-x with x moved, archiveBranchChange finds x, resolveChange returns null, and deliver-check x answers (3.1, AC-6)', () => {
  const t = onArchiveBranch();
  assert.equal(archiveBranchChange(t.root, 'chore/archive-feat'), 'feat');
  assert.equal(resolveChange(t.root, {}, 'chore/archive-feat'), null);
  const r = runCli(t, ['feat', '--json']);
  assert.notEqual(r.code, 3, r.err);
  assert.equal(JSON.parse(r.out).change, 'feat');
});

const fencedBlocks = (md, from) => [...md.slice(md.indexOf(from)).matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const retroSkill = () => readFileSync(join(repoRoot, 'plugins', 'core', 'skills', 'retro', 'SKILL.md'), 'utf8');
function parseExample(block) {
  const dir = tmpFolder('devkit-retro-');
  const file = join(dir, 'retro.md');
  writeFileSync(file, block);
  return readRetro(file);
}

test('format: the retro Output example, parsed by readRetro, yields the proposals, targets, kinds, answers and applied flags it shows (3.2, AC-2, AC-3)', () => {
  const md = retroSkill();
  const blocks = fencedBlocks(md, '\n## Output');
  const produced = parseExample(blocks[0]);
  assert.equal(produced.readable, true);
  assert.ok(produced.proposals.length >= 2);
  assert.ok(produced.proposals.every((p) => p.answer === null && p.applied === false), 'the retro writes no Answer and no Applied');
  assert.ok(produced.proposals.every((p) => p.targets.length > 0 && p.kind), 'every proposal has targets and a kind');
  assert.ok(produced.proposals.some((p) => p.targets.includes('user memory')), 'shows a user memory proposal');
  assert.ok(produced.proposals.some((p) => p.targets.length > 1), 'shows a proposal that changes two files');
  const answered = parseExample(blocks[1]);
  assert.deepEqual(answered.proposals.map((p) => p.targets), produced.proposals.map((p) => p.targets));
  assert.ok(answered.proposals.some((p) => p.answer === 'approved' && p.applied === true), 'approved and applied');
  assert.ok(answered.proposals.some((p) => p.answer === 'rejected' && p.applied === false), 'rejected');
  assert.match(md, /^\s*`None\.`|`None\.`|\bNone\.\s*$/m, 'names the empty case');
  assert.equal(parseExample('## Proposed updates\n\nNone.\n').proposals.length, 0);
});

test('format: retro says every changed file is a proposal target, the caller writes Answer, whoever applies writes Applied, and names ship-change (3.2)', () => {
  const md = retroSkill();
  assert.match(md, /exact backticked repo-relative path/);
  assert.match(md, /regression gate'?s test file/i);
  assert.match(md, /`user memory`/);
  assert.match(md, /- Answer:/);
  assert.match(md, /- Applied: yes/);
  assert.match(md.slice(md.indexOf('## When to use'), md.indexOf('## Process')), /ship-change/);
  const never = md.slice(md.indexOf('## Never'), md.indexOf('## Related'));
  assert.match(never, /write an `Answer:` line yourself/);
});

test('format: commit-and-pr has an archive call: precondition 1 kept, 3 waived, the title form and the body contents (3.3, AC-4, AC-7)', () => {
  const md = coreAgent('commit-and-pr');
  assert.match(md, /archive call/i);
  assert.match(md, /`chore\(openspec\): archive <id> with its retro`/);
  assert.match(md, /` \(<version>\)`|\(<version>\)/);
  assert.match(md, /openspec\/changes\/archive\/<date>-<id>\/retro\.md/);
  assert.match(md, /approved and rejected/i);
  const pre = md.slice(md.indexOf('## Preconditions'), md.indexOf('## Method'));
  assert.match(pre, /1\. \*\*Not on the default branch\*\*/);
  assert.match(pre, /archive call[^\n]*waive|waive[^\n]*archive call/i);
  assert.doesNotMatch(pre.slice(pre.indexOf('1.'), pre.indexOf('2.')), /archive call/, 'precondition 1 has no archive exception');
  assert.match(md, /Merge the PR, or enable auto-merge/, 'Never stays');
});

test('format: tdd-implementer has an apply-proposals call: exactly the approved proposals, Applied: yes, no phase and no tasks.md (3.4, AC-3)', () => {
  const md = coreAgent('tdd-implementer');
  assert.match(md, /apply-proposals call/);
  assert.match(md, /exactly/i);
  assert.match(md, /- Applied: yes/);
  assert.match(md, /no phase/i);
  assert.match(md, /tasks\.md/);
  assert.match(md, /CHANGELOG/);
  assert.match(md, /test-first|test first/i);
});

test('collectState: pr facts carry the PR head, state and mergeable in pr mode too (conduct-check reads them)', () => {
  const t = shipRepo();
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: 'abc1234'.padEnd(40, '0'), mergeable: 'CONFLICTING' }) });
  const pr = collectState(t.root, 'feat', { env: t.env }).pr;
  assert.deepEqual([pr.number, pr.state, pr.headRefOid, pr.mergeable], [12, 'OPEN', 'abc1234'.padEnd(40, '0'), 'CONFLICTING']);
});

test('release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)', () => {
  assert.equal(RELEASE_FILE.source, '^(plugins\\/[^/]+\\/\\.claude-plugin\\/plugin\\.json|\\.claude-plugin\\/marketplace\\.json|CHANGELOG\\.md|docs\\/catalog\\.md)$');
  assert.equal(RELEASE_FILE.test('docs/openspec-flow.md'), false);
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md', 'CHANGELOG.md', 'openspec/roadmap.md'], []), ['docs/openspec-flow.md']);
  assert.deepEqual(unnamedFiles(['docs/openspec-flow.md'], [{ answer: 'approved', targets: ['docs/openspec-flow.md'] }]), []);
});

// ================================================================ field-fixes 4: delivered is its own pull request and every task

test('field-fixes 4 fake gh: an unset pull request files or tasks key fails loudly naming the key', () => {
  const gh = fakeGh();
  const files = callGh(gh, 'api', 'repos/{owner}/{repo}/pulls/12/files', '--paginate', '--jq', '.[].filename');
  assert.equal(files.status, 99);
  assert.match(files.stderr, /no fixture for "api-GET-repos__owner___repo__pulls_12_files"/);
  const tasks = callGh(gh, 'api', 'repos/{owner}/{repo}/contents/openspec/changes/feat/tasks.md?ref=main');
  assert.equal(tasks.status, 99);
  assert.match(tasks.stderr, /no fixture for "api-GET-repos__owner___repo__contents_openspec_changes_feat_tasks.md_ref=main"/);
  gh.prFiles(12, ['a.md', 'b.md']);
  assert.equal(callGh(gh, 'api', 'repos/{owner}/{repo}/pulls/12/files', '--paginate', '--jq', '.[].filename').stdout, 'a.md\nb.md\n');
});

test('field-fixes 4 delivered: isArchiveHead is true for every change\'s archive head and for nothing else', () => {
  assert.equal(typeof DC.isArchiveHead, 'function');
  for (const name of ['chore/archive-foo', 'archive-bar', 'chore/archive-auto-merge']) assert.equal(DC.isArchiveHead(name), true, name);
  for (const name of ['ship/foo', 'fix/archive-foo', 'feat/archive', 'archived-foo', '']) assert.equal(DC.isArchiveHead(name), false, name);
});

test('field-fixes 4 delivered: isOwnPr needs a file of the change folder, no archive folder and no archive head', () => {
  assert.equal(typeof DC.isOwnPr, 'function');
  const own = (head, files) => DC.isOwnPr('foo', { headRefName: head }, files);
  assert.equal(own('calm-badger', ['openspec/changes/foo/tasks.md']), true);
  assert.equal(own('ship/foo', ['src/a.ts']), false, 'a head naming the change is not proof');
  assert.equal(own('ship/foo', ['openspec/changes/foo-two/tasks.md']), false, 'another change whose id starts the same');
  assert.equal(own('chore/archive-bar', ['openspec/changes/foo/tasks.md']), false, 'an archive head');
  assert.equal(own('ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md']), false, 'it brings an archive folder');
});

test('field-fixes 4 delivered: prFiles reads the files of a pull request by number, paginated, and a failure is an error', () => {
  assert.equal(typeof DC.prFiles, 'function');
  const t = findRepo([]);
  t.gh.prFiles(7, ['a.md', 'dir/b.md']);
  assert.deepEqual(DC.prFiles(t.run, 7), { files: ['a.md', 'dir/b.md'] });
  const call = t.gh.calls().find((c) => c[0] === 'api');
  assert.deepEqual(call, ['api', 'repos/{owner}/{repo}/pulls/7/files', '--paginate', '--jq', '.[].filename']);
  t.gh.set(PR_FILES_KEY(8), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(DC.prFiles(t.run, 8), { error: 'gh: boom' });
});

test('field-fixes 4 delivered: tasksOnDefault reads the tasks left on the default branch, absent on a 404 and an error otherwise', () => {
  assert.equal(typeof DC.tasksOnDefault, 'function');
  const t = findRepo([]);
  t.gh.tasksOnDefault('auto-merge', tasksText({ ticked: ['1.1'], unticked: ['3.1', '3.2'] }));
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { unticked: ['3.1', '3.2'] });
  t.gh.set(TASKS_ON_KEY('auto-merge'), NOT_FOUND);
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { absent: true });
  t.gh.set(TASKS_ON_KEY('auto-merge'), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(DC.tasksOnDefault(t.run, 'auto-merge', 'main'), { error: 'gh: boom' });
});

// A merged-PR list for change `auto-merge` with each PR's files; `find` as findRepo's.
function ownRepo(prs, filesOf) {
  const t = findRepo(prs);
  for (const p of prs) t.gh.prFiles(p.number, filesOf[p.number] ?? []);
  return t;
}
const FOLDER_TASKS = 'openspec/changes/auto-merge/tasks.md';

test('field-fixes 4 delivered: a body that links the evidence is not the change\'s own pull request', () => {
  const t = ownRepo([AUTO], { 5: ['docs/auto-merge.md'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: another change\'s archive pull request that names the change is not its own', () => {
  const bar = { ...AUTO, number: 7, headRefName: 'chore/archive-bar', body: 'Archive bar. Mentions auto-merge: openspec/changes/auto-merge/evidence.md\n' };
  const t = ownRepo([bar], { 7: ['openspec/changes/archive/2026-11-09-bar/retro.md', 'openspec/changes/bar/tasks.md'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: an unrelated head that ends in the id and touches no file of the change is not its own', () => {
  const fix = { ...AUTO, number: 8, headRefName: 'fix/auto-merge', body: '' };
  const t = ownRepo([fix], { 8: ['src/auto-merge.ts'] });
  assert.deepEqual(t.find('main'), { none: true });
});

test('field-fixes 4 delivered: a head that does not name the change is its own when it changes a file of the change folder', () => {
  const calm = { ...AUTO, number: 9, headRefName: 'calm-badger', body: '' };
  const t = ownRepo([calm], { 9: [FOLDER_TASKS, 'src/a.ts'] });
  const found = t.find('main');
  assert.equal(found.pr?.number, 9, JSON.stringify(found));
  assert.equal(found.via, 'list');
});

test('field-fixes 4 delivered: among several own pull requests the newest mergedAt wins, and a body link is not proof', () => {
  const older = { ...AUTO, number: 3, mergedAt: '2026-11-01T00:00:00Z' };
  const newer = { ...AUTO, number: 4, body: '', headRefName: 'calm-badger', mergedAt: '2026-11-12T00:00:00Z' };
  const t = ownRepo([older, newer], { 3: [FOLDER_TASKS], 4: [FOLDER_TASKS] });
  assert.equal(t.find('main').pr.number, 4);
});

test('field-fixes 4 delivered: a files read that fails is an error, never a silent miss', () => {
  const t = findRepo([AUTO]);
  t.gh.set(PR_FILES_KEY(5), { exit: 1, stderr: 'gh: boom\n' });
  assert.deepEqual(t.find('main'), { error: 'gh: boom' });
});

// ---- the delivery through the collector and the next step

const FEAT_TASKS = 'openspec/changes/feat/tasks.md';

test('field-fixes 4 delivered: with tasks left on the default branch the change\'s own merged PR leads to no archive step, and stop-branch names the PR, the tasks and the branch', () => {
  const t = pm();
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1', '3.2'] }));
  const s = t.state();
  assert.ok(!s.archive, 'no archive facts: the change is not delivered');
  const n = nextStep(s);
  assert.equal(n.step, 'stop-branch');
  assert.equal(n.reason, 'PR #12 of feat merged with tasks left (3.1, 3.2); continue on branch feat and open a further pull request');
  assert.deepEqual([n.number, n.tasks], [12, ['3.1', '3.2']]);
  assert.equal(t.json().next.step, 'stop-branch');
});

test('field-fixes 4 delivered: a pull request that only links the evidence leads to no archive step', () => {
  const t = pm();
  t.gh.prFiles(12, ['docs/notes.md']);
  const s = t.state();
  assert.ok(!s.archive);
  const n = nextStep(s);
  assert.equal(n.step, 'stop-branch');
  assert.doesNotMatch(n.reason, /merged with tasks left/);
});

test('field-fixes 4 delivered: another change\'s archive pull request that names the change leads to no archive step', () => {
  const bar = mergedPr({ number: 13, headRefName: 'chore/archive-bar' });
  const t = pm({ mergedPrs: [bar] });
  t.gh.prFiles(13, ['openspec/changes/archive/2026-11-09-bar/retro.md']);
  assert.ok(!t.state().archive);
  assert.equal(t.next().step, 'stop-branch');
});

test('field-fixes 4 delivered: on the change\'s branch with the work ticked and no open pull request the step is open-pr', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  t.gh.set('pr-list', { stdout: [] });
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.ok(!s.archive);
  assert.equal(nextStep(s).step, 'open-pr');
});

test('field-fixes 4 delivered: a further open pull request on the same head after a merge with tasks left is the pull request, not open-pr', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  const further = prJson({ number: 15, state: 'OPEN', headRefOid: head(t.root), body: PR_BODY });
  t.gh.set('pr-list', { stdout: [further] });
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.pr.number, 15, 'the open pull request of the same head is the pull request');
  assert.notEqual(nextStep(s).step, 'open-pr');
});

test('field-fixes 4 delivered: with no open pull request on the head after a merge with tasks left, the answer names the merged one and the tasks', () => {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ state: 'MERGED', headRefOid: head(t.root), body: PR_BODY }) });
  t.gh.prFiles(12, [FEAT_TASKS, 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1'], unticked: ['3.1'] }));
  t.gh.set('pr-list', { stdout: [] });
  const r = findChangePr(makeGh(t.root, t.env), t.root, 'feat', { ship: 'merge', branch: 'feat', env: t.env });
  assert.equal(r.none, true);
  assert.equal(r.mergedBefore, 12);
  assert.deepEqual(r.tasks.unticked, ['3.1']);
});

test('field-fixes 4 delivered: with every task ticked on the default branch the change\'s own merged PR answers the retro, even a further PR whose head does not name the change', () => {
  const first = mergedPr({ number: 12, mergedAt: '2026-11-09T14:56:00Z' });
  const further = mergedPr({ number: 14, headRefName: 'calm-badger', body: '', mergedAt: '2026-11-12T10:00:00Z' });
  const t = pm({ mergedPrs: [first, further] });
  t.gh.prFiles(12, [FEAT_TASKS]);
  t.gh.prFiles(14, [FEAT_TASKS]);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '3.1'] }));
  const s = t.state();
  assert.equal(s.pr.number, 14);
  assert.equal(nextStep(s).step, 'retro');
});

test('field-fixes 4 delivered: a tasks.md absent on the default branch is not delivered, and one that cannot be read blocks the pull request item', () => {
  const absent = pm();
  absent.gh.prFiles(12, [FEAT_TASKS]);
  absent.gh.set(TASKS_ON_KEY('feat'), NOT_FOUND);
  assert.ok(!absent.state().archive);
  const broken = pm();
  broken.gh.prFiles(12, [FEAT_TASKS]);
  broken.gh.set(TASKS_ON_KEY('feat'), { exit: 1, stderr: 'gh: boom\n' });
  const s = broken.state();
  assert.ok(!s.archive);
  assert.equal(s.items[4].status, 'blocked');
  assert.match(s.items[4].reason, /gh: boom/);
});

// ---- field-fixes 10: a verdict file is read from its first Verdict line (spec verdict-files, design D-3)
const SECOND = (verdict) => `\n\n### Findings\nVerdict: ${verdict}`;

test('field-fixes 10 verdict: item 2 counts the first Verdict line, approved then rejected, and prints nothing about the second (AC-3)', () => {
  const t = shipRepo();
  put(t.root, withReviews(reviews(head(t.root), { 'test-coverage-reviewer': review('approved', head(t.root), SECOND('rejected')) })));
  commitAll(t.root, 'reviews');
  const r = runCli(t, ['feat']);
  const line = r.out.split('\n').find((l) => /^ {2}2 /.test(l));
  assert.match(line, /^ {2}2 met\s/, r.out);
  assert.doesNotMatch(r.out + r.err, /rejected/);
  assert.deepEqual(JSON.parse(runCli(t, ['feat', '--json']).out).items[1].details.rejected, []);
});

test('field-fixes 10 verdict: item 2 counts the first Verdict line, rejected then approved, and reports the reviewer as rejected (AC-3)', () => {
  const t = shipRepo();
  put(t.root, withReviews(reviews(head(t.root), { 'test-coverage-reviewer': review('rejected', head(t.root), SECOND('approved')) })));
  commitAll(t.root, 'reviews');
  const it = JSON.parse(runCli(t, ['feat', '--json']).out).items[1];
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.rejected, ['test-coverage-reviewer']);
  assert.deepEqual(it.details.missing, []);
});

test('field-fixes 10 verdict: the devkit-reviews check from both entries passes on approved then rejected and fails on the reverse naming the reviewer (AC-3)', () => {
  const rewrite = (first, second) => {
    const root = ciRepo();
    const sha = head(root);
    put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': review(first, sha, SECOND(second)) });
    commitAll(root, 'rewrite one reviewer');
    return root;
  };
  for (const r of bothEntries(rewrite('approved', 'rejected'))) {
    assert.equal(r.code, 0, r.out + r.err);
    assert.doesNotMatch(r.out + r.err, /rejected/);
  }
  for (const r of bothEntries(rewrite('rejected', 'approved'))) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
  }
});

// ---- review-writer-prompt D-8: a checkbox inside a fenced block is not a task (spec change-delivery)

const FENCE = '`'.repeat(3);
const fencedTasks = (fence, inner) => `# Tasks\n\n## 1. First\n\n- [x] 1.1 code\n- [x] 1.2 Gate: \`node -e 0\` green\n\n${fence}md\n${inner}\n${fence}\n`;

test('review-writer-prompt AC-9 an unticked checkbox inside a backtick fence is not a task of the delivery checker', () => {
  const text = fencedTasks(FENCE, '- [ ] 1.9 example task');
  assert.deepEqual(parseTasks(text).map((t) => t.id), ['1.1', '1.2']);
  const root = gitRepo({ changes: { feat: { 'tasks.md': text } }, files: { 'src/a.ts': 'a\n' } });
  const r = tasksItem(root, 'feat', gitFacts(root));
  assert.deepEqual(r.details.unticked ?? [], [], r.reason);
  assert.doesNotMatch(r.reason, /unticked/);
});

test('review-writer-prompt AC-9 a gate inside a fence has no command to run and is not a gate of any phase', () => {
  const text = fencedTasks(FENCE, '- [ ] 9.9 Gate: run it');
  const tasks = parseTasks(text);
  assert.ok(!tasks.some((t) => t.id === '9.9'));
  const root = gitRepo({ changes: { feat: { 'tasks.md': text } } });
  const phases = readPhases(join(root, 'openspec/changes/feat/tasks.md'));
  assert.ok(!phases.some((p) => p.gate?.id === '9.9'), JSON.stringify(phases));
  assert.doesNotMatch(tasksItem(root, 'feat', gitFacts(root)).reason, /9\.9|without a command/);
});

test('review-writer-prompt AC-9 a tilde fence hides the checkbox too, and a fenced heading does not start a phase', () => {
  const text = fencedTasks('~~~~', '## 7. Fenced phase\n- [ ] 7.1 example');
  assert.deepEqual(parseTasks(text).map((t) => [t.phase, t.id]), [[1, '1.1'], [1, '1.2']]);
});

test('review-writer-prompt AC-9 a checkbox after the closing fence is counted', () => {
  const text = `${fencedTasks(FENCE, '- [ ] 1.9 example')}\n- [ ] 1.3 real task\n`;
  assert.deepEqual(parseTasks(text).filter((t) => !t.done).map((t) => t.id), ['1.3']);
});

test('review-writer-prompt AC-9 a fenced unticked line on the default branch still answers the retro', () => {
  const t = pm();
  t.gh.prFiles(12, [FEAT_TASKS]);
  t.gh.tasksOnDefault('feat', fencedTasks(FENCE, '- [ ] 1.9 example'));
  const s = t.state();
  assert.equal(nextStep(s).step, 'retro');
});

test('review-writer-prompt AC-9 fencedLines is exported by deliver-check.mjs and flow-check.mjs holds no copy', () => {
  assert.equal(typeof DC.fencedLines, 'function');
  assert.deepEqual([...DC.fencedLines('a\n```\nb\n```\nc\n')], [2, 3, 4]);
  const flow = readFileSync(join(here, 'flow-check.mjs'), 'utf8');
  assert.doesNotMatch(flow, /function fencedLines/);
  assert.match(flow, /fencedLines[^;]*from '\.\/deliver-check\.mjs'/s);
});

// ---- review-writer-prompt D-8: an unclosed fence hides nothing (spec change-delivery, review round 1)

const UNCLOSED = `# Tasks\n\n## 1. First\n\n- [x] 1.1 code\n${FENCE}md\n- [ ] 1.2 more\n- [ ] 1.3 Gate: \`node -e 0\` green\n`;

test('review-writer-prompt AC-9 fencedLines: an opening line with no closing line opens no fence', () => {
  assert.deepEqual([...DC.fencedLines(UNCLOSED)], []);
  assert.deepEqual([...DC.fencedLines('a\n```\nb\nc\n')], []);
});

test('review-writer-prompt AC-9 fencedLines: a closed fence after an unclosed one still hides its own lines', () => {
  assert.deepEqual([...DC.fencedLines('a\n```\nb\n~~~\nc\n~~~\nd\n')], [4, 5, 6]);
});

test('review-writer-prompt AC-9 parseTasks counts the task and the gate after an unclosed fence', () => {
  assert.deepEqual(parseTasks(UNCLOSED).map((t) => [t.id, t.done, t.isGate]), [['1.1', true, false], ['1.2', false, false], ['1.3', false, true]]);
});

test('review-writer-prompt AC-9 readPhases gives the gate after an unclosed fence to its phase', () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': UNCLOSED } } });
  const [p] = readPhases(join(root, 'openspec/changes/feat/tasks.md'));
  assert.deepEqual(p.open, ['1.2']);
  assert.equal(p.gate?.id, '1.3');
  assert.equal(p.gate?.command, 'node -e 0');
});

test('review-writer-prompt AC-9 tasksItem lists the tasks after an unclosed fence as unticked', () => {
  const root = gitRepo({ changes: { feat: { 'tasks.md': UNCLOSED } }, files: { 'src/a.ts': 'a\n' } });
  const r = tasksItem(root, 'feat', gitFacts(root));
  assert.notEqual(r.status, 'met', r.reason);
  assert.deepEqual(r.details.unticked, ['1.2', '1.3']);
});

test('review-writer-prompt AC-9 nextStep is implement and names 1.2 after an unclosed fence', () => {
  const t = planRepo({ tasks: UNCLOSED, approval: approvalMd });
  const n = nextStep(t.state());
  assert.equal(n.step, 'implement');
  assert.match(n.reason, /1\.2/);
});

test('review-writer-prompt AC-9 the stage checker counts the tasks after an unclosed fence as pending', () => {
  const lines = UNCLOSED.split('\n');
  const at = (needle) => lines.findIndex((l) => l.includes(needle)) + 1;
  const open = [{ id: '1.1', line: at('1.1'), done: true }, { id: '1.2', line: at('1.2'), done: false }, { id: '1.3', line: at('1.3'), done: false }];
  assert.deepEqual(pendingTasks(open, UNCLOSED).map((t) => t.id), ['1.2', '1.3']);
});

// ---- review-writer-prompt D-6: test files and the scoped staleness (spec verdict-files)

const SIX = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer', 'code-quality-reviewer', 'test-coverage-reviewer'];
const TEST_READERS = ['code-quality-reviewer', 'test-coverage-reviewer'];
const sixAt = (root, sha = head(root)) => put(root, withReviews(Object.fromEntries(SIX.map((n) => [n, review('approved', sha)]))));
const staleOf = (root) => reviewsItem(root, 'feat', gitFacts(root)).details.stale.slice().sort();
// A repo whose six reviewers are recorded and committed at the commit before the head.
function sixRepo() {
  const root = base();
  sixAt(root);
  commitAll(root, 'reviews');
  return root;
}
const testOnlyCommit = (root, files = { 'src/a.test.ts': 't\n' }) => {
  put(root, { ...files, 'openspec/changes/feat/tasks.md': '- [x] 1.1 a\n- [x] 1.2 b\n' });
  return commitAll(root, 'tests only');
};

test('review-writer-prompt AC-8 isTestFile names the test paths of the spec and refuses the others', () => {
  for (const p of ['src/a.test.ts', 'plugins/x/b.spec.mjs', 'test/c.js', 'pkg/tests/d.py', 'src/__tests__/e.tsx', 'plugins/panel/hooks/fixtures/f.json']) assert.equal(DC.isTestFile(p), true, p);
  for (const p of ['src/a.ts', 'src/testing/b.ts', 'src/latest.ts', 'docs/spec.md', 'openspec/specs/x/spec.md', 'src/contest/c.ts']) assert.equal(DC.isTestFile(p), false, p);
  assert.deepEqual(DC.TEST_SPARED_REVIEWERS, ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer']);
});

test('review-writer-prompt AC-8 a commit of tests only stales only the two reviewers that read tests', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  assert.deepEqual(staleOf(root), [...TEST_READERS].sort());
});

test('review-writer-prompt AC-8 after a test-only commit the evidence goes stale first, then the review step names the two reviewers', () => {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  fullEvidence(t.root, t.env);
  put(t.root, withReviews(Object.fromEntries(SIX.map((n) => [n, review('approved', head(t.root))]))));
  commitAll(t.root, 'reviews');
  assert.equal(t.next().step, 'open-pr', 'control: everything current');
  put(t.root, { 'tests/b.mjs': 't\n' });
  commitAll(t.root, 'tests only');
  assert.equal(t.next().step, 'verify', 'the evidence is stale before any review');
  fullEvidence(t.root, t.env);
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', TEST_READERS]);
});

test('review-writer-prompt AC-8 the evidence keeps the default rule and goes stale after a test-only commit', () => {
  const t = committedChange();
  fullEvidence(t.root, t.env);
  put(t.root, { 'tests/b.mjs': 't\n' });
  commitAll(t.root, 'tests only');
  assert.deepEqual(bothEvidenceCurrent(t), ['stale', 'stale']);
});

test('review-writer-prompt AC-8 a product commit later in the range stales all six reviewers', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  put(root, { 'src/a.ts': 'changed\n' });
  commitAll(root, 'product');
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 a commit that mixes a test file and a product file stales all six', () => {
  const root = sixRepo();
  put(root, { 'src/a.test.ts': 't\n', 'src/a.ts': 'changed\n' });
  commitAll(root, 'mixed');
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 an uncommitted product edit stales all six after a test-only commit', () => {
  const root = sixRepo();
  testOnlyCommit(root);
  put(root, { 'src/a.ts': 'edited, not committed\n' });
  assert.deepEqual(staleOf(root), [...SIX].sort());
});

test('review-writer-prompt AC-8 a reviewer outside the six keeps the default rule', () => {
  const root = base();
  put(root, withReviews({ 'perf-reviewer': review('approved', head(root)), ...reviews(head(root)) }));
  commitAll(root, 'reviews');
  testOnlyCommit(root);
  assert.deepEqual(staleOf(root), ['code-quality-reviewer', 'perf-reviewer', 'test-coverage-reviewer']);
});

test('review-writer-prompt AC-8 staleness takes an allowed option and keeps the default without it', () => {
  const root = base();
  const sha = head(root);
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests');
  const recorded = parseCommitLine(`Commit: ${sha}\n`);
  assert.match(staleness(root, recorded, gitFacts(root)), /touches src\/a\.test\.ts/);
  assert.equal(staleness(root, recorded, gitFacts(root), { allowed: (p) => p.startsWith('openspec/') || DC.isTestFile(p) }), null);
});

test('review-writer-prompt AC-8 a merge whose first-parent diff is only test files is current with allowed and stale without it', () => {
  const { root, R } = mergeHistory((r) => { put(r, { 'src/a.test.ts': 't\n' }); commitAll(r, 'tests only on main'); }, mergeMain);
  const recorded = parseCommitLine(`Commit: ${R}\n`);
  assert.match(git(root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), /^src\/a\.test\.ts$/m);
  assert.match(staleness(root, recorded, gitFacts(root)), /touches src\/a\.test\.ts/);
  assert.equal(staleness(root, recorded, gitFacts(root), { allowed: (p) => p.startsWith('openspec/') || DC.isTestFile(p) }), null);
});

test('review-writer-prompt AC-8 the devkit-reviews check from both entries names only the two reviewers after a test-only commit', () => {
  const root = ciRepo();
  const sha = head(root);
  put(root, Object.fromEntries(SIX.map((n) => [`openspec/changes/feat/reviews/${n}.md`, review('approved', sha)])));
  commitAll(root, 'six reviews');
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  const at = head(root);
  put(root, { 'openspec/changes/feat/evidence.md': `Commit: ${at}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}` });
  commitAll(root, 'evidence again');
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /stale code-quality-reviewer/);
    assert.match(r.out, /stale test-coverage-reviewer/);
    assert.doesNotMatch(r.out, /stale (spec|adr|architecture|security)-reviewer/);
  }
});

// ---- review-openspec-fix: a rejected verdict and the change's review record (spec verdict-files)

// base(); A = head; the two readers recorded at A (over: `{ name: verdict }`), committed with nothing else.
function rejectedRepo(over = { 'code-quality-reviewer': 'rejected' }) {
  const root = base();
  const A = head(root);
  const verdicts = { 'code-quality-reviewer': 'approved', 'test-coverage-reviewer': 'approved', ...over };
  put(root, withReviews(Object.fromEntries(Object.entries(verdicts).map(([n, v]) => [n, review(v, A)]))));
  commitAll(root, 'review round');
  return { root, A };
}
// A fix committed in the plan files (or in `path`).
function planFix(root, path = 'openspec/changes/feat/design.md') {
  put(root, { [path]: 'fixed\n' });
  return commitAll(root, 'plan fix');
}
const itemTwo = (root) => reviewsItem(root, 'feat', gitFacts(root));
const NOTED = (A) => `${review('rejected', A)}- [nit] noted\n`;

test('review-openspec-fix 1: a rejected verdict is stale after a commit that touches only openspec/ outside the change\'s review record', () => {
  const { root, A } = rejectedRepo();
  assert.deepEqual(itemTwo(root).details.stale, [], 'control: current before the fix');
  const D = planFix(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(D)}, which touches openspec/changes/feat/design.md)`), r.reason);
});

test('review-openspec-fix 2: a commit of the change\'s reviews/ folder only leaves a rejected verdict current', () => {
  const { root, A } = rejectedRepo();
  put(root, withReviews({ 'code-quality-reviewer': NOTED(A) }));
  commitAll(root, 'record again');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/reviews/code-quality-reviewer.md');
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, []);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
});

test('review-openspec-fix 3: a commit of review.md only leaves a rejected verdict current', () => {
  const { root } = rejectedRepo();
  put(root, { 'openspec/changes/feat/review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n' });
  commitAll(root, 'review.md');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/review.md');
  assert.deepEqual(itemTwo(root).details.stale, []);
});

test('review-openspec-fix 4: a commit of evidence.md only leaves a rejected verdict current', () => {
  const { root, A } = rejectedRepo();
  put(root, { 'openspec/changes/feat/evidence.md': `Commit: ${A}\n\n# Evidence\n` });
  commitAll(root, 'evidence');
  assert.equal(git(root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/evidence.md');
  assert.deepEqual(itemTwo(root).details.stale, []);
});

test('review-openspec-fix 5: a commit of the record together with another openspec/ file makes a rejected verdict stale and names that file', () => {
  const { root, A } = rejectedRepo();
  put(root, { ...withReviews({ 'code-quality-reviewer': NOTED(A) }), 'openspec/changes/feat/tasks.md': '- [x] 1.1 a\n- [x] 1.2 b\n' });
  const C = commitAll(root, 'record and a fix');
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(C)}, which touches openspec/changes/feat/tasks.md)`), r.reason);
});

test('review-openspec-fix 6: paths that only look like the change\'s review record make a rejected verdict stale', () => {
  for (const p of [
    'openspec/changes/other/reviews/code-quality-reviewer.md',
    'openspec/changes/feat/reviews.md',
    'openspec/changes/feat/reviewsx/a.md',
    'openspec/changes/featx/review.md',
    'openspec/changes/feat/proof/evidence.md',
  ]) {
    const { root } = rejectedRepo();
    planFix(root, p);
    const r = itemTwo(root);
    assert.deepEqual(r.details.stale, ['code-quality-reviewer'], p);
    assert.ok(r.reason.includes(`which touches ${p}`), `${p}: ${r.reason}`);
  }
});

test('review-openspec-fix 7: a test-spared reviewer\'s rejected verdict is stale after a commit of test files only, and its approved peers stay current', () => {
  const root = base();
  const A = head(root);
  put(root, withReviews(Object.fromEntries(SIX.map((n) => [n, review(n === 'spec-reviewer' ? 'rejected' : 'approved', A)]))));
  commitAll(root, 'review round');
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  assert.deepEqual(staleOf(root), ['code-quality-reviewer', 'spec-reviewer', 'test-coverage-reviewer']);
});

test('review-openspec-fix 8: a verdict file with no Verdict line is stale after an openspec/-only commit', () => {
  const root = base();
  const A = head(root);
  put(root, withReviews(reviews(A, { 'code-quality-reviewer': `Commit: ${A}\n\n# Review\n` })));
  commitAll(root, 'review round');
  planFix(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.deepEqual(r.details.rejected, ['code-quality-reviewer']);
});

test('review-openspec-fix 9: a rejecting reviewer outside the six is stale after an openspec/-only commit', () => {
  const { root } = rejectedRepo({ 'perf-reviewer': 'rejected' });
  planFix(root);
  assert.deepEqual(itemTwo(root).details.stale, ['perf-reviewer']);
});

test('review-openspec-fix 10: approved and declined verdicts stay current after an openspec/-only commit outside the record', () => {
  const { root } = rejectedRepo({ 'code-quality-reviewer': 'approved', 'security-reviewer': 'declined' });
  planFix(root);
  const r = itemTwo(root);
  assert.equal(r.status, 'met', r.reason);
  assert.deepEqual(r.details.stale, []);
});

test('review-openspec-fix 11: a test-spared reviewer\'s approved verdict stays current after a commit of test files only', () => {
  const root = sixRepo();
  put(root, { 'src/a.test.ts': 't\n' });
  commitAll(root, 'tests only');
  assert.deepEqual(staleOf(root), [...TEST_READERS].sort());
});

test('review-openspec-fix 12: a plan fix written and not committed leaves a rejected verdict current', () => {
  const { root } = rejectedRepo();
  put(root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  assert.deepEqual(itemTwo(root).details.stale, []);
});

test('review-openspec-fix 13: a merge of main that brings only openspec/ makes a rejected verdict stale and names the merge', () => {
  const root = base();
  git(root, 'switch', '-q', '-c', 'feat');
  const A = head(root);
  put(root, withReviews(reviews(A, { 'code-quality-reviewer': review('rejected', A) })));
  commitAll(root, 'review round');
  git(root, 'switch', '-q', 'main');
  onlyOpenspec(root);
  git(root, 'switch', '-q', 'feat');
  mergeMain(root);
  const M = head(root);
  const r = itemTwo(root);
  assert.deepEqual(r.details.stale, ['code-quality-reviewer']);
  assert.ok(r.reason.includes(`stale code-quality-reviewer (${s7(A)} is behind ${s7(M)}, which touches openspec/changes/other.md)`), r.reason);
});

// The loop on a ready change: A = head, a rejecting round recorded and committed (record only).
function rejectedLoop(t, reviewMd = '# Review: feat\n\nConsensus: FAIL (round 1/2)\n') {
  const A = head(t.root);
  put(t.root, withReviews({ 'code-quality-reviewer': review('rejected', A), 'test-coverage-reviewer': review('approved', A) }));
  put(t.root, changeFiles({ 'review.md': reviewMd }));
  return A;
}

test('review-openspec-fix 14: a rejected round fixed by an openspec/-only commit gets review at round 2 naming only the rejecting reviewer', () => {
  const t = readyRepo();
  rejectedLoop(t);
  commitAll(t.root, 'review round');
  const first = t.next();
  assert.deepEqual([first.step, first.reviewers], ['fix-review', ['code-quality-reviewer']]);
  put(t.root, { 'openspec/changes/feat/design.md': 'fixed\n' });
  commitAll(t.root, 'plan fix');
  assert.equal(git(t.root, 'diff', '--name-only', 'HEAD^', 'HEAD'), 'openspec/changes/feat/design.md');
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 2, ['code-quality-reviewer']]);
});

test('review-openspec-fix 15: committing a rejecting round\'s record alone, twice, keeps fix-review', () => {
  const t = readyRepo();
  rejectedLoop(t);
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'review round');
  let n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['fix-review', ['code-quality-reviewer']]);
  put(t.root, changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nNext: fix.\n' }));
  commitAll(t.root, 'review.md again');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['fix-review', ['code-quality-reviewer']]);
  const paths = git(t.root, 'diff', '--name-only', 'HEAD~2', 'HEAD').split('\n');
  assert.ok(paths.every((p) => p.startsWith('openspec/changes/feat/reviews/') || p === 'openspec/changes/feat/review.md' || p === 'openspec/changes/feat/evidence.md'), paths.join(', '));
});

const FAIL_TWICE = '# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nConsensus: FAIL (round 2/2)\n';

test('review-openspec-fix 16: a round-2 rejection committed with its record stops on stop-review-deadlock', () => {
  const t = readyRepo();
  rejectedLoop(t, FAIL_TWICE);
  commitAll(t.root, 'review round 2');
  const n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['stop-review-deadlock', ['code-quality-reviewer']]);
});

test('review-openspec-fix 17: after the round-2 stop, an openspec/-only commit opens a review at round 1, as a product commit does', () => {
  const t = readyRepo();
  rejectedLoop(t, FAIL_TWICE);
  commitAll(t.root, 'review round 2');
  assert.equal(t.next().step, 'stop-review-deadlock', 'control');
  planFix(t.root);
  const n = t.next();
  assert.deepEqual([n.step, n.round, n.reviewers], ['review', 1, ['code-quality-reviewer']]);
});

test('review-openspec-fix 18: the devkit-reviews check fails a rejected review after an openspec/-only fix and names it stale', () => {
  const root = ciRepo();
  const A = head(root);
  put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': review('rejected', A) });
  commitAll(root, 'rejecting round');
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
    assert.doesNotMatch(r.out, /stale test-coverage-reviewer/);
  }
  planFix(root);
  for (const r of bothEntries(root)) {
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /not approved: test-coverage-reviewer \(rejected\)/);
    assert.match(r.out, /stale test-coverage-reviewer \(/);
  }
});

// ================================================================ commit-attribution (D-7, T26 to T36)

const attributionOfAgent = () => {
  const md = coreAgent('commit-and-pr');
  const a = md.indexOf('## Attribution');
  const b = md.indexOf('## Escalate');
  return a >= 0 && b > a ? md.slice(a, b) : '';
};
const methodOfAgent = () => {
  const md = coreAgent('commit-and-pr');
  return md.slice(md.indexOf('## Method'), md.indexOf('## Attribution'));
};

test('commit-attribution AC-2 T26 the agent\'s Receives names the attribution block', () => {
  const md = coreAgent('commit-and-pr');
  const receives = md.slice(md.indexOf('## Receives'), md.indexOf('## Preconditions'));
  for (const part of ['Attribution (from the caller):', 'Commit trailer:', 'PR footer:', 'Attribution (from the caller): none']) assert.ok(receives.includes(part), part);
});

test('commit-attribution AC-2 T27 with lines given the agent writes exactly those and no other', () => {
  const s = attributionOfAgent();
  assert.ok(s.includes('exactly the text after each `Commit trailer:` line'), s);
  assert.ok(s.includes('Add no other `Co-Authored-By` line, attribution trailer or footer'), s);
});

test('commit-attribution AC-2 T28 with none the agent writes no attribution line', () => {
  assert.ok(attributionOfAgent().includes('Write no `Co-Authored-By` line, no attribution trailer and no footer'));
});

test('commit-attribution AC-2 T29 with no block the agent keeps its earlier rule', () => {
  const s = attributionOfAgent();
  const bullet = s.split('\n').find((l) => l.startsWith('- **No block**')) ?? '';
  assert.ok(bullet.includes('the environment or the user requires'), bullet);
});

test('commit-attribution AC-2 T30 the caller\'s block wins over the agent\'s environment', () => {
  assert.ok(attributionOfAgent().includes('wins over the lines your own environment gives you'));
});

test('commit-attribution AC-2 T31 Method steps 3 and 5 point to Attribution and drop the environment rule', () => {
  const m = methodOfAgent();
  assert.equal(m.split('Attribution below').length - 1, 2, m);
  assert.ok(!m.includes('the environment or the user requires'), m);
});

test('commit-attribution AC-2 T32 Never forbids a line the block does not give', () => {
  const md = coreAgent('commit-and-pr');
  assert.ok(md.slice(md.indexOf('## Never')).includes("add one the caller's attribution block does not give"));
});

for (const [n, step] of [[33, 'commit'], [34, 'open-pr'], [35, 'open-archive-pr']]) {
  test(`commit-attribution AC-1 T${n} the ship-change ${step} row ends the prompt with the attribution block`, () => {
    assert.ok(skillRow(shipSkill(), step).includes('End the prompt with the attribution block (Attribution, above).'));
  });
}

test('commit-attribution AC-1 T36 the ship-change Attribution section holds the block and names no model', () => {
  const md = shipSkill();
  const a = md.indexOf('## Attribution');
  const b = md.indexOf('\n## Loop');
  const s = a >= 0 && b > a ? md.slice(a, b) : '';
  for (const part of ['Attribution (from the caller):', 'Commit trailer: <one line this session ends its commit messages with>', 'PR footer: <one line this session ends its pull-request descriptions with>',
    "The caller's lines win over your own environment's, as the owner's choice: write exactly these and no other Co-Authored-By line, attribution trailer or footer.",
    'Attribution (from the caller): none', 'verbatim', "never take the agent's"]) assert.ok(s.includes(part), part);
  assert.doesNotMatch(s, /Opus|Sonnet|Haiku|noreply/);
});

// ---------------------------------------------------------------- own-files (stale-only-on-own-files D-8)
// A merge of the base stales the evidence and the approved or declined reviews only when it brings one of the
// change's own files. The tests reach the new exports through the DC namespace so a missing one fails its own test.

const OWN_REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer', 'spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];
const OWN_SPARED = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];
// Twelve lines whose first and last differ, so the branch and the base edit one file without a conflict.
const ownLines = (first = 'line 1', last = 'line 12') => Array.from({ length: 12 }, (_, i) => (i === 0 ? first : i === 11 ? last : `line ${i + 1}`)).join('\n') + '\n';
const ownReviews = (sha, rejected = []) => Object.fromEntries(OWN_REVIEWERS.map((n) => [`openspec/changes/feat/reviews/${n}.md`, review(rejected.includes(n) ? 'rejected' : 'approved', sha)]));
const ownEvidence = (sha) => `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}`;
const ownUnrelated = (root) => { put(root, { 'src/other.ts': 'changed on main\n', 'openspec/changes/other/tasks.md': '- [ ] 1.1 x\n' }); commitAll(root, 'unrelated on main'); };
const ownMergeMain = (root) => git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
const ownFacts = (root) => gitFacts(root, { base: 'main' });
const evWhy = (root, facts) => acceptanceItem(root, 'feat', facts).reason.match(/evidence\.md is stale \(([^)]*)\)/)?.[1] ?? null;
const reviewWhys = (root, facts) => Object.fromEntries(DC.readReviews(root, 'feat', facts).map((r) => [r.name, r.why]));
const allCurrent = Object.fromEntries(OWN_REVIEWERS.map((n) => [n, null]));

// main with product, test, unrelated and release files and the change folder; branch feat with a product and test
// commit, a release bump, then evidence and six reviews recorded at R; then `onMain` on main, origin/main set
// (`origin`: 'tip' | 'initial' (not fetched) | 'none' | 'head' (the head is in the base)), then `merge` on feat.
function ownFilesRepo({ config = 'schema: devkit-lite\n', origin = 'tip', onMain = ownUnrelated, merge = ownMergeMain, before = null, rejected = [] } = {}) {
  const root = gitRepo({
    config,
    changes: { feat: changeFilesOf() },
    files: {
      'src/a.ts': ownLines(), 'src/a.test.ts': ownLines(), 'src/b.ts': 'b\n', 'src/other.ts': 'other\n',
      'CHANGELOG.md': '# Changelog\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.0.0"}\n',
      '.claude-plugin/marketplace.json': '{"version":"1.0.0"}\n', 'docs/catalog.md': 'catalog\n',
    },
  });
  const initial = head(root);
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': ownLines('branch 1'), 'src/a.test.ts': ownLines('branch 1') });
  commitAll(root, 'product and test');
  put(root, { 'CHANGELOG.md': '# Changelog\n\n## 1.1.0\n- feat\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.1.0"}\n' });
  commitAll(root, 'bump');
  if (before) before(root);
  const R = head(root);
  put(root, { ...ownReviews(R, rejected), 'openspec/changes/feat/evidence.md': ownEvidence(R) });
  commitAll(root, 'reviews and evidence');
  git(root, 'switch', '-q', 'main');
  onMain(root);
  const tip = head(root);
  if (origin === 'tip' || origin === 'initial') git(root, 'update-ref', 'refs/remotes/origin/main', origin === 'tip' ? tip : initial);
  git(root, 'switch', '-q', 'feat');
  if (merge) merge(root);
  if (origin === 'head') git(root, 'update-ref', 'refs/remotes/origin/main', head(root));
  return { root, R, initial, tip, merged: head(root) };
}
// The merge of main after the commits `edit` makes on main.
const ownBrings = (files) => (root) => { put(root, files); commitAll(root, 'base brings files'); };

test('own-files AC-1 rule: a merge of origin/main that brings only unrelated files leaves the evidence and every approved review current', () => {
  const { root } = ownFilesRepo();
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), null);
  assert.equal(tasksItem(root, 'feat', facts).details.evidence, 'current');
  assert.equal(acceptanceItem(root, 'feat', facts).details.evidence, 'current');
  assert.deepEqual(reviewWhys(root, facts), allCurrent);
  const it = reviewsItem(root, 'feat', facts);
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details.stale, []);
});

test('own-files AC-1 rule: the base commits a merge brings in are exempt unless they touch an own file', () => {
  const exempt = ownFilesRepo({ onMain: (r) => {
    put(r, { 'src/x.ts': 'x\n' });
    commitAll(r, 'X adds a product file');
    git(r, 'rm', '-q', 'src/x.ts');
    put(r, { 'src/other.ts': 'changed on main\n' });
    commitAll(r, 'Y removes it');
  } });
  assert.equal(git(exempt.root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), 'src/other.ts');
  assert.equal(evWhy(exempt.root, ownFacts(exempt.root)), null, 'a product file the base added and removed is not an own file');
  assert.deepEqual(reviewWhys(exempt.root, ownFacts(exempt.root)), allCurrent);

  const own = ownFilesRepo({ onMain: (r) => {
    put(r, { 'src/a.ts': ownLines('line 1', 'main 12') });
    commitAll(r, 'X edits a file the branch changed');
    put(r, { 'src/a.ts': ownLines() });
    commitAll(r, 'Y puts it back');
  } });
  assert.equal(git(own.root, 'diff', '--name-only', 'HEAD^1', 'HEAD'), '', 'the merge itself brings nothing');
  assert.match(evWhy(own.root, ownFacts(own.root)), /^[0-9a-f]{7} is behind [0-9a-f]{7}, which touches src\/a\.ts$/);
  assert.ok(!evWhy(own.root, ownFacts(own.root)).includes(s7(own.merged)), 'it names a commit of the base, not the merge');
});

test('own-files AC-1 next: collectState hands neither verify nor review after an unrelated merge', () => {
  const gh = fakeGh();
  gh.set('pr-list', { stdout: [] });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "feat"\n' });
  const env = { ...gh.env, ...CI_ENV };
  const step = (config, onMain) => {
    const { root } = ownFilesRepo({ config, onMain });
    return nextStep(collectState(root, 'feat', { env })).step;
  };
  const config = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n';
  assert.ok(!['verify', 'review', 'fix-review'].includes(step(config, ownUnrelated)), 'unrelated merge');
  assert.equal(step(config, ownBrings({ 'src/a.ts': ownLines('line 1', 'main 12') })), 'verify', 'own-file merge');
});

test('own-files AC-2 rule: a merge that brings a product file the branch changed is stale and names the merge and the file', () => {
  const { root, R, merged } = ownFilesRepo({ onMain: ownBrings({ 'src/a.ts': ownLines('line 1', 'main 12') }) });
  const facts = ownFacts(root);
  const why = `${s7(R)} is behind ${s7(merged)}, which touches src/a.ts`;
  assert.equal(evWhy(root, facts), why);
  assert.match(tasksItem(root, 'feat', facts).reason, new RegExp(`evidence\\.md is stale \\(${why}\\)`));
  assert.deepEqual(reviewWhys(root, facts), Object.fromEntries(OWN_REVIEWERS.map((n) => [n, why])));
  assert.equal(reviewsItem(root, 'feat', facts).status, 'open');
});

test('own-files AC-2 rule: a merge that brings a test file the branch changed stales the evidence', () => {
  const { root, R, merged } = ownFilesRepo({ onMain: ownBrings({ 'src/a.test.ts': ownLines('line 1', 'main 12') }) });
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), `${s7(R)} is behind ${s7(merged)}, which touches src/a.test.ts`);
  assert.equal(tasksItem(root, 'feat', facts).details.evidence, 'stale');
  const whys = reviewWhys(root, facts);
  assert.ok(whys['code-quality-reviewer'] && whys['test-coverage-reviewer']);
});

test('own-files AC-3 rule: one own file among unrelated ones is enough and is the one named', () => {
  const { root, R, merged } = ownFilesRepo({ onMain: ownBrings({ 'docs/unrelated.md': 'u\n', 'src/other.ts': 'changed on main\n', 'src/a.ts': ownLines('line 1', 'main 12') }) });
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), `${s7(R)} is behind ${s7(merged)}, which touches src/a.ts`);
  assert.ok(reviewWhys(root, facts)['code-quality-reviewer'].endsWith('which touches src/a.ts'));
});

test('own-files AC-4 rule: a merge that brings only release files, the bumped CHANGELOG.md resolved in the merge included, leaves the records current', () => {
  const { root } = ownFilesRepo({
    onMain: ownBrings({
      'CHANGELOG.md': '# Changelog\n\n## 1.0.1\n- main\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.0.1"}\n',
      '.claude-plugin/marketplace.json': '{"version":"1.0.1"}\n', 'docs/catalog.md': 'catalog 2\n',
    }),
    merge: (r) => {
      try { git(r, 'merge', '-q', '--no-ff', '--no-commit', 'main'); } catch { /* the release files conflict */ }
      put(r, { 'CHANGELOG.md': '# Changelog\n\n## 1.1.0\n- feat\n\n## 1.0.1\n- main\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.1.0"}\n' });
      git(r, 'add', '-A');
      git(r, 'commit', '-q', '-m', 'merge main, resolving the release files');
    },
  });
  assert.equal(git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3, 'a merge commit');
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), null);
  assert.deepEqual(reviewWhys(root, facts), allCurrent);
});

test('own-files AC-5 rule: a plain product commit after an exempt merge is stale', () => {
  const { root, R } = ownFilesRepo();
  assert.equal(evWhy(root, ownFacts(root)), null);
  put(root, { 'src/unrelated.ts': 'u\n' });
  const P = commitAll(root, 'product after the merge');
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), `${s7(R)} is behind ${s7(P)}, which touches src/unrelated.ts`);
  assert.equal(reviewWhys(root, facts)['code-quality-reviewer'], `${s7(R)} is behind ${s7(P)}, which touches src/unrelated.ts`);
});

test('own-files AC-6 rule: a rejected verdict is stale after an exempt merge; the approved ones are current', () => {
  const { root } = ownFilesRepo({ rejected: ['security-reviewer'] });
  const whys = reviewWhys(root, ownFacts(root));
  assert.match(whys['security-reviewer'], /^[0-9a-f]{7} is behind [0-9a-f]{7}, which touches /);
  assert.deepEqual(Object.fromEntries(Object.entries(whys).filter(([n]) => n !== 'security-reviewer')), Object.fromEntries(OWN_REVIEWERS.filter((n) => n !== 'security-reviewer').map((n) => [n, null])));
});

test('own-files AC-6 rule: a test-only commit after an exempt merge keeps the four test-spared reviewers current', () => {
  const { root, R } = ownFilesRepo();
  put(root, { 'src/a.test.ts': ownLines('branch 1', 'tests again') });
  const T = commitAll(root, 'tests only');
  const whys = reviewWhys(root, ownFacts(root));
  for (const n of OWN_SPARED) assert.equal(whys[n], null, n);
  for (const n of ['code-quality-reviewer', 'test-coverage-reviewer']) assert.equal(whys[n], `${s7(R)} is behind ${s7(T)}, which touches src/a.test.ts`, n);
});

test('own-files AC-7 rule: no origin/<base>, an unfetched base, a merge of another branch and a head inside the base each give today\'s verdict', () => {
  const sameAsToday = (label, repo) => {
    const { root } = repo;
    const today = evWhy(root, gitFacts(root));
    assert.ok(today, `${label}: the verdict without a base is stale`);
    assert.equal(evWhy(root, ownFacts(root)), today, label);
    assert.deepEqual(reviewWhys(root, ownFacts(root)), reviewWhys(root, gitFacts(root)), label);
  };
  sameAsToday('no origin/main', ownFilesRepo({ origin: 'none' }));
  sameAsToday('an unfetched base', ownFilesRepo({ origin: 'initial' }));
  sameAsToday('the head inside the base', ownFilesRepo({ origin: 'head' }));
  sameAsToday('a merge of another branch', ownFilesRepo({
    onMain: () => {},
    merge: (r) => {
      git(r, 'switch', '-q', '-c', 'side', 'main');
      put(r, { 'docs/unrelated.md': 'u\n' });
      commitAll(r, 'side work');
      git(r, 'switch', '-q', 'feat');
      git(r, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side');
    },
    origin: 'tip',
  }));
});

test('own-files AC-7 rule: a file the branch changed then restored is not own', () => {
  const { root } = ownFilesRepo({
    before: (r) => {
      put(r, { 'src/b.ts': 'changed early\n' });
      commitAll(r, 'change b');
      put(r, { 'src/b.ts': 'b\n' });
      commitAll(r, 'restore b');
    },
    onMain: ownBrings({ 'src/b.ts': 'changed on main\n' }),
  });
  const facts = ownFacts(root);
  assert.equal(evWhy(root, facts), null);
  assert.deepEqual(reviewWhys(root, facts), allCurrent);
});

test('own-files AC-7 base: stalenessBase reads GITHUB_BASE_REF, then the configured base, then origin/HEAD, then main or master, else null', () => {
  const repo = (refs = []) => {
    const root = gitRepo();
    for (const r of refs) git(root, 'update-ref', `refs/remotes/origin/${r}`, 'HEAD');
    return root;
  };
  const none = {};
  assert.equal(DC.stalenessBase(repo(['main']), { GITHUB_BASE_REF: 'develop' }, 'trunk'), 'develop', 'the pull request base wins, resolved or not');
  assert.equal(DC.stalenessBase(repo(['main']), { GITHUB_BASE_REF: '' }, 'trunk'), 'trunk', 'a blank GITHUB_BASE_REF is not set');
  const withHead = repo(['main', 'dev']);
  git(withHead, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/dev');
  assert.equal(DC.stalenessBase(withHead, none, null), 'dev', 'origin/HEAD');
  assert.equal(DC.stalenessBase(repo(['master']), none, null), 'master');
  assert.equal(DC.stalenessBase(repo(['master', 'main']), none, null), 'main', 'main first');
  assert.equal(DC.stalenessBase(repo(), none, null), null);
});

test('own-files AC-7 own: ownFiles leaves out release files, keeps the change folder and both sides of a move', () => {
  const { root, tip } = ownFilesRepo({ merge: null, before: (r) => {
    git(r, 'mv', 'src/other.ts', 'src/moved.ts');
    git(r, 'commit', '-q', '-m', 'move');
  } });
  const own = DC.ownFiles(root, 'feat', ownFacts(root));
  assert.equal(own.base, 'main');
  assert.equal(own.tip, tip);
  for (const p of ['src/a.ts', 'src/a.test.ts', 'src/other.ts', 'src/moved.ts', 'openspec/changes/feat/notes.md']) assert.equal(own.isOwn(p), true, p);
  for (const p of ['CHANGELOG.md', 'plugins/p/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'docs/catalog.md', 'src/b.ts', 'openspec/changes/other/tasks.md']) assert.equal(own.isOwn(p), false, p);
  assert.equal(DC.ownFiles(root, 'feat', gitFacts(root)), null, 'no base');
  assert.equal(DC.ownFiles(root, 'feat', gitFacts(root, { base: 'nowhere' })), null, 'a base with no origin ref');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(DC.ownFiles(root, 'feat', ownFacts(root)), null, 'the head is in the base');
});

test('own-files AC-8 ci: the check passes after an unrelated merge and fails naming the merge after an own-file merge, from both entries', () => {
  const guardCli = join(here, 'guard.mjs');
  const run = (root) => {
    const event = join(tmpFolder('devkit-event-'), 'event.json');
    writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: head(root) } } }));
    const env = { ...process.env, ...CI_ENV, GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'feat', GITHUB_EVENT_PATH: event };
    const a = spawnSync(process.execPath, [cli, '--ci'], { cwd: root, encoding: 'utf8', env });
    const b = spawnSync(process.execPath, [guardCli, 'ci'], { cwd: root, encoding: 'utf8', env, input: '{}' });
    return { deliver: a, guard: b };
  };
  const ok = run(ownFilesRepo().root);
  for (const [entry, r] of Object.entries(ok)) assert.equal(r.status, 0, `${entry}: ${r.stdout}${r.stderr}`);
  const bad = ownFilesRepo({ onMain: ownBrings({ 'src/a.ts': ownLines('line 1', 'main 12') }) });
  const failed = run(bad.root);
  for (const [entry, r] of Object.entries(failed)) {
    assert.equal(r.status, 1, `${entry}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, new RegExp(`${s7(bad.R)} is behind ${s7(bad.merged)}, which touches src/a\\.ts`), entry);
  }
});

test('own-files AC-9 docs: the flow doc states the rule, the fail-safe cases and the check backstop', () => {
  const flow = textOf('docs', 'openspec-flow.md');
  const at = flow.indexOf('**The own-files rule.**');
  assert.ok(at >= 0, 'the flow doc has the own-files paragraph');
  const para = flow.slice(at, flow.indexOf('\n\n', at));
  for (const [what, pattern] of [
    ['the own files are the net diff against the base', /own files/],
    ['a release file is never own', /release files/],
    ['the merge and the base commits it brings are exempt', /base commits/],
    ['the base is named', /`origin\/<base>`/],
    ['a rejected review keeps the strict rule', /rejected review/],
    ['no origin ref fails safe', /no `origin\/<base>`/],
    ['an unfetched base fails safe', /not fetched|unfetched/],
    ['a merge of another branch fails safe', /another branch/],
    ['a head inside the base fails safe', /head (is )?(already )?(in|inside) the base/],
    ['the check is the backstop', /backstop/],
    ['the check runs on the merged ref', /`check`/],
    ['the decision is cited', /ADR 0022/],
  ]) assert.match(para, pattern, what);
  const everyMerge = /every merge of the base that touches a file outside `openspec\/` makes its evidence and all its reviews stale/;
  for (const file of [['docs', 'openspec-flow.md'], ['CONTRIBUTING.md'], ['plugins', 'core', 'skills', 'review-change', 'SKILL.md']]) {
    assert.doesNotMatch(textOf(...file), everyMerge, file.join('/'));
  }
  assert.match(textOf('docs', 'openspec-flow.md'), /every merge of the base that brings one of its own files/, 'the release paragraph');
  assert.match(textOf('CONTRIBUTING.md'), /own files/, 'CONTRIBUTING names the own files');
  assert.match(textOf('plugins', 'core', 'skills', 'review-change', 'SKILL.md'), /brings none of the change's own files/, 'the review skill');
  const ci = textOf('docs', 'openspec-flow.md');
  assert.match(ci.slice(ci.indexOf('\n## CI')), /`GITHUB_BASE_REF`[^\n]*own files|own files[^\n]*`GITHUB_BASE_REF`/, 'the CI section');
});
