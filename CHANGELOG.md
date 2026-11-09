# Changelog

## 0.6.0 — archive after merge

- **devkit-openspec**: after a change PR merges, `deliver-check` and `ship-change` go on to the archive steps (`retro`, `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, `archive-pr-ready`, `stop-archive`, `archived`): the owner answers each retro proposal, and the archive lands through a PR on `chore/archive-<id>` that GitHub auto-merges in `merge` mode (a file the owner did not approve stops the run). The guard hooks and `--ci` never select another change from an archive branch, so the archive PR passes `devkit-reviews`. In `pr` mode a merged PR now leads to the archive steps instead of `blocked: item 5`, and `merged` is no longer a final `next.step`.
- **devkit-core**: `retro` writes proposals in a format `deliver-check` reads (exact paths, `None.`, `Answer:` and `Applied:` lines); `commit-and-pr` gains the archive call; `tdd-implementer` gains the apply-proposals call.
- Docs: ADR 0003 records auto-merging the archive PR without 8/8, ADR 0002 notes round 3 has no bypass; the CI snippet pins `v0.6.0`.

## 0.5.1 — auto-merge retro

- **devkit-core**: `adr-reviewer` cites ADRs by repo-root path in backticks instead of relative links, which broke when a change folder was archived.
- Docs: ADR 0002 notes that GitHub records an auto-merge under the identity that enabled it; CONTRIBUTING asks to amend `design.md` when a readiness note is resolved differently.

## 0.5.0 — auto-merge

- **devkit-openspec**: new `merge` ship mode (with `merge_method`): at 8/8 `ship-change` enables GitHub auto-merge pinned to the checked head and disables it when the contract drops; `deliver-check` gains the merge steps and a `--ci` mode (the `devkit-reviews` check); new `merge-setup.mjs`, the `devkit-reviews` workflow template and the read-only-by-default `github-setup.mjs` in `openspec-setup`. `guard.mjs ci` now runs the same stale-aware check: it needs `deliver-check.mjs` beside it, the full history and the PR head checked out.
- **devkit-core**: `commit-and-pr`, `review-change` and the README say the merge is the owner's, or GitHub's in `merge` ship mode; `commit-and-pr` itself still never merges.
- Docs: ADR 0002 records merging without the owner by opt-in; the CI snippet and workflow template pin `v0.5.0`.

## 0.4.0 — ship modes

- **devkit-openspec**: new `ship-change` skill drives one approved change to a ready PR from your own session, configured by an optional `ship` key in `openspec/config.yaml`; new `deliver-check` module (JSON contract) computes the next step from the repository and GitHub; `guard.mjs` exports its checks for reuse.
- **devkit-core**: reviewers, `pr-verifier`, `commit-and-pr`, `tdd-implementer` and `review-change` gain the output formats (`Commit:` line, gates table, commit-only mode) that `deliver-check` parses.
- Docs: ADR 0001 records why coordination is allowed but a harness is not; the CI snippet pins `v0.4.0`.

## 0.3.0 — rounds without an orchestrator

- **devkit-openspec**: optional `openspec/roadmap.md` groups changes into rounds (`## ` headings, `- [ ] <change-id> (after: ...)` lines). The session hook prints the current round, `done/total` and each pending change's state (`not started`, `open`, `waiting on ...`, `archived, tick it`), with or without an active change. It reports only; no gate reads it. The setup template's archive guidance now ticks the line.

## 0.2.0 — lighter by default

A full-flow run on a one-function change took over an hour, mostly in review loops on Opus with mutation testing. Now:

- **devkit-openspec**: `devkit-lite` is the default schema in the project template and accepts an optional spec delta; the full `devkit` flow is for new capabilities, contract or data-model changes, sensitive areas, hard-to-revert or ambiguous changes. Full-flow tasks use as few phases as the work needs. The hooks follow `cd` inside a command and skip paths built from variables, fixing two false positives.
- **devkit-core**: reviewers and `plan-readiness-reviewer` run on Sonnet. Every reviewer has a Budget section (depth scaled to the diff, test suite at most once, re-review limited to previous findings). `test-coverage-reviewer` reads tests to judge seams and runs mutations only on request. `review-change` re-runs only reviewers that rejected, and `nit`s never trigger a round.

## 0.1.0 — first release

- **devkit-core**: 13 agents (`codebase-researcher`, `change-planner`, `plan-reality-auditor`, `plan-readiness-reviewer`, `tdd-implementer`, six reviewers, `pr-verifier`, `commit-and-pr`) and 8 skills (`requirements-grill`, `plan-readiness-review`, `review-change`, `test-and-coverage`, `test-driven-development`, `systematic-debugging`, `commit-message-guidelines`, `retro`).
- **devkit-openspec**: `devkit` and `devkit-lite` schemas for OpenSpec 1.16; hooks that give each gate file one writer (by subagent type), gate product code on an independently approved readiness and on the `tdd-implementer` agent, gate `gh pr create` on approved reviews plus evidence, and refuse destructive git; a `ci` mode for the same gates in CI; `openspec-setup` skill; `openspec-validator` agent.
- **devkit-design**: four DDD design phases plus `ddd-strategic-design`.
- **devkit-stack**: `postgres`, `neon-postgres`, `react-performance`, `vitest`, `saas-multi-tenant`, `threat-model`.
- **devkit-ai-engineering**: `llm-evaluation`, `multi-agent-patterns`, `agent-tool-design`, `agent-friendly-cli`, `context-compression`, `skill-scanner`.
