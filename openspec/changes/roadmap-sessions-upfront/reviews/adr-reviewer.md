Verdict: rejected
Commit: 123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0

## ADR review: roadmap-sessions-upfront

### Findings
- [important] docs/adr/0019-a-roadmap-run-opens-every-change-at-its-start.md:3 — ADR 0019 is still proposed with no Accepted by line, no decisions.md exists for the accepting script, yet six accepted ADRs, the config list and the code cite it as amending them; record the owner's acceptance (approval.md, 'Aprovo') or leave it explicitly for merge.
- [important] docs/adr/0019-a-roadmap-run-opens-every-change-at-its-start.md Decision 3 / Amends; plugins/core/agents/requirements-triage.md; openspec/config.yaml:38 — Triage answering grill questions touches ADR 0010 decision 8's statement that grill answers stay the owner's; ADR 0019 does not name that sentence and the triage and config rule also apply to a lone /devkit change, outside ADR 0019's scope.
- [important] plugins/openspec/hooks/guard.mjs:950 (skillEntry); plugins/openspec/hooks/hooks.json:29-35 — The new skill hook ignores the project opt-in that ADR 0004 requires of devkit-openspec hooks (block nothing outside devkit/devkit-lite projects); the design chose this on purpose and no ADR acknowledges it.
- [nit] plugins/openspec/hooks/conduct-check.mjs:372 (adrClash, renumber-adr); specs/change-delivery/spec.md — The implementer renumbering an ADR the default branch took, without asking the owner (D-10), is in no ADR; cite it in ADR 0019 or as an ADR 0016 follow-up.

ADRs reviewed: ADR 0004, 0005 (superseded, followed to 0006), 0006, 0008, 0010, 0011, 0013, 0014, 0016, 0017, 0018 (precedent) and 0019 (the record this change writes). No index file or open-decisions log exists; the config's ADR list was checked.

What conforms: the cron, wait loops and session archive that contradict ADR 0006 decision 3 and ADR 0014's rejected retry timer are amended explicitly by ADR 0019 and recorded as header lines and Notes in the older ADRs (ADR 0013 decision 4's field list is edited in place, as ADR 0014 did before). The coordinating session still hands no stage except the grill's triage agent that ADR 0019 decision 3 names. The periodic check runs on an event turn, so it starts no session, writes no approval and no retro answer, and hands no stage. The entry hook follows ADR 0019 decision 1 and fails closed. The held title and state go through changeState (ADR 0017 decision 1). The push command refuses the default branch. devkit stays owner-only (ADR 0011).

No finding is blocking and none requires a superseder. The suite result was taken from the caller and no test was run.

### Summary
- 4 findings (0 blocking, 3 important, 1 nit)
