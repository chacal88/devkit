# Design

Change: `devkit-panel` · Date: 2026-11-10 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

## Context

See proposal.md (Why) and requirements.md (Facts). What shapes the design:

- The pane is a Claude Code mod: a hooks module with no DOM and no Node, reaching the host only
  through `$` (`$.process.run` for the checkers, `$.fs` for folders, `$.tool.call` for the app's
  session list, `$.prompt.fill` for the prompt box). The engine's contract for the build the app
  runs (2.1.317) is the `claude-code.d.ts` the `plugin-authoring` skill lays out (in this session:
  `/private/tmp/claude-501/bundled-skills/2.1.317/*/plugin-authoring/types/claude-code.d.ts`,
  14 000 lines; `examples/pane.tsx`, `band.tsx`, `pane.test.tsx` beside it). Once the mod has
  loaded in a session, `plugins/panel/.claude-plugin/types/` holds the same (ignored by git).
- The checkers are the source of truth: `conduct-check --json` (version 2) for the round,
  `deliver-check <id> --json` for one change. The panel draws them and computes nothing of its
  own about the flow.
- The app accepts a session start only on the owner's typed turn, and a prompt a mod submits is
  automated. So the owner presses Enter: the panel only fills the box.
- Conventions: packs under `plugins/<pack>/` with `.claude-plugin/plugin.json`, a `README.md`
  with the catalog markers, an entry in `marketplace.json`, English everywhere, versions bumped
  with a CHANGELOG line.

## Goals / Non-Goals

**Goals:**

- One glance at where every change of the round stands, in the app, without typing `/conduct`.
- The owner's next command one press away, typed by the panel, sent by the owner.
- Nothing the panel does can move a change: read-only by construction and by `claude plugin
  validate`'s report of what the module calls.

**Non-Goals:**

- A flow engine, gates, grill forms, Jira, pending starts, workflow editing (the old mod's).
- Starting, grouping, archiving or messaging sessions; any write under the project; any schedule
  beyond the pane's own refresh timer.
- The `--change <id>` option of `conduct-check` (the sibling change `conduct-one-change`).

## Decisions

### D1. No spec delta

This repository keeps no `openspec/specs/`; every archived change pinned behaviour with tests and
set `skip_specs: true`. Same here: the acceptance criteria are pinned by `plugins/panel/hooks/
*.test.tsx` under `claude plugin test`.

### D2. The pack: files and manifest

```
plugins/panel/
  .claude-plugin/plugin.json      name devkit-panel, version 0.1.0, types, userConfig.language
  hooks/hooks.json                { "modules": ["./register.tsx"] }
  hooks/register.tsx              hooks: session.start, command.run, turn.complete, ui.render (Pane, AbovePrompt), tool.call (status tool)
  hooks/project.ts                root detection, checker location, change folders (pure helpers + $.fs readers)
  hooks/report.ts                 JSON parsing of conduct-check and deliver-check (pure), the panel's view model
  hooks/sessions.ts               parseSessionRows, prefix match, the permission check (mayList)
  hooks/commands.ts               the owner buttons' texts (pure)
  hooks/i18n.ts                   uiText(lang): every string, pt-BR and en
  hooks/pane.tsx                  renderPane, renderBand, renderText (the same view as plain lines)
  hooks/*.test.tsx                claude plugin test
  types/index.d.ts                PluginState['devkit-panel'] and the view types
  README.md                       install line, what it shows, the buttons, catalog markers
  tsconfig.json                   { "extends": "./.claude-plugin/types/tsconfig.json" } (the engine lays the target when the mod loads)
```

`plugin.json`:

```json
{
  "name": "devkit-panel",
  "version": "0.1.0",
  "description": "Side pane over the devkit checkers: the round's changes, their next step, the linked child sessions, and buttons that put the owner's next command in the prompt box. Read-only.",
  "author": { "name": "kaue rodrigues dos santos", "url": "https://github.com/chacal88" },
  "license": "MIT",
  "types": "./types/index.d.ts",
  "userConfig": {
    "language": { "type": "string", "description": "Language of the pane, band and toasts", "options": ["pt-BR", "en"], "default": "pt-BR" }
  }
}
```

`.gitignore` of the repository gains `plugins/*/.claude-plugin/types/` (the engine writes it).

No `dependencies` entry: in this engine `dependencies` lays a plugin's `$`-noun contract beside
the mod's types and lets `claude plugin prune` remove auto-installed ones; devkit-openspec adds no
noun, and the panel needs the pack's *path*, which the manifest never gives. The path comes from
`installed_plugins.json` (D4). Alternative rejected: vendoring a copy of the checkers (two copies
to keep equal, against conventions "one checker anyone can run").

### D3. Where the panel is on: the project root and the opt-in

`root = await $.session.root()` (the folder the session runs in, a `.claude/worktrees/<name>`
checkout included). The project is an OpenSpec devkit project when `<root>/openspec/config.yaml`
exists and `guard.mjs`'s own reading of it (`projectSchema`: the first match of
`/^schema:\s*["']?([\w.-]+)/m`) is one of `DEVKIT_SCHEMAS` (`devkit`, `devkit-lite`), the opt-in
of ADR 0004 (`guard.mjs:136-146`); the panel copies that regex and list, not the module (a mod
imports only its own files). Elsewhere: `view.kind = 'not-devkit'`, the
pane draws one line, the band returns `next(e)`, no checker runs, no timer tick does anything.
The decision is made at every refresh (a `/cd` or a worktree move changes the root).

