<!-- devkit-stage specs result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Unfinished work is asked about before a new request
When a new request is typed while another change is unfinished, the command SHALL name each
unfinished change and where it stopped and ask whether to continue it or start the new request,
before anything is created or run.

#### Scenario: A new request while a change is unfinished
- **WHEN** `/devkit change <text>` is typed and another change, not archived on the default branch, has an active folder or an archive branch in the main checkout or a worktree
- **THEN** the reply names that change and where it stopped and asks continue or new, and no folder, branch or worktree is created

## ADDED Requirements

### Requirement: A change archived on the default branch is not unfinished
The command SHALL NOT list as unfinished a change whose archived folder
(`openspec/changes/archive/<date>-<id>/`) is on the default branch, read from the default branch on
GitHub, else from the remote-tracking default branch, else from the main checkout, whatever old
checkout still holds its active folder, sits on its branch or sits on its archive branch. It SHALL
still list a change on its archive branch whose archive is not on the default branch yet.

#### Scenario: An old worktree holds the active folder
- **WHEN** `foo` is archived on the default branch and a worktree on another branch still holds `openspec/changes/foo/`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An old worktree on the change's branch
- **WHEN** `bar` is archived on the default branch and a worktree on branch `bar` still holds `openspec/changes/bar/`
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
