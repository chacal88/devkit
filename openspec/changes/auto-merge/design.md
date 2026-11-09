# Design

Change: `auto-merge` · Date: 2026-11-08 · Owner: kaue rodrigues dos santos · Inputs: [requirements.md](requirements.md), [proposal.md](proposal.md) · PRD / tech spec: n/a · Decisions: [ADR 0001](../../../docs/adr/0001-coordination-without-a-harness.md), ADR 0002 (drafted in D10)

## Context

See proposal.md (Why). What shapes the approach:

- **`merge` is rejected in two places.** `parseShip` throws on it (`plugins/openspec/hooks/deliver-check.mjs:46-48`; `SHIP_MODES = ['plan', 'pr']` at `:15`), and `nextStep` row 1 tests `state.ship !== 'pr'` (`:607`), so a `merge` value would also stop as `stop-plan-mode`. Both change.
- **A MERGED PR is blocked today.** `prItem` returns `blocked` for any state but `OPEN` (`deliver-check.mjs:418`). `PR_FIELDS` (`:386`) does not ask for `autoMergeRequest` or `mergeStateStatus`.
- **CI's review check ignores staleness.** `guard.mjs ci` (`guard.mjs:392-407`) checks readiness, then `prViolation` (`:266-276`), which uses `reviewConsensus` (`:139-148`): verdict values only, no `Commit:` line. `deliver-check`'s `readReviews` (`deliver-check.mjs:187-198`) applies the staleness rule (`staleness`, `:162-179`). The roadmap's round-2 carry-over asks both to agree.
- **The staleness rule needs history and the PR head.** `staleness` resolves the recorded sha, checks it is an ancestor of `HEAD` and inspects every commit since (`git rev-list`, `git diff-tree -m`). In GitHub Actions, `actions/checkout` defaults to depth 1 and, on `pull_request`, to the synthetic merge commit `refs/pull/N/merge`. With depth 1 no recorded sha resolves; with the merge commit, `diff-tree -m` against the base parent lists the whole PR diff. Either way every review would read as stale. The CI mode must check out the PR head with full history, and must say so when it does not have them.
- **This repo's CI does not run `guard.mjs ci`.** `.github/workflows/ci.yml` (workflow `ci`, job `check`) runs the catalog check, `check.py`, the hook tests and schema validation. GitHub reports that job as the check run `check` (checked: `gh pr checks 3` and `gh api repos/chacal88/devkit/commits/main/check-runs` both say `check`, app `github-actions`). The `guard.mjs ci` snippet lives in `docs/openspec-flow.md:224-245` for consumer projects and pins `v0.4.0`, but the repository has only the tags `v0.1.0` and `v0.2.0`.
- **chacal88/devkit today** (checked with `gh api`): public, `allow_auto_merge: false`, `delete_branch_on_merge: false`, squash/merge/rebase all allowed, no rulesets, `main` not protected, no open PRs, the planning session's token has `admin`.
- **`gh pr merge --auto` merges at once when it can.** In gh 2.88.1 (`pkg/cmd/pr/merge/merge.go:530`, `isImmediatelyMergeable`), `--auto` is dropped when `mergeStateStatus` is `CLEAN`, `HAS_HOOKS` or `UNSTABLE`, and gh calls `mergePullRequest` instead. `--match-head-commit <sha>` sets `expectedHeadOid` on both mutations (`http.go:77-80`). At 8/8 the required checks are green, so `--auto` usually merges at once.
- **A required check that never reports blocks merges.** A `pull_request` workflow runs from the PR's merge ref, so a PR whose branch and base both lack `devkit-reviews.yml` never reports the check. Requiring it before the workflow is on the default branch blocks such PRs until they are updated.
- **Hooks veto, CI enforces.** The bash guard only refuses `gh pr merge --admin` (`guard.mjs:257`). `commit-and-pr` never merges and never enables auto-merge (`plugins/core/agents/commit-and-pr.md:63`); `ship-change` forbids `gh pr merge` today (`plugins/openspec/skills/ship-change/SKILL.md:88`).
- **The round-1 retro** (`archive/2026-11-08-ship-modes/retro.md`): each stop the plan calls human gets one test through the real collector; a new checker is smoke-run on its own change before its gate is green; a format shared between packs is stated once, with its position, and pinned by a test on the producer's text; agents dispatched inside a change that edits their format use the repo's files (CONTRIBUTING.md).

## Goals / Non-Goals

**Goals:**

- One definition of "reviews and evidence are current" for the agent (`deliver-check` items 1–4), for CI (`devkit-reviews`, `guard.mjs ci`) and for GitHub's merge (`devkit-reviews` required).
- Auto-merge is enabled only by `ship-change`, only at 8/8, and only at the head `deliver-check` checked. It is disabled the moment the contract drops below 8/8.
- `plan` and `pr` modes behave exactly as in 0.4.0: same JSON, same steps, same exit codes. The only exception is a `devkit-reviews` failure while items 1–4 are met locally (D6, row 17a), which today would wrongly send a fix to `tdd-implementer`.
- GitHub changes are planned, shown, confirmed per item and idempotent.

**Non-Goals (design level):**

- No new state file; auto-merge state is read from GitHub each run (ADR 0001).
- No change to the local `gh pr create` hook (`prViolation`). It keeps checking verdict values only, because it has no reliable view of the PR head before the push. `devkit-reviews` is the stale-aware gate.
- No merge queue support, no required approving reviews, no `required_review_thread_resolution` in the ruleset (D7 says why).
- No `push` trigger for `devkit-reviews`; it runs on pull requests only.

## Decisions

### D1. No spec delta (`skip_specs: true`)

Same as `archive/2026-11-08-roadmap-rounds` and `archive/2026-11-08-ship-modes` (D1 there): the repository keeps no canonical specs, behavior is pinned by tests run from `guard.test.mjs` and documented in `docs/openspec-flow.md`. `.openspec.yaml` sets `skip_specs: true`. The schema says `skip_specs` is for changes with no spec-level behavior change; the precedents read it as "this repo pins behavior in tests", and this change follows them instead of starting the first capability spec, which would make `spec-reviewer` mandatory on every later change (`review-change/SKILL.md:52`).

