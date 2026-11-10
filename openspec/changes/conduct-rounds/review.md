# Review: conduct-rounds

Round 1, range 12aa99e..8f6f2bd. Structural: PASS (`openspec validate conduct-rounds --strict`).
Suite given to reviewers (not re-run): 530 tests, 0 fail; check.py, catalog, plugin validate green.

| Reviewer | Verdict | Blocking | Important |
|---|---|---|---|
| adr-reviewer | PASS | 0 | 1 |
| code-quality-reviewer | FAIL | 0 | 1 |
| test-coverage-reviewer | PASS | 0 | 2 |
| security-reviewer | PASS | 0 | 3 |
| architecture-reviewer | PASS | 0 | 4 |

Consensus: FAIL (round 1/2): code-quality-reviewer's open important finding.

## Blockers
- code-quality-reviewer — plugins/openspec/hooks/release-rebase.mjs:258 — non-`ReleaseError` failures after the rebase are rethrown: no restore, exit 1 instead of 0/2/3.

## Fixed in the same round (important findings of approving reviewers)
- adr-reviewer — conduct SKILL.md Start 4: a cron-started run must not count as the `devkit-lite` go-ahead.
- test-coverage-reviewer 1 — `approval.md` writable by a subagent when the active change is ambiguous or for another change's folder.
- security-reviewer 2 — `cd <outside> && gh pr create` finds no root and skips the gate (fall back to the session root).
- architecture-reviewer 1 and 3 — conflict detection by prose match; an unmapped deliver-check step must stop the change, not vanish.

## Left as follow-ups (recorded, not fixed here)
- security-reviewer 1 — pre-existing Bash write-guard escapes (subshell `cd`, `pushd`, `git -C`, symlinks); CI stays the backstop.
- security-reviewer 3, architecture nit — the "owner's own message" rule for `approval.md` is enforced by skill text; inherent to ADR 0001.
- test-coverage-reviewer 2 — cron reconciliation and no-second-worktree are proven by the AC-13 dogfood (`## Dogfood` in retro.md: `CronList` after two runs, `git worktree list` after kill and resume).
- architecture-reviewer 2 and 4 — conduct-check reading `collectState` internals and copied git/sleep helpers: fixed if cheap, else follow-up.

## Next
Fix the findings above (tdd-implementer), commit, then re-review: code-quality-reviewer at round 2; the others are stale after the fix commit and re-run at round 1.

## Round 2 (dd407bd)

| Reviewer | Verdict | Blocking | Open important |
|---|---|---|---|
| adr-reviewer | PASS | 0 | 0 (cron go-ahead fixed in dd407bd) |
| code-quality-reviewer | PASS | 0 | 0 (release-rebase catch-all fixed in dd407bd) |
| test-coverage-reviewer | PASS | 0 | 0 (approval.md paths fixed; cron/worktree proof deferred to the AC-13 dogfood, required before archive) |
| security-reviewer | PASS | 0 | 0 (gh pr create fallback fixed; guard escapes refuted as pre-existing, follow-up) |
| architecture-reviewer | PASS | 0 | 2 accepted as follow-ups (collectState internals; helper copies that differ) |

Consensus: PASS (round 2/2). Follow-ups: Bash write-guard escapes (realpath, subshell `cd`, `git -C`); one parameterized git/poll helper; conduct-check reading deliver-check's published report instead of `collectState`; ADR 0005 citing ADR 0004.
