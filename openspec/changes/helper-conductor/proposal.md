<!-- devkit-stage proposal result=passed attempt=3 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Proposal

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`requirements.md` at attempt 4, `decisions.md`, `release.md`). Base: `origin/main` at `6f03a57`; the
branch merged nothing yet. "The record" is `docs/adr/helper-conductor.md`, cited `ADR
[helper-conductor]`, numbered by the delivery at the merge (ADR 0034 decision 3).

## Why

The first real `/devkit roadmap 4` (2026-11-27) and the eleven question boxes of 2026-11-28 showed
that a session per change cannot work on this host: a session start is refused on any turn the owner
did not type, the start ticket is re-minted at every `next` and refused as `ticket-unknown`, the stop
lock keeps demanding one more opening, and every change session asks the owner in a box of its own.
The owner wants one typed command after which the conductor drives every change, and one place to
answer.

## What Changes

- **One typed command, one scheduled task** (record decision 1): `/devkit roadmap [<n>]` records the
  queue and installs one task of the project; `stop`, the tick that finds the roadmap done and the
  tick that finds the run stopping with no helper in flight delete it.
- **An empty tick costs no model call** (decision 2): a `UserPromptSubmit` hook,
  `plugins/openspec/hooks/tick-gate.mjs`, blocks the task's envelope when nothing is ready, reading
  only files and starting no process; every other prompt passes.
- **A tick claims one item and drives it through a helper** (decisions 3, 4): a run-file claim with a
  heartbeat, taken under the lock; the helper (agent or Workflow, picked by phase 1's real run) runs
  `change-loop.mjs` in the change's worktree to its next wait, records it and releases the claim.
- **No owner box per change** (decisions 5 to 7): the grill is answered by the triage agent and the
  owner's new `openspec/standing-answers.md`; what needs the owner (a blocked end included) is one
  line in the run file, shown in the typed session and `/devkit status` and pushed once; a delegated
  gate is recorded with the quoted answer. The grill rule of `openspec/config.yaml` and the four
  `schema.yaml` copies is amended for exactly this.
- **The coordinator's hand work becomes the conductor's** (field facts of 2026-11-28): request files,
  a five-minute task with a sweep, a 12-line approval summary, the sibling order, the train's
  dispatch, the check before an opening, the escalation's re-hand, the split over machines by the
  pushed branch.
- **The conductor owns the machine's test capacity** (decision 13): one whole suite at a time per
  machine, the train's first; gates and files at once capped by two new settings (`test_gates`,
  `test_concurrency`) through `roadmap-loop.mjs test-run`; places count test-loading stages only.
- **BREAKING: the change sessions go** (decision 8): the start tickets, the run-file fields
  `tickets`, `changeSessions`, `startedSessions`, `turn`, `cron`, `check`, the verbs `session-next`,
  `session-wait`, `check`, the `session-start` action, `--change-sessions`, `--cron`, the
  `devkit-session` skill and its entry guard, the session cron and the session-model switches.
  `placed` and `checkout` stay (ADR 0020).

Unchanged: the CompozyOS verbs and `.compozy/` (decision 11); a lone `/devkit change`. Non-goals:
capping a lone change's tests; parsing `<name>` and `round <k>` (`multi-roadmaps`); work on another
machine over SSH; a phone channel beyond the host's notification tool; removing `decideRoadmap` and
`next`; editing the roadmap items `roadmap-run-opens-sessions` and `roadmap-live-checks` (escalated).

## Acceptance criteria

