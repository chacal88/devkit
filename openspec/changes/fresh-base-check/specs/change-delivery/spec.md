<!-- devkit-stage specs result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Spec Delta

## ADDED Requirements

### Requirement: The delivery checkers never fetch
The delivery checker and the round checker that reuses its delivery rows SHALL read the base from the
local tracking ref and SHALL never fetch. Keeping the base fresh is the job of the loop that drives
the change. The header comment of each checker SHALL say that it never fetches.

#### Scenario: The delivery checker on a stale base
- **WHEN** the delivery checker runs for a change whose base's tracking ref is behind the remote
- **THEN** no fetch runs and the tracking ref stays where it was

#### Scenario: The round checker on a stale base
- **WHEN** the round checker runs for the same change
- **THEN** no fetch runs and the tracking ref stays where it was

#### Scenario: The headers say it
- **WHEN** the two checkers' header comments are read
- **THEN** each says that the checker never fetches
