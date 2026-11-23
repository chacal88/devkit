<!-- devkit-stage proposal result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

Change: `delivery-models` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec:
`docs/coordination-design.md` sections 5 (D-5) and 8 (D-8) (source: `requirements.md`, with the
owner's seven answers). Round 17 of `openspec/roadmap.md`.

## Why

devkit delivers a change in one way only: one pull request to the default branch, merged by the
owner (`pr`) or by GitHub (`merge`). One of the owner's projects works with two pull requests from
the same task branch, one to a test branch and one to the base branch, and the test branch must
never reach the base branch, so the task branch never receives it either. D-5 decided the three
models are chosen per project and D-8 names the lock that keeps the test branch out; until this
round neither exists, and `project-setup` (round 26) waits for the configuration this change defines.

## What Changes

- The project chooses its delivery model in `openspec/config.yaml`: `devkit.delivery.model` is
  `two-prs`, `trunk` (today's `pr`) or `trunk-auto` (today's `merge`); `two-prs` also names
  `devkit.delivery.base` and `devkit.delivery.test_branch`. Without the new key the top-level `ship:`
  map decides exactly as today; with it, a `ship:` entry that disagrees is a configuration error
  (`design.md` D-1 resolves the requirements' AMBIGUOUS item as option (a)).
- In `two-prs`, `/devkit change` cuts the task branch from the base branch, refuses to open while the
  test branch is missing on `origin`, opens both pull requests together, never enables auto-merge,
  ends its turn on the owner's merge naming the pull request that waits, and reads the change as
  delivered only when the pull request to the base branch merges.
- The test-branch lock: in the Claude driver, a `git merge`, `git rebase` or `git pull` that would
  bring the test branch into any branch other than the test branch or a support branch is refused,
  naming the support branch; the `devkit-reviews` check fails a pull request to the base branch that
  holds a commit of the test branch, or whose pull request to the test branch is not merged yet. The
  check reads the delivery settings from the repository's default branch (the base branch), never
  from the pull request's head or the test branch, so a pull request to the test branch is judged by
  the same settings (`design.md` D-7).
- The delivery stops blocked, naming the cause, where it cannot go on by itself (the base branch is
  not the default branch, a test-branch commit in the task branch, a closed test-branch pull request,
  a closed, failing or conflicting test-branch archive); a resolution still rejected after two rounds
  waits for the owner.
- A conflict with the test branch goes to the support branch `<task-branch>-<test_branch>`: the
  resolution is reviewed by the bench on its own, the pull request to the test branch moves to the
  support branch, and later commits of the task branch reach it through the support branch.
- The archive goes to both branches through two archive pull requests, both merged by the owner.
- ADR 0015 (proposed with this plan, `design.md` D-12) records these decisions; it amends ADR 0002,
  ADR 0003, ADR 0010 and ADR 0012.
- Docs, skills and the release of devkit-openspec and devkit-core.

Non-goals: a real two-pull-request run on GitHub (the first real use, in a later change of the
owner's project); writing the `devkit:` block into a project (`project-setup`); any change to how
`trunk` and `trunk-auto` deliver beyond reading them from the new key; a command refusal in drivers
other than Claude; reading the owner's comments on the pull request to the test branch; a base branch
other than the repository's default branch (`design.md` D-2, confirmed by the owner in
`requirements.md`).

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `model-chosen-per-project`: a project chooses `two-prs`, `trunk` or `trunk-auto` in `openspec/config.yaml`, and the delivery the change coordinator drives follows that choice. A project whose configuration does not name the new model delivers as today: no behaviour changes for `plan`, `pr` and `merge` projects.
- AC-2 `two-prs-open-together`: in `two-prs`, the delivery stage opens two pull requests from the same task branch at the same time, one to the test branch and one to the base branch, each naming the change, and the change records both.
- AC-3 `owner-merges-both`: in `two-prs` devkit enables auto-merge on neither pull request; both merges are the owner's, and while one is open the change ends its turn waiting on the owner's merge, saying which pull request waits.
- AC-4 `base-waits-for-test-branch`: a check on the pull request to the base branch is red, naming the test-branch pull request, while that pull request is not merged, and turns green once it is.
- AC-5 `test-branch-never-in-task-branch`: in the Claude driver, a Git command that would bring the test branch into the task branch (merging it, rebasing onto it, pulling it) is refused with a reason that names the support branch as the way out; and a GitHub check on the pull request to the base branch fails, naming the commit, when the task branch holds a commit that is reachable from the test branch and not from the base branch.
- AC-6 `conflict-on-support-branch`: when the pull request to the test branch has a merge conflict, devkit creates `<task-branch>-<test_branch>` from the task branch, merges the test branch into it, resolves the conflict there, and the test-branch pull request then comes from the support branch; the task branch head and the pull request to the base branch are unchanged.
- AC-7 `conflict-resolution-reviewed`: before the test-branch pull request from the support branch goes on, the review bench runs a round on the resolution only (the difference between the task branch and the support branch), and its verdict is recorded in the change; an open blocking finding holds that pull request.
- AC-8 `fix-reaches-both`: a commit added to the task branch after the pull requests open shows on both pull requests, through the support branch when one exists.
- AC-9 `archive-to-both`: once both pull requests are merged, the change is archived through two archive pull requests, one to the base branch and one to the test branch, both merged by the owner; before the base-branch merge the change is not counted as delivered, and the stage readout says which merge it waits for.
- AC-10 `proof-in-tests`: automated tests run AC-2 to AC-9 against real Git in a temporary folder and a simulated GitHub; each criterion names the test that proves it.

## Capabilities

### New Capabilities

- `delivery-models`: the delivery model a project chooses (`two-prs`, `trunk`, `trunk-auto`), how it
  is read next to `ship:`, and how a change is delivered in the two-pull-request model (both pull
  requests, the owner's merges, the support branch, the resolution round, fixes, the two archives,
  and where the delivery and the archive stop for the owner).

### Modified Capabilities

- `change-delivery`: in `two-prs`, only the pull request to the base branch is the change's own and
  delivers it (ADDED requirements; the existing ones are unchanged).
- `reviews-check`: where `devkit-reviews` reads the delivery settings from (the default branch), and,
  in `two-prs`, what it judges on a pull request to the base branch and to the test branch (ADDED
  requirements).
- `coordination-locks`: the test branch never enters the task branch in the Claude driver (ADDED
  requirement).
- `change-coordination`: how a change opens in `two-prs`, and when a `two-prs` change counts as
  archived (ADDED requirements).

## Impact

- devkit-openspec (minor): `hooks/guard.mjs` (the `devkit:` block reader shared by every caller, the
  test-branch lock, the writer of `reviews/resolution/`), `hooks/deliver-check.mjs` (the delivery
  settings, the two-pull-request facts and steps, the CI rules, `listWorktrees` moved here),
  `hooks/change-loop.mjs`, `hooks/conduct-check.mjs`, `hooks/flow-check.mjs`, one table of
  `hooks/roadmap-loop.mjs`, `skills/ship-change/SKILL.md`, `skills/openspec-setup/templates/devkit-reviews.yml`;
  a new suite `hooks/delivery-models.test.mjs`.
- devkit-core (minor): `agents/commit-and-pr.md`, `agents/code-quality-reviewer.md`,
  `agents/test-coverage-reviewer.md`, `skills/review-change/SKILL.md` and `scripts/review-round.workflow.js`.
- The `devkit-reviews` check still downloads the same three files. A `two-prs` project needs the
  updated workflow (`pull-requests: read`, `GH_TOKEN`); other projects judge exactly as before.
- Docs: `docs/openspec-flow.md`, `docs/coordination-design.md`, ADR 0015 and dated Notes in ADRs
  0002, 0003, 0010 and 0012, the `ADRs:` line of `openspec/config.yaml`, `plugins/openspec/README.md`,
  `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `docs/catalog.md`.

**Dependencies.** `change-coordinator` (archived: the loop this change extends). Siblings under way
touch the same files: `merge-staleness-first-parent` (`staleness()` in `deliver-check.mjs`) and
`roadmap-coordinator-followups` (`roadmap-loop.mjs`, `change-loop.mjs`, `guard.mjs`, ADR 0014);
`design.md` "Where the siblings meet" lists each meeting point.

**Decisions cited.** ADR 0002, ADR 0003, ADR 0004, ADR 0010 (decisions 1, 5, 6), ADR 0011, ADR 0012,
ADR 0013; ADR 0015 proposed.

**Open decisions inherited.** "What to do when the task branch conflicts with `develop`" (Open points
of `docs/coordination-design.md`) is answered by the owner's grill (questions 3 to 5). The
configuration's field names for the delivery model, proposed in section 8, are decided here. The
two interpretations of `design.md` D-2 (the base branch is the GitHub default branch) and D-8 (the
resolution round reads only the support branch's own work) were confirmed by the owner after the plan
was written (`requirements.md`, "Confirmed by the owner after the plan was written", 2026-11-22).
ADR 0015's acceptance is the owner's, at plan approval.
