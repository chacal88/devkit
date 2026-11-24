<!-- devkit-stage specs result=passed attempt=1 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Spec Delta

## ADDED Requirements

### Requirement: Each entry lists the stages that apply to the change
Each entry of the state command SHALL carry `stages`: the ids of the stages of the change's own flow
that apply to it, in the flow's order, or `null` when the change's flow is not read (an archived
change, a start with no folder, a change begun under the previous script). A stage applies unless the
stage walk reports it not applicable by a rule (a missing flag or setting, a skipped artifact, a point
already passed, a role not shipped). Every other field keeps its meaning.

#### Scenario: A change with the ui flag and no test settings
- **WHEN** `state --change feat` runs on a `devkit` change whose classification flags are `[ui, contract]` in a project that sets neither `tests.unit` nor `tests.e2e`
- **THEN** `stages` lists the 15 ids from `open` to `retro` in the flow's order, without `unit-tests` and `e2e-tests`

#### Scenario: A condition that does not hold
- **WHEN** the change has no `ui` flag and no `mockup.md`, or the project sets `tests.unit`
- **THEN** `mockup` is not listed in the first case, and `unit-tests` is listed in the second

#### Scenario: The list follows the change
- **WHEN** the same change, with no `mockup.md`, is read before and after its classification line gains the `ui` flag
- **THEN** `mockup` is missing from the first `stages` and listed in the second

#### Scenario: A stage its own file declares not applicable
- **WHEN** the change's `decisions.md` header says `result=not-applicable`
- **THEN** `decisions` is still listed

#### Scenario: No flow read
- **WHEN** the entry is an archived change, a start the run file names with no folder, or a change begun under the previous script
- **THEN** its `stages` is `null`

#### Scenario: The other fields and next are unchanged
- **WHEN** the same change is read before and after this field exists
- **THEN** every other field of the entry holds the same value, and the action `next` prints has no `stages` field

### Requirement: The state is read without GitHub on request
With `--offline` the state command SHALL make no GitHub call, with or without `--change`; GitHub then
reads as not answering, so the state follows the requirement "A GitHub that does not answer reads as a
wait on GitHub". It still writes nothing and exits 0. Without `--offline` nothing changes.

#### Scenario: No call at all
- **WHEN** `state --offline --lang en` runs, with and without `--change`, with a `gh` on `PATH` that records each call
- **THEN** no call is recorded and the exit code is 0

#### Scenario: A plan stage offline
- **WHEN** `state --change feat --offline` runs on a change waiting for the plan approval
- **THEN** its entry holds the same state, reason, stage and title as with GitHub answering

#### Scenario: A delivery offline
- **WHEN** `state --change feat --offline` runs on a change waiting on its pull request's checks
- **THEN** its entry is `waiting-on-github` with the reason `silent`

#### Scenario: A value given to the option
- **WHEN** the command gets `--offline yes`
- **THEN** it exits 3 with the plain reply and prints no state
