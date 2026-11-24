<!-- devkit-stage tasks result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Tasks

Change: `jira-entry-followups` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. `design.md` gives every rule, message, function,
file and test name: D-1 the review round's marker, D-2 the `commit` row for a plan fix, D-3 the flow
reader, D-4 `write-back ask`, D-5 `reply --stdin`, D-6 `task-taken` in the lock, D-7 the blocked-end
test, D-8 the prefix scenarios, D-9 docs and release, D-10 the tests (new ones, and
every existing one that changes). The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own, so no
part holds a `|`. Every new test's name starts `jira-entry-followups AC-<n> ` or
`jira-entry-followups docs:` (D-10). Every new hook test takes its env from the file's fixtures
(`cleanEnv`, `SET`, the `env` that `deliveredChange` returns). Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does, and with
`TMPDIR=/var/tmp`. The tests need the `openspec` CLI 2.x on `PATH`. The whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once, in 5.9, as a
background command of the tool. The marketplace check is written `command claude plugin validate .`.

Test first in every task: write its tests, see them fail on the code before the task, then make them
pass (a test that pins behaviour that does not change, AC-10, passes from the start and is proved by
the mutation its task names). An existing test changes only where `design.md` D-10 names it, in the
task that changes its rule, with its invariant named in the commit message. Leave no backup or
scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `marker-outside-openspec` | 2.1, 2.2, 2.3, 2.4, 2.5 |
| AC-2 | `marker-kept-for-product-edits` | 2.1, 2.3, 2.5 |
| AC-3 | `commit-after-plan-fix` | 1.1, 1.2 |
| AC-4 | `review-after-plan-fix-commit` | 1.2, 1.3 |
| AC-5 | `newer-flow-refused-clearly` | 3.1, 3.2 |
| AC-6 | `unknown-key-still-malformed` | 3.1 |
| AC-7 | `write-back-ask-by-number` | 4.1 |
| AC-8 | `connector-error-by-heredoc` | 4.2 |
| AC-9 | `task-taken-in-lock` | 4.3 |
| AC-10 | `blocked-ends-ask-nothing` | 4.4 |
| AC-11 | `id-prefix-spec` | 4.5 |

## 1. The delivery check hands a plan fix to commit (AC-3, AC-4)

- [x] 1.1 Reproduce the loop. In `plugins/openspec/hooks/deliver-check.test.mjs`, beside the
  `review-openspec-fix` tests, write `jira-entry-followups AC-3 a plan fix edited after a rejecting
  round is handed to commit, not fix-review` (D-10): `readyRepo`, `rejectedLoop`, committed, then
  `openspec/changes/feat/design.md` edited and not committed; `t.next()` must be `commit` with
  `paths` `['openspec/changes/feat/design.md']`. Check: `env TMPDIR=/var/tmp node --test
  --test-name-pattern="jira-entry-followups AC-3 a plan fix edited" plugins/openspec/hooks/deliver-check.test.mjs`
  fails on the code before 1.2, its assertion showing the step `fix-review`.
- [x] 1.2 Add `planDirty` to `collectState` and the `commit` row to `nextStep` in
  `plugins/openspec/hooks/deliver-check.mjs` (D-2). Write the other AC-3 tests of D-10 in
  `deliver-check.test.mjs`: the approved verdict with an undisposed `[important]` finding, only the
  review record uncommitted (one case per record path), the round-2 stop with a plan edit, nothing
  to fix, and the three `state()` branches of the new row. Extend `review-openspec-fix 12: a plan
  fix written and not committed leaves a rejected verdict current` as D-10 says (spec
  `verdict-files`, "A plan fix not committed yet"). Check: 1.1's test and these pass, and every
  other `nextStep` and `review-openspec-fix` test of the file passes unchanged.
- [x] 1.3 Extract `undisposedIn` from `findingsIn` and give `verdictAllowed` and `readReviews` the
  undisposed-finding rule (D-2). Write the AC-4 tests of D-10 in `deliver-check.test.mjs` (the
  committed plan fix gets `review` at round 2 and never `fix-review` again; the approved verdict
  with an undisposed finding stale after a plan commit and current after a record-only commit; a
  `fixed in` or `refuted:` finding keeping the approved rule; the test-spared reviewer after a
  test-only commit) and `jira-entry-followups AC-4 the stage readout offers the review again after
  an approved verdict's finding is fixed in the plan` in `plugins/openspec/hooks/flow-check.test.mjs`.
  Check: those pass, and `findingsItem`'s tests and `review-openspec-fix 10` and `11` pass unchanged.
