# Proposal

Change: `auto-merge` · Date: 2026-11-08 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · PRD / tech spec: n/a · Roadmap: round 2 of `openspec/roadmap.md`

## Why

Round 1 (`ship-modes`) takes an approved change to a PR that `deliver-check` reports as ready (8/8), then waits for the owner to merge it. In repositories that opt in, the owner wants that last step to happen on its own: GitHub merges once the contract is met and the required checks pass. That is only safe when a CI check, not the agent's own word, verifies the reviews and evidence at the PR head. Today `guard.mjs ci` approves reviews without checking that they are current (round-1 carry-over).

## What Changes

- **`ship: merge`** for both schemas in `openspec/config.yaml`, plus an optional top-level `merge_method` (`squash` | `merge` | `rebase`, default `squash`). `merge` stops being a config error; any other `merge_method` value is (exit 3).
- **`deliver-check` merge mode**: a preflight that blocks `merge` mode when the repository is not prepared (auto-merge not allowed, the merge method not allowed, no active rule requiring `devkit-reviews` on the default branch, no committed workflow), naming what is missing and pointing to `openspec-setup`. New next steps: `enable-auto-merge` only at 8/8, `disable-auto-merge` whenever auto-merge is on and the contract is no longer 8/8, `update-branch` when GitHub reports the branch behind its base, `wait-merge` with one capped wait, and `merged` as the final state. A MERGED PR is done in `merge` mode and stays blocked in `plan`/`pr` modes, as today.
- **`devkit-reviews` CI check**: `deliver-check --ci` checks readiness (schemas that have it) and contract items 1–4 at the PR head, from the repository and git history only. `guard.mjs ci` runs the same check, so CI no longer approves stale reviews. A PR that selects no change passes with a note, as `guard.mjs ci` does today.
- **`ship-change` skill**: runs the new steps (`gh pr merge <n> --auto --<method> --match-head-commit <sha>`, `--disable-auto`, `gh pr update-branch`) and ends with `merged`, `auto-merge on: waiting for <what>`, `ready` (pr mode), `in progress: item N` or `blocked: ...`.
- **`openspec-setup` GitHub step**: a script that lists the planned GitHub changes (ruleset `devkit` on the default branch requiring the existing checks and `devkit-reviews`, up to date, no direct or force pushes; `allow_auto_merge`; `delete_branch_on_merge`; `.github/workflows/devkit-reviews.yml`), applies only the items the owner confirms, and is idempotent.
- **Wording**: `commit-and-pr` still never merges; README, `docs/openspec-flow.md`, `ship-change`, `review-change` and the config templates state who merges per mode.
- **ADR 0002** `docs/adr/0002-merge-without-the-owner-opt-in.md`, cited by README and `docs/openspec-flow.md`.
- **Dogfood**: this repository gets its own `devkit-reviews` workflow; after the reviews and evidence, the GitHub step is applied to chacal88/devkit with the owner's confirmation per item, `ship` is set to `merge`, and this change's PR is merged through `ship-change`.
- **Release**: devkit-openspec 0.4.0 → 0.5.0, devkit-core 0.3.0 → 0.4.0, marketplace 0.5.0, CHANGELOG.

