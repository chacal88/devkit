Verdict: approved
Commit: 96ea09921ecd863be523e40ec403b87596c25406

## Spec review: loop-place-and-evidence (round 2)

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-5 row); spec delta scenario "The round after the step records clean commits" — Round 1: AC-5 rested on the fixture only and the Real-run proof table (S, V0 to V4) was missing. evidence.md now has the S and V0 to V4 table and the real round's clean Commit lines. · fixed in 96ea09921ecd863be523e40ec403b87596c25406
- [nit] plugins/openspec/hooks/deliver-check.mjs:1813; spec delta requirement "The change folder is committed before a review round" — Round 1, still open: the requirement says the commit reason SHALL name the folder's paths, but the code lists at most three (design D-2, loop-evidence 6). The spec does not state the cap. Extend the requirement or list every path.
- [nit] openspec/changes/loop-place-and-evidence/evidence.md, Real-run proof section (V1 to V4) — The V records hold the answer of each call but not the clone's sha or the restore commands that design D-5 prescribes. evidence.md says so and says it did not re-check. The answers match D-5's expectations, so this is a record-detail gap only.

## Spec review: loop-place-and-evidence (round 2)

In-scope specs: the change delta (specs/change-delivery/spec.md), openspec/specs/change-delivery/spec.md, openspec/specs/verdict-files/spec.md, openspec/specs/commit-attribution/spec.md, openspec/specs/reviews-check/spec.md and requirements.md (AC-1 to AC-7).

The range 80ae287..HEAD touches only change-folder records (evidence.md, tasks.md gates 1.5 and 2.4, review.md, reviews/*). No product code, spec or doc changed, so scope creep is not possible in this range.

### Coverage
Every requirement and scenario of the delta is covered, including "The round after the step records clean commits" (fixture test 13, plus the real round).

### What I checked
- AC-5 coverage: the scenario was partial in round 1. evidence.md now has the real-run proof table (S and V0 to V4) and a table of line 2 of the four real reviews/*.md files (Commit: 80ae287..., none marked (uncommitted changes)). The records in /var/tmp/devkit-loop-place-and-evidence/V-records.txt match the evidence rows: v0 review; v1 to v3 commit with paths [] then review; v4 commit with paths [CHANGELOG.md].
- Gates and tests: tasks.md gates 1.5 and 2.4 now name the files that hold the tests. ^loop-evidence across deliver-check-archive.test.mjs, deliver-check-cli.test.mjs and change-loop.test.mjs, in the foreground: 17 of 17 pass. A read-only deliver-check.mjs loop-place-and-evidence --json now answers review for adr-reviewer, spec-reviewer and test-coverage-reviewer, round 2. git status --porcelain is empty.

### Summary
- 0 blocking, 0 important open. The round 1 important finding is fixed in 96ea099. Two nits remain: the round 1 spec-wording nit (F2, still open) and one new nit about the V1 to V4 records (F3).
