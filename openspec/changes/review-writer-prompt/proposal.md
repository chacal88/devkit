<!-- devkit-stage proposal result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

Change: `review-writer-prompt` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the owner's answers). Round 25 of `openspec/roadmap.md`.

## Why

Five archived retros (`orchestrator-replan`, `flow-script-checker`, `change-coordinator`,
`coordinator-field-fixes`, `merge-setup-field-fixes`) record the same review-round frictions, and
each one was worked around by hand:

- `review-round.mjs outcomes` gives no writer prompt, although `review-change` says it does, so the
  session builds stage 3 from the exported `writerPrompt` rule.
- Stage-1 answers carried a short sha padded with zeros, a disposition with two shas, a review of one
  file out of a 54-file diff, and a `sections` text holding its own `Verdict:` and `Commit:` lines
  that the writer then pasted into the verdict file (seen again in the field on 2026-11-21).
- A commit of tests only makes every review stale, so reviewers that never read tests run again.
- `deliver-check` counts a checkbox inside a fenced example of `tasks.md` as a task, while
  `flow-check` does not.

## What Changes

- The round's `args` gain a required `head` (the full sha of `git rev-parse HEAD` in the change's
  worktree). On both paths a stage-1 answer whose `commit` is not `head`, or that lists files of its
  remit as not read (or read nothing without declining), takes today's failure path before the verify
  stage. **BREAKING** for a caller that builds `args` without `head`: the round refuses it (exit 3).
- The stage-1 answer gains the required lists `read` and `notRead`. The stage-1 prompt asks for the
  commit as `git rev-parse HEAD` prints it and for both lists, and says that a disposition names one
  sha and that `sections` holds no `Verdict:` or `Commit:` line.
- The round removes `Verdict:` and `Commit:` lines from a stage-1 `sections` text before the outcome
  is built; `check-file` refuses a verdict file with such a line after line 2.
- `review-round.mjs outcomes` prints a `jobs` list with each outcome's writer prompt; the `agents`
  path of `review-change` sends those prompts.
- `deliver-check`: a commit that touches only `openspec/` and test files leaves the reviews of
  `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` current;
  `code-quality-reviewer`, `test-coverage-reviewer` and the evidence still go stale. `flow-check`
  reports the review stage stale whenever `deliver-check` lists a stale reviewer.
- `deliver-check` skips every checkbox line inside a fenced block of `tasks.md`, with the helper
  `flow-check` uses, which moves into `deliver-check.mjs`.
- The `review-change` skill, the `ship-change` `review` row, the six reviewers' "Staged round"
  paragraph, `docs/openspec-flow.md`, and a release of devkit-core and devkit-openspec.

