<!-- devkit-stage proposal result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Proposal

Change: `jira-entry-followups` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, confirmed by the owner; `decisions.md`: no record needed).

## Why

The `jira-entry` retro found three defects in the loop and five open nits of its review. A review
round run with only `evidence.md` dirty stamped `(uncommitted changes)` on every verdict, so the
delivery check read them all as stale and the round had to run again. A fix that touched only the
change folder never reached `commit`, so `next` answered `fix-review` again and round 2 was run by
hand. And an installed loop older than a `flow.json` called it "malformed" instead of naming the
release it needs. The fixes are small and live in scripts every change runs, so they ship together
now.

## What Changes

- **The review round's `Commit:` marker follows git.** The round no longer takes the
  `uncommitted` flag from each reviewer. `review-round.mjs tree` reads the worktree once (the head
  and the uncommitted paths outside `openspec/`, by the rule `deliver-check` uses), the caller
  passes them as `args.head` and `args.dirty`, and every verdict's line 2 carries
  ` (uncommitted changes)` exactly when `args.dirty` is not empty. The stage-1 answer loses its
  `uncommitted` key (**BREAKING** for a caller that builds `args` by hand: `args.dirty` is now
  required).
- **A plan fix reaches `commit`.** With a rejected verdict, or an approved one that still lists an
  undisposed `[blocking]` or `[important]` finding, at the current commit, and uncommitted files in
  the change folder other than its review record, `next` answers `commit` naming those files, not
  `fix-review`. Once committed, such a verdict is stale and `next` answers `review` (round 2 after
  a rejecting round). An approved verdict with an undisposed finding now follows the rejected
  verdict's staleness rule.
- **A newer `flow.json` is refused clearly.** The flow reader checks the file's `version` against
  the newest version it knows for that script before anything else, and refuses a newer one with
  one message naming the file's version, the newest it reads and the update to make (update
  devkit-openspec and restart the session). When the file carries the optional top-level
  `readerRelease` field, the message names that release too. The reader only: the shipped
  `flow.json` files do not change and stay byte-identical to their released `flows/2.json` (the
  owner's answer, 2026-11-23); the field enters with the next flow change, which raises the version
  anyway.
- **The review's open nits.** `write-back ask` treats a record for another pull request number as
  not asked; the devkit skill passes a connector error to `reply write-back-failed` on standard
  input (new `--stdin <name>` option of `reply`); the `task-taken` check of `open --task` runs
  inside the open lock; a test pins that a blocked end asks no write-back question; the
  `jira-tasks` spec states how the change id's prefix comes from the key.
- Docs (`docs/openspec-flow.md`, the `review-change` and `ship-change` skills) and a release of
  devkit-openspec, devkit-core and the marketplace.

Non-goals: everything under "Out of scope" in `requirements.md`. In particular, no change to the
verdict rules of the round, the reviewer set or how the checker treats a marked verdict; no commit
of `evidence.md` by the loop and no new end (`loop-place-and-evidence`); no change to what a merge
of main stales (`stale-only-on-own-files`); no change to attempt counting; no change to an already
installed script; no change to the other `--param error=` uses of the devkit skill.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

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

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate jira-entry-followups --strict`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `verdict-files`: the scenario "A plan fix not committed yet" now gives `commit` as the next step
  (the verdict stays current); new scenarios for the commit of a plan fix and for a record-only
  edit; an approved verdict that lists an undisposed finding follows the rejected verdict's rule
  (the test-file requirement says so).
- `review-round`: a verdict's `Commit:` marker is decided by the round from git, not by the
  reviewer.
- `jira-tasks`: the change id's prefix rule; the write-back question asked again for another pull
  request number; the connector's error reaching the reply as it is; two openings for one key at
  once.
- `change-stages`: the flow reader refuses a `flow.json` newer than it knows, with the update to
  make and, when the file names it, the release that reads it; an unknown key at a known version
  stays malformed; the shipped flows stay as released.

## Impact

- devkit-openspec: `hooks/deliver-check.mjs` (`collectState`, `nextStep`, `readReviews`,
  `verdictAllowed`, `findingsIn`), `hooks/guard.mjs` (`readFlowFile`, new `FLOW_VERSIONS`),
  `hooks/change-loop.mjs` (`writeBackAsk`, `runReply`, `openChange`, `openCheckout`,
  `openUnderLock`, `USAGE`, `isMain`), `skills/devkit/SKILL.md`, `skills/ship-change/SKILL.md`, and the tests
  `deliver-check.test.mjs`, `change-loop.test.mjs`, `jira-task.test.mjs`, `version-pin.test.mjs`,
  `flow-check.test.mjs`, `roadmap-loop.test.mjs` (two tests rewritten in task 3.1) as each task
  names.
- devkit-core: `skills/review-change/scripts/review-round.workflow.js`,
  `skills/review-change/scripts/review-round.mjs` (new `tree` subcommand),
  `skills/review-change/SKILL.md`, `review-round.test.mjs`.
- Unchanged on purpose: every `flow.json` and `flows/<n>.json` of both schema copies, and
  `scripts/released-flows.json` (a test pins `flow.json` to `flows/2.json`).
- Repository: `docs/openspec-flow.md`, `CONTRIBUTING.md` (raising a flow version), `CHANGELOG.md`, both `plugin.json` files, `.claude-plugin/marketplace.json`, the catalog files `scripts/gen-catalog.py` writes.
  Version numbers are taken at the last merge of main.

**Dependencies.** `jira-entry` (archived 2026-11-23: `write-back`, `open --task`, `taskIdPrefix`),
`review-openspec-fix` (archived 2026-11-23: the review record and `verdictAllowed`),
`change-version-pin` (archived 2026-11-23: flow versions, `flows/<n>.json`, released digests),
`review-writer-prompt` (archived 2026-11-22: `args.head`). Sibling lines `stale-only-on-own-files`
and `loop-place-and-evidence` touch `deliver-check.mjs` in other functions; whichever merges
second merges main.

**Decisions cited.** ADR 0008 (decision 3: the Workflow script gets everything through its
arguments, which `args.dirty` follows; decision 4: the `Commit:` line stays). ADR 0012 (the
`devkit-reviews` check follows the change's script; it keeps reading the verdicts as before).
ADR 0017 (the state is derived in one place: the new `commit` row is in `nextStep`). No new ADR
(`decisions.md`).

**Open decisions inherited.** None.

**Flagged for the owner at plan approval (a decision the approval accepts).**

- The rule "once committed the verdict is stale" for an approved verdict with an undisposed
  finding extends the rejected verdict's staleness rule to that verdict (`verdict-files` delta).
  Such a verdict comes back at round 1 when `review.md` says `PASS`, as today's round rule gives.
- AC-8's call form carries an explicit option: `reply write-back-failed --param key=<KEY> --stdin
  error` reads the error from standard input only because `--stdin error` asks it to; a `reply`
  without the option reads no standard input (D-5 gives the reason).
