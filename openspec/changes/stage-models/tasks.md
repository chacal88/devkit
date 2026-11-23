<!-- devkit-stage tasks result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Tasks

Change: `stage-models` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, function, message, file and test name
is in `design.md`: D-1 the table, D-2 reading it, D-3 the `model` field, D-4 the subagent reader, D-5
the retry, D-6 the roadmap's start model, `session-found` and the step-down, D-7 the spend readout,
D-8 the messages, D-9 the skill, D-10 ADRs and documents, D-11 the existing tests that change, D-12
the new tests, D-13 the probe and the real-run proof, D-14 the release. The implementer copies them
and makes no design choice.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own, so no
part holds a `|`. Every new test lives in `plugins/openspec/hooks/stage-models.test.mjs` and its name
starts `stage-models AC-<n> ` (D-12). Every new hook test takes its env from `cleanEnv` of
`change-loop.test.mjs` and sets its own `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_SESSION_ID` where it
needs a transcript. Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does. The tests need the `openspec` CLI 2.x on `PATH`. The whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once, in 4.6, as a
background command of the tool, never with a shell `&`. The marketplace check is written
`command claude plugin validate .`.

Test first in every task that changes code: write its tests, see them fail on the code before the
task, then make them pass. A test D-12 marks (kept) passes on the old code too; that is its point.
New tests call new functions through namespace imports (`import * as guard`, `import * as loop`), so
the file loads on the code before the task. An existing test changes only where `design.md` D-11
names it, in the task that changes its rule, with its invariant named in the commit message. Leave no
backup or scratch file in the tree, and end every task with `git status --short`.

The step-down rule is the owner's floor of 2026-11-23 (`proposal.md` "The step-down floor", ADR 0020
decision 4): a change session never steps below the strongest model among its stage and the
session-run stages still ahead of it. Task 1.3 adds the list of session-run stages
(`SESSION_RUN_STAGES`) and `strongest`; tasks 3.1 and 3.2 build the rule in `stepDownOf` alone (D-6).

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `default-table` | 1.2, 1.3, 1.6, 4.6 |
| AC-2 | `config-table` | 1.2, 1.4, 1.6, 4.6 |
| AC-3 | `invalid-refused` | 1.2, 1.4, 1.6, 4.6 |
| AC-4 | `one-million-opt-in` | 1.2, 1.3, 1.4, 1.6, 4.6 |
| AC-5 | `agent-model` | 1.1, 1.2, 1.5, 1.6, 4.6 |
| AC-6 | `session-start-model` | 3.1, 3.2, 3.5, 4.6 |
| AC-7 | `session-step-down` | 3.1, 3.2, 3.5, 4.6 |
| AC-8 | `upward-stage-subagent` | 1.1, 1.2, 1.5, 1.6, 4.6 |
| AC-9 | `lone-change` | 1.2, 1.5, 1.6, 3.2, 4.6 |
| AC-10 | `retry-one-step-up` | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.3, 4.6 |
| AC-11 | `retry-counted` | 2.1, 2.3, 2.6, 3.1, 3.3, 3.5, 4.3, 4.6 |
| AC-12 | `spend-readout` | 3.1, 3.3, 3.4, 3.5, 4.3, 4.6 |
| AC-13 | `real-run-proof` | 1.1, 4.3, 4.4, 4.6 |

## 1. The probe, the table and the model of each action (AC-1 to AC-5, AC-8, AC-9)

- [x] 1.1 The Agent `model` probe of D-13 (A-3), before any code: in an empty scratch folder outside
  this repository, run the D-13 probe command and save its output as
  `openspec/changes/stage-models/proof/probe-agent-model.jsonl`, and the fields of its Agent
  `tool_use` block and of the subagent's `assistant` events (`parent_tool_use_id`, `message.model`,
  no content) as `openspec/changes/stage-models/proof/probe-agent-model.txt`. When a nested
  `claude -p` is refused, end with `Outcome: failure` naming this task (the conducting session runs
  the probe in Bash, D-13). Check: `probe-agent-model.txt` shows the Agent call's input with
  `model` `haiku` and a subagent `message.model` holding `haiku`, and
  `grep -c '"parent_tool_use_id":"toolu' openspec/changes/stage-models/proof/probe-agent-model.jsonl`
  prints a number above 0. When the subagent's model is not Haiku, stop and report: the plan is
  revised before anything else.
