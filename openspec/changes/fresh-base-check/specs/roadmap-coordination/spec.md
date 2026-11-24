<!-- devkit-stage specs result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Spec Delta

## ADDED Requirements

### Requirement: The roadmap's decisions are judged from a freshly fetched base
The roadmap command's `run`, `next` and `wait` SHALL fetch the base, as the change command's `next`
does, before they decide the action of a change in its delivery part: at most once per base in one
call, and again at each poll of a wait. A failed fetch SHALL NOT stop the decision. The status
command, its machine-readable form, the draft and the run's stop lock SHALL never fetch.

#### Scenario: Three changes in delivery
- **WHEN** `next` decides a roadmap whose three open changes are in delivery against the same base
- **THEN** the base is fetched exactly once in that call

#### Scenario: The roadmap's wait
- **WHEN** the roadmap's wait for a change in delivery polls twice
- **THEN** the base is fetched before each poll

#### Scenario: The status board on a stale base
- **WHEN** the status command reads a change in delivery whose base's tracking ref is behind the remote
- **THEN** no fetch runs and the tracking ref stays where it was

#### Scenario: The remote cannot be reached during a run
- **WHEN** `next` runs and the base cannot be fetched
- **THEN** the decision is made from the local copy, and each change in delivery records the failed fetch
