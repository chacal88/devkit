# devkit-openspec

Runs the devkit workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec) without a harness. The flow is an OpenSpec schema; the OpenSpec CLI decides what comes next; a few hooks refuse what must never happen. No coordinator session, no state machine: the state is the change's files on disk.

```bash
claude plugin install devkit-core@devkit --scope project
claude plugin install devkit-openspec@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

Then, in the project: `/openspec-setup`, which also writes that `.claude/settings.json` opt-in. The full guide is [docs/openspec-flow.md](../../docs/openspec-flow.md).

## What's inside

| Piece | Role |
|---|---|
| [`schemas/devkit/`](schemas/devkit/schema.yaml) | The flow: `requirements` → `proposal` → `specs` + `design` → `tasks` → `readiness` → apply. `apply` requires `readiness`, so `openspec instructions apply` answers `blocked` until it exists. Each artifact's instruction names the devkit-core skill or agent that produces it |
| [`schemas/devkit-lite/`](schemas/devkit-lite/schema.yaml) | The default, for small, contained changes: `proposal` → optional spec delta → `tasks` → apply. No grill, no readiness gate; reviews and evidence still required. See [choosing a schema](../../docs/openspec-flow.md#choosing-a-schema) |
| [`hooks/`](hooks/guard.mjs) | The gates OpenSpec can't see, because it only checks that a file exists (see below) |
| [`hooks/deliver-check.mjs`](hooks/deliver-check.mjs) | Answers "is this change a ready PR?" with eight items, exit codes and a versioned JSON, from files, git and `gh`. Read-only. See [the delivery contract](../../docs/openspec-flow.md#the-delivery-contract) |
| `ship-change` skill | With `ship: pr` in `openspec/config.yaml`, drives an approved change to a ready PR by following `deliver-check`'s next step, and the owner merges; with `ship: merge` it also enables GitHub auto-merge at 8/8, once the repository is prepared. In `merge` mode it enables auto-merge and never merges directly. See [ship modes](../../docs/openspec-flow.md#shipping-a-change-ship-modes). After the merge it archives the change: the retro, the owner's answer to each proposal, `openspec archive`, and an archive PR on `chore/archive-<id>` (GitHub merges it in `merge` mode; you do in `pr` mode) |
| `conduct` skill | Conducts every change of the current `openspec/roadmap.md` round from creation to archive: independent changes run their steps in parallel git worktrees (at most three at once), an `after:` change waits for its dependency's archive, the owner is asked only at owner gates, and while everything waits on GitHub one session cron re-runs it every 20 minutes. See [conducting a round](../../docs/openspec-flow.md#conducting-a-round-conduct) |
| [`hooks/conduct-check.mjs`](hooks/conduct-check.mjs) | Answers "what does every change of the round do next?" with a versioned JSON (`dispatch`, `owner`, `github`, `stopped`, `end`, `wake`). Read-only; reuses `deliver-check` per worktree |
| [`hooks/release-rebase.mjs`](hooks/release-rebase.mjs) | Rebases a change onto the default branch and resolves conflicts in release files (versions, `CHANGELOG.md`, catalog) by rule; any other conflicting path aborts. Never commits or pushes |
| `openspec-setup` skill | Initializes OpenSpec, writes the project's `.claude/settings.json` opt-in (`scripts/project-settings.mjs`), installs the schemas into the project, writes `openspec/config.yaml` from the real repo. Its GitHub step (`scripts/github-setup.mjs`) plans, then applies only what the owner confirms: the `devkit-reviews` workflow, auto-merge, delete-branch-on-merge and the `devkit` ruleset |
| [`hooks/merge-setup.mjs`](hooks/merge-setup.mjs) and the `devkit-reviews` workflow | The GitHub facts `merge` mode checks before it runs (auto-merge allowed, a rule requiring `devkit-reviews`, the workflow committed), and the `deliver-check --ci` check that rule requires. The workflow template downloads `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` together |
| `openspec-validator` agent | Structure-only check of a change |

The `openspec-*` skills (propose, explore, apply, archive, ...) are not in this pack: `openspec init` / `openspec update` generates them in each project, matching the installed CLI.

## Hooks

The hooks act only in projects whose `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema (ADR 0004); elsewhere they are silent.

| When | Rule |
|---|---|
| Session start | Prints the active change and its `openspec status`, so a new session picks up where the last one stopped; with an `openspec/roadmap.md`, also the current round and the state of each pending change (report only, never a gate) |
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
| `approval.md` | the main session, from the owner's own message (no subagent) |
| Product code (`devkit` schema, after approval) | `tdd-implementer` agent |

Reviewers and the verifier can write nothing else. Planning artifacts (`requirements.md`, `proposal.md`, `specs/`, `design.md`, `tasks.md`) stay open to the main session and the planner.

- **Active change**: `$DEVKIT_CHANGE`; else the change whose name the git branch ends with (or contains); else the only open change. With several open changes and no match, code edits are blocked until the branch names one. With no open change, nothing is gated. In a linked worktree (`.claude/worktrees/<id>`) the root is the one of the edited file or of the command's own `cd`, so the worktree's branch and change select the gate whatever folder the session started in; the opt-in check applies to that root's own `openspec/config.yaml`.
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
| [`conduct`](skills/conduct/SKILL.md) | Conducts every change of the current openspec/roadmap.md round from creation to archive - runs the next steps of independent changes in parallel git worktrees (at most three at once), keeps an `after:` change waiting until its dependency is archived, asks the owner only at owner gates (schema, grill, plan approval, retro answers) and, while everything waits on GitHub, leaves one session cron that re-runs it every 20 minutes. Always asks `conduct-check` what each change does next. Use when the owner says "/conduct", "conduct the round", "run the roadmap", "/conduct round 5", or when its own wake-up fires. |
| [`openspec-setup`](skills/openspec-setup/SKILL.md) | Sets up a project to run the devkit flow on OpenSpec - opts the project into devkit in its .claude/settings.json, runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow. |
| [`ship-change`](skills/ship-change/SKILL.md) | Drives one approved change to a ready pull request (ship pr) or, with ship merge in the project's openspec/config.yaml, to a PR that GitHub merges once the delivery contract is 8/8, and on to its archive after the merge (retro, the owner's answer to each proposal, `openspec archive`, an archive PR) - implements phase by phase, reviews, verifies, opens the PR, answers its conversation and waits for checks, always asking `deliver-check` what is next. Enables auto-merge only at the step that says so (`merge` ship mode); never merges directly. Use when the owner says "ship this change", "apply and ship <id>", "/ship-change <id>", or when Auto-fix wakes the session about that change's PR. |
<!-- catalog:end -->
