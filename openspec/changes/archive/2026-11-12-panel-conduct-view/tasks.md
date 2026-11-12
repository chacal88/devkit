# Tasks

Change: `panel-conduct-view` · Date: 2026-11-11 · Owner: Kaue (chacal88)

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. Two binaries are named by absolute path inside the
backticks (design D16):

- the desktop app's bundled Claude Code, named without its version so an app update does not
  break the gates (the last match of the glob, 2.1.321 on 2026-11-12; design D16):
  "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
  (the only one with `plugin test`);
- the npm Claude Code 2.1.227, "$HOME/.nvm/versions/node/v22.22.0/bin/claude".

Precondition of every gate with `plugin test`: the bundled binary's `plugin test --help` prints `Run
a mod's tests`. When it prints the rollout-switch refusal instead (exit 0 as well), run the bundled
binary once with `-p "ok" --max-turns 1 --model haiku` and network access, then check again. The
switch holds for about two minutes, which is why `plugin test` is the first part of each gate.

Work only in the worktree `.claude/worktrees/panel-conduct-view-404c57` on branch
`panel-conduct-view`. Plain bullets under `## Workflow follow-up` are not tasks: `deliver-check`
counts every checkbox of this file.

Revised 2026-11-11 after the live check's first round (requirements.md, Addendum) and the owner's
approval of the mock in `openspec/changes/panel-conduct-view/mock/` (design D8, D20 to D27):
phase 4 is new and builds it; the live check, first planned as phase 4, is phase 5 and runs again
on that head. Phases 1 to 3 stay as built and ticked.

Where proofs go (design D19): `evidence.md` is written by `pr-verifier` alone. A check inside a
phase (the npm load in 1.1, the `calls:` line at 1.9, 2.9 and 4.9, the type check in 2.7 and 4.8) catches a
failure early: when it fails, the phase ends with `Outcome: failure: <reason>`. It leaves no
record. `pr-verifier` re-runs each of those commands and records what it sees. Its agent
definition and the ship-change `verify` prompt do not name these re-runs, so the conducting
session appends their list (the "Workflow follow-up" bullets below) to that dispatch prompt.
Phase 5's live record is the one exception to re-running: the conducting session appends it to
the same dispatch prompt (5.2).

The acceptance criteria carry the ids `deliver-check` item 4 reads (`AC-<n>`, from the
`## Acceptance criteria` section of `proposal.md`), each with its slug beside it. The same id and
slug pair is used in `requirements.md`, `design.md`, every task line, every test name and every
evidence row:

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `conducted-change-on-top` | 1.4, 1.5, 2.2 |
| AC-2 | `phase-progress` | 1.2, 2.2, 4.3, 4.6 |
| AC-3 | `pr-and-checks` | 1.2, 2.2, 4.4, 4.7 |
| AC-4 | `delivery-items` | 2.2, 4.2, 4.7 |
| AC-5 | `child-sessions-with-icons` | 1.4, 1.5, 2.2, 2.3, 4.6 |
| AC-6 | `other-changes-collapsed` | 1.3, 1.5, 2.2, 4.6 |
| AC-7 | `no-conducted-change` | 1.5, 2.2, 4.6 |
| AC-8 | `buttons-visibly-fill` | 2.4, 4.6 |
| AC-9 | `band-shows-conducted-change` | 2.5, 4.6 |
| AC-10 | `loads-in-both-clis` | 1.1, 1.9, 3.1, 3.9, 4.9 |
| AC-11 | `read-only-kept` | 1.9, 2.6, 2.9, 3.9, 4.8, 4.9 |
| AC-12 | `looks-like-app-panel` | 2.2, 2.9, 4.6, 4.9, 5.2 |
| AC-13 | `live-check` | 5.1, 5.2, 5.9 |
| AC-14 | `flow-steps-you-are-here` | 4.4, 4.6 |
| AC-15 | `summary-and-documents` | 4.5, 4.6, 4.7 |
| AC-16 | `detail-pane` | 4.7 |
| AC-17 | `sections-say-what-they-are` | 4.1, 4.6 |
| AC-18 | `owner-run-actor` | 4.4, 4.6 |
| AC-19 | `now-box` | 4.4, 4.6 |
| AC-20 | `pending-list` | 4.3, 4.6 |
| AC-21 | `step-detail` | 4.7 |

- **Test names.** A test that proves a criterion starts its name with the id and the slug, for
  example `AC-1 conducted-change-on-top: a /conduct <id> transcript draws that id first`; a test
  for two criteria names both (`AC-6 other-changes-collapsed, AC-7 no-conducted-change: ...`).
  Tests for a design rule only (the back-off, the ambiguous prefix) start with the design
  section, as 0.1.0's `D5: ...` did.
- **Evidence rows.** `pr-verifier` writes one row per id, AC-1 to AC-21, in its
  `| AC-N | <criterion> | <proof and where it is> | pass |` form. The criterion cell starts with
  the slug. A row's cells name no other `AC-<n>` id: `deliver-check` counts every row that
  mentions an id as a result for that id, so a cross-reference goes by slug.

Gate 3.9 holds the guard suite (about nine minutes), so it runs as a background Bash and never as
a foreground tool call, which stops at 600 s (design D16).

## 1. Loading in both CLIs, and the data the pane draws (AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-10, AC-11)

