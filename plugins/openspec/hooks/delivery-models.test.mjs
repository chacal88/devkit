// delivery-models: the delivery model is chosen per project (two-prs, trunk, trunk-auto).
// Tests of the settings reader, the model next to `ship:` and opening a change (design D-1, D-3, D-14).
// Every scenario runs on real Git in a temporary folder; the env blanks every branch variable, as a pull-request run on CI sets them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { git, put, commitAll, SET, TWO_PRS, BODY, REVIEWS, prove, scenario, ARCHIVED_FEAT, TEST_ARCHIVE, archiving, roundRepo } from './test-fixtures.mjs';
import * as guard from './guard.mjs';
import * as deliver from './deliver-check.mjs';
import { makeGh } from './merge-setup.mjs';
import { main, render, readDevkitSettings, MESSAGES, decide, exitCodeOf, unfinished } from './change-loop.mjs';
import { deliveryStep, actorOf } from './conduct-check.mjs';
import { collectFlow, reasonText } from './flow-check.mjs';

const cleanEnv = { ...process.env, ...SET };

function configRepo(text) {
  const root = tmpFolder('devkit-delivery-models-cfg-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  if (text !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), text);
  return root;
}

const { ShipConfigError, shipConfig } = deliver;
const parseDevkitBlock = (text) => guard.parseDevkitBlock(text);
const deliverySettings = (block) => guard.deliverySettings(block);
const readDeliverySettings = (root) => guard.readDeliverySettings(root);
const deliveryConfig = (root, schema) => deliver.deliveryConfig(root, schema);

const settingsOf = (text) => deliverySettings(parseDevkitBlock(text));

// ---------------------------------------------------------------- P1 deliverySettings

test('delivery-models config: no devkit block gives no model and no problem', () => {
  for (const text of ['', 'schema: devkit\n', 'devkit:\n', 'devkit:\n  driver: claude\n', 'devkit:\n  delivery:\n']) {
    assert.deepEqual(settingsOf(text), { model: null, base: null, testBranch: null, problems: [] }, JSON.stringify(text));
  }
});

test('delivery-models config: trunk is a model with no names', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: trunk\n'), { model: 'trunk', base: null, testBranch: null, problems: [] });
});

test('delivery-models config: trunk-auto is a model with no names', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: trunk-auto\n'), { model: 'trunk-auto', base: null, testBranch: null, problems: [] });
});

test('delivery-models config: two-prs with both names is that model with both names', () => {
  assert.deepEqual(settingsOf(TWO_PRS), { model: 'two-prs', base: 'main', testBranch: 'develop', problems: [] });
});

test('delivery-models config: an unknown model is a problem naming it', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: three-prs\n').problems, [{ kind: 'unknown', setting: 'delivery-model', value: 'three-prs' }]);
});

test('delivery-models config: two-prs without base is a missing delivery-base', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: two-prs\n    test_branch: develop\n').problems, [{ kind: 'missing', setting: 'delivery-base' }]);
});

test('delivery-models config: two-prs without test_branch is a missing delivery-test-branch', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: two-prs\n    base: main\n').problems, [{ kind: 'missing', setting: 'delivery-test-branch' }]);
});

test('delivery-models config: two-prs with the same name twice is an unknown delivery-test-branch', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: main\n').problems, [{ kind: 'unknown', setting: 'delivery-test-branch', value: 'main' }]);
});

test('delivery-models config: names under trunk are ignored', () => {
  const s = settingsOf('devkit:\n  delivery:\n    model: trunk\n    base: main\n    test_branch: main\n');
  assert.deepEqual(s, { model: 'trunk', base: null, testBranch: null, problems: [] });
});

test('delivery-models config: quoted values and trailing comments are read as the other settings are', () => {
  const s = settingsOf('devkit:   # the settings\n  delivery:   # how a change is delivered\n    model: "two-prs"   # two pull requests\n    base: \'master\'  # default branch\n    test_branch: develop # QA\n');
  assert.deepEqual(s, { model: 'two-prs', base: 'master', testBranch: 'develop', problems: [] });
});

test('delivery-models config: an empty value is unset', () => {
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model:\n').model, null);
  assert.deepEqual(settingsOf('devkit:\n  delivery:\n    model: two-prs\n    base:\n    test_branch: develop\n').problems, [{ kind: 'missing', setting: 'delivery-base' }]);
});

test('delivery-models config: nested keys never set driver or language', () => {
  const block = parseDevkitBlock('devkit:\n  delivery:\n    model: trunk\n    driver: robot\n    language: fr\n  driver: script\n  language: en-GB\n');
  assert.equal(block.driver, 'script');
  assert.equal(block.language, 'en-GB');
  assert.equal(parseDevkitBlock('devkit:\n  delivery:\n    driver: robot\n').driver, undefined);
});

// Invariant: a CRLF config gives the block its LF twin gives. Layer: guard parseDevkitBlock. Suite: delivery-models.
test('delivery-models config: a CRLF block is read as its LF twin', () => {
  const lf = 'schema: devkit\ndevkit:\n  language: en\n  driver: claude\n  release_tag: package.json\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\nship:\n  devkit: pr\n';
  const crlf = parseDevkitBlock(lf.replace(/\n/g, '\r\n'));
  assert.deepEqual(crlf, parseDevkitBlock(lf));
  assert.deepEqual([crlf.language, crlf.driver, crlf.release_tag, crlf.delivery.model], ['en', 'claude', 'package.json', 'two-prs']);
});

test('delivery-models config: the block keeps the budget at its own level, never one nested under delivery', () => {
  assert.equal(parseDevkitBlock('devkit:\n  budget: 500000\n  delivery:\n    model: trunk\n').budget, '500000');
  assert.equal(parseDevkitBlock('devkit:\n  delivery:\n    budget: 7\n').budget, undefined);
});

test('delivery-models config: readDeliverySettings reads the file and answers no model without one', () => {
  assert.equal(readDeliverySettings(configRepo(TWO_PRS)).model, 'two-prs');
  assert.deepEqual(readDeliverySettings(configRepo(null)), { model: null, base: null, testBranch: null, problems: [] });
});

// ---------------------------------------------------------------- P2 deliveryConfig

const deliveryOf = (config, schema = 'devkit') => deliveryConfig(configRepo(config), schema);

test('delivery-models config: no model gives the ship entry of the schema, as shipConfig does', () => {
  for (const mode of ['plan', 'pr', 'merge']) {
    const text = `schema: devkit\nship:\n  devkit: ${mode}\n`;
    const d = deliveryOf(text);
    assert.deepEqual([d.model, d.ship, d.mergeMethod], [null, mode, 'squash'], mode);
    assert.equal(d.ship, shipConfig(configRepo(text), 'devkit').ship);
  }
  assert.equal(deliveryOf('schema: devkit\n').ship, 'plan');
});

test('delivery-models config: trunk alone is pr', () => {
  const d = deliveryOf('devkit:\n  delivery:\n    model: trunk\n');
  assert.deepEqual([d.model, d.ship], ['trunk', 'pr']);
});

test('delivery-models config: trunk-auto alone is merge', () => {
  const d = deliveryOf('devkit:\n  delivery:\n    model: trunk-auto\n');
  assert.deepEqual([d.model, d.ship], ['trunk-auto', 'merge']);
});

test('delivery-models config: two-prs alone is pr, with the model and both names', () => {
  const d = deliveryOf(TWO_PRS);
  assert.deepEqual([d.model, d.ship, d.base, d.testBranch], ['two-prs', 'pr', 'main', 'develop']);
});

test('delivery-models config: trunk with a ship entry of pr agrees', () => {
  assert.equal(deliveryOf('devkit:\n  delivery:\n    model: trunk\nship:\n  devkit: pr\n').ship, 'pr');
});

test('delivery-models config: trunk-auto with a ship entry of merge agrees', () => {
  assert.equal(deliveryOf('devkit:\n  delivery:\n    model: trunk-auto\nship:\n  devkit: merge\n').ship, 'merge');
});

test('delivery-models config: trunk with a ship entry of merge disagrees', () => {
  assert.throws(() => deliveryOf('devkit:\n  delivery:\n    model: trunk\nship:\n  devkit: merge\n'), (e) => e instanceof ShipConfigError && /ship\.devkit/.test(e.message) && /merge/.test(e.message) && /trunk/.test(e.message));
});

test('delivery-models config: trunk-auto with a ship entry of pr disagrees', () => {
  assert.throws(() => deliveryOf('devkit:\n  delivery:\n    model: trunk-auto\nship:\n  devkit: pr\n'), (e) => e instanceof ShipConfigError && /ship\.devkit/.test(e.message) && /pr/.test(e.message) && /trunk-auto/.test(e.message));
});

test('delivery-models config: two-prs with any ship entry disagrees', () => {
  for (const mode of ['plan', 'pr', 'merge']) {
    assert.throws(() => deliveryOf(`${TWO_PRS}ship:\n  devkit: ${mode}\n`), (e) => e instanceof ShipConfigError && /ship\.devkit/.test(e.message) && /two-prs/.test(e.message), mode);
  }
});

test('delivery-models config: a ship entry of plan disagrees with trunk and trunk-auto', () => {
  for (const model of ['trunk', 'trunk-auto']) {
    assert.throws(() => deliveryOf(`devkit:\n  delivery:\n    model: ${model}\nship:\n  devkit: plan\n`), ShipConfigError, model);
  }
});

test('delivery-models config: a settings problem is a ShipConfigError', () => {
  assert.throws(() => deliveryOf('devkit:\n  delivery:\n    model: three-prs\n'), (e) => e instanceof ShipConfigError && /three-prs/.test(e.message));
  assert.throws(() => deliveryOf('devkit:\n  delivery:\n    model: two-prs\n    base: main\n'), (e) => e instanceof ShipConfigError && /test.branch/.test(e.message));
});

test('delivery-models config: merge_method is still validated and read', () => {
  assert.equal(deliveryOf('devkit:\n  delivery:\n    model: trunk-auto\nmerge_method: rebase\n').mergeMethod, 'rebase');
  assert.throws(() => deliveryOf('devkit:\n  delivery:\n    model: trunk\nmerge_method: fast\n'), ShipConfigError);
});

// ---------------------------------------------------------------- P10 opening and the setting replies

const body = (r) => JSON.parse(r.stdout);
const openRun = (cwd, id, { lang = 'en' } = {}) => main(['open', id, '--script', 'devkit', '--why', 'doubt', '--lang', lang], { cwd, env: cleanEnv, stdin: 'Add a thing\n' });
const startRun = (cwd, text, { lang = 'en' } = {}) => main(['start', '--lang', lang], { cwd, env: cleanEnv, stdin: text });
const project = (config) => roundRepo({ roadmap: '# Roadmap\n', config: `schema: devkit\n${config}` });
const withTestBranch = (t, name = 'develop') => { git(t.main, 'push', '-q', 'origin', `HEAD:refs/heads/${name}`); return t; };
const worktreeOf = (t, id) => join(t.main, '.claude', 'worktrees', id);

test('delivery-models open: a two-prs change starts from origin/<base>', () => {
  const t = withTestBranch(project(TWO_PRS));
  const r = openRun(t.main, 'add-export');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const b = JSON.parse(r.stdout.split('\n').slice(1).join('\n'));
  assert.deepEqual([b.branch, b.base], ['add-export', 'origin/main']);
  assert.equal(git(worktreeOf(t, 'add-export'), 'rev-parse', 'HEAD^'), git(t.main, 'rev-parse', 'origin/main'), 'the new HEAD\'s parent is origin/main: the claim commit sits on the base tip');
  assert.equal(spawnSync('git', ['-C', worktreeOf(t, 'add-export'), 'merge-base', '--is-ancestor', 'origin/main', 'HEAD']).status, 0, 'origin/main is an ancestor of HEAD');
});

test('delivery-models open: a missing test branch on the remote creates nothing', () => {
  const t = project(TWO_PRS);
  const r = openRun(t.main, 'add-export');
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, render('en', 'test-branch-missing', { branch: 'develop' }));
  assert.equal(existsSync(worktreeOf(t, 'add-export')), false);
  assert.equal(git(t.main, 'branch', '--list', 'add-export'), '');
});

test('delivery-models open: a base that is not the default branch creates nothing', () => {
  const t = withTestBranch(project('devkit:\n  delivery:\n    model: two-prs\n    base: master\n    test_branch: develop\n'));
  const r = openRun(t.main, 'add-export');
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, render('en', 'base-not-default', { base: 'master', default: 'main' }));
  assert.equal(existsSync(worktreeOf(t, 'add-export')), false);
});

test('delivery-models open: an id ending in the test branch name creates nothing', () => {
  const t = withTestBranch(project(TWO_PRS));
  const r = openRun(t.main, 'add-export-develop');
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, render('en', 'name-test-suffix', { id: 'add-export-develop', branch: 'develop' }));
  assert.equal(existsSync(worktreeOf(t, 'add-export-develop')), false);
});

test('delivery-models open: an id ending in another word is fine in two-prs', () => {
  const t = withTestBranch(project(TWO_PRS));
  assert.equal(openRun(t.main, 'add-develop-tools').code, 0);
});

test('delivery-models open: a repository with no remote is not checked and starts from HEAD', () => {
  const t = project(TWO_PRS);
  git(t.main, 'remote', 'remove', 'origin');
  const r = openRun(t.main, 'add-export');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout.split('\n').slice(1).join('\n')).base, 'HEAD');
});

test('delivery-models open: a trunk project opens as today, with no test branch needed', () => {
  const t = project('devkit:\n  delivery:\n    model: trunk\n');
  const r = openRun(t.main, 'add-export-develop');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout.split('\n').slice(1).join('\n')).base, 'origin/main');
});

test('delivery-models open: a two-prs project without base or test_branch is refused as missing, in both ways in', () => {
  for (const [block, setting] of [['model: two-prs\n    test_branch: develop', 'delivery-base'], ['model: two-prs\n    base: main', 'delivery-test-branch']]) {
    const t = project(`devkit:\n  delivery:\n    ${block}\n`);
    const reply = render('en', 'setting-missing', { setting });
    const s = body(startRun(t.main, 'change add an export'));
    assert.deepEqual([s.mode, s.reply], ['setting-missing', reply], setting);
    const o = openRun(t.main, 'add-export');
    assert.equal(o.code, 3, setting);
    assert.equal(body(o).reply, reply, setting);
    assert.equal(existsSync(worktreeOf(t, 'add-export')), false);
  }
});

test('delivery-models open: an unknown model or a test branch equal to the base is refused as unknown', () => {
  const cases = [
    ['model: three-prs', 'delivery-model', 'three-prs'],
    ['model: two-prs\n    base: main\n    test_branch: main', 'delivery-test-branch', 'main'],
  ];
  for (const [block, setting, value] of cases) {
    const t = project(`devkit:\n  delivery:\n    ${block}\n`);
    const accepted = readDevkitSettings(t.main).unknown[0].accepted;
    const reply = render('en', 'setting-unknown', { setting, value, accepted });
    const s = body(startRun(t.main, 'change add an export'));
    assert.deepEqual([s.mode, s.reply], ['setting-unknown', reply], setting);
    assert.ok(reply.includes(value) && reply.includes(accepted));
    assert.equal(body(openRun(t.main, 'add-export')).reply, reply, setting);
  }
});

