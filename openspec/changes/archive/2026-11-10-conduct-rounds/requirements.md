# Requirements

Classification: domain=process type=feature flags=[architecture, contract] (confirmed)

## Request

Round 4 of `openspec/roadmap.md`, `conduct-rounds`: "the multi-change `conduct` skill"
(non-goal of `ship-modes` and `auto-merge`), conducting the several changes of a roadmap round
instead of one at a time. The owner chose, in the grill (in Portuguese), the full cycle per
change, parallel steps in worktrees, early planning for dependent changes, continuing into the
next round, and a self-scheduled wake-up through a cron the skill creates.

## Assumptions

Owner-confirmed in the grill:

- **Full cycle.** A new skill `conduct` (`plugins/openspec/skills/conduct/SKILL.md`, invoked as
  `/conduct`) takes every unticked change of the current round from `not started` to `archived`:
  `openspec new change <id> --schema <schema>`, the requirements grill (`devkit` only), the
  `devkit-core:change-planner` agent, the `devkit-core:plan-readiness-reviewer` agent until
  `- Status: APPROVED` (`devkit` only), the owner's plan approval (`devkit` only), then the steps
  `ship-change` runs today (implement through archive), in the project's `ship` mode.
- **Parallel steps, not parallel changes.** The main session (the one the owner typed in)
  recomputes, for every change it conducts, the next step from disk and GitHub, then dispatches
  the next steps of changes that do not depend on each other as parallel subagents, each working
  in that change's own git worktree; it waits for them and recomputes (ADR 0001's "recompute,
  run only that step as a subagent"). No subagent runs a whole change.
- **Owner gates stay in the main session.** Grill questions (AskUserQuestion, one at a time),
  plan approval of `devkit` changes and the retro answers are asked by the main session; other
  changes' steps keep running meanwhile.
- **Dependencies.** For `- [ ] B (after: A)`: B's grill, plan, readiness and approval may run
  while A is in progress; B's first `implement` step waits until A is ticked in
  `openspec/roadmap.md` on the default branch and B's branch is rebased on it.
- **Next round.** When every line of the current round is ticked, `conduct` continues with the
  next round, until the roadmap is done or nothing can move.
