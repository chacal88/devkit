<!-- devkit-stage evidence result=passed attempt=4 commit=6d072f992be7244bab6e8962f8be4af42f6f2cd4 -->
Commit: 6d072f992be7244bab6e8962f8be4af42f6f2cd4

# Evidence: release-merge-leftovers

Verified on branch `release-merge-leftovers` at the commit above (the merge `6d072f9` of `origin/main` into the
branch). `git status --short` was empty before this file was rewritten, so the code verified has no uncommitted
change. This replaces the attempt-3 file, written at `c75d8e1`, which went stale when `origin/main` was merged again
after train 1 left.

What the merge brought (`git diff --name-only c75d8e1 HEAD` outside `openspec/changes/`): `.claude-plugin/marketplace.json`,
`CHANGELOG.md`, `docs/openspec-flow.md`, `openspec/trains/1.md`, `plugins/openspec/.claude-plugin/plugin.json`,
`plugins/openspec/hooks/change-loop-compozy.test.mjs`, `plugins/openspec/hooks/deliver-check-archive.test.mjs` and
`plugins/openspec/hooks/deliver-check.mjs`: main's own-pr-archive-paths change, which touches
`change-loop-compozy.test.mjs`, one of this change's own files, and the release numbers. The release numbers on the
branch now: `.claude-plugin/marketplace.json` marketplace 0.44.0, `devkit-openspec` 0.39.2, `devkit-panel` 0.3.1
(main's own-pr-archive-paths took 0.39.1 and 0.43.1); the CI pin in `docs/openspec-flow.md` names `v0.39.2`
(lines 733, 734 and 747), and `grep -c "v0.33.0" docs/openspec-flow.md` prints 0.
`git rev-list --count HEAD..origin/main` is 0 (no fetch was done): the branch holds everything the local `origin/main`
ref holds. `git diff origin/main --name-only` lists 19 files: the plan's files (`.claude-plugin/marketplace.json`,
`CHANGELOG.md`, `docs/openspec-flow.md`, `plugins/openspec/.claude-plugin/plugin.json`,
`plugins/openspec/hooks/change-loop-compozy.test.mjs`, `plugins/openspec/hooks/conduct-check.test.mjs`,
`plugins/panel/.claude-plugin/plugin.json`, `plugins/panel/hooks/i18n.ts`, `plugins/panel/hooks/report.test.tsx`,
`plugins/panel/hooks/steps.ts`) and nine files in this change's folder; no `.mjs` source of the loop, conduct-check
or deliver-check is among them, only tests.

Disk note: the machine's data volume was at 100% during this run (`df` showed 309 MiB to 2.4 GiB free). Two runs hit
`ENOSPC` and were repeated, and both repeats are what the rows below record: the first panel run ended `169 pass 1 fail`
(`ENOSPC: no space left on device, open '.../claude-plugin-test-6xQKOH/test/hooks/register.js'` in the test
`AC-14 flow-steps-you-are-here, AC-3 pr-and-checks: the delivery row has Implementation to Proofs done ...`), and the
first `change-loop-compozy.test.mjs` run ended `195 pass 2 fail` (`field-fixes 1 archived: a new change that reuses an
archived id ...` and `... an archive branch whose pull request merged does not list the change`, both with
`remote: error: unable to create temporary file: No space left on device`). Both failures are the environment, not the
code; the repeats ran with no `No space` line and passed in full.

## Verification

### Gates

The repository ships with a delivery train (`openspec/config.yaml`, `devkit.delivery: trunk-auto`, train
`node scripts/test-suite.mjs && python3 scripts/check.py`), whose whole-suite part is `node scripts/test-suite.mjs`.
The verifier did NOT run the whole suite at this `HEAD`, and did not run the long single files
`release-tags.test.mjs`, `delivery-models.test.mjs` or `guard.test.mjs`: their gate rows read `stood for by the
delivery train`. The last full pass of the whole suite was on `0816112`, run by the conducting session: `suite: 38
files, 2767 tests, 2766 pass, 0 fail, 696.2s, concurrency 14` (log `/private/tmp/claude-501/gate34-rml.log`), with the
per-file lines `pass 59.0s plugins/openspec/hooks/guard.test.mjs`, `pass 145.9s plugins/openspec/hooks/release-tags.test.mjs`
and `pass 577.2s plugins/openspec/hooks/delivery-models.test.mjs`. That run predates the merges of `origin/main`, so it
does not prove this `HEAD`; the train runs the whole suite on the merge result. The cheap parts and the filtered tests
below were run by the verifier at this `HEAD` with
`TMPDIR=/private/tmp/devkit-release-merge-leftovers GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`.

