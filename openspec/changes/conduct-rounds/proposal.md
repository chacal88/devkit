# Proposal

Change: `conduct-rounds` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · PRD / tech spec: n/a · Roadmap: round 4 of `openspec/roadmap.md`

## Why

Rounds 1 to 3 take one approved change from plan to `archived` without the owner between gates. A roadmap round still runs one change at a time: the owner creates each change, starts its grill, plans it, gives the go-ahead, runs `/ship-change` per change and re-runs it after every wait. `ship-modes` and `auto-merge` named a multi-change `conduct` skill as their non-goal. The roadmap's `after:` lines are reported but never acted on.

## What Changes

- **New `conduct` skill** (`plugins/openspec/skills/conduct/SKILL.md`, `/conduct`, devkit-openspec). It takes every unticked change of the current roadmap round from `not started` to `archived`, then continues with the next round. The main session recomputes each change's next step, dispatches the steps of changes that can move as parallel subagents (at most 3 at a time, each in that change's git worktree), and asks the owner at the owner gates. No subagent runs a whole change.
- **New `conduct-check`** (`plugins/openspec/hooks/conduct-check.mjs`, read-only, `--json`). It computes the round from the roadmap on the default branch. For each conducted change it combines worktree and branch facts, the planning steps (create, grill, plan, readiness, owner approval), dependencies (`after:`, rebase, plan audit) and `deliver-check`'s next step, run inside the change's worktree. It outputs which steps run now, which wait and on what, which need the owner, and whether a wake-up cron is wanted. It has a capped `--watch`.
- **New `release-rebase`** (`plugins/openspec/hooks/release-rebase.mjs`). It rebases a change branch on its base when the only conflicts are in release files. Each changed pack's version ends above the base's, with the change's own bump kind applied. Both CHANGELOG entries are kept and the catalog is regenerated. Any other conflict aborts the rebase.
- **Plan approval on disk** (AC-5): `openspec/changes/<id>/approval.md` with `- Status: APPROVED`, bound to `readiness.md` by a hash. `deliver-check` names `stop-plan-approval` before the first `implement` of a `devkit` change until it exists. The guard lets only the main session write it. `ship-change` writes it only from the owner's own message.
- **Hooks in worktrees**: the guard resolves the repository root and the change from the edited file's path and from a command's `cd`, not from the session's cwd. Gates therefore apply to subagents working in `.claude/worktrees/<id>/`.
- **Roadmap lines may carry a description** (`- [ ] <id> (after: a) — <text>`). `readRoadmap` keeps the text, and `conduct` passes it to the planner.
- **ADR 0005** `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` (new, drafted in design D13). It records the owner-approved exception to ADR 0001: parallel step subagents in worktrees, and a self-scheduled session cron that re-runs `/conduct`. ADR 0001 gets a pointer.
- **Roadmap round 5** (three small real changes, one with `after:`) is added to `openspec/roadmap.md` for the AC-13 dogfood.
- **Docs and release**: `docs/openspec-flow.md`, `plugins/openspec/README.md`, `README.md`, `openspec/config.yaml` ADR list, catalog, CHANGELOG. devkit-openspec and marketplace one minor above `origin/main`'s when phase 4 runs, not hard-coded: the parallel `devkit-opt-in` change also claims 0.7.0, and whichever PR merges second rebases and renumbers (design D17). devkit-core is not touched.

Non-goals (requirements.md, Out of scope): a subagent running a whole change, or anything outside the session other than the session cron; resolving non-release conflicts; reordering or editing roadmap lines; planning a later round early; changing `ship-change` beyond the plan approval; the `commit-and-pr` trailer fix itself. Excluded at design level: an approval check in the `devkit-reviews` CI check, `deliver-check` enforcing `after:` for a single `/ship-change`, and any new state file outside the change folders.

## Acceptance criteria

