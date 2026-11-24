<!-- devkit-stage mockup result=passed attempt=2 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Mock-up

The change adds one surface: the Claude Code status line, one line of text under the message box, 100 columns at most, no colour.
Three screens, each a monospaced block under `mock/`. Attempt 2 answers the owner's two notes below: no budget share anywhere,
and the lone-change line now carries the change's name, its progress and, while it is stopped, the reason in words.

| Screen | File | What it shows | Real example it draws from |
| --- | --- | --- | --- |
| A session conducting one change | `mock/lone-change.md` | `<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`; four moments of the real change `run-status-bar` (the grill, the mock-up approval, the plan approval, implementation), in English and Brazilian Portuguese; the widths and how a line wider than 100 columns is cut | the change `run-status-bar`; the real output of `change-loop.mjs state --change run-status-bar` with `--lang en` and `--lang pt-BR` on 2026-11-24 (stage `mockup`, reason `waiting-mockup`); the reason texts of the grill and the plan approval from the message tables of `plugins/openspec/hooks/change-loop.mjs`; stage ids, order and titles from `plugins/openspec/schemas/devkit/flow.json` with this change's flags `[ui, contract]` (15 stages apply) |
| A session coordinating a roadmap run | `mock/roadmap-run.md` | counts: in play, working, waiting on the owner, blocked; no strip, no percentage; English and Brazilian Portuguese (unchanged) | the real output of `change-loop.mjs state --lang en` and `--lang pt-BR` in this worktree on 2026-11-23 (10 changes, all running), plus `git worktree list` (23 worktrees); the AC-3 mix as a second example |
| A session conducting nothing | `mock/nothing-conducted.md` | the empty bar, in words and as an empty block (unchanged) | AC-4 |

## What the owner is asked to check

1. Is the content of the lone-change line right: the change's name, the stage title, the strip of 15 marks, `<n> of <N>` and the reason in words? Is anything missing, or too much?
2. Is the order right: icons, name, stage title, strip, progress, reason? For example, should the strip come before the stage title, or the progress next to the name?
3. Does the reason stay in the line? It is the longest part: with it the grill moment is 104 columns wide, 4 over the limit, so the line is cut at the end of the reason (`your answers about its…`). Without it, no line passes 71 columns (but the line would not say what the session waits for; the state icon would only say that it waits).
4. The strip counts 15 stages for this change. `unit-tests` and `e2e-tests` are left out because this project sets neither `tests.unit` nor `tests.e2e`; `mockup` and `decisions` stay as marks (done) after they are passed. Is that the strip the owner wants?
5. The roadmap line always prints the four counts, zeros included. Should a zero be left out? (Unchanged from attempt 1.)
6. The `■ ◆ □` marks and the Portuguese words of the lines are drawn here; the planner settles the final glyphs and wording.

## How attempt 2 answers the notes

1. Note 1 (leave the budget out): the share is gone from every line and from the table; `mock/lone-change-no-cap.md` is deleted because there is no cap case any more.
2. Note 2 (name, progress, reason): the lone-change line is now `<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`, drawn at four moments with the real change `run-status-bar`; the reason is the `reason.text` of the real `state` entry and is absent while the change runs. The roadmap line and the empty bar are as they were.

## Owner's notes

Notes the owner typed in this session on 2026-11-24, in answer to the first drawing (attempt 1):

1. The budget information is not very useful: leave it out of the bar.
2. More useful: the information of the change, its progression and its name. The bar of a session that conducts one change carries the change's name, its stage, the strip of marks, the progress as `<n> of <N>` and, while the change is stopped, the reason in words. The requirements are updated (`requirements.md`, question 3, AC-1 and AC-2); the roadmap line (counts by state) and the empty bar do not change.

## Owner's approval

- Date: 2026-11-24
- Owner's words: "Aprovo o mock-up"
