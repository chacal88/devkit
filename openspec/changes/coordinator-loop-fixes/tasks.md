<!-- devkit-stage tasks result=passed attempt=6 commit=db28ef29d37b4607c396c090d2c81724ac0848f1 -->
# Tasks

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every text, name, test and command is in `design.md`: D-1 the
declared steps, D-2 the end marker, D-3 the red gate, D-4 the extra review round, D-5 the conflict outside the
release files, D-6 the conducting session's tasks, D-7 the revised plan, D-8 the verifier's `proof/`, D-9 the agent
map, D-10 the host monitor, D-11 the language, D-12 the documents, D-13 the nits, D-14 the real runs, D-15 the
existing tests, D-16 the new tests (T1 to T141, T24 dropped with AC-3), D-17 the siblings and the merge that opens each phase, D-18
the release, D-19 the CompozyOS driver and its kit, D-20 the `archive-` id's own pull request, D-21 the delivered change on a branch advanced into the base,
D-22 a change's own settings in an `x-devkit:` block (the change's settings ADR), D-23 the tests of the live roadmap. The implementer copies them and makes no design choice.
The plan names every function, export, constant, table, test and file, never a line: the implementer finds
each with `grep -n "<name>"` and re-reads it before editing it. No task writes a version or an ADR number
that the plan does not give as a rule: the release takes "the next free version at merge" (D-18), and each of
the change's ADRs, as listed in `decisions.md`, keeps the number it has until the loop's `renumber-adr` step
renames it.