### D4. Which checker runs

`checker.ts#locateChecker($, root)` returns `{ dir, label }`:

1. `<root>/.claude-plugin/marketplace.json` exists and its `plugins[]` has `name ===
   "devkit-openspec"` → `{ dir: <root>/plugins/openspec/hooks, label: 'repo' }` (the devkit
   repository and its worktrees run their own tree).
2. Else read `~/.claude/plugins/installed_plugins.json` (`~` from `$.env.get('HOME')`; the file's
   `plugins["devkit-openspec@devkit"]` list). Take the first entry with `scope === 'project'` and
   `projectPath` equal to `root`, or equal to the project above a worktree (`root` with
   `/.claude/worktrees/<name>` cut off); else the first entry with `scope === 'user'`. `dir` is
   `<installPath>/hooks`, `label` is `devkit-openspec <version>` (the entry's `version`).
3. Else `{ kind: 'no-checker' }`: the pane's one line says `install devkit-openspec@devkit
   --scope project`.

The round: `$.process.run(['node', `${dir}/conduct-check.mjs`, '--json'], { cwd: root, env: {
DEVKIT_HOST: 'app' }, timeoutMs: 60000 })`. Exit 0 → parse stdout as the version-2 report; exit 3
→ `error` from the JSON `error` field (or stderr's first line); a rejection (timeout, `node`
missing) → `error: <message>`. One change: `['node', `${dir}/deliver-check.mjs`, id, '--json']`
with `cwd` = the row's `worktree` when `$.fs.exists(worktree)` (`conduct-check` fills `worktree` on
every row, a `create` row's folder is not there yet), else `root`; same timeout.

### D5. The view model (what the drawing reads)

`report.ts` parses tolerantly (every field optional, unknown values kept as text) into:

```ts
type RoundReport = {
  version: number; base?: string; round?: { n: number; title: string; done: number; total: number }
  roadmapDone: boolean; changes: ChangeRow[]; dispatch: string[]; owner: string[]; github: string[]; stopped: string[]; busy: string[]; end: boolean
}
type ChangeRow = {
  id: string; round?: number; after?: string; text?: string; schema?: string; worktree?: string; branch?: string
  sessionPrefix?: string; next: { step: string; actor: string; reason?: string; askable?: boolean; phase?: number }
  state: string; deliver?: { summary: string; met: number; next: string } | null; session?: { name: string; title: string; phase: number }
}
type DeliverReport = { change: string; summary: string; met: number; items: { id: number; name: string; status: 'met' | 'open' | 'blocked'; reason?: string }[]; next: { step: string; [k: string]: unknown }; approval?: { ok: boolean } }
type PanelView = {
  kind: 'not-devkit' | 'no-checker' | 'report'
  checker?: string                      // 'repo' | 'devkit-openspec 0.9.1'
  report?: RoundReport; reportAt?: number; error?: string
  others: string[]; archived: string[]  // folder names, from $.fs.list
  delivers: Record<string, DeliverReport | { error: string }>
  sessions: Record<string, SessionRow[]>  // by change id
  permission?: string                   // the tool to allow, when list_sessions is not allowed
  changeOption: 'unknown' | 'yes' | 'no' // the --change probe
}
```

The read versions are named in one place (`report.ts`: round `2`, deliver `1`); a report whose
`version` is higher than the one read is not drawn: it becomes the error line (`conduct-check: JSON
version 3 is newer than the 2 this panel reads`), the last good report stays (the docs define
`version` as the breaking-change signal).

`others` = entries of `<root>/openspec/changes/` of kind `dir`, not `archive`, whose name is not a
round id; `archived` = entries of `<root>/openspec/changes/archive/` of kind `dir`, newest name
first (they start with the date). Both from `$.fs.list`, no checker.

### D6. Refresh: one run at a time

`register.tsx` keeps `let inFlight: Promise<void> | undefined` in the module (reset on reload)
and the view in `$.state` (D11). `refresh($, reason)`:

- If `inFlight` is set, return it (the trigger is folded into the running refresh; the next
  trigger after it runs again). AC-6: two checkers never run at once.
- Set `inFlight` and `isRefreshing: true` in the state (redraws `refreshing...`; `session.start`
  clears it, since a hot reload resets `inFlight` but keeps the state); compute the root and
  the opt-in (D3); run the round checker (D4); on success replace `report` and `reportAt`
  (`$.clock.now()`) and clear `error`; on failure keep the last report and set `error`; then the
  folders (D5), the sessions (D7), and the deliver reports of every change whose row is
  expanded (`collapsed[id] === false`), one `deliver-check` per expanded id per refresh (AC-5);
  write the view; clear `inFlight`.

Triggers: `session.start` (after `$.command.register`; `void refresh`); the pane's open (`/devkit-
panel`, the band's button: `$.ui.open` first, so the pane shows `refreshing...`, then `void refresh`); `turn.complete` with `e.agentId ===
undefined` (`void refresh`, then `next(e)`); `$.clock.every(60000, ...)` registered in
`session.start`, whose callback runs `refresh` only when `(await $.ui.panes()).some(p => p.id ===
PANE)`; the pane's `Refresh` button. Age: the pane draws `reportAt` against `$.clock.now()`
(`updated 12 s ago`); the clock tick redraws it through the state write.

Expanding a row (`toggle(id)`) runs the deliver check of that id at once when none is cached for
the current `reportAt` (so a press shows the items without waiting a minute); a collapsed row's
cached report is dropped at the next refresh.

### D7. Child sessions, read only, never a dialog

`sessions.ts`: `const LIST = 'mcp__ccd_session_mgmt__list_sessions'`; `mayList($)` = `(await
$.tool.list()).some(t => t.name === LIST)` and `(await $.tool.check({ tool: LIST, input: { linked:
true, limit: 100 } })).decision === 'allow'` (the check's argument is `{ tool, input }`,
`claude-code.d.ts` `ToolCheckArgs`; the call's is flat). `allow` → `$.tool.call({ tool: LIST, linked: true, limit:
100 })`, rows parsed by `parseSessionRows(text)` (the old mod's reader, kept: `sessionId`,
`name`, `title`, `cwd`, `isRunning`, `isArchived`, `startedBy`, `lastActivityAt`; a row without
`sessionId` is dropped). Not listed or not `allow` → `view.permission = LIST`, `sessions = {}`,
one line in the pane (`allow mcp__ccd_session_mgmt__list_sessions to see the child sessions`).
`$.tool.check` opens no dialog (its doc: "nothing runs, no dialog opens"), so a timer never asks
the owner. The call itself resolves `{ deny }` or `{ isError }` when refused or failed (it rejects
only for an unknown name or an abort): both become the error line (`list_sessions: <reason>`),
never a silent empty list; the `permission` notice is only the `mayList` path. A row belongs to change `c` when `row.name` matches `new RegExp('^' +
escape(c.sessionPrefix) + '[0-9]+$')`; its state is `running` when `isRunning`, `archived` when
`isArchived`, else `idle`; a row with no matching change is not shown.

### D8. The owner buttons: exact text, filled, never sent

`commands.ts#buttonsFor(row, view, lang): { key, label, text }[]`, pure, pinned by tests:

| `next.step` (or state) | button | text filled |
|---|---|---|
| any row | Conduct | `/conduct <id>` when `changeOption === 'yes'`; `/conduct` otherwise (the owner adds the id) |
| a delivery step (`implement`, `fix-*`, `gate`, `commit`, `verify`, `open-pr`, `push`, `wait-*`, `enable-auto-merge`, `edit-pr-body`, `retro`, `archive*`, `tick-roadmap`, `apply-proposals`, `stop-retro-answers`, `stop-plan-approval`) | Ship | `/ship-change <id>` |
| `stop-plan-approval`, `approve` | Approve | pt-BR `Aprovo o plano de <id>` · en `I approve the plan of <id>` |
| `create`, `new-change` | Conduct only | `/conduct` (the conduct skill asks the schema itself with AskUserQuestion) |
| `stop-retro-answers` | Answer | `Approve proposal 1 of <id>` (the owner edits the number and the verdict) |

A press calls `$.prompt.fill({ text, mode: 'replace' })`; `isFilled === false` → `$.ui.toast(text)`
(mobile, headless, a dialog). Nothing else: no `prompt.submit`, no session tool, no `command.run`.
Every text is one of `uiText(lang).fill.*` (four: conduct, ship, approve, answer), so AC-8 pins them per language.

The `--change` probe: on the first refresh of a session with `changeOption === 'unknown'`, the
panel runs `conduct-check --json --change <first id>` once; exit 0 → `'yes'` (that stdout is not
used as the round); any other exit or a rejection → `'no'` (the wording of the checker's error is
not a contract; a failed probe only costs the id in the Conduct button). No round id → stays
`unknown` (treated as `'no'`, probed again at the next refresh that has an id).

### D9. The band, the command and the status text

- Band: `on('ui.render', { component: 'AbovePrompt' })`: `next(e)` when `e.props.hasSurvey`, when
  `view.kind !== 'report'` or when no report exists yet; else one row: `devkit · round <n>
  <title> · <done>/<total> · dispatch <k> · owner <k> · github <k> · stopped <k>` (dim, truncated
  to `e.props.bodyColumns`) and a plain `Button` (`key="band:pane"`) labelled `Open` / `Close`
  that toggles the pane (`$.ui.panes()` says which).
- Command: `$.command.register({ name: 'devkit-panel', description: 'Toggle the devkit panel
  (status: print it as text)', argumentHint: '[status]' })` in `session.start`; `on('command.run',
  { command: 'devkit-panel' })`: with `status` as the argument, `{ text: renderText(view, lang) }`
  (the pane as plain lines, the same view); otherwise toggle the pane and answer `{ text: 'devkit
  panel opened' | 'closed' | 'waiting for room' }`. A failing hook hands the command on
  (`.catch(($, e, next) => next.called ? undefined : next(e))`), as the old mod did.
- Status tool for the model: `$.tool.register({ name: 'status', description: 'The devkit panel as
  text: the round, every change with its next step and state, the child sessions. Read-only.' })`
  served by `on('tool.call', { tool: 'mcp__devkit-panel__status' })` returning `{ result: text }`
  after a refresh (`text` is core's to fill). It is how a session proves AC-13 (`evidence.md` pastes its output) and
  how a headless or mobile owner reads the panel. Read-only like everything else.
- `renderText` (the `status` command and tool) is the headless reading of the panel: it lists
  every change row with its child sessions whatever the collapse state, and the deliver items of
  the rows whose report is cached; the pane keeps its folds.
- The pane's close (the person's mark) needs no hook: the pane's state is the engine's record
  (`$.ui.panes()`).

### D10. Language

`i18n.ts#uiText(lang: 'pt-BR' | 'en')` returns one object with every string the pane, band,
toasts, command answers and fill texts use; `lang` is `options.language` of `register(on,
options)` (`'pt-BR'` when absent or unknown). The module's code, comments, README and this plan
are English (`scripts/check.py#check_language` scans `*.md` only; the pt-BR strings live in
`.ts`).

### D11. State contract

`types/index.d.ts` declares, under `PluginState['devkit-panel']`:

```ts
view: Shaped<PanelView>     // shape `view-2` (`view-1` before the review round added `listError`): an older value is declined
collapsed: Record<string, boolean>   // by change id; `others` and `archived` as keys too; absent = collapsed
isRefreshing: boolean
```

`atom(ref, initial, { shape })` + `read($, atom)` in the render hooks + `update($, atom, fn)` from
the refresh and the handlers (the write redraws the readers). Nothing in `$.store`.

### D12. Drawing

`pane.tsx#renderPane({ Box, Text, Button }, view, collapsed, lang, actions)`, sized to
`e.props.bodyColumns`, the old mod's palette kept (`STATUS_HEX`: done `#4CAF7D`, running
`#D97757`, blocked `#D14343`, pending `#B4B2A9`; pills with the same hues; links `#2F6FD6`):

