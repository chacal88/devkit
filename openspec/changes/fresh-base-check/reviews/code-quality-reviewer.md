Verdict: approved
Commit: 6c053994f35e0f0b873fb34923d4c8d28a811723

## Quality review — fresh-base-check (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1415-1439 — refreshBase is a single helper with a per-call memo keyed by git common dir plus base. It never throws, and a failure becomes data instead of a block. The refspec is explicit and writes no FETCH_HEAD.
- [praise] plugins/openspec/hooks/change-loop.mjs:2432-2441 — ownReply strips the failed-fetch line from the wait's decisionKey, so a failed fetch alone does not end a wait. Test 10 covers it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1421-1440 — `fetchBase` is documented as a `baseFetches()` record but typed as a bare truthy flag. Passing `true` would throw at `memo.has`. Guard it with `fetchBase instanceof Map` or rename it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1432 — `e.signal` of any kind is reported as 'timed out after N s'. Test `e.code === 'ETIMEDOUT'` or SIGTERM to keep the message honest.
- [nit] openspec/changes/fresh-base-check/proposal.md (Impact) — Impact says MERGE_CONFIG, MERGE_FILES and presetMerge are exported from conduct-check.test.mjs; the diff moved them to test-fixtures.mjs. It also lists docs/catalog.md as regenerated though the diff does not touch it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1421 — On a git older than 2.29, `--no-write-fetch-head` makes every fetch fail, so every action carries the 'unfetched' line; a one-line mention in the CHANGELOG or flow docs would help diagnosis.

### Summary
- 6 findings (0 blocking, 0 important, 4 nit) + 2 praise
- Every acceptance criterion maps to code and to a named test in the diff; the fetch runs only inside inDelivery; state, locks and status never fetch; a branch name cannot be read as a git option because the refspec starts with +refs/heads/.
