<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> from the jira-entry retro: a review round whose tree is dirty only inside the change folder records its verdicts as committed (the delivery check today treats "(uncommitted changes)" as stale, so the evidence had to be committed and the round run again); after a fix that touches only the change folder, `next` hands the re-review instead of `fix-review` again (round 2 of jira-entry was run by hand); the installed loop reads a `flow.json` newer than itself or says which release it needs (0.21.1 refused `appliesWhen`); and the review's open nits: `writeBackAsk` compares the pull request number as `nextAction` does, the skill passes a connector error through the quoted heredoc and not `--param error=`, the task-taken check runs inside the open lock, a test for the blocked half of the write-back condition, and the spec delta states the `_` to `-` mapping of the id prefix

## Classification

domain=process type=bug flags=[contract] (strict-assumed: it changes a stage reply, a `flow.json` reader message and a verdict-file marker, all read by other scripts). No `ui` flag: no screen, so no mock-up.

## Overlap with the sibling lines of `openspec/roadmap.md`

Checked against today's `origin/main` (c1ac8c4) and each sibling line:

- `loop-place-and-evidence` commits `evidence.md` after the verify step and adds the waiting-for-a-place end. It removes one way a round meets a dirty tree, but not the cause this change fixes: the review round's `uncommitted` flag is set by the reviewer from its own reading, so any dirty path (a design fix, a task tick) stamps the marker. Both stay; nothing is dropped. This change commits nothing and adds no end.
- `stale-only-on-own-files` changes what a merge of the default branch stales (`staleness`, the merge half). This change changes which step `next` hands after an uncommitted edit inside the change folder (`nextStep`). Both touch `plugins/openspec/hooks/deliver-check.mjs`, in different functions; whichever merges second merges main. Nothing dropped.
- `evidence-attempts-by-failure` and `stage-ceiling-consecutive` count a stage's attempts in `flow-check.mjs`. No item of this request touches that counting. Nothing dropped.