test('delivery-models open: the new replies exist in both languages and name no internal word', () => {
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['setting-missing', 'test-branch-missing', 'base-not-default', 'name-test-suffix', 'setting.delivery-model', 'setting.delivery-base', 'setting.delivery-test-branch']) {
      assert.ok(MESSAGES[lang][key], `${lang} ${key}`);
    }
  }
});

// ---------------------------------------------------------------- the scenario fixture: origin with main and develop, the main checkout, the task worktree

const CHECK = (name, bucket, link = `https://github.com/o/r/actions/runs/77/job/1`) => ({ name, state: bucket.toUpperCase(), bucket, link });

// ---------------------------------------------------------------- P7 nextStep in two-prs (pure): one test per row of D-4's table

const SHA = 'a'.repeat(40);
const itemOf = (id, name, details = {}, status = 'met') => ({ id, name, status, reason: `item ${id} ${status}`, details });
const TEST_PR = { number: 13, url: 'https://github.com/o/r/pull/13', state: 'OPEN', headRefName: 'feat', headRefOid: SHA, mergeable: 'MERGEABLE', mergedAt: null };

// The support branch and the resolution round, as supportState and resolutionState give them when there is no support branch.
const NO_SUPPORT = { branch: 'feat-develop', exists: false, worktree: null, path: '/w/feat-develop', merging: null, head: null, hasTask: false, hasTest: false, pushed: false };
const SUPPORT = { ...NO_SUPPORT, exists: true, worktree: '/w/feat-develop', head: 'b'.repeat(40), hasTask: true, hasTest: true, pushed: true };
const NO_RESOLUTION = { commits: [], newest: null, verdicts: [], missing: [], stale: [], rejected: [], undisposed: [], round: null, approved: true };
const OWN = [{ sha: 'c'.repeat(40), subject: 'Merge origin/develop into feat-develop', diff: 'git diff aaaaaaa ccccccc' }];
const PENDING = { ...NO_RESOLUTION, commits: OWN, newest: OWN[0].sha, missing: ['code-quality-reviewer', 'test-coverage-reviewer'], approved: false };
const verdictAt = (name, verdict, commit = OWN[0].sha) => ({ name, verdict, commit: { sha: commit, uncommitted: false } });
const OPEN_FINDING = { reviewer: 'code-quality-reviewer', excerpt: '[blocking] F1 src/a.ts:1 a line was lost' };

// A state at 8/8 in two-prs: the base pull request #12 open and clean, the test-branch pull request #13 open and green.
function twoState(over = {}, two = {}) {
  return {
    id: 'feat', schema: 'devkit-lite', ship: 'pr', mergeMethod: 'squash', branch: 'feat', branchOk: true, needsReadiness: false, readiness: null,
    phases: [], dirty: [], reviewMd: null, reviews: [], head: SHA,
    pr: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: SHA, mergeable: 'MERGEABLE' },
    items: [
      itemOf(1, 'tasks', { evidence: 'current', missingGates: [] }),
      itemOf(2, 'reviews', { missing: [], stale: [] }),
      itemOf(3, 'findings', { undisposed: [] }),
      itemOf(4, 'acceptance', { defects: [], ids: ['AC-1'], evidence: 'current', missing: [], noProof: [] }),
      itemOf(5, 'pr', { none: false, ahead: false, uncommitted: [] }),
      itemOf(6, 'checks', { required: true, failing: [], pending: [] }),
      itemOf(7, 'conversation', { threads: [], comments: [], changesRequested: [] }),
      itemOf(8, 'body', { missing: [] }),
    ],
    twoPrs: {
      base: 'main', testBranch: 'develop', defaultBranch: 'main', defaultOk: true, defaultError: null,
      test: { pr: TEST_PR, checks: itemOf(6, 'checks', { failing: [], pending: [] }), body: itemOf(8, 'body', { missing: [] }) },
      rerun: null, root: '/w/feat', support: NO_SUPPORT, resolution: NO_RESOLUTION,
      ...two,
    },
    ...over,
  };
}
const withItemOf = (s, n, status, details = {}) => ({ ...s, items: s.items.map((i) => (i.id === n ? { ...i, status, details: { ...i.details, ...details } } : i)) });
const mergedTest = { pr: { ...TEST_PR, state: 'MERGED', mergedAt: '2026-11-22T10:00:00Z' } };
const noBasePr = () => ({ ...withItemOf(twoState(), 5, 'open', { none: true }), pr: null });

test('delivery-models P7 T0: a base branch that is not the default branch blocks and names both', () => {
  const n = deliver.nextStep(twoState({}, { defaultOk: false, defaultBranch: 'develop' }));
  assert.deepEqual([n.step, n.reason], ['blocked', "the base branch main is not the repository's default branch develop"]);
});

test('delivery-models P7 T0: an unreadable default branch blocks and says so', () => {
  const n = deliver.nextStep(twoState({}, { defaultOk: false, defaultBranch: null, defaultError: 'HTTP 502' }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'cannot read the default branch on GitHub: HTTP 502']);
});

test('delivery-models P7 T2: no base pull request and no test-branch pull request opens both', () => {
  const n = deliver.nextStep({ ...noBasePr(), twoPrs: { ...twoState().twoPrs, test: { none: true } } });
  assert.deepEqual([n.step, n.branch, n.base, n.testBranch], ['open-prs', 'feat', 'main', 'develop']);
});

test('delivery-models P7 T3: no base pull request while the test-branch one exists opens the base one only', () => {
  const n = deliver.nextStep(noBasePr());
  assert.deepEqual([n.step, n.base], ['open-pr', 'main']);
});

test('delivery-models P7 T4: no test-branch pull request opens it from the task branch', () => {
  const n = deliver.nextStep(twoState({}, { test: { none: true } }));
  assert.deepEqual([n.step, n.head, n.base], ['open-test-pr', 'feat', 'develop']);
});

test('delivery-models P7 T5: a test-branch pull request closed without merging blocks', () => {
  const n = deliver.nextStep(twoState({}, { test: { pr: { ...TEST_PR, state: 'CLOSED' } } }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'pull request #13 to develop was closed without merging']);
});

// Invariant (spec "The two-pull-request delivery stops where it cannot go on by itself", design D-4): a blocked row opens, pushes
// and edits nothing, so the closed test-branch pull request blocks before any row about the base branch's pull request.
const CLOSED_TEST = { pr: { ...TEST_PR, state: 'CLOSED' } };
const CLOSED_REASON = 'pull request #13 to develop was closed without merging';

test('delivery-models P7 T5: a closed test-branch pull request blocks before opening the missing base pull request', () => {
  const n = deliver.nextStep({ ...noBasePr(), twoPrs: { ...twoState().twoPrs, test: CLOSED_TEST } });
  assert.deepEqual([n.step, n.reason], ['blocked', CLOSED_REASON]);
});

test('delivery-models P7 T5: a closed test-branch pull request blocks before pushing an unpushed base branch', () => {
  const n = deliver.nextStep(withItemOf(twoState({}, { test: CLOSED_TEST }), 5, 'open', { ahead: true }));
  assert.deepEqual([n.step, n.reason], ['blocked', CLOSED_REASON]);
});

test('delivery-models P7 T5: a closed test-branch pull request blocks before editing an incomplete base pull request body', () => {
  const n = deliver.nextStep(withItemOf(twoState({}, { test: CLOSED_TEST }), 8, 'open', { missing: ['evidence link'] }));
  assert.deepEqual([n.step, n.reason], ['blocked', CLOSED_REASON]);
});

test('delivery-models P7 T5: an unreadable test-branch pull request blocks', () => {
  const n = deliver.nextStep(twoState({}, { test: { error: 'HTTP 502' } }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'cannot read the pull requests to develop: HTTP 502']);
});

test('delivery-models P7 T13: a test-branch pull request body that lacks something is edited', () => {
  const n = deliver.nextStep(twoState({}, { test: { ...twoState().twoPrs.test, body: itemOf(8, 'body', { missing: ['AC-1'] }, 'open') } }));
  assert.deepEqual([n.step, n.number, n.missing], ['edit-pr-body', 13, ['AC-1']]);
});

test('delivery-models P7 T14: failing checks on the test-branch pull request are fixed', () => {
  const failing = [{ name: 'build', link: 'https://ci/build' }];
  const n = deliver.nextStep(twoState({}, { test: { ...twoState().twoPrs.test, checks: itemOf(6, 'checks', { failing, pending: [] }, 'open') } }));
  assert.deepEqual([n.step, n.number, n.failing], ['fix-checks', 13, failing]);
});

test('delivery-models P7 T14: unreadable checks on the test-branch pull request block', () => {
  const n = deliver.nextStep(twoState({}, { test: { ...twoState().twoPrs.test, checks: itemOf(6, 'checks', { failing: [], pending: [] }, 'blocked') } }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'item 6 blocked']);
});

test('delivery-models P7 T15: pending checks on the test-branch pull request wait', () => {
  const n = deliver.nextStep(twoState({}, { test: { ...twoState().twoPrs.test, checks: itemOf(6, 'checks', { failing: [], pending: ['build'] }, 'open') } }));
  assert.deepEqual([n.step, n.number, n.pending], ['wait-checks', 13, ['build']]);
});

test('delivery-models P7 T16: a green test-branch pull request is the owner\'s to merge, first', () => {
  const n = deliver.nextStep(twoState());
  assert.deepEqual([n.step, n.number, n.branch, n.base, n.baseNumber], ['ready-test-branch', 13, 'develop', 'main', 12]);
});

test('delivery-models P7 T17: a base check that failed before the test-branch merge is run again', () => {
  const failing = [{ name: 'devkit-reviews', link: 'https://github.com/o/r/actions/runs/77/job/1' }];
  const s = withItemOf(twoState({}, { test: mergedTest, rerun: { runs: ['77'] } }), 6, 'open', { failing });
  const n = deliver.nextStep(s);
  assert.deepEqual([n.step, n.number, n.runs], ['rerun-checks', 12, ['77']]);
});

test('delivery-models P7 T17: a base check that failed after the test-branch merge is the existing blocked row', () => {
  const failing = [{ name: 'devkit-reviews', link: 'https://github.com/o/r/actions/runs/77/job/1' }];
  const n = deliver.nextStep(withItemOf(twoState({}, { test: mergedTest, rerun: null }), 6, 'open', { failing }));
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /devkit-reviews fails in CI while items 1-4 are met locally/);
});

test('delivery-models P7 T18: with the test-branch pull request merged and everything met the base one is the owner\'s', () => {
  const n = deliver.nextStep(twoState({}, { test: mergedTest }));
  assert.deepEqual([n.step, n.number, n.base], ['ready-base', 12, 'main']);
});

test('delivery-models P7 T18: after the test-branch merge the base checks are still read (existing rows)', () => {
  const failing = [{ name: 'build', link: 'https://ci/build' }];
  const n = deliver.nextStep(withItemOf(twoState({}, { test: mergedTest }), 6, 'open', { failing }));
  assert.deepEqual([n.step, n.failing], ['fix-checks', failing]);
  assert.equal(deliver.nextStep(withItemOf(twoState({}, { test: mergedTest }), 6, 'open', { pending: ['build'] })).step, 'wait-checks');
});

test('delivery-models P7: ready and the merge rows are never returned in two-prs', () => {
  const states = [twoState(), twoState({}, { test: mergedTest }), twoState({}, { test: { none: true } }), noBasePr(),
    twoState({ pr: { number: 12, url: 'u', state: 'OPEN', headRefOid: SHA, autoMerge: true, mergeStateStatus: 'BEHIND' } }, { test: mergedTest })];
  for (const s of states) {
    const step = deliver.nextStep(s).step;
    assert.ok(!['ready', 'enable-auto-merge', 'disable-auto-merge', 'update-branch', 'wait-merge'].includes(step), step);
  }
});

test('delivery-models P7: a project outside two-prs keeps its rows (ready, no two-prs step)', () => {
  const s = twoState();
  delete s.twoPrs;
  assert.equal(deliver.nextStep(s).step, 'ready');
});

// ---- rows T6 to T12: the support branch and its resolution round (D-4, D-8)

const withTwo = (two) => twoState({}, two);
// The test-branch pull request once it is from the support branch (after the move), green.
const FROM_SUPPORT = () => ({ ...twoState().twoPrs.test, pr: { ...TEST_PR, headRefName: 'feat-develop' } });

test('delivery-models P7 T4: with a pushed support branch the test-branch pull request opens from it', () => {
  const n = deliver.nextStep(withTwo({ test: { none: true }, support: SUPPORT }));
  assert.deepEqual([n.step, n.head, n.base], ['open-test-pr', 'feat-develop', 'develop']);
  assert.equal(deliver.nextStep(withTwo({ test: { none: true }, support: { ...SUPPORT, pushed: false } })).head, 'feat', 'neg: an unpushed support branch is not a head');
});

test('delivery-models P7 T6: a merge left in the support worktree is resolved there, naming the paths', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, merging: ['src/a.ts', 'src/b.ts'] } }));
  assert.deepEqual([n.step, n.root, n.branch, n.paths], ['resolve-support-conflict', '/w/feat-develop', 'feat-develop', ['src/a.ts', 'src/b.ts']]);
  assert.equal(deliver.nextStep(withTwo({ support: { ...SUPPORT, merging: null }, test: FROM_SUPPORT() })).step, 'ready-test-branch', 'neg: no merge in progress');
});

test('delivery-models P7 T6: a merge in progress with every conflict staged still goes to the resolver, with no path left', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, merging: [] } }));
  assert.deepEqual([n.step, n.paths], ['resolve-support-conflict', []]);
});

test('delivery-models P7 T7: a support branch with no worktree is checked out', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, worktree: null } }));
  assert.deepEqual([n.step, n.path, n.branch], ['checkout-support', '/w/feat-develop', 'feat-develop']);
  assert.equal(deliver.nextStep(withTwo({ test: mergedTest, support: { ...SUPPORT, worktree: null } })).step, 'ready-base', 'neg: T6 to T16 run only while the test pull request is not merged');
});

test('delivery-models P7 T8: a resolution with no verdict yet is reviewed, in the task worktree, naming the commit and the diffs', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, pushed: false }, resolution: PENDING }));
  assert.equal(n.step, 'review-resolution');
  assert.deepEqual([n.root, n.support, n.commit, n.round], ['/w/feat', 'feat-develop', OWN[0].sha, 1]);
  assert.deepEqual(n.commits, [{ sha: OWN[0].sha, subject: OWN[0].subject }]);
  assert.deepEqual(n.diffs, ['git diff aaaaaaa ccccccc']);
});

