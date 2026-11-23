Verdict: approved
Commit: 64ed99fa03ddad4e40b2e6680588e424e61ee715

## Architecture review — delivery-models (origin/main...HEAD), round 2

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:140 — deliver-check.mjs grows to 2236 lines with the two-prs state inside it; carving it into its own module was proposed as a follow-up. · refuted: design.md:29-33 forbids any new module or import in deliver-check.mjs because devkit-reviews.yml:22-24 downloads only that one file for CI; twoPrsRules/testBranchPr (deliver-check.mjs:2113,2132) run on the --ci path, so the proposed split would break the download contract
- [important] plugins/openspec/hooks/deliver-check.mjs:142 — The delivery settings were said to have two owners (guard.mjs and deliver-check.mjs), with MODEL_SHIP outside guard.mjs. · refuted: MODEL_SHIP is referenced only at deliver-check.mjs:140/155; guard.mjs deliverySettings and change-loop.mjs read only the model; flow-check.mjs reuses deliveryConfig, so the mapping has one home and the finding's own condition is not met
- [nit] plugins/openspec/hooks/deliver-check.mjs:151 — The ShipConfigError text is rebuilt from the setting name with replace('delivery-','').replace('-','_'), which couples it to internal naming; deliverySettings could return the config key.
- [praise] plugins/openspec/hooks/guard.mjs:85 — plainValue and the devkit-block parser were cut from change-loop.mjs into guard.mjs, and listWorktrees was cut from conduct-check.mjs into deliver-check.mjs and re-exported; each is a real cut, not a copy.

Analyzed: owners are config parsing in guard.mjs (base layer), git and PR state in deliver-check.mjs, the step table in conduct-check.mjs, and PR actions in the commit-and-pr agent and the ship-change skill. Boundaries: guard.mjs imports nothing from the application hooks; deliver-check imports guard; flow-check, change-loop and conduct-check import deliver-check. That is unchanged by the merge with main.

Changed since round 1:
- Conflict resolutions with main keep the same owners. The new next.step values (open-prs, open-test-pr, push-support, move-test-pr, open-test-archive-pr, resolve-support-conflict, fix-resolution) appear consistently in the conduct-check SUBAGENT table, the ship-change step table and the commit-and-pr agent's two-PR call section.
- ADR renumber 0017 to 0018: ADR 0012 and docs/coordination-design.md point to 0018 for this decision. The 0017 references in ADR 0010 and ADR 0014 belong to main's own ADR 0017 (change state derived in one place), a different decision, so there is no collision.
- Closed-test-PR fix in the nextStep path: a closed, unmerged test PR now yields 'blocked' (and a stopArchive for the archive PR) instead of falling through. 'blocked' is an existing step consumed by every existing caller, so no contract changes.
- The test file moving to main's shared tmpFolder helper is test scaffolding only and raises no architecture concern.

Contract consumers enumerated: listWorktrees (conduct-check re-export, change-loop), deliveryConfig (flow-check), the new next.step values (above), the review-round verdictDir arg (optional, backward compatible), and the devkit-reviews.yml template (read permission and GH_TOKEN only).

Deletion tests: the guard.mjs config parser passes, since several consumers need it. ADR 0018 and its amendments to ADR 0002, 0003, 0010 and 0012 pass, since the structural decision is recorded. The two-prs group inside deliver-check has depth but low locality, and the CI download constraint rules out splitting it (F1 refuted).

The plan's 'ADR 0015' is delivered as ADR 0018 and proof/ac-map.md notes it, so it is not a finding.
