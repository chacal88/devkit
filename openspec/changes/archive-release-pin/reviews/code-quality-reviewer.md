Verdict: approved
Commit: b906df57ecf925bffc6075204d054a14e70a4359

## Quality review — archive-release-pin, amendment (ADR 0030), range e0c946a..HEAD (round 4, stage 1)

### Findings
- [important] openspec/changes/archive-release-pin/proof/real-run-head.txt; evidence.md — Real-run proof was on the old pin file path; shipped-path proof re-run at 54f947e (previous round) · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md — Pin-only CI scenario named the wrong test file (previous round) · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/design.md; tasks.md; requirements.md — Plan records still name change-loop.test.mjs in 33 places (design 22, tasks 6, requirements 5); mostly history, but unamended in the amended plan
- [nit] docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md:6-14 — Accepted ADR edited after acceptance (header line and dated Note added); the Decision text still states the test-file rule, now marked only by the Note
- [nit] openspec/changes/archive-release-pin/evidence.md:23-28 — Gate commands 1.5 and 2.4 select only 10 and 2 tests as written; backed by runs A and B on the files that hold the tests
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1060,1078-1090,1128-1148 — Stale comment on LOOP_PATH still says the file holds the Invariant pin block; tests 3 and 4 and the loopLines helpers now only re-prove the early path return (test 4 passes before and after in red-4.txt)
- [praise] plugins/openspec/hooks/deliver-check.mjs:1359-1370 — The test-file half is removed whole (path, PIN_TEST_LINES, line forms); pinLinesOnly stays pure and fail-closed, and RELEASE_FILE and unnamedFiles are untouched, so both callers keep one rule
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs:1273-1300 — Test 12 turns the invariant 'no release edits the pin test' into an executable check (no version literal outside the v0.20.0 floor, no change name, manifest read kept)

### Summary
- 8 findings (0 blocking, 0 important open, 4 nit open) + 2 praise; both previous important findings are fixed in 211c1eb.
- Justification: re-checked my previous findings and reviewed the amendment lines since e0c946a: deliver-check.mjs (PIN_LINE_FILES is the flow page only, PIN_TEST_LINES and the test-file branch are gone, RELEASE_FILE and unnamedFiles untouched), the three test files, the removed c561553 test fixtures (no reference left), docs/openspec-flow.md (P13 row, file-check paragraph and Classification bullet agree with ADR 0030), ADR 0003/0027/0030, the spec delta (the test-file requirement is replaced by 'No test file passes the archive file check by its content'), the CHANGELOG and the config ADR line. The release-merge.test.mjs assertion is now strict equality with R.PIN_FILE. The pin test holds no release literal or change name and still asserts pinMismatches against plugin.json. Filtered runs: deliver-check-archive.test.mjs archive-release-pin tests 1-9, 11, 12 gave 11 of 11 pass; release-merge.test.mjs archive-release-pin 10 passes (1 of 1); the pin test in change-loop-compozy.test.mjs passes (1 of 1); check.py passes; gen-catalog.py --check exits 0. The tree is clean. The whole suite was not run, by instruction. Suggested verdict: approved.

### Phase notes
- Test 4 passes both before and after the phase-4 code (proof/red-4.txt), so it guards nothing new; tests 3 and 4 mostly re-prove the early `!PIN_LINE_FILES.includes(path)` return.
- ADR 0030 says pinMismatches mitigates the loss of the old per-release doesNotMatch lines; pinMismatches checks only marker-line pins from pinsIn, whereas the old lines caught any stale v<old> string anywhere in the doc. ADR 0030 records the loss and accepts it.
- Test 12's change-name list is hardcoded and its literal filter skips any line that mentions 0.20.0, so a new change name or a second version on a floor line would not be caught. Nit-level.
- Run A, run B and the 4.6 run counts in evidence.md are the author's claim; I re-ran only the filtered tests above. Evidence at 0e76c41 is current: b906df5 only adds evidence.
