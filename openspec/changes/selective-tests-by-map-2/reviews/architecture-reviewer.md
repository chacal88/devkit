Verdict: rejected
Commit: 7b7355566114e74e8a61ed712bb6227c8c5cdc34

## Architecture review — selective-tests-by-map-2 (origin/main...HEAD)

### Findings
- [important] scripts/test-suite.mjs:466 — headBranch() re-implements deliver-check's exported currentBranch (which also honours DEVKIT_BRANCH) in the same function that already imports deliver-check; use the owner and drop the copy.
- [nit] scripts/test-map.json — One hand-kept 1394-line map that M5/M6 force every added script or test to edit is a likely merge-conflict hot spot across parallel changes; D-3 accepts it, noted for later.

Analyzed: owners, boundaries, contract consumers and deletion tests; the structural decisions are recorded in the unnumbered ADR that amends 0022, 0025 and 0026.
