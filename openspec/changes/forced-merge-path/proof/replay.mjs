#!/usr/bin/env node
// replay.mjs: the harness of AC-8 (design D-13). It replays the owner's forced merges through the delivery checker and the loop, before and
// after this change, from the three checkouts of AC-3, reading GitHub only through proof/gh-shim.mjs (GET only) and the local clone.
//
//   node replay.mjs --case <name> [--dry-run] [--fixture <file>] [--pr <n>] [--before-ref <ref>] [--prepare] [--keep] [--json]
//   node replay.mjs --list
//
// A live case reads GitHub through the shim; a fixture case answers every call from its fixture file and refuses the rest. `--dry-run` prints
// the case and the checkouts it would build and calls nothing. `--prepare` builds the first checkout and prints where it is (for the real
// retro runs of the conducting session) and leaves it in place. The replay imports no hook rule: it runs the hooks as the loop does.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandFixture } from './gh-shim.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKTREE = resolve(HERE, '..', '..', '..', '..');
const SHIM = join(HERE, 'gh-shim.mjs');
const CLEAN = ['DEVKIT_CHANGE', 'DEVKIT_BRANCH', 'DEVKIT_BYPASS', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'GITHUB_EVENT_PATH', 'CLAUDE_CODE_SESSION_ID'];

export class ReplayUsageError extends Error {}

// PR 88 is the live case the change was opened for; its shas are the merge and head of the pull request on GitHub (design D-13).
const PR88 = {
  id: 'roadmap-sessions-upfront', branch: 'roadmap-sessions-upfront', number: 88, base: 'main',
  merge: '6999a043f0e94b76ea42a3ae77392dc67af6855e', head: '3929274b8e752ad78ef4a9253bba5b193cd02310',
};

// The case table. `live` cases read GitHub through the shim; `resolve` cases take their shas from `gh pr view <n> --json
// mergeCommit,headRefOid,headRefName` once the pull request is merged (`--pr <n>` names the number when the table has none).
// `fixture` cases answer from the fixture file and are built on PR 88's checkouts, so their git state is real.
export const CASES = {
  pr88: { kind: 'live', ...PR88 },
  pr91: { kind: 'resolve', id: 'stage-models', number: 91, base: 'main' },
  'delivery-train': { kind: 'resolve', id: 'delivery-train', number: null, base: 'main' },
  'compozy-driver': { kind: 'resolve', id: 'compozy-driver', number: null, base: 'main' },
  'pr88-partial': { kind: 'fixture', fixture: 'fixtures/pr88-partial.json', ...PR88 },
  'hand-opened': { kind: 'fixture', fixture: 'fixtures/hand-opened.json', ...PR88 },
  'no-evidence': { kind: 'fixture', fixture: 'fixtures/no-evidence.json', ...PR88 },
  'check-absent': { kind: 'fixture', fixture: 'fixtures/check-absent.json', ...PR88 },
  'rollup-fails': { kind: 'fixture', fixture: 'fixtures/rollup-fails.json', ...PR88 },
  'pt-br': { kind: 'fixture', fixture: 'fixtures/pt-br.json', ...PR88 },
};

// The three checkouts of AC-3, each a branch at a sha: the change's own branch at its head, the default branch and another change's
// branch at the merge commit.
export const checkoutsOf = (c) => [
  { name: 'branch', branch: c.branch, sha: c.head },
  { name: 'main', branch: c.base, sha: c.merge },
  { name: 'other-change', branch: 'other-change', sha: c.merge },
];

