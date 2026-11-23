<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The kit runs the new stages in its four shells
The kit SHALL run the decisions in its planner shell, the mock-up in its design shell, and the unit
and E2E tests in its reviewer shell, each by dispatching the devkit agent of that stage's role, and
SHALL ship no shell beyond `tech-lead`, `dev`, `qa` and `design`.

#### Scenario: A full-script change is planned
- **WHEN** the planning node plans a `devkit` change
- **THEN** the planner shell's procedure has `devkit-core:adr-author` write `decisions.md` before the proposal, and the plan approval shows the ADRs it lists

#### Scenario: A change with screens
- **WHEN** the plan declares screens and the design node runs
- **THEN** its prompt and the design shell have `devkit-core:screen-designer` draw each declared screen under the change's `mock/` folder and write `mockup.md`, besides the screen-map rows

#### Scenario: The review node
- **WHEN** the review node runs on a change
- **THEN** its prompt and the reviewer shell have `devkit-core:test-runner` write `unit-tests.md` when the project declares a unit command and `devkit-core:e2e-tester` write `e2e-tests.md` when it declares an E2E command, before the verifier and the review bench, and a red run is a blocking issue

#### Scenario: The approved plan reaches the implementer
- **WHEN** the operator approved the plan and the implement node starts
- **THEN** the implementer shell's procedure sets each ADR `decisions.md` lists to accepted and `mockup.md`'s header to passed, naming the operator's approval, before the first phase

#### Scenario: No new shell
- **WHEN** `compozy-setup` installs the kit
- **THEN** it writes exactly the four role shells it wrote before
