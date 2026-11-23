<!-- devkit-stage evidence result=passed attempt=3 commit=c093f6eaa8724245aa06bc73376e85b27c8ff65a -->
Commit: c093f6eaa8724245aa06bc73376e85b27c8ff65a

# Evidence: delivery-models

Verified on branch `delivery-models` at the commit above (merge of origin/main `ae1243c`; release devkit-openspec 0.28.0, devkit-core 0.13.0, marketplace 0.32.0; ADR 0018). The tree was clean. Every run used a private TMPDIR, `--test-concurrency=1`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`. `guard.test.mjs` imports every hook suite, so the whole guard suite ran once and gates 1.5 to 5.4 are recorded as covered by that run instead of re-running each command. The plan's "ADR 0015" is delivered as ADR 0018 (`proof/ac-map.md` notes it).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 2.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/merge-setup.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^--ci" plugins/openspec/hooks/deliver-check.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models" plugins/openspec/hooks/guard.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 5.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: covered by the one whole-suite run of `guard.test.mjs` (2056 tests, 2056 pass, 0 fail, exit 0), which imports every hook suite this gate names |
| 6.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 2056 tests, 2056 pass, 0 fail (whole suite, background run, private TMPDIR, --test-concurrency=1, exit 0) |
| 1.5, 2.6, 3.6, 4.7, 5.4, 6.9 | `python3 scripts/check.py` | pass: all checks passed (exit 0) |
| 6.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 6.9 | `command claude plugin validate .` | pass: Validation passed (exit 0) |
| 6.9 | `openspec validate delivery-models --strict` | pass: Change 'delivery-models' is valid (exit 0) |

### Acceptance criteria

Each row ran the named tests in `plugins/openspec/hooks/delivery-models.test.mjs` with `--test-name-pattern` at this commit (counts from this run); the mapping is in `openspec/changes/delivery-models/proof/ac-map.md`.

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `model-chosen-per-project` | patterns `^delivery-models config` (26/26 pass, includes the new test `the block keeps the budget at its own level, never one nested under delivery`, also run alone: 1/1 pass), `^delivery-models open` (10/10 pass), `^delivery-models docs` (1/1 pass); the other suites green in the whole-suite run (2056/2056) cover no behaviour change for `plan`, `pr` and `merge` projects | pass |
| AC-2 | `two-prs-open-together` | pattern `^delivery-models AC-2` (3/3 pass) | pass |
| AC-3 | `owner-merges-both` | patterns `^delivery-models AC-3` (3/3 pass) and `closed test-branch pull request` (5/5 pass) | pass |
| AC-4 | `base-waits-for-test-branch` | pattern `^delivery-models AC-4` (1/1 pass) | pass |
| AC-5 | `test-branch-never-in-task-branch` | pattern `^delivery-models AC-5` (2/2 pass) | pass |
| AC-6 | `conflict-on-support-branch` | pattern `^delivery-models AC-6` (3/3 pass) | pass |
| AC-7 | `conflict-resolution-reviewed` | pattern `^delivery-models AC-7` (3/3 pass) | pass |
| AC-8 | `fix-reaches-both` | pattern `^delivery-models AC-8` (3/3 pass, with and without a support branch) | pass |
| AC-9 | `archive-to-both` | pattern `^delivery-models AC-9` (16/16 pass) | pass |
| AC-10 | `proof-in-tests` | AC-2 to AC-9 rows run against real Git in a temporary folder with a simulated GitHub; `proof/ac-map.md` names each test; `^delivery-models docs` 1/1 pass | pass |

No UI, API or deploy surface is touched, so no screenshots or endpoint calls apply.
