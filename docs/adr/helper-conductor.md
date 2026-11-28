# ADR [helper-conductor]: A roadmap run is conducted by one scheduled task of the project, whose ticks each drive one change from their own session, with no session per change and no question box per change

- Status: accepted
- Accepted by: the owner, on 2026-11-28, in the approval of the plan of change helper-conductor (openspec/changes/helper-conductor/approval.md)
- Date: 2026-11-28
- Revised: 2026-11-28, after the first task's real run (`openspec/changes/helper-conductor/proof/`,
  `decision.md`), with the pick of decision 3 and the task's end of decision 1; then after probe 2
  (`p2-result.md`), with the tick's prompt and its detection (decisions 1 and 2), ADR 0008 decision 5
  and the conservative machine rule (decision 10), before the plan's approval is recorded again;
  then after task 3.6's headless measurement (`p5-empty-tick.md`, `decision.md`), with the tick
  gate's footing in the context, the consequences and the review trigger, the decisions unchanged
- Change: helper-conductor
- Number: none; this record follows the release-note rule (ADR 0034 (0034-release-at-merge.md),
  decision 3), so the delivery of its change gives it the next free number on the base and rewrites
  its citations outside `openspec/changes/`
- Relies on: ADR 0010 (0010-openspec-as-the-harness.md), decision 8, a daemon accepted only as a
  driver whose state is one run's bookkeeping, and nesting proved live before it is trusted;
  ADR 0017 (0017-a-change-state-is-derived-in-one-place.md), decision 1, the state derived in one
  place; ADR 0020 (0020-a-change-can-run-on-another-machine.md), decision 1, the claim on GitHub;
  ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md), decisions 1 to 3 and 5, the train
  itself; ADR 0023 (0023-the-model-is-chosen-by-stage.md), decision 5, one retry a model up; ADR 0032
  (0032-the-loop-declares-the-decisions-outside-the-stage-gates.md), the declared ends
- Supersedes: ADR 0021 (0021-a-roadmap-run-opens-every-change-at-its-start.md), as a whole; the
  parts this record keeps are restated in decision 9, so nothing of ADR 0021 needs to be read for a
  run under this record
