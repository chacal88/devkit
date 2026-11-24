// Tests for github-setup.mjs (auto-merge, design D8). Imported by hooks/guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { desiredRuleset, WORKFLOW_PATH, DEVKIT_REVIEWS_CHECK } from '../../../hooks/merge-setup.mjs';
import { fakeGh, gitRepo, put } from '../../../hooks/test-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'github-setup.mjs');
const pluginVersion = JSON.parse(readFileSync(join(here, '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;

const K = {
  repo: 'api-GET-repos__owner___repo_',
  rulesets: 'api-GET-repos__owner___repo__rulesets',
  ruleset: (id) => `api-GET-repos__owner___repo__rulesets_${id}`,
  runs: 'api-GET-repos__owner___repo__commits_main_check-runs_per_page=100',
  actions: 'api-GET-repos__owner___repo__actions_permissions',
  actionRuns: 'api-GET-repos__owner___repo__actions_runs_status=completed&per_page=3',
  runJobs: (id) => `api-GET-repos__owner___repo__actions_runs_${id}_jobs`,
  headRuns: (oid) => `api-GET-repos__owner___repo__commits_${oid}_check-runs_per_page=100`,
  prsAll: 'pr-list-state-all',
  tag: (v) => `api-GET-repos_chacal88_devkit_git_ref_tags_v${v}`,
  tagObj: (sha) => `api-GET-repos_chacal88_devkit_git_tags_${sha}`,
  contents: 'api-GET-repos__owner___repo__contents_.github_workflows_devkit-reviews.yml_ref=main',
  patch: 'api-PATCH-repos__owner___repo_',
  post: 'api-POST-repos__owner___repo__rulesets',
  put: (id) => `api-PUT-repos__owner___repo__rulesets_${id}`,
};
const SHA = 'a'.repeat(40);
const HEAD1 = 'c'.repeat(40);
const HEAD2 = 'd'.repeat(40);
const TAG_SHA = 'b'.repeat(40);
const SETTINGS_OFF = { default_branch: 'main', allow_auto_merge: false, delete_branch_on_merge: false, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true };
const SETTINGS_ON = { ...SETTINGS_OFF, allow_auto_merge: true, delete_branch_on_merge: true };
const D8 = (contexts) => ({
  name: 'devkit', target: 'branch', enforcement: 'active', bypass_actors: [],
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    { type: 'pull_request', parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: false, require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false } },
    { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: true, do_not_enforce_on_create: false, required_status_checks: contexts.map((context) => ({ context })) } },
    { type: 'non_fast_forward' },
  ],
});
// What GitHub returns for a ruleset: the payload plus ids and source fields.
const stored = (contexts, over = {}) => ({ id: 7, source_type: 'Repository', source: 'o/r', ...D8(contexts), ...over });

// A temp repo, a fake gh answering a repository in the given state, and a runner for the script.
function world({ settings = SETTINGS_OFF, runs = ['check'], tag = { stdout: { object: { type: 'commit', sha: SHA } } }, rulesets = [], existing = null, workflow = 'missing', workflowOnMain = false, prChecks = null, prList = [], branch = 'feat', heads = null, actions = { stdout: { enabled: true } }, actionRuns = { stdout: { workflow_runs: [] } }, jobs = {} } = {}) {
  const root = gitRepo({ branch });
  const gh = fakeGh();
  if (workflow === 'template') put(root, { [WORKFLOW_PATH]: 'on: pull_request\njobs:\n  devkit-reviews:\n    steps:\n      - run: node plugins/openspec/hooks/deliver-check.mjs --ci\n' });
  if (workflow === 'foreign') put(root, { [WORKFLOW_PATH]: 'name: mine\non: push\n' });
  gh.set(K.repo, { stdout: settings });
  // gh --paginate --jq '.check_runs[].name' prints one name per line, across pages
  gh.set(K.runs, { stdout: runs.map((n) => `${n}\n`).join('') });
  // the checks a ruleset would require come from the newest pull requests' heads (field-fixes 5)
  const reported = heads ?? [{ oid: HEAD1, names: runs }];
  gh.set(K.prsAll, { stdout: reported.map((h, i) => ({ number: i + 1, headRefOid: h.oid })) });
  for (const h of reported) gh.set(K.headRuns(h.oid), { stdout: h.names.map((n) => `${n}\n`).join('') });
  gh.set(K.actions, actions);
  gh.set(K.actionRuns, actionRuns);
  for (const [id, fixture] of Object.entries(jobs)) gh.set(K.runJobs(id), fixture);
  if (tag) gh.set(K.tag(pluginVersion), tag);
  gh.set(K.rulesets, { stdout: rulesets });
  if (existing) gh.set(K.ruleset(existing.id ?? 7), { stdout: existing });
  if (workflowOnMain) gh.set(K.contents, { stdout: { name: 'devkit-reviews.yml' } });
  if (prChecks) gh.set('pr-checks', { stdout: prChecks.map((name) => ({ name })) });
  gh.set('pr-list', { stdout: prList });
  // a wrapper that keeps what is piped to `--input -`, then runs the fake gh
  const wrap = tmpFolder('devkit-ghwrap-');
  writeFileSync(join(wrap, 'gh'), `#!/bin/sh\ncase " $* " in *" --input - "*) cat > "$FAKE_GH_DIR/stdin.json";; esac\nexec "${join(gh.bin, 'gh')}" "$@"\n`);
  chmodSync(join(wrap, 'gh'), 0o755);
  const env = { ...gh.env, PATH: `${wrap}:${gh.env.PATH}` };
  const run = (...args) => {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
  };
  const writes = () => gh.calls().filter((c) => c.includes('-X'));
  const item = (r, name) => r.json().items.find((i) => i.item === name);
  const sent = () => JSON.parse(readFileSync(join(gh.dir, 'stdin.json'), 'utf8'));
  return { root, gh, run, writes, item, sent };
}

