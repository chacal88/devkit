Verdict: approved
Commit: 22230be382d0c7f9cbb7f18c6abd865125b602e1

## ADR review: run-status-bar

### Findings

ADRs reviewed: ADR 0017 (docs/adr/0017-a-change-state-is-derived-in-one-place.md), ADR 0021 (docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md), ADR 0026 (docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md); the rest of docs/adr/ was scanned by title and none touches a status line, settings.json or the surfaces edited. ADR 0010 and ADR 0013 were reached only through the citations in ADRs 0017 and 0021, the proposal and docs/coordination-design.md. ADR 0020 and ADR 0014 were checked only through the amendment notes in ADR 0017.

### Findings
None.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)

ADR review: pass. The bar reads the state only through `change-loop.mjs state` (ADR 0017 decision 1), stores and writes nothing, reads the coordinating session from the run file (ADR 0021), makes the offline GitHub stub a single shared export, and adds test files that follow ADR 0026. The extraction of `notApplicableOf` keeps the stage walk's order and results. No open decision is touched, and the change adds no ADR.
