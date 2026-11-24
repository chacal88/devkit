<!-- devkit-stage proposal result=passed attempt=1 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Proposal

Change: `archive-release-pin` · Date: 2026-11-23 · Owner: Kaue (chacal88) · Base: `d2010ca` ·
PRD / tech spec: n/a · Requirements: [requirements.md](requirements.md) · Decisions:
[decisions.md](decisions.md), [ADR 0027](../../../docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)

## Why

A retro proposal that bumps devkit-openspec also moves the CI pin lines of `docs/openspec-flow.md`
and the pin assertions of `plugins/openspec/hooks/change-loop.test.mjs`. The archive's file check
(`unnamedFiles` in `plugins/openspec/hooks/deliver-check.mjs`) exempts only paths, so both files
had to be named in the proposal. The archive of review-writer-prompt (commit c561553) stopped on
`apply-proposals` after the owner had approved, and the roadmap found the same gap a second time
(`release-pin-is-a-release-file`).

## What Changes

- The archive's file check also leaves out, with no named proposal:
  - `docs/openspec-flow.md` when its text at the archive branch, with every CI pin masked, equals
    its text at the merge base with every pin masked;
  - `plugins/openspec/hooks/change-loop.test.mjs` when its only added or removed lines are
    `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');`, `assert.doesNotMatch(flow,
    /v<X>\.<Y>\.<Z>/, '<message>');` (any message) and the comment line that starts
    `// Invariant: the CI snippet pins the current release`.
- Any other edit of either file, or a file missing or unreadable on either side, keeps the path
  unnamed. Neither file joins `RELEASE_FILE`, so the release list that `release-merge.mjs` resolves
  in a merge conflict does not grow.
- The rule sits in `unnamedFiles`, so the local archive stop, the readout and `devkit-reviews --ci`
  apply it from one place.
- The pin definition (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) moves from
  `plugins/openspec/hooks/release-merge.mjs` into `deliver-check.mjs`; `release-merge.mjs` imports
  and re-exports it. `deliver-check.mjs` never imports `release-merge.mjs`.
- Docs: the archive-check paragraphs of `docs/openspec-flow.md`, a header line and a Note in ADR
  0003, and the ADRs line of `openspec/config.yaml`.
- Release: devkit-openspec 0.33.0 to 0.34.0 and the marketplace 0.37.0 to 0.38.0 (numbers taken
  from `origin/main` again right before each push), its CHANGELOG entry, the CI pin lines and their
  assertion.
- Non-goals: everything under "Out of scope" in requirements.md. That includes changing which pin
  lines exist, the staleness rule (`stale-only-on-own-files`), requiring a bump in the same diff,
  and making the test read its pin from the manifest.

## Acceptance criteria

<!-- Copied from requirements.md, with their ids. -->
- AC-1: an archive whose only change to `docs/openspec-flow.md` is the CI pins moved to a new version (and no approved proposal names the file) has that path absent from `unnamedFiles`, so `deliver-check` raises no `apply-proposals` stop for it.
- AC-2: an archive that changes `docs/openspec-flow.md` beyond its pin lines (a changed sentence, an added paragraph, a pin marker line with other words changed) still has that path in `unnamedFiles` and still stops with `files no approved proposal names: docs/openspec-flow.md`, unless an approved proposal names it.
- AC-3: an archive whose only changes to `plugins/openspec/hooks/change-loop.test.mjs` are added or removed `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` or `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, '<message>');` lines (any message) and lines starting `// Invariant: the CI snippet pins the current release` has that path absent from `unnamedFiles`.
- AC-4: any other added or removed line in `change-loop.test.mjs` (another assertion, an assertion on another subject than `flow`, a regex that is not a plain `v<X>.<Y>.<Z>`, a changed unrelated test, another comment) keeps the path in `unnamedFiles`.
- AC-10: the real diffs of commit c561553 for `docs/openspec-flow.md` and `change-loop.test.mjs` are kept as fixtures, and both pass the rule; so does the matching pair of a bump whose proposal names neither file.
- AC-5: a file that is missing on either side, or that cannot be read, stays in `unnamedFiles`.
- AC-6: `RELEASE_FILE.source` is unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` is false, and the conflict classification of `release-merge.mjs` is unchanged (a conflict in the doc beyond the pin still blocks); the test `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` changes only in its `unnamedFiles` half, which now splits pin-only from other edits.
- AC-7: the CI check `devkit-reviews --ci` on an archive PR applies the same rule, shown by a test through the shared function, not a second copy.
- AC-8: `docs/openspec-flow.md` (the archive-check paragraphs that list the exempt files) and ADR 0003's exemption list state the new rule, through a note or record the `adr-author` drafts; `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.
- AC-9: the real-run proof covers each case the plan declares: a pin-only doc change passes; a doc change beyond the pin does not; a test-file change of only the two line forms of AC-3 passes; any other test-file change does not; a missing file does not; run against a real archive branch, not only unit tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reviews-check`: the archive pull request's file check gains the pin-line rule for the two
  files. It is stated once for the local archive stop and for `devkit-reviews --ci`, because both
  read one result.

## Impact

- `plugins/openspec/hooks/deliver-check.mjs`: the pin definition, the content rule, the content
  read in `archiveChanges`, and `unnamedFiles` with its two callers. The consumer CI downloads this
  file and still needs only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`.
- `plugins/openspec/hooks/release-merge.mjs`: imports and re-exports the pin definition; no
  behaviour change.
- Tests: `deliver-check.test.mjs` (new tests, one existing test extended, one helper option),
  `release-merge.test.mjs` (the re-export), `change-loop.test.mjs` (only the release's own pin
  lines), and fixtures under `plugins/openspec/hooks/fixtures/c561553/`.
- Docs: `docs/openspec-flow.md`, `docs/adr/0003-auto-merge-the-archive-pr.md` (header line and Note
  only), `openspec/config.yaml` (ADRs line).
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, the CI pin lines; `docs/catalog.md` is checked, not regenerated.
- Dependencies: ADR 0027 is accepted by the loop's `accept-decisions` step after the plan's
  approval. Its number is checked against `origin/main` before each push. Open decisions
  inherited: none.
- Exit criteria: the phase gates of tasks.md, `openspec validate archive-release-pin --strict`, and
  the whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes), which the
  owner or the coordinating session runs as a background command.
