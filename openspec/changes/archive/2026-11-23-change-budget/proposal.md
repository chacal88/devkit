<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `change-budget` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, with the owner's delegated answers; item F-2 of
`openspec/changes/archive/2026-11-22-managed-agents-study/study.md`; the `change-budget` line of
`openspec/roadmap.md`).

## Why

devkit has no spend control: a `/devkit change` run is held only by attempt ceilings, review rounds
and the roadmap's places, so one run can spend any number of tokens before the owner sees it. A
Managed Agents session budget pauses the session between model requests when its cap is reached,
and a deployment copies its cap to each run (managed-agents-study F-2). The transcripts the guard
already reads carry a `usage` object on every model message, for the session and for each subagent,
so a per-run token cap can be counted today without a price table.

## What Changes

- A new optional setting: `budget:` (a whole number of tokens greater than zero) in the `devkit:`
  block of `openspec/config.yaml`, overridden for one change by a `devkit:` block with `budget:` in
  that change's `.openspec.yaml`. No `budget:` in either file means no cap, and the loop behaves
  exactly as today.
- `change-loop.mjs next` counts the run's spend before it returns a hand-off (an `agent` or `session`
  action): `input_tokens + output_tokens + cache_creation_input_tokens` of every model message after
  the change's first `devkit-run: <id>` line in this session's transcript, and of every subagent
  transcript of the session started after that line; cache reads are left out.
- At or above the cap, `next` returns an end `waiting-for-owner` with the reason budget reached
  instead of the hand-off, prints `devkit-end: <id> waiting-for-owner`, and its reply (in `pt-BR` and
  `en`) states the tokens spent, the cap, the file and key to raise it, and that typing
  `/devkit change` again resumes. Once the cap is raised, the next `next` returns the held hand-off.
- A `budget:` that is not a whole number greater than zero is refused with the existing
  settings-error reply, before any stage runs.
- An unreadable transcript, or a session whose transcript cannot be found, stops nothing.
- The roadmap coordinator's gate table knows the new owner wait (one phrase), so its board never
  fails on it; the roadmap coordinator's own session is not budgeted.
- The `devkit` skill says how to carry out the new end; `docs/openspec-flow.md` documents the
  setting, the override, the count, the stop and the resume; a release of devkit-openspec.

Non-goals: everything under "Out of scope" in `requirements.md` (showing the spend in
`/devkit status`, the stage readout or a panel; a cost in dollars, web searches or running time; a
budget summed across sessions, machines or kept in a file; warnings before the cap; stopping inside
a hand-off; a budget for the roadmap coordinator's own session or a `/devkit project` slice). Also
not here: the CompozyOS template's `budget` block (F-2 names it, the request does not), and any
change to the stop, subagent-stop or hand-off locks.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `stop-at-cap` — With a cap set and the counted tokens of the run at or above it, `change-loop.mjs next` returns an end of state `waiting-for-owner` with the reason budget reached instead of the next stage's hand-off, and prints the `devkit-end: <id> waiting-for-owner` marker so the turn can end.
- AC-2 `stop-message-says-how` — The stop reply, in `pt-BR` and in `en`, states the tokens spent, the cap, and the file and key to raise it, and says that typing `/devkit change` again resumes.
- AC-3 `under-cap-unchanged` — With a cap set and the count below it, `next` returns the same action it returns with no cap.
- AC-4 `no-cap-unchanged` — With no `budget:` in either file, no output of `change-loop.mjs` changes.
- AC-5 `change-overrides-project` — A `budget:` in the change's `.openspec.yaml` wins over the one in `openspec/config.yaml` for that change only; another change still uses the project's value.
- AC-6 `raised-cap-resumes` — After the cap is raised above the spend, the next `next` returns the hand-off the stop held back, with no other step.
- AC-7 `count-rule` — The count adds `input_tokens + output_tokens + cache_creation_input_tokens` of every model message after the change's first `devkit-run:` line in the session transcript and of every subagent transcript of the session started after it, and leaves `cache_read_input_tokens` out; a fixture with known numbers gives the exact sum.
- AC-8 `invalid-cap-refused` — A `budget:` that is not a whole number greater than zero gives the settings-error reply naming the key and the value, and nothing runs.
- AC-9 `unreadable-transcript-passes` — With no readable transcript, a set cap stops nothing.
- AC-10 `documented` — `docs/openspec-flow.md` describes the setting, the override, what is counted, the stop and how to resume.

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate change-budget --strict`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: the budget setting and its override, the refusal of an invalid value, the
  count, the stop between hand-offs, its reply and the resume (six ADDED requirements); the budget
  stop's reply may name the change's settings file and the key (MODIFIED "Replies use no internal
  term").
- `roadmap-coordination`: the gate phrase for the budget wait, and the same exception for the one
  message table (MODIFIED "The run's replies come from the one message table").

## Impact

- `plugins/openspec/hooks/guard.mjs`: the transcript scan gains a usage mode; one shared count helper
  and the lookup of the session's transcript.
- `plugins/openspec/hooks/change-loop.mjs`: the setting, its validation, the hold in the decision, the
  messages, `next` opting in.
- `plugins/openspec/hooks/roadmap-loop.mjs`: one gate entry.
- `plugins/openspec/skills/devkit/SKILL.md`: two sentences of the Loop.
- Tests: `change-loop.test.mjs` and `roadmap-loop.test.mjs` (new tests; three existing tests change,
  named with their invariants in `design.md` D-8).
- Docs and release: `docs/openspec-flow.md`, `docs/coordination-design.md`, the comment of
  `openspec/config.yaml`, `CHANGELOG.md`, devkit-openspec's `plugin.json` and `marketplace.json`.
- Dependencies: `managed-agents-study` (archived 2026-11-22), which this line is `after:`. Decisions
  cited: ADR 0004, ADR 0010, ADR 0011, ADR 0013, ADR 0014. Open decisions inherited: none (this
  repository keeps no open-decisions log; `docs/coordination-design.md` "Open points" has none on
  spend).
