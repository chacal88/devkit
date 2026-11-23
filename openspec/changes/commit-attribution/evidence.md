<!-- devkit-stage evidence result=passed attempt=2 commit=39fc4107702a06831758f56d9b3276fd1b72047e -->
Commit: 39fc4107702a06831758f56d9b3276fd1b72047e

# Evidence

Change: `commit-attribution` · Verified at HEAD `39fc410` on branch `commit-attribution` (clean tree). Pull request: https://github.com/chacal88/devkit/pull/68.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^commit-attribution" --test-name-pattern="^change-loop" --test-name-pattern="^project-loop" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^format:" plugins/openspec/hooks/guard.test.mjs` | pass: re-run at this commit, 382 tests, 382 pass, 0 fail, exit 0 |
| 1.6 | `python3 scripts/check.py` | pass: all checks passed, exit 0 |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite, 1568 tests, 1568 pass, 0 fail; read from the coordinating session's log `/var/tmp/ca-merge2-suite.log` (written 13 s before the HEAD commit, same tree), not re-run by the verifier |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed, exit 0 |
| 2.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.5 | `command claude plugin validate .` | pass: Validation passed, exit 0 |
| 2.5 | `openspec validate commit-attribution --strict` | pass: change is valid, exit 0 |
| 2.5 | `grep -qx "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" openspec/changes/commit-attribution/proof/ac3-trailers.txt` | pass: exit 0 |
| 2.5 | `test "$(grep -c . openspec/changes/commit-attribution/proof/ac3-trailers.txt)" = 1` | pass: exit 0 |
| 2.5 | `grep -q "devkit-core:commit-and-pr" openspec/changes/commit-attribution/proof/ac3-run.jsonl` | pass: exit 0 |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `brief-carries-lines`: every commit-agent hand-off of both loops and every dispatch row of `ship-change` and `devkit` carries the request; a test fails when one lacks it | The `commit-attribution AC-` tests (T1 to T36) are inside the 382-test focused run and the 1568-test suite log, all pass. `ac3-loop-actions.jsonl` holds the `commit` and `open-pr` actions as the loop prints them | pass |
| AC-2 | `agent-prefers-brief`: `commit-and-pr.md` says the brief's lines win; given lines it writes exactly those, given none it writes none | Tests T26 to T32 pass in the same runs. Real runs: `proof/ac3-none-message.txt` has 0 `Co-Authored-By` lines (`grep -ci` prints 0); `proof/ac3-pr-message.txt` ends with the Opus trailer, once | pass |
| AC-3 | one real run of the commit agent in a scratch project makes a commit with exactly the Opus trailer and no Sonnet line | `proof/ac3-trailers.txt` holds one line, the Opus trailer; `ac3-run.jsonl` holds the Agent call to `devkit-core:commit-and-pr`. Beyond it: `ac3-pr-gh-record.txt` PR body from a fake `gh` ends with exactly the footer line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; `ac3-loop-run.jsonl` (init model `claude-opus-5-5`, devkit-core and devkit-openspec loaded from this worktree) shows two Agent calls to `devkit-core:commit-and-pr`, each `prompt ends with the block: True` (`ac3-loop-extract.txt`); `ac3-loop-messages.txt` has 2 lines with `Opus 5.5` and 0 with `Sonnet`; `ac3-loop-gh-record.txt` body ends with the footer line. Each file's check is in `proof/ac3-checks.txt`; I re-read the outputs, I did not re-run the models | pass |
| AC-4 | every commit of the branch by the commit agent ends with the session's trailer | `git log --no-merges --format='%h %s%n%(trailers:key=Co-Authored-By)' "$(git merge-base origin/main HEAD)..HEAD"` at HEAD lists c5ac7df, ac5797c, 16eee42, 52fb4fa and 4ae67c9, each with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and no Sonnet line. `git log -3 --format='%h %s%n%(trailers:key=Co-Authored-By)'` shows the two merge commits 39fc410 and 11989f7 with the same single Opus trailer | pass |

No UI, API or deploy surface is touched; no screenshots apply. No PR comment was posted, as asked. The evidence commit itself, if made, is checked again in the retro (D-9).
