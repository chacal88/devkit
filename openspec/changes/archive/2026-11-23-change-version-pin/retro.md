<!-- devkit-stage retro result=passed attempt=1 commit=fe1937703b96a82bf6fcdca478d5771a143d3394 -->
## Retro: change-version-pin

1. Went wrong: delivery took five cycles instead of one. Main moved four times while the change was in delivery, and each of those merges (PRs 65, 82, 86 and 87) touched a file outside `openspec/`, so each made the evidence and the reviews stale (the first-parent rule). Two of them (PR 65, then PR 86) also took the release numbers the change had picked, so the change renumbered its release twice, from 0.29.0 to 0.30.0 and then to 0.31.0. Each cycle cost a verify, a review round and a CI run. A second, smaller loss: a new test (`version-pin AC-2 locks: a version-1 readiness reviewer delivers before it stops`) called `subagentStopFor` inside the test process, which wrote `devkit-stop/<session>-<agent>.json` under the real temporary root. Every test passed and the implementer's local runs were green, but CI runs the hook tests with `TMPDIR` set to an empty folder and fails the job when anything is left in it, so the `check` job failed after the push. A third: several reviewer subagents of the scoped re-reviews started their own background wait loops, and their stage-1 answers arrived one to two hours after the work was done.
2. Better next time: when the first stale cycle happens, ask the coordinating session for a merge freeze on the base until the PR lands, instead of after the third. Take the release numbers at the last merge of the base and not at the plan. Run a new or changed test file with a fresh empty `TMPDIR` and check that it stays empty before the first push, because that is how CI judges it. Tell reviewers to run tests in the foreground and finish with their answer.
3. Remember: a merge of the base during delivery costs a whole verify and review cycle, so freeze the base early; and a test is not done until it leaves an empty `TMPDIR` empty.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A test that calls code in the test process which writes under the temporary root leaks into CI's empty `TMPDIR`; local runs never show it | process-friction | doc-update | project |
| 2 | Merges of the base during delivery stale all the evidence and reviews and collide the release numbers; a freeze should be asked for at the first stale cycle | process-friction | doc-update | project |
| 3 | Reviewer subagents that start background wait loops delay a round by hours | tooling | regression-gate | project |
| 4 | Ask for a freeze of the base at the first stale cycle | process-friction | memory-only | user |
| 5 | The main test `change-budget AC-1 next at the cap` fails on macOS with a bare `TMPDIR` (`/var` is a symlink of `/private/var`, the test expects the real path) and fails the same on origin/main | environment | followup | project |
| 6 | Review nits left open: tests for the newer-flow line on an unpinned change, for `flow` on an unpinned change and for a Jira task resuming a change; the pin key names written in the reader and in the writer; `design.md` records no ADR for the pin contract and does not say that a PR may lower its own pin; the digest gate compares the tree with itself and not with the base. Dogfood owed: the next change opened in this repository carries the pin; the re-install check in the consumer projects | doc-gap | followup | project |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
Say how a test is judged on CI: with an empty `TMPDIR` that must stay empty, and what a test that calls code in its own process has to do.
- before: `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under `plugins/`.
+ after: `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under `plugins/`. CI runs the hook tests with `TMPDIR` set to an empty folder and fails the job when anything is left in it; a test that calls, in its own process, code that writes under the temporary root (a stop record, a lock) points the process's temporary root at a `tmpFolder` for that call and restores it afterwards, and before the first push a new or changed test file runs with a fresh empty `TMPDIR` that must still be empty when the run ends.
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (process-friction)
Say what a merge of the base costs a change in delivery and who holds it off.
- before: and search the canonical specs and the tests again for the names of the steps and rules the plan removes.
+ after: and search the canonical specs and the tests again for the names of the steps and rules the plan removes. While a change is in delivery, every merge of the base that touches a file outside `openspec/` makes its evidence and all its reviews stale and can take the release numbers it picked: from the first stale cycle the coordinating session holds the other merges to the base until the change's pull request lands, and the change takes its release numbers at its last merge of the base.
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/scripts/review-round.workflow.js`, `plugins/core/skills/review-change/scripts/review-round.test.mjs` (regression-gate)
Tell every reviewer, in the stage-1 prompt, to run its tests in the foreground and to leave no background command running; a test pins the sentence.
- before: Review as your own instructions say, but write no file: a later stage writes your verdict file.
+ after: Review as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When the base moves a second time during a change's delivery, ask the coordinating session for a merge freeze at once: each merge of the base costs a full verify and review cycle.
- Answer: approved
- Applied: yes
