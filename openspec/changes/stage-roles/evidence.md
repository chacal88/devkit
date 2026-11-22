<!-- devkit-stage evidence result=passed attempt=1 commit=db34efd887c7e8f8eb2cda8411708d611fe3c774 -->
Commit: db34efd887c7e8f8eb2cda8411708d611fe3c774

# Evidence: stage-roles

Verified at the commit above on branch `stage-roles`, working tree clean. Tests ran with `TMPDIR` under `/var/tmp` and `GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`. No PR exists yet; no comment posted. No screenshots: the change has no UI surface.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles flow" --test-name-pattern="^stage-roles roles" --test-name-pattern="^flow-check" --test-name-pattern="^conduct" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 516 tests, 516 pass, 0 fail |
| 1.10 | `diff -r plugins/openspec/schemas openspec/schemas` | pass: exit 0, both schema copies identical |
| 1.10 | `python3 scripts/check.py` | pass: all checks passed |
| 1.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 2.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" --test-name-pattern="^ship-change" --test-name-pattern="^format" --test-name-pattern="^openspec-setup" --test-name-pattern="^README" plugins/openspec/hooks/guard.test.mjs` | pass: 453 tests, 453 pass, 0 fail |
| 2.10 | `python3 scripts/check.py` | pass: all checks passed |
| 2.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.5 | `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 79 tests, 78 pass, 0 fail, 1 skipped |
| 3.5 | `python3 scripts/check.py` | pass: all checks passed |
| 4.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite, 1254 tests, 1254 pass, 0 fail, 0 skipped |
| 4.5 | `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 79 tests, 78 pass, 0 fail, 1 skipped |
| 4.5 | `python3 scripts/check.py` | pass: all checks passed |
| 4.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.5 | `openspec validate stage-roles --strict` | pass: Change 'stage-roles' is valid |
| 4.5 | `command claude plugin validate .` | pass: Validation passed |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | carried-items-split | `openspec/roadmap.md` lists `stage-roles` (line 62) and `coordinator-loop-fixes` (line 65) as separate items; the second holds the carried items. Read at this commit. | pass |
| AC-2 | mockup-drawn-when-ui | `screen-designer` agent exists in `plugins/core/agents`; `devkit` `flow.json` declares the `mockup` stage; `stage-roles flow` and `stage-roles roles` tests pass in the 1.10 and full-suite runs. | pass |
| AC-3 | mockup-skipped-without-ui | `stage-roles flow` rule on/off tests for the ui flag pass (1.10 gate, full suite). | pass |
| AC-4 | mockup-owner-approval | Owner ceiling and approval tests (`stage-roles flow`, `stage-roles` loop tests) pass in the 2.10 gate and full suite. | pass |
| AC-5 | decisions-always-analysed | `adr-author` agent exists; `devkit` `flow.json` declares `decisions`; related tests pass in 1.10, 2.10 and the full suite. | pass |
| AC-6 | adrs-accepted-on-approval | The approval-writer tests (`stage-roles` writers) pass in the 2.10 gate and the full suite (1254/1254). | pass |
| AC-7 | early-stages-stale-readiness | `staleAfter` tests by `mockup.md` and `decisions.md` pass in the 1.10 gate and full suite. | pass |
| AC-8 | test-config-declared | `openspec-setup` SKILL.md asks for `unit`, `coverage.command`, `coverage.target` and `e2e` in the `devkit:` `tests:` block; `readTestSettings` tests pass (1.10, 2.10). | pass |
| AC-9 | unit-tests-stage | `test-runner` agent exists; `unit-tests` stage declared in both `flow.json` files; stage tests pass in 1.10 and the full suite. | pass |
| AC-10 | e2e-stage | `e2e-tester` agent exists; `e2e-tests` stage declared in both `flow.json` files; conditional-stage tests pass. | pass |
| AC-11 | demonstration-as-text | `pr-verifier.md` states the per-criterion text proof form and lists taking a screenshot, keeping an image and posting a PR comment as forbidden; `deliver-check` tests pass in the full suite. | pass |
| AC-12 | lite-runs-tests-only | `plugins/openspec/schemas/devkit-lite/flow.json` stage ids: open, requirements, proposal, specs, tasks, implementation, unit-tests, e2e-tests, evidence, review, delivery, retro; no `mockup` or `decisions`. | pass |
| AC-13 | no-stage-goes-back | Tests for stages arriving after their point (by `proposal.md` and `evidence.md`) pass in the 1.10 gate and full suite. | pass |
| AC-14 | compozy-driver-runs-new-stages | `loop.yaml` and the `design`, `tech-lead` and `qa` role shells name `screen-designer`, `adr-author`, `test-runner`, `e2e-tester`; the kit test "still ships exactly four shells" and the kit suite pass (78 pass, 1 skipped). | pass |
| AC-15 | roles-doc-current | `docs/roles.md` has sections for `screen-designer` (line 41), `test-runner` (line 81) and `e2e-tester` (line 89) with "Played today by" lines; `stage-roles roles` pins pass. `docs/coordination-design.md` D-4 "built" marks were not individually re-counted; the pins in `change-loop.test.mjs` cover them and pass. | pass |
| AC-16 | checks-green | Every gate row above passes: full hook suite 1254/1254, kit tests, `check.py`, `gen-catalog.py --check`, `claude plugin validate .`, `openspec validate --strict`. Version bumps are covered by the suite's release tests. | pass |
