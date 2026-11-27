Verdict: approved
Commit: 1fdee51eb04cd8265f05149d6e827d0289aaacf8

## ADR review — selective-tests-by-map-2

### Findings

ADRs reviewed: ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`), ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`), ADR 0034 (`docs/adr/0034-release-at-merge.md`), and the unnumbered record `a-change-runs-only-the-tests-its-files-map-to`.

Round 2: the previous verdict had no findings, so none to disposition. The lines changed since 7b735556 conform. M5 reading git's tracked files stays inside the selective mode of the one command (ADR 0026 decisions 1 and 5). The branch is read through `deliver.currentBranch`, so the train rule of ADR 0022 decisions 5 and 7 still sends train branches to the whole suite. The `GITHUB_BASE_REF` test pins the staleness rule's base (ADR 0025 decisions 1 and 5). The revised plan was re-approved (approval attempt 2), and the release stays with the delivery (ADR 0034 decisions 1, 2, 7 and 8).

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
