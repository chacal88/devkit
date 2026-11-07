# Changelog

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
