<!-- devkit-stage proposal result=passed attempt=3 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Proposal

Change: `roadmap-coordinator-followups` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech
spec: n/a (sources: `requirements.md`, the retro and `reviews/` of the archived change
`openspec/changes/archive/2026-11-21-roadmap-coordinator/`, ADR 0013). Round 18b of
`openspec/roadmap.md`.

## Why

The review of `roadmap-coordinator` left nine nits open (retro items 7 and 8). The first real
`/devkit roadmap` on this repository, which started this change, showed more. `/devkit roadmap 2` is
refused on the session's first call. The owner cannot start a change the load holds. A session the
desktop app starts in a worktree of its own cannot write to two changes' worktrees. With every
change inside one session, the owner could not tell what each change was doing. The owner decided on
2026-11-21 that every change of a run gets an app session of its own, which reverses ADR 0013
decision 1. These are fixed now, while the run that shows them is still going.

## What Changes

- **One session per change (desktop app).** Where the host can start sessions, the session the
  owner typed `/devkit roadmap` in only picks what starts, opens it, holds for the load and shows the
  board. Each change runs in an app session of its own, nested under it in the sidebar, started in
  the change's worktree with `/devkit change <id>`. Its stages, owner questions and approvals happen
  there. Where the host cannot start sessions, ADR 0013 decision 1 is unchanged. Recorded as ADR 0014,
  which supersedes ADR 0013 decision 1 for the desktop app.
- **A session started by another session is a change run for the locks.** The app delivers the task
  of a session it starts below a "Background" block, so today a change session holds none of the
  `/devkit change` locks (found in this change's own session: F-4).
- **The stage icon.** A change session's title is `<icon> <id>`, renamed by that session when its
  stage changes: ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery, 📦 archive. The change
  loop reports the icon with every action.
- **A start on a turn nobody typed.** The app starts a session only on a turn the owner typed (seen
  live on 2026-11-21: it refuses on a background task's end and on another session's note). On any
  other turn, or when the app refuses, the ready change waits. A line says it starts at the owner's
  next message, with the reason, and the board says the same. A change session's end-of-turn
  reports return to the coordinating session, and the one of the turn that archives the change says
  so.
- The board says "ready, waits for a place" only when the places are taken.
- A gate or blocked line says "the others go on" only when another change is under way.
- ADR 0013 decision 4 names every field of the run file, and a test fails when the file gains a field
  the decision does not name.
- `next --after`, `reply --param id=` and `wait --change` refuse an id that is not a change id and
  write nothing.
- A failed write of the run file removes its temporary file.
- The run file's lock gives up within 3 seconds, before the agent hook's 10-second timeout. The hook
  then lets the hand-off through and logs that the bookkeeping was busy.
- A killed `hold` no longer keeps the run holding.
- **Start anyway**: the hold line says the owner can start anyway. Only the owner's own message
  starts the changes held at that moment, and nothing later.
- `roadmap-loop.mjs run` accepts the arguments as typed (`roadmap 2`).
- New tests: `run` without `--session`; a lock timing out through `updateRun`, `open` and the agent
  hook; the draft's fallback to English; `mainInRun` reading the transcript once per hook call.
- Evidence of this run, before and after its move to one session per change. Every further defect it
  shows before this change's delivery ends is fixed here, after a revised plan is approved again.
- Docs, the skill, versions: devkit-openspec 0.19.0, marketplace 0.23.0.

Non-goals: the round 16 items the retro carried; lifting the load limit for a whole run; the two
defects of `merge-setup-field-fixes`. A killed `wait` is the same class as the killed hold but is not
requested, so it is flagged for the owner. Restarting a change session the owner closed is the
existing `/devkit change <id>`, nothing new. Change sessions for hosts without a session-start tool
are out of reach. A wake-up or retry on a timer is out: no cron (ADR 0006 decision 3).

## Acceptance criteria

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

Exit criteria: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`,
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and the marketplace validation
pass; `openspec validate roadmap-coordinator-followups --strict` passes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roadmap-coordination`: one session per change and who asks the gates; the stage icon; a start on
  a turn nobody typed; the run takes the typed arguments; the board's ready line; the "others go on"
  sentence; start anyway; a killed hold; ids refused; the bookkeeping written whole and what it
  remembers.
- `coordination-locks`: a session started by another is a change run; the coordinating session hands
  no stage when its changes have sessions of their own, and its stop lock judges only the starts it
  can make on that turn; the hand-off lock ends inside the hook's time when the bookkeeping is busy.

## Impact

- `plugins/openspec/hooks/roadmap-loop.mjs`: the run file, `decideRoadmap` (the session mode),
  `boardOf`, `collectRoadmap`, `run`, `next`, `reply`, `wait`, `hold`, the three roadmap locks.
- `plugins/openspec/hooks/change-loop.mjs`: `stageIcon`, `sessionTitle`, and the `icon` and
  `sessionTitle` of every action; the message table; a lock sleep passed through `openChange`.
- `plugins/openspec/hooks/guard.mjs`: `isChangeId`; the started-session form of a typed command.
- `plugins/openspec/skills/devkit/SKILL.md`: the Roadmap section (the session mode, the `run` input,
  start anyway, the turn), the Loop (the title's icon in a change session), the Never list.
- Tests: `roadmap-loop.test.mjs`, `change-loop.test.mjs`; ten existing tests change, and four more
  read rewritten text and pass unchanged (`design.md` D-14).
- Docs: ADR 0014 (new, proposed), ADR 0013 (decision 4, a Note, "Amended by"), Notes in ADR 0010 and
  ADR 0011, `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/roles.md`, `README.md`,
  `openspec/config.yaml` (the ADRs line).
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, `docs/catalog.md`.
- Dependencies: `roadmap-coordinator` (archived, `aafd1ce`). Runs beside `merge-setup-field-fixes`,
  which may bump devkit-openspec first; the release rebase renumbers whichever merges second.
- Decisions cited: ADR 0006 (decision 2, a refused start waits for the owner; decision 3, no cron),
  ADR 0010 (decision 8; its Notes), ADR 0011 (decision 2, the run detection; a lock that fails
  closed was rejected; the owner's own message), ADR 0013 (decisions 1, 3 and 4, and its rejected
  "App child sessions, one per change"). Open decisions inherited: ADR 0014 (proposed here) needs the
  owner's acceptance with the plan.