Every gate is one backticked command, run as written. The flow takes the first backticked text after `Gate:` and
runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts `coordinator-loop-fixes AC-<n>
T<k> `, in the file D-16 names: the loop-level tests in the new `plugins/openspec/hooks/change-loop-declared.test.mjs`,
which imports only fixtures modules, never a test file. A test of an export this change adds reads it through a
namespace import of its module (`FC`, `DC`, `GUARD`, `changeLoopModule`, or the new file's own), so the file loads
before the export exists. Every new hook test takes its env from the existing fixtures, which blank `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`, and makes every
temporary folder through `test-tmp.mjs`. Every test run goes through `node scripts/test-suite.mjs --concurrency=2`
(ADR 0026), which runs each file in its own process, two at once. A phase gate runs only the test files its phase
touches (D-17: the files it adds tests to or edits tests in, and the files of the D-15 tests for the rules and texts it
changes), in two parts: the area's files whole, and the large mixed files filtered by anchored `--test-name-pattern`
values (the script applies its patterns to every file it runs), each with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as
a pull-request run on CI does. No gate and no task runs the whole suite or a near-whole list of files: the whole suite
runs only on the delivery train (`devkit.delivery.train` in `openspec/config.yaml`), at its head. Before a gate, each
file the phase added tests to is run alone with `node scripts/test-suite.mjs --concurrency=2 <file>` and stays under
about 300 s (split by `CONTRIBUTING.md` otherwise). The tests need the `openspec` CLI 2.x on `PATH`. The marketplace
check is written `command claude plugin validate .`, so that a shell function named `claude` is skipped.

Three kinds of work are not the implementer's (D-14): 4.1 (the real run R10), done and ticked before the
conducting session hands phase 4; 6.3 (the real runs R6, R7 and R7b, which call `change-loop.mjs declare` directly,
a command the guard this change adds refuses to any subagent); and the fetch of `origin/main`, which the
conducting session does before it hands each phase whose first task is a merge (the `N.0` tasks) and before 6.1. An implementer that meets 4.1
or 6.3 open stops before it and reports it without doing it, returning success for the tasks before it; the
conducting session does it, ticks it, and hands the phase again. No implementer or verifier command holds a
`node … change-loop.mjs declare` line: a `declare` of a real run is the conducting session's or a nested
`claude -p` main session's (D-14, rules 1 and 2).

Test first: write the tests, see them fail, then make them pass. An existing test changes only where `design.md`
D-15 names it, with its invariant named in the commit message. Leave no backup or scratch file in the tree, and end
every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `declared-step-outside-gates` | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.4 |
| AC-2 | `end-marker-id-checked` | 1.1, 1.3, 1.6, 6.4 |
| AC-3 | `skill-names-declared-end` | dropped: covered by main (merge 8f14bd1, `stage-models`; `requirements.md`) |
| AC-4 | `agent-map-from-pack-table` | 4.2, 4.4, 4.7 |
| AC-5 | `adr-0011-note` | 4.2, 4.6, 4.7 |
| AC-6 | `language-never-set` | 4.1, 4.2, 4.6, 4.7 |
| AC-7 | `review-round-after-limit` | 2.1, 2.2, 2.3, 2.5, 6.3 (R7, R7b), 6.4 (R7s) |
| AC-8 | `plan-revised-after-start` (a merge-defect fix included, D-7) | 3.1, 3.4, 3.5, 3.6, 3.6a, 3.9, 6.4 (R11, R11b, R15) |
| AC-9 | `task-for-the-conductor` | 3.1, 3.2, 3.3 (and the kit), 3.9, 6.4 |
| AC-10 | `fix-after-red-gate` | 2.1, 2.2, 2.5, 6.3 (R6), 6.4 (R5) |
| AC-11 | `host-monitor-wait` (proven half) | 4.2, 4.5, 4.7, 6.4 (R13a, R13b) |
| AC-11 | `host-monitor-wait` (deferred half, D-10) | 6.5 |
| AC-12 | `verifier-writes-proof` | 4.2, 4.3 (and the kit), 4.7 |
| AC-13 | `resolve-outside-release-files` (a change's and an archive's pull request that never left a train; the two train cases keep their steps, T117, T118) | 2.1, 2.4, 2.5, 6.4 (R8) |
| AC-14 | `nits-closed` | 5.1, 5.2, 5.3, 5.4, 5.9 |
| AC-15 | `short-script-decisions-recorded` | 4.2, 4.6, 4.7 |
| AC-16 | `no-behaviour-change-elsewhere` | 1.0, 1.6, 2.0, 2.3, 2.5, 3.0, 3.9, 4.0, 4.7, 5.0, 5.5, 5.9, 6.6 |
| AC-17 | `archive-prefixed-id-own-pr` | 3.1, 3.7, 3.9, 6.4 (R16) |
| AC-18 | `delivered-advanced-branch-no-rereview` | 3.1, 3.8, 3.9, 6.4 (R17) |
| AC-19 | `stage-models-override-validates` (a change's `budget` too, D-22) | 5.1, 5.5, 5.6, 5.9 |
| AC-20 | `no-test-pins-live-roadmap-state` | 5.1, 5.7, 5.8, 5.9 |

## 1. The declared steps and the end marker (AC-1, AC-2)

- [ ] 1.0 D-17, the merge that opens the phase: the conducting session fetched `origin/main` and said so in the hand-off. Before
  merging, list the tests the base added since the last merge (`git diff $(git merge-base HEAD origin/main) origin/main --stat -- '*.test.mjs'`);
  merge it by D-17 (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and resolve each conflict by D-17; run each added test with `node scripts/test-suite.mjs --concurrency=2 <file>...`; then
  `grep -n` each of the names this phase edits (`runReply` and its `--stdin` option, `END_OF_KEY` in both loops, `GATE_OF_WHY`, `declaredEnd`, `readDeclared`, `runMarkers`, `runOf`, `classify`, `writeViolation`, `sanitize`, `guardBash`, `replyCmd`) and read it as it is now, before the phase edits it: a function whose shape
  contradicts the plan stops the phase, reported, without a guess. A failing test the base added is reported as a row for
  D-15 and one plan revision. Check: `git merge-base --is-ancestor origin/main HEAD` exits 0 and `python3 scripts/check.py` passes.

- [ ] 1.1 Create `plugins/openspec/hooks/change-loop-declared.test.mjs` (D-16: its header comment, imports from the
  fixtures modules only) and write T1 to T9, T11 to T16, T18 to T23, T98 to T104 and T114 of D-16 in it,
  `deliver-check.test.mjs` and `guard.test.mjs`, and the D-15 updates of "roadmap-loop replies: every owner wait has
  a gate" (`roadmap-loop.test.mjs`), "change-loop skill: an end the session declares goes through reply, and the
  marker lines are never shown (F1)" (`change-loop-compozy.test.mjs`) and `SAMPLE`'s new `decision` value
  (`change-loop.test.mjs`).
  Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes AC-1 " --test-name-pattern="^coordinator-loop-fixes AC-2 " plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/guard.test.mjs`
  exits 1, its summary names no import error (every file loaded), and each of these tests fails on its own
  assertion except the negatives T5, T11, T23 and T100 to T103, which may already pass.
- [ ] 1.2 D-1 in `plugins/openspec/hooks/change-loop.mjs` (`DECLARED`, `declaredStep`, `runReply` through it with its
  `END_OF_KEY` removed, the messages of the D-1 table in both languages, `GATE_OF_WHY`; `declaredStep` keeps every option
  `runReply` has after the merge, `--stdin <name>` among them) and `readDeclared` in
  `plugins/openspec/hooks/deliver-check.mjs` (with its exported `RECORDED_KEYS`). Check: T1, T2, T6, T9, T11, T13 to T16 and T114 pass, and the
  D-15 tests of the reply's end line and of `--stdin` still pass by name: "change-loop reply: renders a key in both
  languages and an unknown key exits 3", "change-loop reply: the keys that end the run print the end line first, every
  other key the reply alone" and "change-loop replies: no internal term in either language" (`change-loop.test.mjs`),
  the five `jira-entry-followups AC-8` reply tests ("... reply --stdin refuses an empty input, a duplicate name, a bad
  name and no name" and "... reply without --stdin reads no standard input" among them) and "change-state AC-3 state:
  each end waiting for the owner keeps its why as the reason, with its gate phrase" (`change-loop-remote-state.test.mjs`),
  and "upfront AC-8 skill: after a merge-base exit 3 the change session declares the end blocked with base-conflict and
  ends the run" (`roadmap-loop-upfront.test.mjs`):
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^change-loop repl" --test-name-pattern="^jira-entry-followups AC-8" --test-name-pattern="^change-state AC-3" --test-name-pattern="^upfront AC-8 skill" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs`
  passes.
- [ ] 1.3 D-2 and the `declared.json` rule of D-1 in `plugins/openspec/hooks/guard.mjs` (`runMarkers`, `runOf`,
  `classify` for `declared.json` of any change, `writeViolation`'s message, `withoutHeredocs` split out of `sanitize`,
  `declareViolation` and its call in `guardBash`, the header comment). Check: T3 to T5, T18 to T23 and T98 to T104
  pass, and every "change-loop lock stop: T3a" test, "sanitize drops heredoc bodies and quoted text" and the three
  approval-message tests of D-15 (`guard.test.mjs`) still pass, and `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs` passes.
- [ ] 1.4 D-1 in `plugins/openspec/hooks/roadmap-loop.mjs` (`replyCmd` reads `DECLARED`; its `END_OF_KEY` removed).
  Check: T7, T8 and the updated "roadmap-loop replies: every owner wait has a gate" pass; the D-15 tests of the
  reply's end line and record still pass by name, "roadmap-loop reply: an end key records declared and prints the end
  line first; the draft-declined key prints the reply alone" (`roadmap-loop.test.mjs`) and "followups AC-4 reply: an
  end declared for an id that is not a change id exits 3 and records nothing" (`roadmap-loop-followups.test.mjs`):
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^roadmap-loop repl" --test-name-pattern="^followups AC-4 reply" plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs`
  passes; and `grep -c "END_OF_KEY" plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/change-loop.mjs`
  prints 0 for both files.
- [ ] 1.5 D-1's skill text in `plugins/openspec/skills/devkit/SKILL.md`: the Loop item for a pause or a decision
  outside the gates, the paragraph on the ends the session declares, and item 3 of `### Every change in this
  session`. The `resolve-release-conflict` and `renumber-adr` items are not edited (AC-3 is dropped). Check: T12, the
  updated F1 test and "change-loop skill: the release-conflict sentence" (`change-loop-compozy.test.mjs`) pass.
- [ ] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^roadmap-loop repl" --test-name-pattern="^followups AC-4 reply" --test-name-pattern="^jira-entry-followups AC-8" --test-name-pattern="^upfront AC-8 skill" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop lock" --test-name-pattern="^change-loop repl" --test-name-pattern="^change-state" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-1 (T1 to T9, T11 to T16, T18, T19, T98 to T104, T114, and the D-15 reply tests of `runReply` and `replyCmd`) and AC-2 (T20 to T23).

## 2. The red gate, the extra review round and the base conflict (AC-10, AC-7, AC-13)

- [ ] 2.0 D-17, the merge that opens the phase: the conducting session fetched `origin/main` and said so in the hand-off. Before
  merging, list the tests the base added since the last merge (`git diff $(git merge-base HEAD origin/main) origin/main --stat -- '*.test.mjs'`);
  merge it by D-17 (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and resolve each conflict by D-17; run each added test with `node scripts/test-suite.mjs --concurrency=2 <file>...`; then
  `grep -n` each of the names this phase edits (`nextAction`, `decide`, `buildPart` with its place step and its `CHECK_BEFORE` block, `ROWS`, `OWNER_STEP`, `nextStep`, `collectState` and its `planDirty`, `twoPrsOf`, `resolutionState`, `computeFlow`, `ceilingOf`, `failuresInARow`, `artifactState`, `collectFlow`, `releaseConflict`, `trainRejoin`, `deliveryRow`, `SUBAGENT`) and read it as it is now, before the phase edits it: a function whose shape
  contradicts the plan stops the phase, reported, without a guess. A failing test the base added is reported as a row for
  D-15 and one plan revision. Check: `git merge-base --is-ancestor origin/main HEAD` exits 0 and gate 1.6 passes as written.

- [ ] 2.1 Write T10, T17, T25 to T50, T95 to T97, T105 to T113, T117, T118, T132 and T141 of D-16 in the files D-16 names
  (`change-loop-declared.test.mjs`, `deliver-check.test.mjs`, `delivery-models.test.mjs`, `conduct-check.test.mjs`,
  `flow-check.test.mjs` and `plugins/core/skills/review-change/scripts/review-round.test.mjs`), and make the D-15
  updates for D-5: the compozy view's hand-off test (`change-loop compozy view: every hand-off step of the delivery
  rows ...` in `change-loop-compozy.test.mjs`: `expected` gains `resolve-base-conflict`), the four
  `conduct-check.test.mjs` tests that assert a blocked conflict (the README one, the archive P3b one and the two
  `conduct pin` ones named in D-15), and `change-loop next: a pull request conflicting in another file ...` in
  `change-loop.test.mjs`. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes AC-7 " --test-name-pattern="^coordinator-loop-fixes AC-10 " --test-name-pattern="^coordinator-loop-fixes AC-13 " --test-name-pattern="^coordinator-loop-fixes AC-1 T10 " --test-name-pattern="^coordinator-loop-fixes AC-1 T17 " plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs`
  exits 1 with no import error, and each test fails on its own assertion except the negatives T27, T35, T39, T40,
  T42, T47, T105, T109, T117 and T118 and the no-record half of T132, which may already pass; the five updated tests of D-5 fail on their new
  expectation, run by name (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^conduct" --test-name-pattern="^change-loop compozy view" --test-name-pattern="^change-loop next" plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop.test.mjs`).
- [ ] 2.2 The `declare` command of D-1 (`runDeclare`, `recordDeclared`, `USAGE`) and D-3 in
  `plugins/openspec/hooks/change-loop.mjs` (`declare gate-red`, `nextAction`'s `redGate`, `decide`'s `fix-gate`),
  and D-3's skill text in `plugins/openspec/skills/devkit/SKILL.md` (the `gate` item and item 3 of `### Every change
  in this session`). Check: T10, T17 and T25 to T31 pass, and the F1 test (`change-loop-compozy.test.mjs`) still
  passes (the `tests-red` key stays in the Loop as the exit-3 fallback). The roadmap tests that read `tests-red` are
  left to the delivery train's whole suite (D-17): this phase changes no roadmap code and no `tests-red` text.
- [ ] 2.3 D-4: `REVIEW_ROUNDS`, the exported `authorizedRounds(dir, scope)`, `collectState`'s `roundLimit`, the
  resolution's `limit` and `planDirty` without `openspec/changes/<id>/declared.json` (D-1), and `nextStep`'s four rows in
  `plugins/openspec/hooks/deliver-check.mjs`; the exported `ceilingOf(stage, flow, facts)` on the right of
  `computeFlow`'s `raw.failures >= ...` and in `artifactState`'s `header-failed` (the failures in a row of
  `failuresInARow` unchanged), and `collectFlow`'s `authorizedReviewRounds` in `plugins/openspec/hooks/flow-check.mjs`;
  `deadlockScope`, `declare review-round` with its `scope`, the resolution detail of `decide`'s deadlock end and the
  reworded `waiting-review-dispute` in `change-loop.mjs`; `validateArgs` (beside its `args.dirty` rule), the prompts and the consolidated text in
  `plugins/core/skills/review-change/scripts/review-round.workflow.js` and the pass-through in `review-round.mjs`;
  `plugins/core/skills/review-change/SKILL.md` (`args`, the consensus line, and the other sentences that count rounds, listed by `grep -n "round 2\|2 rounds\|third round\|round N/2"` before the edit and worded as the round limit, D-4); the `review`, `review-resolution` and
  `stop-review-deadlock` rows of `plugins/openspec/skills/ship-change/SKILL.md`; `## Owner gates` of
  `plugins/openspec/skills/devkit/SKILL.md` (the rule for both deadlocks, and the sentence for the `blocked` `ceiling`
  end of the `review` stage). Check: T32 to T44, T95 to T97, T105 to T113, T132 and T141 pass;
  `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs`
  passes (every `nextStep`, `D2:`, `resume:`, `flow-check stages`, `flow-check readout`, `stage-roles flow owner` and
  `stage-ceiling-consecutive` test of those files among them); and the other D-15 tests kept for this rule pass by name:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^delivery-models P7" --test-name-pattern="^delivery-models AC-7" --test-name-pattern="^review-openspec-fix" --test-name-pattern="^jira-entry-followups AC-" --test-name-pattern="^loop-evidence" --test-name-pattern="^change-loop decide: B10" --test-name-pattern="^change-loop decide: P9" --test-name-pattern="^stage-ceiling-consecutive" --test-name-pattern="^version-pin AC-2 readout" --test-name-pattern="^version-pin AC-3 readout" --test-name-pattern="^roadmap-loop decide: an end action" plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes.
- [ ] 2.4 D-5: `releaseConflict` and `SUBAGENT` in `plugins/openspec/hooks/conduct-check.mjs` (`trainRejoin` and `deliveryRow`'s
  order are not edited), `ROWS` in `change-loop.mjs` (`resolve-base-conflict` is not added to `SKILL_LOOP_STEPS`, so
  the compozy view takes its dispatch sentence from the `ship-change` row), the `resolve-base-conflict` row of
  `plugins/openspec/skills/ship-change/SKILL.md` (the merge sentence) and the `resolve-base-conflict` item of
  `plugins/openspec/skills/devkit/SKILL.md` (it names that row as the dispatch source, declares no end of a
  failure, and says "`Outcome: failure` goes back to `next`, as for any agent", with no `why=role-failed`, D-5).
  Check: T45 to T50, T117 and T118 and the five updated tests of 2.1 pass, and "change-loop decide: the B rows are
  exactly the steps the checkers can return", "change-loop decide: the loop's step agents match conduct-check's
  actorOf" (`change-loop.test.mjs`), the F1 test and "change-loop skill: the release-conflict sentence"
  (`change-loop-compozy.test.mjs`) still pass, `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/conduct-check.test.mjs`
  passes (`conduct: deliveryStep ...` among them), and the tests of an archive that left a train and of a change that
  left one pass by name: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^delivery-train P3" --test-name-pattern="^delivery-train loop" plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs`
  passes.
- [ ] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop compozy view" --test-name-pattern="^change-loop skill" --test-name-pattern="^review-openspec-fix" --test-name-pattern="^jira-entry-followups AC-" --test-name-pattern="^loop-evidence" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^delivery-models P7" --test-name-pattern="^delivery-models AC-7" --test-name-pattern="^version-pin AC-2 readout" --test-name-pattern="^version-pin AC-3 readout" --test-name-pattern="^delivery-train P3" --test-name-pattern="^delivery-train loop" --test-name-pattern="^stage-ceiling-consecutive" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/project-loop.test.mjs && python3 scripts/check.py` green; covers AC-10 (T25 to T31), AC-7 (T32 to T44, T95 to T97, T105 to T113, T132, T141) and AC-13 (T45 to T50, T117, T118, and the five updated tests, in `conduct-check.test.mjs` run whole and the `^change-loop` patterns), and AC-1 (T10, T17).

## 3. The conducting session's tasks, the revised plan, the `archive-` id and the advanced branch (AC-9, AC-8, AC-17, AC-18)

- [ ] 3.0 D-17, the merge that opens the phase: the conducting session fetched `origin/main` and said so in the hand-off. Before
  merging, list the tests the base added since the last merge (`git diff $(git merge-base HEAD origin/main) origin/main --stat -- '*.test.mjs'`);
  merge it by D-17 (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and resolve each conflict by D-17; run each added test with `node scripts/test-suite.mjs --concurrency=2 <file>...`; then
  `grep -n` each of the names this phase edits (`parseTasks`, `readPhases`, `nextStep`, `MAIN`, `planDigest` and `approvalState`, `collectFlow`, `artifactState`, `PLAN_REASONS`, `planPart`, `buildPart`, `approvalText`, `recordApproval`, `isArchiveHead`, `isOwnPr`, `findChangePr`, `mergedOnBranch`, `ownFiles`, `prItem`, `offOwnBranch`, `collectFlow`'s `postMerge`, `baseMergeOf`, `readMergeCheck` and the `merge-check` block of `buildPart`) and read it as it is now, before the phase edits it: a function whose shape
  contradicts the plan stops the phase, reported, without a guess. A failing test the base added is reported as a row for
  D-15 and one plan revision. Check: `git merge-base --is-ancestor origin/main HEAD` exits 0 and gate 2.5 passes as written.

- [ ] 3.1 Write T51 to T69, T93, T94, T115, T116, T119 to T131, T133 and T134 of D-16 in `plugins/openspec/hooks/deliver-check.test.mjs`,
  `deliver-check-archive.test.mjs`, `flow-check.test.mjs` and `change-loop-declared.test.mjs`, and make the D-15 update of `change-loop compozy
  record-approval: it writes approval.md in the form of the ship-change row, and approvalState reads it back as ok`
  (`change-loop-compozy.test.mjs`; the expected text gains the `- Plan:` line).
  Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes AC-8 " --test-name-pattern="^coordinator-loop-fixes AC-9 " --test-name-pattern="^coordinator-loop-fixes AC-17 " --test-name-pattern="^coordinator-loop-fixes AC-18 " plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop-declared.test.mjs`
  exits 1 with no import error, and each test fails on its own assertion except the negatives T51, T53, T58, T59,
  T66, T93, T94, T121, T126, T128 and T129 and the negative halves of T119, T120, T122 and T123, which may already pass; the updated record-approval test fails on its new expectation
  (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^change-loop compozy record-approval" plugins/openspec/hooks/change-loop-compozy.test.mjs`).
- [ ] 3.2 D-6 in `plugins/openspec/hooks/deliver-check.mjs` (`parseTasks`, `readPhases`, `nextStep`'s phase loop),
  `change-loop.mjs` (`ROWS`) and `conduct-check.mjs` (`MAIN`). Check: T62 to T68 pass, and "parseTasks: only a
  description that starts with Gate: is a gate; a mid-sentence `Gate:` is not" (`deliver-check.test.mjs`) and
  "review-writer-prompt AC-9 parseTasks counts the task and the gate after an unclosed fence"
  (`deliver-check-archive.test.mjs`) still pass.
- [ ] 3.3 D-6's texts: `plugins/core/agents/tdd-implementer.md`, the `conductor-task` and `implement` rows of
  `plugins/openspec/skills/ship-change/SKILL.md`, the `session` item of `plugins/openspec/skills/devkit/SKILL.md`, and
  the tasks instruction of `plugins/openspec/schemas/devkit/schema.yaml`, `plugins/openspec/schemas/devkit-lite/schema.yaml`,
  `openspec/schemas/devkit/schema.yaml` and `openspec/schemas/devkit-lite/schema.yaml`, each pair byte-identical.
  Then regenerate the kit (D-19), by the two commands and never by hand:
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs`, then
  `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .` in the worktree root (it prints `update` for
  `.compozy/agents/tdd-implementer/AGENT.md` and writes nothing outside `.compozy/`). Check: T69 and "format: ship-change
  names every next.step the checker can return" (`deliver-check-cli.test.mjs`) pass, `python3 scripts/check.py` passes (the
  schema copies), `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` exits 0, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs`
  passes; `git status --short` lists the template of `tdd-implementer` under `plugins/compozy/skills/compozy-setup/templates/agents/`,
  its copy under `.compozy/agents/` and `.compozy/kit-manifest.json`, and no other file of the kit.
- [ ] 3.4 D-7 in `plugins/openspec/hooks/deliver-check.mjs` (`planDigest`, `planRevision`, `collectState`'s `plan`,
  `nextStep`'s plan-approval row and detail). Check: T51 to T56 and T94 pass, and "stop-plan-approval: a change with a ticked
  task keeps running without approval.md (the started exemption)", "stop-plan-approval: APPROVED readiness with no
  approval.md waits for the owner, naming the readiness hash (AC-5)" and "approvalState: no file, a current file and
  a stale file" (`deliver-check.test.mjs`) still pass.
- [ ] 3.5 D-7 in `plugins/openspec/hooks/flow-check.mjs` (`collectFlow`'s facts, `artifactState`, `TEXT`
  `plan-revised` in both languages) and `change-loop.mjs` (`PLAN_REASONS`, the stale list, `nextAction`'s `plan`,
  the three approval waits' `detail.plan`, and, for the CompozyOS driver, `approvalText`'s `plan` field and
  `recordApproval` passing `planDigest(dir)`). Check: T57 to T60, T93, T115, T116, T133 and T134 and the updated record-approval
  test pass, the two other `change-loop compozy record-approval` tests (`change-loop-compozy.test.mjs`) still pass, "flow-check stages: ticking tasks after the
  plan review does not make the plan stale" (`flow-check.test.mjs`) still passes, and so does "post-merge-validate 2: a plan edit made as a
  merge-defect fix leaves the plan gate where an ordinary design edit does" (`change-loop.test.mjs`, its approval with no
  `- Plan:` line, D-7), with every other `post-merge-validate 2` test: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^post-merge-validate 2" plugins/openspec/hooks/change-loop.test.mjs` passes.
- [ ] 3.6 D-7's texts: the `stop-plan-approval` row and the opening section's sentence "A change whose tasks are already ticked
  is resumed without it" of `plugins/openspec/skills/ship-change/SKILL.md`,
  and `ask.action.detail.plan` in `### A session per change` of `plugins/openspec/skills/devkit/SKILL.md`. Before the edit,
  `grep -ln "stop-plan-approval\|resumed without it" plugins/*/hooks/*.test.mjs plugins/*/skills/*/scripts/*.test.mjs`
  lists the files whose tests read the row; a test found there and not named below is added to the run and reported.
  Check: T61 passes, and the tests that read the row pass by name:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^ship-change SKILL.md pins the stop-plan-approval row" --test-name-pattern="^stage-roles gates" --test-name-pattern="^format: ship-change" --test-name-pattern="^flow-check AC-2" --test-name-pattern="^flow-check AC-3" --test-name-pattern="^flow-check AC-6" --test-name-pattern="^change-loop compozy record-approval" --test-name-pattern="^change-loop decide: B12" --test-name-pattern="^conduct: deliveryStep" --test-name-pattern="^field-fixes 7" --test-name-pattern="^stop-plan-approval" plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs`
  passes.
- [ ] 3.6a D-7, `post-merge-validate`'s requirement on a merge-defect fix, only when the merge of 3.0 brought it to the
  main spec: when `grep -c "^### Requirement: A merge-defect fix follows the rule of every plan edit" openspec/specs/change-coordination/spec.md`
  prints 1, add under `## MODIFIED Requirements` of `openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md`
  a copy of that requirement, its text and every scenario verbatim, with the one change D-7 gives (the scenario's
  outcome: "the stage checker gives the same states for readiness and approval in both cases: with an approval that
  records no plan digest neither asks again, and with one both make the readiness stale and ask the owner again");
  when it prints 0, change nothing and report it, so that the conducting session tells that change's session (D-7).
  Check: `openspec validate coordinator-loop-fixes --strict` passes, and `grep -c "^### Requirement: A merge-defect fix follows the rule of every plan edit" openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md`
  prints what the first `grep -c` printed.
- [ ] 3.7 D-20 in `plugins/openspec/hooks/deliver-check.mjs`: the exported `foreignArchiveHead(id, name)`, the first line
  of `isOwnPr` and the merged-list filter of `findChangePr` through it; `isArchiveHead` and `archiveHeads` are not edited.
  Check: T119 to T124 pass, and every `field-fixes 4` test (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^field-fixes 4" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/flow-check.test.mjs`)
  and "delivery-train P3 isOwnPr: a train/<n> head is never a change's own pull request, whatever files it changes"
  and every `delivery-train P3 delivered` test ("... looked up from the default branch, the train's merged pull request
  is not the change's own" among them, D-15) (`delivery-train-after.test.mjs`) still pass:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^delivery-train P3 isOwnPr" --test-name-pattern="^delivery-train P3 delivered" plugins/openspec/hooks/delivery-train-after.test.mjs`
  passes.
- [ ] 3.8 D-21: the exported `headInBase(root, facts)` in `plugins/openspec/hooks/deliver-check.mjs`, read by `ownFiles`
  (its result unchanged) and by `prItem`'s merged arm, and `collectFlow`'s `postMerge` in `plugins/openspec/hooks/flow-check.mjs` (`offOwnBranch` or
  `headInBase`, and delivered). Check: T125 to T131 pass, and `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/deliver-check.test.mjs`
  passes (the walk after a squash merge, the `field-fixes 4` and `own-files` tests of those files among them).
- [ ] 3.9 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop compozy" --test-name-pattern="^change-loop skill" --test-name-pattern="^stage-roles" --test-name-pattern="^review-writer-prompt" --test-name-pattern="^format:" --test-name-pattern="^conduct: deliveryStep" --test-name-pattern="^field-fixes 4" --test-name-pattern="^field-fixes 7" --test-name-pattern="^delivery-train P3 isOwnPr" --test-name-pattern="^delivery-train P3 delivered" --test-name-pattern="^delivery-train own-files" --test-name-pattern="^ship-change SKILL.md pins" --test-name-pattern="^post-merge-validate 2" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && python3 scripts/check.py` green; covers AC-9 (T62 to T69, and the kit's copy of the agent), AC-8 (T51 to T61, T93, T94, T115, T116, T133, T134), AC-17 (T119 to T124, and the `delivery-train P3` tests of `findChangePr`) and AC-18 (T125 to T131).

## 4. The language run, the verifier, the agent map, the host monitor and the documents (AC-6, AC-12, AC-4, AC-11, AC-5, AC-15)

- [ ] 4.0 D-17, the merge that opens the phase: the conducting session fetched `origin/main` and said so in the hand-off. Before
  merging, list the tests the base added since the last merge (`git diff $(git merge-base HEAD origin/main) origin/main --stat -- '*.test.mjs'`);
  merge it by D-17 (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and resolve each conflict by D-17; run each added test with `node scripts/test-suite.mjs --concurrency=2 <file>...`; then
  `grep -n` each of the names this phase edits (`classify`, `writeViolation`, `inProofFolder`, `PACKS`, `AGENT`, `agentOf`) and read it as it is now, before the phase edits it: a function whose shape
  contradicts the plan stops the phase, reported, without a guess. A failing test the base added is reported as a row for
  D-15 and one plan revision. Check: `git merge-base --is-ancestor origin/main HEAD` exits 0 and gate 3.9 passes as written.

- [ ] 4.1 The conducting session's task (D-14, D-11), done and ticked before phase 4 is handed; it needs nothing this
  change builds, so it may run earlier. Run R10 (the person's language never set, the installed plugin) in a scratch
  project outside this repository; write its output as `openspec/changes/coordinator-loop-fixes/proof/r10-*.jsonl`
  and append its line to `openspec/changes/coordinator-loop-fixes/proof/checks.txt` in the D-14 form; the run's
  output goes only to those files and is checked with `grep -c`, never printed (D-14 rule 4). The run's fixture
  script then scrubs the files (D-14 rule 5): the worktree's path becomes `<worktree>`, the scratch run's folder
  `<scratch>` and the home folder `<home>`, and the `r10` line is appended only after `grep -c` of each of those three
  paths over `proof/r10-*` prints 0. An implementer handed phase 4 with this task open stops and reports it, without
  doing it. Check: `grep -c "^r10 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1.
- [ ] 4.2 Write T70 to T84 of D-16 in `plugins/openspec/hooks/guard.test.mjs`, `deliver-check.test.mjs` and
  `change-loop-declared.test.mjs`. T78 holds ADR 0011's `## Decision` section as a constant
  copied from the file at this commit. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes AC-12 " --test-name-pattern="^coordinator-loop-fixes AC-4 " --test-name-pattern="^coordinator-loop-fixes AC-11 " --test-name-pattern="^coordinator-loop-fixes AC-5 " --test-name-pattern="^coordinator-loop-fixes AC-15 " --test-name-pattern="^coordinator-loop-fixes AC-6 " --test-name-pattern="^coordinator-loop-fixes AC-16 " plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop-declared.test.mjs`
  exits 1 with no import error; T73, T76's negative, T79 to T81 and T84 pin what holds today and may pass
  already (D-11).
- [ ] 4.3 D-8 in `plugins/openspec/hooks/guard.mjs` (`inProofFolder`, `writeViolation`, the header comment) and
  `plugins/core/agents/pr-verifier.md` (the new sentence holds neither "screenshot" nor `gh pr comment`, and the `Never`
  line is kept). Then regenerate the kit (D-19) by the two commands of 3.3: `gen-agents.mjs`, then `install-kit.mjs .` in the
  worktree root. Check: T70 to T74 pass, and "evidence.md is written only by pr-verifier" (`guard.test.mjs`), "stage-roles
  roles verifier: pr-verifier records text, takes no screenshot and posts no pull-request comment"
  (`change-loop-compozy.test.mjs`) and "delivery-train docs: pr-verifier leaves the parts the train proves to the train, ..."
  (`delivery-train-after.test.mjs`) still pass; `grep -c "it is the only file you write" plugins/core/agents/pr-verifier.md`
  prints 0; `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` exits 0; and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs`
  passes.
- [ ] 4.4 D-9 in `plugins/openspec/hooks/change-loop.mjs` (`PACKS` moved, `agentOf`, the exported `AGENT` and
  `AGENT_ROLES`) and `project-loop.mjs` (`AGENT`). Check: T75 to T77 pass, and "stage-roles loop: the loop's own
  hand-offs of the test stages carry a role the packs know" (`change-loop-compozy.test.mjs`), "change-loop lock
  agent: the accepted packs are the ones docs/roles.md names" (`change-loop.test.mjs`) and every `project-loop`
  test (`node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/project-loop.test.mjs`) still pass, and so
  does "project-settings: PACKS equals the plugin names in marketplace.json" (D-15):
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^project-settings: PACKS equals" plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs`
  passes.
- [ ] 4.5 D-10 in `plugins/openspec/skills/devkit/SKILL.md` (`## Waiting on GitHub`, the paragraph that starts no wait
  and says so) and `plugins/openspec/skills/devkit-session/SKILL.md` (item 3). Check: T82 and "change-loop skill: the
  wait is started in the background on a GitHub wait" (`change-loop-compozy.test.mjs`) pass, and "upfront AC-8 skill:
  after a merge-base exit 3 the change session declares the end blocked with base-conflict and ends the run"
  (`roadmap-loop-upfront.test.mjs`, which reads that item 3, D-15) still passes:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^upfront AC-8 skill" plugins/openspec/hooks/roadmap-loop-upfront.test.mjs` passes.
- [ ] 4.6 D-11 and D-12: the Note of `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, the sentences
  of `docs/openspec-flow.md` that D-12 lists (the `devkit-lite` section's two decisions among them, and the language
  sentence written from the `r10` line of `proof/checks.txt` and the `proof/r10-*` files that 4.1 recorded: when that
  line is missing or does not end in `: pass`, write no language sentence, stop and report),
  `docs/coordination-design.md` (the review row of its stage table), the sentence of `docs/compozy-kit.md` that D-12
  names, the review gate sentence of the four `schema.yaml` files, and the ADR list of `openspec/config.yaml` (one
  entry for each of the change's ADRs as listed in `decisions.md`, each by the number its file has at this commit, as
  D-12 words them). Before editing, `grep -rn "two rounds at most" plugins scripts docs openspec/specs openspec/schemas`
  and `grep -rn "stays red" docs` list every sentence to change, and, by the rule of `openspec/config.yaml`, each sentence
  this task changes is grepped in `plugins/*/hooks/*.test.mjs` and `plugins/*/skills/*/scripts/*.test.mjs`; a test
  found that the run below does not name is added to it and reported. Check: T78, T83 and T84 pass; the tests that read
  the paragraphs and files this task edits pass by name (found at this revision by those paragraphs' anchors and old
  sentences): `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^release-tags 4" --test-name-pattern="^release-merge-conflict 16" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop docs" --test-name-pattern="^stage-roles" --test-name-pattern="^conduct pin" --test-name-pattern="^conduct: a conflict that also has README" --test-name-pattern="^conduct: under two-prs" --test-name-pattern="^P1b" --test-name-pattern="^jira-entry-followups docs" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^loop-evidence 17" --test-name-pattern="^change-state ADR 0017" --test-name-pattern="^delivery-train docs" --test-name-pattern="^review round: text" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs`
  passes; `grep -c "^r10 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1; and
  `python3 scripts/check.py` passes.
- [ ] 4.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^change-loop lock agent" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop docs" --test-name-pattern="^stage-roles" --test-name-pattern="^delivery-train docs" --test-name-pattern="^release-tags 4" --test-name-pattern="^release-merge-conflict 16" --test-name-pattern="^conduct pin" --test-name-pattern="^conduct: a conflict that also has README" --test-name-pattern="^conduct: under two-prs" --test-name-pattern="^P1b" --test-name-pattern="^jira-entry-followups docs" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^loop-evidence 17" --test-name-pattern="^change-state ADR 0017" --test-name-pattern="^review round: text" --test-name-pattern="^project-settings: PACKS equals" --test-name-pattern="^upfront AC-8 skill" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && python3 scripts/check.py && test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` green; covers AC-12 (T70 to T74, and the kit's copy of `pr-verifier`), AC-4 (T75 to T77, and the `PACKS` test of `project-settings.test.mjs`), AC-11's proven half in text (T82), AC-6 (T79 to T81, and R10 through 4.1), AC-5 (T78) and AC-15 (T83, T84).

## 5. The nits, a change's own settings block and the tests of the live roadmap (AC-14, AC-19, AC-20)

- [ ] 5.0 D-17, the merge that opens the phase: the conducting session fetched `origin/main` and said so in the hand-off. Before
  merging, list the tests the base added since the last merge (`git diff $(git merge-base HEAD origin/main) origin/main --stat -- '*.test.mjs'`);
  merge it by D-17 (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and resolve each conflict by D-17; run each added test with `node scripts/test-suite.mjs --concurrency=2 <file>...`; then
  `grep -n` each of `createdAfter`, `ATTRIBUTION_ASK`, `parseDevkitBlock`, `budgetOf`, `modelsOf`, `capOf`, `writePin` and the `waiting-budget` messages, and each of the three test titles of D-23 (`grep -rn "post-merge-validate 3: the roadmap line\|jira-entry AC-10 the roadmap\|stage-roles docs: the roadmap line" plugins/openspec/hooks/*.test.mjs`), and read it as it is now, before the phase edits it: a function whose shape
  contradicts the plan stops the phase, reported, without a guess. A failing test the base added is reported as a row for
  D-15 and one plan revision. Check: `git merge-base --is-ancestor origin/main HEAD` exits 0 and gate 4.7 passes as written.

- [ ] 5.1 Write T85 to T92 and T135 to T140 of D-16 in `plugins/openspec/hooks/change-loop-declared.test.mjs`,
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs`, `plugins/openspec/hooks/guard.test.mjs` (T135) and
  `plugins/openspec/hooks/stage-models.test.mjs` (T138, beside the AC-12 spend test, with its fixture). Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes AC-14 " --test-name-pattern="^coordinator-loop-fixes AC-19 " --test-name-pattern="^coordinator-loop-fixes AC-20 " plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/stage-models.test.mjs`
  exits 1 with no import error: T85 and T86 fail (`createdAfter` is not exported yet), T135 to T140 fail on their own
  assertions (T136's `devkit:` half and T138's `devkit:` half pin what holds today and may pass); T87 to T92 pin what
  holds today and may pass.
- [ ] 5.2 D-13: "commit-attribution AC-1 T25 the S10 ADR reviewer hand-off does not carry the attribution request"
  in `plugins/openspec/hooks/project-loop.test.mjs`: its first assertion is that `CL.ATTRIBUTION_ASK` is exported and
  not empty, so the test fails without the export. Check: it passes, and
  `grep -c "ATTRIBUTION_ASK ?? " plugins/openspec/hooks/project-loop.test.mjs` prints 0.
- [ ] 5.3 D-13: "commit-attribution AC-2 T31 Method steps 3 and 5 point to Attribution and drop the environment
  rule" in `plugins/openspec/hooks/deliver-check-archive.test.mjs`. Check: it passes, and
  `grep -c "split('Attribution below')" plugins/openspec/hooks/deliver-check-archive.test.mjs` prints 0.
- [ ] 5.4 D-13: export `createdAfter` in `plugins/openspec/hooks/change-loop.mjs`, unchanged otherwise. Check: T85
  to T92 pass.
- [ ] 5.5 D-22 in code: `parseDevkitBlock(text, key = 'devkit')` and the exported `changeDevkitBlock(text)` in
  `plugins/openspec/hooks/guard.mjs`; `budgetOf` and `modelsOf` reading the change's `.openspec.yaml` through
  `changeDevkitBlock`, and the `waiting-budget` message in both languages, in `plugins/openspec/hooks/change-loop.mjs`;
  `capOf` in `plugins/openspec/hooks/flow-check.mjs`. Check: T135, T137, T138 and the loop half of T136 pass;
  `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/stage-models.test.mjs`
  passes; and the D-15 tests of a change's `devkit:` block and of `parseDevkitBlock` pass by name:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^change-budget" --test-name-pattern="^jira-entry AC-6 next carries the task but no writeBack on a budget end" --test-name-pattern="^upfront budget" --test-name-pattern="^version-pin AC-1 writePin" --test-name-pattern="^delivery-train config" --test-name-pattern="^release-tags 1" --test-name-pattern="^delivery-models config" --test-name-pattern="^change-loop settings: shipConfig" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/change-loop-remote.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs`
  passes (with "change-loop settings: shipConfig of deliver-check gives the same with and without the block",
  `change-loop.test.mjs`, D-15).
- [ ] 5.6 D-22's texts: in `docs/openspec-flow.md` the two sentences of "The token budget." and "The model of each stage."
  and the new paragraph `**A change's own settings.**` with its example, byte for byte as D-22 gives it; the two
  settings comment lines of `openspec/config.yaml`; the two settings sentences of `docs/coordination-design.md`; the
  Note appended to the `## Decision` section of `docs/adr/0023-the-model-is-chosen-by-stage.md`, right after its
  stage-models Note and before `## Consequences` (the section's text on the base, decisions 1 to 7 and the
  stage-models Note, unchanged),
  worded as D-22 gives it, pointing to the change's settings ADR as `decisions.md` lists it, by a relative link to
  its file and the number that file has at this commit, as ADR 0011's Note points to the change's ADR (D-12).
  Before the edit, each sentence it changes is grepped in the test files (the rule of `openspec/config.yaml`); a test
  found that the run below does not name is added to it and reported. Check: T136 and T139 pass, and the tests that
  read these paragraphs pass by name:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^change-budget AC-10" --test-name-pattern="^stage-models AC-1 " --test-name-pattern="^stage-models AC-2" --test-name-pattern="^stage-models AC-4" --test-name-pattern="^stage-models AC-7" --test-name-pattern="^stage-models AC-10" plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/stage-models.test.mjs`
  passes, and `python3 scripts/check.py` passes.
- [ ] 5.7 D-23's rule: the `Live roadmap:` line of `openspec/config.yaml`'s `context:`, right after `Test history:`, as
  D-23 words it. Check: T140 passes, "stage-models AC-2 the settings comment names the optional models table and the ADRs
  line names 0023" (`stage-models.test.mjs`) still passes, and `python3 scripts/check.py` passes.
- [ ] 5.8 D-23's tests. First search the suite for a test that reads the live roadmap and asserts a tick or a done
  state (`grep -n "readRepo('openspec', 'roadmap.md')\|readRoadmap(REPO_ROOT)" plugins/*/hooks/*.test.mjs plugins/*/skills/*/scripts/*.test.mjs`,
  each hit read for `- [ ]`, `- \[ \]` or `done`); a test found besides the three below is fixed the same way and named
  in the commit. Then, by D-23 and the three D-15 rows: `post-merge-validate 3: ... and stays unticked`
  (`change-loop.test.mjs`) only if the search finds it still present on the base (else it is reported as already fixed
  by that change's archive, and left as it is); `jira-entry AC-10 the roadmap has the live-proof follow-up after
  jira-entry` (`change-loop-remote-state.test.mjs`); `stage-roles docs: the roadmap line of stage-roles keeps its text,
  ...` (`change-loop-compozy.test.mjs`). Each runs its assertions on the live roadmap and on a copy with the line it
  reads ticked, made in the test from the live text; the invariant of each, named in the commit message, is its D-15
  row's. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^post-merge-validate 3" --test-name-pattern="^jira-entry AC-10" --test-name-pattern="^stage-roles docs" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`
  passes, and `grep -c "stays unticked" plugins/openspec/hooks/change-loop.test.mjs` prints 0.
- [ ] 5.9 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/stage-models.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^commit-attribution" --test-name-pattern="^change-budget" --test-name-pattern="^jira-entry AC-6 next carries the task but no writeBack on a budget end" --test-name-pattern="^jira-entry AC-10" --test-name-pattern="^upfront budget" --test-name-pattern="^version-pin AC-1 writePin" --test-name-pattern="^delivery-train config" --test-name-pattern="^release-tags 1" --test-name-pattern="^delivery-models config" --test-name-pattern="^post-merge-validate 3" --test-name-pattern="^stage-roles docs" --test-name-pattern="^change-loop settings: shipConfig" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/change-loop-remote.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs && python3 scripts/check.py` green; covers AC-14 (T85 to T92 and the two updated tests), AC-19 (T135 to T139) and AC-20 (T140 and the three updated tests).

## 6. The merge, the release and the real runs (AC-16, the real-run proof of AC-1 to AC-13, and AC-11's deferred half)

- [ ] 6.1 D-17: merge `origin/main` (as the conducting session fetched it) into the branch by D-17
  (`release-merge.mjs --base main --roadmap-ticks`, then `git merge origin/main` on its exit 2, never a rebase) and
  resolve each conflict by D-17; when another change took the number of any of the change's ADRs as listed in
  `decisions.md`, run the loop's `renumber-adr` step (it renames each such file to the next free number at merge, of
  `docs/adr/` on `origin/main`, with `git mv` and changes every reference this change made to it; `decisions.md`, the
  Notes of ADR 0011 and ADR 0023, the ADR list of `openspec/config.yaml` and the docs among them). Edit no plan file:
  the plan's validation after this merge is the loop's own `merge-check` step before `verify`, and a red check goes
  to the planner's `merge-defect` step (D-17, D-7). Then run 3.6a's
  `grep -c "^### Requirement: A merge-defect fix follows the rule of every plan edit" openspec/specs/change-coordination/spec.md`
  again: when it prints 1 while the same `grep -c` on `openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md`
  prints 0, stop and report it, so that the copy of 3.6a is added by a plan revision before the evidence (D-7). Check:
  `git merge-base --is-ancestor origin/main HEAD` exits 0, `git status --short` prints nothing, and every path
  `decisions.md` names exists.
- [ ] 6.2 D-18 and D-19: the next free minor version after `origin/main`'s at the last merge, 6.1 (the conducting
  session fetched it; no version is written in any plan file; on the train the join renumbers it later, and no test is edited for it, D-18) for devkit-openspec, devkit-core and devkit-compozy, in each
  `plugin.json` and in `.claude-plugin/marketplace.json`, the marketplace's own next minor, the `CHANGELOG.md` section
  (one bullet per pack and a docs bullet), and every devkit-openspec version tag of the CI snippet in
  `docs/openspec-flow.md` (found with `grep -n "v[0-9]*\.[0-9]*\.[0-9]*" docs/openspec-flow.md`). Then install the kit once
  more, `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .` in the worktree root, so that
  `.compozy/kit-manifest.json` records the new devkit-compozy version in `pack`. Check: `python3 scripts/gen-catalog.py
  --check` and `command claude plugin validate .` pass, every devkit-openspec version the CI snippet of
  `docs/openspec-flow.md` names is `v` followed by the version `plugins/openspec/.claude-plugin/plugin.json` holds,
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` exits 0, `grep -c '"pack": "<the version
  of plugins/compozy/.claude-plugin/plugin.json>"' .compozy/kit-manifest.json` prints 1, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs`
  passes.
- [ ] 6.3 The conducting session's task (D-14 rules 1, 3 and 4), done on the merged head after 6.2 and ticked before
  phase 6 is handed again; an implementer that reaches it open stops before it and reports it, without doing it. Run
  R6, R7 and R7b of D-14 in scratch projects outside this repository with this worktree's
  `plugins/openspec/hooks/change-loop.mjs`, each scratch project built by a fixture script kept in the scratch run's
  folder outside the project (it never writes `declared.json`); send every loop command's stdout and stderr to its
  file under `openspec/changes/coordinator-loop-fixes/proof/` as D-14 names it, check each file with `grep -c` or
  `test` without printing it, copy each scratch `declared.json` to its `r*-declared.json`, scrub each run's files (D-14 rule 5: `<worktree>`,
  `<scratch>`, `<home>`; `grep -c` of each of the three paths over the run's files prints 0), and append one line per
  run to `proof/checks.txt` in the D-14 form. When a run's check fails, stop and report: the plan is revised before
  anything else. Check: `grep -c "^r6 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt`,
  the same for `r7` and for `r7b`, each prints 1.
- [ ] 6.4 D-14 runs R1 to R5, R7s, R8, R9, R11, R11b, R13a, R13b, R14, R15 and R17 in scratch projects, and R16 on `archive-release-pin` from this worktree's root (when that change was archived anyway, stop and report: the plan is revised), outside this repository, with
  this worktree's packs (D-14 rules 2 and 3: every nested prompt in a file of the scratch run's folder, written with a
  quoted heredoc and passed as `claude -p "$(cat <file>)"`; every scratch file built by the fixture script), each
  output under `openspec/changes/coordinator-loop-fixes/proof/` as D-14 names it and its one-line check appended to
  `proof/checks.txt` in the D-14 form, after the scrub of D-14 rule 5 (the same `grep -c` of the three paths prints 0). R13a's host
  text is saved as `proof/r13a-host.txt`. No command of this task
  holds a `node … change-loop.mjs declare` line. When a run's check fails, stop and report: the plan is revised
  before anything else. R16's and R17's "before" runs use `origin/main`'s hooks, extracted with `git archive origin/main plugins/openspec`
  into the scratch run's folder, never a checkout of this repository. Check: `proof/checks.txt` has one line for each of `r1` to `r5`, `r7s`, `r8`, `r9`, `r11`,
  `r11b`, `r13a`, `r13b`, `r14`, `r15`, `r16` and `r17` (and the `r10` line of 4.1 and the `r6`, `r7` and `r7b` lines of 6.3), each ending in
  `: pass`.
- [ ] 6.5 D-10, AC-11's deferred half: add the line `- [ ] host-monitor-wake (after: coordinator-loop-fixes) — ...` to
  `## Round 16b: the coordinator loop fixes` of `openspec/roadmap.md`, right after the `coordinator-loop-fixes` line,
  saying in one sentence what R13a and R13b proved (no wait and the session says so with the host's monitor; the
  background wait without it) and what is open (whether the desktop app's monitor wakes the session when the checks
  pass, to be observed on the next change run in the app, with this change's retro recording what its own wait on
  GitHub showed). Check: `grep -c "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md`
  prints 1, and `grep -c "^r13a .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1.
- [ ] 6.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^stage-roles docs" --test-name-pattern="^post-merge-validate 3" --test-name-pattern="^jira-entry AC-10" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && command claude plugin validate . && test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt && grep -q "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md` green: this change's tests on the merged head (each file filtered to them), the release's tests, the kit and the roadmap tests after the 6.5 line; the whole suite is the delivery train's, run at its head (D-17, D-18), and the plan's strict validation after 6.1 is the loop's `merge-check` before `verify` (D-17); covers AC-16 through the gates of every phase and every AC through its tests, and AC-11's deferred half carried.

## Workflow follow-up

- `pr-verifier` records the gates, the real runs of `proof/` and its own run R12 (D-14) in `evidence.md`; it records
  R6, R7 and R7b from their files and runs no `declare` itself (a declaring case it wants to see again goes through
  a nested `claude -p`, D-14 rule 2).
- The review bench runs; the change then boards the delivery train (ADR 0022), whose departure renumbers its release
  above the train's (D-18) and runs the whole suite once at its head (`devkit.delivery.train`); the release tag is
  pushed by the loop's `tag-release` step after the train's merge.
- Archive the change after the review requirements are met.
