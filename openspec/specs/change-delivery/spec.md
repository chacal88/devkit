# change-delivery Specification

## Purpose
Says when a change counts as delivered after a pull request merges, which merged pull request is
the change's own, and what the delivery checker answers while a task of the change is left.

## Requirements

### Requirement: A change's own pull request
A merged pull request SHALL be the change's own only when it changes a file under the change's
active folder `openspec/changes/<id>/`, brings no folder under `openspec/changes/archive/`, and its
head branch is not an archive branch (`chore/archive-<name>` or `archive-<name>`). A pull request
that only names the change, or links its evidence, SHALL NOT be its own.

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

### Requirement: Delivered means its own pull request merged and every task ticked
A change SHALL be delivered when it is archived, or when its own pull request is merged and every
task of its `tasks.md` on the default branch is ticked. Only a delivered change SHALL lead the
delivery checker to the archive steps.

#### Scenario: Every task ticked on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked
- **THEN** `deliver-check.mjs <id>` answers the retro, as before this change

#### Scenario: A partial pull request merged
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has unticked tasks
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Only a pull request that names it
- **WHEN** no own pull request of the change is merged and a merged pull request links its evidence
- **THEN** `deliver-check.mjs <id>` answers no archive step

### Requirement: The work left after a merge is named
While a task of a change is unticked after its own pull request merged, the delivery checker
SHALL name the unticked tasks as the work left. On the change's own branch it SHALL lead through
the same delivery contract to a further pull request; on any other checkout it SHALL name the
branch to continue on.

#### Scenario: From the default branch
- **WHEN** `deliver-check.mjs foo` runs on the default branch after pull request #12 of `foo` merged with tasks 3.1 and 3.2 unticked
- **THEN** its next step names pull request #12, the tasks 3.1 and 3.2 and the branch `foo` to continue on

#### Scenario: On the change's own branch
- **WHEN** the work left is done and ticked on branch `foo` and no open pull request exists for it
- **THEN** the next step is to open a further pull request, never the retro

### Requirement: A task done after the merge is ticked before the archive
A task that can only be done after a merge SHALL be ticked in a further pull request of the change
before its archive; the retro SHALL come only after the last task is ticked on the default branch.

#### Scenario: The last task ticked in a further pull request
- **WHEN** the further pull request that ticks the last task of `foo` merges
- **THEN** `deliver-check.mjs foo` answers the retro
