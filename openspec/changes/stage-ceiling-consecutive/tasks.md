<!-- devkit-stage tasks result=passed attempt=3 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Tasks

Change: `stage-ceiling-consecutive` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

Work only in this change's worktree, on its branch. Every rule, function, sentence, file and test
name is in `design.md`: D-1 the fact, D-2 the reader, D-3 the count, D-4 the history cases, D-5 the
params and the walk, D-6 the sentences, D-7 the documents, D-8 the real-run proof, D-9 the tests,
D-10 the release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own, so no
part holds a `|`. Every hook gate sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a pull-request run
on CI does, and the private `TMPDIR` `/var/tmp/devkit-stage-ceiling-consecutive`. The tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`guard.test.mjs`, 13 to 45 minutes) runs once, in
3.6, as a background command of the tool, never with a shell `&`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

A test never reads this repository's git history: every history is a fixture repository the test
builds (D-9, `takesChange`). Test first: tasks 1.1 and 2.1 write the new tests, run them on the code
before the fix and save the output, as printed, under `openspec/changes/stage-ceiling-consecutive/proof/`.
That run is the task's check, never a gate. An existing test is edited only as D-9's table says;
name its invariant in the commit message. Leave no backup or scratch file in the tree, and end every
task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `passed-attempts-reset-the-count` | 1.1, 1.2, 1.3, 1.4, 3.4 |
| AC-2 | `consecutive-failures-still-block` | 1.1, 1.3, 1.4, 3.4 |
| AC-3 | `a-pass-between-failures-resets` | 1.1, 1.2, 1.3, 3.4 |
| AC-4 | `history-unreadable-keeps-today-rule` | 1.1, 1.2, 1.3, 1.6, 3.4 |
| AC-5 | `header-and-attempt-unchanged` | 3.3 |
| AC-6 | `the-readout-says-failures-in-a-row` | 1.1, 1.4, 1.5, 2.1, 2.2, 2.3, 3.4 (P-1, P-2, P-12, P-13) |
| AC-7 | `retaken-takes-do-not-count` | 1.1, 1.3, 3.4 |
| AC-8 | `roadmap-ticks-both` | 3.2 (the line); the ticks at archive (Workflow follow-up) |
| AC-9 | `pinned-in-flow-check-test` | 1.1, 1.7 |

## 1. The stage checker counts failures in a row

- [x] 1.1 Write the new tests of D-9 in `plugins/openspec/hooks/flow-check.test.mjs`: the helper
  `takesChange` and the nine `stage-ceiling-consecutive …` tests, every new export reached as
  `FC.stageHistory` / `FC.failuresInARow`. Run them on today's code with
  `env TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^stage-ceiling-consecutive" plugins/openspec/hooks/flow-check.test.mjs`
  and save the output as `proof/red-flow-check.txt`. Check: every test whose name carries AC-1,
  AC-2, AC-3, AC-4, AC-6 or AC-7 fails there (AC-9), and the file still loads (the other tests pass).
- [x] 1.2 Add `stageHistory(root, rel, env)` (D-2) and `failuresInARow(current, earlier)` (D-3) to
  `plugins/openspec/hooks/flow-check.mjs`, exported, and the lazy memoised `facts.history(path)` to
  `collectFlow` (D-1). Check: `stage-ceiling-consecutive: failuresInARow counts the distinct failed
  headers since the last pass` and the two `stage-ceiling-consecutive AC-4 …` subtests that call
  `FC.stageHistory` directly (F-1 no repository, F-2 no `git` on `PATH`) pass.
- [x] 1.3 Wire the count into `artifactState` and `computeFlow` (D-5): `failures` in the raw state and
  in the params of `header-failed`, `fix-after-failure` and `ceiling-reached`; the ceiling compares
  `failures`. Check: the AC-1, AC-2 (its H-6 restarted-round case included), AC-3, AC-4 and AC-7
  tests and `stage-ceiling-consecutive: the history is read only for a failed stage with a numeric
  ceiling` pass.