test('desiredRuleset: the payload of design D8 for the given contexts', () => {
  assert.deepEqual(desiredRuleset(['check', DEVKIT_REVIEWS_CHECK]), D8(['check', 'devkit-reviews']));
  assert.deepEqual(desiredRuleset(['check']).rules[1].parameters.required_status_checks.map((c) => c.context), ['check', 'devkit-reviews'], 'devkit-reviews is always required, once');
  assert.deepEqual(desiredRuleset(['devkit-reviews', 'check']).rules[1].parameters.required_status_checks.map((c) => c.context), ['devkit-reviews', 'check']);
});

test('plan (no --apply): four items with state and payload, no -X call, no file written (AC-7)', () => {
  const w = world();
  const r = w.run();
  assert.equal(r.code, 0, r.err);
  for (const name of ['workflow', 'auto-merge', 'delete-branch', 'ruleset']) assert.match(r.out, new RegExp(`^${name}\\s+(ok|create|update|deferred)`, 'm'), name);
  assert.deepEqual(w.writes(), [], 'no -X call');
  assert.equal(existsSync(join(w.root, WORKFLOW_PATH)), false, 'no file written');
  const j = w.run('--json').json();
  assert.equal(j.version, 1);
  assert.deepEqual(j.items.map((i) => [i.item, i.state]), [['workflow', 'create'], ['auto-merge', 'update'], ['delete-branch', 'update'], ['ruleset', 'deferred']]);
  assert.match(j.items[1].payload, /gh api -X PATCH repos\/\{owner\}\/\{repo\} -F allow_auto_merge=true/);
  assert.equal(w.item(w.run('--json'), 'ruleset').why.startsWith('devkit-reviews has not reported yet'), true);
  assert.deepEqual(w.writes(), []);
});

test('plan: contexts come from the newest pull requests heads without devkit-reviews; --checks replaces them', () => {
  const w = world({ runs: ['check', 'devkit-reviews', 'lint'], workflowOnMain: true });
  const j = w.run('--json').json();
  assert.deepEqual(j.contexts, ['check', 'lint']);
  assert.deepEqual(w.item(w.run('--json'), 'ruleset').payload, D8(['check', 'lint', 'devkit-reviews']));
  const k = w.run('--json', '--checks', 'ci,build').json();
  assert.deepEqual(k.contexts, ['ci', 'build']);
  assert.deepEqual(k.items.find((i) => i.item === 'ruleset').payload, D8(['ci', 'build', 'devkit-reviews']));
});

test('plan: check runs of each head are read across pages (--paginate), so more than 30 checks all reach the ruleset, and the list is shown for confirmation (completeness)', () => {
  const names = Array.from({ length: 45 }, (_, i) => `job-${i}`);
  const w = world({ runs: [...names, 'job-3', 'devkit-reviews'], workflowOnMain: true });
  const r = w.run('--json');
  assert.deepEqual(r.json().contexts, names);
  assert.equal(w.item(r, 'ruleset').payload.rules[1].parameters.required_status_checks.length, 46);
  const call = w.gh.calls().find((c) => c.some((a) => a.includes('/check-runs')));
  assert.ok(call.includes('--paginate'), call.join(' '));
  assert.ok(call.some((a) => a.includes(`commits/${HEAD1}/check-runs`)), 'read on the pull request head, not on the default branch');
  const human = w.run().out;
  assert.match(human, /the ruleset will require these checks \(confirm them, or pass --checks\): job-0, job-1/);
  assert.match(human, /job-44, devkit-reviews \(devkit-reviews always; job-0, .* reported on the newest pull requests\)/);
  assert.match(human, /job-44/);
});

