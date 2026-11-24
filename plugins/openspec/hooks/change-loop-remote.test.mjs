// node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-remote.test.mjs
// change-coordinator, part 3 of 3 (suite-speed D-11; the others are change-loop.test.mjs and change-loop-compozy.test.mjs): the remote worker's claim and place, the Jira entry and its write-back, the token budget, change-state, commit attribution and the held state of the upfront sessions. What the three parts share is in change-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { hostname } from 'node:os';
import { tmpFolder } from './test-tmp.mjs';
import { spawnSync, spawn } from 'node:child_process';
import {
  gitRepo, put, commitAll, git, sandbox, readCounter, roundRepo, SET_LOOP as SET, cleanEnvLoop as cleanEnv, FLOWS, stageOf, nextOf, endOf, reportOf,
  rowOf, run, PLAN_FILES, head, planChange, actionOf, SESSION, stored, typedLine, toolResultLine, runLine, assistantLine, transcriptOf, stopInput,
} from './test-fixtures.mjs';
import * as guardModule from './guard.mjs';
import * as changeLoopModule from './change-loop.mjs';
import { readDevkitSettings, MESSAGES, render, main, LoopUsageError, waitLoop, openChange, nextAction } from './change-loop.mjs';
import {
  LOOP, TDD, COMMIT, PLANNER, configRepo, shape, says, buildRep, build, next, parsed, PROPOSAL, check, deliveredChange, startRun, body, whereNext,
  snapshot, addChange, devkitRepo, openRun, freshProject, wtOf, WAIT, waited, skillBodyLine, hook, PLAN_UP_TO_TASKS, approvedChange, REPO_ROOT,
  readRepo, skillText, LANG_FLAG, section, IDENT,
} from './change-loop-fixtures.mjs';

// ---------------------------------------------------------------- remote-worker: the claim at open (phase 1)
for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

// The "other machine": a second clone of the same bare remote.
function otherClone(t) {
  const dir = tmpFolder('devkit-change-loop-machine-');
  const clone = join(dir, 'clone');
  git(dir, 'clone', '-q', t.originDir, clone);
  mkdirSync(join(clone, 'openspec', 'changes', 'archive'), { recursive: true }); // git keeps no empty folder: the project's change folder
  return realpathSync(clone);
}
const openOn = (cwd, id, machine, extra = {}) => openChange(cwd, id, { script: 'devkit', why: 'doubt', request: 'Add a thing\n', lang: 'en', env: cleanEnv, machine, ...extra });
const claimOnOrigin = (t, id) => git(t.main, 'ls-remote', 'origin', `refs/heads/${id}`).split('\t')[0];
const localHostname = () => hostname().split('.')[0].replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 64) || 'machine';
const yamlOf = (wt, id) => readFileSync(join(wt, 'openspec', 'changes', id, '.openspec.yaml'), 'utf8');
// What an open that is refused leaves: nothing local (the remote-tracking refs may have moved with the fetch).
const localLeft = (t, id) => ({
  folders: existsSync(join(t.main, 'openspec', 'changes', id)) || existsSync(join(wtOf(t, id), 'openspec')),
  wt: existsSync(wtOf(t, id)),
  branch: git(t.main, 'branch', '--list', id),
  worktrees: git(t.main, 'worktree', 'list', '--porcelain'),
});
const refusal = (e) => e?.name === 'LoopRefusal';

test('remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing', () => {
  const t = freshProject();
  const clone = otherClone(t);
  openOn(clone, 'shared-thing', 'avel');
  git(t.main, 'fetch', '-q', 'origin');
  const before = localLeft(t, 'shared-thing');
  const snap = snapshot(t.main);
  const r = openRun(t.main, 'shared-thing');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  assert.equal(body(r).reply, render('en', 'claimed', { id: 'shared-thing', machine: 'avel' }));
  assert.match(body(r).reply, /avel/);
  assert.equal(snapshot(t.main), snap, 'nothing was created: branches, worktrees and folders are as they were');
  assert.deepEqual(localLeft(t, 'shared-thing'), before);
  assert.equal(git(t.main, 'branch', '--list', 'shared-thing'), '', 'no refs/heads/shared-thing');
  assert.equal(body(openRun(t.main, 'shared-thing', { lang: 'pt-BR' })).reply, render('pt-BR', 'claimed', { id: 'shared-thing', machine: 'avel' }));
});

test('remote AC-1 open: a claim with no machine says another machine', () => {
  const t = freshProject();
  const clone = otherClone(t);
  git(clone, 'checkout', '-q', '-b', 'old-claim');
  put(clone, { 'openspec/changes/old-claim/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/old-claim/requirements.md': 'x\n' });
  commitAll(clone, 'a branch from before the claim');
  git(clone, 'push', '-q', 'origin', 'old-claim');
  git(t.main, 'fetch', '-q', 'origin');
  const snap = snapshot(t.main);
  const r = openRun(t.main, 'old-claim');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(body(r).reply, render('en', 'claimed-elsewhere', { id: 'old-claim' }));
  assert.match(body(r).reply, /another machine/);
  assert.equal(snapshot(t.main), snap);
  assert.equal(git(t.main, 'branch', '--list', 'old-claim'), '');
});

test('remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset', () => {
  const t = freshProject();
  const r = openRun(t.main, 'claim-me', { script: 'devkit-lite', why: 'small' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const wt = wtOf(t, 'claim-me');
  const sha = claimOnOrigin(t, 'claim-me');
  assert.match(sha, /^[0-9a-f]{40}$/, 'origin has the branch');
  assert.equal(git(wt, 'rev-parse', 'HEAD'), sha, 'the local branch is the claim');
  assert.equal(git(wt, 'log', '-1', '--format=%s'), 'chore(openspec): open claim-me');
  const files = git(wt, 'show', '--name-only', '--format=', 'HEAD').split('\n');
  assert.ok(files.includes('openspec/changes/claim-me/requirements.md'), files.join());
  assert.ok(files.includes('openspec/changes/claim-me/.openspec.yaml'), files.join());
  assert.match(git(t.main, 'show', `${sha}:openspec/changes/claim-me/.openspec.yaml`), new RegExp(`^x-devkit-machine: ${localHostname()}$`, 'm'));
  assert.equal(/x-devkit-places/.test(yamlOf(wt, 'claim-me')), false, 'no places without a roadmap run');
  assert.match(yamlOf(wt, 'claim-me'), /^schema: devkit-lite$/m);
  assert.equal(git(wt, 'status', '--porcelain'), '', 'the claim left nothing uncommitted');
});

test('remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch', () => {
  const t = freshProject();
  const r = openRun(t.main, 'for-avel', { args: ['--script', 'devkit', '--why', 'doubt', '--machine', 'avel', '--places', '2', '--remote'] });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const b = JSON.parse(r.stdout.split('\n').slice(1).join('\n'));
  assert.equal(b.worktree, null);
  assert.equal(b.reply, render('en', 'opened-on', { id: 'for-avel', machine: 'avel', script: 'devkit', why: 'doubt' }));
  const sha = claimOnOrigin(t, 'for-avel');
  assert.match(sha, /^[0-9a-f]{40}$/);
  const yaml = git(t.main, 'show', `${sha}:openspec/changes/for-avel/.openspec.yaml`);
  assert.match(yaml, /^x-devkit-machine: avel$/m);
  assert.match(yaml, /^x-devkit-places: 2$/m);
  assert.equal(git(t.main, 'show', `${sha}:openspec/changes/for-avel/requirements.md`).includes('> Add a CSV export'), true);
  assert.equal(git(t.main, 'branch', '--list', 'for-avel'), '');
  assert.equal(existsSync(wtOf(t, 'for-avel')), false);
  assert.equal(git(t.main, 'worktree', 'list', '--porcelain').includes('for-avel'), false);
  assert.equal(existsSync(join(t.main, 'openspec', 'changes', 'for-avel')), false);
});

test('remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing', () => {
  const t = freshProject();
  const base = ['--script', 'devkit', '--why', 'doubt'];
  const cases = {
    'a name starting with a dash': ['--machine', '-avel'],
    'a name with a space': ['--machine', 'my mac'],
    'a name of 65 characters': ['--machine', 'a'.repeat(65)],
    'places 0': ['--machine', 'avel', '--places', '0'],
    'places 100': ['--machine', 'avel', '--places', '100'],
    'places 1.5': ['--machine', 'avel', '--places', '1.5'],
    'places a word': ['--machine', 'avel', '--places', 'two'],
    'a remote open with no machine': ['--remote'],
  };
  const snap = snapshot(t.main);
  for (const [label, extra] of Object.entries(cases)) {
    const r = openRun(t.main, 'bad-claim', { args: [...base, ...extra] });
    assert.equal(r.code, 3, `${label}: ${r.stdout}`);
    assert.equal(r.stdout.startsWith('devkit-run:'), false, label);
    assert.equal(body(r).reply, render('en', 'request-unreadable'), label);
    assert.equal(snapshot(t.main), snap, `${label}: no worktree, folder or branch`);
    assert.equal(claimOnOrigin(t, 'bad-claim'), '', `${label}: nothing pushed`);
  }
  assert.equal(openRun(t.main, 'good-claim', { args: [...base, '--machine', 'a'.repeat(64), '--places', 'run'] }).code, 0, '64 characters and places run are valid');
});

test('remote AC-3 open: the clone that pushes second is refused and leaves nothing', () => {
  const t = freshProject();
  const clone = otherClone(t);
  let winner;
  let refused = null;
  try { openOn(t.main, 'race-id', 'mac', { beforePush: () => { winner = openOn(clone, 'race-id', 'avel'); } }); } catch (e) { refused = e; }
  assert.ok(winner, 'the other clone opened between the check and the push');
  assert.ok(refusal(refused), `the second push is refused: ${refused}`);
  assert.equal(refused.reply, render('en', 'claimed', { id: 'race-id', machine: 'avel' }));
  assert.equal(claimOnOrigin(t, 'race-id'), git(winner.worktree, 'rev-parse', 'HEAD'), 'origin holds the winner\'s claim');
  const left = localLeft(t, 'race-id');
  assert.deepEqual([left.folders, left.wt, left.branch, left.worktrees.includes('race-id')], [false, false, '', false], 'nothing is left here');
});

const openChildOn = (cwd, id, machine) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'open', id, '--script', 'devkit', '--why', 'doubt', '--lang', 'en', '--machine', machine], { cwd, env: { ...cleanEnv, ...IDENT }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  child.stdin.end('Add a thing\n');
});

test('remote AC-3 open: two clones opening one id at once, exactly one wins', async () => {
  const t = freshProject();
  const clone = otherClone(t);
  const [a, b] = await Promise.all([openChildOn(t.main, 'same-moment', 'mac'), openChildOn(clone, 'same-moment', 'avel')]);
  assert.deepEqual([a.code, b.code].sort(), [0, 3], `${a.stdout}\n${b.stdout}`);
  const [win, lose, winRoot, loseRoot, winName, loseName] = a.code === 0 ? [a, b, t.main, clone, 'mac', 'avel'] : [b, a, clone, t.main, 'avel', 'mac'];
  assert.equal(JSON.parse(lose.stdout).reply, render('en', 'claimed', { id: 'same-moment', machine: winName }), loseName);
  const sha = claimOnOrigin(t, 'same-moment');
  assert.equal(git(join(winRoot, '.claude', 'worktrees', 'same-moment'), 'rev-parse', 'HEAD'), sha, 'origin holds the winner\'s commit');
  assert.equal(win.code, 0);
  assert.equal(existsSync(join(loseRoot, '.claude', 'worktrees', 'same-moment')), false);
  assert.equal(existsSync(join(loseRoot, 'openspec', 'changes', 'same-moment')), false);
  assert.equal(git(loseRoot, 'branch', '--list', 'same-moment'), '');
});

test('remote AC-4 open: with no origin nothing is committed or pushed', () => {
  const root = devkitRepo();
  const before = git(root, 'rev-parse', 'HEAD');
  assert.equal(git(root, 'remote'), '');
  const r = openRun(root, 'no-origin', { script: 'devkit' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const wt = join(root, '.claude', 'worktrees', 'no-origin');
  assert.equal(git(wt, 'rev-parse', 'HEAD'), before, 'no commit was made');
  assert.equal(git(wt, 'rev-list', '--count', 'HEAD'), git(root, 'rev-list', '--count', 'main'));
  assert.match(git(wt, 'status', '--porcelain'), /openspec\/changes/, 'the folder is left uncommitted, as before');
  assert.equal(/x-devkit-(machine|places)/.test(yamlOf(wt, 'no-origin')), false);
  assert.ok(existsSync(join(wt, 'openspec', 'changes', 'no-origin', 'requirements.md')));
  const named = openRun(root, 'no-origin-named', { args: ['--script', 'devkit', '--why', 'doubt', '--machine', 'avel', '--places', '2'] });
  assert.equal(named.code, 0, named.stdout + named.stderr);
  const namedWt = join(root, '.claude', 'worktrees', 'no-origin-named');
  assert.equal(git(namedWt, 'rev-parse', 'HEAD'), before, 'a machine name with no origin commits nothing either');
  assert.equal(/x-devkit-(machine|places)/.test(yamlOf(namedWt, 'no-origin-named')), false, 'and writes no claim key');
});

test('remote locks claims: the claims of a stale clone cost at most 8 gh calls, and none for the default branch', () => {
  const t = freshProject();
  const clone = otherClone(t);
  const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  for (const id of ids) openOn(clone, id, 'avel');
  put(clone, { 'NEWS.md': 'news\n' });
  commitAll(clone, 'news on origin');
  git(clone, 'push', '-q', 'origin', 'main');
  const mainSha = git(clone, 'rev-parse', 'HEAD');
  assert.equal(git(t.main, 'ls-remote', '--heads', 'origin').split('\n').length, 7, 'six claims and main are on origin');
  assert.equal(git(t.main, 'branch', '--list', '--remotes', 'origin/c*'), '', 'this clone has not fetched them');

  const calls = [];
  const gh = (args, opts = {}) => {
    const route = args[1] ?? '';
    calls.push({ route, opts });
    if (/changes\/c\d\?/.test(route)) return { status: 0, stdout: JSON.stringify([{ name: '.openspec.yaml' }, { name: 'requirements.md' }]), stderr: '' };
    if (/changes\/c\d\/\.openspec\.yaml/.test(route)) return { status: 0, stdout: JSON.stringify({ encoding: 'base64', content: Buffer.from('schema: devkit\nx-devkit-machine: avel\n').toString('base64') }), stderr: '' };
    return { status: 1, stdout: '', stderr: 'not found' };
  };
  const result = changeLoopModule.remoteClaims(t.main, { env: cleanEnv, gh });
  assert.equal(result.readable, true);
  const claimCalls = calls.filter((c) => /changes\/c\d/.test(c.route));
  assert.ok(claimCalls.length >= 1 && claimCalls.length <= 8, `${claimCalls.length} gh calls`);
  assert.equal(calls.some((c) => c.route.includes(mainSha) || /changes\/main/.test(c.route)), false, 'the default branch is never read through gh');
  assert.ok(claimCalls.every((c) => c.opts.timeout === 4000), 'every call has its own timeout');
  assert.deepEqual([...result.claims.keys()].sort(), ids);
  assert.deepEqual(ids.slice(0, 4).map((id) => result.claims.get(id).machine), ['avel', 'avel', 'avel', 'avel'], 'the first four are read');
  assert.deepEqual(ids.slice(4).map((id) => result.claims.get(id).machine), [null, null], 'a branch the budget left unread reads as no claim');
});

test('remote locks claims: a listing with approval.md and a .openspec.yaml with places reads as placed with machine and places', () => {
  const t = freshProject();
  const clone = otherClone(t);
  openOn(clone, 'p1', 'avel');
  openOn(clone, 'p2', 'avel');
  openOn(clone, 'p3', 'avel');
  const yamls = {
    p1: 'schema: devkit\nx-devkit-machine: avel\nx-devkit-places: 2\n',
    p2: 'schema: devkit\nx-devkit-machine: avel\nx-devkit-places: run\n',
    p3: 'schema: devkit\nx-devkit-machine: avel\n',
  };
  const listing = { p1: ['.openspec.yaml', 'approval.md'], p2: ['.openspec.yaml', 'approval.md'], p3: ['.openspec.yaml', 'requirements.md'] };
  const gh = (args) => {
    const route = args[1] ?? '';
    const id = /changes\/(p\d)/.exec(route)?.[1];
    if (!id) return { status: 1, stdout: '', stderr: 'not found' };
    if (/\.openspec\.yaml/.test(route)) return { status: 0, stdout: JSON.stringify({ encoding: 'base64', content: Buffer.from(yamls[id]).toString('base64') }), stderr: '' };
    return { status: 0, stdout: JSON.stringify(listing[id].map((name) => ({ name }))), stderr: '' };
  };
  const result = changeLoopModule.remoteClaims(t.main, { env: cleanEnv, gh });
  assert.equal(result.readable, true);
  const read = (id) => { const c = result.claims.get(id); return [c.machine, c.places, c.placed]; };
  assert.deepEqual(read('p1'), ['avel', 2, true], 'an approval.md in the folder is a placed change, and a number of places is a number');
  assert.deepEqual(read('p2'), ['avel', 'run', true], 'places run stays run');
  assert.deepEqual(read('p3'), ['avel', null, false], 'no approval.md is unplaced, and no places key is null');
});

// ---------------------------------------------------------------- remote-worker: the place on the change's side (phase 2)

const PLACE_CONFIG = 'schema: devkit\nship:\n  devkit: pr\n';
const hash12 = (text) => `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;

// A change `mine` claimed for machine `avel` with `places` (the open writes the claim), its plan stages passed and
// approval.md written in its worktree, nothing of it committed after the claim.
function placedChange({ places = '1', run = null, id = 'mine', project = null } = {}) {
  const t = project ?? roundRepo({ roadmap: '# Roadmap\n', config: PLACE_CONFIG });
  if (run) {
    const file = join(git(t.main, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'devkit', 'roadmap-run.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(run)}\n`);
  }
  openOn(t.main, id, 'avel', { places: places ?? undefined }); // places null: a change that records none
  const wt = wtOf(t, id);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  const dir = `openspec/changes/${id}`;
  const readiness = `${head('readiness', c0)}# Readiness\n\n- Status: APPROVED\n`;
  const files = {
    requirements: '# Requirements\n', proposal: PROPOSAL, specs: '# Spec\n', design: '# Design\n', tasks: '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n',
  };
  put(wt, {
    [`${dir}/requirements.md`]: `${head('requirements', c0)}${files.requirements}`,
    [`${dir}/proposal.md`]: `${head('proposal', c0)}${files.proposal}`,
    [`${dir}/specs/s/spec.md`]: `${head('specs', c0)}${files.specs}`,
    [`${dir}/design.md`]: `${head('design', c0)}${files.design}`,
    [`${dir}/tasks.md`]: `${head('tasks', c0)}${files.tasks}`,
    [`${dir}/readiness.md`]: readiness,
    [`${dir}/approval.md`]: `${head('approval', c0)}# Approval\n\n- Status: APPROVED\n- Readiness: ${hash12(readiness)}\n`,
  });
  return { t, wt, id, env: { ...t.ghAt(wt).env, ...SET } };
}

