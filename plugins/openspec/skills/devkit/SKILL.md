---
name: devkit
description: "Runs one change from the owner's request to its archive in this session: /devkit change <what to do> opens the change in its own worktree and carries it, stage by stage, asking the owner only at the owner's gates (the grill, the mock-up, the plan approval, the retro answers) and waiting on GitHub with no time limit; /devkit change alone continues the unfinished change. /devkit change <Jira key or link> opens the change from that task, read through the session's Atlassian connector, and asks once, when the pull request opens, whether to write its link back. /devkit roadmap [<n>] runs the roadmap's ready changes, several at once, and /devkit status shows where everything is. /devkit train departs the boarded changes of a project with a delivery train, together on one train. /devkit project [<name>] plans a new project or slice phase by phase with the owner (business, domain model, architecture, implementation plan, roadmap), then delivers it as one pull request. Every decision comes from the change-loop, roadmap-loop and project-loop scripts, never from this text. Use when the owner types /devkit, /devkit change <what to do>, /devkit change <Jira key or link>, /devkit change to continue, /devkit roadmap [<n> | stop], /devkit status, /devkit train or /devkit project [<name>]."
argument-hint: "change [<request> | <change-id> | <Jira key or link>] | roadmap [<n> | stop] | status | train | project [<name>]"
disable-model-invocation: true
---

# /devkit change

`/devkit change <request>` takes one change from the owner's words to its archive, in this session, with one script that decides. This skill is the session's side of it: the script `change-loop.mjs` says what comes next, and this text says how to carry it out. It keeps no state: every call re-reads the change's files, git and GitHub, and the session's transcripts when the project sets a token budget. The session is the change coordinator; it never writes product code itself.

Path used below: `<skill-dir>/../../hooks/change-loop.mjs`, where `<skill-dir>` is this skill's directory. Every call of the script carries `--lang ${user_config.language}`. The roadmap sections below use `<skill-dir>/../../hooks/roadmap-loop.mjs`, whose every call also carries `--load-limit ${user_config.load_limit}`; every call of `run`, `next`, `check`, `status` and `checkout` also carries `--machines '${user_config.machines}'`. The Project section uses `<skill-dir>/../../hooks/project-loop.mjs`.

## Settings

- The person's language is this pack's `language` setting, `${user_config.language}` (`pt-BR` or `en`): the replies, the grill's questions and the stage readout use it. Say every `reply` of the script as it is.
- The load limit of a roadmap run is this pack's `load_limit` setting, `${user_config.load_limit}`: a whole number, the processor load in percent above which no new change starts.
- The other machines of a roadmap run are this pack's `machines` setting, `${user_config.machines}`: a JSON list, empty by default. Every roadmap call passes it as it arrives, and the script reads it.
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

- `not-built`, `unknown-verb`, `not-set-up`, `setting-unknown`, `driver-not-built`, `driver-no-project`, `nothing` and `train-args`: say `reply` and end the turn. When the JSON's `settings.driver` is `compozy`, read the next section instead of the lines below.
- `choose` and `ask-unfinished`: ask `reply` as one question with AskUserQuestion (else say it and end the turn). The options are each listed id and, for `ask-unfinished`, "start the new request". The answer is `resume` of that id, or the new change below; when `task` is not null, "start the new request" goes to `### A Jira task`.
- `resume`: keep `reply` for the message that ends the turn, then enter the Loop with `change`. The `reply` may hold a second line, about a newer flow: keep it as it is.
- `new`: a new change, below.
- `task`: the request is a Jira key or link, in `task`: a new change from that task, in `### A Jira task` below.
- `roadmap`: the Roadmap section below.
- `status`: the Status section below.
- `train`: the Train section below.
- `project`: the Project section below, with `text` as the words after `project`.
- `is-slice`: say `reply` and end the turn: the slice continues with `/devkit project` and its name.

## On the CompozyOS driver

Read this section when `start`'s JSON has `settings.driver: compozy`. CompozyOS runs the loop of the change, and this session only starts or resumes that run: it runs no loop, hands no stage and asks nothing of the change (the grill, the approvals and the retro are asked in CompozyOS). Pass the request through the quoted heredoc as `start` does, with the same terminator rule, and in every case below say `reply` and end the turn.

