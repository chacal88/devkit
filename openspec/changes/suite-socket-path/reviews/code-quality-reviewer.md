Verdict: approved
Commit: 3826bb5ff032ff0421198609926b3d634f6a8f95

## Quality review — suite-socket-path (round 1)

### Findings
- [important] CHANGELOG.md:3, .claude-plugin/marketplace.json:9 — The marketplace and CHANGELOG go from 0.50.0 to 0.50.2 and no 0.50.1 exists in either. Neither the proposal nor the design says why. If no sibling change took 0.50.1, this is a skipped version. · refuted: git show 6c40ded (ancestor of origin/main, landed after base 74f2444) adds '## 0.50.1 — fresh-base-check retro' and marketplace 0.50.1, so a sibling took 0.50.1; caveat: it also took devkit-openspec 0.45.1, which this change reuses, so a bump collision exists at merge. / git show 6c40ded (an ancestor of origin/main, not of HEAD) adds CHANGELOG '## 0.50.1 — fresh-base-check retro' and marketplace 0.50.1, so a sibling took 0.50.1 and the gap is not a skipped version (the same commit also took devkit-openspec 0.45.1, so a collision on merge is a separate risk) / git show 6c40ded (on main/origin/main, not an ancestor of HEAD) adds '## 0.50.1 — fresh-base-check retro' to CHANGELOG.md and marketplace 0.50.1; a sibling took 0.50.1, so 0.50.2 is correct after the merge
- [nit] docs/openspec-flow.md:734 — The CI pin moves to v0.45.1, but that tag does not exist yet. The tasks cover it only through the follow-up item after the merge. Say in the evidence that the pin is a placeholder until the tag is made.
- [nit] plugins/openspec/hooks/test-suite.test.mjs (suite-socket-path AC-3 test) — The test swaps process.env.TMPDIR and the stdout and stderr writers around a synchronous call to main. This relies on main returning 2 before its first await. A comment says so, but the test breaks silently if main gains an await before makeRunRoot.
- [praise] scripts/test-suite.mjs:146-185 — One exported helper does the byte arithmetic (runRootLimit, runRootFits). It counts bytes, not characters. It checks the folder's size before writing to it, and its error names both folders, so a failure can be diagnosed.
- [praise] plugins/openspec/hooks/test-suite.test.mjs — There is a test for each condition: 51 bytes fits, 52 does not, a non-ASCII byte counts, 100 versus 101 files, and exit 2 with no file started. A regression test binds a real socket, and the red proof on the plan base is recorded.

## Quality review — suite-socket-path (round 1)

### Scope and claims
The code diff stays in the declared files. Each branch the proposal names has a test: TMPDIR fits, TMPDIR does not fit and `/tmp` is used, neither fits (exit 2), the byte limit, and the limit for 101 or more files. A regression test also binds a real Unix socket under a long `TMPDIR`. The `CONTRIBUTING.md` text, the plugin and marketplace versions, and the `docs/openspec-flow.md` pin agree with the code.

### Architecture
- The limit arithmetic lives in one exported place: `runRootLimit` and `runRootFits`. The tests use those exports instead of copying the numbers.
- `tryRunRoot` does not write to a folder that does not fit, and the exit-2 error names both folders.
- `makeRunRoot` runs inside the `UsageError` try block, so a failure returns 2 before any file starts. Nothing in `main` can fail between making the run root and the existing cleanup.

### Line by line
- The byte count uses `Buffer.byteLength`, so a non-ASCII path is measured correctly.
- The `fileCount` passed to `runRootLimit` is the whole suite's file count, not the selected files. That is the safe choice, because the folder name for a file's place comes from `files.indexOf`.
- The tests that place a run root under a folder they own now use a shorter prefix (`devkit-b-`), so the "fits" branch stays the one they exercise.

### Acceptance evidence
I ran `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` (28 of 28 pass, 0 fail) and `python3 scripts/check.py` (all checks passed). I did not run the whole suite. The default-TMPDIR result of 3164/3164 with 0 fail comes from `evidence.md`, which I did not re-check. `evidence.md` also records two gate runs and a CI-like run that each failed one unrelated `--watch` timing test, green when the file ran alone.

### Summary
- 5 findings (0 blocking, 1 important, 2 nit) + 2 praise.
- Justification: I read the whole code diff, ran the touched test file and the language and name checks, and compared the release files with the proposal. The one open point is a version number that skips a step without saying why. It should be explained or corrected.
