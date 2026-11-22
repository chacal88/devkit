<!-- devkit-stage tasks result=passed attempt=4 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Tasks

Change: `stage-roles` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every key, rule, message, text, file and test
name is in `design.md`: D-1 the declarations, D-2 the checker, D-3 the test settings, D-4 the loop,
D-5 the owner gates, D-6 the writers, D-7 the roles, D-8 the kit, D-9 the documents and the roadmap,
D-10 the release, D-11 the tests. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test's name starts `stage-roles ` and the area word D-11 gives it. Every new
hook test takes its env from its file's existing fixtures, which blank `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`.
Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI
does. The tests need the `openspec` CLI 2.x on `PATH`. The whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes) runs once, in 4.5, as a
background command. The marketplace check is written `command claude plugin validate .`, so that a
shell function named `claude` is skipped.

Test first in every phase. The phase's first task writes its tests, runs them on the code as the
phase found it and saves the output, as printed, under `openspec/changes/stage-roles/proof/`. That
run is the task's check, never a gate. An existing test is changed only where `design.md` D-11 names
it (T-1 to T-11), in the task that changes its rule, with a comment above the changed assertion naming
its invariant; a test that fails outside that table stops the phase with `Outcome: failure` naming
it. Both copies of each schema (`plugins/openspec/schemas/` and `openspec/schemas/`) change together.
Leave no backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `carried-items-split` | 4.1, 4.2, 4.5 |
| AC-2 | `mockup-drawn-when-ui` | 1.1, 1.2, 1.3, 1.6, 2.1, 2.2, 2.6 |
| AC-3 | `mockup-skipped-without-ui` | 1.1, 1.3, 2.1, 2.2 |
| AC-4 | `mockup-owner-approval` | 1.1, 1.3, 2.1, 2.2, 2.6, 2.7 |
| AC-5 | `decisions-always-analysed` | 1.1, 1.2, 1.6, 2.1, 2.2 |
| AC-6 | `adrs-accepted-on-approval` | 2.1, 2.3, 2.7 |
| AC-7 | `early-stages-stale-readiness` | 1.1, 1.2, 1.3 |
| AC-8 | `test-config-declared` | 1.1, 1.3, 2.1, 2.2, 2.8 |
| AC-9 | `unit-tests-stage` | 1.1, 1.2, 1.3, 1.6, 2.1, 2.2, 2.5 |
| AC-10 | `e2e-stage` | 1.1, 1.2, 1.3, 1.6, 2.1, 2.2, 2.5 |
| AC-11 | `demonstration-as-text` | 1.1, 1.2, 1.7, 2.7 |
| AC-12 | `lite-runs-tests-only` | 1.1, 1.2 |
| AC-13 | `no-stage-goes-back` | 1.1, 1.3, 1.4 |
| AC-14 | `compozy-driver-runs-new-stages` | 3.1, 3.2, 3.3, 3.4 |
| AC-15 | `roles-doc-current` | 1.1, 1.8, 4.1, 4.3 |
| AC-16 | `checks-green` | 1.10, 2.10, 3.5, 4.4, 4.5 |

## 1. The four stages ship: declarations, checker and roles (AC-2 to AC-5, AC-7 to AC-13, AC-15)

One phase: once a stage drops `"shipped": false`, the agent-skills test and the PACKS test of
`change-loop.test.mjs` need its agent file, `PACKS` and `docs/roles.md` in the same run (design,
Implementation plan).

- [x] 1.1 Write the `stage-roles flow` and `stage-roles roles` tests of `design.md` D-11 (spec
  `change-stages`, every ADDED and MODIFIED scenario; spec `stage-deliverables`, the file forms the
  agents and templates state): in `plugins/openspec/hooks/flow-check.test.mjs` the declaration
  checks, rules (2) to (6) of D-2 each on and off, a file winning over each condition, the flags
  line (present, missing, grill skipped), `readTestSettings` (the D-3 cases), the owner ceiling at
  attempts 1 and 3 with its readout line in both languages, `staleAfter` by `mockup.md` and by
  `decisions.md`, both shipped declarations against D-1, the lite status through `schemaProject`;
  in `plugins/openspec/hooks/conduct-check.test.mjs` `planArtifactsOf` with and without
  `proposal.md`; in `plugins/openspec/hooks/change-loop.test.mjs` the `stage-roles roles` pins of
  the four agents, the three skills, `pr-verifier.md`, `change-planner.md` and the AC-15 lines of
  `docs/roles.md`. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles flow" --test-name-pattern="^stage-roles roles" plugins/openspec/hooks/guard.test.mjs`
  on the unchanged code and save its output to `proof/red-1.txt`. Check: the file shows the
  declaration, rule, owner-ceiling, settings and agent-pin tests failing.