Every item of the request stays in this change.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Item 1 cause (found in the code): the stage-1 prompt of `plugins/core/skills/review-change/scripts/review-round.workflow.js` asks each reviewer for `uncommitted: boolean` and does not define it, while the reviewer agents (`plugins/core/agents/*-reviewer.md`) and `dirtyPaths` in `plugins/openspec/hooks/deliver-check.mjs` mean "uncommitted work outside `openspec/`". A round with only `evidence.md` dirty therefore stamped `Commit: <sha> (uncommitted changes)` on every verdict.
- Item 1 fix: the flag is true only when `git status --porcelain -z -uall` lists a path outside `openspec/` (an untracked `.claude/` path does not count), the same rule as `dirtyPaths`; the round script decides it from git (`plugins/core/skills/review-change/scripts/review-round.mjs`), and the prompt states the rule. The checker is unchanged: a marked verdict is still stale (`openspec/specs/reviews-check/spec.md`, "A review recorded with uncommitted changes").
- Item 2 cause (found in the code, to be reproduced by a failing test before the fix): a rejected verdict stays current while the fix is only edited, not committed (`openspec/specs/verdict-files/spec.md`, "A plan fix not committed yet"), and `nextStep` in `plugins/openspec/hooks/deliver-check.mjs` hands the `commit` step only for paths outside `openspec/` (`state.dirty`). A fix that touches only the change folder is therefore never handed to `commit`, the verdict never goes stale, and `next` answers `fix-review` again (the `ship-change` row of `fix-review` ends with "Then `commit`", which `next` never hands for such a fix).
- Item 2 fix: when a review is rejected, or an approved one holds an undisposed `[blocking]` or `[important]` finding, and the change folder has uncommitted paths other than its review record (`reviews/`, `review.md`, `evidence.md`), `next` answers `commit` naming those paths; once committed the verdict is stale and `next` answers `review` (round 2). The verdict-files scenario "A plan fix not committed yet" is revised in this change's spec delta: its next step becomes `commit`, its verdict stays current.
- Item 3 (found in the code): `readFlowFile` in `plugins/openspec/hooks/guard.mjs` validates stage keys before it looks at `flow.version`, so a script that predates a key calls the file "malformed: stage mockup has an unknown key appliesWhen". An installed script cannot be changed after the fact; the fix is forward and reader-only (owner's answer, 2026-11-23: no flow version 3 now): the reader checks `flow.version` against the newest version it knows first, before the stage keys. A newer version is refused with one message that names the version of the file, the newest version the script reads and what to do (update `devkit-openspec` and restart the session); when the file carries the optional top-level field naming the release that reads it, the message names that release too. The shipped `flow.json` files (`plugins/openspec/schemas/devkit/flow.json`, `devkit-lite`) are not changed in this release, so they stay byte-identical to their released `flows/2.json`; the field enters with the next flow change, which raises the version anyway. The field name is the planner's. The message stays English, as the other `FlowUsageError` messages.
- Item 4a: `writeBackAsk` in `plugins/openspec/hooks/change-loop.mjs` answers `ask: false, why: 'asked'` when the record holds the task key and the pull request `number` it was given, as `writeBackAsked` already does for `nextAction`; a record for another number (the pull request was recreated) asks again and replaces the record; a damaged record still reads as asked.
- Item 4b: `plugins/openspec/skills/devkit/SKILL.md` runs `reply write-back-failed` with the connector's error on standard input through the quoted heredoc and its terminator rule, as `write-back ask` does, and not with `--param error="<message>"`; `change-loop.mjs reply` reads that parameter from standard input. Only `write-back-failed` moves: the other `--param error=` uses in that file carry text the script itself printed.
- Item 4c: in `openChange` the check that raises `task-taken` (`unfinished(...).find(... recordedTask ...)`) moves inside `withOpenLock` (into `openUnderLock`), so two `open --task` calls for one key cannot both pass it.
- Item 4d: a test pins the blocked half of the write-back condition in `nextAction`: a delivered pull request with a `blocked` end, and with the `waiting-budget` end, gives an action with no `writeBack`. No behaviour changes there.
- Item 4e: `openspec/specs/jira-tasks/spec.md` gains a requirement and scenarios for the change id's prefix as `taskIdPrefix` in `plugins/openspec/hooks/jira-task.mjs` computes it: the key lower-cased, each `_` turned into `-`, runs of `-` collapsed to one, trailing `-` removed (the key `PROJ_X-12` gives the prefix `proj-x-12`). Written into this change's own spec delta; no code changes.
- Release: the change touches `plugins/openspec` (hooks, skill, schemas) and `plugins/core` (the review round), so it bumps both packs and the marketplace as `CONTRIBUTING.md` says; the numbers are taken at the last merge of main.
- Every task that changes a text a test pins names that test (`openspec/config.yaml` rule from the jira-entry retro).

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `marker-outside-openspec`: a review round whose only uncommitted paths are inside `openspec/` (for example `evidence.md`, or `design.md` of the change) writes every verdict with a plain `Commit: <full sha>` line, and `deliver-check.mjs <id>` reads those verdicts as current.
- AC-2 `marker-kept-for-product-edits`: a round whose tree has one uncommitted path outside `openspec/` still writes `Commit: <sha> (uncommitted changes)`, and `deliver-check.mjs <id>` still lists that verdict as stale.
- AC-3 `commit-after-plan-fix`: with a rejected verdict (or an approved one with an undisposed `[important]` finding) at the current commit and `openspec/changes/<id>/design.md` edited and not committed, `next` answers the `commit` step naming that path, not `fix-review`; with only a review-record path uncommitted it answers as before.
- AC-4 `review-after-plan-fix-commit`: after that fix is committed, `next` answers `review` at round 2 for the reviewers whose verdict is stale, and never `fix-review` a second time for the same findings.
- AC-5 `newer-flow-refused-clearly`: `readFlowFile` on a `flow.json` whose `version` is above the newest the script reads fails with a message naming the file's version, the script's newest and the update to make, and not with "malformed ... unknown key"; when that file carries the release field the message names the release; a test pins both messages. The shipped `flow.json` files stay byte-identical to `flows/2.json`.
- AC-6 `unknown-key-still-malformed`: a `flow.json` at a known version with an unknown stage key still fails as `malformed: stage <id> has an unknown key <key>`.
- AC-7 `write-back-ask-by-number`: `write-back ask <id>` with a record for the same key and number answers `ask: false, why: asked`; with the same key and another number it answers `ask: true` and the record holds the new number; with a damaged record it answers `ask: false, why: asked`.
- AC-8 `connector-error-by-heredoc`: `reply write-back-failed --param key=<KEY> --stdin error` reads the `error` from standard input (the call form the skill uses; the planner fixes the option's literal behaviour); the devkit skill's text uses the quoted heredoc for it, and a test pins that the skill's `write-back-failed` line has no `--param error=`; a connector error holding quotes, `$(...)` and a newline reaches the reply unchanged.
- AC-9 `task-taken-in-lock`: two `open --task <KEY>` calls started together create one change; the second answers `task-taken` naming the first.
- AC-10 `blocked-ends-ask-nothing`: a test pins that a delivered pull request with a `blocked` end, and with the `waiting-budget` end, gives an action with no `writeBack`; no behaviour changes.
- AC-11 `id-prefix-spec`: `openspec/specs/jira-tasks/spec.md` states the prefix rule (lower case, `_` to `-`, runs collapsed, trailing `-` removed) with a scenario for each step, and a test pins each scenario against `taskIdPrefix`.

## Out of scope

- Committing `evidence.md` after the verify step, and the waiting-for-a-place end: `loop-place-and-evidence`.
- What a merge of main makes stale: `stale-only-on-own-files`.
- How a stage's failed attempts are counted: `evidence-attempts-by-failure`, `stage-ceiling-consecutive`.
- Teaching an already installed script (0.21.1 and the like) to read a newer `flow.json`: it cannot be changed; only scripts shipped from this release on say which release they need.
- The other `--param error=` uses in `plugins/openspec/skills/devkit/SKILL.md` (`cannot-accept`, `blocked`): their text comes from the script itself.
- Any change to the review round's verdict rules, the reviewer set or the delivery check's treatment of a marked verdict.
