<!-- devkit-stage tasks result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Tasks

Change: `project-setup` · Date: 2026-11-23, revised 2026-11-24 · Owner: Kaue (chacal88) · Base:
the branch after its last merge of `origin/main` (at this revision the merge `f1dcefa`, which brought
`c09860c`: trains 1 to 9, the delivery train on in this repository, the train records
`openspec/trains/<n>.md`, and the archives of `compozy-driver`, `delivery-train`, `stage-models`,
`suite-speed` and `loop-place-and-evidence`; `suite-speed`'s record is
`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`)

Work only in this change's worktree, on its branch. Every rule, name, text and path is in
`design.md`: D-1 the verb, D-2 the driver list, D-3 the block writer, D-4 the kit installer's
finder, D-5 what the step names, D-6 the kit, D-7 the skill text, D-8 the replies, D-9 the history
exemption, D-10 the moves, D-11 the documents, D-12 the siblings, D-13 the tests (T-1 to T-31
changed, N-1 to N-19, B-1 to B-17, K-1 to K-5, P-1 new), D-14 the real run, D-15 the release. The
implementer copies them and makes no design choice. A choice the design does not settle stops the
phase and goes to the owner. The design cites functions, files, headings and test names by name; a
test is found by its name with `grep -rn`, never by a line number.

Every gate is one backticked command, run as written. Each `&&` part runs on its own, no part holds
a `|`, and every gate exits 0 when its phase is done. Tests run only through the suite script,
`node scripts/test-suite.mjs` (ADR file `0026-the-devkit-test-suite-runs-by-file-in-parallel.md`):
a phase gate names its test files as arguments and filters by `--test-name-pattern`, and a file
argument that is not in the suite's folders makes the script exit 2, so every gate also proves that
its files are in the suite. Every test run sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a
pull-request run on CI does, and passes `--concurrency=2`. No gate of this change runs the whole
suite: this repository delivers on a delivery train (`devkit.delivery.train` in
`openspec/config.yaml`, ADR 0022), and the train's departure runs the whole suite
(`node scripts/test-suite.mjs` with no file argument); that run is the whole-suite proof. Gates 2.9
and 7.8 run, instead, every test file this change touches (the touched-file list): the moved setup
tests (`changes-under-way`, `gh-version`, `github-setup`, `install-schemas`, `project-settings`,
`ship-entry`), the moved kit tests (`install-kit`, `adoption`, `gen-agents`, `devkit-kit`,
`loop-templates`), the new `setup-block` and `kit-installer` (gate 7.8 only; phase 4 creates them),
and the hooks suites D-13 names (`guard`, `merge-setup`, `deliver-check`, `deliver-check-cli`,
`deliver-check-archive`, `delivery-models`, `flow-check`, `version-pin`, `change-loop`,
`change-loop-compozy`, `change-loop-remote-state`, `roadmap-loop`, `roadmap-loop-followups`,
`roadmap-loop-upfront`, `project-loop`, `compozy-driver`, `stage-models`, `delivery-train`,
`delivery-train-after`, `test-suite`, and `release-tags`, which reads the ship-change skill task 5.4
edits). Each of those two runs is a background command of the tool, never a shell `&`. Every test run and every real run uses the session's TMPDIR (on the Linux worker
that runs this change, `/var/tmp/devkit-project-setup`); no path of this plan is tied to one
operating system. The tests need the `openspec` CLI 2.x on `PATH`.

