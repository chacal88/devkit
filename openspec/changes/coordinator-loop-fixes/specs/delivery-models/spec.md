<!-- devkit-stage specs result=passed attempt=4 commit=fd29ac6c22ab2b8c385200a8f357d6d7796fd281 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A resolution review deadlock goes to the owner
A conflict resolution still rejected after the last review round its limit allows SHALL end the run
waiting for the owner's decision, as a code-review deadlock does, and the support branch SHALL not be
pushed. The resolution's round limit SHALL be 2 plus the rounds the owner authorized for the
resolution's review at its deadlock; a round authorized for the code review SHALL NOT raise it.

#### Scenario: Still rejected after the second round
- **WHEN** no round was authorized for the resolution's review and a required reviewer still rejects the resolution after the second round
- **THEN** the run ends waiting for the owner's decision on the review dispute, the support branch is not pushed and the pull request does not move

#### Scenario: One more round authorized for the resolution
- **WHEN** one round was authorized for the resolution's review and a required reviewer still rejects the resolution after the second round
- **THEN** the next steps fix the resolution and review it as round 3 of 3, and the support branch is not pushed until the resolution is approved

#### Scenario: Still rejected at the authorized limit
- **WHEN** one round was authorized for the resolution's review and a required reviewer still rejects the resolution after round 3
- **THEN** the run ends waiting for the owner's decision on the review dispute, the support branch is not pushed and the pull request does not move

#### Scenario: A round authorized for the code review
- **WHEN** one round was authorized for the code review only and a required reviewer still rejects the resolution after the second round
- **THEN** the run ends waiting for the owner's decision on the review dispute
