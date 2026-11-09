Verdict: approved
Commit: 1286cfb50d6b8269bf6eea653be6bdc52fbc5f96

## Security audit - archive-after-merge (round 3, scoped to d50ffb1..HEAD)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (archiveNext open-PR branch); low: deliver-check.test.mjs, guard.test.mjs, docs/ADR/review files.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection - the new reason strings interpolate `pr.number` (a number from `gh pr list` JSON) and `state.id`; they are returned as data and never reach a shell or path.
- authz (`a.local` values other than `archived`) - any value other than `archived` now stops, so no unexpected local state falls through to a pass.
- Suite was not re-run, per the caller: green at 1286cfb, 381/381. The new test was read, not executed.

### Findings (TRUE POSITIVE)
- [blocking] [authz] deliver-check.mjs archiveNext (open-PR branch) vs the missing file check · fixed in d50ffb1. Verified in round 2.
- [important] [authz] unnamedFiles exempted all of `openspec/` · fixed in d50ffb1. Verified in round 2.
- [important] [authz] open archive PR with the folder not archived locally skipped the local check and could reach `enable-auto-merge` · fixed in 1286cfb. Verified in the source: with the PR OPEN, `held` is now always set. `a.local !== 'archived'` gives `stop-archive` (archive). An unreadable retro gives `stop-archive` (retro). Otherwise `held` is `answersStop()` or `filesStop()`. The `disable-auto-merge` branch comes first when auto-merge is on and `held` is truthy, and `if (held) return held` comes before the conflicts, headRel, `update-branch` and `enable-auto-merge` rows. No path reaches `enable-auto-merge` or `wait-merge` without the check. The new P3j test covers both cases (folder still active locally, unreadable retro). For each it asserts the stop, a CLI exit code of 2, `disable-auto-merge` when auto-merge is on, and no merge calls.

No new findings in the range.
