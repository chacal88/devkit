<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `review-openspec-fix` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, `specs/verdict-files/spec.md`,
`specs/change-delivery/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `c561553` (devkit-openspec 0.21.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/deliver-check.mjs#staleness` (line 201) | Takes `{ allowed = isOpenspec }`. After the checks on the `Commit:` line itself (no line, uncommitted mark, dirty tree outside `openspec/` and `.claude/`, no head, resolves, ancestor of `HEAD`), walks `git rev-list --parents <recorded>..HEAD` and lists each commit's paths with `touchedPaths()` (a merge against its first parent). The first path `allowed` refuses gives `<short> is behind <c short>, which touches <path>`; none gives null |
| `deliver-check.mjs#readReviews` (line 246) | For every `reviews/*.md`: `{ name, verdict, why }`, where `why` is `staleness(...)` with `allowed` = `openspec/` or a test file for the four `TEST_SPARED_REVIEWERS`, and the default (`openspec/`) for any other name. The verdict plays no part |
| Readers of `readReviews` | `reviewsItem` (item 2: `details.stale`, `details.rejected`, the reason); `collectState` (`reviews[].current = !why`, line 1306); `flow-check.mjs#collectFlow` (`staleReviewers`, line 237); `deliver-check --ci` and `guard.mjs ci` through `checkOne` (`reviewsItem`). `git grep -n "readReviews(" -- plugins ':!*.test.*'` lists exactly these |
| `deliver-check.mjs#nextStep` (lines 1129 to 1164) | `rejectedNow` = reviews `current` and not approved. With `Consensus: FAIL` at round 2 or more: `stop-review-deadlock`. Otherwise `fix-review` for `rejectedNow` (and approved reviews with an undisposed finding). Later, `review` for the missing, stale and undisposed reviewers, with `round = FAIL && round === 1 && reRejected ? 2 : 1`, where `reRejected` is "one of them has a verdict that is not approved" |
| `deliver-check.mjs` line 989 | `const approved = (verdict) => verdict === 'APPROVED' \|\| verdict === 'DECLINED'`, used by `nextStep`; `reviewsItem` repeats the same test inline |
| `flow-check.mjs#stageState` (line 387) and the walk (line 516) | The review stage is stale while `staleReviewers()` names anyone; a `failed` review stage with a stale reason is `fixed`, and the walk offers it again (`rerun-after-fix`); not fixed, it offers the `onFail` stage (`fix-after-failure`) |

The defect, as the change loop meets it: a rejecting round writes `reviews/<r>.md`
(`Verdict: rejected`, `Commit: A`) and `review.md` (`result=failed`, `Consensus: FAIL (round 1/2)`);
the fix touches only `openspec/` (managed-agents-study: `fe49b25`); the rejected verdict stays
current, so `nextStep` answers `fix-review` and `flow-check` answers `fix-after-failure`, again and
again.

Constraints:

- `deliver-check.mjs` is one of the three files a project's `devkit-reviews` workflow downloads
  (`docs/openspec-flow.md`, CI section): no new module and no new import.
- `staleness()` is shared with the evidence (`tasksItem`, `acceptanceItem`) and the stage readout;
  the evidence keeps its rule (requirements, assumption 3), so `staleness()` itself does not change.
- Product code is closed until readiness is approved (the `guard.mjs` edit lock).

## Goals / Non-Goals

**Goals:**

- One place decides which later commits leave a verdict current: one helper picks the `allowed`
  predicate from the reviewer's name and verdict, and `readReviews` passes it to the existing
  `staleness()`. No second walk over commits, and no copy in `flow-check.mjs`.
- Each condition of the new predicate and each label it can give has its own test, negatives
  included (D-3).
- Every existing test that could pin the replaced rule is found and named with its invariant (D-5);
  none is edited, except the CI pin assertion of the release.

**Non-Goals:**

- Changing `staleness()`, `touchedPaths()`, the reason wording, the dirty-tree rule or the
  evidence's rule.
- Changing `nextStep`, the round formula or the round-2 stop (D-2 shows they already give what
  AC-1 and AC-4 ask).
- Changing `flow-check.mjs`, `guard.mjs` (its `gh pr create` hook reads verdicts without `Commit:`
  lines; its slice contract has its own staleness, out of scope), `change-loop.mjs`,
  `conduct-check.mjs` or the panel.
