# project-definition Specification

## Purpose
Lets a person plan a new project or slice with one command, `/devkit project`, through the four
design phases and a roadmap stage, each approved by the owner, ending in one pull request that the
ADR reviewer clears and that leaves new rounds on `openspec/roadmap.md` for `/devkit roadmap`.

## Requirements

### Requirement: The project command opens a slice
`/devkit project <slice>`, in a project set up for devkit with the `claude` driver, SHALL create a git
worktree and a branch named after the slice from the default branch and an OpenSpec change of that
name on the `devkit-project` schema, reply with the slice and what comes next, and start the first
stage's conversation in the same session.

#### Scenario: A new slice
- **WHEN** `/devkit project billing` is typed and no change, slice, branch or worktree is named `billing`
- **THEN** a worktree on branch `billing` holds `openspec/changes/billing/` whose `.openspec.yaml` names `devkit-project`, the reply names the slice and the business stage, and the session asks the business phase's first question

#### Scenario: A name that cannot be used
- **WHEN** the name is not 2 to 48 lowercase letters and digits in words joined by single dashes, or a change, a branch or a worktree already has that name
- **THEN** the reply says why in one plain sentence and nothing is created

#### Scenario: A slice folder already on the default branch
- **WHEN** `docs/design/billing/` exists on the default branch
- **THEN** the reply says the slice's folder already exists and to choose another name, and nothing is created

#### Scenario: A name already delivered
- **WHEN** `/devkit project billing` is typed and the slice `billing` is already delivered on the default branch
- **THEN** the reply says the slice is already delivered and to choose another name, and nothing is created

#### Scenario: The design pack is not enabled
- **WHEN** the project's `.claude/settings.json` (and `.claude/settings.local.json`) does not enable `devkit-design@devkit`
- **THEN** the reply names the pack and the setup step that enables it, and nothing is created

