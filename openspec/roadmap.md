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

## Round 5: trailer fix, one change at a time
- [ ] commit-and-pr-trailer — commit-and-pr lets the caller's Co-Authored-By trailer win (archive-after-merge retro, item 4)
- [ ] conventions-trailer (after: commit-and-pr-trailer) — docs: docs/conventions.md states the trailer rule once the fix lands

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

## Round 11: review round tooling
- [ ] review-writer-prompt — `review-round.mjs outcomes` returns each outcome's stage-3 writer prompt (`writerPrompt`), as `review-change`'s agents path says (evidence-before-review retro, item 3)

## Round 12: the CompozyOS loop as a kit
- [x] compozy-loop-v2 — devkit-compozy ships the twelve-stage loop, the four role shells, the design gate and the demo as a kit any project installs; this repository adopts it; ADR 0009; release tagged v0.14.0

## Round 13: what the bench caught late
- [ ] ac-clause-coverage — a gate reads each acceptance criterion's clauses against the tests named for its slug, so a clause with no red test fails before the review (compozy-loop-v2 retro, item 4)
- [ ] compozy-loop-v2-dogfood (after: ac-clause-coverage) — the first change driven end to end by loop v2, with its design gate and recorded demo, written back into this retro (compozy-loop-v2 retro, item 7)
- [ ] release-pin-in-release-files — the CI pin of `docs/openspec-flow.md` joins `RELEASE_FILE` in `deliver-check`, since every `devkit-openspec` bump drags the pin and the archive gate then refuses a file no retro proposal names (compozy-loop-v2 retro, the pin decision)
