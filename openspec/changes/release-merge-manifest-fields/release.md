# Release note

packs:
- devkit-openspec: minor

## a train join keeps a manifest field only one side edited

- **devkit-openspec**: `release-merge.mjs` (`--base` and the no-note `--merge` join) merges each manifest
  field by field: a field beyond the version fields that only one side edited since the merge base keeps
  that side's value (a pack's `description` in `plugin.json` or `marketplace.json` now rides a train), and
  the catalog follows. A field both sides edited, even to the same value, aborts with
  `a manifest field was edited on both sides: <file> (<field>)`. A pack entry or a manifest the change
  added or removed still aborts with `a manifest was edited beyond its version:`. The noted path is
  unchanged.
- Docs: `docs/openspec-flow.md` and `CONTRIBUTING.md` state the field rule.
