# devkit

Reusable [Claude Code](https://docs.claude.com/en/docs/claude-code) agents and skills, plus a spec-driven workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) that you can enforce without a harness.

devkit is a plugin marketplace with five packs. Install it once, then enable only the packs each project needs: every installed skill's description is loaded into context on every turn, so fewer packs means a leaner agent.

| Pack | What it gives you |
|---|---|
| [**devkit-core**](plugins/core/README.md) | The development workflow, stack-agnostic: `codebase-researcher`, `requirements-grill`, `change-planner`, `plan-readiness-review`, `tdd-implementer`, `review-change` with six specialist reviewers, `pr-verifier`, `commit-and-pr`, `retro`, plus TDD and systematic debugging |
| [**devkit-openspec**](plugins/openspec/README.md) | That workflow as an OpenSpec schema, with hooks that keep product code closed until the plan is approved and refuse a PR without an approved review and evidence |
| [**devkit-design**](plugins/design/README.md) | Greenfield design in four DDD phases: business discovery, domain model, architecture (with ADRs), implementation plan |
| [**devkit-stack**](plugins/stack/README.md) | Technology references: Postgres, Neon, React performance, Vitest, multi-tenant SaaS, threat modeling |
| [**devkit-ai-engineering**](plugins/ai-engineering/README.md) | Building with LLMs: evaluation, multi-agent patterns, tool and CLI design for agents, context compression, skill vetting |

The full list, generated from the files: [docs/catalog.md](docs/catalog.md).

## Install

In Claude Code:

```text
/plugin marketplace add chacal88/devkit
/plugin install devkit-core@devkit
```

Add more packs the same way (`devkit-openspec@devkit`, `devkit-design@devkit`, `devkit-stack@devkit`, `devkit-ai-engineering@devkit`). To pin packs for everyone working on a repo, declare them in the project's `.claude/settings.json` — see [docs/getting-started.md](docs/getting-started.md#share-with-a-team).

## The workflow in one picture

```text
requirements-grill ─▶ change-planner ─▶ plan-readiness-reviewer ──[APPROVED]──▶ tdd-implementer (per phase)
                                                                                          │
                       retro ◀── commit-and-pr ◀── pr-verifier ◀── review-change ◀──────┘
```

Each step works on its own: ask Claude to "review this diff" or "is this plan ready?" and the matching asset picks it up. With **devkit-openspec**, the same path becomes an OpenSpec schema: `openspec status` always tells you the next step, and the hooks block skipping the gates. See [docs/openspec-flow.md](docs/openspec-flow.md).

## Why no harness

Earlier attempts orchestrated changes with a coordinator session driving a state machine. It worked, but it was slow, rigid, and lost its place. devkit keeps the state in files and the rules in three layers that don't depend on a long-running process:

1. **The schema** (OpenSpec) declares the artifacts and their order; the CLI computes what's next and refuses `apply` while the plan isn't done.
2. **The skills and agents** say how to produce each artifact.
3. **A few hooks and CI checks** refuse what must never happen: code before an approved plan, a PR before an approved review, destructive git.

Edit an artifact by hand, use another agent, or pick the lighter `devkit-lite` schema for small changes; the flow still holds.

Coordination is allowed; a harness is not. The `ship-change` skill drives one approved change to a ready PR from your own session, re-reading the files and GitHub each time it runs, and stops with a reason. No long-running process, no state outside the repository and GitHub. See [ADR 0001](docs/adr/0001-coordination-without-a-harness.md).

## Documentation

- [Getting started](docs/getting-started.md): install, pick packs, first change
- [The OpenSpec flow](docs/openspec-flow.md): schemas, config, hooks, CI, troubleshooting
- [Catalog](docs/catalog.md): every agent and skill
- [Conventions](docs/conventions.md): how assets are named and written
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE). Several skills are adapted from public, permissively licensed projects; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
