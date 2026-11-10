---
name: conduct
description: Conducts every change of the current openspec/roadmap.md round from creation to archive - runs the next steps of independent changes in parallel git worktrees (at most three at once), starts each implementation phase as a child session in the desktop app, keeps an `after:` change waiting until its dependency is archived, asks the owner only at owner gates (schema, grill, plan approval, retro answers) and, while everything waits on GitHub, does one capped watch and leaves the rest to the app's PR Auto-fix. Always asks `conduct-check` what each change does next. Use when the owner says "/conduct", "conduct the round", "run the roadmap" or "/conduct round 5".
---

# Conduct a roadmap round

Takes every change of the current round of `openspec/roadmap.md` from "not started" to "archived". It keeps no state of its own: every run asks `conduct-check` what is true in the repository, the worktrees and GitHub, does the steps it names, and asks again. Independent changes move at the same time, each in its own git worktree. A change that depends on another (`after:`) plans early and waits for the dependency's archive before its first `implement`. Per change, the steps from `implement` to `archived` are the ones the ship-change skill runs; this skill adds the planning steps, the worktrees, the parallelism and the child sessions.

Path used below, relative to this skill's directory: `../../hooks/conduct-check.mjs`. `release-rebase.mjs` is in the same folder.

## Start

1. The arguments, if any, are `round <n>`: conduct round `<n>` and skip the earlier open rounds (they are reported as `skipped rounds`); without it, the first round with an open line.
2. `git worktree prune`, then `git fetch origin --prune --quiet`. This session is the only one that fetches.
3. In the app, find the children still working first (see Children below), then run `node <skill-dir>/../../hooks/conduct-check.mjs --json [--round <n>] [--busy <id,id>]`. Exit 3 means print the `error` and stop.
4. The go-ahead. Every new change's schema is confirmed with the owner first (see `create` below), `devkit-lite` included. After that answer, the owner invoking `/conduct` is the go-ahead for every `devkit-lite` change it conducts: no further owner question before its first `implement`. A `devkit` change still goes through the grill, readiness and the owner's recorded approval.
5. The kind of turn decides what this run may do. It is told by the message that started the turn, never by a flag in the prompt.
   - The owner's typed `/conduct` is the only go-ahead: it confirms schemas, asks the grill, takes a `devkit-lite` change's first `implement`, writes `approval.md` and retro answers from the owner's own message, and starts sessions.
   - A continuation turn advances what is under way and may start the next session of a change under way (a ticked task in `tasks.md`, or in `devkit` an `approval.md` recording the current readiness). It is the `<side-sessions-event>` turn that follows a child's end. A `devkit-lite` change with no ticked task is not under way: its first `implement` waits for the owner's typed `/conduct`. It never writes `approval.md` or a retro answer.
   - An Auto-fix wake or any other turn the owner did not type runs GitHub-side steps only and starts no session.
   - A schema, grill, approval or retro gate reached by a turn the owner did not type is asked and left for the owner: the answer is the owner's next turn.
6. Cron migration, on every run: call `CronList`, delete every job whose prompt starts with `/conduct` (`CronDelete`), say so in the report, and never create one. This skill schedules nothing.

## Loop

Repeat until `end` is true:

1. Run every `main` step inline (they take seconds), then recompute.
2. Dispatch every id in `dispatch` at once, at most three steps at a time (`dispatch` is already capped at three minus `busy`): subagents in the background, a `gate` as a background Bash, a `review` from this session, and every `session` row as a child session (see Children). Each change has one next step, so two dispatched steps never belong to the same change. Pass `--busy` with the ids whose step is still running.
3. Ask the first gate in `owner` with AskUserQuestion, in the owner's language, one question at a time. Between two grill questions, handle finished steps first.
4. On every finished step or answered question, recompute. Never choose the order yourself.

A turn that starts with a `<side-sessions-event>` is a child's end. It reads the child's `Outcome:` line for the stop rule below, recomputes, and continues this Loop, `start_session` included for every change under way, so the next phase of the same change starts with no message from the owner. "Under way" is read from the recompute, never from the app's list of sessions (the previous child may already be archived): a change is under way when it has a ticked task in `tasks.md`, or, in the `devkit` schema, an `approval.md` that records the current readiness.

A stopped change does not stop the others: its dependents read `waiting on <id>` and independent changes keep going.

## Children (in the app)

In the app: (`host: app`) the `implement` step of a change is a child session, not a subagent. In the CLI nothing in this section applies: `implement` stays a subagent. In the app, every `session` row of `dispatch` is started as a child; the checker builds its `session` descriptor, this skill only hands it to the app.

