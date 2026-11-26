# stage-models Specification

## Purpose
Chooses the model each stage of a change runs on, from one table with a built-in default that a
project and a change can override, and retries a failed stage subagent once on a stronger model.

## Requirements

### Requirement: Each stage has a model from a built-in default
The loop SHALL hold a model for every stage id of the `devkit` and `devkit-lite` scripts but `open`:
`opus` for requirements, decisions, proposal, specs, design and tasks; `haiku` for unit-tests and
delivery; `sonnet` for mockup, readiness, approval, implementation, e2e-tests, evidence, review and
retro. No default SHALL use a `[1m]` variant.

#### Scenario: No table anywhere
- **WHEN** neither `openspec/config.yaml` nor the change's `.openspec.yaml` has a `models:` key in its `devkit:` block, and the loop is asked for the next action of a change at each stage in turn
- **THEN** the action's model is `opus` at the grill, the ADRs and every plan stage (proposal, specs, design and tasks), `sonnet` at the mockup, the readiness review, the approval, the implementation, the E2E tests, the evidence, the review and the retro, and `haiku` at the unit-test run and the delivery

#### Scenario: The default holds no 1M variant
- **WHEN** the built-in table is read
- **THEN** no value of it ends in `[1m]`

### Requirement: A project and a change can set a stage's model
The loop SHALL read `models:` in the `devkit:` block of `openspec/config.yaml`, as the change's own
checkout holds it, and in the settings block of the change's `.openspec.yaml` (its `x-devkit:` block,
or its `devkit:` block when the file has no `x-devkit:` block), each a map from a stage id to a model.
A stage's model SHALL be the change's entry, else the project's, else the default. An empty value
SHALL count as absent.

#### Scenario: The project's entry
- **WHEN** `openspec/config.yaml` has `models:` with `design: sonnet` in its `devkit:` block
- **THEN** the action of every change at the design stage carries `sonnet`, and every other stage keeps its default

#### Scenario: The change's entry wins for that change only
- **WHEN** the project's table has `design: sonnet`, change `a`'s `.openspec.yaml` has an `x-devkit:` block with `models:` holding `design: opus`, and change `b`'s has none
- **THEN** `a`'s design action carries `opus` and `b`'s carries `sonnet`

#### Scenario: An empty value
- **WHEN** the change's table holds `design:` with no value and the project's holds `design: haiku`
- **THEN** the design action carries `haiku`

#### Scenario: The change's table passes the strict validation
- **WHEN** a change's `.openspec.yaml` holds, as the flow document shows it, an `x-devkit:` block whose `models:` holds `review: opus`, and `openspec validate <id> --type change --strict` is run on the change
- **THEN** the validation exits 0, and the change's review action carries `opus`

#### Scenario: A devkit block written before the x-devkit block
- **WHEN** a change's `.openspec.yaml` holds a `devkit:` block with `models:` holding `design: opus` and no `x-devkit:` block
- **THEN** the change's design action carries `opus`, as before

#### Scenario: Both blocks in the change's file
- **WHEN** a change's `.openspec.yaml` holds an `x-devkit:` block whose `models:` holds `design: opus` and a `devkit:` block whose `models:` holds `design: haiku` and `review: haiku`
- **THEN** the change's design action carries `opus` and its review action the project's value or the default, read from the `x-devkit:` block alone

### Requirement: An unknown stage or model is refused
A `models:` key that is not a stage id of the table, or a value that is not `opus`, `sonnet`,
`haiku`, `opus[1m]` or `sonnet[1m]`, SHALL be refused with the settings-error reply naming the
setting, the value and the accepted values, and nothing SHALL be created, handed off or run: in the
project's table, by every command that checks the project's settings; in a change's table, by that
change's own loop.

#### Scenario: An unknown stage in the project's table
- **WHEN** the project's `models:` holds `implement: sonnet` and `/devkit change add an export` is typed
- **THEN** the start answers with the settings-error reply naming `implement` and the accepted stage ids, and no folder, branch or worktree is created

#### Scenario: An unknown value in the change's table
- **WHEN** the change's `models:` holds `design: gpt` and the loop is asked for the change's next action
- **THEN** it exits 3 with the settings-error reply naming `design: gpt` and the accepted models, and gives no hand-off

