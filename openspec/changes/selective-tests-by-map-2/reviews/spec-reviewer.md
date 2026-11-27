Verdict: rejected
Commit: 7b7355566114e74e8a61ed712bb6227c8c5cdc34

## Spec review — selective-tests-by-map-2

### Findings
- [important] requirements.md AC-5 `base-merge-selective`; evidence.md AC-5 row; proof/base-merge.txt — Partial coverage: task 3.1's merge of origin/main was 'Already up to date', so no real base merge was run. AC-5 is proven only by the texts the loop reads (config.yaml `Test command:` and `Gates:`, CLAUDE.md) and by a selective run on the head. The loop actually asking for the selective run after a base merge is not shown. The plan flagged this as next-change dogfood, but evidence.md records the row as `pass`.
- [nit] requirements.md AC-7 `pr-ci-selective-train-whole`; tasks.md 'Workflow follow-up'; evidence.md AC-7 row — The CI half of AC-7 is not proven yet. ci.yml and a local reproduction (case-h, case-f) are read, but no `check` log of this change's own pull request exists. The plan defers it to the Workflow follow-up, which reads that run before enable-auto-merge.
- [nit] requirements.md AC-6 `proof-selective`; evidence.md AC-6 row — The verifier's row for a gate that selects no test file is not exercised, because this change's own gate always selects tests. proof/case-e.txt shows the no-selection run and its message, and CLAUDE.md line 52 carries the rule. This was flagged as dogfood for the next change.

In-scope specs: requirements.md (the acceptance criteria are the baseline; skip_specs is true), the change's own record, openspec/specs/change-delivery/spec.md, openspec/specs/delivery-train/spec.md, ADR 0022 decisions 5 and 7, ADR 0025 decisions 1, 4 and 6, ADR 0026 decisions 1 and 5.

### Coverage
| Requirement | Status |
|---|---|
| AC-1 gate-runs-mapped-tests | covered |
| AC-2 slow-only-when-linked | covered |
| AC-3 shared-helper-fast-only | covered |
| AC-4 unmapped-code-runs-all | covered |
| AC-5 base-merge-selective | partial (F1) |
| AC-6 proof-selective | covered (verifier-row dogfood noted in F3) |
| AC-7 pr-ci-selective-train-whole | covered locally; CI log owed (F2) |
| AC-8 whole-suite-unchanged | covered |
| AC-9 map-checked | covered |

Scope: no scope creep found.

### Summary
- 3 findings (0 scope creep, 0 gaps): 1 important, 2 nit.
