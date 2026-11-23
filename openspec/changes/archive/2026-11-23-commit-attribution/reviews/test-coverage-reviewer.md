Verdict: approved
Commit: 86361456ab393882cecf4a1a721905b050f4e253

## Coverage analysis — commit-attribution (re-review, 16eee42..8636145)

### Findings
- [important] plugins/core/agents/commit-and-pr.md (Attribution); proof/ac3-none-*, proof/ac3-pr-* — Agent behaviour with `none` and with a PR footer had no real-run proof; only string-includes tests existed. · fixed in 16eee42c701ec79197e5af5aa57cad84867e9a95
- [important] plugins/openspec/skills/ship-change/SKILL.md; plugins/openspec/hooks/change-loop.mjs:511-513 — No observation that a real dispatch prompt for `commit` and `open-pr` ends with the block. · fixed in 16eee42c701ec79197e5af5aa57cad84867e9a95
- [nit] plugins/openspec/hooks/change-loop.test.mjs (roadmap scenario) — The 'roadmap run hands the brief unchanged' scenario still has no test of its own; the loop code is shared, so the risk is low.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs T27-T32, T36 — These tests assert exact prose substrings of Markdown files, so a harmless rewording turns them red; they work as a drift guard, not as behaviour tests.
- [nit] openspec/changes/commit-attribution/evidence.md — The evidence file did not list the new AC-3 proof files; now restamped at 39fc410 and it lists them. · fixed in 86361456ab393882cecf4a1a721905b050f4e253
- [praise] plugins/openspec/hooks/change-loop.test.mjs T1-T15, project-loop.test.mjs T21-T25 — The seam is tested end to end through build and act; every commit step is checked, the request appears once, and the negative cases are covered.

In-scope surfaces: plugins/openspec hooks (change-loop, project-loop), the commit-and-pr agent, the devkit and ship-change skills, and the change's proof folder.
Blocking gaps (8-10 without a plan): 0

Seams checked:
- `withAttribution` in `agent()` of change-loop.mjs: caught by the T1-T15 tests in change-loop.test.mjs.
- `withAttribution` in `agent()` of project-loop.mjs: caught by T21-T25 in project-loop.test.mjs.
- The commit agent honours `none`, a trailer and the PR footer: caught by the real-run proof (ac3-none-*, ac3-pr-*, ac3-loop-*).
- The merge conflict resolution: `COMMIT_AGENT` is imported in project-loop.mjs and used in both loops; the whole suite passed at the merged head per evidence.md.
- Mutation runs: 0.

Reading note: there was no change of this change's own after 16eee42; the merges of origin/main left change-loop.mjs and project-loop.mjs as the net diff shows them. I did not re-run the suite; I took the 1568-test pass from evidence.md, which cites the coordinating session's log.

### Well covered
- The brief of every hand-off to the commit agent ends with the attribution request, once (T1-T15, T21-T25).
- A real dispatch carries the block through the loop action, the Agent prompt, the commit message and the PR body (proof/ac3-loop-*).