Test first in phases 3, 4, 5 and 6: the phase's first task writes its new tests, runs them on the
code as it is, and saves the output, as printed, to
`openspec/changes/project-setup/proof/red-<phase>.txt`. That run is the task's check, never a gate.
N-6, N-7, N-16 and N-19 pin behaviour that holds once their files exist and pass when written. Their
task says so, and they are not in a red file. An existing test changes only where D-13 names it
(T-n). The task names the test's invariant, the layer that owns it and its suite, and so does the
commit message. Leave no backup or scratch file in the tree, and end every task with
`git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `setup-verb` | 3.1, 3.2, 3.3, 3.5, 5.1, 5.2, 5.3, 5.6, 6.6, 7.1, 7.5, 7.6, 7.8 |
| AC-2 | `old-skills-gone` | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.3, 3.4, 3.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.10, 7.8 |
| AC-3 | `block-written` | 4.1, 4.2, 4.5, 7.1, 7.8 |
| AC-4 | `rerun-keeps` | 4.1, 4.2, 4.5, 5.1, 5.2, 5.3, 5.6, 7.2, 7.5, 7.8 |
| AC-5 | `no-checker-copy` | 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.6, 7.1, 7.8 |
| AC-6 | `driver-rule` | 3.1, 3.2, 3.5, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.6, 7.4, 7.5, 7.8 |
| AC-7 | `github-one-by-one` | 4.1, 4.2, 4.5, 5.1, 5.2, 5.4, 5.6, 7.3, 7.8 |
| AC-8 | `old-projects-work` | 5.1, 5.5, 5.6, 7.8 |
| AC-9 | `behaviour-kept` | 2.1, 2.2, 2.3, 2.4, 2.5, 2.9, 7.8 |
| AC-10 | `real-run` | 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8 |

## 1. Setup: the base as the last merge of `main` left it

- [ ] 1.1 Confirm the base as it is: the branch holds its last merge of `origin/main`, `f1dcefa`,
  which brought `c09860c` (trains 1 to 9, the train records `openspec/trains/<n>.md`, and the
  archives of `compozy-driver`, `delivery-train`, `stage-models`, `suite-speed` and
  `loop-place-and-evidence`; D-12, step 1). Run no fetch and no merge here: the next merge is the
  last one before review, which the Workflow follow-up re-checks as the release rule says, and any merge
  before it repeats tasks 6.5 and 6.6. The check names fixed commits, never a moving ref, so a later
  move of `main` does not turn it red. Check: `git merge-base --is-ancestor c09860c HEAD` exits 0,
  and `git status --short` is empty.
- [ ] 1.2 Re-read, on the base, every file `design.md` names from the four siblings.
  From `compozy-driver`: `change-loop.mjs` (`DRIVER_ROUND`, `compozy-kit-missing`),
  `compozy-driver.mjs` (`FIX`), `plugins/compozy/skills/compozy-setup/` (scripts, templates,
  `SKILL.md`), `.github/workflows/ci.yml`, `CLAUDE.md`, `docs/compozy-kit.md`. From `delivery-train`:
  `plugins/openspec/hooks/train-loop.mjs` (the pointer strip in `nextAction`),
  `plugins/openspec/hooks/delivery-train.test.mjs` and `delivery-train-after.test.mjs` (T-30, N-18),
  the `verb-unknown` texts and the verb list of `startMode`, the `## Train` and
  `## On the CompozyOS driver` sections and the frontmatter of `plugins/openspec/skills/devkit/SKILL.md`,
  and the canonical requirement "The devkit command reads its verb" of
  `openspec/specs/change-coordination/spec.md` (the archive of `delivery-train`). From `stage-models`:
  `plugins/openspec/hooks/stage-models.test.mjs` and the `models:` lines of `change-loop.mjs`'s
  settings reader. From `suite-speed`: `scripts/test-suite.mjs` (`SUITE_FOLDERS`, the refusal of a
  test file that imports a test file), `plugins/openspec/hooks/test-suite.test.mjs`, the suite
  paragraph of `CONTRIBUTING.md`, the suite row of `CLAUDE.md` and the `Test suite` step of `ci.yml`.
  From the trains: `devkit.delivery` in `openspec/config.yaml`, the release step of
  `CONTRIBUTING.md` (the CI pins of `docs/openspec-flow.md`, no test edited; ADR 0030), the test
  `change-loop docs: the design records the answers`, the fixtures
  `plugins/openspec/hooks/fixtures/c561553/` (D-9, point 2), the train records
  `openspec/trains/<n>.md` (history, D-9 point 1) and the loop's `merge-check` step of
  `docs/openspec-flow.md` (`post-merge-validate`; the Workflow follow-up). Then run the grep of
  D-13 over every test file of the suite's folders. The siblings' records and versions are read by file name and are not quoted in this plan: this change's record and versions
  take the next free ones on `origin/main` at the last merge before review (tasks 6.7, 6.8). A name or
  path that moved is drift: fix it in `design.md` and `tasks.md` without asking. A text that no
  longer holds the old name or path, or a new file that names one, is added to the task that owns its
  kind (D-8 messages to 3.4, paths to 2.x, docs to 6.x). Check: one commit
  `docs(openspec): re-read of project-setup on the merged tree` that holds only those plan edits, or
  none when nothing moved.
- [ ] 1.3 Create `openspec/changes/project-setup/proof/` with a `README.txt` that lists the files the
  phases will save there (`red-<phase>.txt`, `r1-first-install.txt` to `r6-typed-only.txt`, D-14).
  Check: `test -s openspec/changes/project-setup/proof/README.txt`.
- [ ] 1.4 Gate: `git merge-base --is-ancestor c09860c HEAD && test -d openspec/changes/archive/2026-11-24-compozy-driver && test -d openspec/changes/archive/2026-11-24-delivery-train && test -f plugins/openspec/hooks/compozy-driver.mjs && test -f plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs && test -f scripts/test-suite.mjs && grep -q "const DRIVER_ROUND = { script: 22 };" plugins/openspec/hooks/change-loop.mjs` green; when a part is red, `main` moved under the plan (the base lacks a sibling, or `compozy` is not built): stop for the owner (D-12, step 1). Covers no AC; it is the precondition of every one.

## 2. The setup files move, with no behaviour change (AC-2, AC-9)

