<!-- devkit-stage retro result=passed attempt=1 commit=34540ba02852c9a01f470b95d25a752210ba2508 -->
## Retro: own-pr-archive-paths

1. Went wrong:
   - **The release moved a test the plan did not list.** Every release moves the CI-pin assertion in `change-loop-compozy.test.mjs` (the test `change-loop docs: the design records the answers`, then in `change-loop.test.mjs`). The approved plan named the release files and `docs/openspec-flow.md` but not that test, so the implementer of phase 2 stopped with `Outcome: failure` and the plan needed an amendment after the owner's approval (`a816d74`). Nothing in the flow says what to do when a plan changes after approval; the coordinator asked for the owner's confirmation by hand.
   - **The tests moved while the change waited.** suite-speed split `deliver-check.test.mjs` and `change-loop.test.mjs` between the plan and the merge. The gates the plan wrote name the old files with name filters, so run as written they matched one test (gate 1.5) and two (gate 2.3) and still exited 0; the verifier had to run the real coverage over the split files and say so in `evidence.md`.
   - **`main` moved three times before delivery.** suite-speed (0.38.0), stale-only-on-own-files (0.39.0) and the train commit each landed while the change waited: the release files conflicted every time and the change was renumbered 0.33.1 → 0.38.1 → 0.39.1. One full suite ran green on `9374aeb` (38 files, 2923 tests); the next one was started on `bda86b0` and stopped when the coordinator moved the line to the delivery train. Evidence and both reviews were redone at the merged head.
   - **The short script has no readiness gate.** `devkit-lite` goes from the plan to implementation, so the independent plan read ran by hand, written to the scratchpad instead of `readiness.md`, and the owner's plan approval had no step to be recorded in.
   - **A test seam stayed open.** The reviewers' only open finding: the `mergedOnBranch` callsite of `isOwnPr` (`deliver-check.mjs`) has no test with another change's archived file; only the `findChangePr` list path has one.
2. Better next time:
   - The release step of a plan lists the pin assertion test among the files a release moves, with its invariant, layer and suite.
   - A gate names a test by its name pattern over the whole suite (`node scripts/test-suite.mjs --test-name-pattern=<re>`), not by a file that may be split; a gate whose filter matches fewer tests than its task says fails.
   - A plan changed after the owner's approval is amended in its own commit, and the flow asks the owner to confirm it before delivery.
3. Remember: a release moves the CI-pin assertion in `change-loop-compozy.test.mjs`; list it in the plan's release task.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The release moves the CI-pin assertion test (`change-loop docs: the design records the answers`), which the plan did not list; the plan was amended after approval | doc-gap | doc-update | project |
| 2 | A gate that names a test file by a name filter silently shrinks when the file is split: it matched 1 and 2 tests and exited 0 | tooling | followup | project |
| 3 | `devkit-lite` has no step for a plan amended after the owner's approval, and no readiness record | process-friction | followup | project |
| 4 | `mergedOnBranch` (`deliver-check.mjs:754`) has no test with another change's archived file | bug-class | followup | project |

## Proposed updates

### `CONTRIBUTING.md` (doc-gap)
Step 5 of "How to contribute" says what a release bumps but not that it also moves a test: the CI-pin assertion in `plugins/openspec/hooks/change-loop-compozy.test.mjs` (`change-loop docs: the design records the answers`) names the current devkit-openspec version, so every release that changes it must edit that test (the match, the `doesNotMatch` for the version before, and the invariant comment above).
- before: In a project with a delivery train a boarded change takes its release numbers on the train: the departure renumbers each join above the train's numbers, and the change's own head keeps the numbers it had.
+ after: In a project with a delivery train a boarded change takes its release numbers on the train: the departure renumbers each join above the train's numbers, and the change's own head keeps the numbers it had. A release that changes devkit-openspec's version also moves the CI-pin assertion of `plugins/openspec/hooks/change-loop-compozy.test.mjs` (the test `change-loop docs: the design records the answers`: the `match` of the new `v<version>`, a `doesNotMatch` for the version before it and the invariant comment above them), so list that test in the plan's release task.
- Answer: approved
- Applied: yes
