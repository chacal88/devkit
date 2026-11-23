Verdict: approved
Commit: a5f11db996c8489dd8c36938906350c27d1da839

## Quality review — change-budget (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs hold/budgetOf — One hold wrapper at the single action-building point, validated cap, fail-open transcript lookup.
- [nit] plugins/openspec/hooks/guard.mjs spentOf (sum, dedupe by message id) — Keeping the first usage line per message id may undercount streamed output tokens; keep the max or document the rule.
- [nit] plugins/openspec/hooks/change-loop.mjs budgetOf / waiting-budget — With a project-level cap the reply points to the change's .openspec.yaml, whose devkit block may not exist; say it is created if missing.

## Quality review — change-budget (round 1)

### Summary
- 3 findings (0 blocking, 0 important, 2 nit) + 1 praise
- Justification: the range since the previous approval (676960b..a5f11db) only commits openspec/ records (evidence, reviews, tasks.md); the code from 08eea2b is unchanged. The diff matches the proposal: the hold comes after the guard, only `next` counts (budget: true), and an unreadable transcript or unsafe session id lets everything through. An invalid budget becomes a LoopRefusal with the setting-unknown reply. The earlier round ran 41 `^change-budget` tests in change-loop.test.mjs and they passed; no tests were run this round, and the full guard suite was not run (evidence.md reports 1563 passes). Both nits stand and do not block.
