<!-- devkit-stage specs result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## ADDED Requirements

### Requirement: A change session starts on its stage's model
In a run with a session per change, the start of a change session SHALL carry, in the host start
tool's input, the model of the stage the change is at, and the run SHALL record that model as the
session's. A session found already running SHALL be recorded with no known model.

#### Scenario: A new change starts at its grill
- **WHEN** on a typed turn ready change `a` is opened and its session is started, with no `models:` table set
- **THEN** the start's input holds the model `opus`, and the run records `opus` for `a`'s session

#### Scenario: A change resumed at its implementation
- **WHEN** on a typed turn open change `b`, at its implementation, has no session of its own
- **THEN** the start's input holds the model `sonnet`

#### Scenario: A session the app already lists
- **WHEN** the app's list holds a session in `a`'s worktree and the coordinating session reports it found instead of started
- **THEN** the run records `a`'s session with no known model and never switches it, counts it as `a`'s own session as it counts a started one (no second start, no stage of `a` handed by the coordinating session), and announces it once as started

### Requirement: A change session only steps down
When a change session's floor is cheaper than the session's recorded model (Haiku below Sonnet
below `sonnet[1m]` below Opus below `opus[1m]`), the run SHALL return one action switching the
session to the floor, on any turn, and record it once reported done. It SHALL NOT return a switch
below the floor, to an equal or more expensive model, or again after that switch was refused.

#### Scenario: From the plan to the approval
- **WHEN** `a`'s session is recorded on `opus` and `a`'s end-of-turn report arrives while `a` waits at the plan approval, whose model is `sonnet`, with no `models:` table set
- **THEN** the decision holds one action switching `a`'s session to `sonnet`, and after it is reported done the run records `sonnet`

#### Scenario: A Haiku stage with a session-run stage ahead
- **WHEN** `a`'s session is recorded on `sonnet`, `a` is at its unit tests or at its delivery, whose model is `haiku`, and no `models:` table is set
- **THEN** no switch is returned, because the retro still ahead runs on `sonnet`, and `a`'s own loop hands the Haiku stage to its agent on `haiku`

#### Scenario: A floor above the stage's model
- **WHEN** `a`'s session is recorded on `opus`, `a` is at its unit tests, whose model is `haiku`, and the project's table holds `review: opus`
- **THEN** no switch is returned, because the floor is `opus`

#### Scenario: Haiku once no session-run stage needs more
- **WHEN** `a`'s session is recorded on `sonnet`, `a` is at its delivery, whose model is `haiku`, and the project's table holds `retro: haiku`
- **THEN** the decision holds one action switching `a`'s session to `haiku`

#### Scenario: A refused switch
- **WHEN** the switch of `a`'s session to `sonnet` was reported refused
- **THEN** no later decision returns that switch again while `a`'s session is recorded on the same model

#### Scenario: A stopping run
- **WHEN** the run is stopping
- **THEN** no switch is returned

### Requirement: A change session's floor is set by the session-run stages ahead
A change session's floor SHALL be the strongest model among its change's current stage and the
session-run stages of its script still ahead, that stage included. The session-run stages SHALL be
the grill, the owner's approval, the review, the delivery and the retro, the stages a change
session performs itself; every other stage runs as a stage subagent, so the table's Haiku rows
reach a change session only when no session-run stage ahead needs more.

#### Scenario: The default table never steps a session to Haiku
- **WHEN** no `models:` table is set and a change session goes through every stage of its change
- **THEN** no switch to `haiku` is ever returned for it, and its unit tests and delivery hand-offs carry `haiku`

### Requirement: A stage above the session's model never switches it
A stage whose model is above the change session's recorded model SHALL NOT switch the session: a
stage that runs as a stage subagent SHALL be handed on its own model, and a session-run stage SHALL
be performed on the session's model.

#### Scenario: A stage above the session's model
- **WHEN** `a`'s session is recorded on `sonnet` and `a` is at the design stage, whose model is `opus`
- **THEN** no switch is returned; `a`'s own loop hands the design stage to its agent on `opus`

#### Scenario: A session-run stage above the session's model
- **WHEN** `a` was resumed at its implementation, its session is recorded on `sonnet`, the project's table holds `retro: opus`, and `a` reaches its retro
- **THEN** no switch is returned, and the session performs the retro on `sonnet`

## MODIFIED Requirements

### Requirement: A blocked change keeps its place
A blocked change SHALL keep its place; the session SHALL say so once with the reason, the other
changes SHALL go on, and the changes whose `after:` names it SHALL wait.

#### Scenario: A stage fails
- **WHEN** a change's stage agent reports a failure on Opus, or its retry on the next model up fails too, in a run with two places
- **THEN** one line says the change stopped and why, the other open change goes on, and no new change takes its place

#### Scenario: A change that cannot be opened
- **WHEN** a ready line's change cannot be opened because its name is already taken by a branch
- **THEN** one line says it could not be opened, it fills its place as blocked, and its dependents wait

#### Scenario: A change stops while nothing else runs
- **WHEN** a change stops and no other change of the run is under way
- **THEN** its line says the change stopped, why, and that the changes after it wait, and does not say that the others go on
