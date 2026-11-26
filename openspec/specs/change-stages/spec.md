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
The `devkit-lite` schema SHALL declare, in this order, `requirements`, `proposal`, `specs`,
`tasks`, `unit-tests`, `e2e-tests`, `evidence`, `review` and `retro`, and SHALL declare no
`mockup`, `decisions`, `design`, `readiness` or `approval` artifact.

#### Scenario: A new devkit-lite change lists the short script
- **WHEN** a change is created with the shipped `devkit-lite` schema and its status is read as JSON
- **THEN** its `artifacts` ids are exactly that list, in that order, and none is `mockup`, `decisions`, `readiness` or `approval`

#### Scenario: The short script's declaration matches
- **WHEN** the stage declaration of `devkit-lite` is read
- **THEN** it declares no `mockup` and no `decisions` stage, and it declares `unit-tests` and `e2e-tests`

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

### Requirement: A failed stage offers its fix, then itself
A failed stage below its attempt ceiling SHALL offer its declared fix stage (`onFail`, or itself
when it declares none) while nothing changed since the failure, and SHALL offer itself again once
the fix changed its inputs, until its attempt ceiling is reached. The reason SHALL name the
attempt, the failures in a row and the ceiling.

#### Scenario: A failed stage offers its fix stage first
- **WHEN** the code review's header says `result=failed attempt=1`, its ceiling is 2, its declared fix stage is the implementation, and no product commit came after its header commit
- **THEN** the next stage is the implementation, with the reason that the review failed at attempt 1, one failure in a row of a ceiling of 2, and the fix comes first

#### Scenario: After the fix the failed stage runs again
- **WHEN** the same failed review's header commit is behind a later commit that changes product code
- **THEN** the review is still reported failed and the next stage is the review itself, with the reason that the work changed since the failure

#### Scenario: A failure after passed takes is offered its fix
- **WHEN** the evidence's header says `result=failed attempt=3`, its ceiling is 3, and its file was committed with `result=passed` at attempts 1 and 2
- **THEN** the next stage is the evidence's fix stage, with the reason that the evidence failed at attempt 3, one failure in a row of a ceiling of 3, and the run is not blocked

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
be offered again. Whether a later commit changes product code SHALL be judged by the delivery
checker's rule (`change-delivery`), so a merge of the base that brings none of the change's own
files does not make a stage stale.

#### Scenario: Only the stale stage is offered
- **WHEN** the demonstration's header commit is behind a product commit and the review's header commit is that product commit
- **THEN** the demonstration is reported stale and is the next stage, and the review is reported passed

#### Scenario: A merge of the base that brings no own file
- **WHEN** the unit-tests, evidence and review headers record commit R, and the only later commit is a merge of `origin/<base>` that brings product files the branch did not change
- **THEN** those stages are reported passed and none of them is offered again

#### Scenario: A merge of the base that brings an own file
- **WHEN** the same merge also brings a change to a product file the branch changed
- **THEN** the first of those stages is reported stale with the reason code `stale-code` naming the merge commit and that file, and it is the next stage

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

### Requirement: Attempt ceilings and no progress stop the run
A failed stage whose failures in a row reach its ceiling SHALL end the run as blocked with that
reason, naming the attempt, the failures in a row and the ceiling. A stage's ceiling SHALL be the one
the flow version the change follows declares, except the code review stage (`review`, role
`review-bench`), whose ceiling SHALL be that declared ceiling plus the number of code-review rounds
the session recorded as authorized by the owner in the change's record of declared steps. A round
authorized for a conflict resolution's review, a record that cannot be read, and any other stage or
review stage SHALL NOT change a ceiling. Given the previous run's progress key, the checker SHALL end
the run as blocked when the same stage comes back and nothing in the working tree or history changed.

#### Scenario: The ceiling is reached
- **WHEN** the review's header says `result=failed attempt=2`, its file was committed with `result=failed` at attempt 1, and its ceiling is 2
- **THEN** the run ends blocked, naming the review, its two failures in a row and its ceiling

