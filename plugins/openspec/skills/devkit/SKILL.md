---
name: devkit
description: "Runs one change from the owner's request to its archive in this session: /devkit change <what to do> opens the change in its own worktree and carries it, stage by stage, asking the owner only at the owner's gates (the grill, the mock-up, the plan approval, the retro answers) and waiting on GitHub with no time limit; /devkit change alone continues the unfinished change. /devkit roadmap [<n>] runs the roadmap's ready changes, several at once, and /devkit status shows where everything is. /devkit project [<name>] plans a new project or slice phase by phase with the owner (business, domain model, architecture, implementation plan, roadmap), then delivers it as one pull request. Every decision comes from the change-loop, roadmap-loop and project-loop scripts, never from this text. Use when the owner types /devkit, /devkit change <what to do>, /devkit change to continue, /devkit roadmap [<n> | stop], /devkit status or /devkit project [<name>]."
argument-hint: "change [<request> | <change-id>] | roadmap [<n> | stop] | status | project [<name>]"
disable-model-invocation: true
---

# /devkit change

`/devkit change <request>` takes one change from the owner's words to its archive, in this session, with one script that decides. This skill is the session's side of it: the script `change-loop.mjs` says what comes next, and this text says how to carry it out. It keeps no state: every call re-reads the change's files, git and GitHub, and the session's transcripts when the project sets a token budget. The session is the change coordinator; it never writes product code itself.

Path used below: `<skill-dir>/../../hooks/change-loop.mjs`, where `<skill-dir>` is this skill's directory. Every call of the script carries `--lang ${user_config.language}`. The roadmap sections below use `<skill-dir>/../../hooks/roadmap-loop.mjs`, whose every call also carries `--load-limit ${user_config.load_limit}`. The Project section uses `<skill-dir>/../../hooks/project-loop.mjs`.

## Settings

- The person's language is this pack's `language` setting, `${user_config.language}` (`pt-BR` or `en`): the replies, the grill's questions and the stage readout use it. Say every `reply` of the script as it is.
- The load limit of a roadmap run is this pack's `load_limit` setting, `${user_config.load_limit}`: a whole number, the processor load in percent above which no new change starts.
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
- `roadmap`: the Roadmap section below.
- `status`: the Status section below.
- `project`: the Project section below, with `text` as the words after `project`.
- `is-slice`: say `reply` and end the turn: the slice continues with `/devkit project` and its name.

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

