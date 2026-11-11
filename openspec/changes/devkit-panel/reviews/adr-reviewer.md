Commit: 0d186c7544335d0e2a1829cb822258bd1d3438df
Verdict: approved
Reviewer: general-purpose subagent following plugins/core/agents/adr-reviewer.md (the devkit-core agent type is not loaded in this session)

## ADR review — devkit-panel

Material: `git diff ae2b676...0d186c7` (plan commit 80ccbc7 and implementation commit 0d186c7 on top of origin/main ae2b676): the new pack `plugins/panel/`, `plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs` (`PACKS`), the release files and docs, and the change package `openspec/changes/devkit-panel/`. Round 1, no previous findings.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`). ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`) is superseded by ADR 0006 and was skipped. No ADR index and no open-decisions log exist in the repository.

### The claim of design D16 checked against the code

D16 (`openspec/changes/devkit-panel/design.md:350-357`) says the panel stays within ADR 0001: it reads the repository, GitHub through the checkers and the app's session list; starts nothing, drives nothing, schedules only its own redraw, keeps state only in the session. Verified:

- Every engine call the module makes (`plugins/panel/hooks/register.tsx`, `project.ts`, `sessions.ts`; `pane.tsx`, `report.ts`, `commands.ts` touch no `$`): `$.process.run` (`register.tsx:39`), `$.tool.list` and `$.tool.check` (`sessions.ts:66-67`), `$.tool.call` of `mcp__ccd_session_mgmt__list_sessions` only after `allow` (`register.tsx:77-80`), `$.prompt.fill` (`register.tsx:173`), `$.clock.every` and `$.clock.now` (`register.tsx:210`, `:109`), `$.fs.exists/read/list` (`project.ts:37-38`, `:94`; `register.tsx:57`, `:90-91`), `$.ui.open/close/panes/resolve/toast`, `$.command.register` (`:205`), `$.tool.register` (`:206`), `$.session.root`, `$.env.get`. No `prompt.submit`, `fs.write`, `store`, `clock.after`, `start_session` or any other session tool. The test world records every `prompt.submit` and AC-8 asserts none (`plugins/panel/hooks/panel.test.tsx:66`, `:148-151`, `:510`).
- The processes it runs are the two checkers, both documented and seen as read-only: `conduct-check.mjs:3` ("never writes files, refs or GitHub objects, never fetches"), `deliver-check.mjs:3` ("never writes, pushes or posts"); the `git push` at `conduct-check.mjs:361` is a step's `command` field in the report, not something the checker executes. The panel never passes `--watch`, so no checker waits (`register.tsx:49`, `:58`, `:65`).
- State: three `$.state` atoms (`register.tsx:27-29`), declared in `plugins/panel/types/index.d.ts:87-96`; nothing under the project and nothing in `$.store`. This is presentation state (the last report, the fold map, the `--change` probe) that no step reads, so ADR 0001 § Decision ("no state outside the repository and GitHub", which governs coordination state) and ADR 0006 § Decision 4 are not touched.
- The timer: `$.clock.every(60000)` (`register.tsx:210-212`) runs `refresh` only while the pane is listed by `$.ui.panes()` (`:180-182`); its tick submits no prompt and produces no turn, so it is neither ADR 0001's "long-running process" (it drives no step) nor the automated turn ADR 0006 § Consequences says breaks the continuation chain. ADR 0006 § Decision 3 ("the conducting skill schedules nothing") binds the conducting skill; the panel conducts nothing.
- Sessions: read through the app's own list, which ADR 0006 § Decision 4 counts as state a coordinator may read; the panel never starts, groups, archives or messages a session (`sessions.ts:8`: the one tool it names).
- The owner's human gates stay human (ADR 0001 § Decision, ADR 0006 § Decision 1): the `Approve` and `Answer` buttons only fill the box (`commands.ts:40-41`, `register.tsx:172-175`); the owner sends the text.

### Checked against ADR 0004