#### Scenario: A bad project table in a roadmap
- **WHEN** the project's `models:` holds `design: gpt` and `/devkit roadmap`, `/devkit status` or `/devkit project` is typed
- **THEN** the command answers with the settings-error reply naming `design: gpt` and the accepted models, and starts nothing

#### Scenario: Haiku has no 1M variant
- **WHEN** a `models:` value is `haiku[1m]`
- **THEN** it is refused as an unknown value

### Requirement: A change's bad table stops only that change's own loop
Every reader of a change other than its own loop (the locks, the roadmap run and the status board)
SHALL ignore a change's table that holds a refused entry, whole, and take the project's table or the
default instead, so that a typing error in one change stops no other.

#### Scenario: A bad change table outside the change's own loop
- **WHEN** change `a`'s `models:` holds `design: gpt`, the project's holds none, and a roadmap run or a lock reads `a`'s next action at its design stage
- **THEN** that reading does not stop, and the action it reads carries the default model `opus`

### Requirement: The 1M variant is an explicit opt-in
A `models:` value of `opus[1m]` or `sonnet[1m]` SHALL be accepted and carried by the loop's actions
exactly as written. The suffix SHALL reach only a session's own model (a change session's start
model, or a step-down to that value) and the retry's mapping on the action; a stage subagent SHALL
run on the plain family, since the session drops the suffix on the Agent call.

#### Scenario: A 1M variant for one stage
- **WHEN** the project's `models:` holds `implementation: sonnet[1m]`
- **THEN** the implementation's hand-offs carry the model `sonnet[1m]`

#### Scenario: A 1M variant on a stage subagent
- **WHEN** the implementation's hand-off carries `sonnet[1m]` and the `devkit` skill's Loop is followed
- **THEN** the Agent call's `model` is `sonnet`, and the documents say the opt-in never reaches a stage subagent

### Requirement: Every action at a stage carries the stage's model
Every action the loop prints whose stage has a row SHALL carry a `model` field, the stage's model.
The session SHALL pass an `agent` action's model on its Agent call, without a `[1m]` suffix, so the
stage subagent runs on it whatever the agent's own declared model and the session's model.

#### Scenario: A hand-off
- **WHEN** the next action hands the design stage to its agent with no table set
- **THEN** the action carries `model` `opus`

#### Scenario: A stage above the session's model
- **WHEN** a session running on Sonnet is handed the design stage, whose model is `opus`
- **THEN** the action is an `agent` action with `model` `opus`, and no action switches the session's model

#### Scenario: The skill passes the model
- **WHEN** the `devkit` skill's Loop is read
- **THEN** its `agent` item says to set the Agent call's `model` to the action's `model` with any `[1m]` suffix removed

### Requirement: A lone change never switches its own session's model
A `/devkit change` run SHALL NOT switch the model of the session it runs in; only its stage
subagents follow the table.

#### Scenario: No switch in a lone run
- **WHEN** a `/devkit change` run goes through stages whose models differ
- **THEN** no action of the change loop asks to switch a session's model, and the skill's change sections name no session-model tool

### Requirement: A failed stage subagent is retried once on the next model up
When the newest stage subagent handed the same brief in the current run returned `Outcome: failure`
on Haiku or Sonnet, and no earlier one of that brief failed in a row with it, the loop SHALL hand the
same stage again with the next family up (Haiku to Sonnet, Sonnet to Opus, a `[1m]` suffix kept),
marked as a retry.

#### Scenario: A failure on Haiku
- **WHEN** the unit-test subagent, handed on `haiku`, returned `Outcome: failure` without writing `unit-tests.md`, and the loop is called again with that action's progress key
- **THEN** the next action hands the same unit-test stage with `model` `sonnet`, marked as a retry of a failure on `haiku`, instead of ending for no progress

#### Scenario: A failure on a 1M Sonnet
- **WHEN** the implementation subagent, handed on `sonnet[1m]`, returned `Outcome: failure`, and the loop is called again with that action's progress key
- **THEN** the retry carries `opus[1m]`

#### Scenario: A success after a failure resets the count
- **WHEN** a stage subagent of a brief failed, its retry succeeded, and later a new subagent of the same brief fails, and the loop is called again with that action's progress key
- **THEN** the loop hands one retry again

### Requirement: Only a stage subagent that could not finish is retried
The retry SHALL reach only a stage subagent that stopped with `Outcome: failure` without writing its
stage file. A stage subagent that recorded `result=failed` in its stage file (as the
`subagent-stop` hook asks) is a failed stage: below the stage's ceiling the loop SHALL hand the
stage's existing fix on the fix action's own model, with no retry mark, whatever its last line says;
at the stage's ceiling the run SHALL end blocked as it did before, with no retry.

