<!-- devkit-stage evidence result=passed attempt=3 commit=be4e2edb7c463dc5e59818e66f5906b9cdce4c4b -->
Commit: be4e2edb7c463dc5e59818e66f5906b9cdce4c4b

# Evidence

Change: `review-writer-prompt` · verified on branch `review-writer-prompt`, no PR yet, no UI touched
(no screenshots). Every gate ran as `tasks.md` writes it, with `GITHUB_HEAD_REF=probe-branch` and
`GITHUB_BASE_REF=main` for the hook suites, at the commit above (phase 4 included, after the rebase onto main; release devkit-core 0.9.0, devkit-openspec 0.20.0, marketplace 0.24.0). The only uncommitted file is `openspec/roadmap.md`, a roadmap line under `openspec/`, left as it was. `/tmp` inodes were checked before each long suite (2% to 11%, peak 46%, under the 75% limit). Each test gate was run on its own, with its output kept.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.7 | `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: standalone run, exit 0; 87 tests, 87 pass, 0 fail |
| 1.7 | `python3 scripts/check.py` | pass: all checks passed |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: standalone run, exit 0; 1028 tests, 1028 pass, 0 fail, 0 cancelled, 0 skipped; 26 passing `review-writer-prompt AC-9` and 27 passing `AC-8` lines |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed |
| 3.2 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: standalone background run, exit 0; 1252 tests, 1252 pass, 0 fail, 0 cancelled, 0 skipped |
| 3.2 | `python3 scripts/check.py` | pass: all checks passed |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.2 | `command claude plugin validate .` | pass: Validation passed |
| 3.2 | `openspec validate review-writer-prompt --strict` | pass: Change 'review-writer-prompt' is valid |
| 4.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: same standalone run as gate 2.5 (identical command), 1028 pass, 0 fail |
| 4.3 | `python3 scripts/check.py` | pass: all checks passed |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `outcomes` prints a `jobs` list of writer prompts; the `agents` path sends them | `review-writer-prompt AC-1` tests (script and text) in `review-round.test.mjs`, 87/87 pass at this commit | pass |
| AC-2 | The stage-1 prompt says a disposition names one sha | `review-writer-prompt AC-2` tests in `review-round.test.mjs`, pass | pass |
| AC-3 | The stage-1 prompt asks for `git rev-parse HEAD` and the `read` and `notRead` lists | `review-writer-prompt AC-3` tests, including the six-agents text test, pass | pass |
| AC-4 | A stage-1 `commit` other than `args.head` fails its review; `args` without `head` is refused | `review-writer-prompt AC-4` tests (rules and text), pass | pass |
| AC-5 | A partial stage-1 answer fails its review; a declined empty one passes | `review-writer-prompt AC-5` tests, pass | pass |
| AC-6 | The writer prompt and verdict file hold one `Verdict:` and one `Commit:` line | `review-writer-prompt AC-6` tests, pass | pass |
| AC-7 | `check-file` refuses a second `Verdict:` or `Commit:` line | `review-writer-prompt AC-7` tests, pass | pass |
| AC-8 | A test-only commit leaves four reviewers current; any other commit stales all | 27 passing `review-writer-prompt AC-8` lines (the merged first-parent and test-file staleness test included) in the standalone gate 2.5 run (`deliver-check.test.mjs`, `flow-check.test.mjs`), and the guard suite (1252 pass) | pass |
| AC-9 | `deliver-check` skips a fenced checkbox in `tasks.md`, and an unclosed fence hides nothing | 26 passing `review-writer-prompt AC-9` lines in the standalone gate 2.5/4.3 run, including the unclosed-fence tests of phase 4, and the guard suite (1252 pass) | pass |
