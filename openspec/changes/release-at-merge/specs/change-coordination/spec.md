<!-- devkit-stage specs result=passed attempt=7 commit=98ffb172675d7d320587e3c7d2ca8f51ae6ec410 -->
# Spec Delta

## ADDED Requirements

### Requirement: The release assignment is a session step of the delivery
When the delivery checker answers `assign-release`, the loop SHALL give a session step of the
delivery stage whose detail carries the pull request number, the base branch, the branch and the
command, done as the shipping skill's row says: fetch the base, run the command in the change's
worktree, and on exit 0 push the branch with a plain push. An exit 2 with an error SHALL end the run
blocked with its message; an exit 2 that lists conflicts and names no error SHALL be followed by
`next` again.

#### Scenario: The step is handed
- **WHEN** the delivery checker answers `assign-release` for change `feat`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `delivery`, step `assign-release`, with `detail.number`, `detail.base`, `detail.branch` and `detail.command`, and exits 0

#### Scenario: The command refuses
- **WHEN** the command exits 2 naming an ADR slug that has not landed
- **THEN** the session declares the run blocked and shows the command's message

#### Scenario: The command meets a conflict the base brought after `next`
- **WHEN** the base gained a commit that conflicts with the change in `src/a.ts` after `next` handed `assign-release`, and the command exits 2 listing `src/a.ts` among its conflicts with no error
- **THEN** the session runs `next` again, which hands `resolve-base-conflict` to the implementer's agent, and the run does not end blocked for it

#### Scenario: The same step back with nothing changed
- **WHEN** the step `assign-release` comes back with the same progress key after the session ran it
- **THEN** the run ends blocked as a step that made no progress, as for every session step

### Requirement: The conductor numbers a noted change only through the release step
The conductor SHALL give `assign-release` to the main session. For a change that carries a release
note it SHALL give no release-conflict step, and no ADR renumbering step for an ADR the change lists
without a number; a numbered ADR such a change lists keeps the renumbering step.

#### Scenario: A noted change in conflict
- **WHEN** a change with a release note conflicts with its base only in release files
- **THEN** the conductor answers `assign-release` for the main session, not `resolve-release-conflict` for the implementer

#### Scenario: A noted change whose number the base took
- **WHEN** a change with a release note holds `docs/adr/0018-feat.md` from an earlier assignment and the base took `0018`
- **THEN** the conductor gives no `renumber-adr` step

### Requirement: The conductor classifies a noted change's conflict by the release step's rule
When the conductor hands a change with a release note `assign-release`, it SHALL classify the merge
of the base by the release step's own rule: a conflict the step's masked merge resolves keeps
`assign-release`; any other conflict SHALL go to `resolve-base-conflict`, whose merge takes the
base's side of every release line in conflict, keeps the change's own citations as the branch holds
them beside the base's entries, and writes no number; `assign-release` SHALL follow once that merge
is pushed.

#### Scenario: A noted change in conflict outside the release files
- **WHEN** a change with a release note, in a project that names `devkit.release_tag` and sets no delivery train, conflicts with its base in `README.md` and `CHANGELOG.md`
- **THEN** the conductor answers `resolve-base-conflict` for the implementer, with the base, both paths in `paths`, `README.md` alone in `others` and `noted` set, and once the implementer's merge is pushed the next step is `assign-release`

#### Scenario: A noted change behind a base it conflicts with
- **WHEN** GitHub reports the branch of a change with a release note only behind its base, and the merge of the base would conflict in `README.md`
- **THEN** the conductor answers `resolve-base-conflict`, not `assign-release`

#### Scenario: A noted change whose base extended a one-line list holding its own citation
- **WHEN** the release step numbered a change with a release note `docs/adr/0002-b.md` and wrote `ADR 0002 the rule` on the one-line list `ADRs: docs/adr/ (0001 start; ADR 0002 the rule)` of `docs/context.yaml`, and the base then released, took `0002` for `docs/adr/0002-other.md` and appended `; 0002 other` to that line
- **THEN** the conductor answers `resolve-base-conflict` with `docs/context.yaml` in `others` and `noted` set, not `assign-release`; the implementer's merge keeps both entries on the line, the change's as the branch holds it; once that merge is pushed the next step is `assign-release`, whose command exits 0 with `docs/adr/0003-b.md` and the line `ADRs: docs/adr/ (0001 start; ADR 0003 the rule; 0002 other)`

