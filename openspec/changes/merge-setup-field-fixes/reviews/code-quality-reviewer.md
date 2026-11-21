Verdict: approved
Commit: 58d7a8b07652ce057525b17f051fad8db1b7eb3b

## Quality review: merge-setup-field-fixes (round 1)

### Findings
- [nit] plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs:246 — When the ruleset item is error or blocked, `requires` falls back to wantedRuleset(contexts, null). The printed list then omits checks the stored ruleset already requires, although the plan did not read them. Add a short note in that case, or accept it as the stop state.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1653 — checksToWatch reads state.items[5].details.pending behind `?? []`, a positional index shared with the wait-checks branch. A named accessor would be more robust, but it matches the existing style.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1647 — The wait is extracted into one pure function, checksToWatch, and one helper, watchChecks, shared by both steps. The watch cap and the recompute after it stay unchanged, and the archive PR is excluded on purpose.
- [praise] openspec/changes/merge-setup-field-fixes/proposal.md — The proposal says openly that field item 10 has no red test. It records the run on the unchanged code and asks the owner to accept it as proof, instead of claiming a fix.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: I read the diff of deliver-check.mjs, github-setup.mjs and the change-loop pin test, plus the proposal. I re-ran the 7 targeted merge-setup/stop-merge tests in deliver-check.test.mjs and all 7 passed. The caller reported the full suites green at HEAD: guard 1128/1128, deliver-check 375/375, github-setup 419/419. The 0.18.1 pin and its negative assertions are consistent. The wait only triggers on an open change PR with pending checks, and `--ci` still refuses `--watch`, so what the `devkit-reviews` check judges does not change. `requires` is printed from the same ruleset object that is applied, so the confirmation line shows what the ruleset really requires. Acceptance evidence is in evidence.md and proof/. Item 10 is accepted through tests that pass on the unchanged code, as the proposal discloses.
