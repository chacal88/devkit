# ADR 0030: The pin test reads the manifest, so only the flow page's pins pass the archive check unnamed

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change archive-release-pin (openspec/changes/archive-release-pin/approval.md)
- Date: 2026-11-24
- Change: archive-release-pin
- Amends: ADR 0027 (0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md), the test-file half of its Decision 1, its Decision 2 for that file, and the alternative "The test reads the current pin from the manifest", which it had left for later; ADR 0003 (0003-auto-merge-the-archive-pr.md), the exemption list of its Decision as ADR 0027 amended it
- Builds on: ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md); changes nothing in it

## Context

ADR 0027 lets two files pass the archive check without a named retro proposal: `docs/openspec-flow.md`
when only its CI pins moved, and `plugins/openspec/hooks/change-loop-compozy.test.mjs` when only its pin
assertion lines changed. That second file has to change on every release only because the test
`change-loop docs: the design records the answers` spells the current pin as a literal
(`assert.match(flow, /v<X>\.<Y>\.<Z>/, ...)`), keeps one `assert.doesNotMatch` line per earlier release
with the name of the change that took it, and keeps an `// Invariant:` comment listing that history.
The same test already asserts `pinMismatches(flow, version)` is empty, `version` being read from
`plugins/openspec/.claude-plugin/plugin.json`, so every CI pin already has to follow the manifest.

The delivery train (ADR 0022) joins the heads of its changes with `release-merge.mjs`, which resolves
the release files and the pin lines of `docs/openspec-flow.md` but has no rule for the test file. So
two changes that both release conflict in that pin block, and a train can carry only one change with
a release. The owner's coordinator asked, on 2026-11-24, while PR 107 of this change was on the train,
to remove the cause.

## Decision

1. The test `change-loop docs: the design records the answers` in
   `plugins/openspec/hooks/change-loop-compozy.test.mjs` derives the expected pin from the manifest
   only. Its literal `assert.match(flow, /v<X>\.<Y>\.<Z>/, ...)` line, the `// Invariant: the CI snippet
   pins the current release` comment and every `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, ...)` history
   line (with the change names in their messages) go. The `pinMismatches(flow, version)` assertion
   stays and is what pins the CI snippet to the release. The `v0.20.0` slice-merge-floor assertions
   stay: they hold a fixed floor, not a release pin. No release edits that file any more.
2. The archive check of ADR 0003 accepts unnamed, by content, only `docs/openspec-flow.md` when its
   text at the archive branch with every pin masked equals its text at the merge base masked the same
   way, as ADR 0027 Decision 1 states for it. The test-file half of the rule is removed: its path in
   `PIN_LINE_FILES`, `PIN_TEST_LINES` and the two line forms. A change to
   `change-loop-compozy.test.mjs` in an archive needs a named, owner-approved proposal again, as any
   other test file does.
3. Everything else in ADR 0027 stands: the masked-pin rule for the doc, a missing or unreadable file
   left unnamed, `RELEASE_FILE` unchanged, the rule in `unnamedFiles`, and the pin definition living in
   `deliver-check.mjs` and re-exported by `release-merge.mjs`.

## Consequences

- Positive: a release edits no test file, so the train can join several changes that release, with
  `release-merge.mjs` resolving all they touch.
- Positive: what merges without review under ADR 0003 shrinks to the doc's CI pin lines; no test line
  passes unnamed.
- Positive: the test no longer carries a growing history of change names.
- Negative: the test no longer refuses a stale pin by its number (Mitigated: `pinMismatches` fails any
  pin that differs from the manifest, which covers a stale one).
- Negative: the plan and the delivered code of this change are reworked after approval: the test-file
  rule, its fixtures from c561553 and its tests are removed (Accepted: the rule had not merged).

### Review trigger

The pin assertion again needs a literal release, a release again edits a file `release-merge.mjs`
cannot resolve, or the pin markers change shape.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep ADR 0027's test-file rule and the literal pin lines | No rework | Every release still edits the test, so the train carries one releasing change at a time | low |
| Teach `release-merge.mjs` to resolve the test's pin block in a conflict | The train joins releasing changes | Grows the conflict rule to a test file and keeps a hand-kept history; refused by ADR 0027 point 3 for the release list | medium |
| Derive the pin from the manifest but keep the test-file rule | No exemption code removed | Exempts lines no release writes; wider than needed | low |
