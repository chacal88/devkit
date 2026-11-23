<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> a token budget per run of a change, set in the `devkit:` block of `openspec/config.yaml` and overridable in the change's `.openspec.yaml`, counted from the usage the run's transcript and its subagents' transcripts record and checked by the loop between hand-offs; at the cap the run ends waiting for the owner with the reason budget reached, and a raised budget lets `/devkit change` resume, as a Managed Agents session budget pauses the session between model requests and a deployment copies its cap to each run (managed-agents-study F-2)

Classification: domain=process type=feature flags=[contract] (confirmed: a new project setting and a new end reason that the guard's stop lock and the roadmap coordinator read)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The project-wide cap is a whole number of tokens at `openspec/config.yaml` → block `devkit:` → key `budget:` (beside `language:` and `driver:`), for example `devkit:` / `  budget: 2000000`.
- A change overrides it in `openspec/changes/<id>/.openspec.yaml`. AMBIGUOUS: (a) a top-level key `budget:` beside `schema:` and `created:` | (b) a block `devkit:` with key `budget:`; the planner resolves, after checking which form the `openspec` CLI accepts in that file without an error.
- No `budget:` in either file means no cap: the loop behaves exactly as today.
- A value that is not a whole number greater than zero is a settings error reported like the existing `setting-unknown` reply, before any stage runs.
- The count is read from this session's transcript (`input.transcript_path`, the file the guard already scans) and from every subagent transcript of the same session (`<session folder>/subagents/agent-*.jsonl`, where the review round's agents also land); a new session or another machine starts again from zero.
- The count starts at the first `devkit-run: <id>` line for the change in this session's transcript; subagent transcripts count when they started after it. A session that carries several changes counts everything after that line (an overcount accepted for that rare case).
- Each model message counts `usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens`; `usage.cache_read_input_tokens` is left out.
- The check runs in `change-loop.mjs next` before it returns a hand-off (an `agent` or `session` action), so a single long hand-off can pass the cap before the stop, as a Managed Agents request that crosses its budget completes.
- When a transcript cannot be read, the count blocks nothing (as the guard's locks let everything through when they cannot read it).
- At the cap the owner raises the number in either file and types `/devkit change` again; nothing else is needed.
- The spend is shown only in the stop message; `/devkit status` and the stage readout do not show it (the sibling change `change-state` owns the state those surfaces show).
- Proof here is by the hook test suites on fixture transcripts; seeing a real run stop at the cap in a live session is the next change's dogfood, not this change's evidence.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
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

## Out of scope

- Showing the spend in `/devkit status`, the stage readout or a panel (the sibling change `change-state`).
- A cost cap in dollars, a price table, web searches or running time.
- A budget summed across sessions or machines, or kept in a file of the change.
- Warnings before the cap; stopping inside a hand-off.
- A budget for the roadmap coordinator's own session or for a `/devkit project` slice.

## Questions asked

1. [scope] What does the cap count? → Everything this session spent on the change, its subagents included, read from the transcripts; a new session or another machine starts the count again. (Answer delegated by the owner to the coordinating roadmap session, in the owner's own message there: `Por favor, verifique todas as perguntas e as que você tiver a informação para responder, pode ir respondendo.`)
2. [end effect] Which tokens does the count add up? → Every kind but cache reads: `input_tokens + output_tokens + cache_creation_input_tokens` of each model message's `usage`; `cache_read_input_tokens` is left out (measured on this session's grill: about 14 thousand output, 208 thousand cache writes, 2.7 million cache reads). (Answer delegated by the owner to the coordinating roadmap session, under the same delegation.)
3. [scope] Where does the owner see the spend? → Only in the stop message; `change-state` owns `/devkit status`. The small decisions listed by this session (no cap when unset, the stop message's content, unreadable transcript passes, invalid value refused, check between hand-offs) were accepted as assumptions. (Answer delegated by the owner to the coordinating roadmap session, under the same delegation.)

## Escalations

- None.
