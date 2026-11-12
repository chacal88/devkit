# Proposal

Change: `panel-conduct-view` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(requirements.md holds the grill and its 2026-11-11 addendum from the live check's first round;
release-rebase-pin retro rows 3 and 8, devkit-panel retro dogfood)

Summary: The devkit pane shows the change this conversation conducts (what it is, where it stands in the flow, what is pending, its documents) and the other open changes, as the owner's approved mock draws it.

## Why

devkit-panel 0.1.0 draws only the roadmap round's rows and the root checkout's change folders. A
single-change `/conduct <id>` and its child sessions never appear, which is the way the owner
works since ADR 0007. The owner found the pane hard to read: lines of text with long reasons, no
visible effect from a button, no session icons. The pack also fails to load in the npm Claude Code
2.1.227, which turns `claude plugin validate .` red for that CLI. This change makes the pane show
the change this session conducts, in a layout that reads like the app's own side panel.

The live check's first round (requirements.md, Addendum) showed that this was not enough: the
owner could not tell what the conducted change is about, where its documents are, which step of
the flow it is in, what the two sections are, or what the buttons do, and a delivery item's
reason was a paragraph of full commands. The owner then approved a visual mock of the pane
(`openspec/changes/panel-conduct-view/mock/`), and the revision builds it inside this change.

## What Changes

- **The top of the pane is the change this session conducts** (the mock's screen 1): its id, a
  one-line summary (the `Summary:` line of its `proposal.md`, else the first sentence of
  `## Why`) and `<repository> · branch <branch>`; a **Now** box with the current step, who acts
  (the owner, Claude or GitHub) as a pill, what is left and what comes after, and `Continue here`
  (fills `/conduct <id>`); the **Steps** of the whole flow (Requirements, Plan, Readiness, Your
  approval, Implementation, Review, Proofs, PR and checks, Merge, Retro and archive) marked done,
  partly done, current or pending; the **Pending** tasks, one per line; the **Documents**; and the
  **Sessions of this change** with a state each, the archived ones folded. Clicking a child opens
  it in the app (layout only). The pane works out which change this session conducts from the
  session's own transcript (the newest `/conduct <id>`), then from this session's own child
  sessions, matched by the session prefix the checker gave each change. A prefix two changes
  share decides nothing (design D3).
- **One detail pane** (screens 2, 5 and 6; design D20, D21, D27): pressing a pending row, a step, a
  document, another open change or an error line opens one second pane (the API's dialog form:
  `focus`, `closeOnEscape`, `holdToasts`), closed by Escape or its ✕. The pending detail groups
  the open tasks by section with one sentence each and folds the full text with a `Copy` button;
  a step's detail shows its facts (the Implementation step: tasks done of the total, a glyph bar,
  the missing and the finished sections); a document is drawn as markdown with a tab per
  document, a section index and `Open in editor ↗`. A delivery item's reason is never drawn as
  the paragraph of full commands again: commands become short labels such as `test panel (app)`.
- **The other open changes**: every change open in a `git worktree list` path, in one folded
  group at the bottom (`Other open changes`, with a dimmed hint that they are independent of this
  conversation and none has to finish first), each with its progress and `Conduct`; with no
  conducted change they are the whole pane (screen 3, `No change in this conversation`). The
  conducted change never appears among them, nor does an id with an archived folder
  (`openspec/changes/archive/<YYYY-MM-DD>-<id>`), such as a leftover local branch of an archived
  change. Ship leaves the pane (design D4, D24).
- **BREAKING (pane content)**: the roadmap round view, the round line, the `Archived` group and the
  once-per-session `--change` probe are removed. The pane needs devkit-openspec 0.10.0 or newer
  (`conduct-check --change`). With an older checker it shows one line.
- **The layout is the approved mock**, screen by screen, drawn with the mod's text, glyphs
  (`✓ ◐ ● ○ ›`), buttons and links, each missing look named with its substitute; dividers of one
  width that never wrap; a dimmed footer with the last and next refresh. Colours come from the
  app's theme keys (design D8, D26).
