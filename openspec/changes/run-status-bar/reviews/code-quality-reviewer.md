Verdict: approved
Commit: 3a53ac94b3676d8063672b1a3b9887f806956424

## Quality review — run-status-bar (round 2)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:158-172 — On abort or the 20 s bound only the state child was killed (SIGTERM); its synchronous openspec/gh grandchildren were orphaned, contradicting the design's no-piling-up claim; the abort test used a fixture with no grandchild. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [nit] CHANGELOG.md (0.45.0 entry) — Claimed the bar starts no process but node and git while the state it runs starts openspec and gh; now says the bar itself starts only node and git and that state keeps its own reads. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [nit] docs/openspec-flow.md and plugins/openspec/README.md (statusLine snippet) — The snippet hardcoded --lang pt-BR with no word on English; both now say --lang en gives English and that with no copy the command prints nothing and exits 0. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [praise] plugins/openspec/hooks/flow-check.mjs (notApplicableOf, appliedStages) — One shared helper for the stage-applies rule used by artifactState and the new stages field; refactor is behaviour-preserving and pinned per code.
- [praise] plugins/openspec/hooks/merge-setup.mjs, roadmap-loop.mjs — OFFLINE_GH has a single home and a test asserts roadmap-loop defines no copy.
- [praise] plugins/openspec/hooks/status-line.test.mjs — Every declared variant (states, strip positions, each cut step, the 100-column boundary, archive branch, mismatched entry, abort, open stdin) has its own test, plus a source scan pinning read-only and mock-up lines.
- [nit] plugins/openspec/README.md:46 and docs/openspec-flow.md (statusLine snippet, `[ -z "$f" ] || node "$f" --lang pt-BR`) — macOS /bin/sh (bash 3.2) forks node under sh instead of exec'ing it (probe: node ppid == outer sh pid), so a signal Claude Code sends only to the command's pid never reaches the bar's SIGTERM/SIGINT/SIGHUP wiring and the state call runs to the 20 s bound; follow-up: end the snippet with `|| exec node "$f" --lang pt-BR` (Claude Code's kill mode, pid or group, not verified here).
- [praise] plugins/openspec/hooks/status-line.test.mjs:142-146, 174-235 — stillAlive polls each pid to ESRCH under a deadline instead of a one-shot liveness check, and the signal test drives the real bar on the real state with an openspec shim first on PATH and a finally that SIGKILLs leftovers: load-safe and leak-free process tests.
- [praise] plugins/openspec/hooks/status-line.test.mjs:242-291 — The snippet test parses the command from the README's own JSON block, runs it via sh -c against a fake plugin cache (sort -V, empty cache, $HOME fallback) and pins that docs/openspec-flow.md carries the same text: one source for the pasted command, proven by execution.

### Summary
- 9 findings: 1 important and 2 nits from round 1, all fixed in 792fde6; 1 new nit (F7) left open as a follow-up; 5 praise. The new nit, the 5 praise and the 2 fixed nits do not change the verdict.
- Justification: this is a re-review of round 1's findings and of the lines changed since 22230be. Main's own commits from the merge f4bad47 were left out.
  - F1 checked in the code: `stateText` now spawns with `detached: true`. `stop` runs `process.kill(-child.pid, 'SIGTERM')` and falls back to `child.kill`. The promise still settles on the child's `close`.
  - F1 checked in the tests: a new test covers the bound and an abort with a stub that starts its own grandchild, in both views. A second new test sends SIGTERM, SIGINT and SIGHUP to the real bar while the real `state` waits on an `openspec` shim placed first on PATH, and asserts the shim's pid is gone.
  - F1 in the design: D-9 in design.md records the fix (3a53ac9). The D-1 snippet now matches the README and the flow doc, which closes the drift that evidence.md noted.
  - Nits: the CHANGELOG wording and the `--lang en` sentence are present in both documents (792fde6).
  - Merge resolution: the release files move devkit-openspec to 0.40.0 and the marketplace to 0.45.0. The CI pin in docs/openspec-flow.md moves to v0.40.0. change-loop-compozy.test.mjs pins v0.40.0 and refuses v0.39.2. All of these are consistent with each other.
  - 0528b85 swaps the one-shot liveness check for a poll until a deadline. It does not weaken any assertion; the stdin bound only goes from 5 s to 8 s, which is still under the 10 s default that test is there to catch.
- Ran once in the foreground: `status-line.test.mjs` and `change-loop-compozy.test.mjs` with the prescribed env and `--concurrency=2`: 2 files, 381 tests, 381 pass, 0 fail. I did not re-run the whole suite or `guard.test.mjs`, as instructed. The suite result given to me was 40 files, 3165 tests, 0 fail at 0528b85; the commits after it touch only `openspec/`.
- Noted, not a finding of this reviewer: evidence.md records that origin/main 49d865f already ships devkit-openspec 0.40.0 and marketplace 0.45.0. The next main merge or the train renumbers this release and makes this evidence stale.
- Side note on F7: because the state group is detached, a SIGKILL sent to the bar's whole process group no longer reaches the state call. Before this change it would have. The bar's own 20 s bound does not apply in that case, so the state call ends only on its own timeouts. That depends on how Claude Code kills the command, which I did not check, so it is not a separate finding.