// Another change of machine `avel`, opened and pushed from a second clone; `approved` also pushes its approval.md.
function otherChangeOnAvel(t, id, { approved, machine = 'avel', places = '1' }) {
  const clone = otherClone(t);
  openOn(clone, id, machine, { places });
  if (approved) {
    const wt = join(clone, '.claude', 'worktrees', id);
    put(wt, { [`openspec/changes/${id}/approval.md`]: `# Approval\n\n- Status: APPROVED\n` });
    commitAll(wt, 'plan');
    git(wt, 'push', '-q', 'origin', id);
  }
  return clone;
}
const nextIn = (f, extra = []) => main(['next', '--change', f.id, '--lang', 'en', ...extra], { cwd: f.wt, env: f.env });

const fetchOrigin = (t) => git(t.main, 'fetch', '-q', '--prune', 'origin');
const placeIn = (f, id = f.id) => main(['place', id, '--lang', 'en'], { cwd: wtOf(f.t, id), env: f.env });
const placeBody = (r) => JSON.parse(r.stdout);
const actionIn = (f) => parsed(nextIn(f)).action;

test('remote AC-10 next: with no free place the change ends waiting for a place, icon ⏳', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const r = nextIn(f);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /^devkit-run: mine\ndevkit-end: mine blocked\n/);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.end.state, a.end.why, a.stage], ['end', 'blocked', 'no-place', 'implementation']);
  assert.deepEqual(a.params, { id: 'mine', machine: 'avel', taken: 1, places: 1 });
  assert.equal(a.reply, render('en', 'waiting-place', { id: 'mine', machine: 'avel', taken: 1, places: 1 }));
  assert.match(a.reply, /waits for a free place on avel/);
  assert.equal(a.icon, '⏳');
  assert.equal(a.sessionTitle, '⏳ mine');
  assert.equal('step' in a, false, 'no implementation step is handed');
  assert.equal(render('en', 'blocked', { id: 'mine', why: 'no-place', machine: 'avel', taken: 1, places: 1 }).includes('waits for a free place on avel (1 of 1 taken)'), true);
  assert.equal(parsed(main(['next', '--change', 'mine', '--lang', 'pt-BR'], { cwd: f.wt, env: f.env })).action.reply, render('pt-BR', 'waiting-place', { id: 'mine', machine: 'avel', taken: 1, places: 1 }));
  assert.equal(git(f.t.main, 'show', `origin/mine:openspec/changes/mine/.openspec.yaml`).includes('x-devkit-places: 1'), true);
});

test('remote AC-10 next: a change held by no approval, or by another machine, takes no place', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'idle', { approved: false });
  otherChangeOnAvel(f.t, 'elsewhere', { approved: true, machine: 'mac' });
  fetchOrigin(f.t);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.step, a.detail.command.slice(2)], ['session', 'take-place', ['place', 'mine', '--lang', 'en']]);
});

test('remote AC-10 next: a free place gives take-place, and after it the implementation step', () => {
  const f = placedChange({ places: '2' });
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const first = actionIn(f);
  assert.deepEqual([first.kind, first.step, first.stage, first.icon], ['session', 'take-place', 'implementation', '🛠️']);
  assert.deepEqual(first.detail.command, ['node', LOOP, 'place', 'mine', '--lang', 'en']);
  assert.match(first.progressKey, /^implementation\/take-place@/);
  const placed = placeIn(f);
  assert.equal(placed.code, 0, placed.stdout + placed.stderr);
  assert.deepEqual(placeBody(placed), { version: 1, change: 'mine', taken: true, machine: 'avel', held: 1, places: 2 });
  assert.equal(git(f.wt, 'status', '--porcelain', '--', 'openspec/changes/mine'), '', 'the plan was committed');
  assert.equal(git(f.wt, 'log', '-1', '--format=%s'), 'chore(openspec): plan of mine');
  assert.equal(git(f.t.main, 'ls-remote', 'origin', 'refs/heads/mine').split('\t')[0], git(f.wt, 'rev-parse', 'HEAD'), 'origin holds the plan');
  assert.match(git(f.t.main, 'show', 'origin/mine:openspec/changes/mine/approval.md'), /Status: APPROVED/);
  const after = actionIn(f);
  assert.deepEqual([after.kind, after.step], ['agent', 'implement'], 'the place is taken: the first implementation step');
  const again = placeIn(f);
  assert.equal(again.code, 0, 'a second run of the step keeps the place');
  assert.equal(placeBody(again).taken, true);
});

test('remote AC-10 next: the places of a run come from the run file', () => {
  const one = placedChange({ places: 'run', run: { version: 1, places: 1 } });
  otherChangeOnAvel(one.t, 'busy', { approved: true });
  fetchOrigin(one.t);
  assert.equal(actionIn(one).end?.why, 'no-place', 'run file with 1 place, 1 held');
  assert.deepEqual(actionIn(one).params, { id: 'mine', machine: 'avel', taken: 1, places: 1 });
  const two = placedChange({ places: 'run', run: { version: 1, places: 2 } });
  otherChangeOnAvel(two.t, 'busy', { approved: true });
  fetchOrigin(two.t);
  assert.equal(actionIn(two).step, 'take-place', 'run file with 2 places, 1 held');
});

test('remote AC-10 next: the grill and the plan never wait for a place', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  assert.equal(actionIn(f).end?.why, 'no-place', 'with its plan approved this change waits');
  rmSync(join(f.wt, 'openspec', 'changes', 'mine', 'approval.md'));
  const a = actionIn(f);
  assert.equal(a.end?.why === 'no-place' || a.step === 'take-place', false, JSON.stringify(a));
  assert.equal(a.kind === 'end' ? a.end.state : a.kind, 'waiting-for-owner', 'a plan waiting for its approval is what it was');
});

test('remote AC-10 next: a change without x-devkit-places never waits', () => {
  const f = placedChange({ places: null });
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  assert.equal(/x-devkit-places/.test(yamlOf(f.wt, 'mine')), false);
  const free = actionIn(f);
  assert.deepEqual([free.kind, free.step], ['agent', 'implement'], 'no place is checked');
  const file = join(f.wt, 'openspec', 'changes', 'mine', '.openspec.yaml');
  writeFileSync(file, `${readFileSync(file, 'utf8')}x-devkit-places: 1\n`);
  assert.equal(actionIn(f).end?.why, 'no-place', 'with the key the same change waits');
});

test('remote AC-10 next: a place already taken is not checked again', () => {
  const f = placedChange();
  assert.equal(placeIn(f).code, 0);
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.step], ['agent', 'implement']);
});

const placeChild = (f, id) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'place', id, '--lang', 'en'], { cwd: wtOf(f.t, id), env: { ...f.env, ...IDENT }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
});

test('remote AC-10 place: two changes of one machine at once, one takes the place', async () => {
  const f = placedChange({ id: 'first-one' });
  placedChange({ id: 'second-one', project: f.t });
  const [a, b] = await Promise.all([placeChild(f, 'first-one'), placeChild(f, 'second-one')]);
  assert.deepEqual([a.code, b.code].sort(), [0, 2], `${a.stdout}\n${b.stdout}`);
  const [win, lose, winId, loseId] = a.code === 0 ? [a, b, 'first-one', 'second-one'] : [b, a, 'second-one', 'first-one'];
  assert.equal(JSON.parse(win.stdout).taken, true);
  assert.deepEqual([JSON.parse(lose.stdout).taken, JSON.parse(lose.stdout).held], [false, 1]);
  git(f.t.main, 'fetch', '-q', 'origin');
  assert.match(git(f.t.main, 'show', `origin/${winId}:openspec/changes/${winId}/approval.md`), /APPROVED/);
  assert.throws(() => git(f.t.main, 'cat-file', '-e', `origin/${loseId}:openspec/changes/${loseId}/approval.md`), 'the other change\'s plan is not on origin');
});

test('remote AC-11 place: a wake that comes too early leaves the change waiting', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true }); // pushed after this clone's last fetch: its view is stale
  const early = placeIn(f);
  assert.equal(early.code, 2, early.stdout + early.stderr);
  assert.deepEqual(placeBody(early), { version: 1, change: 'mine', taken: false, machine: 'avel', held: 1, places: 1 });
  const onOrigin = git(f.t.main, 'ls-remote', 'origin', 'refs/heads/mine').split('\t')[0];
  assert.notEqual(onOrigin, git(f.wt, 'rev-parse', 'HEAD'), 'the plan was not pushed: the place is not taken');
  const a = actionIn(f);
  assert.deepEqual([a.end?.state, a.end?.why, a.params?.taken], ['blocked', 'no-place', 1]);
  assert.equal('step' in a, false);
});

test('remote AC-10 stop: the blocked end no-place lets a /devkit change run stop', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const transcript = transcriptOf([typedLine('change mine'), skillBodyLine('change mine'), assistantLine(), runLine('mine')]);
  const r = hook('stop', stopInput(f.wt, transcript), { ...f.env, TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
  const free = placedChange({ id: 'free-one' });
  const ready = hook('stop', stopInput(free.wt, transcriptOf([typedLine('change free-one'), skillBodyLine('change free-one'), assistantLine(), runLine('free-one')])), { ...free.env, TMPDIR: sandbox() });
  assert.equal(ready.code, 2, 'a ready take-place step is refused once, like any step');
  assert.match(ready.err, /take-place/);
});

// ================================================================ jira-entry: the entry (start and open)

const TASK_LINK = 'https://acme.atlassian.net/browse/PROJ-482';
const BOARD_LINK = 'https://acme.atlassian.net/jira/software/projects/PROJ/boards/1?selectedIssue=PROJ-482';
const TASK_OF_482 = { key: 'PROJ-482', link: null, idPrefix: 'proj-482' };

// A committed change `id` whose requirements record the Jira key on the first line of its request section.
function addTaskChange(root, id, line = `Jira: PROJ-482 ${TASK_LINK}`, { flow = null } = {}) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}`,
    [`openspec/changes/${id}/requirements.md`]: `${head('requirements', c0)}# Requirements\n\n## Request\n\n${line}\n\nTitle:\n\n> Login times out after 30 seconds\n\n## Assumptions\n\n- \n`,
    [`openspec/changes/${id}/${PLAN_FILES.decisions}`]: `${head('decisions', c0)}# decisions\n`, // the stage-roles decisions stage comes before the proposal
  });
  commitAll(root, `change ${id}`);
}

test('jira-entry AC-1 start answers task for a key in a project with no unfinished change, and creates nothing', () => {
  const root = devkitRepo();
  const before = snapshot(root);
  const b = body(startRun(root, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.verb, b.text, b.change, b.unfinished, b.reply, b.version], ['task', 'change', 'PROJ-482', null, [], null, 1]);
  assert.deepEqual(b.task, TASK_OF_482);
  assert.equal(snapshot(root), before);
});

test('jira-entry AC-2 start answers the same task for a browse link and a board link', () => {
  const root = devkitRepo();
  for (const link of [TASK_LINK, `${TASK_LINK}?atlOrigin=abc`, BOARD_LINK]) {
    const b = body(startRun(root, `change ${link}`));
    assert.equal(b.mode, 'task', link);
    assert.deepEqual(b.task, { key: 'PROJ-482', link, idPrefix: 'proj-482' }, link);
  }
});

// Invariant (T-25, D-13): a Jira key or its link resumes the unfinished change that records it and says where it stopped; layer: startMode; suite: change-loop.
// The change records flow 2, as an open with this release does.
test('jira-entry AC-5 start resumes the unfinished change that records the key, for the key and for its link', () => {
  const t = freshProject();
  addTaskChange(t.main, 'proj-482-login-timeout', undefined, { flow: 2 });
  addChange(t.main, 'other');
  for (const typed of ['PROJ-482', TASK_LINK, BOARD_LINK]) {
    const b = body(startRun(t.main, `change ${typed}`));
    assert.deepEqual([b.mode, b.change], ['resume', 'proj-482-login-timeout'], typed);
    assert.equal(b.reply, render('en', 'resumed', { id: 'proj-482-login-timeout', where: whereNext('proposal') }), typed);
  }
});

test('jira-entry AC-5 start asks about other unfinished changes before a task, and carries the task', () => {
  const t = freshProject();
  addChange(t.main, 'other');
  const before = snapshot(t.main);
  const b = body(startRun(t.main, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.change], ['ask-unfinished', null]);
  assert.deepEqual(b.task, TASK_OF_482);
  assert.deepEqual(b.unfinished.map((u) => u.id), ['other']);
  assert.equal(b.reply, render('en', 'ask-unfinished', { list: `other (${whereNext('proposal')})` }));
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-5 a key whose only change is archived reads as a new task', () => {
  const root = devkitRepo();
  put(root, {
    'openspec/changes/archive/2026-11-22-feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/archive/2026-11-22-feat/requirements.md': `# Requirements\n\n## Request\n\nJira: PROJ-482 ${TASK_LINK}\n`,
  });
  const b = body(startRun(root, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.unfinished], ['task', []]);
  assert.deepEqual(b.task, TASK_OF_482);
});

test('jira-entry AC-8 start answers free text, a lower-case key, a change id and no text as before, with task null', () => {
  const root = devkitRepo();
  for (const [text, mode] of [['add a csv export', 'new'], ['proj-482', 'new'], ['PROJ-482 and more words', 'new'], ['see https://example.com/x', 'new'], ['', 'nothing']]) {
    const b = body(startRun(root, `change ${text}`.trim()));
    assert.deepEqual([b.mode, b.task], [mode, null], text);
  }
  const t = freshProject();
  addChange(t.main, 'feat');
  const b = body(startRun(t.main, 'change feat'));
  assert.deepEqual([b.mode, b.change, b.task], ['resume', 'feat', null]);
  assert.equal(body(startRun(t.main, 'roadmap PROJ-482')).task, null, 'only the change verb reads a task');
});

const FAKE_TASK = {
  key: 'PROJ-482', url: TASK_LINK, title: 'Login times out after 30 seconds',
  description: 'Users see a blank page.\n\n## Not a heading\nJira: OTHER-1', acceptanceCriteria: 'Login answers within 5 seconds',
};
const taskOpen = (cwd, id, task = FAKE_TASK, { key = 'PROJ-482', raw } = {}) => main(
  ['open', id, '--script', 'devkit', '--why', 'doubt', '--task', key, '--lang', 'en'], { cwd, env: cleanEnv, stdin: raw ?? JSON.stringify(task) });
const requestSection = (t, id) => /## Request\n([\s\S]*?)\n## /.exec(readFileSync(join(wtOf(t, id), 'openspec', 'changes', id, 'requirements.md'), 'utf8'))[1];

test('jira-entry AC-1 open --task writes the key line and the three quoted parts under Request, and nothing else of the task', () => {
  const t = freshProject();
  const noise = { comments: ['secret comment text'], subtasks: [{ key: 'PROJ-483', summary: 'secret subtask text' }], issuelinks: ['secret link text'] };
  const r = taskOpen(t.main, 'proj-482-login-timeout', { ...FAKE_TASK, ...noise });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const [first, ...rest] = r.stdout.split('\n');
  assert.equal(first, 'devkit-run: proj-482-login-timeout');
  const b = JSON.parse(rest.join('\n'));
  assert.deepEqual(b.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal(b.reply, render('en', 'opened-task', { key: 'PROJ-482', id: 'proj-482-login-timeout', script: 'devkit', other: 'devkit-lite', why: 'doubt' }));
  assert.equal(requestSection(t, 'proj-482-login-timeout'), [
    '', `Jira: PROJ-482 ${TASK_LINK}`, '', 'Title:', '', '> Login times out after 30 seconds', '', 'Description:', '',
    '> Users see a blank page.', '>', '> ## Not a heading', '> Jira: OTHER-1', '', 'Acceptance criteria field:', '', '> Login answers within 5 seconds', '',
  ].join('\n'));
  const file = readFileSync(join(wtOf(t, 'proj-482-login-timeout'), 'openspec', 'changes', 'proj-482-login-timeout', 'requirements.md'), 'utf8');
  assert.doesNotMatch(file, /secret/);
  assert.equal(body(startRun(t.main, 'change PROJ-482')).mode, 'resume', 'the key now resumes the change');
});

test('jira-entry AC-1 open --task without an acceptance-criteria field writes the key line, the title and the description', () => {
  const t = freshProject();
  const { acceptanceCriteria: _dropped, ...noField } = FAKE_TASK;
  assert.equal(taskOpen(t.main, 'proj-482-login', noField).code, 0);
  const section = requestSection(t, 'proj-482-login');
  assert.match(section, /^\nJira: PROJ-482 /);
  assert.match(section, /Title:\n\n> Login times out/);
  assert.match(section, /Description:\n\n> Users see/);
  assert.doesNotMatch(section, /Acceptance criteria field/);
});

test('jira-entry AC-1 open --task refuses an id that does not start with the key, and creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  for (const id of ['login-timeout', 'proj-48-login', 'proj-4820-login']) {
    const r = taskOpen(t.main, id);
    assert.equal(r.code, 3, id);
    assert.match(body(r).error, /proj-482-/, id);
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
    assert.equal(snapshot(t.main), before, id);
  }
});

