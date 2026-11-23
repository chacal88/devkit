<!-- devkit-stage specs result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Every end of a run is marked in the session's record
Every command of the loop that ends a run SHALL print the line `devkit-end: <id> <state>` (the state
`archived`, `waiting-for-owner`, `waiting-on-github` or `blocked`), after its `devkit-run: <id>` line
where it prints one. No other output SHALL hold that line, and the reply the session shows SHALL NOT
hold it.

#### Scenario: An end computed by the loop
- **WHEN** the next action, or the action the background wait ends with, is an end
- **THEN** the output's first line is `devkit-run: <id>`, its second is `devkit-end: <id> <state>` with the end's state, and the action follows

#### Scenario: A no-progress or not-delivered end
- **WHEN** the loop is called with the previous action's progress key and ends the run blocked for no progress or for a stage that was not delivered
- **THEN** its output holds `devkit-end: <id> blocked` after its `devkit-run: <id>` line

#### Scenario: A failed stage agent
- **WHEN** a stage agent returned `Outcome: failure` and the loop is called with its action's progress key
- **THEN** the loop gives the retry of that stage or ends the run blocked itself, with `devkit-end: <id> blocked` after its `devkit-run: <id>` line, and the session declares no end for it

#### Scenario: An end the session declares
- **WHEN** the session renders the blocked reply for a red gate, or the reply for a pull-request decision left to the owner, naming the change
- **THEN** the output's first line is `devkit-end: <id> blocked` (or `devkit-end: <id> waiting-for-owner`), the reply follows on its own lines, and the session shows only the reply

#### Scenario: An action that is not an end
- **WHEN** the next action hands a stage to an agent, is a session step or is the grill
- **THEN** the output holds no `devkit-end:` line
