// node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-remote.test.mjs
// change-coordinator, part 3a of 3 (suite-speed D-11; the others are change-loop.test.mjs and change-loop-compozy.test.mjs, and part 3b is change-loop-remote-state.test.mjs): the remote worker's claim at open and its place on the remote. What the parts share is in change-loop-fixtures.mjs and change-loop-remote-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { hostname } from 'node:os';
import { tmpFolder } from './test-tmp.mjs';
import { spawn } from 'node:child_process';
import {
  put, commitAll, git, sandbox, roundRepo, SET_LOOP as SET, cleanEnvLoop as cleanEnv, PLAN_FILES, head, actionOf, typedLine, runLine, assistantLine,
  transcriptOf, stopInput,
} from './test-fixtures.mjs';
import * as changeLoopModule from './change-loop.mjs';
import { render, main, waitLoop, openChange, nextAction } from './change-loop.mjs';
import {
  LOOP, next, parsed, PROPOSAL, check, deliveredChange, startRun, body, whereNext, snapshot, addChange, devkitRepo, openRun, freshProject, wtOf,
  skillBodyLine, hook, IDENT,
} from './change-loop-fixtures.mjs';
import { TASK_LINK, TASK_REQUIREMENTS, recordFile, asked, usageLine, budgetEnv } from './change-loop-remote-fixtures.mjs';

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
// `openChild` of change-loop.test.mjs with `--task PROJ-482` and the task as JSON on standard input.
const openTaskChild = (cwd, id) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'open', id, '--script', 'devkit', '--why', 'doubt', '--task', 'PROJ-482', '--lang', 'en'], { cwd, env: { ...cleanEnv, ...IDENT }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  child.stdin.end(JSON.stringify(FAKE_TASK));
});
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

test('jira-entry-followups AC-9 two open --task calls for one key at once create one change', async () => {
  const t = freshProject();
  const lock = join(t.main, '.git', 'devkit-open.lock');
  writeFileSync(lock, `${JSON.stringify({ pid: 1, at: new Date().toISOString() })}\n`);
  // Both calls start while a third holds the lock, so both are waiting for it when it is released.
  const both = [openTaskChild(t.main, 'proj-482-a'), openTaskChild(t.main, 'proj-482-b')];
  await new Promise((resolve) => { setTimeout(resolve, 1500); });
  rmSync(lock);
  const results = await Promise.all(both);
  const out = results.map((r) => r.stdout).join('\n');
  assert.deepEqual(results.map((r) => r.code).sort(), [0, 3], out);
  const created = ['proj-482-a', 'proj-482-b'][results.findIndex((r) => r.code === 0)];
  const refused = results.find((r) => r.code === 3);
  assert.equal(JSON.parse(refused.stdout).reply, render('en', 'task-taken', { key: 'PROJ-482', id: created }), 'the loser is told which change holds the task');
  assert.equal(git(t.main, 'worktree', 'list').split('\n').length, 2, 'one worktree besides the project\'s own');
  assert.equal(existsSync(join(wtOf(t, created), 'openspec', 'changes', created, 'requirements.md')), true);
  assert.equal(existsSync(join(wtOf(t, created === 'proj-482-a' ? 'proj-482-b' : 'proj-482-a'), 'openspec')), false, 'the refused call created nothing');
  assert.equal(existsSync(lock), false, 'the lock is removed');
});

test("jira-entry-followups AC-9 open --task on the id of the key's own unfinished change answers task-taken", () => {
  const t = freshProject();
  assert.equal(taskOpen(t.main, 'proj-482-login-timeout').code, 0);
  const before = snapshot(t.main);
  const r = taskOpen(t.main, 'proj-482-login-timeout');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(body(r).reply, render('en', 'task-taken', { key: 'PROJ-482', id: 'proj-482-login-timeout' }), 'task-taken, not name-taken');
  assert.notEqual(body(r).reply, render('en', 'name-taken', { id: 'proj-482-login-timeout' }));
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  assert.equal(snapshot(t.main), before, 'nothing was created');
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

test('jira-entry-followups AC-10 next carries no writeBack on a blocked end held at the pull request', () => {
  const { t, env } = deliveredChange({ conflicts: ['CHANGELOG.md', 'README.md'], mergeable: 'CONFLICTING', checks: [check('build', 'pass')], requirements: TASK_REQUIREMENTS });
  const r = next(t.main, [], env);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  const action = parsed(r).action;
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'pr-problem']);
  assert.deepEqual(action.task, { key: 'PROJ-482', link: TASK_LINK }, 'the task still attaches');
  assert.equal('writeBack' in action, false, 'a blocked end asks nothing');
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
