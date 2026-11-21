<!-- devkit-stage specs result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
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
- **WHEN** the change's open pull request is at the local head and its checks cannot be read
- **THEN** the run ends blocked, quoting the error

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

### Requirement: After a merge the walk resumes at the retro
Off the change's own branch (a default branch, the archive branch or no branch), in the `pr` and
`merge` modes, a merged pull request of a delivered change (its own pull request, every task
ticked on the default branch) SHALL switch the checker to the walk after the merge, which reports
every stage before the delivery from its header alone, with no staleness check and no task count,
passes the delivery and offers the retro. A merged pull request of a change that is not delivered
SHALL NOT switch it.

#### Scenario: Resuming at the retro after a squash merge
- **WHEN** the checkout is on the default branch, the change's own pull request was squash-merged with every task ticked, and the header commits of the demonstration and the review are no longer in the history
- **THEN** the implementation, the demonstration, the review and the delivery are reported passed, no stage is reported stale, and the next stage is the retro

#### Scenario: A pull request that only links the evidence
- **WHEN** the checkout is on the default branch and the only merged pull request naming the change links its evidence without changing a file of the change's folder
- **THEN** the checker does not switch to the walk after the merge and offers no retro

### Requirement: The checker refuses an OpenSpec it cannot read
The checker SHALL exit 3, naming the cause, when the `openspec` command is missing, when
`openspec --version` gives no version or a major other than 2, or when OpenSpec's answer for a live
change has no `artifacts` list (or `instructions apply` has no `tasks` list); with `--json` the
cause SHALL be the `error` field of `{ "version": 1, "error": ... }`. The command SHALL be the
project's pinned OpenSpec CLI when the project pins one, and the cause SHALL name where the
refused CLI was found.

#### Scenario: An OpenSpec other than 2.x
- **WHEN** `openspec --version` prints `3.0.0`
- **THEN** the checker exits 3 and its message names `3.0.0`

#### Scenario: No openspec command
- **WHEN** the `openspec` command is not on the `PATH` and the project pins none
- **THEN** the checker exits 3 and its message says the OpenSpec CLI is not installed

#### Scenario: An OpenSpec answer without artifacts
- **WHEN** `openspec status` for a live change answers with an error body and no `artifacts` list
- **THEN** the checker exits 3 and its message, in text and under `--json`, quotes OpenSpec's message

#### Scenario: A pinned OpenSpec other than 2.x
- **WHEN** the project's `node_modules/.bin/openspec` prints `1.16.0` and the `PATH` holds a 2.x `openspec`
- **THEN** the checker exits 3, its message names `1.16.0`, the path of the project's CLI and the move of the pin to 2.x, and the `PATH` one is never started

### Requirement: A change begun under the previous script is recognised
When the change's schema has no stage declaration, or the earliest stage file the change has, in
the order its declaration lists, carries no stage header, the checker SHALL say in plain text that
the change began under the previous script and that today's flow finishes it, list no stage, and
exit 0. A header on a later stage file SHALL NOT change that reading.

#### Scenario: A folder in the previous form
- **WHEN** the checker runs on a change whose `requirements.md` and `proposal.md` have no stage header
- **THEN** it reports the previous script, lists no stage, offers no next stage and exits 0

#### Scenario: A later file gains a header
- **WHEN** a change whose `proposal.md`, `design.md` and `tasks.md` carry no stage header gains an `evidence.md`, a `readiness.md` or a review file with one
- **THEN** the checker still reports the previous script

#### Scenario: A change opened on the current script
- **WHEN** the change's `requirements.md` carries a stage header and its `proposal.md` has none
- **THEN** the checker reads the current script and reports the proposal's missing header, as before this change
