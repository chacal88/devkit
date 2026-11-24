<!-- devkit-stage specs result=passed attempt=2 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: The roles of a run are those of the flow the change follows
In a run, the roles and helpers the session may hand work to, and the stage files a stage agent must
deliver before it stops, SHALL be those of the flow version the change follows, not of the installed
flow when it differs.

#### Scenario: A role of a stage removed later
- **WHEN** a change records flow version 1, the installed version 2 has no readiness stage, and the session in a run hands work to `devkit-core:plan-readiness-reviewer`
- **THEN** the hand-off is allowed

#### Scenario: A role of a stage the change's flow lacks
- **WHEN** a change records flow version 2, which has no readiness stage, and the session in a run hands work to `devkit-core:plan-readiness-reviewer`
- **THEN** the hand-off is refused

#### Scenario: A change on the installed flow
- **WHEN** a change follows the installed flow version and the session in a run hands work to a role of that flow
- **THEN** the hand-off is allowed, as before this change