- Changing `plugins/openspec/skills/devkit/SKILL.md` line 64 ("a fix outside the change's folder
  makes both stale"): it stays true.

## Decisions

### D-1 The rule (AC-1 to AC-3, spec `verdict-files`)

In `plugins/openspec/hooks/deliver-check.mjs`, section "git facts and staleness":

- Move `const approved = (verdict) => ...` (line 989) up, right after `TEST_SPARED_REVIEWERS`, with
  the comment `// A verdict that passes the reviews item: approved, or declined (no surface).`
  `nextStep` keeps using it; `reviewsItem`'s inline filter
  `x.verdict !== 'APPROVED' && x.verdict !== 'DECLINED'` becomes `!approved(x.verdict)`. No
  behaviour changes.
- Add two helpers, after `approved`:

```js
// The change's own review record (review-openspec-fix D-1): its reviews/ folder, review.md and evidence.md.
function reviewRecord(id) // -> (path) => boolean
// Which later commits leave reviewer `name`'s verdict current (review-openspec-fix D-1): for an approved or
// declined verdict, commits of openspec/ (and of test files, for the test-spared reviewers), as before;
// for any other verdict, a missing one included, commits of the change's own review record only.
function verdictAllowed(id, name, verdict) // -> (path) => boolean
```

  - `reviewRecord(id)`: with `dir = \`openspec/changes/${id}/\``, a path is in the record when it
    starts with `${dir}reviews/`, or equals `${dir}review.md`, or equals `${dir}evidence.md`. Plain
    string comparison, no pattern, so a `.` in the id is literal.
  - `verdictAllowed(id, name, verdict)`: `!approved(verdict)` gives `reviewRecord(id)`; otherwise
    `TEST_SPARED_REVIEWERS.includes(name)` gives `(p) => isOpenspec(p) || isTestFile(p)`, and any
    other name gives `isOpenspec`.
- `readReviews(root, id, facts)` reads the verdict once and passes
  `{ allowed: verdictAllowed(id, name, verdict) }` to `staleness()` for every file. Its comment
  says that the rule is the one `verdictAllowed` picks.

What follows from it, with no further code:

- The first path the walk finds outside the record gives the usual reason, for example
  `stale code-quality-reviewer (1a2b3c4 is behind 5d6e7f8, which touches openspec/changes/<id>/design.md)`.
- A merge commit is still judged by its first-parent diff (`touchedPaths`), so a merge of the base
  that brings only `openspec/` files outside the record makes a rejected verdict stale (D-4).
- The dirty-tree check runs before the walk and keeps ignoring `openspec/` and `.claude/`
  (assumption 5): an uncommitted plan fix makes nothing stale.
- A verdict file with no `Verdict:` line (`readValue` gives null) is not approved, so it takes the
  record rule (spec scenario "A verdict file with no Verdict line").

**Alternatives.**

- *A second walk over commits for rejected verdicts.* Rejected: `staleness()` already takes the
  predicate (`review-writer-prompt` D-6) and walks merges by their first parent
  (`merge-staleness-first-parent`); a copy would drift from both.
- *Make a rejected verdict stale after any later commit at all.* Rejected by the owner's assumption 2:
  committing the rejecting round's own record would then start round 2 with no fix.
- *Let the record be the whole change folder (`openspec/changes/<id>/`).* Rejected: a fix in
  `design.md` or a study inside the folder, the case of the retro, would stay current.
- *Pick the predicate inside `staleness()` from a verdict argument.* Rejected: `staleness()` also
  serves the evidence and the stage readout, which know no verdict.

### D-2 What `next`, the stage readout and the check do with it (AC-1, AC-2, AC-4)

No code changes here; this is why none is needed, and the tests of D-3 prove it.

- A rejected verdict made stale by a plan fix has `current: false` in `collectState`, so it is not
  in `rejectedNow`: no `stop-review-deadlock` and no `fix-review` for it. The evidence keeps its rule,
  so after a plan-only fix it is still current and no `verify` comes first. `reviewsItem` lists the
  reviewer in `details.stale`, so `toReview` names it, and only it when the approved reviewers
  stay current (AC-3).
- The round: `reRejected` is true because that reviewer's verdict is not approved, so after
  `Consensus: FAIL (round 1/2)` the step is `review` at round 2. The formula already gives round 2 when
  the stale reviewer is the rejecting one; test `nextStep row 9: after FAIL (round 1/2) and a fix
  commit the rejected reviewer is re-run as round 2` in `plugins/openspec/hooks/deliver-check.test.mjs`
  pins it with synthetic facts, and test 14 (D-3) pins it on a real repository.
- After `FAIL (round 2/2)`, a rejected verdict still current stops on `stop-review-deadlock` (AC-4,
  test 16). Once the owner commits a plan fix, the verdict goes stale and the step is `review` at
  round 1, exactly as after a product fix today (test "resume: a round-2 deadlock on disk stops while
  current and re-reviews as round 1 after the owner's product commit (AC-4, AC-5)" in
  `plugins/openspec/hooks/deliver-check.test.mjs`); test 17 pins it for a plan fix. The round
  numbering is out of scope and does not change.
- The stage readout reads `staleReviewers()` through `readReviews`: after a plan fix, a `failed`
  review stage is `fixed` and offered again (`rerun-after-fix`); after a record-only commit it is
  not, and the fix is offered (`fix-after-failure`). The change loop follows both (tests 19, 20).
- `deliver-check --ci` and `guard.mjs ci` already fail on a rejected verdict; after a plan fix the
  item 2 reason also says `stale <reviewer> (...)` (test 18). Pass and fail do not change.

### D-3 The tests (AC-1 to AC-4)

Every new test's name starts `review-openspec-fix <n>: `, so
`--test-name-pattern="^review-openspec-fix "` selects them all. "Exact reason" means
`assert.equal` or `assert.ok(reason.includes(...))` on the whole parenthesised text.

**In `plugins/openspec/hooks/deliver-check.test.mjs`**, a new section at the end of the file,
`// ---- review-openspec-fix: a rejected verdict and the change's review record (spec verdict-files)`,
with the file's fixtures (`base()`, `head()`, `review()`, `reviews()`, `withReviews()`, `put()`,
`commitAll()`, `git()`, `SIX`, `TEST_READERS`, `sixRepo()`, `staleOf()`, `readyRepo()`,
`changeFiles()`, `fullEvidence()`, `ciRepo()`, `bothEntries()`, `onlyOpenspec()`, `mergeMain()`,
`s7()`) and two new ones:

