<!-- devkit-stage proposal result=passed attempt=4 commit=123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0 -->
# Proposal

Change: `roadmap-sessions-upfront` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec:
n/a (sources: `requirements.md`, ADR 0006, ADR 0010, ADR 0011, ADR 0013, ADR 0014, ADR 0017, the
archived change `openspec/changes/archive/2026-11-22-roadmap-coordinator-followups/`). Opened by hand;
not a line of `openspec/roadmap.md`. Revised on 2026-11-23 after main brought `change-state` (ADR
0017) and `commit-attribution`: the ADR number, the release versions and the held state's derivation.
Revised again on 2026-11-23 after main brought `change-budget`, `jira-entry` and `delivery-models` (ADR
0018): the token budget in a change session, the ADR number 0019 and the release versions.
Revised a fourth time on 2026-11-23 after review round 1 (`review.md`): the fixes of its open
findings (design D-16, phase 7 of `tasks.md`); no criterion changes.

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
  skill stays owner-only. Recorded in a new ADR (number 0019 at the time of writing: 0016, 0017 and
  0018 went to `stage-roles`, `change-state` and `delivery-models`).
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
  its own session. That wait is the change's state, `running` with the reason of the wait, derived
  in the one place ADR 0017 derives every state, so the session title, `/devkit status` and the
  state command say the same; the new ADR amends ADR 0017 decision 4 for that title (⏳ and the id,
  the stage icon replaced).
- **The token budget holds in a change session.** The cap `change-budget` set on a `/devkit change`
  run also stops a change session of a roadmap run: its own next step counts the budget as the
  change loop's does, the stop stays in that session, and a change stopped in a building stage keeps
  its place. The coordinating session's reads still count no budget.
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
- **Fixes after review round 1.** A plan is pushed once per approval, so the implementer's ticks of
  `tasks.md` never ask for another push. The entry's hook decides only for the entry skill and lets
  every other skill through even when its script cannot load. A recorded wait loop is stopped only
  while its process is still a wait loop of the run. A change whose line left the roadmap or stopped
  being open frees its place. The check reads the triage section with the change loop's own reader.
  The started form is read past the notes the app puts before it, found in a real started session's
  first message. The change session declares its end when the merge of the default branch conflicts.
  The new ADR is accepted with this plan, records its exception to ADR 0004 and its amendment of ADR
  0010 decision 8 (the triage answers what the files settle in every grill), the implementer's
  renumbering of an ADR and the home of the change session's loop.

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
  plan waits for its dependencies; ⏳ and the held state, on the title, the board and the state
  command alike; the grill and plan are pushed, the plan once per approval; the periodic check and
  the cleanup, stopping only processes that are still wait loops of the run; a change no longer open
  holds no place.
- `coordination-locks`: the entry of a started change session (the ticket); the stop of a change
  session waiting for a place; the triage hand-off of the coordinating session; the entry lock
  fails closed; the started form read past the host's leading notes.
- `change-coordination`: the triage in every grill; an answer with no source returns the grill; a
  contradicted requirement reopens the grill; a lone change schedules nothing.
- `change-delivery`: an ADR number taken on the default branch is renumbered without the owner.

## Impact

- Surfaces: `plugins/openspec` (hooks, skills, schemas) and `plugins/core` (one new agent, the
  `requirements-grill` skill, the `change-planner` agent). Release: devkit-openspec 0.30.0,
  devkit-core 0.14.0, marketplace 0.34.0, `CHANGELOG.md`, `docs/catalog.md`, the CI pin `v0.30.0`.
- `plugins/openspec/hooks/guard.mjs`: the `skill` mode (the entry skill's name read before any
  import), the started task's shared reader (past the host's leading notes), the lock routing of a
  change session's stop.
- `plugins/openspec/hooks/roadmap-loop.mjs`: the run file's new fields, the session mode of
  `decideRoadmap` and `boardOf`, the subcommands `session-next`, `session-wait`, `push`,
  `merge-base` and `check`, the entry decision, the session stop decision, the token budget counted
  by `session-next`.
- `plugins/openspec/hooks/change-loop.mjs`: `waitLoop`'s wait predicate, the ⏳ icon, the held
  reasons of `changeState` and `runFactsOf`'s place fields, the plan-stage reader moved from
  `roadmap-loop.mjs`, the triage source check, the `renumber-adr` row, new messages.
- `plugins/openspec/hooks/conduct-check.mjs`: the ADR number override.
- `plugins/openspec/hooks/hooks.json`: PreToolUse on `Skill`.
- Skills: `plugins/openspec/skills/devkit-session/SKILL.md` (new), `plugins/openspec/skills/devkit/SKILL.md`,
  `plugins/core/skills/requirements-grill/SKILL.md`. Agents: `plugins/core/agents/requirements-triage.md`
  (new), `plugins/core/agents/change-planner.md`.
- Schemas (both copies: `plugins/openspec/schemas/` and `openspec/schemas/`): the requirements helper
  and the grill rule; `openspec/config.yaml` (the grill rule and the ADRs line).
- Docs: the new ADR (0020), Notes and header lines in ADRs 0004, 0006, 0010, 0011, 0013, 0014 and 0017,
  `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/roles.md`, `README.md`,
  `plugins/core/README.md`, `plugins/openspec/README.md`.
- Tests: `roadmap-loop.test.mjs`, `change-loop.test.mjs`, `conduct-check.test.mjs`, `guard.test.mjs`;
  existing tests change as design D-13 lists them (T-1 to T-17; T-17 is a test helper and
  the five tests that use it).
- Dependencies: `roadmap-coordinator-followups` (archived); `change-state` (merged into this branch
  at `b216a46`: `changeState`, `runFactsOf`, ADR 0017); `change-budget` (merged at `a9ecdc1`:
  `nextAction`'s `budget` option and the end `waiting-budget`); `delivery-models` (merged at `a9ecdc1`:
  ADR 0018). Siblings in flight may take the ADR number and the release versions first (ADR number at
  merge; the release step renumbers).
- Exit criteria: `node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate roadmap-sessions-upfront --strict` pass.
- Decisions cited: ADR 0004 (the hooks outside a devkit project; amended for the entry skill only),
  ADR 0006 (decisions 2 and 3), ADR 0010 (decisions 2, 3, 5 and 8; decision 8's sentence on the
  grill answers amended for what the files settle), ADR 0011
  (decisions 1 and 2; its rejected fail-closed lock), ADR 0013 (decisions 3 and 4), ADR 0014
  (decisions 1 to 4; its rejected timer retry and message tool), ADR 0017 (decisions 1, 2 and 4;
  decision 4 amended for a held change session); not an ADR, change-budget's design D-4, whose
  `next`-only count this change extends to a change session's `session-next`, the roadmap
  coordinator's reads still counting nothing. Open decisions inherited: the new ADR
  is accepted with the owner's approval of this revised plan (design D-12, task 7.9); the exact input fields of `CronCreate`, `CronDelete`
  and `mcp__ccd_session_mgmt__archive_session` are assumed (design, Assumptions).
