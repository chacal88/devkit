# Design

Change: `panel-conduct-view` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

Revised 2026-11-11 after the live check's first round (requirements.md, Addendum). The layout now
follows the mock the owner approved, `openspec/changes/panel-conduct-view/mock/` (D8). D20 to D27
are new; D7, D8, D10, D11, D12, D13, D14, D15, D16, D17 and D19 changed, each marked "Revised".
Phases 1 to 3 were built to the earlier text; tasks.md phase 4 brings the code to this one.

## Context

See proposal.md (Why) and requirements.md (Facts, Assumptions). What shapes the design:

- devkit-panel 0.1.0 (`plugins/panel/`) is a Claude Code mod: a hooks module that reaches the host
  only through `$`. The contract of the build the app runs is the 2.1.317 `claude-code.d.ts` that
  the bundled `plugin-authoring` skill lays out. In this session it was at
  `/private/tmp/claude-501/bundled-skills/2.1.317/0be87fe210f1a1bf5e46e97484480dcd/plugin-authoring/types/claude-code.d.ts`
  (23 051 lines). Once the mod loads from the worktree, the same file is at
  `plugins/panel/.claude-plugin/types/claude-code/index.d.ts`, which git ignores. Every API named
  below was checked in that file, not assumed.
- What `$` lets the panel observe, checked on 2026-11-11:
  - `$.session.messages()`: this session's transcript as `{ role, text, toolUses }`, the newest
    4096. `$.session.root()`, `$.session.cwd()` and `$.session.id()` are also there.
  - `$.process.run`: already used for the checkers; it also runs `git`.
  - `$.fs.exists/read/list`; `$.tool.list/check/call`; `$.prompt.fill/read`; `$.ui.toast`.
  - Element tables: `Box`, `Text`, `Button`, `Link`, `Code` and `Markdown` on every surface;
    `Svg` on desktop, mobile and vscode but not on the terminal. There is no progress bar,
    divider, icon, switch or disclosure element.
  - Colours: `Color` is a `ThemeKey` (`success`, `error`, `warning`, `claude`, `suggestion`,
    `inactive`, `subtle`, ...) or a raw string.
  - No `$` call names the change a session conducts.
- The app's tools, read from `/Applications/Claude.app` 4.23118.0 (`app.asar`):
  - `mcp__ccd_session_mgmt__list_sessions` takes `linked`, `include_archived`, `limit` and
    `group`. With `linked: true` it lists "this session's linked family: the session that started
    it, the sessions it or they started, and their own linked sessions", always without the
    current session. A linked row carries `name` and `startedBy` (the id of the session that
    started it).
  - `mcp__ccd_window__open_session_in` takes `{ session_id, target: "split" | "window" | "focus" }`
    and is "Layout only: nothing is sent to that session, and it keeps running either way". It
    accepts only `"self"` or a session this session started (`spawnedFrom`), and refuses
    otherwise with "Ask the user to open it from the sidebar". It is enabled only in an app
    session with the window-tools switch on, so the terminal surface may not list it.
- How a typed `/conduct <id>` is stored: the 2026-11-11 transcript of the session that conducted
  `release-rebase-pin` and `review-workflow` holds each run as a user message whose text is
  `<command-message>devkit-openspec:conduct</command-message>\n<command-name>/devkit-openspec:conduct</command-name>\n<command-args>release-rebase-pin</command-args>`.
  The same session conducted two changes, one after the other.
- The checkers stay the source of truth. `conduct-check --json --change <id>` (version 2,
  devkit-openspec 0.10.0 and later) gives one row (`next.step`, `next.actor`, `state`, `worktree`,
  `sessionPrefix`). It ran in 0.9 s on this change at the plan stage, with no `gh` call before
  delivery. `deliver-check <id> --json` (version 1) already carries `pr: { number, url }`,
  `phases: [{ n, title, open, gate: { id, done, command } }]` (its `readPhases`, the same reading
  of the `tasks.md` gates the checkers use) and `items[].details`. For item 6 the details are
  `{ required, failing: [{ name, link }], pending: [name] }`. The panel reads more of it and the
  checkers do not change.
- The npm Claude Code 2.1.227 was tried on 2026-11-11 against a copy of the pack in the
  scratchpad, with a private `CLAUDE_CONFIG_DIR`:
  - With `options` removed from `userConfig.language`, `plugin validate .` passes, but `plugin
    list` still shows the pack `failed to load` with `Hook load failed: ... "path": ["hooks"] ...
    expected record, received undefined`, because a `{ "modules": [...] }` hooks.json has no
    classic `hooks` record.
  - With `{ "hooks": {}, "modules": ["./register.tsx"] }` as well, the npm CLI validates the pack
    and lists it `enabled`. The bundled 2.1.317 validates it with the same module report, and its
    `plugin test` passed 59 of 59.
- Added for the revision, read in the engine-written
  `plugins/panel/.claude-plugin/types/claude-code/index.d.ts` (the 2.1.317 contract) on 2026-11-11:
  - There is no centred modal. `$.ui.open` takes `PaneOpenArgs`: `id`, `title`, `focus`,
    `closeOnEscape` and `holdToasts` ("a dialog"), `backgroundColor`, `rows`/`columns`. One pane
    per id: opening an open id retitles it. With two panes open the surface shows one and draws
    the other as a tab behind it, titled. An open made in a press handler is "asked" and is
    placed at any width. `closeOnEscape` closes the pane with origin `person` while it holds the
    keyboard; `focus` is refused while the composer holds text. `holdToasts` holds every toast
    while the pane is the one shown.
  - `$.ui.close({ id })` raises `ui.close` with an origin (`plugin`, `person`, `unload`).
  - `Code` (a leaf, `source`, `wrap: 'wrap' | 'truncate-end'`) and `Markdown` (a leaf, `text`;
    `https:`, `http:` and `file:` links drawn as links) are on every surface, as are `Link`
    (`href` of any scheme; a remote surface draws anything but `https:` as plain text) and
    `Box` with `overflow: 'hidden'`. `Text`'s `wrap` takes `truncate` (cut, no ellipsis).
    One drawing draws at most 100 000 characters.
  - `Text` takes `size` (`caption`, `footnote`, `body`, `heading`, `title`) and
    `backgroundColor`; a terminal draws `size` as plain text.
  - `$.ui.copy({ text, surface })` puts text on the clipboard of the surface the press came from
    (`{ isCopied }`; the terminal writes as `/copy` does; a remote surface has no path yet).
  - `$.ui.scroll({ to: { key }, in, block })` reveals an element the plugin drew in one of its
    panes, while it answers the person's own input.
- Seen in the live check's first round (requirements.md, Addendum): rules of `─` and the bar of
  `━`, sized by counting `bodyColumns` cells, were wider than the desktop pane: a rule wrapped
  into a full line and a short one, and the bar ran past the right edge and over its label. The
  desktop draws text in its own font, so a cell count is not a width there (D26).
- `deliver-check`'s items carry `details` beyond item 6 (`deliver-check.mjs`): item 1
  `{ unticked, missingGates, evidence }` (`missingGates` are the full gate commands), item 2
  `{ stale, rejected, missing }`, item 4 `{ ids, proven, missing, defects, noProof, evidence }`.
  A `blocked` next step carries `item: n`. The step ladder is linear: `conduct-check`'s planning
  steps (`create`/`new-change`/`worktree`, `grill`, `plan`, `readiness`, `approve`, then
  `wait-dependencies`/`rebase`/`audit`) and `deliver-check`'s `nextStep` order (phases, `commit`,
  review, `verify`, PR, checks, merge, retro, archive).

## Goals / Non-Goals

**Goals:**

- One glance tells the owner what this session is conducting, what happens next, who acts, how far
  it got and which child sessions are working. One more glance shows what else is open.
- Readable ("LEGÍVEL"): every row's state comes from a glyph and a few words; sentences only on an
  unfolded row.
- Still read-only by construction. The one new app call is a layout call, made on the owner's
  click.
- Revision: from the card alone the owner can tell what the change is, where its documents are,
  where it stands in the whole flow and who acts, what each section and button is, and read any
  long detail in a pane of its own, as the approved mock draws it (D8, D20 to D27).

**Non-Goals:**

