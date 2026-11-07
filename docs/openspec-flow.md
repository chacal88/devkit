# The OpenSpec flow

devkit-openspec turns the devkit workflow into something OpenSpec and a few hooks enforce, with no orchestrator session in the middle. This page explains the moving parts, how to adopt them in a project, and what to do when something blocks you.

## The three layers

| Layer | Lives in | Decides |
|---|---|---|
| **Schema** | `openspec/schemas/devkit/` (or `~/.local/share/openspec/schemas/`) | Which artifacts a change needs, in which order, and what `apply` requires |
| **Project config** | `openspec/config.yaml` | Project context, per-artifact rules, guidance for apply and archive |
| **Gates** | Claude Code hooks (from the plugin) and your CI | What must never happen, checked from file contents |

The OpenSpec CLI reads the first two and hands the result to the agent: `openspec instructions <artifact> --change <id> --json` returns the schema's instruction for that artifact, the template, the project `context` and the `rules` for that artifact. `openspec instructions apply` returns `state: blocked` and the missing artifacts until the plan is complete. The `openspec-*` skills that `openspec init` installs already read that output, so no skill needs editing for the flow to reach the agent.

## The `devkit` schema

```text
requirements ─▶ proposal ─▶ specs ─┐
                     └──▶ design ──┴─▶ tasks ─▶ readiness ─▶ apply
```

| Artifact | Produced with | Contents |
|---|---|---|
| `requirements.md` | `requirements-grill` skill | The request in the owner's words, confirmed assumptions, acceptance criteria with ids (`AC-1`...), out of scope. If the owner skips the grill: the derived criteria and `Grill: skipped by owner` |
| `proposal.md` | OpenSpec's instruction | Why, what changes, acceptance criteria (copied with their ids), capabilities, impact |
| `specs/**/spec.md` | OpenSpec's instruction | Requirement deltas with WHEN/THEN scenarios |
| `design.md` | OpenSpec's instruction | Context, decisions with alternatives, risks, migration |
| `tasks.md` | OpenSpec's instruction | One `## N.` group per phase, each ending with a gate task naming the test command; every AC id covered |
| `readiness.md` | `plan-readiness-reviewer` agent (dispatched, never written by the author) | The readiness report; its Decision section has exactly one `- Status: APPROVED`, `NEEDS-REVISION` or `BLOCKED` |

`apply` requires `readiness`. Its instruction tells the main session to dispatch the `tdd-implementer` agent once per phase, then run `review-change` (each reviewer agent writes `reviews/<reviewer>.md`), then dispatch `pr-verifier` (writes `evidence.md`) and finally `commit-and-pr`. The main session coordinates; the subagents do the work, and the hooks make sure of it.

## The `devkit-lite` schema

For changes that don't alter spec-level behavior: a refactor, tooling, docs, or a bug fix that restores what the spec already says.

```text
proposal ─▶ tasks ─▶ apply
```

```bash
openspec new change fix-retry-backoff --schema devkit-lite
```

No grill, no readiness gate (OpenSpec writes `skip_specs: true` for it), and the main session may write the code itself. The PR still needs the reviews and `evidence.md`. If requirements turn out to change, recreate the change with `devkit`.

## Adopting it in a project

The `openspec-setup` skill does all of this; here is what it does, if you prefer by hand.

1. Install the OpenSpec CLI and initialize the project:

   ```bash
   npm i -g @fission-ai/openspec@latest
   ```

   ```bash
   openspec init --tools claude
   ```

2. Install the schemas. In the project, so the team and CI share them (recommended):

   ```bash
   bash <devkit>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh .
   ```

   Or for every project on this machine: the same command without the `.`.

3. Copy [`templates/config.yaml`](../plugins/openspec/skills/openspec-setup/templates/config.yaml) to `openspec/config.yaml` and fill in `context` with the real stack, test command and conventions.

4. Install the plugins `devkit-core` and `devkit-openspec` (see [getting-started.md](getting-started.md)).

## Running a change

```bash
openspec new change add-csv-export
```

```bash
git switch -c feat/add-csv-export
```

Then tell Claude what you want ("continue the change add-csv-export"). At any point:

```bash
openspec status --change add-csv-export
```

shows what's done and what's next. A new session starts by printing the same, from the session hook.

Name the branch after the change: the hooks use it to know which change you're working on.

## The gates

