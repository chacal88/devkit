<!-- devkit-stage specs result=passed attempt=3 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: From the implementation on, the step inside the stage goes to its role
From the implementation to the archive, the loop SHALL take the stage from the stage checker and the
step inside it from the delivery checker, with the two overrides the retired `/conduct` applied and `/devkit change` keeps (a release-file
conflict, a branch the loop rebased), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win. The unit tests and the E2E tests, which the delivery checker does
not know, SHALL be taken from the stage checker alone.

#### Scenario: Implementation and fixes
- **WHEN** the delivery checker's step is `implement`, `fix-review`, `fix-defect`, `fix-checks` or `apply-proposals`
- **THEN** the next action hands it to the implementer's agent

#### Scenario: The agent of a delivery step comes from the checker's row
- **WHEN** the row the delivery checker returns for a step the loop hands to an agent names that step's agent
- **THEN** the next action's agent is the one the row names

#### Scenario: Commits and pull requests
- **WHEN** the step is `commit`, `open-pr`, `push` or `open-archive-pr`
- **THEN** the next action hands it to the commit-and-pr agent

#### Scenario: A conflict only in release files
- **WHEN** the change's or the archive's pull request conflicts with its base only in release files (versions, changelog, catalog, the CI pin)
- **THEN** the next action hands `resolve-release-conflict` to the implementer's agent with the release rebase command and the conflicting paths

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the pull request's head is no longer an ancestor of the local head but the branch held it before a rebase
- **THEN** the next action hands `push-rebased` to the commit-and-pr agent with the old head for a force-with-lease push

#### Scenario: A conflict in any other file
- **WHEN** the pull request conflicts with its base in a file that is not a release file
- **THEN** the run ends blocked, saying the pull request has a problem the session cannot fix alone

#### Scenario: GitHub reports a conflict the base merges cleanly
- **WHEN** GitHub reports a conflict, the base merges cleanly with the local head, and the project merges automatically
- **THEN** the next action is the session step `update-branch`

#### Scenario: The demonstration
- **WHEN** the step is `verify`
- **THEN** the next action hands it to the verifier's agent

#### Scenario: The code review
- **WHEN** the step is `review`
- **THEN** the next action is a session step that runs the review skill and sets the review file's stage header

#### Scenario: A phase gate
- **WHEN** the step is `gate`
- **THEN** the next action is a session step carrying the gate's command and task; a green run ticks the task and a red run ends the run blocked, saying the phase's tests failed

