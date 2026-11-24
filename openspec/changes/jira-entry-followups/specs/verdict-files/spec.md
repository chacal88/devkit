<!-- devkit-stage specs result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A commit of test files leaves the reviews it does not concern current
An approved or declined verdict file of `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` or
`security-reviewer` that lists no undisposed `[blocking]` or `[important]` finding SHALL stay current
after a later commit that touches only `openspec/` paths and test files; every other verdict file
SHALL go stale after it. A commit that touches any other path
outside `openspec/`, and any uncommitted change outside `openspec/` and `.claude/`, SHALL make every
verdict file stale. Each commit after the recorded one SHALL be judged on its own.

#### Scenario: A commit of tests only
- **WHEN** the six reviewers' files record commit A, and one later commit touches only `src/a.test.ts` and `openspec/changes/<id>/tasks.md`
- **THEN** `deliver-check.mjs <id>` lists `code-quality-reviewer` and `test-coverage-reviewer` as stale in the reviews item, and only them

#### Scenario: The review step after the evidence is current again
- **WHEN** in that repository `evidence.md` is recorded again at the new head, with every gate and criterion row passing
- **THEN** the next step of `deliver-check.mjs <id>` is `review` and its `reviewers` are exactly `code-quality-reviewer` and `test-coverage-reviewer`

#### Scenario: The evidence goes stale as before
- **WHEN** `evidence.md` records commit A and the later commit touches only `tests/b.mjs`
- **THEN** the evidence is reported stale and the next step is `verify`, before any `review`

#### Scenario: A product commit in the range
- **WHEN** after commit A one commit touches only `src/a.test.ts` and a second commit touches `src/a.ts`
- **THEN** all six reviewers are listed as stale

#### Scenario: A commit that mixes a test and a product file
- **WHEN** after commit A one commit touches `src/a.test.ts` and `src/a.ts`
- **THEN** all six reviewers are listed as stale

#### Scenario: Uncommitted product work
- **WHEN** after commit A the only later commit touches test files and `src/a.ts` is edited and not committed
- **THEN** all six reviewers are listed as stale

#### Scenario: A reviewer with another name
- **WHEN** a file `reviews/perf-reviewer.md` records commit A and the later commit touches only test files
- **THEN** `perf-reviewer` is listed as stale

#### Scenario: The devkit-reviews check
- **WHEN** a pull request's change has the six reviewers approved at commit A and one later commit touches only test files, and its evidence is current
- **THEN** `deliver-check.mjs --ci` and `guard.mjs ci` both fail naming `code-quality-reviewer` and `test-coverage-reviewer` as stale and no other reviewer

