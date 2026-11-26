# change-delivery Specification

## Purpose
Says when a change counts as delivered after a pull request merges, which merged pull request is
the change's own, and what the delivery checker answers while a task of the change is left.

## Requirements

### Requirement: A change's own pull request
A merged pull request SHALL be the change's own only when it changes a file under the change's
active folder `openspec/changes/<id>/`, brings no file under the change's own archive folder
`openspec/changes/archive/<YYYY-MM-DD>-<id>/` (the exact id), and its head branch is not an archive
branch (`chore/archive-<name>` or `archive-<name>`) other than the change's own id. A head equal to the
change's id SHALL be the change's own branch whatever its prefix, so a change whose id starts with
`archive-` keeps its own pull request. A pull request that only names the change, or links its
evidence, SHALL NOT be its own.

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

#### Scenario: Another change's archived files
- **WHEN** a merged pull request from `ship/foo` changes `openspec/changes/foo/tasks.md` and `openspec/changes/archive/2026-11-09-bar/retro.md`
- **THEN** it is the change pull request of `foo`, and from the default branch in the `merge` ship mode the delivery checker finds it among the merged pull requests

#### Scenario: The change's own archive folder
- **WHEN** a merged pull request from `ship/foo` changes `openspec/changes/foo/tasks.md` and `openspec/changes/archive/2026-11-09-foo/retro.md`
- **THEN** it is not the change pull request of `foo`

#### Scenario: An id that starts another change's id
- **WHEN** a merged pull request changes a file of the change folder and a file under `openspec/changes/archive/2026-11-09-foo-two/` (or, for `foo-two`, under `openspec/changes/archive/2026-11-09-foo/`)
- **THEN** that archive folder does not keep it from being the change pull request of `foo` (or of `foo-two`)

#### Scenario: An id that starts with archive-
- **WHEN** a merged pull request from head `archive-x` changes `openspec/changes/archive-x/tasks.md`
- **THEN** it is the change pull request of `archive-x`, found on the branch `archive-x` and, from the default branch, among the merged pull requests

#### Scenario: The archive branch of an archive- id
- **WHEN** a merged pull request from head `chore/archive-archive-x` (or `archive-archive-x`) changes `openspec/changes/archive-x/tasks.md`
- **THEN** it is not the change pull request of `archive-x`

#### Scenario: The archive branch of an ordinary id
- **WHEN** a merged pull request from head `chore/archive-x` changes `openspec/changes/x/tasks.md`
- **THEN** it is not the change pull request of `x`

#### Scenario: Another change's archive- head
- **WHEN** a merged pull request from head `archive-y` changes `openspec/changes/archive-x/tasks.md` (or `openspec/changes/x/tasks.md`)
- **THEN** it is not the change pull request of `archive-x` (or of `x`)

### Requirement: Delivered means its own pull request merged and every task ticked
A change SHALL be delivered when it is archived, or when its own pull request is merged and every
task of its `tasks.md` on the default branch is ticked. A delivered change, or an owner's forced
merge, SHALL lead the delivery checker to the archive steps; no other merged pull request SHALL.

#### Scenario: Every task ticked on the default branch
- **WHEN** the change's own pull request is merged and its `tasks.md` on the default branch has every task ticked
- **THEN** `deliver-check.mjs <id>` answers the retro, as before this change

#### Scenario: A partial pull request merged
- **WHEN** the change's own pull request is merged, its `tasks.md` on the default branch has unticked tasks, and every required check of its head is `SUCCESS`
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Only a pull request that names it
- **WHEN** no own pull request of the change is merged and a merged pull request links its evidence
- **THEN** `deliver-check.mjs <id>` answers no archive step

#### Scenario: Every task ticked and a check red
- **WHEN** the change's own pull request is merged with every task ticked on the default branch and `devkit-reviews` `FAILURE` on its head
- **THEN** the change is delivered, `deliver-check.mjs <id>` answers the retro with the same reason as before this change, and the merged pull request's checks are not read

### Requirement: The work left after a merge is named
While a task of a change is unticked after its own pull request merged with every required check
green, the delivery checker SHALL name the unticked tasks as the work left. On the change's own
branch it SHALL lead through the same delivery contract to a further pull request; on any other
checkout it SHALL name the branch to continue on.

#### Scenario: From the default branch
- **WHEN** `deliver-check.mjs foo` runs on the default branch after pull request #12 of `foo` merged with tasks 3.1 and 3.2 unticked and every required check `SUCCESS`
- **THEN** its next step names pull request #12, the tasks 3.1 and 3.2 and the branch `foo` to continue on

#### Scenario: On the change's own branch
- **WHEN** the work left is done and ticked on branch `foo`, no open pull request exists for it, and the merged pull request's required checks were all `SUCCESS`
- **THEN** the next step is to open a further pull request, never the retro

#### Scenario: A further pull request is open
- **WHEN** pull request #12 of `foo` merged with a task left and a required check red, and a further pull request from the same head branch is open
- **THEN** on branch `foo` the open pull request is the change's pull request and the merged one is not read as a forced merge

### Requirement: A task done after the merge is ticked before the archive
A task that can only be done after a merge SHALL be ticked in a further pull request of the change
before its archive; after a merge with every required check green, the retro SHALL come only after
the last task is ticked on the default branch. After an owner's forced merge the retro SHALL come
with the tasks left unticked.

#### Scenario: The last task ticked in a further pull request
- **WHEN** the further pull request that ticks the last task of `foo` merges
- **THEN** `deliver-check.mjs foo` answers the retro

#### Scenario: A forced merge with a task left
- **WHEN** pull request #12 of `foo` merged with task 9.6 unticked on the default branch and `devkit-reviews` `FAILURE` on its head
- **THEN** `deliver-check.mjs foo` answers the retro and `tasks.md` on the default branch still has 9.6 unticked

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
number, and every reference to it in the branch's files. The owner SHALL NOT be asked. An ADR that a
change with a release note lists without a number SHALL NOT be given this step.

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

