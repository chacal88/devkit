<!-- devkit-stage proposal result=passed attempt=2 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Proposal

Change: `stage-ceiling-consecutive` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, the roadmap lines `stage-ceiling-consecutive` and
`evidence-attempts-by-failure`, the remote-worker and release-merge-conflict retros).

## Why

The stage checker (`plugins/openspec/hooks/flow-check.mjs`) ends a run `blocked` with
`ceiling-reached` as soon as a failed stage's header says `attempt >= ceiling`. For most stages
`attempt` goes up by one on every rewrite, passed or failed, so a stage that passed twice (rewritten
after the code moved or after a merge of main made it stale) and then failed once is blocked at its
first real failure.
That happened to remote-worker's evidence on 2026-11-23, and a merge-heavy delivery reaches the
evidence ceiling of three with fewer than three real failures. The ceiling is meant to stop a stage
that keeps failing, not one that keeps being retaken.

## What Changes

- The checker counts a failed stage's **failures in a row**: the distinct `result=failed` headers
  (the current one included) that the same stage file carried in its commits since it last carried
  `result=passed`, read from git history newest first (line 1 at each commit). No attempt number is
  subtracted, because the `review` stage writes its round as `attempt` and restarts it at 1
  (`plugins/openspec/skills/ship-change/SKILL.md` line 57). With no passed header visible (a file
  never committed, a depth-1 clone, every take failed) the count is at least `attempt`, today's
  rule; only there is the ceiling never looser than before. A take overwritten without a commit is
  not seen.
- The ceiling compares that count, not `attempt`, for every stage with a numeric ceiling (declared,
  or the default of `flow.json`); a stage with `ceiling: "owner"` is unchanged.
- The reason params `header-failed`, `fix-after-failure` and `ceiling-reached` keep `attempt` and
  gain `failures`. Their English and pt-BR sentences in `flow-check.mjs` say the failures in a row.
- `plugins/openspec/hooks/change-loop.mjs` reads `failures`: the `blocked-why.ceiling` reply (both
  languages) says how many failures in a row, and the two `fix-after-failure` briefs name it.
  `plugins/openspec/hooks/project-loop.mjs` passes `failures` to the same reply.
- Unchanged: the stage header and its fields, the value each writer gives `attempt`, every agent and template
  that writes a header, every `flow.json` and `flows/<n>.json` (no new flow version), the ceilings'
  numbers, the `onFail` targets and the no-progress rule.
- Docs follow: `docs/openspec-flow.md`, `plugins/openspec/README.md`, `docs/coordination-design.md`.
- At archive, both roadmap lines `stage-ceiling-consecutive` and `evidence-attempts-by-failure` are
  ticked; the second says this change delivered it.

Non-goals: detecting or routing a merge defect (`post-merge-validate`), any merge detection in the
checker, a new header field, any change to what an agent writes.

## Acceptance criteria

- AC-1 `passed-attempts-reset-the-count`: a stage whose header says `result=failed attempt=3`, with attempts 1 and 2 passed in the file's history and a ceiling of 3, is offered its fix (`fix-after-failure`), not ended blocked with `ceiling-reached`.
- AC-2 `consecutive-failures-still-block`: a stage whose attempts 1, 2 and 3 all failed, with a ceiling of 3, ends blocked with `ceiling-reached`, as today; so does a ceiling of 2 after two failures in a row.
- AC-3 `a-pass-between-failures-resets`: a stage that failed at attempt 1, passed at attempt 2 and failed at attempt 3 counts one failure, and one that failed at attempts 1 and 2 and then passed counts none once passed.
- AC-4 `history-unreadable-keeps-today-rule`: when the file's history cannot be read, the count is `attempt` and the stage is blocked exactly when `attempt >= ceiling`, as before.
- AC-5 `header-and-attempt-unchanged`: `attempt` keeps the value each writer gives it today (one more on each rewrite; the round for the `review` stage), and the header's fields, the agents' instructions and the `flow.json` files are unchanged.
- AC-6 `the-readout-says-failures-in-a-row`: the blocked reason and the failed stage's line say how many failures in a row, in English and in pt-BR.
- AC-7 `retaken-takes-do-not-count`: an evidence header `result=passed attempt=2` made stale by a merge of main, rewritten as `result=failed attempt=3` after passed attempts 1 and 2, is one failure; a delivery that retakes the evidence after each of three merges of main and fails once is not blocked.
- AC-8 `roadmap-ticks-both`: the line of `evidence-attempts-by-failure` in `openspec/roadmap.md` says it was delivered by this change, and the archive follow-up in `tasks.md` ticks both that line and the line of `stage-ceiling-consecutive`.
- AC-9 `pinned-in-flow-check-test`: the cases of AC-1 to AC-4 and AC-7 are tests in `plugins/openspec/hooks/flow-check.test.mjs`, each red on today's code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-stages`: a failed stage's ceiling counts its failures in a row since it last passed, read
  from the stage file's earlier headers in git, and at least `attempt` when no pass is visible; the
  fix and ceiling reasons name that count.
- `project-definition`: a slice's run stops at a stage's limit of failures in a row, not at the
  attempt number its limit allows.

## Impact

- **devkit-openspec** (hooks): `flow-check.mjs` (history read, count, params, sentences),
  `change-loop.mjs` (the ceiling reply and two briefs), `project-loop.mjs` (the ceiling reply's
  params); tests in `flow-check.test.mjs`, `change-loop.test.mjs`, `project-loop.test.mjs`,
  `version-pin.test.mjs`. A patch release of the pack.
- **JSON contract** (additive): the three reason codes' `params` gain `failures`; no key is removed
  or renamed, and the report's top-level and stage-entry keys are unchanged.
- **CI**: none. The files the `devkit-reviews` job downloads (`guard.mjs`, `deliver-check.mjs`,
  `merge-setup.mjs`) are untouched.
- **Docs**: `docs/openspec-flow.md`, `plugins/openspec/README.md`, `docs/coordination-design.md`,
  `CHANGELOG.md`, `openspec/roadmap.md` (at archive).
- Decisions: no record needed (`decisions.md`); the change sits under ADR 0010 decision 3 and
  ADR 0017 decision 1. No open decision is inherited.
