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

Run session `local_89fc3977-5a75-45eb-9014-57f6d82c060d`, started 2026-11-28T14:59:25Z, file written
15:01:00Z, about 95 s for the whole probe. The file's content, as relayed verbatim:

```text
probe-run: 2026-11-28T15:01:00Z
start_cwd: /Users/kauesantos/Documents/devkit (the project root, not a worktree)
session_start_hook: yes; "[devkit] Active OpenSpec change: test-map-hub-links (schema devkit). ..." (the devkit SessionStart hook ran in the task's session)
devkit_skills_listed: the devkit-core skills (adr-authoring, commit-message-guidelines, e2e-testing, plan-readiness-review, requirements-grill, retro, review-change, screen-mockup, systematic-debugging, test-and-coverage, test-driven-development) and devkit-openspec:devkit-session, ship-change
devkit_agents_listed: all the devkit-core agents (adr-author, adr-reviewer, architecture-reviewer, change-planner, code-quality-reviewer, codebase-researcher, commit-and-pr, e2e-tester, finding-verifier, plan-readiness-reviewer, plan-reality-auditor, pr-verifier, requirements-triage, ...)
loop_script: exit 0; `roadmap-loop.mjs status` printed "Roadmap: 11 open of 4 · 24 in the queue · 56 archived"
agent_call: ok: the Agent tool ran devkit-core:codebase-researcher in the background and it answered by a task notification, 1 tool use, about 3 s
guard_hook: a dry-run `git push origin HEAD:refs/heads/main` was NOT refused by a devkit hook; git itself answered (rejected, non-fast-forward). So the push-to-main guard did not fire in that session (check whether it is a hook gap or the dry run).
permission_mode: unknown; no Bash or Agent call was refused or held for a prompt, although the task was created on a turn the owner did not type
tools: Agent yes, Workflow yes, Bash yes, mcp__ccd_session__start_session NO (the task's session has only spawn_task, dismiss_task, mark_chapter, read_widget_context under mcp__ccd_session__)
```

The coordinator's conclusions: a scheduled task's session has the devkit plugin, its SessionStart
hook, its skills and agents, and can run the loop script and hand a stage to an agent, so the helper
is an agent (or a Workflow, also available) inside the tick's session; it cannot start sessions,
which the design does not need. Not measured: the cost of an empty tick refused before the model
(the probe ran the model). An empty-tick run that reaches the model costs one short session start.

## Notes of the conducting session

- The guard line: the devkit `bash` guard has no push-to-main rule; it refuses only a force push
  (`plugins/openspec/hooks/guard.mjs`, the rule `force push (use --force-with-lease on your own
  branch)`). Pushes to `main` are refused by the `devkit` ruleset on GitHub. A plain push passing the
  hook is therefore expected, not a gap of the scheduled session; the probe does not show a `bash`
  guard refusal (task 1.3's check is not met).
- P-2, the envelope: the probe did not record the `UserPromptSubmit` payload, so the prompt's exact
  form in a task's session is not known.
