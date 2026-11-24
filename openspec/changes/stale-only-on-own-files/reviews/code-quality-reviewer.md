Verdict: rejected
Commit: de79c5649f8ea75b4e5a7bd1ce9d3aa8e4f0d7e1

## Quality review: stale-only-on-own-files (round 1)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:2518 — judgeBoarded builds gitFacts(wt) with no base, so a train PR judges each boarded change by the old strict rule and fails a head whose own devkit-reviews check passed after an unrelated base merge; D-4 does not cover this call and no test or doc says the train stays strict. Fix: pass { base } (judgeBoarded already has it) with a train test, or document the strict train rule in D-4, the flow doc and ADR 0025.
- [nit] plugins/openspec/hooks/deliver-check.mjs:371 — The !inBase(parents[0]) clause of fromBase (a merge whose first parent is already in the base) has no test of its own.
- [nit] plugins/openspec/hooks/deliver-check.mjs:309 — The ownFiles catch for unrelated histories (no merge base) is untested; own-files AC-7 own covers only the no-base, no-origin-ref and head-in-base nulls.
- [praise] plugins/openspec/hooks/deliver-check.mjs:309-374 — Fail-safe by construction: ownFiles returns null when it cannot tell, staleness falls back to the old walk, and an unfetched base makes more paths count as own, never fewer.
- [praise] plugins/openspec/hooks/deliver-check.mjs:356 — One owner for the rule: staleness plus memoized ownFiles/ownWalk on facts serve the evidence, the reviews, the stage checker and --ci, so the local loop and CI cannot drift.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:5622-5915 — Every declared variant has its own test on the shared ownFilesRepo fixture, and the CI test drives both entries as real subprocesses.
- [praise] openspec/changes/stale-only-on-own-files/evidence.md — Acceptance is proven with real output for P-1 to P-7 on a scratch repo with a bare origin, naming the merge sha and own file, not only green tests.

### Summary
- 3 findings (0 blocking, 1 important, 2 nit) + 4 praise.
- I traced the own-files rule (stalenessBase, ownFiles, ownWalk and the fromBase test in staleness) through every caller and found it sound for the cases the plan declares. I ran the 16 own-files tests by name in deliver-check.test.mjs (all pass). The one real defect is F1: the delivery train's boarded-change judgment (deliver-check.mjs:2518) is not given the base and so stays strict, which is neither covered by the design (D-4) nor documented. Not done: the whole suite and the other test groups (by instruction), and an independent re-run of the real-run proof. The range also carries 7 files of openspec/changes/roadmap-panel-study that came from the merge of main (605ed9b); they are outside this change and were not reviewed.
