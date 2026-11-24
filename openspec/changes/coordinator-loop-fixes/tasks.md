<!-- devkit-stage tasks result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Tasks

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every text, name, test and command is in `design.md`: D-1 the
declared steps, D-2 the end marker, D-3 the red gate, D-4 the extra review round, D-5 the conflict outside the
release files, D-6 the conducting session's tasks, D-7 the revised plan, D-8 the verifier's `proof/`, D-9 the agent
map, D-10 the host monitor, D-11 the language, D-12 the documents, D-13 the nits, D-14 the real runs, D-15 the
existing tests, D-16 the new tests (T1 to T114), D-17 the siblings, D-18 the release. The implementer copies them
and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after `Gate:` and
runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts `coordinator-loop-fixes AC-<n>
T<k> `. A test of an export this change adds reads it through its file's existing namespace import (`FC`,
`DC`, `GUARD`, `changeLoopModule`), so the suite loads before the export exists. Every new hook test takes its env from the file's existing fixtures, which blank `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`, and makes every
temporary folder through `test-tmp.mjs`; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does. The tests need the `openspec` CLI 2.x on `PATH`. The whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once, in 6.5, as a background command
of the tool. The marketplace check is written `command claude plugin validate .`, so that a shell function named
`claude` is skipped.

Three tasks are not the implementer's (D-14): 4.1 (the real run R10), done and ticked before the conducting session
hands phase 4; 6.3 (the real runs R6, R7 and R7b, which call `change-loop.mjs declare` directly, a command the guard
this change adds refuses to any subagent); and the fetch of `origin/main` before 6.1. An implementer that meets 4.1
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
| AC-3 | `skill-names-declared-end` | 1.1, 1.5, 1.6 |
| AC-4 | `agent-map-from-pack-table` | 4.2, 4.4, 4.7 |
| AC-5 | `adr-0011-note` | 4.2, 4.6, 4.7 |
| AC-6 | `language-never-set` | 4.1, 4.2, 4.6, 4.7 |
| AC-7 | `review-round-after-limit` | 2.1, 2.2, 2.3, 2.5, 6.3 (R7, R7b), 6.4 (R7s) |
| AC-8 | `plan-revised-after-start` | 3.1, 3.4, 3.5, 3.6, 3.7, 6.4 |
| AC-9 | `task-for-the-conductor` | 3.1, 3.2, 3.3, 3.7, 6.4 |
| AC-10 | `fix-after-red-gate` | 2.1, 2.2, 2.5, 6.3 (R6), 6.4 (R5) |
| AC-11 | `host-monitor-wait` (proven half) | 4.2, 4.5, 4.7, 6.4 (R13a, R13b) |
| AC-11 | `host-monitor-wait` (deferred half, D-10) | 6.5 |
| AC-12 | `verifier-writes-proof` | 4.2, 4.3, 4.7 |
| AC-13 | `resolve-outside-release-files` | 2.1, 2.4, 2.5, 6.4 |
| AC-14 | `nits-closed` | 5.1, 5.2, 5.3, 5.4 |
| AC-15 | `short-script-decisions-recorded` | 4.2, 4.6, 4.7 |
| AC-16 | `no-behaviour-change-elsewhere` | 1.6, 2.3, 2.5, 3.7, 4.7, 5.5, 6.6 |

## 1. The declared steps and the end marker (AC-1, AC-2, AC-3)

- [ ] 1.1 Write T1 to T9, T11 to T16, T18 to T24, T98 to T104 and T114 of D-16 in `plugins/openspec/hooks/change-loop.test.mjs`,
  `roadmap-loop.test.mjs`, `deliver-check.test.mjs` and `guard.test.mjs`, and the D-15 updates of
  "roadmap-loop replies: every owner wait has a gate" (`roadmap-loop.test.mjs`), "change-loop skill: an end the
  session declares goes through reply, and the marker lines are never shown (F1)" and `SAMPLE`'s new `decision`
  value (`change-loop.test.mjs`).
  Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes AC-1 " --test-name-pattern="^coordinator-loop-fixes AC-2 " --test-name-pattern="^coordinator-loop-fixes AC-3 " plugins/openspec/hooks/guard.test.mjs`
  exits non-zero, the suite loads (no import error), and each of these tests fails on its own assertion except the
  negatives T5, T11, T23 and T100 to T103, which may already pass.
