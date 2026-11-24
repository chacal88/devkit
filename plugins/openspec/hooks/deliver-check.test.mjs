// Tests for deliver-check.mjs, part 1 of 3 (suite-speed D-11; the others are deliver-check-cli.test.mjs and deliver-check-archive.test.mjs): the ship config, the staleness, the eight items, the next step and the summary, the resume and the walkthrough, the plan approval on disk and the merge mode up to the stops and the carry-over. What the three parts share is in deliver-check-fixtures.mjs.
// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync as fsRm, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { spawnSync } from 'node:child_process';
import {
  parseShip, parseMergeMethod, shipConfig, SHIP_MODES, shipMode, ShipConfigError, parseCommitLine, gitFacts, staleness, reviewsItem, tasksItem,
  parseTasks, readPhases, findingsItem, acceptanceItem, makeGh, fetchPr, prItem, checksItem, conversationItem, bodyItem, nextStep, readReviewMd,
  waitingFor, summarize, collectState, buildReport, locateChange, schemaOf, approvalState, RELEASE_FILE, ciMain,
} from './deliver-check.mjs';
import * as DC from './deliver-check.mjs';
import { findingLine, consolidate, outcomeOf, validateStage1, treeState } from '../../core/skills/review-change/scripts/review-round.mjs';
import { git, gitRepo, put, commitAll, proposalWith, fakeGh, tasksText, check, presetSetup, shipRepo, runCli, GIT_ENV } from './test-fixtures.mjs';
import {
  here, review, reviews, withReviews, base, head, mergeHistory, mergeMain, onlyOpenspec, s7, gateRow, ev, acRow, changeFiles, callGh, PR_FIELDS,
  prJson, OLD_FLAG, versionsOf, conversation, tick, devkitRepo, readinessHash, approvalMd, planRepo, reviewAt, fullEvidence, PR_BODY, driveToReady,
  readyRepo, committedChange, itemsOf, bothEvidenceCurrent, MERGE_FIELDS, noMergeCall, mergeReady, presetArchiveReads,
  state, open, blocked, rejectedState, BOTH,
  ciGate, changeFilesOf, CI_ENV, OWN_REVIEWERS, ownLines, ownReviews, ownEvidence, ownUnrelated, ownMergeMain, ownFilesRepo, ownBrings,
} from './deliver-check-fixtures.mjs';

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
const evidenceFile = (sha, rows = '') => `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${rows}`;
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
const acEvidence = (sha, rows) => `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${rows}`;

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


test('nextStep row 8: a rejected review at a current commit goes to fix-review with its findings', () => {
  const n = nextStep(rejectedState());
  assert.equal(n.step, 'fix-review');
  assert.deepEqual(n.reviewers, ['code-quality-reviewer']);
  assert.deepEqual(n.findings, [{ reviewer: 'code-quality-reviewer', excerpt: '[blocking] x' }]);
});

