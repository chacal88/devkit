# Requirements

## Request

The owner decided on 2026-11-10 that there is one engine only, the devkit plugin, and that the
orquestrador mod's visual part (side pane, round and gates view, owner buttons) is what is worth
keeping, rebuilt as a pack of the devkit marketplace, through a devkit change. As the coordinating
session relayed it: "Build the orquestrador panel as a new pack of the devkit marketplace. The pack
is a thin, read-only view over the devkit checkers. It has no flow engine, never starts a session,
never schedules anything, never writes change state, and no button ever calls a session tool."

Decided with the owner in the grill of 2026-11-10 (answers in Portuguese, summarized): the pane's
language is a `userConfig` field of the pack (pt-BR by default, `en`), never a project file; the
band above the prompt appears only in an OpenSpec devkit project and the pane opens only on the
band's button or the slash command, never by itself; a checker failure or a missing
`list_sessions` permission shows as one line while the last good report stays with its age, and
the pane never opens a permission dialog from a timer; no new ADR and no ADR change (the owner:
"that ADR no longer seems useful to us"), the design records that the panel stays within ADR 0001;
the devkit-core agent types are not loaded in the conducting session (it was started in another
repository's folder and the app cannot move it), so each role runs as a general-purpose subagent
told to follow `plugins/core/agents/<name>.md` verbatim, the deviation noted in `readiness.md` and
`evidence.md`; the old mod (`chacal88/orchestrator`) is out of scope.

Classification: domain=process type=feature flags=[ui, contract] (confirmed)

### Facts

- `plugins/openspec/hooks/conduct-check.mjs --json` is JSON `version: 2` (devkit-openspec 0.9.0):
  `base`, `round` (`n`, `title`, `done`, `total`), `startedAt`, `skipped`, `roadmapDone`, one
  entry per conducted change with `id`, `round`, `after`, `text`, `notes`, `schema`, `worktree`,
  `branch`, `base`, `sessionPrefix`, `next` (`step`, `actor` among `subagent | main | askable |
  owner | github | stop | session`, `reason`, the step's fields, `agent`, `askable`), `state`,
  `deliver`, and `session` (`title`, `name`, `cwd`, `branch`, `phase`, `brief`, `background`) on a
  `session` row; then `dispatch`, `owner`, `github`, `stopped`, `busy` (ids) and `end`. Exit 3
  prints `{ "version": 2, "error": "<message>" }` (no `openspec/`, no git, missing
  `origin/<base>`, an unknown option, `--round` out of range). It calls `gh` and never fetches.
  Today's options: `[--json] [--round <n>] [--busy <id,id>] [--watch[=<minutes>]]`; `--change
  <id>` answers `unknown option` (exit 3). A sibling change (`conduct-one-change`, devkit-openspec
  0.10.0, branch `conduct-one-change` in another worktree) adds `--change <id>` and `/conduct
  <id>`; it is not merged.
- Children of a change are named `<sessionPrefix><n>` and found with `^<prefix>[0-9]+$`
  (archived change `conduct-sessions`, design D6); `sessionPrefix` is on every change row.
- `plugins/openspec/hooks/deliver-check.mjs <id> --json` is JSON `version: 1`: `change`, `schema`,
  `ship`, `host`, `head`, `pr`, `phases`, `items` (8), `met`, `summary`, `next` (`step` and its
  fields; `stop-plan-approval` carries `readiness`, `file`, `reason`), plus `approval`, `merge`
  and `archive` objects. Run from anywhere inside the repository; exit 3 for an unknown id.
- The hooks act only in a project whose `openspec/config.yaml` has a top-level `schema: devkit`
  or `schema: devkit-lite` (ADR 0004). The devkit repository itself opts in (`schema:
  devkit-lite`, ship mode `merge` for both schemas).
- Installed packs are listed in `~/.claude/plugins/installed_plugins.json` (`version: 2`,
  `plugins["devkit-openspec@devkit"]` is a list of `{ scope: "project" | "user", projectPath?,
  installPath, version, ... }`). Today: devkit-core 0.5.2 and devkit-openspec 0.9.1 at project
  scope for `/Users/kauesantos/Documents/devkit`, `installPath`
  `~/.claude/plugins/cache/devkit/devkit-openspec/0.9.1`.
- A mod (Claude Code function hooks, early access, engine 2.1.317 as the desktop app runs it) is
  `.claude-plugin/plugin.json` + `hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`) +
  `hooks/register.tsx` exporting `register: Register`, plus `types/index.d.ts` (named in
  `plugin.json` as `"types"`) declaring every `$.state` value. Its API: `on('ui.render', {
  component: 'Pane', requestId })` draws a pane opened with `$.ui.open({ id, title })` (`{
  isPlaced }`), `on('ui.render', { component: 'AbovePrompt' })` draws the band or passes with
  `next(e)`, `$.command.register` in `session.start` + `on('command.run', { command })`,
  `$.tool.call`, `$.tool.check` (`{ decision }`, no dialog), `$.process.run(argv, init)`,
  `$.clock.every(ms, fn)`, `$.prompt.fill({ text, mode })` (`{ isFilled }`), `$.ui.toast`,
  `$.fs.read/exists/list`, `$.session.root()`, `turn.complete` (with `e.agentId` for subagents),
  `userConfig` fields in `plugin.json` read as `options` of `register(on, options)`. The engine
  writes `<mod>/.claude-plugin/types/` when it loads the mod; `claude plugin validate <dir>` lists
  what the module hooks and calls; `claude plugin test <dir>` runs `*.test.ts[x]` with the kit
  `claude-code/testing` (`$.ui.mount`, `find`, `press`, `on(...)` mocks beneath the plugin). The
  app's bundled binary runs these commands (`~/Library/Application Support/Claude/claude-code/
  2.1.317/*/claude.app/Contents/MacOS/claude`); the npm `claude` 2.1.227 has no `plugin test`.
- The app accepts `start_session` only on a turn the owner typed; a prompt a mod submits (even
  `asUser`) counts as automated (chacal88/orchestrator 0.16.0, ADR 0006 context). `$.prompt.fill`
  only puts text in the box; the owner presses Enter.
- The desktop app's `mcp__ccd_session_mgmt__list_sessions({ linked: true, limit: 100 })` rows
  carry `sessionId`, `name`, `title`, `cwd`, `isRunning`, `isArchived`, `startedBy`,
  `lastActivityAt` (observed 2026-11-10).
- Repository conventions: conventional commits; English in code, docs and OpenSpec artifacts;
  each changed pack bumps `version` in its `plugin.json` and in `.claude-plugin/marketplace.json`
  plus a CHANGELOG line; `python3 scripts/gen-catalog.py` must leave no diff (`PACKS` is a fixed
  list in the script); `claude plugin validate .`; test command `node --test
  plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` (`check_changelog` requires
  a CHANGELOG heading for the marketplace version).
- The old mod, read only, in `/Users/kauesantos/Documents/orquestrador/.claude/worktrees/
  project-language-config-bc44d5/orchestrator/hooks/`: `pane.tsx` (drawing style: status hex
  colours, pills, collapsible sections), `model.ts` (`parseSessionRows`), `register.tsx` (`mayList`,
  `listCall`, `canCall`, `togglePane`), `i18n.ts` (two-language `uiText`), and, beside
  `hooks/`, `tests/harness.test.ts` and `tests/permissao-harness.test.ts` (how the app's tools are
  mocked under `claude plugin test`).

## Assumptions

- The pack lives in `plugins/panel/` with `plugins/panel/.claude-plugin/plugin.json` (`"name":
  "devkit-panel"`, `"version": "0.1.0"`, `"types": "./types/index.d.ts"`, `"userConfig":
  { "language": { "type": "string", "options": ["pt-BR", "en"], "default": "pt-BR" } }`),
  `plugins/panel/hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`),
  `plugins/panel/hooks/register.tsx` and sibling `.ts`/`.tsx` files under `plugins/panel/hooks/`,
  `plugins/panel/types/index.d.ts`, `plugins/panel/hooks/*.test.tsx`, `plugins/panel/README.md`
  with the catalog markers. It is added to `.claude-plugin/marketplace.json` (`"name":
  "devkit-panel"`, `"source": "./plugins/panel"`, `"version": "0.1.0"`, `"category":
  "development"`), to `PACKS` in `scripts/gen-catalog.py`, to `docs/catalog.md` (generated) and
  to the pack table in `docs/conventions.md`; the marketplace `metadata.version` and `CHANGELOG.md`
  get the release entry.
- State is read from `node <checker dir>/conduct-check.mjs --json` run with `cwd` = the session's
  project root (`$.session.root()`) and `DEVKIT_HOST=app` in its environment, a timeout of 60 000
  ms; and from `node <checker dir>/deliver-check.mjs <id> --json` run with `cwd` = the change's
  `worktree` from the round report (the project root when the row has none), same timeout.
  `<checker dir>` is, in this order: `<root>/plugins/openspec/hooks` when `<root>/.claude-plugin/
  marketplace.json` exists and names a plugin `devkit-openspec` (the devkit repository itself and
  its worktrees); else the `installPath` + `/hooks` of the first entry of
  `plugins["devkit-openspec@devkit"]` in `~/.claude/plugins/installed_plugins.json` whose `scope`
  is `project` and whose `projectPath` equals the root or the root's git common directory's
  project (a `.claude/worktrees/<name>` checkout belongs to the project above it), else the first
  `user`-scope entry. The header shows `devkit-openspec <version>` (`plugin.json` of that pack) or
  `repo` for the repository's own hooks.
- `--change <id>` is probed once per session: the first `deliver` expansion runs `conduct-check
  --json --change <id>`; on exit 3 with `unknown option` in the error the panel remembers it for
  the session and filters the full report by `id` instead.
- Refresh triggers: `session.start`; `$.ui.open` of the pane; `turn.complete` of the main loop
  (`e.agentId === undefined`); `$.clock.every(60000)` while the pane is open (`$.ui.panes()`
  lists it); the pane's `Refresh` button. One run at a time: a trigger during a run is dropped
  (the next trigger runs again). The pane draws the last good report with its age (`Updated N s
  ago`) and `refreshing...` while a run is in flight.
- Child sessions are read with `$.tool.call({ tool: 'mcp__ccd_session_mgmt__list_sessions',
  linked: true, limit: 100 })` only when `$.tool.check({ tool: 'mcp__ccd_session_mgmt__list_sessions',
  input: { linked: true, limit: 100 } })` answers `{ decision: 'allow' }`; the panel never asks for the permission itself. A row belongs to a change when `row.name`
  matches `^<sessionPrefix>[0-9]+$`; it shows `running` (`isRunning`), `archived` (`isArchived`)
  or `idle`.
- Owner buttons fill the prompt with `$.prompt.fill({ text, mode: 'replace' })` and nothing else:
  `Conduct` → `/conduct <id>` (`/conduct` when `--change` is not accepted); `Ship` → `/ship-change
  <id>` on a change whose `next.step` is a delivery step (`implement` onward); `Approve` on
  `stop-plan-approval`/`approve` → `Aprovo o plano de <id>` (pt-BR) / `I approve the plan of
  <id>` (en); a `create`/`new-change` row has only `Conduct` (`/conduct`: the conduct skill asks
  the schema itself); `Answer` on
  `stop-retro-answers` → `Approve proposal 1 of <id>` (the owner edits the number and the verdict).
  When `isFilled` is false the panel toasts the exact text.
- Band: `on('ui.render', { component: 'AbovePrompt' })` returns `next(e)` outside an OpenSpec
  devkit project or while no report exists; in a devkit project it draws one line: round title,
  `done/total`, counts of `dispatch`, `owner`, `github`, `stopped`, and a button `Open` / `Close`
  that toggles the pane. `/devkit-panel` (registered at `session.start`) toggles the pane too.
- An OpenSpec devkit project is a root with `openspec/config.yaml` whose top-level `schema:` is
  `devkit` or `devkit-lite` (same reading as `guard.mjs`'s opt-in). Elsewhere the pane shows one
  line (`Not an OpenSpec devkit project.`), the band is not drawn, and no checker runs.
- Open change folders under `<root>/openspec/changes/` whose id is not in the round and archived
  folders under `<root>/openspec/changes/archive/` are listed by name only, each group collapsed by
  default, from `$.fs.list`; no checker runs for them.
- `$.state` keys of the pack, declared in `types/index.d.ts` under `'devkit-panel'`: the last
  good round report with its time, the in-flight flag, the checker error line, the deliver
  reports by id, the sessions rows, the `--change` probe result, the collapsed map, the pane-open
  flag, the permission notice. Nothing is written to `$.store` or to the project's files.
- The gate `claude plugin test` needs the app's bundled Claude Code with its mods switch on:
  `claude plugin test --help` must print the usage; when it answers `hooks modules are turned off
  in this process: the rollout switch was saved off`, start that binary once with network access
  (`claude -p "ok" --max-turns 1`) and retry; if the message persists, mods are off remotely and the
  change stops as an owner decision (the npm `claude` 2.1.227 has no `plugin test`).
- Process deviation: `readiness.md`, `reviews/<reviewer>.md`, `evidence.md`, the product code and
  the PR are written by general-purpose subagents told to follow the devkit-core agent definition
  verbatim, because the devkit-core agent types are not loaded in this session; `readiness.md` and
  `evidence.md` say so in one line.
- Versions: devkit-panel 0.1.0; marketplace `metadata.version` 0.10.0 with `## 0.10.0 — devkit
  panel` in `CHANGELOG.md` (the sibling `conduct-one-change` also targets 0.10.0 for
  devkit-openspec; `release-rebase` resolves the release files if they collide).

## Acceptance criteria

- AC-1: `claude plugin validate .` passes with `plugins/panel` (`devkit-panel` 0.1.0) listed in
  `.claude-plugin/marketplace.json` and `docs/catalog.md`; `python3 scripts/gen-catalog.py`
  leaves no diff; `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  passes.
- AC-2: In an OpenSpec devkit project the pane lists every change of the current roadmap round
  with `id`, `next.step`, `next.actor` and `state` from `conduct-check --json` (version 2) run in
  the project root with `DEVKIT_HOST=app`, and the header names the checker (`devkit-openspec
  <version>` or `repo`).
- AC-3: Open changes not in the round and archived changes are listed by name, collapsed, without
  running a checker.
- AC-4: Outside an OpenSpec devkit project the pane shows one line, no checker runs and the band
  is not drawn.
- AC-5: Expanding a change row runs `deliver-check <id> --json` once per refresh in the change's
  worktree and shows its 8 items (`met`/`open`/`blocked` with the reason), `summary` and
  `next.step`.
- AC-6: The report refreshes at session start, when the pane opens, at the end of each main-loop
  turn, every 60 s while the pane is open and on the `Refresh` button; two triggers never run two
  checkers at once; while a run is in flight the last good report stays with its age; a checker
  error (non-zero exit, timeout) is one header line and the last good report stays.
- AC-7: With `list_sessions` allowed, each change lists the linked sessions whose `name` matches
  `^<sessionPrefix>[0-9]+$` as running, idle or archived; with `ask` or `deny` one line names the
  tool, the lists stay empty and no dialog opens from a timer.
- AC-8: Every owner button fills the prompt box with the exact text of the Assumptions and never
  submits it, never starts a session and never calls a session tool; when the fill answers
  `isFilled: false` the same text is toasted.
- AC-9: In a devkit project the band shows the round summary and a button that opens or closes the
  pane; `/devkit-panel` toggles the pane; outside a devkit project the band passes to the engine.
- AC-10: `userConfig.language` (`pt-BR` default, `en`) selects every pane, band and toast text;
  the module's code, comments and docs are in English.
- AC-11: `claude plugin validate plugins/panel` reports no refusal, and the module calls no
  `start_session`, `prompt.submit`, `clock.after`, `fs.write` or `store` method (read-only pack).
- AC-12: `claude plugin test plugins/panel` passes, with tests through the `claude-code/testing`
  kit that mock `process.run`, `tool.check`, `tool.call`, `fs` and `prompt.fill` and cover AC-2
  to AC-10 on the `terminal` and `desktop` surfaces.
- AC-13: Loaded in the devkit repository through the app (the session's mods folder or
  `CLAUDE_CODE_PLUGIN_DIRS`), the pane shows round 5 (`commit-and-pr-trailer`,
  `conventions-trailer`), the archived changes and the linked child sessions; the pane's text is
  recorded in `evidence.md`.

## Out of scope

- Any flow engine, grill, gates, Jira, pending starts, workflows editor or activity files of the
  old mod; starting, grouping, archiving or messaging sessions; scheduling anything beyond the
  pack's own 60 s refresh while the pane is open; submitting a prompt.
- Marking `chacal88/orchestrator` superseded, and any edit in that repository.
- `conduct-check --change <id>` and `/conduct <id>` (the sibling change `conduct-one-change`); the
  deliver-check gap on an approved-but-unapplied proposal with the archive PR open.
- A project-file language option (`.orchestrator/config.json`).
- Mobile and vscode surfaces beyond the toast fallback of `prompt.fill`.
