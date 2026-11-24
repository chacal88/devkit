<!-- devkit-stage specs result=passed attempt=1 commit=2ecd562495b490011ebc73c0165172169b92b8b7 -->
# Spec Delta

## ADDED Requirements

### Requirement: The release assignment is a session step of the delivery
When the delivery checker answers `assign-release`, the loop SHALL give a session step of the
delivery stage whose detail carries the pull request number, the base branch, the branch and the
command, done as the shipping skill's row says: fetch the base, run the command in the change's
worktree, and on exit 0 push the branch with a plain push. A command that exits 2 SHALL end the run
blocked with its message.

#### Scenario: The step is handed
- **WHEN** the delivery checker answers `assign-release` for change `feat`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `delivery`, step `assign-release`, with `detail.number`, `detail.base`, `detail.branch` and `detail.command`, and exits 0

#### Scenario: The command refuses
- **WHEN** the command exits 2 naming an ADR slug that has not landed
- **THEN** the session declares the run blocked and shows the command's message

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