- [x] 1.1 Make the pack load in both CLIs (design D2):
  - edit `plugins/panel/.claude-plugin/plugin.json`: drop `options` from `userConfig.language`;
    the description becomes `Language of the pane, band and toasts: pt-BR or en`;
  - edit `plugins/panel/hooks/hooks.json` to `{ "hooks": {}, "modules": ["./register.tsx"] }`;
  - add a `report.test.tsx` case: `langOf` maps `en` to en, and anything else (`fr`, empty,
    absent) to pt-BR.

  Verify:
  - both binaries pass `plugin validate plugins/panel` and `plugin validate .`;
  - with `CLAUDE_CONFIG_DIR=<scratchpad>/npm-cfg` (a new, empty folder), the npm binary runs `plugin marketplace add <worktree>`, `plugin install devkit-panel@devkit --scope
    user` and `plugin list`, and the list shows devkit-panel `Status: ✔ enabled`
    (AC-10 loads-in-both-clis). Anything else ends the phase with `Outcome: failure`. `pr-verifier`
    re-runs these three commands for the record (design D19). Never use the owner's `~/.claude`
    for this.
- [x] 1.2 Read the rest of `deliver-check` (design D7):
  - in `plugins/panel/types/index.d.ts`: `Phase`; `DeliverReport.pr` and `.phases`;
    `DeliverItem.details`; `ChangeEntry`; the new `PanelView`; `PluginState['devkit-panel']` with
    `view` (shape `view-3`), `collapsed`, `isRefreshing` and `filled`;
  - in `plugins/panel/hooks/report.ts`, `parseDeliver` reads them tolerantly;
  - re-capture `plugins/panel/hooks/fixtures/deliver.ts`, keeping `phases`, `pr` and item 6's
    `details`;
  - add `plugins/panel/hooks/fixtures/change.ts` (real `conduct-check --json --change <id>`
    stdout from this repository at a delivery step), each with its capture line.

  Verify with `report.test.tsx`: phases parse with `gate.done` and `open`; `pr` is null or
  `{ number, url }`; item 6 maps to green, red, running or unreadable from its status and
  `details`, and `open` with neither `failing` nor `pending` is unreadable (AC-3 pr-and-checks); the phase-progress helper gives the current phase, the total and
  the finished phases from `phases` (AC-2 phase-progress); a newer `version` is still the error line.
- [x] 1.3 List the changes in progress in `plugins/panel/hooks/project.ts` (design D4, D6):
  - `parseWorktrees(porcelain)` gives paths and branches;
  - `candidates($, root, worktrees)`: the folders under each path's `openspec/changes` minus
    `archive`, plus the branches of every worktree but the first that match
    `^[A-Za-z0-9][\w.-]*$`, de-duplicated, each with its `source`;
  - `checkerVersionOk(label)`: `repo` or unreadable is ok, below `0.10.0` is `old-checker`;
  - `changeFolders` goes;
  - add `plugins/panel/hooks/fixtures/worktrees.ts`, the real `git worktree list --porcelain` of
    this repository, with its capture line.

  Verify with `report.test.tsx`: the fixture parses, and `claude/<name>`, a detached head and
  the main checkout's branch are not candidates. A test quotes the conduct skill's no-argument
  wording (`plugins/openspec/skills/conduct/SKILL.md`) and checks the rule against it. The
  version gate gives `0.9.1` → old, `0.10.0` and `repo` → ok (AC-6 other-changes-collapsed).
- [x] 1.4 Find the conducted change (design D3, D9):
  - create `plugins/panel/hooks/conducted.ts`: `conductArgs(messages)` reads the newest conduct
    invocation in its three forms (the `<command-name>`/`<command-args>` text, a first line
    `/conduct ARGS` or `/<plugin>:conduct ARGS`, a `Skill` tool use) and returns a single id
    only for one-id ARGS; `ambiguousPrefixes(entries)` gives every `sessionPrefix` that the
    stored rows of two or more candidates carry; `conductedId(args, ownChildren, entries,
    previous)` follows the D3 order, matches children only against the stored, non-ambiguous
    prefixes, keeps `previous` only in the D3 "with no usable entry" case, and returns
    `sharedWith` for a signal-1 id whose prefix is ambiguous;
  - in `plugins/panel/hooks/sessions.ts`: `LIST_INPUT` becomes
    `{ linked: true, include_archived: true, limit: 100 }`; add `ownChildren(rows)` (`startedBy`
    set and not the `sessionId` of a family row), `phaseOf(name, prefix)`, the `OPEN` constant
    (`mcp__ccd_window__open_session_in`), and one `callAppTool($, name, input)` that accepts only
    `LIST` and `OPEN`; the "one session tool" comment changes as design D9 says;
  - add `plugins/panel/hooks/fixtures/messages.ts` (the transcript row quoted in design Context,
    plus the other two forms) and `plugins/panel/hooks/fixtures/sessions.ts`.

  Verify with `report.test.tsx`:
  - the three forms give the id; `round 5`, an empty ARGS and an older single id behind a newer
    `round 5` give none;
  - a family seen from the conducting session gives its children as own children; the same
    family seen from a child gives none; rows without `startedBy` give none;
  - `add-x` and `add-x-pagination` never cross;
  - two ids with the same 20-character start (`checkout-discount-codes-a` and
    `checkout-discount-codes-b`, both stored with `sessionPrefix` `checkout-discount-co-p`) and an
    own child `checkout-discount-co-p2`: with a `round 5` transcript neither is conducted
    (no signal-2 match); with `/conduct checkout-discount-codes-a` that id is conducted, with
    `sharedWith: ['checkout-discount-codes-b']`, and b is never conducted;
  - a candidate whose stored entry has an `error` and a last good `row` still matches through its
    prefix; a candidate with no row takes no part; the previous children-found id is kept only
    when a fetch failed in this run (AC-1 conducted-change-on-top, AC-5 child-sessions-with-icons).
