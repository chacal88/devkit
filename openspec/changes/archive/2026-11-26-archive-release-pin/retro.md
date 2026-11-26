<!-- devkit-stage retro result=passed attempt=1 commit=7148a2a5f60395db2e7bbf24f6530f34a1e54c86 -->
## Retro: archive-release-pin

1. Went wrong: the first plan made the archive check accept two pin files, the CI pin lines of `docs/openspec-flow.md` and the pin assertion lines of the CI pin test. The test half did not survive the delivery train (ADR 0022): every releasing change rewrote the same pin block of that test, so the train could not join two of them and only one releasing change fitted a train. The plan was amended (requirements answer A3, ADR 0030, design D-12, tasks phase 4): the pin test reads the version from the manifest, no release edits it, and only the flow page passes the archive check by its content. Review round 1 failed on three verified important findings that one cause explains: suite-speed split `change-loop.test.mjs` under the change, and the spec delta still named the old path while the code named `change-loop-compozy.test.mjs`, and the committed real-run proof had been made on the old path (fixed in 211c1eb). After that, every further review round and evidence attempt (attempt 7 at `eb0e00a`) was caused only by base merges and train merges that staled the Commit lines; the change's own code did not change. Two loop defects surfaced on the way and blocked this retro until they were fixed (coordinator-loop-fixes, devkit-openspec 0.49.0, on `main` since train 19): `isArchiveHead` treated the change's own head `archive-release-pin` as an archive head, so the change could not find its own merged pull request 107; and once the local branch was fast-forwarded to `main`, `staleness()` judged the train's merge commits against their first parent and read the evidence and the reviews as stale ("PR merged at 7148a2a; local head differs"). Smaller slips: the gates 1.5 and 2.4 of `tasks.md` select tests by name inside named files (`conduct-check.test.mjs`, `guard.test.mjs`) that, after the suite split, no longer hold most of those tests, so they passed while running few of them; and tests 3 and 4 of `deliver-check-archive.test.mjs` became vacuous under ADR 0030.
2. Better next time: a release rule is designed with the delivery train in mind from the start: a file every release edits at the same lines cannot be shared by two changes of one train, so a test reads the release number instead of holding it. After a base merge that renames or splits a file the plan names, the plan, the spec deltas and the real-run proof move to the new path before the review. A gate that selects tests by name runs through the suite script with no file argument, so a split cannot leave it empty. A delivered change's branch stays at its merged head until its retro is written.
3. Remember: a file every release edits at the same lines serialises the train; make the test read the manifest instead.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The roadmap line `release-pin-is-a-release-file` asks for what this change delivered (`pinLinesOnly`, `PIN_LINE_FILES` in `deliver-check.mjs`) and stays unticked | doc-gap | doc-update | project |
| 2 | A release rule that has every release edit one test's pin block lets only one releasing change into a train | project-rule | rule (already recorded: ADR 0030, `CONTRIBUTING.md` step 5) | project |
| 3 | Tests 3 and 4 of `deliver-check-archive.test.mjs` assert on a path `pinLinesOnly` rejects before reading any line, and the `LOOP_PATH` comment still says that file holds the pin block | bug-class | regression-gate | project |
| 4 | A gate that names a test file and filters by name passes with few or no tests once a split moves them; second time (stale-only-on-own-files retro found it for `guard.test.mjs`) | process-friction | doc-update | project |
| 5 | A base merge that split a file the change names left the spec delta and the real-run proof on the old path; review round 1 failed on it | process-friction | doc-update | project |
| 6 | `isArchiveHead` matched a change id that starts with `archive-`, and a fast-forwarded delivered branch read the train's merges as stale | tooling | followup (done: coordinator-loop-fixes, devkit-openspec 0.49.0) | project |
| 7 | Moving a delivered change's branch to `main` before its retro stales its records with an installed devkit-openspec older than 0.49.0 | environment | memory-only | user |

## Left as notes (no proposal)

- No seam test for a flow page that is present but unreadable (`unnamedFiles` given no text for it): `archive-release-pin 5` covers `pinLinesOnly` with a missing or non-string side, and `archive-release-pin 6` covers `unnamedFiles` without texts (both files named); the read in between is a git read whose failure gives no text. A seam test needs a fixture repository; left for a change that touches that read.
- Test 12's `changeIds` is a hand-kept list. Deriving it from the folders of `openspec/changes/` and `openspec/changes/archive/` was checked against `main`'s pin test: the test legitimately names `change-coordinator` and `review-writer-prompt` (ADR 0011 notes and a roadmap line), so a derived list would fail. Since ADR 0030 no release edits the pin test, the list no longer grows; it stays.
- `design.md`, `tasks.md` and `requirements.md` still name `change-loop.test.mjs` and older release numbers, and the gates 1.5 and 2.4 select few tests after the suite split: these are the change's history and are archived as they are.

