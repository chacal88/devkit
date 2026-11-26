# ADR 0033: A change's own settings live in an `x-devkit:` block of its `.openspec.yaml`

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change coordinator-loop-fixes (openspec/changes/coordinator-loop-fixes/approval.md)
- Date: 2026-11-24
- Change: coordinator-loop-fixes
- Number: the next free number across the remote branches when drafted; it may be renumbered when the
  change merges the default branch, if a sibling change took it first
- Relies on: ADR 0010 (0010-openspec-as-the-harness.md), decision 1; ADR 0023
  (0023-the-model-is-chosen-by-stage.md), decisions 1 and 6
- Amends: ADR 0023 (0023-the-model-is-chosen-by-stage.md), decision 1, the place of a change's own
  override: "the `devkit:` block of a change's `.openspec.yaml`" becomes its `x-devkit:` block, and the
  `budget` key that decision 1 names ("as `budget` does") moves with it. No other accepted record states
  where a change's `budget` or `models:` is written

## Context

ADR 0010 decision 1 puts the project's settings in the `devkit:` block of `openspec/config.yaml`. ADR 0023
decision 1 lets a change override single stages of the `models:` table in "the `devkit:` block of a change's
`.openspec.yaml`, as `budget` does", and `docs/openspec-flow.md` ("The token budget.", "The model of each
stage.") shows a change both keys there. The loop reads them through `parseDevkitBlock` (`guard.mjs`):
`budgetOf` and `modelsOf` (`change-loop.mjs`) and `capOf` (`flow-check.mjs`), the change's value winning
over the project's.

A field finding of 2026-11-24 (change `run-status-bar`; `requirements.md` item 27, AC-19) showed that the
`openspec` CLI 2.0.0 refuses that block: `openspec validate <id> --type change --strict` warns
"Unrecognized key name(s) in .openspec.yaml ... devkit" and exits 1. The CLI knows `schema`, `created`,
`goal`, `affected_areas`, `initiative`, `skip_specs` and `retire_capabilities`, and accepts any key that
starts with `x-` ("prefix a key with x- ... to keep tool-specific metadata"); the loop's flat pin and claim
keys (`x-devkit-version`, `x-devkit-flow`, `x-devkit-machine`, `x-devkit-places`) already use that prefix.
Checked again on a scratch copy of this change at the commit of this record: the lines
`budget: 2000000` and `models:` / `review: opus` under `devkit:` exit 1, the same lines under `x-devkit:`
exit 0. A change that follows the document turns its own strict validation, the loop's `merge-check`, its
gates and the `check` red. The OpenSpec key list is outside this repository, and the loop and CI run
`--strict`.

## Decision

1. **A change's own settings are written in an `x-devkit:` block of its `.openspec.yaml`.** The block has
   the shape and the keys of the project's `devkit:` block of `openspec/config.yaml`, so `budget` and
   `models:` are written under it with the same lines, and the loop reads it with the same parser. ADR 0023
   decision 1 otherwise stands: a change overrides single stages of the project's table, the change's value
   winning, and `budget` is overridden in the same place.
2. **One block per file.** A change's file that has a top-level `x-devkit:` line is read from that block
   alone; a `devkit:` block in the same file is then ignored.
3. **A `devkit:` block written before is still read.** A change's file with no `x-devkit:` block is read
   from its `devkit:` block, as today, so no change written by the earlier document loses its budget or its
   models; the strict validation still refuses that file until the block is renamed, and the flow document
   says so.
4. **The project's settings do not move.** `openspec/config.yaml` keeps its `devkit:` block (ADR 0010
   decision 1), which the strict validation of a change does not read.
5. The flat `x-devkit-*` keys keep their meaning and open no block; ADR 0023's other decisions are
   unchanged. ADR 0023 gains a dated Note pointing to this record, its `## Decision` section untouched.

## Consequences

- Positive: a change that sets its own budget or models passes `openspec validate <id> --type change
  --strict`, so its gates, `merge-check` and the `check` stay green; the owner writes the same lines under
  another key; every devkit key of a change's file now carries the `x-` prefix OpenSpec reserves for tools.
- Negative: two names for the same block in a change's file during the transition (Mitigated: a file is
  read from one block only, `x-devkit:` first, and the flow document says to rename the old one). A change
  that keeps its `devkit:` block still fails the strict validation (Accepted: the CLI's own warning names
  the key and the `x-` prefix, and its settings are not lost). The change's block and the project's block
  have different names for the same shape (Accepted: the project's file is not validated against
  OpenSpec's change keys, and renaming it would touch every project's `openspec/config.yaml` for no gain).

### Review trigger

OpenSpec accepts a `devkit` key in a change's `.openspec.yaml`, or stops accepting `x-` keys; OpenSpec
gives tools another place for their metadata; the read of a `devkit:` block in a change's file has been
unused long enough to drop it.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Stop offering a change's own override (AC-19's other choice) | One place for the settings | ADR 0023 decision 1 and the `change-coordination` budget requirements give a change its own override; a change that uses it would lose it, a change of behaviour nobody asked for | medium |
| Flat keys `x-devkit-budget:` and `x-devkit-models:` | No block in a change's file | A second shape for the same settings and a second parser; the block reads with the parser of the project's block | low |
| Keep `devkit:` and validate without `--strict`, or ask OpenSpec to know the key | No move | The loop's `merge-check` and CI run `--strict`; OpenSpec's key list is outside this repository | low |
| Read only `x-devkit:` | One block name in the code | A change written by the earlier document would lose its budget and its models in silence | low |