#### Scenario: A failure with a written result=failed file
- **WHEN** the unit-test subagent, handed on `haiku`, wrote `unit-tests.md` with `result=failed` in its stage header and returned `Outcome: failure`, and the loop is called again with that action's progress key
- **THEN** the next action hands the implementation to the implementer with the step `fix-tests` and the implementation's table model, carries no retry mark, and the run does not end

#### Scenario: A plan stage recorded as failed
- **WHEN** the decisions subagent, handed on `opus`, wrote `decisions.md` with `result=failed` in its stage header and returned `Outcome: failure`, and the loop is called again with that action's progress key
- **THEN** the next action hands the decisions stage to its ADR author for a revision from its findings, on `opus`, with no retry mark, and the run does not end for a failure on Opus

#### Scenario: A test stage recorded as failed at its ceiling
- **WHEN** the unit-test subagent wrote `unit-tests.md` with `result=failed` at the stage's last allowed attempt and returned `Outcome: failure`, and the loop is called again with that action's progress key
- **THEN** the run ends blocked with the reason that the stage reached its ceiling, prints `devkit-end: <id> blocked`, exits 2, and hands no retry

### Requirement: A second failure or a failure on Opus ends the run blocked
When the stage subagents of the same brief failed twice in a row in the current run, or the newest
one failed on Opus, the loop SHALL end the run blocked with the reason that the stage could not
finish its work, and print `devkit-end: <id> blocked`.

#### Scenario: The retry fails too
- **WHEN** the unit-test subagent failed on `haiku`, its retry failed on `sonnet`, and the loop is called again with the retry's progress key
- **THEN** the run ends blocked saying the unit-test stage could not finish its work, and the exit code is 2

#### Scenario: A failure on Opus
- **WHEN** the design subagent, handed on `opus`, returned `Outcome: failure`, and the loop is called again with that action's progress key
- **THEN** the run ends blocked with that reason and no retry is handed

### Requirement: The retry is read from the session's transcripts
The loop SHALL find the earlier hand-offs and their outcomes in the subagent transcripts of the
calling session started after its newest typed `/devkit` command other than `/devkit status`, and
store nothing. A subagent's hand-off SHALL be matched by the brief its prompt starts with, its
model by the model recorded on its messages. With no readable transcript the loop SHALL hand no retry.

#### Scenario: A new typed command starts fresh
- **WHEN** a stage subagent failed twice, the run ended blocked, and the owner types `/devkit change` again in the same session
- **THEN** the next action hands the stage on its table model, as a first hand-off, and a later call with that hand-off's progress key reads only the subagents started after the typed command

#### Scenario: A status check in between
- **WHEN** a stage subagent failed on `haiku`, the owner typed `/devkit status`, and the loop is called again with that action's progress key
- **THEN** the next action is still the retry of that stage on `sonnet`

#### Scenario: No transcript
- **WHEN** the session's transcript cannot be found or read and a stage subagent returned `Outcome: failure`
- **THEN** no retry is handed, and a call with that action's progress key ends the run blocked for no progress

#### Scenario: Another stage in between
- **WHEN** in a roadmap run handled in one session, change `a`'s design subagent failed and another change's subagents ran after it
- **THEN** `a`'s next action is still the retry of its design stage

### Requirement: Only a next-action call after a hand-off reads the hand-offs
The change's own loop SHALL read the hand-offs only when asked for the next action with the progress
key of the action before it, the call the session makes after every stage agent, success or failure.
A roadmap run handled in one session SHALL read them once on each `run` and `next`, for every
change. A change's next-action call with no progress key, a lock and the status board SHALL NOT read
them.

#### Scenario: A call with no progress key reads no hand-off
- **WHEN** a stage subagent failed on `haiku`, no budget is set, and the change's loop is asked for the next action with no progress key
- **THEN** it reads neither the session's transcript nor its subagent transcripts, prints the same output as with no transcript at all, and hands the stage on its table model with no retry mark

#### Scenario: A lock reads no hand-off
- **WHEN** in a roadmap run handled in one session a stage subagent failed, and the session's stop lock or `/devkit status` reads the run
- **THEN** each decides and prints what it would with no subagent transcript at all
