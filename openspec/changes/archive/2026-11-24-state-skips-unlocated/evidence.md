<!-- devkit-stage evidence result=passed attempt=7 commit=4e08f7c47af302b41a5c998fb72f77221c4f2dc5 -->
Commit: 4e08f7c47af302b41a5c998fb72f77221c4f2dc5
# Evidence

Verified at `4e08f7c` (the branch head) with a clean working tree. `git diff --stat 67d5aa3 HEAD` shows only this evidence file changed
(the code is that of `67d5aa3`, the merge of `origin/main` after pull request 123, train 6).
This is attempt 7: it replaces the attempt 6 file, written at `67d5aa3`, and adds the two whole-file runs of gates 1.4 and 2.3,
which attempt 6 had left to the train. Attempt 5 was written at `af2edf9`. The merge had real conflicts,
resolved by keeping both sides: post-merge-validate's `baseMergeOf` sits above this change's `locate` in
`plugins/openspec/hooks/change-loop.mjs`, the remote-state test file imports both sides' fixtures, and ADR 0017 holds both Notes as
separate paragraphs (post-merge-validate's first). This change's release is now devkit-openspec 0.42.1 (`plugins/openspec/.claude-plugin/plugin.json`
reads `0.42.1`) and marketplace 0.47.1 (CHANGELOG 0.47.1, the three CI pins `v0.42.1`), as the caller stated and the pin tests below confirm.
The loop's `merge-check` after the merge answered green (`openspec validate --strict` on merge 67d5aa3), as the caller reported.

## What this verification ran and what it did not

The delivery train is on: `devkit.delivery.train` is `node scripts/test-suite.mjs && python3 scripts/check.py`. A gate part equal
to a part of that command is not run here; the train runs the whole suite and `scripts/check.py` once, on the joined heads. Those
rows read `train:`. The two whole files of gates 1.4 and 2.3 (`change-loop.test.mjs`, `roadmap-loop.test.mjs`) are not parts of the
train command, so in this attempt each was run whole, one at a time, at low priority (`nice -n 15`), at `4e08f7c` (runs 5 and 6 below).
Per the caller, the session already ran at the `67d5aa3` code (not rerun here): `change-loop-remote-state.test.mjs` whole, 234 of 234
(`--concurrency=3`); the `unlocated` tests of roadmap-loop-upfront and the pin tests, 13 of 13; `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and `claude plugin validate` green. The whole suite was not run here.

Commands run in this verification (runs 1 to 4 at `67d5aa3`, whose code `4e08f7c` shares, runs 5 and 6 at `4e08f7c`; each its own command; exit code decides; `TMPDIR=/private/tmp/devkit-state-skips-unlocated`;
no process of this verification left running):

1. `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="unlocated|change-state ADR 0017" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0 (redirected to a file, exit code read directly),
   `suite: 3 files, 41 tests, 41 pass, 0 fail, 82.7s, concurrency 2`. Per file: `change-loop-remote-state.test.mjs` pass (19 tests named
   `unlocated 1:`, the `unlocated 3:` test, `change-state ADR 0017: the documents follow`, and their subtests), `roadmap-loop-upfront.test.mjs`
   10 tests, 10 pass (the 8 `unlocated 2:` tests and subtests), `change-loop-compozy.test.mjs` 1 test (the file entry; no test matches), pass. Same 41 as attempt 5.
2. `openspec validate state-skips-unlocated --strict`: `Change 'state-skips-unlocated' is valid`, exit 0.
3. Release pin: `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-merge pin: the real" plugins/openspec/hooks/release-merge.test.mjs`: exit 0, 1 test, 1 pass, 0 fail (`release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines`).
4. The two pin tests of `change-loop-compozy.test.mjs` that read `plugins/openspec/.claude-plugin/plugin.json`: `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="change-loop docs|release-merge-conflict 15" plugins/openspec/hooks/change-loop-compozy.test.mjs`: exit 0, `suite: 1 files, 2 tests, 2 pass, 0 fail`. They are `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` and `change-loop docs: the design records the answers` (every CI pin in the flow doc names the manifest's version, 0.42.1, and the doc holds at least three pins).
5. Gate 1.4, whole file: `nice -n 15 env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs`: exit 0, `tests 182, pass 182, fail 0, cancelled 0, skipped 0`, 589 s. Output kept in `/private/tmp/devkit-state-skips-unlocated/g14-a7.out`.
6. Gate 2.3, whole file: `nice -n 15 env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs`: exit 0, `tests 110, pass 110, fail 0, cancelled 0, skipped 0`, 315 s. Output kept in `/private/tmp/devkit-state-skips-unlocated/g23-a7.out`.

The code check: `git diff af2edf9 HEAD -- plugins/openspec/hooks/change-loop.mjs` removes only lines that main's post-merge-validate work rewrote (the
header comments, the `baseBranch` constant, `COMMAND_STEPS`, the usage string); `locate` and `unplacedAction` are intact.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs` | pass: 182 of 182 tests pass, 0 fail, exit 0, run whole at `4e08f7c` (run 5; TMPDIR was the change's own folder `/private/tmp/devkit-state-skips-unlocated`, as earlier attempts recorded) |
| 1.4 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command; green at this head per the session, not run in this verification) |
| 2.3 | `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 110 of 110 tests pass, 0 fail, exit 0, run whole at `4e08f7c` (run 6; TMPDIR was the change's own folder `/private/tmp/devkit-state-skips-unlocated`, as earlier attempts recorded) |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command) |
| 3.5 | `env TMPDIR=/private/tmp/devkit-state-skips-unlocated GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | train: proven by the train record (the whole suite was not run here; the targeted run 1 passes 41 of 41, and the session ran `change-loop-remote-state.test.mjs` whole, 234 of 234) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record (a part of the train command) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: green at `67d5aa3` as run by the session (the caller's report; not rerun here) |
| 3.5 | `command claude plugin validate .` | pass: green at `67d5aa3` as run by the session (the caller's report; not rerun here) |
| 3.5 | `openspec validate state-skips-unlocated --strict` | pass: `Change 'state-skips-unlocated' is valid`, exit 0, run at `67d5aa3` (run 2) |

### Acceptance criteria

The real-run proof is `openspec/changes/state-skips-unlocated/proof/real-run.txt` (a scratch repository with changes `aa` and
`xx`; the plan names them `a` and `x`, but `open` refuses one-letter ids). `xx`'s worktree branch was renamed to `side`, so only
`xx` is unlocated; `aa` stays in its own worktree. Before is the hooks of `origin/main`, after is this change's hooks. That run was
made at `0602907`. The code that printed those lines is still this change's: `git diff af2edf9 HEAD -- plugins/openspec/hooks/change-loop.mjs`
(131 insertions, 7 deletions, counted at this head) holds only `origin/main`'s post-merge-validate work (the `merge-check` step, its
comment lines, `COMMAND_STEPS`, the usage string, and the `baseBranch` constant moved out of the delivery-row block into `baseMergeOf`'s
neighbourhood); every removed line is one of those, and `locate` (line 1446) and `unplacedAction` (line 1907) are intact. The named
tests below, run at `67d5aa3`, pin the printed lines again on that code. The red runs `proof/red-1.txt` (28 tests, 18 fail, 10 pass),
`proof/red-2.txt` (10 tests, 8 fail, 2 pass) and `proof/red-3.txt` (1 test, 1 fail) show the named tests failing before the code and
the docs existed. Test names below are the ones of run 1, all passing at `67d5aa3`.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `state` lists an unlocated change as blocked with a reason, in `en` and `pt-BR`, and still lists every other change | Real run, from the main checkout (scratch root): before, `state --lang en` and `--lang pt-BR` both exit 3 with `no change named xx, active or archived`; after, both exit 0 and list two entries: `aa` unchanged (`waiting-for-owner`, reason `grill`, stage `requirements`, root and branch `aa`) and `xx` with `state: blocked`, `reason.code: wrong-branch`, text `its folder is on a branch with another name` (en) and `a pasta dela está num branch com outro nome` (pt-BR), stage fields null, `root` the worktree that holds the folder, `branch: side`, `stateIcon` the blocked icon. Tests (run 1, at `67d5aa3`): `unlocated 1: state lists an unplaced change blocked and every other change as before`, `unlocated 1: state in Brazilian Portuguese gives the same code and the pt-BR phrase`, `unlocated 1: unplacedAction gives null for a change the loop can place` / `... for an id no checkout holds` / `... gives the blocked stand-in with the holder's root and branch`, and `unlocated 1: state follows the run file first for an unplaced change`. Red: `proof/red-1.txt` shows `unlocated 1: unplacedAction gives null for a change the loop can place` failing before the code | pass |
| AC-2 | `state --change x` gives that one blocked entry, the same as the list | Real run, `state --change xx --lang en` from the main checkout: before exit 3; after exit 0 with a `changes` array of one entry, field for field the `xx` entry of the list (`wrong-branch`, same text, root, branch `side`). Test `unlocated 1: state --change x prints the list's entry` passes at `67d5aa3` (run 1) | pass |
| AC-3 | The `/devkit status` board shows it blocked with the same words, exits 0, other lines as before, board and `state` agree | Real run, `roadmap-loop.mjs status`: before exit 3 in `en` and `pt-BR`; after exit 0, `en`: `Waiting for you` / `aa   your answers about its request`, then `Blocked` / `xx   its folder is on a branch with another name`; `pt-BR`: `Esperando você` / `aa ...`, `Travadas` / `xx   a pasta dela está num branch com outro nome`. The words of `xx` equal `state`'s `reason.text` in each language. Tests (run 1, at `67d5aa3`, 8 of 8 `unlocated 2:` pass): `the board lists an unplaced roadmap line under Blocked and the others as before`, `the board in Brazilian Portuguese`, `the board and the state command agree on every open roadmap change, and on x's words`, `a roadmap decision says once that x stopped and hands a's stage`, `the roadmap stop lock refuses for a's ready stage with x unplaced`, `the roadmap stop lock lets the stop through when x is the only open line`, `a placed roadmap line reads as before`, `the board follows the run file first for an unplaced line, as the state command does`. Red: `proof/red-2.txt` shows 8 of the 10 tests failing before the code | pass |
| AC-4 | An unknown id keeps exit 3 `no change named nope` | Real run, `state --change nope --lang en`: before and after both exit 3, `{"version":1,"error":"no change named nope","reply":"I could not read that request. ..."}`. Tests (run 1, at `67d5aa3`): `unlocated 1: state --change nope in the unplaced setup still exits 3` and `unlocated 1: state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` (the archive is checked before a change is called unplaced) pass | pass |
| AC-5 | `locate` prefers the caller's worktree; the archive worktree and the worktree on branch `x` still win; main checkout and the change's own worktree unchanged | Real run, `next --change xx --lang en` from `xx`'s worktree on branch `side`: before exit 3 `no change named xx, active or archived`; after exit 0 with `kind: grill`, `stage: requirements`, `root` that worktree, `branch: side`. Tests (run 1, at `67d5aa3`): `unlocated 1: locate from a worktree on another branch that holds the active folder reads it there`, `locate: the archive worktree wins over the caller's`, `locate: the worktree on branch x wins over the caller's`, `locate from the main checkout is unchanged`, `locate from the change's own worktree is unchanged`, `locate: a caller holding only an archived folder reads the main checkout`, `locate: a main checkout holding a folder of x keeps it`, `locate: a caller with no folder of x reads the main checkout`, `next --change x from the worktree on another branch gives x's action`, `the change run's stop lock in that worktree refuses for x's ready stage`. Red: `proof/red-1.txt` shows the first of these failing before the code. Note for the reader: the implemented order reads the caller's checkout only when the main checkout holds no folder of the change (docs and spec state it so, and `locate: a main checkout holding a folder of x keeps it` pins it); `requirements.md` words it without that condition. Also, as the new documentation note states, `next`, `wait` and `session-next` keep exit 3 for a change only another checkout holds when the caller is not in that checkout | pass |
| AC-6 | No other behaviour changes; existing tests pass as they are; a placed change prints as before | Gate rows 1.4, 2.3 and 3.5: the two whole files were run whole at `4e08f7c`: `change-loop.test.mjs` 182 of 182 (run 5) and `roadmap-loop.test.mjs` 110 of 110 (run 6), no failure; the whole suite is proven by the train. Whole at `67d5aa3`, by the session (the caller's report, not run here): `change-loop-remote-state.test.mjs` 234 of 234 (`--concurrency=3`). No existing test is edited by this change. The real run lists `aa` (a change the loop can place) with the same fields as a plain change; tests `unlocated 2: a placed roadmap line reads as before` and `unlocated 1: unplacedAction gives null for a change the loop can place` pass at `67d5aa3` (run 1). Limit: `guard.test.mjs` and every other suite file were NOT run here at `67d5aa3` | pass |
| AC-7 | `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order | Test `unlocated 3: the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` passes at `67d5aa3` (run 1); `proof/red-3.txt` shows it failing before the doc edit. `change-state ADR 0017: the documents follow` also passes (run 1), so ADR 0017's dated Note and the docs agree. The `change-state` delta (`specs/change-state/spec.md`) holds the scenarios for `wrong-branch`, the archive check and the `locate` order, and the `roadmap-coordination` delta the board scenario; `openspec validate state-skips-unlocated --strict` passes (run 2). The release pin test `release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines` passes (run 3), and the two manifest-reading pin tests `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` and `change-loop docs: the design records the answers` pass (run 4), so the CI pin lines in the doc follow devkit-openspec 0.42.1 after the merge | pass |

What the train will still prove, and this verification did not: the whole suite and `scripts/check.py` on the joined heads, as the
train records them.

Defects found: none.