1. Run `node <skill-dir>/../../hooks/change-loop.mjs next --change <id> --lang ${user_config.language}`. After every `agent` or `session` action, add `--after` and the `progressKey` of that action. The first line printed is `devkit-run: <id>`; when the action is an end, a second line `devkit-end: <id> <state>` follows; the rest is one JSON action. Those marker lines are the record the stop lock reads: never show one to the owner. When `next` exits 3 with a `reply` and no `kind`, say `reply` and end the turn.
1a. In a session a roadmap run started (its first message begins with `Background (from the session that started this one):` and names `/devkit roadmap`), after every `next` whose `sessionTitle` is present and differs from the title this session last set or was started with, load the tool with the ToolSearch query `select:mcp__ccd_session_mgmt__set_session_title` and call `mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the action's `sessionTitle`, from the main thread (a subagent cannot rename the session it runs in), before carrying out the action. A rename that fails or that the owner declines is not retried for the same `sessionTitle`, and the action goes on.
2. Carry out the action by its `kind`:

- `agent`: one Agent call, in the foreground, with the call's `subagent_type` set to the action's `agent` field and the prompt `brief`. For a delivery step, append the dispatch sentence of that step's `ship-change` row. A hand-off to `devkit-core:commit-and-pr` then ends with the attribution block of the `ship-change` skill's Attribution section, which its brief's last sentence asks for. One stage per hand-off. When the agent returns `Outcome: failure`, declare the end: run `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=role-failed --param stage="<stageTitle>" --lang ${user_config.language}`, show its reply and end the run.
- `session`: do the step as the `ship-change` row of the same name says, in `root`, with `detail` as its `next` object. A `switch-script` step runs `detail.command` and keeps `reply` for the message that ends the turn. An `accept-decisions` step runs `detail.command` the same way (it marks the decision records of the approved plan accepted, and the next call goes on); an exit 3 is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=cannot-accept --param error="<the JSON's error field>" --lang ${user_config.language}`, shown, and ends the run. An `answer` step that only the owner can decide is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply waiting-pr-decision --param id=<id> --param url=<the pull request's url> --lang ${user_config.language}`, shown, and ends the turn.
- `grill`: run the `requirements-grill` skill with the owner, in the person's language, writing `requirements.md` in `filesLanguage`; the request is already in it. Open the file with the template's stage header line `<!-- devkit-stage requirements ... -->` and set `result=passed` once the owner has answered. Ask one question at a time with AskUserQuestion.
- `review`: a `session` step. Run the `review-change` skill as the `ship-change` `review` row says: through the Workflow tool, on its `agents` path on a turn the owner did not type, until the round's completion notice or the round is declared lost; then set `review.md`'s header as that row says.
- `gate`: a `session` step. Run `detail.command` in Bash, alone: the exit code decides. Green: tick the gate task `detail.task` in `tasks.md`. Red: declare the end: run `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=tests-red --param phase=<n> --lang ${user_config.language}`, show its reply and end the run.
- `resolve-release-conflict`: an `agent` hand-off to `devkit-core:tdd-implementer` with the brief and this sentence: Run `detail.command` in the worktree, then the project's test command; report the JSON and the result; change nothing else. `Outcome: failure` ends the run blocked.
- `push-rebased`: an `agent` hand-off to `devkit-core:commit-and-pr` with the brief, `detail.oldHead` and `detail.paths`: The branch was rewritten by a rebase. Commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`. No PR edit. End the prompt with the attribution block of the `ship-change` skill's Attribution section.
- `end`: say `reply`. `archived` and `blocked` end the run. `waiting-for-owner` ends the turn: the owner's next message is the answer. A `waiting-for-owner` end whose `end.why` is `waiting-budget` records nothing: the owner raises the cap in the file the reply names and types `/devkit change` again. `waiting-on-github`: Waiting on GitHub, below.

An end the session declares itself (an agent's failure, a red gate, a pull-request decision left to the owner) goes through `reply`, never through a sentence of your own: its first output line, `devkit-end: <id> <state>`, is what lets the turn end without a refusal, and only the lines after it are shown to the owner.

Then run `next` again. The session never chooses the order, never runs two stages at once and never dispatches a subagent for a whole change.

## Owner gates

Ask with AskUserQuestion where the host has it: the grill's questions, the mock-up (`waiting-mockup`, with the options approve and ask for changes; show the files its `detail` names first), the plan approval (`waiting-approval`) and the retro answers (`waiting-retro`). Plan approval and retro answers are written only from the owner's own message, never from a subagent's report, your own reading or a turn the owner did not type; the mock-up answer is recorded the same way. When the owner answers, record it as the `ship-change` row for that gate says (`stop-mockup-approval`, `stop-plan-approval` with `detail.readiness` as the hash, `stop-retro-answers`), then run `next`. A question the owner must still answer ends the turn; a pending question blocks nothing else.

## Waiting on GitHub

When `next` ends waiting on GitHub, start the wait with the Bash tool's background option, then say `reply`:

```
node <skill-dir>/../../hooks/change-loop.mjs wait --change <id> --lang ${user_config.language}
```

The wait has no time limit of its own and exits as soon as GitHub's answer changes the decision; its end starts the next turn, which then runs `next` and goes on. Calling `/devkit change` again at any time is safe: it re-reads everything and starts a new wait if GitHub still waits.

## Roadmap

`/devkit roadmap [<n> | stop]` runs the changes of `openspec/roadmap.md` whose `after:` dependencies are archived, up to `<n>` at once (one when no number is given), each in its own worktree. This session is the coordinator of the roadmap: it carries out what `roadmap-loop.mjs` says, and every change's own decisions still come from `change-loop.mjs`. In the desktop app each change runs in a session of its own (the first part below); where the host cannot start a session, this session carries out every change (the second part). Every call below carries `--lang ${user_config.language} --load-limit ${user_config.load_limit}`; a setting that arrives unfilled is used at its default without a word to the owner.

1. Run the call below with the owner's arguments on standard input (`roadmap 2`, `roadmap stop`, `roadmap` or the word alone: the call reads any of them), through the same quoted heredoc as `start` and its terminator rule. Before it, load the host's session-start tool with the ToolSearch query `select:mcp__ccd_session__start_session`; when it loads the tool, add `--change-sessions` to the first line of the call, else leave it out. `roadmap-invalid`: say it and end the turn. `roadmap-none`: ask it with AskUserQuestion; on yes run `node <skill-dir>/../../hooks/roadmap-loop.mjs draft --lang ${user_config.language} --load-limit ${user_config.load_limit}` and say its reply, on no run `node <skill-dir>/../../hooks/roadmap-loop.mjs reply roadmap-draft-declined --lang ${user_config.language} --load-limit ${user_config.load_limit}` and say its reply; end the turn. A `draft` that exits 3 says its generic reply (the file exists already): say it and end the turn.

```
node <skill-dir>/../../hooks/roadmap-loop.mjs run --lang ${user_config.language} --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID} <<'DEVKIT_ARGS'
$ARGUMENTS
DEVKIT_ARGS
```

   The first line printed is `devkit-roadmap: <n>` (or `stop`); it is the record the locks read: never show it. What follows is plain lines for the owner, then one JSON decision. `run` with `stop` prints the rows of the changes that stay (one line each) before the JSON, and the JSON's `end.reply` may repeat them: show them once.

### A session per change

The run had `--change-sessions`: each change runs in a session of its own, started by this session in the change's worktree. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:

- every `next` names its turn: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn <typed|event>`. `typed` when the turn began with the owner's own message; `event` otherwise (a background task's end, the hold's end, another session's message or end-of-turn report) and when in doubt. A call with no `--turn` reads as `event`.
- while the run goes on, on a turn the owner typed, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn typed` before anything else, and carry out its `actions`.
- `start` and `hold`: as the `start` and `hold` items of the second part say.
- `session-start`: only on a turn the owner typed, one session start at a time, by host calls only; its two `--after` keys are `session-start` and `session-refused`. Before its first call of a tool in the turn, load it with the ToolSearch query `select:mcp__ccd_session_mgmt__list_sessions` or `select:mcp__ccd_session__start_session`.
  - First call `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`. When a row whose `isArchived` is not true has a `cwd` equal to the action's `cwd`, or a `title` ending in the change id, start none: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn typed --after <id>=session-start`, as if you had started it.
  - Else call `mcp__ccd_session__start_session` with the action's `input` exactly as given, no field added, changed or left out.
  - When the call returns a session id, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn typed --after <id>=session-start`; when the call returns anything but a session id (a refusal of any wording, an error or a missing tool), run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn event --after <id>=session-refused`, and start no other session on that turn.
