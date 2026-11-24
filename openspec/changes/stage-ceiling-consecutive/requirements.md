<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `flow-check.mjs` blocks a stage with `ceiling-reached` when its header says `result=failed` and `attempt >= ceiling`, but `attempt` is one more on each rewrite, so a stage that passed at attempts 1 and 2 (rewritten after code changed) and failed at attempt 3 is blocked at the first failure after two green runs (remote-worker, the evidence stage, 2026-11-23: two defects found and fixed, the loop declared `blocked: ceiling`, and only the owner's authorization ran a fourth attempt). Count the failures since the last passed attempt, keep `attempt` as it is, and pin it in `flow-check.test.mjs`

> Fused with the roadmap line `evidence-attempts-by-failure` (answered by the coordinating session under the owner's delegation, 2026-11-23): the stage checker counts a stage's attempts by failed takes, not by takes retaken after a merge of main made the evidence stale, so a merge-heavy delivery does not reach the ceiling of three without three real failures (release-merge-conflict retro, item 2)

## Classification

domain=process type=bug flags=[contract] (strict-assumed: the reason params that `change-loop.mjs` reads change)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- One change, one pull request, for the whole count of the ceiling in `plugins/openspec/hooks/flow-check.mjs` (coordinating session, under the owner's delegation, 2026-11-23): the roadmap lines `stage-ceiling-consecutive` and `evidence-attempts-by-failure` are both ticked in `openspec/roadmap.md` when this change is archived, and the `evidence-attempts-by-failure` worktree and session are closed without a change of their own. A take that passed does not count, a take redone because main moved does not count, and only a failed take counts, in a row.
- A failure that a merge of main caused is the merge-defect path of `post-merge-validate` (its hand-off to the planner touches no attempt counter, by its own requirements); this change adds no merge detection to the checker. A failed take that follows such a merge and fails for the change's own reasons is a real failure and counts.
- How the checker keeps the count is settled from the code, not asked: derived from the stage file's earlier headers in git history, no new header field. A new field would change `STAGE_HEADER` in `plugins/openspec/hooks/guard.mjs`, every agent that writes a header (`plugins/core/agents/pr-verifier.md` line 54, the `ship-change` rows) and the flow version, against the roadmap line's "keep `attempt` as it is", and the owner would see nothing different.
- The ceiling is checked in one place, `plugins/openspec/hooks/flow-check.mjs`, in the walk (`raw.attempt >= ceiling`, the `ceiling-reached` end); the stage header (`<!-- devkit-stage <stage> result=<..> attempt=<n> commit=<sha> -->`, regex `STAGE_HEADER` in `plugins/openspec/hooks/guard.mjs`) keeps exactly its fields and `attempt` keeps the value each writer gives it today, as the roadmap line says: one more on each rewrite for most writers, and the round for the `review` stage of `devkit` and `devkit-lite`, which restarts at 1 when a round starts over (`plugins/openspec/skills/ship-change/SKILL.md` line 57, `plugins/openspec/hooks/deliver-check.mjs` line 1587; planning revision 2, from the readiness review). No agent, template or `flow.json` changes what it writes.
- The checker reads only the current header today, so the count of failures since the last passed attempt comes from the same stage file's earlier headers in git history (`git log` of the file, line 1 at each commit); ADR 0017 already lets the state be derived from "the change's files, git, GitHub". The count is the number of distinct `result=failed` headers of that stage (the current one included) that the file carried in its commits since the newest committed `result=passed` header, walking the history newest first; no attempt number is subtracted, because the `review` stage's attempt restarts. With no passed header visible (the file never committed, a depth-1 clone, every take failed) the count is at least `attempt`, today's rule, and only there is the ceiling never looser than before. A take overwritten without a commit is not seen. Outside a git repository or without git the checker already exits 3 before reading any stage, and stays so (planning revision 2, from the readiness review).
- The rule applies to every stage that declares a numeric ceiling (readiness 3, unit-tests 3, evidence 3, review 2 in `plugins/openspec/schemas/devkit/flow.json`, the same in `devkit-lite`), not only to the evidence stage; a stage with `ceiling: "owner"` is unchanged.
- The readout and the loop say the count of failures in a row where they now say the attempt as the failure count: `ceiling-reached` and `header-failed`/`fix-after-failure` keep `attempt` in their params and gain `failures`; the English and pt-BR sentences in `flow-check.mjs` and the `blocked-why.ceiling` line of `plugins/openspec/hooks/change-loop.mjs` say "N failures in a row" (a stage that failed three times in a row reads as before in substance).
- A flow version that changes the ceiling's meaning is a new flow version (`plugins/openspec/schemas/devkit/flows/<n>.json`) only if a declared field changes; here none does, so a change pinned to flow version 1 or 2 is read by the same checker with the new count (the checker's rule, not the declaration's).
- Release numbers and the ADR number are written by the rule of `openspec/config.yaml`, never as literals in the plan.
- Test to pin, from the roadmap line and the remote-worker retro: in `plugins/openspec/hooks/flow-check.test.mjs`, a failed header `attempt=3` whose attempts 1 and 2 passed is offered again (fix, then rerun), not `ceiling-reached`; three failures in a row still end `blocked`.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `passed-attempts-reset-the-count`: a stage whose header says `result=failed attempt=3`, with attempts 1 and 2 passed in the file's history and a ceiling of 3, is offered its fix (`fix-after-failure`), not ended blocked with `ceiling-reached`.
- AC-2 `consecutive-failures-still-block`: a stage whose attempts 1, 2 and 3 all failed, with a ceiling of 3, ends blocked with `ceiling-reached`, as today; so does a ceiling of 2 after two failures in a row.
- AC-3 `a-pass-between-failures-resets`: a stage that failed at attempt 1, passed at attempt 2 and failed at attempt 3 counts one failure, and one that failed at attempts 1 and 2 and then passed counts none once passed.
- AC-4 `history-unreadable-keeps-today-rule`: when the file's history cannot be read, the count is `attempt` and the stage is blocked exactly when `attempt >= ceiling`, as before.
- AC-5 `header-and-attempt-unchanged`: `attempt` keeps the value each writer gives it today (one more on each rewrite; the round for the `review` stage), and the header's fields, the agents' instructions and the `flow.json` files are unchanged.
- AC-6 `the-readout-says-failures-in-a-row`: the blocked reason and the failed stage's line say how many failures in a row, in English and in pt-BR.
- AC-7 `retaken-takes-do-not-count`: an evidence header `result=passed attempt=2` made stale by a merge of main, rewritten as `result=failed attempt=3` after passed attempts 1 and 2, is one failure; a delivery that retakes the evidence after each of three merges of main and fails once is not blocked.
- AC-8 `roadmap-ticks-both`: the line of `evidence-attempts-by-failure` in `openspec/roadmap.md` says it was delivered by this change, and the archive follow-up in `tasks.md` ticks both that line and the line of `stage-ceiling-consecutive`.
- AC-9 `pinned-in-flow-check-test`: the cases of AC-1 to AC-4 and AC-7 are tests in `plugins/openspec/hooks/flow-check.test.mjs`, each red on today's code.

## Out of scope

- Detecting or routing a merge defect: `post-merge-validate` (it runs `openspec validate <id> --strict` after a base merge and hands the planner); this change does not touch it and does not wait for it.
- Changing the ceilings' numbers, the `onFail` targets or the no-progress rule.
- Any change to what the agents write in a header.
