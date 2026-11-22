Verdict: approved
Commit: afdf4ec67167819eb94db6cc9ad7ce70a84caf0a

## Quality review — release-merge-conflict (round 1)

### Findings
- [praise] plugins/openspec/hooks/conduct-check.mjs:362 — unpushedMerge requires both origin/<base> and the PR head to be ancestors of HEAD before handing a plain push; a foreign head stops with a 'not in local history' message, and the archive variant has a test for that case.
- [praise] plugins/openspec/hooks/release-merge.mjs:276 — A failure after the merge starts is caught and the tree restored. The force-push and the push-rebased step are removed from the hook, the skill and the flow doc, with no stale references left outside the archive and the change folder.
- [praise] plugins/openspec/hooks/release-merge.test.mjs:565 — The release-merge-conflict tests 1 to 7 cover the main path and the edges: abort restores untracked and unstaged files, a tracked change outside openspec/ stops the run, a rebase in progress, a generator failure, and a branch that already holds the base. The conduct-check tests (12, 13) cover the archive push, the foreign head and auto-merge being switched off first.
- [praise] docs/openspec-flow.md (CI pin test) — The CI-pin assertion now reads the version from plugin.json (pinMismatches) instead of a growing list of doesNotMatch versions, so it no longer needs editing on every release.
- [nit] plugins/openspec/hooks/release-merge.mjs:213 — rebaseInProgress is the only remaining rebase mention in the module. It is correct to keep, since a merge during a rebase would corrupt it, but a one-line comment saying why would help readers of the rename.

### Summary
- 5 findings (0 blocking, 0 important, 1 nit) + 4 praise
- Justification: I reviewed the rewrite of release-merge.mjs (merge instead of rebase, abort restores the tree, commit with no push). I also reviewed the conduct-check override, where unpushedMerge with ancestor guards replaces rewrittenBranch, and the removal of the push-rebased row in change-loop and the skill. The test diffs follow the new behaviour: the rebase-state tests are replaced by merge-state tests, and the rename is wired into guard.test.mjs. Docs, CHANGELOG and version bumps agree (0.26.0 and 0.22.0). The long suites were not re-run per instruction; their green results at cfd8999 are recorded in evidence.md, and HEAD only adds that file. The acceptance demonstration is the recorded proof and live-merge files plus that evidence, not a fresh run.
