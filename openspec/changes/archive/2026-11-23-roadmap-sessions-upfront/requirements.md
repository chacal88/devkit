<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> asked by the owner on 2026-11-22: when `/devkit roadmap <n>` starts, it opens every change it will run, each in a session of its own, at once; at most `<n>` changes hold a place for the stages that load the machine (implementation, gates, evidence, review), and the others wait in their sessions under a waiting stage icon until a place frees. The requirements grill does not take a place: the owner answers every change's grill up front, so a change that gets a place goes straight to its plan or its code. Found the same day, and the first thing this change must solve: a session started by the coordinating session cannot run the devkit skill until the owner types `/devkit change <id>` in it (the host refuses a model call of the skill, and a message from another session is no go-ahead), so opening ten sessions would mean ten typed commands; either a session the coordinator starts carries the owner's go-ahead (AC-15 of roadmap-coordinator-followups did not close this), or the grills run in the coordinating session, where the owner typed `/devkit roadmap`, and each change's session opens with its `requirements.md` written. To weigh in the grill: the owner's view (2026-11-22) is that a requirement made long before its change runs seldom goes stale, only the way of doing it does (on 2026-11-22 `stage-roles` lost its ADR number and its release versions to siblings merged first). That kind of drift is resolved without the owner, by the change's session or by an agent made to resolve such conflicts (see `release-merge-conflict`). The plan is written only once the change's `after:` dependencies are archived and is checked against the code of that day. The owner is asked again only when a merged sibling changes what a requirement itself says. And a change opened on one machine must be one another machine can take (its branch pushed with the grill), as the remote-worker line requires. The owner offered another project of theirs, which opens one session per task when its roadmap starts, as a source of ideas for the grill.

## Requirements grill: roadmap-sessions-upfront

Classification: domain=process type=feature flags=[architecture, contract] (strict-assumed; the change amends ADR 0014 and ADR 0011 and changes what a started session may run)

Seen live in this run (2026-11-22, every ready change opened at once by hand, a coordinating session holding the places by message): this session was started with the prompt `/devkit-openspec:devkit change roadmap-sessions-upfront` and could not run the skill (`plugins/openspec/skills/devkit/SKILL.md` declares `disable-model-invocation: true`) until the owner typed the command in it; the coordinating session answered about 25 grill questions of the run's changes from the project's files and asked the owner only two.

### Questions asked

