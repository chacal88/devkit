Verdict: approved
Commit: 0bf76b45f9360e60d58bae1d927a5475b914dc2b

## Spec review — release-tags

### Findings
- [nit] release-tags spec: Only merges into the default branch are tagged, scenario "A pull request to the test branch"; plugins/openspec/hooks/release-tags.test.mjs:272 — The two-prs scenario (the test branch's PRs and archive PR are never tagged) has no two-prs fixture test; only the generic other-base negative exists. The behaviour follows from deliveryOf passing the configured base and archivePrList matching only chore/archive-<id> exactly.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1321 (archiveReleaseFacts) — When the archive PR list cannot be read, the reason reads "cannot read the archive PR on GitHub: ..." with number null, not the "cannot read the release of PR #<n> on GitHub: <error>" form. The spec's fact list does not name the PR list read, so this is an ambiguity resolved without a spec line.
- [nit] plugins/openspec/hooks/guard.mjs isJsonPath; release-tags spec: A project opts in, scenario "A value that is not a path to a JSON file" — isJsonPath accepts only segments of letters, digits, '.', '_' and '-', so a path with a space or '@' exits 3. The spec lists four rejected examples and says only "a path to a JSON file"; the stricter charset is recorded in design D-1 and the tests, not in the spec.
- [nit] change-loop.mjs decide, first row (archived end); design.md R-3 — A run that ends archived from a checkout other than chore/archive-<id> does not ask the archive merge's tag. This is within the change-coordination scenario, which names the archive branch only, and design R-3 records it as a limit. Worth a follow-up spec line if it matters.
- [nit] plugins/openspec/hooks/conduct-check.mjs:61 — tag-release is added to conduct-check's MAIN step list. No spec line asks for it. It is needed to keep the step list consistent, but it is not named in the delta specs.
- [nit] plugins/openspec/skills/devkit/SKILL.md:88 — The sentence declaring a stopped tag-release as blocked/archive-failed (refused push, local tag elsewhere) adds loop-skill behaviour the change-coordination delta does not state. It matches the ship-change scenarios "The remote refuses the push" and "A local tag at another commit", but is not itself in the delta.

## Spec review — release-tags

In-scope specs: the two delta specs of the change and the canonical change-coordination, change-delivery, delivery-models and coordination-locks specs.

### Coverage
All twelve requirements (nine in release-tags, three in change-coordination) are covered. Two carry remarks: the two-prs scenario has no fixture test (F1) and the archive PR list read words its reason differently (F2). The release-tags tests were run once: 43 of 43 pass. ADR 0019 is accepted and no recorded decision is contradicted. The canonical specs do not conflict with the new steps.

### Summary
- 6 findings, all nit (0 scope creep, 0 gaps). Nothing blocking; the change is consistent with its delta specs and requirements.md acceptance criteria AC-1 to AC-7.
