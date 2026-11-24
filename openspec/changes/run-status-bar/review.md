<!-- devkit-stage review result=failed attempt=1 commit=a46bf795f7bb603ae110183d20a8cd1f5630596a -->
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

# Review: run-status-bar, round 2

Path: agents · range `22230be..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 3a53ac9 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 3a53ac9 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 3a53ac9 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 3a53ac9 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 3a53ac9 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- code-quality-reviewer F7 (nit, follow-up): the statusLine snippet does not exec node, so on macOS a signal sent only to the command pid does not reach the bar.
- spec-reviewer F1 (nit): a one-word reason is dropped at once instead of cut to <word>…; the spec does not say which is meant.

## Next
Ready to ship.

# Review: run-status-bar, round 1

Path: agents · range `3a53ac9..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | a46bf79 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | a46bf79 |
| code-quality-reviewer | rejected | 1 | 0 | 1 | 0 | a46bf79 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | a46bf79 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | a46bf79 |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [blocking] plugins/openspec/hooks/change-loop.mjs:3098 (OFFLINE_GH into stateEntries) via plugins/openspec/hooks/deliver-check.mjs:1696 and merge-setup.mjs:130-132; claim at openspec/changes/run-status-bar/desi… — With --offline in a merge-mode project a change at the code review stage reads blocked/merge-setup (mergeSetup fails on the unreadable repo settings, deliver-check returns stop-merge-setup), so the coordinator bar (status-line.mjs:119, the only --offline caller) counts every reviewed change as ⛔ blocked, against AC-3 and the design's claim that GitHub-needing stages read waiting-on-github/silent; probe on this branch: `state --change run-status-bar --offline --lang en` gives state blocked, reason merge-setup, while the same call without --offline gives running; change-state-stages.test.mjs has no offline test on a merge-mode fixture at review. Fix: when gh is OFFLINE_GH, read an unreadable merge setup as GitHub silent (no stop-merge-setup), and add an S-test at the code review stage of a ship: merge fixture.

## Refuted by verification
None.

## Notes
- A re-check made only because the verdicts went stale after the merge of origin/main d917ae0 (aa8a685); it starts at round 1.
- code-quality-reviewer F10 is older than the re-check range (from 545ef5b) but blocking, so it counts; three verifiers reproduced it.

## Next
Fix the open findings, then run review-change again (round 2).
