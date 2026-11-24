<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the archive check counts the CI pin in `docs/openspec-flow.md` and its assertion in `plugins/openspec/hooks/change-loop.test.mjs` as release files, as it already counts the manifests and `CHANGELOG.md`, so a retro proposal that bumps devkit-openspec does not have to name them; found at the archive of review-writer-prompt, whose proposal 1 had to name both after the owner's approval
>
> The roadmap line `release-pin-is-a-release-file` asks for the same fix, found a second time (tick both lines at archive): the archive check of `deliver-check.mjs` (`RELEASE_FILE`) accepts the CI pin lines of `docs/openspec-flow.md` moved with a devkit-openspec bump, as it accepts `plugin.json`, `marketplace.json`, `CHANGELOG.md` and the catalog, so a retro proposal that bumps the pack needs not name the doc (change-state archive, 2026-11-23)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Grill answer A, given by the coordinating roadmap session under the owner's delegation of 2026-11-23: only the pin lines of `docs/openspec-flow.md` and `plugins/openspec/hooks/change-loop.test.mjs` pass the archive check unnamed; any other edit of either file still needs a named, owner-approved retro proposal. The whole-file option (as for `CHANGELOG.md`) was refused: it would widen the no-review auto-merge of the archive PR (ADR 0003) to a whole doc and a test file.
- The script is `devkit` (switched from `devkit-lite`, reason `contract`): the exemption list of ADR 0003 is a decision other parts depend on, so a note or record on ADR 0003 goes through the `adr-author`.
- `RELEASE_FILE` in `plugins/openspec/hooks/deliver-check.mjs:1124` keeps its content. `plugins/openspec/hooks/release-merge.mjs:165` (`classifyConflict`) imports it and lets every path in it pass a merge conflict, and `docs/openspec-flow.md` documents that any conflict in the doc beyond the pin still blocks. The sibling `stale-only-on-own-files` reuses the list unchanged. The new rule is a separate check used by `unnamedFiles` (`deliver-check.mjs:1128`), which the archive check calls at `deliver-check.mjs:1441` and the readout at `deliver-check.mjs:2202`.
- A pin line is as `plugins/openspec/hooks/release-merge.mjs` defines it (`pinsIn`, `setPins`, `PIN_MARKER`, `PIN_TOKEN`): a line holding one of the markers `pinned to the commit of v`, `<commit sha of v`, `git/ref/tags/v` or the prose form, and a pin is each `vX.Y.Z` on it. `docs/openspec-flow.md` passes when its text at the archive branch, with every pin masked, equals its text at the merge base with every pin masked.
- Grill answer A2, given by the coordinating roadmap session under the owner's delegation after the planner found that the first test-file rule rejected a real bump (commit c561553 moved the `assert.match` current-pin line too): the lines of `plugins/openspec/hooks/change-loop.test.mjs` a devkit-openspec bump moves are exactly (1) `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` and `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, '<message>');`, with any message, and (2) the comment line that starts `// Invariant: the CI snippet pins the current release`. The file passes when its added and removed lines against the merge base are only lines of those two forms; one other added or removed line makes it unnamed again.
- The pin definition (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) moves into `plugins/openspec/hooks/deliver-check.mjs`, and `release-merge.mjs` imports and re-exports it, so its behaviour and its importers stay the same. `deliver-check.mjs` never imports `release-merge.mjs`: that would break the consumer CI, which downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` (`docs/openspec-flow.md` CI snippet, `merge-setup.test.mjs:185`), and would make an import cycle because `release-merge.mjs` already imports `RELEASE_FILE` from `deliver-check.mjs`.
- The real diff of commit c561553 (the archive of `review-writer-prompt` that prompted the request) is a test fixture: its changes to `docs/openspec-flow.md` and `change-loop.test.mjs` both pass the new rule.
- The rule needs the content of each file at the merge base and at the archive branch (committed or in the tree), not only the path; `archiveChanges` (`deliver-check.mjs:1109`) is where those two texts are read. A file absent on one side, or unreadable, is unnamed (never a pass).
- The same `unnamedFiles` result feeds the readout, the `apply-proposals` stop and the CI `devkit-reviews --ci` archive check, so no second place is changed.
- No requirement that the same diff bumps devkit-openspec: a pin-only change passes by itself (the existing test `release-merge-conflict 16` already fails a pin that differs from the manifest).
- Both roadmap lines, `archive-release-pin` and `release-pin-is-a-release-file`, are ticked in `openspec/roadmap.md` at archive.
- This change ships as a devkit-openspec release (a bump of `plugins/openspec/.claude-plugin/plugin.json`, its CHANGELOG entry and the CI pin lines); the next number is taken from `origin/main` right before each push.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
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

## Out of scope

- Adding `docs/openspec-flow.md` or `change-loop.test.mjs` to `RELEASE_FILE`, or changing what `release-merge.mjs` resolves in a conflict.
- Changing which pin lines exist or how `pinsIn` and `setPins` read them.
- Accepting any other file for a release (the manifests, `CHANGELOG.md` and the catalog stay as they are).
- `stale-only-on-own-files`, which reuses `RELEASE_FILE` for the staleness rule and is a separate change.
- Making the archive check demand a devkit-openspec bump in the same diff.
- Possible later roadmap line, not built here: the test reads the current pin from the manifest (`plugins/openspec/.claude-plugin/plugin.json`) instead of a literal `assert.match(flow, /v<X>\.<Y>\.<Z>/, …)` line, so a bump needs no edit of `change-loop.test.mjs` at all and the second half of the rule becomes unnecessary.
