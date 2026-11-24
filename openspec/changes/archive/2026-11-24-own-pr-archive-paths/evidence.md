<!-- devkit-stage evidence result=passed attempt=2 commit=803e3692116296012ec21aa5ec2f31c6c1477145 -->
Commit: 803e3692116296012ec21aa5ec2f31c6c1477145

# Evidence

Change: `own-pr-archive-paths` · branch `own-pr-archive-paths` · HEAD `803e369` (merge of origin/main with the delivery train turned on: devkit-openspec 0.39.1, marketplace 0.43.1) · worktree clean when verified.

Merge note of `tasks.md` applies: `deliver-check.test.mjs` was split, so the six new tests and the reworded `isOwnPr` test live in `plugins/openspec/hooks/deliver-check-archive.test.mjs`, and the pin assertion lives in `plugins/openspec/hooks/change-loop-compozy.test.mjs`. Where a gate names `deliver-check.test.mjs` or `change-loop.test.mjs`, each gate part below ran twice: literally as written (green, but it matches only the tests that stayed in those two files) and against the split files that hold the tests (the real coverage). Every run used `TMPDIR=/var/tmp/devkit-own-pr-archive-paths`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`; the filtered runs went through `node scripts/test-suite.mjs` with the split files.

Whole suite: the last whole-suite run was green on `9374aeb` (`openspec/changes/own-pr-archive-paths/proof/suite-run.txt`: `suite: 38 files, 2923 tests, 2920 pass, 0 fail, 1046.4s, concurrency 8`, `exit 0`). At this head (`803e369`) the repository has a delivery train, so the whole suite is proven by the delivery train; it was not run here, and no row below claims a whole-suite run at this head.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 (part 1) | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="field-fixes 4" --test-name-pattern="findChangePr" plugins/openspec/hooks/deliver-check.test.mjs` | pass: literal run (with `TMPDIR=/var/tmp/devkit-own-pr-archive-paths`) exit 0, 1 test, 1 pass, 0 fail (the file holds one matching test after the split). Real coverage: `node scripts/test-suite.mjs --test-name-pattern="field-fixes 4" --test-name-pattern="findChangePr"` over `deliver-check-archive`, `deliver-check`, `delivery-train-after`, `flow-check` and `deliver-check-cli` test files: exit 0, `suite: 5 files, 39 tests, 39 pass, 0 fail` |
| 1.5 (part 2) | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.3 (part 1) | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="field-fixes 4" --test-name-pattern="findChangePr" --test-name-pattern="the pin in docs/openspec-flow.md" --test-name-pattern="AC-8 release-ready" --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs` | pass: literal run (with `TMPDIR=/var/tmp/devkit-own-pr-archive-paths`) exit 0, 2 tests, 2 pass, 0 fail. Real coverage: the same five patterns through `node scripts/test-suite.mjs --reporter=spec` over `deliver-check-archive`, `deliver-check`, `delivery-train-after`, `flow-check`, `deliver-check-cli`, `change-loop-compozy` and `change-loop` test files: exit 0, `suite: 7 files, 42 tests, 42 pass, 0 fail`; the tests `change-loop docs: the design records the answers`, `the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, …` and `AC-8 release-ready: …` each show a check mark and no line shows a cross |
| 2.3 (part 2) | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.3 (part 3) | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output |
| 2.3 (part 4) | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| suite run (workflow follow-up) | `node scripts/test-suite.mjs` | not run at this head: the delivery train proves the whole suite. Last whole-suite run, on `9374aeb`: 38 files, 2923 tests, 2920 pass, 0 fail, exit 0, log `openspec/changes/own-pr-archive-paths/proof/suite-run.txt` |

Other plan checks run now at `803e369`: `grep -c "and no file under .openspec/changes/archive/.\." docs/openspec-flow.md` printed 0 and `grep -c "and no file under its own archive folder" docs/openspec-flow.md` printed 1 (task 1.4); `grep -c "v0.38" docs/openspec-flow.md` printed 0 and `grep -c "v0.39.1" docs/openspec-flow.md` printed 3: the CI snippet's comment, its URL placeholder and the paragraph below (task 2.1). The `git diff --stat` of task 2.2 against `git merge-base origin/main HEAD` (`9dff573`) printed nothing. `git diff -U0` of `plugins/openspec/hooks/deliver-check.mjs` against that merge base shows two hunks: the `inOwnArchiveFolder` helper plus the reworded `isOwnPr` comment, and the one changed rule `files.some((f) => inOwnArchiveFolder(id, f))`; `main`'s `train/<n>` rule is kept ahead of it. `plugins/openspec/.claude-plugin/plugin.json` and the devkit-openspec entry of `.claude-plugin/marketplace.json` hold 0.39.1, the marketplace `version` holds 0.43.1, and `CHANGELOG.md` opens with `## 0.43.1 — a change's own pull request may edit another change's archive`. The pin test in `change-loop-compozy.test.mjs` asserts `/v0\.39\.1/` with the message `own-pr-archive-paths: 0.39.1`.

