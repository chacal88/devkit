<!-- devkit-stage evidence result=passed attempt=4 commit=f6367337e6f5b506de90f1139ecba0e63d61059b -->
Commit: f6367337e6f5b506de90f1139ecba0e63d61059b
# Evidence

Verified at `f636733` (the branch head) with a clean working tree. This is attempt 4: it replaces the attempt 3 file, written at
`902d7f8` (a merge of `origin/main` at `946e3e8`, the merged pull request of train 1, into the branch), whose commit is now stale.
Since `902d7f8` the branch gained two commits, and they changed documentation only. `git diff 902d7f8 HEAD --stat` lists three
files: `docs/openspec-flow.md` (the `state` paragraph gained a parenthesis saying that `next`, `wait` and `session-next` keep exit 3
for a change only another checkout holds), `docs/adr/0017-a-change-state-is-derived-in-one-place.md` (a dated Note to the same
effect) and the attempt 3 `evidence.md`. `git diff 902d7f8 HEAD --stat -- plugins scripts` prints nothing (exit 0): no product file
and no test file changed, so `change-loop.mjs`, `roadmap-loop.mjs`, `change-loop-fixtures.mjs`, `change-loop.test.mjs`,
`roadmap-loop.test.mjs`, `change-loop-remote-state.test.mjs`, `roadmap-loop-upfront.test.mjs`, `change-loop-compozy.test.mjs` and
`deliver-check.mjs` are byte-identical to `902d7f8`. This change's release is devkit-openspec 0.39.2 and marketplace 0.43.2, as at
`902d7f8` (the release files did not change).

## What this verification ran and what it did not

The delivery train is on for this repository: `origin/main`'s `openspec/config.yaml` holds
`devkit.delivery.train: "node scripts/test-suite.mjs && python3 scripts/check.py"` (read with
`git show origin/main:openspec/config.yaml` for attempt 3; not fetched again here). A gate part equal to a part of that command is
not run here: the train runs the whole suite and `scripts/check.py` once, on the joined heads, and records them. Those rows read
`train:`. The whole suite was NOT run at `f636733`, by the caller's instruction; the train proves it, and nothing in this file
claims it. History, not this commit's proof: at `0602907` the whole suite ran in two steps (38 files, 2956 tests, 2952 pass, 4
fail, all four for imports missing in this change's two moved test files; then test-only commit `a273745` fixed the imports and
those two files reran whole, 340 of 340 pass).

The two whole-file gate runs of tasks 1.4 and 2.3 (`change-loop.test.mjs`, 160 of 160, and `roadmap-loop.test.mjs`, 110 of 110,
both at `902d7f8`) were NOT rerun. Reason: the diff above shows no file under `plugins/` or `scripts/` changed since `902d7f8`, so
the files they run, the code they test and its dependencies (`deliver-check.mjs` included) are the same bytes, and their results
stand. Those rows say so.

Commands run at `f636733` (each its own command; exit codes decided; no `ENOSPC` in any output, `df` showed 5.1 GiB free on the
data volume before the runs):

1. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="unlocated|change-state ADR 0017" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0,
   `suite: 3 files, 41 tests, 41 pass, 0 fail, 42.9s, concurrency 2`. Per file: `change-loop-remote-state.test.mjs` 30 tests,
   30 pass (19 tests named `unlocated 1:`, 1 named `unlocated 3:`, the test `change-state ADR 0017: the documents follow`, and
   their subtests); `roadmap-loop-upfront.test.mjs` 10 tests, 10 pass (the 8 `unlocated 2:` tests and their subtests);
   `change-loop-compozy.test.mjs` 1 test (the file entry; it holds no test that matches the pattern), pass. The count is 41, one
   more than the 40 of attempt 3, because the pattern now also matches `change-state ADR 0017: the documents follow`, which passes.
