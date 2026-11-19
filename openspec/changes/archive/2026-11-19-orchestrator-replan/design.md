# Design

Change: `orchestrator-replan` · Date: 2026-11-19 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, D-1 to D-13, A-1 to A-9; motivation: `proposal.md`, Why)

## Context

This change writes documents and quotes one YAML scalar. Four facts of the repository shape it:

- **Tests read the documents.** `plugins/openspec/hooks/guard.test.mjs` imports every other test
  file of the suite (`deliver-check`, `merge-setup`, `conduct-check`, `release-rebase`, the three
  `openspec-setup` scripts, `review-round`), and 22 of its tests read `README.md`, `docs/*.md`,
  `docs/adr/*`, `openspec/config.yaml` or a pack README (inventory in D-5).
  Exactly one of them pins a sentence this change must make false: `guard.test.mjs:1312` expects
  ADR 0007 to read `- Status: accepted`. Base result, given by the coordinator: 669 tests, 669
  pass, about 8.5 minutes at `99474cf`.
- **The session report reads the roadmap.** `parseRoadmap` in `plugins/openspec/hooks/guard.mjs`
  (lines 409-430) takes a `## ` line as a round and `- [ ] <id> (after: a, b) — text` as an item;
  every other line is ignored, and the current round is the first with an unticked item. On the
  base the report shows `Round 5: trailer fix, one change at a time (0/2 done)`.
- **A pack file moves a version.** `CONTRIBUTING.md` (lines 50 and 52) bumps every changed pack
  and tags a `devkit-openspec` release; a `devkit-openspec` bump drags the CI pin in `docs/openspec-flow.md` (pinned by
  `deliver-check.test.mjs`, "the pin in docs/openspec-flow.md ..." and "AC-8 release-ready") and a
  tag after the merge. Two earlier commits edited only `guard.test.mjs` and bumped nothing
  (`0af3faf`, `cb3e29b`).
- **OpenSpec drops the design rules today.** `openspec instructions design --change
  orchestrator-replan --json` warns `rules.design[2] is a mapping` and returns no `rules`: the
  third entry, `Read the ADRs' rejected alternatives: an approach ...`, is unquoted.

## Goals / Non-Goals

**Goals:** the exact texts and edits below, so the implementer writes them without design choices
left; a design document that lets change 2 be planned with no other source; every gate green with
nothing under `plugins/` changed except one test assertion (OD-1), one sentence of
`plugins/openspec/README.md` and the release files it brings (D-7).

**Non-Goals:** any decision of the open points; a new test for ADR 0010 (it would be one more edit
under `plugins/*/hooks`; the gates of `tasks.md` prove AC-1 instead); editing the history in
`CHANGELOG.md`, the archived changes, or the bodies of ADRs 0002 to 0005 (records of their time:
their "builds on ADR 0001" sentences describe what they built on, and the gates they rely on survive
in ADR 0010).

## Decisions

### D-1. ADR 0010: `docs/adr/0010-openspec-as-the-harness.md`

Slug `openspec-as-the-harness`: the owner's own words for the decision ("we will use OpenSpec as
the harness"), short, and free of the open role names. The full text, to be written as is:

```markdown
# ADR 0010: OpenSpec is the harness, and two coordinators drive it as a loop over files

- Status: accepted
- Date: 2026-11-19
- Change: orchestrator-replan
- Supersedes: ADR 0001 (0001-coordination-without-a-harness.md) and ADR 0007 (0007-one-change-on-request.md)

## Context

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
```

**Status lines** (each replaces the existing `- Status: accepted` line):

- ADR 0001: `- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)`
- ADR 0007: `- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)`

The format is ADR 0005's (`- Status: superseded by ADR 0006 (0006-phases-as-child-sessions.md)`).
Each also gets a note as the first paragraph under `## Context`, as ADR 0005 has; the bodies stay
as they are (ADR 0001 keeps its Note naming `0006-phases-as-child-sessions.md` and
`0008-reviews-as-a-workflow.md`, which `guard.test.mjs` pins and which stays true as history):

- ADR 0001: `Superseded by ADR 0010: OpenSpec is now the harness, and a roadmap coordinator and a
  change coordinator drive the flow as a loop over files. What survives: every gate this ADR kept,
  the state in the repository and GitHub, every step recomputed from them, and the owner's plan
  approval as a human gate. What does not: the rule that devkit has no harness and no
  roadmap-driven coordination. ship-change and /conduct, built under this ADR, stay shipped as
  they are until their rounds of openspec/roadmap.md.` (with `ship-change`, `/conduct` and
  `openspec/roadmap.md` in backticks).
- ADR 0007: `Superseded by ADR 0010: a roadmap coordinator now starts the changes that are ready
  from openspec/roadmap.md on its own, and one task enters through the change coordinator.
  /conduct <id> and /conduct round <n> keep working as this ADR describes until round 15
  (change-coordinator) of openspec/roadmap.md replaces them. Whether the change coordinator keeps
  this ADR's other rules (unfinished work reported before anything runs, a missing change created
  only on the owner's answer) is open in docs/coordination-design.md.` (code spans in backticks).

**Notes for ADRs 0006, 0008 and 0009**: status stays `- Status: accepted` (pinned for 0006 and 0008
by `guard.test.mjs`, "ADR 0006 supersedes ADR 0005 ..." and "ADR 0008 records ..."), ADR 0006's
`- Amended by ADR 0007 (0007-one-change-on-request.md)` line stays (pinned), and each gets this
paragraph first under `## Context`:

