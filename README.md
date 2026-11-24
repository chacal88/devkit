# devkit

Reusable [Claude Code](https://docs.claude.com/en/docs/claude-code) agents and skills, plus a spec-driven workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) that its schema and a few hooks enforce.

devkit is a plugin marketplace with seven packs. Install the packs per project: each project's `.claude/settings.json` names the packs it uses, so they load only in the projects that chose them and every other project pays no context for them (every installed skill's description is loaded into context on every turn).

| Pack | What it gives you |
|---|---|
| [**devkit-core**](plugins/core/README.md) | The development workflow, stack-agnostic: `codebase-researcher`, `requirements-grill`, `requirements-triage`, `change-planner`, `plan-readiness-review`, `tdd-implementer`, `pr-verifier`, `review-change` with six specialist reviewers, `commit-and-pr`, `retro`, plus TDD and systematic debugging |
| [**devkit-openspec**](plugins/openspec/README.md) | That workflow as an OpenSpec schema, with hooks that keep product code closed until the plan is approved and refuse a PR without an approved review and evidence |
| [**devkit-design**](plugins/design/README.md) | Greenfield design in four DDD phases: business discovery, domain model, architecture (with ADRs), implementation plan |
| [**devkit-stack**](plugins/stack/README.md) | Technology references: Postgres, Neon, React performance, Vitest, multi-tenant SaaS, threat modeling |
| [**devkit-ai-engineering**](plugins/ai-engineering/README.md) | Building with LLMs: evaluation, multi-agent patterns, tool and CLI design for agents, context compression, skill vetting |
| [**devkit-panel**](plugins/panel/README.md) | A side pane in the Claude desktop app over the devkit checkers: the change this session conducts with its next step, phases, PR, delivery items and child sessions, and buttons that put the owner's next command in the prompt box |
| [**devkit-compozy**](plugins/compozy/README.md) | The CompozyOS driver of the devkit flow: `compozy-setup` installs `.compozy/` (one agent per devkit role and three loops: a change, its review round and a roadmap) into a project. See [docs/compozy-kit.md](docs/compozy-kit.md) |

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

Each step works on its own: ask Claude to "review this diff" or "is this plan ready?" and the matching asset picks it up. With **devkit-openspec**, the same path becomes an OpenSpec schema: the schema declares every stage and `flow-check` says which stage passed and which comes next, and the hooks block skipping the gates. See [docs/openspec-flow.md](docs/openspec-flow.md).

## How the flow holds

Earlier attempts orchestrated changes with a coordinator session driving a state machine. It worked, but it was slow, rigid, and lost its place. devkit keeps the state in files and the rules in three layers that don't depend on a long-running process:

1. **The schema** (OpenSpec) declares the artifacts and their order; the CLI computes what's next and refuses `apply` while the plan isn't done.
2. **The skills and agents** say how to produce each artifact.
3. **A few hooks and CI checks** refuse what must never happen, in projects that opted in: code before an approved plan, a PR before an approved review, destructive git. A project opts in through its `openspec/config.yaml` schema; elsewhere the hooks stay silent. See [ADR 0004](docs/adr/0004-devkit-per-project.md).

Edit an artifact by hand, use another agent, or pick the lighter `devkit-lite` schema for small changes; the flow still holds.

How changes are coordinated is decided by [ADR 0010](docs/adr/0010-openspec-as-the-harness.md), which supersedes ADR 0001 (coordination without a harness) and ADR 0007 (one change on request): OpenSpec is the harness, a roadmap coordinator starts the changes that are ready, and a change coordinator runs each one as a loop over its files, under the driver each project chooses. The design and its build order are in [docs/coordination-design.md](docs/coordination-design.md). None of it is built yet: until a round of `openspec/roadmap.md` replaces a piece, what ships is what follows. The `ship-change` skill drives one approved change to a ready PR from your own session, re-reading the files and GitHub each time it runs, and stops with a reason. The reviewer round may run as one Workflow script inside your session, recorded in [ADR 0008](docs/adr/0008-reviews-as-a-workflow.md).

The merge stays the owner's unless a repository opts in, per schema, to GitHub merging a change on its own once the `devkit-reviews` check passes at the PR head; the opt-in is a rule with a review trigger, not a default. See [ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md). After the merge, `ship-change` archives the change through a PR that GitHub merges in `merge` mode; see [ADR 0003](docs/adr/0003-auto-merge-the-archive-pr.md).

`/devkit change` followed by what you want done runs one change from your request to its archive, in this session: it opens the change in its own git worktree, carries it stage by stage, asks you only at the owner's gates (the grill, the plan approval, the retro answers), and waits on GitHub by itself, with no time limit, and goes on when GitHub answers. `/devkit change` alone continues the change you left unfinished. `/devkit roadmap` (or `/devkit roadmap 3`) runs the changes of `openspec/roadmap.md` whose dependencies are archived, up to that many at once, each change in an app session of its own in the desktop app, all opened at the run's start and running on the run's ticket with no typed command, while their grills, plan approvals and retro answers are asked in your session; `/devkit status` shows where everything is and what waits on you. Locks that hooks hold keep the session from stopping before a stage is delivered and from writing product code itself. The decision is recorded in [ADR 0010](docs/adr/0010-openspec-as-the-harness.md) and, for the roadmap, [ADR 0013](docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md) [ADR 0014](docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md) and [ADR 0021](docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md); the earlier rules of [ADR 0006](docs/adr/0006-phases-as-child-sessions.md) and [ADR 0007](docs/adr/0007-one-change-on-request.md) are replaced by it. `/devkit project <slice>` defines a new project or one slice of it before it is built: the four design phases (business, domain model, architecture, implementation plan) as conversations in this session, then the rounds for the roadmap once you approve them, and one pull request that GitHub merges after the ADR reviewer clears it; it never starts `/devkit roadmap`, which runs the rounds.

## Documentation

- [Getting started](docs/getting-started.md): opt a project in, pick packs, first change
- [Migrate to project scope](docs/migrate-to-project-scope.md): remove the old user-scope install, item by item
- [The OpenSpec flow](docs/openspec-flow.md): schemas, config, hooks, CI, troubleshooting
- [The coordination design](docs/coordination-design.md): the roadmap and change coordinators, OpenSpec as the harness, and the build order (ADR 0010)
- [Catalog](docs/catalog.md): every agent and skill
- [Conventions](docs/conventions.md): how assets are named and written
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE). Several skills are adapted from public, permissively licensed projects; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