#### Scenario: A change with a release note
- **WHEN** a change that carries `release.md` holds `docs/adr/0018-feat.md` after the delivery step and the default branch took `0018` since
- **THEN** no renumbering step is given, and the next step is `assign-release`

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
For a change with a release note, a release edit SHALL NOT be judged as a plain commit: a commit
after the recorded evidence or an approved or declined review, the delivery step's commit and its
merge of the base included, whose every changed path differs from its parent (a merge's first
parent) only in release lines (versions, the changelog, the CI pins, the version of the release
file, and an unnumbered ADR renamed to its number, or the change's own ADR renumbered by a later run
of the step after the base took its number, with its citations rewritten) SHALL leave them current.
A rejected review and a change with no note SHALL be judged as before. On an owner's forced merge
the evidence and the reviews SHALL be read by the requirement "The open items of a forced merge are
named", so the delivery step's release commit can list them there as open items, an over-report and
never a pass.

#### Scenario: A plain product commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit on the branch changes `src/unrelated.ts`, a file the branch never changed before
- **THEN** the records are stale and the reason names that commit and `src/unrelated.ts`

#### Scenario: A test-only commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit changes only test files
- **THEN** the reviews of the four test-spared reviewers stay current and the evidence and the other reviews are stale, as before this rule

#### Scenario: The step's commit
- **WHEN** the evidence and the approved reviews record commit R and the only later commit is the one `assign-release` made
- **THEN** the delivery checker, the stage checker and `deliver-check --ci` read them as current, while an owner's forced merge of that head reads them by "The open items of a forced merge are named" and can list them as open items

#### Scenario: A later run that renumbers the change's own ADR
- **WHEN** the evidence and the approved reviews record commit R after a first run of the step numbered `docs/adr/0002-feat.md`, the base then took `0002` and changed no file of the change, and the only later commit is the step's merge of the base that renumbers the record to `0003` and rewrites its citations
- **THEN** the delivery checker reads them as current

#### Scenario: A release commit that also edits a sentence
- **WHEN** the later commit renames the ADR and also changes a sentence of `docs/openspec-flow.md` that is not a citation
- **THEN** the records are stale and the reason names that commit and `docs/openspec-flow.md`

### Requirement: The change folder is committed before a review round
When the delivery checker would answer `review` and `openspec/changes/<id>/` holds a modified,
staged or untracked path, it SHALL answer the `commit` step instead. That step SHALL name no path to
stage (`paths` empty), and its reason SHALL name the folder's paths. Once the folder is clean, the
checker SHALL answer what it answered before. With a clean folder, every answer SHALL stay the same.
The change loop SHALL hand this step to the commit role, as it hands any other `commit` step.

#### Scenario: Only the evidence is uncommitted
- **WHEN** the evidence is current, `code-quality-reviewer` has no verdict, and `openspec/changes/foo/evidence.md` is the only uncommitted path
- **THEN** `deliver-check.mjs foo --json` answers `next.step` `commit` with `next.paths` `[]`, and a reason that names `openspec/changes/foo/evidence.md`

#### Scenario: Only a ticked tasks.md is uncommitted
- **WHEN** the evidence is current, a reviewer is stale, and the only uncommitted change is a gate ticked in `openspec/changes/foo/tasks.md`
- **THEN** the checker answers `commit` with `paths` `[]`

#### Scenario: An untracked or staged file in the change folder
- **WHEN** the evidence is current, a reviewer is missing, and `openspec/changes/foo/proof/red-1.txt` is untracked, or staged and not committed
- **THEN** the checker answers `commit`, and its reason names `openspec/changes/foo/proof/red-1.txt`

#### Scenario: The review after the commit
- **WHEN** the folder's paths of the scenarios above are committed and nothing else changed
- **THEN** the checker answers `review` with the same reviewers and the same round it answered for the same state with the folder clean

#### Scenario: Product code dirty together with the folder
- **WHEN** `src/a.ts` and `openspec/changes/foo/evidence.md` are both uncommitted
- **THEN** the checker answers the product `commit` step with `paths` `["src/a.ts"]`, before `verify`, as before this change, and the same call answers no second `commit` step

#### Scenario: A dirty folder while the evidence is due
- **WHEN** `openspec/changes/foo/tasks.md` is uncommitted and the evidence is missing or stale
- **THEN** the checker answers `verify`, as before this change

#### Scenario: A dirty folder while a fix comes first
- **WHEN** `openspec/changes/foo/reviews/code-quality-reviewer.md` holds a current rejected verdict and is uncommitted
- **THEN** the checker answers `fix-review`, as before this change

#### Scenario: A clean change folder
- **WHEN** nothing under `openspec/changes/foo/` is uncommitted, the evidence is current and a reviewer is stale
- **THEN** the checker answers `review`, with the reviewers and the round it answered before this change

#### Scenario: Paths outside the change folder do not count
- **WHEN** the only uncommitted paths are `openspec/changes/foox/tasks.md` and `openspec/config.yaml`, the evidence is current and a reviewer is missing
- **THEN** the checker answers `review`

#### Scenario: The change loop hands the step to the commit role
- **WHEN** the delivery row of a `/devkit change` run is `commit` with `paths` `[]`
- **THEN** `change-loop.mjs next` answers an `agent` action for `devkit-core:commit-and-pr` with step `commit` and stage `delivery`, as for a `commit` step that names paths

#### Scenario: The round after the step records clean commits
- **WHEN** a review round runs after the change folder was committed by this step
- **THEN** each verdict's `Commit:` line carries no `(uncommitted changes)` mark, and the checker reads every verdict of the round as current

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

### Requirement: An owner's forced merge is told by the required checks
A merged own pull request of a change that is not archived and has an unticked task on the default
branch SHALL be the owner's forced merge when a required check of the default branch, or
`devkit-reviews` when it reported, is not `SUCCESS` on the pull request's head, or is absent. A check
is green only when every entry of its name concludes `SUCCESS`.

#### Scenario: devkit-reviews failed alone
- **WHEN** the default branch requires `check` and `devkit-reviews`, and the merged head has `check` `SUCCESS` and `devkit-reviews` `FAILURE`
- **THEN** the merge is forced and `devkit-reviews (FAILURE)` is one of its open items

#### Scenario: check failed alone
- **WHEN** the merged head has `check` `FAILURE` and `devkit-reviews` `SUCCESS`
- **THEN** the merge is forced and `check (FAILURE)` is one of its open items

#### Scenario: A required check is missing
- **WHEN** the default branch requires `check` and the merged head reports no `check` at all
- **THEN** the merge is forced and `check (absent)` is one of its open items

