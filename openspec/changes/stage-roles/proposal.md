<!-- devkit-stage proposal result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

Change: `stage-roles` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`; `docs/coordination-design.md` D-4 stages 3, 4, 9, 10 and 11; ADR 0010).
Round 16 of `openspec/roadmap.md`, step 4 of the build order (D-11).

## Why

Both scripts declare five stages that nobody runs: the mock-up, the decisions and ADRs, the unit
suite, the E2E tests and the demonstration as text. The first four are marked `"shipped": false`,
so `flow-check` reports them as not applying and a change goes from the grill straight to the plan
and from the implementation straight to the evidence; `pr-verifier` still takes screenshots and may
comment on the pull request, which D-4 stage 11 rules out. Round 15 built the loop that hands each
stage to its role, so the roles are the missing piece.

## What Changes

- Four new `devkit-core` agents, each the role of one stage: `screen-designer` (`mockup`),
  `adr-author` (`decisions`), `test-runner` (`unit-tests`) and `e2e-tester` (`e2e-tests`), with
  three new skills (`screen-mockup`, `adr-authoring`, `e2e-testing`); `test-runner` reuses
  `test-and-coverage` and `systematic-debugging`. Both stage declarations drop `"shipped": false`.
- A stage declaration can say when its stage applies: the `mockup` stage only when the grill's
  classification flags `ui`, `unit-tests` and `e2e-tests` only when the project declares their
  command, and every new stage only while the change has not passed the point where it sits (a
  change opened on an earlier version is never sent back).
- The mock-up is drawn as text or self-contained HTML under the change's `mock/` folder, shown to
  the owner, redrawn on the owner's notes with no attempt ceiling, and approved from the owner's own
  message (a new `stop-mockup-approval` row of `ship-change`).
- The decisions stage always runs on `devkit`: `adr-author` drafts each ADR with status Proposed in
  the project's ADR folder, or says in one line why none is needed; once the owner's plan approval
  is recorded, the loop hands the session one step that sets every listed ADR to accepted with the
  approval's date. A change to `mockup.md` or `decisions.md` after the readiness review makes it
  stale.
- **BREAKING** (project settings): `openspec/config.yaml`'s `devkit:` block gains `tests.unit`,
  `tests.coverage.command`, `tests.coverage.target` and `tests.e2e`; `openspec-setup` asks for
  them; an invalid target stops `/devkit change` with the setting named.
- From the implementation on, the loop hands `unit-tests` and `e2e-tests` to their roles and a red
  run back to the implementer; the delivery checker is unchanged.
- The hooks let `adr-author` write only decision records and `e2e-tester` only test files (after
  the approved readiness on `devkit`); product code stays the implementer's.
- `pr-verifier` records the demonstration as text only: no screenshot, no image, no pull-request
  comment; `evidence.md` keeps the form the hooks read.
- **BREAKING** (short script): `devkit-lite` no longer declares `mockup` and `decisions`.
- The CompozyOS kit runs the new stages in its four existing shells.
- `openspec/roadmap.md`: the `stage-roles` line keeps the five roles; every item the three retros
  carried onto it moves to a new line, `coordinator-loop-fixes` (`after: stage-roles`).
- A proposed ADR 0014 amends ADR 0010 (decisions 3 and 8) and ADR 0011 (decision 3): a stage that
  does not apply by its condition leaves no file, and decision records and the E2E tester's test
  files are not product code. Docs, versions.

Non-goals: every item carried from the three retros (AC-1), the verifier's `proof/` folder
included; new CompozyOS shells, colours or icons; a second author of unit tests; the lean
pull-request template, the delivery models and pinning a change to its devkit version; tying the
loop's fallback agent map to the pack table (carried); a `tests:` block in this repository's own
`openspec/config.yaml`; the CompozyOS demo step's screenshots (round 21 replaces that loop).

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `carried-items-split`: `openspec/roadmap.md` holds the `stage-roles` line with the five roles only, and a new line for a change of its own (id proposed `coordinator-loop-fixes`, `after: stage-roles`) that lists every carried item of the three retros, none lost.
- AC-2 `mockup-drawn-when-ui`: on a `devkit` change whose classification has `ui` in `flags=[...]`, the loop hands the `mockup` stage to `screen-designer`, which writes each screen in the change's `mock/` folder in the target's own form (a self-contained static `mock/<screen>.html` for a web page or panel, monospaced text in `mock/<screen>.md` for a terminal, CLI or band), drawn with a real example's data, and writes `mockup.md` with `result=pending`; no image file is kept.
- AC-3 `mockup-skipped-without-ui`: on a change whose classification has no `ui`, the checker reports the `mockup` stage as not applying; no agent is dispatched and no `mockup.md` is written.
- AC-4 `mockup-owner-approval`: the session shows the mock-up to the owner (in Claude Code it may also publish it as a private Artifact); an owner's message asking for changes re-dispatches `screen-designer` with the notes as a new attempt; an owner's approval is recorded by the script command, quoting the owner's words, and sets `mockup.md` to `result=passed`; whatever the mock-up revealed is appended to `requirements.md` by the session.
- AC-5 `decisions-always-analysed`: on a `devkit` change the loop hands the `decisions` stage to `adr-author`, which writes `decisions.md` listing each ADR it drafted in the project's ADR folder with status Proposed, or one line saying why no decision needs an ADR.
- AC-6 `adrs-accepted-on-approval`: recording the owner's plan approval sets every ADR listed in `decisions.md` to Accepted with that date; while the plan is under revision they stay Proposed.
- AC-7 `early-stages-stale-readiness`: a `decisions.md` or `mockup.md` changed after `readiness.md` makes the readiness review stale (both join the `staleAfter` list of the `readiness` stage).
- AC-8 `test-config-declared`: `openspec/config.yaml`'s `devkit:` block accepts the unit, coverage (command and target) and E2E commands, and `openspec-setup` asks for them when it installs or upgrades the flow.
- AC-9 `unit-tests-stage`: `test-runner` runs the declared unit command and the coverage command, writes `unit-tests.md` with each command, its exit and its summary, and passes only when the suite is green and coverage meets the target when one is declared; otherwise the stage fails and the change returns to implementation; it never edits product code.
- AC-10 `e2e-stage`: with an E2E command declared, `e2e-tester` writes E2E tests from the acceptance criteria (test files only), runs them, and writes `e2e-tests.md` with each scenario, the AC it covers and its result; a red scenario fails the stage and returns the change to implementation. Without an E2E command the stage does not apply and no agent is dispatched.
- AC-11 `demonstration-as-text`: `pr-verifier` writes `evidence.md` with, per acceptance criterion, what it did, what it observed and whether it passed, as text inside the change; it takes no screenshots, keeps no image and posts no PR comment; the stage header, the `Commit:` line and the `### Gates` table keep the form the hooks read, and `deliver-check` still passes.
- AC-12 `lite-runs-tests-only`: `plugins/openspec/schemas/devkit-lite/flow.json` no longer declares the `mockup` and `decisions` stages; it keeps `unit-tests` and `e2e-tests`.
- AC-13 `no-stage-goes-back`: on a change opened before this version, a new stage applies only if the change has not passed that point: `mockup` and `decisions` do not apply once `proposal.md` exists, `unit-tests` and `e2e-tests` do not apply once `evidence.md` exists; no change under way is sent back.
- AC-14 `compozy-driver-runs-new-stages`: the CompozyOS kit's `openspec-change` loop runs the new stages in its existing role shells, with each role's instructions: `screen-designer` in `design`, `adr-author` in `tech-lead`, `test-runner` and `e2e-tester` in `qa`; no new shell is added.
- AC-15 `roles-doc-current`: `docs/roles.md` names the agent that plays each of the four roles today, says that `e2e-tester` writes and runs the E2E tests, that `test-runner` runs the whole suite, and that `screen-designer` runs only when the grill flags `ui`; `docs/coordination-design.md` D-4 marks stages 3, 4, 9, 10 and 11 as built.
- AC-16 `checks-green`: `node --test plugins/openspec/hooks/guard.test.mjs`, the CompozyOS kit's tests, `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` all pass, with the versions bumped as `CONTRIBUTING.md` says.

