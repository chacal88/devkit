<!-- devkit-stage proposal result=passed attempt=6 commit=e523e62479ba8edb93e6ca6783451bf7dfbbaa61 -->
# Proposal

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`requirements.md` at attempt 7, `decisions.md`, `release.md`, the phase 1 proof under `proof/`).
This revision follows phase 1's decision point, "stop and revise" (`proof/decision.md`), and folds in
probe 2's result (`proof/p2-result.md`). Base: `origin/main` at `6f03a57`; the
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
  queue and, on that typed turn, installs one task of the project. The task never removes itself (the
  host takes a delete, pause or run only from the owner's click, `proof/p0-delete.md`): after `stop`
  or the tick that finds the roadmap done, the run records its end, the hook blocks every later
  firing before the model, and the one owner list says once that the owner deletes the task with one
  click in the app.
- **An empty tick costs no model call** (decision 2): a `UserPromptSubmit` hook,
  `plugins/openspec/hooks/tick-gate.mjs`, blocks the task's envelope when nothing is ready and after
  the run's end, reading only files and starting no process; on a firing it lets through it adds the
  tick's note (the session id, the pack's live paths, the `tick` call), since a slash command in a
  task's prompt does not run (probe 2); every other prompt passes. Before phase 4, three headless
  runs with the real hook in a scratch project measured the block at 0 turns, 0 tokens and cost 0,
  and a control run's note reached the model (task 3.6, `proof/p5-empty-tick.md`). A real scheduled
  firing is measured only in the phase 6 run on the owner's Mac (task 6.1, after phases 4 and 5): a
  firing that does not pass through `UserPromptSubmit`, a blocked firing the app counts as a model
  call, or a note that does not reach a task's session sends the plan back to planning, readiness
  and approval from there; until then the prompt's second line bounds a firing the hook does not
  stop to one model call.