- `rejectedRepo(over = { 'code-quality-reviewer': 'rejected' })`: `base()`; `A = head(root)`; the
  reviewers `{ 'code-quality-reviewer': 'approved', 'test-coverage-reviewer': 'approved', ...over }`
  written with `review(verdict, A)`; `commitAll(root, 'review round')` (a commit of the record only);
  returns `{ root, A }`.
- `planFix(root, path = 'openspec/changes/feat/design.md')`: writes `fixed\n` to `path` and returns
  `commitAll(root, 'plan fix')`.

| Test | Guard or label | Build | Expected | AC |
|---|---|---|---|---|
| `review-openspec-fix 1: a rejected verdict is stale after a commit that touches only openspec/ outside the change's review record` | rejected, path outside the record (positive) | `rejectedRepo()`; `D = planFix(root)` | `reviewsItem(root, 'feat')`: `details.stale` `['code-quality-reviewer']`, `details.rejected` `['code-quality-reviewer']`; exact reason `stale code-quality-reviewer (<A7> is behind <D7>, which touches openspec/changes/feat/design.md)` | AC-1 |
| `review-openspec-fix 2: a commit of the change's reviews/ folder only leaves a rejected verdict current` | rejected, `reviews/` (negative) | `rejectedRepo()`; `reviews/code-quality-reviewer.md` rewritten as `review('rejected', A)` plus a line `- [nit] noted`, committed | `details.stale` `[]`, `details.rejected` `['code-quality-reviewer']` | AC-2 |
| `review-openspec-fix 3: a commit of review.md only leaves a rejected verdict current` | rejected, `review.md` (negative) | `rejectedRepo()`; `openspec/changes/feat/review.md` = `# Review: feat\n\nConsensus: FAIL (round 1/2)\n`, committed | `details.stale` `[]` | AC-2 |
| `review-openspec-fix 4: a commit of evidence.md only leaves a rejected verdict current` | rejected, `evidence.md` (negative) | `rejectedRepo()`; `openspec/changes/feat/evidence.md` = `Commit: <A>\n\n# Evidence\n`, committed | `details.stale` `[]` | AC-2 |
| `review-openspec-fix 5: a commit of the record together with another openspec/ file makes a rejected verdict stale and names that file` | rejected, mixed commit (positive) | `rejectedRepo()`; in one commit `C`, `reviews/code-quality-reviewer.md` rewritten as in 2 and `openspec/changes/feat/tasks.md` = `- [x] 1.1 a\n- [x] 1.2 b\n` | exact reason `stale code-quality-reviewer (<A7> is behind <C7>, which touches openspec/changes/feat/tasks.md)` | AC-1 |
| `review-openspec-fix 6: paths that only look like the change's review record make a rejected verdict stale` | the record's bounds (positive, five cases) | for each `p` of `openspec/changes/other/reviews/code-quality-reviewer.md`, `openspec/changes/feat/reviews.md`, `openspec/changes/feat/reviewsx/a.md`, `openspec/changes/featx/review.md`, `openspec/changes/feat/proof/evidence.md`: a fresh `rejectedRepo()`, `C = planFix(root, p)` | per case, with `p` as the message: `details.stale` `['code-quality-reviewer']` and the reason holds `which touches ${p}` | AC-1 |
| `review-openspec-fix 7: a test-spared reviewer's rejected verdict is stale after a commit of test files only, and its approved peers stay current` | rejected, test-spared name, test path (positive) | `base()`; `A`; the six of `SIX` written at `A`, `approved` except `spec-reviewer` `rejected`; committed; `src/a.test.ts` = `t\n` committed alone | `staleOf(root)` is `['code-quality-reviewer', 'spec-reviewer', 'test-coverage-reviewer']` | AC-1, AC-3 |
| `review-openspec-fix 8: a verdict file with no Verdict line is stale after an openspec/-only commit` | missing verdict (positive) | `base()`; `A`; `reviews(A, { 'code-quality-reviewer': \`Commit: ${A}\n\n# Review\n\` })` written and committed; `planFix(root)` | `details.stale` `['code-quality-reviewer']`, `details.rejected` `['code-quality-reviewer']` | AC-1 |
| `review-openspec-fix 9: a rejecting reviewer outside the six is stale after an openspec/-only commit` | rejected, any name (positive) | `rejectedRepo({ 'perf-reviewer': 'rejected' })`; `planFix(root)` | `details.stale` `['perf-reviewer']` | AC-1 |
| `review-openspec-fix 10: approved and declined verdicts stay current after an openspec/-only commit outside the record` | approved, declined (negative) | `rejectedRepo({ 'code-quality-reviewer': 'approved', 'security-reviewer': 'declined' })`; `planFix(root)` | `reviewsItem` status `met`, `details.stale` `[]` | AC-3 |
| `review-openspec-fix 11: a test-spared reviewer's approved verdict stays current after a commit of test files only` | approved, test-spared name, test path (negative) | `sixRepo()`; `src/a.test.ts` = `t\n` committed alone | `staleOf(root)` is `TEST_READERS`, sorted: no test-spared reviewer is stale | AC-3 |
| `review-openspec-fix 12: a plan fix written and not committed leaves a rejected verdict current` | uncommitted `openspec/` (negative) | `rejectedRepo()`; `openspec/changes/feat/design.md` written, not committed | `details.stale` `[]` | AC-2 |
| `review-openspec-fix 13: a merge of main that brings only openspec/ makes a rejected verdict stale and names the merge` | rejected, merge commit (positive, D-4) | `base()` on `main`; `git switch -q -c feat`; `A`; `reviews(A, { 'code-quality-reviewer': review('rejected', A) })` written and committed; `git switch -q main`; `onlyOpenspec(root)`; `git switch -q feat`; `mergeMain(root)`; `M = head(root)` | `details.stale` `['code-quality-reviewer']`; exact reason `stale code-quality-reviewer (<A7> is behind <M7>, which touches openspec/changes/other.md)` | AC-1 |
| `review-openspec-fix 14: a rejected round fixed by an openspec/-only commit gets review at round 2 naming only the rejecting reviewer` | the loop, plan fix (positive) | `t = readyRepo()`; `A`; `code-quality-reviewer` `rejected` and `test-coverage-reviewer` `approved` at `A`, `changeFiles({ 'review.md': '# Review: feat\n\nConsensus: FAIL (round 1/2)\n' })`; `commitAll` | first `t.next()`: `fix-review`, `reviewers` `['code-quality-reviewer']`; then `openspec/changes/feat/design.md` committed alone (fixture check: `git diff --name-only HEAD^ HEAD` prints only that path); `t.next()`: `[step, round, reviewers]` is `['review', 2, ['code-quality-reviewer']]` | AC-1, AC-2, AC-3 |
| `review-openspec-fix 15: committing a rejecting round's record alone, twice, keeps fix-review` | the loop, record only (negative) | as 14 up to the record, plus `fullEvidence(t.root, t.env)` before the first commit; then `review.md` gains a line `Next: fix.` and is committed | after each commit `t.next()` is `fix-review` naming `code-quality-reviewer`; fixture check: `git diff --name-only HEAD~2 HEAD` lists only paths under `openspec/changes/feat/reviews/`, `review.md` and `evidence.md` | AC-2 |
| `review-openspec-fix 16: a round-2 rejection committed with its record stops on stop-review-deadlock` | the loop, round 2 (negative) | `t = readyRepo()`; the verdicts of 14; `review.md` = `# Review: feat\n\nConsensus: FAIL (round 1/2)\n\nConsensus: FAIL (round 2/2)\n`; `commitAll` | `t.next()`: `stop-review-deadlock`, `reviewers` `['code-quality-reviewer']` | AC-4 |
| `review-openspec-fix 17: after the round-2 stop, an openspec/-only commit opens a review at round 1, as a product commit does` | the loop, after the stop | as 16, then `planFix(t.root)` | `t.next()`: `[step, round, reviewers]` is `['review', 1, ['code-quality-reviewer']]` | AC-4 |
| `review-openspec-fix 18: the devkit-reviews check fails a rejected review after an openspec/-only fix and names it stale` | the check (positive) | `root = ciRepo()`; `A`; `reviews/test-coverage-reviewer.md` = `review('rejected', A)` committed; control on `bothEntries(root)`; then `planFix(root)` | control: each entry exits 1, `out` matches `/not approved: test-coverage-reviewer \(rejected\)/` and does not match `/stale test-coverage-reviewer/`; after the fix: each exits 1 and `out` matches both `/not approved: test-coverage-reviewer \(rejected\)/` and `/stale test-coverage-reviewer \(/` | AC-1 |

