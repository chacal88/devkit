<!-- devkit-stage evidence result=passed attempt=4 commit=e35441dae6d028c5cca414fcc2a1b58c85c0e71c -->
Commit: e35441dae6d028c5cca414fcc2a1b58c85c0e71c

# Evidence: test-fixture-cleanup

## Verification

Re-run at the commit above, the merge e35441d (GitHub's update-branch, which brought origin/main 08eea2b, the archive of stage-roles, #66); the earlier evidence, written at 3248cda, is replaced. Outside `openspec/`, `git diff 3248cda HEAD` changes only `plugins/openspec/hooks/change-loop.test.mjs` (5 insertions, 1 deletion, the 'stage-roles docs: ADR 0016' test). `git status --short` was clean before this file was written. Local runs used fresh folders under `/var/tmp`; the whole local guard suite was not re-run: the CI `check` job at this head ran it (see gate 3.7 and AC-5).

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `node --test plugins/openspec/hooks/test-tmp.test.mjs` | pass: 10 tests, 10 pass, 0 fail (on a fresh empty TMPDIR, empty after) |
| 1.4 | `command claude plugin validate .` | pass: validation passed |
| 2.4 | `mkdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder made fresh |
| 2.4 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-p2 node --test plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 176 tests, 176 pass, 0 fail, 0 cancelled |
| 2.4 | `rmdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder was empty (exit 0) |
| 3.7 | `mkdir /var/tmp/devkit-test-fixture-cleanup-run` | pass: not run locally at this commit; the equivalent is the CI step that makes a fresh empty TMPDIR (run 45090809591, success) |
| 3.7 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-run GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: not run locally at this commit; the whole guard suite ran in the `check` job of CI run 45090809591 at head e35441d, step `Hook tests` success (47:27 to 56:02 UTC, about 8.6 min). The last local whole-suite run was at 3248cda (1532 of 1532); the only later non-openspec change is the 5-line `change-loop.test.mjs` edit, whose file ran whole here (794 of 794, 0 fail, 0 cancelled, 1148 s, TMPDIR empty after) |
| 3.7 | `rmdir /var/tmp/devkit-test-fixture-cleanup-run` | pass: not run locally at this commit; the equivalent is the CI step `Hook tests left nothing in TMPDIR`, success |
| 4.4 | `node --test plugins/openspec/hooks/test-tmp.test.mjs` | pass: 10 tests, 10 pass, 0 fail |
| 4.4 | `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs` | pass: 1 test, 1 pass |
| 4.4 | `python3 scripts/check.py` | pass: all checks passed |
| 4.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.4 | `command claude plugin validate .` | pass: validation passed |
| 4.4 | `openspec validate test-fixture-cleanup --strict` | pass: change is valid |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | A helper folder is gone once its test ends, passed or failed | `test-tmp.test.mjs` AC-1 tests (10 of 10 pass); gate 1.4 and again in the CI whole-suite run at this head (gate 3.7) | pass |
| AC-2 | Module-level and missed folders are swept at run end and on SIGINT and SIGTERM | `test-tmp.test.mjs` AC-2 tests (run end, SIGTERM, SIGINT); gates 1.4, 2.4 | pass |
| AC-3 | A static test fails on any raw `mkdtempSync` or `tmpdir()` in `*.test.mjs` under `plugins/`, naming `file:line` | AC-3 tests pass; `grep -rnE "mkdtempSync\(\|tmpdir\(" --include=*.test.mjs plugins` counted 0 lines at this commit; CI whole-suite run (gate 3.7) | pass |
| AC-4 | A test fails when the three helper copies differ | AC-4 tests pass; sha256 of the three helper files starts `72c3da07fcb147db` for all three at this commit | pass |
| AC-5 | CI hook-test step runs with a fresh empty `TMPDIR` and the next step fails on leftovers | The `check` job of run 45090809591 on PR #62 at head e35441d concluded success: steps `Hook tests` and `Hook tests left nothing in TMPDIR` both success. The AC-5 test of `test-tmp.test.mjs` also passes locally. The `devkit-reviews` check was red when read (6 s run); it is a separate stage, and its reviews are refreshed for the new head by the review stage | pass | pass |
| AC-6 | The 18 test files use only their pack's helper, suites stay green, and a guard run on a fresh `TMPDIR` leaves it empty | Gate 2.4 (7 files, 176 pass, folder empty at `rmdir`); `change-loop.test.mjs` on a fresh empty TMPDIR (794 pass, folder empty after); CI whole-suite run at this head, green, with the left-nothing step green; raw-call grep 0 | pass |
