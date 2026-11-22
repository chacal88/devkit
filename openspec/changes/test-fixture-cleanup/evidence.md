<!-- devkit-stage evidence result=passed attempt=1 commit=7f8fceca2aacfbd44451b470dbead17efc9a0686 -->
Commit: 7f8fceca2aacfbd44451b470dbead17efc9a0686

# Evidence: test-fixture-cleanup

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `node --test plugins/openspec/hooks/test-tmp.test.mjs` | pass: 10 tests, 10 pass, 0 fail |
| 1.4 | `command claude plugin validate .` | pass: validation passed |
| 2.4 | `mkdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder made fresh |
| 2.4 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-p2 node --test plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 176 tests, 176 pass, 0 fail |
| 2.4 | `rmdir /var/tmp/devkit-test-fixture-cleanup-p2` | pass: folder was empty |
| 3.7 | `mkdir /var/tmp/devkit-test-fixture-cleanup-run` | pass: folder made fresh |
| 3.7 | `env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-run GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1397 tests, 1397 pass, 0 fail; duration 1234 s (about 20.6 min) |
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
| AC-1 | A helper folder is gone once its test ends, passed or failed | `test-tmp.test.mjs` AC-1 tests (probe: pass and fail tests, exit 1, `SEEN pass=false fail=false`, child root empty; bad prefix refused); gate 1.4 and again inside gate 3.7 | pass |
| AC-2 | Module-level and missed folders are swept at run end and on SIGINT and SIGTERM | `test-tmp.test.mjs` AC-2 tests (run end, SIGTERM, SIGINT; child root empty); gates 1.4, 2.4 | pass |
| AC-3 | A static test fails on any raw `mkdtempSync` or `tmpdir()` in `*.test.mjs` under `plugins/`, naming `file:line` | AC-3 tests pass (synthetic file found by file and line; repository returns none); `grep -rnE "mkdtempSync\(\|tmpdir\(" --include=*.test.mjs plugins` counted 0 lines at this commit; gate 3.7 | pass |
| AC-4 | A test fails when the three helper copies differ | AC-4 tests pass (three copies identical, one-byte change named); sha256 of the three files starts `72c3da07fcb147db` for all | pass |
| AC-5 | CI hook-test step runs with a fresh empty `TMPDIR` and the next step fails on leftovers | AC-5 test passes against `.github/workflows/ci.yml` (steps `Hook tests` with `TMPDIR: ${{ runner.temp }}/hook-tests-tmp` and `mkdir "$TMPDIR"`, then `Hook tests left nothing in TMPDIR` with `ls -A` and `exit 1`). The CI run itself is no proof yet: no pull request exists | pass |
| AC-6 | The 18 test files use only their pack's helper, suites stay green, and a guard run on a fresh `TMPDIR` leaves it empty | Gate 2.4 (7 files, 176 pass, folder empty); gate 3.7 (1397 pass, folder empty at `rmdir`); raw-call grep 0 | pass |

Notes: `git status --short` was clean at the verified commit. The pull request's own `check` run on Node 22 is not gathered here (no PR yet).
