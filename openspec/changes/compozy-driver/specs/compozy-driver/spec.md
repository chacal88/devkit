<!-- devkit-stage specs result=passed attempt=3 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Spec Delta

## Purpose

Says how one devkit change and its review round run on the CompozyOS driver: a short loop that asks
the checker, runs the agent it names and checks the gate, with the owner's gates as CompozyOS requests.

## ADDED Requirements

### Requirement: Each turn asks the checker and runs the agent it names
A CompozyOS change run SHALL, on every turn, ask the change's checker what comes next and run, for
a stage handed to a role, the CompozyOS agent whose name is that role, with the checker's brief; it
SHALL keep no table from roles to other agents, and SHALL ask the checker again after the turn.

#### Scenario: A plan stage
- **WHEN** the checker says the proposal is the next stage of the change
- **THEN** the run's node for that turn runs in a session of the agent `change-planner`, with the checker's brief, and the next turn asks the checker again

#### Scenario: A delivery hand-off
- **WHEN** the checker says the next step is to open the pull request, handed to `commit-and-pr`
- **THEN** the turn runs the agent `commit-and-pr`, never another agent of the kit

#### Scenario: A step the coordinator carries
- **WHEN** the checker names a step the coordinator carries itself (the grill's next question, the opening, the retro, a delivery step such as enabling the automatic merge)
- **THEN** the turn runs the agent `change-coordinator` with that step

### Requirement: A stage runs only when the checker confirms it
Before a turn runs an agent, the run SHALL confirm, with the checker itself and not with an agent's
copy, that the step and the agent the turn read are the checker's current ones; when they are not,
the turn SHALL run nothing and the next turn SHALL ask again.

#### Scenario: A copy that differs
- **WHEN** the turn's read names `tdd-implementer` while the checker's current step is the readiness review
- **THEN** no agent runs in that turn and the next turn reads the checker again

### Requirement: An agent hands its stage to the Claude agent of the same name
Each agent of the kit SHALL hand the stage it receives, with the brief unchanged, to the Claude
agent of the same name, so that the devkit hooks judge the work by that agent's role, as they do on
the Claude driver. Only that agent's `failure` outcome SHALL end the turn as a failure; any other
outcome it reports SHALL end the turn as done, and the checker SHALL judge the stage from the files
on the next turn.

#### Scenario: The verifier writes the evidence
- **WHEN** the run hands the evidence stage to the CompozyOS agent `pr-verifier`
- **THEN** `evidence.md` is written by the Claude agent `devkit-core:pr-verifier`, and the hooks allow it as they do in Claude Code

#### Scenario: A red unit-test run
- **WHEN** the run hands the unit tests to `test-runner` and its Claude agent reports `red`
- **THEN** the turn ends done, not as a failure, and the next turn hands the implementer the fix of the failed tests, as the checker says

#### Scenario: The ADR author proposes records
- **WHEN** the run hands the decisions to `adr-author` and its Claude agent reports `proposed 2`
- **THEN** the turn ends done and the next turn asks the checker for the next stage

### Requirement: The run opens a new change and the session never does
When the checker knows no change of the run's name, the run SHALL open the change itself, with the
run's request, through the agent `change-coordinator` and the rule the Claude driver uses to choose
the script; the Claude Code session that started the run SHALL have created nothing of the change.
When an opening turn ends with the change still unknown, the next turn SHALL open nothing and SHALL
ask the owner, as for a blocked change, whether to retry or stop.

#### Scenario: A run with a request
- **WHEN** a run starts for `add-csv-export`, which no checkout knows, with the request "add a CSV export"
- **THEN** its first turn runs the agent `change-coordinator`, which opens the change with that request, and before that turn the project held no folder, branch or worktree of the change

#### Scenario: A run with no request
- **WHEN** a run starts for a name no checkout knows and its request is empty
- **THEN** no change is opened, and the next turn asks the owner, saying the run could not open the change and that it starts again with its request, whether to retry or stop

### Requirement: The grill's questions reach the owner in CompozyOS one at a time
On a change whose requirements stage is next, each turn SHALL record the owner's previous answer in
the requirements file, then ask the owner the grill's next question as one CompozyOS human request,
in the person's language; the requirements stage SHALL pass only after the owner answered.

#### Scenario: Two questions
- **WHEN** the grill has two questions for the owner
- **THEN** the owner receives the first as a CompozyOS request, and the second only after answering the first, and the requirements file records both answers

### Requirement: The plan approval is the owner's answer in CompozyOS
When the plan waits for the owner's approval, the run SHALL ask it as a CompozyOS human request
naming where the plan is. An approval SHALL be written to `approval.md` by the kit's record step,
from the owner's answer, in the form the Claude driver writes; a request for changes SHALL send the
owner's words to `change-planner` and SHALL write no approval.

#### Scenario: The owner approves
- **WHEN** the owner answers the approval request with approve and a sentence
- **THEN** `approval.md` holds `- Status: APPROVED`, the readiness hash and the owner's sentence, and the next turn hands the implementation

#### Scenario: The owner asks for changes
- **WHEN** the owner answers with changes and a note
- **THEN** no `approval.md` is written, `change-planner` receives the note, and the approval is asked again after the plan is reviewed again

### Requirement: The mock-up approval is the owner's answer in CompozyOS
When the drawn mock-up waits for the owner, the run SHALL ask it as one CompozyOS human request
naming the mock-up's files, and the kit's record step SHALL record the owner's answer in `mockup.md`
in the form the Claude driver writes. After an approval, `change-coordinator` SHALL add the facts
the mock-up settled to the requirements file; after a request for changes, the next turn SHALL hand
the mock-up to `screen-designer` again.

#### Scenario: The owner approves the mock-up
- **WHEN** the owner answers the mock-up request with approve and a sentence
- **THEN** `mockup.md`'s header says `result=passed` with the same attempt, the file holds the owner's approval with the date and the sentence, the next turn runs `change-coordinator` to add the facts the mock-up settled to `requirements.md`, and the change then goes on to its next stage

#### Scenario: The owner asks for changes to the mock-up
- **WHEN** the owner answers the mock-up request with changes and a note
- **THEN** `mockup.md`'s header says `result=failed` with the same attempt, the file holds the owner's notes, and the next turn hands the mock-up to `screen-designer` as a new attempt naming those notes

### Requirement: The run runs the checker's commands itself
When the checker's next step is a command it built (accepting the decision records the plan lists,
right after the owner's recorded plan approval, or switching the change's script), the run SHALL
run that command itself, with no agent, and SHALL ask the checker again once it succeeds; when the
command refuses, the run SHALL change nothing more, SHALL ask the owner, with the command's own
reason, whether to retry or stop, and SHALL NOT run the command again before the owner answers
retry.