- Amends:
  - ADR 0004 (0004-devkit-per-project.md): the exception ADR 0021 decision 1 made for the entry skill
    ends with that skill; the tick's prompt hook (decision 2) acts only on its own envelope, which
    exists only in a project where a run installed the task.
  - ADR 0006 (0006-phases-as-child-sessions.md), decision 3, "schedules nothing", for a roadmap run:
    the run holds one scheduled task of the project while it lasts.
  - ADR 0008 (0008-reviews-as-a-workflow.md), decisions 1, 2 and 5, for a roadmap run: the review
    round runs as its one Workflow script from the tick's session (decision 3), and decision 2's "the
    session the owner's turn started" includes that session. Decision 5's "only on a turn the owner
    typed" is amended alongside: a tick's session, started by the task the owner created on a typed
    turn (decision 1), may run the review Workflow, which probe 2 ran there in the background
    (`proof/p2-result.md`, `workflow_ran`); every other turn that is not typed keeps decision 5's
    Agent path. The Workflow is the review bench only, never the helper: no other step runs through
    the Workflow tool, as decision 1 says.
  - ADR 0010 (0010-openspec-as-the-harness.md), decision 8, the sentence "the owner's gates (grill
    answers, plan approval, retro answers) stay the owner's", as ADR 0021 had amended it: the grill
    answers of decision 5 and the delegations of decision 6.
  - ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decision 2, what counts as a run
    under way: the tick's envelope counts as the run's command in the tick's session; and its
    context's "only the session the owner types in can ask the owner the grill's questions": in a
    roadmap run no change asks; the grill is answered as decision 5 says.
  - ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), decisions 1 and 2 (one level of
    subagents under the typed session) for a roadmap run: the tick's session, not the typed one,
    hands each stage of its claimed change to an agent, still one level of subagents (decision 3);
    decision 3, the locks hold the tick's session as they hold the typed one; decision 4, the run
    file's fields (decision 8).
  - ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decisions 1 to 4: no change
    runs in a session of its own; decisions 5 and 6 lose the change sessions they spoke of.
  - ADR 0017 (0017-a-change-state-is-derived-in-one-place.md), decision 2's "run with a session per
    change" and decision 4's change-session title, which have no session left to apply to in a
    roadmap run; decisions 1 and 3 are unchanged.
  - ADR 0020 (0020-a-change-can-run-on-another-machine.md), decision 4, a session started over SSH,
    and decision 5, "nothing polls and nothing is scheduled" and the message that wakes a place wait:
    each machine runs its own conductor (decision 10); and decision 4's worktree over SSH gives way
    to the change's pushed branch, from which the other machine adds the worktree itself. Decision 3,
    the placement on the machine of the `machines` setting that answers with the fewest open changes,
    does not apply inside a conducted run: a tick opens every item on its own machine, and a loaded
    machine holds the item instead of placing it elsewhere (decision 10). Outside a conducted run
    decision 3 is unchanged, and decisions 1 and 2 (the claim on `origin`, the setting) stay.
  - ADR 0026 (0026-the-devkit-test-suite-runs-by-file-in-parallel.md), decision 1's "several at
    once" and the Negative consequence's mitigation "the runner's concurrency follows the core count",
    in a conducted run: the number of files at once is the run's cap, not the core count, and one
    whole-suite run at a time is in flight on the machine (decision 13).
  - ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md), decision 4, "on request, one at a
    time, with no timer and no cron", and "in a roadmap run the coordinating session sends it": in a
    conducted run a tick, a scheduled firing, dispatches the train when a change has boarded
    (decision 12); one at a time and "a change that boards while a train runs waits for the next"
    stay, and outside a conducted run the train still departs only on `/devkit train`. Decisions 2
    and 5, in a conducted run: a ready pull request whose files are all under `openspec/` (an archive
    or a roadmap edit) boards no train and runs no whole suite; it merges on its required checks
    (decision 13).
  - ADR 0023 (0023-the-model-is-chosen-by-stage.md), decision 4, for a roadmap run: there is no change
    session to start or step down; the tick's session runs on the task's model, and each stage agent
    it hands a stage to runs on the model ADR 0023 gives that stage.

## Context

ADR 0021 let one typed `/devkit roadmap` open every pending change in a session of its own, entered
through a one-use ticket and an entry skill, with one session cron in the coordinating session. The
owner's first real `/devkit roadmap 4` (2026-11-27) broke it at every joint: the host refuses a
session start on any turn the owner did not type (ADR 0014 decision 2 already said so; ADR 0021
relied on the typed turn alone); the ticket re-minted at every `next` (the block of
`plugins/openspec/hooks/roadmap-loop.mjs` that sets `run.tickets[a.change]`) made the entry guard
refuse the opened sessions as `ticket-unknown`; with the places full the stop guard kept demanding
one more opening; a declared owner-decision end stayed stuck until the command was typed again. On
2026-11-28 eleven child sessions each asked the owner questions in boxes the coordinating session
could neither answer nor close. The owner asked for a conductor that answers and drives the changes
itself, with what truly needs the owner shown in one place.

The host now offers a scheduled-tasks tool that starts a session of the project on a schedule. A
session started that way is not a turn of the owner's session, so it does not need the owner's turn
to start. A `UserPromptSubmit` hook that returns `{"decision":"block"}` stops a prompt before the
model is called; the genesi plugin's unstick gate uses it so that an empty firing costs nothing.

The plan's first task ran on 2026-11-28 (`openspec/changes/helper-conductor/proof/p0-delete.md`,
`p1-hooks.md`, `decision.md`) and showed these host facts:

- A scheduled task is refused on a session that works on an SSH host: nothing is created, listed,
  removed or run there. The conductor's task lives on the owner's own machine, the one the desktop
  app runs on.