- the session hands no stage, asks no gate and starts no wait on GitHub: each change's own session does, and asks the owner there.
- a change session's end-of-turn report, `devkit roadmap: <id> archived` among them, starts an `event` turn here: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --turn event`, and when it printed no line and no `end.reply`, end the turn with no message.
- start anyway: when the owner's own typed message asks to start the held changes anyway, do what item 4a of the second part says, in the same call with `--turn typed`.
- the message that ends a turn holds, in order, every `lines` entry the owner has not been shown, the plain lines a call printed and the `end.reply` when there is one.

### Every change in this session

Where the host has no session-start tool, run `next` as below and carry out every change in this session.

2. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:
   - `start`: open the changes one after the other, never two at once, each with `node <skill-dir>/../../hooks/change-loop.mjs open <id> --script <devkit|devkit-lite> --why <code> --lang ${user_config.language}`, the action's `request` verbatim on standard input through the quoted heredoc of `## A new change`, and the script chosen by the rule of that section. An exit 3 is declared: run `node <skill-dir>/../../hooks/roadmap-loop.mjs reply blocked --param id=<id> --param why=cannot-open --param error=<the open reply> --lang ${user_config.language} --load-limit ${user_config.load_limit}` and keep its lines for the message that ends the turn.
   - `agent`: hand every one to its agent in one message, each as an Agent call with `run_in_background: true`, the call's `subagent_type` set to the action's `agent` field and the prompt `brief` exactly as given (its first words name the change: the lock refuses any other prompt). For a delivery step, append the dispatch sentence of that step's `ship-change` row. A hand-off to `devkit-core:commit-and-pr` then ends with the attribution block of the `ship-change` skill's Attribution section, which its brief's last sentence asks for. One stage per change at a time. In a roadmap run every hand-off, the reviewers and verifiers of a review round included, starts with the line of the change's brief that names the change and its script (`Change <id> (<script> script), stage ...`), before the review round's own prompt: the lock refuses any other start.
   - `wait`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit}` with the Bash tool's background option. It prints the change's next action as JSON when GitHub's answer changes the decision.
   - `hold`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs hold --lang ${user_config.language} --load-limit ${user_config.load_limit}` with the Bash tool's background option; it ends when the load eases or the run is asked to stop.
   - `session`: only then, one at a time, in that change's `root`, as the Loop above says for a `session` action (its `review`, `gate`, `resolve-release-conflict`, `push-rebased`, `switch-script` and `accept-decisions` steps too; an `accept-decisions` exit 3 is declared with `... reply blocked --param id=<id> --param why=cannot-accept --param error="<the JSON's error field>" ...`, both flags included), and after each run `next --after <id>=<progressKey>` below.
