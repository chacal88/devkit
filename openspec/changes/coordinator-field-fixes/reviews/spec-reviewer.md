Verdict: rejected
Commit: 4f6d958d353b78c317244ddf0763268d7829e5bd

## Spec review: coordinator-field-fixes (round 2)

### Findings
- [nit] specs/change-coordination/spec.md (A change archived on the default branch is not unfinished); plugins/openspec/hooks/change-loop.mjs:596 — Spec words the sources as a fallback chain; code and design D-3 take the union of all readable sources. Not touched in this range.
- [nit] specs/project-setup/spec.md (The GitHub plan names what the repository refuses); design.md:385 — Exit 1 for a blocked Actions, runs or ruleset state is stated only in design D-6, not in a scenario. Not touched in this range.
- [important] plugins/openspec/hooks/change-loop.mjs:614-620,627-637 vs specs/change-coordination/spec.md (A change archived on the default branch is not unfinished) — A new change that reuses an archived id and was created after the archive is now listed, which the SHALL NOT requirement forbids; no scenario or design text states the exception. Extend the spec (reuse scenario, day-granularity rule) or drop the behavior.

In-scope specs: the seven deltas under openspec/changes/coordinator-field-fixes/specs/ (change-coordination and change-delivery are the ones touched in this range).

### Coverage
| Requirement | Status |
|---|---|
| A change archived on the default branch is not unfinished | covered; the reuse exception is not in the spec (F3) |
| Delivered-change pull request lookup after a merge with tasks left | covered; the two new tests are in deliver-check.test.mjs |
| All other requirements | unchanged since round 1 (covered) |

### Summary
- 1 new finding (1 important). Round 1's two nits stay open. The tests added in fb91e5f match the stated behavior; I did not re-run them.
