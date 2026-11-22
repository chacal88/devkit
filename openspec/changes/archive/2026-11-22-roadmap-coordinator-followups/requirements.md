<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> what the review and the live test of roadmap-coordinator left open: a ready line says it waits for a place only when no place is free, and a gate or blocked line says the others go on only when another change is running; ADR 0013 decision 4 names every field of the run file; ids from --param and --after are checked before they become keys; a failed write removes the temporary run file; the run file's lock waits less than the agent hook's timeout; a killed hold does not leave the run holding; tests for run without --session, a lock that times out through its callers, the draft's language fallback and the single read of mainInRun; and what the first real /devkit roadmap on this roadmap shows (the selection, changes running while the owner answers, many ends in a row, a change that reaches the delivery part, a project with many old changes)

Classification: domain=process type=bug flags=[contract] (confirmed: the run file and the skill's call lines are read by the hooks and by every session that runs `/devkit roadmap`).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The code lives in `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/hooks/guard.mjs` (`mainInRun`), `plugins/openspec/hooks/change-loop.mjs` (`withLockFile`) and `plugins/openspec/skills/devkit/SKILL.md`; the run file's fields are named in `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, decision 4.
- The run file's lock wait (`LOCK.waitMs` in `plugins/openspec/hooks/roadmap-loop.mjs`, today 10 000 ms) ends before the agent hook's timeout (`"timeout": 10` seconds for `guard.mjs agent` in `plugins/openspec/hooks/hooks.json`), so a waiting hand-off gets the lock's own refusal and never the host's hook timeout.
- A hold that is killed (the session stops its background task, the machine sleeps, the process dies) leaves nothing that makes the next `next` hold again by itself: the next `next` decides from the load at that moment. In this run the session stopped the hold and the next `next` went on; that is the behaviour to keep and test.
- The first live defect is literal: the `/devkit roadmap` code block in `plugins/openspec/skills/devkit/SKILL.md` puts `$ARGUMENTS` in the heredoc of `roadmap-loop.mjs run`, which expands to `roadmap 2`, and `run` accepts only the word after `roadmap` (`2`, `stop`, nothing). AMBIGUOUS: (a) the skill passes only the word after `roadmap` | (b) `run` also accepts the whole arguments starting with `roadmap`; the planner resolves.
- The second live defect: while a change is held by the load there is no way for the owner to start it anyway; the session had to call `next` with a raised `--load-limit` by hand.
- The third live defect: in a session the desktop app started in a worktree of its own, the host refuses the session's writes to a change's worktree until the session switches into it, and after a switch the worktree visited before is no longer writable; with two changes under way, the coordinator (and its background hand-offs) cannot write to both. The plan says how a roadmap run works in such a session.
- One session per change reverses ADR 0013 decision 1 ("the session the owner typed /devkit roadmap in is the roadmap coordinator ... one level of subagents") and the rejected option "App child sessions, one per change (ADR 0006)" of its alternatives table. The owner decided it on 2026-11-21 after the first real run: with every change's stages inside one session, only one background task was visible and the owner could not see what each change was doing. The plan writes a new ADR that supersedes ADR 0013 in that part.
- The app refuses to open a session on a turn that an automated event started (a background task's end, a wait on GitHub); it opens one on a turn the owner typed. The plan says how a change that becomes ready on such a turn starts (AC-15).
- AMBIGUOUS: (a) the stage icon is an app session icon set through the app's own tools | (b) the stage icon is a leading emoji in the session's title, renamed at each stage; the planner checks what the app offers and resolves.
- The hold line tells the owner that they can say to start anyway; the owner's own words in chat are the only source of that permission, never a file or an agent's report.
- The live part is proven by this run itself (the two changes `roadmap-coordinator-followups` and `merge-setup-field-fixes`, started together on 2026-11-21): the evidence quotes the run's records in English up to this change's verification; what happens after it (this change's own merge and archive, the other change's end) goes in the retro.
- "A project with many old changes" is checked on this repository (its archive) and on a scratch project with many archived changes, not on another project of the owner.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `ready-line-waits-only-when-full` — a change that is ready shows "waits for a place" only when every place is taken; with a free place it is started, or held by the load with the load line.
- AC-2 `others-go-on-only-when-running` — a line for a gate the owner must answer or for a blocked change says that the others go on only when another change of the run is under way at that moment.
- AC-3 `adr-names-run-file-fields` — ADR 0013 decision 4 names every field the run file holds, and a test fails when the run file gains a field the ADR does not name.
- AC-4 `ids-checked-before-keys` — an id given with `--param` or `--after` that is not a valid change id is refused with a message and writes nothing to the run file.
- AC-5 `failed-write-cleans-temp` — when writing the run file fails, no temporary run file is left beside it.
- AC-6 `lock-wait-under-hook-timeout` — the run file's lock gives up before the agent hook's timeout, and a hand-off that waits on a held lock gets the lock's refusal, not the host's timeout.
- AC-7 `killed-hold-does-not-hold` — after a hold is killed, the next `next` starts the held change when the load is under the limit and holds it again only when the load is still above.
- AC-8 `start-anyway-once` — while a change is held by the load, the owner can say to start anyway: the held changes start now; a change that becomes ready later in the same run is held again by the limit and the owner is asked again.
- AC-9 `roadmap-n-starts-first-call` — `/devkit roadmap 2` typed by the owner starts the run on the session's first call to `roadmap-loop.mjs run`, with no refusal.
- AC-10 `missing-tests-added` — tests exist and pass for: `run` without `--session`; a lock that times out, seen through each caller of the lock; the draft's language fallback; `mainInRun` read once per hook call.
- AC-11 `first-run-defects-fixed` — every defect this run shows until this change's delivery ends is fixed in this change (the three named in the assumptions included), each after the spec delta and the plan are revised and the owner approves them again; each one has a test that was red before its fix.
- AC-12 `first-run-observed` — the evidence records, from this run: the selection of the two ready changes out of the roadmap, a change going on while the owner answers the other's questions, several ends of the run in a row handled one after another, a change reaching the delivery part, and the run on a project with many archived changes. The first run was moved by hand to one session per change on 2026-11-21 (see AC-13); what it showed before the move and what the per-change sessions show after it both count.
- AC-13 `one-session-per-change` — in the Claude driver, `/devkit roadmap` gives every change it starts an app session of its own, visible in the sidebar as a child of the session the owner typed `/devkit roadmap` in; the change's stages, its owner questions and its approvals happen in that session; the typed session keeps the roadmap: it picks what starts, holds for the load and shows the run's board.
- AC-14 `session-icon-by-stage` — every change session shows an icon for the stage the change is in now (requirements, plan, code, review, delivery, archive), and the icon changes when the stage changes, so the owner tells the sessions apart in the sidebar at a glance.
- AC-15 `start-needs-no-retyping` — when a change becomes ready while no owner turn is open (another change was archived, the load eased), the owner sees what happens to it: it starts in its own session, or the coordinator's board says it waits for the owner's next message, with the reason; it is never left without a line.

## Out of scope

- The items carried to round 16 (`stage-roles`) by the roadmap-coordinator retro: a declared step for a small fix after a red gate, a task done by the conducting session, the wait on GitHub beside a host's own pull-request monitor, the verifier writing under `proof/`.
- Lifting the load limit for a whole run: the owner's word starts the changes held at that moment only.
- The two defects of `merge-setup-field-fixes` (`deliver-check --watch` and `github-setup.mjs --checks ""`), which run as their own change in this same run.

## Questions asked

1. [scope] This run is the first real `/devkit roadmap` and has already shown two defects (the skill passes `roadmap 2` where `run` accepts only `2`; no way to start anyway when the machine is loaded). How much of "what the first run shows" does this change cover? → Up to the end: every defect the run shows until this change's delivery ends, with the plan revised and approved again for each.
2. [end effect] When the machine is loaded and the owner says to start anyway, what happens? → Only this time: the held changes start; a change that becomes ready later is held again and the owner is asked again.

3. [project rules] With every change inside the typed session, only one background task shows in the app and nothing tells the changes apart. How should the owner follow the changes of a run? → One session per change, with icons on the sessions that identify them; otherwise it becomes a mess. (Reverses ADR 0013 decision 1.)
4. [end effect] Which kinds must the session icon tell apart? → The stage the change is in now.
5. [scope] The two changes of this run were inside the typed session. → Move them now: one session per change, each resuming where it stopped; the typed session starts nothing new.

## Escalations

- Resolved by the owner on 2026-11-21: one session per change reverses ADR 0013 decision 1; the plan records it in a new ADR.