Non-goals (requirements.md, Out of scope): archiving after merge, the post-merge Action and the ruleset bypass (round 3); `conduct` (round 4); resolving merge conflicts (still `blocked: item 5`); any merge outside `ship-change`. Also not here: a hook that vetoes `gh pr merge` (GitHub's ruleset is the gate, design D9), and changing the local `gh pr create` hook (design D3).

## Acceptance criteria

- AC-1: With `ship: { devkit-lite: merge }` (or `devkit: merge`), `deliver-check` no longer exits 3 for `merge`; `merge_method` other than `squash|merge|rebase` exits 3 naming the key.
- AC-2: In `merge` mode, auto-merge is enabled (`gh pr merge --auto --<method>`) only when `deliver-check` reports 8/8; at 7/8 or less it is never enabled.
- AC-3: A push or a stale review after auto-merge was enabled makes the skill disable auto-merge (`--disable-auto`) and resume the loop; auto-merge is enabled again only at 8/8.
- AC-4: After enabling auto-merge, one capped wait ends in `merged` (the PR is MERGED) or `auto-merge on: waiting for <what>`; `deliver-check` reports a MERGED PR in `merge` mode as done, and in `plan`/`pr` modes as today.
- AC-5: The `devkit-reviews` CI job fails when any of items 1–4 is not met (a stale review, an undisposed finding, an unproven criterion, a gate without a passing evidence row) and passes when all four are met; `guard.mjs ci` no longer approves stale reviews.
- AC-6: In `merge` mode on a repository missing allowed auto-merge, the required `devkit-reviews` rule or the workflow, `deliver-check` reports `blocked` naming what is missing and pointing to `openspec-setup`; nothing merges.
- AC-7: `openspec-setup`'s GitHub step lists the ruleset, `allow_auto_merge`, `delete_branch_on_merge` and the workflow it will apply, applies nothing without the owner's confirmation, and is idempotent when re-run.
- AC-8: The merge method follows `merge_method` (default `squash`).
- AC-9: `docs/adr/0002-merge-without-the-owner-opt-in.md` exists and is cited by README and `docs/openspec-flow.md`; no doc still says ship mode never merges without naming the mode.
- AC-10: chacal88/devkit has the ruleset, auto-merge allowed, branch deletion on merge and the `devkit-reviews` workflow, and this change's PR is merged by GitHub's auto-merge after `deliver-check` reported 8/8.
- AC-11: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`) passes, with tests covering `merge` parsing, the enable/disable rules, the MERGED state, the preflight block and the CI items 1–4 mode.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedents: archive/2026-11-08-roadmap-rounds, archive/2026-11-08-ship-modes). skip_specs: true. See design.md D1. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): `hooks/deliver-check.mjs` (merge mode, `--ci`), new `hooks/merge-setup.mjs` (GitHub settings reader, check and ruleset constants), `hooks/guard.mjs` (`ci` delegates), tests (`deliver-check.test.mjs`, new `merge-setup.test.mjs`, `guard.test.mjs`); `skills/ship-change/SKILL.md`; `skills/openspec-setup/` (`SKILL.md`, new `scripts/github-setup.mjs` with its test, new `templates/devkit-reviews.yml`, `templates/config.yaml`); `README.md`; `plugin.json`.
- **devkit-core** (`plugins/core/`): `agents/commit-and-pr.md`, `skills/review-change/SKILL.md`, `README.md`; `plugin.json`.
- **Repo**: new `.github/workflows/devkit-reviews.yml` and `docs/adr/0002-merge-without-the-owner-opt-in.md`; `README.md`, `docs/openspec-flow.md`, `docs/catalog.md` (generated), `CONTRIBUTING.md`, `openspec/config.yaml`, `openspec/roadmap.md`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- **GitHub (chacal88/devkit)**: ruleset `devkit` on `main` (checks `check` and `devkit-reviews`, strict, PR required, no force push), `allow_auto_merge`, `delete_branch_on_merge`. From then on nobody pushes to `main` directly, the owner included.
- **Dependencies**: a `gh` with `pr update-branch` and `pr merge --match-head-commit` (both checked on 2.88.1), GitHub rulesets API, OpenSpec 1.16 (accepts `ship: merge` and `merge_method`, checked on 1.16.1), Node 22. No new packages.
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`, `openspec validate auto-merge --strict`, `devkit-reviews` and `check` green on the PR.
- **Decisions cited**: ADR 0001 (coordination without a harness; kept). **New**: ADR 0002 (drafted in design.md D10). **Open decisions inherited**: none; round 3's bypass stays out of scope.