- `new`: propose the id by the rule of "A new change", choose no script, and run the call below. `name-taken`: propose another id and run it again. `name-invalid`: say `reply` and end the turn.
- `resume`: run the same call with the JSON's `change` as `<id>` and an empty heredoc.
- `choose` and `ask-unfinished`: ask as `start` says above, then run the call with the answer: `resume` of the chosen id, or `new` for the new request.
- `roadmap`: run `node <skill-dir>/../../hooks/roadmap-loop.mjs compozy-start --lang ${user_config.language} --load-limit ${user_config.load_limit} <<'DEVKIT_ARGS'` with `$ARGUMENTS` as the heredoc body, as the Roadmap section does for `run`.
- `status`: the Status section, unchanged.
- `driver-no-project`: say `reply` and end the turn.

```
node <skill-dir>/../../hooks/change-loop.mjs compozy-start <id> --lang ${user_config.language} <<'DEVKIT_ARGS'
<the request>
DEVKIT_ARGS
```

The call prints JSON with a `mode`, a `reply`, the run's `runId` and its `url`, and never a `devkit-run:` line. Every mode ends the turn with `reply`, and an exit 3 too (`compozy-unavailable` names what to fix). A change that CompozyOS already runs answers `compozy-running`: say it, start nothing.

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

When the owner asks to move the change to the newer flow the readout or the resume reply named, run `node <skill-dir>/../../hooks/change-loop.mjs flow <id> --lang ${user_config.language}` and say its reply; never run it unasked.

### A Jira task

The `task` mode opens the change from a Jira task. The script makes no call to Jira and keeps no token: this session reads the task through its own Atlassian connector.

1. Load the connector's Jira tools with ToolSearch (query `jira issue`). The read tool is the one whose name ends in `getJiraIssue`. Its siblings are `getTransitionsForJiraIssue`, `addCommentToJiraIssue`, `transitionJiraIssue` and `getAccessibleAtlassianResources` (the `cloudId` when the read tool asks for one). Use the site whose host the typed link names, else try each accessible site until one reads the task. When no read tool loads, run `node <skill-dir>/../../hooks/change-loop.mjs reply task-no-connector --param key=<KEY> --lang ${user_config.language}`, say it and end the turn.
2. Read the task. A not-found, a refusal or any error runs `node <skill-dir>/../../hooks/change-loop.mjs reply task-unreadable --param key=<KEY> --lang ${user_config.language}`; say it and end the turn.
3. Build the JSON with these fields: `key`; `url`, the task's browse link `https://<site>/browse/<KEY>`, else the typed link; `title`, the summary; `description`, as text, in the Markdown form when the connector offers one; `acceptanceCriteria`, the value of the field whose name is "Acceptance criteria", compared without case, when the project has one, else `null`. Nothing else of the task goes in.
4. Propose the id `<task.idPrefix>-<subject in at most four words>`, at most 48 characters. Choose the script by the rule above, applied to the task's text.
5. Run the call below with the JSON on standard input, through the same quoted heredoc and its terminator rule. On `name-taken`, choose another id. On `task-taken` or any other exit 3, say `reply` and end the turn. Keep the opening `reply` for the message that ends the turn, then enter the Loop with the id.

```
node <skill-dir>/../../hooks/change-loop.mjs open <id> --script <s> --why <code> --task <KEY> --lang ${user_config.language} <<'DEVKIT_ARGS'
<the JSON of step 3>
DEVKIT_ARGS
```

## Loop

Repeat until an action of kind `end`. From the implementation on, the order is the script's: `verify` (the evidence) comes before `review`, and a fix outside the change's folder makes both stale (`verify`, then `review`).

1. Run `node <skill-dir>/../../hooks/change-loop.mjs next --change <id> --lang ${user_config.language}`. After every `agent` or `session` action, add `--after` and the `progressKey` of that action. The first line printed is `devkit-run: <id>`; when the action is an end, a second line `devkit-end: <id> <state>` follows; the rest is one JSON action. Those marker lines are the record the stop lock reads: never show one to the owner. When `next` exits 3 with a `reply` and no `kind`, say `reply` and end the turn.
1a. In a session a roadmap run started (its first message begins with `Background (from the session that started this one):` and holds a `devkit-start:` line), call the Skill tool with its `skill` field set to `devkit-openspec:devkit-session` and follow that skill in place of this Loop. This covers an owner who types `/devkit change <id>` in such a session.
2. Carry out the action by its `kind`:

