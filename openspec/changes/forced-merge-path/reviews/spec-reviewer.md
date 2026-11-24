Verdict: rejected
Commit: 0de71c21dbbf05b099cb402387237df4cac9a622

## Spec review — forced-merge-path

### Findings
- [important] specs/change-delivery/spec.md, requirement "A merged pull request is found from any checkout"; evidence.md Observations 1 — Spec ambiguity resolved silently: when several merged pull requests pass isOwnPr (stacked delivery-train PRs 91, 93, 94), the number found depends on the checkout (#91 from main, #93 from the change's own branch), and no scenario says which one is the change's. The retro text and tag-release name that number. The evidence records it as inherited and left to the owner. Decide the rule in the spec or record it as a follow-up change.
- [nit] specs/change-delivery/spec.md, "The work left after a merge is named", scenario "A further pull request is open"; deliver-check-archive.test.mjs:1198 — The only test of this scenario has no red required check and does not assert that the merged pull request is not read as forced (no forced fact, no statusCheckRollup call). The code path is right (mergedOwn is null when an open pull request wins), but the scenario's check-red condition is not pinned.
- [nit] deliver-check.mjs findByCommits (per_page=10) and gatesAtHead (files.length >= 300); specs/change-delivery/spec.md, "A merged pull request is found from any checkout" and "The open items of a forced… — The spec says 'newest first' with no limit, and says nothing about a compare too large to read. Design D-1 and D-3 choose 10 commits and a 300-file cap (a 'too far behind' gate item). These bounds are in the code and design but in no requirement or scenario; add them to the spec or confirm they are intended.
- [nit] docs/openspec-flow.md (delivered paragraph); branch base — (a) The delivered paragraph keeps 'A checkout that is not the change's branch then stops with the stop-branch step' right after the forced-merge sentences, so it reads as the forced case. It should say it applies to the partial merge (every required check green). (b) origin/main (946e3e8, own-pr-archive-paths, train 1) has moved past the last merge (9dff573) and changed isOwnPr and deliver-check.mjs, which the new commit arm calls. Merge it before the final verify and review, as the plan's own rule says.

Verdict context: no blocking finding; Spec review — pass with follow-ups. Full coverage of the in-scope requirements; scope creep limited to the two unspecified bounds in F3.

### Summary
- 4 findings (0 blocking, 1 important, 3 nit; 1 scope creep in nit F3, 0 gaps)
