<!-- devkit-stage evidence result=passed attempt=2 commit=e9de2402b2f0dc4521e2a548f96f6217fed2276a -->
Commit: e9de2402b2f0dc4521e2a548f96f6217fed2276a
# Evidence

Verified at `e9de240` (a merge of `origin/main` at `9dff573` into the branch) with a clean working tree. This is attempt 2: it replaces
the attempt 1 file, written at `79dfc68`, whose commit is now stale.

## What this verification ran and what it did not

The delivery train is on for this repository: `origin/main`'s `openspec/config.yaml` holds
`devkit.delivery.train: "node scripts/test-suite.mjs && python3 scripts/check.py"` (read with
`git show origin/main:openspec/config.yaml`). A gate part equal to a part of that command is not run here: the train runs
the whole suite and `scripts/check.py` once, on the joined heads, and records them. Those rows read `train:`. Everything
else was run, each as its own command, and its exit code decided.

The whole suite was NOT run at `e9de240`, by the caller's instruction (the machine is busy and the train proves it). What
exists as history, and is not this commit's proof: at the commit before the last two merges of `origin/main` (`0602907`) the
whole suite ran in two steps. Step one: 38 files, 2956 tests, 2952 pass, 4 fail, all four in this change's two moved test
files (`change-loop-remote-state.test.mjs`, `roadmap-loop-upfront.test.mjs`) for imports missing there. Step two: test-only
commit `a273745` fixed the imports, and those two files reran whole, 340 of 340 pass. The two merges since then brought
other changes' files; the whole-suite result at `e9de240` is the train's to give.

Commands run at `e9de240` (all exit 0):

1. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="unlocated" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`:
   `suite: 3 files, 40 tests, 40 pass, 0 fail, 40.3s, concurrency 2`. Named top-level tests that ran and passed: 19 `unlocated 1:`
   and 1 `unlocated 3:` in `change-loop-remote-state.test.mjs`, 8 `unlocated 2:` in `roadmap-loop-upfront.test.mjs`
   (28 in all, plus their subtests). `change-loop-compozy.test.mjs` has no test named `unlocated`; its one match of the pattern passed.
2. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs`: 160 tests, 160 pass, 0 fail, 238.5s.
3. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs`: 110 tests, 110 pass, 0 fail, 200.4s.
4. `python3 scripts/gen-catalog.py --check`: exit 0, no output.
5. `command claude plugin validate .`: `Validation passed`, exit 0.
6. `openspec validate state-skips-unlocated --strict`: `Change 'state-skips-unlocated' is valid`, exit 0.
7. Release pin (task 3.3's check, not a gate part): `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="release-merge pin: the real" plugins/openspec/hooks/release-merge.test.mjs`: 1 test, 1 pass, 0 fail. The release is devkit-openspec 0.39.1 and marketplace 0.43.1 (read from `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the top `CHANGELOG.md` heading `0.43.1`).

