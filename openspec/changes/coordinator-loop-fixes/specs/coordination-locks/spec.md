<!-- devkit-stage specs result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Spec Delta

## ADDED Requirements

### Requirement: A recorded end releases the stop lock only for the run's change
The stop lock SHALL read a `devkit-end: <id> <state>` line of the session's record as the run's end
only when `<id>` is the run's change. A line naming another change SHALL release nothing, and the
stop SHALL be judged as if the line were absent.

#### Scenario: An end naming the run's change
- **WHEN** the run's change is `feat`, its record ends with `devkit-end: feat waiting-for-owner` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: An end naming another change
- **WHEN** the run's change is `feat`, its record ends with `devkit-end: other blocked` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the stop is refused once, naming that stage

#### Scenario: The owner's pause declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-pause --param id=feat` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: A decision outside the gates declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-owner-decision --param id=feat --param decision="the dependency upgrade"` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: The same turn without the declared end
- **WHEN** the session tries to stop with neither declared end in its record and a stage of `feat` ready
- **THEN** the stop is refused once, naming that stage