- `agent`: one Agent call, in the foreground, with the call's `subagent_type` set to the action's `agent` field and the prompt `brief`, and its `model` set to the action's `model` with any `[1m]` suffix removed. For a delivery step, append the dispatch sentence of that step's `ship-change` row. A hand-off to `devkit-core:commit-and-pr` then ends with the attribution block of the `ship-change` skill's Attribution section, which its brief's last sentence asks for. One stage per hand-off. When the agent returns `Outcome: failure`, run `next` with `--after` as after any agent: the loop hands the stage once more on a stronger model or ends the run blocked; a `ship-change` row's own words on a failure do not apply here.
- `session`: do the step as the `ship-change` row of the same name says, in `root`, with `detail` as its `next` object. A `take-place` step runs `detail.command`, then `next`, whatever its exit code. A `switch-script` step runs `detail.command` and keeps `reply` for the message that ends the turn. An `accept-decisions` step runs `detail.command` the same way (it marks the decision records of the approved plan accepted, and the next call goes on); an exit 3 is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=cannot-accept --param error="<the JSON's error field>" --lang ${user_config.language}`, shown, and ends the run. An `answer` step that only the owner can decide is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply waiting-pr-decision --param id=<id> --param url=<the pull request's url> --lang ${user_config.language}`, shown, and ends the turn. A `tag-release` step that stops (a refused push, a local tag at another commit) is declared with `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=archive-failed --lang ${user_config.language}`, shown with git's first error line, and ends the run.
- `grill`: run the `requirements-grill` skill with the owner, in the person's language, writing `requirements.md` in `filesLanguage`; the request is already in it. Open the file with the template's stage header line `<!-- devkit-stage requirements ... -->` and set `result=passed` once the owner has answered. Ask one question at a time with AskUserQuestion. The skill hands the drafted questions to `devkit-core:requirements-triage` first only when the action's `helpers` include `requirements-triage` (the `helpers` of the action `next` (or `session-next`) printed here, of `ask.action` in the coordinating session); with no permission every question goes to the owner, one at a time, as before. When `detail.unsourced` is present, the triage answers it lists name no source: ask the owner those questions and rewrite the items with the owner's answer. When the action carries `task`, follow the requirements-grill skill's paragraph on a request copied from a task, and leave `## Request` (its `Jira:` line and its quoted parts) exactly as it is.
- `review`: a `session` step. Run the `review-change` skill as the `ship-change` `review` row says: through the Workflow tool, on its `agents` path on a turn the owner did not type, until the round's completion notice or the round is declared lost; then set `review.md`'s header as that row says.
- `gate`: a `session` step. Run `detail.command` in Bash, alone: the exit code decides. Green: tick the gate task `detail.task` in `tasks.md`. Red: declare the end: run `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=tests-red --param phase=<n> --lang ${user_config.language}`, show its reply and end the run.
- `resolve-release-conflict`: an `agent` hand-off to `devkit-core:tdd-implementer` with the brief and this sentence: Run `detail.command` in the worktree, then the project's test command; report the JSON and the result; change nothing else. `Outcome: failure` goes back to `next`, as for any agent. The command merges `origin/<base>` into the branch and commits the merge with the release renumbered above the base's; then the loop hands `verify` and `review` for what the merge made stale, and a plain `push` (`open-archive-pr` on an archive branch) with `detail.command` `git push origin <branch>`, never a force push.
- `renumber-adr`: an `agent` hand-off to `devkit-core:tdd-implementer` with the brief and this sentence: Rename each of `detail.files` from its `from` path to its `to` path with `git mv`, change every reference to it in the branch's files, then run the project's test command; change nothing else. `Outcome: failure` goes back to `next`, as for any agent.
- `end`: say `reply`. `archived` and `blocked` end the run. `waiting-for-owner` ends the turn: the owner's next message is the answer. A `waiting-for-owner` end whose `end.why` is `waiting-budget` records nothing: the owner raises the cap in the file the reply names and types `/devkit change` again. `waiting-on-github`: Waiting on GitHub, below.

