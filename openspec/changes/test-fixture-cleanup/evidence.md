<!-- devkit-stage evidence result=passed attempt=2 commit=64a95737015dd45819df3e79d194760533e1f0e4 -->
Commit: 64a95737015dd45819df3e79d194760533e1f0e4

# Evidence: test-fixture-cleanup

## Verification

All gates below were run again at the commit above (the merge of origin/main that moved the release to devkit-openspec 0.21.3); the earlier evidence, written at 7f8fcec, is replaced.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `node --test plugins/openspec/hooks/test-tmp.test.mjs` | pass: 10 tests, 10 pass, 0 fail |
| 1.4 | `command claude plugin validate .` | pass: validation passed |
| 2.4 | `mkdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder made fresh |
| 2.4 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-p2 node --test plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 176 tests, 176 pass, 0 fail |
| 2.4 | `rmdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder was empty |
| 3.7 | `mkdir /var/tmp/devkit-test-fixture-cleanup-run` | pass: folder made fresh |
| 3.7 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-run GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1407 tests, 1407 pass, 0 fail; duration 1731 s (about 28.9 min, machine under load from other sessions) |
| 3.7 | `rmdir /var/tmp/devkit-test-fixture-cleanup-run` | pass: folder was empty |
| 4.4 | `node --test plugins/openspec/hooks/test-tmp.test.mjs` | pass: 10 tests, 10 pass, 0 fail |
| 4.4 | `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs` | pass: 1 test, 1 pass |
| 4.4 | `python3 scripts/check.py` | pass: all checks passed |
| 4.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.4 | `command claude plugin validate .` | pass: validation passed |
| 4.4 | `openspec validate test-fixture-cleanup --strict` | pass: change is valid |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | A helper folder is gone once its test ends, passed or failed | `test-tmp.test.mjs` AC-1 tests (10 of 10 pass); gate 1.4 and again inside gate 3.7 (1407 pass) | pass |
| AC-2 | Module-level and missed folders are swept at run end and on SIGINT and SIGTERM | `test-tmp.test.mjs` AC-2 tests (run end, SIGTERM, SIGINT); gates 1.4, 2.4 | pass |
| AC-3 | A static test fails on any raw `mkdtempSync` or `tmpdir()` in `*.test.mjs` under `plugins/`, naming `file:line` | AC-3 tests pass; `grep -rnE "mkdtempSync\(\|tmpdir\(" --include=*.test.mjs plugins` counted 0 lines at this commit; gate 3.7 | pass |
| AC-4 | A test fails when the three helper copies differ | AC-4 tests pass; sha256 of the three helper files starts `72c3da07fcb147db` for all three at this commit | pass |
| AC-5 | CI hook-test step runs with a fresh empty `TMPDIR` and the next step fails on leftovers | The `check` job of run 45080087295 on PR #62 at head 64a9573 concluded success: steps `Hook tests` and `Hook tests left nothing in TMPDIR` both success. The AC-5 test of `test-tmp.test.mjs` also passes. The `devkit-reviews` check was red at the time of reading only because evidence.md and the two reviews were stale against 64a9573 (its own output: items 1, 2 and 4 open); this file answers items 1 and 4, the reviews are a separate stage | pass |
| AC-6 | The 18 test files use only their pack's helper, suites stay green, and a guard run on a fresh `TMPDIR` leaves it empty | Gate 2.4 (7 files, 176 pass, folder empty at `rmdir`); gate 3.7 (1407 pass, folder empty at `rmdir`); raw-call grep 0 | pass |

Notes: `git status --short` was clean at the verified commit before this file was written.
