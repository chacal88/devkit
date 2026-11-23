<!-- devkit-stage evidence result=passed attempt=2 commit=99ef2bd4c6d45c4c302d15fbdcde0e076c9522b2 -->
Commit: 99ef2bd4c6d45c4c302d15fbdcde0e076c9522b2

# Evidence: delivery-models

Verified on branch `delivery-models` at the commit above. The only untracked paths are the review
round's `review.md` and `reviews/`, which are not part of this evidence. Every run used a private
TMPDIR, `--test-concurrency=1` (added to each `node --test` part; the command cell shows the part as
`tasks.md` writes it), `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`. The plan's
"ADR 0015" is delivered as ADR 0018 (`docs/adr/0018-the-delivery-model-is-chosen-per-project.md`;
ac-map.md notes it).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: 2358 tests, 2358 pass, 0 fail |
| 2.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 4037 tests, 4037 pass, 0 fail |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/merge-setup.test.mjs` | pass: 1190 tests, 1190 pass, 0 fail |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^--ci" plugins/openspec/hooks/deliver-check.test.mjs` | pass: 25 tests, 25 pass, 0 fail |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: 1388 tests, 1388 pass, 0 fail |
| 4.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models" plugins/openspec/hooks/guard.test.mjs` | pass: 208 tests, 208 pass, 0 fail |
| 5.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 2821 tests, 2821 pass, 0 fail |
| 6.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1920 tests, 1920 pass, 0 fail (whole suite, background run, exit 0) |
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
| AC-1 | `model-chosen-per-project` | patterns `^delivery-models config` (25/25 pass), `^delivery-models open` (10/10 pass), `^delivery-models docs` (1/1 pass); the other suites staying green in the whole-suite run (1920/1920) covers "no behaviour change" for `plan`, `pr` and `merge` projects | pass |
| AC-2 | `two-prs-open-together` | pattern `^delivery-models AC-2` (3/3 pass) | pass |
| AC-3 | `owner-merges-both` | pattern `^delivery-models AC-3` (3/3 pass); pattern `closed test-branch pull request` (5/5 pass: the three new tests where a closed test-branch pull request blocks before opening the missing base pull request, before pushing an unpushed base branch and before editing an incomplete base pull request body, plus the stop-and-write-nothing and the `pr-closed` owner-end tests); the three new tests failed before the fix (`proof/fix-red.txt`) | pass |
| AC-4 | `base-waits-for-test-branch` | pattern `^delivery-models AC-4` (1/1 pass) | pass |
| AC-5 | `test-branch-never-in-task-branch` | pattern `^delivery-models AC-5` (2/2 pass: the hook refusal and the check naming the commit) | pass |
| AC-6 | `conflict-on-support-branch` | pattern `^delivery-models AC-6` (3/3 pass) | pass |
| AC-7 | `conflict-resolution-reviewed` | pattern `^delivery-models AC-7` (3/3 pass) | pass |
| AC-8 | `fix-reaches-both` | pattern `^delivery-models AC-8` (3/3 pass, with and without a support branch) | pass |
| AC-9 | `archive-to-both` | pattern `^delivery-models AC-9` (16/16 pass: delivered, archive ready, both merged, negatives) | pass |
| AC-10 | `proof-in-tests` | AC-2 to AC-9 rows above run against real Git in a temporary folder with a simulated GitHub; ac-map.md names each test (`^delivery-models docs` 1/1 pass) | pass |

No UI, API or deploy surface is touched, so no screenshots or endpoint calls apply.