#### Scenario: Three failures in a row block a stage with a ceiling of three
- **WHEN** the evidence's header says `result=failed attempt=3`, its file was committed with `result=failed` at attempts 1 and 2, and its ceiling is 3
- **THEN** the run ends blocked with `ceiling-reached`, as before this rule

#### Scenario: The same stage comes back with nothing changed
- **WHEN** the checker is run with `--after` set to the progress key it printed last and nothing changed
- **THEN** the run ends blocked, naming the stage that came back

#### Scenario: One round authorized for the code review
- **WHEN** the review's header says `result=failed attempt=2` with two failures in a row, its declared ceiling is 2, and one code-review round is recorded as authorized
- **THEN** the run does not end; the checker offers the review's fix stage with the ceiling 3, or the review again once a commit made its header stale

#### Scenario: The authorized round failed too
- **WHEN** the review's header says `result=failed attempt=3` with three failures in a row, its declared ceiling is 2, and one code-review round is recorded as authorized
- **THEN** the run ends blocked, naming the review, its three failures in a row and its ceiling 3

#### Scenario: A pass before the failures
- **WHEN** the review's file was committed with `result=passed`, then with `result=failed attempt=1`, its header now says `result=failed attempt=2`, its declared ceiling is 2, and one code-review round is recorded as authorized
- **THEN** its two failures in a row are below the ceiling 3 and the checker offers the review's fix stage

#### Scenario: Two rounds authorized
- **WHEN** two code-review rounds are recorded as authorized and the review's header says `result=failed attempt=3` with three failures in a row
- **THEN** the run does not end; at `result=failed attempt=4` with four failures in a row it ends blocked with the ceiling 4

#### Scenario: A round authorized for the resolution's review only
- **WHEN** only a round for a conflict resolution's review is recorded and the review's header says `result=failed attempt=2` with two failures in a row and a declared ceiling of 2
- **THEN** the run ends blocked, naming the review and its ceiling 2

#### Scenario: Other stages keep their ceiling
- **WHEN** one code-review round is recorded as authorized and the plan readiness or the evidence says `result=failed attempt=3` with three failures in a row and a declared ceiling of 3
- **THEN** the run ends blocked at that stage's ceiling 3

#### Scenario: A review stage of another role
- **WHEN** a script's `review` stage has a role other than `review-bench` (the ADR review of a project), its header says `result=failed attempt=2` with two failures in a row, its ceiling is 2, and a code-review round is recorded as authorized
- **THEN** the run ends blocked at the ceiling 2

#### Scenario: The flow version's own ceiling is the base
- **WHEN** a change follows a flow version whose code review ceiling is 1, one code-review round is recorded as authorized, and the review's header says `result=failed attempt=1`
- **THEN** the run does not end, and at `result=failed attempt=2` with two failures in a row it ends blocked with the ceiling 2

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
SHALL go on to the retro only when the change is delivered: the pull request is the change's own
and every task of its `tasks.md` on the default branch is ticked.

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
- **WHEN** the change's open pull request is at the local head and its checks cannot be read for any reason other than a `gh` too old to read them
- **THEN** the run ends blocked, quoting the error

#### Scenario: A gh too old to read the checks
- **WHEN** the change's open pull request is at the local head and `gh pr checks` fails because the installed `gh` does not know its `--json` or `--required` option, `gh --version` printing `gh version 2.46.0 (2024-03-18)`
- **THEN** the run ends blocked with the reason `gh-too-old`, whose readout in English and in Brazilian Portuguese names the installed version `2.46.0` and `2.50.0`, the first version that reads the checks, says to update `gh`, and does not say the checks cannot be read

#### Scenario: A gh too old whose version cannot be read
- **WHEN** the same failure happens and `gh --version` fails or prints a first line that is not `gh version <major>.<minor>.<patch>`
- **THEN** the run ends blocked with the reason `gh-too-old`, its readout giving the installed version as unknown and naming `2.50.0`

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
- **WHEN** the change's own pull request is merged, every task of its `tasks.md` on the default branch is ticked, and the retro has not been written
- **THEN** the delivery is reported passed and the next stage is the retro

