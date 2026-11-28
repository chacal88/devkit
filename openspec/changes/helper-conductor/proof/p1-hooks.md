# P-1 and P-2: a scheduled session, its hooks and its envelope (2026-11-28)

## Host facts known before the probe

Relayed by the coordinator's session from the owner's Mac, 2026-11-28.

1. The host refuses a scheduled task on a session that works on an SSH host (seen on `avel`, see
   `p0-delete.md`): the conductor's task lives on the owner's own machine, the one the desktop app
   runs on.
2. A task created on a turn the owner did not type does not keep the session's permission mode: its
   runs start in the default mode and may pause to ask. The conductor's task is therefore created on
   the owner's typed turn (`/devkit roadmap`), and its tool approvals are stored on the task.

## The probe

The coordinator's session runs the probe on the Mac: a one-time scheduled task
`devkit-helper-conductor-probe` firing at 11:59 -03 that writes
`/var/tmp/devkit-suite/helper-conductor-probe.txt` (start cwd, the SessionStart hook seen, the devkit
skills and agents listed, the loop script run, one Agent call, the guard hook on a dry-run push, the
tools available).

Result: pending; the file's content is recorded here when it lands.
