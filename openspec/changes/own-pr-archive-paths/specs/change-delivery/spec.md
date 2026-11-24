<!-- devkit-stage specs result=passed attempt=1 commit=511d3e753d1069c89bb5d35a26de195d254d0301 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A change's own pull request
A merged pull request SHALL be the change's own only when it changes a file under the change's
active folder `openspec/changes/<id>/`, brings no file under the change's own archive folder
`openspec/changes/archive/<YYYY-MM-DD>-<id>/` (the exact id), and its head branch is not an archive
branch (`chore/archive-<name>` or `archive-<name>`). A pull request that only names the change, or
links its evidence, SHALL NOT be its own.

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