Non-goals: everything under "Out of scope" in `requirements.md`; the panel's own `tasks.md` reader
(it keeps counting fenced checkboxes, as it already differs from `flow-check` today: see "Flagged"
below); `guard.mjs#parseRoadmap` and `deliver-check.mjs#roadmapFacts`; a reason carried in a
review-stage `failed` entry; a writer prompt in the Workflow script's result.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `outcomes-returns-writer-jobs` — `review-round.mjs outcomes` prints a `jobs` list with one entry per outcome, each `{ reviewer, agentType: "devkit-core:<reviewer>", prompt }` whose `prompt` equals `writerPrompt(args, outcome)`; the `agents` path of `review-change` sends those prompts instead of building them by hand.
- AC-2 `stage1-prompt-one-sha` — the stage-1 prompt states that a disposition names exactly one sha (`fixed in <sha>`) or is `refuted: <evidence>`.
- AC-3 `stage1-prompt-asks-head-and-files` — the stage-1 prompt asks for `commit` as `git rev-parse HEAD` prints it and for the `read` and `notRead` lists.
- AC-4 `commit-not-head-refused` — with `args.head` set, a stage-1 answer whose `commit` differs from it (a short sha padded with zeros included) is listed in `failed` as `review stage failed: <reviewer> review` and gets no verifier job, on both the `workflow` and `agents` paths; an `args` without a 40-hex `head` is refused (exit 3).
- AC-5 `partial-review-refused` — a stage-1 answer with a non-empty `notRead`, or with an empty `read` while not declined, is listed in `failed` the same way before the verify stage; a declined answer with an empty `read` passes.
- AC-6 `writer-omits-stage1-verdict-commit` — when the stage-1 `sections` text holds a `Verdict:` or `Commit:` line, the outcome's `sections` and the writer prompt hold none, and a verdict file written from it has exactly one `Verdict:` line (line 1) and one `Commit:` line (line 2).
- AC-7 `check-file-refuses-second-verdict` — `review-round.mjs check-file` exits 2 with `review file mismatch` for a verdict file that has a `Verdict:` or `Commit:` line after line 2.
- AC-8 `test-only-commit-scoped-staleness` — after a commit that touches only test files (and `openspec/`), `deliver-check` lists only `test-coverage-reviewer` and `code-quality-reviewer` as stale and the `review` step names only them; after a commit that touches any other file outside `openspec/`, every reviewer is stale as before.
- AC-9 `deliver-check-skips-fenced-checkbox` — a checkbox line inside a fenced example of `tasks.md` is not counted as a task by `deliver-check` (neither as unticked nor as a gate), locally and on the default branch, matching `flow-check`.

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate review-writer-prompt --strict`.

## Capabilities

### New Capabilities

- `review-round`: what the review round's script asks of each reviewer, which stage-1 answers it
  accepts, what it gives the session to write the verdict files, and what `check-file` refuses.

### Modified Capabilities

- `verdict-files`: a commit of test files only leaves the reviews it does not concern current; what a
  test file is (two ADDED requirements).
- `change-stages`: the review stage is stale while the delivery checker lists a stale reviewer (one
  ADDED requirement).
- `change-delivery`: the delivery checker does not count a checkbox inside a fenced block (one ADDED
  requirement).

## Impact

- devkit-core (0.8.1 to 0.9.0): `skills/review-change/scripts/review-round.workflow.js` (the rules
  section), `review-round.mjs`, `review-round.test.mjs`, `skills/review-change/SKILL.md`, and the six
  reviewer agents' "Staged round" paragraph.
- devkit-openspec (0.18.1 to 0.19.0): `hooks/deliver-check.mjs`, `hooks/flow-check.mjs`, their tests,
  `hooks/change-loop.test.mjs` (the CI pin and the round 25 roadmap test),
  `skills/ship-change/SKILL.md` (the `review` row).
- The `devkit-reviews` check: it judges with the new staleness rule in this repository at once (its
  workflow runs the tree's `deliver-check.mjs`), and in a project once the project moves its pin to
  `v0.19.0`. The three downloaded files stay `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`.
- Docs and release: `docs/openspec-flow.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`
  (0.22.1 to 0.23.0); the tag `v0.19.0` after the merge.

**Dependencies.** `merge-setup-field-fixes` (archived 2026-11-21: the first-`Verdict:`-line rule this
change's `check-file` rule sits beside). The sibling `roadmap-coordinator-followups` also bumps
devkit-openspec; the release rebase settles the collision (`CONTRIBUTING.md`).

**Decisions cited.** ADR 0008 (decisions 1, 4 and 5: one rules section for both paths; the
`Verdict:` and `Commit:` lines keep their form); ADR 0002 and ADR 0012 decision 4 (the check still
recomputes reviews at the PR head; only which commits make a review stale changes). No new ADR
(`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None: the change touches no point of `docs/coordination-design.md`
"Open points" (the review stage keeps both paths).

**Flagged for the owner at plan approval.**

- The six reviewer agents' "Staged round" paragraph asks for "the verdict and the commit as you would
  write them" in stage 1, which is where the pasted `Verdict:` line comes from. The plan rewrites that
  sentence (`design.md` D-5). It is not named in `requirements.md`, so the owner may drop task 1.5.
- The panel (`plugins/panel/hooks/steps.ts`) still counts a fenced checkbox. Making it match is a
  devkit-panel change outside this request; it would be a new roadmap line.
