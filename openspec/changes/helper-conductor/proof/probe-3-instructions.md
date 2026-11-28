# Probe 3: the blocked tick, measured on the owner's Mac (task 3.6)

Run by the coordinator's session on the owner's Mac, on a turn the owner typed (a task created on
another turn runs in the default permission mode). It needs none of the files the change
`multi-roadmaps` edits: the hook is this branch's `plugins/openspec/hooks/tick-gate.mjs` (task 2.17,
self-contained), installed only in a scratch project's `.claude/settings.local.json`, never in this
repository's settings.

## Setup

1. `git fetch origin` in the devkit clone, then
   `node <clone>/openspec/changes/helper-conductor/proof/probe-3-setup.mjs <clone> block`
   (read `probe-3-setup.mjs` first: it writes only under `/var/tmp/devkit-hc-tick`). It prints the
   task id, the working folder and the two-line prompt.
2. `list_scheduled_tasks` works in the session (the check before any create).

## Observations

- (a) Blocked firings: create the task with the printed `taskId`, working folder and prompt, as a
  one-time task (`fireAt` a minute ahead), `notifyOnCompletion: false`; fire it three times (re-arm
  `fireAt` with `update_scheduled_task`, or three one-time tasks of the same prompt with ids
  `<taskId>` only for the first: the hook checks the tag's name against the root, so the other two
  must also be named `<taskId>`; re-arming the same task is the simple path). Per firing record: the
  line of `/var/tmp/devkit-hc-tick/log/hook.jsonl` (`decision: block`, `why: helpers-full`: the live claim fills the one place), the run
  from `list_task_runs` (status, times), whether the run's session has any assistant message
  (`list_events`), and the tokens the app shows for it.
- (b) Passing firing: `node .../probe-3-setup.mjs <clone> ready`, fire once more; record the hook
  line (`allow`), the run's tokens and the model it ran on. The note names
  `node "/hooks/roadmap-loop.mjs" tick ...` with an empty pack path (the scratch hook is no plugin
  hook) and the `tick` verb does not exist yet (task 2.5): the session is expected to report the
  note and stop; record what it did.
- (c) The recurring schedule: `update_scheduled_task` with `cronExpression: "*/5 * * * *"`, accepted
  or refused (and the shortest interval accepted). Optional: two runs at once, as task 3.6 (c) says.
- (d) In the passing firing's session, or the coordinator's own: `ToolSearch` for
  `select:PushNotification`, else the query `notification`; the tool's name or none.
- (e) Any pause for a tool approval in any firing.
- (f) The note: whether the passing session quotes `devkit tick note:` (the hook's
  `additionalContext` reached the model).
- (g) The `prompt` field of each line of `/var/tmp/devkit-hc-tick/log/prompt.jsonl`: the
  `<scheduled-task name=...>` tag form or the bare stored prompt (first 300 characters).

Write the results as `key: value` lines to `/var/tmp/devkit-suite/helper-conductor-probe-3.txt` and
send them; the conducting session records them in `proof/p5-empty-tick.md` and `decision.md`. The
owner deletes the task with one click; `/var/tmp/devkit-hc-tick` is removed after checking the
session created it.

## Dry run on `avel` (2026-11-28)

The setup was run on `avel` with a hand-made envelope payload (no scheduled task: refused on an SSH
host): `block` printed `{"decision":"block","reason":"devkit roadmap: nothing is ready (helpers-full)"}`,
`ready` printed the `additionalContext` note, a plain prompt printed nothing, and the hook log held
one `block` and one `allow` line. The scratch folder was removed after.
