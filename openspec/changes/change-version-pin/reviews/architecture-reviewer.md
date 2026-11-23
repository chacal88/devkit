Verdict: approved
Commit: c1dc4033d78fb79eafea79ef073afec7949d36f2

## Architecture review — change-version-pin (round 1, stage 1)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1466 — openTitle reads the installed devkit flow (no change, no pin) but is absent from D-4 tables A and B, which the design calls exhaustive; add a B row or soften the wording.
- [nit] plugins/openspec/hooks/guard.mjs:457; plugins/openspec/hooks/change-loop.mjs:1757 — Pin key names are literals in readPin and again in writePin's PIN_KEYS; export them once from guard.mjs.
- [nit] openspec/changes/change-version-pin/design.md:536 — The pin contract and the kept-flows rule are a durable cross-reader mechanism recorded with no ADR; an ADR candidate for the owner, no ADR conflict.

Provisional verdict: approve (no blocking finding). Analyzed: owners (flow reader in guard.mjs because the devkit-reviews job downloads it; pin writer beside the existing .openspec.yaml writer; repository check in check.py); boundaries (guard.mjs imports only Node built-ins; deliver-check takes only changeDeclares; hooks fall back through changeDeclaresOrInstalled per ADR 0011; CI fails on an unreadable pin; conductor and loop delivery rows catch it as that change's blocked state); contract consumers enumerated (grep sweep of readFlow, readFlowFile, schemaHasArtifact, collectFlow and schemaFile over non-test .mjs files; every site routed through changeFlow or kept in D-4 table B, except F1; readFlowFile now accepts any version from 1 with no importer depending on the old refusal; the report gains the flow key last; the CI output shape is unchanged); deletion tests (changeFlow, changeDeclares, changeDeclaresOrInstalled, readPin, writePin, recordPin, moveFlow, flowNotice and the flows/ with released-flows.json mechanism pass; packVersion is thin but justified by a different failure rule than github-setup's pluginVersion). Single owner and cut-not-copy hold: the flows/<n>.json copies are deliberate byte copies pinned by digest and by the byte-identical test. No ADR conflict (0010 decision 1 and 0011 hold).
