# Probe 2: the prompt of the one-time task (helper-conductor, phase 1)

The coordinator's session creates a one-time scheduled task on the owner's Mac, `taskId:
devkit-helper-conductor-probe-2`, working folder the project root (`/Users/kauesantos/Documents/devkit`),
with the prompt below, verbatim between the fences. Every step reads only; the one file written is
the result file under `/var/tmp/devkit-suite/`. After the run the coordinator's session records,
from `list_task_runs`, the run's status and times, and whether the run read `running` while the
background command of step 6 was alive (the overlap answer).

## The prompt

```text
devkit-hc-probe-2: /Users/kauesantos/Documents/devkit
/devkit-openspec:devkit status
You are probe 2 of the devkit change helper-conductor. Nobody watches this session: never ask anything, never call AskUserQuestion, change no file of the project, run no git command that writes (no commit, push, checkout, stash, reset, clean, worktree add). Write every answer, as plain `key: value` lines, to /var/tmp/devkit-suite/helper-conductor-probe-2.txt (create the folder /var/tmp/devkit-suite if it is missing; append, never overwrite). If a step fails, write its key with `fail: <the error, one line>` and go on to the next step. Steps:
1. envelope: copy the first 400 characters of this session's first user message exactly as you received it (every tag, line break as \n), then on its own key `envelope_tag:` the name and attributes of any wrapping tag around the prompt (for example a scheduled-task tag), or `none`.
2. slash_command: did the line `/devkit-openspec:devkit status` run as a command? Write `yes` if your first user message holds a `<command-name>` tag or the devkit skill's own text was loaded for it, with the tag's content; `no` if it reached you only as plain text. Then `slash_board:` the first line the devkit status board printed in this session, or `none`.
3. nested_agent: make one Agent call, subagent_type general-purpose, in the foreground, with this prompt: "Make one Agent call yourself, subagent_type devkit-openspec:openspec-validator, foreground, asking it to validate the OpenSpec change test-map-hub-links in /Users/kauesantos/Documents/devkit read-only (no file written) and to answer with its verdict line. Then answer me with three lines: `inner_called: yes|no`, `inner_agent_type: <the type you called or the error>`, `inner_verdict: <its verdict line or the error>`." Write its three lines prefixed `nested_agent_`, then `nested_agent_ok: yes` only if inner_called is yes and a verdict came back.
4. workflow: run the Workflow tool once with this inline script (the owner asked for this workflow in this task's prompt):
   export const meta = { name: 'hc-probe-2', description: 'helper-conductor probe 2: one read-only reviewer agent', phases: [{ title: 'Review' }] }
   const r = await agent('Read /Users/kauesantos/Documents/devkit/openspec/changes/test-map-hub-links/proposal.md and answer with its first heading line only. Write no file.', { label: 'probe-review', phase: 'Review' })
   return { heading: r }
   Wait for its completion notification, then write `workflow_ran: yes|no`, `workflow_result: <the returned heading or the error>`.
5. hooks: write `stop_hook_seen:` yes if any hook message from the devkit plugin (text starting "devkit" or "[devkit]") reached you in this session after steps 3 or 4, with its first 200 characters; else `none`. Write `session_start_seen:` the first 200 characters of the devkit SessionStart report, or `none`.
6. overlap: start `sleep 600` with the Bash tool's run_in_background option (not a shell `&`), write `background_started: <the time, UTC ISO>`, then write `ended_turn_at: <the time, UTC ISO>` as the last line and end your turn at once without waiting for the sleep.
```
