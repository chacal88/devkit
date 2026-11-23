<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

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
