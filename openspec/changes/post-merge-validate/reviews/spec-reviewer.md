Verdict: approved
Commit: 7f9624e3d9f70fe680520528fd76ab79fd8cdf95

## Spec review — post-merge-validate (round 2 refresh)

### Findings
- [important] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, requirement 'A merge of the base is checked before the evidence' — Precedence over the canonical step scenarios was not stated in the delta. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1371 and :1670; scenario 'The planner's fix is checked again' — Spec said 'the change's files have changed' but the code compares the whole-worktree fingerprint. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] delta scenario 'The command with no merge' — Spec said the command prints result: none but the code prints a JSON answer. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, first requirement; plugins/openspec/hooks/change-loop.mjs:1672 — Spec text did not name the --type change flag the code runs. · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md:26 vs openspec/changes/post-merge-validate/design.md (decisions section, ADR 0017 Note) — design.md says the ADR 0017 Note names `openspec validate <id> --type change --strict`, but the Note text still says bare `--strict`; align one of them.

In-scope specs: the delta (ADDED requirements), the canonical change-coordination spec, requirements AC-1 to AC-10. `openspec validate post-merge-validate --type change --strict` passes; the first requirement is plain text; the delta is ADDED-only; code, brief, docs, roadmap line and CHANGELOG name `--type change`. 21 post-merge-validate tests pass.

### Summary
- 5 findings in total: F1 to F4 fixed, one new nit (F5); 0 scope creep, 0 gaps, none blocking.
