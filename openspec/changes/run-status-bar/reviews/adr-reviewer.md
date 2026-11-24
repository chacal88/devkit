Verdict: approved
Commit: 3a53ac94b3676d8063672b1a3b9887f806956424

## ADR review — run-status-bar (round 2)

### Findings

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`, carried from round 1), ADR 0023 (`docs/adr/0023-the-model-is-chosen-by-stage.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`); the rest of `docs/adr/` was scanned by title and none touches the lines changed since round 1.

Re-review scope: my round 1 findings (none) and the lines the change brings since `22230be` (`792fde6`, `0528b85`, `ec1b00b`, `3a53ac9`), plus how merge `f4bad47` of `origin/main` (`a347ac0`) was resolved in the release files and `plugins/openspec/hooks/change-loop-compozy.test.mjs`. Main's own commits are out of scope.

ADR review: pass. 3 ADRs reviewed: ADR 0017, ADR 0023, ADR 0026.

- `plugins/openspec/hooks/status-line.mjs` (`792fde6`): the state call now starts detached and the whole process group is ended at the bound or on a signal. The bar still reads the state only through `change-loop.mjs state` and writes nothing (ADR 0017 decision 1). The no-record reasoning in `openspec/changes/run-status-bar/decisions.md` still holds.
- `openspec/changes/run-status-bar/.openspec.yaml`: `ec1b00b` added a `devkit: models:` table and `3a53ac9` removed it, because `openspec validate --strict` refused the key. The file at HEAD matches its state at open, so ADR 0023 is not touched.
- `plugins/openspec/hooks/status-line.test.mjs` (`792fde6`, `0528b85`): the new tests import only helper modules, not other test files, and make their temporary folders with `tmpFolder` (ADR 0026).
- Merge resolution: devkit-openspec 0.40.0 and marketplace 0.45.0 sit above main's 0.39.2 / 0.44.0. The CI pin in `docs/openspec-flow.md` moves to `v0.40.0`, and the pin test now also rejects `v0.39.2`. No ADR is affected.
- Every commit in the range has a conventional message. The edits to `openspec/changes/run-status-bar/design.md` (D-1 and D-9) describe the fixes and contradict no ADR.

No open decision is touched, and the change adds no ADR. No tests were run in this round: the conducting session reports the whole suite green at `0528b85`, and the commits after it touch only `openspec/`.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
