// Tests for merge-setup.mjs. Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEVKIT_REVIEWS_CHECK, WORKFLOW_PATH, RULESET_NAME, MERGE_METHODS, mergeSetup, requiredChecks } from './merge-setup.mjs';
import { makeGh } from './deliver-check.mjs';
import { fakeGh, gitRepo, put, commitAll } from './deliver-check.test.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

test('constants: the check name, the workflow path, the ruleset name and the method fields (design D4)', () => {
  assert.equal(DEVKIT_REVIEWS_CHECK, 'devkit-reviews');
  assert.equal(WORKFLOW_PATH, '.github/workflows/devkit-reviews.yml');
  assert.equal(RULESET_NAME, 'devkit');
  assert.deepEqual(MERGE_METHODS, { squash: 'allow_squash_merge', merge: 'allow_merge_commit', rebase: 'allow_rebase_merge' });
});

// ---------------------------------------------------------------- the workflow files (design D5)

const files = {
  'this repository': join(repoRoot, WORKFLOW_PATH),
  'the setup template': join(repoRoot, 'plugins', 'openspec', 'skills', 'openspec-setup', 'templates', 'devkit-reviews.yml'),
};
const read = (label) => {
  assert.ok(existsSync(files[label]), `${label}: ${files[label]} exists`);
  return readFileSync(files[label], 'utf8');
};

for (const label of Object.keys(files)) {
  test(`workflow (${label}): the job id is the check name, with no job name and no paths filter`, () => {
    const yml = read(label);
    const jobs = yml.slice(yml.indexOf('\njobs:'));
    assert.deepEqual([...jobs.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]), [DEVKIT_REVIEWS_CHECK], 'exactly one job, named by the constant');
    assert.doesNotMatch(yml, /^ {4}name:/m, 'a job name would replace the job id as the check name');
    assert.doesNotMatch(yml, /\bpaths(-ignore)?:/, 'a path filter makes a required check never report');
  });

  test(`workflow (${label}): pull_request only, never pull_request_target, read-only token`, () => {
    const yml = read(label);
    assert.match(yml, /^on:\n {2}pull_request:\s*$/m);
    assert.doesNotMatch(yml, /pull_request_target/);
    assert.doesNotMatch(yml, /^ {2}(push|schedule|workflow_dispatch):/m);
    assert.match(yml, /^permissions:\n {2}contents: read\s*$/m);
    assert.doesNotMatch(yml, /secrets\./);
  });

  test(`workflow (${label}): checks out the PR head with full history and runs Node 22`, () => {
    const yml = read(label);
    assert.match(yml, /uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\s+fetch-depth: 0/);
    assert.match(yml, /node-version: 22/);
  });
}

test('workflow (this repository): runs the checker from the checkout with --ci', () => {
  assert.match(read('this repository'), /^ {6}- run: node plugins\/openspec\/hooks\/deliver-check\.mjs --ci$/m);
});

test('workflow (the setup template): downloads the checker from chacal88/devkit/{{ref}} into $RUNNER_TEMP only and runs it from there', () => {
  const yml = read('the setup template');
  assert.match(yml, /https:\/\/raw\.githubusercontent\.com\/chacal88\/devkit\/\{\{ref\}\}\/plugins\/openspec\/hooks/);
  const targets = [...yml.matchAll(/curl [^\n]*-o "?([^"\s]+)"?/g)].map((m) => m[1]);
  assert.deepEqual(targets, ['$RUNNER_TEMP/guard.mjs', '$RUNNER_TEMP/deliver-check.mjs', '$RUNNER_TEMP/merge-setup.mjs'], 'deliver-check.mjs imports merge-setup.mjs; a file downloaded into the workspace would make every review stale');
  assert.match(yml, /^ {6}- run: node "\$RUNNER_TEMP\/deliver-check\.mjs" --ci$/m);
  assert.doesNotMatch(yml, /plugins\/openspec\/hooks\/deliver-check\.mjs --ci/, 'no copy of the repository path in the consumer template');
});

// ---------------------------------------------------------------- the preflight (design D4, AC-6, AC-8)

