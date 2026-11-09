// The GitHub facts merge mode depends on, in one place (auto-merge, design D4).
// No dependencies. Holds the constants the workflow files and the checker share,
// and the read-only preflight of the repository settings (`mergeSetup`).
// `gh` is a function running `gh <args>`: { status, stderr, stdout, missing }.

import { execFileSync } from 'node:child_process';

// The check name is the workflow job id: the workflow must not set a job `name:`.
export const DEVKIT_REVIEWS_CHECK = 'devkit-reviews';
export const WORKFLOW_PATH = '.github/workflows/devkit-reviews.yml';
export const RULESET_NAME = 'devkit';

// merge_method -> the repository setting that allows it.
export const MERGE_METHODS = {
  squash: 'allow_squash_merge',
  merge: 'allow_merge_commit',
  rebase: 'allow_rebase_merge',
};

const POINTER = '; run the openspec-setup skill (GitHub step) to configure it';
const firstLine = (r) => (r.missing ? 'gh is not installed or not on PATH' : (r.stderr.trim().split('\n')[0] || `gh exited ${r.status}`));
const unreadable = (why) => `cannot read the repository settings: ${why}`;

function readJson(gh, route) {
  const r = gh(['api', route]);
  if (r.status !== 0) return { failed: r };
  try { return { json: JSON.parse(r.stdout) }; } catch { return { error: `${route} returned unreadable JSON` }; }
}

// GET repos/{owner}/{repo}: { settings } | { error }.
export function readRepoSettings(gh) {
  const got = readJson(gh, 'repos/{owner}/{repo}');
  if (got.failed) return { error: firstLine(got.failed) };
  if (got.error) return { error: got.error };
  return { settings: got.json };
}

// The status checks required on a branch, from the active rules of every
// ruleset and from classic branch protection (404 or 403 there means none):
// { contexts: [...] } | { error }.
export function requiredChecks(gh, branch) {
  const contexts = [];
  const rules = readJson(gh, `repos/{owner}/{repo}/rules/branches/${branch}`);
  if (rules.failed) return { error: firstLine(rules.failed) };
  if (rules.error) return { error: rules.error };
  for (const rule of Array.isArray(rules.json) ? rules.json : []) {
    if (rule?.type !== 'required_status_checks') continue;
    for (const c of rule.parameters?.required_status_checks ?? []) if (c?.context) contexts.push(c.context);
  }
  const classic = readJson(gh, `repos/{owner}/{repo}/branches/${branch}/protection/required_status_checks`);
  if (classic.failed && !/HTTP (404|403)\b|Not Found|Branch not protected/i.test(classic.failed.stderr)) return { error: firstLine(classic.failed) };
  if (classic.error) return { error: classic.error };
  if (classic.json) {
    contexts.push(...(classic.json.contexts ?? []));
    for (const c of classic.json.checks ?? []) if (c?.context) contexts.push(c.context);
  }
  return { contexts: [...new Set(contexts)] };
}

function committedAtHead(root, path) {
  try { execFileSync('git', ['cat-file', '-e', `HEAD:${path}`], { cwd: root, stdio: 'ignore' }); return true; } catch { return false; }
}

// The merge-mode preflight (AC-6, design D4): { ok, missing[], defaultBranch, error? }.
// Read-only; any read error fails closed, never passes.
export function mergeSetup(gh, root, method) {
  const fail = (why) => { const error = unreadable(why); return { ok: false, missing: [error + POINTER], error }; };
  const read = readRepoSettings(gh);
  if (read.error) return fail(read.error);
  const { settings } = read;
  const defaultBranch = settings?.default_branch;
  if (!defaultBranch) return fail('the answer has no default branch');
  const required = requiredChecks(gh, defaultBranch);
  if (required.error) return fail(required.error);
  const missing = [];
  if (settings.allow_auto_merge !== true) missing.push('auto-merge is not allowed (allow_auto_merge)');
  const field = MERGE_METHODS[method];
  if (field && settings[field] !== true) missing.push(`${method} merges are not allowed (${field})`);
  if (!required.contexts.includes(DEVKIT_REVIEWS_CHECK)) missing.push(`no active rule requires the ${DEVKIT_REVIEWS_CHECK} check on ${defaultBranch}`);
  if (!committedAtHead(root, WORKFLOW_PATH)) missing.push(`${WORKFLOW_PATH} is not committed`);
  return { ok: missing.length === 0, missing: missing.map((m) => m + POINTER), defaultBranch };
}

// The ruleset `openspec-setup` creates (design D8): a pull request with zero
// approvals, the given status checks plus devkit-reviews (strict), no force
// pushes, no bypass actors. `devkit-reviews` is always required, once.
export function desiredRuleset(contexts) {
  const all = [...new Set([...contexts, DEVKIT_REVIEWS_CHECK])];
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'pull_request', parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: false, require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false } },
      { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: true, do_not_enforce_on_create: false, required_status_checks: all.map((context) => ({ context })) } },
      { type: 'non_fast_forward' },
    ],
  };
}