**In `plugins/openspec/hooks/flow-check.test.mjs`**, a new section at the end of the file,
`// ---- review-openspec-fix: the stage readout after a rejected review (spec verdict-files)`, with
`liveChange()`, `liveReport()`, `stageOf()`, `reviewFile()`, `put()`, `commitAll()` and `git()`.
Each builds: `root = liveChange({ review: 'failed' })`; `A = git(root, 'rev-parse', 'HEAD')`;
`openspec/changes/feat/reviews/code-quality-reviewer.md` = `Verdict: REJECTED\nCommit: <A>\n\n# Review\n`
and `openspec/changes/feat/reviews/test-coverage-reviewer.md` = `reviewFile(A)`; `commitAll(root,
'review round')`; control: `liveReport(root).next` is stage `implementation`, reason code
`fix-after-failure`.

| Test | Then | Expected | AC |
|---|---|---|---|
| `review-openspec-fix 19: the stage readout offers the review again after a failed review is fixed by an openspec/-only commit` | `openspec/changes/feat/design.md` rewritten and committed | `stageOf(r, 'review').state` `failed`; `r.next.stage` `review`; `r.next.reasonCode` `rerun-after-fix` | AC-1 |
| `review-openspec-fix 20: the stage readout keeps the fix after a commit of the rejecting round's record only` | `reviews/code-quality-reviewer.md` gains a line `- [nit] noted` and is committed | `r.next.stage` `implementation`; `r.next.reasonCode` `fix-after-failure` | AC-2 |