### Requirement: The planner does not stop without the release note
In a project that names `devkit.release_tag`, when the planner's stage agent stops while the change's
`tasks.md` exists and `release.md` is missing or cannot be read, the stop hook SHALL refuse that stop
once for the unchanged state, naming the file and what is wrong; a second stop in the same state
SHALL go through, and the readiness review and the delivery checker remain the later checks. In a
project without the setting the hook SHALL behave as before.

#### Scenario: A plan written without a note
- **WHEN** the planner stops in a run with `proposal.md`, `design.md` and `tasks.md` written and no `release.md`
- **THEN** the stop is refused once with a reason naming `openspec/changes/<id>/release.md`

#### Scenario: A note that cannot be read
- **WHEN** the planner stops with a `release.md` whose bump is `big`
- **THEN** the stop is refused once with a reason naming the field

#### Scenario: No release file setting
- **WHEN** the project names no `devkit.release_tag` and the planner stops with no `release.md`
- **THEN** the stop goes through as before

### Requirement: A decision record listed without a number is found after its numbering
When `decisions.md` lists `<folder>/<slug>.md` and that file no longer exists because the delivery
renamed it, the loop SHALL read the single `<folder>/<NNNN>-<slug>.md` in its place, so the accepted
record is not reported unreadable and no step asks to accept it again.

#### Scenario: After the numbering
- **WHEN** `decisions.md` lists `docs/adr/feat.md`, the plan is approved, and the branch holds `docs/adr/0027-feat.md` with status accepted
- **THEN** the record is read as accepted, and no `accept-decisions` step is given

#### Scenario: Two numbered files for one slug
- **WHEN** the folder holds both `0027-feat.md` and `0028-feat.md`
- **THEN** the record is reported unreadable, naming both files

## MODIFIED Requirements