- ADR 0006: `Note (ADR 0010, 2026-11-19): ADR 0010 supersedes ADR 0001 and ADR 0007. In the new
  flow each stage is a subagent of the change coordinator, and grouped sessions are at most an
  optional view. Until round 15 (change-coordinator) retires /conduct and round 24
  (coordination-cleanup) removes the child-session code, this ADR still governs how /conduct runs
  implementation phases as child sessions in the desktop app.`
- ADR 0008: `Note (ADR 0010, 2026-11-19): ADR 0010 supersedes ADR 0001, on which this ADR's Context
  rests. The reviewer round as one Workflow script still holds as decided here: no round of the
  build order removes it yet, and whether the review stage keeps the Workflow path in the Claude
  driver is open in docs/coordination-design.md. ADR 0010 adds no other use of the Workflow tool.`
- ADR 0009: `Note (ADR 0010, 2026-11-19): ADR 0010 supersedes ADR 0001, whose Note this ADR
  extended, and keeps CompozyOS as one of the drivers a project chooses. Until round 21
  (compozy-driver) replaces it with the short generic loop, the twelve-stage loop of devkit-compozy,
  its gates that shell out to deliver-check, conduct-check and screens-check, and its opt-in per
  project hold as decided here; round 24 (coordination-cleanup) removes the old loop.`

**Rejected alternatives checked, row by row.** Every row of the Alternatives tables of ADRs 0001
to 0009 (the chosen row of ADR 0009 excluded), against the design. "Answered" points at decision 8
or the Alternatives table of ADR 0010 above.

