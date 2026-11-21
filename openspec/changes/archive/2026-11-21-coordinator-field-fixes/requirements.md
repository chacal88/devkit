<!-- devkit-stage requirements result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Requirements

Change: `coordinator-field-fixes` · Date: 2026-11-20 · Owner: Kaue (chacal88)

Grill: held on 2026-11-20 in the owner's session, eight questions (Questions asked). Before the
first question each of the eight defects was reproduced on a scratch repository with the code of
devkit-openspec 0.16.0 (commit `9184deb`); the reproductions are summarised under Reproductions.

Classification: domain=product type=bug flags=[contract] (strict-assumed, not corrected by the
owner: the `devkit-reviews` check and the reading of "delivered" are relied on by every project's
CI and by `ship-change`, and one answer changes what two ADRs say about the check).

## Request

(Translated from Portuguese.)

> Fix the defects of devkit 0.16.0 that appeared when it was installed in three real projects on
> 2026-11-20. Use the id coordinator-field-fixes and add this change's line to openspec/roadmap.md,
> in a round of its own before round 18. The defects, each to be reproduced on a scratch repository
> before it is fixed: (1) /devkit change with no text lists as "unfinished" a change that is
> already archived when an old working copy still holds its folder; (2) a change started on the
> previous script is read as on the new script, and sent back to the opening questions, as soon as
> a single file of it gains the stage header; (3) the devkit-reviews check (deliver-check --ci)
> looks at neither the script nor the ship mode: it fails a pull request of a change on another
> script, a pull request that touches several change folders and an archive pull request without a
> retro; (4) deliver-check reads a change as delivered when any merged pull request cites its
> evidence, which is wrong in a project whose change ships over several pull requests or ends with
> tasks after the merge; (5) github-setup does not warn when GitHub Actions is disabled, when
> billing is failing, or when the plan refuses branch rules, and suggests as required checks that
> run only after the merge; (6) the checkers use the openspec on PATH and not the version the
> project pins; (7) upgrading the scripts starts requiring an approval record from full-script
> changes already under way, and the devkit setup says nothing about changes under way; (8)
> re-running the setup of the CompozyOS kit overwrites documented local adjustments. The complete
> list, with where each was seen, is in the project's memory, in the file
> devkit-field-findings-2026-11-20.md. Out of scope: the nine points the retro of round 15 left on
> the round 16 line of the roadmap.

## Reproductions

All on scratch repositories, with `gh` and `openspec` stubbed the way the test files do.

