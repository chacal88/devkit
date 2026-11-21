Verdict: rejected
Commit: 9307ba1dd24843a444fabc6594695db1888dc830

## Architecture review — roadmap-coordinator (6918c0d..9307ba1)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.mjs:332 — sleepSync and the wx lock loop with stale takeover (updateRun) copy withOpenLock/OPEN_LOCK in change-loop.mjs:879-899, both added in this change; cut into one shared parameterised helper
- [important] plugins/openspec/hooks/guard.mjs:431 — roadmapRunOf duplicates the transcript scan of runOf, and mainInRun and lock() parse the transcript twice per call; use one scanner with two interpreters
- [nit] plugins/openspec/hooks/change-loop.mjs:34 — change-loop.mjs now exports about ten internals only for roadmap-loop.mjs; consider a shared loop-core module if a third loop appears

Analyzed: owners (roadmap-loop.mjs, change-loop.mjs, guard.mjs, and existing readers reused); boundaries (dynamic imports from guard.mjs, harmless cycle, run file in the git common directory, locks fail open); contract consumers enumerated (runOf and mainInRun with the guardEdit/guardBash call sites, LOCKS and ROADMAP_LOCKS, the verb-unknown message, the new change-loop exports used only by roadmap-loop.mjs); deletion tests (roadmap-loop.mjs: passes; roadmapRunOf: passes as a distinct reader, with duplication noted in F2; classifyLines and gateOf: pass; ADR 0013 covers the structural decision, no ADR missing). No blocking findings, so the verdict is approved. The suite was not re-run (1105 pass given); the five specs and design.md were not read in full.
