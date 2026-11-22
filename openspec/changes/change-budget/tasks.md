<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `change-budget` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, function, message, file and test name
is in `design.md`: D-1 the setting, D-2 the transcript lookup, D-3 the count, D-4 the hold, D-5 the
replies, D-6 the roadmap gate, D-7 the skill, D-8 the existing tests that change, D-9 the new tests,
D-10 documents and release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`change-budget AC-<n> ` (D-9). Every new hook test takes its env from `cleanEnv` of
`change-loop.test.mjs` (through `budgetEnv` where it needs a transcript), which blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF`,
`GITHUB_EVENT_PATH` and, from task 1.1, `CLAUDE_CODE_SESSION_ID`. Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
13 to 21 minutes) runs once, in 3.2, as a background command of the tool. The marketplace check is
written `command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first in every task: write its tests, see them fail on the code before the task, then make them
pass. A test that pins behaviour this change keeps (D-9 marks them: AC-3 under the cap, AC-4 no cap
and the scan without the option, AC-9 a spend of `null`, the grill and the ends not held, the
no-progress end first, `nextAction` without the option, other keys not read) passes on the old code
too; that is its point. New tests call the new functions through the file's existing namespace
imports (`guardModule.spentOf`, `changeLoopModule.budgetOf`), never a new named import, so the file
still loads on the code before the task. An existing test changes only where `design.md` D-8 names it, in the task that changes its rule,
with its invariant named in the commit message. Leave no backup or scratch file in the tree, and end
every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `stop-at-cap` | 2.1, 2.4, 2.7, 3.2 |
| AC-2 | `stop-message-says-how` | 2.1, 2.3, 2.7, 3.2 |
| AC-3 | `under-cap-unchanged` | 2.1, 2.4, 2.7, 3.2 |
| AC-4 | `no-cap-unchanged` | 1.1, 1.3, 1.5, 2.1, 2.2, 2.4, 2.7, 3.2 |
| AC-5 | `change-overrides-project` | 2.1, 2.2, 2.4, 2.7, 3.2 |
| AC-6 | `raised-cap-resumes` | 2.1, 2.4, 2.7, 3.2 |
| AC-7 | `count-rule` | 1.1, 1.3, 1.4, 1.5, 3.2 |
| AC-8 | `invalid-cap-refused` | 2.1, 2.2, 2.7, 3.2 |
| AC-9 | `unreadable-transcript-passes` | 1.1, 1.2, 1.3, 1.5, 2.1, 2.4, 2.7, 3.2 |
| AC-10 | `documented` | 2.1, 2.6, 2.7, 3.1, 3.2 |

## 1. The count (AC-4, AC-7, AC-9)

