<!-- devkit-stage evidence result=passed attempt=1 commit=643bc4765052e251d8e0412d3247a28d7da2d555 -->
Commit: 643bc4765052e251d8e0412d3247a28d7da2d555

# Evidence

Change: `review-writer-prompt` · verified on branch `review-writer-prompt`, no PR yet, no UI touched
(no screenshots). Every gate ran as `tasks.md` writes it, with `GITHUB_HEAD_REF=probe-branch` and
`GITHUB_BASE_REF=main` for the hook suites.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.7 | `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: 87 tests, 87 pass, 0 fail |
| 1.7 | `python3 scripts/check.py` | pass: all checks passed |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: exit 0; the standalone run wrote no output (the machine's /tmp filled up meanwhile), so the proof is the guard suite below, which imports both files and passed |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed |
| 3.2 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1183 tests, 1183 pass, 0 fail, 0 cancelled, 0 skipped |
| 3.2 | `python3 scripts/check.py` | pass: all checks passed |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.2 | `command claude plugin validate .` | pass: Validation passed |
| 3.2 | `openspec validate review-writer-prompt --strict` | pass: Change 'review-writer-prompt' is valid |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `outcomes` prints a `jobs` list of writer prompts; the `agents` path sends them | `review-writer-prompt AC-1` tests (script and text) in `review-round.test.mjs`, 87/87 pass | pass |
| AC-2 | The stage-1 prompt says a disposition names one sha | `review-writer-prompt AC-2` tests in `review-round.test.mjs`, pass | pass |
| AC-3 | The stage-1 prompt asks for `git rev-parse HEAD` and the `read` and `notRead` lists | `review-writer-prompt AC-3` tests, including the six-agents text test, pass | pass |
| AC-4 | A stage-1 `commit` other than `args.head` fails its review; `args` without `head` is refused | `review-writer-prompt AC-4` tests (rules and text), pass | pass |
| AC-5 | A partial stage-1 answer fails its review; a declined empty one passes | `review-writer-prompt AC-5` tests, pass | pass |
| AC-6 | The writer prompt and verdict file hold one `Verdict:` and one `Commit:` line | `review-writer-prompt AC-6` tests, pass | pass |
| AC-7 | `check-file` refuses a second `Verdict:` or `Commit:` line | `review-writer-prompt AC-7` tests, pass | pass |
| AC-8 | A test-only commit leaves four reviewers current; any other commit stales all | `review-writer-prompt AC-8` tests in `deliver-check.test.mjs` and `flow-check.test.mjs`, run inside the guard suite (1183 pass) | pass |
| AC-9 | `deliver-check` skips a fenced checkbox in `tasks.md` | `review-writer-prompt AC-9` tests in `deliver-check.test.mjs`, run inside the guard suite (1183 pass) | pass |
