Verdict: approved
Commit: 896c29dfc34f7b02d88462ec71029eaf984a11e2

## Quality review — release-tags (round 2)

### Findings
- [nit] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md:3-4 — Previous: the ADR header had two Status lines; ADR 0018 uses Status plus a separate Accepted by line. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [nit] plugins/openspec/skills/ship-change/SKILL.md:76 — Previous: the local-tag guard compares refs/tags/<tag> to the sha; an annotated local tag would stop as 'another commit'. Safe but not exact; refs/tags/<tag>^{commit} would be exact. Unchanged.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1318-1325 — Previous: on an archived change each run repeats up to 6 gh reads for the change PR plus a PR list and up to 6 for the archive PR, only with release_tag set. Cache per run if it gets hot. Unchanged.
- [nit] openspec/changes/release-tags/tasks.md:124 — Previous: the Workflow follow-up named v0.29.0 while the release is 0.30.0. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [praise] plugins/openspec/hooks/deliver-check.mjs:1203-1272 — Previous praise: releaseTagFacts fails closed, validates the tag version before any URL and separates 404 from unreadable.
- [praise] plugins/openspec/hooks/guard.mjs:128-142 — Previous praise: isJsonPath segment whitelist and a single releaseTagSetting shared by the start refusal and the checker.
- [praise] plugins/openspec/hooks/release-tags.test.mjs:415-470 — The two-prs tests reuse the delivery-models simulator and record every release route read through a wrapper, so 'the test-branch pull request is never read' is asserted from the call log, not inferred.
- [nit] plugins/openspec/hooks/release-tags.test.mjs:19-21 — Importing delivery-models.test.mjs (and deliver-check.test.mjs) runs those suites inside release-tags.test.mjs, so the whole file exceeded 500 s under load here and in evidence.md. The 45-test name-pattern selection is fast. Optional: move the shared helpers to a non-test module.
- [praise] openspec/changes/release-tags/evidence.md (Live GitHub reads) — Real-output acceptance: route-by-route live reads on PRs #72 and #73 with a real 404 and the real releaseTagFacts through the real gh, plus an explicit list of what is not proven live (annotated tag route, elsewhere state).

### Previous findings
See the findings list: F1 and F4 fixed in 6e33ca7; F2 and F3 still open as nits.

### Round 1 findings of other reviewers, checked in my remit
ADR 0019 now records the archive-branch limit; the two-prs tests assert the test-branch PRs are never read; the ship-change row test asserts the local-tag guard and the refused-push clause; evidence.md records the live GitHub reads and says what is not proven live.

### Summary
- 9 findings (0 blocking, 0 important, 2 nit open, 2 nit fixed) + 3 praise (one new).
- Justification: only my previous findings and the lines changed since 0bf76b4 were checked. The only product-adjacent changes are tests, ADR wording and task text; no product code changed. The 45-test name-pattern selection of release-tags.test.mjs passed; the whole-file run hit the reviewer's timeout under load. No blocking or important issue found; verdict approved.
