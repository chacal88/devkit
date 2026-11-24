#!/usr/bin/env node
// train-loop: the departure of a delivery train and its next action (ADR 0022, delivery-train D-3, D-5, D-7, D-8).
//
//   node train-loop.mjs next   --lang <l> [--after <progressKey>]
//   node train-loop.mjs depart --lang <l> [--update]
//   node train-loop.mjs wait   --lang <l>
//
// `next` derives everything from files, git and GitHub on each call and prints ONE JSON action `{ version: 1, kind:
// 'session' | 'end', step, detail, reply, end?, progressKey }` (exit 0 an action, 1 a wait, 2 blocked, 3 unreadable, as the
// change loop). `depart` cuts `train/<n>` from the base branch, joins the boarded heads in order, runs the project's
// whole-suite command once, bisects a red train, writes the record and commits it; it pushes nothing: the push, the pull
// request and auto-merge are steps `next` hands to the session. `depart --update` brings the base into an open train. `wait`
// polls `next` and prints the action once it differs from the first one. No dependencies of its own: it imports the
// delivery checker, the merge setup reader and the loop's message table.

import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectState, nextStep, parseTrainRecord, staleness, checksItem, makeGh, readContents, branchNamesChange, listWorktrees, RELEASE_FILE, TRAIN_BRANCH } from './deliver-check.mjs';
import { mergeSetup, ghError } from './merge-setup.mjs';
import { readDevkitSettings, projectGate, render, normalizeLang, cleanOf, mainRoot, defaultBase, exitCodeOf } from './change-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const RELEASE_MERGE = join(HERE, 'release-merge.mjs');

// Something git or GitHub did not answer, or a step that failed: the departure stops with the message.
export class TrainError extends Error {
  constructor(message) { super(message); this.name = 'TrainError'; }
}

// A command line the script does not take.
export class TrainUsageError extends TrainError {
  constructor(message) { super(message); this.name = 'TrainUsageError'; }
}

export const LOCK_STALE_MS = 6 * 60 * 60 * 1000;
const MAX_BUFFER = 256 * 1024 * 1024;
const FAILURE_LINES = 80;

// ---------------------------------------------------------------- running things

