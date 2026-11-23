<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `roadmap-sessions-upfront` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec:
n/a (sources: `requirements.md`, ADR 0006, ADR 0010, ADR 0011, ADR 0013, ADR 0014, the archived
change `openspec/changes/archive/2026-11-22-roadmap-coordinator-followups/`). Opened by hand; not a
line of `openspec/roadmap.md`.

## Why

A session the roadmap run starts cannot run the devkit skill until the owner types `/devkit change
<id>` in it: the skill is owner-only (`disable-model-invocation: true`), and a message from another
session is no go-ahead. A run of ten changes would mean ten typed commands. The run also opens a
change only when a place is free, so the grills come one at a time, days apart. And a run leaves
work behind: on 2026-11-22 about 30 stale wait loops kept the app from archiving finished sessions.
The owner asked to fix all three (questions 1, 4 and 5 of the grill).

## What Changes

- **A change session runs from its first turn.** The roadmap run starts each change session with a
  one-use ticket in its task. A new model-invocable skill, `devkit-session`, runs that change's loop.
  A new hook on the Skill tool lets it run only in a session whose first message is the run's own
  start of that change, carrying the ticket the run recorded and nobody else claimed. The `devkit`
  skill stays owner-only. Recorded in a new ADR (number 0016 at the time of writing).
- **Every pending change opens at the run's start.** In the desktop app, `/devkit roadmap <n>` opens
  every unticked, unarchived line, each in its worktree and session, on the owner's typed turn.
