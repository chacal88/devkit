Verdict: approved
Commit: e0c946ad9e3e83cbaa94f41ee4da75a5bbba172f

## Security audit — archive-release-pin (round 3, re-review after base merges and release renumber)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:archiveChanges — The 'after' text of a pin file is read from the working tree while the path list also includes committed changes, so a local archive stop can judge uncommitted text that differs from HEAD; not exploitable because the required CI check runs on a clean checkout.

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (pin exemption: archiveChanges, pinLinesOnly, setPins, PIN_TEST_LINES, unnamedFiles) and release-merge.mjs (re-export); medium: docs/openspec-flow.md, ADR 0027, ADR 0003 Note, the spec delta; low: evidence, reviews, proof, version bumps.

Re-review scope: since ec2730f the pin code did not change (no hunk in archiveChanges or the pin definition block; release-merge.mjs has no diff). The deliver-check.mjs hunks in the range come from main's PR #97 (own-files rule), outside this change's remit. That rule reads ownFiles/staleness for reviews and evidence only, excludes RELEASE_FILE paths, does not make either pin file a release file, and fails safe to the strict rule without origin/<base>. The change-owned edits are the spec delta's file name (change-loop-compozy.test.mjs, matching PIN_LINE_FILES), the pin block moved to 0.40.0 in the test and the flow page, and the evidence and review records.

Filtered run: node --test --test-name-pattern=archive-release-pin on deliver-check-archive.test.mjs and release-merge.test.mjs with TMPDIR=/var/tmp/devkit-archive-release-pin: 11 tests, 11 pass, 0 fail.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives (unchanged, code unchanged): injection via the assertion-line regex (anchored with $, message group cannot break out) and via the // Invariant: prefix (a comment); authz via a pin moved to another vX.Y.Z (documentation only, accepted by ADR 0027, other text on a pin line is not masked); authz via a line inserted after a brace-less if (no concrete trigger, stays in a test file); authz via a symlink at a pin path (only compared, never echoed); crypto, secret, exposure and config (the diff touches no credentials, tokens or defaults; an unreadable file counts as unnamed, never as a pass).

Out of round: none found.
