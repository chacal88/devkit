Verdict: approved
Commit: 76b2987d2fe5e6e0cd31cdd109057f2a2ba26348

## Spec review — test-map-hub-links

### Findings
- [nit] openspec/changes/test-map-hub-links/proposal.md, Flagged for the owner; scripts/test-map.json hub keys — Request wanted hub edits to select almost no slow tests; deliver-check.mjs still selects 29 files (22 slow) and change-loop.mjs 24 (16 slow). AC-3 holds as written and the gap is flagged for the owner and approved, with a follow-up path.
- [nit] openspec/changes/test-map-hub-links/design.md D-4; scripts/test-map.json hub keys — Five hub drops go beyond answer 2's wording (conduct-check, flow-check, release-note from change-loop.mjs; compozy-driver, devkit-kit from deliver-check.mjs). They are justified by coverage (0 functions beyond load), flagged in the proposal and approved.
- [nit] openspec/changes/test-map-hub-links/tasks.md, Workflow follow-up; AC-6 — The CI half of AC-6 (job time on a real Markdown-only pull request, and green --own-files on this change's own pull request) is unprovable until a pull request exists and is correctly listed as a Workflow follow-up.

In-scope specs: openspec/changes/test-map-hub-links/requirements.md (AC-1 to AC-6, owner answers 1 to 3), design.md (D-1 to D-8), ADR 0036 and ADR 0026 decision 5 as cited by the plan. The change sets skip_specs: true and no capability spec under openspec/specs/ describes test selection.

### Coverage
| Requirement | Status |
|---|---|
| AC-1 doc-selects-no-slow | covered |
| AC-2 doc-readers-stay-fast | covered |
| AC-3 hub-narrowed | covered |
| AC-4 map-still-checked | covered |
| AC-5 whole-suite-unchanged | covered (recorded runs) |
| AC-6 fixed-part-measured | covered locally; CI half is a Workflow follow-up |
| D-5 test, D-6 CONTRIBUTING sentence, no ci.yml change | covered |

Independent check: the base and head maps were compared by script. 21 document keys changed their lists, 35 were removed, 2 were relinked, and no other code key changed except the two hub keys. No document key lists a slow test, no key is empty, lists are sorted, and slow and shared are unchanged. The hub drops equal D-4 (9 and 4) and the counts are 24 (16 slow) and 29 (22 slow). The four selected map tests (3 new plus T-16) were run alone: 4 pass, 0 fail. The whole suite was not run; the whole-suite and train runs were read from proof files. No ADR or open decision is touched and no two specs disagree.

### Summary
- 3 findings, all nits (0 scope creep, 0 gaps). Spec review: full coverage, no scope creep.
