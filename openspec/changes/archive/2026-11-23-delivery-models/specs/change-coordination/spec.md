<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: In the two-pull-request model a change opens from the base branch
In `two-prs`, opening a change SHALL cut its branch from `origin/<base>` after the fetch, and SHALL
refuse, creating nothing, while the test branch does not exist on `origin`, while the base branch is
not the repository's default branch, or when the proposed id ends with `-<test_branch>`.

#### Scenario: The starting point
- **WHEN** a change opens in a project with `base: main` and `test_branch: develop`, both on `origin`
- **THEN** the new branch starts from the fetched `origin/main`

#### Scenario: The test branch is missing
- **WHEN** `origin` has no branch `develop`
- **THEN** nothing is created, the exit code is 3 and the reply says the test branch `develop` must exist on `origin` first

#### Scenario: The base is not the default branch
- **WHEN** the configuration says `base: master` and the repository's default branch is `develop`
- **THEN** nothing is created and the reply names both branches

#### Scenario: An id that looks like a support branch
- **WHEN** the proposed id is `fix-develop`
- **THEN** nothing is created and the reply says the name cannot end with `-develop`

### Requirement: A delivery setting that cannot be used stops the command
`/devkit change` and the opening step SHALL refuse to run, creating nothing, when the project's
delivery model is unknown, a branch name it needs is missing, or the two branch names are the same,
with a reply that names the setting.

#### Scenario: An unknown model
- **WHEN** the configuration says `delivery: { model: gitflow }`
- **THEN** the reply names `delivery.model`, the value and the accepted values, and nothing runs

#### Scenario: A missing branch name
- **WHEN** the configuration says `model: two-prs` with no `base`
- **THEN** the reply names `delivery.base` as missing, and nothing runs

### Requirement: In the two-pull-request model a change is archived when both branches hold it
In `two-prs`, a change SHALL count as archived, for the unfinished changes and for the roadmap, only
when its archived folder is on the base branch and on the test branch; until then a worktree on its
archive branch to the test branch SHALL keep it unfinished.

#### Scenario: Only the base branch holds the archive
- **WHEN** `main` lists `openspec/changes/archive/<date>-feat/` and `develop` does not, and a worktree is on `chore/archive-feat-develop`
- **THEN** `feat` is listed as unfinished, and calling the command again resumes it

#### Scenario: Both hold it
- **WHEN** both branches list the archived folder
- **THEN** `feat` is not unfinished

### Requirement: A hand-off on the support branch names the support worktree
A hand-off for work on the support branch SHALL name the support branch's worktree and branch in its
brief, in place of the task branch's.

#### Scenario: The conflict resolution
- **WHEN** the next step is the resolution of a conflict on `feat-develop`
- **THEN** the hand-off goes to the implementer and its brief says to work only in the worktree of `feat-develop`, on that branch
