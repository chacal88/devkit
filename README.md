# devkit

Reusable [Claude Code](https://docs.claude.com/en/docs/claude-code) agents and skills, plus a spec-driven workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) that you can enforce without a harness.

devkit is a plugin marketplace with five packs. Install the packs per project: each project's `.claude/settings.json` names the packs it uses, so they load only in the projects that chose them and every other project pays no context for them (every installed skill's description is loaded into context on every turn).

| Pack | What it gives you |
|---|---|
| [**devkit-core**](plugins/core/README.md) | The development workflow, stack-agnostic: `codebase-researcher`, `requirements-grill`, `change-planner`, `plan-readiness-review`, `tdd-implementer`, `pr-verifier`, `review-change` with six specialist reviewers, `commit-and-pr`, `retro`, plus TDD and systematic debugging |
| [**devkit-openspec**](plugins/openspec/README.md) | That workflow as an OpenSpec schema, with hooks that keep product code closed until the plan is approved and refuse a PR without an approved review and evidence |
| [**devkit-design**](plugins/design/README.md) | Greenfield design in four DDD phases: business discovery, domain model, architecture (with ADRs), implementation plan |
| [**devkit-stack**](plugins/stack/README.md) | Technology references: Postgres, Neon, React performance, Vitest, multi-tenant SaaS, threat modeling |
| [**devkit-ai-engineering**](plugins/ai-engineering/README.md) | Building with LLMs: evaluation, multi-agent patterns, tool and CLI design for agents, context compression, skill vetting |

The full list, generated from the files: [docs/catalog.md](docs/catalog.md).

## Install

Commit the marketplace and the packs the project uses to its `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "devkit": { "source": { "source": "github", "repo": "chacal88/devkit" } }
  },
  "enabledPlugins": {
    "devkit-core@devkit": true,
    "devkit-openspec@devkit": true
  }
}
```

Or run the CLI equivalent at the project root:

```bash
claude plugin marketplace add chacal88/devkit --scope project
claude plugin install devkit-core@devkit --scope project
```

Add more packs the same way (`devkit-openspec@devkit`, `devkit-design@devkit`, `devkit-stack@devkit`, `devkit-ai-engineering@devkit`). The packs load only in the projects that chose them. If this machine still has the old user-scope install, see [docs/migrate-to-project-scope.md](docs/migrate-to-project-scope.md). Details: [docs/getting-started.md](docs/getting-started.md).

## The workflow in one picture

```text
requirements-grill ─▶ change-planner ─▶ plan-readiness-reviewer ──[APPROVED]──▶ tdd-implementer (per phase)
                                                                                          │
                       retro ◀── commit-and-pr ◀── review-change ◀── pr-verifier ◀──────┘
```

Each step works on its own: ask Claude to "review this diff" or "is this plan ready?" and the matching asset picks it up. With **devkit-openspec**, the same path becomes an OpenSpec schema: `openspec status` always tells you the next step, and the hooks block skipping the gates. See [docs/openspec-flow.md](docs/openspec-flow.md).

## Why no harness

Earlier attempts orchestrated changes with a coordinator session driving a state machine. It worked, but it was slow, rigid, and lost its place. devkit keeps the state in files and the rules in three layers that don't depend on a long-running process:

1. **The schema** (OpenSpec) declares the artifacts and their order; the CLI computes what's next and refuses `apply` while the plan isn't done.
2. **The skills and agents** say how to produce each artifact.
3. **A few hooks and CI checks** refuse what must never happen, in projects that opted in: code before an approved plan, a PR before an approved review, destructive git. A project opts in through its `openspec/config.yaml` schema; elsewhere the hooks stay silent. See [ADR 0004](docs/adr/0004-devkit-per-project.md).

Edit an artifact by hand, use another agent, or pick the lighter `devkit-lite` schema for small changes; the flow still holds.

Coordination is allowed; a harness is not. The `ship-change` skill drives one approved change to a ready PR from your own session, re-reading the files and GitHub each time it runs, and stops with a reason. No long-running process, no state outside the repository and GitHub. See [ADR 0001](docs/adr/0001-coordination-without-a-harness.md). The reviewer round may run as one Workflow script inside your session, an exception recorded in [ADR 0008](docs/adr/0008-reviews-as-a-workflow.md).

The merge stays the owner's unless a repository opts in, per schema, to GitHub merging a change on its own once the `devkit-reviews` check passes at the PR head; the opt-in is a rule with a review trigger, not a default. See [ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md). After the merge, `ship-change` archives the change through a PR that GitHub merges in `merge` mode; see [ADR 0003](docs/adr/0003-auto-merge-the-archive-pr.md).

`/conduct <id>` conducts one change: it runs the next steps in the change's own git worktree, asks you only at owner gates, and, in the desktop app, starts each implementation phase as a child session (grouped in the sidebar by change, archived when the phase's gate is green); while it waits on GitHub it does one capped watch and leaves the rest to the app's PR Auto-fix, with no cron. `/conduct round <n>` is the explicit option that conducts every change of a roadmap round at once (at most three at a time). It is an exception to ADR 0001, recorded in [ADR 0006](docs/adr/0006-phases-as-child-sessions.md) and [ADR 0007](docs/adr/0007-one-change-on-request.md).

## Documentation

- [Getting started](docs/getting-started.md): opt a project in, pick packs, first change
- [Migrate to project scope](docs/migrate-to-project-scope.md): remove the old user-scope install, item by item
- [The OpenSpec flow](docs/openspec-flow.md): schemas, config, hooks, CI, troubleshooting
- [Catalog](docs/catalog.md): every agent and skill
- [Conventions](docs/conventions.md): how assets are named and written
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE). Several skills are adapted from public, permissively licensed projects; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