test('delivery-models P7 T8: a verdict at an older commit is reviewed again, and round 2 follows a rejected round 1', () => {
  const stale = { ...PENDING, missing: [], stale: ['code-quality-reviewer'], verdicts: [verdictAt('code-quality-reviewer', 'REJECTED', 'd'.repeat(40)), verdictAt('test-coverage-reviewer', 'APPROVED')], round: { consensus: 'FAIL', round: 1 } };
  const n = deliver.nextStep(withTwo({ support: SUPPORT, resolution: stale }));
  assert.deepEqual([n.step, n.round], ['review-resolution', 2]);
  const passed = { ...stale, verdicts: [verdictAt('code-quality-reviewer', 'APPROVED', 'd'.repeat(40)), verdictAt('test-coverage-reviewer', 'APPROVED')], round: { consensus: 'PASS', round: 1 } };
  assert.equal(deliver.nextStep(withTwo({ support: SUPPORT, resolution: passed })).round, 1, 'neg: a stale approval starts a round 1');
});

test('delivery-models P7 T8: a rejection at the newest commit is fixed on the support branch, with its findings', () => {
  const rejected = { ...PENDING, missing: [], rejected: ['code-quality-reviewer'], verdicts: [verdictAt('code-quality-reviewer', 'REJECTED'), verdictAt('test-coverage-reviewer', 'APPROVED')], undisposed: [OPEN_FINDING], round: { consensus: 'FAIL', round: 1 } };
  const n = deliver.nextStep(withTwo({ support: SUPPORT, resolution: rejected }));
  assert.deepEqual([n.step, n.root, n.branch, n.findings], ['fix-resolution', '/w/feat-develop', 'feat-develop', [OPEN_FINDING]]);
});

test('delivery-models P7 T8: an approval that still lists an undisposed finding is fixed, not reviewed again', () => {
  const open = { ...PENDING, missing: [], verdicts: [verdictAt('code-quality-reviewer', 'APPROVED'), verdictAt('test-coverage-reviewer', 'APPROVED')], undisposed: [OPEN_FINDING], round: { consensus: 'PASS', round: 1 } };
  const n = deliver.nextStep(withTwo({ support: SUPPORT, resolution: open }));
  assert.deepEqual([n.step, n.findings], ['fix-resolution', [OPEN_FINDING]]);
});

test('delivery-models P7 T8: a rejection after round 2 stops for the owner, naming the reviewers and the resolution', () => {
  const stuck = { ...PENDING, missing: [], rejected: ['code-quality-reviewer'], verdicts: [verdictAt('code-quality-reviewer', 'REJECTED'), verdictAt('test-coverage-reviewer', 'APPROVED')], undisposed: [OPEN_FINDING], round: { consensus: 'FAIL', round: 2 } };
  const n = deliver.nextStep(withTwo({ support: SUPPORT, resolution: stuck }));
  assert.deepEqual([n.step, n.reviewers, n.resolution], ['stop-review-deadlock', ['code-quality-reviewer'], true]);
});

test('delivery-models P7 T8: an approved resolution is not reviewed (neg), and a clean merge has no own commit', () => {
  const approved = { ...PENDING, missing: [], verdicts: [verdictAt('code-quality-reviewer', 'APPROVED'), verdictAt('test-coverage-reviewer', 'APPROVED')], approved: true, round: { consensus: 'PASS', round: 1 } };
  assert.equal(deliver.nextStep(withTwo({ support: SUPPORT, test: FROM_SUPPORT(), resolution: approved })).step, 'ready-test-branch');
  assert.equal(deliver.nextStep(withTwo({ support: SUPPORT, test: FROM_SUPPORT(), resolution: NO_RESOLUTION })).step, 'ready-test-branch');
});

test('delivery-models P7 T8: an unreviewed or blocked resolution is never pushed and the pull request never moves (the hold)', () => {
  const open = { support: { ...SUPPORT, pushed: false }, test: { ...twoState().twoPrs.test, pr: { ...TEST_PR, headRefName: 'feat' } } };
  for (const resolution of [PENDING, { ...PENDING, missing: [], rejected: ['test-coverage-reviewer'], verdicts: [verdictAt('code-quality-reviewer', 'APPROVED'), verdictAt('test-coverage-reviewer', 'REJECTED')], round: { consensus: 'FAIL', round: 2 } }]) {
    assert.ok(!['push-support', 'move-test-pr'].includes(deliver.nextStep(withTwo({ ...open, resolution })).step));
  }
});

test('delivery-models P7 T6: a merge in progress comes before the review of the resolution', () => {
  assert.equal(deliver.nextStep(withTwo({ support: { ...SUPPORT, merging: ['src/a.ts'] }, resolution: PENDING })).step, 'resolve-support-conflict');
});

test('delivery-models P7 T9: a support branch that lacks the task branch gets it merged in', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, hasTask: false } }));
  assert.deepEqual([n.step, n.root, n.branch, n.from, n.create], ['merge-into-support', '/w/feat-develop', 'feat-develop', 'feat', undefined]);
});

test('delivery-models P7 T10: a pull request with a conflict with the test branch is merged into a new support branch', () => {
  const n = deliver.nextStep(withTwo({ test: { ...twoState().twoPrs.test, pr: { ...TEST_PR, mergeable: 'CONFLICTING' } } }));
  assert.deepEqual([n.step, n.root, n.branch, n.from, n.create], ['merge-into-support', '/w/feat-develop', 'feat-develop', 'origin/develop', true]);
});

test('delivery-models P7 T10: an existing support branch is merged into again, without create, only while it lacks the test branch', () => {
  const conflicting = { ...twoState().twoPrs.test, pr: { ...TEST_PR, mergeable: 'CONFLICTING' } };
  const again = deliver.nextStep(withTwo({ test: conflicting, support: { ...SUPPORT, hasTest: false } }));
  assert.deepEqual([again.step, again.from, again.create], ['merge-into-support', 'origin/develop', false]);
  const done = deliver.nextStep(withTwo({ test: conflicting, support: { ...SUPPORT, pushed: false } }));
  assert.equal(done.step, 'push-support', 'neg: a support branch that holds the test branch is pushed, not merged into again');
});

test('delivery-models P7 T10: a pull request already from the support branch that still conflicts is merged into again, even with a stale test-branch ref', () => {
  const fromSupport = { ...twoState().twoPrs.test, pr: { ...TEST_PR, headRefName: 'feat-develop', mergeable: 'CONFLICTING' } };
  const n = deliver.nextStep(withTwo({ test: fromSupport, support: SUPPORT }));
  assert.deepEqual([n.step, n.from, n.create], ['merge-into-support', 'origin/develop', false]);
});

test('delivery-models P7 T8: a resolution that cannot be read blocks with the reason', () => {
  const n = deliver.nextStep(withTwo({ support: SUPPORT, resolution: { ...NO_RESOLUTION, approved: false, error: 'cannot read the commits of refs/heads/feat-develop since refs/heads/feat' } }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'cannot read the commits of refs/heads/feat-develop since refs/heads/feat']);
});

test('delivery-models P7 T11: a support branch that is not pushed is pushed', () => {
  const n = deliver.nextStep(withTwo({ support: { ...SUPPORT, pushed: false } }));
  assert.deepEqual([n.step, n.root, n.branch], ['push-support', '/w/feat-develop', 'feat-develop']);
});

test('delivery-models P7 T12: a test-branch pull request still from the task branch moves to the support branch', () => {
  const n = deliver.nextStep(withTwo({ support: SUPPORT, test: { ...twoState().twoPrs.test, pr: { ...TEST_PR, headRefName: 'feat' } } }));
  assert.deepEqual([n.step, n.head, n.base, n.replaces], ['move-test-pr', 'feat-develop', 'develop', 13]);
  const from = deliver.nextStep(withTwo({ support: SUPPORT, test: { ...twoState().twoPrs.test, pr: { ...TEST_PR, headRefName: 'feat-develop' } } }));
  assert.equal(from.step, 'ready-test-branch', 'neg: already from the support branch');
});

test('delivery-models P7: with no support branch none of the support rows fires (neg)', () => {
  for (const s of [twoState(), twoState({}, { test: { none: true } })]) {
    assert.ok(!['resolve-support-conflict', 'checkout-support', 'review-resolution', 'fix-resolution', 'merge-into-support', 'push-support', 'move-test-pr'].includes(deliver.nextStep(s).step));
  }
});

// ---------------------------------------------------------------- fetchPr by base, P8 delivered

test('delivery-models fetchPr: with a base it lists by head and base and never asks pr view', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  const gh = s.sim.gh(s.wt);
  const got = deliver.fetchPr(gh, { branch: 'feat', base: 'main', list: true });
  assert.equal(got.pr.number, base);
  assert.equal(deliver.fetchPr(gh, { branch: 'feat', base: 'develop', list: true }).pr.number, test);
  assert.deepEqual(deliver.fetchPr(gh, { branch: 'feat', base: 'release', list: true }), { none: true });
  assert.equal(s.sim.calls().filter((c) => c[0] === 'pr' && c[1] === 'view').length, 0);
  assert.ok(s.sim.calls().some((c) => c.join(' ').includes('--head feat --base main')));
});

test('delivery-models fetchPr: with a base only the pull requests to that base are read, an open newer one to another base is not taken', () => {
  const s = scenario();
  const base = s.sim.create({ base: 'main', head: 'feat', body: BODY });
  s.sim.close(base);
  const test = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  const gh = s.sim.gh(s.wt);
  assert.equal(deliver.fetchPr(gh, { branch: 'feat', base: 'main', list: true }).pr.number, base, 'the closed one to main, not the open one to develop');
  assert.equal(deliver.fetchPr(gh, { branch: 'feat', base: 'develop', list: true }).pr.number, test);
});

test('delivery-models AC-9 delivered: a merged test-branch pull request alone does not deliver the change', () => {
  const s = scenario();
  const { test } = s.openBoth();
  s.sim.merge(test);
  const state = s.state();
  assert.equal(state.archive, undefined, 'no archive step before the base merge');
  assert.notEqual(s.next().step, 'retro');
  const located = deliver.locateChange(s.wt, 'feat');
  const delivery = deliver.deliveryOf(s.sim.gh(s.wt), s.wt, 'feat', { ship: 'pr', branch: 'feat', env: s.env, located, base: 'main' });
  assert.equal(delivery.delivered, false);
});

test('delivery-models AC-9 delivered: the merged-list path drops a pull request to the test branch', () => {
  const s = scenario();
  const { test, base } = s.openBoth();
  s.sim.merge(test);
  const gh = s.sim.gh(s.main);
  const from = (b) => deliver.deliveryOf(gh, s.main, 'feat', { ship: 'pr', branch: 'main', env: s.env, located: null, base: b });
  const dropped = from('main');
  assert.deepEqual([dropped.fetched.none, dropped.delivered], [true, false]);
  const kept = from(undefined);
  assert.equal(kept.fetched.pr?.number, test, 'without the base filter the test-branch pull request would be taken as the change\'s own');
  s.sim.merge(base);
  const done = from('main');
  assert.deepEqual([done.fetched.pr.number, done.fetched.via, done.delivered], [base, 'list', true]);
});

test('forced-merge-path 1: N11 two-prs: the base pull request merged with a task left and devkit-reviews FAILURE answers the retro, and the test-branch pull request is never read as forced', () => {
  const s = scenario();
  put(s.wt, { 'openspec/changes/feat/tasks.md': '# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n- [ ] 1.2 left after the merge\n' });
  commitAll(s.wt, 'a task left');
  git(s.wt, 'push', '-q', 'origin', 'feat');
  const { base, test } = s.openBoth();
  s.sim.setRules([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }]);
  const run = (name, conclusion) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion });
  s.sim.setRollup(base, [run('check', 'SUCCESS'), run('devkit-reviews', 'FAILURE')]);
  s.sim.setRollup(test, [run('check', 'FAILURE'), run('devkit-reviews', 'FAILURE')]);
  s.sim.merge(test);
  s.sim.merge(base);
  const n = s.next();
  assert.equal(n.step, 'retro', n.reason);
  assert.deepEqual([n.number, n.forced.number, n.forced.count], [base, base, 3]);
  assert.deepEqual(n.forced.items.map((i) => i.kind), ['task', 'check', 'gate']);
  assert.deepEqual(n.forced.items.slice(0, 2).map((i) => i.text), ['task 1.2', 'devkit-reviews (FAILURE)']);
  assert.match(n.reason, new RegExp(`^PR #${base} merged by the owner with 3 items open: task 1\\.2; devkit-reviews \\(FAILURE\\); `));
  assert.equal(s.sim.calls().some((c) => c[0] === 'pr' && c[1] === 'view' && c[2] === String(test)), false, 'the test-branch pull request is never read as forced');
  assert.equal(s.sim.writes().length, 2, 'only the two pull requests the scenario opened were written');
});

// ---------------------------------------------------------------- AC-2, AC-3, AC-8, AC-9

test('delivery-models AC-2: both pull requests open together from the task branch and the state names both', () => {
  const s = scenario();
  const first = s.next();
  assert.deepEqual([first.step, first.branch, first.base, first.testBranch], ['open-prs', 'feat', 'main', 'develop']);
  assert.equal(s.sim.writes().length, 0, 'deliver-check only reads');
  const { base, test } = s.openBoth();
  assert.deepEqual(s.sim.prs().map((p) => [p.base, p.head]), [['main', 'feat'], ['develop', 'feat']], 'both from the same branch');
  const report = s.report();
  assert.equal(report.model, 'two-prs');
  assert.equal(report.pr.number, base);
  assert.deepEqual([report.twoPrs.base, report.twoPrs.testBranch, report.twoPrs.testPr.number, report.twoPrs.testPr.state, report.twoPrs.testPr.head], ['main', 'develop', test, 'OPEN', 'feat']);
  assert.deepEqual([report.next.step, report.next.number], ['ready-test-branch', test]);
});

test('delivery-models AC-2: with only one of the two open, the missing one is opened next', () => {
  const s = scenario();
  const base = s.sim.create({ base: 'main', head: 'feat', body: BODY });
  const n = s.next();
  assert.deepEqual([n.step, n.head, n.base], ['open-test-pr', 'feat', 'develop']);
  s.sim.close(base);
  const t = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  assert.equal(s.sim.pr(base).state, 'CLOSED');
  assert.equal(s.sim.pr(t).state, 'OPEN');
});

test('delivery-models AC-2: a body that misses the evidence is edited on the test-branch pull request too', () => {
  const s = scenario();
  s.sim.create({ base: 'main', head: 'feat', body: BODY });
  const test = s.sim.create({ base: 'develop', head: 'feat', body: 'feat\n' });
  const n = s.next();
  assert.deepEqual([n.step, n.number], ['edit-pr-body', test]);
  assert.deepEqual(n.missing, ['AC-1', 'openspec/changes/feat/evidence.md']);
});

