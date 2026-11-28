<!-- devkit-stage specs result=passed attempt=1 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The 1M variant is an explicit opt-in
A `models:` value of `opus[1m]` or `sonnet[1m]` SHALL be accepted and carried by the loop's actions
exactly as written. The suffix SHALL reach only the retry's mapping on the action; a roadmap run's
helper and every stage subagent SHALL run on the plain family, since the session drops the suffix on
the call that starts them.

#### Scenario: A 1M variant for one stage
- **WHEN** the project's `models:` holds `implementation: sonnet[1m]`
- **THEN** the implementation's hand-offs carry the model `sonnet[1m]`

#### Scenario: A 1M variant on a stage subagent
- **WHEN** the implementation's hand-off carries `sonnet[1m]` and the `devkit` skill's Loop is followed
- **THEN** the Agent call's `model` is `sonnet`, and the documents say the opt-in never reaches a stage subagent

#### Scenario: A 1M variant on a helper
- **WHEN** the project's `models:` holds `requirements: opus[1m]` and a tick claims a change at its grill
- **THEN** the helper is started on `opus`
