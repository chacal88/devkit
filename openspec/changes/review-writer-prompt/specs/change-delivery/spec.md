<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The delivery checker does not count a checkbox inside a fenced block
A checkbox line inside a fenced block of `tasks.md` SHALL NOT count as a task or as a gate for the
delivery checker, in the change's worktree and in the `tasks.md` it reads from the default branch. A
fence opens on a line starting, after optional spaces, with three or more backticks or tildes and
closes on the next such line of at least as many of the same character, the rule the stage checker
uses.

#### Scenario: An unticked example in a fence
- **WHEN** every task of `tasks.md` is ticked and an unticked checkbox line sits inside a block fenced with three backticks
- **THEN** `deliver-check.mjs <id>` lists no unticked task in the tasks item and its next step is not `implement`

#### Scenario: A gate in a fence
- **WHEN** a fenced block of `tasks.md` holds the line `- [ ] 9.9 Gate: run it` with no backticked command
- **THEN** the tasks item is not blocked for a gate without a command, and no phase of the report has a gate `9.9`

#### Scenario: A tilde fence
- **WHEN** the unticked checkbox line sits inside a block fenced with `~~~~`
- **THEN** it is not counted either

#### Scenario: The tasks on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked except a checkbox line inside a fenced block
- **THEN** the change is delivered and `deliver-check.mjs <id>` answers the retro

#### Scenario: A checkbox after the fence closes
- **WHEN** an unticked checkbox line follows the closing fence line
- **THEN** it is counted as an unticked task
