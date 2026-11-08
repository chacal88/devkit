# Roadmap

## Round 1: ready PR without the owner in between
- [ ] ship-modes

## Round 2: auto-merge for devkit-lite
- [ ] auto-merge (after: ship-modes)

Carry-over from the ship-modes review: CI's `reviewConsensus` (`guard.mjs`) has no staleness check while `deliver-check`'s `reviewsItem` does; the `devkit-reviews` CI check should share `readReviews` so both agree on "approved".

## Round 3: archive after merge
- [ ] archive-after-merge (after: auto-merge)

## Round 4: conduct roadmap rounds
- [ ] conduct-rounds (after: ship-modes)