function run(cwd, command, args, env) {
  const r = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new TrainError(`${command} ${args.join(' ')} could not run: ${r.error.message}`);
  return r;
}
const gitRun = (cwd, env, ...args) => run(cwd, 'git', args, env);
function gitOut(cwd, env, ...args) {
  const r = gitRun(cwd, env, ...args);
  if (r.status !== 0) throw new TrainError(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim().split('\n')[0] || `exit ${r.status}`}`);
  return r.stdout.trim();
}
const gitOk = (cwd, env, ...args) => gitRun(cwd, env, ...args).status === 0;

// The last lines of what a suite printed, stdout then stderr.
const tailOf = (text) => text.replace(/\n+$/, '').split('\n').slice(-FAILURE_LINES).join('\n');

// `runSuite(worktree, suite, env)`: the project's whole-suite command through the shell, no timeout.
export function runSuite(worktree, suite, env = process.env) {
  const r = spawnSync('sh', ['-c', suite], { cwd: worktree, env: cleanOf(env), encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new TrainError(`the suite could not run: ${r.error.message}`);
  return { ok: r.status === 0, output: tailOf(`${r.stdout ?? ''}${r.stderr ?? ''}`) };
}

// ---------------------------------------------------------------- the record (D-4)

const fenceFor = (text) => '`'.repeat(Math.max(3, ...[...String(text).matchAll(/^(`+)/gm)].map((m) => m[1].length + 1)));
const row = (cells) => `| ${cells.join(' | ')} |`;

// The text of `openspec/trains/<n>.md` for `record`: the shape `parseTrainRecord` reads, plus `runs: [{ changes, head,
// result }]`, which it does not read. A failure's fence is one backtick longer than the longest run that starts a line of it.
export function writeTrainRecord(record) {
  const out = [
    `<!-- devkit-train n=${record.n} base=${record.base} result=${record.result} -->`, `# Train ${record.n}`, '',
    `- Base: \`${record.base}\` at \`${record.baseSha}\``, `- Suite: \`${record.suite}\``, `- Ran at: \`${record.ranAt}\``, `- Result: ${record.result}`, '',
    '## Boarded', '', row(['Order', 'Kind', 'Change', 'Pull request', 'Head', 'Boarded at']), row(['---', '---', '---', '---', '---', '---']),
    ...record.boarded.map((b) => row([b.order, b.kind, `\`${b.id}\``, `#${b.number}`, `\`${b.head}\``, b.at])), '',
  ];
  if (record.left?.length) {
    out.push('## Left', '', row(['Kind', 'Change', 'Pull request', 'Head', 'Why', 'Detail']), row(['---', '---', '---', '---', '---', '---']),
      ...record.left.map((l) => row([l.kind, `\`${l.id}\``, `#${l.number}`, `\`${l.head}\``, l.why, l.detail])), '');
  }
  if (record.runs?.length) {
    out.push('## Runs', '', row(['Run', 'Changes', 'Head', 'Result']), row(['---', '---', '---', '---']), ...record.runs.map((r, i) => row([i + 1, r.changes, `\`${r.head}\``, r.result])), '');
  }
  for (const l of record.left ?? []) {
    if (l.failure === null || l.failure === undefined) continue;
    const fence = fenceFor(l.failure);
    out.push(`## Failure of \`${l.id}\``, '', `${fence}text`, l.failure, fence, '');
  }
  return out.join('\n');
}

// The Runs table of a record text, as the rows `writeTrainRecord` takes (the parser leaves it out).
function readRuns(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+Runs\s*$/.test(l));
  if (at === -1) return [];
  const rows = [];
  for (const l of lines.slice(at + 1)) {
    if (/^##\s/.test(l)) break;
    if (!l.trim().startsWith('|')) continue;
    const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length === 4 && /^\d+$/.test(cells[0])) rows.push({ changes: cells[1], head: cells[2].replace(/`/g, ''), result: cells[3] });
  }
  return rows;
}

// ---------------------------------------------------------------- the bisection (D-7)

// The first red prefix of a train of `m` changes known to be red as a whole, by bisection: `probe(mid)` runs the suite on the
// first `mid + 1` changes and answers `{ ok, output }`. { index of the culprit, the output of the smallest red prefix }.
export function findCulprit(m, probe, redOutput) {
  let lo = 0;
  let hi = m - 1;
  let output = redOutput;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const r = probe(mid);
    if (r.ok) lo = mid + 1;
    else { hi = mid; output = r.output; }
  }
  return { index: lo, output };
}

// ---------------------------------------------------------------- the context and the lock

const iso = (text) => new Date(text).toISOString().replace(/\.\d{3}Z$/, 'Z');

function context(start, opts) {
  const env = opts.env ?? process.env;
  const root = realpathSync(mainRoot(start));
  const lang = normalizeLang(opts.lang);
  const settings = readDevkitSettings(root);
  return {
    root, env, lang, settings, gh: opts.gh ?? makeGh(root, env), tmp: opts.tmp ?? tmpdir(), after: opts.after ?? null, update: Boolean(opts.update),
    base: opts.base ?? defaultBase(root), suite: settings.train?.suite ?? null, model: settings.delivery?.model ?? null,
    say: (key, params = {}) => render(lang, key, params),
  };
}

// The reply that ends a run on a project that has no train, or whose train setting is refused: null when the train is on.
function gateOf(ctx) {
  const gate = projectGate(ctx.root, ctx.settings);
  if (gate) return { why: gate.key, reply: ctx.say(gate.key, gate.params) };
  if (!ctx.suite) return { why: 'train-off', reply: ctx.say('train-off') };
  return null;
}

export function lockFile(root, env = process.env) {
  const common = gitOut(root, env, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  return join(common, 'devkit', 'train.lock');
}

function lockAge(file, now) {
  try { return now - statSync(file).mtimeMs; } catch { return null; }
}

// Takes the lock with an exclusive create; one older than six hours is taken over. False when another departure holds it.
function takeLock(file, now = Date.now()) {
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx');
      writeSync(fd, `${process.pid}\n`);
      closeSync(fd);
      return true;
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      const age = lockAge(file, now);
      if (age !== null && age < LOCK_STALE_MS) return false;
      try { unlinkSync(file); } catch { /* another departure took it over first */ }
    }
  }
  return false;
}

// ---------------------------------------------------------------- what GitHub and git say about the trains

const trainNumber = (name) => { const m = TRAIN_BRANCH.exec(name ?? ''); return m ? Number(m[1]) : null; };

// Every pull request with a `train/<n>` head, newest number first.
function trainPrs(ctx) {
  const l = ctx.gh(['pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number,url,state,headRefName,headRefOid,baseRefName,mergeStateStatus,autoMergeRequest,mergedAt,mergeCommit']);
  if (l.status !== 0) throw new TrainError(`cannot read the pull requests: ${ghError(l)}`);
  let list;
  try { list = JSON.parse(l.stdout); } catch { throw new TrainError('gh pr list returned unreadable JSON'); }
  if (!Array.isArray(list)) throw new TrainError('gh pr list returned unreadable JSON');
  return list.map((pr) => ({ ...pr, n: trainNumber(pr.headRefName) })).filter((pr) => pr.n !== null).sort((a, b) => b.n - a.n);
}

function branchNumbers(ctx, ...refs) {
  const out = gitOut(ctx.root, ctx.env, 'for-each-ref', '--format=%(refname)', ...refs);
  return out.split('\n').map((r) => trainNumber(r.replace(/^refs\/(heads|remotes\/origin)\//, ''))).filter((n) => n !== null);
}
const localTrains = (ctx) => branchNumbers(ctx, 'refs/heads/train').sort((a, b) => b - a);
// The trains `origin` holds as branches (an authoritative read of the remote, not of the tracking refs).
function remoteTrains(ctx) {
  const r = gitRun(ctx.root, ctx.env, 'ls-remote', '--heads', 'origin', 'refs/heads/train/*');
  if (r.status !== 0) throw new TrainError(`cannot read the branches of origin: ${(r.stderr || '').trim().split('\n')[0]}`);
  return r.stdout.split('\n').map((l) => trainNumber(l.split('\t')[1]?.replace(/^refs\/heads\//, ''))).filter((n) => n !== null).sort((a, b) => b - a);
}
const worktreeOfTrain = (ctx, n) => listWorktrees(ctx.root).find((w) => w.branch === `train/${n}`)?.path ?? null;
const recordPath = (n) => `openspec/trains/${n}.md`;

// One more than the highest train number among the records on origin/<base>, the branches origin/train/* and the local train/*.
function nextNumber(ctx) {
  const numbers = [
    ...gitOut(ctx.root, ctx.env, 'ls-tree', '--name-only', `origin/${ctx.base}`, 'openspec/trains/').split('\n').map((p) => /\/(\d+)\.md$/.exec(p)?.[1]).filter(Boolean).map(Number),
    ...branchNumbers(ctx, 'refs/remotes/origin/train', 'refs/heads/train'),
  ];
  return Math.max(0, ...numbers) + 1;
}

// A train under way: its pull request is open, or its branch is local with a record and has no pull request yet.
function underWay(ctx, prs) {
  const open = prs.find((pr) => pr.state === 'OPEN');
  if (open) return { n: open.n, number: open.number };
  const [local] = localTrains(ctx);
  if (local !== undefined && !prs.some((pr) => pr.n === local) && gitOk(ctx.root, ctx.env, 'cat-file', '-e', `train/${local}:${recordPath(local)}`)) return { n: local, number: null };
  return null;
}

// ---------------------------------------------------------------- the boarded set (D-3)

const removeWorktree = (root, env, path) => {
  gitRun(root, env, 'worktree', 'remove', '--force', path);
  rmSync(path, { recursive: true, force: true });
};

// The ids of the active changes a head holds.
function activeAt(root, env, oid) {
  const r = gitRun(root, env, 'ls-tree', '--name-only', oid, 'openspec/changes/');
  if (r.status !== 0) return [];
  return r.stdout.split('\n').map((p) => p.replace(/^openspec\/changes\//, '')).filter((n) => n && n !== 'archive' && !n.startsWith('.'));
}

// The change a pull request's head branch names, among the active changes at its head: { id } | { skipped } | null.
function changeOfHead(root, env, pr) {
  const ids = activeAt(root, env, pr.headRefOid).filter((id) => branchNamesChange(pr.headRefName, id));
  if (ids.length === 0) return null;
  if (ids.length === 1) return { id: ids[0] };
  const last = pr.headRefName.split('/').pop();
  if (ids.includes(last)) return { id: last };
  return { skipped: `its branch names the changes ${ids.join(', ')} and equals none of them` };
}

// The boarding time: the committer time of the newest commit at the head that records a review verdict of the change, an
// archive's that of its head.
function boardingTime(root, env, kind, id, oid) {
  const path = kind === 'change' ? ['--', `openspec/changes/${id}/reviews/`] : [];
  const at = gitOut(root, env, 'log', '-1', '--format=%cI', oid, ...path) || gitOut(root, env, 'log', '-1', '--format=%cI', oid);
  return iso(at);
}

// { boarded: [{ kind, id, number, url, head, branch, at }] in boarding order, skipped: [{ number, branch, why }] }. Reads GitHub
// and Git, stores nothing: each candidate is judged by the delivery checker in a scratch worktree at its own head.
export function boardedSet(start, opts = {}) {
  const ctx = context(start, opts);
  const { root, env, gh, base } = ctx;
  gitOut(root, env, 'fetch', '-q', 'origin');
  const l = gh(['pr', 'list', '--base', base, '--state', 'open', '--limit', '100', '--json', 'number,url,headRefName,headRefOid']);
  if (l.status !== 0) throw new TrainError(`cannot read the pull requests: ${ghError(l)}`);
  let list;
  try { list = JSON.parse(l.stdout); } catch { throw new TrainError('gh pr list returned unreadable JSON'); }
  const boarded = [];
  const skipped = [];
  const scratch = mkdtempSync(join(ctx.tmp, 'devkit-train-board-'));
  try {
    for (const pr of [...list].sort((a, b) => a.number - b.number)) {
      if (TRAIN_BRANCH.test(pr.headRefName)) continue;
      const archive = /^chore\/archive-(.+)$/.exec(pr.headRefName);
      let kind = 'archive';
      let id = archive?.[1];
      if (!archive) {
        const found = changeOfHead(root, env, pr);
        if (!found) continue;
        if (found.skipped) { skipped.push({ number: pr.number, branch: pr.headRefName, why: found.skipped }); continue; }
        kind = 'change';
        id = found.id;
      }
      const wt = join(scratch, `board-${pr.number}`);
      try {
        gitOut(root, env, 'worktree', 'add', '-q', '--detach', wt, pr.headRefOid);
        const state = collectState(wt, id, { env: { ...cleanOf(env), DEVKIT_BRANCH: pr.headRefName }, gh });
        const next = nextStep(state);
        if (next.step !== 'boarded') continue;
        boarded.push({ kind, id, number: pr.number, url: pr.url, head: pr.headRefOid, branch: pr.headRefName, at: boardingTime(root, env, kind, id, pr.headRefOid) });
      } catch (e) {
        skipped.push({ number: pr.number, branch: pr.headRefName, why: `cannot read its state: ${e.message}` });
      } finally {
        removeWorktree(root, env, wt);
      }
    }
  } finally {
    gitRun(root, env, 'worktree', 'prune');
    rmSync(scratch, { recursive: true, force: true });
  }
  boarded.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.number - b.number);
  return { boarded, skipped };
}

// ---------------------------------------------------------------- the departure (D-5, D-7)

const idsOf = (list) => list.map((e) => e.id).join(', ');
const pathsDetail = (out, stderr) => {
  const paths = (out?.conflicts ?? []).filter((p) => !RELEASE_FILE.test(p));
  const named = paths.length ? paths : (out?.conflicts ?? []);
  if (named.length) return named.map((p) => `\`${p}\``).join(', ');
  return `\`${String(out?.error ?? stderr ?? 'the join failed').replace(/`/g, "'").trim()}\``;
};

// A scratch worktree at origin/<base> with each head of `list` joined in order (`release-merge.mjs --merge`): { wt, joined,
// left } where a join that conflicts takes its change off (`why: conflict`) and the build goes on.
function build(ctx, scratch, name, list) {
  const wt = join(scratch, name);
  gitOut(ctx.root, ctx.env, 'worktree', 'add', '-q', '--detach', wt, `origin/${ctx.base}`);
  const joined = [];
  const left = [];
  for (const entry of list) {
    const r = run(wt, process.execPath, [RELEASE_MERGE, '--merge', entry.head, '--json'], ctx.env);
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* human output */ }
    if (r.status === 0) joined.push(entry);
    else if (r.status === 2) left.push({ ...entry, why: 'conflict', detail: pathsDetail(out, r.stderr), failure: null });
    else throw new TrainError(`joining #${entry.number} (${entry.id}) failed with exit ${r.status}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  }
  return { wt, joined, left };
}

const headOfWt = (ctx, wt) => gitOut(wt, ctx.env, 'rev-parse', 'HEAD');
const entryOf = (e, order) => ({ order, kind: e.kind, id: e.id, number: e.number, head: e.head, at: e.at });
const leftOf = (l) => ({ kind: l.kind, id: l.id, number: l.number, head: l.head, why: l.why, detail: l.detail, failure: l.failure ?? null });
const outBoarded = (e) => ({ kind: e.kind, id: e.id, number: e.number, head: e.head, at: e.at });
const outLeft = (l) => ({ kind: l.kind, id: l.id, number: l.number, why: l.why, detail: l.detail });

function departTrain(ctx) {
  const { root, env, base } = ctx;
  const stopped = (error) => ({ code: 2, out: { version: 1, result: 'blocked', error, reply: ctx.say('train-blocked', { error }) } });
  const open = underWay(ctx, trainPrs(ctx));
  if (open) return stopped(`train ${open.n} is still under way${open.number ? ` (pull request #${open.number})` : ' (its branch is not on a pull request yet)'}: a second train does not depart until it is merged or closed`);
  const set = boardedSet(root, { env, gh: ctx.gh, tmp: ctx.tmp, base });
  if (set.boarded.length === 0) return { code: 1, out: { version: 1, result: 'nothing', boarded: [], left: [], skipped: set.skipped, reply: ctx.say('train-nothing') } };
  const n = nextNumber(ctx);
  const baseSha = gitOut(root, env, 'rev-parse', `origin/${base}`);
  const scratch = mkdtempSync(join(ctx.tmp, 'devkit-train-'));
  const runs = [];
  const left = [];
  let built = 0;
  const make = (list, label) => build(ctx, scratch, `train-${n}-${label}-${built += 1}`, list);
  const drop = (b) => removeWorktree(root, env, b.wt);
  const test = (b, list, label = idsOf(list)) => {
    const r = runSuite(b.wt, ctx.suite, env);
    runs.push({ changes: label, head: headOfWt(ctx, b.wt), result: r.ok ? 'passed' : 'failed' });
    return r;
  };
  const result = (code, out) => ({ code, out: { version: 1, base, skipped: set.skipped, ...out } });
  try {
    let b = make(set.boarded, 'run');
    left.push(...b.left);
    let list = b.joined;
    for (;;) {
      if (list.length === 0) {
        drop(b);
        return result(1, { n, result: 'empty', boarded: [], left: left.map(outLeft), runs: runs.length, reply: ctx.say('train-nothing') });
      }
      const r = test(b, list);
      if (r.ok) break;
      const found = findCulprit(list.length, (mid) => {
        const part = list.slice(0, mid + 1);
        const probe = make(part, 'probe');
        const pr = test(probe, part);
        drop(probe);
        return pr;
      }, r.output);
      if (found.index === 0) {
        const bare = build(ctx, scratch, `train-${n}-base-${built += 1}`, []);
        const check = runSuite(bare.wt, ctx.suite, env);
        runs.push({ changes: base, head: baseSha, result: check.ok ? 'passed' : 'failed' });
        drop(bare);
        if (!check.ok) {
          drop(b);
          return result(2, { n, result: 'base-red', boarded: [], left: [], runs: runs.length, reply: ctx.say('train-base-red', { base }) });
        }
      }
      const culprit = list[found.index];
      left.push({ ...culprit, why: 'red', detail: `Failure of \`${culprit.id}\`, below`, failure: found.output });
      drop(b);
      b = make(list.filter((_, i) => i !== found.index), 'run');
      left.push(...b.left);
      list = b.joined;
    }
    const ranAt = headOfWt(ctx, b.wt);
    const record = {
      n, base, result: 'passed', baseSha, suite: ctx.suite, ranAt,
      boarded: list.map((e, i) => entryOf(e, i + 1)), left: left.map(leftOf), runs,
    };
    mkdirSync(join(b.wt, 'openspec', 'trains'), { recursive: true });
    writeFileSync(join(b.wt, recordPath(n)), writeTrainRecord(record));
    gitOut(b.wt, env, 'add', '--', recordPath(n));
    gitOut(b.wt, env, 'commit', '-q', '-m', `chore(train): record train ${n}`);
    const sha = headOfWt(ctx, b.wt);
    gitOut(root, env, 'branch', `train/${n}`, sha);
    gitOut(root, env, 'branch', `--set-upstream-to=origin/${base}`, `train/${n}`); // so `git branch -d` judges it against the base once that holds the merged train
    drop(b);
    const worktree = join(root, '.claude', 'worktrees', `train-${n}`);
    mkdirSync(dirname(worktree), { recursive: true });
    gitOut(root, env, 'worktree', 'add', '-q', worktree, `train/${n}`);
    return result(0, { n, branch: `train/${n}`, worktree, result: 'passed', boarded: list.map(outBoarded), left: left.map(outLeft), runs: runs.length });
  } finally {
    gitRun(root, env, 'worktree', 'prune');
    rmSync(scratch, { recursive: true, force: true });
    gitRun(root, env, 'worktree', 'prune');
  }
}

