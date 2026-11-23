Verdict: approved
Commit: 4fadc2a97437f4af8bdffab9070a42aa3eefaa52

## Quality review — gh-version-check (round 1)

### Findings
- [praise] plugins/openspec/hooks/merge-setup.mjs:53-80 — Single owner for the gh version helpers, reused by every consumer; numeric comparison; distinct missing, failing and unparseable answers.
- [praise] openspec/changes/gh-version-check/proof/gh-min-version.txt — The 2.50.0 minimum is backed by release notes and source at both tags.
- [praise] plugins/openspec/hooks/deliver-check.mjs:660-675 — The old-gh check runs only after a failed JSON parse and an exact stderr match, never calls gh --version on success, and excludes missing, timed-out and overflowed runs.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1048-1061 — Archive-PR path doubles the 'cannot read the checks:' prefix, which now shows on the old-gh message.
- [nit] plugins/openspec/hooks/deliver-check.mjs:946-949 — Archive facts flatten ghTooOld into an error string, so there is no typed gh-too-old reason on that path; the text still names the versions.

### Summary
- 5 findings (0 blocking, 0 important, 2 nit) + 3 praise
- Justification: I read the full code diff (merge-setup, deliver-check, flow-check, change-loop, project-loop, gh-version.mjs, the SKILL.md and docs edits) and the proof file. Reality matches the proposal. En and pt-BR strings exist for every new reason. The version bumps (plugin 0.22.0, marketplace 0.26.0, CHANGELOG) are consistent. Each acceptance criterion AC-1 to AC-7 in evidence.md names its tests and real local output.
- Limit: I could not reproduce the test suites here. The combined run hit my 600 s timeout and the smaller merge-setup plus gh-version run hit 170 s on this slow machine. scripts/check.py and gen-catalog.py --check passed in the combined command (check.py printed 'all checks passed'). The test results are taken from evidence.md at commit 4fadc2a.
