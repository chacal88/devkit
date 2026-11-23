<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The delivery follows the change's pull request
When every stage before the delivery passed, the checker SHALL decide the delivery from the
project's ship mode and the change's pull request, read with `gh` only in the `pr` and `merge`
modes, as the scenarios below state. A merged pull request SHALL pass the delivery and the walk
SHALL go on to the retro only when the change is delivered: the pull request is the change's own
and every task of its `tasks.md` on the default branch is ticked.

#### Scenario: Ship mode plan
- **WHEN** the project's ship mode is `plan`
- **THEN** the run ends waiting for the owner, who opens and merges the pull request, and nothing is read from GitHub

#### Scenario: GitHub cannot be read
- **WHEN** `gh` is missing or fails while looking for the change's pull request
- **THEN** the run ends blocked, quoting the error

#### Scenario: No pull request yet
- **WHEN** the change has no pull request
- **THEN** the next stage is the delivery, with the reason that there is no pull request yet

#### Scenario: The head is not pushed
- **WHEN** the change's open pull request is not at the local head commit
- **THEN** the next stage is the delivery, with the reason that the work must be pushed first

#### Scenario: The checks cannot be read
- **WHEN** the change's open pull request is at the local head and its checks cannot be read for any reason other than a `gh` too old to read them
- **THEN** the run ends blocked, quoting the error

#### Scenario: A gh too old to read the checks
- **WHEN** the change's open pull request is at the local head and `gh pr checks` fails because the installed `gh` does not know its `--json` or `--required` option, `gh --version` printing `gh version 2.46.0 (2024-03-18)`
- **THEN** the run ends blocked with the reason `gh-too-old`, whose readout in English and in Brazilian Portuguese names the installed version `2.46.0` and `2.50.0`, the first version that reads the checks, says to update `gh`, and does not say the checks cannot be read

#### Scenario: A gh too old whose version cannot be read
- **WHEN** the same failure happens and `gh --version` fails or prints a first line that is not `gh version <major>.<minor>.<patch>`
- **THEN** the run ends blocked with the reason `gh-too-old`, its readout giving the installed version as unknown and naming `2.50.0`

#### Scenario: A check fails
- **WHEN** a check of the change's open pull request fails
- **THEN** the next stage is the implementation, with the failing checks named and linked

#### Scenario: Green checks in pr mode
- **WHEN** the ship mode is `pr` and every check of the change's open pull request passed
- **THEN** the run ends waiting for the owner, who merges the pull request

#### Scenario: Green checks in merge mode with auto-merge off
- **WHEN** the ship mode is `merge`, every check passed and auto-merge is not on
- **THEN** the next stage is the delivery, with the reason that auto-merge is not on yet

#### Scenario: Green checks in merge mode with auto-merge on
- **WHEN** the ship mode is `merge`, every check passed and auto-merge is on
- **THEN** the run ends waiting on GitHub, naming what GitHub waits for before it merges

#### Scenario: A merged pull request
- **WHEN** the change's own pull request is merged, every task of its `tasks.md` on the default branch is ticked, and the retro has not been written
- **THEN** the delivery is reported passed and the next stage is the retro

#### Scenario: A merged pull request with tasks left
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has unticked tasks
- **THEN** the delivery is not passed and the next stage is the implementation, naming the pull request and the tasks left

#### Scenario: A closed pull request
- **WHEN** the change's pull request was closed without merging
- **THEN** the run ends blocked, naming the pull request
