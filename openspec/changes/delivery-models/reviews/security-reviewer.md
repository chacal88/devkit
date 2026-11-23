Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## Security audit — delivery-models (round 3, stale-only re-review)

### Findings

Triaged scope: high: guard.mjs parseDevkitBlock (budget at its own level), deliver-check.mjs readReviews with verdictAllowed, change-loop.mjs shared parser; medium: change-loop routing and archive-branch handling; low: CHANGELOG, release bumps, docs, test fixtures.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- Config: `budget` is read only at the block's own indent, and a key nested under `delivery:` never sets driver, language or budget. Invalid values are refused, so it fails closed.
- Authz: `readReviews` uses `verdictAllowed` on the shared `verdictFiles`. A rejected or missing verdict goes stale after any commit outside the review record, so it is no weaker than before.
- Injection: the `archivedDates` and `unfinished` additions only compare ids and branch names, and every git and gh call passes argv with no shell.
- Secret and exposure: the release bumps and CHANGELOG add no credentials. The workflow template permissions were already judged read-only in the previous round.
- Crypto: nothing touched.

This review covered only this change's part of the merge, not main's own work. The previous approved verdict at 64ed99f stands, and no earlier finding was open.
