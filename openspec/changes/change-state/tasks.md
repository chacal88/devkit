<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `change-state` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, key, text and test name is in
`design.md`: D-1 the state and its contract, D-2 the run file's facts, D-3 the `state` command, D-4 a
GitHub that does not answer, D-5 the session title, D-6 the board, D-7 the message table, D-8 ADR
0017 and the Notes, D-9 the new tests, D-10 the existing tests this change touches, D-11 documents
and release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test is named `change-state <AC-n> <area>: ...` and lives where D-9 puts it
(`plugins/openspec/hooks/change-loop.test.mjs` or `plugins/openspec/hooks/roadmap-loop.test.mjs`); a
gate runs them filtered through `plugins/openspec/hooks/guard.test.mjs`, which imports every suite.
Every env a new test builds uses its file's shared constant that blanks the branch variables. Every
gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests
need the `openspec` CLI 2.x on `PATH`. The whole suite (13 to 21 minutes) runs once, in gate 3.5, as a
background command of the tool, never with a shell `&`. No gate calls `claude` by name.

Test first in phases 1 and 2: the phase's test task comes before its code tasks, and its new tests fail
on the base `c561553`, except those D-9 marks "passes on the base". An existing test is changed only
where D-10 names it (E-1 to E-3), and the task says its invariant, layer and suite; the tests D-10
lists as passing unchanged are named in the check of the task that changes their code; any other
existing test that fails is a stop: report it and change nothing. Leave no backup or scratch file in
the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `one-change-state` | 2.1, 2.2 |
| AC-2 | `all-changes-state` | 2.1, 2.2 |
| AC-3 | `same-as-next` | 1.1, 1.3, 2.1, 2.2 |
| AC-4 | `ready-no-session` | 1.1, 1.2, 1.3, 2.1, 2.2 |
| AC-5 | `github-silent` | 1.1, 1.4, 2.1, 2.2, 3.2 |
| AC-6 | `status-reads-state` | 2.1, 2.3 |
| AC-7 | `title-state-icon` | 1.1, 1.3, 1.5, 2.1, 2.3, 3.2 |

## 1. The state, the GitHub rule and the title in the change loop (AC-3, AC-4, AC-5, AC-7)