| Gate | Command | Result |
| --- | --- | --- |
| 1.2 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: exit 0, `170 pass`, `0 fail`, `Ran 170 tests across 2 files. [88.07s]` (app binary 2.1.330, `plugin test --help` printed `Run a mod's tests`; run at HEAD; the first run failed one test with `ENOSPC`, see the disk note, and this is the repeat) |
| 2.3 | `mkdir -p /private/tmp/devkit-rml-p2` | pass: scaffolding of the gate; the folder is only the TMPDIR of the next part |
| 2.3 | `env TMPDIR=/private/tmp/devkit-rml-p2 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/release-tags.test.mjs` | pass: stood for by the delivery train (not run by the verifier at this HEAD; last full pass of the whole suite on `0816112`, `pass 145.9s release-tags.test.mjs` and `pass 577.2s delivery-models.test.mjs`, 0 fail). The two new `under two-prs` tests were run at HEAD by the verifier, 2 pass 0 fail (see AC-3) |
| 2.3 | `rmdir /private/tmp/devkit-rml-p2` | pass: scaffolding of the gate; not run by the verifier (its own scratch folder `/private/tmp/devkit-release-merge-leftovers` was used and is left in place) |
| 3.4 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: exit 0, 170 pass 0 fail (same run as gate 1.2, at HEAD) |
| 3.4 | `mkdir -p /private/tmp/devkit-rml-p3` | pass: scaffolding of the gate |
| 3.4 | `env TMPDIR=/private/tmp/devkit-rml-p3 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: stood for by the delivery train (not run by the verifier at this HEAD; last full pass of the whole suite on `0816112`, `pass 59.0s plugins/openspec/hooks/guard.test.mjs`, 2767 tests, 2766 pass, 0 fail, 696.2s) |
| 3.4 | `rmdir /private/tmp/devkit-rml-p3` | pass: scaffolding of the gate |
| 3.4 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` (run at HEAD) |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output (run at HEAD) |
| 3.4 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` | pass: exit 0, `Validation passed` (run at HEAD) |
| 3.4 | `openspec validate release-merge-leftovers --strict` | pass: exit 0, `Change 'release-merge-leftovers' is valid` (run at HEAD) |

Filtered runs at HEAD, beyond the gate parts:

- `node scripts/test-suite.mjs --test-name-pattern="under two-prs" plugins/openspec/hooks/conduct-check.test.mjs`: exit 0,
  `suite: 1 files, 2 tests, 2 pass, 0 fail, 6.1s, concurrency 14`.
- `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs` (the file that holds the CI-pin test
  against `docs/openspec-flow.md` and the plugin versions, and which main's own-pr-archive-paths also edited): exit 0,
  `suite: 1 files, 197 tests, 197 pass, 0 fail, 341.3s, concurrency 14`. The pin it reads is now `v0.39.2`, release
  0.44.0, `devkit-openspec` 0.39.2, panel 0.3.1. The first run of this file hit `ENOSPC` (see the disk note); this is
  the repeat.
- `grep -rn push-rebased plugins/panel`: exit 1, no output.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `openspec/specs/commit-attribution/spec.md` holds no `push-rebased` and no scenario that hands a rewritten branch to the commit agent; the dispatch scenario still names the shipping skill's rows and the devkit skill's `agent` items | Task 3.3 redone by the verifier at HEAD: `openspec/` copied to `/private/tmp/devkit-release-merge-leftovers/archive-scratch/openspec` (folder made with `mkdir -p`), `openspec archive release-merge-leftovers --yes` exit 0 (`commit-attribution: update`, `+ 1 added, ~ 1 modified, - 1 removed`, archived as `2026-11-24-release-merge-leftovers`). On the archived spec: `grep -c push-rebased` 0, `grep -c 'own rebase rewrote'` 0, `grep -c '^#### Scenario:'` 17 (18 in the repository's unarchived spec), `grep -n "A branch the loop"` finds nothing (exit 1), the added requirement `Every hand-off to the commit agent asks the session for its attribution lines` is present at line 54 with 9 scenarios, and line 26 reads `the shipping skill's rows commit, open-pr, push and open-archive-pr, and the devkit skill's agent items, are read`. The scratch copy was removed; `git status --short` was empty afterwards, so the repository's own spec was not edited. Before the archive, `grep -c push-rebased openspec/specs/commit-attribution/spec.md` printed 2 on the unarchived spec, which is what the delta removes and modifies. | pass |
| AC-2 | `steps.ts`, `i18n.ts` and `report.test.tsx` hold no `push-rebased`; the panel suite passes with the label table and the step table agreeing | `grep -rn push-rebased plugins/panel` prints nothing at HEAD (exit 1). Panel suite at HEAD: exit 0, 170 pass, 0 fail, `Ran 170 tests across 2 files. [88.07s]`, including the tests of the step and label tables (the log's last line shows `D7 view-4` passing). `git diff origin/main --stat -- plugins/panel` shows `i18n.ts` 1 line removed, `report.test.tsx` 2 lines changed, `steps.ts` 2 lines changed, and the panel `plugin.json` version line. | pass |
| AC-3 | Under the two-PR delivery model, a change PR that conflicts only in `CHANGELOG.md` and the manifests makes conduct-check answer `resolve-release-conflict` with the paths and a command ending in `--base main`; a conflict in `README.md` as well makes it answer `blocked` | Run by the verifier at HEAD: `node scripts/test-suite.mjs --test-name-pattern="under two-prs" plugins/openspec/hooks/conduct-check.test.mjs`, exit 0, `2 pass 0 fail`: `conduct: under two-prs, a change PR in conflict only in release files is resolve-release-conflict on the base branch, never the test branch (release-merge-leftovers AC-3)` and `conduct: under two-prs, a conflict that also has README.md is blocked (release-merge-leftovers AC-3)`. The tests assert (read in attempt 1): the `gh pr list` bases are `main` and `develop` (two-prs in force), step `resolve-release-conflict`, paths `.claude-plugin/marketplace.json` and `CHANGELOG.md`, `--base` followed by `main`, no `develop` in the command; and step `blocked` with state `blocked: item 5 (conflict in README.md)`. Non-vacuity (both tests fail when the fixture uses the plain `CONFIG` instead of the two-PR config) is NOT a run of the verifier, which cannot write a test file: it is the conducting session's own earlier run (phase 2 gate, recorded in `tasks.md`), where with `twoPrsConflict` on `{ config: CONFIG }` both tests failed (0 pass, 2 fail) on their first assertions and, restored to `{ config: TWO_PRS_CONFIG }`, passed 2 of 2. | pass |
| AC-4 | No behaviour changes: the release step, the override and the delivery checker answer every input as before, and the other suites keep their results | At HEAD, run by the verifier: panel suite 170 pass 0 fail; `scripts/check.py` `all checks passed`; `gen-catalog.py --check` exit 0; `plugin validate .` `Validation passed`; `openspec validate release-merge-leftovers --strict` valid; the two `under two-prs` tests 2 pass; `change-loop-compozy.test.mjs` 197 pass 0 fail. `git diff origin/main --name-only` outside this change's folder lists only the ten plan files named above, and of them only tests (`change-loop-compozy.test.mjs`, `conduct-check.test.mjs`, `report.test.tsx`) and the panel's `steps.ts` and `i18n.ts` (one table entry removed) are code; no `.mjs` source of the loop, conduct-check or deliver-check differs from `origin/main` (`deliver-check.mjs`, changed by main since attempt 3, is main's own). The whole suite at this HEAD is not run by the verifier: it stands on the delivery train, with the last full pass on `0816112` (`suite: 38 files, 2767 tests, 2766 pass, 0 fail, 696.2s`), which predates the merges of `origin/main`. | pass |

## Outcome

verified: all four criteria have proof. Two things are not the verifier's run and are stated as such: the non-vacuity
switch of AC-3 (the conducting session's earlier run) and the whole suite with the long files `release-tags`,
`delivery-models` and `guard` at this HEAD (stood for by the delivery train; the last full pass is on `0816112`, before
the merges of `origin/main`). Two runs of the verifier (the panel suite and `change-loop-compozy.test.mjs`) failed
once on `ENOSPC` because the machine's disk was full, and passed in full on the repeat.
