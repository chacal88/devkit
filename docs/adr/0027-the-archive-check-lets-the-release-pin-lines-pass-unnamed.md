# ADR 0027: The archive check lets the release pin lines pass unnamed, not the files that hold them

- Status: accepted
- Accepted by: the owner, on 2026-11-23, in the approval of the plan of change archive-release-pin (openspec/changes/archive-release-pin/approval.md)
- Date: 2026-11-23
- Change: archive-release-pin
- Amends: ADR 0003 (0003-auto-merge-the-archive-pr.md), the exemption list in its Decision (the files an archive PR may change without an owner-approved retro proposal naming them)
- Builds on: ADR 0002 (0002-merge-without-the-owner-opt-in.md), ADR 0012 (0012-the-reviews-check-follows-the-change-script.md), ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md), ADR 0019 (0019-the-delivery-loop-tags-the-release-it-merged.md); changes none of them
- Amended by ADR 0030 (0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)

## Context

Note (archive-release-pin, 2026-11-24): ADR 0030 amends Decision 1 and Decision 2 for `plugins/openspec/hooks/change-loop-compozy.test.mjs`: the test that held the pin block reads the version from the manifest, no release edits the file, and only `docs/openspec-flow.md` passes the archive check by its content. The rest of the Decision is unchanged.

ADR 0003 lets GitHub auto-merge an archive PR with no code review, under one file rule: every
changed file must be named by a retro proposal the owner approved, except `openspec/changes/**`,
`openspec/roadmap.md`, the version manifests, CHANGELOG and the generated catalog. The rule lives
in `unnamedFiles` of `plugins/openspec/hooks/deliver-check.mjs`, with the release files in the
regular expression `RELEASE_FILE`; the local archive check, the readout and `devkit-reviews --ci`
all read that one result.

A retro proposal that bumps devkit-openspec also moves the CI pin lines of `docs/openspec-flow.md`
(the lines `release-merge.mjs` finds through `pinsIn`) and edits the pin assertions of
`plugins/openspec/hooks/change-loop.test.mjs` (the file of that time; suite-speed, ADR 0026, split it and
the pin block now lives in `change-loop-compozy.test.mjs`, the file this rule names): commit c561553, the
archive of review-writer-prompt
that prompted this change, moved the `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` line that
checks the current pin, with its message, and added an `assert.doesNotMatch` line for the previous
release. Neither file is in the exemption list, so the proposal had to name both, and the archive
stopped after the owner's approval until it did. The roadmap found the same gap a second time
(`release-pin-is-a-release-file`).

