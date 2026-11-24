<!-- devkit-stage specs result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Spec Delta

## ADDED Requirements

### Requirement: A plan revised after the work started goes back to its gates
The owner's approval SHALL record a digest of the plan files (`proposal.md`, `design.md`, `tasks.md`
with every checkbox read as empty, and every file under `specs/`). Once a task is ticked, a digest
that differs from the recorded one SHALL make the plan readiness stale until it runs again, and then
the approval, so the owner approves the revised plan. An approval that records no digest SHALL be read
as before.

#### Scenario: A design edited after the first tick
- **WHEN** a task is ticked, `approval.md` records the plan's digest and the readiness it approved, and `design.md` is edited
- **THEN** the plan readiness is reported stale because the plan changed after the approval, and it is the next stage

#### Scenario: The readiness ran again
- **WHEN** after that edit the readiness review wrote `readiness.md` again with `- Status: APPROVED`
- **THEN** the next action waits for the owner's approval again, carrying the new readiness hash and the new plan digest

#### Scenario: A tick is no plan edit
- **WHEN** a task is ticked after the approval and no plan file changed otherwise
- **THEN** the plan readiness and the approval stay passed and the implementation goes on

#### Scenario: Evidence and reviews are no plan edit
- **WHEN** `evidence.md`, `review.md` or a file under `reviews/` is written after the approval
- **THEN** the plan readiness and the approval stay passed

#### Scenario: A new task is a plan edit
- **WHEN** a task line is added to `tasks.md` after the first tick
- **THEN** the plan readiness is reported stale

#### Scenario: An approval with no digest
- **WHEN** a task is ticked and `approval.md` records no plan digest
- **THEN** no plan file makes the readiness or the approval stale, as before

#### Scenario: The approval the CompozyOS driver records
- **WHEN** the owner's approval is recorded by the CompozyOS driver's record step
- **THEN** `approval.md` carries the plan's digest in its `- Plan:` line, as the approval the session writes does, and a plan file edited after a task is ticked sends that run back to its gates the same way

#### Scenario: The short script
- **WHEN** a `devkit-lite` change edits a plan file after a task is ticked
- **THEN** nothing is reported stale and no approval is asked, as before

## MODIFIED Requirements

### Requirement: Attempt ceilings and no progress stop the run
A failed stage whose header attempt reaches its ceiling SHALL end the run as blocked with that
reason. A stage's ceiling SHALL be the one the flow version the change follows declares, except the
code review stage (`review`, role `review-bench`), whose ceiling SHALL be that declared ceiling plus
the number of code-review rounds the session recorded as authorized by the owner in the change's
record of declared steps. A round authorized for a conflict resolution's review, a record that cannot
be read, and any other stage or review stage SHALL NOT change a ceiling. Given the previous run's
progress key, the checker SHALL end the run as blocked when the same stage comes back and nothing in
the working tree or history changed.

#### Scenario: The ceiling is reached
- **WHEN** the review's header says `result=failed attempt=2` and its ceiling is 2
- **THEN** the run ends blocked, naming the review and its ceiling

#### Scenario: The same stage comes back with nothing changed
- **WHEN** the checker is run with `--after` set to the progress key it printed last and nothing changed
- **THEN** the run ends blocked, naming the stage that came back

#### Scenario: One round authorized for the code review
- **WHEN** the review's header says `result=failed attempt=2`, its declared ceiling is 2, and one code-review round is recorded as authorized
- **THEN** the run does not end; the checker offers the review's fix stage with the ceiling 3, or the review again once a commit made its header stale

#### Scenario: The authorized round failed too
- **WHEN** the review's header says `result=failed attempt=3`, its declared ceiling is 2, and one code-review round is recorded as authorized
- **THEN** the run ends blocked, naming the review and its ceiling 3

#### Scenario: Two rounds authorized
- **WHEN** two code-review rounds are recorded as authorized and the review's header says `result=failed attempt=3`
- **THEN** the run does not end; at `result=failed attempt=4` it ends blocked with the ceiling 4

#### Scenario: A round authorized for the resolution's review only
- **WHEN** only a round for a conflict resolution's review is recorded and the review's header says `result=failed attempt=2` with a declared ceiling of 2
- **THEN** the run ends blocked, naming the review and its ceiling 2

#### Scenario: Other stages keep their ceiling
- **WHEN** one code-review round is recorded as authorized and the plan readiness or the evidence says `result=failed attempt=3` with a declared ceiling of 3
- **THEN** the run ends blocked at that stage's ceiling 3

#### Scenario: A review stage of another role
- **WHEN** a script's `review` stage has a role other than `review-bench` (the ADR review of a project), its header says `result=failed attempt=2`, its ceiling is 2, and a code-review round is recorded as authorized
- **THEN** the run ends blocked at the ceiling 2

#### Scenario: The flow version's own ceiling is the base
- **WHEN** a change follows a flow version whose code review ceiling is 1, one code-review round is recorded as authorized, and the review's header says `result=failed attempt=1`
- **THEN** the run does not end, and at `result=failed attempt=2` it ends blocked with the ceiling 2

### Requirement: After a merge the walk resumes at the retro
Off the change's own branch (a default branch, the archive branch or no branch), or on its own
branch when that branch's head is contained in `origin/<base>` (the branch was advanced into the
base after the merge), in the `pr` and `merge` modes, a merged pull request of a delivered change
(its own pull request, every task ticked on the default branch) SHALL switch the checker to the
walk after the merge, which reports
every stage before the delivery from its header alone, with no staleness check and no task count,
passes the delivery and offers the retro. A merged pull request of a change that is not delivered
SHALL NOT switch it.

#### Scenario: Resuming at the retro after a squash merge
- **WHEN** the checkout is on the default branch, the change's own pull request was squash-merged with every task ticked, and the header commits of the demonstration and the review are no longer in the history
- **THEN** the implementation, the demonstration, the review and the delivery are reported passed, no stage is reported stale, and the next stage is the retro

#### Scenario: A pull request that only links the evidence
- **WHEN** the checkout is on the default branch and the only merged pull request naming the change links its evidence without changing a file of the change's folder
- **THEN** the checker does not switch to the walk after the merge and offers no retro

#### Scenario: The own branch advanced into the base after a delivery
- **WHEN** the change was delivered by its merged pull request, its own branch was fast-forwarded to `origin/main`, and `origin/main` holds a commit touching `src/a.ts` after the reviewed head
- **THEN** no stage is reported stale, no review or evidence is asked again, and the next stage is the retro

#### Scenario: The own branch still ahead of the base
- **WHEN** the change was delivered and its own branch holds a commit touching `src/a.ts` that the base does not hold, after the reviewed head
- **THEN** the checker does not switch to the walk after the merge, and the stages that commit makes stale are reported stale, as before

#### Scenario: Advanced but not delivered
- **WHEN** the change's own branch was advanced into the base and a task is still unticked on the default branch
- **THEN** the checker does not switch to the walk after the merge