- [x] 1.4 Replace the three sentences of `TEXT.en` and `TEXT['pt-BR']` in `flow-check.mjs` with D-6's,
  and edit the existing tests of D-9's table in `flow-check.test.mjs` (the three walk tests, the `P`
  table, `SAMPLE_PT` and `SAMPLE_EN`). Check: `stage-ceiling-consecutive AC-6: the readout says the
  failures in a row in both languages` and `flow-check readout: both languages cover every reason
  code` pass.
- [x] 1.5 Edit `version-pin AC-2 readout: the version-1 ceiling holds after the upgrade` in
  `plugins/openspec/hooks/version-pin.test.mjs` as D-9's table says. Check: it passes with the
  filtered run of 1.7.
- [x] 1.6 Documents of the checker (D-7): `docs/openspec-flow.md` line 109, `plugins/openspec/README.md`
  line 21, `docs/coordination-design.md` lines 348-349. Check: `grep -rn "failed attempts they get\|failed-attempt ceilings" docs plugins/openspec/README.md`
  prints nothing, and `python3 scripts/check.py` passes.
- [x] 1.7 Gate: `mkdir -p /var/tmp/devkit-stage-ceiling-consecutive && env TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^flow-check" --test-name-pattern="^stage-ceiling-consecutive" --test-name-pattern="^stage-roles" --test-name-pattern="^version-pin" plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs && python3 scripts/check.py`
  green; covers AC-1, AC-2, AC-3, AC-4, AC-6 (the checker), AC-7 and AC-9.

## 2. The loops say the failures in a row

- [x] 2.1 Write the two new tests of D-9 in `plugins/openspec/hooks/change-loop.test.mjs`
  (`stage-ceiling-consecutive AC-6 loop: …`). Run them on the code before this phase's fix with
  `env TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^stage-ceiling-consecutive AC-6 loop" plugins/openspec/hooks/change-loop.test.mjs`
  and save the output as `proof/red-change-loop.txt`. Check: both fail there.
- [x] 2.2 In `plugins/openspec/hooks/change-loop.mjs` (D-6): the `{failures}` special name in
  `render`, the en and pt-BR `blocked-why.ceiling` messages, `failures: e.params?.failures` in
  `blockedEnd`, and the two `fix-after-failure` briefs (lines 1119-1121 and 1157-1160). Edit the
  existing `change-loop.test.mjs` tests of D-9's table (`change-loop replies: a stage reads as a noun
  phrase in each language`, `change-loop decide: P5 …`, `stage-roles loop: fix-tests …`,
  `change-state AC-3 state: …`, `change-state AC-4 state: …` S1). Check: the two
  `stage-ceiling-consecutive AC-6 loop` tests and the five edited tests pass.
- [x] 2.3 In `plugins/openspec/hooks/project-loop.mjs#blockedEnd`, pass `failures: e.params?.failures`
  beside `attempt` (D-6), and edit `project-loop next: S12 a review at its ceiling ends blocked` in
  `plugins/openspec/hooks/project-loop.test.mjs` as D-9's table says. Check: that test passes.
- [x] 2.4 Gate: `mkdir -p /var/tmp/devkit-stage-ceiling-consecutive && env TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^change-loop" --test-name-pattern="^change-state" --test-name-pattern="^stage-roles" --test-name-pattern="^stage-ceiling-consecutive" --test-name-pattern="^project-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py`
  green; covers AC-6 (the loops).

## 3. Release, proof and the whole suite

