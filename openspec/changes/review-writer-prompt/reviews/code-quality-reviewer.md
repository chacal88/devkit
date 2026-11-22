Verdict: approved
Commit: 83d74b4338fb0bce46595382c50068b816619472

## Quality review: review-writer-prompt (round 4, stale-only after the second rebase)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:fencedLines — An unclosed fence hid every later task and gate from the delivery checker, so item 1 could pass with unticked tasks. · fixed in 7719a34f391edf3f5cce36a46b328d636c3474a3
- [nit] plugins/openspec/hooks/deliver-check.mjs:staleness (dirtyPaths) — An uncommitted test-file edit still stales the four spared reviewers through facts.dirty; D-6 chooses this, but docs/openspec-flow.md does not say so.
- [nit] plugins/openspec/hooks/deliver-check.mjs:isTestFile — A folder named 'fixtures' or 'test' counts as test files even where it holds product data; D-6 declares a fixed pattern, so this is a known trade-off.
- [nit] plugins/openspec/hooks/flow-check.test.mjs: 'a commit of test files only after the review makes the review stage stale' — This test passes through the header staleness alone, so it does not exercise the new staleReviewers path; rename it or add a case with a current header.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs: AC-9 tests — No CRLF tasks.md case in the AC-9 tests.
- [nit] openspec/changes/review-writer-prompt/proposal.md and design.md — The release lines still say devkit-core goes '0.8.1 to 0.9.0', but main now has it at 0.8.2 (PR 57), so the starting version is stale. The target 0.9.0 is correct.
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:writeJobs — One writeJobs function feeds both the workflow and the CLI outcomes command, and the AC-1 test compares the two, so the paths cannot drift.
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:validateStage1 — The head, partial-review and header-line rules sit in the shared rules section and fail the review stage with a diagnosable message; the AC-4 and AC-5 tests run each case on the CLI and on the workflow.
- [praise] plugins/openspec/hooks/flow-check.mjs imports — The resolution keeps one reader of the stage header, now in guard.mjs, re-exported from flow-check, with this change's fencedLines and readReviews imported from deliver-check. Nothing is duplicated.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:'change-loop docs: the design records the answers' — The pin test requires v0.21.0 and allows only the 'v0.20.0 or later' slice-merge floor from PR 55. It also asserts that sentence is kept, so the resolution is pinned.

### Files read
I read these diffs in full, one path at a time, against fd7bd57:
- `plugins/openspec/hooks/flow-check.mjs`
- `plugins/core/skills/review-change/scripts/review-round.workflow.js`
- `plugins/openspec/hooks/change-loop.test.mjs`
- `docs/openspec-flow.md`
- `CHANGELOG.md`
- `.claude-plugin/marketplace.json`
- `plugins/core/.claude-plugin/plugin.json` (empty diff, version 0.9.0 confirmed)
- `plugins/openspec/.claude-plugin/plugin.json`
- `openspec/changes/review-writer-prompt/proposal.md`
- `openspec/changes/review-writer-prompt/design.md`
- `openspec/changes/review-writer-prompt/tasks.md`

I also read the range-diff output, my previous verdict file, and the exports in `guard.mjs` and `deliver-check.mjs`. No file of my remit is left unread.

### Checks
- Range-diff: commits 2 to 5 are identical across the rebase. Commit 1 differs only in the version numbers and in the reviewer prompt's last line. Commit 6 is the renumbering.
- `reviewerPrompt` keeps this change's wording (`read`/`notRead`, 'full sha') and appends main's finding-id line from PR 57. It has no duplicate clause, and its string concatenation is valid.
- In `flow-check.mjs`, `STAGE_HEADER` and `parseStageHeader` are imported from `guard.mjs` and re-exported. `fencedLines` and `readReviews` are still exported by `deliver-check.mjs`.
- The versions agree: devkit-core 0.9.0, devkit-openspec 0.21.0, marketplace 0.25.0 and pin v0.21.0, across `CHANGELOG.md`, `marketplace.json`, both `plugin.json` files, the flow doc and `tasks.md`.
- The `CHANGELOG.md` order is 0.25.0, then 0.24.1, then 0.24.0, with no duplicate heading.
- The guard suite was not run, as instructed.

### Summary
- 10 findings (0 blocking, 0 important open, 5 nit) + 4 praise; F1 fixed in 7719a34f391edf3f5cce36a46b328d636c3474a3.
- Justification: the second rebase merged main's PR 55 and PR 57 work with this change without changing either side's behavior, and the version and doc edits agree. The earlier findings stand unchanged, and the one new nit (F6) is cosmetic.