- [x] 1.4 Docs of D-2: the `commit` and `fix-review` rows of
  `plugins/openspec/skills/ship-change/SKILL.md` (the `fix-review` row keeps "approved review",
  which `review round: text the ship-change review row and the devkit skill review sentence ...` in
  `plugins/core/skills/review-change/scripts/review-round.test.mjs` pins); the stale bullet of
  `plugins/core/skills/review-change/SKILL.md`; "The `Commit:` staleness rule" and "Order of the
  delivery steps" of `docs/openspec-flow.md` (the heading `**Order of the delivery steps.**` stays:
  `deliver-check.test.mjs` pins it). Write `jira-entry-followups docs: the ship-change commit row and
  the flow document name the commit of a plan fix` in `deliver-check.test.mjs`. Check: it passes, and
  `python3 scripts/check.py` passes.
- [x] 1.9 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs && python3 scripts/check.py` green; covers AC-3 and AC-4.

## 2. The review round marks the Commit line from git (AC-1, AC-2)

- [x] 2.1 Add `treeState` and the `tree` subcommand to
  `plugins/core/skills/review-change/scripts/review-round.mjs` (D-1), with the CLI header comment.
  Write in `plugins/core/skills/review-change/scripts/review-round.test.mjs`
  `jira-entry-followups AC-1 review-round tree lists no openspec path` and
  `jira-entry-followups AC-2 review-round tree lists every path that counts`,
  `jira-entry-followups AC-2 review-round tree refuses a root it cannot read` (`{}`, `{ root: 7 }`,
  `{ root: '' }`, a folder with no git, a `git init` folder with no commit) and
  `jira-entry-followups AC-2 review-round tree resolves a relative root` (spec `review-round`, "The
  round reads the uncommitted paths from git", every scenario about `tree`). Check: the four pass;
  before the subcommand exists they fail with `review usage:`.
- [x] 2.2 Change the rules section of
  `plugins/core/skills/review-change/scripts/review-round.workflow.js` (D-1): `validateArgs` requires
  `dirty`, `STAGE1_SCHEMA` and `validateStage1` drop `uncommitted`, `outcomeOf` reads `args.dirty`,
  `reviewerPrompt` loses the key and gains the sentence. In the same task change, in
  `review-round.test.mjs`, the `baseArgs` fixture, the `{ uncommitted: 1 }` row of `review round:
  validateStage1 rejects a malformed return with the review input invalid prefix` and `review round:
  writerPrompt holds every line verbatim and the commit line` as D-10 says. Write the AC-1 tests of
  D-10 for `validateArgs` (with each CLI command), the reviewer's own flag, the stage-1 prompt and the
  Workflow script (through the file's `AsyncFunction` harness). Check: those pass and every other
  test of `review-round.test.mjs` passes.
- [x] 2.3 Write in `plugins/openspec/hooks/deliver-check.test.mjs`
  `jira-entry-followups AC-1 the round's tree rule is the delivery check's`,
  `jira-entry-followups AC-1 a round with only openspec files uncommitted writes plain Commit lines
  that deliver-check reads as current` and `jira-entry-followups AC-2 a round with a product file
  uncommitted writes the marker and deliver-check lists it stale` (D-10), importing `treeState` from
  `../../core/skills/review-change/scripts/review-round.mjs` and running its CLI with `spawnSync`.
  Check: the three pass; with `.claude/` removed from the untracked rule of `treeState` in the
  working tree the parity test fails (put the line back by hand).
- [x] 2.4 Docs of D-1: the `Build \`args\` first` sentence of
  `plugins/core/skills/review-change/SKILL.md`, the `review` row of
  `plugins/openspec/skills/ship-change/SKILL.md`, and the review-round section of
  `docs/openspec-flow.md` (the `Commit:` marker comes from `review-round.mjs tree`). Write
  `jira-entry-followups docs: the review skill and the ship-change review row fill args.dirty from
  review-round.mjs tree` in `review-round.test.mjs`. Check: it passes, `review-writer-prompt AC-4
  text the review skill and the ship-change review row fill args.head from git rev-parse HEAD`
  passes unchanged, and `python3 scripts/check.py` passes.
- [x] 2.5 The real-run proof of D-1, every case it declares, after 2.4 so it runs on the final skill
  text: on a scratch clone of this worktree (outside the repository, under `$TMPDIR`; the clone
  holds only committed files, so copy this worktree's uncommitted change files into it first), with this worktree's `review-round.mjs` and
  `review-round.workflow.js`, run the session's own part (`review-round.mjs tree` on the clone, its
  `head` and `dirty` put into `args`) and, for each of the two trees (only `evidence.md` and
  `design.md` of the change dirty; `src/a.mjs` dirty) and each of the two stage-1 answers (without
  `uncommitted`; with `uncommitted: true`), both paths: the `agents` path through the `stage1`,
  `verify` and `outcomes` CLI calls, and the `workflow` path through the Workflow script run by
  `node` with the tool globals of `review-round.test.mjs`'s harness. For each of the eight runs,
  record line 2 of every writer prompt, write the file as the prompt says, run `check-file` on it
  and `deliver-check.mjs <id>` on the clone. Write the commands and their outputs to
  `openspec/changes/jira-entry-followups/proof/real-run.md`. Check: the file holds eight runs; the
  four with only `openspec/` files dirty have a plain `Commit: <head>` and a current reviews item,
  the four with `src/a.mjs` dirty have `Commit: <head> (uncommitted changes)` and a reviews item
  naming the verdicts recorded with uncommitted changes, whatever the stage-1 answer said; the
  scratch clone is removed.