- [ ] 1.2 D-1 in `plugins/openspec/hooks/change-loop.mjs` (`DECLARED`, `declaredStep`, `runReply` through it, the
  messages of the D-1 table in both languages, `GATE_OF_WHY`) and `readDeclared` in
  `plugins/openspec/hooks/deliver-check.mjs` (with its exported `RECORDED_KEYS`). Check: T1, T2, T6, T9, T11, T13 to T16 and T114 pass, and "change-loop
  reply: renders a key in both languages and an unknown key exits 3" and "change-state AC-3 state: each end waiting
  for the owner keeps its why as the reason, with its gate phrase" still pass.
- [ ] 1.3 D-2 and the `declared.json` rule of D-1 in `plugins/openspec/hooks/guard.mjs` (`runMarkers`, `runOf`,
  `classify` for `declared.json` of any change, `writeViolation`'s message, `withoutHeredocs` split out of `sanitize`,
  `declareViolation` and its call in `guardBash`, the header comment). Check: T3 to T5, T18 to T23 and T98 to T104
  pass, and every "change-loop lock stop: T3a" test, "sanitize drops heredoc bodies and quoted text" and the three
  approval-message tests of D-15 (`guard.test.mjs`) still pass.
- [ ] 1.4 D-1 in `plugins/openspec/hooks/roadmap-loop.mjs` (`replyCmd` reads `DECLARED`; its `END_OF_KEY` removed).
  Check: T7, T8 and the updated "roadmap-loop replies: every owner wait has a gate" pass, and
  `grep -c "END_OF_KEY" plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/change-loop.mjs` prints 0 for
  both files.
- [ ] 1.5 D-1's skill text and AC-3 in `plugins/openspec/skills/devkit/SKILL.md`: the Loop item for a pause or a
  decision outside the gates, the paragraph on the ends the session declares, item 3 of `### Every change in this
  session`, and the `resolve-release-conflict` and `renumber-adr` items, each keeping "`Outcome: failure` ends the
  run blocked" and adding the `reply blocked ... why=role-failed` call. Check: T12, T24, the updated F1 test and
  "change-loop skill: the release-conflict sentence" (`change-loop.test.mjs`) pass.
- [ ] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^roadmap-loop replies" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop lock" --test-name-pattern="^change-loop reply" --test-name-pattern="^change-state" --test-name-pattern="^sanitize" --test-name-pattern="^approval\.md:" --test-name-pattern="^upfront AC-6 guard" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 (T1 to T9, T11 to T16, T18, T19, T98 to T104, T114), AC-2 (T20 to T23) and AC-3 (T24).

## 2. The red gate, the extra review round and the base conflict (AC-10, AC-7, AC-13)

- [ ] 2.1 Write T10, T17, T25 to T50, T95 to T97 and T105 to T113 of D-16 in `plugins/openspec/hooks/change-loop.test.mjs`,
  `deliver-check.test.mjs`, `delivery-models.test.mjs`, `conduct-check.test.mjs`, `flow-check.test.mjs` and
  `plugins/core/skills/review-change/scripts/review-round.test.mjs`. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes AC-7 " --test-name-pattern="^coordinator-loop-fixes AC-10 " --test-name-pattern="^coordinator-loop-fixes AC-13 " --test-name-pattern="^coordinator-loop-fixes AC-1 T10 " --test-name-pattern="^coordinator-loop-fixes AC-1 T17 " plugins/openspec/hooks/guard.test.mjs`
  exits non-zero, the suite loads, and each test fails on its own assertion except the negatives T27, T35, T39, T40,
  T42, T47, T105 and T109, which may already pass.
