<!-- devkit-stage proposal result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Proposal

Change: `coordinator-field-fixes` · Date: 2026-11-20 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, the eight reproductions it records). Round 17b of
`openspec/roadmap.md`, not a step of the build order.

## Why

Installing devkit-openspec 0.16.0 in three other projects on 2026-11-20 showed eight defects that
this repository's own use never did: `/devkit change` lists archived changes as unfinished, sends a
previous-script change back to the grill, the required `devkit-reviews` check fails pull requests it
was never meant to judge, a change reads as delivered from any merged pull request that names it,
`github-setup` is silent on what GitHub refuses, the checkers start the wrong OpenSpec CLI, a schema
upgrade breaks changes under way, and the CompozyOS kit's re-run overwrites local edits. Round 18
(the roadmap coordinator) would run every one of them in parallel, so they are fixed first.

## What Changes

- `/devkit change` with no text no longer lists a change archived on the default branch, read from
  the default branch's own tree (GitHub, else `origin/<default>`), whatever old checkout still
  holds its folder or branch (defect 1). An active folder of that id created on a later day than
  the archive is a new change that reuses the id and is still listed (A-18, `design.md` D-3).
- A change begun on the previous script stays on it when a later file of it gains a stage header:
  the earliest stage file the change has decides (defect 2).
- **BREAKING** (CI contract): `devkit-reviews` (`deliver-check --ci`, `guard.mjs ci`) checks only
  changes on a devkit script (`devkit`, `devkit-lite`), and passes with a note for any other; a
  pull request touching several changes is judged per delivered devkit-script change; an archive
  pull request without `retro.md` fails with a message that explains (defect 3). Recorded in the
  proposed ADR 0012 (`design.md` D-5), which amends one sentence each of ADRs 0002, 0003 and 0004.
- A change is delivered only when its own pull request is merged and every task of `tasks.md` is
  ticked on the default branch; a pull request that only names the change, links its evidence or
  archives another change never counts. A task left after a merge is done in a further pull request
  under the same contract, before the retro (defect 4).
- `github-setup.mjs` names, in one line each with what to do, GitHub Actions disabled, the plan
  refusing rulesets, and newest runs that failed without starting (billing named as one possible
  cause); its default required checks are only checks pull requests run; with rulesets refused it
  applies nothing that depends on them (defect 5).
- Every start of the OpenSpec CLI by the packs uses the project's pinned CLI (an installed
  `node_modules/.bin/openspec`, found from a worktree too), never the one on `PATH` instead; a pin
  that is declared and not installed, or not 2.x, is named with what to do (defect 6).
- `openspec-setup` lists the changes under way and what the schema upgrade changes for each before
  replacing the schemas; a full-script change whose implementation started continues with no
  approval asked, one with only its plan ready asks the owner's approval once, a short-script one
  is not sent to the grill (defect 7).
- `compozy-setup` gains an install script that keeps a manifest of what it wrote: a re-run updates
  files the project did not edit and shows the difference of an edited file, writing it only with
  the owner's yes for that file. The kit's loop template and tech-lead shell stop telling an
  unattended run to hold the grill itself (defect 8).
- The roadmap line of this change (round 17b), docs and versions.

Non-goals: the nine points the round 15 retro left on the round 16 line; OpenSpec 1.x support; the
delivery models (round 17) and the CompozyOS driver (round 21); removing or cleaning worktrees;
moving a change from the previous script to the current one; a new step name in `deliver-check`.

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

## Capabilities

### New Capabilities

- `reviews-check`: what the required `devkit-reviews` check judges on a pull request: which
  changes, by their script; several changes in one pull request; archive pull requests.
- `change-delivery`: when a change counts as delivered after a merge, and what comes next while a
  task is left.
- `openspec-cli`: which OpenSpec CLI the packs start, and what they say when the project's pin
  cannot be used.
- `project-setup`: what `openspec-setup` reports and refuses on GitHub, and how it upgrades the
  schemas over changes under way.