## Proposed updates

### `openspec/roadmap.md` (doc-update)
Tick the roadmap line that asks for what this change delivered (learning 1). The archive's `tick-roadmap` step ticks the `archive-release-pin` line itself; this proposal ticks the second line, in Round 25d, and says who delivered it.
- before: - [ ] release-pin-is-a-release-file — the archive check of `deliver-check.mjs` (`RELEASE_FILE`) accepts the CI pin lines of `docs/openspec-flow.md` moved with a devkit-openspec bump, as it accepts `plugin.json`, `marketplace.json`, `CHANGELOG.md` and the catalog, so a retro proposal that bumps the pack needs not name the doc (change-state archive, 2026-11-23)
+ after: - [x] release-pin-is-a-release-file — (the same text) (change-state archive, 2026-11-23); delivered by archive-release-pin (`pinLinesOnly` and `PIN_LINE_FILES` in `deliver-check.mjs`, ADR 0027 as amended by ADR 0030)
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/deliver-check-archive.test.mjs` (regression-gate)
Fold the vacuous test 4 into test 3 and correct the `LOOP_PATH` comment (learning 3). Invariant: no file but the flow page passes the archive check by its content, whatever its lines (ADR 0030); layer: the archive check's unit `pinLinesOnly`; suite: `deliver-check-archive.test.mjs`. Under ADR 0030 `pinLinesOnly` returns false for `LOOP_PATH` before it reads a line, so the five line-form cases of test 3 and the seven cases of test 4 cannot go red for any change of the line rule; the `PIN_LINE_FILES` assertion and the moved-pin-block case are the two that carry the invariant.
- before: the comment above `LOOP_PATH` says `// The file that holds the pin block (`// Invariant: the CI snippet pins the current release`): suite-speed split change-loop.test.mjs and the block moved here.`; test 3 asserts `PIN_LINE_FILES`, the moved pin block, and five more `pinHas(LOOP_PATH, ...)` cases (a removed `assert.doesNotMatch` line, an escaped quote, a changed Invariant comment, another indentation); test 4 (`archive-release-pin 4: pinLinesOnly names a test file with any other changed line`) asserts seven more `pinHas(LOOP_PATH, ...)` cases.
+ after: the comment says `// The CI pin test (suite-speed moved it here from change-loop.test.mjs). Since ADR 0030 it reads the manifest and no release edits it, so it is never pin-only.`; test 3 keeps only its `typeof` check, the `assert.deepEqual(DC.PIN_LINE_FILES, [FLOW_PATH], ...)` line and the `'the pin block moved to the next release'` case; test 4 is removed. `loopLines`, `PIN_LOOP_BEFORE` and `PIN_LOOP_AFTER` stay (tests 5 to 8 use them). Run `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs` before the push.
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (doc-update)
A gate that filters by name does not name a file (learning 4). The `Gates:` line of `context` says which command a gate names but not how a filtered gate selects its tests; `node --test <file> --test-name-pattern=...` passes when the pattern matches nothing in that file, which is what happened to gates 1.5 and 2.4 here and to gates 1.5, 2.5 and 3.8 of stale-only-on-own-files.
- before: Gates: A phase gate the delivery train runs names the train's command (`node scripts/test-suite.mjs`, `python3 scripts/check.py`); a gate naming one test file needs a passing local row after every base merge, so a plan uses one only when that file must pass before the train.
+ after: Gates: A phase gate the delivery train runs names the train's command (`node scripts/test-suite.mjs`, `python3 scripts/check.py`); a gate naming one test file needs a passing local row after every base merge, so a plan uses one only when that file must pass before the train. A gate that selects tests by name runs `node scripts/test-suite.mjs --test-name-pattern="^<name>"` with no file argument, so a split that moves the tests keeps them selected (a pattern that matches nothing in a named file passes with no test run).
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (doc-update)
A base merge that renames a file the change names moves the plan and its proof (learning 5). A new `context` line after `Gates:`, next to `Existing tests:`, which covers a changed string but not a changed path.
- before: the `context` block has no line for a path the base renames or splits under a change.
+ after: Base renames: After a merge of the base that renames or splits a file the change names, the spec deltas, the plan's test table and the real-run proof move to the new path before the review; a proof made on the old path is made again and its output committed.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Until the installed devkit-openspec is 0.49.0 or later, do not fast-forward or merge a delivered change's branch into `main` before its retro: an older loop reads the train's merges as stale evidence and reviews and cannot find the change's own merged pull request.
- Answer: approved
- Applied: yes
