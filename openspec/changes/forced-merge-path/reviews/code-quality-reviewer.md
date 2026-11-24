Verdict: approved
Commit: c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

## Quality review — forced-merge-path (round 4, stale-only after the train-8 merge of main)

### Findings
- [nit] openspec/changes/forced-merge-path/tasks.md:34 (task 1.9) — Gate command names deliver-check.test.mjs but not deliver-check-archive.test.mjs, where most phase-1 tests live; still open.
- [nit] plugins/openspec/hooks/deliver-check.mjs:notGreen; docs/openspec-flow.md — SKIPPED/NEUTRAL required checks count as not green and no doc line says so; still open.
- [praise] plugins/openspec/hooks/change-loop.mjs:1351,1388-1390 — Forced retro row stays outside CHECK_BEFORE and bypasses testStageStep, so main's new merge-check and unplaced handling compose with the forced reply.
- [praise] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14-16 — The Number line was re-pointed at main's 0027/0029/0030 after the merge, and the release pins (0.45.0/0.50.0) in tasks.md, flow doc and manifests agree.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit, both still open) + 2 praise
- Justification: stale-only re-review of 470a8ca..HEAD. None of main's new code (locate fallback, unplacedAction, planDirty, readerRelease) reaches the forced retro row or the archive steps. Focused run change-loop-compozy forced|merge-check: 2/2 pass; the 13-file 1931-test run is taken from the supplied log. Local origin/main has since moved to train 9 (0.44.1 / 0.49.1), still below this branch's 0.45.0 / 0.50.0. Previous nits do not block.