- [ ] 2.1 Move `plugins/openspec/skills/openspec-setup/scripts/` (every file, `fixtures/` included)
  to `plugins/openspec/skills/devkit/scripts/`, and `templates/` to
  `plugins/openspec/skills/devkit/templates/`, with `git mv` (D-10). Change the paths of T-4, T-5,
  T-7 (template path only), T-9, T-10, T-11, T-12 and T-13, and the run comment at the top of each
  moved test file. Check: `test ! -e plugins/openspec/skills/openspec-setup/scripts && test -f plugins/openspec/skills/devkit/scripts/install-schemas.sh`
  exits 0. The moved tests run through the suite in task 2.3.
- [ ] 2.2 Move `plugins/compozy/skills/compozy-setup/scripts/` to `plugins/compozy/kit/scripts/` and
  `templates/` to `plugins/compozy/kit/templates/` with `git mv`. Change `PACK_JSON` in
  `install-kit.mjs`; `DEFAULT_ROOT`, `AGENTS_AT` and `SELF` in `gen-agents.mjs`; in the moved tests
  (T-23), the paths, the `test-tmp.mjs` imports, `REPO_ROOT` and `REPO`, the `cwd` of the
  `compozy loop validate` spawn in `loop-templates.test.mjs`, the run comments and every comment that
  names `compozy-setup`; and the `syntax` text of `plugins/compozy/kit/templates/substitutions.json`,
  all as D-10 lists them. Check: `grep -rl compozy-setup plugins/compozy/kit/scripts plugins/compozy/kit/templates/substitutions.json`
  prints nothing.
- [ ] 2.3 The suite's folder list (T-31, D-10). In `scripts/test-suite.mjs`, `SUITE_FOLDERS` names
  `plugins/openspec/skills/devkit/scripts` and `plugins/compozy/kit/scripts` in place of the two
  removed folders, in the same places of the list, with its comment unchanged. In
  `plugins/openspec/hooks/test-suite.test.mjs`, the constants `SETUP` and `COMPOZY_SETUP` name the
  same two folders, and the probe text "only the compozy-setup folder is in the suite" of
  `suite-speed AC-1 the script runs the test files of the four folders and no other` becomes "only
  the kit's scripts folder is in the suite"; every assertion stays as it is. Check:
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs`
  exits 0 (a moved file the script did not list would exit 2), and
  `grep -c "openspec-setup\|compozy-setup" scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
  prints 0 for each file.
- [ ] 2.4 Move the old skill's text into a `## Setup` section of `plugins/openspec/skills/devkit/SKILL.md`,
  placed right after `## Train` and right before `## Roadmap` (D-7; `## Train` stays right after
  `## Waiting on GitHub`). Keep its steps 1 to 8 and their sentences
  as they are, with every path written `<skill-dir>/scripts/...` or `<skill-dir>/templates/...`, and
  its `## Never` items appended to the skill's `## Never` (D-7), with D-7's three exceptions: the old
  title and `## Steps` heading are dropped (no `##` heading but `## Setup`), step 4's
  `change-loop.mjs flow` reference becomes "the `flow` command of `/devkit change`", and step 7's
  `--method <squash|merge|rebase>` becomes `--method <the merge_method answer of step 5>`. Delete
  `plugins/openspec/skills/openspec-setup/SKILL.md` and the folder. Rewrite T-3 as D-13 says, keep
  T-5's slices on the devkit skill, and give T-28 the twelve headings plus `## Setup` (D-13). Check:
  `test ! -e plugins/openspec/skills/openspec-setup` exits 0, `grep -c rebase plugins/openspec/skills/devkit/SKILL.md`
  prints 0, and
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs`
  exits 0 (T-15, T-16 still green with the moved text). T-26, T-28 and T-30's placement and slice
  assertions (`delivery-train docs: the documents follow`) run in gate 2.9.
- [ ] 2.5 Move the procedure of `plugins/compozy/skills/compozy-setup/SKILL.md` (gather the inputs,
  run the installer, the re-run rules) into step 8 `**The CompozyOS kit.**` of the `## Setup`
  section, through `<skill-dir>/scripts/kit-installer.mjs` as D-4 and D-6 say. The finder itself is
  task 4.3. Leave out the `design:` step (D-6). Delete the skill folder. Check:
  `test ! -e plugins/compozy/skills/compozy-setup && test -f plugins/compozy/skills/screen-design/SKILL.md`
  exits 0.