#### Scenario: devkit-reviews is not required
- **WHEN** no rule requires `devkit-reviews`, every required check is `SUCCESS`, and `devkit-reviews` did not report
- **THEN** the merge is not forced; when `devkit-reviews` reported `FAILURE` instead, it is forced

#### Scenario: A skipped required check
- **WHEN** a required check concludes `SKIPPED` or `NEUTRAL` on the merged head
- **THEN** it is not green and the merge is forced

#### Scenario: A status-context entry
- **WHEN** the merged head reports the required check `check` as a status context (`context` `check`, `state` `FAILURE`) instead of a check run
- **THEN** it is read like a check run of that name and the merge is forced with `check (FAILURE)` as one of its open items

#### Scenario: Two entries of one name, one failing
- **WHEN** the merged head has two entries named `check`, one `SUCCESS` and one `FAILURE`, and every other required check is `SUCCESS`
- **THEN** `check` is not green and the merge is forced with `check (FAILURE)` as one of its open items

#### Scenario: The checks cannot be read
- **WHEN** after pull request #12 of `foo` merged with a task left, the required checks of the default branch or the merged head's check list cannot be read, or the answer has no check list
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, with a reason that names pull request #12 and quotes the error, from the default branch and from branch `foo` alike; it answers neither `stop-branch` nor `implement` nor the retro, and no `mergedLeft` is reported

#### Scenario: A tasks read that fails keeps its answer
- **WHEN** the change's `tasks.md` on the default branch cannot be read after its own pull request merged
- **THEN** the pull request item is `blocked` naming the error, as before this change, and no forced merge is read

### Requirement: An owner's forced merge leads to the archive steps
A forced merge SHALL lead the delivery checker to the same steps a delivered change gets after its
merge, the release tag first when one is due, then the retro, the owner's answers, the archive, the
roadmap tick, the approved proposals and the archive pull request. It SHALL never answer
`implement`, `gate`, `fix-review`, `fix-defect`, `fix-checks`, `verify`, `review` or `stop-branch`
for it.

#### Scenario: The retro of a forced merge
- **WHEN** pull request #88 of `foo` merged with task 9.6 unticked, `devkit-reviews` `FAILURE`, and no `retro.md`
- **THEN** `deliver-check.mjs foo --json` answers `next.step` `retro`, `next.number` 88, `next.forced.count` the number of open items, and a reason that starts `PR #88 merged by the owner with ` and names that count

#### Scenario: Its contract items
- **WHEN** the same forced merge is reported
- **THEN** the tasks item and the checks item are `open`, naming the open tasks, gates and checks, the other items read as checked before the merge, and the exit code is 1

#### Scenario: A release the forced merge bumped
- **WHEN** the forced merge bumped the release file and `origin` has no tag for that version
- **THEN** the next step is `tag-release`, before the retro

#### Scenario: After the owner's answers
- **WHEN** every retro proposal of the forced merge has the owner's answer and the change is still active
- **THEN** the next step is `archive`, and once the folder is archived on `chore/archive-foo`, `tick-roadmap` when the roadmap lists it unticked, then `open-archive-pr`

#### Scenario: The forced retro from the change's own branch
- **WHEN** the checkout is on branch `foo`, pull request #88 of `foo` merged as a forced merge, and no open pull request shares its head
- **THEN** the next step is `retro` for #88, never `implement` or `open-pr`

#### Scenario: The forced retro from another change's branch
- **WHEN** the checkout is on the branch of another change and `deliver-check.mjs foo` runs after the forced merge of #88
- **THEN** the next step is `retro` for #88, never `stop-branch`

#### Scenario: A retro proposal not answered
- **WHEN** the retro of the forced merge holds a proposal without the owner's answer
- **THEN** the next step is `stop-retro-answers`

#### Scenario: Nothing is written
- **WHEN** `deliver-check.mjs foo` runs on a forced merge
- **THEN** `tasks.md`, `readiness.md`, `approval.md`, `evidence.md` and every file under `reviews/` of the change are byte-identical afterwards

#### Scenario: Two pull requests, the base one forced
- **WHEN** in a `two-prs` project the pull request to the base branch (the default branch) merged with task 1.2 unticked and `devkit-reviews` `FAILURE`, and the pull request to the test branch merged too
- **THEN** `deliver-check.mjs foo` answers the retro with `forced` set for the base pull request, and the pull request to the test branch is never read as a forced merge

