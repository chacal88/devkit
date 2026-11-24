Verdict: approved
Commit: 7e305e2e4151ffd509180328b4a05b3f339cb2ae

## Quality review — state-skips-unlocated (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1796 and plugins/openspec/hooks/roadmap-loop.mjs:807 — One exported helper, unplacedAction, builds the blocked stand-in. The state command and collectRoadmap both call it, so the board and the command agree by construction (ADR 0017 decision 1). It reuses the existing wrong-branch reason, which already has en and pt-BR texts, instead of adding a second table.
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1432-1458 — locate has one test per guard of the new step (main holds the folder active, main holds it archived, the caller holds only an archived copy, the caller holds no folder, caller in main, caller in the change's own worktree). A negative case is not skipped. The run-file-first, archived-stale-copy and reused-id cases are also covered.
- [praise] plugins/openspec/hooks/change-loop-fixtures.mjs — archiveGh, archivedFolder, archiveOnOrigin and withCreated moved out of change-loop-compozy.test.mjs into the shared fixtures module. Both suites import them, so no helper is copied.
- [nit] plugins/openspec/hooks/change-loop.mjs:1843-1854 — stateEntries now reads the archived ids twice when an id is unplaced and others are not placed: once through the lazy `days` (archivedDates) and once through `archived` (archivedOnDefault, which wraps archivedDates). Each read can call the gh API. Deriving `archived` from `new Set(days.keys())` would give one read. unplacedAction also runs locate and knownChange (extra git spawns) for every id, placed ones included.
- [nit] plugins/openspec/hooks/change-loop.mjs:1406-1414 — The caller step of locate applies to any non-main checkout that holds the active folder while main holds none. That includes a delivery-train checkout (train/<n>), which unfinished() explicitly says is never a change's place. No test pins a train/<n> caller. The train code calls locate from ctx.root, so there is no known impact. A one-line test or comment would record the intent.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:807 — For an unplaced line collectRoadmap ignores the `progress` (after) key and goes straight to the stand-in. This is consistent with the run file winning first and with the design, but the behaviour has no test and no comment.

### Summary
- 6 findings (0 blocking, 0 important, 3 nit) + 3 praise
- Justification: I read the whole product diff (`locate`, `unplacedAction`, `stateEntries`, `collectRoadmap`), the moved fixtures, the new tests, the docs paragraph, the CHANGELOG and the release pins. Each acceptance criterion maps to a test and to the recorded real run in `evidence.md` and `proof/real-run.txt`.
  - **State and board:** the state command and the board both list an unplaced change as blocked with `wrong-branch` in en and pt-BR, and they agree on every open line.
  - **`--change` and unknown ids:** `state --change x` returns the same entry as the list, and `state --change nope` still exits 3.
  - **`locate`:** AC-5 is covered, including the negative cases.
  - **Scope and rationale:** the diff stays within the declared scope, and design, proposal and diff do not contradict each other.
  - **Existing tests and docs:** no existing test was edited, the only change to one being the release-pin assertion moving from 0.39.0 to 0.39.1. `docs/openspec-flow.md` and the `change-state` spec delta name the new reason and the new locate order.
  - **Release:** 0.39.1 and 0.43.1 are consistent across `plugin.json`, `marketplace.json`, the CHANGELOG and the CI pins.
  - **Known gaps:** the whole-suite result at this head belongs to the delivery train, and `evidence.md` says so. The pr-verifier ran at this head and its filtered and per-file runs were green. I re-ran the `unlocated` tests: 39 of 39 passed.
  - **Open points:** no blocking or important issue. The three nits are optional.
