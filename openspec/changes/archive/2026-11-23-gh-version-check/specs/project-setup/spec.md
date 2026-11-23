<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: The setup names a gh too old for the delivery
The first step of `openspec-setup` SHALL check the installed `gh` once, next to the OpenSpec CLI, and
print one line: `ok` with the version for 2.50.0 or newer, else a warning naming the installed
version and 2.50.0, or saying `gh` is not installed or its version cannot be read. A warning SHALL
NOT stop the setup: the `plan` ship mode needs no `gh`.

#### Scenario: A gh older than 2.50.0
- **WHEN** `gh --version` prints `gh version 2.46.0 (2024-03-18)`
- **THEN** the check prints a warning naming `2.46.0` and `2.50.0` and saying the `pr` and `merge` ship modes need the newer one, exits 0, and the setup goes on

#### Scenario: No gh installed
- **WHEN** `gh` is not on `PATH`
- **THEN** the check prints a warning saying `gh` is not installed and naming `2.50.0`, exits 0, and the setup goes on

#### Scenario: A recent gh
- **WHEN** the first line of `gh --version` is `gh version 2.50.0` or `gh version 2.105.0`, each followed by its build date
- **THEN** the check prints `ok` with that version and exits 0

#### Scenario: A version that cannot be read
- **WHEN** `gh --version` fails or prints a first line that is not `gh version <major>.<minor>.<patch>`
- **THEN** the check prints a warning saying the version cannot be read and naming `2.50.0`, exits 0, and the setup goes on