test('jira-entry AC-3 open --task refuses a task answer it cannot read, and creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  const answers = {
    empty: '', 'cut short': '{"key":"PROJ-482","title":"Log', 'another key': JSON.stringify({ ...FAKE_TASK, key: 'PROJ-1' }),
    'no title': JSON.stringify({ ...FAKE_TASK, title: undefined }), 'not an object': '["PROJ-482"]',
  };
  for (const [label, raw] of Object.entries(answers)) {
    const r = taskOpen(t.main, 'proj-482-login', FAKE_TASK, { raw });
    assert.equal(r.code, 3, label);
    assert.doesNotMatch(body(r).error, /unknown option/, label);
    assert.match(body(r).error, /task|standard input/, label);
    assert.equal(r.stdout.startsWith('devkit-run:'), false, label);
    assert.equal(snapshot(t.main), before, label);
  }
  assert.match(body(taskOpen(t.main, 'proj-482-login', FAKE_TASK, { key: 'proj-482' })).error, /needs a Jira key/, 'a key that is not a key');
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-5 open --task refuses a second change for a key whose change is unfinished', () => {
  const t = freshProject();
  assert.equal(taskOpen(t.main, 'proj-482-login-timeout').code, 0);
  const before = snapshot(t.main);
  const r = taskOpen(t.main, 'proj-482-second-try');
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, render('en', 'task-taken', { key: 'PROJ-482', id: 'proj-482-login-timeout' }));
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-8 open without --task writes the request byte for byte as before', () => {
  const t = freshProject();
  assert.equal(openRun(t.main, 'plain-request', { request: 'Add a CSV export\nwith two lines\n' }).code, 0);
  assert.equal(requestSection(t, 'plain-request'), '\n> Add a CSV export\n> with two lines\n');
  const b = JSON.parse(openRun(t.main, 'plain-two', { request: 'one' }).stdout.split('\n').slice(1).join('\n'));
  assert.equal('task' in b, false);
  assert.equal(b.reply, render('en', 'opened', { id: 'plain-two', script: 'devkit', other: 'devkit-lite', why: 'doubt' }));
});

// ================================================================ jira-entry: the write-back (next)

const TASK_REQUIREMENTS = `# Requirements\n\n## Request\n\nJira: PROJ-482 ${TASK_LINK}\n\nTitle:\n\n> Login times out after 30 seconds\n\n## Assumptions\n\n- \n`;
const recordFile = (t, id = 'feat') => join(t.main, '.git', 'devkit', 'write-back', `${id}.json`);
const asked = (t, over = {}, id = 'feat') => {
  mkdirSync(dirname(recordFile(t, id)), { recursive: true });
  writeFileSync(recordFile(t, id), JSON.stringify({ version: 1, change: id, key: 'PROJ-482', number: 12, url: 'https://github.com/o/r/pull/12', askedAt: '2026-11-22T00:00:00Z', transitions: [], answer: null, ...over }));
};

test('jira-entry AC-4 next hands the grill of a task change with the task\'s key and link', () => {
  const t = freshProject();
  assert.equal(taskOpen(t.main, 'proj-482-login-timeout').code, 0);
  const r = main(['next', '--change', 'proj-482-login-timeout', '--lang', 'en'], { cwd: t.main, env: cleanEnv });
  const a = actionOf(r.stdout);
  assert.deepEqual([a.kind, a.stage], ['grill', 'requirements']);
  assert.deepEqual(a.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal('writeBack' in a, false);
});

test('jira-entry AC-6 next carries writeBack once the pull request exists, for a change that records a task', () => {
  const { t, env } = deliveredChange({ requirements: TASK_REQUIREMENTS });
  const a = parsed(next(t.main, [], env)).action;
  assert.deepEqual(a.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.deepEqual(a.writeBack, { key: 'PROJ-482', link: TASK_LINK, number: 12, url: 'https://github.com/o/r/pull/12' });
});

test('jira-entry AC-6 next carries no writeBack after the question was asked, for a change with no task, for a corrupt record, and on the archive branch', () => {
  const plain = deliveredChange();
  const none = parsed(next(plain.t.main, [], plain.env)).action;
  assert.equal('task' in none, false);
  assert.equal('writeBack' in none, false);

  const { t, wt, env } = deliveredChange({ requirements: TASK_REQUIREMENTS });
  assert.ok(parsed(next(t.main, [], env)).action.writeBack, 'before the question');
  asked(t);
  assert.equal('writeBack' in parsed(next(t.main, [], env)).action, false, 'asked for this pull request');
  asked(t, { number: 9 });
  assert.ok(parsed(next(t.main, [], env)).action.writeBack, 'another pull request asks again');
  writeFileSync(recordFile(t), '{ not json');
  const corrupt = parsed(next(t.main, [], env)).action;
  assert.deepEqual(corrupt.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal('writeBack' in corrupt, false, 'a damaged record asks nothing');
  rmSync(recordFile(t));
  git(wt, 'branch', '-m', 'chore/archive-feat');
  assert.equal('writeBack' in parsed(next(t.main, [], env)).action, false, 'not on the archive branch');
});

test('jira-entry AC-6 next carries the task but no writeBack on a budget end held at the pull request', () => {
  const { t, wt, env } = deliveredChange({ checks: [check('build', 'fail')], requirements: TASK_REQUIREMENTS });
  const open = parsed(next(t.main, [], env)).action;
  assert.notEqual(open.kind, 'end', 'under no cap the failing checks hand a step');
  assert.ok(open.writeBack, 'the question is pending before the stop');
  writeFileSync(join(wt, 'openspec', 'changes', 'feat', '.openspec.yaml'), 'schema: devkit-lite\ndevkit:\n  budget: 1000\n');
  const capped = { ...budgetEnv(sandbox(), 'sess-budget', [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 5000 })]) };
  const stopped = parsed(next(t.main, [], { ...env, CLAUDE_CONFIG_DIR: capped.CLAUDE_CONFIG_DIR, CLAUDE_CODE_SESSION_ID: capped.CLAUDE_CODE_SESSION_ID })).action;
  assert.equal(stopped.end?.why, 'waiting-budget', 'the cap holds the step');
  assert.deepEqual(stopped.task, { key: 'PROJ-482', link: TASK_LINK }, 'the task still attaches');
  assert.equal('writeBack' in stopped, false, 'a budget-stopped end asks nothing');
});

test('jira-entry AC-6 a pending question changes no decision', async () => {
  const withTask = deliveredChange({ requirements: TASK_REQUIREMENTS });
  const without = deliveredChange();
  const A = parsed(next(withTask.t.main, [], withTask.env)).action;
  const B = parsed(next(without.t.main, [], without.env)).action;
  assert.ok(A.writeBack, 'the question is pending');
  for (const k of ['kind', 'end', 'step', 'agent', 'reply']) assert.deepEqual(A[k], B[k], k);
  // The wait ends on the same decision and sleeps the same number of times: the pending question is not part of its key.
  const waitOf = async (c) => {
    let sleeps = 0;
    const sleep = async () => { sleeps++; c.gh.set('pr-checks', { stdout: [check('build', 'pass')] }); };
    const poll = async () => nextAction(c.t.main, 'feat', { env: c.env, lang: 'en', gh: c.t.ghFor(c.wt) });
    const action = await waitLoop({ poll, sleep, interval: 5, id: 'feat', lang: 'en' });
    return { sleeps, end: action.end, reply: action.reply };
  };
  assert.deepEqual(await waitOf(withTask), await waitOf(without));
});

// ---- write-back ask

const PR_URL = 'https://github.com/o/r/pull/12';
const TRANSITIONS = [{ id: '31', name: 'In Review' }, { id: '41', name: 'Done' }];
const taskDelivery = () => deliveredChange({ requirements: TASK_REQUIREMENTS });
const writeBack = (c, sub, args, { stdin = '', lang = 'en', id = 'feat' } = {}) => main(
  ['write-back', sub, id, ...args, '--lang', lang], { cwd: c.t.main, env: c.env, gh: c.t.ghFor(c.wt), stdin });
const askBack = (c, input = { number: 12, url: PR_URL, transitions: TRANSITIONS }, opts = {}) => writeBack(c, 'ask', [], { stdin: JSON.stringify(input), ...opts });
const answerBack = (c, choice, opts = {}) => writeBack(c, 'answer', ['--choice', choice], opts);
const archiveOnMain = (c, id = 'feat') => mkdirSync(join(c.t.main, 'openspec', 'changes', 'archive', `2026-11-22-${id}`), { recursive: true });

test('jira-entry AC-6 write-back ask lists the transitions, only comment and no, records the question, and answers ask false the second time', () => {
  const c = taskDelivery();
  const r = askBack(c);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('{'), true, 'no devkit-run or devkit-end line');
  const b = body(r);
  const labels = ['move it to "In Review"', 'move it to "Done"', 'only comment', 'no'];
  assert.deepEqual([b.version, b.change, b.key, b.ask], [1, 'feat', 'PROJ-482', true]);
  assert.deepEqual(b.choices, [
    { choice: 'transition:31', label: labels[0] }, { choice: 'transition:41', label: labels[1] },
    { choice: 'comment', label: labels[2] }, { choice: 'no', label: labels[3] },
  ]);
  assert.equal(b.question, render('en', 'write-back-ask', { id: 'feat', key: 'PROJ-482', number: 12, choices: labels.join('; ') }));
  const record = JSON.parse(readFileSync(recordFile(c.t), 'utf8'));
  assert.deepEqual([record.version, record.change, record.key, record.number, record.url, record.transitions, record.answer], [1, 'feat', 'PROJ-482', 12, PR_URL, TRANSITIONS, null]);
  assert.deepEqual(body(askBack(c)), { version: 1, change: 'feat', key: 'PROJ-482', ask: false, why: 'asked' });
  assert.equal('writeBack' in parsed(next(c.t.main, [], c.env)).action, false, 'next asks nothing once asked');
  assert.match(body(askBack(taskDelivery(), undefined, { lang: 'pt-BR' })).question, /Devo escrever o link/, 'the question is in the person\'s language');
});

test('jira-entry AC-6 write-back ask with no transitions offers only comment and no', () => {
  const c = taskDelivery();
  for (const input of [{ number: 12, url: PR_URL, transitions: [] }, { number: 12, url: PR_URL }]) {
    rmSync(recordFile(c.t), { force: true });
    assert.deepEqual(body(askBack(c, input)).choices.map((x) => x.choice), ['comment', 'no']);
  }
});

test('jira-entry AC-6 write-back ask refuses a change with no task and malformed input with exit 3', () => {
  const plain = deliveredChange();
  assert.equal(askBack(plain).code, 3, 'no task');
  assert.match(body(askBack(plain)).error, /records no Jira task/);
  assert.equal(existsSync(recordFile(plain.t)), false);
  const c = taskDelivery();
  for (const raw of ['', '{ cut', '[]', JSON.stringify({ number: 0, url: PR_URL }), JSON.stringify({ number: 12, url: 'ftp://x' }), JSON.stringify({ number: 12, url: PR_URL, transitions: [{ id: '1' }] })]) {
    const r = writeBack(c, 'ask', [], { stdin: raw });
    assert.equal(r.code, 3, raw);
    assert.equal(body(r).version, 1);
    assert.equal(r.stdout.startsWith('devkit-'), false);
  }
  assert.equal(existsSync(recordFile(c.t)), false, 'nothing recorded');
  assert.equal(askBack(c, undefined, { id: 'nope' }).code, 3, 'an unknown change');
  assert.match(body(askBack(c, undefined, { id: 'nope' })).error, /no change nope/);
});

test('jira-entry AC-6 write-back ask on an archived change asks nothing', () => {
  const c = taskDelivery();
  archiveOnMain(c);
  assert.deepEqual(body(askBack(c)), { version: 1, change: 'feat', key: 'PROJ-482', ask: false, why: 'archived' });
  assert.equal(existsSync(recordFile(c.t)), false);
  const d = taskDelivery();
  git(d.wt, 'branch', '-m', 'chore/archive-feat');
  assert.equal(body(askBack(d)).why, 'archived', 'on the archive branch');
});

// ---- write-back answer

const answerOf = (c) => JSON.parse(readFileSync(recordFile(c.t), 'utf8')).answer;
const COMMENT_EN = `devkit opened the pull request ${PR_URL} for this task (change feat).`;

test('jira-entry AC-7 write-back answer with a transition gives one comment and that transition', () => {
  const c = taskDelivery();
  askBack(c);
  const r = answerBack(c, 'transition:31');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('{'), true);
  assert.deepEqual(body(r), {
    version: 1, change: 'feat', key: 'PROJ-482', write: true, comment: COMMENT_EN, transition: { id: '31', name: 'In Review' },
    reply: render('en', 'write-back-moved', { key: 'PROJ-482', number: 12, name: 'In Review' }),
  });
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['transition:31', true]);
  assert.match(answerOf(c).at, /^\d{4}-\d{2}-\d{2}T/);
});

test('jira-entry AC-7 write-back answer only comment gives the comment and no transition', () => {
  const c = taskDelivery();
  askBack(c);
  assert.deepEqual(body(answerBack(c, 'comment')), {
    version: 1, change: 'feat', key: 'PROJ-482', write: true, comment: COMMENT_EN, transition: null,
    reply: render('en', 'write-back-commented', { key: 'PROJ-482', number: 12 }),
  });
  assert.equal(answerOf(c).written, true);
});

test('jira-entry AC-7 write-back answer no, a second answer, and an answer before the question write nothing', () => {
  const c = taskDelivery();
  const none = (why) => ({ version: 1, change: 'feat', key: 'PROJ-482', write: false, why, reply: render('en', 'write-back-none', { key: 'PROJ-482' }) });
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'));
  assert.equal(existsSync(recordFile(c.t)), false, 'an answer before the question records nothing');
  askBack(c);
  assert.deepEqual(body(answerBack(c, 'no')), none('no'));
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['no', false]);
  assert.deepEqual(body(answerBack(c, 'comment')), none('answered'));
  assert.equal(answerOf(c).choice, 'no', 'the first answer stands');
  writeFileSync(recordFile(c.t), '{ not json');
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'), 'a damaged record writes nothing');
  asked(c.t, { key: 'OTHER-9' });
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'), 'a record of another key');
});

test('jira-entry AC-7 write-back answer after the archive writes nothing', () => {
  const c = taskDelivery();
  askBack(c);
  archiveOnMain(c);
  assert.deepEqual(body(answerBack(c, 'comment')), {
    version: 1, change: 'feat', key: 'PROJ-482', write: false, why: 'archived', reply: render('en', 'write-back-late', { id: 'feat', key: 'PROJ-482' }),
  });
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['comment', false]);
});

test('jira-entry AC-7 write-back answer with a transition not offered writes nothing and lists the choices again', () => {
  const c = taskDelivery();
  askBack(c);
  const r = answerBack(c, 'transition:99');
  assert.equal(r.code, 0);
  const labels = 'move it to "In Review"; move it to "Done"; only comment; no';
  assert.deepEqual(body(r), {
    version: 1, change: 'feat', key: 'PROJ-482', write: false, why: 'unknown-choice', reply: render('en', 'write-back-unknown', { key: 'PROJ-482', choices: labels }),
  });
  assert.equal(answerOf(c), null, 'nothing recorded');
  assert.equal(body(answerBack(c, 'transition:41')).write, true, 'a valid answer can follow');
  const bad = answerBack(taskDelivery(), 'maybe');
  assert.equal(bad.code, 3, 'a choice outside the form is a usage error');
});

test('jira-entry AC-7 the comment names the link and the change in the files language', () => {
  const en = taskDelivery();
  askBack(en);
  assert.equal(body(answerBack(en, 'comment')).comment, COMMENT_EN);
  const pt = taskDelivery();
  const config = join(pt.wt, 'openspec', 'config.yaml');
  writeFileSync(config, `${readFileSync(config, 'utf8')}devkit:\n  language: pt-BR\n`);
  askBack(pt);
  const b = body(answerBack(pt, 'comment', { lang: 'en' }));
  assert.equal(b.comment, `o devkit abriu o pull request ${PR_URL} para esta tarefa (change feat).`);
  assert.match(b.reply, /I wrote the link/, 'the reply stays in the person\'s language');
});

// ---- jira-entry 4.1: the skill's side of the Jira entry (D-3, D-5, D-7)

