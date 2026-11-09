#!/usr/bin/env node
// Prepares a GitHub repository for ship: merge (auto-merge, design D8).
//   node github-setup.mjs [--json] [--checks a,b] [--method squash|merge|rebase] [--apply item,...]
// Items: workflow, auto-merge, delete-branch, ruleset. Without --apply it only
// reads and prints the plan: no `gh api -X` call and no file written. With
// --apply it changes only the items named, and only those in state create/update.
// Exit: 0 done, 1 a read or write failed, 2 usage.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVKIT_REVIEWS_CHECK, WORKFLOW_PATH, RULESET_NAME, MERGE_METHODS, readRepoSettings, desiredRuleset, makeGh, ghError } from '../../../hooks/merge-setup.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, '..', '..', '..');
const DEVKIT_REPO = 'chacal88/devkit';
const ITEMS = ['workflow', 'auto-merge', 'delete-branch', 'ruleset'];
const REPO = 'repos/{owner}/{repo}';

class UsageError extends Error {}

function parseArgs(argv) {
  const o = { json: false, checks: null, method: 'squash', apply: [] };
  const value = (i, flag) => { if (i + 1 >= argv.length) throw new UsageError(`${flag} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--checks') { o.checks = value(i++, a).split(',').map((s) => s.trim()).filter(Boolean); }
    else if (a === '--method') o.method = value(i++, a);
    else if (a === '--apply') o.apply = value(i++, a).split(',').map((s) => s.trim()).filter(Boolean);
    else throw new UsageError(`unknown argument ${a}`);
  }
  if (!MERGE_METHODS[o.method]) throw new UsageError(`--method must be one of ${Object.keys(MERGE_METHODS).join(', ')}`);
  const bad = o.apply.find((x) => !ITEMS.includes(x));
  if (bad) throw new UsageError(`--apply item "${bad}" is not one of ${ITEMS.join(', ')}`);
  return o;
}

const runGh = (args, cwd, input) => makeGh(cwd)(args, input === undefined ? {} : { input });
const parse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

// ------------------------------------------------------------ reading

const pluginVersion = () => JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const SHA = /^[0-9a-f]{40}$/;

// The commit sha of the devkit tag `v<plugin version>`, so the workflow pins
// content and not a movable name: { tag, sha } | { tag, missing } | { tag, error }.
// An annotated tag is dereferenced through git/tags/<sha>. Never a fallback.
function resolveTag(cwd) {
  const tag = `v${pluginVersion()}`;
  const shaOf = (route) => {
    const r = runGh(['api', route], cwd);
    if (r.status !== 0) return { r };
    const o = parse(r.stdout)?.object;
    return SHA.test(o?.sha ?? '') ? { object: o } : { error: `${route} returned an unreadable answer` };
  };
  let got = shaOf(`repos/${DEVKIT_REPO}/git/ref/tags/${tag}`);
  if (got.r) return /HTTP 404|Not Found/i.test(got.r.stderr) ? { tag, missing: true } : { tag, error: ghError(got.r) };
  if (got.error) return { tag, error: got.error };
  if (got.object.type === 'tag') {
    got = shaOf(`repos/${DEVKIT_REPO}/git/tags/${got.object.sha}`);
    if (got.r) return { tag, error: ghError(got.r) };
    if (got.error) return { tag, error: got.error };
  }
  return got.object.type === 'commit' ? { tag, sha: got.object.sha } : { tag, error: `tag ${tag} points at a ${got.object.type}, not a commit` };
}

function workflowItem(root, cwd) {
  const file = join(root, WORKFLOW_PATH);
  if (!existsSync(file)) {
    const pin = resolveTag(cwd);
    if (pin.missing) return { item: 'workflow', state: 'deferred', why: `tag ${pin.tag} does not exist in ${DEVKIT_REPO} yet; the workflow pins the commit of that tag, so release it first (never falls back to the tag or a branch)` };
    if (pin.error) return { item: 'workflow', state: 'error', why: `cannot resolve tag ${pin.tag} of ${DEVKIT_REPO}: ${pin.error}` };
    return { item: 'workflow', state: 'create', why: `${WORKFLOW_PATH} is missing; the script writes it from the template, pinned to ${pin.sha} (${pin.tag}); the owner commits it`, tag: pin.tag, sha: pin.sha };
  }
  if (/deliver-check(\.mjs)?["']?\s+--ci\b/.test(readFileSync(file, 'utf8'))) return { item: 'workflow', state: 'ok', why: `${WORKFLOW_PATH} runs deliver-check --ci` };
  return { item: 'workflow', state: 'deferred', why: `${WORKFLOW_PATH} exists but does not run deliver-check --ci; edit it by hand (it is never overwritten)` };
}

function settingsItems(settings, method) {
  const field = MERGE_METHODS[method];
  const flags = [];
  if (settings.allow_auto_merge !== true) flags.push('allow_auto_merge');
  if (settings[field] !== true) flags.push(field);
  const auto = flags.length
    ? { item: 'auto-merge', state: 'update', why: `${flags.map((f) => `${f} is off`).join(', ')}`, payload: `gh api -X PATCH ${REPO} ${flags.map((f) => `-F ${f}=true`).join(' ')}`, flags }
    : { item: 'auto-merge', state: 'ok', why: `allow_auto_merge and ${field} are on` };
  const del = settings.delete_branch_on_merge === true
    ? { item: 'delete-branch', state: 'ok', why: 'delete_branch_on_merge is on' }
    : { item: 'delete-branch', state: 'update', why: 'delete_branch_on_merge is off', payload: `gh api -X PATCH ${REPO} -F delete_branch_on_merge=true`, flags: ['delete_branch_on_merge'] };
  return [auto, del];
}

// Every check-run name of the default branch, across all pages (`--paginate` runs
// the jq per page, so the names come one per line, not as one array).
function discoverContexts(cwd, branch) {
  const r = runGh(['api', '--paginate', `${REPO}/commits/${encodeURIComponent(branch)}/check-runs?per_page=100`, '--jq', '.check_runs[].name'], cwd);
  if (r.status !== 0) return { error: ghError(r) };
  const names = r.stdout.split('\n').map((n) => n.trim()).filter(Boolean);
  return { contexts: [...new Set(names)].filter((n) => n !== DEVKIT_REVIEWS_CHECK) };
}

const contextsOf = (rs) => (rs.rules ?? []).filter((x) => x.type === 'required_status_checks').flatMap((x) => (x.parameters?.required_status_checks ?? []).map((c) => c.context));

// Does the stored ruleset already hold everything the desired one does?
function rulesetMatches(stored, want) {
  const rules = stored.rules ?? [];
  const checks = rules.find((x) => x.type === 'required_status_checks')?.parameters;
  const pr = rules.find((x) => x.type === 'pull_request')?.parameters;
  const have = new Set(contextsOf(stored));
  return stored.enforcement === 'active'
    && (stored.bypass_actors ?? []).length === 0
    && (stored.conditions?.ref_name?.include ?? []).includes('~DEFAULT_BRANCH')
    && Boolean(pr) && pr.required_approving_review_count === 0
    && checks?.strict_required_status_checks_policy === true
    && contextsOf(want).every((c) => have.has(c))
    && rules.some((x) => x.type === 'non_fast_forward');
}

// Has devkit-reviews reported? On the default branch (the workflow is there) or on the current PR.
function reportedWhere(cwd, branch) {
  const c = runGh(['api', `${REPO}/contents/${WORKFLOW_PATH}?ref=${branch}`], cwd);
  if (c.status === 0) return 'default-branch';
  const p = runGh(['pr', 'checks', '--json', 'name'], cwd);
  const list = parse(p.stdout);
  if (Array.isArray(list) && list.some((x) => x?.name === DEVKIT_REVIEWS_CHECK)) return 'pr';
  return null;
}

function otherOpenPrs(cwd, current) {
  const r = runGh(['pr', 'list', '--state', 'open', '--json', 'number,headRefName'], cwd);
  const list = r.status === 0 ? parse(r.stdout) : undefined;
  return Array.isArray(list) ? list.filter((p) => p.headRefName !== current) : [];
}

function rulesetItem(cwd, { branch, contexts, current }) {
  const list = runGh(['api', `${REPO}/rulesets`], cwd);
  if (list.status !== 0) return { item: 'ruleset', state: 'error', why: `cannot read the rulesets: ${ghError(list)}` };
  const all = parse(list.stdout);
  if (!Array.isArray(all)) return { item: 'ruleset', state: 'error', why: 'rulesets returned unreadable JSON' };
  const found = all.find((r) => r.name === RULESET_NAME);
  let stored = null;
  if (found) {
    const one = runGh(['api', `${REPO}/rulesets/${found.id}`], cwd);
    stored = one.status === 0 ? parse(one.stdout) : undefined;
    if (!stored) return { item: 'ruleset', state: 'error', why: `cannot read ruleset ${found.id}: ${ghError(one)}` };
  }
  // Extra contexts already in the stored ruleset are kept.
  const want = desiredRuleset(stored ? [...new Set([...contextsOf(stored), ...contexts])] : contexts);
  if (stored && rulesetMatches(stored, want)) return { item: 'ruleset', state: 'ok', why: `ruleset ${RULESET_NAME} (#${stored.id}) already requires ${contextsOf(stored).join(', ')}` };

  const where = reportedWhere(cwd, branch);
  if (!where) {
    return { item: 'ruleset', state: 'deferred', why: 'devkit-reviews has not reported yet; merge the workflow first (a required check that never reports blocks every PR)' };
  }
  const state = stored ? 'update' : 'create';
  const out = {
    item: 'ruleset', state,
    why: `${state === 'update' ? `ruleset ${RULESET_NAME} (#${stored.id}) lacks part of the desired rules` : `no ruleset named ${RULESET_NAME}`}; main will refuse direct pushes from everyone, the owner included`,
    payload: want,
    id: stored?.id,
    command: stored ? `gh api -X PUT ${REPO}/rulesets/${stored.id} --input -` : `gh api -X POST ${REPO}/rulesets --input -`,
  };
  if (where === 'pr') out.otherPrs = otherOpenPrs(cwd, current);
  return out;
}

function plan(cwd, root, opts) {
  const result = { items: [], contexts: [], defaultBranch: null, method: opts.method };
  const wf = workflowItem(root, cwd);
  const read = readRepoSettings((args) => runGh(args, cwd));
  if (read.error) {
    const why = `cannot read the repository settings: ${read.error}`;
    result.error = why;
    result.items = [wf, ...ITEMS.slice(1).map((item) => ({ item, state: 'error', why }))];
    return result;
  }
  const { settings } = read;
  const branch = settings.default_branch;
  result.defaultBranch = branch;
  let contexts = opts.checks;
  let discoverError = null;
  if (!contexts) {
    const found = discoverContexts(cwd, branch);
    if (found.error) { discoverError = `cannot read the checks of ${branch}: ${found.error}`; contexts = []; } else contexts = found.contexts;
  }
  result.contexts = contexts;
  const current = git(cwd, ['symbolic-ref', '--short', '-q', 'HEAD']).stdout.trim();
  const [auto, del] = settingsItems(settings, opts.method);
  const rs = discoverError ? { item: 'ruleset', state: 'error', why: discoverError } : rulesetItem(cwd, { branch, contexts, current });
  result.items = [wf, auto, del, rs];
  return result;
}

// ------------------------------------------------------------ writing

function applyItem(cwd, root, it) {
  if (it.item === 'workflow') {
    const template = readFileSync(join(here, '..', 'templates', 'devkit-reviews.yml'), 'utf8');
    mkdirSync(dirname(join(root, WORKFLOW_PATH)), { recursive: true });
    writeFileSync(join(root, WORKFLOW_PATH), template.replaceAll('{{ref}}', it.sha).replaceAll('{{tag}}', it.tag));
    return null;
  }
  if (it.item === 'ruleset') {
    const r = runGh(['api', '-X', it.id ? 'PUT' : 'POST', it.id ? `${REPO}/rulesets/${it.id}` : `${REPO}/rulesets`, '--input', '-'], cwd, JSON.stringify(it.payload));
    return r.status === 0 ? null : ghError(r);
  }
  const r = runGh(['api', '-X', 'PATCH', REPO, ...it.flags.flatMap((f) => ['-F', `${f}=true`])], cwd);
  return r.status === 0 ? null : ghError(r);
}

// ------------------------------------------------------------ output

function render(result, applied) {
  const lines = [`repository: default branch ${result.defaultBranch ?? 'unknown'}, merge method ${result.method}`,
    `the ruleset will require these checks, found on ${result.defaultBranch ?? 'the default branch'} (confirm them, or pass --checks): ${result.contexts.join(', ') || 'none'}`];
  for (const it of result.items) {
    lines.push(`${it.item.padEnd(14)} ${it.state.padEnd(9)} ${it.why ?? ''}`.trimEnd());
    if (['create', 'update'].includes(it.state) && it.payload) {
      if (it.item === 'ruleset') { lines.push(`  ${it.command}`); for (const l of JSON.stringify(it.payload, null, 2).split('\n')) lines.push(`    ${l}`); } else lines.push(`  ${it.payload}`);
    }
    if (it.otherPrs?.length) {
      lines.push('  open PRs that will wait for devkit-reviews until updated with the default branch after this PR merges:');
      for (const p of it.otherPrs) lines.push(`    #${p.number} (${p.headRefName}) will wait for devkit-reviews until updated with ${result.defaultBranch} after this PR merges`);
    }
  }
  if (applied.length) lines.push(`applied: ${applied.join(', ')}`);
  return lines.join('\n');
}

// ------------------------------------------------------------ main

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`github-setup: ${e.message}\nusage: github-setup.mjs [--json] [--checks a,b] [--method squash|merge|rebase] [--apply item,...]\n`);
    return 2;
  }
  const cwd = process.cwd();
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) { process.stderr.write('github-setup: not inside a git repository\n'); return 2; }
  const root = top.stdout.trim();

  let result = plan(cwd, root, opts);
  const applied = [];
  const failed = new Map();
  if (opts.apply.length && !result.error) {
    for (const name of opts.apply) {
      const it = result.items.find((x) => x.item === name);
      if (!['create', 'update'].includes(it.state)) continue;
      const err = applyItem(cwd, root, it);
      if (err) failed.set(name, err); else applied.push(name);
    }
    result = plan(cwd, root, opts);
    for (const [name, err] of failed) Object.assign(result.items.find((x) => x.item === name), { state: 'error', why: err });
  }
  result.applied = applied;
  result.version = 1;
  const hadError = Boolean(result.error) || result.items.some((i) => i.state === 'error');
  process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${render(result, applied)}\n`);
  return hadError ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