- [x] 1.5 Rewrite the refresh in `plugins/panel/hooks/register.tsx` (design D3, D4, D5, D6):
  - the root and opt-in, then `locateChecker`, then the version gate;
  - `git worktree list --porcelain` through `$.process.run` (10 s);
  - the candidates, then `$.session.messages()`, then `list_sessions` under `mayList`;
  - then `conduct-check --json --change <id>` for every candidate with no stored entry, on any
    trigger, pane open or closed, except during a rate-limit back-off (design D3, D5);
  - then the D3 resolution on the stored entries, then the conducted change's checkers;
  - `conduct-check --json --change <id>` per other candidate, at most three at once, with the
    5-minute rule for the non-conducted rows on light triggers, and none with the pane closed;
  - a failed run keeps the entry's last good `row` and sets its `error`;
  - `archived` rows and branch-only exit-3 rows are kept as `dropped` entries, out of the
    in-progress list;
  - the rate-limit back-off of design D5: a `/rate limit/i` line sets `backoffUntil`; until
    then a light trigger runs no checker and a full trigger runs only the conducted change's two,
    so a candidate with no stored entry is not fetched until the back-off ends;
  - `deliver-check <id> --json` for the conducted change in its worktree;
  - a full trigger during a light run queues one full run.

  The round run, the `--change` probe, `fixtures/round.ts` (and `fixtures/change-option.ts` if
  nothing uses it) and the per-row deliver runs go. Keep a minimal `ui.render` for the pane that
  draws `renderText`'s lines, so the hook chain is complete; task 2.2 replaces it.

  Verify with `plugins/panel/hooks/panel.test.tsx`, on `['terminal', 'desktop'] as const`:
  - a `/conduct <id>` transcript draws that id first with its next step and actor, and the id is
    absent from the in-progress lines (AC-1 conducted-change-on-top);
  - with no conduct invocation and no own child, the text has the no-conducted line and every
    candidate (AC-7 no-conducted-change);
  - a `round 5` transcript plus an own child named `<prefix>2` makes that change the top one,
    with `via: children`;
  - a compacted transcript (no conduct invocation left) plus the same own child gives the same
    top card on a light trigger and with the pane closed, from the stored rows, with no checker
    run for any other candidate;
  - a candidate that appears after session start is fetched once on the next light trigger (pane
    open and pane closed), and not again until the 5-minute rule; a `dropped` id is not fetched
    on light triggers;
  - a deliver-check item reason `GraphQL: rate limited` sets the back-off: the next light trigger
    runs no checker and draws the rate-limit line, a full trigger runs only the conducted change's
    two checkers, a candidate that appears during the back-off is not fetched by either, and the
    first light trigger after `backoffUntil` runs as usual and fetches it. The reason text is a
    fixture: it is `gh`'s own wording, which `deliver-check` passes through `ghError` as an item
    reason; nothing in this repository produces the string, so the test stands in for a real
    rate-limited `gh` answer;
  - the recorded `process.run` calls per trigger: a light trigger runs the conducted change's two
    checkers and no other row younger than 5 min; a full trigger runs every candidate; the pane
    closed runs only the conducted change;
  - an `archived` row and a branch-only exit 3 are absent;
  - a folder candidate with exit 3 is a row with its error;
  - an installed checker `0.9.1` is the one old-checker line and runs nothing;
  - `list_sessions` is asked with the new input, and with `ask` no `tool.call` is made
    (AC-6 other-changes-collapsed, AC-5 child-sessions-with-icons).
- [x] 1.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate plugins/panel && "$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate plugins/panel && "$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate .` green:
  - the bundled validate report's `calls:` line lists no `$.prompt.submit`, `$.fs.write`,
    `$.store`, `$.clock.after` or `$.session.send` (AC-11 read-only-kept). The implementer reads it
    before ending the phase; `pr-verifier` re-runs the validate and records the line (design
    D19);
  - the tests cover AC-1 conducted-change-on-top, AC-2 phase-progress, AC-3 pr-and-checks,
    AC-5 child-sessions-with-icons, AC-6 other-changes-collapsed and AC-7 no-conducted-change at the data
    level, plus AC-10 loads-in-both-clis.

## 2. The pane, the band, the buttons and the texts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-12)

- [x] 2.1 Write every text of design D12 in `plugins/panel/hooks/i18n.ts`, in pt-BR and en:
  - the headings, the no-conducted line, the group labels, the phase label, the actor names;
  - the step short labels for every step of `conduct-check`'s `actorOf` (at most four words
    each) and the eight item names;
  - the filled label and toast, the sidebar hint, the old-checker line, the footer, the
    shared-prefix line, the rate-limit line, and the band lines.

  The fill texts are unchanged except `Conduct`, always `/conduct <id>`.

  Verify with a `report.test.tsx` case: both languages have the same keys; every step label is
  at most four words; an unknown step falls back to its id.
- [x] 2.2 Rewrite `plugins/panel/hooks/pane.tsx` to the layout of design D8:
  - the header with `Refresh`, the error lines;
  - the top section: head with actor, the foldable next step, the `━` phase bar, the PR `Link`
    and its checks, the folded Delivery group with foldable reasons, the Sessions group with
    glyphs and phase numbers, the owner buttons;
  - the no-conducted line; the In progress group (folded while a change is conducted, open
    otherwise) with rows of glyph, id, step label and `Conduct`, foldable to the state and
    reason, and "show more" after six rows;
  - the footer: age, next tick, checker label;
  - colours from theme keys only, the single-cell glyph table;
  - `renderText` with every fold open, plus `via`.

  Replace task 1.5's minimal render in `register.tsx` and wire the fold keys.

  Verify with `panel.test.tsx`, on `terminal` and `desktop`:
  - the top card's text in order: id, actor, step label, `phase 2 of 3` with the bar, `PR #n`
    and the checks word, `Delivery` with `n/8` (AC-1 conducted-change-on-top, AC-2 phase-progress,
    AC-3 pr-and-checks);
  - no PR line without a PR;
  - Delivery folded shows no item; unfolded shows the eight items with glyphs; a reason appears
    only after its item unfolds (AC-4 delivery-items);
  - each child row has its glyph, `phase n` and state word for running, idle and archived rows;
    with `sharedWith` set, the Sessions group has no row and the one shared-prefix line naming
    the other id (AC-5 child-sessions-with-icons);
  - during a back-off the rate-limit line is drawn and the footer shows the pause time;
  - the in-progress group is folded with a conducted change and open without one, every row with
    `Conduct` (AC-6 other-changes-collapsed, AC-7 no-conducted-change);
  - no line of a folded view holds a `reason` sentence; every section is separated by a `─` rule;
    the footer reads the age and the next tick (AC-12 looks-like-app-panel);
  - `language: 'en'` draws English.

  One `mobile` mount still draws.
