# Proposal

Change: `review-workflow` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(requirements.md holds the grill; roadmap round 9)

## Why

The reviewer round is the costliest step of a change, and a finding is trusted as soon as a reviewer
writes it. A false `[blocking]` or `[important]` costs a fix round, and nobody checks it first. Today
the round runs as one foreground `Agent` call per reviewer from the session, so every verdict lands
in the session's context. The release-rebase-pin retro (item e) adds a checker gap: an `approved`
verdict with an undisposed `[important]` gives `next.step: "review"`. That is a re-review, and it
cannot close the finding. The Workflow tool can run the whole round (reviewers in parallel, then
verification, then the verdict files) as one background script inside the session. That breaks
ADR 0001's "never through a harness" unless an exception is recorded first.

## What Changes

- `review-change` (devkit-core) runs the round in three stages: **review**, **verify** and
  **write**.
  - Review: every reviewer of the bench (the matrix, or the caller's scoped list) runs in parallel
    as its own `devkit-core:<reviewer>` agent type and returns its findings without writing a file.
  - Verify: each open `[blocking]` / `[important]` finding goes to 3 independent verifiers, each
    prompted to refute it. It is refuted when at least 2 refute it with evidence. `nit` and `praise`
    are never verified.
  - Write: the same reviewer agent type writes `reviews/<reviewer>.md`. Survivors stay open, and
    refuted findings carry ` · refuted: <evidence>`.
- Two paths, with the same stages and the same files:
  - `workflow`: one Workflow script, `plugins/core/skills/review-change/scripts/review-round.workflow.js`,
    passed by `scriptPath`. It runs on a turn the owner typed, when the tool is offered.
  - `agents`: the Agent tool, on every other turn, on a host without the tool, when the tool
    refuses or errors, when its result is missing or malformed, or when its completion notice never
    comes (the round is lost; design D6).
  - The rules and prompts live once, in the script's rules section. A CLI (`review-round.mjs`)
    exposes them to the `agents` path, and one test set covers them.
- `review.md` is still written by the session. It gains the path, and each reviewer's verified and
  refuted counts. Its `Consensus: PASS | FAIL (round N/2)` line keeps its form.
- A new read-only agent, `devkit-core:finding-verifier` (no Write tool). The six reviewer agents
  gain a short "staged round" paragraph: return findings in stage 1, write the file in stage 3.
- `deliver-check` (devkit-openspec): an approved review that is current and still has an undisposed
  `[blocking]` / `[important]` finding gives `next.step: "fix-review"` with that finding in
  `next.findings`, no longer `review`. The eight items and their met/open rules do not change.
- The `review` rows of `ship-change` and `conduct` name the Workflow tool and its fallback, and say
  the change is busy until the round's completion notice, or until `review-change` declares the
  round lost and re-runs it on the `agents` path.
- ADR 0008 `docs/adr/0008-reviews-as-a-workflow.md` records the exception to ADR 0001. ADR 0001's
  Note, `openspec/config.yaml` and the README point to it.
- Release: devkit-core 0.5.3 → 0.6.0, devkit-openspec 0.11.0 → 0.12.0, marketplace 0.12.0 → 0.13.0,
  CHANGELOG `## 0.13.0 — reviews as a workflow`, CI pin `v0.12.0`.

Non-goals (requirements.md, Out of scope): the eight items of the delivery contract; the first two
lines of `reviews/<reviewer>.md`; the guard's writer rules; the review matrix; new reviewer types;
the conduct-skill follow-ups of the release-rebase-pin retro; the panel; the commit-and-pr trailer.
The Workflow tool is used for this round only, nowhere else.

## Acceptance criteria

- AC-1: `review-change` starts every reviewer of the bench (the matrix's, or a scoped list) in parallel, each as its own `devkit-core:<reviewer>` agent type, on both paths. Under the test harness with recording stubs, the Workflow script `review-round.workflow.js` makes every reviewer's `agent()` call, with `agentType: 'devkit-core:<reviewer>'`, before any of them returns; the skill's `agents` path sends one `Agent` call per reviewer (`subagent_type: devkit-core:<reviewer>`) in one message. The skill takes the `workflow` path only on a turn the owner typed with the tool offered, and runs the whole round on the `agents` path when the Workflow call is refused or errors, when its result is missing or not the shape the script returns, or when its completion notice never comes (the round is lost). A live Workflow run is not part of this criterion: it is the dogfood of the next change.
- AC-2: In the script under the harness and in the CLI's `verify` / `outcomes` chain, every `[blocking]` and `[important]` finding a reviewer returns without a disposition gets exactly 3 `devkit-core:finding-verifier` jobs, each prompted to refute it and shown no other finding, vote or verdict; it is refuted when at least 2 of the 3 refute it with non-empty evidence; `nit` and `praise` findings, and findings already marked `fixed in` or `refuted:`, get no verifier.
- AC-3: Stage 3 hands each `reviews/<reviewer>.md` to that reviewer's own agent type: the harness records `agentType: 'devkit-core:<reviewer>'` on every writer call, and the `agents` path uses the same `subagent_type`. The writer's prompt holds the `Commit: <sha>` line and every finding line verbatim (survivors open with their severity, refuted ones with ` · refuted: <evidence>`) and suggests no verdict; the round's outcome is `approved` only when no `[blocking]` or `[important]` finding stays open. `check-file` accepts a file only when line 1 is `Verdict: <that outcome>`, line 2 is the commit line and every blocking/important line is present, and exits 2 otherwise; the session never writes a verdict file. That the guard accepts a write by a Workflow agent is checked in the dogfood of the next change.
- AC-4: `review.md` consolidates the round: each reviewer's verdict, how many findings were verified and how many refuted, the consensus, the round number, and the path that ran (`workflow` or `agents`).
- AC-5: Where the Workflow tool is unavailable or not opted in (an automated turn), the session runs the same stages with the Agent tool, and the files meet AC-3 and AC-4 with path `agents`.
- AC-6: `deliver-check` gives `next.step: "fix-review"`, with the finding in `next.findings`, for an approved verdict that has an undisposed `[important]` or `[blocking]` finding (a test pins it), and the existing delivery-contract tests stay green.
- AC-7: `docs/adr/0008-*.md` records the exception to ADR 0001 (scope: the reviewer round only, inside the session, no state outside the repository and GitHub, gates unchanged), ADR 0001's Note points to it, and `openspec/config.yaml` lists it.
- AC-8: The `review-change`, `ship-change` and `conduct` skills and `docs/openspec-flow.md` describe the new round and its fallback; devkit-core and devkit-openspec are bumped with a CHANGELOG entry and the CI pin follows; `node --test plugins/openspec/hooks/guard.test.mjs` and `python3 scripts/check.py` are green.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs. This repository keeps no
`openspec/specs/` and pins behaviour with tests, and every archived change set `skip_specs: true`,
so this one does too (`.openspec.yaml`). The acceptance criteria above are the behaviour. The
contract (`flags=[contract]`) has three parts:

- the files of the round (`reviews/<reviewer>.md` lines 1-2 and its disposition forms, which do not
  change, and `review.md`'s `Consensus:` line, which `deliver-check` reads);
- `next.step` / `next.findings` of `deliver-check --json`, where one input moves from `review` to
  `fix-review`;
- the new CLI `review-round.mjs` (subcommands, exit codes, error prefixes; design D15).

### Modified Capabilities

None.

## Impact

- devkit-core:
  - `skills/review-change/SKILL.md` (Process steps 4-6, Output, Never);
  - new `skills/review-change/scripts/` (`review-round.workflow.js`, `review-round.mjs`,
    `review-round.test.mjs`);
  - new `agents/finding-verifier.md`;
  - the "Verdict file" section of the six `agents/*-reviewer.md`;
  - `README.md` (the Review row; the catalog through `gen-catalog.py`).
- devkit-openspec:
  - `hooks/deliver-check.mjs` (`nextStep`) and `deliver-check.test.mjs`;
  - `hooks/guard.test.mjs` (imports the new test file; the ADR 0008 test);
  - the `review` and `fix-review` rows of `skills/ship-change/SKILL.md`;
  - Delivery row 5 of `skills/conduct/SKILL.md`.
- Docs and release:
  - `docs/openspec-flow.md` (a new "The review round" section, the gates row, Cost, Limits, a
    troubleshooting row, the pin);
  - `docs/adr/0008-reviews-as-a-workflow.md` (new) and the Note of ADR 0001;
  - `openspec/config.yaml` (the ADR list), `README.md`, `docs/catalog.md`;
  - both `plugin.json` files, `.claude-plugin/marketplace.json` and `CHANGELOG.md`.
- Other projects: they get the Workflow path after `claude plugin update`. A host without the tool,
  or any automated turn, runs the `agents` path. The CLI needs `node`, which the devkit-openspec
  hooks already require.
- Dependencies: the Claude Code Workflow tool (optional at run time, never needed by tests). No new
  package.
- Exit criteria, all green at the PR head:
  - `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`;
  - `python3 scripts/gen-catalog.py --check`;
  - the desktop app's bundled
    `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate .`;
  - `openspec validate review-workflow --strict`.
- What the exit criteria prove for AC-1 to AC-3: the rules, harness, CLI and text tests of tasks
  1.1-1.3, 2.2 and 2.3 (run by gate 2.8) and the real-input smoke of task 2.6. `evidence.md` cites
  those for AC-1 to AC-3. A live Workflow run is not an exit criterion of this change: it is the
  dogfood of the next change (tasks.md, Workflow follow-up), recorded in this change's retro.
- Decisions cited:
  - ADR 0001: the exception this change records, as ADR 0008.
  - ADR 0006: reviews stay with the conducting session, as subagents.
  - ADR 0002: the `devkit-reviews` CI check is unchanged.
  - ADR 0004: the hooks act only in opted-in projects.
  - One new ADR, 0008.
- Open decisions inherited: none (the repository keeps no open-decisions log).
