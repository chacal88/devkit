# The OpenSpec flow

devkit-openspec turns the devkit workflow into something OpenSpec and a few hooks enforce, with no orchestrator session in the middle. This page explains the moving parts, how to adopt them in a project, and what to do when something blocks you.

## The three layers

| Layer | Lives in | Decides |
|---|---|---|
| **Schema** | `openspec/schemas/devkit/` (or `~/.local/share/openspec/schemas/`) | Which artifacts a change needs, in which order, and what `apply` requires |
| **Project config** | `openspec/config.yaml` | Project context, per-artifact rules, guidance for apply and archive |
| **Gates** | Claude Code hooks (from the plugin) and your CI | What must never happen, checked from file contents |

The OpenSpec CLI reads the first two and hands the result to the agent: `openspec instructions <artifact> --change <id> --json` returns the schema's instruction for that artifact, the template, the project `context` and the `rules` for that artifact. `openspec instructions apply` returns `state: blocked` and the missing artifacts until the plan is complete. The `openspec-*` skills that `openspec init` installs already read that output, so no skill needs editing for the flow to reach the agent.

## Choosing a schema

Every gate costs agent runs, so the flow scales with the change. `devkit-lite` is the default in the project template; choose `devkit` when the change needs the owner grilled, an independent plan approval and implementation by a dedicated agent.

| Use `devkit` (full) when ANY holds | Otherwise `devkit-lite` (default) |
|---|---|
| A new capability, or behavior changes in more than one area | One area, a few files |
| A public contract changes: API, event, shared schema, data model, migration | Internal change |
| Auth, permissions, money, personal data or secrets | None of those |
| Hard to roll back | Easy to revert |
| The request is ambiguous | The request is clear |

```bash
openspec new change add-csv-export --schema devkit
```

```bash
openspec new change greet-language
```

## The `devkit` schema

```text
requirements ─▶ proposal ─▶ specs ─┐
                     └──▶ design ──┴─▶ tasks ─▶ readiness ─▶ apply
```

| Artifact | Produced with | Contents |
|---|---|---|
| `requirements.md` | `requirements-grill` skill | The request in the owner's words, confirmed assumptions, acceptance criteria with ids (`AC-1`...), out of scope. If the owner skips the grill: the derived criteria and `Grill: skipped by owner` |
| `proposal.md` | OpenSpec's instruction | Why, what changes, acceptance criteria (copied with their ids), capabilities, impact |
| `specs/**/spec.md` | OpenSpec's instruction | Requirement deltas with WHEN/THEN scenarios |
| `design.md` | OpenSpec's instruction | Context, decisions with alternatives, risks, migration |
| `tasks.md` | OpenSpec's instruction | One `## N.` group per phase, each ending with a gate task naming the test command; every AC id covered |
| `readiness.md` | `plan-readiness-reviewer` agent (dispatched, never written by the author) | The readiness report; its Decision section has exactly one `- Status: APPROVED`, `NEEDS-REVISION` or `BLOCKED` |

`apply` requires `readiness`. Its instruction tells the main session to dispatch the `tdd-implementer` agent once per phase, then run `review-change` (each reviewer agent writes `reviews/<reviewer>.md`), then dispatch `pr-verifier` (writes `evidence.md`) and finally `commit-and-pr`. The main session coordinates; the subagents do the work, and the hooks make sure of it.

## The `devkit-lite` schema

For small, contained changes, with or without a spec-level behavior change.

```text
proposal ─▶ specs (optional) ─▶ tasks ─▶ apply
```

No grill and no readiness gate, and the main session may write the code itself. Write a spec delta when the proposal lists a capability; otherwise set `skip_specs: true` in the change's `.openspec.yaml`. The PR still needs the reviews (`code-quality-reviewer` and `test-coverage-reviewer` at least) and `evidence.md`. If the change turns out to meet a full-flow criterion, recreate it with `--schema devkit`.

## Adopting it in a project

The `openspec-setup` skill does all of this; here is what it does, if you prefer by hand.

1. Install the OpenSpec CLI and initialize the project:

   ```bash
   npm i -g @fission-ai/openspec@latest
   ```

   ```bash
   openspec init --tools claude
   ```

2. Install the schemas into the project, so the team and CI share them (run it inside the project, no argument needed):

   ```bash
   bash <devkit>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh
   ```

   Or, for every project on this machine, add `--user`: the same command with `--user` installs under `$XDG_DATA_HOME/openspec/schemas/` and leaves the project untouched.

3. Copy [`templates/config.yaml`](../plugins/openspec/skills/openspec-setup/templates/config.yaml) to `openspec/config.yaml` and fill in `context` with the real stack, test command and conventions.

4. Opt the project in: enable the packs `devkit-core` and `devkit-openspec` per project, in its `.claude/settings.json` (see [getting-started.md](getting-started.md)).

## Running a change

```bash
openspec new change add-csv-export
```

```bash
git switch -c feat/add-csv-export
```

Then tell Claude what you want ("continue the change add-csv-export"). At any point:

```bash
openspec status --change add-csv-export
```

