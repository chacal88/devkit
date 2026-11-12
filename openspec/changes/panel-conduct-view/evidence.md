Commit: 1077219956e46fe2d6a0c73c0d7220209dc3f785

# Evidence: panel-conduct-view

Verified by `pr-verifier` on branch `panel-conduct-view`, 2026-11-12. The code is the head above; the only
uncommitted files are the review files under `openspec/changes/panel-conduct-view/` (`review.md`, `reviews/`).
The bundled binary is the version-agnostic form of the gate lines (2.1.321, `ddbdf2b334e1`); the npm binary is
2.1.227. The rollout-switch refusal of `plugin test` was met first and cleared by one
`-p "ok" --max-turns 1 --model haiku` run from `/private/tmp`.

## Verification

### Gates

Each part ran as its own command; the exit code decided.

| Gate | Command | Result |
| --- | --- | --- |
| 1.9, 2.9, 3.9, 4.9, 5.9 | `"$BUNDLED" plugin test plugins/panel` | pass: exit 0, 162 pass, 0 fail, 2 files (`panel.test.tsx`, `report.test.tsx`) |
| 1.9, 2.9, 4.9 | `"$BUNDLED" plugin validate plugins/panel` | pass: exit 0, `✔ Validation passed` (one plugin-directory warning, no icon, which the command says does not change the result) |
| 1.9, 4.9 | `"$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate plugins/panel` | pass: exit 0, `✔ Validation passed with warnings` (the `types` field is unknown to the npm CLI and ignored at load time) |
| 1.9 | `"$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate .` | pass: exit 0, `✔ Validation passed with warnings` (same `types` warning) |
| 3.9 | `"$BUNDLED" plugin validate .` | pass: exit 0, `✔ Validation passed` |
| 3.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 648 pass, 0 fail (background run, 10 min 43 s) |
| 3.9, 4.9 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 3.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.7, 4.8 | `npx -y -p typescript@5.6.3 tsc -p <scratchpad>/tsc-v/tsconfig.json` | fail: exit 2, three errors (below) |

`$BUNDLED` is `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"`,
as the gate lines write it.

The type check used the tsconfig of the earlier session that ran 2.7 and 4.8 (strict, `noUncheckedIndexedAccess`,
`jsx: react` with `h`/`Fragment`, one file, the bundled skill's 2.1.317 `claude-code.d.ts`, `include` of
`plugins/panel/hooks` and `plugins/panel/types`), copied to `<scratchpad>/tsc-v/tsconfig.json`. Exit status 2, errors:

```
plugins/panel/hooks/pane.tsx(654,13): error TS2783: 'width' is specified more than once, so this usage will be overwritten.
plugins/panel/hooks/register.tsx(593,142): error TS2322: Type '"terminal" | "desktop" | "mobile" | "vscode"' is not assignable to type '"terminal" | "desktop" | "mobile" | undefined'.
plugins/panel/hooks/register.tsx(615,7): error TS2322: the same type, '"vscode"' not assignable.
```

Both of the two bundled-skill 2.1.317 contract files (hashes `0be87fe2...` and `4c4c4113...`) give the same three errors.
Task 2.7 says any other exit than 0 ends the phase with `Outcome: failure`. See "Defect found" below.

### Re-run of 1.1: npm install in a new scratch config folder

`CLAUDE_CONFIG_DIR=<scratchpad>/npm-cfg-v` (new, empty), npm Claude Code 2.1.227, from the worktree:

```
plugin marketplace add <worktree>          -> ✔ Successfully added marketplace: devkit (declared in user settings)   exit 0
plugin install devkit-panel@devkit --scope user -> ✔ Successfully installed plugin: devkit-panel@devkit (scope: user)  exit 0
plugin list                                -> ❯ devkit-panel@devkit
                                                 Version: 0.2.0
                                                 Scope: user
                                                 Status: ✔ enabled                                                    exit 0
```

### Bundled validate: the `calls:` line

From `"$BUNDLED" plugin validate plugins/panel` (exit 0):

