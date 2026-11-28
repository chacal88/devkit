# P-0: the delete before any create (machine avel, 2026-11-28)

Session: the change's conducting session on the machine `avel`, which the desktop app reaches as an
SSH host; permission mode bypass.

## Calls

1. `mcp__scheduled-tasks__list_scheduled_tasks` →
   `7 scheduled tasks aren't listed here because they run somewhere other than this session's SSH host, such as the user's own computer. The user sees them under Routines or Scheduled in the app.`
2. `mcp__scheduled-tasks__create_scheduled_task` (`taskId: devkit-hc-probe-0`, one firing,
   `fireAt: 2026-11-29T23:00:00-03:00`) → refused by the host before the call:
   `Nothing was created: scheduled tasks run on the user's own computer, not on the SSH host this session works on.`
3. No delete was called: nothing was created.

## What the host's tool descriptions state (read in this session)

- `create_scheduled_task`: "Not available in this session: scheduled tasks run on the user's own
  computer and this session works on an SSH host, so this call is refused and creates nothing."
- `delete_scheduled_task`, `update_scheduled_task`, `run_scheduled_task`: "For a task that runs on
  the user's own computer the user must approve in the app; in auto mode and in bypass permissions
  mode the call is refused."

## Result

- On an SSH-host session no scheduled task can be created, listed, removed or run: P-1 to P-7 cannot
  run on `avel`.
- On the owner's own computer, removing (`delete`), pausing (`update` with `enabled: false`) or
  running a task needs the owner's approval in the app and is refused in auto and bypass mode. A
  task that "removes itself" unattended (AC-9) is therefore not shown possible; the plan's fallback
  (the tick clears `task` and the hook blocks every later firing, reply `roadmap-task-left`) is the
  only unattended path this reading leaves.
- Final list: unchanged (no `devkit-hc-probe-` task was created).
