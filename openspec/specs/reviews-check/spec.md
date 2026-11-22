# reviews-check Specification

## Purpose
Says what the required `devkit-reviews` check (`deliver-check --ci`, also run as `guard.mjs ci`)
judges on a pull request: which changes it checks by their script, how it treats a pull request
that touches several changes, and how it explains a failing archive pull request.

## Requirements

### Requirement: The check judges only changes on a devkit script
The check SHALL judge a selected change only when the schema its `.openspec.yaml` names (else the
project's default schema) is `devkit` or `devkit-lite`, and SHALL judge a selected change on
`devkit-project` as a slice that is not archived. For a change on any other schema it SHALL check
nothing, print the change, its schema and that nothing was checked, and exit 0. A change on a devkit
script SHALL be checked exactly as before.

#### Scenario: A change on another schema
- **WHEN** the pull request's branch selects a change whose `.openspec.yaml` names `spec-driven`, every task ticked and no review or evidence written
- **THEN** the check exits 0 and prints that the change is on the `spec-driven` script, not a devkit script, and that nothing was checked

#### Scenario: The same answer from both entries
- **WHEN** the check runs as `deliver-check.mjs --ci` and as `guard.mjs ci` on that pull request
- **THEN** both exit 0 with the same note

#### Scenario: A devkit-script change is checked as before
- **WHEN** the selected change is on `devkit-lite` and a required review is missing
- **THEN** the check exits 1 naming the missing review, as before this change

#### Scenario: A slice whose folder is not archived
- **WHEN** the pull request's branch selects an active change on `devkit-project`
- **THEN** the check exits 1 and says that a slice reaches the default branch with its folder archived in its pull request, and that `/devkit project <slice>` archives it

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
read the schema of that folder's own `.openspec.yaml`. A folder on `devkit-project` SHALL be judged by
the slice contract. A folder on any other schema SHALL be a note. A devkit-script folder SHALL be
checked as before: a missing retro, an unanswered proposal or a file no approved proposal names fails.

#### Scenario: The archive of a change on another schema
- **WHEN** an archive pull request brings `openspec/changes/archive/2026-11-20-legacy/`, whose `.openspec.yaml` names `spec-driven`, with no `retro.md`
- **THEN** the check exits 0 and prints that `legacy` is not on a devkit script and nothing was checked

#### Scenario: The archive of a devkit change with an unanswered proposal
- **WHEN** an archive pull request brings a `devkit-lite` folder whose retro has an unanswered proposal
- **THEN** the check exits 1 naming the unanswered proposal, as before this change

#### Scenario: The archived folder of a slice
- **WHEN** a pull request brings `openspec/changes/archive/2026-11-21-billing/`, whose `.openspec.yaml` names `devkit-project`, with no `retro.md`
- **THEN** the check judges it by the slice contract and does not ask for a retro

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

### Requirement: A slice's pull request is judged by the slice contract
For an archived `devkit-project` folder `<date>-<slice>` the pull request brings, the check SHALL
pass only when its six stage records (`business.md`, `domain-model.md`, `architecture.md`,
`implementation-plan.md`, `roadmap.md`, `review.md`) each open with their stage's header, the first
five passed or not applicable and `review.md` passed, and the ADR reviewer's verdict is approved,
recorded with no uncommitted changes, and current. Each failure SHALL be named.

#### Scenario: A complete slice
- **WHEN** the six records are settled as required, `reviews/adr-reviewer.md` says `Verdict: approved` with a commit no later commit invalidates, and the pull request touches only allowed paths
- **THEN** the check exits 0 and prints the slice and that it passed the slice contract, from both entries

#### Scenario: A phase still pending
- **WHEN** `architecture.md` says `result=pending`
- **THEN** the check exits 1 naming `architecture.md` and its result

#### Scenario: A record with no stage header
- **WHEN** the first line of `business.md` is not a stage header (a heading, an empty file, or the header on a later line)
- **THEN** the check exits 1 saying `business.md` has no stage header on its first line, from both entries

#### Scenario: A record with a malformed stage header
- **WHEN** the first line of `architecture.md` starts like a stage header and is not one (an unknown result, or no closing `-->`)
- **THEN** the check exits 1 saying `architecture.md` has a malformed stage header, from both entries

#### Scenario: No approved review
- **WHEN** `reviews/adr-reviewer.md` is missing, or its first `Verdict:` line is not approved
- **THEN** the check exits 1 naming the review file and what it lacks

#### Scenario: A review whose commit does not exist
- **WHEN** the `Commit:` line of `reviews/adr-reviewer.md` names a sha that resolves to no commit
- **THEN** the check exits 1 saying that commit does not resolve to a commit, from both entries

#### Scenario: A review recorded with uncommitted changes
- **WHEN** the `Commit:` line of `reviews/adr-reviewer.md` carries the `(uncommitted changes)` marker, whatever commit it names
- **THEN** the check exits 1 naming the review file, its commit and that it was recorded with uncommitted changes, from both entries

#### Scenario: A review made stale by a later document change
- **WHEN** a commit after the review's `Commit:` changes, against its first parent, a file under `docs/design/<slice>/`, `docs/adr/` or `docs/decisions/`
- **THEN** the check exits 1 saying the review is behind that commit and that file

#### Scenario: A merge from the default branch that brings no document
- **WHEN** the only commit after the review's `Commit:` merges the default branch and brings no file under those folders
- **THEN** the review is current

#### Scenario: A merge from the default branch that brings an ADR
- **WHEN** a commit after the review's `Commit:` merges the default branch, which added a file under `docs/adr/` after the review
- **THEN** the check exits 1 saying the review is behind that merge and naming the ADR file, so the ADR reviewer reads the new ADR

### Requirement: A slice's pull request changes only the slice's files
A pull request that brings an archived `devkit-project` folder SHALL fail when it changes a file
outside `docs/design/<slice>/`, `docs/adr/`, `docs/decisions/`, `openspec/roadmap.md` and that
archived folder; when `roadmap.md` of the folder is not applicable and it changes
`openspec/roadmap.md`; and when it changes `openspec/roadmap.md` other than by appending after the
base's bytes.

#### Scenario: A file outside the slice
- **WHEN** the pull request also changes `src/app.ts` or `docs/design/1-business-vision.md`
- **THEN** the check exits 1 naming each such file

#### Scenario: A roadmap line rewritten
- **WHEN** the pull request changes an existing line of `openspec/roadmap.md`
- **THEN** the check exits 1 saying the roadmap may only be appended to by a slice

#### Scenario: The roadmap stage does not apply
- **WHEN** `roadmap.md` of the folder says `result=not-applicable` and the pull request changes `openspec/roadmap.md`
- **THEN** the check exits 1 saying the roadmap must stay as it was

#### Scenario: Rounds appended
- **WHEN** `roadmap.md` of the folder is passed and the head's `openspec/roadmap.md` starts with every byte of the base's, followed by new rounds
- **THEN** the roadmap part of the contract is met

### Requirement: The pull request hook judges a slice by the same contract
`gh pr create`, run in a checkout whose branch names a slice whose folder is archived in that
checkout and not on the default branch, SHALL be refused, with the reasons, exactly when the slice
contract against the default branch would fail; the hook SHALL NOT judge that pull request by any
other change's reviews or evidence.

#### Scenario: A slice ready for its pull request
- **WHEN** the branch `billing` holds the archived folder of `billing`, every record is settled, the review is approved and current, and another change is active in the checkout
- **THEN** `gh pr create` is not refused

#### Scenario: A slice with a pending review
- **WHEN** `review.md` of the archived folder is missing
- **THEN** `gh pr create` is refused, naming `review.md`

#### Scenario: A review recorded with uncommitted changes
- **WHEN** the archived folder's `reviews/adr-reviewer.md` carries the `(uncommitted changes)` marker on its `Commit:` line
- **THEN** `gh pr create` is refused, saying the review was recorded with uncommitted changes

#### Scenario: A default branch that shares no history with the slice
- **WHEN** the default branch the hook compares with has no common ancestor with the slice's branch
- **THEN** `gh pr create` is refused, saying the default branch is not available to compare the slice with and that the full history must be fetched
