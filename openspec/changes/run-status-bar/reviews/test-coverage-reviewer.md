Verdict: rejected
Commit: 9ad0f6fa551bb7269b21fd0240956c91e0bb15cc

## Coverage analysis — run-status-bar, round 2 re-check (a46bf79..9ad0f6f: the F10 fix accaace, the tasks preamble 3198a03, the refreshed evidence 9ad0f6f and the review record deb9835)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:222-230 — [6] Nothing ran the real wiring of SIGTERM, SIGINT and SIGHUP to the AbortController; deleting the loop or dropping SIGHUP left the suite green. · fixed in 792fde6
- [important] plugins/openspec/hooks/status-line.mjs:189,194,211 — [6] No test checked that a --lang other than en reaches the state call; hard-coding 'en' in ask left the suite green. · fixed in 792fde6
- [important] plugins/openspec/README.md and docs/openspec-flow.md: statusLine snippet — [5] Nothing ran the settings.json statusLine command, the only link from Claude Code to status-line.mjs (cache layout, sort -V, the exit with no installed copy). · fixed in 792fde6
- [nit] plugins/openspec/hooks/status-line.test.mjs:816-842 and change-state-stages.test.mjs:186-197 — Implementation-coupled: these tests match the source text with regexes (fs import names, write calls, spawn arguments, the stub's body); the behavioural read-only and offline tests already protect the contract.
- [nit] plugins/openspec/hooks/status-line.mjs:215 (normalizeLang default) — With no --lang the bar falls back to pt-BR; the spec names no default and no test pins the case with no --lang.
- [nit] plugins/openspec/hooks/status-line.test.mjs:104-110 (stillAlive), used at :431, :449 — [3] The up-to-10 s poll no longer checks that stateText settles only after the child has ended; a stateText that resolved at stop() would still pass.
- [praise] plugins/openspec/hooks/status-line.test.mjs:179-212, 151-174 — The round-1 fix is tested at the seam: the real bar on the real state with an openspec shim first on PATH, each signal sent to the real process, and a grandchild test for the process-group kill.
- [nit] plugins/openspec/hooks/change-loop.mjs (USAGE, merge resolution) — [2] Only main's `merge-check <id>` part of the USAGE line is test-pinned (change-loop.test.mjs:2288); dropping this change's `[--offline]` from the help text would leave every test green.
- [nit] openspec/changes/run-status-bar/tasks.md 3.4 and evidence.md (Notes for the owner) — No whole suite has run under GITHUB_HEAD_REF/GITHUB_BASE_REF at the merged head (last at 0528b85), and the train does not set them; 3198a03 now says so in the preamble, so wait for the PR's `check` job by run id before calling the head CI-green.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:361-364 — The release pin is derived from the manifest with no literal version, so a renumber that misses a pin turns red.
- [important] plugins/openspec/hooks/change-loop.mjs:1403 (`step === 'stop-merge-setup' && facts.offline`) — [5] Only the offline half of the new guard has a negative test (S-9b online); without the step conjunct, --offline turns stop-branch, stop-not-approved, stop-archive and pr-problem into waiting-on-github/silent (a wrong-branch change leaves the coordinator's ⛔ count) and no test fails. - write in: change-loop.test.mjs next to B14 (:478), the same rows run through build(rowOf(step), { offline: true }), each still ['end','blocked',why,2]
- [nit] plugins/openspec/hooks/change-loop.mjs:1403 (`silent(currentId, row.next.reason)`) — [2] The detail.error the offline merge-setup end carries (the checker's reason) is not asserted; passing undefined or the wrong field leaves S-9b green. It is not shown on the bar, so this is a nit.
- [praise] plugins/openspec/hooks/change-state-stages.test.mjs:156-173 (S-9b) — The F10 fix is tested at the seam: the real CLI process on a merge-mode fixture, the online contrast (blocked/merge-setup/review) and the offline read (waiting-on-github/silent/review) with no gh call. The `gh === OFFLINE_GH` identity in nextAction cannot be mutated either way without one half going red.

In-scope surfaces: plugins/openspec/hooks/change-loop.mjs (the `offline` fact in nextAction, the `silent()` helper, the offline route of `stop-merge-setup` in decide, the refactor of blockedEnd), plugins/openspec/hooks/merge-setup.mjs (comment only), plugins/openspec/hooks/change-state-stages.test.mjs (S-9b), and in the change folder tasks.md (preamble), evidence.md, review.md and reviews/.
Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- **`offline: gh === OFFLINE_GH` (change-loop.mjs:1550)**: caught by S-9b both ways. Forced `false` makes the offline part read blocked/merge-setup. Forced `true` makes the online part read silent. The identity only matches on the `state --offline` path (change-loop.mjs:3102). `roadmapAgentDecision` passes `OFFLINE_GH` only to `openOnRoadmap`, which calls `unfinished` and `archivedOnDefault` and never calls nextAction, so the roadmap hooks get no new behaviour.
- **The `facts.offline` conjunct at change-loop.mjs:1403**: caught by S-9b online, and by B14 (change-loop.test.mjs:478, `stop-merge-setup` gives `merge-setup` when no offline fact is set).
- **The `step === 'stop-merge-setup'` conjunct at change-loop.mjs:1403**: gap (F11). No test runs `--offline` (or `decide` with `offline: true`) on the other blocked steps.
- **blockedEnd now calls `silent()` (change-loop.mjs:1348)**: caught by S-9 (offline at the delivery checks reads waiting-on-github/silent) and by the existing gh-silent end tests.
- **The bar's count on this state**: no new code in status-line.mjs. The ⛔ count reads the state, and the count tests cover it. Evidence real runs F4/F5 show the bar on the S-9b fixture, and F6/F7 show the same runs on the 83650a5 code printing the defect, so the fix was seen red before it and green after.

Run: change-state-stages.test.mjs once at HEAD, with TMPDIR=/private/tmp/devkit-run-status-bar, GITHUB_HEAD_REF=probe-branch, GITHUB_BASE_REF=main and --concurrency=2: 22 tests, 22 pass, S-9b among them. Every other number comes from the caller and evidence.md: 515/515 and 182/182 at accaace, gates 1.7 (694/694) and 2.5 (342/342, 4/4) at 3198a03, whose plugins/ is the same as HEAD's. No whole suite was run here, as instructed.

Change-folder edits: the 3198a03 preamble now says the 3.4 suite part is the train's, not run with the CI branch variables. That matches evidence.md and is why F9 stays a nit, not a gap. evidence.md states plainly what ran, who ran it, and that no whole suite ran at this head. review.md and the other reviews/ files record round 1 of the re-check and add no behaviour to protect.

Out of scope: code-quality's F10 is that reviewer's finding to dispose. Here it is only checked as a seam, above.

### Well covered
- **Offline merge setup at the code review**: S-9b, a real process with a contrast run and a gh call count.
- **Offline at the delivery checks and at the plan approval**: S-9 and S-8, unchanged and passing.
- **The blocked reasons with no offline fact**: B14 in change-loop.test.mjs and the change-state blocked-reason table in change-loop-remote-state.test.mjs:801.
