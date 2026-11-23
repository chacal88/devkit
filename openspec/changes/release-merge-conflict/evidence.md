<!-- devkit-stage evidence result=passed attempt=2 commit=e14c8269edccbd311d06cfe9af31062bde06e286 -->
Commit: e14c8269edccbd311d06cfe9af31062bde06e286

# Evidence

Change: `release-merge-conflict` · verified at e14c826, the merge of `origin/main` (d1c7fa4, PR 58)
into this branch. Every test gate ran with `GITHUB_HEAD_REF=probe-branch`, `GITHUB_BASE_REF=main`,
`--test-concurrency=1` and the private `TMPDIR` `/tmp/devkit-rmc`. The guard suite ran as a
background command.

Renumbering: PR 58 (stage roles) released devkit-openspec 0.22.0 and marketplace 0.26.0 first, so
this change's release moved to devkit-openspec 0.23.0 and marketplace 0.27.0 (see
`openspec/changes/release-merge-conflict/proof/renumber-0.23.0.txt`). The plan files still name
0.22.0 and 0.26.0 as approved. At this commit `plugins/openspec/.claude-plugin/plugin.json` reads
`0.23.0`, and `git grep -c "v0.22" -- docs/openspec-flow.md` finds nothing (exit 1).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5, 2.5, 3.3 | `mkdir -p /tmp/devkit-rmc` | pass: exit 0 |
| 1.5 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/conduct-check.test.mjs` | pass: 544 of 544 tests (loads the deliver-check and release-merge suites) |
| 1.5, 2.5, 3.3 | `python3 scripts/check.py` | pass: all checks passed |
| 2.5 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/change-loop.test.mjs` | pass: 803 of 803 tests (loads the deliver-check, conduct-check and release-merge suites) |
| 3.3 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs` | pass: 1531 of 1531 tests, 0 failed, 0 skipped, 0 cancelled |
| 3.3 | `python3 scripts/gen-catalog.py --check` | pass: catalog up to date, exit 0 |
| 3.3 | `command claude plugin validate .` | pass: Validation passed |
| 3.3 | `openspec validate release-merge-conflict --strict` | pass: Change 'release-merge-conflict' is valid |

### Acceptance criteria

The new tests are named `release-merge-conflict <n>: ...`; all 16 passed in the guard run
(1 to 7 in `release-merge.test.mjs`, 8 to 13 in `conduct-check.test.mjs`, 14 to 16 in
`change-loop.test.mjs`).

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | A release-only conflict gets the release-conflict step; its command merges `origin/<base>`, new HEAD has the old head and `origin/<base>` as parents, the PR head stays an ancestor | Tests 1 (parents `HEAD^1` = old head, `HEAD^2` = `origin/main`, ancestor check) and 8, 12 (conduct-check hands the step, verify, review, then push) | pass |
| AC-2 | The push handed after the step is a plain `git push`; no step, row, skill or doc line of the loop names a rebase or a force push; `push-rebased` is gone | Tests 8, 12, 14 (plain push command, push row to the commit agent) and 16 (flow doc and skill hold no `push-rebased`, `release-rebase.mjs`, `force-with-lease`, `rebase` or `--force`) | pass |
| AC-3 | Each bumped pack carries the base's version plus the change's bump, the CHANGELOG entry sits above the base's newest, every pin names the resolved version, the catalog matches the generator | Test 1 (plugin.json 0.11.1, marketplace 0.11.1 and 0.7.1, changelog order, pins all `v0.11.1`, catalog regenerated); `python3 scripts/gen-catalog.py --check` pass at this commit | pass |
| AC-4 | The CI-pin assertion holds no literal release number and fails when one pin differs | Test 15 (a pin changed to v9.9.9 is reported against the manifest version) | pass |
| AC-5 | A conflict outside the release files stays blocked naming the paths; an unresolved merge leaves the branch, index and tree as they were | Live: `openspec/changes/release-merge-conflict/proof/live-merge-main.txt` (this branch's `release-merge.mjs --base main --json` on a real conflict in `change-loop.test.mjs`: exit 2, `resolved:false`, five paths named, HEAD unchanged, no MERGE_HEAD, tree untouched). Tests 2, 4, 5, 6 and 11 (abort restores files, stops with exit 3, foreign head stopped) | pass |
| AC-6 | A scratch repository with a bare remote, a base that released after the fork and a branch with its own release: the command resolves by a merge, files as AC-3, a plain `git push` is accepted | Test 1 run for real on its own with `--test-name-pattern="release-merge-conflict 1:"` on `release-merge.test.mjs`: 1 of 1 passed at e14c826; it asserts the bare remote's `feature` ref equals the new HEAD after `git push -q origin feature` | pass |
| AC-7 | The flow doc and the devkit skill describe the step as a merge of the base followed by a plain push | Test 16 (required wording present in `docs/openspec-flow.md`, the skill and the README row) | pass |
| AC-8 | The roadmap gains a follow-up line for the live check | `openspec/roadmap.md` line 76 (one match at this commit): `release-merge-live-check (after: release-merge-conflict)`, one match. The live check itself runs in a later change (proposal) | pass |