#### Scenario: A merged pull request with tasks left
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has unticked tasks
- **THEN** the delivery is not passed and the next stage is the implementation, naming the pull request and the tasks left

#### Scenario: A closed pull request
- **WHEN** the change's pull request was closed without merging
- **THEN** the run ends blocked, naming the pull request

### Requirement: After a merge the walk resumes at the retro
Off the change's own branch (a default branch, the archive branch or no branch), or on its own
branch when that branch's head is contained in `origin/<base>` (the branch was advanced into the
base after the merge), in the `pr` and `merge` modes, a merged pull request of a delivered change
(its own pull request, every task ticked on the default branch) SHALL switch the checker to the
walk after the merge, which reports
every stage before the delivery from its header alone, with no staleness check and no task count,
passes the delivery and offers the retro. A merged pull request of a change that is not delivered
SHALL NOT switch it.

#### Scenario: Resuming at the retro after a squash merge
- **WHEN** the checkout is on the default branch, the change's own pull request was squash-merged with every task ticked, and the header commits of the demonstration and the review are no longer in the history
- **THEN** the implementation, the demonstration, the review and the delivery are reported passed, no stage is reported stale, and the next stage is the retro

#### Scenario: A pull request that only links the evidence
- **WHEN** the checkout is on the default branch and the only merged pull request naming the change links its evidence without changing a file of the change's folder
- **THEN** the checker does not switch to the walk after the merge and offers no retro

#### Scenario: The own branch advanced into the base after a delivery
- **WHEN** the change was delivered by its merged pull request, its own branch was fast-forwarded to `origin/main`, and `origin/main` holds a commit touching `src/a.ts` after the reviewed head
- **THEN** no stage is reported stale, no review or evidence is asked again, and the next stage is the retro

#### Scenario: The own branch still ahead of the base
- **WHEN** the change was delivered and its own branch holds a commit touching `src/a.ts` that the base does not hold, after the reviewed head
- **THEN** the checker does not switch to the walk after the merge, and the stages that commit makes stale are reported stale, as before

#### Scenario: Advanced but not delivered
- **WHEN** the change's own branch was advanced into the base and a task is still unticked on the default branch
- **THEN** the checker does not switch to the walk after the merge

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
cause SHALL be the `error` field of `{ "version": 1, "error": ... }`. The command SHALL be the
project's pinned OpenSpec CLI when the project pins one, and the cause SHALL name where the
refused CLI was found.

#### Scenario: An OpenSpec other than 2.x
- **WHEN** `openspec --version` prints `3.0.0`
- **THEN** the checker exits 3 and its message names `3.0.0`

#### Scenario: No openspec command
- **WHEN** the `openspec` command is not on the `PATH` and the project pins none
- **THEN** the checker exits 3 and its message says the OpenSpec CLI is not installed

#### Scenario: An OpenSpec answer without artifacts
- **WHEN** `openspec status` for a live change answers with an error body and no `artifacts` list
- **THEN** the checker exits 3 and its message, in text and under `--json`, quotes OpenSpec's message

#### Scenario: A pinned OpenSpec other than 2.x
- **WHEN** the project's `node_modules/.bin/openspec` prints `1.16.0` and the `PATH` holds a 2.x `openspec`
- **THEN** the checker exits 3, its message names `1.16.0`, the path of the project's CLI and the move of the pin to 2.x, and the `PATH` one is never started

### Requirement: A change begun under the previous script is recognised
When the change's schema has no stage declaration, or the earliest stage file the change has, in
the order its declaration lists, carries no stage header, the checker SHALL say in plain text that
the change began under the previous script and that today's flow finishes it, list no stage, and
exit 0. A header on a later stage file SHALL NOT change that reading.

#### Scenario: A folder in the previous form
- **WHEN** the checker runs on a change whose `requirements.md` and `proposal.md` have no stage header
- **THEN** it reports the previous script, lists no stage, offers no next stage and exits 0

