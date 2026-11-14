# devkit

> Project instructions for Claude Code (CLAUDE.md), Codex (AGENTS.md links here) and every agent
> CompozyOS starts in this workspace. The rules themselves live in the documents below; this file
> only says where they are and what every session must respect.

## What this project is

A Claude Code plugin marketplace: the packs under `plugins/` (core, openspec, panel, design,
stack, ai-engineering) give any project the devkit flow: OpenSpec changes, hooks that keep product
code closed until the plan is ready, reviewer agents, checkers and a side panel.

## Where the rules are

| Topic | Document |
| --- | --- |
| How to contribute, test and release | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Conventions (commits, language, versions) | [docs/conventions.md](docs/conventions.md) |
| The OpenSpec flow, its checkers and CI | [docs/openspec-flow.md](docs/openspec-flow.md) |
| The CompozyOS delivery loop (`devkit-compozy`) | [docs/compozy-kit.md](docs/compozy-kit.md) |
| Decisions | [docs/adr/](docs/adr/) |
| Context and rules the agents get in every artifact | [openspec/config.yaml](openspec/config.yaml) |

## Commands

| Action | Command |
| --- | --- |
| Catalog is up to date | `python3 scripts/gen-catalog.py --check` |
| Names, descriptions, links, language | `python3 scripts/check.py` |
| Every hook test and the review round (about 13 minutes) | `node --test plugins/openspec/hooks/guard.test.mjs` |
| Validate the marketplace | `claude plugin validate .` |

## Working rules

- Conversation with the owner in Brazilian Portuguese; every file in this repository in English
  (`scripts/check.py` refuses Portuguese prose in Markdown).
- Every code change happens in a worktree named after its change; the root checkout stays clean.
- Nobody pushes to `main`: the `devkit` ruleset requires a pull request with the `check` and
  `devkit-reviews` checks, and the repository ships in `merge` mode (ADR 0002, ADR 0003).
- Destructive Git (`reset`, `checkout --`, `clean`, `rm`, `stash`) only with explicit authorization.
- Commits: conventional (`<type>(<scope>): <description>`), as `docs/conventions.md` states.
- Before changing a test, name its invariant, the layer that owns it and the suite it lives in.

## Gates

- No code before the plan is approved: spec-sized work is an OpenSpec change
  (`openspec new change <id> --schema devkit-lite|devkit`), and the owner approves the plan
  before `implement`.
- Every delivery passes the independent review bench (`review-change`) before it is ready; the
  implementer never approves its own work.
- `.compozy/` holds the CompozyOS roles and the delivery loop that sequence this flow; see
  [.compozy/README.md](.compozy/README.md).