- [ ] 2.2 The `declare` command of D-1 (`runDeclare`, `recordDeclared`, `USAGE`) and D-3 in
  `plugins/openspec/hooks/change-loop.mjs` (`declare gate-red`, `nextAction`'s `redGate`, `decide`'s `fix-gate`),
  and D-3's skill text in `plugins/openspec/skills/devkit/SKILL.md` (the `gate` item and item 3 of `### Every change
  in this session`). Check: T10, T17 and T25 to T31 pass, and the roadmap tests with `tests-red`
  (`roadmap-loop.test.mjs`, lines 657, 3280, 4637, 4661, 4667, 4687 at c1ac8c4) still pass.
- [ ] 2.3 D-4: `REVIEW_ROUNDS`, the exported `authorizedRounds(dir, scope)`, `collectState`'s `roundLimit` and the
  resolution's `limit`, and `nextStep`'s four rows in `plugins/openspec/hooks/deliver-check.mjs`; the exported
  `ceilingOf(stage, flow, facts)` used at `artifactState` and `computeFlow`, and `collectFlow`'s
  `authorizedReviewRounds` in `plugins/openspec/hooks/flow-check.mjs`; `deadlockScope`, `declare review-round` with
  its `scope`, the resolution detail of `decide`'s deadlock end and the reworded `waiting-review-dispute` in
  `change-loop.mjs`; `validateArgs`, the prompts and the consolidated text in
  `plugins/core/skills/review-change/scripts/review-round.workflow.js` and the pass-through in `review-round.mjs`;
  `plugins/core/skills/review-change/SKILL.md` (`args`, the consensus line); the `review`, `review-resolution` and
  `stop-review-deadlock` rows of `plugins/openspec/skills/ship-change/SKILL.md`; `## Owner gates` of
  `plugins/openspec/skills/devkit/SKILL.md` (the rule for both deadlocks, and the sentence for the `blocked` `ceiling`
  end of the `review` stage). Check: T32 to T44, T95 to T97 and T105 to T113 pass, `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` passes, and
  the D-15 tests kept for this rule still pass: "nextStep row 7: FAIL (round 2/2) ...", "nextStep row 9 ...",
  "review-openspec-fix 16 ..." (`deliver-check.test.mjs`), every "delivery-models P7 T8 ..." and "delivery-models
  AC-7 ..." test (`delivery-models.test.mjs`), the dispute test at line 483 and "change-loop decide: P9 a ceiling
  and the other blocked ends of the plan" (`change-loop.test.mjs`), "flow-check stages: a failed stage past its
  ceiling ends blocked", "flow-check stages: a failed header does not pass its stage", "flow-check stages: a failed
  stage offers its fix, then itself after the fix", "flow-check readout: both languages cover every reason code" and
  "stage-roles flow owner: a mock-up sent back at attempt 3 and at attempt 40 is never blocked by a ceiling"
  (`flow-check.test.mjs`), "version-pin AC-2 readout: the version-1 ceiling holds after the upgrade" and
  "version-pin AC-3 readout: the version-2 ceiling blocks" (`version-pin.test.mjs`), and "roadmap-loop decide: an end
  action carries the parameters of its reply" (`roadmap-loop.test.mjs`).
- [ ] 2.4 D-5: `releaseConflict` and `SUBAGENT` in `plugins/openspec/hooks/conduct-check.mjs`, `ROWS` in
  `change-loop.mjs`, the `resolve-base-conflict` item of `plugins/openspec/skills/devkit/SKILL.md` and its row in
  `plugins/openspec/skills/ship-change/SKILL.md`. Check: T45 to T50 pass, and the rows-match test and "change-loop
  decide: the loop's step agents match conduct-check's actorOf" (`change-loop.test.mjs`) and "conduct: deliveryStep
  maps every deliver-check step to its actor, agent and final state (design D9 table)" (`conduct-check.test.mjs`)
  still pass.
- [ ] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^nextStep" --test-name-pattern="^review-openspec-fix" --test-name-pattern="^delivery-models" --test-name-pattern="^conduct:" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop" --test-name-pattern="^flow-check" --test-name-pattern="^stage-roles flow owner" --test-name-pattern="^version-pin AC-[23] readout" plugins/openspec/hooks/guard.test.mjs && node --test plugins/core/skills/review-change/scripts/review-round.test.mjs && python3 scripts/check.py` green; covers AC-10 (T25 to T31), AC-7 (T32 to T44, T95 to T97, T105 to T113) and AC-13 (T45 to T50), and AC-1 (T10, T17).

## 3. The conducting session's tasks and the revised plan (AC-9, AC-8)

- [ ] 3.1 Write T51 to T69, T93 and T94 of D-16 in `plugins/openspec/hooks/deliver-check.test.mjs`, `flow-check.test.mjs` and
  `change-loop.test.mjs`. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes AC-8 " --test-name-pattern="^coordinator-loop-fixes AC-9 " plugins/openspec/hooks/guard.test.mjs`
  exits non-zero, the suite loads, and each test fails on its own assertion except the negatives T51, T53, T58, T59,
  T66, T93 and T94, which may already pass.