- A task's session starts in the project root and has the devkit plugin: its `SessionStart` hook
  ran, the devkit skills and agents are listed, the loop script runs, and the Agent and Workflow
  tools are there. It has no session start (`start_session` is absent), which this design does not
  need.
- From that session one Agent call to a devkit agent ran and answered: one level of subagents is
  shown. An agent dispatching further agents (a nested helper) was not shown.
- Deleting, pausing or running a task needs the owner's approval in the app, and the host refuses
  those calls in auto and in bypass permissions mode: a task cannot remove itself unattended.
- A task created on a turn the owner did not type runs in the default permission mode and may pause
  to ask; a task created on the owner's typed turn keeps its tool approvals on the task.

The plan's second probe ran the same day (`openspec/changes/helper-conductor/proof/p2-result.md`):

- A slash command in a task's prompt does not run: `/devkit-openspec:devkit status` reached the
  session only as plain text, and the `devkit` skill is not model-invocable.
- The prompt reaches the session in an envelope: the header `[SCHEDULED TASK - AUTOMATED FIRING OF A
  CONFIGURED PROMPT]` and a short preamble, then `<scheduled-task name="<taskId>" file="<path>">`
  wrapping a host sentence and the stored prompt.
- In that session the Agent and Workflow tools run only in the background and return by a completion
  notification; the Workflow ran the bench's kind of script, and an agent handed an agent one level
  below.
- A run's status is no lock: the run read `succeeded` while a background command it started was
  still alive.

Task 3.6 measured the blocked tick on 2026-11-28 without a scheduled task
(`openspec/changes/helper-conductor/proof/p5-empty-tick.md`): a scheduled task cannot be pointed at
another folder, because `create_scheduled_task` takes no working folder and a task runs in the
project of the session that created it, so the measurement on a real scheduled firing moves to task
6.1. As the coordinator decided on 2026-11-28 (`proof/decision.md`, "Phase 3 measurement and the
tick gate's footing"), until task 6.1's run on the owner's Mac the tick gate (decision 2) rests on:

- two facts measured on scheduled firings: the firing's prompt arrives inside
  `<scheduled-task name="...">` (`p2-result.md`), and the plugin's hooks run in a task's session
  (`p1-hooks.md`);
- one fact measured headless: a `UserPromptSubmit` block of the tick's prompt, bare or in the
  scheduler's envelope, costs 0 turns and 0 tokens in `claude -p` with the machine's plugins
  (`p5-empty-tick.md`);
- one fact not measured: that a `UserPromptSubmit` hook sees a scheduled firing and that its block
  costs no model call there. Task 6.1 measures it, with the cron, the notification tool and two runs
  at once.

ADR 0013 rejected a change-coordinator subagent per change (its option (a)) for three reasons: a
subagent cannot ask the owner, cannot write `approval.md`, and is gone when a wait ends; and it
relies on a nested subagent's end. ADR 0014 and ADR 0006 decision 2 rejected a subagent in place of a
refused session because it hides the change the owner asked to see. ADR 0008 rejected the whole
delivery as one Workflow because it holds long-lived state inside a session. Decisions 3 to 7 answer
each of these.

The same day's run of twelve changes on two machines gave the field facts the owner asked the
conductor to take over from the coordinator's hands (`requirements.md`, "Field facts of
2026-11-28"): a message from a session on another machine queued behind the coordinator's turns and
was never read, so a decision cannot travel by message; a check every five minutes was enough to
read each change's state, answer what was pending, and restart or nudge a change that had stopped; a
plan approval read well as a summary of at most twelve lines, and `approval.md`'s line cuts at 200
characters; siblings on one file needed an order stated at approval; a boarded change waited forever
because nothing ran the train; two items were already delivered or had a parked branch; a planner's
escalation needed only a plain `next` once `requirements.md` held the answer; and the work was split
over machines by pushing each change's branch after `open`. With five changes and a train testing at
once on one 14-core machine, the load average reached 124 (two whole suites at concurrency 14 plus four
gates) and every gate crawled: the places counted sessions, and nothing owned the machine's test
capacity. And train 22 ran the whole suite twice (about 25 minutes each) for one archive pull
request that changed only files under `openspec/`, ended red with no failure text while five gates
loaded the machine, and left the change behind (field fact 12).

## Decision

1. **One typed command, one scheduled task.** `/devkit roadmap <name> [round <k>] [<n>]`, typed once,
   records the run's queue (the items of the chosen roadmap and round, parsed as the change
   `multi-roadmaps` defines) in the run file and creates one scheduled task of the project with the
   host's scheduled-tasks tool, on that typed turn, so the task keeps the session's permission mode
   (a task created on any other turn runs in the default mode). Its prompt names no slash command,
   which a task's prompt cannot run (probe 2): it is the line `devkit-roadmap-tick: <root>`, which
   names the run, and one line telling the session to follow the tick hook's note (decision 2). No
   entry skill is added. Typed again while the task exists, it creates no second task.
   Where the host has no scheduled-tasks tool, or refuses it (a session on an SSH host),
   `/devkit roadmap` says so in one line and runs nothing; there is no fallback to change sessions.
   The task does not remove itself: the host takes only the owner's click in the app to delete,
   pause or run a task, and refuses those calls in auto and bypass mode. After `/devkit roadmap stop`
   or the tick that finds the roadmap done, the run records the end, and the tick hook (decision 2)
   blocks every later firing of the task before the model; the conductor says once, in the one
   owner list (decision 7), that the owner deletes the task with one click in the app. The task
   fires every five minutes (cron
   `*/5 * * * *`; where the first task's real run shows the host refuses it, the shortest interval it
   accepts, recorded and brought to the owner).