- [x] 1.2 Red half. Export from `plugins/openspec/hooks/change-loop.test.mjs` and
  `plugins/openspec/hooks/roadmap-loop.test.mjs` the D-12 fixtures they do not export yet (an `export`
  keyword only, no test changes). Create `plugins/openspec/hooks/stage-models.test.mjs` with the D-12
  fixtures and the "Table", "Settings" and "Action" tests, add `import './stage-models.test.mjs';` to
  `plugins/openspec/hooks/guard.test.mjs` beside the `delivery-models` import, and run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models" plugins/openspec/hooks/stage-models.test.mjs`
  on the code before this phase. Check: every new test fails there but those D-12 marks (kept),
  which pass.
- [x] 1.3 Add `MODEL_STAGES`, `DEFAULT_MODELS`, `SESSION_RUN_STAGES`, `MODEL_VALUES`, `modelRank`,
  `cheaper`, `strongest`, `familyOf` and `oneUp` to `plugins/openspec/hooks/change-loop.mjs` as D-1
  says. Check: every `stage-models AC-1` table test (each of the 16 rows, `mockup`, `readiness`,
  `approval`, `e2e-tests` and `retro` included, and the `SESSION_RUN_STAGES` one) and the `AC-4`
  order tests (`strongest` included) pass.
- [x] 1.4 In `plugins/openspec/hooks/guard.mjs`, give `parseDevkitBlock` its `models` map; in
  `plugins/openspec/hooks/change-loop.mjs`, add `modelProblems` and `modelsOf`, make
  `readDevkitSettings` list the table's problems, add the `strictModels` option of `nextAction`
  (`runNext` passes `true`) and the `setting.model-stage` and `setting.model-value` rows of D-8 in
  both languages, as D-2 says. Check: every `stage-models AC-2`, `AC-3` and `AC-4` settings test
  passes (the lenient read and the `/devkit project` refusal included), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models config" --test-name-pattern="^change-loop settings" plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs`
  passes unchanged.
- [x] 1.5 Add `model` to `stageFields` in `decide` and pass `models` in `nextAction`'s facts (D-3);
  make the D-9 `model` clause edits of the Loop's `agent` item and of step 2's `agent` item in
  `plugins/openspec/skills/devkit/SKILL.md`. Check: every `stage-models AC-5`, `AC-8` and `AC-9`
  test passes, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop skill" plugins/openspec/hooks/change-loop.test.mjs`
  passes unchanged.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models AC-[123458] " --test-name-pattern="^stage-models AC-9 " --test-name-pattern="^change-loop" --test-name-pattern="^delivery-models" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/delivery-models.test.mjs && python3 scripts/check.py && test -s openspec/changes/stage-models/proof/probe-agent-model.txt` green; covers AC-1 to AC-5, AC-8 and AC-9.

## 2. The retry a model up (AC-10, AC-11)

- [x] 2.1 Red half. Add `CLAUDE_CODE_SESSION_ID: ''` to `SET` of
  `plugins/openspec/hooks/roadmap-loop.test.mjs` (the D-11 fixture change, before `collectRoadmap`
  reads a transcript in 2.4). Write the D-12 "Reader" and "Retry" tests in
  `plugins/openspec/hooks/stage-models.test.mjs` (spec `stage-models`: "A failed stage subagent is
  retried once on the next model up", "A second failure or a failure on Opus ends the run blocked",
  "The retry is read from the session's transcripts", every scenario, and the scenario "A lock reads
  no hand-off", now under "Only a next-action call after a hand-off reads the hand-offs"; spec `change-coordination`
  "Every end of a run is marked in the session's record", scenario "A failed stage agent"), the
  one-session roadmap retry, the `/devkit status` window and the stop-lock and status tests that
  read no subagent folder included. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models AC-1[01] " plugins/openspec/hooks/stage-models.test.mjs`
  on the code of phase 1. Check: every test this task adds fails there but the (kept) ones (the
  stop-lock and status ones among them); every phase-1 test still passes.
