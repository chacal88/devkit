Verdict: approved
Commit: 0f405308ee31bfc6658bdea1bfce31c9b8666e55

## Coverage analysis — jira-entry-followups (re-review, 66b8cf7..0f40530)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:420 — [5] own-files exemption removed for an approved verdict with an undisposed finding (`own: ... && !open`) was pinned by no behavioural test. · fixed in 3f6f865c10032ae83d78e8cc78eac51eb78d720f
- [nit] plugins/openspec/hooks/change-loop-remote.test.mjs:631 (AC-9 two open --task calls at once) — [4] fixed 1500 ms sleep before releasing the lock: if a child spawns late on a loaded machine the test could pass on the pre-D-6 code; release the lock once both children are observably waiting.
- [nit] plugins/openspec/hooks/version-pin.test.mjs (AC-5 refusal tests) — [3] the newer-flow refusal is tested only for script devkit (the loop at line 504 covers devkit and devkit-lite, while devkit-project has only the declares/ceiling checks); add a devkit-project row at flow version 2.
- [nit] openspec/changes/jira-entry-followups/evidence.md — [4] the AC-4 mutation is now recorded (row 35), but the mutation runs promised for tasks 2.3 and 4.4 and the AC-9 red-before run are still not recorded.
- [praise] deliver-check.test.mjs, review-round.test.mjs, change-loop-remote-state.test.mjs — AC-1/AC-2 are protected at the seam (parity with gitFacts, spawned tree to outcomes to check-file to deliver-check, both paths); AC-3/AC-4 walk edit, commit, review round 2; every reply --stdin guard has its own test.
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs (AC-4 approved verdict ... goes stale after a plan commit) — [3] asserts step and reviewers but not the round (1 for an approved verdict under PASS), the consequence the proposal flags for the owner.
- [nit] deliver-check-archive.test.mjs and review-round.test.mjs (docs tests) — [3] implementation-coupled: long verbatim prose pins of skill rows and flow-doc paragraphs break on a harmless rewording; keep one sentence per assertion.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:2455-2473 — The new AC-4 own-files loop has two stale cases (undisposed [important], undisposed [blocking]) and two current controls (refuted, nit only). The controls prove the exemption is active in the fixture, so deleting `&& !open` flips the two stale cases to current and turns the test red. The test also asserts the other five reviewers stay current.

In-scope surfaces: devkit-openspec hooks (deliver-check test), change evidence.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): approved verdict with undisposed finding after an exempt merge (`own: approved(verdict) && !open ? ownFiles : null`, deliver-check.mjs:420) -> caught by the four `jira-entry-followups AC-4 own-files` tests; verdictAllowed(open) -> reviewRecord -> already caught in round 1 by the AC-4 plan-commit tests.

Re-review scope: F1 and the lines changed since 66b8cf7. The only non-openspec file changed is `plugins/openspec/hooks/deliver-check.test.mjs` (+21/-1, test-only, no production code touched). The `ownMergeMain` fixture export it imports exists in `deliver-check-fixtures.mjs:247`. The static check was by reading; evidence.md row 35 records that the fix author ran the mutation and I did not repeat it. Suite result used: the caller's (38 files, 2994 pass on cd2ea37; deliver-check.test.mjs whole green, 226 tests, on the new head). I ran only the four new tests, filtered, and all pass.

No new gaps in the changed lines. F2, F3, F4, F6 and F7 are unchanged nits and stay as reported in round 1.