test('delivery-models AC-3: the owner merges the test-branch pull request first, then the base one; auto-merge is never enabled', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  const seen = [];
  const step = () => { const n = s.next(); seen.push(n.step); return n; };
  let n = step();
  assert.deepEqual([n.step, n.number, n.branch, n.base, n.baseNumber], ['ready-test-branch', test, 'develop', 'main', base]);

  // The owner merges the test-branch pull request; the base pull request's reviews check, red until now, started earlier.
  s.sim.setRun(77, { startedAt: '2000-01-01T00:00:00Z' });
  s.sim.setChecks(base, [CHECK('devkit-reviews', 'fail')]);
  s.sim.merge(test);
  n = step();
  assert.deepEqual([n.step, n.number, n.runs], ['rerun-checks', base, ['77']]);

  // The session runs the check again: it passes, and the base pull request is the owner's.
  s.sim.setChecks(base, [CHECK('devkit-reviews', 'pass')]);
  n = step();
  assert.deepEqual([n.step, n.number, n.base], ['ready-base', base, 'main']);

  // The owner merges it: the change is delivered and goes on to its retro.
  s.sim.merge(base);
  n = step();
  assert.equal(n.step, 'retro');
  assert.equal(s.sim.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge').length, 0, 'no gh pr merge');
  assert.ok(!seen.some((x) => ['enable-auto-merge', 'wait-merge', 'update-branch', 'ready'].includes(x)), seen.join(' '));
  assert.deepEqual(s.sim.writes().map((c) => c[1]), ['create', 'create'], 'only the two creates of the agent hook: deliver-check never writes and nothing merges by gh');
});

test('delivery-models AC-3: a base check that failed after the test-branch merge is not run again', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  s.sim.merge(test);
  s.sim.setRun(77, { startedAt: '2999-01-01T00:00:00Z' });
  s.sim.setChecks(base, [CHECK('devkit-reviews', 'fail')]);
  const n = s.next();
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /devkit-reviews fails in CI while items 1-4 are met locally/);
});

test('delivery-models AC-3: only run ids the failing check names are read, one gh run view each', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  s.sim.merge(test);
  s.sim.setRun(77, { startedAt: '2000-01-01T00:00:00Z' });
  s.sim.setChecks(base, [CHECK('build', 'fail', 'https://ci/build')]);
  assert.equal(s.next().step, 'fix-checks');
  assert.equal(s.sim.calls().filter((c) => c[0] === 'run').length, 0, 'no run read unless devkit-reviews failed');
});

test('delivery-models AC-8: a fix on the task branch reaches both pull requests, without a support branch', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  const { fix, proof } = s.fix('fixed\n');
  const n = s.next();
  assert.equal(n.step, 'push', n.reason);
  git(s.wt, 'push', '-q', 'origin', 'feat');
  for (const number of [base, test]) {
    const head = deliver.fetchPr(s.sim.gh(s.wt), { branch: 'feat', base: s.sim.pr(number).base, list: true }).pr.headRefOid;
    assert.equal(head, proof);
    assert.ok(s.ancestorOf(fix, head), `the fix is in the head of #${number}`);
  }
  assert.equal(s.next().step, 'ready-test-branch');
});

test('delivery-models AC-9 delivered: both merged with every task ticked is delivered and reads the archive', () => {
  const s = scenario();
  const { base, test } = s.openBoth();
  s.sim.merge(test);
  s.sim.merge(base);
  const state = s.state();
  assert.ok(state.archive, 'the post-merge facts are read');
  assert.equal(deliver.nextStep(state).step, 'retro');
});

test('delivery-models P7 T0: a base branch that is not GitHub\'s default stops the run and writes nothing', () => {
  const s = scenario();
  s.sim.setDefaultBranch('develop');
  const n = s.next();
  assert.deepEqual([n.step, n.reason], ['blocked', "the base branch main is not the repository's default branch develop"]);
  assert.equal(s.sim.writes().length, 0);
});

test('delivery-models P7 T5: a closed test-branch pull request stops the run and writes nothing more', () => {
  const s = scenario();
  const { test } = s.openBoth();
  s.sim.close(test);
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.reason], ['blocked', `pull request #${test} to develop was closed without merging`]);
  assert.equal(s.sim.writes().length, before, 'no create, close or merge after the blocked answer');
});

test('delivery-models P7: a test-branch pull request from the task branch is found, an open one before a merged one', () => {
  const s = scenario();
  const first = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  const found = (opts = {}) => deliver.findTestPr(s.sim.gh(s.wt), { id: 'feat', testBranch: 'develop', ...opts });
  assert.equal(found().pr.number, first);
  s.sim.merge(first);
  assert.deepEqual([found().pr.number, found().pr.state], [first, 'MERGED']);
  const again = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  assert.equal(found().pr.number, again, 'an open one wins over the merged one');
  assert.ok(found().checks && found().body, 'an open one carries its checks and body items');
  s.sim.close(again);
  assert.equal(found().pr.number, first, 'a merged one wins over a closed one');
});

test('delivery-models P7: findTestPr answers none, and an error when GitHub cannot be read', () => {
  const s = scenario();
  assert.deepEqual(deliver.findTestPr(s.sim.gh(s.wt), { id: 'feat', testBranch: 'develop' }), { none: true });
  const broken = deliver.findTestPr(makeGh(s.wt, { ...process.env, PATH: '/nonexistent' }), { id: 'feat', testBranch: 'develop' });
  assert.ok(broken.error, 'gh missing');
});

// ---------------------------------------------------------------- P12 the flow readout in two-prs

test('delivery-models P12: readDelivery asks for the test-branch pull request, then for the owner\'s merges', () => {
  const s = scenario();
  const open = { openspec: () => ({ status: 0, stdout: JSON.stringify({ artifacts: [], tasks: [] }), stderr: '' }) };
  const delivery = () => collectFlow(s.wt, 'feat', { env: s.env, gh: s.sim.gh(s.wt), ...open }).facts.delivery();
  const base = s.sim.create({ base: 'main', head: 'feat', body: BODY });
  assert.deepEqual(delivery(), { next: { stage: 'delivery', reasonCode: 'no-test-pr', params: {} } });
  const test = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  assert.deepEqual(delivery(), { end: { state: 'waiting-for-owner', reasonCode: 'owner-merges-test-branch', params: { number: test, branch: 'develop', base: 'main' } } });
  s.sim.setChecks(test, [CHECK('build', 'pending')]);
  assert.deepEqual(delivery().end.reasonCode, 'checks-pending');
  s.sim.setChecks(test, [CHECK('build', 'fail')]);
  assert.equal(delivery().next.reasonCode, 'check-failing');
  s.sim.setChecks(test, []);
  s.sim.merge(test);
  s.sim.setChecks(base, [CHECK('devkit-reviews', 'pass')]);
  assert.deepEqual(delivery(), { end: { state: 'waiting-for-owner', reasonCode: 'owner-merges-base', params: { number: base, base: 'main' } } });
  s.sim.setChecks(base, [CHECK('build', 'fail')]);
  assert.equal(delivery().next.reasonCode, 'check-failing', 'after the test-branch merge the base checks count');
});

test('delivery-models P12: a closed test-branch pull request ends blocked', () => {
  const s = scenario();
  s.sim.create({ base: 'main', head: 'feat', body: BODY });
  const test = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  s.sim.close(test);
  const open = { openspec: () => ({ status: 0, stdout: JSON.stringify({ artifacts: [], tasks: [] }), stderr: '' }) };
  const got = collectFlow(s.wt, 'feat', { env: s.env, gh: s.sim.gh(s.wt), ...open }).facts.delivery();
  assert.deepEqual(got, { end: { state: 'blocked', reasonCode: 'pr-closed', params: { number: test } } });
});

test('delivery-models P12: the three new codes read in both languages', () => {
  const params = { 'no-test-pr': {}, 'owner-merges-test-branch': { number: 13, branch: 'develop', base: 'main' }, 'owner-merges-base': { number: 12, base: 'main' } };
  for (const [code, p] of Object.entries(params)) {
    const said = ['en', 'pt-BR'].map((lang) => reasonText(lang, code, p, {}));
    for (const text of said) assert.ok(text && !/undefined|NaN|\[object/.test(text), `${code}: ${text}`);
    assert.notEqual(said[0], said[1], `${code} is translated`);
  }
  assert.match(reasonText('en', 'owner-merges-test-branch', params['owner-merges-test-branch'], {}), /#13.*develop/);
  assert.match(reasonText('en', 'owner-merges-base', params['owner-merges-base'], {}), /#12.*main/);
});

// ---------------------------------------------------------------- P10 the loop's rows, owner ends and brief; P13 the conductor's actors

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOW = JSON.parse(readFileSync(join(HERE, '..', 'schemas', 'devkit', 'flow.json'), 'utf8'));
const DELIVERY_STAGE = FLOW.stages.find((s) => s.id === 'delivery');
const decideRow = (step, extra = {}, ctx = {}) => decide({
  ctx: { id: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', lang: 'en', filesLanguage: 'en', ...ctx },
  flow: FLOW,
  report: {
    version: 1, change: 'feat', schema: 'devkit', script: 'current', head: 'h', previous: null, end: null,
    stages: FLOW.stages.map((s, i) => ({ n: i + 1, id: s.id, title: s.title.en, state: 'passed', reasonCode: 'passed', params: {} })),
    next: { n: FLOW.stages.indexOf(DELIVERY_STAGE) + 1, stage: 'delivery', role: DELIVERY_STAGE.role, skills: DELIVERY_STAGE.skills ?? [], reasonCode: 'not-pushed', params: { number: 12 }, reason: 'x', progressKey: 'delivery@abc123' },
  },
  after: null, fingerprint: 'abc123', approval: { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false },
  hasProposal: false, flags: [], archiving: false,
  row: { next: { step, reason: 'r', actor: 'x', ...extra }, state: 's', delivered: {} },
});
const sayOf = (key, params = {}) => render('en', key, { id: 'feat', ...params });

// Phases 2 and 4 cover the steps deliver-check returns for the delivery; the archive steps' rows are checked in phase 5, further down.
test('delivery-models decide: the agent steps of the two-pull-request delivery go to their agents', () => {
  for (const step of ['open-prs', 'open-test-pr', 'push-support', 'move-test-pr']) {
    const a = decideRow(step);
    assert.deepEqual([a.kind, a.stage, a.agent], ['agent', 'delivery', 'devkit-core:commit-and-pr'], step);
    assert.equal(a.agent, actorOf(step).agent, step);
  }
  for (const step of ['resolve-support-conflict', 'fix-resolution']) {
    const a = decideRow(step);
    assert.deepEqual([a.kind, a.stage, a.agent], ['agent', 'implementation', 'devkit-core:tdd-implementer'], step);
    assert.equal(a.agent, actorOf(step).agent, step);
  }
});

test('delivery-models decide: running the failed check again, and the support branch steps, stay in the session', () => {
  const a = decideRow('rerun-checks', { number: 12, runs: ['77'] });
  assert.deepEqual([a.kind, a.stage, a.step], ['session', 'delivery', 'rerun-checks']);
  for (const step of ['checkout-support', 'merge-into-support']) {
    const s = decideRow(step, { root: '/w/feat-develop', branch: 'feat-develop' });
    assert.deepEqual([s.kind, s.stage, s.step], ['session', 'delivery', step], step);
  }
  const review = decideRow('review-resolution', { root: '/w/feat', support: 'feat-develop', commit: SHA, round: 1 });
  assert.deepEqual([review.kind, review.stage, review.step], ['session', 'review', 'review-resolution']);
});

test('delivery-models decide: the owner\'s merges end waiting, each with its own reply', () => {
  const test = decideRow('ready-test-branch', { number: 13, branch: 'develop', base: 'main', baseNumber: 12 });
  assert.deepEqual([test.kind, test.end.state, test.end.why, exitCodeOf(test)], ['end', 'waiting-for-owner', 'waiting-merge-test-branch', 1]);
  assert.equal(test.reply, sayOf('waiting-merge-test-branch', { number: 13, branch: 'develop', base: 'main' }));
  assert.match(test.reply, /#13/);
  assert.match(test.reply, /develop/);
  assert.match(test.reply, /main/);
  const base = decideRow('ready-base', { number: 12, base: 'main' });
  assert.deepEqual([base.end.state, base.end.why], ['waiting-for-owner', 'waiting-merge-base']);
  assert.equal(base.reply, sayOf('waiting-merge-base', { number: 12, base: 'main' }));
  assert.equal(decideRow('ready', { number: 12 }).end.why, 'waiting-merge', 'the existing owner end is as before');
});

test('delivery-models decide: the owner ends read in both languages with their parameters', () => {
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['waiting-merge-test-branch', 'waiting-merge-base', 'waiting-archive-merges']) { // the last is used from phase 5
      const text = render(lang, key, { id: 'feat', number: 13, branch: 'develop', base: 'main', list: '#5 to main' });
      assert.ok(text && !/\{\w+\}/.test(text), `${lang} ${key}: ${text}`);
    }
  }
});

test('delivery-models decide: the brief of a support-branch hand-off names the support worktree, the others the task worktree', () => {
  const support = { root: '/w/feat-develop', branch: 'feat-develop' };
  for (const step of ['resolve-support-conflict', 'fix-resolution', 'push-support']) { // the support-branch hand-offs use the same detail
    const a = decideRow(step, support);
    assert.match(a.brief, /^Change feat /, 'the roadmap lock reads the first words');
    assert.ok(a.brief.includes('Work only in /w/feat-develop on branch feat-develop;'), a.brief);
    assert.ok(a.brief.includes('start every Bash command with cd /w/feat-develop &&'), a.brief);
    assert.ok(!a.brief.includes('/w/feat on branch') && !a.brief.includes('cd /w/feat &&'), 'the task worktree is not named');
  }
  for (const [step, extra] of [['implement', { phase: 1 }], ['open-prs', { branch: 'feat', base: 'main', testBranch: 'develop' }], ['open-test-pr', { head: 'feat', base: 'develop' }]]) {
    const a = decideRow(step, extra);
    assert.ok(a.brief.includes('Work only in /w/feat on branch feat;'), `${step}: ${a.brief}`);
  }
});

test('delivery-models decide: every new step has a row, so none stops the change as unknown', () => {
  const steps = ['open-prs', 'open-test-pr', 'rerun-checks', 'ready-test-branch', 'ready-base', 'resolve-support-conflict', 'fix-resolution',
    'push-support', 'move-test-pr', 'checkout-support', 'merge-into-support', 'review-resolution', 'open-test-archive-pr', 'archive-prs-ready'];
  for (const step of steps) assert.notEqual(decideRow(step, { number: 1, branch: 'develop', base: 'main', list: '#1 to main' }).end?.why, 'unknown-step', step);
});

test('delivery-models conduct: actorOf and the final state name each new step', () => {
  const COMMIT = 'devkit-core:commit-and-pr';
  const rows = [
    ...['open-prs', 'open-test-pr', 'push-support', 'move-test-pr'].map((s) => [{ step: s }, 'subagent', COMMIT, `ready to run: ${s}`]),
    ...['resolve-support-conflict', 'fix-resolution'].map((s) => [{ step: s }, 'subagent', 'devkit-core:tdd-implementer', `ready to run: ${s}`]),
    ...['rerun-checks', 'checkout-support', 'merge-into-support'].map((s) => [{ step: s }, 'main', undefined, `ready to run: ${s}`]),
    [{ step: 'review-resolution' }, 'review', undefined, 'ready to run: review-resolution'],
    [{ step: 'stop-review-deadlock', reviewers: ['code-quality-reviewer'], resolution: true }, 'owner', undefined, 'waiting for the owner: review deadlock (code-quality-reviewer)'],
    [{ step: 'ready-test-branch', number: 13, branch: 'develop', base: 'main' }, 'owner', undefined, 'waiting for the owner: merge PR #13 to develop'],
    [{ step: 'ready-base', number: 12, base: 'main' }, 'owner', undefined, 'waiting for the owner: merge PR #12 to main'],
  ];
  for (const [next, actor, agent, state] of rows) {
    const got = deliveryStep({ id: 'x' }, { next: { reason: 'R', ...next }, summary: 'S', schema: 'devkit-lite', pr: { number: 12, url: 'u' } });
    assert.deepEqual([got.next.actor, got.next.agent, got.state], [actor, agent, state], next.step);
    assert.equal(got.next.askable, actor === 'owner' ? false : undefined, `${next.step}: an owner wait is not askable`);
  }
});

// ---------------------------------------------------------------- phase 3: the test-branch lock in the hook and in CI (AC-4, AC-5; P3 to P5, P7 row T1)

const GUARD = join(HERE, 'guard.mjs');
const hookIn = (cwd, command, env = {}) => {
  const r = spawnSync(process.execPath, [GUARD, 'bash'], { cwd, input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr };
};

// One opted-in two-prs project, built once: the hook only reads it. The task branch, the support branch, the test branch itself,
// an archive branch of the support branch and two branches whose upstream is a remote branch.
let hookProject;
function hookRepo() {
  if (hookProject) return hookProject;
  const t = roundRepo({ roadmap: '# Roadmap\n', config: `schema: devkit-lite\n${TWO_PRS}` });
  git(t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/feat');
  const at = { main: t.main, task: t.addWt('feat'), support: t.addWt('feat-develop'), test: t.addWt('develop', { from: 'origin/develop' }),
    archive: t.addWt('archive-feat-develop', { branch: 'chore/archive-feat-develop' }),
    pullDevelop: t.addWt('pull-a', { from: 'origin/develop' }), pullFeat: t.addWt('pull-b', { from: 'origin/feat' }) };
  git(at.pullDevelop, 'branch', '--set-upstream-to=origin/develop');
  git(at.pullFeat, 'branch', '--set-upstream-to=origin/feat');
  hookProject = at;
  return at;
}
// Built at load, outside any test: test-tmp.mjs removes a folder when the test that made it ends, and every hook test reads this one.
hookRepo();
const refusalOf = (branch) => new RegExp(`the task branch never receives develop: merge develop into the support branch ${branch}-develop instead \\(the flow creates it when the pull request to develop has a conflict\\)`);
const fill = (command) => command.replace(/\{(\w+)\}/g, (_, k) => hookRepo()[k]);
const refused = (name, command, where = 'task', branchOf = where) => test(`delivery-models P3 ${name}: refused on the task branch`, () => {
  const r = hookIn(hookRepo()[where], fill(command));
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /^devkit guard: blocked: /);
  assert.match(r.err, refusalOf(git(hookRepo()[branchOf], 'symbolic-ref', '--short', 'HEAD')));
  assert.match(r.err, /If you really need it, ask the user to run it\./);
});
const allowed = (name, command, where = 'task') => test(`delivery-models P3 ${name}: allowed`, () => {
  const r = hookIn(hookRepo()[where], fill(command));
  assert.equal(r.code, 0, r.err);
});

refused('merge develop', 'git merge develop');
refused('merge origin/develop', 'git merge origin/develop');
refused('rebase develop', 'git rebase develop');
refused('rebase --onto develop main', 'git rebase --onto develop main');
refused('pull origin develop', 'git pull origin develop');
refused('pull origin develop:develop', 'git pull origin develop:develop');
refused('a bare pull with upstream origin/develop', 'git pull', 'pullDevelop');
allowed('a bare pull with upstream origin/feat', 'git pull', 'pullFeat');
refused('merge develop~2', 'git merge develop~2');
refused('merge refs/heads/develop', 'git merge refs/heads/develop');
refused('merge refs/remotes/origin/develop', 'git merge refs/remotes/origin/develop');
refused('merge on main, any other branch', 'git merge develop', 'main');
refused('git -C <task> merge develop', 'git -C {task} merge develop', 'support', 'task');
refused('cd <task> && git merge develop, run from elsewhere', 'cd {task} && git merge develop', 'support', 'task');
allowed('merge develop on the test branch itself', 'git merge develop', 'test');
allowed('merge develop on the support branch feat-develop', 'git merge origin/develop', 'support');
allowed('merge develop on chore/archive-feat-develop', 'git merge develop', 'archive');
allowed('git -C <support> merge origin/develop from the task worktree', 'git -C {support} merge origin/develop');
allowed('merge develop-tools', 'git merge develop-tools');
allowed('merge feature/develop with no remote feature', 'git merge feature/develop');
allowed('git log develop', 'git log develop');
allowed('git fetch origin develop', 'git fetch origin develop');
allowed('merge another branch', 'git merge feat');

const otherConfig = (name, config, command = 'git merge develop') => test(`delivery-models P3 ${name}: allowed`, () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config });
  const wt = t.addWt('feat');
  assert.equal(hookIn(wt, command).code, 0);
  assert.equal(hookIn(t.main, command).code, 0, 'and on main');
});
otherConfig('model trunk-auto', 'schema: devkit-lite\ndevkit:\n  delivery:\n    model: trunk-auto\n');
otherConfig('no model', 'schema: devkit-lite\n');
otherConfig('a project that has not opted in', `schema: spec-driven\n${TWO_PRS}`);
otherConfig('a settings problem (two-prs without a test branch)', 'schema: devkit-lite\ndevkit:\n  delivery:\n    model: two-prs\n    base: main\n');

test('delivery-models P3 DEVKIT_BYPASS=1 through the CLI: allowed', () => {
  assert.equal(hookIn(hookRepo().task, 'git merge develop', { DEVKIT_BYPASS: '1' }).code, 0);
});

test('delivery-models P3 the reason names the support branch of the current branch, feat-develop', () => {
  const r = hookIn(hookRepo().task, 'git merge develop');
  assert.match(r.err, /support branch feat-develop instead/);
});

test('delivery-models AC-5: the hook refuses bringing the test branch into the task branch', () => {
  const at = hookRepo();
  for (const command of ['git merge develop', 'git merge origin/develop', 'git rebase develop', 'git pull origin develop', 'git -C . merge develop']) {
    assert.equal(hookIn(at.task, command).code, 2, command);
  }
  assert.equal(hookIn(at.support, 'git merge origin/develop').code, 0, 'the support branch is where the test branch comes in');
});

// ---------------------------------------------------------------- P4 testBranchCommit

// A commit on origin's test branch that the task branch does not hold; fetched into the main checkout (and so every worktree).
function advanceTest(s) {
  git(s.main, 'fetch', '-q', 'origin');
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'dev.txt': 'dev\n' });
  const sha = commitAll(o, 'work on develop');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  return sha;
}
const foreignOf = (s) => deliver.testBranchCommit(s.wt, { base: 'main', testBranch: 'develop', head: 'HEAD' });

