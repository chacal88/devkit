Verdict: approved
Commit: 8120c98fb783d399254a3948250fcb644fa2d820

## Coverage analysis — change-state (d1c7fa4..8120c98, this change's own work)

In-scope surfaces: change-loop.mjs, roadmap-loop.mjs and their tests, plus ADR 0017 and the docs pinned by one test.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): the stand-in for a change with no folder, an archived change, state/next agreement, the action's state and sessionTitle, the silent wait in waitLoop and whereOf, the roadmap board rows and titles, the moved run-file reader and gateOf, and the S1-S8 precedence each map to a named test.

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs declaredEnd — The throw for a declared owner wait that names no gate has no test that I found; add one beside the AC-3 declared-wait test in change-loop.test.mjs.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:922 — The moved readRun parsing is exercised only by a concurrency test; this is inherited debt for the backlog.
- [praise] plugins/openspec/hooks/change-loop.test.mjs AC-1..AC-7 — Every seam the diff introduced (state command, next carrying state, silent-GitHub wait, board rows, S1-S8 precedence) has a named test that would go red if it broke.

### Well covered
- The state command's contract: JSON shape, language, no writes, no run marker, exit codes.
- The title forms for every state, including the 59-code-point cut.
- State and next agree for the same files and GitHub answers.
- A silent GitHub keeps its state across the plan, build and delivery stages.
- Roadmap session-per-change states, ready and waiting for a place.