### D2. Config: `merge` and `merge_method`

- `SHIP_MODES` becomes `['plan', 'pr', 'merge']`; `setMode` loses the round-2 rejection. Error messages list the three modes.
- New `parseMergeMethod(text)`: the top-level `merge_method:` line (same line parser: quotes and trailing `# comments` stripped, case-sensitive). No line or an empty value → `squash`. Values `squash`, `merge`, `rebase`. Anything else → `ShipConfigError('merge_method: unknown value "<v>"; use squash, merge or rebase')`, so the message starts with `openspec/config.yaml: merge_method:` (AC-1 "naming the key"). A nested map or a list after the key is also that error.
- New `shipConfig(root)` → `{ ship, mergeMethod }`, used by `collectState`. It validates both keys on every change-mode run, whatever the schema's mode. This follows round-1 D2 (an invalid entry fails the whole config, so a typo surfaces the first time). "Read only in merge mode" (requirements.md) is taken to mean that the value is used only in `merge` mode. Planning resolution R-2.
- `--ci` does not read `ship` or `merge_method` (D5): CI items 1–4 do not depend on the mode, and a config typo should not fail every PR's required check. `guard.mjs` still never reads either key (round-1 AC-1 test stays).
- Alternative rejected: `merge_method` inside `ship` (`ship: { devkit: merge, method: squash }`). It would mix a schema name and a setting in one map, and `method` would read as a schema name.

### D3. `guard.mjs ci` runs the CI check; `prViolation` stays for `gh pr create`

`ci()` (`guard.mjs:392-407`) becomes: `const { ciMain } = await import('./deliver-check.mjs')`, run it with `process.argv.slice(3)`, print its output and exit with its code. The import is dynamic, inside `ci()`, so `guard.mjs` keeps no static import of `deliver-check.mjs`, which imports `guard.mjs`. That avoids a cycle at load time. The dispatch at `:416-417` awaits it (top-level `await`, ESM). If `deliver-check.mjs` is not next to `guard.mjs` (a consumer workflow that downloads only `guard.mjs`), the import fails and `ci` prints `devkit ci: guard.mjs ci needs deliver-check.mjs in the same folder (download both; see docs/openspec-flow.md#ci)` and exits 1, failing closed.

`reviewConsensus` and `prViolation` stay as they are, for the `gh pr create` hook. AC-5 asks only that `guard.mjs ci` stop approving stale reviews.

Alternative rejected: moving `readReviews` and `staleness` into `guard.mjs`. That would spread git-history logic into the gate file, for the same result.

### D4. `merge-setup.mjs`: the GitHub facts and constants in one place

New `plugins/openspec/hooks/merge-setup.mjs` (no dependencies; imports nothing from `guard.mjs`), used by `deliver-check.mjs` (preflight) and `scripts/github-setup.mjs` (D8):

```js
export const DEVKIT_REVIEWS_CHECK = 'devkit-reviews';   // check name = workflow job id
export const WORKFLOW_PATH = '.github/workflows/devkit-reviews.yml';
export const RULESET_NAME = 'devkit';
export const MERGE_METHODS = { squash: 'allow_squash_merge', merge: 'allow_merge_commit', rebase: 'allow_rebase_merge' };
export function readRepoSettings(gh) { ... }          // gh api repos/{owner}/{repo}
export function requiredChecks(gh, branch) { ... }    // rules + legacy protection, below
export function mergeSetup(gh, root, method) { ... }  // { ok, missing[], defaultBranch, error? }
export function desiredRuleset(contexts) { ... }      // payload, D8
```

**Preflight (AC-6): exact calls and what "required" means.**

| Fact | Call | Missing when |
|---|---|---|
| Auto-merge allowed | `gh api repos/{owner}/{repo}` → `allow_auto_merge` | not `true` → `auto-merge is not allowed (allow_auto_merge)` |
| Method allowed | same answer → `MERGE_METHODS[method]` | not `true` → `<method> merges are not allowed (<field>)` (AC-8) |
| `devkit-reviews` required | `gh api repos/{owner}/{repo}/rules/branches/<default_branch>`: GitHub returns the active rules that apply to the branch, from every ruleset (repository and organization); rulesets in `evaluate` or `disabled` mode are not returned. Also `gh api repos/{owner}/{repo}/branches/<default_branch>/protection/required_status_checks`, for classic branch protection; 404 or 403 means none | no rule of `type: "required_status_checks"` whose `parameters.required_status_checks[].context` is `devkit-reviews`, and no classic `contexts[]` / `checks[].context` equal to it → `no active rule requires the devkit-reviews check on <branch>` |
| Workflow committed | `git cat-file -e HEAD:.github/workflows/devkit-reviews.yml` | absent → `.github/workflows/devkit-reviews.yml is not committed` |

`{owner}`/`{repo}` are filled in by `gh api` from the current repository. `default_branch` comes from the first call. A `gh` error other than the classic-protection 404/403 makes the preflight fail with `cannot read the repository settings: <first stderr line>`, never pass (fail closed, round-1 D4). Every reason ends with `; run the openspec-setup skill (GitHub step) to configure it`. Strictness (`strict_required_status_checks_policy`) is not part of the preflight: requirements.md asks for `devkit-reviews` to be required, and strictness is the setup's choice (D8).

### D5. `deliver-check --ci`: the `devkit-reviews` check

```text
node plugins/openspec/hooks/deliver-check.mjs --ci [<change-id>] [--json]
```

**Change selection** (first match wins):

