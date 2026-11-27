Verdict: approved
Commit: 1fdee51eb04cd8265f05149d6e827d0289aaacf8

## Architecture review — selective-tests-by-map-2 (round 2, 7b73555..HEAD)

### Findings
- [important] scripts/test-suite.mjs:487 — headBranch() re-implemented deliver-check's exported currentBranch (which also honours DEVKIT_BRANCH) in the function that already imports deliver-check; use the owner and drop the copy. · fixed in 30a7136f
- [nit] scripts/test-map.json — One hand-kept 1394-line map that M5/M6 force every added script or test to edit is a likely merge-conflict hot spot across parallel changes; D-3 accepts it, noted for later.

Analyzed: owners (branch resolution now on deliver-check's currentBranch; suite-folder file listing stays in test-suite.mjs); boundaries (deliver-check loaded lazily only for --own-files runs; git access for M5 confined to trackedSuitePaths with a walk fallback); contract consumers enumerated (mapProblems gained an optional trailing env parameter, so no existing caller changes; currentBranch signature unchanged); deletion tests (trackedSuitePaths passes). Re-review scope: only the previous findings and the lines changed since 7b73555 in scripts/test-suite.mjs; the test and OpenSpec document changes were not reviewed for design.