2. **An empty tick is refused before the model.** A `UserPromptSubmit` hook of
   `plugins/openspec/hooks/hooks.json` recognises only the tick's envelope. It reads only local files
   (the run file and the change folders; no network, no model) and returns `{"decision":"block"}`
   when no item is ready to move and for every firing after the run's recorded end. On a firing it
   lets through, it adds the tick's note to the session's context: the pack's live paths and the exact
   `roadmap-loop.mjs tick` call, so a pack update leaves no stale path in the stored prompt. Every
   other prompt passes with no output. The locks of ADR 0011 and ADR 0013 detect a tick's session by
   its first message: the scheduler's header, a `<scheduled-task name="devkit-roadmap-tick-...">` tag
   and, inside it, the line `devkit-roadmap-tick: <root>` for the session's own root. Overlapping
   firings are kept apart only by the run file's claims under its lock (decision 3), never by the
   host's run status, which reads finished while a background step still runs (probe 2).
3. **A tick claims one item and conducts it from its own session.** A tick with a ready item records a
   claim for exactly one item in the run file (who claimed, when, a heartbeat), under the run file's
   lock; it claims only an unclaimed item or one whose claim is stale, and never drives two claims of
   one change. The tick's own session is the helper, with no session started and no ticket: it
   drives that change through `plugins/openspec/hooks/change-loop.mjs` in the change's own worktree
   up to its next wait (GitHub checks, a free place, a dependency, an owner gate), handing each stage
   to its role as an agent one level below it, as the first task's real run showed (ADR 0010
   decision 8's live proof), and running the review bench as the one Workflow script of ADR 0008. No
   agent helper sits between the tick and the stage agents, and no agent dispatches another. It
   records the state in the change's files and the run file, releases the claim and ends. In this
   record a "helper" is that drive of one claimed item by a tick's session; a request its drive
   writes is answered by a later tick's sweep or by the owner, never in the same drive. The
   implementer still never approves its own work, and every delivery still passes `review-change`.
   Before the claim, a tick that is not empty sweeps the queue: it reads each unclaimed change's state
   from its files and GitHub, as ADR 0017 derives it, drops a hold whose wait has ended, takes over a
   stale claim (the change whose helper died), and answers each request file whose gate the standing
   answers delegate (decision 6). A change with no claim, no hold and a ready next action is claimable
   again, so a change that stopped with work left is resumed by the next tick, not by a message.
   Before an item's opening, its helper checks for a branch of the same id here or on `origin`: one
   holding the change's folder is reused (its worktree added from it, no second `open`); one without
   it is the blocked end `branch-taken`. With none, a read-only researcher is asked whether the code
   at the base already delivers the item; an item it finds delivered (with the file and line) is not
   opened, and the owner confirms it through a request of gate `decision`. A planning agent that
   escalates ends the change `blocked: not-delivered` with a request file; once the answer is written
   into the answer file and `requirements.md`, the next tick hands the stage again through the loop's
   plain `next`.
