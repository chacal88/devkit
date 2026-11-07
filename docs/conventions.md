# Conventions

Rules every agent, skill and command in this repository follows. A file that breaks one of them is a bug.

## Layout

`plugins/` holds independent packs. Each pack is a Claude Code plugin, so a project installs only the packs it needs (every installed skill's description costs context on every turn).

```
plugins/<pack>/
  .claude-plugin/plugin.json
  agents/<name>.md          # optional
  skills/<name>/SKILL.md    # + references/, templates/, scripts/ only when the body uses them
```

| Pack | What goes in it |
|---|---|
| `core` | Stack-agnostic dev workflow: research, plan, implement, review, ship, debug, test |
| `openspec` | The devkit flow on top of OpenSpec: workflow schemas, project config template, guard hooks, structural validator |
| `design` | Greenfield design in four DDD phases (business, domain model, architecture, implementation plan) |
| `stack` | Technology references: Postgres, React, Vitest, multi-tenant SaaS, threat modeling |
| `ai-engineering` | Building with LLMs: evaluation, multi-agent patterns, tool design, context, skill vetting |

## Naming

- English, kebab-case, `<noun>` or `<domain>-<role>` (`security-reviewer`, `plan-readiness-review`).
- No project or kit prefixes (`acme-`, `myproj:`). The plugin namespace already scopes them.
- File/folder name == frontmatter `name`.
- Prefer a skill over a command: skills are invocable as `/<name>`. Add a command only when it does something a skill can't.

## Frontmatter

Agents:
```yaml
---
name: security-reviewer
description: <What it does, one sentence>. Use when <concrete triggers>.
tools: Read, Glob, Grep, Bash        # least privilege; reviewers get Write only for their verdict file
model: opus | sonnet | haiku         # opus for judgment, sonnet for execution, haiku for mechanical
---
```

Skills:
```yaml
---
name: plan-readiness-review
description: <What it does>. Use when <concrete triggers, including phrases a user would say>.
---
```

- `description` is what makes the asset trigger: say what it does and when, in under ~500 characters. No marketing, no history.
- Only keys Claude Code reads. Documentation-only keys (`inputs`, `outputs`, `related_adrs`, `forbidden_paths`, ...) go in the body if they matter, or go away.

## Content

- Self-contained and project-agnostic. No references to a specific project, product, ADR number, private CLI, ledger, validator script, flow engine or doc file that only exists in one repository.
- Where the asset needs a project convention, name the common defaults and tell the agent to discover the real one: "the project's ADRs (usually `docs/adr/` or `docs/decisions/`)", "the project's test command (from `package.json`, `Makefile`, CI config)".
- Cross-references use library names only (`see the plan-readiness-review skill`).
- Agents state, in the body: what they receive, what they return (a parseable verdict line when they gate something), and a short **Never** list.
- Reviewers report; they don't fix, don't merge, don't approve with an open blocker. Their only `Write` is their own verdict file (`reviews/<name>.md`), which the devkit hooks enforce.
- Gate files have one writer: `readiness.md` ← `plan-readiness-reviewer`, `reviews/<reviewer>.md` ← that reviewer, `evidence.md` ← `pr-verifier`. Don't add an asset that writes them.
- Cut bloat, keep method. Don't invent rules the sources didn't have.
- Body in English.
