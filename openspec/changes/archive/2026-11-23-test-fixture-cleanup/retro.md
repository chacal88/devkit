<!-- devkit-stage retro result=passed attempt=1 commit=03b117faaa2828b0af231f2685beb4b08ac6f9f9 -->
## Retro: test-fixture-cleanup

1. Went wrong:
   - **Lazy fixtures broke.** Three fixtures cached lazily inside their first test (`schemaProject` and `sampleChange` in `flow-check.test.mjs`, `scratchSlice` in `project-loop.test.mjs`) lost their folder when that test ended. The first whole guard run went red. The plan named the risk, but its grep for `??=` and memo patterns missed these three.
   - **Release numbers collided twice.** Sibling changes released the same numbers while this one waited, so the branch merged `main` twice. First 0.21.2 went to project-phases-followups (#61), then 0.22.0 went to stage-roles (#58). Each merge needed a new release number, a whole guard run, fresh evidence and a review round. Two GitHub update-branch merges that touched no file of this change cost another evidence and review round each. That made five stale-only review rounds and five evidence attempts for a change approved in round 1.
   - **The installed plugin went stale.** After the second merge, the installed devkit-openspec 0.21.1 could not read the project's new `flow.json` (`appliesWhen`). The flow ran on the branch's own `change-loop.mjs`.
   - **No honest reply for "waiting for a place".** The devkit-lite loop has no plan-approval gate, so it went straight to implementation. The roadmap rule says to wait for a place. The stop hook only accepts an end reply, so the session declared `plan-not-approved`, which was not true after the owner approved.
   - **The grill miscounted.** It counted 19 test files instead of 18, and the plan had to reconcile the number.
2. Better next time:
   - A fixture shared across tests is created at module level from the start.
   - Leave the release bump for last, made against `origin/main` of that day.
   - A merge from `main` that touches no file of the change should not stale the evidence and reviews.
   - After `main` changes a schema, update the installed plugin on each worker.
   - Count files with a command, not by hand.
3. Remember: with per-test cleanup, a fixture cached across tests must be built outside any test.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Per-test folder removal breaks fixtures cached lazily inside the first test; build shared fixtures at module level | bug-class | doc-update | project |
| 2 | A merge from `main` that touches no file of the change still stales evidence and every review: five stale-only rounds here | process-friction | followup | project |
| 3 | The installed devkit-openspec plugin lags the project schema after `main` merges a schema change; the loop refuses the new `flow.json` | tooling | followup | project |
| 4 | A roadmap-run session has no end reply for "approved, waiting for a place"; the stop hook forces a wrong reason | process-friction | followup | project |
| 5 | On the Avell, `/var/tmp` holds about 136k `devkit-*` entries left by suites that ran before this fix; they stop growing once every session's branch has the helper | environment | memory-only | user |
| 6 | Count the files a request covers with a command before stating a number in the requirements | process-friction | memory-only | project |

## Proposed updates

### `CONTRIBUTING.md` (bug-class)
The test-fixture paragraph says how folders are made and removed, but not that a fixture shared by several tests must not be created lazily inside one of them.
- before: A test reads the temporary root only through `tmpRoot()`. `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under `plugins/`.
+ after: A test reads the temporary root only through `tmpRoot()`. A fixture shared by several tests is made at module level, never lazily inside the first test that needs it: the helper removes a folder when the test that made it ends. `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under `plugins/`.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Update the note `avell-tmp-inodes`. test-fixture-cleanup (devkit-openspec 0.22.1, PR #62) makes every suite remove its own folders. The `devkit-*` entries already in `/var/tmp` (about 136k on 2026-11-23) came from runs before the fix. Remove them only by exact name, and only once no session on the worker runs a branch without the helper.
- Answer: approved
- Applied: yes
