Verdict: approved
Commit: 896c29dfc34f7b02d88462ec71029eaf984a11e2

## ADR review — release-tags (round 2)

### Findings
- [important] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md § Decision 3 and Consequences — Decision 3 promised the archive merge's tag before archived, but the design (R-3) and flow page say a run from a checkout other than chore/archive-<id> ends archived without asking it; the ADR did not record this limit. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [nit] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md:3-4 — Header had two Status lines; ADR 0017 and 0018 use a separate Accepted by line. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c

ADRs reviewed: ADR 0019, and, from round 1, ADR 0002, 0003, 0004, 0010, 0017, 0018.

### Re-review scope
Only the two round-1 findings and the lines changed in 0bf76b4..HEAD were checked. Decision 3 and the Consequences now state the limit, consistent with design R-3 and the release-tag paragraph of docs/openspec-flow.md. The other changes since round 1 are a test-helper export in plugins/openspec/hooks/delivery-models.test.mjs, a version fix in tasks.md and review and evidence files; none touches an ADR. The test suite was not run.

### Summary
- 2 findings (0 blocking, 1 important, 1 nit), both fixed in 6e33ca7; no new findings.