- [x] 2.9 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-1 and AC-2.

## 3. The flow reader refuses a newer flow clearly (AC-5, AC-6)

- [ ] 3.1 Add `FLOW_VERSIONS` at `{ devkit: 2, 'devkit-lite': 2, 'devkit-project': 1 }` and the two
  checks of D-3 to `readFlowFile` in `plugins/openspec/hooks/guard.mjs`; no flow file changes.
  Write in `plugins/openspec/hooks/version-pin.test.mjs`, beside `version-pin AC-4 readFlowFile: a
  version is a whole number from 1`, the AC-5 and AC-6 tests of D-10: the newer flow with no release
  field and with `readerRelease: '9.1.0'` (each message pinned exactly), a release field that is not
  a release number, a script outside `FLOW_VERSIONS`, an unreadable release field at a known
  version, the unknown stage key at a known version, `FLOW_VERSIONS` equal to each shipped
  `flow.json`'s version (both schema copies, three scripts), and the shipped `flow.json` of
  `devkit` and `devkit-lite` byte-identical to `flows/2.json` (both copies). Check: those pass, the
  two newer-flow tests fail before the change with `malformed: stage mockup has an unknown key
  colour`, `git diff --stat -- plugins/openspec/schemas openspec/schemas scripts/released-flows.json`
  prints nothing, and `version-pin AC-4 readFlowFile: a version is a whole number from 1` and the
  `appliesWhen` refusals of `plugins/openspec/hooks/flow-check.test.mjs` pass unchanged. Write also
  `jira-entry-followups AC-5 a release number at a known version is accepted` (`'1.2.3'`) and cover
  `'1.2'` in the malformed one. In the same task rewrite, in
  `plugins/openspec/hooks/roadmap-loop.test.mjs`, `upfront AC-4 lock agent: a helper of the
  requirements stage is read from the flow the change is pinned to` (line 4048) and `upfront
  partOfStage: the part of a stage is read from the flow the change is pinned to` (line 4069) as
  D-10 says: the pinned flow at `kept.version - 1` in `flows/1.json` with the pin
  `x-devkit-flow: 1`, the changed flow installed at `kept.version`; their invariant (a change
  follows the flow it is pinned to, not the installed one) named in the commit message. Before the
  rewrite, with the reader changed, both fail; after it both pass. Run
  `grep -n "version + 1\|version: [3-9]" plugins/openspec/hooks/*.test.mjs` (the design's grep):
  no hit is left that installs a flow above `FLOW_VERSIONS` (D-10 explains the known others).
- [ ] 3.2 In `docs/openspec-flow.md` write the two sentences of D-3: in "The flow a change follows",
  a reader from this release on refuses a `flow.json` newer than it knows with the update to make,
  naming the release when the file carries `readerRelease`, while an unknown key at a known version
  stays malformed; after "A change to a `flow.json` raises its `version`", a new version adds
  `readerRelease` and raises `FLOW_VERSIONS` in `plugins/openspec/hooks/guard.mjs`; the same two
  steps in `CONTRIBUTING.md`, "Changing the OpenSpec schemas". Check: `python3 scripts/check.py`
  passes.
- [ ] 3.9 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-5 and AC-6, and the two rewritten `roadmap-loop` tests.

## 4. The review's open nits (AC-7 to AC-11)

- [ ] 4.1 Change `writeBackAsk` in `plugins/openspec/hooks/change-loop.mjs` (D-4). Write
  `jira-entry-followups AC-7 write-back ask by key and number` in
  `plugins/openspec/hooks/change-loop.test.mjs` with every case of D-10, the record read back after
  each call. Check: it passes (the "number 15" and "another key" cases fail before the change), and
  every `jira-entry AC-6 write-back ask` test passes unchanged.
- [ ] 4.2 Add `--stdin <name>` to `runReply`, `main`, `isMain`, `USAGE` and the module header of
  `change-loop.mjs`, and change the failed-write sentence and call of `### Writing back to the task`
  in `plugins/openspec/skills/devkit/SKILL.md` (D-5). In the same task change `jira-entry AC-7 skill:
  Jira is written only through write-back answer on the owner's own message, and a failed write is
  said and not retried` in `change-loop.test.mjs` as D-10 says. Write the five AC-8 tests of D-10
  (byte for byte; the refusals, each input of the row; the final `\r\n` or `\n`; no standard input
  read without `--stdin`; the spawned heredoc), one per scenario of "The connector's error reaches
  the reply as it is" in `specs/jira-tasks/spec.md`.
  Check: they pass; `guard.test.mjs`'s `--param why=cannot-accept --param error=` line and
  `roadmap-loop.test.mjs`'s `--param why=base-conflict --param error=` line still match their skill
  text.
- [ ] 4.3 Move the `task-taken` check into the open lock (D-6): `openChange`, `openCheckout` and
  `openUnderLock` in `change-loop.mjs`. Write `jira-entry-followups AC-9 two open --task calls for one
  key at once create one change` and `jira-entry-followups AC-9 open --task on the id of the key's
  own unfinished change answers task-taken` in `change-loop.test.mjs` (D-10, the lock written by the
  test; `check?.()` before the name checks). The concurrent test uses a new helper `openTaskChild(cwd,
  id)`, `openChild` with `--task PROJ-482` and `FAKE_TASK` as JSON on its standard input. Check: both pass, the first fails on the code before
  the task with both codes 0, and `jira-entry AC-5 open
  --task refuses a second change for a key whose change is unfinished` and every `change-loop open:`
  test pass unchanged.
- [ ] 4.4 Write `jira-entry-followups AC-10 next carries no writeBack on a blocked end held at the
  pull request` in `change-loop.test.mjs` with the fixture of `change-loop next: a pull request
  conflicting in another file ends blocked as a pull request problem` (line 887) plus
  `requirements: TASK_REQUIREMENTS` (D-7); no behaviour changes. Check: it passes; with
  `action.end.state === 'blocked' ||` removed from `stopped` in `change-loop.mjs` it fails, and with
  the line put back by hand it passes (`git diff -- plugins/openspec/hooks/change-loop.mjs` shows no
  change from this task); `jira-entry AC-6 next carries the task but no writeBack on a budget end
  held at the pull request` passes unchanged.
- [ ] 4.5 Write the four `jira-entry-followups AC-11 taskIdPrefix ...` tests of D-10 in
  `plugins/openspec/hooks/jira-task.test.mjs`, one per scenario of "The change id's prefix comes
  from the key" in `specs/jira-tasks/spec.md`, each with that scenario's inputs (`PROJ-482`,
  `PROJ_X-12`, `PROJ_-12` and `A__B-1`, `PROJ_`); no behaviour changes. Check: they pass, and
  `jira-entry AC-1 taskIdPrefix lower-cases the key and turns underscores into dashes` passes
  unchanged.
