<!-- devkit-stage specs result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The delivery settings come from the repository's default branch
The check SHALL read `devkit.delivery` from `openspec/config.yaml` as it is on the repository's
default branch, which in `two-prs` is the base branch, and never as it is on the pull request's head
or on the test branch, so that a pull request cannot change the rules it is judged by. Without that
configuration, or without `two-prs` in it, the check SHALL judge as before this change.

#### Scenario: A head that switches the model
- **WHEN** the default branch `master` says `two-prs` with `test_branch: develop` and the pull request's head changes the model to `trunk`
- **THEN** the pull request to `master` is judged under the two-pull-request rules

#### Scenario: A test-branch pull request whose own copy names no model
- **WHEN** the default branch `master` says `two-prs` with `test_branch: develop`, the copy of `openspec/config.yaml` on `develop` names no model, and the pull request to `develop` from `feat` is checked
- **THEN** it is judged under the two-pull-request rules: the check does not judge the delivery contract, says it is judged on the pull request to `master`, and exits 0

#### Scenario: A project with no model
- **WHEN** the default branch's configuration names no `devkit.delivery.model`
- **THEN** the check's output, JSON and exit code are the ones it gave before this change, and it reads nothing from GitHub

### Requirement: The check names the default branch from the event, else from the clone
The check SHALL name the default branch from the pull request event GitHub sends, else from the
clone's `origin/HEAD`. When neither names a branch it can read, it SHALL read the settings from the
pull request's base branch.

#### Scenario: The default branch named by the event
- **WHEN** the pull request event names `master` as the repository's default branch and the pull request goes to `develop`
- **THEN** the settings are read from `master`

#### Scenario: The default branch named by the clone
- **WHEN** the check runs with no pull request event and the clone's `origin/HEAD` points to `master`
- **THEN** the settings are read from `master`

#### Scenario: The default branch cannot be named
- **WHEN** the check runs with no pull request event and no `origin/HEAD`, on a pull request to `develop` whose copy of the file names no model
- **THEN** the settings are read from `develop` and the check's output, JSON and exit code are the ones it gave before this change

### Requirement: A configured base branch other than the default branch fails the check
In `two-prs`, when the default branch is named and the configured base branch is another one, the
check SHALL fail, naming both, and SHALL apply neither two-pull-request rule.

#### Scenario: The base branch is not the default branch
- **WHEN** the pull request event names `main` as the default branch and the configuration on `main` says `two-prs` with `base: master`
- **THEN** the check exits 1 with a line naming `master` and `main`

### Requirement: A pull request to the base branch waits for its pull request to the test branch
In `two-prs`, on a pull request to the base branch that the check judges, the check SHALL fail,
naming the pull request to the test branch, while no pull request to the test branch from the same
head branch or from its support branch is merged; it SHALL pass that rule once one is merged.

#### Scenario: The test-branch pull request is open
- **WHEN** the pull request to `master` from `feat` is checked and the pull request #12 to `develop` from `feat` is open
- **THEN** the check exits 1 with a line naming #12 and `develop`

#### Scenario: It is merged
- **WHEN** #12 is merged and the change's items are met
- **THEN** the check exits 0

#### Scenario: Merged from the support branch
- **WHEN** #12 from `feat` was closed and #14 to `develop` from `feat-develop` is merged
- **THEN** the rule passes

#### Scenario: No pull request to the test branch
- **WHEN** no pull request to `develop` from `feat` or `feat-develop` exists
- **THEN** the check exits 1 saying the pull request to `develop` is missing

#### Scenario: GitHub cannot be read
- **WHEN** the pull requests cannot be read (for example the job has no `pull-requests: read` permission or no `GH_TOKEN`)
- **THEN** the check exits 1 saying it cannot read the pull requests to the test branch and naming the permission and the token

### Requirement: A pull request to the base branch that holds a test-branch commit fails
In `two-prs`, on a pull request to the base branch, the check SHALL fail, naming the commit, when the
head holds a commit that is on the test branch's first-parent history and not on the base branch.

#### Scenario: The task branch merged the test branch
- **WHEN** `feat` merged `develop` and its pull request to `master` is checked
- **THEN** the check exits 1 naming the first such commit and saying the task branch never receives `develop`

#### Scenario: The task branch was merged into the test branch
- **WHEN** the pull request to `develop` from `feat` was merged with a merge commit, so the commits of `feat` are reachable from `develop`
- **THEN** this rule does not fail

#### Scenario: A clean task branch
- **WHEN** `feat` holds only its own commits on top of `master`
- **THEN** this rule does not fail

### Requirement: A pull request to the test branch is judged on its resolution only
In `two-prs`, on a pull request to the test branch, the check SHALL not judge the delivery contract,
which the pull request to the base branch carries. When its head is a support branch, it SHALL fail
while the newest conflict resolution on it lacks an approved, current verdict of each required
reviewer under `reviews/resolution/`, or one of those verdicts has an undisposed blocking finding.

#### Scenario: From the task branch
- **WHEN** the pull request to `develop` comes from `feat`
- **THEN** the check prints that the delivery contract is judged on the pull request to `master` and exits 0

#### Scenario: From a support branch with an approved resolution
- **WHEN** the pull request to `develop` comes from `feat-develop`, whose newest resolution merge both required reviewers approved at that commit
- **THEN** the check exits 0

#### Scenario: From a support branch whose resolution is not reviewed
- **WHEN** the newest resolution merge on `feat-develop` has no verdict, or a verdict recorded at an older merge, or a verdict with an undisposed `[blocking]` finding
- **THEN** the check exits 1 naming what is missing

#### Scenario: Only clean merges
- **WHEN** every merge on `feat-develop` matches Git's automatic merge
- **THEN** the resolution rule passes
