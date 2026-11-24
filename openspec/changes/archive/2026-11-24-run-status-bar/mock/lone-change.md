# Screen: the status line of a session that conducts one change

The line sits under the message box of the Claude Code session that runs `/devkit change run-status-bar`.
One line, 100 columns wide at most (the ruler shows the width; an emoji takes two columns). No colour.
The line carries no budget share and no token count.

Reading the line, left to right:

```
<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]
```

- State icon: `🙋` when the change waits for the owner, nothing while it runs (the `state` listing prints `stateIcon: null` for `running`).
- Stage icon: `stageIcon` of the `state` listing for this change.
- Id: the change's name, `change` of the `state` listing.
- Stage title: `stageTitle` of the same entry, in the person's language.
- Strip: one mark per stage of the schema that applies to this change, in the order of `plugins/openspec/schemas/devkit/flow.json`.
  `■` done, `◆` the current stage, `□` not yet.
- Progress: `<n> of <N>`, `N` the number of stages that apply to the change, `n` the place of the current stage among them
  (`<n> de <N>` in Brazilian Portuguese).
- Reason: `reason.text` of the `state` entry, only while the change is stopped; no reason, no ` · ` and no text, while it runs.

The 15 stages of this change (`devkit` schema, flags `[ui, contract]`, so `N` = 15): 1 open, 2 requirements, 3 mockup, 4 decisions,
5 proposal, 6 specs, 7 design, 8 tasks, 9 readiness, 10 approval, 11 implementation, 12 evidence, 13 review, 14 delivery, 15 retro.
`unit-tests` and `e2e-tests` are skipped: they apply only when the project sets `tests.unit` or `tests.e2e`, and
`openspec/config.yaml` sets neither.

## The four moments, in English (`--lang en`)

Moment 1, the grill: waiting for the owner, reason code `grill`, stage `requirements`, the 2nd of 15.
Moment 2, the mock-up approval: waiting for the owner, reason code `waiting-mockup`, stage `mockup`, the 3rd of 15. This is the real moment today.
Moment 3, the plan approval: waiting for the owner, reason code `waiting-approval`, stage `approval`, the 10th of 15.
Moment 4, implementation: running, no reason, stage `implementation`, the 11th of 15.

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
🙋 ❓ run-status-bar · Requirements (grill) · ■◆□□□□□□□□□□□□□ · 2 of 15 · your answers about its…
🙋 📝 run-status-bar · Screen mock-up · ■■◆□□□□□□□□□□□□ · 3 of 15 · your approval of the mock-up
🙋 📝 run-status-bar · Owner's approval · ■■■■■■■■■◆□□□□□ · 10 of 15 · your approval of the plan
🛠️ run-status-bar · Implementation · ■■■■■■■■■■◆□□□□ · 11 of 15
```

The first line is cut: whole, it is 104 columns wide, 4 too many (see "When the line is wider than 100 columns").
The whole text of its reason is "your answers about its request". The other three lines are whole.

## The same four moments in Brazilian Portuguese (`--lang pt-BR`)

The state, the stage, the strip and the number are the same; only the words change (`de` in place of `of`).

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
🙋 ❓ run-status-bar · Requisitos (grill) · ■◆□□□□□□□□□□□□□ · 2 de 15 · as suas respostas sobre o…
🙋 📝 run-status-bar · Mock-up de tela · ■■◆□□□□□□□□□□□□ · 3 de 15 · a sua aprovação do mock-up
🙋 📝 run-status-bar · Aprovação do dono · ■■■■■■■■■◆□□□□□ · 10 de 15 · a sua aprovação do plano
🛠️ run-status-bar · Implementação · ■■■■■■■■■■◆□□□□ · 11 de 15
```

The first line is cut as well: whole, its reason "as suas respostas sobre o pedido" makes it 104 columns.

## Width of each line

Counted with an emoji as two columns, the marks and the `·` and `…` as one.

| Moment | English | Brazilian Portuguese |
| --- | --- | --- |
| 1 the grill | 104 whole, 97 cut | 104 whole, 98 cut |
| 2 the mock-up approval | 96 | 95 |
| 3 the plan approval | 96 | 96 |
| 4 implementation | 63 | 62 |

## When the line is wider than 100 columns

Only the grill moment is wider than 100 columns today. The line is cut from the end of the reason, which is the longest part and
the one the state icon already hints at; the id, the stage title, the strip and `<n> of <N>` are never cut before the reason is.

1. The reason loses its last words, one at a time, until the line fits, and ends in `…` (one column). It keeps at least its first word.
2. If the line is still wider with the reason cut to its first word, the reason is dropped, with its ` · `.
3. If the line is still wider, the id is cut at its end and ends in `…`, keeping at least 20 columns of the id.
   The stage title, the strip and `<n> of <N>` are not cut.

A long change id, the case of step 3 reached after step 1: the longest real id in this repository is `roadmap-coordinator-followups`
(29 columns, the id of an archived change). At the plan approval it makes the line 111 columns wide, so the reason is cut by step 1:

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
🙋 📝 roadmap-coordinator-followups · Owner's approval · ■■■■■■■■■◆□□□□□ · 10 of 15 · your approval…
```

That line is exactly 100 columns wide. No real id is long enough to need step 3; the rule is drawn for the planner to settle.

## Where the data comes from

| Element | Source |
| --- | --- |
| Id `run-status-bar`, state and reason code of today's moment 2 | the real output of `node plugins/openspec/hooks/change-loop.mjs state --change run-status-bar --lang en` in this worktree on 2026-11-24: `state: waiting-for-owner`, `reason: {code: waiting-mockup, text: "your approval of the mock-up"}`, `stage: mockup`, `stageTitle: "Screen mock-up"`, `stageIcon: 📝`, `stateIcon: 🙋`; with `--lang pt-BR` the text is "a sua aprovação do mock-up" and the title "Mock-up de tela" |
| Reason texts of moments 1 and 3 | the message tables of `plugins/openspec/hooks/change-loop.mjs`: `gate.grill` "your answers about its request" / "as suas respostas sobre o pedido" (reason code `grill`), `gate.approval` "your approval of the plan" / "a sua aprovação do plano" |
| Stage ids, order, titles (en and pt-BR) | `plugins/openspec/schemas/devkit/flow.json`: `requirements` "Requirements (grill)" / "Requisitos (grill)", `mockup` "Screen mock-up" / "Mock-up de tela", `approval` "Owner's approval" / "Aprovação do dono", `implementation` "Implementation" / "Implementação" |
| Which stages apply, so N = 15 | the change's flags `[ui, contract]` in `openspec/changes/run-status-bar/requirements.md` (`mockup` applies on `ui`); `unit-tests` and `e2e-tests` need `tests.unit` and `tests.e2e`, which `openspec/config.yaml` does not set |
| State icon `🙋` | `STATE_ICON['waiting-for-owner']` in `change-loop.mjs`; running has none |
| Stage icons `❓` (requirements), `📝` (mockup, approval), `🛠️` (implementation) | `STAGE_ICON` in the same file |
| Moments 1, 3 and 4 | stages the change has passed or will reach, drawn from the schema; the change itself is at `mockup` today |
| Long id | `roadmap-coordinator-followups`, an archived change of this repository (`openspec/changes/archive/2026-11-22-roadmap-coordinator-followups`) |