- [ ] 2.6 Generate the kit's agents again with `node plugins/compozy/kit/scripts/gen-agents.mjs`.
  Install this repository's kit again with `node plugins/compozy/kit/scripts/install-kit.mjs .`
  (recorded inputs reused), and change the generator path that `plugins/compozy/kit/templates/README.md`
  names. Check: `node plugins/compozy/kit/scripts/gen-agents.mjs --check` exits 0 and
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/kit/scripts/adoption.test.mjs`
  exits 0.
- [ ] 2.7 Change `.github/workflows/ci.yml` (the `CompozyOS agents are up to date` step and the
  `install-schemas.sh` path of the schema step; the `Test suite` step stays `node scripts/test-suite.mjs`)
  and the agents-check row of `CLAUDE.md` to the new paths. Check:
  `grep -c "plugins/compozy/kit/scripts/gen-agents.mjs --check" .github/workflows/ci.yml CLAUDE.md`
  prints 1 for each file.
- [ ] 2.8 Fix every link and path that names the two removed folders outside the history:
  `CONTRIBUTING.md` (the suite paragraph's folder list and "the CompozyOS kit's five suites", and the
  manual `install-schemas.sh` line), `docs/openspec-flow.md` (the manual setup's `install-schemas.sh`
  path and `templates/config.yaml` link), `docs/compozy-kit.md` (the generator path), and the
  `plugins/openspec/README.md` and `plugins/compozy/README.md` tables. Their prose is phase 6. Then run
  `python3 scripts/gen-catalog.py`. Check: `python3 scripts/check.py` and
  `python3 scripts/gen-catalog.py --check` exit 0, and
  `git grep -lE "skills/(openspec-setup|compozy-setup)/" -- . ":!openspec/changes" ":!openspec/trains" ":!docs/adr" ":!CHANGELOG.md"`
  prints nothing.
- [ ] 2.9 Gate: `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs && node plugins/compozy/kit/scripts/gen-agents.mjs --check && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green, run as a background command of the tool; it runs every file of the touched-file list that exists after phase 2 (the header; `setup-block` and `kit-installer` come in phase 4), and the train's departure runs the whole suite. Covers AC-9 (every moved test passes in its new place, listed by the suite) and AC-2 (the skill folders are gone).

## 3. The verb, the driver list and the messages (AC-1, AC-2, AC-6)

- [ ] 3.1 Write N-1 to N-5 and N-8 in `plugins/openspec/hooks/change-loop.test.mjs`, N-9 in
  `plugins/openspec/hooks/project-loop.test.mjs`, and N-18 in
  `plugins/openspec/hooks/delivery-train.test.mjs` beside `delivery-train P9 N7`. Reach
  `BUILT_DRIVERS`, `SETUP_POINTER` and `withoutSetupPointer` through each file's namespace import or
  a dynamic `import()`, so the red run fails test by test. Apply the T-14, T-18, T-19, T-20, T-22
  changes and T-30's `delivery-train P13` prefixes (D-13). N-8 and T-14 build the old skill names by
  concatenation (D-9). Run
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train.test.mjs`
  on the code as it is. Check: `openspec/changes/project-setup/proof/red-3.txt` holds the run, and
  N-1 to N-5, N-8, N-9 and N-18 fail in it.
- [ ] 3.2 In `plugins/openspec/hooks/change-loop.mjs`, add the `setup` branch of `startMode` and
  the `setup-no-repo` reply in both languages (D-1), and export `BUILT_DRIVERS` (D-2). Check: N-1 to
  N-5 pass.
- [ ] 3.3 Change the replies of D-8 in `change-loop.mjs`: `not-set-up`, `verb-unknown`,
  `design-pack-missing`, `blocked-why.merge-setup`, `blocked-why.merge-setup-missing` and
  `compozy-kit-missing`, in `en` and `pt-BR`; `verb-unknown` lists the six verbs with `setup` right
  after `status` and keeps its `/devkit train` ending (D-7, D-8). Check: N-8, T-14, T-18, T-19, T-20
  and `delivery-train P13: the reply to an unknown verb names /devkit train, in order, in both
  languages` (T-30) pass.
- [ ] 3.4 Change the other texts of D-8: `flow-check.mjs` `schema-without-declaration` (both
  languages), the `FlowUsageError` text of `changeFlow` in `guard.mjs`, `merge-setup.mjs`
  (`SETUP_POINTER` exported, the comment above the ruleset that names `openspec-setup`, and the new
  export `withoutSetupPointer`), the pointer strip of `decideSlice` in `project-loop.mjs` and the one
  of `nextAction` in `train-loop.mjs` (each replaced by `setup.missing.map(withoutSetupPointer)`,
  imported from `merge-setup.mjs`, no regex left; behaviour unchanged), `compozy-driver.mjs`
  `FIX['kit-missing']`, and the header comment and the `- Why:` line of
  `plugins/openspec/skills/devkit/scripts/changes-under-way.mjs`. Update T-7, T-8 and T-17. Check:
  N-9, N-18, T-7, T-8, T-17, T-21, T-22 and `delivery-train P9 N7` pass, and
  `grep -c "run the openspec" plugins/openspec/hooks/train-loop.mjs plugins/openspec/hooks/project-loop.mjs`
  prints 0 for each file.
- [ ] 3.5 Write N-6 and N-7 in `plugins/openspec/hooks/guard.test.mjs`. They pin that `runOf` and
  `roadmapRunOf` end on a typed `/devkit setup` and that `/devkit status` does not end a roadmap
  run. Write N-16 in `plugins/openspec/hooks/change-loop.test.mjs`: `setup` with an
  `openspec/config.yaml` that cannot be read ends with the usage error and exit 3 (D-1). All three
  pass on the base, so they are not in the red file. Check: the three pass.
- [ ] 3.6 Gate: `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^change-loop start" --test-name-pattern="^roadmap-loop start" --test-name-pattern="^project-loop start" --test-name-pattern="^project-loop next: S23" --test-name-pattern="^nextStep row 3a" --test-name-pattern="^mergeSetup" --test-name-pattern="^flow-check AC-7" --test-name-pattern="^compozy-driver readiness" --test-name-pattern="^field-fixes 7 apply" --test-name-pattern="^delivery-train P13" --test-name-pattern="^delivery-train P9 N7" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs` green; covers AC-1 (the verb, typed only), AC-2 (the replies and both pointer strips), AC-6 (the driver list).

