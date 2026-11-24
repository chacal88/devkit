<!-- devkit-stage readiness result=failed attempt=5 commit=5f169e6e96597609ab0195783dd7611a614b75b1 -->
# Readiness review: project-setup

Attempt 5, a fresh review of the plan as revised at `5f169e6` (the planner's answer to the six
Mandatory fixes of attempt 4). Reviewed on branch `project-setup`, clean tree. As asked I fetched
nothing and ran no test suite. I judged the plan by reading the merged tree and grepping it.

Checks run: `openspec validate project-setup --type change --strict` is valid.
`python3 scripts/check.py` prints "all checks passed", `python3 scripts/gen-catalog.py --check` exits 0
and `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` says "21 CompozyOS agents
are up to date", all on this tree. `claude plugin validate .` was not run (not executable here), so it is
not counted. The long suite was not run; the caller runs it.

The approval (`approval.md`) records `Readiness: sha256:47f97f2eae4a`, the hash of attempt 3. This
attempt replaces that file and the plan files changed after it, so the approval is stale until the owner
approves the revised plan.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

All six fixes of attempt 4 hold against the merged tree at `f84bc6e` (section 4). The plan is now
coherent with `compozy-driver`, `delivery-train` and `stage-models` as merged. What stops it is a fact
the revision could not have used: the local `origin/main` ref is now `cf34ff2`, one commit ahead of this
branch (`git rev-list --count HEAD..origin/main` prints 1). That commit is the merge of `suite-speed`
(#98, ADR 0026), and it replaces the test layout that the plan's first check, every one of its gates and
its test table stand on. Two Mandatory fixes, M-7 and M-8, both narrow and both inside the plan's scope,
so the verdict is NEEDS-REVISION and not BLOCKED.

## 2. Scope validation
Classification: correct. The problem, the in-scope list, the ten ACs and the non-goals are unchanged and
explicit. M-7 and M-8 add no scope: they move the plan's commands, file names and one wiring file to the
base `main` now holds.

## 3. Proposal review
Problem, goal, three modified capabilities and non-goals are clear. The two stale statements of attempt 4
are fixed: `proposal.md:129-133` gives the sibling versions as read at `f84bc6e` (0.36.0, 0.40.0) and the
Impact list names `train-loop.mjs` and `delivery-train.test.mjs`. One statement is false against the ref
as it stands now: the exit criteria (`proposal.md`, last paragraph) name
`node --test plugins/openspec/hooks/guard.test.mjs` as the hook suite (M-8).

## 4. Design review
Re-derivation of the attempt 4 fixes against the merged tree at `f84bc6e`:

- **M-1 (the `train` verb): fixed.** `change-loop.mjs:1902` reads `['change','roadmap','status','project','train']`
  and `verb-unknown` (`:204`, `:489`) ends with the `/devkit train` clause; D-8's new text lists six verbs
  with `setup` right after `status` and keeps that ending (D-7 names the position once). D-7's hint
  `... | status | setup | train | project [<name>]` keeps the file's `train | project` order
  (`devkit/SKILL.md:4`) and T-24's tail. The description sentence is placed after the train sentence, word
  for word (`delivery-train.test.mjs:2331`). The heading list of T-28 is the real list at
  `change-loop.test.mjs:2472` plus `## Setup` after `## Train`, which keeps `delivery-train.test.mjs:2327`
  true (`## Train` right after `## Waiting on GitHub`). D-13 now has T-18, T-19, T-29 and a T-30 row for
  `delivery-train.test.mjs` (P13 at 2289-2292, the hint at 2330). I re-grepped every test file for
  `openspec-setup`, `compozy-setup` and the old verb texts: every hit is a row of D-13 (the project-loop
  hit at `project-loop.test.mjs:776` is inside T-20's test).
- **M-2 (the delta dropped `train`): fixed.** `specs/change-coordination/spec.md` now MODIFIES "The devkit
  command reads its verb" with `openspec/changes/delivery-train/specs/change-coordination/spec.md`'s
  text plus `setup`: the six-verb sentence, both train scenarios, the unknown-verb scenario with six
  commands, the usage-error scenario unchanged. D-12 step 7 says the two changes overlap and task 6.6
  re-reads the archived block and checks the two train scenarios and every canonical scenario.
- **M-3 (the second pointer strip): fixed.** `train-loop.mjs:552` is a row of D-8 and a clause of task
  3.4 (`withoutSetupPointer`, imported beside `mergeSetup` at `:22`), with N-18 beside `delivery-train P9 N7`
  (`delivery-train.test.mjs:1943`, which asserts `github-setup.mjs --method merge`, kept).
- **M-4 (`setup` on a `compozy` project): fixed.** D-7 rewrites the `## Start` sentence ("... and the mode
  is neither `setup` nor `setup-no-repo`, read the next section ...") and adds the `setup` item "whatever
  the driver"; `## On the CompozyOS driver` is left alone; N-11 pins both; the spec has the scenario "A
  project on the CompozyOS driver" and R-5 re-runs setup on that driver. `startMode` puts
  `settings.driver` in every `out(...)` (`change-loop.mjs:1897`), so the sentence is needed and sufficient.
- **M-5 (literal ADR number): fixed.** `tasks.md` holds no literal ADR number or version outside the
  sentence that reads the siblings "as read at `f84bc6e`" (task 1.2); tasks 1.2, 6.4 and 6.7 word the
  record's number by the project rule and by its file name. The file name still carries 0025, which is
  free on the base of the branch.
- **M-6 (stale setup tasks): partly fixed.** Task 1.1 no longer asks for a merge, and 1.2 gives the merged
  tree, `train-loop.mjs`, `delivery-train.test.mjs`, the `## Train` and `## On the CompozyOS driver`
  sections as its list, and the design header says what was read. But task 1.1's check, and the first
  part of gate 1.4, are the same command, `git merge-base --is-ancestor origin/main HEAD`, and it exits 1
  now (M-7).

Facts that hold at `f84bc6e`, re-derived: `DRIVER_ROUND = { script: 22 }` at `change-loop.mjs:1852`,
`DRIVERS` exported at `:63`, `LANGUAGE_TAG` at `:64` not exported; the `startMode` order (`findRoot` and
`readDevkitSettings`, then `VERB_ROUND`, then the verb list at `:1902`, then `projectGate`) leaves room for
the `setup` branch between the two checks; `readDevkitSettings(root).train.problem` is
`{ kind: 'train-model', model }` (`guard.mjs:194-200`), which is what D-3's `kept` entry reads;
`roadmapRunOf` spares `status` and `train` (`guard.mjs:1243-1254`), as D-1 now says; the substitutions of
D-6 (`__TIMEZONE__` asked, `__SCREEN_MAP__` and `__MOCKUP__` defaulted) match
`templates/substitutions.json`; the skill-wide negatives of the tests (`--lang`, quoted heredoc,
`rebase`, `--force`, the scheduling tools before `## Roadmap`) are not met by the old setup text beyond the
two sentences D-7 already rewords.

Re-derivation that fails, at the base `main` now holds:

- **M-7 and M-8 (the base moved).** `origin/main` is `cf34ff2`: "run the test suite by file in parallel, one
  command (suite-speed) (#98)", dated 2026-11-24 07:17 -0300, on top of `ea482c0`. This branch holds
  `f84bc6e` and `ea482c0`, not `cf34ff2`. Section 6 and section 9 give the consequences.

Smaller (Fix during implementation): D-13 T-28 says "the merged tree's twelve headings with `'## Setup'`"
and then lists thirteen; task 2.2 says thirteen. Say "the twelve headings plus `## Setup`".

## 5. Specs review
- `openspec validate --strict` is valid. Normative language and WHEN/THEN scenarios are present, and every
  outcome row of D-1, D-3, D-5 and D-8 has a scenario (the train reply's pointer strip is covered by "The
  removed setup skills are named nowhere" and pinned by N-18).
- The `change-coordination` block now carries every sentence and scenario of `delivery-train`'s block
  (checked line by line) plus the setup verb, its no-repo case and `/devkit setups`.
- The `compozy-kit-setup` delta is unchanged from attempt 4's check.
- No requirement lives only in a support doc.

## 6. Tasks review
- Order, checkboxes, one `## N.` group per phase with a gate task, and every AC id in at least one task
  (table at lines 31-42) hold. Task numbering after the insert of 6.6 is consistent: 6.5 (the
  `compozy-driver` delta), 6.6 (the `change-coordination` block), 6.7 (the record and ADR 0004), 6.8
  (versions), 6.9 (stage headers), 6.10 (gate); every reference in `design.md` and `proposal.md` to tasks
  6.x points to the right one.
- **M-7 (task 1.1 and gate 1.4 are red at HEAD).** Both run `git merge-base --is-ancestor origin/main HEAD`.
  It exits 1 on this branch, because `cf34ff2` is not in it, and task 1.1 forbids a second merge ("Run no
  fetch and no second merge here"). The first task of the plan therefore cannot pass, and gate 1.4's
  instruction for a red part ("when it is red because `compozy` is still not built on `main`, stop for the
  owner") does not fit: `compozy` is built. The implementer has to ask whether to merge, which is exactly
  the question the plan must answer. The plan also does not know `suite-speed` at all: no task, record or
  dependency names it, and it took ADR 0026 (0025 is still free).
- **M-8 (the commands and files the plan stands on changed in `cf34ff2`).** I read `origin/main`'s files:
  - `plugins/openspec/hooks/guard.test.mjs` no longer imports any other test file (the 20 side-effect
    imports are gone), and `scripts/test-suite.mjs` refuses a test file that imports a test file
    (`IMPORTED_TEST_FILE`). So every gate of the plan (2.9, 3.6, 4.5, 5.6, 6.10, 7.8: `node --test
    --test-name-pattern=... plugins/openspec/hooks/guard.test.mjs`) would run only the guard's own tests
    and name suites it no longer loads; tasks 2.1 and 2.3 (T-1, T-2: "change the imports of
    `guard.test.mjs`") and 4.1 ("Import both new files from `guard.test.mjs`") describe edits that
    cannot be made. The new suite command is `node scripts/test-suite.mjs [--test-name-pattern=<re>] [<test
    file>...]`, and the `CLAUDE.md` Commands row, `CONTRIBUTING.md` and `ci.yml` (13 lines) changed with it,
    which are files tasks 2.6, 2.7 and 6.2 edit.
  - `scripts/test-suite.mjs` lists its folders in `SUITE_FOLDERS`, and two of them are
    `plugins/openspec/skills/openspec-setup/scripts` and `plugins/compozy/skills/compozy-setup/scripts`.
    After task 2.1 and 2.3 move the scripts, `walk` reads a missing folder as empty, so the moved tests, and
    the new `setup-block.test.mjs` and `kit-installer.test.mjs`, would silently not run, and every gate
    would stay green. The script and `plugins/openspec/hooks/test-suite.test.mjs` (which pins both folder
    names, lines 23 and 25) have no task, and N-10 would fail on both for naming the old skills.
  - Tests moved files: "change-loop skill: the sections of D-3 to D-9 ..." (T-28) and `release-merge-conflict
    16` (T-26) are in `change-loop-compozy.test.mjs`; `roadmap-loop skill: the frontmatter and the start
    modes` (T-29) in `roadmap-loop-followups.test.mjs`; `delivery-train docs` and one `delivery-train P13`
    (T-30) in `delivery-train-after.test.mjs`. D-13's file names and the "each test file named" rule no
    longer hold for these rows, and D-13's grep has to be run again over the new files.
  - `devkit-openspec` and the marketplace are 0.38.0 and 0.42.0 on `origin/main` (0.36.0 and 0.40.0 here),
    and the record of `suite-speed` is ADR 0026.
- Gates that exist on the base and are short ran green here (`scripts/check.py`, `gen-catalog.py --check`,
  `gen-agents.mjs --check`). Gates 6.10 and 7.8 need `compozy-driver` and `delivery-train` archived
  (declared). The long suite is run by the caller.

## 7. Omission detection
- Idempotency and re-run, error handling and refusals, rollback and migration: covered as in attempt 4.
- Compatibility with the other verbs of `main` (`train`) and with the `compozy` driver: now covered.
- Compatibility with a third sibling in flight (`suite-speed`): missing (M-7, M-8).
- Observability: not applicable. Test strategy: real run per case (D-14); phases 3 to 6 are test-first.

## 8. Execution risks (top 5 failures)
1. Cause: task 1.1 and gate 1.4 run as written. Impact: exit 1 on the first task; the implementer merges
   `cf34ff2` on their own or stops, and the choice (before or after phase 2) decides how many test edits
   conflict. Prevention: M-7.
2. Cause: tasks 2.1 and 2.3 move the script folders and `SUITE_FOLDERS` still names the old ones. Impact:
   the moved and new setup tests run nowhere, and the gates stay green. Prevention: M-8, a task and a test
   row for `scripts/test-suite.mjs` and `test-suite.test.mjs`, and a gate that names the new files.
3. Cause: the gates keep the `guard.test.mjs` form after the merge. Impact: a gate that loads none of the
   suites it names. Prevention: M-8, the gates become `node scripts/test-suite.mjs` with the file and the
   pattern.
4. Cause: `delivery-train` and `compozy-driver` still unarchived when phase 6 runs. Impact: N-10 red until
   their archives reach `main`, and the two overlapping deltas depend on the order. Prevention: tasks 6.5
   and 6.6 (declared); the owner knows the order.
5. Cause: the record keeps the file name 0025 while another sibling takes it. Impact: low, the loop's
   renumber step moves every link (tasks 6.4 and 6.7). Prevention: as written.

## 9. Mandatory fixes before implementation
- [ ] Critical — `tasks.md` 1.1, 1.4 and the Workflow follow-up, `design.md` header, D-12 steps 1 and 6 and
  Dependencies, `proposal.md` Dependencies — M-7: `origin/main` is `cf34ff2` (`suite-speed`), the check
  `git merge-base --is-ancestor origin/main HEAD` exits 1, and the plan does not know the sibling —
  Smallest correction: the owner chooses the order, and the plan says it. The plan I recommend: merge
  `origin/main` into the branch before approval (the same step that brought `f84bc6e`), read the plan again
  on that tree, and name `suite-speed` in D-12 and in the Dependencies of design and proposal; task 1.1 then
  checks `git merge-base --is-ancestor <the new merge commit> HEAD` and keeps no moving ref in a check.
  The other order (implement on `f84bc6e` and merge at the end) needs a task that says how the conflicts of
  phases 2 to 5 are taken, and still needs M-8.
- [ ] Critical — `tasks.md` header paragraph and gates 2.9, 3.6, 4.5, 5.6, 6.10 and 7.8, tasks 2.1, 2.3, 2.6,
  2.7, 4.1 and 6.2, `design.md` D-10, D-13 (T-1, T-2, T-14, T-18 to T-30 file names and lines, a new row for
  `scripts/test-suite.mjs` and `test-suite.test.mjs`), D-9 (N-10's list), D-15 and `proposal.md` exit criteria
  — M-8: the suite command, the import wiring, the folder list and the test file names are those of
  `f84bc6e`, and `cf34ff2` replaced them — Smallest correction: with the merge of M-7 done, (a) rewrite
  every gate as `node scripts/test-suite.mjs --test-name-pattern=<re> <test file>...` (the whole suite as
  `node scripts/test-suite.mjs`, still a background command) and keep the env prefix the header says;
  (b) drop T-1, T-2 and the import clause of 4.1, since the script runs every `*.test.mjs` of its folders;
  (c) add a task in phase 2, with a row in D-13, that changes `SUITE_FOLDERS` in `scripts/test-suite.mjs`
  and the two folder constants in `test-suite.test.mjs` to `plugins/openspec/skills/devkit/scripts` and
  `plugins/compozy/kit/scripts`, and a check that lists the moved and new test files through the script;
  (d) run D-13's grep again over the files `suite-speed` created and point each row at the file that holds
  its test now; (e) read `CLAUDE.md`, `CONTRIBUTING.md`, `ci.yml` and `docs/openspec-flow.md` from the merged
  tree before tasks 2.6, 2.7 and 6.2 name their lines.

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: D-13 T-28's "twelve headings" wording (section 4).
- [ ] Fix during implementation: line hints in D-13 and D-1 drift by a few lines (T-3 at `guard.test.mjs`
  640, T-6 at 1778, T-20 at `project-loop.test.mjs` 768); the header says the tests are the contract.
- [ ] Nice to have: `design.md` D-7's description sentence. The `devkit` skill's `description` is about
  1300 characters before the new sentence; `scripts/check.py` sets no limit, but keep the sentence short.

## 11. Explicitly out of scope
- [ ] The `script` driver, changing the checkers, a task-source key, writing `budget`, `design:` or `models:`,
  `delivery.train`, re-running setup in the consumer projects, bulk GitHub settings (all in `requirements.md`;
  the setup asks no `train` or `models` key).
- [ ] The real-run proof of R-3 on a GitHub repository (owner-run; D-14 records the fallback).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: ten ACs, each with tasks and a test or a real run.
3. Are error behaviors defined? Yes, for the writer, the verb and `setup` on a `compozy` project.
4. Are edge cases covered? Yes, including the `train` verb and the train's blocked reply.
5. Are dependencies clear? `compozy-driver`, `delivery-train` and `stage-models` yes; `suite-speed`, now on
   `main`, is not named (M-7).
6. Are contracts defined? Yes, except the suite command and the suite's folder list (M-8).
7. Can two developers interpret this differently? Yes on one point: what task 1.1 does when the check is
   red (M-7). The verb lists, the heading position and the `compozy` case are now written once.
8. Are any decisions implicit instead of written? One: the order of the `suite-speed` merge (M-7).
9. Do the tasks fully deliver the intended outcome? Not on the base `main` has now: the moved tests would not
   be in the suite (M-8).
10. What will be discovered too late if implementation starts now? A first task that cannot pass, and, after
    the merge, gates and a suite that run neither the moved tests nor the new ones while reporting green.

## 13. Final conclusion
- Can we start? No. Merge `origin/main`, revise the plan for M-7 and M-8, then ask for the readiness review
  again; the owner approves the revised plan after it passes.
- What must be fixed? Section 9, M-7 and M-8. Nothing in them changes scope; the six fixes of attempt 4 need
  no further work.
- Main risk if ignored? The plan's own proof goes quiet: the gates stay green while the suite no longer reads
  the folders the plan moved the setup tests to.