The flow-check suite imports the deliver-check suite, and the guard suite imports both, so the
phase-1 gate runs all twenty and the whole-suite gate runs them again. Every new test takes its git
env from the files' existing helpers (`git()` with `GIT_ENV`; `shipRepo`'s and `ciRepo`'s env),
which blank the branch variables.

**Test first.** Task 1.1 writes the twenty tests and runs
`node --test --test-name-pattern="^review-openspec-fix " plugins/openspec/hooks/flow-check.test.mjs`
on the unchanged code, saving the output as printed to
`openspec/changes/review-openspec-fix/proof/red.txt`. Expected, from today's rule (every
`openspec/` path, and test files for the four, leave any verdict current):

- fail: 1, 5, 6, 7, 8, 9, 13 (today the verdict stays current), 14 (today `fix-review` again),
  17 (today `stop-review-deadlock` again), 18 (today no `stale` in the reason), 19 (today
  `fix-after-failure`);
- pass: 2, 3, 4, 12, 15, 20 (the record and uncommitted files keep `fix-review` today too), 10, 11
  (approved and declined keep their rule), 16 (the stop). They pin guards the new code must keep.

That run is the task's check, never a gate. A test whose result differs from this list is looked
at before the fix: either the fixture does not build what the table says, or the analysis is wrong,
and `design.md` is corrected in the same task.

### D-4 Two consequences, recorded for the owner at approval

