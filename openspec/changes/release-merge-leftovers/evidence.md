<!-- devkit-stage evidence result=passed attempt=2 commit=3897ced174a7a3160e1f2b234d339b35d84d5cbc -->
Commit: 3897ced174a7a3160e1f2b234d339b35d84d5cbc

# Evidence: release-merge-leftovers

Verified on branch `release-merge-leftovers` at the commit above (the merge of `origin/main` into the branch);
the only untracked file is this `evidence.md` (no uncommitted change outside `openspec/`). This replaces the
attempt-1 file, written at `6564acd`, which went stale when `origin/main` was merged.

What the merge brought (`git log 6564acd..HEAD`: `44ca321` archive of roadmap-panel-study, `5775191` archive of
suite-speed, and the merge `3897ced`; `git diff --name-only 6564acd HEAD` outside `openspec/changes/archive/`):
`openspec/roadmap.md`, `CLAUDE.md` (1 line), `CONTRIBUTING.md` (1 line) and `docs/conventions.md` (1 line added).
So the merged-in commits are archive commits plus three documentation lines, no source and no test file. The
whole-suite run quoted below ran on `0816112` (before the merge). Two test files read the real `CLAUDE.md` and
`CONTRIBUTING.md` (`test-suite.test.mjs` AC-8, `deliver-check-cli.test.mjs` "AC-8 release-ready"); both were re-run
at this `HEAD` (see the gate rows and AC-4). `git diff origin/main --stat` is now 15 files, 572 insertions,
14 deletions, the same as `git diff origin/main...HEAD --stat`, and `git rev-list --count HEAD..origin/main` is 0:
the branch holds everything the local `origin/main` ref holds (no fetch was done).

## Verification

### Gates

