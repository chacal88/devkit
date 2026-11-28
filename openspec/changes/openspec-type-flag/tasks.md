<!-- devkit-stage tasks result=passed attempt=1 commit=c055e55abb97096383583ece9efba9250a4d3e1c -->
# Tasks

Change: `openspec-type-flag` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `design.md`, `specs/openspec-cli/spec.md`). Plan base: `c055e55`.

Work only in this change's worktree, on its branch. `design.md` fixes every edit (D-1 to D-6), so the
implementer makes no design choice. No hook, no `flow.json` and no template stage header changes. No
existing test is edited (design D-4, "Existing tests"). The CompozyOS agents and the `openspec/schemas/`
copies are written by their scripts (design D-2), never by hand. No task bumps a version, edits a
`CHANGELOG.md` line or a CI pin, or writes an ADR: `release.md` carries the release (ADR 0034). Every new
test's name starts `openspec-type-flag AC-<n> `. Leave no scratch file in the tree, and end every task with
`git status --short`.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. The `--own-files` selection of this change holds several slow
files. Run it as a background command of the tool, never with a shell `&`, with no other suite running on
the machine, and check the free disk space (`df -h /`) first.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `every-run-passes-type` | 2.1, 2.2, 2.3, 2.4, 2.5, 4.4 |
| AC-2 | `same-name-proof` | 2.1, 2.5, 4.4 |
| AC-3 | `bare-form-refused` | 3.1, 3.2, 3.3, 3.4, 4.1, 4.4 |

## 1. Setup

- [x] 1.1 Baseline on the plan base, before any edit. Run `df -h /`, `openspec --version`,
  `python3 scripts/check.py`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check` and
  `diff -rq plugins/compozy/kit/templates/agents .compozy/agents`. Check: at least 10 GB free;
  `2.0.0`; `all checks passed`; `21 CompozyOS agents are up to date`; no diff output. If any of them differs,
  stop and report it before task 2.1.

## 2. The texts (phase 1: devkit-core, devkit-openspec, devkit-compozy)

- [x] 2.1 Test first. Create `plugins/openspec/hooks/validate-type.test.mjs` with its header comment, the
  helpers `REPO`, `TYPED` and `TYPED_NI`, the scratch project of T-11, and the tests T-10 (AC-1) and T-11
  (AC-2) of design D-4. In the same commit, edit `scripts/test-map.json` as design D-5 states (five lists
  gain the new file, and three new keys). Check:
  `node scripts/test-suite.mjs plugins/openspec/hooks/validate-type.test.mjs` fails T-10 on the first bare
  line of D-1 and passes T-11. `node scripts/test-suite.mjs --test-name-pattern="^selective-tests-by-map-2 AC-9 AC-2 T-16"`
  passes, so the map has no problem.
- [x] 2.2 devkit-core texts. Edit the D-1 rows of `plugins/core/agents/plan-readiness-reviewer.md`,
  `plugins/core/agents/change-planner.md` (two lines), `plugins/core/skills/plan-readiness-review/SKILL.md`
  and `plugins/core/skills/review-change/SKILL.md`, as the table states. Check: `git diff --numstat` gives
  `1 1` for each file but `change-planner.md` (`2 2`). The file run of 2.1 now fails T-10 only on
  `plugins/openspec/` files.
- [x] 2.3 devkit-openspec texts and the schema copies. Edit the D-1 rows of
  `plugins/openspec/agents/openspec-validator.md` (lines 18 and 34),
  `plugins/openspec/schemas/devkit/schema.yaml` (four `Gate:` lines) and
  `plugins/openspec/schemas/devkit-lite/schema.yaml` (three). Then run D-2 step 1,
  `bash plugins/openspec/skills/devkit/scripts/install-schemas.sh .`. Check:
  `cmp plugins/openspec/schemas/devkit/schema.yaml openspec/schemas/devkit/schema.yaml` and the same for
  `devkit-lite` exit 0. `openspec schema validate devkit` and `openspec schema validate devkit-lite` print
  `is valid`. The file run of 2.1 passes T-10 and T-11. `git status --short` shows no other file under
  `openspec/schemas/`.
- [x] 2.4 devkit-compozy copies. Run D-2 step 2, `node plugins/compozy/kit/scripts/gen-agents.mjs`, then
  step 3, `node plugins/compozy/kit/scripts/install-kit.mjs .`. Check: `gen-agents.mjs --check` exits 0, and
  `diff -r plugins/compozy/kit/templates/agents .compozy/agents` prints nothing. The new paths of
  `git status --short` are exactly
  `plugins/compozy/kit/templates/agents/{change-planner,plan-readiness-reviewer,openspec-validator}/AGENT.md`,
  `.compozy/agents/{change-planner,plan-readiness-reviewer,openspec-validator}/AGENT.md` and
  `.compozy/kit-manifest.json`. If install-kit reports any other file, stop and report it (design D-2).
- [x] 2.5 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py && node plugins/compozy/kit/scripts/gen-agents.mjs --check` green; covers AC-1 and AC-2.

