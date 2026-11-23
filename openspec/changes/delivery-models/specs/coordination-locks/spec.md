<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The test branch never enters a task branch
In an opted-in project whose model is `two-prs`, a Bash command SHALL be refused when one of its
`git merge`, `git rebase` or `git pull` runs on a branch other than the test branch or a branch named
`<name>-<test_branch>` and would bring the test branch in. The reason SHALL name the support branch
`<branch>-<test_branch>` as the way out. Every other command, and every other project, SHALL be
allowed as before.

#### Scenario: Merging the test branch into the task branch
- **WHEN** the checkout is on `feat` and the command is `git merge origin/develop`
- **THEN** the command is refused and the reason names `feat-develop`

#### Scenario: Rebasing onto it
- **WHEN** the checkout is on `feat` and the command is `git rebase develop` or `git rebase --onto develop main`
- **THEN** the command is refused

#### Scenario: Pulling it
- **WHEN** the checkout is on `feat` and the command is `git pull origin develop`, or `git pull` with `origin/develop` as the branch's upstream
- **THEN** the command is refused

#### Scenario: On the support branch
- **WHEN** the command is `git -C <support worktree> merge origin/develop` and that worktree is on `feat-develop`
- **THEN** the command is allowed

#### Scenario: Names that only look alike
- **WHEN** the checkout is on `feat` and the command is `git merge develop-tools`, `git merge feature/develop` with no remote named `feature`, or `git log develop`
- **THEN** the command is allowed

#### Scenario: Another model
- **WHEN** the project's model is `trunk-auto`, or names none, and the command is `git merge origin/develop`
- **THEN** the command is allowed

#### Scenario: A configuration that cannot be read
- **WHEN** the project's `devkit:` block cannot be read or its delivery settings are invalid
- **THEN** the command is allowed