export function parseArgs(argv) {
  const opts = { case: null, dryRun: false, fixture: null, pr: null, beforeRef: 'origin/main', prepare: false, keep: false, json: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new ReplayUsageError(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--case') opts.case = value();
    else if (a === '--fixture') opts.fixture = value();
    else if (a === '--pr') opts.pr = Number(value());
    else if (a === '--before-ref') opts.beforeRef = value();
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--prepare') opts.prepare = true;
    else if (a === '--keep') opts.keep = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--list') opts.list = true;
    else throw new ReplayUsageError(`unknown option ${a}`);
  }
  if (opts.pr !== null && !Number.isInteger(opts.pr)) throw new ReplayUsageError('--pr needs a pull request number');
  if (!opts.list && !opts.case) throw new ReplayUsageError(`usage: replay.mjs --case <${Object.keys(CASES).join('|')}> [--dry-run] [--fixture <file>] [--pr <n>] [--before-ref <ref>] [--prepare] [--keep] [--json]`);
  return opts;
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
const fail = (what, r) => new Error(`${what}: ${(r.stderr || r.stdout || `exit ${r.status}`).trim().split('\n')[0]}`);

// The fixture of a case: its spec, from `--fixture <file>` or the table's file.
function fixtureOf(c, opts) {
  const file = opts.fixture ? resolve(opts.fixture) : join(HERE, c.fixture ?? '');
  if (!c.fixture && !opts.fixture) return null;
  if (!existsSync(file)) throw new ReplayUsageError(`no fixture file ${file}`);
  return { file, spec: JSON.parse(readFileSync(file, 'utf8')) };
}

// ---------------------------------------------------------------- dry run

export function plan(name, opts) {
  const c = CASES[name];
  if (!c) throw new ReplayUsageError(`unknown case "${name}"; the cases are ${Object.keys(CASES).join(', ')}`);
  const number = c.number ?? opts.pr;
  const resolved = c.kind !== 'resolve';
  const fx = c.kind === 'fixture' || opts.fixture ? fixtureOf(c, opts) : null;
  return { name, c, number, resolved, fixture: fx };
}

export function dryRun(name, opts) {
  const { c, number, resolved, fixture } = plan(name, opts);
  const lines = [];
  lines.push(`case ${name} (${fixture ? 'fixture' : c.kind}): change ${c.id}, pull request #${number ?? '?'}, base ${c.base}${fixture ? `, fixture ${fixture.file}` : ''}`);
  lines.push('would build, in a fresh temporary folder:');
  lines.push(`  a local clone of ${WORKTREE} (git clone --no-hardlinks), origin set to the real url, push url set to "no-push"`);
  lines.push(`  hooks before: git archive ${opts.beforeRef} plugins/openspec; hooks after: ${join(WORKTREE, 'plugins', 'openspec', 'hooks')}`);
  lines.push(fixture
    ? '  gh shim: answers every call from the fixture and refuses the rest (no call leaves the machine)'
    : `  gh shim: GET reads of GitHub only${resolved ? `, ?ref=${c.base} rewritten to ?ref=${c.merge}` : ', its shas read first with gh pr view <n> --json mergeCommit,headRefOid,headRefName'}`);
  if (!fixture) lines.push(`  gh shim cut: REPLAY_MAX_PR=${number ?? '<the number the case resolves>'} (no pull request above it is visible, so GitHub's later pull requests do not change the replay)`);
  if (resolved) {
    lines.push('the three checkouts:');
    checkoutsOf(c).forEach((k, i) => lines.push(`  ${i + 1}. ${k.name}: git checkout -B ${k.branch} ${k.sha}`));
  } else {
    lines.push('the three checkouts (shas read when the replay runs): the change branch at the pull request head, the base at its merge commit, other-change at its merge commit');
  }
  lines.push('for each checkout: deliver-check before and after, and change-loop next after');
  lines.push('dry run: nothing was called');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- the replay

function realGh() {
  const r = run('sh', ['-c', 'command -v gh']);
  const path = r.stdout.trim();
  if (r.status !== 0 || !path) throw new Error('gh is not on PATH: a live case reads GitHub through it');
  return path;
}

// The sha and branch of a merged pull request that is not in the table, read through the shim (GET only).
function resolvePr(number, env) {
  const r = run(join(env.REPLAY_BIN, 'gh'), ['pr', 'view', String(number), '--json', 'mergeCommit,headRefOid,headRefName,baseRefName'], { env });
  if (r.status !== 0) throw fail(`cannot read pull request #${number}`, r);
  const pr = JSON.parse(r.stdout);
  if (!pr.mergeCommit?.oid) throw new Error(`pull request #${number} is not merged yet: replay its fixture instead`);
  return { merge: pr.mergeCommit.oid, head: pr.headRefOid, branch: pr.headRefName, base: pr.baseRefName };
}

function setupClone(work, c, opts) {
  const clone = join(work, 'clone');
  const url = run('git', ['-C', WORKTREE, 'remote', 'get-url', 'origin']);
  if (url.status !== 0) throw fail('cannot read the origin url', url);
  let r = run('git', ['clone', '--quiet', '--no-hardlinks', WORKTREE, clone]);
  if (r.status !== 0) throw fail('git clone failed', r);
  for (const args of [['remote', 'set-url', 'origin', url.stdout.trim()], ['remote', 'set-url', '--push', 'origin', 'no-push'], ['config', 'user.email', 'replay@example.invalid'], ['config', 'user.name', 'replay']]) {
    r = run('git', ['-C', clone, ...args]);
    if (r.status !== 0) throw fail(`git ${args.join(' ')} failed`, r);
  }
  // The hooks of the last merged base, from this repository's own object database.
  const before = join(work, 'before');
  mkdirSync(before);
  const archive = run('sh', ['-c', `git -C "${WORKTREE}" archive "${opts.beforeRef}" plugins/openspec | tar -x -C "${before}"`]);
  if (archive.status !== 0) throw fail(`cannot take the hooks of ${opts.beforeRef}`, archive);
  return { clone, before: join(before, 'plugins', 'openspec', 'hooks') };
}

function checkout(clone, k, language) {
  const r = run('git', ['-C', clone, 'checkout', '--quiet', '-f', '-B', k.branch, k.sha]);
  if (r.status !== 0) throw fail(`cannot check out ${k.branch} at ${k.sha}`, r);
  if (language) {
    const file = join(clone, 'openspec', 'config.yaml');
    const text = readFileSync(file, 'utf8');
    if (!/^(\s+)language:\s*\S+/m.test(text)) throw new Error('the clone config has no devkit language line to set');
    writeFileSync(file, text.replace(/^(\s+)language:\s*\S+/m, `$1language: ${language}`));
  }
}

const json = (text) => { try { return JSON.parse(text); } catch { return null; } };

function deliverOf(hooks, clone, id, env) {
  const r = run('node', [join(hooks, 'deliver-check.mjs'), id, '--json'], { cwd: clone, env });
  const out = json(r.stdout);
  if (!out) return { code: r.status, error: (r.stderr || r.stdout).trim().split('\n')[0] || 'no output' };
  if (out.error) return { code: r.status, error: out.error };
  return { code: r.status, step: out.next?.step ?? null, reason: out.next?.reason ?? null, forced: out.next?.forced ?? null, summary: out.summary };
}

function loopOf(hooks, clone, id, lang, env) {
  const r = run('node', [join(hooks, 'change-loop.mjs'), 'next', '--change', id, '--lang', lang], { cwd: clone, env });
  // The loop prints its `devkit-run:` and `devkit-end:` marker lines, then the action as JSON.
  const out = json(r.stdout.split('\n').filter((l) => !/^devkit-(run|end):/.test(l)).join('\n'));
  if (!out) return { code: r.status, error: (r.stderr || r.stdout).trim().split('\n')[0] || 'no output' };
  return { code: r.status, kind: out.kind ?? null, stage: out.stage ?? null, step: out.step ?? out.end?.why ?? null, reply: out.reply ?? null };
}

export function replay(name, opts) {
  const p = plan(name, opts);
  const c = { ...p.c };
  const work = mkdtempSync(join(tmpdir(), 'forced-merge-replay-'));
  const real = p.fixture ? null : realGh();
  const bin = join(work, 'bin');
  mkdirSync(bin);
  const wrapper = join(bin, 'gh');
  writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${SHIM}" "$@"\n`);
  chmodSync(wrapper, 0o755);
  const calls = join(work, 'gh-calls.log');
  const base = { ...process.env };
  for (const k of CLEAN) base[k] = '';
  const env = { ...base, PATH: `${bin}:${process.env.PATH}`, REPLAY_BIN: bin, REPLAY_REAL_PATH: process.env.PATH, REPLAY_CALLS_LOG: calls, REPLAY_DEFAULT_BRANCH: c.base, GIT_TERMINAL_PROMPT: '0' };
  if (real) {
    env.REPLAY_REAL_GH = real;
    // The replay sees GitHub as it was at the merge: no pull request numbered above the replayed one (design D-13).
    if (p.number) env.REPLAY_MAX_PR = String(p.number);
  }
  try {
    if (p.fixture?.spec.git) Object.assign(c, p.fixture.spec.git);
    else if (p.c.kind === 'resolve') {
      if (!p.number) throw new ReplayUsageError(`case ${name} needs --pr <number> (or --fixture <file>)`);
      env.REPLAY_MERGE_SHA = '';
      Object.assign(c, resolvePr(p.number, env), { number: p.number });
    }
    env.REPLAY_MERGE_SHA = c.merge;
    const { clone, before } = setupClone(work, c, opts);
    const language = p.fixture?.spec.language ?? null;
    if (p.fixture) {
      const tasks = run('git', ['-C', clone, 'show', `${c.merge}:openspec/changes/${c.id}/tasks.md`]);
      if (tasks.status !== 0) throw fail('cannot read the tasks of the change at the merge commit', tasks);
      const answers = expandFixture(p.fixture.spec, { id: c.id, branch: c.branch, base: c.base, number: c.number, head: c.head, url: `https://github.com/${repoOf(clone)}/pull/${c.number}`, tasks: tasks.stdout, merge: c.merge });
      const answersFile = join(work, 'answers.json');
      writeFileSync(answersFile, JSON.stringify(answers));
      env.REPLAY_ANSWERS = answersFile;
    }
    const after = join(WORKTREE, 'plugins', 'openspec', 'hooks');
    const lang = language ?? 'en';
    const results = [];
    const wanted = opts.prepare ? checkoutsOf(c).slice(1, 2) : checkoutsOf(c);
    for (const k of wanted) {
      checkout(clone, k, language);
      if (opts.prepare) { results.push({ checkout: k, clone }); break; }
      results.push({ checkout: k, before: deliverOf(before, clone, c.id, env), after: deliverOf(after, clone, c.id, env), loop: loopOf(after, clone, c.id, lang, env) });
    }
    const expect = p.fixture?.spec.expect ?? null;
    const ghCalls = existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter(Boolean).map(json) : [];
    const outcome = { case: name, change: c.id, number: c.number, results, expect, ghCalls: ghCalls.length, refused: ghCalls.filter((g) => g && g.exit >= 97).map((g) => g.args.join(' ').replace(/\s+/g, ' ').slice(0, 120)) };
    if (opts.prepare) return { ...outcome, kept: { work, clone, bin, env: { PATH: env.PATH, REPLAY_REAL_GH: env.REPLAY_REAL_GH ?? null, REPLAY_ANSWERS: env.REPLAY_ANSWERS ?? null, REPLAY_MERGE_SHA: env.REPLAY_MERGE_SHA, REPLAY_DEFAULT_BRANCH: c.base, REPLAY_REAL_PATH: env.REPLAY_REAL_PATH, REPLAY_MAX_PR: env.REPLAY_MAX_PR ?? null } } };
    if (!opts.keep) rmSync(work, { recursive: true, force: true });
    else outcome.kept = { work };
    return outcome;
  } catch (e) {
    if (!opts.keep && !opts.prepare) rmSync(work, { recursive: true, force: true });
    throw e;
  }
}

function repoOf(clone) {
  const r = run('git', ['-C', clone, 'remote', 'get-url', 'origin']);
  return /github\.com[:/]([^/]+\/[^/.]+)/.exec(r.stdout)?.[1] ?? 'owner/repo';
}

// The three lines per checkout, and the comparison with what the fixture expects.
export function render(outcome) {
  const lines = [`case ${outcome.case}: change ${outcome.change}, pull request #${outcome.number}`];
  let mismatch = false;
  for (const r of outcome.results) {
    const at = `${r.checkout.name} (${r.checkout.branch} at ${r.checkout.sha.slice(0, 7)})`;
    if (!r.after) { lines.push(`checkout ${at}`); continue; }
    const side = (x) => (x.error ? `error ${x.error}` : `step ${x.step} | ${x.reason}`);
    lines.push(`checkout ${at}`, `  before: ${side(r.before)}`, `  after:  ${side(r.after)}`);
    lines.push(`  loop:   ${r.loop.error ? `error ${r.loop.error}` : `kind ${r.loop.kind}, stage ${r.loop.stage}, step ${r.loop.step}, reply ${r.loop.reply ?? '(none)'}`}`);
    const want = outcome.expect?.[r.checkout.name] ?? outcome.expect?.all;
    if (want) {
      const ok = (want.same ? r.after.step === r.before.step : r.after.step === want.after)
        && (want.loop === undefined || r.loop.step === want.loop) && (want.before === undefined || r.before.step === want.before);
      if (!ok) mismatch = true;
      const said = want.same ? 'after the same as before' : `before ${want.before ?? '(any)'}, after ${want.after}, loop ${want.loop ?? '(any)'}`;
      lines.push(`  expected: ${said}: ${ok ? 'ok' : 'MISMATCH'}`);
    }
  }
  lines.push(`gh calls through the shim: ${outcome.ghCalls}, refused: ${outcome.refused.length}${outcome.refused.length ? ` (${outcome.refused.join('; ')})` : ''}`);
  return { text: `${lines.join('\n')}\n`, mismatch };
}

export function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) {
    if (e instanceof ReplayUsageError) { process.stderr.write(`replay: ${e.message}\n`); return 2; }
    throw e;
  }
  try {
    if (opts.list) { process.stdout.write(`${Object.entries(CASES).map(([n, c]) => `${n}\t${c.kind}\t${c.id}`).join('\n')}\n`); return 0; }
    if (opts.dryRun) { process.stdout.write(dryRun(opts.case, opts)); return 0; }
    const outcome = replay(opts.case, opts);
    if (opts.json) { process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`); return 0; }
    const out = render(outcome);
    process.stdout.write(out.text);
    if (outcome.kept) process.stdout.write(`kept: ${JSON.stringify(outcome.kept)}\n`);
    return out.mismatch ? 1 : 0;
  } catch (e) {
    process.stderr.write(`replay: ${e.message}\n`);
    return e instanceof ReplayUsageError ? 2 : 1;
  }
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) process.exitCode = main(process.argv.slice(2));
