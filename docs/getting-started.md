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

## 5. Optional: run a roadmap round with /conduct

The roadmap groups changes into rounds, and `/conduct` takes every change of the current round from "not started" to "archived". Write `openspec/roadmap.md`:

```markdown
# Roadmap

## Round 1: exports
- [ ] add-csv-export - export the orders table as CSV
- [ ] export-audit-log (after: add-csv-export) - record who exported what
```

The current round is the first with an unticked line, and `after:` orders the two changes. Typing `/conduct` then does this:

1. It fetches and asks `conduct-check` what each change does next.
2. For each new change it asks you to confirm the schema it proposes from the line's description (one question at a time), then creates a git worktree at `.claude/worktrees/<id>` on a branch named after the change.
3. It plans both changes at once, the planning steps that are not owner gates run as subagents in that change's worktree, at most three at a time.
4. `add-csv-export` goes on through implement, review, evidence, PR and merge (GitHub merges in `merge` mode, you merge in `pr` mode), then the retro (you answer each proposal) and an archive PR that ticks its line.
5. `export-audit-log`, once planned, shows `waiting on add-csv-export`. Only after the tick lands on `origin/<base>` is it rebased, its plan audited, and delivered the same way.
6. You are asked only at owner gates: each schema, the grill and plan approval for `devkit` changes, and retro answers. After the schema answer, typing `/conduct` is the go-ahead for a `devkit-lite` change.
7. When everything waits on GitHub it watches once (9 minutes by default), then leaves one session cron that re-runs `/conduct --wake` every 20 minutes while the session is open.

A run that stops mid-round ends with a report like this, one line per change (id, schema, one state) plus the round and wake-up lines:

```text
add-csv-export (devkit-lite): waiting on GitHub: <what>
export-audit-log (devkit-lite): waiting on add-csv-export
round: Round 1: exports (0/2)
wake-up: cron <id> every 20 minutes
```

The full rules are in [the roadmap](openspec-flow.md#grouping-changes-the-roadmap) and [conducting a round](openspec-flow.md#conducting-a-round-conduct).

## Update

```text
/plugin marketplace update devkit
```

Then, in projects using the OpenSpec flow, run `/openspec-setup` again: it upgrades the schemas and keeps your `config.yaml`.
