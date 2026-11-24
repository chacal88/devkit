Verdict: approved
Commit: 4299e85743098ed3546412873167b5e4a38aeeee

## Quality review — own-pr-archive-paths (round 1)

### Findings
- [praise] plugins/openspec/hooks/deliver-check.mjs:636-646 — inOwnArchiveFolder compares the folder name by equality after the existing ARCHIVED pattern; no regex is built from the id, so ids like a.b or foo versus foo-two cannot collide, and tests 3 and 5 pin both cases.
- [praise] openspec/changes/own-pr-archive-paths/proof/red-1.txt — The red-before-fix run was saved: tests 2, 3, 5 and 6 fail for the stated reasons, 1 and 4 pass because they pin today's answer; the evidence reproduces this honestly.
- [nit] plugins/openspec/hooks/deliver-check.mjs:636 — The helper comment says 'a dated first folder' without noting that a bare file under openspec/changes/archive/ or an undated folder returns false on purpose (test 5 covers it); a short note would keep the next reader from widening the check.
- [nit] openspec/changes/own-pr-archive-paths/proposal.md (What Changes) — The proposal and spec name deliver-check.test.mjs for the new tests, which now live in deliver-check-archive.test.mjs after the suite-speed split; the merge note in tasks.md and evidence.md say so, the proposal text is not updated. Harmless.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise.
- Reviewed against the merge base cf34ff2; the diff matches the proposal: helper inOwnArchiveFolder and the isOwnPr rule are the only logic changes, the rest is the 0.38.1 release.
- The fix sits in isOwnPr, which every reader goes through (ADR 0017 decision 1); isArchiveHead, the train/<n> rule and the active-folder rule are untouched, so ADR 0003 holds.
- Edge cases are covered (no slash after the prefix, undated folder, file instead of folder, regex metacharacter id, id-prefix pairs, both archive head forms, nested own-archive path) and findChangePr is tested end to end through the fake gh.
- The acceptance proof in evidence.md has real outputs; the filtered run reproduced 7 of 7 green.