#### Scenario: A later file gains a header
- **WHEN** a change whose `proposal.md`, `design.md` and `tasks.md` carry no stage header gains an `evidence.md`, a `readiness.md` or a review file with one
- **THEN** the checker still reports the previous script

#### Scenario: A change opened on the current script
- **WHEN** the change's `requirements.md` carries a stage header and its `proposal.md` has none
- **THEN** the checker reads the current script and reports the proposal's missing header, as before this change

### Requirement: The checker needs no AI
The checker and its readout SHALL run with Node, Git, the `openspec` CLI and, for the delivery
stage only, `gh`; its source SHALL import only Node built-ins and the pack's own hook modules.

#### Scenario: It runs with only those programs
- **WHEN** the checker runs with a `PATH` that holds only Node, Git, `openspec` and a fake `gh`
- **THEN** it gives the same report as with the full `PATH`

### Requirement: Every shipped stage agent declares its stage's skills
For every stage of both stage declarations whose role is shipped and has an agent file, the agent's
`skills` list SHALL equal the skills the declaration lists for that role's stages. Only the review
skill's role and the owner SHALL have no agent file; `change-coordinator`, which the session plays
on the Claude driver, SHALL have one, for the CompozyOS driver.

#### Scenario: The declarations match
- **WHEN** the agents of `plan-readiness-reviewer`, `tdd-implementer`, `commit-and-pr`, `change-planner`, `pr-verifier`, `screen-designer`, `adr-author`, `test-runner`, `e2e-tester` and `change-coordinator` are compared with both stage declarations
- **THEN** each agent's skills, a plugin prefix removed, equal its stage's skills (none for the planner and the verifier; `screen-mockup` for the screen designer; `adr-authoring` for the ADR author; `test-and-coverage` and `systematic-debugging` for the test runner; `e2e-testing` for the E2E tester; `requirements-grill` and `retro` for the coordinator)

#### Scenario: A difference
- **WHEN** an agent's skills lack one its stage lists, or list one it does not
- **THEN** the comparison fails and names the agent and the skill

#### Scenario: A role without wiring
- **WHEN** a shipped role other than `review-bench` and `owner` has no agent file
- **THEN** the comparison fails and names the role

#### Scenario: A role still marked unshipped
- **WHEN** a role the declaration marks `"shipped": false` has an agent file
- **THEN** the comparison fails and asks for the role to be marked shipped and wired

### Requirement: The project script declares the slice's stages
The `devkit-project` schema SHALL declare, as OpenSpec artifacts and in this order, `business`,
`domain-model`, `architecture`, `implementation-plan`, `roadmap` and `review`, with no `apply`
requirement and no spec artifact, and its stage declaration SHALL list `open` first and `delivery`
last around them.

#### Scenario: A new slice lists its stages
- **WHEN** a change is created with the shipped `devkit-project` schema and `openspec status --change <id> --json` is read
- **THEN** its `artifacts` ids are exactly that list, in that order, and its `.openspec.yaml` sets `skip_specs: true`

#### Scenario: The declaration around them
- **WHEN** the `devkit-project` stage declaration is read
- **THEN** its stage ids are `open`, the six artifacts in order, and `delivery`, the review declares a ceiling of 2 and the architecture stage as its fix stage

### Requirement: The project script follows the declaration rules
The `devkit-project` schema SHALL hold a stage declaration whose stages with a file are its status
artifacts with the same file names, templates that each start with their stage's header with
`result=pending`, no tool of one platform or `devkit-core:` agent type in any instruction, template
or declaration, a role document section for every role it names, and two copies kept byte-identical.

#### Scenario: Templates and declaration agree
- **WHEN** the `devkit-project` templates, `flow.json` and `schema.yaml` are read
- **THEN** each artifact's `generates` is its stage's file, and each template's first line is that stage's header with `result=pending`

#### Scenario: No platform tool and every role documented
- **WHEN** the schema's files are searched for `devkit-core:`, `subagent_type`, `Agent tool`, `AskUserQuestion`, `Workflow tool` and `Claude`, and its roles are looked up in the role document
- **THEN** none of those words is found and `project-coordinator`, `adr-reviewer` and `commit-and-pr` each have a section

