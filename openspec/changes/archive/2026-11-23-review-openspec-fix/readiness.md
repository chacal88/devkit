<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: review-openspec-fix

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate review-openspec-fix --strict` reports the change valid.

## 2. Scope validation
Classification: correct. One defect (a rejected verdict never goes stale after an `openspec/`-only fix), one rule, one helper pair in `deliver-check.mjs`, with in and out of scope named in `proposal.md` (Non-goals) and `design.md` (Goals / Non-Goals).

## 3. Proposal review
Problem, cause (`managed-agents-study`, fix `fe49b25`) and four ACs are explicit. Impact covers docs, release and the CI pin. No findings.

## 4. Design review
Claims re-derived against live code at `c561553`:
- `staleness()` at `deliver-check.mjs:201` takes `{ allowed = isOpenspec }`: confirmed.
- `readReviews` at line 246 passes the test-spared predicate only for the four names (line 255): confirmed.
- `reviewsItem` line 264 repeats the inline approved test: confirmed.
- `const approved` at line 989; `rejectedNow` and `reRejected` in `nextStep` (lines 1129 to 1163): confirmed.
- Readers of `readReviews` (generalization A-1): `git grep` lists `reviewsItem` (262), `collectState` (1306) and `flow-check.mjs:237`, no others: confirmed.
- `TEST_SPARED_REVIEWERS` (158), `isOpenspec` (147), `isTestFile` (152), `touchedPaths` (188): present.
- `docs/openspec-flow.md` has `v0.21.1` on lines 578, 579 and 588 (three); `plugin.json` and `marketplace.json` versions (0.21.1, 0.9.0, 0.25.1) match; `review-change/SKILL.md:178` has the sentence D-6 quotes.
- ADRs: the change keeps ADR 0002, 0008 and 0012, as D-6 reasons.
No failed re-derivation.

## 5. Specs review
`verdict-files` modifies the existing test-files requirement (adds "approved or declined", which resolves the conflict with a rejected spared reviewer) and adds the requirement for rejected verdicts with 13 scenarios. `change-delivery` modifies the merge requirement and adds the rejected-merge scenario. Every D-3 outcome (tests 1 to 20) maps to a scenario. Normative language and WHEN/THEN are present. No findings.

## 6. Tasks review
Ordered test-first (1.1 red run, 1.2 code, 1.3 docs, 1.4 gate, 2.1 release, 2.2 whole suite); each task has a check; every AC maps to tasks in the table. Task paths fall under existing directories. Base gates: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` are green on the base. The 1.4 command (`node --test` with the CI branch variables set) ran on the base: 620 tests, 620 pass, 0 fail (about 13 minutes). `claude plugin validate .` passed on the base. The 2.2 guard suite is the long command the tasks mark for the caller.

## 7. Omission detection
Validation, error handling, idempotency (record committed twice, test 15), rollout and rollback (Migration Plan), compatibility (CI pin lag, risk table), uncommitted files (test 12) and merge commits (test 13) are all covered. Auth, retries and data migration do not apply. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: a file committed with the rejecting round's record. Impact: one extra round with no fix. Prevention: D-4, docs say to commit the record alone, test 5.
2. Cause: a manual "Update branch" with only `openspec/` files while a review is rejected. Impact: one extra round. Prevention: D-4, test 13, `update-branch` row.
3. Cause: wrong bounds of the record (`reviews.md`, `reviewsx/`, other change, `proof/evidence.md`). Impact: wrong staleness. Prevention: test 6, five cases.
4. Cause: `readyRepo()` fixture facts interfere with the expected step (A-5). Impact: test 14 to 17 rework. Prevention: fixture check named in D-3.
5. Cause: a new test green locally and red on CI. Impact: failed PR check. Prevention: gates run with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] None.

## 11. Explicitly out of scope
- [ ] Approved and declined staleness, round numbering, the round-2 stop, the slice contract, `flow-check.mjs` code.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, 20 named tests and four ACs.
3. Are error behaviors defined? Yes (reasons, `stop-review-deadlock`, no-verdict file).
4. Are edge cases covered? Yes (record bounds, merge, uncommitted, mixed commit).
5. Are dependencies clear? Yes (archived sibling changes named).
6. Are contracts defined? Yes (`reviewRecord`, `verdictAllowed` signatures and rule).
7. Can two developers interpret this differently? Unlikely; code, tests and doc sentences are given.
8. Are any decisions implicit instead of written? No; D-4 records the two consequences for the owner.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Possibly a `readyRepo()` fixture detail in tests 14 to 17.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Loop-fixture surprises in tests 14 to 17, settled in task 1.1 by the red run.