Both follow from requirements assumption 1 as the owner confirmed it ("any commit after its
`Commit:` line that touches a path other than the change's own review record"); the plan keeps
them, says them in the docs (D-6) and pins them with tests.

- **A merge of the base that brings only `openspec/` files stales a rejected verdict** (test 13).
  If the branch is updated while a review is rejected and before the fix, the rejecting reviewer runs
  again on unchanged code. The loop itself never does this: `fix-review` and `review` come before
  `update-branch` in `nextStep`, so only a manual "Update branch" meets it.
- **Any file committed together with a rejecting round's record counts as a fix** (test 5). The
  docs ask to commit the record on its own.

The cost in both cases is at most one review round: the reviewer gets its previous verdict and the
range, rejects again on the same findings, and round 2's stop hands the change to the owner.

### D-5 Existing tests that could pin the replaced rule

Searched: `git grep -n "review('rejected'\|Verdict: rejected\|Verdict: REJECTED\|'REJECTED'" -- '*.test.mjs' '*.test.tsx'`,
and a scan of every `test(...)` block of every suite (`plugins/openspec/hooks/*.test.mjs`,
`plugins/openspec/skills/openspec-setup/scripts/*.test.mjs`,
`plugins/core/skills/review-change/scripts/review-round.test.mjs`, `plugins/panel/hooks/*.test.tsx`,
`plugins/compozy/skills/*/scripts/*.test.mjs`) that both writes a rejected verdict and commits.
No test pins "a rejected verdict stays current after an `openspec/` commit outside the record".
None is edited.

- `plugins/openspec/hooks/deliver-check.test.mjs`:
  - "item 2: missing required reviewers, a rejected review and a missing Commit: line are open":
    a rejected verdict at the head, no later commit. Invariant: a rejected review keeps item 2
    open. Unaffected.
  - "field-fixes 10 verdict: item 2 counts the first Verdict line, rejected then approved, and
    reports the reviewer as rejected (AC-3)" and "field-fixes 10 verdict: the devkit-reviews check
    from both entries passes on approved then rejected and fails on the reverse naming the reviewer
    (AC-3)": the commit after the verdict touches only `reviews/`, the record, so the verdict stays
    current under the new rule as well; they assert the status, the rejected list and the exit code.
    Invariant: the first `Verdict:` line decides. Unaffected.
  - "resume: a round-2 deadlock on disk stops while current and re-reviews as round 1 after the
    owner's product commit (AC-4, AC-5)" and "AC-3 fix-restales-both (a): after a rejected review and
    its fix commit, verify comes first and then review at round 2": the fix is a product commit,
    stale under both rules. Invariant: a product fix re-runs verify, then review at the round the
    formula gives. Unaffected; they are AC-4's and D-2's regression proof.
  - "review round: findingsItem reads findingLine's refuted line as refuted and its open line as
    undisposed": an unresolvable `Commit:`; item 3 only. Unaffected.
  - The synthetic `nextStep` tests ("nextStep row 8: …", "nextStep row 7: FAIL (round 2/2) with a
    current rejected review stops (AC-4)", "nextStep rows 7 and 9: …", "nextStep row 9: after FAIL
    (round 1/2) and a fix commit the rejected reviewer is re-run as round 2", "nextStep: a rejected
    review and an approved one with an open finding give one fix-review …", "D2: a current rejected
    review beside a current defect gives fix-review, before fix-defect"): they pass `current`
    directly and never reach git. Invariant: the order of the steps and the round formula. Unaffected.
  - The approved-verdict staleness tests ("staleness: …", "item 2: reviews written before an
    openspec/-only commit are still met", "item 2: declined is accepted when its Commit: is current,
    and stale otherwise", every "review-writer-prompt AC-8 …" test, every "merge-staleness …" test):
    approved or declined verdicts only. Invariant: their rule (AC-3). Unaffected.
- `plugins/openspec/hooks/flow-check.test.mjs`: "flow-check AC-6: deliver-check gives the same step
  with and without stage headers" (its `fix-review` fixture writes the rejected verdict uncommitted
  at the head), "flow-check stages: a failed stage offers its fix, then itself after the fix"
  (synthetic `staleness`) and "flow-check stages: the same stage with nothing changed ends blocked"
  (a failed review stage with no reviewer file). Invariant: the walk's failed-stage rows. Unaffected.
- `plugins/openspec/hooks/guard.test.mjs`, the "field-fixes 10 verdict: …" tests: the `gh pr create`
  hook reads verdicts through `reviewConsensus`, which reads no `Commit:` line. Unaffected.
- `plugins/openspec/hooks/project-loop.test.mjs`, the slice tests with `REJECTED` verdicts: the
  slice contract's own staleness (`guard.mjs#sliceReviewStale`), out of scope. Unaffected.
- `plugins/openspec/hooks/change-loop.test.mjs`, "change-loop docs: the design records the answers",
  the assertion `assert.match(flow, /v0\.21\.1/, …)`. Invariant: the CI snippet pins the current
  release. Not a staleness test; it changes with the release in task 2.1 (D-6).

### D-6 Documents and release

- `docs/openspec-flow.md`, "The `Commit:` staleness rule" (line 416):
  - "so an update of the branch that brings only `openspec/` files leaves reviews and evidence
    current" becomes "so an update of the branch that brings only `openspec/` files leaves the
    evidence and the approved or declined reviews current".
  - After "…it stales the others, `code-quality-reviewer` and `test-coverage-reviewer` among them,
    and the evidence." add: "A verdict that is neither approved nor declined (rejected, or no
    `Verdict:` line) has a narrower rule: it stays current only while every later commit touches
    nothing but the change's own review record (`openspec/changes/<id>/reviews/`, `review.md` and
    `evidence.md`). A fix committed in the plan files, any other file under `openspec/` (a merge of
    the base that brings one included) or a test file makes it stale, so the rejecting reviewer runs
    again at the next round; committing the rejecting round's verdicts, `review.md` or the evidence
    leaves it current, and `next` stays on `fix-review`. Commit a rejecting round's record on its
    own: any other file committed with it counts as a fix."
- `docs/openspec-flow.md`, "Order of the delivery steps" (line 418): after "(a commit of test files
  only stales the evidence and the two reviewers that read tests)" add "; a rejected review also goes
  stale after a commit of any file outside the change's review record, so a fix made in the plan
  files gets the next round with no new evidence".
