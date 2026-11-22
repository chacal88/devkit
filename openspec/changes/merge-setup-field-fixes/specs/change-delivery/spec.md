<!-- devkit-stage specs result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Spec Delta

## ADDED Requirements

### Requirement: The delivery checker waits for pending checks while merge mode is not set up
In `merge` mode, when the next step of `deliver-check.mjs` is `stop-merge-setup` and the change's
open pull request has checks still pending, `deliver-check.mjs --watch` SHALL wait for those checks
as it does at `wait-checks`, within the same minute cap, then report the contract again with the
checks' final state. While the repository is not prepared the next step SHALL stay
`stop-merge-setup`, with the same exit code.

#### Scenario: The checks finish within the cap
- **WHEN** the repository has no rule requiring `devkit-reviews`, the change's pull request is open with a check pending, and `deliver-check.mjs <id> --watch` runs
- **THEN** it returns only after one `gh pr checks <n> --watch --interval 30` ends, its report shows the checks' final state in the checks item, the next step is still `stop-merge-setup` naming what is missing, the exit code is 2, and the report says the watch ended

#### Scenario: The cap ends first
- **WHEN** the same run's checks are still pending when the minute cap ends
- **THEN** the watch is stopped at the cap, the report says it stopped after that many minutes, the checks item still lists the pending checks, and the next step is still `stop-merge-setup`

#### Scenario: No check pending
- **WHEN** the next step is `stop-merge-setup` and the change's pull request has no pending check, or there is no open pull request
- **THEN** `deliver-check.mjs <id> --watch` starts no watch and returns at once, as before this change

#### Scenario: Without the watch option
- **WHEN** the next step is `stop-merge-setup` with checks pending and `deliver-check.mjs <id>` runs without `--watch`
- **THEN** no watch is started