#### Scenario: The plan was just approved
- **WHEN** the owner's approval was recorded and `decisions.md` lists two records whose status is proposed
- **THEN** the run sets both to accepted with the approval's date before the implementation is handed, and no agent session runs for that step

#### Scenario: A record the command cannot set
- **WHEN** the approval was recorded and `decisions.md` lists a record that has no status line
- **THEN** no file changes, and the owner is asked, naming that file and saying the decision records could not be marked accepted, whether to retry or stop

### Requirement: An answer is recorded only for the question the run asks
A record step SHALL check, with the checker itself and not with a value it is given, that the run
asks the question the answer belongs to at that moment, and SHALL write nothing otherwise: no
`approval.md` unless the plan awaits the owner's approval, no change to `mockup.md` unless the
mock-up awaits the owner's answer, and no answer recorded for another question.

#### Scenario: An approval while the plan does not await it
- **WHEN** the record step of an approval runs while the checker's next step is another one, such as the readiness review
- **THEN** the step fails, no `approval.md` is written, and an `approval.md` already there is left unchanged

#### Scenario: An answer to another question
- **WHEN** an answer is recorded as the grill's while the question the run asks is the plan approval
- **THEN** the step fails and nothing is recorded

#### Scenario: A mock-up answer while the mock-up does not await it
- **WHEN** the record step of a mock-up answer runs while the question the run asks is the plan approval
- **THEN** the step fails and `mockup.md` is left unchanged

