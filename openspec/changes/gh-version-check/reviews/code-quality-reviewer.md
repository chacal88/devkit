Verdict: approved
Commit: 492b58633030aa9bb39198b03161304b67082701

## Quality review — gh-version-check, merge of main and release renumbering (round 1 of 2)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:1048-1061 — Round-2 nit stands: the archive-PR path doubles the 'cannot read the checks:' prefix, which now shows on the old-gh message. This diff did not touch it.
- [nit] plugins/openspec/hooks/deliver-check.mjs:946-949 — Round-2 nit stands: archive facts flatten ghTooOld into an error string, so that path has no typed gh-too-old reason. The text still names both versions, and test gh-version 20 pins it.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2520-2523 — The pin test keeps both sides of the conflict. It asserts v0.23.0 is present and refuses v0.22.0, v0.21.2, v0.21.1 and v0.21.0, so any missed pin fails closed.
- [praise] CHANGELOG.md:3-12 — 0.27.0 sits above main's 0.26.0 and 0.25.x sections. Main's entries are untouched and the pin text moves to v0.23.0.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: I reviewed what this change contributes on top of main, using `git show --cc 492b586` and `git diff cc4d863 492b586`. In change-loop.mjs, the `gh-too-old` entries in both languages and the `gh-version-unknown` key sit next to main's `cannot-accept` key. Nothing of main's was dropped and `BLOCKED_OF` keeps all its entries. In the change-loop pin test, the invariant comment and assertions are correct. In flow-check.test.mjs, the auto-merged reason-code table has main's five new codes plus `gh-too-old`. The release renumbering is consistent: plugin.json 0.23.0, marketplace metadata and plugin entry 0.27.0, CHANGELOG 0.27.0 above main's 0.26.0 with the pin text at v0.23.0, and the docs/openspec-flow.md pins (lines 594, 595, 604) all at v0.23.0. The proposal figures read 0.22.0 to 0.23.0 and 0.26.0 to 0.27.0. No conflict markers remain in CHANGELOG.md or docs/openspec-flow.md. The only remaining `v0.22.0` string is in the archived stage-roles history. tasks.md line 300 still names `v0.21.1` in its release-step wording (historical text of the plan). I did not touch the uncommitted evidence.md. Run with TMPDIR=/var/tmp and GITHUB_HEAD_REF and GITHUB_BASE_REF set: change-loop.test.mjs plus flow-check.test.mjs gave 1468 tests, 1468 pass, 0 fail. `python3 scripts/check.py` passed and `python3 scripts/gen-catalog.py --check` exited with no error. I did not run deliver-check.test.mjs, the full guard suite or `claude plugin validate .`.
- Previous round (verdict file at 7492d49): approved with two nits and four praise. It had no blocking or important findings, so no disposition is owed. Both nits are re-listed above as they stand.
