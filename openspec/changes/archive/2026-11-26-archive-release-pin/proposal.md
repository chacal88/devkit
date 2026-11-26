<!-- devkit-stage proposal result=passed attempt=2 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
# Proposal

Change: `archive-release-pin` · Date: 2026-11-23, amended 2026-11-24 · Owner: Kaue (chacal88) ·
Base: `d2010ca` (amendment at `34e3500`) · PRD / tech spec: n/a · Requirements:
[requirements.md](requirements.md) · Decisions: [decisions.md](decisions.md),
[ADR 0027](../../../../docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md),
[ADR 0030](../../../../docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)

## Why

A retro proposal that bumps devkit-openspec also moves the CI pin lines of `docs/openspec-flow.md`
and, until this change, the pin assertions of the loop's test (now
`plugins/openspec/hooks/change-loop-compozy.test.mjs`). The archive's file check (`unnamedFiles` in
`plugins/openspec/hooks/deliver-check.mjs`) exempts only paths, so both files had to be named in the
proposal. The archive of review-writer-prompt (commit c561553) stopped on `apply-proposals` after the
owner had approved, and the roadmap found the same gap a second time (`release-pin-is-a-release-file`).

Amendment (2026-11-24, grill answer A3, ADR 0030): the delivery train joins its heads with
`release-merge.mjs`, which has no rule for the test's pin block, so two releasing changes conflict
there and a train carries one release. The test now reads the pin from the manifest, no release
edits it, and the test-file half of the archive rule is removed.

## What Changes

- The archive's file check also leaves out, with no named proposal, `docs/openspec-flow.md` when its
  text at the archive branch, with every CI pin masked, equals its text at the merge base with every
  pin masked. Any other edit, or the file missing or unreadable on either side, keeps the path
  unnamed. The doc does not join `RELEASE_FILE`, so the release list that `release-merge.mjs`
  resolves in a merge conflict does not grow.
- The rule sits in `unnamedFiles`, so the local archive stop, the readout and `devkit-reviews --ci`
  apply it from one place.
- The pin definition (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) moves from
  `plugins/openspec/hooks/release-merge.mjs` into `deliver-check.mjs`; `release-merge.mjs` imports
  and re-exports it. `deliver-check.mjs` never imports `release-merge.mjs`.
