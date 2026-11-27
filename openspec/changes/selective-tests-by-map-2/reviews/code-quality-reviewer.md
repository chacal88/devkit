Verdict: rejected
Commit: 7b7355566114e74e8a61ed712bb6227c8c5cdc34

## Quality review — selective-tests-by-map-2 (round 1)

### Findings
- [important] scripts/test-suite.mjs:254 — mapProblems (M5) walks the suite folders on disk with keep=() => true, so an untracked or git-ignored file such as a macOS .DS_Store makes every --own-files run refuse with '<path>: is not covered by the map'; reproduced on a git-archive copy of HEAD with a touched plugins/openspec/hooks/.DS_Store, mapProblems returned that one problem. Fix: skip dotfiles, or build the M5 list from git ls-files (falling back to the walk), and add a test with a stray untracked file.
- [important] plugins/openspec/hooks/release-note.test.mjs:893-945 (commit 02eb93ed) — A base test is edited and a new one added, yet proposal.md (Impact lists four test files), release.md (four tests), tasks.md and the design.md Pinned rules table never name release-note.test.mjs. The commit message says tasks.md was updated to match, but its only change is the 2.5 tick. The message does not name the invariant, layer and suite as CLAUDE.md requires. The new test is not named 'selective-tests-by-map-2 AC-<n> ' as tasks.md requires. Fix: state the edit in proposal.md Impact and tasks.md (2.2 or the Pinned rules table), naming the invariant 'the ADRs line keeps the two release-at-merge records linked', layer config text, suite release-note.test.mjs, and rename or justify the test name. Do not edit release.md, whose hash the approval holds.
- [nit] scripts/test-suite.mjs:127-128 — coveringKey(map.files, path) is computed twice for the same path in S4; compute once into a const.
- [praise] plugins/openspec/hooks/deliver-check.mjs:348-373 — ownDiffPaths is the one git command shared by ownFiles and branchOwnPaths. The staleness rule and the test selection cannot drift, and every why path fails safe to the whole suite.
- [praise] plugins/openspec/hooks/test-suite.test.mjs (tree(), BLANK_ENV, T-1 to T-26) — Each selection rule S1 to S7 and each map problem M1 to M7 has its own positive and negative test. The end-to-end tests run in real git trees with the CI branch variables blanked, so they cannot leak the CI environment.
- [praise] openspec/changes/selective-tests-by-map-2/evidence.md — The evidence separates what it proves from what it only reads: AC-5 and AC-6 are next-change dogfood, AC-7's CI half is a workflow follow-up, and the case files were not re-run by the verifier. The selective gate row is recorded as such, not as a whole-suite pass.

### Summary
- 6 findings (0 blocking, 2 important, 1 nit) + 3 praise
- Justification: the whole diff was read; the selection logic (S1 to S7), the fail-safe paths, the train-branch rule and the CI merged-ref reasoning hold up. The AC-8 counts reconcile. Open important findings F1 and F2 mean the round cannot be approved yet.
