<!-- devkit-stage proposal result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Proposal

Change: `roadmap-coordinator` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 1, 2, 3, 10 and 13,
`docs/adr/0010-openspec-as-the-harness.md` decisions 2, 3 and 8,
`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`). Round 18 of `openspec/roadmap.md`,
step 6 of the build order.

## Why

`/devkit change` runs one change at a time, and only the one the owner names. The roadmap already
says which changes are ready (their `after:` dependencies are archived), but nothing starts them: the
owner reads the roadmap, picks each change and types it. ADR 0010 decision 2 asks for a roadmap
coordinator that starts the ready changes on its own, several at once up to a number the owner sets
per run, and holds a new start while the machine is loaded. Round 15 built the change coordinator it
starts; this round builds the roadmap coordinator and the board that shows where everything is.

## What Changes

- `/devkit roadmap [<n>]` (the `devkit` skill of `devkit-openspec`): starts, without asking, every
  candidate line of `openspec/roadmap.md` whose `after:` changes are archived on the default branch,
  in the file's order, until the open changes of the roadmap reach `<n>` (1 when absent), and carries
  each open change with the loop of `/devkit change`. Typing it again changes the number of the run;
  a lower number interrupts nothing. Any other word, or a number below 1, is answered in one sentence.
- `/devkit roadmap stop`: nothing new starts, each change under way finishes its current stage, and
  the reply says where each stayed; `/devkit roadmap` resumes from there.
- `/devkit status`: a read-only board (a count line, the load line when starts are held, then the
  blocks waiting for you, under way, blocked, in the queue and outside the roadmap), in any session,
  with or without a run or a roadmap.
- Holding starts while the machine is loaded: the processor load of the last minute per logical core
  against a per-person limit, the new `load_limit` setting of `devkit-openspec` (80 by default),
  read before every start and every 60 seconds while a start is held.
- A new script, `plugins/openspec/hooks/roadmap-loop.mjs`, decides everything the command does; its
  replies join the one message table of `change-loop.mjs`. Opening a change takes a lock, so two
  openings at once never collide.
- The locks of ADR 0011 follow every change of a roadmap run: no product code by the session,
  hand-offs only to a role of the script of the change the hand-off names, and no end of turn while a
  stage of any open change is ready and not under way. The end of one change releases no other.
- A new ADR 0013, `proposed`: in the Claude driver the roadmap coordinator is the owner's session,
  which runs every open change's loop and hands each stage to a subagent in the background, with one
  run's bookkeeping file; it amends ADR 0010 decision 8 (the ADR 0005 bullet) and ADR 0011 decisions
  1 and 2. It becomes `accepted` only if the owner accepts it with the plan, and nothing is built on
  it before the probe of `design.md` D-2 confirms its facts.
- Documents: the coordination design records what exists and answers its open point on load; ADRs
  0010 and 0011 gain dated Notes; the flow page, the roles page, both READMEs and the catalog
  describe the two commands.

