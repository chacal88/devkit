Verdict: approved
Commit: 9cd32659aef800f1eaf373694e15030cdd141bff

## Security audit - conduct-rounds (round 2, stale-only re-review at 9cd3265)

Triaged scope: high: plugins/openspec/hooks/guard.mjs (classify, guardEdit, guardBash), conduct-check.mjs (wakeOf, actorOf), deliver-check.mjs (conflict flag), release-rebase.mjs (catch); medium: skills/conduct/SKILL.md, ADR 0005, docs.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Suite: not re-run (given: 534 pass).

### Previous findings
- [important] [authz] pre-existing Bash write-guard escapes (subshell cd, pushd, git -C, symlinks) · refuted: unchanged heuristic, out of scope, CI is the backstop, recorded as follow-up in review.md. Stays a follow-up, not a regression.
- [important] [authz] `cd /tmp && gh pr create` skipped prViolation · fixed in dd407bd (guard.mjs:387 `findRoot(dir) ?? sessionRoot`; test added).
- [important] [authz] approval.md owner-message rule is skill text only · refuted: inherent to ADR 0001 (no harness); the staleness hash limits damage. Unchanged.

### New in dd407bd
- approval.md gate (guard.mjs:204-205, 222-225, 349-351, 373-378): matches `openspec/changes/<any>/approval.md` (4 path parts) for any active change, and on the ambiguous-change path in both Edit and Bash. Only actor === '' passes; any subagent is blocked. `{name: null}` is safe: classify returns before using the name for this kind. Strictly tightens; no bypass introduced.
- --wake marker (conduct-check.mjs wakeOf): prompt is a constant, or built from a validated `^\d+$` round; no injection. The "not an owner message" rule is skill text, same class as the owner-message finding (ADR 0001); it fails safe (a cron run only does less).
- release-rebase catch-all: now unresolved() for any error, leaving the tree as found; fail-secure, no data exposure beyond e.message to the local console.
- deliver-check `conflict: true` flag replaces regex on reason text; removes a string-matching fragility, no new input.
- actorOf unknown step -> stop: fail-closed.

Discarded false positives: none new.

### Changed since dd407bd (merge of origin/main, 9cd3265)
- No hook code changed (guard.mjs, conduct-check, deliver-check, release-rebase untouched); only guard.test.mjs assertions on the migration doc.
- docs/migrate-to-project-scope.md: `cp -n` plus temp file and `mv`, `mktemp -d` for the marketplace removal; operates on the owner's own files, no untrusted input, safer than before (first backup kept, no truncated write). No finding.
- tdd-implementer.md: new rule forbids pkill/killall by pattern; strictly tightens.
- schema Request line and templates: text only. Version bumps: metadata.
- Previous findings and dispositions unchanged.

### Findings (TRUE POSITIVE)
None. Follow-up only (not blocking): realpath/subshell hardening of the Bash write guard.

Out-of-round: none.
