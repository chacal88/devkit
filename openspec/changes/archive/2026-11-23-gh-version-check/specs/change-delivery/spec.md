<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: The delivery checker names a gh too old to read the checks
When `gh pr checks` fails because the installed `gh` does not know its `--json` or `--required`
option, the delivery checker SHALL read `gh --version` once and report the checks item blocked,
naming the installed version, or saying it is unknown, and 2.50.0, the first `gh` that reads the
checks as JSON. It SHALL call `gh --version` in no other case.

#### Scenario: A gh older than 2.50.0
- **WHEN** `gh pr checks <n> --required --json name,state,bucket,link` exits 1 with `unknown flag: --json` and `gh --version` prints `gh version 2.46.0 (2024-03-18)`
- **THEN** the checks item is blocked, its reason names `2.46.0` and `2.50.0` and says to update `gh`, and its details carry the installed version `2.46.0` and the minimum `2.50.0`

#### Scenario: A gh that does not know the required option
- **WHEN** the same call exits 1 with `unknown flag: --required`
- **THEN** the checks item is blocked with the same old-`gh` reason

#### Scenario: The version cannot be read
- **WHEN** the call fails with `unknown flag: --json` and `gh --version` fails, prints nothing, or prints a first line that is not `gh version <major>.<minor>.<patch>`
- **THEN** the checks item is blocked with the old-`gh` reason, the installed version given as unknown and the minimum as `2.50.0`

#### Scenario: Other failures keep their reason
- **WHEN** `gh pr checks` fails with an HTTP or authentication error, times out, is not installed, or exits 0 with output that is not a JSON list
- **THEN** the checks item is blocked with the same reason as before this change, its details name no `gh` version, and `gh --version` is not called

#### Scenario: Checks read normally
- **WHEN** `gh pr checks` answers a JSON list of checks
- **THEN** `gh --version` is not called
