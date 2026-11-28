<!-- devkit-stage specs result=passed attempt=1 commit=0421f488610ba57ef538ee71e19a25db6d16c7eb -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A plain commit on the branch keeps its rule
A commit on the branch's own line that is not a merge of the base SHALL be judged as before the
own-files rule, whatever files it touches, and the per-reviewer allowances (the test-spared
reviewers, the `openspec/`-only rule for approved or declined verdicts) SHALL stay as they are.
For a change with a release note, a release edit SHALL NOT be judged as a plain commit: a commit
after the recorded evidence or an approved or declined review, the delivery step's commit and its
merge of the base included, whose every changed path differs from its parent (a merge's first
parent) only in release lines (versions, the changelog, the CI pins, the version of the release
file, and an unnumbered ADR renamed to its number, or the change's own ADR renumbered by a later run
of the step after the base took its number, with its citations rewritten) SHALL leave them current.
A rejected review and a change with no note SHALL be judged as before.

#### Scenario: A plain product commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit on the branch changes `src/unrelated.ts`, a file the branch never changed before
- **THEN** the records are stale and the reason names that commit and `src/unrelated.ts`

#### Scenario: A test-only commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit changes only test files
- **THEN** the reviews of the four test-spared reviewers stay current and the evidence and the other reviews are stale, as before this rule

#### Scenario: The step's commit
- **WHEN** the evidence and the approved reviews record commit R and the only later commit is the one `assign-release` made
- **THEN** the delivery checker, the stage checker, `deliver-check --ci` and an owner's forced merge of that head read them as current

#### Scenario: A later run that renumbers the change's own ADR
- **WHEN** the evidence and the approved reviews record commit R after a first run of the step numbered `docs/adr/0002-feat.md`, the base then took `0002` and changed no file of the change, and the only later commit is the step's merge of the base that renumbers the record to `0003` and rewrites its citations
- **THEN** the delivery checker reads them as current

#### Scenario: A release commit that also edits a sentence
- **WHEN** the later commit renames the ADR and also changes a sentence of `docs/openspec-flow.md` that is not a citation
- **THEN** the records are stale and the reason names that commit and `docs/openspec-flow.md`

### Requirement: The open items of a forced merge are named
The open items of a forced merge SHALL be each unticked task of the change's `tasks.md` on the
default branch, each required check that is not green, and each gate file (`evidence.md`, each
required reviewer's `reviews/<reviewer>.md`, and any other reviewer file present) that does not hold
a passing verdict current at the merged head. The reason SHALL say `<N> items open`; N is at least
2, one task and one check.

#### Scenario: Evidence that is missing or not passed
- **WHEN** the merged head has no `evidence.md`, or one whose stage header result is not `passed`
- **THEN** `evidence.md` is an open item, naming why

#### Scenario: Evidence recorded before a product change
- **WHEN** the `Commit:` of `evidence.md` at the merged head is an ancestor of it and a file outside `openspec/` changed between the two
- **THEN** `evidence.md` is an open item naming that file; when only files under `openspec/` changed, or the change has a release note in a project that names `devkit.release_tag` and every other changed file differs between the two only in release lines, it is not

#### Scenario: A review that did not pass
- **WHEN** `reviews/code-quality-reviewer.md` is missing at the merged head, or its `Verdict:` is `REJECTED`, or its approved verdict was recorded before a product change
- **THEN** that file is an open item, naming why

#### Scenario: An approved verdict with an undisposed finding
- **WHEN** an approved or declined `reviews/<name>.md` at the merged head lists a `[blocking]` or `[important]` finding with no disposition (no `refuted: <evidence>`, no `fixed in <sha>` of a commit in the merged head's history), and a commit between its `Commit:` and the merged head touches a path outside the change's own review record (`reviews/`, `review.md`, `evidence.md`)
- **THEN** that file is an open item naming its commit as behind the merged head and the file that changed; when only the change's own review record changed between the two, it is not an open item

#### Scenario: A fixed-in commit is in the merged head's history
- **WHEN** a finding carries `fixed in <sha>` and the compare `<sha>...<merged head>` answers `ahead` or `identical`
- **THEN** the finding is disposed; when it answers `behind` or `diverged`, or the sha is not found (404), the finding stays undisposed and the verdict follows "An approved verdict with an undisposed finding"

#### Scenario: A fixed-in commit that cannot be checked
- **WHEN** the compare `<sha>...<merged head>` of a `fixed in <sha>` finding fails for a reason other than not found
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike

#### Scenario: A verdict recorded on another line of history
- **WHEN** the `Commit:` of `evidence.md` or of a review file at the merged head is not an ancestor of the merged head
- **THEN** that file is an open item naming its commit as not an ancestor of the merged head

#### Scenario: A verdict recorded too far behind to read
- **WHEN** the compare of the `Commit:` of `evidence.md` or of a review file with the merged head lists 300 files or more
- **THEN** that file is an open item naming its commit as too far behind the merged head to read

#### Scenario: The gate files cannot be read
- **WHEN** reading a gate file or the `reviews/` folder at the merged head fails for a reason other than not found, or answers a folder where a file is expected or a file where the folder is expected
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike

#### Scenario: The count
- **WHEN** a forced merge has task 9.6 unticked, `devkit-reviews` `FAILURE`, and `evidence.md` and `reviews/code-quality-reviewer.md` without a passing verdict at its head
- **THEN** the reason says `4 items open` and `next.forced.items` lists those four, tasks first, then checks, then gate files

#### Scenario: The step's commit at a forced merge
- **WHEN** a change with a release note, in a project that names `devkit.release_tag`, is merged by force, its passed evidence and its approved reviews record commit R, and the only later commit is the `assign-release` step's, which changes the manifests' versions, `CHANGELOG.md`, the CI pins, the change's ADR renamed to its number and the citations of it
- **THEN** no `evidence.md` and no `reviews/<reviewer>.md` is among the open items

#### Scenario: The step's commit also edits a sentence at a forced merge
- **WHEN** the same step's commit also changes a sentence of `docs/openspec-flow.md` that is not a citation
- **THEN** `evidence.md` and each approved review are open items, each naming R as behind the merged head, which changes `docs/openspec-flow.md`

#### Scenario: A product commit after the step's commit at a forced merge
- **WHEN** a commit after the step's changes `plugins/x.mjs`
- **THEN** `evidence.md` is an open item naming R as behind the merged head, which changes `plugins/x.mjs`

#### Scenario: No note or no release tag at a forced merge
- **WHEN** the compare from R lists the same files as the step's commit, and the change has no `release.md` at the merged head, or the project's `openspec/config.yaml` there names no valid `devkit.release_tag`
- **THEN** `evidence.md` and each approved review are open items naming the first of those files, as before this rule

#### Scenario: A rejected review or an undisposed finding across the step's commit
- **WHEN** a noted change's compare from R lists only the step's files, and one review's `Verdict:` is `REJECTED` while another is approved but lists an undisposed finding
- **THEN** both are open items, the rejected one naming its verdict and the other naming R as behind the merged head and the first file outside the change's own review record

#### Scenario: A file of the release comparison cannot be read
- **WHEN** for a noted change the read of `release.md` or `openspec/config.yaml` at the merged head, of a changed file at R or at the merged head, or of an ADR folder fails for a reason other than not found, or answers a file with no content
- **THEN** `deliver-check.mjs foo` answers `next.step` `blocked`, quoting the error, from the default branch and from branch `foo` alike, and never reads the gate file as current
