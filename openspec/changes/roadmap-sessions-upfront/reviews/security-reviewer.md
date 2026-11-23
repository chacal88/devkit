Verdict: approved
Commit: 123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0

## Security audit — roadmap-sessions-upfront (round 1)

### Findings

Triaged scope: high: guard.mjs (skill entry gate), hooks.json, roadmap-loop.mjs (tickets, push, merge-base, check, session-wait, kill of waits); medium: change-loop.mjs, conduct-check.mjs (ADR renumber override), schemas, skills and agents; low: docs, ADRs, tests, CHANGELOG, OpenSpec change files.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- injection (push, merge-base, session-next): git runs through execFileSync with an argument array and no shell; change id validated by changeIdOf/isChangeId, --what limited to grill|plan, paths after `--`, branch from git (cannot start with `-`), push refuses the default branch.
- injection (check prompt): interpolates only the plugin path, a normalised lang and a numeric limit; --check-id is only recorded.
- injection (ADR renumber): names come from git ls-tree filtered by a four-digit pattern; it only emits an instruction for the implementer, it runs nothing.
- authn/authz (entry ticket): a workflow guard, not a security boundary; randomBytes(8) hex, claimed once under the run-file lock, other sessions refused, any error refuses (fail-closed); the owner's typed command still runs the change.
- crypto (non-constant-time ticket compare): a local one-use token gating no data, not a credential comparison.
- process kill of waits: PIDs from the local run file, an extension of an existing mechanism; the run's own pid is skipped; planting needs write access to repo state.
- exposure (git error text in replies): the owner's own local git output; no credential handled.
- config: no fail-open default; the skill guard fails closed; the change-session stop needs a claimed ticket matching the session id.
- secret: no secret-looking files or credential patterns in the diff.

Out of round: nothing found.

Verdict basis: zero exploitable true positives after the filter, so approved.
