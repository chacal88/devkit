<!-- devkit-stage decisions result=passed attempt=3 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
# Decisions and ADRs

- ADR: `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` — The archive check lets the release pin lines pass unnamed, not the files that hold them
- ADR: `docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md` — The pin test reads the manifest, so only the flow page's pins pass the archive check unnamed

Why a record, not a note: the change alters the exemption list in ADR 0003's Decision, which governs what merges unreviewed, and moves the pin definition into `deliver-check.mjs`, the file the consumer CI downloads. A note on an accepted record may only say the Decision is unchanged, so an amendment needs a new record. Once the owner approves the plan, the implementation adds an `Amended by ADR 0027` line to ADR 0003's header and a Note line in its Context, in the form ADR 0018 used.

Revision (attempt 2): the record follows grill answer A2, so the test-file rule accepts the `assert.match` and `assert.doesNotMatch` pin lines with any message and the `// Invariant: the CI snippet pins the current release` comment line, and the pin definition lives in `deliver-check.mjs`, re-exported by `release-merge.mjs`.

Revision (attempt 3, plan amendment of 2026-11-24): ADR 0027 is accepted, so its narrowing is a new record, ADR 0030, which amends ADR 0027 and ADR 0003. Decided: the test `change-loop docs: the design records the answers` derives the pin from `plugins/openspec/.claude-plugin/plugin.json` only (its literal `assert.match`, the `// Invariant:` comment and every `assert.doesNotMatch` history line go; `pinMismatches` and the `v0.20.0` floor stay); the doc half of the rule stays as ADR 0027 says; the test-file half (`PIN_LINE_FILES`' second path, `PIN_TEST_LINES`, the two line forms) is removed; the c561553 fixtures of the test file and the test-file-specific tests go away. The reason is the delivery train: `release-merge.mjs` cannot resolve that test's pin block, so a train carried only one releasing change.

Numbering: ADR 0027 was drafted as 0023 and renamed at the merge of `main`. ADR 0030 takes the next number above 0028 and 0029, which other changes hold (0029 on a branch of this clone, 0028 by the coordinator's count). Both numbers are re-checked against `origin/main` and the open branches right before the push.
