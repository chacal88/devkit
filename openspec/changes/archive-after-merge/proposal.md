# Proposal

Change: `archive-after-merge` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · PRD / tech spec: n/a · Roadmap: round 3 of `openspec/roadmap.md`

## Why

Rounds 1 and 2 take an approved change to a merged PR without the owner in between, but the run ends at `merged`. Archiving is still manual: the owner runs the retro, applies its proposals, runs `openspec archive`, ticks the roadmap and opens the archive PR by hand (PRs #2, #4 and #6). Since round 2 the `devkit` ruleset refuses direct pushes to `main`, so that manual archive is a PR too, and ADR 0002 expected a bypass that the owner has now ruled out.

## What Changes

- **`deliver-check` after the merge** (`pr` and `merge` modes): once the change PR is merged, the next step is no longer `merged`. It names the archive steps, recomputed on every run from the working tree, the default branch as GitHub sees it, and the archive PR: `retro`, `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, then the existing `update-branch` / `enable-auto-merge` / `disable-auto-merge` / `wait-merge` on the archive PR (`merge` mode) or `archive-pr-ready` (`pr` mode), and finally `archived`. A failing archive step is `stop-archive`, naming the step and the reason. `deliver-check <id>` accepts an archived change, so it can report `archived` at all.
- **The archive branch rule**: the archive PR's branch is `chore/archive-<id>`. The hooks and the `devkit-reviews` CI check never select a different active change from that branch name, so an archive PR passes `devkit-reviews` with its "nothing to check" note even while other changes are open.
- **The owner's answers are recorded** in the change's `retro.md` (`- Answer: approved` / `- Answer: rejected: <reason>` under each proposal, `- Applied: yes` once applied). A resumed run reads them and does not ask again. Only approved proposals are applied. Before the archive PR opens, `deliver-check` stops if the branch changes a file outside `openspec/` that no approved proposal names.
- **`ship-change`**: runs those steps, stops for the owner's answers, waits once (capped) for the archive PR in `merge` mode, and reports `archived`, `archive PR open: waiting for <what>`, `archive PR ready`, `archive: waiting for the owner's answers` or `blocked: archive (<step>): <reason>`.
- **devkit-core formats**: `retro` names each proposal's target as repo paths and leaves room for the answer lines. `commit-and-pr` gets an archive call (title `chore(openspec): archive <id> with its retro`, no review precondition). `tdd-implementer` gets an "apply approved retro proposals" call.
- **ADR 0003** `docs/adr/0003-auto-merge-the-archive-pr.md` (new; the owner ruled it a new decision): in `merge` mode the archive PR is auto-merged without 8/8. Its gate is the owner's answer to each proposal, the file check and the required checks. It is cited where ADRs are listed (`openspec/config.yaml`, README, `docs/openspec-flow.md`, CONTRIBUTING).
- **ADR 0002 note**: archiving goes through a PR and the bypass is dropped, replacing "Accepted until round 3's bypass", plus a pointer to ADR 0003. The `devkit` ruleset keeps `bypass_actors: []`.
- **Docs and release**: `docs/openspec-flow.md` (contract, ship modes, troubleshooting), CONTRIBUTING, READMEs, `openspec/config.yaml` and template archive guidance; devkit-openspec 0.5.0 → 0.6.0, devkit-core 0.4.1 → 0.5.0, marketplace 0.6.0, CHANGELOG.
- **Dogfood**: once this change's PR merges, `ship-change` archives `archive-after-merge` itself in this repository's `merge` mode.

Non-goals (requirements.md, Out of scope): a GitHub Action or CI job that archives, commits or pushes; any ruleset bypass; applying a proposal without the owner's answer; archiving several changes at once and round 4 (`conduct-rounds`); resolving conflicts on the archive PR. Also excluded at design level: a hook that vetoes `git push` to the default branch (the ruleset is the gate, as in ADR 0002), and a new state file.

## Acceptance criteria

- AC-1: With the change PR merged and the change folder still under `openspec/changes/<id>/` on the default branch, `deliver-check <id> --json` names the first archive step (retro) as `next.step`, in both `pr` and `merge` mode.
- AC-2: `ship-change` runs the retro and then stops, showing each proposed update; no archive PR exists until the owner has answered every proposal.
- AC-3: Only the proposals the owner approved appear in the archive PR's diff; rejected ones stay recorded in `retro.md` and change no other file.
- AC-4: The archive PR moves `openspec/changes/<id>/` to `openspec/changes/archive/<date>-<id>/`, adds `retro.md`, and ticks the change's line in `openspec/roadmap.md` when it is listed.
- AC-5: In `merge` mode the archive PR has auto-merge enabled with `merge_method`; in `pr` mode it does not.
- AC-6: When the archive PR is merged, `deliver-check <id> --json` reports `archived` and `ship-change` reports `archived` as the final state.
- AC-7: A failing archive step stops the run with a message naming the step and the reason; no commit reaches `main` except through a PR.
- AC-8: The `devkit` ruleset has no bypass actors after this change, and ADR 0002 no longer says the direct-push block lasts until round 3.
- AC-9: Dogfood: this change (`archive-after-merge`) is archived by `ship-change` itself, with the retro, the owner's answers and an archive PR that GitHub merges in this repository's `merge` mode.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedents: archive/2026-11-08-roadmap-rounds, archive/2026-11-08-ship-modes, archive/2026-11-09-auto-merge). skip_specs: true. See design.md D1. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): `hooks/deliver-check.mjs` (post-merge phase, archived changes, archive PR facts, `--ci` archive branch rule), `hooks/guard.mjs` (`resolveChange` archive branch rule), tests (`deliver-check.test.mjs`, `guard.test.mjs`); `skills/ship-change/SKILL.md`; `skills/openspec-setup/templates/config.yaml`; `README.md`; `plugin.json`.
- **devkit-core** (`plugins/core/`): `skills/retro/SKILL.md`, `agents/commit-and-pr.md`, `agents/tdd-implementer.md`, `README.md`; `plugin.json`.
- **Repo**: new `docs/adr/0003-auto-merge-the-archive-pr.md`; `docs/adr/0002-merge-without-the-owner-opt-in.md` (note and pointer), `README.md`, `docs/openspec-flow.md`, `docs/catalog.md` (generated), `CONTRIBUTING.md`, `openspec/config.yaml`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`. `openspec/roadmap.md` is ticked by the dogfood's archive PR, not by this change's PR.
- **GitHub (chacal88/devkit)**: no settings change. The ruleset `devkit` (#26859494) already has `bypass_actors: []` (read 2026-11-09). The archive PR is a normal PR under it.
- **Dependencies**: OpenSpec 1.16 (`openspec archive <id> --yes` with `skip_specs`, checked on 1.16.1 in a scratch repo: exit 0, `archivedAs: <date>-<id>`), `gh` 2.88 (`api` contents, `pr list --state`, `pr merge --auto --match-head-commit`), Node 22. No new packages.
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`, `openspec validate archive-after-merge --strict`, `check` and `devkit-reviews` green on the PR; after the merge, the dogfood ends in `archived` (AC-9).
- **Decisions cited**: ADR 0001 (kept: the archive steps are recomputed from the repository and GitHub, run in the owner's session, and stop with a reason). ADR 0002 (note per AC-8 and a pointer to 0003). **New**: ADR 0003 (drafted in design.md D10; owner answer A in requirements.md). **Open decisions inherited**: none.
