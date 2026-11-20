# change-stages Specification

## Purpose
Declares every stage of a devkit change in its schema, gives each stage file a fixed header, and
lets a checker without AI say from those headers which stage passed and which comes next.

## Requirements

### Requirement: The devkit schema declares every stage that leaves a file
The `devkit` schema SHALL declare, as OpenSpec artifacts and in this order, `requirements`,
`mockup`, `decisions`, `proposal`, `specs`, `design`, `tasks`, `readiness`, `approval`,
`unit-tests`, `e2e-tests`, `evidence`, `review` and `retro`, and `apply` SHALL require `approval`.

#### Scenario: A new devkit change lists every stage in order
- **WHEN** a change is created with the shipped `devkit` schema and `openspec status --change <id> --json` is read
- **THEN** its `artifacts` ids are exactly that list, in that order, and `applyRequires` is `["approval"]`

### Requirement: The short script keeps the grill and has no separate plan approval
The `devkit-lite` schema SHALL declare, in this order, `requirements`, `mockup`, `decisions`,
`proposal`, `specs`, `tasks`, `unit-tests`, `e2e-tests`, `evidence`, `review` and `retro`, and SHALL
declare no `design`, `readiness` or `approval` artifact.

#### Scenario: A new devkit-lite change lists the short script
- **WHEN** a change is created with the shipped `devkit-lite` schema and its status is read as JSON
- **THEN** its `artifacts` ids are exactly that list, in that order, and none is `readiness` or `approval`

### Requirement: Each schema declares its stages with roles, not tools
Each schema folder SHALL hold a stage declaration (`flow.json`) listing every stage in order, with
its role, skills and attempt ceiling, including the stages that leave no file of their own (opening
the change, the implementation, the delivery). No instruction, template or declaration of either
schema SHALL name a tool of one platform or a `devkit-core:` agent type.

#### Scenario: The declaration matches the schema
- **WHEN** the stage declaration of a schema is read next to `openspec status` for a new change of that schema
- **THEN** its stages with a file are the status artifacts, in the same order, with the same file names

#### Scenario: One document lists every role
- **WHEN** every role and helper named in both stage declarations is looked up in the role document
- **THEN** each has a section saying what it does, what it delivers and what it never does

#### Scenario: No platform tool is named
- **WHEN** every instruction, template and declaration of both schemas is searched for `devkit-core:`, `subagent_type`, `Agent tool`, `AskUserQuestion`, `Workflow tool` and `Claude`
- **THEN** none of them is found

### Requirement: Every stage file opens with the stage header
Every template of both schemas SHALL start with one line of the form
`<!-- devkit-stage <stage> result=<passed|failed|not-applicable|pending> attempt=<n> commit=<sha|none> -->`,
naming its own stage with `result=pending`. A written stage file SHALL keep that line first.

#### Scenario: A template ships the header
- **WHEN** the template of any stage of either schema is read
- **THEN** its first line is a stage header naming that stage, with `result=pending`

#### Scenario: A header with alternatives is not a result
- **WHEN** a file's first line is not a well-formed stage header
- **THEN** the checker reports the stage as pending with the reason that its file has no stage header

### Requirement: Today's flow reads a change written with the header
A stage header SHALL change no step that `deliver-check`, `conduct-check` and the hooks give for the
same change: they ignore the header line.

#### Scenario: deliver-check gives the same step
- **WHEN** `deliver-check` runs over a change folder twice, once with and once without a stage header on every stage file
- **THEN** both runs give the same `next.step`

#### Scenario: The readiness gate is unchanged
- **WHEN** `readiness.md` starts with a stage header and says `- Status: NEEDS-REVISION`
- **THEN** a product code edit is still refused

### Requirement: The checker reports each stage from headers and facts, never prose
For a change, the checker SHALL report each declared stage as passed, failed, not applicable,
stale, pending or blocked, reading stage headers, OpenSpec's JSON, git and, for the delivery,
GitHub; it SHALL read no sentence of a stage file.

#### Scenario: A failed header does not pass its stage
- **WHEN** a stage file's header says `result=failed`
- **THEN** that stage is reported failed and no later stage is offered

#### Scenario: Not applicable counts as passed
- **WHEN** a stage file's header says `result=not-applicable`
- **THEN** the next stage is offered as if that stage had passed

#### Scenario: A stage whose role does not ship yet
- **WHEN** a declared stage's role is marked as not shipped and its file does not exist
- **THEN** the stage is reported as not applying, with the reason that nobody runs it yet

### Requirement: A failed stage offers its fix, then itself
A failed stage below its attempt ceiling SHALL offer its declared fix stage (`onFail`, or itself
when it declares none) while nothing changed since the failure, and SHALL offer itself again once
the fix changed its inputs, until its attempt ceiling is reached.