test('delivery-models P4 testBranchCommit: a clean branch holds no commit of the test branch', () => {
  const s = scenario();
  advanceTest(s);
  assert.equal(foreignOf(s), null);
});

test('delivery-models P4 testBranchCommit: a branch that merged develop names the commit', () => {
  const s = scenario();
  const sha = advanceTest(s);
  git(s.wt, 'merge', '-q', '--no-edit', 'origin/develop');
  assert.deepEqual(foreignOf(s), { sha, subject: 'work on develop' });
});

test('delivery-models P4 testBranchCommit: a branch rebased onto develop names the commit', () => {
  const s = scenario();
  const sha = advanceTest(s);
  git(s.wt, 'rebase', '-q', 'origin/develop');
  assert.deepEqual(foreignOf(s), { sha, subject: 'work on develop' });
});

test('delivery-models P4 testBranchCommit: the test pull request merged into develop with a merge commit is not a foreign commit (neg)', () => {
  const s = scenario();
  const { test } = s.openBoth();
  advanceTest(s);
  s.sim.merge(test);
  git(s.main, 'fetch', '-q', 'origin');
  assert.equal(foreignOf(s), null);
});

test('delivery-models P4 testBranchCommit: the test pull request squash-merged into develop is not a foreign commit (neg)', () => {
  const s = scenario();
  const { test } = s.openBoth();
  s.sim.merge(test, 'squash');
  git(s.main, 'fetch', '-q', 'origin');
  assert.equal(foreignOf(s), null);
});

test('delivery-models P4 testBranchCommit: develop equal to main holds nothing to bring in (neg)', () => {
  assert.equal(foreignOf(scenario()), null);
});

test('delivery-models P4 testBranchCommit: a missing remote branch answers null instead of throwing (neg)', () => {
  const s = scenario();
  assert.equal(deliver.testBranchCommit(s.wt, { base: 'main', testBranch: 'nope', head: 'HEAD' }), null);
});

// ---------------------------------------------------------------- P7 row T1 (D-4)

test('delivery-models P7 T1: a test-branch commit in the task branch blocks, naming it', () => {
  const n = deliver.nextStep(twoState({}, { foreign: { sha: 'abcdef0123456789abcdef0123456789abcdef01', subject: 'work on develop' } }));
  assert.deepEqual([n.step, n.reason], ['blocked', 'abcdef0 (work on develop) is on develop and not on main; the task branch never receives develop']);
});

test('delivery-models P7 T1: the state reads origin/develop as fetched and blocks, writing nothing', () => {
  const s = scenario();
  const sha = advanceTest(s);
  git(s.wt, 'merge', '-q', '--no-edit', 'origin/develop');
  prove(s.wt);
  const state = s.state();
  assert.deepEqual(state.twoPrs.foreign, { sha, subject: 'work on develop' });
  const n = deliver.nextStep(state);
  assert.deepEqual([n.step, n.reason], ['blocked', `${sha.slice(0, 7)} (work on develop) is on develop and not on main; the task branch never receives develop`]);
  assert.equal(s.sim.writes().length, 0);
});

test('delivery-models P7 T1: a clean branch has no foreign commit and reaches the pull-request rows', () => {
  const s = scenario();
  advanceTest(s);
  assert.equal(s.state().twoPrs.foreign, null);
  assert.equal(s.next().step, 'open-prs');
});

// ---------------------------------------------------------------- P5 the CI check on a pull request to the base branch

const eventFile = (payload) => {
  const f = join(tmpFolder('devkit-delivery-models-event-'), 'event.json');
  writeFileSync(f, JSON.stringify(payload));
  return f;
};
const ON_MAIN = { repository: { default_branch: 'main' } };
function ci(s, { base = 'main', head = 'feat', event = null, id = 'feat', json = false, env = {}, cwd = s.wt } = {}) {
  const r = deliver.main(['--ci', ...(json ? ['--json'] : []), ...(id ? [id] : [])], { ...s.env, GITHUB_BASE_REF: base, GITHUB_HEAD_REF: head, ...(event ? { GITHUB_EVENT_PATH: event } : {}), ...env }, cwd);
  return { ...r, out: r.stdout, json: () => JSON.parse(r.stdout) };
}
const TWO_PRS_LINE = /^ {2}two-prs {2}open {2}(.*)$/m;
const listCalls = (s) => s.sim.calls().filter((c) => c[0] === 'pr' && c[1] === 'list');
const pushBranch = (s, name) => { git(s.main, 'push', '-q', 'origin', `HEAD:refs/heads/${name}`); };
// S3 is the fallback of a clone with no origin/HEAD; a fetch by Git 2.48 or later creates it, so a test of S3 removes it.
const noOriginHead = (s) => { try { git(s.main, 'symbolic-ref', '--delete', 'refs/remotes/origin/HEAD'); } catch { /* none to remove */ } };

test('delivery-models AC-4: the base pull request\'s check fails naming the test-branch pull request until it merges, then passes', () => {
  const s = scenario();
  const { test } = s.openBoth();
  const open = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(open.code, 1, open.out);
  assert.equal(TWO_PRS_LINE.exec(open.out)[1], `waits for pull request #${test} to develop to merge`);
  s.sim.merge(test);
  git(s.main, 'fetch', '-q', 'origin');
  const merged = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(merged.code, 0, merged.out);
  assert.doesNotMatch(merged.out, TWO_PRS_LINE);
});

test('delivery-models P5: no test-branch pull request fails naming both heads it looked for', () => {
  const s = scenario();
  const r = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(r.code, 1, r.out);
  assert.equal(TWO_PRS_LINE.exec(r.out)[1], 'no pull request to develop from feat or feat-develop');
});

test('delivery-models P5: a test-branch pull request merged from the support branch after the first was closed passes', () => {
  const s = scenario();
  const first = s.sim.create({ base: 'develop', head: 'feat', body: BODY });
  s.sim.close(first);
  git(s.wt, 'push', '-q', 'origin', 'HEAD:refs/heads/feat-develop');
  const second = s.sim.create({ base: 'develop', head: 'feat-develop', body: BODY });
  s.sim.merge(second);
  git(s.main, 'fetch', '-q', 'origin');
  const r = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(r.code, 0, r.out);
});

test('delivery-models P5: a commit of the test branch in the task branch fails naming it', () => {
  const s = scenario();
  const { test } = s.openBoth();
  s.sim.merge(test);
  const sha = advanceTest(s);
  git(s.wt, 'merge', '-q', '--no-edit', 'origin/develop');
  prove(s.wt);
  const r = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, new RegExp(`^ {2}two-prs {2}open {2}${sha.slice(0, 7)} \\(work on develop\\) is on develop and not on main; the task branch never receives develop$`, 'm'));
});

test('delivery-models AC-5: the check fails a base pull request that holds a test-branch commit, naming it', () => {
  const s = scenario();
  s.openBoth();
  const sha = advanceTest(s);
  git(s.wt, 'merge', '-q', '--no-edit', 'origin/develop');
  prove(s.wt);
  const r = ci(s, { event: eventFile(ON_MAIN), json: true });
  assert.equal(r.code, 1);
  const j = r.json();
  assert.deepEqual(j.twoPrs.foreign, { sha, subject: 'work on develop' });
  assert.equal(j.twoPrs.pass, false);
  assert.equal(j.pass, false);
});

test('delivery-models P5: a GitHub error names the permission and the token', () => {
  const s = scenario();
  const bin = tmpFolder('devkit-delivery-models-gh-denied-');
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "HTTP 403: Resource not accessible by integration" >&2\nexit 1\n');
  chmodSync(join(bin, 'gh'), 0o755);
  const r = ci(s, { event: eventFile(ON_MAIN), env: { PATH: `${bin}:${s.env.PATH}` } });
  assert.equal(r.code, 1, r.out);
  assert.match(TWO_PRS_LINE.exec(r.out)[1], /^cannot read the pull requests to develop: .*HTTP 403.* \(the job needs pull-requests: read and GH_TOKEN\)$/);
});

