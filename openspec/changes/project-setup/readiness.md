<!-- devkit-stage readiness result=failed attempt=4 commit=fa2969b28dd24e4f34f9060bf11cf838f98188bb -->
# Readiness review: project-setup

Attempt 4, a re-review after the merge of `origin/main` (`f84bc6e`: compozy-driver, stage-models and
delivery-train landed) and the renumbering of this change's record to
`docs/adr/0025-one-setup-verb-replaces-the-two-setup-skills.md` (`fa2969b`). Reviewed at `fa2969b`
on branch `project-setup`, clean tree. As asked I fetched nothing and ran no test suite. I judged the
plan by reading the merged tree and grepping it.

Checks run: `openspec validate project-setup --type change --strict` is valid.
`python3 scripts/check.py` prints "all checks passed", `python3 scripts/gen-catalog.py --check` exits
clean and `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` says "21
CompozyOS agents are up to date", all on this tree. `claude plugin validate .` was not run (the
`claude` shell function is not executable here), so it is not counted. The long suite
(`guard.test.mjs`) was not run; the caller runs it.

The approval (`approval.md`) records `Readiness: sha256:47f97f2eae4a`, the hash of attempt 3. This
attempt replaces that file, and the fixes below edit the plan files, so the approval is stale until the
owner approves the revised plan.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The plan was written against `c1ac8c4` and the local `compozy-driver` branch. `main` has since taken
two more changes that the plan does not know: `delivery-train` (a sixth verb, `/devkit train`, a
`## Train` section of the `devkit` skill, `train-loop.mjs`) and `stage-models`. The `compozy-driver`
facts hold. The `delivery-train` facts do not, and six of them break the plan as written: three
exact-text tests fail, one spec delta would delete a verb from the canonical spec, one script keeps
the old pointer text, and one skill instruction leaves `/devkit setup` with no steps on a `compozy`
project. All six are narrow and fit without a change of scope, so the verdict is NEEDS-REVISION, not
BLOCKED. Six Mandatory fixes are more than three major doubts for the next phase.

## 2. Scope validation
Classification: correct. The problem, the in-scope list, the ten ACs and the non-goals are unchanged
and explicit. The fixes below add no scope: they carry what `main` already holds (`train`) into
sentences and rows the plan already owns.

## 3. Proposal review
Problem, goal, three modified capabilities and non-goals are clear. Two statements about the
repository are stale at this commit and one list is short:
- `proposal.md:123-126` still gives the sibling's versions as devkit-openspec 0.34.0 and marketplace
  0.38.0. On `main` they are 0.36.0 (`plugins/openspec/.claude-plugin/plugin.json`) and 0.40.0
  (`.claude-plugin/marketplace.json:9`). It is history at `cb39d27`, but task 1.2 uses the same pair
  as its drift baseline (finding M-6).
- The Impact list (`proposal.md:102-106`) names no `train-loop.mjs` and no `delivery-train.test.mjs`
  (findings M-1, M-3).

## 4. Design review
Re-derivation against the merged tree. Facts that hold:
- `DRIVER_ROUND = { script: 22 }` at `change-loop.mjs:1852`, so gate 1.4's `grep -q "const DRIVER_ROUND =
  { script: 22 };"` matches. `DRIVERS` is already exported (`:63`), so `BUILT_DRIVERS` is `claude`,
  `compozy`. `LANGUAGE_TAG` is at `:64` and not yet exported, as D-3 says.
- `startMode` (`change-loop.mjs:1883`) reads `findRoot` and `readDevkitSettings` first, then checks
  `VERB_ROUND` (`:1901`) and the verb list (`:1902`); the `setup` branch belongs between them (D-1). An
  unreadable `openspec/config.yaml` raises `LoopUsageError` through `settingsText` (`:107-112`), so N-16
  holds on the base.
- The kit facts of D-10 hold at `plugins/compozy/skills/compozy-setup/`: `gen-agents.mjs` lines 20, 21 and
  25; `install-kit.mjs:31` (`PACK_JSON`); `adoption.test.mjs:21-22`; `gen-agents.test.mjs:12,16,18,50`;
  `install-kit.test.mjs:43,46`; `loop-templates.test.mjs:543`; `substitutions.json` line 2;
  `plugins/compozy/skills/test-tmp.mjs` exists, so `../../skills/test-tmp.mjs` resolves from `kit/scripts`.