- [x] 2.2 Add `familyOfId`, `handOffKey` (its `[^.\n]+` language part), `subagentRun`, `handOffsOf`
  and `typedSince` (which skips a typed `/devkit status`) to `plugins/openspec/hooks/guard.mjs`, and
  the `model` of `usage` events in `transcriptEvents`'s usage mode
  (`{ usage: { id, tokens, model }, at }`), as D-4 and D-7 step 2 say; no other function changes.
  Check: every `stage-models AC-10` reader test passes, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" --test-name-pattern="^change-loop lock" plugins/openspec/hooks/change-loop.test.mjs`
  passes unchanged, "change-budget AC-4 with no budget next prints the same output with and without
  a session transcript, and reads none (kept)" among them (the readers are only defined here; no
  `next` calls them until 2.3, and then only with `--after`, D-5).
- [x] 2.3 Test first: add to `plugins/openspec/hooks/stage-models.test.mjs` the D-12 Retry test "a
  `next` with no `--after` after a failed hand-off, with no budget set, reads neither the session
  transcript nor the subagent folder and hands the stage on its table model with no `retry` mark,
  while the same call with `--after` and the failed action's key reads them and hands the retry"
  (spec `stage-models` "Only a next-action call after a hand-off reads the hand-offs", scenario "A
  call with no progress key reads no hand-off"), and see it fail on a `runNext` that passes `retry: true`. Then, in
  `plugins/openspec/hooks/change-loop.mjs`, add the `retry` and `handOffs` options of `nextAction`
  (`runNext` passes `retry: opts.after !== undefined`, so `next` reads the hand-offs only when called
  with `--after`; the locks, `wait` and `state` pass neither), the `handOffs` fact and the inner
  `retried` of `decide`, and the header comment's sentence (the retry is read on a `next` called with
  `--after`), as D-5 and D-10 say. Check: every `stage-models AC-10` and `AC-11` retry test of a
  lone change passes (the new one included), and every existing `change-loop decide:`,
  `change-loop next:`, `change-budget` and `change-loop lock` test passes unchanged, "change-budget
  AC-4 with no budget next prints the same output with and without a session transcript, and reads
  none (kept)" among them (D-11):
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models AC-1[01] " --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-budget" --test-name-pattern="^change-loop lock" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs`.
- [x] 2.4 In `plugins/openspec/hooks/roadmap-loop.mjs`, add the `retry` option of `collectRoadmap`:
  only `runCmd` and `nextCmd` pass `retry: true`; with it and no sessions per change,
  `collectRoadmap` reads `handOffsOf(path, typedSince(path))` once and passes the list as
  `handOffs` to each `nextAction`; the stop lock (`roadmapStopDecision`) and `statusCmd` pass
  nothing, as D-5 says. Check: the `stage-models AC-10` one-session roadmap retry test and the
  stop-lock and status tests pass, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^followups" plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes unchanged (the "reads the transcript once on every lock" test included).
- [x] 2.5 Make the D-9 failure edits of `plugins/openspec/skills/devkit/SKILL.md` (the Loop's
  `agent` item, the declared-ends paragraph, the `resolve-release-conflict` item, step 3 of "Every
  change in this session"), and in the same task the D-11 changes of "change-loop skill: an end the
  session declares goes through reply, and the marker lines are never shown (F1)" and "change-loop
  skill: the release-conflict sentence" (`plugins/openspec/hooks/change-loop.test.mjs`) and of the
  roadmap skill assertion on `Outcome: failure` (`plugins/openspec/hooks/roadmap-loop.test.mjs`),
  naming each invariant in the commit message. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="skill" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes, and `grep -c "why=role-failed" plugins/openspec/skills/devkit/SKILL.md` prints 0.
- [x] 2.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models" --test-name-pattern="^change-loop" --test-name-pattern="^change-budget" --test-name-pattern="^roadmap-loop" --test-name-pattern="^followups" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-10 and AC-11 (the retry and its budget), with every phase-1 test passing.

## 3. The roadmap's session models and the spend readout (AC-6, AC-7, AC-9, AC-11, AC-12)

- [x] 3.1 Red half. Add `CLAUDE_CODE_SESSION_ID: ''` to `SHIP_ENV` of
  `plugins/openspec/hooks/flow-check.test.mjs` (the D-11 fixture change, before `flow-check.mjs`
  reads a transcript in 3.4). Write the D-12 "Roadmap" and "Spend" tests (spec
  `roadmap-coordination`: "A change session starts on its stage's model", "A change session only
  steps down", "A change session's floor is set by the session-run stages ahead", "A stage above
  the session's model never switches it", every scenario, the floor ones
  included; spec `spend-readout`, every requirement and
  scenario), the `session-found` wiring tests, the `stepDownOf` floor rows (never `haiku` with the
  default table, the `devkit-lite` and `devkit` orders) and the `spendLines`-equals-`render` and
  `budgetValue` tests included. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models AC-(6|7|11|12) " plugins/openspec/hooks/stage-models.test.mjs`
  on the code of phase 2. Check: every test this task adds fails there but the (kept) ones; every
  earlier test still passes.