#### Scenario: A failed stage offers its fix stage first
- **WHEN** the code review's header says `result=failed attempt=1`, its ceiling is 2, its declared fix stage is the implementation, and no product commit came after its header commit
- **THEN** the next stage is the implementation, with the reason that the review failed at attempt 1 of 2 and the fix comes first

#### Scenario: After the fix the failed stage runs again
- **WHEN** the same failed review's header commit is behind a later commit that changes product code
- **THEN** the review is still reported failed and the next stage is the review itself, with the reason that the work changed since the failure

### Requirement: No stage after the implementation while a task is pending
The checker SHALL offer no stage after the implementation while `tasks.md` has an unticked task.
A checkbox line inside a fenced block of `tasks.md` SHALL NOT count as a task.

#### Scenario: A pending task holds the later stages
- **WHEN** one task of `tasks.md` is unticked and every stage before the implementation passed
- **THEN** the next stage is the implementation and every later stage is blocked

#### Scenario: A fenced example is not a task
- **WHEN** the only unticked checkbox line of `tasks.md` sits inside a fenced block
- **THEN** the implementation is reported passed

### Requirement: A stale stage runs again alone
A stage after the implementation whose header commit is behind a later commit that changes product
code SHALL be reported stale and offered again, and a later stage that is still current SHALL NOT
be offered again.

#### Scenario: Only the stale stage is offered
- **WHEN** the demonstration's header commit is behind a product commit and the review's header commit is that product commit
- **THEN** the demonstration is reported stale and is the next stage, and the review is reported passed

