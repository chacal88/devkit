# Changelog

## 0.44.0 — a project slice is claimed when it opens

- **devkit-openspec** 0.40.0: with an origin remote, `/devkit project <slice>` now claims the slice
  when it opens, as a change's open does: the open commits the slice's folder with the machine's name
  and pushes its branch by a push that only creates it, so a slice already open on another machine is
  refused, naming that machine, before any phase starts
  ([ADR 0029](docs/adr/0029-a-project-slice-is-claimed-on-github-when-it-opens.md)). The slice's
  readout shows the machine of its claim under its title; the board and `/devkit status` still list
  no slice. A slice's branch is public from its open, and a remote that refuses the new branch now
  fails the open. With no origin remote the open is unchanged, and so is the delivery.
- Docs: ADR 0029, with Notes in ADRs 0015 and 0020; the flow doc, the coordination design and the
  pack's README say it.

## 0.43.1 — a change's own pull request may edit another change's archive

- **devkit-openspec** 0.39.1: `deliver-check` counts a merged pull request as the change's own when it
  also edits another change's archived files; only a file in the change's own archive folder
  (`openspec/changes/archive/<date>-<id>/`) refuses it, so `/devkit change` finds such a pull request
  after its merge instead of asking to open it again. The CI snippet now pins `v0.39.1`, the
  release's tag.

## 0.43.0 — a merge of the base stales only the change's own files

- **devkit-openspec** 0.39.0: the delivery checker, the stage checker and `deliver-check --ci` judge a
  merge of the base by the change's own files. A merge of `origin/<base>`, and the base commits it
  brings in, leave `evidence.md` and the approved or declined reviews current unless they touch a path
  the change changed against the base (a moved file counts on both sides; the release files are never
  own); the reason of a stale record names the merge and the own file. A rejected review keeps the
  strict rule. The rule fails safe to today's verdict when there is no `origin/<base>`, the base the
  merge brought in is not fetched, the merge is of another branch or the head is already in the base;
  the base is `GITHUB_BASE_REF`, else the configured `two-prs` base, else `origin/HEAD`, else `main` or
  `master`. A release merge that brings only release files no longer sends the loop back to `verify`
  and `review`: it hands the plain push. The delivery train judges each boarded change by the same
  rule, against the base of the train's pull request. The pull request's required `check` CI is the
  backstop for a base change the change depends on without touching its files
  ([ADR 0025](docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md), which amends
  [ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md)). The CI snippet now pins `v0.39.0`, the
  release's tag.
- **devkit-core** 0.15.0: the `review-change` skill says that a merge of the base that brings none of
  the change's own files leaves an approved or declined review current.
- Docs: ADR 0025, with a Note in ADR 0002; the flow doc and `CONTRIBUTING.md` state the own-files rule.
- Projects: nothing to re-run; a change under way reads the new rule at once.

## 0.42.0 — the test suite runs by file, in parallel

- **Repository** (`scripts/test-suite.mjs`, `CLAUDE.md`, `CONTRIBUTING.md`, `openspec/config.yaml`): one command,
  `node scripts/test-suite.mjs`, replaces `node --test plugins/openspec/hooks/guard.test.mjs`. It runs every
  `*.test.mjs` of the four folders the old command ran, each file in a process of its own and several at once (as many as
  the machine has cores; `--concurrency=<n>` on a loaded machine), takes file arguments and `--test-name-pattern=`, and
  exits non-zero when a test fails, naming it ([ADR 0026](docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md)).
  `CLAUDE.md`, `CONTRIBUTING.md` and the agents' context in `openspec/config.yaml` quote it, with the time measured on an
  idle 8-core machine.
- **devkit-openspec** 0.38.0: the helpers that test files shared moved out of the test files into
  `plugins/openspec/hooks/test-fixtures.mjs` (no test, nothing made when it is imported), so no test file imports another
  and `guard.test.mjs` holds only the guard's own tests. The script refuses a `*.test.mjs` under `plugins/` that imports
  another, naming the file and the line, and gives each file its own empty `TMPDIR` (a real path, under one run root it
  removes at the end); a file that leaves anything there fails the run, and the summary names what it left.
- **devkit-core** 0.14.2: the header comment of the review round's test file names the new command (comment only).
- **CI**: the job `check` has one `Test suite` step, `node scripts/test-suite.mjs`, in place of `Hook tests` and
  `Hook tests left nothing in TMPDIR`.
- **`scripts/check.py`** refuses a skipped test (`skip`, `only` or `todo`) in the suite's files; `plugins/compozy` is
  exempt, its skips guard a missing `compozy` program.
- Docs: ADR 0026 (accepted); the CI snippet now pins `v0.38.0`, the release's tag.

## 0.40.0 — the CompozyOS driver

- **devkit-openspec** 0.36.0: a project that sets `driver: compozy` runs its changes on CompozyOS.
  `/devkit change` and `/devkit roadmap` start the run with `change-loop.mjs compozy-start` and
  `roadmap-loop.mjs compozy-start` and reply with where to follow it; the session runs no loop. Each
  turn of the CompozyOS loop asks the same checker the Claude driver asks (`change-loop.mjs next --view
  compozy`), has it confirm the reading, and runs the one step it names; the owner's gates (the grill,
  the mock-up and plan approvals, the retro answers) are CompozyOS requests whose answers are recorded by
  scripts, and no tool of a CompozyOS session writes `approval.md`. The new agent `change-coordinator`
  is the loops' hands. The CompozyOS driver does not carry the token budget, the Jira entry and
  write-back, the `state` command, the run markers, remote machines or the `flow` notice
  ([ADR 0024](docs/adr/0024-compozy-runs-the-short-loop.md), Consequences).
- **devkit-compozy** 0.4.0: the kit is twenty-one agents generated from the Claude agent files (one per
  devkit role, named as the role, each handing its work to the Claude agent of the same name) and three
  loops: `devkit-change`, `devkit-review` and `devkit-roadmap`. The twelve-stage loop `openspec-change`
  and the four role shells leave: `compozy-setup` run again removes the ones the project did not edit,
  keeps and names an edited one, and drops the inputs the new templates no longer have.
  `gen-agents.mjs --check` runs in CI.
- Docs: ADR 0024 (proposed) amends ADR 0008, ADR 0009 and ADR 0016, with Notes in ADRs 0008, 0009, 0010 and
  0016; `docs/compozy-kit.md` is rewritten for the three loops, the seat and reinstalling over the first
  kit; the flow page, the coordination design, the roles and the pack README follow. The CI snippet now pins
  `v0.36.0`, the release's tag.

## 0.39.0 — the model is chosen by stage

