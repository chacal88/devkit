Verdict: approved
Commit: c2bbad6284c3b7deaae46cf61359ffed97264558

## Coverage analysis: post-merge-validate (stale-review refresh after the merge of origin/main, 7f9624e..HEAD)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:2739 — buildView did not list merge-check in COMMAND_STEPS, so under next --view compozy it became a coordinator hand-off; now covered by the compozy view test (change-loop-compozy.test.mjs:1651), which goes red if merge-check is removed from the list. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1653 — The 4000-character cap on the errors text was untested; the new test asserts length 4000, the ellipsis and the recorded text. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1371-1372 — A red at the ceiling with a different fingerprint should offer merge-check again; the new assertion goes red if the fingerprint match is ignored. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2261 — implementation-coupled: PMV_CHECK_BEFORE copies the production CHECK_BEFORE list; left open on purpose.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2464-2490 — String-coupled doc tests assert long literal sentences (project convention); left open on purpose.
- [nit] plugins/openspec/hooks/change-loop.mjs:1373 — The merge-defect brief and the planner's finish condition said `openspec validate <id> --strict` without --type change; the brief now names --type change, pinned by the pure brief test and a count of two in the end-to-end next test. · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [nit] plugins/core/agents/change-planner.md:33 — Inherited, backlog: the planner, plan-readiness-reviewer and openspec-validator agent texts (and compozy templates) still say `openspec validate <id> --strict` without --type change; not a gap of this change.
- [praise] plugins/openspec/hooks/change-loop.test.mjs (same-name test) — The same-name regression test runs the real loop command against a real openspec and covers green and red; removing --type change turns it red.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:1651 — The compozy view test pins kind, empty agent/brief/question, step, progress_key and the loop's own argv for merge-check.
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:820 — The change-state blocked-reason test gains merge-defect and merge-check-failed cases built from the real decide output, so each reason's phrase and details are pinned.

In-scope surfaces: plugins/openspec hooks (change-loop.mjs and its tests and fixtures), docs/openspec-flow.md, the ADR 0017 Note, release files.

Blocking gaps (8-10 without a plan): 0

Post-merge re-check: `git diff 7f9624e..HEAD` over change-loop.mjs, change-loop.test.mjs, change-loop-fixtures.mjs and change-loop-remote-state.test.mjs is empty. The conflict resolution in change-loop-compozy.test.mjs took main's form: the pin test reads the version from plugin.json and requires at least 3 pins; docs/openspec-flow.md pins v0.41.0 and plugin.json holds 0.41.0. Tests run in the foreground and passing: 21 post-merge-validate tests; the compozy merge-check view test, the pin/CI snippet tests and the change-state blocked-reason test (18 tests). Mutation runs: 0 in this round (the earlier scratch mutations stand; the code is unchanged).
