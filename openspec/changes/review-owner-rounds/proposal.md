<!-- devkit-stage proposal result=passed attempt=2 commit=a0e9efb9e046bf0cfe6f88199fbe8d334ea0b11b -->
# Proposal

Change: `review-owner-rounds` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `6f03a57` as last
fetched; the branch was opened on it and has merged nothing yet (`a0e9efb`).

## Why

ADR 0032 decision 3 lets a review run past its second round only on the owner's own recorded words,
and its review trigger names "a third review round runs without a recorded authorization". Change
`coordinator-loop-fixes` already made the round script accept and count such a round
(`roundLimit(args)`, `Consensus: ... (round N/<limit>)`), but nothing in the round script checks that
the words exist, and `review.md` carries them only when the session copies them into the notes by
hand. The project-setup retro asked that the script itself print the owner's words and refuse a round
above 2 that has none.

## What Changes

- **The round's arguments carry the owner's words** for a round above 2: an optional `args.owner`
  `{ round, scope, words }`, filled from the record that `change-loop.mjs declare <id> review-round`
  writes in `openspec/changes/<id>/declared.json`. The Workflow script and every `review-round.mjs`
  command that takes `args` refuse a round above 2 without it, before any agent starts (AC-3). A round
  of 1 or 2 takes no `owner` (AC-4).
- **A new command reads the record**: `review-round.mjs owner --input <json>` with
  `{ changeDir, scope, round }` prints the recorded words of that round and scope (or `null` for a
  round of 1 or 2), and refuses when the record holds none. The skill puts its `owner` into `args`
  unchanged, as it does with `tree`'s `head` and `dirty`, so the words never pass through the
  session's own retelling.
- **The consolidated section quotes them**: for a round above 2, the section `consolidate` writes for
  `review.md` (or `resolution.md`) holds one line `Owner's words for round N: "<words>"` under its
  `Consensus: ... (round N/<limit>)` line (AC-1, AC-2, AC-5). Rounds 1 and 2 print exactly what they
  print today (AC-4).
- **The texts follow**: the `review-change` skill's `args` sentence and rounds rule (the session no
  longer copies the words into the notes), the `review` and `review-resolution` rows of the
  `ship-change` skill, and the review round section of `docs/openspec-flow.md`.
- **Already delivered, kept as it is**: `roundLimit(args)`, `validateArgs`' round range and the
  `(round N/<limit>)` texts, pinned today by `coordinator-loop-fixes AC-7 T41` to `T43` of
  `plugins/core/skills/review-change/scripts/review-round.test.mjs` and by `T33` to `T37` of
  `plugins/openspec/hooks/deliver-check.test.mjs`. T41 gains the owner's words its round now needs
  (`design.md`, D-7); no new test is needed for the delivered half.

Non-goals: everything under "Out of scope" in `requirements.md` (`REVIEW_ROUNDS` stays 2,
`declare review-round` is unchanged, the words are printed nowhere but `review.md` and
`resolution.md`, archived `review.md` files are not rewritten). Also out: the CompozyOS driver, which
stops its review at two rounds and takes no authorized round (ADR 0032, Note of 2026-11-25); the
reviewer and writer prompts, which do not quote the words; the loop's `review` and
`review-resolution` steps, unchanged; and `scripts/test-map.json`, since no file is added or moved.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `owner-words-printed` — A review round above 2 that the owner authorized appends to `review.md` a section whose `Consensus:` line reads `(round N/<limit>)` with N the real round, and which holds one line quoting the owner's words recorded for that round in `declared.json`, written by the round's script with no copy by the session. Shown by a test of `consolidate` and by one real run of an authorized round 3.
- AC-2 `one-line-per-round` — With two authorized rounds (3 and 4), the section of round 3 quotes the words recorded for round 3 and the section of round 4 quotes those recorded for round 4.
- AC-3 `no-words-no-round` — A call of the review round (`review-round.workflow.js`, and `review-round.mjs` where it validates the same `args`) with a round above 2 and no owner's words recorded for that round and scope is refused with an error naming the missing authorization, and writes no verdict file and no `review.md` section.
- AC-4 `rounds-one-two-unchanged` — Rounds 1 and 2 print exactly what they print today: no owner's line, and the existing tests of `review-round.test.mjs` for those rounds stay green unchanged.
- AC-5 `resolution-scope` — The same three rules hold for a resolution review appended to `resolution.md`, reading the words of scope `resolution`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-round`: a round above 2 needs the owner's recorded words (the requirement "A round beyond
  the second runs within the authorized limit" is modified), a new `owner` command reads them from
  the record, the consolidated section quotes them, and the review skill fills them from that command.

## Impact

- devkit-core: `plugins/core/skills/review-change/scripts/review-round.workflow.js` (the rules:
  `validateArgs`, `consolidate`), `review-round.mjs` (the `owner` command), their tests in
  `review-round.test.mjs`, and `plugins/core/skills/review-change/SKILL.md`.
- devkit-openspec: `plugins/openspec/skills/ship-change/SKILL.md` (two rows) and one test of
  `plugins/openspec/hooks/deliver-check.test.mjs` holding the `owner` command's reading to
  `deliver-check.mjs#readDeclared`'s. No hook's answer changes.
- Repository: `docs/openspec-flow.md` (one sentence of "The review round").
- Contract (flag `contract`): `args` of the review round gains `owner`; a caller that passes a round
  above 2 without it is refused. The only such caller is the loop's `review` or `review-resolution`
  step after a recorded authorization, through the skill.

## Dependencies

- `coordinator-loop-fixes` (archived 2026-11-26): `args.limit`, `declare review-round`, the record
  `declared.json` and `authorizedRounds`. Delivered on the base.
- No open decision: the repository keeps no open-decisions log, and `decisions.md` records that no
  ADR is needed.

## Decisions cited

ADR 0032 (decision 3, its review trigger and its Note of 2026-11-25), ADR 0008 (decisions 3, 4 and
5), ADR 0024 (decision 5), ADR 0011 (decision 2), ADR 0036 (the gate's selective run).
`decisions.md`: no record needed.

## Release rule

`openspec/config.yaml` names `devkit.release_tag`, so `release.md` states the release (devkit-core
and devkit-openspec, a patch each). No task bumps a version, edits a `CHANGELOG.md` line or a CI pin
line, or numbers an ADR: the delivery writes them at the merge.

## Exit criteria

- `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` exits 0 (both phase gates).
- The text readers' run of `tasks.md` task 1.8 exits 0.
- `openspec validate review-owner-rounds --strict`, `python3 scripts/gen-catalog.py --check`,
  `node plugins/compozy/kit/scripts/gen-agents.mjs --check` and `claude plugin validate .` exit 0.
- The real runs RR1 to RR5 (`design.md`, D-8) each have a `pass` line in `proof/checks.txt`.
