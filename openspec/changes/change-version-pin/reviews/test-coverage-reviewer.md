Verdict: approved
Commit: df7cfaccdb7a1bf755959dc95629713fcbbbe4b1

## Coverage analysis — change-version-pin (043b8e0..df7cfac, scoped re-review)

### Findings
- [nit] plugins/openspec/hooks/version-pin.test.mjs:356 — Previous nit, still open: no test asserts the 'Flow:' readout line or the second resume line for an unpinned change with installed flow 2; write in version-pin.test.mjs beside AC-4 'after the upgrade' using shared({ pin: null, to2: true, stages: PLAN_V1 }).
- [nit] plugins/openspec/hooks/change-loop.mjs:1823 — Previous nit, still open: the flow command is tested only on pinned changes; dropping `?? 1` in moveFlow would give an unpinned change at installed 1 a pin and stay green. Add an AC-6 flow case on shared({ pin: null }) asserting pinOf before and after.
- [nit] plugins/openspec/hooks/conduct-check.mjs:250 and :459 — Previous nit, still open: a change opened with a raw `openspec new change` has no pin and follows flow 1 after the upgrade; neither a test nor docs/openspec-flow.md states it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1572 — New seam from the merge resolution: a Jira task that resumes its own change now passes own.root to resume(), so the flow-newer line shows there too. No test covers it: version-pin AC-5 uses the 'change feat' path and the task tests do not set a pin. Dropping own.root at :1572 stays green. Write in version-pin.test.mjs beside AC-5 using start with a task on stdin over shared({ pin: 1, to2: true }) whose requirements record the task key.
- [praise] plugins/openspec/hooks/version-pin.test.mjs:219 — The CI fix is a sound test. It points TMPDIR at a tmpFolder, restores it in a finally block, and asserts the exact refusal file name inside that folder, so breaking the stop decision or its record turns it red.

In-scope surfaces: hooks under plugins/openspec (change-loop, deliver-check, guard, flow-check, conduct-check, roadmap-loop), the version-pin tests, openspec-setup skill, docs and manifests.

Blocking gaps (8-10 without a plan): 0

Seams checked: stop-lock refusal recorded under a test-owned TMPDIR -> caught by 'version-pin AC-2 locks: a version-1 readiness reviewer delivers before it stops' (ran green); flow-newer line on resume via `start` -> caught by 'version-pin AC-5 resume' in en and pt-BR; the `flow <id>` command wiring (USAGE, runFlow, main dispatch) -> caught by the AC-6 flow cases; deliver-check `changeDeclares(root, changeDir, 'readiness')` replacing main's `schemaHasArtifact` -> exercised by the deliver-check tests and the AC-2/AC-4 ci readers, reported green in evidence on the merged base; task-resume `own.root` argument -> gap (F4). Mutation runs: 0.

Previous round (043b8e0): approved with three nits. All three are re-listed above as F1 to F3 and still open; none was addressed in this range (the range touched no test for them).

Merge resolution check against main: change-loop.mjs keeps main's task, write-back and state forms, main's imports (parseDevkitBlock, deliverySettings, releaseTagSetting, readRoadmap) and this change's changeFlow, readFlow, readPin and `flow` command. The USAGE string carries both. The change-loop.test.mjs resolution is one line (SAMPLE `version: 1` beside main's keys). I ran the 50 `task` tests of change-loop.test.mjs for main's Jira path, all green. The renumbering to devkit-openspec 0.31.0 / marketplace 0.35.0 is carried by the docs invariant in change-loop.test.mjs, per merge-notes. No test of main's was removed or weakened.

No test-that-tests-the-mock and no impossible fixture in the new range. The tmpFolder fix replaces a leak into the shared temporary root with an isolated one, and it does not weaken the assertion.

The verdict stays the same: no blocking and no important gap, four nits.
