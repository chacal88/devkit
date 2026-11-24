Verdict: approved
Commit: 96ea09921ecd863be523e40ec403b87596c25406

## Coverage analysis, loop-place-and-evidence (80ae287..HEAD, round 2)

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-1, AC-5 rows); design.md D-5 — Round 1: the cross-process proof (deliver-check JSON -> change-loop next -> commit-and-pr hand-off with paths [] -> real review round with clean Commit lines; S and V0-V4) was not recorded. Now recorded as the Real-run proof table (S, V0-V4) and 'AC-5 from the real round'; S and V checked against the raw records in /var/tmp/devkit-loop-place-and-evidence. · fixed in 96ea09921ecd863be523e40ec403b87596c25406
- [nit] plugins/openspec/hooks/change-loop.test.mjs (loop-evidence 15) — Round 1: mock-only. change-loop.mjs hands off by step name and never reads paths, so the test passes with or without this change; tests 1 and 7 hold the checker seam. Not changed; stays a nit.
- [nit] plugins/openspec/hooks/deliver-check-cli.test.mjs (loop-evidence 16, 17) — Round 1: implementation-coupled. Whole prose sentences of SKILL.md and docs/openspec-flow.md are pinned with includes(), so a rewording that keeps the rule turns them red. Not changed; stays a nit.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1812-1813 — Round 1: the dirty-folder commit is tested with a missing reviewer only (tests 4, 9). A stale reviewer and the undisposed-finding source of toReview are untested, though they share the same condition. Not changed; stays a nit.
- [nit] openspec/changes/loop-place-and-evidence/tasks.md 3.3 — Round 1: gate 3.3 part 1 ran guard.test.mjs, which equals no train part. Gate 3.3 now reads node scripts/test-suite.mjs && python3 scripts/check.py && ..., so its first two parts are the train's and evidence records them as train rows. · fixed in 80ae28772aebdd569cf6209a0a6de6a669ef18a3
- [nit] openspec/changes/loop-place-and-evidence/evidence.md (Real-run proof, cases V1-V4) — New, low weight: the records give each call's answer but not the clone's sha or the exact restore commands that design D-5 prescribes. The evidence says so itself. The observed answers are consistent, so this does not change the verdict.
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs (loop-evidence 1-14) — The seams collectState -> nextStep are protected on real git fixtures: rename, staged, untracked and sibling-folder prefix handling, ordering against verify, fix-defect, fix-review and the round-2 stop, and the commit -> review order. The rewritten evidence.md now adds the real change-loop run.

In-scope surfaces: plugins/openspec/hooks (deliver-check collectState and nextStep, change-loop hand-off), plugins/openspec/skills/ship-change, docs/openspec-flow.md, and the change's evidence.md and tasks.md
Blocking gaps (8-10 without a plan): 0
Seams checked: collectState folderDirty and the dirty-folder commit branch -> caught by loop-evidence 1-7, 9-12, 14 (unchanged since round 1; the range 80ae287..96ea099 changes no code or test file); skill and doc text -> caught by loop-evidence 16, 17; deliver-check JSON -> change-loop next -> commit-and-pr hand-off (paths []) -> next is review -> real round with clean Commit lines -> now backed by real evidence (part S and V0-V4 in evidence.md, checked against the raw records in /var/tmp/devkit-loop-place-and-evidence) (mutation runs: 0). Filtered run in the foreground: loop-evidence 1-17 over deliver-check-archive, deliver-check-cli and change-loop tests, 17 pass, 0 fail.

### Well covered
- A dirty change folder before the review round answers commit with empty paths, and the reason names at most three paths (loop-evidence 1, 6).
- A clean folder, an absent folderDirty, or paths outside the change folder leave every earlier answer unchanged (loop-evidence 2, 5, 12).
- Product commit, then verify, then folder commit, then review (loop-evidence 3, 11).
- collectState path parsing for rename, staged, untracked and the featx sibling folder, on real git fixtures (loop-evidence 12, 14).
- The cross-process flow now has real evidence (S, V0-V4, AC-5 from the real round) in evidence.md, and the raw records match the table.
