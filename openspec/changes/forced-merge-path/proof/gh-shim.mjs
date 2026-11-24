#!/usr/bin/env node
// gh-shim.mjs: the only way proof/replay.mjs reads GitHub (design D-13). It stands in for `gh` on the PATH of the replayed checkouts.
//
//   Live mode (REPLAY_REAL_GH set): a read goes to the real gh after the policy below; the default branch in `?ref=<branch>` becomes
//   `?ref=<REPLAY_MERGE_SHA>`, so a replay of an old pull request sees the default branch as it was at its merge.
//   Fixture mode (REPLAY_ANSWERS set): the answer comes from the answers file; a call it does not hold is refused. No call leaves the machine.
//
// Policy: only `gh --version`, `gh pr view|list|checks|diff`, a GET `gh api` call and a `gh api graphql` query without `mutation` pass.
// Every other call exits 97 and its stderr names the refusal. REPLAY_CALLS_LOG, when set, receives one JSON line per call.
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REFUSED = 97;
export const NO_ANSWER = 99;
const READ_PR = ['view', 'list', 'checks', 'diff'];
const FIELD_FLAGS = ['-f', '-F', '--field', '--raw-field'];

// The value of an option written `--name value` or `--name=value`, or null.
function optionValue(args, ...names) {
  for (let i = 0; i < args.length; i += 1) {
    for (const name of names) {
      if (args[i] === name) return args[i + 1] ?? '';
      if (name.startsWith('--') && args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
    }
  }
  return null;
}

// The route of a `gh api` call: the first argument that is not an option or an option's value.
const VALUE_FLAGS = ['-X', '--method', '-F', '-f', '--field', '--raw-field', '--jq', '-q', '--input', '-H', '--header', '--hostname', '--cache', '--template', '-t', '--preview', '-p'];
export function apiRoute(args) {
  const rest = args.slice(1);
  for (let i = 0; i < rest.length; i += 1) {
    if (VALUE_FLAGS.includes(rest[i])) { i += 1; continue; }
    if (rest[i].startsWith('-')) continue;
    return rest[i];
  }
  return null;
}

// { ok: true } | { ok: false, reason }: whether a call is a read.
export function classify(args) {
  if (!Array.isArray(args) || args.length === 0) return { ok: false, reason: 'no command' };
  const [command, sub] = args;
  if (command === '--version') return { ok: true };
  if (command === 'pr') return READ_PR.includes(sub) ? { ok: true } : { ok: false, reason: `gh pr ${sub ?? ''} is not a read` };
  if (command !== 'api') return { ok: false, reason: `gh ${command} is not a read the replay allows` };
  const method = optionValue(args, '-X', '--method');
  if (method !== null && method.toUpperCase() !== 'GET') return { ok: false, reason: `-X ${method} is a write` };
  if (args.includes('--input')) return { ok: false, reason: '--input sends a body' };
  const route = apiRoute(args);
  if (route === null) return { ok: false, reason: 'gh api names no route' };
  const fields = args.filter((a) => FIELD_FLAGS.includes(a) || /^--(field|raw-field)=/.test(a));
  if (route === 'graphql') {
    const query = args.find((a) => a.startsWith('query='));
    if (query === undefined) return { ok: false, reason: 'a graphql call without a query field' };
    if (/\bmutation\b/i.test(query)) return { ok: false, reason: 'a graphql mutation is a write' };
    return { ok: true };
  }
  if (fields.length) return { ok: false, reason: `${fields[0]} turns a gh api call into a POST` };
  return { ok: true };
}

// The same call with `?ref=<default branch>` rewritten to `?ref=<sha>` in the route (live mode only).
export function rewriteRef(args, base, sha) {
  if (!base || !sha || args[0] !== 'api') return args;
  return args.map((a) => a.replace(new RegExp(`([?&]ref=)${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w./-])`), `$1${sha}`));
}

// The fixture key of a call: the scheme of the test suite's fake gh, so a fixture reads like a test's.
const flat = (s) => String(s).replace(/[\\/{}?]/g, '_');
export function fixtureKeys(args) {
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  if (args[0] === 'api') {
    if (args[1] === 'graphql') return ['api-graphql'];
    const method = (optionValue(args, '-X', '--method') ?? 'GET').toUpperCase();
    return [`api-${method}-${flat(apiRoute(args))}`];
  }
  if (args[0] === '--version') return ['version'];
  if (args[0] === 'pr' && args[1] === 'list') {
    return [...(opt('--head') ? [`pr-list-head-${flat(opt('--head'))}`] : []), ...(opt('--state') ? [`pr-list-state-${opt('--state')}`] : []), 'pr-list'];
  }
  const own = args[0] === 'pr' && args[1] === 'view' && /^[0-9]+$/.test(args[2] ?? '') ? [`pr-view-${args[2]}`] : [];
  return [...own, `${args[0]}-${args[1]}${args.includes('--watch') ? '-watch' : ''}`];
}

// The answer of a fixture for a call: { stdout, stderr, exit } | null.
export function answerFor(answers, args) {
  const fields = (optionValue(args, '--json') ?? '').split(',');
  const key = fixtureKeys(args).find((k) => k in answers);
  if (key === undefined) return null;
  const one = answers[key];
  // Like gh, a list answers only the JSON fields asked for.
  if (args[0] === 'pr' && args[1] === 'list' && Array.isArray(one.stdout) && fields[0]) {
    return { ...one, stdout: one.stdout.map((p) => Object.fromEntries(fields.filter((f) => f in p).map((f) => [f, p[f]]))) };
  }
  return one;
}

const text = (v) => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));

