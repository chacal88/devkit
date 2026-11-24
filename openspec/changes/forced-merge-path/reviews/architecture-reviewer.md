Verdict: approved
Commit: 0de71c21dbbf05b099cb402387237df4cac9a622

## Architecture review: forced-merge-path (origin/main...HEAD)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1337 — buildPart reads row.next.forced at two sites (skip testStageStep, attach reply); a single flag on the row spec would keep the forced notion in one place
- [nit] plugins/openspec/hooks/deliver-check.mjs:854 — gatesAtHead restates the currency rule of local staleness with a net-diff compare; predicates are shared, drift is the accepted risk, name both in the next staleness ADR
- [nit] plugins/openspec/hooks/deliver-check.mjs:949 — after a forced merge every later collectState re-reads rules, rollup and all gate files until the archive lands; skip the gate read once retro.md exists if latency shows
- [praise] plugins/openspec/hooks/guard.mjs:565 — No new home: valueIn is cut out of readValue, requiredChecks, readContents and verdictAllowed are reused, and unreadable reads fail closed as blocked

Analyzed: owners deliveryOf/deliver-check.mjs (state, GitHub reads, verdict rules), merge-setup.mjs (requiredChecks), guard.mjs (valueIn, parseStageHeader, parseCommitLine); boundaries deliver-check to change-loop to skills, flow-check readout unchanged and pinned by the design; no new module or home. ADR 0028 accepted and amends ADR 0003. Scope: production code, docs, skills, design, specs and ADR; no test was run.
