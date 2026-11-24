<!-- devkit-stage proposal result=passed attempt=1 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Proposal

Change: `loop-place-and-evidence` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, passed; `decisions.md`: no record needed). Round 19b of `openspec/roadmap.md`.

## Why

The delivery checker hands `verify` and then `review` with no step between them, and it counts only
paths outside `openspec/` as uncommitted. An `evidence.md` (or a ticked `tasks.md`) left
uncommitted in the change folder is invisible to it, so the review round can run on a tree that is
dirty only in the change folder. Each verdict then carries `Commit: <sha> (uncommitted changes)` and
the checker reads it as stale on arrival. The only thing that prevents it today is one sentence of
prose in the `review` row of `ship-change`. In `jira-entry` the session skipped that sentence and
the round ran again (its retro, row 2: about 1h30 on the Avell).

The first half of the roadmap line, an end for a change that waits for a place, is already on
`main` (`requirements.md`, "What origin/main already does"); this change does not touch it.

## What Changes

- `plugins/openspec/hooks/deliver-check.mjs`: the collected state gains the paths that `git status`
  shows as modified, staged or untracked under `openspec/changes/<id>/`. When the checker is about to
  answer `review` and that list is not empty, it answers the existing `commit` step instead, with
  `paths` empty and a reason that names the folder's paths. Every other answer is unchanged. In
  particular, the `commit` step for product code still comes first, before `verify`.
- `plugins/openspec/hooks/change-loop.mjs`: no code change. `ROWS.commit` already hands `commit` to
  `devkit-core:commit-and-pr`. A new test pins that hand-off for a `commit` step whose `paths` is
  empty.
- `plugins/openspec/skills/ship-change/SKILL.md`: the `review` row no longer asks the session to
  commit the folder in prose. It says that the loop hands the `commit` step first. The `commit` row
  says that `next.paths` may be empty and that the folder is still staged from `git status`.
- `docs/openspec-flow.md`, "Order of the delivery steps": states the rule.
- Existing tests that write `evidence.md` and expect `review` from a real repository with the
  evidence uncommitted now commit it first (or expect the `commit` step), each named in the
  design with its invariant.
- Release: devkit-openspec 0.34.0, marketplace 0.38.0, a `CHANGELOG.md` section, and the CI pin
  of `docs/openspec-flow.md` moved to `v0.34.0` (renumbered above `main`'s if a sibling merges
  first).

Non-goals: the waiting-for-a-place end and the held session (done by `remote-worker` and
`roadmap-sessions-upfront`); the merge-turn wait (`delivery-merge-hold`); which reviewers count a
dirty change folder as uncommitted, and the `fix-review` loop after a fix inside the folder
(`jira-entry-followups`); the suite's speed (`suite-speed`); committing `reviews/` and `review.md`
after the round (the `push` and `open-pr` rows already do it). No new step name, role, agent,
row, end or reply exists.

## Acceptance criteria

- AC-1 `commit-before-review`: when `verify` is current, some reviewer is missing or stale, and `openspec/changes/<id>/` holds a modified, staged or untracked path, `deliver-check.mjs` returns the step `commit` (not `review`), and `change-loop.mjs` hands it as the `commit-and-pr` hand-off it hands today.
- AC-2 `review-after-commit`: once that path is committed, the next call returns `review` with the same reviewers and round it would have returned before.
- AC-3 `clean-folder-unchanged`: with the change folder clean, the checker's answer is the one it gives today for every state it has (no new step, no new end).
- AC-4 `product-dirty-first`: when paths outside `openspec/` are dirty too, the `commit` step stays the one of line 1551 and fires before `verify`, as today; the new rule adds no second commit step in the same call.
- AC-5 `no-uncommitted-verdicts`: a review round run after the step records `Commit: <sha>` with no `(uncommitted changes)`, and `deliver-check` reads the round as current (shown by this change's own review round, run on the real tree).
- AC-6 `skill-names-the-step`: the `review` row of `ship-change/SKILL.md` no longer asks the session to commit by prose; it says the loop hands the `commit` step first. The `commit` row says `next.paths` may be empty and the folder is still staged from `git status`. `docs/openspec-flow.md` states the rule.
- AC-7 `place-wait-untouched`: the `no-place` end, the `held` action and their tests are unchanged (`change-loop.test.mjs` and `roadmap-loop.test.mjs` rows named above stay green without edits).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: adds one requirement, "The change folder is committed before a review round".
  It covers what the delivery checker answers when the change folder is dirty at the moment it
  would hand `review`, and that nothing else it answers changes.

## Impact

- **devkit-openspec** (`plugins/openspec/`): `hooks/deliver-check.mjs` (`collectState`,
  `nextStep`), `skills/ship-change/SKILL.md` (rows `commit` and `review`), and the tests in
  `hooks/deliver-check.test.mjs`, `hooks/flow-check.test.mjs` and `hooks/change-loop.test.mjs`.
  Version 0.33.0 to 0.34.0.
- **Docs**: `docs/openspec-flow.md` (the order paragraph and the CI pin), `CHANGELOG.md`.
- **Marketplace**: `.claude-plugin/marketplace.json` 0.37.0 to 0.38.0.
- **devkit-core**: none. The `commit-and-pr` agent already takes a commit-only call that is derived
  from `git status` (`plugins/core/agents/commit-and-pr.md`, Receives and Preconditions 2 and 3).
- **CI** (`devkit-reviews`): none. `--ci` checks items 1 to 4 and never calls `nextStep`.
- **Panel**: none. `commit` is already a step it names (`plugins/panel/hooks/steps.ts`).
- **Dependencies**: none. It may conflict with the sibling `jira-entry-followups` in the same two
  files. Whichever change merges second merges `origin/main` and renumbers its release
  (`CONTRIBUTING.md`, step 5).
- **Decisions cited**: ADR 0010 (the loop, not the session, decides the order), ADR 0008 decision
  4 (the review gates and `Commit:` lines stay as they are), ADR 0016 (each role writes its own
  files; the commit role only commits them). Open decisions inherited: none.
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate loop-place-and-evidence --strict` pass. This change's own review round records
  no `(uncommitted changes)` (AC-5).
