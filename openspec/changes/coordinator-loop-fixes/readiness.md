<!-- devkit-stage readiness result=passed attempt=12 commit=8c624687336f2832441babad63cca97a41c527e2 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 8c62468. The only commit after the plan revision 8504644 is 8c62468, and it adds files under
`proof/` only. `git diff --quiet 8504644 HEAD` on `proposal.md`, `design.md`, `tasks.md` and `specs/` reports no
difference, so the plan under review is the plan of 8504644. The uncommitted files under `proof/` belong to the
implementer's D-14 runs. They were read where needed and not edited.

Since attempt 11 (header commit 9edb304), phases 3 to 5 and tasks 6.1 to 6.3 were implemented and their gates ran
green. In 6.4, R16 passed. R17 failed as D-14 worded it, and 8504644 revised the plan in four separate items:
- (a) R17's expected results (`design.md:882`, with D-21's new sentence `:1410-1414`, and `tasks.md:477-484`).
- (b) Task 6.4a (`tasks.md:489-501`): D-20's `findByCommits` bullet (`design.md:1344-1351`) and T142
  (`design.md:1163`).
- (c) Task 6.4b (`tasks.md:502-512`): two `## Troubleshooting` rows of D-22 (`design.md:1489-1497`), plus a D-15
  row (`design.md:989`).
- (d) Task 6.4c (`tasks.md:513-524`): D-4's further-round words (`design.md:466-475`).

This report judges the plan with (b) included, as the caller asked. Section 13 answers whether dropping (b) alone
leaves the plan consistent.

Checks run at HEAD (`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`, `--concurrency=2`, no other suite running):
- `openspec validate coordinator-loop-fixes --type change --strict --no-interactive` prints "Change
  'coordinator-loop-fixes' is valid".
- `python3 scripts/check.py` prints "all checks passed".
- 6.4b's test command, before any edit: 3 files, 33 tests, 33 pass. A separate run shows that T139 and
  `change-budget AC-10` both run by name.
- 6.4c's two commands, before any edit: `review-round.test.mjs` 103 tests pass. The five named patterns over the
  four files give 7 tests, 7 pass.
- 6.4a's kept tests, before the edit (`^forced-merge-path 1: L`, `^coordinator-loop-fixes AC-17 T1`,
  `^field-fixes 4` on `deliver-check-archive.test.mjs`): 39 tests, 39 pass.
- The whole suite was not run. The caller's notes forbid it, and gate 6.6 belongs to the conducting session.
- `openspec/config.yaml`: `origin/main` (3ca2e47) is an ancestor of HEAD. The only differences between them are this
  change's own edits (the `x-devkit:` comments and the `Live roadmap:` rule), so no new rule applies to the revision.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The caller gave facts and no verdict. Nothing in its message was taken as a verdict.

## 2. Scope validation
Classification: correct.
- (a) changes only what R17 expects, and leaves the behaviour alone.
- (b) closes the one lookup that D-20's rule had not reached yet. `findByCommits` arrived with the 6.1 merge of
  `forced-merge-path`, and the requirement "A change's own pull request" of the `change-delivery` delta already
  states the rule for any lookup.
- (c) and (d) fix two texts the earlier edits missed: one D-22 text and the D-4 text that the 6.1 merge brought.

No item adds a capability. The CHANGELOG section 0.53.0 already covers all three edits:
- devkit-openspec: "a change whose id starts with `archive-` finds its own pull request" (`CHANGELOG.md:12`).
- devkit-core: "the review-change skill ... take the round `limit`".
- Docs: "`docs/openspec-flow.md` (... the `x-devkit:` block ...)".

So no version or release file changes, as 6.4a says.

## 3. Proposal review
No findings. The proposal is unchanged. AC-17 (`proposal.md:71`, "finds that pull request as its own") and AC-18
(`proposal.md:72`) are the criteria that (a) and (b) serve.