- Choosing the change for the owner, or guessing it from the folder, branch or name of the
  session (requirements.md, Facts; ADR 0007, Alternatives: "Pick the change from the current
  branch").
- A `deliver-check` run for each change below the top card, or several top cards for a round.
- Any change to a checker, the conduct skill or `ship-change`.

## Decisions

### D1. No spec delta

The repository keeps no `openspec/specs/`, and every archived change set `skip_specs: true`. This
one does too (`.openspec.yaml`). The behaviour is pinned by `plugins/panel/hooks/*.test.tsx` and
documented in the pack's README and `docs/openspec-flow.md`.

### D2. Loading in both CLIs: a manifest and a hooks file both accept

- `plugins/panel/.claude-plugin/plugin.json`: `userConfig.language` loses `"options"` and keeps
  `type: "string"`, `title`, `default: "pt-BR"`, with the description `Language of the pane, band
  and toasts: pt-BR or en`. The module already validates the value: `langOf` maps anything but
  `en` to `pt-BR`, and a test pins that an unknown value draws pt-BR.
- `plugins/panel/hooks/hooks.json` becomes `{ "hooks": {}, "modules": ["./register.tsx"] }`. The
  npm CLI reads the empty classic record and loads nothing from it. The bundled engine loads the
  module as before. Without this second edit the npm CLI still lists the pack as failed (Context),
  so AC-10 `loads-in-both-clis` needs both edits.
- `types` stays. The npm CLI only warns about it (`Unknown field 'types'. Claude Code ignores it
  at load time.`), and `validate` exits 0.
- Proof: the npm binary's `plugin validate plugins/panel` and `plugin validate .` are gate parts
  (D16). The npm load itself is checked in task 1.1, with a private `CLAUDE_CONFIG_DIR` in the
  scratchpad: `plugin marketplace add <worktree>`, `plugin install devkit-panel@devkit --scope
  user`, then `plugin list` shows `enabled`. That check catches a failure early. The proof on
  record is `pr-verifier`'s own re-run of the same three commands, in its own scratch config
  folder, written to `evidence.md` (D19). The owner's `~/.claude` is never touched.

Alternatives: record a minimum Claude Code version in the README. Rejected: AC-10 requires
npm 2.1.227 to pass, and the pack would still show as failed in every npm session of the project.
Move `language` out of `userConfig` and into a slash-command argument. Rejected: it loses the
`/config` setting the owner uses, for no gain.

### D3. Which change this session conducts

Two signals, read in this order at every refresh. The first one that yields a change id wins.

1. **The newest conduct invocation in this session's own transcript** (`$.session.messages()`,
   newest first). Three forms count:
   - a user message holding `<command-name>/conduct</command-name>` or
     `<command-name>/<plugin>:conduct</command-name>` with `<command-args>ARGS</command-args>`
     (the form stored today, Context);
   - a user message whose first line is `/conduct ARGS` or `/<plugin>:conduct ARGS`;
   - an assistant `toolUses` entry with `tool: "Skill"`, `input.skill` matching `(^|:)conduct$`
     and `input.args` = ARGS (the owner asked in prose and the model ran the skill).

   Only the newest invocation is considered. When its ARGS is one change id
   (`^[A-Za-z0-9][\w.-]*$` and not `.`, `..` or `archive`, the checker's own `--change` rule),
   that id is the conducted change. Punctuation and quotes around it are trimmed first, as the
   conduct skill reads a typed `/conduct panel-conduct-view.` (fixed during the live check's first
   round; requirements.md, Addendum).
   When it is `round <n>`, empty, or anything else, this signal yields nothing and signal 2
   decides. An older single-id invocation is not used, because the owner has since moved on.
   A transcript compacted past the command, or a command older than the newest 4096 messages,
   leaves no invocation to read: signal 1 yields nothing and signal 2 decides. Compaction drops
   the oldest messages first, so a surviving invocation is never older than a dropped one.
2. **This session's own child sessions.** Read from the `list_sessions` family (D9). A row is this
   session's own child when its `startedBy` is set and is not the `sessionId` of any row in the
   family. The app leaves the current session out of the list, so the parent's id is the one
   `startedBy` that no row carries. That rule keeps a sibling of a child session, and the
   parent's own parent, out. Among the own children whose `name` matches `^<P>[0-9]+$`, where
   `P` is the stored prefix of a change in progress (below), the one active most recently wins
   (running first, then by `lastActivityAt`). Its change is the conducted change. This covers
   `/conduct round <n>`, a bare `/conduct` answered through the skill's question, a transcript
   compacted past the command, and a session older than the newest 4096 messages.

   **Where `P` comes from.** Only a checker row carries `sessionPrefix` (`conduct-check.mjs`,
   `addSessions`). The panel does not compute it. Signal 2 reads the `sessionPrefix` of each
   candidate's stored entry: `view.changes[id].row`, the row of the last run that fetched that id,
   whatever its trigger and age, kept in `$.state` (D7) so that it survives a closed pane and a
   hot reload. A run that fails for an id keeps that id's last good row, as 0.1.0 keeps its last
   good data, so its prefix stays usable.

   - **Every candidate has an entry after one run.** Session start is a full run and fetches every
     candidate (D5). A candidate with no stored entry (a folder or branch that appeared since, or
     a stored `view-2` that was declined) is fetched in the next run of any kind: light, full,
     pane open or closed, except during a rate-limit back-off, when it waits for the first run
     after it (D5). It is fetched once; afterwards the 5-minute rule of D5 applies. An id
     dropped as `archived` or as a branch that is not a change keeps an entry marked `dropped`
     (D7), so it is not fetched again on every light run.
   - **Order inside a run.** The candidates, `$.session.messages()` and `list_sessions` come
     first; then the fetch of the candidates without an entry; then D3 is resolved; then the
     conducted change's two checkers run. Signal 2 therefore never runs on a candidate list
     whose entries are still missing, except where a fetch failed.
   - **With no usable entry.** A candidate whose only fetch failed has no prefix and takes no part
     in signal 2. When signals 1 and 2 both yield nothing and the previous view's conducted id was
     found through children, is still a candidate, and lost signal 2 only because a fetch failed
     in this run, the previous conducted id is kept, with its `via`, until the next run. Otherwise
     the pane shows the "no change conducted" view.

   **A prefix two changes share.** `sessionPrefixes` cuts the id to 20 characters
   (trailing `-` dropped) and adds the hash suffix (`<id18><hh>-p`) only when two ids of the same
   run share that cut. The panel runs `--change` with one id, so two ids with the same
   20-character start (`checkout-discount-codes-a` and `checkout-discount-codes-b` both give
   `checkout-discount-co-p`) get the same prefix, and a child named `checkout-discount-co-p2`
   could belong to either. The rule: **a prefix carried by the stored rows of two or more
   candidates is ambiguous.**

   - Signal 2 ignores ambiguous prefixes: no candidate that carries one is found through
     children, and none of those children decides the conducted change.
   - When the conducted change comes from signal 1 and its prefix is ambiguous, its Sessions group
     (D8 item 8, `Sessões desta change`) lists no child and shows one dim line naming the other id(s) (D12, `shared
     session names with <id>`). The other change never claims those children.
   - Ambiguity is found by comparing stored `sessionPrefix` values, never by re-cutting ids, so
     the checker stays the only place that knows the naming rule.

   A round whose own run gave two of its ids the hashed form names those children
   `<id18><hh>-p<n>`. Their `--change` prefix is the plain cut, and it is ambiguous by the rule
   above, so signal 2 finds neither change through children. The pane then says "no change
   conducted" rather than pick a wrong change. This limit is stated in the README.

A conducted id whose checker row says `archived` is no longer conducted: the pane shows the
"no change conducted" view. A conducted id the checker does not know (exit 3, `no change <id>:`,
for example while `/conduct <id>` asks to create it) is drawn as the top card with its id and the
checker's line, and nothing else. The view records `via: "command" | "children"`, and the
`status` text names it, so the live check shows which signal fired.

Cost: `$.session.messages()` is an in-process read. Signal 2 reuses the `list_sessions` answer the
refresh fetches anyway and the stored rows. Neither calls `gh`. The only extra checker run is the
one-time fetch of a candidate that has no entry yet (D5).

Alternatives considered:

- The session's cwd or branch matched to a change worktree. Rejected: a phase child runs in the
  change's worktree too (ADR 0006, `use_worktree: false`), so every child's pane would claim the
  change. requirements.md (Facts) also says folder, branch and name do not name the change. This
  is ADR 0007's rejected "pick the change from the current branch".
- A `command.run` hook that watches `/conduct`. Rejected: it sees only commands typed after the
  module loaded (not a resumed session or a hot reload), and it would hook a command the panel does
  not own, as a gating hook in `plugin validate`'s report.
- `get_session("self")` to learn this session's app id for signal 2. Rejected: a second app tool
  and a second permission, where the family rule above needs neither.
- The panel computes the prefix itself (the 20-character cut, plus the hash for a collision).
  Rejected: it is a second copy of a checker rule, and the hash depends on which ids share a run,
  which the panel cannot know for a round it does not run.
- A prefix collision resolved by the most recent activity. Rejected: it shows one change's
  children on the other's card, which is the failure this rule exists to prevent.
- One card per change in a worktree (the owner's first grill answer). Replaced by the owner's later
  answer: one top card, the rest folded below.

### D4. The changes in progress, and ADR 0007's review trigger

The conduct skill's no-argument form, built in the panel:

- `git -C <root> worktree list --porcelain` through `$.process.run` (10 s timeout). If it fails,
  the root alone is used and its message is an error line.
- For every worktree path: `$.fs.list(<path>/openspec/changes)`, the folders minus `archive`.
- The branch of every worktree except the first one listed (the main checkout, whose branch is
  the base), when it matches `^[A-Za-z0-9][\w.-]*$`. This drops `claude/<name>`, `chore/<x>` and
  detached heads.
- De-duplicated, plus the id from D3 signal 1 when it is not already listed.
- Revised 2026-11-12 (live check, second round): a candidate whose id has an archived folder
  `openspec/changes/archive/<YYYY-MM-DD>-<id>`, in the root checkout or in the candidate's own
  worktree, is not an open change and is dropped here, before any checker runs. The live pane
  listed `conduct-rounds` (archived 2026-11-10; its local branch was left behind) as open. The
  archive folder names are read once per path per refresh with `$.fs.list` (no new call); the
  date prefix is matched as `^\d{4}-\d{2}-\d{2}-` and the rest is the id. A red-first test
  pins it, for an archived folder in the root and in the candidate's own worktree (AC-6
  `other-changes-collapsed`). This goes one step past the conduct skill's no-argument
  wording, which does not mention archived ids; the skill stays unchanged (requirements.md, Out
  of scope), the test that quotes its wording still holds, and the gap is a retro note.

Each candidate gets `node <checker>/conduct-check.mjs --json --change <id>` in the root, with
`DEVKIT_HOST=app` and a 60 s timeout:

- exit 0 with step `archived`: dropped (not in progress; its entry is kept, marked `dropped`, D3);
- exit 0 otherwise: a row;
- exit 3 for a branch-only candidate: dropped (a branch that is not a change; entry kept the same
  way);
- exit 3 for a folder candidate: a row with an error glyph, the checker's line shown when the row
  is unfolded.

Rows are ordered by who acts: the owner, then stopped, Claude, GitHub, then waiting; by id within
each group.

ADR 0007's review trigger names "a caller other than the skill (a panel) needs the checker to list
candidate changes". This design does not ask the checker to list anything. The panel lists
candidates from git and the folders, the way the skill's no-argument form says, and asks the
checker only about ids it already has. So the trigger is approached but not fired, and no ADR
changes. The price is a second copy of the listing rule, pinned by a test that quotes the skill's
wording. Adding `conduct-check --list` was rejected: it fires the trigger and needs a
devkit-openspec release, which requirements.md asks to avoid unless a checker must change.

### D5. Refresh cadence and what it costs

Triggers are as in 0.1.0: session start, pane open, `Refresh`, the 60 s timer while the pane is
open, and the end of each main-loop turn. One run at a time. A full trigger (session start, pane
open, `Refresh`) that arrives during a light run queues one full run after it. Any other trigger
folds into the run in flight.

| Work per refresh | Light (timer, turn end) | Full (start, pane open, `Refresh`) | `gh` calls |
|---|---|---|---|
| `git worktree list` and the folder listings | yes | yes | 0 |
| `$.session.messages()` | yes | yes | 0 |
| `list_sessions` (when its check is `allow`) | yes | yes | 0 |
| `conduct-check --change` for a candidate with no stored entry (D3) | yes, once per such candidate, pane open or closed | yes | 0 to 6 each, once |
| `conduct-check --change` for the conducted change | yes | yes | 0 before delivery; about 3 to 6 once it has a PR (its in-process deliver-check reads the PR, its checks and its conversation) |
| `deliver-check <id> --json` for the conducted change, in its worktree | yes | yes | about 1 before a PR, 3 to 6 with one |
| `conduct-check --change` for every other change in progress | only when its row is older than 5 min, and only while the pane is open | yes | 0 to 6 each |

At most three checker runs at once. A typical case is a conducted change with a PR plus three
other changes in delivery, with the pane open:

- every 60 s: 2 runs, about 6 to 12 `gh` calls;
- every 5 min: 3 more runs, about 9 to 18 calls;
- about 500 to 900 `gh` calls an hour, against GitHub's 5000 an hour for an authenticated user.

With the pane closed, only the turn-end refresh runs. It runs the conducted change's two checkers,
plus the one-time fetch of any candidate with no stored entry (D3), and nothing else: the band
needs nothing more. Its in-progress count comes from the listing alone. Signal 2 works the same
with the pane closed, because it reads the stored rows (D3).

**A rate-limited `gh`.** A checker run whose exit-3 line or stderr, or one of whose delivery item
reasons, matches `/rate limit/i` (GitHub's `API rate limit exceeded`, `secondary rate limit`, and
`gh`'s `GraphQL: rate limited`, which `deliver-check` already reports as an item reason) sets
`view.backoffUntil` to now plus 15 minutes. Until then:

- a light trigger, pane open or closed, runs no checker: the D3 resolution still runs on the
  stored rows, and the last good data stays with its age;
- a full trigger runs only the conducted change's two checkers. A new rate-limit match during
  back-off restarts the 15 minutes;
- no candidate is fetched, on any trigger, including a candidate with no stored entry (D3): that
  candidate takes no part in signal 2 until the first run after `backoffUntil` fetches it.
  Signal 1 is unaffected, because it reads only the transcript;
- one `!` line says `GitHub rate limit: checks paused until <hh:mm>` (D12), and the footer's
  `next in` is replaced by that time.

The first light trigger after `backoffUntil` runs as usual. Nothing retries inside a run. The 15
minutes are a fixed value, a quarter of GitHub's hourly window: the panel does not read the reset
time.

Alternatives: no throttle, every change on every trigger. Rejected because it multiplies the cost
by the number of changes in progress. A longer timer was also rejected: the top card is the one
the owner watches. For the back-off, reading `gh api rate_limit` before each run was rejected: it
is one more `gh` call per run, made to save calls.

### D6. The roadmap round view is removed, and with it `Archived` and the probe

- **Round view: removed.** The pane no longer runs `conduct-check --json` in round mode, and
  draws no round line, no round counts and no round rows. ADR 0007 makes `/conduct <id>` the way
  a change is conducted, runs the round sweep only on an explicit `round <n>`, and keeps the
  roadmap a report ("ordering between changes is the owner's ... the roadmap stays a report, as
  ADR 0001 wanted"). A round change that has started has a worktree or a folder, so it is already
  in "in progress" (D4). A round change that has not started is a roadmap line, which the
  roadmap shows. A `/conduct round <n>` session still gets its top card through D3 signal 2.
  Removing the view also saves one checker run per refresh, which with `--change` would cover
  every round change, `gh` included.
  - Keeping it as a folded section was rejected: it costs that run and draws a change twice, and
    on the owner's reading it is the reason "the pane showed another change than the one in
    work" (devkit-panel retro, Dogfood).
  - Folding it into "in progress" was rejected: it would list not-started changes with a
    `Conduct` button, a sweep in all but name.
- **`Archived` group: removed.** It is not "in progress", and it only lengthens the pane.
- **`--change` probe: removed.** Every run now uses `--change`. The installed checker's version
  comes from `installed_plugins.json` (`locateChecker`'s label). Below `0.10.0` the pane is one
  line (`old-checker`) naming `devkit-openspec 0.10.0`. The repository's own checker
  (label `repo`) is always new enough. An unreadable version string counts as new: the first
  `--change` run's error line then shows the real reason. This closes the devkit-panel retro's
  row 6 (a full checker run once per session for the probe) on the panel's side. `Conduct`
  always fills `/conduct <id>`.

### D7. The view model and state (`plugins/panel/types/index.d.ts`) (Revised)

Revised: the conducted change gains its folder, repository, summary, documents, approval date
and tasks (D23, D27); every change entry gains its tasks' progress (D27); `DeliverItem.details`
is read for items 1, 2, 4 and 6 (D21); the fold keys `delivery`, `next`, `item:<n>`, `change:<id>`
and `sessions` go (the mock has no such folds; the detail pane replaces them, D20), and `archived`
comes (D8 item 8); a `detail` atom holds the detail pane's subject; the view's shape tag becomes
`view-4`. The bullets below are the revised text.

- `DeliverReport` gains `pr?: { number: number; url: string }` and `phases: Phase[]`, with
  `Phase = { n, title, open: string[], gate: { id: string; done: boolean } | null }`.
  `DeliverItem` gains `details?: { unticked?: string[]; missingGates?: string[]; evidence?: string;
  missing?: string[]; rejected?: string[]; stale?: string[]; defects?: string[]; noProof?: string[];
  failing?: { name: string }[]; pending?: string[] }`, each field read only when it has the
  expected type. Parsed as tolerantly as today: a missing field is empty, and a newer `version` is
  the error line (`READ_VERSION` unchanged: 2 and 1).
- `ChangeEntry = { id; row?: ChangeRow; error?: string; checkedAt: number; source: 'folder' |
  'branch' | 'command'; dropped?: 'archived' | 'not-a-change' }`. `row` is the last good row: a
  failed run sets `error` and keeps `row`, so its `sessionPrefix` stays readable for D3 signal 2.
  A `dropped` entry is not in `inProgress`.
- `PanelView = { kind: 'not-devkit' | 'no-checker' | 'old-checker' | 'report'; checker?;
  conducted?: { id; via: 'command' | 'children'; sharedWith?: id[]; deliver?: DeliverReport |
  { error }; folder: string; repo: string; summary?: string; docs: { file: string; path:
  string }[]; approvedOn?: string; tasks?: TaskSections }; changes: Record<id, ChangeEntry>;
  progress: Record<id, { done: number; total: number }>; inProgress: id[] (ordered, the conducted id
  excluded); sessions: SessionRow[] (the family); canOpen: boolean; permission?; listError?;
  error?; refreshedAt?; nextAt?; backoffUntil?: number }`. `sharedWith` holds the other ids
  whose stored prefix equals the conducted change's (D3, a prefix two changes share). `RoundReport` is kept as the parse target of `--change` (the same
  version 2 shape). `others`, `archived`, `delivers` and `changeOption` go.
- `$.state`: `view` with shape tag `view-4`, so a stored `view-3` (the build loaded for the first
  live round) or `view-2` is declined; `collapsed` (fold keys `in-progress`, `more`, `archived`);
  `isRefreshing`; `filled: { key: string; text: string } | null` (D10); `detail: { subject:
  DetailSubject; full: boolean; copied: boolean } | null` with shape tag `detail-1` (D20). A fold
  the owner never touched takes its default: `in-progress` is folded while a change is conducted
  and open otherwise, `archived` and `more` are folded.
- `DetailSubject = { kind: 'pending'; section?: number } | { kind: 'step'; key: string } | {
  kind: 'doc'; file: string } | { kind: 'change'; id: string } | { kind: 'error'; key: string }`.
- `TaskSections` is `readTasks`' answer (D27).

### D8. The layout: the approved mock, mapped to the mod's elements (Revised)

Revised after the live check's first round. The binding reference is the mock the owner approved
(`Está bom assim`): `openspec/changes/panel-conduct-view/mock/`, six screens drawn in Claude Design
(`canvas.json` names them; online at https://claude.ai/artifact/Ny74Rnib1qd8eaFc8hWF96). Its example
data is a change of another repository (`controlid-settings` in psim-kernel); the texts it shows
for that data are illustrations, the structure and the fixed texts are binding. The mock's own
note says it uses only what a mod draws (text, glyphs, buttons, links) and that the detail is a
second pane closed with Escape, because a mod cannot open a centred modal.

This replaces the 0.2.0 layout as built: the `CONDUZIDA NESTA SESSÃO` / `Em andamento` sections,
the segmented phase bar, the foldable next-step row, the Delivery group, and the in-place unfold
of long reasons. The pt-BR texts below are the mock's; the en texts are in D12.

**Screen 1, the main pane while a change is conducted** (`Main.dc.html`), top to bottom:

1. **Header**: `devkit` (`Text weight="semibold"`) and, on the right, `↻ Atualizar` (`Button
   plain`, full refresh).
2. **Rule** (D26).
3. **The change** (AC-1, AC-15, AC-17): `Esta conversa conduz` (`Text size="caption" dimColor`);
   the id (`Text size="heading" weight="semibold"`); the summary (D23, `Text wrap="wrap"`); then
   `<repository> · branch <branch>` (`Text size="caption" dimColor`; the repository is the last
   path segment of the main checkout, the first `git worktree list` entry; the branch is the
   row's `branch`).
4. **Agora** (AC-19 `now-box`, D24): a `Box borderStyle="round" borderDimColor paddingX={1}`
   holding: `Agora` (caption, dim) with, on the right, the actor pill
   (`Text backgroundColor="claude" color="inverseText"` around `você age`, padded with a space
   each side, D24); the current step in a few words,
   semibold (D22, D12); one dim line saying what is left and what comes after (`Faltam 4 tarefas
   nesta fase. Depois: revisão, provas, PR e checks.`); then `Continuar aqui` (`Button`) with the
   dim hint `põe /conduct <id> na caixa`, plus `Aprovar plano` or `Responder retro` when the step
   asks for them (D24).
5. **Passos** (AC-14, AC-2, D22): `Passos` (semibold) with `k de 10` on the right (caption,
   dim); ten rows, each a glyph (`✓` `success`, `◐` `warning`, `●` `claude`, `○` `inactive`),
   the step name (the current one semibold, a pending one dim) and a few words of fact on the
   right (caption, dim), the steps with a detail ending in ` ›`. Each step's name is a `Button
   plain` that opens its detail (D20).
6. **Rule**, then **Pendências** (AC-20 `pending-list`, D27): `Pendências` with the count; one row
   per open task (`◐`, the id and a short title, a short tag on the right in `warning`), at most
   six, then `+N`; each row a press that opens the pending detail (screen 2). With no open task,
   the current step's pending things (D21). With none at all, the section is not drawn.
7. **Rule**, then **Documentos** (AC-15, D23): `Documentos`; a `Box flexDirection="row"
   flexWrap="wrap" columnGap={2}` of `Button plain` labels `Proposta`, `Design`, `Tarefas`,
   `Specs`, `Provas`, each drawn only when its file exists; a press opens the document pane
   (screen 5).
8. **Rule**, then **Sessões desta change** (AC-5, D9): the heading with the count of every child;
   one row per child that is not archived: glyph (`●` running, `○` idle or stopped), `Fase n ·
   <phase title>` (D27), and the state word plus ` ›` on the right; the name is the `open:`
   press of D9 when `canOpen`. The archived ones are one folded row, `› 14 arquivadas` (fold key
   `archived`), unfolding to their rows with `✓` `subtle`. The permission line, the list error and
   the shared-prefix line of D3 are drawn here as before.
9. **Rule**, then **Outras changes abertas** (AC-6): one dim chevron row, `› Outras changes
   abertas` with the count, folded by default (fold key `in-progress`), and under it one dimmed
   caption line, `independentes desta conversa; nenhuma precisa terminar antes` (D12, added
   2026-11-12), drawn folded or not; unfolded, the rows of screen 3.
10. **Footer**: `Atualizado há 6 s · próxima em 54 s` (caption, dim); `atualizando...` during a
    run; during a rate-limit back-off the pause time replaces the next tick (D5). The checker
    label leaves the pane and stays in the status text.

The errors (a checker run that failed, `git worktree list`, `deliver-check`) are one `!` line
each under the header, `warning` colour, cut with `truncate-end`; a press opens the line in the
detail pane (D20).

**Screen 3, no conducted change** (`Empty.dc.html`, AC-7): the header and rule; `Nenhuma change
nesta conversa` (`size="heading"`, semibold); the dim sentence of D12's screen 3 row; `Changes abertas em
<repository>` with the count; one row per open change: the id, under it its progress in a few
words (dim, D27: `103 de 107 tarefas · espera bancada`, `plano pronto · 0 de 25`), and `Conduzir`
on the right (`/conduct <id>`); the six-rows-then-`mostrar mais (n)` rule (fold key `more`); the
footer.

**Screen 4, the band** (`Band.dc.html`, AC-9, D11): one line: the actor glyph, the id, then dim
` · <current step, its fact> · <what is left> · <actor phrase>`
(`· revisão, rodada 2 · espera a bancada · você age` in the mock), cut to fit, and `Abrir painel` /
`Fechar painel` on the right.

Screens 2, 5 and 6 are the detail pane's (D20).

**Mapping, and what the mod cannot draw**:

| The mock draws | Drawn with | Substitute, when the mod cannot |
|---|---|---|
| Section rules (1 px lines) | A clipped `─` rule (D26) | A hairline: a dim `─` rule |
| Font sizes (17 px id, 12 px captions) | `Text size="heading"` / `size="caption"` | The terminal ignores `size`: semibold and dim carry it there |
| The tinted, rounded `Agora` box | `Box backgroundColor="#F6F5F2"`, no border (`Box` supports `backgroundColor`) | No radius: a square-cornered tint |
| The `você age` pill | `Text backgroundColor="#B0502C" color="#FFFFFF"` with a space each side | No radius: a square-cornered chip |
| The current step's tinted row | `Box backgroundColor="#FBF1EC"` with the `●` in `#B0502C` and a semibold name | No radius: a square-cornered tint |
| `✓ ◐ ● ○ ›` glyphs and their colours | The same Unicode glyphs, coloured by theme keys | None needed |
| Links (`Proposta`, `Ver tarefas.md`, step rows) | `Button plain` (a press opens a pane) | No underline colour control |
| `Abrir no editor ↗` | `Link href="file://<path>"` (D23) | What the surface does with `file:` is the surface's |
| `↻ Atualizar`, `Continuar aqui`, `Conduzir`, `Copiar` | `Button` (`plain` where the mock has no frame) | |
| The `✕` close mark | `Button plain` labelled `✕` (D20) | |
| The glyph progress bar (screen 6) | Two `Text` runs of `━` (`success`, `inactive`) in a clipped Box (D26) | |
| Scrolling a long document | The pane's own engine-owned scroll | |
| Classification chips (screen 5) | Not drawn: that repository's proposal format; this repository's header line is drawn as written in the markdown | |

Glyphs and colours (theme keys only):

| What | Glyph · colour |
|---|---|
| Step done / partly done / current / pending | `✓` · `success` / `◐` · `warning` / `●` · `claude` / `○` · `inactive` |
| Who acts (band, head): Claude / the owner or an owner-run phase (D25) / GitHub / stopped / nobody | `●` · `claude` / `◐` · `warning` / `◐` · `suggestion` / `✕` · `error` / `○` · `inactive` |
| Pending task or thing | `◐` · `warning`, its tag `warning` |
| Child session running / idle or stopped / archived | `●` · `claude` / `○` · `inactive` / `✓` · `subtle` |
| PR checks green / red / running / unreadable (the `PR e checks` fact) | `✓` · `success` / `✕` · `error` / `●` · `claude` / `!` · `warning` |
| Fold | `›` folded (the mock), `▾` unfolded (not in the mock) |

### D9. Child sessions: read, and opened on a click

- **Read**: `list_sessions` with `{ linked: true, include_archived: true, limit: 100 }`, so that
  archived children are listed (0.1.0 asked without `include_archived` and never saw one). It is
  read only when `tool.list` lists the tool and `tool.check` with `{ tool, input }` answers
  `allow`, as in 0.1.0. With `ask` or `deny` the sessions group shows one line naming the tool,
  and no dialog opens from any refresh. A refused or failed call is the error line (0.1.0's D7,
  unchanged).
- **Open** (AC-5 `child-sessions-with-icons`, the click): the app's
  `mcp__ccd_window__open_session_in`, the only tool that shows a session.
  - **When**: only in the press handler of a session row, never from a refresh, a timer or a
    render. `canOpen` comes from `tool.list` at refresh: a name check, no dialog.
  - **Which target**: `{ session_id: row.sessionId, target: "split" }`, which shows the child
    beside the conducting session so the pane stays visible. When the app's answer is an error
    (no room for a split, no split view in this window, or this session showing only in a
    pop-out), the handler calls once more with `target: "window"`.
  - **Permission**:
    1. `tool.list` lacks the tool (the terminal, or the app's window-tools switch off): the
       localized toast "open it from the sidebar", and no call.
    2. `tool.check` answers `deny`: a toast naming the tool to allow, and no call.
    3. `allow`, or `ask`: `$.tool.call`. With `ask` the engine opens its permission dialog. That
       dialog follows the owner's own click, not a timer, so the owner answers it.
    4. A `{ deny }` answer or a rejection: one toast, and no retry.
  - **Errors**: the app's error text is toasted. For example, the app refuses a session that this
    session did not start ("not started from this session").
- **Within ADR 0001.** ADR 0001 rules out "starting or driving sessions or the app from outside"
  and any harness:
  - `open_session_in` sends nothing to the session, starts, stops and archives nothing, and only
    arranges the window of the session the owner is looking at, as the app's own description
    says.
  - The call is made inside that session, on the owner's own press. No state is kept outside
    the repository, GitHub and the app's own list of sessions (ADR 0006 point 4).
  - It is a view action, like clicking the session in the sidebar. No ADR is added or changed.
- The "one session tool the panel ever calls" sentence in `sessions.ts` and the README becomes:
  the panel calls two app tools, `list_sessions` (read) and `open_session_in` (layout, on a
  click); it never calls `start_session`, `stop_session`, `archive_session`, `send_message` or
  any other session tool.

### D10. Buttons visibly fill (AC-8 `buttons-visibly-fill`) (Revised)

Revised: in 0.2.0 as built, the button's label became the sentence (`no prompt, pressione Enter`,
itself shorter than AC-8's text), and on a 46-column row it pushed the step text out to `g...`
(requirements.md, Addendum). The label now keeps its width.

The fill stays `$.prompt.fill({ text, mode: 'replace' })`, never a submit.

- **Before a press**: `Continuar aqui` has its dim hint `põe /conduct <id> na caixa` beside it
  (screen 1); `Conduzir` has none (screen 3's sentence says what it does).
- **When it fills** (`isFilled: true`): the handler sets `filled = { key, text }` and toasts the
  localized "click the prompt box and press Enter" (`clique na caixa de texto e aperte Enter`). While `filled.key` is that
  button's key, the button's label is `✓ ` plus its own label, and the hint beside `Continuar
  aqui`, or one dim line under a `Conduzir` row, reads the same sentence (D26).
- **A press inside the detail pane** (D20): the fill runs, then the detail pane closes, then the
  toast is raised, because a pane opened with `holdToasts` holds every toast while it is shown.
- **When it does not** (`isFilled: false`): the command itself is toasted, as in 0.1.0, and
  `filled` is not set.
- **When the mark goes**: at the end of the next main-loop turn (the owner pressed Enter), on
  another button's fill, and at any refresh where `$.prompt.read().text` no longer equals
  `filled.text` (the owner cleared or edited the box).

`$.prompt.read` is a read and opens nothing. No `clock.after` is needed: the existing triggers
clear the mark.

### D11. The band (AC-9 `band-shows-conducted-change`) (Revised)

- **With a conducted change** (revised to the mock's screen 4): the actor glyph (D8), the id, then
  dim ` · <current step, lower case>, <its fact> · <what is left> · <actor phrase>`
  (`· revisão, rodada 2 · espera a bancada · você age` in the mock; for this change
  `· implementação, 40 de 52 tarefas · faltam 9 · Claude age`), cut to fit, and `Abrir painel` / `Fechar painel`. The actor is read
  through D25.
- **Fechar painel** closes the detail pane too (D20).
- **Without one**: `devkit · <k> changes abertas`, or `devkit · nenhuma change aberta`.
- **The engine's own band** (`next(e)`) is used under a survey, outside a devkit project, and
  before the first report, as in 0.1.0.
- `/devkit-panel`, `/devkit-panel status` and `mcp__devkit-panel__status` keep their contract.
  The status text is the pane's lines with every fold open, plus `via: command | children`.

### D12. Texts and language (Revised)

`i18n.ts` keeps one `UiText` per language, with the same keys (a test pins it). The pt-BR texts
are the default; en is selected by `language: "en"`. Revised: the pt-BR texts are the approved
mock's, screen by screen (D8); the en texts are their translation. A test named for AC-17 pins
every row of this table in both languages.

| Screen · key | pt-BR (the mock) | en |
|---|---|---|
| 1 · header | `devkit`, `↻ Atualizar` | `devkit`, `↻ Refresh` |
| 1 · top caption | `Esta conversa conduz` | `This conversation conducts` |
| 1 · repository line | `<repo> · branch <branch>` | `<repo> · branch <branch>` |
| 1 · now box | `Agora` | `Now` |
| 1 · actor pill | `você age`, `Claude age`, `GitHub age`, `parada`, `esperando` | `you act`, `Claude acts`, `GitHub acts`, `stopped`, `waiting` |
| 1 · now lines | `Faltam <k> tarefas nesta fase.`, `Depois: <steps>.` | `<k> tasks left in this phase.`, `Then: <steps>.` |
| 1 · buttons | `Continuar aqui`, `Aprovar plano`, `Responder retro` | `Continue here`, `Approve plan`, `Answer retro` |
| 1 · hint | `põe /conduct <id> na caixa` | `puts /conduct <id> in the box` |
| 1 · steps | `Passos`, `<k> de 10` | `Steps`, `<k> of 10` |
| 1 · step names | `Requisitos`, `Plano`, `Prontidão`, `Sua aprovação`, `Implementação`, `Revisão`, `Provas`, `PR e checks`, `Merge`, `Retro e arquivo` | `Requirements`, `Plan`, `Readiness`, `Your approval`, `Implementation`, `Review`, `Proofs`, `PR and checks`, `Merge`, `Retro and archive` |
| 1 · step facts | `<n> critérios`, `<n> seções`, `aprovada`, `a revisar`, `bloqueada`, `<k> de <n> tarefas ›`, `rodada <n>`, `<k> de <n> critérios`, `PR #<n> · <checks>` | `<n> criteria`, `<n> sections`, `approved`, `to revise`, `blocked`, `<k> of <n> tasks ›`, `round <n>`, `<k> of <n> criteria`, `PR #<n> · <checks>` |
| 1 · pending | `Pendências`, tags `você`, `Claude`, `gate`, `+<n>` | `Pending`, tags `you`, `Claude`, `gate`, `+<n>` |
| 1 · documents | `Documentos`: `Proposta`, `Design`, `Tarefas`, `Specs`, `Provas` | `Documents`: `Proposal`, `Design`, `Tasks`, `Specs`, `Proofs` |
| 1 · sessions | `Sessões desta change`, `Fase <n> · <title>`, `executando`, `ociosa`, `<n> arquivadas` | `Sessions of this change`, `Phase <n> · <title>`, `running`, `idle`, `<n> archived` |
| 1 · other changes | `Outras changes abertas`; hint (dimmed, under the heading, added 2026-11-12) `independentes desta conversa; nenhuma precisa terminar antes` | `Other open changes`; hint `independent of this conversation; none has to finish first` |
| 1, 3 · footer | `Atualizado há <s> s · próxima em <s> s`, `atualizando...`, `pausado até <hh:mm>` | `Updated <s> s ago · next in <s> s`, `refreshing...`, `paused until <hh:mm>` |
| 2 · pending detail | `Pendências`, `<id> · <k> de <n> tarefas`, `Todas esperam <who>`, `<k> pendências`, `Quem age: <actor>.`, `Seção <n> · <title>`, `› Texto completo das tarefas`, `Copiar`, `✓ Copiado`, `Esc fecha e volta ao painel` | `Pending`, `<id> · <k> of <n> tasks`, `All wait on <who>`, `<k> pending`, `Who acts: <actor>.`, `Section <n> · <title>`, `› Full text of the tasks`, `Copy`, `✓ Copied`, `Esc closes and returns to the panel` |
| 3 · empty | `Nenhuma change nesta conversa`, `Escolha uma abaixo para conduzir aqui. O botão põe o comando na caixa de texto; você aperta Enter.`, `Changes abertas em <repo>`, `Conduzir`, `plano pronto · 0 de <n>`, `mostrar mais (<n>)` | `No change in this conversation`, `Pick one below to conduct here. The button puts the command in the text box; you press Enter.`, `Open changes in <repo>`, `Conduct`, `plan ready · 0 of <n>`, `show more (<n>)` |
| 4 · band | `Abrir painel`, `Fechar painel`, `<k> changes abertas`, `nenhuma change aberta` | `Open panel`, `Close panel`, `<k> open changes`, `no open change` |
| 5 · document | `Seções`, `Abrir no editor ↗`, `Esc fecha`, tabs `Requisitos`, `Proposta`, `Design`, `Tarefas`, `Specs`, `Prontidão`, `Aprovação`, `Provas` | `Sections`, `Open in editor ↗`, `Esc closes`, tabs `Requirements`, `Proposal`, `Design`, `Tasks`, `Specs`, `Readiness`, `Approval`, `Proofs` |
| 6 · step | `<k> de <n> tarefas`, `<p>%`, `Faltam`, `<k> seções · <m> tarefas`, `Feitas`, `<k> seções`, `Ver tarefas.md`, `Esc fecha` | `<k> of <n> tasks`, `<p>%`, `Missing`, `<k> sections · <m> tasks`, `Done`, `<k> sections`, `See tasks.md`, `Esc closes` |
| filled | `✓ <label>`; toast and hint `clique na caixa de texto e aperte Enter` | `✓ <label>`; toast and hint `click the prompt box and press Enter` |
| short-list words (D21) | `aberta`, `sem prova`, `ausente`, `desatualizada`, `rejeitada`, `falhou`, `rodando`, `o dono decide` | `open`, `no proof`, `missing`, `stale`, `rejected`, `failing`, `running`, `owner weighs` |
| detail, other | `nada pendente`, `não está mais aberta`, `planeja e executa aqui, com sessões filhas` | `nothing pending`, `no longer open`, `plans and runs it here, with child sessions` |
| step details (D22) | `Ver <file>`, `sem aprovação ainda`, `sem PR ainda`, `feito`, `› Texto completo`, month names `jan` to `dez` | `See <file>`, `no approval yet`, `no PR yet`, `done`, `› Full text`, month names `Jan` to `Dec` |
| kept from 0.2.0 | `abra pela barra lateral`, `requer devkit-openspec 0.10.0 ou mais novo`, `nomes de sessão compartilhados com <id>`, `limite do GitHub: checagens pausadas até <hh:mm>` | `open it from the sidebar`, `needs devkit-openspec 0.10.0 or newer`, `shared session names with <id>`, `GitHub rate limit: checks paused until <hh:mm>` |

Step short labels cover the steps `conduct-check`'s `actorOf` names, each at most four words
(`implement` → `implementar fase n` / `implement phase n`, `gate` → `gate da fase n` /
`gate of phase n`, `stop-plan-approval` → `aprovar o plano` / `approve the plan`, `wait-checks` →
`aguardando CI` / `waiting for CI`, ...). Any other step shows its raw id. The delivery item names
follow `deliver-check`'s eight `name`s (`tasks`, `reviews`, `findings`, `acceptance`, `pr`,
`checks`, `conversation`, `body`). The fill texts are unchanged except `Conduct`, which is always
`/conduct <id>`. The step short labels stay: the Agora box and the band use them for the current
step's few words (D22).

### D13. Read-only kept (AC-11 `read-only-kept`) (Revised)

Revised: the detail pane (D20) and the change folder's files (D23, D27) add uses of calls the
module already makes (`$.ui.open`, `$.ui.close`, `$.fs.read`, `$.fs.exists`, `$.fs.list`, already
on the 0.2.0 build's `calls:` line), one observer hook, and two calls new to the module, both on
an owner's press inside the detail pane only:

- `$.ui.scroll`, the section index of screen 5: it moves the pane's own view;
- `$.ui.copy`, screen 2's `Copiar`: it puts the open tasks' text on the clipboard of the surface
  the press came from, as the approved mock asks. It is the same kind of act as `prompt.fill`
  (text handed to the owner, who decides what to do with it): it sends, submits, starts and
  writes no file, so the read-only list of AC-11 is unchanged. The README's "What it never does"
  names it.

Nothing new starts, submits or writes a file.

The module's `$` calls after this change:

- `process.run`: `node` for the two checkers, `git worktree list`;
- `fs.exists/read/list`, `env.get` (revised: also the change folder's documents and
  `proposal.md`'s summary, D23);
- `session.root`, `session.messages`;
- `tool.list`, `tool.check`, `tool.call`: `list_sessions`, and `open_session_in` on a press;
- `tool.register`, `command.register`;
- `prompt.fill`, `prompt.read`;
- `ui.*`, `clock.every`, `clock.now`, `state` (revised: `ui.open` and `ui.close` of the detail
  pane on a press only, and the main pane's close; `ui.scroll` and `ui.copy` on a press in it; an
  `on('ui.close', { id: DETAIL })` observer that clears the subject and always passes `next(e)`).

No `prompt.submit`, `fs.write`, `store`, `clock.after` or `session.send`. Every `$.tool.call`
goes through one helper that takes only those two names, so a third tool cannot be called by
mistake. Two tests pin this:

- a scripted run (session start, every trigger, every button, a child click, the band; revised:
  plus the pending list, a step, a change row, an error line and a document opened in the detail
  pane, its full-text fold, `Copiar`, a section index press, a tab press, a fill from inside it,
  and its close) records every `tool.call`
  name, every `prompt.submit` and every `session.send`, and asserts the names are a subset of the
  two tools and that there is no submit and no send;
- the bundled `plugin validate plugins/panel` report's `calls:` line, read at each code phase by
  the implementer before it ends the phase (a failure there is its `Outcome: failure`), and
  re-run by `pr-verifier`, which records the line in `evidence.md` (D19).

### D14. Tests (`claude plugin test plugins/panel`, kit `claude-code/testing`) (Revised)

- `world` keeps its in-memory disk and engine, and gains mocks for:
  - `process.run` by argv: `git ... worktree list --porcelain`, `conduct-check --change <id>` per
    id, `deliver-check <id>`;
  - `session.messages` (`on('session.messages', () => ({ value: rows }))`);
  - `prompt.read`;
  - `open_session_in` in `tool.list` / `tool.check` / `tool.call`, with its own permission.

  Every acceptance test mounts the pane (and the band where it applies) on
  `['terminal', 'desktop'] as const` and asserts the mounted tree's text and the recorded calls.
  Its name starts with the criterion's id and slug (`AC-1 conducted-change-on-top: ...`), as
  0.1.0's tests started with `AC-2: ...`, so the evidence row and the test agree (D19).
  One test mounts `mobile` to show the tree still draws there (0.1.0 had one).
- Fixtures, each with a capture line as in 0.1.0:
  - `fixtures/change.ts`: real `conduct-check --json --change <id>` stdout from this repository,
    at a delivery step;
  - `fixtures/deliver.ts`: re-captured with `phases`, `pr` and item 6's `details` kept;
  - `fixtures/worktrees.ts`: real `git worktree list --porcelain`;
  - `fixtures/messages.ts`: the transcript row of a typed `/devkit-openspec:conduct <id>` quoted in
    Context, plus the plain-text and `Skill` tool-use forms;
  - `fixtures/sessions.ts`: `list_sessions` rows with `name`, `startedBy` and `isArchived`.

  `fixtures/round.ts` is removed with the round view. `fixtures/change-option.ts` stays only if a
  test still uses it.
- `report.test.tsx` keeps the pure parsers: the deliver phases, PR and checks; the worktree
  listing; the three transcript forms; the own-children rule; the stored-prefix rule and the
  ambiguous prefix (two ids with the same 20-character start); the rate-limit match; the glyph
  and actor maps; the step labels; `langOf` on an unknown value.
- Revised, for the live check's first round and the approved mock (tasks.md phase 4):
  - `fixtures/deliver-open.ts`: real `deliver-check panel-conduct-view --json` stdout captured at
    phase 4, whose item 1 carries the ten full gate commands with `$HOME` paths, the stdout the
    owner saw as a paragraph;
  - `fixtures/tasks.ts`: this change's `tasks.md` as captured with it, and the `phases` that
    `deliver-check` reported for that same file (D27's agreement test);
  - `fixtures/change.ts` gains three rows derived from the captured one, each with a line saying
    what was changed: a planning-stage row (`next.step` `readiness`), a mid-implementation row
    (`implement`, phase 2 of 3) and a delivery-stage row (`wait-checks`, with a PR), with matching
    deliver reports and `tasks.md` texts;
  - `report.test.tsx`: the command labels and short lists (D21); the ten steps for the three rows,
    `fix-review`, `blocked` with `item`, no `tasks.md`, and every id of the step table placed (D22);
    `readTasks` and its agreement with `deliver-check`'s phases, short titles, sentences, tags
    and the other changes' progress phrases (D27); the summary source (D23); the owner-run
    reading (D25); every text of D12's table in both languages (AC-17);
  - `panel.test.tsx`, on `['terminal', 'desktop'] as const`, one test per screen, each named for
    its criterion: screen 1's sections in order (the change, Agora, Passos, Pendências,
    Documentos, Sessões desta change, Outras changes abertas, footer); screen 2 opened from a
    pending row; screen 3 with no conducted change; screen 4's band; screen 5 from `Design`, with
    its tabs, section index and markdown read from the in-memory disk; screen 6 from
    `Implementação`; the detail pane's open arguments, one id, refresh and close (D20); the
    clipped rules and bar and the text form's widths (D26); the filled mark (D10). One `mobile`
    mount draws screens 1 and 2.

### D15. Release files, docs, versions (Revised)

- devkit-panel 0.1.0 → 0.2.0 (minor: new behaviour, the round view removed) in
  `plugins/panel/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
- Marketplace `metadata.version` 0.13.0 → 0.14.0, and `CHANGELOG.md` `## 0.14.0 — panel: the
  conducted change`. `scripts/check.py#check_changelog` requires the heading.
- The description in both manifests becomes: "Side pane in the Claude desktop app over the devkit
  checkers: the change this session conducts with its next step, phases, PR, delivery items and
  child sessions, the other changes in progress, and buttons that put the owner's next command in
  the prompt box. Read-only." `docs/catalog.md` is regenerated from it with
  `python3 scripts/gen-catalog.py`.
- `plugins/panel/README.md` and "The panel: devkit-panel" in `docs/openspec-flow.md` describe
  D3 to D13. `CONTRIBUTING.md` step 4 and "Testing a mod pack" say that the npm `claude`
  validates the repository and the pack again, but still has no `plugin test`.
- No other pack changes. The panel reads only fields that `conduct-check` (version 2) and
  `deliver-check` (version 1) already emit, so no devkit-openspec release is needed and no CI pin
  moves.
- Revised: the versions stay (devkit-panel 0.2.0, marketplace 0.14.0: nothing is released yet).
  The 0.14.0 CHANGELOG bullet for devkit-panel gains the summary, documents and steps, the detail
  pane, the clearer headings and buttons, and the owner-run actor. The manifests' description
  does not change, so `docs/catalog.md` is not regenerated. `plugins/panel/README.md` and "The
  panel: devkit-panel" in `docs/openspec-flow.md` describe D20 to D27 and the six screens.

### D16. Gates and binaries (Revised)

Revised: gate 4.9 (the revision's code and docs) is the bundled binary's `plugin test` and
`plugin validate plugins/panel`, the npm binary's `plugin validate plugins/panel`, and
`python3 scripts/check.py`. Each is already a part of an earlier gate, so `pr-verifier`'s rows
cover it without a new command. It holds no guard suite (nothing under `plugins/openspec/`
changes), so it runs in the foreground.

Revised 2026-11-12, the bundled binary's path: overnight the desktop app replaced its bundled
Claude Code 2.1.317 (`91184d3d9ba3`) with 2.1.321 (`ddbdf2b334e1`) and removed the old folder, so
no gate naming the 2.1.317 path could run. Pinning the 2.1.321 path would break the same way at
the next update, so `B` is now named without its version, in a form fixed by how a gate is read.
`plugins/openspec/hooks/deliver-check.mjs` runs no part: `parseTasks` takes the first backticked
text after `Gate:` (so a part holds no backtick), `tasksItem` splits it on the literal `&&` (so a
part holds no `&&`) and counts a part green when a cell of an `evidence.md` row whose last cell
starts with `pass` contains it in backticks, and `tableRows` cuts a row at every `|`, escaped or
not (so a part holds no `|`). That rules out `ls … | sort -V | tail -1`: on 2026-11-12 a scratch
run of `tasksItem` left that part in `missingGates` with a passing row for it, and matched all
eight parts of this `tasks.md` in theirs. `pr-verifier` and the conduct session run each part
through the Bash tool's shell, where `$(...)`, the glob and the `;` work: the loop keeps the
glob's last match, which on 2026-11-12 resolved in zsh and bash to the 2.1.321 binary (`--version`
printed `2.1.321 (Claude Code)`). With two versions side by side it takes the lexically last, the
newer while the versions keep their digit count; with none it fails (zsh exit 126, bash 127) and
never passes. The exit code that decides is `B`'s own, since the `;` lives only inside the
substitution that names the binary. Gates 1.9 to 4.9 keep their `[x]`: they were green on 2.1.317
when run. `pr-verifier` re-runs them, and 5.9, in this form at the head it verifies, and its rows
carry this text.

- `B` is the bundled binary,
  `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"`:
  the last match of the glob, 2.1.321 (`ddbdf2b334e1`) on 2026-11-12. It is the only one with
  `plugin test`.
- `N` is the npm binary, `"$HOME/.nvm/versions/node/v22.22.0/bin/claude"`: 2.1.227, a native
  executable that runs with a bare `PATH`, checked on 2026-11-11.
- Both are named by absolute path inside the backticks, as CONTRIBUTING requires: `B` as an
  absolute glob that the part itself resolves, `N` as a fixed path.
- `plugin test` comes first in each gate. The precondition is the one in CONTRIBUTING: `B plugin
  test --help` prints `Run a mod's tests`, otherwise warm the switch first with
  `B -p "ok" --max-turns 1 --model haiku`.
- The guard suite (about 9 minutes) runs once, in the release phase's gate, after the mod test.
  A foreground tool call stops at 600 s, so a nine-minute part leaves one minute. Every run of a
  gate that holds it (3.9 by the conducting session, and `pr-verifier`'s re-run) is a background
  Bash, which has no such cap, and never a foreground call. The conduct skill already runs a
  `gate` step as a background Bash.

### D17. The live check (AC-13 `live-check`, AC-12 `looks-like-app-panel`) (Revised)

Revised: the live check is phase 5. Its first round ran as phase 4 before this revision and found
what requirements.md's Addendum records; tasks.md's new phase 4 builds the answer, and phase 5 runs
the check again on that head. Its record (5.2) holds both rounds: each finding of the first round,
and how the owner reads the same place in the second.

Phase 5 belongs to the conducting session, with the owner at the keyboard, as the devkit-panel
precedent's phase 4 did. A dispatched implementer or child session that receives it ends at once
(tasks.md says so). The marker `owner-run` is in the phase heading and at the start of each of its
task lines (inside the gate line after `Gate:` and its command, because `deliver-check`'s
`parseTasks` needs a gate's text to start with `Gate:`), so an implementer that reads only the
task lines still sees it. Teaching the conduct skill itself about owner-run phases is a separate
change (out of scope).

- **The change it watches**: this change, `panel-conduct-view`, conducted by the owner's typed
  `/conduct panel-conduct-view`. Its own phase sessions (`panel-conduct-view-p1` to `-p4`,
  running or archived) are the child sessions the card must list. The live criterion depends on
  nothing outside the change (devkit-panel retro row 8).
- **Loading the new pack**: the 0.2.0 code from the worktree goes into that conducting session,
  in place of the installed 0.1.0. The conducting session picks the route from the precedent: the
  session's dev-mods link, or `CLAUDE_CODE_PLUGIN_DIRS` with 0.1.0 disabled for the session (see
  Open Questions).
- **What is recorded, and by whom** (D19): the conducting session keeps 5.2's record, which is
  - the status text, with `via`;
  - the transcript form that matched (D3);
  - what the owner's presses did: a child session, `Continuar aqui`, a step, a pending row (and its
    `Copiar`), a document (and what the desktop did with its `Abrir no editor ↗` link, D23);
  - the first round's findings (requirements.md, Addendum), each with the owner's reading of the
    same place now, and the six screens compared with the approved mock;
  - the owner's reading of the pane in their own words, "LEGÍVEL" or what is not.

  It writes that record to a file in its scratchpad as soon as 5.2 ends, so a compaction before
  the `verify` step does not lose it, and appends it to `pr-verifier`'s dispatch prompt after the
  list of re-runs (D19).
  `pr-verifier` writes it to `evidence.md` as the proof of AC-13 `live-check` and of the owner half of
  AC-12 `looks-like-app-panel`. The npm `plugin list` lines are not part of this record: `pr-verifier`
  re-runs them (D2).

  If the owner finds it unreadable, that is a `fix-defect` back to phase 4, not a note; new scope
  is a plan revision, as this one was.

### D18. ADRs

- ADR 0001: the panel still drives nothing (D9).
- ADR 0006: the child names, and the start chain that keeps the buttons fill-only.
- ADR 0007: the round view goes (D6); the review trigger is approached but not fired (D4).
- The revision touches none of them: the detail pane, the document view and the steps are read
  and drawn in the session, on the owner's presses; `Continuar aqui` and `Conduzir` fill the same
  `/conduct <id>` as before (ADR 0006's start chain); the steps are a display of the checker's
  own step ids, and no checker lists anything new (ADR 0007's trigger stays unfired).

No ADR is added or superseded.

### D19. Where the proofs go (Revised)

`evidence.md` has one writer, `pr-verifier` (`plugins/openspec/hooks/guard.mjs#classify` gives it
to that agent alone, and `tdd-implementer` may not write it). The conduct skill reads a child's
`Outcome:` line only, never its report text. So no task of this change "pastes into the evidence",
and a phase's own checks leave no record. A record reaches `evidence.md` in one of two ways:

- **`pr-verifier` re-runs the command itself.** It already re-runs every gate part (its Gates
  table). It also re-runs these, and writes each line it quotes:
  - the npm load (D2): with `CLAUDE_CONFIG_DIR` set to a new, empty folder in its own scratchpad,
    the npm binary's `plugin marketplace add <worktree>`, `plugin install devkit-panel@devkit
    --scope user` and `plugin list`, quoting the devkit-panel lines (the npm half of
    AC-10 `loads-in-both-clis`);
  - the bundled `plugin validate plugins/panel`, quoting its `calls:` line (AC-11 `read-only-kept`);
  - the type check of task 2.7 (re-run at 4.8 on the revised code), quoting the command and its
    exit status;
  - the guard suite part of the 3.9 gate as a background Bash (D16).
- **The conducting session hands it over.** Only phase 5's live record cannot be re-run by an
  agent (it needs the owner's eyes). The conducting session puts it in `pr-verifier`'s dispatch
  prompt (D17). The ship-change skill's `verify` prompt is used as written, with two things
  appended by the conducting session: first the list of re-runs above (the npm load in a new
  scratch config folder, the bundled validate's `calls:` line, the `tsc` command of task 2.7, the
  guard suite as a background Bash; tasks.md "Workflow follow-up" holds it as written), because
  neither `pr-verifier`'s definition nor the `verify` prompt names them; then the live record.
  No skill or agent changes. If its tool list has `mcp__devkit-panel__status`, `pr-verifier`
  may also read the status itself and record both.

**The acceptance ids.** `deliver-check` item 4 reads the criteria ids with `/\bAC-\d+/` from the
`## Acceptance criteria` section of `proposal.md` (then `requirements.md`), and counts, for each
id, every `evidence.md` table row that mentions it, judged by the row's last cell
(`deliver-check.mjs#acceptanceItem`). So every criterion carries an id, AC-1 to AC-21, with its
slug beside it, in the same order in proposal.md and in requirements.md (the revised and new ones
in its Addendum, which replaces the original text of AC-2 to AC-9, AC-12 and AC-13). `pr-verifier` writes one row per id in its
`| AC-N | <criterion> | <proof> | pass |` form, the criterion cell starting with the slug, and a
row names no other `AC-<n>` id (a cross-reference goes by slug), so that one row's result never
counts for another id. tasks.md holds the id-to-slug-to-task map.

A phase's own check (the npm load in 1.1, the `calls:` line at 1.9, 2.9 and 4.9, the `tsc` run in
2.7 and 4.8)
still runs inside the phase. A failure there ends the phase with `Outcome: failure: <reason>`, so it
is caught before `pr-verifier`.

### D20. The detail pane: screens 2, 5 and 6 (AC-16 `detail-pane`, AC-15, AC-21)

The owner asked for a modal like the app's own dialogs (requirements.md, Addendum, finding 1). The
mod API has none (Context); its dialog form is a second pane opened with `focus`, `closeOnEscape`
and `holdToasts`. The approved mock draws it so (screens 2, 5, 6).

- **One pane.** The id is `devkit-panel-detail` (`DETAIL` in `register.tsx`). A press on another
  row while it is open opens the same id again with the new title, which the engine treats as a
  retitle: there is never a second detail pane. A press inside it (a tab, a section, `Ver
  tarefas.md`, a missing section's row) changes the subject in place.
- **Opened only by a press**: `$.ui.open({ id: DETAIL, title, focus: true, closeOnEscape: true,
  holdToasts: true })` in the press handler of a step, a pending row, a document, another open
  change or an error line. A press is an asked open, placed at any width. No refresh, timer or
  render opens, closes or retitles it.
- **The subject** is stored as `detail = { subject, full: false, copied: false }` (D7):
  `{ kind: 'pending'; section?: number }`, `{ kind: 'step'; key }`, `{ kind: 'doc'; file }`,
  `{ kind: 'change'; id }`, `{ kind: 'error'; key }`. The pane's `ui.render` hook (`{ component:
  'Pane', requestId: DETAIL }`) builds the body from the current `view` and the subject, so a
  refresh redraws it with fresh data. A subject gone after a refresh draws one dim line
  (`nada pendente`, `não está mais aberta`) and the pane stays until the owner closes it.
- **The frame** (every subject, as the three screens draw it): a head row with the title
  (semibold) over a caption subtitle (`<id> · <fact>`), and on the right a `✕` (`Button plain`,
  `$.ui.close({ id: DETAIL })`); the body; a dim footer, `Esc fecha e volta ao painel` (screen 2)
  or `Esc fecha` (screens 5 and 6), with screen 6's `Ver tarefas.md` and screen 5's `Abrir no
  editor ↗` on its left.

**Screen 2, pending** (`Detail.dc.html`, AC-16): title `Pendências`, subtitle `<id> · k de n
tarefas`.

- A callout (`Box borderStyle="round" borderColor="warning" paddingX={1}`, the substitute for
  the mock's tinted box): a semibold line `Todas esperam <who>` when every row has the same tag
  (`Todas esperam você`), else `<k> pendências`; then a dim line with what the current step is
  and `Quem age: <actor>.`
- One group per `tasks.md` section that has open tasks (or the one `section` pressed in screen
  6): `Seção <n> · <title>` with the count on the right; under it, one row per open task, `◐`,
  the id and the short title, and one dim sentence (D27). With no open task, the current step's
  pending things (D21), one row each, grouped by delivery item.
- `› Texto completo das tarefas` (a fold, flips `full`) with `Copiar` on the right. Unfolded: the
  open tasks' full text from `tasks.md` (or the items' raw reasons) in a `Code` block
  (`wrap="wrap"`, plain), selectable. `Copiar` calls `$.ui.copy({ text, surface: press.surface })`
  on the press: `isCopied: true` turns its label into `✓ Copiado` (`copied`); `isCopied: false`
  draws one dim line saying copying is not available here and the text above can be selected. No
  toast, because the pane holds toasts.

**Screen 6, a step** (`Step.dc.html`, AC-21 `step-detail`): title the step's name, subtitle
`<id> · <fact>`. The Implementation step's body, as the mock draws it:

- `<done> de <total> tarefas` with the percentage on the right, then the glyph bar: `━` in
  `success` for the done share and `inactive` for the rest, in a clipped Box (D26);
- `Faltam` with `<k> seções · <m> tarefas` on the right, then one row per section with open
  tasks: `◐`, its number, its title, and `<done>/<total> · <tag> ›` on the right, the row a press
  that shows screen 2 for that section;
- `Feitas` with `<k> seções`, then one dim row per finished section: `✓`, number, title,
  `<n>/<n>`;
- the footer's `Ver tarefas.md` opens screen 5 on `tasks.md`.

The other nine steps use the same frame; their bodies (not in the mock) are written in D22,
"Step details": the three delivery steps (Review, Proofs, PR and checks) show their delivery items
(AC-4), PR and checks links the PR (AC-3), and the planning and closing steps show their fact and
a link to their file.

**Screen 5, a document** (`Doc.dc.html`, AC-15): title the document's name, subtitle `<id> ·
<file>`.

- A tab row (`Box flexDirection="row" flexWrap="wrap"`): every document present (D23), the open
  one as semibold `Text`, the others as `Button plain` that change the subject in place.
- `Seções`: one `Button plain` per `## ` heading of the file; a press calls `$.ui.scroll({ to: {
  key: 'sec:<i>' }, in: DETAIL, block: 'start' })`, a reveal answering the owner's press.
- The file, read by `$.fs.read` in the render hook, drawn as one `Markdown` element per section
  (keys `sec:0`, `sec:1`, ...), cut to 90 000 characters with a dim line saying so (one drawing
  draws at most 100 000). The pane's own scroll stands for the mock's "role para ler o resto".
- The footer's `Abrir no editor ↗` is a `Link` with `href` `file://<absolute path>` (D23).

**Another open change, an error line** (not in the mock): the same frame. A change shows its
progress (D27), its step, who acts and its state, and its `Conduzir` button with the meaning line
`planeja e executa aqui, com sessões filhas`. An error shows its full line in a `Code` block.

- **Closing.** Escape while the pane holds the keyboard (`closeOnEscape`), the engine's close
  mark or keys, or `✕`. An `on('ui.close', { id: DETAIL })` hook clears `detail` and passes
  `next(e)`; it never refuses a close. The band's `Fechar painel` and `/devkit-panel` close the
  detail pane with the main pane. A fill pressed inside the detail pane closes it before its toast
  (D10).
- **Surfaces.**
  - Desktop: the detail pane is the shown pane and the main pane a titled tab behind it; Escape
    or `✕` shows the main pane again.
  - Terminal: docked beside a fullscreen transcript from 110 columns, else inline above the
    prompt, as a tab (ctrl+x tab). `focus` is refused while the composer holds text (just after a
    fill, for example), so Escape may not close it then; `✕` always does. `$.ui.copy` writes as
    `/copy` does.
  - Mobile: the same elements draw (`Box`, `Text`, `Button`, `Link`, `Code`, `Markdown`); a
    `file:` link draws as plain text and `$.ui.copy` answers `isCopied: false` there.
  - When `$.ui.open` answers `isPlaced: false` (no attached surface places panes), the handler
    closes the id again, clears `detail` and toasts the row's one-line summary.
- **The text form** (`renderText`, `/devkit-panel status`, the status tool) has no pane: it
  prints the steps with their facts, the pending rows, the documents present and each item's
  short list, never a document's text.

Alternatives considered:

- Unfold in place (0.2.0 as built). Rejected by the owner (finding 1).
- `$.ui.ask` (a question dialog with two to four options). Rejected: it asks and waits for an
  answer; a detail is a view.
- `$.ui.place` (a row at the transcript's end). Rejected: it scrolls away with the conversation.
- One pane per row. Rejected: a tab per press, and nothing closes them together.

### D21. Short lists and command labels (AC-4 `delivery-items`, AC-16, AC-21)

`plugins/panel/hooks/detail.ts`, pure, pinned by `report.test.tsx`. A delivery item's reason is
never drawn as the paragraph the owner saw; the steps' details and the pending list use these.

- **`commandLabel(command)`**: the command split on spaces, double-quoted parts kept whole:
  - `claude` binary: `<sub> <target> (<origin>)`, where `sub` is the word after `plugin`, `target`
    the last path segment of the next argument (`plugins/panel` gives `panel`, `.` stays `.`) and
    `origin` is `app` when the binary's path holds `/claude-code/` (the desktop app's bundled
    build) and `npm` otherwise: `test panel (app)`, `validate panel (app)`, `validate . (npm)`;
  - `node --test <file>`: the file's name without `.test.mjs`, `.test.js` or `.test.ts`, then
    `suite`: `guard suite`;
  - `node <script> [args]`: the script's name without `.mjs` or `.js`, then the args;
  - `python3 <script> [args]`: the script's file name, then the args: `check.py`,
    `gen-catalog.py --check`;
  - a command holding `tsc`: `tsc`;
  - anything else: the first word's last path segment and the next word, cut to 28 cells.

  No `$HOME` path reaches the pane outside a full-text `Code` block.
- **`itemLines(item, part?)`**: `{ label, word }[]`, one per pending thing, read from `details`
  when its fields have the expected types:
  - item 1 (`tasks`) has two parts, so that no line shows in two steps (D22, "Step details"):
    `part: 'tasks'` gives each `unticked` id with `aberta`; `part: 'proofs'` gives `evidence.md`
    with `ausente` or `desatualizada`, then each `missingGates` command, as its label, with `sem
    prova`; without `part`, both, tasks first (the text form only);
  - item 2 (`reviews`): each `missing`, `rejected` or `stale` reviewer with that word;
  - item 4 (`acceptance`): `evidence.md` as for item 1; each `missing` id with `sem prova`, each
    `defects` id with `falhou`, each `noProof` id with `o dono decide`;
  - item 6 (`checks`): each `failing` name with `falhou`, each `pending` name with `rodando`;
  - any other item, or `details` absent: the reason split on `; `, one clause per line, no word.
- **The cap**: eight lines, then `+N`; the full text stays one press away.
- **`itemSummary(lines)`**: the count per word joined by ` · ` (`3 abertas · 10 sem prova`), or
  the one line's label when there is one line.

### D22. The ten steps, with "you are here" (AC-14 `flow-steps-you-are-here`, AC-2, AC-3)

The owner asked where the change stands in the whole flow (finding 5); the mock draws ten steps.
`plugins/panel/hooks/steps.ts`, pure: `flowSteps(row, deliver, tasks, files)` gives ten `Step = {
key, status: 'done' | 'partial' | 'current' | 'pending', fact?, items: number[] }`.

| Step (pt-BR · en) | `next.step` values it holds | Items it shows | Fact on the right | Its detail links |
|---|---|---|---|---|
| `Requisitos` · Requirements | `create`, `new-change`, `worktree`, `grill` | | `n critérios` (item 4 `details.ids`) | `requirements.md` |
| `Plano` · Plan | `plan`, `revise-plan` | | `n seções` (D27) | `design.md` |
| `Prontidão` · Readiness | `readiness`, `stop-readiness-blocked` | | `aprovada` / `a revisar` / `bloqueada` | `readiness.md` |
| `Sua aprovação` · Your approval | `approve`, `stop-plan-approval`, `stop-not-approved` | | the `Date:` of `approval.md` as `18 set` / `Sep 18` (below) | `approval.md` |
| `Implementação` · Implementation | `wait-dependencies`, `rebase`, `audit`, `stop-audit-unverifiable`, `implement`, `gate`, `commit` | 1, `tasks` part (its unticked ids) | `k de n tarefas ›` (D27) | screen 6, `tasks.md` |
| `Revisão` · Review | `review`, `fix-review`, `stop-review-deadlock` | 2, 3 | `rodada n` when the step carries it | |
| `Provas` · Proofs | `verify`, `fix-defect` | 1, `proofs` part (evidence state, gates without a passing row); 4 | `k de n critérios` (proven of ids) | `evidence.md` |
| `PR e checks` · PR and checks | `open-pr`, `push`, `push-rebased`, `update-branch`, `edit-pr-body`, `answer`, `resolve-release-conflict`, `wait-checks`, `fix-checks` | 5, 6, 7, 8 | `PR #n · <checks word>` (AC-3) | the PR `Link` |
| `Merge` · Merge | `ready`, `enable-auto-merge`, `disable-auto-merge`, `wait-merge` | | | |
| `Retro e arquivo` · Retro and archive | `retro`, `stop-retro-answers`, `apply-proposals`, every other `archive*` step, `open-archive-pr`, `tick-roadmap`, `stop-archive` | | | `retro.md` when present |

- **The approval date.** The `Date:` line of `approval.md` (`YYYY-MM-DD`) is drawn as the day and
  the month's short name: pt-BR `18 set` (`jan`, `fev`, `mar`, `abr`, `mai`, `jun`, `jul`, `ago`,
  `set`, `out`, `nov`, `dez`), en `Sep 18`. A missing or unreadable `Date:` gives `aprovada` /
  `approved` when the file exists, and no fact otherwise.
- **The `files` argument** is the set of the change folder's file names present (`requirements.md`,
  `proposal.md`, `design.md`, `tasks.md`, `readiness.md`, `approval.md`, `evidence.md`,
  `retro.md`). In the refresh it comes from D23's existence checks, stored with
  `conducted.docs`; in the pure tests it is a literal set per row.
- **Step details** (D20's frame; the frame's subtitle is `<id> · <fact>`). Each delivery item in a
  body is drawn as a head row (its status glyph, its D12 item name, its `itemSummary` dim, its
  status word on the right) followed by its `itemLines` rows (eight, then `+N`); a met item is its
  head row alone. The body's last row is `› Texto completo` folding a `Code` block of the raw
  reasons of the items it shows (the `full` flag of D20).

  | Step | Body |
  |---|---|
  | Requisitos | the count of criteria and their ids (item 4's `details.ids`), one per line; `Ver requisitos.md` (opens screen 5) |
  | Plano | which of `proposal.md`, `design.md` and `tasks.md` exist, and the section count; `Ver design.md` |
  | Prontidão | the readiness status (`aprovada`, `a revisar`, `bloqueada`, or the step's label when current); `Ver readiness.md` |
  | Sua aprovação | the approval date, or `sem aprovação ainda` when the file is missing; `Ver approval.md` |
  | Implementação | screen 6 (D20) |
  | Revisão | items 2 and 3, each as above; the round when the step carries it |
  | Provas | item 1's `proofs` part (the evidence state and each gate command without a passing row, as its label), then item 4; `Ver evidence.md` when it exists |
  | PR e checks | with a PR: a `Link` labelled `PR #n ↗` whose `href` is `deliver.pr.url`, the checks word of D8, then items 5, 6, 7 and 8; without a PR: the line `sem PR ainda`, then item 5's line |
  | Merge | the step's label and its reason as a short list, or `feito` when done |
  | Retro e arquivo | the step's label and its reason as a short list; `Ver retro.md` when it exists |

  Implementation shows only item 1's `tasks` part (in screen 6's sections and the pending detail),
  Proofs only its `proofs` part, so the same line is never in two steps.
- **Done, partly done, current, pending.** The current step is the one `next.step` belongs to,
  `●`, its name semibold, and for the current step the fact is followed by the step's short label
  (D12). Every step after it is pending (`○`, dim). Every step before it is done (`✓`), except one
  whose own facts say it is unfinished (Implementation with an unticked task, Proofs with an
  unproven criterion), which is partly done (`◐`). The count on the right of `Passos` is the done
  steps, `k de 10`.
- **A `fix-*` step** makes its own step current again, the checker's own order.
- **A step id not in the table** (`blocked`, `stop-branch`, `stop-plan-mode`, `stop-merge-setup`,
  which `deliver-check` reports before the phases, or one a later checker adds): with `next.item`
  set, the step that shows that item (item 1: Implementation while a task is open, else Proofs);
  otherwise the first step not finished by the facts: the planning steps by the files present
  (D23), Implementation by the tasks, the later steps by their items being `met`. The current
  step then takes `✕` in `error`, and the Agora box shows the raw step id.
- **No `tasks.md` yet**: Implementation's fact is empty and the step is pending.
- **Who acts** is drawn on the Agora box and the band only: `next.actor` read through D25.
- **The Agora box's lines** (AC-19): the current step in a few words (the D12 short label; for
  `implement` and `gate`, `Implementar a fase n: <title>` and `Gate da fase n`), then `Faltam k
  tarefas nesta fase.` for `implement`, or the `itemSummary` of the step's items for a delivery
  step, then `Depois: <the next three pending steps' names, lower case>.`
- **Pinned**: a test walks every step id of `i18n.ts`'s step table (which covers `actorOf`) and
  asserts each one is in the table above or in the short list handled by the "not in the table"
  rule, so a step a new checker adds fails a test instead of drawing nowhere.

Alternatives considered:

- One step per phase plus `commit` (sixteen rows for this change). Rejected: the mock's ten steps,
  with the phases inside Implementation's detail (screen 6).
- The phase bar as the "where am I" (0.2.0). Rejected: the owner could not tell where the change
  stood, and it overran the desktop pane (D26). A glyph bar stays, inside screen 6.
- A `steps` list emitted by `conduct-check`. Rejected for this change: a devkit-openspec release,
  which D15 avoids; the ladder only groups step ids the checkers already emit.

### D23. The change, its summary and its documents (AC-15 `summary-and-documents`)

- **The folder**: `<row.worktree>/openspec/changes/<id>/` when that worktree exists
  (`$.fs.exists`), else `<root>/openspec/changes/<id>/`.
- **The summary**: the first line matching `^Summary:\s*(.+)$` in `proposal.md` before its first
  `## ` heading; else the first sentence of its `## Why` section (wrapped lines joined, up to the
  first `. ` or the paragraph's end); else none. Cut to 200 characters. This change's
  `proposal.md` carries a `Summary:` line from this revision on. Making the line part of every plan
  is a planner or schema change of its own (proposal.md, Non-goals); the `## Why` fallback covers
  the changes without one.
- **Repository and branch**: the last path segment of the first `git worktree list` entry (the
  main checkout), and the row's `branch`.
- **The documents**: the main pane's row has the mock's five, `Proposta` (`proposal.md`), `Design`
  (`design.md`), `Tarefas` (`tasks.md`), `Specs` (every `specs/<capability>/spec.md`, drawn one
  after the other under a `## <capability>` heading) and `Provas` (`evidence.md`), each only when
  it exists. Screen 5's tabs also hold `Requisitos` (`requirements.md`), `Prontidão`
  (`readiness.md`) and `Aprovação` (`approval.md`) when they exist, because the steps Requisitos,
  Prontidão and Sua aprovação open their files in the same pane: one tab row for every file the
  pane can show. This is wider than the mock's tab row, which shows the five.
- **Cost per refresh**, the conducted change only: one `$.fs.exists` per document, one `$.fs.list`
  of `specs/`, and `$.fs.read` of `proposal.md`, `approval.md` (its `Date:`) and `tasks.md`
  (D27), stored as `conducted.folder`, `.repo`, `.summary`, `.docs`, `.approvedOn` and `.tasks`
  (D7). No checker run, no `gh`. A document's text is read only when the pane draws it.
- **`Abrir no editor ↗`** is a `Link` with `href` `file://<absolute path>`. A click does what the
  surface does with a `file:` URL (the desktop's own handling; a terminal's hyperlink; plain text
  on a remote surface); the live check records what the desktop did (D17). The `Markdown` view
  works on every surface either way.
- **Read-only**: `fs.exists`, `fs.list` and `fs.read` only (D13).

Alternatives considered:

- `file:` links alone, without the document pane. Rejected: what the desktop does with one was not
  checked, and a remote surface draws it as plain text.
- An app tool that opens a file in the app. Rejected: none is in the panel's two-tool list, and a
  third tool would need its own ADR 0001 argument.
- The summary from the first bullet of `## What Changes`. Rejected: it names a part of the change.

### D24. Sections and buttons that say what they are (AC-17 `sections-say-what-they-are`, AC-6, AC-7, AC-19)

The owner could not tell the two sections apart (finding 4), read `Em andamento` as "already being
run" (finding 2), and asked what `Entregar` does (finding 3). The mock answers each:

- The top says `Esta conversa conduz`, then the change. With none, the pane is screen 3, whose
  title and sentence say there is none and what `Conduzir` does.
- The other changes are `Outras changes abertas` (screen 1, folded) or `Changes abertas em
  <repository>` (screen 3, open). Neither says whether another chat conducts them: the panel sees
  only this session's family (D9). In the live check's second round the owner asked whether the
  changes at the bottom were sub-changes that must finish first; they are not, so screen 1's
  heading carries the dimmed hint `independentes desta conversa; nenhuma precisa terminar antes`
  (D12, added 2026-11-12).
- **Buttons** (the fill texts are unchanged, so ADR 0006's start chain is the same):

  | Button (pt-BR · en) | Fills | Where |
  |---|---|---|
  | `Continuar aqui` · Continue here | `/conduct <id>` | the Agora box, always, with the hint `põe /conduct <id> na caixa` |
  | `Conduzir` · Conduct | `/conduct <id>` | each other open change (screens 1 and 3), and its detail |
  | `Aprovar plano` · Approve plan | `Aprovo o plano de <id>` / `I approve the plan of <id>` | the Agora box, on `approve` and `stop-plan-approval` |
  | `Responder retro` · Answer retro | `Approve proposal 1 of <id>` | the Agora box, on `stop-retro-answers` |

- **Ship leaves the pane.** `/conduct <id>` carries a change from its plan to its archive,
  running `ship-change`'s steps through the checker (ADR 0007), so `Continuar aqui` covers it;
  the mock has no Ship button; and the owner could not tell what it was. `/ship-change <id>` stays
  a command the owner can type.

### D25. Who acts on an owner-run phase (AC-18 `owner-run-actor`)

In scope, as a display reading. When `next.step` is `implement` or `gate` and the `deliver.phases`
entry numbered `next.phase` has a title matching `/\bowner-run\b/`, the pane shows the owner as
who acts: the pill reads `você age`, the band's glyph is `◐` in `warning` and its phrase `você age`.

- The marker is the one D17 already writes in the phase heading, and `deliver-check`'s
  `readPhases` already reports the title, so nothing new is read.
- The checker still reports `session` for that step, and the conduct skill still dispatches unless
  tasks.md stops it. Teaching `conduct-check` an owner-run phase is the devkit-panel retro's row 7
  followup (a devkit-openspec change), out of scope here. When the checker reports `owner` itself,
  this reading agrees with it and can go.
- Alternative: leave it to that followup. Rejected: the owner saw `Claude` on a phase the owner
  runs, and the fix is one comparison on data already read.

### D26. Lines that fit the pane (AC-12 `looks-like-app-panel`, AC-2, AC-8)

- **Rules**: each divider is a `Box height={1} overflow="hidden" flexShrink={0}` holding one `Text
  wrap="truncate"` of `─` repeated to `bodyColumns`. A rule wider than the desktop's pane is
  clipped, so it never wraps into a full line and a short one.
- **The glyph bar** (screen 6 only): a `Box flexDirection="row" overflow="hidden" height={1}`
  holding two `Text wrap="truncate"` runs of `━`, sized to `bodyColumns - 4` split by the done
  share; the percentage is on the line above, never beside the bar, so nothing can cross it.
- **Rows**: the left part keeps `flexShrink={1} minWidth={0}` and `wrap="truncate-end"`; the right
  part is `flexShrink={0}` and holds a few words only (a fact, a tag, a state, `Conduzir`). A
  change's progress goes on its own dim line under its id (screens 1 and 3).
- **The filled mark** is `✓ ` before the label, and the hint or a dim line under the row (D10).
- **Pinned**: on the `terminal` surface no line of the text form is longer than the pane's
  `bodyColumns`; on the `desktop` surface every rule and the bar are inside a Box with `overflow:
  'hidden'` and their Text has `wrap: 'truncate'`; the filled label is `✓ ` plus the label.

### D27. Reading `tasks.md` (AC-2, AC-20 `pending-list`, AC-21, AC-6)

The steps' facts, the pending list, screen 6 and the other changes' progress need task counts and
task titles, which `deliver-check`'s `phases` do not carry (only the open ids and the gate).

- **`readTasks(text)`** in `plugins/panel/hooks/steps.ts`, pure: the sections (`^##\s+(\d+)\.\s*(.*)$`)
  and the checkbox lines (`^\s*[-*]\s+\[([ xX])\]\s+(\S+)\s*(.*)$`), the same two expressions as
  `deliver-check.mjs#parseTasks` and `#readPhases`, plus, per task, the lines indented under it.
  It gives `{ sections: [{ n, title, tasks: [{ id, done, isGate, title, sentence, text }] }] }`.
- **A task's short title**: its text after the id up to the first ` (`, `:` or `;`, without
  backticks, cut to 40 cells (`4.1 Texts and wording`). A gate's is `Gate` and its command labels
  (D21). **Its sentence**: the first sentence of the lines under it, cut to 120 characters. **Its
  text**: the task line and the lines under it, as written (the full text of screen 2).
- **A section's title**: the heading without its trailing parenthesis, cut to 32 cells. A phase
  title in `Sessões desta change` (`Fase n · <title>`) is the same.
- **A task's tag** (screen 1's right-hand tag, screen 6's): `você` when the task or its section is
  owner-run (D25), `gate` for a gate, `Claude` otherwise. The mock's tags (`bancada`) come from that
  repository's own reasons, which this repository's tasks do not record.
- **The other changes' progress** (screens 1 and 3): their `tasks.md`, read the same way from the
  folder each candidate came from (D4): `k de n tarefas`, then ` · <step label>` when the step is
  not `implement`; `plano pronto · 0 de n` when the step is past the approval and nothing is ticked;
  the step label alone without a `tasks.md`.
- **Agreement with the checkers**: a test parses this change's `tasks.md` (a fixture copy) and
  asserts that the open ids and titles per section equal `deliver-check`'s `phases` for the same
  file (a fixture capture), so the second reading cannot drift unseen.
- **Cost**: one `$.fs.read` of the conducted change's `tasks.md` (D23) and one per other change,
  per refresh, in process.

## Implementation plan

Dependency order: manifest → data (listing, checker runs, transcript, sessions) → the view model
and refresh → drawing → band and texts → release and docs → live check.

Revision order (tasks.md phase 4): texts (D12, D24) → pure readers (D21 short lists, D27
`tasks.md`, D22 steps, D23 summary, D25 owner-run) → the folder reads in the refresh (D23, D27) →
the main pane, screens 1, 3 and 4 (D8, D10, D26) → the detail pane, screens 2, 5 and 6 (D20) →
the read-only run and the type check (D13) → docs (D15) → the live check again (phase 5, D17).

**Per surface.**

- Mod module (`plugins/panel/hooks/`): D2 to D14, and D20 to D26 for the revision.
- App integration: `list_sessions` input, `open_session_in` on a press.
- Docs and release: D15.
- There is no backend, frontend app, worker or migration in this repository's sense.

**File structure.**

| Action | Path |
|---|---|
| Modify | `plugins/panel/.claude-plugin/plugin.json` (D2, D15), `plugins/panel/hooks/hooks.json` (D2) |
| Modify | `plugins/panel/types/index.d.ts` (D7) |
| Modify | `plugins/panel/hooks/register.tsx` (refresh D5, triggers, handlers D9 D10, band D11) |
| Modify | `plugins/panel/hooks/project.ts` (`parseWorktrees`, `candidates`, checker version D4 D6; `changeFolders` goes) |
| Modify | `plugins/panel/hooks/report.ts` (deliver `phases`, `pr`, item `details` D7) |
| Modify | `plugins/panel/hooks/sessions.ts` (`include_archived`, `ownChildren`, `OPEN`, `mayOpen` D3 D9) |
| Create | `plugins/panel/hooks/conducted.ts` (transcript forms and the D3 order) |
| Modify | `plugins/panel/hooks/pane.tsx` (D8 layout, `renderText`, `renderBand`) |
| Modify | `plugins/panel/hooks/commands.ts` (Conduct always `/conduct <id>`; `isCreateStep` goes if unused) |
| Modify | `plugins/panel/hooks/i18n.ts` (D12) |
| Modify | `plugins/panel/hooks/panel.test.tsx`, `plugins/panel/hooks/report.test.tsx` (D14) |
| Create | `plugins/panel/hooks/fixtures/change.ts`, `worktrees.ts`, `messages.ts`, `sessions.ts`; modify `fixtures/deliver.ts` |
| Delete | `plugins/panel/hooks/fixtures/round.ts` (and `change-option.ts` if unused) |
| Modify | `plugins/panel/README.md`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md`; regenerate `docs/catalog.md` |

Revision (tasks.md phase 4):

| Action | Path |
|---|---|
| Create | `plugins/panel/hooks/detail.ts` (D21: `commandLabel`, `itemLines`, `itemSummary`, `reasonLines`; D23: `summaryOf`) |
| Create | `plugins/panel/hooks/steps.ts` (D22: `flowSteps` and the ladder; D27: `readTasks`, short titles, tags, progress) |
| Create | `plugins/panel/hooks/fixtures/deliver-open.ts`, `plugins/panel/hooks/fixtures/tasks.ts` (D14) |
| Modify | `plugins/panel/types/index.d.ts` (D7: `details` fields, `Conducted.folder`/`repo`/`summary`/`docs`/`approvedOn`/`tasks`, `progress`, `DetailSubject`, the `detail` state) |
| Modify | `plugins/panel/hooks/register.tsx` (D23, D27 reads in `load`; D20 `DETAIL`, `detail` atom, `openDetail`, the `ui.close` observer, the detail render hook, `Copiar` and the section scroll; D10 fill from the detail; `togglePane` closes both; `view-4`) |
| Modify | `plugins/panel/hooks/pane.tsx` (D8 screens 1, 3, 4 and D26; `buildDetail`, `renderDetail` for screens 2, 5, 6; D10 mark; `renderText`; band D11) |
| Modify | `plugins/panel/hooks/report.ts` (D7 tolerant `details`; D25 `actorOf(row, deliver)`) |
| Modify | `plugins/panel/hooks/commands.ts` (D24: `Continuar aqui`, `Conduzir`, `Aprovar plano`, `Responder retro`; Ship goes) |
| Modify | `plugins/panel/hooks/i18n.ts` (D12 revised) |
| Modify | `plugins/panel/hooks/fixtures/change.ts` (three derived rows, D14), `panel.test.tsx`, `report.test.tsx` |
| Modify | `plugins/panel/README.md`, `docs/openspec-flow.md`, `CHANGELOG.md` (D15) |

**Estimate.** Optimistic 21 h · likely 29.5 h · pessimistic 42 h for phases 1 to 4 as first
planned; the revision adds optimistic 19 h · likely 27.5 h · pessimistic 41 h, for a total of
optimistic 40 h · likely 57 h · pessimistic 83 h. The revision's rows follow the first table.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Manifest and hooks.json fix, npm load proof (D2) | 1 | Core | LOW |
| Worktree listing, candidates, checker runs with throttle and rate-limit back-off (D4, D5) | 3.5 | Core | MEDIUM |
| Conducted change: transcript forms, own children, stored prefixes, ambiguous prefix (D3) | 3 | Core | MEDIUM |
| Deliver parse: phases, PR, checks; types (D7) | 1.5 | Core | LOW |
| Sessions: `include_archived`, open on a click with its permission (D9) | 2 | Integration | MEDIUM |
| Phase 1 tests and fixtures (D14) | 3 | Testing | MEDIUM |
| Pane layout rewrite (D8) | 5 | Core | MEDIUM |
| Band, status text, texts in two languages (D11, D12) | 2 | Core | LOW |
| Visible fill state and toast (D10) | 1 | Core | LOW |
| Phase 2 tests on terminal and desktop (D14) | 4 | Testing | MEDIUM |
| Type check against the 2.1.317 contract | 0.5 | Testing | LOW |
| Release files and docs (D15) | 2 | Documentation | LOW |
| Live check with the owner (D17) | 1 | Testing | MEDIUM |

Revision:

| Component | Hours | Type | Risk |
|---|---|---|---|
| Texts of the six screens in two languages (D12, D24) | 1.5 | Core | LOW |
| Short lists and command labels (D21) | 2 | Core | MEDIUM |
| Reading `tasks.md`, with its agreement test (D27) | 2 | Core | MEDIUM |
| The ten steps and the Agora lines (D22) | 2.5 | Core | MEDIUM |
| Summary, repository, documents, folder reads (D23) | 1.5 | Core | LOW |
| Owner-run actor (D25) | 0.5 | Core | LOW |
| Main pane, empty state and band to the mock (D8, D10, D11, D26) | 3.5 | Core | MEDIUM |
| Detail pane: screens 2, 5 and 6, copy, scroll, close, surfaces (D20) | 5 | Core | MEDIUM |
| Tests and fixtures for the six screens on terminal and desktop (D14) | 5 | Testing | MEDIUM |
| Read-only run extended, type check re-run (D13) | 0.5 | Testing | LOW |
| Docs (D15) | 1 | Documentation | LOW |
| Live check, second round (D17) | 0.5 | Testing | MEDIUM |

**Risks** (probability × impact → mitigation):

- `$.session.messages()` gives a slash command's text in another form than the transcript file
  (MEDIUM × MEDIUM) → three forms are accepted (D3); signal 2 still finds the change once a phase
  child exists; the live check records `via` and the form seen.
- `startedBy` is missing, or in another id space, in the app's current list (LOW × MEDIUM) →
  signal 2 then finds nothing and signal 1 still works; a test covers a family without
  `startedBy`.
- `gh` load or latency from the per-change runs (MEDIUM × LOW) → the 5-minute throttle, at most
  three at once, the light refresh with the pane closed, and the 15-minute back-off on a
  rate-limit line (D5).
- Two changes in progress share a 20-character start, so their `--change` prefixes are equal
  (LOW × MEDIUM) → the ambiguous-prefix rule (D3): no signal-2 match and no children listed for
  either, with a line naming the other id; a test pins it.
- Signal 2 runs before the rows it needs exist (a new candidate, a declined `view-2`) (MEDIUM ×
  MEDIUM) → every candidate is fetched once in the first run that sees it, before D3 resolves; a
  failed fetch keeps the last good row, and the previous children-found id is kept for that run
  (D3).
- A phase-5 record lost before `pr-verifier` runs (LOW × MEDIUM) → the conducting session writes
  it to its scratchpad when 5.2 ends and pastes it into the dispatch prompt (D17, D19); every other
  proof is re-run by `pr-verifier`.
- `open_session_in` refused: not a child of this session, the switch off, the session not on
  screen (MEDIUM × LOW) → the app's text is toasted, the window fallback, the sidebar hint (D9).
- A later engine rejects a hooks.json with both keys (LOW × HIGH) → each code gate runs both
  binaries' validate; the fallback is a recorded minimum version (D2, alternatives).
- Glyph width or fonts on a terminal (LOW × LOW) → single-cell glyphs only; the terminal tests
  assert the text.
- The owner does not find the pane readable at the live check (MEDIUM × MEDIUM) → the sketch and
  the tables of D8 are shown at plan approval; an unreadable verdict is a `fix-defect` back to
  phase 4 (D17). It happened once (requirements.md, Addendum); the revision answers each finding
  with a test, and the second round records each one again.
- The live check cannot load 0.2.0 beside the installed 0.1.0 (MEDIUM × MEDIUM) → two routes
  from the precedent; the first round loaded it, and the conducting session reloads the same way
  at phase 5 (Open Questions).
- The detail pane reads as a tab, not the modal the owner pictured (MEDIUM × MEDIUM) → the API has
  no modal (Context), and the approved mock draws it as a second pane closed with Escape; the
  second round compares each screen with the mock (D17, D20).
- `focus` refused while the composer holds text, so Escape does not close the detail pane
  (MEDIUM × LOW) → the `✕` button always closes it (D20).
- `holdToasts` hides a toast the owner needed (LOW × LOW) → no refresh toasts; a fill from the
  detail pane closes it before its toast, and `Copiar` answers in its own label (D10, D20).
- The panel's `tasks.md` reading drifts from `deliver-check`'s (MEDIUM × MEDIUM) → the same two
  expressions, and a test that compares both readings of one captured file (D27); the copies live in
  `plugins/panel/hooks/grammar.ts` and `scripts/check.py` (check_panel_parity, gates 3.9 and 4.9 and CI) fails
  when a checker's literal or the panel's copy changes alone (the tasks grammar of D27, the `--change` id rule of D3).
- The mock's look needs what the mod lacks (a tinted rounded box, a pill radius, row tints)
  (HIGH × LOW) → each substitute is named in D8's table and checked against the mock at phase 5.
- `$.ui.copy` is read as a write against the read-only contract (LOW × MEDIUM) → it is on a press,
  hands text to the owner as `prompt.fill` does, is named in D13 and the README, and the approved
  mock asks for it.
- The step ladder drifts from the checkers when a step id is added (MEDIUM × MEDIUM) → the
  unmapped rule draws it from the facts with its raw id, and a test fails when an id of the step
  table is neither mapped nor listed as unmapped (D22).
- A command or reason the short list does not recognise (MEDIUM × LOW) → the fallback label and
  the `; ` split; the full text is one press away (D21).
- The desktop's `Markdown` or `file:` link behaves differently than the types say (LOW × MEDIUM)
  → the `Markdown` view needs no link; the second round records what the link did (D23).
- A wide rule or row still overruns on the desktop (LOW × MEDIUM) → clipped rules and
  `flexShrink`/`truncate-end` rows, a desktop test on the props, and the second round (D26).

**Assumptions** (where the plan breaks if reality differs):

- The transcript keeps a typed `/conduct <id>` as the `<command-name>` / `<command-args>` text.
  Source: the 2026-11-11 transcript quoted in Context.
- `list_sessions` with `linked: true` leaves the current session out, and a linked row carries
  `startedBy`. Source: the tool's description in `app.asar` (desktop app 4.23118.0).
- `open_session_in` accepts a child this session started and is layout only. Source: its
  description and handler in `app.asar`.
- A `--change` run gives the plain 20-character cut as `sessionPrefix`, and the hash suffix only
  when two ids share one run. Source: `plugins/openspec/hooks/conduct-check.mjs#sessionPrefixes`
  and `#addSessions`.
- `deliver-check` version 1 emits `phases`, `pr` and `items[].details`. Source:
  `plugins/openspec/hooks/deliver-check.mjs#buildReport` and `#checksItem`.
- The npm 2.1.227 loads the dual-key hooks.json. Source: the scratchpad trial in Context.
- A second pane opened with `focus`, `closeOnEscape` and `holdToasts` from a press is placed, shown
  over the first as a tab, and closes on Escape while it holds the keyboard. Source: `PaneOpenArgs`,
  `UiOpenResult` and the `Pane` render props in the 2.1.317 types (Context).
- `$.ui.scroll` to a keyed element of the detail pane works from a press, and `$.ui.copy` writes the
  desktop's clipboard. Source: `UiScrollArgs` and `$.ui.copy` in the same types; seen at phase 5.
- The mock's example data (psim-kernel's `controlid-settings`) shows the structure only; the
  derivations of D22, D23 and D27 give this repository's facts. Source: the coordinator's note with
  the mock, and `canvas.json`.
- `Box overflow="hidden"` with `Text wrap="truncate"` clips a line on the desktop. Source:
  `BoxProps.overflow` and `TextProps.wrap` in the same types; not yet seen on the desktop, so the
  second round checks it (D26).
- `deliver-check` items 1, 2 and 4 carry the `details` fields of D21, and a `blocked` next step
  carries `item`. Source: `plugins/openspec/hooks/deliver-check.mjs#tasksItem`, `#reviewsItem`,
  `#acceptanceItem` and `#nextStep`, and the `deliver-check panel-conduct-view --json` run of
  2026-11-11.

**Dependencies**:

- `conduct-check --change` (devkit-openspec 0.10.0, change `conduct-one-change`, archived
  2026-11-11);
- `deliver-check` JSON version 1 (devkit-openspec, unchanged here);
- the app's two tools above;
- the app's bundled Claude Code and its `plugin test` (2.1.317 when planned, 2.1.321 since
  2026-11-12, named without its version, D16);
- for the revision, phases 1 to 3 of this change as built in the worktree (gates 1.9, 2.9 and 3.9
  green, uncommitted) and the live check's first round (requirements.md, Addendum).

## Risks / Trade-offs

- [The panel now runs one checker per change in progress, not one round run] → the throttle and
  the light refresh (D5), and no `deliver-check` below the top card.
- [A second copy of the "open change ids" rule lives in the panel] → a test quotes the conduct
  skill's no-argument wording, and ADR 0007's trigger is noted, not fired (D4).
- [The round view goes; an owner who used it loses the round summary] → the roadmap file is the
  report (ADR 0007); a running round still gets its top card through D3 signal 2.
- [Reading the session's own transcript] → it is read only, in the session, every refresh; nothing
  is stored or sent.
- [The steps ladder is a second reading of the checkers' step order] → it only groups their step
  ids, and a test catches a new id (D22); moving it into `conduct-check` is a followup if a second
  consumer appears.
- [The owner-run reading disagrees with the checker's actor] → it is the pane's display only, and
  goes once the checker reports `owner` itself (D25, the devkit-panel retro's row 7).
- [Ship leaves the pane] → `/conduct <id>` covers delivery, the approved mock has no Ship button,
  and `/ship-change <id>` can still be typed (D24).
- [A second reading of `tasks.md` lives in the panel] → the same expressions as the checker and an
  agreement test (D27); the checker stays the source of what is next.

## Migration Plan

Users update with `claude plugin update devkit-panel@devkit` and restart. The `view-4` tag
declines a stored 0.1.0 view (and the `view-3` of the build loaded for the first live round), so
the first refresh rebuilds it. Rollback: revert the merge
commit. The marketplace then serves 0.1.0 again, and its `view-2` tag declines the 0.2.0 view the
same way. No data or file outside `$.state` is involved.

## Open Questions

- The exact text `$.session.messages()` gives for a typed slash command. D3 accepts three forms,
  so this does not change the approach; the live check records which one appears.
- How phase 5 loads the 0.2.0 pack in the conducting session beside the installed 0.1.0: the
  dev-mods link (offered to the owner as "Turn them on"), or `CLAUDE_CODE_PLUGIN_DIRS` with the
  installed copy disabled for that session. The first round loaded it; the conducting session
  decides again at phase 5. Either way the tasks stay the same.
- For the owner at plan approval (requirements.md, Addendum):
  - whether the other open changes are shown at all (not answered; they stay a folded group while
    a change is conducted, as approved, with the new heading and hint, D24);
  - the summary line is English (the plan artifacts are), so a pt-BR pane shows it in English
    (D23);
  - the document tabs of screen 5 also hold `Requisitos`, `Prontidão` and `Aprovação`, which the
    mock's tab row does not show (D23);
  - `Copiar` uses `$.ui.copy`, a clipboard write on the owner's press (D13).
- What the desktop does with a `file:` link in a pane (D23), and whether the detail pane reads
  like the dialogs the owner meant (D20): both recorded at phase 5.