- [x] 2.3 Open a child on a press, in `register.tsx` and `pane.tsx` (design D9):
  - `open:<sessionId>` is a `Button` only when `canOpen`;
  - the handler: `tool.check` deny → a toast naming the tool; `allow` or `ask` → `callAppTool`
    with `OPEN`, `{ session_id, target: 'split' }`, then once with `'window'` on an error
    answer; a `{ deny }` or a rejection → one toast; the app's error text is toasted;
  - tool not listed → the sidebar hint, and no check or call.

  Verify with `panel.test.tsx`, on `terminal` and `desktop`:
  - a press calls `OPEN` with the row's `sessionId`, and no other session tool is called;
  - an error answer makes exactly one `window` call;
  - with `deny` there is no call and one toast;
  - with the tool unlisted, the row is plain text;
  - no refresh, timer tick or render ever calls `OPEN` or `tool.check` for it
    (AC-5 child-sessions-with-icons).
- [x] 2.4 Make the fill visible (design D10):
  - in `register.tsx`, the `filled` atom set on `isFilled: true`, plus the toast;
  - the button label switches while its key is `filled.key`;
  - the mark is cleared at the next main-loop `turn.complete`, on another fill, and at a refresh
    where `$.prompt.read().text` differs;
  - `isFilled: false` toasts the command as in 0.1.0.

  Verify with `panel.test.tsx`, on `terminal` and `desktop`:
  - each owner button fills its exact text with `mode: 'replace'`, then reads the filled label,
    and the toast list holds the filled text;
  - a `prompt.read` that differs clears it at the next refresh, and so does a `turn.complete`;
  - `isFilled: false` toasts the command and the label stays;
  - nothing is submitted (AC-8 buttons-visibly-fill).
- [x] 2.5 The band and the status text (design D11):
  - `renderBand` draws the conducted change (id, `phase n/m` when there are phases, step label,
    actor), else the in-progress count, else "no change in progress";
  - `next(e)` under a survey, outside a devkit project, or before a report;
  - `/devkit-panel status` and `mcp__devkit-panel__status` return `renderText`.

  Verify with `panel.test.tsx`, on `terminal` and `desktop`: the band's line for each case, the
  `Open`/`Close` toggle, and the status text naming the conducted change, `via` and the
  children (AC-9 band-shows-conducted-change).
- [x] 2.6 Read-only, end to end (design D13): one `panel.test.tsx` case scripts session start,
  every trigger, every button, a child press, both band states and the status tool. It records
  every `tool.call` name, every `prompt.submit` and every `session.send`. Verify: the names are a
  subset of `list_sessions` and `open_session_in`, and there are no submits and no sends
  (AC-11 read-only-kept).
- [x] 2.7 Type-check against the 2.1.317 contract, as devkit-panel's task 2.3 did:
  - a `tsconfig.json` in the scratchpad, whose one type root is the bundled skill's
    `plugin-authoring/types/claude-code.d.ts`
    (`/private/tmp/claude-501/bundled-skills/2.1.317/<hash>/plugin-authoring/`; when absent, the
    engine-written `plugins/panel/.claude-plugin/types/claude-code/index.d.ts`);
  - `include` names `plugins/panel/hooks` and `plugins/panel/types`.

  Verify: `npx -y -p typescript@5.6.3 tsc -p <that tsconfig>` exits 0; any other exit ends the
  phase with `Outcome: failure`. `pr-verifier` re-runs the same command for the record (design
  D19).
