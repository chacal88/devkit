<!-- devkit-stage specs result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Spec Delta

## Purpose

Says what the required `devkit-reviews` check (`deliver-check --ci`, also run as `guard.mjs ci`)
judges on a pull request: which changes it checks by their script, how it treats a pull request
that touches several changes, and how it explains a failing archive pull request.

## ADDED Requirements

### Requirement: The check judges only changes on a devkit script
The check SHALL judge a selected change only when the schema its `.openspec.yaml` names (else the
project's default schema) is `devkit` or `devkit-lite`. For a change on any other schema it SHALL
check nothing, print the change, its schema and that nothing was checked, and exit 0. A change on
a devkit script SHALL be checked exactly as before.

#### Scenario: A change on another schema
- **WHEN** the pull request's branch selects a change whose `.openspec.yaml` names `spec-driven`, every task ticked and no review or evidence written
- **THEN** the check exits 0 and prints that the change is on the `spec-driven` script, not a devkit script, and that nothing was checked

#### Scenario: The same answer from both entries
- **WHEN** the check runs as `deliver-check.mjs --ci` and as `guard.mjs ci` on that pull request
- **THEN** both exit 0 with the same note

#### Scenario: A devkit-script change is checked as before
- **WHEN** the selected change is on `devkit-lite` and a required review is missing
- **THEN** the check exits 1 naming the missing review, as before this change

### Requirement: A pull request touching several changes is judged per delivered change
When the branch selects no change and the pull request touches the folders of several active
changes, the check SHALL judge each touched devkit-script change with at least one ticked task,
print one result per judged change, and exit 0 only when every judged change passes. A touched
change with no ticked task, or on another schema, SHALL be printed as a note and fail nothing.

#### Scenario: Two delivered changes, both passing
- **WHEN** the pull request touches `a` and `b`, both on `devkit-lite`, each with ticked tasks and every item met
- **THEN** the check prints a result for `a` and one for `b` and exits 0

#### Scenario: One of two delivered changes failing
- **WHEN** the pull request touches `a` and `b`, both delivered, and `b` lacks its evidence
- **THEN** the check prints both results, names what `b` lacks, and exits 1

#### Scenario: A plan and another schema ride along
- **WHEN** the pull request touches `a` (delivered, passing), `next` (on `devkit`, no ticked task) and `legacy` (on `spec-driven`)
- **THEN** the check judges only `a`, prints `next` as a plan only and `legacy` as not on a devkit script, and exits 0

#### Scenario: The branch still selects first
- **WHEN** the branch is named after `a` and the pull request also touches `b`
- **THEN** only `a` is judged, as before this change

### Requirement: A pull request that delivers no change still fails
A pull request whose touched devkit-script changes hold no ticked task SHALL fail, whether it
touches one such change or several, and the message SHALL say that the pull request delivers no
change. A pull request whose touched changes are all on other schemas SHALL pass with the note.

#### Scenario: One plan-only change
- **WHEN** the pull request touches only `next`, on `devkit`, with no ticked task
- **THEN** the check judges `next` and exits 1 on its unticked tasks, as before this change

#### Scenario: Several plan-only changes
- **WHEN** the pull request touches `next` and `later`, both on devkit scripts, neither with a ticked task
- **THEN** the check exits 1 and says that the pull request delivers no change, naming both

#### Scenario: Only changes on other schemas
- **WHEN** the pull request touches `legacy` and `old`, both on `spec-driven`
- **THEN** the check exits 0 and prints, for each, that nothing was checked

### Requirement: An archive pull request is judged by the archived change's script
For each folder an archive pull request brings under `openspec/changes/archive/`, the check SHALL
read the schema of that folder's own `.openspec.yaml`. A folder on another schema SHALL be a note.
A devkit-script folder SHALL be checked as before: a missing retro, an unanswered proposal or a
file no approved proposal names fails.

#### Scenario: The archive of a change on another schema
- **WHEN** an archive pull request brings `openspec/changes/archive/2026-11-20-legacy/`, whose `.openspec.yaml` names `spec-driven`, with no `retro.md`
- **THEN** the check exits 0 and prints that `legacy` is not on a devkit script and nothing was checked

#### Scenario: The archive of a devkit change with an unanswered proposal
- **WHEN** an archive pull request brings a `devkit-lite` folder whose retro has an unanswered proposal
- **THEN** the check exits 1 naming the unanswered proposal, as before this change

### Requirement: A missing retro is explained
When a devkit-script folder of an archive pull request has no `retro.md`, or one without a
`## Proposed updates` section, the check SHALL exit 1 with a message that names the file, says it
holds the change's retro with a `## Proposed updates` section and the owner's answer to each
proposal, and names the archive step that writes it.

#### Scenario: No retro.md
- **WHEN** an archive pull request brings a `devkit` folder without `retro.md`
- **THEN** the check exits 1 and its message names `<folder>/retro.md`, the `## Proposed updates` section with the owner's answers, and the retro step of the archive that writes it

#### Scenario: A retro without the section
- **WHEN** the folder's `retro.md` has no `## Proposed updates` section
- **THEN** the check exits 1 and its message says the section is missing and what it must hold
