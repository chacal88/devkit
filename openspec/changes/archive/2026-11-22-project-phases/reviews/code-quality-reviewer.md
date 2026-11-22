Verdict: approved
Commit: 720e238153aec29e21583b8b7924a319000ff502

## Quality review — project-phases, staleness re-review of merge 6d386bb (round 1)

### Findings
- [important] plugins/openspec/hooks/guard.mjs:262-266 — sliceProblems threw when a slice PR deleted openspec/roadmap.md; no test covered the deletion. · fixed in 319ac33
- [nit] plugins/openspec/hooks/guard.mjs:190-197 — sliceReviewStale diffs each commit against its first parent, so a merge bringing another ADR change can mark the ADR review stale. Document it or ignore non-first-parent commits. Narrowed by main's touchedPaths for the deliver-check staleness path.
- [nit] openspec/changes/project-phases/proposal.md:46 — The proposal says ADR 0014 is proposed; the ADR ships accepted and is now numbered 0015.
- [nit] plugins/openspec/hooks/change-loop.mjs:1098-1103 — Not an issue: lockSleep is threaded openChange -> openCheckout -> withOpenLock and covered by main's tests, kept by the merge.
- [nit] openspec/changes/project-phases/{proposal,design,tasks}.md — Plan documents still say ADR 0014 for the slice ADR, now 0015; add a one-line renumbering note.
- [praise] plugins/openspec/hooks/deliver-check.mjs:17-18 — One shared parseCommitLine export survives the merge alongside main's first-parent touchedPaths.
- [praise] plugins/openspec/hooks/change-loop.mjs:1068-1103 — openCheckout reuse composes cleanly with main's open lock; lockSleep threaded without a second helper.

### Summary
- 3 open nits, 0 blocking, 0 important, + 2 praise. Merge conflict resolutions in change-loop.mjs, deliver-check.mjs, the devkit SKILL.md Never list, the ADR renumbering 0014 -> 0015 and the versions (devkit-openspec 0.20.0, marketplace 0.24.0, pin v0.20.0) are coherent; check.py and gen-catalog --check pass; the whole-suite result (1326 of 1326) was supplied. A narrow --test-name-pattern run was started but not awaited.
- Justification: staleness re-review limited to what the merge changed; no regression found.