- **devkit-openspec** 0.35.0: every stage has a model, chosen by the loop. `models:` in the
  `devkit:` block of `openspec/config.yaml`, or in a change's own `.openspec.yaml` (which wins),
  overrides single stages of a built-in table (Opus for the grill, the ADRs and the plan, Haiku for
  the unit-test run and the delivery hand-off, Sonnet for the rest; `opus[1m]` and `sonnet[1m]` only
  as an opt-in, which reaches a session's own model and the retry's mapping, never a stage agent,
  whose Agent call drops the suffix); an unknown stage or value is refused with `setting-unknown`.
  Every hand-off `next` prints carries the stage's `model`, which the session sets on the Agent
  call. A stage agent that stops with `Outcome: failure` on Haiku or Sonnet
  without writing its stage file is handed again once on the next model up (one that records
  `result=failed` in its stage file takes the stage's usual fix, with no retry), read from the
  transcripts on a `next` called with `--after`; a second failure, or one on Opus, ends the run
  blocked, as the loop and no longer the session declares it. In a roadmap run with a session per
  change, the coordinating session starts each change session on its first stage's model and
  switches it only down, never below the strongest model among the stage and the session-run
  stages still ahead of it (`session-model`, `session-found`, `session-model-refused`).
  `flow-check` and `/devkit status` print the tokens spent per stage and per model, the retries and
  the total against the budget cap. The CI snippet now pins `v0.35.0`, the release's tag.
- Docs: [ADR 0023](docs/adr/0023-the-model-is-chosen-by-stage.md) amends ADR 0014 decision 1;
  `docs/openspec-flow.md` gains "The model of each stage", four troubleshooting rows and a new Cost
  bullet; `docs/coordination-design.md` records `devkit.models` as final.

## 0.38.0 — delivery train

- **devkit-openspec** 0.34.0: a project that runs `trunk` or `trunk-auto` can set `devkit.delivery.train`
  (the whole-suite command) to send its reviewed changes to the base branch together. A change boards
  when its review is approved at its own head; a boarded change is not updated, verified or reviewed
  again when the base moves, and a ready archive boards like a change. `/devkit train` runs the new
  `hooks/train-loop.mjs`: it cuts `train/<n>`, joins the boarded heads in boarding order (release files
  renumbered on the train only, by `release-merge.mjs --merge <rev>`; a conflict in any other path takes
  the change off with its path), runs the whole suite once, writes the record `openspec/trains/<n>.md`
  and opens one pull request, merged with a merge commit (by GitHub in `trunk-auto`, by the owner in
  `trunk`). A red train is bisected: the change at the end of the smallest red prefix leaves with the
  failure and the rest departs on a new train. On a train's pull request `devkit-reviews` judges each
  boarded change at its own head and the record; a change's own evidence no longer has to carry the
  gate parts the train proves. Without the key nothing changes.
- **devkit-core** 0.14.1: `pr-verifier` records a gate part the train proves as `train:` and never as a
  pass.
- Docs: ADR 0022 (accepted) amends ADR 0002, 0003, 0012 and 0018; the flow page, the coordination
  design, the roles, the pack README, CONTRIBUTING and the `ship-change` rows follow. The CI snippet
  now pins `v0.34.0`, the release's tag.

## 0.37.0 — every change of a roadmap run opens at its start

- **devkit-openspec** 0.33.0: a `/devkit roadmap` run on the desktop app opens every pending change
  at its start and starts each change's session with a one-use ticket, so the session runs its loop
  from its first turn with no typed command: the new `devkit-session` skill is the entry, and a hook
  on the Skill tool (`guard.mjs skill`) lets it run only on the run's unclaimed ticket
  ([ADR 0021](docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md)). The grills, plan
  approvals and retro answers of every change are asked in the coordinating session; places count
  only the implementation, test, evidence and review stages; a change waits for a place, the load or
  its dependencies in its own session (title `⏳ <id>`) and merges the default branch before it plans;
  the run holds one periodic check while it lasts and cleans up its waits, cron and finished sessions
  at its end (`schedule-check` and `delete-check` are actions of a decision). New subcommands:
  `session-next`, `session-wait`, `merge-base`, `push` and `check`. A change session's `session-next`
  now honours the token budget as `next` does. The `devkit` and `devkit-lite` flows are released as flow version 2, which adds the `requirements-triage` helper to the grill: a change opened from this
  release records `x-devkit-flow: 2` and has the triage; a change opened before keeps flow 1 and its grill with no triage until the owner moves it with `change-loop.mjs flow <id>`;
  the `devkit-project` flow stays at version 1. With the machines setting set, a change session of this
  machine on the run's ticket takes its place from the run's own count: its plan on `origin` is no place
  taken, and the board's row of this machine counts those places and the places of this machine's changes
  counted from `origin`, which a run with both kinds at once can take above the run's number.
  The CI snippet now pins `v0.33.0`, the release's tag.
- **devkit-core** 0.14.0: the `requirements-triage` agent answers the grill's questions the project's
  files settle, with the file that settles each, and the `requirements-grill` skill asks it first.
- Docs: ADR 0021, with Notes in ADRs 0004, 0006, 0010, 0011, 0013, 0014 and 0017; the flow doc, the
  coordination design, the roles and the READMEs describe the new run.
- Projects: re-run `openspec-setup` to install `flows/2.json`; changes under way keep flow 1 and their grill
  with no triage until they are moved.

## 0.36.1 — retro proposals of remote-worker

- **devkit-core** 0.13.3: `plan-readiness-review` has a new core rule: a plan revision that follows a
  merge of `main` re-reads the project's rules (`openspec/config.yaml`) before it is reviewed.
- Docs: CONTRIBUTING says that a change that merges a base runs by name the tests that base added
  since the plan's base before the evidence run.

## 0.36.0 — remote worker

- **devkit-openspec** 0.32.0: a change can run on another machine. Opening a change in a repository
  with an `origin` commits its folder with the request and the machine's name and pushes its branch
  at once, so no machine opens an id that is open on another one (`claimed`); of two machines opening
  one id at the same moment, one wins. The new per-person `machines` setting lists the other machines
  (SSH connection, folder, places); with it set, `/devkit roadmap` opens each change on the machine
  with the fewest open changes, makes its worktree there over SSH (`roadmap-loop.mjs checkout`), and
  starts its session on that machine's connection. A change takes a place of its machine only from its
  implementation on (`change-loop.mjs place`); with none free it ends blocked (waiting for a place),
  and a freed place wakes one waiting change. `/devkit status` shows where each change is and reads
  "no answer" for a machine that does not answer (`status --json`, `machine-probe.mjs`).
- Docs: ADR 0020 (accepted) amends ADR 0013, ADR 0014 and ADR 0017 (decision 4: the title of a change waiting for a place); the flow page, the coordination design and
  the pack README follow. The CI snippet now pins `v0.32.0`, the release's tag.

## 0.35.1 — retro proposals of change-version-pin

- **devkit-core** 0.13.2: the stage-1 reviewer prompt of `review-change` now also says: run every
  test in the foreground and give your answer when it ends; start no background command and leave
  none running. A reviewer that started its own background wait loop delayed a round by hours; a
  test in `review-round.test.mjs` pins the sentence.
- Docs: CONTRIBUTING says how CI judges a test (an empty `TMPDIR` that must stay empty) and what a
  test that calls code in its own process has to do; the flow page says what a merge of the base
  costs a change in delivery and who holds the other merges off.

## 0.35.0 — change-version-pin

- **devkit-openspec** 0.31.0: a change follows the flow it was opened with. `change-loop.mjs open`
  records `x-devkit-version` and `x-devkit-flow` in the change's `.openspec.yaml`; every reader of
  the change's stages (the readout, the change, roadmap and project loops, the edit hook, the CI
  check, the conductor and the locks) reads `flows/<n>.json` of that version, and a change with no
  record follows version 1. Each schema folder keeps every released `flows/<n>.json`. When a newer
  flow is installed, the readout and the `resume` reply say so in one line, and the change moves
  only on the owner's request, with the new `change-loop.mjs flow <id>`; the `script` switch
  records the new script's flow. `scripts/check.py` refuses a `flow.json` changed with its version
  kept, against `scripts/released-flows.json`. The CI snippet now pins `v0.31.0`, the release's tag.
- Docs: `docs/openspec-flow.md` ("The flow a change follows", "Moving to a newer flow"),
  CONTRIBUTING.md (a flow change raises its version), the pack README and the setup skill.
- Projects: move the pinned `devkit-reviews` workflow to the commit of `v0.31.0` to honour the
  recorded flows in CI; re-run `openspec-setup` to get `flows/`.

## 0.34.1 — retro proposals of release-tags