// `depart --update`: the base brought into the open train in its own worktree, the suite once, the record rewritten (D-5).
function updateTrain(ctx) {
  const { root, env, base } = ctx;
  const stopped = (error) => ({ code: 2, out: { version: 1, result: 'blocked', error, reply: ctx.say('train-blocked', { error }) } });
  const open = trainPrs(ctx).find((pr) => pr.state === 'OPEN');
  if (!open) return stopped('no open train to bring up to date');
  const wt = worktreeOfTrain(ctx, open.n);
  if (!wt) return stopped(`the checkout of train ${open.n} is missing under .claude/worktrees`);
  gitOut(root, env, 'fetch', '-q', 'origin');
  const file = join(wt, recordPath(open.n));
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const record = parseTrainRecord(text);
  if (record.error) return stopped(`the record of train ${open.n} cannot be read: ${record.error}`);
  const merged = run(wt, process.execPath, [RELEASE_MERGE, '--base', base, '--json'], env);
  let out = null;
  try { out = JSON.parse(merged.stdout); } catch { /* human output */ }
  if (merged.status === 2) return stopped(`train ${open.n} conflicts with ${base} in ${(out?.conflicts ?? []).join(', ') || 'the merge'}`);
  if (merged.status !== 0) throw new TrainError(`merging ${base} into train ${open.n} failed with exit ${merged.status}: ${(merged.stderr || merged.stdout).trim().split('\n')[0]}`);
  if (out?.oldHead === out?.newHead) return { code: 0, out: { version: 1, n: open.n, branch: `train/${open.n}`, worktree: wt, result: 'current', runs: readRuns(text).length } };
  const r = runSuite(wt, ctx.suite, env);
  const ranAt = headOfWt(ctx, wt);
  const baseSha = gitOut(root, env, 'rev-parse', `origin/${base}`);
  const runs = [...readRuns(text), { changes: idsOf(record.boarded), head: ranAt, result: r.ok ? 'passed' : 'failed' }];
  writeFileSync(file, writeTrainRecord({ ...record, baseSha, ranAt, result: r.ok ? 'passed' : 'failed', runs }));
  gitOut(wt, env, 'add', '--', recordPath(open.n));
  gitOut(wt, env, 'commit', '-q', '-m', `chore(train): record train ${open.n} after merging ${base}`);
  if (!r.ok) return stopped(`the suite fails on train ${open.n} after merging ${base}; what broke is what ${base} brought:\n${r.output}`);
  return { code: 0, out: { version: 1, n: open.n, branch: `train/${open.n}`, worktree: wt, result: 'passed', runs: runs.length } };
}

