<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11) Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`). Carried from the roadmap-coordinator retro, the first whole change run with /devkit change: a declared step for a small fix after a red gate, in place of a run that ends blocked; a way for a task to say that the conducting session does it, so the loop does not hand it to the implementer; how the wait on GitHub lives with a host that has its own pull-request monitor and forbids polling, so that the session still goes on alone when the checks pass; and the verifier allowed to write its runs' output under the change's `proof/` folder.

Classification: domain=process type=feature flags=[architecture, contract] (confirmed)

The owner split the request on 2026-11-21: this change delivers the five stage roles only; every item carried from the three retros moves to a new change of its own (AC-1).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The four new roles ship as `devkit-core` agents: `plugins/core/agents/screen-designer.md`, `plugins/core/agents/adr-author.md`, `plugins/core/agents/test-runner.md`, `plugins/core/agents/e2e-tester.md`.
- The new skills the stage declarations name ship in `devkit-core`: `plugins/core/skills/screen-mockup/SKILL.md`, `plugins/core/skills/adr-authoring/SKILL.md`, `plugins/core/skills/e2e-testing/SKILL.md`. `test-and-coverage` and `systematic-debugging` already exist and are reused by `test-runner`.
- The `mockup` stage of `plugins/openspec/schemas/devkit/flow.json` keeps `screen-mockup` as its skill; `screen-design` (CompozyOS pack, records screen-map rows after the plan) leaves that stage's `skills` list. Correctable.
- In both `flow.json` files, the stages of the shipped roles drop `"shipped": false`.
- The grill's classification line in `requirements.md` is the one written above: `Classification: domain=<..> type=<..> flags=[<flag>, ...]`. The script reads the `ui` flag from `flags=[...]` to decide whether the mock-up applies.
- The project's test commands live in the `devkit:` block of `openspec/config.yaml`: `devkit.tests.unit` (command), `devkit.tests.coverage.command` (command), `devkit.tests.coverage.target` (whole number, percent), `devkit.tests.e2e` (command). AMBIGUOUS only on nesting: (a) the keys above under `devkit.tests` | (b) flat keys under `devkit` (`unitTests`, `coverageCommand`, ...); the planner resolves, keeping the four values.
- `test-runner` runs the whole unit suite and the coverage command, not only the touched surfaces (D-4 stage 9); `docs/roles.md` is corrected to say so.
- A unit suite that is red, or coverage below `devkit.tests.coverage.target`, sets `unit-tests.md` to `result=failed` and the change goes back to implementation (the stage's existing `onFail`). Without a target, coverage is recorded and does not fail the stage.
- `e2e-tester` writes test files only, from the acceptance criteria, without reading the implementer's tests; it never touches product code. A red E2E test sends the change back to implementation (existing `onFail`).
- The project's ADR folder is the one the project uses (`docs/adr/` here); `adr-author` finds it as `adr-reviewer` does today.
- A new ADR is written with its status line set to Proposed; the command that records the owner's plan approval sets every ADR listed in `decisions.md` to Accepted with the date.
- The owner's approval of a mock-up is recorded by a script command of the same kind as the plan approval (a new `ship-change` row next to `stop-plan-approval`, named by the planner), only from the owner's own message.
- The mock-up redraw loop has no ceiling of its own: the owner stops it by approving.
- The new agents are dispatched one stage at a time by the loop like every existing role; no new hook lock.
- Version bumps follow `CONTRIBUTING.md` (devkit-core, devkit-openspec, devkit-compozy and the marketplace) and meet the sibling changes at the release rebase.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
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

## Out of scope

- Every item carried from the change-coordinator, coordinator-field-fixes and roadmap-coordinator retros, including the verifier's `proof/` folder: they go to the new change of AC-1.
- New CompozyOS role shells, colours or icons.
- A second author of unit tests (D-4: the implementer's TDD covers them).
- The lean pull-request template (a debt for later, D-4), the delivery models (round 17) and pinning a change to the devkit version it opened with (managed-agents-study candidate).
