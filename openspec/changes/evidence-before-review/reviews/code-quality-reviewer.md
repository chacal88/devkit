Verdict: approved
Commit: b719a4127c59af0d6c5e12f9811d26fbdbe81409

## Quality review — evidence-before-review (round 1)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:1010-1016 — gatesOpen/acOpen only fire when item 1 is 'open' and criteria ids exist. A 'blocked' item 1 skips verify and falls through to review. This matches the old behaviour, but a one-line comment would make the intent explicit.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1010-1016 — The reorder is minimal: the same fix-defect and verify predicates moved ahead of review without being rewritten. The comment points to design D2.
- [praise] plugins/openspec/hooks/guard.test.mjs:192 — AC-5 guards-kept tests both orderings (evidence first with no reviews, reviews first with no evidence). That proves the PR guard is order-agnostic, so the reorder did not loosen it.

### Summary
- 3 findings (0 blocking, 0 important, 1 nit) + 2 praise
- Justification: I read the nextStep reorder in deliver-check.mjs, the guard test, and the schema and skill wording. The root and plugin schema copies are identical (`diff -r` clean). The devkit and devkit-lite apply instructions both put pr-verifier before review-change, with a re-verify after each fix. The diff stays within the proposal: hook, schemas, skills, panel step order, docs and version bumps. I took the suite and gate results from the caller's recorded run (guard 668/668, panel 165/165, every gate part recorded as pass in the uncommitted evidence.md) and did not re-run them.
- Acceptance proof: evidence.md carries real output per criterion. The AC-1 dogfood on this change itself reports next.step = verify while the reviews are still open. Test names are tagged by criterion (AC-1, AC-2, AC-3, AC-5), so the variants I looked at are covered. I did not open AC-4 or later.
- Edges checked: a defect at stale evidence goes to verify, not fix-defect (the `ac.evidence === 'current'` guard). Reviewer findings that need a fix still take precedence over verify, and a fix commit re-stales both evidence and reviews, which AC-3 covers.
