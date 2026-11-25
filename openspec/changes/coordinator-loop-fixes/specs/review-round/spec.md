<!-- devkit-stage specs result=passed attempt=5 commit=f29093d9bb2a0c013b32c0cb223795f16b20d544 -->
# Spec Delta

## ADDED Requirements

### Requirement: A round beyond the second runs within the authorized limit
The round script SHALL accept an optional `limit` argument, a whole number of 2 or more, 2 when
absent, and a round from 1 to that limit. The prompts and `review.md` SHALL name the round as `round
<n> of <limit>` and `(round <n>/<limit>)`, and a failed round at the limit SHALL say the owner decides.

#### Scenario: A third round with its limit
- **WHEN** the round runs with `round: 3` and `limit: 3`
- **THEN** the arguments are accepted and `review.md` reads `Consensus: FAIL (round 3/3)` on a failure, with the deadlock sentence after round 3

#### Scenario: A third round with no limit
- **WHEN** the round runs with `round: 3` and no `limit`
- **THEN** the arguments are refused, as before

#### Scenario: A round above its limit
- **WHEN** the round runs with `round: 4` and `limit: 3`
- **THEN** the arguments are refused

#### Scenario: A limit below two
- **WHEN** the round runs with `limit: 1`, or a limit that is not a whole number
- **THEN** the arguments are refused

#### Scenario: No limit
- **WHEN** the round runs with `round: 2` and no `limit`
- **THEN** the texts are those of today: `round 2 of 2`, `(round 2/2)` and the deadlock after round 2