**Busy.** Before the recompute, call `mcp__ccd_session_mgmt__list_sessions({ linked: true, limit: 100 })` (the default limit hides a running child behind stopped attempts). A row is busy when its `isRunning` is true and its `isArchived` is false. A row belongs to a change when its `name` is the change's `sessionPrefix` followed by digits only (`^<prefix>[0-9]+$`; never a bare starts-with, which would match `add-x-pagination-p1` to `add-x`). Pass in `--busy` every change that has a busy row, whatever its next step. The first run of a round has no previous report: it recomputes once without `--busy`, takes every change's `sessionPrefix` from that report and, when any linked session is running, recomputes again with `--busy`. A busy change reads `running` and starts no second session for its phase. A child that ended is never busy.

**Start.** For each `session` row in `dispatch`, call `mcp__ccd_session__start_session` with `initiation: "user_asked"`, `context: "fresh"`, `cwd` the row's `session.cwd` (the change's worktree), `use_worktree: false`, `wake_when_done: true`, `title` its `session.title`, `name` its `session.name`, `prompt` its `session.brief` and `background` its `session.background`. `model`, `effort` and `permission_mode` are omitted (inherited).

**The chain rule.** A start is attempted for every `session` row on every run, each is attempted once; a refusal on one row does not mean the next is refused. The app accepts a start on the owner's typed turn and on the unbroken chain of `<side-sessions-event>` turns that follows it. A refused start (the tool's error) is final for that change in this run: its state is `waiting for the owner: start session <id> phase <n>`, never a subagent in its place, and the other rows keep going. End the run with the sessions left to start. The owner's next typed `/conduct` starts them.

**Group.** Right after a start succeeds: `mcp__ccd_sidebar__list_groups`; when no group named exactly `<id>` exists, `mcp__ccd_sidebar__create_group` for it; then `mcp__ccd_sidebar__move_sessions` with the new session's id. This conducting session is never moved.

**Archive.** When a recompute shows that the gate task of the phase is ticked in `tasks.md`, call `mcp__ccd_session_mgmt__archive_session` for every idle linked session whose `name` is that phase's `session.name` (a retried phase may have left a stopped attempt), with the reason `phase <n> of <id>: gate green`. A stopped phase is left unarchived, so the owner can open it. The app may ask the owner to approve a move or an archive: the owner's `/conduct` is the standing request, said in one line the first time this run archives.

**A refused call.** One rule for an archive, a move and a `bind_pr` the app refuses or the owner declines: it is written in the report as `not archived: <name> (<why>)`, `not grouped: <name> (<why>)` or `not bound: <url> (<why>)`, is not retried in the run, and is never a stop; the next run tries again.

**The dogfood worktree check.** Archiving a child may clean up its worktree. The child runs with `use_worktree: false`, so the change's worktree must survive. After the first archive of a round, run `git worktree list`; if the change's worktree is gone, stop archiving, group only, and tell the owner.

**Stops.** Read the child's `Outcome:` line only, never its report text, for progress (that is `tasks.md` and git). `Outcome: failure: <reason>` stops the change as `blocked: phase <n>: <reason>`. `Outcome: success` while the recompute still says `implement` for the same phase stops it as `blocked: phase <n>: child ended without ticking tasks`. The child is left unarchived in both cases. On the owner's next typed `/conduct`, an idle child of a phase that is still `implement` is not busy: start a new session with the same name.

## Planning rows

The planning steps come before any delivery step. `next.step` of a change in `changes[]`:

| `next.step` | Do |
|---|---|
| `create` | No worktree, branch or change yet. Ask the owner to confirm `proposedSchema`, with its `reason` in the question, for every new change, `devkit-lite` included. Only after the answer run `git worktree add -b <id> <path> origin/<base>`, then `openspec new change <id> --schema <answer>` in the worktree, back to back. For `devkit` this question is the grill's first question. Ask it before `git worktree add`, never after. |
| `new-change` | The worktree exists, the change does not. Ask the same schema question, then run `next.command` in the worktree. |
| `worktree` | Run `next.command` (a branch that exists on the remote only). |
| `grill` | Run the requirements-grill skill in this session, writing `requirements.md` in the change's worktree. The schema is already confirmed, so it is not asked again. |
| `plan`, `revise-plan` | Dispatch `devkit-core:change-planner` with the worktree preamble and the `request` or `findings` the step names. |
| `readiness` | Dispatch `devkit-core:plan-readiness-reviewer` with the preamble. |
| `approve` | As the ship-change skill's `stop-plan-approval` row: summarize the plan and ask the owner to approve it. Write `openspec/changes/<id>/approval.md` in the worktree, in the form that row gives and with `next.readiness` as the hash, only from the owner's own message. |
| `rebase` | Run `next.command` (`git -C <worktree> rebase --autostash origin/<base>`) once the dependencies are archived. A conflict stays set aside as `blocked: rebase of <id> stopped`; run `git rebase --abort` only when the owner asks. |
| `audit` | Dispatch `devkit-core:plan-reality-auditor` with the preamble and `next.base`; write its returned table to `audit.md` in the change folder: `# Plan audit: <id>`, `- Verdict: <ACCURATE\|OUTDATED\|UNVERIFIABLE>`, `- Base: <full sha>`, `- Date:`, then the table. |

