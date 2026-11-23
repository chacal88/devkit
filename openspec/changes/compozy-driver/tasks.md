<!-- devkit-stage tasks result=passed attempt=3 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Tasks

Change: `compozy-driver` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, table, text and test name is in
`design.md` (D-1 the entry, D-2 the CompozyOS helper, D-3 the view, `confirm` and the run record,
D-4 the record steps, D-5 the change loop, D-6 the review loop, D-7 the roadmap, D-8 the agents,
D-9 the resolver, D-10 the installer, D-11 the approval lock, D-12 the messages, D-13 the skill,
D-14 the ADR, D-15 the documents, D-16 versions and CI, D-17 the probes, D-18 the local proof, D-19
the tests this plan changes); the implementer copies them and makes no design choice. When a probe
or a task resolves something in a way the design does not say, amend `design.md` in the same phase.
The plan was revised on 2026-11-22 for `main` at `77b15b1` (`design.md`, "Revision 2026-11-22 (main
at 77b15b1)"); line anchors are those of `77b15b1`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Test name filters are given as several `--test-name-pattern` flags, never as one
pattern with alternatives. Every env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through the shared
constant of its file, and every gate that runs the hook suite sets `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF`, as a pull-request run on CI does. The hook tests need the `openspec` CLI 2.x on
`PATH`. No test calls the real `compozy`: the tests use the fake binary of D-2 through
`COMPOZY_BIN` (the one exception is the `compozy loop validate` test of D-5, skipped when the CLI or
the daemon cannot be reached). Every temporary folder a new or changed test makes goes through its
pack's `test-tmp.mjs` (`tmpFolder('devkit-<name>-')`, `tmpRoot()`: `plugins/openspec/hooks/test-tmp.mjs`
for the hook suites, `plugins/compozy/skills/test-tmp.mjs` for the setup suites), never a raw
`mkdtempSync` or `tmpdir()` call, which `test-tmp.test.mjs` refuses; a fake daemon's socket server
is closed in the test's `t.after`, so CI's "Hook tests left nothing in TMPDIR" step stays green. No
test reads git history ("Test history", `openspec/config.yaml`): old content is a constant or a
fixture. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
about 13 minutes) runs once, in gate 6.10, as a background command of the tool.

Test first in every phase: the phase's test task comes before its code task, and its new tests fail
on the base. An existing test changes only where `design.md` D-19 names it (T-1 to T-14), and the
task says its invariant, the layer that owns it and its suite; every other existing test runs
unchanged. Phases 1 and 5 are owner-run: the session that conducts this change carries them out
with the owner, never `tdd-implementer`, and the owner answers every CompozyOS request of phase 5
in CompozyOS. No gate calls `claude` by name. Leave no backup or scratch file in the tree; end every
task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `compozy-change-starts-run` | 2.3, 2.4, 3.3, 3.4, 5.2 |
| AC-2 | `short-loop-picks-role` | 1.1, 2.3, 2.4, 4.4, 4.6, 5.2 |
| AC-3 | `owner-answers-in-compozy` | 1.1, 2.3, 2.4, 2.5, 4.6, 5.2, 6.4 (dogfood line: retro answers, live mock-up) |
| AC-4 | `local-proof-to-review` | 5.1, 5.2 |
| AC-5 | `review-round-as-claude` | 1.1, 4.4, 4.6, 5.2 |
| AC-6 | `github-steps` | 6.4 (dogfood line) |
| AC-7 | `agents-follow-source` | 4.2, 4.3 |
| AC-8 | `reinstall-renames` | 4.4, 4.5, 4.7, 5.5 |
| AC-9 | `roadmap-starts-runs` | 3.1, 3.2, 4.6, 5.3 |
| AC-10 | `roadmap-starts-next` | 3.1, 3.2, 6.4 (dogfood line) |
| AC-11 | `not-running-says-so` | 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 5.4 |
| AC-12 | `claude-driver-unchanged` | 2.3, 2.5, 3.1, 4.1, 6.10 |

