Verdict: approved
Commit: 796ac2cb75448c7596cc45f0cbe6851d2ccce58f

## Architecture review — run-status-bar (round 2, third pass authorized by the owner, 9ad0f6f..796ac2c)

### Findings
- [praise] plugins/openspec/hooks/flow-check.mjs:487 — One function, notApplicableOf, owns the rules for when a stage does not apply; the stage walk and appliedStages (line 509) both call it. OFFLINE_GH has one home, merge-setup.mjs:49. Unchanged in this range.
- [praise] plugins/openspec/hooks/change-loop.mjs:1202 — The GitHub-silent ending is still one local helper, silent(stageId, error). blockedEnd (line 1355) and the offline stop-merge-setup branch (line 1411) both call it, and B14b (change-loop.test.mjs:493) now pins that it is the only stop read differently offline.

Analyzed (re-check of what this change brings since 9ad0f6f: 62bd607, the fix for test-coverage F11 plus code-quality nit F14; the merge resolutions of 4c25ecc and e14e1fa, each compared with both parents through `git show --cc`; 0983bd2 and 41caadc, the plan; b892d4f and 796ac2c, the evidence. Main's own commits are not reviewed.)

- **Owners.** No new module, home or sharing mechanism is added.
  - `decide` in `change-loop.mjs` still owns how a delivery row becomes an end state. 62bd607 changes only its doc comment, which now names the `offline` fact, and adds the test B14b.
  - `merge-setup.mjs` still owns `OFFLINE_GH`, at line 49. `roadmap-loop.mjs:48` now imports it from there; that import line came from this change's earlier commits and kept its place in the merge, beside main's new `baseFetches` import.
- **Merge 4c25ecc (with main c09860c).**
  - In `stateEntries` (change-loop.mjs:2027-2040), main's branch for unplaced changes, `unplacedAction` and `archivedStandIn`, now comes before this change's `nextAction(..., stages: true)`.
  - The entry is built in one place: `stages: action.stages ?? null` (line 2039). The blocked stand-in of an unplaced change carries no `stages`, so it gets `null`.
  - E-6 adds `stages: null` to main's expected entry in `change-loop-remote-state.test.mjs:1608`. That is the only edit to an existing test, and the plan names it (tasks.md lines 19-24, design.md lines 35-39).
  - `blockedEnd` takes main's new `failures` param and keeps this change's `silent(...)` call.
  - `USAGE` takes main's `[--stdin <name>]` and this change's `[--offline]`.
  - `flow-check.test.mjs` keeps both sections, run-status-bar and stage-ceiling-consecutive.
  - The release moves to 0.45.0 / 0.50.0.
- **Merge e14e1fa (with main 74f2444).**
  - The `nextAction` signature (line 1527) takes main's `fetchBase` and this change's `stages`. They are independent options. `state` passes `stages` and no `fetchBase` (line 2032); `next` (line 3170) and `wait` (line 3363) pass `fetchBase` and no `stages`.
  - So the status bar's `state --offline` call still makes no fetch and no `gh` call. `next`'s action keeps its shape.
  - The release moves to devkit-openspec 0.46.0 / marketplace 0.51.0. `plugin.json` and `marketplace.json` agree, `CHANGELOG.md` opens with `## 0.51.0`, and the pins in `docs/openspec-flow.md` (lines 741, 742 and 755) read `v0.46.0`.
  - The doubled `const baseBranch` at lines 1561 and 1563 is main's code (74f2444 lines 1547 and 1549), not this merge's.
- **Contract consumers.**
  - The `state` entry's shape is unchanged since 9ad0f6f: `stages` is still the last field, and it is `null` on every stand-in entry.
  - `decide`'s optional `offline` fact is unchanged. B14b shows that offline the other four delivery stops (`stop-branch`, `stop-archive`, `stop-not-approved`, `blocked`) still end blocked, so the change of reading stays limited to the merge-setup stop.
  - The status line (`status-line.mjs`) is still the only caller of `--offline`.
- **The owner's accepted limit** (design.md lines 44-46; evidence C1 to C4).
  - The coordinator bar prints nothing on this repository because the serial `state` listing of 11 changes takes 37-45 s against the bar's 20 s bound.
  - Architecturally, the bar reading the state only through `change-loop.mjs state` (ADR 0017) is the right seam. Speed is a property of that owner, and the follow-up `state-listing-speed` targets it, not a second reader inside the bar.
  - The design records the choice and the owner's words, so it is not a finding.
- **Deletion tests.** No new module in this range.
- **ADR.** No structural decision in this range needs one.
- **Test run.** At HEAD, `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/change-loop.test.mjs`: 1 file, 201 tests, 201 pass, 0 fail, 378.3 s. That includes `change-loop decide: B14b offline, only the merge-setup stop reads as GitHub silent; the other stops stay blocked`. The harness moved the run to the background after 180 s; it was waited on until it ended, and nothing is left running.