```
devkit · devkit-openspec 0.9.1 · updated 12 s ago · [Refresh]
⚠ conduct-check: git fetch origin main            (only with an error)
Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0
▸ commit-and-pr-trailer   ready to run: gate       gate · 1.9     [Conduct] [Ship]
▾ conventions-trailer     waiting on commit-and-pr-trailer
    deliver: in progress: item 1 · 2/8 met · next: implement
    1 ✓ tasks and gates   2 ○ reviews ... (one line per item, reason dim)
    sessions: conventions-trailer-p1 · running
▸ Other changes (1)       devkit-panel
▸ Archived (7)            2026-11-10-conduct-sessions, ...
allow mcp__ccd_session_mgmt__list_sessions to see the child sessions   (only without permission)
```

State pills: `running`/`ready to run` → running hue, `archived` → done, `blocked:` → blocked,
`waiting` → pending. Every button has a `key` (`refresh`, `toggle:<id>`, `conduct:<id>`,
`ship:<id>`, `approve:<id>`, `answer:<id>`) so tests press them. `renderText`
produces the same lines with ASCII marks for the `status` command and tool. The mobile surface
draws the same tree (no `Input` is used).

### D13. Tests (`claude plugin test plugins/panel`)

`hooks/panel.test.tsx` and `hooks/report.test.tsx`, the kit's `on(...)` standing for the engine
beneath the plugin, as the old mod's `orchestrator/tests/harness.test.ts` and `tests/permissao-harness.test.ts` and the skill's `pane.test.tsx` do:

