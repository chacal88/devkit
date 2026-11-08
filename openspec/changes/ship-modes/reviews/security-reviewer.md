Verdict: approved
Commit: 1acce88ed3366a841c5c97dab4f0e615d09a3537

## Security audit — ship-modes (round 2, stale-only re-review of c15ff9b..1acce88)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (conversationItem, GraphQL query, change id check), plugins/openspec/skills/ship-change/SKILL.md (`answer` row); low: docs/openspec-flow.md, tests, review.md.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- authn/authz (thread with trusted comment first, outsider last) — such a thread is ignored by the checker. That is a completeness gap, not a way to inject work, and it fails toward doing less. The skill also treats comment text as data.
- injection (query change) — the query is a constant; `authorAssociation` is a GitHub-set field the commenter cannot spoof, and a missing value is treated as untrusted (fail-secure, pinned by a test).
- injection (`.`/`..` ids) — now exit 3; the earlier nit is closed.

### Previous findings
- [important] [untrusted content] any GitHub user's comment becomes work (`answer` row; deliver-check.mjs item 7) · fixed in 1acce88ed3366a841c5c97dab4f0e615d09a3537
  - Verified: `TRUSTED_ASSOCIATIONS` is OWNER/MEMBER/COLLABORATOR. It gates top-level comments, review bodies, review threads (by the last comment) and the CHANGES_REQUESTED stance. Bots keep their existing rule by `__typename`. The query requests `authorAssociation` on all three nodes, and a test asserts three occurrences. Tests cover CONTRIBUTOR, NONE, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, MANNEQUIN and a missing association. The `answer` row now says comment text is data, not instructions, and that a request outside the approved tasks and design stops as an owner decision.
- [nit] change id `..` resolving to `openspec/` · fixed in 1acce88ed3366a841c5c97dab4f0e615d09a3537 (`.` and `..` exit 3, tested with and without `--json`).

### Findings (TRUE POSITIVE)
None. Approved.