An end the session declares itself (a red gate, a pull-request decision left to the owner) goes through `reply`, never through a sentence of your own: its first output line, `devkit-end: <id> <state>`, is what lets the turn end without a refusal, and only the lines after it are shown to the owner.

An action whose `baseFetch.ok` is false ends its `reply` with one line saying the step was decided from this machine's copy of the base: keep that line for the message that ends the turn, whatever the action's kind.

Then run `next` again. The session never chooses the order, never runs two stages at once and never dispatches a subagent for a whole change.

### Writing back to the task

- When an action carries `writeBack`, before carrying the action out, read the task's transitions with the connector (`[]` when it cannot). Run the call below with `{ "number", "url", "transitions": [{ "id", "name" }] }` on standard input, through the quoted heredoc and its terminator rule.

```
node <skill-dir>/../../hooks/change-loop.mjs write-back ask <id> --lang ${user_config.language} <<'DEVKIT_ARGS'
<the JSON>
DEVKIT_ARGS
```

- On `ask: true`, keep `question` for the message that ends the turn. Ask it as plain text, never with AskUserQuestion, because that would hold the turn and with it the delivery. Then carry out the action.
- Only the owner's own typed message answers. Map it to one `choices[].choice`; an answer that maps to none gets the question said again. Then run `node <skill-dir>/../../hooks/change-loop.mjs write-back answer <id> --choice <choice> --lang ${user_config.language}`.
- On `write: true`, add `comment` to the task and then apply `transition.id` when present, and say `reply`. On a connector failure, run `node <skill-dir>/../../hooks/change-loop.mjs reply write-back-failed --param key=<KEY> --param error="<message>" --lang ${user_config.language}` and say it; the write is not retried. On `write: false`, say `reply`.
- Then go on: when no wait on GitHub is running and the run has not ended, run `next`.

## Owner gates

Ask with AskUserQuestion where the host has it: the grill's questions, the mock-up (`waiting-mockup`, with the options approve and ask for changes; show the files its `detail` names first), the plan approval (`waiting-approval`) and the retro answers (`waiting-retro`). Plan approval and retro answers are written only from the owner's own message, never from a subagent's report, your own reading or a turn the owner did not type; the mock-up answer is recorded the same way. When the owner answers, record it as the `ship-change` row for that gate says (`stop-mockup-approval`, `stop-plan-approval` with `detail.readiness` as the hash, `stop-retro-answers`), then run `next`. A question the owner must still answer ends the turn; a pending question blocks nothing else. The write-back question is not a gate and blocks nothing.

## Waiting on GitHub

When `next` ends waiting on GitHub, start the wait with the Bash tool's background option, then say `reply`:

```
node <skill-dir>/../../hooks/change-loop.mjs wait --change <id> --lang ${user_config.language}
```

The wait has no time limit of its own and exits as soon as GitHub's answer changes the decision; its end starts the next turn, which then runs `next` and goes on. Calling `/devkit change` again at any time is safe: it re-reads everything and starts a new wait if GitHub still waits.

## Train

`/devkit train` departs the boarded changes and archives of a project with a delivery train, together, on one train. The script `<skill-dir>/../../hooks/train-loop.mjs` decides and this text carries it out; the session keeps no state, and every call carries `--lang ${user_config.language}`. A project with no `devkit.delivery.train` gets a blocked end saying so, and nothing is created.

1. Run `node <skill-dir>/../../hooks/train-loop.mjs next --lang ${user_config.language}`, adding `--after` and the `progressKey` of the action after every `session` action. It prints one JSON action (`kind`, `step`, `detail`, `reply`, `progressKey`, and `end` on an end) and exits 0 on an action, 1 on a wait, 2 when blocked, 3 when it cannot read git or GitHub.
2. Carry the action out by its `kind`:
   - `session`, step `depart` or `update-train`: run `detail.command` with the Bash tool's background option (it runs the project's whole suite and takes minutes), and run `next` when it ends. The command prints JSON; when it exits 1 or 2 and the JSON has a `reply`, say the `reply` and end the turn.
   - any other `session` step (`push-train`, `open-train-pr`, `enable-auto-merge`, `close-boarded-pr`, `clean-train`): run `detail.command` alone in Bash and let its exit decide, say the action's `reply` when it has one, then run `next`. Never add a flag to it, and never force a push.
   - `end`: say `reply`. `blocked` ends the run. `waiting-for-owner` ends the turn: the owner's next message is the answer. `waiting-on-github`: start `node <skill-dir>/../../hooks/train-loop.mjs wait --lang ${user_config.language}` with the Bash tool's background option, then say `reply`; its end starts the next turn, which runs `next` again.
