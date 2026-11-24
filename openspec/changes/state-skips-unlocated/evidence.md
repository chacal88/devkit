<!-- devkit-stage evidence result=passed attempt=1 commit=79dfc689c7b7ead3ead71c492d80c69258a03a86 -->
Commit: 79dfc689c7b7ead3ead71c492d80c69258a03a86
# Evidence

Verified at `79dfc68` with a clean working tree. The whole test suite was NOT run as one command at this
commit (about 23 minutes, it times out here). It was run in two steps, and this file says so in each row
it touches:

1. Step one: the whole suite `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=4`
   at commit `0602907` (the merge of `origin/main`, release 0.38.1): 38 files, 2956 tests, 2952 pass,
   4 fail, 1395.0s (the suite log). 36 of the 38 files passed whole. The 4 failures were all in two of this
   change's own files (`change-loop-remote-state.test.mjs`, `roadmap-loop-upfront.test.mjs`): imports missing
   in tests moved there by the split (suite-speed).
2. Step two: commit `a273745` imported the helpers those tests use (test files only). The two files were
   rerun whole at `a273745`: 2 files, 340 tests, 340 pass, 0 fail (the suite rerun log). `git diff --stat
   0602907 HEAD` shows only `tasks.md` and those two test files changed since step one, so no product code,
   doc or spec changed after the whole-suite run.

This verification then ran, at `79dfc68`, the targeted command below, and the other gate parts on their own.