- [ ] 1.1 Red half. In `plugins/openspec/hooks/change-loop.test.mjs`, add `CLAUDE_CODE_SESSION_ID: ''`
  to `SET` (D-8, a fixture change), add the fixtures `usageLine` and `budgetEnv` beside
  `assistantLine` (D-9), and write the D-9 "Lookup" and "Count" tests (spec `change-coordination`: "The
  run's spend is counted from the session's transcripts", every scenario; "The loop stops at the
  budget between hand-offs", "No transcript to read"). Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" plugins/openspec/hooks/change-loop.test.mjs`
  on the code before this phase. Check: every new test fails there (the functions do not exist) but
  `change-budget AC-4 the scan without the option …`, which passes, and
  `node --test --test-name-pattern="^change-loop lock run" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [ ] 1.2 Add `sessionTranscript(env)` to `plugins/openspec/hooks/guard.mjs` as D-2 says. Check: the
  three `change-budget AC-9 sessionTranscript …` tests pass.
- [ ] 1.3 In `plugins/openspec/hooks/guard.mjs`, give `transcriptEvents` its usage mode, move `runOf`'s
  marker closure to the module-level `runMarkers`, and add `spentOf(transcript, change)`, as D-3 says;
  no other function changes. Check: every `change-budget AC-7 …`, `change-budget AC-9 an unreadable …`
  and `change-budget AC-4 the scan without the option …` test passes, and every existing
  `change-loop lock run:` test passes unchanged.
- [ ] 1.4 Live proof of the count (a check, not a gate): from this worktree, in the session that runs
  the phase, run
  `node --input-type=module -e "import { sessionTranscript, spentOf } from './plugins/openspec/hooks/guard.mjs'; const t0 = Date.now(); const p = sessionTranscript(process.env); console.log(JSON.stringify({ found: Boolean(p), count: p ? spentOf(p, 'change-budget') : null, ms: Date.now() - t0 }))"`.
  Check: `found` is true, `count.spent` is a whole number above 0 and `count.since` is a timestamp;
  write the printed JSON in the commit message of this phase (it holds no path).
- [ ] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" --test-name-pattern="^change-loop lock" plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-7, AC-9 (the lookup and the count) and AC-4 (the scan unchanged without the option).

## 2. The cap, the stop and the replies (AC-1 to AC-6, AC-8 to AC-10)

- [ ] 2.1 Red half. In `plugins/openspec/hooks/change-loop.test.mjs`, write the D-9 "Settings",
  "Decision", "`next`" and "Docs" tests (spec `change-coordination`: "A run can carry a token budget",
  "An invalid budget is refused before any stage runs", "The loop stops at the budget between
  hand-offs", "The budget stop says how to go on", "A raised budget resumes the run", every scenario).
  Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" plugins/openspec/hooks/change-loop.test.mjs`
  on the code of phase 1. Check: every test this task adds fails there, except the ones that pin kept
  behaviour (the list above), which pass; every phase-1 test still passes.
- [ ] 2.2 In `plugins/openspec/hooks/change-loop.mjs`, add `devkitBlock`, `budgetValue` and
  `budgetOf`, make `readDevkitSettings` use `devkitBlock` and flag an invalid project budget, and add
  `setting.budget` to `MESSAGES` in both languages, as D-1 and D-5 say. Check: every
  `change-budget AC-4`, `AC-5` and `AC-8` settings test passes, and every existing
  `change-loop settings:` test passes unchanged.
- [ ] 2.3 Add `waiting-budget` and `gate.budget` to `MESSAGES` in both languages with the D-5 texts;
  add `'waiting-budget': 'budget'` to `GATE_OF_WHY` in `plugins/openspec/hooks/roadmap-loop.mjs` (D-6).
  In the same task make the first two D-8 changes: "change-loop replies: no internal term in either
  language" (`SAMPLE`, `NAMES_ITS_FILE`, `EXEMPT_EQUAL`) and "roadmap-loop replies: every owner wait has
  a gate" (`expected`), naming each invariant in the commit message (spec `change-coordination`
  "Replies use no internal term" and spec `roadmap-coordination` "The run's replies come from the one
  message table", both MODIFIED). Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="replies" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs`
  passes.
- [ ] 2.4 In `plugins/openspec/hooks/change-loop.mjs`, add the `budget` option of `nextAction`, the
  `hold` of `decide` and `budget: true` in `runNext`, as D-4 says, and the header comment's sentence
  (D-10); `stopDecision`, `runWait` and `roadmap-loop.mjs` keep calling `nextAction` without the
  option. Check: every `change-budget AC-1`, `AC-2`, `AC-3`, `AC-6` and `AC-9` decision and `next`
  test passes, and every existing `change-loop decide:`, `change-loop next:` and `change-loop lock`
  test passes unchanged.
- [ ] 2.5 Make the three D-7 edits of `plugins/openspec/skills/devkit/SKILL.md`. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop skill" plugins/openspec/hooks/change-loop.test.mjs`
  passes, and `grep -c "waiting-budget" plugins/openspec/skills/devkit/SKILL.md` prints 1.
- [ ] 2.6 Write the D-10 text of `docs/openspec-flow.md` (the settings paragraph, the new "**The token
  budget.**" paragraph, the resume sentence, two Troubleshooting rows, the Cost bullet; not the pins),
  the sentence of `docs/coordination-design.md` and the comment of `openspec/config.yaml`. Check: the
  `change-budget AC-10 …` test passes, `python3 scripts/check.py` passes, and
  `openspec validate change-budget --strict` passes.
- [ ] 2.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 to AC-6 and AC-8 to AC-10, with every existing change-loop and roadmap-loop test passing.

## 3. Release and the whole suite (AC-1 to AC-10)

- [ ] 3.1 Release as D-10 says: devkit-openspec 0.22.0 in `plugins/openspec/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`, marketplace 0.26.0, a `CHANGELOG.md` section (or the next
  numbers after `main`'s, `CONTRIBUTING.md`); the three `v0.21.1` pins of `docs/openspec-flow.md`
  become `v0.22.0`. Make the third D-8 change, in "change-loop docs: the design records the answers",
  naming its invariant in the commit message. Check: `python3 scripts/gen-catalog.py --check` passes;
  `grep -c "v0.21.1" docs/openspec-flow.md` prints 0; and
  `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [ ] 3.2 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate change-budget --strict` green (the guard suite as a background command of the tool); covers AC-1 to AC-10 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.22.0` (or the version the release took) on the merge commit and push the
  tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the `change-budget` line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-openspec and move the pinned `devkit-reviews`
  workflow to the new tag.
- Dogfood in the next change run: set a small `budget:` in that change's `.openspec.yaml`, see the run
  stop at the cap with the reply of D-5, raise it, and see `/devkit change` resume; record it in that
  change's retro (the live half of AC-1, AC-2 and AC-6, which this change proves on fixtures).