- **Buttons visibly fill**: `Continue here` names the command it puts in the box; after a press
  the button shows a check mark beside its own label, and its hint and a toast read the localized
  "in the box, press Enter"; the row's text is never cut by it (design D10, revised). They still
  never submit.
- **Who acts on an owner-run phase**: a phase whose `tasks.md` heading carries `owner-run` shows
  the owner as who acts (design D25), a display reading; the checker still reports `session`.
- **The band** (the mock's screen 4) shows the conducted change (glyph, id, current step, what is
  left, who acts), or the number of open changes, plus `Open panel` / `Close panel`.
- **Loads in both CLIs**: `userConfig.language` drops `options`, and `hooks/hooks.json` carries an
  empty classic `hooks` record beside `modules`. On 2026-11-11, a copy with both edits passed
  `claude plugin validate` on npm 2.1.227 and was listed `enabled` there. It also passed the
  bundled 2.1.317's validate and its 59 tests.
- Release: devkit-panel 0.1.0 → 0.2.0, marketplace 0.13.0 → 0.14.0, CHANGELOG
  `## 0.14.0 — panel: the conducted change`. No other pack changes (design D15).

Non-goals (requirements.md, Out of scope): no change to the conduct skill, `ship-change` or any
checker; no button that sends; nothing of the old orchestrator mod. Also out: several top cards
for a `/conduct round <n>` (one card, design D3), and deliver-check runs for the rows below the
top card. Out of the revision: a centred modal (the mod API has none), teaching `conduct-check`
an owner-run phase (the devkit-panel retro's row 7 followup), and a `Summary:` line required of
every plan (a planner or schema change of its own).

## Acceptance criteria

- AC-1 `conducted-change-on-top` — While this session conducts a change (a single-change `/conduct <id>` included), the top of the pane is one card for that change, with its id, its next step and who acts now (the owner, Claude, or GitHub), drawn from `conduct-check --json --change <id>`; the same change never appears again lower in the pane.
- AC-2 `phase-progress` — The Implementation step shows the change's task progress ("103 of 107 tasks"), read from the change's `tasks.md` as the checkers read it, and its detail (screen 6) shows the total with a percentage and a glyph bar, the sections still open, and the finished ones dimmed; no line is drawn wider than the pane or over another line's text.
- AC-3 `pr-and-checks` — When the change has a PR, the `PR and checks` step shows its number and whether its checks are green, red or running, and its detail links the PR; with no PR it shows none.
- AC-4 `delivery-items` — The eight delivery-contract items from `deliver-check <id> --json` are each shown, with their status and a short list of what is pending (task ids, commands as short labels, criteria ids, a `+N` tail; never the raw paragraph), in the detail of the step that holds them (items 1 and 4 under Proofs, 2 and 3 under Review, 5 to 8 under PR and checks), and the full text stays one press away.
- AC-5 `child-sessions-with-icons` — The top section lists the change's linked child sessions (`^<sessionPrefix>[0-9]+$`) under "Sessions of this change": each one not archived as a row with its phase number and phase title and its state, the archived ones folded into one "N archived" row; clicking a session opens it in the app and starts, stops or archives nothing.
- AC-6 `other-changes-collapsed` — The other changes open in a worktree (not the conducted one, and not one whose id has an archived folder `openspec/changes/archive/<YYYY-MM-DD>-<id>` in the root checkout or its own worktree) are one folded group at the bottom of the pane, "Other open changes" with their count; unfolded, each has its id, its progress in a few words and a `Conduct` button.
- AC-7 `no-conducted-change` — When this session conducts no change, the pane is the mock's screen 3: the title "No change in this conversation", one sentence saying that the button puts the command in the text box and the owner presses Enter, and the changes open in this repository listed open, each with its progress and a `Conduct` button.
- AC-8 `buttons-visibly-fill` — Clicking a button fills the prompt box with its exact command and never submits it; before the press, `Continue here` has a dim hint naming the command it puts in the box; after it the button shows a check mark beside its own label and the hint (or a dim line under its row) and a toast say, localized, "in the box, press Enter", without cutting the row's own text; where no prompt box can take the text the command is toasted, as today.
- AC-9 `band-shows-conducted-change` — The one-line band above the prompt (screen 4) shows the conducted change's actor glyph, its id, its current step with a few words of fact, what is left, and who acts, and the `Open panel` / `Close panel` button; with no conducted change it shows the number of open changes.
- AC-10 `loads-in-both-clis` — devkit-panel loads and `claude plugin validate .` passes with both the npm Claude Code 2.1.227 and the app's bundled Claude Code (2.1.321 since 2026-11-12).
- AC-11 `read-only-kept` — `claude plugin validate plugins/panel` lists no `prompt.submit`, `fs.write`, `store` or `clock.after`, and the module never calls `start_session`, `stop_session`, `archive_session` or `send_message`; `claude plugin test plugins/panel` passes, covering the criteria above on the `terminal` and `desktop` surfaces.
- AC-12 `looks-like-app-panel` — The pane follows the owner-approved mock (`openspec/changes/panel-conduct-view/mock/`) screen by screen: the main pane (screen 1), the pending detail (2), the empty state (3), the band (4), the document pane (5) and the step pane (6), drawn with the mod's text, glyphs, buttons and links and the substitutes design D8 names; sections separated by dividers of one width that never wrap; every row's state readable from its glyph and a few words; a dimmed footer with the last and next refresh; the owner confirms in the live check that it is readable ("LEGÍVEL").
- AC-13 `live-check` — Loaded in the devkit repository through the app while a `/conduct <id>` runs, the pane shows that change on top with its summary, Now box, steps, pending list, documents, sessions and next step; the pane's text and the owner's reading of it are recorded in `evidence.md`, with this first round's findings and how each reads in the second round, screen by screen against the mock.
- AC-14 `flow-steps-you-are-here` — The top section lists the whole flow as ten steps (Requirements, Plan, Readiness, Your approval, Implementation, Review, Proofs, PR and checks, Merge, Retro and archive), each marked done (✓), partly done (◐), current (●, its name in bold) or pending (○) from what `conduct-check --change` and `deliver-check` already report, with a few words of fact on its right and a `k of 10` count; pressing a step opens its detail.
- AC-15 `summary-and-documents` — The top section shows the change's id, one line saying what it is (the `Summary:` line of its `proposal.md`, else the first sentence of its `## Why`) and `<repository> · branch <branch>`; a Documents row (Proposal, Design, Tasks, Specs, Proofs, those that exist) opens the document pane (screen 5): a tab per document, an index of the file's sections, the file drawn as markdown, and an `Open in editor ↗` link, all read-only.
- AC-16 `detail-pane` — Pressing a pending row opens the detail pane of screen 2: one pane (one id, retitled per subject) that asks for the keyboard and closes on Escape or on its ✕; the pending tasks grouped by `tasks.md` section with a count, one short sentence each, a callout saying who acts, and the full text folded with a `Copy` button; nothing in it starts, submits or writes a file; covered on the `terminal` and `desktop` surfaces.
- AC-17 `sections-say-what-they-are` — Every heading, hint and button of the six screens reads as the approved mock writes it in pt-BR ("This conversation conducts", "Now", "Continue here" with its hint, "Steps", "Pending", "Documents", "Sessions of this change", "Other open changes" with its dimmed hint "independent of this conversation; none has to finish first", "No change in this conversation", "Conduct", ...), with an English text for `language: en`; a test pins both languages.
- AC-18 `owner-run-actor` — On a phase whose `tasks.md` heading carries the `owner-run` marker, the Now box and the band show the owner as who acts, not Claude.
- AC-19 `now-box` — Under the change's head, a "Now" box shows the current step in a few words, who acts as a pill, one line saying what is left and what comes after, and a `Continue here` button (plus `Approve plan` or `Answer retro` when the step asks for them).
- AC-20 `pending-list` — A "Pending" section lists, one per line, the change's open tasks (id and a short title, with a short tag saying who or what they wait on) or, with none open, the current step's pending things; pressing one opens the pending detail (screen 2).
- AC-21 `step-detail` — Pressing a step opens its detail; the Implementation step's (screen 6) shows the tasks done of the total with a percentage and a glyph bar, the open sections ("Missing") with their counts and tags, each opening its pending detail, the finished ones ("Done") dimmed, and a `See tasks.md` link that opens the document pane.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs, this repository keeps no
`openspec/specs/`, and every archived change set `skip_specs: true`, so this one does too
(`.openspec.yaml`). The acceptance criteria above are the behaviour. `plugins/panel/hooks/*.test.tsx`
pins them on the `terminal` and `desktop` surfaces, and the pack's README and
`docs/openspec-flow.md` document them. The contract (`flags=[contract]`) is what the panel reads,
and none of it changes: `conduct-check --json --change <id>` (version 2), `deliver-check <id>
--json` (version 1, now read for `phases`, `pr` and the `details` of items 1, 2, 4 and 6 as well), and the app's
`list_sessions` rows. The revision also reads the change folder's own files (which documents
exist, `proposal.md`'s summary line, `approval.md`'s date, the tasks of `tasks.md`), read-only
(design D23, D27).