- AC-1: With a current round of N unticked changes, `/conduct` creates each `not started` change with the schema it proposes from the `openspec/config.yaml` criteria and the owner confirmed. Every proposed schema, `devkit-lite` included, is the change's first owner question: the grill's first question for `devkit`, one schema-confirmation question for `devkit-lite`. Each change is driven through grill (devkit), plan, readiness (devkit) and the owner's approval (devkit) before any product code is written for it.
- AC-2: Independent changes progress in parallel: in one run, step subagents of at least two changes are dispatched together, each in its own worktree on a branch named after the change.
- AC-3: For `B (after: A)`, B's plan may exist before A is archived, but no `implement` step runs for B until A is ticked on the default branch; B's branch is then rebased on it.
- AC-4: A `devkit-lite` change conducted by `/conduct` reaches its first `implement` without the owner being asked anything after its schema confirmation (AC-1); a `devkit` change does not reach `implement` without the owner's recorded approval.
- AC-5: `deliver-check <id> --json` on a `devkit` change with `readiness.md` APPROVED but no recorded owner approval names a stop step (not `implement`); with the approval recorded it names `implement`. `ship-change` writes that approval only after the owner's own message.
- AC-6: When a conducted change's PR conflicts with its base only in release files, `conduct` resolves the conflict as stated in Assumptions and the change continues; a conflict in any other file stops that change as `blocked: item 5` while the others continue.
- AC-7: A change that stops is reported with its reason; independent changes keep moving and dependent ones wait. The run's final report lists every conducted change with exactly one state (`archived`, `waiting on <ids>`, `waiting for the owner: <gate>`, `waiting on GitHub: <what>`, `blocked: <reason>`).
- AC-8: When the current round is fully ticked, the same run continues with the next round; when the roadmap is done, `conduct` reports it and no cron job created by `conduct` remains.
- AC-9: When everything that can move waits on GitHub, `conduct` leaves exactly one recurring cron job running `/conduct` (none duplicated across runs), and deletes it when nothing is left that the cron could advance (roadmap done, or every remaining change waits on the owner or is stopped).
- AC-10: A new ADR in `docs/adr/` records the exception to ADR 0001 (self-scheduled wake-up via a session cron, parallel step subagents in worktrees) and ADR 0001 points to it.
- AC-11: Killing the session mid-run and running `/conduct` again resumes every change from disk and GitHub, without redoing finished steps and without a second worktree or branch per change.
- AC-12: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`) passes, with tests covering the round/next-step computation (parallel sets, dependencies, early planning, release-file conflict classification) and the approval line.
- AC-13: After merge and before archive, the round-5 test round (three real changes, one with `after:`) is conducted to `archived`, recorded in this change's `retro.md` `## Dogfood`.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedents: every archived change under openspec/changes/archive/). skip_specs: true. See design.md D1. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): new `skills/conduct/SKILL.md`, `hooks/conduct-check.mjs`, `hooks/release-rebase.mjs` and their tests (`conduct-check.test.mjs`, `release-rebase.test.mjs`, imported by `guard.test.mjs`). Also `hooks/guard.mjs` (worktree roots, `approval.md` writer, roadmap text), `hooks/deliver-check.mjs` (`stop-plan-approval`, `approval` JSON), `skills/ship-change/SKILL.md`, `README.md`, `plugin.json`.
- **Repo**: new `docs/adr/0005-parallel-steps-and-a-session-wake-up.md`; `docs/adr/0001-coordination-without-a-harness.md` (pointer); `docs/openspec-flow.md`, `README.md`, `docs/catalog.md` (generated), `openspec/config.yaml` (ADR list), `openspec/roadmap.md` (round 5), `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- **Runtime**: Claude Code session cron tools (CronCreate, CronList, CronDelete) and background subagents. No GitHub settings change.
- **Dependencies**: git ≥ 2.38 (`merge-tree --write-tree`; 2.50.1 here), `gh` 2.88, OpenSpec 1.16, Node 22. No new packages.
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`, `openspec validate conduct-rounds --strict`; `check` and `devkit-reviews` green on the PR; after the merge, the round-5 dogfood reaches `archived` (AC-13).
- **Decisions cited**: ADR 0001 (exception recorded by ADR 0005; everything else kept: recompute from repository and GitHub, one step per subagent, the owner's plan approval stays a human gate). ADR 0002 (merge mode unchanged; the rebase after a release conflict re-runs stale reviews as ADR 0002 already accepts). ADR 0003 (archive PRs unchanged; archives of conducted changes are serialized). **New**: ADR 0005 (design D13). **Parallel change**: `devkit-opt-in` (ADR 0004, the same release number, overlapping files), handled by design D17. **Open decisions inherited**: none. The three planning questions were answered by the owner on 2026-11-09 (design.md "Open Questions"): every new change's schema is confirmed (AC-1, AC-4 reworded), `/conduct round <n>` is kept, and archives run one at a time.
