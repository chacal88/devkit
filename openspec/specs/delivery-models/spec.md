# delivery-models Specification

## Purpose
Says which delivery model a project chooses (`two-prs`, `trunk` or `trunk-auto`), how it is read next
to the `ship:` map, and how a change is delivered in the two-pull-request model: both pull requests,
the owner's merges, the support branch, the resolution round, later fixes and the two archives.

## Requirements

### Requirement: The project chooses its delivery model in its configuration
`openspec/config.yaml` SHALL accept `devkit.delivery.model` with the values `two-prs`, `trunk` and
`trunk-auto`. With `two-prs` it SHALL also require `devkit.delivery.base` and
`devkit.delivery.test_branch`, two different branch names. Any other model value, a missing branch
name or the same name twice SHALL be a configuration error that names the setting, and nothing SHALL
run on it.

#### Scenario: The two-pull-request model is read
- **WHEN** the block holds `model: two-prs`, `base: master` and `test_branch: develop`
- **THEN** the delivery the change coordinator drives is the two-pull-request model from `master` with the test branch `develop`

#### Scenario: Trunk-based models are read
- **WHEN** the block holds `model: trunk` (or `model: trunk-auto`) and no `ship:` map
- **THEN** a change is delivered as in today's `pr` mode (or today's `merge` mode)

#### Scenario: An unknown model
- **WHEN** the block holds `model: gitflow`
- **THEN** the command refuses to run, naming `delivery.model`, the value and the three accepted values

#### Scenario: Two pull requests without a test branch
- **WHEN** the block holds `model: two-prs` and `base: main` and no `test_branch`
- **THEN** the command refuses to run, naming `delivery.test_branch` as missing

#### Scenario: The same branch twice
- **WHEN** the block holds `model: two-prs`, `base: main` and `test_branch: main`
- **THEN** the command refuses to run, saying the test branch must differ from the base branch

### Requirement: Without the new model the ship map decides as before
A project whose configuration names no `devkit.delivery.model` SHALL be delivered exactly as before
this change: `ship: <schema>: plan`, `pr` and `merge` keep their meaning, and branch names under
`devkit.delivery` are ignored.

#### Scenario: A project in merge mode
- **WHEN** the configuration has `ship: { devkit-lite: merge }` and no `devkit.delivery`
- **THEN** the delivery checker's steps, its JSON and its exit codes are the ones it gave before this change

#### Scenario: Branch names without a model
- **WHEN** the configuration has `ship: { devkit-lite: pr }` and `devkit.delivery.base: main` with no model
- **THEN** the change is delivered as in `pr` mode and the branch name is not read

### Requirement: A ship entry that disagrees with the model is a configuration error
When `devkit.delivery.model` is set, every entry of the `ship:` map SHALL agree with it (`pr` with
`trunk`, `merge` with `trunk-auto`; `plan` and `two-prs` agree with no entry). An entry that disagrees
SHALL be a configuration error naming the schema, its mode and the model.

#### Scenario: An entry that agrees
- **WHEN** the model is `trunk-auto` and `ship:` maps `devkit` and `devkit-lite` to `merge`
- **THEN** both schemas are delivered as `trunk-auto`

#### Scenario: An entry that disagrees
- **WHEN** the model is `trunk` and `ship:` maps `devkit` to `merge`
- **THEN** the delivery checker exits 3 naming `ship.devkit`, `merge` and `trunk`, and the change coordinator reports the change as unreadable

#### Scenario: Two pull requests next to a ship map
- **WHEN** the model is `two-prs` and `ship:` maps `devkit-lite` to `pr`
- **THEN** the delivery checker exits 3 naming `ship.devkit-lite` and `two-prs`

### Requirement: Both pull requests open together
In `two-prs`, when the change is ready for delivery and has no pull request, the delivery stage SHALL
open two pull requests from the task branch at once, one to the test branch and one to the base
branch, each body naming the change. The delivery state SHALL name both pull requests, found on
GitHub from the branch names.

#### Scenario: The first delivery
- **WHEN** every gate before delivery is met and neither pull request exists
- **THEN** the next step opens both pull requests from the task branch, and afterwards the checker's state names the pull request to `develop` and the pull request to `master`, both bodies naming the change

