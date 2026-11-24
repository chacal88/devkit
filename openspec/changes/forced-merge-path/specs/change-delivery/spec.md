<!-- devkit-stage specs result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Delivered means its own pull request merged and every task ticked
A change SHALL be delivered when it is archived, or when its own pull request is merged and every
task of its `tasks.md` on the default branch is ticked. A delivered change, or an owner's forced
merge, SHALL lead the delivery checker to the archive steps; no other merged pull request SHALL.

#### Scenario: Every task ticked on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked
- **THEN** `deliver-check.mjs <id>` answers the retro, as before this change

#### Scenario: A partial pull request merged
- **WHEN** the change's own pull request is merged, its `tasks.md` on the default branch has unticked tasks, and every required check of its head is `SUCCESS`
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Only a pull request that names it
- **WHEN** no own pull request of the change is merged and a merged pull request links its evidence
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Every task ticked and a check red
- **WHEN** the change's own pull request is merged with every task ticked on the default branch and `devkit-reviews` `FAILURE` on its head
- **THEN** the change is delivered, `deliver-check.mjs <id>` answers the retro with the same reason as before this change, and the merged pull request's checks are not read

### Requirement: The work left after a merge is named
While a task of a change is unticked after its own pull request merged with every required check
green, the delivery checker SHALL name the unticked tasks as the work left. On the change's own
branch it SHALL lead through the same delivery contract to a further pull request; on any other
checkout it SHALL name the branch to continue on.

#### Scenario: From the default branch
- **WHEN** `deliver-check.mjs foo` runs on the default branch after pull request #12 of `foo` merged with tasks 3.1 and 3.2 unticked and every required check `SUCCESS`
- **THEN** its next step names pull request #12, the tasks 3.1 and 3.2 and the branch `foo` to continue on

#### Scenario: On the change's own branch
- **WHEN** the work left is done and ticked on branch `foo`, no open pull request exists for it, and the merged pull request's required checks were all `SUCCESS`
- **THEN** the next step is to open a further pull request, never the retro

#### Scenario: A further pull request is open
- **WHEN** pull request #12 of `foo` merged with a task left and a required check red, and a further pull request from the same head branch is open
- **THEN** on branch `foo` the open pull request is the change's pull request and the merged one is not read as a forced merge

### Requirement: A task done after the merge is ticked before the archive
A task that can only be done after a merge SHALL be ticked in a further pull request of the change
before its archive; after a merge with every required check green, the retro SHALL come only after
the last task is ticked on the default branch. After an owner's forced merge the retro SHALL come
with the tasks left unticked.

#### Scenario: The last task ticked in a further pull request
- **WHEN** the further pull request that ticks the last task of `foo` merges
- **THEN** `deliver-check.mjs foo` answers the retro

#### Scenario: A forced merge with a task left
- **WHEN** pull request #12 of `foo` merged with task 9.6 unticked on the default branch and `devkit-reviews` `FAILURE` on its head
- **THEN** `deliver-check.mjs foo` answers the retro and `tasks.md` on the default branch still has 9.6 unticked

## ADDED Requirements

### Requirement: An owner's forced merge is told by the required checks
A merged own pull request of a change that is not archived and has an unticked task on the default
branch SHALL be the owner's forced merge when a required check of the default branch, or
`devkit-reviews` when it reported, is not `SUCCESS` on the pull request's head, or is absent. A check
is green only when every entry of its name concludes `SUCCESS`.

#### Scenario: devkit-reviews failed alone
- **WHEN** the default branch requires `check` and `devkit-reviews`, and the merged head has `check` `SUCCESS` and `devkit-reviews` `FAILURE`
- **THEN** the merge is forced and `devkit-reviews (FAILURE)` is one of its open items

#### Scenario: check failed alone
- **WHEN** the merged head has `check` `FAILURE` and `devkit-reviews` `SUCCESS`
- **THEN** the merge is forced and `check (FAILURE)` is one of its open items

#### Scenario: A required check is missing
- **WHEN** the default branch requires `check` and the merged head reports no `check` at all
- **THEN** the merge is forced and `check (absent)` is one of its open items

