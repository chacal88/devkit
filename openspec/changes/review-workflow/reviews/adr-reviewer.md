Verdict: approved
Commit: 01ee2969e180f353ff1752bf655688839976fa96

## ADR review — review-workflow (re-review, round 1, range 4955dcf..01ee2969e180f353ff1752bf655688839976fa96)

ADRs reviewed: 0001 (`docs/adr/0001-coordination-without-a-harness.md`), 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), 0006 (`docs/adr/0006-phases-as-child-sessions.md`), 0007 (`docs/adr/0007-one-change-on-request.md`). Others unchanged in scope; no file under `docs/adr/`, no hook and no gate file changed in the range.

Checked in the range:
- `plugins/core/skills/review-change/scripts/review-round.workflow.js`: the new `VERIFIERS`, `verifyJobs`, `groupVotes` and `writeMismatch` sit in the pure rules section. The script still starts no session, schedules nothing and writes no state; the round stays inside the session (0008 Decisions 2 and 3, 0006, 0007).
- Stage 3 still uses `devkit-core:<reviewer>` as the single writer of its own file, and `finding-verifier` for votes. The new `writeMismatch` check (a returned verdict or commit that differs from the outcome fails the write) makes the gate stricter, not looser (0008 Decision 4, one writer per gate file).
- `review-round.mjs`: the CLI takes its jobs from the same rules, so the `agents` path and the Workflow path share one source. Pack file, no new tool or state (0008 Decision 3).
- `design.md` D4/D5 now describes this behavior and does not contradict 0008.
- Tests are in the pack; no ADR section pinned by tests was touched.

### Findings
- [nit] `docs/adr/0001-coordination-without-a-harness.md:39-41` — carried over, unchanged: the Note's new sentence is hard-wrapped short; reflow to the file's usual width. Cosmetic.
- [nit] `docs/adr/0008-reviews-as-a-workflow.md` Review trigger — carried over, unchanged: consider naming 0001's own trigger as a cross-reference. Not required.

No previous [blocking] or [important] findings existed. No new findings in the range.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
