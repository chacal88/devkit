# ADR 0020: The model is chosen by stage, sessions only step down and never below the stages they still run, and a failed stage is retried once a model up

- Status: accepted
- Status: Accepted by: the owner, on 2026-11-23, in the approval of the plan of change stage-models (openspec/changes/stage-models/approval.md)
- Date: 2026-11-23
- Change: stage-models
- Amends: ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decision 1, what the
  coordinating session does to a change session it started

## Context

The first two-machine roadmap run (2026-11-23) spent the owner's credits: every session, each change
session and the coordinating one, ran on the default `opus[1m]`, although 16 of the 18 devkit agents
already declare Sonnet in their frontmatter. The spend was the sessions themselves, reading
transcripts, resolving merges and writing reports, with a context that grows all day. The owner
asked that the model be chosen automatically by stage, never by the owner: Opus where judgement
weighs, Sonnet to coordinate, implement, review and deliver, Haiku for mechanical work.

ADR 0010 decision 1 puts the project's settings in the `devkit:` block of `openspec/config.yaml`,
and decision 4 makes each stage a subagent of the change coordinator in the Claude driver. ADR 0014
decision 1 has the coordinating session start each change session of a roadmap run in the desktop
app; it says nothing about that session's model. The host lets a session switch another session's
model, with no prompt when the target is cheaper, and refuses a switch of the calling session's own
model. ADR 0010 decision 3 keeps no stored log and counts attempts from the files; the loop has no
retry for a stage subagent that returns `Outcome: failure`, which ends the run blocked
(`role-failed`).

## Decision

1. **A stage-to-model table.** The `models:` key of the `devkit:` block of `openspec/config.yaml`
   maps a stage to a model family (`opus`, `sonnet`, `haiku`); the loop code holds a built-in
   default for every stage, and the `devkit:` block of a change's `.openspec.yaml` overrides single
   stages, as `budget` does. The default: Opus for the grill, the plan and the ADRs; Sonnet to
   coordinate, implement, review and deliver; Haiku for the commit and pull-request hand-off, the
   unit-test run and validation. An unknown stage or value is refused with `setting-unknown`. The
   exact key set (the schema's artifact ids plus `implement`, `deliver` and `archive`, or the agent
   names) is the plan's.
2. **No 1M context by default.** No default row uses a `[1m]` variant; a table value may carry
   `[1m]` on `opus` or `sonnet` as an explicit per-stage opt-in. A long session relies on the
   host's compaction.
3. **The model is part of the loop's contract.** Every `agent` action that `next` prints carries a
   `model` field, and the session passes it on the Agent call, overriding the agent's frontmatter
   model.