#### Scenario: A project not set up for devkit
- **WHEN** the project's schema is not `devkit` or `devkit-lite`, a setting is unknown, or the driver is `script`
- **THEN** the reply is the one `/devkit change` gives in that project, and nothing is created

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy` and `/devkit project billing` is typed
- **THEN** the reply says in one plain sentence that `/devkit project` does not run on CompozyOS yet, and nothing is created or run

### Requirement: Calling the project command again resumes the slice
`/devkit project <slice>` on an unfinished slice, and `/devkit project` alone with exactly one
unfinished slice, SHALL continue it from its files, git and GitHub, remembering nothing between runs,
and the first reply SHALL say where it stopped. With several unfinished slices and no name it SHALL
ask which one; with none it SHALL say how to start one.

#### Scenario: Resuming by name after the session stopped
- **WHEN** the business stage of `billing` passed, the session ended, and `/devkit project billing` is typed in a new session
- **THEN** the reply says it continues `billing` at the domain model stage and the session starts that stage's conversation

#### Scenario: Resuming after the pull request was opened
- **WHEN** the slice's folder is archived on its branch and its pull request is open with checks pending
- **THEN** the reply says the slice waits on GitHub and the session waits in the background

#### Scenario: Several unfinished slices
- **WHEN** `/devkit project` is typed with no name and two slices are unfinished
- **THEN** the reply lists both with where each stopped and asks which one to continue

#### Scenario: No name and no unfinished slice
- **WHEN** `/devkit project` is typed with no name and no slice is unfinished
- **THEN** the reply says to type the command with the name of the project or slice, with an example, and nothing is created

#### Scenario: The same answer after a killed session
- **WHEN** the next action of a slice is computed, the session is killed, and the command is called again on the same files
- **THEN** the same next action is given

### Requirement: A slice runs five stages in order
A slice SHALL run, in this order, the business, domain model, architecture, implementation plan and
roadmap stages. Each stage SHALL start only when every earlier one passed or does not apply, and the
phases SHALL run as conversations in the session the command was typed in.

#### Scenario: The order holds
- **WHEN** the domain model stage has no record yet
- **THEN** the architecture, implementation plan and roadmap stages are reported blocked and no action names them

### Requirement: The slice readout shows the five stages
The readout of a slice SHALL list the five stages, each as passed, not applicable, ready or blocked,
in the person's language, followed by one line on what comes after the roadmap stage when every stage
is settled.

#### Scenario: A slice in its architecture stage
- **WHEN** the business stage passed, the domain model stage does not apply, and the architecture stage has no record
- **THEN** the readout shows business passed, domain model not applicable, architecture ready, implementation plan and roadmap blocked

#### Scenario: Every stage settled
- **WHEN** the five stages passed or do not apply and the ADR review is pending
- **THEN** the readout shows the five stages and one line saying the ADR review comes next

### Requirement: Each phase writes its document in the slice's folder
The business, domain model, architecture and implementation plan stages SHALL write
`docs/design/<slice>/1-business-vision.md`, `2-domain-model.md`, `3-architecture.md` and
`4-implementation-plan.md` respectively, keep the slice's progress notes in
`docs/design/<slice>/STATE.md`, and write every new ADR to the project's ADR folder, `docs/adr/` when
it has none.

#### Scenario: The architecture phase with two decisions
- **WHEN** the architecture stage passes with two structural decisions
- **THEN** `docs/design/billing/3-architecture.md` exists, two new ADR files exist under `docs/adr/`, and no ADR file is under `docs/design/`

### Requirement: A slice's files are written in its worktree
Every document, note, ADR and stage record of a slice SHALL be written in the slice's worktree, never
in the checkout the command was typed in.

#### Scenario: The writes land in the slice's worktree
- **WHEN** `/devkit project billing` is typed in the main checkout and the business phase writes its document, its notes and its record
- **THEN** `docs/design/billing/1-business-vision.md`, `docs/design/billing/STATE.md` and the business record are in the worktree of `billing`, and the main checkout has no new or changed file

### Requirement: A phase passes only with the owner's approval
A phase's stage SHALL pass only when its record says passed, which the session writes only from the
owner's explicit approval. A record written and not judged SHALL keep the run waiting for the owner,
and the next stage SHALL stay blocked.

#### Scenario: A document waiting for approval
- **WHEN** the business record exists with `result=pending`
- **THEN** the next action is the business stage asking the owner's approval, and the domain model stage is blocked

#### Scenario: The owner approves
- **WHEN** the business record's header is set to `result=passed`
- **THEN** the domain model stage is ready

### Requirement: A phase may not apply
A phase marked not applicable SHALL leave its document in `docs/design/<slice>/` saying it does not
apply and why, and its record with `result=not-applicable` and the reason, and the next stage SHALL
become ready.

#### Scenario: No domain model for a research slice
- **WHEN** the owner agrees that the domain model does not apply and the record says `result=not-applicable` with the reason
- **THEN** `docs/design/<slice>/2-domain-model.md` holds the reason, the readout shows the stage as not applicable, and the architecture stage is ready

### Requirement: The roadmap stage writes only after the owner approves
The roadmap stage SHALL show the proposed rounds and changes, each with its id, description and
`after:`, and SHALL write nothing to `openspec/roadmap.md` while its record is not passed. Once passed,
it SHALL append them after the existing content with every existing byte unchanged, or create the file
when absent, and the flow SHALL name `/devkit roadmap` without starting it.

#### Scenario: Before approval
- **WHEN** the roadmap record holds proposed rounds with `result=pending` and the append is asked
- **THEN** it refuses, says the owner has not approved, and `openspec/roadmap.md` is unchanged

#### Scenario: Appending to an existing roadmap
- **WHEN** the record is passed and `openspec/roadmap.md` exists
- **THEN** the file starts with its previous bytes, followed by the approved rounds, and `/devkit status` lists the new lines with what each waits for

#### Scenario: Creating the roadmap
- **WHEN** the record is passed and the project has no `openspec/roadmap.md`
- **THEN** the file is created with a `# Roadmap` title followed by the approved rounds

#### Scenario: A proposal that cannot be appended
- **WHEN** a proposed line is ticked, repeats an id already on the roadmap or in the proposal, or names in `after:` an id that is neither on the roadmap, nor in the proposal, nor archived
- **THEN** the check names each such line, and nothing is written

#### Scenario: The end of the flow names the roadmap command
- **WHEN** the slice's pull request merges after rounds were appended
- **THEN** the last reply says the slice is delivered and that `/devkit roadmap` runs the new rounds, and no change is opened

### Requirement: The roadmap stage may not apply
When the roadmap stage does not apply, its record SHALL hold the reason with
`result=not-applicable`, and `openspec/roadmap.md` SHALL stay byte for byte what it was before the
slice, absent included.

#### Scenario: A research slice that builds nothing now
- **WHEN** the roadmap record says `result=not-applicable` with its reason and the slice is delivered
- **THEN** the pull request does not touch `openspec/roadmap.md` and the last reply says no change was added to the roadmap