test("jira-entry AC-1 skill: the task mode, the connector's read, open --task and the two replies that open nothing", () => {
  const md = skillText();
  assert.ok(md.includes('`task`'), 'the task mode of start');
  const start = section(md, '## Start', '## A new change');
  assert.match(start, /- `task`: .*### A Jira task/, 'the task mode points at the subsection');
  assert.match(start, /`ask-unfinished`[^\n]*"start the new request"[^\n]*`task` is not null[^\n]*### A Jira task/, 'ask-unfinished sends a task to the subsection');
  const jira = section(md, '### A Jira task', '## Loop');
  assert.match(jira, /ToolSearch/);
  assert.match(jira, /jira issue/);
  for (const tool of ['getJiraIssue', 'getTransitionsForJiraIssue', 'addCommentToJiraIssue', 'transitionJiraIssue', 'getAccessibleAtlassianResources']) {
    assert.ok(jira.includes(tool), `names ${tool}`);
  }
  assert.match(jira, /change-loop\.mjs reply task-no-connector --param key=<KEY> --lang \$\{user_config\.language\}/);
  assert.match(jira, /change-loop\.mjs reply task-unreadable --param key=<KEY> --lang \$\{user_config\.language\}/);
  for (const field of ['`key`', '`url`', '`title`', '`description`', '`acceptanceCriteria`']) assert.ok(jira.includes(field), `the JSON holds ${field}`);
  assert.match(jira, /Nothing else of the task goes in/);
  assert.match(jira, /task\.idPrefix/);
  assert.match(jira, /change-loop\.mjs open <id> --script <s> --why <code> --task <KEY> --lang \$\{user_config\.language\}/);
  assert.match(jira, /<<'DEVKIT_ARGS'/);
  assert.match(jira, /`name-taken`/);
  assert.match(jira, /`task-taken`/);
  const calls = md.split('\n').filter((l) => /change-loop\.mjs (open|reply|write-back)\b/.test(l) && l.includes('<KEY>'));
  for (const l of calls) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
});

test('jira-entry AC-4 skill: the grill of a task leaves the request section as it is', () => {
  const grill = skillText().split('\n').find((l) => l.startsWith('- `grill`'));
  assert.ok(grill, 'a grill item');
  assert.match(grill, /carries `task`/);
  assert.match(grill, /paragraph on a request copied from a task/);
  assert.match(grill, /leave `## Request`[^.]*exactly as it is/);
});

test('jira-entry AC-6 skill: the write-back question is asked once, in plain text, never with AskUserQuestion, and holds nothing', () => {
  const md = skillText();
  const wb = section(md, '### Writing back to the task', '## Owner gates');
  assert.match(wb, /carries `writeBack`/);
  assert.match(wb, /change-loop\.mjs write-back ask <id> --lang \$\{user_config\.language\}/);
  assert.match(wb, /<<'DEVKIT_ARGS'/);
  assert.match(wb, /"transitions"/);
  assert.match(wb, /plain text, never with AskUserQuestion/);
  assert.match(wb, /hold the turn/);
  assert.match(wb, /`ask: true`/);
  assert.match(md.slice(md.indexOf('## Owner gates')), /write-back question is not a gate and blocks nothing/);
});

test("jira-entry AC-7 skill: Jira is written only through write-back answer on the owner's own message, and a failed write is said and not retried", () => {
  const md = skillText();
  const wb = section(md, '### Writing back to the task', '## Owner gates');
  assert.match(wb, /Only the owner's own typed message answers/);
  assert.match(wb, /change-loop\.mjs write-back answer <id> --choice <choice> --lang \$\{user_config\.language\}/);
  assert.match(wb, /`write: true`/);
  assert.match(wb, /`write: false`/);
  assert.match(wb, /reply write-back-failed --param key=<KEY> --param error="<message>"/);
  assert.match(wb, /not retried/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Write to Jira except from `write-back answer` on the owner's own message/);
  assert.match(never, /Ask the write-back question with AskUserQuestion/);
  assert.match(never, /Copy a comment, subtask, linked task or attachment of a task into the change/);
  assert.match(never, /Keep a Jira token or a Jira setting in the project/);
});

test('jira-entry AC-4 grill skill: a request copied from a task is asked only what it leaves open', () => {
  const md = readRepo('plugins', 'core', 'skills', 'requirements-grill', 'SKILL.md');
  const step3 = section(md, '### 3. Grill on the four axes', '### 4. ');
  const para = step3.split('\n').find((l) => l.startsWith('**A request copied from a task.**'));
  assert.ok(para, 'the paragraph ends step 3');
  assert.match(para, /`Jira: <KEY>`/);
  assert.match(para, /\(answered by the task\)/);
  assert.match(para, /one question that confirms/);
  assert.match(para, /never edit the request section/);
});

test('jira-entry docs: the flow document, the design document and ADR 0010 record the Jira entry', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').some((l) => l.startsWith('- `/devkit change <Jira key or link>`:')), 'the forms list has the Jira form');
  const para = flow.split('\n').find((l) => l.startsWith('**A Jira task.**'));
  assert.ok(para, 'the paragraph A Jira task');
  assert.match(para, /Atlassian connector/);
  assert.match(para, /makes no call and keeps no token/);
  assert.match(para, /`requirements\.md`/);
  assert.match(para, /resum/);
  assert.match(para, /git common directory/);
  assert.match(flow, /`project` is built and only `help` is not/);
  assert.doesNotMatch(flow, /`project` and `help` are (still )?not built/);

  const design = readRepo('docs', 'coordination-design.md');
  const part = (from, to) => { const a = design.indexOf(from); assert.ok(a >= 0, from); const b = design.indexOf(to, a + from.length); return design.slice(a, b < 0 ? design.length : b); };
  assert.match(design, /\| `\/devkit change PROJ-482` \| one task, read from Jira by its key or link \| 20 \(built\) \|/);
  assert.match(part('## 1. ', '## 2. '), /Built by `jira-entry` on 2026-11-22: /);
  assert.match(part('## 8. ', '## 9. '), /Decided by `jira-entry` on 2026-11-22: the task source needs no field; the key or link typed names it\./);
  assert.doesNotMatch(design, /source: jira/);
  assert.match(part('## 13. ', '## 14. '), /Jira can be read on each platform \(the follow-up `jira-entry-live`, round 20b\)\./);

  const adr = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  const ctx = adr.slice(adr.indexOf('## Context'), adr.indexOf('ADR 0001 let devkit coordinate'));
  assert.match(ctx, /Note \(jira-entry, 2026-11-22\): round 20 adds no task-source setting/);
  assert.ok(ctx.indexOf('Note (project-phases') < ctx.indexOf('Note (jira-entry'), 'after the project-phases Note');
  assert.match(adr, /^- Status: accepted$/m, 'its status does not change');
});

test('jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry', () => {
  const text = readRepo('openspec', 'roadmap.md');
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith('## Round 20b: live proof of the Jira entry'));
  assert.ok(at > lines.findIndex((l) => l.startsWith('## Round 20: the Jira entry')), 'the block follows round 20');
  const line = lines.find((l) => l.startsWith('- [ ] jira-entry-live (after: jira-entry)'));
  assert.ok(line, 'the unticked live-proof line');
  assert.match(line, /disposable test task the owner names/);
  const rounds = guardModule.readRoadmap(REPO_ROOT);
  const round = rounds.find((r) => r.title.startsWith('Round 20b'));
  assert.ok(round, 'readRoadmap reads the round');
  assert.deepEqual(round.items.map((i) => ({ id: i.id, done: i.done, after: i.after })), [{ id: 'jira-entry-live', done: false, after: ['jira-entry'] }]);
});

// ---------------------------------------------------------------- the token budget (change-budget)

// A model message line with a usage object; `sidechain` marks a subagent's own line.
const usageLine = ({ id = null, input = 0, output = 0, cacheWrite = 0, cacheRead = 0, at = '2026-11-20T10:00:00.000Z', sidechain = false } = {}) => stored({
  type: 'assistant',
  timestamp: at,
  isSidechain: sidechain,
  message: { role: 'assistant', ...(id ? { id } : {}), content: [{ type: 'text', text: 'working' }], usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead } },
});
const at = (minute) => `2026-11-20T10:${String(minute).padStart(2, '0')}:00.000Z`;
// The env of a test that reads a transcript: a config folder with `projects/p/<id>.jsonl` written.
const budgetEnv = (dir, id, lines = [assistantLine()]) => {
  mkdirSync(join(dir, 'projects', 'p'), { recursive: true });
  writeFileSync(join(dir, 'projects', 'p', `${id}.jsonl`), `${lines.join('\n')}\n`);
  return { ...cleanEnv, CLAUDE_CONFIG_DIR: dir, CLAUDE_CODE_SESSION_ID: id };
};
// A session transcript with `lines`, and subagent files `{ name: lines }` beside it.
const spendTranscript = (lines, subagents = {}) => {
  const file = transcriptOf(lines);
  const folder = join(dirname(file), SESSION, 'subagents');
  if (Object.keys(subagents).length) mkdirSync(folder, { recursive: true });
  for (const [name, content] of Object.entries(subagents)) writeFileSync(join(folder, name), `${content.join('\n')}\n`);
  return file;
};
const spent = (file, change = 'feat') => guardModule.spentOf(file, change);

test('change-budget AC-9 sessionTranscript finds the session file under CLAUDE_CONFIG_DIR', () => {
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-1');
  assert.equal(guardModule.sessionTranscript(env), join(dir, 'projects', 'p', 'sess-1.jsonl'));
});

test('change-budget AC-9 sessionTranscript falls back to HOME/.claude', () => {
  const home = sandbox();
  const env = { ...budgetEnv(join(home, '.claude'), 'sess-2'), CLAUDE_CONFIG_DIR: '', HOME: home };
  assert.equal(guardModule.sessionTranscript(env), join(home, '.claude', 'projects', 'p', 'sess-2.jsonl'));
});

test('change-budget AC-9 sessionTranscript is null with no id, an unsafe id, no file or no projects folder', () => {
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-3');
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: '' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: undefined }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: '../sess-3' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: 'a/b' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: 'other' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CONFIG_DIR: sandbox() }), null);
});

test('change-budget AC-7 the fixture of the spec counts exactly 7525', () => {
  const model = (id) => usageLine({ id, input: 10, output: 200, cacheWrite: 3000, cacheRead: 50000, at: at(5) });
  const file = spendTranscript(
    [typedLine('change feat'), skillBodyLine('change feat'), runLine('feat'), model('m1'), model('m2')],
    { 'agent-a.jsonl': [usageLine({ id: 's1', input: 5, output: 100, cacheWrite: 1000, at: at(6), sidechain: true })] },
  );
  const r = spent(file);
  assert.equal(r.spent, 7525);
  assert.equal(typeof r.since, 'string');
});

test('change-budget AC-7 lines before the first run line do not count and the first run line wins', () => {
  const file = spendTranscript([
    typedLine('change feat'), usageLine({ id: 'old', input: 1000 }), toolResultLine(`devkit-run: feat\n{}`),
    usageLine({ id: 'a', input: 10, at: at(1) }), toolResultLine(`devkit-run: feat\n{}`), usageLine({ id: 'b', input: 20, at: at(2) }),
  ]);
  assert.equal(spent(file).spent, 30);
});

test('change-budget AC-7 another change run line starts no count', () => {
  const file = spendTranscript([typedLine('change other'), runLine('other'), usageLine({ id: 'a', input: 10 })]);
  assert.deepEqual(spent(file), { spent: 0, since: null });
});

test('change-budget AC-7 a message on several lines counts once and a line with no id counts each time', () => {
  const file = spendTranscript([
    typedLine('change feat'), runLine('feat'),
    usageLine({ id: 'm', input: 10 }), usageLine({ id: 'm', input: 10 }), usageLine({ id: 'm', input: 10 }),
    usageLine({ input: 7 }), usageLine({ input: 7 }),
  ]);
  assert.equal(spent(file).spent, 24);
});

test('change-budget AC-7 a subagent started before the run line does not count', () => {
  // the run line carries the stored default timestamp (10:00); the subagent starts at 09:59 and records a message at 10:20
  const file = spendTranscript(
    [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 1, at: at(10) })],
    {
      'agent-early.jsonl': [usageLine({ id: 'e', input: 500, at: '2026-11-20T09:59:00.000Z', sidechain: true }), usageLine({ id: 'e2', input: 500, at: at(20), sidechain: true })],
      'agent-late.jsonl': [usageLine({ id: 'l', input: 70, at: at(15), sidechain: true })],
    },
  );
  assert.equal(spent(file).spent, 71);
});

test('change-budget AC-7 a subagent file with no timestamp does not count', () => {
  const noStamp = JSON.stringify({ type: 'assistant', isSidechain: true, message: { id: 'n', usage: { input_tokens: 900 } } });
  const file = spendTranscript([typedLine('change feat'), runLine('feat')], { 'agent-none.jsonl': [noStamp] });
  assert.equal(spent(file).spent, 0);
});

test('change-budget AC-7 a sidechain model line of the session transcript counts', () => {
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), usageLine({ id: 's', input: 40, sidechain: true })]);
  assert.equal(spent(file).spent, 40);
});

test('change-budget AC-7 a missing or non-number usage field counts 0', () => {
  const odd = stored({ type: 'assistant', message: { id: 'odd', usage: { input_tokens: 'x', output_tokens: -4, cache_creation_input_tokens: null } } });
  const half = stored({ type: 'assistant', message: { id: 'half', usage: { output_tokens: 6 } } });
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), odd, half]);
  assert.equal(spent(file).spent, 6);
});

test('change-budget AC-9 an unreadable session transcript gives null, an unreadable subagent adds nothing', () => {
  assert.equal(spent(join(sandbox(), 'missing.jsonl')), null);
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 3 })]);
  const folder = join(dirname(file), SESSION, 'subagents');
  mkdirSync(join(folder, 'agent-dir.jsonl'), { recursive: true });
  assert.equal(spent(file).spent, 3);
});

test('change-budget AC-4 the scan without the option returns the same events as before (kept)', () => {
  const file = transcriptOf([typedLine('change feat'), usageLine({ id: 'a', input: 5 }), runLine('feat')]);
  const events = guardModule.transcriptEvents({ transcript_path: file });
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal('at' in event, false);
    assert.equal('start' in event, false);
    assert.equal('usage' in event, false);
  }
});

// ---- the setting (D-1)

const CHANGE_FILE = (dir) => join(dir, '.openspec.yaml');
// A project root holding `config` as its openspec/config.yaml, and a change folder (outside it) holding `change` as its .openspec.yaml.
const budgetFiles = (config, change = null) => {
  const root = configRepo(config);
  const dir = tmpFolder('devkit-change-budget-dir-');
  if (change !== null) writeFileSync(CHANGE_FILE(dir), change);
  return { root, dir };
};
const capOf = (config, change = null, lang = 'en') => {
  const { root, dir } = budgetFiles(config, change);
  return changeLoopModule.budgetOf(root, dir, lang);
};
const block = (...lines) => `schema: devkit\ndevkit:\n${lines.map((l) => `  ${l}\n`).join('')}`;

test('change-budget AC-5 the project budget applies when the change sets none', () => {
  const { root, dir } = budgetFiles(block('budget: 2000000'), 'schema: devkit\n');
  assert.deepEqual(changeLoopModule.budgetOf(root, dir, 'en'), { cap: 2000000, from: 'project', file: CHANGE_FILE(dir) });
  assert.deepEqual(readDevkitSettings(root), { driver: 'claude', language: 'en', unknown: [] }, 'the settings keep their shape');
  const noFile = budgetFiles(block('budget: 2000000'));
  assert.equal(changeLoopModule.budgetOf(noFile.root, noFile.dir, 'en').cap, 2000000, 'a change with no .openspec.yaml at all');
});

test('change-budget AC-5 the change block wins for that change only', () => {
  const project = block('budget: 2000000');
  const a = budgetFiles(project, block('budget: 500000'));
  const b = budgetFiles(project, 'schema: devkit\n');
  const capA = changeLoopModule.budgetOf(a.root, a.dir, 'en');
  assert.deepEqual([capA.cap, capA.from, capA.file], [500000, 'change', CHANGE_FILE(a.dir)]);
  assert.deepEqual([changeLoopModule.budgetOf(b.root, b.dir, 'en').cap, changeLoopModule.budgetOf(b.root, b.dir, 'en').from], [2000000, 'project']);
});

test('change-budget AC-4 no key, or an empty value, in either file is no cap', () => {
  assert.equal(capOf('schema: devkit\n'), null);
  assert.equal(capOf('schema: devkit\n', 'schema: devkit\n'), null);
  assert.equal(capOf(block('budget:'), block('budget:')), null);
  assert.equal(capOf(block('budget:   # none'), null), null);
  assert.equal(capOf(block('budget: ""'), null), null);
  assert.equal(capOf(block('driver: claude'), block('language: en')), null);
});

test('change-budget AC-4 an empty value in the change falls through to the project value', () => {
  const cap = capOf(block('budget: 300'), block('budget:'));
  assert.deepEqual([cap.cap, cap.from], [300, 'project']);
});

test('change-budget AC-5 a top-level budget of .openspec.yaml is not read', () => {
  assert.equal(capOf('schema: devkit\n', 'schema: devkit\nbudget: 100\n'), null);
  assert.equal(capOf(block('budget: 700'), 'schema: devkit\nbudget: 100\n').cap, 700);
  assert.equal(capOf('schema: devkit\nbudget: 100\n', null), null, 'nor one of openspec/config.yaml');
});

test('change-budget AC-5 a quoted value, a comment and an unclosed quote read the number', () => {
  for (const line of ['budget: "2000000"  # two million', 'budget: 2000000   # two million', "budget: '2000000'", 'budget: "2000000', 'budget: 007']) {
    const cap = capOf(block(line));
    assert.equal(cap.cap, line.endsWith('007') ? 7 : 2000000, line);
  }
});

test('change-budget AC-4 other keys of the change block are not read (kept)', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/changes/feat/.openspec.yaml': block('driver: robot', 'language: "not a tag"') });
  commitAll(root, 'odd keys');
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(parsed(r).action.agent, PLANNER);
});

