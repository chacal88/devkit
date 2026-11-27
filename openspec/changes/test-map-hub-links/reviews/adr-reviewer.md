Verdict: approved
Commit: 76b2987d2fe5e6e0cd31cdd109057f2a2ba26348

## ADR review: test-map-hub-links

### Findings
- [nit] CONTRIBUTING.md (test-suite paragraph); docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md decision 2 — The rule that a document key lists only fast readers, and that a document no fast test reads has no key, lives in CONTRIBUTING.md and in a pinning test, not in ADR 0036. Decision 2's third bullet says a mapped file selects its linked tests, slow or fast. The map data now never links a slow reader to a document. It is accepted under the Consequences and by the owner's plan approval, and the change's decisions.md already explains it. Optionally cite ADR 0036 (decision 2 and Consequences) in the new CONTRIBUTING sentence.

ADRs reviewed: ADR 0036 (`docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md`) in full; ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`) decisions 1 and 5; ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`) and ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`) as the records ADR 0036 amends and relies on.

No open-decisions log exists in this project, and none of the ADRs the change touches leaves an open decision.

### Conformance checked
- Map is data, not mechanism (ADR 0036 decision 1): the change edits entries of the one hand-kept map and adds no key and no mechanism. Measured coverage informs the hand-written entries; it is not a measured selection.
- Selection rules (ADR 0036 decision 2): S1 to S7 and the own-files definition are untouched. Fewer document keys select a test, so more documents fall to S5 or S6 and select none, the direction decision 2 states for documentation. `.gitignore` and `scripts/released-flows.json` keep a key linked to fast readers (S7). The new test refuses an empty list.
- Mode, check and CI (ADR 0036 decisions 3 to 5): `scripts/test-suite.mjs` and the workflow are not edited. The unflagged run and the train-branch run match the base's files and test names (`proof/same-tests.txt`, `proof/head-whole.txt`, `proof/train-whole.txt`), so ADR 0026 decision 5 holds.
- Backstop (ADR 0036 decision 6 and Consequences): dropped slow readers and dropped hub links are the 'a test the map does not link is found at the train' case the Consequences accept. `design.md:247-248` and `decisions.md` record it; the train command and its bisection are unchanged.
- Release note (ADR 0034): `release.md` has `packs: []` and a note, so the rule is met.
- Decisions stage: `not-applicable` is right, since the change amends no ADR rule.
- No ADR trigger of ADR 0036's Review trigger is tripped.

I ran no test, as instructed, and I did not re-measure the coverage proofs; I relied on `evidence.md` and `proof/` for the recorded runs.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
