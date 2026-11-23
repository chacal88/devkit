Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## ADR review — delivery-models

### Findings
- [important] docs/adr/0018-the-delivery-model-is-chosen-per-project.md — ADR number 0017 was taken on origin/main; renumber to the next free number on merging main and update all references. · fixed in 99ef2bd
- [nit] openspec/changes/delivery-models/proof/ac-map.md:5 — Renumbering note said ADR 0016 was an open pull request; update it when renumbering. · fixed in 99ef2bd

ADRs reviewed: ADR 0018 (`docs/adr/0018-the-delivery-model-is-chosen-per-project.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0002, 0003, 0012 (amendment notes, unchanged since 64ed99f).

Stale-only re-review of 64ed99f..HEAD, limited to this change's part of the merge c093f6e. Both previous findings stay fixed in 99ef2bd. No new finding: the shared parseDevkitBlock (budget at top level, never under delivery), the single GATE_OF_WHY with the three merge waits (owner still merges both pull requests, no auto-merge in two-prs), deliver-check's shared verdictFiles with main's verdictAllowed staleness rule, and the 0.32.0 / 0.28.0 / 0.13.0 release all conform to ADR 0018 and ADR 0017. ADR 0018 is still the next free number after main's 0017 and the ADR files are unchanged since 64ed99f. The change's design, spec and task files were not opened, and no test was run.

### Summary
- 2 findings (0 blocking, 0 open important, 0 open nit); both fixed in 99ef2bd