- The panel draws only where the hooks act: `plugins/panel/hooks/project.ts:20-27` copies `guard.mjs:136-144` (the same `/^schema:\s*["']?([\w.-]+)/m` regex and the same `['devkit', 'devkit-lite']` list) and `register.tsx:89-92` reads `<root>/openspec/config.yaml` through it at every refresh; elsewhere `register.tsx:98-101` writes `not-devkit`, no checker runs and the band hands on (`:252`). The design (D3, `design.md:92-101`) cites ADR 0004 for it.
- Opt-in by committed files: the pack installs at project scope (`plugins/panel/README.md:6-7`, `docs/openspec-flow.md` section "The panel: devkit-panel"), and `openspec-setup --packs` accepts it through `PACKS` (`plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs:16`), `DEFAULT_PACKS` unchanged, so no project gets it without asking.

### Checked against ADR 0002 and ADR 0003

Nothing in the diff enables, disables or pins auto-merge, touches `devkit-reviews`, the ruleset or the archive PR; the panel only displays `enable-auto-merge` / `wait-*` steps as text and offers `/ship-change <id>` as a fill (`commands.ts:10-28`). Not in scope.

### Findings

- [nit] `plugins/panel/hooks/register.tsx:205-209` — drifts slightly from ADR 0004 (`docs/adr/0004-devkit-per-project.md`) § Consequences ("projects that did not choose devkit pay no context")
  - What is wrong: the `/devkit-panel` command and the `mcp__devkit-panel__status` tool are registered at `session.start` in every project the mod loads in, so a user-scope install by mistake puts one tool description in the model's context of non-devkit projects (the hooks themselves then do nothing: `:98-101`). ADR 0004 governs the devkit-openspec hooks and relies on the per-project install for the rest, which the docs teach, so this is intent, not a violation.
  - Fix: one sentence in `plugins/panel/README.md` "What it never does" saying that outside a devkit project the pack still registers the command and the tool (both answer the one line) and that `--scope project` is how a project keeps them out.
- [nit] `openspec/changes/devkit-panel/design.md:350-357` (D16) — cite ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`) § Decision for the human gate the `Approve` button touches
  - What is wrong: D16 argues read-only-ness but does not say why filling `I approve the plan of <id>` (`commands.ts:40`, `i18n.ts:48`, `:80`) keeps the owner's plan approval a human gate: the owner reads the text in the box and sends it, exactly as when typing it, and the conduct skill records the approval on that owner turn. The review trigger D16 names (`prompt.submit` accepted as the owner's turn) is the right one; the gate should be named beside it.
  - Fix: add one sentence to D16 naming the plan-approval gate and that the fill leaves it with the owner.
- [nit] `openspec/changes/devkit-panel/requirements.md:155-158` — process deviation against ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`) § Decision ("one writer per gate file"), acknowledged
  - What is wrong: the readiness, review and evidence files of this change are written by general-purpose subagents told to follow the devkit-core definitions, because the agent types are not loaded in the conducting session; the hooks' identity check behind the one-writer rule therefore does not apply to this change's gate files. The gate itself (approved reviews and evidence before the PR) is unchanged, the deviation was the owner's decision in the grill and is recorded (`readiness.md:7`, this file's `Reviewer:` line). No ADR text locks the writer's agent type, so this is a drift to keep visible, not a violation.
  - Fix: keep the one-line note in `evidence.md` and in every `reviews/<reviewer>.md` of this change, as requirements.md already asks.

### Summary
- 3 findings (0 blocking, 0 important, 3 nit)
- ADR review — pass on substance: the panel reads (repository, checkers, the app's session list), fills the prompt and never submits, runs no step, starts no session, schedules only its own redraw while the pane is open, and keeps presentation state in the session only. D16's "within ADR 0001, no ADR" holds against the code; ADR 0004's opt-in is read the same way the hooks read it. No `REQUIRES SUPERSEDER`, no open decision touched, nothing beyond the approved scope.
