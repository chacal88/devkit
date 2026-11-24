<!-- devkit-stage specs result=passed attempt=2 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A slice's run stops with its reason when it cannot go on
The project command SHALL end a slice's run, saying why in one plain sentence and writing nothing more,
when the slice cannot be found, its folder was left half-made, a stage fails as many times in a row as
its limit allows or comes back with nothing changed, its pull request conflicts with its base branch, or
its pull request was closed without being merged. Calling the command again SHALL give the same end
until the cause is gone.

#### Scenario: A slice that does not exist
- **WHEN** the next step of `billing` is asked and no checkout holds a slice named `billing`, active or archived
- **THEN** it ends with an error saying no slice of that name was found, and nothing is created or written

#### Scenario: A half-made slice folder
- **WHEN** `openspec/changes/billing/` exists in the slice's worktree without its OpenSpec file
- **THEN** the run ends blocked saying the slice's folder is incomplete, and nothing is written

#### Scenario: A step that changes nothing
- **WHEN** a step of the slice is carried out and the next decision is the same step with nothing changed in the slice's worktree
- **THEN** the run ends blocked saying the stage came back with nothing changed

#### Scenario: A stage at its limit
- **WHEN** a stage's record says failed and its failures in a row since it last passed reach its limit
- **THEN** the run ends blocked naming the stage and its failures in a row, and no later stage runs

#### Scenario: A pull request in conflict with its base
- **WHEN** the slice's pull request conflicts with its base branch
- **THEN** the run ends blocked naming the pull request and its base branch, nothing is merged or pushed, and once the conflict is resolved on the slice's branch the command continues the slice

#### Scenario: A pull request closed without merging
- **WHEN** the slice's pull request was closed without being merged
- **THEN** the run ends blocked saying the pull request was closed, and no new pull request is opened
