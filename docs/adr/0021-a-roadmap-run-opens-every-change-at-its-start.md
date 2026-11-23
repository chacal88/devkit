# ADR 0021: A roadmap run opens every change at its start, runs each change session on the run's ticket, and keeps one periodic check while it lasts

- Status: accepted
- Date: 2026-11-22
- Change: roadmap-sessions-upfront
- Accepted by: the owner, on 2026-11-23, in the message that approved the plan of the change: `aprovo`; recorded in `openspec/changes/roadmap-sessions-upfront/approval.md`
- Amends: ADR 0004 (0004-devkit-per-project.md), its decision that the hooks block nothing outside
  a devkit project, for the entry skill of a change session only; ADR 0006
  (0006-phases-as-child-sessions.md), decision 3, for a roadmap run only; ADR 0010
  (0010-openspec-as-the-harness.md), decision 2, where the host can start sessions, and decision 8's
  sentence "the owner's gates (grill answers, plan approval, retro answers) stay the owner's", for
  the grill answers the project's files settle; ADR 0011
  (0011-the-change-coordinator-is-the-owners-session.md), decision 2; ADR 0013
  (0013-the-roadmap-coordinator-is-the-owners-session.md), decision 4; ADR 0014
  (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decisions 1 to 4; ADR 0017
  (0017-a-change-state-is-derived-in-one-place.md), decision 4, the title of a held change session

## Context

On 2026-11-22 every ready change of a run was opened by hand, each in a session of its own. A
session the coordinating session started could not run the devkit skill until the owner typed
`/devkit change <id>` in it: the skill declares `disable-model-invocation: true`, and a message from
another session is no go-ahead. Ten changes would mean ten typed commands. ADR 0014 decision 1 put
each change's owner questions in its own session, and ADR 0010 decision 2 starts a change only when
its dependencies are archived and a place is free, so grills came one at a time. The same run left
about 30 stale wait loops that kept the app from archiving finished sessions. The owner decided in
the grill of `roadmap-sessions-upfront`: a change session must start running with no typed command;
every pending change opens at the start; the grills, plan approvals and retro answers are asked in
the coordinating session, a triage agent answering what the files settle; places count only the
stages that load the machine; and the run keeps temporary schedules that it cleans up at its end.
ADR 0017 has since derived each change's state in one place and titled a stopped change session
with its state icon beside its stage icon; a change session that waits in itself needs a state and a
title of its own.

## Decision

1. A roadmap run that starts a change session writes a one-use ticket for that change into its own
   bookkeeping and into the session's task, below `/devkit change <id>`. A model-invocable entry
   skill runs the change's loop from the session's first turn. A hook on the Skill tool lets it run
   only when the session's first message is the host's started form carrying a ticket the run
   recorded for that change and no other session claimed; the first session claims it. Any other
   call is refused, and the hook refuses when it cannot read, because its refusal still leaves the
   owner's typed command. The devkit skill stays owner-only. The hook acts whatever the project's
   opt-in, an exception to ADR 0004: it refuses only a call of the entry skill, which exists only for
   a roadmap run and finds no ticket outside one, and lets every other skill through without reading
   anything else, so a project that did not choose devkit meets no gate it would notice.
2. Where the host can start sessions, the first decision on the owner's typed turn opens every
   unticked, unarchived roadmap line and starts its session. The run's number counts only the changes
   whose current stage is the implementation, a test stage, the evidence or the review. A change
   waits for a place, for the load or for its dependencies in its own session, through a background
   wait of that session. No plan file is written before its `after:` dependencies are archived; the
   change then merges the default branch before its plan.
3. The coordinating session asks the grill, the plan approval and the retro answers of every change
   session, one change at a time, and writes each answer into that change's files; the change
   session goes on when its wait sees the file change. Every other owner gate stays in the change
   session. The coordinating session hands no stage; it may hand the grill's triage agent. In every
   grill, a lone `/devkit change` as much as a roadmap run, a read-only triage agent answers first the
   questions the project's files settle, each answer with its source, and the rule of
   `openspec/config.yaml` and of the schemas says so. This amends the sentence of ADR 0010 decision 8
   that the grill answers stay the owner's for those answers only: the owner still answers every
   question nothing written settles, every question that changes what is delivered, and every plan
   approval and retro answer.
4. While a roadmap run lasts, the coordinating session holds one session cron, about every 30
   minutes. A firing has the triage answer ahead, hands a freed place to the first waiting change,
   stops the run's stale wait loops, archives the sessions of archived changes, and speaks only when
   something changed. It never writes a plan approval or a retro answer, hands a stage or starts a
   session. The host expires a recurring session cron after 7 days, so the run reads the session's
   cron list on every typed turn and every firing and creates the check again when it is gone. The
   run's end deletes the cron (a cron already gone is no error), stops the run's wait loops and
   archives the sessions of archived changes. The owner agreed on 2026-11-22 (grill question 5)
   that the run archives the sessions of its archived changes: that standing agreement is what each
   archive call rests on; the app may still ask per call, and a refused or pending archive is tried
   again later. A lone `/devkit change` schedules nothing.
5. While a change session waits for a place, the load or its dependencies, its change's state is
   `running` with the reason of that wait, derived where ADR 0017 derives every state, and its title
   is ⏳ and the change id, the stage icon replaced; once it goes on, the title is its stage's again.
   This amends ADR 0017 decision 4 for a held change session only: a wait on GitHub keeps ⏳ beside
   the stage icon, and the owner's gates keep 🙋 beside it.
6. The run's bookkeeping also holds the start tickets (`tickets`), the places held (`occupied`), the
   changes waiting for one (`queued`), the start-anyway of the moment (`anyway`), the wait loops
   under way (`waits`), whether the host offers a session cron (`cron`) and the periodic check
   (`check`).
7. A change whose ADR number the default branch gave another record since the change began has
   it renumbered by the implementer, as a delivery step, without asking the owner: the next free
   number, and every reference to it.
8. The change session's own loop (its next step, its wait, its place, its merge of the default
   branch, its push and its stop) lives in the roadmap coordinator's script beside the run's
   bookkeeping it reads, and the change loop never imports that script. If that script keeps
   growing, splitting the change session's loop into a module of its own is a follow-up, not a new
   decision.

