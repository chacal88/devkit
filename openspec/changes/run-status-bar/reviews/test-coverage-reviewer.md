Verdict: approved
Commit: 796ac2cb75448c7596cc45f0cbe6851d2ccce58f

## Coverage analysis — run-status-bar, third round (9ad0f6f..796ac2c: the F11 test 62bd607, the merges of origin/main 4c25ecc and e14e1fa, and the plan and evidence commits 0983bd2, b892d4f, 41caadc, 796ac2c)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:222-230 — [6] Nothing ran the real wiring of SIGTERM, SIGINT and SIGHUP to the AbortController; deleting the loop or dropping SIGHUP left the suite green. · fixed in 792fde6
- [important] plugins/openspec/hooks/status-line.mjs:189,194,211 — [6] No test checked that a --lang other than en reaches the state call; hard-coding 'en' in ask left the suite green. · fixed in 792fde6
- [important] plugins/openspec/README.md and docs/openspec-flow.md: statusLine snippet — [5] Nothing ran the settings.json statusLine command, the only link from Claude Code to status-line.mjs (cache layout, sort -V, the exit with no installed copy). · fixed in 792fde6
- [nit] plugins/openspec/hooks/status-line.test.mjs:816-842 and change-state-stages.test.mjs:186-197 — Implementation-coupled: these tests match the source text with regexes (fs import names, write calls, spawn arguments, the stub's body); the behavioural read-only and offline tests already protect the contract.
- [nit] plugins/openspec/hooks/status-line.mjs:215 (normalizeLang default) — With no --lang the bar falls back to pt-BR; the spec names no default and no test pins the case with no --lang.
- [nit] plugins/openspec/hooks/status-line.test.mjs:104-110 (stillAlive), used at :431, :449 — [3] The up-to-10 s poll no longer checks that stateText settles only after the child has ended; a stateText that resolved at stop() would still pass.
- [praise] plugins/openspec/hooks/status-line.test.mjs:179-212, 151-174 — The round-1 fix is tested at the seam: the real bar on the real state with an openspec shim first on PATH, each signal sent to the real process, and a grandchild test for the process-group kill.
- [nit] plugins/openspec/hooks/change-loop.mjs:3132 (USAGE) — [2] Still no test pins this change's `[--offline]` in the USAGE line (a grep of the *.test.mjs files finds none); dropping it from the help text leaves every test green.
- [nit] openspec/changes/run-status-bar/tasks.md 3.4 and evidence.md (Notes for the owner) — No whole suite has run under GITHUB_HEAD_REF/GITHUB_BASE_REF at the merged head (last at 0528b85), and evidence.md still says so; wait for the PR's `check` job by run id before calling the head CI-green.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:361-364 — The release pin is derived from the manifest with no literal version, so a renumber that misses a pin turns red; the move to 0.46.0/0.51.0 needed no edit there.
- [important] plugins/openspec/hooks/change-loop.mjs:1411 (`step === 'stop-merge-setup' && facts.offline`) — [5] Only the offline half of the new guard had a negative test; without the step check, --offline turned stop-branch, stop-not-approved, stop-archive and pr-problem into waiting-on-github/silent and no test failed. · fixed in 62bd607
- [nit] plugins/openspec/hooks/change-loop.mjs:1411 (`silent(currentId, row.next.reason)`) — [2] The detail.error that the offline merge-setup end carries (the checker's reason) was not asserted. · fixed in 62bd607
- [praise] plugins/openspec/hooks/change-state-stages.test.mjs:158-175 (S-9b) — The F10 fix is tested at the seam: the real CLI on a merge-mode fixture, the online contrast and the offline read with no gh call; the `gh === OFFLINE_GH` identity cannot be mutated either way without one half going red.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:491-505 (B14b) — The F11 test covers both directions of the guard in one place: four other stops stay ['end','blocked',why,2] with their blocked reply offline, and the merge-setup stop reads waiting-on-github/silent with the checker's exact reason in detail.error.

In-scope surfaces: plugins/openspec/hooks/change-loop.test.mjs (B14b) and the doc comment of `decide` in change-loop.mjs (62bd607); the merge fixes of 4c25ecc and e14e1fa in change-loop.mjs (`stateEntries`, the `nextAction` signature), change-loop-remote-state.test.mjs (E-6), flow-check.test.mjs (the closing of the run-status-bar block), plugin.json and marketplace.json (release 0.46.0 / 0.51.0); and in the change folder design.md, tasks.md and evidence.md.
Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0; the caller's mutation proof was checked by reading the code):
- **The `step === 'stop-merge-setup'` check (change-loop.mjs:1411)**: caught by B14b. Without it the first row (stop-branch) would read `waiting-on-github`, and `shape` would differ from `['end','blocked','wrong-branch',2]`.
- **The `facts.offline` check (change-loop.mjs:1411)**: caught by B14 (no offline fact gives `merge-setup`) and by the online half of S-9b.
- **The checker's reason passed to `silent` (change-loop.mjs:1411, the helper at :1202)**: caught by B14b (`detail.error === 'gh api repos/o/r: HTTP 403'`). Without the reason, `error ?? ''` gives `''`.
- **Merge 4c25ecc, `stateEntries` (change-loop.mjs:2029-2039)**: main's unplaced entries come first, then this change's `stages: true` on the `knownChange` branch.
  - Dropping `stages: true` turns the stages tests of change-state-stages.test.mjs:41-69 red, because `stagesOf` reads `state --change feat`.
  - The unplaced stand-in carries no `stages` and reads `null` through `action.stages ?? null`; E-6 (`unlocated 1`, change-loop-remote-state.test.mjs:1605) pins that.
  - The unplaced branch passes the same `gh` to `archivedDates`. Under `--offline` that gh is OFFLINE_GH, which fails at once with no call. That line is main's own code, kept as is, so there is no new gap.
- **Merge e14e1fa, the `nextAction` signature (change-loop.mjs:1527)**: it keeps both main's `fetchBase` and this change's `stages`. Losing `stages` turns the stages tests red; losing `fetchBase` turns main's base-fetch tests red.
- **Merge 4c25ecc, flow-check.test.mjs**: the `});` added before main's stage-ceiling-consecutive block closes this change's last AC-3 helper test. Both blocks run, and gates 1.7 and 2.5 count them.
- **The release numbers (0.46.0 / 0.51.0)**: covered by the release pin of change-loop-compozy.test.mjs, which is derived from the manifest, and by the version-pin tests. Per tasks.md, `git diff --quiet 74f2444 HEAD -- change-loop-compozy.test.mjs` keeps that file as main's.
- **The owner's accepted limit (the coordinator bar prints nothing when the listing passes 20 s)**: no new code. The timeout path is the bar's existing D-9 behaviour, tested in round 1. evidence.md C1-C4 records the real run (37-45 s, nothing printed, exit 0), and the follow-up `state-listing-speed` is in the plan.

Run: one scoped run at HEAD, `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern='B14|unlocated 1'` on change-loop.test.mjs and change-loop-remote-state.test.mjs: `suite: 2 files, 30 tests, 30 pass, 0 fail`, with B14, B14b and E-6 among them. Every other number comes from the caller and evidence.md: gate 1.7 762/762 and gate 2.5 360/360 and 4/4 at 41caadc, and 838/838 over six files after the last merge. No whole suite was run here, as instructed.

Change-folder edits: the plan commits (0983bd2, 41caadc) record S-9b, B14b, E-6 (with its invariant, layer and suite), the release above main and the owner's accepted limit. The evidence commits (b892d4f, 796ac2c) say plainly that no whole suite ran at this head, which is why F9 stays a nit. No other existing test was edited: compared with main's parent, change-loop.test.mjs adds only B14b and one SAMPLE row from the earlier rounds, and change-loop-remote-state.test.mjs differs only by E-1, E-4 and E-6.

### Well covered
- **Offline merge setup, unit level**: B14b (decide, four other stops stay blocked, plus the merge-setup stop with its reason).
- **Offline merge setup, CLI level**: S-9b, a real process with an online contrast and a gh call count.
- **The `stages` field across the merge**: the change-state-stages AC-3 tests for current, archived, start-with-no-folder and previous-script changes, and E-6 for the unplaced stand-in.
- **The release renumber**: the manifest-derived pin in change-loop-compozy.test.mjs.
