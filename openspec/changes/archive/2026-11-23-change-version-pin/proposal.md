<!-- devkit-stage proposal result=passed attempt=2 commit=cc4d863ed45de6268e0baab71024b91399a9e17e -->
# Proposal

Change: `change-version-pin` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, the grill answered on the owner's delegation). Roadmap line L-1 of
`managed-agents-study` (study item A-1), `openspec/roadmap.md`.

## Why

devkit judges every change by the `flow.json` installed today, and a change's `.openspec.yaml`
records only `schema` and `created`. When the pack changes a flow, the changes already under way are
judged by rules that did not exist when they opened: field finding 7 (the 0.13 to 0.14 upgrade sent
changes under way back to stages they never had) was fixed once, by hand, in
`coordinator-field-fixes` (A-12, AC-10, design D-7). The next flow change would break them again. A
Managed Agents session keeps the agent version it was created with, and a deployment moves only
when updated; a devkit change should do the same.

## What Changes

- Opening a change (`/devkit change`, `/devkit roadmap`, `/devkit project`) writes two `x-` keys to
  its `.openspec.yaml`: the devkit-openspec version and the version of the script's installed
  `flow.json`. OpenSpec 2.0.0 reads `x-` keys without a warning.
- Each schema folder keeps every released flow version as `flows/<n>.json`, so the flow a change
  opened with stays readable after a re-install, on the owner's machine and in the `devkit-reviews`
  job. This change adds `flows/1.json`. Version 1 is the `flow.json` content at `cc4d863`
  (devkit-openspec 0.22.0): the `stage-roles` change edited every `flow.json` in place and kept
  `"version": 1`, so the earlier 0.21.x content of version 1 is not kept. `flows/1.json` and its
  digest are taken from the tree when the task runs, after that merge.
- One reader in `guard.mjs` resolves the flow a change follows (its pin, else version 1). The stage
  readout, the change loop, the product-code hook, the `devkit-reviews` check (and the hand-off and
  stop locks, the roadmap's stage titles, the project loop, and the roadmap conductor's planning rows:
  its plan files and whether it asks requirements and readiness) judge each change by that flow: the
  whole old flow, removed stages and old ceilings included. `design.md` D-4 lists every reader, and
  the few that keep the installed flow, with the reason for each.
- When the installed flow is newer than the change's, the readout and the resume reply of
  `/devkit change` carry one line naming both versions and how to move.
- A new loop command, `change-loop.mjs flow <id>`, moves one change to the installed flow and records
  the new versions; the `script` switch records the installed flow of the new script. No other
  command moves a pin.
- `scripts/check.py` fails when a `flow.json` differs from the released content of its declared
  version, from a digest list in a new `scripts/released-flows.json`.
- Docs (`docs/openspec-flow.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, the `devkit` and
  `openspec-setup` skills) and a release of devkit-openspec.

Non-goals: everything under "Out of scope" in `requirements.md` (the OpenSpec CLI honouring the pin,
automatic or bulk moves, pinning agents or checkers, the consumer re-install check). Also: no stage
changes, every `flow.json` stays at version 1 (AC-4 compares an unpinned change with its behaviour
at `cc4d863`); the previous-script reading of
`coordinator-field-fixes` D-2 and the setup's listing of changes under way (D-7) stay as they are;
the delivery checker keeps tying the owner's approval to the readiness stage; the CI output keeps
its shape.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `open-records-the-pin` — a change opened with `/devkit change` (also through `/devkit roadmap` and `/devkit project`) has in its `.openspec.yaml` the devkit version and the flow version of its script, and `openspec status --change <id>` prints no unrecognized-key warning.
- AC-2 `old-change-keeps-its-flow` — in a scratch project, a change opened on flow version 1 and then a re-installed flow version 2 that adds a stage, removes a stage and changes a ceiling: the stage readout, the change loop's next step, the hook that keeps product code closed and the `devkit-reviews` check all judge it by flow version 1 (the added stage is not asked, the removed stage is still asked, the old ceiling holds).
- AC-3 `new-change-takes-installed-flow` — in the same scratch project, a change opened after the upgrade is judged by flow version 2.
- AC-4 `unpinned-change-unchanged` — a change whose `.openspec.yaml` has no pin is read as flow version 1; with every installed flow at version 1, no behaviour changes for it in the readout, the loop, the hook or the `devkit-reviews` check.
- AC-5 `readout-names-newer-flow` — when the installed flow is newer than the change's, the stage readout and the resume reply of `/devkit change` each carry one line naming both versions and how to move, in `pt-BR` and in `en`; when they are equal, neither carries the line.
- AC-6 `move-only-on-command` — the explicit command moves the change to the installed flow and records the new versions, after which the readout shows the new flow's stages; `next`, `wait`, a setup re-run and a pack update leave the pin as it was.
- AC-7 `flow-change-raises-version` — the repository's checks fail when a `flow.json` differs from the released content of its declared version, and pass when the version is raised.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-stages`: a change follows the flow version it opened with (version 1 without a pin); every
  released flow version stays installed; the product-code gate follows the change's flow; the readout
  names a newer installed flow; a flow change raises its version.
- `change-coordination`: opening records the versions; the `flow` command moves a change on request
  only; the script switch records the new script's flow; the resume reply names a newer flow.
- `reviews-check`: the check asks the readiness stage by the flow the change follows.
- `coordination-locks`: the roles a run may hand work to are those of the flow the change follows.

## Impact

- `plugins/openspec/hooks/`: `guard.mjs` (the flow reader moves here from `flow-check.mjs`, plus the
  pin reader), `flow-check.mjs`, `change-loop.mjs`, `deliver-check.mjs`, `roadmap-loop.mjs`,
  `conduct-check.mjs`; a new suite `version-pin.test.mjs`. The CI job still downloads the same three
  files.
- `plugins/openspec/schemas/<script>/flows/1.json` and its copy under `openspec/schemas/`, for
  `devkit`, `devkit-lite` and `devkit-project`.
- `scripts/check.py`, new `scripts/released-flows.json`.
- Skills and docs named above; `CHANGELOG.md`, `plugin.json`, `marketplace.json`, `docs/catalog.md`.
- Projects: a change opened before the release has no pin and reads as flow version 1. A project's
  pinned `devkit-reviews` workflow honours pins once it moves to this release's tag.

**Exit criteria.** The phase gates of `tasks.md`: the whole guard suite with the CI branch variables
set, `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`
and `openspec validate change-version-pin --strict`.

**Decisions cited.** ADR 0004 (opt-in unchanged), ADR 0010 decision 1 (the flow lives under the
project's `openspec/`), ADR 0011 (a hook's own error never traps), ADR 0012 (which changes the check
judges, unchanged). No new ADR (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None. The open point "Project setup" of
`docs/coordination-design.md` (round 26) will install the schemas differently; it must keep the
`flows/` folder, which `design.md` records.
