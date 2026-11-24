<!-- devkit-stage specs result=passed attempt=2 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The kit records what it installed
Every run of `compozy-setup` SHALL record, for each kit file it writes under `.compozy/`, a digest
of the bytes written and the inputs it filled them with, so that a later run can tell a file the
project edited from one it did not.

#### Scenario: A first install
- **WHEN** `compozy-setup` runs in a project with no `.compozy/`
- **THEN** it writes `config.toml`, `README.md`, one `agents/<role>/AGENT.md` for every role the kit ships an agent for, `loops/devkit-change/loop.yaml`, `loops/devkit-review/loop.yaml`, `loops/devkit-roadmap/loop.yaml` and `bin/devkit-kit`, and records a digest for each with the inputs used

### Requirement: A re-run never replaces an edited file without the owner's yes
On a re-run, a kit file that differs from its recorded digest, or has none, and differs from the
current template SHALL be left in place; the run SHALL show its difference from the current
template and write it only when the owner accepts that file.

#### Scenario: An edited loop
- **WHEN** the project edited `.compozy/loops/devkit-change/loop.yaml` after the install and `compozy-setup` runs again
- **THEN** the file is left as the project edited it, its difference from the current template is shown, and the other unedited files are updated

#### Scenario: The owner accepts the difference
- **WHEN** the owner answers yes for `loop.yaml` and the run is repeated with that file accepted
- **THEN** `loop.yaml` is replaced by the current template and its digest recorded

#### Scenario: An install from before the record existed
- **WHEN** `.compozy/` has no record of digests and its `config.toml` differs from the current template
- **THEN** `config.toml` is treated as edited: shown, and left in place until the owner accepts it

## ADDED Requirements

### Requirement: A re-run removes the retired files the project did not edit
On a re-run, each file of the old kit (`agents/tech-lead/AGENT.md`, `agents/dev/AGENT.md`,
`agents/qa/AGENT.md`, `agents/design/AGENT.md` and `loops/openspec-change/loop.yaml`) whose bytes
match its recorded digest SHALL be deleted, with its folder when the folder is left empty, and
reported as removed.

#### Scenario: The old kit untouched
- **WHEN** `compozy-setup` runs over a project that has the old kit as it installed it
- **THEN** the four old agents and the old loop are deleted and reported, and the new agents and loops are written

### Requirement: A retired file the project edited stays and is named
On a re-run, a retired file that differs from its recorded digest, or has none, SHALL be left in
place and named in the run's output for the owner to decide; it SHALL be deleted only when the owner
accepts that file.

#### Scenario: A hand-edited old agent
- **WHEN** the project edited `.compozy/agents/qa/AGENT.md` and `compozy-setup` runs again
- **THEN** that file stays, the output names it as edited and kept, and the other retired files are deleted

#### Scenario: The owner accepts the removal
- **WHEN** the owner answers yes for that file and the run is repeated with it accepted
- **THEN** the file is deleted and reported as removed

### Requirement: Inputs the kit no longer uses are dropped
A re-run SHALL drop each recorded input the current kit no longer has a placeholder for, name it in
the output, and SHALL NOT fail because of it; an input given on the command line that the kit does
not have SHALL still be a usage error.

#### Scenario: The old planner input
- **WHEN** the record holds `__PLANNER__` from the old kit and `compozy-setup` runs again
- **THEN** the run completes, the output names the input as dropped, and the new record does not hold it

### Requirement: The kit's agents are generated from the Claude agents
Every agent the kit ships SHALL be generated from the Claude agent file of the same name, with that
agent's description and instructions, and a check run in CI SHALL fail while a generated agent
differs from what its source generates, or an agent is missing or extra.

#### Scenario: A source line changes
- **WHEN** one line of `plugins/core/agents/spec-reviewer.md` changes and the agents are not generated again
- **THEN** the check fails naming `spec-reviewer`, and passes once the agents are generated again

#### Scenario: One agent per role with an agent file
- **WHEN** the kit's agents are listed
- **THEN** there is exactly one per devkit role that has a Claude agent file, named as the role, and none named `tech-lead`, `dev`, `qa` or `design`

## REMOVED Requirements

### Requirement: The kit does not let an unattended run answer the grill
**Reason**: The old loop and its planner shell leave the kit. On the new loop the owner answers the
grill in CompozyOS, one question at a time, so no run records the questions as open questions.
**Migration**: The grill's questions reach the owner as CompozyOS human requests (the
`compozy-driver` capability, "The grill's questions reach the owner in CompozyOS one at a time").

### Requirement: The kit runs the new stages in its four shells
**Reason**: The four shells (`tech-lead`, `dev`, `qa`, `design`) leave the kit with the old loop,
so a requirement that the kit ship exactly those shells and that they dispatch the round-16 roles
would be false. On the new loop each of those roles is a CompozyOS agent of its own name, run when
the checker names its stage.
**Migration**: The decisions, the mock-up and the unit and E2E tests run as the stages the checker
names, by the agents `adr-author`, `screen-designer`, `test-runner` and `e2e-tester` (the
`compozy-driver` capability, "Each turn asks the checker and runs the agent it names"; this
capability, "The kit's agents are generated from the Claude agents"); the mock-up's approval is the
owner's answer in CompozyOS and the records are accepted by the loop's own step after the recorded
plan approval (the `compozy-driver` capability, "The mock-up approval is the owner's answer in
CompozyOS" and "The run runs the checker's commands itself").