test('delivery-models P5: the head\'s config switched to trunk is still judged as two-prs', () => {
  const s = scenario();
  put(s.wt, { 'openspec/config.yaml': 'schema: devkit-lite\ndevkit:\n  delivery:\n    model: trunk\n' });
  commitAll(s.wt, 'switch the model');
  const r = ci(s, { event: eventFile(ON_MAIN) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /two-prs {2}open {2}no pull request to develop/);
});

test('delivery-models P5: model trunk-auto on the base is judged as today, with no GitHub call and the same JSON keys (neg)', () => {
  const s = scenario({ config: 'schema: devkit-lite\ndevkit:\n  delivery:\n    model: trunk-auto\n' });
  const r = ci(s, { event: eventFile(ON_MAIN), json: true });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(Object.keys(r.json()).sort(), ['change', 'head', 'items', 'mode', 'pass', 'readiness', 'schema', 'version']);
  assert.equal(s.sim.calls().length, 0);
});

test('delivery-models P5: a pull request to another base is not judged by the two-prs rules (neg)', () => {
  const s = scenario();
  const r = ci(s, { base: 'release', event: eventFile(ON_MAIN) });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /two-prs/);
  assert.equal(s.sim.calls().length, 0);
});

test('delivery-models P5: with several judged changes the rules run once per change', () => {
  const s = scenario();
  const dir = (n) => `openspec/changes/${n}`;
  put(s.wt, Object.fromEntries(['proposal.md', 'tasks.md', '.openspec.yaml'].map((f) => [`${dir('feat2')}/${f}`, readFileSync(join(s.wt, dir('feat'), f), 'utf8')])));
  commitAll(s.wt, 'a second change');
  const sha = git(s.wt, 'rev-parse', 'HEAD');
  put(s.wt, {
    [`${dir('feat2')}/evidence.md`]: `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`,
    ...Object.fromEntries(REVIEWS.map((r) => [`${dir('feat2')}/reviews/${r}.md`, `Verdict: approved\nCommit: ${sha}\n\n# Review\n`])),
  });
  commitAll(s.wt, 'its proof');
  const r = ci(s, { id: null, head: 'both', event: eventFile(ON_MAIN) });
  assert.equal(r.code, 1, r.out);
  assert.equal(r.out.split('\n').filter((l) => TWO_PRS_LINE.test(l)).length, 2, r.out);
  assert.match(r.out, /fail: feat: two-prs; feat2: two-prs/);
  assert.equal(listCalls(s).length, 4, 'two lookups (the support branch, the task branch) for each change');
});

// The settings source (D-7 S1 to S3): the base branch is read through the default branch the payload or origin/HEAD names.
const NOT_DEFAULT = /^ {2}two-prs {2}open {2}the base branch main is not the repository's default branch trunk$/m;

test('delivery-models P5 S1: repository.default_branch of the event names the ref the settings are read from', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  const r = ci(s, { event: eventFile({ repository: { default_branch: 'trunk' } }), json: true });
  assert.equal(r.json().twoPrs.settingsRef, 'origin/trunk');
  assert.equal(r.code, 1);
});

test('delivery-models P5 S1: pull_request.base.repo.default_branch is read when repository lacks it', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  const r = ci(s, { event: eventFile({ pull_request: { base: { repo: { default_branch: 'trunk' } } } }), json: true });
  assert.equal(r.json().twoPrs.settingsRef, 'origin/trunk');
});

test('delivery-models P5 S1: a default branch with no origin/ ref falls to S2 (neg)', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  git(s.main, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  const r = ci(s, { event: eventFile({ repository: { default_branch: 'ghost' } }), json: true });
  assert.equal(r.json().twoPrs.settingsRef, 'origin/trunk');
});

test('delivery-models P5 S2: origin/HEAD names the ref when there is no payload', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  git(s.main, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  const r = ci(s, { json: true });
  assert.equal(r.json().twoPrs.settingsRef, 'origin/trunk');
});

test('delivery-models P5 S3: with neither, the base ref is read as before this change (neg: a test-branch pull request whose own copy names no model)', () => {
  const s = scenario();
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'openspec/config.yaml': 'schema: devkit-lite\n' });
  commitAll(o, 'develop names no model');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  noOriginHead(s);
  const r = ci(s, { base: 'develop', json: true });
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(Object.keys(r.json()).sort(), ['change', 'head', 'items', 'mode', 'pass', 'readiness', 'schema', 'version']);
  assert.equal(s.sim.calls().length, 0);
});

test('delivery-models P5: a base that is not the default branch read through S1 fails naming both, and neither rule runs', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  s.openBoth();
  const r = ci(s, { event: eventFile({ repository: { default_branch: 'trunk' } }) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, NOT_DEFAULT);
  assert.doesNotMatch(r.out, /waits for pull request|no pull request to develop|never receives/);
  assert.equal(listCalls(s).length, 0, 'no GitHub call');
});

test('delivery-models P5: the same configuration read through S3 has no such line (neg)', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  noOriginHead(s);
  const r = ci(s);
  assert.doesNotMatch(r.out, NOT_DEFAULT);
  assert.match(r.out, /two-prs {2}open {2}no pull request to develop/);
});

// ---------------------------------------------------------------- the workflow template (D-7)

for (const label of ['devkit-reviews.yml']) {
  test(`delivery-models P5 workflow (${label}): the job reads pull requests and the checker gets GH_TOKEN, the token staying read-only`, () => {
    const yml = readFileSync(join(HERE, '..', 'skills', 'devkit', 'templates', label), 'utf8');
    assert.match(yml, /^permissions:\n {2}contents: read\n {2}pull-requests: read\n/m);
    assert.match(yml, /- run: node "\$RUNNER_TEMP\/deliver-check\.mjs" --ci\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/);
    assert.doesNotMatch(yml, /: write/);
  });
}

// ---------------------------------------------------------------- phase 4: the support branch and the resolution round (AC-6, AC-7, AC-8; P6, P7)

const REQUIRED = ['code-quality-reviewer', 'test-coverage-reviewer'];
const SUPPORT_BRANCH = 'feat-develop';

// A commit on origin's test branch that conflicts with the task branch (both add src/a.ts) and brings a file of its own.
function conflictOnTest(s) {
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'src/a.ts': 'develop\n', 'dev.txt': 'dev\n' });
  const sha = commitAll(o, 'develop edits a.ts');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  return sha;
}

// What the session does for merge-into-support (D-8) and the implementer for resolve-support-conflict.
function mergeIntoSupport(s, n) {
  if (n.create) git(s.main, 'worktree', 'add', '-q', '-b', n.branch, n.root, 'feat');
  try { git(n.root, 'merge', '--no-ff', '--no-edit', n.from); } catch { /* a conflict is left in the worktree */ }
}
function resolveSupport(n, text = 'merged\n') {
  put(n.root, Object.fromEntries(n.paths.map((f) => [f, text])));
  for (const f of n.paths) git(n.root, 'add', f);
  git(n.root, 'commit', '-q', '--no-edit');
  return git(n.root, 'rev-parse', 'HEAD');
}
// What the two reviewers and the consolidation leave in the task worktree, committed and pushed as the push row does.
function reviewResolution(s, commit, { verdict = {}, findings = {}, consensus = 'PASS (round 1/2)' } = {}) {
  const files = { 'openspec/changes/feat/resolution.md': `# Resolution review\n\nConsensus: ${consensus}\n` };
  for (const r of REQUIRED) {
    files[`openspec/changes/feat/reviews/resolution/${r}.md`] = `Verdict: ${verdict[r] ?? 'approved'}\nCommit: ${commit}\n\n## ${r} - feat\n\n### Findings\n${findings[r] ?? '- [nit] F1 src/a.ts:1 reads fine\n'}`;
  }
  put(s.wt, files);
  commitAll(s.wt, 'resolution review');
  git(s.wt, 'push', '-q', 'origin', 'feat');
}
const supportHead = (s) => spawnSync('git', ['--git-dir', s.originDir, 'rev-parse', '--verify', '-q', `refs/heads/${SUPPORT_BRANCH}`], { encoding: 'utf8' }).stdout.trim();
const originTip = (s, branch) => spawnSync('git', ['--git-dir', s.originDir, 'rev-parse', `refs/heads/${branch}`], { encoding: 'utf8' }).stdout.trim();
const taskHead = (s) => git(s.wt, 'rev-parse', 'HEAD');

// The session's loop: run the step deliver-check names the way an agent would, until one of `until`. Returns the steps seen.
function drive(s, { until = ['ready-test-branch'], handlers = {}, limit = 12 } = {}) {
  const seen = [];
  const base = {
    'merge-into-support': (n) => mergeIntoSupport(s, n),
    'resolve-support-conflict': (n) => resolveSupport(n),
    'review-resolution': (n) => reviewResolution(s, n.commit),
    'push-support': (n) => git(n.root, 'push', '-q', 'origin', n.branch),
    'move-test-pr': (n) => { const created = s.sim.create({ base: n.base, head: n.head, body: `${BODY}Replaces #${n.replaces}.\n` }); s.sim.close(n.replaces); return created; },
    push: () => git(s.wt, 'push', '-q', 'origin', 'feat'),
    'checkout-support': (n) => git(s.main, 'worktree', 'add', '-q', n.path, n.branch),
  };
  for (let i = 0; i < limit; i++) {
    const n = s.next();
    seen.push(n.step);
    if (until.includes(n.step)) return { seen, last: n };
    const run = handlers[n.step] ?? base[n.step];
    assert.ok(run, `no handler for ${n.step}: ${n.reason} (${seen.join(' ')})`);
    run(n);
  }
  assert.fail(`no end after ${limit} steps: ${seen.join(' ')}`);
}

// A scenario with both pull requests open and a test branch that conflicts with the task branch.
function conflicting() {
  const s = scenario();
  const prs = s.openBoth();
  conflictOnTest(s);
  return { s, ...prs };
}

test('delivery-models AC-6: a conflict goes to the support branch, the pull request moves, the task branch and the base pull request stay', () => {
  const { s, base, test } = conflicting();
  assert.equal(s.sim.pr(test).mergeable ?? null, null);
  const before = { task: originTip(s, 'feat'), main: originTip(s, 'main') };
  const first = s.next();
  assert.deepEqual([first.step, first.root, first.branch, first.from, first.create], ['merge-into-support', s.wtPath(SUPPORT_BRANCH), SUPPORT_BRANCH, 'origin/develop', true]);
  assert.equal(s.state().twoPrs.test.pr.mergeable, 'CONFLICTING');

  const { seen } = drive(s);
  assert.deepEqual(seen, ['merge-into-support', 'resolve-support-conflict', 'review-resolution', 'merge-into-support', 'push-support', 'move-test-pr', 'ready-test-branch']);

  const moved = s.sim.prs().filter((p) => p.base === 'develop');
  assert.deepEqual(moved.map((p) => [p.number, p.head, p.state]), [[test, 'feat', 'CLOSED'], [moved[1].number, SUPPORT_BRANCH, 'OPEN']], 'the pull request moved to the support branch');
  assert.match(moved[1].body, new RegExp(`Replaces #${test}\\.`));
  assert.equal(s.sim.pr(base).state, 'OPEN');
  assert.equal(s.sim.pr(base).head, 'feat', 'the base pull request is not touched');
  assert.equal(originTip(s, 'main'), before.main);
  assert.ok(!s.ancestorOf(supportHead(s), originTip(s, 'feat')), 'the support branch never reaches the task branch');
  assert.ok(s.ancestorOf(originTip(s, 'develop'), supportHead(s)), 'the support branch holds the test branch');
  assert.ok(s.ancestorOf(originTip(s, 'feat'), supportHead(s)), 'and the task branch');
  assert.deepEqual(s.sim.writes().map((c) => c[1]), ['create', 'create', 'create', 'close'], 'only the two creates of open-prs, then the move: a create and a close');
  assert.notEqual(originTip(s, 'feat'), before.task, 'the task branch only gained the review files');
  assert.deepEqual(spawnSync('git', ['--git-dir', s.originDir, 'diff', '--name-only', before.task, originTip(s, 'feat')], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).every((f) => f.startsWith('openspec/changes/feat/')), true);
  const report = s.report();
  assert.deepEqual([report.twoPrs.support.branch, report.twoPrs.support.exists, report.twoPrs.support.pushed, report.twoPrs.testPr.head], [SUPPORT_BRANCH, true, true, SUPPORT_BRANCH]);
});

test('delivery-models AC-6: the merge left in the support worktree names its paths, and checkout-support brings the branch back to a worktree', () => {
  const { s } = conflicting();
  const n = s.next();
  mergeIntoSupport(s, n);
  const resolving = s.next();
  assert.deepEqual([resolving.step, resolving.root, resolving.branch, resolving.paths], ['resolve-support-conflict', s.wtPath(SUPPORT_BRANCH), SUPPORT_BRANCH, ['src/a.ts']]);
  resolveSupport(resolving);
  git(s.main, 'worktree', 'remove', '--force', s.wtPath(SUPPORT_BRANCH));
  const back = s.next();
  assert.deepEqual([back.step, back.path, back.branch], ['checkout-support', s.wtPath(SUPPORT_BRANCH), SUPPORT_BRANCH]);
  git(s.main, 'worktree', 'add', '-q', back.path, back.branch);
  assert.equal(s.next().step, 'review-resolution', 'the branch with its resolution is where it was');
});

test('delivery-models AC-6: a clean merge of the test branch needs no resolution round', () => {
  const s = scenario();
  s.openBoth();
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'src/c.ts': 'c\n' });
  commitAll(o, 'develop adds c');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  assert.equal(s.next().step, 'ready-test-branch', 'a pull request that merges cleanly is left alone');
});

test('delivery-models AC-7: the resolution is reviewed on its own before the support branch is pushed; a blocking finding holds it', () => {
  const { s } = conflicting();
  let n = s.next();
  mergeIntoSupport(s, n);
  n = s.next();
  const resolved = resolveSupport(n);
  n = s.next();
  assert.equal(n.step, 'review-resolution');
  assert.deepEqual([n.root, n.support, n.commit, n.round, n.commits.map((c) => c.sha)], [s.wt, SUPPORT_BRANCH, resolved, 1, [resolved]]);

  // The diffs the reviewers are given hold the resolution only, never what the test branch brought.
  const shown = n.diffs.map((cmd) => spawnSync('sh', ['-c', cmd], { cwd: n.root, encoding: 'utf8' }).stdout).join('\n');
  assert.match(shown, /^[-+].*merged/m);
  assert.doesNotMatch(shown, /dev\.txt|^\+dev$/m, 'what the test branch brought is not in the diff');

  // One reviewer rejects with a blocking finding: the support branch is fixed, never pushed, the pull request never moves.
  const writes = s.sim.writes().length;
  reviewResolution(s, resolved, { verdict: { 'code-quality-reviewer': 'rejected' }, findings: { 'code-quality-reviewer': '- [blocking] F1 src/a.ts:1 a line of the task branch was lost\n' }, consensus: 'FAIL (round 1/2)' });
  n = s.next();
  assert.equal(n.step, 'fix-resolution');
  assert.deepEqual([n.root, n.branch, n.findings.map((f) => f.reviewer)], [s.wtPath(SUPPORT_BRANCH), SUPPORT_BRANCH, ['code-quality-reviewer']]);
  assert.equal(supportHead(s), '', 'the support branch is not on the remote');
  assert.equal(s.sim.writes().length, writes, 'no pull request moved');

  // The fix is a commit of the support branch: the reviews are stale, round 2 reads the new commit.
  put(n.root, { 'src/a.ts': 'merged and kept\n' });
  const fix = commitAll(n.root, 'keep the task line');
  n = s.next();
  assert.deepEqual([n.step, n.commit, n.round], ['review-resolution', fix, 2]);
  assert.deepEqual(n.commits.map((c) => c.sha), [fix, resolved], 'the fix and the resolution, newest first');

  // Approved at the fix, the finding disposed: the flow goes on to merge the task branch in, push and move.
  reviewResolution(s, fix, { findings: { 'code-quality-reviewer': `- [blocking] F1 src/a.ts:1 a line of the task branch was lost · fixed in ${fix.slice(0, 7)}\n` }, consensus: 'PASS (round 2/2)' });
  const { seen } = drive(s);
  assert.deepEqual(seen, ['merge-into-support', 'push-support', 'move-test-pr', 'ready-test-branch']);
});

