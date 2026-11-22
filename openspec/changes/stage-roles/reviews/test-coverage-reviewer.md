Verdict: rejected
Commit: db34efd887c7e8f8eb2cda8411708d611fe3c774

## Coverage analysis: stage-roles (2300f84..db34efd)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs readRecord/acceptDecisions — Containment check is lexical (no realpath): a symlinked record in an adr folder pointing outside the repo passes and is rewritten; no test covers it (write in change-loop.test.mjs with the accept-decisions refusal tests).
- [nit] plugins/openspec/hooks/change-loop.mjs acceptDecisions write loop — Records are written one by one after full validation; a write error mid-way leaves a partial result and no test covers it.
- [nit] plugins/openspec/hooks/guard.mjs isTestFile — Heuristic name match has no negative case for a product file under a spec-like name; consider pinning one in guard.test.mjs.

In-scope surfaces: plugins/openspec/hooks (change-loop, flow-check, guard, conduct-check and their tests), plugins/compozy setup templates, plugins/core agents and skills (covered by file-content tests in change-loop.test.mjs). Static reading only; no suite or mutation run.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): decide() precedence of the accept-decisions step; nextAction feeding facts.tests and facts.decisions into decide; testStageStep ahead of the delivery row; guard.mjs writeViolation for adr-author and e2e-tester; conduct-check planArtifactsOf(appliesWhen, notAfter); UNDELIVERED gains owner-changes; readDevkitSettings appends coverage-target problems to unknown. Each is caught by a named test in the hook suites.

### Well covered
- Flow declaration and rules (appliesWhen, notAfter, ceiling, no shipped key).
- Owner mock-up loop: no ceiling at attempts 3 and 40, no-progress rule, readout in both languages, waiting-mockup.
- accept-decisions command: letter case, already-accepted, empty list, missing or stale approval, bad paths, bad status, atomic refusal, usage line.
- readTestSettings: nested block, comments and quoting, key outside the block, null values, target 0-100, empty value.
- Role shells, agent frontmatter and Never lists, gate rows: content tests; loop-template and role-shells tests cover the compozy side.
