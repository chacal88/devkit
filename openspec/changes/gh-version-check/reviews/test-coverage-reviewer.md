Verdict: approved
Commit: efa4568aeaf63174d4c77d56972dafb7fc79390d

## Coverage analysis: gh-version-check, merges 68be5be to efa4568 (conflict resolutions, shared tmp helper, 0.27.0 renumbering)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946-949 — Previous round: the archive facts path with an old gh had no test and checks.error was unguarded. · fixed in 7492d49d748b5d124b792a98a889e599df61702e
- [nit] plugins/openspec/hooks/project-loop.mjs:167 — Previous round: the ghParams null-installed fallback and the pt-BR reply are untested in project-loop tests 15 and 16.
- [nit] plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:67-80 — Previous round: test 19 asserts SKILL.md prose by regex, so it is coupled to the wording.
- [nit] plugins/openspec/hooks/deliver-check.mjs:660 — Previous round: OLD_GH matches only 'unknown flag: --(json|required)'; the fallback to checks-unreadable for other wordings is not pinned.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2547 — The merge left a stray blank line in the CI pin test, between the v0.22.1 and v0.22.0 assertions; harmless, remove it.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:343-380 — No test combines a gh-too-old end with a budget at or over its cap. Reading change-loop.mjs:886-889, hold only converts 'agent' and 'session' actions, so the 'end' action passes through, but only by reading.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:341-379 — gh-version 12-14 pin the gh-too-old reply at decide, next-CLI and waitLoop level in en and pt-BR, including the unknown-version fallback. The new BLOCKED_OF entry and the gh-too-old branch of blockedEnd both go red if broken. githubSilent is untouched, so a gh-too-old end is not misread as waiting-on-github, and the gh-version 13 test shows the CLI exits 2 instead of waiting.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2538-2548 — The CI pin test moved to v0.27.0 and refuses every earlier pin including v0.26.1, so a missed renumbering goes red.
- [praise] plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:10-11 — The test now imports fakeGh from deliver-check.test.mjs and tmpFolder from main's shared test-tmp.mjs, so it follows the TMPDIR convention.

In-scope surfaces: plugins/openspec hooks (change-loop decide, blockedEnd, message tables, pin test), the openspec-setup gh-version script and its test, and the release files (plugin.json 0.27.0, marketplace 0.31.0, CI pin v0.27.0).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): BLOCKED_OF 'gh-too-old' entry -> gh-version 12 and 13; blockedEnd params (installed, minimum, verb, unknown-version fallback) -> gh-version 12, en and pt-BR; MESSAGES merge (main's keys next to gh-too-old and gh-version-unknown) -> SAMPLE-token tests with the new installed and minimum samples, plus gh-version 12; githubSilent precedence over gh-too-old -> gh-version 13 and 14 (exit 2 and an immediate end, not a wait); budget hold next to the blocked end -> read-only argument, not asserted (F6); CI pin v0.27.0 -> change-loop docs pin test; shared tmp helper in gh-version.test.mjs -> imported from hooks/test-tmp.mjs.

### Well covered
- The old-gh reply is pinned at three layers: decide, CLI and wait loop.
- The pin test refuses every earlier release pin.
