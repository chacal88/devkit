<!-- devkit-stage requirements result=passed attempt=1 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Requirements

Change: `roadmap-coordinator` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Grill: held on 2026-11-21 in the owner's session, eleven questions (Questions asked). This is round
18 of `openspec/roadmap.md`, step 6 of the build order in `docs/coordination-design.md` (section 11):
the roadmap coordinator, which starts the change coordinators round 15 delivered.

Classification: domain=product type=feature flags=[architecture, contract] (confirmed: `/devkit`
gains two verbs every project types, a second coordinator is a new role, and a run of several
changes at once changes how the locks of ADR 0011 find their run).

## Request

(The owner's request, translated from Portuguese.)

> Build the roadmap orchestrator, round 18 of openspec/roadmap.md. Use the id roadmap-coordinator.
> It starts every change whose "after:" dependencies are already archived, several at the same time
> up to the number I set per run, and holds new starts while the machine is loaded, so that what is
> under way finishes first. Commands: /devkit roadmap and /devkit status. It follows decisions D-1
> and D-2 of docs/coordination-design.md and ADRs 0010 and 0011. In the interview I want to decide at
> least: how many changes at the same time and where I set that number; what I see while it runs and
> how I stop everything; what it does when a change stops at a gate of mine while the others go on;
> what it does in a project without openspec/roadmap.md and with frozen changes or changes of the
> old script; and what counts as "machine loaded". Split every acceptance criterion into "proved
> here" and "proved in the real use of the next round".

Asked first whether to continue one of three unfinished changes of the previous script or to start
this request, the owner answered "Começar o novo pedido" ("Start the new request").

The design this change builds from is `docs/coordination-design.md`: section 1 (the commands
`/devkit roadmap`, `/devkit roadmap 3` and `/devkit status`), section 2 (the roadmap coordinator,
`manager`, and holding a start while the machine is loaded), section 3 (a command and a loop, never
a session that remembers), section 10 (the Claude driver in the roadmap mode) and section 13 (what
is still to prove live), with ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`, decisions 2, 3
and 8) and ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`).

## Assumptions

- A-1. The pack `devkit-openspec` gains three forms of `/devkit`: `/devkit roadmap [<n>]`,
  `/devkit roadmap stop` and `/devkit status`. They are wired in
  `plugins/openspec/skills/devkit/SKILL.md`; in `plugins/openspec/hooks/change-loop.mjs` the table
  `VERB_ROUND` stops answering `not-built` for `roadmap` and `status` (`project` and `help` keep that
  answer). Whether the roadmap decisions live in `change-loop.mjs` or in a script of their own is
  the planner's.
- A-2. The number (question 1): `<n>` is a whole number of 1 or more, typed after `roadmap`; with no
  number it is 1. It is never a project setting and never a stored personal default. Typing
  `/devkit roadmap <n>` again while a run is under way changes the number of that run: a higher one
  lets more changes start, a lower one never interrupts a change under way. Any other word after
  `roadmap` except `stop`, or a number below 1, gets one plain sentence and starts nothing.
- A-3. What fills a place (questions 5 and 10): every change of the roadmap that was started and is
  not archived yet is "open" and fills one place, whatever its state: running, waiting for the
  owner, waiting on GitHub, or blocked. A roadmap change already open on the current script when the
  run starts (opened by `/devkit change` or by an earlier run) is resumed first and counts.
- A-4. A roadmap line is a candidate when it is unticked and its change is not archived. An `after:`
  dependency is met when that change is archived on the default branch, decided the way
  `plugins/openspec/hooks/change-loop.mjs#archivedDates` decides it today; the tick in
  `openspec/roadmap.md` reports and gates nothing, as the SessionStart line already says. A line
  that is ticked but not archived, or archived but unticked, is never started, and `/devkit status`
  says which it is. Candidates start in the order of the file (round, then line). Today three places
  read "archived" differently (`guard.mjs#roadmapReport` by the tick, `conduct-check.mjs` by the tick
  on `origin/<base>`, `change-loop.mjs` by the archive folder); the roadmap coordinator uses one.