- Fixtures are captured from real runs in this repository (`node plugins/openspec/hooks/conduct-check.mjs --json` with `DEVKIT_HOST=app`, `node plugins/openspec/hooks/deliver-check.mjs <id> --json`, an exit-3 `--change` run), saved under `plugins/panel/hooks/fixtures/` and trimmed, never written from this design's sketch.
- A `world(on)` helper: `session.root` → `/w`; `env.get` → `/h`; an in-memory disk answering
  `fs.exists`, `fs.read`, `fs.list` (`/w/openspec/config.yaml`, `/w/openspec/changes/...`,
  `/h/.claude/plugins/installed_plugins.json`); `process.run` answering by `argv` (conduct-check
  fixture: version 2, round 5, two changes, one `session` row; deliver-check fixture: 8 items;
  `--change` → exit 3 `unknown option`); `tool.list`, `tool.check` (answering by `e.tool` and `e.input`, `allow` or `ask`),
  `tool.call` (rows), `prompt.fill` (`isFilled` true or false, recording the text), `ui.open`,
  `ui.panes`, `ui.toast`, `clock.now`, `command.register`, `tool.register`.
- Cases: AC-2 (rows and header; `items[].id` from the fixture), AC-3 (others and archived, no `process.run` for them), AC-4 (no
  config: one line, band passes), AC-5 (press `toggle:<id>` → one deliver-check with `cwd` the
  worktree; items drawn), AC-6 (two refreshes at once → one `process.run`; an exit-3 answer keeps
  the previous report and shows the error line), AC-7 (prefix match; `ask` → notice, no
  `tool.call`), AC-8 (every button's filled text, pt-BR and en; `isFilled: false` → toast), AC-9
  (band text and toggle; the command's answers), AC-10 (`test(name, { options: { language: 'en'
  } }, ...)`), the `--change` probe. Each UI case loops over `['terminal', 'desktop'] as const`.
- Pure functions (`report.ts`, `commands.ts`, `sessions.ts#parseSessionRows`, `project.ts`'s
  readers of `config.yaml` and `installed_plugins.json`) are tested directly.

