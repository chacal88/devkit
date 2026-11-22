Verdict: approved
Commit: afdf4ec67167819eb94db6cc9ad7ce70a84caf0a

## Coverage analysis — release-merge-conflict (origin/main...HEAD)

### Findings
- [praise] plugins/openspec/hooks/conduct-check.mjs:364 / conduct-check.test.mjs release-merge-conflict 8-11 — The unpushedMerge predicate has one test per condition (head equal, base not ancestor, PR head not ancestor), including the no-force assertion on the push command.
- [praise] plugins/openspec/hooks/release-merge.test.mjs:565-654 — End-to-end git fixtures cover the resolve and abort paths: tree restored to oldHead, untracked and unstaged files preserved, generator failure rolled back, exit codes 2 and 3.

In-scope surfaces: plugins/openspec hooks (release-merge, conduct-check, change-loop, guard aggregator); docs and manifests are not test-relevant.
Blocking gaps (8-10 without a plan): 0
Seams checked: unpushedMerge callsite -> caught by conduct-check tests 8-11; push-rebased row removal -> caught by the rewritten conduct-check and change-loop tests (a stale reference not confirmed); release-merge rename import in conduct-check -> caught by the pin classifyConflict tests; guard.test.mjs aggregator import of release-merge.test.mjs -> present, a wrong path fails on a missing module; resolve/abort flow -> caught by release-merge tests 177-654 (mutation runs: 0)

### Well covered
- Unpushed release merge: plain push, no --force, one test per predicate condition.
- Release-file renumbering and pins: the unit tests plus the real docs/openspec-flow.md pin lines.
- Abort and restore: tree back at oldHead, untracked and unstaged files kept, generator failure rolled back, setup errors exit 3.