- A-5. Two changes run at once only when neither depends on the other, which A-4 already gives: a
  change starts only after every change it names in `after:` is archived.
- A-6. "Machine loaded" (questions 8 and 9): the processor load of the whole machine over the last
  minute divided by the number of logical cores, that is `os.loadavg()[0] / os.cpus().length` in
  Node. At or above the limit, no new change starts. The limit is 80% by default and is a per-person
  setting of the pack, beside `userConfig.language` in `plugins/openspec/.claude-plugin/plugin.json`
  (it follows the machine, not the project). AMBIGUOUS: the setting's name, (a) `loadLimit` as a
  percentage | (b) another name the plugin configuration reads better; the planner resolves. The
  load is read before every start and, while a start is held, again every 60 seconds. Memory is not
  measured. On a system where Node reports no load average (Windows returns 0) the machine never
  counts as loaded, and the documentation says so.
- A-7. The hold applies even when no change of the roadmap is open (question 9): the session says it
  is holding, with the load read and the limit, checks every minute and starts by itself when the
  load falls. The owner forces a start by raising the limit or by calling `/devkit change` for that
  change. A held start is announced once, not at every check.
- A-8. What the owner sees (question 2): one short line per event, in the person's language, with no
  internal term: a change started (with the count of open changes and the number), a start held by
  the load, a change reached a gate of the owner, a change was archived, a change is blocked (with
  the reason), the run was asked to stop, the run ended. The whole picture comes only from
  `/devkit status`.
- A-9. Stopping (question 3): `/devkit roadmap stop` starts nothing new, lets each change under way
  finish the stage it is in, and then stops; the reply says where each change stayed.
  `/devkit roadmap [<n>]` resumes from there. Interrupting the session (Esc) stops at once and costs
  at most the stage that was running, which runs again on the next call.
- A-10. The owner's gates (question 4) stay the ones the change's script declares: the grill's
  questions, the plan approval and the retro answers, and a pull-request decision only the owner can
  take. When a change reaches one, the session says so in one line and asks in a queue, one change
  at a time, in the order of the roadmap file, naming the change in every question; the next
  change's questions come only when the owner finished that one's. The other changes keep running
  while the owner answers. `approval.md` and the retro `Answer:` lines are written only from the
  owner's own message, by the main session, as ADR 0011 already requires.
- A-11. A project without `openspec/roadmap.md` (questions 6 and 11): `/devkit roadmap` says there is
  no roadmap and offers to create the file. On a yes it writes `openspec/roadmap.md` in the
  session's checkout, with one line per unfinished change of the current script and no `after:`,
  names in its reply the changes of the previous script it left out, commits nothing and starts
  nothing; the owner edits it, delivers it the project's way and calls `/devkit roadmap` again. On a
  no nothing is created. `/devkit status` works without the file and lists the unfinished changes.
- A-12. Changes that are not the roadmap's (question 7): a change that is not on the roadmap, and a
  change started on the previous script (`script: previous` in
  `plugins/openspec/hooks/flow-check.mjs`), are never started or resumed by the roadmap coordinator,
  fill no place and raise no question; `/devkit status` lists them apart with where each stopped. A
  roadmap line whose change is on the previous script is skipped with one line saying so, and the
  changes that depend on it wait. "Frozen" has no meaning of its own in the code: it is these two
  cases.
- A-13. The shape in the Claude driver. AMBIGUOUS: (a) each change coordinator is a subagent of the
  session and the stage agents are its subagents, as ADR 0010 decision 8 and section 10 of the
  design say, with the owner's questions going up to the session | (b) the session runs the loop of
  every open change itself and hands each stage to a subagent that runs in the background; the
  planner resolves it with a probe before anything is built on it (whether a subagent can start
  subagents here, and whether each end reaches the session). Either way the choice, and how the
  locks of ADR 0011 follow several changes of one session, are recorded in a new ADR that the owner
  approves with the plan. Today `plugins/openspec/hooks/guard.mjs#runOf` follows only the newest
  change id of a session, its end marker ignores the id, any typed command other than
  `/devkit change` turns every lock off, and the stop record holds one progress key per session.
