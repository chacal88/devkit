<!-- devkit-stage retro result=passed attempt=1 commit=c09860c702c1266a024775fb3045bd822c313248 -->
# Retro: state-skips-unlocated

Change PR: https://github.com/chacal88/devkit/pull/106, merged at `086a53c` with train 8 (PR 128), tagged `v0.44.0`.

## Retro: state-skips-unlocated

1. Went wrong:
   - The branch merged the base six times while it waited (the train turned on, then trains 1, 4 and 6 left it behind on conflicts). Every merge brought a new pin into `docs/openspec-flow.md`, which this change also edits (the state paragraph), so the own-files rule (ADR 0025) staled the evidence and every review each time: the evidence reached attempt 7 and `review.md` holds six review calls, five of them only because of staleness, with product and test files unchanged.
   - Gates 1.4 and 2.3 name a whole test file (`node --test` of `change-loop.test.mjs` and `roadmap-loop.test.mjs`). Neither is a part of the train's command, so `deliver-check` refused a `train:` row for them, and each re-boarding re-ran 182 and 110 tests on the owner's machine.
   - The first hand merge put this change's tests into the split test files and lost three imports (`stopOf`, `nextAction`, `runTranscript`); only the full suite showed the four failures.
   - A `next --after` call with a key other than the step just carried out answered a false blocked ("returned with nothing changed"); a plain `next` was right.
   - The adr-reviewer found that the docs and ADR 0017 did not say `next`, `wait` and `session-next` still exit 3 for an unplaced change (important, three verifiers confirmed it); it cost a second round.
2. Better next time:
   - A plan whose files include the flow page should expect a stale evidence and review on every base merge until the pins stop counting as its own lines.
   - Name a phase gate by the train's command when the train runs it; keep a whole-file gate only when that file must pass before the train.
   - After moving tests between files in a merge, run each touched test file alone before the commit.
   - When a helper is deliberately left out of some commands, say which in the docs and the ADR note in the same task.
3. Remember: a release pin in a file a change edits makes every base merge cost a full evidence and review refresh.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The CI pins in `docs/openspec-flow.md` make the page an own file of every change that edits it, so each base merge stales evidence and reviews | process-friction | followup | project |
| 2 | A gate naming one whole test file is not a train part and needs a local passing row after every merge | process-friction | doc-update | project |
| 3 | Tests moved between files in a hand merge lose imports that only the moved file's own run shows | bug-class | memory-only | user |
| 4 | `next --after` takes only the progress key of the action just carried out; another key answers a false blocked | tooling | memory-only | user |
| 5 | `next`, `wait` and `session-next` still exit 3 for a change only another checkout holds | tooling | followup | project |
| 6 | The board's real run showed a "2 open of 1" header and a "Resumed" line for blocked lines (base behaviour, not this change's) | tooling | followup | project |
| 7 | Review nits left open: `stateEntries` reads the cache twice, `realpathSync` on a missing start folder, no test for a worktree on branch `<id>` without the change folder | tooling | followup | project |

## Proposed updates

### `openspec/config.yaml` (process-friction)
A context line that tells the planner and the readiness review to name the train's command for a gate the train runs, so evidence can record it as a `train:` row.
- before: "  Test history: A test never reads the repository's git history (CI checks out at depth 1); old content is held as a fixture or a constant."
+ after: "  Test history: A test never reads the repository's git history (CI checks out at depth 1); old content is held as a fixture or a constant.\n  Gates: A phase gate the delivery train runs names the train's command (`node scripts/test-suite.mjs`, `python3 scripts/check.py`); a gate naming one test file needs a passing local row after every base merge, so a plan uses one only when that file must pass before the train."
- Answer: approved
- Applied: yes

### user memory (memory-only)
After moving tests between files in a hand merge, run each touched test file alone before the commit: lost imports show only there or in the full suite.
- Answer: approved
- Applied: yes

### user memory (memory-only)
`change-loop.mjs next --after <key>` takes only the progress key of the action just carried out; any other key answers a false blocked, and a plain `next` is the safe call when unsure.
- Answer: approved
- Applied: yes
