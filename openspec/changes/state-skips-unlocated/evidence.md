<!-- devkit-stage evidence result=passed attempt=5 commit=af2edf9892a6220ceccb47a4aad66940fa0025e3 -->
Commit: af2edf9892a6220ceccb47a4aad66940fa0025e3
# Evidence

Verified at `af2edf9` (the branch head, a merge of `origin/main` after the merged pull request 121, train 4) with a clean working
tree. This is attempt 5: it replaces the attempt 4 file, written at `f636733`, whose commit is now stale. Since `f636733` the
branch took in `origin/main` (trains 2, 3 and 4), and this change's own files did not move: `git diff f636733 HEAD --stat --
plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.mjs
plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs
plugins/openspec/hooks/change-loop-fixtures.mjs plugins/openspec/hooks/change-loop.test.mjs
plugins/openspec/hooks/roadmap-loop.test.mjs` prints nothing (exit 0), so those seven files are byte-identical to `f636733`.

What `git diff f636733 HEAD --stat -- plugins scripts` lists (14 files, 437 insertions, 64 deletions), all of it `origin/main`'s
own work, none of it this change's: `plugins/openspec/.claude-plugin/plugin.json` (the version, now 0.40.1),
`plugins/openspec/hooks/deliver-check.mjs` (+64, the archive check of pull request 107) with `deliver-check-fixtures.mjs`,
`deliver-check-archive.test.mjs` and `conduct-check.test.mjs`, `plugins/openspec/hooks/release-merge.mjs` and
`release-merge.test.mjs`, `plugins/openspec/hooks/change-loop-compozy.test.mjs` (the CI-pin tests now read the version from
`plugins/openspec/.claude-plugin/plugin.json`, no literal), two files under `plugins/openspec/hooks/fixtures/c561553/`, and
under `plugins/panel/` the manifest, `hooks/i18n.ts`, `hooks/report.test.tsx` and `hooks/steps.ts`. The release files that moved:
`.claude-plugin/marketplace.json` (0.45.1), `CHANGELOG.md` (the `0.45.1` entry for this change), `docs/openspec-flow.md` (the
three CI pins now `v0.40.1`) and `CONTRIBUTING.md`. This change's release is devkit-openspec 0.40.1 and marketplace 0.45.1.
The files under `openspec/changes/state-skips-unlocated/` that moved since `f636733` are this `evidence.md`, `review.md` and the
four reviewer files (the review round).

## What this verification ran and what it did not

The delivery train is on for this repository: `devkit.delivery.train` is `node scripts/test-suite.mjs && python3 scripts/check.py`
(as the caller stated; the same value attempt 4 read from `origin/main`'s `openspec/config.yaml`, which this branch now carries
after the merge). A gate part equal to a part of that command is not run here: the train runs the whole suite and
`scripts/check.py` once, on the joined heads, and records them. Those rows read `train:`. The whole suite was NOT run at
`af2edf9`, by the caller's instruction; nothing in this file claims it. History, not this commit's proof: at `0602907` the whole
suite ran in two steps (38 files, 2956 tests, 2952 pass, 4 fail, all four for imports missing in this change's two moved test
files; then test-only commit `a273745` fixed the imports and those two files reran whole, 340 of 340 pass).

The two whole-file gate runs of tasks 1.4 and 2.3 WERE rerun at `af2edf9`, each alone. The seven files of this change are
unchanged (diff above), which alone would let the earlier results stand; but both loops import `deliver-check.mjs`
(`change-loop.mjs` line 44, `roadmap-loop.mjs` line 47), and the merge changed that file (the archive check), so the earlier
runs no longer covered the code the loops load. Both passed.

Commands run at `af2edf9` (each its own command; exit codes decided; no `ENOSPC` in any output; `df` showed 77 GiB free on the
data volume before the runs):

1. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="unlocated|change-state ADR 0017" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0,
   `suite: 3 files, 41 tests, 41 pass, 0 fail, 59.7s, concurrency 2`. Per file: `change-loop-remote-state.test.mjs` 30 tests,
   30 pass (19 tests named `unlocated 1:`, 1 named `unlocated 3:`, the test `change-state ADR 0017: the documents follow`, and
   their subtests); `roadmap-loop-upfront.test.mjs` 10 tests, 10 pass (the 8 `unlocated 2:` tests and their subtests);
   `change-loop-compozy.test.mjs` 1 test (the file entry; it holds no test that matches the pattern), pass. The count is the same
   41 as attempt 4.
2. `python3 scripts/gen-catalog.py --check`: exit 0, no output.
3. `command claude plugin validate .`: `Validation passed`, exit 0.
4. `openspec validate state-skips-unlocated --strict`: `Change 'state-skips-unlocated' is valid`, exit 0.
5. Release pin (task 3.3's check, not a gate part): `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-merge pin: the real" plugins/openspec/hooks/release-merge.test.mjs`: exit 0, 1 test, 1 pass, 0 fail (`release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines`).
6. CI-pin tests of `change-loop-compozy.test.mjs`, found by grepping the file for `plugin.json` (the two tests that read the version from `plugins/openspec/.claude-plugin/plugin.json`, at lines 306 and 362): `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="change-loop docs|release-merge-conflict 15" plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0, `suite: 1 files, 2 tests, 2 pass, 0 fail, 0.3s`. They are `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` and `change-loop docs: the design records the answers`; the second asserts that every CI pin in `docs/openspec-flow.md` names the manifest's version (0.40.1) and that the flow doc holds at least three pins. No literal version is asserted any more.
7. Gate 1.4, whole file: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs`: exit 0, 160 tests, 160 pass, 0 fail, duration 818.4s.
8. Gate 2.3, whole file, alone, after run 7 ended: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs`: exit 0, 110 tests, 110 pass, 0 fail, duration 450.7s.

The attempt 3 incident stays a warning for the train, not a defect: while the volume under `/private/tmp` was full, running both
whole files at once failed 19 and 2 tests on `ENOSPC` (`mkdtemp`, `git init`, `git add`, `git commit` in the fixtures), and each
passed alone once there was space. It did not occur in this attempt's runs (the whole files ran one after the other).

One difference from `tasks.md`: runs 1, 5 and 6 use `TMPDIR=/private/tmp/devkit-state-skips-unlocated` where tasks 1.4 and 2.3 write `TMPDIR=/private/tmp` (a private folder per run, as the suite expects); the other two variables are as written. Runs 7 and 8 use the gates' own `TMPDIR=/private/tmp`.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs` | pass: 160 of 160 tests pass, exit 0, run whole and alone at `af2edf9` (818.4s, run 7) |
| 1.4 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command `node scripts/test-suite.mjs && python3 scripts/check.py`; not run in this verification) |
| 2.3 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 110 of 110 tests pass, exit 0, run whole and alone at `af2edf9` (450.7s, run 8) |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | train: proven by the train record (the train command's part `node scripts/test-suite.mjs` with the gate's env prefix; the whole suite was not run at `af2edf9`; the targeted run 1 above passes 41 of 41 and the two whole files pass at `af2edf9`, runs 7 and 8) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output, run at `af2edf9` (run 2) |
| 3.5 | `command claude plugin validate .` | pass: `Validation passed`, exit 0, run at `af2edf9` (run 3) |
| 3.5 | `openspec validate state-skips-unlocated --strict` | pass: `Change 'state-skips-unlocated' is valid`, exit 0, run at `af2edf9` (run 4) |