- Amendment (ADR 0030): the test `change-loop docs: the design records the answers` in
  `plugins/openspec/hooks/change-loop-compozy.test.mjs` pins the CI snippet only through
  `pinMismatches(flow, version)`, `version` read from `plugins/openspec/.claude-plugin/plugin.json`.
  Its literal `assert.match(flow, /v<X>\.<Y>\.<Z>/, ...)` line, its `// Invariant:` comment and every
  `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, ...)` history line are deleted; the `v0.20.0`
  slice-merge floor assertions stay. A release no longer edits that file, so it is a test file like
  any other in an archive: any change to it needs a named proposal. The delivered test-file half of
  the rule (`PIN_LINE_FILES`' second path, `PIN_TEST_LINES`, the test-file branch of `pinLinesOnly`)
  and the two c561553 fixtures of the test file are removed.
- Docs: the archive-check paragraphs of `docs/openspec-flow.md` (one pin file), the header lines and
  Note of ADR 0003, a header line and a dated Note in ADR 0027, and the ADRs line of
  `openspec/config.yaml` (0030 added, 0027 marked amended by 0030).
- Release: devkit-openspec 0.40.0 and the marketplace 0.44.0 as on the branch today (re-taken from
  `origin/main` by the flow's release step), its CHANGELOG entry (amended for ADR 0030) and the CI pin
  lines of the doc.
- Non-goals: everything under "Out of scope" in requirements.md. That includes changing which pin
  lines exist, the staleness rule (`stale-only-on-own-files`), requiring a bump in the same diff, and
  teaching `release-merge.mjs` to resolve a test file.

## Acceptance criteria

<!-- Copied from requirements.md, with their ids. -->
- AC-1: an archive whose only change to `docs/openspec-flow.md` is the CI pins moved to a new version (and no approved proposal names the file) has that path absent from `unnamedFiles`, so `deliver-check` raises no `apply-proposals` stop for it.
- AC-2: an archive that changes `docs/openspec-flow.md` beyond its pin lines (a changed sentence, an added paragraph, a pin marker line with other words changed) still has that path in `unnamedFiles` and still stops with `files no approved proposal names: docs/openspec-flow.md`, unless an approved proposal names it.
- AC-3: an archive that changes `plugins/openspec/hooks/change-loop-compozy.test.mjs` in any way, an edit of only `assert.match(flow, /v<X>\.<Y>\.<Z>/, ...)`, `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, ...)` or `// Invariant: the CI snippet pins the current release` lines included, has that path in `unnamedFiles` unless an approved proposal names it: the file is a test file like any other (A3, ADR 0030).
- AC-4: the test `change-loop docs: the design records the answers` in `plugins/openspec/hooks/change-loop-compozy.test.mjs` reads the expected pin from `plugins/openspec/.claude-plugin/plugin.json` (`pinMismatches(flow, version)` is empty) and holds no release version literal (`v<X>.<Y>.<Z>`) and no change name outside its `v0.20.0` slice-merge floor assertions, so a devkit-openspec release does not edit that file; the test passes on this branch.
- AC-10: the real diff of commit c561553 for `docs/openspec-flow.md` is kept as a fixture and passes the rule; c561553's file list, with no proposal naming the doc, leaves the doc out of `unnamedFiles` (its test file of that time is named, as any test file is). The c561553 fixtures of the test file are deleted.
- AC-5: a file that is missing on either side, or that cannot be read, stays in `unnamedFiles`.
- AC-6: `RELEASE_FILE.source` is unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` is false, and the conflict classification of `release-merge.mjs` is unchanged (a conflict in the doc beyond the pin still blocks); the test `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` changes only in its `unnamedFiles` half, which now splits pin-only from other edits.
- AC-7: the CI check `devkit-reviews --ci` on an archive PR applies the same rule, shown by a test through the shared function, not a second copy.
- AC-8: `docs/openspec-flow.md` (the archive-check paragraphs that list the exempt files), ADR 0003's exemption list and ADR 0027's header state the one-file rule (ADR 0027 as amended by ADR 0030, records the `adr-author` drafted), and the ADRs line of `openspec/config.yaml` names ADR 0030; `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.
- AC-9: the real-run proof covers each case the plan declares: a pin-only doc change passes; a doc change beyond the pin does not; a pin-assertion-only edit of `change-loop-compozy.test.mjs` does not (it is named); a deleted doc does not; the consumer CI run from the three downloaded files passes a pin-only doc archive; run against a real archive branch, not only unit tests; and, on this branch, the pin test passes with no release version literal in it.

| AC | Where it is delivered |
|---|---|
| AC-1, AC-2, AC-5, AC-7 | phase 1 (delivered); re-proved by phase 4 tests 1, 2, 5, 7 to 9 and `proof/real-run-amended.txt` |
| AC-3 | phase 4: tests 3, 4, 6 to 8 flipped, code of task 4.2 |
| AC-4 | phase 4: guard test 12, pin block rewrite of task 4.3 |
| AC-6 | phase 1 (delivered); test 10 flipped in phase 4 |
| AC-8 | phase 2 (delivered); test 11 flipped and task 4.4 |
| AC-9 | task 4.5 (`proof/real-run.txt` of phase 3 stays as history) |
| AC-10 | phase 1 (delivered); tests 1 and 6 in phase 4, fixtures deleted in task 4.2 |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reviews-check`: the archive pull request's file check gains the pin-line rule for
  `docs/openspec-flow.md`, and names any change to the loop's pin test like any other test file. It
  is stated once for the local archive stop and for `devkit-reviews --ci`, because both read one
  result.

## Impact

- `plugins/openspec/hooks/deliver-check.mjs`: the pin definition, the content rule for the doc, the
  content read in `archiveChanges`, and `unnamedFiles` with its two callers; the amendment removes
  the test-file half. The consumer CI downloads this file and still needs only `guard.mjs`,
  `deliver-check.mjs` and `merge-setup.mjs`.
- `plugins/openspec/hooks/release-merge.mjs`: imports and re-exports the pin definition; no
  behaviour change.
- Tests: `deliver-check-archive.test.mjs` (tests `archive-release-pin 1` to `9`, `11`, new `12`),
  `release-merge.test.mjs` (test 10), `change-loop-compozy.test.mjs` (the pin block of `change-loop
  docs: the design records the answers` reads only the manifest); fixtures under
  `plugins/openspec/hooks/fixtures/c561553/` (the two `change-loop.test.*.txt` files deleted).
- Docs: `docs/openspec-flow.md`, `docs/adr/0003-auto-merge-the-archive-pr.md` and
  `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` (header lines and
  Notes only), `openspec/config.yaml` (ADRs line).
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, the doc's CI pin lines; `docs/catalog.md` is checked, not regenerated. Every later
  release edits no test file, so the delivery train can join several releasing changes.
- Dependencies: ADR 0027 (accepted); ADR 0030 (proposed), accepted by the loop's `accept-decisions`
  step after the owner approves this amended plan. Both numbers are checked against `origin/main`
  before each push. Open decisions inherited: none.
- Exit criteria: the phase gates of tasks.md (phase 4's is filtered runs only),
  `openspec validate archive-release-pin --strict`, and the whole suite run by the delivery train,
  not locally.
