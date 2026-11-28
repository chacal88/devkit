<!-- devkit-stage evidence result=passed attempt=1 commit=83e684ddeb5530397a6a2c9443fc03c9e319402f -->
Commit: 83e684ddeb5530397a6a2c9443fc03c9e319402f

# Evidence

## Verification

Verified at 83e684dd (committed code; only `tasks.md` ticks changed after the long gate ran). The only
uncommitted path is `openspec/changes/openspec-type-flag/proof/`.

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 4.4 | `node scripts/test-suite.mjs --own-files` | pass: run by the conducting session with `--concurrency=2` on this code; 27 `selected` lines, `suite: 27 files, 2633 tests, 2630 pass, 0 fail, 2870.3s, concurrency 2`; lines and suite line are in `openspec/changes/openspec-type-flag/proof/own-files-gate-4.4.txt` (selective run, not a whole-suite pass) |
| 4.4 | `python3 scripts/check.py` | train: proven by the train record |
| 4.4 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |

Extra runs in this verification (not gate rows): `python3 scripts/check.py` exit 0, `all checks passed`
(also run here although the train records it); `env TMPDIR=/var/tmp/devkit-suite node scripts/test-suite.mjs
plugins/openspec/hooks/validate-type.test.mjs` exit 0, `suite: 1 files, 11 tests, 11 pass, 0 fail, 3.2s`;
`openspec validate openspec-type-flag --type change --strict` exit 0, `Change 'openspec-type-flag' is valid`.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | Every file in scope tells the agent to run `openspec validate <id> --type change --strict`; none keeps the bare form or a fallback; `gen-agents.mjs --check` passes | `validate-type.test.mjs` T-1 (line-by-line check of the seven files, banned fragments absent) passed in the 11-test run above; `gen-agents.mjs --check` exit 0, 21 agents up to date; the own-files gate ran the kit tests that pin the regenerated templates (proof file) | pass |
| AC-2 | In a scratch repository with the real `openspec` CLI, a change and a spec of one id: bare form answers `ambiguous_item`, typed form validates the change | Scratch repository (CLI 2.0.0) with spec `same-id` and change `same-id`: `openspec validate same-id --strict --json` showed code `ambiguous_item` ("Ambiguous item 'same-id' matches both a change and a spec."), exit 1; `openspec validate same-id --type change --strict` printed `Change 'same-id' is valid`, exit 0. The repository's own AC-2 test passed in the 11-test run | pass |
| AC-3 | A check that runs locally and in CI fails when an agent, skill or schema file runs `openspec validate <id>` without `--type change`, naming file and line; passes on this change's files | Scratch copy of `scripts/check.py` with a file holding the bare form on line 3: exit 1 with `plugins/core/agents/bad.md:3: openspec validate names an id without --type change; a change and a spec of one id are ambiguous`; after adding `--type change` that line was gone. On this branch `python3 scripts/check.py` exit 0, `all checks passed`. The CI half (the `check` job step) is a Workflow follow-up of the plan | pass |
