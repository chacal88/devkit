Verdict: approved
Commit: 7492d49d748b5d124b792a98a889e599df61702e

## Coverage analysis — gh-version-check (round 2, 4fadc2a..7492d49)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946-949 — Archive facts path with an old gh had no test; the collected checks.error was unguarded. · fixed in 7492d49d748b5d124b792a98a889e599df61702e
- [nit] plugins/openspec/hooks/project-loop.mjs:167 — ghParams null-installed fallback and pt-BR reply are untested in project-loop tests 15 and 16.
- [nit] plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:67-80 — Test 19 asserts SKILL.md prose by regex, so it is coupled to the wording.
- [nit] plugins/openspec/hooks/deliver-check.mjs:660 — OLD_GH matches only 'unknown flag: --(json|required)'; the fallback to checks-unreadable for other wordings is not pinned by a test.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:1137-1210 — Tests 5-9 assert the seam end to end, including the exact gh calls and the readable and negative paths.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:4099 — gh-version 20 asserts the error text (2.46.0, 2.50.0, 'update gh') and a single --version call on the archive path; it goes red if the reason is dropped.

In-scope surfaces: plugins/openspec hooks (deliver-check, merge-setup, flow-check, change-loop, project-loop) and the openspec-setup gh-version script.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0; the implementer's red-then-green mutation was not re-run): merge/archive facts path (deliver-check.mjs:946-949) -> caught by gh-version 20; every other seam as in round 1 -> caught by gh-version 5-19.

### Well covered
- Archive facts with an old gh: gh-version 20 asserts the version, the minimum and the update hint in checks.error, and exactly one --version call.
