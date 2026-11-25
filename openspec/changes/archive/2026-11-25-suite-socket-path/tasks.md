<!-- devkit-stage tasks result=passed attempt=1 commit=d0966033f95093062e56e0ac7a480db755c0c9c8 -->
# Tasks

Change: `suite-socket-path` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `design.md`). Plan base: `d096603`.

Work only in this change's worktree, on its branch. `design.md` fixes every edit (D-1 to D-4), and the
implementer makes no design choice. No product file changes: no hook, skill, agent, schema or
fixture module changes what it does; `plugins/openspec/hooks/test-fixtures.mjs` and the three
`test-tmp.mjs` copies stay byte-for-byte as they are. Every new test's name starts
`suite-socket-path AC-<n> `. Each commit that edits an existing test names the test, its invariant,
its layer (the suite script's tests) and its suite (`test-suite.test.mjs`), as `design.md` D-3 lists
them. Leave no scratch file in the tree, and end every task with `git status --short`.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. The whole suite takes about 12
minutes on this Mac: run it as a background command of the tool, never with a shell `&`, with no other
suite running. Check the free disk space (`df -h /`) before each whole-suite run.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `suite-passes-default-tmpdir` | 3.1, 3.5 |
| AC-2 | `tmpdir-honoured-when-it-fits` | 1.2, 1.3, 1.4, 3.2 |
| AC-3 | `short-root-when-it-does-not-fit` | 1.2, 1.3, 3.1 |
| AC-4 | `regression-test-pins-the-limit` | 1.2, 1.3, 1.4, 3.3, 3.4 |
| AC-6 | `contributing-states-the-rule` | 2.1 |

## 1. The run root (phase 1)

- [x] 1.1 Baseline, before any edit. Run `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
  and keep its sorted test names in the session's scratch folder, outside the tree (used in 3.4). Repeat the
  assumption grep of `design.md`: `grep -rn "\.listen(" plugins scripts --include='*.mjs'` finds only
  `plugins/openspec/hooks/test-fixtures.mjs:622`. Check: both outputs are as stated. Any other hit means stop and report it to the
  conducting session.
- [x] 1.2 Write the twelve tests of `design.md` D-2 in `plugins/openspec/hooks/test-suite.test.mjs`, with
  the namespace import `import * as suiteScript from '../../../scripts/test-suite.mjs';` beside the
  existing named import. Do not touch `scripts/test-suite.mjs` yet. Check (red, not a gate): the
  command of 1.1 exits 1. The twelve new tests fail, and test 1 fails on its `bound` assertion with
  `EINVAL` (AC-4: red on the script before this change), not on a load or link error. The 18 existing tests pass.
- [x] 1.3 Implement `design.md` D-1 in `scripts/test-suite.mjs`: the exports `SOCKET_PATH_MAX_BYTES`,
  `SOCKET_TAIL_BYTES`, `RUN_ROOT_NAME_BYTES`, `SHORT_TMP`, `runRootLimit`, `runRootBytes`, `runRootFits` and
  `makeRunRoot`; the `makeRunRoot` call last inside `main`'s `try`, with the third parameter `short`;
  the `run root:` line before the first `start` line; the header comment and the line-141 comment.
  Check: the command of 1.1 shows the twelve new tests passing (AC-2, AC-3, AC-4). The only failures
  are the two that D-3 predicts (`suite-speed AC-4 each file runs in its own empty TMPDIR ...` and
  `suite-speed AC-4 a symlinked TMPDIR gives each file a real path`), each on its run-root parent assertion.
- [x] 1.4 Apply `design.md` D-3 to the existing tests: the default base `tmpFolder('devkit-b-')` in
  `start` with its comment, the local helper `runParent(base, fileCount)`, line 276 and its line count
  check, and in the symlinked test `tmpFolder('devkit-t-')` and line 297. No other existing test changes.
  Check: the command of 1.1 exits 0 with every test passing (AC-2, AC-4: the existing leftover and
  symlinked-TMPDIR tests keep passing).
- [x] 1.5 Gate: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` green (AC-2, AC-3, AC-4).

## 2. Docs and release (phase 2)

- [x] 2.1 `CONTRIBUTING.md` line 42: add the sentences of `design.md` D-4 after `(a real path, under
  one run root the script removes at the end)`. Leave the measured-time sentence of that paragraph as
  it is: the test `suite-speed AC-8 CLAUDE.md and CONTRIBUTING.md state the measured time` in
  `plugins/openspec/hooks/test-suite.test.mjs` reads it there. Check: the paragraph says that a Unix
  socket path holds 104 bytes on macOS, that the environment's `TMPDIR` is used when it fits, that the run root
  otherwise goes under the real `/tmp` with one `run root:` line, and that a test that binds a socket does so under its
  `TMPDIR` (AC-6); `python3 scripts/check.py` passes.
- [x] 2.2 Release, in one task: bump devkit-openspec by a patch in
  `plugins/openspec/.claude-plugin/plugin.json` and in `.claude-plugin/marketplace.json`, and bump the marketplace
  version by a patch. Take the next free numbers on `origin/main` at the last merge before review,
  never a literal written now. Add the `CHANGELOG.md` section for that marketplace version: one
  devkit-openspec bullet saying that the suite script makes its run root under the real `/tmp`, with one
  line, when the environment's `TMPDIR` would push a Unix socket path past 104 bytes on macOS; test
  tooling only. Move the CI pin lines of `docs/openspec-flow.md` (733, 734 and 747 at the base) to the
  new devkit-openspec version (CONTRIBUTING.md step 5; ADR 0030: the pin test reads the manifest, so no
  test changes). Check: `python3 scripts/check.py` passes; `claude plugin validate .` passes.
- [x] 2.3 Gate: `python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate . && node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs` green (AC-6).

## 3. Validation (phase 3)

- [x] 3.1 AC-1 and AC-3 on this Mac with the default `TMPDIR`. Run the whole suite as
  `env TMPDIR="$(getconf DARWIN_USER_TEMP_DIR)" node scripts/test-suite.mjs` in a clean
  checkout of the branch. This gives the default even when the session's own `TMPDIR` points elsewhere.
  Check: exit 0; the summary line ends with `0 fail`; the output holds exactly one `run root: /private/tmp/devkit-suite-`
  line, which names `TMPDIR` and the byte reason; the three files that call `fakeCompozy(...).daemon(t)`
  (`compozy-driver.test.mjs`, `change-loop-compozy.test.mjs`, `roadmap-loop-followups.test.mjs`) are `pass`;
  `/private/tmp` holds no `devkit-suite-*` folder from this run afterwards.
- [x] 3.2 AC-2, and the CI proxy of the Workflow follow-up, with a `TMPDIR` that fits. First, `mkdir -p /var/tmp/devkit-socket-path`, then
  `env TMPDIR=/var/tmp/devkit-socket-path node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`.
  Check: exit 0; no `run root:` line. The other branch of `runParent` is exercised and passes there, because the file's own `TMPDIR` is
  58 bytes. Then the CI-like run of the whole suite:
  `env TMPDIR=/private/tmp GITHUB_HEAD_REF=suite-socket-path GITHUB_BASE_REF=main node scripts/test-suite.mjs`.
  Check: exit 0, `0 fail`, no `run root:` line (the run root fits under `/tmp`'s real path, as on CI).
  Remove `/var/tmp/devkit-socket-path` after. CI's `Test suite` step on the pull request is the
  `check` required check (workflow follow-up below).
- [x] 3.3 AC-4's red proof on the plan base, for the evidence. Make a scratch worktree with
  `git worktree add --detach <session scratch folder>/base d096603`. Copy this branch's
  `plugins/openspec/hooks/test-suite.test.mjs` over the copy there, and run
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` inside it. Check: the AC-4
  test fails on its `bound` assertion with `EINVAL`. Then `git worktree remove --force` that folder, and
  `git worktree list` no longer shows it.
- [x] 3.4 Test names. Compare the sorted test names of `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
  with the baseline of 1.1. Check: they are equal except for the twelve `suite-socket-path AC-` names that
  `design.md` D-2 adds; none is renamed or lost (AC-4).
- [x] 3.5 Gate: `node scripts/test-suite.mjs && python3 scripts/check.py` green (the project's test command; AC-1, whose default-`TMPDIR` run is 3.1).

## Workflow follow-up

- CI's `check` job (its `Test suite` step) passes on the pull request, the CI observation on Linux (a Workflow follow-up, not a criterion);
  the evidence cites the run.
- After the merge, `deliver-check` answers `tag-release` and the session tags the new devkit-openspec
  version on the merge commit (CONTRIBUTING.md, ADR 0019).
