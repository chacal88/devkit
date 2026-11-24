<!-- devkit-stage specs result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Spec Delta

## ADDED Requirements

### Requirement: A task marked for the conducting session is not the implementer's
A task of `tasks.md` whose description starts with `Conductor:` SHALL be the conducting session's.
The delivery checker SHALL give the step `conductor-task` when a phase's first open task carries the
marker, SHALL stop an implementer hand-off of that phase before the first open marked task, and SHALL
count a marked task done only when it is ticked.

#### Scenario: The phase's next task is the session's
- **WHEN** the first open task of phase 2 starts with `Conductor:`
- **THEN** the next step is `conductor-task` naming phase 2 and the open marked tasks that lead the phase

#### Scenario: An implementer task before a marked task
- **WHEN** phase 2's open tasks are 2.1, then 2.2 marked `Conductor:`, then 2.3
- **THEN** the next step is `implement` for phase 2 with `stopAt` 2.2

#### Scenario: A phase with no marked task
- **WHEN** no open task of phase 2 carries the marker
- **THEN** the next step is `implement` for phase 2 with no `stopAt`, as before

#### Scenario: A marked task holds the gate
- **WHEN** every task of phase 2 is ticked but one marked `Conductor:`
- **THEN** the next step is `conductor-task`, not the phase's gate, and the delivery contract lists that task as unticked

#### Scenario: The marker only at the start
- **WHEN** a task's description holds `Conductor:` after its first word
- **THEN** the task is an ordinary task

### Requirement: The review round limit is two plus the rounds the owner authorized
The delivery checker SHALL stop at `stop-review-deadlock` when a current review rejects and
`review.md`'s last consensus is a failure at the round limit: 2 plus the code-review rounds the
owner authorized, a round authorized for a conflict resolution's review not counted. Below the
limit, a re-review after a failed round SHALL be the next round, carrying the limit when above 2.

#### Scenario: No authorization
- **WHEN** nothing is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`, and no `review` step carries a `limit`

#### Scenario: One authorization
- **WHEN** one authorized round is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `fix-review`, and once the fix stales the rejected review, `review` with round 3 and limit 3

#### Scenario: The authorized round failed too
- **WHEN** one authorized round is recorded and `review.md` ends at `Consensus: FAIL (round 3/3)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`

#### Scenario: A round authorized for the resolution
- **WHEN** one round authorized for a conflict resolution's review is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`

#### Scenario: A record that cannot be read
- **WHEN** the record of declared steps cannot be read
- **THEN** the limit is 2