1. `<change-id>` argument, or `DEVKIT_CHANGE`: that change; not an active change folder → exit 3.
2. The branch (`DEVKIT_BRANCH`, else `GITHUB_HEAD_REF`, else the git branch): the active change the branch ends with, else the single one it contains (as `resolveChange` does). Several contained → fail (exit 1, "several changes match branch <b>; name the branch after one").
3. When `GITHUB_BASE_REF` is set: the active changes whose folder the PR diff touches (`git diff --name-only <merge-base of origin/$GITHUB_BASE_REF and HEAD>..HEAD -- openspec/changes/`, archive excluded). One → that change. Several → fail as above.
4. When `GITHUB_BASE_REF` is not set (a local run): the only open change, as `resolveChange` does today.
5. Otherwise: no change. Pass (exit 0) with `devkit-reviews: no change selected by branch <b> or touched by this PR; nothing to check`.

The "only open change" fallback is replaced in CI by step 3 on purpose. After a squash merge, the merged change's reviews point at commits that are not ancestors of `main`. A change that is merged but not yet archived would then fail every unrelated chore PR. Step 3 checks a change only when the PR touches it. A chore PR passes with a note, as `guard.mjs ci` does today with no open change (`guard.mjs:396`). Planning resolution R-3.

**Checkout preflight (exit 3):** the repository is shallow (`git rev-parse --is-shallow-repository` is `true`) → `fetch the full history (actions/checkout with fetch-depth: 0)`. `GITHUB_EVENT_PATH` names a JSON whose `pull_request.head.sha` differs from `HEAD` → `check out the PR head (actions/checkout with ref: ${{ github.event.pull_request.head.sha }}), not the merge commit`. Also exit 3: not a git repository, usage errors. A checkout without `openspec/` passes with a note (exit 0), as `guard.mjs ci` did before 0.5.0 (owner-accepted: a repository that has not adopted OpenSpec must not fail its required check). The `guard.mjs` ↔ `deliver-check.mjs` import cycle (`guard.mjs` imports `ciMain` dynamically, `deliver-check.mjs` imports `guard.mjs` statically) is accepted for 0.5.x; it is harmless at load time and moving the shared helpers is not worth a release. `DEVKIT_BYPASS` is ignored.

**Checks:** readiness `- Status: APPROVED` when the schema has a `readiness` artifact (as `guard.mjs:400-403`), then `tasksItem`, `reviewsItem`, `findingsItem` and `acceptanceItem` exactly as in change mode (same functions, same `gitFacts`). The CI checkout has no uncommitted files, so `dirty` is empty there. Pass = readiness met and all four items `met`. `open` and `blocked` both fail: item 4's `no proof` fails CI too (AC-5: "fails when any of items 1–4 is not met").

**Output:**

```text
devkit-reviews: auto-merge (schema devkit, head 3f2a9c1)
  readiness met      Status: APPROVED
  1 met      tasks and gates: ...
  2 open     reviews at head: stale code-quality-reviewer (...)
  3 met      findings disposed: ...
  4 met      acceptance criteria proven: ...
fail: item 2
```

`--json`: `{ "version": 1, "mode": "ci", "change", "schema", "head", "readiness": { "status", "met" }, "items": [1..4], "pass": bool, "note"? }`. Exit 0 pass, 1 fail, 3 setup or usage error. `--ci` with `--watch` is a usage error.

**Workflows.** This repository runs its own checker from the PR (`.github/workflows/devkit-reviews.yml`):

```yaml
name: devkit-reviews
on:
  pull_request:
permissions:
  contents: read
jobs:
  devkit-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node plugins/openspec/hooks/deliver-check.mjs --ci
```

