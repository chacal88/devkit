Verdict: approved
Commit: 207e06ee220bdc9c97e44df74549c80f061e4fd9

## Quality review — archive-release-pin, merged with trains 1 to 3 (round 5, stage 1)

### Findings
- [important] openspec/changes/archive-release-pin/proof/real-run-head.txt; evidence.md — Real-run proof was on the old pin file path; shipped-path proof re-run (previous round) · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md — Pin-only CI scenario named the wrong test file (previous round) · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/design.md; tasks.md; requirements.md — Plan records still name change-loop.test.mjs in 33 places (design 22, tasks 6, requirements 5); mostly history, but unamended in the amended plan
- [nit] docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md:6-14 — Accepted ADR edited after acceptance (header line and dated Note added); the Decision text still states the test-file rule, now marked only by the Note
- [nit] openspec/changes/archive-release-pin/evidence.md:23-28 — Gate commands 1.5 and 2.4 select only 10 and 2 tests as written; backed by runs A and B on the files that hold the tests
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1060,1078-1090,1128-1148 — Stale comment on LOOP_PATH still says the file holds the Invariant pin block; tests 3 and 4 only re-prove the early path return (test 4 passes before and after in red-4.txt)
- [praise] plugins/openspec/hooks/deliver-check.mjs:1359-1370 — The test-file half is removed whole; pinLinesOnly stays pure and fail-closed, and RELEASE_FILE and unnamedFiles are untouched, so both callers keep one rule
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs:1273-1300 — Test 12 turns the invariant 'no release edits the pin test' into an executable check (no version literal outside the v0.20.0 floor, no change name, manifest read kept)

### Re-check since b906df5
- Pin code and tests of this change are unchanged by the merges of trains 1 to 3; the only diffs in deliver-check.mjs and deliver-check-archive.test.mjs are main's own-pr-archive-paths change (not under review).
- Release renumbering is consistent: devkit-openspec 0.40.0 (plugin.json and the marketplace entry), marketplace 0.45.0, CHANGELOG top entry 0.45.0 above main's 0.44.0, flow-doc pin lines (733, 734, 747) all v0.40.0, ADR numbers 0027 and 0030 free on main.
- CONTRIBUTING.md step 5 new sentence is accurate: the test name, the file (change-loop-compozy.test.mjs line 325), the manifest read and the ADR 0030 link all exist.
- evidence.md attempt 7 matches observed state; rows not re-run name the earlier head they come from.
- Filtered runs (foreground): deliver-check-archive archive-release-pin 11/11 pass (tests 1-9, 11, 12); release-merge archive-release-pin 1/1 (test 10); pin test in change-loop-compozy 1/1; scripts/check.py passes; gen-catalog.py --check exits 0; tree clean afterwards. Whole suite not run, by instruction.

### Phase notes
- Test 4 passes before and after the phase-4 code (proof/red-4.txt); tests 3 and 4 mostly re-prove the early path return.
- ADR 0030 records that pinMismatches checks only marker-line pins, not any stale v<old> string; the loss is accepted there.
- The new CONTRIBUTING.md sentence is appended to an already very long step 5 paragraph; a separate item would be easier to find (optional).

### Summary
- 8 findings (0 blocking, 0 important open, 4 nit open) + 2 praise; both previous important findings are fixed in 211c1eb.
- Justification: re-checked the previous findings and the lines changed since b906df5; the pin code and tests did not change from this change's side, the merges and the renumbering are consistent, the one new CONTRIBUTING.md sentence is accurate, and the filtered tests, check.py and gen-catalog.py --check pass at 207e06e. Suggested verdict: approved.
