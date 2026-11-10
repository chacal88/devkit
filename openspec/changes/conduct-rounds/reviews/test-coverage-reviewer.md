Verdict: approved
Commit: dd407bd

## Coverage analysis — conduct-rounds, round 2 (8f6f2bd..dd407bd)

In-scope surfaces: plugins/openspec/hooks (guard, conduct-check, deliver-check, release-rebase), skills/conduct, ADR 0005
Blocking gaps (8-10 without a plan): 0
Seams checked (read only, mutation runs: 0; suite result given by the caller: 534 tests, 0 fail):
- classify gate for approval.md in any change folder (guard.mjs:204) and the ambiguous branches (Edit guard.mjs:349-350, Bash guard.mjs:373-378) -> caught by guard.test.mjs "approval.md: main-session only even with several active changes or in another change folder (D7)": both fixtures (ambiguous root; branch feat writing other/approval.md), two subagents, Write and redirect, plus the main session allowed on both. Removing either new branch turns a code-2 assertion red.
- gh pr create after cd into a no-project dir falls back to sessionRoot (guard.mjs:387) -> caught by "gh pr create after cd to a directory with no project still meets the session root gate (D5)" (code 2 + /review not approved/).
- `conflict: true` field replacing the prose regex (deliver-check.mjs prItem, nextStep, archiveNext; conduct-check releaseConflict) -> caught by deliver-check.test.mjs item-5 conflict tests and conduct-check.test.mjs asserts `deliver.next.conflict === true` for both the change PR and the archive PR, and the resolve-release-conflict plans still depend on it.
- unknown step -> stop (conduct-check actorOf) -> caught by "a deliver-check step with no actor mapping stops the change" (actor, reason, blocked state, never dispatched) and the new `archived` / `wait-dependencies` -> none asserts.
- `--wake` prompt (wakeOf) -> caught by the two updated wake tests (with and without --round, and through state({round:2})); the skill clauses are pinned in guard.test.mjs and ADR 0005 test.
- release-rebase catch-all -> caught by "an invalid JSON manifest on the branch restores to oldHead with exit 2" (code, resolved false, HEAD == oldHead, clean status, no rebase-merge dir).

### Findings
- [important] [6] approval.md is not gated when the guard cannot name the active change · fixed in dd407bd
- [nit] follow-up (was important 5, re-tagged: it does not block this PR) Cron reconciliation and no-second-worktree are only regex-tested: cross-process flow, so real evidence is the right closure, not a unit test. The AC-13 `## Dogfood` in retro.md must show `CronList` after two consecutive runs and `git worktree list` after kill and resume; it is recorded in review.md (line 28). Not a blocker for this verdict, but archive must not happen without it.
- [nit] [4] Relative `file_path` with `input.cwd` untested (guard.mjs:340) · still open
- [nit] [4] approval.md via `sed -i`/`cp`/`mv`/`tee` from a subagent untested (only `>`) · still open
- [nit] [4] mtime freshness after a rebase of committed plan files untested (speculative) · still open
- [nit] [3] No test that every step deliver-check can emit is mapped in actorOf (the new "unknown step" fallback now fails safe to a stop, so a missed mapping blocks the change instead of being silently dropped; the existing table test at conduct-check.test.mjs:508 lists them by hand). · write in: conduct-check.test.mjs next to that test, deriving the step list from deliver-check.
- [nit] implementation-coupled: new `--wake` pins in guard.test.mjs assert long exact sentences of SKILL.md; keep to the load-bearing clauses.

### Well covered
- approval.md writer gate: now independent of the active-change resolution, both Write and shell, both denial and main-session allow.
- Conflict classification via a structured field: asserted on both change and archive paths, so a reworded reason no longer breaks release-conflict handling silently.
- release-rebase failure after replay restores the tree (HEAD, status, no rebase state).
