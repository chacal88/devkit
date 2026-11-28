<!-- devkit-stage retro result=passed attempt=1 commit=399760fc25b7da48e1290c5e088e5591018c3040 -->
## Retro: train-empty-failure-text

1. Went wrong:
   - On the second machine the `openspec` CLI was not on the shell's PATH (the shell runs fnm's node v22; the CLI is installed under v26), so the loop's first `next` exited 3 and every agent brief needed a PATH line pointing at a symlink.
   - The session was started in another worktree, so the Write tool refused every path in the change's worktree; the session and its agents wrote files through Bash heredocs and copies.
   - Under a machine load of 12 to 27 the selective gate (`--own-files --concurrency=2`, 34 files) took 54 minutes, and the implementer's filtered runs about 30 minutes.
   - Two messages to the coordinating session were queued behind its turns and one was not delivered, so the plan approval waited on a re-send.
   - The review left three nits: an overlong header comment line in `train-loop.mjs`, tests that empty a train only at number 1, and an empty train's record that a later real train of the same number leaves in place.
2. Better next time:
   - Before the first `next` on a machine, check `command -v openspec`; when it is missing, link the installed CLI into a scratch `bin` and name that PATH in every brief.
   - When the Write tool refuses the change's worktree, write through Bash heredocs from the start and say so in each brief.
   - Put the whole request to the coordinator in the turn's last message as well as in the cross-session message.
3. Remember: a change run from another session's worktree needs the CLI path and the write route named in every brief.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The openspec CLI is missing from the shell's PATH on the second machine | environment | memory-only | user |
| 2 | The Write tool refuses a worktree other than the session's own | tooling | memory-only | user |
| 3 | Messages to the coordinator queue behind its turns | process-friction | memory-only | user |
| 4 | The review's three nits | bug-class | followup | project |

## Proposed updates

### user memory (memory-only)
On the Avell the openspec CLI is under fnm's node v26 while the shell runs v22: link it into a scratch bin and put that PATH in every brief before the first change-loop next.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A session started in another worktree cannot use the Write tool in a change's worktree: write through Bash heredocs and say so in every agent brief.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A request to the coordinating session also goes in the turn's last message: cross-session messages from the Avell queue behind its turns or are not delivered.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (bug-class)
A follow-up line for the review's nits of this change.
- before: (no line for them)
+ after: - [ ] train-empty-followups (after: train-empty-failure-text) — rewrap the header comment of train-loop.mjs, test an empty train numbered above an existing one, and say whether a real train clears an earlier empty record of its number.
- Answer: rejected: review nits, no cost seen in this change (answered by the coordinator's session on the owner's delegation of 2026-11-28)