## 4. Design review
Claims re-derived against live code:
- (b) `findByCommits` (`plugins/openspec/hooks/deliver-check.mjs:837-865`) skips with
  `isArchiveHead(p.head?.ref)` at `:855`. That is the only occurrence of the text, so the 6.4a check "prints 0, then
  1" is sound.
- `foreignArchiveHead(id, name)` is exported at `:719`, and `id` is in scope inside `findByCommits`.
- `findChangePr` reaches `findByCommits` only when the merged list is full (`:831`).
- `isOwnPr` (`:745-750`) already refuses a foreign archive head. With the new skip, the pull requests of
  `chore/archive-archive-x` and `archive-archive-x` are still skipped before their files are read, as T142 asserts.
  The pull request of head `archive-x` reaches `isOwnPr` and is accepted.
- With today's code, T142's first assertion gets `{ none: true }`, the failure 6.4a expects.
- The kept `forced-merge-path 1: L` tests (`deliver-check-archive.test.mjs:2851-2993`) all test id `auto-merge`.
  Their only archive head of the commit arm is `chore/archive-auto-merge` (L2, `:2879`), and the full list uses
  `chore/archive-n<i>`. Each differs from the id under test, so the tests keep their results (D-20,
  `design.md:1350-1351`).
- The fixtures that T142 is to reuse exist at `:2840-2849` (`cap`, `COMMITS_KEY`, `PULLS_KEY`, `restPr`), beside
  `archiveIdRepo` and T123 (`:3348`).
- (a) R17's expectations. D-21's new sentence (`design.md:1410-1414`) says the walk answers item 5 first:
  - `collectState` sets `postMerge = ship !== 'plan' && (delivery.delivered || forced)`
    (`deliver-check.mjs:2356`).
  - On the change's own branch, item 5 is `prItem(..., { merge: true })` whatever the ship mode (`:2397-2399`).
  - `origin/main`'s `prItem` is met only at `pr.headRefOid === facts.head`. Otherwise it is blocked with
    "PR #<n> merged at <sha>; local head <sha> differs" (`git show origin/main:plugins/openspec/hooks/deliver-check.mjs`,
    `:1294-1296`). The `reason` key comes from `item` (`:409`), as R17's `-dc.json` check reads it.
  - This branch adds `advanced` (`headInBase` plus `merge-base --is-ancestor`) at `:1309-1315`.
  - `change-loop.mjs` maps the checker's `blocked` step to `pr-problem` (`BLOCKED_STEP`, `:1132`, used at `:1449`).
    The end is on `currentId`, the stage walk's current stage.
  - The "on the stage `evidence`" part is inferred, not run by this review: `origin/main`'s walk on the own branch
    judges staleness, and `src/a.ts` makes the evidence stale first. R17 itself proves it. If R17 shows another
    stage, 6.4's rule stops the run for a revision (`tasks.md:475-476`).
  - The own-commit expectation follows from the same code: the head is not in the base, so `advanced` is false.
- (c) The two rows are at `docs/openspec-flow.md:868` and `:870`, with the "before" words D-22 quotes.
  `budgetOf` (`change-loop.mjs:158-164`) always gives the change's own `.openspec.yaml` as `file`, and the
  `waiting-budget` reply names it (`:290`). This holds up D-22's "the reply always names the change's own file".
- (d) The sentence is `plugins/core/skills/review-change/SKILL.md:128`, with exactly the words D-4 quotes.
  `review-round.workflow.js:64-78` accepts `round` from 1 to `limit`, and 2 when no `limit` is given. The loop's
  `review` and `review-resolution` steps carry `limit` only when it is raised (`deliver-check.mjs:2209`, `:2271`).
  Both facts agree with the new words. The repository holds no other live copy of the sentence: a grep finds it
  only in this change's plan, historical CHANGELOG 0.52.1 text and archived changes.

Findings:
- Low, Nice to have: `design.md:1321-1325` (D-20, "What is wrong") still says "two readers drop such a head"
  (`isOwnPr` and the merged-list filter). With (b), the Decision lists a third reader (`:1344`), so the diagnosis
  undercounts. No implementer choice depends on it. Smallest correction: "three readers ... and `findByCommits`
  (the commit lookup, from `forced-merge-path`)". If (b) is dropped instead, see section 13.

