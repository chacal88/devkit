<!-- devkit-stage specs result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Spec Delta

## Purpose

Decides, inside a roadmap run, which one change pull request or archive pull request merges into the
base now and which wait, so that each ready change merges the base once instead of once per sibling
merge.

## ADDED Requirements

### Requirement: A repository holds a merge queue only while a roadmap run records one
A merge queue SHALL exist only while `origin` holds the run's marker. Without it, the delivery
checker and the change loop SHALL read no queue and answer as they do without this capability,
whatever a machine still records of the change's entries.
The queue SHALL apply only in the merge mode, never in the `trunk` or `two-prs` models, nor in a
project with a delivery train or on the CompozyOS driver.

#### Scenario: A lone change
- **WHEN** a change in a repository whose `origin` holds no marker has every delivery item met and auto-merge off in the merge mode
- **THEN** the delivery checker's step is `enable-auto-merge` and the loop's next action is that session step, as before

#### Scenario: No origin
- **WHEN** the repository has no `origin` remote
- **THEN** no queue is read and every step is the one given without a queue

#### Scenario: The run ended while the change was still open
- **WHEN** change `c` joined the queue of a run that then ended stuck, `origin` holds no marker, the machine still records `c`'s entry, and `c` has every delivery item met in the merge mode
- **THEN** `c`'s step is `update-branch` or `enable-auto-merge` as without a queue, never `join-queue`

#### Scenario: A change that never joined cannot read the queue
- **WHEN** listing the refs on `origin` fails for a change that records no entry, in a clone whose run records no queue
- **THEN** its step is the one given without a queue

#### Scenario: A clone whose run keeps a queue cannot read it
- **WHEN** listing the refs on `origin` fails for a change that records no entry, in a clone whose run records that it keeps a merge queue, and the change's step without a queue is `update-branch` or `enable-auto-merge`
- **THEN** its step is `wait-turn` saying the queue cannot be read, and it merges nothing

#### Scenario: The model where the owner merges
- **WHEN** the marker is on `origin` and the project's delivery model is `trunk`, with every item met
- **THEN** the step is `ready`, the change joins no queue, and nothing waits for a turn

#### Scenario: The two-pull-request model
- **WHEN** the marker is on `origin` and the project's delivery model is `two-prs`
- **THEN** no change and no archive pull request joins the queue

#### Scenario: The CI check
- **WHEN** the `devkit-reviews` check runs on a pull request of a repository whose `origin` holds the marker
- **THEN** it reads no queue and judges what it judged before

#### Scenario: Projects that never read a queue
- **WHEN** `origin` holds the marker and an entry for each of three changes with every delivery item met, one in a `trunk` project, one in a `two-prs` project and one in a project with a delivery train
- **THEN** none of them is handed `join-queue`, `leave-queue` or `wait-turn`, and each gets the step it gets without a queue

### Requirement: A project with a delivery train keeps no merge queue
In a project whose delivery settings carry an accepted delivery train, the delivery checker and the
change loop SHALL read no queue, whatever `origin` holds and whatever a machine records of the change's
entries: no change and no archive pull request of it SHALL be handed `join-queue`, `leave-queue` or
`wait-turn`, and each SHALL get the train's steps as without this capability. A project on the CompozyOS
driver SHALL read no queue either.

#### Scenario: A change in a train project reads no queue
- **WHEN** a change of a `trunk-auto` project with a delivery train has every delivery item met, `origin` holds the marker and an entry of it, and the machine records that entry
- **THEN** its step is `boarded`, as the train gives it, never `join-queue` or `wait-turn`, and on the next calls it stays boarded with no step joining or leaving a queue

#### Scenario: An archive in a train project reads no queue
- **WHEN** the archive pull request of a change of a project with a delivery train is ready and `origin` holds the marker
- **THEN** its step is the archive's `boarded`, never `join-queue`