- The resolver rule D-4 borrows (highest version field by field, a tie to the last path, under
  `$CLAUDE_CONFIG_DIR/plugins` else `$HOME/.claude/plugins`) is the one in
  `plugins/compozy/skills/compozy-setup/templates/bin/devkit-kit`.
- `compozy-driver.mjs:22` (`'kit-missing'`), `change-loop.mjs:221` and `:506` (`compozy-kit-missing`),
  `compozy-driver.test.mjs:95`, `ci.yml:17`, `CLAUDE.md:31` and the five kit imports of
  `guard.test.mjs:35-39` are where D-8, D-10 and T-2 say they are (lines moved, content as planned).
- `deliveryConfig` still takes no `ship:` entry for `two-prs` (`deliver-check.mjs:142,168-171`); the
  `MODEL_SHIP` map now also holds `'two-prs': 'pr'`, which gives the same refusal as D-3 describes.
- ADR 0025 is the next free number: `docs/adr/` ends at 0024. `compozy-driver`, `delivery-train` and
  `stage-models` are all still in `openspec/changes/` (none archived).

Re-derivations that fail:

- **M-1 (the `train` verb).** `change-loop.mjs:1902` now reads `['change','roadmap','status','project','train']`
  and the replies `verb-unknown` (`:204`, `:489`) end "... /devkit project and /devkit train exist ...". D-8's
  new `verb-unknown` text (`design.md:351`) lists five commands and drops `/devkit train`. D-7's
  `argument-hint` (`design.md:279-281`) is `... | status | setup | project [<name>]`; the file's hint is
  now `... | status | train | project [<name>]` (`devkit/SKILL.md:4`). D-7's `description` addition is written
  against a description that now also names `/devkit train`. D-7's heading list (`design.md:288-291`) and T-28
  omit two sections that exist: `## On the CompozyOS driver` (after `## Start`) and `## Train` (right after
  `## Waiting on GitHub`). The real list is pinned at `change-loop.test.mjs:2472`:
  `Settings, Start, On the CompozyOS driver, A new change, Loop, Owner gates, Waiting on GitHub, Train, Roadmap,
  Status, Project, Never`. D-7 and task 2.2 put `## Setup` "between `## Waiting on GitHub` and `## Roadmap`":
  that is where `## Train` is, and `delivery-train.test.mjs:2327` requires `## Train` to be the heading right
  after `## Waiting on GitHub`. Tests that fail with the plan as written, and that D-13 does not list:
  `delivery-train.test.mjs:2291-2293` (`delivery-train P13`, the en text "So far ... /devkit project and
  /devkit train exist" and the pt-BR prefix), `:2327` (Train placement) and `:2330` (the exact hint, which
  `roadmap-loop.test.mjs:1851` also pins, T-29). T-18 (`change-loop.test.mjs:980`) and T-19
  (`roadmap-loop.test.mjs:823`) carry a pt-BR prefix that also drops `e /devkit train`.
- **M-3 (a second copy of the pointer strip).** `train-loop.mjs:552` strips the old pointer with
  `/;\s*run the openspec-setup skill.*$/`, a copy of `project-loop.mjs:254` that the plan does not know.
  D-8 changes only `merge-setup.mjs`'s text and the `project-loop.mjs` strip. After the change the train
  regex matches nothing: a blocked train reply would carry "run the GitHub step of /devkit setup to configure
  it" before its own sentence, and N-10 fails on `train-loop.mjs:552`. No task owns the file. Two copies of
  one mechanism also break the project rule "one shared helper per mechanism" the plan invokes for
  `SETUP_POINTER`.
- **M-4 (`setup` on a `compozy` project).** `devkit/SKILL.md` `## Start` ends its first bullet with "When the
  JSON's `settings.driver` is `compozy`, read the next section instead of the lines below", and the section
  `## On the CompozyOS driver` lists only `new`, `resume`, `choose`, `ask-unfinished`, `roadmap`, `status` and
  `driver-no-project`. `startMode` puts `settings.driver` in every `out(...)` (`change-loop.mjs:1897`), so a
  re-run of `/devkit setup` on a project whose driver is `compozy` answers mode `setup` and the session is told to
  read a section with no `setup` item. D-7 adds the `setup` item "to the mode list" and does not say what happens
  here. This is the re-run AC-4 and R-5 are about. Two developers will write it two ways.