3. Calling `/devkit train` again at any time is safe: `next` re-reads git and GitHub, starts no second train while one is under way, and says so when a departure holds its lock.

The coordinating session of a roadmap run may run the same calls; when it does so on its own is decided by the roadmap, not here.

## Roadmap

`/devkit roadmap [<n> | stop]` runs the changes of `openspec/roadmap.md` whose `after:` dependencies are archived, up to `<n>` at once (one when no number is given), each in its own worktree. This session is the coordinator of the roadmap: it carries out what `roadmap-loop.mjs` says, and every change's own decisions still come from `change-loop.mjs`. In the desktop app each change runs in a session of its own (the first part below); where the host cannot start a session, this session carries out every change (the second part). Every call below carries `--lang ${user_config.language} --load-limit ${user_config.load_limit}`; a setting that arrives unfilled is used at its default without a word to the owner.

1. Run the call below with the owner's arguments on standard input (`roadmap 2`, `roadmap stop`, `roadmap` or the word alone: the call reads any of them), through the same quoted heredoc as `start` and its terminator rule. Before it, load the host's session-start tool with the ToolSearch query `select:mcp__ccd_session__start_session`; when it loads the tool, add `--change-sessions` to the first line of the call, else leave it out. Load the host's schedule tool the same way, with the ToolSearch query `select:CronCreate`; when it loads, add `--cron` to the first line of the call too, else leave it out. `roadmap-invalid`: say it and end the turn. `roadmap-none`: ask it with AskUserQuestion; on yes run `node <skill-dir>/../../hooks/roadmap-loop.mjs draft --lang ${user_config.language} --load-limit ${user_config.load_limit}` and say its reply, on no run `node <skill-dir>/../../hooks/roadmap-loop.mjs reply roadmap-draft-declined --lang ${user_config.language} --load-limit ${user_config.load_limit}` and say its reply; end the turn. A `draft` that exits 3 says its generic reply (the file exists already): say it and end the turn.

```
node <skill-dir>/../../hooks/roadmap-loop.mjs run --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --session ${CLAUDE_SESSION_ID} <<'DEVKIT_ARGS'
$ARGUMENTS
DEVKIT_ARGS
```

   The first line printed is `devkit-roadmap: <n>` (or `stop`); it is the record the locks read: never show it. What follows is plain lines for the owner, then one JSON decision, whose `check` field is the job id of the run's periodic check (null when it has none). `run` with `stop` prints the rows of the changes that stay (one line each) before the JSON, and the JSON's `end.reply` may repeat them: show them once.

### A session per change

The run had `--change-sessions`: each change runs in a session of its own, started by this session in the change's worktree. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:

- every `next` names its turn: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn <typed|event>`. `typed` when the turn began with the owner's own message; `event` otherwise (a background task's end, the hold's end, another session's message or end-of-turn report) and when in doubt. A call with no `--turn` reads as `event`.
- while the run goes on, on a turn the owner typed, first load `select:CronList` and call `CronList`; when the job the last decision's `check` field names is not in its list (a recurring job expires after 7 days), add `--check-gone` to the call below. Then run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn typed` before anything else, and carry out its `actions`.
- `start` and `hold`: as the `start` and `hold` items of the second part say.
- `session-start`: only on a turn the owner typed, one session start at a time, by host calls only; its `--after` keys are `session-start`, `session-found` and `session-refused`. Before its first call of a tool in the turn, load it with the ToolSearch query `select:mcp__ccd_session_mgmt__list_sessions` or `select:mcp__ccd_session__start_session`.
  - When the action has a `checkout` (the change is placed on another machine), run that command first, in Bash, alone: on exit 0 go on with the steps below; on any other exit declare it with `node <skill-dir>/../../hooks/roadmap-loop.mjs reply blocked --param id=<id> --param why=cannot-check-out --param machine=<the action's machine> --param error=<the reply of the checkout> --lang ${user_config.language} --load-limit ${user_config.load_limit}`, keep its lines for the message that ends the turn, and start no session for it.
  - First call `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`. When a row whose `isArchived` is not true has a `cwd` equal to the action's `cwd`, or a `title` ending in the change id, start none: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn typed --after <id>=session-found`: the session is found running, not started by you.
  - Else call `mcp__ccd_session__start_session` with the action's `input` exactly as given, no field added, changed or left out.
  - When the call returns a session id, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn typed --after <id>=session-start`; when the call returns anything but a session id (a refusal of any wording, an error or a missing tool), run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn event --after <id>=session-refused`, and start no other session on that turn.
