<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: In the two-pull-request model only the pull request to the base branch delivers
In a project whose model is `two-prs`, a pull request SHALL be the change's own only when its base is
the configured base branch, besides the rules that already say which merged pull request is the
change's own. A merged pull request to the test branch SHALL never make the change delivered, and the
stage readout SHALL say which merge the change waits for.

#### Scenario: Only the test branch is merged
- **WHEN** the pull request to `develop` is merged and the pull request to `master` is open
- **THEN** the change is not delivered, the delivery checker does not reach the archive steps, and the stage readout names the pull request to `master` as the merge it waits for

#### Scenario: The base branch is merged
- **WHEN** the pull request to `master` is merged and the change's `tasks.md` on `master` has every task ticked
- **THEN** the change is delivered and the delivery checker answers the retro, as before this change

#### Scenario: Looked up from another branch
- **WHEN** the checkout is on `master` and the newest merged pull request that changes `openspec/changes/feat/` is the one to `develop`
- **THEN** that pull request is not taken as the change's own

#### Scenario: The readout before the test-branch merge
- **WHEN** both pull requests are open and green
- **THEN** the stage readout names the pull request to the test branch as the merge it waits for
