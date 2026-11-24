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

## MODIFIED Requirements

### Requirement: A change's own pull request
A merged pull request SHALL be the change's own only when it changes a file under the change's
active folder `openspec/changes/<id>/`, brings no file under the change's own archive folder
`openspec/changes/archive/<YYYY-MM-DD>-<id>/` (the exact id), and its head branch is not an archive
branch (`chore/archive-<name>` or `archive-<name>`) other than the change's own id. A head equal to the
change's id SHALL be the change's own branch whatever its prefix, so a change whose id starts with
`archive-` keeps its own pull request. A pull request that only names the change, or links its
evidence, SHALL NOT be its own.

#### Scenario: A body that links the evidence
- **WHEN** a merged pull request's body links `openspec/changes/foo/evidence.md` and its diff touches nothing under `openspec/changes/foo/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: Another change's archive pull request
- **WHEN** the archive pull request of `bar` (head `chore/archive-bar`) names `foo` in its body and moves `openspec/changes/bar/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: An unrelated head ending in the id
- **WHEN** a merged pull request from `fix/foo` touches no file under `openspec/changes/foo/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: A head that does not name the change
- **WHEN** a merged pull request from `calm-badger` changes `openspec/changes/foo/tasks.md`
- **THEN** it is the change pull request of `foo`

#### Scenario: Another change's archived files
- **WHEN** a merged pull request from `ship/foo` changes `openspec/changes/foo/tasks.md` and `openspec/changes/archive/2026-11-09-bar/retro.md`
- **THEN** it is the change pull request of `foo`, and from the default branch in the `merge` ship mode the delivery checker finds it among the merged pull requests

#### Scenario: The change's own archive folder
- **WHEN** a merged pull request from `ship/foo` changes `openspec/changes/foo/tasks.md` and `openspec/changes/archive/2026-11-09-foo/retro.md`
- **THEN** it is not the change pull request of `foo`

#### Scenario: An id that starts another change's id
- **WHEN** a merged pull request changes a file of the change folder and a file under `openspec/changes/archive/2026-11-09-foo-two/` (or, for `foo-two`, under `openspec/changes/archive/2026-11-09-foo/`)
- **THEN** that archive folder does not keep it from being the change pull request of `foo` (or of `foo-two`)

#### Scenario: An id that starts with archive-
- **WHEN** a merged pull request from head `archive-x` changes `openspec/changes/archive-x/tasks.md`
- **THEN** it is the change pull request of `archive-x`, found on the branch `archive-x` and, from the default branch, among the merged pull requests

#### Scenario: The archive branch of an archive- id
- **WHEN** a merged pull request from head `chore/archive-archive-x` (or `archive-archive-x`) changes `openspec/changes/archive-x/tasks.md`
- **THEN** it is not the change pull request of `archive-x`

#### Scenario: The archive branch of an ordinary id
- **WHEN** a merged pull request from head `chore/archive-x` changes `openspec/changes/x/tasks.md`
- **THEN** it is not the change pull request of `x`

#### Scenario: Another change's archive- head
- **WHEN** a merged pull request from head `archive-y` changes `openspec/changes/archive-x/tasks.md` (or `openspec/changes/x/tasks.md`)
- **THEN** it is not the change pull request of `archive-x` (or of `x`)