Non-goals: the panels and `/devkit help` (round 23) and any change to the current panel or its
`status` tool; `/devkit project` (19), the Jira entry (20), the CompozyOS and script drivers (21, 22);
running a change on another machine (28); measuring memory; finishing or discarding changes of the
previous script; removing `conduct-check`, `deliver-check` or the child-session code (24); a stored
default for the number; any behaviour of `/devkit change` (its lock reader included: the end
marker's id check stays carried by round 16); the two other places that read "archived" from the
roadmap's tick (the session report and `conduct-check`), which keep reporting as today.

## Acceptance criteria

Copied from `requirements.md`, with their ids. Each criterion says where it is proved: `here` (the
tests and the live test of this change) or `next` (the first real use of `/devkit roadmap` on this
repository's roadmap after this change is archived, recorded in the retro of the first change it
carries).

- AC-1 `starts-what-is-ready` — `/devkit roadmap` starts, without asking, every candidate change whose `after:` dependencies are archived (A-4), in the order of the roadmap file, until the open changes reach the number. It never starts a change with an unarchived dependency, a ticked line or an archived change. Proved here: the selection against roadmap fixtures of every case, and two independent changes started in the live test. Proved next: the selection on this repository's own roadmap.
- AC-2 `number-set-per-run` — With no number one change is open at a time; with `<n>` up to `n`. Typing the command again with another number changes the run under way: a higher number starts more, a lower number interrupts nothing and only stops new starts until the open changes fall below it. A word or a number that is not valid gets one plain sentence and starts nothing (A-2). Proved here.
- AC-3 `open-changes-fill-the-places` — A change waiting for the owner, waiting on GitHub or blocked still fills its place: with every place filled nothing new starts, whatever the states. A roadmap change already open on the current script is resumed before any new one starts and counts (A-3). Proved here.
- AC-4 `holds-starts-while-loaded` — With the load at or above the limit no change starts, also when none is open; the session says once that it is holding, with the load read and the limit, checks again every minute and starts by itself when the load is below the limit. A change under way is never interrupted by the load (A-6, A-7). Proved here: the decision with the load reading replaced in tests, and the real reading shown by `/devkit status` in the live test. Proved next: a start held and released under the machine's real load.
- AC-5 `one-line-per-event` — While a run goes on the owner sees one short line for each event of A-8 and nothing else unasked. Every line is in the person's language (`pt-BR` and `en`) and holds no internal term; the test of the message table that refuses the listed internal words covers the new lines. Proved here.
- AC-6 `status-shows-the-whole-picture` — `/devkit status` prints a first line with the count (open changes and the number, the queue, the archived ones) and, when starts are held, the load read and the limit; then five blocks, always in this order and each only when it has something: waiting for the owner, under way, blocked, in the queue (with what each waits for: a place, or the change it depends on) and outside the roadmap. It changes nothing, works in any session of the project, with or without a run, and in a project without `openspec/roadmap.md` (A-11). Proved here.
- AC-7 `owner-gates-asked-in-a-queue` — When changes of one run reach a gate of the owner, the questions come one change at a time, in the order of the roadmap file, each naming its change; the changes that do not wait on the owner keep running meanwhile. The plan approval and the retro answers are recorded only from the owner's own message (A-10). Proved here: the order and the naming by tests, and two changes at their grill at once in the live test. Proved next: changes that keep running while the owner answers another one, over a whole real change.
- AC-8 `stop-at-the-end-of-the-stage` — After `/devkit roadmap stop` no change starts, each change under way finishes its current stage and stops, and the reply says where each stayed. `/devkit roadmap` then goes on from those places (A-9). Proved here.
- AC-9 `blocked-change-keeps-its-place` — When a change is blocked the session says so with the reason, the other changes go on, and the changes that depend on it wait. When every place is filled by a change that is blocked or waits for the owner, the run ends and lists what each one needs (A-15). Proved here.
- AC-10 `no-roadmap-offers-a-draft` — In a project without `openspec/roadmap.md`, `/devkit roadmap` starts nothing and offers to create the file; on a yes the draft of A-11 is written, uncommitted, with the changes of the previous script named in the reply and left out; on a no nothing is created. Proved here.
- AC-11 `other-changes-left-alone` — A change that is not on the roadmap, or that was started on the previous script, is never started or resumed by the run, fills no place and raises no question; `/devkit status` lists it apart. A roadmap line whose change is on the previous script is skipped with one line, and its dependents wait (A-12). Proved here, on fixtures of both cases: a change that is not on the roadmap, and a change of the previous script in each form `plugins/openspec/hooks/flow-check.mjs#isPreviousScript` recognises. Proved next: in a project that holds many old changes.
- AC-12 `calling-again-resumes` — Nothing is remembered between runs: killing the session at any moment and typing `/devkit roadmap` again continues every open change from what the files say, starts no change twice and loses none (A-14). Proved here, by tests and in the live test.
- AC-13 `locks-follow-every-change` — During a roadmap run the session edits no product code, hands work only to the roles the script of each change lists, and does not stop while a stage of any open change is ready; this holds for every change of the run, not only for the newest one, and the end of one change releases no other. A session with no run is never held (A-13). Proved here, by tests and in the live test.
- AC-14 `no-end-is-lost` — Every stage end of every change of a run reaches the loop: in the live test two changes go through at least three stages each with none missed, and an end that does not arrive costs one re-read of the files, never the place of a change (ADR 0010, review trigger). Proved here for the live test's stages. Proved next: many ends in a row over whole changes.
- AC-15 `one-task-unchanged` — `/devkit change` shows no behaviour change: its existing tests pass and the unfinished-work question, the stage loop and the wait on GitHub answer as before (A-16). Proved here.
- AC-16 `design-and-docs-follow` — `docs/coordination-design.md` says what exists now (sections 1, 2, 10 and the open point of how load is measured, answered here), the new ADR is in `docs/adr/`, `docs/roles.md`, `docs/openspec-flow.md`, the pack's `README.md` and the catalog describe the two commands, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass. Proved here.

## Capabilities

### New Capabilities

- `roadmap-coordination`: `/devkit roadmap` and `/devkit status`: which roadmap lines are candidates
  and when one starts, the number of a run and the places it fills, holding starts while the machine
  is loaded, the event lines, the owner's gates asked in a queue, stopping, blocked changes, the end
  of a run, the draft roadmap, changes left alone, resuming, and the board.

### Modified Capabilities

- `change-coordination`: the verb requirement (`roadmap` and `status` run; `project` and `help` still
  name rounds 19 and 23; the reply to an unknown verb names the three commands that exist), and a new
  requirement that two openings at once do not collide.
- `coordination-locks`: new requirements for a roadmap run: how a session knows it is in one, the
  stop lock over every open change, the hand-off lock by the change the hand-off names, the edit
  lock, the stage agent's stop lock by its own change, and what marks a stage as under way. The
  requirements of a `/devkit change` run are unchanged.

## Impact

- devkit-openspec (0.17.1 to 0.18.0): new `hooks/roadmap-loop.mjs` and `hooks/roadmap-loop.test.mjs`;
  `hooks/change-loop.mjs` (the `start` routing of the two verbs and the new text of the reply to an
  unknown verb, the new message keys, the `gate` parameter family and the blocked reasons of the two new
  blocked lines in `render`, the reply's parameters beside an end action, the lock around `open`, three
  exports; no behaviour of `/devkit change` changes); `hooks/guard.mjs` (the roadmap run reader, the
  locks' routing, the edit lock in a roadmap run); `hooks/guard.test.mjs` (one import line);
  `hooks/change-loop.test.mjs` (the five changed tests T-1 to T-5 of `design.md` D-18, each with its
  invariant, layer and suite, named in `tasks.md`);
  `skills/devkit/SKILL.md`; the `load_limit` user setting in `plugin.json`; `README.md`.
- Repository: `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md` (new), Notes in ADRs
  0010 and 0011, `docs/coordination-design.md`, `docs/openspec-flow.md` (with the CI pin `v0.18.0`),
  `docs/roles.md`, `openspec/config.yaml` (the ADR line), `README.md`, `CHANGELOG.md`,
  `.claude-plugin/marketplace.json` (0.22.0), `docs/catalog.md` (generated).
- Projects: two more verbs of `/devkit`; nothing changes for a project that does not type them.

**Dependencies.** The change coordinator (round 15, `change-coordinator`, archived) and the field
fixes (round 17b, `coordinator-field-fixes`, archived at `6918c0d`), whose `change-loop.mjs`
exports (`nextAction`, `unfinished`, `archivedOnDefault`, `openChange`, `waitLoop`, `render`) this
change calls; `guard.mjs#parseRoadmap`; the Claude Code facts of `design.md` D-1, four of them probed
before anything is built on them (D-2).

**Exit criteria.** `openspec validate roadmap-coordinator --strict`; the whole hook suite
`node --test plugins/openspec/hooks/guard.test.mjs` green with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set; `python3 scripts/check.py`; `python3 scripts/gen-catalog.py --check`;
`claude plugin validate .`, run by the conducting session with the desktop app's bundled Claude Code
and recorded (`design.md` D-16: the plain `claude` command is a shell function that fails in these
sessions; on the base `6918c0d` the bundled 2.1.326 ended with "Validation passed" on 2026-11-21); the
probe and the live test recorded.

**What the owner approves**, in the message that approves the plan (quoted in `approval.md`):

- The plan, and ADR 0013 (`design.md` D-14): accept it, and it becomes `accepted` once the probe
  confirms its facts; refuse it, and the plan goes back to planning before any code.
- The three ambiguities the grill left to the planner, resolved in `design.md`: the setting's name
  `load_limit` (D-6, A-6), the shape (b) of the Claude driver (D-2, A-13), and the run's number kept in
  one bookkeeping file in the git directory (D-5, A-14).
- The stated limits of `design.md`'s proof map: AC-4's real load is shown only as a reading in the
  live test; AC-7's "others keep running while the owner answers" and AC-14's many ends in a row are
  shown live only over the scratch roadmap's short stages; a stage whose end never arrives keeps its
  change under way in that session until `/devkit roadmap` is called from a new one.

**Decisions cited.** ADR 0010 (decisions 2, 3, 4, 5 and 8; decision 8's ADR 0005 bullet amended by
the proposed ADR 0013), ADR 0011 (decisions 1 and 2 extended by ADR 0013), ADR 0004 (the hooks act
only in opted-in projects), ADR 0002 and ADR 0003 (merge rules unchanged: each change's delivery is
`/devkit change`'s), ADR 0006 (app child sessions not used).

**Open decisions inherited.** How the roadmap coordinator measures load leaves the design's open
points (answered here, D-6). Whether the review stage keeps the Workflow path stays open. Where a
change runs (round 28) stays proposed.