The grill of this change (answer A, 2026-11-23, given by the coordinating roadmap session under the
owner's delegation) chose to exempt the pin lines only. Exempting both files whole, as CHANGELOG
is, was refused: it would let a whole document and a test file merge with no review and no
approval. A first test-file rule accepted only `assert.doesNotMatch` lines with one fixed message;
the planner showed that it fails the real bump of c561553, so answer A2 (same delegation) widened it
to the exact line forms a bump moves, listed below.

## Decision

1. The archive check of ADR 0003 also accepts, without a named proposal:
   - `docs/openspec-flow.md` when its text at the archive branch, with every pin masked, equals its
     text at the merge base with every pin masked. A pin line and a pin are as the one pin
     definition (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) defines them; see point 6.
   - `plugins/openspec/hooks/change-loop-compozy.test.mjs` when its added and removed lines against the
     merge base are only lines of these forms:
     - `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` and
       `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, '<message>');`, with any message, the subject
       being `flow` and the regular expression a plain version;
     - the comment line that starts `// Invariant: the CI snippet pins the current release`.
2. Any other change to either file (in the test file, one other added or removed line: another
   assertion, an assertion on another subject, a regular expression that is not a plain version,
   another comment, a changed unrelated test), a file missing on one side, or a file that cannot be
   read leaves the path unnamed, so the archive stops on `apply-proposals` as before.
3. The rule is content-based and separate from `RELEASE_FILE`, which keeps its content: the release
   list that `release-merge.mjs` (`classifyConflict`) resolves in a merge conflict, and that the
   staleness rule reuses, does not grow.
4. The rule sits in `unnamedFiles`, so the local archive check, the readout and the CI check
   `devkit-reviews --ci` apply it from one place.
5. The rest of ADR 0003 is unchanged: the owner's answer to each proposal remains the gate, and
   every other exempt path stays as listed.
6. The pin definition (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) moves from
   `plugins/openspec/hooks/release-merge.mjs` into `plugins/openspec/hooks/deliver-check.mjs`;
   `release-merge.mjs` imports it from there and re-exports it, so its behaviour and its importers
   stay the same. `deliver-check.mjs` never imports `release-merge.mjs`: the consumer CI downloads
   only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`, and `release-merge.mjs` already
   imports `RELEASE_FILE` from `deliver-check.mjs`, so the import would also make a cycle.

## Consequences

- Positive: a retro proposal that bumps devkit-openspec names only the files it really changes;
  the archive no longer stops after the owner's approval for a mechanical pin move.
- Positive: what merges without review grows by lines whose content the check verifies, never by a
  whole file; a sentence, a paragraph or another assertion still needs a named proposal.
- Negative: the archive check now reads file content at two commits, not only paths, so it does
  more git work and has a new way to fail (Mitigated: a file it cannot read is unnamed, never a
  pass).
- Negative: the exemption holds two rules (a path list and a content rule), and the content rule
  and the conflict resolution of `release-merge.mjs` must agree on what a pin is (Mitigated: both
  read the one pin definition, which lives in `deliver-check.mjs` and which `release-merge.mjs`
  imports and re-exports; nothing is copied, and the consumer CI, which downloads `deliver-check.mjs`
  but not `release-merge.mjs`, keeps working).
- Negative: the pin definition moves file, so `deliver-check.mjs` grows and a reader of
  `release-merge.mjs` finds the definition one import away (Accepted: the re-export keeps every
  importer of `release-merge.mjs` unchanged).
- Negative: a bump still edits `change-loop-compozy.test.mjs`, so the test-file half of the rule exists only
  because the test spells the current pin literally (Accepted for now; see the manifest-read
  alternative).
- Negative: a pin-only change passes even when the same diff does not bump devkit-openspec
  (Accepted: the existing test `release-merge-conflict 15` checks the `pinMismatches` rule, and the
  `pinMismatches` assertion of the test `change-loop docs: the design records the answers` already
  fails a pin that differs from the manifest).

### Review trigger

A pin-only edit is found to carry an unapproved change, the pin markers change shape, a bump moves
a line of `change-loop-compozy.test.mjs` outside the forms of Decision 1, the test is changed to read the
current pin from the manifest, or another release produces a mechanical edit to a file outside the
exemption.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Add both files whole to `RELEASE_FILE`, as CHANGELOG is | One line; no content read | A whole doc and a test file merge unreviewed and unapproved; `release-merge.mjs` would also resolve any conflict in them; refused in the grill | medium |
| Keep naming both files in every bumping proposal | Nothing new | The archive stops after the owner's approval for a mechanical edit, found twice | low |
| Accept the pin lines only when the same diff bumps devkit-openspec | Ties the exemption to a release | More reading for no gain, since the pin-versus-manifest test already fails a mismatched pin | low |
| Accept in the test file only `assert.doesNotMatch` lines with the message `'no pin left on the previous release'` | Narrowest rule | Fails the real bump of c561553, which moves the `assert.match` current-pin line and its message; replaced by answer A2 | low |
| `deliver-check.mjs` imports the pin definition from `release-merge.mjs` | No code moves | The consumer CI downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`, so the import fails there; it also makes an import cycle | low |
| The test reads the current pin from the manifest (`plugins/openspec/.claude-plugin/plugin.json`) instead of a literal `assert.match` line | A bump no longer edits `change-loop.test.mjs`, so the test-file half of the rule becomes unnecessary | A product change to the test outside this change; not chosen here, kept as a possible later roadmap line | low |