## 4. The block writer and the kit finder (AC-3 to AC-7)

- [ ] 4.1 Write B-1 to B-17 in a new `plugins/openspec/skills/devkit/scripts/setup-block.test.mjs`,
  K-1 to K-5 in a new `plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs`, P-1 in
  `plugins/openspec/skills/devkit/scripts/project-settings.test.mjs`, and N-19 in
  `plugins/openspec/hooks/test-suite.test.mjs`. The suite runs the two new files because their folder
  is in `SUITE_FOLDERS` (task 2.3); no file imports them. A test that needs a script this phase adds
  spawns it, so the red run fails test by test. Run
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/hooks/test-suite.test.mjs`.
  Check: `openspec/changes/project-setup/proof/red-4.txt` holds the run, and B-1 to B-17 and K-1 to
  K-5 fail in it. P-1 passes, because `project-settings.mjs` already reports it, and N-19 passes,
  because the two files exist once written; the task says so.
- [ ] 4.2 Write `plugins/openspec/skills/devkit/scripts/setup-block.mjs` as D-3 says: `plan` and
  `apply`, the `missing` rules, the `fill` field, the refusals with exit 3, the usage errors with
  exit 2, the writing rules and the parser decisions, the `delivery.train` entry of `kept` and
  the `delivery` options it narrows. Export `LANGUAGE_TAG` from
  `plugins/openspec/hooks/change-loop.mjs`, unchanged, and import it, with no second copy of the
  regex. It reuses the readers named in D-3's Context and writes no YAML library. Check: B-1 to
  B-17 pass, and `grep -c "A-Za-z]{2,3}" plugins/openspec/skills/devkit/scripts/setup-block.mjs`
  prints 0.
- [ ] 4.3 Write `plugins/openspec/skills/devkit/scripts/kit-installer.mjs` as D-4 says: the sibling,
  then the installed packs by highest version and last path, `--where`, and the pass-through run.
  Check: K-1 to K-5 pass.
- [ ] 4.4 Add `budget` and `design:` as commented examples to
  `plugins/openspec/skills/devkit/templates/config.yaml`, and change its comment that names the
  GitHub step of the old skill (D-8). Keep the heading line and every line of the block a comment.
  Check: T-5 and B-3 pass.
- [ ] 4.5 Gate: `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^stage-roles setup" --test-name-pattern="^format: the config template" plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/test-suite.test.mjs` green; covers AC-3, AC-4, AC-5 (version, packs), AC-6 (driver, kit finder) and AC-7 (ship and `merge_method` questions).

## 5. The Setup section of the devkit skill (AC-1, AC-5 to AC-8)

- [ ] 5.1 Write N-11 to N-15 and N-17 in `plugins/openspec/hooks/guard.test.mjs`, with the N-15 fixture
  `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/` (`config.yaml`, the template's
  bytes at `c1ac8c4` held as a file, and `settings.json` as the old skill wrote it). N-11 pins
  D-7's `## Start` sentence for the `compozy` driver and the `setup` item. Apply T-15's
  `ship`/`merge_method` assertion. Run
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^format: the Setup section" plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs`.
  Check: `openspec/changes/project-setup/proof/red-5.txt` holds the run, and N-11 to N-14, N-17 and
  T-15 fail in it. N-15 passes on the base, because old projects already work; its task says so, and it
  guards the later tasks.
