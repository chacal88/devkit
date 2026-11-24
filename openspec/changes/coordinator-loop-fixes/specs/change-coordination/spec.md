<!-- devkit-stage specs result=passed attempt=4 commit=fd29ac6c22ab2b8c385200a8f357d6d7796fd281 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: From the implementation on, the step inside the stage goes to its role
From the implementation to the archive, the loop SHALL take the stage from the stage checker and the
step inside it from the delivery checker, with the override the retired `/conduct` applied and `/devkit change` keeps (a conflict with the
base, in the release files or outside them), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win. The unit tests and the E2E tests, which the delivery checker does
not know, SHALL be taken from the stage checker alone.

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
- **WHEN** the change's pull request, or the archive's pull request of an archive that never left a delivery train, conflicts with its base in a file that is not a release file, with or without release files among the conflicting paths
- **THEN** the next action hands `resolve-base-conflict` to the implementer's agent with the base and every conflicting path, and the run does not end blocked for it

#### Scenario: A conflict git cannot classify
- **WHEN** the pull request conflicts and `git merge-tree --write-tree` cannot run (git older than 2.38)
- **THEN** the run ends blocked, saying the conflict cannot be classified, as before

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
- **THEN** the next action is a session step carrying the gate's command and task; a green run ticks the task, and a red run is declared by the session, which hands one fix to the implementer the first time and ends the run blocked, saying the phase's tests failed, the second time

#### Scenario: A task the conducting session does
- **WHEN** the step is `conductor-task`
- **THEN** the next action is a session step naming the phase and the tasks the session does itself, and no hand-off to the implementer carries them

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

#### Scenario: The unit tests are next
- **WHEN** the stage checker's next stage is the unit tests, missing, stale or offered again after a fix
- **THEN** the next action hands the stage to `devkit-core:test-runner`, its detail carrying the declared unit command, coverage command and coverage target, whatever step the delivery checker would give

#### Scenario: The E2E tests are next
- **WHEN** the stage checker's next stage is the E2E tests
- **THEN** the next action hands the stage to `devkit-core:e2e-tester`, its detail carrying the declared E2E command

#### Scenario: A red test stage goes back to the implementer
- **WHEN** the stage checker's next stage is the implementation because the unit tests or the E2E tests failed below their ceiling and nothing changed since
- **THEN** the next action hands the step `fix-tests` to the implementer's agent, its detail naming the failed stage and its file

### Requirement: The session waits on GitHub with no time limit
When a run ends waiting on GitHub, the session SHALL start a background wait that holds no state but
the first decision, has no limit of its own, and ends with the new action as soon as the decision
changes; the reply SHALL say the session is waiting and that calling the command again is safe. When
the host's own instructions give the session a pull-request monitor and tell it not to poll, the
session SHALL start no wait and SHALL end the turn; the turn the host's event or the owner's next
message starts SHALL run the loop again.

#### Scenario: The reply that starts the wait
- **WHEN** a run ends waiting on GitHub
- **THEN** its reply says the session keeps waiting with no time limit and that calling `/devkit change` again is safe

#### Scenario: A host with its own pull-request monitor
- **WHEN** a run ends waiting on GitHub and the host's instructions give the session a pull-request monitor and tell it not to poll the checks
- **THEN** the session starts no background wait, says the reply and that the host's monitor holds the wait, and ends the turn; the turn the host's event starts runs the loop's next action and goes on

#### Scenario: A host with no monitor of its own
- **WHEN** a run ends waiting on GitHub and the host gives the session no pull-request monitor
- **THEN** the session starts the background wait as before

#### Scenario: GitHub has not answered
- **WHEN** the decision is still the same wait on the checks or the merge at every poll
- **THEN** the wait keeps polling, whatever the number of polls

#### Scenario: The checks pass in merge mode
- **WHEN** the checks pass and auto-merge is not on
- **THEN** the wait ends with the action that turns auto-merge on

#### Scenario: The checks pass in pr mode
- **WHEN** the checks pass and the project merges by hand
- **THEN** the wait ends and the run waits for the owner to merge

#### Scenario: A check fails
- **WHEN** a check of the pull request fails
- **THEN** the wait ends with the action that hands the fix to the implementer's agent

#### Scenario: The pull request merges
- **WHEN** the change's pull request merges
- **THEN** the wait ends with the retro as the next action

#### Scenario: The archive pull request merges
- **WHEN** the archive pull request merges
- **THEN** the wait ends and the run ends archived