The template for other projects (`plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml`) is the same file, except that it downloads `guard.mjs` and `deliver-check.mjs` from `https://raw.githubusercontent.com/chacal88/devkit/{{ref}}/plugins/openspec/hooks/` into `$RUNNER_TEMP`, never into the workspace (a downloaded file in the repository would make every review stale), and runs `node "$RUNNER_TEMP/deliver-check.mjs" --ci`. `{{ref}}` is filled in by `github-setup.mjs` with the commit sha that the tag `v<devkit-openspec version>` points at (resolved with `gh api repos/chacal88/devkit/git/ref/tags/v<version>`, an annotated tag dereferenced through `git/tags/<sha>`), and `{{tag}}` with the tag name, in a comment. A tag is movable and the script runs in the consumer's CI with the merge gate's trust, so the pin is a sha; if the tag does not exist yet the item is `deferred`, never a fallback to the tag or a branch. The job has no `name:`, so the job id `devkit-reviews` is the check name, equal to `DEVKIT_REVIEWS_CHECK`. There is no `paths:` filter, because a required check that is skipped by a filter never reports. The trigger is `pull_request`, never `pull_request_target`: no secrets, a read-only token. A test reads both YAML files and pins the job id, the checkout `ref`/`fetch-depth` and the `--ci` command against the constant (retro: state a cross-pack format once and pin it on the producer's text).

### D6. Merge mode in `deliver-check`

**Facts.** In `merge` mode only, `fetchPr` asks for `PR_FIELDS + ',autoMergeRequest,mergeStateStatus'`. `collectState` adds `mergeMethod`, `setup` (D4, computed in `merge` mode only) and `pr.autoMerge` (`autoMergeRequest !== null`), `pr.state` and `pr.mergeStateStatus`. In `plan`/`pr` modes nothing new is fetched or computed, and the JSON is byte-identical to 0.4.0 for the same fixtures (a test compares them).

**Items in merge mode:**

- Item 5: a `MERGED` PR whose `headRefOid` equals the local head is `met` (`PR #n merged`). A `MERGED` PR at another head stays `blocked` (`PR #n merged at <sha>; local head <sha> differs`). `OPEN` with `mergeStateStatus: BEHIND` is `open` (`branch is behind <base>; update it`), `details.behind = true`. In `plan`/`pr` modes item 5 is unchanged: MERGED is blocked, BEHIND is not read.
- Items 6 and 7: when the PR is MERGED at the local head, `met` (`PR merged`) without calling `gh`.
- Item 8 unchanged.

**Next step.** Round-1 rows (archive `ship-modes/design.md` D4) keep their order. Merge mode adds four rows and changes two. Rows marked M apply only when `ship` is `merge`:

| # | Condition | `next.step` | Skill action |
|---|---|---|---|
| 0a M | PR MERGED at the local head | `merged` | report `merged` |
| 0b M | PR OPEN, auto-merge on, and not 8/8 | `disable-auto-merge` (number) | `gh pr merge <n> --disable-auto` (AC-3) |
| 1 | ship mode is `plan` (was `!== 'pr'`) | `stop-plan-mode` | stop |
| 2–3 | unchanged | `stop-branch`, `stop-not-approved` | stop |
| 3a M | `setup.ok` false | `stop-merge-setup` (`missing`) | stop: `blocked: merge setup (<missing>)` (AC-6) |
| 4–15 | unchanged | | |
| 15a M | item 5 open only because `details.behind` | `update-branch` (number) | `gh pr update-branch <n>`, then `git pull --ff-only` |
| 16–17 | unchanged | | |
| 17a | item 6 lists `devkit-reviews` as failing while items 1–4 are met (all modes) | `blocked` (item 6, "devkit-reviews fails in CI while items 1–4 are met locally: <link>") | stop; the owner reads the CI log |
| 18–20 | unchanged | | |
| 21 | all eight met, not `merge` mode | `ready` | report `ready` |
| 21a M | all eight met, auto-merge off | `enable-auto-merge` (`number`, `method`, `head`) | `gh pr merge <n> --auto --<method> --match-head-commit <head>` (AC-2, AC-8) |
| 21b M | all eight met, auto-merge on | `wait-merge` (`waitingFor`) | capped wait (below) |

- Row 0b comes before every stop and every step that pushes. The skill disables auto-merge before it changes anything, and a run that stops for any reason does not leave auto-merge on over a contract that is not 8/8. "Not 8/8" covers a new push (item 5 open or blocked), a stale review (item 2), a new comment (item 7), a pending re-run (item 6) and a branch that fell behind (item 5).
- Row 3a sits after the plan-approval stops and before any work: a repository that is not prepared stops before an agent run is spent. `merge` mode is blocked, never downgraded to `pr` (requirements.md).
- Row 17a covers a case where today's flow would send a CI failure to `tdd-implementer`. When `devkit-reviews` fails at the current head while items 1–4 are met locally, the CI and local views disagree (a file not pushed, a checkout misconfigured). No code fix applies, so the run stops.
- Row 21a passes `--match-head-commit`: if anyone pushed after `deliver-check` read the head, GitHub refuses, and the next run sees the new head (AC-2's "only at 8/8" holds for the exact commit checked).
- AC-2 test: for each item 1–8 set to `open` and then `blocked`, with the other seven met, `nextStep` never returns `enable-auto-merge`.

**Summary and exit codes in merge mode.** `merged` when row 0a matches; `auto-merge on: waiting for <what>` when all eight are met and auto-merge is on; `blocked: merge setup` when row 3a matches; otherwise as today. `<what>` comes from `mergeStateStatus`: `CLEAN`/`HAS_HOOKS`/`UNSTABLE` → `GitHub to merge`; `BLOCKED` → `branch rules outside the delivery contract (for example a required approval)`; `UNKNOWN` → `GitHub to compute mergeability`; anything else → `GitHub (mergeStateStatus <value>)`. Exit 0 for `merged` and for 8/8 (unchanged meaning: all eight met), 2 for `blocked: merge setup`, otherwise as today.

**JSON** stays `version: 1`. Additive: a `merge` object, present only in `merge` mode, `{ "method", "setup": { "ok", "missing" }, "autoMerge", "state", "mergeStateStatus", "waitingFor" }`; new `next.step` and `summary` values that only `merge` mode can produce (it was a config error before). `docs/openspec-flow.md` documents them.

**The wait (AC-4).** `--watch[=<minutes>]` (same default 9 and cap 30) now also acts when the next step is `wait-merge`. It polls `gh pr view <n> --json state,autoMergeRequest,mergeStateStatus,headRefOid` every `DEVKIT_POLL_SECONDS` (default 30; tests set 0) until the PR is not `OPEN`, auto-merge is off, the head changed, or the cap is reached, then collects the state again. Between polls it sleeps synchronously (`Atomics.wait`). After a gh error it collects the state again, so that error shows up as a blocked item. The `wait-checks` watch is unchanged.

### D7. GitHub settings and their limits

The ruleset `devkit` (D8) requires a pull request with zero approvals, the existing checks plus `devkit-reviews`, strict up-to-date, and blocks force pushes (`non_fast_forward`). Decisions inside it:

- **Zero approvals.** One required approval would put the owner's merge back. `CHANGES_REQUESTED` therefore does not block GitHub's merge on its own. Item 7 covers it while the skill runs, and row 0b disables auto-merge when a review lands before the merge.
- **No `required_review_thread_resolution`.** Item 7 accepts a thread whose last comment is the viewer's reply without resolving it (round-1 decision 6). Requiring resolution would block those PRs forever.
- **No bypass actors.** Requirements.md: "blocking direct pushes and force pushes". The owner can no longer push to the default branch either; archive commits go through PRs until round 3 adds the bypass. The setup says so before applying.
- **Strict.** With strict checks, a PR behind its base waits. Row 15a updates it. The update brings base commits, so reviews whose `Commit:` predates it go stale (round-1 staleness rule) and are re-run, scoped. That costs agent runs, and the owner chose strictness.

**What stays outside the gate.** Between skill runs, GitHub merges on the required checks alone. A comment posted after auto-merge was enabled, and before the merge, does not stop the merge unless someone disables auto-merge. At 8/8 the required checks are green, so the merge is usually immediate (Context, `isImmediatelyMergeable`) and the window is short. A PR can edit `devkit-reviews.yml` or, in this repository, `deliver-check.mjs` itself, and the edited version runs on that PR. Reviewers and `security-reviewer` see such diffs, and GitHub "required workflows" (organization level) are out of scope. All three limits are recorded in ADR 0002 and in Limits.

### D8. `openspec-setup` GitHub step: `scripts/github-setup.mjs`

```text
node <skill-dir>/scripts/github-setup.mjs [--json] [--checks <a,b,...>] [--method <m>] [--apply <item,...>]
```

Items: `workflow`, `auto-merge`, `delete-branch`, `ruleset`. Without `--apply` it only reads and prints the plan, with no `gh api -X` call and no file write. That is the default.

**Plan (one line per item, state `ok` | `create` | `update` | `deferred: <why>`):**

| Item | Read | Desired | Apply |
|---|---|---|---|
| `workflow` | `.github/workflows/devkit-reviews.yml` in the working tree | exists and runs `deliver-check` with `--ci` | missing → resolve tag `v<version>` (from `plugins/openspec/.claude-plugin/plugin.json`) to its commit sha and write the template with `{{ref}}` = that sha; tag absent → `deferred: tag v<version> does not exist`. Present but not running `deliver-check --ci` → `deferred: edit it by hand` (never overwritten). Not committed by the script (`openspec-setup` Never: commit) |
| `auto-merge` | `gh api repos/{owner}/{repo}` | `allow_auto_merge: true` and `MERGE_METHODS[method]: true` | `gh api -X PATCH repos/{owner}/{repo} -F allow_auto_merge=true` (and the method field if off) |
| `delete-branch` | same | `delete_branch_on_merge: true` | `gh api -X PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true` |
| `ruleset` | `gh api repos/{owner}/{repo}/rulesets`, then `.../rulesets/<id>` for the one named `devkit` | `desiredRuleset(contexts)` below | none → `gh api -X POST repos/{owner}/{repo}/rulesets --input -`; differs → `-X PUT .../rulesets/<id> --input -` keeping any extra contexts already there |

```json
{
  "name": "devkit", "target": "branch", "enforcement": "active", "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": true, "do_not_enforce_on_create": false, "required_status_checks": [{ "context": "check" }, { "context": "devkit-reviews" }] } },
    { "type": "non_fast_forward" }
  ]
}
```

**Contexts.** The existing checks are the check-run names on the default branch's head: `gh api repos/{owner}/{repo}/commits/<default>/check-runs --jq '[.check_runs[].name] | unique'`, without `devkit-reviews`. For chacal88/devkit that is `check`. requirements.md says `ci`; that is the workflow's name, and GitHub requires the check-run name (planning resolution R-1). The owner sees the list and can replace it with `--checks`.

**Ordering guard (the bootstrap problem).** `ruleset` is `deferred: devkit-reviews has not reported yet; merge the workflow first (a required check that never reports blocks every PR)` unless either holds:

- the workflow is on the default branch: `gh api repos/{owner}/{repo}/contents/.github/workflows/devkit-reviews.yml?ref=<default>` returns 200;
- or the current branch has an open PR on which a `devkit-reviews` check has reported, with any result: `gh pr checks --json name` lists it.

When the ruleset is applied in the second case, the plan lists every other open PR (`gh pr list --state open --json number,headRefName`) as "will wait for devkit-reviews until updated with <default> after this PR merges". The owner sees that list before confirming. The order for a consumer is: workflow written, the owner commits it and merges it through a normal PR, setup run again, ruleset applied. For this repository the second case applies (D11).

**Idempotent (AC-7).** `--apply` re-reads everything, applies only items in state `create`/`update` among those named, and re-reads afterwards. A second run reports all four `ok` and makes no write call (a test checks the fake `gh` call log for `-X`). Write errors (no admin rights, a plan without rulesets) are printed per item and exit 1. Items applied before the error stay applied and show `ok` on the next run.

**The skill step** (`openspec-setup/SKILL.md`, new step 6 "GitHub (merge mode)", asked only when the owner wants `merge` mode or runs the skill for it): run the plan, show every line with its payload, ask the owner to confirm each item that is not `ok` (one question per item), run `--apply <confirmed items>`, run the plan again and show it. Then add `ship` and `merge_method` to `openspec/config.yaml` only if the owner asks. Never apply an item that was not confirmed. The Never list gains "Change GitHub settings without the owner's confirmation of that item".

### D9. `ship-change` in merge mode

`plugins/openspec/skills/ship-change/SKILL.md`:

- Description: drives one approved change to a ready PR (`ship: pr`) or, with `ship: merge`, to a PR that GitHub merges once the contract is 8/8. "Use when" is unchanged.
- Mode section: `merge` explained; the skill enables auto-merge only at the step `enable-auto-merge`, never on its own reading.
- New step rows: `stop-merge-setup` (stop, report `blocked: merge setup (<missing>)` and that the `openspec-setup` GitHub step configures it); `disable-auto-merge` (`gh pr merge <n> --disable-auto`, then continue the loop); `update-branch` (`gh pr update-branch <n>`, then `git pull --ff-only`; an error stops as `blocked: item 5`); `enable-auto-merge` (`gh pr merge <next.number> --auto --<next.method> --match-head-commit <next.head>`, the exact command, then continue the loop); `wait-merge` (one `deliver-check <id> --json --watch`, then report); `merged` (report).
- Report: `merged`; `auto-merge on: waiting for <what>` (from `summary`); `ready` (pr mode); `in progress: item N`; `blocked: item N` / `blocked: merge setup`.
- Never: "Merge directly, use `--admin`, or run `gh pr merge` except at `enable-auto-merge` (`--auto`) and `disable-auto-merge` (`--disable-auto`)". The rest stays.
- Hosts: the single capped wait also applies to `wait-merge`. In the app, a merge does not wake the session, so the wait is the only observation.

Alternative rejected: a bash-hook veto on `gh pr merge` unless `deliver-check` says 8/8. A hook that calls GitHub on every Bash command is slow and fragile, and the enforcing gate is GitHub's ruleset with `devkit-reviews`, which holds whoever runs the command. ADR 0001: hooks veto what must never happen locally; GitHub enforces merges.

### D10. ADR 0002, draft text

File `docs/adr/0002-merge-without-the-owner-opt-in.md`, written in phase 4 by `tdd-implementer` (ADR 0001 pattern, `Status: accepted`: the owner decided it in requirements.md, question 9).

```markdown
# ADR 0002: Merge without the owner, by opt-in

- Status: accepted
- Date: 2026-11-08
- Change: auto-merge

## Context

Since ADR 0001, `ship-change` takes an approved change to a PR that `deliver-check` reports
as ready (8/8), and the owner merges it. Owners of some repositories want that merge to happen
on its own. An agent saying "ready" is not enough to merge on: until this change, CI checked
review verdicts without checking that they were current at the PR head.

## Decision

A repository may opt in, per schema, with `ship: <schema>: merge` in `openspec/config.yaml`.
In that mode, and only there, `ship-change` enables GitHub's auto-merge when `deliver-check`
reports 8/8, pinned to the head it checked, and disables it as soon as the contract drops
below 8/8. GitHub performs the merge, and only on a default branch whose active rules require
the `devkit-reviews` check. That check recomputes reviews, findings, gates and acceptance
proof at the PR head in CI. Without that rule, `merge` mode is blocked, not downgraded. The
owner's plan approval stays a human gate in every mode; `commit-and-pr` never merges; the
default stays the owner's merge.

## Consequences

- Positive: an opted-in change goes from approved plan to merged without the owner; the merge
  rests on a CI check that anyone can read, not on the session's word.
- Negative: nobody reads the final diff before it lands (Accepted: reviews, evidence and
  `devkit-reviews` are the reading). Between skill runs GitHub merges on required checks alone,
  so a comment made after auto-merge was enabled does not stop it (Mitigated: at 8/8 the merge
  is usually immediate, and the skill disables auto-merge when it sees the contract drop). A PR
  can change the workflow or the checker it is judged by (Accepted: reviewers see those diffs;
  organization-level required workflows are out of scope). The ruleset blocks direct pushes
  for everyone, the owner included (Accepted until round 3's bypass). Strict up-to-date
  re-runs stale reviews after each base update (Accepted: cost, scoped re-review).

### Review trigger

A merge happens that `devkit-reviews` would have failed, or GitHub changes how auto-merge
or rulesets treat required checks.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the owner's merge everywhere | Nothing new | The owner stays the last loop | low |
| The skill merges directly at 8/8 | No GitHub setup | The session's word is the gate; nothing stops a stale review | medium |
| One required human approval in the ruleset | Familiar | The owner's merge in another form | low |
| Merge queue | Serializes merges | Needs org plans or more setup; not needed for one maintainer | medium |
| A label-triggered merge Action | Unattended | Secrets in CI, a second coordinator outside the session (ADR 0001) | medium |
```

README "Why no harness" gains one sentence after the ADR 0001 paragraph: in repositories that opt in, `ship-change` lets GitHub merge once the contract is met and the `devkit-reviews` check passes; see ADR 0002. `docs/openspec-flow.md` links it from the ship modes section. `openspec/config.yaml` `context`: `ADRs: docs/adr/ (0001 coordination without a harness, 0002 merge without the owner, opt-in)`.

ADR 0001 is not superseded: coordination stays harness-free; ADR 0002 adds who merges. `adr-reviewer` checks both.

### D11. Dogfood on chacal88/devkit: order

The required check must exist on the PR before it is required, the settings change only with the owner's confirmation, and the reviews and evidence must already be in place. Order:

1. Phases 1–4 (`tdd-implementer`). Phase 1 commits this repository's `.github/workflows/devkit-reviews.yml`.
2. `review-change` (bench: `code-quality`, `test-coverage`, `architecture` for the JSON and CLI contract, `security` for the workflow permissions and the ruleset, `adr` for ADR 0002), then `pr-verifier`. Its evidence marks AC-10 `no proof: dogfood runs after the PR opens`, then `commit-and-pr` opens the PR (`ship` is still `plan` here; the owner can see the PR). `check` and `devkit-reviews` run on it. `devkit-reviews` fails at this point (phase 5 unticked, AC-10 not proven). That is expected: what matters is that it reported under its name.
3. Phase 5, run by the main session, because each item needs the owner's answer and a subagent cannot ask: `github-setup.mjs` plan on the real repository (smoke on real input), each item confirmed and applied, settings read back, `ship` and `merge_method` set in `openspec/config.yaml` with the owner's go-ahead, `deliver-check auto-merge` shows `setup.ok`. The read-back outputs go to `openspec/changes/auto-merge/dogfood.md`, the input `pr-verifier` cites for AC-10. Phase 5 writes only under `openspec/` (config, tasks, `dogfood.md`), so no review goes stale.
4. `pr-verifier` again. AC-10's row proves what can be proven before the merge: the ruleset, settings, workflow reporting, `ship` set, preflight ok. Then `commit-and-pr` pushes, and `devkit-reviews` turns green.
5. `ship-change auto-merge`, run from this repository's files (`plugins/openspec/skills/ship-change/SKILL.md` and `hooks/deliver-check.mjs`, not the installed 0.4.0, which rejects `merge`; CONTRIBUTING.md): 8/8 → `enable-auto-merge` → `merged`.
6. After the merge, `gh pr view <n> --json state,mergedAt,mergedBy,autoMergeRequest` and the PR timeline are recorded in `retro.md`, the last part of AC-10's proof. Archiving goes through a PR from then on.

`tasks.md` holds only work that can be ticked before step 5, because `deliver-check` item 1 needs every task ticked. Steps 5 and 6 are plain bullets under "Workflow follow-up".

## Implementation plan

Dependency order: config parsing and the CI mode (no GitHub) → merge mode against GitHub → skills, setup script and agent wording → decision record and release → dogfood.

### Per surface

- **devkit-openspec hooks**: `deliver-check.mjs` (D2, D5, D6), new `merge-setup.mjs` (D4), `guard.mjs` `ci` (D3), tests: `deliver-check.test.mjs`, new `merge-setup.test.mjs`, `guard.test.mjs`.
- **devkit-openspec skills**: `ship-change/SKILL.md` (D9); `openspec-setup/SKILL.md`, new `scripts/github-setup.mjs`, `scripts/github-setup.test.mjs`, `templates/devkit-reviews.yml`, `templates/config.yaml` (D8); pack `README.md`.
- **devkit-core**: `agents/commit-and-pr.md` (line 10 and the description say it never merges; in `merge` mode `ship-change` enables auto-merge after it stops), `skills/review-change/SKILL.md:150` (who merges per mode), `README.md:27`.
- **Repo**: `.github/workflows/devkit-reviews.yml`, ADR 0002, `README.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md`, `docs/catalog.md` (generated), `openspec/config.yaml`, `openspec/roadmap.md`, manifests, `CHANGELOG.md`.
- **GitHub**: chacal88/devkit settings (D11).

### File structure

| Action | Path |
|---|---|
| create | `plugins/openspec/hooks/merge-setup.mjs`, `plugins/openspec/hooks/merge-setup.test.mjs` |
| create | `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs`, `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` |
| create | `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml`, `.github/workflows/devkit-reviews.yml` |
| create | `docs/adr/0002-merge-without-the-owner-opt-in.md` |
| modify | `plugins/openspec/hooks/{deliver-check.mjs,deliver-check.test.mjs,guard.mjs,guard.test.mjs}` |
| modify | `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/openspec-setup/{SKILL.md,templates/config.yaml}`, `plugins/openspec/README.md` |
| modify | `plugins/core/agents/commit-and-pr.md`, `plugins/core/skills/review-change/SKILL.md`, `plugins/core/README.md` |
| modify | `README.md`, `docs/openspec-flow.md`, `docs/catalog.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `openspec/roadmap.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| delete | none |

### Estimate

Optimistic 19 h · likely 27 h · pessimistic 38 h. Most of the spread is in the merge-mode rows with their walkthrough, and in the setup script's idempotency against real GitHub answers.

### Effort

| Component | Hours | Type | Risk |
|---|---|---|---|
| `merge` / `merge_method` parsing, `shipConfig`, nextStep row 1 fix | 1.5 | Core | LOW |
| `--ci` mode: selection, checkout preflight, items 1–4, output, exit codes | 3.5 | Core | MEDIUM |
| `guard.mjs ci` delegation + updated guard tests | 1 | Core | MEDIUM (gate file) |
| Workflows (repo + template) and the pinning test; local smoke of `--ci` | 1.5 | Integration | MEDIUM |
| Fake `gh` keys for `api` paths and methods | 0.5 | Testing | LOW |
| `merge-setup.mjs` preflight + tests | 2 | Integration | MEDIUM |
| Merge-mode items, rows 0a/0b/3a/15a/17a/21a/21b, summary, JSON + tests, AC-2 matrix | 4 | Core | HIGH |
| `wait-merge` watch + tests; merge walkthrough (enable → push → disable → re-enable → merged) | 2.5 | Core | MEDIUM |
| `github-setup.mjs` (plan, apply, ordering guard, idempotency) + tests | 4 | Integration | HIGH |
| `ship-change`, `openspec-setup` SKILL.md, format tests | 1.5 | Core | MEDIUM |
| devkit-core wording, docs sweep test | 1 | Documentation | LOW |
| `docs/openspec-flow.md` (contract, CI, ship modes, troubleshooting, limits) | 1 | Documentation | LOW |
| ADR 0002, README, CONTRIBUTING, config, roadmap | 1 | Documentation | LOW |
| Versions, CHANGELOG, catalog | 0.5 | Documentation | LOW |
| Dogfood (phase 5) | 1.5 | Integration | HIGH |
| Total | 27 | | |

### Risks / Trade-offs

| # | Risk | P × I | Mitigation |
|---|---|---|---|
| R1 | The CI check reads every review as stale on a misconfigured checkout (depth 1, merge ref) and fails every PR | MEDIUM × HIGH | `--ci` exits 3 with the exact `actions/checkout` fix for a shallow repo or a HEAD that is not the PR head (D5); a test pins both workflow files' checkout options |
| R2 | A required `devkit-reviews` that never reports blocks every PR | MEDIUM × HIGH | The ruleset is deferred until the check has reported (D8 ordering guard); no `paths:` filter; other open PRs are listed before the owner confirms |
| R3 | Auto-merge stays on while the contract drops (session ends, someone pushes) | MEDIUM × HIGH | `devkit-reviews` fails on stale reviews or evidence, so GitHub does not merge; row 0b runs first in every run; `--match-head-commit` pins the head; the remaining window is recorded in ADR 0002 |
| R4 | A merged-but-not-archived change fails unrelated PRs' CI (squash merge breaks ancestry) | HIGH × MEDIUM | CI selection by branch name or PR diff only (D5 step 3); test with a squash-merged change on the base |
| R5 | `guard.mjs ci` users bump the tag but download only `guard.mjs` | MEDIUM × MEDIUM | Clear failure message naming both files (D3); docs snippet replaced by the template |
| R6 | Rulesets API answers differ from the fixtures (field names, evaluate mode, org rulesets) | MEDIUM × MEDIUM | Only documented fields; unknown or failed reads count as missing (fail closed); smoke on chacal88/devkit before the phase-5 gate (retro lesson) |
| R7 | `gh pr merge --auto` merges immediately (CLEAN) instead of enabling auto-merge | HIGH × LOW | Accepted and documented: the merge still happens only at 8/8 and at the checked head; the next run sees MERGED and reports `merged` (R-4 for AC-10's wording) |
| R8 | Strict up-to-date makes every base update re-run reviews | MEDIUM × MEDIUM | Scoped re-review (round 1), `update-branch` only in `merge` mode, documented in ADR 0002 |
| R9 | The owner is locked out of direct pushes to `main` | HIGH × LOW | Stated in the setup plan and CONTRIBUTING.md before confirmation; the owner can edit or disable the ruleset; round 3 adds the bypass |
| R10 | Dogfood uses the installed 0.4.0 skill and checker, which reject `merge` | MEDIUM × MEDIUM | D11 step 5 runs the repo's files; CONTRIBUTING.md already says so for format changes |
| R11 | A PR edits `devkit-reviews.yml` or the checker to pass itself | LOW × HIGH | `security-reviewer` on such diffs; recorded as accepted in ADR 0002 |

### Assumptions

| Assumption | Source | Breaks if |
|---|---|---|
| The GitHub check name for job `check` of workflow `ci` is `check` | `gh pr checks 3`, `gh api .../commits/main/check-runs` (2026-11-08) | The job gets a `name:`; `--checks` and the setup plan show the real names |
| `rules/branches/<branch>` returns only active rules, including org rulesets | GitHub REST docs for "Get rules for a branch" | Evaluate-mode rules appear: the preflight also checks `ruleset_source`/enforcement in the smoke and the test fixture gains that case |
| `gh pr merge --auto` merges directly when `mergeStateStatus` is CLEAN/HAS_HOOKS/UNSTABLE; `--match-head-commit` applies to both paths | gh 2.88.1 source (`merge.go:530,763-770`, `http.go:77-80`) | gh changes: the next `deliver-check` still reads the real state |
| `gh pr view` without a number finds the branch's PR after it was merged and its branch deleted | Round-1 item 5 handles MERGED from the same call | It does not: the skill passes the PR number from the previous JSON (`--watch` already uses the number) |
| OpenSpec 1.16.1 accepts `ship: merge` and `merge_method` | Scratch repo check, 2026-11-08 | A stricter CLI: move the keys |
| Rulesets are available for this public repository on its plan | GitHub docs; the repo is public | API answers 403/404: the setup reports it and `merge` stays blocked |
| `pull_request` workflows run from the PR's merge ref, so the PR that adds `devkit-reviews.yml` reports it | GitHub Actions docs | It does not report: D8's guard keeps the ruleset deferred |

### Dependencies

- `archive/2026-11-08-ship-modes` (merged, archived): `deliver-check` JSON `version: 1`, the `ship` key, `ship-change`, the agent formats.
- ADR 0001 (kept). ADR 0002 (this change).
- Owner decisions: requirements.md questions 1–10.
- GitHub admin rights on chacal88/devkit for phase 5 (present in the planning session).

## Planning resolutions for the owner

Points where requirements.md was ambiguous or did not match the code, resolved here. They need the owner's acceptance, recorded in requirements.md as in the round-1 precedent.

- **R-1 — check name.** requirements.md names the existing check `ci`. GitHub reports it as `check` (job id; `ci` is the workflow name), so the ruleset requires `check` and `devkit-reviews`.
- **R-2 — `merge_method` validation.** It is validated whenever `deliver-check` reads the config in change mode (round-1 rule: an invalid entry fails the whole config), and used only in `merge` mode. It is not read by `--ci` or by the hooks.
- **R-3 — PR with no change.** `devkit-reviews` passes with a note, as `guard.mjs ci` does today. In CI the change is chosen by branch name, else by the change folders the PR touches. The "only open change" fallback is not used in CI, because after a squash merge it would fail every chore PR.
- **R-4 — "merged by GitHub's auto-merge" (AC-10).** At 8/8 the required checks are green, so `gh pr merge --auto` usually merges at once instead of enabling auto-merge (gh behavior). AC-10 is read as "merged through `ship-change`'s `gh pr merge --auto --match-head-commit` after 8/8, by GitHub directly or through auto-merge".
- **R-5 — proving AC-10.** `deliver-check` item 4 needs AC-10 proven before 8/8, and the merge happens after. Evidence proves the pre-merge part (settings, workflow, `ship`, preflight). The merge itself is recorded in `retro.md` after it happens.
- **R-6 — `update-branch`.** The owner's strict up-to-date rule makes a PR behind its base wait forever, so in `merge` mode the skill updates the branch (`gh pr update-branch`), which makes reviews stale and re-runs them scoped. A conflict stays `blocked: item 5`. This is not conflict resolution.
- **R-7 — `devkit-reviews` failing while items 1–4 are met locally** stops as `blocked: item 6` in every ship mode, instead of sending a code fix to `tdd-implementer`.
- **R-8 — ruleset ordering.** The ruleset is applied only after `devkit-reviews` has reported, on the default branch or on the current PR. Here it is applied while this PR is open, before the workflow reaches `main`.
- **R-9 — `ship` for this repository.** Phase 5 sets `ship: { devkit-lite: merge, devkit: merge }` (the example in requirements.md) with `merge_method: squash`, unless the owner chooses otherwise at the confirmation.
- **R-10 — release tags.** The setup template pins `v0.5.0`, and the docs pin it too. The repository has only `v0.1.0` and `v0.2.0`, so the `v0.4.0` in today's docs does not resolve. Creating `v0.5.0` after the merge is a release step for the owner (Workflow follow-up). The missing `v0.3.0`/`v0.4.0` predate this change.
- **R-11 — roadmap heading.** Round 2 reads "auto-merge for devkit-lite"; owner decision 5 made it both schemas. Phase 4 updates the heading and marks the carry-over closed.

## Migration Plan

- Release devkit-openspec 0.5.0 and devkit-core 0.4.0. Projects without `ship: merge` see no behavior change except `guard.mjs ci`, which checks staleness once its pinned tag is bumped (it then needs `deliver-check.mjs` beside it, full history and the PR head). The CHANGELOG and the CI section say so.
- Opt in: run `openspec-setup` (GitHub step), merge the workflow, run it again for the ruleset, set `ship: <schema>: merge`.
- Rollback: delete the `devkit` ruleset or set its enforcement to `disabled`, set `ship` back to `pr`, and revert the PR. Auto-merge on an open PR: `gh pr merge <n> --disable-auto`.

## Open Questions

None that change the approach. R-1 to R-11 are this plan's answers and wait on the owner's acceptance.
