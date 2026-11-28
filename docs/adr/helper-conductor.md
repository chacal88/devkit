# ADR [helper-conductor]: A roadmap run is conducted by one scheduled task of the project, whose ticks drive each change through a helper, with no session per change and no question box per change

- Status: accepted
- Accepted by: the owner, on 2026-11-28, in the approval of the plan of change helper-conductor (openspec/changes/helper-conductor/approval.md)
- Date: 2026-11-28
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
  - ADR 0008 (0008-reviews-as-a-workflow.md), decision 1, "no other step runs through the Workflow
    tool", only when the first task's real run picks the Workflow helper (decision 3); with the agent
    helper ADR 0008 is unchanged. The plan names the pick, and this record is revised with it before
    the plan is approved.
  - ADR 0010 (0010-openspec-as-the-harness.md), decision 8, the sentence "the owner's gates (grill
    answers, plan approval, retro answers) stay the owner's", as ADR 0021 had amended it: the grill
    answers of decision 5 and the delegations of decision 6.
  - ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decision 2, what counts as a run
    under way: the tick's envelope counts as the run's command in the tick's session; and its
    context's "only the session the owner types in can ask the owner the grill's questions": in a
    roadmap run no change asks; the grill is answered as decision 5 says.
  - ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), decisions 1 and 2 (one level of
    subagents under the typed session) for a roadmap run: a tick's helper dispatches the stage agents,
    a second level, proved live by the first task; decision 3, the locks hold the tick's session as
    they hold the typed one; decision 4, the run file's fields (decision 8).
  - ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decisions 1 to 4: no change
    runs in a session of its own; decisions 5 and 6 lose the change sessions they spoke of.
  - ADR 0017 (0017-a-change-state-is-derived-in-one-place.md), decision 2's "run with a session per
    change" and decision 4's change-session title, which have no session left to apply to in a
    roadmap run; decisions 1 and 3 are unchanged.
  - ADR 0020 (0020-a-change-can-run-on-another-machine.md), decision 4, a session started over SSH,
    and decision 5, "nothing polls and nothing is scheduled" and the message that wakes a place wait:
    each machine runs its own conductor (decision 10); and decision 4's worktree over SSH gives way
    to the change's pushed branch, from which the other machine adds the worktree itself.
  - ADR 0026 (0026-the-devkit-test-suite-runs-by-file-in-parallel.md), decision 1's "several at
    once" and the Negative consequence's mitigation "the runner's concurrency follows the core count",
    in a conducted run: the number of files at once is the run's cap, not the core count, and one
    whole-suite run at a time is in flight on the machine (decision 13).
  - ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md), decision 4, "on request, one at a
    time, with no timer and no cron", and "in a roadmap run the coordinating session sends it": in a
    conducted run a tick, a scheduled firing, dispatches the train when a change has boarded
    (decision 12); one at a time and "a change that boards while a train runs waits for the next"
    stay, and outside a conducted run the train still departs only on `/devkit train`.
  - ADR 0023 (0023-the-model-is-chosen-by-stage.md), decision 4, for a roadmap run: there is no change
    session to start or step down; each helper starts on the model decision 4 would give a session
    for the stages the helper runs up to its next wait.

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
to start; whether it loads the devkit plugin and fires its hooks, and what an empty firing costs, is
not documented, so the plan's first task proves both in a real run before the design is final. A
`UserPromptSubmit` hook that returns `{"decision":"block"}` stops a prompt before the model is
called; the genesi plugin's unstick gate uses it so that an empty firing costs nothing.

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
capacity.

## Decision

1. **One typed command, one scheduled task.** `/devkit roadmap <name> [round <k>] [<n>]`, typed once,
   records the run's queue (the items of the chosen roadmap and round, parsed as the change
   `multi-roadmaps` defines) in the run file and creates one scheduled task of the project with the
   host's scheduled-tasks tool, its prompt's first line naming the run
   (`devkit-roadmap-tick: <root>`). Typed again while the task exists, it creates no second task.
   Where the host has no scheduled-tasks tool, `/devkit roadmap` says so in one line and runs
   nothing; there is no fallback to change sessions. `/devkit roadmap stop` deletes the task, and
   the tick that finds the roadmap done deletes it too. The task fires every five minutes (cron
   `*/5 * * * *`; where the first task's real run shows the host refuses it, the shortest interval it
   accepts, recorded and brought to the owner).
2. **An empty tick is refused before the model.** A `UserPromptSubmit` hook of
   `plugins/openspec/hooks/hooks.json` recognises only the tick's envelope. It reads only local files
   (the run file and the change folders; no network, no model) and returns `{"decision":"block"}`
   when no item is ready to move; every other prompt passes with no output.
3. **A tick claims one item and runs it through a helper.** A tick with a ready item records a claim
   for exactly one item in the run file (who claimed, when, a heartbeat), under the run file's lock;
   it claims only an unclaimed item or one whose claim is stale, and never runs two helpers on one
   change. It then starts one helper, an agent or a Workflow, with no session and no ticket, which
   drives that change through `plugins/openspec/hooks/change-loop.mjs` in the change's own worktree
   up to its next wait (GitHub checks, a free place, a dependency, an owner gate), records the state
   in the change's files and the run file, releases the claim and ends. Which helper is used is
   decided by the first task's real run, which proves that it dispatches a stage agent and the review
   bench with the devkit hooks active (ADR 0010 decision 8's live proof of nesting). The implementer
   still never approves its own work, and every delivery still passes `review-change`.
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
   too, unless delegated. A gate file is written by a conductor session (the typed one, or a tick's),
   never by a helper or a stage agent.
7. **A decision travels by file, never by message.** A helper that needs a decision writes a request
   file in the change's folder (`requests/<n>-<slug>.md`: the question, the facts, its
   recommendation), through the run's command, never by hand. The answer is a file beside it
   (`requests/<n>-<slug>.answer.md`), written only by a conductor session: the owner's typed answer in
   the typed session, or a tick's answer quoting a delegation. No decision between a helper, a tick,
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
   evidence or the review), never sessions or helpers as such (decision 13), and at most that many helpers are in flight on one machine, a tick starting at most one
   new helper. No plan is written before the item's `after:` dependencies are archived, and the
   change merges the default branch before its plan. In every grill, a lone `/devkit change` as much
   as a roadmap run, the triage answers first the questions the files settle, each with its source,
   for a change on flow version 2 or later of its script. A change whose ADR number the base gave
   another record since it began is renumbered by the implementer as a delivery step, in a project
   that names no release file (ADR 0034 numbers the others at the merge).