- `compozy-kit-setup`: how `compozy-setup` installs and re-installs the CompozyOS kit without
  losing a project's edits.

### Modified Capabilities

- `change-stages`: a previous-script change is recognised by its earliest stage file; the delivery
  passes and the walk after a merge starts only for a delivered change; the checker names the CLI
  it refuses.
- `change-coordination`: the unfinished list leaves out changes archived on the default branch.

## Impact

- devkit-openspec (0.16.0 to 0.17.0): `hooks/guard.mjs` (the CLI resolver, the session's status
  call), `hooks/flow-check.mjs`, `hooks/change-loop.mjs`, `hooks/deliver-check.mjs` and their
  tests; `skills/openspec-setup/` (`SKILL.md`, `scripts/github-setup.mjs`,
  `scripts/install-schemas.sh`, new `scripts/changes-under-way.mjs`, tests); `README.md`.
- devkit-compozy (0.1.1 to 0.2.0): `skills/compozy-setup/` (`SKILL.md`, new
  `scripts/install-kit.mjs` and test, the loop template and the tech-lead shell).
- devkit-core: unchanged.
- Repository: `docs/adr/0012-the-reviews-check-follows-the-change-script.md` (new, proposed),
  dated Notes in ADRs 0002, 0003 and 0004, `openspec/config.yaml` (ADR line), `docs/openspec-flow.md`,
  `docs/compozy-kit.md`, `CONTRIBUTING.md` (one sentence), `.compozy/` (re-installed by the new
  script), `openspec/roadmap.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json` (0.21.0),
  `docs/catalog.md` (generated).
- Projects: they bump the pinned `devkit-reviews` workflow to the `v0.17.0` commit to get the CI fix
  (the workflow file is theirs and is never overwritten); `install-schemas.sh` refuses to install
  when the project's pinned OpenSpec is not 2.x.

**Dependencies.** `change-coordinator` (round 15, archived at `9184deb`): `change-loop.mjs`,
`flow-check.mjs`, `deliver-check.mjs` as of that commit; the `openspec` CLI 2.x; `gh`.

**Exit criteria.** `openspec validate coordinator-field-fixes --strict`; the whole hook suite
`node --test plugins/openspec/hooks/guard.test.mjs` green with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set; the compozy-setup tests; `python3 scripts/check.py`;
`python3 scripts/gen-catalog.py --check`; `command claude plugin validate .` (the real binary,
skipping a shell function named `claude`); the red runs of 0.16.0 and
the run of `change-loop.mjs start` in this repository recorded.

**What the owner approves**, in the message that approves the plan (quoted in `approval.md`):

- The plan, and ADR 0012 (`design.md` D-5): accept it and it becomes `accepted`; refuse it and the
  plan goes back to planning before any code.
- Three resolutions of points the requirements left to the planner or open: A-6 kept as assumed (a
  plan-only pull request fails the check); A-9 resolved as (a), a task done after the merge is
  ticked in a further pull request before the archive (`design.md` D-4); A-11 resolved as both (a)
  and (b), an installed pin is used and a declared but not installed one is refused with "install
  it" (`design.md` D-1).
- The setup writes a not-applicable `approval.md` for a full-script change whose implementation
  started before the upgrade, from the owner's yes to the upgrade listing that names it (`design.md`
  D-7); it records that no approval was asked, never an approval.
- The correction of the kit's grill sentences (`design.md` D-8): the field project's own wording is
  not in this repository; the owner compares it with the plan's wording at the approval.

**Decisions cited.** ADR 0002, ADR 0003 and ADR 0004 (amended by the proposed ADR 0012); ADR 0010
decisions 3, 5 and 6 (headers, the GitHub check as a lock, unchanged gates); ADR 0011 (approval
written only from the owner's message, unchanged); ADR 0009 (the CompozyOS kit, unchanged).

**Open decisions inherited.** None of `docs/coordination-design.md`'s open points is touched.
