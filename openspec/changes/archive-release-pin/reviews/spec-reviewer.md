Verdict: approved
Commit: 207e06ee220bdc9c97e44df74549c80f061e4fd9

## Spec review — archive-release-pin (round 5, re-review at the head merged with trains 1 to 3)

### Findings
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md (A pin-only archive pull request on CI) — Round 3: the --ci scenario named change-loop.test.mjs while the other requirements named change-loop-compozy.test.mjs; the delta names only change-loop-compozy.test.mjs, and the delta is unchanged since. · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/requirements.md and proposal.md — Round 3 nit: stage documents named change-loop.test.mjs and older release numbers; only the verbatim request quote and the withdrawn A/A2 assumptions do now, so it is resolved in substance.
- [nit] openspec/roadmap.md:73 and :94 — Both roadmap lines (archive-release-pin, release-pin-is-a-release-file) are still unticked; requirements say to tick them at archive, so this is expected here.
- [nit] openspec/changes/archive-release-pin/readiness.md:40, proposal.md:48, design.md:446-450 — The plan documents still say marketplace 0.44.0 and a '## 0.44.0' CHANGELOG heading; the release step renumbered it to 0.45.0 (main's train took 0.44.0). The plan says the release step re-takes the numbers, so this is historical text, not a spec deviation.

### In-scope specs
- openspec/changes/archive-release-pin/specs/reviews-check/spec.md (delta, 4 ADDED requirements, byte-identical to the one reviewed at b906df5)
- openspec/specs/reviews-check/spec.md (baseline; main's trains added scenarios that do not touch the pin rule)
- docs/adr/0003-auto-merge-the-archive-pr.md, docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md, docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md (unchanged since b906df5)
- openspec/changes/archive-release-pin/requirements.md (AC-1 to AC-10, answer A3)

### Coverage
| Requirement | Status |
|---|---|
| The archive file check passes a CI pin move in the flow page unnamed | covered (tests 1, 2, 7) |
| A pin file the check cannot compare stays unnamed | covered (tests 5, 7, 8) |
| The local archive stop and the reviews check apply one pin-line rule | covered (tests 8, 9, 10) |
| No test file passes the archive file check by its content | covered (tests 3, 4, 6, 7, 8, 12) |

### Re-review notes (b906df5..207e06e)
- The pin code and tests of this change are unchanged: deliver-check.mjs still has PIN_LINE_FILES = ['docs/openspec-flow.md'], pinLinesOnly and RELEASE_FILE; the only diff in that file is main's own-pr-archive-paths isOwnPr/inOwnArchiveFolder change, which is not under review. release-merge.mjs, release-merge.test.mjs and change-loop-compozy.test.mjs have no diff since b906df5.
- Release renumber: devkit-openspec 0.40.0 and marketplace 0.45.0 (main: 0.39.2 / 0.44.0). The CHANGELOG entry of this change is headed 0.45.0 above main's 0.44.0 entry and keeps its bullets; the flow page CI pin is v0.40.0 (docs/openspec-flow.md:733, :747).
- The CONTRIBUTING.md sentence (release step 5) states that a release moves the CI pins of docs/openspec-flow.md and no test, names the test 'change-loop docs: the design records the answers' and links ADR 0030. It matches the amended rule and the delta.
- No two specs disagree; no ADR or open decision is bypassed; no scope creep, no gaps.
- Filtered foreground runs with TMPDIR=/var/tmp/devkit-archive-release-pin: pattern archive-release-pin over deliver-check-archive.test.mjs and release-merge.test.mjs, 12 of 12 pass; the pin test 'change-loop docs: the design records the answers' passes 1 of 1. python3 scripts/check.py passes; python3 scripts/gen-catalog.py --check printed nothing. The whole suite was not run. git status --porcelain is empty.

### Summary
- 4 findings (0 blocking, 0 important open, 3 nit open). 0 scope creep, 0 gaps. Verdict line to be written by stage 3: approved.
