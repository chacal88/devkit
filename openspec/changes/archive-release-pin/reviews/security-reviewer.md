Verdict: approved
Commit: b906df57ecf925bffc6075204d054a14e70a4359

## Security audit — archive-release-pin (round 4, review of the ADR 0030 amendment)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:1321-1335 (archiveChanges) — Previous nit, unchanged: the 'after' text of the pin file is read from the working tree while the path list also includes committed changes, so a local archive stop can judge uncommitted text that differs from HEAD. Not exploitable, because the required CI check runs on a clean checkout.

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (PIN_LINE_FILES, pinLinesOnly, unnamedFiles, archiveChanges); medium: the three test files, docs/openspec-flow.md (P13 row and file check paragraph), ADR 0003/0027/0030, the spec delta; low: CHANGELOG, config.yaml ADR line, deleted c561553 test fixtures.

Amendment under review: it only removes an unreviewed-merge path. `PIN_LINE_FILES` goes from two paths to `['docs/openspec-flow.md']`. `PIN_TEST_LINES` and the test-file branch of `pinLinesOnly` are deleted. `pinLinesOnly` now returns false for any other path and for any non-string text. The doc rule is unchanged (`setPins(before,'0.0.0') === setPins(after,'0.0.0')`). `archiveChanges` reads texts only for `PIN_LINE_FILES`, so no new file read and no new path input exist. `unnamedFiles` and `RELEASE_FILE` are untouched. A test file edit in an archive now needs an owner-approved named proposal, in the local archive stop and in `devkit-reviews --ci` alike (tests 7 and 8 cover both).

Pin test: `change-loop docs: the design records the answers` reads the version from `plugins/openspec/.claude-plugin/plugin.json` and asserts `pinMismatches(flow, version)` is empty. This keeps CI pins bound to the manifest. The removed literal and doesNotMatch lines add no security control, since a stale pin differs from the manifest and fails the same assertion. Test 12 holds the test against reintroducing version literals.

Docs and records: the P13 row, the file-check paragraph, the ADR 0003 Note, the ADR 0027 Note, ADR 0030 and the spec delta agree that one file passes by content. The CHANGELOG and config ADR line match. `release-merge.mjs` still re-exports the pin definition from `deliver-check.mjs`, which never imports it, so the consumer CI keeps downloading three files. Test 10 now asserts `PIN_LINE_FILES` equals `[R.PIN_FILE]` exactly.

Filtered run: `--test-name-pattern=archive-release-pin` on deliver-check-archive.test.mjs and release-merge.test.mjs, TMPDIR=/var/tmp/devkit-archive-release-pin, foreground: 12 tests, 12 pass, 0 fail.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives: authz via the narrowed rule leaving a gap (it only tightens, and the doc rule is byte-for-byte as before); injection or path traversal through `PIN_LINE_FILES` (a constant list, and paths come from git output matched by equality, never joined from request input); deleted c561553 fixtures leaving a dangling reference (grep finds none in plugins); exposure, crypto, secret and config (the diff touches no credentials, tokens or defaults, and an unreadable file counts as unnamed, never as a pass); a pin moved to another vX.Y.Z in the flow doc (documentation only, accepted by ADR 0027 and kept by ADR 0030).

Out of round: none found.