- [x] 2.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate plugins/panel` green:
  - the validate report's `calls:` line lists `$.session.messages`, `$.prompt.read` and
    `$.tool.call`, and none of `$.prompt.submit`, `$.fs.write`, `$.store`, `$.clock.after`,
    `$.session.send` (AC-11 read-only-kept). The implementer reads it before ending the phase;
    `pr-verifier` re-runs the validate and records the line (design D19);
  - the tests cover AC-12 looks-like-app-panel (layout), AC-1 conducted-change-on-top, AC-2 phase-progress,
    AC-3 pr-and-checks, AC-4 delivery-items, AC-5 child-sessions-with-icons, AC-6 other-changes-collapsed,
    AC-7 no-conducted-change, AC-8 buttons-visibly-fill and AC-9 band-shows-conducted-change on `terminal` and
    `desktop`.

## 3. Release files and docs (AC-10, AC-11)

- [x] 3.1 Versions and description (design D15):
  - devkit-panel `0.2.0` in `plugins/panel/.claude-plugin/plugin.json` and
    `.claude-plugin/marketplace.json`, with the D15 description in both;
  - marketplace `metadata.version` `0.14.0`;
  - run `python3 scripts/gen-catalog.py` so that `docs/catalog.md` carries the new description.

  Verify: `python3 scripts/gen-catalog.py --check` exits 0, and both binaries pass `plugin
  validate .`.
- [x] 3.2 Docs:
  - rewrite `plugins/panel/README.md`: what it shows (the conducted change and how it is found,
    the changes in progress, the layout, the child press), the buttons and their filled state,
    language, and "What it never does" with the two app tools and the validate report;
  - rewrite "The panel: devkit-panel" in `docs/openspec-flow.md` to match, with no round view;
  - `CONTRIBUTING.md`: step 4's sentence and the "Testing a mod pack" parenthesis say that the
    npm `claude` validates the repository and the pack again, and still has no `plugin test`;
  - `CHANGELOG.md`: `## 0.14.0 — panel: the conducted change`, with the devkit-panel 0.2.0
    bullet (the round view, `Archived` and the probe removed; devkit-openspec 0.10.0 or newer
    needed) and a Docs bullet.

  Verify: `python3 scripts/check.py` passes. That covers links, English outside backticks
  (every pt-BR UI string quoted in backticks), the install scope, and the CHANGELOG heading for
  0.14.0.
- [x] 3.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && "$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate . && node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green (AC-10 loads-in-both-clis, AC-11 read-only-kept). The mod test goes first: the refreshed switch holds for about two minutes, and the guard suite alone takes about nine. Run the whole gate as a background Bash, never as a foreground tool call, which stops at 600 s (design D16).

## 4. The approved mock: what the change is, where it stands, what is pending, and the detail pane (AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-12, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21)