// The departure: { code, out }. A busy lock is exit 1, a blocked one 2; a failure to read git or GitHub throws TrainError.
export function depart(start, opts = {}) {
  const ctx = context(start, opts);
  const gate = gateOf(ctx);
  if (gate) return { code: 2, out: { version: 1, result: 'blocked', reply: gate.reply } };
  const lock = lockFile(ctx.root, ctx.env);
  if (!takeLock(lock)) return { code: 1, out: { version: 1, result: 'running', lock, reply: ctx.say('train-running', { where: lock }) } };
  try {
    return ctx.update ? updateTrain(ctx) : departTrain(ctx);
  } finally {
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
}

// ---------------------------------------------------------------- next (D-5, D-8)

// The key of an action: its step and what it is about. The two clean-train steps of one merged train (the worktree, then the
// branch) differ in `what`, so a session that passes `--after` is not refused at the second as a repeat of the first.
const progressOf = (step, detail) => `${step}@${detail.number ?? detail.n ?? (detail.boarded ?? []).map((b) => b.id).join(',')}${detail.what ? `:${detail.what}` : ''}`;

function sessionAction(step, detail, reply = null) {
  return { version: 1, kind: 'session', step, detail, reply, progressKey: progressOf(step, detail) };
}
function endAction(state, why, reply, detail = {}) {
  return { version: 1, kind: 'end', step: why, detail, reply, end: { state, why }, progressKey: progressOf(why, detail) };
}

function recordAt(ctx, pr) {
  const got = readContents(ctx.gh, recordPath(pr.n), pr.headRefOid);
  if (got.error) throw new TrainError(`cannot read the record of train ${pr.n}: ${got.error}`);
  if (got.notFound || typeof got.json?.content !== 'string') return { error: 'there is no record' };
  return parseTrainRecord(Buffer.from(got.json.content, 'base64').toString('utf8'));
}

// Whether `git branch -d train/<n>` will delete the local branch: it exists, and it is merged into its upstream (the branch
// is cut from `origin/<base>`, so that is `origin/<base>`) or into HEAD when it has none. `origin` is fetched first, because
// no earlier call has seen the merge of the train on GitHub: a stale `origin/<base>` made git refuse the deletion, and the step
// came before the departure, so it blocked every later train. A branch that is not merged there (a train merged by a squash)
// is left where it is, never forced.
function branchDeletable(root, env, n) {
  const ref = `refs/heads/train/${n}`;
  if (!gitOk(root, env, 'rev-parse', '--verify', '-q', ref)) return false;
  gitOut(root, env, 'fetch', '-q', 'origin');
  const upstream = gitRun(root, env, 'rev-parse', '--verify', '-q', `train/${n}@{upstream}`); // the short name: @{upstream} does not read a full ref
  return gitOk(root, env, 'merge-base', '--is-ancestor', ref, upstream.status === 0 ? upstream.stdout.trim() : 'HEAD');
}

// What is wrong with the record of an open train at the pull request's head, or null.
function recordProblem(ctx, pr) {
  const record = recordAt(ctx, pr);
  if (record.error) return `the record of train ${pr.n} is missing or unreadable: ${record.error}`;
  if (record.result !== 'passed') return `the record of train ${pr.n} says the suite ${record.result}`;
  const stale = staleness(ctx.root, { sha: record.ranAt ?? '' }, { head: pr.headRefOid, dirty: [] });
  if (stale) return `the record of train ${pr.n} is not current at the pull request's head: ${stale}`;
  return null;
}

function nextAction(ctx) {
  const gate = gateOf(ctx);
  if (gate) return endAction('blocked', gate.why, gate.reply);
  const { root, env, base, gh } = ctx;
  const lock = lockFile(root, env);
  const age = lockAge(lock, Date.now());
  if (age !== null && age < LOCK_STALE_MS) return endAction('waiting-for-owner', 'train-running', ctx.say('train-running', { where: lock }), { lock });

  const prs = trainPrs(ctx);
  const blocked = (error, detail = {}) => endAction('blocked', 'train-blocked', ctx.say('train-blocked', { error }), { ...detail, error });
  const open = prs.find((pr) => pr.state === 'OPEN');

  const [local] = localTrains(ctx);
  if (local !== undefined && gitOk(root, env, 'cat-file', '-e', `train/${local}:${recordPath(local)}`)) {
    const mine = prs.find((pr) => pr.n === local);
    const wt = worktreeOfTrain(ctx, local);
    const push = () => sessionAction('push-train', { n: local, number: mine?.number ?? null, command: ['git', '-C', wt ?? root, 'push', 'origin', `train/${local}`] });
    if (!mine && !remoteTrains(ctx).includes(local)) return push();
    if (mine?.state === 'OPEN') {
      const tip = gitOut(root, env, 'rev-parse', `train/${local}`);
      if (tip !== mine.headRefOid && gitOk(root, env, 'merge-base', '--is-ancestor', mine.headRefOid, tip)) return push();
    }
  }
  const [remote] = remoteTrains(ctx);
  if (remote !== undefined && !prs.some((pr) => pr.n === remote)) {
    const wt = worktreeOfTrain(ctx, remote);
    if (!wt || !existsSync(join(wt, recordPath(remote)))) return blocked(`train ${remote} is on origin with no pull request, and its checkout under .claude/worktrees is missing, so its record cannot be read`, { n: remote });
    const record = parseTrainRecord(readFileSync(join(wt, recordPath(remote)), 'utf8'));
    const ids = record.error ? `train ${remote}` : idsOf(record.boarded);
    return sessionAction('open-train-pr', { n: remote, command: ['gh', 'pr', 'create', '--base', base, '--head', `train/${remote}`, '--title', `train ${remote}: ${ids}`, '--body-file', join(wt, recordPath(remote))] });
  }

  if (open) {
    const at = { n: open.n, number: open.number };
    if (open.mergeStateStatus === 'BEHIND') return sessionAction('update-train', { ...at, background: true, command: ['node', SELF, 'depart', '--update', '--lang', ctx.lang] });
    const checks = checksItem({ pr: { number: open.number } }, gh);
    if (checks.status === 'blocked') return blocked(checks.reason, at);
    if (checks.details.failing.length) {
      const named = checks.details.failing.map((f) => `${f.name} (${f.link})`).join(', ');
      return blocked(`${checks.details.failing.length === 1 ? 'a check' : 'checks'} of the pull request #${open.number} of train ${open.n} fail: ${named}`, { ...at, failing: checks.details.failing });
    }
    const problem = recordProblem(ctx, open);
    if (problem) return blocked(problem, at);
    if (ctx.model === 'trunk-auto') {
      const setup = mergeSetup(gh, root, 'merge');
      if (!setup.ok) return blocked(`${setup.missing.map((m) => m.replace(/;\s*run the openspec-setup skill.*$/, '')).join('; ')}; github-setup.mjs --method merge allows merge commits and auto-merge`, at);
      if (!open.autoMergeRequest) return sessionAction('enable-auto-merge', { ...at, head: open.headRefOid, command: ['gh', 'pr', 'merge', String(open.number), '--auto', '--merge', '--match-head-commit', open.headRefOid] });
      return endAction('waiting-on-github', 'train-auto-merge-on', ctx.say('train-auto-merge-on', at), at);
    }
    if (checks.details.pending.length) return endAction('waiting-on-github', 'train-checks', ctx.say('train-checks', at), at);
    return endAction('waiting-for-owner', 'train-ready', ctx.say('train-ready', at), at);
  }

  const newest = prs[0];
  if (newest?.state === 'MERGED') {
    const record = recordAt(ctx, newest);
    if (!record.error) {
      const listed = gh(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefOid']);
      if (listed.status !== 0) throw new TrainError(`cannot read the pull requests: ${ghError(listed)}`);
      const stillOpen = new Map(JSON.parse(listed.stdout).map((pr) => [pr.number, pr.headRefOid]));
      const leftOpen = record.boarded.find((b) => stillOpen.get(b.number) === b.head);
      if (leftOpen) {
        const comment = `Delivered by train ${newest.n} in #${newest.number} (merge commit ${String(newest.mergeCommit?.oid ?? '').slice(0, 7)}).`;
        const detail = { number: leftOpen.number, train: newest.n, trainNumber: newest.number, comment, command: ['gh', 'pr', 'close', String(leftOpen.number), '--comment', comment] };
        return sessionAction('close-boarded-pr', detail, ctx.say('train-delivered', { n: newest.n, number: newest.number }));
      }
    }
    const wt = worktreeOfTrain(ctx, newest.n);
    const here = { n: newest.n, number: newest.number };
    if (wt) return sessionAction('clean-train', { ...here, what: 'worktree', worktree: wt, command: ['git', '-C', root, 'worktree', 'remove', wt] }, ctx.say('train-delivered', here));
    if (branchDeletable(root, env, newest.n)) return sessionAction('clean-train', { ...here, what: 'branch', command: ['git', '-C', root, 'branch', '-d', `train/${newest.n}`] }, ctx.say('train-delivered', here));
  }

  const set = boardedSet(root, { env, gh, tmp: ctx.tmp, base });
  if (set.boarded.length === 0) return endAction('waiting-for-owner', 'train-nothing', ctx.say('train-nothing'), { skipped: set.skipped });
  return sessionAction('depart', { background: true, boarded: set.boarded.map(({ kind, id, number }) => ({ kind, id, number })), skipped: set.skipped, command: ['node', SELF, 'depart', '--lang', ctx.lang] });
}

// `{ code, action }`. The same session step as the call before (`after`) changed nothing: it ends blocked. Anything unreadable is the
// unreadable end, exit 3.
export function next(start, opts = {}) {
  const ctx = context(start, opts);
  let action;
  try {
    action = nextAction(ctx);
  } catch (e) {
    if (!(e instanceof TrainError)) throw e;
    action = endAction('blocked', 'unreadable', ctx.say('train-blocked', { error: e.message }), { error: e.message });
  }
  if (ctx.after && action.kind === 'session' && ctx.after === action.progressKey) {
    const error = `${action.step} was done and changed nothing`;
    action = endAction('blocked', 'train-blocked', ctx.say('train-blocked', { error }), { error });
  }
  return { code: exitCodeOf(action), action };
}

// ---------------------------------------------------------------- the command line

const USAGE = 'usage: train-loop.mjs next --lang <l> [--after <progressKey>] | depart --lang <l> [--update] | wait --lang <l>';

function parseArgs(argv, { values = [], flags = [] }) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (values.includes(a)) {
      if (argv[i + 1] === undefined) throw new TrainUsageError(`${a} needs a value; ${USAGE}`);
      opts[a.slice(2)] = argv[++i];
    } else if (flags.includes(a)) opts[a.slice(2)] = true;
    else if (a.startsWith('--')) throw new TrainUsageError(`unknown option ${a}; ${USAGE}`);
    else opts.positional.push(a);
  }
  if (opts.positional.length) throw new TrainUsageError(USAGE);
  return opts;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const failure = (argv, e) => {
  const message = e instanceof Error ? e.message : String(e);
  const lang = argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1];
  return { code: 3, stdout: json({ version: 1, error: message, reply: render(lang, 'request-unreadable') }), stderr: `train-loop: ${message}\n` };
};

