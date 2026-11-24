<!-- devkit-stage retro result=passed attempt=1 commit=6c7ba427a4bae3a5dce64d6faf857924d058d666 -->
# Retro: suite-speed

Change PR: https://github.com/chacal88/devkit/pull/98, merged at `cf34ff2`, tagged `v0.38.0`.

## Retro: suite-speed

1. Went wrong:
   - The plan's measure ("no split", 558.7 s, 22 files) went stale when the base merge brought in a stack of other changes (8 more test files, about 500 s of test time): the same command took 816.6 s on 30 files, and two rounds of file splits (6 files into 17 parts) were needed to get back under 10 minutes.
   - The first splits named each file's `TMPDIR` folder after the file; with the longer part names, 27 tests that make a Unix socket under `TMPDIR` failed with `listen EINVAL`. Only a whole-suite run showed it.
   - The script's entry check compared a symlinked `argv[1]` with the real module path, so a symlinked start exited 0 with no output (a false green). Only the review found it.
   - Two timings (659.5 s and 600.5 s) were taken while another session ran a full suite on the same machine; they were not measures and cost two extra full runs.
   - The review round was repeated twice because the merge of the base made the evidence and every review stale, though nothing outside `openspec/` had changed.
2. Better next time:
   - Re-decide a size-driven split after the last merge of the base, with a whole-suite measure alone on the machine, not before it.
   - Keep a per-file temporary folder name short and fixed (the place only), and test the entry point through a symlink.
   - Take a timing only when no other suite runs; record the load next to it.
   - The 8 threads of the Avell are 4 cores: file seconds in a parallel run are inflated by hyper-threading, so budget the wall clock, not the sum.
3. Remember: a suite time is only a measure when it is taken alone on the machine, on the merged base.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A test file above about 300 s sets the wall clock of the parallel suite; split by section headings | process-friction | doc-update | project |
| 2 | A time or count stated in the docs is re-measured after the last merge of the base, alone on the machine | process-friction | rule | project |
| 3 | A suite time is a measure only when taken alone on the machine | environment | memory-only | user |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
Say in the test-suite paragraph how big a test file may be and how to split it.
- before: "The whole run takes about 10 minutes on an idle 8-core machine; 9:36 observed on a9babd2."
+ after: "The whole run takes about 10 minutes on an idle 8-core machine; 9:36 observed on a9babd2. The wall clock is the largest file: keep every test file under about 300 s in the summary of `node scripts/test-suite.mjs`, and split a file above it at its section headings into `<name>-<part>.test.mjs` parts with their shared helpers in `<name>-fixtures.mjs` (no test renamed; the sorted test names before and after are equal)."
- Answer: approved
- Applied: yes

### `CLAUDE.md` (project-rule)
A measured figure in the docs is only true for the base it was measured on.
- before: "- Before changing a test, name its invariant, the layer that owns it and the suite it lives in."
+ after: "- Before changing a test, name its invariant, the layer that owns it and the suite it lives in. A time or a count the documents state (the suite's minutes, its tests) is measured again after the last merge of the base, with no other suite running on the machine."
- Answer: approved
- Applied: yes

### user memory (memory-only)
Suite timings count only when taken alone on the machine, on the merged base: record the load next to them, and never reuse a figure from before a merge of other changes.
- Answer: approved
- Applied: yes