- [ ] 3.2 D-6 in `plugins/openspec/hooks/deliver-check.mjs` (`parseTasks`, `readPhases`, `nextStep`'s phase loop),
  `change-loop.mjs` (`ROWS`) and `conduct-check.mjs` (`MAIN`). Check: T62 to T68 pass, and "parseTasks: only a
  description that starts with Gate: is a gate; a mid-sentence `Gate:` is not" and "review-writer-prompt AC-9
  parseTasks counts the task and the gate after an unclosed fence" (`deliver-check.test.mjs`) still pass.
- [ ] 3.3 D-6's texts: `plugins/core/agents/tdd-implementer.md`, the `conductor-task` and `implement` rows of
  `plugins/openspec/skills/ship-change/SKILL.md`, the `session` item of `plugins/openspec/skills/devkit/SKILL.md`, and
  the tasks instruction of `plugins/openspec/schemas/devkit/schema.yaml`, `plugins/openspec/schemas/devkit-lite/schema.yaml`,
  `openspec/schemas/devkit/schema.yaml` and `openspec/schemas/devkit-lite/schema.yaml`, each pair byte-identical.
  Check: T69 and "format: ship-change names every next.step the checker can return" (`deliver-check.test.mjs`) pass,
  and `python3 scripts/check.py` passes (the schema copies).
- [ ] 3.4 D-7 in `plugins/openspec/hooks/deliver-check.mjs` (`planDigest`, `planRevision`, `collectState`'s `plan`,
  `nextStep`'s plan-approval row and detail). Check: T51 to T56 and T94 pass, and "stop-plan-approval: a change with a ticked
  task keeps running without approval.md (the started exemption)", "stop-plan-approval: APPROVED readiness with no
  approval.md waits for the owner, naming the readiness hash (AC-5)" and "approvalState: no file, a current file and
  a stale file" (`deliver-check.test.mjs`) still pass.
- [ ] 3.5 D-7 in `plugins/openspec/hooks/flow-check.mjs` (`collectFlow`'s facts, `artifactState`, `TEXT`
  `plan-revised` in both languages) and `change-loop.mjs` (`PLAN_REASONS`, the stale list, `nextAction`'s `plan`,
  the three approval waits' `detail.plan`). Check: T57 to T60 and T93 pass, and "flow-check stages: ticking tasks after the
  plan review does not make the plan stale" (`flow-check.test.mjs`) still passes.
- [ ] 3.6 D-7's texts: the `stop-plan-approval` row and line 20 of `plugins/openspec/skills/ship-change/SKILL.md`,
  and `ask.action.detail.plan` in `### A session per change` of `plugins/openspec/skills/devkit/SKILL.md`. Check: T61
  passes, and the skill tests of `change-loop.test.mjs` and `roadmap-loop.test.mjs` that read the
  `stop-plan-approval` row (`grep -n "stop-plan-approval" plugins/openspec/hooks/*.test.mjs` lists them) still pass.
- [ ] 3.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^parseTasks" --test-name-pattern="^review-writer-prompt" --test-name-pattern="^stop-plan-approval" --test-name-pattern="^approvalState" --test-name-pattern="^flow-check" --test-name-pattern="^format:" --test-name-pattern="^conduct:" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-9 (T62 to T69) and AC-8 (T51 to T61, T93, T94).

## 4. The language run, the verifier, the agent map, the host monitor and the documents (AC-6, AC-12, AC-4, AC-11, AC-5, AC-15)

- [ ] 4.1 The conducting session's task (D-14, D-11), done and ticked before phase 4 is handed; it needs nothing this
  change builds, so it may run earlier. Run R10 (the person's language never set, the installed plugin) in a scratch
  project outside this repository; write its output as `openspec/changes/coordinator-loop-fixes/proof/r10-*.jsonl`
  and append its line to `openspec/changes/coordinator-loop-fixes/proof/checks.txt` in the D-14 form; the run's
  output goes only to those files and is checked with `grep -c`, never printed (D-14 rule 4). An implementer
  handed phase 4 with this task open stops and reports it, without doing it. Check:
  `grep -c "^r10 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1.
- [ ] 4.2 Write T70 to T84 of D-16 in `plugins/openspec/hooks/guard.test.mjs`, `deliver-check.test.mjs`,
  `change-loop.test.mjs` and `project-loop.test.mjs`. T78 holds ADR 0011's `## Decision` section as a constant
  copied from the file at this commit. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes AC-12 " --test-name-pattern="^coordinator-loop-fixes AC-4 " --test-name-pattern="^coordinator-loop-fixes AC-11 " --test-name-pattern="^coordinator-loop-fixes AC-5 " --test-name-pattern="^coordinator-loop-fixes AC-15 " --test-name-pattern="^coordinator-loop-fixes AC-6 " --test-name-pattern="^coordinator-loop-fixes AC-16 " plugins/openspec/hooks/guard.test.mjs`
  exits non-zero and the suite loads; T73, T76's negative, T79 to T81 and T84 pin what holds today and may pass
  already (D-11).
- [ ] 4.3 D-8 in `plugins/openspec/hooks/guard.mjs` (`inProofFolder`, `writeViolation`, the header comment) and
  `plugins/core/agents/pr-verifier.md`. Check: T70 to T74 pass, and "evidence.md is written only by pr-verifier"
  (`guard.test.mjs`) still passes; `grep -c "it is the only file you write" plugins/core/agents/pr-verifier.md`
  prints 0.
- [ ] 4.4 D-9 in `plugins/openspec/hooks/change-loop.mjs` (`PACKS` moved, `agentOf`, the exported `AGENT` and
  `AGENT_ROLES`) and `project-loop.mjs` (`AGENT`). Check: T75 to T77 pass, and "stage-roles loop: the loop's own
  hand-offs of the test stages carry a role the packs know" and the `PACKS` and `docs/roles.md` test
  (`change-loop.test.mjs`) still pass.
- [ ] 4.5 D-10 in `plugins/openspec/skills/devkit/SKILL.md` (`## Waiting on GitHub`, the paragraph that starts no wait
  and says so) and `plugins/openspec/skills/devkit-session/SKILL.md` (item 3). Check: T82 and "change-loop skill: the
  wait is started in the background on a GitHub wait" (`change-loop.test.mjs`) pass.
- [ ] 4.6 D-11 and D-12: the Note of `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, the sentences
  of `docs/openspec-flow.md` that D-12 lists (the `devkit-lite` section's two decisions among them, and the language
  sentence written from the `r10` line of `proof/checks.txt` and the `proof/r10-*` files that 4.1 recorded: when that
  line is missing or does not end in `: pass`, write no language sentence, stop and report),
  `docs/coordination-design.md` line 185, the review gate sentence of the four `schema.yaml` files, and the ADR list
  of `openspec/config.yaml`. Before editing, `grep -rn "two rounds at most" plugins scripts docs openspec/specs openspec/schemas`
  and `grep -rn "stays red" docs` list every sentence to change, and the tests that read `docs/openspec-flow.md`
  (`grep -ln "openspec-flow.md" plugins/openspec/hooks/*.test.mjs`) are run after it. Check: T78, T83 and T84 pass,
  `grep -c "^r10 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1, and
  `python3 scripts/check.py` passes.
- [ ] 4.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^evidence.md is written only" --test-name-pattern="^change-loop" --test-name-pattern="^stage-roles" --test-name-pattern="^format:" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` green; covers AC-12 (T70 to T74), AC-4 (T75 to T77), AC-11's proven half in text (T82), AC-6 (T79 to T81, and R10 through 4.1), AC-5 (T78) and AC-15 (T83, T84).

## 5. The nits (AC-14)

- [ ] 5.1 Write T85 to T92 of D-16 in `plugins/openspec/hooks/change-loop.test.mjs`, `roadmap-loop.test.mjs` and
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs`. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes AC-14 " plugins/openspec/hooks/guard.test.mjs`
  exits non-zero on T85 and T86 (`createdAfter` is not exported yet); T87 to T92 pin what holds today and may pass.
- [ ] 5.2 D-13: "commit-attribution AC-1 T25 the S10 ADR reviewer hand-off does not carry the attribution request"
  in `plugins/openspec/hooks/project-loop.test.mjs`: its first assertion is that `CL.ATTRIBUTION_ASK` is exported and
  not empty, so the test fails without the export. Check: it passes, and
  `grep -c "ATTRIBUTION_ASK ?? " plugins/openspec/hooks/project-loop.test.mjs` prints 0.
- [ ] 5.3 D-13: "commit-attribution AC-2 T31 Method steps 3 and 5 point to Attribution and drop the environment
  rule" in `plugins/openspec/hooks/deliver-check.test.mjs`. Check: it passes, and
  `grep -c "split('Attribution below')" plugins/openspec/hooks/deliver-check.test.mjs` prints 0.
- [ ] 5.4 D-13: export `createdAfter` in `plugins/openspec/hooks/change-loop.mjs`, unchanged otherwise. Check: T85
  to T92 pass.
- [ ] 5.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^commit-attribution" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-14 (T85 to T92 and the two updated tests).

## 6. The merge, the release and the real runs (AC-16, the real-run proof of AC-1 to AC-13, and AC-11's deferred half)

- [ ] 6.1 D-17: merge `origin/main` (as the conducting session fetched it) into the branch; resolve each conflict by
  D-17 (a key a sibling added to `END_OF_KEY` becomes a `reply` row of `DECLARED`, and "roadmap-loop replies: every
  owner wait has a gate" gains it); when another change took ADR 0025's number, rename the ADR to the next free
  number of `docs/adr/` on `origin/main` with `git mv` and change every reference this change made to it. Check:
  `git merge-base --is-ancestor origin/main HEAD` exits 0 and `openspec validate coordinator-loop-fixes --strict`
  passes.
- [ ] 6.2 D-18: the next minor version after `origin/main`'s at the last merge before review for devkit-openspec and
  devkit-core, in each `plugin.json` and in `.claude-plugin/marketplace.json`, the marketplace's own next minor, the
  `CHANGELOG.md` section, and the devkit-openspec version mentions of the CI snippet in `docs/openspec-flow.md`.
  Check: `python3 scripts/gen-catalog.py --check` and `command claude plugin validate .` pass, and every
  devkit-openspec version the CI snippet of `docs/openspec-flow.md` names is `v` followed by the version
  `plugins/openspec/.claude-plugin/plugin.json` holds.
- [ ] 6.3 The conducting session's task (D-14 rules 1, 3 and 4), done on the merged head after 6.2 and ticked before
  phase 6 is handed again; an implementer that reaches it open stops before it and reports it, without doing it. Run
  R6, R7 and R7b of D-14 in scratch projects outside this repository with this worktree's
  `plugins/openspec/hooks/change-loop.mjs`, each scratch project built by a fixture script kept in the scratch run's
  folder outside the project (it never writes `declared.json`); send every loop command's stdout and stderr to its
  file under `openspec/changes/coordinator-loop-fixes/proof/` as D-14 names it, check each file with `grep -c` or
  `test` without printing it, copy each scratch `declared.json` to its `r*-declared.json`, and append one line per
  run to `proof/checks.txt` in the D-14 form. When a run's check fails, stop and report: the plan is revised before
  anything else. Check: `grep -c "^r6 .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt`,
  the same for `r7` and for `r7b`, each prints 1.
- [ ] 6.4 D-14 runs R1 to R5, R7s, R8, R9, R11, R13a, R13b and R14 in scratch projects outside this repository, with
  this worktree's packs (D-14 rules 2 and 3: every nested prompt in a file of the scratch run's folder, written with a
  quoted heredoc and passed as `claude -p "$(cat <file>)"`; every scratch file built by the fixture script), each
  output under `openspec/changes/coordinator-loop-fixes/proof/` as D-14 names it and its one-line check appended to
  `proof/checks.txt` in the D-14 form. R13a's host text is saved as `proof/r13a-host.txt`. No command of this task
  holds a `node … change-loop.mjs declare` line. When a run's check fails, stop and report: the plan is revised
  before anything else. Check: `proof/checks.txt` has one line for each of `r1` to `r5`, `r7s`, `r8`, `r9`, `r11`,
  `r13a`, `r13b` and `r14` (and the `r10` line of 4.1 and the `r6`, `r7` and `r7b` lines of 6.3), each ending in
  `: pass`.
- [ ] 6.5 D-10, AC-11's deferred half: add the line `- [ ] host-monitor-wake (after: coordinator-loop-fixes) — ...` to
  `## Round 16b: the coordinator loop fixes` of `openspec/roadmap.md`, right after the `coordinator-loop-fixes` line,
  saying in one sentence what R13a and R13b proved (no wait and the session says so with the host's monitor; the
  background wait without it) and what is open (whether the desktop app's monitor wakes the session when the checks
  pass, to be observed on the next change run in the app, with this change's retro recording what its own wait on
  GitHub showed). Check: `grep -c "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md`
  prints 1, and `grep -c "^r13a .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1.
- [ ] 6.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate coordinator-loop-fixes --strict && test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt && grep -q "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md` green, the whole suite run once as a background command of the tool; covers AC-16 and every AC through its tests, and AC-11's deferred half carried.

## Workflow follow-up

- `pr-verifier` records the gates, the real runs of `proof/` and its own run R12 (D-14) in `evidence.md`; it records
  R6, R7 and R7b from their files and runs no `declare` itself (a declaring case it wants to see again goes through
  a nested `claude -p`, D-14 rule 2).
- The review bench runs; the release tag is pushed by the loop's `tag-release` step after the merge.
- Archive the change after the review requirements are met.
