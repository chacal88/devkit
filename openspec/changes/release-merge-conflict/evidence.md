<!-- devkit-stage evidence result=passed attempt=4 commit=a44892fb1b86c538053c84fc05b5fec1d7a0c748 -->
Commit: a44892fb1b86c538053c84fc05b5fec1d7a0c748

# Evidence

Change: `release-merge-conflict` · verified at a44892f, the merge of `main` (212d007) into this
branch. The only uncommitted file was this `evidence.md` under `openspec/`; nothing outside
`openspec/` was uncommitted.

Notes:

- This is attempt 4, past the stage's 3-attempt ceiling. The owner authorized the run past the
  ceiling earlier (answering "Yes, copy them" to "copy main's 3 scenarios into the plan and redo the
  evidence?"). Main has since archived four changes and released patch versions; every gate and
  criterion row below was taken again at this commit.
- Every test ran with `GITHUB_HEAD_REF=probe-branch`, `GITHUB_BASE_REF=main` and
  `--test-concurrency=1`, with a private `TMPDIR` under `/private/tmp/devkit-rmc-ev2*` (one folder
  per run: the guard suite, the conduct-check suite, the change-loop suite and the scratch-repository
  run each had their own), not the `/tmp/devkit-rmc` that `tasks.md` writes: on macOS the `/tmp`
  spelling breaks a budget test. The gate commands below are quoted as `tasks.md` writes them; only
  that folder differs. The guard, conduct-check and change-loop suites ran as background commands of
  the tool, the conduct-check and change-loop runs one after the other while the guard run was going.
- Release numbers: `main` is at devkit-openspec 0.28.2 and marketplace 0.32.3 (read from 212d007).
  This change releases devkit-openspec 0.29.0 and marketplace 0.33.0
  (`openspec/changes/release-merge-conflict/proof/renumber-0.23.0.txt` records the first move; the
  plan files keep the approved 0.22.0 and 0.26.0, see `design.md` "Plan revisions"). At this commit
  `plugins/openspec/.claude-plugin/plugin.json` reads `0.29.0`, `.claude-plugin/marketplace.json`
  `metadata.version` reads `0.33.0`, the newest `CHANGELOG.md` section is `## 0.33.0 — release
  conflicts resolved by a merge` above `## 0.32.3`, and the three pins of `docs/openspec-flow.md`
  (lines 637, 638 and 649) name `v0.29.0`.

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5, 2.5, 3.3 | `mkdir -p /tmp/devkit-rmc` | pass: exit 0 (ran as `mkdir -p /private/tmp/devkit-rmc-ev2` and one folder per extra run) |
| 1.5 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/conduct-check.test.mjs` | pass: 579 of 579 tests, 0 failed, 0 skipped, 0 cancelled, exit 0 (about 11.6 minutes) |
| 1.5, 2.5, 3.3 | `python3 scripts/check.py` | pass: all checks passed, exit 0 |
| 2.5 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/change-loop.test.mjs` | pass: 1052 of 1052 tests, 0 failed, 0 skipped, 0 cancelled, exit 0 (about 18.9 minutes) |
| 3.3 | `env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs` | pass: 2065 of 2065 tests, 0 failed, 0 skipped, 0 cancelled, exit 0 (about 34.6 minutes) |
| 3.3 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.3 | `command claude plugin validate .` | pass: Validation passed, exit 0 |
| 3.3 | `openspec validate release-merge-conflict --strict` | pass: Change 'release-merge-conflict' is valid, exit 0 |

### Acceptance criteria

The new tests are named `release-merge-conflict <n>: ...`. All 16 passed in the guard run (counted
in its log: 16 lines `✔ release-merge-conflict <n>:`, no `✖` line anywhere). Tests 1 to 7 live in
`plugins/openspec/hooks/release-merge.test.mjs`, 8 to 13 in `conduct-check.test.mjs`, 14 to 16 in
`change-loop.test.mjs`. The conduct-check run also listed tests 1 to 13 (it loads the release-merge
suite) and the change-loop run tests 1 to 16, all passing.

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | A release-only conflict gets the release-conflict step; its command merges `origin/<base>`, new HEAD has the old head and `origin/<base>` as parents, the PR head stays an ancestor | Test 1 (parents `HEAD^1` = old head, `HEAD^2` = `origin/main`, ancestor check) and tests 8 and 12 (conduct-check hands the step, then verify, review, then push) passed in the guard run at this commit | pass |
| AC-2 | The push handed after the step is a plain `git push`; no step, row, skill or doc line of the loop names a rebase or a force push; `push-rebased` is gone | Tests 8, 12, 14 (plain push command, push row to the commit agent) and 16 (flow doc and skill hold no `push-rebased`, `release-rebase.mjs`, `force-with-lease` or `--force`) passed; the two attribution tests main added, adapted in d53c62c, passed in the same run | pass |
| AC-3 | Each bumped pack carries the base's version plus the change's bump, the CHANGELOG entry sits above the base's newest, every pin names the resolved version, the catalog matches the generator | Test 1 (manifest, marketplace, changelog order, pins, catalog regenerated) passed; `python3 scripts/gen-catalog.py --check` exit 0 at this commit; base 0.28.2 plus a minor bump gives the 0.29.0 the manifest reads, and the pins read `v0.29.0` | pass |
| AC-4 | The CI-pin assertion holds no literal release number and fails when one pin differs | Test 15 (a pin changed to a different version is reported against the manifest version) passed; the docs test of the pin passed with the release at 0.29.0 with no edit of `change-loop.test.mjs` for the renumbering | pass |
| AC-5 | A conflict outside the release files stays blocked naming the paths; an unresolved merge leaves the branch, index and tree as they were | Live: `openspec/changes/release-merge-conflict/proof/live-merge-main.txt` (this branch's `release-merge.mjs --base main --json` on a real conflict in `change-loop.test.mjs`: exit 2, `resolved:false`, five paths named, HEAD unchanged, no MERGE_HEAD, tree untouched; recorded earlier, kept as the owner asked, not re-run). At this commit tests 2, 4, 5, 6 (a failed generator restores every file) and 11 (a foreign head is stopped) passed | pass |
| AC-6 | A scratch repository with a bare remote, a base that released after the fork and a branch with its own release: the command resolves by a merge, files as AC-3, a plain `git push` is accepted | Run for real, on its own: `env TMPDIR=/private/tmp/devkit-rmc-ev2r GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^release-merge-conflict" plugins/openspec/hooks/release-merge.test.mjs` gave 7 of 7 passed, 0 failed, exit 0; test 1 (about 1.8 s) builds the scratch repository with a bare remote (`git remote add origin` at line 145 of that file) and asserts the remote's `feature` ref equals the new HEAD after a plain push | pass |
| AC-7 | The flow doc and the devkit skill describe the step as a merge of the base followed by a plain push | Test 16 (required wording in `docs/openspec-flow.md`, the skill and the README row) passed; `plugins/openspec/skills/devkit/SKILL.md` line 92 hands `resolve-release-conflict` to `devkit-core:tdd-implementer`, and a search of `plugins`, `docs` and `scripts` finds `push-rebased` only in the panel's labels and tests (the retro item in `tasks.md`) and in the tests that assert its absence | pass |
| AC-8 | The roadmap gains a follow-up line for the live check | `git grep -n "release-merge-live-check (after: release-merge-conflict)" -- openspec/roadmap.md` prints one line, `openspec/roadmap.md:77`. The live check itself runs in a later change (proposal) | pass |

Spec delta: `openspec/changes/release-merge-conflict/specs/change-coordination/spec.md` holds the
scenarios, including main's three taken verbatim (599e476), and
`openspec validate release-merge-conflict --strict` accepts the change. The suites that main's
changes own (stage roles, delivery models, commit attribution) passed inside the guard run above.

## Open points

For the owner; nothing was fixed here.

- The canonical spec `openspec/specs/commit-attribution/spec.md` still has the scenario "A branch
  the loop's own rebase rewrote" (lines 29 and 30, WHEN the next action hands the step
  `push-rebased` to the commit agent), and its line 73 names the devkit skill's `push-rebased` item.
  This change removes that step and has no delta for the `commit-attribution` spec (its only delta is
  `change-coordination`), so the canonical spec keeps describing a step the loop no longer hands.
- The canonical `openspec/specs/change-coordination/spec.md` (line 214) also names `push-rebased`;
  that one is covered by this change's `change-coordination` delta.
