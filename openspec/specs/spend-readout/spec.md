# spend-readout Specification

## Purpose
Shows where a change's tokens went, per stage and per model, with its retries and its total against
the token budget, read from the session transcripts so that the stage-to-model table can be tuned.

## Requirements

### Requirement: A change's spend is read per stage and per model
A change's spend SHALL be read from the calling session's transcript and from every transcript of
the folder the host keeps for the change's worktree, each with its subagent transcripts, counting
each model message as the budget does. A session message SHALL count in the stage of the change's
newest `next` before it; a subagent SHALL count in the stage its brief names.

#### Scenario: Known numbers
- **WHEN** after `devkit-run: feat` and a `next` at the design stage the session records one Opus message of 10 input, 200 output and 3000 cache-write tokens, and a subagent whose brief starts `Change feat (devkit script), stage tasks:` records one Opus message of 5 input, 100 output and 1000 cache-write tokens
- **THEN** the spend of `feat` is 3210 tokens at the design stage on Opus and 1105 at the tasks stage on Opus, 4315 in all

#### Scenario: Another change's turns
- **WHEN** the session's transcript holds `devkit-run: other` after `feat`'s messages, and model messages follow it
- **THEN** those messages do not count for `feat`

#### Scenario: Before the change's first run line
- **WHEN** model messages are recorded before the first `devkit-run: feat` line of a transcript
- **THEN** they do not count for `feat`

#### Scenario: A transcript that cannot be read
- **WHEN** a transcript or a subagent file cannot be read, or its last line is cut off
- **THEN** it adds nothing, or adds its whole lines only, and the readout is still printed

### Requirement: A retry is marked in the spend
A stage subagent whose hand-off repeats the brief of the one before it of that brief, which failed,
SHALL be listed as a retry of its stage, with the models it went from and to and its tokens.

#### Scenario: One retry
- **WHEN** a unit-test subagent failed on Haiku after 4000 tokens and its retry on Sonnet spent 9000
- **THEN** the unit-test stage shows Haiku 4000 and Sonnet 9000, and a retry from Haiku to Sonnet of 9000 tokens

### Requirement: The spend shows its total against the budget
The readout SHALL end with the change's total and, when the change has a token budget, the cap; with
none, it SHALL say there is no budget.

#### Scenario: With a cap
- **WHEN** the change's spend is 1639000 tokens and its budget is 2000000
- **THEN** the total line holds 1639000 and 2000000

#### Scenario: With no cap
- **WHEN** no budget is set for the change
- **THEN** the total line holds the spend and says no budget is set

### Requirement: The stage readout and the status board print the spend
`flow-check.mjs <id>` SHALL print the change's spend block after its readout, and `/devkit status`
SHALL print one block per change it lists as open, each only when that change counted at least one
token, in the person's language. Neither SHALL write a file.

#### Scenario: The stage readout
- **WHEN** `flow-check.mjs feat --lang en` runs in a session whose transcript counts tokens for `feat`
- **THEN** after the readout's last line a block lists each stage with its tokens per model, the retries and the total

#### Scenario: The status board
- **WHEN** `/devkit status` runs while open change `a` counted tokens and open change `b` counted none
- **THEN** after the board a spend block holds `a`'s stages and total, and nothing for `b`

#### Scenario: No tokens
- **WHEN** no transcript counts a token for the change
- **THEN** the readout and the board are printed exactly as before this change

#### Scenario: Nothing is written
- **WHEN** either command prints the spend
- **THEN** no file, branch or bookkeeping is written