### D14. Release files and docs

- `.claude-plugin/marketplace.json`: the `devkit-panel` entry (`source: ./plugins/panel`,
  `version: 0.1.0`, `category: development`); `metadata.version` 0.10.0.
- `scripts/gen-catalog.py`: `PACKS` gains `"panel"`; `docs/catalog.md` regenerated (the pack has
  no agents or skills: its section is the description and the README link).
- `docs/conventions.md`: pack table row `panel`; `docs/openspec-flow.md`: a short `## The panel:
  devkit-panel` section after "Conducting a round" (what it shows, the buttons fill the prompt,
  read-only, install line with `--scope project`).
- devkit-openspec 0.9.2 (`plugins/openspec/.claude-plugin/plugin.json` and its marketplace entry):
  `'devkit-panel'` appended to `PACKS` in `plugins/openspec/skills/openspec-setup/scripts/
  project-settings.mjs` (the guard test `PACKS equals the plugin names in marketplace.json` pins it;
  `DEFAULT_PACKS` unchanged). If `deliver-check.test.mjs`'s pin test then asks for `v0.9.2` in the CI
  snippet of `docs/openspec-flow.md`, the pin moves with the release as 0.9.1 did.
- `CHANGELOG.md`: `## 0.10.0 — devkit panel` with a `**devkit-openspec** 0.9.2:` line too.
- After the rebase onto main at 0.10.1 (`conduct-one-change` merged first), the release-rebase rule
  gives marketplace 0.11.0 (minor bump over the base), devkit-openspec 0.10.2 (patch bump over the
  base), the CHANGELOG entry `## 0.11.0 — devkit panel`, and the CI pin `v0.10.2`; `docs/openspec-flow.md`
  (not a release file) was merged by hand: the base's text plus the panel section. The sibling change targets 0.10.0 for
  devkit-openspec; whichever merges second rebases with `release-rebase` (versions, CHANGELOG,
  catalog by rule).