#### Scenario: A train project whose origin cannot be listed
- **WHEN** a change of a project with a delivery train records an entry, its clone's run records a merge queue, and `origin` cannot be listed
- **THEN** its step is the train's step, never `wait-turn`, and nothing is listed

#### Scenario: A train change back at its plan
- **WHEN** a change of a project with a delivery train still records an entry from an earlier run and goes back to its plan revision
- **THEN** its next action is its plan stage, with no `leave-queue` before it

#### Scenario: A change on the CompozyOS driver
- **WHEN** a change of a project with `driver: compozy` that ships in the merge mode has every delivery item met and `origin` holds the marker
- **THEN** the delivery checker's step and the change loop's next step for it, the view the CompozyOS loop reads included, are the step without a queue, never `join-queue`

### Requirement: A ready change joins the queue at its end
In a repository with a queue, a change whose review is approved at its head (every delivery item met
but being up to date with the base, behind it or in conflict with it, and the pending checks) SHALL join the queue before it merges the
base or enables auto-merge. An archive pull request SHALL join when it qualifies for auto-merge but
for being up to date. Each SHALL take a place after every entry the queue holds.

#### Scenario: The first ready change
- **WHEN** change `a` becomes ready while the queue is empty
- **THEN** the next step is `join-queue`; after it `a` is the queue's only entry and holds the turn

#### Scenario: A second ready change
- **WHEN** change `b` becomes ready while `a` holds the turn
- **THEN** `b` joins after `a`, and `b` does not hold the turn

#### Scenario: A change behind its base with an item open
- **WHEN** change `c` in a repository with a queue is behind its base and its pull request body lacks an item
- **THEN** its step is `edit-pr-body`, never `update-branch`: a change that is not in the queue does not merge the base

#### Scenario: An archive pull request
- **WHEN** the archive pull request of `a` is open, answered, with no conflict, no failing check and its head pushed, while `b` holds the turn
- **THEN** its step is `join-queue`, and once joined it waits behind `b`

#### Scenario: Two changes join at the same moment
- **WHEN** `b` and `c` join at the same moment behind `a`, whatever their machines' clocks say
- **THEN** both end up after `a`, each once, and `a` keeps the turn

### Requirement: Only a conflict the release override resolves may join
A change or archive whose conflict with the base is outside the release files, or cannot be
classified, SHALL NOT join the queue: its step SHALL be the conflict stop it gets without a queue, at
every call until the conflict is resolved.

#### Scenario: A change whose conflict is outside the release files does not join
- **WHEN** change `c` in a repository with a queue is ready except that its pull request conflicts with the base in a file that is not a release file, and the loop is called twice in a row
- **THEN** both calls give the conflict stop `c` gets without a queue, neither gives `join-queue`, and no entry of `c` is on `origin`

#### Scenario: A change whose conflict is only in release files joins
- **WHEN** change `c` in a repository with a queue is ready except that its pull request conflicts with the base only in release files
- **THEN** its step is `join-queue`, and the conflict is resolved in its turn

### Requirement: A join that cannot complete writes no entry
A join that finds no queue on `origin`, or that loses the race to another writer five times, SHALL
leave no entry of the change on `origin` and fail.

#### Scenario: Joining with no queue on origin
- **WHEN** the join command runs for `c` and `origin` holds no marker
- **THEN** it fails, pushes nothing, and removes any record of `c`'s entries this machine keeps

#### Scenario: The queue keeps moving
- **WHEN** every one of five tries of `c`'s join loses the race to another writer
- **THEN** the join fails saying the queue kept moving, and no entry of `c` is left on `origin`

### Requirement: The head of the queue holds the merge turn
Exactly one entry SHALL hold the turn: the first entry whose pull request is open. An entry whose pull
request merged, was closed or no longer exists SHALL be passed over by every reader and removed by the
next change that joins. An entry whose pull request cannot be read SHALL count as open.