- [x] 3.2 In `plugins/openspec/hooks/change-loop.mjs#readRun` keep `model` and `refused`; in
  `plugins/openspec/hooks/roadmap-loop.mjs` add the start's `model`, `session-found`,
  `session-model` and `session-model-refused` to `SESSION_KEYS`, the inner `startedNow` and its use
  at the three sites D-6 lists (`entriesOf`'s `own` entry, `collectRoadmap`'s skip of a started
  change, `decideRoadmap`'s `sessionsStarted` filter, which feeds the record and the
  `roadmap-session-started` announcement), the `models` option of `collectRoadmap` (`runCmd` and
  `nextCmd` pass `true`), `stageModels` (`{ stage, models, stages }` from the lenient `nextAction`,
  `modelsOf` and `readFlow` reads), `stepDownOf` (the step-down rule with its floor at the
  session-run stages still ahead, in that function only),
  the `session-model` action of `decideRoadmap` and the writer's records, as D-6 says. In the same
  task make the D-11 change of "followups F-3 decide: with a session per change the coordinator
  hands no stage ..." (`START_FIELDS`, the expected `input`, `agentAct`/`grillAct`), naming its
  invariant in the commit message, and add the D-9 "A session per change" items (`session-found`,
  `session-model`) and the Never item to `plugins/openspec/skills/devkit/SKILL.md`. Check: every
  `stage-models AC-6`, `AC-7` and `AC-9` roadmap test passes (the `session-found` ones prove the
  three sites), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes.
- [x] 3.3 Move `budgetValue` from `plugins/openspec/hooks/change-loop.mjs` to
  `plugins/openspec/hooks/guard.mjs` unchanged, imported and re-exported by `change-loop.mjs`
  (D-7 "The cap"). In `plugins/openspec/hooks/guard.mjs` add `STAGE_OF` (moved from
  `roadmap-loop.mjs`, which imports it back), `spendOf`, `spendSources`, `SPEND_MESSAGES` (the D-8
  rows, `{title}` and never `{stage}`) and `spendLines` with its inner `fill`; spread
  `SPEND_MESSAGES` into `MESSAGES` of `plugins/openspec/hooks/change-loop.mjs` and make the D-11
  change of `SAMPLE` in "change-loop replies: no internal term in either language"
  (`plugins/openspec/hooks/change-loop.test.mjs`), naming its invariant in the commit message; all as
  D-7 and D-8 say. Check: every `stage-models AC-11` and `AC-12` reader and text test passes (the
  `fill`-equals-`render` test and the `budgetValue` identity test included), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="replies" --test-name-pattern="^change-budget" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes.
