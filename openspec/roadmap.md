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

Rounds 14 to 24 are steps 2 to 12 of the build order in `docs/coordination-design.md` (ADR 0010); step 1 is the change `orchestrator-replan`, which recorded it. Rounds 5, 11 and 13 held follow-ups of the coordination model ADR 0010 replaces; `orchestrator-replan` withdrew them (the design document lists them); `review-writer-prompt` returned as round 25. Rounds 25 and 26 are follow-ups from the `orchestrator-replan` retro, and round 27 holds debts the owner recorded on 2026-11-19 (`design-open-points`); none is a step of the build order. Round 17b holds the fixes of the defects 0.16.0 showed in the field on 2026-11-20; it is not a step of the build order either and runs before round 18, which would multiply them.

## Round 14: the script and the checker
- [x] flow-script-checker — the `devkit` schema declares every stage of a change, each stage file opens with the fixed header (status, attempt, commit), a checker without AI says which stage passed and which is next, and the schema names roles instead of Claude tool names (D-4, D-8)

## Round 15: the change coordinator and `/devkit change`
- [x] change-coordinator (after: flow-script-checker) — the change coordinator runs one change as a loop over the checker, with `/devkit change`, the two stop locks, the skills wired into the agents and the two language settings; retires `/conduct` (D-1, D-2, D-3, D-8, D-9). Carried from the flow-script-checker retro for its grill: the questions the design did not answer (requirements.md of that change lists them), a commit that touches only tests should make stale only the reviewers it concerns, the wait on GitHub without the owner's message, and deliver-check still counting a checkbox inside a fenced example.

## Round 16: the new stage roles
- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11) Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`).

## Round 17: the delivery models
- [ ] delivery-models (after: change-coordinator) — the delivery model chosen per project: two pull requests from the same branch with the lock that keeps `develop` out of the task branch, trunk-based, and trunk-based with automatic merge (D-5, D-8)

## Round 17b: field fixes of 0.16.0
- [x] coordinator-field-fixes (after: change-coordinator) — the eight defects devkit 0.16.0 showed when it was installed in three other projects on 2026-11-20: an archived change listed as unfinished, a previous-script change read as current after one headed file, the `devkit-reviews` check failing changes of other scripts and pull requests that touch several changes, a change read as delivered from any merged pull request that names it, `github-setup` silent on what the repository refuses, the OpenSpec CLI taken from PATH instead of the project's, a schema upgrade over changes under way, and the CompozyOS kit's re-run overwriting local edits

## Round 18: the roadmap coordinator and `/devkit roadmap`
- [ ] roadmap-coordinator (after: change-coordinator) — the roadmap coordinator starts every change whose `after:` dependencies are archived, several at once up to the number the owner sets per run, and holds a new start while the machine is loaded so that what is under way finishes first, with `/devkit roadmap` and `/devkit status` (D-1, D-2)

## Round 19: defining a project
- [ ] project-phases (after: roadmap-coordinator) — the four design phases as the `devkit-project` flow, with a fifth stage that writes or appends to `openspec/roadmap.md`, started by `/devkit project` (D-7)

## Round 20: the Jira entry
- [ ] jira-entry (after: change-coordinator) — `/devkit change <key or link>` reads a Jira task as the request and writes back to it (a comment with the pull request link, a status change) only when the developer asks, and the grill asks only what the task does not answer (D-1)

## Round 21: the CompozyOS driver
- [ ] compozy-driver (after: change-coordinator) — CompozyOS runs the same short loop (ask the checker, run the role, check the gate) in place of the twelve-stage loop, `/devkit` starts the run when the project's driver is CompozyOS, and the kit's planning role is renamed from `tech-lead` to `planner` (D-2, D-3, D-10)

## Round 22: the script driver
- [ ] script-driver (after: change-coordinator) — a small program runs the same loop and calls the AI from the command line (documented for `claude -p`), for a project whose driver is a script; built when the owner needs it (D-10)

## Round 23: the panels
- [ ] coordination-panels (after: roadmap-coordinator) — read-only panels for the roadmap coordinator, the change coordinator and help, from the mock the owner approved in `orchestrator-replan` (D-6)

## Round 24: the cleanup
- [ ] coordination-cleanup (after: coordination-panels, compozy-driver) — remove what the new coordination replaced: the old next-step scripts, the child-session code, the old panel and the old CompozyOS loop, and finish the documentation (D-11)

## Round 25: review round tooling
- [ ] review-writer-prompt — `review-round.mjs outcomes` returns each outcome's stage-3 writer prompt, as `review-change`'s agents path says, and the stage 1 prompt says a disposition names one sha (orchestrator-replan retro, items 1 and 2); and the stage 1 prompt asks for the sha `git rev-parse HEAD` printed and for the list of files read, so a partial review is seen before the verify stage (flow-script-checker retro, item 4); and two findings of the flow-script-checker retro carried by change-coordinator: a commit that touches only tests makes stale only the reviewers it concerns, and `deliver-check` stops counting a checkbox inside a fenced example of `tasks.md` (as `flow-check` already does); and two findings of the change-coordinator retro: the writer leaves out the stage-1 text's own Verdict and Commit lines, and a stage-1 answer that lists files of its remit as not read is sent back before the verify stage; and one finding of the coordinator-field-fixes retro: a stage-1 answer whose commit is not the full sha of HEAD is refused by the script before the verify stage

## Round 26: project setup
- [ ] project-setup (after: delivery-models) — one setup step writes the `devkit:` block, installs the schemas and the checker into the project and wires its driver (orchestrator-replan retro, item 3)

## Round 27: debts
- [ ] lean-pr-template — a lean pull-request template with less text, built once the owner has researched models; `deliver-check`'s rule that the PR body names the change, every acceptance criterion and the evidence path changes with it (D-4; design-open-points)

## Round 28: remote worker
- [ ] remote-worker (after: roadmap-coordinator) — a change can run on another machine: the project configures a command that starts a change there and one that asks its state, and the roadmap coordinator chooses where each change runs