10. **Each machine conducts its own changes.** The owner types `/devkit roadmap` on each machine; each
    installs its own scheduled task and claims only items it can claim on GitHub (ADR 0020 decision
    1 stays the record of which change runs where). The conductor never starts work on another
    machine over SSH. Work is split by the change's branch: right after `open` the change's branch is
    pushed to `origin` (a failed push is said once and tried again at the next tick); the conductor of
    the machine the claim names fetches that branch and adds the worktree from it, then claims and
    runs it as its own. The conductor no longer calls the `checkout` verb; the verb stays for the
    owner's own use.
11. **CompozyOS is untouched.** `compozy-start`, `compozy-tick`, `compozy-state` and `.compozy/` stay
    as they are; ADR 0009 and ADR 0024 are unchanged.
12. **The tick dispatches the train.** In a project with a delivery train, a change that boards ends
    its helper with a hold, not an owner line, and the next tick dispatches the train before any
    change: it claims the train (the same live and stale rules as a change's claim) and runs one
    helper that drives the train's loop as `/devkit train` does, up to the train's end (merged, red
    with its bisection, or waiting on GitHub). It dispatches only while no train claim is live, so one
    train runs at a time and a change that boards meanwhile waits for the next. A train end that needs
    the owner (a `trunk` model's merge) is a `waits-for-owner` line.
13. **The conductor owns the machine's test capacity.** On one machine at most one whole-suite run is
    in flight at a time, and the train's run goes first: a change's whole suite waits while the
    train's runs, and the train's waits only for a change's run already started. The number of gates
    (the selective `--own-files` runs) in flight at once and each gate's `--concurrency` are capped by
    values the run file records for the machine; the plan sets their defaults and how the owner
    changes them. Every stage agent's brief a helper hands carries the cap, and the agent runs its
    tests within it. The run's places of decision 9 are this capacity's count of changes, so a change
    takes a place by entering a stage that loads the tests and frees it on leaving that stage.

## Consequences

- Positive: a run needs one typed command and no further turn of the owner's; no start is refused,
  because no session is started; an empty tick costs no model call; the owner answers in one place
  instead of one box per change; no decision is lost in a message queue, each one is a file in the
  change's folder; a boarded change no longer waits for a train nobody sends; a delivered item or a
  parked branch is found before a duplicate opens; a killed helper or a closed session loses nothing, the next tick
  reading the files; the ticket, entry and cron code and their failure modes leave the packs.
- Negative: the changes no longer show as sessions in the sidebar, the visibility ADR 0014 was built
  for (Mitigated: `/devkit status`, the panels and the stage files show each change's state, derived
  as ADR 0017 decides). Plan approval and retro answers can be recorded without a typed word of the
  owner's (Mitigated: only for a gate the owner's own file delegates by name, quoted in the gate file;
  the conductor never writes that file). The conductor answers grill questions (Mitigated: each
  answer names its source, and a question nothing settles reaches the owner unless the grill is
  delegated). A scheduled session loading the plugin and its hooks is undocumented host behaviour
  (Mitigated: the first task proves it before the design is final; the hooks fail as they do in any
  session). A helper dispatching stage agents is a second level of subagents, which ADR 0013 avoided
  (Mitigated: proved live by the first task, and a lost end costs one tick, the claim going stale).
  A stale-claim bound too short takes over a slow helper (Mitigated: the heartbeat; the plan sets the
  bound). A schedule exists for the whole of a run (Mitigated: one per project, deleted on `stop` and
  at the run's end, and refused before the model when idle). The train departs on a timer, which
  ADR 0022 had refused (Mitigated: only after a change has boarded, one train at a time, and never
  outside a conducted run). A capped gate takes longer than one run on an idle machine (Mitigated:
the cap is the run file's, so the owner can raise it; the whole machine no longer crawls for every
gate at once). The delivered-item check can skip an item that is not delivered
  (Mitigated: the owner confirms a skip through a request; the item's line stays unticked until then).

### Review trigger

A scheduled task's session is found without the devkit hooks, or an empty tick is found calling the
model; a helper is found asking the owner, starting a session, or writing a gate file; a gate is
recorded with neither the owner's typed words nor a quoted delegation; two helpers are found on one
change; a run leaves a scheduled task behind after `stop` or its end; the host drops the
scheduled-tasks tool or changes how `UserPromptSubmit` blocks; a decision is found carried by a
session message instead of a request file; a boarded change is found waiting with no train claim
across two ticks; an item is opened twice under one id; two whole-suite runs are found in flight on
one machine, or a gate is found running above the run file's cap.

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
| The CompozyOS driver as the conductor | Already ticks from files | Out of scope by the owner's answer; it is a driver of its own (ADR 0009, ADR 0024) | medium |
