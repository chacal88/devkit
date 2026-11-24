<!-- devkit-stage proposal result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Proposal

Change: `forced-merge-path` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Requirements: [requirements.md](requirements.md) · Decision: [decisions.md](decisions.md), ADR 0022
(drafted `proposed`, [docs/adr/0022-an-owners-forced-merge-leads-the-change-to-the-archive.md](../../../docs/adr/0022-an-owners-forced-merge-leads-the-change-to-the-archive.md))

## Why

On 2026-11-23/24 the owner merged change pull requests with admin rights while the delivery contract
was below 8/8 (PR 88 of `roadmap-sessions-upfront` with `devkit-reviews` FAILURE, task 9.6 and the
last phase's evidence and review open). A read-only replay of PR 88 against GitHub, with the default
branch read at its merge commit `6999a04`, shows what the loop does today:

- in the change's own worktree, `deliver-check` finds PR 88 by its head branch even with the branch
  deleted, then turns it into "no pull request for this branch yet" because a task is left and no
  further pull request is open, and `change-loop.mjs next` answers `implement` for task 9.6;
- on the default branch the same facts answer `stop-branch` ("continue on branch ... and open a
  further pull request"), and on any other branch `implement` again.

The lookup does not lose the pull request; the rule does: ADR 0003 and the `change-delivery` spec
let only a delivered change (every task ticked) reach the archive, so the retro and the archive of
those changes were driven by hand.

## What Changes

- `deliver-check` tells an owner's forced, final merge from a deliberate partial one by the required
  checks of the merged head (ADR 0022 decision 1): a merged own pull request with unticked tasks
  whose required checks were not all `SUCCESS` (or absent) is forced; with every required check
  green it stays the partial pull request of today.
- A forced merge enters the same post-merge rows a delivered change gets (`tag-release`, `retro`,
  `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`), from any
  checkout. Its `retro` step says `PR #<n> merged by the owner with <N> items open` and carries each
  open item: every unticked task on the default branch, every required check not green, every gate
  file (`evidence.md`, `reviews/<reviewer>.md`) without a passing verdict for the merged head.
- When the newest 100 merged pull requests (the cap of today's list) hold none of the change's own,
  a third lookup finds it by a commit of the default branch that changed the change's `tasks.md`.
- `change-loop.mjs next` turns that step into the retro session step with an owner reply naming the
  pull request and the count, and a forced step is never replaced by a test stage.
- The `ship-change` retro row writes the open items into the retro's "Went wrong" answer; nothing
  ticks a task or writes a gate file.
- Docs, the devkit-openspec release, and ADR 0022's records (the ADR list of `openspec/config.yaml`,
  the "Amended by" line of ADR 0003), the last two only after the owner approves the plan.

Non-goals: the stage readout (`flow-check.mjs`) keeps its text for a merged pull request with tasks
left (the loop's next action is the one place that decides, ADR 0017); the guard keeps refusing
`gh pr create` before the review (live case 2, a possible follow-up); `ship-change` keeps its ban on
merging and `--admin`; no gate is re-run, ticked or faked after a merge; a merge with every task
ticked and a red check stays delivered as today and lists no open item.

## Acceptance criteria

- AC-1 `forced-merge-recognised`: given a merged pull request of the change whose `check` or `devkit-reviews` is not `SUCCESS` on its head, with the change's tasks unticked on the default branch (the PR 88 facts), `deliver-check.mjs <id>` and `change-loop.mjs next --change <id>` answer a retro step that says `merged by the owner with N items open` (N the real count), never `implement`, `stop-branch`, `verify` or `review`.
- AC-2 `partial-merge-unchanged`: given a merged pull request with unticked tasks and every required check `SUCCESS`, the answer is the `stop-branch` of today ("continue on branch ... open a further pull request"), and every scenario of the `change-delivery` spec for a partial pull request passes unchanged.
- AC-3 `found-after-branch-deleted`: with the change's branch deleted on GitHub and the checkout on the default branch, on another branch or in the change's own worktree, the forced merge is found by the pull request's number or by the merge commit on the default branch, and the answer of AC-1 holds.
- AC-4 `no-gate-ticked`: after the path runs, `tasks.md` on the default branch has the same unticked tasks it had, and `readiness.md`, `reviews/`, `evidence.md` and `approval.md` of the change are byte-identical to before the path.
- AC-5 `open-items-in-retro`: the `retro.md` the path produces lists each open item (each unticked task, each required check not green, each gate without a passing verdict) and says the owner merged with N items open; its `## Proposed updates` section is readable by the retro checker.
- AC-6 `archive-as-delivered`: after the owner's own retro answers, the loop reaches `archive`, `tick-roadmap`, `open-archive-pr` and, when the pull request bumped the release file, `tag-release`, as for a delivered change; no retro answer is written from a file, an agent's report or a turn the owner did not type.
- AC-7 `adr-and-spec-delta`: an ADR with status `proposed` that amends ADR 0003 exists under `docs/adr/` with the next free number on `origin/main` at the last merge, and the `change-delivery` spec delta states the forced-merge scenarios of AC-1 to AC-3; `openspec validate --strict` and `python3 scripts/check.py` pass.
- AC-8 `live-cases-replayed`: the evidence replays the live cases (PR 88 first; PR 91, delivery-train and compozy-driver once merged, otherwise a fixture of their shape) read-only against GitHub, and shows for each the step `next` answers before and after the change; it also shows the partial-merge case of AC-2 unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: "Delivered means its own pull request merged and every task ticked", "The work
  left after a merge is named" and "A task done after the merge is ticked before the archive" make
  room for the forced merge; new requirements say when a merge is forced, what its open items are,
  and how its pull request is found from any checkout.
- `change-coordination`: the change loop leads a forced merge to the retro session step with its
  own reply, ahead of any test stage.
- `reviews-check`: an archive pull request is not judged on the archived change's unticked tasks
  (the behaviour PR 92 already showed, now pinned, because ADR 0022 relies on it).

## Impact

- `plugins/openspec/hooks/deliver-check.mjs`: the forced signal, the open items, the commit lookup,
  the post-merge entry and the retro reason (devkit-openspec).
- `plugins/openspec/hooks/guard.mjs`: the `Key: value` reader split so it reads a text as well as a
  file (no behaviour changes).
- `plugins/openspec/hooks/change-loop.mjs`: the forced retro reply and its precedence.
- `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/devkit/SKILL.md`,
  `docs/openspec-flow.md`: the retro row, the session's reply, the delivery paragraphs.
- Tests: `deliver-check.test.mjs`, `change-loop.test.mjs`, `flow-check.test.mjs` (fixtures only).
- Release: devkit-openspec and the marketplace bump, CHANGELOG, the CI pin lines; ADR 0022's list
  line in `openspec/config.yaml` and its line in ADR 0003.
- GitHub: new read-only routes after a merge (`pr view <n> --json statusCheckRollup`,
  `commits?sha=&path=`, `commits/<sha>/pulls`, `compare/<a>...<b>`, contents at a commit).
- Dependencies: ADR 0019 (`tag-release`) and the post-merge rows of `archive-after-merge`, both on
  `main`. No open decision is inherited (the repository keeps no open-decisions log).