test('change-budget AC-8 budgetValue refuses everything but a whole number above zero', () => {
  const fn = changeLoopModule.budgetValue;
  for (const bad of ['abc', '0', '-5', '1.5', '2e6', '2_000_000', '9007199254740993', ' 5x']) assert.deepEqual(fn(bad), { invalid: bad }, bad);
  assert.equal(fn(undefined), null);
  assert.equal(fn(''), null);
  assert.deepEqual(fn('2000000'), { cap: 2000000 });
  assert.deepEqual(fn('007'), { cap: 7 });
});

test('change-budget AC-8 an invalid project budget makes start answer setting-unknown and open create nothing', () => {
  for (const value of ['abc', '0', '-5', '1.5', '2e6', '2_000_000']) {
    const config = `schema: devkit\ndevkit:\n  budget: ${value}\n`;
    const root = devkitRepo(config);
    const before = snapshot(root);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'setting-unknown', value);
    assert.equal(b.reply, render('en', 'setting-unknown', { setting: 'budget', value, accepted: '1, 2, 3, …' }), value);
    assert.equal(snapshot(root), before, value);
    const t = freshProject(config);
    const beforeOpen = snapshot(t.main);
    const r = openRun(t.main, 'new-thing');
    assert.equal(r.code, 3, value);
    assert.equal(body(r).reply, b.reply, 'the reply is the one the typed command gives');
    assert.equal(snapshot(t.main), beforeOpen, value);
  }
});

test('change-budget AC-8 an invalid change budget makes next exit 3 with the settings reply and no hand-off', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/changes/feat/.openspec.yaml': block('budget: 0') });
  commitAll(root, 'zero budget');
  const r = next(root);
  assert.equal(r.code, 3, r.stderr);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  const out = body(r);
  assert.equal(out.reply, render('en', 'setting-unknown', { setting: 'budget', value: '0', accepted: '1, 2, 3, …' }));
  assert.equal('kind' in out, false, 'no hand-off');
});

test('change-budget AC-8 an invalid project budget makes next exit 3 even under a valid change value', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/config.yaml': block('budget: abc'), 'openspec/changes/feat/.openspec.yaml': block('budget: 500') });
  commitAll(root, 'bad project budget');
  const r = next(root);
  assert.equal(r.code, 3, r.stderr);
  assert.equal(body(r).reply, render('en', 'setting-unknown', { setting: 'budget', value: 'abc', accepted: '1, 2, 3, …' }));
});

test('change-budget AC-8 the settings reply names budget and the value in both languages', () => {
  for (const lang of ['en', 'pt-BR']) {
    const reply = render(lang, 'setting-unknown', { setting: 'budget', value: '2e6', accepted: '1, 2, 3, …' });
    assert.ok(reply.includes('budget') && reply.includes('2e6') && reply.includes('1, 2, 3'), `${lang}: ${reply}`);
    assert.throws(() => capOf(block('budget: 2e6'), null, lang), (e) => e.name === 'LoopRefusal' && e.reply === reply, lang);
  }
});

test('release-tags 1: /devkit change refuses a release_tag that is not a path to a JSON file', () => {
  const accepted = 'a path from the repository root to a JSON file, such as package.json';
  for (const value of ['/abs.json', '../x.json', 'x.yaml', '[a.json]', 'a b.json']) {
    const config = `schema: devkit\ndevkit:\n  release_tag: ${value}\n`;
    for (const [lang, name] of [['en', 'release file'], ['pt-BR', 'arquivo da versão']]) {
      const root = devkitRepo(config);
      const before = snapshot(root);
      const b = body(startRun(root, 'change add an export', { lang }));
      assert.equal(b.mode, 'setting-unknown', `${lang} ${value}`);
      assert.equal(b.reply, render(lang, 'setting-unknown', { setting: 'release-tag', value, accepted }), `${lang} ${value}`);
      assert.ok(b.reply.includes(name) && b.reply.includes(value), `${lang}: ${b.reply}`);
      assert.equal(snapshot(root), before, `${lang} ${value}`);
      const t = freshProject(config);
      const beforeOpen = snapshot(t.main);
      const r = openRun(t.main, 'new-thing', { lang });
      assert.equal(r.code, 3, `${lang} ${value}`);
      assert.equal(body(r).reply, b.reply, 'the reply is the one the typed command gives');
      assert.equal(snapshot(t.main), beforeOpen, `${lang} ${value}`);
    }
  }
});

// ---- the decision (D-4)

const AT_PLAN = () => ({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } });
const BUDGET_FILE = '/w/feat/openspec/changes/feat/.openspec.yaml';
const withBudget = (spent, cap = 2000000) => ({ budget: { cap, file: BUDGET_FILE, spent } });

test('change-budget AC-1 at the cap an agent hand-off becomes the budget end', () => {
  const held = run(AT_PLAN());
  assert.equal(held.kind, 'agent');
  const a = run({ ...AT_PLAN(), facts: withBudget(2000000) });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-budget', 1]);
  assert.deepEqual(a.params, { id: 'feat', spent: 2000000, cap: 2000000, file: BUDGET_FILE });
  assert.deepEqual(a.detail.held, { kind: 'agent', stage: 'proposal', step: null, agent: PLANNER });
  assert.equal(a.stage, 'proposal');
  assert.equal(a.reply, says('waiting-budget', { spent: 2000000, cap: 2000000, file: BUDGET_FILE }));
});

test('change-budget AC-1 above the cap a session step becomes the budget end', () => {
  const lite = FLOWS['devkit-lite'];
  const rep = { schema: 'devkit-lite', next: nextOf(lite, 'proposal', 'no-file') };
  const over = { flow: lite, ctx: { script: 'devkit-lite' }, report: reportOf(lite, rep), facts: { flags: ['ui'], ...withBudget(2100000) } };
  const a = run(over);
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-budget', 1]);
  assert.deepEqual([a.detail.held.kind, a.detail.held.step], ['session', 'switch-script']);
  assert.equal(a.params.spent, 2100000);
});

test('change-budget AC-3 under the cap the action is the one given with no budget (kept)', () => {
  const plain = run(AT_PLAN());
  assert.deepEqual(run({ ...AT_PLAN(), facts: withBudget(1999999) }), plain);
  assert.deepEqual(run({ ...AT_PLAN(), facts: { budget: null } }), plain);
});

test('change-budget AC-9 a spend of null holds nothing (kept)', () => {
  assert.deepEqual(run({ ...AT_PLAN(), facts: withBudget(null) }), run(AT_PLAN()));
});

test('change-budget AC-1 the grill and the ends are not held (kept)', () => {
  const over = withBudget(9000000);
  const grill = run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') }, facts: over });
  assert.equal(grill.kind, 'grill');
  const approval = run({ rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') }, facts: over });
  assert.equal(approval.end.state, 'waiting-for-owner');
  assert.notEqual(approval.end.why, 'waiting-budget');
  const blockedEnd = run({ rep: { next: nextOf(FLOWS.devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } }, facts: over });
  assert.equal(blockedEnd.end.why, 'not-opened');
  const archived = run({ rep: { end: endOf('archived', null, 'archived') }, facts: over });
  assert.equal(archived.end.state, 'archived');
});

test('change-budget AC-1 a no-progress end wins over the budget (kept)', () => {
  const stuck = run({ ...AT_PLAN(), facts: { after: 'proposal/proposal@abc123', ...withBudget(9000000) } });
  assert.deepEqual([stuck.end.state, stuck.end.why], ['blocked', 'no-progress']);
});

// ---- next (D-4, D-5)

// A `feat` change at its plan stage with a cap, and a session transcript of `spent` tokens after its run line.
function cappedRun({ cap, spent, project = null, lines = null } = {}) {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const files = { 'openspec/changes/feat/.openspec.yaml': cap === null ? 'schema: devkit\n' : block(`budget: ${cap}`) };
  if (project !== null) files['openspec/config.yaml'] = block(`budget: ${project}`);
  put(root, files);
  commitAll(root, 'budget');
  const env = budgetEnv(sandbox(), 'sess-budget', lines ?? [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: spent })]);
  return { root, env, file: join(root, 'openspec', 'changes', 'feat', '.openspec.yaml') };
}

test('change-budget AC-1 next at the cap prints the run line and the end line and exits 1', () => {
  const t = cappedRun({ cap: 1000, spent: 1000 });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 1, r.stderr);
  const lines = r.stdout.split('\n');
  assert.deepEqual(lines.slice(0, 2), ['devkit-run: feat', 'devkit-end: feat waiting-for-owner']);
  const action = actionOf(r.stdout);
  assert.deepEqual([action.end.state, action.end.why, action.stage], ['waiting-for-owner', 'waiting-budget', 'proposal']);
  assert.deepEqual([action.params.spent, action.params.cap, action.params.file], [1000, 1000, t.file]);
});

test('change-budget AC-2 the reply says the spend, the cap, the file, budget and /devkit change in both languages', () => {
  const t = cappedRun({ cap: 1000, spent: 1200 });
  for (const lang of ['en', 'pt-BR']) {
    const r = main(['next', '--change', 'feat', '--lang', lang], { cwd: t.root, env: t.env });
    const { reply } = actionOf(r.stdout);
    assert.equal(reply, render(lang, 'waiting-budget', { id: 'feat', spent: 1200, cap: 1000, file: actionOf(r.stdout).params.file }), lang);
    for (const part of ['feat', '1200', '1000', actionOf(r.stdout).params.file, 'budget', '/devkit change']) assert.ok(reply.includes(part), `${lang} names ${part}: ${reply}`);
  }
  assert.ok(actionOf(next(t.root, [], t.env).stdout).params.file.endsWith('/openspec/changes/feat/.openspec.yaml'));
  assert.match(MESSAGES['pt-BR']['waiting-budget'], /orçamento/);
});

test('change-budget AC-6 a raised cap in the change file gives back the held hand-off', () => {
  const t = cappedRun({ cap: 1000, spent: 1500 });
  const held = actionOf(next(t.root, [], t.env).stdout).detail.held;
  put(t.root, { 'openspec/changes/feat/.openspec.yaml': block('budget: 5000') });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 0, r.stderr);
  const action = actionOf(r.stdout);
  assert.deepEqual([action.kind, action.agent, action.stage], [held.kind, held.agent, held.stage]);
});

test('change-budget AC-6 an unchanged cap stops again', () => {
  const t = cappedRun({ cap: 1000, spent: 1500 });
  for (let i = 0; i < 2; i += 1) {
    const r = next(t.root, [], t.env);
    assert.deepEqual([r.code, actionOf(r.stdout).end.why], [1, 'waiting-budget']);
  }
});

test('change-budget AC-4 with no budget next prints the same output with and without a session transcript, and reads none (kept)', () => {
  const t = cappedRun({ cap: null, spent: 5000000 });
  const spy = readCounter();
  const transcript = join(t.env.CLAUDE_CONFIG_DIR, 'projects', 'p', 'sess-budget.jsonl');
  const run = (env) => spawnSync(process.execPath, [LOOP, 'next', '--change', 'feat', '--lang', 'en'], { cwd: t.root, env, encoding: 'utf8' });
  const withTranscript = run({ ...t.env, ...spy.env(transcript) });
  const without = run(cleanEnv);
  assert.equal(withTranscript.status, 0, withTranscript.stderr);
  assert.equal(withTranscript.stdout, without.stdout);
  assert.equal(spy.reads(), 0, 'the transcript was not read');
});

test('change-budget AC-9 with a cap and no session id, or a folder for the transcript, next hands the stage (kept)', () => {
  const t = cappedRun({ cap: 1, spent: 999 });
  const noId = next(t.root, [], { ...t.env, CLAUDE_CODE_SESSION_ID: '' });
  assert.deepEqual([noId.code, actionOf(noId.stdout).kind], [0, 'agent']);
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-dir');
  rmSync(join(dir, 'projects', 'p', 'sess-dir.jsonl'));
  mkdirSync(join(dir, 'projects', 'p', 'sess-dir.jsonl'));
  const asDir = next(t.root, [], env);
  assert.deepEqual([asDir.code, actionOf(asDir.stdout).kind], [0, 'agent']);
});

test('change-budget AC-5 next on two changes uses each one cap', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/config.yaml': block('budget: 2000000'), 'openspec/changes/feat/.openspec.yaml': block('budget: 500'), 'openspec/changes/other/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/other/requirements.md': '# requirements\n' });
  commitAll(root, 'two changes');
  const env = budgetEnv(sandbox(), 'sess-two', [typedLine('change feat'), runLine('feat'), runLine('other'), usageLine({ id: 'a', input: 1000 })]);
  const feat = main(['next', '--change', 'feat', '--lang', 'en'], { cwd: root, env });
  assert.equal(actionOf(feat.stdout).end?.why, 'waiting-budget', 'feat has the cap of 500');
  const other = main(['next', '--change', 'other', '--lang', 'en'], { cwd: root, env });
  assert.notEqual(actionOf(other.stdout).end?.why, 'waiting-budget', 'other keeps the project cap of 2000000');
});

test('change-budget AC-1 nextAction without the option applies no cap (kept)', () => {
  const t = cappedRun({ cap: 1, spent: 999 });
  const action = changeLoopModule.nextAction(t.root, 'feat', { env: t.env, lang: 'en' });
  assert.equal(action.kind, 'agent');
});

test('change-budget AC-1 the stop hook lets the turn end at the first attempt on the budget output', () => {
  const t = cappedRun({ cap: 1000, spent: 1000 });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 1, r.stderr);
  const transcript = transcriptOf([typedLine('change feat'), toolResultLine(r.stdout)]);
  const stop = hook('stop', stopInput(t.root, transcript), { TMPDIR: sandbox() });
  assert.equal(stop.code, 0, stop.err);
});

// ---- the docs (D-10)

test('change-budget AC-10 docs/openspec-flow.md describes the budget', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  const at = flow.indexOf('**The token budget.**');
  assert.ok(at >= 0, 'the paragraph exists');
  const part = flow.slice(at, flow.indexOf('\n\n', flow.indexOf('\n\n', at) + 2));
  const whole = flow.slice(at, at + 4000);
  assert.match(part, /`budget:`/);
  assert.match(whole, /devkit:` block of `openspec\/config\.yaml`/);
  assert.match(whole, /\.openspec\.yaml/);
  assert.match(whole, /input_tokens/);
  assert.match(whole, /output_tokens/);
  assert.match(whole, /cache_creation_input_tokens/);
  assert.match(whole, /cache_read_input_tokens/);
  assert.match(whole, /waiting for the owner|waits for the owner/);
  assert.match(whole, /`\/devkit change` again/);
  assert.match(flow, /\*\*The settings\.\*\*/);
});

// ---------------------------------------------------------------- change-state: phase 1, the state, the GitHub rule and the title (design D-1, D-2, D-4, D-5)

const { changeState, runFactsOf, githubSilent, sessionTitle: titleOf, STATE_ICON } = changeLoopModule;
const stateOf = (action, facts = null, opts = {}) => changeState(action, facts, { lang: 'en', ...opts });
const planStage = (over = {}) => run({ ...over, rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } });
const grillOf = (over = {}) => run({ ...over, rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') } });
const approvalEnd = (over = {}) => run({ ...over, rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') } });
const silentEnd = (code = 'gh-error', over = {}) => run({ ...over, rep: { end: endOf('blocked', 'delivery', code, { error: 'HTTP 502' }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
const ceilingEnd = (over = {}) => run({ ...over, rep: { end: endOf('blocked', 'readiness', 'ceiling-reached', { stage: 'readiness', attempt: 3, ceiling: 3 }) } });
// An end the stage checker could not give today: handwritten, so the table of the gates is tested on its own.
const ownerEnd = (why) => ({ version: 1, change: 'feat', kind: 'end', stage: 'approval', stageTitle: 'Owner\'s approval', end: { state: 'waiting-for-owner', why }, params: { id: 'feat' } });

test('change-state AC-3 state: an agent and a session step are running with no reason', () => {
  const session = build(rowOf('enable-auto-merge', { number: 12 }));
  assert.equal(session.kind, 'session');
  for (const [label, action] of [['an agent', planStage()], ['a session step', session]]) {
    const s = stateOf(action);
    assert.deepEqual([s.state, s.reason, s.stateIcon], ['running', null, null], label);
    assert.deepEqual([s.stage, s.stageTitle], [action.stage, action.stageTitle], `${label}: the stage is the action's`);
  }
});

test('change-state AC-3 state: the grill waits for the owner with the reason grill', () => {
  const s = stateOf(grillOf());
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'grill', text: 'your answers about its request' });
  assert.deepEqual([s.stage, s.stageIcon, s.stateIcon], ['requirements', '❓', '🙋']);
});

test('change-state AC-3 state: each end waiting for the owner keeps its why as the reason, with its gate phrase', async (t) => {
  const gates = {
    'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge', 'waiting-archive-merge': 'merge',
    'waiting-review-dispute': 'dispute', 'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-pr-decision': 'decision',
  };
  for (const [why, gate] of Object.entries(gates)) {
    await t.test(why, () => {
      const s = stateOf(ownerEnd(why));
      assert.equal(s.state, 'waiting-for-owner');
      assert.deepEqual(s.reason, { code: why, text: MESSAGES.en[`gate.${gate}`] });
    });
  }
  // The same end as decide gives it.
  assert.deepEqual(stateOf(approvalEnd()).reason, { code: 'waiting-approval', text: 'your approval of the plan' });
});

test('change-state AC-3 state: an unknown wait for the owner throws', () => {
  assert.throws(() => stateOf(ownerEnd('waiting-nothing-we-know')), LoopUsageError);
});