Targeted run (this verification):
`env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="unlocated" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`
exit 0, `suite: 3 files, 40 tests, 40 pass, 0 fail, 45.6s, concurrency 2`. Named top-level tests that ran
and passed: 19 `unlocated 1:` and 1 `unlocated 3:` in `change-loop-remote-state.test.mjs`, 8 `unlocated 2:`
in `roadmap-loop-upfront.test.mjs`. `change-loop-compozy.test.mjs` has no test named `unlocated`: the
pattern matched one test there (a CI-pin assertion that mentions this change in a comment), which passed.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs` | pass: the file passed whole inside the step-one suite run at `0602907` (312.2s, in the suite log); not rerun alone here; no product code changed since (see step two) |
| 1.4 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run at `79dfc68` |
| 2.3 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: the file passed whole inside the step-one suite run at `0602907` (199.9s, in the suite log); not rerun alone here; no product code changed since |
| 2.3 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run at `79dfc68` |
| 3.5 | `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | pass, in two steps and not one green run: step one at `0602907` was 2952 of 2956 (4 fail, all missing imports in this change's two moved test files); step two at `a273745` reran those two files whole, 340 of 340 pass; the targeted run above passes at `79dfc68` |
| 3.5 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run at `79dfc68` |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output, run at `79dfc68` |
| 3.5 | `command claude plugin validate .` | pass: `Validation passed`, exit 0, run at `79dfc68` |
| 3.5 | `openspec validate state-skips-unlocated --strict` | pass: `Change 'state-skips-unlocated' is valid`, exit 0, run at `79dfc68` |

### Acceptance criteria

The real-run proof is `openspec/changes/state-skips-unlocated/proof/real-run.txt` (scratch repository with
changes `aa` and `xx`; the plan names them `a` and `x`, but `open` refuses one-letter ids). `xx`'s worktree
branch was renamed to `side`, so only `xx` is unlocated; `aa` stays in its own worktree. Before is the hooks of
`origin/main`, after is this worktree's hooks. The red runs `proof/red-1.txt`, `red-2.txt` and `red-3.txt`
show the named tests failing before the code and the docs existed.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `state` lists an unlocated change as blocked with a reason, in `en` and `pt-BR`, and still lists every other change | Real run, from the main checkout (scratch root): before, `state --lang en` and `--lang pt-BR` both exit 3 with `no change named xx, active or archived`; after, both exit 0 and list two entries: `aa` unchanged (`waiting-for-owner`, reason `grill`, stage `requirements`, root and branch `aa`) and `xx` with `state: blocked`, `reason.code: wrong-branch`, text `its folder is on a branch with another name` (en) and `a pasta dela está num branch com outro nome` (pt-BR), stage fields null, `root` the worktree that holds the folder, `branch: side`, `stateIcon` the blocked icon. Tests (targeted run, all pass): `unlocated 1: state lists an unplaced change blocked and every other change as before`, `unlocated 1: state in Brazilian Portuguese gives the same code and the pt-BR phrase`, `unlocated 1: unplacedAction gives null for a change the loop can place` / `... for an id no checkout holds` / `... gives the blocked stand-in with the holder's root and branch`, and `unlocated 1: state follows the run file first for an unplaced change` (a declared end or a stage in flight wins over the stand-in). Red: `proof/red-1.txt` shows `unlocated 1: unplacedAction gives null for a change the loop can place` failing before the code | pass |
| AC-2 | `state --change x` gives that one blocked entry, the same as the list | Real run, `state --change xx --lang en` from the main checkout: before exit 3; after exit 0 with a `changes` array of one entry, field for field the `xx` entry of the list (`wrong-branch`, same text, root, branch `side`). Test `unlocated 1: state --change x prints the list's entry` passes | pass |
| AC-3 | The `/devkit status` board shows it blocked with the same words, exits 0, other lines as before, board and `state` agree | Real run, `roadmap-loop.mjs status`: before exit 3 in `en` and `pt-BR`; after exit 0, `en`: `Waiting for you` / `aa   your answers about its request`, then `Blocked` / `xx   its folder is on a branch with another name`; `pt-BR`: `Esperando você` / `aa ...`, `Travadas` / `xx   a pasta dela está num branch com outro nome`. The words of `xx` equal `state`'s `reason.text` in each language. Tests (all pass): `unlocated 2: the board lists an unplaced roadmap line under Blocked and the others as before`, `unlocated 2: the board in Brazilian Portuguese`, `unlocated 2: the board and the state command agree on every open roadmap change, and on x's words`, `unlocated 2: a roadmap decision says once that x stopped and hands a's stage`, `unlocated 2: the roadmap stop lock refuses for a's ready stage with x unplaced`, `unlocated 2: the roadmap stop lock lets the stop through when x is the only open line`, `unlocated 2: a placed roadmap line reads as before`, `unlocated 2: the board follows the run file first for an unplaced line, as the state command does`. Red: `proof/red-2.txt` shows seven of these failing before the code | pass |
| AC-4 | An unknown id keeps exit 3 `no change named nope` | Real run, `state --change nope --lang en`: before and after both exit 3, `{"version":1,"error":"no change named nope","reply":"I could not read that request. ..."}`. Test `unlocated 1: state --change nope in the unplaced setup still exits 3` passes. Test `unlocated 1: state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` passes (the archive is checked before a change is called unplaced) | pass |
| AC-5 | `locate` prefers the caller's worktree; the archive worktree and the worktree on branch `x` still win; main checkout and the change's own worktree unchanged | Real run, `next --change xx --lang en` from `xx`'s worktree on branch `side`: before exit 3 `no change named xx, active or archived`; after exit 0 with `kind: grill`, `stage: requirements`, `root` that worktree, `branch: side`, `state.state: waiting-for-owner`. Tests (all pass): `unlocated 1: locate: the archive worktree wins over the caller's`, `unlocated 1: locate: the worktree on branch x wins over the caller's`, `unlocated 1: locate from the main checkout is unchanged`, `unlocated 1: locate from the change's own worktree is unchanged`, `unlocated 1: locate: a caller holding only an archived folder reads the main checkout`, `unlocated 1: locate: a main checkout holding a folder of x keeps it`, `unlocated 1: locate: a caller with no folder of x reads the main checkout`, `unlocated 1: next --change x from the worktree on another branch gives x's action`, `unlocated 1: the change run's stop lock in that worktree refuses for x's ready stage`. Red: `proof/red-1.txt` shows `unlocated 1: locate from a worktree on another branch that holds the active folder reads it there` failing before the code. Note for the reader: the implemented order reads the caller's checkout only when the main checkout holds no folder of the change (docs and spec state it so, and test `locate: a main checkout holding a folder of x keeps it` pins it); `requirements.md` words it without that condition | pass |
| AC-6 | No other behaviour changes; existing tests pass as they are; a placed change prints as before | Step-one whole-suite run at `0602907`: 36 of 38 files passed whole, including `change-loop.test.mjs` (312.2s), `roadmap-loop.test.mjs` (199.9s) and `guard.test.mjs` (33.7s); the other 2 files failed only on 4 missing imports in this change's moved tests (fixed in `a273745`, test-only), and those two files then passed whole, 340 of 340. The real run lists `aa` (a change the loop can place) with the same fields as a plain change, and tests `unlocated 2: a placed roadmap line reads as before` and `unlocated 1: unplacedAction gives null for a change the loop can place` pass. Limit: this is two steps, not one whole-suite run at `79dfc68`; the only commits after step one touch tests and `tasks.md` | pass |
| AC-7 | `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order | Reading `docs/openspec-flow.md` ("A change's state." paragraph): names `wrong-branch`, the unlocated case with its `root`/`branch`, the `/devkit status` Blocked block, and the order "worktree on `chore/archive-<id>`, else the worktree on branch `<id>`, else the checkout it is called from ..., else the main checkout". The `change-state` delta (`specs/change-state/spec.md`) holds the scenarios for `wrong-branch`, the archive check and the `locate` order (requirement text starting "The loop SHALL read change `<id>` in the worktree on `chore/archive-<id>`..."); the `roadmap-coordination` delta holds the board scenario. Test `unlocated 3: the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` passes; `proof/red-3.txt` shows it failing before the doc edit; `openspec validate state-skips-unlocated --strict` passes | pass |

Defects found: none.
