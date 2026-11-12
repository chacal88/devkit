# devkit-panel

A side pane in the Claude desktop app that shows the change this session conducts, drawn from the devkit checkers (`conduct-check` and `deliver-check` of [devkit-openspec](../openspec/README.md), 0.10.0 or newer). It is read-only: it starts no session, writes no file, schedules nothing beyond its own refresh while the pane is open, and never submits a prompt. Its buttons put the owner's next command in the prompt box; the owner presses Enter.

```bash
claude plugin install devkit-openspec@devkit --scope project
claude plugin install devkit-panel@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)). The pack is a Claude Code mod (function hooks), so it loads in the Claude desktop app's bundled Claude Code; the guide is [docs/openspec-flow.md](../../docs/openspec-flow.md#the-panel-devkit-panel).

## What it shows

The pane draws only in an OpenSpec devkit project: a root whose `openspec/config.yaml` has a top-level `schema: devkit` or `schema: devkit-lite`, the same opt-in the hooks read. Elsewhere it shows one line and runs nothing. A checker older than `0.10.0` is one `old-checker` line and nothing runs.

### The conducted change, and how it is found

Two signals, read in this order at every refresh; the first one that gives a change id wins.

1. **The newest conduct invocation in this session's transcript** (`$.session.messages()`): the `<command-name>`/`<command-args>` text, a first line `/conduct ARGS` or `/<plugin>:conduct ARGS`, or a `Skill` tool use. It counts when ARGS is one change id. `round <n>`, an empty ARGS or anything else gives nothing, and an older single id is not used.
2. **This session's own child sessions**: the rows of the app's `mcp__ccd_session_mgmt__list_sessions` whose `startedBy` is this session, named `<sessionPrefix><n>`. This covers `/conduct round <n>` and a transcript compacted past the command. Two changes that share a prefix are never told apart this way: one line names the other id.

With neither signal the pane says no change is conducted and lists the changes in progress.

### The six screens

The layout is the one the owner approved as a mock (`openspec/changes/panel-conduct-view/mock/`). The main pane draws, top to bottom:

- **The change**: `Esta conversa conduz`, the id, a one-line summary (the `Summary:` line of `proposal.md`, else the first sentence of its `## Why`), `<repository> · branch <branch>`.
- **Agora** (the Now box): the current step in a few words, what is left and what comes after, who acts as a pill (`você age`, `Claude age`, `GitHub age`, `parada`, `esperando`), and `Continuar aqui` with its hint. `Aprovar plano` or `Responder retro` appear on the steps that ask for them. A phase whose heading says `owner-run` reads as the owner acting, though the checker still reports the session.
- **Passos**: ten steps (Requisitos, Plano, Prontidão, Sua aprovação, Implementação, Revisão, Provas, PR e checks, Merge, Retro e arquivo), each with a glyph (done, partly done, current, pending) and a few words of fact. A press opens the step's detail.
- **Pendências**: the open tasks of `tasks.md` (at most six, then `+N`), each with who it waits on; a press opens the pending detail.
- **Documentos**: `Proposta`, `Design`, `Tarefas`, `Specs`, `Provas`, each only when its file exists.
- **Sessões desta change**: the running and idle child sessions as `Fase n · <title>`; the archived ones are one folded row.
- **Outras changes abertas**: folded while a change is conducted; each row has its progress (`103 de 107 tarefas`, `plano pronto · 0 de 25`) and `Conduzir`. With no conducted change the pane is the empty screen: `Nenhuma change nesta conversa`, and the open changes of the repository.
- **Footer**: the report's age and the next tick.

The mod API has no modal, so the detail is a **second pane** (`devkit-panel-detail`) that a press opens: the pending list (with `Copiar`, which puts the open tasks' text on the clipboard of the surface you pressed on), a step (Implementação shows the count, a bar and the open sections; the delivery steps show their items as short lists), a document as markdown with a section index and `Abrir no editor`, another change, or an error line. It closes with Escape, `✕` or `Fechar painel`, and a button pressed inside it closes it before its toast. No refresh, timer or render opens or closes it.

The conducted change refreshes at session start, when the pane opens, at the end of each main-loop turn, every 60 s while the pane is open and on `Refresh`. The other changes refresh at most every 5 minutes, and only while the pane is open. A rate-limit line from `gh` pauses the checkers for 15 minutes and the pane says so.

### Pressing a child session

A session row is a button when the app's `mcp__ccd_window__open_session_in` tool is listed: a press opens that session in a split (a window if the split fails). The permission answer `deny` is a toast, and `ask` lets the app ask. A refresh, a timer tick or a render never opens anything. With the tool unlisted the row is plain text and one sidebar hint says so.

## The band, the command and the tool

- **The band** above the prompt, in a devkit project only: one dim line with the actor glyph, the id, the current step with its fact, what is left and who acts (`● <id> · implementação, 40 de 52 tarefas · faltam 9 · Claude age`), else the count of open changes, else "nenhuma change aberta", and an `Abrir painel` / `Fechar painel` button (the second closes the detail pane too).
- **`/devkit-panel`** toggles the pane; **`/devkit-panel status`** prints the pane as plain text, with the conducted change, `via` (`conduct` or `children`) and its children.
- **`mcp__devkit-panel__status`**, a tool for the model and for a headless owner: the same text after a refresh.

## The buttons fill the prompt and never send

Every owner button calls `prompt.fill` with one exact text and nothing else: no `prompt.submit`, no command. The button's label then reads as filled and a toast holds the text, until the next turn ends, another fill, or a prompt box that no longer holds the text. Where no prompt box can take the text (mobile, headless, a dialog in front) the same text is toasted.

| Button | On | Text filled |
|---|---|---|
| Continuar aqui | the Now box, always | `/conduct <id>` |
| Conduzir | every other open change | `/conduct <id>` |
| Aprovar plano | `stop-plan-approval`, `approve` | pt-BR `Aprovo o plano de <id>` · en `I approve the plan of <id>` |
| Responder retro | `stop-retro-answers` | `Approve proposal 1 of <id>` (edit the number and the verdict) |

There is no Ship button: `/conduct <id>` carries a change to its archive, and `/ship-change <id>` stays a command you can type. After a press the button reads `✓ ` plus its label and the hint reads `clique na caixa de texto e aperte Enter`.

## Language

The `language` option of the pack (`/config`, or the `userConfig` of the plugin) selects every pane, band and toast text: `pt-BR` (the default) or `en`; any other value is `pt-BR`. The fill texts above are the same in both languages except `Approve`.

## What it never does

It starts no session, writes no file, never submits a prompt and sets no timer beyond its refresh. `Copiar` is a clipboard copy on your press (`$.ui.copy`): nothing is sent anywhere; the section index of a document moves the detail pane's own scroll (`$.ui.scroll`). Of the app's session tools it uses two: `list_sessions` (read) and `open_session_in` (only on your press). Validate the pack with the desktop app's bundled Claude Code (`claude plugin validate plugins/panel`): the report's `calls:` line lists `$.session.messages`, `$.prompt.read` and `$.tool.call`, and none of `$.prompt.submit`, `$.fs.write`, `$.store`, `$.clock.after` or `$.session.send`. The module keeps its state in the session only (`$.state`). The npm `claude` validates the pack too, and loads it.

## Assets

The pack ships no agents or skills; the generated section below stays empty.

<!-- catalog:begin -->

<!-- catalog:end -->