Note (roadmap-sessions-upfront, 2026-11-23): decision 3's triage in every grill holds for a change that
follows flow version 2 or later of its script. The `devkit` and `devkit-lite` flows are released as
version 2, which lists `requirements-triage` among the helpers of the grill; a change on flow 1 (opened
before devkit-openspec 0.33.0, or with no recorded flow) keeps its grill with no triage until the owner
moves it with `change-loop.mjs flow <id>`, because a released flow version never changes under the
changes that follow it. The status and the decisions above stay.

## Consequences

- Positive: a run needs one typed command; every grill is answered up front in one session, the
  triage taking the questions the files settle; the machine runs at most the number of building
  changes while plans go on; nothing the run started outlives it.
- Negative: a model-invocable skill exists for the change loop (Mitigated: the hook refuses it
  without the run's unclaimed ticket, and fails closed). The entry depends on the host's started
  form and on the Skill tool reaching a PreToolUse hook, neither documented (Accepted: a wrong
  reading refuses, and the owner types `/devkit change <id>`). Each change session polls its files
  once a minute while it waits (Accepted: a sleeping process per session, recorded and stopped when
  stale). A schedule exists again, for a roadmap run (Mitigated: one per run, deleted at its end,
  and it starts nothing the owner must allow). Reading every open change's action makes a
  coordinating decision slower with many changes (Accepted; the Stop hook does not read them).
  The entry's hook runs in projects that did not opt in (Mitigated: it decides only for the entry skill,
  with no import for any other). The triage answers part of a grill (Mitigated: each answer names its
  source, an answer with none sends the change back to its grill, and a question no file settles
  reaches the owner). A process that took a recorded wait's number is never signalled (Mitigated: the
  run checks the process's command line first).

### Review trigger

The host documents a way to start a session already running a skill, or a message between sessions
that counts as the owner's; the Skill tool stops reaching PreToolUse hooks; the started form
changes; a firing of the check is found writing an approval or a retro answer, or starting a stage;
a run leaves a cron, a wait loop or an archived change's session behind.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Drop `disable-model-invocation` from the devkit skill | One skill | Any session could start a run on its own, which AC-2 forbids | low |
| The grills in the coordinating session and the change session opened only after them | No entry needed for the grill | Still a typed command per session for the plan and the code | low |
| A message from the coordinating session as the go-ahead | No hook | ADR 0011: only the owner's own message is a go-ahead; no message tool is in use (ADR 0014 rejected it) | low |
| Places counted over open changes, as before | No new field | Grills and plans wait for building changes; the owner asked otherwise | low |
| A timer that retries a refused session start (ADR 0014 rejected it) | Starts without the owner | The app refuses a start on a turn nobody typed; the periodic check starts nothing and leaves a refused start to the owner's next message | low |
| A hook that refuses an implementer hand-off without a place | A hard lock | More hook code over the run file in a 10-second hook; the loop and the stop lock already hold the rule | low |
| A cron per change session | Each session wakes itself | Many schedules to clean up; the background wait already wakes it | medium |
