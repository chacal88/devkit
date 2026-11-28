# Release note

packs:
- devkit-core: patch
- devkit-openspec: patch

## a review round above the second needs the owner's recorded words and quotes them

- **devkit-core**: the review round refuses a round above 2 whose `args.owner` does not hold the
  owner's words recorded for that round and scope, on the Workflow path and in every
  `review-round.mjs` command that takes `args`, before any agent starts. The new
  `review-round.mjs owner` command reads the words from the change's `declared.json`, as
  `change-loop.mjs declare <id> review-round` recorded them, and the round's section in `review.md`
  (or `resolution.md`) prints them on one line, `` Owner's words for round N: "`<words>`" `` (the
  words in a backtick span, each backtick of theirs printed as `'`), under its
  `Consensus: ... (round N/<limit>)` line. The review skill fills `args.owner` from that command and
  no longer copies the words into the notes. Rounds 1 and 2 print what they printed before.
- **devkit-openspec**: the `review` and `review-resolution` rows of `ship-change` say how
  `args.owner` is filled; a test holds the round's reading of `declared.json` to the delivery
  check's. No hook's answer changes.
- Repository: `docs/openspec-flow.md` describes the owner's line and the `(round N/<limit>)` line.
