<!-- devkit-stage review result=passed attempt=2 commit=1fdee51eb04cd8265f05149d6e827d0289aaacf8 -->
# Review: selective-tests-by-map-2, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 7b73555 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 7b73555 |
| code-quality-reviewer | rejected | 0 | 2 | 2 | 0 | 7b73555 |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 7b73555 |
| architecture-reviewer | rejected | 0 | 1 | 1 | 0 | 7b73555 |

Consensus: FAIL (round 1/2)

## Open findings
- spec-reviewer — [important] requirements.md AC-5 `base-merge-selective`; evidence.md AC-5 row; proof/base-merge.txt — Partial coverage: task 3.1's merge of origin/main was 'Already up to date', so no real base merge was run. AC-5 is proven only by the texts the loop reads (config.yaml `Test command:` and `Gates:`, CLAUDE.md) and by a selective run on the head. The loop actually asking for the selective run after a base merge is not shown. The plan flagged this as next-change dogfood, but evidence.md records the row as `pass`.
- code-quality-reviewer — [important] scripts/test-suite.mjs:254 — mapProblems (M5) walks the suite folders on disk with keep=() => true, so an untracked or git-ignored file such as a macOS .DS_Store makes every --own-files run refuse with '<path>: is not covered by the map'; reproduced on a git-archive copy of HEAD with a touched plugins/openspec/hooks/.DS_Store, mapProblems returned that one problem. Fix: skip dotfiles, or build the M5 list from git ls-files (falling back to the walk), and add a test with a stray untracked file.
- code-quality-reviewer — [important] plugins/openspec/hooks/release-note.test.mjs:893-945 (commit 02eb93ed) — A base test is edited and a new one added, yet proposal.md (Impact lists four test files), release.md (four tests), tasks.md and the design.md Pinned rules table never name release-note.test.mjs. The commit message says tasks.md was updated to match, but its only change is the 2.5 tick. The message does not name the invariant, layer and suite as CLAUDE.md requires. The new test is not named 'selective-tests-by-map-2 AC-<n> ' as tasks.md requires. Fix: state the edit in proposal.md Impact and tasks.md (2.2 or the Pinned rules table), naming the invariant 'the ADRs line keeps the two release-at-merge records linked', layer config text, suite release-note.test.mjs, and rename or justify the test name. Do not edit release.md, whose hash the approval holds.
- test-coverage-reviewer — [important] scripts/test-suite.mjs:480 — [5] stalenessBase(root, process.env) in selectOwn is untested: no test sets GITHUB_BASE_REF, so ignoring it or hard-coding main stays green, and a PR on a non-main base would select the wrong tests. Write in test-suite.test.mjs (T-20 style, second origin branch plus env GITHUB_BASE_REF).
- architecture-reviewer — [important] scripts/test-suite.mjs:466 — headBranch() re-implements deliver-check's exported currentBranch (which also honours DEVKIT_BRANCH) in the same function that already imports deliver-check; use the owner and drop the copy.

## Refuted by verification
None.

## Notes
- Path: agents (the turn that ran the round began with a background-task notice, not the owner's own message, so the Workflow path did not run).
- The first stage-1 answer of code-quality-reviewer listed paths in notRead and was refused by the round; its stage 1 ran once more and its second answer was used.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: selective-tests-by-map-2, round 2

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 1fdee51 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 1fdee51 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 1fdee51 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 1fdee51 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 1fdee51 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Path: agents (the turn that ran the round began with a background-task notice, not the owner's own message, so the Workflow path did not run).
- Round 2 re-checked only each reviewer's previous findings and the lines changed since 7b735556; every previous important finding was dispositioned fixed (30a7136f, 4ae8dd5d, 6ffbe2f2, 1fdee51e) and no verifier was needed.

## Next
Ready to ship.