## 3. The repository check (phase 2: repository)

- [x] 3.1 Test first. Add T-1 to T-9 of design D-4 to `plugins/openspec/hooks/validate-type.test.mjs`, with
  the helpers `CHECK_PY`, `lint`, `agent`, `skill` and `refused`. Check:
  `node scripts/test-suite.mjs plugins/openspec/hooks/validate-type.test.mjs` fails exactly T-1, T-2, T-3
  and T-4 (each gets code 0 where it expects 1) and passes T-5 to T-11.
- [x] 3.2 The check. In `scripts/check.py`, add `check_validate_type()` after `check_install_scope()`, call
  it from `main()` right after `check_install_scope()`, and add the docstring bullet, all as design D-3
  states. Its comment names the two gaps D-3 accepts: a four-backtick fence, and a command split over two lines. Check:
  the file run of 3.1 passes all eleven tests, and `python3 scripts/check.py` prints `all checks passed`.
- [x] 3.3 Documentation. Add the `CONTRIBUTING.md` sentence of design D-3 at the end of the paragraph
  that states the `t.test(` rule. Check: `grep -c "names an id without" CONTRIBUTING.md` prints `1`, and
  `python3 scripts/check.py` (links and language) prints `all checks passed`.
- [x] 3.4 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py && node plugins/compozy/kit/scripts/gen-agents.mjs --check` green; covers AC-3.

## 4. Validation

- [x] 4.1 AC-3's red proof on the plan base, for the evidence. Make a scratch worktree with
  `git worktree add --detach <session scratch folder>/base c055e55`. Copy this branch's `scripts/check.py`
  over the copy there, and run `python3 scripts/check.py` inside it. Check: it exits 1. Its lines that end
  `without --type change; a change and a spec of one id are ambiguous` are exactly the 31 `file:line` listed
  under "What was measured at plan time" in design.md: the 14 source lines, the 7 lines of the
  `openspec/schemas/` copies, the 5 lines of the kit templates and the 5 of `.compozy/agents/`. Then run `git worktree remove --force` on that folder;
  `git worktree list` no longer shows it.
- [x] 4.2 The repository's other checks. Run `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`,
  `openspec schema validate devkit`, `openspec schema validate devkit-lite` and
  `openspec validate openspec-type-flag --type change --strict`. Check: each exits 0, and
  `gen-catalog.py --check` leaves no diff.
- [x] 4.3 The new file under CI's branch variables, before the first push. Run
  `env GITHUB_HEAD_REF=openspec-type-flag GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/validate-type.test.mjs`.
  Check: exit 0, with 11 tests passed.
- [x] 4.4 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py && node plugins/compozy/kit/scripts/gen-agents.mjs --check` green; covers AC-1, AC-2 and AC-3.

## Workflow follow-up

- CI's `check` job passes on the pull request. Its step "Names, descriptions, links, language" runs the new
  check, the CI half of AC-3; the evidence cites the run.
- At the merge, the delivery writes the versions and the changelog entry from `release.md`
  (devkit-core, devkit-openspec and devkit-compozy, patch each).
