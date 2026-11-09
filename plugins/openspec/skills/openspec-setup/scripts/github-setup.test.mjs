// Tests for github-setup.mjs (auto-merge, design D8). Imported by hooks/guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { desiredRuleset, WORKFLOW_PATH, DEVKIT_REVIEWS_CHECK } from '../../../hooks/merge-setup.mjs';
import { fakeGh, gitRepo, put } from '../../../hooks/deliver-check.test.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'github-setup.mjs');
const pluginVersion = JSON.parse(readFileSync(join(here, '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;

const K = {
  repo: 'api-GET-repos__owner___repo_',
  rulesets: 'api-GET-repos__owner___repo__rulesets',
  ruleset: (id) => `api-GET-repos__owner___repo__rulesets_${id}`,
  runs: 'api-GET-repos__owner___repo__commits_main_check-runs',
  contents: 'api-GET-repos__owner___repo__contents_.github_workflows_devkit-reviews.yml_ref=main',
  patch: 'api-PATCH-repos__owner___repo_',
  post: 'api-POST-repos__owner___repo__rulesets',
  put: (id) => `api-PUT-repos__owner___repo__rulesets_${id}`,
};
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
function world({ settings = SETTINGS_OFF, runs = ['check'], rulesets = [], existing = null, workflow = 'missing', workflowOnMain = false, prChecks = null, prList = [], branch = 'feat' } = {}) {
  const root = gitRepo({ branch });
  const gh = fakeGh();
  if (workflow === 'template') put(root, { [WORKFLOW_PATH]: 'on: pull_request\njobs:\n  devkit-reviews:\n    steps:\n      - run: node plugins/openspec/hooks/deliver-check.mjs --ci\n' });
  if (workflow === 'foreign') put(root, { [WORKFLOW_PATH]: 'name: mine\non: push\n' });
  gh.set(K.repo, { stdout: settings });
  gh.set(K.runs, { stdout: runs });
  gh.set(K.rulesets, { stdout: rulesets });
  if (existing) gh.set(K.ruleset(existing.id ?? 7), { stdout: existing });
  if (workflowOnMain) gh.set(K.contents, { stdout: { name: 'devkit-reviews.yml' } });
  if (prChecks) gh.set('pr-checks', { stdout: prChecks.map((name) => ({ name })) });
  gh.set('pr-list', { stdout: prList });
  // a wrapper that keeps what is piped to `--input -`, then runs the fake gh
  const wrap = mkdtempSync(join(tmpdir(), 'devkit-ghwrap-'));
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

test('plan: contexts come from the default branch check-runs without devkit-reviews; --checks replaces them', () => {
  const w = world({ runs: ['check', 'devkit-reviews', 'lint'], workflowOnMain: true });
  const j = w.run('--json').json();
  assert.deepEqual(j.contexts, ['check', 'lint']);
  assert.deepEqual(w.item(w.run('--json'), 'ruleset').payload, D8(['check', 'lint', 'devkit-reviews']));
  const k = w.run('--json', '--checks', 'ci,build').json();
  assert.deepEqual(k.contexts, ['ci', 'build']);
  assert.deepEqual(k.items.find((i) => i.item === 'ruleset').payload, D8(['ci', 'build', 'devkit-reviews']));
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

test('workflow: a missing one is written with {{ref}} = v + the plugin version; nothing is committed', () => {
  const w = world();
  const r = w.run('--apply', 'workflow');
  assert.equal(r.code, 0, r.err);
  const file = readFileSync(join(w.root, WORKFLOW_PATH), 'utf8');
  assert.ok(file.includes(`chacal88/devkit/v${pluginVersion}/plugins/openspec/hooks`));
  assert.doesNotMatch(file, /\{\{ref\}\}/);
  assert.deepEqual(w.writes(), [], 'a file write is not a gh write');
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: w.root, encoding: 'utf8' }).stdout;
  assert.match(st, /\?\? \.github\//, 'left untracked for the owner to commit');
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
