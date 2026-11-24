Verdict: approved
Commit: 22230be382d0c7f9cbb7f18c6abd865125b602e1

## Architecture review — run-status-bar (8085104..22230be)

### Findings
- [praise] plugins/openspec/hooks/flow-check.mjs:433 — The not-applicable rules were cut from artifactState into one notApplicableOf, used by the walk and by appliedStages, and OFFLINE_GH was moved to merge-setup.mjs rather than copied: single owner, one shared helper.

Analyzed: owners (state derivation stays in change-loop.mjs state per ADR 0017 decision 1; not-applicable rules in flow-check.mjs notApplicableOf; OFFLINE_GH in merge-setup.mjs; bar words in change-loop MESSAGES as precedent); boundaries (status-line.mjs is a read-only leaf that reads state only through the command, plus the run file's session through readRun; CI file list unaffected); contract consumers enumerated (the stages field and --offline are additive, no consumer of change-loop.mjs state besides status-line.mjs and tests in plugins/, next unchanged, machine-probe untouched, readStdin default unchanged); deletion tests (status-line.mjs: passes; notApplicableOf: passes; appliedStages: passes; OFFLINE_GH move: passes). No ADR owed: decisions.md gives its reason (one more read-only reader of state, opt-in). Checked and not findings: the in-process import of change-loop.mjs next to the spawned state call (about 36 ms), the cache-layout settings snippet (D-1 weighs alternatives), the coordinator listing near the 20 s bound (measured in the design, left to dogfood in D-12).