- Defect 1: `main` archives `foo` and `bar`; one worktree sits on `chore/archive-foo`, another on
  branch `bar` with an active `openspec/changes/bar/`. `flow-check.mjs` reports `end.state:
  archived` for both; `change-loop.mjs start` lists both. In this repository the same command lists
  `change-coordinator`, `release-rebase-pin` and `review-workflow`, whose archive pull requests
  (#39, #22, #24) are merged.
- Defect 2: a change with headerless `proposal.md`, `design.md` and a ticked `tasks.md` ends
  `blocked/previous-script`; after one headed `evidence.md` is added, `change-loop.mjs next`
  answers `kind: grill`, `stage: requirements`.
- Defect 3: `deliver-check.mjs --ci` exits 1 on (i) a `spec-driven` change with every task ticked
  (items 1, 2 and 4), (ii) a pull request touching two change folders (`several changes are touched
  by this PR`), (iii) an archive pull request of a `spec-driven` change without `retro.md`.
- Defect 4: with `tasks.md` holding unticked tasks, a merged pull request that only names the
  change (a partial one, another change's archive pull request, an unrelated head ending in the id)
  gives `merged: archive step retro`, every item `met`.
- Defect 5: with jobs `test` (on `pull_request`) and `publish` (on push to the default branch),
  the proposed required checks are `test`, `publish`, `devkit-reviews`; a 403 on the rulesets
  prints the raw GitHub line and exits 1. No call reads the Actions state.
- Defect 6: a project `node_modules/.bin/openspec` is never started; the PATH one is.
- Defect 7: after `install-schemas.sh` over the 0.13.0 schemas, `openspec instructions apply`
  for a full-script change with an approved readiness answers `blocked`, `Missing artifacts:
  approval`; a short-script change shows `requirements` first.
- Defect 8: nothing to run: the kit's setup is the text of
  `plugins/compozy/skills/compozy-setup/SKILL.md`, whose re-run paragraph replaces every installed
  file and keeps as a reviewed difference only the prose of `.compozy/README.md`.

## Assumptions

- A-1. One change, one pull request, the eight defects of the request. Every fix lands in the packs
  under `plugins/` (`devkit-openspec`, `devkit-compozy`; `devkit-core` only if a fix cannot avoid
  it) with the docs that state the changed rule.
- A-2. Defect 1. `plugins/openspec/hooks/change-loop.mjs#unfinished` does not list a change that is
  archived on the default branch (a folder `openspec/changes/archive/<date>-<id>/` there), whether
  an old checkout still holds `openspec/changes/<id>/`, sits on the branch `<id>` or sits on
  `chore/archive-<id>`. A checkout on `chore/archive-<id>` whose archive pull request is not merged
  is still listed as being archived. The reading does not depend on the main checkout's local
  default branch being up to date (here it was eight commits behind `origin/main`). Nothing removes
  or cleans a worktree. Where the archived state is read from is the planner's. The one exception,
  a new change that reuses the id on a later day, is A-18.
- A-3. Defect 2. A change that began on the previous script stays read as on the previous script
  (`plugins/openspec/hooks/flow-check.mjs#isPreviousScript`) when later files of it gain a stage
  header, as the agents of devkit-core 0.8.1 write `evidence.md`, `readiness.md` and the review
  files. `change-loop.mjs next` keeps ending `blocked` with the reason `previous-script`, never
  `grill`. A change opened by `change-loop.mjs open` stays on the current script. No way to move a
  change from the previous script to the current one is built. The rule is the planner's.
- A-4. Defect 3, another script. For a change whose script is not a devkit script,
  `deliver-check.mjs --ci` (and `guard.mjs ci`) exits 0 and prints that the change is not on a
  devkit script and that nothing was checked. AMBIGUOUS: a devkit script is (a) the schema named
  `devkit` or `devkit-lite`, as the hooks' opt-in reads it | (b) any schema that declares the
  evidence and review stages; the planner resolves. This changes what ADR 0002 ("recomputes
  reviews, findings, gates and acceptance proof at the PR head") and `docs/openspec-flow.md` say of
  the check, and sits next to ADR 0004's sentence that the check does not depend on the opt-in: the
  plan carries it as a proposed ADR, accepted by the owner with the plan approval.
- A-5. Defect 3, several changes. When a pull request touches several change folders, the check
  checks each touched change on a devkit script that the pull request delivers (at least one ticked
  task in its `tasks.md`), prints one result per change and exits 0 only when all of them pass. A
  touched change that is still only a plan (no ticked task) or is on another script is printed as a
  note and fails nothing.
- A-6. Defect 3, a pull request that delivers nothing. Not answered by the owner (the question was
  overtaken by the correction recorded in question 6); the conducting session keeps today's
  behaviour: a pull request whose single touched change has no ticked task fails as it does today,
  and so does one that touches several changes and delivers none. The owner corrects it at the plan
  approval if a plan-only pull request should pass.
- A-7. Defect 3, the ship mode. The check still does not read `ship:` or `merge_method:` of
  `openspec/config.yaml`: a project that installs the workflow asks for the proof on every pull
  request of a devkit-script change. Nothing in the owner's answers depends on the ship mode.
- A-8. Defect 3, archive without a retro. The archive pull request of a change on another script
  passes with the note of A-4. The archive pull request of a devkit-script change without
  `retro.md` still fails, as ADR 0003 says; the message names the missing file, what it must hold
  and the step that writes it.
- A-9. Defect 4. A change is delivered when a merged pull request is its own and every task of its
  `tasks.md` is ticked on the default branch. A merged pull request that only names the change or
  links its evidence is not its own, and no change's archive pull request ever counts as the change
  pull request of another; the rule that tells "its own" is the planner's. While a task is unticked
  after a merged pull request, `deliver-check.mjs <id>` names the work that is left as the next
  step, a further pull request goes through the same delivery contract, and the retro comes only
  after the last task is ticked on the default branch. AMBIGUOUS: the tick of a task that can only
  be done after the merge lands (a) in a follow-up pull request before the archive | (b) in the
  archive pull request itself; the planner resolves. `docs/openspec-flow.md` (the paragraphs on
  what starts after the merge) is amended. The delivery models of round 17 are not built.
- A-10. Defect 5. The read-only run of
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` names, each in one line with
  what to do: GitHub Actions disabled for the repository, and the plan refusing rulesets (the 403
  it receives today). A billing failure cannot be read from the repository's API: it is reported
  only as "the newest runs failed without starting", with billing named as one possible cause, and
  `plugins/openspec/skills/openspec-setup/SKILL.md` says so. The default list of required checks
  holds only checks that a pull request runs; the owner still confirms the list. When rulesets are
  refused, nothing that depends on them is applied. No write happens without `--apply`, as today.
- A-11. Defect 6. Every start of the OpenSpec CLI by the packs
  (`plugins/openspec/hooks/flow-check.mjs#makeOpenspec` and its callers in `change-loop.mjs`,
  `plugins/openspec/hooks/guard.mjs` in its `openspec status` call,
  `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh`) uses the CLI the project
  pins when it pins one, and never replaces it with the one on PATH. When the pinned CLI is not
  2.x the checker and the setup say which version was found, where, and that the pin must move to
  2.x. OpenSpec 1.x is not supported. AMBIGUOUS: "pins" is (a) an installed
  `node_modules/.bin/openspec` of the project, found from a worktree as well | (b) also a
  dependency declared in `package.json` and not installed, answered with "install it"; the planner
  resolves. The docs' contradicting statements of the supported version are corrected.
- A-12. Defect 7 (the owner's answer to question 6, as corrected by the owner's own message).
  Before `install-schemas.sh` (through `openspec-setup`) replaces the schemas of a project, the
  setup lists the changes under way and what the upgrade changes for each. After the upgrade: a
  full-script change whose implementation had started (a ticked task in `tasks.md`) continues from
  where it was, with no `approval.md` asked; a full-script change that only had its plan ready
  (readiness approved, no ticked task, no code) asks the owner's approval once before the
  implementation; a short-script change under way is not sent to `requirements`. `approval.md` is
  still written only from the owner's own message. A new change follows the whole new script. How
  the state before the upgrade is remembered is the planner's.
- A-13. Defect 8. A re-run of `plugins/compozy/skills/compozy-setup` never replaces an installed
  file the project edited (`.compozy/config.toml`, `.compozy/README.md`,
  `.compozy/agents/<role>/AGENT.md`, `.compozy/loops/openspec-change/loop.yaml`,
  `.compozy/bin/devkit-kit`) without showing the difference and getting the owner's yes for that
  file; a file the project did not edit is updated without a question. How an edit is recognised
  is the planner's. The planner also checks whether
  `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml` needs the same
  correction for the short script's grill that the field project made by hand, and includes it if
  so. The twelve-stage loop itself is not redesigned (round 21).
- A-14. The roadmap line is `coordinator-field-fixes (after: change-coordinator)` under a heading
  `## Round 17b: field fixes of 0.16.0`, placed between round 17 and round 18 of
  `openspec/roadmap.md`, with one sentence in the paragraph that explains the numbering. No round
  is renumbered.
- A-15. Versions and the changelog follow `CONTRIBUTING.md`; the numbers are the planner's.
- A-16. Proof. Every criterion is proved in this repository by tests on scratch repositories, with
  GitHub's answers simulated for defect 5. Installing the release in the three projects again is a
  check recorded for the next change, outside the criteria.
- A-17. This change is conducted with `/devkit change`. What that shows about the nine points on
  the round 16 line goes to the retro, not into this change.
- A-18. A new change that reuses the id of a change archived on the default branch is not the
  archived change. It is listed as unfinished when the `created:` day in its active folder's
  `openspec/changes/<id>/.openspec.yaml` is later than the day of the latest archived folder of
  that id (`openspec/changes/archive/<date>-<id>/`). A folder created on the day of the archive or
  before it, or one that records no day, is the old copy of the archived change and is not listed.
  Decided by the owner on 2026-11-21, when review round 2 ended with one reviewer asking for this
  behaviour (round 1) and another refusing it because the specification did not state it: the
  owner chose to state the exception in the specification.

## Acceptance criteria

All proved here: by tests of this change on scratch repositories unless the criterion says more.

- AC-1 `archived-change-not-unfinished` — `change-loop.mjs start` does not list a change archived
  on the default branch when an old checkout holds its active folder, its branch or its archive
  branch with the archive pull request merged; it still lists one whose archive pull request is not
  merged. Run in this repository, it no longer lists `change-coordinator`, `release-rebase-pin` and
  `review-workflow` (recorded in `evidence.md`). A new change that reuses an archived id and was
  created on a later day than the archive is still listed; one created on the day of the archive
  or before it is not (A-18).
- AC-2 `previous-script-stays-previous` — a change with headerless plan files to which a headed
  `evidence.md`, `readiness.md` or review file is added is still reported as begun on the previous
  script by `flow-check.mjs`, and `change-loop.mjs next` ends `blocked` with `previous-script`.
- AC-3 `ci-other-script-passes-with-note` — `deliver-check.mjs --ci` and `guard.mjs ci` exit 0 for
  a pull request of a change that is not on a devkit script, and for its archive pull request,
  printing that nothing was checked and why; a devkit-script change is checked as before.
- AC-4 `ci-several-changes-each-checked` — for a pull request touching several change folders the
  check prints one result per delivered devkit-script change and exits 0 only when all pass; a
  plan-only or other-script change among them is a printed note; a pull request that delivers no
  change fails as it does today.
- AC-5 `ci-archive-without-retro-explains` — the archive pull request of a devkit-script change
  without `retro.md` exits 1 with a message that names the file, what it must hold and the step
  that writes it.
- AC-6 `delivered-needs-own-pr-and-all-tasks` — with unticked tasks, `deliver-check.mjs <id>` does
  not answer an archive step after a merged pull request, whether that pull request is the
  change's own, only names it, or is another change's archive pull request; it names the work left.
  With every task ticked on the default branch and the change's own pull request merged, it answers
  the retro as it does today.
- AC-7 `github-setup-names-what-blocks` — the read-only run of `github-setup.mjs` prints a named
  line with what to do for Actions disabled, for rulesets refused by the plan, and for newest runs
  that failed without starting; with rulesets refused, `--apply` writes nothing that depends on
  them.
- AC-8 `required-checks-run-on-pull-requests` — the default list of required checks leaves out a
  job that runs only on push to the default branch and keeps one that runs on pull requests.
- AC-9 `project-openspec-wins` — with a project-pinned OpenSpec CLI and a different one on PATH,
  `flow-check.mjs`, `change-loop.mjs`, `guard.mjs` and `install-schemas.sh` start the pinned one;
  when it is not 2.x each says the version found, where, and what to do, and none starts the PATH
  one.
- AC-10 `upgrade-respects-changes-under-way` — the setup lists the changes under way and what
  changes for each before the schemas are replaced; afterwards a full-script change with a ticked
  task is not asked for `approval.md` by any devkit command or by `openspec instructions apply`, a
  full-script change with an approved readiness and no ticked task is stopped once at the owner's
  approval before any implementation, and a short-script change under way is not sent to
  `requirements`.
- AC-11 `compozy-rerun-keeps-local-edits` — a re-run of `compozy-setup` over a project with an
  edited `loop.yaml` (or any other installed file) leaves the edit in place until the owner accepts
  the shown difference, and updates the unedited files.
- AC-12 `roadmap-line` — `openspec/roadmap.md` lists `coordinator-field-fixes` in a round of its
  own before round 18, read by `guard.mjs#parseRoadmap`, and the line is ticked by the archive.
- AC-13 `reproduced-before-fixed` — each of the eight defects has at least one test that fails on
  the code of 0.16.0 and passes after the fix; the failing run is recorded in `evidence.md`.
- AC-14 `no-other-behaviour-changes` — no checker, hook, skill or schema behaves differently
  outside the rules named in AC-1 to AC-11; a test that pinned a rule this change replaces is
  changed with its invariant named.

## Questions asked

1. [project rules] The check on a pull request of a change outside the devkit scripts → green with
   a note; recorded as a new decision the owner approves with the plan.
2. [edges] A pull request that touches several change folders → check each delivered devkit-script
   change, pass only when all pass; a plan-only change among them is a note.
3. [project rules] An archive pull request of a devkit-script change without a retro → still fails
   (ADR 0003), with a message that explains.
4. [end effect] When a change counts as delivered → its own pull request merged and every task
   ticked; while a task is unticked the work goes on.
5. [scope] A project that pins OpenSpec 1.x → the project's CLI is always used and a clear message
   says 2.x is needed; no 1.x support.
6. [edges] Changes under way when the schemas are upgraded → first answer "continue from where it
   was", then corrected by the owner's message: one with the implementation started continues; one
   with only the plan ready, no code, asks the owner's approval once before implementing.
7. [end effect] What proves the fixes → tests here, with this repository's own list clean; the
   three projects are checked after the release, outside the criteria.
8. [edges] Whether a plan-only pull request should pass the check → not answered (A-6).
9. [edges] After review round 2: a new change that reuses an archived id, listed or hidden → state
   the exception in the specification (A-18), rather than remove the behaviour.

## Escalations

- None open. The one collision with recorded decisions (question 1, ADR 0002 and ADR 0004) was put
  to the owner, who chose the outcome; the ADR that records it is written with the plan and
  accepted at the plan approval.

## Out of scope

- The nine points the retro of round 15 left on the round 16 line of `openspec/roadmap.md`.
- Support for OpenSpec 1.x.
- The delivery models of round 17 and the CompozyOS driver of round 21.
- Removing or cleaning old worktrees.
- Moving a change from the previous script to the current one.
