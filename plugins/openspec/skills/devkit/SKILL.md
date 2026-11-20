---
name: devkit
description: "Runs one change from the owner's request to its archive in this session: /devkit change <what to do> opens the change in its own worktree and carries it, stage by stage, asking the owner only at the owner's gates (the grill, the plan approval, the retro answers) and waiting on GitHub with no time limit; /devkit change alone continues the unfinished change. Every decision comes from the change-loop script, never from this text. Use when the owner types /devkit, /devkit change <what to do>, or /devkit change to continue."
argument-hint: "change [<request> | <change-id>]"
disable-model-invocation: true
---

# /devkit change

`/devkit change <request>` takes one change from the owner's words to its archive, in this session, with one script that decides. This skill is the session's side of it: the script `change-loop.mjs` says what comes next, and this text says how to carry it out. It keeps no state: every call re-reads the change's files, git and GitHub. The session is the change coordinator; it never writes product code itself.

Path used below: `<skill-dir>/../../hooks/change-loop.mjs`, where `<skill-dir>` is this skill's directory. Every call of the script carries `--lang ${user_config.language}`.

## Settings

- The person's language is this pack's `language` setting, `${user_config.language}` (`pt-BR` or `en`): the replies, the grill's questions and the stage readout use it. Say every `reply` of the script as it is.
- Only the last message of a turn reaches the owner: a `reply` followed by more tool calls in the same turn is lost. So every `reply` the script printed in this turn that the owner has not been shown is part of the message that ends the turn, in order, before anything else. The turn that opens a change ends with the opening reply and then the grill's first question; a `resume` reply and a `switch-script` reply likewise.
- What the session writes itself follows the rule of the message table: see Never, the first item.
- The project's `devkit:` block in `openspec/config.yaml` holds the language of the project's files (`filesLanguage` in the script's output) and the driver. Write the change's files in `filesLanguage`; the script's `brief` already says so to every stage agent.
- When the owner asks where the change stands, show the stage readout: `node <skill-dir>/../../hooks/flow-check.mjs <id> --lang ${user_config.language}`.

## Start

Run the script with the owner's arguments on standard input, through a quoted heredoc so no character of the request reaches the shell:

```
node <skill-dir>/../../hooks/change-loop.mjs start --lang ${user_config.language} <<'DEVKIT_ARGS'
$ARGUMENTS
DEVKIT_ARGS
```

When a line of the request equals `DEVKIT_ARGS`, use `DEVKIT_ARGS_` followed by digits that no line of the request holds as the terminator. The script prints JSON with a `mode` and a `reply`. Act on the mode:

- `not-built`, `unknown-verb`, `not-set-up`, `setting-unknown`, `driver-not-built` and `nothing`: say `reply` and end the turn.
- `choose` and `ask-unfinished`: ask `reply` as one question with AskUserQuestion (else say it and end the turn). The options are each listed id and, for `ask-unfinished`, "start the new request". The answer is `resume` of that id, or the new change below.
- `resume`: keep `reply` for the message that ends the turn, then enter the Loop with `change`.
- `new`: a new change, below.

## A new change

Typing `/devkit change <request>` is the go-ahead: ask nothing before the change exists.

1. Propose the id from the request: kebab-case, the subject in at most five words and at most 48 characters. State it in the reply; the session does not ask.
2. Choose the script with one rule: `devkit-lite` only for a small change that is easy to undo and touches no screen, no boundary between parts of the project and no contract other parts rely on; `devkit` otherwise and whenever in doubt. Pick one reason code for the choice: `small`, `doubt`, `architecture`, `contract`, `ui`, `capability` or `risk`.
3. Open it, with the request on standard input through the same quoted heredoc, the request verbatim:

```
node <skill-dir>/../../hooks/change-loop.mjs open <id> --script <devkit|devkit-lite> --why <code> --lang ${user_config.language} <<'DEVKIT_ARGS'
<the request, verbatim>
DEVKIT_ARGS
```

Keep `reply` for the message that ends the turn, then enter the Loop with the id. On `name-taken`, choose another id and call `open` again. On any other exit 3, say `reply` and end the turn.

When the owner asks to switch the script before the plan is written, run `node <skill-dir>/../../hooks/change-loop.mjs script <id> <devkit|devkit-lite> --why <code> --lang ${user_config.language}` and say its reply. The grill may also correct a wrong guess: the loop then hands you a `switch-script` step with its command.

## Loop

Repeat until an action of kind `end`. From the implementation on, the order is the script's: `verify` (the evidence) comes before `review`, and a fix outside the change's folder makes both stale (`verify`, then `review`).

1. Run `node <skill-dir>/../../hooks/change-loop.mjs next --change <id> --lang ${user_config.language}`. After every `agent` or `session` action, add `--after` and the `progressKey` of that action. The first line printed is `devkit-run: <id>`; when the action is an end, a second line `devkit-end: <id> <state>` follows; the rest is one JSON action. Those marker lines are the record the stop lock reads: never show one to the owner.
2. Carry out the action by its `kind`:

- `agent`: one Agent call, in the foreground, with the call's `subagent_type` set to the action's `agent` field and the prompt `brief`. For a delivery step, append the dispatch sentence of that step's `ship-change` row. One stage per hand-off. When the agent returns `Outcome: failure`, declare the end: run `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=role-failed --param stage="<stageTitle>" --lang ${user_config.language}`, show its reply and end the run.
- `session`: do the step as the `ship-change` row of the same name says, in `root`, with `detail` as its `next` object. A `switch-script` step runs `detail.command` and keeps `reply` for the message that ends the turn. An `answer` step that only the owner can decide is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply waiting-pr-decision --param id=<id> --param url=<the pull request's url> --lang ${user_config.language}`, shown, and ends the turn.
- `grill`: run the `requirements-grill` skill with the owner, in the person's language, writing `requirements.md` in `filesLanguage`; the request is already in it. Open the file with the template's stage header line `<!-- devkit-stage requirements ... -->` and set `result=passed` once the owner has answered. Ask one question at a time with AskUserQuestion.
- `review`: a `session` step. Run the `review-change` skill as the `ship-change` `review` row says: through the Workflow tool, on its `agents` path on a turn the owner did not type, until the round's completion notice or the round is declared lost; then set `review.md`'s header as that row says.
- `gate`: a `session` step. Run `detail.command` in Bash, alone: the exit code decides. Green: tick the gate task `detail.task` in `tasks.md`. Red: declare the end: run `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=tests-red --param phase=<n> --lang ${user_config.language}`, show its reply and end the run.
- `resolve-release-conflict`: an `agent` hand-off to `devkit-core:tdd-implementer` with the brief and this sentence: Run `detail.command` in the worktree, then the project's test command; report the JSON and the result; change nothing else. `Outcome: failure` ends the run blocked.
- `push-rebased`: an `agent` hand-off to `devkit-core:commit-and-pr` with the brief, `detail.oldHead` and `detail.paths`: The branch was rewritten by a rebase. Commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`. No PR edit.
- `end`: say `reply`. `archived` and `blocked` end the run. `waiting-for-owner` ends the turn: the owner's next message is the answer. `waiting-on-github`: Waiting on GitHub, below.

An end the session declares itself (an agent's failure, a red gate, a pull-request decision left to the owner) goes through `reply`, never through a sentence of your own: its first output line, `devkit-end: <id> <state>`, is what lets the turn end without a refusal, and only the lines after it are shown to the owner.

Then run `next` again. The session never chooses the order, never runs two stages at once and never dispatches a subagent for a whole change.

## Owner gates

Ask with AskUserQuestion where the host has it: the grill's questions, the plan approval (`waiting-approval`) and the retro answers (`waiting-retro`). Plan approval and retro answers are written only from the owner's own message, never from a subagent's report, your own reading or a turn the owner did not type. When the owner answers, record it as the `ship-change` row for that gate says (`stop-plan-approval` with `detail.readiness` as the hash, `stop-retro-answers`), then run `next`. A question the owner must still answer ends the turn; a pending question blocks nothing else.

## Waiting on GitHub

When `next` ends waiting on GitHub, start the wait with the Bash tool's background option, then say `reply`:

```
node <skill-dir>/../../hooks/change-loop.mjs wait --change <id> --lang ${user_config.language}
```

The wait has no time limit of its own and exits as soon as GitHub's answer changes the decision; its end starts the next turn, which then runs `next` and goes on. Calling `/devkit change` again at any time is safe: it re-reads everything and starts a new wait if GitHub still waits.

## Never

- Show the owner an internal term in a sentence of your own: no progress key, no agent or role id, no reason code and no step name of a checker, and no agent's internal outcome word. Name a stage by its title in the person's language (`stageTitle`), and say that resuming is always to call `/devkit change` again. A file name the owner needs in order to act (a file to read or approve) may be named.
- Dispatch a subagent for a whole change: one hand-off is one stage.
- Choose the order of the stages or run two stages at once.
- Edit product code in this session: every code change goes through a hand-off to `devkit-core:tdd-implementer`.
- Write `readiness.md`, `evidence.md` or `reviews/`: they belong to their agents.
- Write `approval.md` or a retro answer except from the owner's own message.
- Create a cron or any scheduled wake-up.
- Push to or commit on the default branch.
- Bypass a hook or a gate (`--no-verify`, `DEVKIT_BYPASS`).