- [x] 1.1 Write this phase's tests in `plugins/openspec/hooks/change-loop.test.mjs`, as D-9 names
  them (specs `change-state` "The state is the loop's own decision", "The roadmap run file's facts
  weigh on the state"; `change-coordination` "A run ends in one of four states with a plain reason",
  "The session waits on GitHub with no time limit"; `roadmap-coordination` "A change session shows the
  stage its change is in"): the eight `change-state AC-3 state: …` tests; `change-state AC-4 facts:
  runFactsOf reads each field of the run file`; `change-state AC-4 state: S1 to S8 each give their
  state`; the AC-5 tests `decide: the pull request that cannot be read …`, `decide: checks that cannot
  be read …`, `decide: a ceiling and a closed pull request still block`, `githubSilent: …`, `where: …`
  and the three `wait: …`; the six `change-state AC-7 title: …` tests and `change-state AC-7 next: …`.
  Each labelled case is its own test or `t.test` subtest, negatives included. Check: `env
  GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state"
  plugins/openspec/hooks/guard.test.mjs` on the base fails, and the only new tests that pass are the
  two D-9 marks "passes on the base" for this phase: `change-state AC-5 decide: a ceiling and a closed
  pull request still block` and `change-state AC-5 wait: the blocked form project-loop gives still
  counts as a failed read`.
- [x] 1.2 Move `runFilePath`, `readRun`, `emptyRun` (with its `isObject`), `GATE_OF_WHY` and `gateOf`
  from `plugins/openspec/hooks/roadmap-loop.mjs` to `plugins/openspec/hooks/change-loop.mjs`,
  unchanged and exported (D-2); `roadmap-loop.mjs` imports them and re-exports `runFilePath`, `readRun`
  and `gateOf`. The run file's parser keeps its behaviour on a missing, empty or broken file. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop"
  --test-name-pattern="^followups" plugins/openspec/hooks/guard.test.mjs` passes, with `roadmap-loop
  replies: every owner wait has a gate` and `followups AC-3 run file: …` unchanged.
- [x] 1.3 Add `runFactsOf`, `changeState`, `STATE_ICON` and `sessionTitle`'s third argument to
  `change-loop.mjs`, and set `action.state` and `action.sessionTitle` in `nextAction` (D-1, D-2, D-5).
  Check: the `change-state AC-3 state`, `AC-4 facts`, `AC-4 state`, `AC-7 title` and `AC-7 next` tests
  pass; `followups AC-14 icon: …` and `followups AC-14 title: sessionTitle is the icon and the id, cut
  under 60 code points` pass unchanged.
- [x] 1.4 Add `githubSilent` and use it in `decide`'s `blockedEnd` and in `whereOf`, drop `gh-error`
  and `checks-unreadable` from `BLOCKED_OF`, make `waitLoop` count a silent wait as a failed read and
  end blocked quoting `detail.error`, and add the two keys of D-7 to `MESSAGES` in both languages
  (D-4, D-7), all in `change-loop.mjs`. Check: this phase's AC-5 tests pass; `change-loop wait: W1` to
  `W9`, `change-loop wait: a different wait is a different decision …`, `change-loop replies: no
  internal term in either language`, `project-loop wait: it ends when the decision changes and holds
  no state` and `project-loop next: S25 …` pass unchanged.
- [x] 1.5 Change E-1 and E-2 of D-10 in `change-loop.test.mjs`. E-1, `change-loop decide: B0 the
  blocked ends of the stage checker win over the delivery step` (invariant: the stage checker's
  blocked ends win over the delivery step; layer: `decide`; suite: `change-loop.test.mjs`): remove the
  `gh-error` and `checks-unreadable` rows. E-2, `followups AC-14 next: every action of change-loop next
  carries the icon of its stage and its session title` (invariant: every action carries its stage
  icon and the title for it; layer: `nextAction`; suite: `change-loop.test.mjs`): expect the titles
  D-10 gives. Check: both pass.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3 (by `decide`), AC-4 (the facts and S1 to S8), AC-5 (the loop and the wait) and AC-7 (the titles of `next`).

## 2. The command, the board and the start title (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)

- [x] 2.1 Write this phase's tests, as D-9 names them (specs `change-state`, every requirement;
  `roadmap-coordination` "The board places each open change by its state" and the first title of "A
  change session shows the stage its change is in"). In `change-loop.test.mjs`: the five `change-state
  AC-1 command: …` tests, the three `change-state AC-2 command: …` tests, `change-state AC-3 cli: next
  and state give the same state for the same files and GitHub answers`, the four `change-state AC-4
  command: …` tests, and `change-state AC-5 delivery: …`, `AC-5 plan: …` and `AC-5 build: …`. In
  `roadmap-loop.test.mjs`: `change-state AC-6 board: …`, `change-state AC-6 board parity: …`,
  `change-state AC-6 status and state agree: …` and `change-state AC-7 start: …`. Check: `env
  GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state"
  plugins/openspec/hooks/guard.test.mjs` fails on the phase-1 code, and the only new tests of this
  phase that pass are `change-state AC-6 board: …` and `change-state AC-6 board parity: …`, which pin
  the placement and the words the board already gives after phase 1.
- [x] 2.2 Add `stateEntries` and the `state` subcommand to `change-loop.mjs`, routed in `main` and
  named in `USAGE` (D-3): the ids, the stand-in, the archived end with no folder, the JSON, exit 0 or
  3, no run marker, nothing written. Check: the `change-state AC-1`, `AC-2`, `AC-3 cli`, `AC-4 command`
  and `AC-5 delivery`, `plan` and `build` tests pass.
- [x] 2.3 Place `boardOf`'s rows by `changeState` and remove `ownRow` and `runningText` (D-6), title
  `sessionStartOf`'s start by the state (D-5), in `roadmap-loop.mjs`; change E-3 of D-10 in
  `roadmap-loop.test.mjs`, `followups F-3 decide: with a session per change the coordinator hands no
  stage and starts each open change's session in its worktree` (invariant: the start input is the
  start tool's eight fields and its title the change's; layer: `decideRoadmap`; suite:
  `roadmap-loop.test.mjs`): `b` is titled `🙋 ❓ b`. Check: the `change-state AC-6` and `AC-7 start`
  tests pass; every `roadmap-loop status: …` test, `followups AC-1 status: …`, `followups AC-15
  status: …` and `roadmap-loop status: nothing written` pass unchanged.