- [ ] 4.9 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/jira-task.test.mjs && python3 scripts/check.py` green; covers AC-7, AC-8, AC-9, AC-10 and AC-11.

## 5. Release and the whole suite (every AC)

- [ ] 5.1 Release, at the last merge of main before review (CONTRIBUTING.md step 5): bump
  devkit-openspec and devkit-core, each to the next free minor after its version on origin/main at
  that merge, in `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/core/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace to the next free minor there too; add the `CHANGELOG.md` section (D-9; no
  `Projects:` re-run line: no flow file changes). Check: `python3 scripts/check.py` passes.
- [ ] 5.2 Docs of D-9 in `docs/openspec-flow.md`: the CI pin `v0.33.0` (three places) moved to
  `v<the devkit-openspec version 5.1 set>`, with the CI-pin test of `change-loop.test.mjs` (line
  2578) moved to it in the same task. Run `python3 scripts/gen-catalog.py`. Check:
  `python3 scripts/gen-catalog.py --check` and `python3 scripts/check.py` pass, and
  `grep -c "v0.33.0" docs/openspec-flow.md` prints 0.
- [ ] 5.9 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate jira-entry-followups --strict` green (the guard suite as a background command); covers AC-1 to AC-11 and every other suite at once.

## Workflow follow-up

- After the merge, `deliver-check` answers `tag-release`: the session pushes `v<devkit-openspec
  version>` on the merge commit (ADR 0019).
- The verify step cites `proof/real-run.md` (task 2.5) and the mutation runs of 2.3 and 4.4 in
  `evidence.md`. The session runs this change's own review round with this worktree's
  `plugins/core/skills/review-change` as `<skill-dir>` and records the `tree` output and each
  verdict's line 2 in `review.md`'s section (D-1).
- In the projects that use devkit: update devkit-openspec and devkit-core, and move the pinned
  `devkit-reviews` workflow to the new tag through each project's own pull request.
- Archive with the retro.