1. [scope] Where does the owner answer the grills of every change? → The owner, in their own message (relayed verbatim by the coordinating session; translated from Portuguese): (I believe the roadmap session, like this one, is the best place. But many of these questions are ones the roadmap's coordinator already has the answers to, so build an agent specialised in a first triage, and only crucial questions reach me. Having to enter the sessions and type to start them cannot happen: when you open the session, it must already open running.)
2. [end effect] Where does the owner approve each change's plan? → In the roadmap session, which shows the plan's summary and passes the approval on to the change's session; ADR 0014 is amended for it. Delegated: answered by the coordinating session on the owner's words for question 1 and the owner's delegation, translated from Portuguese: "answer the ones you have the information for"; the owner may correct it.
3. [scope] Where does the triage agent apply? → In this change, in every grill: the roadmap's and a lone `/devkit change`'s, one triage in one place. Delegated, as question 2.
4. [scope] Which changes open at once when `/devkit roadmap` starts? → Every pending change of `openspec/roadmap.md`, each with its session and its grill; each writes its plan only once its `after:` dependencies are archived, checked against the code of that day. Delegated, as question 2, on the owner's words when asking for this change, translated from Portuguese: "when I start the roadmap, every session, every change we will open, we open at the start".
5. [end effect, added by the owner] Sessions and the coordinator sit waiting for answers and statuses; can scripts run on temporary schedules, provided the schedules, the sessions and the rest are cleaned up at the end? → The owner, in their own message in the coordinating session (relayed by it; translated from Portuguese): "Could we have some scripts that run on schedules, create temporary schedules for these tasks? But we also cannot wait, at the end, to clean up these schedules, the sessions and everything else." To the coordinating session's proposal of (1) a temporary 30-minute check in that session now and (2) this change building it into devkit, the owner answered "yes, both". Evidence from this run: about 30 stale `sleep` wait loops, some a day old, kept the app from archiving finished sessions.

## Assumptions

<!-- Each confirmed by the owner or delegated by them to the coordinating session; correct any. -->
- The grills of a roadmap run's changes run in the session the owner typed `/devkit roadmap` in, one change at a time, each question naming its change; each change's `requirements.md` is written in that change's worktree and its branch is pushed with it.
- A new triage agent of the core pack (a file under `plugins/core/agents/`; its name is the planner's) answers each grill question that the project's files, ADRs, rules, roadmap lines and earlier answers settle, citing the source, and passes on only crucial questions: one that changes what is delivered and that nothing written settles. The `requirements-grill` skill (`plugins/core/skills/requirements-grill/SKILL.md`) runs it in every grill, a roadmap run's and a lone `/devkit change`'s.
- Each answer the triage gives is recorded in `requirements.md` as answered by triage, with its source, apart from the owner's answers; the owner sees them in the grill's summary and can correct any.
- A change session started by the roadmap run starts already running its change, with no command typed by the owner. The lock that refuses a model-started run (`disable-model-invocation: true` and the run detection of `plugins/openspec/hooks/guard.mjs`) is redesigned for that case only; how is the planner's and is recorded in an ADR. A run any other session or prompt starts on its own stays refused.
- Plan approval and retro answers stay the owner's own typed messages, now given in the roadmap session and passed on to the change's session; neither the triage agent nor the coordinating session approves or answers in the owner's place. AMBIGUOUS: (a) the retro answers move to the roadmap session like the plan approval | (b) they stay in the change's session; the planner resolves, (a) by default for one place.
- `/devkit roadmap` opens every pending change of `openspec/roadmap.md` at the start; a change whose `after:` dependencies are not archived has its grill done and waits for them before its plan.
- The grill and the plan take no place; the places (`<n>`) count only the stages that load the machine: implementation, gates, evidence and review. A change waiting for a place or for its dependencies shows the ⏳ icon in its session title; the stage icons of `plugins/openspec/hooks/change-loop.mjs` stay as they are.
- Drift of the way of doing (an ADR number, a release version, a sibling's merged code) is resolved without the owner, by the change's session or the release conflict step; the owner is asked again only when a merged sibling changes what a requirement itself says.
- A change opened on one machine is one another machine can take: its branch, with the grill and the plan, is pushed to `origin`.

- `/devkit roadmap` creates one periodic check of the run when the run starts, in the session the owner typed it in (a session cron, about every 30 minutes; the interval is the planner's), and deletes it when the run ends. Each firing: answers what triage can answer, gives a freed place to a ⏳ change, stops stale wait loops of the run's changes, archives the sessions of archived changes, and reports to the owner in one message only when something changed or needs them. It never approves a plan, answers a retro or starts a stage itself.
- The run's last step cleans up: deletes the periodic check, archives the change sessions of archived changes, and stops every leftover wait loop of the run. `/devkit roadmap stop` cleans up the same way once the changes under way have finished their stage.
- The scheduled check is an amendment for a roadmap run only of ADR 0006 decision 3 ("schedules nothing: no cron, no wake-up"), of ADR 0014 decision 2 ("Nothing is scheduled") and of the devkit skill's Never item "Create a cron or any scheduled wake-up"; it is recorded in the ADR this change writes. A lone `/devkit change` still schedules nothing.
- What a session start, a plan approval or a retro answer needs (a turn the owner typed, the owner's own message) is unchanged by the check: a start the host refuses on the check's turn waits for the owner's next message, as ADR 0014 decision 2 says.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `session-opens-running`: a change session the roadmap run starts runs its change's loop from its first turn, with no command typed by the owner in it.
- AC-2 `other-starts-refused`: a devkit run started by the model in any other session, or by a prompt that is not the roadmap run's start of that change, is still refused.
- AC-3 `every-pending-change-opens`: `/devkit roadmap` opens every pending change of the roadmap at its start, each in a session of its own, and the run's board lists them all.
- AC-4 `grills-in-roadmap-session`: every opened change's grill is asked in the roadmap session, one question at a time, naming its change, and its answers land in that change's `requirements.md`.
- AC-5 `triage-first`: in every grill, roadmap or lone `/devkit change`, the triage agent answers first each question the project's files settle; only crucial questions reach the owner, and each triage answer is recorded with its source and marked as answered by triage.
- AC-6 `triage-never-approves`: the triage agent never writes a plan approval or a retro answer, and a question nothing written settles always reaches the owner.
- AC-7 `approval-in-roadmap-session`: when a change's plan is ready, the roadmap session shows its summary and asks the owner; the owner's own typed answer there is recorded as that change's approval, and the change's session goes on from it.
- AC-8 `plan-after-dependencies`: a change whose `after:` dependencies are not archived writes no plan; once they are, its plan is written against the code of that day.
- AC-9 `places-load-only`: at most `<n>` changes are in implementation, gates, evidence or review at once; grills and plans run with no place.
- AC-10 `waiting-icon`: a change waiting for a place or for its dependencies shows ⏳ in its session title, and its stage icon again once it goes on.
- AC-11 `drift-without-owner`: a sibling merged first that takes the change's ADR number or release versions is resolved without asking the owner; the owner is asked again only when a merged sibling changes what a requirement says.
- AC-12 `branch-pushed-with-grill`: each opened change's branch is pushed with its `requirements.md` once its grill is answered, so another machine can take it.

- AC-13 `run-check-scheduled`: when `/devkit roadmap` starts a run, a periodic check of that run exists in the coordinating session; when the run ends or is stopped, it no longer exists.
- AC-14 `check-acts-not-approves`: a firing of the check answers what triage settles, gives a freed place to a waiting change, stops stale wait loops and archives the sessions of archived changes; it never writes a plan approval or a retro answer, and it says nothing to the owner when nothing changed.
- AC-15 `run-end-cleans-up`: after the run's last change is archived, no periodic check, no wait loop of the run and no open session of an archived change is left.
- AC-16 `lone-change-schedules-nothing`: a lone `/devkit change` run creates no schedule.

## Out of scope

- Running a change on another machine and choosing where each runs (`remote-worker`, round 28).
- Resolving release-file conflicts (`release-merge-conflict`); this change only relies on it.
- The live checks of round 18c (`roadmap-live-checks`).

## Escalations

- REQUIRES HUMAN DECISION, given by the owner in question 1: a change session the roadmap run starts must start running with no typed command, which amends ADR 0011 decision 2 and ADR 0014 decisions 1 and 4 (and the skill's `disable-model-invocation` lock). The planner writes the ADR; the owner approves it with the plan.
- REQUIRES HUMAN DECISION, given by the owner in question 5: a roadmap run schedules a periodic check and cleans it up, which amends ADR 0006 decision 3, ADR 0014 decision 2 and the devkit skill's Never list for a roadmap run only; recorded in the same ADR.
