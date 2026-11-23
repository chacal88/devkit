Verdict: approved
Commit: 896c29dfc34f7b02d88462ec71029eaf984a11e2

## Coverage analysis: release-tags, round 2 (0bf76b4..HEAD)

### Findings
- [important] plugins/openspec/hooks/release-tags.test.mjs:479-489 (ship-change tag-release row) — [6] The tag-release row's local-tag guard and refused-push stop clause were not asserted in the ship-change skill text. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [important] plugins/openspec/hooks/release-tags.test.mjs:123-154 (releaseFixtures) — [5] The GitHub answers existed only as hand-written fakeGh fixtures, with no live read recorded in the evidence. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [important] plugins/openspec/hooks/deliver-check.mjs:1326-1351 (archiveBaseFacts/testArchiveFacts) — [5] The two-prs scenario (only the main merge is named, the test-branch archive PR is never tagged) had no two-prs fixture. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [nit] plugins/openspec/hooks/deliver-check.mjs:165 (releaseTagOf), called at 1767 — [4] No test runs the pre-merge checker with a bad release_tag and expects the unchanged answer; moving the releaseTagOf call earlier would go unnoticed.
- [nit] plugins/openspec/hooks/release-tags.test.mjs:203, 486-488, 507-533 — Implementation-coupled: exact call count and whole-sentence prose pins of SKILL.md, CONTRIBUTING and docs; the call budget is deliberate (D-2), the prose pins are brittle.
- [nit] plugins/openspec/hooks/release-tags.test.mjs:20 — Importing delivery-models.test.mjs (176 tests) registers all of them in this file; a whole-file run of release-tags.test.mjs alone is slow (the evidence records a 590 s timeout). A non-test helper module for scenario/archiving/TWO_PRS would avoid it.
- [praise] plugins/openspec/hooks/release-tags.test.mjs two-prs tests (lines 415-470) — The two-prs tests assert on the set of pull-request numbers actually read through a recording gh wrapper, so a read of the test-branch change or archive PR turns them red, and the archive test follows the step through tag-release to archived.

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, release-tags.test.mjs, delivery-models.test.mjs, guard.test.mjs), plugins/openspec/skills/ship-change/SKILL.md, openspec/changes/release-tags (evidence.md, tasks.md). Runner: node:test with fakeGh fixtures and the delivery-models simulator.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): the two-prs filter is caught by the two new 'release-tags 2: two-prs ...' tests, which assert the set of pulls read; the tag-release session guards are caught by the extended 'release-tags 3: ship-change has the tag-release row...' test; the real GitHub route shapes are backed by the live reads in evidence.md (PR #72 and #73, a real 404, releaseTagFacts through the real gh). Not proven live and stated as such: git/tags/<sha> on this repository and the elsewhere state (covered by fixtures; not verdict-level).

Ran scoped: node --test --test-name-pattern='^release-tags (2: two-prs|3: ship-change)' release-tags.test.mjs, exit 0, 3 of 3 pass.

### Well covered
The two-prs filter (asserting the pull numbers read), the skill's tag-release guards, and the GitHub route shapes, now backed by real evidence.
