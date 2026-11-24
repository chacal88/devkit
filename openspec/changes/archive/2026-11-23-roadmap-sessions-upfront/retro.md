<!-- devkit-stage retro result=passed attempt=1 commit=6999a043f0e94b76ea42a3ae77392dc67af6855e -->
## Retro: roadmap-sessions-upfront

1. Went wrong: the change was planned against a main that moved four times before it landed (change-state, release-tags, change-version-pin and remote-worker), and each merge of main cost a re-merge, a renumbered release, a renumbered ADR and, twice, a revised plan: change-version-pin made `flow.json` version 1 immutable, so the triage helper had to ship as flow version 2 (phase 8), and remote-worker's place counter and ticketless remote sessions had to be reconciled with this change's own (phase 9, design D-18). Each re-merge also meant one full suite run (about 43 minutes: `guard.test.mjs` imports about twenty test files into one process) plus evidence and a review round. Review round 2 passed on the pre-merge commit; the review of the final merged commit failed on three important findings (ADR 0021 beside ADR 0020, the machines clause of the place requirement, two place counters). The owner then merged PR 88 with admin rights on 3929274, without the final evidence and the scoped review of phase 9 and without the whole suite of that commit: only the focused tests of phase 9 and GitHub's `check` had passed. The delivery loop cannot represent that: `next` stays at `implement` (task 9.6 unticked) and `deliver-check` finds no pull request once the branch is deleted, so the retro and the archive were driven by hand from `chore/archive-roadmap-sessions-upfront`.
2. Better next time: land the change that holds the longest plan first, or serialise the landing window so a change merges main once; keep one whole-suite run per commit; make the suite fast enough to run on every commit; give the owner's own forced merge a path in the loop instead of leaving the change stuck at an unticked gate.
3. Remember: phase 9 of roadmap-sessions-upfront merged without its final evidence and scoped review (the owner's admin merge of PR 88); a remote machine's change session cannot use the ticketed entry, which is left to the next live run.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The whole suite takes about 43 minutes because `guard.test.mjs` imports every test file into one process | tooling | followup | project |
| 2 | A change session started on another machine cannot use the ticketed entry (no ticket reaches that machine), so its grill is asked in its own session; never run for real | doc-gap | followup | project |
| 3 | An owner's forced merge of a change whose gates were open leaves the loop at `implement` and `deliver-check` without the merged pull request | process-friction | followup | project |

## Proposed updates

### `openspec/roadmap.md` (followup)
Add the suite speed change the owner asked for on 2026-11-23: run the test files directly and in parallel, each with its own temp folder, instead of one aggregator file in one process.
- before: ## Round 28d: the evidence ceiling counts consecutive failures
+ after: ## Round 28e: a fast test suite
+ after: - [ ] suite-speed (after: roadmap-sessions-upfront) — the whole suite takes about 43 minutes (2356 tests, 40k lines under plugins/openspec/hooks, most of it tests) because `plugins/openspec/hooks/guard.test.mjs` imports every test file into one process and Node runs them nearly in series. Run the test files directly and in parallel (`node --test plugins/openspec/hooks/*.test.mjs`), each with its own `TMPDIR` (the "leaves no temporary folder" tests compare the whole folder), then change the test command in CLAUDE.md, CONTRIBUTING.md, docs/openspec-flow.md and the CI snippet; keep one command that runs everything. Asked by the owner on 2026-11-23 after 43-minute runs on a loaded machine.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Add the live check of the part of this change that no machine proved: the ticketed entry on another machine, and the two place counters.
- before: ## Round 28e: a fast test suite
+ after: ## Round 28f: live checks of the sessions per change on two machines
+ after: - [ ] sessions-upfront-live-checks (after: roadmap-sessions-upfront, remote-worker) — the first real `/devkit roadmap` with `machines` set on the desktop app, on the merged devkit-openspec, records in `openspec/changes/sessions-upfront-live-checks/evidence.md`: a real started session's first message against the `devkit-session` entry (the captured form, the `guard.mjs skill` log line), a change opened on another machine (it gets no ticket and asks its grill in its own session), a change waiting for a place (title with the waiting mark), the board row of a machine that mixes claimed and unclaimed changes (it may read above the run's number), the periodic check and the end of the run cleaning its waits, cron and sessions, and the phase 9 rule of design D-18. Phase 9 merged without its final evidence and scoped review, so this run is its proof.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md`, `plugins/openspec/hooks/deliver-check.mjs` (followup)
Give the owner's forced merge a path through the delivery loop: a change whose pull request is merged with open gates goes to the retro and the archive, and says so.
- before: ## Round 28f: live checks of the sessions per change on two machines
+ after: ## Round 28g: the owner's forced merge
+ after: - [ ] forced-merge-path (after: roadmap-sessions-upfront) — when the owner merges a change's pull request with admin rights while the delivery contract is below 8/8 (roadmap-sessions-upfront, PR 88: task 9.6, the evidence and the review of the last phase were open), `deliver-check` and `change-loop.mjs next` keep answering `implement` for the open task and, once GitHub deletes the branch, find no pull request for it. The loop should recognise a merged pull request by its number or by the merge commit on the default branch, say "merged by the owner with N items open", and go to the retro and the archive, recording the open items in `retro.md`; it must not tick a gate that did not run.
- Answer: approved
- Applied: yes
