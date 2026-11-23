Verdict: approved
Commit: 896c29dfc34f7b02d88462ec71029eaf984a11e2

## Spec review — release-tags (round 2)

### Findings
- [nit] openspec/changes/release-tags/specs/release-tags/spec.md, Requirement 'Only merges into the default branch are tagged', scenario 'A pull request to the test branch'; plugins/openspec/hooks/release-ta… — Round 1: the two-prs scenario had no fixture test. Two two-prs tests now assert tag-release only for the main merge and no read of the test-branch change or archive pull request. · fixed in 6e33ca70798db42ce91d0694024aa688d2adf10c
- [nit] plugins/openspec/hooks/deliver-check.mjs (archiveReleaseFacts) — When the archive PR list cannot be read, the reason reads 'cannot read the archive PR on GitHub: ...' with number null, not the 'cannot read the release of PR #<n>' form. The spec's fact list does not name this read. Unchanged since round 1.
- [nit] plugins/openspec/hooks/guard.mjs isJsonPath; release-tags spec, scenario 'A value that is not a path to a JSON file' — isJsonPath accepts only letters, digits, '.', '_' and '-' in path segments. The stricter charset is in design D-1 and the tests but not in the spec. Unchanged.
- [nit] plugins/openspec/hooks/change-loop.mjs decide, first row; design.md R-3; change-coordination delta — A run that ends archived from a checkout other than chore/archive-<id> does not ask the archive merge's tag. ADR 0019 now records the limit (decision 3 and Consequences), but the change-coordination delta spec still does not say it.
- [nit] plugins/openspec/hooks/conduct-check.mjs:61 — tag-release is added to conduct-check's MAIN step list; no delta spec line names it. Unchanged.
- [nit] plugins/openspec/skills/devkit/SKILL.md:88 — The sentence that a stopped tag-release is blocked/archive-failed adds loop-skill behavior not stated in the change-coordination delta. It matches the ship-change scenarios. Unchanged.
- [nit] openspec/changes/release-tags/proposal.md:43-44; design.md:260-264; tasks.md:102 — The release was renumbered to devkit-openspec 0.30.0 / marketplace 0.34.0 and tasks.md follow-up now says v0.30.0, but proposal, design and task 1.x still say 0.29.0. The proposal allows a re-read before the release task, so this is spec metadata drift only.

In-scope specs: the change's two deltas (unchanged since round 1). The canonical specs and ADRs were checked in round 1 and not re-opened.

### Coverage
All twelve requirements are covered. The round 1 remark on 'Only merges into the default branch are tagged' is closed by the two-prs fixtures. The round 2 additions add no behavior: ADR 0019 states the archive-merge limit (matches design R-3), the extra guard asserts pin text that already existed in SKILL.md, and the live GitHub evidence adds nothing to the code. Tests were not rerun; the evidence records 45 of 45 release-tags tests at 6e33ca7.

### Summary
- 7 findings, all nit (0 scope creep, 0 gaps). 1 fixed (F1); 6 still open as nits (F2 to F7), none blocking. ADR 0019 is accepted; no recorded decision is contradicted.