4. **State lives in the files.** The next tick goes on from the change folder and the run file;
   nothing is carried in a session. A helper killed mid-stage leaves a stale claim the next tick
   takes over. A stage agent's failure keeps the paths it has today: the `subagent-stop` hook refuses
   a stop without the stage file, one retry a model up (ADR 0023 decision 5), then `role-failed`.
5. **A helper never asks the owner.** No helper calls AskUserQuestion or starts a session. The grill
   is answered first by the `requirements-triage` agent from the project's files, then from the
   owner's standing answers, `openspec/standing-answers.md`, a file the owner writes and the conductor
   reads and never writes. A question neither settles is answered by the most conservative reading of
   the request only when the standing answers delegate the grill; otherwise it becomes a
   `waits-for-owner` line. Every answer the conductor writes names its source (a file and line, or
   the standing answer's line). The rule "Never answer a question yourself" of `openspec/config.yaml`
   and of both `schema.yaml` is amended to allow exactly this.
6. **The owner's gates stay the owner's unless delegated by name.** Plan approval and retro answers
   are recorded only from the owner's own typed words, unless the standing answers delegate that gate
   by name; a delegation names who decides, and the gate file quotes the standing answer as its
   words. A plan approval is asked as a summary of at most twelve lines (what is built, the acceptance
   criteria, the records, the files, the risks), refused when longer; the recorded approval quotes the
   owner's typed words or the delegated words, and its `approval.md` line stays within 200
   characters. When another queued change's tasks name a file this change's tasks name, the approval
   states the siblings and their order: the owner's, else "the second to reach its pull request merges
   the base first". A gate not delegated is never recorded by the conductor. Every other decision that needs
   the owner (a review round past its ceiling, a pull-request decision) is a `waits-for-owner` line
   too, unless delegated. A gate file is written by a conductor session (the typed one, or a tick's
   sweep), never in a helper's drive or by a stage agent.
7. **A decision travels by file, never by message.** A helper that needs a decision writes a request
   file in the change's folder (`requests/<n>-<slug>.md`: the question, the facts, its
   recommendation), through the run's command, never by hand. The answer is a file beside it
   (`requests/<n>-<slug>.answer.md`), written only by a conductor session: the owner's typed answer in
   the typed session, or a later tick's sweep quoting a delegation. No decision between a helper, a tick,
   the typed session or another machine's conductor travels as a session message; a request reaches
   another machine only through the change's pushed branch. Every `waits-for-owner` line names its
   request.
   **One place for the owner.** The `waits-for-owner` lines live in the run file and are shown by
   `/devkit status` and in the session the owner typed the run in; when the host offers a
   notification tool, a phone push is sent at most once per new line. The owner's answer, typed in
   that session, is recorded into the change's files and the next tick goes on. No change gets a box,
   a question or a session of its own.
