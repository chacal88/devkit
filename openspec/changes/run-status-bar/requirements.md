<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> asked by the owner on 2026-11-22, after the same reference: a status bar under the message box of the session that coordinates a change or a roadmap run, with the run's progress (a strip of marks, the stage) and the share of the change's budget spent, as the reference shows "delivery · 35% of the budget". In the grill: where it lives (the Claude Code status line, the devkit panel, or both), what it shows in a roadmap run against a lone change, and that it reads only `change-state` and the budget count, writing nothing.

## Classification

Classification: domain=process type=feature flags=[ui, contract] (strict-assumed until the owner confirms in the grill)

## Answered by triage

1. [project rules] Does a rule require panels to read the `state` command? → Yes: ADR 0017 decision 1 says the panels read the command; the roadmap line of `coordination-panels` repeats it (source: `docs/adr/0017-a-change-state-is-derived-in-one-place.md:36-40`, `openspec/roadmap.md:145`).
2. [edges] Must the state read write nothing and call no AI? → Yes for the `state` command (source: `openspec/specs/change-state/spec.md:10-15`); the budget count reads a transcript only and fails open to null (source: `plugins/openspec/hooks/guard.mjs:840-854`).
3. [scope] Does the repository ship a status line command? → No; none is shipped or documented. The panel's band exists above the prompt (source: `plugins/panel/hooks/pane.tsx:497-514`, `plugins/panel/hooks/register.tsx:644`).
4. [scope] Is the current `devkit-panel` permanent? → No: it is replaced by round 23's panels and removed in round 24 (source: `docs/coordination-design.md:553`).

## Questions asked

1. [scope] Where does the bar live: the Claude Code status line (under the message box), the panel's band (above it) or both? → The Claude Code status line under the message box. Answered by the coordinating session under the owner's delegation (2026-11-23); the owner can correct it at the mock-up.
2. [scope] What does the bar show in the session that coordinates a roadmap run? → The count of the changes in play by state in one short stretch (in play, working, waiting on the owner, blocked), with no strip of marks and no percentage. Answered by the coordinating session under the owner's delegation (2026-11-23).

3. [end effect] The owner saw the first mock-up and said the budget share is not very useful, and that the change's own information, its progression and its name would be (2026-11-24, typed in this session). → The bar drops the budget share; the lone-change bar shows the change's name, its stage, the strip of marks, the progress as `<n> of <N>` and, while the change is stopped, the reason in words.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Where: the bar is a Claude Code status line command shipped by `devkit-openspec` that the owner turns on once in the `statusLine` setting of `.claude/settings.json`; the devkit panel's band (`plugins/panel/hooks/pane.tsx`) is not touched, because round 24 removes that panel.
- A session that conducts one change (`/devkit change <id>`) shows the change's state icon and stage icon, its id, its stage title, a strip of marks with one mark per stage that applies to the change (done, current, not yet), the progress as `<n> of <N>` (the current stage's place among the N stages that apply) and, while the change is stopped, the reason in words (`reason.text` of the `state` entry); the line is `<icons> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`.
- The bar shows no budget share, whatever the `budget` setting says, and counts no tokens: the request's "share of the change's budget spent" is dropped by the owner (2026-11-24); the budget count (`spentOf`) is not read.
- A session that coordinates a roadmap run shows the count of the changes in play by state, taken from `change-loop.mjs state --lang <l>` with no `--change`: in play, working (`running`), waiting on the owner (`waiting-for-owner`), blocked (`blocked`); no strip and no percentage.
- A session that conducts no change and holds no roadmap run shows an empty bar (no text).
- The bar reads the state only through `change-loop.mjs state` (ADR 0017 decision 1) and reads no transcript; it writes no file, calls no AI and prints no `devkit-run:` or `devkit-end:` line.
- AMBIGUOUS: which change a status line command conducts (a) the change whose worktree folder or branch is the session's `cwd`, from the JSON Claude Code passes on standard input | (b) the change named in the session's transcript; the planner resolves, preferring (a) because the `state` listing already names each change's `root` and `branch`.
- The status line's text is in the person's language (`--lang`), like the other surfaces; every code stays the same across languages.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `lone-change-bar`: In a session that conducts the change `run-status-bar` at stage `approval`, waiting for the plan approval, the status line prints the state icon and stage icon, `run-status-bar`, the stage title, a strip with the earlier stages marked done, the current one marked and the later ones not yet, `<n> of <N>` where N is the number of stages that apply to the change and n the place of the current one, and the reason in words; the command exits 0.
- AC-2 `no-budget`: With a `budget` cap set, the line has no percentage and no mention of the budget, and the command reads no session transcript.
- AC-3 `roadmap-counts`: In the session that coordinates a roadmap run whose `state` listing holds six changes (three `running`, two `waiting-for-owner`, one `blocked`), the line prints those counts and no strip and no percentage.
- AC-4 `nothing-conducted`: With no change conducted and no run, the status line prints nothing and exits 0.
- AC-5 `read-only`: Running the status line command leaves `git status`, the run file and the list of worktrees as they were, calls no AI and prints no `devkit-run:` or `devkit-end:` line.
- AC-6 `person-language`: With `--lang pt-BR` the line's words are in Brazilian Portuguese and the state, stage and counts are the same as with `--lang en`.
- AC-7 `mock-matches`: The line the command prints for each example of the mock-up the owner approved is the one the mock shows, element by element.

## Out of scope

- The devkit panel and its band (round 23 builds the panels, round 24 removes the old one).
- Any budget on the bar: the share spent, a warning near the cap, a count of tokens; the owner dropped it on 2026-11-24.
- Setting the `statusLine` of the owner's `settings.json` by itself: the owner turns it on.
- Any write, any state stored by the bar, any AI call.

## What the mock-up revealed

- The lone-change line is `<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`, in the person's language (`of` is `de` in pt-BR); the reason is `reason.text` of the `state` entry and shows only while the change is stopped.
- N counts the stages that apply to the change: for this change's flags 15, with `unit-tests` and `e2e-tests` left out because the project sets neither `tests.unit` nor `tests.e2e`; done stages (the mock-up and decisions included) stay as marks.
- The strip uses `■` for done, `◆` for the current stage and `□` for the later ones; the planner settles the final glyphs.
- The line is at most 100 columns (an emoji takes two, the marks and `…` one). When it is wider, the reason loses whole words from the end and takes a `…`, keeping its first word; then the reason is dropped; then the id is cut with `…`, keeping at least 20 columns; the stage title, the strip and `n of N` are never cut.
- The roadmap-run line prints all four counts, zeros included: `<n> in play · <n> working · 🙋 <n> waiting on the owner · ⛔ <n> blocked`, in both languages.
