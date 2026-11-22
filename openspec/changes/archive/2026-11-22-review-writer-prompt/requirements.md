<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `review-round.mjs outcomes` returns each outcome's stage-3 writer prompt, as `review-change`'s agents path says, and the stage 1 prompt says a disposition names one sha (orchestrator-replan retro, items 1 and 2); and the stage 1 prompt asks for the sha `git rev-parse HEAD` printed and for the list of files read, so a partial review is seen before the verify stage (flow-script-checker retro, item 4); and two findings of the flow-script-checker retro carried by change-coordinator: a commit that touches only tests makes stale only the reviewers it concerns, and `deliver-check` stops counting a checkbox inside a fenced example of `tasks.md` (as `flow-check` already does); and two findings of the change-coordinator retro: the writer leaves out the stage-1 text's own Verdict and Commit lines (also seen in the field on 2026-11-21: a verdict file carried a second `Verdict:` line pasted from the stage-1 text), and a stage-1 answer that lists files of its remit as not read is sent back before the verify stage; and one finding of the coordinator-field-fixes retro: a stage-1 answer whose commit is not the full sha of HEAD is refused by the script before the verify stage

## Classification

domain=process type=feature flags=[contract] (confirmed by the owner's answers): the stage-1 JSON that every reviewer returns and the `args` of a review round are contracts between the reviewer agents, `review-round.mjs`, the Workflow script and the `review-change` skill; the review staleness rule is read by `deliver-check`, `flow-check`, `change-loop` and the `devkit-reviews` CI check.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The round's rules stay in one place: the block between `// ---- rules: begin` and `// ---- rules: end` of `plugins/core/skills/review-change/scripts/review-round.workflow.js`, loaded by `plugins/core/skills/review-change/scripts/review-round.mjs#loadRules`. Every rule below is written there, so the `workflow` and `agents` paths behave alike.
- Writer prompt: the result of `node plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input <json>` gains a `jobs` list, one entry per outcome, `{ reviewer, agentType: "devkit-core:<reviewer>", prompt }`, where `prompt` is `writerPrompt(args, outcome)`; the shape matches the `jobs` of the `stage1` and `verify` commands. The existing `outcomes`, `failed` and `verifiersFailed` keys stay as they are.
- One sha per disposition: `reviewerPrompt` states that a disposition is `fixed in <sha>` with exactly one sha (the commit that holds the fix) or `refuted: <evidence>`. The validator's rule in `validateStage1` (`/^(fixed in [0-9a-f]{7,40}|refuted:\s*\S.*)$/i`) does not change.
- HEAD: `args` gains a required `head` key, a full 40-hex sha, which the caller takes from `git rev-parse HEAD` in the change's worktree; `validateArgs` refuses an `args` without it. `validateStage1` refuses a stage-1 answer whose `commit` is not equal to `args.head`. `reviewerPrompt` asks for `commit` as `git rev-parse HEAD` prints it. The `review-change` skill (`plugins/core/skills/review-change/SKILL.md`) and the `review` row of `plugins/openspec/skills/ship-change/SKILL.md` say how the caller fills `args.head`.
- Files read: the stage-1 answer gains two required keys, `read` (a list of repo-relative paths the reviewer opened) and `notRead` (a list of paths of its remit it did not open; may be empty). `validateStage1` refuses an answer whose `notRead` is not empty, or whose `read` is empty while `declined` is `false`. A declined reviewer may return an empty `read`. `STAGE1_SCHEMA` of the Workflow script and the JSON shape in `reviewerPrompt` both carry the two keys.
- A refused stage-1 answer (wrong commit, a partial review) takes the failure path that exists today: the reviewer is listed in `failed` as `review stage failed: <reviewer> review`, gets no verifier, and the skill re-runs that reviewer's stages once with the Agent tool. No new retry mechanism.
- The `read` and `notRead` lists are used to refuse a partial review only; they are not written into the verdict file or `review.md`.
- Stage-1 Verdict and Commit lines: the round removes from the stage-1 `sections` text every line that begins (after optional spaces) with `Verdict:` or `Commit:` before it builds the outcome, so `writerPrompt` never carries one. `reviewerPrompt` says `sections` holds neither line. The `check-file` command refuses (exit 2, `review file mismatch`) a verdict file that has a line beginning with `Verdict:` or `Commit:` after line 2.
- Test files, a fixed pattern with no setting: a repo-relative path is a test file when its file name holds `.test.` or `.spec.` before the extension, or when any of its folders is named `test`, `tests`, `__tests__` or `fixtures`.
- Scoped staleness: in `plugins/openspec/hooks/deliver-check.mjs`, a commit after a reviewer's `Commit:` that touches only `openspec/` paths and test files makes stale only the verdict files of `test-coverage-reviewer` and `code-quality-reviewer`; `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` stay current. A commit that touches any other path outside `openspec/` makes every verdict file stale, as today. The rule is checked commit by commit, so one product commit in the range makes every review stale. Uncommitted changes outside `openspec/` keep making every review stale, as today.
- `evidence.md` and the other stage headers keep today's staleness: a test-only commit makes the evidence stale, so `verify` comes first and then only the two reviewers above are re-run.
- `flow-check` reports the review stage stale whenever `deliver-check` lists any stale reviewer; the loop's `review` step then names only the stale reviewers, as `next.reviewers` does today.
- Fenced tasks: `parseTasks` in `plugins/openspec/hooks/deliver-check.mjs` skips every checkbox line inside a fenced block (three or more backticks or tildes), with the same rule as `fencedLines` in `plugins/openspec/hooks/flow-check.mjs`; one shared helper serves both. This covers the tasks of the worktree and the tasks read from the default branch (`defaultTasks`).
- The pack versions (`devkit-core` for the review round, `devkit-openspec` for `deliver-check` and `flow-check`) are bumped as `CONTRIBUTING.md` says and meet the sibling changes at the release rebase.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `outcomes-returns-writer-jobs` — `review-round.mjs outcomes` prints a `jobs` list with one entry per outcome, each `{ reviewer, agentType: "devkit-core:<reviewer>", prompt }` whose `prompt` equals `writerPrompt(args, outcome)`; the `agents` path of `review-change` sends those prompts instead of building them by hand.
- AC-2 `stage1-prompt-one-sha` — the stage-1 prompt states that a disposition names exactly one sha (`fixed in <sha>`) or is `refuted: <evidence>`.
- AC-3 `stage1-prompt-asks-head-and-files` — the stage-1 prompt asks for `commit` as `git rev-parse HEAD` prints it and for the `read` and `notRead` lists.
- AC-4 `commit-not-head-refused` — with `args.head` set, a stage-1 answer whose `commit` differs from it (a short sha padded with zeros included) is listed in `failed` as `review stage failed: <reviewer> review` and gets no verifier job, on both the `workflow` and `agents` paths; an `args` without a 40-hex `head` is refused (exit 3).
- AC-5 `partial-review-refused` — a stage-1 answer with a non-empty `notRead`, or with an empty `read` while not declined, is listed in `failed` the same way before the verify stage; a declined answer with an empty `read` passes.
- AC-6 `writer-omits-stage1-verdict-commit` — when the stage-1 `sections` text holds a `Verdict:` or `Commit:` line, the outcome's `sections` and the writer prompt hold none, and a verdict file written from it has exactly one `Verdict:` line (line 1) and one `Commit:` line (line 2).
- AC-7 `check-file-refuses-second-verdict` — `review-round.mjs check-file` exits 2 with `review file mismatch` for a verdict file that has a `Verdict:` or `Commit:` line after line 2.
- AC-8 `test-only-commit-scoped-staleness` — after a commit that touches only test files (and `openspec/`), `deliver-check` lists only `test-coverage-reviewer` and `code-quality-reviewer` as stale and the `review` step names only them; after a commit that touches any other file outside `openspec/`, every reviewer is stale as before.
- AC-9 `deliver-check-skips-fenced-checkbox` — a checkbox line inside a fenced example of `tasks.md` is not counted as a task by `deliver-check` (neither as unticked nor as a gate), locally and on the default branch, matching `flow-check`.

## Out of scope

- A third review round or a declared step for a round the owner authorizes after the limit, and plan files revised after the implementation making the readiness review stale (carried by `stage-roles`).
- The readers of a verdict file taking the first `Verdict:` line (delivered by `merge-setup-field-fixes`, PR 46).
- A project setting for test-file globs, or a per-reviewer map of the file kinds that concern it.
- Changing which reviewers the matrix selects, or how a disposition with several shas is validated.
- Writing the `read` / `notRead` lists into the verdict file or `review.md`.

## Questions asked

1. [end effect] How should the change stop a second `Verdict:` line in a verdict file? → the script removes `Verdict:` / `Commit:` lines from the stage-1 `sections`, the stage-1 prompt says to leave them out, and `check-file` refuses a file with a second one.
2. [edges] How does the pure rule set learn the real HEAD? → a new required `args.head`, filled from `git rev-parse HEAD`, compared by `validateStage1` on both paths.
3. [end effect] How is a partial review detected? → required `read` and `notRead` lists; a non-empty `notRead` or an empty `read` (not declined) refuses the stage-1 answer through the existing failure path.
4. [scope] Which reviewers does a test-only commit make stale? → `test-coverage-reviewer` and `code-quality-reviewer`; the evidence stays stale as today.
5. [scope] What counts as a test file? → a fixed pattern (`.test.` / `.spec.` in the name, or a `test`, `tests`, `__tests__` or `fixtures` folder), no setting.

## Escalations

- None.
