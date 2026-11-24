<!-- devkit-stage specs result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A stale stage runs again alone
A stage after the implementation whose header commit is behind a later commit that changes product
code SHALL be reported stale and offered again, and a later stage that is still current SHALL NOT
be offered again. Whether a later commit changes product code SHALL be judged by the delivery
checker's rule (`change-delivery`), so a merge of the base that brings none of the change's own
files does not make a stage stale.

#### Scenario: Only the stale stage is offered
- **WHEN** the demonstration's header commit is behind a product commit and the review's header commit is that product commit
- **THEN** the demonstration is reported stale and is the next stage, and the review is reported passed

#### Scenario: A merge of the base that brings no own file
- **WHEN** the unit-tests, evidence and review headers record commit R, and the only later commit is a merge of `origin/<base>` that brings product files the branch did not change
- **THEN** those stages are reported passed and none of them is offered again

#### Scenario: A merge of the base that brings an own file
- **WHEN** the same merge also brings a change to a product file the branch changed
- **THEN** the first of those stages is reported stale with the reason code `stale-code` naming the merge commit and that file, and it is the next stage
