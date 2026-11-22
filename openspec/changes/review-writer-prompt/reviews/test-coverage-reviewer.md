Verdict: approved
Commit: 83d74b4338fb0bce46595382c50068b816619472

## Coverage analysis: review-writer-prompt, round 4 (stale-only re-review after the second rebase, 5745d87..HEAD)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs fencedLines — An unclosed fence in tasks.md hid every later task and gate. · fixed in 7719a34f391edf3f5cce36a46b328d636c3474a3
- [nit] review-round.test.mjs AC-1/AC-3/AC-4 — Exact-prose tests are fragile to rewording; they guard a documented contract.
- [nit] review-round.test.mjs 'a file written from the writer prompt...' — The title overstates it: the file is built by the writeVerdictFile helper from the outcome, not from the writer prompt.
- [nit] openspec/changes/review-writer-prompt/evidence.md gate 2.5 — The standalone run of the two hook test files left no output; the proof is indirect, through the guard suite.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs AC-8 merge test — Pins the first-parent rule combined with the test-file sparing: stale without allowed, current with it.

In-scope surfaces: plugins/openspec/hooks (flow-check.mjs imports, change-loop.test.mjs pin), plugins/core review-round workflow prompt, version and pin files, docs/openspec-flow.md.
Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- Import resolution in flow-check.mjs (main's STAGE_HEADER and parseStageHeader re-exported from guard.mjs, beside this change's fencedLines and readReviews imports): a wrong or missing import fails on module load, so every test that imports flow-check goes red, as does the guard suite. The undeclared-stage text is main's and belongs to other changes.
- reviewerPrompt keeps this change's wording with main's finding-id line appended: caught by the AC-1/AC-3/AC-4 exact-prose tests. No test pins the new 'Finding ids are F1, F2...' sentence; it is main's PR 57 text, so it is inherited, not a gap of this change.
- Pin v0.21.0 in the flow doc: the change-loop docs test requires v0.21.0, refuses any other v0.20.0 line except the 'or later' floor, pins that floor sentence, and keeps the v0.19.x and v0.18.x refusals. Doc lines 578, 579, 586 and 588 match.
- Version consistency: devkit-openspec 0.21.0 in marketplace.json and plugin.json, marketplace 0.25.0 and the CHANGELOG 0.25.0 entry agree. The core plugin.json is unchanged against fd7bd57, so devkit-core 0.9.0 was already in place.

Well covered:
- The pin and version bump to v0.21.0, with the stale-pin refusals and main's floor sentence.
- The first-parent merge staleness rule combined with the test-file sparing (AC-8 merge test).
- The unclosed-fence rule, through the helper and every consumer.

Files read: the full git diff fd7bd57..HEAD for flow-check.mjs, review-round.workflow.js, change-loop.test.mjs, marketplace.json, plugins/openspec/.claude-plugin/plugin.json and plugins/core/.claude-plugin/plugin.json; a grep of docs/openspec-flow.md and CHANGELOG.md for the pins and versions; my previous verdict file. Not read as full diffs: docs/openspec-flow.md, CHANGELOG.md, proposal.md, design.md and tasks.md, only the grep output for the flow doc and CHANGELOG; those are prose and version bookkeeping outside the test remit, and their pins are covered by the change-loop docs test. I ran no tests and relied on the green guard suite recorded in evidence.md.
