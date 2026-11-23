Verdict: approved
Commit: 676960b3668023bc75ead62761d187d64fe8a8ad (uncommitted changes)

## Quality review — change-budget (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs hold/budgetOf — One hold wrapper at the single action-building point, validated cap, fail-open transcript lookup.
- [nit] plugins/openspec/hooks/guard.mjs:~633 spentOf — Keeping the first usage line per message id may undercount streamed output tokens; keep the max or document the rule.
- [nit] plugins/openspec/hooks/change-loop.mjs budgetOf / waiting-budget — With a project-level cap the reply points to the change's .openspec.yaml, whose devkit block may not exist; say it is created if missing.

### Summary
- 3 findings (0 blocking, 0 important, 2 nit) + 1 praise
- Justification: the diff matches the proposal and tasks; the hold comes after the guard, `next` is the only caller that counts, and an unreadable transcript or an invalid transcript id lets everything through. An invalid budget becomes a LoopRefusal. All 41 `^change-budget` tests passed when run scoped to change-loop.test.mjs. The full guard suite was not run; evidence.md reports 1563 passes.
