<!-- devkit-stage evidence result=passed attempt=4 commit=8d07aa047214a7491852265c9108dde96e05f24c -->
Commit: 8d07aa047214a7491852265c9108dde96e05f24c

# Evidence: stage-roles

Verified at the commit above on branch `stage-roles`, working tree clean. This run replaces the evidence of 21f6596 (attempt 3), which failed only on `openspec validate stage-roles --strict`; 8d07aa0 added to the delta `openspec/changes/stage-roles/specs/roadmap-coordination/spec.md` main's scenario "Two changes at their grill, each in its own session" and main's new text of the requirement. Every gate below was re-run at this commit (nothing carried over), with `TMPDIR=/var/tmp` and `GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` for the hook suites. `git diff --stat 21f6596..HEAD` shows only `openspec/` files (the delta spec and this evidence). No PR comment posted, no screenshots: the change has no UI surface and the proof is text.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles flow" --test-name-pattern="^stage-roles roles" --test-name-pattern="^flow-check" --test-name-pattern="^conduct" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 516 tests, 516 pass, 0 fail |
| 1.10 | `diff -r plugins/openspec/schemas openspec/schemas` | pass: exit 0, both schema copies identical |
| 1.10 | `python3 scripts/check.py` | pass: all checks passed |
| 1.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 2.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" --test-name-pattern="^ship-change" --test-name-pattern="^format" --test-name-pattern="^openspec-setup" --test-name-pattern="^README" plugins/openspec/hooks/guard.test.mjs` | pass: 454 tests, 454 pass, 0 fail |
| 2.10 | `python3 scripts/check.py` | pass: all checks passed |
| 2.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 3.5 | `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 79 tests, 78 pass, 0 fail, 1 skipped |
| 3.5 | `python3 scripts/check.py` | pass: all checks passed |
| 4.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite, 1512 tests, 1512 pass, 0 fail, 0 skipped |
| 4.5 | `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` | pass: 79 tests, 78 pass, 0 fail, 1 skipped |
| 4.5 | `python3 scripts/check.py` | pass: all checks passed |
| 4.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 4.5 | `openspec validate stage-roles --strict` | pass: Change 'stage-roles' is valid, exit 0 |
| 4.5 | `command claude plugin validate .` | pass: Validation passed |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | carried-items-split | `openspec/roadmap.md` line 83 lists `stage-roles` with the five roles only; line 86 lists `coordinator-loop-fixes (after: stage-roles)` with the carried items of the three retros. Read at this commit. The `stage-roles docs` roadmap-split test passes in the full suite. | pass |
| AC-2 | mockup-drawn-when-ui | `plugins/core/agents/screen-designer.md` and `plugins/core/skills/screen-mockup/SKILL.md` exist; `plugins/openspec/schemas/devkit/flow.json` stage ids include `mockup`; the `stage-roles flow`, `stage-roles roles` and `stage-roles loop` tests pass (gates 1.10, 2.10, full suite 1512/1512). | pass |
| AC-3 | mockup-skipped-without-ui | The `stage-roles flow` rule tests for the `ui` flag (not applying without `ui`) pass in gate 1.10 and the full suite. | pass |
| AC-4 | mockup-owner-approval | The owner-ceiling and mock-up approval tests (`stage-roles flow`, `stage-roles gates`, `stage-roles loop`) pass in gate 2.10 and the full suite. | pass |
| AC-5 | decisions-always-analysed | `plugins/core/agents/adr-author.md` and `plugins/core/skills/adr-authoring/SKILL.md` exist; `devkit` `flow.json` declares `decisions`; the related tests pass in gates 1.10, 2.10 and the full suite. | pass |
| AC-6 | adrs-accepted-on-approval | The approval-writer tests (`stage-roles` writers) pass in gate 2.10 and the full suite. | pass |
| AC-7 | early-stages-stale-readiness | The `staleAfter` tests by `mockup.md` and by `decisions.md` pass in gate 1.10 and the full suite. | pass |
| AC-8 | test-config-declared | The `openspec-setup` tests and the `readTestSettings` tests (`devkit.tests` block: unit, coverage command and target, e2e) pass in gates 1.10 and 2.10. | pass |
| AC-9 | unit-tests-stage | `plugins/core/agents/test-runner.md` exists; stage `unit-tests` is declared in both `flow.json` files with no `shipped` key; the stage tests pass in 1.10 and the full suite. | pass |
| AC-10 | e2e-stage | `plugins/core/agents/e2e-tester.md` and `plugins/core/skills/e2e-testing/SKILL.md` exist; stage `e2e-tests` is declared in both `flow.json` files; the conditional-stage tests pass in 1.10 and the full suite. | pass |
| AC-11 | demonstration-as-text | `plugins/core/agents/pr-verifier.md` line 57 states the per-criterion text proof form ("no image") and line 81 lists taking a screenshot, keeping an image and posting a pull-request comment as forbidden; the `deliver-check` tests pass in the full suite. This file is itself written in that form. | pass |
| AC-12 | lite-runs-tests-only | `plugins/openspec/schemas/devkit-lite/flow.json` stage ids at this commit: open, requirements, proposal, specs, tasks, implementation, unit-tests, e2e-tests, evidence, review, delivery, retro; no `mockup`, no `decisions`. | pass |
| AC-13 | no-stage-goes-back | The tests for stages arriving after their point (`mockup` and `decisions` past `proposal.md`; `unit-tests` and `e2e-tests` past `evidence.md`) pass in gate 1.10 and the full suite. | pass |
| AC-14 | compozy-driver-runs-new-stages | `templates/loops/openspec-change/loop.yaml` and the `design`, `tech-lead` and `qa` role shells under `plugins/compozy/skills/compozy-setup/templates/agents/` name `screen-designer`, `adr-author`, `test-runner` and `e2e-tester`; the `stage-roles kit` tests, including "the kit still ships exactly four shells", pass in the kit suite (78 pass, 1 skipped). | pass |
| AC-15 | roles-doc-current | `docs/roles.md` has sections `screen-designer` (line 51), `adr-author` (59), `test-runner` (91) and `e2e-tester` (99), each with a "Played today by" line naming the `devkit-core` agent; line 53 says `screen-designer` runs only when the grill flags `ui`. `docs/coordination-design.md` lines 167, 168, 173, 174 and 175 (D-4 rows 3, 4, 9, 10, 11) are marked built ("built, round 16"). The `stage-roles roles` and `stage-roles docs` pins pass. | pass |
| AC-16 | checks-green | All gates re-run at this commit and green: full hook suite 1512/1512, gate 1.10 suite 516/516, gate 2.10 suite 454/454, kit tests 78 pass and 1 skipped, `check.py`, `gen-catalog.py --check`, `diff -r` of the two schema copies, `openspec validate stage-roles --strict` (exit 0), `claude plugin validate .`. Versions: marketplace 0.26.0, devkit-core 0.10.0, devkit-openspec 0.22.0, devkit-compozy 0.3.0 (unchanged since 21f6596). | pass |
