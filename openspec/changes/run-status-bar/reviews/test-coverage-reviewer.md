Verdict: approved
Commit: 3a53ac94b3676d8063672b1a3b9887f806956424

## Coverage analysis — run-status-bar, round 2 (22230be..3a53ac9, change's own files and the merge resolution of f4bad47)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:222-230 — [6] The real-process wiring of SIGTERM, SIGINT and SIGHUP into the AbortController is never exercised. Deleting the loop or dropping SIGHUP leaves the suite green. · fixed in 792fde6
- [important] plugins/openspec/hooks/status-line.mjs:189,194,211 — [6] No test asserts that a --lang other than en reaches the state call. Hard-coding 'en' in ask leaves the suite green. · fixed in 792fde6
- [important] plugins/openspec/README.md and docs/openspec-flow.md: statusLine snippet — [5] Nothing runs the settings.json statusLine command, which is the only wire between Claude Code and status-line.mjs. Plugin cache layout, sort -V and the no-copy exit are unverified. · fixed in 792fde6
- [nit] plugins/openspec/hooks/status-line.test.mjs:816-842 and change-state-stages.test.mjs:167 — Implementation-coupled: these tests regex the source for fs import names, write-call names, spawn first arguments and the words budget or transcript_path. A rename or a comment turns them red. The behavioral read-only snapshot test already protects the contract.
- [nit] plugins/openspec/hooks/status-line.mjs:215 (normalizeLang default) — With no --lang the bar falls back to pt-BR through normalizeLang. The spec names no default and no test pins one. The new language test covers pt-BR, fr and en given explicitly, but not the case with no option.
- [nit] plugins/openspec/hooks/status-line.test.mjs:104-110 (stillAlive), used at :431, :449 — [3] Polling up to 10 s makes the tests load-safe, but nothing now checks the 'the promise settles only once the child has ended' invariant of stateText. A stateText that resolved at stop() instead of at the child's close would pass, because the SIGTERM kills the child inside the deadline.
- [praise] plugins/openspec/hooks/status-line.test.mjs:179-212, 151-174 — The round-1 fix is tested at the seam, not the core. The real bar runs on the real state with an openspec shim first on PATH, and each of the three signals is sent to the real process. A grandchild test covers the process-group kill both at the bound and at an abort.

In-scope surfaces: plugins/openspec/hooks/status-line.mjs (the stateText process-group kill and the signal wiring), plugins/openspec/hooks/status-line.test.mjs, the statusLine snippet in plugins/openspec/README.md and docs/openspec-flow.md, and the merge resolution of f4bad47 (marketplace.json 0.45.0, plugin.json 0.40.0, the v0.40.0 pin in change-loop-compozy.test.mjs).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- **Signal wiring** (`process.on` for SIGTERM/SIGINT/SIGHUP to abort): caught by 'SIGTERM, SIGINT and SIGHUP end the real bar...'. Its assertion `[ended.code, ended.by, out]` equals `[0, null, '']`. Without the handler the process dies by the signal (`by` is the signal name), so dropping any one name turns its subtest red.
- **Process-group kill** (`detached: true` with `process.kill(-child.pid)`): caught twice. The real-signal test checks `stillAlive([pid])` of the openspec shim, which `exec`s `sleep 300` and would outlive a child-only kill. The 'bound and abort also end the processes the state call started' tests check `stillAlive([pid, grandchild])` in both views.
- **Language reaching the state call**: caught by 'the language reaches the state call of the coordinator and of a change worktree'. `argvOf(stub)` equals `[...view.args.slice(0,-1), passed]` for pt-BR, fr (normalized to pt-BR) and en. Hard-coding 'en' or skipping normalization turns it red, and the drawn line's language is also asserted.
- **statusLine snippet**: caught by 'the README command starts the newest installed copy...'. It runs the README's JSON `command` with `sh -c` against a fake CLAUDE_CONFIG_DIR cache: 0.9.0 beside 0.10.0 picks 0.10.0, which exercises `sort -V`; no copy or an empty plugin folder gives exit 0 with nothing on either stream; the `$HOME/.claude` fallback is covered. The docs snippet is asserted equal to the README's. Reverting to `[ -n "$f" ] &&` turns the no-copy cases red, since the exit becomes 1.
- **Merge resolution**: change-loop-compozy.test.mjs pins v0.40.0 and refuses v0.39.2, which matches plugin.json 0.40.0 and marketplace 0.45.0.

Run: `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/status-line.test.mjs` printed 184 tests, 184 pass, 0 fail, 37.4s. The caller reported the whole suite green at 0528b85 (40 files, 3165 tests, 0 fail). The commits after it touch only openspec/.

Inherited or out of scope: none. The fallback `child.kill('SIGTERM')` when the group kill throws is untested, but it is a defensive path of one line and is not reported as a gap.

### Well covered
- **Abort of the state call by a real signal**: the real-process test with the PATH shim, which checks the exit code, the empty output and the shim pid gone.
- **Bound and abort end the whole state process tree**: the grandchild stub tests in both views.
- **Language pass-through**: the language test, three languages in two views, with argv and drawn line both asserted.
- **The settings snippet the owner pastes**: the sh -c snippet tests, with docs and README parity.
- **Stage applicability and the `stages` field**: unchanged since round 1 and still covered by flow-check.test.mjs:128-194 and change-state-stages.test.mjs.
