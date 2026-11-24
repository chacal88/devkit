<!-- devkit-stage review result=failed attempt=1 commit=22230be382d0c7f9cbb7f18c6abd865125b602e1 -->
# Review: run-status-bar, round 1

Path: agents · range `8085104..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 22230be |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 22230be |
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | 22230be |
| test-coverage-reviewer | rejected | 0 | 3 | 3 | 0 | 22230be |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 22230be |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/status-line.mjs:158-172 — On abort or the 20 s bound only the state child is killed (SIGTERM); its synchronous openspec/gh grandchildren (60 s timeouts) are orphaned and keep running (reproduced with a spawnSync child), contradicting the design's no-piling-up claim; the abort test uses a fixture with no grandchild. Fix: spawn state detached and kill the process group, with a test whose fixture spawns its own child, or narrow the claim.
- test-coverage-reviewer — [important] plugins/openspec/hooks/status-line.mjs:222-230 (spec scenario "The run is aborted") — [6] The real-process wiring (`process.on` for SIGTERM, SIGINT and SIGHUP into the AbortController) is never exercised. The tests only abort `main` through an injected signal, and no test signals a real status-line process. Deleting the loop, or dropping SIGHUP from the list, leaves the suite green, and a state child could then outlive the status line. Write in: status-line.test.mjs, in the 'abort' invariant (B-19). Spawn BAR with the stateStub sleeping as the state command (the pid file shows the child ran), send each of the three signals, and assert the child pid is dead once the bar has exited. `main` takes `stateCommand`, which the real process does not, so this needs a way to point the real process at the stub, for example an env override. Otherwise cover it as real-run evidence (a run with a slow `state`, then SIGTERM, then `ps`).
- test-coverage-reviewer — [important] plugins/openspec/hooks/status-line.mjs:189,194,211 (spec "The line is in the person's language": pass it to the state command) — [6] No test asserts that `--lang pt-BR` reaches the state call. Every argv assertion uses the default `--lang en`, and the stub returns canned text. Hard-coding 'en' into `ask`, or passing a different value from the one `main` normalizes, leaves the suite green, and the line would mix pt-BR own-words with English stage titles and reasons. Write in: status-line.test.mjs, next to the choice tests. Run `bar(..., { argv: ['--lang', 'pt-BR'] })` for the coordinator and the worktree views and assert `argvOf(stub)` equals `[['state','--offline','--lang','pt-BR']]` and `[['state','--change','feat','--lang','pt-BR']]`. Add one case with a language that is neither (`fr`) expecting the normalized value.
- test-coverage-reviewer — [important] plugins/openspec/README.md and docs/openspec-flow.md: the `statusLine` command snippet — [5] The settings.json shell snippet is the only wire between Claude Code and `status-line.mjs`, and nothing runs it. A wrong plugin name or cache layout, or a glob or `sort -V` portability problem, ends in `[ -n "$f" ] &&` and an empty bar with no error. The evidence runs `status-line.mjs` directly and not through the snippet. Write in: status-line.test.mjs (or a docs test beside the pinned-docs tests in change-loop-compozy.test.mjs). Extract the `command` string from the README JSON and run it with `sh -c` against a fake `CLAUDE_CONFIG_DIR/plugins/cache/<market>/devkit-openspec/<0.9.0|0.10.0>/hooks/status-line.mjs`. Assert it picks the highest version (the `sort -V` case) and prints nothing and exits 0 when no copy exists. A first-install check by hand after release would also do.

## Refuted by verification
None.

## Notes
None.

## Next
Fix the open findings, then run review-change again (round 2).