### Requirement: The ADR reviewer clears the slice
After the roadmap stage, the `adr-reviewer` agent SHALL review the slice's documents and new or
changed ADRs against the project's ADRs. Its verdict SHALL be recorded as the review stage; a rejection
SHALL return the findings to the owner's architecture conversation and the review SHALL run again,
two rounds at most, then the run ends blocked. A verdict recorded with uncommitted changes SHALL NOT be
recorded, and the review SHALL run again.

#### Scenario: Approved
- **WHEN** the reviewer writes `Verdict: approved` with the commit it reviewed
- **THEN** the review record passes with that commit and the next action archives the slice

#### Scenario: Rejected twice
- **WHEN** the second review round is also rejected
- **THEN** the run ends blocked, naming the review and its findings file

#### Scenario: A document changed after the review
- **WHEN** a commit after the reviewed one changes a file under `docs/design/<slice>/` or an ADR folder
- **THEN** the review is reported stale and runs again

#### Scenario: A verdict recorded with uncommitted changes
- **WHEN** the reviewer's verdict names the current commit and its `Commit:` line carries the `(uncommitted changes)` marker, the slice active or archived on its branch
- **THEN** recording it is refused with a reply in the person's language saying the verdict was written with changes that were not committed, no review record is written, and the next action hands the review to the ADR reviewer again

### Requirement: The slice ends in one pull request
After the review, the slice's folder SHALL be archived on its branch, and one pull request SHALL carry
the slice's documents, its new ADRs, the appended rounds and the archived folder. The pull request
SHALL follow the project's ship mode for `devkit-project`, and no archive pull request or retro SHALL
follow.

#### Scenario: Merge mode
- **WHEN** `ship: devkit-project: merge` is set, the default branch requires `devkit-reviews`, and every check is green
- **THEN** auto-merge is enabled on the pull request, pinned to its head commit, with the project's merge method

#### Scenario: Merge mode not set up on GitHub
- **WHEN** merge mode is set and the repository does not allow auto-merge or no rule requires `devkit-reviews`
- **THEN** the run ends blocked naming what is missing and the setup step

#### Scenario: Pull-request and plan modes
- **WHEN** the mode is `pr`, or `plan`
- **THEN** with `pr` the run ends waiting for the owner's merge once the checks are green; with `plan` it ends after the archive commit, saying the owner opens the pull request

#### Scenario: The branch has work the pull request lacks
- **WHEN** the pull request is open and the slice's branch has a commit or an uncommitted change of the slice that the pull request does not have
- **THEN** the next step commits the slice's files by name and pushes the branch, and no second pull request is opened

#### Scenario: Behind its base
- **WHEN** the pull request is open, has no conflict, and is behind its base branch
- **THEN** the next step updates the pull request's branch from its base and the run goes on with the updated branch

#### Scenario: Waiting on GitHub
- **WHEN** the pull request is open with checks still running, or with auto-merge already enabled
- **THEN** the run ends waiting on GitHub and the session waits in the background with no time limit

#### Scenario: A failing check
- **WHEN** a check fails on the pull request
- **THEN** the run ends blocked naming each failing check

#### Scenario: Merged
- **WHEN** the pull request is merged
- **THEN** the run ends with the slice delivered, and no active folder of the slice is left on the default branch

### Requirement: A slice's run stops with its reason when it cannot go on
The project command SHALL end a slice's run, saying why in one plain sentence and writing nothing more,
when the slice cannot be found, its folder was left half-made, a stage fails as many times in a row as
its limit allows or comes back with nothing changed, its pull request conflicts with its base branch, or
its pull request was closed without being merged. Calling the command again SHALL give the same end
until the cause is gone.

#### Scenario: A slice that does not exist
- **WHEN** the next step of `billing` is asked and no checkout holds a slice named `billing`, active or archived
- **THEN** it ends with an error saying no slice of that name was found, and nothing is created or written

#### Scenario: A half-made slice folder
- **WHEN** `openspec/changes/billing/` exists in the slice's worktree without its OpenSpec file
- **THEN** the run ends blocked saying the slice's folder is incomplete, and nothing is written

#### Scenario: A step that changes nothing
- **WHEN** a step of the slice is carried out and the next decision is the same step with nothing changed in the slice's worktree
- **THEN** the run ends blocked saying the stage came back with nothing changed

#### Scenario: A stage at its limit
- **WHEN** a stage's record says failed and its failures in a row since it last passed reach its limit
- **THEN** the run ends blocked naming the stage and its failures in a row, and no later stage runs

#### Scenario: A pull request in conflict with its base
- **WHEN** the slice's pull request conflicts with its base branch
- **THEN** the run ends blocked naming the pull request and its base branch, nothing is merged or pushed, and once the conflict is resolved on the slice's branch the command continues the slice