## Capabilities

### New Capabilities

- `stage-deliverables`: what each stage role delivers into a change: the mock-up and its files,
  the decisions and their records, the unit and E2E runs, and the demonstration as text.
- `file-writers`: which stage roles other than the implementer may write files outside the change
  folder, and what each may write.

### Modified Capabilities

- `change-stages`: the short script's stage list; conditional stages (a grill flag, a declared
  setting); a stage that arrived after the change passed its point; the mock-up's owner-ended
  attempts; the readiness stale after the mock-up or the decisions; the classification line the
  checker reads; every declared role ships with its skills.
- `change-coordination`: the test stages are handed from the stage checker; the mock-up gate; the
  accept-decisions step; the test settings and their validation.
- `roadmap-coordination`: the mock-up approval is one more owner gate with its phrase.
- `project-setup`: `openspec-setup` asks for the test commands.
- `compozy-kit-setup`: the kit's shells run the new stages.

## Impact

- devkit-core (0.8.1 to 0.9.0): new `agents/screen-designer.md`, `agents/adr-author.md`,
  `agents/test-runner.md`, `agents/e2e-tester.md`; new `skills/screen-mockup/`,
  `skills/adr-authoring/`, `skills/e2e-testing/`; `agents/pr-verifier.md`,
  `agents/change-planner.md`, `agents/code-quality-reviewer.md`; `README.md`.
