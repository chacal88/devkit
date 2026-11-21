<!-- devkit-stage tasks result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Tasks

Change: `coordinator-field-fixes` · Date: 2026-11-20 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, message, file and test name is in
`design.md` (D-1 the CLI, D-2 the previous script, D-3 archived on the default branch, D-4
delivered, D-5 the CI check and ADR 0012, D-6 github-setup, D-7 the schema upgrade, D-8 the kit,
D-9 documents and release, D-10 the proof, D-11 the existing tests); the implementer copies them and
makes no design choice.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`field-fixes <defect> ` (D-10). Every env a new hook test builds blanks `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`
through the file's shared constant, and every hook gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the `openspec` CLI 2.x on
`PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes)
runs once, in 7.5, as a background command. The marketplace check is written
`command claude plugin validate .`: `command` (a POSIX shell builtin, so it works in zsh, bash and
sh) skips a shell function or alias named `claude` and runs the real binary, where a bare
`claude plugin validate .` exits 126 without validating in a shell that defines `claude` as a
function; where `claude` is only the binary, both forms run the same thing.

Test first in every phase: its first task writes the phase's tests, runs them on the unchanged code
and saves the failing output, as printed, to `openspec/changes/coordinator-field-fixes/proof/red-<phase>.txt`;
that run fails by design and is that task's check, never a gate (D-10). An existing test is changed
only where `design.md` D-11 names it, in the task that changes its rule, with its invariant named in
the commit message. Leave no backup or scratch file in the tree; end every task with
`git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `archived-change-not-unfinished` | 2.1, 2.3, 2.4, 2.5 |
| AC-2 | `previous-script-stays-previous` | 2.1, 2.2, 2.5 |
| AC-3 | `ci-other-script-passes-with-note` | 4.1, 4.2, 4.5 |
| AC-4 | `ci-several-changes-each-checked` | 4.1, 4.2, 4.5 |
| AC-5 | `ci-archive-without-retro-explains` | 4.1, 4.3, 4.5 |
| AC-6 | `delivered-needs-own-pr-and-all-tasks` | 3.1, 3.2, 3.3, 3.4 |
| AC-7 | `github-setup-names-what-blocks` | 5.1, 5.2, 5.6 |
| AC-8 | `required-checks-run-on-pull-requests` | 5.1, 5.2, 5.6 |
| AC-9 | `project-openspec-wins` | 1.1, 1.2, 1.3, 1.4 |
| AC-10 | `upgrade-respects-changes-under-way` | 5.3, 5.4, 5.5, 5.6 |
| AC-11 | `compozy-rerun-keeps-local-edits` | 6.1, 6.2, 6.3, 6.4, 6.5 |
| AC-12 | `roadmap-line` | 7.1 |
| AC-13 | `reproduced-before-fixed` | 1.1, 2.1, 3.1, 4.1, 5.1, 5.3, 6.1, 7.4 |
| AC-14 | `no-other-behaviour-changes` | 1.4, 2.5, 3.2, 3.3, 3.4, 4.5, 5.2, 5.6, 6.4, 6.5, 7.5 |

## 1. The project's OpenSpec CLI (AC-9, AC-13, AC-14)

