<!-- devkit-stage proposal result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Proposal

Change: `stage-models` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`, with the answers the coordinating session gave on the owner's instruction;
`decisions.md` and ADR 0022; the `stage-models` line of `openspec/roadmap.md`, round 25f).

## Why

The first two-machine roadmap run spent the owner's credits: every session, each change session and
the coordinating one, ran on the host's default `opus[1m]`, although 16 of the 18 devkit agents
declare Sonnet. The spend was the sessions themselves. Nothing in devkit chooses a model today: the
loop's hand-offs carry none, a change session starts on the host's default, and a stage that fails
ends the run. The owner asked that the model be chosen by stage, never by the owner (ADR 0022).

## What Changes

- A stage-to-model table: `models:` in the `devkit:` block of `openspec/config.yaml`, overridden
  per stage by a `models:` entry in the `devkit:` block of a change's `.openspec.yaml`, over a
  built-in default (Opus for the grill, the plan and the ADRs; Sonnet to coordinate, implement,
  review and deliver; Haiku for the commit and pull-request hand-off and the unit-test run). The
  keys are the stage ids of the `devkit` and `devkit-lite` scripts; the values are `opus`, `sonnet`,
  `haiku`, `opus[1m]` and `sonnet[1m]`. An unknown key or value is refused with `setting-unknown`.
- Every action of `change-loop.mjs next` whose stage has a row carries a `model` field; the `devkit`
  skill passes it on every Agent call, so a stage subagent runs on its stage's model whatever the
  session's own model.
- A stage subagent that returns `Outcome: failure` on Haiku or Sonnet without writing its stage file
  is handed once more on the next family up (one that records `result=failed` in its stage file takes
  the stage's existing fix path, with no retry); a second failure, or one on Opus, ends the run blocked (`role-failed`), now decided by
  the loop instead of declared by the session. The retry is read from the session's transcripts.
- In a roadmap run with a session per change, the `session-start` action's `input` holds the model
  of the change's current stage, and a new `session-model` action steps a change session down to
  its floor: the strongest model among the change's current stage and the session-run stages still
  ahead of it (the grill, the owner's approval, the review round, the delivery steps and the retro),
  only when that floor is cheaper than the session's model. With the default table a change session
  steps down once, from Opus to Sonnet at its first Sonnet stage after the grill, and never to Haiku; the table's Haiku rows
  apply only to the stages handed to subagents. No session is ever switched up: a stage above the
  session's model runs as a stage subagent on its model. A lone `/devkit change` never switches its
  own session.
- A read-only spend readout: `flow-check.mjs <id>` and `/devkit status` print tokens per stage and
  per model, the retries and the total against the `budget` cap, from the session and subagent
  transcripts; nothing is written.
- Docs (`docs/openspec-flow.md`, `docs/coordination-design.md`, the ADR 0014 Note), the
  `openspec/config.yaml` comment and ADR list, and a release of devkit-openspec.

Non-goals: everything under "Out of scope" in `requirements.md` (the coordinating session's own
model, a choice by anything but the stage, a model above Opus, switching a lone change's session,
a status bar, writing the spend to a file). Also not here: `project-loop.mjs`'s hand-offs (they
keep their agents' frontmatter models), the review round's reviewers (their models stay in their
frontmatter), the CompozyOS driver, and the agents' own `model:` lines. The one effect on
`/devkit project` is intended: like every project setting, a bad `models:` table in
`openspec/config.yaml` makes it answer `setting-unknown` before it starts (`design.md` D-2).

## Host tools

Checked live by the conducting session on 2026-11-23 (`design.md` Context, A-1 and A-2):

- `mcp__ccd_session__start_session` has an optional `model` field, honoured for a `fresh` context
  only (the loop's start always sends `fresh`) and only for a model of the coordinating session's
  family or cheaper; a higher one is ignored. So a change session starts on its stage's model when
  the coordinating session runs on that model or a stronger one; otherwise it starts on the host's
  default, and the first stage whose floor is cheaper switches it down (`design.md` D-6). The cap
  stays: a coordinating session on Sonnet cannot open a change session on Opus for its grill; the
  fix is to open the coordinating session on the stronger model, the owner's choice in the app and
  out of this change's scope (ADR 0022 Consequences).
- `mcp__ccd_session_mgmt__set_session_model` takes `session_id` and `model`, is refused for the
  calling session, and asks the user before a switch to a more expensive model. The loop only
  returns cheaper switches, so it asks nothing.
- Not yet checked: the Agent tool's `model` parameter overriding an agent's frontmatter model (A-3).
  Task 1.1 probes it with one real Agent call before any code; a failed probe stops the change for a
  plan revision.

## The step-down floor

Decided by the owner on 2026-11-23, answering the escalation raised with this plan, and recorded
in ADR 0022 decision 4 and its Consequences by the adr-author: a change session in a roadmap run
never steps below the strongest model among the session-run stages still ahead of it. The
session-run stages are the ones the change session performs itself: the grill (`requirements`), the
owner's approval (`approval`), the review round (`review`), the delivery steps (`delivery`) and the
retro (`retro`); every other stage runs as a stage subagent. So the table's Haiku rows apply only to
stage subagents (the unit-test run, the commit and pull-request hand-off), and a stage whose model is
above the session's current one runs as a stage subagent on that model, never as an upward switch
(a session-run stage above it is performed on the session's model, the case ADR 0022's
Consequences accept). The rule lives in one function, `stepDownOf` (`design.md` D-6).

## Acceptance criteria

From `requirements.md`, with their ids. AC-1 to AC-9 and AC-11 to AC-13 are the owner's text as
written; AC-10 is not: its line below is the design's narrowed reading of the owner's AC-10, which
the owner accepts at plan approval with the other resolved readings listed after the criteria.

- AC-1 `default-table`: with no `models:` key, `next` for each stage of a change returns the model the built-in default names (Opus for the grill, plan and ADR stages, Sonnet for implement, review and deliver, Haiku for the commit hand-off, unit-test run and validation).
- AC-2 `config-table`: a `models:` entry in the `devkit:` block of `openspec/config.yaml` changes the model `next` returns for that stage, and the same entry in the change's `.openspec.yaml` wins over the project's.
- AC-3 `invalid-refused`: an unknown stage or an unknown model value in `models:` makes `start` and `next` exit 3 with `setting-unknown`, naming the setting and the accepted values.
- AC-4 `one-million-opt-in`: no default row uses a `[1m]` variant; a `models:` value of `opus[1m]` or `sonnet[1m]` is accepted and returned as written, and `haiku[1m]` is refused.
- AC-5 `agent-model`: every `agent` action printed by `next` carries a `model` field, and the skill text tells the session to pass it on the Agent call.
- AC-6 `session-start-model`: in a roadmap run (`--change-sessions`), the `session-start` action's `input` holds the model of the change's first stage.
- AC-7 `session-step-down`: when a change's stage changes in a roadmap run, the roadmap loop returns a switch action only when the new stage's model is cheaper than the session's current one; it never returns a switch to a more expensive model.
- AC-8 `upward-stage-subagent`: a stage whose model is above the session's current one is returned as an `agent` action with that model, never as a session switch.
- AC-9 `lone-change`: `/devkit change` alone never calls the session-model tool; only its `agent` actions carry models.
- AC-10 `retry-one-step-up`: after one `Outcome: failure` of a stage subagent on Haiku or Sonnet that wrote no stage file, `next` returns the same stage on the next family up; a second failure, or a first failure on Opus, ends the run blocked with `role-failed`; a subagent that recorded `result=failed` in its stage file gets the stage's existing fix hand-off, not a retry.
- AC-11 `retry-counted`: the retry's tokens are in the `budget` count and in the spend readout, marked as a retry.
- AC-12 `spend-readout`: `flow-check` and `/devkit status` print tokens per stage and per model, the retries and the total against the `budget` cap, and write no file.
- AC-13 `real-run-proof`: the change's real-run proof covers a lone change and a roadmap run on at least two stages with different models, each shown in the transcripts' model fields, plus one retry; the guard test suite passes.

Four criteria and two readings of ADR 0022 are resolved by the design, and the evidence is checked
against the resolved wording below; the owner accepts each at plan approval or names another
reading:

- AC-1, "validation": no stage of either script is validation. The `openspec-validator` helper runs
  inside the plan stages and already declares `model: haiku`, so AC-1's "validation" is met by that
  helper and gets no row of the table; AC-1 is checked over the 16 rows of `design.md` D-1, the
  commit hand-off being the `delivery` row and the unit-test run the `unit-tests` row.
- AC-3, "`start` and `next` exit 3": `start` answers every settings problem today with exit 0 and
  the mode `setting-unknown` (its reply names the setting and the accepted values, and it creates
  nothing); the design keeps that contract. AC-3 is checked as: `start` (and `open`,
  `/devkit roadmap`, `/devkit status`, `/devkit project`) answers mode `setting-unknown` naming the
  setting and the accepted values and creates nothing, and `next` exits 3 with that reply
  (`design.md` D-2; spec `stage-models`, "An unknown stage in the project's table" and "An unknown
  value in the change's table").
- AC-7, "a switch action only when the new stage's model is cheaper": the owner's step-down floor of
  2026-11-23 (above) narrows it. AC-7 is checked as: the roadmap loop returns a switch only when the
  floor (the strongest model among the new stage and the session-run stages still ahead of it) is
  cheaper than the session's current model, the switch's target is that floor, and it never returns
  a switch to an equal or more expensive model. A switch so returned is still only to a model cheaper
  than the session's, and the new stage's model is never above its target (`design.md` D-6; spec
  `roadmap-coordination`, "A change session only steps down").
- AC-10, narrowed (review round 1). The owner's text (`requirements.md` AC-10) retries "one
  `Outcome: failure` of a stage subagent on Haiku or Sonnet" with no condition. The design narrows
  the trigger to a stage subagent that stopped with `Outcome: failure` and wrote no stage file (an
  agent that could not finish); one that recorded `result=failed` in its stage file, as the
  `subagent-stop` hook asks of an agent that stops without it, is a failed stage and gets the
  stage's existing fix hand-off (the implementer's `fix-tests` after a test stage, a revision after a
  plan stage) on that action's table model, with no retry. Since a real agent usually obeys the hook,
  the retry reaches fewer failures than the owner's text suggests: a red Haiku unit-test run goes to
  the implementer's fix, not to a Sonnet rerun. AC-10 is checked as its line above says (`design.md`
  D-5 "The retry's reach"; spec `stage-models`, "Only a stage subagent that could not finish is
  retried"; the real run 3 of `design.md` D-13).
- ADR 0022 decision 5, read. "A stage subagent that returns `Outcome: failure` on Haiku or Sonnet is
  handed again once on the next family up" is read as AC-10 above: only an agent that stopped
  without writing its stage file. The ADR's Consequences mitigation "one retry a model up" therefore
  reaches only an agent that cannot finish; a stage that records `result=failed` is mitigated by its
  fix path and its ceiling instead. The ADR's Note states this reading and changes no decision
  (`design.md` D-10, task 5.3).
- ADR 0022 decision 2, read. The `[1m]` opt-in reaches a session's own model (a change session's
  start model or a step-down to that value) and the retry's mapping on the action, never a stage
  subagent: the Agent call drops the suffix (built in task 1.5), so a stage agent whose row is
  `opus[1m]` runs with the plain family's context window. The ADR's Note states this reading too
  (`design.md` D-10, task 5.3).

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate stage-models --strict`.