// What the shim does for one call: { exit, stdout, stderr }. `env` carries the REPLAY_* variables; `runReal` runs the real gh.
export function shim(args, env, { runReal, answers = null } = {}) {
  const verdict = classify(args);
  if (!verdict.ok) return { exit: REFUSED, stdout: '', stderr: `gh-shim: refused (${verdict.reason}): gh ${args.join(' ')}\n` };
  if (answers) {
    const a = answerFor(answers, args);
    if (!a) return { exit: NO_ANSWER, stdout: '', stderr: `gh-shim: the fixture holds no answer for "${fixtureKeys(args)[0]}": gh ${args.join(' ')}\n` };
    return { exit: a.exit ?? 0, stdout: text(a.stdout), stderr: a.stderr ?? '' };
  }
  const real = runReal(rewriteRef(args, env.REPLAY_DEFAULT_BRANCH, env.REPLAY_MERGE_SHA));
  return { exit: real.status ?? 1, stdout: real.stdout ?? '', stderr: real.stderr ?? '' };
}

// ---------------------------------------------------------------- the answers of a fixture case

const OK = (name) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion: 'SUCCESS' });
const base64 = (s) => Buffer.from(s).toString('base64');
const file = (s) => ({ stdout: { name: 'file', encoding: 'base64', content: base64(s) } });
const NOT_FOUND = { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' };
const BOOM = (what) => ({ exit: 1, stderr: `gh: ${what}\n` });
const route = (r) => `api-GET-${flat(`repos/{owner}/{repo}/${r}`)}`;
export const contentsKey = (path, ref) => route(`contents/${path}?ref=${ref}`);

// The conclusions a rollup entry may be given as: a name string is SUCCESS, an object is { name, conclusion }.
const entryOf = (e) => (typeof e === 'string' ? OK(e) : { __typename: 'CheckRun', name: e.name, status: 'COMPLETED', conclusion: e.conclusion });

// Expands a fixture spec to the answers file the shim reads. `ctx` is the case's { id, branch, base, number, head, merge, url, tasks, releaseFile }.
//   spec.rollup:   [name | { name, conclusion }] or { error }          the checks of the merged head (the failed rollup read)
//   spec.required: [name]                                              the required checks of the default branch
//   spec.gates:    { evidence: 'missing' | 'passed', reviews: { <reviewer>: 'APPROVED' | 'REJECTED' } }
//   spec.branchDeleted: true | false                                   GitHub no longer finds the change's branch
export function expandFixture(spec, ctx) {
  const { id, base, number, head } = ctx;
  const required = spec.required ?? ['check', 'devkit-reviews'];
  const pr = {
    number, url: ctx.url, state: 'MERGED', headRefName: ctx.branch, headRefOid: head, baseRefName: base, mergeable: 'UNKNOWN',
    mergedAt: '2026-11-24T02:00:00Z', body: `${id}\nopenspec/changes/${id}/evidence.md\n`, autoMergeRequest: null, mergeStateStatus: 'UNKNOWN',
  };
  const a = {
    version: { stdout: 'gh version 2.60.0 (2026-01-01)\n' },
    'api-GET-repos__owner___repo_': { stdout: { default_branch: base, allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true } },
    [route(`rules/branches/${base}`)]: { stdout: [{ type: 'required_status_checks', parameters: { required_status_checks: required.map((context) => ({ context })) } }] },
    [route(`branches/${base}/protection/required_status_checks`)]: { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' },
    'pr-list-state-merged': { stdout: [pr] },
    [route(`pulls/${number}/files`)]: { stdout: `openspec/changes/${id}/tasks.md\nsrc/a.ts\n` },
    [contentsKey(`openspec/changes/${id}/tasks.md`, base)]: file(ctx.tasks),
    [contentsKey(`openspec/changes/${id}`, base)]: { stdout: { name: id, type: 'dir' } },
    [contentsKey('openspec/changes/archive', base)]: { stdout: [{ name: '2026-10-01-other' }] },
    [`pr-list-head-${flat(`chore/archive-${id}`)}`]: { stdout: [] },
    [`pr-view-${number}`]: spec.rollup?.error ? BOOM(spec.rollup.error) : { stdout: { statusCheckRollup: (spec.rollup ?? ['check', 'devkit-reviews']).map(entryOf) } },
    'pr-checks': { stdout: [] },
    // The release rows: the merged pull request, and a release file the merge did not touch (no tag is owed).
    [route(`pulls/${number}`)]: { stdout: { merged: true, base: { ref: base }, merge_commit_sha: ctx.merge } },
    [contentsKey(ctx.releaseFile ?? 'plugins/openspec/.claude-plugin/plugin.json', ctx.merge)]: NOT_FOUND,
    'api-graphql': { stdout: { data: { viewer: { login: 'replay' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } } },
  };
  // The change's own branch: GitHub still finds the merged pull request by it, or the branch is gone and only the list holds it.
  if (spec.branchDeleted === false) a['pr-view'] = { stdout: pr };
  else a['pr-view'] = { exit: 1, stderr: `no pull requests found for branch "${ctx.branch}"\n` };
  a[`pr-list-head-${flat(ctx.branch)}`] = { stdout: [pr] };
  a['pr-list'] = { stdout: [pr] };
  // The gate files at the merged head.
  const gates = spec.gates ?? {};
  const stage = (result) => `<!-- devkit-stage evidence result=${result} attempt=1 commit=${head} -->\nCommit: ${head}\n\n# Evidence\n`;
  a[contentsKey(`openspec/changes/${id}/evidence.md`, head)] = gates.evidence === 'passed' ? file(stage('passed')) : NOT_FOUND;
  const reviews = gates.reviews ?? {};
  const names = Object.keys(reviews);
  a[contentsKey(`openspec/changes/${id}/reviews`, head)] = names.length ? { stdout: names.map((n) => ({ name: `${n}.md`, type: 'file' })) } : NOT_FOUND;
  for (const [name, verdict] of Object.entries(reviews)) a[contentsKey(`openspec/changes/${id}/reviews/${name}.md`, head)] = file(`Verdict: ${verdict}\nCommit: ${head}\n\n# Review\n`);
  return { ...a, ...(spec.answers ?? {}) };
}

// ---------------------------------------------------------------- the command

function main(argv, env) {
  const answers = env.REPLAY_ANSWERS ? JSON.parse(readFileSync(env.REPLAY_ANSWERS, 'utf8')) : null;
  const runReal = (args) => {
    if (!env.REPLAY_REAL_GH) return { status: REFUSED, stderr: 'gh-shim: neither REPLAY_REAL_GH nor REPLAY_ANSWERS is set\n' };
    return spawnSync(env.REPLAY_REAL_GH, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...env, PATH: env.REPLAY_REAL_PATH ?? env.PATH } });
  };
  const out = shim(argv, env, { runReal, answers });
  if (env.REPLAY_CALLS_LOG) appendFileSync(env.REPLAY_CALLS_LOG, `${JSON.stringify({ args: argv, exit: out.exit })}\n`);
  process.stdout.write(out.stdout);
  process.stderr.write(out.stderr);
  return out.exit;
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) process.exitCode = main(process.argv.slice(2), process.env);