test('change-state AC-3 state: each wait on GitHub takes what it waits for as the reason', async (t) => {
  const cases = {
    checks: [build(rowOf('wait-checks', { pending: ['build'] })), 'the checks of the pull request'],
    merge: [build(rowOf('wait-merge', { number: 12 })), 'the merge of the pull request'],
    'archive-merge': [build(rowOf('wait-merge', { number: 12 }), { archiving: true }), 'the merge of the archive pull request'],
    silent: [silentEnd(), 'GitHub did not answer'],
  };
  for (const [what, [action, text]] of Object.entries(cases)) {
    await t.test(what, () => {
      const s = stateOf(action);
      assert.equal(s.state, 'waiting-on-github');
      assert.deepEqual(s.reason, { code: what, text });
      assert.equal(s.stateIcon, '⏳');
    });
  }
});

test('change-state AC-3 state: each blocked reason decide gives is the reason, with its phrase and details', async (t) => {
  const notDelivered = run({
    facts: { after: 'proposal/proposal@000000000000' },
    rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } },
  });
  const cases = {
    ceiling: ceilingEnd(),
    'no-progress': run({ rep: { end: endOf('blocked', 'proposal', 'no-progress', { stage: 'proposal' }) } }),
    'not-delivered': notDelivered,
    'pr-closed': run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) } }),
    'previous-script': run({ report: { ...reportOf(FLOWS.devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } } }),
    'not-opened': run({ rep: { next: nextOf(FLOWS.devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } } }),
    'wrong-branch': build(rowOf('stop-branch')),
    'merge-setup': build(rowOf('stop-merge-setup')),
    'archive-failed': build(rowOf('stop-archive')),
    'tag-elsewhere': build(rowOf('stop-archive', { archiveStep: 'tag-release', tag: 'v1.3.0', at: 'd4e5f60abc', sha: 'a1b2c3dabc', number: 12 })),
    'plan-not-approved': build(rowOf('stop-not-approved')),
    'pr-problem': build(rowOf('blocked')),
    'unknown-step': run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'something-new') } }),
    unreadable: run({ rep: buildRep(), facts: { row: { error: 'boom' } } }),
  };
  for (const [why, action] of Object.entries(cases)) {
    await t.test(why, () => {
      assert.equal(action.end.why, why, 'the fixture is the end decide gives');
      const s = stateOf(action);
      assert.equal(s.state, 'blocked');
      assert.equal(s.reason.code, why);
      assert.ok(action.reply.includes(s.reason.text), `the phrase "${s.reason.text}" is the one inside the reply`);
      assert.equal(s.stateIcon, '⛔');
    });
  }
  assert.equal(stateOf(cases.ceiling).reason.text, 'the plan readiness failed 3 times, which is its limit');
  assert.equal(stateOf(cases['pr-closed']).reason.text, 'pull request #12 was closed without merging');
  assert.equal(stateOf(cases.unreadable).reason.text, 'the change cannot be read (boom)');
});

test('change-state AC-3 state: the drawn mock-up waits for the owner with its gate phrase, as an end and as a declared wait', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'owner-pending'), stages: { mockup: { state: 'pending', reasonCode: 'not-judged' } } } });
  assert.equal(a.end.why, 'waiting-mockup', 'the fixture is the end decide gives');
  const s = stateOf(a);
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'waiting-mockup', text: 'your approval of the mock-up' });
  assert.deepEqual([s.stage, s.stageIcon, s.stateIcon, s.title], ['mockup', '📝', '🙋', '🙋 📝 feat']);
  assert.equal(changeLoopModule.gateOf(a), 'mockup');
  const facts = { sessionMode: true, started: true, inflight: null, declared: { state: 'waiting-for-owner', why: 'waiting-mockup', params: {} }, waits: false };
  assert.deepEqual(stateOf(a, facts).reason, { code: 'waiting-mockup', text: 'your approval of the mock-up' });
});

test('change-budget AC-1 state: the budget end waits for the owner with its gate phrase, as an end and as a declared wait', () => {
  const a = run({ ...AT_PLAN(), facts: withBudget(2000000) });
  assert.equal(a.end.why, 'waiting-budget', 'the fixture is the end decide gives');
  const s = stateOf(a);
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'waiting-budget', text: 'a higher token budget' });
  assert.equal(s.stateIcon, '🙋');
  assert.equal(changeLoopModule.gateOf(a), 'budget');
  const facts = { sessionMode: true, started: true, inflight: null, declared: { state: 'waiting-for-owner', why: 'waiting-budget', params: {} }, waits: false };
  assert.deepEqual(stateOf(a, facts).reason, { code: 'waiting-budget', text: 'a higher token budget' });
  assert.equal(stateOf(a, facts, { lang: 'pt-BR' }).reason.text, 'um orçamento de tokens maior');
});

test('change-state AC-3 state: a stage role of the decisions stage has its icon', () => {
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'decisions' }).title, '📝 feat');
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'mockup' }).title, '📝 feat');
});

test('change-state AC-3 state: a blocked end the stage roles added keeps its why with a filled phrase in both languages', async (t) => {
  const params = { error: 'boom', list: 'build', base: 'main', number: 7, stage: 'proposal' };
  for (const why of ['cannot-accept', 'checks-failing', 'merge-setup-missing', 'branch-conflict', 'archive-refused', 'undeclared-stage']) {
    await t.test(why, () => {
      for (const lang of ['en', 'pt-BR']) {
        const s = changeState({ kind: 'end', change: 'feat', stage: 'delivery', end: { state: 'blocked', why }, params }, null, { lang });
        assert.equal(s.state, 'blocked');
        assert.equal(s.reason.code, why);
        assert.ok(s.reason.text && !/[{}]/.test(s.reason.text), `${lang}: ${s.reason.text}`);
      }
    });
  }
});

test('change-state AC-3 state: an archived end has no reason', () => {
  const archived = run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } });
  const s = stateOf(archived);
  assert.deepEqual([s.state, s.reason, s.stage, s.stageIcon, s.stateIcon], ['archived', null, null, '📦', '📦']);
});

test('change-state AC-3 state: the phrase is in the person\'s language and the code is not', () => {
  const cases = { owner: approvalEnd(), blocked: ceilingEnd(), github: build(rowOf('wait-checks', { pending: ['build'] })) };
  for (const [label, action] of Object.entries(cases)) {
    const en = stateOf(action);
    const pt = changeState(action, null, { lang: 'pt-BR' });
    assert.equal(pt.reason.code, en.reason.code, `${label}: the code is the same`);
    assert.notEqual(pt.reason.text, en.reason.text, `${label}: the phrase is not`);
  }
  assert.equal(changeState(cases.owner, null, { lang: 'pt-BR' }).reason.text, MESSAGES['pt-BR']['gate.approval']);
  assert.equal(changeState(cases.github, null, { lang: 'pt-BR' }).reason.text, MESSAGES['pt-BR']['what.checks']);
  assert.equal(changeState(cases.owner, null, { lang: 'fr' }).reason.text, MESSAGES['pt-BR']['gate.approval'], 'an unknown language is pt-BR, as everywhere');
});

test('change-state AC-4 facts: runFactsOf reads each field of the run file', async (t) => {
  const file = (over = {}) => ({ changeSessions: true, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [], ...over });
  await t.test('sessionMode needs the run\'s mode and the roadmap line', () => {
    assert.equal(runFactsOf(file(), 'a', { onRoadmap: true }).sessionMode, true);
    assert.equal(runFactsOf(file(), 'a', { onRoadmap: false }).sessionMode, false, 'no roadmap line');
    assert.equal(runFactsOf(file({ changeSessions: false }), 'a', { onRoadmap: true }).sessionMode, false, 'no session per change');
  });
  await t.test('started is a record of the run file or the key session-start of this call', () => {
    assert.equal(runFactsOf(file({ startedSessions: { a: { at: null } } }), 'a', {}).started, true);
    assert.equal(runFactsOf(file({ after: { a: 'session-start' } }), 'a', {}).started, true);
    assert.equal(runFactsOf(file({ startedSessions: { b: { at: null } }, after: { a: 'implementation/x@1', b: 'session-start' } }), 'a', {}).started, false);
  });
  await t.test('inflight is the stage under way, cleared by a key of `after`', () => {
    const under = { kind: 'agent', stage: 'design', agentType: 'x', at: 't' };
    assert.deepEqual(runFactsOf(file({ inflight: { a: under } }), 'a', {}).inflight, under);
    assert.equal(runFactsOf(file({ inflight: { a: under }, after: { a: 'design/design@1' } }), 'a', {}).inflight, null);
    assert.equal(runFactsOf(file({ inflight: { b: under } }), 'a', {}).inflight, null);
  });
  await t.test('declared is the end the session declared, or null', () => {
    const d = { state: 'blocked', why: 'pr-problem', params: {} };
    assert.deepEqual(runFactsOf(file({ declared: { a: d } }), 'a', {}).declared, d);
    assert.equal(runFactsOf(file({ declared: { b: d } }), 'a', {}).declared, null);
  });
  await t.test('waits is starting or an announced wait for a turn or a place, and nothing else', () => {
    assert.equal(runFactsOf(file({ starting: ['a'] }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'waits-turn' } }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'waits-refused' } }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'archived' } }), 'a', {}).waits, false);
    assert.equal(runFactsOf(file(), 'a', {}).waits, false);
  });
});

test('change-state AC-4 state: S1 to S8 each give their state', async (t) => {
  const F = (over = {}) => ({ sessionMode: false, started: false, inflight: null, declared: null, waits: false, ...over });
  const plan = planStage();
  const owner = approvalEnd();
  const standIn = { kind: 'none', change: 'x', stage: 'open', stageTitle: 'Open the change' };
  const reasonOf = (s) => (s.reason ? s.reason.code : null);
  await t.test('S1 a session per change and a declared end: the declared end', () => {
    const blockedEnd = { state: 'blocked', why: 'ceiling', params: { stage: 'Plan readiness', attempt: 3 } };
    const s = stateOf(plan, F({ sessionMode: true, started: true, declared: blockedEnd, inflight: { kind: 'agent', stage: 'design' } }));
    assert.deepEqual([s.state, reasonOf(s), s.reason.text, s.stage], ['blocked', 'ceiling', 'the plan readiness failed 3 times, which is its limit', 'proposal']);
    const waits = stateOf(null, F({ sessionMode: true, declared: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: {} } }), { id: 'x' });
    assert.deepEqual([waits.state, reasonOf(waits), waits.reason.text, waits.stage], ['waiting-for-owner', 'waiting-pr-decision', 'a decision only you can take', null]);
    const named = stateOf(null, F({ sessionMode: true, declared: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: { gate: 'merge' } } }), { id: 'x' });
    assert.equal(named.reason.text, 'your merge of its pull request', 'the declared gate wins');
    assert.equal(waits.title, '🙋 x', 'the id of the options is the title\'s when there is no action');
  });
  await t.test('S2 a session of its own: the action says', () => {
    const running = stateOf(plan, F({ sessionMode: true, started: true }));
    assert.deepEqual([running.state, running.reason, running.stage], ['running', null, 'proposal']);
    assert.equal(stateOf(owner, F({ sessionMode: true, started: true })).state, 'waiting-for-owner');
    const none = stateOf(null, F({ sessionMode: true, started: true }), { id: 'x' });
    assert.deepEqual([none.state, none.reason, none.stage, none.title], ['running', null, null, null]);
  });
  await t.test('S3 a session per change and no session of its own yet: running, ready', () => {
    const s = stateOf(plan, F({ sessionMode: true }));
    assert.deepEqual([s.state, s.reason, s.stage, s.title], ['running', { code: 'ready', text: 'ready, waiting for someone to continue' }, 'proposal', '📝 feat']);
    assert.equal(stateOf(owner, F({ sessionMode: true })).reason.code, 'ready', 'whatever the action says');
  });
  await t.test('S4 a stage waiting on GitHub in flight: waiting on GitHub, what from the action, the run, then the merge', () => {
    assert.deepEqual(stateOf(null, F({ inflight: { kind: 'wait', what: 'checks' } }), { id: 'x' }).reason, { code: 'checks', text: 'the checks of the pull request' });
    assert.equal(stateOf(silentEnd(), F({ inflight: { kind: 'agent', stage: 'delivery' } })).reason.code, 'silent', 'an action that waits on GitHub wins');
    assert.equal(stateOf(null, F({ inflight: { kind: 'wait' } }), { id: 'x' }).reason.code, 'merge');
    assert.equal(stateOf(plan, F({ inflight: { kind: 'wait', what: 'checks' } })).state, 'waiting-on-github', 'the in-flight wait wins over the action');
  });
  await t.test('S5 a stage in flight: running, the action\'s stage or the one in flight', () => {
    const own = stateOf(plan, F({ inflight: { kind: 'agent', stage: 'design' } }));
    assert.deepEqual([own.state, own.reason, own.stage, own.stageTitle], ['running', null, 'proposal', plan.stageTitle]);
    const none = stateOf(null, F({ inflight: { kind: 'agent', stage: 'design' } }), { id: 'x' });
    assert.deepEqual([none.state, none.reason, none.stage, none.stageTitle, none.stageIcon], ['running', null, 'design', 'design', '📝']);
    assert.equal(stateOf(owner, F({ inflight: { kind: 'agent', stage: 'design' } })).state, 'running', 'in flight wins over a wait for the owner');
  });
  await t.test('S6 a declared end outside a session per change: the declared end', () => {
    const s = stateOf(plan, F({ declared: { state: 'blocked', why: 'pr-problem', params: {} } }));
    assert.deepEqual([s.state, reasonOf(s), s.stage], ['blocked', 'pr-problem', 'proposal']);
  });
  await t.test('S7 a start that waits for a place, a stand-in or no action: running, ready', () => {
    assert.equal(reasonOf(stateOf(plan, F({ waits: true }))), 'ready');
    const stand = stateOf(standIn, F());
    assert.deepEqual([stand.state, reasonOf(stand), stand.stage, stand.stageIcon, stand.title], ['running', 'ready', 'open', '❓', '❓ x']);
    assert.equal(reasonOf(stateOf(null, F(), { id: 'x' })), 'ready');
  });
  await t.test('S8 otherwise: the action says', () => {
    assert.equal(stateOf(owner, F()).state, 'waiting-for-owner');
    const s = stateOf(plan, F());
    assert.deepEqual([s.state, s.reason], ['running', null]);
  });
  await t.test('outside a roadmap run the state is the action\'s, with no ready', () => {
    assert.deepEqual([stateOf(plan).state, stateOf(plan).reason], ['running', null]);
    assert.deepEqual([stateOf(null, null, { id: 'x' }).state, stateOf(null, null, { id: 'x' }).reason], ['running', null]);
  });
});