The answer to the live check's first round (requirements.md, Addendum), built to the mock the
owner approved, `openspec/changes/panel-conduct-view/mock/` (design D8, D20 to D27). It is code, so
it goes to an implementer like phases 1 to 3. It changes the code those phases built and leaves
their tasks ticked. Every test of this phase mounts on `['terminal', 'desktop'] as const` unless
it says otherwise, and its name starts with the criterion's id and slug. Open each `*.dc.html` of
the mock folder before drawing its screen: the structure and the fixed texts are binding, the
example data (psim-kernel's `controlid-settings`) is not.

- [x] 4.1 The texts of the six screens (design D12 revised, D24), in `plugins/panel/hooks/i18n.ts`, pt-BR and en:
  - every row of design D12's table, pt-BR as the mock writes it;
  - the 0.2.0 texts the mock replaces go (the old headings, `Em andamento`, `Entrega`, `Entregar`,
    `labels.filled`).

  Verify with `plugins/panel/hooks/report.test.tsx`: both languages have the same keys; a test
  named `AC-17 sections-say-what-they-are: ...` pins every text of design D12's table in both
  languages; every button label and step name is at most four words.
- [x] 4.2 Short lists and command labels (design D21, D7):
  - create `plugins/panel/hooks/detail.ts` with `commandLabel`, `itemLines(item, part?)` (item 1's
    `tasks` and `proofs` parts, design D21) and `itemSummary`;
  - widen `DeliverItem.details` in `plugins/panel/types/index.d.ts` and read it tolerantly in
    `plugins/panel/hooks/report.ts#parseDeliver`;
  - add `plugins/panel/hooks/fixtures/deliver-open.ts`: the real stdout of `node
    plugins/openspec/hooks/deliver-check.mjs panel-conduct-view --json` captured in this worktree
    at phase 4, with its capture line (its item 1 carries the ten full gate commands).

  Verify with `report.test.tsx`:
  - the fixture's gate commands give `test panel (app)`, `validate panel (app)`, `validate .
    (app)`, `validate panel (npm)`, `validate . (npm)`, `guard suite`, `check.py` and
    `gen-catalog.py --check`, and no label holds `$HOME`;
  - item 1's `tasks` part gives its unticked ids with their word and its `proofs` part the evidence
    state and each missing gate with its word, eight lines then `+N`; the two parts share no line;
    a one-line summary of counts;
  - items 2, 4 and 6 read their `details`; an item without `details` splits its reason on `; `; an
    unknown command keeps a cut label (AC-4 delivery-items).
- [x] 4.3 Reading `tasks.md` (design D27):
  - in `plugins/panel/hooks/steps.ts`, `readTasks(text)` with the same two expressions as
    `deliver-check.mjs#parseTasks`, plus each task's short title, sentence, full text and tag, each
    section's short title, and the progress phrase of another change;
  - add `plugins/panel/hooks/fixtures/tasks.ts`: this change's `tasks.md` as it stands at phase 4,
    and the `phases` that `deliver-check panel-conduct-view --json` reported for that same file,
    with its capture line.

  Verify with `report.test.tsx`: the open ids and section titles of `readTasks` on the fixture equal
  `deliver-check`'s `phases`; short titles are at most 40 cells and hold no backtick; an owner-run
  task is tagged `você`, a gate `gate`; the progress phrases (`k de n tarefas`, `plano pronto · 0 de
  n`, a step label without `tasks.md`) (AC-2 phase-progress, AC-20 pending-list).
- [x] 4.4 The ten steps, the Now lines and the owner-run actor (design D22, D25):
  - `flowSteps(row, deliver, tasks, files)` in `plugins/panel/hooks/steps.ts`, with the step table,
    the done, partly done, current and pending rule, the facts, and the Now box's lines;
  - in `plugins/panel/hooks/report.ts`, `actorOf(row, deliver)` reads an owner-run phase as the
    owner;
  - in `plugins/panel/hooks/fixtures/change.ts`, three rows derived from the captured one, each
    with a line saying what was changed: `readiness` (planning), `implement` phase 2 of 3
    (mid-implementation) and `wait-checks` with a PR (delivery), with matching deliver reports and
    `tasks.md` texts.

  Verify with `report.test.tsx`:
  - the planning row has Requirements and Plan done, Readiness current, the rest pending; the
    mid-implementation row has Requirements to Your approval done and Implementation current with
    `k de n tarefas`; the delivery row has Implementation to Proofs done and PR and checks current
    with `PR #n` and its checks word (AC-14 flow-steps-you-are-here, AC-3 pr-and-checks);
  - `fix-review` makes Review current; `blocked` with `item: 6` makes PR and checks current; a
    change with no `tasks.md` has Implementation pending with no fact; `stop-merge-setup` falls
    back to the facts; every step id of `i18n.ts`'s step table is placed;
  - the Now lines for `implement`: `Implementar a fase n: <title>`, `Faltam k tarefas nesta fase.`
    and `Depois:` with the next three steps (AC-19 now-box);
  - a phase whose title holds `owner-run` gives the owner on `implement` and on `gate`; one without
    it keeps `session` (AC-18 owner-run-actor);
  - each row is given its `files` as a literal set (design D22): the planning row without
    `readiness.md` and `approval.md`, the other two with every plan file; Your approval's fact is
    `18 set` in pt-BR and `Sep 18` in en for `Date: 2026-09-18`, and `aprovada` / `approved` for an
    `approval.md` without a readable `Date:` (AC-14 flow-steps-you-are-here).
- [x] 4.5 The change's folder in the refresh (design D23, D27, D7):
  - `summaryOf(proposalText)` in `plugins/panel/hooks/detail.ts`;
  - in `plugins/panel/hooks/register.tsx#load`, for the conducted change: the folder, the
    repository name, `$.fs.exists` per document, `$.fs.list` of `specs/`, `$.fs.read` of
    `proposal.md`, `approval.md` and `tasks.md`, giving the `files` set that `flowSteps` takes (design
    D22); for every other candidate, its `tasks.md` progress; the view's shape tag `view-4`.

  Verify: `report.test.tsx` pins the summary source on this change's own `proposal.md` (its
  `Summary:` line), on a proposal without one (the first sentence of `## Why`) and on one with
  neither; `panel.test.tsx`, with the in-memory disk holding a change folder, records no checker
  run for these reads and stores the summary, the documents present and the progress
  (AC-15 summary-and-documents).
- [x] 4.6 The main pane, the empty state and the band: screens 1, 3 and 4 (design D8 revised, D10
  revised, D11 revised, D24, D26), in `plugins/panel/hooks/pane.tsx`, `plugins/panel/hooks/commands.ts`
  and `register.tsx`:
  - screen 1 top to bottom: header, the change (caption, id, summary, repository and branch), the
    Now box, Passos, Pendências, Documentos, Sessões desta change (archived folded), Outras changes
    abertas (folded), footer;
  - screen 3 with no conducted change; screen 4's band;
  - the buttons of design D24 (`Continuar aqui` with its hint, `Conduzir`, `Aprovar plano`,
    `Responder retro`); Ship, the Delivery group, the phase bar and the fold keys `delivery`,
    `next`, `item:<n>`, `change:<id>`, `sessions` go;
  - every rule clipped as design D26 says; the filled mark of design D10;
  - `renderText` as design D20 says (steps with facts, pending rows, documents, item short lists,
    `via`);
  - rewrite to the mock, or delete, the `panel.test.tsx` cases written for tasks 2.2, 2.4 and 2.5
    that assert what this phase removes: the `CONDUZIDA NESTA SESSÃO` heading, the `Em andamento`
    group, the Delivery group and its in-place reasons, the `━` phase bar, the `next`, `item:<n>`,
    `change:<id>` and `sessions` folds, the `Entregar` (Ship) button, the `labels.filled` sentence
    as a label, and the band's 0.2.0 line. Each case that keeps a criterion (AC-1 to AC-9) is
    rewritten under the same id and slug; none is deleted without its criterion being covered by
    a 4.x case.

  Verify with `panel.test.tsx`:
  - screen 1's sections in the mock's order, with `Esta conversa conduz`, the id, the summary and
    `<repo> · branch <branch>` (AC-15 summary-and-documents); the Now box with the pill and
    `Continuar aqui` and its hint (AC-19 now-box); ten steps with their glyphs and `k de 10`
    (AC-14 flow-steps-you-are-here); `Implementação` reads `k de n tarefas ›` and no line holds a
    bar (AC-2 phase-progress); the pending rows with tags, at most six then `+N` (AC-20
    pending-list); the five documents, each only when its file exists;
  - Sessões desta change lists the running and idle children as `Fase n · <title>` and folds the
    archived into `<n> arquivadas` (AC-5 child-sessions-with-icons);
  - Outras changes abertas is folded, and unfolded each row has its progress and `Conduzir`, with
    no Ship anywhere (AC-6 other-changes-collapsed);
  - with no conducted change the pane is screen 3, its title, sentence and open list
    (AC-7 no-conducted-change);
  - after a fill the button reads `✓ ` plus its label, the hint and the toast read the filled
    text, and the row still shows its whole progress (AC-8 buttons-visibly-fill);
  - the band reads glyph, id, step, what is left and `você age` or `Claude age`, with
    `Abrir painel` (AC-9 band-shows-conducted-change); on an owner-run phase the pill and the band
    read `você age` (AC-18 owner-run-actor);
  - on `terminal`, no line of the text form is longer than `bodyColumns`; on `desktop`, every rule
    is inside a Box with `overflow: 'hidden'` and its Text has `wrap: 'truncate'`
    (AC-12 looks-like-app-panel).
