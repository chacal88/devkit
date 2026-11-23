<!-- devkit-stage specs result=passed attempt=2 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: Opening a change records the versions it opened with
Opening a change, through `/devkit change`, `/devkit roadmap` or `/devkit project`, SHALL write to its
`.openspec.yaml` the devkit-openspec version that opened it and the version of its script's installed
flow, under keys that OpenSpec reads without a warning. A script with no installed flow SHALL get no
flow version.

#### Scenario: A change opened on the full or the short script
- **WHEN** a change is opened on `devkit` or on `devkit-lite`
- **THEN** its `.openspec.yaml` holds the version of the pack that opened it and flow version 1, and `openspec status --change <id>` prints no unrecognized-key warning

#### Scenario: A slice opened by the project entry
- **WHEN** a slice is opened with `/devkit project`
- **THEN** its `.openspec.yaml` holds the pack's version and the flow version of `devkit-project`

#### Scenario: A script with no installed flow
- **WHEN** a change is opened on a script whose schema folder holds no `flow.json`
- **THEN** its `.openspec.yaml` holds the pack's version and no flow version

### Requirement: A change moves to the installed flow only on request
A command of the loop SHALL move one change to the installed flow of its script and record the new
flow and pack versions, only when run for that change. Resuming, waiting on GitHub, opening another
change, re-running the setup and updating the pack SHALL leave a change's recorded versions as they
were. When the command cannot run (no active change of that name, no installed flow for the change's
script, a malformed recorded flow version) it SHALL stop with a usage error and write nothing.

#### Scenario: Moving a change
- **WHEN** the owner asks to move a change that follows flow version 1 while version 2 is installed, and the command runs
- **THEN** the change records flow version 2 and the pack's version, the reply says so, and the readout then lists version 2's stages

#### Scenario: Nothing to move
- **WHEN** the command runs for a change that already follows the installed flow version
- **THEN** nothing changes and no reply is given

#### Scenario: A change newer than the installed flow
- **WHEN** the command runs for a change that follows flow version 3 while version 2 is installed
- **THEN** nothing changes, the command exits 2 and the reply says to update devkit first

#### Scenario: The command cannot run
- **WHEN** the command runs for a change that is unknown or archived, for a change whose script has no installed `flow.json`, or for a change whose recorded `x-devkit-flow` is not a whole number from 1
- **THEN** it exits 3, its error names the cause (the change, the script or the recorded value), and the change's `.openspec.yaml`, when there is one, is byte for byte the same

#### Scenario: Other commands leave the version
- **WHEN** a change follows flow version 1, version 2 is installed, and the loop's next step, a wait, the opening of another change, a setup re-run and a pack update run
- **THEN** the change's `.openspec.yaml` is byte for byte the same

### Requirement: A script switch records the installed flow of the new script
Switching a change's script before its proposal exists SHALL record the installed flow version of the
new script and the pack's version, and SHALL keep its other lines. A switch that changes nothing SHALL
write nothing.

#### Scenario: The short script becomes the full one
- **WHEN** a change on `devkit-lite` is switched to `devkit` before any proposal
- **THEN** its `.openspec.yaml` names `devkit`, holds the flow version of the installed `devkit` flow and keeps its `created` line

#### Scenario: A switch to the same script
- **WHEN** a switch names the script the change already uses
- **THEN** its `.openspec.yaml` is byte for byte the same

### Requirement: The resume reply names a newer installed flow
When `/devkit change` resumes a change whose script's installed flow is newer than the one it
follows, the first reply SHALL carry one more line naming both versions and saying the change moves
only if the owner asks, in the person's language. When the versions are equal the reply SHALL be as
before this change.

#### Scenario: Resuming a change with a newer flow installed
- **WHEN** `/devkit change <id>` resumes a change that follows flow version 1 while version 2 is installed, in `en` and in `pt-BR`
- **THEN** the reply says it is continuing the change and where it stopped, then one line naming version 1 and version 2 and that it moves only if the owner asks

#### Scenario: Resuming a change on the installed flow
- **WHEN** `/devkit change <id>` resumes a change that follows the installed flow version
- **THEN** the reply is the continuing reply alone, as before this change
