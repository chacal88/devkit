Verdict: approved
Commit: 7492d49d748b5d124b792a98a889e599df61702e

## Quality review — gh-version-check (round 2)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:1048-1061 — Archive-PR path doubles the 'cannot read the checks:' prefix, which now shows on the old-gh message.
- [nit] plugins/openspec/hooks/deliver-check.mjs:946-949 — Archive facts flatten ghTooOld into an error string, so there is no typed gh-too-old reason on that path; the text still names the versions. The new test 20 now pins the text.
- [praise] plugins/openspec/hooks/merge-setup.mjs:53-80 — Single owner for the gh version helpers, reused by every consumer; numeric comparison; distinct missing, failing and unparseable answers.
- [praise] openspec/changes/gh-version-check/proof/gh-min-version.txt — The 2.50.0 minimum is backed by release notes and source at both tags.
- [praise] plugins/openspec/hooks/deliver-check.mjs:660-675 — The old-gh check runs only after a failed JSON parse and an exact stderr match, never calls gh --version on success, and excludes missing, timed-out and overflowed runs.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:4099-4106 — Test gh-version 20 closes the archive-facts gap with the existing OLD_FLAG, versionsOf and pm helpers, asserting the three message parts and exactly one --version call.

### Summary
- 6 findings (0 blocking, 0 important, 2 nit) + 4 praise
- Justification: The only commit in range 4fadc2a..7492d49 adds test gh-version 20 and no product code. I read the test, the helpers it uses (OLD_FLAG, versionsOf, pm) and the collector at deliver-check.mjs:946-949 it exercises, then ran the test on its own with TMPDIR=/var/tmp: 1 pass, 0 fail. It closes the test-coverage reviewer's round-1 important finding. My round-1 verdict (approved, two nits) is unchanged. The full suites were not re-run; the earlier results in evidence.md at 4fadc2a still hold because no product code changed since.
