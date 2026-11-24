# ADR 0010: OpenSpec is the harness, and two coordinators drive it as a loop over files

- Status: accepted
- Amended by ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md)
- Amended by ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md)
- Amended by ADR 0015 (0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)
- Amended by ADR 0016 (0016-stage-roles-write-their-own-files.md)
- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)
- Amended by ADR 0021 (0021-a-roadmap-run-opens-every-change-at-its-start.md)
- Date: 2026-11-19
- Change: orchestrator-replan
- Supersedes: ADR 0001 (0001-coordination-without-a-harness.md) and ADR 0007 (0007-one-change-on-request.md)

## Context

Note (change-state, 2026-11-22): the change loop derives one state per change, running or one of
decision 3's four ends with its reason, read by the board, the session title and the panels and stored
nowhere ([ADR 0017](0017-a-change-state-is-derived-in-one-place.md)); a GitHub that does not answer
is a wait on GitHub. Decisions 1 to 8 are otherwise unchanged.

Note (design-open-points, 2026-11-19): the owner answered points this ADR left open, and
[docs/coordination-design.md](../coordination-design.md) records each answer with who decided it.
Note (delivery-models, 2026-11-22): ADR 0018 amends decision 6, which keeps the merge rules of ADR 0002 and ADR 0003 unchanged: the delivery model is now chosen per project in `devkit.delivery`, and the test-branch lock of decision 5 exists for `two-prs`. The Decision is otherwise unchanged.

The names are decided, by the assistant on the owner's delegation: `manager` is the roadmap
coordinator and `tech-lead` the change coordinator, and the CompozyOS kit's present `tech-lead`
role, which plans, is renamed `planner` in round 21 (compozy-driver). This answers the last
sentence of decision 2 and the last sentence of the Negative consequences, which call the names
proposed and open. The roadmap coordinator holds the start of a new change while the machine is
loaded, and what is under way finishes first; the four design phases are one optional way to write
the roadmap, never a prerequisite. Decisions 1 to 8 are otherwise unchanged.

Note (flow-script-checker, 2026-11-19): the checker reads OpenSpec's task list
less the lines inside fenced examples of `tasks.md`, which are not tasks; decisions 1 to 8 are
unchanged.

Note (change-coordinator, 2026-11-20): the change coordinator of the Claude driver is the session the
owner typed `/devkit change` in; its product edits and its hand-offs to a role the script does not
list are refused by a hook. [ADR 0011](0011-the-change-coordinator-is-the-owners-session.md) amends
the sentence of decision 8 that says the change coordinator has no edit tool. It waits on GitHub
through a background command of the session that ends when GitHub answers, holding no state. Of ADR
0007's rules it keeps the unfinished-work question for a new request, and the owner's typed command is
the answer that creates a change. The project settings `devkit.language` and `devkit.driver` are
decided; the person's language is the plugin's own setting. `/conduct` is retired. Decisions 1 to 8
are otherwise unchanged.

Note (roadmap-coordinator, 2026-11-21): in the Claude driver the roadmap coordinator is the session the
owner typed `/devkit roadmap` in, which runs the loop of every open change and hands each stage to a
subagent in the background. [ADR 0013](0013-the-roadmap-coordinator-is-the-owners-session.md) amends
the bullet of decision 8 that takes up ADR 0005's "One subagent per whole change". The load is the
processor's, per core, against a per-person limit. Decisions 1 to 8 are otherwise unchanged.

Note (roadmap-coordinator-followups, 2026-11-21): in the desktop app each change of a roadmap run
runs in a session of its own, nested under the owner's session
([ADR 0014](0014-each-roadmap-change-runs-in-a-session-of-its-own.md)). A start the app refuses
waits for the owner's next message with a line, never a subagent in its place. The owner may tell
the session to start the changes the load holds at that moment anyway, and the hold applies again
to every later start; that permission is the owner's own message and is kept nowhere. Decisions 1
to 8 are otherwise unchanged.

