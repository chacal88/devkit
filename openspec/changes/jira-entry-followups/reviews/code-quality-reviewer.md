Verdict: approved
Commit: 0f405308ee31bfc6658bdea1bfce31c9b8666e55

## Quality review: jira-entry-followups (round 2)

### Findings
- [praise] plugins/core/skills/review-change/scripts/review-round.mjs:147-176 — The dirtyPaths copy in devkit-core is documented as a copy and held to deliver-check's gitFacts by a parity test on five tree shapes.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1810 — The plan-fix commit step reuses the existing step and reviewRecord, so state stays derived once in nextStep.
- [praise] plugins/openspec/hooks/guard.mjs:433-445 — The FLOW_VERSIONS ceiling is checked before the shape checks, and tests pin the unknown key at a known version and the shipped flow files staying unchanged.
- [nit] plugins/openspec/hooks/change-loop.mjs:2199-2203 — The task-taken check runs unfinished(..., gh) while the open lock is held; if it reads gh, the lock is held longer.
- [nit] openspec/changes/jira-entry-followups/evidence.md AC-11 — AC-11 names openspec/specs/jira-tasks/spec.md but only the spec delta holds the rule until archive; reword the criterion to the spec delta.
- [nit] plugins/openspec/hooks/change-loop.mjs:3228 — reply reads stdin when argv merely includes '--stdin', so a --param value equal to '--stdin' would trigger a blocking read; unlikely, optional to harden.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:2455-2473 — The four new AC-4 tests are a table over finding shapes (undisposed important, undisposed blocking, refuted, nit only) and assert both the stale and the current side, plus that the other reviewers stay current, so the `&& !open` guard is pinned in both directions.

### Summary

- 7 findings (0 blocking, 0 important, 3 nit) + 4 praise.
- Re-review scope: my round-1 findings and the range 66b8cf7..HEAD (3f6f865 test-only, evidence attempt 2, review.md and reviews/ for round 1). Round 1 held no blocking or important finding, so nothing needed a fix disposition; the three round-1 nits stand unchanged, since the range does not touch change-loop.mjs or the AC-11 wording.
- 3f6f865 (3f6f865c10032ae83d78e8cc78eac51eb78d720f) is the fix of the test-coverage-reviewer F1 (the `&& !open` guard in readReviews had no test). Verified by reading deliver-check.mjs:420 (`own: approved(verdict) && !open ? ownFiles(...) : null`), deliver-check-fixtures.mjs:247 (`ownMergeMain` exported and used by the new tests), and by a filtered run: `env TMPDIR=/private/tmp/devkit-jira-entry-followups GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check.test.mjs --test-name-pattern='jira-entry-followups AC-4 own-files'` printed `suite: 1 files, 4 tests, 4 pass, 0 fail`.
- The test-only commit touches no product code, so the earlier suite result (2994 green on cd2ea37, 226 green on deliver-check.test.mjs at the new head, as supplied) still covers the product surface. I did not mutate the guard to watch the tests go red; the stale-side cases assert the exact `<sha> is behind <sha>, which touches` reason, which the guard's absence would turn into null.
- No new defect in the range; evidence.md attempt 2 names the attempt-1 commit and the new test commit consistently with the git history.
