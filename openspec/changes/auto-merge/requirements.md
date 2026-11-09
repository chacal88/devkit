# Requirements

Classification: domain=process, type=feature, flags=[architecture, contract] (confirmed)

## Request

The owner, in their words (translated from Portuguese): "Let's update the plugins and do round 2."
Round 2 of `openspec/roadmap.md` is "auto-merge": in some repos, PRs and merges should happen
automatically, configured per repository. Round 1 (`ship-modes`, archived as
`2026-11-08-ship-modes`) delivered the `ship` key with modes `plan` and `pr`, the `ship-change`
skill and the eight-item delivery contract checked by `deliver-check`; `merge` was reserved and is
a config error today.

## Assumptions

- `ship` in `openspec/config.yaml` accepts a third mode, `merge`, for both schemas
  (`devkit` and `devkit-lite`). Example:
  ```yaml
  ship:
    devkit-lite: merge
    devkit: merge
  merge_method: squash
  ```
  (Owner decision: both schemas, reversing the explore session's "devkit-lite only".)
- A new optional top-level key in `openspec/config.yaml`, `merge_method`, with values `squash`,
  `merge` or `rebase`; absent means `squash`. Any other value is a config error (exit 3). It is read
  only in `merge` mode.
- In `merge` mode the `ship-change` skill runs `gh pr merge <n> --auto --<merge_method>` only when
  `deliver-check` reports 8/8 (`ready`). GitHub then merges when the required checks pass.
- If, after auto-merge was enabled, `deliver-check` stops reporting 8/8 (a new push, a stale review,
  a new comment), the skill runs `gh pr merge <n> --disable-auto` and returns to the normal loop
  (scoped re-review, evidence, answers); it enables auto-merge again only at 8/8.
- After enabling auto-merge the skill runs one capped wait (the existing watch, 9 minutes by
  default, 30 at most). It reports `merged` when GitHub merged the PR, otherwise
  `auto-merge on: waiting for <what>`. `deliver-check` recognises a `MERGED` PR as the final state
  of `merge` mode instead of reporting item 5 blocked; in `plan` and `pr` modes a merged PR stays
  as today.
- A new required check, `devkit-reviews`, runs `deliver-check` in CI on every pull request for
  items 1–4 only (tasks and gates, reviews current at head, findings disposed, acceptance criteria
  proven), which need only the repository and git history. Items 5–8 stay with GitHub and the skill.
  It replaces the review consensus that `guard.mjs ci` checks today (`reviewConsensus`, no
  staleness), closing the round-1 carry-over in `openspec/roadmap.md`.
- `merge` mode is blocked (not downgraded to `pr`) when the repository is not prepared:
  auto-merge not allowed on GitHub, no rule requiring `devkit-reviews` on the default branch, or no
  `devkit-reviews` workflow. `deliver-check` reports it as `blocked` naming what is missing and that
  `openspec-setup` configures it. Nothing merges without `devkit-reviews` required on the default
  branch.
- `openspec-setup` gains a GitHub step, used for `merge` mode. It shows the planned changes and
  applies them only after the owner confirms:
  - a ruleset on the default branch requiring the checks `ci` (the repo's existing check, by its
    real name) and `devkit-reviews`, requiring the branch to be up to date, and blocking direct
    pushes and force pushes;
  - `allow_auto_merge` on;
  - `delete_branch_on_merge` on;
  - a workflow `.github/workflows/devkit-reviews.yml` in the project, running `deliver-check`
    items 1–4.
- The owner's plan approval stays a human gate in every mode (readiness `APPROVED` for `devkit`, the
  owner's go-ahead for `devkit-lite`). `merge` removes only the human merge, and only in repos that
  opt in; the default stays the owner's merge.
- The decision is recorded as a new ADR, `docs/adr/0002-merge-without-the-owner-opt-in.md`; README,
  `docs/openspec-flow.md`, the `ship-change` skill and `commit-and-pr` drop "never merges" as an
  absolute and state it per mode. `commit-and-pr` itself still never merges; only `ship-change`
  enables auto-merge.
- Dogfood (owner decision): this change also configures chacal88/devkit itself for `merge` mode
  (the `openspec-setup` GitHub step applied here with the owner's confirmation, and `ship` set in
  this repo's `openspec/config.yaml`), so this change's own PR is delivered in `merge` mode.

## Acceptance criteria

- AC-1: With `ship: { devkit-lite: merge }` (or `devkit: merge`), `deliver-check` no longer exits 3
  for `merge`; `merge_method` other than `squash|merge|rebase` exits 3 naming the key.
- AC-2: In `merge` mode, auto-merge is enabled (`gh pr merge --auto --<method>`) only when
  `deliver-check` reports 8/8; at 7/8 or less it is never enabled.
- AC-3: A push or a stale review after auto-merge was enabled makes the skill disable auto-merge
  (`--disable-auto`) and resume the loop; auto-merge is enabled again only at 8/8.
- AC-4: After enabling auto-merge, one capped wait ends in `merged` (the PR is MERGED) or
  `auto-merge on: waiting for <what>`; `deliver-check` reports a MERGED PR in `merge` mode as done,
  and in `plan`/`pr` modes as today.
- AC-5: The `devkit-reviews` CI job fails when any of items 1–4 is not met (a stale review, an
  undisposed finding, an unproven criterion, a gate without a passing evidence row) and passes when
  all four are met; `guard.mjs ci` no longer approves stale reviews.
- AC-6: In `merge` mode on a repository missing allowed auto-merge, the required `devkit-reviews`
  rule or the workflow, `deliver-check` reports `blocked` naming what is missing and pointing to
  `openspec-setup`; nothing merges.
- AC-7: `openspec-setup`'s GitHub step lists the ruleset, `allow_auto_merge`,
  `delete_branch_on_merge` and the workflow it will apply, applies nothing without the owner's
  confirmation, and is idempotent when re-run.
- AC-8: The merge method follows `merge_method` (default `squash`).
- AC-9: `docs/adr/0002-merge-without-the-owner-opt-in.md` exists and is cited by README and
  `docs/openspec-flow.md`; no doc still says ship mode never merges without naming the mode.
- AC-10: chacal88/devkit has the ruleset, auto-merge allowed, branch deletion on merge and the
  `devkit-reviews` workflow, and this change's PR is merged by GitHub's auto-merge after
  `deliver-check` reported 8/8.
- AC-11: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3
  scripts/check.py`) passes, with tests covering `merge` parsing, the enable/disable rules, the
  MERGED state, the preflight block and the CI items 1–4 mode.

## Out of scope

- Archiving after merge, the post-merge Action and the ruleset bypass (round 3:
  `archive-after-merge`).
- The multi-change `conduct` skill (round 4).
- Resolving merge conflicts automatically (still `blocked: item 5`).
- Any merge outside `ship-change` (`commit-and-pr` never merges).

## Questions asked

1. [end effect] When is auto-merge enabled? → Only at `deliver-check` 8/8.
2. [scope] What does the required CI check verify? → Contract items 1–4, replacing
   `guard.mjs ci`'s review consensus.
3. [scope] What does `openspec-setup` configure on GitHub? → Ruleset on the default branch,
   `allow_auto_merge`, `delete_branch_on_merge`, the `devkit-reviews` workflow; always after the
   owner confirms.
4. [scope] Merge method? → Configurable per repo, default squash.
5. [project rules] `merge` for `devkit-lite` only, as decided in the explore session? → Both
   schemas.
6. [edges] A push after auto-merge was enabled? → Disable auto-merge and resume the loop; re-enable
   at 8/8.
7. [end effect] How does the run end? → One capped wait; `merged` or
   `auto-merge on: waiting for <what>`; MERGED is the final state in `merge` mode.
8. [edges] Repo not prepared? → Blocked, naming what is missing and pointing to `openspec-setup`.
9. [project rules] How to record dropping the owner's merge? → New ADR 0002.
10. [scope] Does this repo use `merge` mode in this change? → Yes, configured and used for this
    change's own PR.

## Planning resolutions accepted by the owner

On 2026-11-08 the owner accepted, as a whole, the resolutions R-1..R-11 that the change-planner
recorded in `design.md` where this file was ambiguous or contradicted the code or GitHub:

1. R-1: the existing required check is named `check` (the job; `ci` is the workflow); the ruleset
   requires `check` and `devkit-reviews`.
2. R-2: an invalid `merge_method` is a config error on every `deliver-check` run; the value is used
   only in `merge` mode.
3. R-3: `devkit-reviews` passes a PR with no change, with a note, as `guard.mjs ci` does; in CI the
   change is chosen by branch name or by the change folders the PR touches, never by "the only open
   change".
4. R-4: AC-10 means merged through `gh pr merge --auto --match-head-commit` at 8/8 (with checks
   already green, gh merges immediately).
5. R-5: the merge in AC-10 is recorded in `retro.md` after it happens; the evidence covers
   everything before it.
6. R-6: in `merge` mode a PR behind its base is updated with `gh pr update-branch`; the reviews go
   stale and re-run; conflicts stay `blocked: item 5`.
7. R-7: `devkit-reviews` failing in CI while items 1-4 pass locally stops as `blocked: item 6`.
8. R-8: the ruleset is applied only after `devkit-reviews` has reported at least once; once applied,
   nobody pushes to `main` directly, the owner included, until round 3 adds the bypass.
9. R-9: this repo's `ship` is `merge` for both schemas with `merge_method: squash`, confirmed at
   apply time.
10. R-10: the owner creates the release tag the workflow template pins (`v0.5.0`) after the merge.
11. R-11: the round 2 heading in `openspec/roadmap.md` drops "for devkit-lite".

## Escalations

- None open. Note for planning: the dogfood (AC-10) changes this repository's GitHub settings and
  makes this change's PR merge without the owner; the planner must place the GitHub step after the
  reviews and evidence, and each settings change still needs the owner's confirmation when applied.
