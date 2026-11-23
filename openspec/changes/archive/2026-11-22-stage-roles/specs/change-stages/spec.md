<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The short script keeps the grill and has no separate plan approval
The `devkit-lite` schema SHALL declare, in this order, `requirements`, `proposal`, `specs`,
`tasks`, `unit-tests`, `e2e-tests`, `evidence`, `review` and `retro`, and SHALL declare no
`mockup`, `decisions`, `design`, `readiness` or `approval` artifact.

#### Scenario: A new devkit-lite change lists the short script
- **WHEN** a change is created with the shipped `devkit-lite` schema and its status is read as JSON
- **THEN** its `artifacts` ids are exactly that list, in that order, and none is `mockup`, `decisions`, `readiness` or `approval`

#### Scenario: The short script's declaration matches
- **WHEN** the stage declaration of `devkit-lite` is read
- **THEN** it declares no `mockup` and no `decisions` stage, and it declares `unit-tests` and `e2e-tests`

### Requirement: The checker reports each stage from headers and facts, never prose
For a change, the checker SHALL report each declared stage as passed, failed, not applicable,
stale, pending or blocked, reading stage headers, OpenSpec's JSON, git, the project's `devkit:`
settings, the flags of the grill's `Classification:` line in `requirements.md` and, for the
delivery, GitHub; it SHALL read no other sentence of a stage file.

#### Scenario: A failed header does not pass its stage
- **WHEN** a stage file's header says `result=failed`
- **THEN** that stage is reported failed and no later stage is offered

#### Scenario: Not applicable counts as passed
- **WHEN** a stage file's header says `result=not-applicable`
- **THEN** the next stage is offered as if that stage had passed

#### Scenario: A stage whose role does not ship yet
- **WHEN** a declared stage's role is marked as not shipped and its file does not exist
- **THEN** the stage is reported as not applying, with the reason that nobody runs it yet

#### Scenario: The classification flags are read from one line
- **WHEN** `requirements.md` holds `Classification: domain=process type=feature flags=[ui, contract] (confirmed)`
- **THEN** the checker reads the flags `ui` and `contract`, and no other line of the file changes its report

