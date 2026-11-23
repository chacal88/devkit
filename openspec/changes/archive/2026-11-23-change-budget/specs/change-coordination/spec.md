<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: A run can carry a token budget
`/devkit change` SHALL read an optional cap, a whole number of tokens, from `budget:` in the
`devkit:` block of the change's `.openspec.yaml`, else from `budget:` in the `devkit:` block of
`openspec/config.yaml` as the change's own checkout holds it. With neither, or with an empty value,
the run SHALL have no cap, and every output of the loop SHALL be what it is without the setting.

#### Scenario: The project's cap
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block and the change's `.openspec.yaml` has no `devkit:` block
- **THEN** the cap of the change's run is 2000000 tokens

#### Scenario: The change's cap wins for that change only
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block, change `a`'s `.openspec.yaml` has a `devkit:` block with `budget: 500000`, and change `b`'s has none
- **THEN** the cap of `a`'s run is 500000 tokens and the cap of `b`'s run is 2000000 tokens

#### Scenario: No budget anywhere
- **WHEN** neither file has a `budget:` key in a `devkit:` block
- **THEN** every output of `change-loop.mjs` is the same as before the setting existed, and no transcript is read for a count

#### Scenario: An empty value
- **WHEN** a `devkit:` block holds `budget:` with no value
- **THEN** that file sets no cap, as if the key were absent

#### Scenario: A key outside the devkit block
- **WHEN** the change's `.openspec.yaml` holds a top-level `budget: 100` and no `devkit:` block
- **THEN** that line sets no cap, and the project's value, or no cap, applies

#### Scenario: A quoted value, a comment and an unclosed quote
- **WHEN** a `devkit:` block holds `budget: "2000000"  # two million`, or `budget: "2000000` with no closing quote
- **THEN** the cap is 2000000 tokens, as the other settings of the block read a value

### Requirement: An invalid budget is refused before any stage runs
A `budget:` value that is not a whole number greater than zero, in either file, SHALL be refused with
the settings-error reply naming the setting `budget`, the value and the accepted values, and nothing
SHALL be created, handed off or run.

#### Scenario: In the project's settings
- **WHEN** the `devkit:` block of `openspec/config.yaml` holds `budget: abc` (or `0`, `-5`, `1.5`, `2e6`, `2_000_000`) and `/devkit change add an export` is typed
- **THEN** the reply is the settings-error reply naming `budget` and that value, and no folder, branch or worktree is created

#### Scenario: In the change's file
- **WHEN** the `devkit:` block of the change's `.openspec.yaml` holds `budget: 0` and the loop is asked for the change's next action
- **THEN** it exits 3 with the settings-error reply naming `budget` and `0`, and gives no hand-off

### Requirement: The run's spend is counted from the session's transcripts
A run's spend SHALL be the sum of `input_tokens + output_tokens + cache_creation_input_tokens` of each
model message recorded after the change's first `devkit-run: <id>` line in the session's transcript,
and in each subagent transcript of that session started after that line. `cache_read_input_tokens`
SHALL NOT count, and a message recorded on several lines SHALL count once.

#### Scenario: Known numbers
- **WHEN** after the change's first run line the session's transcript records two model messages of 10 input, 200 output, 3000 cache-write and 50000 cache-read tokens each, and one subagent started after that line records one message of 5 input, 100 output and 1000 cache-write tokens
- **THEN** the spend is 7525 tokens

#### Scenario: Before the first run line
- **WHEN** model messages are recorded before the change's first `devkit-run: <id>` line
- **THEN** they do not count

#### Scenario: The first run line, not the newest
- **WHEN** the transcript holds two `devkit-run: <id>` lines for the change, from two calls of `/devkit change`
- **THEN** the count starts at the first

#### Scenario: Another change's run line
- **WHEN** the only run line in the transcript names another change
- **THEN** the change's spend is 0

#### Scenario: A message split over several lines
- **WHEN** one model message is recorded on three lines with the same message id and the same usage
- **THEN** its tokens count once

#### Scenario: A subagent started before the run
- **WHEN** a subagent transcript of the session started before the change's first run line
- **THEN** none of its tokens count, even those recorded after that line

#### Scenario: A new session
- **WHEN** the change is resumed in another session, or on another machine
- **THEN** the count starts again from zero in that session

### Requirement: The loop stops at the budget between hand-offs
When a cap applies and the run's spend is at or above it, the loop's next action SHALL be an end
waiting for the owner, with the reason budget reached, in place of a stage hand-off or a session
step. Below the cap, or when the spend cannot be read, the action SHALL be the one given with no
cap. The grill and every end SHALL be unchanged.