### Red run (task 1.1)

`openspec/changes/own-pr-archive-paths/proof/red-1.txt` (88 lines, saved as printed before the fix, on the then-unsplit `deliver-check.test.mjs`; not re-run, the fix is not revertable here) reads, as text:

- `✔ field-fixes 4 own archive 1` (pins today's answer, green as the plan says)
- `✖ field-fixes 4 own archive 2` (`false !== true`, line 4923)
- `✖ field-fixes 4 own archive 3` (`false !== true`, line 4929)
- `✔ field-fixes 4 own archive 4` (pins today's answer, green as the plan says)
- `✖ field-fixes 4 own archive 5` (`openspec/changes/archive/README.md`, `false !== true`)
- `✖ field-fixes 4 own archive 6` (`{"none":true}`, `undefined !== 11`: `findChangePr` found nothing)
- summary `ℹ tests 6`, `ℹ pass 2`, `ℹ fail 4`

So tests 2, 3, 5 and 6 failed for the stated reasons (no typo or missing fixture) and 1 and 4 passed, as the last column of H-3 says.

Green run after the fix, at this head, on the split file: `node scripts/test-suite.mjs --reporter=spec --test-name-pattern="field-fixes 4 own archive" plugins/openspec/hooks/deliver-check-archive.test.mjs` exit 0, check marks on `field-fixes 4 own archive 1` to `6`, `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`, `suite: 1 files, 6 tests, 6 pass, 0 fail`.

### Acceptance criteria

| Id | Criterion | What was done and observed, and where the proof is | Result |
|---|---|---|---|
| AC-1 | `own-archive-refused`: `isOwnPr('foo', …, [tasks.md, archive/2026-11-09-foo/retro.md])` is `false` | Test `field-fixes 4 own archive 1` (also its `specs/cap/spec.md` variant) in `deliver-check-archive.test.mjs`: green in the red run (it pins today's answer) and green at `803e369` in the 6-test run; the reworded `field-fixes 4 delivered: isOwnPr needs a file of the change folder, no file of its own archive folder and no archive head` stays green inside the 39-test gate run | pass |
| AC-2 | `other-archive-allowed`: another change's archived `retro.md` does not refuse `foo`'s PR | Test `own archive 2`: red before (`false !== true`), green at this head, covering `2026-11-09-bar` with head `ship/foo` and head `calm-badger` plus `2026-11-01-baz/design.md` | pass |
| AC-3 | `id-prefix-not-confused`: `…-foo-two/` does not refuse `foo`, `…-foo/` does not refuse `foo-two` | Test `own archive 3`: red before (`false !== true`), green at this head, including the third assertion that `foo-two` with its own `2026-11-09-foo-two/` is still refused. Test `own archive 5` adds the id-with-a-dot case (`a.b` is not read as a pattern: `2026-11-09-axb` allowed, `2026-11-09-a.b` refused), the folderless `archive/README.md`, the dated file `2026-11-09-foo` and the undated `archive/foo/retro.md`: red before, green at this head | pass |
| AC-4 | `archive-head-still-refused`: heads `chore/archive-bar` and `archive-bar` refused whatever the files | Test `own archive 4`: green before and at this head (pins the unchanged rule, which stays first in `isOwnPr`); the existing archive-head tests (`another change's archive pull request that names the change is not its own` and `… leads to no archive step`) are inside the green 39-test gate run | pass |
| AC-5 | `found-after-merge`: through `findChangePr` in `merge` mode a merged PR with `openspec/changes/<id>/tasks.md` plus another change's archived `retro.md` is found as `{ pr, via: 'list' }` | Test `own archive 6` with the file's fake `gh` (`ownRepo`): red before (`{"none":true}`, `undefined !== 11`), green at this head: PR 11 found via `list`, and a second repository whose PR 11 carries the change's own archive folder answers `{ none: true }`. The other `findChangePr` tests (`deliver-check-archive`, `delivery-train-after`) are green in the same gate run | pass |
| AC-6 | `no-regression`: every existing `field-fixes 4 delivered` test, `check.py` and `gen-catalog.py --check` stay green | At `803e369`: 39-test filtered run over the five files holding `field-fixes 4` and `findChangePr` tests, 0 fail; 42-test run with the pin tests, 0 fail; `python3 scripts/check.py` exit 0; `python3 scripts/gen-catalog.py --check` exit 0; `command claude plugin validate .` exit 0. Whole suite: not run at this head, proven by the delivery train; its last run, on `9374aeb`, was 38 files, 2923 tests, 0 fail, exit 0 (`proof/suite-run.txt`) | pass |
