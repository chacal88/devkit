Verdict: approved
Commit: 043b8e02184136a0b8de618114b3c2c0d53a5bda

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
Scoped re-review of c1dc403..043b8e0. The commits since are the evidence rewrite, the review files, and the merge of origin/main aa7329a (archive of release-merge-conflict). git diff c1dc403..HEAD over plugins, scripts and .claude-plugin is empty. The only non-openspec file that moved is docs/openspec-flow.md (one sentence, a post-merge procedure, not a requirement of this change). The four spec deltas are all ADDED Requirements; none of their titles exists in the merged canonical change-coordination spec, so the merge creates no conflict or duplicate. openspec validate change-version-pin --strict is valid; python3 scripts/check.py passes. The targeted run of plugins/openspec/hooks/version-pin.test.mjs with GITHUB_HEAD_REF=change-version-pin, GITHUB_BASE_REF=main and a real TMPDIR finished: 645 of 645 pass, 0 fail. The whole guard suite was not re-run, as instructed.

Scope check: nothing in the delta since c1dc403 adds behavior; no scope creep and no gap.

### Summary
- 0 findings (0 scope creep, 0 gaps). Spec review: pass. Full coverage; no scope creep.