2. `python3 scripts/gen-catalog.py --check`: exit 0, no output.
3. `command claude plugin validate .`: `Validation passed`, exit 0.
4. `openspec validate state-skips-unlocated --strict`: `Change 'state-skips-unlocated' is valid`, exit 0.
5. Release pin (task 3.3's check, not a gate part): `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-merge pin: the real" plugins/openspec/hooks/release-merge.test.mjs`: exit 0, 1 test, 1 pass, 0 fail.
6. CI-pin assertion: `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="change-loop docs" plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0, `suite: 1 files, 1 tests, 1 pass, 0 fail, 0.1s`. This is `change-loop docs: the design records the answers`, which asserts `v0.39.2` is in the flow doc and `v0.39.1` and `v0.39.0` are not.

The attempt 3 incident stays a warning for the train, not a defect: while the volume under `/private/tmp` was full, running both
whole files at once failed 19 and 2 tests on `ENOSPC` (`mkdtemp`, `git init`, `git add`, `git commit` in the fixtures), and each
passed alone once there was space. It did not occur in this attempt's runs.

One difference from `tasks.md`: runs 1, 5 and 6 use `TMPDIR=/private/tmp/devkit-state-skips-unlocated` where tasks 1.4 and 2.3 write `TMPDIR=/private/tmp` (a private folder per run, as the suite expects); the other two variables are as written.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs` | pass: 160 of 160 tests pass, exit 0, run whole at `902d7f8` (264.6s, rerun alone after an `ENOSPC` incident); not rerun at `f636733` because `git diff 902d7f8 HEAD --stat -- plugins scripts` is empty, so the test file, `change-loop.mjs` and `deliver-check.mjs` are unchanged and the result stands |
| 1.4 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command `node scripts/test-suite.mjs && python3 scripts/check.py`; not run in this verification) |
| 2.3 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 110 of 110 tests pass, exit 0, run whole at `902d7f8` (248.1s, rerun alone after an `ENOSPC` incident); not rerun at `f636733` because `git diff 902d7f8 HEAD --stat -- plugins scripts` is empty, so the test file, `roadmap-loop.mjs` and `deliver-check.mjs` are unchanged and the result stands |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | train: proven by the train record (the train command's part `node scripts/test-suite.mjs` with the gate's env prefix; the whole suite was not run at `f636733`; the targeted run 1 above passes 41 of 41 and the two whole files stand from `902d7f8`) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output, run at `f636733` (run 2) |
| 3.5 | `command claude plugin validate .` | pass: `Validation passed`, exit 0, run at `f636733` (run 3) |
| 3.5 | `openspec validate state-skips-unlocated --strict` | pass: `Change 'state-skips-unlocated' is valid`, exit 0, run at `f636733` (run 4) |

### Acceptance criteria