#### Scenario: The holder merged
- **WHEN** `a` holds the turn, `b` waits behind it, and `a`'s pull request merges
- **THEN** at `b`'s next loop call `b` holds the turn, with no message from anyone

#### Scenario: An entry closed by hand
- **WHEN** the owner closes the pull request of the change at the head of the queue
- **THEN** the next entry holds the turn

#### Scenario: The holder's pull request closes without a merge
- **WHEN** `a` holds the turn and its pull request is closed without a merge
- **THEN** `a`'s entry no longer holds the turn and at `b`'s next loop call `b` holds it

#### Scenario: GitHub does not answer about the head
- **WHEN** the state of the pull request at the head cannot be read
- **THEN** that entry still holds the turn and the entries behind it wait

### Requirement: A change without the turn waits instead of merging
A queued change or archive that does not hold the turn SHALL get the step `wait-turn`, naming the
holder and its pull request, in place of merging the base, pushing that merge or enabling auto-merge.
Auto-merge SHALL never be enabled out of turn, and auto-merge found on out of turn SHALL be disabled first.

#### Scenario: The waiting change
- **WHEN** `b` is ready and queued behind `a`, which holds the turn with pull request 41
- **THEN** `b`'s step is `wait-turn` naming `a` and pull request 41, whether `b` is behind its base or up to date

#### Scenario: The holder
- **WHEN** `a` holds the turn, is behind its base and every other item is met
- **THEN** its step is `update-branch`; once up to date and its checks green it is `enable-auto-merge`, as without a queue

#### Scenario: Auto-merge on out of turn
- **WHEN** `b` waits behind `a` and auto-merge is on for `b`'s pull request
- **THEN** `b`'s step is `disable-auto-merge`, then `wait-turn`

#### Scenario: The queue cannot be read
- **WHEN** a change that joined the queue cannot list it on `origin`
- **THEN** in place of merging the base or enabling auto-merge its step is `wait-turn` with the queue unreadable, naming no holder

#### Scenario: The queue cannot be read at another step
- **WHEN** a change that joined the queue cannot list it on `origin` and its step without a queue is `verify` or `edit-pr-body`
- **THEN** its step is that same step

#### Scenario: An archive that holds the turn
- **WHEN** the archive pull request of `a` holds the turn and is behind its base, with every other condition for auto-merge met
- **THEN** its step is `update-branch`, and once up to date with its checks green, `enable-auto-merge`

#### Scenario: An archive whose base merge conflicts in release files
- **WHEN** the archive pull request of `a` holds the turn and its merge of the base conflicts only in release files
- **THEN** the archive keeps the turn and the loop's step resolves the release-file conflict

### Requirement: The holder keeps the turn while it redoes what its base merge made stale
The holder SHALL keep the turn while every commit after the one it joined with is a merge of the base,
touches only files under `openspec/`, or renumbers its ADR, and its next step is to merge the base,
push, redo the evidence or a stale review, edit the pull request body, answer a comment, wait for its
checks, resolve a release-file conflict, renumber its ADR, or enable or wait for auto-merge.

#### Scenario: The holder merges the base
- **WHEN** `a` holds the turn and its merge of the base makes its evidence and reviews stale
- **THEN** `a` keeps the turn while the evidence and the stale reviews run again, and enables auto-merge at the end

#### Scenario: A release-file conflict
- **WHEN** the base `a` merges in its turn conflicts with it only in release files
- **THEN** `a` keeps the turn and resolves the conflict

### Requirement: The ADR renumber is work of the turn
When the base holds an ADR with the number of an ADR the change adds, the renumber of that ADR SHALL
be handed only to the holder, and the holder SHALL keep the turn through it. A change that waits SHALL
keep waiting.

#### Scenario: The base took the holder's ADR number
- **WHEN** `a` holds the turn and the base it merged holds an ADR with the number of an ADR `a` adds
- **THEN** `a`'s step renumbers its ADR, and `a` keeps the turn through that commit and the evidence and reviews that run again

