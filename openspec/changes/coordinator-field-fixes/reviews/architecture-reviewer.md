Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## Architecture review: coordinator-field-fixes (round 1)

### Findings
- [nit] plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs:90 — devkit-stage header written as a literal; STAGE_HEADER in flow-check.mjs owns the parser, so the format lives in two places. Share a writer if one is ever added.
- [nit] plugins/openspec/hooks/flow-check.mjs:130 — The version-then-openspecRefusal step is repeated in four callers; move it beside openspecRefusal in guard.mjs if a fifth appears.

Analyzed: owners (openspecCli/openspecRefusal in guard.mjs, isPreviousScript in flow-check.mjs, archivedOnDefault in change-loop.mjs); boundaries (the three CI-downloaded files import only node: modules or each other; changes-under-way imports hooks of its own pack; install-kit writes only under .compozy/); contract consumers (unfinished, isPreviousScript, findChangePr, selectCiChange and makeOpenspec call sites all enumerated and compatible); deletion tests (openspecCli/openspecRefusal, archivedOnDefault, changes-under-way.mjs and install-kit.mjs pass; the 0.13.0 schema fixtures are test data); ADR 0012 records the structural decision.