shows what's done and what's next. A new session starts by printing the same, from the session hook, plus the current round of `openspec/roadmap.md` if the project has one (see [Grouping changes](#grouping-changes-the-roadmap)).

Name the branch after the change: the hooks use it to know which change you're working on.

## Grouping changes: the roadmap

OpenSpec lists changes flat. To keep rounds, the order between them and "where are we in the plan", write `openspec/roadmap.md`:

```markdown
# Roadmap

## Round 1: auth
- [x] auth-scopes

## Round 2: exports
- [ ] add-csv-export (after: auth-scopes)
- [ ] export-audit-log
```

- Each `## ` heading is a round; each `- [ ] <change-id>` line is a change, optionally with `(after: a, b)` and a description after it (`- [ ] add-csv-export (after: auth-scopes) - export the table as CSV`). Indented lines under a change are its notes. The description and the notes are what `/conduct` reads to propose a schema for a new change; the session report ignores them. Anything else in the file is ignored.
- The current round is the first one with an unticked line.
- At session start, after the active change, the hook prints the current round, `done/total`, and the state of each unticked change, read from disk:

  | State | Means |
  |---|---|
  | `archived, tick it` | The change is only in `openspec/changes/archive/`; tick its line |
  | `waiting on <ids>` | A change in its `after:` list is not ticked yet |
  | `open` | The change folder exists |
  | `not started` | No folder under `openspec/changes/` yet |

  When more than one applies, the first row wins: an open change whose dependency isn't ticked shows as `waiting on`.

- It is printed with one active change, several, or none, so a fresh session on `main` sees the plan too.
- The session report only reports. The hook never writes the roadmap: tick a line by hand (or let the agent do it) when the change is archived. `/conduct` (next section) enforces `after:` before a change's first `implement`; `/ship-change` on its own does not. Run each change of a round in its own session and branch, or let `/conduct` run them in worktrees; the roadmap is the shared checklist between them.

## Conducting a change: `/conduct <id>`

**Single-change mode (the default).** `/conduct <id>` conducts exactly the change you name, from creation to archive, in its own git worktree, with one row. There are three argument forms: `<id>` (this mode), `round <n>` (the round mode below, the only way into it) and no argument, which lists the open change ids and asks which one; a bare `/conduct` never sweeps. The change must exist: `conduct-check --change <id>` exits 3 with `no change <id>:` when nothing of it exists anywhere, and the skill then asks whether to create it and with which schema, creating nothing until you answer naming the id and the schema (a typo'd id creates nothing). The run never reads `openspec/roadmap.md`, touches no other change and enforces no `after:` (you order your changes, as with `/ship-change <id>`). Before anything of the change runs on a turn you typed, a worktree with `unfinished` work (uncommitted paths outside `openspec/`, or a half-done phase) is reported and the change goes on only when your own message in that session says so. The session rules of ADR 0006 hold per change; the decision is [ADR 0007](adr/0007-one-change-on-request.md).

**Round mode (the explicit option).** `/conduct round <n>` conducts every change of round `n` of the roadmap at once, with the rules below.

`conduct-check` (`plugins/openspec/hooks/conduct-check.mjs`) answers, for every change of the current round, what happens next, who does it and, in the desktop app, whether it runs as a child session. It is read-only like `deliver-check`: it never writes files, refs or GitHub objects, and never fetches (the skill runs `git fetch origin --prune --quiet` first). It reuses `deliver-check` in-process, in each change's worktree, for everything from `implement` to `archived`.

```
node conduct-check.mjs [--json] [--round <n>] [--change <id>] [--busy <id,id>] [--watch[=<minutes>]]
```

Run it from any checkout of the repository. Exit 0 is a report (a blocked change is a state, not an exit code); exit 3 is a setup or usage error: no `openspec/`, no git, an unreadable default branch, a missing `origin/<base>` (the message says `git fetch origin <base>`), an unknown option or a `--round` out of range.

**One change.** `--change <id>` conducts that one change with the same engine and the same row: it never reads the roadmap, so a repository without one works, and `--round` does not combine with it (exit 3). The change must exist, else exit 3 with a prefix that says what is missing: `no change <id>:` (no worktree, branch or folder anywhere), `change <id> has a worktree without a folder:` or `change <id> is on another branch:` (the active folder is in a checkout on another branch). A change archived on `origin/<base>` with no worktree reads `archived`.

**The round (round mode).** The default branch is `default_branch` from GitHub. The roadmap is read from `origin/<base>`, never from the working tree, so a tick counts only once its archive PR landed. The current round is the first with an unticked line; with it fully ticked the next unticked round is current in the same call, and with none left `roadmapDone` is true. `--round <n>` starts at round `n`; earlier rounds with unticked lines are listed in `skipped` and never conducted. An `after:` id that is not ticked on `origin/<base>` (missing from the roadmap, or in a skipped round, included) keeps its dependent waiting.

**Worktrees.** Every change runs in its own git worktree on the branch named after it. A worktree is found by branch (`<id>` or `chore/archive-<id>`) at whatever path, so one created earlier, by hand or by the session, is reused and a second one is never made; prunable entries are ignored, and a worktree stopped in the middle of a rebase is still found. Without one:

| Facts | `next.step` | What the main session runs |
|---|---|---|
| local branch `<id>` | `worktree` | `git worktree add <path> <id>` |
| only `origin/<id>` | `worktree` | `git worktree add --track -b <id> <path> origin/<id>` |
| `openspec/changes/<id>/` on `origin/<base>` | `worktree` | `git worktree add -b <id> <path> origin/<base>` |
| nothing | `create` | ask the schema, then the same `-b` command |

The path is `<main checkout>/.claude/worktrees/<id>`, whichever worktree `/conduct` was typed in.

**Planning rows**, first match wins, before any delivery row and only while no task is ticked (once work has started the planning gates were passed):

| Row | Condition | `next.step` | Who |
|---|---|---|---|
| C1 | no worktree, no branch, no folder on `origin/<base>` | `create` | owner, askable |
| C2 | worktree without a change folder | `new-change` | owner, askable |
| P-1 | schema has `requirements`, `requirements.md` missing | `grill` | owner, askable |
| P-2 | a plan file (`proposal.md`, `design.md`, `tasks.md`) missing | `plan` | `change-planner` |
| P-3 | `readiness.md` missing or older than the newest plan file by more than 2 s | `readiness` | `plan-readiness-reviewer` |
| P-4 | readiness `NEEDS-REVISION` | `revise-plan` | `change-planner` |
| P-4b | readiness `BLOCKED` | `stop-readiness-blocked` | owner, not askable |
| P-5 | `devkit`, no current `approval.md` | `approve` | owner, askable |

Every new change, `devkit-lite` included, first asks the owner to confirm its schema: `create` and `new-change` carry `proposedSchema` and a one-line `reason`, computed from the roadmap line's description against the criteria in the `openspec/config.yaml` header (a line with no description is proposed `devkit`, the strictest track). The answer is recorded by the change folder itself (its `.openspec.yaml`), so a resumed run never asks twice. After that a `devkit-lite` change has no owner row before its first `implement`.

**Dependency rows**, after the planning rows and before delivery, while no task is ticked, for a change with `after:` ids:

| Row | Condition | `next.step` | Who |
|---|---|---|---|
| D-1 | an `after:` id not ticked on `origin/<base>` | `wait-dependencies` (state `waiting on <ids>`) | none |
| D-2 | every dependency ticked on `origin/<base>`, but the roadmap at the worktree's `HEAD` lacks a tick | `rebase` (`git -C <worktree> rebase --autostash origin/<base>`) | main session |
| D-3 | no `audit.md`, or its `Base:` commit lacks a tick, or a plan file is newer than it by more than 2 s | `audit` | `plan-reality-auditor` |
| D-4 | `audit.md` `OUTDATED` | `revise-plan` | `change-planner` |
| D-5 | `audit.md` `UNVERIFIABLE` | `stop-audit-unverifiable` | owner, not askable |

Planning of a dependent change (grill, plan, readiness, approval) runs while its dependency is still in progress; only the delivery rows wait. A rebase left in progress is `blocked: rebase of <id> stopped`.

**Delivery rows.** Once planning and dependencies pass, `deliver-check`'s `next` is mapped to an actor and passes through unchanged: `implement`, `fix-*`, `apply-proposals` go to `tdd-implementer`; `commit`, `open-pr`, `push`, `open-archive-pr` to `commit-and-pr`; `verify` to `pr-verifier`; `retro` to a `general-purpose` subagent running the retro skill; `review` and `gate` to the main session; the small PR steps (`edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `archive`, `tick-roadmap`) to the main session; `wait-checks` and `wait-merge` to GitHub; `ready`, `archive-pr-ready`, `stop-review-deadlock` and `answer` to the owner (not askable); the `stop-*` rows and `blocked` stop the change. Three overrides sit in front of that mapping:

- **Release-file conflict.** A change PR (item 5) or an archive PR that conflicts with its base is classified with `git merge-tree --write-tree --name-only --no-messages origin/<base> HEAD`. Only release files (`plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`) gives `resolve-release-conflict` (with `paths`); any other path is `blocked: item 5 (conflict in <paths>)` or `blocked: archive (archive-pr): conflict in <paths>`; a clean merge (GitHub's view is stale) is `update-branch` in `merge` mode.
- **A branch we rewrote.** An open PR whose head is not an ancestor of `HEAD` but is in the branch's reflog was rewritten by our own rebase. `push-rebased` (to `commit-and-pr`, with `oldHead`, the dirty `paths` and the command `git push --force-with-lease=<branch>:<oldHead> origin <branch>`) comes before `deliver-check`'s own rows, which would commit and push plainly and be rejected; only `disable-auto-merge` still comes first. After the push every review is stale, so `review` and `verify` follow. A PR head that is not in the reflog is somebody else's push and stays `blocked: ... not in local history`.
- **Archives are serialized.** A change at `archive` waits (`waiting on <id> (archive)`) while another conducted change has an archive branch, and the later of two changes that both want to archive waits for the earlier one, so two archive PRs never tick adjacent roadmap lines. Retro and answers still run in parallel.

**Release-file conflicts: `release-rebase.mjs`.** When a change PR (or an archive PR) conflicts only in release files, the `resolve-release-conflict` step runs, in the change's worktree, `node <plugin>/hooks/release-rebase.mjs --base <base> [--json]`. Several changes bump the same version lines, so the resolution is a rule, not a merge:

- **Classification.** The conflicted paths must all be in the release list (`plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`, the same list ADR 0003 exempts). Any other path, a manifest edited beyond its version fields (a `description`, a new pack), a catalog conflict without `scripts/gen-catalog.py`, or a CHANGELOG that does not hold exactly one new entry, aborts: the branch is back at its old head, the worktree is clean, the exit code is 2 and `conflicts` (or `error`) says why. The change then stays `blocked: item 5`.
- **The replay keeps the base.** The script runs `git rebase origin/<base>` and, at every stop, keeps the base's side of each conflicted release file. During a rebase that is `git checkout --ours`: `--ours` is the upstream being rebased onto, `--theirs` is the change's own commit. The change's side is not lost: it is read from the old head.
- **The version rule.** For each pack whose `plugin.json` version differs between the merge base and the old head, and for `metadata.version`, the final version is the base's version with the change's own bump applied: base 0.7.0 over a change that went 0.6.0 to 0.6.1 gives 0.7.1; a change 0.6.0 to 0.7.0 gives 0.8.0; a change that did not touch a version keeps the base's. The manifests are rewritten from the base's text (key order and 2-space JSON kept), whichever file happened to conflict.
- **CHANGELOG.** The change's own entry (the one not in the merge base) is renumbered to the new `metadata.version` and placed above the base's newest entry; every base entry is kept.
- **Catalog.** With a catalog conflict, or any manifest rewritten, `scripts/gen-catalog.py` runs.
- **The edits stay uncommitted.** The script never pushes and never commits after the rebase. The subagent runs the project's test command and stops on red. The next recompute gives `push-rebased`: commit the edits, then `git push --force-with-lease=<branch>:<oldHead>`. Every review is stale after the rebase, so `review` and `verify` run again on the pushed head; ADR 0002 accepts that cost ("Strict up-to-date re-runs stale reviews").

**What the skill runs.** `/conduct [round <n>]` prunes stale worktrees, runs `git fetch origin --prune --quiet`, then `conduct-check --json` and loops: it runs the main session's steps inline, dispatches every id in `dispatch` at once (at most three steps, never two steps of one change), asks the first owner gate, and recomputes after every finished step or answered question. Each subagent dispatch starts with a preamble that pins it to the change's worktree: "Work only in `<worktree>` on branch `<branch>`; every file path is absolute under it; start every Bash command with `cd <worktree> && `; do not fetch." Only the owner's session fetches. The delivery rows follow the ship-change skill's Loop for the same `next.step`; a stop sets that one change aside.

**Session rows.** In the desktop app a change at `implement` is a `session` row: the skill passes `--busy` from the app's list of sessions (a child whose `name` is the change's `sessionPrefix` followed by digits only and that is running), then starts one linked child session per `session` row in the change's worktree, with `wake_when_done`, groups it in the sidebar under the change's id and archives it once the phase's gate task is ticked. The child runs that one phase through `tdd-implementer` and ends with `Outcome:` and `Head:` lines; the gate, the commit, the reviews and the PR stay with the conducting session. A child that ends without ticking tasks, or with a failure, stops that change as `blocked: phase <n>: <reason>`. In the CLI nothing of this applies: `implement` is a subagent. The decision: [ADR 0006](adr/0006-phases-as-child-sessions.md).

**The chain and the kinds of turn.** The app accepts a start on the owner's typed turn and on the unbroken chain of continuation turns (`<side-sessions-event>`) that follows it, so the next phase of a change under way starts with no message from you. A change is under way when `tasks.md` has a ticked task or, in the `devkit` schema, `approval.md` records the current readiness. Your typed `/conduct` is the only go-ahead: it answers the schema, grill, approval and retro gates and takes a `devkit-lite` change's first `implement`. A continuation turn advances what is under way and asks, but never writes `approval.md` or a retro answer. An Auto-fix wake or any other turn you did not type runs GitHub-side steps only and starts no session. A refused start is never run as a subagent in its place: the change reads `waiting for the owner: start session <id> phase <n>` and your next message starts it. Every run also deletes any `/conduct` cron left by 0.8.0 (`CronList`, `CronDelete`) and never creates one.

**Owner gates.** The skill asks, one question at a time: the schema of every new change (before `git worktree add`, `devkit-lite` included), the grill's questions, plan approval (`approval.md`, written only from your own message), and the answer to each retro proposal. After the schema answer, `/conduct` is the go-ahead for a `devkit-lite` change. Nothing else asks you: a change moves from `not started` to `archived` on its own, except for a PR merge in `pr` mode and the decisions the checker lists as not askable.

**Background subagents.** Steps are dispatched as background subagents so an owner question can be asked while they run. While a question is pending the turn is blocked: running subagents go on, and their results are handled after the answer. Where the host has no background dispatch, the skill dispatches the `dispatch` set in one message (parallel, foreground) and asks owner gates between batches. A subagent cannot sleep in the foreground, so no step waits by sleeping.

**Waiting on GitHub.** When nothing can move without GitHub, the skill runs one capped watch (`conduct-check --watch`, 9 minutes by default). If something still waits it ends the run with `waiting on GitHub: <what>` and a fixed line: Auto-fix wakes the session on a CI failure, a merge conflict or a review comment, but not on green checks, so those need your re-run. After `open-pr` it calls `get_status` and, if the PR is not reported, `bind_pr`; one PR is bound per session (the one opened last, named in the report), so the other PRs of the round rely on your re-run. The skill schedules nothing: no cron, no wake-up. The decision and its review trigger: [ADR 0006](adr/0006-phases-as-child-sessions.md) (it supersedes [ADR 0005](adr/0005-parallel-steps-and-a-session-wake-up.md)).

**The result.** `--json` (`version: 2`; version 1 had `wake`, now removed) carries `base`, `mode` (`round`, or `change` with `--change <id>`), `change` (the id, or null in the round mode), `round` (`n`, `title`, `done`, `total`; null in single-change mode, where no roadmap is read and `startedAt` is null too), `startedAt`, `skipped`, `roadmapDone`, and one entry per conducted change: `id`, `round`, `after`, `text`, `notes`, `schema`, `worktree`, `branch`, `base`, `sessionPrefix`, `unfinished` (null, or `dirty` (uncommitted paths outside `openspec/`), `phases` (half-done phase numbers) and a `summary`, on a row with a worktree), `next` (always `step`, `actor` and `reason`, plus the step's own fields; `agent` for a subagent or a session, `askable` for an owner row), `state` and `deliver` (`deliver-check`'s `summary`, `met` and `next`, or null before delivery); a row whose `next.actor` is `session` also carries `session`. Then `dispatch`, `owner`, `github`, `stopped` and `busy` (ids) and `end`. Every change has exactly one `state`: `ready to run: <step>`, `running` (it is in `--busy`), or, when nothing can move, one of `archived`, `waiting on <ids>`, `waiting for the owner: <gate>`, `waiting on GitHub: <what>`, `blocked: <reason>`. The human output is one `<id>: <state>` line per change, then `dispatch:`, `owner:` and `github:`.

- **`dispatch`** lists the changes whose actor is a subagent, the review, a gate or the main session, in roadmap order, without the `--busy` ids, at most 3 minus the busy ones (the main session's steps take seconds and are not capped). A change has one next step, so two dispatched steps never belong to the same change. A blocked change does not stop the others: its dependents read `waiting on <id>` and independent changes keep their rows.
- **`end`** is true when `dispatch`, `owner` (the askable gates) and `busy` are empty: nothing can move without GitHub or the owner.
- **The watch.** `--watch[=<minutes>]` (default 9, at most 30) applies only at `end` with a change waiting on GitHub. It polls the waiting changes every `DEVKIT_POLL_SECONDS` (default 60) until one of them moves or the cap is reached, then returns the recomputed round with `watch: { minutes, timedOut }`.
- **`session` and `sessionPrefix`.** In the Claude desktop app (`DEVKIT_HOST=app`, or `CLAUDE_CODE_ENTRYPOINT=claude-desktop`) a change at `implement` has `next.actor: "session"` (the `tdd-implementer` runs in a child session); in the CLI it stays a `subagent`. A `session` row carries `session: { title, name, cwd, branch, phase, brief, background }`: `title` is `<id>: phase <n>`, `name` is `<prefix><n>` (at most 24 characters of `[a-z0-9-]`), `cwd` the change's worktree, `brief` the prompt the child receives and `background` the round and roadmap context. `sessionPrefix` is on every change row, whatever its step: the `name` without its phase number (`<id cut to 20>-p`, or the id cut to 18 plus two hex characters of its SHA-1 when two conducted ids collide), the same for every phase, so a caller finds a change's children with `^<prefix>[0-9]+$`. A session counts against the cap of three like a subagent.

## The panel: devkit-panel

`devkit-panel` (`plugins/panel/`) is a Claude Code mod for the desktop app: a side pane that draws what `conduct-check` and `deliver-check` answer, so you see where every change of the round stands without typing `/conduct`. It is read-only by construction: it starts no session, writes no file, submits no prompt and schedules nothing beyond its own 60 s refresh while the pane is open; `claude plugin validate plugins/panel` (on the app's bundled Claude Code, which runs mods) lists what the module calls, and no `prompt.submit`, `fs.write`, `store`, `clock.after` or session tool is among them. Install it beside `devkit-openspec`:

```bash
claude plugin install devkit-panel@devkit --scope project
```

**What it shows.** In an OpenSpec devkit project (a root whose `openspec/config.yaml` has a top-level `schema: devkit` or `schema: devkit-lite`, the hooks' own opt-in) the pane has a header naming the checker and the report's age with a `Refresh` button, the round line (`Round <n>: <title> · <done>/<total>` and the counts of `dispatch`, `owner`, `github` and `stopped`), one row per change of the round with its `state`, `next.step` and `next.actor`, and two collapsed groups, the open changes outside the round and the archived ones, by name only. Unfolding a change row runs `deliver-check <id> --json` once per refresh in the change's worktree and lists the eight items of the delivery contract with their reasons, the summary and the next step, plus the change's linked child sessions (`^<sessionPrefix>[0-9]+$`, from the app's `mcp__ccd_session_mgmt__list_sessions` tool, read only when its permission is `allow`; otherwise one line names the tool and no dialog ever opens from the timer). Outside a devkit project the pane is one line and nothing runs. The report refreshes at session start, when the pane opens, at the end of each of your turns, every 60 s while the pane is open and on `Refresh`; one run at a time, and a checker error is one line under the header while the last good report stays with its age. A one-line band above the prompt carries the round summary and an `Open` / `Close` button; `/devkit-panel` toggles the pane, `/devkit-panel status` prints it as text, and the `mcp__devkit-panel__status` tool gives the model (or a headless session) the same text.

**Which checker runs.** In the devkit repository and its worktrees (a root whose `.claude-plugin/marketplace.json` lists `devkit-openspec`) the pane runs the repository's own `plugins/openspec/hooks/` and the header says `repo`. Anywhere else it runs the `devkit-openspec` installed for the project (the project-scope entry of `~/.claude/plugins/installed_plugins.json` whose `projectPath` is the root or the project above a `.claude/worktrees/<name>` checkout; a user-scope install as the fallback) and the header says `devkit-openspec <version>`. Without either, the one line says to install `devkit-openspec@devkit --scope project`. `conduct-check --json` runs in the project root with `DEVKIT_HOST=app`, so a change at `implement` reads as a session row like in `/conduct`.

**The buttons fill the prompt box; you press Enter.** The app accepts a session start only on a turn you typed, and a prompt a mod submits counts as automated, so every owner button only puts its text in the prompt box (`prompt.fill`), and toasts the same text where no box can take it. `Conduct` fills `/conduct <id>` (or `/conduct` when the installed `conduct-check` predates `--change <id>`, probed once per session); `Ship` (on a delivery step, `implement` onward) fills `/ship-change <id>`; `Approve` (on `stop-plan-approval` or `approve`) fills `I approve the plan of <id>` (its pt-BR form in the default language); `Answer` (on `stop-retro-answers`) fills `Approve proposal 1 of <id>` for you to edit. A `create` or `new-change` row has only `Conduct`, and on a change not yet created `/conduct <id>` is its create path (the skill asks the schema, then creates it). The pack's `language` option (`pt-BR` by default, `en`) selects the pane, band and toast texts. Details: [the pack's README](../plugins/panel/README.md).

## The gates

| Gate | Checked by | Passes when |
|---|---|---|
| Plan complete before apply | OpenSpec CLI | All artifacts that `apply` requires exist |
| Plan approved before product code | Hook on Edit/Write and shell writes | `readiness.md` contains `- Status: APPROVED` (schemas with a `readiness` artifact only) |
| Code written by the implementer | Same hook | In the `devkit` schema, the writer is the `tdd-implementer` agent |
| One writer per gate file | Same hook | `readiness.md` ← `plan-readiness-reviewer`; `reviews/<reviewer>.md` ← that reviewer; `evidence.md` ← `pr-verifier`; `approval.md` ← the main session only, from your own message (no subagent writes it) |
| Review and evidence before the PR | Hook on `gh pr create` | `reviews/` has `code-quality-reviewer.md` and `test-coverage-reviewer.md`, every review there says `Verdict: approved` (or `declined`), and `evidence.md` has content |
| No destructive git | Hook on Bash | The command isn't a force push, `--no-verify`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .`, `add -A` / `add .`, or `gh pr merge --admin` |

Planning files under `openspec/`, anything under `.claude/`, and anything outside the repository stay open: you can always fix the plan.

**How roles work.** When a subagent calls a tool, Claude Code passes its type (for example `devkit-core:tdd-implementer`) to the hook; the main session has none. The guard compares that with the file's owner. A subagent can still be given a misleading prompt, so each reviewer is told to ignore verdicts suggested by its caller; the separation makes self-approval impossible by accident and visible on purpose, not impossible.

**Worktrees.** The hooks resolve the root and the change from the path being written, not from the session's directory: a file in a linked worktree (`git worktree add`) is gated by that worktree's change, `cd <worktree> && echo x > f` is judged against the worktree, and `gh pr create` after `cd <worktree>` is checked against the worktree's reviews. A session started in the main checkout therefore cannot write a worktree's product code before its readiness is approved.

**Which change is active.** `DEVKIT_CHANGE` if set; else, on a branch `chore/archive-<id>` for a known change `<id>`, that change while it is open (and none once it moved to `openspec/changes/archive/`); else the open change whose name the branch ends with, or contains; else the only open change. With several open changes and no branch match, code edits are blocked until you name the branch. With no open change, nothing is gated. On an archive branch whose change has moved, the hooks gate nothing, even while other changes are open: the archive PR is never held to another change's readiness or reviews.

**Bypass.** Start Claude Code with `DEVKIT_BYPASS=1` in its environment. A prefix inside a command (`DEVKIT_BYPASS=1 git push --force`) does not work, so the agent can't bypass on its own.

### Where the hooks act

The hooks (`session`, `edit`, `bash`) act only in a project that opted in: its `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema (`schema:` at the top level). The guard looks for that file from the session's folder upward, next to the `openspec/changes/` it finds, so a subfolder and a `.claude/worktrees/<name>` checkout use their own project's config. Elsewhere the three hooks print nothing and block nothing, destructive git included, even when the pack is loaded at user scope. `guard.mjs ci` and `deliver-check --ci` do not depend on it. A change's own `.openspec.yaml` does not opt a project in or out. The decision and its limits: [ADR 0004](adr/0004-devkit-per-project.md).

## The delivery contract

`deliver-check` answers one question about a change: is it a ready PR? It reads files, git and GitHub (through `gh`); it never writes, pushes or posts, and `DEVKIT_BYPASS` changes nothing.

```text
node plugins/openspec/hooks/deliver-check.mjs <change-id> [--json] [--watch[=<minutes>]]
```

Run it from anywhere inside the repository. It prints one line per item (`met`, `open` or `blocked`, with the reason), then `N/8 met: <summary>` and `next: <step>`. The summary is `ready` only at 8/8, else `blocked: item N` (lowest blocked item) or `in progress: item N` (lowest open item).

| # | Item | Read from | `open` means the flow can fix it | `blocked` means it needs someone outside the flow |
|---|---|---|---|---|
| 1 | Tasks and gates | `tasks.md`, `evidence.md` | unticked tasks; a gate command without a `pass` row in `evidence.md`; evidence missing or stale | no `tasks.md`; a gate task with no backticked command |
| 2 | Reviews approved at head | `reviews/*.md` | a required reviewer missing, `rejected`, or its `Commit:` stale | none |
| 3 | Findings disposed | `reviews/*.md` | a `[blocking]` or `[important]` line without `· fixed in <sha>` or `· refuted: <evidence>` | none |
| 4 | Acceptance criteria proven | `proposal.md` (else `requirements.md`), `evidence.md` | evidence missing or stale; a criterion without a `pass`/`verified` row; a `fail`/`defect` row | a criterion with only `no proof` rows; no criteria ids at all |
| 5 | PR open at local head | `gh pr view`, git | no PR yet; local commits not pushed; uncommitted files in the change folder | PR closed; its head not in local history; a merge conflict; `gh` missing or failing (a PR merged at your local head is not blocked: it leads to the archive steps, below) |
| 6 | Required checks green | `gh pr checks` (`--required`, else all checks) | a check pending, failing or cancelled | `gh` error; an unknown check state |
| 7 | Conversation answered | `gh api graphql` | an unresolved review thread, a person's newer comment, or a `CHANGES_REQUESTED` not yet replied to | a `CHANGES_REQUESTED` already replied to; more than 100 threads |
| 8 | PR body complete | the PR body | the change id, an acceptance criterion id or the `evidence.md` link is missing | none |

For item 7, a bot's top-level comments and review bodies (deploy previews, coverage and CI summaries) ask nothing and are ignored. A bot's unresolved review thread and its `CHANGES_REQUESTED` count like a person's.

For item 7, a person counts only when GitHub reports their `authorAssociation` as `OWNER`, `MEMBER` or `COLLABORATOR`. Comments, review bodies, review threads and "changes requested" from anyone else (`CONTRIBUTOR`, `NONE`, first-timers) are ignored, so an outside commenter cannot hand the agent work. "Answered" for a top-level comment or review body means newer than the viewer's latest top-level comment or review; a reply inside a review thread answers only that thread.

The rule goes by author type, not by intent: the checker cannot tell whether a bot's top-level comment asks for something, so it ignores every bot top-level comment and review body. A bot that wants a change must say it in an inline review thread or a "changes requested" review.

**Exit codes.** `0` only when all eight are met (after the merge the eight items are met by definition, see below); `1` when something is open and nothing is blocked; `2` when something is blocked (also `blocked: merge setup` in `merge` mode, and any `blocked: archive (<step>)` after the merge); `3` for a usage or preflight error (an id found neither in `openspec/changes/` nor in `openspec/changes/archive/`, no `openspec/`, or an invalid `ship` or `merge_method` setting).

**JSON.** `--json` prints `{ "version": 1, "change", "schema", "ship", "host", "head", "pr", "phases", "items", "met", "summary", "next" }`. `version` changes only when a field is removed or changes meaning. On exit 3 it prints `{ "version": 1, "error": "<message>" }`. `host` is `app` in the Claude desktop app and `cli` otherwise (`DEVKIT_HOST=app|cli` overrides it). In `merge` mode only, the report also has a `merge` object (below), and after the merge an `archive` object (below); `version` stays `1` because both fields are additive.

**The `Commit:` staleness rule.** A reviewer's verdict file and `evidence.md` start with a `Commit: <sha>` line, placed before the first markdown heading (a line under a heading is not read). It is current when the sha resolves, is an ancestor of `HEAD`, every later commit touches only `openspec/`, the line has no `(uncommitted changes)` marker, and the working tree has no change outside `openspec/` and `.claude/`. A later commit to product code (or to a path such as `openspecx/`) makes it stale, and only the reviews or evidence that carry that sha are redone.

**Waiting.** `--watch[=<minutes>]` runs one `gh pr checks <n> --watch --interval 30` (default 9 minutes, at most 30) when the next step is waiting for checks, then computes the contract again. A watch that outlives the cap is stopped and the result is `in progress: item 6`.

**Merge mode.** With `ship: merge` the contract ends differently: GitHub merges the PR, and the repository must be prepared first. A merged PR is not the end in `pr` or `merge` mode: it leads to the archive steps ("After the merge", below). `plan` mode is unchanged: it asks `gh pr view` for the same fields as before and stops at `stop-plan-mode` whatever the PR says.

- **Items.** `merge` mode also reads `autoMergeRequest` and `mergeStateStatus`. Item 5 is `met` for a PR merged at the local head (`PR #n merged`) and `blocked` for one merged at another head. An open PR whose `mergeStateStatus` is `BEHIND` is `open` (`branch is behind <base>; update it`). Once the PR is merged, the archive steps take over and items 6 and 7 are `met` without calling `gh`. The PR is found by its number once known, else by the branch; when the branch no longer finds it (merged, branch deleted) `gh pr list --head <branch> --state all` finds it among open, merged and closed PRs, preferring an open one. That lookup now runs in `pr` mode too.
- **Preflight (read-only).** Before any work, merge mode checks that the repository can merge on its own. A missing piece is `blocked: merge setup (...)`, never a silent downgrade to `pr`, and the reason names the `openspec-setup` skill (GitHub step).

  | Fact | Read with | Missing when |
  |---|---|---|
  | Auto-merge allowed | `gh api repos/{owner}/{repo}` (`allow_auto_merge`) | not `true` |
  | The merge method allowed | same call (`allow_squash_merge`, `allow_merge_commit` or `allow_rebase_merge`, by `merge_method`) | not `true` |
  | `devkit-reviews` required | `gh api repos/{owner}/{repo}/rules/branches/<default branch>`, then `.../branches/<default branch>/protection/required_status_checks` | no `required_status_checks` rule of an active ruleset, and no classic protection context, names `devkit-reviews` |
  | The workflow is committed | `git cat-file -e HEAD:.github/workflows/devkit-reviews.yml` | absent at `HEAD` (a file only in the working tree does not count) |

  "Required" means a rule that is active on the default branch (the rules endpoint lists only active rules, repository and organization rulesets alike) or classic branch protection; an `evaluate`-mode or disabled ruleset does not count. A 404 or 403 from classic protection means none. Any other `gh` error is `cannot read the repository settings: ...` and also blocks: the preflight fails closed.
- **Steps** (`next.step`, merge mode only): `disable-auto-merge` (auto-merge is on and an item is no longer met; ahead of every stop and of `push`); `stop-merge-setup` (`missing` lists what the preflight found); `update-branch` (item 5 is open only because the PR is behind its base); `enable-auto-merge` (all eight met and auto-merge off; carries `number`, `method` from `merge_method`, default `squash`, and `head`, the commit that was checked); `wait-merge` (all eight met and auto-merge on; carries `waitingFor`). In every mode, `devkit-reviews` failing in CI while items 1-4 are met locally is `blocked: item 6`, because no code fix applies.
- **Summaries.** `auto-merge on: waiting for <what>` (`GitHub to merge`, `branch rules outside the delivery contract (for example a required approval)`, `GitHub to compute mergeability`, or `GitHub (mergeStateStatus <value>)`); `blocked: merge setup`. Otherwise the summary is the usual one, including `ready` at 8/8 with auto-merge off.
- **`merge` object.** `{ "method", "setup": { "ok", "missing" }, "autoMerge", "state", "mergeStateStatus", "waitingFor" }`, present only when `ship` is `merge`.
- **The wait.** With `--watch[=<minutes>]` at `wait-merge`, the checker polls `gh pr view <n>` every `DEVKIT_POLL_SECONDS` (default 30) until the PR is not open, auto-merge goes off, the head changes, `gh` fails or the cap (default 9 minutes, at most 30) is reached, then computes the contract again: the result is the first archive step (the retro) once GitHub merged, or `auto-merge on: waiting for <what>`.

- **Plan approval on disk.** For schemas with a `readiness` artifact, a new step `stop-plan-approval` sits right after `stop-not-approved`: readiness is `APPROVED`, no task is ticked yet, and `approval.md` is missing or records an earlier `readiness.md`. The summary is `waiting for the owner's plan approval`, the exit code 1, and `next` carries `readiness` (`sha256:` and the first 12 hex of the hash of `readiness.md`), `file` and `reason`. `approval.md` is written by the main session only, from your own message, in the form `- Status: APPROVED`, `- Readiness: sha256:<12 hex>`, `- Date`, `- Owner's words`. A new readiness round changes the hash, so you are asked again; a change that already has a ticked task keeps running. The JSON gains an additive `approval` object (`status`, `recorded`, `readiness`, `ok`) for these schemas; `version` stays 1, and `--ci` is unchanged. `devkit-lite` never gets this step.

### After the merge: the archive steps

A change whose PR merged is not done: its retro, the owner's answers, `openspec archive` and the roadmap tick still have to land, and they land through a pull request, because the ruleset refuses pushes to the default branch. `deliver-check` leads that work in `pr` and `merge` mode (never in `plan` mode, which stops at `stop-plan-mode`). It adds no state: it recomputes the step from the working tree, the default branch as GitHub serves it, and the archive PR.

**The post-merge phase** starts when the change PR is `MERGED` or the change folder is already archived in the working tree. All eight items are then `met` (item 5 reads `PR #n merged`, the others `checked before PR #n merged`), and none of them reads files or `gh`: the staleness rule cannot hold after a squash merge and `tasks.md` may have moved. The one exception: on the change's own branch, a PR merged at a head other than the local head is `blocked: item 5`, because local commits would be lost.

**Finding the change PR.** On the change branch, as before (`gh pr view`, then `gh pr list --head <branch> --state all` once the branch was deleted). From the default branch or an archive branch: `gh pr list --state merged --limit 100`, dropping the archive heads (`chore/archive-<id>` and `archive-<id>`), then the newest PR whose body contains `openspec/changes/<id>/evidence.md`, and only if none has it the newest whose head's last segment equals `<id>`. A head that merely contains the id never matches (id `auto-merge` is contained in `archive-auto-merge`). The list asks for light fields, and a body is read with `gh pr view <n> --json body` one PR at a time (newest first) until one matches. The 100 is the cap: a change merged more than 100 merged PRs ago is not found.

**The default branch is read from GitHub**, never from the local checkout or `origin/<base>`: the local one is behind whenever GitHub merged on its own, and `deliver-check` does not fetch. The branch name is `default_branch` from `gh api repos/{owner}/{repo}` (the same call `merge` mode already makes for its preflight). Then `gh api repos/{owner}/{repo}/contents/openspec/changes/archive?ref=<base>`: an entry named `<YYYY-MM-DD>-<id>` means the change is `archived`. Otherwise `.../contents/openspec/changes/<id>?ref=<base>` is `active` (200) or `absent` (`HTTP 404`). Any other error, or a `gh` that stalls past 60 seconds, is `stop-archive` (`read-default-branch`): the check fails closed. The contents API lists at most 1,000 entries per directory.

**Rows**, in order, first match wins (the steps `ship-change` runs are in "Shipping a change"):

| # | Condition | `next.step` | Fields |
|---|---|---|---|
| P0 | the default branch has the archived folder | `archived` | `folder` |
| P1 | the default branch is unreadable | `stop-archive` | `archiveStep: read-default-branch`, `reason` |
| P1b | item 5 blocked (merged at another head, on the change branch) | `blocked` | `item: 5` |
| P2 | `merge` mode and the repository setup is missing | `stop-merge-setup` | `missing` |
| P3a | archive PR open, auto-merge on, and a conflict, a failing check, a PR head that is not the local head, uncommitted files, an unanswered proposal or an unnamed file | `disable-auto-merge` | `number` |
| P3b | archive PR open, merge conflict | `stop-archive` | `archive-pr` |
| P3c | archive PR open, head not in local history | `stop-archive` | `archive-pr` |
| P3d | archive PR open, local ahead of it or uncommitted files | `open-archive-pr` | `branch`, `number` |
| P3e | archive PR open, a check failing or cancelled (or unreadable) | `stop-archive` | `archive-pr` |
| P3f | `merge`, archive PR behind its base | `update-branch` | `number` |
| P3g | `merge`, auto-merge off | `enable-auto-merge` | `number`, `method`, `head` |
| P3h | `merge`, auto-merge on | `wait-merge` | `number`, `head`, `waitingFor` |
| P3i | `pr` | `archive-pr-ready` | `number`, `url` |
| P4 | archive PR merged, the default branch still has the active folder | `stop-archive` | `archive-pr` |
| P5 | archive PR closed, none open | `stop-archive` | `archive-pr` |
| P6 | no `retro.md` in the change folder | `retro` | `number` (the change PR), `base` |
| P7 | `retro.md` without `## Proposed updates` | `stop-archive` | `retro` |
| P8 | a proposal without an `Answer:` line | `stop-retro-answers` | `proposals` |
| P9 | the folder is still active locally | `archive` | `branch: chore/archive-<id>`, `base`, `create` |
| P10 | the folder is archived, but this is not `chore/archive-<id>` | `stop-archive` | `archive` |
| P11 | `openspec/roadmap.md` lists the change unticked | `tick-roadmap` | `line` |
| P12 | an approved proposal without `Applied: yes` | `apply-proposals` | `proposals` (approved and unapplied only) |
| P13 | a changed file that no approved proposal names (`openspec/changes/**`, `openspec/roadmap.md` and the release files are exempt; `openspec/config.yaml` and `openspec/schemas/**` are not). Also checked, with the answers, while the archive PR is open | `stop-archive` | `apply-proposals` |
| P14 | otherwise | `open-archive-pr` | `branch`, `base`, `title` |

No archive PR can exist before every proposal is answered: the only rows that open one sit after P8. `merged` is no longer a `next.step`: it is a state now, and the first archive step takes its place.

**The owner's answers** live in the change's `retro.md`, one `- Answer: approved` or `- Answer: rejected[: why]` line under each proposal (`### ` heading under `## Proposed updates`, targets as backticked repository paths or `user memory`, and `None.` when there are no proposals). They stay uncommitted until the archive PR, so a session killed and resumed in the same checkout does not ask again; if the checkout itself is lost, the retro runs again and the owner is asked again. `deliver-check` reads the last `- Answer:` and the last `- Applied:` line of each block, and never a `- before:` or `+ after:` diff line.

**The file check (P13, AC-3).** Changed paths are `git diff --name-only <merge-base of origin/<base> and HEAD>` plus `git status --porcelain -uall`, except `openspec/changes/**` and `openspec/roadmap.md` (the archive's own record; `openspec/config.yaml` and `openspec/schemas/` are checked). Each must equal, as a repository-relative path with a leading `./` removed, a target of an approved proposal, or be a release file: `plugins/<pack>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`. There is no directory, prefix or glob matching, so `docs/` does not cover `docs/x.md` and `docs/*.md` matches nothing. A regression gate's test file that its proposal did not name stops the run too. The fix is to amend the proposal's targets in `retro.md` and answer again; the checker never guesses. If `origin/<base>` does not resolve, the run stops with `git fetch origin <base>`. While the archive PR is open the check also runs, and an open archive PR whose folder is not archived in the working tree, or whose archived `retro.md` is unreadable, is a `stop-archive` (and `disable-auto-merge` first if auto-merge is on), never `enable-auto-merge`.

**Summaries and exit codes.** `archived` (0); `archive PR open: waiting for <what>` (0); `archive PR ready` (0); `archive: waiting for the owner's answers` (0); `blocked: archive (<archiveStep>)` for every `stop-archive` (2); `blocked: merge setup` (2); `blocked: item 5` (2); otherwise `merged: archive step <step>` (0).

**`archive` object** (JSON, present only after the merge): `{ "base", "branch", "changePr": { "number", "url" }, "onDefault": "active" | "archived" | "absent", "folder", "local": "active" | "archived", "retro": { "exists", "readable", "proposals": [{ "n", "targets", "kind", "answer", "applied" }] }, "roadmap": { "listed", "ticked" }, "pr": { "number", "url", "state", "autoMerge", "mergeStateStatus", "headRefOid" } | null, "waitingFor" }`. In the post-merge phase `next.number` of `disable-auto-merge`, `update-branch`, `enable-auto-merge` and `wait-merge` is the archive PR.

**The wait on the archive PR.** `--watch[=<minutes>]` at `wait-merge` polls `gh pr view <archive PR>` as it does for the change PR (same defaults and cap), then reads the state again: `archived` once the default branch lists the folder, else `archive PR open: waiting for <what>`. A `merge`-mode run may therefore wait twice, once for each PR, each capped.

**Why the archive PR can auto-merge without 8/8:** the owner answered each proposal by name, the file check refuses any file they did not approve (locally, also while the archive PR is open, and again in the required `devkit-reviews` check), and the ruleset's required checks still run. The decision and its review trigger are recorded in [ADR 0003](adr/0003-auto-merge-the-archive-pr.md).

## Shipping a change: ship modes

By default (`plan`) the flow is the one above: you give the go-ahead at each step and the agents stop at each gate. A project can opt in, per schema, to letting one skill drive an approved change to a ready PR, or on to a merge by GitHub. The setting lives in `openspec/config.yaml`, in either YAML form:

```yaml
ship:
  devkit-lite: pr
  devkit: plan
```

```yaml
ship: { devkit-lite: pr }
```

| Mode | Meaning |
|---|---|
| `plan` | Today's flow. The default: no `ship` key, an empty one, or a schema missing from the map |
| `pr` | The `ship-change` skill takes the change to a PR that `deliver-check` reports as `ready`, and stops there; in `pr` mode the merge is yours |
| `merge` | The skill takes the change to 8/8, then enables GitHub auto-merge (`gh pr merge <n> --auto --<merge_method> --match-head-commit <head>`) and GitHub merges once its rules pass. `merge_method` is `squash` (default), `merge` or `rebase`, written next to `ship`. The repository has to be prepared first (below), or the run stops with `blocked: merge setup` |

Why `merge` exists, what it costs and when to revisit it: [ADR 0002](adr/0002-merge-without-the-owner-opt-in.md). Why the archive PR that follows a merge is auto-merged without 8/8: [ADR 0003](adr/0003-auto-merge-the-archive-pr.md).

Any other value, a scalar (`ship: pr`), a nested map or a duplicate schema key is also an error that names the key. The hooks do not read `ship`: with or without it, every gate behaves the same.

**What `ship-change` runs.** `/ship-change <id>` (or "ship this change") loops on `deliver-check --json` and does the step it names: `tdd-implementer` per phase, the phase gate command itself, `commit-and-pr` for a commit, `review-change` for only the reviewers that went stale, `pr-verifier`, the PR, then answering the PR's review threads and waiting for checks. It holds no state: a killed session starts again from the files and GitHub, so resuming is just running it again. It reports `ready` (`pr` mode) only when `deliver-check` exits 0, else `in progress: item N` or `blocked: item N`; in `merge` mode it reports `auto-merge on: waiting for <what>`, `blocked: merge setup` or, after the archive, `archived`. After the change PR merges it goes on to the archive steps (below): `pr` mode ends at `archive PR ready` (you merge the archive PR; run it again to see `archived`), `merge` mode at `archived`. `merged` is no longer a final report. Fixes always go through `tdd-implementer`. It never merges directly and never uses `--admin`: it runs `gh pr merge` at exactly two steps, `enable-auto-merge` (`--auto`, only at 8/8) and `disable-auto-merge` (`--disable-auto`, as soon as the contract drops below 8/8: a push, a stale review, a new comment, a pending re-run).

**What the skill runs in `merge` mode.** The same loop, with these steps added (`next.step` of `deliver-check --json`):

| `next.step` | What the skill does |
|---|---|
| `stop-merge-setup` | Stops: `blocked: merge setup (<missing>)`. Run the GitHub step of `openspec-setup` |
| `disable-auto-merge` | `gh pr merge <n> --disable-auto`, then continues |
| `update-branch` | `gh pr update-branch <n>`, then `git pull --ff-only`. The ruleset requires the branch to be up to date, so a PR behind its base waits; the update brings base commits, which makes older reviews stale and re-runs them |
| `enable-auto-merge` | `gh pr merge <n> --auto --<method> --match-head-commit <head>`: GitHub refuses it if the head moved since the check |
| `wait-merge` | One capped `deliver-check <id> --json --watch`, then reports `archived` or `auto-merge on: waiting for <what>` (`archive PR open: waiting for <what>` for the archive PR) |
| `retro` | Runs the `retro` skill on the merged PR and writes `retro.md` in the change folder |
| `stop-retro-answers` | Stops and asks the owner to approve or reject each proposal; writes each `Answer:` from the owner's own message, never its own |
| `archive` | `git switch -c chore/archive-<id> origin/<base>`, then `openspec archive <id> --yes` |
| `tick-roadmap` | Ticks the change's line in `openspec/roadmap.md` |
| `apply-proposals` | `tdd-implementer` applies exactly the approved proposals (test-first for a regression gate, version bump, CHANGELOG), writes `Applied: yes` |
| `open-archive-pr` | `commit-and-pr` (archive call) commits the moved folder, the roadmap and the applied files, and opens the archive PR |
| `archive-pr-ready` | Reports `archive PR ready` (`pr` mode): you merge it |
| `stop-archive` | Stops: `blocked: archive (<step>): <reason>` |
| `archived` | Reports `archived` |

**Preparing the repository (setup order).** In the project, run the GitHub step of `/openspec-setup` (`scripts/github-setup.mjs`). It prints a plan of four items (`workflow`, `auto-merge`, `delete-branch`, `ruleset`), applies nothing until you confirm each one, and is safe to run again.

1. Write the workflow (`.github/workflows/devkit-reviews.yml`); commit it and merge it through a normal PR, so `devkit-reviews` reports at least once. The `ruleset` item stays `deferred` until then, because a required check that never reports blocks every PR.
2. Apply `auto-merge` (allow auto-merge and the merge method) and `delete-branch`.
3. Apply the `ruleset` `devkit`: a pull request with zero approvals, the existing checks plus `devkit-reviews`, branch up to date, no force pushes, no bypass actors. **From then on, `main` refuses direct pushes from everyone, you included**; every change, archive commits too, goes through a PR. Other open PRs wait for `devkit-reviews` until updated with the default branch.
4. Add `ship: { <schema>: merge }` (and `merge_method`) to `openspec/config.yaml`.

**Limits of `merge` mode.** Zero approvals are required, so a `CHANGES_REQUESTED` review does not stop GitHub's merge on its own; item 7 covers it while the skill runs, and `disable-auto-merge` fires when a review lands before the merge. Between skill runs GitHub merges on its required checks alone: a comment posted after auto-merge was enabled does not stop the merge unless someone disables it. A PR can edit `devkit-reviews.yml` (or, in this repository, `deliver-check.mjs`), and the edited version runs on that PR; reviewers see those diffs. Organization-level required workflows are out of scope.

**Go-ahead.** In `devkit`, `readiness.md` must say `- Status: APPROVED`, and then your approval of that plan must be recorded in `approval.md` (the skill writes it from your own message at `stop-plan-approval`). In `devkit-lite`, the go-ahead is your message asking to ship or apply the change.

**App and CLI.** At the "wait for checks" step it runs one capped watch (9 minutes by default). In the CLI it then reports the state and stops; a red check is fixed the next time you run it. In the Claude desktop app a red check after the watch is fixed in the same run, and when it stops `in progress` the app's Auto-fix wakes the session on a CI failure, a merge conflict or a review comment; that session runs `ship-change` again. Auto-fix does not wake on green checks, which is why the watch exists.

**The `tdd-implementer` gate report applies in every mode.** The agent now reports the phase gate's command and output in its Validation section instead of writing `evidence.md` (the hook already blocked that write; `pr-verifier` is the only writer, and its `### Gates` table is the durable record). That is a bug fix, not `ship` behavior, and the go-ahead may come from you or from a skill that re-ran the gate green.

## CI

Hooks run only inside Claude Code. To make the gates independent of the agent, run them in CI as well. The `devkit-reviews` workflow runs `deliver-check --ci`: it checks readiness (in `devkit`) and the first four items of the delivery contract (tasks and gates, reviews current at head, findings disposed, acceptance criteria proven) for the change the PR is about. Unlike the review consensus `guard.mjs ci` checked before 0.5.0, it applies the same staleness rule as `deliver-check` and the agent: a review or `evidence.md` recorded before a later product commit fails the job. It ignores `DEVKIT_BYPASS` and does not read `ship` or `merge_method`. A change is never selected through an archive branch (`chore/archive-<id>`) once its folder has moved, so an archive PR is never held to another change's reviews even while other changes are open. It is checked as an archive PR instead: when the PR (against `GITHUB_BASE_REF`) brings an `openspec/changes/archive/<date>-<id>/` folder, `devkit-reviews` runs the same exact-path file check as P13 on the PR's changed files, and requires its `retro.md` to be readable with every proposal answered. A file no approved proposal names, an unanswered proposal or a missing retro fails the job. A PR that archives nothing passes with the "nothing to check" note.

```yaml
# .github/workflows/devkit-reviews.yml (templates/devkit-reviews.yml in the openspec-setup skill)
name: devkit-reviews
on:
  pull_request:
permissions:
  contents: read
jobs:
  devkit-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: Download the checker (outside the workspace, so no review goes stale)
        run: |
          # pinned to the commit of v0.10.3 (a tag can move; a commit cannot)
          base=https://raw.githubusercontent.com/chacal88/devkit/<commit sha of v0.10.3>/plugins/openspec/hooks
          curl -fsSL "$base/guard.mjs" -o "$RUNNER_TEMP/guard.mjs"
          curl -fsSL "$base/deliver-check.mjs" -o "$RUNNER_TEMP/deliver-check.mjs"
          curl -fsSL "$base/merge-setup.mjs" -o "$RUNNER_TEMP/merge-setup.mjs"
      - run: node "$RUNNER_TEMP/deliver-check.mjs" --ci
```

Pin the commit sha of the release tag (`v0.10.3` above), not the tag: a tag can be moved, and this job's output gates the merge. The openspec-setup script resolves the tag to its sha for you (and defers the workflow if the tag does not exist yet); by hand, run `gh api repos/chacal88/devkit/git/ref/tags/v0.10.3` (for an annotated tag, follow `object.sha` through `git/tags/<sha>`). Bump it on purpose. The job id is the check's name (`devkit-reviews`), so give the job no `name:`; and keep the trigger `pull_request` with no `paths:` filter, because a required check that is filtered out never reports. The files are downloaded into `$RUNNER_TEMP`, never into the workspace: a file added to the repository would make every review stale.

If your CI also validates the OpenSpec files, keep that step in a job of its own (for example `npm i -g @fission-ai/openspec@latest` then `openspec validate --all --strict`); `deliver-check --ci` does not call the OpenSpec CLI, so the snippet this section used to show for it is unchanged and still valid:

```yaml
# .github/workflows/devkit.yml (optional, unchanged from 0.4.0 apart from the missing guard step)
name: devkit
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm i -g @fission-ai/openspec@latest
      - run: openspec validate --all --strict
```

**Which change is checked.** The first rule that matches wins:

1. The id on the command line (`deliver-check --ci <id>`), or `DEVKIT_CHANGE`. Not an active change: exit 3.
2. The branch (`GITHUB_HEAD_REF`, else the git branch): the active change the branch name ends with, else the only one it contains. Several contained: the job fails (`several changes match branch ...`).
3. With `GITHUB_BASE_REF` (always set on a `pull_request` run): the one active change whose folder the PR changes (`openspec/changes/<id>/`, the archive excluded). Two or more: the job fails (`several changes are touched by this PR ...`).
4. Without `GITHUB_BASE_REF` (a local run): the only open change. Several: the job fails.
5. Otherwise (a PR that brings an archived folder was checked as an archive PR before this, see above) there is nothing to check and the job passes with a note (`no change selected by branch ... or touched by this PR; nothing to check`).

A change that was squash-merged but not archived yet is therefore not checked by an unrelated PR: its reviews point at commits that are not in the base's history. A repository without an `openspec/` folder passes too (`no openspec/ folder; nothing to check`), so adding the workflow never breaks a project that has not adopted OpenSpec. Locally, `deliver-check <id>` (without `--ci`) still exits 3 there.

**What the checkout must be.** The check reads every commit since a review was recorded, and compares the recorded sha with the PR head. `deliver-check --ci` refuses to guess and exits 3 when:

| Message | Fix |
|---|---|
| `fetch the full history (actions/checkout with fetch-depth: 0)` | The clone is shallow (the default `actions/checkout` depth is 1). Set `fetch-depth: 0` |
| `check out the PR head (actions/checkout with ref: ${{ github.event.pull_request.head.sha }}), not the merge commit` | `actions/checkout` defaulted to the synthetic merge commit of the PR. Set `ref:` to the PR head sha |

Exit codes: `0` pass, `1` something failed, `3` setup or usage error. `--json` prints `{ version: 1, mode: "ci", change, schema, head, readiness, items, pass }`; `--ci --watch` is a usage error.

**`guard.mjs ci`.** Projects that already run `node guard.mjs ci` keep working: it now runs the same `deliver-check --ci` and prints its output and exit code. It needs `deliver-check.mjs` and `merge-setup.mjs` in the same folder as `guard.mjs` (download all three, as the template does) and the same full-history, PR-head checkout; without them it prints `devkit ci: guard.mjs ci needs deliver-check.mjs and merge-setup.mjs in the same folder` and exits 1. The local `gh pr create` hook is unchanged: it still checks verdict values only.

## Customizing

- **Rules for one project**: add them under `rules.<artifact>` in `openspec/config.yaml`. They reach the agent with that artifact's instructions.
- **Change the flow itself**: copy the schema into the project (`openspec/schemas/devkit/`) and edit it; project schemas take precedence over the machine-wide ones. Validate with `openspec schema validate devkit`. Keep the artifact id `readiness` if you want the code gate. Keep the name too: the hooks act only where `openspec/config.yaml` selects `devkit` or `devkit-lite`, so a renamed schema turns them off.
- **A different gate**: the hooks only look for the `readiness` artifact id and the `Status:` / `Verdict:` lines, so a renamed or reworded artifact must keep those.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `devkit guard: change "x" has no approved readiness` | The plan isn't approved yet | Finish the plan and dispatch `plan-readiness-reviewer` until `- Status: APPROVED`. Planning files stay editable |
| `... is written only by the <agent> agent, not by the main session` | A gate file was written by the wrong role | Dispatch that agent with the Agent tool (`subagent_type: devkit-core:<agent>`) |
| `product code is written by the tdd-implementer agent` | The main session tried to edit code in a `devkit` change | Dispatch `devkit-core:tdd-implementer` for the phase, or use `devkit-lite` for small changes |
| `devkit guard: several active OpenSpec changes` | More than one open change and the branch doesn't name one | `git switch -c feat/<change>`, or start Claude Code with `DEVKIT_CHANGE=<change>` |
| `gh pr create` refused | A required review is missing or not approved, or `evidence.md` is missing | Run `review-change` for the change, then dispatch `pr-verifier` |
| `openspec instructions apply` says `blocked` | An artifact `apply` requires is missing | `openspec status --change <id>` lists it |
| `schema 'devkit' not found` | Schemas not installed where OpenSpec looks | Run `/openspec-setup`, or check `openspec schema which devkit` |
| `deliver-check` exits 3 | Unknown change, no `openspec/`, or an invalid `ship` or `merge_method` in `openspec/config.yaml` | Read the message on stderr; fix the id or the config |
| `deliver-check --ci` exits 3: `fetch the full history (actions/checkout with fetch-depth: 0)` | The `devkit-reviews` job cloned with depth 1, so no recorded review sha resolves | Set `fetch-depth: 0` on `actions/checkout` |
| `deliver-check --ci` exits 3: `check out the PR head (actions/checkout with ref: ...)` | The job checked out the PR's merge commit, which makes every review look stale | Set `ref: ${{ github.event.pull_request.head.sha }}` on `actions/checkout` |
| `blocked: merge setup (...)` | `ship: merge`, but the repository lacks a piece: auto-merge or the merge method not allowed, no active rule requiring `devkit-reviews` on the default branch, or the workflow not committed (the message lists which) | Run the GitHub step of `/openspec-setup` and confirm the items; commit the workflow |
| `auto-merge on: waiting for <what>` | All eight items are met and auto-merge is enabled; GitHub has not merged yet (`GitHub to merge`, `branch rules outside the delivery contract (for example a required approval)`, `GitHub to compute mergeability`) | Run `deliver-check <id> --watch` or `ship-change` again; if the wait is a rule outside the contract, satisfy it or adjust the ruleset |
| `blocked: item 6` with `devkit-reviews fails in CI while items 1-4 are met locally` | The CI check and the local view disagree: a file not pushed, or a checkout that is not the PR head | Read the CI log of `devkit-reviews`; push what is missing or fix the checkout (see the two `--ci` exit 3 rows) |
| `blocked: item 5` | The PR has a merge conflict, was closed, or its head isn't in your history (or it was merged at a head other than your local one) | Resolve the conflict (or reopen) and run it again; the flow never resolves conflicts |
| `blocked: archive (<step>)` | An archive step cannot go on: the default branch could not be read (`read-default-branch`), the archive PR conflicts, has a failing check, was closed or is not in your history (`archive-pr`), `retro.md` has no `## Proposed updates` (`retro`), the change is archived on another branch or `origin/<base>` is missing (`archive`), or a changed file is named by no approved proposal (`apply-proposals`) | Read the reason after the step name; fix it and run it again. The flow opens no second archive PR |
| `archive: waiting for the owner's answers` | Every retro proposal needs an `- Answer:` line in `retro.md` before the archive PR exists | Approve or reject each proposal listed, then run `ship-change` again |
| `archive PR open: waiting for <what>` | The archive PR has auto-merge on and GitHub has not merged yet | Run `deliver-check <id> --watch` or `ship-change` again |
| `deliver-check` exits 3: `no openspec/changes/<id>/ and no openspec/changes/archive/<date>-<id>/` | The id is in neither place in this checkout | Switch to the default branch and pull, or to the change's branch |
| `in progress: item 6` | Required checks are still running, or failing | Run `deliver-check <id> --watch` or `ship-change` again; a failing check is fixed through `tdd-implementer` |
| `git worktree list` shows a worktree whose folder is gone (`prunable`) | A change's worktree was deleted by hand | `git worktree prune`; `/conduct` prunes at its start and reuses a worktree found by branch |
| `conduct-check` exits 3: `no change <id>:` | `/conduct <id>` names a change that exists nowhere: no worktree, no branch, no folder | Check the id; the skill asks whether to create it and with which schema, and creates nothing before your answer |
| `<id> has unfinished work in <worktree>` | The change's worktree holds uncommitted paths outside `openspec/` or a half-done phase, left by an earlier run | Say in your own message whether to go on with it; otherwise the change stays `waiting for the owner: unfinished work in <worktree>` |
| `blocked: rebase of <id> stopped: resolve or abort it in <worktree>` | A rebase left in progress in the change's worktree (a conflict outside the release files) | Resolve it there, or `git -C <worktree> rebase --abort`, then run `/conduct` again; the skill aborts only when you ask |
| A start was refused: `waiting for the owner: start session <id> phase <n>` | The app accepts a start only on your typed turn and its unbroken chain of continuation turns; an automated turn broke the chain | Type `/conduct <id>` (or `/conduct round <n>`) again; the phase is never run as a subagent in its place |
| A child is still running when you re-run `/conduct` | The change reads `running` (its child is in `--busy`) and no second session starts | Wait for its end (the next turn continues the chain) or open the child session from the sidebar |
| The hooks don't fire at all | `devkit-openspec` isn't installed or enabled, or the project isn't opted in: `openspec/config.yaml` doesn't select `devkit` or `devkit-lite` (a renamed schema counts) | `/plugin` → enable `devkit-openspec@devkit`; set `schema: devkit` or `devkit-lite` in `openspec/config.yaml` |
| Every role runs as a general-purpose subagent "following" an agent file, and the one-writer rule is not enforced on the gate files | The conducting session was started in another folder (the app cannot move it), so the packs installed at project scope are not loaded in it | Start the conducting session on the project's folder (a worktree under it counts). If you go on anyway, keep the one-line deviation in `readiness.md`, every `reviews/<name>.md` and `evidence.md`, as devkit-panel did |

## Cost

Every agent run costs time and tokens, so the defaults keep runs few and cheap:

- `devkit-lite` is the default schema; the full flow is for the changes that need it.
- All reviewers and the readiness reviewer run on Sonnet; only `change-planner` uses Opus. To change a model for one project, copy the agent into the project's `.claude/agents/` and edit its `model:`.
- Reviewers scale to the diff (each has a Budget section), run the test suite at most once, and read tests instead of running mutations unless asked.
- `review-change` summons only the reviewers the diff needs, re-runs only the ones that rejected, checks only their previous findings, and stops after two rounds.
- In the full flow, tasks use as few phases as the work needs: each phase is one implementer run.

## Limits

- Who merges depends on the ship mode: in `plan` and `pr` mode the merge is always yours; in `merge` mode GitHub merges, but only after `ship-change` enabled auto-merge at 8/8 on a prepared repository (see the limits above). In `devkit-lite` the hooks allow the main session to edit product code, so only the `ship-change` skill keeps it off product code.
- `openspec/roadmap.md` reports the order between changes; `/conduct round <n>` enforces `after:` before a change's first `implement`, but `/conduct <id>` and `/ship-change <id>` on their own do not: a change can be started before the ones it is `after:`.
- The `/conduct` chain of child sessions is broken by any automated turn (a cron, a scheduled wake-up, a message from a session): the report lists what is left to start and you type `/conduct` once more. Nothing outside the session wakes a round, and outside the desktop app phases are subagents, not sessions.
- Hooks can veto an action; they can't make a step happen. The guarantee is "no code before an independently approved plan, no PR without approved reviews and evidence", not "the review was thorough".
- Shell writes are detected from the command (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `install`, `touch`, `truncate`). A path built from a variable (`"$TMP"/x`) or a script that writes from inside an interpreter (`python -c`, `node -e`) is not resolved, so it isn't gated; CI is the backstop.
- OpenSpec's schema commands are marked experimental by the CLI and may change between versions. The schemas here are validated against OpenSpec 1.16.
- CI does not check `approval.md`: the main session writes it, so CI could see only that the file exists, not that you gave it, and it would fail every open `devkit` PR made before it existed. The recorded approval is a local gate (`deliver-check` and the skill).
- `readiness.md` approval is not invalidated automatically when the plan changes later; the schema tells the agent to re-run it, and review in the PR is the backstop.
