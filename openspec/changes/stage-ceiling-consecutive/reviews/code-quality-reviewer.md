Verdict: approved
Commit: 849d5c70748ee4caba1fd2c26703aeb3b4418e6f

## Quality review — stage-ceiling-consecutive (round 2)

### Findings
- [praise] plugins/openspec/hooks/flow-check.mjs:181-225 — stageHistory/failuresInARow never throws, dedupes on attempt commit, so the review stage's restarted rounds count right; with no visible pass the count is max(attempt, failed).
- [praise] plugins/openspec/hooks/flow-check.mjs:336-339 and :534-538 — History is a lazy, memoised fact read only for a failed stage with a numeric ceiling; computeFlow stays pure; a spy test pins it.
- [praise] plugins/openspec/hooks/flow-check.test.mjs:2074-2260 — Tests build real git repositories (merges of main, shallow clones, uncommitted takes, no git on PATH) and cover H-3 to H-6, F-1 to F-4 and the ACs; red-before-fix proofs recorded.
- [nit] plugins/openspec/hooks/flow-check.mjs:535-537 — For a multi-file stage the history is read from the first failed file only; a pass in a sibling file is not seen (safe side, D-3); no test for it.
- [nit] plugins/openspec/hooks/flow-check.mjs:186-196 — git log has no cap and cat-file --batch reads whole blobs; on MAX_BUFFER the reader silently returns [] (today's rule). Optionally stop at the first passed header or cap with -n.
- [nit] plugins/openspec/hooks/flow-check.mjs:337 — join(relative(...)) yields backslashes on Windows, so the <sha>:./<rel> lookup would miss and return [] (today's rule). Optionally normalise to '/'.
- [nit] plugins/openspec/hooks/flow-check.mjs:219-224 — A failed take overwritten without a commit after a visible pass lowers the count (H-5); accepted by the plan and documented as 'commit each take'; watch in the field.
- [nit] plugins/openspec/hooks/change-loop.mjs:798 — The failures placeholder falls back to the attempt so a blocked end recorded before this release still renders; the fallback is now pinned by tests in the ceiling reply (both languages) and in both fix briefs (commit 2222180).
- [praise] openspec/changes/stage-ceiling-consecutive/evidence.md — Every AC carries real command output re-run at the merged head; the one AC with no proof says why.
- [praise] plugins/openspec/hooks/project-loop.test.mjs:1090-1106 — The new project-loop test builds a committed history (passed at attempt 1, failed at 2, uncommitted failed take at 3). It asserts the reply says (2) and not (3), so it fails if project-loop.mjs:173 stops forwarding failures, because the fallback would then render the attempt.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:2041-2044 — The fallback test for the plan brief and its sibling in change-loop-compozy.test.mjs cover only the brief text. They do not cover the project-loop path for a report that lacks failures. That is acceptable, since the fallback lives in change-loop render and in the briefs.

### Summary
- 11 findings: 0 blocking, 0 important, 6 nit (F4 to F8, F11) and 5 praise (F1, F2, F3, F9, F10).
- Justification: Round 2 covers commit 2222180 only: three tests, no product code. I checked each against the code it pins.
  - The project-loop test uses the existing helpers `header`, `put`, `commitAll` and `headOf2`. The `(N)` in `blocked-why.ceiling` is the `{failures}` placeholder (change-loop.mjs:385), so the assertion `(2)` and not `(3)` really tells failures in a row from the attempt (the attempt is 3, failures are 2, the ceiling is 2). `project-loop.mjs:173` forwards `failures`, so the test is red if that forwarding is dropped.
  - The two brief tests exercise the `?? attempt` fallback and the `failures: ${failures}` brief text. Their expected strings match `change-loop.mjs:1280` and `:1320`.
  - All five filtered tests pass in the foreground. I ran them with `node --test --test-name-pattern`, not `scripts/test-suite.mjs`. The whole suite is left to the delivery train, as instructed.
  - Every previous finding from round 1 is re-listed as it stood. The round-1 nits are unchanged because no product code changed. F8's fallback is now covered by the new tests, but its disposition stays open as an accepted nit.
- Verdict basis: no open blocking or important finding, so the verdict stays approved.