#### Scenario: The pull request is closed
- **WHEN** the pull request is closed without merging
- **THEN** the wait ends and the run ends blocked, naming the pull request

#### Scenario: A comment asks something
- **WHEN** a new comment or review on the pull request needs an answer
- **THEN** the wait ends with the answer step as the next action

#### Scenario: GitHub cannot be read
- **WHEN** GitHub cannot be read at three polls in a row, each poll failing or giving the wait that says GitHub did not answer
- **THEN** the wait ends and the run ends blocked, quoting the error

#### Scenario: A wait that began with GitHub silent
- **WHEN** the run ended waiting because GitHub did not answer, and at a later poll GitHub answers with the checks still pending
- **THEN** the wait ends with the wait on the checks, and the session starts a new wait for it

### Requirement: A change archived on the default branch is not unfinished
The command SHALL NOT list as unfinished a change whose archived folder
(`openspec/changes/archive/<date>-<id>/`) is on the default branch, read as the union of every source
that can be read (GitHub's default branch, the remote-tracking default branch, the local default
branch and the main checkout's working tree; a source that cannot be read adds nothing), whatever old
checkout still holds its active folder, sits on its branch or its archive branch, except a new change
reusing the id (next requirement). It SHALL still list a change on its archive branch whose archive is
not on the default branch yet.

#### Scenario: An old worktree holds the active folder
- **WHEN** `foo` is archived on the default branch and a worktree on another branch still holds the old copy of `openspec/changes/foo/`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An old worktree on the change's branch
- **WHEN** `bar` is archived on the default branch and a worktree on branch `bar` still holds the old copy of `openspec/changes/bar/`
- **THEN** `change-loop.mjs start` does not list `bar`

#### Scenario: An archive branch whose pull request merged
- **WHEN** `foo` is archived on the default branch and a worktree still sits on `chore/archive-foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An archive pull request not merged yet
- **WHEN** a worktree sits on `chore/archive-baz` and the default branch has no archived folder of `baz`
- **THEN** `change-loop.mjs start` lists `baz` as being archived

#### Scenario: The main checkout's default branch is behind
- **WHEN** the main checkout's local default branch is eight commits behind the remote one, which archived `foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: GitHub cannot be read
- **WHEN** `gh` fails and the remote-tracking default branch holds the archived folder of `foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: Resuming an archived change by its id
- **WHEN** `/devkit change foo` names a change archived on the default branch
- **THEN** the run continues `foo` as before this change, ending archived

### Requirement: A run can carry a token budget
`/devkit change` SHALL read an optional cap, a whole number of tokens, from `budget:` in the settings
block of the change's `.openspec.yaml` (its `x-devkit:` block, or its `devkit:` block when the file has
no `x-devkit:` block), else from `budget:` in the `devkit:` block of `openspec/config.yaml` as the
change's own checkout holds it. With neither, or with an empty value, the run SHALL have no cap, and
every output of the loop SHALL be what it is without the setting.

#### Scenario: The project's cap
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block and the change's `.openspec.yaml` has no `x-devkit:` or `devkit:` block
- **THEN** the cap of the change's run is 2000000 tokens

#### Scenario: The change's cap wins for that change only
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block, change `a`'s `.openspec.yaml` has an `x-devkit:` block with `budget: 500000`, and change `b`'s has none
- **THEN** the cap of `a`'s run is 500000 tokens and the cap of `b`'s run is 2000000 tokens

#### Scenario: No budget anywhere
- **WHEN** neither file has a `budget:` key in its settings block
- **THEN** every output of `change-loop.mjs` is the same as before the setting existed, and no transcript is read for a count

#### Scenario: An empty value
- **WHEN** a settings block holds `budget:` with no value
- **THEN** that file sets no cap, as if the key were absent

#### Scenario: A key outside the devkit block
- **WHEN** the change's `.openspec.yaml` holds a top-level `budget: 100` and no `x-devkit:` or `devkit:` block
- **THEN** that line sets no cap, and the project's value, or no cap, applies

#### Scenario: A quoted value, a comment and an unclosed quote
- **WHEN** a settings block holds `budget: "2000000"  # two million`, or `budget: "2000000` with no closing quote
- **THEN** the cap is 2000000 tokens, as the other settings of the block read a value

#### Scenario: The change's block passes the strict validation
- **WHEN** a change's `.openspec.yaml` holds an `x-devkit:` block with `budget: 2000000` and `openspec validate <id> --type change --strict` is run on the change
- **THEN** the validation reports no unknown key for the file, and the cap of the change's run is 2000000 tokens

#### Scenario: A devkit block written before the x-devkit block
- **WHEN** a change's `.openspec.yaml` holds a `devkit:` block with `budget: 500000` and no `x-devkit:` block
- **THEN** the cap of the change's run is 500000 tokens, as before

#### Scenario: Both blocks in the change's file
- **WHEN** a change's `.openspec.yaml` holds an `x-devkit:` block with `budget: 500000` and a `devkit:` block with `budget: 100`
- **THEN** the cap of the change's run is 500000 tokens, read from the `x-devkit:` block alone

### Requirement: The budget stop says how to go on
The reply of a budget stop SHALL state, in the person's language, the tokens spent, the cap, the
absolute path of the change's `.openspec.yaml` and the key `budget` of its `x-devkit:` block as the
place to raise the cap, and that typing `/devkit change` again goes on.

#### Scenario: In English
- **WHEN** the run of `feat` stops at a cap of 2000000 with 2100000 tokens spent and the person's language is `en`
- **THEN** the reply names `feat`, 2100000, 2000000, the absolute path of `feat`'s `.openspec.yaml`, `budget` in the `x-devkit` block and `/devkit change`

#### Scenario: In Brazilian Portuguese
- **WHEN** the same stop happens and the person's language is `pt-BR`
- **THEN** the reply says the same in Brazilian Portuguese

### Requirement: A merge-defect fix follows the rule of every plan edit
The planner's fix of a merge defect SHALL leave `readiness.md`, `approval.md` and the plan stages in
the state the flow gives any other edit of the plan files once the implementation has started; the
loop SHALL add no exception to the plan gate for it.

#### Scenario: The same answer as an ordinary plan edit
- **WHEN** a change with a ticked task, an approved readiness and a current owner approval has its spec delta edited as a merge-defect fix, and the same change has its design edited instead
- **THEN** the stage checker gives the same states for readiness and approval in both cases: with an approval that records no plan digest neither asks again, and with one both make the readiness stale and ask the owner again

## ADDED Requirements

### Requirement: The session declares a pause or a decision outside the gates
When the owner asks for a pause, or the session meets a decision only the owner can take that no
stage gate holds, the session SHALL declare it through the loop's `reply` with the key
`waiting-pause` or `waiting-owner-decision`. Both end in the state waiting for the owner; no other
end state SHALL be added, and a change's derived state and title SHALL read them as every other wait.

#### Scenario: The owner asks for a pause
- **WHEN** the session runs `change-loop.mjs reply waiting-pause --param id=<id>`
- **THEN** the first output line is `devkit-end: <id> waiting-for-owner`, the reply in the person's language follows, and the exit code is 0

#### Scenario: A decision outside the gates
- **WHEN** the session runs `change-loop.mjs reply waiting-owner-decision --param id=<id> --param decision=<the decision in plain words>`
- **THEN** the first output line is `devkit-end: <id> waiting-for-owner`, the reply holds the decision's words, and the exit code is 0

#### Scenario: A declared wait in a roadmap run
- **WHEN** a roadmap run's session declares `waiting-pause` for a change with `roadmap-loop.mjs reply`
- **THEN** the run file records the change's end as waiting for the owner at the gate of a pause, and the change's state reads waiting for the owner

#### Scenario: A key that records goes through declare
- **WHEN** the session runs `change-loop.mjs reply gate-red` or `change-loop.mjs reply review-round`
- **THEN** the command exits 3 naming `declare`, and nothing is recorded

### Requirement: A red gate gets one declared fix before the run stops
When a phase gate runs red, the session SHALL declare it with `change-loop.mjs declare <id> gate-red
--param phase=<n>`, which records the red gate. At the first red gate of that phase the command SHALL
give a hand-off of the step `fix-gate` to the implementer's agent; at a later red gate of the same
phase it SHALL end the run blocked, saying the phase's tests failed.

#### Scenario: The first red gate of a phase
- **WHEN** the next action is the gate of phase 2, its command exits non-zero, and the record holds no red gate of phase 2
- **THEN** `declare gate-red --param phase=2` prints `devkit-run: <id>` and a hand-off of `fix-gate` to `devkit-core:tdd-implementer` naming the gate's task and command, records the red gate, and prints no `devkit-end:` line

#### Scenario: The second red gate of the phase
- **WHEN** the record holds one red gate of phase 2 and the gate of phase 2 runs red again
- **THEN** `declare gate-red --param phase=2` prints `devkit-end: <id> blocked` and the reply that phase 2's tests failed, and exits 2

#### Scenario: The gate after the fix
- **WHEN** the fix was handed and the loop's next action is asked
- **THEN** it is the gate of that phase again, never `fix-gate`

#### Scenario: A red gate of another phase
- **WHEN** the record holds one red gate of phase 1 and the gate of phase 2 runs red for the first time
- **THEN** the command gives the `fix-gate` hand-off for phase 2

#### Scenario: Declared away from the gate
- **WHEN** the loop's next action is not the gate of the phase named
- **THEN** the command exits 3 and records nothing

### Requirement: The owner authorizes one more review round after the limit
At a review's deadlock, one more round SHALL run only when the owner's own typed message asks for
it and the main session records it with `change-loop.mjs declare <id> review-round --param
words=<the owner's words>`. Each record SHALL name the review in dispute and hand exactly one more
round of it; the loop SHALL leave the deadlock by its own steps, with no header edited by hand. The
code review's deadlock is the blocked end of its stage's ceiling, or `stop-review-deadlock`.

#### Scenario: The owner authorizes a third round
- **WHEN** the run ended blocked at the code review's ceiling after round 2 and the session records the owner's words with `declare review-round`
- **THEN** the command prints `devkit-run: <id>` and exits 0, and the next actions fix the rejected findings and hand the review as round 3 of 3

#### Scenario: No authorization
- **WHEN** the code review failed its round 2 and nothing was recorded
- **THEN** the run ends blocked at the code review's ceiling, as before, and the session says that one more round needs the owner's own word

#### Scenario: The authorized round failed too
- **WHEN** one round was authorized and the code review failed its round 3
- **THEN** the run ends blocked at the code review's ceiling again, and only a new message of the owner authorizes a fourth round

#### Scenario: No words of the owner
- **WHEN** the session runs `declare review-round` without the owner's words
- **THEN** the command exits 3 and records nothing

#### Scenario: Not at the deadlock
- **WHEN** the session runs `declare review-round` while the next action is neither a review's deadlock nor the blocked end of the code review's ceiling (a step, or the ceiling of the plan readiness)
- **THEN** the command exits 3 and records nothing

#### Scenario: Declared twice for one deadlock
- **WHEN** the session runs `declare review-round` a second time before the authorized round ran
- **THEN** the command exits 3 and records nothing, because the next action is no longer a deadlock

#### Scenario: The resolution's deadlock
- **WHEN** the run waits at the deadlock of a conflict resolution's review after round 2 and the session records the owner's words with `declare review-round`
- **THEN** the record names the resolution's review, and the next actions fix the resolution and hand its review as round 3 of 3, while the code review's limit and its stage's ceiling stay 2

### Requirement: A conflict outside the release files goes to the implementer
The step `resolve-base-conflict` SHALL hand the implementer the base and the conflicting paths, to
merge `origin/<base>`, resolve every conflict, run the project's test command and commit the merge,
never pushing or rebasing; the loop SHALL then hand the evidence, the review and a plain push. It
SHALL not replace `stop-archive` or `rejoin-train`, and SHALL not be given in a project with a
delivery train.

#### Scenario: The resolution is pushed plainly
- **WHEN** the implementer committed the merge and the pull request's head is an ancestor of the new head
- **THEN** the next actions are the evidence and the review, and then `push` (or `open-archive-pr` on an archive branch) with `git push origin <branch>`

#### Scenario: The implementer cannot resolve it
- **WHEN** the implementer returns a failure for `resolve-base-conflict` and the session runs `next` with that action's progress key
- **THEN** the loop hands the step once more on the next model up, and after a second failure ends the run blocked, saying the stage could not finish its work, as for any stage agent; the session declares no end of its own

#### Scenario: An archive that left a delivery train
- **WHEN** an archive left a delivery train and its pull request conflicts with the base in a file that is neither a release file, the CI pin nor a roadmap tick
- **THEN** the run ends blocked as `stop-archive`, naming the conflicting paths, as before, and `resolve-base-conflict` is not given

#### Scenario: A change that left a delivery train
- **WHEN** a change left a delivery train and its pull request conflicts with the base
- **THEN** the next action is its own step `rejoin-train`, as before, and `resolve-base-conflict` is not given

#### Scenario: A project with a delivery train
- **WHEN** the project sets `devkit.delivery.train` and a change's pull request conflicts with the base outside the release files
- **THEN** the change goes on toward boarding the train as before, and `resolve-base-conflict` is not given