| Gate | Checked by | Passes when |
|---|---|---|
| Plan complete before apply | OpenSpec CLI | All artifacts that `apply` requires exist |
| Plan approved before product code | Hook on Edit/Write and shell writes | `readiness.md` contains `- Status: APPROVED` (schemas with a `readiness` artifact only) |
| Code written by the implementer | Same hook | In the `devkit` schema, the writer is the `tdd-implementer` agent |
| One writer per gate file | Same hook | `readiness.md` ← `plan-readiness-reviewer`; `reviews/<reviewer>.md` ← that reviewer; `evidence.md` ← `pr-verifier` |
| Review and evidence before the PR | Hook on `gh pr create` | `reviews/` has `code-quality-reviewer.md` and `test-coverage-reviewer.md`, every review there says `Verdict: approved` (or `declined`), and `evidence.md` has content |
| No destructive git | Hook on Bash | The command isn't a force push, `--no-verify`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .`, `add -A` / `add .`, or `gh pr merge --admin` |

Planning files under `openspec/`, anything under `.claude/`, and anything outside the repository stay open: you can always fix the plan.

**How roles work.** When a subagent calls a tool, Claude Code passes its type (for example `devkit-core:tdd-implementer`) to the hook; the main session has none. The guard compares that with the file's owner. A subagent can still be given a misleading prompt, so each reviewer is told to ignore verdicts suggested by its caller; the separation makes self-approval impossible by accident and visible on purpose, not impossible.

**Which change is active.** `DEVKIT_CHANGE` if set; else the open change whose name the branch ends with, or contains; else the only open change. With several open changes and no branch match, code edits are blocked until you name the branch. With no open change, nothing is gated.

**Bypass.** Start Claude Code with `DEVKIT_BYPASS=1` in its environment. A prefix inside a command (`DEVKIT_BYPASS=1 git push --force`) does not work, so the agent can't bypass on its own.

## CI

Hooks run only inside Claude Code. To make the gates independent of the agent, run them in CI as well; `guard.mjs ci` checks the change named by the PR branch and ignores `DEVKIT_BYPASS`:

```yaml
# .github/workflows/devkit.yml
name: devkit
on: pull_request
jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm i -g @fission-ai/openspec@latest
      - run: openspec validate --all --strict
      - run: curl -fsSL https://raw.githubusercontent.com/chacal88/devkit/v0.1.0/plugins/openspec/hooks/guard.mjs -o "$RUNNER_TEMP/guard.mjs"
      - run: node "$RUNNER_TEMP/guard.mjs" ci
```

Pin the tag (`v0.1.0` above) and bump it on purpose.

## Customizing

- **Rules for one project**: add them under `rules.<artifact>` in `openspec/config.yaml`. They reach the agent with that artifact's instructions.
- **Change the flow itself**: copy the schema into the project (`openspec/schemas/devkit/`) and edit it; project schemas take precedence over the machine-wide ones. Validate with `openspec schema validate devkit`. Keep the artifact id `readiness` if you want the code gate.
- **A different gate**: the hooks only look for the `readiness` artifact id and the `Status:` / `Verdict:` lines, so a renamed or reworded artifact must keep those.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `devkit guard: change "x" has no approved readiness` | The plan isn't approved yet | Finish the plan and dispatch `plan-readiness-reviewer` until `- Status: APPROVED`. Planning files stay editable |
| `... is written only by the <agent> agent, not by the main session` | A gate file was written by the wrong role | Dispatch that agent with the Agent tool (`subagent_type: devkit-core:<agent>`) |
| `product code is written by the tdd-implementer agent` | The main session tried to edit code in a `devkit` change | Dispatch `devkit-core:tdd-implementer` for the phase, or use `devkit-lite` for small changes |
| `devkit guard: several active OpenSpec changes` | More than one open change and the branch doesn't name one | `git switch -c feat/<change>`, or start Claude Code with `DEVKIT_CHANGE=<change>` |
| `gh pr create` refused | A required review is missing or not approved, or `evidence.md` is missing | Run `review-change` for the change, then dispatch `pr-verifier` |
| `openspec instructions apply` says `blocked` | An artifact `apply` requires is missing | `openspec status --change <id>` lists it |
| `schema 'devkit' not found` | Schemas not installed where OpenSpec looks | Run `/openspec-setup`, or check `openspec schema which devkit` |
| The hooks don't fire at all | `devkit-openspec` isn't installed or enabled | `/plugin` → enable `devkit-openspec@devkit` |

## Limits

- Hooks can veto an action; they can't make a step happen. The guarantee is "no code before an independently approved plan, no PR without approved reviews and evidence", not "the review was thorough".
- Shell writes are detected from the command (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `install`, `touch`, `truncate`). A path built from a variable (`"$TMP"/x`) or a script that writes from inside an interpreter (`python -c`, `node -e`) is not resolved, so it isn't gated; CI is the backstop.
- OpenSpec's schema commands are marked experimental by the CLI and may change between versions. The schemas here are validated against OpenSpec 1.16.
- `readiness.md` approval is not invalidated automatically when the plan changes later; the schema tells the agent to re-run it, and review in the PR is the backstop.
