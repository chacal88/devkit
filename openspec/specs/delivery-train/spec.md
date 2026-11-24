# delivery-train Specification

## Purpose
Lets a trunk project deliver its reviewed changes and archives together on a delivery train, so the
whole suite runs once per batch and a merge of a sibling never makes a boarded change redo its
evidence or its review.

## Requirements

### Requirement: The train is switched on by one setting
`openspec/config.yaml` SHALL accept `devkit.delivery.train`, whose value is the project's whole-suite
command. A missing or empty value SHALL leave every behaviour as it was before this change. A value
SHALL be accepted only with `devkit.delivery.model` `trunk` or `trunk-auto`.

#### Scenario: No train key
- **WHEN** the configuration names no `devkit.delivery.train`, whatever its model and `ship:` map
- **THEN** the delivery checker's steps, JSON and exit codes and the loop's actions are the ones they gave before this change

#### Scenario: The train on a trunk model
- **WHEN** the block holds `model: trunk-auto` and `train: "node --test all.test.mjs"`
- **THEN** a change of the project is delivered by the train and the whole-suite command is `node --test all.test.mjs`

#### Scenario: An empty value
- **WHEN** the block holds `model: trunk` and `train:` with no value
- **THEN** the train is off and nothing is refused

### Requirement: A train setting the model cannot carry is refused
A train value with the model `two-prs`, or with no `devkit.delivery.model`, or whose value opens a
quote it never closes, SHALL be a configuration error that names the setting and why, and nothing SHALL
run on it.

#### Scenario: The train with two pull requests
- **WHEN** the block holds `model: two-prs`, both branch names and `train: "npm test"`
- **THEN** every `/devkit` verb that runs and the delivery checker refuse to run, saying the train runs only with `trunk` or `trunk-auto` because `two-prs` delivers each change through pull requests of its own

#### Scenario: The train with no model
- **WHEN** the block holds `train: "npm test"` and no `model`
- **THEN** the same commands refuse to run, saying the train needs the model `trunk` or `trunk-auto`

#### Scenario: An unclosed quote
- **WHEN** the block holds `model: trunk` and `train: "npm test`
- **THEN** the same commands refuse to run, naming the train setting and its value

### Requirement: A reviewed change boards the train
In a train project, a change SHALL be boarded when every task and gate is done, its reviews are
approved and current at its head, its findings are disposed, its acceptance criteria are proven, its
pull request is open at its local head with a complete body, its conversation is answered and no check
of it fails. Being behind or in conflict with the base, and pending checks, SHALL not keep it off.

#### Scenario: Boarded with pending checks
- **WHEN** every item above holds and the change's `check` is still running
- **THEN** the change is reported as boarded and its run ends waiting for the train's departure

#### Scenario: Behind the base
- **WHEN** every item above holds and its pull request is behind `main`
- **THEN** the change is reported as boarded, not sent to update its branch

#### Scenario: A failing check keeps it off
- **WHEN** every item above holds but a check of its pull request fails
- **THEN** the change is not boarded and the next step fixes the check, as before this change

#### Scenario: A push after boarding
- **WHEN** a boarded change gets a new commit outside `openspec/`
- **THEN** it is no longer boarded and the next step records the evidence and the review again

### Requirement: A merge of the base costs a boarded change nothing
While a change is boarded, a merge into the base branch that does not touch the change's own head
SHALL leave its evidence and its reviews current, and no step SHALL update its branch, record its
evidence or run its review again.

#### Scenario: A sibling merges
- **WHEN** a boarded change's pull request falls behind `main` because a sibling merged
- **THEN** the change is still boarded, its evidence and every review are current, and its next action is the same end as before the merge

### Requirement: Auto-merge is never enabled on a boarded pull request
In a train project, devkit SHALL never enable auto-merge on a change's own pull request or on an
archive pull request, and SHALL disable it first where it finds it on.

#### Scenario: Auto-merge left on from before
- **WHEN** a change of a train project has auto-merge on and every boarding item holds
- **THEN** the next step disables auto-merge, and the one after reports the change boarded

#### Scenario: Auto-merge on in a trunk project
- **WHEN** the model is `trunk`, the train is on, and a change's own pull request has auto-merge on
- **THEN** the delivery checker reads the pull request's auto-merge state and the next step disables it