#### Scenario: At the cap
- **WHEN** the cap is 2000000, the spend is 2000000, and the next action would hand a stage to its agent
- **THEN** the run ends waiting for the owner with the reason budget reached, the exit code is 1, and the output's first line is `devkit-run: <id>` and its second `devkit-end: <id> waiting-for-owner`

#### Scenario: Above the cap with a session step ready
- **WHEN** the spend is above the cap and the next action would be a session step
- **THEN** the run ends waiting for the owner with the reason budget reached

#### Scenario: The turn can end
- **WHEN** the loop ended the run at the budget and the session then tries to end its turn
- **THEN** the stop is allowed at the first attempt

#### Scenario: Under the cap
- **WHEN** the spend is below the cap
- **THEN** the next action is the one the loop gives with no cap

#### Scenario: No transcript to read
- **WHEN** a cap is set and the session's transcript cannot be found or read
- **THEN** the next action is the one the loop gives with no cap

#### Scenario: The grill and the ends
- **WHEN** the spend is above the cap and the next action is the grill or an end
- **THEN** that action is given unchanged

#### Scenario: A stage that made no progress
- **WHEN** the loop is called with the previous action's progress key, the same action comes back, and the spend is above the cap
- **THEN** the run ends blocked, saying that stage came back with nothing changed

#### Scenario: A hand-off that crosses the cap
- **WHEN** a stage agent's own work takes the spend past the cap
- **THEN** nothing stops that agent, and the loop's next call ends the run at the budget

#### Scenario: The roadmap coordinator's own reading
- **WHEN** the roadmap coordinator reads a change's next action for its run or its board
- **THEN** no budget applies to that reading

### Requirement: The budget stop says how to go on
The reply of a budget stop SHALL state, in the person's language, the tokens spent, the cap, the
absolute path of the change's `.openspec.yaml` and the key `budget` of its `devkit:` block as the
place to raise the cap, and that typing `/devkit change` again goes on.

#### Scenario: In English
- **WHEN** the run of `feat` stops at a cap of 2000000 with 2100000 tokens spent and the person's language is `en`
- **THEN** the reply names `feat`, 2100000, 2000000, the absolute path of `feat`'s `.openspec.yaml`, `budget` in the `devkit` block and `/devkit change`

#### Scenario: In Brazilian Portuguese
- **WHEN** the same stop happens and the person's language is `pt-BR`
- **THEN** the reply says the same in Brazilian Portuguese

### Requirement: A raised budget resumes the run
After a budget stop, once the cap that applies is above the spend, the loop's next action SHALL be
the hand-off the stop held back, with no other step; while the cap is not above the spend, every call
SHALL stop the run again at the budget.

#### Scenario: The cap is raised
- **WHEN** the run of `feat` stopped at the budget, the owner sets `budget:` in the `devkit:` block of `feat`'s `.openspec.yaml` above the spend, and types `/devkit change` again
- **THEN** the next action is the hand-off the stop held back

#### Scenario: The cap is not raised
- **WHEN** the run stopped at the budget and `/devkit change` is typed again with no change to either file
- **THEN** the run stops again at the budget with the same kind of reply

## MODIFIED Requirements

### Requirement: Replies use no internal term
Every reply of the command SHALL come from one message table with the same keys in English and in
Brazilian Portuguese, and SHALL hold no stage id or role id with a dash, no step name of a checker,
no file name and no checker name; the reply of a usage error is one of them. The one exception is the
budget stop's reply, which names the change's `.openspec.yaml` and the key `budget` it is raised in.

#### Scenario: The message table is checked
- **WHEN** every message and parameter of the table is rendered in both languages, the usage error's reply included
- **THEN** none holds a backtick, a file name, a hyphenated stage, role or step id, a checker's reason code, a checker's name, the loop script's name, the roadmap script's name, a setting's key, an option or a placeholder for a missing change, except the budget stop's reply, which holds the path of the change's settings file and the key budget; both languages have the same keys, and no Portuguese string equals its English one except the three that are the same word in both languages, the driver's name CompozyOS and the setting names driver and budget, and the three that hold only parameters and punctuation: the line saying where a change stays, the owner's need in the list of a run that ends, and the bare stage title of a board row

#### Scenario: A usage error's reply in both languages
- **WHEN** the command's script exits 3 on an unknown option, in English and in Brazilian Portuguese
- **THEN** the reply is the usage error's message of the table in that language, and the raw error, with the script's name and options, is only in the error field