- **devkit-openspec** 0.30.1: `accept-decisions` writes the acceptance line of an ADR whose status is
  a bulleted `- Status:` line as `- Accepted by: ...`, as ADR 0017 and 0018 read, not as a second
  `- Status: Accepted by: ...` line; a status line of another form keeps its prefix. The CI snippet
  now pins `v0.30.1`, the release's tag.
- Docs: CONTRIBUTING asks a change that reads a GitHub route for the first time to record one
  read-only live call of it in `evidence.md`; a fake-gh fixture alone does not prove the route or
  the shape.

## 0.34.0 — release tags

- **devkit-openspec** 0.30.0: a project that sets `devkit.release_tag` (a path from the repository
  root to a JSON file with a top-level `version`) has the tag of each release pushed by the delivery
  loop. After a merge that bumped the version, `deliver-check` answers the new `tag-release` step
  (before the retro; for the archive PR, before `archived`), and `ship-change` creates the
  lightweight tag `v<version>` on the merge commit and pushes it alone. A tag at another commit ends
  the run `blocked` and is never moved; a read GitHub does not answer stops, never passes. Without
  the key nothing changes. This repository sets it to devkit-openspec's `plugin.json`
  ([ADR 0019](docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md)). The CI snippet now
  pins `v0.30.0`, the release's tag.
- Docs: CONTRIBUTING step 5 and the flow page describe the key, rows R1 to R3 and the step.

## 0.33.0 — release conflicts resolved by a merge

- **devkit-openspec** 0.29.0: when a pull request conflicts with its base only in release files, the
  release-conflict step merges `origin/<base>` into the branch with `hooks/release-merge.mjs` (was
  `release-rebase.mjs`, which rebased), renumbers the release above the base's and commits the
  merge, never pushing. After the evidence and the review run again, the loop hands a plain
  `git push`. The `push-rebased` step and its force-with-lease push are gone. The CI-pin assertion
  of the hook tests reads the version from the manifest. The CI snippet now pins `v0.29.0`, the
  release's tag.
- Docs: the flow document, the `devkit` skill, the pack's README and CONTRIBUTING follow, and the
  roadmap gains a line for the live check.

## 0.32.3 — retro proposals of delivery-models

- **devkit-core** 0.13.1: `tdd-implementer` runs a long suite in the background and never waits with a
  polling loop; `pr-verifier` may let one green whole-suite run stand for the gate parts it imports.
- Project config: plans name an ADR number or version by rule, not by value.

## 0.32.2 — change-state retro fixes

- **devkit-openspec** 0.28.2: the `change-state ADR 0017: the documents follow` test finds
  `approval.md` in the archived change folder once the change is archived, so the archive pull
  request stays green. The repository check `scripts/check.py` now refuses an un-awaited
  `t.test(` subtest in a hook test file, and CONTRIBUTING says to await every subtest. The CI
  snippet now pins `v0.28.2`, the release's tag.

## 0.32.1 — retro of change-budget

- **devkit-openspec** 0.28.1: the `ship-change` `review` row commits every modified or untracked
  file under the change folder before a review round, so the verdicts are not recorded against
  uncommitted changes.
- Docs: `CONTRIBUTING.md` says to fetch `main` again right before each push of the delivery and
  before `enable-auto-merge`, since a sibling that merged in between took the release number.

## 0.32.0 — delivery models per project

- **devkit-openspec** 0.28.0: a project chooses its delivery model in `devkit.delivery.model` of
  `openspec/config.yaml`: `two-prs`, `trunk` or `trunk-auto` ([ADR 0018](docs/adr/0018-the-delivery-model-is-chosen-per-project.md)).
  In `two-prs` both pull requests open together from the task branch and the owner merges both; the
  test branch never enters the task branch (a hook refuses the command, and `devkit-reviews` fails a
  pull request to the base branch that holds a test-branch commit or whose test-branch pull request is
  not merged); a conflict is solved on the support branch `<id>-<test branch>`, reviewed on its own
  before it is pushed; the change is archived through two archive pull requests. A project on `two-prs`
  adds `pull-requests: read` and `GH_TOKEN` to its `devkit-reviews` workflow (the template has both).
  The CI snippet now pins `v0.28.0`, the release's tag.
- **devkit-core** 0.13.0: `review-change` reviews a support branch's resolution on its own, the
  `code-quality-reviewer` and `test-coverage-reviewer` read it, and `commit-and-pr` gains the two-PR
  call and the test-branch archive call.
- Docs: ADR 0018, with Notes in ADRs 0002, 0003, 0010 and 0012; the coordination design records the
  conflict answer and the built lock; `docs/openspec-flow.md` gains "Delivery models".

## 0.31.0 — gh version check

- **devkit-openspec** 0.27.0: `deliver-check` and the loops name a `gh` older than 2.50.0 (the
  first with `gh pr checks --json`) with its own blocked reason that gives the installed version
  and asks for an update, instead of "GitHub cannot be read"; `openspec-setup` step 1 checks `gh`
  once and warns without stopping the setup. The CI snippet now pins `v0.27.0`, the release's tag.

## 0.30.1 — a review fixed in the plan files

- **devkit-openspec** 0.26.1: a rejected verdict goes stale after any later commit outside the
  change's own review record (`reviews/`, `review.md`, `evidence.md`), `openspec/` and test files
  included, so a fix made in the plan files gets the next review round with no hand from the owner;
  a commit of the record alone keeps `fix-review`; approved and declined verdicts keep their rule.
  The CI snippet now pins `v0.26.1`, the release's tag.
- **devkit-core** 0.12.1: the `review-change` skill's stale definition names the rule for a rejected
  verdict.
- Docs: the staleness rule, the order of the delivery steps and the `update-branch` row of the flow
  document.

## 0.30.0 — the Jira entry

- **devkit-openspec** 0.26.0: `/devkit change <Jira key or link>` opens the change from that task.
  The session reads it through its own Atlassian connector; `change-loop.mjs` makes no call and
  keeps no token. `start` answers the `task` mode, `open --task <KEY>` writes a `Jira: <KEY> <link>`
  line and the quoted title, description and acceptance-criteria field under `## Request`, and the
  key resumes its unfinished change (a second change for it is refused). When the pull request
  opens, `next` carries `writeBack` and `write-back ask|answer` asks the developer once whether to
  comment the link and move the task; Jira is written only on that yes, and the question is
  recorded in the git common directory. New module `jira-task.mjs`.
- **devkit-core** 0.12.0: the `requirements-grill` skill asks only what a request copied from a
  task leaves open, recording the rest as assumptions answered by the task.
- Docs: the flow document, the design document and ADR 0010 (a dated Note: no task-source
  setting) record the entry; the roadmap gains round 20b (`jira-entry-live`).
- CI: the snippet now pins `v0.26.0`, the release's tag.

## 0.29.0 — the change budget

- **devkit-openspec** 0.25.0: a `/devkit change` run stops at a token budget. `budget:` in the
  `devkit:` block of `openspec/config.yaml`, or in a `devkit:` block of a change's own
  `.openspec.yaml` (which wins), is a whole number of tokens; the loop counts the session's
  spend from its transcripts and, between hand-offs, turns the next hand-off into an end waiting
  for the owner (`waiting-budget`) that names the spend, the cap and the file to raise. With no
  cap, no session id or an unreadable transcript, nothing is counted and nothing stops. An invalid
  value is refused with the settings reply. The roadmap loop maps the new end to a gate. The CI
  snippet now pins `v0.25.0`, the release's tag.
- Docs: `docs/openspec-flow.md` gains "The token budget" and a troubleshooting row;
  `docs/coordination-design.md` records the setting's name as final.

## 0.28.0 — one state per change