#### Scenario: The base took a waiting change's ADR number
- **WHEN** `b` waits behind `a` and the base holds an ADR with the number of an ADR `b` adds
- **THEN** `b`'s step is still `wait-turn`, and the renumber is handed once `b` holds the turn

### Requirement: A change leaves the queue by itself
A queued change SHALL leave the queue, by the step `leave-queue`, as soon as its review is no longer
approved at its head, a commit other than a merge of the base, a change of `openspec/` files or the
renumber of its ADR reaches its branch, a check fails, its pull request conflicts with the base outside
the release files, or it goes back to its plan. Approved again, it SHALL join at the end.

#### Scenario: A reviewer rejects the holder
- **WHEN** `a` holds the turn and a reviewer rejects it at its current commit
- **THEN** `a`'s step is `leave-queue` before the fix, and at `b`'s next loop call `b` holds the turn

#### Scenario: A red check
- **WHEN** a check of the holder's pull request fails
- **THEN** auto-merge is disabled if on, the holder leaves the queue, and then its fix is handed

#### Scenario: The holder's base merge conflicts outside the release files
- **WHEN** `a` holds the turn and the base it merges conflicts with it in a file that is not a release file
- **THEN** `a`'s step is `leave-queue`; every later call gives the conflict stop `a` gets without a queue, never `join-queue`, until the conflict is resolved

#### Scenario: A waiting change whose conflict is outside the release files
- **WHEN** `b` waits behind `a` and its pull request comes to conflict with the base in a file that is not a release file
- **THEN** `b`'s step is `leave-queue`, and its next step is the conflict stop it gets without a queue

#### Scenario: An archive leaves
- **WHEN** the archive pull request of `a` holds the turn and one of its checks fails
- **THEN** its step is `leave-queue`, and the next entry holds the turn at its next loop call

#### Scenario: An archive whose base merge conflicts outside the release files
- **WHEN** the archive pull request of `a` holds the turn and its merge of the base conflicts in a file that is not a release file
- **THEN** its step is `leave-queue`, and its next step is the archive's conflict stop

#### Scenario: A new product commit while waiting
- **WHEN** `b` waits behind `a` and a commit that changes a file outside `openspec/` reaches `b`'s branch
- **THEN** `b`'s step is `leave-queue`

#### Scenario: Back at the end
- **WHEN** `a` left the queue, `b` holds the turn, `c` waits, and `a` is approved again at its new head
- **THEN** `a` joins after `c`

### Requirement: The queue is shared by every machine of the run
The marker and the entries SHALL live on `origin` as refs outside the branches, written only by
pushes that create or delete one ref under the expected old value, so a change on any machine reads
the same queue with no GitHub notice.

#### Scenario: A change on another machine
- **WHEN** `a` on this machine holds the turn and `b`, open on another machine, is ready
- **THEN** `b` joins from its machine and its step is `wait-turn` naming `a`; once `a` merges, `b`'s next step there is `update-branch` or `enable-auto-merge`

#### Scenario: No branch and no file
- **WHEN** a run holds a queue with two entries
- **THEN** no branch is created on `origin`, no file of any branch changes, and the board of open changes on other machines is unchanged

### Requirement: A waiting change keeps its place through local work
A local commit not yet pushed, or an uncommitted file, SHALL NOT by itself make a queued change leave
the queue; a committed change of a file outside `openspec/` SHALL.

#### Scenario: A local commit of plan files while waiting
- **WHEN** `b` waits behind `a` and has a commit touching only files under `openspec/` that is not pushed yet
- **THEN** `b`'s step is still `wait-turn`

#### Scenario: An uncommitted file while waiting
- **WHEN** `b` waits behind `a` and a file of its worktree is changed but not committed
- **THEN** `b`'s step is still `wait-turn`