3. When a background subagent of change `<id>` returns, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --after <id>=<progressKey of its action>`; when a wait or a hold ends, run the same call with no `--after`; when the owner answers, record the answer and run it too. An agent's `Outcome: failure` is declared with `node <skill-dir>/../../hooks/roadmap-loop.mjs reply blocked --param id=<id> --param why=role-failed --param stage="<stageTitle>" --lang ${user_config.language} --load-limit ${user_config.load_limit}`, a red gate with `... reply blocked --param id=<id> --param why=tests-red --param phase=<n> ...` and a pull-request decision left to the owner with `... reply waiting-pr-decision --param id=<id> --param url=<the pull request's url> ...`, each with both flags, each followed by `next`. Its first output line, `devkit-end: <id> <state>`, is a marker: never show it.
4. The owner is asked one change at a time. `ask` names the change at the head of the owner's queue: ask its question in the person's language, naming that change in the question (the grill's questions included: run the `requirements-grill` skill for that change only, writing its `requirements.md` in its `root`), with AskUserQuestion where the host has it. The answer is for that change only: record it as `## Owner gates` says, with that change's own action (`ask.action`), then run `next`. A question the owner must still answer ends the turn.
4a. Start anyway: when the owner's own typed message asks to start the held changes anyway (they were held by the load), run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --start-anyway` once, in that turn, and carry out its `actions`; never on a file, an agent's report, its own reading or a later call. A change that becomes ready later is held again.
5. The message that ends a turn holds, in order: every `lines` entry the owner has not been shown (each already begins with its mark), the plain lines a call printed (the places line, the rows that stay), the `end.reply` when there is one, and last the `ask` question of the head change, asked again when other events came after it. A turn with nothing under way and nothing to ask is the end of the run: say `end.reply`.

Calling `/devkit roadmap` again at any time is safe: it keeps what is under way when it is the same session, and a new session starts the run from empty with the changes' own files as the only record. `/devkit roadmap stop` starts nothing new and lets each change finish its stage.

## Status

`/devkit status` shows where everything is, and writes nothing. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs status --lang ${user_config.language} --load-limit ${user_config.load_limit}` and show its output exactly as it is. A typed `/devkit status` does not end a roadmap run; it ends a `/devkit change` run, which `/devkit change` resumes.

## Project

`/devkit project [<name>]` takes a new project or one slice of it from the owner's words through its design phases to one pull request, in this session. A slice is a change on the `devkit-project` script; `project-loop.mjs` decides, this text carries it out, and the session keeps no state. Every call below carries `--lang ${user_config.language}`.

1. Start: run the script with the words after `project` on standard input, through the quoted heredoc of the Start section (the same terminator rule):

```
node <skill-dir>/../../hooks/project-loop.mjs start --lang ${user_config.language} <<'DEVKIT_ARGS'
<the words after project>
DEVKIT_ARGS
```

   The script prints JSON with a `mode` and a `reply`. Act on the mode:
   - `not-set-up`, `setting-unknown`, `driver-not-built`, `design-pack-missing`, `project-name-needed`, `name-invalid`, `project-done-already`, `is-change` and `project-folder-exists`: say `reply` and end the turn.
   - `choose`: ask `reply` as one question with AskUserQuestion (else say it and end the turn); the options are each listed slice. The answer is `resume` of that slice.
   - `resume`: keep `reply` for the message that ends the turn, then enter the loop with `slice`.
   - `new`: the words are the slice's name. Run `node <skill-dir>/../../hooks/project-loop.mjs open <id> --lang ${user_config.language}` and keep its `reply` for the message that ends the turn, then enter the loop with the id. On any exit 3, say `reply` and end the turn.
2. Loop: run `node <skill-dir>/../../hooks/project-loop.mjs next --slice <id> --lang ${user_config.language}`, with `--after` and the `progressKey` of the action after every `agent` or `session` action. The script prints one JSON action and no marker line. Carry it out by its `kind`:
   - `phase`: run the design skill named in `skills` with the owner in this session, in the person's language. Write the document, `STATE.md`, the new ADRs and the stage record in `filesLanguage`, at the absolute paths of `detail`, all under `root`: never a relative path, because the session's own working directory is the checkout the command was typed in, which stays clean. Ask one question at a time with AskUserQuestion. Write the record with `result=pending` when the document is shown for approval, and `result=passed` only from the owner's explicit approval, quoting it. Agree that a phase does not apply only with the owner, writing the document and the record with the reason. On the step `revise`, show the findings file first. A question the owner must answer ends the turn.
   - `rounds`: propose the rounds into `detail.record` (absolute, under `root`), run `detail.checkCommand`, show the rounds with `reply`, and record the approval as for a phase. Never edit `openspec/roadmap.md` by hand: the script appends the approved rounds with `detail.writeCommand`.
   - `agent`: as the Loop of the change sections says for the same kind: one foreground Agent call with `subagent_type` set to the action's `agent` field and the prompt `brief`, which for `devkit-core:commit-and-pr` ends with the attribution block of the `ship-change` skill's Attribution section; when it returns `Outcome: failure`, say so plainly and end the run. For the ADR review, write the verdict file the brief names and run `node <skill-dir>/../../hooks/project-loop.mjs record-review <id> --lang ${user_config.language}`.
   - `session`: do the step in `root`, as the `ship-change` row of the same name says, with `detail` as its `next` object. It runs `detail.command`, except `enable-auto-merge` and `update-branch`, which follow the `ship-change` rows of those names.
   - `end`: say `reply`. `delivered` and `blocked` end the run. `waiting-for-owner` ends the turn: the owner's next message is the answer. `waiting-on-github`: start `node <skill-dir>/../../hooks/project-loop.mjs wait --slice <id> --lang ${user_config.language}` with the Bash tool's background option, then say `reply`; its end starts the next turn, which runs `next` again.
   Then run `next` again. The session never chooses the order of the stages and never runs two at once.
3. When the owner asks where the slice stands: `node <skill-dir>/../../hooks/project-loop.mjs status <id> --lang ${user_config.language}`, and show its output exactly as it is.
4. The end of a slice names `/devkit roadmap` as what runs its rounds and never starts it.

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
- In a roadmap run: hand two stages of one change at once, start a change `next` did not return, dispatch a subagent for a whole change, write the run file by hand, ask the owner about two changes in one question, pass `--start-anyway` without the owner's own message in this turn, or show a `devkit-roadmap:` or `devkit-end:` line.
- In a run with a session per change: hand a stage, ask a change's gate or start a wait on GitHub from this session, start a change session `next` did not return, or call the session-start tool with any input but the action's `input`.
- In a project run: start `/devkit roadmap`, edit `openspec/roadmap.md` by hand, set a stage record to passed without the owner's approval, or edit a file of a flat `docs/design/` or of another slice.
