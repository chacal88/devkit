<!-- devkit-stage evidence result=passed attempt=1 commit=1af5080809c5d4ad8015ed0075862ac1253060a6 -->
Commit: 1af5080809c5d4ad8015ed0075862ac1253060a6

# Evidence: delivery-models

Verified on branch `delivery-models`, working tree clean. Every run used a private TMPDIR,
`--test-concurrency=1` (added to each `node --test` part; the command cell shows the part as
`tasks.md` writes it), `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`. The plan's
"ADR 0015" is ADR 0017 in the delivered files (ac-map.md notes it).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: 2084 tests, 2084 pass, 0 fail |
| 2.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 3509 tests, 3509 pass, 0 fail |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/merge-setup.test.mjs` | pass: 1162 tests, 1162 pass, 0 fail |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^--ci" plugins/openspec/hooks/deliver-check.test.mjs` | pass: 25 tests, 25 pass, 0 fail |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: 1357 tests, 1357 pass, 0 fail |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models" plugins/openspec/hooks/guard.test.mjs` | pass: 205 tests, 205 pass, 0 fail |
| 5.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 2355 tests, 2355 pass, 0 fail |
| 6.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1602 tests, 1602 pass, 0 fail (whole suite, exit 0) |
| 1.5, 6.9 | `python3 scripts/check.py` | pass: all checks passed (exit 0) |
| 6.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 6.9 | `command claude plugin validate .` | pass: Validation passed (exit 0) |
| 6.9 | `openspec validate delivery-models --strict` | pass: Change 'delivery-models' is valid (exit 0) |

### Acceptance criteria

Each row ran the named tests in `plugins/openspec/hooks/delivery-models.test.mjs` with
`--test-name-pattern` (tests, pass, fail counted in this run); the mapping is in
`openspec/changes/delivery-models/proof/ac-map.md`.

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `model-chosen-per-project` | patterns `^delivery-models config` (25/25 pass), `^delivery-models open` (10/10 pass), `^delivery-models docs` (1/1 pass) | pass |
| AC-2 | `two-prs-open-together` | pattern `^delivery-models AC-2` (3/3 pass) | pass |
| AC-3 | `owner-merges-both` | pattern `^delivery-models AC-3` (3/3 pass) | pass |
| AC-4 | `base-waits-for-test-branch` | pattern `^delivery-models AC-4` (1/1 pass) | pass |
| AC-5 | `test-branch-never-in-task-branch` | pattern `^delivery-models AC-5` (2/2 pass: the hook refusal and the check naming the commit) | pass |
| AC-6 | `conflict-on-support-branch` | pattern `^delivery-models AC-6` (3/3 pass) | pass |
| AC-7 | `conflict-resolution-reviewed` | pattern `^delivery-models AC-7` (3/3 pass) | pass |
| AC-8 | `fix-reaches-both` | pattern `^delivery-models AC-8` (3/3 pass, with and without a support branch) | pass |
| AC-9 | `archive-to-both` | pattern `^delivery-models AC-9` (16/16 pass: delivered, archive ready, both merged, negatives) | pass |
| AC-10 | `proof-in-tests` | AC-2 to AC-9 rows above run against real Git in a temporary folder with a simulated GitHub; ac-map.md names each test (`^delivery-models docs` 1/1 pass) | pass |

No UI, API or deploy surface is touched, so no screenshots or endpoint calls apply.