### Acceptance criteria

The real-run proof is `openspec/changes/state-skips-unlocated/proof/real-run.txt` (a scratch repository with changes `aa` and
`xx`; the plan names them `a` and `x`, but `open` refuses one-letter ids). `xx`'s worktree branch was renamed to `side`, so only
`xx` is unlocated; `aa` stays in its own worktree. Before is the hooks of `origin/main`, after is this change's hooks. That run was
made at `0602907`, before the merges of `origin/main` that came after. The code that printed those lines is the code at this head:
`change-loop.mjs`, `roadmap-loop.mjs` and their fixtures and tests are byte-identical to `f636733` (diff above), and
`git diff --stat 0602907 HEAD` on `change-loop.mjs` and `roadmap-loop.mjs` was empty at `902d7f8` and has stayed so. The one
change that reaches them is `deliver-check.mjs` (main's archive check), which both loops import; the whole-file runs 7 and 8 and
the named tests below, run at `af2edf9`, pin the printed lines again on that code. The red runs `proof/red-1.txt` (28 tests, 18
fail, 10 pass), `proof/red-2.txt` (10 tests, 8 fail, 2 pass) and `proof/red-3.txt` (1 test, 1 fail) show the named tests failing
before the code and the docs existed. Test names below are the ones of run 1, all passing at `af2edf9`.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `state` lists an unlocated change as blocked with a reason, in `en` and `pt-BR`, and still lists every other change | Real run, from the main checkout (scratch root): before, `state --lang en` and `--lang pt-BR` both exit 3 with `no change named xx, active or archived`; after, both exit 0 and list two entries: `aa` unchanged (`waiting-for-owner`, reason `grill`, stage `requirements`, root and branch `aa`) and `xx` with `state: blocked`, `reason.code: wrong-branch`, text `its folder is on a branch with another name` (en) and `a pasta dela está num branch com outro nome` (pt-BR), stage fields null, `root` the worktree that holds the folder, `branch: side`, `stateIcon` the blocked icon. Tests (run 1, at `af2edf9`): `unlocated 1: state lists an unplaced change blocked and every other change as before`, `unlocated 1: state in Brazilian Portuguese gives the same code and the pt-BR phrase`, `unlocated 1: unplacedAction gives null for a change the loop can place` / `... for an id no checkout holds` / `... gives the blocked stand-in with the holder's root and branch`, and `unlocated 1: state follows the run file first for an unplaced change`. Red: `proof/red-1.txt` shows `unlocated 1: unplacedAction gives null for a change the loop can place` failing before the code | pass |
| AC-2 | `state --change x` gives that one blocked entry, the same as the list | Real run, `state --change xx --lang en` from the main checkout: before exit 3; after exit 0 with a `changes` array of one entry, field for field the `xx` entry of the list (`wrong-branch`, same text, root, branch `side`). Test `unlocated 1: state --change x prints the list's entry` passes at `af2edf9` (run 1) | pass |
| AC-3 | The `/devkit status` board shows it blocked with the same words, exits 0, other lines as before, board and `state` agree | Real run, `roadmap-loop.mjs status`: before exit 3 in `en` and `pt-BR`; after exit 0, `en`: `Waiting for you` / `aa   your answers about its request`, then `Blocked` / `xx   its folder is on a branch with another name`; `pt-BR`: `Esperando você` / `aa ...`, `Travadas` / `xx   a pasta dela está num branch com outro nome`. The words of `xx` equal `state`'s `reason.text` in each language. Tests (run 1, at `af2edf9`, 8 of 8 `unlocated 2:` pass): `the board lists an unplaced roadmap line under Blocked and the others as before`, `the board in Brazilian Portuguese`, `the board and the state command agree on every open roadmap change, and on x's words`, `a roadmap decision says once that x stopped and hands a's stage`, `the roadmap stop lock refuses for a's ready stage with x unplaced`, `the roadmap stop lock lets the stop through when x is the only open line`, `a placed roadmap line reads as before`, `the board follows the run file first for an unplaced line, as the state command does`. Red: `proof/red-2.txt` shows 8 of the 10 tests failing before the code | pass |
| AC-4 | An unknown id keeps exit 3 `no change named nope` | Real run, `state --change nope --lang en`: before and after both exit 3, `{"version":1,"error":"no change named nope","reply":"I could not read that request. ..."}`. Tests (run 1, at `af2edf9`): `unlocated 1: state --change nope in the unplaced setup still exits 3` and `unlocated 1: state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` (the archive is checked before a change is called unplaced) pass | pass |
| AC-5 | `locate` prefers the caller's worktree; the archive worktree and the worktree on branch `x` still win; main checkout and the change's own worktree unchanged | Real run, `next --change xx --lang en` from `xx`'s worktree on branch `side`: before exit 3 `no change named xx, active or archived`; after exit 0 with `kind: grill`, `stage: requirements`, `root` that worktree, `branch: side`. Tests (run 1, at `af2edf9`): `unlocated 1: locate from a worktree on another branch that holds the active folder reads it there`, `locate: the archive worktree wins over the caller's`, `locate: the worktree on branch x wins over the caller's`, `locate from the main checkout is unchanged`, `locate from the change's own worktree is unchanged`, `locate: a caller holding only an archived folder reads the main checkout`, `locate: a main checkout holding a folder of x keeps it`, `locate: a caller with no folder of x reads the main checkout`, `next --change x from the worktree on another branch gives x's action`, `the change run's stop lock in that worktree refuses for x's ready stage`. Red: `proof/red-1.txt` shows the first of these failing before the code. Note for the reader: the implemented order reads the caller's checkout only when the main checkout holds no folder of the change (docs and spec state it so, and `locate: a main checkout holding a folder of x keeps it` pins it); `requirements.md` words it without that condition. Also, as the new documentation note states, `next`, `wait` and `session-next` keep exit 3 for a change only another checkout holds when the caller is not in that checkout | pass |
| AC-6 | No other behaviour changes; existing tests pass as they are; a placed change prints as before | Gate rows 1.4 and 2.3: `change-loop.test.mjs` 160 of 160 (run 7, 818.4s) and `roadmap-loop.test.mjs` 110 of 110 (run 8, 450.7s) pass whole and alone at `af2edf9`, exit 0 each, with no existing test edited by this change (`git diff f636733 HEAD --stat` on both test files is empty); the reruns cover the one input that changed, `deliver-check.mjs`. The real run lists `aa` (a change the loop can place) with the same fields as a plain change; tests `unlocated 2: a placed roadmap line reads as before` and `unlocated 1: unplacedAction gives null for a change the loop can place` pass at `af2edf9` (run 1). Limit: `guard.test.mjs`, `deliver-check-archive.test.mjs` and every other suite file were NOT run at `af2edf9`; the train gives that whole-suite run. History only, at `0602907`/`a273745`: 36 of 38 files passed whole (including `guard.test.mjs`), the other two passed after the import fix (340 of 340) | pass |
| AC-7 | `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order | Test `unlocated 3: the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` passes at `af2edf9` (run 1); `proof/red-3.txt` shows it failing before the doc edit. `change-state ADR 0017: the documents follow` also passes (run 1), so ADR 0017's dated Note and the docs agree. The `change-state` delta (`specs/change-state/spec.md`) holds the scenarios for `wrong-branch`, the archive check and the `locate` order, and the `roadmap-coordination` delta the board scenario; `openspec validate state-skips-unlocated --strict` passes (run 4). The release pin test `release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines` passes (run 5), and the two manifest-reading pin tests `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` and `change-loop docs: the design records the answers` pass (run 6), so the CI pin lines in the doc follow devkit-openspec 0.40.1 after the merge | pass |

What the train will still prove, and this verification did not: the whole suite and `scripts/check.py` on the joined heads, as the
train records them.

Defects found: none.
