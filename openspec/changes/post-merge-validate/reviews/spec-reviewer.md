Verdict: approved
Commit: 369bbacd2a0c0041849170b990ebc9cb22a7a2a6

## Spec review — post-merge-validate (round 2)

### Findings
- [important] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, requirement 'A merge of the base is checked before the evidence' — Precedence over the canonical step scenarios (The demonstration, The code review, Waiting on GitHub, Other owner gates) was not stated in the delta. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] plugins/openspec/hooks/change-loop.mjs:1371 and :1670; delta scenario 'The planner's fix is checked again' — Spec said 'the change's files have changed' but the code compares the whole-worktree fingerprint. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] delta scenario 'The command with no merge' — Spec said the command 'prints result: none' but the code prints a JSON answer. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, first requirement; plugins/openspec/hooks/change-loop.mjs:1672 — The spec says the command runs `openspec validate <id> --strict`, but the code now runs `validate <id> --type change --strict --json`; the extra flags are compatible with the spec but the text does not name them.

Re-check of F1: the delta requirement now states its precedence in its own text; both canonical names it cites exist; `openspec validate post-merge-validate --strict` passes. F2 and F3 fixed. 21 post-merge-validate tests pass.

### Summary
- 4 findings in total: F1 to F3 fixed, one new nit (F4); 0 scope creep, 0 gaps, none blocking.