Note (roadmap-sessions-upfront, 2026-11-22): where the host can start sessions, a roadmap run opens every
pending change at its start, and its number counts only the changes in the implementation, its
tests, evidence or review; a plan waits for its dependencies ([ADR 0021](0021-a-roadmap-run-opens-every-change-at-its-start.md)). Decision 2
holds unchanged where the host cannot start sessions. Decision 8's sentence that the owner's gates
(grill answers, plan approval, retro answers) stay the owner's is amended for the grill answers the
project's files settle: in every grill, a lone `/devkit change` as much as a roadmap run, of a change
that follows flow version 2 or later of its script, the requirements-triage agent answers those first,
each with its source, and the owner answers every question nothing written settles and every approval
and retro answer; a change on flow 1 keeps its grill with no triage until the owner moves it (ADR
0021's Note). This change leaves the other decisions as they are.

Note (project-phases, 2026-11-22): the project entry and the `devkit-project` schema are built;
[ADR 0015](0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md) answers decision 8's open point
(the hooks act in a slice's checkout as for any change, no run lock holds a `/devkit project` run) and
records the slice model. Decisions 1 to 8 are otherwise unchanged.

Note (stage-roles, 2026-11-21): the roles of D-4 stages 3, 4, 9 and 10 ship and stage 11 is recorded
as text. [ADR 0016](0016-stage-roles-write-their-own-files.md) amends decision 3 (a stage that does
not apply because of its declared condition, or that the change had already passed, leaves no file)
and the sentence of decision 8 on product code. The test commands are the settings `devkit.tests.*`
(decision 1, round 16). Decisions 1 to 8 are otherwise unchanged.

Note (jira-entry, 2026-11-22): round 20 adds no task-source setting to the configuration block
of decision 1. The key or link the owner types names the task, and the session's Atlassian
connector reads it, so the project keeps no Jira token or setting. The 'task source, round 20' of
decision 1 and the task source of decision 8 need no field; decisions 1 to 8 are otherwise
unchanged.

Note (remote-worker, 2026-11-22): opening a change pushes its branch at once with the machine's
name, and a roadmap run may open changes on other machines the person lists
([ADR 0020](0020-a-change-can-run-on-another-machine.md)). Waiting for a place is a blocked end with
its reason. Decisions 1 to 8 are otherwise unchanged.

ADR 0001 let devkit coordinate but never through a harness. Five ADRs then made exceptions to it or
amended them: parallel step subagents and a session cron (ADR 0005), phases as child sessions
(ADR 0006), one change on request and never a sweep (ADR 0007), the reviewer round as a Workflow
script (ADR 0008), and CompozyOS as a second driver (ADR 0009). The conduct model changed three
times in three releases.

A survey on 2026-11-19 read the 14 archived retros, the coordination scripts and the earlier
`chacal88/orchestrator` plugin:

- 13 of the 14 archived changes fixed the coordination machinery itself or its view.
- The gates work: the readiness review, the review bench with its refuting verifiers, the proof
  per acceptance criterion and the automatic merge caught real defects and draw no complaint.
- Starting child sessions is what breaks: the desktop app starts a session only on a turn the owner
  typed or on the unbroken chain that follows a child's end, so each phase cost a retyped
  `/conduct`. Six of the last seven fixes of the earlier orchestrator plugin worked around the same
  limit, and its last version replaced app sessions with subagents.
- The rules live in prose: the conducting skill is 157 lines the model is expected to follow, and
  nine retros record a rule that existed and that nothing enforced.
- The next step is guessed: `conduct-check.mjs` and `deliver-check.mjs` (about 2,300 lines) derive
  it by parsing prose, and six retros record a wrong step.
- What was solid in the earlier orchestrator: a declared flow, and a coordinator that asks for the
  next step instead of deciding it.

The owner's failure report: "the session stopped following; the sub-session finished and did not
notify, so the communication was lost". The owner asked for one simple command, a roadmap
orchestrator that starts the next changes on its own, a subagent per stage, and a harness "so it
does not leave the script", working on every platform the project runs on. That request is ADR
0007's own review trigger ("the owner asks for an unattended or roadmap-driven run again").

OpenSpec 2.0.0, tested on 2026-11-19 with a throwaway schema, accepts every stage of a change as an
artifact (those after implementation included), answers ready, blocked or done per stage
(`openspec status --json`), returns each stage's instruction with the project's `context` and
`rules`, reports task progress, and tolerates a custom top-level block in `openspec/config.yaml`.
It does not judge content (a file that exists counts as done, a rejecting `readiness.md` included),
it unlocks the stages after implementation with zero tasks done, it knows nothing of pull requests,
checks or the owner's approval, it has no retries, attempt limits or way back, and it drops extra
keys on an artifact. Its `schema` commands are marked experimental.

## Decision

This ADR decides what is to be built. At the commit that records it, none of decisions 1 to 5 is
built beyond what exists today (the `devkit` and `devkit-lite` schemas, `openspec/config.yaml`,
`openspec/roadmap.md`, the hooks and their locks); each new piece names the round of
`openspec/roadmap.md` that builds it, and decision 7 says what runs meanwhile.

1. **OpenSpec is the harness.** Everything that defines the flow is to live under the project's
   `openspec/`. Today that is `config.yaml`, `roadmap.md` and the schemas `devkit` (one change) and
   `devkit-lite` (a small change). The build order adds the stages after implementation to the
   schemas and names roles in place of Claude tool names (round 14), a configuration block in
   `config.yaml` filled by the rounds that need it (the language of the files and the driver,
   round 15; the test commands, round 16; the delivery model, round 17; the task source, round 20),
   and the schema `devkit-project` for the four design phases (round 19). The script names roles,
   never one platform's tool.
2. **Two coordinators, three entries.** To be built: the change coordinator in round 15, the
   roadmap coordinator in round 18, the project entry in round 19. A roadmap coordinator reads `openspec/roadmap.md` and
   starts, on its own, every change whose `after:` dependencies are archived; it may run several at
   once, only among changes that do not depend on each other, up to a number the owner sets per run
   and may change mid-run; lowering it never interrupts a change under way. A change coordinator
   takes one change from its opening to its archive: it asks which stage comes next, hands that
   stage to its role, checks the gate and asks again; it writes no code and does not decide the
   order. The owner enters by defining a project (the four design phases, ending in the roadmap),
   by calling the roadmap coordinator, or by calling the change coordinator for one task. The names
   `manager` and `tech lead` are proposed, not decided.
3. **A loop over files** (the header and the checker: round 14; the loop: round 15). Neither coordinator is a session that remembers where it is. Each turn of
   the loop reads the files, runs the stage that is ready and checks its gate; a lost notification
   or a dead session costs nothing, because the next turn reads the files again. Every stage leaves
   a file whose fixed header carries its status (passed, failed, not applicable), its attempt and
   the commit it was produced at; a stage that does not apply leaves its file saying so. A small
   checker without AI reads only those headers and says which stage really passed and which is
   next; the stages after implementation unlock only when OpenSpec reports zero pending tasks; a
   stage whose commit no longer matches the code runs again alone; attempt ceilings live in
   configuration and are counted by the checker. The loop ends in exactly one of four states, each
   with its reason: archived, waiting for the owner, waiting on GitHub, blocked.
4. **The driver is chosen per project.** The same script and the same roles are to run under a
   Claude session (round 15), under CompozyOS (round 21), or under a small program that calls an AI
   from the command line (round 22). In the
   Claude driver each stage is a subagent of the change coordinator; grouped app sessions are at
   most an optional view, and the flow never depends on them.
5. **Hooks veto; they do not drive.** The existing locks stay (product code closed until the plan
   is approved, one writer per gate file, destructive Git refused, approval only from the owner's
   session). Two new locks, built in round 15, refuse a stop: the change coordinator's while a stage is ready, and a
   stage subagent's while its stage file is missing. Each refusal names the stage that is ready,
   runs nothing itself, and is bounded by Claude Code's limit of eight consecutive continuations
   and by the checker's attempt ceilings. Where a driver cannot refuse an action, a GitHub check on
   the pull request is the lock.
6. **Unchanged.** The gates, the state in the repository and GitHub, the owner's plan approval as a
   human gate, the merge rules of ADR 0002 and ADR 0003, and the per-project opt-in of ADR 0004.
7. **What holds until each round.** ADR 0001 and ADR 0007 are superseded. What was built under them
   and under ADRs 0006, 0008 and 0009 (`ship-change`, `/conduct` with its child sessions and round
   mode, `conduct-check`, `deliver-check`, the review Workflow script, the panel, the CompozyOS
   loop) stays shipped and documented as it is until the round of `openspec/roadmap.md` that
   replaces it. Until the change coordinator ships in round 15, both `ship-change` and `/conduct`
   stay shipped, and the steps of the build order themselves are driven with `ship-change` in one
   session. Between round 15 and round 18 changes run one at a time. The design, the build order and the open points are in
   [docs/coordination-design.md](../coordination-design.md).
8. **Earlier rejections, answered.**
   - ADR 0001, "Long-running orchestrator session or daemon": still rejected as a session that has
     to remember; the coordinators are a loop that re-reads the files every turn. A daemon is
     accepted only as a driver whose own state is one run's bookkeeping, as ADR 0009 accepted it.
   - ADR 0001, "A Stop hook that re-prompts until done": a hook still does not drive. Accepted only
     as the veto of decision 5: it refuses a stop while a declared stage is ready, names that stage,
     and is capped.
   - ADR 0001, "CI job running Claude on each push", and ADR 0008, "Run the whole delivery as a
     Workflow": still rejected. The script driver runs where the owner starts it, not in CI.
   - ADR 0005, "One subagent per whole change" (a subagent cannot ask the owner or spawn reviewers;
     a lost one loses its place): taken up, because in the roadmap mode of the Claude driver each
     change coordinator is a subagent. A question goes up to the session and the roadmap coordinator
     asks it; nothing is lost with a subagent, because the next turn reads the files. Claude Code
     documents nesting three levels below the main conversation; the repeated report of a nested
     subagent's end is proved live before it is trusted.
   - ADR 0006, "A session per step": still rejected. Stages are subagents.
   - ADR 0006, "A daemon that starts sessions (Compozy-style)": stays as ADR 0009 accepted it, one
     driver among three, starting no app session.
   - ADR 0007, roadmap-driven runs ("Keep the sweep as the default", and its review trigger): taken
     up. The roadmap coordinator starts the changes that are ready without asking; the owner's
     gates (grill answers, plan approval, retro answers) stay the owner's, and one task still enters
     through the change coordinator alone.
   - ADR 0006, "Remove `/conduct`" (the owner is the loop again; the panel has no engine to read):
     taken up as a replacement, not a bare removal. `/conduct` retires only in round 15, when the
     change coordinator takes over the loop, and the old panel goes in round 24, after the new
     panels of round 23 read the new checker.
   - ADR 0006, "Fall back to a subagent on a refused start" (it hides the phases the owner asked to
     see; the conductor edits product code through a side door): taken up, because the owner chose
     "something that works" over app sessions (question 4) and the survey showed the start is what
     breaks. Visibility moves to the stage files, the read-only panels (round 23) and the optional
     grouped view; there is no side door, because the change coordinator has no edit tool and
     product code is still written only by the implementer role under the same hooks.
   - ADR 0007, "Remove the round mode" (a round of independent changes loses its parallel run): taken
     up for `/conduct round <n>`, but the parallel run itself is kept: the roadmap coordinator
     (round 18) runs independent changes at once, up to the owner's number. Between round 15, which
     retires `/conduct`, and round 18 changes run one at a time (accepted: the build order is the
     owner's).
   - ADR 0009, "ADR 0009 supersedes ADR 0001" (it would read as reversing ADR 0001 for every
     project, including those that never install the pack, and no shipped file needed the stronger
     form): taken up. The new design changes coordination for every devkit project, not for one
     opt-in pack, so the stronger form is now needed; ADR 0004's per-project opt-in still keeps
     every project that never chose devkit unaffected, and nothing changes in a project until it
     installs the release of the round that builds each piece.
   - ADR 0004, "An explicit `devkit: true` key in `openspec/config.yaml`": not taken up. The
     configuration block of decision 1 carries settings (driver, delivery model, tests, task
     source); the opt-in stays the schema selection ADR 0004 decided. Whether the hooks also act
     under `devkit-project` is decided in round 19.

## Consequences

- Positive: the next step is read from headers, not guessed from prose; the owner types one command;
  a lost notification or a dead session costs one re-read; the same flow runs on Claude, on
  CompozyOS and from a script; rules that lived in skill prose move to configuration and a checker.
- Negative: OpenSpec's schema commands are experimental (Mitigated: each project pins its OpenSpec
  version, and the checker covers what OpenSpec does not judge). More stages cost more time per
  change (Mitigated: `devkit-lite` stays the short script for the small change). Several change
  coordinators at once produce conflicts and stale reviews, seen in 7 of the 14 archived changes
  (Mitigated: only changes that do not depend on each other run at once, the owner sets how many,
  and a stale stage runs again alone). A refused stop is a re-prompt (Accepted: it names a declared
  stage and is capped; proved live before it is trusted). The approval lock stays the weakest, since
  no hook field marks a prompt typed by a person (Accepted). Until the rounds land, the documents
  describe machinery this ADR no longer governs (Mitigated: each of them names this ADR and the
  round that replaces what it describes). The CompozyOS kit already uses `tech-lead` for its
  planner role, so one of the two names changes (open).

### Review trigger

OpenSpec drops or changes its schema commands so that stages cannot be declared; a refused stop
loops, or Claude Code changes its continuation limit; a nested subagent's end is lost in the live
proof; a driver needs state the files cannot hold beyond one run's bookkeeping; the owner wants to
start work from a panel.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep ADR 0001's model and fix `/conduct` once more | Nothing new; the machinery exists | 13 of 14 changes already did that; the next step is still parsed from prose | low |
| App child sessions per stage (ADR 0006 extended to every stage) | Every stage visible in the sidebar | A start needs the owner's turn or an unbroken chain, the failure the survey found; ADR 0006 itself rejected a session per step | medium |
| A session that remembers where it is (a long-running orchestrator session) | Full control in one place | The owner's failure: the session stopped following and a notification was lost | high |
| A single-platform design (Claude tool names and agent types in the schema) | Simplest to build | The owner runs projects on Claude, CompozyOS and other AIs; the `devkit` schema names Claude's Agent tool today | medium |
| devkit's own harness program, outside OpenSpec | Full control of stages and retries | Another engine to depend on; the owner chose to centralise on OpenSpec for other projects and people | high |
| A Stop hook that drives the flow | No loop to write | A hidden harness; hooks veto, they do not drive (ADR 0001); kept only as the capped veto of decision 5 | medium |
| One change on request only (ADR 0007 kept) | The owner picks every change | The owner asked for a coordinator that starts the ready changes on its own (question 5) | low |
| The whole delivery as one Workflow script | One engine | Long-lived state inside one tool of one platform (ADR 0008) | high |
| Record the change as one more exception in ADR 0001's Note (the form ADR 0009 chose) | No status change | Every coordinating piece changes; a sixth exception makes ADR 0001 govern nothing it states | low |
| Remove `/conduct` and the round mode now, before a successor exists | Less to maintain | The owner becomes the loop again and the panel loses its engine (ADR 0006, ADR 0007); retired in rounds 15 and 24 instead | low |
| Keep app child sessions for implementation phases only (ADR 0006 as is) | The phases stay visible | The start still fails on any automated turn; the owner chose subagents that work (question 4) | medium |