test('ruleset: the create payload equals design D8 for contexts check, devkit-reviews', () => {
  const w = world({ workflowOnMain: true });
  const rs = w.item(w.run('--json'), 'ruleset');
  assert.equal(rs.state, 'create');
  assert.deepEqual(rs.payload, D8(['check', 'devkit-reviews']));
});

test('ruleset: an existing matching devkit ruleset is ok, whatever GitHub adds to it', () => {
  const w = world({ rulesets: [{ id: 7, name: 'devkit' }, { id: 8, name: 'other' }], existing: stored(['check', 'devkit-reviews']) });
  const rs = w.item(w.run('--json'), 'ruleset');
  assert.equal(rs.state, 'ok');
  assert.equal(rs.payload, undefined);
});

test('ruleset: one missing devkit-reviews is update and keeps its extra contexts', () => {
  const w = world({ workflowOnMain: true, rulesets: [{ id: 7, name: 'devkit' }], existing: stored(['check', 'extra']) });
  const rs = w.item(w.run('--json'), 'ruleset');
  assert.equal(rs.state, 'update');
  assert.deepEqual(rs.payload, D8(['check', 'extra', 'devkit-reviews']));
});

test('ruleset: a weaker existing ruleset (not active, or bypass actors) is update', () => {
  for (const over of [{ enforcement: 'evaluate' }, { bypass_actors: [{ actor_id: 1, actor_type: 'RepositoryRole' }] }]) {
    const w = world({ workflowOnMain: true, rulesets: [{ id: 7, name: 'devkit' }], existing: stored(['check', 'devkit-reviews'], over) });
    assert.equal(w.item(w.run('--json'), 'ruleset').state, 'update', JSON.stringify(over));
  }
});

test('ruleset: deferred until devkit-reviews has reported (on the default branch, or on the current PR)', () => {
  const none = world();
  assert.match(none.item(none.run('--json'), 'ruleset').state, /deferred/);
  const onMain = world({ workflowOnMain: true });
  assert.equal(onMain.item(onMain.run('--json'), 'ruleset').state, 'create');
  assert.ok(onMain.gh.calls().some((c) => c[0] === 'api' && c.some((a) => a.includes('contents/.github/workflows/devkit-reviews.yml?ref=main'))));
  const pr = world({ prChecks: ['check', 'devkit-reviews'] });
  assert.equal(pr.item(pr.run('--json'), 'ruleset').state, 'create');
  const other = world({ prChecks: ['check'] });
  assert.match(other.item(other.run('--json'), 'ruleset').state, /deferred/);
});