export function main(argv, opts = {}) {
  const common = { env: opts.env ?? process.env, gh: opts.gh, tmp: opts.tmp };
  const cwd = opts.cwd ?? process.cwd();
  try {
    const [sub, ...rest] = argv;
    if (sub === 'next') {
      const o = parseArgs(rest, { values: ['--lang', '--after'] });
      const r = next(cwd, { ...common, lang: o.lang, after: o.after ?? null });
      return { code: r.code, stdout: json(r.action), stderr: '' };
    }
    if (sub === 'depart') {
      const o = parseArgs(rest, { values: ['--lang'], flags: ['--update'] });
      const r = depart(cwd, { ...common, lang: o.lang, update: o.update === true });
      return { code: r.code, stdout: json(r.out), stderr: '' };
    }
    throw new TrainUsageError(USAGE);
  } catch (e) {
    if (e instanceof TrainError && !(e instanceof TrainUsageError)) {
      const reply = render(argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1], 'train-blocked', { error: e.message });
      return { code: 3, stdout: json({ version: 1, result: 'unreadable', error: e.message, reply }), stderr: `train-loop: ${e.message}\n` };
    }
    return failure(argv, e);
  }
}

const POLL_DEFAULT = 30;
const realSleep = (seconds) => new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });

// `wait`: the first action when it is not a wait on GitHub, else the first action that differs from it, polling every
// DEVKIT_POLL_SECONDS with no limit.
async function runWait(argv, opts) {
  const o = parseArgs(argv, { values: ['--lang'] });
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const seconds = Number(env.DEVKIT_POLL_SECONDS ?? POLL_DEFAULT);
  const interval = Number.isFinite(seconds) && seconds > 0 ? seconds : POLL_DEFAULT;
  const poll = () => next(cwd, { env, gh: opts.gh, tmp: opts.tmp, lang: o.lang });
  const first = poll();
  const waiting = (r) => r.action.kind === 'end' && r.action.end.state === 'waiting-on-github';
  if (!waiting(first)) return { code: 0, stdout: json(first.action), stderr: '' };
  const sleep = opts.sleep ?? realSleep;
  let failures = 0;
  for (;;) {
    await sleep(interval);
    let r;
    try { r = poll(); } catch (e) { failures += 1; if (failures >= 3) throw e; continue; }
    failures = 0;
    if (r.action.progressKey !== first.action.progressKey) return { code: 0, stdout: json(r.action), stderr: '' };
  }
}

export async function runCommand(argv, opts = {}) {
  if (argv[0] !== 'wait') return main(argv, opts);
  try {
    return await runWait(argv.slice(1), opts);
  } catch (e) {
    return failure(argv, e);
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === SELF; } catch { return false; }
}

if (isMain()) {
  runCommand(process.argv.slice(2)).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
