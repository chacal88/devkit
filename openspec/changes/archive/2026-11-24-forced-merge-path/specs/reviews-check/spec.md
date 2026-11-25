<!-- devkit-stage specs result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Spec Delta

## ADDED Requirements

### Requirement: An archive pull request is not judged on the archived change's tasks
For a devkit-script folder an archive pull request brings, the check SHALL judge the retro and the
files the approved proposals name, as before, and SHALL NOT read the archived `tasks.md`, the
evidence or the reviews: an owner's forced merge archives a change with tasks left unticked.

#### Scenario: An archived change with an unticked task
- **WHEN** an archive pull request brings a `devkit` folder whose `tasks.md` has an unticked task and no `evidence.md`, and whose `retro.md` has a `## Proposed updates` section with every proposal answered
- **THEN** the check exits 0, as it does for the same folder with every task ticked

#### Scenario: The retro still decides
- **WHEN** the same folder's `retro.md` has an unanswered proposal
- **THEN** the check exits 1 naming it, as before this change