- [x] 4.7 The detail pane: screens 2, 5 and 6 (design D20, D23):
  - in `register.tsx`: the `DETAIL` id, the `detail` atom (`detail-1`), `openDetail(subject)` with
    `{ id: DETAIL, title, focus: true, closeOnEscape: true, holdToasts: true }` on a press only, the
    `isPlaced: false` fallback, the `on('ui.close', { id: DETAIL })` observer, the detail's
    `ui.render` hook, `Copiar` through `$.ui.copy`, the section index through `$.ui.scroll`,
    `togglePane` closing both, a fill from the detail closing it before its toast;
  - in `pane.tsx`: `buildDetail` and `renderDetail` for the five subjects, in the frame of design
    D20 (title, subtitle, `✕`, footer), and the ten step bodies of design D22, "Step details".

  Verify with `panel.test.tsx`:
  - a press on a pending row opens `DETAIL` with the title `Pendências` and the three dialog
    flags; the body has the callout, one group per section with its count, one sentence per task,
    and no `$HOME` text until `› Texto completo das tarefas` unfolds; `Copiar` calls `ui.copy` with
    the full text and then reads `✓ Copiado`; an `isCopied: false` answer draws the fallback line
    (AC-16 detail-pane);
  - a press on `Implementação` shows screen 6: `k de n tarefas`, the percentage, the clipped bar,
    `Faltam` with one row per open section opening its pending detail, `Feitas` dimmed, `Ver
    tarefas.md` opening screen 5 (AC-21 step-detail);
  - a press on `Provas`, with `fixtures/deliver-open.ts`, shows item 1's `proofs` part (the
    evidence state and the eight gate commands as labels, no `$HOME`, no unticked task id) and item
    4's ids with their word, each item under its head row and summary (AC-4 delivery-items);
  - a press on `Implementação` shows only item 1's `tasks` part, never a gate label
    (AC-4 delivery-items);
  - a press on `Revisão` shows items 2 and 3, the missing reviewers by name (AC-4 delivery-items);
  - a press on `PR e checks` with the delivery row of `fixtures/change.ts` shows a `Link` labelled
    `PR #n ↗` whose `href` is the report's `pr.url`, the checks word, and items 5 to 8; without a
    PR it shows `sem PR ainda` and item 5's line, and no `Link` (AC-3 pr-and-checks, AC-4
    delivery-items);
  - a press on `Requisitos`, `Prontidão` and `Sua aprovação` shows its fact and its `Ver <file>`
    press, which opens screen 5 on that file;
  - a press on `Design` shows screen 5: its tabs, `Seções` with one button per `## ` heading that
    calls `ui.scroll` with its key, the file's markdown from the in-memory disk, and the
    `Abrir no editor ↗` link with a `file://` href (AC-15 summary-and-documents);
  - a press on another row re-opens the same id with its title, never a second id; a refresh with
    the pane open redraws from the new view, and a subject that is gone draws its dim line; no
    refresh, tick or render calls `ui.open`, `ui.close`, `ui.scroll` or `ui.copy`;
  - a `ui.close` with origin `person` clears the subject; `✕` closes it; `Fechar painel` closes
    both panes;
  - an `isPlaced: false` answer leaves no detail open and toasts the row's summary;
  - one `mobile` mount draws screens 1 and 2.
- [x] 4.8 Read-only, types and docs (design D13, D15 revised):
  - extend task 2.6's scripted case in `panel.test.tsx` with the pending detail, a step, another
    change, an error line and a document opened in the detail pane, its fold, `Copiar`, a section
    press, a tab press, a fill from inside it and its close;
  - re-run task 2.7's type check on the revised code;
  - `plugins/panel/README.md`: the six screens, what each button fills, how the detail pane
    closes, the owner-run actor, and `$.ui.copy` in "What it never does" (a clipboard copy on your
    press, nothing sent); "The panel: devkit-panel" in `docs/openspec-flow.md` to match;
    `CHANGELOG.md`'s devkit-panel bullet of `## 0.14.0` gains the same points. Versions stay 0.2.0
    and 0.14.0; the manifests' description does not change.

  Verify: the recorded `tool.call` names are a subset of `list_sessions` and `open_session_in`,
  with no `prompt.submit` and no `session.send` (AC-11 read-only-kept); `npx -y -p
  typescript@5.6.3 tsc -p <the scratchpad tsconfig of 2.7>` exits 0 (any other exit ends the phase
  with `Outcome: failure`; `pr-verifier` re-runs it for the record, design D19); `python3
  scripts/check.py` passes (pt-BR UI strings quoted in backticks, one span per line).