- devkit-openspec (0.18.1 to 0.19.0): `schemas/devkit/` and `schemas/devkit-lite/` (`flow.json`,
  `schema.yaml`, templates); `hooks/flow-check.mjs`, `hooks/change-loop.mjs`,
  `hooks/roadmap-loop.mjs`, `hooks/conduct-check.mjs`, `hooks/guard.mjs` and their tests;
  `skills/devkit/SKILL.md`, `skills/ship-change/SKILL.md`, `skills/openspec-setup/` (`SKILL.md`,
  `templates/config.yaml`); `README.md`.
- devkit-compozy (0.2.0 to 0.3.0): `skills/compozy-setup/templates/` (the four shells, the loop)
  and its tests; `README.md`.
- Repository: `openspec/schemas/` (the copy `install-schemas.sh` keeps identical), `.compozy/`
  (re-installed), `docs/roles.md`, `docs/coordination-design.md`, `docs/openspec-flow.md`,
  `docs/compozy-kit.md`, `docs/adr/0014-stage-roles-write-their-own-files.md` (new), dated Notes in
  ADRs 0010 and 0011, `openspec/config.yaml` (ADR line), `openspec/roadmap.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json` (0.23.0),
  `docs/catalog.md` (generated). The version numbers meet the sibling changes at the release rebase.
- Projects: a project upgrading to 0.19.0 runs the decisions stage on every new `devkit` change, the
  mock-up on every `ui` one, and the test stages once it declares their commands; changes under way
  keep their place (AC-13).

**Dependencies.** `change-coordinator` (round 15) for `change-loop.mjs` and its locks;
`flow-script-checker` (round 14) for the declarations and `flow-check.mjs`; `roadmap-coordinator`
(round 18) for `roadmap-loop.mjs`; all archived at `2300f84`. The `openspec` CLI 2.x; `gh`.

**Exit criteria.** `openspec validate stage-roles --strict`; the whole hook suite
`node --test plugins/openspec/hooks/guard.test.mjs` green with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set; the five compozy-setup test files; `python3 scripts/check.py`;
`python3 scripts/gen-catalog.py --check`; `command claude plugin validate .`; the red runs saved
under `proof/`.

**What the owner approves**, in the message that approves the plan (quoted in `approval.md`):

- The plan, and ADR 0014 (`design.md` D-12): accept it and it is written `accepted`; refuse it and
  the plan goes back to planning before any code. It amends ADR 0010 decision 3 (a stage skipped by
  its condition leaves no file) and the product-code sentence of ADR 0010 decision 8 and ADR 0011
  decision 3 (decision records and the E2E tester's test files are not product code; a script step
  of the session accepts the listed records after the approval).
- The planner's resolutions of points the requirements left open: the nested `devkit.tests` keys
  (`design.md` D-3); the unit-test stage does not apply when no unit command is declared, as the E2E
  stage does not (D-1); the approval command named `stop-mockup-approval` (D-5); the mock-up's
  owner-ended ceiling written `"ceiling": "owner"` (D-1); the E2E tester's test-file rule (D-6).

**Decisions cited.** ADR 0010 decisions 1 (the test commands in round 16), 3 (a stage that does not
apply leaves its file; ceilings in configuration), 5 (existing locks stay), 6 (the owner's plan
approval as a human gate) and 8 (product code only by the implementer), 3 and 8 amended by the
proposed ADR 0014; ADR 0011 (the session writes no product code in a run; approval only from the
owner's message; decision 3 amended by ADR 0014); ADR 0013
(the roadmap run asks owner gates one change at a time); ADR 0004 (locks only in opted-in
projects); ADR 0009 (the CompozyOS kit as it is until round 21).

**Open decisions inherited.** None of `docs/coordination-design.md`'s open points is touched.