const POINTER = '; run the openspec-setup skill (GitHub step) to configure it';
const K = {
  repo: 'api-GET-repos__owner___repo_',
  rules: (b = 'main') => `api-GET-repos__owner___repo__rules_branches_${b}`,
  classic: (b = 'main') => `api-GET-repos__owner___repo__branches_${b}_protection_required_status_checks`,
};
const ruleFor = (...contexts) => [{ type: 'pull_request', parameters: {} }, { type: 'required_status_checks', parameters: { required_status_checks: contexts.map((context) => ({ context })) } }];
const NOT_PROTECTED = { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' };

// A repo whose HEAD has (or lacks) the workflow, and a fake gh answering a fully prepared repository
// unless `over` replaces a piece. `over.repo` merges into the settings; `rules`/`classic` replace fixtures.
function prepared({ committed = true, uncommittedOnly = false, repo = {}, rules = ruleFor('check', DEVKIT_REVIEWS_CHECK), classic = NOT_PROTECTED, method = 'squash' } = {}) {
  const root = gitRepo({ files: committed ? { [WORKFLOW_PATH]: 'name: x\n' } : {} });
  if (uncommittedOnly) put(root, { [WORKFLOW_PATH]: 'name: x\n' });
  const gh = fakeGh();
  gh.set(K.repo, { stdout: { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true, ...repo } });
  gh.set(K.rules(), typeof rules === 'object' && rules !== null && 'exit' in rules ? rules : { stdout: rules });
  gh.set(K.classic(), 'exit' in classic ? classic : { stdout: classic });
  return { root, gh, run: () => mergeSetup(makeGh(root, gh.env), root, method) };
}

test('mergeSetup: all four facts met is ok, with the default branch and the exact gh calls (AC-6)', () => {
  const t = prepared();
  assert.deepEqual(t.run(), { ok: true, missing: [], defaultBranch: 'main' });
  assert.deepEqual(t.gh.calls(), [
    ['api', 'repos/{owner}/{repo}'],
    ['api', 'repos/{owner}/{repo}/rules/branches/main'],
    ['api', 'repos/{owner}/{repo}/branches/main/protection/required_status_checks'],
  ]);
});

test('mergeSetup: each fact missing alone is listed with its exact text and the openspec-setup pointer (AC-6)', () => {
  const cases = [
    [{ repo: { allow_auto_merge: false } }, 'auto-merge is not allowed (allow_auto_merge)'],
    [{ rules: [] }, 'no active rule requires the devkit-reviews check on main'],
    [{ rules: ruleFor('check') }, 'no active rule requires the devkit-reviews check on main'],
    [{ committed: false }, '.github/workflows/devkit-reviews.yml is not committed'],
    [{ committed: false, uncommittedOnly: true }, '.github/workflows/devkit-reviews.yml is not committed'],
  ];
  for (const [over, text] of cases) {
    const r = prepared(over).run();
    assert.equal(r.ok, false, text);
    assert.deepEqual(r.missing, [text + POINTER], JSON.stringify(over));
  }
});

test('mergeSetup: the merge method must be allowed, per method (AC-8)', () => {
  for (const [method, field] of Object.entries(MERGE_METHODS)) {
    const r = prepared({ method, repo: { [field]: false } }).run();
    assert.deepEqual(r.missing, [`${method} merges are not allowed (${field})${POINTER}`], method);
  }
  // another method being off does not matter
  assert.equal(prepared({ method: 'rebase', repo: { allow_squash_merge: false } }).run().ok, true);
});

test('mergeSetup: several facts missing are all listed, in the table order', () => {
  const r = prepared({ committed: false, rules: [], repo: { allow_auto_merge: false, allow_squash_merge: false } }).run();
  assert.deepEqual(r.missing.map((m) => m.split(' ')[0]), ['auto-merge', 'squash', 'no', '.github/workflows/devkit-reviews.yml']);
});

test('mergeSetup: classic branch protection naming devkit-reviews counts, by contexts or by checks[].context', () => {
  assert.equal(prepared({ rules: [], classic: { contexts: ['check', DEVKIT_REVIEWS_CHECK] } }).run().ok, true);
  assert.equal(prepared({ rules: [], classic: { contexts: [], checks: [{ context: DEVKIT_REVIEWS_CHECK, app_id: 1 }] } }).run().ok, true);
  assert.equal(prepared({ rules: [], classic: { contexts: ['check'], checks: [{ context: 'check' }] } }).run().ok, false);
});

test('mergeSetup: classic protection answering 404 or 403 is "none", not an error', () => {
  for (const stderr of ['gh: Branch not protected (HTTP 404)\n', 'gh: Not Found (HTTP 404)\n', 'gh: Upgrade to GitHub Pro (HTTP 403)\n']) {
    const r = prepared({ rules: [], classic: { exit: 1, stderr } }).run();
    assert.deepEqual(r.missing, ['no active rule requires the devkit-reviews check on main' + POINTER], stderr);
    assert.equal(r.error, undefined, stderr);
  }
});

test('mergeSetup: any other gh error fails closed as "cannot read the repository settings" (design D4)', () => {
  const settings = prepared();
  settings.gh.set(K.repo, { exit: 1, stderr: 'gh: connection reset\nsecond line\n' });
  let r = settings.run();
  assert.equal(r.ok, false);
  assert.equal(r.error, 'cannot read the repository settings: gh: connection reset');
  assert.deepEqual(r.missing, [r.error + POINTER]);

  r = prepared({ rules: { exit: 1, stderr: 'gh: Server Error (HTTP 500)\n' } }).run();
  assert.equal(r.error, 'cannot read the repository settings: gh: Server Error (HTTP 500)');

  r = prepared({ classic: { exit: 1, stderr: 'gh: Server Error (HTTP 502)\n' } }).run();
  assert.match(r.error, /^cannot read the repository settings: gh: Server Error \(HTTP 502\)$/);

  r = prepared({ repo: { default_branch: undefined } }).run();
  assert.match(r.error, /^cannot read the repository settings: .*default branch/i);
});

test('mergeSetup: gh missing from PATH fails closed', () => {
  const t = prepared();
  const r = mergeSetup(makeGh(t.root, { ...process.env, PATH: '/nonexistent' }), t.root, 'squash');
  assert.equal(r.ok, false);
  assert.match(r.error, /^cannot read the repository settings: gh is not installed/);
});

test('requiredChecks: the rule and classic contexts of a branch, unique; an error object when gh fails', () => {
  const t = prepared({ rules: ruleFor('check', 'x'), classic: { contexts: ['x', 'y'] } });
  assert.deepEqual(requiredChecks(makeGh(t.root, t.gh.env), 'main'), { contexts: ['check', 'x', 'y'] });
  const bad = prepared({ rules: { exit: 1, stderr: 'gh: boom\n' } });
  assert.deepEqual(requiredChecks(makeGh(bad.root, bad.gh.env), 'main'), { error: 'gh: boom' });
});

// The consumer workflow has only what it downloads: --ci (and guard.mjs ci) must run from exactly those files.
test('workflow (the setup template): deliver-check --ci and guard.mjs ci run from only the files the template downloads', () => {
  const yml = read('the setup template');
  const names = [...yml.matchAll(/curl [^\n]*-o "?([^"\s]+)"?/g)].map((m) => basename(m[1]));
  assert.ok(names.includes('deliver-check.mjs') && names.includes('guard.mjs') && names.includes('merge-setup.mjs'), names.join(', '));
  const dir = mkdtempSync(join(tmpdir(), 'devkit-downloaded-'));
  for (const n of names) copyFileSync(join(here, n), join(dir, n));
  const root = gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } } });
  const env = { ...process.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
  for (const args of [[join(dir, 'deliver-check.mjs'), '--ci', '--json'], [join(dir, 'guard.mjs'), 'ci', '--json']]) {
    const r = spawnSync('node', args, { cwd: root, encoding: 'utf8', env });
    assert.equal(r.status, 1, `${basename(args[0])}: ${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.deepEqual([j.mode, j.change, j.pass], ['ci', 'feat', false], basename(args[0]));
    assert.doesNotMatch(r.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
  }
});

test('guard.mjs ci with deliver-check.mjs but without merge-setup.mjs fails closed naming the missing files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-partial-'));
  for (const n of ['guard.mjs', 'deliver-check.mjs']) copyFileSync(join(here, n), join(dir, n));
  const root = gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } } });
  const r = spawnSync('node', [join(dir, 'guard.mjs'), 'ci'], { cwd: root, encoding: 'utf8', env: { ...process.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /guard\.mjs ci needs deliver-check\.mjs and merge-setup\.mjs in the same folder/);
});
