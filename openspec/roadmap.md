# Roadmap

## Round 1: ready PR without the owner in between
- [x] ship-modes

## Round 2: auto-merge, opt-in per repository
- [x] auto-merge (after: ship-modes)

Carry-over from the ship-modes review (closed by auto-merge: `guard.mjs ci` now runs `deliver-check --ci`, which shares `readReviews`): CI's `reviewConsensus` (`guard.mjs`) has no staleness check while `deliver-check`'s `reviewsItem` does; the `devkit-reviews` CI check should share `readReviews` so both agree on "approved".

## Round 3: archive after merge
- [x] archive-after-merge (after: auto-merge)

## Round 4: conduct roadmap rounds
- [x] conduct-rounds (after: ship-modes)

## Round 6: phases as child sessions
- [x] conduct-sessions — /conduct starts one child session per implementation phase in the app (wake_when_done, sidebar group per change, no cron); conduct-check names the sessions (JSON version 2); ADR 0006 supersedes ADR 0005

## Round 7: one change on request
- [x] conduct-one-change — /conduct <id> conducts one change the owner names (conduct-check --change <id>, no roadmap read, unfinished work reported first); the round sweep only on an explicit `round <n>`; ADR 0007 amends ADR 0006

## Round 8: release-rebase and the CI pin
- [x] release-rebase-pin — release-rebase and deliver-check accept a conflict in docs/openspec-flow.md when it is only the CI pin: the three stages are merged with the pin version masked, then the pin is set to the resolved devkit-openspec version; any other conflict in that file still aborts (retros: conduct-sessions item 8, conduct-one-change item 9, devkit-panel item 1)

## Round 9: reviews as a workflow, and the panel
- [x] review-workflow — the reviewer round of ship-change and /conduct becomes a script of the Workflow tool: the three reviewers in parallel, adversarial verification of their findings, and the consolidation of review.md; the delivery contract does not change
- [x] panel-conduct-view (after: review-workflow) — devkit-panel shows the change the session is conducting (a single-change /conduct included) with its child sessions, as cards like the old orchestrator's, with buttons that visibly fill the prompt and sessions with identifying icons (owner feedback and retro of release-rebase-pin, followup rows 3 and 8)

## Round 10: evidence before review
- [x] evidence-before-review — deliver-check reports verify (and fix-defect) before a review round; schemas, skills, docs and the panel follow; release tagged v0.13.0 (requests from chacal88/Digital-Representative retros)

## Round 12: the CompozyOS loop as a kit
- [x] compozy-loop-v2 — devkit-compozy ships the twelve-stage loop, the four role shells, the design gate and the demo as a kit any project installs; this repository adopts it; ADR 0009; release tagged v0.14.0

Rounds 14 to 24 are steps 2 to 12 of the build order in `docs/coordination-design.md` (ADR 0010); step 1 is the change `orchestrator-replan`, which recorded it. Rounds 5, 11 and 13 held follow-ups of the coordination model ADR 0010 replaces; `orchestrator-replan` withdrew them (the design document lists them).

## Round 14: the script and the checker
- [ ] flow-script-checker — the `devkit` schema declares every stage of a change, each stage file opens with the fixed header (status, attempt, commit), a checker without AI says which stage passed and which is next, and the schema names roles instead of Claude tool names (D-4, D-8)

## Round 15: the change coordinator and `/devkit change`
- [ ] change-coordinator (after: flow-script-checker) — the change coordinator runs one change as a loop over the checker, with `/devkit change`, the two stop locks, the skills wired into the agents and the two language settings; retires `/conduct` (D-1, D-2, D-3, D-8, D-9)

## Round 16: the new stage roles
- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11)

## Round 17: the delivery models
- [ ] delivery-models (after: change-coordinator) — the delivery model chosen per project: two pull requests from the same branch with the lock that keeps `develop` out of the task branch, trunk-based, and trunk-based with automatic merge (D-5, D-8)

## Round 18: the roadmap coordinator and `/devkit roadmap`
- [ ] roadmap-coordinator (after: change-coordinator) — the roadmap coordinator starts every change whose `after:` dependencies are archived, several at once up to the number the owner sets per run, with `/devkit roadmap` and `/devkit status` (D-1, D-2)

## Round 19: defining a project
- [ ] project-phases (after: roadmap-coordinator) — the four design phases as the `devkit-project` flow, with a fifth stage that writes or appends to `openspec/roadmap.md`, started by `/devkit project` (D-7)

## Round 20: the Jira entry
- [ ] jira-entry (after: change-coordinator) — `/devkit change <key or link>` reads a Jira task as the request, read-only, and the grill asks only what the task does not answer (D-1)

## Round 21: the CompozyOS driver
- [ ] compozy-driver (after: change-coordinator) — CompozyOS runs the same short loop (ask the checker, run the role, check the gate) in place of the twelve-stage loop, and `/devkit` starts the run when the project's driver is CompozyOS (D-3, D-10)

## Round 22: the script driver
- [ ] script-driver (after: change-coordinator) — a small program runs the same loop and calls the AI from the command line (documented for `claude -p`), for a project whose driver is a script; built when the owner needs it (D-10)

## Round 23: the panels
- [ ] coordination-panels (after: roadmap-coordinator) — read-only panels for the roadmap coordinator, the change coordinator and help, from the mock the owner approved in `orchestrator-replan` (D-6)

## Round 24: the cleanup
- [ ] coordination-cleanup (after: coordination-panels, compozy-driver) — remove what the new coordination replaced: the old next-step scripts, the child-session code, the old panel and the old CompozyOS loop, and finish the documentation (D-11)