#### Scenario: A rejected verdict of a reviewer that does not read tests
- **WHEN** `spec-reviewer` rejects at commit A, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` approve at commit A, and the one later commit touches only `src/a.test.ts`
- **THEN** `spec-reviewer` is listed as stale and `adr-reviewer`, `architecture-reviewer` and `security-reviewer` are not

#### Scenario: An approved verdict with an undisposed finding of a reviewer that does not read tests
- **WHEN** `spec-reviewer` approves at commit A and its file lists `- [important] x` with no disposition, and the one later commit touches only `src/a.test.ts`
- **THEN** `spec-reviewer` is listed as stale

### Requirement: A rejected verdict goes stale after any commit outside the change's review record
A verdict file whose verdict is neither approved nor declined, a missing `Verdict:` line included,
SHALL go stale after a later commit that touches any path outside the change's own review record:
`openspec/changes/<id>/reviews/`, `openspec/changes/<id>/review.md` and
`openspec/changes/<id>/evidence.md`. A commit that touches only those paths SHALL leave it current.
Uncommitted files and merge commits SHALL count as they do for every verdict file.

#### Scenario: A rejected review fixed in the plan files
- **WHEN** `code-quality-reviewer` rejects at commit A with `review.md` at `Consensus: FAIL (round 1/2)`, `test-coverage-reviewer` approves at commit A, the evidence is current, and one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** `deliver-check.mjs <id>` lists `code-quality-reviewer` as stale, and only it, with the reason `<A short> is behind <commit short>, which touches openspec/changes/<id>/design.md`, and its next step is `review` with `reviewers` exactly `code-quality-reviewer` and `round` 2

#### Scenario: The rejecting round's record committed alone
- **WHEN** a reviewer rejects at commit A and the only later commits touch `openspec/changes/<id>/reviews/`, `openspec/changes/<id>/review.md` or `openspec/changes/<id>/evidence.md`
- **THEN** that verdict is current and the next step is `fix-review` naming that reviewer

#### Scenario: The record committed with another file
- **WHEN** a reviewer rejects at commit A and one later commit touches `openspec/changes/<id>/reviews/` and `openspec/changes/<id>/tasks.md`
- **THEN** that verdict is stale and the reason names `openspec/changes/<id>/tasks.md`

#### Scenario: Paths that only look like the record
- **WHEN** a reviewer rejects at commit A and the one later commit touches only `openspec/changes/<other>/reviews/code-quality-reviewer.md`, `openspec/changes/<id>/reviews.md`, `openspec/changes/<id>/reviewsx/a.md`, `openspec/changes/<id>x/review.md` or `openspec/changes/<id>/proof/evidence.md`
- **THEN** that verdict is stale and the reason names that path

#### Scenario: A verdict file with no Verdict line
- **WHEN** a reviewer's file has a `Commit:` line for commit A and no `Verdict:` line, and the one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** that reviewer is listed as stale

#### Scenario: A rejecting reviewer with another name
- **WHEN** `reviews/perf-reviewer.md` rejects at commit A and the one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** `perf-reviewer` is listed as stale

#### Scenario: Approved and declined verdicts keep their rule
- **WHEN** `code-quality-reviewer` and `test-coverage-reviewer` approve and `security-reviewer` declines at commit A, and the one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** none of them is listed as stale and the reviews item is met

#### Scenario: A plan fix not committed yet
- **WHEN** a reviewer rejects at commit A, `review.md` ends at `Consensus: FAIL (round 1/2)`, and `openspec/changes/<id>/design.md` is edited and not committed
- **THEN** that verdict is current and the next step is `commit`, whose `paths` are exactly `openspec/changes/<id>/design.md`

#### Scenario: Only the review record is not committed
- **WHEN** a reviewer rejects at commit A and the only uncommitted files are under `openspec/changes/<id>/reviews/`, or are `openspec/changes/<id>/review.md` or `openspec/changes/<id>/evidence.md`
- **THEN** that verdict is current and the next step is `fix-review` naming that reviewer

#### Scenario: The plan fix committed
- **WHEN** in the repository of "A plan fix not committed yet" the edit of `openspec/changes/<id>/design.md` is committed
- **THEN** that verdict is stale and the next step is `review` at `round` 2 naming that reviewer, not `fix-review`

#### Scenario: A plan fix after the round-2 stop is not committed yet
- **WHEN** a reviewer rejects at the head, `review.md` ends at `Consensus: FAIL (round 2/2)`, and `openspec/changes/<id>/design.md` is edited and not committed
- **THEN** the next step is `stop-review-deadlock` naming that reviewer

#### Scenario: Nothing to fix
- **WHEN** every reviewer approves at the head with no undisposed finding and `openspec/changes/<id>/design.md` is edited and not committed
- **THEN** the next step is not `commit` for that file

#### Scenario: A merge of the base that brings only openspec files
- **WHEN** a reviewer rejects at commit A and a merge of the base after A brings only `openspec/changes/other.md`
- **THEN** that verdict is stale and the reason names the merge commit and `openspec/changes/other.md`

#### Scenario: The round-2 stop
- **WHEN** a reviewer rejects at the head, `review.md` ends at `Consensus: FAIL (round 2/2)`, and the only commit after the verdict's commit touches the change's review record
- **THEN** the next step is `stop-review-deadlock` naming that reviewer

#### Scenario: A plan fix after the round-2 stop
- **WHEN** in that repository one more commit touches only `openspec/changes/<id>/design.md`
- **THEN** the next step is `review` at `round` 1, as after a product commit

#### Scenario: The devkit-reviews check
- **WHEN** a pull request's change has a reviewer rejecting at commit A and one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** `deliver-check.mjs --ci` and `guard.mjs ci` both fail naming that reviewer as not approved and as stale

#### Scenario: The stage readout after a failed review
- **WHEN** `review.md`'s header says `result=failed`, a reviewer rejects at commit A, and the one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** `flow-check` offers the review stage again with the reason code `rerun-after-fix`, and when that commit touches only the change's review record it offers the implementation with `fix-after-failure`

## ADDED Requirements

### Requirement: An approved verdict with an undisposed finding goes stale as a rejected one does
An approved or declined verdict file that lists a `[blocking]` or `[important]` finding with no
disposition (no `fixed in <sha>` of a commit in the history of the head, no `refuted:`) SHALL follow
the rule of a rejected verdict: it SHALL go stale after a later commit that touches any path outside the change's
own review record, and a commit of that record alone SHALL leave it current.

#### Scenario: A plan fix for an approved verdict's finding, not committed yet
- **WHEN** `test-coverage-reviewer` approves at commit A, its file lists `- [important] x` with no disposition, and `openspec/changes/<id>/design.md` is edited and not committed
- **THEN** that verdict is current and the next step is `commit`, whose `paths` are exactly `openspec/changes/<id>/design.md`

#### Scenario: The plan fix committed
- **WHEN** in that repository the edit of `openspec/changes/<id>/design.md` is committed
- **THEN** `test-coverage-reviewer` is listed as stale with the reason naming that commit and `openspec/changes/<id>/design.md`, and the next step is `review` naming it, not `fix-review`

#### Scenario: The record committed alone
- **WHEN** an approved verdict at commit A lists an undisposed `[important]` finding and the only later commit touches `openspec/changes/<id>/reviews/`
- **THEN** that verdict is current and the next step is `fix-review` naming that reviewer

#### Scenario: The stage readout after the plan fix is committed
- **WHEN** in the repository of "The plan fix committed" for an approved verdict, `flow-check` reads the change
- **THEN** its review stage is stale with the reason code `stale-reviewers` naming `test-coverage-reviewer`

#### Scenario: A disposed finding keeps the approved rule
- **WHEN** an approved verdict at commit A lists `- [important] x · fixed in <a commit in the history of the head>`, or `- [important] x · refuted: <evidence>`, and the one later commit touches only `openspec/changes/<id>/design.md`
- **THEN** that verdict is current