#### Scenario: Auto-merge on an archive pull request
- **WHEN** an archive pull request of a train project has auto-merge on and its retro answers and files pass
- **THEN** the next step disables auto-merge, and the one after reports the archive boarded

### Requirement: Boarding order is the order in which changes became boarded
Changes SHALL board in the order they became boarded: a change by the commit time of the newest commit
at its head that records one of its review verdicts, an archive by the commit time of its head. Equal
times SHALL be ordered by pull request number.

#### Scenario: Two changes approved one after the other
- **WHEN** the reviews of `alpha` were recorded at 10:00 and those of `beta` at 09:00
- **THEN** the train joins `beta` first, then `alpha`

### Requirement: A ready archive boards like a change
In a train project, an archive pull request SHALL board when its retro proposals are all answered, its
files pass the archive file check, its head is the local head with nothing uncommitted and no check of
it fails. No archive branch SHALL be updated because another one merged, and the archive step of one
change SHALL not wait for another change's archive.

#### Scenario: Two archives at once
- **WHEN** two changes reach their archive step at the same time in a roadmap run
- **THEN** both archive branches are created, both archive pull requests open and both board, and neither branch is updated with the base

### Requirement: A train departs on request, one at a time
`/devkit train` SHALL start a train only when one or more changes or archives are boarded and no train
is under way. A train is under way from its departure until its pull request is merged or closed. A
change that boards while a train is under way SHALL wait for the next one.

#### Scenario: A second request
- **WHEN** `/devkit train` is typed while the pull request of `train/4` is open
- **THEN** no new train starts, the reply names train 4 and its state, and the boarded changes stay queued

#### Scenario: Nothing boarded
- **WHEN** `/devkit train` is typed and no change or archive is boarded
- **THEN** nothing is created and the reply says nothing is boarded

#### Scenario: A project with no train
- **WHEN** `/devkit train` is typed in a project whose configuration names no `devkit.delivery.train`
- **THEN** the run ends blocked with a reply saying the project has no delivery train and that `devkit.delivery.train` switches it on, and nothing is created

#### Scenario: A departure under way
- **WHEN** `/devkit train` is typed while another departure holds the train lock, taken less than six hours before
- **THEN** no second departure starts, and the run ends waiting for the owner with a reply saying a train is departing and naming the lock file the owner may delete when no departure runs

#### Scenario: A lock older than six hours
- **WHEN** the train lock was taken more than six hours before and a boarded change exists
- **THEN** the departure takes the lock over and the train departs

### Requirement: The train joins the boarded heads in order
A departure SHALL cut `train/<n>` from the base branch as `origin` holds it after a fetch, `<n>` being
one more than the highest train number on the base branch or on `origin`, and SHALL merge each boarded
head in boarding order with a merge commit, never changing a change's own branch.

#### Scenario: Two changes and an archive
- **WHEN** `alpha`, the archive of `gamma` and `beta` are boarded in that order and the highest train is 3
- **THEN** `train/4` is cut from `origin/main` and holds three merge commits, of `alpha`'s head, `chore/archive-gamma`'s head and `beta`'s head in that order, and none of the three branches moved

### Requirement: Release numbers follow the boarding order on the train only
Each join SHALL renumber the release files the joined head bumped above the train's tip, keeping the
kind of each bump, so the first boarded takes the lowest number. Every boarded branch SHALL keep its
own numbers.

#### Scenario: Two minor bumps from the same release
- **WHEN** `main` is at 0.29.0 and `alpha` and `beta` each bump devkit-openspec to 0.30.0 with a CHANGELOG entry
- **THEN** after the joins the train holds 0.31.0, the CHANGELOG holds `beta`'s entry as 0.31.0 above `alpha`'s as 0.30.0, and both change branches still say 0.30.0

### Requirement: A join conflict outside the release files takes the change off
A join whose conflicts are only in release files, in the CI pin, or in `openspec/roadmap.md` where the
joined side only ticks lines, SHALL be resolved by rule. A conflict in any other path SHALL take that
change off the train with the paths attached, and the train SHALL go on without it.

