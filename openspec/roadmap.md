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
- [ ] release-rebase-pin — release-rebase and deliver-check accept a conflict in docs/openspec-flow.md when it is only the CI pin: the three stages are merged with the pin version masked, then the pin is set to the resolved devkit-openspec version; any other conflict in that file still aborts (retros: conduct-sessions item 8, conduct-one-change item 9, devkit-panel item 1)
