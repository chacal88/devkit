Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## Architecture review — delivery-models (stale-only re-review, 64ed99f..HEAD), round 3

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:140 — deliver-check.mjs grows to about 2236 lines with the two-prs state inside it; a split into its own module was proposed as a follow-up. · refuted: design.md:29-33 forbids any new module or import in deliver-check.mjs because devkit-reviews.yml downloads only that one file for CI; twoPrsRules and testBranchPr run on the --ci path, so a split would break the download contract. The merge with main does not change this.
- [important] plugins/openspec/hooks/deliver-check.mjs:142 — The delivery settings were said to have two owners, with MODEL_SHIP outside guard.mjs. · refuted: MODEL_SHIP is referenced only at deliver-check.mjs:140 and 155; guard.mjs deliverySettings and change-loop.mjs read only the model, and flow-check reuses deliveryConfig, so the mapping has one home.
- [nit] plugins/openspec/hooks/deliver-check.mjs:151 — The ShipConfigError text is rebuilt from the setting name with replace('delivery-','').replace('-','_'), which couples it to internal naming; deliverySettings could return the config key.
- [praise] plugins/openspec/hooks/guard.mjs:101 — After the merge, the shared parseDevkitBlock is the single owner of the devkit block. It keeps main's top-level budget apart from delivery.*, and change-loop's readDevkitSettings and budgetOf read through it, so main's local devkitBlock copy was cut rather than kept beside the shared one.

Analyzed: owners.
- Config parsing stays in guard.mjs, the base layer. It keeps `budget` at its own level, never nested under `delivery`, and the new test pins that.
- Git and PR state, and the reviews staleness rule, stay in deliver-check.mjs. readReviews uses main's verdictAllowed on this change's shared verdictFiles, so there is one staleness rule for both sides.
- The step table stays in conduct-check.mjs, and change-loop.mjs consumes it.

Boundaries. guard.mjs imports nothing from the application hooks, and deliver-check imports guard and merge-setup. The merge adds no new import direction.

Contract consumers enumerated.
- GATE_OF_WHY holds both sides' waits: waiting-budget and the three merge waits. gateOf and the declared-wait path at change-loop.mjs:711 are the only readers, and an unknown wait still throws LoopUsageError.
- parseDevkitBlock gains `budget`. Its consumers are readDevkitSettings, budgetOf and deliverySettings, and none is broken because the field is additive.
- The release is consistent: devkit-openspec 0.28.0, devkit-core 0.13.0, marketplace 0.32.0, and the CI pin at v0.28.0 in docs/openspec-flow.md.
- The coordination-design.md field-names paragraph holds both sides' decisions.

Deletion tests. The shared parser passes, since there are several consumers and the duplicate was removed. No new module or home came from the merge.

No ADR is needed for the merge: it records no new structural decision.