The real-run proof is `openspec/changes/state-skips-unlocated/proof/real-run.txt` (a scratch repository with changes `aa` and
`xx`; the plan names them `a` and `x`, but `open` refuses one-letter ids). `xx`'s worktree branch was renamed to `side`, so only
`xx` is unlocated; `aa` stays in its own worktree. Before is the hooks of `origin/main`, after is this change's hooks. That run was
made before the merges of `origin/main` that came after `0602907`; `git diff --stat 0602907 HEAD` on `change-loop.mjs` and
`roadmap-loop.mjs` was empty at `902d7f8`, and no product file changed between `902d7f8` and `f636733` (diff above), so the code
that printed those lines is the code at this head, and the named tests below, run at `f636733`, pin the printed lines again. The
red runs `proof/red-1.txt` (28 tests, 18 fail, 10 pass), `proof/red-2.txt` (10 tests, 8 fail, 2 pass) and `proof/red-3.txt` (1
test, 1 fail) show the named tests failing before the code and the docs existed. Test names below are the ones of run 1, all
passing at `f636733`.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `state` lists an unlocated change as blocked with a reason, in `en` and `pt-BR`, and still lists every other change | Real run, from the main checkout (scratch root): before, `state --lang en` and `--lang pt-BR` both exit 3 with `no change named xx, active or archived`; after, both exit 0 and list two entries: `aa` unchanged (`waiting-for-owner`, reason `grill`, stage `requirements`, root and branch `aa`) and `xx` with `state: blocked`, `reason.code: wrong-branch`, text `its folder is on a branch with another name` (en) and `a pasta dela está num branch com outro nome` (pt-BR), stage fields null, `root` the worktree that holds the folder, `branch: side`, `stateIcon` the blocked icon. Tests (run 1, at `f636733`): `unlocated 1: state lists an unplaced change blocked and every other change as before`, `unlocated 1: state in Brazilian Portuguese gives the same code and the pt-BR phrase`, `unlocated 1: unplacedAction gives null for a change the loop can place` / `... for an id no checkout holds` / `... gives the blocked stand-in with the holder's root and branch`, and `unlocated 1: state follows the run file first for an unplaced change`. Red: `proof/red-1.txt` shows `unlocated 1: unplacedAction gives null for a change the loop can place` failing before the code | pass |
| AC-2 | `state --change x` gives that one blocked entry, the same as the list | Real run, `state --change xx --lang en` from the main checkout: before exit 3; after exit 0 with a `changes` array of one entry, field for field the `xx` entry of the list (`wrong-branch`, same text, root, branch `side`). Test `unlocated 1: state --change x prints the list's entry` passes at `f636733` (run 1) | pass |
| AC-3 | The `/devkit status` board shows it blocked with the same words, exits 0, other lines as before, board and `state` agree | Real run, `roadmap-loop.mjs status`: before exit 3 in `en` and `pt-BR`; after exit 0, `en`: `Waiting for you` / `aa   your answers about its request`, then `Blocked` / `xx   its folder is on a branch with another name`; `pt-BR`: `Esperando você` / `aa ...`, `Travadas` / `xx   a pasta dela está num branch com outro nome`. The words of `xx` equal `state`'s `reason.text` in each language. Tests (run 1, at `f636733`, 8 of 8 `unlocated 2:` pass): `the board lists an unplaced roadmap line under Blocked and the others as before`, `the board in Brazilian Portuguese`, `the board and the state command agree on every open roadmap change, and on x's words`, `a roadmap decision says once that x stopped and hands a's stage`, `the roadmap stop lock refuses for a's ready stage with x unplaced`, `the roadmap stop lock lets the stop through when x is the only open line`, `a placed roadmap line reads as before`, `the board follows the run file first for an unplaced line, as the state command does`. Red: `proof/red-2.txt` shows 8 of the 10 tests failing before the code | pass |
| AC-4 | An unknown id keeps exit 3 `no change named nope` | Real run, `state --change nope --lang en`: before and after both exit 3, `{"version":1,"error":"no change named nope","reply":"I could not read that request. ..."}`. Tests (run 1, at `f636733`): `unlocated 1: state --change nope in the unplaced setup still exits 3` and `unlocated 1: state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` (the archive is checked before a change is called unplaced) pass | pass |
| AC-5 | `locate` prefers the caller's worktree; the archive worktree and the worktree on branch `x` still win; main checkout and the change's own worktree unchanged | Real run, `next --change xx --lang en` from `xx`'s worktree on branch `side`: before exit 3 `no change named xx, active or archived`; after exit 0 with `kind: grill`, `stage: requirements`, `root` that worktree, `branch: side`. Tests (run 1, at `f636733`): `unlocated 1: locate from a worktree on another branch that holds the active folder reads it there`, `locate: the archive worktree wins over the caller's`, `locate: the worktree on branch x wins over the caller's`, `locate from the main checkout is unchanged`, `locate from the change's own worktree is unchanged`, `locate: a caller holding only an archived folder reads the main checkout`, `locate: a main checkout holding a folder of x keeps it`, `locate: a caller with no folder of x reads the main checkout`, `next --change x from the worktree on another branch gives x's action`, `the change run's stop lock in that worktree refuses for x's ready stage`. Red: `proof/red-1.txt` shows the first of these failing before the code. Note for the reader: the implemented order reads the caller's checkout only when the main checkout holds no folder of the change (docs and spec state it so, and `locate: a main checkout holding a folder of x keeps it` pins it); `requirements.md` words it without that condition. Also, as the new documentation note states, `next`, `wait` and `session-next` keep exit 3 for a change only another checkout holds when the caller is not in that checkout | pass |
| AC-6 | No other behaviour changes; existing tests pass as they are; a placed change prints as before | Gate rows 1.4 and 2.3: `change-loop.test.mjs` 160 of 160 and `roadmap-loop.test.mjs` 110 of 110 pass whole at `902d7f8`, with no existing test edited; they were not rerun at `f636733` because `git diff 902d7f8 HEAD --stat -- plugins scripts` is empty (only two documentation files changed), so their code and tests are the same bytes. The real run lists `aa` (a change the loop can place) with the same fields as a plain change; tests `unlocated 2: a placed roadmap line reads as before` and `unlocated 1: unplacedAction gives null for a change the loop can place` pass at `f636733` (run 1). Limit: `guard.test.mjs` and every other suite file were NOT run at `f636733`; the train gives that whole-suite run. History only, at `0602907`/`a273745`: 36 of 38 files passed whole (including `guard.test.mjs`), the other two passed after the import fix (340 of 340) | pass |
| AC-7 | `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order | Test `unlocated 3: the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` passes at `f636733` (run 1, after the paragraph gained the parenthesis on `next`, `wait` and `session-next`); `proof/red-3.txt` shows it failing before the doc edit. `change-state ADR 0017: the documents follow` also passes (run 1), so ADR 0017's dated Note and the docs agree. The `change-state` delta (`specs/change-state/spec.md`) holds the scenarios for `wrong-branch`, the archive check and the `locate` order, and the `roadmap-coordination` delta the board scenario; `openspec validate state-skips-unlocated --strict` passes (run 4). The release pin test `release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines` passes (run 5) and the CI-pin assertion `change-loop docs: the design records the answers` passes (run 6), so the CI pin lines in the doc still follow devkit-openspec 0.39.2 after the doc edit | pass |

What the train will still prove, and this verification did not: the whole suite and `scripts/check.py` on the joined heads, as the
train records them.

Defects found: none.
