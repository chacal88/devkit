Verdict: approved
Commit: b78a2c9cc21e118dc339d3b210218fd2e95846a7

## Coverage analysis — merge-setup-field-fixes (58d7a8b..HEAD, round 2)

### Findings
- [important] plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs (requirementSources, checksFrom 'unreadable') — Label 'the newest pull requests could not be read' and checksFrom 'unreadable' had no test. · fixed in 49294bc
- [important] plugins/openspec/hooks/deliver-check.mjs:1653 (checksToWatch) — The !state.archive and state.pr.state === 'OPEN' guards of the stop-merge-setup watch had no test. · fixed in 49294bc
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (field-fixes 9 cap test) — The cap test relies on a real 20s sleep and a 15s wall-clock assertion, which could be flaky on a loaded CI runner.

In-scope surfaces: plugins/openspec hooks (deliver-check), the openspec-setup github-setup script (tests only since round 1).
Blocking gaps (8-10 without a plan): 0
Seams checked: checksToWatch at stop-merge-setup → caught by the new 'field-fixes 9 watch: no watch target in the archive phase or for a MERGED or CLOSED pull request' test. It asserts the OPEN pull request with e2e pending is watched, and that MERGED, CLOSED and archive each return null. Dropping the OPEN guard or the !state.archive guard turns it red; the test calls the real checksToWatch on state from collectState, so it does not just re-read a mock. The 'unreadable' discovery label and checksFrom → caught by the new 'field-fixes 11 setup: with the newest pull requests unreadable' test. It makes the pull-requests read fail with a 502 and checks the printed line, the absence of the other two source labels, and the JSON checksFrom and requires. Changing the label or the checksFrom ternary at github-setup.mjs:246 or :274 turns it red. (mutation runs: 0; both verified by reading the code against the assertions, not by editing. The implementer's mutation report was not re-run.)

Round 1 findings F1 and F2 are closed. F3 stays a nit. No production file changed since round 1.

### Well covered
- First Verdict line: tests on every reader check both orders.
- Setup requires line: the printed line and the JSON requires agree, including now the unreadable-source case.
- Watch targeting: open, merged, closed and archive cases are now all pinned.
