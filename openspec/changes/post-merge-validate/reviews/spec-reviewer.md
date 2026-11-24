Verdict: approved
Commit: c2bbad6284c3b7deaae46cf61359ffed97264558

## Spec review — post-merge-validate (round 3, refresh after the merge of origin/main)

### Findings
- [important] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, requirement 'A merge of the base is checked before the evidence' — Precedence over the canonical step scenarios was not stated in the delta. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1371 and :1670; scenario 'The planner's fix is checked again' — Spec said 'the change's files have changed' but the code compares the whole-worktree fingerprint. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] delta scenario 'The command with no merge' — Spec said the command prints result: none but the code prints a JSON answer. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, first requirement; plugins/openspec/hooks/change-loop.mjs:1672 — Spec text did not name the --type change flag the code runs. · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md:22-33 (Note post-merge-validate) vs openspec/changes/post-merge-validate/design.md decisions section — The ADR 0017 Note still says `openspec validate <id> --strict` (no --type change) while the design, code, docs and CHANGELOG name `--type change --strict`; left on purpose, align one of them if touched again.

In-scope specs: the delta (ADDED only, 6 requirements) and requirements.md (AC-1 to AC-10); cross-checked against ADR 0017, docs/openspec-flow.md, the devkit skill and the roadmap. The delta is ADDED-only and validates strictly; the conflict resolutions hold (release files at 0.41.0 / 0.46.0, main's pin test, both ADR 0017 Notes). 21 post-merge-validate tests and 21 filtered compozy and remote-state tests pass; check.py and openspec validate pass.

### Coverage
| Requirement | Status |
|-------------|--------|
| A merge of the base is checked before the evidence | covered |
| A green check lets the delivery go on once per merge | covered |
| A red check goes to the planner as a merge defect | covered |
| Three red checks in a row on one merge end the run blocked | covered |
| A check that cannot run ends the run blocked | covered |
| A merge-defect fix follows the rule of every plan edit | covered |

### Summary
- 5 findings in total: F1 to F4 fixed earlier and unchanged by the merge; F5 is the one open nit, left on purpose; 0 scope creep, 0 gaps, none blocking.
