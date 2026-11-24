Verdict: approved
Commit: df7cfaccdb7a1bf755959dc95629713fcbbbe4b1

## Spec review — change-version-pin

### Findings

In-scope specs: openspec/changes/change-version-pin/specs/change-coordination/spec.md, specs/change-stages/spec.md, specs/coordination-locks/spec.md, specs/reviews-check/spec.md, requirements.md (AC-1..AC-7), and the canonical openspec/specs/{change-coordination,change-stages,coordination-locks,reviews-check}/spec.md.

### Coverage
| Requirement | Status |
|---|---|
| change-coordination: Opening a change records the versions it opened with | covered |
| change-coordination: A change moves to the installed flow only on request | covered |
| change-coordination: A script switch records the installed flow of the new script | covered |
| change-coordination: The resume reply names a newer installed flow | covered |
| change-stages: A change follows the flow version it opened with | covered |
| change-stages: A change with no recorded flow follows version 1 | covered |
| change-stages: Every released flow version stays readable | covered |
| change-stages: The product-code gate follows the change's flow | covered |
| change-stages: The readout names a newer installed flow | covered |
| change-stages: A flow change raises its version | covered |
| coordination-locks: The roles of a run are those of the flow the change follows | covered |
| reviews-check: The check asks for readiness by the flow the change follows | covered |

### Previous findings
The verdict file at 043b8e0 recorded 0 findings; nothing to re-list.

### Verification at this stage
Scoped re-review of 043b8e0..df7cfac. Checked the merge resolution against the change's own diff (origin/main...HEAD): main's release-tag work (PR 86/87) is intact (releaseTagSetting still imported and used in change-loop.mjs and deliver-check.mjs; CI snippet pinned to v0.31.0 in docs/openspec-flow.md); this change's additions in change-loop.mjs (flow subcommand, resume reply with newer-flow line, readPin/readFlow/changeFlow imports) and deliver-check.mjs (changeDeclares for readiness) are intact. change-loop.test.mjs changes are only a fixture `version: 1` and the `flow` subcommand in the docs test. Release numbers are consistent at devkit-openspec 0.31.0 / marketplace 0.35.0 across both manifests, CHANGELOG.md, docs/openspec-flow.md and openspec-setup/SKILL.md; no stale 0.30.x/0.34.x remains outside openspec/changes. The CI fix in version-pin.test.mjs (+11 -1) only isolates the stop test's TMPDIR via tmpFolder and adds one assertion on the recorded refusal file; it adds no behavior. Targeted runs with GITHUB_HEAD_REF=change-version-pin, GITHUB_BASE_REF=main and a fresh empty TMPDIR: version-pin 'AC-2 locks' 2 of 2 pass; change-loop 'release tag|docs' 18 of 18 pass. python3 scripts/check.py passes; openspec validate change-version-pin --strict is valid. The whole guard suite was not re-run, as instructed.

Scope check: nothing in the delta since 043b8e0 adds behavior beyond the four spec deltas; no scope creep and no gap.

### Summary
- 0 findings (0 scope creep, 0 gaps). Spec review: pass. Full coverage; no scope creep.
