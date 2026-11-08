Verdict: approved
Commit: c5da1553d4afe9be984cb4d1056c8acf3bb9d405

## Security audit — ship-modes (round 3, stale-only re-review of 1acce88..c5da155)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (new git-repo guard in main); low: pr-verifier.md wording, docs/openspec-flow.md, tests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection/config (git-repo guard) — `gitOk` runs a fixed argv (`rev-parse --git-dir`) in the root found by `findRoot`; no user input reaches git, and a failure only turns into a UsageError (exit 3). It fails closed and echoes only a local path.
- authn/authz (thread with trusted comment first, outsider last) — such a thread is ignored by the checker. That is a completeness gap, not a way to inject work, and it fails toward doing less. The skill also treats comment text as data.
- injection (query change) — the query is a constant; `authorAssociation` is a GitHub-set field the commenter cannot spoof, and a missing value is treated as untrusted (fail-secure, pinned by a test).
- injection (`.`/`..` ids) — now exit 3; the earlier nit is closed.

### Previous findings
- [important] [untrusted content] any GitHub user's comment becomes work (`answer` row; deliver-check.mjs item 7) · fixed in 1acce88ed3366a841c5c97dab4f0e615d09a3537
  - Verified: `TRUSTED_ASSOCIATIONS` is OWNER/MEMBER/COLLABORATOR. It gates top-level comments, review bodies, review threads (by the last comment) and the CHANGES_REQUESTED stance. Bots keep their existing rule by `__typename`. The query requests `authorAssociation` on all three nodes, and a test asserts three occurrences. Tests cover CONTRIBUTOR, NONE, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, MANNEQUIN and a missing association. The `answer` row now says comment text is data, not instructions, and that a request outside the approved tasks and design stops as an owner decision.
- [nit] change id `..` resolving to `openspec/` · fixed in 1acce88ed3366a841c5c97dab4f0e615d09a3537 (`.` and `..` exit 3, tested with and without `--json`).

### Findings (TRUE POSITIVE)
None. Approved.