#### Scenario: Agents declare the stage skills
- **WHEN** the agents of the roles the declaration names are compared with it
- **THEN** each shipped role's agent lists exactly its stages' skills, and only `project-coordinator`, besides the roles already exempt, has no agent file

#### Scenario: The two copies
- **WHEN** `plugins/openspec/schemas/devkit-project/` and `openspec/schemas/devkit-project/` are compared
- **THEN** every file is byte-identical

### Requirement: A stage the script does not declare is never offered
When the walk would offer a stage that the change's stage declaration does not hold, the checker SHALL
end the run as blocked, naming the stage the script lacks, instead of offering it.

#### Scenario: A delivered slice with no retro stage
- **WHEN** every stage of an active `devkit-project` change passed, its delivery included
- **THEN** the run ends blocked saying the script declares no retro stage, and no next stage is given

#### Scenario: A failing check on a script with no implementation stage
- **WHEN** the delivery of an active `devkit-project` change reads a failing check on its pull request
- **THEN** the run ends blocked saying the script declares no implementation stage, and names the failing check

### Requirement: The review stage is stale while a reviewer is stale
The checker SHALL report the review stage stale whenever the delivery checker's reviews item lists a
stale reviewer, also when the review stage's header commit is current, and the reason SHALL name
those reviewers. This SHALL NOT apply in the walk after the merge. The review stage SHALL otherwise
keep the staleness rule of every stage after the implementation.

#### Scenario: A commit of tests only after the review
- **WHEN** `review.md`'s header and the reviewers' files record commit A, and one later commit touches only test files
- **THEN** the checker reports the review stage stale, and the delivery checker's `review` step, once the evidence is current again, names only `code-quality-reviewer` and `test-coverage-reviewer`

#### Scenario: A stale reviewer under a current header
- **WHEN** `review.md`'s header records the head, `reviews/code-quality-reviewer.md` records the head, and `reviews/spec-reviewer.md` records an older commit followed by a commit that touches `src/a.ts`
- **THEN** the checker reports the review stage stale with a reason that names `spec-reviewer`, and the review stage is the next stage once the stages before it passed

#### Scenario: Every reviewer current
- **WHEN** `review.md`'s header and every reviewer's file are current at the head
- **THEN** the checker reports the review stage passed

#### Scenario: After the merge
- **WHEN** the checker runs the walk after the merge of a delivered change whose reviewer files record commits squashed away
- **THEN** the review stage is reported from its header alone, and not stale

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

### Requirement: A change follows the flow version it opened with
The checker SHALL read a change by the flow version its `.openspec.yaml` records, the whole of that
flow: a stage a later version adds SHALL NOT be asked of it, a stage a later version removes SHALL
still be asked, and every rule of the recorded version (a ceiling, a stale rule, an `onFail` target)
SHALL hold until the change is moved on request.

#### Scenario: A stage added later is not asked
- **WHEN** a change records flow version 1 and the installed flow is version 2, which adds a stage after the design
- **THEN** the readout lists no such stage for the change and its next stage is the one version 1 names

#### Scenario: A stage removed later is still asked
- **WHEN** a change records flow version 1, has its plan files up to the tasks and no readiness file, and the installed version 2 has no readiness stage
- **THEN** the readout names the plan readiness as the next stage

#### Scenario: The old ceiling holds
- **WHEN** a change records flow version 1, where the code review's ceiling is 2, its code review failed at attempt 1, and the installed version 2 sets that ceiling to 1
- **THEN** the readout offers the fix of the implementation, not a blocked end at the ceiling

#### Scenario: A change opened after the upgrade
- **WHEN** a change records flow version 2 and version 2 is installed
- **THEN** the readout lists the stage version 2 adds and not the one it removes, and the review failed at attempt 1 ends blocked at its ceiling of 1

