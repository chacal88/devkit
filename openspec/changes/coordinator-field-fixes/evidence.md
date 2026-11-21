<!-- devkit-stage evidence result=passed attempt=2 commit=fb91e5fa5c25194196ffaa33d1934949f2727384 -->
Commit: fb91e5fa5c25194196ffaa33d1934949f2727384

# Evidence

Change: `coordinator-field-fixes`. Verified on branch `coordinator-field-fixes` at the commit above
(attempt 2, after the review-round-1 fix commit), working tree clean. Every gate part ran on its own and its exit code decided. The full guard suite
(7.5) was not re-run by the verifier: its row cites the conducting session's run of the same tree
(full output kept outside the repository), 985 tests, 985 pass, 0 fail.

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^flow-check" --test-name-pattern="^change-loop" --test-name-pattern="^install-schemas" --test-name-pattern="roadmap" plugins/openspec/hooks/guard.test.mjs` | pass: 341 tests, 341 pass, 0 fail |
| 1.4, 2.5, 3.4, 4.5, 5.6, 6.5, 7.5 | `python3 scripts/check.py` | pass: all checks passed |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^flow-check" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 323 tests, 323 pass, 0 fail |
| 3.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: 940 tests, 940 pass, 0 fail |
| 3.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 254 tests, 254 pass, 0 fail |
| 4.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs` | pass: 368 tests, 368 pass, 0 fail |
| 4.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" plugins/openspec/hooks/guard.test.mjs` | pass: 87 tests, 87 pass, 0 fail |
| 5.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs` | pass: 794 tests, 794 pass, 0 fail |
| 6.5, 7.5 | `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 71 tests, 71 pass, 0 fail |
| 7.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 985 tests, 985 pass, 0 fail (conducting session's background run of this tree, about 13 minutes; not re-run here) |
| 7.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 7.5 | `command claude plugin validate .` | pass: Validation passed |

### Acceptance criteria

| AC | Criterion | Proof and where it is | Result |
| --- | --- | --- | --- |
| AC-1 | `archived-change-not-unfinished` | Test `field-fixes 1 archived` (archive branch with merged pull request not listed; unmerged one still listed) and `field-fixes 1 archived: a new change that reuses an archived id, created after the archive, stays listed` pass in the 2.5 and 7.5 runs (the second is the review-round-1 test); red on 0.16.0 in `proof/red-2.txt`. In this repository `proof/start-this-repo.txt` (run of `change-loop.mjs start`, request "change") lists four unfinished ids and none of `change-coordinator`, `release-rebase-pin`, `review-workflow` (grep count 0). | pass |
| AC-2 | `previous-script-stays-previous` | Test `field-fixes 2 previous-script` (headed `readiness.md` over a headerless plan is still previous script; `next` ends `blocked` with `previous-script`) passes in the 2.5 and 7.5 runs; red in `proof/red-2.txt`. | pass |
| AC-3 | `ci-other-script-passes-with-note` | Test `field-fixes 3 reviews-check` (other schema passes with a note from `deliver-check --ci` and `guard.mjs ci`) passes in the 4.5 run; red in `proof/red-4.txt`. | pass |
| AC-4 | `ci-several-changes-each-checked` | `field-fixes 3 reviews-check` tests for several change folders pass in the 4.5 run (`deliver-check.test.mjs` 368 pass and 87 `field-fixes` pass); red in `proof/red-4.txt`. | pass |
| AC-5 | `ci-archive-without-retro-explains` | Archive-without-retro message test in the 4.5 `field-fixes` run (87 pass); red in `proof/red-4.txt`. | pass |
| AC-6 | `delivered-needs-own-pr-and-all-tasks` | Test `field-fixes 4 delivered` (including the two about the pull request after a merge with tasks left, added after review round 1) passes in the 3.4 and 7.5 runs; red in `proof/red-3.txt`. | pass |
| AC-7 | `github-setup-names-what-blocks` | Test `field-fixes 5 actions` and the sibling rulesets and failed-run tests pass in the 5.6 run (`github-setup.test.mjs`); red in `proof/red-5a.txt`. | pass |
| AC-8 | `required-checks-run-on-pull-requests` | Required-checks default-list test in the 5.6 run (`github-setup.test.mjs`); red in `proof/red-5a.txt`. | pass |
| AC-9 | `project-openspec-wins` | Test `field-fixes 6 flow-check` (pinned 1.16.0 and 2.x on PATH exits 3, PATH CLI never runs) and its `change-loop`, `guard`, `install-schemas.sh` siblings pass in the 1.4 run; red in `proof/red-1.txt`. | pass |
| AC-10 | `upgrade-respects-changes-under-way` | Test `field-fixes 7 listing` and the changes-under-way tests pass in the 5.6 run (`changes-under-way.test.mjs`, `install-schemas.test.mjs`); red in `proof/red-5b.txt`. | pass |
| AC-11 | `compozy-rerun-keeps-local-edits` | Test `field-fixes 8 kit` and sibling edit-preservation tests pass in the 6.5 run (71 pass); red in `proof/red-6.txt`. | pass |
| AC-12 | `roadmap-line` | Test `field-fixes 12 roadmap` passes in the 1.4 and 7.5 runs; it has no red file by design (`proof/README.txt`). `openspec/roadmap.md` carries an unticked `coordinator-field-fixes` line (after: change-coordinator). The tick by the archive is not yet observable. | pass |
| AC-13 | `reproduced-before-fixed` | `proof/README.txt` maps each of the eight defects to a test and a red file (`proof/red-1.txt`, `red-2.txt`, `red-3.txt`, `red-4.txt`, `red-5a.txt`, `red-5b.txt`, `red-6.txt`). Each red file holds failing lines (marked with the cross) from the 0.16.0 code; the same tests pass in the 7.5 run. The verifier read the red files' failure counts but did not re-run the 0.16.0 code. | pass |
| AC-14 | `no-other-behaviour-changes` | The full guard suite (985 pass), the 940-test `deliver-check` and `flow-check` run, the 794-test setup run and the 71-test kit run are all green; `check.py`, the catalog check and the marketplace validation pass. Green suites show no regression in pinned behaviour; whether an unpinned behaviour changed is not proven beyond them. | pass |

## Verification

No UI, API or deploy surface is touched, so there are no screenshots or endpoint calls. Every proof
is a test run, the recorded red runs, or the run of `change-loop.mjs start` in this repository.

Outcome: verified