- **Schema per change.** For a `not started` change, `conduct` proposes `devkit` or `devkit-lite`
  from the criteria in the `openspec/config.yaml` header comment (new capability, crosses areas,
  public contract or data model, auth/money/personal data, hard to roll back) and confirms it
  with the owner, for every new change, as that change's first owner question: for a `devkit`
  change it is the grill's first question; for a `devkit-lite` change (no grill) it is a single
  schema-confirmation question. (Owner's answer at plan approval, 2026-11-09: "Perguntar
  sempre".)
- **Go-ahead for `devkit-lite`.** Invoking `/conduct` is the go-ahead for every `devkit-lite`
  change it conducts; after the schema answer, the owner is asked only at `devkit` gates and
  retro answers.
- **Plan approval on disk.** The owner's approval of a `devkit` plan is written to disk as a
  line in the change folder, and `deliver-check` (`plugins/openspec/hooks/deliver-check.mjs`)
  requires it, in addition to `readiness.md` `- Status: APPROVED`, before the first `implement`
  of a `devkit` change. This applies to `ship-change` too: it records the owner's approval when
  the owner gives it. AMBIGUOUS (file and line form): the planner picks the file
  (proposed: `openspec/changes/<id>/approval.md` with `- Status: APPROVED`, written only after
  the owner's own message approving the plan).
- **Release-file conflicts.** When a conducted change's PR conflicts with its base only in
  release files (`CHANGELOG.md`, `plugins/*/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `docs/catalog.md`), `conduct` rebases it on the base and
  resolves them: each changed pack's version ends above the base's with the change's own bump
  kind applied to the base's version, both CHANGELOG entries are kept, the catalog is
  regenerated; then the gate and the stale reviews re-run. A conflict in any other file stays
  `blocked: item 5` for that change.
- **One stopped change does not stop the rest.** A change that stops (red gate, review
  deadlock, `blocked: item N`, non-release conflict, `Outcome: failure`) is set aside with its
  reason; independent changes continue; changes that depend on it wait. `conduct` ends a run
  when nothing can move, reporting every conducted change with its state.
- **Self-scheduled wake-up (ADR exception, owner-approved).** When every change that can move is
  waiting on GitHub (checks or merge) after the capped watch, `conduct` creates one recurring
  cron job in the session (CronCreate) whose prompt runs `/conduct` again, and deletes it when
  the roadmap is done or every remaining change waits on the owner or is stopped. This
  contradicts ADR 0001 ("no long-running process ... no starting or driving sessions or the app
  from outside"); it is recorded as a new ADR, not as a silent deviation.
- **Proof by a real test round.** After this change's PR merges and before its archive, a new
  round 5 in `openspec/roadmap.md` with three small real changes (the `commit-and-pr` co-author
  trailer fix, one independent docs change, one change with `after:`) is conducted with
  `/conduct` until archived; the result goes in the `## Dogfood` section of this change's
  `retro.md` (precedent: archive-after-merge, AC-9).

Decided by the grill's author as routine (correct if wrong):

- Each conducted change works in `git worktree add .claude/worktrees/<id> -b <id> origin/<default>`,
  so `ship-change`'s branch-name selection keeps working unchanged; `conduct` reuses an existing
  worktree or branch for the change instead of creating a second one.
- At most 3 step subagents run at once.
- One cron job per session: before creating it, `conduct` lists the session's crons and reuses
  one whose prompt is `/conduct`; the interval is 20 minutes.
- Before B's first `implement` after A lands, `conduct` runs `devkit-core:plan-reality-auditor`
  on B; `OUTDATED` stops B for re-planning.

## Acceptance criteria

- AC-1: With a current round of N unticked changes, `/conduct` creates each `not started` change
  with the schema it proposes from the `openspec/config.yaml` criteria and the owner confirmed:
  every proposed schema, `devkit-lite` included, is the change's first owner question (the
  grill's first question for `devkit`; one schema-confirmation question for `devkit-lite`). Each
  change is driven through grill (devkit), plan, readiness (devkit) and the owner's approval
  (devkit) before any product code is written for it. (Owner's answer to design Open question 1,
  2026-11-09: "Perguntar sempre".)
- AC-2: Independent changes progress in parallel: in one run, step subagents of at least two
  changes are dispatched together, each in its own worktree on a branch named after the change.
- AC-3: For `B (after: A)`, B's plan may exist before A is archived, but no `implement` step runs
  for B until A is ticked on the default branch; B's branch is then rebased on it.
- AC-4: A `devkit-lite` change conducted by `/conduct` reaches its first `implement` without the
  owner being asked anything after its schema confirmation (AC-1); a `devkit` change does not
  reach `implement` without the owner's recorded approval.
- AC-5: `deliver-check <id> --json` on a `devkit` change with `readiness.md` APPROVED but no
  recorded owner approval names a stop step (not `implement`); with the approval recorded it
  names `implement`. `ship-change` writes that approval only after the owner's own message.
- AC-6: When a conducted change's PR conflicts with its base only in release files, `conduct`
  resolves the conflict as stated in Assumptions and the change continues; a conflict in any
  other file stops that change as `blocked: item 5` while the others continue.
- AC-7: A change that stops is reported with its reason; independent changes keep moving and
  dependent ones wait. The run's final report lists every conducted change with exactly one
  state (`archived`, `waiting on <ids>`, `waiting for the owner: <gate>`,
  `waiting on GitHub: <what>`, `blocked: <reason>`).
- AC-8: When the current round is fully ticked, the same run continues with the next round; when
  the roadmap is done, `conduct` reports it and no cron job created by `conduct` remains.
- AC-9: When everything that can move waits on GitHub, `conduct` leaves exactly one recurring
  cron job running `/conduct` (none duplicated across runs), and deletes it when nothing is left
  that the cron could advance (roadmap done, or every remaining change waits on the owner or is
  stopped).
- AC-10: A new ADR in `docs/adr/` records the exception to ADR 0001 (self-scheduled wake-up via a
  session cron, parallel step subagents in worktrees) and ADR 0001 points to it.
- AC-11: Killing the session mid-run and running `/conduct` again resumes every change from disk
  and GitHub, without redoing finished steps and without a second worktree or branch per change.
- AC-12: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3
  scripts/check.py`) passes, with tests covering the round/next-step computation (parallel sets,
  dependencies, early planning, release-file conflict classification) and the approval line.
- AC-13: After merge and before archive, the round-5 test round (three real changes, one with
  `after:`) is conducted to `archived`, recorded in this change's `retro.md` `## Dogfood`.

## Out of scope

- A subagent that runs a whole change; starting or driving other app sessions; a daemon or
  background process outside the session (only the session cron of AC-9).
- Resolving conflicts outside the release files; reordering or editing roadmap lines
  automatically (beyond ticking an archived change); planning changes of a later round before
  the current one is done.
- Changing `ship-change`'s single-change behavior beyond the recorded plan approval (AC-5).
- Fixing the `commit-and-pr` trailer in this change (it is one of the round-5 test changes).

## Escalations

- ADR 0001 exception: the session cron (CronCreate) that re-runs `/conduct`. The owner chose it
  in the grill; the plan records it as a new ADR for the owner's approval with the plan.