### Requirement: A change with no recorded flow follows version 1
A change whose `.openspec.yaml` records no flow version SHALL be read as following flow version 1.
While the installed flow of its script is version 1, its readout, its next step, the product-code gate
and the check SHALL be as before this change.

#### Scenario: An unpinned change while version 1 is installed
- **WHEN** a change with no recorded flow version is read while every installed flow is version 1
- **THEN** its text readout is byte for byte the one before this change, with no line about flow versions

#### Scenario: An unpinned change after an upgrade
- **WHEN** a change with no recorded flow version is read after flow version 2 is installed
- **THEN** it is judged by flow version 1, as a change that records version 1

### Requirement: Every released flow version stays readable
Each schema folder SHALL keep every released version of its flow as `flows/<n>.json`, the current
one byte-identical to `flow.json`. A change that records a version this checkout does not hold SHALL
stop the checker with an error naming the version and the file it looked for.

#### Scenario: The kept version is read after a re-install
- **WHEN** the project re-runs the setup with a pack whose `flow.json` is version 2 and a change records version 1
- **THEN** the checker reads `flows/1.json` of that schema folder for the change

#### Scenario: A recorded version that is not installed
- **WHEN** a change records flow version 7 and its schema folder holds no `flows/7.json`
- **THEN** the checker exits 3 and its message names version 7 and the missing file

#### Scenario: A recorded flow version that is not a number
- **WHEN** a change's `.openspec.yaml` records the flow version `abc`, or `0`
- **THEN** the checker exits 3 and its message names the value it could not read

### Requirement: The product-code gate follows the change's flow
The hook that keeps product code closed SHALL ask for an approved readiness exactly when the flow
the change follows declares a readiness stage. When that flow cannot be read, the hook SHALL decide
as before this change, from the installed schema, and never block on its own error.

#### Scenario: A removed readiness stage still closes the code
- **WHEN** a change records flow version 1, the installed version 2 has no readiness stage, the change has no approved readiness, and the main session edits product code
- **THEN** the edit is refused for the missing approved readiness

#### Scenario: A change opened on a flow without readiness
- **WHEN** a change records flow version 2, which has no readiness stage, and the main session edits product code
- **THEN** the edit is allowed

#### Scenario: An unreadable recorded flow
- **WHEN** a change records a flow version this checkout does not hold and product code is edited
- **THEN** the hook decides from the installed schema, as before this change

### Requirement: The readout names a newer installed flow
When the installed flow of a change's script is newer than the flow the change follows, the text
readout SHALL carry one line naming both versions and the command that moves the change, in
Portuguese or in English, and the JSON readout SHALL carry both versions. When they are equal, no
such line SHALL be printed.

#### Scenario: A newer flow is installed
- **WHEN** the readout runs, in `pt-BR` and in `en`, for a change that follows flow version 1 while version 2 is installed
- **THEN** one line names version 1, version 2 and the command that moves the change, and the JSON readout carries version 1 and installed version 2

#### Scenario: The same flow is installed
- **WHEN** the readout runs for a change that follows the installed flow version
- **THEN** no line names flow versions

### Requirement: A flow change raises its version
The repository's checks SHALL fail when a schema's `flow.json` differs from the released content of
the version it declares, when a released `flows/<n>.json` no longer matches its recorded digest, and
when a flow version has no kept file or no digest; they SHALL pass when the version is raised with
its kept file and digest.

#### Scenario: A flow changed without raising its version
- **WHEN** a stage is added to `flow.json` and its `version` stays 1
- **THEN** `python3 scripts/check.py` exits 1 and names that `flow.json` and version 1

#### Scenario: A flow changed with its version raised
- **WHEN** a stage is added to `flow.json`, its `version` becomes 2, `flows/2.json` holds the same bytes and the digest of version 2 is recorded
- **THEN** `python3 scripts/check.py` exits 0

#### Scenario: A released version edited
- **WHEN** `flows/1.json` is edited
- **THEN** `python3 scripts/check.py` exits 1 and names `flows/1.json` and its recorded digest