## 5. Specs review
No findings. No spec delta changed in the revision, and strict validation passes. The `change-delivery`
requirement "A change's own pull request" (`specs/change-delivery/spec.md:60-67`) has no lookup qualifier in
"SHALL be the change's own branch whatever its prefix". With (b), every lookup meets it.

## 6. Tasks review
Every new task path exists, and every grep in the tasks was checked against the tree:
- 6.4a: `isArchiveHead(p.head?.ref)` occurs once. The test name pattern follows T119 to T123's
  `coordinator-loop-fixes AC-17 T1nn ` form.
- 6.4b: each "prints 0" pattern now matches the row to be edited. After the edit, neither matches the new text: the
  `.` before `devkit:` cannot match the "x" of `x-devkit:`. Each "prints 1" pattern matches the new row text byte
  for byte.
- 6.4b's pre-edit grep finds one asserting test, `stage-models AC-10 ... four model rows`
  (`stage-models.test.mjs:1414-1420`). It reads `/setting-unknown/` and `/models/` and is in D-15
  (`design.md:989`). `change-budget AC-10` reads the token-budget paragraph, not the row
  (`change-loop-remote-state.test.mjs:823-839`).
- 6.4c: "accepts only rounds 1 and 2" occurs once now. "it is the owner's further round, quoting the owner's
  words" occurs once now and stays once. No test reads either sentence (the grep exits 1).
- 6.4c's name patterns cover every test that reads the review skill's text in the four files named. In
  `deliver-check-cli.test.mjs` those are `:555` and `:666`. The mention at `:1225` is a fixture path, and the rest
  only name the skill. `review-round.test.mjs` runs whole.
- `format: review-change` asserts `/starts at round 1/` (`:562`). That text is at `SKILL.md:125`, which 6.4c does
  not touch.
- 6.4's added sentence (`tasks.md:481-484`) gives the order between the open runs and 6.4a to 6.4c, with a reason.
  R16's PR 107 came through the merged list (`proof/checks.txt`, the `r16` line). It does not come through
  `findByCommits`.
- 6.5's widened Check (`tasks.md:534-535`) adds the D-15 patterns of the three tasks. Each matches tests that
  exist.
- Gate 6.6 is unchanged and stays the train's command (the `Gates:` rule).

No findings.

## 7. Omission detection
No findings.
- Error handling: unchanged by (b). `findByCommits`' failure arm (`arm: 'commit'`) is not touched.
- Idempotency, rollback and migration: not affected. Each edit is a one-line code change or a text change.
- Test strategy: (b) is red first, then green (T142 before the code). (c) and (d) are greps plus every test that
  reads the texts. (a) is a real run with saved files and `checks.txt` lines.

## 8. Execution risks (top 5 failures)
1. Cause: R17's "before" end is on a stage other than `evidence` (inferred above, not run). Impact: the R17 check
   fails again. Prevention: 6.4 already says to stop and report, and the row says which file shows the stage.
2. Cause: T142 is built on `archiveIdRepo`, which sets `pr-list-state-merged` to the given list and files under
   `archive-x` for every pull request, but not on `findRepo(cap())`. Impact: the full list holds pull requests whose
   files make one of them own through the list, and the commit arm is never reached. Prevention: 6.4a says "a full
   merged list of 100 that holds none of its own (archive heads of other changes)". `cap()` gives exactly that, and
   the first `--test-name-pattern` run proves the red.
3. Cause: 6.4b edits a row and changes more than the quoted words, for example the trailing `|` cell. Impact:
   `stage-models AC-10` still passes, but the row differs from D-22. Prevention: 6.4b's byte-for-byte rule and the
   two "prints 1" greps that hold the whole new phrase.