test('delivery-models AC-7: a rejection that survives round 2 ends waiting for the owner, with nothing pushed or moved', () => {
  const { s } = conflicting();
  mergeIntoSupport(s, s.next());
  const resolved = resolveSupport(s.next());
  reviewResolution(s, resolved, { verdict: { 'test-coverage-reviewer': 'rejected' }, findings: { 'test-coverage-reviewer': '- [important] F1 src/a.ts:1 the resolution has no test\n' }, consensus: 'FAIL (round 2/2)' });
  const writes = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.reviewers, n.resolution], ['stop-review-deadlock', ['test-coverage-reviewer'], true]);
  assert.equal(supportHead(s), '');
  assert.equal(s.sim.writes().length, writes);
});

test('delivery-models AC-7: the review skill and the two required reviewers name the resolution call and its verdict folder', () => {
  const core = join(HERE, '..', '..', 'core');
  const skill = readFileSync(join(core, 'skills', 'review-change', 'SKILL.md'), 'utf8');
  assert.match(skill, /^### Resolution calls$/m, 'the section heading');
  const section = skill.split(/^### Resolution calls$/m)[1].split(/^#{2,3} /m)[0];
  for (const word of ['reviews/resolution/', 'resolution.md', 'verdictDir', 'support branch', 'newest own commit']) assert.ok(section.includes(word), `the section names ${word}`);
  for (const reviewer of REQUIRED) {
    const agent = readFileSync(join(core, 'agents', `${reviewer}.md`), 'utf8');
    assert.ok(agent.includes(`reviews/resolution/${reviewer}.md`), `${reviewer} names its resolution verdict file`);
    assert.match(agent, /resolution call/i);
  }
});

test('delivery-models AC-8: a fix on the task branch reaches both pull requests, with a support branch', () => {
  const { s, base } = conflicting();
  drive(s);
  const moved = s.sim.prs().find((p) => p.base === 'develop' && p.state === 'OPEN');
  put(s.wt, { 'src/b.ts': 'fixed\n' });
  const fix = commitAll(s.wt, 'fix');
  const proof = prove(s.wt);
  const { seen } = drive(s);
  assert.deepEqual(seen, ['push', 'merge-into-support', 'push-support', 'ready-test-branch']);
  const head = (number) => deliver.fetchPr(s.sim.gh(s.wt), { branch: s.sim.pr(number).head, base: s.sim.pr(number).base, list: true }).pr.headRefOid;
  assert.equal(head(base), proof);
  assert.ok(s.ancestorOf(fix, head(base)), 'the fix is in the base pull request');
  assert.equal(head(moved.number), supportHead(s));
  assert.ok(s.ancestorOf(fix, head(moved.number)), 'the fix is in the test-branch pull request');
  assert.equal(s.sim.pr(moved.number).head, SUPPORT_BRANCH);
});

test('delivery-models AC-8: a fix that conflicts with the resolution goes through the resolution round again', () => {
  const { s } = conflicting();
  drive(s);
  put(s.wt, { 'src/a.ts': 'fixed\n' });
  commitAll(s.wt, 'fix a');
  prove(s.wt);
  const { seen } = drive(s, { until: ['review-resolution'] });
  assert.deepEqual(seen.slice(-3), ['merge-into-support', 'resolve-support-conflict', 'review-resolution'], seen.join(' '));
});

// ---- supportState and resolutionState on real Git

test('delivery-models support state: no support branch, then one with a merge in progress, then a resolved one', () => {
  const { s } = conflicting();
  const none = s.state().twoPrs.support;
  assert.deepEqual(none, { branch: SUPPORT_BRANCH, exists: false, worktree: null, path: s.wtPath(SUPPORT_BRANCH), merging: null, head: null, hasTask: false, hasTest: false, pushed: false });
  mergeIntoSupport(s, s.next());
  const merging = s.state().twoPrs.support;
  assert.deepEqual([merging.exists, merging.worktree, merging.merging, merging.hasTask, merging.hasTest, merging.pushed], [true, s.wtPath(SUPPORT_BRANCH), ['src/a.ts'], true, false, false]);
  const resolved = resolveSupport(s.next());
  const done = s.state().twoPrs.support;
  assert.deepEqual([done.merging, done.head, done.hasTest], [null, resolved, true]);
  git(done.worktree, 'push', '-q', 'origin', SUPPORT_BRANCH);
  assert.equal(s.state().twoPrs.support.pushed, true);
  put(s.wt, { 'src/b.ts': 'b\n' });
  commitAll(s.wt, 'task moves on');
  assert.equal(s.state().twoPrs.support.hasTask, false, 'the task branch moved past the support branch');
});

test('delivery-models resolution state: own commits are the resolution and the fixes, never what the test branch brought or a clean merge', () => {
  const { s } = conflicting();
  mergeIntoSupport(s, s.next());
  const resolved = resolveSupport(s.next());
  put(s.wtPath(SUPPORT_BRANCH), { 'src/a.ts': 'kept\n' });
  const fix = commitAll(s.wtPath(SUPPORT_BRANCH), 'fix');
  reviewResolution(s, fix);
  git(s.wtPath(SUPPORT_BRANCH), 'merge', '--no-ff', '--no-edit', 'feat');
  const r = s.state().twoPrs.resolution;
  assert.deepEqual(r.commits.map((c) => c.sha), [fix, resolved], 'the clean merge of the task branch and develop\'s own commit are not here');
  assert.equal(r.newest, fix);
  assert.deepEqual([r.approved, r.missing, r.stale, r.rejected, r.undisposed, r.round], [true, [], [], [], [], { consensus: 'PASS', round: 1 }]);
  assert.deepEqual(r.verdicts.map((v) => [v.name, v.verdict, v.commit.sha]), REQUIRED.map((n) => [n, 'APPROVED', fix]));
  assert.ok(r.commits.every((c) => typeof c.diff === 'string' && c.diff.startsWith('git ')), 'each own commit has the command that prints its diff');
});

test('delivery-models resolution state: no support branch, or only clean merges, is approved with no verdict (neg)', () => {
  const s = scenario();
  assert.deepEqual([s.state().twoPrs.resolution.approved, s.state().twoPrs.resolution.commits], [true, []]);
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'src/c.ts': 'c\n' });
  commitAll(o, 'develop adds c');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  mergeIntoSupport(s, { create: true, root: s.wtPath(SUPPORT_BRANCH), branch: SUPPORT_BRANCH, from: 'origin/develop' });
  const r = s.state().twoPrs.resolution;
  assert.deepEqual([r.commits, r.approved, r.missing], [[], true, []]);
});

test('delivery-models resolution state: a verdict that is missing, stale, rejected or holds an undisposed finding is named', () => {
  const { s } = conflicting();
  mergeIntoSupport(s, s.next());
  const resolved = resolveSupport(s.next());
  assert.deepEqual(s.state().twoPrs.resolution.missing, REQUIRED);
  reviewResolution(s, resolved, { verdict: { 'test-coverage-reviewer': 'rejected' }, findings: { 'test-coverage-reviewer': '- [important] F1 src/a.ts:1 no test\n' }, consensus: 'FAIL (round 1/2)' });
  let r = s.state().twoPrs.resolution;
  assert.deepEqual([r.rejected, r.undisposed.map((f) => f.reviewer), r.approved, r.round], [['test-coverage-reviewer'], ['test-coverage-reviewer'], false, { consensus: 'FAIL', round: 1 }]);
  put(s.wtPath(SUPPORT_BRANCH), { 'src/a.ts': 'kept\n' });
  commitAll(s.wtPath(SUPPORT_BRANCH), 'fix');
  r = s.state().twoPrs.resolution;
  assert.deepEqual(r.stale, REQUIRED, 'both verdicts name the commit before the fix');
  assert.deepEqual(r.rejected, [], 'a stale rejection is not a current one');
});

test('delivery-models resolution state: a finding fixed in a commit of the support branch is disposed; one fixed in nothing is not', () => {
  const { s } = conflicting();
  mergeIntoSupport(s, s.next());
  const resolved = resolveSupport(s.next());
  reviewResolution(s, resolved, { findings: { 'code-quality-reviewer': `- [blocking] F1 src/a.ts:1 lost · fixed in ${'f'.repeat(7)}\n` } });
  assert.equal(s.state().twoPrs.resolution.undisposed.length, 1, 'a sha that is not in the support history does not dispose it');
  reviewResolution(s, resolved, { findings: { 'code-quality-reviewer': `- [blocking] F1 src/a.ts:1 lost · fixed in ${resolved.slice(0, 7)}\n` } });
  assert.equal(s.state().twoPrs.resolution.undisposed.length, 0);
});

test('delivery-models resolution state: refs that cannot be read give an error and no approval, never a throw', () => {
  const { s } = conflicting();
  mergeIntoSupport(s, s.next());
  const r = deliver.resolutionState(s.wt, 'feat', { taskRef: 'refs/heads/nope', supportRef: `refs/heads/${SUPPORT_BRANCH}` });
  assert.deepEqual([r.approved, r.commits, r.error], [false, [], `cannot read the commits of refs/heads/${SUPPORT_BRANCH} since refs/heads/nope`]);
});

// ---------------------------------------------------------------- P6 the CI check on a pull request to the test branch (D-7)

const judgedOn = (base) => new RegExp(`the delivery contract of feat is judged on the pull request to ${base}`);

test('delivery-models P6: a pull request to the test branch from the task branch says where the contract is judged and judges no item', () => {
  const s = scenario();
  put(s.wt, { 'src/a.ts': 'later\n' });
  commitAll(s.wt, 'a commit after the proof: items 2 and 4 would be stale');
  const onBase = ci(s, { event: eventFile(ON_MAIN) });
  assert.match(onBase.out, /2 open/, 'the same head fails on the base branch');
  const before = s.sim.calls().length;
  const r = ci(s, { base: 'develop', event: eventFile(ON_MAIN), json: true });
  assert.equal(r.code, 0, r.out);
  const j = r.json();
  assert.equal(j.pass, true);
  assert.equal(j.items, undefined, 'items 1 to 4 are not judged');
  assert.deepEqual([j.twoPrs.settingsRef, j.twoPrs.base, j.twoPrs.testBranch, j.twoPrs.pass, j.twoPrs.resolution], ['origin/main', 'main', 'develop', true, null]);
  assert.match(ci(s, { base: 'develop', event: eventFile(ON_MAIN) }).out, judgedOn('main'));
  assert.equal(s.sim.calls().length, before, 'the test-branch pull request asks GitHub nothing');
});

function supportCi(s, over = {}) {
  return ci(s, { base: 'develop', head: SUPPORT_BRANCH, event: eventFile(ON_MAIN), cwd: s.wtPath(SUPPORT_BRANCH), ...over });
}
// The support branch as the flow leaves it before the push: resolved, then the task branch (with the review files) merged in.
function supportWithResolution(s, review) {
  mergeIntoSupport(s, { create: true, root: s.wtPath(SUPPORT_BRANCH), branch: SUPPORT_BRANCH, from: 'origin/develop' });
  const resolved = resolveSupport({ root: s.wtPath(SUPPORT_BRANCH), paths: ['src/a.ts'] });
  if (review) reviewResolution(s, resolved, review);
  git(s.wtPath(SUPPORT_BRANCH), 'merge', '--no-ff', '--no-edit', 'feat');
  return resolved;
}

test('delivery-models P6: from the support branch with both verdicts approved at the newest own commit, the check passes', () => {
  const { s } = conflicting();
  supportWithResolution(s, {});
  const r = supportCi(s);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, judgedOn('main'));
  assert.doesNotMatch(r.out, TWO_PRS_LINE);
});

test('delivery-models P6: from the support branch with a verdict missing, the check fails naming it', () => {
  const { s } = conflicting();
  supportWithResolution(s, null);
  const r = supportCi(s);
  assert.equal(r.code, 1, r.out);
  assert.match(TWO_PRS_LINE.exec(r.out)[1], /missing code-quality-reviewer, test-coverage-reviewer/);
});

test('delivery-models P6: from the support branch with a stale verdict, the check fails naming the reviewer', () => {
  const { s } = conflicting();
  supportWithResolution(s, {});
  put(s.wtPath(SUPPORT_BRANCH), { 'src/a.ts': 'kept\n' });
  commitAll(s.wtPath(SUPPORT_BRANCH), 'fix after the review');
  const r = supportCi(s);
  assert.equal(r.code, 1, r.out);
  assert.match(TWO_PRS_LINE.exec(r.out)[1], /stale code-quality-reviewer, test-coverage-reviewer/);
});

test('delivery-models P6: from the support branch with a rejected verdict or an undisposed blocking finding, the check fails naming them', () => {
  const { s } = conflicting();
  supportWithResolution(s, { verdict: { 'code-quality-reviewer': 'rejected' }, findings: { 'code-quality-reviewer': '- [blocking] F1 src/a.ts:1 lost a line\n' }, consensus: 'FAIL (round 1/2)' });
  const r = supportCi(s);
  assert.equal(r.code, 1, r.out);
  const line = TWO_PRS_LINE.exec(r.out)[1];
  assert.match(line, /not approved: code-quality-reviewer/);
  assert.match(line, /undisposed: code-quality-reviewer: \[blocking\] F1 src\/a\.ts:1 lost a line/);
  const j = supportCi(s, { json: true }).json();
  assert.deepEqual([j.pass, j.twoPrs.pass, j.twoPrs.resolution.rejected, j.twoPrs.resolution.approved], [false, false, ['code-quality-reviewer'], false]);
});

test('delivery-models P6: a support branch that holds only clean merges has no resolution to review (neg)', () => {
  const s = scenario();
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'src/c.ts': 'c\n' });
  commitAll(o, 'develop adds c');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  mergeIntoSupport(s, { create: true, root: s.wtPath(SUPPORT_BRANCH), branch: SUPPORT_BRANCH, from: 'origin/develop' });
  const r = supportCi(s, { json: true });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual([r.json().twoPrs.resolution.commits, r.json().twoPrs.resolution.approved], [[], true]);
});