- [x] 1.1 Write the `field-fixes 6` tests (D-1, spec `openspec-cli`): in `guard.test.mjs`
  (`openspecCli`: a checkout's `node_modules/.bin/openspec` wins over a `PATH` one; a worktree with
  none finds the main checkout's; a `package.json` declaring `@fission-ai/openspec` with nothing
  installed is an error naming the file, the range and the install; no pin gives `PATH`; the
  session text runs the pinned CLI and, for a pinned `1.16.0`, is the one line `[devkit] <message>`
  naming the version, the path and the move to 2.x with no `openspec status` run, and for a
  declared, uninstalled pin is the one line `[devkit] <message>` naming the install with no
  `openspec` started; spec `openspec-cli`, "The session text names a pin it cannot use"), in
  `flow-check.test.mjs` (a pinned `1.16.0` and a 2.x on `PATH`:
  exit 3 naming `1.16.0`, the path and the move to 2.x, and a marker file proves the `PATH` stub
  never ran; a declared, uninstalled pin: exit 3 and the `PATH` stub never ran), in
  `change-loop.test.mjs` (`next` with a pinned `1.16.0`: exit 3, the message in `error`, the `PATH`
  stub never ran; with a pinned 2.x: the pinned stub is the one that answered) and in
  `install-schemas.test.mjs` (a pinned `1.16.0`: exit 1 naming version, path and the move, no schema
  replaced, the `PATH` stub never ran; a pinned 2.x validates with the pinned one; a `PATH` 1.x with
  no pin keeps today's copy). Run them on the unchanged code and save the failing output to
  `proof/red-1.txt`; check: the file shows each new test failing.
- [x] 1.2 Add `openspecCli(root)` and `openspecRefusal(cli, versionText)` to
  `plugins/openspec/hooks/guard.mjs` and use them in `sessionChange` (D-1); check: the `guard.test.mjs`
  `field-fixes 6` tests pass.
- [x] 1.3 Make `plugins/openspec/hooks/flow-check.mjs#makeOpenspec`, `openspecJson` and
  `checkOpenspecVersion` resolve through them (every `change-loop.mjs` call site inherits it), and
  resolve and check the CLI in `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh`
  before copying, in the project forms only (D-1); check: every `field-fixes 6` test passes and
  `flow-check`'s existing "An OpenSpec other than 2.x" test keeps its message.
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^flow-check" --test-name-pattern="^change-loop" --test-name-pattern="^install-schemas" --test-name-pattern="roadmap" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-9, AC-14 for these modules.

## 2. Reading a change: the previous script and the archived ones (AC-1, AC-2, AC-13)

- [x] 2.1 Write the `field-fixes 2` tests in `flow-check.test.mjs` (spec `change-stages`, "A change
  begun under the previous script is recognised": headerless `proposal.md`, `design.md` and a ticked
  `tasks.md` plus a headed `evidence.md`, then a headed `readiness.md`, then a headed
  `reviews/code-quality-reviewer.md`: each still `script: previous`; a headed `requirements.md` with
  a headerless `proposal.md` stays current and reports `no-header`) and in `change-loop.test.mjs`
  (`next` on the first case ends `blocked`, `previous-script`, never `kind: grill`; the old
  `devkit-lite` form with no `requirements.md` ends the same), and the `field-fixes 1` tests in
  `change-loop.test.mjs` (spec `change-coordination`, every scenario of "A change archived on the
  default branch is not unfinished": a fake `gh` listing the archive on the default branch, a
  remote-tracking `origin/main` ahead of a stale local `main`, a failing `gh` with the archive on
  `origin/main`, a worktree on `chore/archive-baz` with no archive still listed, resuming `foo` by id
  ends archived). Run them on the unchanged code and save the failing output to `proof/red-2.txt`;
  check: the file shows each new test failing.
- [x] 2.2 Export `isPreviousScript(files, flow)` from `plugins/openspec/hooks/flow-check.mjs` with
  the earliest-file rule and call it from `collectFlow` and `computeFlow` (D-2); check: the
  `field-fixes 2` tests pass.
- [x] 2.3 Add `archivedOnDefault(start, { env, gh })` to `plugins/openspec/hooks/change-loop.mjs`,
  read it once in `unfinished(start, { env, gh })` at every rank, and pass `env` and `gh` from
  `startMode` (D-3); check: the `field-fixes 1` tests pass.
- [x] 2.4 Run `node plugins/openspec/hooks/change-loop.mjs start --lang en < /dev/null` in this
  repository and save its output to `openspec/changes/coordinator-field-fixes/proof/start-this-repo.txt`
  (D-10); check: the output names none of `change-coordinator`, `release-rebase-pin` and
  `review-workflow`.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^flow-check" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-14 for these modules.

## 3. Delivered: its own pull request and every task (AC-6, AC-13, AC-14)

- [x] 3.1 Give the fake `gh` of `plugins/openspec/hooks/deliver-check.test.mjs` keys for
  `api repos/{owner}/{repo}/pulls/<n>/files` and `api repos/{owner}/{repo}/contents/openspec/changes/<id>/tasks.md?ref=<base>`
  (an unset key fails loudly, the fake's rule), then write the `field-fixes 4` tests (spec
  `change-delivery`, every scenario; with unticked tasks on the default branch `deliver-check.mjs <id>`
  answers no archive step after its own merged PR, after a PR that only links its evidence, and after
  another change's archive PR, and from `main` its `stop-branch` reason names the PR, the tasks left
  and the branch; on the change's branch with the work ticked and no open PR the step is `open-pr`;
  with every task ticked and its own PR merged it answers the retro) and the `flow-check.test.mjs`
  ones (spec `change-stages`, "A merged pull request with tasks left" and "A pull request that only
  links the evidence"). Run them on the unchanged code and save the failing output to
  `proof/red-3.txt`; check: the file shows each new test failing.
- [x] 3.2 In `plugins/openspec/hooks/deliver-check.mjs` add `isArchiveHead`, `prFiles`, `isOwnPr`,
  `tasksOnDefault` and `deliveryOf`, rewrite `findChangePr`'s list and branch paths, make
  `collectState`'s `postMerge` read `delivered`, and give `stop-branch` the reason of D-4; change the
  `deliver-check.test.mjs` tests D-11 names for this rule; check: the `field-fixes 4` tests of
  `deliver-check.test.mjs` and every D-11 test pass.
- [x] 3.3 In `plugins/openspec/hooks/flow-check.mjs` make `collectFlow`'s `postMerge` and
  `readDelivery` use `deliveryOf`, and add the `tasks-left-after-merge` sentence to both languages
  of `TEXT` (D-4); give the post-merge fixtures of `flow-check.test.mjs` and `change-loop.test.mjs`
  the files and `tasks.md` answers (D-11); check: the `field-fixes 4` tests of `flow-check.test.mjs`
  pass and the `change-loop replies: no internal term` test passes with the new sentence.
- [x] 3.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-6, AC-14 for the delivery.

## 4. The devkit-reviews check (AC-3, AC-4, AC-5, AC-13, AC-14)

- [x] 4.1 Write the `field-fixes 3` tests in `deliver-check.test.mjs` (spec `reviews-check`, every
  scenario; each of "A change on another schema" and "The archive of a change on another schema"
  runs through both `deliver-check.mjs --ci` and `node guard.mjs ci`; the two retro messages of D-5
  checked word for word). Run them on the unchanged code and save the failing output to
  `proof/red-4.txt`; check: the file shows each new test failing.
- [x] 4.2 In `plugins/openspec/hooks/deliver-check.mjs` add `isDevkitScript`, extract today's
  single-change check into `checkOne`, return `{ several }` from `selectCiChange`, and give `runCi`
  the other-script note and the several-changes judging, text and JSON of D-5; change the
  `--ci selection 3 ... two fail (R-3)` test as D-11 says; check: the `field-fixes 3` tests for
  AC-3 and AC-4 pass.
- [x] 4.3 In `archivePrCheck` and `runCi` judge each archived folder by its own schema and print the
  two retro messages of D-5; check: the `field-fixes 3` retro and archive tests pass and
  `--ci on an archive branch: an unanswered proposal, a retro without the section and a missing retro fail the check`
  passes unchanged.
- [x] 4.4 Create `docs/adr/0012-the-reviews-check-follows-the-change-script.md` by copying the
  fenced `markdown` block of design D-5 (the one that opens `# ADR 0012:`) without its fence, set its `Status:` to `accepted` and its `Accepted by:` line to the owner's words of
  `approval.md` when the owner accepted it there (else stop and report), add the three dated Notes
  of D-5 to `docs/adr/0002-merge-without-the-owner-opt-in.md`, `docs/adr/0003-auto-merge-the-archive-pr.md`
  and `docs/adr/0004-devkit-per-project.md`, and add ADR 0012 to the ADR line of
  `openspec/config.yaml`; check: `python3 scripts/check.py` passes and every link in the new ADR
  resolves.
- [x] 4.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3, AC-4, AC-5, AC-14 for the CI check.

## 5. openspec-setup: GitHub and the schema upgrade (AC-7, AC-8, AC-10, AC-13)

- [x] 5.1 Write the `field-fixes 5` tests in
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` (spec `project-setup`, the
  first four requirements, every scenario; the AC-8 case with a `test` job reported on a pull
  request head and a `publish` job reported only on the default branch; the Actions permissions
  and the runs each answering an error give `unknown`, never `blocked`, and leave the exit code 0
  when every item is fine). Run them on the unchanged
  code and save the failing output to `proof/red-5a.txt`; check: the file shows each new test
  failing.
- [x] 5.2 In `github-setup.mjs` add the `repository` checks, the `blocked` ruleset with the
  `deferred` auto-merge, the pull-request-head contexts and the exit rule of D-6; change the two
  `github-setup.test.mjs` tests D-11 names; write step 7 of
  `plugins/openspec/skills/openspec-setup/SKILL.md` as D-6 says; check: every `github-setup.test.mjs`
  test passes.
- [x] 5.3 Write the `field-fixes 7` tests in a new
  `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs`, imported by
  `plugins/openspec/hooks/guard.test.mjs` with a comment line like the other setup imports (spec
  `project-setup`, the last four requirements, every scenario; a scratch project with the `v0.13.0`
  schemas, copied from a committed fixture
  `plugins/openspec/skills/openspec-setup/scripts/fixtures/schemas-0.13.0/` that this task writes
  once from `git show v0.13.0:plugins/openspec/schemas/<s>/<file>` for every file of both schemas
  (CI checks out without tags, so no test reads a tag), three changes under way in a
  worktree and the main checkout plus a fourth on a schema that is neither `devkit` nor
  `devkit-lite`, listed as untouched and given no file by `--apply`, the listing, `--apply --owner-answer`, then `install-schemas.sh`,
  then the real `openspec instructions apply --change <id> --json` not blocked for the started one,
  `deliver-check.mjs` stopping once at `stop-plan-approval` for the plan-ready one and going on after
  an `approval.md` written from an owner message, `change-loop.mjs next` ending `blocked`,
  `previous-script` for the short one; `--apply` without `--owner-answer` exits 2; an existing
  `approval.md` is never overwritten). Run them on the unchanged code and save the failing output to
  `proof/red-5b.txt`; check: the file shows each new test failing.
- [x] 5.4 Add `readFlowFile(path)` to `plugins/openspec/hooks/flow-check.mjs` (called by `readFlow`)
  and create `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs` (D-7); check:
  the `field-fixes 7` tests pass.
- [x] 5.5 Rewrite steps 1, 4 and 6 of `plugins/openspec/skills/openspec-setup/SKILL.md` as D-1 and
  D-7 say; check: `python3 scripts/check.py` passes and the step names
  `scripts/changes-under-way.mjs`, the one owner question and the `--owner-answer` run.
- [x] 5.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs && python3 scripts/check.py` green; covers AC-7, AC-8, AC-10, AC-14 for the setup.

## 6. The CompozyOS kit's re-run (AC-11, AC-13)

- [x] 6.1 Write the `field-fixes 8` tests in a new
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs` (spec `compozy-kit-setup`,
  every scenario; a first install writes the eight files and the manifest; a re-run with a changed
  template updates an unedited file; a re-run over a file already equal to its rendering reports
  it `same`, leaves its modification time unchanged and records its digest; an edited `loop.yaml` is left in place with its difference
  printed while the others update; `--accept .compozy/loops/openspec-change/loop.yaml` writes it; an
  install with no manifest treats a differing `config.toml` as edited; the loop template's `propose`
  prompt and the tech-lead shell say not to answer the grill and to return its questions in
  `open_questions`). Run them on the unchanged code and save the failing output to
  `proof/red-6.txt`; check: the file shows each new test failing.
- [x] 6.2 Create `plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs` (D-8) and rewrite
  steps 2 to 6 and "Re-running over an existing `.compozy/`" of
  `plugins/compozy/skills/compozy-setup/SKILL.md` and the re-run text of `docs/compozy-kit.md`;
  check: the `field-fixes 8` install tests pass.
- [x] 6.3 Apply the four grill corrections of D-8 to
  `plugins/compozy/skills/compozy-setup/templates/agents/tech-lead/AGENT.md` and
  `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml`; check: the
  `field-fixes 8` grill tests and `loop-template.test.mjs` and `role-shells.test.mjs` pass.
- [x] 6.4 Re-install this repository's `.compozy/` with
  `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs . --set __VERIFY_COMMAND__="python3 scripts/gen-catalog.py --check && python3 scripts/check.py" --set __TIMEZONE__=America/Sao_Paulo`,
  accepting the two corrected files after reading their differences, so `.compozy/kit-manifest.json`
  exists (D-8). The owner's yes for those two files is the plan approval quoted in `approval.md`
  (the grill-sentence item of `proposal.md`, "What the owner approves"), not the implementer's
  decision: pass `--accept` for exactly those two paths, and stop and report if any other file
  comes out `edited`; check: `adoption.test.mjs` passes and `git diff --stat -- .compozy` shows only the
  two corrected files and the manifest.
- [x] 6.5 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && python3 scripts/check.py` green; covers AC-11, AC-14 for the kit.

## 7. Documents, release and the whole suite (AC-12, AC-13, AC-14)

- [x] 7.1 Write the test `field-fixes 12 roadmap: the round 17b line is read before round 18` in
  `plugins/openspec/hooks/guard.test.mjs` (`readRoadmap` over this repository's
  `openspec/roadmap.md`: a round titled `Round 17b: field fixes of 0.16.0` placed after round 17 and
  before round 18, holding `coordinator-field-fixes` unticked with `after: change-coordinator`);
  check: it passes on the roadmap text already in the working tree.
- [x] 7.2 Update `docs/openspec-flow.md`, `plugins/openspec/README.md` and `CONTRIBUTING.md` as D-9
  lists, every place named there; check: `python3 scripts/check.py` passes and
  `git grep -n "OpenSpec 1.16" -- docs` prints nothing.
- [x] 7.3 Bump devkit-openspec to 0.17.0 and devkit-compozy to 0.2.0 in their `plugin.json` and in
  `.claude-plugin/marketplace.json`, the marketplace to 0.21.0, add the `CHANGELOG.md` section of
  D-9, and run `python3 scripts/gen-catalog.py`; check: `python3 scripts/gen-catalog.py --check`
  passes.
- [x] 7.4 List in `openspec/changes/coordinator-field-fixes/proof/README.txt` which `field-fixes`
  test reproduces each of the eight defects and which red file shows it failing (D-10); check: each
  defect 1 to 8 has a test name and a red file that holds that name.
- [x] 7.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command); covers AC-12, AC-13, AC-14 and every criterion's tests at once.

## Workflow follow-up

- After the merge, tag `v0.17.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 17b line of `openspec/roadmap.md` (AC-12).
- In the next change: install the release in the three field projects again and check each defect
  there (A-16), and bump their pinned `devkit-reviews` workflow to `v0.17.0`'s commit.
