<!-- devkit-stage specs result=passed attempt=1 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Every grill asks the triage agent first
In every grill whose flow lists the triage agent, of a lone `/devkit change` or of a roadmap run,
the questions SHALL first go to the triage agent, which reads the project's files and answers each
one they settle, naming its source. In a lone change only the questions nothing written settles SHALL
be asked of the owner; in a roadmap run they SHALL go to the owner's standing answers, then to a line
for the owner, as the roadmap conductor says. Each triage answer SHALL be recorded in
`requirements.md` under its own heading, apart from the owner's answers.

#### Scenario: A question an ADR answers
- **WHEN** a grill question asks whether the change may use a cron, and an ADR of the project decides it
- **THEN** the owner is not asked, and `requirements.md` records the answer as answered by triage with the ADR's path as its source

#### Scenario: A question nothing written settles
- **WHEN** in a lone `/devkit change` a grill question asks what the owner wants to see when a change is done, and no file says it
- **THEN** the question is asked of the owner, one at a time

#### Scenario: A question nothing written settles in a roadmap run
- **WHEN** in a roadmap run the same question is settled by no file and by no standing answer
- **THEN** no box is opened, and the question is written in the change's line for the owner in the run file

#### Scenario: The summary
- **WHEN** the grill ends
- **THEN** its summary lists the answers by triage apart from the owner's, each with its source