test('delivery-models P6: the test branch\'s own config names no model while the default branch\'s says two-prs: still judged, by the default branch\'s copy', () => {
  const { s } = conflicting();
  const o = s.addWt('lagging', { from: 'origin/develop' });
  put(o, { 'openspec/config.yaml': 'schema: devkit-lite\n' });
  commitAll(o, 'develop names no model');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  const fromTask = ci(s, { base: 'develop', event: eventFile(ON_MAIN) });
  assert.equal(fromTask.code, 0, fromTask.out);
  assert.match(fromTask.out, judgedOn('main'), 'the note: items 1 to 4 are not judged');
  supportWithResolution(s, null);
  const fromSupport = supportCi(s);
  assert.equal(fromSupport.code, 1, fromSupport.out);
  assert.match(TWO_PRS_LINE.exec(fromSupport.out)[1], /missing code-quality-reviewer/);
});

test('delivery-models P6: with the base branch not the default branch the test-branch pull request fails naming both, and no resolution rule runs', () => {
  const s = scenario();
  pushBranch(s, 'trunk');
  const r = ci(s, { base: 'develop', event: eventFile({ repository: { default_branch: 'trunk' } }) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, NOT_DEFAULT);
});

// ---------------------------------------------------------------- phase 5: the archive to both branches (AC-9; P9, P10, P13)

const noWrites = (s, before) => assert.equal(s.sim.writes().length, before, 'no create, close, merge or reopen is recorded');

test('delivery-models AC-9 archive: the base archive pull request open and no test one opens it from the archive commits', () => {
  const s = archiving();
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.branch, n.base, n.from, n.exists], ['open-test-archive-pr', TEST_ARCHIVE, 'develop', 'chore/archive-feat', false]);
  assert.ok(n.path.endsWith('/.claude/worktrees/archive-feat-develop'), n.path);
  noWrites(s, before);
});

test('delivery-models AC-9 archive: the base archived and no test archive pull request opens it too', () => {
  const s = archiving();
  s.sim.merge(s.basePr);
  const state = s.state();
  assert.equal(state.archive.onDefault, 'archived');
  assert.equal(state.archive.onTest, 'active');
  const n = deliver.nextStep(state);
  assert.deepEqual([n.step, n.branch, n.base, n.from, n.exists], ['open-test-archive-pr', TEST_ARCHIVE, 'develop', 'chore/archive-feat', false]);
});

test('delivery-models AC-9 archive: a test branch that is not archived keeps the change from archived even when the base is', () => {
  const s = archiving();
  s.sim.merge(s.basePr);
  assert.notEqual(s.next().step, 'archived');
});

test('delivery-models AC-9 archive: the owner finished the cherry-pick, so the branch is taken as it is (exists: true)', () => {
  const s = archiving();
  assert.equal(s.cutTest().status, 0);
  const n = s.next();
  assert.deepEqual([n.step, n.exists, n.branch], ['open-test-archive-pr', true, TEST_ARCHIVE]);
});

test('delivery-models AC-9 archive: a cherry-pick conflict left in the worktree stops naming its paths and the worktree', () => {
  const s = archiving();
  // develop already has a file at a path the archive adds
  const o = s.addWt('lagging', { from: 'origin/develop' });
  put(o, { [`${ARCHIVED_FEAT}/retro.md`]: 'another\n' });
  commitAll(o, 'develop has it');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.wt, 'fetch', '-q', 'origin');
  assert.notEqual(s.cutTest().status, 0, 'the cherry-pick conflicts');
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'test-archive-cherry-pick']);
  assert.ok(n.reason.includes(`${ARCHIVED_FEAT}/retro.md`) && n.reason.includes(s.testWt) && n.reason.includes('develop'), n.reason);
  assert.ok(n.reason.includes('git cherry-pick --continue'), n.reason);
  noWrites(s, before);
});

test('delivery-models AC-9 archive: a test archive pull request closed without merging stops and is never reopened', () => {
  const s = archiving();
  s.cutTest();
  const testPr = s.testPr();
  s.sim.close(testPr);
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'test-archive-pr']);
  assert.equal(n.reason, `archive pull request #${testPr} to develop was closed without merging`);
  noWrites(s, before);
});

test('delivery-models AC-9 archive: a test archive pull request with failing checks stops naming them', () => {
  const s = archiving();
  s.cutTest();
  const testPr = s.testPr();
  s.sim.setChecks(testPr, [CHECK('check', 'fail')]);
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'test-archive-pr']);
  assert.equal(n.reason, `archive pull request #${testPr} to develop has failing checks: check`);
  noWrites(s, before);
});

test('delivery-models AC-9 archive: a test archive pull request merged while the test branch lacks the archive stops', () => {
  const s = archiving();
  git(s.main, 'worktree', 'add', '-q', '-b', TEST_ARCHIVE, s.testWt, 'origin/develop'); // the branch carries nothing
  const testPr = s.testPr();
  s.sim.merge(testPr);
  const n = s.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'test-archive-pr']);
  assert.equal(n.reason, `archive pull request #${testPr} to develop is merged but develop still has openspec/changes/feat/; run again`);
});

test('delivery-models AC-9 archive: both archive pull requests open are ready, named together, and nothing is merged', () => {
  const s = archiving();
  s.cutTest();
  const testPr = s.testPr();
  const before = s.sim.writes().length;
  const n = s.next();
  assert.deepEqual([n.step, n.list], ['archive-prs-ready', `#${s.basePr} to main, #${testPr} to develop`]);
  noWrites(s, before);
});

test('delivery-models AC-9 archive: the base archive merged and the test one open is ready, naming only the open one', () => {
  const s = archiving();
  s.cutTest();
  const testPr = s.testPr();
  s.sim.merge(s.basePr);
  const n = s.next();
  assert.deepEqual([n.step, n.list], ['archive-prs-ready', `#${testPr} to develop`]);
});

test('delivery-models AC-9 archive: both merged is archived', () => {
  const s = archiving();
  s.cutTest();
  const testPr = s.testPr();
  s.sim.merge(testPr);
  s.sim.merge(s.basePr);
  const n = s.next();
  assert.deepEqual([n.step, n.folder], ['archived', '2026-11-09-feat']);
});

test('delivery-models AC-9 archive: a failing base archive pull request still stops as before, before the test one is opened (neg)', () => {
  const s = archiving();
  s.sim.setChecks(s.basePr, [CHECK('check', 'fail')]);
  const n = s.next();
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'archive-pr']);
});

test('delivery-models AC-9 archive: the summary names both archive pull requests as ready', () => {
  const s = archiving();
  s.cutTest();
  s.testPr();
  assert.equal(s.report().summary, 'archive PRs ready');
});

// ---------------------------------------------------------------- P10 what is unfinished in two-prs

const refGh = (byRef) => (args) => {
  const m = args[0] === 'api' ? /contents\/openspec\/changes\/archive\?ref=(.*)$/.exec(args[1] ?? '') : null;
  return m && byRef[m[1]]
    ? { status: 0, stdout: JSON.stringify(byRef[m[1]].map((name) => ({ name }))), stderr: '', missing: false, timedOut: false }
    : { status: 1, stdout: '', stderr: 'gh: not reachable', missing: false, timedOut: false };
};
const unfinishedIds = (t, gh) => unfinished(t.main, { env: cleanEnv, gh }).map((u) => u.id);
const twoPrsProject = () => withTestBranch(project(TWO_PRS));
const activeFolder = (wt, id) => put(wt, { [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit\n' });

test('delivery-models P10: in two-prs an id archived on the base branch only is still unfinished, on both it is not', () => {
  const t = twoPrsProject();
  activeFolder(t.addWt('foo'), 'foo');
  assert.deepEqual(unfinishedIds(t, refGh({ main: ['2026-11-20-foo'] })), ['foo'], 'base only');
  assert.deepEqual(unfinishedIds(t, refGh({ develop: ['2026-11-20-foo'] })), ['foo'], 'test branch only (neg)');
  assert.deepEqual(unfinishedIds(t, refGh({ main: ['2026-11-20-foo'], develop: ['2026-11-20-foo'] })), []);
});

test('delivery-models P10: a trunk project\'s archived ids stay the base branch\'s (neg)', () => {
  const t = project('devkit:\n  delivery:\n    model: trunk\n');
  activeFolder(t.addWt('foo'), 'foo');
  assert.deepEqual(unfinishedIds(t, refGh({ main: ['2026-11-20-foo'] })), []);
});

test('delivery-models P10: the test archive branch is the archive of its change, in two-prs only', () => {
  const two = twoPrsProject();
  two.addWt('archive-feat-develop', { branch: TEST_ARCHIVE });
  assert.deepEqual(unfinished(two.main, { env: cleanEnv, gh: refGh({}) }).map((u) => [u.id, u.branch]), [['feat', TEST_ARCHIVE]]);
  const trunk = project('devkit:\n  delivery:\n    model: trunk\n');
  trunk.addWt('archive-feat-develop', { branch: TEST_ARCHIVE });
  assert.deepEqual(unfinished(trunk.main, { env: cleanEnv, gh: refGh({}) }).map((u) => u.id), ['feat-develop'], 'neg: no suffix is removed');
});

test('delivery-models P10: the base archive branch wins over the test archive branch for the same change', () => {
  const t = twoPrsProject();
  t.addWt('archive-feat-develop', { branch: TEST_ARCHIVE });
  t.addWt('archive-feat', { branch: 'chore/archive-feat' });
  assert.deepEqual(unfinished(t.main, { env: cleanEnv, gh: refGh({}) }).map((u) => [u.id, u.branch]), [['feat', 'chore/archive-feat']]);
});

// ---------------------------------------------------------------- the loop's rows and the conductor's actors for the archive steps

test('delivery-models decide: opening the test archive pull request is a commit-and-pr hand-off in the task worktree', () => {
  const a = decideRow('open-test-archive-pr', { branch: TEST_ARCHIVE, base: 'develop', from: 'chore/archive-feat', path: '/w/archive-feat-develop', exists: false });
  assert.deepEqual([a.kind, a.stage, a.agent], ['agent', 'delivery', 'devkit-core:commit-and-pr']);
  assert.equal(a.agent, actorOf('open-test-archive-pr').agent);
  assert.ok(a.brief.includes('Work only in /w/feat on branch feat;'), a.brief);
});

test('delivery-models decide: both archive pull requests ready ends waiting for the owner, naming them', () => {
  const a = decideRow('archive-prs-ready', { list: '#5 to main, #6 to develop' });
  assert.deepEqual([a.end.state, a.end.why], ['waiting-for-owner', 'waiting-archive-merges']);
  assert.equal(a.reply, sayOf('waiting-archive-merges', { list: '#5 to main, #6 to develop' }));
  assert.match(a.reply, /#5 to main, #6 to develop/);
});

test('delivery-models conduct: actorOf and the final state name the archive steps', () => {
  const got = (step, extra = {}) => deliveryStep({ id: 'x' }, { next: { reason: 'R', step, ...extra }, summary: 'S', schema: 'devkit-lite', pr: { number: 12, url: 'u' } });
  const open = got('open-test-archive-pr');
  assert.deepEqual([open.next.actor, open.next.agent, open.state], ['subagent', 'devkit-core:commit-and-pr', 'ready to run: open-test-archive-pr']);
  const ready = got('archive-prs-ready', { list: '#5 to main, #6 to develop' });
  assert.deepEqual([ready.next.actor, ready.next.askable, ready.state], ['owner', false, 'waiting for the owner: merge archive PRs #5 to main, #6 to develop']);
});

// ---------------------------------------------------------------- P16 the documents (D-12, D-13, phase 6)

// Invariant (AC-1, AC-9): ADR 0018 and its four Notes, the config line, the design page's answered conflict and lock row,
// the flow page's subsection and CI lines, the skill's one row per new step and the README say what the delivery models are.
// Layer: the documents. Suite: this file.
test('delivery-models docs: the documents follow', () => {
  const root = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const adrName = '0018-the-delivery-model-is-chosen-per-project.md';
  const adr = read('docs', 'adr', adrName);
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  assert.match(adr, /^- Change: delivery-models$/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0018 has ${h}`);
  }
  const old = ['0002-merge-without-the-owner-opt-in.md', '0003-auto-merge-the-archive-pr.md', '0010-openspec-as-the-harness.md', '0012-the-reviews-check-follows-the-change-script.md'];
  for (const f of old) {
    const t = read('docs', 'adr', f);
    assert.match(t, /Note \(delivery-models, \d{4}-\d{2}-\d{2}\): ADR 0018 amends /, `${f} has the Note`);
    if (/^- Status: accepted$/m.test(adr)) assert.ok(t.split('\n').includes(`- Amended by ADR 0018 (${adrName})`), `${f} names ADR 0018 in its header`);
  }
  if (/^- Status: accepted$/m.test(adr)) assert.match(adr, /^- Accepted by: the owner, on \d{4}-\d{2}-\d{2}, /m);
  const config = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(config, /0018 the delivery model chosen per project and the test-branch lock, amends 0002, 0003, 0010 and 0012/, 'the ADRs line names 0018');

  const design = read('docs', 'coordination-design.md');
  const part = (from, to) => { const a = design.indexOf(from); assert.ok(a >= 0, from); const b = design.indexOf(to, a + from.length); return design.slice(a, b < 0 ? design.length : b); };
  assert.match(part('## 5. ', '## 6. '), /answered by the owner on 2026-11-21, round 17 grill, questions 3 to 5/, 'section 5 records the answer');
  assert.doesNotMatch(part('## Open points', '## What stays shipped'), /conflicts with `develop`; settled/, 'the conflict left Open points');
  assert.match(design, /\| The task branch never receives `develop` \| the command is refused \(exists\) \|/, 'the lock row is built');

  const flow = read('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('### Delivery models'), 'the flow page has the subsection');
  for (const k of ['two-prs', 'trunk-auto', 'setting-missing', 'test-branch-missing', 'base-not-default', 'pull-requests: read', 'GH_TOKEN: ${{ github.token }}']) {
    assert.ok(flow.includes(k), `the flow page names ${k}`);
  }
  assert.match(flow, /reads `devkit\.delivery` from the default branch, and applies rules only in `two-prs`/, 'the CI sentence names the default branch');

  const skill = read('plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md');
  for (const step of ['open-prs', 'open-test-pr', 'checkout-support', 'merge-into-support', 'resolve-support-conflict', 'review-resolution', 'fix-resolution', 'push-support', 'move-test-pr', 'rerun-checks', 'ready-test-branch', 'ready-base', 'open-test-archive-pr', 'archive-prs-ready']) {
    assert.equal(skill.split('\n').filter((l) => l.startsWith(`| \`${step}\` |`)).length, 1, `one row for ${step}`);
  }
  assert.match(skill, /^\*\*`two-prs`\./m, 'the skill has the two-prs paragraph');
  const agent = read('plugins', 'core', 'agents', 'commit-and-pr.md');
  assert.match(agent, /^## Two-PR call$/m);
  assert.match(agent, /^## Test-branch archive call$/m);
  assert.match(read('plugins', 'openspec', 'README.md'), /two-prs/, 'the README names the delivery models');
});
