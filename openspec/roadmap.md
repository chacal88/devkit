# Roadmap

## Round 1: ready PR without the owner in between
- [x] ship-modes

## Round 2: auto-merge, opt-in per repository
- [x] auto-merge (after: ship-modes)

Carry-over from the ship-modes review (closed by auto-merge: `guard.mjs ci` now runs `deliver-check --ci`, which shares `readReviews`): CI's `reviewConsensus` (`guard.mjs`) has no staleness check while `deliver-check`'s `reviewsItem` does; the `devkit-reviews` CI check should share `readReviews` so both agree on "approved".

## Round 3: archive after merge
- [ ] archive-after-merge (after: auto-merge)

## Round 4: conduct roadmap rounds
- [ ] conduct-rounds (after: ship-modes)