- [x] 4.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate plugins/panel && "$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate plugins/panel && python3 scripts/check.py` green:
  - the bundled validate report's `calls:` line lists no `$.prompt.submit`, `$.fs.write`,
    `$.store`, `$.clock.after` or `$.session.send` (AC-11 read-only-kept); a `$.ui.copy` or
    `$.ui.scroll` it lists is one of the two presses of design D13. The implementer reads it before ending the phase;
    `pr-verifier` re-runs the validate and records the line (design D19);
  - the tests cover AC-2 phase-progress, AC-3 pr-and-checks, AC-4 delivery-items, AC-5
    child-sessions-with-icons, AC-6 other-changes-collapsed, AC-7 no-conducted-change, AC-8
    buttons-visibly-fill, AC-9 band-shows-conducted-change, AC-12 looks-like-app-panel (layout),
    AC-14 flow-steps-you-are-here, AC-15 summary-and-documents, AC-16 detail-pane, AC-17
    sections-say-what-they-are, AC-18 owner-run-actor, AC-19 now-box, AC-20 pending-list and AC-21
    step-detail on `terminal` and `desktop`, and the npm validate keeps AC-10 loads-in-both-clis.

## 5. Live check, owner-run (AC-12, AC-13)

This phase is the conducting session's, with the owner at the keyboard (design D17). When the
checker reports `implement` phase 5, the conducting session runs it itself:

1. it loads the worktree's pack into its own session;
2. it reads the status text;
3. the owner looks at the pane and says how it reads;
4. the conducting session writes 5.2's record to a file in its scratchpad, ticks 5.1, 5.2 and
   5.9, then goes on to review-change and pr-verifier, and appends to `pr-verifier`'s dispatch
   prompt the list of re-runs and the record (design D17, D19).

No tdd-implementer dispatch and no child session is used for this phase, because none of its
steps is code. A child session or implementer that receives phase 5 anyway ends at once with
`Outcome: failure: phase 5 is the conducting session's (tasks.md)` and changes nothing. (Phase 4
is code and goes to an implementer as usual.)

- [x] 5.1 Owner-run, by the conducting session (no implementer, no child session): load the 0.2.0 pack from `plugins/panel` of this worktree into the session that conducts
  `panel-conduct-view`, in place of the installed 0.1.0. The route is the conducting session's
  choice (design, Open Questions):
  - the session's dev-mods link, on the owner's "Turn them on";
  - or `CLAUDE_CODE_PLUGIN_DIRS` with 0.1.0 disabled for that session.

  Verify: the band reads `devkit · panel-conduct-view · ...` and `/devkit-panel status` names
  `via`. Fix any engine line about a skipped hook or a failed load before 5.2.
- [x] 5.2 Owner-run, by the conducting session (no implementer, no child session): with
  `/conduct panel-conduct-view` running and its phase sessions present:
  - read `mcp__devkit-panel__status` (or the owner's `/devkit-panel status`): the change on top
    with its next step, who acts, the phases, and `panel-conduct-view-p1` and onward with their
    state icons;
  - the owner presses a child session, `Continuar aqui`, a step, a pending row and its `Copiar`,
    and a document and its `Abrir no editor ↗`, and says what each did;
  - the owner compares each of the six screens with the approved mock, and reads again each place
    of the first round's findings (requirements.md, Addendum);
  - the owner says in their own words whether the pane reads as `LEGÍVEL`.

  The record is the status text, `via`, the transcript form that matched (design D3), what the
  presses did, the first round's findings each with the second round's reading, the screens
  against the mock, and the owner's reading. The conducting session writes it to a file in its
  scratchpad when this task ends and later appends it to `pr-verifier`'s dispatch prompt, after
  the ship-change `verify` prompt and the list of re-runs (design D19). `pr-verifier` writes it to `evidence.md`. An
  unreadable verdict is a `fix-defect` back to phase 4; new scope is a plan revision. Remove any temporary setting
  afterwards.
- [x] 5.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` green at the head that was loaded (AC-13 live-check, AC-12 looks-like-app-panel). Owner-run, by the conducting session (no implementer, no child session): it is ticked only once 5.2's record is written to the conducting session's scratchpad for `pr-verifier`.

## Workflow follow-up

- `pr-verifier` writes `evidence.md` after 5.9 (design D19). The conducting session appends
  this list, as written, to the ship-change `verify` dispatch prompt, followed by 5.2's record;
  `pr-verifier` writes one row per id, AC-1 to AC-21, as the header above says:
  - 5.2's record, from its dispatch prompt, as the proof of AC-13 live-check and of the owner half of
    AC-12 looks-like-app-panel;
  - its own re-run of 1.1's npm `marketplace add`, `install` and `plugin list` in a new scratch
    config folder, quoting the devkit-panel lines, as the npm half of AC-10 loads-in-both-clis;
  - its own re-run of the bundled `plugin validate plugins/panel`, quoting the `calls:` line, for
    AC-11 read-only-kept;
  - its own re-run of 2.7's `tsc` command (the one 4.8 re-ran on the revised code), with its exit
    status;
  - every gate part in its Gates table, the guard suite as a background Bash (design D16).
- After the merge: `claude plugin update devkit-panel@devkit` in the devkit repository, and a note in
  the retro on the first real use.