Gate 3.4's `node --test plugins/openspec/hooks/guard.test.mjs` and gate 2.3's `node --test ... release-tags.test.mjs`
were not re-run one by one: `node scripts/test-suite.mjs` (the project's whole-suite command) imports both files
and ran green on `0816112`, `suite: 38 files, 2767 tests, 2766 pass, 0 fail, 696.2s, concurrency 14`
(1 test neither passed nor failed: skipped; the log is `/private/tmp/claude-501/gate34-rml.log`, run by the
conducting session). Its per-file lines include `pass 59.0s plugins/openspec/hooks/guard.test.mjs`,
`pass 145.9s plugins/openspec/hooks/release-tags.test.mjs` and `pass 577.2s plugins/openspec/hooks/delivery-models.test.mjs`.
The merge after that run changed no `.mjs`, `.ts` or `.tsx` file, so the run stands for the code at this `HEAD`;
the documentation lines the merge changed are read by the two tests named above, re-run here. The panel suite and
the cheap parts below were run by the verifier at this `HEAD` with `TMPDIR=/private/tmp/devkit-release-merge-leftovers GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`.

| Gate | Command | Result |
| --- | --- | --- |
| 1.2 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: exit 0, `170 pass`, `0 fail`, `Ran 170 tests across 2 files. [8.16s]` (re-run at HEAD) |
| 2.3 | `mkdir -p /private/tmp/devkit-rml-p2` | pass: scaffolding of the gate; the folder is only the TMPDIR of the next part, which the whole-suite run covers |
| 2.3 | `env TMPDIR=/private/tmp/devkit-rml-p2 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/release-tags.test.mjs` | pass: stood for by the whole-suite run on `0816112` (`pass 145.9s release-tags.test.mjs`, `pass 577.2s delivery-models.test.mjs`, 0 fail; the merge since changed no test or source file); the two new `under two-prs` tests re-run at HEAD, 2 pass 0 fail (see AC-3) |
| 2.3 | `rmdir /private/tmp/devkit-rml-p2` | pass: scaffolding of the gate; not run by the verifier (its own scratch folder `/private/tmp/devkit-release-merge-leftovers` was emptied and removed, `rmdir` exit 0) |
| 3.4 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: exit 0, 170 pass 0 fail (same run as gate 1.2, at HEAD) |
| 3.4 | `mkdir -p /private/tmp/devkit-rml-p3` | pass: scaffolding of the gate |
| 3.4 | `env TMPDIR=/private/tmp/devkit-rml-p3 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: stood for by the whole-suite run on `0816112`, `pass 59.0s plugins/openspec/hooks/guard.test.mjs`, suite total 2767 tests, 2766 pass, 0 fail, 696.2s (concurrency 14); at HEAD `test-suite.test.mjs` re-run, `suite: 1 files, 18 tests, 18 pass, 0 fail, 4.0s`, and the "AC-8 release-ready" test of `deliver-check-cli.test.mjs`, `suite: 1 files, 1 tests, 1 pass, 0 fail, 0.1s`, the two tests that read the real documents the merge edited |
| 3.4 | `rmdir /private/tmp/devkit-rml-p3` | pass: scaffolding of the gate |
| 3.4 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` (re-run at HEAD) |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at HEAD) |
| 3.4 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` | pass: exit 0, `Validation passed` (re-run at HEAD) |
| 3.4 | `openspec validate release-merge-leftovers --strict` | pass: exit 0, `Change 'release-merge-leftovers' is valid` (re-run at HEAD) |

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `openspec/specs/commit-attribution/spec.md` holds no `push-rebased` and no scenario that hands a rewritten branch to the commit agent; the dispatch scenario still names the shipping skill's rows and the devkit skill's `agent` items | Task 3.3 re-run by the verifier at HEAD: `openspec/` copied to a scratch folder (`mktemp -d`, which on this machine landed under `/var/folders/.../T/`, not under the `TMPDIR` variable), `openspec archive release-merge-leftovers --yes` exit 0 (`commit-attribution: update`, `+ 1 added, ~ 1 modified, - 1 removed`, archived as `2026-11-24-release-merge-leftovers`). On the archived spec: `grep -c push-rebased` 0, `grep -c 'own rebase rewrote'` 0, `grep -c '^#### Scenario:'` 17 (18 in the repository's unarchived spec), `grep -n "A branch the loop"` finds nothing (exit 1), the requirement `Every hand-off to the commit agent asks the session for its attribution lines` holds 9 scenarios, and line 26 reads `the shipping skill's rows commit, open-pr, push and open-archive-pr, and the devkit skill's agent items, are read`. The scratch folder was removed; `git status --short` afterwards shows only this file, so the repository's own spec was not edited. | pass |
| AC-2 | `steps.ts`, `i18n.ts` and `report.test.tsx` hold no `push-rebased`; the panel suite passes with the label table and the step table agreeing | `grep -rn push-rebased plugins/panel` prints nothing (grep exit 1) at HEAD. Panel suite re-run at HEAD: exit 0, 170 pass, 0 fail, including the tests of the step and label tables (the log's last lines show `AC-18 owner-run-actor` and `D7 view-4` passing). `git diff origin/main...HEAD --stat` shows `i18n.ts` 1 line removed, `report.test.tsx` 2 lines changed, `steps.ts` 2 lines changed (unchanged by the merge). | pass |
| AC-3 | Under the two-PR delivery model, a change PR that conflicts only in `CHANGELOG.md` and the manifests makes conduct-check answer `resolve-release-conflict` with the paths and a command ending in `--base main`; a conflict in `README.md` as well makes it answer `blocked` | Re-run by the verifier at HEAD: `node scripts/test-suite.mjs --test-name-pattern="under two-prs" plugins/openspec/hooks/conduct-check.test.mjs`, exit 0, `2 pass 0 fail` (6.6 s): `conduct: under two-prs, a change PR in conflict only in release files is resolve-release-conflict on the base branch, never the test branch (release-merge-leftovers AC-3)` and `conduct: under two-prs, a conflict that also has README.md is blocked (release-merge-leftovers AC-3)`. Read in the test file (attempt 1): the first asserts the `gh pr list` bases are `main` and `develop` (two-prs in force), step `resolve-release-conflict`, paths `.claude-plugin/marketplace.json` and `CHANGELOG.md`, `--base` followed by `main`, no `develop` in the command; the second asserts step `blocked` and state `blocked: item 5 (conflict in README.md)`. Non-vacuity switch, run by the conducting session with Edit at this HEAD (the verifier cannot write a test file, so this part is the conductor's report, not the verifier's run): with `twoPrsConflict` on `{ config: CONFIG }` both tests failed (0 pass, 2 fail) on their first assertions (`deliver-check read the PRs to main and to develop: the two-prs model is in force` and `the two-prs model is in force`); restored to `{ config: TWO_PRS_CONFIG }`, 2 pass 0 fail. The verifier then found `git status --short` showing no modification of `conduct-check.test.mjs`, so the restore held. | pass |
| AC-4 | No behaviour changes: the release step, the override and the delivery checker answer every input as before, and the other suites keep their results | Whole-suite run on `0816112` (before the merge; the merge changed no `.mjs`, `.ts` or `.tsx` file): `suite: 38 files, 2767 tests, 2766 pass, 0 fail, 696.2s, concurrency 14`. Re-run at HEAD by the verifier: panel suite `170 pass 0 fail`; `scripts/check.py` `all checks passed`; `gen-catalog.py --check` exit 0; plugin validate `Validation passed`; `openspec validate release-merge-leftovers --strict` valid; `test-suite.test.mjs` 18 pass 0 fail and the "AC-8 release-ready" test 1 pass 0 fail (the two tests that read the `CLAUDE.md` and `CONTRIBUTING.md` lines the merge edited). `git diff origin/main...HEAD --name-only` (15 files) lists only the plan's files: `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/openspec-flow.md`, the change folder (5 files before this one: `.openspec.yaml`, `proposal.md`, `requirements.md`, `specs/commit-attribution/spec.md`, `tasks.md`), `plugins/openspec/.claude-plugin/plugin.json`, `plugins/openspec/hooks/change-loop-compozy.test.mjs`, `plugins/openspec/hooks/conduct-check.test.mjs`, `plugins/panel/.claude-plugin/plugin.json`, `plugins/panel/hooks/i18n.ts`, `plugins/panel/hooks/report.test.tsx`, `plugins/panel/hooks/steps.ts`; no `.mjs` source of the loop, conduct-check or deliver-check changed, only tests. `grep -c "v0.33.0" docs/openspec-flow.md` prints 0. | pass |

## Outcome

verified: all four criteria have proof. The non-vacuity switch of AC-3 is the conducting session's run, recorded as such; the whole-suite run predates the merge of `origin/main` and stands for it because the merge changed no code or test file, with the two tests that read the edited documents re-run.
