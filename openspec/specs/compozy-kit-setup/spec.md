# compozy-kit-setup Specification

## Purpose
Says how the kit installer of devkit-compozy, which `/devkit setup` runs, installs the CompozyOS kit's
files into a project and installs them again on a later run without losing a project's own edits,
and what the kit tells an unattended run about the grill.

## Requirements

### Requirement: The kit records what it installed
Every run of the kit installer devkit-compozy ships (`install-kit.mjs`, run by `/devkit setup`)
SHALL record, for each kit file it writes under `.compozy/`, a digest of the bytes written and the
inputs it filled them with, so that a later run can tell a file the project edited from one it did
not.

#### Scenario: A first install
- **WHEN** the kit installer runs in a project with no `.compozy/`
- **THEN** it writes `config.toml`, `README.md`, one `agents/<role>/AGENT.md` for every role the kit ships an agent for, `loops/devkit-change/loop.yaml`, `loops/devkit-review/loop.yaml`, `loops/devkit-roadmap/loop.yaml` and `bin/devkit-kit`, and records a digest for each with the inputs used

### Requirement: A re-run updates the files the project did not edit
On a re-run, a kit file whose bytes still match the recorded digest SHALL be replaced by the
current template, filled with the recorded inputs, without a question. A kit file whose bytes
already equal that rendering SHALL be reported `same`, SHALL NOT be written, and SHALL have its
digest recorded.

#### Scenario: An unedited file with a newer template
- **WHEN** the kit's `README.md` template changed and the project's `.compozy/README.md` matches its recorded digest
- **THEN** the re-run writes the new `README.md` and records its new digest

#### Scenario: A file already equal to its rendering
- **WHEN** the project's `.compozy/config.toml` already equals the current template filled with the recorded inputs and the kit installer runs again
- **THEN** the re-run reports it `same`, does not write it, and records its digest in the manifest

### Requirement: A re-run never replaces an edited file without the owner's yes
On a re-run, a kit file that differs from its recorded digest, or has none, and differs from the
current template SHALL be left in place; the run SHALL show its difference from the current
template and write it only when the owner accepts that file.

#### Scenario: An edited loop
- **WHEN** the project edited `.compozy/loops/devkit-change/loop.yaml` after the install and the kit installer runs again
- **THEN** the file is left as the project edited it, its difference from the current template is shown, and the other unedited files are updated

#### Scenario: The owner accepts the difference
- **WHEN** the owner answers yes for `loop.yaml` and the run is repeated with that file accepted
- **THEN** `loop.yaml` is replaced by the current template and its digest recorded

#### Scenario: An install from before the record existed
- **WHEN** `.compozy/` has no record of digests and its `config.toml` differs from the current template
- **THEN** `config.toml` is treated as edited: shown, and left in place until the owner accepts it

### Requirement: A re-run removes the retired files the project did not edit
On a re-run, each file of the old kit (`agents/tech-lead/AGENT.md`, `agents/dev/AGENT.md`,
`agents/qa/AGENT.md`, `agents/design/AGENT.md` and `loops/openspec-change/loop.yaml`) whose bytes
match its recorded digest SHALL be deleted, with its folder when the folder is left empty, and
reported as removed.

#### Scenario: The old kit untouched
- **WHEN** the kit installer runs over a project that has the old kit as it installed it
- **THEN** the four old agents and the old loop are deleted and reported, and the new agents and loops are written

### Requirement: A retired file the project edited stays and is named
On a re-run, a retired file that differs from its recorded digest, or has none, SHALL be left in
place and named in the run's output for the owner to decide; it SHALL be deleted only when the owner
accepts that file.

#### Scenario: A hand-edited old agent
- **WHEN** the project edited `.compozy/agents/qa/AGENT.md` and the kit installer runs again
- **THEN** that file stays, the output names it as edited and kept, and the other retired files are deleted

#### Scenario: The owner accepts the removal
- **WHEN** the owner answers yes for that file and the run is repeated with it accepted
- **THEN** the file is deleted and reported as removed

### Requirement: Inputs the kit no longer uses are dropped
A re-run SHALL drop each recorded input the current kit no longer has a placeholder for, name it in
the output, and SHALL NOT fail because of it; an input given on the command line that the kit does
not have SHALL still be a usage error.

#### Scenario: The old planner input
- **WHEN** the record holds `__PLANNER__` from the old kit and the kit installer runs again
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

### Requirement: The kit installer ships in devkit-compozy with no setup skill
devkit-compozy SHALL ship the kit installer, the generator of the kit's agents and the templates
outside any skill folder, and SHALL ship no skill that installs the kit. `/devkit setup` SHALL be the
only entry that runs the installer, and SHALL find it in the devkit-compozy installed on the machine.

#### Scenario: The pack's skills
- **WHEN** the skills of devkit-compozy are listed
- **THEN** they are `screen-design` and `screen-demo`, and none installs the kit

#### Scenario: The installer found
- **WHEN** `/devkit setup` installs the kit and two versions of devkit-compozy with the kit installer are installed
- **THEN** the installer of the higher version runs, as the kit's resolver picks its own checkers

#### Scenario: An old devkit-compozy only
- **WHEN** the only installed devkit-compozy keeps its installer inside the removed setup skill
- **THEN** the installer is not found, the reply names `devkit-compozy` and the locations tried, and nothing is written
