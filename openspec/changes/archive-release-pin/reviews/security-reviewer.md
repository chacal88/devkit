Verdict: approved
Commit: ec2730f3c7bf8211fcaade34636b61516bc544ac

## Security audit — archive-release-pin (round 1)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:archiveChanges — The 'after' text of a pin file is read from the working tree, while the changed-path list also includes the committed diff. A local archive stop can therefore judge uncommitted text that differs from HEAD. It is not exploitable: the required CI check `devkit-reviews --ci` runs on a clean checkout, where the working tree equals HEAD.

Triaged scope: high: `plugins/openspec/hooks/deliver-check.mjs` (new content-based exemption inside `unnamedFiles`, the check that gates auto-merge of the archive PR with no code review); `plugins/openspec/hooks/release-merge.mjs` (pin definition moved out). Medium: `docs/openspec-flow.md`, `docs/adr/0003-auto-merge-the-archive-pr.md` and ADR 0027 (the rule as documented), and the fixtures and tests. Low: the version bumps, CHANGELOG, proof and evidence files.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

What I inspected:
- Both halves of the exemption rule, `setPins` masking for the flow page and `PIN_TEST_LINES` filtering for the test file.
- Every fail-closed path: a missing or unreadable file on either side, a changed final newline, a CRLF line, and an undefined `texts[path]`. I probed these directly with a small script against the real module.
- Import separation: `deliver-check.mjs` does not import `release-merge.mjs`, so the three files downloaded by the consumer CI still work. A test holds this.
- The re-export from `release-merge.mjs`, which keeps its importers unchanged.
- The `texts` threading into the local archive stop and into `archivePrCheck` (`--ci`), so both apply the same rule.
- Conflict resolution: `RELEASE_FILE` is unchanged, so neither pin file becomes a release file.

Discarded false positives:
- Injection: the assertion-line regex `assert.(match|doesNotMatch)(flow, /vX.Y.Z/, '<msg>');` is anchored with `$`, and the message group `(?:[^'\\]|\\.)*` cannot break out of the string. My probe with `'x'); process.exit(0); ('y');` returned false.
- Injection: the `// Invariant:` prefix match has no `$`, but it is a `//` comment, so nothing after it is code. A trailing continuation line is not a kept line, so the check still fails.
- Authz: a pin moved to another `vX.Y.Z` on a pin line passes unnamed, and could in principle lower the pin the docs recommend. It changes documentation only. The repo's own workflow runs the local file, not the pinned download. The ADR accepts it explicitly (the 'pin-only change passes even when the same diff does not bump' negative), and other text on a pin line is not masked, so a changed URL or an added command fails.
- Authz: an assertion line inserted between a brace-less `if (x)` and its statement would pass the test-file rule and change test control flow. It needs an existing brace-less guard at that exact spot. The effect stays inside a test file, the `check` and `devkit-reviews` gates still run on the PR, and the rule checks lines, not semantics. No concrete trigger exists in the file, so it is not exploitable.
- Authz: a symlink at a pin path makes `readFileSync` follow it. The text is only compared and never echoed, and a link whose target differs from the base text fails the comparison.
- Weak crypto, hardcoded secret, data exposure and config: nothing in the diff touches credentials, tokens, secrets or defaults, and a file the check cannot read is treated as unnamed, never as a pass.

Out of round: none found.