### Requirement: From the implementation on, the step inside the stage goes to its role
From the implementation to the archive, the loop SHALL take the stage from the stage checker and the
step inside it from the delivery checker, with the override the retired `/conduct` applied and `/devkit change` keeps (a conflict with the
base, in the release files or outside them), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win. The unit tests and the E2E tests, which the delivery checker does
not know, SHALL be taken from the stage checker alone. For a change with a release note in a project
that names `devkit.release_tag` and sets no delivery train, a pull request behind its base or in
conflict with it, when every conflict of its merge with that base is one the release step's masked
merge resolves (none, or only in the release files, the CI pins, the file `devkit.release_tag`
names, and a text holding the change's own numbers whose merge with those numbers masked is clean),
SHALL go to the session step `assign-release` instead of `resolve-release-conflict` or
`update-branch`; any other conflict, a pull request behind a base whose merge would conflict
elsewhere included, SHALL go to `resolve-base-conflict` as for a change with no release note, its merge taking the base's side of
every release line in conflict and writing no number, and `assign-release` SHALL follow it.

#### Scenario: Implementation and fixes
- **WHEN** the delivery checker's step is `implement`, `fix-review`, `fix-defect`, `fix-checks` or `apply-proposals`
- **THEN** the next action hands it to the implementer's agent

#### Scenario: The agent of a delivery step comes from the checker's row
- **WHEN** the row the delivery checker returns for a step the loop hands to an agent names that step's agent
- **THEN** the next action's agent is the one the row names

#### Scenario: Commits and pull requests
- **WHEN** the step is `commit`, `open-pr`, `push` or `open-archive-pr`
- **THEN** the next action hands it to the commit-and-pr agent

#### Scenario: A conflict only in release files
- **WHEN** the change's or the archive's pull request conflicts with its base only in release files (versions, changelog, catalog, the CI pin), and the change carries no release note
- **THEN** the next action hands `resolve-release-conflict` to the implementer's agent with the release merge command and the conflicting paths

#### Scenario: A release merge that is not pushed yet
- **WHEN** GitHub still reports the pull request in conflict, the local head already holds the base and the pull request's head is an ancestor of the local head and differs from it
- **THEN** the next action hands `push` (for the change's pull request) or `open-archive-pr` (for the archive's) to the commit-and-pr agent with the command `git push origin <branch>`, which holds neither `--force` nor `--force-with-lease`

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the pull request's head is no longer an ancestor of the local head because the branch was rewritten by a rebase, as an earlier version's release step did
- **THEN** the loop hands no push for it: the run ends blocked, saying the pull request's head is not in the local history, for the owner to push by hand

#### Scenario: No step pushes by force
- **WHEN** the loop's rows and every step the delivery checker and the override can return are listed
- **THEN** none of them is `push-rebased` and no command they carry holds `--force` or `--force-with-lease`

#### Scenario: A conflict in any other file
- **WHEN** the change's pull request, or the archive's pull request of an archive that never left a delivery train, conflicts with its base in a file that is not a release file, with or without release files among the conflicting paths, and the change carries no release note
- **THEN** the next action hands `resolve-base-conflict` to the implementer's agent with the base and every conflicting path, and the run does not end blocked for it

#### Scenario: A conflict git cannot classify
- **WHEN** the pull request conflicts and `git merge-tree --write-tree` cannot run (git older than 2.38)
- **THEN** the run ends blocked, saying the conflict cannot be classified, as before

#### Scenario: GitHub reports a conflict the base merges cleanly
- **WHEN** GitHub reports a conflict, the base merges cleanly with the local head, the local head is the pull request's head, the project merges automatically, and the change carries no release note
- **THEN** the next action is the session step `update-branch`

#### Scenario: A change with a release note in conflict only in its release lines
- **WHEN** a change with a release note, in a project that names `devkit.release_tag` and sets no delivery train, has its pull request in conflict with its base only where the release step's masked merge resolves the conflict, or GitHub reports a conflict the base merges cleanly with the local head
- **THEN** the next action is the session step `assign-release`, not `resolve-release-conflict` and not `update-branch`

#### Scenario: A change with a release note in conflict outside its release lines
- **WHEN** such a change's pull request conflicts with its base in `src/a.ts`, with or without release files among the conflicting paths, or its branch is behind a base whose merge would conflict there
- **THEN** the next action hands `resolve-base-conflict` to the implementer's agent with the base, every conflicting path, the ones outside the release lines and `noted`; its merge takes the base's side of every release line in conflict and writes no number, and once that merge is pushed the next step is `assign-release`

#### Scenario: The demonstration
- **WHEN** the step is `verify`
- **THEN** the next action hands it to the verifier's agent

#### Scenario: The code review
- **WHEN** the step is `review`
- **THEN** the next action is a session step that runs the review skill and sets the review file's stage header

#### Scenario: A phase gate
- **WHEN** the step is `gate`
- **THEN** the next action is a session step carrying the gate's command and task; a green run ticks the task, and a red run is declared by the session, which hands one fix to the implementer the first time and ends the run blocked, saying the phase's tests failed, the second time

#### Scenario: A task the conducting session does
- **WHEN** the step is `conductor-task`
- **THEN** the next action is a session step naming the phase and the tasks the session does itself, and no hand-off to the implementer carries them

#### Scenario: A pull-request or archive step of the session
- **WHEN** the step is `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `answer`, `retro`, `archive` or `tick-roadmap`
- **THEN** the next action is a session step naming it, done as the shipping skill's row for that step says

#### Scenario: A question on the pull request only the owner can answer
- **WHEN** the session's answer step finds a decision only the owner can take
- **THEN** the run ends waiting for the owner, with a reply naming the comment's link

#### Scenario: A step this version does not know
- **WHEN** the delivery checker returns a step the loop has no row for
- **THEN** the run ends blocked, saying the next step is unknown

#### Scenario: The loop's rows match what the checkers return
- **WHEN** the loop's rows are compared with every step the delivery checker and the override can return
- **THEN** every returnable step has a row and no row names a step that no checker returns

#### Scenario: The loop and the checker name the same agent for each step
- **WHEN** the loop's own step-to-agent rows are compared with the delivery checker's step-to-agent mapping for every step both name as a hand-off to an agent
- **THEN** both name the same agent, and the one step the checker gives to an agent that the loop runs in the session, the retro, is the only one left out

#### Scenario: The delivery checker cannot read the change
- **WHEN** the delivery checker fails with a usage or settings error
- **THEN** the run ends blocked, saying the change cannot be read, and the command exits 3

#### Scenario: The unit tests are next
- **WHEN** the stage checker's next stage is the unit tests, missing, stale or offered again after a fix
- **THEN** the next action hands the stage to `devkit-core:test-runner`, its detail carrying the declared unit command, coverage command and coverage target, whatever step the delivery checker would give

#### Scenario: The E2E tests are next
- **WHEN** the stage checker's next stage is the E2E tests
- **THEN** the next action hands the stage to `devkit-core:e2e-tester`, its detail carrying the declared E2E command

#### Scenario: A red test stage goes back to the implementer
- **WHEN** the stage checker's next stage is the implementation because the unit tests or the E2E tests failed below their ceiling and nothing changed since
- **THEN** the next action hands the step `fix-tests` to the implementer's agent, its detail naming the failed stage and its file

### Requirement: A requirement a merged change contradicts reopens the grill
When the plan is written and code merged since the grill contradicts what a requirement says, the
planner SHALL write no plan file, add the question to `requirements.md` and set its header back to
pending, so the grill asks the owner again. Any other drift (an ADR number, a release version, a
moved file) SHALL be resolved in the plan without asking the owner. A plan with a release note SHALL
name no ADR number and no version.

#### Scenario: A contradicted requirement
- **WHEN** a requirement names a field that a change merged after the grill removed
- **THEN** the requirements file is pending again with the question added, no proposal is written, and the next action is the grill

#### Scenario: An ADR number taken
- **WHEN** a change with no release note (opened before release notes, or in a project that names no `devkit.release_tag`) finds that the next free ADR number moved because a sibling merged first
- **THEN** the plan takes the next free number, and the owner is not asked

#### Scenario: An unnumbered ADR
- **WHEN** a sibling with an ADR merges while a new change in a project that names `devkit.release_tag` is planned
- **THEN** the plan still cites its ADR `ADR [<slug>]`, names no number, and the owner is not asked

### Requirement: The loop fetches the base branch before it judges a delivery step
When the change command's `next` decides a step of a change in its delivery part, it SHALL first
fetch the default branch from the `origin` remote into that remote's tracking ref, so that every
delivery step, the release-conflict step and the archive steps among them, is judged from the
remote's current base. The fetch SHALL write that one tracking ref and nothing else. For a change
that carries a release note, in a project that names `devkit.release_tag` and sets no delivery
train, the step judged from the fetched base SHALL be `assign-release` wherever the delivery checker
answers it, in place of the release-conflict step and of the update of the branch, unless the merge
of the fetched base conflicts where the release step's masked merge does not resolve it, which goes
to `resolve-base-conflict`.

#### Scenario: A base that moved on the remote
- **WHEN** the remote's `main` holds a commit that conflicts with the change in a release file, the local tracking ref of `main` is one commit behind, `next` runs for the change in delivery, and the change carries no release note
- **THEN** the tracking ref moves to the remote's commit and the action hands the release-conflict step, not the update of the branch saying the base merges cleanly

#### Scenario: A base that moved on the remote, for a change with a release note
- **WHEN** the same remote commit and stale tracking ref meet a change with a release note, in a project that names `devkit.release_tag` and sets no delivery train
- **THEN** the tracking ref moves to the remote's commit and the action is the session step `assign-release`, not the release-conflict step and not the update of the branch

#### Scenario: A base that moved on the remote with a conflict outside the release lines, for a change with a release note
- **WHEN** the remote's `main` holds a commit that conflicts with such a change in `README.md`, the local tracking ref of `main` is one commit behind, and `next` runs for the change in delivery
- **THEN** the tracking ref moves to the remote's commit and the action hands `resolve-base-conflict` to the implementer's agent, not the session step `assign-release`

#### Scenario: The same base without the fetch
- **WHEN** the loop decides the same change from the stale tracking ref without fetching
- **THEN** the action is the update of the branch, which is the step the fetch corrects

#### Scenario: Only the base's tracking ref changes
- **WHEN** the fetch succeeds while the remote also holds a new tag and a moved branch other than the base
- **THEN** only the base's tracking ref differs afterwards: no tag is created, no other remote branch moves, and the working tree and the index are as they were

#### Scenario: A successful fetch is recorded without a line
- **WHEN** the fetch succeeds
- **THEN** the action records that the base was fetched, and its reply holds no extra line

#### Scenario: A change before its delivery
- **WHEN** `next` runs for a change whose stage is still in the plan
- **THEN** nothing is fetched

#### Scenario: A repository without a remote
- **WHEN** the repository has no `origin` remote
- **THEN** nothing is fetched, the action records no fetch and its reply is the one of today
