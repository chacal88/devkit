<!-- devkit-stage specs result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

#### Scenario: A plain product commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit on the branch changes `src/unrelated.ts`, a file the branch never changed before
- **THEN** the records are stale and the reason names that commit and `src/unrelated.ts`

#### Scenario: A test-only commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit changes only test files
- **THEN** the reviews of the four test-spared reviewers stay current and the evidence and the other reviews are stale, as before this rule
