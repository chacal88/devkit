Verdict: rejected
Commit: 07a85c411ee58cafd43ddd663a9176eb821b5c65

## Architecture review — flow-script-checker (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/flow-check.mjs:179-191 — branchOf and offOwnBranch copy deliver-check's currentBranch, defaultBranches and archiveHeads (deliver-check.mjs:452, 1069, 1074), so the 'own branch' rule now exists twice and has already diverged (flow-check hardcodes main/master and the archive heads, deliver-check also reads origin/HEAD); export the three from deliver-check (or guard) and import them, which is the cut, not a copy.
- [nit] plugins/openspec/hooks/flow-check.mjs:262 — FRESH_MS (2000 ms) and the 'other is newer than mine' staleAfter rule repeat conduct-check.mjs:23, which comments that flow-check uses 'the tolerance conduct-check uses'; export the one constant so the two checkers cannot drift.
- [nit] plugins/openspec/hooks/conduct-check.mjs:15 — conduct-check imports the declaration reader (readFlow, FlowUsageError) from flow-check.mjs, a checker with a CLI; the reader is shared by two checkers and would sit more naturally beside schemaFile in guard.mjs or a small module, which also keeps a later flow-check import of conduct-check from forming a cycle.
- [nit] plugins/openspec/schemas/devkit/flow.json:1 — Stage ids and files now live in both flow.json and schema.yaml; the tests check that each instruction's first line names the role and that each artifact stage has an instruction, but not that flow.json's file equals the artifact's generates, so a cheap parity assertion would close the one drift left.

Verdict: approved

Analyzed: owners (flow.json for what OpenSpec cannot declare; flow-check for the walk; deliver-check, guard and merge-setup reused for git, PR, checks and schema lookup); boundaries (no import cycle, flow-check starts only git/openspec/gh and calls no AI); contract consumers enumerated (parseCommitLine tolerates the header before Commit:, conduct-check.planArtifactsOf, the guard session hook text, both schema copies byte-identical); deletion tests (flow-check.mjs: passes; flow.json: passes; docs/roles.md: passes; readFlow home: passes, see F3; branch helpers: shallow copy, see F1).

The implementer's decisions 1 to 5 and 7 hold. Decision 6 is F1.

No ADR conflict: the 0010 note on fenced task examples leaves decisions 1 to 8 unchanged, and the new flow.json mechanism is covered by ADR 0010 and docs/coordination-design.md, so no extra ADR is required.
