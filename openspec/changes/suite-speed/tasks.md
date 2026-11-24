<!-- devkit-stage tasks result=passed attempt=1 commit=720d91d3aeedc351af462f17a68b2fa680f444af -->
# Tasks

Change: `suite-speed` · Date: 2026-11-23 · Owner: Kaue (chacal88) · Base: `720d91d` · PRD / tech
spec: n/a (`proposal.md`, `design.md`)

Work only in this change's worktree, on its branch. Every name, text, rule and test is in
`design.md` (D-1 the script, D-2 the folders, D-3 concurrency, D-4 the helper module, D-5 the scans,
D-6 the import check, D-7 the skip check, D-8 CI, D-9 the texts, D-10 to D-11 the proofs, D-12 the
tests); the implementer copies them and makes no design choice. No product script changes (a `*.mjs`
under `plugins/` that is neither a test file nor `test-fixtures.mjs`); a failure only a product
change would fix stops the phase, and the session asks the owner.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Run every command with
`TMPDIR=/var/tmp/devkit-suite-speed` (the worker's `/tmp` is a small tmpfs); the gates set it
themselves. The whole-suite gates (1.5, 2.5, 3.5, 4.4, 5.4) are run by the conducting session as a
background command of the tool, never with a shell `&`, and so are the two AC-2 runs of 5.3; a
subagent runs only the per-task checks.
When the gate of 1.5 fails, list `/var/tmp/devkit-suite-speed-p1`, fix the test that left something,
and remove that exact folder before running the gate again (never any other folder, never by age).
The tests need the `openspec` CLI 2.x on `PATH`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Nothing is timed before phase 4, and phase 4 starts only when the coordinating session gives this
change a place with no other change running on the worker.

Test first in every task that adds a test: write it, see it fail on the code before the task, then
make it pass. Every new test's name starts `suite-speed AC-<n> `. Before a test is changed, its
commit message names its invariant, the layer that owns it and the suite it lives in (CLAUDE.md);
`design.md` D-4, D-5, D-8 and D-12 give the three for every test this plan changes. A test that fails
when its file runs alone or under parallel load is fixed in its own fixture or wait, never by
`skip`, `only`, `todo` or a weaker assertion (AC-5c). Leave no backup or scratch file in the tree,
and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `one-command` | 2.1, 2.2, 2.5, 3.1, 3.3, 3.5 |
| AC-2 | `same-tests` | 1.5, 4.2, 5.3 |
| AC-3 | `no-test-imports` | 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5 |
| AC-4 | `own-tmpdir` | 2.1, 2.2, 2.4, 2.5 (T-16 for the signals) |
| AC-5 | `time-target` | 4.1, 4.2, 4.4 |
| AC-5b | `ci-time-target` | 3.1, Workflow follow-up |
| AC-5c | `no-test-dropped` | 3.2, 3.5 |
| AC-6 | `red-stays-red` | 2.1, 2.2, 5.3 |
| AC-7 | `ci-green-and-quoted` | 3.1, 3.3, 3.5 |
| AC-8 | `docs-times-true` | 4.3, 4.4 |

## 1. The helpers leave the test files (AC-3, AC-2)

- [x] 1.1 Create `plugins/openspec/hooks/test-fixtures.mjs` with the 18 imported names of
  `deliver-check.test.mjs` and their closure (D-4); `deliver-check.test.mjs` imports back what its
  tests use and stops exporting `archiveFolder`. Switch every importer of those names to the module:
  `guard.test.mjs:12` (and add the `deliver-check.test.mjs` side-effect line of D-4),
  `conduct-check.test.mjs:9`, `flow-check.test.mjs:14`, `change-loop.test.mjs:12`,
  `roadmap-loop.test.mjs:10`, `delivery-models.test.mjs:11`, `release-tags.test.mjs:19`,
  `version-pin.test.mjs:17`, `merge-setup.test.mjs:13`, and, through
  `../../../hooks/test-fixtures.mjs`, `github-setup.test.mjs:11`, `gh-version.test.mjs:9`,
  `changes-under-way.test.mjs:12`. Commit: "fixture location only; assertions unchanged", layer test
  fixtures, suite the guard suite. Check: `git grep -nE "from '[^']*deliver-check[.]test[.]mjs'" -- plugins`
  prints nothing, and
  `node --test plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs` passes.
- [x] 1.2 Move `roundRepo` (`conduct-check.test.mjs`), `pinDoc` (`release-merge.test.mjs`),
  `readCounter` (`change-loop.test.mjs`) and `TWO_PRS`, `scenario`, `archiving`
  (`delivery-models.test.mjs`) with their closures into the module; the sources import back what
  they use; switch `conduct-check.test.mjs:11`, `flow-check.test.mjs:16`, `change-loop.test.mjs:13`,
  `roadmap-loop.test.mjs:16,17`, `delivery-models.test.mjs:12`, `release-tags.test.mjs:20` and
  `version-pin.test.mjs:18`. The module makes nothing at import (D-4). Check:
  `git grep -nE "from '[^']*[.]test[.]mjs'" -- plugins` prints nothing, and
  `node --input-type=module -e "await import('./plugins/openspec/hooks/test-fixtures.mjs')"` exits 0.
- [x] 1.3 Drop `export` from `sampleChange` (`flow-check.test.mjs:1181`), `previousForms`
  (`roadmap-loop.test.mjs:37`) and `flowV2`, `upgradeTo2`, `packV2`, `planFiles`, `pinOf`
  (`version-pin.test.mjs:47-110`); nothing else changes. Check:
  `git grep -nE "^export " -- "plugins/*.test.mjs"` prints nothing.
- [x] 1.4 Add T-12 to `plugins/openspec/hooks/guard.test.mjs` and T-13 to
  `plugins/openspec/hooks/test-tmp.test.mjs` (D-12) and see both fail; then let `testFilesUnder`
  (`guard.test.mjs:1216`) and `rawTempCalls` (`test-tmp.test.mjs:136`) also read files named
  `test-fixtures.mjs` (D-5; the commit names each test's invariant, layer and suite as D-5 does).
  Check: `node --test --test-name-pattern="^suite-speed AC-3 " plugins/openspec/hooks/test-tmp.test.mjs`
  passes, and `node --test --test-name-pattern="^suite-speed AC-3 |^no test env blanks|^test-fixture-cleanup AC-3 " plugins/openspec/hooks/guard.test.mjs`
  passes.
- [x] 1.5 Gate: `mkdir /var/tmp/devkit-suite-speed-p1 && env TMPDIR=/var/tmp/devkit-suite-speed-p1 node --test plugins/openspec/hooks/guard.test.mjs && rmdir /var/tmp/devkit-suite-speed-p1` green (the old command, every file still loaded once through the guard's imports; record its summary counts); covers AC-3 for the helpers and the precondition of AC-2 (no test lost by the move).

## 2. The suite script (AC-1, AC-3, AC-4, AC-6)

- [x] 2.1 Write `plugins/openspec/hooks/test-suite.test.mjs` with T-1 to T-10 and T-16 of D-12 and its probe
  harness (a copy of the script in a `tmpFolder('devkit-suite-tree-')`, spawned with
  `process.execPath`; probe text built by joining pieces). This is the red half. Check:
  `node --test plugins/openspec/hooks/test-suite.test.mjs` fails because `scripts/test-suite.mjs`
  does not exist. The new tests make no subtests (`t.test`), so D-10's `suite-speed ` filter removes
  all of them.
- [x] 2.2 Write `scripts/test-suite.mjs` as D-1, D-2, D-3 and D-6 say (file list, arguments, the
  per-file `TMPDIR` under the real run root, the leftover check, the pool, the output and summary,
  the exit codes, the signals (T-16), `NODE_TEST_CONTEXT` removed from the children's env, the import
  check). Check:
  `node --test --test-skip-pattern="^suite-speed AC-3 no test file under plugins imports" plugins/openspec/hooks/test-suite.test.mjs`
  passes (T-6 waits for 2.3).
- [x] 2.3 Remove the 20 side-effect imports of `plugins/openspec/hooks/guard.test.mjs` (D-4) and
  rewrite its line 1 comment (D-9). Commit: invariant "guard.test.mjs holds only the guard's own
  tests", layer the suite's file list, suite `guard.test.mjs`. Check:
  `node --test plugins/openspec/hooks/test-suite.test.mjs` passes, T-6 included.
- [x] 2.4 Prove AC-4 with a symlinked `TMPDIR` (D-11): `mkdir /var/tmp/devkit-suite-speed-link-target`,
  `ln -s /var/tmp/devkit-suite-speed-link-target /var/tmp/devkit-suite-speed-link`, then
  `env TMPDIR=/var/tmp/devkit-suite-speed-link node scripts/test-suite.mjs --test-name-pattern="^change-budget " plugins/openspec/hooks/change-loop.test.mjs`;
  keep its output in `/var/tmp/devkit-suite-speed-proof/symlink.log` for the evidence, then remove
  the link and its target. Check: the run exits 0 and its summary line counts the `change-budget`
  tests as passed.
- [x] 2.5 Gate: `mkdir -p /var/tmp/devkit-suite-speed && env TMPDIR=/var/tmp/devkit-suite-speed node scripts/test-suite.mjs` green (the first full run of the new command; a file that fails alone or under load is fixed as the preamble says); covers AC-1, AC-3, AC-4 and AC-6.

## 3. CI, the skip check and the texts (AC-1, AC-5b, AC-5c, AC-7)

- [x] 3.1 Rewrite `test-fixture-cleanup AC-5 the hook tests run on an empty TMPDIR and a step fails
  when it is not empty after` in `plugins/openspec/hooks/test-tmp.test.mjs` (lines 179 to 192) as
  D-8 says, name kept; see it fail on today's `ci.yml`; then make `.github/workflows/ci.yml` one
  `Test suite` step (D-8), the step whose job AC-5b times. Commit: invariant, layer and suite of D-8.
  Check: `node scripts/test-suite.mjs --test-name-pattern="^test-fixture-cleanup AC-5 " plugins/openspec/hooks/test-tmp.test.mjs`
  passes, and `ci.yml` still has the job id `check`, `runs-on: ubuntu-latest`, `node-version: 22`
  and the steps "Catalog is up to date", "Names, descriptions, links, language", "Install OpenSpec
  (the hook tests and the schema step need it)" and "Schemas validate against the OpenSpec CLI"
  unchanged.
- [x] 3.2 Add T-11 to `plugins/openspec/hooks/test-suite.test.mjs` and see it fail; then add
  `check_no_skipped_tests()` to `scripts/check.py` (D-7) and its line in the module docstring.
  Check: `python3 scripts/check.py` prints `all checks passed`, and
  `node scripts/test-suite.mjs --test-name-pattern="^suite-speed AC-5c " plugins/openspec/hooks/test-suite.test.mjs`
  passes.
- [x] 3.3 Add T-14 to `plugins/openspec/hooks/test-suite.test.mjs` with the two expressions
  `OLD_COMMAND` and `OLD_HEADER` and the four exemptions of D-12 (joined from pieces), and see it
  fail at this point (the texts below still match); then change the texts of D-9: `CLAUDE.md:32`
  (the command, with no minutes figure until 4.3), `CONTRIBUTING.md` lines 38 to 42, 46 and 90,
  `plugins/openspec/README.md:73`, `openspec/config.yaml` (the Test command, and the ADRs line: the
  entry of ADR 0022 appended before `)`, the rest of the line unchanged), `docs/openspec-flow.md:318`,
  and the header comments of the 17 test files D-9 lists (comments only). Pinned texts this task
  touches and the tests that read them: the ADRs line, read by `upfront ADR 0021: the documents
  follow` (`roadmap-loop.test.mjs:5132-5133`, stays green). Check:
  `node scripts/test-suite.mjs --test-name-pattern="^suite-speed AC-7 " plugins/openspec/hooks/test-suite.test.mjs`
  passes,
  `node scripts/test-suite.mjs --test-name-pattern="^upfront ADR 0021: the documents follow$" plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes, and `python3 scripts/check.py` passes.
- [x] 3.4 Mark ADR 0022 accepted (D-9: `- Status: accepted` and the `- Accepted by:` line, the date
  and the owner's words read from `openspec/changes/suite-speed/approval.md`). Its number is the
  next free number on `origin/main` at the last merge before review: task 5.1 re-checks it and
  renumbers if a sibling change took 0022 first; until then the file keeps 0022. Check:
  `grep -c "^- Status: accepted$" docs/adr/0022-the-devkit-test-suite-runs-by-file-in-parallel.md`
  prints 1, and `grep -c "openspec/changes/suite-speed/approval.md" docs/adr/0022-the-devkit-test-suite-runs-by-file-in-parallel.md`
  prints 1.
- [x] 3.5 Gate: `mkdir -p /var/tmp/devkit-suite-speed && env TMPDIR=/var/tmp/devkit-suite-speed node scripts/test-suite.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green; covers AC-1, AC-5c and AC-7 (the texts and the CI step; the CI run itself is the PR's).

## 4. The measurement and the time in the docs (AC-5, AC-8), after the place

- [x] 4.1 When the coordinating session has given this change a place with no other change running
  on the worker, ask the owner to run, on the Avell,
  `nproc; uptime; time -p node scripts/test-suite.mjs` (bash) from the worktree with
  `TMPDIR=/var/tmp/devkit-suite-speed`, and record what the owner passes back (core count, the three
  load averages, every file's seconds, the `suite:` line, `real`, the commit) in
  `/var/tmp/devkit-suite-speed-proof/measure.md` for the evidence. Check: the file holds all of them
  and the run exited 0.
- [x] 4.2 Decide the split (D-11). No file above 600 seconds: record "no split" with the largest
  file's seconds in `measure.md`. A file above 600 seconds: split it by its section headings as
  D-11 says, prove its test names unchanged with D-10's one-file form (a TAP run of the original
  file at the commit before the split against `node scripts/test-suite.mjs --reporter=tap <its parts>`,
  then D-10 step 4 and its `diff` on the two outputs; the diff is empty), and ask the owner to
  measure again (4.1's command), recorded in `measure.md`. The whole run above 600 seconds with no
  file above it: stop and ask the owner. Check: `measure.md` names the decision, and the last
  measured `real` is at most 600 seconds.
- [x] 4.3 Add T-15 to `plugins/openspec/hooks/test-suite.test.mjs` and see it fail; then write the
  measured time into the `CLAUDE.md` row ("about <m> minutes on an idle 8-core machine", D-9) and
  the `CONTRIBUTING.md` paragraph ("about <m> minutes on an idle 8-core machine; <m:ss> observed on
  <short sha>"), the forms T-15's `MEASURED` and `MEASURED_AT` recognise (D-12); the figures come
  from `measure.md`, never from the test. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^suite-speed AC-8 " plugins/openspec/hooks/test-suite.test.mjs`
  passes, and `grep -c "13 to 21 minutes" CLAUDE.md` prints 0.
- [ ] 4.4 Gate: `mkdir -p /var/tmp/devkit-suite-speed && env TMPDIR=/var/tmp/devkit-suite-speed node scripts/test-suite.mjs && python3 scripts/check.py` green; covers AC-5 and AC-8.

## 5. Release and the proofs (AC-2, AC-6)

Tasks 5.1 and 5.2 run after the last merge of `origin/main` into the branch before review; a later
merge of `origin/main` repeats them.

- [ ] 5.1 The ADR's number (D-9, "The ADR's number"): list
  `git ls-tree --name-only origin/main docs/adr/`. When 0022 is still free, record "0022 still free
  at <sha of origin/main>" in `/var/tmp/devkit-suite-speed-proof/adr-number.md`. When a sibling
  change has taken it, renumber this change's ADR to the next free number on `origin/main` at this
  merge, in one commit: the file (`git mv`), its `# ADR <N>:` title, the `openspec/config.yaml` ADRs
  entry, `openspec/changes/suite-speed/decisions.md`, and every `ADR 0022` of this change's
  `proposal.md`, `design.md` and `tasks.md` (and of `CONTRIBUTING.md` if it names the ADR). Check:
  the ADR file named in `decisions.md` exists, no file of
  `git ls-tree --name-only origin/main docs/adr/` other than it starts with its four-digit number,
  `openspec/config.yaml` holds `<N> the devkit test suite runs by file in parallel` with that
  number, and, when renumbered, `git grep -n "0022-the-devkit-test-suite"` prints nothing; and
  `node scripts/test-suite.mjs --test-name-pattern="^upfront ADR 0021: the documents follow$" plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes.
- [ ] 5.2 The release, in one task (the two pin tests below are red from the bump until the doc
  pin and the assertion move, so no Check runs in between). Bump devkit-openspec and devkit-core by
  a patch, to the next free number on `origin/main` at the last merge before review, in
  `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, and the marketplace version the same way; move the CI pin of
  `docs/openspec-flow.md` (lines 661 to 675 at the base: `<commit sha of v<version>>`, the
  `# pinned to the commit of v<version>` comment, the `(v<version> above)` text and the
  `gh api repos/chacal88/devkit/git/ref/tags/v<version>` command) to the new devkit-openspec
  version; move the assertion of `change-loop docs: the design records the answers`
  (`plugins/openspec/hooks/change-loop.test.mjs:2578`, `v0\.33\.0` at the base) to the new version
  and add the old pin to its `doesNotMatch` list, with its invariant comment (line 2577) extended;
  add the `CHANGELOG.md` section for that marketplace version (one bullet each: the suite script and
  `CLAUDE.md`/`CONTRIBUTING.md`; devkit-openspec's `test-fixtures.mjs`, the import refusal and the
  per-file `TMPDIR`; devkit-core's header comment; CI's one step; the skip check of
  `scripts/check.py`); run `python3 scripts/gen-catalog.py`. The commit names the invariant "the CI
  snippet pins the current release", the layer documentation test, the suite
  `change-loop.test.mjs`. Pinned texts this task touches and their tests:
  `deliver-check.test.mjs:3795` (`the pin in docs/openspec-flow.md is the commit sha of v + ...`),
  `deliver-check.test.mjs:3806` (`AC-8 release-ready: ...`) and `change-loop.test.mjs:2543`. Check:
  `python3 scripts/gen-catalog.py --check` passes,
  `node scripts/test-suite.mjs --test-name-pattern="^the pin in docs/openspec-flow[.]md is the commit sha|^AC-8 release-ready" plugins/openspec/hooks/deliver-check.test.mjs`
  passes (two tests), and
  `node scripts/test-suite.mjs --test-name-pattern="^change-loop docs: the design records the answers$" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [ ] 5.3 Run the AC-2 procedure of D-10 and the AC-6 procedure of D-11, keeping their outputs in
  `/var/tmp/devkit-suite-speed-proof/` (`base.tap`, `head.tap`, `base.names`, `head.names`, the
  diff, `red.log`) for the evidence. The base copy gets its own repository before its run, as D-10
  step 1 says (`git -C /var/tmp/devkit-suite-speed-proof/base init -q && git -C /var/tmp/devkit-suite-speed-proof/base add -A -f`,
  no commit), so that `deliver-check.test.mjs:3199` and `change-loop.test.mjs:2492` can run
  `git ls-files` there; no `git worktree add`. The AC-6 copy needs none (its two files read no
  repository by git). The two AC-2 runs are full runs (the base one is the old
  command, 13 to 45 minutes on the worker): the conducting session runs them, each as a background
  command of the tool, one after the other and never beside a gate or another whole-suite run; a
  subagent runs only the AC-6 part and the name extraction. Check: both AC-2 runs exited 0, the diff
  of `base.names` and `head.names` is empty, and `red.log` shows exit 1 with the failing test's name
  and `plugins/openspec/hooks/jira-task.test.mjs`, and `merge-setup.test.mjs` as `pass`.
- [ ] 5.4 Gate: `mkdir -p /var/tmp/devkit-suite-speed && env TMPDIR=/var/tmp/devkit-suite-speed node scripts/test-suite.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate suite-speed --strict` green; covers AC-1 to AC-8 again on the release head.

## Workflow follow-up

- AC-5b: after `open-pr`, once the pull request's first `check` run has finished and before
  `enable-auto-merge`, read the job's duration (`gh run view <run id> --json jobs`) and record the
  `AC-5b` row in `evidence.md` (a commit under `openspec/` only); above 15 minutes, stop and ask the
  owner before the merge (D-11).
- After the merge, tag the new devkit-openspec version on the merge commit and push the tag
  (`deliver-check` answers `tag-release`, ADR 0019).
- At the merge, tell the coordinating session: open changes whose gate rows quote
  `node --test plugins/openspec/hooks/guard.test.mjs` now run only the guard's tests there and take
  `node scripts/test-suite.mjs` in their next plan or evidence; a test file of theirs that imports a
  test file is refused, with `test-fixtures.mjs` named.
- Archive with the retro; the archive ticks the `suite-speed` line of `openspec/roadmap.md`.
