Verdict: approved
Commit: 3b427c89ef2a7c0016422616b23bdf385727e273

## ADR review — loop-place-and-evidence (re-review after merging main)

### Findings
- [important] openspec/changes/loop-place-and-evidence/tasks.md:66,92 — Previous round-2 finding: gates 1.5 and 2.4 filtered guard.test.mjs, which ADR 0026 cut down to the guard's own tests. The gates now name the files that hold the tests. · fixed in 96ea09921ecd863be523e40ec403b87596c25406

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`) and ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`). Earlier rounds also covered ADR 0002, 0008, 0010, 0016, 0022 and 0027. Nothing in the diff against main touches the others.

### Conformance
- ADR 0017: the change reads the uncommitted folder paths once, in `collectState` (`plugins/openspec/hooks/deliver-check.mjs:2117`, `folderDirty`). `nextStep` (line 1872) only reads that state. The local loop and CI share one derivation. A state built without the field still works, because the read uses `?.`.
- ADR 0025: the release files are never own files, and the change adds no own-files rule of its own. `docs/openspec-flow.md` is an own file, so main's merge staling the four reviewers is correct. Evidence is `Commit: 53f0fe4`; HEAD `3b427c8` touches only the change folder, so the evidence stays current. The reviews are stale because main's merge touched own files, and that is what this round replaces.
- ADR 0030: the release edits no test file. `plugin.json` is 0.41.0, `marketplace.json` is 0.46.0 and the `docs/openspec-flow.md` CI pins are `v0.41.0`. The pin test reads the manifest and is unmodified. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` both pass.
- ADR 0026: gates 1.5, 2.4 and 3.3 name the files that hold the tests, or the suite script.
- Interaction with main: the new `commit` step sits after the `verify` check and before `review`. It does not collide with main's train steps (`wait-train` and `rejoin-train`), which come after the review and PR rows. `change-loop` test 15 shows that a `commit` row with `paths: []` goes to the commit agent.
- No ADR is contradicted and no open decision is touched.
- Tests run, filtered and in the foreground with `TMPDIR=/var/tmp/devkit-loop-place-and-evidence`: `loop-evidence`, `change-loop docs`, `change-loop decide: B2`, `release-merge-conflict 15` and `flow-check AC-6`: 24 tests, all passing. The whole suite was not run. The worktree is clean.

### Summary
- 1 finding (0 blocking, 1 important and already fixed, 0 nit); nothing is open.
