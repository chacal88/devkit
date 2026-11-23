<!-- devkit-stage readiness result=passed attempt=1 commit=8c8b7b89ca898242699b60e964e74a183e98258f -->
# Readiness review: release-merge-conflict

## 1. Decision
- Status: APPROVED
- Confidence: medium
- Ready to implement: yes

`openspec validate release-merge-conflict --strict` passes. I read the proposal, design (D-1 to D-7), the spec delta, tasks and requirements, and re-derived the plan's claims about the current code. The confidence is medium and not high because I read D-5 and D-6 (the test tables) only in part; the size of the package made a line-by-line read of every test row impractical.

## 2. Scope validation
Classification: correct. The problem (a release conflict ends the run blocked because the release step rebases and force-pushes, and the CI-pin assertion names a literal release) is stated once and traces to one retro item. Non-goals keep `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` untouched, which matches the CI-download constraint.

## 3. Proposal review
Why, what changes, the BREAKING note (the `push-rebased` step leaves the loop's JSON), the impact on the packs and the release numbers are all explicit. The dependency on `origin/main` (#59, devkit-openspec 0.21.1) is stated and made a task (1.1). No findings.

## 4. Design review
Claims re-derived against the live code at `8c8b7b8`:
- `release-rebase.mjs` exports (`bumpKind`, `applyBump`, `resolveVersion`, `resolveManifest`, `manifestEditsBeyondVersion`, `resolveChangelog`, `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `setPins`, `mergePins`, `classifyConflict`, `ReleaseError`, `main`) are at lines 17 to 244. Its `rebaseInProgress` is at line 187 and `restore` at line 238.
- `conduct-check.mjs`: the import at line 19, `SUBAGENT` at line 49, `RELEASE_REBASE` at line 354, `openPrOf` at line 357, `rewrittenBranch` at line 363, `threeVersions` at line 389 and `releaseConflict` at line 397. The `found.clean` branch matches the plan's description (it gives `update-branch` in merge mode without checking the PR head).
- `deliver-check.mjs`: item 5 returns `blocked` with `conflict: true` at line 642, before any head comparison. The archive path checks `conflicts` at line 1036 and 1043, before `headRel === 'ahead'` at line 1045. This confirms why the new `unpushedMerge` branch is needed.
- `change-loop.mjs:552` holds the `push-rebased` row. `SKILL.md` carries `resolve-release-conflict` and `push-rebased` in the places the plan names. The panel keeps `push-rebased` at `i18n.ts:182`, `steps.ts:133` and `report.test.tsx:702`, and the plan routes it to the retro.
- The stage orientation during a merge (`:2` the branch, `:3` the merged base) and the use of `checkout --theirs` for the base's side are correct for `git merge`.
- The CI-pin test block is at `change-loop.test.mjs:2478-2480`. The base is one commit behind `origin/main` (`c561553`), so `plugin.json` is 0.21.0 here and the 0.21.1, 0.25.1 and "Round 17h" references only exist after task 1.1 merges `origin/main`. Task 1.1 and its check cover this.
- Roadmap: the round 17e line the archive ticks exists (`openspec/roadmap.md:58`). "Round 17h" is on `origin/main` only (line 67 there), which task 1.1 brings in.

No failed re-derivation. Rollout and rollback are covered: a failed merge is aborted and restores the branch, and nothing is pushed by the tool.

## 5. Specs review
The delta has one MODIFIED requirement (full text, with scenarios for the release conflict, the unpushed merge, the foreign head, no force step) and one ADDED requirement with scenarios for each outcome of the tool (exit 0, 2, 3, nothing to do, merge left in progress). Each decision-table row in D-1 and D-2 (exit codes, stops, steps) has a scenario. No findings.

## 6. Tasks review
Ordered by dependency: 1.1 merge of the base, 1.2 rename, 1.3 test first with red proof, 1.4 the merge, 1.5 gate, then the loop, the docs, the release and the whole suite. The AC table maps AC-1 to AC-8 to tasks. Gates are one backticked command with `&&` parts and no `|`. Phase gates that already exist on the base were run here: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass, and `conduct-check.test.mjs` with `GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` passed 534 of 534 (11 min 40 s; the caller may want to note that task 1.5 and 2.5 are not marked as long). The whole-suite gate (3.3) is marked long and was not run, as the method allows.

## 7. Omission detection
Validation, error handling, side effects (no push), rollback (abort and restore), idempotency (a merge left in progress, the base already merged), compatibility with a branch an older version rebased (the new stop), and test strategy are all defined. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: the loop's `unpushedMerge` relies on `pr.headRefOid` being the PR head in the loop's state. Impact: a stale PR state hands a push for a head already pushed. Prevention: tests 8, 9 and 12 cover the positive and negative cases; the live check is AC-8.
2. Cause: `git commit` hooks or signing in a consumer project fail the merge commit. Impact: exit 2 and the run blocks. Prevention: the failure is reported and restored (D-1 step 12).
3. Cause: the 11-minute conduct-check suite as a per-phase gate. Impact: timeouts in a tool that caps foreground commands. Prevention: run it as a background command.
4. Cause: tasks 1.1 depends on `origin/main` being fetched by the coordinator. Impact: if absent, the 0.21.1 checks fail. Prevention: the task states the dependency and a check.
5. Cause: panel labels for `push-rebased` outlive the step. Impact: dead labels only. Prevention: recorded for the retro.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Task 1.5 and 2.5 run suites that take about 12 minutes here; mark them as long, as 3.3 is, so a foreground run does not time out.

## 11. Explicitly out of scope
- [ ] Dropping the panel's `push-rebased` label and its test (the plan proposes it for the panel's next change).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, with the PR #51 incident named.
2. Is the result measurable? Yes: AC-1 to AC-8, each with tests; AC-8 is the live check on a roadmap line.
3. Are error behaviors defined? Yes: exit 2 and 3, restore, the foreign-head stop.
4. Are edge cases covered? Yes: a merge left in progress, the base already held, a rebase in progress, an archive PR, auto-merge on.
5. Are dependencies clear? Yes: the merge of `origin/main` is task 1.1.
6. Are contracts defined? Yes: the CLI exit codes, the JSON and the step's command.
7. Can two developers interpret this differently? Unlikely; the design gives literal code for the helper and the override.
8. Are any decisions implicit instead of written? None found.
9. Do the tasks fully deliver the intended outcome? Yes, and AC-8 is stated as owed to a later change.
10. What will be discovered too late if implementation starts now? Whether consumer projects' commit hooks accept the tool's merge commit; the live check covers it.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Only the optional note: a long gate run in the foreground.