- `plugins/panel/README.md` with `<!-- catalog:begin -->` / `<!-- catalog:end -->` markers and the
  install line `claude plugin install devkit-panel@devkit --scope project`.

### D15. Gates and how the mod commands run

`claude plugin test` exists in the Claude Code the desktop app bundles (2.1.317), not in the npm
`claude` 2.1.227 on PATH (whose `plugin validate` reads the manifest only and rejects a `modules` hooks.json). Every gate is one
backticked `&&`-joined command (the flow runs the first backticked text after `Gate:`, each part
on its own, so an `export PATH` in prose would not count), and each `claude plugin ...` part names
the app's binary by absolute path: `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin test plugins/panel`. A type check (`npx -y -p typescript@5.6.3 tsc -p <tsconfig outside the
repo>` with the skill's `claude-code.d.ts` as the one type root and `include` naming
`plugins/panel/hooks` and `plugins/panel/types`) is a task, not a gate: the engine lays the types
only when the mod loads.

Precondition of every gate: `claude plugin test --help` prints the usage text `Run a mod's tests` (the
refusal below exits 0 too, so the text is what to check; the switch was seen to flip back off within
the same day, so the check runs before every gate). When it answers `hooks
modules are turned off in this process: the rollout switch was saved off by an earlier session`,
start that binary once with network access (`claude -p "ok" --max-turns 1`) and retry (that is
what turned it on in this session on 2026-11-10); if the message persists, mods are off remotely
and the change stops as an owner decision. The refreshed switch holds for about two minutes only
(measured on 2026-11-11), so in a chained gate the `plugin test` part runs first, before the
three-minute guard suite.