- A-14. Nothing is remembered between runs (ADR 0010 decision 3): the open changes, where each is and
  what waits on the owner are read from the files, git and GitHub at every call. AMBIGUOUS: where
  the number of the current run is kept so that a later turn and `/devkit status` in another session
  can show it, (a) one run's bookkeeping file outside the repository | (b) only the session's
  transcript, and `/devkit status` elsewhere shows the open count without the number; the planner
  resolves, within what ADR 0010 decision 8 accepts as one run's bookkeeping.
- A-15. The run ends by itself in one of these: every roadmap line is archived; nothing can start
  and nothing is running, with a list of what each open change needs (the owner's answer, a blocked
  reason, an unmet dependency); or the owner asked to stop. Waiting on GitHub has no time limit, as
  in `/devkit change`. A change the coordinator cannot open is reported as blocked with the reason.
- A-16. `/devkit change` keeps working as it does today for one task, the unfinished-work question
  included; no behaviour of it changes in this round. The panel's `mcp__devkit-panel__status` tool is
  untouched; the read-only panels are round 23.
- A-17. Proof (the owner's request): "here" is this change's tests plus one live test on a scratch
  repository whose roadmap holds small changes, as `change-coordinator` recorded its own; "next" is
  the first real use of `/devkit roadmap` on this repository's roadmap after this change is
  archived, recorded in the retro of the first change it carries.
- A-18. The delivery follows `CONTRIBUTING.md`: a minor version of `devkit-openspec`, the changelog,
  a new capability spec for the roadmap coordinator, a delta of the scenario of
  `openspec/specs/change-coordination/spec.md` that names rounds 18, 18, 19 and 23 for the verbs not
  built, and the tick of round 18 at the archive.

## Acceptance criteria

Each criterion says where it is proved: `here` (the tests and the live test of this change, A-17) or
`next` (observed in the first real use of `/devkit roadmap` on this repository's roadmap, recorded
in the retro of the first change it carries).

- AC-1 `starts-what-is-ready` — `/devkit roadmap` starts, without asking, every candidate change
  whose `after:` dependencies are archived (A-4), in the order of the roadmap file, until the open
  changes reach the number. It never starts a change with an unarchived dependency, a ticked line or
  an archived change. Proved here: the selection against roadmap fixtures of every case, and two
  independent changes started in the live test. Proved next: the selection on this repository's own
  roadmap.
- AC-2 `number-set-per-run` — With no number one change is open at a time; with `<n>` up to `n`.
  Typing the command again with another number changes the run under way: a higher number starts
  more, a lower number interrupts nothing and only stops new starts until the open changes fall
  below it. A word or a number that is not valid gets one plain sentence and starts nothing (A-2).
  Proved here.
- AC-3 `open-changes-fill-the-places` — A change waiting for the owner, waiting on GitHub or blocked
  still fills its place: with every place filled nothing new starts, whatever the states. A roadmap
  change already open on the current script is resumed before any new one starts and counts (A-3).
  Proved here.
- AC-4 `holds-starts-while-loaded` — With the load at or above the limit no change starts, also when
  none is open; the session says once that it is holding, with the load read and the limit, checks
  again every minute and starts by itself when the load is below the limit. A change under way is
  never interrupted by the load (A-6, A-7). Proved here: the decision with the load reading
  replaced in tests, and the real reading shown by `/devkit status` in the live test. Proved next:
  a start held and released under the machine's real load.
- AC-5 `one-line-per-event` — While a run goes on the owner sees one short line for each event of A-8
  and nothing else unasked. Every line is in the person's language (`pt-BR` and `en`) and holds no
  internal term; the test of the message table that refuses the listed internal words covers the new
  lines. Proved here.
- AC-6 `status-shows-the-whole-picture` — `/devkit status` prints a first line with the count (open
  changes and the number, the queue, the archived ones) and, when starts are held, the load read and
  the limit; then five blocks, always in this order and each only when it has something: waiting for
  the owner, under way, blocked, in the queue (with what each waits for: a place, or the change it
  depends on) and outside the roadmap. It changes nothing, works in any session of the project, with
  or without a run, and in a project without `openspec/roadmap.md` (A-11). Proved here.
- AC-7 `owner-gates-asked-in-a-queue` — When changes of one run reach a gate of the owner, the
  questions come one change at a time, in the order of the roadmap file, each naming its change; the
  changes that do not wait on the owner keep running meanwhile. The plan approval and the retro
  answers are recorded only from the owner's own message (A-10). Proved here: the order and the
  naming by tests, and two changes at their grill at once in the live test. Proved next: changes
  that keep running while the owner answers another one, over a whole real change.
- AC-8 `stop-at-the-end-of-the-stage` — After `/devkit roadmap stop` no change starts, each change
  under way finishes its current stage and stops, and the reply says where each stayed.
  `/devkit roadmap` then goes on from those places (A-9). Proved here.
- AC-9 `blocked-change-keeps-its-place` — When a change is blocked the session says so with the
  reason, the other changes go on, and the changes that depend on it wait. When every place is
  filled by a change that is blocked or waits for the owner, the run ends and lists what each one
  needs (A-15). Proved here.
- AC-10 `no-roadmap-offers-a-draft` — In a project without `openspec/roadmap.md`, `/devkit roadmap`
  starts nothing and offers to create the file; on a yes the draft of A-11 is written, uncommitted,
  with the changes of the previous script named in the reply and left out; on a no nothing is
  created. Proved here.
- AC-11 `other-changes-left-alone` — A change that is not on the roadmap, or that was started on the
  previous script, is never started or resumed by the run, fills no place and raises no question;
  `/devkit status` lists it apart. A roadmap line whose change is on the previous script is skipped
  with one line, and its dependents wait (A-12). Proved here, on fixtures of both cases: a change that
  is not on the roadmap, and a change of the previous script in each form
  `plugins/openspec/hooks/flow-check.mjs#isPreviousScript` recognises. Proved next: in a project that
  holds many old changes.
- AC-12 `calling-again-resumes` — Nothing is remembered between runs: killing the session at any
  moment and typing `/devkit roadmap` again continues every open change from what the files say,
  starts no change twice and loses none (A-14). Proved here, by tests and in the live test.
- AC-13 `locks-follow-every-change` — During a roadmap run the session edits no product code, hands
  work only to the roles the script of each change lists, and does not stop while a stage of any
  open change is ready; this holds for every change of the run, not only for the newest one, and
  the end of one change releases no other. A session with no run is never held (A-13). Proved here,
  by tests and in the live test.
- AC-14 `no-end-is-lost` — Every stage end of every change of a run reaches the loop: in the live
  test two changes go through at least three stages each with none missed, and an end that does not
  arrive costs one re-read of the files, never the place of a change (ADR 0010, review trigger).
  Proved here for the live test's stages. Proved next: many ends in a row over whole changes.
- AC-15 `one-task-unchanged` — `/devkit change` shows no behaviour change: its existing tests pass
  and the unfinished-work question, the stage loop and the wait on GitHub answer as before (A-16).
  Proved here.
- AC-16 `design-and-docs-follow` — `docs/coordination-design.md` says what exists now (sections 1, 2,
  10 and the open point of how load is measured, answered here), the new ADR is in `docs/adr/`,
  `docs/roles.md`, `docs/openspec-flow.md`, the pack's `README.md` and the catalog describe the two
  commands, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.
  Proved here.

The board the owner approved for AC-6 (question 11), with example data, in the owner's language.
Corrected on 2026-11-21, during phase 1, in three places where the example the owner was shown did
not agree with the rules of this file and of `design.md`: the count read "3 abertas de 3" beside the
load line, but with every place filled it is the places, not the load, that hold a start (AC-3,
AC-4), so the example now has a free place and its ready line says it is held by the load; two rows
now carry the sentences the command already uses for those states (the plan approval and the red
tests); and the ids are aligned in one column. The blocks, their order and the two top lines are as
approved.

```text
Roadmap: 3 abertas de 4 · 2 na fila · 9 arquivadas
Começos segurados: processador em 92% (limite 80%)

Esperando você
  stage-roles           a sua aprovação do plano
Em andamento
  delivery-models       Implementação, fase 2 de 4
Travadas
  jira-entry            os testes da fase 1 falharam
Na fila
  compozy-driver        pronta, segurada pela carga
  project-phases        espera roadmap-coordinator
Fora do roadmap (o roadmap não toca)
  conventions-trailer   começada no roteiro anterior
```

The lines the owner approved for AC-5 (question 2), with example data, in the owner's language:

```text
▸ Comecei stage-roles (1 de 3 em andamento).
▸ Comecei delivery-models (2 de 3 em andamento).
▸ jira-entry está pronta para começar, mas a máquina está carregada: seguro o começo até aliviar.
▸ stage-roles espera a sua aprovação do plano. As outras seguem.
▸ delivery-models foi arquivada. Comecei jira-entry.
```

## Questions asked

1. [scope] How many changes at once, and where is the number set? → In the command, default 1:
   `/devkit roadmap` runs one at a time, `/devkit roadmap 3` up to three; typing it again changes
   the number, and lowering never interrupts.
2. [end effect] What do you see while it runs, unasked? → One line per event; the whole picture only
   with `/devkit status`.
3. [end effect] How do you stop everything, besides Esc? → `/devkit roadmap stop`: nothing new
   starts, each change finishes its current stage and stops there; `/devkit roadmap` resumes.
4. [edges] A change reaches a gate of yours while the others go on: how does the question reach you?
   → A queue in the session, one change at a time, each question naming its change; the others keep
   running.
5. [edges] Does a change waiting for you, or for GitHub, fill one of the places? → Yes: the number is
   of open changes.
6. [edges] What does `/devkit roadmap` do in a project without `openspec/roadmap.md`? → It offers to
   create the file.
7. [scope] What about stopped changes that are not the roadmap's (not on it, or of the previous
   script)? → It does not touch them and does not ask; `/devkit status` lists them apart.
