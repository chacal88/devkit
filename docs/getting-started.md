# Getting started

## 1. Opt the project in

devkit installs per project: the project's `.claude/settings.json` names the marketplace and the packs it uses, so the packs load only in the projects that chose them and every other project pays no context for them. Commit the file and everyone who opens the repo gets the same setup:

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

The CLI does the same, run at the project root:

```bash
claude plugin marketplace add chacal88/devkit --scope project
claude plugin install devkit-core@devkit --scope project
```

If this machine still has the old user-scope install, follow [migrate-to-project-scope.md](migrate-to-project-scope.md).

## 2. Pick packs per project

| If the project... | Install |
|---|---|
| is any software project | `devkit-core` |
| uses (or should use) OpenSpec, and you want the flow enforced | `devkit-openspec` (with `devkit-core`) |
| is new and needs its business, domain and architecture designed first | `devkit-design` |
| uses Postgres, Neon, React/Next.js or Vitest, or is a multi-tenant SaaS | `devkit-stack` |
| builds LLM features or agents | `devkit-ai-engineering` |

```bash
claude plugin install <pack>@devkit --scope project
```

Skills load by description, so don't enable packs "just in case": each unused skill is context spent on every turn.

## 3. Use the assets

You rarely call an asset by name. Describe the task and Claude picks the skill or agent whose description matches:

| You say | What runs |
|---|---|
| "Where do we validate the webhook signature?" | `codebase-researcher` agent, answers with `file:line` |
| "Let's add CSV export. Grill me first." | `requirements-grill` skill |
| "Plan this change." | `change-planner` agent |
| "Is this plan ready to implement?" | `plan-readiness-reviewer` agent (the `plan-readiness-review` skill inline) |
| "Implement phase 1." | `tdd-implementer` agent |
| "Review the diff before I open the PR." | `review-change` skill, which dispatches the reviewers in parallel |
| "Gather evidence for the acceptance criteria." | `pr-verifier` agent |
| "Commit and open the PR." | `commit-and-pr` agent |

To call one explicitly: `/review-change`, `/plan-readiness-review`, or "use the security-reviewer agent on this diff".

## 4. Optional: enforce the flow with OpenSpec

```bash
claude plugin install devkit-openspec@devkit --scope project
```

Then in the project, run `/openspec-setup`. It writes the `.claude/settings.json` opt-in, installs OpenSpec's files and the devkit schemas into the project, and fills an `openspec/config.yaml` from your repo. Start a change with:

```bash
openspec new change add-csv-export
```

and ask Claude to "continue the change". Details: [openspec-flow.md](openspec-flow.md).

## Update

```text
/plugin marketplace update devkit
```

Then, in projects using the OpenSpec flow, run `/openspec-setup` again: it upgrades the schemas and keeps your `config.yaml`.