### Requirement: A plan stage is stale after a plan file changes, until the work starts
A stage that declares `staleAfter` stages (the plan readiness after the proposal, specs, design
and tasks; the owner's approval after the readiness) SHALL be reported stale when a file of one of
those stages is newer than its own file by more than two seconds. This check SHALL NOT apply once
any task of `tasks.md` is ticked (the implementer ticks tasks, which changes `tasks.md`), nor in the
walk after a merged pull request.

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

### Requirement: Attempt ceilings and no progress stop the run
A failed stage whose header attempt reaches its declared ceiling SHALL end the run as blocked with
that reason. Given the previous run's progress key, the checker SHALL end the run as blocked when the
same stage comes back and nothing in the working tree or history changed.

#### Scenario: The ceiling is reached
- **WHEN** the review's header says `result=failed attempt=2` and its ceiling is 2
- **THEN** the run ends blocked, naming the review and its ceiling

#### Scenario: The same stage comes back with nothing changed
- **WHEN** the checker is run with `--after` set to the progress key it printed last and nothing changed
- **THEN** the run ends blocked, naming the stage that came back

### Requirement: Every run ends in one of four states or names the next stage
Each checker run SHALL give either one next stage with its role and the reason, or one end state
among archived, waiting for the owner, waiting on GitHub and blocked, with its reason; never both
and never neither, except for a change begun under the previous script.

#### Scenario: The owner's approval is awaited
- **WHEN** every stage up to the readiness passed and `approval.md` does not exist
- **THEN** the run ends waiting for the owner, naming the approval stage

#### Scenario: No next stage names a role that cannot act
- **WHEN** the owner's approval is stale after a new readiness review, or a stage whose role is not shipped has a file with `result=pending`
- **THEN** the run ends waiting for the owner, and no next stage is given

#### Scenario: An archived change
- **WHEN** the change's folder is under `openspec/changes/archive/`
- **THEN** the run ends archived without asking OpenSpec for the change's status

#### Scenario: Checks are pending on the pull request
- **WHEN** every stage before the delivery passed and the change's pull request has a pending check
- **THEN** the run ends waiting on GitHub

### Requirement: The delivery follows the change's pull request
When every stage before the delivery passed, the checker SHALL decide the delivery from the
project's ship mode and the change's pull request, read with `gh` only in the `pr` and `merge`
modes, as the scenarios below state. A merged pull request SHALL pass the delivery and the walk
SHALL go on to the retro.

#### Scenario: Ship mode plan
- **WHEN** the project's ship mode is `plan`
- **THEN** the run ends waiting for the owner, who opens and merges the pull request, and nothing is read from GitHub

#### Scenario: GitHub cannot be read
- **WHEN** `gh` is missing or fails while looking for the change's pull request
- **THEN** the run ends blocked, quoting the error

#### Scenario: No pull request yet
- **WHEN** the change has no pull request
- **THEN** the next stage is the delivery, with the reason that there is no pull request yet

#### Scenario: The head is not pushed
- **WHEN** the change's open pull request is not at the local head commit
- **THEN** the next stage is the delivery, with the reason that the work must be pushed first

#### Scenario: The checks cannot be read
- **WHEN** the change's open pull request is at the local head and its checks cannot be read
- **THEN** the run ends blocked, quoting the error

#### Scenario: A check fails
- **WHEN** a check of the change's open pull request fails
- **THEN** the next stage is the implementation, with the failing checks named and linked

#### Scenario: Green checks in pr mode
- **WHEN** the ship mode is `pr` and every check of the change's open pull request passed
- **THEN** the run ends waiting for the owner, who merges the pull request

#### Scenario: Green checks in merge mode with auto-merge off
- **WHEN** the ship mode is `merge`, every check passed and auto-merge is not on
- **THEN** the next stage is the delivery, with the reason that auto-merge is not on yet

#### Scenario: Green checks in merge mode with auto-merge on
- **WHEN** the ship mode is `merge`, every check passed and auto-merge is on
- **THEN** the run ends waiting on GitHub, naming what GitHub waits for before it merges

#### Scenario: A merged pull request
- **WHEN** the change's pull request is merged and the retro has not been written
- **THEN** the delivery is reported passed and the next stage is the retro

#### Scenario: A closed pull request
- **WHEN** the change's pull request was closed without merging
- **THEN** the run ends blocked, naming the pull request

### Requirement: After a merge the walk resumes at the retro
Off the change's own branch (a default branch, the archive branch or no branch), in the `pr` and
`merge` modes, a merged pull request SHALL switch the checker to the walk after the merge, which
reports every stage before the delivery from its header alone, with no staleness check and no task
count, passes the delivery and offers the retro.

#### Scenario: Resuming at the retro after a squash merge
- **WHEN** the checkout is on the default branch, the change's pull request was squash-merged, and the header commits of the demonstration and the review are no longer in the history
- **THEN** the implementation, the demonstration, the review and the delivery are reported passed, no stage is reported stale, and the next stage is the retro

### Requirement: The readout is plain text in Portuguese or English
The checker SHALL print, for a change, each stage with its situation, then the next stage, who runs
it and why (or the end state and why), in Brazilian Portuguese or English as chosen, and the same
facts as versioned JSON with `--json`.

#### Scenario: Portuguese by default
- **WHEN** the checker runs without `--lang`
- **THEN** the text is in Brazilian Portuguese

#### Scenario: Exit codes
- **WHEN** the checker gives a next stage, ends archived or recognises the previous script; ends waiting; ends blocked; or meets a usage error
- **THEN** it exits 0; 1; 2; or 3 respectively

#### Scenario: The readout in Portuguese
- **WHEN** the checker runs with `--lang pt-BR` on a change mid-flow
- **THEN** it prints one line per stage, then `Próxima etapa:`, `Quem executa:` and `Por quê:` lines

### Requirement: The checker refuses an OpenSpec it cannot read
The checker SHALL exit 3, naming the cause, when the `openspec` command is missing, when
`openspec --version` gives no version or a major other than 2, or when OpenSpec's answer for a live
change has no `artifacts` list (or `instructions apply` has no `tasks` list); with `--json` the
cause SHALL be the `error` field of `{ "version": 1, "error": ... }`.

#### Scenario: An OpenSpec other than 2.x
- **WHEN** `openspec --version` prints `3.0.0`
- **THEN** the checker exits 3 and its message names `3.0.0`

#### Scenario: No openspec command
- **WHEN** the `openspec` command is not on the `PATH`
- **THEN** the checker exits 3 and its message says the OpenSpec CLI is not installed

#### Scenario: An OpenSpec answer without artifacts
- **WHEN** `openspec status` for a live change answers with an error body and no `artifacts` list
- **THEN** the checker exits 3 and its message, in text and under `--json`, quotes OpenSpec's message

### Requirement: A change begun under the previous script is recognised
When the change's schema has no stage declaration, or none of the change's stage files carries a
stage header, the checker SHALL say in plain text that the change began under the previous script
and that today's flow finishes it, list no stage, and exit 0.

#### Scenario: A folder in the previous form
- **WHEN** the checker runs on a change whose `requirements.md` and `proposal.md` have no stage header
- **THEN** it reports the previous script, lists no stage, offers no next stage and exits 0

### Requirement: The checker needs no AI
The checker and its readout SHALL run with Node, Git, the `openspec` CLI and, for the delivery
stage only, `gh`; its source SHALL import only Node built-ins and the pack's own hook modules.

#### Scenario: It runs with only those programs
- **WHEN** the checker runs with a `PATH` that holds only Node, Git, `openspec` and a fake `gh`
- **THEN** it gives the same report as with the full `PATH`