| ADR | Rejected row | Taken up? | Where answered |
|---|---|---|---|
| 0001 | Keep no coordination | no | |
| 0001 | Long-running orchestrator session or daemon | partly (a daemon as a driver) | decision 8; table row "A session that remembers" |
| 0001 | A Stop hook that re-prompts until done | partly (a capped veto) | decision 8; table row "A Stop hook that drives the flow" |
| 0001 | CI job running Claude on each push | no | decision 8 (still rejected) |
| 0002 | Keep the owner's merge everywhere | no (one model of three, per project, as ADR 0002 already allows) | |
| 0002 | The skill merges directly at 8/8 | no | |
| 0002 | One required human approval in the ruleset | no | |
| 0002 | Merge queue | no | |
| 0002 | A label-triggered merge Action | no (the `develop` lock is a check that refuses, not an Action that merges) | |
| 0003 | Owner merges every archive PR, in every mode | no | |
| 0003 | Ruleset bypass so the skill pushes the archive to `main` | no | |
| 0003 | Require `review-change` and 8/8 on the archive PR | no | |
| 0003 | A post-merge GitHub Action that archives | no | |
| 0004 | Keep the user-scope install; opt out per project | no | |
| 0004 | Hooks gate on Claude Code settings | no | |
| 0004 | An explicit `devkit: true` key in `openspec/config.yaml` | no (a settings block, not the opt-in) | decision 8, stated so it is not misread |
| 0004 | Per-change schema as the marker | no | |
| 0005 | One change at a time with `ship-change` | no (only as the interim driver of the build order, decision 7) | |
| 0005 | One subagent per whole change | yes | decision 8 |
| 0005 | The owner re-runs after each wait | no | |
| 0005 | A Stop hook or a daemon that re-prompts | partly | decision 8 (ADR 0001's two rows) |
| 0005 | A CI job running Claude | no | decision 8 (still rejected) |
| 0006 | Keep ADR 0005 (subagents and a cron) | no (no cron) | |
| 0006 | Remove `/conduct` | yes, with successors | decision 8; table row "Remove `/conduct` ... now" |
| 0006 | A session per step | no | decision 8 (still rejected) |
| 0006 | Fall back to a subagent on a refused start | yes | decision 8; table row "Keep app child sessions ..." |
| 0006 | A daemon that starts sessions (Compozy-style) | as ADR 0009 accepted it | decision 8 |
| 0007 | Keep the sweep as the default | yes (roadmap-driven runs) | decision 8; table row "One change on request only" |
| 0007 | Remove the round mode | yes, the parallel run kept | decision 8 |
| 0007 | Give `ship-change` the child sessions | no | |
| 0007 | Pick the change from the current branch | no | |
| 0008 | Keep the Agent tool only | no (open: the review stage's path) | |
| 0008 | Run the whole delivery as a Workflow | no | decision 8; table row |
| 0008 | Verify after the file | no | |
| 0008 | A saved workflow in `.claude/workflows/` | no | |
| 0008 | More reviewers instead of verifiers | no | |
| 0009 | ADR 0009 supersedes ADR 0001 | yes | decision 8; table row "Record the change as one more exception" |
| 0009 | Leave the posture undocumented | no | |
| 0009 | Fold the decision into `design.md` only, no ADR | no (this change writes ADR 0010) | |

### D-2. The design document: `docs/coordination-design.md`

Path: next to `docs/openspec-flow.md` and `docs/compozy-kit.md`, named after what ADR 0010 governs
("coordination", the word ADRs 0001 to 0009 use), free of the open role names. It is written from
`requirements.md` D-1 to D-13, translated and complete, not summarised: AC-2 asks for every item,
and `requirements.md` leaves the repository's reading path when the change is archived. Outline;
the 13 `(D-n)` headings are what the phase 1 gate counts:

| Section heading | Content (from `requirements.md`) | AC-2 element |
|---|---|---|
| (intro, no heading) | What the page is; ADR 0010 governs it; the marking legend: **decided** = the owner said it, **proposed** = shown to the owner and not objected to, **open** = nobody decided; the build order's step 1 is `orchestrator-replan` | |
| `## 1. How the owner uses it (D-1)` | the need (decided), the `/devkit` verbs table (proposed, names not confirmed), the rules behind them, Jira write-back (open, assumed read-only) | |
| `## 2. Two coordinators and three entries (D-2)` | roadmap coordinator and change coordinator, concurrency set per run, the machine-load hold (proposed and open), three entries, the names and the `tech-lead` clash (open) | |
| `## 3. What the orchestrator is (D-3)` | the loop over files, the three layers (script, roles, driver), "the script names roles" with today's counter-example (`schema.yaml` names the Agent tool and `devkit-core:*`), stages as subagents, grouped sessions as an optional view | |
| `## 4. The stages of one change (D-4)` | the 16-row stage table (#, stage, who and skills, produces, gate) with `new` marks, then the owner decisions on mock-up, ADRs, tests, demonstration, lean PR template | stage table |
| `## 5. Delivery models (D-5)` | two PRs from the same branch (new), trunk-based, trunk-based with automatic merge; the `develop` conflict (open) | three models |
| `## 6. Panels (D-6)` | read-only, three panels, the five mock screens, the language from the plugin's configuration; **where the approved mock lives**: the `mock/` folder of the change `orchestrator-replan`, `openspec/changes/orchestrator-replan/mock/` until it is archived, then under `openspec/changes/archive/` (AC-5) | |
| `## 7. Defining a project: the four phases (D-7)` | the four phases, the fifth stage that writes the roadmap, phases in the owner's session; a one-off feature entering a roadmap (open) | |
| `## 8. The harness (D-8)` | the OpenSpec 2.0.0 test (covers / does not cover), the harness rules (layout under `openspec/`, the checker, the fixed header, zero pending tasks, not-applicable files, stale work, attempt ceilings, the four end states), the lock table, the hooks facts, the configuration example (field names not final) | harness rules, lock table |
| `## 9. Language and documentation (D-9)` | the two language settings, English documentation, the design kept in the repository, mock-ups in `mock/` | |
| `## 10. The drivers (D-10)` | Claude, CompozyOS, script; what is not verified | |
| `## 11. Build order (D-11)` | the twelve steps; `ship-change` drives them until step 3 is ready; a table step → roadmap round → change id → `after:` (D-3 below) | build order |
| `## 12. What the survey found (D-12)` | the full survey: the 14 retros, the numbers, what broke and what was solid | |
| `## 13. Still to prove live, and risks (D-13)` | the five live proofs and the three risks with their mitigations | |
| `## Open points` | one list of every open item: command names; role names and the `tech-lead` clash; the machine-load hold; Jira write-back; the `develop` conflict; a one-off feature entering a roadmap; the lean PR template; which ADR 0007 rules the change coordinator keeps; whether the review stage keeps the Workflow path; the header's field names; the configuration's field names; CompozyOS choosing the role per turn; the script driver for other AIs | open points |
| `## What stays shipped until its round` | table: `ship-change`, `/conduct` (round mode included), `conduct-check.mjs`, `deliver-check.mjs` as next-step oracle, the child-session rules, the review Workflow script, `devkit-panel`, the CompozyOS twelve-stage loop → the round that replaces each | |
| `## Withdrawn roadmap items` | the six ids of A-3 with their source retro, withdrawn by the owner (question 16) | |

D-12's survey numbers go in **both** places: the short form in ADR 0010's Context (the decision's
justification must stand on its own), the full form in section 12 (the planning source). The two
must give the same numbers; the gate does not check that, the reviewers do.

Writing constraints, each enforced by a check that reads `docs/*.md`:

- English only, the owner's Portuguese quotes in backticks (`scripts/check.py`, `check_language`).
- Every relative link resolves (`check_links`); no `claude plugin install` line (`check_install_scope`).
- No line with "never merges" or "the merge is the owner's" unless it names a ship mode
  (`deliver-check.test.mjs`, "docs sweep").
- None of the old-order phrases of `OLD_ORDER` (`deliver-check.test.mjs:2837`), for example
  `review → evidence` or `reviews + evidence`; the D-4 order (demonstration, then code review)
  already avoids them.
- Tense (the proposal rule that a sentence about the repository is true at the commit that ships
  it; a reviewer check, no gate): present tense only for what exists at this commit. Everything
  the design adds (`/devkit` and its verbs, the two coordinators, the checker and the stage header,
  the new roles and skills, the `devkit:` configuration block, the `devkit-project` schema, the
  three drivers, the two-PR model and its lock, the new panels) reads as decided or proposed to
  build, with the round of D-3 that builds it. The intro states it once; each section carries the
  round number where it names such a piece.

Links to it: text L-1 (a row of `CLAUDE.md`'s "Where the rules are" table, after the CompozyOS
row) and text L-2 (a bullet of `README.md`'s Documentation list, after "The OpenSpec flow"), both
in the block at the end of the D-4 table.

### D-3. The roadmap: the exact new `openspec/roadmap.md`

Removed: the unticked lines `commit-and-pr-trailer`, `conventions-trailer` (round 5),
`review-writer-prompt` (round 11), `ac-clause-coverage`, `compozy-loop-v2-dogfood`,
`release-pin-in-release-files` (round 13), and the three headings that would be left empty. The
remaining round numbers stay, because `CHANGELOG.md`, the ADRs and the retros cite them ("round
7"). The carry-over note under round 2 is a closed record (its own text says "closed by
auto-merge"); it stays unchanged, and the parser ignores it.

This change has no round of its own: listing it unticked would make it the current round at the
delivered commit, while AC-3 asks the first new round (step 2) to be current; it is named in the
paragraph above the new rounds instead, and its archive has no line to tick (P11 of
`deliver-check` finds none).

`after:` gives the real dependency of each step; the round order is D-11's build order. Ids avoid
the open role names. The exact text:

```markdown
# Roadmap

## Round 1: ready PR without the owner in between
- [x] ship-modes

## Round 2: auto-merge, opt-in per repository
- [x] auto-merge (after: ship-modes)

Carry-over from the ship-modes review (closed by auto-merge: `guard.mjs ci` now runs `deliver-check --ci`, which shares `readReviews`): CI's `reviewConsensus` (`guard.mjs`) has no staleness check while `deliver-check`'s `reviewsItem` does; the `devkit-reviews` CI check should share `readReviews` so both agree on "approved".

## Round 3: archive after merge
- [x] archive-after-merge (after: auto-merge)

## Round 4: conduct roadmap rounds
- [x] conduct-rounds (after: ship-modes)

## Round 6: phases as child sessions
- [x] conduct-sessions — <unchanged>

## Round 7: one change on request
- [x] conduct-one-change — <unchanged>

## Round 8: release-rebase and the CI pin
- [x] release-rebase-pin — <unchanged>

## Round 9: reviews as a workflow, and the panel
- [x] review-workflow — <unchanged>
- [x] panel-conduct-view (after: review-workflow) — <unchanged>

## Round 10: evidence before review
- [x] evidence-before-review — <unchanged>

## Round 12: the CompozyOS loop as a kit
- [x] compozy-loop-v2 — <unchanged>

Rounds 14 to 24 are steps 2 to 12 of the build order in `docs/coordination-design.md` (ADR 0010); step 1 is the change `orchestrator-replan`, which recorded it. Rounds 5, 11 and 13 held follow-ups of the coordination model ADR 0010 replaces; `orchestrator-replan` withdrew them (the design document lists them).

## Round 14: the script and the checker
- [ ] flow-script-checker — the `devkit` schema declares every stage of a change, each stage file opens with the fixed header (status, attempt, commit), a checker without AI says which stage passed and which is next, and the schema names roles instead of Claude tool names (D-4, D-8)

## Round 15: the change coordinator and `/devkit change`
- [ ] change-coordinator (after: flow-script-checker) — the change coordinator runs one change as a loop over the checker, with `/devkit change`, the two stop locks, the skills wired into the agents and the two language settings; retires `/conduct` (D-1, D-2, D-3, D-8, D-9)

## Round 16: the new stage roles
- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11)

## Round 17: the delivery models
- [ ] delivery-models (after: change-coordinator) — the delivery model chosen per project: two pull requests from the same branch with the lock that keeps `develop` out of the task branch, trunk-based, and trunk-based with automatic merge (D-5, D-8)

## Round 18: the roadmap coordinator and `/devkit roadmap`
- [ ] roadmap-coordinator (after: change-coordinator) — the roadmap coordinator starts every change whose `after:` dependencies are archived, several at once up to the number the owner sets per run, with `/devkit roadmap` and `/devkit status` (D-1, D-2)

## Round 19: defining a project
- [ ] project-phases (after: roadmap-coordinator) — the four design phases as the `devkit-project` flow, with a fifth stage that writes or appends to `openspec/roadmap.md`, started by `/devkit project` (D-7)

## Round 20: the Jira entry
- [ ] jira-entry (after: change-coordinator) — `/devkit change <key or link>` reads a Jira task as the request, read-only, and the grill asks only what the task does not answer (D-1)

## Round 21: the CompozyOS driver
- [ ] compozy-driver (after: change-coordinator) — CompozyOS runs the same short loop (ask the checker, run the role, check the gate) in place of the twelve-stage loop, and `/devkit` starts the run when the project's driver is CompozyOS (D-3, D-10)

## Round 22: the script driver
- [ ] script-driver (after: change-coordinator) — a small program runs the same loop and calls the AI from the command line (documented for `claude -p`), for a project whose driver is a script; built when the owner needs it (D-10)

## Round 23: the panels
- [ ] coordination-panels (after: roadmap-coordinator) — read-only panels for the roadmap coordinator, the change coordinator and help, from the mock the owner approved in `orchestrator-replan` (D-6)

## Round 24: the cleanup
- [ ] coordination-cleanup (after: coordination-panels, compozy-driver) — remove what the new coordination replaced: the old next-step scripts, the child-session code, the old panel and the old CompozyOS loop, and finish the documentation (D-11)
```

`<unchanged>` stands for the line's current text, byte for byte; the implementer deletes lines and
inserts the new block, and edits no ticked line. Dependencies, one reason each: 15 asks 14's
checker; 16, 17, 20, 21, 22 are stages, entries or drivers of 15's loop; 18 starts 15's coordinators;
19 writes the roadmap 18 reads; 23 shows 18's and 15's state; 24 removes the old panel once 23
replaces it and the old loop once 21 replaces it. At the delivered commit the session report reads
`[devkit] Roadmap: Round 14: the script and the checker (0/1 done)` with
`flow-script-checker: not started`.

### D-4. Truthfulness: every file and line that states ADR 0001 or ADR 0007 as the rule

From `git grep -nE "ADR 0001|ADR 0007|0001-coordination|0007-one-change|no harness|without a
harness|harness is not|never a sweep|never sweeps|Why no harness|a harness"` outside
`openspec/changes/archive`, read line by line:

| File:line (base) | Today | Action |
|---|---|---|
| `README.md:3` | "... that you can enforce without a harness." | → R-1 |
| `README.md:54` | `## Why no harness` | → `## How the flow holds`. The paragraph under it (state in files, three layers, "in projects that opted in", pinned by `guard.test.mjs` "ADR 0004 exists ...") stays. |
| `README.md:64` | "Coordination is allowed; a harness is not. The `ship-change` skill drives ... See ADR 0001. The reviewer round ... ADR 0008." | → R-2 (the whole paragraph) |
| `README.md:68` (last sentence) | "It is an exception to ADR 0001, recorded in ADR 0006 and ADR 0007." | → R-3. The paragraph's start, its two links, "child session", "one change" and "`/conduct round <n>`" stay (pinned by `guard.test.mjs` "README and the pack README ..."). |
| `plugins/openspec/README.md:3` | "Runs the devkit workflow on top of OpenSpec without a harness. ..." | → R-7 (first sentence only; the rest of the paragraph stays); a pack file, so D-7's release follows |
| `docs/compozy-kit.md:88-89` | "`/conduct` (ADR 0006, ADR 0007) and the CompozyOS loop", ADR 0007 named as in force | → R-8 |
| `docs/compozy-kit.md:97-99` | "The posture — CompozyOS as a second, opt-in driver of the devkit flow, never a harness that replaces it — is recorded in ADR 0009." | → R-4 (replaces that sentence) |
| `docs/openspec-flow.md:3` | "... with no orchestrator session in the middle." | Stays (true of what ships); R-5 is added as a new paragraph after it. |
| `docs/openspec-flow.md:142-145` (`## Conducting a change`) | `/conduct` as one of two drivers; single-change mode "never sweeps" (line 147) | R-6 is added at the end of the section's first paragraph. Line 147 describes the shipped skill and stays. The CI pin moves only in task 2.6 (D-7). |
| `openspec/config.yaml:22` | `ADRs: docs/adr/ (0001 coordination without a harness, ..., 0009 the CompozyOS loop as a second driver)` | → `  ADRs: docs/adr/ (0001 coordination without a harness, superseded by 0010; 0002 merge without the owner by opt-in; 0003 auto-merge the archive PR; 0004 devkit per project; 0005 parallel steps and a session wake-up, superseded by 0006; 0006 phases as child sessions, amended by 0007; 0007 one change on request, superseded by 0010; 0008 reviews as a workflow; 0009 the CompozyOS loop as a second driver; 0010 OpenSpec as the harness with a roadmap coordinator and a change coordinator, supersedes 0001 and 0007)` — keeps every substring the suite pins (`0003 auto-merge the archive PR`, `0004 devkit per project`, `0005 parallel steps`, `0006 phases as child sessions`, `0007 one change on request`, `0008 reviews as a workflow`). |
| `docs/adr/0001-*.md`, `docs/adr/0007-*.md` | `- Status: accepted` | D-1 |
| `docs/adr/0006`, `0008`, `0009` | state ADR 0001 / 0007 as their frame | D-1 notes |

The texts, exactly (links relative to the file that receives them):

```markdown
R-1 (README.md line 3, end of sentence):
... plus a spec-driven workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) that its schema and a few hooks enforce.

R-2 (README.md, replaces the "Coordination is allowed; a harness is not." paragraph):
How changes are coordinated is decided by [ADR 0010](docs/adr/0010-openspec-as-the-harness.md), which supersedes ADR 0001 (coordination without a harness) and ADR 0007 (one change on request): OpenSpec is the harness, a roadmap coordinator starts the changes that are ready, and a change coordinator runs each one as a loop over its files, under the driver each project chooses. The design and its build order are in [docs/coordination-design.md](docs/coordination-design.md). None of it is built yet: until a round of `openspec/roadmap.md` replaces a piece, what ships is what follows. The `ship-change` skill drives one approved change to a ready PR from your own session, re-reading the files and GitHub each time it runs, and stops with a reason. The reviewer round may run as one Workflow script inside your session, recorded in [ADR 0008](docs/adr/0008-reviews-as-a-workflow.md).

R-3 (README.md, last sentence of the `/conduct <id>` paragraph):
Its rules are recorded in [ADR 0006](docs/adr/0006-phases-as-child-sessions.md) and [ADR 0007](docs/adr/0007-one-change-on-request.md); ADR 0010 supersedes ADR 0007, and `/conduct` stays as described here until round 15 (`change-coordinator`) replaces it.

R-4 (docs/compozy-kit.md, replaces the posture sentence):
The posture — CompozyOS as a second, opt-in driver of the devkit flow — is recorded in [ADR 0009](adr/0009-compozy-loop-as-a-second-driver.md). [ADR 0010](adr/0010-openspec-as-the-harness.md) supersedes ADR 0001 and ADR 0007 and keeps CompozyOS as one of the drivers a project chooses: round 21 (`compozy-driver`) replaces this loop with the short generic one and round 15 (`change-coordinator`) replaces `/conduct`; until then both work as this page describes.

R-5 (docs/openspec-flow.md, new paragraph after line 3):
How changes are coordinated is being redone: [ADR 0010](adr/0010-openspec-as-the-harness.md) supersedes ADR 0001 and ADR 0007, and [the coordination design](coordination-design.md) holds the design and its build order. This page describes what ships today; each part stays as described here until the round of `openspec/roadmap.md` that replaces it.

R-6 (docs/openspec-flow.md, end of the first paragraph of "Conducting a change"):
`/conduct` is recorded in ADR 0006 and ADR 0007; ADR 0010 supersedes ADR 0007, and round 15 (`change-coordinator`) replaces `/conduct` with the change coordinator. Until then it works as this section describes.

R-7 (plugins/openspec/README.md, replaces the first sentence of line 3):
Runs the devkit workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec), which is its harness ([ADR 0010](../../docs/adr/0010-openspec-as-the-harness.md)).

R-8 (docs/compozy-kit.md lines 88-89, the parenthesis after `/conduct`):
`/conduct` ([ADR 0006](adr/0006-phases-as-child-sessions.md), [ADR 0007](adr/0007-one-change-on-request.md), superseded by ADR 0010) and the CompozyOS loop are **two ways to drive the

L-1 (CLAUDE.md, a row of "Where the rules are", after the CompozyOS row):
| The coordination design (ADR 0010) and its build order | [docs/coordination-design.md](docs/coordination-design.md) |

L-2 (README.md, Documentation list, after "The OpenSpec flow"):
- [The coordination design](docs/coordination-design.md): the roadmap and change coordinators, OpenSpec as the harness, and the build order (ADR 0010)
```

Checked and left unchanged, with the reason:

- `CONTRIBUTING.md`, `CLAUDE.md`, `docs/getting-started.md`, `docs/conventions.md`,
  `docs/migrate-to-project-scope.md`, `docs/catalog.md` (generated), `.compozy/`: none states either
  ADR as the rule (grep empty). `CLAUDE.md` gains only the design-document row.
- `docs/adr/0002` to `0005`: records; "builds on ADR 0001" is history, and the gates they build on
  survive in ADR 0010 (decision 6).
- `CHANGELOG.md`, `openspec/roadmap.md:25` (a ticked line), `plugins/panel/hooks/project.ts:157` (a
  comment naming the version that added `--change`), `plugins/openspec/skills/conduct/SKILL.md`
  ("never sweeps", the shipped skill's behaviour): history or shipped machinery, true as written.

### D-5. Tests that read the edited files

Every test in the repository that reads a file this change edits (`README.md`, `CLAUDE.md`,
`docs/*.md`, `docs/adr/*`, `openspec/config.yaml`, `openspec/roadmap.md`, a pack README, a
`plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`), from a grep of every
`*.test.mjs` and `*.test.tsx` (17 files) for reads of those paths. None reads the real
`openspec/roadmap.md` or `CLAUDE.md`. Read only as fixtures or templates, so not listed:
`conduct-check.test.mjs` (`PIN_DOC` is a fixture built by `pinDoc`, line 1405),
`panel.test.tsx` and `report.test.tsx` (in-memory files), `role-shells.test.mjs` and
`adoption.test.mjs` (the `.compozy` templates). `scripts/check.py` also reads every Markdown file
and the CHANGELOG heading of the marketplace version.

| Test (file) | Pins | After this change |
|---|---|---|
| "ADR 0003 exists with Status: accepted ..." (`guard.test.mjs`) | ADR 0003; `0003` in README, flow doc, config, CONTRIBUTING; `0003 auto-merge the archive PR` in config | holds |
| "ADR 0004 exists with its sections ..." (`guard.test.mjs`) | `0004` in the four files; `in projects that opted in` in README | holds (the README paragraph keeps it) |
| "the hook docs say where the hooks act (1.7)" (`guard.test.mjs`) | "Where the hooks act" in the flow doc; `openspec/config.yaml` in the pack README | holds |
| "README and getting-started say the packs load only ..." (`guard.test.mjs`) | README wording, migration link | holds |
| "README and the pack README describe the session flow ..." (`guard.test.mjs`) | README's `/conduct <id>` paragraph: its start, links to ADR 0006 and ADR 0007, `/conduct round <n>`; pack README rows | holds (D-4 keeps them) |
| "ADR 0006 supersedes ADR 0005, and ADR 0001 and the config point to it" (`guard.test.mjs:1293`) | ADR 0001 names ADR 0006 and has `## Decision`; ADR 0005 superseded; ADR 0006 accepted and amended by 0007; config substrings; **ADR 0007 `- Status: accepted` (line 1312)**; ADR 0007 sections | **breaks at line 1312 only**; OD-1 below |
| "ADR 0008 records the reviewer round ..." (`guard.test.mjs:1321`) | ADR 0001 names ADR 0008; ADR 0008 accepted; config substring | holds |
| "AC-6 instructions-follow" x3 (`deliver-check.test.mjs`) | config guidance line, flow doc apply paragraph, README diagram; no `OLD_ORDER` phrase in any tracked file | holds (no such line is edited; the design doc avoids the phrases) |
| "docs sweep: never merges ..." (`deliver-check.test.mjs`) | every `docs/*.md`, README, pack READMEs | holds if the design doc follows D-2's constraint |
| "ADR 0002 exists, is cited by README and docs/openspec-flow.md ..." (`deliver-check.test.mjs`) | the ADR 0002 links | holds |
| "the pin in docs/openspec-flow.md ..." and "AC-8 release-ready" (`deliver-check.test.mjs`) | the CI pin equals the `devkit-openspec` version; versions match the marketplace | holds once task 2.6 moves `plugin.json`, `marketplace.json` and the three pin lines together |
| "review round: text docs/openspec-flow.md has the review round section ..." (`review-round.test.mjs`) | section order, ADR 0008 link | holds |
| "release-rebase pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines" (`release-rebase.test.mjs:421`) | `setPins` with the current version changes nothing, and with another version changes exactly the pin lines (486, 487, 494) | holds if R-5 and R-6 hold no `vN.N.N` token (they hold none) and 2.6 moves every pin line to the same version |

### D-6. OD-1: the ADR 0007 status assertion

`guard.test.mjs:1311-1315` reads ADR 0007 and asserts `^- Status: accepted$` and its four
sections. Invariant: ADR 0007 exists as a complete ADR whose status the repository states. Layer:
the decision records under `docs/adr/`, whose wording the suite pins next to the hook tests. Suite:
`node --test plugins/openspec/hooks/guard.test.mjs`. ADR 0010 makes the sentence "ADR 0007 is
accepted" false, so the assertion changes; dropping the truthfulness edit to keep it green is not
an option.

Decided: **(a)**, by the conducting session as a routine mechanism choice under the owner's
standing instruction to decide routine choices; the owner sees it at plan approval. AC-6 and A-4
of `requirements.md` carry the exception. The options weighed:

The release that D-7 now requires comes from the pack README, not from this assertion; the
assertion rides in it.

- **(a), decided**: line 1312 becomes
  `assert.match(adr7, /^- Status: superseded by ADR 0010 \(0010-openspec-as-the-harness\.md\)$/m);`
  — the sections check stays, so the invariant becomes "ADR 0007 is complete and superseded by ADR
  0010". It is the only edit under `plugins/*/hooks`. On its own it would move no version, as for
  `0af3faf` and `cb3e29b`, which edited only this file; AC-6's path clause in `requirements.md` reads: "... and under `plugins/*/hooks` only the ADR 0007 status
  assertion of `plugins/openspec/hooks/guard.test.mjs`".
- **(b), moot**: as (a), with `CONTRIBUTING.md` line 50 read strictly (a test file is a pack file),
  so the assertion alone would bring the `devkit-openspec` 0.14.2 release. That release is in the
  plan anyway, for the pack README sentence (D-7, task 2.6), so (a) and (b) now ship the same files;
  (a) only records that the assertion is not what requires it.
- **(c), not taken**: ADR 0007 keeps `- Status: accepted` and gains `- Superseded by ADR 0010 (...)` under it,
  as ADR 0006 carries `- Amended by`. No test changes, but the status line states
  something false, which AC-4 and the proposal rule forbid. Not recommended.

### D-7. Packs and versions

Truthfulness first. ADR 0010 states that OpenSpec, which already ships as the `devkit` and
`devkit-lite` schemas, *is* the harness. Under the decision in force at this commit, a sentence
saying the flow runs "without a harness" is therefore false, in `README.md:3` and in
`plugins/openspec/README.md:3` alike; the shipped code is the same, only the decision that names it
changed. So both sentences change (R-1 and R-7), and "No coordinator session, no state machine: the
state is the change's files on disk", true of the pack at this commit and consistent with ADR
0010's loop over files, stays.

Cost second. R-7 is a `devkit-openspec` file, so `CONTRIBUTING.md` (line 50: bump the pack in
`plugin.json` and `marketplace.json`, add a CHANGELOG line; line 52: tag the `devkit-openspec`
version after the merge) requires the release (task 2.6):

- `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry:
  `0.14.1` → `0.14.2`; the marketplace `metadata.version`: `0.18.0` → `0.18.1`.
- `CHANGELOG.md`: a `## 0.18.1 — the coordination design recorded` entry at the top, naming
  devkit-openspec 0.14.2 (the README's first sentence names ADR 0010; one assertion of
  `guard.test.mjs` follows ADR 0007's new status), the docs (ADR 0010 supersedes ADR 0001 and
  ADR 0007, `docs/coordination-design.md`, the roadmap rounds 14 to 24, the quoted design rule),
  "No other pack changes version; this release is tagged `v0.14.2` on its merge commit", and the
  CI snippet pinning `v0.14.2` (the wording of the 0.18.0 entry).
- `docs/openspec-flow.md`: the three pin lines (486, 487, 494) move from `v0.14.1` to `v0.14.2`,
  nothing else of the `## CI` block; pinned by `deliver-check.test.mjs` ("the pin in
  docs/openspec-flow.md ...", "AC-8 release-ready") and `release-rebase.test.mjs` ("the real
  docs/openspec-flow.md ...").
- After the merge: the lightweight tag `v0.14.2` on the merge commit (`## Workflow follow-up`, as
  `CONTRIBUTING.md` says; not an acceptance criterion, since it exists only after the merge).
- `docs/catalog.md` does not change (`gen-catalog.py` writes only the marker tables, and line 3 is
  outside them); no other pack, agent, skill, hook script or schema changes.

Alternative rejected: leave `plugins/openspec/README.md:3` until round 15 to save the release. It
keeps a sentence the governing decision makes false for the length of four rounds, which the
proposal rule forbids. Alternative rejected: keep both `README.md:3` and the pack README as they
are; same reason.

### D-8. AC-7: quote the third design rule

`openspec/config.yaml` line 35 becomes
`    - "Read the ADRs' rejected alternatives: an approach an ADR rejected needs its own ADR before readiness, never a line concluding none is needed"`
(double quotes, because the text holds an apostrophe). No other entry of `rules` holds `: `. The
fix lands in this change's own PR, in phase 2, with the `context:` edit. `deliver-check`'s archive
file check (P13, `docs/openspec-flow.md` "The file check") refuses an `openspec/config.yaml` change
that no approved retro proposal names, but it reads only the archive branch's diff against the
base, which is cut after this change merged: the config edit is already on the base, so the
archive PR does not carry it. A retro proposal of this change that touches `openspec/config.yaml`
must name that path, as any other.

### D-9. Phases, and what "test first" means here

Three phases, each run by `tdd-implementer` (the hooks keep every file outside `openspec/` and
`.claude/` closed to anyone else once readiness is approved; the roadmap and the config sit under
`openspec/` but follow the same phases):

1. **The decision and the design** (AC-1, AC-2, AC-5): ADR 0010, the five ADR edits, the OD-1
   assertion, `docs/coordination-design.md`, the `CLAUDE.md` row and the `README.md` documentation
   bullet, the mock verified. They go together because ADR 0010 and the design document link each
   other, and `scripts/check.py` refuses a broken link. Test first: the OD-1 assertion is edited
   before ADR 0007, and the filtered run goes red (ADR 0007 still `accepted`); the gate's `grep`
   and `test` parts fail on the base (no ADR 0010, no design document, 0 `(D-n)` headings).
2. **The files that state the rule** (AC-3, AC-4, AC-7): `openspec/config.yaml`, the roadmap,
   `README.md`, `docs/openspec-flow.md`, `docs/compozy-kit.md`, `plugins/openspec/README.md` and
   the release of D-7. The pack README and the release go in one task so the pin, version and
   CHANGELOG tests never see one without the other. Test first: every negative `grep` of
   the gate finds its line on the base, the session report shows Round 5, and `openspec instructions
   design` prints the warning; each turns green with its edit.
3. **The regression gate** (AC-6): the whole suite once, the catalog, the plugin validation and the
   path check. Nothing is edited; a red part sends the fix back to the phase that owns the file.

The per-phase test is the suite filtered to the 22 tests of D-5 (nine `--test-name-pattern` flags,
about 0.2 s on the base); the whole suite (about 8.5 minutes) runs once, in phase 3, as a
background command. Gate commands hold no `|` (`pr-verifier` copies each `&&` part into a table
cell): alternatives are separate `-e` or `--test-name-pattern` arguments, and the two outputs that
need reading go through a file in `$TMPDIR`.

### Implementation plan

Surfaces: documentation (`docs/`, `README.md`, `CLAUDE.md`), planning files (`openspec/`), the
`devkit-openspec` pack (one README sentence, one test assertion, its version) and the release
files. No backend, frontend or worker.

Files: create `docs/adr/0010-openspec-as-the-harness.md`, `docs/coordination-design.md`; modify
`docs/adr/0001-coordination-without-a-harness.md`, `0006-phases-as-child-sessions.md`,
`0007-one-change-on-request.md`, `0008-reviews-as-a-workflow.md`,
`0009-compozy-loop-as-a-second-driver.md`, `README.md`, `CLAUDE.md`, `docs/openspec-flow.md`,
`docs/compozy-kit.md`, `openspec/config.yaml`, `openspec/roadmap.md`,
`plugins/openspec/hooks/guard.test.mjs` (one line), `plugins/openspec/README.md` (one sentence),
`plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`;
delete none. Commit the change folder with
`mock/`.

Estimate: optimistic 5.5 h, likely 8 h, pessimistic 12 h (one review round on the design document's
completeness).

| Component | Hours | Type | Risk |
|---|---|---|---|
| ADR 0010 and the five ADR edits | 1 | Documentation | LOW |
| OD-1 assertion | 0.25 | Testing | LOW |
| `docs/coordination-design.md` | 3 | Documentation | MEDIUM |
| `CLAUDE.md`, `README.md` links; mock check | 0.25 | Documentation | LOW |
| Config fix and ADR line | 0.25 | Migration | LOW |
| Roadmap rewrite | 0.5 | Documentation | LOW |
| README, flow doc, kit page, pack README rewording | 1 | Documentation | LOW |
| Release 0.18.1 (versions, CHANGELOG, CI pin) | 0.5 | Migration | LOW |
| Regression gate (suite in background) | 1 | Testing | LOW |

Assumptions (each breaks the plan if false): OpenSpec stays at 2.0.0 for the change (`openspec --version` today); the base stays
`99474cf` with no sibling editing the same documents (one change at a time); the bundled Claude
Code exists under `~/Library/Application Support/Claude/claude-code/` (2.1.326 today).

Dependencies: none delivered by another change; `requirements.md` is the only source.

## Risks / Trade-offs

- [The design document misses an item, so change 2 cannot be planned from it] (MEDIUM × MEDIUM) →
  the outline maps every D-n to a section, the gate counts the 13 headings, the readiness reviewer
  checks sufficiency (AC-2), and change 2 confirms it.
- [A rewording breaks a pinned sentence] (LOW × MEDIUM) → D-5 lists every pin, and the filtered run
  is in every phase gate.
- [Two coordination models in the documents confuse a reader] (MEDIUM × LOW) → each place names
  ADR 0010 and the round that replaces what it describes.
- [The release files drift apart (a version moved without its pin or CHANGELOG)] (LOW × MEDIUM) →
  one task moves them together, and gate 2.7 checks each version, the CHANGELOG heading and each of
  the three pin lines with a part that fails on the base.
- [A sibling release conflicts in `docs/openspec-flow.md` beyond the pin] (LOW × MEDIUM) → no other
  change runs meanwhile; `release-rebase` aborts on such a conflict instead of resolving it.

## Migration Plan

Nothing to deploy. After the merge the tag `v0.14.2` is pushed (`CONTRIBUTING.md`). Rollback is a
revert of the merge commit: the documents return to ADR 0001 and ADR 0007, and no behaviour depends
on them; projects pinned to `v0.14.2` keep a pack whose only difference is one README sentence.