- [x] 2.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-3 (the command against `next`), AC-4 (the command), AC-5 (the command), AC-6 and AC-7 (the start title).

## 3. ADR 0017, the documents, the release and the whole suite (every AC)

- [x] 3.1 Create `docs/adr/0017-a-change-state-is-derived-in-one-place.md` with the text of D-8,
  `Status: accepted` and the `Accepted by` line quoting the owner's words recorded in
  `openspec/changes/change-state/approval.md` (the next free ADR number on `origin/main`, renumbering
  every reference, if another change took 0017). Add ADR 0014's header line and Note, ADR 0010's Note
  and the `openspec/config.yaml` `ADRs:` entry, as D-8 gives them. Write `change-state ADR 0017: the
  documents follow` in `change-loop.test.mjs`. Check: that test passes, and so does `followups ADR
  0014: the documents follow`, unchanged.
- [x] 3.2 Update `docs/openspec-flow.md` (the loop paragraph, "Waiting on GitHub", the new
  paragraph `**A change's state.**`, the title forms in "A session per change") and
  `docs/coordination-design.md`, as D-11 says. Check: `python3 scripts/check.py` passes; `change-state
  ADR 0017: the documents follow`, `followups ADR 0014: the documents follow` and `change-loop docs:
  the design records the answers` pass; the fields the new paragraph names are the keys `change-state
  AC-1 command: one change prints its state, reason, stage and title in the person's language`
  asserts, no more and no fewer.
- [x] 3.3 Release as D-11 says: `plugins/openspec/.claude-plugin/plugin.json` (0.23.0),
  `.claude-plugin/marketplace.json` (devkit-openspec 0.23.0, marketplace 0.27.0), `CHANGELOG.md`
  (`## 0.27.0 — one state per change`), the CI pin lines of `docs/openspec-flow.md` moved to
  `v0.23.0` with `setPins` of `release-rebase.mjs` and the assertion of `change-loop docs: the design
  records the answers` moved with them, then `python3 scripts/gen-catalog.py`. Check: `python3
  scripts/gen-catalog.py --check` passes and `release-rebase pin: the real docs/openspec-flow.md …`
  passes.
- [ ] 3.4 Owner-run task, done by the session that conducts this change (never `tdd-implementer`),
  after task 3.3: run the marketplace validation with the desktop app's bundled Claude Code, as
  `CONTRIBUTING.md` says, into `${TMPDIR%/}/devkit-validate-change-state/phase-3.txt`. Check: the
  record holds "Validation passed" and the release's commit; a failure is fixed in task 3.3 and the
  run repeated.
- [ ] 3.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-change-state/phase-3.txt"` green, the whole suite run once as a background command; covers every acceptance criterion's tests together, with every existing test passing.

## Workflow follow-up

- After the merge, tag `v0.23.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- The CI pin of `docs/openspec-flow.md` already moved to `v0.23.0` in this release (task 3.3), with
  the assertion of `change-loop docs: the design records the answers`; the tag only has to exist.
- Archive with the retro; the archive ticks the `change-state` line of `openspec/roadmap.md`.
- The first roadmap run after the release shows a change session renamed to a state title
  (`🙋 …`, `⏳ …` or `⛔ …`); the retro of the change that run starts records it.
