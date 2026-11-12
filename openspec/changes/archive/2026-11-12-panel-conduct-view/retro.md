## Retro: panel-conduct-view

1. Went wrong: the pack shipped (PR #25, squash-merged at 8/8: devkit-panel 0.2.0, 163 tests, four reviewers approved, AC-1 to AC-21 proven), but the road was long, and most of the cost was in describing a screen in words.
   (a) The first plan described the pane in text, readiness approved it, three phases built it, and the owner could not read it at the live check (`nao to entendendo porra nenhuma`). Only a Claude Design mock with a real change's data (`controlid-settings` of psim-kernel), approved by the owner (`Está bom assim`) and saved in `mock/`, settled the layout. Even then the build differed from the mock until the owner compared them screen by screen, and three more rounds followed: backgrounds and spacing, a resize break, a doubled band. One cause was a wrong substitutes table in design D8: it said a mod cannot tint a Box, but `BoxProps` has `backgroundColor`.
   (b) The grill wrote kebab acceptance ids, as the requirements-grill skill asks, while `deliver-check` reads only `AC-<n>`. One readiness round was spent on that.
   (c) Loading the work-in-progress pack into the conducting session took three tries. `CLAUDE_CODE_PLUGIN_DIRS` in a project `settings.local.json` is never read: only the process env or `~/.claude/settings.json`. Reopening a session in the app does not restart its process; quitting the app does. What worked was a link in the session's dev-mods folder, hot-reloaded on every edit. That hot reload also showed a crash on a stored older view before the gate did.
   (d) The desktop surface draws no hairline. It does not clip by `height` or `overflow`, glyph runs sized to a column count wrap or end in `…` when the pane is resized, and a one-row Box is a full line tall. Dividers became spacing, and the bar became two Boxes with a percentage width.
   (e) The app updated its bundled Claude Code from 2.1.317 to 2.1.321 mid-change. Every gate line naming the absolute `<version>/<hash>` path broke, and the gates moved to a version-agnostic glob form, with one more plan revision and approval.
   (f) The gate flow had leaks:
   - `conduct-check.mjs:262` stops checking readiness and approval once a task is ticked, so a revised plan would have gone to phase 4 on an old approval.
   - `tdd-implementer` ticked gate tasks 3.9 and 4.9 itself, and the conducting session re-ran both.
   - `pr-verifier` abbreviated the gate commands in its Gates table (`$BUNDLED`), so item 1 stayed open until the cells carried the exact text.
   - Two stage-3 review writers wrote `Verdict: approved` over open important findings; `check-file` caught it and they rewrote.
   (g) `tsc` was red at review time (a duplicate `width`, the `vscode` surface, a missing `isCollapsed`), and only `pr-verifier`'s re-run of task 2.7 caught it: no gate runs the type check.
   (h) The conduct skill's own steps needed adjusting:
   - A `start_session` with `cwd` was refused on continuation turns ("can only start sessions where this one runs"). The same call without `cwd` was accepted.
   - The change was moved into the conducting session's own worktree, because the session's hook refuses writes to another worktree.
   - Children were left unarchived: archiving cleans up the shared worktree.
   - Each child again ended a first turn without `Outcome:`, while its implementer ran in the background. That is the release-rebase-pin retro's row 7, recurring.

   Smaller:
   - The owner's `/conduct panel-conduct-view.` carried a trailing period into the pane's id parse.
   - The mod API cannot give the prompt the keyboard after a fill. The owner kept fill-with-hint.
   - In single-change mode the session read `openspec/roadmap.md` once during the grill, against the conduct skill.
   - A heredoc holding backticks ran the guard suite by command substitution.
2. Better next time:
   - For a change with a screen, have the grill end with a mock with real data, and have the plan map the mock element by element against the mod types (proposal 1).
   - Have the grill emit `AC-<n>` ids from the start (proposal 1).
   - Never let an implementer tick a gate (proposal 2), and make the verifier copy gate parts verbatim (proposal 3).
   - Have the review writer be told the verdict it must write (proposal 4).
   - Write down how a mod pack is gated, live-loaded and drawn on the desktop, where the next mod plan reads it (proposal 5).
   - Gate the type check, and fix the checker's readiness skip and the conduct skill's `cwd` and child rules as changes of their own (rows 9 to 12).
3. Remember: a screen is approved on a picture with real data, never on a paragraph.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A text-described pane passed readiness, three phases and two gates, and was unreadable at the live check. A Claude Design mock with real data, approved and kept in `mock/`, settled it. | process-friction | doc-update (proposal 1); also in user memory (`ui-mock-before-plan`, already saved) | project |
| 2 | The grill's kebab acceptance ids are unreadable to `deliver-check` (`/\bAC-\d+/`), which cost one readiness round. | tooling | doc-update (proposal 1) | project |
| 3 | `tdd-implementer` ticked gate tasks 3.9 and 4.9, which belong to the coordinating session. | process-friction | rule (proposal 2) | project |
| 4 | `pr-verifier` abbreviated gate commands (`$BUNDLED`), so `deliver-check` item 1 found no passing row. | tooling | doc-update (proposal 3) | project |
| 5 | Stage-3 writers wrote `approved` with open important findings; the writer prompt says "decided by your own rules" instead of naming the verdict the script computed. | bug-class | regression-gate (proposal 4) | project |
| 6 | Several mod-pack gotchas are written nowhere a plan author reads: the bundled Claude Code path changes with every app update; a dev pack goes live only through the session's dev-mods link; the desktop surface has no hairline, no height clip, resize breaks glyph runs, and Box backgrounds do exist. | doc-gap | doc-update (proposal 5) | project |
| 7 | `CLAUDE_CODE_PLUGIN_DIRS` in a project `settings.local.json` is ignored, and reopening a session does not restart its process. | environment | doc-update (proposal 5) | project |
| 8 | The mod API cannot hand the keyboard to the prompt after `prompt.fill`, so the owner must click the box before Enter. | environment | followup: product feedback on the mod API (a focus option on `prompt.fill`) | project |
| 9 | No gate runs the type check of a mod pack; `tsc` was red at review time and only `pr-verifier` caught it. | tooling | followup: a change of its own adding the 2.7 `tsc` command to the pack's gates (or to `scripts/check.py` when a TypeScript runtime is present) | project |
| 10 | `conduct-check.mjs:262` (`if (f.started) return null;`) skips readiness and approval once a task is ticked, so a plan revised after phase 1 is not re-gated. | bug-class | followup: a change of its own in devkit-openspec | project |
| 11 | On a continuation turn the app refuses `start_session` with `cwd`; the same call without `cwd` (the same folder) is accepted. The conduct skill says to pass `cwd`. | process-friction | followup: the conduct-skill change of release-rebase-pin row 4 (omit `cwd` when it is the session's own folder) | project |
| 12 | Children ended a first turn without `Outcome:` while their implementer ran in the background. This is release-rebase-pin row 7, recurring after being filed. | process-friction | followup: same conduct-skill change; a recurrence, so it is the next change, not a later one | project |
| 13 | Archiving a child that shares the conducting session's worktree may clean that worktree, so no child was archived. | environment | followup: same conduct-skill change (archive only children with a worktree of their own) | project |
| 14 | A session's worktree hook refuses writes to another worktree, so the change had to move into the conducting session's own worktree. | environment | memory-only (recorded in requirements.md) | project |
| 15 | Review nits left open: the archived/not-a-change re-runs on a full trigger, `deliverReport` after a rate limit, `check_panel_parity`'s substring match and missing test, `readFolder` failure paths, `APPROVAL_DATE_RE` edge forms, `SURFACES` without `vscode`, the `open_session_in` ADR note, and the size of `pane.tsx`. | tooling | followup: fold into the next change that touches `plugins/panel` | project |
| 16 | The owner's trailing period (`/conduct panel-conduct-view.`) reached the pane's id parse. Fixed red-first in the live check. | bug-class | none (fixed and tested) | project |

## Proposed updates

### `plugins/core/skills/requirements-grill/SKILL.md` (tooling)
Acceptance criteria get `AC-<n>` ids, with the slug beside them, so `deliver-check` and `pr-verifier` read them from the start. A change with a visible screen ends the grill with a mock with real data, kept in the change folder.
- before: `- \`<kebab-id>\` — <criterion>` and "Each acceptance criterion gets a stable kebab-case id (from its first words) so later plan revisions and evidence can refer to it even if the prose is reworded."
+ after: `- AC-<n> \`<kebab-id>\` — <criterion>` and "Each acceptance criterion gets `AC-<n>` (numbered in order; `deliver-check` reads `/\bAC-\d+/`) and a stable kebab-case slug from its first words, so later plan revisions and evidence can refer to it even if the prose is reworded." Plus a new step 6 before "Converge and return": "A change with a visible screen (a pane, a band, a page) ends with a mock of each screen, drawn with a real example's data and only what the target can draw, approved by the owner and saved in the change folder (`mock/`); the plan maps it element by element."
- Answer: approved
- Applied: yes

### `plugins/core/agents/tdd-implementer.md` (process-friction)
An implementer never ticks a gate task; the coordinating skill runs the gate and ticks it.
- before: "2. **Stop.** Don't start the next phase without the go-ahead of the caller: the owner, or a coordinating skill that re-ran the gate command and saw it green. Present the phase's exit-gate checklist, still unchecked for the human to confirm."
+ after: the same, then: "Never tick a task whose text starts with `Gate:`, even when you ran its command green: the gate is ticked by whoever re-runs it (the owner or the coordinating skill)."
- Answer: approved
- Applied: yes

### `plugins/core/agents/pr-verifier.md` (tooling)
The Gates table carries each gate part verbatim, so `deliver-check` matches it.
- before: "A `### Gates` table with one row per command named by a gate task in `tasks.md` (split on `&&`: one row per part): `| <gate> | \`<command>\` | pass: <summary> |`, or `fail: <summary>`. The command is in backticks and the last cell starts with `pass` or `fail`."
+ after: the same, then: "The command cell holds the part exactly as `tasks.md` writes it, never abbreviated (no `$VAR` standing for a long path): `deliver-check` matches the part's text inside backticks."
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/scripts/review-round.workflow.js`, `plugins/core/skills/review-change/scripts/review-round.test.mjs` (regression-gate)
The stage-3 writer prompt names the verdict the round computed, so a writer cannot write `approved` over an open important finding. A test pins it.
- before: `'line 1: your verdict line (Verdict: followed by your verdict), decided by your own rules from the findings below\n'`
+ after: `'line 1: exactly Verdict: ' + outcome.verdict + ' (the round computed it: approved only when no blocking or important finding is left open)\n'`, and a test in `review-round.test.mjs`: an outcome with an open `[important]` finding gives a writer prompt whose line-1 instruction reads `Verdict: rejected`; one with none gives `Verdict: approved`.
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (doc-gap)
"Testing a mod pack" gains three parts: the version-agnostic binary form, how to load a work-in-progress pack live, and what the desktop surface draws.
- before: "...name the binary by absolute path inside the command (prose or an `export PATH` outside the backticks does not count) and put the `plugin test` part first, before the guard suite."
+ after: the same, then:
  - "The app updates its bundled Claude Code under you, so a gate names it with the version-agnostic form `\"$(for c in \"$HOME/Library/Application Support/Claude/claude-code/\"*/*/claude.app/Contents/MacOS/claude; do :; done; echo \"$c\")\"` (no `|`, so `deliver-check` can match it)."
  - "To see a pack live in a session, link its folder into that session's dev-mods folder (the plugin-authoring skill names it) and turn hot reload on. Every save reloads the pack. A project `settings.local.json` `env` is never read, and reopening a session does not restart its process."
  - "On the desktop surface a Box takes `backgroundColor`. The surface clips nothing by `height` or `overflow`, and a one-row Box is a full line tall. Draw dividers as spacing and bars as Boxes with a percentage width, never as glyph runs sized to a column count."
- Answer: approved
- Applied: yes