#### Scenario: devkit-reviews is not required
- **WHEN** no rule requires `devkit-reviews`, every required check is `SUCCESS`, and `devkit-reviews` did not report
- **THEN** the merge is not forced; when `devkit-reviews` reported `FAILURE` instead, it is forced

#### Scenario: A skipped required check
- **WHEN** a required check concludes `SKIPPED` or `NEUTRAL` on the merged head
- **THEN** it is not green and the merge is forced

#### Scenario: A status-context entry
- **WHEN** the merged head reports the required check `check` as a status context (`context` `check`, `state` `FAILURE`) instead of a check run
- **THEN** it is read like a check run of that name and the merge is forced with `check (FAILURE)` as one of its open items

#### Scenario: Two entries of one name, one failing
- **WHEN** the merged head has two entries named `check`, one `SUCCESS` and one `FAILURE`, and every other required check is `SUCCESS`
- **THEN** `check` is not green and the merge is forced with `check (FAILURE)` as one of its open items

#### Scenario: The checks cannot be read
- **WHEN** after pull request #12 of `foo` merged with a task left, the required checks of the default branch or the merged head's check list cannot be read, or the answer has no check list
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, with a reason that names pull request #12 and quotes the error, from the default branch and from branch `foo` alike; it answers neither `stop-branch` nor `implement` nor the retro, and no `mergedLeft` is reported

#### Scenario: A tasks read that fails keeps its answer
- **WHEN** the change's `tasks.md` on the default branch cannot be read after its own pull request merged
- **THEN** the pull request item is `blocked` naming the error, as before this change, and no forced merge is read

### Requirement: An owner's forced merge leads to the archive steps
A forced merge SHALL lead the delivery checker to the same steps a delivered change gets after its
merge, the release tag first when one is due, then the retro, the owner's answers, the archive, the
roadmap tick, the approved proposals and the archive pull request. It SHALL never answer
`implement`, `gate`, `fix-review`, `fix-defect`, `fix-checks`, `verify`, `review` or `stop-branch`
for it.

#### Scenario: The retro of a forced merge
- **WHEN** pull request #88 of `foo` merged with task 9.6 unticked, `devkit-reviews` `FAILURE`, and no `retro.md`
- **THEN** `deliver-check.mjs foo --json` answers `next.step` `retro`, `next.number` 88, `next.forced.count` the number of open items, and a reason that starts `PR #88 merged by the owner with ` and names that count

#### Scenario: Its contract items
- **WHEN** the same forced merge is reported
- **THEN** the tasks item and the checks item are `open`, naming the open tasks, gates and checks, the other items read as checked before the merge, and the exit code is 1

#### Scenario: A release the forced merge bumped
- **WHEN** the forced merge bumped the release file and `origin` has no tag for that version
- **THEN** the next step is `tag-release`, before the retro

#### Scenario: After the owner's answers
- **WHEN** every retro proposal of the forced merge has the owner's answer and the change is still active
- **THEN** the next step is `archive`, and once the folder is archived on `chore/archive-foo`, `tick-roadmap` when the roadmap lists it unticked, then `open-archive-pr`

#### Scenario: The forced retro from the change's own branch
- **WHEN** the checkout is on branch `foo`, pull request #88 of `foo` merged as a forced merge, and no open pull request shares its head
- **THEN** the next step is `retro` for #88, never `implement` or `open-pr`

#### Scenario: The forced retro from another change's branch
- **WHEN** the checkout is on the branch of another change and `deliver-check.mjs foo` runs after the forced merge of #88
- **THEN** the next step is `retro` for #88, never `stop-branch`

#### Scenario: A retro proposal not answered
- **WHEN** the retro of the forced merge holds a proposal without the owner's answer
- **THEN** the next step is `stop-retro-answers`

#### Scenario: Nothing is written
- **WHEN** `deliver-check.mjs foo` runs on a forced merge
- **THEN** `tasks.md`, `readiness.md`, `approval.md`, `evidence.md` and every file under `reviews/` of the change are byte-identical afterwards

