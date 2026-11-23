<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: Every grill asks the triage agent first
In every grill, of a lone `/devkit change` or of a roadmap run, the questions SHALL first go to the
triage agent, which reads the project's files and answers each one they settle, naming its source.
Only the questions nothing written settles SHALL be asked of the owner. Each triage answer SHALL be
recorded in `requirements.md` under its own heading, apart from the owner's answers, and shown in
the grill's summary so the owner can correct it.

#### Scenario: A question an ADR answers
- **WHEN** a grill question asks whether the change may use a cron, and an ADR of the project decides it
- **THEN** the owner is not asked, and `requirements.md` records the answer as answered by triage with the ADR's path as its source

#### Scenario: A question nothing written settles
- **WHEN** a grill question asks what the owner wants to see when a change is done, and no file says it
- **THEN** the question is asked of the owner, one at a time

#### Scenario: The summary
- **WHEN** the grill ends
- **THEN** its summary lists the answers by triage apart from the owner's, each with its source

### Requirement: A triage answer always names its source
The triage agent SHALL write no file. A triage answer that names no source SHALL send the change back
to its grill, so the question reaches the owner. Neither the triage agent nor the session SHALL
write a plan approval or a retro answer from a triage answer.

#### Scenario: An answer with no source
- **WHEN** the requirements stage passed and a line under the triage heading of `requirements.md` names no source
- **THEN** the change's next action is its grill, naming that question

#### Scenario: The triage agent's tools
- **WHEN** the triage agent is defined
- **THEN** it has no tool that writes or runs commands, and the approval record refuses its write as it refuses every subagent's

#### Scenario: The heading's end
- **WHEN** the triage heading is the last one of the file, or a fenced block under it holds a numbered line
- **THEN** the lines up to the next heading of the same or a higher level, or to the end of the file, are read, and a line inside a fenced block is not an answer

### Requirement: A requirement a merged change contradicts reopens the grill
When the plan is written and code merged since the grill contradicts what a requirement says, the
planner SHALL write no plan file, add the question to `requirements.md` and set its header back to
pending, so the grill asks the owner again. Any other drift (an ADR number, a release version, a
moved file) SHALL be resolved in the plan without asking the owner.

#### Scenario: A contradicted requirement
- **WHEN** a requirement names a field that a change merged after the grill removed
- **THEN** the requirements file is pending again with the question added, no proposal is written, and the next action is the grill

#### Scenario: An ADR number taken
- **WHEN** the next free ADR number moved because a sibling merged first
- **THEN** the plan takes the next free number, and the owner is not asked

### Requirement: A lone change schedules nothing
A `/devkit change` run SHALL create no schedule and no wake-up: no action of the change loop asks for
one, and the parts of the devkit skill that run one change name no scheduling tool.

#### Scenario: Every action of a change run
- **WHEN** a `/devkit change` run goes from its grill to its archive
- **THEN** no action asks for a schedule, and no periodic check exists in the session
