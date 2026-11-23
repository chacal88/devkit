---
name: devkit-session
description: "Runs the change of a session a /devkit roadmap run started, from its first turn, with no command typed. Use only when this session's first message is the started-session form whose task is /devkit change <id> followed by a devkit-start line; the devkit guard refuses it anywhere else."
---

# devkit-session

This skill runs one change in the session a `/devkit roadmap` run started for it, from the session's first turn and with no command typed. The script `roadmap-loop.mjs` says what comes next and this text says how to carry it out; it keeps no state. The `devkit` skill runs only from the owner's typed command, so the roadmap run gives each session a one-use ticket in the task below `/devkit change <id>`, and the devkit guard lets this skill run only on that ticket. Anywhere else the guard refuses it, and the owner can type `/devkit change <id>` in the session instead.

Path used below: `<skill-dir>/../../hooks/roadmap-loop.mjs`, where `<skill-dir>` is this skill's directory.

## Settings

- The person's language is this pack's `language` setting, `${user_config.language}` (`pt-BR` or `en`): the replies and the stage readout use it. Say every `reply` of the script as it is.
- The load limit is this pack's `load_limit` setting, `${user_config.load_limit}`: a whole number, the processor load in percent above which no change builds.
- Only the last message of a turn reaches the owner: a `reply` followed by more tool calls in the same turn is lost, so every `reply` printed in this turn that the owner has not been shown is part of the message that ends the turn, in order.

## The change

The change is the one named by the `devkit-start:` line of this session's first message: `devkit-start: <id> <ticket>`. This skill takes no argument. Before the first question this session asks the owner, say in two or three plain sentences who started it, why and what it does, in the person's language.

## Loop

Repeat until an action of kind `end`.

1. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs session-next --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit}`, adding `--after` and the `progressKey` after every `agent` or `session` action.
2. When `sessionTitle` is present and differs from the title last set, load `select:mcp__ccd_session_mgmt__set_session_title` with ToolSearch and call `mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the action's `sessionTitle`, from the main thread (a subagent cannot rename the session it runs in), before carrying out the action; a refused rename is not retried for the same `sessionTitle`.
3. Carry out the action as item 2 of the `## Loop` of `<skill-dir>/../devkit/SKILL.md` says for its kind, with these differences: `held`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs session-wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID}` with the Bash tool's background option, say `reply`, end the turn, and when the wait ends run step 1 again; a `merge-base` step runs `detail.command`; `waiting-on-github` starts `node <skill-dir>/../../hooks/roadmap-loop.mjs wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID}` in the background.
4. The turn that archives the change ends with the line `devkit roadmap: <id> archived`.

## Never

Never: ask the grill, the plan approval or the retro answers here; write `approval.md` or a retro answer; create a schedule; start a session; take a place by hand.