8. **The change sessions go.** The start tickets and their claim, the `devkit-session` entry skill and
   its entry guard in `plugins/openspec/hooks/guard.mjs`, the `session-start` action, the
   `--change-sessions` flag, the verbs `session-next` and `session-wait`, the session cron (its
   `devkit-roadmap-check:` prompt and the `schedule-check`/`delete-check` actions) and the run-file
   fields that served only change sessions (`tickets`, `changeSessions`, `startedSessions`, `turn`,
   `cron`, `check`) are removed, with the `--turn` flag that set `turn`. The run file gains the task,
   the queue, the claims, the holds, the `waits-for-owner` lines and the train's claim;
   `placed` and `checkout` stay for ADR 0020. The locks of ADR 0011 and ADR 0013 hold a tick's
   session as they hold the typed one, the tick's envelope counting as the run's command.
9. **What ADR 0021 decided and this record keeps.** The run's places (`<n>`, 1 to 99, default 1) count
   only the changes whose current stage loads the tests (the implementation, a test stage, the
   evidence or the review), never sessions or helpers as such (decision 13), and at most that many
   claimed changes are driven at once on one machine, a tick claiming at most one. No plan is written before the item's `after:` dependencies are archived, and the
   change merges the default branch before its plan. In every grill, a lone `/devkit change` as much
   as a roadmap run, the triage answers first the questions the files settle, each with its source,
   for a change on flow version 2 or later of its script. A change whose ADR number the base gave
   another record since it began is renumbered by the implementer as a delivery step, in a project
   that names no release file (ADR 0034 numbers the others at the merge).
10. **Each machine conducts its own changes.** The rule is conservative: a machine the app reaches as
    an SSH host holds no task and runs no conductor. The owner types `/devkit roadmap` on each machine
    that can hold a task; each installs its own scheduled task and claims only items it can claim on
    GitHub (ADR 0020 decision 1 stays the record of which change runs where). In a conducted run a
    tick opens items only on its own machine and never places one on a machine of the `machines`
    setting: ADR 0020 decision 3's placement by the fewest open changes is not used there, and a
    loaded machine holds the item. A change claimed by another machine waits as `elsewhere`, takes
    no place, and is taken over from its pushed branch once that claim is released or stale. The
    conductor never starts work on another machine over SSH. Work is split by the change's branch: right after `open` the change's branch is
    pushed to `origin` (a failed push is said once and tried again at the next tick); the conductor of
    the machine the claim names fetches that branch and adds the worktree from it, then claims and
    runs it as its own. The conductor no longer calls the `checkout` verb; the verb stays for the
    owner's own use.
11. **CompozyOS is untouched.** `compozy-start`, `compozy-tick`, `compozy-state` and `.compozy/` stay
    as they are; ADR 0009 and ADR 0024 are unchanged.