#### Scenario: A pull request closed without merging
- **WHEN** the slice's pull request was closed without being merged
- **THEN** the run ends blocked saying the pull request was closed, and no new pull request is opened

### Requirement: A flat design folder is never touched
In a project whose `docs/design/` holds the flat layout, a slice SHALL leave every file under
`docs/design/` outside `docs/design/<slice>/` byte for byte unchanged, and its phases MAY read those
files as context.

#### Scenario: A project with a flat design
- **WHEN** `docs/design/1-business-vision.md` to `docs/design/4-implementation-plan.md` and `docs/design/STATE.md` exist and a slice is delivered
- **THEN** each of those files has the same bytes as before the slice and the pull request lists none of them

### Requirement: A slice is not a change of the other commands
`/devkit change`, `/devkit roadmap` and `/devkit status` SHALL never list, resume, start or ask about
a slice, and `/devkit change <slice>` SHALL answer that it names a slice and that `/devkit project
<slice>` continues it. `/devkit project <id>` on a change SHALL answer that `/devkit change <id>`
continues it.

#### Scenario: A slice under way while a change is requested
- **WHEN** the slice `billing` is unfinished and `/devkit change add an export` is typed with no other unfinished change
- **THEN** the change is opened without asking about `billing`

#### Scenario: The slice named to the change command
- **WHEN** `/devkit change billing` is typed
- **THEN** the reply names `/devkit project billing`, and nothing is run

#### Scenario: The board
- **WHEN** `/devkit status` runs while `billing` is unfinished
- **THEN** no row names `billing`

### Requirement: The design skills work alone
Each of `design-business-discovery`, `design-domain-model`, `design-architecture`,
`design-implementation-plan` and `ddd-strategic-design`, called by name outside `/devkit project`,
SHALL ask for the slice before anything else and write only under `docs/design/<slice>/` and the ADR
folder; it SHALL write nothing to `openspec/roadmap.md` and open no pull request.

#### Scenario: A phase skill alone
- **WHEN** `design-business-discovery` is called by name in a project with no slice named
- **THEN** its first question asks for the slice's name, and its document is written to `docs/design/<slice>/1-business-vision.md`

#### Scenario: The plan skill alone
- **WHEN** `design-implementation-plan` finishes alone
- **THEN** the backlog stays in `docs/design/<slice>/4-implementation-plan.md`, `openspec/roadmap.md` is unchanged, and no pull request is opened

### Requirement: A slice's review files have one writer each
A `reviews/<reviewer>.md` file in a slice's active folder, and any `reviews/<reviewer>.md` under
`openspec/changes/archive/`, SHALL be written only by that reviewer's agent, whatever change is active
in the checkout, none included; any other writer SHALL be refused with the reason.

#### Scenario: The session writes the archived verdict
- **WHEN** the session writes `openspec/changes/archive/2026-11-21-billing/reviews/adr-reviewer.md` while another change is active in the checkout
- **THEN** the write is refused, naming the `adr-reviewer` agent as its only writer

#### Scenario: The reviewer writes its archived verdict
- **WHEN** the `adr-reviewer` agent writes that file
- **THEN** the write is not refused

### Requirement: The project command's replies use no internal term
Every reply of the project command SHALL come from the message table of `/devkit change`, in the
person's language, with no stage id, role id, step name, checker name or file name other than a file
the owner must read or approve.

#### Scenario: The replies in both languages
- **WHEN** every reply key of the project command is rendered in `en` and in `pt-BR`
- **THEN** both languages have the same keys and no rendered reply holds an internal term

### Requirement: A slice's run names a gh too old to read its checks
When the slice's pull request is open at the local head and its checks cannot be read because the
installed `gh` is too old, the project command SHALL end the run blocked with the reason
`gh-too-old`, writing nothing, with a reply naming the installed version (or saying it is unknown)
and 2.50.0, telling the person to update `gh` and to call `/devkit project` again.

#### Scenario: An old gh reads the slice's checks
- **WHEN** the slice `billing` is archived on its branch, its pull request is open at the local head, `gh pr checks` fails with `unknown flag: --json` and `gh --version` prints `gh version 2.46.0 (2024-03-18)`
- **THEN** `project-loop.mjs next` ends blocked with the reason `gh-too-old` and exit code 2, its reply names `2.46.0`, `2.50.0` and `/devkit project billing`, nothing is pushed or merged, and auto-merge is not enabled

#### Scenario: Other failures keep their reason
- **WHEN** the slice's checks cannot be read for any other reason
- **THEN** the run ends blocked saying GitHub cannot be read, as before this change
