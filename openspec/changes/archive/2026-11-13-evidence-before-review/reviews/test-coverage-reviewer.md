Verdict: approved
Commit: b719a4127c59af0d6c5e12f9811d26fbdbe81409

## Coverage analysis — evidence-before-review (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:1010-1016 (verify precedence over review when only item 1 gates are open) — [5] The `gatesOpen` half of the verify condition has no test that isolates it. The AC-1 tests drive `verify` through item 1 `evidence:'missing'` and item 4 `evidence:'stale'`, and no test sets item 1 `missingGates` non-empty with item 1 `evidence:'current'` and the reviewers missing. If the `missingGates.length > 0` clause or the `it(1).status === 'open'` guard were dropped, a current evidence.md with a missing gate row would go to review and no test would go red. Write in: `plugins/openspec/hooks/deliver-check.test.mjs`, beside the AC-1 evidence-first tests, using the `state({ items })` and `open()` helpers. · refuted: deliver-check.test.mjs:1395 sets item 1 open with missingGates ["npm test"] and default evidence current (BASE_DETAILS line 1171), asserting verify; dropping the clause at deliver-check.mjs:1014 would fall through and fail that test. / deliver-check.test.mjs:1395 drives item 1 open({missingGates:["npm test"]}) and asserts step verify; dropping the missingGates clause at deliver-check.mjs:1014 would turn it red, and verify (1016) is checked before review (1017). / deliver-check.test.mjs:1395 drives nextStep with item 1 open({missingGates:["npm test"]}) and BASE_DETAILS[1].evidence=current (line 1171), asserting verify; dropping the missingGates clause at deliver-check.mjs:1014 would make it fail.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs AC-6 'no tracked file ... review before evidence' — Implementation-coupled: the test greps a hard-coded `OLD_ORDER` phrase list across every tracked file. It catches only those exact old strings; a reworded old-order instruction passes. It also fails on legitimate prose that quotes one of the phrases, and the exclusion list (CHANGELOG, fixtures, this test file) is hand-maintained.
- [nit] plugins/openspec/skills/ship-change/SKILL.md:41,42,44 (Loop rows review / fix-* / verify) — The Loop rows for `fix-review`, `fix-defect`, `fix-checks`, `review` and `verify` have no assertion on the new ordering, that is, 'after a fix commit, verify first'. Item 1 of 'ship-change names every next.step' checks only that step names appear. The ordering is covered through the checker walkthroughs (AC-3 a/b/c), not through the skill text. This is acceptable, since the skill takes `next.step` from the checker.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs AC-3 / AC-4 / walkthrough (merge) — Seam coverage of the reorder is strong. The AC-3 tests walk real git commits through verify, review and push. The AC-4 tests include a control case that shows a product commit makes both stale. The updated merge walkthrough asserts the full step sequence.

In-scope surfaces: openspec hooks (deliver-check.mjs, conduct-check, guard), panel (i18n step order and flow rendering), schemas and docs (text instructions).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- nextStep ordering (fix-review, then fix-defect, then verify, then review): caught by the AC-1 and AC-2 tests and the D2 tests ('current rejected review beside a current defect', 'round-2 deadlock stays first', 'no-proof criterion still reviews, then blocks'). The `verify` branch is caught through the item-4 and item-1 `missing` cases. The item-1 `missingGates` clause alone is not isolated (F1).
- Fix commit makes both evidence and reviews stale, so verify comes before review: caught by the AC-3 (a)/(b)/(c) tests and by the conduct-check force-push test, which asserts the new order of verify then review.
- Evidence and reviews do not make each other stale: caught by the AC-4 tests, with a control case.
- `gh pr create` guards unchanged (evidence-first with no reviews is refused, and so are reviews with no evidence): caught by the guard.test.mjs AC-5 test and the two `--ci` AC-5 tests.
- Panel step order (Provas before Revisão): caught by the report.test.tsx step-name assertions in both languages, the `at()` index mapping for fix-review, fix-defect and blocked, and the AC-7 test that renders both surfaces with `next.step` set to verify. The `Depois:` line is asserted in pt-BR and in English.
- Schema, config, skill and doc text: caught by the three AC-6 tests, which check byte-identical schema copies and the pr-verifier-before-review-change order in each file. F2 and F3 are the weak spots.
- Release metadata: caught by AC-8, which checks that pack versions match their marketplace entries.

Well covered:
- The reorder in `nextStep` is protected at the seam with real git commits, not only with the pure state fixture.
- Panel index remapping after the step swap is asserted explicitly for fix-defect, fix-review and blocked.

No cross-process gaps beyond what the walkthroughs simulate. Verdict: approved, since there is no blocking gap.
