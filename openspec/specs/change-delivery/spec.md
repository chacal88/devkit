# change-delivery Specification

## Purpose
Says when a change counts as delivered after a pull request merges, which merged pull request is
the change's own, and what the delivery checker answers while a task of the change is left.

## Requirements

### Requirement: A change's own pull request
A merged pull request SHALL be the change's own only when it changes a file under the change's
active folder `openspec/changes/<id>/`, brings no folder under `openspec/changes/archive/`, and its
head branch is not an archive branch (`chore/archive-<name>` or `archive-<name>`). A pull request
that only names the change, or links its evidence, SHALL NOT be its own.

#### Scenario: A body that links the evidence
- **WHEN** a merged pull request's body links `openspec/changes/foo/evidence.md` and its diff touches nothing under `openspec/changes/foo/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: Another change's archive pull request
- **WHEN** the archive pull request of `bar` (head `chore/archive-bar`) names `foo` in its body and moves `openspec/changes/bar/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: An unrelated head ending in the id
- **WHEN** a merged pull request from `fix/foo` touches no file under `openspec/changes/foo/`
- **THEN** it is not the change pull request of `foo`

#### Scenario: A head that does not name the change
- **WHEN** a merged pull request from `calm-badger` changes `openspec/changes/foo/tasks.md`
- **THEN** it is the change pull request of `foo`

### Requirement: Delivered means its own pull request merged and every task ticked
A change SHALL be delivered when it is archived, or when its own pull request is merged and every
task of its `tasks.md` on the default branch is ticked. Only a delivered change SHALL lead the
delivery checker to the archive steps.

#### Scenario: Every task ticked on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked
- **THEN** `deliver-check.mjs <id>` answers the retro, as before this change

#### Scenario: A partial pull request merged
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has unticked tasks
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Only a pull request that names it
- **WHEN** no own pull request of the change is merged and a merged pull request links its evidence
- **THEN** `deliver-check.mjs <id>` answers no archive step

### Requirement: The work left after a merge is named
While a task of a change is unticked after its own pull request merged, the delivery checker
SHALL name the unticked tasks as the work left. On the change's own branch it SHALL lead through
the same delivery contract to a further pull request; on any other checkout it SHALL name the
branch to continue on.

#### Scenario: From the default branch
- **WHEN** `deliver-check.mjs foo` runs on the default branch after pull request #12 of `foo` merged with tasks 3.1 and 3.2 unticked
- **THEN** its next step names pull request #12, the tasks 3.1 and 3.2 and the branch `foo` to continue on

#### Scenario: On the change's own branch
- **WHEN** the work left is done and ticked on branch `foo` and no open pull request exists for it
- **THEN** the next step is to open a further pull request, never the retro

### Requirement: A task done after the merge is ticked before the archive
A task that can only be done after a merge SHALL be ticked in a further pull request of the change
before its archive; the retro SHALL come only after the last task is ticked on the default branch.

#### Scenario: The last task ticked in a further pull request
- **WHEN** the further pull request that ticks the last task of `foo` merges
- **THEN** `deliver-check.mjs foo` answers the retro

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

### Requirement: A merge commit is judged by what it brings into the branch
When the delivery checker decides whether a recorded `Commit:` is still current, a merge commit
after it SHALL count only the files that differ between its first parent and itself, edits made
while resolving and moved files included, and a file outside `openspec/` among them SHALL make the
record stale. Every other commit after the record, each commit the merge brings in included, SHALL
be judged by its own files as before. The stage checker SHALL report the same.

#### Scenario: The base brings only openspec files
- **WHEN** a branch has a product commit before the commit its reviews and `evidence.md` record, and a merge of the base after the record brings only files under `openspec/`
- **THEN** the delivery checker reads the reviews and the evidence as current, and the stage checker reports the evidence and review stages passed

#### Scenario: The base brings a product file
- **WHEN** the same merge brings a file outside `openspec/` from the base
- **THEN** the record is stale with the reason `<recorded short> is behind <merge short>, which touches <that file>`, and the stage checker reports the evidence stage stale

#### Scenario: A product edit made while resolving the merge
- **WHEN** the base brings only files under `openspec/` and the merge commit also changes a file outside `openspec/`
- **THEN** the record is stale and the reason names the merge commit and that file

#### Scenario: A product file moved under openspec by the merge
- **WHEN** the merge commit moves a file from outside `openspec/` to a path under `openspec/`
- **THEN** the record is stale and the reason names the merge commit and the file's old path

#### Scenario: A product commit the merge brings in
- **WHEN** a commit of the base adds a file outside `openspec/` and a later commit of the base removes it, so the merge itself brings only files under `openspec/`
- **THEN** the record is stale and the reason names a commit of the base, not the merge

#### Scenario: The branch's head is a merge made on the base
- **WHEN** the base merged the branch and the branch was then moved onto that merge, so the merge's first parent is the base
- **THEN** the merge is read against its first parent, and the branch's own product file that differs makes the record stale

#### Scenario: A root commit the merge brings in
- **WHEN** a merge of an unrelated history brings only files under `openspec/`, and that history's root commit adds a file outside `openspec/` that the merge leaves out
- **THEN** the record is stale and the reason names that root commit and that file

#### Scenario: A plain commit after a merge
- **WHEN** a merge of the base that brings only files under `openspec/` is followed by a one-parent commit that changes a file outside `openspec/`
- **THEN** the record is stale and the reason names that commit and that file

#### Scenario: Only plain commits after the record
- **WHEN** every commit after the record has one parent
- **THEN** the record is current or stale exactly as before this change, with the same reason

### Requirement: The delivery checker does not count a checkbox inside a fenced block
A checkbox line inside a fenced block of `tasks.md` SHALL NOT count as a task or as a gate for the
delivery checker, in the change's worktree and in the `tasks.md` it reads from the default branch. A
fence opens on a line starting, after optional spaces, with three or more backticks or tildes and
closes on the next such line of at least as many of the same character, the rule the stage checker
uses.

#### Scenario: An unticked example in a fence
- **WHEN** every task of `tasks.md` is ticked and an unticked checkbox line sits inside a block fenced with three backticks
- **THEN** `deliver-check.mjs <id>` lists no unticked task in the tasks item and its next step is not `implement`

#### Scenario: A gate in a fence
- **WHEN** a fenced block of `tasks.md` holds the line `- [ ] 9.9 Gate: run it` with no backticked command
- **THEN** the tasks item is not blocked for a gate without a command, and no phase of the report has a gate `9.9`

#### Scenario: A tilde fence
- **WHEN** the unticked checkbox line sits inside a block fenced with `~~~~`
- **THEN** it is not counted either

#### Scenario: The tasks on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked except a checkbox line inside a fenced block
- **THEN** the change is delivered and `deliver-check.mjs <id>` answers the retro

#### Scenario: A checkbox after the fence closes
- **WHEN** an unticked checkbox line follows the closing fence line
- **THEN** it is counted as an unticked task

#### Scenario: An unclosed fence hides nothing
- **WHEN** a line of `tasks.md` opens a fence with three backticks and no line closes it before the end of the text
- **THEN** that line opens no fence and hides nothing: the delivery checker and the stage checker read the lines after it as outside a fence, and only a later fence that closes hides its own lines

#### Scenario: A task and a gate after an unclosed fence are counted
- **WHEN** `- [x] 1.1 code` is followed by an unclosed fence opening line, then `- [ ] 1.2 more` and `` - [ ] 1.3 Gate: `node -e 0` green ``
- **THEN** the tasks item of `deliver-check.mjs <id>` lists `1.2` and `1.3` as unticked, phase 1's gate is `1.3`, and the stage checker counts both as pending

#### Scenario: The next step after an unclosed fence
- **WHEN** the change's plan is approved or a task is ticked, and the `tasks.md` of the scenario above is its tasks file
- **THEN** the next step of `deliver-check.mjs <id>` is `implement`, and its reason names `1.2`

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