Smaller drift (Fix during implementation):
- D-1 (`design.md:92`) says `guard.mjs` ends a roadmap run on any typed command "but `/devkit status`";
  `roadmapRunOf` (`guard.mjs:1243-1254`) also spares `/devkit train`. N-6 and N-7 still hold; fix the sentence.
- Line hints have moved (`change-loop.mjs` replies now at 205, 221, 397, 446, 481 and 490, 506, 682, 731, 766;
  `guard.mjs:539` for the `FlowUsageError` text; `flow-check.mjs:349,406`). Task 1.2 already tells the
  implementer to fix hints.
- D-3's `kept` reads `readDevkitSettings(root).unknown` and `.missing`. A project with `devkit.delivery.train`
  and no model (or `two-prs`) is refused through `settings.train.problem`
  (`change-loop.mjs:1867`), which is in neither list; the step could then offer `two-prs` or `none` and leave the
  project refused. Add that case to `kept`, or say the step leaves `delivery.train` alone and warns.
- D-6 says the installer inputs are "the inputs `substitutions.json` lists that the manifest does not record
  (after `compozy-driver`: `__TIMEZONE__`, asked once)". The merged `substitutions.json` lists
  `__TIMEZONE__`, `__SCREEN_MAP__` and `__MOCKUP__`; no template uses the last two and the installer records
  their defaults. Say that only `__TIMEZONE__` is asked.

## 5. Specs review
- `openspec validate --strict` is valid. Normative language and WHEN/THEN scenarios are present, and every
  outcome row of D-1, D-3, D-5 and D-8 has a scenario (as in attempt 3).
- **M-2 (the delta drops `train`).** `specs/change-coordination/spec.md:10-34` MODIFIES "The devkit command reads
  its verb" with a whole copy of the canonical text from before `delivery-train`: "Only the verbs `change`,
  `roadmap`, `status`, `setup` and `project` SHALL run anything", no "The train verb" scenarios, and an
  unknown-verb scenario that lists five commands. `openspec/changes/delivery-train/specs/change-coordination/spec.md`
  (merged, not archived) MODIFIES the same requirement with `train`. Whichever change archives second replaces
  the other's block, so the canonical spec loses `train` or loses `setup`. This is the same shape as the
  `compozy-kit-setup` overlap with `compozy-driver`, which D-12 and task 6.5 handle by waiting for the archive
  and copying that text; the `change-coordination` overlap has no such task. Smallest correction: write the
  MODIFIED block from `delivery-train`'s text plus `setup` (the verb sentence with all six verbs, the scenarios
  "The train verb" and "The train verb with words after it", the unknown-verb scenario listing six commands, the
  `setup` scenarios kept), and add a task, like 6.5, that re-reads `delivery-train`'s block when it is archived.
- The `compozy-kit-setup` delta matches `compozy-driver`'s text for the shared requirements (checked line by line
  against `openspec/changes/compozy-driver/specs/compozy-kit-setup/spec.md`); the three it adds to the list in
  task 6.5 are the ones that name `compozy-setup` there (lines 7, 12, 21, 41, 50, 63).
- No requirement lives only in a support doc.

## 6. Tasks review
- Order, checkboxes, one `## N.` group per phase with a gate task, and every AC id in at least one task
  (table at lines 30-41) hold.