```
./register.tsx calls: $.clock.every, $.clock.now, $.command.register, $.env.get (via locateChecker), $.fs.exists (via deliverReport, folderOf, isDevkitRoot, readFolder, readJson), $.fs.list (via dirNames, readDoc, readFolder), $.fs.read (via isDevkitRoot, readJson, readText), $.process.run (via runProcess), $.prompt.fill (via fill), $.prompt.read (via clearFilledIfChanged, standsInPrompt), $.session.messages (via transcript), $.session.root (via load), $.state.get, $.state.set, $.tool.call (via callAppTool), $.tool.check (via mayList, openChild), $.tool.list (via isListed, mayList), $.tool.register, $.ui.close (via closeDetail, openDetail, togglePane), $.ui.copy (via copyText), $.ui.open (via openDetail, togglePane), $.ui.panes (via isPaneUp, isUp), $.ui.resolve, $.ui.scroll (via scrollTo), $.ui.toast
```

It lists no `$.prompt.submit`, `$.fs.write`, `$.store`, `$.clock.after` or `$.session.send`. The two presses design D13 allows
(`$.ui.copy`, `$.ui.scroll`) are listed. `env writes: nothing`.

## Live check

Source: the conducting session's record, `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-panel-conduct-view-404c57/6ffeea67-627a-41cd-b057-0a9201f88a1f/scratchpad/live-check-record.md`.
The screenshots the owner and the session looked at are not in the repository: they were attached to the conversation.

**Load route.** The first route, `.claude/settings.local.json` setting `CLAUDE_CODE_PLUGIN_DIRS`, did nothing
(the variable is read only from the process environment or `~/.claude/settings.json`; the app restart kept 0.1.0), and
it was removed. The working route is a dev-mods link `~/.claude/dev-mods/<session>/devkit-panel` to this worktree's
`plugins/panel` (0.2.0); hot reload was turned on by the permission mode.

**Transcript form that matched.** `via: command` (the slash-command transcript form) in round 1 and in the first status
of round 2; later `via: children`, when the last `/conduct` the owner typed had a trailing backslash, an invalid id,
so the child-session signal decided, as design D3 says.

**Round 1** (phases 1 to 3 loaded, 0.2.0):
- First live status: top card `✕ panel-conduct-view.` and `no change panel-conduct-view.: ...`, `via: command`.
  Finding 1: the owner's `/conduct panel-conduct-view.` kept the trailing period in the id. Fixed red-first: the id is
  normalized and the next signal decides (107 tests after).
- Status after the fix: top `● panel-conduct-view Claude`, `implementar fase 4`, `via: command`, phase bar `fase 4 de 4`,
  `Entrega 1/8`, `Sessões 3`, button `Conduzir Entregar`; `Em andamento 4`. Band: `devkit · panel-conduct-view · fase 4/4 · implementar fase 4 · Claude` and `Fechar`.
- Child press: the owner, "eu fiz o passo um e abriu do lado", then "depois fechei": the child session opened beside, nothing started.
- Button press: "cliquei em conduzir e apareceu o texto na caixa", then "e apaguei e mandei o print": the button filled
  `/conduct panel-conduct-view` in the prompt box, not sent; the button then read `no prompt, pressione Enter`.
- Findings from the owner's screenshot: the phase bar's line crossed the `fase 4 de 4` label and ran past the right edge; actor
  `Claude` on the owner-run phase; two dividers of different widths; the button label cut. Fix: dispatched in the plan revision.
- The owner's request: pressing `tarefas` should open a modal, "como funciona no outros". No centered modal exists in the mod
  API; the owner chose `Painel de detalhe agora` (a second pane on an item press). That became the detail pane, a plan
  revision, readiness and a new approval.

