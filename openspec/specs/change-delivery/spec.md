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
record stale, unless the merge is a merge of the base that the own-files rule exempts (requirement
"A merge of the base is judged by the change's own files"). Every other commit after the record,
each commit the merge brings in included, SHALL be judged by its own files as before, under the
same exemption for a commit of the base. The stage checker SHALL report the same.

#### Scenario: The base brings only openspec files
- **WHEN** a branch has a product commit before the commit its reviews and `evidence.md` record, and a merge of the base after the record brings only files under `openspec/`
- **THEN** the delivery checker reads the approved or declined reviews and the evidence as current, and the stage checker reports the evidence and review stages passed

#### Scenario: A rejected review when the base brings only openspec files
- **WHEN** the same merge comes after a review that rejects at the recorded commit
- **THEN** the rejected review is stale and the reason names the merge commit and the first file it brought, as the rule for a rejected verdict says (`verdict-files`)

#### Scenario: The base brings a product file
- **WHEN** the same merge brings a file outside `openspec/` from the base, and `origin/<base>` is not available or that file is one of the change's own files
- **THEN** the record is stale with the reason `<recorded short> is behind <merge short>, which touches <that file>`, and the stage checker reports the evidence stage stale

#### Scenario: A product edit made while resolving the merge
- **WHEN** the base brings only files under `openspec/` and the merge commit also changes a file outside `openspec/` that is one of the change's own files, or `origin/<base>` is not available
- **THEN** the record is stale and the reason names the merge commit and that file

#### Scenario: A product file moved under openspec by the merge
- **WHEN** the merge commit moves one of the change's own files from outside `openspec/` to a path under `openspec/`, or moves any product file while `origin/<base>` is not available
- **THEN** the record is stale and the reason names the merge commit and the file's old path

#### Scenario: A product commit the merge brings in
- **WHEN** a commit of the base adds a file outside `openspec/` and a later commit of the base removes it, so the merge itself brings only files under `openspec/`, and `origin/<base>` is not available or that file is one of the change's own files
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

### Requirement: In the two-pull-request model only the pull request to the base branch delivers
In a project whose model is `two-prs`, a pull request SHALL be the change's own only when its base is
the configured base branch, besides the rules that already say which merged pull request is the
change's own. A merged pull request to the test branch SHALL never make the change delivered, and the
stage readout SHALL say which merge the change waits for.

#### Scenario: Only the test branch is merged
- **WHEN** the pull request to `develop` is merged and the pull request to `master` is open
- **THEN** the change is not delivered, the delivery checker does not reach the archive steps, and the stage readout names the pull request to `master` as the merge it waits for

#### Scenario: The base branch is merged
- **WHEN** the pull request to `master` is merged and the change's `tasks.md` on `master` has every task ticked
- **THEN** the change is delivered and the delivery checker answers the retro, as before this change

#### Scenario: Looked up from another branch
- **WHEN** the checkout is on `master` and the newest merged pull request that changes `openspec/changes/feat/` is the one to `develop`
- **THEN** that pull request is not taken as the change's own

#### Scenario: The readout before the test-branch merge
- **WHEN** both pull requests are open and green
- **THEN** the stage readout names the pull request to the test branch as the merge it waits for

### Requirement: An ADR number taken on the default branch is renumbered without the owner
From the implementation on, when the change's branch adds an ADR file in `docs/adr/` or
`docs/decisions/` whose four-digit number the default branch already gives another file of the same
folder, the next step SHALL hand the implementer the renumbering: each such file to the next free
number, and every reference to it in the branch's files. The owner SHALL NOT be asked.

#### Scenario: A sibling took the number
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch holds `docs/adr/0016-b.md` and `docs/adr/0017-c.md`
- **THEN** the next step renumbers `docs/adr/0016-a.md` to `0018`, handed to the implementer, and names both paths

#### Scenario: No clash
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch has no other file numbered `0016` in that folder
- **THEN** no renumbering step is given

#### Scenario: The same file on both
- **WHEN** the default branch holds the same `docs/adr/0016-a.md` the branch added, after a merge
- **THEN** no renumbering step is given

#### Scenario: Two clashes
- **WHEN** the branch adds `0016-a.md` and `0017-b.md` and the default branch holds other files numbered `0016` and `0017`, its highest being `0017`
- **THEN** the step renumbers them to `0018` and `0019`, in the order of their numbers

### Requirement: A train's pull request is never a change's own
A merged pull request whose head branch is `train/<n>` SHALL never be taken as a change's own pull
request, whatever files it changes, as an archive head is not.

#### Scenario: Looked up from the default branch
- **WHEN** the checkout is on `main` and the newest merged pull request that changes `openspec/changes/alpha/` is the one from `train/4`
- **THEN** that pull request is not taken as `alpha`'s own, and `alpha`'s own pull request is looked up among the others

### Requirement: A change carried by a merged train is delivered
In a train project, a change SHALL be delivered when the record of a merged train on the default
branch lists it as boarded at the head of its own pull request and every task of its `tasks.md` on the
default branch is ticked, whether GitHub reports that pull request as merged, open or closed.

#### Scenario: GitHub marked it merged
- **WHEN** `alpha`'s pull request is merged and the record of merged train 4 lists `alpha` at that pull request's head
- **THEN** `alpha` is delivered and the delivery checker answers its retro

#### Scenario: GitHub left it open
- **WHEN** `beta`'s pull request is open at the head the record of merged train 4 lists
- **THEN** `beta` is delivered, and the next step closes that pull request with a comment naming train 4 and its pull request before the retro

#### Scenario: A head the train did not carry
- **WHEN** `beta`'s pull request is open at a head other than the one the record of merged train 4 lists
- **THEN** `beta` is not delivered by that train and follows the ordinary steps