- [x] 1.2 Change the declarations, `schema.yaml` instructions and templates of both schemas in both
  copies as D-1 says: the four stages' keys, `readiness`'s `staleAfter`, no `shipped`, the
  `mockup` skills; remove `mockup` and `decisions` from `devkit-lite` (`flow.json`, `schema.yaml`,
  the two templates); the instruction and template texts of D-1, `evidence` included. In the same
  task, change T-1 (`LITE_STAGES`). Check: `diff -r plugins/openspec/schemas openspec/schemas`
  prints nothing, and the `stage-roles flow` declaration tests and "flow-check schema:" tests pass.
- [x] 1.3 In `plugins/openspec/hooks/flow-check.mjs`: the `STAGE_KEYS` and `readFlowFile` checks,
  the `flags` and `settings` facts in `collectFlow`, `classificationFlags` and `plainValue` moved
  in (exported), `readTestSettings`, the rule order of `artifactState`, the owner ceiling in
  `artifactState`, `computeFlow` and `situation`, and the five reason codes of D-2 in both
  languages; `plugins/openspec/hooks/change-loop.mjs` imports `classificationFlags` and
  `plainValue` from it. In the same task, change T-2, T-3 and T-4 in
  `plugins/openspec/hooks/flow-check.test.mjs`; T-8 there too (in `SAMPLE_PT` and `SAMPLE_EN` the
  mock-up and decisions lines name the proposal and the unit-tests and E2E lines name the
  demonstration, with the `past-point` text of D-2); and T-9 in
  `plugins/openspec/hooks/roadmap-loop.test.mjs` (`LK_PLAN` gains `decisions: 'decisions.md'`,
  `lkProject`'s default `have` is `['requirements', 'decisions']`). Check: every
  `stage-roles flow` test and every "flow-check" test passes, "flow-check readout: the sample
  change prints the approved text" included, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop lock" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with its 34 tests passing.
- [x] 1.4 In `plugins/openspec/hooks/conduct-check.mjs`, `planArtifactsOf` as D-2 says (the
  change's folder passed in). In the same task, change T-5. Check: the `stage-roles flow`
  conduct-check tests and every "conduct" test pass.
- [x] 1.5 In `plugins/openspec/hooks/change-loop.mjs`, add the four roles to `AGENT` and to
  `PACKS` (D-4, Agents). In the same task, change T-7 in `change-loop.test.mjs`. Check: the
  "change-loop" tests that T-7 names pass.
- [x] 1.6 Write `plugins/core/agents/screen-designer.md`, `adr-author.md`, `test-runner.md` and
  `e2e-tester.md`, and `plugins/core/skills/screen-mockup/SKILL.md`, `adr-authoring/SKILL.md` and
  `e2e-testing/SKILL.md`, with the frontmatter, Outcome lines, Never lists and method of D-7 and
  the file forms of D-1. Check: "change-loop skills: every shipped stage agent declares its stage's
  skills" and the `stage-roles roles` agent and skill tests pass, and `python3 scripts/check.py`
  passes.
- [x] 1.7 Change `plugins/core/agents/pr-verifier.md`, `plugins/core/agents/change-planner.md` and
  `plugins/core/agents/code-quality-reviewer.md` as D-7 says. Check: the `stage-roles roles`
  verifier and planner tests pass, and `grep -n -i "screenshot" plugins/core/agents/pr-verifier.md`
  prints nothing.
- [x] 1.8 Update `docs/roles.md` (D-9: the four sections, `pr-verifier`'s Delivers) and
  `docs/openspec-flow.md` (D-9: the artifact rows, the rule paragraph, the `devkit-lite`
  paragraph, the "Test settings" paragraph with the D-3 block, the bounded rerun of the risk
  table). Check: "change-loop lock agent: the accepted packs are the ones docs/roles.md names", the
  `stage-roles roles` roles-doc test and `python3 scripts/check.py` pass.
- [x] 1.9 Regenerate the catalog: `python3 scripts/gen-catalog.py`. Check:
  `python3 scripts/gen-catalog.py --check` exits 0 and `docs/catalog.md` lists the four agents and
  the three skills.
- [x] 1.10 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles flow" --test-name-pattern="^stage-roles roles" --test-name-pattern="^flow-check" --test-name-pattern="^conduct" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs && diff -r plugins/openspec/schemas openspec/schemas && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green; covers AC-2, AC-3, AC-5, AC-7, AC-9, AC-10 (the checker and the roles), AC-11 (the verifier's text), AC-12, AC-13, AC-15 (`docs/roles.md`), and AC-16 for this phase.

## 2. The loop, the owner gates, the writers and the setup (AC-2 to AC-6, AC-8 to AC-11)

- [x] 2.1 Write the `stage-roles loop`, `stage-roles gates`, `stage-roles guard` and
  `stage-roles setup` tests of D-11 (spec `change-coordination`, every ADDED and MODIFIED
  scenario; spec `roadmap-coordination`; spec `file-writers`, every scenario; spec
  `project-setup`): `loop` and `gates` in `plugins/openspec/hooks/change-loop.test.mjs` (the
  `gateOf` case in `plugins/openspec/hooks/roadmap-loop.test.mjs`), `guard` in
  `plugins/openspec/hooks/guard.test.mjs`, `setup` in `guard.test.mjs` next to "openspec-setup
  SKILL.md teaches the per-project opt-in". One test per guard condition and per label, the
  negative ones included, as D-11 lists them. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles loop" --test-name-pattern="^stage-roles gates" --test-name-pattern="^stage-roles guard" --test-name-pattern="^stage-roles setup" plugins/openspec/hooks/guard.test.mjs`
  on the code as phase 1 left it and save its output to `proof/red-2.txt`. The `ship-change`
  `verify` row test is written here as a `gates` test (D-11), not in phase 1, since its edit is
  task 2.7. Check: the file shows the test-stage hand-off, `waiting-mockup`, `accept-decisions`,
  the `verify` row, the two writer tests and the setup pins failing.
  Added at attempt 4, and the only part of this task left to do: in
  `plugins/openspec/hooks/change-loop.test.mjs`, next to "stage-roles loop: no accept-decisions
  step while the approval is not current, with nothing proposed, or with no records", the new test
  "stage-roles loop: no accept-decisions step on the archive branch, even with a current approval
  and a proposed record" (D-4, D-11; spec `change-coordination`, scenario "The change is being
  archived"). It is a new test, not a T row; `change-loop.mjs:523` already holds the clause, so it
  passes when written, and `proof/red-2.txt` is kept as it is, not run again. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles loop: no accept-decisions step on the archive branch" plugins/openspec/hooks/guard.test.mjs`
  passes.
- [x] 2.2 In `plugins/openspec/hooks/change-loop.mjs`: the plan-part briefs, the `owner-changes`
  branch and the `waiting-mockup` end; the build part's `TEST_STAGES` hand-off and `fix-tests`;
  the four messages of D-4 in both languages; `readDevkitSettings` appending the tests' `unknown`
  entries; `owner-changes` in `UNDELIVERED`. Check: the `stage-roles loop` hand-off, message,
  setting and lock tests and every "change-loop" test pass.
- [x] 2.3 In `plugins/openspec/hooks/change-loop.mjs`: `decisionRecords`, the `decisions` fact of
  `nextAction`, the `accept-decisions` step of `decide`, and the `accept-decisions` subcommand of
  D-4 with its refusals and its `USAGE` line. Check: every `stage-roles loop` accept test passes,
  including the refusal tests that compare the tree before and after.
- [x] 2.4 In `plugins/openspec/hooks/roadmap-loop.mjs`, `GATE_OF_WHY` gains `waiting-mockup`.
  In the same task, change T-10 in `plugins/openspec/hooks/roadmap-loop.test.mjs` (the `expected`
  map of "roadmap-loop replies: every owner wait has a gate" gains `'waiting-mockup': 'mockup'`).
  Check: "roadmap-loop replies: every owner wait has a gate" and the `stage-roles loop` `gateOf`
  test pass.
- [x] 2.5 In `plugins/openspec/hooks/guard.mjs`, `isDecisionRecord`, `isTestFile` (exported) and
  their placement in `writeViolation` (D-6); update the role list in the file's header comment.
  Check: every `stage-roles guard` test passes and every existing guard edit test passes.
- [x] 2.6 In `plugins/openspec/skills/devkit/SKILL.md`: the `description:` owner gates, "Owner
  gates" naming the mock-up and its row, the Loop's `session` item naming `accept-decisions` and
  its declared end (D-5); then `python3 scripts/gen-catalog.py`. Check: the `stage-roles gates`
  skill test passes and `python3 scripts/gen-catalog.py --check` exits 0.
- [x] 2.7 In `plugins/openspec/skills/ship-change/SKILL.md`: the `stop-mockup-approval` row after
  `stop-plan-approval`, the `stop-plan-approval` summary and ending, and the `verify` row (D-5,
  D-7). Check: the `stage-roles gates` row tests, "ship-change SKILL.md pins the stop-plan-approval
  row" and "format: ship-change names every next.step the checker can return" pass.
- [x] 2.8 In `plugins/openspec/skills/openspec-setup/SKILL.md` step 5 and
  `plugins/openspec/skills/openspec-setup/templates/config.yaml`, the text and commented block of
  D-3. Check: the `stage-roles setup` tests pass and `python3 scripts/check.py` passes.
- [x] 2.9 In `docs/openspec-flow.md`, "The change coordinator" section's "The loop." paragraph,
  and in `plugins/openspec/README.md`, the `hooks/change-loop.mjs` row, as D-9 says (the test
  stages from `flow-check`, the mock-up wait, `accept-decisions`). Check: `python3 scripts/check.py`
  passes and "README and the pack README describe how one change runs, with no cron" passes.
- [x] 2.10 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" --test-name-pattern="^ship-change" --test-name-pattern="^format" --test-name-pattern="^openspec-setup" --test-name-pattern="^README" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green; covers AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10 (the loop and the writers), AC-11 (the `verify` row), and AC-16 for this phase.

## 3. The CompozyOS kit (AC-14)

- [x] 3.1 Write the `stage-roles kit` tests of D-11 in
  `plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs` (each shell names its agent of
  D-8, still four shells) and `loop-template.test.mjs` (the design, review and implement-review
  prompts), spec `compozy-kit-setup`. Run
  `node --test --test-name-pattern="^stage-roles kit" plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs`
  on the unchanged templates and save its output to `proof/red-3.txt`. Check: the file shows the
  shell and prompt tests failing.
- [x] 3.2 Change the four shells and `loops/openspec-change/loop.yaml` under
  `plugins/compozy/skills/compozy-setup/templates/` as D-8 says, the `implement` node's review
  prompt with D-8's exact list of files. In the same task, change T-11 in
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs`. Check: the `stage-roles kit`
  tests, every existing test of `role-shells.test.mjs` and `loop-template.test.mjs`, and "field-fixes
  8 grill: the review prompt names the requirements and its open questions, and the approval node
  shows the plan's open questions" pass.
- [x] 3.3 Re-install this repository's kit:
  `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .`. Check: it reports
  `update` or `same` for every file and `edited` for none, and `adoption.test.mjs` passes.
- [x] 3.4 Update `docs/compozy-kit.md`, `plugins/compozy/README.md` and `.compozy/README.md`'s
  template (`plugins/compozy/skills/compozy-setup/templates/README.md`, then re-run 3.3) with the
  shells' new work (D-9). Check: `python3 scripts/check.py` and `adoption.test.mjs` pass.
- [x] 3.5 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && python3 scripts/check.py` green; covers AC-14, and AC-16 for the kit.

## 4. The design page, the roadmap, the release and the whole suite (AC-1, AC-15, AC-16)

- [x] 4.1 Write the `stage-roles docs` tests of D-11 in `plugins/openspec/hooks/change-loop.test.mjs`:
  D-4 rows 3, 4, 9, 10 and 11 marked built, the D-8 field names, ADR 0014 and the two Notes (D-9,
  D-12), and the roadmap split read with `guard.mjs#parseRoadmap` against `git show 2300f84:openspec/roadmap.md` (every
  carried sentence on the new line, the `stage-roles` line holding none, `after: stage-roles`). Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-roles docs" plugins/openspec/hooks/guard.test.mjs`
  and save its output to `proof/red-4.txt`. Check: the file shows every `stage-roles docs` test
  failing.
- [x] 4.2 Split the roadmap line in `openspec/roadmap.md` and add round 16b as D-9 says, the
  carried text copied verbatim. Check: the `stage-roles docs` roadmap test passes.
- [x] 4.3 Write `docs/adr/0014-stage-roles-write-their-own-files.md` from D-12, its `Accepted by:`
  line filled from `approval.md` (its `- Date:` and `- Owner's words:`); add the `Amended by` line
  and the dated Note to ADR 0010 and ADR 0011 and the ADR line of `openspec/config.yaml` (D-9);
  update `docs/coordination-design.md` (D-4 rows, the mock-up paragraph, the Tense paragraph, D-8's
  field names and example), `plugins/core/README.md` and `plugins/openspec/README.md` (D-9). Check: the `stage-roles docs` tests pass, the existing
  "change-loop retire" and roadmap-loop docs tests pass, and `python3 scripts/check.py` passes.
- [x] 4.4 Bump the versions and write the release entry as D-10 says: `plugin.json` of devkit-core,
  devkit-openspec and devkit-compozy, `.claude-plugin/marketplace.json`, `## 0.23.0 — the stage
  roles` in `CHANGELOG.md`, the CI snippet of `docs/openspec-flow.md`; change T-6 in the same task;
  then `python3 scripts/gen-catalog.py`. Check: `python3 scripts/check.py` finds the CHANGELOG entry
  and `python3 scripts/gen-catalog.py --check` exits 0.
- [x] 4.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate stage-roles --strict && command claude plugin validate .` green, the whole suite run once as a background command; covers AC-1, AC-15, AC-16, and every criterion's tests at once.

## Workflow follow-up

- After the merge, tag the merge commit `v0.19.0` and push the tag (`CONTRIBUTING.md`); record it
  in `retro.md`.
- The first `devkit` change after the release (`coordinator-loop-fixes` on the roadmap) runs the
  decisions stage live; the first `ui` change runs the mock-up; record what they show in their
  retros.