#### Scenario: A conflict in product code
- **WHEN** `beta` conflicts with the train's tip in `plugins/x/hooks/a.mjs`
- **THEN** `beta` is not in the train, the train record lists it as left with `plugins/x/hooks/a.mjs`, and the other boarded changes leave on the train

#### Scenario: Two neighbouring roadmap ticks
- **WHEN** two archives tick neighbouring lines of `openspec/roadmap.md` and their joins conflict there
- **THEN** the conflict is resolved with both lines ticked and nothing else of the file changed

#### Scenario: A roadmap edit that is not a tick
- **WHEN** a joined archive both ticks a line and rewrites another line of `openspec/roadmap.md`, and the join conflicts in that file
- **THEN** the archive is taken off the train with `openspec/roadmap.md` attached

### Requirement: The whole suite runs once at the train's head
After the joins, the departure SHALL run the configured whole-suite command once at the train's head
and record the result, with every boarded and left change, in the train record
`openspec/trains/<n>.md`, committed on the train branch.

#### Scenario: A green train
- **WHEN** the suite passes at the train's head
- **THEN** the record says the result passed, names the head it ran at, lists each boarded change with its head, pull request and boarding order, and the train branch holds the record's commit

### Requirement: A red train takes the culprit off
When the suite fails at the train's head, the departure SHALL find the smallest red prefix of the train
in boarding order by bisection, take its last change off with the failure attached, and run the suite
once more on a train of every other boarded change, again until the train is green or empty.

#### Scenario: Two changes that fail together
- **WHEN** `alpha` and `beta` each pass the suite alone and fail together, and boarded in that order
- **THEN** `beta` leaves the train with the failing output attached in the record, and the train of `alpha` and the others runs the suite once more and departs green

#### Scenario: The base itself is red
- **WHEN** the first boarded change is the smallest red prefix and the suite also fails on the base branch alone
- **THEN** no train departs, no change is taken off, and the run ends blocked saying the base branch fails its suite

### Requirement: A change taken off returns to its own cycle
A change listed as left by a train SHALL, while its head is the one the record lists, wait on GitHub
until that train's pull request is merged or closed, and then be handed to the implementer to merge the
base branch and fix the attached failure or resolve the attached paths.

#### Scenario: While its train is open
- **WHEN** `beta` left train 4 at its current head and the pull request of train 4 is still open
- **THEN** `beta`'s run ends waiting on GitHub, naming that pull request, and no stage is handed

#### Scenario: Left on a red train
- **WHEN** `beta` left train 4 as the culprit and the pull request of train 4 merged
- **THEN** `beta`'s next action hands the implementer the merge of `origin/main` and the failure the record attached

#### Scenario: The fix is pushed
- **WHEN** `beta`'s head changed after it left the train
- **THEN** the left entry no longer applies and `beta` follows the ordinary steps until it boards again

### Requirement: An archive taken off waits for its train
An archive the record of a train lists as left at its pull request's head SHALL wait on GitHub while
that train's pull request is open, and SHALL never be reported as boarded at that head.

#### Scenario: An archive left while its train is open
- **WHEN** the archive of `delta` left train 4 at its head and the pull request of train 4 is open
- **THEN** `delta`'s run ends waiting on GitHub naming that pull request, and the archive is not boarded

### Requirement: An archive taken off merges the base or stops for the owner
Once the train an archive left is merged or closed, an archive that left for a conflict SHALL merge the
base branch into its branch when that merge conflicts only in release files, the CI pin or roadmap
ticks, and SHALL otherwise stop for the owner naming the conflicting paths. An archive that left for a
red suite SHALL stop for the owner with the record's failure.

#### Scenario: Only a roadmap tick in the way
- **WHEN** train 4 merged and the archive of `delta`, which left it for a conflict, now conflicts with `main` only in ticked lines of `openspec/roadmap.md`
- **THEN** the next step merges `origin/main` into `chore/archive-delta` with the ticks resolved, then pushes it, and at its new head the archive boards again

#### Scenario: A merge not pushed yet
- **WHEN** train 4 merged, the archive of `delta` left it for a conflict, and the local branch `chore/archive-delta` already holds the merge of `origin/main` while the archive pull request still has the older head
- **THEN** the next step pushes `chore/archive-delta` to `origin`, never with force, and nothing is merged again

