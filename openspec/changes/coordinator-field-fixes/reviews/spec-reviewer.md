Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## Spec review: coordinator-field-fixes

### Findings
- [nit] openspec/changes/coordinator-field-fixes/specs/change-coordination/spec.md (requirement: A change archived on the default branch is not unfinished); plugins/openspec/hooks/change-loop.mjs:596 — Spec words the sources as a fallback chain (GitHub, else remote-tracking, else main checkout); code and design D-3 take the union of all readable sources. Align the wording or the code.
- [nit] openspec/changes/coordinator-field-fixes/specs/project-setup/spec.md (The GitHub plan names what the repository refuses); design.md:385 — Exit 1 for a blocked Actions, runs or ruleset state is stated only in design D-6, not in a scenario; the spec specifies only the unknown case.
- [praise] openspec/changes/coordinator-field-fixes/proof/README.txt — Each of the eight defects maps to a named test and a recorded red run of 0.16.0, and every scenario of the seven deltas has a delivering test.

Verdict: approved. Spec files read in full: the seven deltas under openspec/changes/coordinator-field-fixes/specs/ (change-coordination, change-delivery, change-stages, compozy-kit-setup, openspec-cli, project-setup, reviews-check); the baselines openspec/specs/change-stages/spec.md (the four modified requirements) and openspec/specs/change-coordination/spec.md (requirement 'Unfinished work is asked about before a new request', lines 127-134); plus proposal.md, design.md (by grep), approval.md, tasks.md and the ADR 0012 header. The MODIFIED requirements match their baselines: the delta changes only the intended conditions and drops nothing. Every requirement maps to a test at file:line (see the coverage table in the reply). I did not read deliver-check.mjs or flow-check.mjs function by function. For those two, coverage rests on test names and the recorded green suite. No scope creep and no gaps found. 0 blocking, 0 important, 2 nits.
