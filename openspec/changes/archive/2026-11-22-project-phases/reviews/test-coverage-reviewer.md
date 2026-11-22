Verdict: approved
Commit: 720e238153aec29e21583b8b7924a319000ff502

## Coverage analysis — project-phases, staleness re-review (5140a46..HEAD, merge 6d386bb)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs sliceProblems (Commit does not resolve) — [4] No test uses an ADR verdict that names a nonexistent sha; write it in project-loop.test.mjs next to the non-ancestor test.
- [nit] plugins/openspec/hooks/guard.mjs sliceProblems (no header / malformed header) — [4] No test sends a header-less or malformed slice record through the slice contract; only parseStageHeader unit tests cover it.
- [nit] plugins/openspec/hooks/guard.mjs sliceProblems and guardBash (no base ref) — [4] The fail-closed base-unavailable paths in CI and in the hook have no test.
- [nit] plugins/openspec/hooks/guard.mjs sliceProblems (verdict uncommitted marker) — [3] The parsed uncommitted flag on the ADR verdict Commit line is neither enforced nor pinned by a test.
- [praise] plugins/openspec/hooks/project-loop.test.mjs:383-393 — Roadmap deletion by a slice is pinned in both the CI and the gh pr create entries, asserting message and exit code 2.
- [nit] openspec/changes/project-phases/tasks.md:10,204-219; design.md:584-697 — [3] Plan documents still call this change's ADR 0014 after the renumbering to 0015; real files and tests use 0015.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, deliver-check.mjs, guard.mjs; node:test), SKILL.md, ADR 0015, version files.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): openChange -> openCheckout -> withOpenLock -> openUnderLock (lockSleep and prepare pass-through) caught by the change-loop lock and openCheckout tests; parseCommitLine re-export with touchedPaths caught by deliver-check.test.mjs:223-229 and the merge-staleness tests from line 316; ADR 0014 -> 0015 renumbering caught by project-loop.test.mjs:1721-1751; versions 0.20.0 / 0.24.0 / v0.20.0 pin consistent across plugin.json, marketplace.json, ship-entry.mjs and its test; SKILL.md Never list text not pinned by a test, inherited from before the merge.

Round-2 findings F1-F4 (four nits) remain open as listed. The suite result (1326 of 1326 pass) is reported by the caller, not re-run.

### Well covered
- First-parent merge staleness: both branches of touchedPaths pinned by the merge-staleness tests.
- Open lock through the shared openCheckout, with injected lockSleep.
- ADR 0015 consistency across the ADR, both Notes, amended ADRs 0010 and 0012, and the config ADRs line.
