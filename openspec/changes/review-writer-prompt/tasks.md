<!-- devkit-stage tasks result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Tasks

Change: `review-writer-prompt` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, message, function, file and test name
is in `design.md`: D-1 `args.head` and the stage-1 checks, D-2 the prompt and schema, D-3 the
`Verdict:`/`Commit:` lines, D-4 the writer jobs, D-5 the callers and the reviewers' text, D-6 the
scoped staleness, D-7 the review stage, D-8 the fence helper, D-9 the existing tests that change, D-10
tests, documents and release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`review-writer-prompt AC-<n> ` (D-10). Every new hook test takes its env from the file's existing
fixtures (`shipRepo` env, `CI_ENV`), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
`GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
about 13 minutes) runs once, in 3.2, as a background command. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first in every task: write its tests, see them fail on the code before the task, then make them
pass. An existing test changes only where `design.md` D-9 names it, in the task that changes its
rule, with its invariant named in the commit message. Leave no backup or scratch file in the tree, and
end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `outcomes-returns-writer-jobs` | 1.4, 1.6, 1.7 |
| AC-2 | `stage1-prompt-one-sha` | 1.2, 1.7 |
| AC-3 | `stage1-prompt-asks-head-and-files` | 1.2, 1.5, 1.7 |
| AC-4 | `commit-not-head-refused` | 1.1, 1.6, 1.7 |
| AC-5 | `partial-review-refused` | 1.1, 1.7 |
| AC-6 | `writer-omits-stage1-verdict-commit` | 1.3, 1.7 |
| AC-7 | `check-file-refuses-second-verdict` | 1.3, 1.7 |
| AC-8 | `test-only-commit-scoped-staleness` | 2.2, 2.3, 2.4, 2.5, 3.2 |
| AC-9 | `deliver-check-skips-fenced-checkbox` | 2.1, 2.4, 2.5, 3.2, 4.1, 4.2, 4.3 |

## 1. The review round (AC-1 to AC-7)

- [x] 1.1 Add `args.head` and the stage-1 checks of D-1 to the rules section of
  `plugins/core/skills/review-change/scripts/review-round.workflow.js` (`validateArgs`,
  `validateStage1(reviewer, value, head)`, the Workflow script's call) and to the call in
  `plugins/core/skills/review-change/scripts/review-round.mjs#readStage1`. In the same task, make the
  D-9 fixture edits of `review-round.test.mjs` (`baseArgs` gains `head: SHA`, `stage1Of` gains `read`
  and `notRead`, every direct `validateStage1` call passes the head) and the two D-9 changes that drop
  `{ commit: SHA2 }`, naming each invariant in the commit message. Write the
  `review-writer-prompt AC-4` and `AC-5` tests of D-10 (spec `review-round`: "A review round needs
  the head sha", "A stage-1 answer at another commit fails its review stage", "A partial stage-1
  answer fails its review stage", every scenario). Check:
  `node --test --test-name-pattern="^review-writer-prompt AC-[45] " plugins/core/skills/review-change/scripts/review-round.test.mjs`
  passes, and so does every other test of that file.
- [x] 1.2 Change `STAGE1_SCHEMA` and `reviewerPrompt` as D-2 says. Write the
  `review-writer-prompt AC-2` and `AC-3` tests (spec `review-round`: "The stage-1 prompt names one sha
  per disposition", "The stage-1 prompt asks for HEAD and the files read", every scenario). Check: those
  tests pass, and the existing prompt tests ("every prompt starts with the worktree preamble …",
  "reviewerPrompt names the previous verdict file …") pass unchanged.
- [x] 1.3 Add `isHeaderLine` and `withoutHeaderLines` to the rules section, use the second in
  `validateStage1`, and add the line check to `review-round.mjs#checkFileCommand` (D-3). Write the
  `review-writer-prompt AC-6` and `AC-7` tests (spec `review-round`: "A verdict file carries one
  Verdict line and one Commit line", "The file check refuses a second Verdict or Commit line", every
  scenario). Check: those tests pass, and the existing `check-file` tests pass unchanged.
- [x] 1.4 Add `writeJobs` to the rules section, use it in the Workflow script's write phase and in
  `review-round.mjs#outcomesCommand`, and add the three new names to `NAMES` and to the export list
  of `review-round.mjs` (D-4; the D-9 extension of "the rules section loads and exports every
  name"). Write the `review-writer-prompt AC-1` tests of the script (spec `review-round`: "The
  outcomes command gives the writer prompts", every scenario). Check: those tests pass, and "cli
  equals the workflow for the same fixtures, except the path (AC-5)" passes.
- [x] 1.5 Replace the Stage 1 bullet of the "Staged round" paragraph in
  `plugins/core/agents/code-quality-reviewer.md`, `test-coverage-reviewer.md`,
  `architecture-reviewer.md`, `security-reviewer.md`, `adr-reviewer.md` and `spec-reviewer.md` with
  the text of D-5. This task is flagged in `proposal.md`, and the owner may drop it at approval. Check:
  `python3 scripts/check.py` passes; the six files hold the same bullet, which names
  `git rev-parse HEAD` and "without your verdict line"; and "text all six reviewer agents have the
  Staged round paragraph" passes.
- [x] 1.6 Update `plugins/core/skills/review-change/SKILL.md` (the `args` sentence, the refusal
  sentence, `agents` step 3 and the `check-file` bullet), the `review` row of
  `plugins/openspec/skills/ship-change/SKILL.md`, and "The review round" section of
  `docs/openspec-flow.md` (item 1 and the `check-file` sentence), as D-5 and D-10 say. Write the
  `review-writer-prompt AC-1` and `AC-4` text tests (spec `review-round`: "The review skill fills the
  head and sends the writer jobs", both scenarios). Check: those tests and every existing "text" test
  of `review-round.test.mjs` pass, and `python3 scripts/check.py` passes.
- [x] 1.7 Gate: `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs && python3 scripts/check.py` green; covers AC-1 to AC-7.

## 2. The delivery checker (AC-8, AC-9)

- [x] 2.1 Move `fencedLines` from `plugins/openspec/hooks/flow-check.mjs` to
  `plugins/openspec/hooks/deliver-check.mjs` as an export, import it in `flow-check.mjs`, and make
  `parseTasks` skip the fenced lines (D-8), leaving both regular-expression literals byte-identical.
  Write the `review-writer-prompt AC-9` tests in `plugins/openspec/hooks/deliver-check.test.mjs`
  (spec `change-delivery`, every scenario, and the source check of D-10). Check: those tests pass;
  every existing "flow-check tasks:" and "flow-check stages: a fenced example …" test passes; and
  `python3 scripts/check.py` passes (the panel parity check).
- [x] 2.2 Add `isTestFile`, `TEST_SPARED_REVIEWERS` and the `allowed` option of `staleness` to
  `plugins/openspec/hooks/deliver-check.mjs`, and use them in `readReviews` (D-6). Write the
  `review-writer-prompt AC-8` tests of `deliver-check.test.mjs` (spec `verdict-files`, both
  requirements, every scenario, with the CI scenario through `bothEntries`). Check: those tests pass,
  and every existing "staleness:", "item 2:" and "nextStep" test passes unchanged.
- [x] 2.3 Add `staleReviewers` to the facts of `flow-check.mjs#collectFlow`, the review-stage check
  to `artifactState`, and the `stale-reviewers` entry to both languages of `TEXT` (D-7). In the same
  task, add the code to the sample table of "flow-check readout: both languages cover every reason
  code" (D-9), naming its invariant in the commit message. Write the `review-writer-prompt AC-8` tests
  of `plugins/openspec/hooks/flow-check.test.mjs` (spec `change-stages`, every scenario). Check: those
  tests pass, and so does every existing test of `flow-check.test.mjs`.
- [x] 2.4 Update `docs/openspec-flow.md` (the delivery table rows 1 and 2, the `Commit:` staleness rule,
  the order of the delivery steps, the CI sentence) and the Cost paragraph and stale bullet of
  `plugins/core/skills/review-change/SKILL.md`, as D-10 says. These are every file that states the
  staleness rule (Context of `design.md`). Check: `python3 scripts/check.py` passes, and
  `grep -c "test files" docs/openspec-flow.md plugins/core/skills/review-change/SKILL.md` prints a
  count of at least 1 for each file.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-8 and AC-9.

## 3. Release and the whole suite (AC-1 to AC-9)

- [x] 3.1 Release as D-10 says. Bump devkit-core to 0.9.0 in `plugins/core/.claude-plugin/plugin.json`
  and devkit-openspec to 0.20.0 in `plugins/openspec/.claude-plugin/plugin.json`, both also in
  `.claude-plugin/marketplace.json`, and bump the marketplace to 0.24.0. Add the `CHANGELOG.md` section.
  Turn the three `v0.18.1` lines of `docs/openspec-flow.md` into `v0.20.0`. Make the two D-9 changes in
  "change-loop docs: the design records the answers" of `plugins/openspec/hooks/change-loop.test.mjs`
  (the pin, and the roadmap line found ticked or not), naming each invariant in the commit message.
  Check: `python3 scripts/gen-catalog.py --check` passes; `grep -c "v0.18.1" docs/openspec-flow.md`
  prints 0; and
  `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 3.2 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate review-writer-prompt --strict` green (the guard suite as a background command); covers AC-1 to AC-9 and every other suite at once.

## 4. The unclosed fence (AC-9, review round 1)

- [x] 4.1 Write the unclosed-fence tests of D-8 in `plugins/openspec/hooks/deliver-check.test.mjs`,
  right after "review-writer-prompt AC-9 fencedLines is exported by deliver-check.mjs and flow-check.mjs
  holds no copy", each named `review-writer-prompt AC-9 …`: `fencedLines`, `parseTasks`, `readPhases`,
  `tasksItem`, `nextStep` through `planRepo({ tasks })`, and the flow-check side through
  `pendingTasks`, imported from `./flow-check.mjs` (spec `change-delivery`: "An unclosed fence hides
  nothing", "A task and a gate after an unclosed fence are counted", "The next step after an unclosed
  fence"). This is the red half: run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^review-writer-prompt AC-9 " plugins/openspec/hooks/deliver-check.test.mjs`
  on the code of phase 3. Check: every new test fails there, and the six earlier AC-9 tests pass.
- [x] 4.2 Change `fencedLines` in `plugins/openspec/hooks/deliver-check.mjs` as D-8 says (the end
  of the scan with a fence open, the resume at the line after its opening line, the added comment
  sentence), and no other function; both regular-expression literals of `parseTasks` stay
  byte-identical. Check: the command of 4.1 passes; every existing "flow-check tasks:" and
  "flow-check stages: a fenced example …" test of `plugins/openspec/hooks/flow-check.test.mjs` passes
  unchanged; and `python3 scripts/check.py` passes (the panel parity check).
- [x] 4.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-9.

## Workflow follow-up

- After the merge, tag `v0.20.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 25 line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-core and devkit-openspec, and move the pinned
  `devkit-reviews` workflow to `v0.20.0` through each project's own pull request.
