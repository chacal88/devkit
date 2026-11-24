Verdict: rejected
Commit: 80ae28772aebdd569cf6209a0a6de6a669ef18a3

## ADR review — loop-place-and-evidence

### Findings
- [important] openspec/changes/loop-place-and-evidence/tasks.md:66,92 — Gates 1.5 and 2.4 still filter guard.test.mjs, which ADR 0026 (docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md) reduced to the guard's own tests, so they exit 0 while running 1 and 8 tests; point them at the files that hold the tests or at node scripts/test-suite.mjs via a plan revision.

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0016 (`docs/adr/0016-stage-roles-write-their-own-files.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`); ADR 0022 and ADR 0020 checked through the indexes and notes against the checker and the loop.

### Conformance
- ADR 0010 decisions 2 and 3: the step order moves into `deliver-check.mjs` (`nextStep`, around line 1811) and the existing `commit` step is reused. No new step, end, row, role or agent, and `change-loop.mjs` is unchanged.
- ADR 0008 decision 4 and ADR 0016: the `Commit:` lines, verdict writers and `Verdict:` lines are untouched, and the commit role only commits files that roles already wrote (`plugins/core` untouched).
- ADR 0017: the state stays derived in the checker only; `folderDirty` is a derived fact and nothing stores it.
- ADR 0025: commits under `openspec/changes/<id>/` do not stale the evidence or reviews, so after the folder commit the next call returns `review` with the same round.
- ADR 0026 decision 3: no test file imports another test file; the shared helpers moved to `deliver-check-fixtures.mjs`, which holds no test.
- ADR 0002 and ADR 0022: `--ci` never calls `nextStep`, so the required `devkit-reviews` check and the train are untouched.
- `decisions.md` records no record needed, which is consistent. No open decision is touched and no ADR is contradicted or superseded.

### Summary
- 1 finding (0 blocking, 1 important, 0 nit)