- **devkit-openspec** 0.24.0: the change loop derives one state per change in one place, and a new
  `change-loop.mjs state` command prints it (state, reason, stage and the session title) for one
  change or every unfinished one. A GitHub that does not answer is a wait on GitHub, not a block,
  and three failed reads in a row still end the wait blocked. A stopped change's session title
  carries its state icon (🙋, ⏳ or ⛔) before the stage icon, and `/devkit status` places its rows
  by the same state.
- Docs: ADR 0017 (a change's state is derived in one place, amends 0014), Notes in ADR 0010 and
  ADR 0014, the flow and design pages.

## 0.27.0 — commit attribution

- **devkit-core** 0.11.0: `commit-and-pr` takes an attribution block from the caller and writes exactly its
  commit trailer and pull-request footer lines over the ones its own environment gives it; with `none` it writes
  no attribution, and with no block it behaves as before.
- **devkit-openspec** 0.23.0: every hand-off to `commit-and-pr`, in `/devkit change`, `/devkit roadmap` and
  `/devkit project`, ends with a request that the session append its own attribution block; the `ship-change`
  skill gains an Attribution section and its `commit`, `open-pr`/`push` and `open-archive-pr` rows name it.
- Docs: `docs/openspec-flow.md` describes the Attribution paragraph. The CI snippet now pins `v0.23.0`, the
  release's tag.

## 0.26.1 — test fixtures clean up after themselves

- **devkit-openspec** 0.22.1: `test-tmp.mjs` makes every temporary folder of the hook tests and
  removes it when its test ends, passed or failed, and sweeps the rest at the end of the run or on
  `SIGINT` and `SIGTERM`; every hook and setup test file uses it. The CI snippet now pins `v0.22.1`.
- **devkit-core** 0.10.1: the same helper, a byte-identical copy, for the `review-round` tests.
- **devkit-compozy** 0.3.1: the same helper, a byte-identical copy, for the compozy tests.
- CI: the hook tests run on an empty `TMPDIR` and a new step fails the job when anything is left in
  it. `CONTRIBUTING.md` states the rule: a test makes its folders through `test-tmp.mjs`.

## 0.26.0 — the stage roles

- **devkit-core** 0.10.0: four stage roles, `screen-designer`, `adr-author`, `test-runner` and
  `e2e-tester`, with the skills `screen-mockup`, `adr-authoring` and `e2e-testing`. `pr-verifier`
  records the demonstration as text in `evidence.md`, with no image and no pull-request comment.
- **devkit-openspec** 0.22.0: the `devkit` script's mock-up, decisions, unit-tests and E2E stages
  run. The mock-up applies only when the grill flags `ui` and waits for the owner's answer; the
  decisions stage always runs; the unit and E2E stages run when the project declares
  `devkit.tests.unit` or `devkit.tests.e2e` (and `devkit.tests.coverage.command` and
  `devkit.tests.coverage.target`). A stage that does not apply, or that the change had already
  passed, leaves no file, and the readout says why. `change-loop.mjs` hands the new stages to their
  roles, adds `fix-tests` and the `accept-decisions` step (the loop's new subcommand, run once the
  plan approval is recorded). The edit lock lets `adr-author` write decision records and
  `e2e-tester` write test files. `devkit-lite` no longer lists the mock-up and decisions stages.
  The CI snippet now pins `v0.22.0`, the release's tag.
- **devkit-compozy** 0.3.0: the four role shells name the new agents, and the loop's design, review
  and implement prompts name the mock-up, the test agents and the decision records.
- Docs: ADR 0016 (stage roles write their own files, amends 0010 and 0011), `docs/roles.md`, the
  flow and design pages, the roadmap (round 16b `coordinator-loop-fixes` carries the retros' items).

## 0.25.2 — follow-ups of the project phases

- **devkit-openspec** 0.21.2: the slice contract refuses an ADR verdict recorded with uncommitted
  changes, from `devkit-reviews` and the `gh pr create` hook, and `/devkit project` neither records
  it nor moves on: it hands the review back to the ADR reviewer. New tests pin the contract's
  fail-closed branches and a merge that brings an ADR. The CI snippet now pins `v0.21.2`, the
  release's tag.
- Docs: the slice contract says what a current ADR verdict is; the archived `project-phases` plan
  and the pack README name ADR 0015 for the slice decision; the roadmap gives the dogfood of the
  first real slice a line of its own (`project-slice-dogfood`).

## 0.25.1 — retro of review-writer-prompt

- **devkit-openspec** 0.21.1: the `ship-change` `stop-plan-approval` row writes the owner's words
  inside backticks, so the language check never reads them as prose. The CI snippet now pins
  `v0.21.1`, the release's tag.
- Docs: the roadmap gains round 17h (`fresh-base-check`, `delivery-merge-hold`); the config context
  asks a plan that moves or writes a parser to decide what unterminated input does.

## 0.25.0 — review round tooling

- **devkit-core** 0.9.0: the review round script takes `args.head`, the full sha of HEAD, and
  refuses a stage-1 answer at another commit, with a short sha, or a partial one (files not read)
  before the verify stage; the stage-1 prompt asks for one sha per disposition, for the sha
  `git rev-parse HEAD` printed and for the files read; `review-round.mjs outcomes` returns each
  outcome's writer prompt as `jobs`, which leaves out the stage-1 `Verdict:` and `Commit:` lines;
  `check-file` refuses a second `Verdict:` or `Commit:` line. The six reviewer agents' Staged round
  paragraph says the same.
- **devkit-openspec** 0.21.0: a commit of test files only stales only `code-quality-reviewer` and
  `test-coverage-reviewer` (and the evidence), and `flow-check` reports the review stage stale
  while any reviewer is stale; `deliver-check` no longer counts a checkbox inside a fenced example
  of `tasks.md` as a task. The CI snippet now pins `v0.21.0`, the release's tag.
- Docs: the flow document and the `review-change` and `ship-change` skills follow.

## 0.24.1 — retro of project-phases

- **devkit-core** 0.8.2: the reviewer prompt of the review round names the finding id format and the
  commit command, so a stage-1 object is not refused for ids or a placeholder sha; `tdd-implementer`
  never stops a process by pattern.
- Docs: CONTRIBUTING covers version and ADR numbers when changes run in parallel; a roadmap line for the
  project flow's follow-ups.

## 0.24.0 — the project phases, /devkit project

- **devkit-openspec** 0.20.0: `/devkit project <slice>` takes a new project or one slice of it through
  its four design phases, in the owner's session, to one pull request. A slice is a change on the new
  `devkit-project` schema (installed by `openspec-setup` with the other two); a new script,
  `project-loop.mjs`, decides each call. The roadmap stage appends the rounds to `openspec/roadmap.md`
  only after the owner approves them, or is not applicable. The ADR reviewer is the slice's only review,
  and `devkit-reviews` and the `gh pr create` hook judge a slice's pull request by one slice contract. The
  CI snippet now pins `v0.20.0`, the release's tag: a project moves its CI pin to `v0.20.0` before it
  sets `ship: devkit-project: merge`, because an older check passes a slice with a note.
- **devkit-design** 0.2.0: the five skills ask for the slice and write under `docs/design/<slice>/`,
  and called by name they write no roadmap and open no pull request.
- Docs: ADR 0015 (accepted) amends ADR 0010 and ADR 0012; the coordination design, the flow
  document, the role document and both READMEs follow.

## 0.23.1 — merge staleness by the first parent

- **devkit-openspec** 0.19.1: a merge commit counts the files that differ between its first parent
  and itself (what it brought into the branch, edits made while resolving and moved files
  included), and the commits it brings in are still checked one by one; an update of the branch
  that brings only `openspec/` files leaves reviews and evidence current. The CI snippet now pins
  `v0.19.1`, the release's tag.
- Docs: the staleness rule and the `update-branch` row of the flow document say how a merge commit
  is read.

## 0.23.0 — follow-ups of the roadmap coordinator

- **devkit-openspec** 0.19.0: in the desktop app each change of a `/devkit roadmap` run runs in a
  session of its own, nested under the owner's session and titled with the icon of its stage; a
  session started by another session is held by the change run's locks; a start the app refuses
  waits for the owner's next message; `/devkit roadmap 2` takes its arguments as typed; the owner
  can tell the session to start the held changes anyway; a killed watch of the load holds nothing;
  the run file is locked while it is written, and the board says the others go on only when another
  change is under way. The CI snippet now pins `v0.19.0`, the release's tag.
- Docs: ADR 0014 (accepted) supersedes ADR 0013 decision 1 where the host can start sessions and
  amends ADR 0011 and ADR 0013; ADR 0013 decision 4 names every field of the run file; the flow
  document, the coordination design, the role document and the README follow.

## 0.22.1 — field fixes of 0.16.0, the rest

- **devkit-openspec** 0.18.1: `deliver-check --watch` also waits at `stop-merge-setup` when the
  change's open pull request has pending checks, and the step stays `stop-merge-setup` (field
  item 9); the verdict readers count the first `Verdict:` line of a review file and ignore a later
  one (field item 10); the openspec-setup line about the ruleset's checks always lists
  `devkit-reviews` and no longer says "none" (field item 11). The CI snippet now pins `v0.18.1`,
  the release's tag.
- Docs: the flow document says what the watch waits for and which `Verdict:` line counts.

## 0.22.0 — the roadmap coordinator, /devkit roadmap and /devkit status

- **devkit-openspec** 0.18.0: `/devkit roadmap [<n>]` runs the roadmap's ready changes, several at
  once, in the owner's session with each stage a subagent in the background; `/devkit status` shows
  where everything is and what waits on the owner. A new script, `roadmap-loop.mjs`, decides each
  call; a start is held while the processor load per core is at or above the new per-person
  `load_limit` option (80 by default); the stop, hand-off and edit locks follow every change of a
  roadmap run; one run's bookkeeping lives in the git directory; opening two changes at once is
  serialized. The CI snippet now pins `v0.18.0`, the release's tag.
- Docs: ADR 0013 (accepted) amends ADR 0010 and ADR 0011; the coordination design, the flow
  document, the role document and both READMEs follow.

## 0.21.1 — retro of coordinator-field-fixes

- **devkit-openspec** 0.17.1: the `ship-change` fix-step row says that a finding asking for a
  behaviour the spec deltas do not state sends the plan back for revision, readiness and the
  owner's approval before the fix. The CI snippet now pins `v0.17.1`, the release's tag.
- Docs: the flow document says a new change that reuses an archived id, created on a later day, is
  listed as unfinished; the roadmap carries the retro's findings into rounds 16 and 25.

## 0.21.0 — field fixes of 0.16.0

- **devkit-openspec** 0.17.0: the eight defects 0.16.0 showed in three other projects. An archived
  change is no longer listed as unfinished; a change is on the previous script when its earliest
  stage file has no header; a change is delivered when its own pull request is merged and every task
  is ticked (a further pull request carries tasks left); the `devkit-reviews` check judges only
  changes on a devkit script, each delivered change of a pull request that touches several, and
  explains a missing `retro.md` (ADR 0012); `github-setup` names Actions disabled, runs that fail
  without starting, refused rulesets and the checks the ruleset will require; every script and hook
  starts the project's pinned OpenSpec CLI, and `install-schemas.sh` refuses a project pin that is
  not 2.x; the new `changes-under-way.mjs` keeps a change under way from being sent back to the
  grill by a schema upgrade. The CI snippet pins `v0.17.0`.
- **devkit-compozy** 0.2.0: `compozy-setup` installs the kit with the new `install-kit.mjs` and a
  manifest, so a re-run keeps the files the project edited and replaces only the ones it did not.
- Projects: bump the pinned `devkit-reviews` workflow to the commit of `v0.17.0` to get the CI fix.
  `install-schemas.sh` now refuses a project pin of `@fission-ai/openspec` that is not 2.x.

## 0.20.1 — retro of change-coordinator

- **devkit-core** 0.8.1: the plan-readiness review runs every phase gate command that already exists
  on the base and counts a gate that is red there as a Mandatory finding; the planner's rule for
  `tasks.md` says a gate's command exits 0 when its phase is done, so a step that expects a failing
  run is a task with its own check, never a gate.
- Docs/roadmap: `openspec/roadmap.md` carries the retro's findings into rounds 16 and 25 and adds
  round 28 (`remote-worker`); `docs/coordination-design.md` records it as a proposed section, "Where
  a change runs", requested by the owner on 2026-11-20.

## 0.20.0 — the change coordinator and /devkit change

- **devkit-openspec** 0.16.0: the `devkit` skill, `/devkit change <what you want>`, runs one change
  from the owner's request to its archive in the owner's session. The new script `change-loop.mjs`
  (`start`, `open`, `script`, `next`, `wait`, `reply`) decides every step over `flow-check` and the
  delivery rows, opens the change in its own worktree, waits on GitHub with no time limit through a
  background command, and replies in the person's language with no internal terms. `guard.mjs` gains
  three modes and `hooks.json` three entries: `stop` and `subagent-stop` keep the session and a stage
  agent from stopping early (an end the run recorded with its `devkit-end:` line lets the turn end), and `agent` limits the hand-offs of a run to the script's roles by their pack; the edit and shell-write
  locks keep the session from writing product code in a run (ADR 0011). A user setting `language`
  (`pt-BR` or `en`) and a `devkit:` block in `openspec/config.yaml` (`language`, `driver`) hold the two
  languages. The CI snippet pins `v0.16.0`.
- **devkit-core** 0.8.0: `plan-readiness-reviewer`, `tdd-implementer` and `commit-and-pr` declare the
  skills of their stage in `skills:`.
- **devkit-panel** 0.3.0: the owner buttons fill `/devkit change <id>`, and the conducted change is
  also named by a typed `/devkit change <id>` (older `/conduct <id>` transcripts still count). The
  panel's test world names the panel in its band stand-in, so its tests pass on Claude Code 2.1.326.
- Replaces: `/conduct` (both modes) is removed; type `/devkit change <what you want>` to start a
  change, `/devkit change` to continue one; a change begun under the previous script is still
  finished with `ship-change`.
- Docs: ADR 0011 (the change coordinator is the owner's session, held by hooks) amends one sentence
  of ADR 0010 decision 8; dated Notes in ADRs 0005, 0006, 0007, 0009 and 0010;
  `docs/coordination-design.md` records four answered open points; `docs/openspec-flow.md` has the
  section "The change coordinator: `/devkit change`".

## 0.19.1 — retro of flow-script-checker

- **devkit-openspec** 0.15.1: a test of `guard.test.mjs` refuses a test env that blanks
  `DEVKIT_BRANCH` without also blanking `GITHUB_HEAD_REF` (so a pull-request CI run cannot change a
  fixture's branch), and the one `deliver-check.test.mjs` line that did is fixed. `deliver-check`
  no longer refuses the canonical `openspec/specs/<capability>/spec.md` that `openspec archive`
  writes for each capability the archived change has a spec delta for. The CI snippet
  pins `v0.15.1`.
- **devkit-core** 0.7.1: the plan-readiness review checks that every outcome row of a decision table
  in `design.md` has a scenario in the spec delta; `tdd-implementer` leaves no backup or scratch
  file in the tree.
- Docs/rules: `CONTRIBUTING.md` states the test-environment rule; `openspec/roadmap.md` carries the
  retro's findings into rounds 15 and 25.
## 0.19.0 — the script and the checker

- **devkit-openspec** 0.15.0: the `devkit` and `devkit-lite` schemas declare every stage of the flow
  in order (`flow.json` next to each `schema.yaml`), name roles instead of Claude tools, and start
  every stage file with a one-line stage header. `devkit-lite` now starts with the requirements
  grill, so `/conduct` grills a not-started lite change. `flow-check` reads the headers, OpenSpec's
  status, the task list (less fenced examples) and git, and says which stage passed and which comes
  next, with no AI; `conduct-check` reads the plan files from `flow.json`; the session text names the
  checker and the roles; `deliver-check` exports `currentBranch`, `defaultBranches` and `archiveHeads` so the
  "own branch" rule has one owner. `apply` requires `approval` in `devkit`. Projects re-run `openspec-setup` to
  get the new schemas; open changes finish on today's flow. The CI snippet pins `v0.15.0`.
- **devkit-core** 0.7.0: the plan-readiness reviewer, the verifier and the planner write the stage
  header line.
- **devkit-compozy** 0.1.1: the loop's and the tech-lead's grill wording (the grill runs when the
  schema has a `requirements` artifact).
- Docs: `docs/roles.md`, the flow page (the two schemas, the stage header and `flow-check`, OpenSpec
  2.x), the coordination design's tense. CI installs OpenSpec 2.0.0. Tagged `v0.15.0` after the merge.

## 0.18.2 — the verifier counts its own numbers

- **devkit-core** 0.6.4: `pr-verifier` records only numbers it counted at the verified commit (a
  count, a line range, a total), never one carried from memory, the plan or an earlier evidence file
  (orchestrator-replan retro).
- Docs/rules: `openspec/roadmap.md` gains rounds 25 (review round tooling, the withdrawn
  `review-writer-prompt` returned) and 26 (project setup); `docs/coordination-design.md` records
  both and the project-setup open point; `CLAUDE.md` points at the files holding the version rule.
  No other pack changes version.

## 0.18.1 — the coordination design recorded

- **devkit-openspec** 0.14.2: the pack README's first sentence names OpenSpec as the flow's harness
  and links ADR 0010, and one assertion of `guard.test.mjs` follows ADR 0007's new status. The CI
  snippet pins `v0.14.2`, as two tests of `deliver-check.test.mjs` require of any
  `devkit-openspec` bump.
- Docs/rules: ADR 0010 supersedes ADR 0001 and ADR 0007 (OpenSpec is the harness, driven by a
  roadmap coordinator and a change coordinator as a loop over files), `docs/coordination-design.md`
  holds the design and its build order, `openspec/roadmap.md` lists rounds 14 to 24 and drops the
  follow-ups of rounds 5, 11 and 13, and `openspec/config.yaml` quotes its third design rule so
  OpenSpec stops ignoring the design rules. No other pack changes version; this release is tagged
  `v0.14.2` on its merge commit.

## 0.18.0 — findChangePr's own branch

- **devkit-openspec** 0.14.1: `findChangePr` no longer treats a worktree branch that merely
  resolves to the single active change (`resolveChange`'s last fallback) as that change's own
  branch; the branch's own name must now name the change (exact tail or contained), so a merged
  PR is still found by its body link instead of reported as `none` (compozy-loop-v2 retro). The
  CI snippet pins `v0.14.1`, as two tests of `deliver-check.test.mjs` require of any
  `devkit-openspec` bump.
- **devkit-core** 0.6.3: `review-change` records `git status --porcelain` before stage 1 of a
  review round, and a stage-1 finding whose only evidence is an uncommitted edit that record does
  not show is refuted in stage 2 without a verifier.
- Docs/rules: `openspec/config.yaml` gains a proposal rule (a corrected factual claim names every
  file that repeats it) and two design rules (a sentence saying a test pins a behaviour names that
  test file; an ADR's rejected alternative needs its own ADR before readiness, never a line
  concluding none is needed); `openspec/roadmap.md` records round 12 (compozy-loop-v2) and queues
  round 13's two follow-ups. No other pack changes version; this release is tagged `v0.14.1` on
  its merge commit.

## 0.17.0 — the CompozyOS kit

- **devkit-compozy** 0.1.0: a new pack. `compozy-setup` installs `.compozy/` into a project (four
  role shells, the loop template, `config.toml`, the portable resolver `bin/devkit-kit`), and the
  `screen-design` and `screen-demo` skills back the new roles it calls. Loop v2 adds a design gate
  between the approved plan and implementation (a `screens-check` command gate, skipped for a
  change that declares no screen), a demo step (screenshots in both themes and widths plus a
  journey video, skipped without a `demo_command`), a wait on the pull request's checks with a
  CompozyOS pull-request monitor, and the `ship-change` archive steps and a worktree cleanup after
  the merge. This repository's own `.compozy/` is regenerated from the templates to prove them.
- **devkit-openspec** 0.14.0: `devkit-compozy` joins `PACKS` in `project-settings.mjs`, so
  `openspec-setup --packs devkit-compozy` installs the new pack instead of refusing it
  (`DEFAULT_PACKS` unchanged). The CI snippet pins `v0.14.0`.
- Docs: a new `docs/compozy-kit.md`, the pack row in `docs/conventions.md`, `README.md` and
  `CLAUDE.md`, a pointer from `docs/openspec-flow.md`'s `/conduct` section, and ADR 0009. No other
  pack changes version; this release is tagged `v0.14.0` on its merge commit.

## 0.16.0 — evidence before review

- **devkit-openspec** 0.13.0: `deliver-check` reports `verify` (`pr-verifier` records `evidence.md`) and `fix-defect` before `review`, so a review round never runs on code with missing or stale evidence or a failing criterion; the instructions, skills and docs of the flow follow. The CI snippet pins `v0.13.0`.
- **devkit-core** 0.6.2: the README names evidence before review.
- **devkit-panel** 0.2.1: `Provas` comes before `Revisão` in the ten steps.
- Docs: the flow doc, CONTRIBUTING's release tag rule (a release that changes devkit-openspec's version is tagged on its merge commit) and the CI pin at `v0.13.0`.

## 0.15.0 — retro of panel-conduct-view

- **devkit-core** 0.6.1: the `requirements-grill` skill numbers acceptance criteria `AC-<n>` (with the slug beside) and ends a change with a visible screen in a mock kept in `mock/`; `tdd-implementer` never ticks a `Gate:` task; `pr-verifier` copies each gate part verbatim into its Gates table; the stage-3 writer prompt of the review round names the verdict the round computed (`Verdict: approved` or `rejected`), pinned by a test.
- Docs: CONTRIBUTING's "Testing a mod pack" gains the version-agnostic binary form, live loading of a work-in-progress pack and what the desktop surface draws.

## 0.14.0 — panel: the conducted change

- **devkit-panel** 0.2.0: the pane draws the change this session conducts (its newest `/conduct <id>`, else its own child sessions) with the next step, who acts, the phases, the PR and its checks, the eight delivery items and the phase child sessions, and folds the other changes in progress below it; a press on a child opens it, a filled button shows it is filled, and the band shows the conducted change. The layout is the owner's approved mock: the change with its summary, an `Agora` box, ten `Passos` with where the change stands, the open tasks as `Pendências`, the change's documents, and a second detail pane (Escape or `✕` closes it) for a step, the pending list, a document, another change or an error line; the phase bar, the Delivery group and the Ship button are gone, and a phase marked `owner-run` reads as the owner acting. It calls `$.ui.copy` (`Copiar`, on your press) and `$.ui.scroll` (the document's section index) besides what it called before; nothing is sent. It loads in the npm `claude` too (`userConfig.language.options` and the hooks entry are gone). The round view, `Archived` and the `--change` probe are removed; devkit-openspec 0.10.0 or newer is needed. Read-only, as before.
- Docs: the panel's README and "The panel: devkit-panel" in `docs/openspec-flow.md` are rewritten; CONTRIBUTING says the npm `claude` validates the repository and the pack again but has no `plugin test`.

## 0.13.0 — reviews as a workflow

- **devkit-core** 0.6.0: the `review-change` round runs in three stages (the reviewers in parallel, three `finding-verifier` agents per blocking or important finding, the reviewers writing their own files), as one Workflow script (`review-round.workflow.js`) on the owner's typed turn and with the Agent tool on any other turn or when the tool is missing, through the same rules (`review-round.mjs`: `stage1`, `verify`, `outcomes`, `consolidate`, `check-file`). A new read-only agent, `finding-verifier`; a `### Staged round` paragraph in the six reviewers; `review.md` gains the path, the verified and refuted counts and the notes.
- **devkit-openspec** 0.12.0: an approved review with an undisposed blocking or important finding is `fix-review` in `deliver-check`, not `review`; the `review` rows of `ship-change` and `conduct` run the round through the Workflow tool as `review-change` describes, with the busy mark until its notice. The CI snippet pins `v0.12.0`.
- Docs: ADR 0008, ADR 0001's Note, "The review round" in `docs/openspec-flow.md`.

## 0.12.0 — release-rebase pin

- **devkit-openspec** 0.11.0: a conflict in `docs/openspec-flow.md` that is only the CI pin (pins masked, `git merge-file -p` clean) is `resolve-release-conflict` in `conduct-check` and is resolved by `release-rebase.mjs` at every stop; anything beyond the pin is still blocked in `conduct-check` and exit 2 in `release-rebase.mjs`. After every replay the pins follow the resolved devkit-openspec version. A new error, `cannot set the pin:`, when the base's version cannot be read. `RELEASE_FILE` and ADR 0003's exemption are unchanged. The CI snippet pins `v0.11.0`.

## 0.11.1 — retro of devkit-panel

- **devkit-openspec** 0.10.3: `scripts/check.py`'s language check blanks fenced blocks and backticked spans before scanning (a quoted UI string is a quotation, not prose), pinned by a guard test; the CI snippet pins `v0.10.3`.
- Docs: round 8 of `openspec/roadmap.md` is `release-rebase-pin` (the CI pin collision becomes a change); CONTRIBUTING gains "Testing a mod pack" (the app's bundled binary, the rollout-switch warm-up, how a gate line is read) and the rule to re-read what a change consumes from a sibling after a rebase; a troubleshooting row in `docs/openspec-flow.md` for a conducting session started in another folder.

## 0.11.0 — devkit panel

- **devkit-panel** 0.1.0: a new pack, a Claude Code mod for the desktop app. A side pane over `conduct-check --json` and `deliver-check <id> --json`: the round's changes with their state, next step and actor, the eight delivery items and the linked child sessions (`^<sessionPrefix>[0-9]+$`) of an unfolded row, the other and archived changes by name; a one-line band above the prompt with an `Open` / `Close` button; `/devkit-panel` (`status` prints the pane as text) and the `mcp__devkit-panel__status` tool. The `Conduct`, `Ship`, `Approve` and `Answer` buttons fill the prompt box with the owner's next command and never submit it. Read-only: no session start, no file write, no `prompt.submit`, no schedule beyond its 60 s refresh while the pane is open. It runs the repository's own `plugins/openspec/hooks/` in the devkit repository, else the `devkit-openspec` installed at project scope (user scope as the fallback). `userConfig.language` (`pt-BR` by default, `en`) selects its texts.
- **devkit-openspec** 0.10.2: `openspec-setup --packs` accepts `devkit-panel` (`PACKS` of `project-settings.mjs` lists it; `DEFAULT_PACKS` unchanged); the CI snippet pins `v0.10.2`.
- Docs: the pack row in `docs/conventions.md`, "The panel: devkit-panel" in `docs/openspec-flow.md`, `plugins/panel/README.md` and `docs/catalog.md`; `scripts/gen-catalog.py` lists the pack. No change to devkit-core.

## 0.10.1 — retro of conduct-one-change

- **devkit-core** 0.5.3: `commit-and-pr` opens the PR with `--body-file -` (the body as a heredoc on stdin), never `--body -`.
- **devkit-openspec** 0.10.1: the Auto-fix line says `/conduct <id>` (or `round <n>`); the CI snippet pins `v0.10.1`.
- Docs: ADR 0001's note names the single change and ADR 0007.

## 0.10.0 — one change on request

- **devkit-openspec** 0.10.0: `conduct-check --change <id>` restricts the report to the one change the owner names, with the same engine and row, and never reads the roadmap (`--round` does not combine with it, exit 3). A missing change is exit 3 with a prefix (`no change <id>:`, `change <id> has a worktree without a folder:`, `change <id> is on another branch:`). The JSON stays version 2 with `mode`, `change` and `unfinished` as additive fields.
- `/conduct` has three argument forms: `<id>` conducts exactly that change, `round <n>` is the explicit round mode, and a bare `/conduct` lists the open ids and asks, never sweeping. Before a change runs on a turn the owner typed, unfinished work in its worktree (uncommitted product paths, half-done phases) is reported and goes on only on the owner's own message. A missing change is created only after the owner confirms the id and the schema.
- Docs: ADR 0007 records one change on request and amends ADR 0006; round 7 of `openspec/roadmap.md` is this change; the CI snippet pins `v0.10.0`.

## 0.9.1 — retro of conduct-sessions

- **devkit-openspec** 0.9.1: the `ship-change` `commit` row names what to stage (`next.paths` plus every other modified or untracked file under `openspec/`).
- Repo: `scripts/check.py` requires a CHANGELOG heading for the marketplace version, pinned by a guard test.
- Docs: CONTRIBUTING notes updating the installed pack before dogfooding.

## 0.9.0 — phases as child sessions

- **devkit-openspec** 0.9.0: `conduct-check --json` is version 2 (**BREAKING** for consumers of the JSON: the `wake` field is removed, `version` is 2). In `host: app`, a change whose next step is `implement` carries `next.actor: "session"` and a `session` descriptor (title, name, cwd, branch, phase, brief, background), and every change row carries `sessionPrefix`; in `host: cli` the subagent actor is unchanged.
- `/conduct` starts one child session per phase in the change's worktree (`start_session` with `wake_when_done`), never a subagent in its place. A refused start ends that change's run as `waiting for the owner: start session <id> phase <n>`. Only the owner's typed `/conduct` is the go-ahead; a continuation turn after a child's end starts the next phase. Children join a sidebar group named after the change and are archived when the phase's gate is ticked. There is no session cron (the first run after the upgrade deletes a `/conduct` cron left by 0.8.0); waits on GitHub are one capped watch plus the app's PR Auto-fix.
- Docs: ADR 0006 records phases as child sessions and supersedes ADR 0005; ADR 0001 points to it; round 6 of `openspec/roadmap.md` is this change; the CI snippet pins `v0.9.0`.

## 0.8.0 — conduct rounds

- **devkit-openspec**: the `conduct` skill conducts every change of the current `openspec/roadmap.md` round from creation to archive. `conduct-check` (read-only, `--json`) computes each change's next step, who does it and whether the session should wake itself later; independent changes run their steps in parallel git worktrees (at most three at once, as background subagents), and a change with `after:` plans early and waits for its dependency's archive. `release-rebase` resolves release-file conflicts (versions, CHANGELOG, catalog) by rule, in the change's worktree. `/conduct round <n>` starts at a named round.
- The hooks are worktree-aware: the root comes from the edited file or from a command's own `cd`, not only from the session's folder, and the opt-in check applies to each target root.
- `approval.md`: the owner's recorded plan approval, written only by the main session from the owner's own message. `deliver-check` gains the `stop-plan-approval` stop for a `devkit` change not yet started whose readiness is APPROVED but has no current approval; a change with a ticked task is unaffected.
- Docs: ADR 0005 records parallel step subagents and a session wake-up (every 20 minutes) as an exception to ADR 0001; round 5 of `openspec/roadmap.md` is the dogfood round; the CI snippet pins `v0.8.0`.

## 0.7.1 — retro of devkit-opt-in

- **devkit-core** 0.5.2: `tdd-implementer` stops a hung command by its own PID only, never `pkill`/`killall` by pattern.
- **devkit-openspec** 0.7.1: the `devkit` schema's Request line says how to quote a request in another language (faithful translation marked "(translated from <language>)").
- Docs: the CI snippet pins `v0.7.1`; `docs/migrate-to-project-scope.md` items 3 and 4 keep the first backup (`cp -n`) and write through a temporary file, so they are safe to run twice; a test pins both.

## 0.7.0 — devkit per project

- **devkit-openspec** (BREAKING): the hooks (`session`, `edit`, `bash`) act only in projects whose `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema; everywhere else they are silent, destructive git included. `ci` is unchanged. `install-schemas.sh` with no argument now installs into the current project (`--user` for machine-wide, the old default). New `project-settings.mjs` writes the project's `.claude/settings.json` opt-in; `openspec-setup` runs it and installs the schemas into the project.
- **devkit-core** 0.5.1, **devkit-design** 0.1.1, **devkit-stack** 0.1.1, **devkit-ai-engineering** 0.1.1: the READMEs install with `claude plugin install <pack>@devkit --scope project`.
- Docs: ADR 0004 records devkit as opt-in per project; `docs/migrate-to-project-scope.md` removes the old user-scope install from a machine, item by item; `scripts/check.py` refuses a `plugin install` line without `--scope project`; this repository opts in through its `.claude/settings.json`; the CI snippet pins `v0.7.0`.

## 0.6.0 — archive after merge

- **devkit-openspec**: after a change PR merges, `deliver-check` and `ship-change` go on to the archive steps (`retro`, `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, `archive-pr-ready`, `stop-archive`, `archived`): the owner answers each retro proposal, and the archive lands through a PR on `chore/archive-<id>` that GitHub auto-merges in `merge` mode (a file the owner did not approve stops the run). The guard hooks and `--ci` never select another change from an archive branch, so the archive PR passes `devkit-reviews`. In `pr` mode a merged PR now leads to the archive steps instead of `blocked: item 5`, and `merged` is no longer a final `next.step`.
- **devkit-core**: `retro` writes proposals in a format `deliver-check` reads (exact paths, `None.`, `Answer:` and `Applied:` lines); `commit-and-pr` gains the archive call; `tdd-implementer` gains the apply-proposals call.
- Docs: ADR 0003 records auto-merging the archive PR without 8/8, ADR 0002 notes round 3 has no bypass; the CI snippet pins `v0.6.0`.

## 0.5.1 — auto-merge retro

- **devkit-core**: `adr-reviewer` cites ADRs by repo-root path in backticks instead of relative links, which broke when a change folder was archived.
- Docs: ADR 0002 notes that GitHub records an auto-merge under the identity that enabled it; CONTRIBUTING asks to amend `design.md` when a readiness note is resolved differently.

## 0.5.0 — auto-merge

- **devkit-openspec**: new `merge` ship mode (with `merge_method`): at 8/8 `ship-change` enables GitHub auto-merge pinned to the checked head and disables it when the contract drops; `deliver-check` gains the merge steps and a `--ci` mode (the `devkit-reviews` check); new `merge-setup.mjs`, the `devkit-reviews` workflow template and the read-only-by-default `github-setup.mjs` in `openspec-setup`. `guard.mjs ci` now runs the same stale-aware check: it needs `deliver-check.mjs` beside it, the full history and the PR head checked out.
- **devkit-core**: `commit-and-pr`, `review-change` and the README say the merge is the owner's, or GitHub's in `merge` ship mode; `commit-and-pr` itself still never merges.
- Docs: ADR 0002 records merging without the owner by opt-in; the CI snippet and workflow template pin `v0.5.0`.

## 0.4.0 — ship modes

- **devkit-openspec**: new `ship-change` skill drives one approved change to a ready PR from your own session, configured by an optional `ship` key in `openspec/config.yaml`; new `deliver-check` module (JSON contract) computes the next step from the repository and GitHub; `guard.mjs` exports its checks for reuse.
- **devkit-core**: reviewers, `pr-verifier`, `commit-and-pr`, `tdd-implementer` and `review-change` gain the output formats (`Commit:` line, gates table, commit-only mode) that `deliver-check` parses.
- Docs: ADR 0001 records why coordination is allowed but a harness is not; the CI snippet pins `v0.4.0`.

## 0.3.0 — rounds without an orchestrator

- **devkit-openspec**: optional `openspec/roadmap.md` groups changes into rounds (`## ` headings, `- [ ] <change-id> (after: ...)` lines). The session hook prints the current round, `done/total` and each pending change's state (`not started`, `open`, `waiting on ...`, `archived, tick it`), with or without an active change. It reports only; no gate reads it. The setup template's archive guidance now ticks the line.

## 0.2.0 — lighter by default

A full-flow run on a one-function change took over an hour, mostly in review loops on Opus with mutation testing. Now:

- **devkit-openspec**: `devkit-lite` is the default schema in the project template and accepts an optional spec delta; the full `devkit` flow is for new capabilities, contract or data-model changes, sensitive areas, hard-to-revert or ambiguous changes. Full-flow tasks use as few phases as the work needs. The hooks follow `cd` inside a command and skip paths built from variables, fixing two false positives.
- **devkit-core**: reviewers and `plan-readiness-reviewer` run on Sonnet. Every reviewer has a Budget section (depth scaled to the diff, test suite at most once, re-review limited to previous findings). `test-coverage-reviewer` reads tests to judge seams and runs mutations only on request. `review-change` re-runs only reviewers that rejected, and `nit`s never trigger a round.

## 0.1.0 — first release

- **devkit-core**: 13 agents (`codebase-researcher`, `change-planner`, `plan-reality-auditor`, `plan-readiness-reviewer`, `tdd-implementer`, six reviewers, `pr-verifier`, `commit-and-pr`) and 8 skills (`requirements-grill`, `plan-readiness-review`, `review-change`, `test-and-coverage`, `test-driven-development`, `systematic-debugging`, `commit-message-guidelines`, `retro`).
- **devkit-openspec**: `devkit` and `devkit-lite` schemas for OpenSpec 1.16; hooks that give each gate file one writer (by subagent type), gate product code on an independently approved readiness and on the `tdd-implementer` agent, gate `gh pr create` on approved reviews plus evidence, and refuse destructive git; a `ci` mode for the same gates in CI; `openspec-setup` skill; `openspec-validator` agent.
- **devkit-design**: four DDD design phases plus `ddd-strategic-design`.
- **devkit-stack**: `postgres`, `neon-postgres`, `react-performance`, `vitest`, `saas-multi-tenant`, `threat-model`.
- **devkit-ai-engineering**: `llm-evaluation`, `multi-agent-patterns`, `agent-tool-design`, `agent-friendly-cli`, `context-compression`, `skill-scanner`.