## Capabilities

### New Capabilities

- `stage-models`: the stage-to-model table, its default, its override and refusals, the `model`
  of the loop's actions, and the one retry a model up for a failed stage subagent.
- `spend-readout`: the read-only report of a change's tokens per stage and per model, its retries
  and its total against the budget, in the stage readout and the status board.

### Modified Capabilities

- `change-coordination`: a failed stage agent is no longer an end the session declares; the loop
  decides it (MODIFIED "Every end of a run is marked in the session's record").
- `roadmap-coordination`: a change session starts on its stage's model and only steps down, never
  below the session-run stages still ahead of it, and a stage above its model never switches it
  (four ADDED requirements); a stage failure stops a change only after its retry (MODIFIED "A blocked
  change keeps its place").

## Impact

- `plugins/openspec/hooks/guard.mjs`: the `models:` block of the settings parser; one reader of a
  subagent transcript; the spend reader and its lines; `budgetValue`, moved from
  `change-loop.mjs`.
- `plugins/openspec/hooks/change-loop.mjs`: the table, its checks, the `model` field, the retry in
  the decision, the messages, the run file's model of a change session.
- `plugins/openspec/hooks/roadmap-loop.mjs`: the start's model, the step-down floor
  (`stepDownOf`), the `session-model` action, the spend block of the board.
- `plugins/openspec/hooks/flow-check.mjs`: the spend block of the readout.
- `plugins/openspec/skills/devkit/SKILL.md`: the Agent call's model, a failure goes back to `next`,
  the `session-model` action.
- Tests: a new `plugins/openspec/hooks/stage-models.test.mjs` imported by `guard.test.mjs`; the
  existing tests `design.md` D-11 names in `change-loop.test.mjs`, `roadmap-loop.test.mjs` and
  `flow-check.test.mjs`.
- Docs and release: `docs/openspec-flow.md`, `docs/coordination-design.md`,
  `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md` (header and Note),
  `docs/adr/0022-the-model-is-chosen-by-stage.md` (the clarifying Note of task 5.3; its number moves
  to the next free one at the delivery merge, `design.md` D-10),
  `openspec/config.yaml` (comment and ADR list), `CHANGELOG.md`, devkit-openspec's `plugin.json` and
  `.claude-plugin/marketplace.json`.
- Dependencies: `change-budget` (archived 2026-11-23; its count and transcript lookup are reused).
  Decisions cited: ADR 0022 (this change's, proposed), ADR 0010, ADR 0011, ADR 0013, ADR 0014.
  Open decisions inherited: none (this repository keeps no open-decisions log;
  `docs/coordination-design.md` "Open points" holds none on models). Open in this change: none (the
  step-down floor was decided by the owner on 2026-11-23, "The step-down floor" above).
