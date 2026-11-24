<!-- devkit-stage specs result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
