<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the stop hook of `/devkit change` has no end for a change that waits for a place under a roadmap's place limit (the session has to declare it blocked), and `evidence.md` is left uncommitted after the verify step, so the review round's verdicts carry `(uncommitted changes)` and are stale on arrival: add a waiting-for-a-place end and commit the evidence before the review round

## Classification

`{ domain: process, type: feature, flags: [] }`. No screen (no `ui` flag, so no mock-up). The change edits the delivery checker, the change loop and the skill text that names the step; nothing outside `plugins/openspec/` and the docs that describe it.

## What origin/main already does (checked 2026-11-23 against `origin/main` at c1ac8c4)

The line of `openspec/roadmap.md` was written before `remote-worker` (PR #76 line) and `roadmap-sessions-upfront` (PR #88) merged. Its first half is done and is dropped:

- A `/devkit change` run whose change waits for a free place on its machine is not asked to declare itself blocked: `plugins/openspec/hooks/change-loop.mjs` (the `place` facts, line 1186 onward) ends the run itself with `end.state` `blocked`, `end.why` `no-place`, prints the `devkit-end: <id> blocked` marker line the stop lock reads and renders the reply `waiting-place` in both languages. Pinned by `change-loop.test.mjs` ("remote AC-10 stop: the blocked end no-place lets a /devkit change run stop") and ADR 0020 (reason `no-place`).
- A change session a roadmap run started that waits for a place, the load or a dependency gets the `held` action (`roadmap-loop.mjs#sessionDecide`), and `roadmap-loop.mjs#changeSessionStopDecision` lets its turn end while it is held (`allow('held', ...)`), with `session-wait` as the wake-up. The title shows `⏳` (`roadmap-sessions-upfront` D-11).
- The wait for the merge turn is `delivery-merge-hold`'s (in flight), not this change's.

What is left is the second half: the evidence commit.

## What is wrong today (the second half, still true)

- `plugins/openspec/hooks/deliver-check.mjs` hands `verify` and then `review` with no step between them, and it counts only paths outside `openspec/` as dirty (`dirtyPaths`, line 250; the `commit` step at line 1551), so an `evidence.md` (or a ticked `tasks.md`) left uncommitted in the change folder is invisible to the checker.
- The only instruction to commit it is prose in the `review` row of `plugins/openspec/skills/ship-change/SKILL.md` ("Commit every modified or untracked file under the change folder first ... so the round runs on a clean tree"). A session can skip prose; in `jira-entry` it did, the round ran on a tree dirty only in the change folder, every verdict carried `Commit: <sha> (uncommitted changes)` and the delivery check read them as stale (`deliver-check.mjs#staleness`, line 292), so the round was run again (retro of `jira-entry`, row 2; about 1h30 on the Avell).
- `evidence.md` stays current after its own commit: `staleness` accepts every commit since the recorded one that touches only `openspec/`, so committing it costs no new verify.

## Assumptions

- The first half of the request (the waiting-for-a-place end) is already delivered by `remote-worker` and `roadmap-sessions-upfront`; this change adds nothing for it and changes none of its code or tests.
- The fix is a step of the loop, not a new sentence of prose: when the checker is about to hand `review` and the change folder (`openspec/changes/<id>/`) has any uncommitted or untracked path, `deliver-check.mjs` returns the existing `commit` step first, with `paths` empty of product files. `change-loop.mjs` maps `commit` to the same hand-off to `devkit-core:commit-and-pr` as today (`ROWS.commit`), so no new role, row or agent exists.
- The `commit` row of `plugins/openspec/skills/ship-change/SKILL.md` already stages "every other modified or untracked file `git status` shows under `openspec/`" and pushes without opening a pull request; it is reused as it is, with one sentence added that `next.paths` may be empty.
- The step fires only before `review` (that is, once `verify` is current and some reviewer is missing or stale), never before `verify`: the pr-verifier writes `evidence.md` first, then the loop commits it, then the round runs.
- The step names no file: it commits the whole change folder as `git status` shows it, as the `commit` row does today, so `tasks.md` ticks, `unit-tests.md`, `e2e-tests.md` and `evidence.md` go together.
- A change with a clean change folder sees no new step: `next` hands `review` as today.
- `Commit:` of `evidence.md` keeps the sha the verifier recorded (the pr-verifier's rule, `plugins/core/agents/pr-verifier.md` line 55); the review verdicts record the new HEAD.
- The sibling `jira-entry-followups` changes how a reviewer decides `(uncommitted changes)` when only the change folder is dirty. The two are independent: this change makes the tree clean before the round; the sibling makes a dirty change folder harmless. They may both edit `plugins/openspec/hooks/deliver-check.mjs` and `plugins/openspec/skills/ship-change/SKILL.md`; whichever merges second merges `origin/main` and renumbers its release.
- Per `CLAUDE.md`, the real-run proof covers every case the plan declares: evidence dirty only, a ticked `tasks.md` dirty only, an untracked new file in the folder, product code dirty together with the folder, and a clean folder, and the conducting session's own part (it dispatches the `commit` step it is handed and runs `next` again).

## Acceptance criteria

- AC-1 `commit-before-review`: when `verify` is current, some reviewer is missing or stale, and `openspec/changes/<id>/` holds a modified, staged or untracked path, `deliver-check.mjs` returns the step `commit` (not `review`), and `change-loop.mjs` hands it as the `commit-and-pr` hand-off it hands today.
- AC-2 `review-after-commit`: once that path is committed, the next call returns `review` with the same reviewers and round it would have returned before.
- AC-3 `clean-folder-unchanged`: with the change folder clean, the checker's answer is the one it gives today for every state it has (no new step, no new end).
- AC-4 `product-dirty-first`: when paths outside `openspec/` are dirty too, the `commit` step stays the one of line 1551 and fires before `verify`, as today; the new rule adds no second commit step in the same call.
- AC-5 `no-uncommitted-verdicts`: a review round run after the step records `Commit: <sha>` with no `(uncommitted changes)`, and `deliver-check` reads the round as current (shown by this change's own review round, run on the real tree).
- AC-6 `skill-names-the-step`: the `review` row of `ship-change/SKILL.md` no longer asks the session to commit by prose; it says the loop hands the `commit` step first. The `commit` row says `next.paths` may be empty and the folder is still staged from `git status`. `docs/openspec-flow.md` states the rule.
- AC-7 `place-wait-untouched`: the `no-place` end, the `held` action and their tests are unchanged (`change-loop.test.mjs` and `roadmap-loop.test.mjs` rows named above stay green without edits).

## Out of scope

- The waiting-for-a-place end and the stop decision for a held session (done by `remote-worker` and `roadmap-sessions-upfront`, see above).
- The wait step for the merge turn (`delivery-merge-hold`).
- Which reviewers count a dirty change folder as `(uncommitted changes)`, and the `fix-review` loop after a fix inside the change folder (`jira-entry-followups`).
- Running the suite faster or splitting it (`suite-speed`).
- Committing `reviews/` and `review.md` after the round: the existing `push` and `open-pr` rows do it.