- `docs/openspec-flow.md`, the `update-branch` row (line 527): "and an update that brings only
  `openspec/` files leaves them current" becomes "and an update that brings only `openspec/` files
  leaves the evidence and the approved reviews current (a rejected review goes stale and runs again)".
- `plugins/core/skills/review-change/SKILL.md` (line 178): "or a commit after it touched anything
  outside `openspec/`." becomes "or a commit after it touched anything outside `openspec/`; for a
  rejected verdict, anything outside the change's own review record (`reviews/`, `review.md` and
  `evidence.md`), so a fix made in the plan files re-runs the rejecting reviewer." The rest of the
  bullet stays.
- Release (`CONTRIBUTING.md`, step 5): devkit-openspec 0.21.1 to 0.21.2 and devkit-core 0.9.0 to
  0.9.1, each in its `plugin.json` and in `.claude-plugin/marketplace.json`; the marketplace from
  0.25.1 to 0.25.2; a `CHANGELOG.md` section `## 0.25.2 — a review fixed in the plan files` with:
  - a **devkit-openspec** 0.21.2 bullet: a rejected verdict goes stale after any later commit
    outside the change's own review record (`reviews/`, `review.md`, `evidence.md`), `openspec/` and
    test files included, so a fix made in the plan files gets the next review round with no hand
    from the owner; a commit of the record alone keeps `fix-review`; approved and declined verdicts
    keep their rule. "The CI snippet now pins `v0.21.2`, the release's tag.";
  - a **devkit-core** 0.9.1 bullet: the `review-change` skill's stale definition names the rule for
    a rejected verdict;
  - a Docs bullet: the staleness rule, the order of the delivery steps and the `update-branch` row
    of the flow document.
- Every `v0.21.1` of `docs/openspec-flow.md` (three lines: the snippet comment, the snippet URL and
  the "Pin the commit sha" paragraph) becomes `v0.21.2`.
- `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the
  answers": the pin assertion becomes `assert.match(flow, /v0\.21\.2/, 'the CI snippet pins the
  current release (review-openspec-fix: 0.21.2)')`, and `assert.doesNotMatch(flow, /v0\.21\.1/, 'no
  pin left on the previous release')` is added beside the existing ones.
- `openspec/roadmap.md`: unchanged; the archive ticks the round 17f line.

## Decisions and ADRs

No ADR is needed. The change narrows when one kind of verdict file stays current; it keeps every
recorded decision, and it takes no alternative an ADR rejected:

- ADR 0008 decision 4: the `Verdict:` and `Commit:` lines, the writer rules and the delivery
  contract stay as they are; only how a recorded `Commit:` is read for a rejected verdict changes.
  None of ADR 0008's rejected alternatives (Agent tool only, the whole delivery as a Workflow,
  verify after the file, a saved workflow, more reviewers) is touched.
- ADR 0012 decision 4: the check still recomputes reviews, findings, gates and acceptance proof at
  the PR head; a rejected review still fails it. None of its rejected alternatives is touched.
- ADR 0002: its consequence "strict up-to-date re-runs stale reviews after each base update" stays
  true. None of its rejected alternatives (the owner's merge everywhere, a direct merge, a human
  approval, a merge queue, a label Action) is touched.

The alternatives rejected in D-1 were rejected by the owner's assumptions or by this design, not by
an ADR.

## Risks / Trade-offs

See the risk table of the implementation plan.

## Implementation plan

**Per surface.** Hooks (`plugins/openspec/hooks/`): `deliver-check.mjs` (D-1), new tests in
`deliver-check.test.mjs` and `flow-check.test.mjs` (D-3), the pin assertion in
`change-loop.test.mjs` (D-6). Skill text of devkit-core: `skills/review-change/SKILL.md` (D-6). Docs
and release: D-6. No backend, frontend, worker or panel surface.