- **A tick claims one item and drives it from its own session** (decisions 3, 4): a run-file claim
  with a heartbeat, taken under the lock (a run's status is no lock, probe 2); the tick's session is
  the helper: it runs `change-loop.mjs` in the change's worktree to its next wait, hands each stage
  to its role one level below it in the background (ending its turn and woken by each notice), runs
  the review bench as the `review-change` Workflow, records the wait and releases the claim. No agent
  helper and no entry skill is added. A tick's session is known to the locks by its scheduler
  envelope. Gate files and answers are written only in a tick's sweep or by the owner, never in the
  drive that reached the gate.
- **No owner box per change** (decisions 5 to 7): the grill is answered by the triage agent and the
  owner's new `openspec/standing-answers.md`; what needs the owner (a blocked end included) is one
  line in the run file, shown in the typed session and `/devkit status` and pushed once; a delegated
  gate is recorded with the quoted answer. The grill rule of `openspec/config.yaml` and the four
  `schema.yaml` copies is amended for exactly this.
- **The coordinator's hand work becomes the conductor's** (field facts of 2026-11-28): request files,
  a five-minute task with a sweep, a 12-line approval summary, the sibling order, the train's
  dispatch, the check before an opening, the escalation's re-hand, the split over machines by the
  pushed branch, kept conservative: a machine the app reaches as an SSH host holds no task, so a
  tick opens every item on its own machine, and a change claimed by another machine is driven here
  only from its pushed branch once that claim is released, or not at all.
- **The conductor owns the machine's test capacity** (decision 13): one whole suite at a time per
  machine, the train's first; while the train departs no other test run starts (the gates wait);
  gates and files at once capped by two new settings (`test_gates`, `test_concurrency`) through
  `roadmap-loop.mjs test-run`; places count test-loading stages only. In a conducted run a pull
  request whose files are all under `openspec/` (an archive, a roadmap edit) boards no train and
  merges on its required checks (field fact 12).
- **BREAKING: the change sessions go** (decision 8): the start tickets, the run-file fields
  `tickets`, `changeSessions`, `startedSessions`, `turn`, `cron`, `check`, the verbs `session-next`,
  `session-wait`, `check`, the `session-start` action, `--change-sessions`, `--cron`, the
  `devkit-session` skill and its entry guard, the session cron and the session-model switches.
  `placed` and `checkout` stay (ADR 0020).

Unchanged: the CompozyOS verbs and `.compozy/` (decision 11); a lone `/devkit change`. Non-goals:
capping a lone change's tests; parsing `<name>` and `round <k>` (`multi-roadmaps`); work on another
machine over SSH; a phone channel beyond the host's notification tool; removing `decideRoadmap` and
`next`; editing the roadmap items `roadmap-run-opens-sessions` and `roadmap-live-checks` (escalated);
removing, pausing or running a scheduled task from any session (the host refuses it unattended);
placing a change on another machine in a conducted run; a new entry skill for the tick.

## Acceptance criteria

- AC-1 `first-real-run`: before the design is final, `evidence.md` (or the change's `proof/`) holds one real run showing a scheduled task of the project opening a session in which the devkit plugin's hooks fire, and the measured cost of one empty tick (tokens or model calls) with the refusal hook in place.
- AC-2 `one-typed-command`: `/devkit roadmap <name> [round <k>] [<n>]` typed once records the queue in the run file and creates exactly one scheduled task of the project; typing it again while the task exists creates no second task.
- AC-3 `empty-tick-refused`: a tick firing when no item is ready is blocked by the `UserPromptSubmit` hook before any model call; a test feeds the hook the tick's envelope with an empty-ready run file and gets `{"decision":"block"}`, and feeds it any other prompt and gets no output.
- AC-4 `tick-claims-one`: a tick with a ready item records a claim for exactly one item in the run file, runs that change's loop through a helper in the change's own worktree up to its next wait, records the state and ends; a second tick during a live claim leaves that item alone.
- AC-5 `resume-from-files`: the next tick goes on from the files (the change folder and the run file) with no state carried in a session; killing a helper mid-stage leaves a stale claim the next tick takes over.
- AC-6 `no-owner-box`: no helper calls AskUserQuestion or opens a session; a grill is answered from the triage agent and `openspec/standing-answers.md`, each answer naming its source.
- AC-7 `waits-for-owner-one-place`: a gate that needs the owner (plan approval, retro answers, anything not delegated) becomes one `waits-for-owner` line in the run file, shown by `/devkit status` and in the session the owner typed in; the owner's typed answer there is recorded and the next tick goes on.
- AC-8 `delegation-quoted`: a gate the standing answers delegate is recorded with the quoted standing answer as its words; a gate not delegated is never recorded by the conductor.
- AC-9 `task-ends-blocked`: after `/devkit roadmap stop` or the tick that finds the roadmap done, the run records the end and the tick hook blocks every later firing of the task before the model; the conductor says once, in the one owner list, that the owner deletes the task with one click in the app (the host refuses an unattended delete, pause or run: `proof/p0-delete.md`).
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
- AC-22 `test-capacity`: on one machine at most one whole-suite run is in flight at a time, the train's run first; concurrent gates and each gate's `--concurrency` are capped by values the run file records; a stage agent's brief carries the cap; a run's places count the changes in a test-loading stage, not sessions. While a train departs, no other test run of the machine starts (gates wait); a pull request whose files are all under `openspec/` (an archive or a roadmap edit) boards no whole-suite train and merges on its required checks (field fact 12).

Exit criteria: every phase gate (`node scripts/test-suite.mjs --own-files && python3 scripts/check.py`)
passes; `claude plugin validate .`, `python3 scripts/gen-catalog.py --check` and
`node plugins/compozy/kit/scripts/gen-agents.mjs --check` exit 0; `openspec validate helper-conductor
--strict` passes; the real-run proofs of phases 1 (`p0-delete.md`, `p1-hooks.md`, `p2-result.md`),
3 (`p5-empty-tick.md`) and 6 (`run-1.md` to `run-5.md`) are under `proof/`.

## Capabilities

- New: `roadmap-conductor` (the task, the tick and its hook, claims, helpers, owner lines, standing
  answers, request files, train dispatch, precheck, re-hand, machine split, test capacity, the
  `openspec/`-only pull request).
- Modified: `roadmap-coordination` (session-per-change, periodic check and session models removed;
  places, stop, end, resume, board, machines restated); `coordination-locks` (the entry guard
  removed; stop and hand-off locks for the typed and tick sessions); `change-state` (claims, queue and
  owner lines as run facts); `change-coordination` (a conducted grill); `stage-models` (a helper's
  model).

## Impact

- `plugins/openspec`: `hooks/{roadmap-loop,run-file,guard,change-loop,deliver-check}.mjs`,
  `hooks/hooks.json`, new `hooks/{tick-gate,standing-answers,request-file,test-slots}.mjs`,
  `.claude-plugin/plugin.json`, `skills/devkit/SKILL.md` (the tick's drive), `skills/ship-change/SKILL.md`,
  removed `skills/devkit-session/`, `schemas/*/schema.yaml`, `README.md`. No agent file and no skill
  is added.
- `plugins/core`: `skills/requirements-grill/SKILL.md`; `skills/review-change/SKILL.md` ("Which path
  runs"). Repository: `scripts/test-suite.mjs`,
  `scripts/test-map.json`, `openspec/config.yaml`, `openspec/schemas/*/schema.yaml`, `docs/`
  (flow, coordination design, roles, generated catalog), the ADRs of D-16. None: `plugins/compozy`,
  `.compozy/`, `plugins/panel`.
- Dependencies: `multi-roadmaps` (not merged); the host's scheduled tasks (phase 1: P-0, P-1, probe
  2, all run); the blocked tick and the note with the real hook, headless (task 3.6, done); the
  scheduled firing's cost, the note in a task's session, the hook's payload form, the cron, the
  notification tool and two runs at once (task 6.1).
- Decisions cited: `ADR [helper-conductor]` (13 decisions; Amends 0004, 0006, 0008 decision 1 for a
  roadmap run's review round, 0010, 0011, 0013, 0014, 0017, 0020, 0022, 0023, 0026; supersedes 0021),
  revised by the adr-author with this revision; ADR 0032, 0034, 0036. Settled by probe 2 (D-1): the
  prompt form S-B with no entry skill, the envelope, background hand-offs, the review round's
  Workflow. Settled headless by task 3.6: a blocked tick costs no model call and the note reaches
  the session. Open decisions inherited: on a real scheduled firing, the cost of a blocked firing,
  the note's arrival, the hook's payload form, the cron and the notification tool, settled by task
  6.1 after phases 4 and 5; its stop-and-revise case can still send the plan back (the residual risk
  `design.md` D-1 accepts).
