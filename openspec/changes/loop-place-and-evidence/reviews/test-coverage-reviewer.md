Verdict: rejected
Commit: 80ae28772aebdd569cf6209a0a6de6a669ef18a3

## Coverage analysis — loop-place-and-evidence (origin/main...HEAD)

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-1, AC-5 rows); design.md D-5 — [6] The cross-process proof (deliver-check JSON -> change-loop next -> commit-and-pr hand-off with paths [] -> real review round with clean Commit lines; S and V0-V4) is not recorded; evidence says change-loop.mjs was not run and AC-5 rests on the fixture only. Record it in the evidence rewrite that tasks.md schedules.
- [nit] plugins/openspec/hooks/change-loop.test.mjs (loop-evidence 15) — Mock-only: change-loop.mjs:1027 hands off by step name and never reads paths, so the test passes with or without this change; breaking the checker's emission leaves it green (tests 1 and 7 hold that seam).
- [nit] plugins/openspec/hooks/deliver-check-cli.test.mjs (loop-evidence 16, 17) — Implementation-coupled: pins whole prose sentences of SKILL.md and docs/openspec-flow.md with includes(); a rewording that keeps the rule turns them red.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1811-1814 — [3] The dirty-folder commit is tested with a missing reviewer only (tests 4, 9); a stale reviewer and the undisposed-finding source of toReview are untested, though they share the same condition.
- [nit] openspec/changes/loop-place-and-evidence/tasks.md 3.3 part 1; evidence.md Findings — Gate 3.3 part 1 (guard.test.mjs) equals no train part, so deliver-check item 1 will list it as lacking a passing row; fix the gate text. Outside test coverage.
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs (loop-evidence 1-14) — Seams collectState -> nextStep are protected on real git fixtures: rename, staged, untracked and sibling-folder prefix handling, ordering against verify, fix-defect, fix-review and the round-2 stop, and the commit -> review order.

In-scope surfaces: plugins/openspec/hooks (deliver-check collectState and nextStep, change-loop hand-off), plugins/openspec/skills/ship-change, docs/openspec-flow.md
Blocking gaps (8-10 without a plan): 0
Seams checked: collectState folderDirty -> caught by loop-evidence 7, 12, 14; nextStep dirty-folder commit branch -> caught by loop-evidence 1, 2, 6; ordering against verify, fix-defect, fix-review and the round-2 stop -> caught by loop-evidence 3, 4, 5, 11; commit then review on real git -> caught by loop-evidence 7, 9, 10, 11 and the walkthroughs of deliver-check.test.mjs and deliver-check-cli.test.mjs; skill and doc text -> caught by loop-evidence 16, 17 (red-first in proof/red-2.txt); deliver-check JSON -> change-loop -> real round -> gap F1 (real evidence pending) (mutation runs: 0)

### Well covered
- A dirty change folder before a review round answers commit with empty paths and a reason naming at most three paths (loop-evidence 1, 6).
- A clean folder or an absent folderDirty leaves every earlier answer unchanged, including the round-2 re-review (loop-evidence 2, 12).
- Product commit before verify before folder commit before review (loop-evidence 3, 11).
- collectState's path parsing for rename, staged, untracked and the featx sibling folder (loop-evidence 12, 14).