- AC-1 `first-real-run`: before the design is final, `evidence.md` (or the change's `proof/`) holds one real run showing a scheduled task of the project opening a session in which the devkit plugin's hooks fire, and the measured cost of one empty tick (tokens or model calls) with the refusal hook in place.
- AC-2 `one-typed-command`: `/devkit roadmap <name> [round <k>] [<n>]` typed once records the queue in the run file and creates exactly one scheduled task of the project; typing it again while the task exists creates no second task.
- AC-3 `empty-tick-refused`: a tick firing when no item is ready is blocked by the `UserPromptSubmit` hook before any model call; a test feeds the hook the tick's envelope with an empty-ready run file and gets `{"decision":"block"}`, and feeds it any other prompt and gets no output.
- AC-4 `tick-claims-one`: a tick with a ready item records a claim for exactly one item in the run file, runs that change's loop through a helper in the change's own worktree up to its next wait, records the state and ends; a second tick during a live claim leaves that item alone.
- AC-5 `resume-from-files`: the next tick goes on from the files (the change folder and the run file) with no state carried in a session; killing a helper mid-stage leaves a stale claim the next tick takes over.
- AC-6 `no-owner-box`: no helper calls AskUserQuestion or opens a session; a grill is answered from the triage agent and `openspec/standing-answers.md`, each answer naming its source.
- AC-7 `waits-for-owner-one-place`: a gate that needs the owner (plan approval, retro answers, anything not delegated) becomes one `waits-for-owner` line in the run file, shown by `/devkit status` and in the session the owner typed in; the owner's typed answer there is recorded and the next tick goes on.
- AC-8 `delegation-quoted`: a gate the standing answers delegate is recorded with the quoted standing answer as its words; a gate not delegated is never recorded by the conductor.
- AC-9 `task-removes-itself`: `/devkit roadmap stop` and the tick that finds the roadmap done both delete the scheduled task; `list_scheduled_tasks` no longer shows it.
- AC-10 `sessions-removed`: the tickets, the `devkit-session` skill (`plugins/openspec/skills/devkit-session/`), its entry guard in `plugins/openspec/hooks/guard.mjs`, the `session-start` action, the `--change-sessions` flag, the verbs `session-next`/`session-wait` and the session cron are gone; a grep of `plugins/` for `devkit-start:`, `ticket-unknown` and `devkit-roadmap-check:` finds nothing.
- AC-11 `places-cap`: no more than the run's places helpers are in flight at once on one machine.
- AC-12 `adr-recorded`: a new ADR (proposed, `docs/adr/helper-conductor.md`) supersedes ADR 0021 and amends ADRs 0004, 0006, 0008, 0010, 0011, 0013, 0014, 0017, 0020, 0022, 0023 and 0026 as its Amends list names; `openspec/config.yaml` and both `schema.yaml` carry the amended grill rule.
- AC-13 `compozy-untouched`: the CompozyOS roadmap verbs and `.compozy/` behave as before; their tests pass unchanged.
- AC-14 `request-file-channel`: a helper that needs a decision writes a request file in the change's folder (the question, the facts, its recommendation); the conductor's answer is a file beside it; no decision travels by a session message.
- AC-15 `periodic-check`: the scheduled task fires every 5 minutes; a non-empty tick reads each change's state, answers pending request files it may answer, restarts a change whose helper died (stale claim) and resumes one that stopped with work left.
- AC-16 `approval-summary`: a plan-approval `waits-for-owner` line carries a summary of at most 12 lines (what is built, ACs, ADRs, files, risks); the recorded approval quotes the delegating or typed words and its approval.md line stays within 200 characters.
- AC-17 `sibling-order`: when two queued changes touch the same file, the conductor records an order (or the rule "the second to reach its pull request merges the base first") with each plan's approval.
- AC-18 `train-dispatch`: when a change boards the train, the next tick dispatches the train; no boarded change waits without a dispatch.
- AC-19 `open-precheck`: before opening an item, the conductor checks for a parked branch of the same id (local or on `origin`) and for an item the code already delivers, and records `skipped: delivered` or reuses the branch instead of opening a duplicate.
- AC-20 `escalation-rehand`: a planner escalation ends that change's loop `blocked: not-delivered` with a request file; once requirements.md holds the decision, the next tick runs a plain `next` and the stage is handed again.
- AC-21 `machine-split`: after `open`, the change's branch is pushed; a conductor on another machine claims it and adds a worktree from that branch.
- AC-22 `test-capacity`: on one machine at most one whole-suite run is in flight at a time, the train's run first; concurrent gates and each gate's `--concurrency` are capped by values the run file records; a stage agent's brief carries the cap; a run's places count the changes in a test-loading stage, not sessions.

Exit criteria: every phase gate (`node scripts/test-suite.mjs --own-files && python3 scripts/check.py`)
passes; `claude plugin validate .`, `python3 scripts/gen-catalog.py --check` and
`node plugins/compozy/kit/scripts/gen-agents.mjs --check` exit 0; `openspec validate helper-conductor
--strict` passes; the real-run proofs of phases 1 and 6 are under `proof/`.

## Capabilities

- New: `roadmap-conductor` (the task, the tick and its hook, claims, helpers, owner lines, standing
  answers, request files, train dispatch, precheck, re-hand, machine split, test capacity).
- Modified: `roadmap-coordination` (session-per-change, periodic check and session models removed;
  places, stop, end, resume, board, machines restated); `coordination-locks` (the entry guard
  removed; stop and hand-off locks for the typed and tick sessions); `change-state` (claims, queue and
  owner lines as run facts); `change-coordination` (a conducted grill); `stage-models` (a helper's
  model).

## Impact

- `plugins/openspec`: `hooks/{roadmap-loop,run-file,guard,change-loop}.mjs`, `hooks/hooks.json`, new
  `hooks/{tick-gate,standing-answers,request-file,test-slots}.mjs`, `.claude-plugin/plugin.json`,
  the helper, `skills/devkit/SKILL.md`, `skills/ship-change/SKILL.md`, removed
  `skills/devkit-session/`, `schemas/*/schema.yaml`, `README.md`.
- `plugins/core`: `skills/requirements-grill/SKILL.md`. Repository: `scripts/test-suite.mjs`,
  `scripts/test-map.json`, `openspec/config.yaml`, `openspec/schemas/*/schema.yaml`, `docs/`
  (flow, coordination design, roles, generated catalog), the ADRs of D-16. None: `plugins/compozy`,
  `.compozy/`, `plugins/panel`.
- Dependencies: `multi-roadmaps` (not merged); the host's scheduled tasks and `UserPromptSubmit`
  block, proved by phase 1.
- Decisions cited: `ADR [helper-conductor]` (proposed, 13 decisions; Amends 0004, 0006, 0008 with the
  Workflow helper only, 0010, 0011, 0013, 0014, 0017, 0020, 0022, 0023, 0026; supersedes 0021); ADR
  0032, 0034, 0036. Open decisions inherited: the helper pick and the tick's prompt form, settled at
  phase 1's decision point (D-1), after which the record is revised.