- [ ] 5.2 Rewrite the `## Setup` section of `plugins/openspec/skills/devkit/SKILL.md` as D-7 says.
  Step 5 runs `setup-block.mjs plan`, writes `schema`, `context`, `rules` and `operations` only as
  `fill` names them (with D-7's pinned sentence), asks the `missing` questions with the plan's
  `options`, says `kept` and `driverNotBuilt`, and runs `apply` through the quoted heredoc. The old
  step 5 bullets on `schema`, the `rules` / `operations` merge and `context` are replaced as D-7
  says. Step 2 runs the packs dry run
  first (D-5). Step 7 runs when the mode merges. Step 8 is the kit (D-6). Step 9 reports the version
  and the first command. Keep every sentence D-13 says a test pins. Check: N-12, N-13, N-14, N-17, T-3,
  T-5, T-15 and T-16 pass, and `grep -c rebase plugins/openspec/skills/devkit/SKILL.md` prints 0.
- [ ] 5.3 Change the frontmatter and `## Start` of the same skill as D-7 says: the description
  sentence after the train sentence (kept word for word), the "Use when" list and the argument hint
  with `setup` right after `status` (`| status | setup | train | project [<name>]`), the `setup` and
  `setup-no-repo` modes, and the first item's driver sentence reworded so that `setup` and
  `setup-no-repo` stay in `## Start` on every driver (`## On the CompozyOS driver` is not edited).
  Apply T-29 to `plugins/openspec/hooks/roadmap-loop-followups.test.mjs` and T-30's hint regex to
  `delivery-train docs: the documents follow` in `plugins/openspec/hooks/delivery-train-after.test.mjs`.
  Check: N-11, T-24, T-25, T-29 and `delivery-train docs: the documents follow` (T-30) pass.
- [ ] 5.4 Change the sentence of `plugins/openspec/skills/ship-change/SKILL.md` that names "the
  `openspec-setup` GitHub step" and the `stop-merge-setup` row (D-7). Check:
  `grep -c "openspec-setup" plugins/openspec/skills/ship-change/SKILL.md` prints 0, and
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/release-tags.test.mjs`
  (every test file that reads the ship-change skill, `release-tags 3` included) exits 0.
- [ ] 5.5 Check the skill-wide negatives of T-26 on the new text (no `--lang en`, no unquoted
  heredoc, no `rebase` or `--force` anywhere in the file, no line naming a `change-loop.mjs` call
  without `--lang ${user_config.language}`, nothing of the Roadmap's scheduling tools and no
  session-model tool before `## Roadmap`) and T-28's heading list. Check: N-15 still passes and the
  T-26, T-28 and T-30 tests pass in gate 5.6.
- [ ] 5.6 Gate: `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup " --test-name-pattern="^format: the Setup section" --test-name-pattern="^field-fixes 5 skill" --test-name-pattern="^gh-version 19" --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^project-loop skill" --test-name-pattern="^release-merge-conflict 16" --test-name-pattern="^delivery-train docs" --test-name-pattern="^upfront AC-1 skill" --test-name-pattern="^upfront AC-16 skill" --test-name-pattern="^stage-models AC-9" --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs && python3 scripts/check.py` green; covers AC-1 (the skill, `## Start` on every driver), AC-4 (step 5's `fill` rule and the re-run on the `compozy` driver), AC-5, AC-6 and AC-7 (the step's text) and AC-8.

## 6. Documents, records and release (AC-2)

- [ ] 6.1 Write N-10 in `plugins/openspec/hooks/guard.test.mjs` with the skips of D-9 (history,
  the train records `openspec/trains/` included, the old-setup and `c561553` fixture folders, and the canonical requirement blocks this change's
  delta MODIFIES), its
  needles built by concatenation, and rewrite T-6's quoted literal the same way (D-9, D-13; N-8
  and T-14 were written so in task 3.1). Run it on the tree as it is:
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-2 tree" plugins/openspec/hooks/guard.test.mjs`.
  Check: `openspec/changes/project-setup/proof/red-6.txt` holds the run, and N-10 fails in it, naming
  the files of 6.2 to 6.4 and no line inside a canonical requirement block this change's delta
  MODIFIES, and
  `grep -rlE "openspec-setup|compozy-setup" openspec/changes/project-setup/specs/` prints nothing
  (the ADDED blocks are not skipped after the archive, D-9 point 3).
