<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> a change records, when it opens, the devkit version and the flow version it opened with in its `.openspec.yaml`, and the checker and the loop judge it by that flow: a stage a later version adds does not apply to a change opened before it, and a change moves to the new flow only through an explicit command, as a Managed Agents session keeps the agent version it was created with and a deployment moves only when updated (field finding 7; managed-agents-study A-1)

## Classification

domain=process type=feature flags=[contract] (strict-assumed: the change's `.openspec.yaml` is read by the OpenSpec CLI and by every devkit checker)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Scope (question 1, answered by the coordinating session on the owner's delegation: `Por favor, verifique todas as perguntas e as que você tiver a informação para responder, pode ir respondendo`): the pin is honoured by devkit's own readers only: the change loop (`plugins/openspec/hooks/change-loop.mjs`), the stage readout (`plugins/openspec/hooks/flow-check.mjs`), the `devkit-reviews` check (`plugins/openspec/hooks/deliver-check.mjs --ci`) and the hook that keeps product code closed (`plugins/openspec/hooks/guard.mjs`). `openspec status` and `openspec instructions` may keep showing the installed flow.
- Whole old flow (question 2, answered by the coordinating session on the same delegation): a change is judged by the whole flow it opened with, not only spared the stages added later. A stage a later flow removes is still asked of it, and a rule a later flow changes (a ceiling, a stale rule, an `onFail` target) stays as it was when the change opened, until the explicit command moves it.
- Notice and the owner's request (question 3, answered by the coordinating session on the same delegation): when the installed flow of a change's script is newer than the flow the change follows, the stage readout and the resume reply of `/devkit change` say both versions in one line; the change moves only when the owner asks, and the session then runs the explicit command.
- The pin lives in the change's `.openspec.yaml` under keys prefixed `x-` (for example `x-devkit-version` and `x-devkit-flow`; the planner picks the exact names). Proved on a scratch copy with OpenSpec CLI 2.0.0: unprefixed unknown keys make `openspec status` print an "Unrecognized key name(s)" warning, while `x-` keys are read silently and `openspec validate` stays clean.
- The devkit version recorded is the `version` of `plugins/openspec/.claude-plugin/plugin.json` at open (today `0.22.0`); the flow version is the `version` field of the script's `openspec/schemas/<script>/flow.json` (today `1` for `devkit`, `devkit-lite` and `devkit-project`). The devkit version is information for the reader; only the flow version decides.
- A change with no pin (every change opened before this release, the open sibling changes of the roadmap among them) is read as following flow version 1. Version 1 is the content of the `flow.json` files at `origin/main` `cc4d863` (devkit-openspec 0.22.0): the stage-roles change edited version 1 in place, and the earlier 0.21.x content of version 1 is not kept (0.22.0 made changes under way compatible through `appliesWhen` and `notAfter`). From this change on, a flow edit raises the version. Since every installed flow is still version 1, nothing changes for unpinned changes compared with `cc4d863`.
- The flow a pinned change opened with must stay readable after the project re-runs `openspec-setup` with a newer pack, on the owner's machine and in the `devkit-reviews` job. Where it is kept (a copy in the change folder, or every released flow version kept by the pack) is the planner's choice.
- A change to a `flow.json` (a stage added, removed or changed, or a rule changed) must raise its `version`; the repository's checks refuse a flow change that keeps the version. A sibling change that merges after this one and touches a `flow.json` follows that rule.
- The explicit command (by its effect; the planner picks the literal command, beside the existing `change-loop.mjs script` switch): it moves one change to the installed flow of its script and records the new flow and devkit versions; the stages of the new flow then show as next where they apply. Switching a change's script with `change-loop.mjs script` is also explicit and records the installed flow of the new script. No other command (`open` of another change, `next`, `wait`, a setup re-run, a pack update) moves a change's pin.
- This change does not change any stage, so every `flow.json` stays at version 1.
- Proven here: tests in the hook suites on scratch projects that simulate an upgrade (a flow version 2 that adds a stage, removes one and changes a ceiling). Dogfood, owed to the next change opened in this repository after the release: its `.openspec.yaml` carries the pin. The re-install check in the consumer projects is owed when the owner next works in them.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `open-records-the-pin` — a change opened with `/devkit change` (also through `/devkit roadmap` and `/devkit project`) has in its `.openspec.yaml` the devkit version and the flow version of its script, and `openspec status --change <id>` prints no unrecognized-key warning.
- AC-2 `old-change-keeps-its-flow` — in a scratch project, a change opened on flow version 1 and then a re-installed flow version 2 that adds a stage, removes a stage and changes a ceiling: the stage readout, the change loop's next step, the hook that keeps product code closed and the `devkit-reviews` check all judge it by flow version 1 (the added stage is not asked, the removed stage is still asked, the old ceiling holds).
- AC-3 `new-change-takes-installed-flow` — in the same scratch project, a change opened after the upgrade is judged by flow version 2.
- AC-4 `unpinned-change-unchanged` — a change whose `.openspec.yaml` has no pin is read as flow version 1; with every installed flow at version 1, no behaviour changes for it in the readout, the loop, the hook or the `devkit-reviews` check.
- AC-5 `readout-names-newer-flow` — when the installed flow is newer than the change's, the stage readout and the resume reply of `/devkit change` each carry one line naming both versions and how to move, in `pt-BR` and in `en`; when they are equal, neither carries the line.
- AC-6 `move-only-on-command` — the explicit command moves the change to the installed flow and records the new versions, after which the readout shows the new flow's stages; `next`, `wait`, a setup re-run and a pack update leave the pin as it was.
- AC-7 `flow-change-raises-version` — the repository's checks fail when a `flow.json` differs from the released content of its declared version, and pass when the version is raised.

## Out of scope

- Making the OpenSpec CLI (`openspec status`, `openspec instructions`) honour the pin.
- Moving changes to a new flow automatically, in bulk, or on a pack update.
- Pinning the agents, skills or checkers themselves: a pinned change keeps its stages and rules, and is still carried out by today's agents.
- The re-install check in the consumer projects.

## Questions asked

1. [scope] Where does an open change keep following the flow it opened with? → devkit's own readers only (loop, readout, `devkit-reviews`, hook); answered by the coordinating session on the owner's delegation.
2. [edges] A later flow removes a stage or changes a rule: does an open change keep its whole old flow, or only ignore the added stages? → the whole old flow; answered by the coordinating session on the same delegation.
3. [end effect] How does the owner learn that a newer flow is installed, and who moves the change? → the readout and the resume reply say both versions; the change moves only when the owner asks; answered by the coordinating session on the same delegation.

## Escalations

- None.