- `session-model`: on any turn, one switch at a time, only the model the action names, by host calls only; its two `--after` keys are `session-model` and `session-model-refused`. Before its first call of a tool in the turn, load it with the ToolSearch query `select:mcp__ccd_session_mgmt__list_sessions` or `select:mcp__ccd_session_mgmt__set_session_model`.
  - Call `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }` and take the row whose `isArchived` is not true and whose `cwd` equals the action's `cwd`.
  - When a row matches, call `mcp__ccd_session_mgmt__set_session_model` with that row's `sessionId` as `session_id` and the action's `model` as `model`. When the call succeeds, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn <the --turn of the call that returned the action> --after <id>=session-model`.
  - When no row matches, or the call returns anything but success (a refusal of any wording, an error, a missing tool or a question the owner declined), run the same call with `--after <id>=session-model-refused`.
- `wake`: a change waiting for a place on its machine, told to go on. One at a time: load the tool with the ToolSearch query `select:mcp__ccd_session_mgmt__list_sessions` and call it with `{ "linked": true }`, find the change's session (a row whose `isArchived` is not true and whose `title` ends in the change id), load `SendMessage` with the ToolSearch query `select:SendMessage` and send it the action's `message` exactly as given, then run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn event --after <id>=wake`. When no session is found, run the same `next` call all the same: nothing else is sent.
- the session hands no stage but the grill's triage, asks the grills, the plan approvals and the retro answers, and starts no wait on GitHub: each change's own session does that, and asks the owner every other gate there. `ask` names the change at the head of the owner's queue: ask it as item 4 of the second part says, with that change's absolute paths (`ask.action.root`, `ask.action.detail.readiness`): the grill through the `requirements-grill` skill for that change only, the plan approval as the `ship-change` row `stop-plan-approval` says, the retro answers as the row `stop-retro-answers` says, each answer written into that change's folder under `ask.action.root` and only from the owner's own typed message. The change session goes on by itself when its wait sees the file.
- `push`: run the action's `command`, which commits the grill's or the plan's files on the change's branch and pushes the branch, then `next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --after <id>=push`; an exit 3 says its `reply` in one line, and the next decision that asks the push again is a later one.
- `schedule-check`: call `CronCreate` with the action's `input` exactly as given, no field added, changed or left out. When it returns a job id, run `next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --check-id <job id>`; when it returns anything else (a refusal of any wording, an error or a missing tool), run the same call with `--check-refused`, and create no other.
- `delete-check`: call `CronDelete` with `{ id }`, the id the action's `input` gives, then run `next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}'` with `--check-deleted`. A job already gone (it expired, or this session's list lacks it) is no error: run the same call all the same.
- `archive-session`: only for the change of the action; load `select:mcp__ccd_session_mgmt__list_sessions` and `select:mcp__ccd_session_mgmt__archive_session`, call `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`, take the row whose `isArchived` is not true and whose `cwd` equals the action's `cwd` (when it is not null) or whose `title` ends in a space and the change id, and call `mcp__ccd_session_mgmt__archive_session` with `{ session_id, reason }`, the row's id and the action's `input.reason`. Then run `next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --after <id>=session-archived` (also when no row matches). A refusal, an approval the owner has still to give, or a session still working is no error: run the same call with `--after <id>=session-archive-later`, which says it once and keeps the entry for a later decision.
- `stop-own-tasks`: stop with `TaskStop` every background task this session started for the run, and no other.
- `triage`: only the periodic check's call gives it (`### The periodic check` below), and only for a grill whose `helpers` name the triage, so it carries no `helpers` of its own: run the triage step of the `requirements-grill` skill for that change only, in the action's `root`, writing its `### Answered by triage` section and asking the owner nothing.
- a change session's end-of-turn report, `devkit roadmap: <id> archived` among them, starts an `event` turn here: run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --turn event`, and when it printed no line and no `end.reply`, end the turn with no message.
- start anyway: when the owner's own typed message asks to start the held changes anyway, do what item 4a of the second part says, in the same call with `--turn typed`.
- the message that ends a turn holds, in order, every `lines` entry the owner has not been shown, the plain lines a call printed and the `end.reply` when there is one.

