<!-- devkit-stage proposal result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

Change: `merge-staleness-first-parent` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the owner's answers). Round 17d of `openspec/roadmap.md`.

## Why

`deliver-check`'s `staleness()` (`plugins/openspec/hooks/deliver-check.mjs`) decides whether the
`Commit:` line of a review file or of `evidence.md` is still current. For every commit after the
recorded one it lists the files with `git diff-tree -m`, which compares a merge commit with each of
its parents. Against the base-branch parent, a merge lists the branch's own product files, so any
merge of the base into a branch that already has product code reads as "touches a product file",
even when the base brought only `openspec/` files.

That happened on pull request #46 (`merge-setup-field-fixes` retro, item 1): `gh pr update-branch`
merged main, which brought only `openspec/roadmap.md`, and `deliver-check` marked `evidence.md` and
both reviews stale ("c292a5d touches .claude-plugin/marketplace.json"). It cost a third whole-suite
run (about 17 minutes) and a review round, and `devkit-reviews` went red meanwhile. In `merge` mode
the ruleset requires the branch to be up to date, so every pull request that waits behind another
one meets this.

## What Changes

- `staleness()` judges a merge commit (more than one parent) by the files that differ between its
  first parent and itself: what the merge brought into the branch, conflict resolutions included.
  A file outside `openspec/` among them makes the record stale, with the same reason form
  (`<short> is behind <merge short>, which touches <path>`).
- A commit with one parent, and a root commit, are judged exactly as today. The commits a merge
  brings in stay in the walk and are still judged one by one, so product code from the base still
  makes the record stale (the owner's answer to question 1).
- The stage readout (`flow-check.mjs`) and the `devkit-reviews` check call the same function, so
  they follow with no change of their own.
- `docs/openspec-flow.md`: the `Commit:` staleness rule and the `update-branch` row say how a merge
  is read. The devkit-openspec patch release (0.18.1 to 0.18.2, marketplace 0.22.1 to 0.22.2), its
  `CHANGELOG.md` section, and the CI snippet's pin moved to `v0.18.2`.

Non-goals: judging staleness only by the files the change itself touches (any file outside
`openspec/` brought from the base keeps making the record stale); walking only the first-parent
chain (`rev-list --first-parent`); any change to `flow-check.mjs`, to the reason wording or to the
dirty-tree rule; running "Update branch" on this change's own pull request as proof.

## Acceptance criteria

Copied from `requirements.md`, with their ids. Proven in this change with scratch repositories in
`plugins/openspec/hooks/deliver-check.test.mjs` (the stage readout's case also in
`plugins/openspec/hooks/flow-check.test.mjs`, `design.md` D-3).

- AC-1 `merge-openspec-only-current`: a branch with product commits before the recorded commit,
  then a `--no-ff` merge of main that brings only files under `openspec/`: `staleness()` returns
  null, so `evidence.md` and the reviews read current in `deliver-check` and in the stage readout.
- AC-2 `merge-product-stale`: the same branch, where main brings a file outside `openspec/` (another
  pull request's product code or version bump): `staleness()` reports the record stale and names
  that file.
- AC-3 `merge-resolution-stale`: a merge of main that brings only `openspec/` files but whose merge
  commit also changes a file outside `openspec/` (an edit made while resolving the merge) is stale
  and names that file.
- AC-4 `plain-commits-unchanged`: commits with one parent are judged exactly as before: every
  existing `staleness` test in `deliver-check.test.mjs` and `flow-check.test.mjs` stays green
  unchanged.

## Left for the next change (dogfood)

Not proven here and not an exit criterion; it is the dogfood of the next change that meets it,
recorded in this change's retro (`tasks.md`, Workflow follow-up):

- AC-5 `update-branch-dogfood`: on a real pull request, a GitHub "Update branch" that brings only
  `openspec/` files leaves `evidence.md` and the reviews current, with no new suite run or review
  round.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: one ADDED requirement, how a merge commit after a recorded `Commit:` is read
  by the delivery checker and the stage checker.

## Impact

- devkit-openspec (0.18.1 to 0.18.2): `hooks/deliver-check.mjs` (`staleness()` only),
  `hooks/deliver-check.test.mjs` and `hooks/flow-check.test.mjs` (new tests only),
  `hooks/change-loop.test.mjs` (the CI pin assertion). No change to `flow-check.mjs`, `guard.mjs`,
  `merge-setup.mjs`, `conduct-check.mjs` or the panel.
- The `devkit-reviews` check: it runs `deliver-check.mjs --ci`, which reads reviews and evidence
  through `staleness()`. devkit's own workflow runs the tree's checker, so the fix applies here from
  the merge. A project's workflow downloads the checker pinned to a release commit, so it gets the
  fix when its pin moves to `v0.18.2`; until then it behaves as before. Nothing a project has to do.
- Docs: `docs/openspec-flow.md` (the staleness rule, the `update-branch` row, the `v0.18.1`
  pins), `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`.
- Surfaces: hooks of devkit-openspec only. No backend, frontend, worker or panel surface.

**Exit criteria.** The gates of `tasks.md`: the flow-check suite (which loads the deliver-check
suite) under `GITHUB_HEAD_REF`/`GITHUB_BASE_REF`, then the whole hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and `claude plugin validate .`; and
`openspec validate merge-staleness-first-parent --strict`.

**Dependencies.** `merge-setup-field-fixes` (archived on 2026-11-21; devkit-openspec 0.18.1, the
version this change bumps, and the retro item it answers). Any sibling that also bumps
devkit-openspec meets this bump at the release rebase (`CONTRIBUTING.md`).

**Decisions cited.** ADR 0002 (the `devkit-reviews` check recomputes review currency at the PR head;
its consequence "strict up-to-date re-runs stale reviews after each base update" stays true, since a
base update that brings product code still makes them stale); ADR 0008 decision 4 (the `Commit:`
line stays as it is); ADR 0012 decision 4 (the check still recomputes reviews, findings, gates and
acceptance proof at the PR head). No new ADR is needed (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None. No point of `docs/coordination-design.md` ("Open points") is
touched. One refinement of the owner-confirmed command is recorded for the owner to see at
approval: `requirements.md` names `git diff --name-only -z <c>^1 <c>`; the plan uses the same
first-parent comparison through `git diff-tree`, which does not fold a move into its new path, so
a product file moved under `openspec/` by a merge still counts (`design.md` D-2).
