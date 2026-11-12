# Requirements

## Request

Created on 2026-11-11 by the owner's typed `/conduct panel-conduct-view`, schema `devkit`
confirmed by the owner. The intent comes from the release-rebase-pin retro (rows 3 and 8) and
the devkit-panel retro's dogfood note: the pane draws only the roadmap round's rows and the root
checkout's `openspec/changes/`, so a single-change `/conduct <id>` and its child sessions never
appear; the owner found the pane hard to read (lines of text with long reasons, no cards like the
old orchestrator's, buttons with no visible effect, sessions without identifying icons); and the
pack fails to load in the npm Claude Code 2.1.227 (`userConfig.language: Unrecognized key:
"options"`), which also turns `claude plugin validate .` red for that CLI.

The owner, mid-grill (summarized from Portuguese): "At the top I want the change I am conducting
in this session, with its child sessions and its next step; the other changes in progress below,
collapsed. Don't ask me how: decide it in the plan and show me at approval. The next grill
questions only about what I see and do, in plain Portuguese."

Classification: domain=process type=feature flags=[ui, contract] (strict-assumed, from the
devkit-panel change: same pack, same checkers' JSON consumed; confirm at approval)

### Facts

- devkit-panel 0.1.0 lives in `plugins/panel/` (`hooks/register.tsx`, `pane.tsx`, `report.ts`,
  `sessions.ts`, `project.ts`, `commands.ts`, `i18n.ts`, tests `panel.test.tsx` and
  `report.test.tsx`). It runs `conduct-check --json` (version 2) in the project root with
  `DEVKIT_HOST=app` (the round view), `deliver-check <id> --json` per unfolded row, and
  `mcp__ccd_session_mgmt__list_sessions` (`plugins/panel/hooks/sessions.ts`, "the one session
  tool the panel ever calls"), and fills the prompt with `$.prompt.fill`.
- `conduct-check --json --change <id>` (devkit-openspec 0.10.0 onward) reports one change
  without reading the roadmap, including `worktree`, `branch`, `next`, `state`, `deliver` and
  `sessionPrefix`; it exits 3 with `no change <id>: ...` when nothing of the change exists.
- A child session of a change is named `<sessionPrefix><n>` (`^<prefix>[0-9]+$`, ADR 0006) and
  the app nests it under the conducting session (release-rebase-pin retro, row 6).
- The open change ids are the folders under `openspec/changes/` (minus `archive`) in every path of
  `git worktree list`, plus the worktree branches that are change ids (the conduct skill's
  no-argument form).
- The app accepts `start_session` only on a turn the owner typed and its chain of
  `<side-sessions-event>` turns; a prompt a mod submits counts as automated (ADR 0006).
- The change's worktree is the conducting session's own app worktree
  (`.claude/worktrees/panel-conduct-view-404c57`, switched to branch `panel-conduct-view` on
  2026-11-11, because a hook of the session refuses writes to another worktree); in general a
  conducting session's working directory need not be the change's worktree, and a session's
  name, branch and folder do not name the change it conducts.
- `plugins/panel/.claude-plugin/plugin.json` declares `userConfig.language` with `"options":
  ["pt-BR", "en"]`; the npm Claude Code 2.1.227 rejects that key, the app's bundled 2.1.317
  accepts it.

## Assumptions

- Which change is "the one this session conducts", how the pane finds it (the session's linked
  children, the last `/conduct <id>` typed, the open worktrees, or a mix) and what it costs per
  refresh are decided by the planner in `design.md` and shown to the owner at plan approval (the
  owner: "decide it in the plan"). The owner's first grill answer chose one card per change open
  in a worktree (`git worktree list`), each from `conduct-check --json --change <id>`, with the
  conducted one first and highlighted.
- The roadmap round view is not mentioned in the owner's request: whether it stays as a collapsed
  section, is removed, or is folded into "the other changes in progress" is the planner's
  decision, shown at approval (ADR 0007: the roadmap is a report).
- The look follows the reference the owner gave mid-grill (a screenshot of the desktop app's own
  side panel, "Ambiente / Contexto / Conectores"): sections with a short heading separated by thin
  dividers; one row per item with a leading line icon, a primary label, dimmed secondary text and
  a right-aligned status or action (a toggle, a small accent-coloured link like "Autenticar");
  a thin progress bar with a "15% usado"-style label and a right-aligned count; a "Mostrar mais"
  link for a long list; generous spacing, no long reason sentences inline. A second screenshot of
  the same panel adds: a segmented bar whose legend is one row per segment (a small coloured
  square, a label, a right-aligned number and percentage in aligned columns); collapsible rows
  with a chevron, a label and a right-aligned count; and a dimmed footer line saying when the data
  was last refreshed and when it refreshes next. The owner's word for the goal, in capitals:
  "LEGÍVEL" (readable): short labels, aligned columns, secondary detail dimmed or folded away,
  nothing that needs reading a sentence to know the state. The planner maps it to
  the mod's `ui.*` components and the app's theme tokens; anything the components cannot draw is
  named in `design.md` with the closest substitute. The old mod (`chacal88/orchestrator`) is no
  longer the reference.
- Opening a child session from its card is a view action (the app's window/session-opening tool):
  it starts, stops, archives and messages nothing, so it stays within ADR 0001 (the panel drives
  nothing). The pack's README and `plugins/panel/hooks/sessions.ts` say `list_sessions` is "the
  one session tool the panel ever calls"; that sentence changes, and the read-only list in the
  README (`claude plugin validate plugins/panel` lists no `prompt.submit`, `fs.write`, `store`,
  `clock.after` or `start_session`) stays.
- Buttons keep filling the prompt box and never submit (the owner chose this over sending
  directly, so the app accepts the child-session starts of the `/conduct` the owner then sends).
- All pane, band and toast texts stay selectable by `userConfig.language` (pt-BR default, `en`);
  code, comments, docs and OpenSpec artifacts in English.
- The fix for the npm CLI may be a manifest both CLIs accept (for example `language` without
  `options`, validated in the module) or a recorded minimum Claude Code version; the planner
  picks it. Either way `claude plugin validate .` must pass with the npm `claude` 2.1.227 and with
  the app's bundled Claude Code (2.1.321 since 2026-11-12).
- Versioning: devkit-panel gets a minor bump in `plugins/panel/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, with a CHANGELOG entry; no other pack changes unless the
  plan shows a checker needs a new field (then that pack bumps too, and the plan says why).

## Acceptance criteria

- AC-1 `conducted-change-on-top` — While this session conducts a change (a single-change
  `/conduct <id>` included), the top of the pane is one card for that change, with its id, its
  next step and who acts now (the owner, Claude, or GitHub), drawn from `conduct-check --json
  --change <id>`; the same change never appears again lower in the pane.
- AC-2 `phase-progress` — The top card shows the change's phase progress (for example "phase 2 of 3"),
  with the finished phases marked, read from the change's `tasks.md` gates as the checkers read
  them.
- AC-3 `pr-and-checks` — When the change has a PR, the top card shows its link and whether its checks
  are green, red or running; with no PR it shows none.
- AC-4 `delivery-items` — The top card holds the eight delivery-contract items (`met` / `open` /
  `blocked` with the reason) from `deliver-check <id> --json`, collapsed inside the card.
- AC-5 `child-sessions-with-icons` — The top card lists the change's linked child sessions
  (`^<sessionPrefix>[0-9]+$`), each with its phase number and an icon per state (running, idle or
  stopped, archived); clicking one opens that session in the app and starts, stops or archives
  nothing.
- AC-6 `other-changes-collapsed` — The other changes in progress (open in a worktree, not the
  conducted one) are listed below the top card, collapsed, each with its id, state and a
  `Conduct` button.
- AC-7 `no-conducted-change` — When this session conducts no change, the top shows one line ("no
  change conducted in this session", localized) and the changes in progress below it are listed
  open (not collapsed), each with its `Conduct` button.
- AC-8 `buttons-visibly-fill` — Clicking a button fills the prompt box with its exact command and never
  submits it; the button then reads, localized, "placed in the prompt, press Enter" and a toast
  says the same; where no prompt box can take the text the command is toasted, as today.
- AC-9 `band-shows-conducted-change` — The one-line band above the prompt shows the conducted change
  (id, phase progress, next step, who acts) and the Open/Close button; with no conducted change it
  shows the number of changes in progress.
- AC-10 `loads-in-both-clis` — devkit-panel loads and `claude plugin validate .` passes with both the
  npm Claude Code 2.1.227 and the app's bundled Claude Code (2.1.321 since 2026-11-12).
- AC-11 `read-only-kept` — `claude plugin validate plugins/panel` lists no `prompt.submit`, `fs.write`,
  `store` or `clock.after`, and the module never calls `start_session`, `stop_session`,
  `archive_session` or `send_message`; `claude plugin test plugins/panel` passes, covering the
  criteria above on the `terminal` and `desktop` surfaces.
- AC-12 `looks-like-app-panel` — The pane is laid out like the app's own side panel (the owner's
  reference screenshot): headed sections with dividers, rows with a leading icon, label, dimmed
  secondary text and a right-aligned status or action, a progress bar for the phase progress, and
  long reasons out of the row (shown only when a row is unfolded), collapsible groups with a
  chevron and a count, and a dimmed footer with the last refresh; every row's state is readable
  from its icon and a label of at most a few words, without reading a sentence; the owner confirms
  in the live check that the pane is readable ("LEGÍVEL").
- AC-13 `live-check` — Loaded in the devkit repository through the app while a `/conduct <id>` runs,
  the pane shows that change on top with its child sessions and next step; the pane's text and
  the owner's reading of it are recorded in `evidence.md`.

## Questions asked

1. [scope] How should the pane find the change this session conducts? → One card per change open
   in a worktree, each from `conduct-check --change <id>`, the one with this session's children
   first and highlighted. Later refined by the owner: "the change I am conducting in this session
   on top; the other changes in progress below, collapsed; decide how in the plan".
2. [scope] What happens to the roadmap round view? → Not answered; the owner replaced it with the
   message above (see Assumptions: the planner decides).
3. [end effect] Besides the child sessions and the next step, what goes on the top card? → Phase
   progress, who acts now, PR and checks, and the eight delivery items (collapsed).
4. [end effect / project rules] What should a button visibly do? → Keep filling the prompt (the
   owner presses Enter, so the app accepts the child starts, ADR 0006), and show "placed in the
   prompt, press Enter" plus a toast.
5. [end effect] Clicking a child session? → Opens it in the app; it starts or stops nothing.
6. [edges] The session conducts no change? → One line saying so, and the changes in progress
   listed open, each with `Conduct`.
7. [scope] The npm CLI load failure (release-rebase-pin retro row 3)? → In this change.
8. [end effect] What the band shows? → The conducted change (id, phase progress, next step, who
   acts) and Open/Close; with none, the count of changes in progress.
9. [end effect] (the owner, unasked, with a screenshot of the app's side panel) "I want this
   screen pretty like this one" → recorded as the visual reference (Assumptions,
   `looks-like-app-panel`); a second, longer screenshot of the same panel followed, then
   "LEGÍVEL" (readable).

## Escalations

None. Note for readiness: opening a session from the pane is a view action the owner asked for;
the design records why it stays within ADR 0001.

## Out of scope

- Any change to the conduct skill or to `ship-change` (the release-rebase-pin retro's row 4 to 7
  followups are changes of their own).
- Sending a command from a button (the owner kept fill-only).
- The old orchestrator mod itself.

Process note: while gathering facts for this grill, the conducting session read
`openspec/roadmap.md`, which the conduct skill's single-change mode says not to read. The round 9
line for this change matched the retros above; nothing was written to the roadmap.

## Addendum 2026-11-11: the live check's first round

Phases 1 to 3 were implemented (gates 1.9, 2.9 and 3.9 green, uncommitted in the worktree) and
the 0.2.0 pane was loaded in the conducting session for phase 4's live check. What the owner saw
and said there changes the scope. The owner's words are quoted verbatim, in backticks; the rest is
the conducting session's reading, which the owner did not contradict. Design D8 and D20 to D27 answer it;
tasks.md phase 4 builds it; the live check moves to phase 5 and is run again.

### What the owner said

1. With a screenshot of the unfolded `tarefas` delivery item (its reason is one paragraph of ten
   `no passing row in evidence.md for <full command with $HOME paths>` clauses) and a screenshot
   of the desktop app's `Servidores MCP` dialog:
   `uma coisa eu queria mudar, por exemplo quando eu clico em tarefas, nao da para em vez de mostrar aquilo abrir um modal como funciona no outros?`
   The mod API (the bundled 2.1.317 and 2.1.321 types, `PaneOpenArgs`) has no centred modal. The
   closest is a second pane opened with `focus`, `closeOnEscape` and `holdToasts`, which the API
   calls a dialog. The owner chose a detail pane now, in this change.
2. With a screenshot of the lower section (`Em andamento`, listing four other open changes, each
   with a `Conduzir` button):
   `nao entendi o que é isso, se ta em andamento por que tem o conduzir?`
   The owner reads "in progress" as "already being run", so a Conduct button there makes no sense.
   These rows are changes open in a worktree that this session does not conduct; no session may be
   conducting them at all. The same screenshot shows that after a fill the wide filled label
   `no prompt, pressione Enter` squeezes the row so its step text is cut to `g...`.
3. On the same section: `o que é entregar?` The Ship button's label (`Entregar`) does not say
   what it does.
4. `nao entendo o que é a parte de cima e o que é a parte de baixo` The owner cannot tell what the
   top section (`CONDUZIDA NESTA SESSÃO`) and the bottom section are.
5. First `nao to entendendo porra nenhuma`, then:
   `como vou ver esses arquivos? como olho pro painel e sei o que to fazendo? onde esta o resumo? onde vejo o requirements? design? os passos e onde estamos?`
   Looking at the pane, the owner cannot tell what the conducted change is about, where its
   documents are, or which step of the whole flow it is in. This is the main finding of the round.

### What the owner's screenshots showed

- The phase bar's line crosses the `fase 4 de 4` label, which reads as struck through, and its
  orange segment runs past the pane's right edge.
- The actor reads `Claude` on phase 4, which tasks.md marks owner-run.
- Two dividers of different widths between sections: a short one and a full one.
- The filled button label is the short `no prompt, pressione Enter`, not the full text of AC-8.

### Already fixed during the live check (not re-planned)

Signal 1 (design D3) read `panel-conduct-view.` with the trailing period of the owner's typed
`/conduct panel-conduct-view.`, so no change was found. `conducted.ts#conductArgs` now trims
surrounding punctuation and quotes, and `isChangeId` uses the checker's own rule
(`conduct-check.mjs`, the `--change` option: `^[A-Za-z0-9][\w.-]*$` and not `.`, `..` or
`archive`). The suite passed 107 of 107 after the fix.

### The approved mock

Tired of text descriptions, the owner asked for a visual design first. The conducting session drew
it in Claude Design and the owner approved it: `Está bom assim`. The six screens are in the change
folder as the binding layout reference, `openspec/changes/panel-conduct-view/mock/`: `Main.dc.html`
(the pane while a change is conducted), `Detail.dc.html` (the pending detail), `Empty.dc.html` (no
conducted change), `Band.dc.html` (the band), `Doc.dc.html` (a document) and `Step.dc.html` (the
Implementation step), with `canvas.json`; online at
https://claude.ai/artifact/Ny74Rnib1qd8eaFc8hWF96. Its example data is a change of another
repository (`controlid-settings` in psim-kernel), not this one. It supersedes the section names
and the phase bar of 0.2.0 as built, and the wording first drafted in this revision.

### Acceptance criteria, revised

These replace the criteria of the same id above, and AC-14 to AC-21 are new. AC-1, AC-10 and
AC-11 are unchanged. `proposal.md` holds the same list, in the same order; `deliver-check` reads
that one first.

- AC-2 `phase-progress` — The Implementation step shows the change's task progress ("103 of 107 tasks"), read from the change's `tasks.md` as the checkers read it, and its detail (screen 6) shows the total with a percentage and a glyph bar, the sections still open, and the finished ones dimmed; no line is drawn wider than the pane or over another line's text.
- AC-3 `pr-and-checks` — When the change has a PR, the `PR and checks` step shows its number and whether its checks are green, red or running, and its detail links the PR; with no PR it shows none.
- AC-4 `delivery-items` — The eight delivery-contract items from `deliver-check <id> --json` are each shown, with their status and a short list of what is pending (task ids, commands as short labels, criteria ids, a `+N` tail; never the raw paragraph), in the detail of the step that holds them (items 1 and 4 under Proofs, 2 and 3 under Review, 5 to 8 under PR and checks), and the full text stays one press away.
- AC-5 `child-sessions-with-icons` — The top section lists the change's linked child sessions (`^<sessionPrefix>[0-9]+$`) under "Sessions of this change": each one not archived as a row with its phase number and phase title and its state, the archived ones folded into one "N archived" row; clicking a session opens it in the app and starts, stops or archives nothing.
- AC-6 `other-changes-collapsed` — The other changes open in a worktree (not the conducted one, and not one whose id has an archived folder `openspec/changes/archive/<YYYY-MM-DD>-<id>` in the root checkout or its own worktree) are one folded group at the bottom of the pane, "Other open changes" with their count; unfolded, each has its id, its progress in a few words and a `Conduct` button.
- AC-7 `no-conducted-change` — When this session conducts no change, the pane is the mock's screen 3: the title "No change in this conversation", one sentence saying that the button puts the command in the text box and the owner presses Enter, and the changes open in this repository listed open, each with its progress and a `Conduct` button.
- AC-8 `buttons-visibly-fill` — Clicking a button fills the prompt box with its exact command and never submits it; before the press, `Continue here` has a dim hint naming the command it puts in the box; after it the button shows a check mark beside its own label and the hint (or a dim line under its row) and a toast say, localized, "in the box, press Enter", without cutting the row's own text; where no prompt box can take the text the command is toasted, as today.
- AC-9 `band-shows-conducted-change` — The one-line band above the prompt (screen 4) shows the conducted change's actor glyph, its id, its current step with a few words of fact, what is left, and who acts, and the `Open panel` / `Close panel` button; with no conducted change it shows the number of open changes.
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

### Questions left for the owner at plan approval

- Whether the other open changes are shown at all. Not answered; they stay as approved (a folded
  group while a change is conducted), with the new heading.
- The summary line comes from the English plan artifacts, so a pt-BR pane shows it in English.
- The document pane's tabs also list Requirements, Readiness and Approval, which the mock's tab row
  does not show (design D23).
- The mock's `Copiar` puts text on the clipboard (`$.ui.copy`), on the owner's press (design D13).

### 2026-11-12: the app update and the live check's second round

- 2026-11-12: the desktop app updated its bundled Claude Code from 2.1.317 to 2.1.321 overnight
  and removed the 2.1.317 folder, so the gates in `tasks.md` now name the bundled binary without
  its version (design D16); gates 1.9 to 4.9 stay ticked and `pr-verifier` re-runs them in that
  form. In the live check's second round the owner said `a pendência abriu o detalhe e o esc fechou`,
  `tudo ok`, and `a caixa nao muda o foco`; on the last, the owner chose to keep the fill with its
  hint (AC-8 `buttons-visibly-fill`), since the mod API cannot focus the prompt box: an app limit,
  for the retro.
- 2026-11-12: AC-10 `loads-in-both-clis` names the bundled binary without pinning a retired
  version. Its text read "the app's bundled 2.1.317"; it now reads "the app's bundled Claude Code
  (2.1.321 since 2026-11-12)", in `proposal.md` and in this file (the criterion and its
  assumption), with the same id and slug. The owner agreed: `sim nos dois`.
- 2026-11-12, live check, second round, two more findings (the owner's answer to both: `sim nos
  dois`):
  - **An archived change listed as open.** The pane's `Outras changes abertas` listed
    `conduct-rounds`, archived on 2026-11-10 (`openspec/changes/archive/2026-11-10-conduct-rounds`)
    but with its local branch left behind. A candidate whose id has an archived folder
    `openspec/changes/archive/<YYYY-MM-DD>-<id>`, in the root checkout or in its own worktree, is
    not an open change and is dropped before any checker runs (design D4; AC-6
    `other-changes-collapsed`, whose text now says so).
  - **Are the other changes sub-changes?** The owner asked whether the four changes at the bottom
    of the pane derive from this one and must be done first. The answer given: no, they are
    independent. So the `Outras changes abertas` heading carries a dimmed hint, pt-BR
    `independentes desta conversa; nenhuma precisa terminar antes`, en `independent of this
    conversation; none has to finish first` (design D8 item 9, D12, D24; AC-17
    `sections-say-what-they-are`, whose text now names it).
  - Both map to tasks already ticked, and no task is added: the archived drop to 1.3 (`candidates`
    in `plugins/panel/hooks/project.ts`) and 4.6 (the `Outras changes abertas` group it feeds),
    the hint to 4.1 (`plugins/panel/hooks/i18n.ts`, both languages) and 4.6 (drawn in
    `plugins/panel/hooks/pane.tsx`). They were fixed during phase 5 by `fix-defect` dispatches,
    red-first, as the earlier fixes of this round were; the live record of 5.2 and gate 5.9 are on
    a head that carries them, and `pr-verifier` re-runs gate 4.9's parts there.
