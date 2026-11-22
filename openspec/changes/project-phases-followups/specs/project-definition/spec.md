<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The ADR reviewer clears the slice
After the roadmap stage, the `adr-reviewer` agent SHALL review the slice's documents and new or
changed ADRs against the project's ADRs. Its verdict SHALL be recorded as the review stage; a rejection
SHALL return the findings to the owner's architecture conversation and the review SHALL run again,
two rounds at most, then the run ends blocked. A verdict recorded with uncommitted changes SHALL NOT be
recorded, and the review SHALL run again.

#### Scenario: Approved
- **WHEN** the reviewer writes `Verdict: approved` with the commit it reviewed
- **THEN** the review record passes with that commit and the next action archives the slice

#### Scenario: Rejected twice
- **WHEN** the second review round is also rejected
- **THEN** the run ends blocked, naming the review and its findings file

#### Scenario: A document changed after the review
- **WHEN** a commit after the reviewed one changes a file under `docs/design/<slice>/` or an ADR folder
- **THEN** the review is reported stale and runs again

#### Scenario: A verdict recorded with uncommitted changes
- **WHEN** the reviewer's verdict names the current commit and its `Commit:` line carries the `(uncommitted changes)` marker, the slice active or archived on its branch
- **THEN** recording it is refused with a reply in the person's language saying the verdict was written with changes that were not committed, no review record is written, and the next action hands the review to the ADR reviewer again
