<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A merge commit is judged by what it brings into the branch
When the delivery checker decides whether a recorded `Commit:` is still current, a merge commit
after it SHALL count only the files that differ between its first parent and itself, edits made
while resolving and moved files included, and a file outside `openspec/` among them SHALL make the
record stale. Every other commit after the record, each commit the merge brings in included, SHALL
be judged by its own files as before. The stage checker SHALL report the same.

#### Scenario: The base brings only openspec files
- **WHEN** a branch has a product commit before the commit its reviews and `evidence.md` record, and a merge of the base after the record brings only files under `openspec/`
- **THEN** the delivery checker reads the approved or declined reviews and the evidence as current, and the stage checker reports the evidence and review stages passed

#### Scenario: A rejected review when the base brings only openspec files
- **WHEN** the same merge comes after a review that rejects at the recorded commit
- **THEN** the rejected review is stale and the reason names the merge commit and the first file it brought, as the rule for a rejected verdict says (`verdict-files`)

#### Scenario: The base brings a product file
- **WHEN** the same merge brings a file outside `openspec/` from the base
- **THEN** the record is stale with the reason `<recorded short> is behind <merge short>, which touches <that file>`, and the stage checker reports the evidence stage stale

#### Scenario: A product edit made while resolving the merge
- **WHEN** the base brings only files under `openspec/` and the merge commit also changes a file outside `openspec/`
- **THEN** the record is stale and the reason names the merge commit and that file

#### Scenario: A product file moved under openspec by the merge
- **WHEN** the merge commit moves a file from outside `openspec/` to a path under `openspec/`
- **THEN** the record is stale and the reason names the merge commit and the file's old path

#### Scenario: A product commit the merge brings in
- **WHEN** a commit of the base adds a file outside `openspec/` and a later commit of the base removes it, so the merge itself brings only files under `openspec/`
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

