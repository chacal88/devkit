Verdict: rejected
Commit: 80ae28772aebdd569cf6209a0a6de6a669ef18a3

## Spec review: loop-place-and-evidence

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-5 row); spec delta scenario "The round after the step records clean commits" — AC-5 rests on the fixture round (loop-evidence 13) only, and evidence.md has no Real-run proof table (S, V0 to V4) that CLAUDE.md and design D-5 require; tasks.md schedules both after this review round, so the evidence has to be rewritten with the real round's `Commit:` lines (no `(uncommitted changes)`) and the S and V0 to V4 records before the change is ready.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1813 — The requirement says the `commit` reason SHALL name the folder's paths, but the reason lists at most three (design D-2, pinned by loop-evidence 6); the spec does not state the cap, so extend the requirement to say it or list every path.

Spec review for loop-place-and-evidence, range origin/main...HEAD at 80ae287.

In-scope specs: the change delta (specs/change-delivery/spec.md), openspec/specs/change-delivery/spec.md, openspec/specs/verdict-files/spec.md, openspec/specs/commit-attribution/spec.md, openspec/specs/reviews-check/spec.md and requirements.md (AC-1 to AC-7). No ADR is touched. The no-place end and the held action are untouched (AC-7: git diff of change-loop.mjs, roadmap-loop.mjs, conduct-check.mjs and flow-check.mjs is empty).

### Coverage
| Requirement / scenario | Status |
|---|---|
| The change folder is committed before a review round (the requirement) | covered |
| Only the evidence is uncommitted (loop-evidence 7, 8) | covered |
| Only a ticked tasks.md is uncommitted (loop-evidence 9) | covered |
| An untracked or staged file in the change folder (loop-evidence 10, 14) | covered |
| The review after the commit (loop-evidence 7, 11) | covered |
| Product code dirty together with the folder (loop-evidence 3, 11) | covered |
| A dirty folder while the evidence is due (loop-evidence 4) | covered |
| A dirty folder while a fix comes first (loop-evidence 4) | covered |
| A clean change folder (loop-evidence 2, 5) | covered |
| Paths outside the change folder do not count (loop-evidence 12) | covered |
| The change loop hands the step to the commit role (loop-evidence 15) | covered |
| The round after the step records clean commits (loop-evidence 13, fixture only) | partial |
| AC-6 skill rows and flow doc (loop-evidence 16, 17) | covered |
| AC-7 place wait untouched | covered |

No scope creep. The release bump (0.40.0, marketplace 0.44.0), the CHANGELOG entry and the CI pin moves come from task 3.1 of the approved plan. The edits to existing tests are the ones design D-4 names (E1 to E9): they commit the evidence first or add `commit` to the recorded sequences, with no expected reviewers or rounds changed. I ran the loop-evidence tests filtered, in the foreground (17 of 17 pass) and a read-only deliver-check run, which answers `review` for both reviewers at round 1.

### Summary
- 2 findings (0 scope creep, 0 gaps), no blocking.
