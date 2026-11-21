Verdict: rejected
Commit: 58d7a8b07652ce057525b17f051fad8db1b7eb3b

## Coverage analysis — merge-setup-field-fixes (main...HEAD)

### Findings
- [important] plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs (requirementSources, checksFrom 'unreadable') — No test covers the 'newest pull requests could not be read' label or checksFrom === 'unreadable'. If the discoverError branch were mislabelled as 'pull-requests', nothing goes red. Write in github-setup.test.mjs using the world() helper, with the pull-requests read failing and no --checks.
- [important] plugins/openspec/hooks/deliver-check.mjs:1648 (checksToWatch) — The stop-merge-setup watch guards on !state.archive and pr.state === 'OPEN'; no test pins them. With the archive PR phase or a MERGED/CLOSED PR carrying a stale pending check, a watch could start wrongly and every field-fixes 9 test stays green. Write in deliver-check.test.mjs next to the field-fixes 9 tests, using mergeReady() and a merged PR state or an archive state with a pending check, asserting watchCalls is empty.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (field-fixes 9 cap test) — The cap test relies on a real 20s sleep with a 15s wall-clock assertion; it could be flaky on a loaded CI runner.
- [praise] verdict-files tests — The first-Verdict-line behavior is pinned in both orders on every reader.

In-scope surfaces: plugins/openspec hooks (deliver-check, guard, conduct-check), the openspec-setup github-setup script.
Blocking gaps (8-10 without a plan): 0
Seams checked: --watch at stop-merge-setup → caught by 'field-fixes 9 watch' tests (watch args, final report, cap, no-watch cases); the requires and checksFrom fields in the JSON plan and in the printed line → caught by the 'field-fixes 11 setup' tests (option, pull-requests, empty, stored ruleset kept, rulesets refused); the first-Verdict-line read in item 2, the devkit-reviews check (both entries), guard readValue and reviewConsensus, the gh pr create hook, and the conduct plan audit → caught by the 'field-fixes 10' tests in both orders; the CI pin bump to v0.18.1 → caught by the change-loop docs test (mutation runs: 0)

### Well covered
- First Verdict line: tests on every reader check both orders and that nothing is printed about the second line.
- Setup requires line: the printed line and the JSON `requires` agree, and `items[3]` keeps its old fields.
