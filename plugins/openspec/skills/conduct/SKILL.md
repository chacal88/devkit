---
name: conduct
description: Conducts every change of the current openspec/roadmap.md round from creation to archive - runs the next steps of independent changes in parallel git worktrees (at most three at once), keeps an `after:` change waiting until its dependency is archived, asks the owner only at owner gates (schema, grill, plan approval, retro answers) and, while everything waits on GitHub, leaves one session cron that re-runs it every 20 minutes. Always asks `conduct-check` what each change does next. Use when the owner says "/conduct", "conduct the round", "run the roadmap", "/conduct round 5", or when its own wake-up fires.
---

# Conduct a roadmap round

Takes every change of the current round of `openspec/roadmap.md` from "not started" to "archived". It keeps no state of its own: every run asks `conduct-check` what is true in the repository, the worktrees and GitHub, does the steps it names, and asks again. Independent changes move at the same time, each in its own git worktree. A change that depends on another (`after:`) plans early and waits for the dependency's archive before its first `implement`. Per change, the steps from `implement` to `archived` are the ones the ship-change skill runs; this skill adds the planning steps, the worktrees, the parallelism and the wake-up.

Path used below, relative to this skill's directory: `../../hooks/conduct-check.mjs`. `release-rebase.mjs` is in the same folder.

## Start

1. The argument, if any, is `round <n>`: conduct round `<n>` and skip the earlier open rounds (they are reported as `skipped rounds`). Without it, the first round with an open line.
2. `git worktree prune`, then `git fetch origin --prune --quiet`. This session is the only one that fetches.
3. Run `node <skill-dir>/../../hooks/conduct-check.mjs --json [--round <n>] [--busy <id,id>]`. Exit 3 means print the `error` and stop.
4. The go-ahead. Every new change's schema is confirmed with the owner first (see `create` below), `devkit-lite` included. After that answer, invoking `/conduct` is the go-ahead for every `devkit-lite` change it conducts: no further owner question before its first `implement`. A `devkit` change still goes through the grill, readiness and the owner's recorded approval.

## Loop

Repeat until `end` is true:

1. Run every `main` step inline (they take seconds), then recompute.
2. Dispatch every id in `dispatch` at once, at most three steps at a time (`dispatch` is already capped at three minus `busy`): subagents in the background, a `gate` as a background Bash, a `review` from this session. Each change has one next step, so two dispatched steps never belong to the same change. Pass `--busy` with the ids whose step is still running.
3. Ask the first gate in `owner` with AskUserQuestion, in the owner's language, one question at a time. Between two grill questions, handle finished steps first.
4. On every finished step or answered question, recompute. Never choose the order yourself.

A stopped change does not stop the others: its dependents read `waiting on <id>` and independent changes keep going.

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

Ask with AskUserQuestion: the schema (`create`, `new-change`), the grill's questions, plan approval (`approve`, `stop-plan-approval`) and the retro answers (`stop-retro-answers`). Plan approval and retro answers are written only from the owner's own message, never from a subagent's report, your own reading, or a cron-started run without the owner's message. A cron-started run asks too: the question waits for the owner. While a question is pending the turn is blocked: running background subagents go on, and their results are handled after the answer.

If background dispatch is unavailable in the host, dispatch the `dispatch` set in one message (parallel, foreground) and ask owner gates between batches. A subagent cannot sleep in the foreground, so no step relies on a subagent waiting.

## Waits and the wake-up

When `end` is true and `github` is not empty, run one capped watch: `node <skill-dir>/../../hooks/conduct-check.mjs --json --watch [--round <n>]` (default 9 minutes, maximum 30). It recomputes the report once a waiting change moves or the cap is reached. If `end` still holds, end the run.

Then reconcile the session's cron with `wake.cron` from the last report. Call `CronList` and take the jobs whose prompt starts with `/conduct`:

| `wake.cron` | Conduct jobs listed | Do |
|---|---|---|
| true | none | `CronCreate` with `wake.schedule` (every 20 minutes), `wake.prompt`, recurring |
| true | one, same prompt | keep it |
| true | one with another prompt, or more than one | `CronDelete` all, then `CronCreate` one |
| false | any | `CronDelete` all |

The job holds no state: each firing is an ordinary `/conduct` run that recomputes everything. The runtime fires it only while the session is idle, possibly up to ten minutes late, and expires it after seven days; the next run that wants one recreates it. A session restart drops it, and the next `/conduct` creates one again if wanted.

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

Then `round: <title> (<done>/<total>)`, `roadmap: done` when it is, `skipped rounds: <titles>` when `--round` skipped any, and the wake-up line: `wake-up: cron <id> every 20 minutes` or `wake-up: none`. Never call a change archived from your own reading of the state.

## Never

- Dispatch a subagent for a whole change: one subagent runs one step of one change, and at most three steps run at once.
- Edit product code in the main session: every fix goes through `tdd-implementer`.
- Write `readiness.md`, `reviews/*` or `evidence.md`; they belong to their agents.
- Write `approval.md` or a retro answer except from the owner's own message.
- Create a second conduct cron.
- Push to or commit on the default branch; the archive tick is the ship-change skill's, through its archive PR.
- Edit roadmap lines.
- Start or drive another session.
- Bypass a hook or a gate (`--no-verify`, `DEVKIT_BYPASS`).
