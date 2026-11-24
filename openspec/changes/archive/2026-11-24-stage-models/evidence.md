<!-- devkit-stage evidence result=passed attempt=1 commit=f37bcadd22a62b58b63a3585685cf7405e2e10f4 -->
Commit: f37bcadd22a62b58b63a3585685cf7405e2e10f4

# Evidence

Change: `stage-models` · Verified on 2026-11-23 on the branch `stage-models`, working tree clean
(`git status --short` printed nothing before this file was written). Every test run used
`TMPDIR=/var/tmp/devkit-stage-models`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`,
with the `openspec` CLI 2.0.0 on `PATH`.

## Verification

### Gates

The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`) imports `stage-models.test.mjs`,
`change-loop.test.mjs`, `delivery-models.test.mjs`, `roadmap-loop.test.mjs` and `flow-check.test.mjs`
(lines 15 to 21 of `guard.test.mjs`), so its one green run in this verification (2180 tests, 2180
pass, 0 fail, 0 cancelled, about 35 minutes) stands for every gate part below that names those test
files with a name filter; those rows say so. The parts that are not test runs were run on their own.

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models AC-[123458] " --test-name-pattern="^stage-models AC-9 " --test-name-pattern="^change-loop" --test-name-pattern="^delivery-models" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/delivery-models.test.mjs` | pass: covered by the whole-suite run (4.6), in which the 9 + 15 + 10 + 6 + 5 + 1 + 3 stage-models AC-1 to AC-5, AC-8 and AC-9 tests and every change-loop and delivery-models test pass |
| 1.6, 2.6, 3.5, 4.6 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 1.6 | `test -s openspec/changes/stage-models/proof/probe-agent-model.txt` | pass: exit 0 |
| 2.6, 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^stage-models" --test-name-pattern="^change-loop" --test-name-pattern="^change-budget" --test-name-pattern="^roadmap-loop" --test-name-pattern="^followups" plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: covered by the whole-suite run (4.6), in which all 115 `stage-models` tests and every change-loop, change-budget, roadmap-loop and followups test pass; `roadmap-loop.test.mjs` alone also ran green (exit 0, 1149 passing lines) |
| 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs` | pass: covered by the whole-suite run (4.6), which imports `flow-check.test.mjs`; no test failed |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, tests 2180, pass 2180, fail 0, cancelled 0, skipped 0 |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.6 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 4.6 | `openspec validate stage-models --strict` | pass: exit 0, "Change 'stage-models' is valid" |
| 4.6 | `grep -q "devkit-end: proof-lone blocked" openspec/changes/stage-models/proof/lone-run.jsonl` | pass: exit 0 |
| 4.6 | `test -s openspec/changes/stage-models/proof/road-models.txt` | pass: exit 0 |
| 4.6 | `test -s openspec/changes/stage-models/proof/probe-agent-model.txt` | pass: exit 0 |

Other task checks re-run: `grep -c "why=role-failed" plugins/openspec/skills/devkit/SKILL.md` prints 0;
``grep -c "only `change-planner` uses Opus" docs/openspec-flow.md`` prints 0;
`grep -c "from './change-loop.mjs'" plugins/openspec/hooks/flow-check.mjs` prints 0;
`grep -c '"parent_tool_use_id":"toolu' openspec/changes/stage-models/proof/probe-agent-model.jsonl`
prints 1.

### Acceptance criteria

Test counts below are the passing `stage-models AC-<n> ` lines of the whole-suite run; the 115 passing
lines add up to the 115 `stage-models` tests of `plugins/openspec/hooks/stage-models.test.mjs`. The
AC-13 proof was not re-run, as the stage brief says; it is cited from
`openspec/changes/stage-models/proof/`.

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | default-table: with no `models:` key, `next` returns the built-in model of each stage | 9 `stage-models AC-1` tests pass: `MODEL_STAGES` equals the two flows' stage ids; `DEFAULT_MODELS` holds the design's 16 rows, frozen; the action at each stage of a `devkit` change and at the unit tests and delivery of a `devkit-lite` change carries the default; `next` at the plan stages of a real change carries it, the approval end included; the ADR numbered 0020 is the only one of its number; the flow document's table and Cost section state it. As the proposal resolves it, "validation" is the `openspec-validator` helper (already Haiku) and has no stage row | pass |
| AC-2 | config-table: a `models:` entry in `openspec/config.yaml` changes the stage's model, and the change's `.openspec.yaml` entry wins | 15 `stage-models AC-2` tests pass: the parser reads the map in file order and nested or inline forms; the project entry changes one stage and the others keep the default; the change entry wins for that change and another change keeps the project entry; an empty value falls to the next layer; quoted values and comments read; `next` at the design stage carries the project entry and then the change entry over it; the settings comment and the coordination design name the table | pass |
| AC-3 | invalid-refused: an unknown stage or value makes `start` and `next` refuse with `setting-unknown`, naming the setting and the accepted values | 10 `stage-models AC-3` tests pass: `modelProblems` lists an unknown stage and an unknown value; a bad project table makes `start` answer `setting-unknown` naming the setting and accepted values and `open` create nothing, in English and Brazilian Portuguese; `/devkit roadmap`, `/devkit status` and `/devkit project` answer it and start nothing; a bad change table or project table makes `next` exit 3 with the reply and no hand-off; a lenient read ignores a bad change table. As the proposal resolves it, `start` answers mode `setting-unknown` with exit 0 and `next` exits 3 | pass |
| AC-4 | one-million-opt-in: no default row is `[1m]`; `opus[1m]` and `sonnet[1m]` are accepted as written; `haiku[1m]` is refused | 6 `stage-models AC-4` tests pass: no default value ends in `[1m]`; `MODEL_VALUES` holds the five values cheapest first; `modelRank` and `cheaper` order every pair and know no other value; `familyOf` and `oneUp` keep the suffix; `strongest` gives the highest value; `opus[1m]` and `sonnet[1m]` come back as written from `modelsOf` and on the action. `haiku[1m]` is outside the five accepted values and is listed by `modelProblems` (AC-3 test) | pass |
| AC-5 | agent-model: every `agent` action carries a `model`, and the skill tells the session to pass it on the Agent call | 5 `stage-models AC-5` tests pass: every action `next` prints over the plan stages of a real change carries a model, the hand-offs included; every agent action `decide` gives at a stage with an agent carries it; an end at a stage with a row carries it; the skill's Loop `agent` item and step 2's `agent` item set the Agent call's model from the action, without the 1M suffix | pass |
| AC-6 | session-start-model: in a roadmap run, `session-start`'s `input` holds the model of the change's first stage | 5 `stage-models AC-6` tests pass: a new change session starts on the model of its grill, the input holding it beside context `fresh`; a change resumed at its implementation starts on Sonnet; a reported start records the model and a reported found session records none; a found-running session is the change's own at the three sites of `session-found`; an old run-file entry reads back as `{ at }`. Proven on fixtures; the live half is the dogfood item of "Workflow follow-up" in `tasks.md` | pass |
| AC-7 | session-step-down: a switch only when the floor is cheaper than the session's model, never to a more expensive one | 18 `stage-models AC-7` tests pass: `stepDownOf` gives the floor only when cheaper than the session and not the refused one; with the default table it never gives Haiku, at each stage of each script; it counts the approval only in the script that has it; a session on Opus with its change at the approval gets one `session-model` to Sonnet, on an event turn and on a typed one; a session on Sonnet gets none; after a reported switch none follows, after a refused one the same target is not returned; a stopping run and the stop lock return none; a session with no recorded model is never switched; ADR 0014's header and Note and the skill name the action | pass |
| AC-8 | upward-stage-subagent: a stage above the session's model is an `agent` action with that model, never a switch | 1 `stage-models AC-8` test passes: a design hand-off carries `opus` whatever the session runs on, and no action switches the session; the AC-7 test "a session on sonnet ... retro on opus in the table gets no switch, and no upward floor gives one" covers the roadmap side | pass |
| AC-9 | lone-change: `/devkit change` alone never calls the session-model tool | 3 `stage-models AC-9` tests pass: no action of the change loop has a switching kind and the loop names no session-model tool; the skill's change sections name none; `decide` without models prints no model on any action (kept) | pass |
| AC-10 | retry-one-step-up: one failure on Haiku or Sonnet gives the same stage a family up; a second failure, or one on Opus, ends the run blocked with `role-failed` | 29 `stage-models AC-10` tests pass (the two AC-11 tests are counted apart): the transcript readers (`subagentRun`, `handOffKey`, `handOffsOf`, `typedSince`); a failure on Haiku gives Sonnet with the same brief and key; Sonnet gives Opus and `sonnet[1m]` gives `opus[1m]`; two failures in a row end the run blocked with `role-failed`, exit 2 and the end line; a failure on Opus ends it with no retry; a success between failures gives a retry again; a call with no `--after` reads no transcript and no subagent folder; the one-session roadmap run retries and blocks per change; the stop lock and `/devkit status` read no hand-off. Real runs, cited from the proof folder: `lone-models.txt` lists a `unit-tests` subagent on `claude-haiku-5-5` then one on `claude-sonnet-5-5`, and an `e2e-tests` subagent on `claude-sonnet-5-5` then one on `claude-opus-5-5`; `lone-run.jsonl` holds `devkit-end: proof-lone blocked` | pass |
| AC-11 | retry-counted: the retry's tokens are in the `budget` count and in the readout, marked as a retry | 2 `stage-models AC-11` tests pass: a retry at the cap is held by the budget and counts its tokens; a retry is listed with its families and its tokens and the stage shows both models. Real run: `lone-spend.txt` lists "Stage Unit tests, a retry from haiku to sonnet: 18391" and "Stage E2E tests, a retry from sonnet to opus: 6298" and a total of 142878 tokens | pass |
| AC-12 | spend-readout: `flow-check` and `/devkit status` print tokens per stage and per model, the retries and the total against the cap, and write no file | 12 `stage-models AC-12` tests pass: the spend reads per stage and per model (3210 and 1105, 4315 in all in the known case); another change's lines and a repeated message id do not count; an unreadable transcript adds nothing; the total line holds the cap or says no budget is set; every spend row of either language is the text `render` gives; `budgetValue` is one function from `guard` or `change-loop`; `flow-check` prints the block after the readout with `--json` unchanged; roadmap status prints one block for the open change that counted tokens; neither command writes a file, a branch or the run file; with no transcript both outputs are what they were. Real runs: `lone-spend.txt` and `road-spend.txt` show the per-stage, per-model lines, the retries and the total, with "no budget is set" | pass |
| AC-13 | real-run-proof: a lone change and a roadmap run on at least two stages with different models, each in the transcripts' model fields, plus one retry; the guard suite passes | Not re-run; cited from `openspec/changes/stage-models/proof/` (`run-notes.txt`). Probe (task 1.1): `probe-agent-model.txt` shows an Agent call with input `model` `haiku` from a `claude-sonnet-5-5` parent and a subagent `message.model` of `claude-haiku-5-5`. Lone run (`proof-lone`): `lone-models.txt` shows `unit-tests` on haiku then sonnet and `e2e-tests` on sonnet then opus, read from the subagent transcripts' model fields; `lone-run.jsonl` holds `devkit-end: proof-lone blocked`. Roadmap run in one session (`proof-road`): `road-models.txt` shows the same four models in the same order, `road-spend.txt` lists both retries, and `road-run.jsonl` ends with the loop's line "proof-road stopped: the E2E tests could not finish its work. The changes after it wait." (the roadmap loop prints no `devkit-end` line). Guard suite: pass, 2180 of 2180 (gate 4.6 above) | pass |

## Observations for the reviewer

- The roadmap real run covers the one-session roadmap mode (one session handing every stage as agents),
  as design D-13 allows. A roadmap run with a session per change (`session-start`, `session-model`) is
  proven by the fixture tests of AC-6 and AC-7 only; its live half is the dogfood item in
  `tasks.md` "Workflow follow-up".
- In the roadmap run, after the loop's stuck end the session tried `reply blocked --param
  why=e2e-tests-failed`; the loop refused it as an unknown reply key and changed nothing
  (`run-notes.txt`). No effect on the result.
- The proof stubs differ from D-13's text in the three ways `run-notes.txt` lists (bypassPermissions,
  the marker in `.git/info/exclude`, the stub that writes no file when a stop hook asks); the runs the
  files record used those.
- Two whole-suite or `stage-models.test.mjs` runs started at the same time on this loaded machine
  (shared `/var/tmp`, load average above 12) both ended after about 30 minutes with "Promise
  resolution is still pending but the event loop has already resolved" at the test after
  `followups AC-7 next: a hold whose process ended ...`, with 1 cancelled file and no failing test.
  That test (`followups AC-7 hold: a killed hold process ...`, unchanged by this change) passed alone,
  filtered under `stage-models.test.mjs`, in the whole `roadmap-loop.test.mjs` run, and in the single
  whole-suite run recorded above, which was the only process of mine running. No defect was found in
  the change; the two interrupted runs are not counted as proof.
