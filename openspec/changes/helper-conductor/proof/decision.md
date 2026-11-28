# Phase 1 decision point (D-1), 2026-11-28

Written by the conducting session from `p0-delete.md` and `p1-hooks.md`. Only the probes the hosts
allowed ran: P-0 on `avel` (refused) and one probe task on the owner's Mac.

## Each case of D-1

| Case | Value | Source |
|---|---|---|
| P-0: the session can remove a task it created | false unattended: delete, pause and run need the owner's approval in the app and are refused in auto and bypass mode; on an SSH host nothing can be created | `p0-delete.md`, "What the host's tool descriptions state" |
| P-1: a scheduled session loads the plugin and its hooks fire | true for `SessionStart`, the skills, the agents and the loop script; a `bash` guard refusal was not exercised | `p1-hooks.md`, lines `session_start_hook`, `loop_script`, and the notes |
| P-2: the envelope of a task's prompt | not measured | `p1-hooks.md`, notes |
| P-3: a slash command in a task's prompt runs as typed | not measured | none |
| P-4a: an agent helper dispatches nested stage agents and the review bench | not measured; one level is shown: the task's session itself ran `devkit-core:codebase-researcher` through the Agent tool | `p1-hooks.md`, line `agent_call` |
| P-4b: a Workflow helper does the same | not measured; the Workflow tool is available in the task's session | `p1-hooks.md`, line `tools` |
| P-5: a blocked firing makes no model call | not measured | `p1-hooks.md`, coordinator's conclusions |
| P-6: overlap and background | not measured | none |
| P-7: the notification tool | not measured | none |
| Host fact: the task keeps the creating session's permission mode | false: a task created on a turn the owner did not type runs in the default mode; it is created on the owner's typed turn and its approvals live on the task | `p1-hooks.md`, "Host facts known before the probe" |
| Host fact: a task's session can start sessions | false (`mcp__ccd_session__start_session` absent) | `p1-hooks.md`, line `tools` |

## Pick

**Stop and revise.** P-0 is false unattended, which D-1 lists as a stop case, and P-3, P-4a, P-4b and
P-5 are not measured. What the probe shows points to the candidate D-1 names for that case: the
tick's own session conducts its claimed change and hands each stage to an agent one level deep (the
Agent call shown), with the Workflow tool available for the review bench. ADR [helper-conductor]
decision 3 does not allow that without a revision.

## What the revision covers

- Decision 3 and D-7: the helper is the tick's own session handing stages one level deep (or a
  Workflow), unless a new probe shows nested dispatch.
- AC-9, D-6 and decision 1: a task cannot remove itself unattended; the tick clears `task` and the
  hook blocks every later firing (`roadmap-task-left`), and the owner removes the task with one click.
- D-1: the task is created on the owner's typed `/devkit roadmap` turn.
- Probes still owed, each its own task on the owner's Mac: P-2 and P-5 (a `UserPromptSubmit` hook
  that blocks before the model, and the cost it leaves), P-3, P-6 and P-7.
- Field fact 12 into D-25 (hold test runs during a train; no whole-suite train for a pull request
  whose files are all under `openspec/`).

Envelope regex, cron, remove tool and notification tool: not settled; they wait for the probes above.

## Probe 2

Values settled from `p2-result.md` (owner's Mac, 2026-11-28), each with its line:

| Value | Settled as | Source line in `p2-result.md` |
|---|---|---|
| The envelope (D-4, D-11) | the first message holds the header `[SCHEDULED TASK - AUTOMATED FIRING OF A CONFIGURED PROMPT]`, then `<scheduled-task name="<taskId>" file="<path>/SKILL.md">` wrapping the stored prompt, whose first line is `devkit-roadmap-tick: <root>` | `envelope:`, `envelope_tag:` |
| The prompt form | S-B, no entry skill: a slash command in the prompt arrives as plain text | `slash_command: no` |
| The review round | the `review-change` Workflow path runs in a task's session | `workflow_ran: yes` |
| Every hand-off | in the background, returning by completion notice; one level below works | `nested_agent:` |
| The stop hook | no refusal of a turn that ended while an agent ran | `stop_hook_seen: none` |
| A run's status | no lock: a run reads `succeeded` while its background command lives | `## list_task_runs` section |

With these the D-1 pick is final: the tick's own session conducts its claimed change (Helper A's
place, ADR [helper-conductor] decision 3), the prompt form is S-B, and the cost of a blocked firing
is measured by task 3.6 before phase 4.

## Phase 3 measurement and the tick gate's footing (2026-11-28)

Task 3.6 measured on `avel` without a scheduled task (`p5-empty-tick.md`): three headless runs of the
tick's prompt, bare and in the scheduler's envelope, each blocked by `tick-gate.mjs`, read 0 turns,
0 tokens and cost 0; the control run with the item ready read 1 turn and the note reached the model.
No stop-and-revise case of D-1 holds.

Until task 6.1's run on the owner's Mac, the tick gate rests on:

- measured: the firing's prompt arrives inside `<scheduled-task name="...">` (`p2-result.md`,
  `envelope_tag:`); the plugin's hooks run in a task's session (`p1-hooks.md`,
  `session_start_hook:`); a `UserPromptSubmit` block of the tick's prompt costs no model call in a
  headless session (`p5-empty-tick.md`);
- not measured: that a `UserPromptSubmit` hook sees a scheduled firing and that its block costs no
  model call there. Task 6.1 measures it, with the cron, the notification tool and two runs at once.