test('ruleset applied from a PR: every other open PR is listed before confirming', () => {
  const w = world({ prChecks: ['devkit-reviews'], prList: [{ number: 5, headRefName: 'feat' }, { number: 9, headRefName: 'old-branch' }] });
  const r = w.run();
  assert.match(r.out, /#9 \(old-branch\)/);
  assert.match(r.out, /will wait for devkit-reviews until updated with main after this PR merges/);
  assert.doesNotMatch(r.out, /#5 /, 'the current PR is not listed');
  assert.deepEqual(w.item(w.run('--json'), 'ruleset').otherPrs, [{ number: 9, headRefName: 'old-branch' }]);
  const main = world({ workflowOnMain: true, prList: [{ number: 9, headRefName: 'old-branch' }] });
  assert.doesNotMatch(main.run().out, /#9/, 'with the workflow on the default branch nobody waits');
});

test('workflow: a missing one is written pinned to the commit sha of tag v + the plugin version, tag named in a comment; nothing is committed (security)', () => {
  const w = world();
  const r = w.run('--apply', 'workflow');
  assert.equal(r.code, 0, r.err);
  const file = readFileSync(join(w.root, WORKFLOW_PATH), 'utf8');
  assert.ok(file.includes(`chacal88/devkit/${SHA}/plugins/openspec/hooks`), 'the base URL holds the sha');
  assert.ok(!file.includes(`devkit/v${pluginVersion}/`), 'never the mutable tag in a URL');
  assert.match(file, new RegExp(`#.*v${pluginVersion.replaceAll('.', '\\.')}`), 'a comment names the tag');
  assert.doesNotMatch(file, /\{\{\w+\}\}/);
  assert.deepEqual(w.writes(), [], 'a file write is not a gh write (reading the tag is a GET)');
  assert.ok(w.gh.calls().some((c) => c[0] === 'api' && c.includes(`repos/chacal88/devkit/git/ref/tags/v${pluginVersion}`)));
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: w.root, encoding: 'utf8' }).stdout;
  assert.match(st, /\?\? \.github\//, 'left untracked for the owner to commit');
});

test('workflow: an annotated tag is dereferenced to the commit it points at', () => {
  const w = world({ tag: { stdout: { object: { type: 'tag', sha: TAG_SHA } } } });
  w.gh.set(K.tagObj(TAG_SHA), { stdout: { object: { type: 'commit', sha: SHA } } });
  assert.equal(w.run('--apply', 'workflow').code, 0);
  assert.ok(readFileSync(join(w.root, WORKFLOW_PATH), 'utf8').includes(`/devkit/${SHA}/`));
});

test('workflow: a tag that does not exist yet defers the item naming the tag; nothing is written, no fallback to the tag or a branch (security)', () => {
  const w = world({ tag: { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' } });
  const it = w.item(w.run('--json'), 'workflow');
  assert.equal(it.state, 'deferred');
  assert.match(it.why, new RegExp(`tag v${pluginVersion.replaceAll('.', '\\.')} does not exist`));
  const r = w.run('--apply', 'workflow');
  assert.equal(existsSync(join(w.root, WORKFLOW_PATH)), false);
  assert.equal(r.code, 0, 'a deferred item is not an error');
});

test('workflow: a tag lookup that fails for another reason is an error, not a fallback', () => {
  const w = world({ tag: { exit: 1, stderr: 'gh: connection reset\n' } });
  const it = w.item(w.run('--json'), 'workflow');
  assert.equal(it.state, 'error');
  assert.match(it.why, /connection reset/);
  assert.equal(w.run('--apply', 'workflow').code, 1);
  assert.equal(existsSync(join(w.root, WORKFLOW_PATH)), false);
});

test('workflow: one that runs deliver-check --ci is ok; any other is deferred and never overwritten', () => {
  const ok = world({ workflow: 'template' });
  assert.equal(ok.item(ok.run('--json'), 'workflow').state, 'ok');
  const foreign = world({ workflow: 'foreign' });
  const rw = foreign.item(foreign.run('--json'), 'workflow');
  assert.equal(rw.state, 'deferred');
  assert.match(rw.why, /edit it by hand/);
  foreign.run('--apply', 'workflow');
  assert.equal(readFileSync(join(foreign.root, WORKFLOW_PATH), 'utf8'), 'name: mine\non: push\n');
});

test('--apply auto-merge applies only that item: one PATCH, no other write, no file', () => {
  const w = world({ workflowOnMain: true });
  w.gh.set(K.patch, { stdout: {} });
  w.gh.set(K.repo, { stdout: SETTINGS_OFF }, 1);
  w.gh.set(K.repo, { stdout: { ...SETTINGS_OFF, allow_auto_merge: true } }, 2);
  const r = w.run('--apply', 'auto-merge');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(w.writes(), [['api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'allow_auto_merge=true']]);
  assert.equal(existsSync(join(w.root, WORKFLOW_PATH)), false);
  assert.match(r.out, /^auto-merge\s+ok/m, 're-read after the apply');
  assert.match(r.out, /^delete-branch\s+update/m, 'the unnamed item is untouched');
});

test('--apply auto-merge also turns on the merge method when it is off; --method picks it', () => {
  const w = world({ settings: { ...SETTINGS_OFF, allow_auto_merge: true, allow_rebase_merge: false } });
  w.gh.set(K.patch, { stdout: {} });
  w.run('--method', 'rebase', '--apply', 'auto-merge');
  assert.deepEqual(w.writes(), [['api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'allow_rebase_merge=true']]);
});

test('--apply delete-branch, ruleset create (POST, payload on stdin) and ruleset update (PUT)', () => {
  const del = world();
  del.gh.set(K.patch, { stdout: {} });
  del.run('--apply', 'delete-branch');
  assert.deepEqual(del.writes(), [['api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'delete_branch_on_merge=true']]);

  const create = world({ workflowOnMain: true });
  create.gh.set(K.post, { stdout: {} });
  create.run('--apply', 'ruleset');
  assert.deepEqual(create.writes(), [['api', '-X', 'POST', 'repos/{owner}/{repo}/rulesets', '--input', '-']]);
  assert.deepEqual(create.sent(), D8(['check', 'devkit-reviews']));

  const update = world({ workflowOnMain: true, rulesets: [{ id: 7, name: 'devkit' }], existing: stored(['check', 'extra']) });
  update.gh.set(K.put(7), { stdout: {} });
  update.run('--apply', 'ruleset');
  assert.deepEqual(update.writes(), [['api', '-X', 'PUT', 'repos/{owner}/{repo}/rulesets/7', '--input', '-']]);
  assert.deepEqual(update.sent(), D8(['check', 'extra', 'devkit-reviews']));
});

test('--apply on a deferred ruleset applies nothing', () => {
  const w = world();
  const r = w.run('--apply', 'ruleset');
  assert.deepEqual(w.writes(), []);
  assert.match(r.out, /^ruleset\s+deferred/m);
});

test('a second --apply run is all ok with no -X call (AC-7 idempotent)', () => {
  const w = world({
    settings: SETTINGS_ON, workflow: 'template', workflowOnMain: true,
    rulesets: [{ id: 7, name: 'devkit' }], existing: stored(['check', 'devkit-reviews']),
  });
  const r = w.run('--apply', 'workflow,auto-merge,delete-branch,ruleset', '--json');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.json().items.map((i) => i.state), ['ok', 'ok', 'ok', 'ok']);
  assert.deepEqual(w.writes(), []);
});

test('a write error is reported per item and exits 1; the other items still run', () => {
  const w = world({ workflowOnMain: true });
  w.gh.set(K.patch, { exit: 1, stderr: 'gh: Must have admin rights to Repository. (HTTP 403)\n' });
  w.gh.set(K.post, { stdout: {} });
  const r = w.run('--apply', 'auto-merge,ruleset', '--json');
  assert.equal(r.code, 1);
  const j = r.json();
  const am = j.items.find((i) => i.item === 'auto-merge');
  assert.equal(am.state, 'error');
  assert.match(am.why, /Must have admin rights/);
  assert.deepEqual(j.applied, ['ruleset']);
});

test('a read error is reported, not applied over: gh missing the repository settings exits 1', () => {
  const w = world();
  w.gh.set(K.repo, { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' });
  const r = w.run('--apply', 'auto-merge');
  assert.equal(r.code, 1);
  assert.match(r.out + r.err, /cannot read the repository settings: gh: Not Found/);
  assert.deepEqual(w.writes(), []);
});

test('usage: an unknown --apply item or --method exits 2 and touches nothing', () => {
  const w = world();
  for (const args of [['--apply', 'everything'], ['--method', 'fast'], ['--bogus']]) {
    const r = w.run(...args);
    assert.equal(r.code, 2, args.join(' '));
  }
  assert.deepEqual(w.gh.calls(), []);
});

// ---------------------------------------------------------------- the skill step (design D8, AC-7)

const skillDir = join(here, '..');
test('format: openspec-setup has the GitHub step: script path that resolves, one confirmation per item, nothing applied unconfirmed (AC-7)', () => {
  const md = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(md, /GitHub \(merge mode\)/);
  assert.ok(md.includes('scripts/github-setup.mjs'), 'names the script');
  assert.ok(existsSync(join(skillDir, 'scripts', 'github-setup.mjs')), 'the path resolves from the skill directory');
  assert.match(md, /one question per item/i);
  assert.match(md, /--apply <confirmed items>/);
  assert.match(md, /plan again|re-run the plan|run the plan again/i);
  assert.match(md, /owner-push|refuse direct pushes/i);
  assert.match(md, /deferred/);
  assert.match(md, /`ship` and `merge_method`[^\n]*only if the owner asks/i);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Change GitHub settings without the owner's confirmation of that item/);
});

test('format: the config template says who merges per mode and shows a commented ship / merge_method example', () => {
  const yml = readFileSync(join(skillDir, 'templates', 'config.yaml'), 'utf8');
  assert.match(yml, /^# ship:\n#   devkit-lite: merge/m);
  assert.match(yml, /^# merge_method: squash/m);
  assert.match(yml, /merge is the owner's in `plan` and `pr` mode, GitHub's in `merge` mode/);
  assert.doesNotMatch(yml, /^ship:/m, 'only a comment: the key is the owner\'s choice');
});

// ---------------------------------------------------------------- field-fixes 5: what the plan names, which checks it proposes

const NO_STEP = { stdout: { jobs: [{ steps: [{ name: 'Set up job' }] }] } };
const STEP_RAN = { stdout: { jobs: [{ steps: [{ name: 'Set up job', started_at: '2026-11-20T10:00:00Z' }] }] } };
const FAILED_RUNS = { stdout: { workflow_runs: [{ id: 11, conclusion: 'failure' }, { id: 12, conclusion: 'failure' }] } };
const repoCheck = (r, name) => r.json().repository.find((c) => c.check === name);

test('field-fixes 5 actions: Actions disabled for the repository is blocked, names where to enable it and exits 1', () => {
  const w = world({ actions: { stdout: { enabled: false } } });
  const r = w.run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^actions\s+blocked\s+GitHub Actions is disabled for this repository: no check runs, devkit-reviews included; enable it in Settings > Actions > General$/m);
  assert.deepEqual(w.writes(), []);
  assert.equal(repoCheck(w.run('--json'), 'actions').state, 'blocked');
});

test('field-fixes 5 actions: Actions permissions that cannot be read are unknown, never blocked, and the exit code stays 0', () => {
  const w = world({ actions: { exit: 1, stderr: 'gh: Must have admin rights to Repository. (HTTP 403)\n' } });
  const r = w.run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^actions\s+unknown\s+cannot read whether GitHub Actions is enabled: gh: Must have admin rights/m);
  assert.equal(repoCheck(w.run('--json'), 'actions').state, 'unknown');
});

test('field-fixes 5 actions: Actions enabled is ok', () => {
  const w = world();
  assert.equal(repoCheck(w.run('--json'), 'actions').state, 'ok');
  assert.equal(w.run().code, 0);
});

test('field-fixes 5 runs: the newest runs all failed without a job starting a step is blocked, naming billing as one possible cause', () => {
  const w = world({ actionRuns: FAILED_RUNS, jobs: { 11: NO_STEP, 12: NO_STEP } });
  const r = w.run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^runs\s+blocked\s+the newest runs failed without starting \(no job ran a step\); one possible cause is GitHub Actions billing \(a failed payment or a spending limit\): check Settings > Billing and plans; the repository's API does not say which$/m);
  assert.deepEqual(w.writes(), []);
});

test('field-fixes 5 runs: a failed run whose job started a step is ok, and so is a run that succeeded', () => {
  const started = world({ actionRuns: FAILED_RUNS, jobs: { 11: NO_STEP, 12: STEP_RAN } });
  assert.equal(repoCheck(started.run('--json'), 'runs').state, 'ok');
  assert.equal(started.run().code, 0);
  const passed = world({ actionRuns: { stdout: { workflow_runs: [{ id: 11, conclusion: 'success' }] } } });
  assert.equal(repoCheck(passed.run('--json'), 'runs').state, 'ok');
  assert.equal(repoCheck(world().run('--json'), 'runs').state, 'ok', 'no completed run at all is not blocked');
});

test('field-fixes 5 runs: runs or jobs that cannot be read are unknown, never blocked, and the exit code stays 0', () => {
  const runs = world({ actionRuns: { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' } });
  const r = runs.run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^runs\s+unknown\s+cannot read the newest workflow runs: gh: Not Found/m);
  const jobs = world({ actionRuns: FAILED_RUNS, jobs: { 11: { exit: 1, stderr: 'gh: boom\n' }, 12: NO_STEP } });
  assert.equal(repoCheck(jobs.run('--json'), 'runs').state, 'unknown');
  assert.equal(jobs.run().code, 0);
});

const REFUSED = { exit: 1, stderr: 'gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)\n' };

test('field-fixes 5 rulesets: a 403 naming the plan blocks the ruleset with the line, defers auto-merge and exits 1', () => {
  const w = world({ workflowOnMain: true });
  w.gh.set(K.rulesets, REFUSED);
  const r = w.run();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /^ruleset\s+blocked\s+GitHub refuses rulesets for this repository's plan \(gh: Upgrade to GitHub Pro or make this repository public to enable this feature\. \(HTTP 403\)\): make the repository public, or move it to a plan with rulesets; merge mode needs the ruleset \(ADR 0002\), so auto-merge is not applied either$/m);
  assert.match(r.out, /^auto-merge\s+deferred\s+the ruleset is refused; merge mode needs it \(ADR 0002\)$/m);
  assert.deepEqual(w.writes(), []);
});

test('field-fixes 5 rulesets: a read failure that is not about the plan stays an error', () => {
  const w = world({ workflowOnMain: true });
  w.gh.set(K.rulesets, { exit: 1, stderr: 'gh: Must have admin rights to Repository. (HTTP 403)\n' });
  const j = w.run('--json').json();
  assert.ok(Array.isArray(j.repository), 'the repository checks are part of the result');
  assert.equal(j.items.find((i) => i.item === 'ruleset').state, 'error');
  assert.equal(j.items.find((i) => i.item === 'auto-merge').state, 'update', 'auto-merge is not deferred by another error');
  assert.equal(w.run().code, 1);
});

test('field-fixes 5 rulesets: --apply with the rulesets refused writes no ruleset and no auto-merge, and applies the workflow and delete-branch', () => {
  const w = world({ workflowOnMain: true });
  w.gh.set(K.rulesets, REFUSED);
  w.gh.set(K.patch, { stdout: {} });
  const r = w.run('--apply', 'workflow,auto-merge,delete-branch,ruleset', '--json');
  const j = r.json();
  assert.deepEqual(j.applied, ['workflow', 'delete-branch']);
  assert.deepEqual(w.writes(), [['api', '-X', 'PATCH', 'repos/{owner}/{repo}', '-F', 'delete_branch_on_merge=true']]);
  assert.ok(existsSync(join(w.root, WORKFLOW_PATH)), 'the workflow is written');
  assert.match(j.items.find((i) => i.item === 'auto-merge').why, /the ruleset is refused/);
  assert.match(j.items.find((i) => i.item === 'ruleset').why, /GitHub refuses rulesets/);
  assert.equal(r.code, 1, 'the blocked ruleset still exits 1');
});

test('field-fixes 5 checks: the proposed checks are the ones reported on pull request heads, never a job that runs only on the default branch', () => {
  const w = world({ heads: [{ oid: HEAD1, names: ['test', 'devkit-reviews'] }, { oid: HEAD2, names: ['test', 'lint'] }], workflowOnMain: true });
  w.gh.set(K.runs, { stdout: 'test\npublish\n' });
  const j = w.run('--json').json();
  assert.deepEqual(j.contexts, ['test', 'lint']);
  assert.ok(!j.contexts.includes('publish'));
  assert.deepEqual(j.items.find((i) => i.item === 'ruleset').payload, D8(['test', 'lint', 'devkit-reviews']));
  assert.ok(!w.gh.calls().some((c) => c.some((a) => a.includes('commits/main/check-runs'))), 'the default branch checks are not read');
  const list = w.gh.calls().find((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('all'));
  assert.deepEqual([list[list.indexOf('--limit') + 1], list[list.indexOf('--json') + 1]], ['5', 'number,headRefOid']);
  for (const oid of [HEAD1, HEAD2]) assert.ok(w.gh.calls().some((c) => c.includes('--paginate') && c.some((a) => a.includes(`commits/${oid}/check-runs`))), oid);
  assert.match(w.run().out, /^the ruleset will require these checks \(confirm them, or pass --checks\): test, lint, devkit-reviews \(devkit-reviews always; test, lint reported on the newest pull requests\)$/m);
});

test('field-fixes 5 checks: with no pull request check reported the list is empty and the plan says to pass --checks', () => {
  const w = world({ heads: [] });
  assert.deepEqual(w.run('--json').json().contexts, []);
  assert.match(w.run().out, /no other check reported on the newest pull requests yet; pass --checks to add one/);
  const bare = world({ heads: [{ oid: HEAD1, names: [] }] });
  assert.deepEqual(bare.run('--json').json().contexts, []);
});

test('field-fixes 5 checks: --checks still replaces the proposed list and reads no pull request', () => {
  const w = world();
  assert.deepEqual(w.run('--json', '--checks', 'ci').json().contexts, ['ci']);
  assert.deepEqual(w.run('--json', '--checks', 'ci').json().repository.map((c) => c.check), ['actions', 'runs']);
  assert.ok(!w.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('all')));
});

test('field-fixes 5 nothing written: no gh api -X call and no file in any blocked or unknown state', () => {
  const w = world({ actions: { stdout: { enabled: false } }, actionRuns: FAILED_RUNS, jobs: { 11: NO_STEP, 12: NO_STEP } });
  w.gh.set(K.rulesets, REFUSED);
  const r = w.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /^actions\s+blocked/m);
  assert.match(r.out, /^runs\s+blocked/m);
  assert.match(r.out, /^ruleset\s+blocked/m);
  assert.deepEqual(w.writes(), []);
  assert.equal(existsSync(join(w.root, WORKFLOW_PATH)), false);
});

test('field-fixes 5 skill: step 7 names the repository states, that billing is only a possible cause, and that a blocked ruleset means merge mode is not available', () => {
  const md = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const step = md.slice(md.indexOf('GitHub (merge mode)'));
  assert.match(step, /`blocked`/);
  assert.match(step, /`unknown`/);
  assert.match(step, /billing[^\n]*(possible cause|cannot be read)|(possible cause|cannot be read)[^\n]*billing/i);
  assert.match(step, /`merge` mode is not available/);
});

const LINE = 'the ruleset will require these checks (confirm them, or pass --checks): ';
const requiresLine = (out) => out.split('\n').find((l) => l.startsWith('the ruleset will require these checks'));

test('field-fixes 11 setup: --checks "" with no ruleset lists devkit-reviews, says it is always required and holds no none', () => {
  const w = world();
  const line = requiresLine(w.run('--checks', '').out);
  assert.equal(line, `${LINE}devkit-reviews (devkit-reviews always; no other check given with --checks)`);
  assert.doesNotMatch(line, /none/);
  const j = w.run('--json', '--checks', '').json();
  assert.deepEqual(j.requires, ['devkit-reviews']);
  assert.equal(j.checksFrom, 'option');
  assert.deepEqual(j.contexts, []);
});

test('field-fixes 11 setup: checks found on the newest pull requests are listed with devkit-reviews and labelled', () => {
  const w = world({ runs: ['test', 'lint'] });
  assert.equal(requiresLine(w.run().out), `${LINE}test, lint, devkit-reviews (devkit-reviews always; test, lint reported on the newest pull requests)`);
  const j = w.run('--json').json();
  assert.deepEqual(j.requires, ['test', 'lint', 'devkit-reviews']);
  assert.equal(j.checksFrom, 'pull-requests');
  assert.deepEqual(j.contexts, ['test', 'lint']);
});

test('field-fixes 11 setup: no check reported lists devkit-reviews and says to pass --checks', () => {
  const w = world({ heads: [] });
  assert.equal(requiresLine(w.run().out), `${LINE}devkit-reviews (devkit-reviews always; no other check reported on the newest pull requests yet; pass --checks to add one)`);
  assert.deepEqual(w.run('--json').json().requires, ['devkit-reviews']);
});

test('field-fixes 11 setup: a check the stored ruleset requires is kept, listed and labelled', () => {
  const w = world({ rulesets: [{ id: 7, name: 'devkit' }], existing: stored(['e2e']), workflowOnMain: true });
  assert.equal(requiresLine(w.run('--checks', 'test').out), `${LINE}e2e, test, devkit-reviews (devkit-reviews always; test given with --checks; e2e already required by ruleset devkit)`);
  const j = w.run('--json', '--checks', 'test').json();
  assert.deepEqual(j.requires, ['e2e', 'test', 'devkit-reviews']);
  assert.deepEqual(j.contexts, ['test']);
  assert.deepEqual(j.items.find((i) => i.item === 'ruleset').payload, D8(['e2e', 'test', 'devkit-reviews']));
});

test('field-fixes 11 setup: with the newest pull requests unreadable the line says so, and checksFrom is unreadable', () => {
  const w = world();
  w.gh.set(K.prsAll, { exit: 1, stderr: 'gh: Bad gateway (HTTP 502)\n' });
  const line = requiresLine(w.run().out);
  assert.match(line, /: devkit-reviews \(devkit-reviews always; the newest pull requests could not be read\)/);
  assert.doesNotMatch(line, /reported on the newest pull requests/);
  assert.doesNotMatch(line, /given with --checks/);
  const j = w.run('--json').json();
  assert.equal(j.checksFrom, 'unreadable');
  assert.deepEqual(j.requires, ['devkit-reviews']);
});

test('field-fixes 11 setup: with the rulesets refused the line still lists devkit-reviews, and requires equals the printed list', () => {
  const w = world();
  w.gh.set(K.rulesets, REFUSED);
  const line = requiresLine(w.run().out);
  assert.match(line, /: check, devkit-reviews \(/);
  const j = w.run('--json').json();
  assert.deepEqual(j.requires, ['check', 'devkit-reviews']);
  assert.deepEqual(j.contexts, ['check']);
  assert.equal(j.items.find((i) => i.item === 'ruleset').requires, undefined, 'items[3] keeps today\'s fields');
});
