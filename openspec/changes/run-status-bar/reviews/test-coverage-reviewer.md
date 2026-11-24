Verdict: approved
Commit: a46bf795f7bb603ae110183d20a8cd1f5630596a

## Coverage analysis — run-status-bar, stale re-check (3a53ac9..a46bf79: merge aa8a685 of origin/main d917ae0, its six conflicted files, and the change folder edits 83650a5 and a46bf79)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:222-230 — [6] Nothing runs the real wiring of SIGTERM, SIGINT and SIGHUP to the AbortController; deleting the loop or dropping SIGHUP left the suite green. · fixed in 792fde6
- [important] plugins/openspec/hooks/status-line.mjs:189,194,211 — [6] No test checked that a --lang other than en reaches the state call; hard-coding 'en' in ask left the suite green. · fixed in 792fde6
- [important] plugins/openspec/README.md and docs/openspec-flow.md: statusLine snippet — [5] Nothing ran the settings.json statusLine command, the only link from Claude Code to status-line.mjs (cache layout, sort -V, the exit with no installed copy). · fixed in 792fde6
- [nit] plugins/openspec/hooks/status-line.test.mjs:816-842 and change-state-stages.test.mjs:167 — Implementation-coupled: these tests match the source text with regexes for fs import names, write-call names, spawn first arguments and the words budget or transcript_path; the behavioral read-only snapshot test already protects the contract.
- [nit] plugins/openspec/hooks/status-line.mjs:215 (normalizeLang default) — With no --lang the bar falls back to pt-BR; the spec names no default and no test pins the case with no --lang.
- [nit] plugins/openspec/hooks/status-line.test.mjs:104-110 (stillAlive), used at :431, :449 — [3] The up-to-10 s poll no longer checks that stateText settles only after the child has ended; a stateText that resolved at stop() would still pass.
- [praise] plugins/openspec/hooks/status-line.test.mjs:179-212, 151-174 — The round-1 fix is tested at the seam: the real bar runs on the real state with an openspec shim first on PATH, each signal is sent to the real process, and a grandchild test covers the process-group kill.
- [nit] plugins/openspec/hooks/change-loop.mjs:3052 (USAGE, merge resolution) — [2] The merge kept both sides of the USAGE line, but only main's `merge-check <id>` is test-pinned (change-loop.test.mjs:2288); a resolution that dropped this change's `[--offline]` would leave every test green.
- [nit] openspec/changes/run-status-bar/tasks.md 3.4 and evidence.md:56 — The amended gate 3.4 drops GITHUB_HEAD_REF/GITHUB_BASE_REF, and the train does not set them, so no whole suite has run under the CI branch variables at the merged head (last at 0528b85); the PR's required `check` job is the first such run, so wait for it by run id before calling the head CI-green.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:361-364 — After the merge the release pin is protected by deriving it from the manifest, with no literal version: every pin in docs/openspec-flow.md must equal plugin.json's version, so a renumber that misses a pin turns red. Ran at HEAD: 1/1 pass.

In-scope surfaces: the merge resolution of aa8a685 in its six conflicted files (.claude-plugin/marketplace.json, CHANGELOG.md, docs/openspec-flow.md, plugins/openspec/.claude-plugin/plugin.json, plugins/openspec/hooks/change-loop.mjs USAGE, plugins/openspec/hooks/change-loop-compozy.test.mjs), each compared with parent 009b455 and parent d917ae0; and the edits in the change folder (design.md, tasks.md, evidence.md, review.md, reviews/).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- **Release pin across files** (plugin.json 0.43.0 to the three `v0.43.0` pins in docs/openspec-flow.md): caught by `change-loop docs: the design records the answers` (`pinMismatches(flow, version)` deep-equals `[]`, reading plugin.json). `git diff --quiet d917ae0 HEAD -- plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0, so the merge kept main's ADR 0030 file and E-3 is superseded. I ran the test at HEAD with TMPDIR=/private/tmp/devkit-run-status-bar, GITHUB_HEAD_REF=probe-branch, GITHUB_BASE_REF=main and `--test-name-pattern`: 1 test, 1 pass.
- **Marketplace version to the CHANGELOG heading** (0.48.0): caught by `scripts/check.py` (its CHANGELOG check at lines 118-123). I ran it at HEAD: `all checks passed`.
- **plugin.json and the devkit-openspec entry in marketplace.json** (both 0.43.0): equal by inspection. No repository test ties them (task 3.1 checks it by hand). This was already untested before this change, so it is a backlog item, not a gap of this change.
- **USAGE line**: both sides kept. Main's `merge-check` part is pinned by change-loop.test.mjs:2288; this change's `[--offline]` part is not (F8, score 2; it is help text, and the `--offline` behaviour itself stays covered by the state tests that passed at the merge head).
- **How main's new behaviour meets the bar**: main's new block reasons `merge-defect` and `merge-check-failed` reach the bar through `entry.reason.text` (status-line.mjs:89), which has no per-reason table, so no word lookup can miss them. Main's `mergeCheck` facts in state only read the record (change-loop.mjs:1528-1529, `readMergeCheck`); only the `merge-check` subcommand writes it. So the bar's read-only contract holds, and the AC-5 read-only tests in status-line.test.mjs passed at the merge head in the conducting session's seven-file run (935/935).

Run: one targeted test (the CI pin test above), 1/1 pass. Everything else comes from the caller's report and evidence.md: seven touched files at the merge head 935/935, gates 1.7 (693/693) and 2.5 (341/341, 4/4) live at 83650a5. No whole suite was run here, as instructed.

Change-folder edits: design.md's new paragraph and the E-3 row, the task 3.1 check (`git diff --quiet d917ae0 HEAD -- ...compozy.test.mjs`, which I confirmed exits 0) and the 3.4 amendment all agree with the merged tree. evidence.md says plainly that nobody ran the whole suite at this head and that the train proves the 3.4 suite part ('Gate parts proven by the train', docs/openspec-flow.md:703). review.md and the other reviews/ files are round-2 outputs and add no behaviour to protect.

Inherited or out of scope: main's own commits in d917ae0, and the parity of the plugin.json and marketplace.json versions, which no test checks.

### Well covered
- **Release pin after the renumber**: the manifest-derived pin test, which no future renumber edits.
- **Abort of the state call by a real signal, and the bound and abort ending the whole state process tree**: unchanged since round 2. status-line.test.mjs and status-line.mjs are untouched by the merge, and they passed at the merge head.
- **Language pass-through and the statusLine snippet**: unchanged since round 2 and still covered by the language test and the sh -c snippet tests.