One difference from `tasks.md`: runs 2, 3 and 7 used `TMPDIR=/private/tmp/devkit-state-skips-unlocated` where tasks 1.4 and 2.3 write `TMPDIR=/private/tmp` (a private folder per run, as the suite expects); the other two variables are as written.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs` | pass: 160 of 160 tests pass, exit 0, run at `e9de240` (run 2 above; TMPDIR was the private folder named there) |
| 1.4 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command `node scripts/test-suite.mjs && python3 scripts/check.py`; not run in this verification) |
| 2.3 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 110 of 110 tests pass, exit 0, run at `e9de240` (run 3 above; TMPDIR was the private folder named there) |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | train: proven by the train record (the train command's part `node scripts/test-suite.mjs` with the gate's env prefix; the whole suite was not run at `e9de240`; the targeted run 1 above passes 40 of 40, and the two-step history above is not this commit's proof) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; not run in this verification) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output, run at `e9de240` |
| 3.5 | `command claude plugin validate .` | pass: `Validation passed`, exit 0, run at `e9de240` |
| 3.5 | `openspec validate state-skips-unlocated --strict` | pass: `Change 'state-skips-unlocated' is valid`, exit 0, run at `e9de240` |

### Acceptance criteria

The real-run proof is `openspec/changes/state-skips-unlocated/proof/real-run.txt` (a scratch repository with changes `aa` and
`xx`; the plan names them `a` and `x`, but `open` refuses one-letter ids). `xx`'s worktree branch was renamed to `side`, so only
`xx` is unlocated; `aa` stays in its own worktree. Before is the hooks of `origin/main`, after is this change's hooks. That run was
made before the last two merges of `origin/main`; `git diff --stat 0602907 HEAD` shows `change-loop.mjs` and `roadmap-loop.mjs`
unchanged since `0602907` (the merges changed `docs/openspec-flow.md` and two lines of this change's test files, among others),
and the named tests below, run at `e9de240`, pin the printed lines again. The red runs `proof/red-1.txt` (28 tests, 18 fail, 10
pass), `proof/red-2.txt` (10 tests, 8 fail, 2 pass) and `proof/red-3.txt` (1 test, 1 fail) show the named tests failing before
the code and the docs existed. Test names below are the ones of run 1, all passing at `e9de240`.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `state` lists an unlocated change as blocked with a reason, in `en` and `pt-BR`, and still lists every other change | Real run, from the main checkout (scratch root): before, `state --lang en` and `--lang pt-BR` both exit 3 with `no change named xx, active or archived`; after, both exit 0 and list two entries: `aa` unchanged (`waiting-for-owner`, reason `grill`, stage `requirements`, root and branch `aa`) and `xx` with `state: blocked`, `reason.code: wrong-branch`, text `its folder is on a branch with another name` (en) and `a pasta dela está num branch com outro nome` (pt-BR), stage fields null, `root` the worktree that holds the folder, `branch: side`, `stateIcon` the blocked icon. Tests (run 1, at `e9de240`): `unlocated 1: state lists an unplaced change blocked and every other change as before`, `unlocated 1: state in Brazilian Portuguese gives the same code and the pt-BR phrase`, `unlocated 1: unplacedAction gives null for a change the loop can place` / `... for an id no checkout holds` / `... gives the blocked stand-in with the holder's root and branch`, and `unlocated 1: state follows the run file first for an unplaced change`. Red: `proof/red-1.txt` shows `unlocated 1: unplacedAction gives null for a change the loop can place` failing before the code | pass |
| AC-2 | `state --change x` gives that one blocked entry, the same as the list | Real run, `state --change xx --lang en` from the main checkout: before exit 3; after exit 0 with a `changes` array of one entry, field for field the `xx` entry of the list (`wrong-branch`, same text, root, branch `side`). Test `unlocated 1: state --change x prints the list's entry` passes at `e9de240` | pass |
| AC-3 | The `/devkit status` board shows it blocked with the same words, exits 0, other lines as before, board and `state` agree | Real run, `roadmap-loop.mjs status`: before exit 3 in `en` and `pt-BR`; after exit 0, `en`: `Waiting for you` / `aa   your answers about its request`, then `Blocked` / `xx   its folder is on a branch with another name`; `pt-BR`: `Esperando você` / `aa ...`, `Travadas` / `xx   a pasta dela está num branch com outro nome`. The words of `xx` equal `state`'s `reason.text` in each language. Tests (run 1, at `e9de240`, 8 of 8 `unlocated 2:` pass): `the board lists an unplaced roadmap line under Blocked and the others as before`, `the board in Brazilian Portuguese`, `the board and the state command agree on every open roadmap change, and on x's words`, `a roadmap decision says once that x stopped and hands a's stage`, `the roadmap stop lock refuses for a's ready stage with x unplaced`, `the roadmap stop lock lets the stop through when x is the only open line`, `a placed roadmap line reads as before`, `the board follows the run file first for an unplaced line, as the state command does`. Red: `proof/red-2.txt` shows 8 of the 10 tests failing before the code | pass |
| AC-4 | An unknown id keeps exit 3 `no change named nope` | Real run, `state --change nope --lang en`: before and after both exit 3, `{"version":1,"error":"no change named nope","reply":"I could not read that request. ..."}`. Tests (run 1, at `e9de240`): `unlocated 1: state --change nope in the unplaced setup still exits 3` and `unlocated 1: state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` (the archive is checked before a change is called unplaced) pass | pass |
| AC-5 | `locate` prefers the caller's worktree; the archive worktree and the worktree on branch `x` still win; main checkout and the change's own worktree unchanged | Real run, `next --change xx --lang en` from `xx`'s worktree on branch `side`: before exit 3 `no change named xx, active or archived`; after exit 0 with `kind: grill`, `stage: requirements`, `root` that worktree, `branch: side`. Tests (run 1, at `e9de240`): `unlocated 1: locate from a worktree on another branch that holds the active folder reads it there`, `locate: the archive worktree wins over the caller's`, `locate: the worktree on branch x wins over the caller's`, `locate from the main checkout is unchanged`, `locate from the change's own worktree is unchanged`, `locate: a caller holding only an archived folder reads the main checkout`, `locate: a main checkout holding a folder of x keeps it`, `locate: a caller with no folder of x reads the main checkout`, `next --change x from the worktree on another branch gives x's action`, `the change run's stop lock in that worktree refuses for x's ready stage`. Red: `proof/red-1.txt` shows the first of these failing before the code. Note for the reader: the implemented order reads the caller's checkout only when the main checkout holds no folder of the change (docs and spec state it so, and `locate: a main checkout holding a folder of x keeps it` pins it); `requirements.md` words it without that condition | pass |
| AC-6 | No other behaviour changes; existing tests pass as they are; a placed change prints as before | Run 2 and run 3 above: `change-loop.test.mjs` 160 of 160 and `roadmap-loop.test.mjs` 110 of 110 pass whole at `e9de240`, with no existing test edited. The real run lists `aa` (a change the loop can place) with the same fields as a plain change; tests `unlocated 2: a placed roadmap line reads as before` and `unlocated 1: unplacedAction gives null for a change the loop can place` pass. Limit: `guard.test.mjs` and every other suite file were NOT run at `e9de240`; the train gives that whole-suite run. History only, at `0602907`/`a273745`: 36 of 38 files passed whole (including `guard.test.mjs`), the other two passed after the import fix (340 of 340) | pass |
| AC-7 | `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order | Test `unlocated 3: the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` passes at `e9de240` (run 1); `proof/red-3.txt` shows it failing before the doc edit. The `change-state` delta (`specs/change-state/spec.md`) holds the scenarios for `wrong-branch`, the archive check and the `locate` order, and the `roadmap-coordination` delta the board scenario; `openspec validate state-skips-unlocated --strict` passes (run 6). The release pin test `release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines` passes (run 7), so the CI pin lines in the doc follow devkit-openspec 0.39.1 | pass |

Defects found: none.
