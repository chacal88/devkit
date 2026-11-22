Verdict: approved
Commit: db34efd887c7e8f8eb2cda8411708d611fe3c774

## Security audit — stage-roles (round 1)

### Findings

Triaged scope: high: `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/change-loop.mjs` (the new `accept-decisions` write path), `plugins/openspec/hooks/flow-check.mjs`, the role agents and the compozy templates. Medium: schemas and `flow.json`. Low: docs, ADR 0014 and tests.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- injection — `accept-decisions` reads record paths from `decisions.md`. `readRecord` rejects absolute paths, anything outside the repository (`relative()` starts with `..`) and anything not a `.md` file in an adr, adrs or decisions folder. A symlink planted inside such a folder would already need write access to the repository.
- authz — the `approval.md` gate still allows only the main session. `accept-decisions` refuses unless `approvalState` is current and `approval.md` has a Date line. It checks every record before the first write, so a refusal changes no file. A subagent cannot bypass it without a current owner approval.
- authz — `adr-author` is limited to decision-record files. `e2e-tester` is limited to test files and only after readiness is APPROVED. The loose test-name regex (for example `ci-test.yml`) lets `e2e-tester` write a few non-test files, but only after approval. Only the agent that writes tests can do this, and it is not a trust boundary the diff weakens, so I did not report it.
- exposure, crypto, secret, config — no new secrets or tokens, and no fail-open defaults. The `.claude/` exemption was already there. The new settings fall back to defaults and report bad values rather than hiding them.