### Every change in this session

Where the host has no session-start tool, run `next` as below and carry out every change in this session.

2. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:
   - `start`: open the changes one after the other, never two at once, each with `node <skill-dir>/../../hooks/change-loop.mjs open <id> --script <devkit|devkit-lite> --why <code> --lang ${user_config.language}`, the action's `request` verbatim on standard input through the quoted heredoc of `## A new change`, and the script chosen by the rule of that section. An exit 3 is declared: run `node <skill-dir>/../../hooks/roadmap-loop.mjs reply blocked --param id=<id> --param why=cannot-open --param error=<the open reply> --lang ${user_config.language} --load-limit ${user_config.load_limit}` and keep its lines for the message that ends the turn.
   - `agent`: hand every one to its agent in one message, each as an Agent call with `run_in_background: true`, the call's `subagent_type` set to the action's `agent` field and the prompt `brief` exactly as given (its first words name the change: the lock refuses any other prompt), and its `model` set to the action's `model` with any `[1m]` suffix removed. For a delivery step, append the dispatch sentence of that step's `ship-change` row. A hand-off to `devkit-core:commit-and-pr` then ends with the attribution block of the `ship-change` skill's Attribution section, which its brief's last sentence asks for. One stage per change at a time. In a roadmap run every hand-off, the reviewers and verifiers of a review round included, starts with the line of the change's brief that names the change and its script (`Change <id> (<script> script), stage ...`), before the review round's own prompt: the lock refuses any other start.
   - `wait`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit}` with the Bash tool's background option. It prints the change's next action as JSON when GitHub's answer changes the decision.
   - `hold`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs hold --lang ${user_config.language} --load-limit ${user_config.load_limit}` with the Bash tool's background option; it ends when the load eases or the run is asked to stop.
   - `session`: only then, one at a time, in that change's `root`, as the Loop above says for a `session` action (its `review`, `gate`, `resolve-release-conflict`, `switch-script` and `accept-decisions` steps too; an `accept-decisions` exit 3 is declared with `... reply blocked --param id=<id> --param why=cannot-accept --param error="<the JSON's error field>" ...`, both flags included), and after each run `next --after <id>=<progressKey>` below.