- **The owner's gates of a change session move to the coordinating session.** The grill, the plan
  approval (with the plan's summary) and the retro answers are asked there, one change at a time.
  Each answer is written into that change's files. The change session waits in the background and
  goes on when its file changes. Other gates (a merge decision, a disputed review) stay in the change
  session. The grill's ambiguous point is resolved as (a): the retro answers move too.
- **A triage agent answers first.** A new read-only agent of devkit-core, `requirements-triage`,
  answers every grill question that the project's files settle, each answer with its source. This
  happens in every grill, roadmap or lone. Only the questions nothing written settles reach the
  owner. The loop asks the grill again while an answer by triage names no source.
- **Places count only the stages that load the machine.** In a run with a session per change, at
  most `<n>` changes are in the implementation, its gates, evidence or review. A change waiting for
  a place, for the load or for its `after:` dependencies shows ⏳ in its session title and waits in
  its own session.
- **A plan waits for its dependencies.** No plan file is written while an `after:` dependency is not
  archived. Then the change merges the default branch and writes its plan against that code.
- **Drift is resolved without the owner.** An ADR number a sibling merged first is renumbered by a
  new delivery step. The planner reopens the grill only when merged code contradicts a requirement.
- **The grill and the plan are pushed.** Once a change's grill is answered, and again once its plan
  is approved, its branch is pushed with those files.
- **A periodic check, and a cleanup at the end.** `/devkit roadmap` creates one session cron in the
  coordinating session, about every 30 minutes. Each firing has triage answer ahead, hands a freed
  place to a waiting change, stops stale wait loops and archives the sessions of archived changes.
  It says something only when something changed. It never approves a plan, answers a retro or starts
  a stage. The run's end deletes the check, stops the run's wait loops and archives the sessions of
  archived changes. A lone `/devkit change` schedules nothing.

## Acceptance criteria

- AC-1 `session-opens-running`: a change session the roadmap run starts runs its change's loop from its first turn, with no command typed by the owner in it.
- AC-2 `other-starts-refused`: a devkit run started by the model in any other session, or by a prompt that is not the roadmap run's start of that change, is still refused.
- AC-3 `every-pending-change-opens`: `/devkit roadmap` opens every pending change of the roadmap at its start, each in a session of its own, and the run's board lists them all.
- AC-4 `grills-in-roadmap-session`: every opened change's grill is asked in the roadmap session, one question at a time, naming its change, and its answers land in that change's `requirements.md`.
- AC-5 `triage-first`: in every grill, roadmap or lone `/devkit change`, the triage agent answers first each question the project's files settle; only crucial questions reach the owner, and each triage answer is recorded with its source and marked as answered by triage.
- AC-6 `triage-never-approves`: the triage agent never writes a plan approval or a retro answer, and a question nothing written settles always reaches the owner.
- AC-7 `approval-in-roadmap-session`: when a change's plan is ready, the roadmap session shows its summary and asks the owner; the owner's own typed answer there is recorded as that change's approval, and the change's session goes on from it.
- AC-8 `plan-after-dependencies`: a change whose `after:` dependencies are not archived writes no plan; once they are, its plan is written against the code of that day.
- AC-9 `places-load-only`: at most `<n>` changes are in implementation, gates, evidence or review at once; grills and plans run with no place.
- AC-10 `waiting-icon`: a change waiting for a place or for its dependencies shows ⏳ in its session title, and its stage icon again once it goes on.
- AC-11 `drift-without-owner`: a sibling merged first that takes the change's ADR number or release versions is resolved without asking the owner; the owner is asked again only when a merged sibling changes what a requirement says.
- AC-12 `branch-pushed-with-grill`: each opened change's branch is pushed with its `requirements.md` once its grill is answered, so another machine can take it.
- AC-13 `run-check-scheduled`: when `/devkit roadmap` starts a run, a periodic check of that run exists in the coordinating session; when the run ends or is stopped, it no longer exists.
- AC-14 `check-acts-not-approves`: a firing of the check answers what triage settles, gives a freed place to a waiting change, stops stale wait loops and archives the sessions of archived changes; it never writes a plan approval or a retro answer, and it says nothing to the owner when nothing changed.
- AC-15 `run-end-cleans-up`: after the run's last change is archived, no periodic check, no wait loop of the run and no open session of an archived change is left.
- AC-16 `lone-change-schedules-nothing`: a lone `/devkit change` run creates no schedule.

## Non-goals

- Running a change on another machine (`remote-worker`) and resolving release-file conflicts
  (`release-merge-conflict`); this change relies on the existing release step.
- A hook that refuses a hand-off to the implementer without a place: the place rule lives in the
  change session's loop and its stop lock (design D-7).
- Changing a run where the host cannot start sessions, beyond the triage, the periodic check and
  the push rules that apply to every run.
- The live checks of round 18c (`roadmap-live-checks`).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `roadmap-coordination`: every pending change opens at the start; the grill, approval and retro of
  a change session are asked in the coordinating session; places count the load stages only; the
  plan waits for its dependencies; ⏳; the grill and plan are pushed; the periodic check and the
  cleanup.
- `coordination-locks`: the entry of a started change session (the ticket); the stop of a change
  session waiting for a place; the triage hand-off of the coordinating session; the entry lock
  fails closed.
- `change-coordination`: the triage in every grill; an answer with no source returns the grill; a
  contradicted requirement reopens the grill; a lone change schedules nothing.
- `change-delivery`: an ADR number taken on the default branch is renumbered without the owner.

## Impact

- Surfaces: `plugins/openspec` (hooks, skills, schemas) and `plugins/core` (one new agent, the
  `requirements-grill` skill, the `change-planner` agent). Release: devkit-openspec 0.22.0,
  devkit-core 0.10.0, marketplace 0.26.0, `CHANGELOG.md`, `docs/catalog.md`, the CI pin.
- `plugins/openspec/hooks/guard.mjs`: the `skill` mode, the started task's shared reader, the
  lock routing of a change session's stop.
- `plugins/openspec/hooks/roadmap-loop.mjs`: the run file's new fields, the session mode of
  `decideRoadmap` and `boardOf`, the subcommands `session-next`, `session-wait`, `push`,
  `merge-base` and `check`, the entry decision, the session stop decision.
- `plugins/openspec/hooks/change-loop.mjs`: `waitLoop`'s wait predicate, the ⏳ icon, the triage
  source check, the `renumber-adr` row, new messages.
- `plugins/openspec/hooks/conduct-check.mjs`: the ADR number override.
- `plugins/openspec/hooks/hooks.json`: PreToolUse on `Skill`.
- Skills: `plugins/openspec/skills/devkit-session/SKILL.md` (new), `plugins/openspec/skills/devkit/SKILL.md`,
  `plugins/core/skills/requirements-grill/SKILL.md`. Agents: `plugins/core/agents/requirements-triage.md`
  (new), `plugins/core/agents/change-planner.md`.
- Schemas (both copies: `plugins/openspec/schemas/` and `openspec/schemas/`): the requirements helper
  and the grill rule; `openspec/config.yaml` (the grill rule and the ADRs line).
- Docs: the new ADR, Notes and header lines in ADRs 0006, 0010, 0011, 0013 and 0014,
  `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/roles.md`, `README.md`,
  `plugins/core/README.md`, `plugins/openspec/README.md`.
- Tests: `roadmap-loop.test.mjs`, `change-loop.test.mjs`, `conduct-check.test.mjs`, `guard.test.mjs`;
  nine existing tests change (design D-13).
- Dependencies: `roadmap-coordinator-followups` (archived). Siblings in flight may take the ADR number
  and the release versions first (ADR number at merge; the release step renumbers).
- Exit criteria: `node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate roadmap-sessions-upfront --strict` pass.
- Decisions cited: ADR 0006 (decisions 2 and 3), ADR 0010 (decisions 2, 3, 5 and 8), ADR 0011
  (decisions 1 and 2; its rejected fail-closed lock), ADR 0013 (decisions 3 and 4), ADR 0014
  (decisions 1 to 4; its rejected timer retry and message tool). Open decisions inherited: the new ADR
  needs the owner's acceptance with the plan; the exact input fields of `CronCreate`, `CronDelete`
  and `mcp__ccd_session_mgmt__archive_session` are assumed (design, Assumptions).