### Requirement: The retro answers are the owner's answers in CompozyOS
When the retro waits for the owner's answers, the run SHALL ask them as one CompozyOS human request
and SHALL record each answer under its proposal, from the owner's words only.

#### Scenario: The retro of a merged change
- **WHEN** the retro of a merged change lists two proposals
- **THEN** the owner answers both in CompozyOS and the retro file records each answer under its proposal

### Requirement: Any other wait for the owner is a CompozyOS request
When the checker says the change waits for the owner for a reason other than the mock-up approval,
the plan approval or the retro answers, the run SHALL ask the owner the checker's reply as one CompozyOS human request,
SHALL record nothing from the answer, and SHALL ask the checker again once the owner answered.

#### Scenario: A merge left to the owner
- **WHEN** the checker says the pull request is ready and merging it is up to the owner
- **THEN** the owner receives the checker's reply as a CompozyOS request, and once the owner answers, the next turn asks the checker again

### Requirement: The phase gate is checked by the run
When the checker names a phase gate, the run SHALL run that phase's test command itself, tick the
gate task when it is green, and, when it is red, ask the owner as for a blocked change, naming the
phase.

#### Scenario: A red gate
- **WHEN** the test command of phase 2 fails
- **THEN** the gate task stays unticked and the owner's request says the tests of phase 2 are red

### Requirement: A blocked change asks the owner to retry or stop
When the checker says the change is blocked, the run SHALL ask the owner, with the checker's reason,
whether to retry once the cause is fixed or to stop; a retry SHALL forget the last hand-off so the
stage can be handed again, and a stop SHALL end the run.

#### Scenario: A stage that made no progress
- **WHEN** an agent returned and the checker reports no progress on that stage
- **THEN** the owner is asked with that reason, and answering retry hands the same stage again on the next turn

#### Scenario: The owner stops
- **WHEN** the owner answers stop to the request of a blocked change
- **THEN** the run ends without being done, no other turn starts, and the change's files are left as they are

### Requirement: The run waits on GitHub with no time limit
When the checker says the change waits on GitHub, the run SHALL wait inside CompozyOS and ask the
checker again, with no time limit and with no shell command that sleeps or polls.

#### Scenario: Checks still running
- **WHEN** the pull request's checks are still running
- **THEN** the run waits, asks again, and hands the next step once the checker's answer changes

### Requirement: The run ends when the change is archived
A CompozyOS change run SHALL end as done when the checker confirms the change is archived; a run the
owner stopped SHALL end without being done.

#### Scenario: The archive merged
- **WHEN** the checker reports the change archived
- **THEN** the run ends done and starts no other turn

### Requirement: The review round runs each reviewer in its own session at once
The review stage on CompozyOS SHALL pick the bench, the prompts and the verdict by the same rules as
the review skill: each reviewer SHALL run as its own agent in its own session, all at the same time;
each blocking or important finding SHALL get three refuting verifiers, each in its own session; each
reviewer SHALL write its own verdict file; and the round SHALL reject while a blocking finding stays
open.

#### Scenario: A round with two reviewers and one blocking finding
- **WHEN** the bench is `code-quality-reviewer` and `test-coverage-reviewer` and the first raises one blocking finding
- **THEN** both reviewers run in two sessions at once, three `finding-verifier` sessions judge that finding, each reviewer writes `reviews/<reviewer>.md`, and `review.md` rejects unless the verifiers refuted the finding

### Requirement: A review round that cannot finish asks the owner
A review round on CompozyOS that cannot finish SHALL write no `review.md` and SHALL ask the owner,
as for a blocked change, whether to retry or stop; a retry SHALL run the round again from the
change's files.

#### Scenario: A round that cannot finish
- **WHEN** the review round fails, for example because a reviewer's verdict file does not match what the reviewer returned
- **THEN** no `review.md` is written by that round, the owner is asked, saying the review could not finish its work, whether to retry or stop, and answering retry runs the round again
