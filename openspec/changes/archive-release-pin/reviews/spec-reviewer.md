Verdict: approved
Commit: b906df57ecf925bffc6075204d054a14e70a4359

## Spec review — archive-release-pin (round 4, re-review after the amendment of ADR 0030)

### Findings
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md (A pin-only archive pull request on CI) — Round 3: the --ci scenario named change-loop.test.mjs while the other requirements named change-loop-compozy.test.mjs; the delta now names only change-loop-compozy.test.mjs, and only in the new no-test-file requirement. · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/requirements.md (quoted request, A and A2) and proposal.md — Round 3 nit: stage documents named change-loop.test.mjs and older release numbers; now only the verbatim request quote and the withdrawn A/A2 assumptions do, with the rename recorded in requirements and ADR 0027, so it is resolved in substance.
- [nit] openspec/roadmap.md:73 and :94 — Both roadmap lines (archive-release-pin, release-pin-is-a-release-file) are still unticked; requirements say to tick them at archive, so this is expected here.

### In-scope specs
- openspec/changes/archive-release-pin/specs/reviews-check/spec.md (delta, 4 ADDED requirements, amended by ADR 0030)
- openspec/specs/reviews-check/spec.md (baseline)
- docs/adr/0003-auto-merge-the-archive-pr.md, docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md, docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md
- openspec/changes/archive-release-pin/requirements.md (AC-1 to AC-10, answer A3)

### Coverage
| Requirement | Status |
|---|---|
| The archive file check passes a CI pin move in the flow page unnamed | covered (tests 1, 2, 7) |
| A pin file the check cannot compare stays unnamed | covered (tests 5, 7, 8) |
| The local archive stop and the reviews check apply one pin-line rule | covered (tests 8, 9, 10) |
| No test file passes the archive file check by its content | covered (tests 3, 4, 6, 7, 8, 12) |

### Re-review notes
- The amendment is delivered as the plan declares it. deliver-check.mjs: PIN_LINE_FILES is only docs/openspec-flow.md; PIN_TEST_LINES and the test-file branch of pinLinesOnly are gone; RELEASE_FILE is unchanged; deliver-check.mjs still never imports release-merge.mjs. The c561553 test-file fixtures are deleted and the flow page fixtures stay.
- change-loop-compozy.test.mjs: the literal assert.match pin line, the Invariant comment and every assert.doesNotMatch history line are gone; pinMismatches(flow, version) with version read from plugin.json stays, as do the v0.20.0 floor assertions (AC-4).
- docs/openspec-flow.md (P13 row and the file-check paragraph), ADR 0003 (header and Note), ADR 0027 (header and Note), ADR 0030 (accepted by the owner), openspec/config.yaml (ADRs line) and CHANGELOG.md all state the one-file rule. ADR 0027's body keeps its original Decision text with an Amended-by header and a Note, which is the normal way to amend an ADR. Release numbers are unchanged (devkit-openspec 0.40.0, marketplace 0.44.0). No two specs disagree; no ADR or open decision is bypassed; no scope creep.
- Filtered foreground runs with TMPDIR=/var/tmp/devkit-archive-release-pin: pattern archive-release-pin over deliver-check-archive.test.mjs and release-merge.test.mjs, 12 of 12 pass (including --ci from only the three downloaded files, test 12 on the pin test holding no version literal, and test 10 on PIN_LINE_FILES equal to [R.PIN_FILE]); the pin tests of change-loop-compozy.test.mjs, including the design-records-the-answers test, 4 of 4 pass. python3 scripts/check.py passes and python3 scripts/gen-catalog.py --check is clean. The whole suite was not run, as instructed.

### Summary
- 3 findings (0 blocking, 0 important open, 2 nit open). 0 scope creep, 0 gaps.
