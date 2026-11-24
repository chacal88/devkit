Verdict: rejected
Commit: 8dcee767e6571680c851906a17ba978980a1316a

## Coverage analysis, forced-merge-path (re-review, c30bfb8..8dcee76)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:951-958 (inHead in gatesAtHead); deliver-check-archive.test.mjs G12 — No test puts a 'fixed in <sha>' whose compare answers behind, diverged or 404 on a verdict. If inHead always returned true, G11 and G12 would stay green and a finding fixed in a sha outside the merged head would pass as disposed. Write in deliver-check-archive.test.mjs, next to G12, with openGateRepo and compareFx('behind'|'diverged') or a 404 fixture; expect the stale-behind-head gate.
- [important] plugins/openspec/hooks/deliver-check.mjs:956-958 (historyError) — The rule 'a non-404 compare error blocks the gate' (return { error }) is asserted by no test. G9 covers contents-read errors but not the compare route in inHead. Dropping the historyError line, or treating the error as a 404, stays green. Write in deliver-check-archive.test.mjs beside G9: a 'fixed in' verdict whose compare answers a 500 or timeout, expecting { error }.
- [nit] deliver-check-archive.test.mjs G12 — G12 pins the fixed case with a 12-character sha and 'ahead'. It does not pin the 'identical' status or the head.startsWith(sha) short-circuit (a fix at the merged head). Low risk.
- [nit] deliver-check-archive.test.mjs G11/G12 — Implementation-coupled: they assert the exact gate text and the compare route key. The contract is only 'stale or current'. Refactor friction only.
- [important] deliver-check-archive.test.mjs:2418-2464 (L5-L7) — Previous finding: the commit arm's success path composed with deliveryOf, collectState and nextStep. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] deliver-check-archive.test.mjs ('a further open pull request') — Previous nit: the 'further pull request is open' scenario is pinned. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] deliver-check-archive.test.mjs (N2, N4, assertOpenItems1And6) — Previous nit: items, summary and exit code of a forced merge are asserted on the change's own branch. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] openspec/changes/forced-merge-path/evidence.md gate 1.9 — Previous nit, still open: gate 1.9 attempt 1 ended exit 1 with no failure line under load. Evidence attempt 7 shows 683/683 as one command, so the practical risk fell. Keep the train's raw log.
- [nit] deliver-check-archive.test.mjs (F1, L1, G9, commitRoutes) — Previous nit, still open: tests coupled to exact gh argument lists and producer error strings.
- [nit] deliver-check-archive.test.mjs D2; change-loop-compozy.test.mjs D1 — Previous nit, still open: skill-prose regexes pin wording, not agent behavior. Only the live replay proves the behavior.
- [nit] openspec/changes/forced-merge-path/proof/gh-shim.test.mjs, proof/replay.test.mjs — Previous nit, still open and informational: the proof-harness tests sit outside the folders test-suite.mjs reads.
- [nit] plugins/openspec/hooks/change-loop.test.mjs (near C2, post-merge-validate 2) — Previous nit, still open: no test pins that a forced retro row gets no merge-check step when facts.mergeCheck carries a merge.
- [nit] plugins/openspec/hooks/deliver-check.mjs collectState postMerge branch (planDirty: []) — Previous nit, still open: no test asserts that a forced state carries an empty planDirty.
- [praise] deliver-check-archive.test.mjs G11 — G11 pins the new currency rule at the seam: an undisposed finding makes the verdict stale behind a commit outside the review record, current behind a review-record-only commit, and the forced count includes the gate.

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs gatesAtHead and findingsOfText, deliver-check-archive.test.mjs G11 and G12).

Blocking gaps (8-10 without a plan): 0

Seams checked:
- gatesAtHead open flag (undisposed finding, then verdictAllowed(..., open)): caught by G11, which goes red if open is dropped, because the commit outside the review record would then be allowed.
- Refuted and fixed dispositions make the verdict current: G12. Always-false inHead is caught by G12. Always-true inHead has no test (F1).
- Non-404 compare error blocks the gate: gap (F2).
- findingsOfFile refactor into findingsOfText: guarded by the existing undisposedIn and readReviews tests, which are unchanged and green per the brief.
- Merge of main (train 12): only release files and the CI pin changed. The brief reports the four test files green after the merge. Mutation runs: 0. Tests run: none.

### Well covered
- Undisposed finding makes an approved verdict stale outside the review record, and the forced count includes it: G11.
- Refuted and fixed-in-history dispositions leave the verdict current: G12.
- Earlier forced-signal, items 1 and 6, and commit-arm composition: N, F, G, L groups, unchanged.
