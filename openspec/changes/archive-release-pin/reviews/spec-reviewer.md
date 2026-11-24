Verdict: rejected
Commit: ec2730f3c7bf8211fcaade34636b61516bc544ac

## Spec review — archive-release-pin

### Findings
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md, requirement 'The local archive stop and the reviews check apply one pin-line rule', scenario 'A pin-only archive pull request on CI' — Spec ambiguity resolved silently: the scenario names `change-loop.test.mjs` while requirements 2 and 3 and the implementation (PIN_LINE_FILES) name `change-loop-compozy.test.mjs`; a pin-only edit of the old file would not pass. Make the spec use one name.
- [nit] openspec/changes/archive-release-pin/requirements.md (AC-3, AC-4, AC-10); openspec/changes/archive-release-pin/proposal.md (What Changes, AC-3, AC-4) — Stage documents still name change-loop.test.mjs and release numbers 0.34.0/0.38.0, while spec and code use change-loop-compozy.test.mjs and 0.39.0/0.43.0 (ADR 0027 and decisions.md record the rename and renumbering).
- [nit] openspec/roadmap.md:73 and :94 — Both roadmap lines (archive-release-pin, release-pin-is-a-release-file) are still unticked; the requirements say to tick them at archive, so this is expected here.

In-scope specs: openspec/changes/archive-release-pin/specs/reviews-check/spec.md (delta, 4 ADDED requirements), openspec/specs/reviews-check/spec.md (baseline), docs/adr/0003-auto-merge-the-archive-pr.md, docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md, openspec/changes/archive-release-pin/requirements.md (AC-1 to AC-10).

### Coverage
| Requirement | Status |
|-------------|--------|
| The archive file check passes a CI pin move in the flow page unnamed | covered |
| The archive file check passes the pin assertions of the loop's test unnamed | covered |
| A pin file the check cannot compare stays unnamed | covered |
| The local archive stop and the reviews check apply one pin-line rule | covered |

Tests run (filtered, TMPDIR=/var/tmp/devkit-archive-release-pin): the `archive-release-pin` and `RELEASE_FILE` tests of deliver-check-archive.test.mjs and release-merge.test.mjs, 12 passed, 0 failed. The whole suite was not run (proof/full-suite.txt holds its one run).

### Summary
- 3 findings (0 blocking, 1 important, 2 nit). No scope creep and no gap. Beyond the delta spec the code touches only declared items: the test-only `base` option of `archivePrRepo`, the pin definition moved into deliver-check.mjs and re-exported, the docs, ADR 0003 header and Note, the config ADRs line, and the release metadata.
