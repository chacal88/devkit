# devkit-openspec

Runs the devkit workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) without a harness. The flow is an OpenSpec schema; the OpenSpec CLI decides what comes next; a few hooks refuse what must never happen. No coordinator session, no state machine: the state is the change's files on disk.

```text
/plugin install devkit-core@devkit
/plugin install devkit-openspec@devkit
```

Then, in the project: `/openspec-setup`. The full guide is [docs/openspec-flow.md](../../docs/openspec-flow.md).

## What's inside

| Piece | Role |
|---|---|
| [`schemas/devkit/`](schemas/devkit/schema.yaml) | The flow: `requirements` → `proposal` → `specs` + `design` → `tasks` → `readiness` → apply. `apply` requires `readiness`, so `openspec instructions apply` answers `blocked` until it exists. Each artifact's instruction names the devkit-core skill or agent that produces it |
| [`schemas/devkit-lite/`](schemas/devkit-lite/schema.yaml) | Small changes with no spec-level behavior change: `proposal` → `tasks` → apply. No grill, no readiness gate |
| [`hooks/`](hooks/guard.mjs) | The gates OpenSpec can't see, because it only checks that a file exists (see below) |
| `openspec-setup` skill | Initializes OpenSpec, installs the schemas, writes `openspec/config.yaml` from the real repo |
| `openspec-validator` agent | Structure-only check of a change |

The `openspec-*` skills (propose, explore, apply, archive, ...) are not in this pack: `openspec init` / `openspec update` generates them in each project, matching the installed CLI.

## Hooks

| When | Rule |
|---|---|
| Session start | Prints the active change and its `openspec status`, so a new session picks up where the last one stopped |
| Edit / Write (and shell writes: `>`, `tee`, `sed -i`, `cp`, `mv`) | Each gate file has one writer (table below). In the `devkit` schema, product code is closed until `readiness.md` says `- Status: APPROVED`, and then only the `tdd-implementer` agent writes it |
| `gh pr create` | Blocked unless the active change has `reviews/code-quality-reviewer.md` and `reviews/test-coverage-reviewer.md`, every review in `reviews/` says `Verdict: approved` (or `declined`), and `evidence.md` has content |
| Any Bash command | Refuses force push (`--force-with-lease` is allowed), `--no-verify`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .`, `git add -A` / `git add .`, `gh pr merge --admin`. Text inside heredocs and quotes is not treated as a command |

### Roles

Claude Code tells a hook which subagent is acting, so the hooks can give every gate file exactly one writer. The author of a plan can't approve it, and the main session can't write a review:

| File | Only writer |
|---|---|
| `readiness.md` | `plan-readiness-reviewer` agent |
| `reviews/<reviewer>.md` | that reviewer agent |
| `evidence.md` | `pr-verifier` agent |
| Product code (`devkit` schema, after approval) | `tdd-implementer` agent |

Reviewers and the verifier can write nothing else. Planning artifacts (`requirements.md`, `proposal.md`, `specs/`, `design.md`, `tasks.md`) stay open to the main session and the planner.

- **Active change**: `$DEVKIT_CHANGE`; else the change whose name the git branch ends with (or contains); else the only open change. With several open changes and no match, code edits are blocked until the branch names one. With no open change, nothing is gated.
- **Bypass**: start Claude Code with `DEVKIT_BYPASS=1`. A `DEVKIT_BYPASS=1` prefix inside a command does not reach the hook.
- **Tests**: `node --test plugins/openspec/hooks/guard.test.mjs`.

Hooks veto; they can't make a step happen. The flow's guarantee is that code doesn't start before an approved plan and a PR doesn't open without an approved review and evidence. For a guarantee that doesn't depend on the agent at all, run the same checks in CI ([docs/openspec-flow.md](../../docs/openspec-flow.md#ci)).

## Assets

<!-- catalog:begin -->
**Agents**

| Agent | Model | Tools | What it does / when to use |
|---|---|---|---|
| [`openspec-validator`](agents/openspec-validator.md) | haiku | Read, Glob, Grep, Bash | Runs structural validation on an OpenSpec change - openspec validate --strict, markdown link resolution, WHEN/THEN scenario presence, and consistency across proposal, design, tasks and spec deltas. Mechanical; does not review content. Use before reviewing, applying or archiving a change, or when the user says "validate the change" or "is this change well-formed?". |

**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`openspec-setup`](skills/openspec-setup/SKILL.md) | Sets up a project to run the devkit flow on OpenSpec - runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow. |
<!-- catalog:end -->
