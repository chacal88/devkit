<!-- devkit-stage specs result=passed attempt=1 commit=8c8b7b89ca898242699b60e964e74a183e98258f -->
# Spec Delta

## MODIFIED Requirements

### Requirement: From the implementation on, the step inside the stage goes to its role
From the implementation to the archive, the loop SHALL take the stage from the stage checker and the
step inside it from the delivery checker, with the override the retired `/conduct` applied and `/devkit change` keeps (a release-file
conflict), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win.

#### Scenario: Implementation and fixes
- **WHEN** the delivery checker's step is `implement`, `fix-review`, `fix-defect`, `fix-checks` or `apply-proposals`
- **THEN** the next action hands it to the implementer's agent

#### Scenario: The agent of a delivery step comes from the checker's row
- **WHEN** the row the delivery checker returns for a step the loop hands to an agent names that step's agent
- **THEN** the next action's agent is the one the row names

#### Scenario: Commits and pull requests
- **WHEN** the step is `commit`, `open-pr`, `push` or `open-archive-pr`
- **THEN** the next action hands it to the commit-and-pr agent

#### Scenario: A conflict only in release files
- **WHEN** the change's or the archive's pull request conflicts with its base only in release files (versions, changelog, catalog, the CI pin)
- **THEN** the next action hands `resolve-release-conflict` to the implementer's agent with the release merge command and the conflicting paths

#### Scenario: A release merge that is not pushed yet
- **WHEN** GitHub still reports the pull request in conflict, the local head already holds the base and the pull request's head is an ancestor of the local head and differs from it
- **THEN** the next action hands `push` (for the change's pull request) or `open-archive-pr` (for the archive's) to the commit-and-pr agent with the command `git push origin <branch>`, which holds neither `--force` nor `--force-with-lease`

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the pull request's head is no longer an ancestor of the local head because the branch was rewritten by a rebase, as an earlier version's release step did
- **THEN** the loop hands no push for it: the run ends blocked, saying the pull request's head is not in the local history, for the owner to push by hand

#### Scenario: No step pushes by force
- **WHEN** the loop's rows and every step the delivery checker and the override can return are listed
- **THEN** none of them is `push-rebased` and no command they carry holds `--force` or `--force-with-lease`

#### Scenario: A conflict in any other file
- **WHEN** the pull request conflicts with its base in a file that is not a release file
- **THEN** the run ends blocked, saying the pull request has a problem the session cannot fix alone

#### Scenario: GitHub reports a conflict the base merges cleanly
- **WHEN** GitHub reports a conflict, the base merges cleanly with the local head, the local head is the pull request's head, and the project merges automatically
- **THEN** the next action is the session step `update-branch`

#### Scenario: The demonstration
- **WHEN** the step is `verify`
- **THEN** the next action hands it to the verifier's agent

#### Scenario: The code review
- **WHEN** the step is `review`
- **THEN** the next action is a session step that runs the review skill and sets the review file's stage header

#### Scenario: A phase gate
- **WHEN** the step is `gate`
- **THEN** the next action is a session step carrying the gate's command and task; a green run ticks the task and a red run ends the run blocked, saying the phase's tests failed

#### Scenario: A pull-request or archive step of the session
- **WHEN** the step is `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `answer`, `retro`, `archive` or `tick-roadmap`
- **THEN** the next action is a session step naming it, done as the shipping skill's row for that step says

#### Scenario: A question on the pull request only the owner can answer
- **WHEN** the session's answer step finds a decision only the owner can take
- **THEN** the run ends waiting for the owner, with a reply naming the comment's link

#### Scenario: A step this version does not know
- **WHEN** the delivery checker returns a step the loop has no row for
- **THEN** the run ends blocked, saying the next step is unknown

#### Scenario: The loop's rows match what the checkers return
- **WHEN** the loop's rows are compared with every step the delivery checker and the override can return
- **THEN** every returnable step has a row and no row names a step that no checker returns

#### Scenario: The loop and the checker name the same agent for each step
- **WHEN** the loop's own step-to-agent rows are compared with the delivery checker's step-to-agent mapping for every step both name as a hand-off to an agent
- **THEN** both name the same agent, and the one step the checker gives to an agent that the loop runs in the session, the retro, is the only one left out

#### Scenario: The delivery checker cannot read the change
- **WHEN** the delivery checker fails with a usage or settings error
- **THEN** the run ends blocked, saying the change cannot be read, and the command exits 3

## ADDED Requirements

### Requirement: A release-only conflict is resolved by a merge of the base
The release-conflict step's command SHALL merge `origin/<base>` into the branch, never rebase it,
resolve the release files by the renumbering rule and commit the merge, so that the branch's old
head and its pull request's head stay ancestors of the new head. It SHALL never push. A merge it
cannot resolve SHALL be aborted, leaving the branch at its old head, no merge in progress and the
working tree as it was.

#### Scenario: A base that released after the branch forked
- **WHEN** the base bumped a pack and added a changelog entry after the branch forked, and the branch bumped the same pack with its own entry
- **THEN** the command exits 0, the new head is a merge commit whose first parent is the old head and whose second parent is `origin/<base>`, and the working tree has nothing uncommitted

#### Scenario: The release is renumbered above the base's
- **WHEN** the merge is resolved
- **THEN** each pack the branch bumped carries the base's version plus the branch's own bump kind in its manifest and in the marketplace, the branch's changelog entry sits above the base's newest with that number, every CI pin names the resolved devkit-openspec version, and the catalog is regenerated when a manifest changed

#### Scenario: The result goes up with a plain push
- **WHEN** the pull request's head was pushed before the command ran
- **THEN** a plain `git push` of the new head to the same remote is accepted, with no force

#### Scenario: A conflict outside the release files
- **WHEN** the merge conflicts in a file that is not a release file, or in the CI-pin file beyond its pins
- **THEN** the command exits 2 naming the paths, the branch is at its old head, no merge is in progress, and the tracked and untracked files are as they were

#### Scenario: A release file the rule cannot resolve
- **WHEN** a manifest was edited beyond its version, the changelog does not hold exactly one new entry, the catalog conflicts without its generator, the generator fails, or the base has no devkit-openspec version for a conflicting pin
- **THEN** the command exits 2 with the reason, the branch is at its old head and no merge is in progress

#### Scenario: Uncommitted tracked changes or a rebase in progress
- **WHEN** the command starts with a tracked file changed and not committed, or with a rebase in progress
- **THEN** it exits 3 naming the cause, and the branch, the index and the working tree are not touched

#### Scenario: A merge left in progress by an earlier run
- **WHEN** the command starts while a merge is in progress
- **THEN** it aborts that merge and runs again from the branch's head

#### Scenario: The branch already holds the base
- **WHEN** `origin/<base>` is already an ancestor of the branch's head
- **THEN** the command exits 0, says there is nothing to do and makes no commit