- **M-5 (literal ADR number).** The project rule (`openspec/config.yaml`, `rules.tasks`) says a task that writes
  an ADR "names 'the next free number on origin/main at the last merge before review', never a literal number".
  After `fa2969b` task 6.6 reads "Its number 0025 is checked against `origin/main` at the last merge before
  review: if a later merge took it, ...", and task 1.2 says the record "carries its final number 0025". Task 6.6
  writes ADR 0004's Note and sets the record's status. Smallest correction: word both tasks by the rule ("the
  record's number is the next free number on `origin/main` at the last merge before review; its file name
  carries it today") and leave the digits to the file name.
- **M-6 (stale setup tasks).** Task 1.1 says "Fetch, then merge `origin/main` ... once it holds the
  `compozy-driver` merge" and checks that `git log --oneline -1` is the merge commit. The merge is done
  (`f84bc6e`, then `fa2969b` on top), so that check is false at HEAD and an implementer cannot tell whether a
  second merge is wanted. Task 1.2's drift baseline is devkit-openspec 0.34.0 and marketplace 0.38.0 against
  `cb39d27`; `main` holds 0.36.0 and 0.40.0 and brings `delivery-train` and `stage-models`, which the re-read list
  does not name. Smallest correction: mark 1.1 as done at `f84bc6e` (check:
  `git merge-base --is-ancestor origin/main HEAD`), and give 1.2 the merged tree as its base, with
  `train-loop.mjs`, `delivery-train.test.mjs`, the `## Train` and `## On the CompozyOS driver` sections of the
  skill in its list. Also change the design header (`design.md:6-8`, base `c1ac8c4`) to say what was read.
- Task 3.4 must name `train-loop.mjs` (M-3). Tasks 2.2, 3.3, 5.3 and the test rows T-18, T-19, T-28, T-29 must
  carry the corrections of M-1. N-11 should also pin M-4's rule.
- Gates that exist on the base and are short ran green here (`scripts/check.py`, `gen-catalog.py --check`,
  `gen-agents.mjs --check`). Gate 6.9 and 7.8 need `compozy-driver` archived (declared). The long suite is run by
  the caller.
- The config rule "names each test file" is not met until `delivery-train.test.mjs` is a row of D-13 (M-1).

## 7. Omission detection
- Idempotency and re-run, error handling and refusals, rollback and migration: covered as in attempt 3.
- Compatibility with the other verbs of `main`: missing (`train`, M-1, M-2, M-3). Compatibility of the Start
  instructions with the `compozy` driver: missing (M-4).
- Observability: not applicable. Test strategy: real run per case (D-14); phases 3 to 6 are test-first.

## 8. Execution risks (top 5 failures)
1. Cause: D-8's `verb-unknown` text and D-7's hint, applied as written. Impact: `delivery-train.test.mjs`
   P13, the hint test and the Train-placement test, and the T-29 regex, fail in gate 2.9 or 5.6, and the owner
   loses the `/devkit train` line from the unknown-verb reply and the hint. Prevention: M-1.
2. Cause: the `change-coordination` delta archived after `delivery-train`'s. Impact: the canonical "reads its
   verb" requirement loses `train` (or `setup`), and nobody sees it. Prevention: M-2.
3. Cause: `train-loop.mjs:552` keeps the old regex. Impact: a blocked train reply shows the pointer text, and
   N-10 is red. Prevention: M-3.
4. Cause: `/devkit setup` typed in a `compozy` project. Impact: the session reads the CompozyOS section, finds no
   `setup` item, and the re-run (AC-4) and the R-5 proof do nothing or improvise. Prevention: M-4.
5. Cause: `compozy-driver`, `delivery-train` and `stage-models` all unarchived when phase 6 runs. Impact: N-10 is
   red until the archives merge, and the two overlapping deltas depend on the order. Prevention: 6.5 and the new
   task of M-2; the owner knows the order.

## 9. Mandatory fixes before implementation
- [ ] Critical — `design.md:279-291,351`, `tasks.md` 2.2, 3.3 and 5.3, D-13 T-18, T-19, T-28, T-29 — M-1: `main`
  has a sixth verb, `/devkit train`, a `## Train` section and a hint that names it; the plan's reply text, hint,
  description sentence and heading list drop or ignore them, and `delivery-train.test.mjs:2291-2293,2327,2330`
  fail — Smallest correction: write D-8's `verb-unknown` (en and pt-BR) with all six verbs in the existing
  order (`change, roadmap, status, project, train`) and `setup` where D-7 puts it (name the position once, in D-7
  and the spec); write the hint with `train` kept; place `## Setup` and name the position against `## Train`
  (after `## Train` and before `## Roadmap` keeps `delivery-train.test.mjs:2327` true); give T-28 the real
  twelve-heading list plus `## Setup`; rewrite T-18, T-19 and T-29; add a row for `delivery-train.test.mjs`
  (2291-2293, 2327, 2330) to D-13.
- [ ] Critical — `specs/change-coordination/spec.md:10-34` — M-2: the MODIFIED block of "The devkit command reads
  its verb" is a copy from before `delivery-train` and omits `train` — Smallest correction: base the block on
  `openspec/changes/delivery-train/specs/change-coordination/spec.md` plus `setup`, and add a task (beside 6.5)
  that re-reads that block once `delivery-train` is archived, and say in D-12 that the two changes overlap on this
  requirement.
- [ ] High — `design.md` D-8 table and `tasks.md` 3.4 — M-3: `train-loop.mjs:552` holds a second copy of the
  pointer strip and the plan does not touch it — Smallest correction: add a row to D-8 and a clause to task 3.4
  (import `SETUP_POINTER` there too, behaviour unchanged), and one test for the train reply beside N-9.
- [ ] High — `design.md:282-283` (D-7, `## Start`) and N-11 — M-4: `## Start` sends a `compozy` project to the
  CompozyOS section "instead of the lines below" and that section has no `setup` item — Smallest correction: say
  in D-7 that `setup` and `setup-no-repo` are handled whatever the driver (reword the sentence so it reads "for
  every mode but `setup` and `setup-no-repo`", or put a `setup` item in the CompozyOS section), and let N-11 pin
  the chosen words.
- [ ] High — `tasks.md` 1.2 and 6.6, `design.md` D-11 and D-12 step 1 — M-5: the tasks that write the ADR name
  the literal number 0025, against the config rule — Smallest correction: word them as "the next free number on
  `origin/main` at the last merge before review" and refer to the record by its file name.
- [ ] Medium — `tasks.md` 1.1 and 1.2, `design.md:6-8`, `proposal.md:123-126` — M-6: task 1.1's check is false at
  HEAD (the merge is done) and 1.2's version baseline and file list predate `delivery-train` and `stage-models` —
  Smallest correction: as in section 6.

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: the "smaller drift" items of section 4 (D-1's sentence on `/devkit train`, the
  `kept` case for `delivery.train`, D-6's input list, line hints).
- [ ] Nice to have: `design.md` D-7's description sentence. The `devkit` skill's `description` is now about 1309
  characters before the new sentence; `scripts/check.py` sets no limit, but keep the sentence short.

## 11. Explicitly out of scope
- [ ] The `script` driver, changing the checkers, a task-source key, writing `budget`, `design:` or `models:`,
  `delivery.train`, re-running setup in the consumer projects, bulk GitHub settings (all in `requirements.md`;
  the setup asks no `train` or `models` key).
- [ ] The real-run proof of R-3 on a GitHub repository (owner-run; D-14 records the fallback).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: ten ACs, each with tasks and a test or a real run.
3. Are error behaviors defined? Yes for the writer and the verb; not for `setup` on a `compozy` project (M-4).
4. Are edge cases covered? Yes for the block parser and the re-run; the `train` verb and its test pins are not
   (M-1).
5. Are dependencies clear? `compozy-driver` yes. `delivery-train` and `stage-models` are on `main` and
   unarchived, and the plan names neither (M-1, M-2).
6. Are contracts defined? Yes, except the verb list, hint and heading list, which are stale (M-1).
7. Can two developers interpret this differently? Yes: where `## Setup` goes, what the unknown-verb reply says,
   and what `/devkit setup` does on a `compozy` project.
8. Are any decisions implicit instead of written? Yes: the driver sentence of `## Start` (M-4) and the archive
   order for `change-coordination` (M-2).
9. Do the tasks fully deliver the intended outcome? Not as written: `train-loop.mjs` has no task (M-3).
10. What will be discovered too late if implementation starts now? Three red tests in gate 2.9 or 5.6 from the
    verb text, a canonical spec that lost a verb after the archives, and a re-run that does nothing on `compozy`.

## 13. Final conclusion
- Can we start? No. Revise the plan, then ask for the readiness review again; the owner approves the revised
  plan after it passes.
- What must be fixed? Section 9, M-1 to M-6. Nothing in them changes scope.
- Main risk if ignored? The merged `delivery-train` work is damaged without a failing test naming this change:
  the canonical verb requirement and the train's blocked reply.