- [x] 3.4 Append the spend block in `plugins/openspec/hooks/flow-check.mjs#main` (text output only;
  `budgetValue` and `parseDevkitBlock` imported from `guard.mjs`, nothing from `change-loop.mjs`)
  and in `plugins/openspec/hooks/roadmap-loop.mjs#statusCmd` (the open ids from
  `entriesOf(facts).entries`, or `facts.unfinished` with no roadmap), as D-7 "Where it prints"
  says. Check: every `stage-models AC-12` command test passes,
  `grep -c "from './change-loop.mjs'" plugins/openspec/hooks/flow-check.mjs` prints 0, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs`
  passes unchanged (its sample texts included).
- [x] 3.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models" --test-name-pattern="^change-loop" --test-name-pattern="^change-budget" --test-name-pattern="^roadmap-loop" --test-name-pattern="^followups" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-6, AC-7, AC-9, AC-11 and AC-12.

## 4. Documents, the real-run proof and the release (AC-1 to AC-13)

- [x] 4.1 ADR number: read `origin/main` as the last merge of `main` into this branch left the ref
  (a stage brief allows no fetch); when a `docs/adr/0019-*` file exists there, renumber
  `docs/adr/0019-the-model-is-chosen-by-stage.md` to the next free number on `origin/main` at the
  last merge before review and change every reference to it in this change's files. Check:
  `git diff --quiet 4b825dc642cb6eb9a060e54bf8d69288fbee4904 origin/main -- 'docs/adr/0019-*'`
  exits 0 (no `0019` file on `origin/main`; the hash is Git's empty tree), or the renumbered file
  exists and `grep -rn "0019" openspec/changes/stage-models docs openspec/config.yaml` names no
  other ADR.
- [x] 4.2 Write the D-10 documents: the ADR 0014 header line and Note
  (`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`), the `openspec/config.yaml`
  comment and `ADRs:` line, the **The model of each stage.** paragraph, the four Troubleshooting
  rows and the Cost bullet of `docs/openspec-flow.md`, and the sentence of
  `docs/coordination-design.md`; then the D-12 "Skill and docs" tests pass. Check:
  `grep -c "only \`change-planner\` uses Opus" docs/openspec-flow.md` prints 0,
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models" plugins/openspec/hooks/stage-models.test.mjs`
  passes, `python3 scripts/check.py` passes and `openspec validate stage-models --strict` passes.
- [x] 4.3 Real run 1 of D-13, the lone change, in a scratch project outside this repository, with the
  stub pack. Save `proof/lone-run.jsonl`, `proof/lone-models.txt` and `proof/lone-spend.txt` under
  `openspec/changes/stage-models/`. Check: `lone-models.txt` shows a `unit-tests` subagent on a
  `haiku` model id then one on `sonnet`, and an `e2e-tests` subagent on `sonnet` then one on `opus`;
  `lone-run.jsonl` holds `devkit-end: proof-lone blocked`; `lone-spend.txt` lists the two retries.
  When a check fails, stop and report: the plan is revised before anything else.
- [x] 4.4 Real run 2 of D-13, the one-session roadmap run, the same way, saving
  `proof/road-run.jsonl`, `proof/road-models.txt` and `proof/road-spend.txt`. Check: the same
  models in the same order for `proof-road`, and `road-spend.txt` lists its retries. When `-p` cannot
  carry the run (D-13), stop and end with `Outcome: failure` naming this task: the conducting session
  runs it as D-13 says and writes the three files, and the phase is handed again. A loop that
  already has this change's retry rule may hand this task once more on a stronger model first; that
  attempt meets the same limit and ends the same way, which is accepted (D-13).
- [x] 4.5 Release as D-14 says: the next minor of devkit-openspec in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the next minor
  of the marketplace, both read from `origin/main` at the last merge before review, a `CHANGELOG.md`
  section, and the CI pins of `docs/openspec-flow.md` moved to the new tag. Check:
  `python3 scripts/gen-catalog.py --check` passes and
  `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 4.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate stage-models --strict && grep -q "devkit-end: proof-lone blocked" openspec/changes/stage-models/proof/lone-run.jsonl && test -s openspec/changes/stage-models/proof/road-models.txt && test -s openspec/changes/stage-models/proof/probe-agent-model.txt` green (the guard suite as a background command of the tool); covers AC-1 to AC-13.

## Workflow follow-up

- After the merge, tag the release's version on the merge commit and push the tag
  (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the `stage-models` line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-openspec and move the pinned `devkit-reviews`
  workflow to the new tag.
- Dogfood in the next roadmap run in the desktop app (`/devkit roadmap` typed by the owner): a
  change session starts with the stage's model in the start's input, steps down once, to Sonnet at
  its first Sonnet stage after the grill, and stays on Sonnet through its unit tests, delivery and
  retro (never Haiku), while its Haiku stages run as Haiku subagents, and the `/devkit status` board
  shows each change's spend; record it in that
  run's retro (the live half of AC-6 and AC-7, which this change proves on fixtures).