#### Scenario: Two pull requests, the base one forced
- **WHEN** in a `two-prs` project the pull request to the base branch (the default branch) merged with task 1.2 unticked and `devkit-reviews` `FAILURE`, and the pull request to the test branch merged too
- **THEN** `deliver-check.mjs foo` answers the retro with `forced` set for the base pull request, and the pull request to the test branch is never read as a forced merge

### Requirement: The open items of a forced merge are named
The open items of a forced merge SHALL be each unticked task of the change's `tasks.md` on the
default branch, each required check that is not green, and each gate file (`evidence.md`, each
required reviewer's `reviews/<reviewer>.md`, and any other reviewer file present) that does not hold
a passing verdict current at the merged head. The reason SHALL say `<N> items open`; N is at least
2, one task and one check.

#### Scenario: Evidence that is missing or not passed
- **WHEN** the merged head has no `evidence.md`, or one whose stage header result is not `passed`
- **THEN** `evidence.md` is an open item, naming why

#### Scenario: Evidence recorded before a product change
- **WHEN** the `Commit:` of `evidence.md` at the merged head is an ancestor of it and a file outside `openspec/` changed between the two
- **THEN** `evidence.md` is an open item naming that file; when only files under `openspec/` changed, it is not

#### Scenario: A review that did not pass
- **WHEN** `reviews/code-quality-reviewer.md` is missing at the merged head, or its `Verdict:` is `REJECTED`, or its approved verdict was recorded before a product change
- **THEN** that file is an open item, naming why

#### Scenario: A verdict recorded on another line of history
- **WHEN** the `Commit:` of `evidence.md` or of a review file at the merged head is not an ancestor of the merged head
- **THEN** that file is an open item naming its commit as not an ancestor of the merged head

#### Scenario: A verdict recorded too far behind to read
- **WHEN** the compare of the `Commit:` of `evidence.md` or of a review file with the merged head lists 300 files or more
- **THEN** that file is an open item naming its commit as too far behind the merged head to read

#### Scenario: The gate files cannot be read
- **WHEN** reading a gate file or the `reviews/` folder at the merged head fails for a reason other than not found, or answers a folder where a file is expected or a file where the folder is expected
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike

#### Scenario: The count
- **WHEN** a forced merge has task 9.6 unticked, `devkit-reviews` `FAILURE`, and `evidence.md` and `reviews/code-quality-reviewer.md` without a passing verdict at its head
- **THEN** the reason says `4 items open` and `next.forced.items` lists those four, tasks first, then checks, then gate files

### Requirement: A merged pull request is found from any checkout
The delivery checker SHALL find the change's merged own pull request with its branch deleted on
GitHub, from the change's own branch, the default branch, an archive branch or any other branch. When
the list of the newest 100 merged pull requests is full and holds none, it SHALL look for it by the
commits of the default branch that changed the change's `tasks.md`, newest first, through the pull
requests each commit belongs to. It reads the newest 10 such commits.

#### Scenario: On the change's own branch, the branch deleted
- **WHEN** the checkout is on branch `foo`, GitHub deleted it, and `gh pr view` finds no pull request while `gh pr list --head foo --state all` holds merged #88
- **THEN** #88 is the change's pull request and a forced merge of it answers the retro

#### Scenario: Older than the newest 100 merged pull requests
- **WHEN** the checkout is on the default branch, the list of the newest 100 merged pull requests is full and none is the change's own, and the newest commit of the default branch that changed `openspec/changes/foo/tasks.md` belongs to merged #12, the change's own
- **THEN** #12 is found and the delivery is judged on it

#### Scenario: A commit of an archive or another base
- **WHEN** the pull requests a commit belongs to are an archive pull request or a pull request to another base
- **THEN** they are skipped, and when no commit gives an own pull request the change has none

#### Scenario: A list that is not full
- **WHEN** fewer than 100 merged pull requests exist and none is the change's own
- **THEN** the change has no merged pull request and no commit of the default branch is read

#### Scenario: The commits cannot be read
- **WHEN** the list of the newest 100 merged pull requests is full and holds none of the change's own, and reading the commits of the default branch or the pull requests of a commit fails
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, with a reason that quotes the error, from the default branch and from another change's branch alike, and never `stop-branch`