test('change-state AC-5 decide: the pull request that cannot be read is a wait on GitHub, GitHub did not answer', () => {
  const a = silentEnd('gh-error');
  assert.deepEqual(shape(a), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(a.params.what, 'silent');
  assert.equal(a.detail.error, 'HTTP 502');
  assert.equal(a.reply, says('waiting-github', { what: 'silent' }));
  assert.match(a.reply, /GitHub did not answer/);
  // The plan part reads the same end the same way.
  const plan = run({ rep: { end: endOf('blocked', 'proposal', 'gh-error', { error: 'HTTP 502' }) } });
  assert.deepEqual(shape(plan), ['end', 'waiting-on-github', 'waiting-github', 1]);
});

test('change-state AC-5 decide: checks that cannot be read are a wait on GitHub, GitHub did not answer', () => {
  const a = silentEnd('checks-unreadable');
  assert.deepEqual(shape(a), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(a.params.what, 'silent');
  assert.equal(a.detail.error, 'HTTP 502');
  assert.equal(a.reply, says('waiting-github', { what: 'silent' }));
});

test('change-state AC-5 decide: a ceiling and a closed pull request still block', () => {
  const ceiling = run({ rep: { end: endOf('blocked', 'delivery', 'ceiling-reached', { stage: 'review', attempt: 3, ceiling: 3 }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
  assert.deepEqual(shape(ceiling), ['end', 'blocked', 'ceiling', 2]);
  const closed = run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
  assert.deepEqual(shape(closed), ['end', 'blocked', 'pr-closed', 2]);
});

test('change-state AC-5 githubSilent: true only for the two GitHub ends of the stage checker', async (t) => {
  const cases = [
    ['gh-error', endOf('blocked', 'delivery', 'gh-error', { error: 'x' }), true],
    ['checks-unreadable', endOf('blocked', 'delivery', 'checks-unreadable', { error: 'x' }), true],
    ['pr-closed', endOf('blocked', 'delivery', 'pr-closed', { number: 1 }), false],
    ['ceiling-reached', endOf('blocked', 'delivery', 'ceiling-reached', {}), false],
    ['a waiting end with the same code', endOf('waiting-on-github', 'delivery', 'gh-error', {}), false],
    ['null', null, false],
  ];
  for (const [label, end, wanted] of cases) await t.test(label, () => assert.equal(githubSilent(end), wanted));
});

test('change-state AC-5 where: whereOf says waiting on GitHub when GitHub did not answer', () => {
  const { wt, gh, env } = deliveredChange();
  const found = { root: wt, branch: 'feat' };
  assert.equal(changeLoopModule.whereOf(found, 'feat', { lang: 'en', env }), 'waiting on GitHub', 'the checks are pending');
  gh.set('pr-view', { exit: 1, stderr: 'HTTP 502: bad gateway\n' });
  assert.equal(changeLoopModule.whereOf(found, 'feat', { lang: 'en', env }), 'waiting on GitHub', 'GitHub did not answer');
});

const silentAction = () => silentEnd('gh-error');

test('change-state AC-5 wait: a silent wait counts as a failed read and three end blocked quoting the error', async () => {
  const silent = silentAction();
  assert.equal(silent.end.state, 'waiting-on-github', 'the fixture is a wait');
  const out = await waited([WAIT, silent, silent, silent]);
  assert.deepEqual([out.action.kind, out.action.end, out.action.change], ['end', { state: 'blocked', why: 'github-unreadable' }, 'feat']);
  assert.equal(out.action.reply, render('en', 'blocked', { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' }));
  assert.equal(out.polls, 4, 'it stopped at the third failed read in a row');
  const kept = await waited([WAIT, silent, silent, WAIT, silent, silent, build(rowOf('enable-auto-merge', { number: 12 }))]);
  assert.equal(kept.action.step, 'enable-auto-merge', 'two in a row, then an answer, keeps waiting');
});

test('change-state AC-5 wait: a first decision that is silent waits, and GitHub answering ends the wait with the new decision', async () => {
  const silent = silentAction();
  assert.equal(silent.end.state, 'waiting-on-github', 'the fixture is a wait');
  const answered = await waited([silent, WAIT]);
  assert.deepEqual(answered.action, WAIT);
  assert.equal(answered.polls, 2);
  const changed = build(rowOf('enable-auto-merge', { number: 12 }));
  const later = await waited([silent, silent, changed]);
  assert.deepEqual(later.action, changed);
  assert.equal(later.polls, 3);
});

test('change-state AC-5 wait: the blocked form project-loop gives still counts as a failed read', async () => {
  const unreadable = {
    version: 1, change: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', filesLanguage: 'en', kind: 'end', stage: 'delivery', stageTitle: 'Delivery', role: null, skills: [],
    end: { state: 'blocked', why: 'github-unreadable' }, params: { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' },
    reply: render('en', 'blocked', { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' }),
  };
  const out = await waited([WAIT, unreadable, unreadable, unreadable]);
  assert.deepEqual(out.action.end, { state: 'blocked', why: 'github-unreadable' });
  assert.equal(out.polls, 4);
});

test('change-state AC-7 title: a running change is its stage icon and its id', () => {
  assert.equal(stateOf(planStage()).title, '📝 feat');
  assert.equal(stateOf(build(rowOf('enable-auto-merge', { number: 12 }))).title, '🚀 feat');
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'nope' }).title, null, 'no stage icon, no title');
});

test('change-state AC-7 title: waiting for the owner is 🙋, a space, the stage icon and the id', () => {
  assert.equal(stateOf(grillOf()).title, '🙋 ❓ feat');
  assert.equal(stateOf(approvalEnd()).title, '🙋 📝 feat');
  assert.equal(titleOf('📝', 'a', '🙋'), '🙋 📝 a', 'the third argument is the state icon');
  assert.equal(titleOf('📝', 'a'), '📝 a', 'the two-argument form is unchanged');
});

test('change-state AC-7 title: waiting on GitHub is ⏳ and the stage icon', () => {
  assert.equal(stateOf(build(rowOf('wait-checks', { pending: ['build'] }))).title, '⏳ 🚀 feat');
  assert.equal(stateOf(silentEnd()).title, '⏳ 🚀 feat');
});

test('change-state AC-7 title: blocked is ⛔ and the stage icon, or ⛔ alone with no stage', () => {
  const atCode = run({ rep: { end: endOf('blocked', 'implementation', 'ceiling-reached', { stage: 'implementation', attempt: 3, ceiling: 3 }) } });
  assert.equal(stateOf(atCode).title, '⛔ 🛠️ feat');
  const previous = run({ report: { ...reportOf(FLOWS.devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } } });
  assert.equal(stateOf(previous).title, '⛔ feat');
});

test('change-state AC-7 title: archived is 📦 and the id alone', () => {
  const archived = run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } });
  assert.equal(stateOf(archived).title, '📦 feat');
  assert.deepEqual(STATE_ICON, { 'waiting-for-owner': '🙋', 'waiting-on-github': '⏳', blocked: '⛔', archived: '📦' });
});

test('change-state AC-7 title: every form of a 70-character id is cut to 59 code points', async (t) => {
  const ctx = { id: 'x'.repeat(70) };
  const forms = {
    running: [planStage({ ctx }), '📝 xxx'],
    owner: [grillOf({ ctx }), '🙋 ❓ xxx'],
    github: [run({ ctx, rep: buildRep(), facts: { row: rowOf('wait-checks', { pending: ['build'] }) } }), '⏳ 🚀 xxx'],
    blocked: [ceilingEnd({ ctx }), '⛔ 📝 xxx'],
    archived: [run({ ctx, report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } }), '📦 xxx'],
  };
  for (const [label, [action, prefix]] of Object.entries(forms)) {
    await t.test(label, () => {
      assert.equal(action.change, ctx.id);
      const title = stateOf(action).title;
      assert.ok(title.startsWith(prefix), `${label}: ${title}`);
      assert.equal([...title].length, 59, label);
    });
  }
});

test('change-state AC-7 next: every action carries its state and its sessionTitle is the state\'s title', () => {
  const read = (root, extra = [], env = cleanEnv, opts = {}) => parsed(next(root, extra, env, opts)).action;
  const archivedRoot = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const none = () => ({ status: 1, stdout: '', stderr: '' });
  const cases = [
    ['the grill', read(planChange({ have: [] })), 'waiting-for-owner', '🙋 ❓ feat'],
    ['a plan stage', read(planChange({ have: ['requirements'] })), 'running', '📝 feat'],
    ['the approval', read(planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] })), 'waiting-for-owner', '🙋 📝 feat'],
    ['the previous script', read(planChange({ have: ['requirements', 'proposal'], headerless: true })), 'blocked', '⛔ feat'],
    ['archived', read(archivedRoot, [], cleanEnv, { openspec: none, gh: none }), 'archived', '📦 feat'],
  ];
  for (const [label, action, state, title] of cases) {
    assert.equal(action.state.state, state, `${label}: the state`);
    assert.equal(action.state.title, title, `${label}: the title`);
    assert.equal(action.sessionTitle, title, `${label}: sessionTitle is the state's title`);
    assert.equal(action.icon, changeLoopModule.stageIcon(action), `${label}: the icon stays`);
  }
});

// ---------------------------------------------------------------- change-state: phase 2, the state command (design D-3, D-9)

const stateCmd = (cwd, extra = [], env = cleanEnv, opts = {}) => main(['state', '--lang', 'en', ...extra], { cwd, env, ...opts });
const entriesOfRun = (r) => { assert.equal(r.code, 0, r.stdout + r.stderr); return JSON.parse(r.stdout).changes; };
const entryOf = (r) => { const list = entriesOfRun(r); assert.equal(list.length, 1); return list[0]; };
const noGh = () => ({ status: 1, stdout: '', stderr: 'offline' });
const answeringGh = () => ({ status: 0, stdout: '[]', stderr: '' });
const writeRunFile = (cwd, patch) => {
  const file = changeLoopModule.runFilePath(cwd);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, places: 1, ...patch }));
};
const roadmapOfIds = (...ids) => `# Roadmap\n\n## Round 1: x\n${ids.map((id) => `- [ ] ${id}`).join('\n')}\n`;
const withRoadmap = (root, ...ids) => { put(root, { 'openspec/roadmap.md': roadmapOfIds(...ids) }); commitAll(root, 'roadmap'); return root; };
const noMarker = /devkit-(run|end):/;

test('change-state AC-1 command: one change prints its state, reason, stage and title in the person\'s language', () => {
  const root = approvedChange();
  const r = stateCmd(root, ['--change', 'feat']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, `${JSON.stringify({ version: 1, changes: [{
    change: 'feat', state: 'waiting-for-owner', reason: { code: 'waiting-approval', text: 'your approval of the plan' },
    stage: 'approval', stageTitle: 'Owner\'s approval', phase: null, stageIcon: '📝', stateIcon: '🙋', title: '🙋 📝 feat',
    script: 'devkit', root: realpathSync(root), branch: 'main',
  }] }, null, 2)}\n`);
  const pt = entryOf(stateCmd(root, ['--change', 'feat'], cleanEnv, {}) && main(['state', '--change', 'feat', '--lang', 'pt-BR'], { cwd: root, env: cleanEnv }));
  assert.deepEqual([pt.state, pt.reason.code, pt.stage, pt.stateIcon, pt.title], ['waiting-for-owner', 'waiting-approval', 'approval', '🙋', '🙋 📝 feat']);
  assert.equal(pt.reason.text, render('pt-BR', 'gate.approval'));
  assert.equal(pt.stageTitle, stageOf(FLOWS.devkit, 'approval').title['pt-BR']);
  assert.notEqual(pt.reason.text, 'your approval of the plan');
});

test('change-state AC-1 command: the output holds no run marker', () => {
  const blocked = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  const waiting = approvedChange();
  for (const [label, root, state] of [['blocked', blocked, 'blocked'], ['waiting', waiting, 'waiting-for-owner']]) {
    const r = stateCmd(root, ['--change', 'feat']);
    assert.equal(entryOf(r).state, state, label);
    assert.doesNotMatch(r.stdout, noMarker, label);
    assert.doesNotMatch(r.stderr, noMarker, label);
    assert.doesNotMatch(stateCmd(root).stdout, noMarker, `${label}, every change`);
  }
});

test('change-state AC-1 command: nothing is written', () => {
  const root = withRoadmap(approvedChange(), 'feat');
  const snapshot = (cwd) => ({ status: git(cwd, 'status', '--porcelain'), worktrees: git(cwd, 'worktree', 'list'), run: existsSync(changeLoopModule.runFilePath(cwd)) ? readFileSync(changeLoopModule.runFilePath(cwd), 'utf8') : null });
  assert.equal(snapshot(root).run, null, 'the fixture has no run file');
  const before = snapshot(root);
  entriesOfRun(stateCmd(root));
  entriesOfRun(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual(snapshot(root), before, 'no run file is created');
  writeRunFile(root, { changeSessions: true, declared: { feat: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } } });
  const withRun = snapshot(root);
  assert.ok(withRun.run.includes('tests-red'));
  entriesOfRun(stateCmd(root));
  assert.deepEqual(snapshot(root), withRun, 'the run file, the tree and the worktrees are the same');
});

test('change-state AC-1 command: an unknown change exits 3 with the plain reply', () => {
  const root = approvedChange();
  const r = stateCmd(root, ['--change', 'nope']);
  assert.equal(r.code, 3);
  const out = JSON.parse(r.stdout);
  assert.equal(out.reply, render('en', 'request-unreadable'));
  assert.match(out.error, /no change named nope/);
  assert.equal(out.changes, undefined, 'no state is printed');
  assert.doesNotMatch(out.reply, /nope/);
});

test('change-state AC-1 command: an unknown option and a stray word exit 3 with the plain reply', () => {
  const root = approvedChange();
  const cases = [[['--bogus'], /unknown option --bogus/], [['--change', 'feat', '--bogus', 'x'], /unknown option --bogus/], [['feat'], /\bstate\b/], [['--change', 'feat', 'extra'], /\bstate\b/]];
  for (const [extra, error] of cases) {
    const r = stateCmd(root, extra);
    assert.equal(r.code, 3, extra.join(' '));
    const out = JSON.parse(r.stdout);
    assert.equal(out.reply, render('en', 'request-unreadable'), extra.join(' '));
    assert.match(out.error, error, extra.join(' '));
    assert.equal(out.changes, undefined, extra.join(' '));
  }
});

// ---------------------------------------------------------------- change-state AC-2: every change in play

const OPEN = { '.openspec.yaml': 'schema: devkit\n' };

test('change-state AC-2 command: every open change and every change the run file lists, each once, in id order', () => {
  const t = roundRepo({ roadmap: roadmapOfIds('a', 'b', 'c', 'd', 'e', 'f'), config: 'schema: devkit\n', changes: { b: OPEN, a: OPEN } });
  const wt = t.addWt('c');
  put(wt, { 'openspec/changes/c/.openspec.yaml': 'schema: devkit\n' });
  writeRunFile(t.main, {
    starting: ['d'], declared: { e: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } }, announced: { f: 'waits-turn' },
    inflight: { d: { kind: 'agent', stage: 'open', at: '2026-11-21T10:00:00.000Z' } },
  });
  const list = entriesOfRun(stateCmd(t.main, [], cleanEnv, { gh: noGh }));
  assert.deepEqual(list.map((e) => e.change), ['a', 'b', 'c', 'd', 'e', 'f']);
  const byId = Object.fromEntries(list.map((e) => [e.change, e]));
  assert.equal(byId.c.root, wt, 'c is read in its own worktree');
  assert.deepEqual([byId.e.state, byId.e.reason.code], ['blocked', 'cannot-open']);
  for (const id of ['d', 'f']) assert.deepEqual([byId[id].state, byId[id].script, byId[id].root, byId[id].branch], ['running', null, null, null], id);
});

test('change-state AC-2 command: a slice, a change archived on the default branch and one the run file announced archived are not listed', () => {
  const t = roundRepo({
    roadmap: roadmapOfIds('a'), config: 'schema: devkit\n',
    changes: { a: OPEN, slice: { '.openspec.yaml': 'schema: devkit-project\n' }, 'archive/2026-11-19-done': { '.openspec.yaml': 'schema: devkit\n' } },
  });
  writeRunFile(t.main, { announced: { gone: 'archived' } });
  const list = entriesOfRun(stateCmd(t.main, [], cleanEnv, { gh: noGh }));
  assert.deepEqual(list.map((e) => e.change), ['a']);
});

test('change-state AC-2 command: nothing in play prints an empty list', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const r = stateCmd(root, [], cleanEnv, { gh: noGh });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, changes: [] });
  assert.equal(existsSync(changeLoopModule.runFilePath(root)), false);
});

// ---------------------------------------------------------------- change-state AC-3, AC-5: the command against next

const NEXT_ONLY = ['change', 'script', 'root', 'branch'];
const lessIdentity = (entry) => Object.fromEntries(Object.entries(entry).filter(([k]) => !NEXT_ONLY.includes(k)));
const silentDelivery = () => {
  const d = deliveredChange();
  d.gh.set('pr-view', { exit: 1, stderr: 'HTTP 502: bad gateway\n' });
  return d;
};

test('change-state AC-3 cli: next and state give the same state for the same files and GitHub answers', async (t) => {
  const none = () => ({ status: 1, stdout: '', stderr: '' });
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const pending = deliveredChange();
  const silent = silentDelivery();
  const cases = [
    ['a plan stage handed out', planChange({ have: ['requirements'] }), cleanEnv, {}, 'running'],
    ['the grill', planChange({ have: [] }), cleanEnv, {}, 'waiting-for-owner'],
    ['the approval', approvedChange(), cleanEnv, {}, 'waiting-for-owner'],
    ['a ceiling', planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } }), cleanEnv, {}, 'blocked'],
    ['archived', archived, cleanEnv, { openspec: none, gh: none }, 'archived'],
    ['checks pending', pending.t.main, pending.env, {}, 'waiting-on-github'],
    ['GitHub silent', silent.t.main, silent.env, {}, 'waiting-on-github'],
  ];
  for (const [label, root, env, opts, state] of cases) {
    await t.test(label, () => {
      const fromNext = parsed(next(root, [], env, opts)).action;
      const entry = entryOf(stateCmd(root, ['--change', 'feat'], env, opts));
      assert.equal(entry.state, state);
      assert.deepEqual(lessIdentity(entry), fromNext.state, 'the same state, reason, stage and title');
      assert.equal(entry.change, 'feat');
    });
  }
});

test('change-state AC-5 delivery: with GitHub silent a change at its delivery prints waiting on GitHub', () => {
  const { t, env } = silentDelivery();
  const r = next(t.main, [], env);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const entry = entryOf(stateCmd(t.main, ['--change', 'feat'], env));
  assert.deepEqual([entry.state, entry.reason.code, entry.reason.text, entry.title], ['waiting-on-github', 'silent', 'GitHub did not answer', '⏳ 🚀 feat']);
});

test('change-state AC-5 plan: with GitHub silent the grill, a plan stage and the approval keep their state', async (t) => {
  const cases = [['the grill', () => planChange({ have: [] })], ['a plan stage', () => planChange({ have: ['requirements'] })], ['the approval', approvedChange]];
  for (const [label, make] of cases) {
    await t.test(label, () => {
      const root = make();
      const answering = { env: cleanEnv, gh: answeringGh };
      const silent = { env: cleanEnv, gh: noGh };
      const nextSilent = parsed(next(root, [], silent.env, { gh: silent.gh })).action;
      const nextAnswering = parsed(next(root, [], answering.env, { gh: answering.gh })).action;
      assert.deepEqual(nextSilent.state, nextAnswering.state, 'next');
      const fromSilent = entryOf(stateCmd(root, ['--change', 'feat'], silent.env, { gh: silent.gh }));
      const fromAnswering = entryOf(stateCmd(root, ['--change', 'feat'], answering.env, { gh: answering.gh }));
      assert.deepEqual(fromSilent, fromAnswering, 'the command');
      assert.notEqual(fromSilent.state, 'waiting-on-github');
      assert.deepEqual(lessIdentity(fromSilent), nextSilent.state);
    });
  }
});

