Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## Security audit — roadmap-sessions-upfront (round 2)

### Findings
- [nit] plugins/openspec/skills/devkit-session/SKILL.md:28 (merge-base exit 3) — The new merge-base exit-3 step tells the agent to paste the JSON `error` (git merge output, which can contain conflicting file names) inside a double-quoted `--param error="..."` shell argument, although the JSON already carries a rendered `reply`; the same pre-existing pattern is in devkit/SKILL.md (write-back-failed, accept-decisions), so no blocking finding, but a file name with `$(...)` could expand if pasted unescaped. Consider saying the reply is shown as the JSON gives it, or that the value is single-quoted.

Triaged scope: high: guard.mjs (skill entry gate, leading-note parsing), roadmap-loop.mjs (wait-process kill, push, merge-base, check, pruneRecords), hooks.json; medium: change-loop.mjs (triage section reader), conduct-check.mjs (ADR renumber override), schemas, devkit-session skill; low: the 877026a ADR renumber (comments and strings), the evidence commit, tests and docs. Judged: git diff origin/main...HEAD and the change's own commits since 123a7ba (6fab305, 84da7ff, 877026a, f7c5945); what main brought (release-tags, deliver-check.mjs, releaseTagSetting) was not judged.

Previous findings: round 1 (commit 123a7ba) was approved with no findings, so there is nothing to re-list.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- process kill of waits (isWaitProcess): hardening; a pid is signalled only when ps shows a roadmap-loop wait command line; integer-checked pid, argument array, no shell; a ps error gives false, so a recycled pid is never killed.
- skill guard split (namesEntrySkill before the import): another skill is allowed without loading roadmap-loop.mjs; a call naming the entry skill still fails closed on any error, import included, and still needs the one-use ticket.
- withoutLeadingNotes / startedTaskOf: strips only leading system-reminder blocks; an unclosed block gives null, so the entry is refused; a forged note cannot skip the ticket, which is claimed under the run-file lock.
- pruneRecords: deletes placed/queued entries of ids no longer open, in memory under the lock; no access widened.
- triageSection / hasTriageSection: a parser refactor; an unreadable file gives [].
- adrClash (ADR renumber): git through an argument array, no shell; names from git ls-tree/diff filtered by a four-digit pattern; it only emits an instruction for the implementer.
- mergeBaseCmd and pushCmd via gitIn: execFileSync with an argument array, no shell; change id validated, --what limited to grill|plan, paths after --, push refuses the default branch.
- unpushedOf using approval.md as the plan-push record: workflow bookkeeping, not an authorization boundary.
- secret and config: no secret-looking files or credential patterns; no fail-open default added.
- crypto: the entry ticket comparison is non-constant-time, but it is a local one-use workflow token that gates no data.

Out of round: nothing found.

Verdict basis: zero exploitable true positives after the filter; the only note is a nit. The test suite was not run (13 to 21 minutes); no finding depended on it.
