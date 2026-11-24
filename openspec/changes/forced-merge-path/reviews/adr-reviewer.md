Verdict: approved
Commit: d0a2b37eb677790cbbb1422d2ecf4b5143da5d89

## ADR review — forced-merge-path (round 2)

### Findings
- [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 vs specs/change-delivery/spec.md and plugins/openspec/hooks/deliver-check.mjs:819 — ADR 0028 decision 1 named check and devkit-reviews, while the checker and spec use the checks the default branch requires plus devkit-reviews when it reported; the ADR now carries a dated Note stating the specced rule. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Number line — The Number line did not say that 0027 is held by the sibling archive-release-pin; it now names 0025/0026 on origin/main and 0027 on the sibling. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0

ADRs reviewed: ADR 0028 (`docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`, amendment note), and ADR 0002, 0012, 0016, 0017, 0019 as cited by 0028.

Both round-1 findings are fixed at 8058ecf. The Note in ADR 0028 matches the spec scenarios for the checks the default branch requires and for devkit-reviews when it reported; the Number line matches origin/main (ends at 0026) and origin/archive-release-pin (holds 0027). The ADR 0003 annotation stays consistent. The proposal and design additions (stacked pull request limit, follow-up change) and the spec delta stay inside the approved scope and write no gate file (ADR 0016); derivation stays in one place (ADR 0017). The project keeps no open-decisions log. The ADR number is to be confirmed again at the last merge of main, as ADR 0028 and openspec/config.yaml already say.

### Summary
- 2 findings, both fixed (0 blocking, 1 important, 1 nit); 0 open.
