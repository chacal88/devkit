# Proposal

Change: `ship-modes` · Date: 2026-11-08 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · PRD / tech spec: n/a · Roadmap: round 1 of `openspec/roadmap.md`

## Why

Today every change stops at each phase gate and at the PR, and the owner has to type the go-ahead, open the PR and push each step by hand. The owner wants an opt-in mode where, once the plan is approved, the flow runs on its own up to a PR that is verifiably ready, using Claude's own subagents and files on disk, without bringing back a coordinator process.

## What Changes

- **`ship` key in `openspec/config.yaml`** (optional, top level): a map from schema name to mode, `plan` or `pr`. Missing key or missing schema entry means `plan`, which is exactly today's flow. `merge` is reserved and rejected with a message naming the later round (round 2, `auto-merge`). Both block (`ship:\n  devkit: pr`) and flow (`ship: { devkit-lite: pr }`) YAML forms are read.
- **Delivery contract checker** `plugins/openspec/hooks/deliver-check.mjs` (Node, no dependencies): `deliver-check <change-id> [--json] [--watch[=<minutes>]]` computes the eight "ready PR" items from the change folder, git and `gh`, prints each as `met`, `open` or `blocked` with its reason, and names the next step. Exit 0 only at 8/8.
- **New skill `ship-change`** in `plugins/openspec/skills/`: after the owner's plan approval, it drives one change to a ready PR by repeatedly running `deliver-check`, executing only the step it names, and dispatching existing devkit-core agents as subagents (`tdd-implementer` per phase, `review-change`, `pr-verifier`, `commit-and-pr`). It stops with a reason on a red gate, a stale plan, a round-2 review failure or a blocked item, and re-running it resumes from disk.
- **devkit-core agent formats** (all modes):
  - the six reviewers write a `Commit: <sha>` line under their verdict line, and re-list previous blocking/important findings with a disposition (`fixed in <sha>` or `refuted: <evidence>`);
  - `pr-verifier` writes a `Commit:` line and a parseable gates/criteria table in `evidence.md`;
  - `commit-and-pr` gains a commit-only call (no PR yet), pushes to an existing PR instead of creating a second one, and puts the change id, the acceptance criteria and the `evidence.md` link in the PR body. It still never merges;
  - `tdd-implementer` reports its gate output instead of writing `evidence.md` (which only `pr-verifier` may write), and accepts the go-ahead from a coordinating skill;
  - `review-change` documents the disposition format and re-runs only reviewers whose `Commit:` is stale.
- **ADR** `docs/adr/0001-coordination-without-a-harness.md` (new `docs/adr/` folder): coordination yes, harness no. `README.md` "Why no harness" cites it; the `ADRs: none` line in `openspec/config.yaml` `context` points at `docs/adr/`.
- **Docs and release**: `docs/openspec-flow.md` (ship modes, the contract, the skill), `plugins/openspec/README.md`, regenerated catalog, devkit-openspec 0.3.0 → 0.4.0 and devkit-core 0.2.0 → 0.3.0, CHANGELOG entry.

Non-goals (from requirements.md, Out of scope): the `merge` mode, `gh pr merge --auto`, the `devkit-reviews` CI check and `openspec-setup` configuring GitHub (round 2); the post-merge archive Action and ruleset bypass (round 3); the multi-change `conduct` skill (round 4); starting app sessions from the flow, a side panel, any state outside the repo and GitHub; parallel phases. The `guard.mjs` gates (`edit`, `bash`, `session`, `ci`) keep today's behavior.

## Acceptance criteria

- AC-1: With no `ship` key in `openspec/config.yaml`, applying a change stops at every phase gate and at the PR exactly as today.
- AC-2: With `ship: { devkit-lite: pr }` and an approved plan, one invocation of the skill on a `devkit-lite` change runs every phase, the reviews, the evidence and opens the PR without the owner typing anything in between.
- AC-3: With `ship: { devkit: pr }`, the skill refuses to start a `devkit` change whose `readiness.md` is not `- Status: APPROVED`, and says so.
- AC-4: A red phase gate, a stale-plan failure from `tdd-implementer`, or a reviewer failing in round 2 stops the run with a message naming the step and the reason; no later step runs.
- AC-5: Killing the session mid-run and invoking the skill again resumes at the first unfinished step, without redoing finished phases or reviews.
- AC-6: `deliver-check <change-id>` prints the eight items, each met, open or blocked with its reason, and `--json` prints the same as JSON; it exits 0 only when all eight are met.
- AC-7: A commit to product code after the reviews makes item 2 open, and the skill re-runs only the reviewers whose verdict carries the old SHA.
- AC-8: The skill reports "ready" only when `deliver-check` reports 8/8; any open item is reported as "in progress" or "blocked: item N".
- AC-9: A red CI on the PR, while the skill runs in the app with Auto-fix on, ends with the fix committed by `tdd-implementer`, the affected reviews re-run and the contract checked again; outside the app, one capped `gh pr checks --watch` ends in either 8/8 or "in progress: item 6".
- AC-10: `ship: { devkit-lite: merge }` is rejected with a message saying `merge` arrives in a later round; nothing merges.
- AC-11: `docs/adr/0001-coordination-without-a-harness.md` exists, `README.md` cites it, and `openspec/config.yaml` `context` names `docs/adr/` as the ADR folder.
- AC-12: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`) passes, with tests covering `deliver-check` and the `ship` config parsing.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedent: archive/2026-11-08-roadmap-rounds). skip_specs: true. See design.md, "No spec delta". -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): new `hooks/deliver-check.mjs` and `hooks/deliver-check.test.mjs`; `hooks/guard.mjs` gets a run-only-as-main guard and a few more exports, no gate behavior change; `hooks/guard.test.mjs` imports the new tests; new `skills/ship-change/SKILL.md`; `README.md`; `.claude-plugin/plugin.json`.
- **devkit-core** (`plugins/core/`): `agents/{code-quality,test-coverage,security,architecture,adr,spec}-reviewer.md`, `agents/pr-verifier.md`, `agents/commit-and-pr.md`, `agents/tdd-implementer.md`, `skills/review-change/SKILL.md`; `.claude-plugin/plugin.json`.
- **Repo docs and config**: new `docs/adr/0001-coordination-without-a-harness.md`; `README.md`; `docs/openspec-flow.md`; `docs/catalog.md` (regenerated); `openspec/config.yaml` (`context` ADR line only; no `ship` key is added here); `.claude-plugin/marketplace.json`; `CHANGELOG.md`.
- **Dependencies**: OpenSpec CLI 1.16 (tolerates the extra `ship` key, checked on 1.16.1), `git`, `gh` (only for items 5 to 8 and the watch), Node 22 (CI). No new packages.
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`, `openspec validate ship-modes --strict`.
- **Decisions cited**: none recorded before this change (`ADRs: none`); this change records ADR 0001. **Open decisions inherited**: none for this round; round 3's ruleset-bypass assumption stays unverified (requirements.md, Escalations).