#### Scenario: A pull-request or archive step of the session
- **WHEN** the step is `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `answer`, `retro`, `archive` or `tick-roadmap`
- **THEN** the next action is a session step naming it, done as the shipping skill's row for that step says

#### Scenario: A question on the pull request only the owner can answer
- **WHEN** the session's answer step finds a decision only the owner can take
- **THEN** the run ends waiting for the owner, with a reply naming the comment's link

#### Scenario: A step this version does not know
- **WHEN** the delivery checker returns a step the loop has no row for
- **THEN** the run ends blocked, saying the next step is unknown

#### Scenario: The loop's rows match what the checkers return
- **WHEN** the loop's rows are compared with every step the delivery checker and the two overrides can return
- **THEN** every returnable step has a row and no row names a step that no checker returns

#### Scenario: The loop and the checker name the same agent for each step
- **WHEN** the loop's own step-to-agent rows are compared with the delivery checker's step-to-agent mapping for every step both name as a hand-off to an agent
- **THEN** both name the same agent, and the one step the checker gives to an agent that the loop runs in the session, the retro, is the only one left out

#### Scenario: The delivery checker cannot read the change
- **WHEN** the delivery checker fails with a usage or settings error
- **THEN** the run ends blocked, saying the change cannot be read, and the command exits 3

#### Scenario: The unit tests are next
- **WHEN** the stage checker's next stage is the unit tests, missing, stale or offered again after a fix
- **THEN** the next action hands the stage to `devkit-core:test-runner`, its detail carrying the declared unit command, coverage command and coverage target, whatever step the delivery checker would give

#### Scenario: The E2E tests are next
- **WHEN** the stage checker's next stage is the E2E tests
- **THEN** the next action hands the stage to `devkit-core:e2e-tester`, its detail carrying the declared E2E command

#### Scenario: A red test stage goes back to the implementer
- **WHEN** the stage checker's next stage is the implementation because the unit tests or the E2E tests failed below their ceiling and nothing changed since
- **THEN** the next action hands the step `fix-tests` to the implementer's agent, its detail naming the failed stage and its file

## ADDED Requirements

### Requirement: The mock-up and the decisions go to their roles
Before the plan, the loop SHALL hand the mock-up to `devkit-core:screen-designer` and the decisions
to `devkit-core:adr-author` when the stage checker offers them, each with a brief that names the
stage's own instructions, and SHALL hand nothing for a stage the checker reports not applicable.

#### Scenario: The decisions of a full-script change
- **WHEN** the requirements of a `devkit` change passed and it has no `decisions.md`
- **THEN** the next action hands the decisions to `devkit-core:adr-author`, after the mock-up when the mock-up applies

#### Scenario: A change with a screen
- **WHEN** the requirements of a `devkit` change passed, its classification lists `ui`, and it has no `mockup.md`
- **THEN** the next action hands the mock-up to `devkit-core:screen-designer`

#### Scenario: A change with no screen
- **WHEN** the classification of a `devkit` change has no `ui` flag
- **THEN** no action hands the mock-up to any agent

### Requirement: The mock-up waits for the owner's answer
When the drawn mock-up waits for the owner, the run SHALL end waiting for the owner with a reply
asking to approve it or say what to change, and a detail naming its folder. An answer recorded as
changes SHALL make the next action hand the mock-up to its agent again as a new attempt, naming the
owner's notes; an answer recorded as approval SHALL let the walk go on.

#### Scenario: The mock-up is drawn
- **WHEN** `mockup.md`'s header says `result=pending`
- **THEN** the run ends waiting for the owner with the mock-up reply, its detail names the change's `mock/` folder and `mockup.md`, and the exit code is 1

#### Scenario: The owner asks for changes
- **WHEN** the owner's answer was recorded as changes (`mockup.md`'s header `result=failed attempt=1`, the owner's notes appended)
- **THEN** the next action hands the mock-up to `devkit-core:screen-designer`, its brief saying the owner asked for changes at attempt 1 and the notes are in `mockup.md`

#### Scenario: The owner approves
- **WHEN** the owner's answer was recorded as approval (`mockup.md`'s header `result=passed`)
- **THEN** the next stage is offered as for any passed stage

### Requirement: Approved decisions are accepted before the implementation
When the owner's plan approval is current and `decisions.md` lists an ADR whose status is still
proposed, and the change is not being archived, the next action SHALL be the session step
`accept-decisions` carrying the command that sets every listed ADR to accepted; that command SHALL
refuse, changing nothing, while the approval is not current.

#### Scenario: The plan was just approved
- **WHEN** `approval.md` is current for `readiness.md` and `decisions.md` lists two ADRs with status proposed
- **THEN** the next action is the session step `accept-decisions`, whose command, run, sets both to accepted with the approval's date and the change's id, and the next call offers the implementation

#### Scenario: The plan is under revision
- **WHEN** `decisions.md` lists an ADR with status proposed and `approval.md` is missing or for an earlier `readiness.md`
- **THEN** no action is `accept-decisions`, and the command, run by hand, exits 3 naming the missing approval and leaves the ADR proposed

#### Scenario: A record the command cannot set
- **WHEN** a listed ADR has no status line, or lies outside a folder named `adr`, `adrs` or `decisions`
- **THEN** the command exits 3 naming the file and changes no file

#### Scenario: A listed record the loop cannot read
- **WHEN** `approval.md` is current for `readiness.md` and `decisions.md` lists an ADR that has no status line, or that lies outside a folder named `adr`, `adrs` or `decisions`, and no ADR with status proposed
- **THEN** the next action is still the session step `accept-decisions`, its records name that ADR, and its command, run, exits 3 naming that file and changes no file

#### Scenario: Nothing left to accept
- **WHEN** every ADR `decisions.md` lists can be read and already says accepted, or `decisions.md` lists none
- **THEN** no action is `accept-decisions`

#### Scenario: The change is being archived
- **WHEN** the session is on the change's archive branch (`chore/archive-<id>`), `approval.md` is current for `readiness.md` and `decisions.md` lists an ADR with status proposed
- **THEN** no action is `accept-decisions`, and the loop goes on to the archive steps

### Requirement: The test settings are read from the devkit block
The loop and the checker SHALL read `devkit.tests.unit`, `devkit.tests.coverage.command`,
`devkit.tests.coverage.target` and `devkit.tests.e2e` from the nested `devkit:` block of
`openspec/config.yaml`. A coverage target that is not a whole number from 0 to 100 SHALL stop the
command like any unknown setting value.

#### Scenario: The nested block
- **WHEN** the block holds `tests:` with `unit: "npm test"`, `coverage:` with `command: "npm run cov"` and `target: 80`, and `e2e: "npm run e2e"`
- **THEN** the four values are read, and `driver` and `language` are read as before

#### Scenario: A target that is not a whole number
- **WHEN** `devkit.tests.coverage.target` is `80%`
- **THEN** `/devkit change` replies that the coverage target has an unknown value, names the accepted values, and nothing is created or run
