<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `commit-attribution` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the owner's delegated answers). Round 27 of `openspec/roadmap.md`
(managed-agents-study retro, item 2).

## Why

`devkit-core:commit-and-pr` runs on `model: sonnet`, and its definition tells it to add "the
attribution/co-author lines the environment or the user requires". Its own environment hands it a
Sonnet trailer, so a commit made for a change names the commit agent's model instead of the model of
the session that did the work (seen in `release-rebase-pin`, commit 127097d). The loops cannot fix
this alone: the lines come from the host to the conducting session, and `change-loop.mjs` and
`project-loop.mjs` are scripts that read files and call no AI (ADR 0010, decision 3).

## What Changes

- Every hand-off to `devkit-core:commit-and-pr` that `change-loop.mjs` prints (the steps `commit`,
  `open-pr`, `push`, `open-archive-pr` and `push-rebased`) and that `project-loop.mjs` prints (its
  `commit`, `open-pr` and `push` hand-offs) ends with one fixed request: the session handing it off
  appends its own commit trailer and pull-request footer below the brief, verbatim, as an
  attribution block, or says it has none. One shared helper, keyed on the agent the action names,
  adds the request; no other hand-off carries it. `roadmap-loop.mjs` passes the change loop's briefs
  through unchanged, so a roadmap run carries it too.
- `plugins/openspec/skills/ship-change/SKILL.md` gains an Attribution section that defines the block
  and says where the session takes its lines; the `commit`, `open-pr`/`push` and `open-archive-pr`
  rows append it. `plugins/openspec/skills/devkit/SKILL.md` appends it in the `agent` kind of its
  Loop, the `push-rebased` item, the roadmap's `agent` item and the project loop's `agent` item.
- `plugins/core/agents/commit-and-pr.md`: the caller's attribution block wins over the agent's own
  environment. Given lines, it writes exactly those and no other `Co-Authored-By` line, attribution
  trailer or footer; given `none`, it writes none; given no block (an older caller), today's
  behaviour stays.
- `docs/openspec-flow.md` says so in one paragraph; a release of devkit-core and devkit-openspec.

Non-goals: everything under "Out of scope" in `requirements.md` (the trailers already on `main`, the
agent's `model: sonnet`, any agent other than the commit agent); a hook that refuses a commit-agent
hand-off without the block (a new lock, not asked for); the CompozyOS loop and the schemas' `apply`
instruction, which name the role but print no brief; `conduct-check.mjs`, whose child-session brief
served the retired `/conduct`.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `brief-carries-lines` — every hand-off to `devkit-core:commit-and-pr` that `change-loop.mjs` and `project-loop.mjs` print, and every dispatch row of `ship-change` and `devkit` that names that agent, tells the conducting session to add its own commit trailer and pull-request footer to the brief, verbatim; a test fails when one hand-off lacks it.
- AC-2 `agent-prefers-brief` — `plugins/core/agents/commit-and-pr.md` says the brief's attribution lines win over its own environment's: given lines, it writes exactly those and no other `Co-Authored-By` line or footer; given "none", it writes none.
- AC-3 `scratch-run-names-session-model` — one real run of the commit agent in a scratch git project, with a brief that carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, makes a commit whose `git log -1 --format='%(trailers)'` shows exactly that line and no Sonnet line; the output is recorded in `evidence.md`.
- AC-4 `this-change-commits-name-session` — every commit of this change's branch made by the commit agent ends with the conducting session's trailer (passed by hand while the installed loop is the older one).

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `command claude plugin validate .` and
`openspec validate commit-attribution --strict`.

## Capabilities

### New Capabilities

- `commit-attribution`: which attribution lines a commit and a pull request made for a change carry,
  how the loops ask the conducting session for them, how the session passes them, and what the
  commit agent writes with them, without them, and when told there are none.

### Modified Capabilities

None. `change-coordination` ("The hand-off names the role, the change and the stage") and
`project-definition` ("The slice ends in one pull request") stay true as written: the brief still
names the change, the stage, the worktree, the branch and the files' language, and holds no skill
line.

## Impact

- devkit-openspec: `hooks/change-loop.mjs` (the helper and the change loop's `agent` builder),
  `hooks/project-loop.mjs` (its `agent` builder), `hooks/change-loop.test.mjs`,
  `hooks/project-loop.test.mjs`, `hooks/deliver-check.test.mjs`, `skills/ship-change/SKILL.md`,
  `skills/devkit/SKILL.md`.
- devkit-core: `agents/commit-and-pr.md` (its `description` stays, so `docs/catalog.md` does not
  change).
- Docs and release: `docs/openspec-flow.md`, `CHANGELOG.md`, both packs' `plugin.json`,
  `.claude-plugin/marketplace.json`, and the CI pin of `docs/openspec-flow.md` with its assertion in
  `change-loop.test.mjs`.
- The `devkit-reviews` check: unchanged (it reads no brief and no attribution line).

**Dependencies.** `review-writer-prompt` (archived, c561553) is the base. Sibling changes edit the same
hooks and release files; versions are resolved against `origin/main` when the branch merges `main`
(`CONTRIBUTING.md`, step 5).

**Decisions cited.** ADR 0010 (decision 3: the loop calls no AI, so it cannot read the session's
lines; decision 5: hooks veto and do not drive, which rules out a hook that rewrites the message);
ADR 0011 (the change coordinator is the session the owner typed in, so its lines are the session's);
ADR 0013 and ADR 0014 (in a roadmap run the session that hands the stage is the one whose lines are
appended); ADR 0015 (the slice's commits and pull request are handed to the commit agent); ADR 0002
(the commit agent never merges, unchanged). No new ADR (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None: no point of `docs/coordination-design.md` "Open points" is touched.
