Verdict: approved
Commit: 7b7355566114e74e8a61ed712bb6227c8c5cdc34

## ADR review — selective-tests-by-map-2

### Findings

ADR review: pass. The selective mode is a mode of the one command (ADR 0026 decisions 1 and 5; no-flag run unchanged per proof/same-tests.txt). The own files reuse the staleness rule's diff through ownDiffPaths (ADR 0025 decision 1). The train command and its bisection are unchanged, and the pull-request CI is selective while push to main and train/N heads run the whole suite (ADR 0022 decisions 5 and 7). The map check is pinned by a test that runs on the whole suite. The selective command has its own row in evidence.md. The unnumbered record is cited in the ADR [<slug>] form, with amended-by lines on ADRs 0022, 0025 and 0026 (ADR 0034 decision 3).

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
