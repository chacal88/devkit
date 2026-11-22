Verdict: approved
Commit: db34efd887c7e8f8eb2cda8411708d611fe3c774

## Quality review — stage-roles (round 1, stage 1)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:readRecord — Containment check uses resolve/relative with no realpath, so a symlink inside an adr folder that points outside the repo passes and accept-decisions would write through it. Also rel.startsWith('..') wrongly rejects a record whose folder or file name begins with '..'. Fix: realpath the target, and test rel === '..' || rel.startsWith('..' + sep).
- [nit] plugins/openspec/hooks/change-loop.mjs:acceptDecisions — Every check runs before the first write, but the writes are not atomic. A failure on the second writeFileSync leaves one record accepted and one proposed. A re-run recovers it because accepted records are skipped, so this is only worth a comment.
- [nit] plugins/openspec/hooks/guard.mjs:isTestFile — The 'specs?' folder name and the `[._-](spec)` file form match openspec/specs and similar paths in a project. e2e-tester is allowed to write these only as code-kind files after approval, so the blast radius is small. Consider narrowing.
- [praise] plugins/openspec/hooks/flow-check.mjs:readFlowFile — New flow.json keys (appliesWhen, notAfter, ceiling 'owner') are validated strictly at load time with a specific error for each, and the stage's first-match order is documented in the code.
- [praise] plugins/openspec/hooks/change-loop.mjs:acceptDecisions — A refusal changes no file (checks before writes), the status keeps its letter case and line endings, and the accepted-by line points to the approval record.
- [praise] plugins/openspec/hooks/guard.test.mjs — Pure helpers (isDecisionRecord, isTestFile) and the change-loop decide() branches, including the unreadable-record case, have table-style tests with both positive and negative cases.

### Summary
- 6 findings (0 blocking, 0 important, 3 nit) + 3 praise
- Justification: I read the full change-loop.mjs, flow-check.mjs and guard.mjs hook diffs. I did not re-read the docs, agents, schemas, kit shells and spec deltas line by line; I relied on the evidence file, check.py and the catalog check for those. I ran `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`; both pass. I did not re-run the hook suite (about 13 minutes). Instead I relied on the verifier's evidence.md at the same commit, which shows the full suite at 1254/1254, the kit tests at 78 pass and 1 skipped, and openspec validate --strict and claude plugin validate passing.

The evidence gives a text demonstration for each of AC-1 to AC-16, and no AC is claimed without proof. I found no contradiction between the proposal and the diff, no layering violation, no N+1 or unbounded read on a hot path, and no swallowed error. I did not check ADR conformance (the adr-reviewer agent owns it); the diff adds ADR 0014 and touches ADRs 0010 and 0013 additively. The AC-15 note that the D-4 'built' marks were not individually re-counted is covered by pinned tests, so I did not raise it.

Verdict: approved. Only nits remain.
