Verdict: approved
Commit: 043b8e02184136a0b8de618114b3c2c0d53a5bda

## Architecture review — change-version-pin (round 1 re-review, scoped to c1dc403..043b8e0)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1466 — openTitle reads the installed devkit flow (no change, no pin) but is absent from D-4 tables A and B, which the design calls exhaustive; add a B row or soften the wording. Code unchanged since the previous round, so it stands.
- [nit] plugins/openspec/hooks/guard.mjs:457; plugins/openspec/hooks/change-loop.mjs:1757 — Pin key names are literals in readPin and again in writePin's PIN_KEYS; export them once from guard.mjs. Code unchanged, so it stands.
- [nit] openspec/changes/change-version-pin/design.md:536 — The pin contract and the kept-flows rule are a durable cross-reader mechanism with no ADR; an ADR candidate for the owner, with no ADR conflict. design.md is unchanged, so it stands.

Analyzed: the scoped range c1dc403..043b8e0. `git diff c1dc403..HEAD -- plugins scripts .claude-plugin` is empty, so no code, hook, script or manifest changed. Every code-level conclusion of the previous round (owners, boundaries, contract consumers, deletion tests) therefore carries over unchanged.

What the range changed:
- The third merge of main (`aa7329a`) archived `release-merge-conflict` and added its retro.
- It added one sentence to `docs/openspec-flow.md`, about running `openspec validate <id> --strict` after every merge of the base.
- It added the roadmap update and the new requirement 'A release-only conflict is resolved by a merge of the base' (and its scenarios) to `openspec/specs/change-coordination/spec.md`.
- The commits since the previous round also hold the evidence rewrite and the review files.

Contract check against the new main content:
- This change's four spec deltas (change-stages, coordination-locks, change-coordination, reviews-check) are all ADDED-only. None modifies a requirement that main touched, so the merge creates no delta/canonical collision.
- The new main requirement concerns the release-conflict merge script. The pins it rewrites are the CI devkit-openspec pins in the docs, not the per-change flow pin, so it is a separate mechanism with no shared owner and no seam leak.
- `openspec validate change-version-pin --strict` reports the change valid.

The evidence stage records the whole guard suite last run on `5f8aa35` (exit 0, 2131 of 2131 pass), with `plugins/`, `scripts/` and `.claude-plugin/` byte-identical since then. I did not re-run any test.

The review.md header names commit c1dc403, while HEAD is 043b8e0. The delta since c1dc403 is only docs and openspec files, and the staleness rule is the next stage's concern, not an architecture finding.

Deletion tests: unchanged from the previous round (changeFlow, changeDeclares, changeDeclaresOrInstalled, readPin, writePin, recordPin, moveFlow, flowNotice and the flows/ with released-flows.json mechanism pass; packVersion is thin but justified). No ADR conflict (0010 decision 1 and 0011 hold).

Previous findings: F1 to F3 above are the three nits of the previous verdict file, listed as they stand.
