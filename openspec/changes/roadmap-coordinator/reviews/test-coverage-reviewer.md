Verdict: approved
Commit: ba000172e43ae6b2bfc979d744bcc6da7b045c13

## Coverage analysis — roadmap-coordinator, round 2 (9307ba1..HEAD)

### Findings
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:652 — [3] `run` without --session is refused (exit 3) in code, but no test omits the flag. Write in roadmap-loop.test.mjs beside U1-U4.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:378 — [3] Lock timeouts were untested. The shared helper's wait, timeout and takeover are now tested in change-loop.test.mjs (three withLockFile tests with an injected sleep). What stays open is that no test makes updateRun or withOpenLock time out through their own wiring (the error message, the `sleep` passthrough). · fixed in a6df7b95c5cddc634f46c2ede89aa48a1c60f337
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:1790-1921 — implementation-coupled: skill and docs tests pin SKILL.md and doc prose by regex; a rewording turns them red with no behavior change.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:712 — [2] draft's fallback to en when the language setting is unknown has no test.
- [nit] plugins/openspec/hooks/guard.mjs:458 — [2] `mainInRun` hands the same events to both readers; no test fails if it scanned twice. The read-once counting test goes through `lock()` and the three change-run modes, not through the roadmap branch or `mainInRun` (the product-edit path). A regression would cost an extra read, not a wrong decision.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, guard.mjs, roadmap-loop.mjs and their tests). The evidence-only commit ba00017 is not code.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- `withLockFile` extraction, open lock side: the existing real-process open-lock tests from round 1 still apply, and the three new withLockFile tests pin the helper.
- `withLockFile` extraction, run file side: the existing updateRun tests (concurrent writers, stale lock, broken file) still apply.
- `sleep` passthrough in updateRun: passing `undefined` falls back to the default through the destructuring default. The withLockFile test pins the injected-sleep contract: sleeps are `[10,10,10]`, the other holder's lock is untouched and the caller's error is thrown.
- `transcriptEvents`: two new tests cover event order, skipped meta, blob, assistant and sidechain lines, the three stored forms of a tool result, and null on a missing file, no path or null input.
- `runOf` and `roadmapRunOf` interpreting passed events: a test gives an unreadable path plus events and shows runOf still answers from the events, so a re-read would turn it red. The reader and interpreter rows from round 1 still run through the same code.
- Read once per hook call: a real child process with a `readFileSync` spy preload counts exactly one read for `stop`, `subagent-stop` and `agent` in a change run. It also asserts the same refusals (exit 2) as before. A second scan in `lock()`, or a `runOf` that ignored the passed events, would turn it red.
- `events` threaded into `stopDecision`, `subagentStopDecision` and `agentDecision`: covered by that same test. Calls without events keep the old self-scan, covered by the existing lock tests.
- Evidence commit: AC-8 and AC-10 rest on real runs of the stop word and the draft roadmap, recorded in evidence.md and under proof/evidence-runs/. A unit test cannot replace them.

### Well covered
- The one-scan refactor kept behaviour: every earlier runOf and roadmapRunOf test (typed commands, skill body, marker forms, `/devkit status`, a later typed command ending the run) goes through the new code and is unchanged.
- The lock helper's three paths (acquire and release with the holder text, wait then caller's error, stale takeover) each have a named test with an injected sleep, so none waits in real time.
- The read-once claim is measured on real processes, not asserted on a mock.

Round 1 verdict was approved with nits only; F1, F3 and F4 are unchanged.
