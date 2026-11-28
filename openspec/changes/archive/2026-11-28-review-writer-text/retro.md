<!-- devkit-stage retro result=passed attempt=1 commit=63cb3168193ce28683787d82964395005d4086e1 -->
# Retro: review-writer-text

Change PR: #164 (merged on train 22, PR #165).

1. Went wrong:
   - The change was opened in its own worktree (`.claude/worktrees/review-writer-text`) by an earlier session, but the session that ran it was locked to another worktree: the first decisions agent refused to write there, and the change had to be moved (commit, remove the clean worktree, check the branch out in the session's own worktree) before any stage file could be written.
   - The pr-verifier recorded the real-run proof (task 2.2) before the plan's own validation tasks (2.3, 2.4) and the last gate (2.9) ran, so it wrote AC-6 as "no proof". The review then passed, and `deliver-check` blocked item 4 at delivery; a second pr-verifier pass was needed to record the validate output and the last gate.
   - The openspec CLI is not on PATH on this machine; every `change-loop.mjs` call and every agent brief had to add another project's `node_modules/.bin`.
   - The machine ran five changes' tests at once (load up to 27 on 8 cores); the last gate waited for the load to fall below 12 and ran at concurrency 2 (635 s).
   - After the train merged, the session fast-forwarded the branch to `origin/main` before the retro, and the loop read the evidence as stale; detaching at the PR's head restored it.
2. Better next time:
   - Open a change in the worktree of the session that will run it, or start the session in the change's worktree.
   - Order the plan so the proof hand-off to the pr-verifier comes after every task whose result an acceptance criterion names (validation tasks and the last gate), or have the pr-verifier record a gate-owned criterion as pending for the conductor to fill.
   - Leave a delivered branch at its merged head until the retro is written.
3. Remember: an acceptance criterion proven by a later task gets its evidence row only after that task runs; record the evidence once, after the last gate.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A session locked to its own worktree cannot run a change opened in another worktree; the change had to be moved | process-friction | rule | project |
| 2 | The proof hand-off ran before the tasks that prove AC-6, so delivery blocked on "no proof" after the review passed | process-friction | rule | project |
| 3 | The openspec CLI is missing from PATH on the Avell | tooling | memory-only | user |
| 4 | The writer's summary prints "1 findings" for a count of one (review nit F3) | bug-class | followup | project |
| 5 | Fast-forwarding a delivered branch before the retro stales the evidence for the loop | process-friction | memory-only | user |

## Proposed updates

### `openspec/config.yaml` (rule)
A tasks rule: the task that hands the proof to the pr-verifier comes after every task an acceptance criterion's proof depends on (validation commands, the last gate), so `evidence.md` holds every criterion before the first review round.
- before: `After the last phase, dispatch devkit-core:pr-verifier (writes evidence.md; a defect is fixed and the evidence recorded again), then run review-change for this change (each reviewer writes reviews/<reviewer>.md)`
+ after: `After the last phase, dispatch devkit-core:pr-verifier (writes evidence.md; a defect is fixed and the evidence recorded again), then run review-change for this change (each reviewer writes reviews/<reviewer>.md). A task that hands proof to the pr-verifier comes after every task whose output an acceptance criterion names (a validation command, the last gate).`
- Answer: approved
- Applied: yes

### `CLAUDE.md` (rule)
A working rule: a change runs in the worktree of the session that runs it; a session started for a change that another session opened in a different worktree moves the change into its own worktree before the first stage, or is started in that worktree.
- before: `- Every code change happens in a worktree named after its change; the root checkout stays clean.`
+ after: `- Every code change happens in a worktree named after its change, the worktree of the session that runs it; the root checkout stays clean.`
- Answer: rejected: the cost came from starting a session outside the change's worktree, which the helper-conductor change removes (no session per change); CLAUDE.md stays as it is

### Follow-up (followup)
The round's summary line pluralizes a count of one ("1 findings"); the wording is pinned in `SKILL.md`, the spec delta, the tests and the evidence, so a fix changes every copy in one commit.
- Answer: rejected: a nit