**File structure.**

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/deliver-check.mjs` (`approved` moved, `reviewRecord`, `verdictAllowed`, `readReviews`, `reviewsItem`'s filter) |
| modify | `plugins/openspec/hooks/deliver-check.test.mjs` (tests 1 to 18 and two fixtures added) |
| modify | `plugins/openspec/hooks/flow-check.test.mjs` (tests 19 and 20 added) |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (the pin assertion only) |
| modify | `plugins/core/skills/review-change/SKILL.md`, `docs/openspec-flow.md`, `CHANGELOG.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| create | `openspec/changes/review-openspec-fix/proof/red.txt` |
| delete | none |

**Estimate.** Optimistic 2.5 h, likely 4 h, pessimistic 6 h. The pessimistic case is a loop fixture
(`readyRepo`) whose PR or evidence facts get in the way of the expected step, plus a red run under
the CI branch variables.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Tests 1 to 13 and the two fixtures (deliver-check suite) | 1.0 | Testing | LOW |
| Tests 14 to 18 (the loop and the check) | 0.75 | Testing | MEDIUM |
| Tests 19 and 20 (flow-check suite) and the red run | 0.5 | Testing | MEDIUM |
| `approved` moved, `reviewRecord`, `verdictAllowed`, `readReviews` | 0.25 | Core | LOW |
| `docs/openspec-flow.md` and `review-change` SKILL text | 0.5 | Documentation | LOW |
| Release: versions, CHANGELOG, three doc pins, pin test, catalog check | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A file committed with a rejecting round's record, outside it, starts round 2 with no fix | MEDIUM × MEDIUM | D-4; the docs say to commit the record alone (D-6); test 5 pins the rule; the cost is one round, ended by the owner's stop |
| An "Update branch" bringing only `openspec/` files while a review is rejected re-runs the rejecting reviewer before the fix | LOW × MEDIUM | D-4: the loop puts `fix-review` and `review` before `update-branch`; test 13 pins it; the `update-branch` row says it |
| The record's bounds are wrong (`reviews.md`, `reviewsx/`, another change's folder, an id prefix, `proof/evidence.md`) | LOW × HIGH | Plain comparisons with the trailing `/` (D-1); test 6 covers each bound |
| The approved or declined rule changes by mistake | LOW × HIGH | `verdictAllowed` returns today's predicates for them; tests 10 and 11 and the unchanged AC-8, item 2 and merge-staleness tests (D-5) |
| The stage readout or the check reads verdicts another way and does not follow | LOW × MEDIUM | Assumption A-1; tests 18, 19 and 20 prove both readers |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | New tests use the files' existing env helpers; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| An existing test pins the replaced rule outside D-5's list | LOW × MEDIUM | D-5's searches covered every suite; the whole suite runs in phase 2 before any review |
| A sibling change bumps devkit-openspec or devkit-core too | MEDIUM × LOW | `CONTRIBUTING.md` step 5: the change that merges main later takes the next version after main's |
| A project's `devkit-reviews` workflow keeps the old reader until its pin moves | HIGH × LOW | A rejected review fails that check under either rule; only the reason text differs |

**Assumptions.**

- A-1: every reader of a verdict's currency goes through `readReviews` (Context table;
  `git grep -n "readReviews(" -- plugins ':!*.test.*'` is the check). If one did not, it would keep
  today's rule.
- A-2: `root` is the repository's top level, so the paths `git diff-tree` prints start with
  `openspec/changes/<id>/`; `isOpenspec` makes the same assumption today (`guard.mjs#findRoot`).
- A-3: a change id holds only `[\w.-]` (`locateChange` refuses any other), so the string
  comparisons of `reviewRecord` need no escaping.
- A-4: `readValue` upper-cases the verdict (`guard.mjs#readValue`), so `approved`, `Approved` and
  `APPROVED` all read `APPROVED`, and a template line with `|` reads as no verdict.
- A-5: the `readyRepo()` fixture ends with a clean tree and current evidence (its own assertion that
  the walk reached `ready`), so the step after a plan fix is decided by the reviews alone.

**Dependencies.** `merge-staleness-first-parent` (archived 2026-11-22: the first-parent walk the rule
reuses); `review-writer-prompt` (archived 2026-11-22: the `allowed` option, the test-spared
reviewers, devkit-openspec 0.21.x); `managed-agents-study` (archived: retro item 1). ADR 0002, 0008
and 0012 as cited.

## Migration Plan

Nothing to migrate: no file format, JSON field, exit code or step name changes. A session gets the
new rule when it updates devkit-openspec; a project's `devkit-reviews` workflow gets it when its pin
moves to `v0.21.2`. Rollback: revert the change's pull request; the old rule only keeps a rejected
verdict current longer, which costs the owner's hand, never a wrong merge.
