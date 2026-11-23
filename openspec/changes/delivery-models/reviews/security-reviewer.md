Verdict: approved
Commit: 64ed99fa03ddad4e40b2e6680588e424e61ee715

## Security audit — delivery-models (round 2)

### Findings

Triaged scope: high: the CI settings and two-prs rules in deliver-check.mjs (ciSettingsRef, twoPrsContext, twoPrsRules, testBranchPr), the config parser and the guard rules in guard.mjs, the devkit-reviews.yml token permissions, the git and gh calls; medium: conduct-check and change-loop routing, commit-and-pr and ship-change instructions, the review-round workflow; low: docs, ADR 0018, the release bumps and the proof files.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- Injection: every git and gh call, including the new `spawnSync git merge-tree`, passes argv with no shell, and the shas come from `git rev-list`. A test branch name from config or `GITHUB_HEAD_REF` only appears as an argument value or after a `refs/...` or `origin/` prefix, so there is no option or shell injection.
- Injection: the suggested worktree path built from the config test branch only goes into an instruction to an agent. It is not written by the checker, and the config is repository content.
- Authz: the CI settings are read from the default branch (S1, then S2), so a pull request cannot change the model to weaken its own check. S3 falls back to the base ref only when no default-branch ref exists, and a pull request cannot edit its own base.
- Authz: `testBranchPr` judges only the resolution on a pull request to the test branch. The full contract is still enforced on the pull request to the base branch, which `twoPrsRules` gates on the merged test pull request and the absence of a test-branch commit.
- Authz: `testBranchViolation` in the guard is advisory and bypassable by design, and the CI `foreign` check is the real control.
- Authz: the `classify` regex for `reviews/resolution/<name>.md` is anchored and gives the same owner as `reviews/<name>.md`.
- Authz: the closed-test-PR fix blocks before any row that writes, which is the safe direction.
- Exposure and secrets: the workflow adds `pull-requests: read` and `GH_TOKEN: github.token`, which is read-only and has no secrets on forks. No credentials or secret-looking files are added.
- Config: the delivery settings fail closed (unknown model or missing base or test branch is an error), and the `ship:` entry that disagrees with the model throws.
- Crypto: nothing touched.

This review covered only this change's part of the diff, not main's own work in the merge.
