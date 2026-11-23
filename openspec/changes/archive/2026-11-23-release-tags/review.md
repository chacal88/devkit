<!-- devkit-stage review result=passed attempt=2 commit=896c29dfc34f7b02d88462ec71029eaf984a11e2 -->
# Review: release-tags, round 1

Path: agents · range `aa7329a..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 0bf76b4 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 0bf76b4 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 0bf76b4 |
| test-coverage-reviewer | rejected | 0 | 3 | 3 | 0 | 0bf76b4 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 0bf76b4 |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md § Decision 3 and Consequences — Decision 3 promises the archive merge's tag before `archived`, but the design (R-3) and flow page say a run from a checkout other than chore/archive-<id> ends archived without asking it; the ADR does not record this limit.
- test-coverage-reviewer — [important] plugins/openspec/hooks/release-tags.test.mjs:479-489 (ship-change tag-release row) — [6] The session step runs only in the skill's prose, and the test text-matches just the three git commands and the no-force regex. The 'local tag at another commit: stop, never delete or move it' guard (`git rev-parse -q --verify refs/tags/<next.tag>`) and the 'refused push stops as blocked: archive (tag-release): <git's first error line>; never retry with force' clause are not asserted. Deleting either from SKILL.md leaves the suite green, and that guard is the safety claim 'the loop never moves a tag'. Write in: add `includes` asserts on the row in the existing test 'release-tags 3: ship-change has the tag-release row...'.
- test-coverage-reviewer — [important] plugins/openspec/hooks/release-tags.test.mjs:123-154 (releaseFixtures) — [5] Every GitHub answer is a hand-written fakeGh fixture keyed on the route string. Nothing checks that `pulls/<n>.merge_commit_sha`, `git/commits/<sha>.parents[].sha`, `contents/<file>?ref=<sha>` or `git/ref/tags/<v>` have these shapes and routes on real GitHub, and evidence.md records no live read. Close it with a read-only run of the six calls against this repository (for example the PR that produced v0.28.0 at 7640d9c, which evidence.md lists as pushed by hand) and keep the output in the evidence. This is a real-evidence item, not another unit test.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:1326-1351 (archiveBaseFacts/testArchiveFacts) vs spec 'Only merges into the default branch are tagged' — [5] The two-prs scenario ('release-bumping commit merged into develop and into main: only the main merge is named; the test-branch archive PR is never tagged') has no two-prs fixture. Only a generic `base: 'develop'` on a single PR is tested. A regression that read the release facts for `testPr` (`chore/archive-<id>-<testBranch>`) or for the test-branch change PR would stay green. Write in: release-tags.test.mjs phase 2, reusing the two-prs fixtures of delivery-models.test.mjs, asserting no `pulls/<testPr>` read and `tag-release` only for the main-based PR.

## Refuted by verification
None.

## Notes
None.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: release-tags, round 2

Path: agents · range `aa7329a..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 896c29d |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 896c29d |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 896c29d |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 896c29d |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 896c29d |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- The gate run of guard.test.mjs at 6e33ca7 was running in the background during the round; its result is recorded in evidence.md by the delivery step.

## Next
Ready to ship.
