Verdict: rejected
Commit: 26e00b19de03124db593d628a40c3383400db2c6

## ADR review — delivery-models

### Findings
- [important] docs/adr/0017-the-delivery-model-is-chosen-per-project.md — ADR number 0017 is already taken on origin/main by 0017-a-change-state-is-derived-in-one-place.md (and 0016 exists too); renumber to the next free number on merging main and update all references.
- [nit] openspec/changes/delivery-models/proof/ac-map.md:5 — Renumbering note says ADR 0016 is an open pull request; it is already on origin/main. Update it when renumbering.

ADRs reviewed: ADR 0002, 0003, 0010, 0012, 0015 (amendment chain) and ADR 0017 (this change), plus ADR 0016 and the other ADR 0017 on origin/main by file name only.

No locked ADR is violated. The amendment notes in ADR 0002, 0003, 0010 and 0012 are present and agree with ADR 0017. The two-PR agent text, the guard's test-branch lock and the CI template conform to ADR 0010 decision 5 and ADR 0017 decisions 2 and 3. Not opened: the `deliver-check.mjs`, `change-loop.mjs`, `conduct-check.mjs` and `flow-check.mjs` diffs and the change's design, spec and task files.

### Summary
- 2 findings (0 blocking, 1 important, 1 nit)
