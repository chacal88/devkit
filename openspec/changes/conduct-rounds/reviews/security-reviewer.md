Verdict: approved
Commit: 8f6f2bd747e0fb6eeadc6a67765d2b499b9f1793

## Security audit - conduct-rounds (round 1)

Triaged scope: high: plugins/openspec/hooks/guard.mjs, release-rebase.mjs, conduct-check.mjs (push-rebased, wakeOf), deliver-check.mjs (approvalState); medium: skills/conduct/SKILL.md, ship-change; low: docs, tests, manifests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Suite: not re-run (given: 530 pass).

Discarded false positives:
- injection, release-rebase: all git calls use spawnSync argv arrays (no shell). Paths passed to `checkout --ours -- p`, `add -- p`, `checkout HEAD -- written` are either conflicts filtered by RELEASE_FILE (release-rebase.mjs:222-227, fixed-shape names) or fixed names (:236-248); `--` precedes them, so no option injection. `--base` is only used as `origin/${base}` (:202), never a leading dash.
- injection, push-rebased: command is an argv array with `--force-with-lease=<branch>:<oldHead>` pinned to the PR's head sha (conduct-check.mjs:355-357); branch names cannot start with `-`. The lease form is the one GIT_RULES allows (guard.mjs:~287).
- injection, session cron: `--round` is validated `^\d+$` and range-checked (conduct-check.mjs:588, 528) before reaching the prompt (:502); prompt is otherwise a constant.
- authz, opt-in per target root: guardEdit (guard.mjs:340-342) and guardBash (:367-369) both require findRoot(target) AND optedIn(that root); a path in a linked worktree gets that worktree's change; a target outside any repo yields no root and is ignored (equal to the old behaviour, which also required a session root).
- authz, `approval.md` owner '' (guard.mjs:208, 220-223): only actor === '' (main session, no agent_type) passes; every subagent, including tdd-implementer and reviewers, is blocked on Write/Edit and on the heuristic Bash writes. The hash binding in approvalState (deliver-check.mjs:944-952) invalidates an approval after a new readiness round.
- crypto: sha256 truncated to 12 hex is an integrity/staleness marker, not a secret; no finding.
- secret/config/exposure: nothing committed; no env fail-open default added.
- release-rebase `gen-catalog.py` / `reset --keep`: runs the repo's own script on the user's own branch; no attacker-controlled input.

### Findings (TRUE POSITIVE)
None exploitable (no blocking).

- [important] [authz] guard.mjs:262-273 (pre-existing heuristic, widened) - the Bash write/PR gate is best effort and several shapes escape cwd/`cd` tracking: `(cd X && ...)` subshell, `pushd`, quoted `cd "X"`, `cd $VAR`, `git -C`, and a symlink created with `ln -s` then written through Edit (classify and findRoot are lexical, no realpath, :64, :197). A subagent can reach `approval.md` (and readiness/evidence/reviews, same pre-existing gap) that way. Not new in kind; the guard already says CI is the backstop. Follow-up: realpath the Edit target and treat any unresolvable `cd`/subshell as "unknown root, check the session root too".
- [important] [authz] guard.mjs:373-379 - regression from judging `gh pr create` by the `cd` target root: `cd /tmp && gh pr create -R owner/repo --head b` resolves to no root and skips prViolation, where before the session root's review/evidence gate applied. Deliberate evasion only, and CI still checks reviews. Follow-up: also run prViolation for the session root when the segment's dir has no root.
- [important] [authz] `approval.md` is "written from the owner's own message" only by SKILL.md instruction (skills/conduct/SKILL.md:42, 107); the hook cannot tell the main session acting on the owner's words from acting on its own. Inherent to ADR-0001 (no harness), and the staleness hash limits damage; recorded for awareness.

Out-of-round: none.
