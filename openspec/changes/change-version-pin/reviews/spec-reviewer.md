Verdict: approved
Commit: c1dc4033d78fb79eafea79ef073afec7949d36f2

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

### Verification at this stage
Targeted run with the CI branch variables and a real TMPDIR: node --test plugins/openspec/hooks/version-pin.test.mjs, 645 of 645 pass; python3 scripts/check.py passes; openspec validate change-version-pin --strict is valid; python3 scripts/gen-catalog.py --check printed nothing (its exit code was not captured). The whole guard suite was not re-run, as instructed; its result is taken from evidence.md.

Scope check: every change in the diff derives from a requirement or from a reader that design.md D-4 and the proposal's Impact section name (loop, conductor, roadmap titles, project loop, docs, version bump, CHANGELOG). The JSON readout always carries a flow object (version, installed, pinned); the spec requires both versions only when the installed flow is newer, and the extra field is harmless, so it is not flagged.

### Summary
- 0 findings (0 scope creep, 0 gaps). Spec review: pass. Full coverage; no scope creep.
