<!-- devkit-stage retro result=passed attempt=1 commit=5ccf1a2f569c81d869ad9c5e30b65f502b33087d -->
## Retro: fresh-base-check

1. Went wrong: test `fresh-base-check 7` called `stopDecision` in its own process, so its stop record landed in the process's `TMPDIR` (`devkit-stop/`). `scripts/test-suite.mjs` marked `change-loop.test.mjs` `LEFT` and exited 1 with every test passing. The first whole-suite run (38b5cd9) already showed the `LEFT` line, but the fix round and evidence attempt 2 read only its two failing tests. The defect reached PR 110's CI (red `check`), cost an evidence attempt, hit the stage ceiling until `stage-ceiling-consecutive` landed, and moved the change from train 6 to train 11. Smaller costs: each merge of `origin/main` needed a `tdd-implementer` just to resolve release-file and test conflicts, because the guard refuses every edit by the conducting session in a `/devkit change` run; after the trains 6 to 9 merge, the joined header text pushed the `devkit-stop` line past the 30 lines a header test reads.
2. Better next time: read a whole-suite summary by its per-file status and exit code, not by its failing tests: a `LEFT` file is a failure like a `FAIL` file, and every file not `pass` gets a row. A new test that calls stop or lock code in-process follows the existing CONTRIBUTING rule (point the temporary root at a `tmpFolder` for the call) and is run once alone through `node scripts/test-suite.mjs <file>` before the first push, which shows `LEFT`. In a `/devkit change` run, hand a merge's conflicts to `tdd-implementer` at once instead of trying to edit them.
3. Remember: a suite run with 0 failures can still exit 1; the file status `LEFT` is the reason.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The verifier read the whole-suite run by its failing tests and missed a `LEFT` file, so a red CI shipped | process-friction | doc-update | project |
| 2 | An in-process call into stop or lock code writes under the test process's `TMPDIR`; the CONTRIBUTING rule existed but was not followed | bug-class | memory-only | user |
| 3 | `nextAction` declares `const baseBranch` twice (the inner one shadows the outer and costs a second git call); three reviewers flagged it | bug-class | doc-update | project |
| 4 | The guard refuses the conducting session's edits to release files and tests while it resolves a merge of the base | process-friction | memory-only | user |

Note added at the archive: applying proposal 1 first missed two generated copies of the agent's text: `gen-agents.mjs --check` caught the CompozyOS template, and the archive PR's CI (`adoption.test.mjs`, AC-9 repo-adopts) caught this repository's adopted copy under `.compozy/agents/`. A proposal that touches an agent's text regenerates its template (`gen-agents.mjs`) and the adopted copy, and names every generated path; `release-at-merge` hit the same class the same day. Each path was added to proposal 1 with the owner's answer.

## Proposed updates

### `plugins/core/agents/pr-verifier.md`, `plugins/compozy/skills/compozy-setup/templates/agents/pr-verifier/AGENT.md`, `.compozy/agents/pr-verifier/AGENT.md` (process-friction)
A whole-suite summary is read by each file's status: `LEFT` counts as a failure. The CompozyOS template is regenerated from the agent by `gen-agents.mjs`, and this repository's installed copy is rendered from that template (both paths added at the archive with the owner's answers).
- before: - Run the check command for the touched surfaces and keep its summary (pass/fail per gate). Each gate runs as its own command and its exit code decides; no `| tail`, `; echo $?` or `|| true` masking it.
+ after: - Run the check command for the touched surfaces and keep its summary (pass/fail per gate). Each gate runs as its own command and its exit code decides; no `| tail`, `; echo $?` or `|| true` masking it. A suite runner that reports each file's status (`pass`, `FAIL`, `LEFT`) is read file by file: every file not `pass` gets a row with its status and what the summary names (a `LEFT` file fails the run even with 0 failing tests), and a run that exits non-zero is never recorded as a pass.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/change-loop.mjs` (bug-class)
Drop the inner `baseBranch` declaration in `nextAction`, which repeats the outer one.
- before: `const baseBranch = defaultBase(found.root);` at line 1547 and again at line 1549, inside the `inDelivery` block
+ after: the line at 1547 only; the `inDelivery` block uses the outer `baseBranch`
- Answer: approved
- Applied: yes

### user memory (memory-only)
A test that calls stop or lock code in its own process points `TMPDIR` at a sandbox for the call; the suite fails a file marked `LEFT`.
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a /devkit change run the guard refuses the session's own edits, release files included: hand a merge's conflicts to tdd-implementer at once.
- Answer: approved
- Applied: yes