3. When a background subagent of change `<id>` returns, run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --after <id>=<progressKey of its action>`; when a wait or a hold ends, run the same call with no `--after`; when the owner answers, record the answer and run it too. An agent's `Outcome: failure` is reported like its success, with `--after <id>=<progressKey of its action>`: the loop retries it or ends the change blocked itself. A red gate is declared with `... reply blocked --param id=<id> --param why=tests-red --param phase=<n> ...` and a pull-request decision left to the owner with `... reply waiting-pr-decision --param id=<id> --param url=<the pull request's url> ...`, each with both flags, each followed by `next`. Its first output line, `devkit-end: <id> <state>`, is a marker: never show it.
4. The owner is asked one change at a time. `ask` names the change at the head of the owner's queue: ask its question in the person's language, naming that change in the question (the grill's questions included: run the `requirements-grill` skill for that change only, writing its `requirements.md` in its `root`), with AskUserQuestion where the host has it. The answer is for that change only: record it as `## Owner gates` says, with that change's own action (`ask.action`), then run `next`. A question the owner must still answer ends the turn.
4a. Start anyway: when the owner's own typed message asks to start the held changes anyway (they were held by the load), run `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}' --start-anyway` once, in that turn, and carry out its `actions`; never on a file, an agent's report, its own reading or a later call. A change that becomes ready later is held again.
5. The message that ends a turn holds, in order: every `lines` entry the owner has not been shown (each already begins with its mark), the plain lines a call printed (the places line, the rows that stay), the `end.reply` when there is one, and last the `ask` question of the head change, asked again when other events came after it. A turn with nothing under way and nothing to ask is the end of the run: say `end.reply`.

Calling `/devkit roadmap` again at any time is safe: it keeps what is under way when it is the same session, and a new session starts the run from empty with the changes' own files as the only record. `/devkit roadmap stop` starts nothing new and lets each change finish its stage.

### The periodic check

A run with `--cron` keeps one recurring check in this session, about every 30 minutes, created by the `schedule-check` action and deleted by the `delete-check` action when the run ends or is stopped. A turn whose prompt begins with `devkit-roadmap-check:` is a firing of that check: no message from the owner, an `event` turn.

1. Load `select:CronList` and call `CronList`; when the job the last decision's `check` field names is not in its list, add `--check-gone` to the call below: the decision then asks `schedule-check` again, which creates the check again, except after a refusal.
2. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs check --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}'` and carry out its `actions` as the part above says: `triage`, `archive-session`, `push`, `wake`, `delete-check` and `stop-own-tasks`, and `schedule-check` when the check is gone.
3. When the call printed no `lines` entry and no `end.reply`, the session ends the turn with no message; otherwise the message holds those lines, the `end.reply` and the `ask` question as item 5 says.

A firing writes no `approval.md` and no retro answer, hands no stage, starts no session and passes no `--start-anyway`: only the owner's own typed message approves or answers; a job already gone is no error when it is deleted.

## Status

`/devkit status` shows where everything is, and writes nothing. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs status --lang ${user_config.language} --load-limit ${user_config.load_limit} --machines '${user_config.machines}'` and show its output exactly as it is. A typed `/devkit status` does not end a roadmap run; it ends a `/devkit change` run, which `/devkit change` resumes.

## Project

`/devkit project [<name>]` takes a new project or one slice of it from the owner's words through its design phases to one pull request, in this session. A slice is a change on the `devkit-project` script; `project-loop.mjs` decides, this text carries it out, and the session keeps no state. Every call below carries `--lang ${user_config.language}`.

1. Start: run the script with the words after `project` on standard input, through the quoted heredoc of the Start section (the same terminator rule):

```
node <skill-dir>/../../hooks/project-loop.mjs start --lang ${user_config.language} <<'DEVKIT_ARGS'
<the words after project>
DEVKIT_ARGS
```

   The script prints JSON with a `mode` and a `reply`. Act on the mode:
   - `not-set-up`, `setting-unknown`, `driver-not-built`, `driver-no-project`, `design-pack-missing`, `project-name-needed`, `name-invalid`, `project-done-already`, `is-change` and `project-folder-exists`: say `reply` and end the turn.
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
- Write to Jira except from `write-back answer` on the owner's own message.
- Ask the write-back question with AskUserQuestion.
- Copy a comment, subtask, linked task or attachment of a task into the change.
- Keep a Jira token or a Jira setting in the project.
- Create a cron or any scheduled wake-up, except the one periodic check of a roadmap run that `roadmap-loop.mjs` asks for, which only the run's end deletes.
- Push to or commit on the default branch.
- Bypass a hook or a gate (`--no-verify`, `DEVKIT_BYPASS`).
- In a roadmap run: hand two stages of one change at once, start a change `next` did not return, dispatch a subagent for a whole change, write the run file by hand, ask the owner about two changes in one question, pass `--start-anyway` without the owner's own message in this turn, or show a `devkit-roadmap:` or `devkit-end:` line.
- In a run with a session per change: hand a stage, ask a change's other gates or start a wait on GitHub from this session, start a change session `next` did not return, call the session-start tool with any input but the action's `input`, start a session for a change on another machine the run did not open, send a `wake` message `next` did not return, switch a session's model to one `next` did not return, or switch any session up.
- In a project run: start `/devkit roadmap`, edit `openspec/roadmap.md` by hand, set a stage record to passed without the owner's approval, or edit a file of a flat `docs/design/` or of another slice.