- [ ] 6.2 Rewrite the prose that names the old skills (D-11): `README.md`, `CONTRIBUTING.md`,
  `plugins/openspec/README.md`, `plugins/compozy/README.md`, `docs/getting-started.md`,
  `docs/openspec-flow.md`, `docs/compozy-kit.md`, `docs/conventions.md`, `.compozy/README.md`
  (through the template and the installer, task 2.6's command), and the descriptions in
  `plugins/compozy/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Keep the suite
  command and the measured time that `CLAUDE.md` and `CONTRIBUTING.md` state as they are (pinned by
  `suite-speed AC-7` and `suite-speed AC-8`). Run `python3 scripts/gen-catalog.py`. Check:
  `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` exit 0, and the `docs sweep`
  and `suite-speed AC-7` tests pass in gate 6.10.
- [ ] 6.3 Edit the Purpose of `openspec/specs/project-setup/spec.md` and
  `openspec/specs/compozy-kit-setup/spec.md` to name `/devkit setup` and the kit installer (D-11).
  Their requirement bodies are not edited: the archive applies the delta to them, and N-10 skips
  exactly the blocks the delta MODIFIES (D-9, point 3). Check: N-10's failure names neither
  Purpose.
- [ ] 6.4 Answer the open point of `docs/coordination-design.md` (D-11). Add the ADR line to
  `context` in `openspec/config.yaml` with the number the record's file name carries; the renumber
  step of the last merge before review (task 6.7) moves it with every other reference.
  Check: the Open points list of `docs/coordination-design.md` holds no "Project setup" bullet, and
  the `change-loop docs: the design records the answers` test passes in gate 6.10.
- [ ] 6.5 The `compozy-kit-setup` delta beside the canonical spec (D-12, step 4). The archive of
  `compozy-driver` is on the base, and the delta already MODIFIES the six canonical requirements that
  name `compozy-setup`, each copied whole with the installer named. On the branch as it is, and again
  after every later merge of `origin/main`, compare each of those six blocks with the canonical one
  in `openspec/specs/compozy-kit-setup/spec.md`: they differ only where the canonical text names
  `compozy-setup`. Where a canonical block moved, write the delta block again from it, with
  `compozy-setup` replaced by "the kit installer" and no other change. Check:
  `openspec validate project-setup --type change --strict` exits 0,
  `grep -c "^### Requirement:" openspec/changes/project-setup/specs/compozy-kit-setup/spec.md` prints
  7 (six MODIFIED, one ADDED), and N-10 passes in gate 6.10.
- [ ] 6.6 The `change-coordination` delta beside the canonical spec (D-12, step 7). The archive of
  `delivery-train` is on the base. On the branch as it is, and again after every later merge of
  `origin/main`, compare the requirements "The devkit command reads its verb" and "The command runs
  only in a project set up for devkit" of `openspec/specs/change-coordination/spec.md` with the
  MODIFIED blocks of `openspec/changes/project-setup/specs/change-coordination/spec.md`: every
  sentence and scenario of each canonical block is in this change's block, which differs from it
  only by `setup` (the verb sentence, the two setup scenarios, `/devkit setups` and `/devkit setup`
  in the unknown-verb scenario, and `/devkit setup` named where the canonical text says "the setup
  command"). Where a canonical block moved, write the block again from it plus `setup`, with no
  other change. Check: `openspec validate project-setup --type change --strict` exits 0,
  `grep -c "#### Scenario: The train verb" openspec/changes/project-setup/specs/change-coordination/spec.md`
  prints 2, and every `#### Scenario:` line of the two canonical requirements is in the delta.
- [ ] 6.7 Only after `approval.md` holds the owner's approval of this plan: add the header line and
  the dated Note of D-11 to `docs/adr/0004-devkit-per-project.md`. The record is the file
  `docs/adr/<n>-one-setup-verb-replaces-the-two-setup-skills.md`: its number `<n>` is the next free
  number on origin/main at the last merge before review, and its file name carries it today. Refer to
  the record by its file name, and write `<n>` in the Note and the header line of D-11 as the number
  that file name carries. The record's title line, its `Number:` line and its `- Status: accepted`
  line are already set on the branch since `09654b7`: this task edits no line of the record, and
  those lines move only with the loop's renumber step (`renumber-adr`). The record's `Accepted by:`
  line is not rewritten after the owner's new approval of this plan, because it names `approval.md`,
  which holds that approval, and the record's decision has not changed since it was accepted (D-11).
  When the last merge before review finds the number taken, the renumber step at that merge renames
  the file with `git mv` and changes every reference to it, the record's title and `Number:` lines
  and the links this task wrote included. Check: the task's commit names no file under `docs/adr/`
  other than `docs/adr/0004-devkit-per-project.md`, and
  `set -- docs/adr/*-one-setup-verb-replaces-the-two-setup-skills.md && test $# -eq 1 && n=${1#docs/adr/} && n=${n%%-*} && grep -q "^# ADR $n: " "$1" && grep -q "^- Number: $n," "$1" && grep -q "^- Status: accepted$" "$1" && grep -q "^- Amended by ADR $n ($n-one-setup-verb-replaces-the-two-setup-skills.md)$" docs/adr/0004-devkit-per-project.md && test "$(grep -c "Note (project-setup" docs/adr/0004-devkit-per-project.md)" = 1`
  exits 0 (it takes `<n>` from the record's file name, so it holds after a renumber).
- [ ] 6.8 Bump devkit-openspec, devkit-compozy and the marketplace, each to the next free minor
  version on `origin/main` at the last merge before review. Use `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/compozy/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Move every CI
  pin of `docs/openspec-flow.md` to `v<the new devkit-openspec version>` and edit no test: the test
  `change-loop docs: the design records the answers` reads the version from the manifest (D-15,
  ADR 0030). Add the `CHANGELOG.md` entry of D-11 and D-15. Install this repository's kit again, so
  the `pack` field of its manifest records the new devkit-compozy version. Check:
  `python3 scripts/check.py` exits 0 (the changelog check), the task's commit touches no test file
  (`change-loop-compozy.test.mjs` keeps only the T-26 and T-28 edits of phases 2 and 5),
  `change-loop docs: the design records the answers` passes in gate 6.10, and
  `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/kit/scripts/adoption.test.mjs`
  exits 0.
- [ ] 6.9 Set the stage headers of `proposal.md`, `design.md`, the three spec files and `tasks.md`
  to the commit of this phase only if a phase changed them, as the stage rule says. Check:
  `openspec validate project-setup --type change --strict` exits 0.
- [ ] 6.10 Gate: `python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate . && openspec validate project-setup --type change --strict && env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-2" --test-name-pattern="^docs sweep" --test-name-pattern="^change-loop docs" --test-name-pattern="^suite-speed AC-7" --test-name-pattern="^suite-speed AC-8" --test-name-pattern="^upfront AC-5 docs" plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/test-suite.test.mjs` green; covers AC-2 (no document names the old skills; the checks pass).

## 7. The real run and the touched-file suite (AC-10, every AC)

Tasks 7.1 to 7.7 are owner-run. The session that conducts this change does them as D-14 says, never
`tdd-implementer`, in scratch projects under the session's TMPDIR (on the Linux worker that runs
this change, `/var/tmp/devkit-project-setup`), outside this repository, with `--plugin-dir` for this
worktree's `plugins/core`, `plugins/openspec` and `plugins/compozy`. Each saves its file under
`openspec/changes/project-setup/proof/`, and the six files are committed before the evidence stage,
so `evidence.md` cites them before the first review round (`CLAUDE.md`; D-14).

- [ ] 7.1 R-1, first install with the kit declined. Check: `proof/r1-first-install.txt` shows the
  questions in order; the schemas, the settings and the block of AC-3 with `release_tag:
  package.json`; no `.compozy/`; `find . -name guard.mjs` empty; the version named.
- [ ] 7.2 R-2, re-run on R-1's project. Check: `proof/r2-rerun.txt` shows two equal
  `shasum -a 256 openspec/config.yaml` lines and no question about the block.
- [ ] 7.3 R-3, `merge` mode in a scratch clone of a GitHub repository the owner administers, every
  item declined. Check: `proof/r3-merge-mode.txt` shows one question per item and the plan run again
  unchanged.
- [ ] 7.4 R-4, kit yes. Check: `proof/r4-kit-yes.txt` shows `.compozy/kit-manifest.json`, the
  installer's per-file lines and `devkit-compozy@devkit` enabled.
- [ ] 7.5 R-5, driver `compozy`, then `/devkit setup` typed again in that project. Check:
  `proof/r5-driver-compozy.txt` shows `claude` and `compozy` offered, `script` absent, the kit
  installed with no kit question, and the re-run on the `compozy` driver running the Setup section
  with no CompozyOS start, no block or kit question and two equal `shasum -a 256 openspec/config.yaml`
  lines.
- [ ] 7.6 R-6, the typed-only part. Check: `proof/r6-typed-only.txt` shows a plain-words request
  that ran no setup and an empty `git status --short`.
- [ ] 7.7 A run that could not happen is recorded in its file with the reason (D-14). Commit the six
  files before the evidence stage. Check: each of the six files exists and is not empty, and
  `git status --short openspec/changes/project-setup/proof` prints nothing.
- [ ] 7.8 Gate: `test -s openspec/changes/project-setup/proof/r1-first-install.txt && test -s openspec/changes/project-setup/proof/r2-rerun.txt && test -s openspec/changes/project-setup/proof/r3-merge-mode.txt && test -s openspec/changes/project-setup/proof/r4-kit-yes.txt && test -s openspec/changes/project-setup/proof/r5-driver-compozy.txt && test -s openspec/changes/project-setup/proof/r6-typed-only.txt && env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs && node plugins/compozy/kit/scripts/gen-agents.mjs --check && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate . && openspec validate project-setup --type change --strict` green, run as a background command of the tool; it runs the whole touched-file list (the header), and the train's departure runs the whole suite, which is the whole-suite proof. Covers AC-1 to AC-10.

## Workflow follow-up

- Merge `origin/main` before the last verify and review, as the release rule says (D-12, step 6).
  That merge becomes the branch's last merge of `origin/main`. After it, repeat task 1.2's re-read,
  tasks 6.5 and 6.6, and the content checks of D-12 step 6 (gate 1.4's checks at the paths phase 2
  left, with the ancestor check naming the `origin/main` commit that merge brought); a red part stops
  the change for the owner. At that merge the record takes its number and the versions are checked
  again as tasks 6.7 and 6.8 say. The loop's `merge-check` step (`post-merge-validate`,
  `docs/openspec-flow.md`, "The loop") runs `openspec validate project-setup --type change --strict`
  on that merge before the evidence; a red check comes back to the planner as a merge defect, and
  the fix copies into the delta any scenario `main` added to a requirement this change modifies
  (tasks 6.5 and 6.6). Under the own-files rule a later merge of `main` that brings none of this
  change's own files stales no evidence or review by itself.
- Delivery: this repository runs the delivery train (`devkit.delivery.train`, ADR 0022). Once the
  change is boarded it never merges `main` for a sibling; the departure joins its head, renumbers
  its release above the train's numbers and resolves the pin lines of `docs/openspec-flow.md`
  (`release-merge.mjs --merge`, D-15). After the train's merge: the train's merge commit is tagged
  `v<the train's version>` when its release changes devkit-openspec's version (this change's own
  version gets no tag), then the retro, then archive and tick `project-setup` in
  `openspec/roadmap.md`.
