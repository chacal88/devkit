Verdict: approved
Commit: 1fdee51eb04cd8265f05149d6e827d0289aaacf8

## Spec review: selective-tests-by-map-2 (round 2)

### Findings
- [important] evidence.md AC-5 row; requirements.md AC-5 base-merge-selective; proof/base-merge.txt — Partial coverage: no real base merge was run (task 3.1 was 'Already up to date') and the row said plain `pass`; the loop asking for the selective run after a base merge was not shown. · fixed in 1fdee51e
- [nit] requirements.md AC-7 pr-ci-selective-train-whole; tasks.md Workflow follow-up; evidence.md AC-7 row — The CI half of AC-7 is not proven: no `check` log of this change's own pull request exists; the plan defers it to the Workflow follow-up before enable-auto-merge. The row now says so.
- [nit] requirements.md AC-6 proof-selective; evidence.md AC-6 row — The verifier's row for a gate that selects no test file is not exercised on this change (its gate always selects tests); proof/case-e.txt and the CLAUDE.md rule stand in; next-change dogfood.

### Coverage
| Requirement | Status |
|---|---|
| AC-1 gate-runs-mapped-tests | covered |
| AC-2 slow-only-when-linked | covered |
| AC-3 shared-helper-fast-only | covered |
| AC-4 unmapped-code-runs-all | covered |
| AC-5 base-merge-selective | covered (dogfood part now stated honestly in the row) |
| AC-6 proof-selective | covered (verifier-row dogfood remains, F3) |
| AC-7 pr-ci-selective-train-whole | covered locally; CI log owed (F2) |
| AC-8 whole-suite-unchanged | covered |
| AC-9 map-checked | covered; the git-tracked-files rule is in design D-3 with tests T-31 to T-33 |

In-scope specs: requirements.md (acceptance criteria are the baseline, skip_specs true), openspec/specs/change-delivery/spec.md, openspec/specs/delivery-train/spec.md, ADR 0022 decisions 5 and 7, ADR 0025 decisions 1, 4 and 6, ADR 0026 decisions 1 and 5.

Changes since 7b73555: M5 now reads git's tracked files (trackedSuitePaths, with a disk-walk fallback) and the branch is read through currentBranch; T-31 to T-34 pin them; design D-3, proposal and tasks 2.6 carry them. Every change traces to AC-9 or AC-7: no scope creep. The recorded gate (35 files, 3729 tests, 0 fail) was not re-run.

### Summary
- 3 findings (0 scope creep, 0 gaps): F1 important fixed, F2 and F3 nit open.