**Round 2** (after the approved mock; plan re-approved, `Aprovo o plano`):
- Status text after phase 4 (`via: command`): top `Esta conversa conduz` with the id, a summary cut and in English (a note
  of the conducting session), `devkit · branch panel-conduct-view`; `Agora` with `você age · Implementar a fase 5: Live check, owner-run`;
  `Passos 4 de 10` (Implementação 26 de 29 tarefas); `Pendências 3` (5.1, 5.2, 5.9); `Documentos` (Proposta, Design, Tarefas);
  `Sessões 4` (Fase 1 to 4 ociosa); `Outras changes abertas 4`; footer `Atualizado há 0 s`. Notes: phase names and pending
  titles come from English task text; the group showed `▾` in the text form.
- Finding: mid-phase, hot reload crashed on a view-3 stored value (`conducted.docs.map`). Fixed red-first (a stored value of
  the older shape draws without throwing).
- Finding: after pressing `Continuar aqui`, the box was filled but the owner's Enter re-pressed the pane button, because the
  keyboard stays on it ("quando eu dou Enter, ele continua com o botão da caixa selecionado"). The mod API cannot focus the
  prompt (`prompt.fill` has no focus option). Fix: a pressed fill button is a no-op while the draft still holds its text, and
  the hint and toast say `clique na caixa de texto e aperte Enter` (146 tests). The owner, still without focus change, chose
  `Manter com a dica`; the prompt-focus request is to be recorded as an app limit in the retro.
- Finding: section dividers ended in `…` (clipped as text). Fixed in the same round; the hint under `Outras changes abertas`
  now reads `independentes desta conversa; nenhuma precisa terminar antes`.
- Environment finding: the app updated its bundled Claude Code to 2.1.321, so the 2.1.317 path in six gate lines no
  longer existed; fixed by the version-agnostic gate form, readiness again and the owner's `Aprovo o plano` again.
- What each press did, the owner's words: a pending row opened the detail and Esc closed it ("a pendência abriu o detalhe e o esc fechou");
  `Proposta` opened the document pane, the `Implementação` step opened its detail and a child row opened the session ("tudo ok");
  `Copiar` on a pending row's detail copied the text ("1 - sim"); `Abrir no editor` on a document "abriu uma janela" ("2 - abriu uma janela");
  `Continuar aqui` and `Conduzir` fill the box without sending, with the hint.
- Screens against the mock (four screenshots: pane vs main mock, step rows, pending detail vs detail mock, Proposta
  document pane vs document mock). The owner's verbatim reading: "caixas diferentes / fundos diferentes, espacamentos diferentes /
  fundo diferente nos itens selecionados (vermelho) / fundo em pendencia, alinhamentos, espacamentos diferentes / na tela de
  proposta tudo esta diferente tambem". What the session saw: content wider than the pane (right column cut), dividers drawn
  twice, the `Agora` box white with a border instead of the mock's tinted box, the current step row untinted, raw task text and
  shell text in the pending detail, plain text tabs and a vertical section index in the document pane. The mod API's Box has
  `backgroundColor` and `borderStyle`, so the earlier text-only substitutes were wrong. Fixed: mock fidelity (158 tests).
- The owner after the mock-fidelity fix: "esta tudo certo, unica coisa é quando eu aumento ou dimuno a tela ele quebra": after a
  resize the glyph progress bar wrapped and the divider ended in `…`; the `Faltam` row read `0/3 · Claude` for the owner-run phase.
  Fix: bar and rules drawn as Boxes with percentage width, and the owner-run actor in the step detail.
- The owner: "nao quebra mais mas a faixa esta dupla": the bar rendered as two rows and each divider as a thick grey band.
  Fix: the bar Box with an explicit row direction, desktop dividers dropped in favour of section spacing.
- Owner's final verdict: `Ficou certo` (bar one row, no grey bands, sections spaced as the app panel), at 161 tests; the
  gate above ran 162 at the verified head.

## Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `conducted-change-on-top` the conducted change is one card on top and nowhere lower | `plugin test plugins/panel`: 10 passing cases named `AC-1 conducted-change-on-top` (first-line `/conduct <id>`, single-change form, no repeat lower); live check: the top card showed the conducted id in both rounds | pass |
| AC-2 | `phase-progress` the Implementation step shows tasks done of the total, its detail the percentage and a bar | `plugin test`: 2 cases `AC-2 phase-progress` plus the combined cases; the detail's bar cases at 24, 38, 80 and 140 columns; live: `Implementação 26 de 29 tarefas`, and after the resize fix the bar is one row | pass |
| AC-3 | `pr-and-checks` the PR step shows the number and green/red/running, none without a PR | `plugin test`: 7 cases `AC-3 pr-and-checks` (item met reads green on the PR row, with and without a PR) | pass |
| AC-4 | `delivery-items` the eight delivery items with status and a short pending list in the step that holds them | `plugin test`: 11 cases `AC-4 delivery-items` (items 1 and 4 under Provas, 2 and 3 under Revisão, 5 to 8 under PR and checks; short lists, `+N` tail) | pass |
| AC-5 | `child-sessions-with-icons` linked children as rows, archived folded, a press opens the session and starts nothing | `plugin test`: 21 cases `AC-5 child-sessions-with-icons` (prefix matching, archived fold, opens beside); live: the owner pressed a child row and it opened beside, nothing started | pass |
| AC-6 | `other-changes-collapsed` other open changes folded at the bottom with a count, each with progress and `Conduzir` | `plugin test`: 7 cases `AC-6 other-changes-collapsed`; live: `Outras changes abertas 4`, later `3` after one archived | pass |
| AC-7 | `no-conducted-change` with no conducted change the pane is the empty screen with the open changes | `plugin test`: the case named `AC-7 no-conducted-change` (shared with the folded-group slug) on both surfaces; the live check ran with a conducted change, so the empty screen has the test proof only | pass |
| AC-8 | `buttons-visibly-fill` a button fills the box with its exact command, never submits, and says so | `plugin test`: 9 cases `AC-8 buttons-visibly-fill`; live: `Conduzir` and `Continuar aqui` filled the box without sending, with the hint `clique na caixa de texto e aperte Enter`; the mod API cannot move focus to the prompt, a limit the owner accepted (`Manter com a dica`) | pass |
| AC-9 | `band-shows-conducted-change` the band line shows glyph, id, step, what is left, who acts, and the toggle | `plugin test`: 3 cases `AC-9 band-shows-conducted-change`; live: the band read `devkit · panel-conduct-view · fase 4/4 · implementar fase 4 · Claude` and `Fechar` | pass |
| AC-10 | `loads-in-both-clis` devkit-panel loads and validates with the npm 2.1.227 and the bundled 2.1.321 | npm: `marketplace add`, `install` and `plugin list` re-run in the new scratch config `npm-cfg-v`, all exit 0, list shows `devkit-panel@devkit`, `Version: 0.2.0`, `Status: ✔ enabled`; `plugin validate .` passes with the npm binary (exit 0) and with the bundled one (exit 0), and `plugin validate plugins/panel` with both (exit 0); the `langOf` case in `plugin test` | pass |
| AC-11 | `read-only-kept` no `prompt.submit`, `fs.write`, `store`, `clock.after` and no session-mutating tool call; the mod's tests pass on `terminal` and `desktop` | the bundled validate's `calls:` line above lists none of them (only `$.ui.copy` and `$.ui.scroll`, the two presses of design D13); `plugin test` 162 pass, 0 fail, including `AC-11 read-only-kept` (every trigger, every button, a child press, both band states, the detail pane) and the case that no refresh ever calls `open_session_in` | pass |
| AC-12 | `looks-like-app-panel` the pane follows the approved mock screen by screen, dividers never wrap, owner confirms it is readable | `plugin test`: 4 cases `AC-12 looks-like-app-panel` (no text-form line longer than the columns, rows laid out to the pane width, one divider per boundary, the bar at 24 to 140 columns). Owner half, from the live check: after the mock comparison and two resize fixes the owner said `Ficou certo` (bar one row, no grey bands, sections spaced as the app panel). The screenshots are not in the repository | pass |
| AC-13 | `live-check` loaded through the app while `/conduct <id>` runs, the pane shows the change with its summary, Now box, steps, pending, documents, sessions, next step; text and reading recorded | the "Live check" section above: the dev-mods load route, both rounds' status text and `via`, every finding and its fix, the owner's final verdict `Ficou certo`. The screenshots were attached to the conversation, not committed | pass |
| AC-14 | `flow-steps-you-are-here` ten steps with done, partial, current, pending marks and a count; a press opens the detail | `plugin test`: 11 cases `AC-14 flow-steps-you-are-here`; live: `Passos 4 de 10`, the `Implementação` step opened its detail | pass |
| AC-15 | `summary-and-documents` summary line, repository and branch, and a Documents row that opens the document pane | `plugin test`: 6 cases `AC-15 summary-and-documents`; live: `Documentos` (Proposta, Design, Tarefas), `Proposta` opened the document pane, `Abrir no editor` opened a window. The summary showed in English and cut (conducting session's note, from the proposal's own `Summary:` line) | pass |
| AC-16 | `detail-pane` a pending row opens the detail pane that closes on Escape, grouped, folded text with `Copiar`, nothing started | `plugin test`: 7 cases `AC-16 detail-pane` on `terminal` and `desktop`; live: a pending row opened the detail, Esc closed it, `Copiar` copied the text | pass |
| AC-17 | `sections-say-what-they-are` headings, hints and buttons read as the mock writes them, in pt-BR and en | `plugin test`: 5 cases `AC-17 sections-say-what-they-are` pinning both languages; live: `Esta conversa conduz`, `Agora`, `Passos`, `Pendências`, `Documentos`, `Sessões`, `Outras changes abertas` with its hint | pass |
| AC-18 | `owner-run-actor` on an `owner-run` phase the Now box and band show the owner as who acts | `plugin test`: 4 cases `AC-18 owner-run-actor`; live: `você age · Implementar a fase 5: Live check, owner-run`; the step detail's actor fixed after the owner's resize finding | pass |
| AC-19 | `now-box` a Now box with the step, who acts as a pill, what is left and next, and `Continuar aqui` | `plugin test`: 2 cases `AC-19 now-box` plus the combined cases; live: the `Agora` box tinted, as the mock | pass |
| AC-20 | `pending-list` open tasks one per line with a short tag; a press opens the pending detail | `plugin test`: 5 cases `AC-20 pending-list` plus the combined cases; live: `Pendências 3`, a pending row opened the detail | pass |
| AC-21 | `step-detail` the Implementation step's detail shows done of total, percentage, bar, open sections, done dimmed, `Ver tasks.md` | `plugin test`: the case `AC-21 step-detail` plus the combined cases shared with the delivery-items slug and the bar cases; live: the `Implementação` step detail, fixed for the resize wrap and the bar rows, then `Ficou certo` | pass |

