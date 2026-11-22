<!-- devkit-stage readiness result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Readiness review: merge-staleness-first-parent

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. One function (`staleness()` in `plugins/openspec/hooks/deliver-check.mjs`) changes how it reads a merge commit; docs and a patch release follow. Non-goals are explicit (no `--first-parent` walk, no change to `flow-check.mjs`, reason wording or dirty-tree rule). AC-5 (dogfood on a real PR) is stated as not proven here and kept out of the exit criteria.

## 3. Proposal review
The problem is concrete and has a reproduction (PR #46, `gh pr update-branch` bringing only `openspec/roadmap.md`). The impact on callers is listed. AC-1 to AC-4 map to tasks 1.1, 1.2, 1.4 and 2.2. No findings.

## 4. Design review
Claims about the live code were re-derived at `2300f84`:
- `staleness()` is at `deliver-check.mjs:193-210`. It walks `git rev-list <full>..<head>` and runs `git diff-tree -m -r -z --root --name-only --no-commit-id <c>`, with the first non-`openspec/` path giving the quoted reason. Matches D-1.
- `flow-check.mjs:265` calls `staleness` and `flow-check.mjs:11` imports it, so the readout follows with no change. Matches.
- `docs/openspec-flow.md` has the staleness paragraph (line 392), the `update-branch` row (line 503) with the exact sentence to replace, and the pin `v0.18.1` on lines 554, 555 and 562. `plugin.json` and `marketplace.json` are at 0.18.1 and the marketplace at 0.22.1. `change-loop.test.mjs:2473` holds the pin assertion. Tag `v0.18.1` exists. All match D-4 and D-5.
- Scratch re-runs of the D-3 fixtures on the unchanged code agree with the plan's red/green table: test 1 (merge of an openspec-only main into a branch with product commits) reads stale; test 4 (move under `openspec/`) and test 6 (first parent is the base) read stale and name `src/a.ts`; test 7 (root brought in) names the merge, not the root. So 1, 7 (and by the same analysis 5, 8, 9) fail today, and 2, 3, 4, 6, 10 pass today.
- D-2 (`diff-tree` with two trees instead of `git diff`, to avoid rename detection) is a sound refinement of `requirements.md`, and it is recorded for the owner.
- The shallow-history case (parent missing, so the root path lists every file) goes to the safe side.

No failed re-derivations.

## 5. Specs review
`openspec validate merge-staleness-first-parent --strict` reports valid. One ADDED requirement with SHALL language and nine scenarios. Every outcome row of the D-1 rule and of the D-3 table has a scenario or an existing-test proof: openspec-only (current), product file brought, resolution edit, move out of product, brought-in commit undone by a later one, first parent is the base, root commit brought in, plain commit after a merge, plain-only history unchanged. No requirement lives only in support docs.

## 6. Tasks review
Tasks are ordered (tests first with a red proof, then the code, then docs, then the release and the whole suite). Every gate is one backticked command with `&&` parts and no `|`. Task paths are real. Phase gate 1.4 runs on the base: the flow-check suite (119 tests under the `flow-check` and `field-fixes` names) passes there, and the caller reports the deliver-check suite (376 of 376), `scripts/check.py` and `gen-catalog.py --check` green on the base. Gate 2.2 (the whole guard suite) is long and is run by the caller; no result on the base was handed over for it, but nothing in the plan depends on it being red or green beforehand. The tests are specified one by one (fixture, merge command, exact expected reason, AC), so no developer choice is left.

## 7. Omission detection
Validation, error handling, rollback, idempotency, migration, permissions and observability are not applicable to a pure read-side checker change, or are covered (the unchanged reason wording, the shallow-history safe side, the release pin test). Compatibility: one-parent history gives the same answer and reason, pinned by the existing staleness tests listed in D-4. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: a fixture does not build the history the D-3 table says (test 7's orphan merge, test 6's `switch -C`). Impact: a test passes or fails for the wrong reason. Prevention: the "fixture check" lines in D-3 and the red-proof step 1.1, which says to settle a mismatch before 1.2.
2. Cause: a new test passes only without `GITHUB_HEAD_REF`. Impact: green locally, red on CI. Prevention: gate 1.4 and 2.2 set the variables, and the tests use the blanking helpers.
3. Cause: the release pin tests (`deliver-check.test.mjs:3594`, `:3604`) fail if a version is bumped in one place but not another. Prevention: task 2.1 lists all places and names those two tests in its check.
4. Cause: the 8-minute flow-check gate (it loads the deliver-check suite) hits an agent timeout. Prevention: the plan says to run the whole suite as a background command.
5. Cause: an octopus merge or a merge with a missing parent in a shallow clone. Impact: a wrong reading. Prevention: the CI snippet uses `fetch-depth: 0` and a missing parent goes to the root path (stale).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: `tasks.md` task 1.1 expects 1, 5, 7, 8 and 9 to fail on the unchanged code and 2, 3, 4, 6 and 10 to pass. I confirmed 1, 4, 6 and 7 by hand. Tests 5, 8, 9 and 10 follow from the same analysis but were not re-run, and the task already says to settle a mismatch before 1.2.

## 11. Explicitly out of scope
- [ ] AC-5 `update-branch-dogfood`, left to the next change's retro (as the proposal says).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, with a reproduction and the PR #46 case.
2. Is the result measurable? Yes: ten named tests with exact expected strings, plus the unchanged existing tests.
3. Are error behaviors defined? Yes: an unresolvable or non-ancestor record, a missing parent and the dirty tree keep their behavior.
4. Are edge cases covered? Yes: resolution edits, moves, undone product commits, root commits, a first parent that is the base, and a plain commit after a merge.
5. Are dependencies clear? Yes: no new module or import, and a fixed ordering of the tasks.
6. Are contracts defined? Yes: `touchedPaths(root, c, parents)`, the two git commands and the reason string.
7. Can two developers interpret this differently? Not in a way that changes behavior.
8. Are any decisions implicit instead of written? No. D-2 is written down, and the rejected alternatives are listed.
9. Do the tasks fully deliver the intended outcome? Yes for AC-1 to AC-4; AC-5 is deliberately deferred.
10. What will be discovered too late if implementation starts now? Nothing found. The remaining unknown is the real "Update branch" dogfood, which is declared as owed.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan.
- What must be fixed? Nothing.
- Main risk if ignored? A fixture that does not build its intended history, which the red-proof step in task 1.1 is there to catch.