test('jira-entry-followups AC-3 nextStep: planDirty with a fix gives commit, without a fix or without planDirty it does not', () => {
  const planDirty = ['openspec/changes/feat/design.md'];
  const withFix = nextStep(rejectedState({ planDirty }));
  assert.equal(withFix.step, 'commit');
  assert.deepEqual(withFix.paths, planDirty);
  assert.match(withFix.reason, /the fix for code-quality-reviewer is not committed: openspec\/changes\/feat\/design\.md/);
  assert.equal(nextStep(state({ planDirty })).step, 'ready', 'nothing to fix: planDirty is no step of its own');
  assert.equal(nextStep(rejectedState({ planDirty: [] })).step, 'fix-review', 'an empty planDirty');
  assert.equal(nextStep(rejectedState()).step, 'fix-review', 'a state with no planDirty key');
  assert.equal(nextStep(rejectedState({ planDirty, reviewMd: { consensus: 'FAIL', round: 2 } })).step, 'stop-review-deadlock', 'the round-2 stop keeps its place');
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
  commitAll(t.root, 'evidence');
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
  commitAll(t.root, 'evidence');
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

test('walkthrough: a devkit-lite change goes from no ticked task to ready without a stop step (AC-2)', () => {
  assert.deepEqual(driveToReady(shipRepo()), ['implement', 'gate', 'implement', 'gate', 'commit', 'verify', 'commit', 'review', 'open-pr', 'ready']);
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
  commitAll(t.root, 'evidence');
  n = t.next();
  assert.deepEqual([n.step, n.round], ['review', 1]);
  assert.deepEqual(n.reviewers, ['code-quality-reviewer', 'test-coverage-reviewer']);
});
const productCommit = (t, text = 'a later product change\n') => { put(t.root, { 'src/a.ts': text }); return commitAll(t.root, 'product change'); };

test('AC-3 fix-restales-both (a): after a rejected review and its fix commit, verify comes first and then review at round 2', () => {
  const t = readyRepo();
  put(t.root, withReviews({ 'code-quality-reviewer': review('rejected', head(t.root)), 'test-coverage-reviewer': review('approved', head(t.root)) }));
  put(t.root, changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n' }));
  assert.equal(t.next().step, 'fix-review');
  productCommit(t);
  assert.equal(t.next().step, 'verify');
  fullEvidence(t.root, t.env);
  commitAll(t.root, 'evidence');
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
  commitAll(t.root, 'evidence');
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
  commitAll(t.root, 'evidence');
  n = t.next();
  assert.deepEqual([n.step, n.reviewers], ['review', ['code-quality-reviewer', 'test-coverage-reviewer']]);
  reviewAt(t.root, n.reviewers);
  assert.equal(t.next().step, 'push');
});

// ---- AC-4: evidence.md and reviews/*.md written one after the other never stale each other (design D3)

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

// ---------------------------------------------------------------- jira-entry-followups: the round marks the Commit line from git (AC-1, AC-2)

const ROUND_CLI = join(here, '..', '..', 'core', 'skills', 'review-change', 'scripts', 'review-round.mjs');
const treeFiles = () => ({
  changes: { feat: { 'tasks.md': '- [x] 1.1 a\n', 'evidence.md': 'e\n', 'design.md': 'd\n' } },
  files: { 'src/a.ts': 'a\n', 'src/b.ts': 'b\n', 'src/old.ts': 'o\n', '.claude/settings.json': '{}\n' },
});
const treeRepoOf = () => gitRepo(treeFiles());

test('jira-entry-followups AC-1 the round\'s tree rule is the delivery check\'s', () => {
  const trees = {
    clean: [() => {}, []],
    'only openspec files': [(r) => put(r, { 'openspec/changes/feat/evidence.md': 'e2\n', 'openspec/changes/feat/design.md': 'd2\n', 'openspec/changes/feat/notes.md': 'new\n' }), []],
    'every path that counts': [(r) => {
      put(r, { 'src/a.ts': 'a2\n', 'src/b.ts': 'b2\n', 'src/new.ts': 'n\n', '.claude/settings.json': '{"x":1}\n', 'openspec/changes/feat/evidence.md': 'e2\n' });
      git(r, 'add', 'src/b.ts');
      git(r, 'mv', 'src/old.ts', 'openspec/moved.md');
    }, ['.claude/settings.json', 'src/a.ts', 'src/b.ts', 'src/new.ts', 'src/old.ts']],
    'an untracked path under .claude/ alone': [(r) => put(r, { '.claude/worktrees/x/a.txt': 'x\n' }), []],
  };
  for (const [label, [edit, expected]] of Object.entries(trees)) {
    const root = treeRepoOf();
    edit(root);
    const round = treeState(root);
    const check = gitFacts(root);
    assert.deepEqual(round.dirty, check.dirty, label);
    assert.equal(round.head, check.head, label);
    assert.deepEqual([...round.dirty].sort(), expected, `${label}: not a vacuous match`);
  }
});

// The session's part and the agents path of one round, as the review skill says: tree, then outcomes, then each
// verdict file written as its writer prompt says. Returns what the checks below read.
function agentsRound(root) {
  const dir = tmpFolder('devkit-deliver-round-');
  let n = 0;
  const run = (sub, input, expected = 0) => {
    const file = join(dir, `in-${n += 1}.json`);
    writeFileSync(file, JSON.stringify(input));
    const r = spawnSync(process.execPath, [ROUND_CLI, sub, '--input', file], { encoding: 'utf8' });
    assert.equal(r.status, expected, `${sub}: ${r.stderr}`);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const { head: sha, dirty } = run('tree', { root });
  const bench = ['code-quality-reviewer', 'test-coverage-reviewer'].map((reviewer) => ({ reviewer, previous: null, range: null }));
  const args = { change: 'feat', changeDir: 'openspec/changes/feat', round: 1, path: 'agents', range: 'main..HEAD', structural: 'PASS', preamble: '', bench, head: sha, dirty };
  const stage1 = Object.fromEntries(bench.map(({ reviewer }) => [reviewer, { declined: false, commit: sha, heading: `## ${reviewer} - feat`, read: ['src/a.ts'], notRead: [], findings: [], sections: 'Looks right.' }]));
  const { outcomes, jobs } = run('outcomes', { args, stage1, votes: {} });
  const line2 = jobs.map((j) => /^line 2: (.*)$/m.exec(j.prompt)[1]);
  const checked = jobs.map((job, i) => {
    const o = outcomes[i];
    const verdict = /^line 1: exactly (Verdict: \w+)/m.exec(job.prompt)[1];
    const path = /^Write your verdict file (\S+), overwriting/m.exec(job.prompt)[1];
    put(root, { [path]: `${verdict}\n${line2[i]}\n\n${o.heading}\n\n### Findings\n${o.lines.join('\n')}\n\n${o.sections}\n` });
    return run('check-file', { file: join(root, path), outcome: o });
  });
  return { sha, dirty, line2, checked };
}

test('jira-entry-followups AC-1 a round with only openspec files uncommitted writes plain Commit lines that deliver-check reads as current', () => {
  const root = treeRepoOf();
  put(root, { 'openspec/changes/feat/evidence.md': 'e2\n', 'openspec/changes/feat/design.md': 'd2\n' });
  const round = agentsRound(root);
  assert.deepEqual(round.dirty, []);
  assert.deepEqual(round.line2, [`Commit: ${round.sha}`, `Commit: ${round.sha}`]);
  assert.deepEqual(round.checked, [{ ok: true }, { ok: true }], 'check-file passes on the files as the prompt says');
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'met', it.reason);
  assert.deepEqual(it.details, { stale: [], rejected: [], missing: [] });
});

test('jira-entry-followups AC-2 a round with a product file uncommitted writes the marker and deliver-check lists it stale', () => {
  const root = treeRepoOf();
  put(root, { 'src/a.ts': 'wip\n', 'openspec/changes/feat/evidence.md': 'e2\n' });
  const round = agentsRound(root);
  assert.deepEqual(round.dirty, ['src/a.ts']);
  assert.deepEqual(round.line2, [`Commit: ${round.sha} (uncommitted changes)`, `Commit: ${round.sha} (uncommitted changes)`]);
  assert.deepEqual(round.checked, [{ ok: true }, { ok: true }], 'check-file expects that line');
  const it = reviewsItem(root, 'feat');
  assert.equal(it.status, 'open');
  assert.deepEqual(it.details.stale, ['code-quality-reviewer', 'test-coverage-reviewer']);
  assert.match(it.reason, new RegExp(`stale code-quality-reviewer \\(${round.sha.slice(0, 7)} was recorded with uncommitted changes\\)`));
});


// ---------------------------------------------------------------- own-files (stale-only-on-own-files D-8)
// A merge of the base stales the evidence and the approved or declined reviews only when it brings one of the
// change's own files. The tests reach the new exports through the DC namespace so a missing one fails its own test.

const OWN_SPARED = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];
const ownFacts = (root) => gitFacts(root, { base: 'main' });
const ownGitOk = (root, ...args) => { try { git(root, ...args); return true; } catch { return false; } };
const evWhy = (root, facts) => acceptanceItem(root, 'feat', facts).reason.match(/evidence\.md is stale \(([^)]*)\)/)?.[1] ?? null;
const reviewWhys = (root, facts) => Object.fromEntries(DC.readReviews(root, 'feat', facts).map((r) => [r.name, r.why]));
const allCurrent = Object.fromEntries(OWN_REVIEWERS.map((n) => [n, null]));


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

test('own-files AC-1 next: collectState hands open-pr, not verify or review, after an unrelated merge', () => {
  const gh = fakeGh();
  gh.set('pr-list', { stdout: [] });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "feat"\n' });
  const env = { ...gh.env, ...CI_ENV };
  const step = (config, onMain) => {
    const { root } = ownFilesRepo({ config, onMain });
    return nextStep(collectState(root, 'feat', { env })).step;
  };
  const config = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n';
  assert.equal(step(config, ownUnrelated), 'open-pr', 'unrelated merge: the records are current, the pull request is the next step');
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

// jira-entry-followups AC-4: an approved verdict that still lists an undisposed finding follows the rejected verdict's
// rule, so the own-files exemption of a merge of the base does not apply to it (deliver-check.mjs, readReviews: `own`).
for (const [label, line, stale] of [
  ['an undisposed [important] finding', '- [important] x\n', true],
  ['an undisposed [blocking] finding', '- [blocking] x\n', true],
  ['a refuted finding', '- [important] x · refuted: the test shows it\n', false],
  ['a nit only', '- [nit] x\n', false],
]) {
  test(`jira-entry-followups AC-4 own-files: an approved verdict with ${label} is ${stale ? 'stale' : 'current'} after an exempt merge`, () => {
    const { root, R } = ownFilesRepo({ merge: null });
    put(root, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': `${review('approved', R)}${line}` });
    commitAll(root, 'finding in the record');
    ownMergeMain(root);
    const whys = reviewWhys(root, ownFacts(root));
    if (stale) assert.match(whys['code-quality-reviewer'], /^[0-9a-f]{7} is behind [0-9a-f]{7}, which touches /);
    else assert.equal(whys['code-quality-reviewer'], null);
    for (const n of OWN_REVIEWERS.filter((x) => x !== 'code-quality-reviewer')) assert.equal(whys[n], null, `${n} (no finding) stays current`);
  });
}

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

test('own-files AC-7 rule: a head that is a merge made on the base, both parents already in origin/<base>, is judged as without a base', () => {
  const root = gitRepo({ config: 'schema: devkit-lite\n', changes: { feat: changeFilesOf() }, files: { 'src/x.ts': 'x\n' } });
  const R = head(root);
  put(root, { ...ownReviews(R), 'openspec/changes/feat/evidence.md': ownEvidence(R) });
  commitAll(root, 'reviews and evidence');
  put(root, { 'openspec/changes/other/tasks.md': '- [ ] 1.1 x\n' });
  commitAll(root, 'main moves');
  git(root, 'switch', '-q', '-c', 'side');
  put(root, { 'src/y.ts': 'y\n' });
  const tip = commitAll(root, 'the base goes on with a product file');
  git(root, 'update-ref', 'refs/remotes/origin/main', tip);
  // the branch merges the base's newest commit into its own first parent: the merge is the branch's, but both parents are in the base
  git(root, 'switch', '-q', '-c', 'feat', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge side on the branch', 'side');
  for (const parent of git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').slice(1)) {
    assert.ok(ownGitOk(root, 'merge-base', '--is-ancestor', parent, 'refs/remotes/origin/main'), 'both parents are in the base');
  }
  const facts = ownFacts(root);
  assert.ok(DC.ownFiles(root, 'feat', facts), 'the rule applies: the head itself is not in the base');
  assert.equal(DC.ownFiles(root, 'feat', facts).isOwn('src/y.ts'), false, 'the merge brings no own file');
  const today = evWhy(root, gitFacts(root));
  assert.equal(today, `${s7(R)} is behind ${s7(head(root))}, which touches src/y.ts`, 'the verdict without a base names the merge');
  assert.equal(evWhy(root, facts), today, 'the merge is not exempted as a merge of the base');
  assert.deepEqual(reviewWhys(root, facts), reviewWhys(root, gitFacts(root)));
});

test('own-files AC-7 rule: histories with no merge base give ownFiles null and today\'s verdict', () => {
  const { root } = ownFilesRepo({ origin: 'none' });
  const orphan = git(root, 'commit-tree', git(root, 'hash-object', '-t', 'tree', '/dev/null'), '-m', 'unrelated root');
  git(root, 'update-ref', 'refs/remotes/origin/main', orphan);
  assert.ok(!ownGitOk(root, 'merge-base', 'HEAD', orphan), 'the base shares no history with the head');
  assert.equal(DC.ownFiles(root, 'feat', ownFacts(root)), null);
  const today = evWhy(root, gitFacts(root));
  assert.ok(today, 'the verdict without a base is stale');
  assert.equal(evWhy(root, ownFacts(root)), today);
  assert.deepEqual(reviewWhys(root, ownFacts(root)), reviewWhys(root, gitFacts(root)));
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

// origin/develop holds the base tip the merge brought (unrelated files only) and origin/main an older commit, so a
// run that judges against `main` instead of `develop` finds the unrelated merge off the base and calls the records stale.
const OWN_TWO_PRS = 'schema: devkit-lite\ndevkit:\n  delivery:\n    model: two-prs\n    base: develop\n    test_branch: staging\n';
function ownDevelopRepo(config) {
  const r = ownFilesRepo({ config, origin: 'none' });
  git(r.root, 'update-ref', 'refs/remotes/origin/develop', r.tip);
  git(r.root, 'update-ref', 'refs/remotes/origin/main', r.initial);
  return r.root;
}
const ownStateOf = (root, env = {}) => {
  const gh = fakeGh();
  gh.set('pr-list', { stdout: [] });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "feat"\n' });
  const state = collectState(root, 'feat', { env: { ...gh.env, ...CI_ENV, ...env } });
  return { evidence: state.items[0].details.evidence, staleReviews: state.reviews.filter((x) => !x.current).map((x) => x.name) };
};
const OWN_JUDGED_CURRENT = { evidence: 'current', staleReviews: [] };

test('own-files AC-7 collectState: the configured base (two-prs) is the branch whose merges the rule exempts, not main', () => {
  assert.deepEqual(ownStateOf(ownDevelopRepo(OWN_TWO_PRS)), OWN_JUDGED_CURRENT, 'base develop: the unrelated merge stays current');
  const viaMain = ownStateOf(ownDevelopRepo('schema: devkit-lite\n'));
  assert.equal(viaMain.evidence, 'stale', 'without the configured base the main fallback judges the same repository stale');
  assert.deepEqual(viaMain.staleReviews, [...OWN_REVIEWERS].sort());
});

test('own-files AC-7 collectState: GITHUB_BASE_REF is the base, ahead of main', () => {
  const root = ownDevelopRepo('schema: devkit-lite\n');
  assert.deepEqual(ownStateOf(root, { GITHUB_BASE_REF: 'develop' }), OWN_JUDGED_CURRENT, 'GITHUB_BASE_REF=develop');
  assert.equal(ownStateOf(root, {}).evidence, 'stale', 'the same repository without it falls back to main');
});

test('own-files AC-7 collectState: GITHUB_BASE_REF wins over the configured base', () => {
  const root = ownDevelopRepo(OWN_TWO_PRS);
  git(root, 'update-ref', 'refs/remotes/origin/trunk', git(root, 'rev-parse', 'refs/remotes/origin/main'));
  assert.equal(ownStateOf(root, { GITHUB_BASE_REF: 'trunk' }).evidence, 'stale', 'the pull request base trunk is judged, not the configured develop');
  assert.deepEqual(ownStateOf(root, {}), OWN_JUDGED_CURRENT, 'the configured develop when no pull request base is set');
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

// ---------------------------------------------------------------- the release note rows (release-at-merge D-5, D-8, D-9)

import {
  REL_FILE, REL_CONFIG, NOTE_TEXT, releaseLayout, noteRepo, stepCommit, baseReleases, noteShip, noteReady, setPrHead, tickAll, ciProve, flowPage,
} from './deliver-check-fixtures.mjs';

const relNext = (t, over = {}) => nextStep(collectState(t.root, 'feat', { env: { ...t.env, ...over } }));
const relNote = (...lines) => `${lines.join('\n')}\n`;
const setVersion = (root, path, version) => {
  const file = join(root, path);
  const obj = JSON.parse(readFileSync(file, 'utf8'));
  obj.version = version;
  writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
};
// A commit on main (by hand) that lands `files`, with origin/main set to it; the root ends on ship/feat again.
const relLand = (t, files) => {
  git(t.root, 'switch', '-q', 'main');
  put(t.root, files);
  commitAll(t.root, 'landed on main');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(t.root, 'switch', '-q', 'ship/feat');
};
const { ['.claude-plugin/marketplace.json']: _market, ...NO_MARKET } = releaseLayout();

// ---- N1: the note cannot be read, or the repository cannot release it
const N1 = [
  ['a bump that is not one', { note: 'packs:\n- devkit-core: big\n' }, /^release\.md: packs: devkit-core: "big" is not patch, minor or major/],
  ['a pack the project does not have', { note: relNote('packs:', '- devkit-nope: patch', '', '## t', '', 'body') }, /^release\.md: packs: devkit-nope is not a pack of this project/],
  ['marketplace: in a project with no marketplace file', { files: NO_MARKET, note: relNote('packs:', '- devkit-core: patch', 'marketplace: minor', '', '## t', '', 'body') }, /^release\.md: marketplace: the project has no \.claude-plugin\/marketplace\.json/],
  ['release: on a pack manifest', { note: relNote('packs: []', 'release: minor', '', '## t', '', 'body') }, /^release\.md: release: .*devkit-openspec; state its bump under packs:/],
];
for (const [label, opts, pattern] of N1) {
  test(`release-note AC-1 row N1: ${label} blocks the delivery with the reason of the reader`, () => {
    const t = noteShip(opts);
    tickAll(t);
    const n = relNext(t);
    assert.equal(n.step, 'blocked');
    assert.match(n.reason, pattern);
  });
}

// ---- N2: no release
test('release-note AC-11 row N2: a change with no note that changes a pack file and no version of its own is refused naming the pack', () => {
  const t = noteShip({ note: null, adr: false });
  put(t.root, { 'plugins/openspec/hooks/x.mjs': 'x\n' });
  commitAll(t.root, 'a pack file');
  tickAll(t);
  const n = relNext(t);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /^no release: plugins\/openspec\b/);
});

test('release-note AC-11 row N2: a change with no note and a bump of its own is not refused, the old rule is kept', () => {
  const t = noteShip({ note: null, adr: false });
  put(t.root, { 'plugins/openspec/hooks/x.mjs': 'x\n' });
  setVersion(t.root, REL_FILE, '1.0.1');
  commitAll(t.root, 'a pack file and its own bump');
  tickAll(t);
  assert.doesNotMatch(relNext(t).reason ?? '', /^no release:/);
  assert.equal(collectState(t.root, 'feat', { env: t.env }).release.applies, true);
});

test('release-note AC-11 row N2: an unnumbered ADR listed with no note is refused naming its path', () => {
  const t = noteShip({ note: null });
  tickAll(t);
  const n = relNext(t);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /^no release: docs\/adr\/feat\.md\b/);
});

test('release-note AC-11 row N2: a note of packs: [] is never refused for a pack file it leaves alone', () => {
  const t = noteShip({ note: 'packs: []\n', adr: false });
  put(t.root, { 'plugins/openspec/hooks/x.mjs': 'x\n' });
  commitAll(t.root, 'a pack file');
  tickAll(t);
  assert.equal(collectState(t.root, 'feat', { env: t.env }).release.state.kind, 'assigned', 'a note with nothing to write is assigned at once');
  assert.doesNotMatch(relNext(t).reason ?? '', /^no release:/);
});

// ---- N3: release lines edited by hand
test('release-note AC-2 row N3: a version edited by hand blocks the delivery naming the manifest', () => {
  const t = noteShip();
  setVersion(t.root, REL_FILE, '1.0.7');
  commitAll(t.root, 'a version by hand');
  tickAll(t);
  const n = relNext(t);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /^release lines edited by hand: plugins\/openspec\/\.claude-plugin\/plugin\.json$/);
});

test('release-note AC-2 row N3: a train project is refused for a hand edit too, the train rows follow otherwise', () => {
  const t = noteShip({ train: 'node -e 0' });
  setVersion(t.root, REL_FILE, '1.0.7');
  commitAll(t.root, 'a version by hand');
  tickAll(t);
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.match(nextStep({ ...s, train: { error: null, left: null, onTrain: null } }).reason, /^release lines edited by hand:/);
});

// ---- N4: an unlanded citation
test('release-note AC-7 row N4: a citation of an ADR the base has not numbered blocks the delivery naming the slug and the base', () => {
  const t = noteShip();
  put(t.root, { 'docs/y.md': 'This amends ADR [other].\n' });
  commitAll(t.root, 'cite another change');
  tickAll(t);
  const n = relNext(t);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /^ADR \[other\] is cited but has not landed on main/);
  const inTrain = nextStep({ ...collectState(t.root, 'feat', { env: t.env }), train: { error: null, left: null, onTrain: null } });
  assert.doesNotMatch(inTrain.reason ?? '', /has not landed/, 'the join refuses it in a train project, not the checker');
});

test('release-note AC-7 row N4: once the base numbers the cited ADR the checker no longer blocks it', () => {
  const t = noteShip();
  put(t.root, { 'docs/y.md': 'This amends ADR [other].\n' });
  commitAll(t.root, 'cite another change');
  relLand(t, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  tickAll(t);
  assert.deepEqual(collectState(t.root, 'feat', { env: t.env }).release.state.citations.unlanded, []);
  const n = relNext(t);
  assert.notEqual(n.step, 'blocked', n.reason);
});

// ---- N5, N6: the step stands where the update and the last step stood
const STEP_COMMAND = ['node', join(here, 'release-merge.mjs'), '--assign', '--base', 'main', '--json'];

test('release-note AC-4 row N6: assign-release comes last, before enable-auto-merge, and after the step\'s commit enable-auto-merge follows', () => {
  const t = noteReady();
  const n = relNext(t);
  assert.equal(n.step, 'assign-release');
  assert.deepEqual([n.number, n.base, n.branch], [12, 'main', 'ship/feat']);
  assert.deepEqual(n.command, STEP_COMMAND);
  assert.match(n.reason, /./);
  stepCommit(t.root);
  setPrHead(t);
  assert.equal(relNext(t).step, 'enable-auto-merge', 'the evidence and the reviews stayed current across the step\'s commit');
  const old = noteReady({ note: null, adr: false });
  assert.equal(relNext(old).step, 'enable-auto-merge', 'a change with no note is delivered as before');
});

test('release-note AC-4 row N6: with auto-merge on, a base that released another change gives assign-release, not wait-merge', () => {
  const t = noteReady();
  stepCommit(t.root);
  baseReleases(t.root, { 'src/other.ts': 'other\n' }, 'ship/feat');
  setPrHead(t, { autoMergeRequest: { enabledAt: '2026-11-24T10:00:00Z' }, mergeStateStatus: 'CLEAN' });
  const n = relNext(t);
  assert.equal(n.step, 'assign-release');
  const current = noteReady();
  stepCommit(current.root);
  setPrHead(current, { autoMergeRequest: { enabledAt: '2026-11-24T10:00:00Z' }, mergeStateStatus: 'CLEAN' });
  assert.equal(relNext(current).step, 'wait-merge', 'a current release waits for GitHub');
});

test('release-note AC-4 row N6: in ship mode pr the step comes before ready', () => {
  const t = noteReady({ ship: 'pr' });
  assert.equal(relNext(t).step, 'assign-release');
  stepCommit(t.root);
  setPrHead(t);
  assert.equal(relNext(t).step, 'ready');
});

test('release-note AC-4 row N6: a train project is never answered assign-release', () => {
  const t = noteReady();
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.equal(s.release.noted, true);
  const n = nextStep({ ...s, train: { error: null, left: null, onTrain: null } });
  assert.equal(n.step, 'boarded');
});

// Review round 1 (D-20): the base released what the step had written (the same versions, ADR 0002 for another record), and a person merged
// it by hand, taking the base's side of every release file; the step's commit carries its record.
test('release-note AC-4 row N6: a branch merged by hand after the step is handed assign-release, not refused', () => {
  const t = noteReady();
  stepCommit(t.root, { record: true });
  baseReleases(t.root, {
    ...releaseLayout({ openspec: '1.1.0', core: '1.0.1', market: '1.1.0', changelog: '# Changelog\n\n## 1.1.0 — other\n\n- **devkit-openspec**: other\n\n## 1.0.0 — first\n\n- **devkit-openspec**: start\n' }),
    'docs/adr/0002-other.md': '# ADR 0002: other\n',
    'src/other.ts': 'other\n',
  }, 'ship/feat');
  spawnSync('git', ['-C', t.root, 'merge', '--no-ff', '--no-commit', 'main'], { encoding: 'utf8', env: GIT_ENV });
  git(t.root, 'checkout', 'main', '--', ...Object.keys(releaseLayout()).filter((p) => !p.startsWith('docs/adr/')));
  commitAll(t.root, 'merge main by hand');
  setPrHead(t);
  const s = collectState(t.root, 'feat', { env: t.env });
  assert.deepEqual([s.release.state.kind, s.release.state.paths], ['unassigned', []]);
  const n = relNext(t);
  assert.equal(n.step, 'assign-release', n.reason);
  assert.deepEqual(n.command, STEP_COMMAND);
});

test('release-note AC-4 row N5: a branch behind the base is given assign-release in place of update-branch', () => {
  const t = noteReady();
  stepCommit(t.root);
  setPrHead(t, { mergeStateStatus: 'BEHIND' });
  const n = relNext(t);
  assert.equal(n.step, 'assign-release');
  assert.match(n.reason, /behind main/);
  assert.deepEqual(n.command, STEP_COMMAND);
  const old = noteReady({ note: null, adr: false });
  setPrHead(old, { mergeStateStatus: 'BEHIND' });
  assert.equal(relNext(old).step, 'update-branch', 'a change with no note is updated as before');
});

test('release-note AC-4 row N5: a pull request in conflict with the base is given assign-release in place of the conflict stop', () => {
  const t = noteReady();
  stepCommit(t.root);
  setPrHead(t, { mergeable: 'CONFLICTING' });
  assert.equal(relNext(t).step, 'assign-release');
  const old = noteReady({ note: null, adr: false });
  setPrHead(old, { mergeable: 'CONFLICTING' });
  const stop = relNext(old);
  assert.deepEqual([stop.step, stop.item, stop.conflict], ['blocked', 5, true]);
});

// ---- N7: no base to compute from
test('release-note AC-2 row N7: without origin/<base> the release is never judged and the reason names the fetch', () => {
  const t = noteShip({ origin: false });
  tickAll(t);
  const n = relNext(t);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /origin\/main/);
  assert.match(n.reason, /git fetch origin main/);
});

// ---- A1: the plan approval covers the note (D-9)
function approvedNote(tasks, { key = true, recorded = true } = {}) {
  const t = planRepo({ tasks });
  const dir = join(t.root, 'openspec', 'changes', 'feat');
  put(t.root, { 'openspec/config.yaml': `schema: devkit\nship:\n  devkit: pr\n${key ? REL_CONFIG : ''}`, 'openspec/changes/feat/release.md': NOTE_TEXT });
  const line = recorded ? `- Release note: ${DC.releaseNoteHash(dir)}\n` : '';
  put(t.root, { 'openspec/changes/feat/approval.md': approvalMd(readinessHash(t.root)).replace('- Date:', `${line}- Date:`) });
  commitAll(t.root, 'plan, note and approval');
  return t;
}
const CHANGED_NOTE = NOTE_TEXT.replace('minor', 'major');

test('release-note AC-12 row A1: a note changed after the approval asks the owner again, with no task ticked and with tasks ticked', () => {
  for (const tasks of ['## 1. First\n- [ ] 1.1 code\n', '## 1. First\n- [x] 1.1 code\n- [ ] 1.2 more\n']) {
    const t = approvedNote(tasks);
    assert.equal(t.state().approval.ok, true, 'the approval covers the note it recorded');
    assert.equal(nextStep(t.state()).step, 'implement', tasks);
    put(t.root, { 'openspec/changes/feat/release.md': CHANGED_NOTE });
    const n = nextStep(t.state());
    assert.equal(n.step, 'stop-plan-approval', tasks);
    assert.equal(n.reason, 'release note changed after approval');
    assert.equal(n.release, DC.releaseNoteHash(join(t.root, 'openspec', 'changes', 'feat')));
    assert.equal(n.readiness, readinessHash(t.root));
    assert.equal(n.file, 'openspec/changes/feat/approval.md');
  }
});

test('release-note AC-12 row A1: a note added after an approval that recorded none asks the owner again', () => {
  const t = approvedNote('## 1. First\n- [ ] 1.1 code\n', { recorded: false });
  const n = nextStep(t.state());
  assert.equal(n.step, 'stop-plan-approval');
  assert.equal(n.reason, 'release note changed after approval');
});

test('release-note AC-12 row A1: a change with no note keeps its approval object and its steps, with or without the key', () => {
  const t = planRepo({ approval: approvalMd });
  assert.deepEqual(Object.keys(approvalState(join(t.root, 'openspec', 'changes', 'feat'))), ['status', 'recorded', 'readiness', 'ok']);
  assert.deepEqual(Object.keys(approvalState(join(t.root, 'openspec', 'changes', 'feat'), { release: true })), ['status', 'recorded', 'readiness', 'ok'], 'no note and none recorded: no new key');
  assert.equal(nextStep(t.state()).step, 'implement');
  const noKey = approvedNote('## 1. First\n- [ ] 1.1 code\n', { key: false, recorded: false });
  assert.equal(nextStep(noKey.state()).step, 'implement', 'without devkit.release_tag a release.md is ignored');
  const keyed = approvedNote('## 1. First\n- [ ] 1.1 code\n');
  const keys = Object.keys(keyed.state().approval);
  assert.deepEqual(keys, ['status', 'recorded', 'readiness', 'release', 'recordedRelease', 'ok']);
});

// ---- the step's commit leaves the records current (D-5)
const provedNote = (over = {}) => {
  const root = noteRepo(over);
  ciProve(root, 'feat');
  return root;
};
const relFacts = (root) => gitFacts(root, { base: 'main' });
const recordsOf = (root) => {
  const f = relFacts(root);
  return { tasks: tasksItem(root, 'feat', f).details.evidence, acceptance: acceptanceItem(root, 'feat', f).details.evidence, reviews: reviewsItem(root, 'feat', f) };
};

test('release-note AC-4 staleness: the step\'s commit leaves the evidence and the approved reviews current', () => {
  const root = provedNote();
  assert.deepEqual([recordsOf(root).tasks, recordsOf(root).acceptance, recordsOf(root).reviews.status], ['current', 'current', 'met']);
  stepCommit(root);
  const after = recordsOf(root);
  assert.deepEqual([after.tasks, after.acceptance, after.reviews.status], ['current', 'current', 'met']);
});

test('release-note AC-5 staleness: a commit that numbers the ADR and also edits a sentence stales the records naming the file', () => {
  const root = provedNote();
  put(root, { 'docs/openspec-flow.md': flowPage('1.1.0').replace('Prose of the flow page.', 'A new sentence.') });
  stepCommit(root, { pin: false });
  const f = relFacts(root);
  assert.equal(tasksItem(root, 'feat', f).details.evidence, 'stale');
  assert.match(tasksItem(root, 'feat', f).reason, /touches docs\/openspec-flow\.md/);
  assert.equal(reviewsItem(root, 'feat', f).status, 'open');
});

test('release-note AC-5 staleness: a citation changed to another ADR\'s number stales the records, the masked text differs', () => {
  const root = provedNote();
  stepCommit(root);
  assert.equal(recordsOf(root).tasks, 'current', 'the step\'s own commit is a release edit');
  put(root, { 'docs/x.md': 'See ADR 0001 for the rule.\n' });
  commitAll(root, 'cite another record');
  assert.match(tasksItem(root, 'feat', relFacts(root)).reason, /touches docs\/x\.md/);
});

// Review round 1 (code-quality nit F4, D-18): a test file holds test data, not citations, so the ADR part of the release mask leaves it
// alone and a literal renumbered by hand is a plain edit.
test('release-note AC-4 staleness: a test literal renumbered by hand stales the evidence', () => {
  const root = provedNote({ extra: { 'plugins/a/hooks/x.test.mjs': "const p = 'docs/adr/feat.md';\n" } });
  stepCommit(root);
  assert.equal(recordsOf(root).tasks, 'current', 'the step\'s own commit is a release edit');
  put(root, { 'plugins/a/hooks/x.test.mjs': "const p = 'docs/adr/0002-feat.md';\n" });
  const literal = commitAll(root, 'renumber a test literal by hand');
  const item = tasksItem(root, 'feat', relFacts(root));
  assert.equal(item.details.evidence, 'stale');
  assert.match(item.reason, new RegExp(`${literal.slice(0, 7)}, which touches plugins/a/hooks/x\\.test\\.mjs`));
});

test('release-note AC-4 staleness: a rejected review stays stale across the step\'s commit, an approved one does not', () => {
  const root = provedNote();
  const R = git(root, 'rev-parse', 'HEAD');
  put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': review('rejected', R) });
  commitAll(root, 'a rejected review');
  stepCommit(root);
  const found = DC.readReviews(root, 'feat', relFacts(root));
  assert.equal(found.find((r) => r.name === 'code-quality-reviewer').why, null);
  assert.match(found.find((r) => r.name === 'test-coverage-reviewer').why, /touches/);
});

// The merge of jira-entry-followups (D-2): an approved verdict that still lists an undisposed finding follows the rejected verdict's
// rule, so the release edit of D-5 does not leave it current either; a refuted finding keeps the approved rule.
for (const [label, line, stale] of [
  ['an undisposed [important] finding', '- [important] x\n', true],
  ['a refuted finding', '- [important] x · refuted: the test shows it\n', false],
]) {
  test(`release-note AC-4 staleness: an approved review with ${label} is ${stale ? 'stale' : 'current'} across the step's commit`, () => {
    const root = provedNote();
    const R = git(root, 'rev-parse', 'HEAD');
    put(root, { 'openspec/changes/feat/reviews/test-coverage-reviewer.md': `${review('approved', R)}${line}` });
    commitAll(root, 'a finding in the record');
    stepCommit(root);
    const found = DC.readReviews(root, 'feat', relFacts(root));
    if (stale) assert.match(found.find((r) => r.name === 'test-coverage-reviewer').why, /touches/);
    else assert.equal(found.find((r) => r.name === 'test-coverage-reviewer').why, null);
    assert.equal(found.find((r) => r.name === 'code-quality-reviewer').why, null, 'the reviewer with no finding stays current');
  });
}

test('release-note AC-4 staleness: a change with no note is judged as before, the same commit stales its records', () => {
  const root = provedNote({ note: null, adr: false });
  assert.deepEqual(DC.releaseFacts(root, 'feat', relFacts(root)), { applies: true, noted: false, file: REL_FILE });
  stepCommit(root, { adr: false });
  assert.equal(recordsOf(root).tasks, 'stale');
  assert.equal(recordsOf(root).reviews.status, 'open');
});

// Found by the real-run proof (task 6.2, P-1): run again after the base numbered another record, the step's merge renumbers the change's
// own record (0002 to 0003) and its citations; that is a release edit too, and the old number reads as the change's own record.
test('release-note AC-4 staleness: the step run again after the base numbered another ADR renumbers the change\'s record and leaves the records current', () => {
  const root = provedNote();
  const step = () => spawnSync(STEP_COMMAND[0], STEP_COMMAND.slice(1), { cwd: root, encoding: 'utf8', env: { ...GIT_ENV, ...CI_ENV } });
  const first = step();
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.deepEqual([recordsOf(root).tasks, recordsOf(root).acceptance, recordsOf(root).reviews.status], ['current', 'current', 'met']);
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const again = step();
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.equal(readFileSync(join(root, 'docs/x.md'), 'utf8'), 'See ADR 0003 for the rule.\n');
  const after = recordsOf(root);
  assert.deepEqual([after.tasks, after.acceptance, after.reviews.status], ['current', 'current', 'met'], tasksItem(root, 'feat', relFacts(root)).reason);
});

test('release-note AC-5 staleness: a citation of the change\'s own record moved to another record\'s number on the base merge still stales', () => {
  const root = provedNote();
  stepCommit(root);
  baseReleases(root, { 'docs/adr/0003-other.md': '# ADR 0003: other\n' });
  git(root, 'merge', '-q', '--no-ff', '--no-commit', 'main');
  put(root, { 'docs/x.md': 'See ADR 0003 for the rule.\n' });
  commitAll(root, 'merge main and cite the base\'s record');
  assert.match(tasksItem(root, 'feat', relFacts(root)).reason, /touches docs\/x\.md/);
});

test('release-note AC-4 staleness: without the setting the same commit stales the records', () => {
  const root = provedNote({ config: 'schema: devkit-lite\n' });
  assert.deepEqual(DC.releaseFacts(root, 'feat', relFacts(root)), { applies: false });
  stepCommit(root);
  assert.equal(recordsOf(root).tasks, 'stale');
});