12. **The tick dispatches the train.** In a project with a delivery train, a change that boards ends
    its helper with a hold, not an owner line, and the next tick dispatches the train before any
    change: it claims the train (the same live and stale rules as a change's claim) and its session
    drives the train's loop as `/devkit train` does, up to the train's end (merged, red
    with its bisection, or waiting on GitHub). It dispatches only while no train claim is live, so one
    train runs at a time and a change that boards meanwhile waits for the next. A train end that needs
    the owner (a `trunk` model's merge) is a `waits-for-owner` line.
13. **The conductor owns the machine's test capacity.** On one machine at most one whole-suite run is
    in flight at a time, and the train's run goes first: a change's whole suite waits while the
    train's runs, and the train's waits only for a change's run already started. The number of gates
    (the selective `--own-files` runs) in flight at once and each gate's `--concurrency` are capped by
    values the run file records for the machine; the plan sets their defaults and how the owner
    changes them. Every stage agent's brief a helper hands carries the cap, and the agent runs its
    tests within it. While a train departs no other test run of the machine starts: the gates and a
    change's whole suite wait for the train's end. A ready pull request whose files are all under
    `openspec/` (an archive or a roadmap edit) boards no whole-suite train and merges on its required
    checks (field fact 12). The run's places of decision 9 are this capacity's count of changes, so a
    change takes a place by entering a stage that loads the tests and frees it on leaving that stage.

## Consequences

- Positive: a run needs one typed command and no further turn of the owner's; no start is refused,
  because no session is started; an empty tick costs no model call; the owner answers in one place
  instead of one box per change; no decision is lost in a message queue, each one is a file in the
  change's folder; a boarded change no longer waits for a train nobody sends; a delivered item or a
  parked branch is found before a duplicate opens; a killed helper or a closed session loses nothing, the next tick
  reading the files; an archive or a roadmap edit merges on its required checks, with no 25-minute
  train; the ticket, entry and cron code and their failure modes leave the packs.
- Negative: the changes no longer show as sessions in the sidebar, the visibility ADR 0014 was built
  for (Mitigated: `/devkit status`, the panels and the stage files show each change's state, derived
  as ADR 0017 decides). Plan approval and retro answers can be recorded without a typed word of the
  owner's (Mitigated: only for a gate the owner's own file delegates by name, quoted in the gate file;
  the conductor never writes that file). The conductor answers grill questions (Mitigated: each
  answer names its source, and a question nothing settles reaches the owner unless the grill is
  delegated). A scheduled session loading the plugin and its hooks is host behaviour one probe showed, not a
  documented one, and a block costing no model call is measured only headless, not on a scheduled
  firing (Mitigated: task 6.1's run on the owner's Mac measures that a `UserPromptSubmit` hook sees a
  scheduled firing and that its block costs no model call there before the hook is relied on; the
  hooks fail as they do in any session). The tick's session carries one change's drive in its own context up to the next
  wait (Mitigated: one claim per tick, the drive ending at the wait, and a lost end costs one tick,
  the claim going stale). The task lives only where the desktop app runs: a machine the app reaches
  as an SSH host cannot hold it, and a conducted run no longer spreads its items over the `machines`
  setting (Mitigated: decision 10's other machine conducts its own changes only when the app runs on
  it; a change already claimed there waits as `elsewhere` and is taken over from its pushed branch
  once its claim is released or stale; outside a conducted run ADR 0020's placement is unchanged).
  A stale-claim bound too short takes over a slow helper (Mitigated: the heartbeat; the plan sets the
  bound). A schedule outlives the run, because the host lets only the owner's click delete it
  (Mitigated: one per project, every firing after the end blocked before the model, and one line in
  the owner list asking for the click). The train departs on a timer, which
  ADR 0022 had refused (Mitigated: only after a change has boarded, one train at a time, and never
  outside a conducted run). Test runs wait while a train departs (Mitigated: the train's run no
  longer competes with five gates, and a pull request of `openspec/` files spends no train). A capped gate takes longer than one run on an idle machine (Mitigated:
the cap is the run file's, so the owner can raise it; the whole machine no longer crawls for every
gate at once). The delivered-item check can skip an item that is not delivered
  (Mitigated: the owner confirms a skip through a request; the item's line stays unticked until then).

### Review trigger

A scheduled task's session is found without the devkit hooks, or an empty tick is found calling the
model; task 6.1's run finds a scheduled firing that does not pass through `UserPromptSubmit`, or a
blocked firing that the app counts as a model call; a helper is found asking the owner, starting a session, writing a gate file, or an agent it handed a
stage to is found dispatching another; a gate is
recorded with neither the owner's typed words nor a quoted delegation; two helpers are found on one
change; a firing after `stop` or the run's end is found reaching the model, or the owner list is found
without the line asking to delete the task; the host drops the
scheduled-tasks tool or changes how `UserPromptSubmit` blocks; a decision is found carried by a
session message instead of a request file; a boarded change is found waiting with no train claim
across two ticks; an item is opened twice under one id; two whole-suite runs are found in flight on
one machine, a gate is found running above the run file's cap, a test run is found starting while
a train departs, or a pull request whose files are all under `openspec/` is found on a whole-suite
train.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep change sessions and mint the ticket once | Smallest fix of the ticket bug | The host still refuses a start on a turn the owner did not type, and each session still opens its own question box (the 2026-11-28 run) | low |
| ADR 0021's session cron in the typed session drives the helpers | No new host tool | The cron dies with the session and expires after 7 days; every firing is a model turn, empty or not | low |
| One helper per change for its whole delivery (ADR 0013 option (a); ADR 0008's whole delivery as a Workflow) | One dispatch per change | Long-lived state inside a session, lost at the first wait; a helper here ends at each wait and the files carry the state | medium |
| A daemon outside the host (ADR 0001, ADR 0013) | No session at all | Runs outside the hooks; ADR 0010 accepts a daemon only as a driver of its own, which CompozyOS already is | high |
| The model decides an empty tick | No hook | Every idle tick costs a turn | low |
| A helper asks the owner with AskUserQuestion | No new file | One box per change, the failure the owner reported | low |
| The conductor writes the standing answers it learns | Fewer questions over time | The conductor could grant itself a delegation; only the owner writes that file | medium |
| A fallback to change sessions where the host has no scheduled-tasks tool | Works on more hosts | Two paths to keep, one of them the path that failed | medium |
| A decision sent as a session message to the conductor or the change | No new file | A message from another machine queued behind the coordinator's turns and was never read (field fact 3) | low |
| The train still sent only by a typed `/devkit train` (ADR 0022 decision 4 unchanged) | No amendment | A boarded change waited forever in the run of 2026-11-28 (field fact 7) | low |
| The conductor checks out a change on another machine (`checkout` over SSH) | One machine conducts all | A step run from one machine on another, which decision 10 refuses; the pushed branch needs no SSH | low |
| The places count sessions, each gate at the core count (ADR 0026's mitigation unchanged) | No cap to keep | Load average 124 on a 14-core machine, every gate crawling (field fact 11) | low |
| An agent helper per claimed change that dispatches the stage agents (two levels) | The tick's session keeps no change context | Probe 2 showed one agent handing one below, no more; a helper's hand-offs would be a second level the locks cannot judge, and every hand-off returns by notification anyway, so the tick's session gains nothing from a helper between it and the stages | low |
| The tick's prompt calls `/devkit roadmap tick`, or a model-invocable entry skill | The prompt carries the whole call | A slash command in a task's prompt reaches the session as plain text (probe 2); an entry skill brings back the entry code decision 8 removes, and a stored prompt with pack paths goes stale at a pack update | low |
| The host's run status (`running`) guards overlapping firings | No claim to keep | A run read `succeeded` while its background command lived (probe 2) | low |
| A conducted run places items over the `machines` setting, as ADR 0020 decision 3 does | Spreads the load over machines | Placing on another machine needs a session or a task there; an SSH host holds neither, and no step runs on another machine from this one | low |
| A Workflow helper that drives the whole change | One script per change | ADR 0008 keeps the Workflow to the review bench and rejected long-lived state in one session; the tick's session needs no such script | low |
| The task deletes itself at the run's end | No line for the owner | The host refuses delete, pause and run unattended, in auto and bypass mode (`proof/p0-delete.md`) | low |
| The review round on the Agent path in a tick's session (ADR 0008 decision 5 unchanged) | No amendment of ADR 0008 decision 5 | The tick's session is started by the task the owner created on a typed turn, and probe 2 ran the Workflow there; the Agent path would spend each round's context in the tick's session | low |
| The task created on a tick's or a later turn | No dependence on the typed turn | A task created on a turn the owner did not type runs in the default permission mode and may pause to ask | low |
| The conductor's task on a session of an SSH host | Conducts from the machine that holds the worktrees | The host refuses a scheduled task there and creates nothing (`proof/p0-delete.md`) | low |
| An `openspec/`-only pull request on a whole-suite train, as ADR 0022 boards an archive | One delivery path | Train 22 spent two 25-minute suites on such a pull request and left the change behind (field fact 12) | low |
| The CompozyOS driver as the conductor | Already ticks from files | Out of scope by the owner's answer; it is a driver of its own (ADR 0009, ADR 0024) | medium |
