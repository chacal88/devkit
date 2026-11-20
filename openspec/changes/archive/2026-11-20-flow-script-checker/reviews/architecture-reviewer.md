Verdict: approved
Commit: 19d8c2761b400d4bdfe39e8886b80ff2d9c1c183

## Architecture review — flow-script-checker (round 3, eb37166..HEAD)

### Findings
- [important] plugins/openspec/hooks/flow-check.mjs:179-191 — branchOf and offOwnBranch copied deliver-check's currentBranch, defaultBranches and archiveHeads; the three are now exported and imported, offOwnBranch is one line over them · fixed in 7013137
- [nit] plugins/openspec/hooks/flow-check.mjs:254 — FRESH_MS and the 'other is newer than mine' rule still repeat conduct-check.mjs:23; export one constant
- [nit] plugins/openspec/hooks/conduct-check.mjs:15 — conduct-check imports readFlow and FlowUsageError from a checker with a CLI; the reader would sit better beside schemaFile in guard.mjs
- [nit] plugins/openspec/schemas/devkit/flow.json:1 — flow.json and schema.yaml parity of stage files; now covered by the parity test at flow-check.test.mjs:687 · fixed in 7013137

Verdict: approved

Analyzed: owners (no new capability or home; the delta reuses the one SHIP_ENV set already defined in flow-check.test.mjs, so the CI-variable blanking has a single owner in the test file); boundaries (the only file outside openspec/ that changed is flow-check.test.mjs, with no product file touched and no import change); contract consumers (none affected, since no contract, route, schema or export changed); deletion tests (no new module in the delta). Only the lines changed since eb37166 were checked: SHIP_ENV now also blanks DEVKIT_BYPASS, and the ten env-building sites (collectFlow, FC.main, spawned flow-check.mjs) spread it instead of blanking DEVKIT_BRANCH alone. This removes seven repeated ad-hoc env literals in favour of one definition. The earlier nits stand as they were.