### Requirement: A plan stage is stale after a plan file changes, until the work starts
A stage that declares `staleAfter` stages (the plan readiness after the mock-up, the decisions, the
proposal, specs, design and tasks; the owner's approval after the readiness) SHALL be reported
stale when a file of one of those stages is newer than its own file by more than two seconds. This
check SHALL NOT apply once any task of `tasks.md` is ticked (the implementer ticks tasks, which
changes `tasks.md`), nor in the walk after a merged pull request.

#### Scenario: A plan file edited after the readiness review
- **WHEN** no task is ticked and `design.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the design, and it is the next stage

#### Scenario: A plan file within the tolerance
- **WHEN** no task is ticked and `design.md` is newer than `readiness.md` by less than two seconds
- **THEN** the plan readiness is reported passed

#### Scenario: Ticking a task does not make the plan stale
- **WHEN** one task of `tasks.md` is ticked, others are pending, and `tasks.md` is newer than `readiness.md`
- **THEN** the plan readiness is reported passed and the next stage is the implementation

#### Scenario: No plan staleness after the merge
- **WHEN** the checker runs the walk after a merged pull request
- **THEN** no stage is reported stale by a newer plan file

#### Scenario: The decisions changed after the readiness review
- **WHEN** no task is ticked and `decisions.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the decisions, and it is the next stage

#### Scenario: The mock-up changed after the readiness review
- **WHEN** no task is ticked and `mockup.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the mock-up, and it is the next stage

### Requirement: Every shipped stage agent declares its stage's skills
For every stage of both stage declarations whose role is shipped and has an agent file, the agent's
`skills` list SHALL equal the skills the declaration lists for that role's stages. Only the roles
played by the session, the review skill and the owner SHALL have no agent file.

#### Scenario: The declarations match
- **WHEN** the agents of `plan-readiness-reviewer`, `tdd-implementer`, `commit-and-pr`, `change-planner`, `pr-verifier`, `screen-designer`, `adr-author`, `test-runner` and `e2e-tester` are compared with both stage declarations
- **THEN** each agent's skills, a plugin prefix removed, equal its stage's skills (none for the planner and the verifier; `screen-mockup` for the screen designer; `adr-authoring` for the ADR author; `test-and-coverage` and `systematic-debugging` for the test runner; `e2e-testing` for the E2E tester)

#### Scenario: A difference
- **WHEN** an agent's skills lack one its stage lists, or list one it does not
- **THEN** the comparison fails and names the agent and the skill

#### Scenario: A role without wiring
- **WHEN** a shipped role other than `change-coordinator`, `review-bench` and `owner` has no agent file
- **THEN** the comparison fails and names the role

#### Scenario: A role still marked unshipped
- **WHEN** a role the declaration marks `"shipped": false` has an agent file
- **THEN** the comparison fails and asks for the role to be marked shipped and wired

## ADDED Requirements

### Requirement: Every declared stage has a role that ships
No stage of the `devkit` or `devkit-lite` declaration SHALL be marked `"shipped": false`; every
role a stage names SHALL be played by an agent of a devkit pack, by the session or by the owner.

#### Scenario: The shipped declarations
- **WHEN** both stage declarations are read
- **THEN** no stage carries `shipped`, and the `mockup`, `decisions`, `unit-tests` and `e2e-tests` stages name `screen-designer`, `adr-author`, `test-runner` and `e2e-tester`

### Requirement: A conditional stage applies only when its condition holds
A stage that declares `appliesWhen` SHALL be reported not applicable, with the condition named in
the reason, when its file does not exist and its condition does not hold: a `flag` condition holds
when the grill's classification lists that flag; a `setting` condition holds when the project's
`devkit:` block declares that setting with a value. A stage whose file exists SHALL be read from its
header, whatever its condition.

#### Scenario: A change that touches no screen
- **WHEN** a `devkit` change's classification has no `ui` flag and it has no `mockup.md`
- **THEN** the mock-up is reported not applicable, the reason says the classification has no `ui` flag, and the next stage is the decisions

#### Scenario: A change that touches a screen
- **WHEN** a `devkit` change's classification lists `ui` and it has no `mockup.md`
- **THEN** the mock-up is the next stage, for the role `screen-designer`

#### Scenario: A grill skipped by the owner
- **WHEN** `requirements.md` holds no `Classification:` line
- **THEN** the classification has no flag and the mock-up is reported not applicable

#### Scenario: No E2E command declared
- **WHEN** every stage before the E2E tests passed, `openspec/config.yaml` declares no `devkit.tests.e2e` and there is no `e2e-tests.md`
- **THEN** the E2E tests are reported not applicable, the reason names the missing setting, and the next stage is the demonstration

#### Scenario: No unit command declared
- **WHEN** every stage before the unit tests passed, `openspec/config.yaml` declares `devkit.tests.e2e` but no `devkit.tests.unit`, and there is no `unit-tests.md`
- **THEN** the unit tests are reported not applicable, the reason names the missing setting, and the next stage is the E2E tests

#### Scenario: A file written without the condition
- **WHEN** a change with no `ui` flag has a `mockup.md` whose header says `result=passed`
- **THEN** the mock-up is reported passed

### Requirement: A stage that arrived after the change passed its point does not send it back
A stage that declares `notAfter` SHALL be reported not applicable, with the reason that the change
was already past that stage, when its own file does not exist and a file of the named later stage
exists. A stage whose own file exists SHALL be read from its header.

#### Scenario: A full-script change planned before the upgrade
- **WHEN** a `devkit` change whose classification lists `ui` has `proposal.md` and neither `mockup.md` nor `decisions.md`
- **THEN** the mock-up and the decisions are reported not applicable, naming the proposal, and neither is offered

#### Scenario: A change demonstrated before the upgrade
- **WHEN** a change has `evidence.md`, the project declares `devkit.tests.unit` and `devkit.tests.e2e`, and the change has neither `unit-tests.md` nor `e2e-tests.md`
- **THEN** the unit tests and the E2E tests are reported not applicable, naming the demonstration, and neither is offered

#### Scenario: A change not past the point
- **WHEN** a `devkit` change has `requirements.md` passed and no `proposal.md` and no `decisions.md`
- **THEN** the decisions are the next stage

### Requirement: The owner ends the mock-up's attempts
A stage that declares the ceiling `owner` SHALL have no attempt ceiling: each failed header SHALL
offer the stage itself again, with the reason that the owner asked for changes at that attempt,
and SHALL never end the run blocked by a ceiling; the no-progress rule SHALL still apply.

#### Scenario: The owner asked for changes three times
- **WHEN** `mockup.md`'s header says `result=failed attempt=3` and the mock-up declares the ceiling `owner`
- **THEN** the mock-up is the next stage, for `screen-designer`, with the reason that the owner asked for changes at attempt 3, and the run is not blocked

#### Scenario: A drawn mock-up waits for the owner
- **WHEN** `mockup.md`'s header says `result=pending`
- **THEN** the run ends waiting for the owner at the mock-up and no next stage is given

#### Scenario: The readout of a mock-up the owner sent back
- **WHEN** the checker prints the mock-up whose header says `result=failed attempt=2`
- **THEN** its line says the owner asked for changes at attempt 2, in the chosen language, and names no ceiling