#### Scenario: One of the two is missing
- **WHEN** the pull request to the base branch exists and none to the test branch exists
- **THEN** the next step opens only the pull request to the test branch, from the task branch or from the support branch when one exists

### Requirement: The owner merges both pull requests
In `two-prs` devkit SHALL enable auto-merge on neither pull request. While the pull request to the
test branch is open and green, the run SHALL end waiting on the owner and name that pull request;
once it is merged and the pull request to the base branch is green, the run SHALL end waiting on the
owner and name the pull request to the base branch.

#### Scenario: The test branch first
- **WHEN** both pull requests are open, every check of the pull request to the test branch is green and it is not merged
- **THEN** the run ends waiting for the owner, the reply names that pull request's number and the test branch, and no auto-merge is enabled on either pull request

#### Scenario: Then the base branch
- **WHEN** the pull request to the test branch is merged and the pull request to the base branch is green
- **THEN** the run ends waiting for the owner, naming the pull request to the base branch

### Requirement: The two-pull-request delivery stops where it cannot go on by itself
In `two-prs`, the delivery SHALL stop blocked, naming the cause, and SHALL open, move, close, push or
merge nothing, when the repository's default branch is not the configured base branch, when the task
branch holds a commit of the test branch that the base branch lacks, or when the pull request to the
test branch was closed without merging and no other pull request to the test branch from the task
branch or its support branch is open or merged.

#### Scenario: The base branch is not the default branch
- **WHEN** the configuration says `base: master` and the repository's default branch on GitHub is `main`
- **THEN** the run stops blocked naming `master` and `main`, before any step on a pull request

#### Scenario: The task branch holds a test-branch commit
- **WHEN** `feat` holds a commit that is on `develop` and not on `master`
- **THEN** the run stops blocked naming that commit and saying the task branch never receives `develop`, and no pull request is opened and nothing is pushed

#### Scenario: The test-branch pull request was closed
- **WHEN** the pull request #12 to `develop` from `feat` was closed without merging and no other pull request to `develop` from `feat` or `feat-develop` is open or merged
- **THEN** the run stops blocked naming #12 as closed without merging, and no new pull request to `develop` is opened

### Requirement: The base pull request's check runs again after the test-branch merge
In `two-prs`, once the pull request to the test branch is merged, a `devkit-reviews` run of the pull
request to the base branch that failed before that merge SHALL be run again; a run that started
after the merge and failed SHALL stop the run as a failing check does today.

#### Scenario: A failure from before the merge
- **WHEN** the pull request to the test branch merged after the last `devkit-reviews` run of the pull request to the base branch started, and that run failed
- **THEN** the next step re-runs that check

#### Scenario: A failure from after the merge
- **WHEN** that run started after the merge and failed while the change's own items are met locally
- **THEN** the run stops blocked, naming the failing check, as it does today

### Requirement: A conflict with the test branch goes to the support branch
When the pull request to the test branch has a merge conflict, devkit SHALL create the branch
`<task-branch>-<test_branch>` from the task branch, merge the test branch into it, resolve the
conflict there and move the pull request to the test branch onto it, closing the first one with a
comment naming the new one. The task branch and the pull request to the base branch SHALL stay as
they were.

#### Scenario: A conflict appears
- **WHEN** GitHub reports the pull request to `develop` from `feat` in conflict
- **THEN** `feat-develop` is created from `feat` and receives `develop`, the conflict is resolved on it, a pull request to `develop` from `feat-develop` replaces the first one, which is closed naming it, and the head of `feat` and of the pull request to the base branch is the same commit as before

#### Scenario: The test branch moves on again
- **WHEN** the pull request from the support branch is in conflict again
- **THEN** the test branch is merged into the support branch again and the same resolution round runs on the new resolution

### Requirement: The resolution is reviewed before the pull request goes on
Before the support branch is pushed with a new conflict resolution, the review bench SHALL run a round
on that resolution only, each reviewer recording its verdict under the change's `reviews/resolution/`.
While a required verdict is missing, rejected, for an older resolution or carries an undisposed
blocking finding, the support branch SHALL not be pushed and the pull request SHALL not move.