test('change-state AC-5 build: with GitHub silent the implementation and the code review keep the loop\'s action', async (t) => {
  const breakGh = (d) => { for (const call of ['pr-view', 'pr-checks', 'api-graphql']) d.gh.set(call, { exit: 1, stderr: 'HTTP 502: bad gateway\n' }); };
  const cases = [
    ['the implementation', (d) => { put(d.wt, { 'openspec/changes/feat/tasks.md': '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n' }); commitAll(d.wt, 'a task left'); }],
    ['the code review', (d) => { put(d.wt, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': 'Verdict: rejected\nCommit: 0000000\n' }); commitAll(d.wt, 'a review stale'); }],
  ];
  for (const [label, change] of cases) {
    await t.test(label, () => {
      const d = deliveredChange();
      change(d);
      breakGh(d);
      const action = parsed(next(d.t.main, [], d.env)).action;
      const entry = entryOf(stateCmd(d.t.main, ['--change', 'feat'], d.env));
      assert.deepEqual(lessIdentity(entry), action.state, `${label}: ${action.stage} ${action.kind}`);
    });
  }
});

// ---------------------------------------------------------------- change-state AC-4: the run file through the command

test('change-state AC-4 command: a roadmap change with no session of its own is running, ready', () => {
  const root = withRoadmap(approvedChange(), 'feat');
  writeRunFile(root, { changeSessions: true });
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason, e.stage, e.title], ['running', { code: 'ready', text: 'ready, waiting for someone to continue' }, 'approval', '📝 feat']);
  writeRunFile(root, { changeSessions: true, startedSessions: { feat: { at: null } } });
  const own = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([own.state, own.reason.code, own.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat'], 'with its session the state is the loop\'s');
});

test('change-state AC-4 command: a start that waits for a place is running, ready, at the opening', () => {
  const root = withRoadmap(gitRepo({ config: 'schema: devkit\n' }), 'x');
  for (const patch of [{ starting: ['x'] }, { announced: { x: 'waits-turn' } }, { announced: { x: 'waits-refused' } }]) {
    writeRunFile(root, patch);
    const e = entryOf(stateCmd(root, ['--change', 'x'], cleanEnv, { gh: noGh }));
    assert.deepEqual([e.state, e.reason.code, e.stage, e.stageTitle, e.stageIcon, e.title, e.script, e.root, e.branch], ['running', 'ready', 'open', 'Open the change', '❓', '❓ x', null, null, null], JSON.stringify(patch));
    const pt = entryOf(main(['state', '--change', 'x', '--lang', 'pt-BR'], { cwd: root, env: cleanEnv, gh: noGh }));
    assert.equal(pt.stageTitle, stageOf(FLOWS.devkit, 'open').title['pt-BR']);
  }
});

test('change-state AC-4 command: no run file gives the loop\'s plain state', () => {
  const root = withRoadmap(planChange({ have: ['requirements'] }), 'feat');
  assert.equal(existsSync(changeLoopModule.runFilePath(root)), false);
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason, e.stage, e.title], ['running', null, 'decisions', '📝 feat']); // the stage after requirements in the devkit script since stage-roles
});

test('change-state AC-4 command: a change off the roadmap gets no ready reason in a session-per-change run', () => {
  const root = withRoadmap(approvedChange(), 'other');
  writeRunFile(root, { changeSessions: true });
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason.code, e.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat']);
});

test('change-state ADR 0017: the documents follow', () => {
  const name = '0017-a-change-state-is-derived-in-one-place.md';
  const adr = readRepo('docs', 'adr', name);
  assert.equal(adr.split('\n')[0], '# ADR 0017: A change\'s state is derived in one place, and a stopped change\'s session title shows it');
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0017 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Change: change-state$/m);
  assert.match(adr, /^- Amends: ADR 0014 \(0014-each-roadmap-change-runs-in-a-session-of-its-own\.md\), decision 3, the title of a change session$/m);
  // The change folder moves to openspec/changes/archive/<date>-change-state/ when the change is archived.
  const changesDir = join(REPO_ROOT, 'openspec', 'changes');
  const archived = existsSync(join(changesDir, 'archive')) ? readdirSync(join(changesDir, 'archive')).filter((d) => /^\d{4}-\d{2}-\d{2}-change-state$/.test(d)).sort() : [];
  const approvalPath = existsSync(join(changesDir, 'change-state', 'approval.md')) ? join(changesDir, 'change-state', 'approval.md') : join(changesDir, 'archive', archived[archived.length - 1] ?? '', 'approval.md');
  const approval = readFileSync(approvalPath, 'utf8');
  const date = approval.match(/^- Date: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  const words = approval.match(/^- Owner's words: "(.+)"$/m)?.[1].replaceAll('`', '');
  assert.ok(date && words, 'approval.md has its date and the owner\'s words');
  assert.match(adr, new RegExp(`^- Accepted by: the owner, on ${date}, in the message that approved the plan of the change: \`${words}\`; recorded in \`openspec/changes/change-state/approval\\.md\`$`, 'm'));
  for (const icon of ['🙋', '⏳', '⛔', '📦']) assert.ok(adr.includes(icon), `ADR 0017 names ${icon}`);
  const link = `[ADR 0017](${name})`;
  const adr14 = readRepo('docs', 'adr', '0014-each-roadmap-change-runs-in-a-session-of-its-own.md');
  assert.ok(adr14.split('\n').slice(0, 8).includes(`- Amended by ADR 0017 (${name})`), 'ADR 0014 has the Amended by line in its header');
  const adr10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  for (const t of [adr14, adr10]) {
    assert.match(t, /Note \(change-state, 2026-11-22\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0017');
  }
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0017 a change's state is derived in one place and a stopped change's title shows it, amends 0014/);
  const flow = readRepo('docs', 'openspec-flow.md');
  const a = flow.indexOf("**A change's state.**");
  assert.ok(a > flow.indexOf('**Waiting on GitHub.**'), 'the paragraph follows "Waiting on GitHub"');
  const part = flow.slice(a, flow.indexOf('\n\n', a)).replace(/\s+/g, ' ');
  assert.ok(part.includes('ADR 0017'), 'the paragraph cites ADR 0017');
  assert.doesNotMatch(flow, /\(ready, waits for a place\)/);
});

// ================================================================ commit-attribution (D-7, T1 to T20)

const ASK = () => changeLoopModule.ATTRIBUTION_ASK;
const LANGUAGE_SENTENCE = "Write the change's files in English.";
const COMMIT_ROWS = {
  commit: { paths: [] },
  'open-pr': { number: 12 },
  push: { number: 12 },
  'open-archive-pr': { branch: 'chore/archive-feat', title: 't' },
  'push after a release merge': { number: 12, branch: 'feat', command: ['git', 'push', 'origin', 'feat'] },
};

for (const [n, step] of [[1, 'commit'], [2, 'open-pr'], [3, 'push'], [4, 'open-archive-pr'], [5, 'push after a release merge']]) {
  test(`commit-attribution AC-1 T${n} the ${step} hand-off to the commit agent ends with the attribution request once`, () => {
    const a = build(rowOf(step === 'push after a release merge' ? 'push' : step, COMMIT_ROWS[step]));
    assert.equal(a.agent, COMMIT);
    assert.doesNotMatch(JSON.stringify(a), /--force|push-rebased/, 'a plain push, never a rewrite');
    assert.ok(ASK().length > 0, 'the request is exported');
    assert.ok(a.brief.endsWith(ASK()), a.brief);
    assert.equal(a.brief.split(ASK()).length - 1, 1, 'the request is there once');
    assert.ok(a.brief.slice(0, -ASK().length).endsWith(LANGUAGE_SENTENCE), a.brief);
  });
}

const NO_REQUEST = [
  [6, 'implement', () => build(rowOf('implement', { phase: 1 }))],
  [7, 'resolve-release-conflict', () => build(rowOf('resolve-release-conflict', { number: 12, paths: ['CHANGELOG.md'], base: 'main', command: ['git', 'merge', 'origin/main'] }))],
  [8, 'verify', () => build(rowOf('verify'))],
  [9, 'proposal', () => run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file') } })],
  [10, 'readiness', () => run({ rep: { next: nextOf(FLOWS.devkit, 'readiness', 'no-file') } })],
];
for (const [n, label, make] of NO_REQUEST) {
  test(`commit-attribution AC-1 T${n} the ${label} hand-off does not carry the attribution request`, () => {
    const a = make();
    assert.equal(a.kind, 'agent');
    assert.ok(ASK().length > 0, 'the request is exported');
    assert.ok(!a.brief.includes(ASK()), a.brief);
    assert.ok(a.brief.endsWith(LANGUAGE_SENTENCE), a.brief);
  });
}

test('commit-attribution AC-1 T11 a commit step handed to another agent carries no request', () => {
  const a = build(rowOf('commit', { agent: TDD, paths: [] }));
  assert.equal(a.agent, TDD);
  assert.ok(ASK().length > 0, 'the request is exported');
  assert.ok(!a.brief.includes(ASK()), a.brief);
});

test('commit-attribution AC-1 T12 withAttribution appends the request for the commit agent', () => {
  assert.equal(changeLoopModule.withAttribution(changeLoopModule.COMMIT_AGENT, 'x'), `x${ASK()}`);
});

test('commit-attribution AC-1 T13 withAttribution leaves another agent\'s text as it is', () => {
  assert.equal(changeLoopModule.withAttribution('devkit-core:tdd-implementer', 'x'), 'x');
});

test('commit-attribution AC-1 T14 withAttribution leaves a text with no agent as it is', () => {
  assert.equal(changeLoopModule.withAttribution(undefined, 'x'), 'x');
});

test('commit-attribution AC-1 T15 the request names the header, the labels, none and verbatim, and no line of its own', () => {
  const ask = ASK();
  assert.ok(ask.includes(changeLoopModule.ATTRIBUTION_HEADER), 'the header');
  for (const part of ['`Commit trailer: <line>`', '`PR footer: <line>`', '`Attribution (from the caller): none`', 'verbatim']) assert.ok(ask.includes(part), part);
  assert.doesNotMatch(ask, /Claude|Sonnet|Opus|Haiku|noreply|@|🤖/);
});

const devkitLine = (start) => skillText().split('\n').find((l) => l.startsWith(start)) ?? '';
const BLOCK_SENTENCE = "the attribution block of the `ship-change` skill's Attribution section";
for (const [n, label, start] of [
  [16, 'Loop agent item', '- `agent`: one Agent call'],
  [17, 'Loop agent item (the plain push after a release merge)', '- `agent`: one Agent call'],
  [18, 'roadmap agent item', '   - `agent`: hand every one'],
  [19, 'project agent item', '   - `agent`: as the Loop of the change sections says'],
]) {
  test(`commit-attribution AC-1 T${n} the ${label} of the devkit skill names the block for the commit agent`, () => {
    const line = devkitLine(start);
    assert.ok(line.length > 0, `the line starting ${start}`);
    assert.ok(line.includes('devkit-core:commit-and-pr'), line);
    assert.ok(line.includes(BLOCK_SENTENCE), line);
  });
}

test('commit-attribution AC-1 T20 the request, the ship-change skill and the agent share one block format', () => {
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const shipSection = section(ship, '## Attribution', '\n## Loop');
  const agentMd = readFileSync(join(REPO_ROOT, 'plugins', 'core', 'agents', 'commit-and-pr.md'), 'utf8');
  const receives = section(agentMd, '## Receives', '## Preconditions');
  for (const part of [changeLoopModule.ATTRIBUTION_HEADER, 'Commit trailer:', 'PR footer:', 'Attribution (from the caller): none']) {
    assert.ok(ASK().includes(part), `the request: ${part}`);
    assert.ok(shipSection.includes(part), `the ship-change section: ${part}`);
    assert.ok(receives.includes(part), `the agent's Receives: ${part}`);
  }
});

// ---------------------------------------------------------------- roadmap-sessions-upfront, phase 5: the held state through changeState (design D-6, D-11)

const heldFacts = (over = {}) => ({ sessionMode: true, started: true, inflight: null, declared: null, waits: false, queued: null, occupied: false, waitsFor: null, ...over });
const AT_HELD = '2026-11-21T10:00:00.000Z';

test('upfront AC-10 facts: runFactsOf reads the change\'s queue entry, its place and its waitsFor, and no other change\'s', () => {
  const file = (over = {}) => ({
    changeSessions: true, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [],
    queued: { a: { at: AT_HELD, why: 'load' }, b: { at: AT_HELD, why: 'place' } }, occupied: { c: { at: AT_HELD } }, waitsFor: { a: 'x', b: 'y' }, ...over,
  });
  const a = runFactsOf(file(), 'a', { onRoadmap: true });
  assert.deepEqual([a.queued, a.occupied, a.waitsFor], [{ at: AT_HELD, why: 'load' }, false, 'x']);
  const c = runFactsOf(file(), 'c', { onRoadmap: true });
  assert.deepEqual([c.queued, c.occupied, c.waitsFor], [null, true, null]);
  const none = runFactsOf(file(), 'd', { onRoadmap: true });
  assert.deepEqual([none.queued, none.occupied, none.waitsFor], [null, false, null], 'another change\'s entries are not this one\'s');
  const bare = runFactsOf({ changeSessions: true }, 'a', { onRoadmap: true });
  assert.deepEqual([bare.queued, bare.occupied, bare.waitsFor], [null, false, null], 'a run file with none of the three fields');
});

test('upfront AC-10 state: a running change queued for a place reads held-place with its board words and the title ⏳ <id>', () => {
  const action = build(rowOf('implement', { phase: 1 }), {}, {});
  assert.deepEqual([action.kind, action.stage], ['agent', 'implementation']);
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(action, heldFacts({ queued: { at: AT_HELD, why: 'place' } }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text], ['running', 'held-place', MESSAGES[lang]['queue.held-place']], lang);
    assert.deepEqual([s.stateIcon, s.stageIcon, s.title], ['⏳', '🛠️', '⏳ feat'], lang);
  }
  assert.equal(MESSAGES.en['queue.held-place'], 'open, waits for a place');
  assert.equal(MESSAGES['pt-BR']['queue.held-place'], 'aberta, espera uma vaga');
  assert.deepEqual(changeLoopModule.HELD_TEXT, { 'held-place': 'queue.held-place', 'held-load': 'queue.held-load', 'held-after': 'queue.held-after' });
  assert.equal(changeLoopModule.WAIT_ICON, '⏳');
});

test('upfront AC-10 state: a running change queued by the load reads held-load', () => {
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'load' } }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text, s.title, s.stageIcon], ['running', 'held-load', MESSAGES[lang]['queue.held-load'], '⏳ feat', '📝'], lang);
  }
  assert.equal(MESSAGES.en['queue.held-load'], 'open, held by the load');
});

test('upfront AC-10 state: a plan stage whose dependency is not archived reads held-after naming it', () => {
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(planStage(), heldFacts({ waitsFor: 'dep' }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text, s.title], ['running', 'held-after', render(lang, 'queue.held-after', { after: 'dep' }), '⏳ feat'], lang);
  }
  assert.equal(stateOf(planStage(), heldFacts({ waitsFor: 'dep' })).reason.text, 'open, waits for dep');
  const ready = stateOf(planStage(), heldFacts({ started: false, waitsFor: 'dep' }));
  assert.equal(ready.reason.code, 'held-after', 'a held reason replaces ready, as the board placed those rows');
  const queuedFirst = stateOf(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' }));
  assert.equal(queuedFirst.reason.code, 'held-place', 'the queue entry is read before the dependency');
});

test('upfront AC-10 state: a change that holds a place, or has no queue entry and no waitsFor, gets no held reason', () => {
  const occupied = stateOf(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'place' }, occupied: true }));
  assert.deepEqual([occupied.state, occupied.reason, occupied.stateIcon, occupied.title], ['running', null, null, '📝 feat'], 'a place held');
  const plain = stateOf(planStage(), heldFacts());
  assert.deepEqual([plain.state, plain.reason, plain.title], ['running', null, '📝 feat']);
  const ready = stateOf(planStage(), heldFacts({ started: false }));
  assert.equal(ready.reason.code, 'ready', 'no entry: ready stays');
});

test('upfront AC-10 state: a change waiting for the owner, blocked or waiting on GitHub keeps its state and title over a queue entry or a waitsFor', () => {
  const held = { queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' };
  const owner = stateOf(approvalEnd(), heldFacts(held));
  assert.deepEqual([owner.state, owner.reason.code, owner.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat']);
  const blocked = stateOf(ceilingEnd(), heldFacts(held));
  assert.deepEqual([blocked.state, blocked.reason.code, blocked.title], ['blocked', 'ceiling', '⛔ 📝 feat']);
  const github = stateOf(build(rowOf('wait-checks', { pending: ['build'] })), heldFacts(held));
  assert.deepEqual([github.state, github.title], ['waiting-on-github', '⏳ 🚀 feat'], 'the GitHub wait keeps its stage icon beside ⏳');
  const grill = stateOf(grillOf(), heldFacts(held));
  assert.deepEqual([grill.state, grill.title], ['waiting-for-owner', '🙋 ❓ feat']);
});

test('upfront AC-10 state: outside a run with a session per change a queue entry or a waitsFor gives no held reason', () => {
  const entries = { queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' };
  const noSessions = stateOf(planStage(), heldFacts({ ...entries, sessionMode: false, started: false }));
  assert.deepEqual([noSessions.state, noSessions.reason, noSessions.title], ['running', null, '📝 feat']);
  assert.deepEqual(stateOf(planStage(), null).reason, null, 'no facts at all');
  const file = { changeSessions: false, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [], ...entries, queued: { feat: entries.queued }, waitsFor: { feat: 'dep' } };
  const facts = runFactsOf(file, 'feat', { onRoadmap: true });
  assert.equal(stateOf(planStage(), facts).reason, null, 'a run file without the mode');
});

test('upfront AC-10 state: a held title of a 70-character id is cut to 59 code points', () => {
  const ctx = { id: 'x'.repeat(70) };
  for (const facts of [heldFacts({ queued: { at: AT_HELD, why: 'place' } }), heldFacts({ queued: { at: AT_HELD, why: 'load' } }), heldFacts({ waitsFor: 'dep' })]) {
    const s = stateOf(planStage({ ctx }), facts);
    assert.equal(s.reason?.code?.startsWith('held-'), true, 'a held reason');
    const title = s.title;
    assert.ok(title.startsWith('⏳ xxx'), title);
    assert.equal([...title].length, 59);
  }
});