### Requirement: The open items of a forced merge are named
The open items of a forced merge SHALL be each unticked task of the change's `tasks.md` on the
default branch, each required check that is not green, and each gate file (`evidence.md`, each
required reviewer's `reviews/<reviewer>.md`, and any other reviewer file present) that does not hold
a passing verdict current at the merged head. The reason SHALL say `<N> items open`; N is at least
2, one task and one check.

#### Scenario: Evidence that is missing or not passed
- **WHEN** the merged head has no `evidence.md`, or one whose stage header result is not `passed`
- **THEN** `evidence.md` is an open item, naming why

#### Scenario: Evidence recorded before a product change
- **WHEN** the `Commit:` of `evidence.md` at the merged head is an ancestor of it and a file outside `openspec/` changed between the two
- **THEN** `evidence.md` is an open item naming that file; when only files under `openspec/` changed, it is not

#### Scenario: A review that did not pass
- **WHEN** `reviews/code-quality-reviewer.md` is missing at the merged head, or its `Verdict:` is `REJECTED`, or its approved verdict was recorded before a product change
- **THEN** that file is an open item, naming why

#### Scenario: An approved verdict with an undisposed finding
- **WHEN** an approved or declined `reviews/<name>.md` at the merged head lists a `[blocking]` or `[important]` finding with no disposition (no `refuted: <evidence>`, no `fixed in <sha>` of a commit in the merged head's history), and a commit between its `Commit:` and the merged head touches a path outside the change's own review record (`reviews/`, `review.md`, `evidence.md`)
- **THEN** that file is an open item naming its commit as behind the merged head and the file that changed; when only the change's own review record changed between the two, it is not an open item

#### Scenario: A fixed-in commit is in the merged head's history
- **WHEN** a finding carries `fixed in <sha>` and the compare `<sha>...<merged head>` answers `ahead` or `identical`
- **THEN** the finding is disposed; when it answers `behind` or `diverged`, or the sha is not found (404), the finding stays undisposed and the verdict follows "An approved verdict with an undisposed finding"

#### Scenario: A fixed-in commit that cannot be checked
- **WHEN** the compare `<sha>...<merged head>` of a `fixed in <sha>` finding fails for a reason other than not found
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike

#### Scenario: A verdict recorded on another line of history
- **WHEN** the `Commit:` of `evidence.md` or of a review file at the merged head is not an ancestor of the merged head
- **THEN** that file is an open item naming its commit as not an ancestor of the merged head

#### Scenario: A verdict recorded too far behind to read
- **WHEN** the compare of the `Commit:` of `evidence.md` or of a review file with the merged head lists 300 files or more
- **THEN** that file is an open item naming its commit as too far behind the merged head to read

#### Scenario: The gate files cannot be read
- **WHEN** reading a gate file or the `reviews/` folder at the merged head fails for a reason other than not found, or answers a folder where a file is expected or a file where the folder is expected
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike

#### Scenario: The count
- **WHEN** a forced merge has task 9.6 unticked, `devkit-reviews` `FAILURE`, and `evidence.md` and `reviews/code-quality-reviewer.md` without a passing verdict at its head
- **THEN** the reason says `4 items open` and `next.forced.items` lists those four, tasks first, then checks, then gate files

### Requirement: A merged pull request is found from any checkout
The delivery checker SHALL find the change's merged own pull request with its branch deleted on
GitHub, from the change's own branch, the default branch, an archive branch or any other branch. When
the list of the newest 100 merged pull requests is full and holds none, it SHALL look for it by the
commits of the default branch that changed the change's `tasks.md`, newest first, through the pull
requests each commit belongs to. It reads the newest 10 such commits.

#### Scenario: On the change's own branch, the branch deleted
- **WHEN** the checkout is on branch `foo`, GitHub deleted it, and `gh pr view` finds no pull request while `gh pr list --head foo --state all` holds merged #88
- **THEN** #88 is the change's pull request and a forced merge of it answers the retro

#### Scenario: Older than the newest 100 merged pull requests
- **WHEN** the checkout is on the default branch, the list of the newest 100 merged pull requests is full and none is the change's own, and the newest commit of the default branch that changed `openspec/changes/foo/tasks.md` belongs to merged #12, the change's own
- **THEN** #12 is found and the delivery is judged on it

#### Scenario: A commit of an archive or another base
- **WHEN** the pull requests a commit belongs to are an archive pull request or a pull request to another base
- **THEN** they are skipped, and when no commit gives an own pull request the change has none

#### Scenario: A list that is not full
- **WHEN** fewer than 100 merged pull requests exist and none is the change's own
- **THEN** the change has no merged pull request and no commit of the default branch is read

#### Scenario: The commits cannot be read
- **WHEN** the list of the newest 100 merged pull requests is full and holds none of the change's own, and reading the commits of the default branch or the pull requests of a commit fails
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, with a reason that quotes the error, from the default branch and from another change's branch alike, and never `stop-branch`

### Requirement: A task marked for the conducting session is not the implementer's
A task of `tasks.md` whose description starts with `Conductor:` SHALL be the conducting session's.
The delivery checker SHALL give the step `conductor-task` when a phase's first open task carries the
marker, SHALL stop an implementer hand-off of that phase before the first open marked task, and SHALL
count a marked task done only when it is ticked.

#### Scenario: The phase's next task is the session's
- **WHEN** the first open task of phase 2 starts with `Conductor:`
- **THEN** the next step is `conductor-task` naming phase 2 and the open marked tasks that lead the phase

#### Scenario: An implementer task before a marked task
- **WHEN** phase 2's open tasks are 2.1, then 2.2 marked `Conductor:`, then 2.3
- **THEN** the next step is `implement` for phase 2 with `stopAt` 2.2

#### Scenario: A phase with no marked task
- **WHEN** no open task of phase 2 carries the marker
- **THEN** the next step is `implement` for phase 2 with no `stopAt`, as before

#### Scenario: A marked task holds the gate
- **WHEN** every task of phase 2 is ticked but one marked `Conductor:`
- **THEN** the next step is `conductor-task`, not the phase's gate, and the delivery contract lists that task as unticked

#### Scenario: The marker only at the start
- **WHEN** a task's description holds `Conductor:` after its first word
- **THEN** the task is an ordinary task

### Requirement: The review round limit is two plus the rounds the owner authorized
The delivery checker SHALL stop at `stop-review-deadlock` when a current review rejects and
`review.md`'s last consensus is a failure at the round limit: 2 plus the code-review rounds the
owner authorized, a round authorized for a conflict resolution's review not counted. Below the
limit, a re-review after a failed round SHALL be the next round, carrying the limit when above 2.

#### Scenario: No authorization
- **WHEN** nothing is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`, and no `review` step carries a `limit`

#### Scenario: One authorization
- **WHEN** one authorized round is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `fix-review`, and once the fix stales the rejected review, `review` with round 3 and limit 3

#### Scenario: The authorized round failed too
- **WHEN** one authorized round is recorded and `review.md` ends at `Consensus: FAIL (round 3/3)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`

#### Scenario: A round authorized for the resolution
- **WHEN** one round authorized for a conflict resolution's review is recorded and `review.md` ends at `Consensus: FAIL (round 2/2)` with a current rejected review
- **THEN** the next step is `stop-review-deadlock`

#### Scenario: A record that cannot be read
- **WHEN** the record of declared steps cannot be read
- **THEN** the limit is 2

### Requirement: A change states its release in a note when its project names a release file
In a project that names `devkit.release_tag`, a change SHALL state its release in
`openspec/changes/<id>/release.md`: a `packs:` list (each pack with `patch`, `minor` or `major`; an
empty list is no release), an optional `marketplace:` then `release:` bump, a changelog title line and
a body. One reader SHALL read it for the checker and the step. Without `devkit.release_tag` the file
SHALL be ignored.

#### Scenario: A complete note
- **WHEN** `release.md` lists `devkit-openspec: minor` and `devkit-core: patch`, no `marketplace:` line, and a `## <title>` line followed by a body
- **THEN** the note is read with those two bumps, a marketplace bump of `minor` (the largest pack bump), that title and that body

#### Scenario: An empty packs list
- **WHEN** `release.md` says `packs: []` and has no `marketplace:` or `release:` line
- **THEN** the note is read as no release, and no changelog title or body is required

#### Scenario: No release file setting
- **WHEN** the project names no `devkit.release_tag` and a change carries a `release.md` with a malformed field
- **THEN** the delivery checker answers exactly what it answered before this rule, and no step reads the file

### Requirement: A malformed release note is refused naming the field
A release note the reader cannot read SHALL be refused by the delivery checker (`blocked`) and by the
delivery step (exit 2) with one plain message that starts `release.md:` and names the field. An empty
file SHALL be refused as having no `packs:` line; a last line with no newline SHALL be read as if it
had one. A note the project cannot release SHALL be refused the same way: a pack the project does not
have, and a `marketplace:` bump in a project with no `.claude-plugin/marketplace.json`.

#### Scenario: A malformed field
- **WHEN** `release.md` has no `packs:` line, a bump other than `patch`, `minor` or `major`, a pack named twice, the fields out of order, an unknown line before the title, no title or no body for a release, a body that opens a code fence it never closes, or a body line outside a code fence that starts `## ` (a heading the changelog reads as a version)
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md:` and names that field, and the delivery step exits 2 with the same message

#### Scenario: An empty or unterminated file
- **WHEN** `release.md` is empty, or its last line has no newline
- **THEN** the empty file is refused as having no `packs:` line, and the file without a final newline is read as if it had one

#### Scenario: A pack the project does not have
- **WHEN** every task is ticked and `release.md` lists `devkit-nope: patch`, a name no `plugins/<dir>/.claude-plugin/plugin.json` has
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: packs:` and names `devkit-nope`, and the delivery step exits 2 with the same message

#### Scenario: A marketplace bump with no marketplace
- **WHEN** every task is ticked, `release.md` says `marketplace: minor`, and the project has no `.claude-plugin/marketplace.json`
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: marketplace:`, and the delivery step exits 2 with the same message

### Requirement: A change with a release note leaves the release lines as the base has them
For a change with a release note, the delivery checker SHALL accept a branch whose release lines
equal those of its merge base with the base, or what the delivery step computes from that merge base
and the note, and SHALL refuse any other with `release lines edited by hand:` and the paths. The
release lines are the pack and marketplace versions, `CHANGELOG.md`, the CI pins, the release file's
`version`, and the names and citations of the unnumbered ADRs `decisions.md` lists.

#### Scenario: The base's lines
- **WHEN** a change with a note bumps nothing on its branch and adds `docs/adr/<id>.md`
- **THEN** the delivery checker raises no release refusal

#### Scenario: A version written by hand
- **WHEN** the same branch also changes the `version` of `plugins/a/.claude-plugin/plugin.json`
- **THEN** the delivery checker answers `blocked` with `release lines edited by hand: plugins/a/.claude-plugin/plugin.json`

#### Scenario: Numbers the step wrote
- **WHEN** the branch holds exactly what the delivery step wrote from its merge base and its note
- **THEN** the delivery checker raises no release refusal

#### Scenario: Half of what the step writes
- **WHEN** the branch holds the versions the step computes but its ADR still has no number
- **THEN** the delivery checker refuses it as release lines edited by hand, naming the ADR path

### Requirement: A release line the step wrote is known by the step's own record
For a change with a release note, a release line whose head value is the merge base's SHALL be read
as the base's, even when the step's record holds it too. Otherwise a line whose head value the
step's own record holds SHALL be read as the step's, for the step to number again, and never refused
as edited by hand. The record SHALL be read per line, each line from the newest recorded commit that
changed it. A value no recorded commit wrote keeps the refusal.

#### Scenario: The base merged by hand after the step refused a conflict
- **WHEN** the step numbered the branch `devkit-openspec` 1.1.0 and `docs/adr/0002-feat.md`, the base then released 1.1.0 and took `0002` for `docs/adr/0002-other.md`, and a person merged the base by hand, resolving a conflict in `src/a.ts` and taking the base's side of every release file
- **THEN** the delivery checker raises no release refusal and the next step is `assign-release`

#### Scenario: A version both sides released
- **WHEN** the step's record wrote `devkit-openspec` 1.1.0, the base released 1.1.0 too, and a person merged the base by hand as above
- **THEN** the manifest reads as the merge base's, the step gives none of its text back, and the step then writes the version it computes from the base

#### Scenario: A number the step kept across a later step commit
- **WHEN** the step numbered `docs/adr/0002-feat.md`, the base then released `devkit-openspec` 1.1.0 with no ADR, the step ran again in a merge commit that kept `0002` without renaming it, and the base then took `0002` for `docs/adr/0002-other.md` and changed `src/a.ts`, so the step exited 2 naming `src/a.ts` and a person merged the base by hand as above
- **THEN** the step does not refuse the branch as edited by hand: it gives back the `0002` the first step commit wrote and exits 0, and the branch holds `docs/adr/0003-feat.md`, the base's `docs/adr/0002-other.md` as it was, `devkit-openspec` 1.2.0, every citation the step had written naming `0003`, and the release assigned and current

#### Scenario: A number the step never wrote
- **WHEN** the same merged branch also sets a version the step's recorded commit did not write
- **THEN** the delivery checker answers `blocked` with `release lines edited by hand:` naming that manifest

#### Scenario: No record
- **WHEN** the step's commit carries no record, as one made before this rule, and the branch was merged by hand as above
- **THEN** the delivery checker refuses it as release lines edited by hand, naming `docs/adr/feat.md`

### Requirement: The release is never judged without the base
For a change with a release note, when `origin/<base>` is missing, so the release lines cannot be
computed, the delivery checker SHALL answer `blocked` naming the fetch to run, and SHALL never pass
the release.

#### Scenario: No base to compute from
- **WHEN** a change with a note has every task ticked and the clone has no `origin/main`, its base
- **THEN** the delivery checker answers `blocked` with a reason that names `origin/main` and `git fetch origin main`, and gives no step after it

### Requirement: A change with neither a note nor a bump of its own is refused
In a project that names `devkit.release_tag`, once every task of a change is ticked, the delivery
checker SHALL refuse with a reason that starts `no release:` a change with no release note whose
branch changes a file of a pack whose manifest version it did not change, or whose `decisions.md`
lists an ADR without a number. A change with a note, its `packs:` list empty included, SHALL NOT be
refused for this.

#### Scenario: A pack changed with no release
- **WHEN** a change with no note changes `plugins/a/hooks/x.mjs` and leaves `plugins/a/.claude-plugin/plugin.json` at its merge base's version
- **THEN** the delivery checker answers `blocked` with a reason that starts `no release:` and names `plugins/a`

#### Scenario: A change opened before release notes
- **WHEN** a change with no note changes `plugins/a/hooks/x.mjs` and bumps `plugins/a/.claude-plugin/plugin.json`
- **THEN** no release refusal is given, and the change is delivered by the rule it had before

#### Scenario: A note that releases nothing
- **WHEN** a change whose note says `packs: []` changes `plugins/a/hooks/x.mjs`
- **THEN** no release refusal is given

#### Scenario: An unnumbered ADR with no note
- **WHEN** a change with no note lists `docs/adr/<id>.md` in its `decisions.md`
- **THEN** the delivery checker answers `blocked` with a reason that starts `no release:` and names that path

### Requirement: The plan approval covers the release note
For a change on a script with a readiness stage that carries a release note, the recorded plan
approval SHALL hold the hash of the note it approved, and the delivery checker SHALL ask the owner's
approval again (`stop-plan-approval`) whenever the note's hash differs from the recorded one, whether
or not a task is ticked, with the reason `release note changed after approval`. An approval recorded
for a change with no note SHALL be read as before.

#### Scenario: The note edited after the approval
- **WHEN** `approval.md` records the hash of `release.md`, tasks are ticked, and `release.md` then changes
- **THEN** the next step is `stop-plan-approval` with the reason `release note changed after approval` and the new hash in its `release` field

#### Scenario: A note added after the approval
- **WHEN** `approval.md` records no note and the change now carries `release.md`
- **THEN** the next step is `stop-plan-approval` with the same reason

#### Scenario: No note
- **WHEN** a change with no `release.md` has an approval with no note line
- **THEN** the approval is read exactly as before this rule

### Requirement: Every reader of the plan approval checks the release note
Every reader of the plan approval (the delivery checker, the conductor's planning row and the loop's
acceptance of the decision records) SHALL apply the release note's hash as the delivery checker
does, the project's `devkit.release_tag` read by the approval reader itself, so no caller can leave
the note out. The stage checker's test of a plan revised after the start is the one exception (the
next requirement).

#### Scenario: The conductor and the acceptance of the records
- **WHEN** `release.md` changed after the approval and no task is ticked
- **THEN** the conductor's planning row answers `approve` with the reason `release note changed after approval`, and the acceptance of the decision records is refused with that reason

#### Scenario: A folder outside a project's layout
- **WHEN** the approval reader is given a change folder that is not under `openspec/changes/` or `openspec/changes/archive/` of a project
- **THEN** it reads no release setting and the approval it returns has no note keys

### Requirement: A plan revised with its note after the start goes back to the readiness review
The stage checker's test of whether the owner approved the current readiness review, which decides
that a plan revised after the work started goes back to its gates, SHALL read the plan approval
without the release note, so a plan revised together with its note goes back to the readiness review
first, and the note is asked at the approval that follows it.

#### Scenario: A plan and its note revised after the work started
- **WHEN** a task is ticked, `approval.md` records the readiness hash, the plan's digest and the note's hash, and `design.md` and `release.md` both changed since
- **THEN** the plan readiness is reported stale with the reason `plan-revised` and is the next stage, and once it passed again the next step is `stop-plan-approval` carrying the readiness hash, the plan's digest and the note's hash

#### Scenario: Only the note revised after the work started
- **WHEN** a task is ticked, `approval.md` records the readiness hash, the plan's digest and the note's hash, and only `release.md` changed since
- **THEN** the plan readiness stays passed, and the next step is `stop-plan-approval` with the reason `release note changed after approval`

### Requirement: With no train the release is assigned by one step before the merge
In a project that names `devkit.release_tag` and sets no delivery train, for a change with a release
note the delivery checker SHALL answer `assign-release` in place of `update-branch` or the conflict
stop when the branch is behind or in conflict with the base, and, once every other item is met,
before `enable-auto-merge`, `wait-merge`, `ready` or `ready-base` until the branch holds the base and
the release computed from it. A train project SHALL never be answered `assign-release`.

#### Scenario: The last step before the merge
- **WHEN** a change with a note has every item met in `merge` mode, holds `origin/<base>`, and its release lines are the base's
- **THEN** the next step is `assign-release`, not `enable-auto-merge`, and after the step's commit and a push the next step is `enable-auto-merge`

#### Scenario: The base moved after the assignment
- **WHEN** a change whose branch holds the assigned release falls behind a base that released another change
- **THEN** the next step is `assign-release`

#### Scenario: Auto-merge on while the release is not current
- **WHEN** a change with a note has auto-merge on, GitHub does not report its branch behind the base, and the base has released another change since the branch's assignment
- **THEN** the next step is `assign-release`, not `wait-merge`

#### Scenario: The pull request in conflict with the base
- **WHEN** a change with a note and no train has its pull request reported in conflict with the base, and that conflict is the only thing item 5 is blocked for
- **THEN** the next step is `assign-release` with `conflict` true, not `blocked` with the conflict, and for a branch only behind the base it is `assign-release` with no `conflict`

#### Scenario: A train project
- **WHEN** the project sets `devkit.delivery.train`
- **THEN** no change is answered `assign-release`, and a noted change boards with its release lines as the base has them

### Requirement: The release step merges the base and commits only release lines
The delivery step SHALL merge `origin/<base>` when the branch is behind it, resolving release lines
by rule and keeping no branch-written number, then write the release lines from the note and commit
only them (and the merge). It SHALL never push. A merge it cannot resolve SHALL be undone, leaving the
branch at its old head, and the step SHALL exit 2 with the paths. In a project that names no
`devkit.release_tag` the step SHALL exit 3, a setup error, and write nothing.

#### Scenario: A base that released another change
- **WHEN** the branch holds an assigned release and the base since released the same pack
- **THEN** the step exits 0, the branch holds the base's release plus the note's bumps, and no conflict was left for anyone to resolve

#### Scenario: Two changes in a row
- **WHEN** two changes with notes bump the same pack and merge one after the other with no train
- **THEN** the second takes the version after the first's, and neither branch ever conflicts on a release line

#### Scenario: A conflict outside the release lines
- **WHEN** the merge of the base conflicts in `src/a.ts`
- **THEN** the step exits 2 naming `src/a.ts`, the branch is at its old head and no merge is in progress

#### Scenario: A project with no release file setting
- **WHEN** `release-merge.mjs --assign --base main` runs in a project that names no `devkit.release_tag`
- **THEN** it exits 3 with a message naming `devkit.release_tag`, and no file and no commit is written

### Requirement: The release step records what it wrote and numbers again after a merge by hand
The delivery step SHALL record in its own commit's message the change, the release files, the ADR
renames and the citation paths it wrote. After the base was merged by hand, the step SHALL give back
only the numbers its record names, each found by the text around it where a whole-text merge of the
path conflicts, and number the branch above the base. When a number it wrote cannot be found once
that way, the step SHALL exit 2 naming the path and leave the branch as it was.

#### Scenario: The step after a merge by hand
- **WHEN** the step numbered the branch `devkit-openspec` 1.1.0 and `docs/adr/0002-feat.md`, the base then released 1.1.0 with `docs/adr/0002-other.md` and changed `src/a.ts`, the step exited 2 naming `src/a.ts`, and a person merged the base by hand, resolving `src/a.ts` and taking the base's side of every release file
- **THEN** the step exits 0, the branch holds `docs/adr/0003-feat.md`, `devkit-openspec` 1.2.0 with its changelog entry above the base's 1.1.0, every citation the step had written names `0003`, and the release reads assigned and current

#### Scenario: The step's record
- **WHEN** the step commits
- **THEN** the commit's subject is as before and its message ends with the trailers `Release-change: <id>`, one `Release-line:` per release file it wrote, one `Release-adr: <from> -> <to>` per record it renamed and one `Release-citation:` per path whose citations it rewrote

#### Scenario: Words added beside a citation the step wrote
- **WHEN** the branch was merged by hand as above, and a person then added words in `docs/x.md` beside the citation the step had written (`see ADR 0002` became `see ADR 0002 and its notes`)
- **THEN** the step exits 0, and `docs/x.md` reads `see ADR 0003 and its notes`

#### Scenario: A citation the step wrote, changed after its record
- **WHEN** the branch was merged by hand as above, and a person then changed in `docs/x.md` the citation the step had written (`see ADR 0002` became `see the record 0002`)
- **THEN** the step exits 2 with `cannot give back the numbers the step wrote in docs/x.md`, writes nothing, and the branch's head and tree are as they were before the run

#### Scenario: A citation on a one-line list the base extended
- **WHEN** the step wrote `ADR 0002` on the one-line list `ADRs: docs/adr/ (0001 first; ADR 0002 the rule)` of `docs/context.yaml`, the base then added `; 0002 other` to that line and took `0002`, and the base was merged by hand keeping both entries on the line
- **THEN** the step exits 0 with `docs/adr/0003-feat.md`, the line reads `ADRs: docs/adr/ (0001 first; ADR 0003 the rule; 0002 other)`, and the release reads assigned and current, with no give-back by hand

#### Scenario: The base's entry with the same number on the same line
- **WHEN** the same, but the base wrote its entry `; ADR 0002 other` and the merge by hand left the line `ADRs: docs/adr/ (0001 first; ADR 0002 the rule; ADR 0002 other)`
- **THEN** the step exits 0, and the line reads `ADRs: docs/adr/ (0001 first; ADR 0003 the rule; ADR 0002 other)`

#### Scenario: A citation the merge dropped where the base cites its own number
- **WHEN** the same base entry `; ADR 0002 other`, and the merge by hand left the base's line `ADRs: docs/adr/ (0001 first; ADR 0002 other)`
- **THEN** the step exits 2 with `cannot give back the numbers the step wrote in docs/context.yaml`, writes nothing, the branch's head and tree are as they were, and the base's `ADR 0002` is not touched

### Requirement: An unnumbered ADR is numbered at the delivery
A change with a release note SHALL name each ADR it adds `<folder>/<slug>.md` and cite it
`ADR [<slug>]`. The delivery step and the train's join SHALL rename each such file `decisions.md`
lists to `<folder>/<NNNN>-<slug>.md`, NNNN being the next free number of that folder on the base, in
the order listed, and rewrite its citations in every tracked text file outside `openspec/changes/`.
They SHALL change no file under `openspec/changes/`.

#### Scenario: One ADR
- **WHEN** the base's highest ADR is `0026` and the change adds `docs/adr/feat.md`, cited `ADR [feat]` in `docs/x.md` and in its own `design.md`
- **THEN** the file becomes `docs/adr/0027-feat.md`, `docs/x.md` says `ADR 0027`, `design.md` still says `ADR [feat]`, and the readiness, approval, reviews and evidence stay current

#### Scenario: Two ADRs of one change
- **WHEN** the change's `decisions.md` lists `docs/adr/feat.md` then `docs/adr/feat-store.md`, the second cites the first as `ADR [feat]` and `(feat.md)`, and the base's highest ADR is `0026`
- **THEN** they become `0027-feat.md` and `0028-feat-store.md`, the second says `ADR 0027` and `(0027-feat.md)`, every `ADR [feat-store]` becomes `ADR 0028` and none becomes `ADR 0027`, and the record of `assign-release`'s commit names the two renames in that order

### Requirement: A citation lives in every text file but tests and fixtures
The files that hold ADR citations SHALL be every tracked text file outside `openspec/changes/`
except test files and fixtures: a name matching `*.test.*` or `*-fixtures.*`, or a file under a
folder named `test` or `tests`, which hold test data and no citation. The same files SHALL be read
for the citations of a change, for a citation still standing, for the rewrite, for the numbers a
later run or a join gives back, and for the release edit that stales nothing.

#### Scenario: A citation in a source file
- **WHEN** the base's highest ADR is `0026` and `plugins/a/hooks/x.mjs` holds the comment `// see ADR [feat]`
- **THEN** the comment says `// see ADR 0027` after the numbering

#### Scenario: A test fixture
- **WHEN** `plugins/a/hooks/x.test.mjs`, `plugins/a/hooks/x-fixtures.mjs` and `tests/a.md` each hold the text `ADR [feat] in docs/adr/feat.md`
- **THEN** none of them changes, and none is read as a citation still standing

#### Scenario: A test literal edited by hand
- **WHEN** a commit after the recorded evidence changes the literal `docs/adr/feat.md` to `docs/adr/0002-feat.md` in `plugins/a/hooks/x.test.mjs` and nothing else
- **THEN** the evidence is stale, naming that commit and that file

### Requirement: The file form of a citation is rewritten only where it names an ADR folder's file
The citation form `<slug>.md` SHALL be rewritten to `<NNNN>-<slug>.md`, and masked back, only where
it names a file of an ADR folder: its folder part ends in `adr/` or `decisions/`, or it has no folder
part and stands in a file of `docs/adr/` or `docs/decisions/`. A document elsewhere that shares the
slug's name SHALL keep every link to it.

#### Scenario: A document with the change's name
- **WHEN** the base's highest ADR is `0026`, the change `roles` adds `docs/adr/roles.md`, `docs/x.md` links `docs/roles.md` and `adr/roles.md`, and `docs/adr/0010-y.md` links `(roles.md)`
- **THEN** after the numbering `docs/x.md` still links `docs/roles.md`, its `adr/roles.md` link names `adr/0027-roles.md`, and `docs/adr/0010-y.md` links `(0027-roles.md)`

### Requirement: The numbering refuses a slug taken and a citation not landed
The delivery step and the train's join SHALL refuse, naming the slug, an ADR whose slug another file
of `docs/adr/` or `docs/decisions/` already has, and a citation `ADR [<other>]` of an ADR the base
has not numbered; once the base numbers it, the citation SHALL be rewritten to that number. With no
train, the delivery checker SHALL answer `blocked` for such a citation once every task is ticked, so
the step is not handed a numbering it must refuse.

#### Scenario: A slug the base already has
- **WHEN** the change adds `docs/adr/feat.md` and the base holds `docs/adr/0031-feat.md`
- **THEN** the step exits 2 naming `feat` and both paths, and nothing is renamed

#### Scenario: A citation of another change's ADR
- **WHEN** the change cites `ADR [other]` and the base has no `docs/adr/<NNNN>-other.md`
- **THEN** the step exits 2 with a message naming `other`

#### Scenario: A citation in a source comment
- **WHEN** a changed `plugins/a/hooks/x.mjs` holds the comment `// amends ADR [other]` and the base has no `docs/adr/<NNNN>-other.md`
- **THEN** the step exits 2 with a message naming `other`, as for the same citation in a Markdown file

#### Scenario: The checker sees the citation first
- **WHEN** a change with a note in a project with no train has every task ticked and cites `ADR [other]`, and `origin/main` has no `docs/adr/<NNNN>-other.md`
- **THEN** the delivery checker answers `blocked` with `ADR [other] is cited but has not landed on main`, not `assign-release`

#### Scenario: The cited ADR landed
- **WHEN** the base now holds `docs/adr/0028-other.md`
- **THEN** the step rewrites `ADR [other]` outside `openspec/changes/` to `ADR 0028`

### Requirement: A consumer project's release file follows the note
In a project that names `devkit.release_tag`, the delivery step SHALL write the top-level `version`
of that file with the note's `release:` bump and, only when the project has a root `CHANGELOG.md`,
the note's entry headed by that version. It SHALL create no file, and a missing release file, ADR
folder or `CHANGELOG.md` SHALL give no refusal.

#### Scenario: A consumer with a changelog
- **WHEN** `devkit.release_tag` names `package.json` at version `1.4.0`, the note says `packs: []` and `release: minor`, and the project has `CHANGELOG.md`
- **THEN** the step writes `1.5.0` into `package.json` and the entry `## 1.5.0 — <title>` above the newest entry of `CHANGELOG.md`

#### Scenario: A consumer with nothing else
- **WHEN** the same project has no `CHANGELOG.md`, no `docs/adr/` and no pack
- **THEN** the step changes only `package.json`, and no other file is created

#### Scenario: A release file that does not exist
- **WHEN** `devkit.release_tag` names a file the project does not have
- **THEN** the step writes nothing for it and refuses nothing

### Requirement: A release bump on a pack's own manifest is stated under packs
When the file `devkit.release_tag` names is the manifest of a pack, a note that gives a `release:`
bump SHALL be refused, naming the pack, because that file's version follows the pack's bump.

#### Scenario: This repository's release file
- **WHEN** `devkit.release_tag` names `plugins/openspec/.claude-plugin/plugin.json` and the note says `release: minor`
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: release:` and names `devkit-openspec`

### Requirement: The repository check refuses an unnumbered ADR on the base
This repository's `scripts/check.py` SHALL read as a record of `docs/adr/` or `docs/decisions/` a
file `<NNNN>-<slug>.md`, or a file `<slug>.md` whose first non-blank line starts `# ADR [`, and
SHALL refuse an unnumbered record on the base. The base is, first match wins: a root that is not a
git repository; a pull request whose head is `train/<n>` (any other pull request is a branch); the
default branch checked out; a `HEAD` the default branch contains. Anything else is a change branch.

#### Scenario: An unnumbered record on its change branch
- **WHEN** a change branch adds `docs/adr/feat.md` titled `# ADR [feat]: ...` and the change's `decisions.md` lists it
- **THEN** `scripts/check.py` reports no ADR problem

#### Scenario: An unnumbered record on the base
- **WHEN** the default branch is checked out, or the pull request's head is `train/1`, and `docs/adr/feat.md` is an unnumbered record
- **THEN** `scripts/check.py` exits 1 naming `docs/adr/feat.md` as an unnumbered ADR on the base branch

#### Scenario: A file that is not a record
- **WHEN** `docs/adr/README.md` does not start with `# ADR [`
- **THEN** `scripts/check.py` does not read it as a record

### Requirement: The repository check refuses an unlisted unnumbered ADR and a slug held twice
`scripts/check.py` SHALL refuse, on the base and on a change branch, two records with one slug
across `docs/adr/` and `docs/decisions/`, and an unnumbered record that no active change's
`decisions.md` lists in an `- ADR:` line.

#### Scenario: An unnumbered record no change lists
- **WHEN** a change branch holds the unnumbered record `docs/adr/stray.md` and no active change's `decisions.md` lists it
- **THEN** `scripts/check.py` exits 1 naming `docs/adr/stray.md`

#### Scenario: Two records with one slug
- **WHEN** `docs/adr/feat.md` and `docs/adr/0031-feat.md` are both records, on a change branch or on the base
- **THEN** `scripts/check.py` exits 1 with `a second ADR with the slug feat:` naming both paths
