Verdict: approved
Commit: 8dcee767e6571680c851906a17ba978980a1316a

## ADR review — forced-merge-path (round 2 re-review)

### Findings
- [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 (Note on the checks) — ADR 0028 decision 1 named check and devkit-reviews while the checker and spec use the required checks plus devkit-reviews; a dated Note states the specced rule. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 (Number line) — The Number line did not say that 0027 is held by the sibling change; it now names the numbers on origin/main. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 (Number line) — The Number line was out of date after the merges; it now names 0027, 0029 and 0030 on origin/main and keeps 0028. · fixed in c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

ADRs reviewed: ADR 0028 (`docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0016 (`docs/adr/0016-stage-roles-write-their-own-files.md`).

Scope: c30bfb8..8dcee76. I ran no test; the suite is the train's job.

- The `gatesAtHead` fix in `plugins/openspec/hooks/deliver-check.mjs` (0934b63) keeps forced derived in one place (ADR 0017) and writes no gate file (ADR 0016). It applies main's currency rule (`verdictAllowed` with the open flag) at the merged head. A 404 from the compare route means undisposed and any other error blocks the gate, which keeps the fail-closed check of ADR 0003.
- ADR numbering: 0001 to 0030 with no duplicate; the 0028 Number line is correct after the train-12 merge.

ADR review — pass. No new finding.

### Summary
- 3 findings from the previous round, all fixed (0 blocking, 1 important, 2 nit); 0 new.
