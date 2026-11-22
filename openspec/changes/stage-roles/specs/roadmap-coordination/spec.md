<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The owner's gates are asked one change at a time
When open changes wait at gates of the owner (the grill, the mock-up approval, the plan approval,
the retro answers, a pull-request decision only the owner can take, a merge left to the owner), the
session SHALL ask the gates of one change at a time, in the order of the roadmap file, naming the
change; the next change's questions SHALL come only when that change's gate is answered.

#### Scenario: Two changes at their grill
- **WHEN** two open changes wait for their grill, the first in the file being `a`
- **THEN** the questions asked name `a`, and `b` is asked only after `a`'s grill is answered

#### Scenario: A gate of a change earlier in the file during another change's grill
- **WHEN** the grill of `b` is being asked and `a`, earlier in the file, reaches its plan approval
- **THEN** the questions of `b`'s grill go on, and `a`'s approval is asked after them

#### Scenario: The others keep running
- **WHEN** a change waits for the owner and another open change has a stage ready
- **THEN** the other change's stage is handed in the same decision

#### Scenario: A mock-up waits while another change is asked
- **WHEN** `a`'s plan approval is being asked and `b`, later in the file, reaches its mock-up approval
- **THEN** `b`'s mock-up is shown and asked only after `a`'s approval is answered

### Requirement: The run's replies come from the one message table
Every line and reply of `/devkit roadmap` and `/devkit status` SHALL come from the message table of
`/devkit change`, in the person's language (`pt-BR` or `en`), with no internal term.

#### Scenario: Both languages
- **WHEN** every new message of the table is rendered in English and in Brazilian Portuguese
- **THEN** both languages have the same keys and none holds a stage, role or step id, a file name, a script name or an option

#### Scenario: A blocked line for every reason
- **WHEN** a change of the run stops for any reason a change can stop with (a stage failed too often, a change of the previous script, a change that could not be opened, and every other)
- **THEN** its line and its entry in the list of a run that ends say that reason in the person's language, with the reason's own details, and the run goes on

#### Scenario: A gate phrase for every owner gate
- **WHEN** a change of the run waits for the owner at any gate a change can wait at (the grill, the mock-up approval, the plan approval, the retro, a merge, a decision, a disputed review, an unfinished file, a delivery by hand)
- **THEN** its line names the change and says what the owner is asked for in the person's language