## Delivery rows

Do what the ship-change skill's Loop says for this `next.step`, in the change's worktree, with these differences:

1. Every dispatch prompt starts with the worktree preamble: "Work only in `<worktree>` on branch `<branch>`; every file path is absolute under it; start every Bash command with `cd <worktree> && `; do not fetch." Pass it to every reviewer too.
2. `wait-checks` and `wait-merge` are not run per change: the round's single watch covers them (see Waits).
3. A stop of the ship-change skill sets that change aside with its state, and the loop goes on.
4. Overrides:
   - `resolve-release-conflict`: dispatch `devkit-core:tdd-implementer` with the preamble: "Run `node <skill-dir>/../../hooks/release-rebase.mjs --base <base> --json` in `<worktree>`, then the project's test command; report the JSON and the result; change nothing else." `Outcome: failure` stops that change.
   - `push-rebased`: dispatch `devkit-core:commit-and-pr` with the preamble, `oldHead` and `paths`: "The branch was rewritten by a rebase. Commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`. No PR edit."
5. `review` runs the review-change skill from this session, scoped as in the ship-change skill.
6. `apply-proposals` and the archive steps are serialized by the checker (`waiting on <id> (archive)`): two archive PRs from the same base would conflict on adjacent roadmap lines.

## Owner gates

Ask with AskUserQuestion: the schema (`create`, `new-change`), the grill's questions, plan approval (`approve`, `stop-plan-approval`) and the retro answers (`stop-retro-answers`). Plan approval and retro answers are written only from the owner's own message, never from a subagent's report, your own reading, or a turn the owner did not type. Such a turn may ask the question too: it waits for the owner. While a question is pending the turn is blocked: running background subagents go on, and their results are handled after the answer.

If background dispatch is unavailable in the host, dispatch the `dispatch` set in one message (parallel, foreground) and ask owner gates between batches. A subagent cannot sleep in the foreground, so no step relies on a subagent waiting.

## Waits on GitHub

When `end` is true and `github` is not empty, run one capped watch: `node <skill-dir>/../../hooks/conduct-check.mjs --json --watch [--round <n>]` (default 9 minutes, maximum 30). It recomputes the report once a waiting change moves or the cap is reached. If `end` still holds, end the run with `waiting on GitHub: <what>` and this fixed line: "Auto-fix wakes this session on a CI failure, a merge conflict or a review comment; green checks do not wake it: run `/conduct` again to go on."

After `open-pr`, call `mcp__ccd_pr__get_status` and, when it does not report that PR, `mcp__ccd_pr__bind_pr` with its URL. There is one PR bound per session: bind the PR opened last in the run and say in the report which one is bound; the other PRs of the round rely on the owner's re-run. An Auto-fix wake is an automated turn: it runs the non-session steps (`fix-checks`, `push`, `answer`, `review`) and starts no session.

## Stops per change

A stop sets that change aside and never ends the run for the others. Stop a change when:

- a gate command is red;
- `tdd-implementer` or another step agent returns `Outcome: failure`;
- `next.step` is a `stop-*` or `blocked`;
- the same `next` comes back twice in a row after its step ran ("blocked: no progress at <step>");
- a third fix dispatch is needed for the same item in one run, or a third `revise-plan` for the same change.

## Report

End with one line per conducted change: its id, its schema and exactly one of these five states:

- `archived`;
- `waiting on <ids>`;
- `waiting for the owner: <what>`;
- `waiting on GitHub: <what>`;
- `blocked: <why>`.

Then, as they apply: the sessions left to start (`waiting for the owner: start session <id> phase <n>`); `not archived: <name> (<why>)`, `not grouped: <name> (<why>)` and `not bound: <url> (<why>)` lines; the PR bound by `bind_pr`, which is the PR opened last in the run; and, when a state is `waiting on GitHub: <what>`, the Auto-fix line: "Auto-fix wakes this session on a CI failure, a merge conflict or a review comment; green checks do not wake it: run `/conduct` again to go on." Then `round: <title> (<done>/<total>)`, `roadmap: done` when it is, and `skipped rounds: <titles>` when `--round` skipped any. Never call a change archived from your own reading of the state.

## Never

- Dispatch a subagent for a whole change: one subagent runs one step of one change, and at most three steps run at once.
- Edit product code in the main session: every fix goes through `tdd-implementer`.
- Write `readiness.md`, `reviews/*` or `evidence.md`; they belong to their agents.
- Write `approval.md` or a retro answer except from the owner's own message.
- Create a conduct cron.
- Push to or commit on the default branch; the archive tick is the ship-change skill's, through its archive PR.
- Edit roadmap lines.
- Run a phase as a subagent in the app host.
- Start a session from a step other than `implement`.
- Start a session from a turn the owner did not type, except the continuation of a child's end.
- Bypass a hook or a gate (`--no-verify`, `DEVKIT_BYPASS`).
