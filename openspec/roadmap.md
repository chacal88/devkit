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
