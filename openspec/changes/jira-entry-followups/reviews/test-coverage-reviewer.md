Verdict: rejected
Commit: 66b8cf79fcc597edd6900787d0a57489a0818632

## Coverage analysis — jira-entry-followups (origin/main...HEAD at 66b8cf7)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:420 — [5] own-files exemption removed for an approved verdict with an undisposed finding (`own: ... && !open`) is stated in skill/doc/changelog but pinned by no behavioural test: deleting `&& !open` leaves every test green. Write in deliver-check-archive.test.mjs beside the own-files tests (mergeMain, DC.readReviews): approved + open [important] + exempt merge -> stale; disposed finding -> current.
- [nit] plugins/openspec/hooks/change-loop-remote.test.mjs (AC-9 two open --task calls at once) — [4] fixed 1500 ms sleep before releasing the lock: if a child spawns late on a loaded machine the test passes even on the pre-D-6 code (vacuous green); release the lock once both children are observably waiting.
- [nit] plugins/openspec/hooks/version-pin.test.mjs (AC-5 refusal tests) — [3] the newer-flow refusal is tested only for script devkit; a lookup hard-coded to the devkit ceiling would accept a devkit-project flow at version 2 with no test red. Add devkit-project and devkit-lite rows.
- [nit] openspec/changes/jira-entry-followups/evidence.md — [4] the mutation runs promised for tasks 2.3 and 4.4, and the AC-9 red-before run, are recorded nowhere (evidence, commits); AC-10's test passes before and after, so its protection rests on a mutation that is unrecorded. By reading, the fixture reaches `stopped` at change-loop.mjs:1507, so the mutation should die; this is a missing record, not a missing test.
- [praise] deliver-check.test.mjs, review-round.test.mjs, change-loop-remote-state.test.mjs — AC-1/AC-2 are protected at the seam (parity with gitFacts on four trees, spawned tree->outcomes->check-file->deliver-check, both paths, reviewer flag ignored), AC-3/AC-4 start from a control and walk edit->commit->review round 2, and every reply --stdin guard has its own test including a spawned heredoc and a no-stdin-read process.
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs (AC-4 approved verdict ... goes stale after a plan commit) — [3] asserts step and reviewers but not the round (1 for an approved verdict under PASS), the consequence the proposal flags for the owner.
- [nit] docs: tests in deliver-check-archive.test.mjs and review-round.test.mjs — [3] implementation-coupled: long verbatim prose pins of the skill rows and flow-doc paragraphs break on a harmless rewording; keep one sentence per assertion.

In-scope surfaces: devkit-openspec hooks (deliver-check, guard, change-loop), devkit-core review-round scripts, skills and docs text, release files.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): planDirty -> nextStep commit row -> caught by AC-3 a plan fix edited after a rejecting round is handed to commit; record-only edits keep fix-review -> caught by the per-file AC-3 loop; round-2 stop beats commit -> caught; readReviews/undisposedIn/verdictAllowed -> caught by AC-4 approved-with-finding goes stale after a plan commit and its record alone keeps it; approved-with-finding after a merge of the base (own: ... && !open) -> gap F1; flow-check readout -> caught by flow-check AC-4; args.dirty -> outcomeOf -> writer line 2 on both paths -> caught by AC-2 dirty list marks line 2 on both paths; treeState vs gitFacts -> caught by the parity test; cross-process round -> check-file -> deliver-check -> caught by the spawned AC-1/AC-2 tests and proof/real-run.md (8 of 8 runs); skill text feeding args.dirty -> pinned by the docs test; readFlowFile ceiling -> caught by the exact-message AC-5/AC-6 tests (devkit only, F3); writeBackAsk by number -> caught by AC-7; reply --stdin and isMain stdin gate -> caught by the in-process and spawned tests; check inside the open lock -> caught by AC-9 (race, F2) and the task-taken-not-name-taken test; blocked end asks nothing -> AC-10 pins it by reading (F4).

Suite result used: the caller's (38 files, 2994 pass on cd2ea37; no non-openspec file differs at HEAD but the merge's config.yaml). No suite or mutation run by this review.

Well covered: see F5.