### D16. Within ADR 0001, no ADR

The panel reads the repository (folders), GitHub through the checkers, and the app's own list of
sessions, which ADR 0001 and ADR 0006 already count as the state a coordinator may read. It starts
nothing, drives nothing, schedules nothing but its own redraw, and keeps no state outside the
session (`$.state`, gone with it). The owner declined an ADR in the grill. Review trigger carried
by this design, not by an ADR: if the app ever accepts a mod's `prompt.submit` as the owner's
turn, the buttons may submit, and that would be a new decision.

### D17. The live check (AC-13)

Two steps, both needing the owner's hand (a mod loads only where the app asks the person):

1. In the conducting session: a link `~/.claude/dev-mods/<session id>/devkit-panel ->
   <worktree>/plugins/panel`; the app asks "Turn on the mods Claude writes in this session?"; on
   yes the mod loads at the turn's end (this session's root is not a devkit project: the band stays
   away and `/devkit-panel status` answers the one line, AC-4 live). When the app offers no such
   question in that session, step 1 is recorded as `not offered` and step 2 carries the whole check.
2. In a session on the devkit root: `CLAUDE_CODE_PLUGIN_DIRS=<worktree>/plugins/panel` in the
   `env` block of `~/.claude/settings.json` (the owner's file; asked first), then a session started
   on `/Users/kauesantos/Documents/devkit`; its `mcp__devkit-panel__status` tool output, pasted
   into `evidence.md`, shows round 5, the archived changes and the linked sessions. The env entry
   is removed afterwards.

## Risks / Trade-offs

- [The engine's mod API is early access and changes] → the pack pins no engine version; `claude
  plugin validate` on the app's binary is the gate; the types are regenerated by the engine.
- [`conduct-check` takes long: `gh` per change] → 60 s timeout, one run at a time, the last good
  report stays with its age (AC-6); the timer runs only while the pane is open.
- [`installed_plugins.json` changes shape] → tolerant reader; `no-checker` line names the install
  command; the devkit repository itself never depends on it (D4 step 1).
- [The owner's `list_sessions` rule is `ask`] → the notice line names the tool; the owner adds an
  allow rule once (the old mod's note: "the mod never writes a permission rule").
- [The sibling change lands `--change <id>` first] → the probe (D8) switches the Conduct button
  to `/conduct <id>` with no code change.
- [Marketplace version collision with `conduct-one-change`] → `release-rebase` by rule (D14).
- [The pane in a project with many open changes] → `others` and `archived` are names only; no
  checker per change outside the round.

## Migration Plan

1. Merge; `claude plugin install devkit-panel@devkit --scope project` in a project that uses
   devkit-openspec (README and `docs/openspec-flow.md` say so).
2. Nothing on disk changes for existing projects; no state migrates. Rollback: uninstall the
   pack.

## Open Questions

None.
