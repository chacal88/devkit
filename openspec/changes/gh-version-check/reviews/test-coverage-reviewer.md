Verdict: approved
Commit: 492b58633030aa9bb39198b03161304b67082701

## Coverage analysis: gh-version-check, merge 492b586 (conflict resolutions and 0.23.0 renumbering)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946-949 — Previous round: archive facts path with an old gh had no test; the collected checks.error was unguarded. · fixed in 7492d49d748b5d124b792a98a889e599df61702e
- [nit] plugins/openspec/hooks/project-loop.mjs:167 — Previous round: the ghParams null-installed fallback and the pt-BR reply are untested in project-loop tests 15 and 16.
- [nit] plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:67-80 — Previous round: test 19 asserts SKILL.md prose by regex, so it is coupled to the wording.
- [nit] plugins/openspec/hooks/deliver-check.mjs:660 — Previous round: OLD_GH matches only 'unknown flag: --(json|required)'; the fallback to checks-unreadable for other wordings is not pinned by a test.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:1137-1210 — Previous round: tests 5-9 assert the seam end to end, including the exact gh calls and the readable and negative paths.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:324-362 — gh-version 12-14 pin the gh-too-old reply at decide, CLI and wait-loop level in both languages, and the merged message tables keep both sides' keys.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2520-2523 — The CI pin test moved to v0.23.0 and refuses v0.22.0 and every older pin, so a missed renumbering goes red.

In-scope surfaces: plugins/openspec hooks (change-loop message tables, change-loop pin test) and the release files (marketplace.json, plugin.json, CHANGELOG.md, docs/openspec-flow.md).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): MESSAGES merge (main's blocked-why.cannot-accept next to this change's gh-too-old and gh-version-unknown, en and pt-BR) -> caught by the SAMPLE-token tests and gh-version 12; BLOCKED_OF and blockedEnd -> gh-version 12, 13, 14; CI pin v0.23.0 -> change-loop docs pin test, which refuses v0.22.0 and older; version files -> no test owns the numbers, check.py and gen-catalog.py --check are the gates, and no stale 0.22.0 or 0.26.0 remains in live files; guard.test.mjs import of gh-version.test.mjs -> present.
The focused change-loop.test.mjs run (TMPDIR=/var/tmp) was still running with no results printed when I stopped waiting, so the review is static and green is unconfirmed.

### Well covered
- The old-gh reply is pinned at three layers: decide (gh-version 12), CLI (gh-version 13) and wait loop (gh-version 14).
- The pin test refuses every earlier release pin, so a bad conflict resolution that left v0.22.0 in the flow doc goes red.