## 1. The probes of CompozyOS (AC-2, AC-3, AC-5; owner-run)

- [x] 1.1 Owner-run task, done by the conducting session: run probes P-1 to P-13 of `design.md`
  D-17 in a scratch git repository outside this one, registered as the workspace `devkit-probe`
  with throwaway loops; write each result (the command, its output, `Result: pass` or the failure
  and the row's decision) under its own `## P-<n>` heading in
  `openspec/changes/compozy-driver/proof/probes.md`; delete the throwaway loops and run `compozy
  workspace remove devkit-probe`. A probe whose row says "stop" stops the change here: report it to
  the owner with the record, and phase 2 waits for the revised plan's approval. A probe whose row
  names a design amendment amends `design.md` in this phase. Check: `proof/probes.md` holds the
  thirteen headings and `compozy workspace list` no longer lists `devkit-probe`.
- [x] 1.2 Gate: `test -s openspec/changes/compozy-driver/proof/probes.md && grep -q "^## P-13" openspec/changes/compozy-driver/proof/probes.md` green; covers the preconditions of AC-2, AC-3 and AC-5.

## 2. The entry, the CompozyOS helper, the view and the record steps (AC-1, AC-2, AC-3, AC-11, AC-12)

- [x] 2.1 Write the failing tests of D-2 in the new `plugins/openspec/hooks/compozy-driver.test.mjs`
  (names `compozy-driver ...`; the fake `compozy` and the temp `COMPOZY_HOME` built by one shared
  helper of the file, both folders from `tmpFolder` of `plugins/openspec/hooks/test-tmp.mjs`, the
  socket server closed in `t.after`), and add its import line to
  `plugins/openspec/hooks/guard.test.mjs`: one test per readiness row and its negative, in order
  (not installed, daemon stopped, workspace unknown, kit missing, ready), one per function for its
  argv and parsing, `url` null without `web_url`. Check: the new tests fail on the base, for the
  missing module only, and `node --test plugins/openspec/hooks/test-tmp.test.mjs` passes with the
  new file present.
- [x] 2.2 Write `plugins/openspec/hooks/compozy-driver.mjs` as D-2 says. Check: the tests of 2.1 pass.
- [x] 2.3 Write the failing tests of D-1, D-3, D-4 and D-11, and change T-1, T-2, T-4 and T-5 as
  D-19 says (each change's comment names its invariant, its layer and its suite):
  `change-loop.test.mjs` gains the `change-loop compozy start ...` tests (C1 to C8 with C2 twice, the
  `projectGate` cells, `startMode` on `compozy`, the stop lock after `compozy-start`), the
  `change-loop compozy view ...` tests (one per D-3 table row and its negative, the key forms, `next
  --view` with and without a handed key, `next` without `--view` unchanged, `confirm` per field and
  per each of the six recorded kinds, each recorded answer cleared and kept as D-3 says, the
  unreadable record and `--view` inputs, the `open-failed` row against `open`, the recorded-failure
  row against the handed key, the action's key and neither, the mock-up facts row with and without
  words, `waiting-mockup` giving `mockup` and never `owner`, `switch-script` and `accept-decisions`
  giving `command` against `enable-auto-merge` giving `coordinator`, the agent dispatch line per
  class, each `owner` reply key) and the record-step tests of D-4 (one per refusal and per success;
  `record-approval` read back by `approvalState` as `ok: true`, the 200-character cut, the attempt
  of a second approval, `record-approval` refused while the readiness review or the retro answers
  are due with `approval.md` absent or unchanged, `record-answer --gate grill` refused while the
  view is `approval`; `record-mockup` refused while the view is `approval` and when `mockup.md` has
  no valid header, `approve` read back by `flow-check` as passed with the words recorded, `changes`
  giving the `screen-designer` `owner-changes` brief with no words recorded, the 200-character cut,
  an unknown `--decision`; `run-step` refused while the view is `agent`, `accept-decisions`
  accepted with no failure recorded, `accept-decisions` refused with its `cannot-accept` reply
  recorded and no file changed, a command with no JSON recording the `role-failed` reply,
  `switch-script` run; `compozy-retry` clearing a recorded failure); `project-loop.test.mjs` gains `project-loop compozy start answers
  driver-no-project`; `guard.test.mjs` gains the five `guard compozy approval
  ...` tests of D-11. T-1 (`change-loop start: S5 ...`; invariant: an unbuilt driver runs nothing;
  layer `projectGate`; guard suite) keeps `script` only; T-2 (`change-loop open: O3 ...`; invariant:
  `open` refuses where `/devkit change` refuses; layer `openChange`; guard suite) drops the
  `compozy` row and asserts `open` creates the change on `compozy`; T-4 and T-5 (`project-loop
  start: ...`; invariant: the project verb stops where the project gate stops; layer `startMode` and
  `project-loop start`; guard suite) expect `driver-no-project` for `compozy`. Check: the new tests
  and the changed T-1, T-2, T-4, T-5 fail on the base; every other existing test passes.
- [x] 2.4 Implement D-1, D-3, D-4 and D-12 in `plugins/openspec/hooks/change-loop.mjs`
  (`DRIVER_ROUND`, `projectGate` with the verb, `compozy-start`, `compozyView`, `next --view
  compozy`, `confirm`, the run record under `withLockFile` through one pair `readRunRecord` and
  `updateRunRecord`, `record-approval` through one `approvalText` function, `record-mockup` through
  one `mockupText` function, `record-answer`, `run-gate`, `run-step`, `compozy-retry`, the usage
  line naming every new subcommand, the new message keys, `blocked-why.open-failed` included, in
  both languages) and pass `'project'` to `projectGate` at both calls of
  `plugins/openspec/hooks/project-loop.mjs`. Check: the tests of 2.3 for these files pass, and the
  message-table test of `change-loop.test.mjs` passes with the new keys.
- [x] 2.5 Implement D-11 in `plugins/openspec/hooks/guard.mjs` (`compozySession(env)` and the refusal
  in `writeViolation`). Check: the five `guard compozy approval ...` tests pass, and the existing
  writer tests of `guard.test.mjs` pass unchanged.
- [x] 2.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^compozy-driver" --test-name-pattern="^change-loop" --test-name-pattern="^project-loop" --test-name-pattern="^guard compozy" plugins/openspec/hooks/guard.test.mjs` green; covers AC-1, AC-2, AC-3, AC-11 and AC-12 for the scripts.

## 3. The roadmap on CompozyOS and the skill (AC-1, AC-9, AC-10, AC-11)

- [x] 3.1 Write the failing `roadmap-loop compozy ...` tests of D-7 in
  `plugins/openspec/hooks/roadmap-loop.test.mjs` (every `compozy-start` row, the tick cases with the
  archived-dependency case of AC-10, the state's three exits, `status` on `compozy` with and without
  CompozyOS and on `claude` unchanged), and change T-3 (`roadmap-loop start: roadmap and status are
  routed`; invariant: roadmap and status stop where the change verb stops; layer `startMode`; guard
  suite) as D-19 says. Check: the new tests and T-3 fail on the base.
- [x] 3.2 Implement D-7's `compozy-start`, `compozy-tick`, `compozy-state` and the `status` line in
  `plugins/openspec/hooks/roadmap-loop.mjs`, through `compozy-driver.mjs` and the existing
  `classifyLines`, `readLoad`, `limitOf`, `archivedOnDefault`, `unfinished` and `whereOf`. Check:
  the tests of 3.1 pass.
- [x] 3.3 Change T-8 (`change-loop skill: the sections of D-3 to D-9 and the modes of start`;
  invariant: the skill keeps its sections and start modes; layer: skill text; guard suite) and T-9
  (`project-loop skill: the start reads the words ...`; invariant: the project section names every
  start mode; layer: skill text; guard suite) as D-19 says, and add `change-loop skill: the
  CompozyOS section starts runs and asks nothing` (the section names `compozy-start` for `new`,
  `resume` and `roadmap`, the quoted heredoc, `driver-no-project`, and says the session ends its
  turn after `reply`). Check: the three fail on the base.
- [x] 3.4 Write D-13's section `## On the CompozyOS driver` in
  `plugins/openspec/skills/devkit/SKILL.md` and name `driver-no-project` in `## Start` and in
  `## Project`. Check: the tests of 3.3 pass.
- [x] 3.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop skill" --test-name-pattern="^project-loop skill" plugins/openspec/hooks/guard.test.mjs` green; covers AC-1, AC-9, AC-10 and AC-11 for the roadmap and the skill.

## 4. The kit: agents, loops, resolver and installer (AC-2, AC-5, AC-7, AC-8, AC-9, AC-12)

- [x] 4.0 Follow what `main` added at `72b51d3` in the CompozyOS view (the plan's decisions and
  acceptance criteria stay), four fixes with a failing test first each, in
  `plugins/openspec/hooks/change-loop.mjs` and its test file: (a) `buildView` takes the view's
  `root`, and the root and branch of its brief frame, from the action's `detail.root` and
  `detail.branch` when the detail names both (a support-branch hand-off runs in the support
  worktree), else from the action; (b) the dispatch sentence of a hand-off step is derived from
  `ROW_STEPS` (the delivery rows' table), not from a second hand-kept list, so the seven new
  delivery steps (`open-prs`, `open-test-pr`, `push-support`, `move-test-pr`,
  `open-test-archive-pr`, `resolve-support-conflict`, `fix-resolution`) carry it; (c)
  `review-resolution` is kind `review` like `review`, and `rerun-checks`, `checkout-support` and
  `merge-into-support` stay `coordinator` (a test pins it); (d) `compozy-start` calls the helper
  `open` uses for the refusals known before a run starts (`test-branch-missing`,
  `base-not-default`, `name-test-suffix`) and answers with the refusal's own reply. Check: the new
  tests fail on the base and pass, and `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node
  --test --test-name-pattern="^change-loop compozy" --test-name-pattern="^delivery-models open"
  plugins/openspec/hooks/guard.test.mjs` is green; design.md, "Main-merge amendments (after 72b51d3)",
  records the four fixes and the main features this view does not follow.
- [x] 4.1 Write `plugins/openspec/agents/change-coordinator.md` as D-8 says (frontmatter `name`,
  `description`, `tools`, `model: sonnet`, `skills: requirements-grill, retro`; the body's steps,
  among them the mock-up facts of an approved mock-up, its Outcome line, and its Never list, which
  names `accept-decisions` and `script` as the loop's, not its own); add `'change-coordinator':
  'devkit-openspec'` to `PACKS` in `plugins/openspec/hooks/change-loop.mjs` (`NOT_AGENTS`
  unchanged); write the two `docs/roles.md` lines of D-8 (`change-coordinator`'s "Played today by"
  and `project-coordinator`'s, `:41`, which drops "as `change-coordinator` has none"); add the
  test `change-loop lock agent: change-coordinator is refused with either pack prefix` of D-8;
  change T-6 (`change-loop skills: every shipped stage agent declares its stage's skills`;
  invariant: only roles with no agent by design lack an agent file; layer: agent files; guard
  suite) to the bare list `['owner', 'review-bench']`. Check: the new hand-off test is a guard that
  passes before and after the `PACKS` row (the row must open nothing to a Claude run), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop skills" --test-name-pattern="^change-loop lock agent" plugins/openspec/hooks/guard.test.mjs`
  passes (the `H3` refusal of the coordinator, the new test and the packs-and-roles test
  included); then run
  `python3 scripts/gen-catalog.py` so the catalog lists the new agent, and `python3
  scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.
- [x] 4.2 Write the failing `compozy-agents ...` tests of D-8 in the new
  `plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs` (the set equals `PACKS`' 20
  keys, the frontmatter keys and body, the icon per role, the seat paragraph's outcome mapping
  with one assertion per outcome word D-8 names, `--check` on the repository, the
  changed-source-line case of AC-7 on a copy in a `tmpFolder('devkit-gen-agents-')` folder of
  `plugins/compozy/skills/test-tmp.mjs` and its regeneration, a missing and an extra agent, the
  four unreadable sources exiting 2). Check: they fail on the base.
- [x] 4.3 Write `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs`, run it to write the
  twenty `templates/agents/<role>/AGENT.md`, delete `templates/agents/tech-lead/`, `dev/`, `qa/`
  and `design/`, add the step "CompozyOS agents are up to date" to `.github/workflows/ci.yml` after
  the catalog step, and add its row to `CLAUDE.md`'s command table. Check: the tests of 4.2 pass and
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` exits 0.
- [x] 4.4 Write the failing tests of D-9 (`devkit-kit.test.mjs`, names `compozy-resolver ...`), D-10
  (`install-kit.test.mjs`, names `compozy-kit ...`, the AC-8 case over a scratch copy of the old
  kit held as constants of the test with a manifest of their digests, one file hand-edited, as D-10
  says) and D-5 to D-7 (the new `loop-templates.test.mjs`, names `compozy-loops ...`, the `mockup`
  and `command` routes, `record_mockup` and `run_step` included); change T-12 (`adoption.test.mjs`; invariant: this repository's `.compozy/`
  is the rendered kit; layer: install; now the guard suite) and T-13 (`install-kit.test.mjs`'s first
  install and edited-loop tests move to the new set and path; the two `field-fixes 8 grill` tests
  are deleted with the compozy-kit-setup requirement they pinned); delete `role-shells.test.mjs`
  (T-10, its five `stage-roles kit` tests included, with the requirement "The kit runs the new
  stages in its four shells") and `loop-template.test.mjs` (T-11, all 25 tests); add to `plugins/openspec/hooks/guard.test.mjs` the
  import lines of `install-kit.test.mjs`, `devkit-kit.test.mjs`, `gen-agents.test.mjs`,
  `loop-templates.test.mjs` and `adoption.test.mjs`. Check: the new and changed tests fail on the
  base; T-14 passes unchanged.
- [x] 4.5 Implement D-9 in `templates/bin/devkit-kit` and D-10 in `scripts/install-kit.mjs`,
  `templates/substitutions.json`, `templates/config.toml` and `templates/README.md`. Check: the
  `compozy-resolver` and `compozy-kit` tests pass.
- [x] 4.6 Write `templates/loops/devkit-change/loop.yaml` (the sixteen node groups of D-5, with
  `ask_mockup`, `record_mockup` and `run_step`), `templates/loops/devkit-review/loop.yaml` and
  `templates/loops/devkit-roadmap/loop.yaml` as D-5, D-6 and D-7 say, and delete
  `templates/loops/openspec-change/`. Check: the `compozy-loops` tests pass, and `compozy loop
  validate --file <each> -o json` reports `valid: true` for each of the three.
- [x] 4.7 Install the kit again over this repository: `node
  plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .` from the worktree root. Check: its
  output reports `remove` for the four old agents and `loops/openspec-change/loop.yaml`, `dropped`
  for the seven old inputs, `create` for the new files, and the adoption tests pass.
- [x] 4.8 Gate: `python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^compozy-" --test-name-pattern="^AC-8 portable-hooks" --test-name-pattern="^AC-9 repo-adopts" --test-name-pattern="^field-fixes 8 kit" --test-name-pattern="^change-loop skills" --test-name-pattern="^change-loop lock agent" plugins/openspec/hooks/guard.test.mjs` green; covers AC-2, AC-5, AC-7, AC-8, AC-9 and AC-12 for the kit.
- [x] 4.9 Defect found by the live proof (tasks 5.1 and 5.3, CompozyOS 0.6.2): `compozy agent list`
  reports `frontmatter.invalid: descriptions can have up to 280 characters` for 19 of the 20
  generated agents (the Claude sources' descriptions hold 274 to 508 characters and the generator
  copied them verbatim), so an agent is "not available in workspace" and the loop's first node
  (`read`, agent `change-coordinator`) fails to bind. Fix with a failing test first each, in
  `scripts/gen-agents.mjs` and `gen-agents.test.mjs` (names `compozy-agents ...`): the generated
  `description` is the source description (read as the YAML scalar it is, plain or quoted) reduced
  to at most 280 characters (code points): a longer one keeps whole sentences from the start while
  they fit (a sentence ends at `. ` or at the end), and when not even the first fits, it is cut at
  the last word boundary that leaves room for one final `…`; a description of 280 characters or
  fewer stays whole; the instructions body stays the exact source text (A-4); the header comment
  says the description is shortened to CompozyOS's 280-character limit; the value is quoted when it
  holds `:` or `#` or starts with a special character. Tests: 100 characters whole, exactly 280
  whole, 281 in two sentences keeps the first, one 400-character sentence cut at a word boundary
  with `…` and at most 280, a source with `—` and backticks, `--check` red when a generated
  description is the full long one and when the first words of a source description change (green
  again after generating), and every `templates/agents/*/AGENT.md` of this repository has a
  description of at most 280 characters. Then run the generator, install the kit again over this
  repository (`node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .`) and check with
  the live CLI that `compozy agent list --workspace devkit -o json` shows no `diagnostics` for the
  twenty kit agents; design.md, "Phase 4 amendments", records the defect.
- [x] 4.10 Gate: `python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^compozy-" --test-name-pattern="^AC-8 portable-hooks" --test-name-pattern="^AC-9 repo-adopts" --test-name-pattern="^field-fixes 8 kit" --test-name-pattern="^change-loop skills" --test-name-pattern="^change-loop lock agent" plugins/openspec/hooks/guard.test.mjs` green; covers AC-7 and the CompozyOS 280-character rule for the kit (the `^compozy-` pattern includes `^compozy-agents`).
- [x] 4.11 Defect found by the live proof (task 5.3, run `looprun-a4bc9068808707a9` of `add-mul`): after
  the view said `gate` and `confirm` passed, the `phase_gate` node failed in 3 seconds without running
  the tests, the next view was `blocked` ("the tests of phase 1 failed") and `run-gate` by hand said
  `the run does not ask for the gate now (it asks for blocked)`. Cause: `compozyState` always passed
  `after: record.handed?.key` to `nextAction`, and `confirm` records the key of the step just handed, so
  every record step (`run-gate`, `run-step`, `record-approval`, `record-mockup`, `record-answer`) computed
  its view through `stateFor` with `--after <the key of the step about to run>`, nothing changed yet, and
  the checker's K1/K2 guards answered `blocked` (no-progress). Fix with a failing test first each, in
  `plugins/openspec/hooks/change-loop.mjs` and `change-loop.test.mjs` (names `change-loop compozy ...`):
  `compozyState` takes `guard` (default true); `stateFor`, so every record step, passes `guard: false`
  and computes the action with `after: null`; `next --view compozy` and `confirm` keep
  `after: record.handed?.key`, so a turn that changed nothing is still `blocked` with `no-progress`, and
  `confirm` still compares the handed view with the current view computed the same way as `next --view`
  did. Tests, each with a run record whose `handed.key` is the key of the step under test: `run-gate`
  runs the gate command and ticks the task (green), and exits 1 with `failed` and the output tail (red);
  `run-step` runs; `record-approval` writes approval.md; `record-mockup` writes; `record-answer` writes
  for the grill and for the retro; and the negatives: `next --view compozy` with `handed.key` equal to
  the current gate key and nothing changed is `blocked` with `no-progress`, and `confirm` still refuses
  a view that differs. design.md, "Phase 4 amendments", records the defect.
- [x] 4.12 Gate: `python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^compozy-" --test-name-pattern="^AC-8 portable-hooks" --test-name-pattern="^AC-9 repo-adopts" --test-name-pattern="^field-fixes 8 kit" --test-name-pattern="^change-loop skills" --test-name-pattern="^change-loop compozy" --test-name-pattern="^compozy-driver" --test-name-pattern="^change-loop lock agent" plugins/openspec/hooks/guard.test.mjs` green; covers the record steps under a handed key (AC-2, AC-3, AC-11, AC-12).

## 5. The local proof (AC-1 to AC-5, AC-8, AC-9, AC-11; owner-run)

- [x] 5.1 Owner-run task: set up the scratch project `devkit-proof` of D-18 outside this repository
  (git repository with no remote, `openspec-setup` on the `devkit` script, `devkit.driver:
  compozy`), install the branch's packs at project scope from the temporary `devkit-proof`
  marketplace with the desktop app's bundled Claude Code, run `compozy-setup` there and register
  the folder as a CompozyOS workspace. Check: `compozy loop list --workspace <that folder>` lists
  `devkit-change`, `devkit-review` and `devkit-roadmap`, and `compozy agent list --workspace <that
  folder>` lists `change-coordinator` and `change-planner`.
- [ ] 5.2 Owner-run task: the AC-1 to AC-5 run of D-18, with the owner answering every request in
  CompozyOS; write `openspec/changes/compozy-driver/proof/local-run.md` (the start reply, the closed
  session, each request and answer, `approval.md`, the `accept-decisions` step run by `run_step`
  when the proof change lists a record, the per-generation table of `read` and
  `run_role` agents, the review child run's lanes, verifiers and verdict, the seeded second round
  when the first raised no blocking finding). Check: the file exists and holds each of those parts.
- [x] 5.3 Owner-run task: the AC-9 roadmap check of D-18; write
  `openspec/changes/compozy-driver/proof/roadmap.md`. Check: it shows two change runs started for
  `/devkit roadmap 2` and the held line under `load_limit` 1.
- [ ] 5.4 Owner-run task: the AC-11 checks of D-18 (no `compozy` on `PATH`, the daemon stopped by the
  owner and started again, `/devkit project billing`); write
  `openspec/changes/compozy-driver/proof/not-running.md`. Check: three replies, each with
  `git status` unchanged.
- [x] 5.5 Owner-run task: inside `devkit-proof`, build the scratch copy of the real old kit of D-18
  from this repository's `.compozy/` at `77b15b1` (`git show 77b15b1:.compozy/<path>` for the four
  shells, `loops/openspec-change/loop.yaml`, `config.toml`, `README.md`, `bin/devkit-kit` and
  `kit-manifest.json`), hand-edit one shell, run the installer over it and write its output to
  `openspec/changes/compozy-driver/proof/reinstall.md`. Check: four `remove` lines, one kept and
  named, the new files created.
- [ ] 5.6 Owner-run task: clean up: cancel the proof's runs, remove the `devkit-proof` workspace from
  CompozyOS, remove the temporary marketplace and the scratch folders. Check: `compozy workspace
  list` and the bundled Claude Code's marketplace list no longer name `devkit-proof`.
- [ ] 5.7 Gate: `test -s openspec/changes/compozy-driver/proof/local-run.md && test -s openspec/changes/compozy-driver/proof/roadmap.md && test -s openspec/changes/compozy-driver/proof/not-running.md && test -s openspec/changes/compozy-driver/proof/reinstall.md` green; covers AC-1 to AC-5, AC-8, AC-9 and AC-11 live, with the limits of the proof map.

## 6. The ADR, the documents, the release and the whole suite (AC-6, AC-10, AC-12)

- [ ] 6.1 Write `docs/adr/0017-compozy-runs-the-short-loop.md` as D-14 says, status `proposed`;
  when the merge of `main` finds `0017` taken on `origin/main`, take the next free number and move
  every reference. Its decision 4 names the four owner gates and says the CompozyOS acceptance of
  the records is the `accept-decisions` step the loop runs with `run_step` right after
  `record-approval`. Check: the file has the five headings and names ADR 0008, ADR 0009 and ADR
  0016 (decision 3) under `- Amends:`.
- [ ] 6.2 Only when `approval.md`'s owner's words accept the new ADR: set it `accepted` with
  `- Accepted by:` quoting `approval.md`, and add `- Amended by ADR 0017
  (0017-compozy-runs-the-short-loop.md)` to ADRs 0008, 0009 and 0016, after their status line; in
  every case add D-14's dated Notes to ADRs 0008, 0009, 0010 and 0016, each after the record's
  existing Notes, and the ADR to the `ADRs:` line of `openspec/config.yaml`. Check: `grep -c
  "compozy-driver"` on each of the four ADRs is at least 1, the `ADRs:` line names `0017`, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="docs" plugins/openspec/hooks/guard.test.mjs`
  passes (the `stage-roles docs` and `change-loop docs` tests among them).
- [ ] 6.3 Correct the documents D-15 lists, in every file it names, and the two screen skills'
  sentences; then run `python3 scripts/gen-catalog.py`. Check: the `grep -rn` of D-15 over the
  Markdown files finds only the sentences D-15 keeps as history, and `python3
  scripts/gen-catalog.py --check` exits 0.
- [ ] 6.4 Edit `openspec/roadmap.md`: the `coordination-cleanup` line no longer names the old
  CompozyOS loop (A-7); the `compozy-driver` line names `change-planner`; add the section `## Round
  21b: the CompozyOS driver's dogfood` with the unticked line `compozy-driver-dogfood (after:
  compozy-driver)`, saying the first real change on the CompozyOS driver proves AC-6 (pull request,
  required checks, merge and archive on CompozyOS), AC-10 (a roadmap run starts the change an
  archive freed, with Claude Code closed) and the rest of AC-3 (the retro answers, and the mock-up
  approval on a change flagged `ui`), recorded in that change's evidence. Check: `node
  plugins/openspec/hooks/roadmap-loop.mjs status --lang en --load-limit 80` lists
  `compozy-driver-dogfood` as waiting on `compozy-driver`.
- [ ] 6.5 Versions and release notes of D-16, read again from the files first (today 0.22.1, 0.3.1
  and 0.26.1): devkit-openspec 0.23.0 and devkit-compozy 0.4.0 in each `plugin.json` and in
  `.claude-plugin/marketplace.json` (marketplace 0.27.0), the `CHANGELOG.md` entry `## 0.27.0 —
  the CompozyOS driver` above `## 0.26.1`, and the CI snippet of `docs/openspec-flow.md` pinned to
  `v0.23.0` (`:594`, `:595`, `:604`); change T-7 (`change-loop docs: the design records the
  answers`; invariant: the CI snippet pins the current release; layer: docs; guard suite) to
  `v0.23.0`, with `v0.22.1` in the "no pin left" list. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="docs" plugins/openspec/hooks/guard.test.mjs`
  passes.
- [ ] 6.6 Run the short checks: `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` and `openspec validate
  compozy-driver --strict`. Check: all four exit 0.
- [ ] 6.7 Owner-run task: validate the marketplace with the desktop app's bundled Claude Code (`plugin
  validate .`, `CONTRIBUTING.md`) and write its output to
  `openspec/changes/compozy-driver/proof/validate.txt`. Check: the file holds the validator's pass.
- [ ] 6.8 Run the whole hook suite as a background command of the tool, with `GITHUB_HEAD_REF` and
  `GITHUB_BASE_REF` set, and keep its summary for the reviewers. Check: it ends with no failure.
- [ ] 6.9 Run `git status --short` and remove any scratch file left in the tree. Check: only the
  change's intended files are changed.
- [ ] 6.10 Gate: `python3 scripts/check.py && python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && openspec validate compozy-driver --strict && test -s openspec/changes/compozy-driver/proof/validate.txt && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` green (run as a background command); covers AC-12 and every criterion proved here; AC-6 and AC-10 are recorded as the dogfood line of 6.4.

## Workflow follow-up

- After the merge, tag `v0.23.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- After the release is installed, run `claude plugin update devkit-openspec@devkit` and
  `devkit-compozy@devkit` in the projects on the CompozyOS kit, then `compozy-setup` again in each.
- The first real change on the CompozyOS driver is `compozy-driver-dogfood` (AC-6, AC-10).
