<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> asked by the owner on 2026-11-23, when the credits ran low after the first two-machine roadmap run: every session of that run (each change's session and the coordinating one) ran on the default `opus[1m]`, although 16 of the 18 devkit agents already declare Sonnet; the spend was the sessions themselves, reading transcripts, resolving merges and writing reports, with a context that grows all day. The model is chosen automatically by stage, never by the owner: Opus where judgement weighs (the grill, the plan, the ADRs), Sonnet to coordinate, implement, review and deliver, Haiku for mechanical work (commit, running suites, validation); a roadmap run starts each change session on the model of its stage and switches it when the stage changes, and a lone `/devkit change` does the same. In the grill: where the stage-to-model table lives (the `devkit:` block of `openspec/config.yaml`, with a default), whether the 1M-context variant is used at all, how a stage that fails on a cheaper model is retried on a stronger one, and how `change-budget`'s count reports the spend per stage so the table can be tuned.

## Assumptions

<!-- Each confirmed by the owner (answers 1-6 delegated by the coordinating session, per the owner's instruction of 2026-11-23). Literal paths, fields, names. -->
- Classification: domain=process, type=feature, flags=[architecture, contract] (strict-assumed): the `next` action JSON of `plugins/openspec/hooks/change-loop.mjs` and `plugins/openspec/hooks/roadmap-loop.mjs` gains model fields, and `openspec/config.yaml` gains a key.
- A session cannot switch its own model (`mcp__ccd_session_mgmt__set_session_model` refuses the calling session). Another session can switch it, with no prompt when the target is cheaper. A `/devkit change` typed alone keeps the model it was opened with; only its stage subagents follow the table.
- The table is the `models:` key of the `devkit:` block of `openspec/config.yaml`, mapping a stage to a model family (`opus`, `sonnet`, `haiku`) with a built-in default in the loop code; the `devkit:` block of the change's `.openspec.yaml` overrides single stages, as `budget` does. An unknown stage or value is refused with `setting-unknown`.
- Built-in default: Opus for the grill, the plan (proposal, specs, design, tasks) and the ADRs; Sonnet to coordinate, implement, review and deliver; Haiku for the commit and pull-request hand-off, the unit-test run and validation. AMBIGUOUS: (a) the table's keys are the schema's artifact ids plus `implement`, `deliver` and `archive` | (b) the keys are the agent names; the planner resolves.
- The 1M-context variant is off by default; a table value may carry the suffix `[1m]` (`opus[1m]`, `sonnet[1m]`) as an explicit per-stage opt-in. A long session relies on the app's compaction.
- Every `agent` action of `next` carries a `model` field, and the Agent hand-off passes it, overriding the agent's own frontmatter model. In a roadmap run `roadmap-loop.mjs` puts the model of the change's first stage in the `input` of its `session-start` action, and a new action switches the session to the model of each later stage.
- Sessions only step down. A stage whose model is above the session's current one runs as a stage subagent on that model, so no upward switch and no confirmation happens. The coordinating session's own model is out of scope: the owner picks it in the app.
- A stage subagent that returns `Outcome: failure` is retried once on the next model up (Haiku to Sonnet, Sonnet to Opus). A second failure, or a failure on Opus, blocks the run as `role-failed` does today. The retry is derived from the transcripts (no new state) and its tokens count toward `budget`.
- The spend readout is read-only and writes no file: tokens per stage and per model from the session and subagent transcripts (the model is on each assistant message; a subagent's stage is on the first line of its brief, `Change <id> (<script> script), stage ...`; a session turn counts in the stage of the last `next`), retries marked, and the total against the `budget` cap. It shows where `flow-check` and `/devkit status` already report.
- Every file the change writes is in English; the owner's conversation is in Brazilian Portuguese.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `default-table`: with no `models:` key, `next` for each stage of a change returns the model the built-in default names (Opus for the grill, plan and ADR stages, Sonnet for implement, review and deliver, Haiku for the commit hand-off, unit-test run and validation).
- AC-2 `config-table`: a `models:` entry in the `devkit:` block of `openspec/config.yaml` changes the model `next` returns for that stage, and the same entry in the change's `.openspec.yaml` wins over the project's.
- AC-3 `invalid-refused`: an unknown stage or an unknown model value in `models:` makes `start` and `next` exit 3 with `setting-unknown`, naming the setting and the accepted values.
- AC-4 `one-million-opt-in`: no default row uses a `[1m]` variant; a `models:` value of `opus[1m]` or `sonnet[1m]` is accepted and returned as written, and `haiku[1m]` is refused.
- AC-5 `agent-model`: every `agent` action printed by `next` carries a `model` field, and the skill text tells the session to pass it on the Agent call.
- AC-6 `session-start-model`: in a roadmap run (`--change-sessions`), the `session-start` action's `input` holds the model of the change's first stage.
- AC-7 `session-step-down`: when a change's stage changes in a roadmap run, the roadmap loop returns a switch action only when the new stage's model is cheaper than the session's current one; it never returns a switch to a more expensive model.
- AC-8 `upward-stage-subagent`: a stage whose model is above the session's current one is returned as an `agent` action with that model, never as a session switch.
- AC-9 `lone-change`: `/devkit change` alone never calls the session-model tool; only its `agent` actions carry models.
- AC-10 `retry-one-step-up`: after one `Outcome: failure` of a stage subagent on Haiku or Sonnet, `next` returns the same stage on the next family up; a second failure, or a first failure on Opus, ends the run blocked with `role-failed`.
- AC-11 `retry-counted`: the retry's tokens are in the `budget` count and in the spend readout, marked as a retry.
- AC-12 `spend-readout`: `flow-check` and `/devkit status` print tokens per stage and per model, the retries and the total against the `budget` cap, and write no file.
- AC-13 `real-run-proof`: the change's real-run proof covers a lone change and a roadmap run on at least two stages with different models, each shown in the transcripts' model fields, plus one retry; the guard test suite passes.

## Out of scope

- The model of the coordinating roadmap session itself, and of any session the owner opens by hand.
- Choosing a model by anything but the stage (no per-change cost or size heuristic).
- A model above Opus, or ids other than the three families and their `[1m]` variants.
- Switching a lone `/devkit change` session's own model.
- A status bar for the spend (that is `run-status-bar`).
- Writing the spend into a file of the change.