### Requirement: A flow newer than the reader is refused clearly
The flow reader SHALL compare a flow file's `version` with the newest version it reads for that
script before any other check, and SHALL refuse a newer file with one message naming both versions
and the update to make, never calling it malformed. A top-level `readerRelease` in the file SHALL
add that release to the message.

#### Scenario: A newer flow with no release field
- **WHEN** the reader reads a `devkit` `flow.json` whose `version` is one above the newest it reads, with no `readerRelease`, and whose stages hold a key the reader does not know
- **THEN** it fails with a message that names that version and the newest version it reads, says to update devkit-openspec and restart the session, and holds neither `malformed` nor `unknown key`

#### Scenario: A newer flow that names its release
- **WHEN** that newer file carries `"readerRelease": "9.1.0"`
- **THEN** the message also names `devkit-openspec 9.1.0 or later`

#### Scenario: A release field that is not a release number
- **WHEN** the newer file's `readerRelease` is `soon` or `9`
- **THEN** the message is the one with no release field

#### Scenario: A script the reader does not know
- **WHEN** the reader reads a valid `flow.json` whose `script` is a project's own script, at any version
- **THEN** it reads the file as before this change

#### Scenario: An unknown stage key at a known version
- **WHEN** the reader reads a `devkit` `flow.json` at a version it knows whose stage `mockup` has a key `colour`
- **THEN** it fails with `flow.json of devkit is malformed: stage mockup has an unknown key colour`

#### Scenario: A release field that cannot be read at a known version
- **WHEN** the reader reads a `devkit` `flow.json` at a version it knows whose `readerRelease` is `soon`, or `1.2`
- **THEN** it fails with `flow.json of devkit is malformed: readerRelease "<value>" is not a release number such as 1.2.3`

#### Scenario: A release field at a known version
- **WHEN** the reader reads a valid `devkit` `flow.json` at a version it knows whose `readerRelease` is `1.2.3`
- **THEN** it reads the file

### Requirement: The reader's newest versions match the shipped flows
The newest version the reader knows for each shipped script SHALL equal the `version` of that
script's shipped `flow.json`, and this release SHALL leave every shipped `flow.json` byte-identical
to its released `flows/<version>.json`.

#### Scenario: The reader and the shipped versions agree
- **WHEN** the reader's newest version for `devkit`, `devkit-lite` and `devkit-project` is compared with the `version` of each shipped `flow.json`, in both schema copies
- **THEN** they are equal, and a test fails naming the script when they are not

#### Scenario: The shipped flows stay as released
- **WHEN** the `flow.json` of `devkit` and of `devkit-lite`, in both schema copies, is compared with its `flows/2.json`
- **THEN** both are version 2 and byte-identical

### Requirement: A failed stage counts its failures in a row from its file's history
For a failed stage with a numeric ceiling, the checker SHALL count the failures in a row as the
distinct failed headers of the stage, the current one included, that its file carried (line 1) in
the commits since it last carried a passed header, newest first, without subtracting attempt
numbers. With no passed header visible, the count SHALL be at least `attempt`.

#### Scenario: A pass between failures resets the count
- **WHEN** the evidence's file was committed with `result=failed` at attempt 1 and `result=passed` at attempt 2, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: A header carried by several commits counts once
- **WHEN** the evidence's file was committed with `result=passed attempt=1`, then with `result=failed attempt=2`, then again with the same failed header and a changed body
- **THEN** the evidence counts one failure in a row

#### Scenario: A passed stage counts no failure
- **WHEN** the evidence's file was committed with `result=failed` at attempts 1 and 2 and its header now says `result=passed attempt=3`
- **THEN** the evidence is reported passed, and a later `result=failed attempt=4` counts one failure in a row

#### Scenario: Takes retaken after merges of main do not count
- **WHEN** the evidence's file was committed with `result=passed` at attempts 1, 2 and 3, a merge of main came after each, and its header now says `result=failed attempt=4` with a ceiling of 3
- **THEN** the evidence counts one failure in a row and the run is not blocked

