Verdict: approved
Commit: c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

## ADR review — forced-merge-path (round 4, stale-only re-review)

### Findings
- [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 (Note on the checks) — ADR 0028 decision 1 named check and devkit-reviews while the checker and spec use the required checks plus devkit-reviews; a dated Note states the specced rule. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 (Number line) — The Number line did not say that 0027 is held by the sibling change; it now names the numbers on origin/main. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 (Number line) — The Number line was out of date after the merges (0027 and 0030 on main, 0029 free); it now names 0027, 0029 and 0030 on origin/main and keeps 0028. · fixed in c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

ADRs reviewed: ADR 0028 (`docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0016 (`docs/adr/0016-stage-roles-write-their-own-files.md`).

Scope: 470a8ca..c30bfb8, which holds the merge of origin/main (trains 7-8) and the re-recorded evidence. I ran no test; the suite is the train's job.

- ADR numbering: 0028 keeps its number, and the ADR folder holds 0001 to 0030 with no duplicates. The Number line names 0027, 0029 and 0030 on main.
- ADR 0003: the Notes of ADR 0018, 0027/0030, 0028 and 0022 are intact, and the 0028 Note is unchanged.
- Composition: main's changes to `deliver-check.mjs`, `change-loop.mjs` and `guard.mjs` do not touch the forced-merge code; forced is still read once from `forcedMerge` and reaches the retro and the archive through `delivery.forced` (ADR 0017), with no gate file written (ADR 0016).
- `unplacedAction` returns early for an archive branch or a placeable change, so it does not interfere with a forced-merge change.

ADR review — pass. No new finding.

### Summary
- 3 findings from the previous round (0 blocking, 1 important fixed, 2 nit fixed); 0 new.
