Verdict: rejected
Commit: 63c5eac8f72e8319b9056b1c9ca52715cfaf775c

## ADR review — state-skips-unlocated

### Findings
- [important] docs/openspec-flow.md:240; openspec/changes/state-skips-unlocated/decisions.md — Drift from ADR 0017 decision 1 (docs/adr/0017-a-change-state-is-derived-in-one-place.md): the state of an unplaced change is derived outside nextAction, so state and board say blocked wrong-branch while change-loop next, wait and session-next still exit 3; the docs sentence 'one function that next, this command and /devkit status share' is no longer true for it and decisions.md records no divergence. Fix: state in the docs that those commands keep exit 3 for such a change and acknowledge it in decisions.md (optionally a dated Note in ADR 0017).
- [nit] openspec/changes/state-skips-unlocated/design.md § D-3 — D-3 does not cite ADR 0017 decision 1 for the archived-first check and the stand-in kept outside nextAction; cite it beside the Non-Goals bullet that keeps next exiting 3.

ADRs reviewed: ADR 0017 (docs/adr/0017-a-change-state-is-derived-in-one-place.md), ADR 0010 (docs/adr/0010-openspec-as-the-harness.md), ADR 0020 (docs/adr/0020-a-change-can-run-on-another-machine.md), ADR 0025 (docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md), ADR 0026 (docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md).

No open-decisions log exists in this repository, so no open decision is touched. The change conforms to ADR 0017 decisions 1, 2 and 4 (one shared helper for the board and the command, the run file weighs first, title form), ADR 0010 decision 3 (blocked with the existing wrong-branch reason, no fifth end), ADR 0020 decision 8 (untouched), ADR 0026 decision 3 (moved helpers live in change-loop-fixtures.mjs, no test file imports another test file) and ADR 0025 decision 1 (release files consistent: devkit-openspec 0.39.2, marketplace 0.43.2, pins at v0.39.2).

### Summary
- 2 findings (0 blocking, 1 important, 1 nit)