#### Scenario: A restarted round does not reset the count
- **WHEN** the review's file was committed with `result=passed attempt=1`, then `result=failed attempt=1`, then `result=failed attempt=2`, newest last, and its ceiling is 2
- **THEN** the review counts two failures in a row and the run ends blocked with `ceiling-reached`

#### Scenario: A take never committed is not counted
- **WHEN** the evidence's file was committed with `result=passed attempt=1`, a `result=failed attempt=2` was written and overwritten without a commit, and the file was then committed with `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: A passed header whose recorded commit is not in history still counts
- **WHEN** the evidence's file was committed with `result=passed attempt=2 commit=<a sha that is not in the history>`, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: History that shows no pass keeps the attempt as the count
- **WHEN** the failed stage's file was never committed, or the checkout is a depth-1 clone whose only commit holds the current header
- **THEN** the count is the header's `attempt`, and the stage is blocked exactly when `attempt` reaches its ceiling

#### Scenario: A partial history counts what it shows
- **WHEN** the checkout is a shallow clone that still holds the commit where the evidence's file said `result=passed attempt=2`, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: The readout says the failures in a row
- **WHEN** the checker prints a failed stage, a fix offered after a failure, or a blocked end at the ceiling, in English or in pt-BR
- **THEN** the stage's line and the reason say the attempt and the failures in a row against the ceiling, in the chosen language

### Requirement: A plan revised after the work started goes back to its gates
The owner's approval SHALL record a digest of the plan files (`proposal.md`, `design.md`, `tasks.md`
with every checkbox read as empty, and every `.md` file under `specs/`). Once a task is ticked, a digest
that differs from the recorded one SHALL make the plan readiness stale until it runs again, and then
the approval, so the owner approves the revised plan. An approval that records no digest SHALL be read
as before.

#### Scenario: A design edited after the first tick
- **WHEN** a task is ticked, `approval.md` records the plan's digest and the readiness it approved, and `design.md` is edited
- **THEN** the plan readiness is reported stale because the plan changed after the approval, and it is the next stage

#### Scenario: The readiness ran again
- **WHEN** after that edit the readiness review wrote `readiness.md` again with `- Status: APPROVED`
- **THEN** the next action waits for the owner's approval again, carrying the new readiness hash and the new plan digest

#### Scenario: A tick is no plan edit
- **WHEN** a task is ticked after the approval and no plan file changed otherwise
- **THEN** the plan readiness and the approval stay passed and the implementation goes on

#### Scenario: Evidence and reviews are no plan edit
- **WHEN** `evidence.md`, `review.md` or a file under `reviews/` is written after the approval
- **THEN** the plan readiness and the approval stay passed

#### Scenario: A new task is a plan edit
- **WHEN** a task line is added to `tasks.md` after the first tick
- **THEN** the plan readiness is reported stale

#### Scenario: An approval with no digest
- **WHEN** a task is ticked and `approval.md` records no plan digest
- **THEN** no plan file makes the readiness or the approval stale, as before

#### Scenario: The approval the CompozyOS driver records
- **WHEN** the owner's approval is recorded by the CompozyOS driver's record step
- **THEN** `approval.md` carries the plan's digest in its `- Plan:` line, as the approval the session writes does, and a plan file edited after a task is ticked sends that run back to its gates the same way

#### Scenario: The short script
- **WHEN** a `devkit-lite` change edits a plan file after a task is ticked
- **THEN** nothing is reported stale and no approval is asked, as before

#### Scenario: A merge-defect fix is a plan edit
- **WHEN** a task is ticked, `approval.md` records the plan's digest, a merge of the base made the plan's strict validation red, and the planner's fix of that merge defect edits a spec delta
- **THEN** the plan readiness is reported stale because the plan changed after the approval, exactly as for an edit of `design.md`, and after the readiness runs again the owner is asked to approve again

#### Scenario: A merge-defect fix under an approval with no digest
- **WHEN** the same fix is made and `approval.md` records no plan digest
- **THEN** neither the plan readiness nor the approval is reported stale, and the check of the plan after the merge runs again