4. **Sessions only step down, never below the stages they still run** (amends ADR 0014 decision 1;
   the step-down floor is the owner's choice of 2026-11-23). A change session performs some stages
   itself: the grill, the owner's approvals, the review round, the retro and the delivery steps
   (its session-run stages); the others run as stage subagents. In a roadmap run with a session per
   change, the coordinating session starts a change session on the model of the change's first
   stage. When the change's stage changes, it switches that session down only to the strongest
   model among the new stage and the session-run stages still ahead of it (the floor), and only
   when that model is cheaper than the session's current one. In practice a change session does
   not go from Sonnet to Haiku while any session-run stage remains; the table's Haiku rows apply
   only to stages that run as stage subagents. A stage whose table model is above the session's
   current model runs as a stage subagent on that model, never as an upward switch; no session is
   ever switched up, so no confirmation is asked. A lone `/devkit change` keeps the model it was
   opened with; only its stage subagents follow the table. The coordinating session's own model
   stays the owner's choice in the app.
5. **One retry a model up.** A stage subagent that returns `Outcome: failure` on Haiku or Sonnet is
   handed again once on the next family up (Haiku to Sonnet, Sonnet to Opus). A second failure, or
   a failure on Opus, ends the run blocked with `role-failed`, as today. The retry is derived from
   the transcripts, with no new stored state, and its tokens count toward `budget`.
6. **The spend is read, not stored.** `flow-check` and `/devkit status` report tokens per stage and
   per model, the retries and the total against the `budget` cap, read from the session and
   subagent transcripts; nothing is written to the change.
7. ADR 0014's other decisions, and ADR 0010's, are unchanged.

Note (stage-models, 2026-11-23): decision 5's retry reaches a stage subagent
that stops with `Outcome: failure` without writing its stage file. A subagent that writes its
stage file with `result=failed`, as the `subagent-stop` hook asks of one that stops without it,
is a failed stage and takes the stage's existing fix path, with no retry. Decision 2's `[1m]`
opt-in reaches a session's own model and the retry's mapping, never a stage subagent: the Agent
call takes no suffix. So the Consequences' mitigation "one retry a model up" reaches only an
agent that cannot finish; a stage agent that obeys the hook and records `result=failed` takes the
fix path, bounded by the stage's ceiling. No decision's text changes.

## Consequences

- Positive: most of a run's tokens move from Opus to Sonnet and Haiku; the table is tuned in one
  key, per project or per change, and the readout shows where the spend went; no session is ever
  switched up, so the owner is never asked to confirm a more expensive model.
- Negative: a stage on a cheaper model may fail where Opus would not (Mitigated: one retry a model
  up, counted in `budget`). Not all stage work runs in subagents: the session-run stages are the
  change session's own turns, so the floor keeps the session on Sonnet or above until the last of
  them, and a change session saves less than a step to Haiku at the first mechanical stage would
  (Accepted: the grill, the approvals, the review round, the retro and the delivery steps are not
  done on Haiku). Mechanical stages between session-run stages run as Haiku subagents while the
  session stays on its floor (Accepted: their work is done on the table's model). A session-run
  stage whose table model is above the session's floor, such as the grill on Opus after a step
  down, is performed by the session on its current model, because no session is switched up
  (Accepted: no upward switch means no confirmation; the floor is set from the stages ahead, so
  this happens only when the table puts a stronger session-run stage after a weaker one). The
  start tool's `model` field is capped at the family of the session that starts it, and a higher
  model is ignored, so a coordinating session on Sonnet cannot open a change session on Opus for
  its grill (Accepted: the fix is to open the coordinating session on the stronger model, which is
  the owner's choice in the app and out of this change's scope). Without the 1M variant a long
  session compacts sooner (Mitigated: the per-stage `[1m]` opt-in). The `next` JSON gains a field
  every driver must pass on (Accepted: drivers that ignore it run the agent's frontmatter model, as
  before). The switch tool, the start tool's cap and the model on each transcript message are the
  host's, which it may change (Accepted: a refused switch leaves the session on its current model,
  which only costs more).

### Review trigger

The host lets a session switch its own model, asks for confirmation on a cheaper switch, or lifts
the start tool's cap at the starting session's family; a session-run stage is moved to a subagent
or a subagent stage to the session; a
retried stage fails on its stronger model in more than a few runs; the readout shows a default row
whose spend or failure rate calls for another family; a model above Opus or a new family is
wanted.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep each agent's frontmatter model and the session's default | Nothing to build | The spend was the sessions, which the frontmatter does not reach; the owner asked for a choice by stage | low |
| The owner picks the model per change or per run | Full control | The owner asked never to choose; a run would wait on the question | low |
| Switch sessions up and down with the stage | One session always on its stage's model | An upward switch asks the owner to confirm, which stops an unattended run | medium |
| Step the session down to each new stage's model, with no floor | The most savings on a session | A session on Haiku would then perform the review round, the retro and the delivery steps itself, since it is never switched up; the owner chose the floor | low |
| A per-change cost or size heuristic | Could save more on small changes | Hard to predict and test; out of scope by the owner's request | medium |
| The 1M variant by default | Fewer compactions | Its price is what the run spent; the owner chose it as an opt-in | low |
| Retry on the same model, or never retry | Simpler | The same model tends to fail the same way; no retry turns a cheaper model's miss into a blocked run | low |
| Store the spend in a file of the change | A history to read later | A stored log ADR 0010 decision 3 rejects; the transcripts already hold the model and tokens | low |
