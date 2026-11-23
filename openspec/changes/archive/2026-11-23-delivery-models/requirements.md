<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the delivery model chosen per project: two pull requests from the same branch with the lock that keeps `develop` out of the task branch, trunk-based, and trunk-based with automatic merge (D-5, D-8)

Classification: domain=process type=feature flags=[contract, architecture] (strict-assumed: the
project configuration is a contract the checkers and `project-setup` read, and the `develop` lock
is a new lock in the harness).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The three models are named `two-prs`, `trunk` and `trunk-auto`, as in the configuration example of
  `docs/coordination-design.md` section 8. `trunk` is today's `pr` ship mode (the owner merges) and
  `trunk-auto` is today's `merge` ship mode (GitHub merges once the gates are green, ADR 0002).
- The model, the base branch and the test branch live in `openspec/config.yaml`, in the top-level
  `devkit:` block, as `devkit.delivery.model`, `devkit.delivery.base` and
  `devkit.delivery.test_branch`. AMBIGUOUS: (a) `devkit.delivery.model` replaces the top-level
  `ship:` block, which stays readable as a fallback (`pr` read as `trunk`, `merge` as `trunk-auto`,
  `plan` kept as it is) | (b) `ship:` stays the switch and gains the value `two-prs`, and
  `devkit.delivery` holds only `base` and `test_branch`; the planner resolves.
- A project whose `openspec/config.yaml` says nothing new delivers exactly as today. devkit itself
  stays in `merge` mode (`trunk-auto`).
- In `two-prs` the task branch is cut from `devkit.delivery.base` (`master` or `main`), never from
  the test branch.
- The support branch for a conflict with the test branch is named `<task-branch>-<test_branch>`
  (for this change it would be `delivery-models-develop`). It is cut from the task branch and only
  it ever receives the test branch.
- GitHub cannot change the head branch of an open pull request, so moving the test-branch pull
  request onto the support branch means closing the first one and opening a new one from the support
  branch; the planner decides how the change records the new pull request.
- A commit added to the task branch after the pull requests open (a review fix, an owner request)
  reaches both pull requests; when a support branch exists, the task branch is merged into it so the
  test-branch pull request carries the fix too.
- The archive pull requests of a `two-prs` change are merged by the owner, as in `pr` mode: ADR 0003
  enables auto-merge on an archive pull request only in `merge` mode (`trunk-auto`).
- The archive pull request to the test branch comes from a branch cut from the test branch, so
  nothing of the test branch reaches the base branch.
- Outside the Claude driver (CompozyOS, a script driver) the `develop` lock is the GitHub check on
  the pull request to the base branch; the command refusal exists only in the Claude driver, as the
  lock table of `docs/coordination-design.md` section 8 says.
- A project in `two-prs` whose test branch does not exist on `origin` is told so when a change
  opens, and no change is cut until it exists.

Confirmed by the owner after the plan was written (2026-11-22):

- The base branch of a `two-prs` project is its GitHub default branch (`master` or `main`); the test
  branch is the QA branch, named `dev` or `develop` depending on the project, so its name always comes
  from `devkit.delivery.test_branch` (design D-2 holds).
- The resolution round reads only the support branch's own work: for each merge, the difference
  between Git's automatic merge and the recorded commit, plus the support branch's own commits, never
  what the test branch brought (design D-8's reading of AC-7 holds).

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `model-chosen-per-project`: a project chooses `two-prs`, `trunk` or `trunk-auto` in
  `openspec/config.yaml`, and the delivery the change coordinator drives follows that choice. A
  project whose configuration does not name the new model delivers as today: no behaviour changes
  for `plan`, `pr` and `merge` projects.
- AC-2 `two-prs-open-together`: in `two-prs`, the delivery stage opens two pull requests from the
  same task branch at the same time, one to the test branch and one to the base branch, each naming
  the change, and the change records both.
- AC-3 `owner-merges-both`: in `two-prs` devkit enables auto-merge on neither pull request; both
  merges are the owner's, and while one is open the change ends its turn waiting on the owner's
  merge, saying which pull request waits.
- AC-4 `base-waits-for-test-branch`: a check on the pull request to the base branch is red, naming
  the test-branch pull request, while that pull request is not merged, and turns green once it is.
- AC-5 `test-branch-never-in-task-branch`: in the Claude driver, a Git command that would bring the
  test branch into the task branch (merging it, rebasing onto it, pulling it) is refused with a
  reason that names the support branch as the way out; and a GitHub check on the pull request to the
  base branch fails, naming the commit, when the task branch holds a commit that is reachable from
  the test branch and not from the base branch.
- AC-6 `conflict-on-support-branch`: when the pull request to the test branch has a merge conflict,
  devkit creates `<task-branch>-<test_branch>` from the task branch, merges the test branch into it,
  resolves the conflict there, and the test-branch pull request then comes from the support branch;
  the task branch head and the pull request to the base branch are unchanged.
- AC-7 `conflict-resolution-reviewed`: before the test-branch pull request from the support branch
  goes on, the review bench runs a round on the resolution only (the difference between the task
  branch and the support branch), and its verdict is recorded in the change; an open blocking finding
  holds that pull request.
- AC-8 `fix-reaches-both`: a commit added to the task branch after the pull requests open shows on
  both pull requests, through the support branch when one exists.
- AC-9 `archive-to-both`: once both pull requests are merged, the change is archived through two
  archive pull requests, one to the base branch and one to the test branch, both merged by the owner;
  before the base-branch merge the change is not counted as delivered, and the stage readout says
  which merge it waits for.
- AC-10 `proof-in-tests`: automated tests run AC-2 to AC-9 against real Git in a temporary folder
  and a simulated GitHub; each criterion names the test that proves it.

## Proof: proven here vs first real use

- Proven in this change: AC-1 (the configuration read and today's modes unchanged, by the existing
  suites staying green), AC-2 to AC-9 by the tests of AC-10.
- First real use, in a later change of the owner's project that delivers with two pull requests:
  the two pull requests, the GitHub checks of AC-4 and AC-5, a real conflict on the support branch
  and the two archive pull requests on GitHub.

## Questions asked

1. [end effect] When does the second pull request (to the base branch) appear? → Both pull requests
   open together from the start.
2. [end effect] Who merges each pull request? → The owner merges both.
3. [edges] What happens when the task branch conflicts with the test branch? → A support branch
   `<task-branch>-<test_branch>` takes the conflict; the test-branch pull request comes from it; the
   task branch and the base-branch pull request stay untouched.
4. [edges] May the base-branch merge come before the test-branch merge? → No: the base-branch pull
   request is red until the test-branch one is merged.
5. [project rules] Does the conflict resolution go through the review bench again? → Yes, a round on
   the resolution only.
6. [scope] Where do the archive pull requests go? → To both the base branch and the test branch.
7. [project rules] How is the model proven, since devkit itself ships in `merge` mode? → Automated
   tests here; the first real use in a later change of the project that delivers with two pull
   requests.

## Out of scope

- A real end-to-end run on GitHub with two pull requests (the first real use, above).
- Writing the `devkit:` block into a project (roadmap change `project-setup`, which waits for this
  one).
- Any change to how `trunk` and `trunk-auto` deliver beyond reading them from the new configuration.
- A command refusal for the `develop` lock in drivers other than Claude.

## Escalations

- None open. The `develop` lock and the per-project delivery model are architecture decisions the
  decisions stage records (a new ADR or a note on ADR 0002 and ADR 0010).
