<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> review-owner-rounds: from the project-setup retro: `review-round.workflow.js` accepts a round above 2 when the owner authorized it, and `review.md` prints the real round number and the owner's words.

Classification: domain=process type=bug flags=[contract] (strict-assumed: the change touches the `args` contract between the loop's `review` step, the `review-change` skill and `review-round.workflow.js`)

## Current state (read before the grill)

- The first half of the request is already delivered by change `coordinator-loop-fixes` (D-4, commit 8b9be44): `plugins/core/skills/review-change/scripts/review-round.workflow.js#roundLimit` takes the optional `args.limit`, `validateArgs` accepts `args.round` from 1 to that limit, and the consolidated section prints `Consensus: <PASS|FAIL> (round N/<limit>)`. `plugins/openspec/hooks/deliver-check.mjs#nextStep` gives `limit` on the `review` step when the owner authorized rounds (`REVIEW_ROUNDS + authorizedRounds(dir, 'review')`). The archived `coordinator-loop-fixes/review.md` prints `Consensus: PASS (round 3/3)`.
- The second half is not delivered: the owner's words are recorded by `change-loop.mjs declare <id> review-round --stdin words` as a `review-round` step `{ key, scope, round, words, at }` in `openspec/changes/<id>/declared.json`, but no script prints them in `review.md`. Today they reach `review.md` only when the session copies them into the section's notes, as `plugins/core/skills/review-change/SKILL.md` asks in prose.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The round limit and the round number stay as they are today (`roundLimit`, `nextStep`'s `limit`): this change does not reopen them. (the owner left the choice to the recommendation)
- The owner's words printed for round N are the `words` of the `review-round` step in `openspec/changes/<id>/declared.json` whose `round` is N and whose `scope` matches the review (`review` for `review.md`, `resolution` for `resolution.md`), as `deliver-check.mjs#readDeclared` reads them; they are already cut to 200 characters at record time.
- The resolution review of a two-pull-request project (`args.verdictDir: "reviews/resolution"`, section appended to `resolution.md`) gets the same rule as the code review, with its own scope `resolution`.
- Rounds 1 and 2 print no owner's line: no authorization is needed for them.
- How the words reach `review-round.workflow.js` (a new `args` field filled from the loop's `review` / `review-resolution` step, or read from `declared.json` by `review-round.mjs`) is the planner's choice; whatever path it picks, the words come from the recorded step, never from the session's own retelling.
- The owner's words are quoted as typed (a backtick is already replaced by `'` at record time), in the person's language; the rest of the section stays in English.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `owner-words-printed` — A review round above 2 that the owner authorized appends to `review.md` a section whose `Consensus:` line reads `(round N/<limit>)` with N the real round, and which holds one line quoting the owner's words recorded for that round in `declared.json`, written by the round's script with no copy by the session. Shown by a test of `consolidate` and by one real run of an authorized round 3.
- AC-2 `one-line-per-round` — With two authorized rounds (3 and 4), the section of round 3 quotes the words recorded for round 3 and the section of round 4 quotes those recorded for round 4.
- AC-3 `no-words-no-round` — A call of the review round (`review-round.workflow.js`, and `review-round.mjs` where it validates the same `args`) with a round above 2 and no owner's words recorded for that round and scope is refused with an error naming the missing authorization, and writes no verdict file and no `review.md` section.
- AC-4 `rounds-one-two-unchanged` — Rounds 1 and 2 print exactly what they print today: no owner's line, and the existing tests of `review-round.test.mjs` for those rounds stay green unchanged.
- AC-5 `resolution-scope` — The same three rules hold for a resolution review appended to `resolution.md`, reading the words of scope `resolution`.

## Out of scope

- Changing how many rounds run before the owner is asked (`REVIEW_ROUNDS` stays 2) or how the owner authorizes one (`declare review-round` stays as it is).
- Printing the owner's words anywhere other than `review.md` and `resolution.md` (panel, status line, PR body).
- Rewriting earlier `review.md` files of archived changes.

## Questions asked

1. [scope] Since `coordinator-loop-fixes` already runs an authorized round as round 3 and prints `round 3/3`, what should this change deliver: only the owner's words, the words plus a re-check of the round number, or close with no code? → No preference; the recommendation is taken: only the owner's words, printed by the script (answered by the coordinator's session on the owner's delegation of 2026-11-28)
2. [project rules] ADR 0032's review trigger names a third round run without a recorded authorization. Should a round above 2 with no recorded words be refused, or run with a warning? → No preference; the recommendation is taken: refused (AC-3) (answered by the coordinator's session on the owner's delegation of 2026-11-28)

## Escalations

- None.