## Defect found

`tsc` (task 2.7, re-run for 4.8) exits 2 on the head `1077219`, with three errors, all in code of the commit `0820110`:

- `/Users/kauesantos/Documents/devkit/.claude/worktrees/panel-conduct-view-404c57/plugins/panel/hooks/pane.tsx` line 654: `width="100%"` is set and a later spread in the same props (line 659, `{...(isTint ? { ..., width: '100%' } : {})}`) sets `width` again (TS2783).
- `/Users/kauesantos/Documents/devkit/.claude/worktrees/panel-conduct-view-404c57/plugins/panel/hooks/register.tsx` lines 593 and 615: `e.surface` has the type `"terminal" | "desktop" | "mobile" | "vscode"` and is passed where the 2.1.317 contract accepts `"terminal" | "desktop" | "mobile"` (TS2322).

Reproduce: the tsconfig described under Gates, then `npx -y -p typescript@5.6.3 tsc -p <that tsconfig>`. Also, with the engine-written
`plugins/panel/.claude-plugin/types/tsconfig.json`, `tsc` fails (the first error is the same `width`, and test mounts lack `isCollapsed`). The tests and
both validates pass, so this does not show at run time; it is the failure 2.7 says ends a phase. Nothing was fixed.

Outcome: defect-found.