4. Cause: 6.4c's new sentence gets a straight apostrophe where the file has another quote style. Impact: the "prints
   1" grep fails. Prevention: the file uses ASCII `'` (`SKILL.md:128`), and so does the grep.
5. Cause: R17's `deliver-check.mjs feat --json` probe is run from a checkout of this repository, not from the
   scratch run's folder. Impact: the wrong hooks are recorded. Prevention: 6.4 says "never a checkout of this
   repository" (`tasks.md:476-477`).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low: `design.md:1322`. D-20's "two readers" becomes three with `findByCommits`, as section 4 gives it.

## 11. Explicitly out of scope
- [ ] Making `isArchiveHead`, `archiveHeads` or `offOwnBranch` id-aware. D-20 keeps them as they are
  (`design.md:1352-1355`).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. R17's defect is shown by the code at the lines cited in section 4. The
   commit lookup's skip is `:855`. The two rows and the sentence are quoted with their current text.
2. Is the result measurable? Yes. Each task ends in greps with exact counts and named test runs, and R17 ends in
   saved files with expected fields.
3. Are error behaviors defined? Yes. 6.4a leaves the commit arm's errors alone. 6.4b and 6.4c stop for a revision
   when a grep finds an unnamed asserting test. 6.4 stops when R17's check fails.
4. Are edge cases covered? Yes. T142 covers both archive heads of an `archive-` id. The L tests keep the ordinary-id
   archive head.
5. Are dependencies clear? Yes. 6.4's sentence orders the runs against 6.4a to 6.4c, and 6.5's Check runs the tests
   of all three.
6. Are contracts defined? Yes. The `findByCommits` result shape is unchanged, and the new texts are given byte for
   byte.
7. Can two developers interpret this differently? Only T142's fixture choice can vary (risk 2), and its red run
   fixes the outcome.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, for AC-7, AC-17, AC-18 and AC-19 as traced
   (`tasks.md:63-77`).
10. What will be discovered too late if implementation starts now? At most the stage name of R17's "before" end
    (risk 1). 6.4's stop rule catches it before the gate.

## 13. Final conclusion
- Can we start? Yes. The revision is executable as written. The owner's approval of the revised plan is still its
  own gate.
- What must be fixed? Nothing mandatory. The Low note on D-20's "two readers" is optional.
- Main risk if ignored? None that blocks.

**Dropping (b) alone.** Dropping (b) means dropping 6.4a, its D-20 bullet and T142. The plan stays consistent if
the owner also edits the rows that name them. None of these rows is read by another task's check:
- `tasks.md:10`: "T1 to T142" becomes "T1 to T141".
- `tasks.md:77`: the AC-17 row loses "6.4a (the commit lookup, T142)".
- `tasks.md:481-483`: 6.4's order sentence names only 6.4b and 6.4c, and loses the clause "which 6.4a does not
  touch".
- `tasks.md:535`: the parenthetical names 6.4b and 6.4c only. The `^forced-merge-path 1: L` pattern of 6.5 may stay,
  since those tests pass on the base, or it may go with 6.4a.
- `design.md:1661`: the per-surface line loses "(with `findByCommits`'s skip, task 6.4a)".
- `design.md:1681` and `:1706`: the estimate row of item (b) goes, and the totals fall by 0.5 h (likely 51 h,
  "adds 1 h").

After that edit, no test, check or trace row refers to the dropped unit, and the kept L tests are green as they
are.

The edit leaves two gaps that the owner should accept knowingly:
- (i) The `change-delivery` requirement "A change's own pull request" (`specs/change-delivery/spec.md:60-67`)
  states the rule for any lookup, and `findByCommits` would still skip an `archive-` id's own pull request. The
  smallest correction for that case is a sentence in D-20's "What stays as today" naming the commit lookup as not
  changed, or a follow-up line in the roadmap.
- (ii) AC-17 then holds for `archive-release-pin` only while pull request 107 is among the newest 100 merged pull
  requests. That list is full on this repository, which is how `findByCommits` is reached.

D-20's "two readers" sentence is then exact, and the Low note of section 10 goes away.