### Modified Capabilities

None.

## Impact

- devkit-panel (`plugins/panel/`): the manifest and `hooks/hooks.json`; `hooks/register.tsx`,
  `pane.tsx`, `report.ts`, `project.ts`, `sessions.ts`, `commands.ts`, `i18n.ts`, new
  `hooks/conducted.ts`, `hooks/detail.ts` and `hooks/steps.ts` (the second reading of `tasks.md`,
  design D27); `types/index.d.ts`; the tests and
  fixtures; `README.md`.
- The mod API calls the revision uses: `$.ui.open`, `$.ui.close`, `$.fs.read`, `$.fs.exists` and
  `$.fs.list`, already on the pack's `calls:` line, plus `$.ui.scroll` and `$.ui.copy` on an
  owner's press in the detail pane (the mock's section index and `Copy`). Nothing new starts,
  submits or writes a file (design D13).
- `openspec/changes/panel-conduct-view/mock/`: the approved mock, kept with the change.
- App tools: `mcp__ccd_session_mgmt__list_sessions` (now with `include_archived`), and on a click
  only, `mcp__ccd_window__open_session_in` (layout only, design D9).
- Release and docs: `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/openspec-flow.md` ("The
  panel: devkit-panel"), `CONTRIBUTING.md` (the npm CLI now validates the repository),
  `docs/catalog.md` (regenerated from the new description).
- No checker, skill, agent, schema, hook or ADR changes.

Dependencies: devkit-openspec 0.10.0 or newer (`--change <id>`, ADR 0007), present on main
(0.12.0). The app's `open_session_in` and `list_sessions` (desktop app 4.23118.0, bundled Claude Code
2.1.317).

Exit criteria (the gates of tasks.md, 1.9, 2.9, 3.9, 4.9 and 5.9, each part run alone): the bundled
binary's `plugin test plugins/panel` and `plugin validate plugins/panel` / `plugin validate .`,
the binary named without its version as
`"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"`
(2.1.321 since the app update of 2026-11-12, design D16);
the npm binary's `plugin validate plugins/panel` and `plugin validate .`; `node --test
plugins/openspec/hooks/guard.test.mjs`; `python3 scripts/check.py`; `python3 scripts/gen-catalog.py
--check`. The revision's gate 4.9 adds no new command: its parts are parts of the earlier gates.

Decisions cited: ADR 0001 (no harness; a view action is not driving a session), ADR 0006 (child
names `<sessionPrefix><n>`, the start chain that makes buttons fill-only), ADR 0007 (single-change
conduct; the roadmap is a report; its review trigger on a panel listing candidates, design D4).
Open decisions inherited: none (the repository keeps no open-decisions log).