#### Scenario: An approved resolution
- **WHEN** the support branch holds a merge whose resolution differs from Git's automatic merge, and both required reviewers approved it at that merge commit
- **THEN** the next step pushes the support branch and the pull request to the test branch goes on from it

#### Scenario: A blocking finding
- **WHEN** a resolution verdict lists a `[blocking]` finding with no disposition
- **THEN** the next step is the resolution's review or fix, the support branch is not pushed and the pull request does not move

#### Scenario: A clean merge needs no round
- **WHEN** the merge of the test branch into the support branch needed no resolution
- **THEN** no resolution round is asked for and the support branch is pushed

### Requirement: A resolution review deadlock goes to the owner
A conflict resolution still rejected after the second review round SHALL end the run waiting for the
owner's decision, as a code-review deadlock does, and the support branch SHALL not be pushed.

#### Scenario: Still rejected after the second round
- **WHEN** a required reviewer still rejects the resolution after the second round
- **THEN** the run ends waiting for the owner's decision on the review dispute, the support branch is not pushed and the pull request does not move

### Requirement: A later commit of the task branch reaches both pull requests
In `two-prs`, a commit added to the task branch after the pull requests opened SHALL reach the pull
request to the test branch: directly when it comes from the task branch, and by a merge of the task
branch into the support branch, then a push, when it comes from the support branch.

#### Scenario: No support branch
- **WHEN** a review fix is committed on `feat` and pushed while both pull requests come from `feat`
- **THEN** the head of both pull requests is that commit

#### Scenario: With a support branch
- **WHEN** a review fix is committed on `feat` while the pull request to `develop` comes from `feat-develop`
- **THEN** the next steps merge `feat` into `feat-develop` and push it, after which the fix is in the history of both pull requests' heads

### Requirement: The archive goes to both branches
In `two-prs`, once both pull requests are merged, the change SHALL be archived through two archive
pull requests: one to the base branch from `chore/archive-<id>`, and one to the test branch from
`chore/archive-<id>-<test_branch>`, cut from the test branch and carrying the same archive commits.
The owner SHALL merge both; the change SHALL be archived only when both branches hold its archive.

#### Scenario: Both archive pull requests open
- **WHEN** the archive pull request to the base branch is open and none to the test branch exists
- **THEN** the next step opens the archive pull request to the test branch from a branch cut from the test branch, with no auto-merge

#### Scenario: Waiting for the owner's archive merges
- **WHEN** both archive pull requests are open and green
- **THEN** the run ends waiting for the owner, naming both archive pull requests

#### Scenario: Only one is merged
- **WHEN** the base branch holds the archived folder and the archive pull request to the test branch is still open
- **THEN** the change is not archived yet and the run ends naming the archive pull request to the test branch

### Requirement: The archive to the test branch stops where it cannot go on by itself
In `two-prs`, when the archive pull request to the test branch was closed without merging or has a
failing check, or when the archive commits conflict on the test branch, the archive SHALL stop
blocked, naming the pull request, its failing checks or the conflicting paths, and SHALL open, reopen,
close or push nothing. Once the owner finishes the conflicting archive, the flow SHALL go on from it.

#### Scenario: The archive pull request to the test branch was closed
- **WHEN** the archive pull request #20 to `develop` was closed without merging and none to `develop` is open or merged
- **THEN** the archive stops blocked naming #20 as closed without merging, and no archive pull request to `develop` is opened or reopened

#### Scenario: The archive pull request to the test branch fails a check
- **WHEN** the archive pull request #20 to `develop` is open and one of its checks fails
- **THEN** the archive stops blocked naming #20 and the failing check

#### Scenario: The archive commits conflict on the test branch
- **WHEN** the archive commits of `feat` do not apply on `develop`
- **THEN** no archive pull request to `develop` is opened, the conflict stays in the archive branch's worktree, and the archive stops blocked naming the conflicting paths and that worktree

#### Scenario: The owner finished the conflicting archive
- **WHEN** the owner completed the conflicting cherry-pick in that worktree and no archive pull request to `develop` exists
- **THEN** the next step pushes that branch as it is and opens the archive pull request to `develop` from it
