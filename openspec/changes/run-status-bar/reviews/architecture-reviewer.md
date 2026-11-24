Verdict: approved
Commit: 9ad0f6fa551bb7269b21fd0240956c91e0bb15cc

## Architecture review — run-status-bar (round 2 re-check, a46bf79..9ad0f6f)

### Findings
- [praise] plugins/openspec/hooks/flow-check.mjs:433 — The not-applicable rules were cut from artifactState into one notApplicableOf, which the walk and appliedStages both use, and OFFLINE_GH moved to merge-setup.mjs instead of being copied: one owner, one shared helper (round 2 finding; this range does not change it).
- [praise] plugins/openspec/hooks/change-loop.mjs:1196 — The GitHub-silent ending is cut into one local helper, silent(stageId, error). blockedEnd (line 1348) and the offline stop-merge-setup branch (line 1403) both call it, so the expression is not copied, and the new branch keeps the same detail shape ({ error }).

Analyzed (re-check of the changes since a46bf79: accaace, the fix for code-quality F10; 3198a03, the tasks.md preamble; 9ad0f6f and deb9835, the change folder's evidence and review files).

- **Owners.** No new module, home or sharing mechanism is added.
  - `merge-setup.mjs` still owns `OFFLINE_GH`. Its only change is a comment that names how the loop recognises it.
  - `decide` in `change-loop.mjs` still owns how a delivery row becomes an end state. The offline rule sits on the existing `case 'blocked'` branch rather than in a new function or in `deliver-check.mjs`.
  - `deliver-check.mjs` (line 1697) still emits `stop-merge-setup` fail-closed. The rule that the merge setup fails closed is therefore unchanged at its owner, and offline mode only changes how `decide` reads that result.
- **Seams.**
  - `nextAction` (line 1550) works out offline mode from the identity of the `gh` it gets: `gh === OFFLINE_GH`.
  - `OFFLINE_GH` reaches `nextAction` only through `runState`. `state --offline` passes it into `stateEntries` (line 3102), and `stateEntries` (line 1964) passes it to `nextAction`.
  - `roadmap-loop.mjs` also uses `OFFLINE_GH`, at line 894 as `claimsGh` and at line 939 as the default `gh` of `roadmapAgentDecision`. Neither reaches `nextAction`: `roadmapAgentDecision` gives its `gh` only to `unfinished` and `archivedOnDefault`. So no roadmap decision changes behaviour.
  - Because the stub carries the mode, any later caller that hands `nextAction` the offline stub gets the same reading without passing a separate flag. Design D-4 chose this ("`gh` is the offline stub for the whole read"), so it is not re-litigated here.
- **Contract consumers.**
  - `decide(facts)` gains the optional fact `offline`. Callers that omit it, including direct test callers of `decide`, see `undefined` and keep the online `blocked/merge-setup` path.
  - The `state` output keeps its shape. Offline, a merge-mode change at the review reads `waiting-on-github` / `silent` instead of `blocked` / `merge-setup`.
  - Design D-4 (lines 179-181) promises that state, "a stage that needs it reads `waiting-on-github` / `silent`". The status line (`status-line.mjs:193`, the only caller of `--offline`) already counts that state as in play only.
  - Online callers (`next`, the roadmap loops, `stateEntries` without `--offline`) keep the stop. S-9b asserts both sides and asserts that no `gh` call is made offline.
- **tasks.md (3198a03).** The change is only prose in the preamble, with no structural effect.
- **Deletion tests.** `silent` is a local closure that two call sites share. Inlining it would bring back two copies of the same five-argument `waiting(...)` call, so it passes as a cut. No new module is added.
- **ADR.** No structural decision in this range needs one.
- **Test run.** At HEAD, `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/change-state-stages.test.mjs`: 1 file, 22 tests, 22 pass, 0 fail. That count includes the new S-9b test `run-status-bar AC-3 offline: at the code review of a merge-mode change --offline reads waiting-on-github, silent; online a failed setup read stays blocked`.
