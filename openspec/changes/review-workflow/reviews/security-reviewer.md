Verdict: approved
Commit: 4955dcf7d55dd2206b54ce7c6f0ebeb940343195

## Security audit — review-workflow (round 1)

Triaged scope: high: finding-verifier.md, review-round.workflow.js, review-round.mjs, reviewer agents' staged-round text, guard.mjs (unchanged, re-read), deliver-check.mjs fix-review hunk; low: docs, ADR 0008, tests, manifests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection (shell) — no command is built from finding text: the CLI takes only `--input <file>` (review-round.mjs:160-170) and no exec/spawn exists in the script or CLI; the SKILL.md node commands carry only paths.
- injection (prompt, finding text to verifier/writer) — finding text is flattened by oneLine (newlines, `·` stripped, capped at 2000 chars; workflow.js:57-60, 98-121) and the same text already reaches the verifier by reading the attacker-controlled code; an attacker able to steer a reviewer can already suppress the finding, so the verifier channel adds no new capability.
- authz (verifier writes reviews/*) — finding-verifier has Bash but no Write/Edit (finding-verifier.md:4). Guard role() takes the agent_type suffix (guard.mjs:61); classify() gives reviews/<x>.md owner x (guard.mjs:211) and writeViolation blocks any other actor, including through bashWrites (guard.mjs:357-375). Verdict, readiness and approval files are therefore not writable by it. "Read-only" is a prompt rule plus this guard, the same as codebase-researcher and plan-reality-auditor (pre-existing pattern).
- authz (session or non-reviewer writes a verdict) — guard.mjs has no diff in origin/main..HEAD; stage 3 runs the writer as devkit-core:<reviewer> (workflow.js:327), so the one-writer rule holds. A reviewer actor is blocked from any other file (guard.mjs:231-233).
- exposure (sections written verbatim) — `sections` is the reviewer's own free text, written by that same reviewer; line 1 and line 2 are fixed by the writer prompt and finding lines are flattened, so a finding cannot forge extra verdict or commit lines.
- config — deliver-check.mjs hunk only widens fix-review to approved-with-undisposed findings (fail-stricter, not looser).

### Findings (TRUE POSITIVE)
None.

### Notes (non-blocking, out-of-round)
- On the workflow path the writer's file is not re-checked by the script (only `written: true` is read, workflow.js:329-333); the check-file CLI exists for the agents path. Integrity of line 1/2 on the workflow path rests on the writer prompt and the deliver-check gate at the current commit. Not exploitable in this diff.
- finding-verifier is absent from the guard's role lists, so a prompt-injected verifier could write planning files through Bash (not gate or code files). Same as other existing Bash-only agents; harden only if the owner wants.
