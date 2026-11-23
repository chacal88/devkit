<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

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