8. [project rules] What counts as "machine loaded" (the open point of section 2 of the design)? →
   The processor load of the whole machine, per core, against a limit (80% by default, adjustable).
9. [edges] The machine is loaded by something else and no change is open: does the first one start?
   → No: it holds, says so and waits for the load to fall.
10. [edges] A change is blocked mid-run: what happens to its place? → It keeps the place; the others
    go on and its dependents wait.
11. [end effect] Is the `/devkit status` board right? → Yes, as shown (five blocks and the count
    line).

And, after question 6: [scope] what does the offered file hold? → A local draft for the owner to
review, with the unfinished changes of the current script, uncommitted; nothing starts on that call.

## Escalations

None. ADR 0010 decision 8 already takes up the roadmap mode; what this change adds to ADR 0011 (the
locks over several changes of one session, A-13) is written as a new ADR and approved by the owner
with the plan.

## Out of scope

- The read-only panels for the two coordinators and `/devkit help` (round 23), and any change to
  the current panel or its `status` tool.
- `/devkit project` (round 19), the Jira entry (round 20), the CompozyOS driver (round 21) and the
  script driver (round 22): `/devkit roadmap` answers for the Claude driver only, and the other
  drivers keep the answer they give today.
- Running a change on another machine (round 28, `remote-worker`).
- Measuring memory, or any load figure other than the processor's (A-6).
- Finishing, archiving or discarding the changes of the previous script found in a project (A-12).
- Removing `conduct-check.mjs`, `deliver-check.mjs` or the child-session code (round 24).
- A stored default for the number, in the project or per person (A-2).
