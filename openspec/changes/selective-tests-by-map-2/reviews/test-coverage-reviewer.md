Verdict: rejected
Commit: 7b7355566114e74e8a61ed712bb6227c8c5cdc34

## Coverage analysis: selective-tests-by-map-2 (origin/main...HEAD)

### Findings
- [important] scripts/test-suite.mjs:480 — [5] stalenessBase(root, process.env) in selectOwn is untested: no test sets GITHUB_BASE_REF, so ignoring it or hard-coding main stays green, and a PR on a non-main base would select the wrong tests. Write in test-suite.test.mjs (T-20 style, second origin branch plus env GITHUB_BASE_REF).
- [nit] scripts/test-suite.mjs:475 — A missing or broken deliver-check.mjs under --own-files throws an unhandled stack instead of falling back to the whole suite; untested (T-25 covers only the no-flag run). Write in test-suite.test.mjs beside T-22.
- [nit] plugins/openspec/hooks/test-suite.test.mjs:1240 — Implementation-coupled prose pins: T-30 and the ci.yml AC-7 test assert whole config lines and literal YAML expressions; a harmless rewording turns them red. Loosen them to the command tokens.
- [praise] plugins/openspec/hooks/test-suite.test.mjs:781 — Selection rules S1-S7, sharedUses, map checks M1-M7 and branchOwnPaths each have exact-result and negative tests; the real map matches every test import (checked by script, 0 unlinked importers).

In-scope surfaces: scripts/test-suite.mjs, plugins/openspec/hooks/deliver-check.mjs, .github/workflows/ci.yml and the config and docs text naming the selective command. The suite was not run; evidence.md rows were read.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): the --own-files flag, own paths from git, the train-branch guard, map refusal, flag usage, ci.yml text, the real map against real imports; gap: stalenessBase inside selectOwn (F1).

### Well covered
- Selection rules S1-S7 (T-1 to T-9), sharedUses (T-5), map validation M1-M7 (T-10 to T-15, T-16), branchOwnPaths and ownDiffPaths (T-27), cannot-tell paths end to end (T-22, T-21).