- [x] 3.1 Release (D-10): devkit-openspec's patch bump in `plugins/openspec/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`, the marketplace `metadata.version` patch, the `CHANGELOG.md`
  entry, the CI pin in `docs/openspec-flow.md` and its assertion in `change-loop docs: the design
  records the answers` (`plugins/openspec/hooks/change-loop.test.mjs`; invariant: the CI snippet pins
  the current release; layer: docs; suite: change-loop), each number the next free one on
  `origin/main` at the last merge before review; regenerate `docs/catalog.md` with
  `python3 scripts/gen-catalog.py`. Check: `python3 scripts/gen-catalog.py --check` passes and
  `change-loop docs: the design records the answers` passes.
- [x] 3.2 In `openspec/roadmap.md`, append to the `evidence-attempts-by-failure` line ` — delivered by
  stage-ceiling-consecutive (fused, 2026-11-23)`, leaving both lines unticked until the archive (AC-8).
  Check: `grep -n "evidence-attempts-by-failure" openspec/roadmap.md` shows the line with that text
  and `- [ ]`.
- [x] 3.3 AC-5: the header, the agents and the declarations are unchanged. Check:
  `git diff --stat "$(git merge-base HEAD origin/main)" HEAD -- plugins/openspec/hooks/guard.mjs plugins/openspec/schemas openspec/schemas plugins/core/agents plugins/openspec/skills scripts/released-flows.json`
  prints nothing, and `flow-check header: a well-formed line is read` passes unchanged.
- [x] 3.4 Real-run proof (D-8): build the scratch repositories under
  `/var/tmp/devkit-stage-ceiling-consecutive`, with no `ship:` key in their `openspec/config.yaml` and
  the change-loop CLI tests' environment (`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
  `GITHUB_HEAD_REF`, `GITHUB_BASE_REF`, `GITHUB_EVENT_PATH` and `CLAUDE_CODE_SESSION_ID` empty,
  `TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive`), the `change-loop.mjs next` runs (P-2, P-13) on
  branch `main` of the scratch checkout, P-13 on a plan-only change made as `planChange` of
  `change-loop.test.mjs` does. Run P-1 to P-13 with the worktree's
  `plugins/openspec/hooks/flow-check.mjs` and `plugins/openspec/hooks/change-loop.mjs` and the real
  `openspec` CLI, and save every command and its output, as printed, in
  `openspec/changes/stage-ceiling-consecutive/proof/real-run.txt`, one section per run. Check: each
  section's output shows D-8's expected column (the next stage or end, `failures`, the exit code, and
  for P-1 the readout, for P-2 the `next` reply, for P-12 the state text, in the languages named,
  and for P-13 the brief `readiness failed at attempt 3 (failures in a row: 1 of 3): revise the plan
  from its findings`; the `fix-tests` brief has no real run, D-8 says why, and its proof is the
  unit test of task 2.1); covers AC-1, AC-2
  (P-9 the restarted review round included), AC-3, AC-6 and AC-7 on real runs, the conducting
  session's part included, and AC-4 on the cases the checker reaches (P-10 a depth-1 clone, P-11 a
  stage file never committed). No run outside a git repository or without `git`: `flow-check` exits
  3 there before any walk, as today, and the reader's `[]` for those is proven by task 1.2's unit
  cases only.
- [x] 3.5 Remove the scratch repositories of 3.4. Check: `ls /var/tmp/devkit-stage-ceiling-consecutive`
  lists none of them, and `git status --short` shows only the change's files.
- [ ] 3.6 Gate: `mkdir -p /var/tmp/devkit-stage-ceiling-consecutive && env TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate stage-ceiling-consecutive --strict`
  green, the suite run as a background command of the tool; covers AC-1 to AC-7 and AC-9 with every
  other suite at once.

## Workflow follow-up

- At archive (`ship-change`'s archive steps): tick both `stage-ceiling-consecutive` and
  `evidence-attempts-by-failure` in `openspec/roadmap.md` (AC-8), the second keeping the "delivered by
  stage-ceiling-consecutive" text of 3.2.
- The coordinating session closes the `evidence-attempts-by-failure` worktree and session without a
  change of their own (requirements, assumption 1).
