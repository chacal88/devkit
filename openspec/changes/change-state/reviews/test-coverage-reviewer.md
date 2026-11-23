Verdict: approved
Commit: 9a76a1f2241bd3d67af5fbd143b68ead5070eb7e

## Coverage analysis — change-state re-review (c8a9f5c..9a76a1f)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:612 declaredEnd — The throw for a declared owner wait that names no gate still has no test; add one beside the AC-3 declared-wait test in change-loop.test.mjs.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:922 — The moved readRun parsing is exercised only by a concurrency test; this is inherited debt for the backlog.
- [praise] plugins/openspec/hooks/change-loop.test.mjs AC-1..AC-7 — Every seam the diff introduced has a named test that would go red if it broke, and the subtests are awaited.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2484-2487 — The release pin test expects v0.24.0 and refuses v0.23.0, v0.22.1 and v0.22.0, so a stale pin in the flow doc goes red.

In-scope surfaces: change-loop.mjs, roadmap-loop.mjs, their tests, and the release pin in docs/openspec-flow.md.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): the seams are unchanged from the previous round. The merge of main's commit-attribution (#68) and this change's release renumbering to 0.24.0 / 0.28.0 add no production seam of this change. The only new assertions are the pin ones, which are covered by F4.

### Well covered
- Release pin: a stale pin in docs/openspec-flow.md fails the 'change-loop docs: the design records the answers' test.
- Awaited subtests: a failure inside S1-S8 and the AC-3 groups reaches the parent test.
- Suite result given by the caller (1712 pass at c6e5c1b, CI check passed) was not re-run.