### Requirement: The whole suite of a train project is proven by the train
In a train project, a gate part of `tasks.md` equal to a part of the train's whole-suite command SHALL
not need a passing row in `evidence.md`; every other gate part SHALL, as before.

#### Scenario: The whole suite in the last gate
- **WHEN** the train's command is `node --test all.test.mjs && python3 check.py` and the last gate is `node --test area.test.mjs && node --test all.test.mjs`
- **THEN** the tasks item is met with a passing row for `node --test area.test.mjs` alone, and reports the other part as proven by the train

#### Scenario: Without the train
- **WHEN** the project has no train setting and the same gate
- **THEN** the tasks item needs a passing row for both parts, as before this change

#### Scenario: The change's own pull request in CI
- **WHEN** the default branch's configuration sets the train's command to `node --test all.test.mjs && python3 check.py`, and `devkit-reviews` runs on `alpha`'s own pull request, whose last gate is `node --test area.test.mjs && node --test all.test.mjs` and whose `evidence.md` has a passing row for `node --test area.test.mjs` only
- **THEN** the check passes the tasks item, reporting `node --test all.test.mjs` as proven by the train

#### Scenario: The change's own pull request in CI without the train
- **WHEN** the default branch's configuration has no train setting and the same pull request, gate and evidence
- **THEN** the check fails the tasks item, naming `node --test all.test.mjs` as having no passing row

#### Scenario: A row that names the train is not a pass
- **WHEN** `evidence.md` has, for `node --test all.test.mjs`, a row whose last cell reads `train: proven by the train record`, and the train setting that reader reads is missing
- **THEN** the tasks item is open, naming `node --test all.test.mjs` as having no passing row

### Requirement: A merge of the base is judged by the change's own files
The change's own files SHALL be the paths that differ between the merge base of `origin/<base>` and
the head, and the head, plus every path under `openspec/changes/<id>/`; a release file SHALL never
be one. A merge of the base, and each commit of the base it brings in, SHALL leave the recorded
evidence and the approved or declined reviews current when none of its files is one of them, and
SHALL make them stale when one is, the reason naming that commit and that file.

#### Scenario: The base brings only unrelated files
- **WHEN** `evidence.md` and the approved reviews record commit R, and a merge of `origin/<base>` after R brings `src/other.ts` and `openspec/changes/other/tasks.md`, none of which the branch changed
- **THEN** the delivery checker reads the evidence and every approved review as current, it hands no `verify` and no `review` step because of that merge, and the stage checker reports the evidence and review stages passed

#### Scenario: The base brings a file the branch changed
- **WHEN** the branch changed `src/a.ts` and a merge of `origin/<base>` after R brings a change to `src/a.ts`
- **THEN** the evidence and every review are stale with the reason `<R short> is behind <merge short>, which touches src/a.ts`

#### Scenario: The base brings a test file the branch changed
- **WHEN** the branch changed `src/a.test.ts` and a merge of `origin/<base>` after R brings a change to it
- **THEN** the evidence is stale and the reason names the merge commit and `src/a.test.ts`

#### Scenario: One own file among unrelated ones
- **WHEN** a merge of `origin/<base>` after R brings `src/other.ts`, which the branch did not change, and `src/a.ts`, which it did
- **THEN** the evidence and the reviews are stale and the reason names `src/a.ts`

#### Scenario: The base brings only release files
- **WHEN** a merge of `origin/<base>` after R brings only release files (a plugin manifest, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`), the ones the branch itself bumped included, the merge's own resolution of them included
- **THEN** the evidence and every approved review are current

#### Scenario: A file the branch changed then restored
- **WHEN** the branch changed `src/b.ts` in an early commit and restored it later, so it no longer differs from the base, and a merge of `origin/<base>` after R brings a change to `src/b.ts`
- **THEN** `src/b.ts` is not one of the change's own files and that merge leaves the records current

### Requirement: The own-files exemption fails safe
A merge SHALL be exempted only when it is a merge of the base: a merge on the branch's own line,
its first parent not contained in `origin/<base>` and every other parent contained in it. With
`origin/<base>` missing, or with the head already contained in `origin/<base>`, no commit SHALL be
exempted and every verdict SHALL be the one given before this rule.

#### Scenario: No origin of the base
- **WHEN** `origin/<base>` does not resolve and a merge of the local base after R brings only unrelated product files
- **THEN** the records are stale exactly as before this rule, with the same reason

#### Scenario: A base the checkout has not fetched
- **WHEN** the branch merged a commit of the base that the local `origin/<base>` does not contain yet
- **THEN** that merge is not exempted and the records are stale as before this rule

#### Scenario: A merge of another branch
- **WHEN** a merge after R brings a branch other than the base, whose files are unrelated to the change
- **THEN** the merge is judged as before this rule and the records are stale

#### Scenario: The head is already in the base
- **WHEN** `origin/<base>` contains the head
- **THEN** no commit after R is exempted

### Requirement: A plain commit on the branch keeps its rule
A commit on the branch's own line that is not a merge of the base SHALL be judged as before the
own-files rule, whatever files it touches, and the per-reviewer allowances (the test-spared
reviewers, the `openspec/`-only rule for approved or declined verdicts) SHALL stay as they are.

#### Scenario: A plain product commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit on the branch changes `src/unrelated.ts`, a file the branch never changed before
- **THEN** the records are stale and the reason names that commit and `src/unrelated.ts`

#### Scenario: A test-only commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit changes only test files
- **THEN** the reviews of the four test-spared reviewers stay current and the evidence and the other reviews are stale, as before this rule
