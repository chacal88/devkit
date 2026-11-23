<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: The check asks for readiness by the flow the change follows
For a change on a devkit script, the check SHALL ask for an approved readiness exactly when the flow
version the change follows declares a readiness stage, read from the pull request's checkout. A
change that records a flow version the checkout does not hold SHALL fail the check with a message
naming that version. Which changes the check judges SHALL NOT change.

#### Scenario: A removed readiness stage is still asked
- **WHEN** the pull request's change records flow version 1, the checkout's installed `devkit` flow is version 2 with no readiness stage, and its readiness is not approved
- **THEN** the check fails on the readiness

#### Scenario: A change opened on a flow without readiness
- **WHEN** the pull request's change records flow version 2, which has no readiness stage, and every item is met
- **THEN** the check passes and prints no readiness line

#### Scenario: A recorded flow the checkout does not hold
- **WHEN** the pull request's change records flow version 7 and the checkout holds no `flows/7.json` for its script
- **THEN** the check fails and its message names version 7

#### Scenario: A change with no recorded flow
- **WHEN** the pull request's change records no flow version and every installed flow is version 1
- **THEN** the check prints and exits as before this change
