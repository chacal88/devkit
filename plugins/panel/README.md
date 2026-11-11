# devkit-panel

A side pane in the Claude desktop app that shows where every change of the current roadmap round stands, drawn from the devkit checkers (`conduct-check` and `deliver-check` of [devkit-openspec](../openspec/README.md)). It is read-only: it starts no session, writes no file, schedules nothing beyond its own refresh while the pane is open, and never submits a prompt. Its buttons put the owner's next command in the prompt box; the owner presses Enter.

```bash
claude plugin install devkit-openspec@devkit --scope project
claude plugin install devkit-panel@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)). The pack is a Claude Code mod (function hooks), so it loads in the Claude desktop app's bundled Claude Code; the guide is [docs/openspec-flow.md](../../docs/openspec-flow.md#the-panel-devkit-panel).

## What it shows

The pane draws only in an OpenSpec devkit project: a root whose `openspec/config.yaml` has a top-level `schema: devkit` or `schema: devkit-lite`, the same opt-in the hooks read. Elsewhere it shows one line and runs nothing.

- **Header**: which checker runs (`repo` for the devkit repository's own `plugins/openspec/hooks/`, else `devkit-openspec <version>` from the pack installed at project scope for the project, or at user scope), the age of the report and a `Refresh` button. A checker error (a non-zero exit, a timeout) is one line under the header; the last good report stays with its age.
- **The round**: `Round <n>: <title> · <done>/<total>` and the counts of `dispatch`, `owner`, `github` and `stopped` ids, from `conduct-check --json` (version 2) run in the project root with `DEVKIT_HOST=app`.
- **One row per change of the round**: its id, its `state` as a pill, its `next.step` and `next.actor`, and its owner buttons. Unfolding a row runs `deliver-check <id> --json` once per refresh in the change's worktree and lists the eight items of the delivery contract (`met`, `open`, `blocked` with the reason), the summary and the next step; it also lists the change's linked child sessions (`<sessionPrefix><n>`) as `running`, `idle` or `archived`.
- **Other changes** and **Archived**: the open change folders outside the round and the archived ones, by name, collapsed; no checker runs for them.
- **The permission line**: the child sessions come from the app's `mcp__ccd_session_mgmt__list_sessions` tool, read only when the tool's permission answers `allow`. With `ask` or `deny` one line names the tool and the lists stay empty; the panel never opens a permission dialog, not even from its timer.

The report refreshes at session start, when the pane opens, at the end of each main-loop turn, every 60 s while the pane is open and on `Refresh`. One run at a time: a trigger during a run is folded into it.

## The band, the command and the tool

- **The band** above the prompt, in a devkit project only: one dim line (`devkit · round <n> <title> · <done>/<total> · dispatch <k> · owner <k> · github <k> · stopped <k>`) and an `Open` / `Close` button for the pane.
- **`/devkit-panel`** toggles the pane; **`/devkit-panel status`** prints the pane as plain text.
- **`mcp__devkit-panel__status`**, a tool for the model and for a headless owner: the same text after a refresh (the round, every change with its next step and state, the child sessions). Read-only like everything else.

## The buttons fill the prompt and never send

Every owner button calls `prompt.fill` with one exact text and nothing else: no `prompt.submit`, no session tool, no command. Where no prompt box can take the text (mobile, headless, a dialog in front) the same text is toasted.

| Button | On | Text filled |
|---|---|---|
| Conduct | every row | `/conduct <id>` when the installed `conduct-check` accepts `--change <id>` (probed once per session), else `/conduct` |
| Ship | a delivery step (`implement` onward: `fix-*`, `gate`, `commit`, `verify`, `open-pr`, `wait-*`, `retro`, `archive`, ...) | `/ship-change <id>` |
| Approve | `stop-plan-approval`, `approve` | pt-BR `Aprovo o plano de <id>` · en `I approve the plan of <id>` |
| Answer | `stop-retro-answers` | `Approve proposal 1 of <id>` (edit the number and the verdict) |

A `create` or `new-change` row has only `Conduct` (`/conduct`: the conduct skill asks the schema itself).

## Language

The `language` option of the pack (`/config`, or the `userConfig` of the plugin) selects every pane, band and toast text: `pt-BR` (the default) or `en`. The fill texts above are the same in both languages except `Approve`.

## What it never does

Validate the pack with the desktop app's bundled Claude Code (`claude plugin validate plugins/panel`): the report lists `process.run`, `tool.check`, `tool.call`, `prompt.fill`, `ui.*`, `clock.every` and `fs.read/exists/list`, and no `prompt.submit`, `fs.write`, `store`, `clock.after` or session tool. The module keeps its state in the session only (`$.state`); nothing is written to the project or to `$.store`.

## Assets

The pack ships no agents or skills; the generated section below stays empty.

<!-- catalog:begin -->

<!-- catalog:end -->
