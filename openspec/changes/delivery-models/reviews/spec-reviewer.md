Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## Spec review — delivery-models (stale-only re-review after the merge of origin/main)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs nextStep, closed test-PR block (line 1445) — The closed test-PR block sat after the base-PR rows, so a closed test PR could still open, push or edit before it blocked; the spec says it SHALL open, move, close, push or merge nothing. · fixed in 99ef2bd

In-scope specs: openspec/changes/delivery-models/specs/delivery-models/spec.md, openspec/changes/delivery-models/specs/reviews-check/spec.md, openspec/changes/delivery-models/specs/change-coordination/spec.md, openspec/changes/delivery-models/specs/coordination-locks/spec.md, openspec/changes/delivery-models/specs/change-delivery/spec.md.

### Coverage
All requirements stay covered as in round 2. The merge of origin/main (c093f6e) changed none of the delivery-models behaviour.

- guard.mjs `parseDevkitBlock` now keeps a top-level `budget`, and a `budget` nested under `delivery:` stays undefined. The new test in delivery-models.test.mjs pins both cases. This keeps the delivery block's rule that a nested key never sets a top-level field.
- change-loop.mjs reads settings through the shared `parseDevkitBlock` and no longer has main's local copy, so there is one helper for the mechanism. `budgetOf` reads through it, and both sides' setting labels are kept. `GATE_OF_WHY` holds `waiting-budget` and the three merge waits. The roadmap-loop gate-map test lists both sets.
- deliver-check.mjs `readReviews` uses main's `verdictAllowed` staleness rule on this change's shared `verdictFiles`. The closed test-PR block fixed in 99ef2bd is untouched.
- Release 0.28.0 / 0.13.0 / 0.32.0 is consistent across both plugin manifests, marketplace.json, the CHANGELOG 0.32.0 entry, the CI pin v0.28.0 in docs/openspec-flow.md, and the docs-version test.
- docs/coordination-design.md keeps both sides' field-names paragraph.
- Everything else in the 64ed99f..HEAD range (jira-entry, change-budget, gh-version-check, review-openspec-fix) is main's own work, so it is out of scope for this review.

### Summary
The round-2 finding (F1) stays fixed in 99ef2bd. There are no new findings, no scope creep and no gaps.

Spec review — pass. Full coverage; no scope creep.