#### Scenario: Two archives edit one canonical spec
- **WHEN** train 4 merged with the archive of `gamma` and the archive of `delta`, which left it, conflicts with `main` in `openspec/specs/change-coordination/spec.md`
- **THEN** the run stops for the owner naming the archive of `delta` and that path, nothing is merged, and the archive does not board again at that head

#### Scenario: An archive left on a red train
- **WHEN** the archive of `delta` left train 4 as the culprit and train 4 merged
- **THEN** the run stops for the owner naming train 4 and the failure its record attached

### Requirement: The train's pull request merges with a merge commit
The departure SHALL push the train branch and open one pull request to the base branch from it. In
`trunk-auto` devkit SHALL enable auto-merge on it with the merge method `merge`, pinned to its head,
once its record is green and current and it is not behind; in `trunk` the run SHALL end waiting for
the owner's merge.

#### Scenario: A departed train not pushed yet
- **WHEN** the local branch `train/4` holds its record and `origin` has no `train/4`
- **THEN** the next step pushes `train/4` to `origin`, never with force

#### Scenario: A pushed train with no pull request
- **WHEN** `train/4` is on `origin` and no pull request has it as its head
- **THEN** the next step opens one pull request from `train/4` to the base branch whose body is the train record

#### Scenario: Trunk with automatic merge
- **WHEN** the project's `merge_method` is `squash`, the model `trunk-auto`, and the train's record is green
- **THEN** auto-merge is enabled on the train's pull request with the merge method `merge` and its head

#### Scenario: Automatic merge already on
- **WHEN** the model is `trunk-auto` and auto-merge is on for the train's pull request
- **THEN** the run ends waiting on GitHub for that pull request to merge

#### Scenario: A check of the train fails
- **WHEN** a check of the train's pull request fails
- **THEN** the run ends blocked naming the check and its link, and auto-merge is not enabled

#### Scenario: A record that did not pass or is not current
- **WHEN** the train's record says the suite failed, or a commit outside `openspec/` follows the head it ran at
- **THEN** the run ends blocked naming the record's problem, and auto-merge is not enabled

#### Scenario: Merge commits not allowed
- **WHEN** the model is `trunk-auto` and the repository does not allow merge commits or auto-merge
- **THEN** the run ends blocked naming the missing setting and the setup command that allows merge commits

#### Scenario: Trunk with checks still running
- **WHEN** the model is `trunk` and a check of the train's pull request is pending
- **THEN** the run ends waiting on GitHub for the checks, not for the owner

#### Scenario: Trunk
- **WHEN** the model is `trunk` and the train's record is green
- **THEN** the run ends waiting for the owner, naming the train's pull request

#### Scenario: The base moved under an open train
- **WHEN** an unboarded pull request merged into `main` while the train's pull request is open and behind
- **THEN** the train merges `origin/main` with its releases renumbered above it, runs the suite once more, records it, and its pull request goes on

### Requirement: A merged train delivers every boarded change
Once the train's pull request is merged, every boarded change SHALL count as delivered. A boarded pull
request GitHub left open SHALL be closed with a comment naming the train and its pull request.

#### Scenario: GitHub marks the change merged
- **WHEN** the train's pull request merged and GitHub reports `alpha`'s pull request as merged
- **THEN** `alpha` goes on to its retro and nothing is posted on its pull request

#### Scenario: GitHub leaves it open
- **WHEN** the train's pull request merged and `beta`'s pull request is still open at the head the record lists
- **THEN** it is closed with a comment naming train 4 and its pull request, and `beta` goes on to its retro

#### Scenario: The train's checkout is removed
- **WHEN** the pull request of `train/4` merged and the worktree or the local branch `train/4` is still there
- **THEN** the next step removes that worktree and deletes the local branch, and no other branch or worktree

### Requirement: A boarded change waits for the departure, a change on a train waits on GitHub
A boarded change SHALL end its run waiting for the owner, saying it is boarded and that `/devkit train`
departs the train. A change carried by an open train SHALL end waiting on GitHub, naming the train's
pull request, and `/devkit status` SHALL show both as their states say.

#### Scenario: The status board
- **WHEN** `alpha` is boarded and `beta` rides the open train 4
- **THEN** `/devkit status` shows `alpha` in the block of changes waiting for the owner and `beta` under way, its row naming the train's pull request
