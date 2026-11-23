Verdict: approved
Commit: 64ed99fa03ddad4e40b2e6680588e424e61ee715

## ADR review — delivery-models

### Findings
- [important] docs/adr/0018-the-delivery-model-is-chosen-per-project.md — ADR number 0017 was taken on origin/main; renumber to the next free number on merging main and update all references. · fixed in 99ef2bd
- [nit] openspec/changes/delivery-models/proof/ac-map.md:5 — Renumbering note said ADR 0016 was an open pull request; update it when renumbering. · fixed in 99ef2bd

ADRs reviewed: ADR 0018 (`docs/adr/0018-the-delivery-model-is-chosen-per-project.md`), ADR 0002, 0003, 0010, 0012 (amendment notes), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`, main's own, untouched).

Re-review: both round-1 findings are fixed. No ADR reference to the delivery-model decision still names 0017 or 0015. The amendment notes in ADR 0002, 0003, 0010 and 0012 cite ADR 0018 and agree with it. The two-PR agent text and the ship-change skill keep the owner as merger of both pull requests, with no auto-merge in `two-prs`, which conforms to ADR 0018. The closed-test-PR handling in `deliver-check.mjs` blocks the step and never counts a closed, unmerged test-branch pull request as merged. The hook diffs were read only through keyword-filtered excerpts; the change's design, spec and task files were not opened.

### Summary
- 2 findings (0 blocking, 0 open important, 0 open nit); both previous findings fixed in 99ef2bd
