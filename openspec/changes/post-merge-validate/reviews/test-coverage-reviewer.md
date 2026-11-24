Verdict: approved
Commit: 7f9624e3d9f70fe680520528fd76ab79fd8cdf95

## Coverage analysis: post-merge-validate (round 2 of 2, 369bbac..HEAD)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:2739 — buildView did not list merge-check in COMMAND_STEPS, so under next --view compozy it became a coordinator hand-off; now covered by the compozy view test (goes red if merge-check is removed from the list). · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1653 — The 4000-character cap on the errors text was untested; the new test asserts length 4000, the ellipsis and the recorded text. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1371-1372 — A red at the ceiling with a different fingerprint should offer merge-check again; the new assertion goes red if the fingerprint match is ignored. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2261 — implementation-coupled: PMV_CHECK_BEFORE copies the production CHECK_BEFORE list; left open on purpose.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2464-2490 — String-coupled doc tests assert long literal sentences (project convention); left open on purpose.
- [nit] plugins/openspec/hooks/change-loop.mjs:1373 — The merge-defect brief and the planner's finish condition said `openspec validate <id> --strict` without --type change and the test pinned the same literal; the brief now names --type change, pinned by the pure brief test and a count of two in the end-to-end next test (verified red by scratch mutation). · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [praise] plugins/openspec/hooks/change-loop.test.mjs (same-name test) — The same-name regression test runs the real loop command against a real openspec and covers green and red; removing --type change turns it red.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:1680 — The compozy view test pins kind, empty agent/brief/question, step, progress_key and the loop's own argv for merge-check.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2419 — The new count assertion in the end-to-end next test requires both brief sentences to carry --type change, so reverting either one alone goes red.
- [nit] plugins/core/agents/change-planner.md:33 — Inherited, backlog: the planner, plan-readiness-reviewer and openspec-validator agent texts (and compozy templates) still say `openspec validate <id> --strict` without --type change, so a same-name change could hit the ambiguity there; not a gap of this change.

In-scope surfaces: plugins/openspec hooks (change-loop.mjs, change-loop.test.mjs), docs/openspec-flow.md, openspec/roadmap.md and the change's spec delta.
Blocking gaps (8-10 without a plan): 0

Seams checked: the planner brief wording is caught by the pure brief test (change-loop.test.mjs:2332) and by the new count assertion (change-loop.test.mjs:2419); the flow sentence by :2509 and the roadmap line by :2518. One mutation on a scratch copy outside the repository (both brief occurrences reverted to the bare command) turned two tests red. Tests run: 21 post-merge-validate tests pass.
