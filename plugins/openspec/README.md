# devkit-openspec

Runs the devkit workflow on top of [OpenSpec](https://github.com/Fission-AI/OpenSpec), which is its harness ([ADR 0010](../../docs/adr/0010-openspec-as-the-harness.md)). The flow is an OpenSpec schema; the schema declares every stage and the `flow-check` script says which comes next; a few hooks refuse what must never happen. Today no coordinator session and no state machine run it (ADR 0010 adds two coordinators, built in the rounds of `openspec/roadmap.md`): the state is the change's files on disk.

```bash
claude plugin install devkit-core@devkit --scope project
claude plugin install devkit-openspec@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

Then, in the project: `/openspec-setup`, which also writes that `.claude/settings.json` opt-in. The full guide is [docs/openspec-flow.md](../../docs/openspec-flow.md).

## What's inside

| Piece | Role |
|---|---|
| [`schemas/devkit/`](schemas/devkit/schema.yaml) | The flow: `requirements` → `proposal` → `specs` + `design` → `tasks` → `readiness` → `approval` → apply. `apply` requires `approval`, so `openspec instructions apply` answers `blocked` until it exists. Each artifact's instruction names the role that produces it, not a platform's tool (see [roles](../../docs/roles.md)); `flow.json` next to the schema declares the stages for `flow-check`, and `flows/` keeps each released version of it |
| [`schemas/devkit-lite/`](schemas/devkit-lite/schema.yaml) | The default, for small, contained changes: `requirements` (the grill) → `proposal` → optional spec delta → `tasks` → apply. No readiness gate, no separate plan approval; reviews and evidence still required. See [choosing a schema](../../docs/openspec-flow.md#choosing-a-schema) |
| [`schemas/devkit-project/`](schemas/devkit-project/schema.yaml) | The third schema, for defining a project or one slice of it: `business` → `domain-model` → `architecture` → `implementation-plan` → `roadmap` → `review`. Each stage record is `passed` from the owner's words or `not-applicable` with its reason; the documents live in `docs/design/<slice>/`. Not an opt-in schema (ADR 0015) |
| `schemas/<schema>/flow.json` | The stage declaration of each schema: ids, files, sources, roles, failed-attempt ceilings and the stage titles. `flow-check` and `conduct-check` read it; keep it with `schema.yaml` and the templates |
| `schemas/<schema>/flows/<n>.json` | Every released version of that declaration, kept so a change keeps the flow it was opened with (its `.openspec.yaml` records `x-devkit-flow`); `flow.json` equals the file of its own `version`, and `scripts/released-flows.json` pins each file's digest |
| [`hooks/`](hooks/guard.mjs) | The gates OpenSpec can't see, because it only checks that a file exists (see below) |
| [`hooks/flow-check.mjs`](hooks/flow-check.mjs) | Reads each stage file's header, OpenSpec's status, the task list and git, and says which stage passed and which comes next, in `pt-BR` or `en`, or as a versioned JSON (`--json`). No model is called. Needs the `openspec` CLI, major 2: the project's pinned copy (`node_modules/.bin/openspec`) when it has one, else the one on `PATH`. See [the stage header](../../docs/openspec-flow.md#the-stage-header-and-flow-check) |
| [`hooks/deliver-check.mjs`](hooks/deliver-check.mjs) | Answers "is this change a ready PR?" with eight items, exit codes and a versioned JSON, from files, git and `gh`. Read-only. See [the delivery contract](../../docs/openspec-flow.md#the-delivery-contract) |
| Delivery models | `devkit.delivery.model` in `openspec/config.yaml` chooses `two-prs` (two pull requests from one branch, the test branch kept out of the task branch by a hook and by `devkit-reviews`, a support branch for a conflict, the archive on both branches), `trunk` or `trunk-auto`. See [delivery models](../../docs/openspec-flow.md#delivery-models) |
| `ship-change` skill | With `ship: pr` in `openspec/config.yaml`, drives an approved change to a ready PR by following `deliver-check`'s next step, and the owner merges; with `ship: merge` it also enables GitHub auto-merge at 8/8, once the repository is prepared. In `merge` mode it enables auto-merge and never merges directly. See [ship modes](../../docs/openspec-flow.md#shipping-a-change-ship-modes). After the merge it archives the change: the retro, the owner's answer to each proposal, `openspec archive`, and an archive PR on `chore/archive-<id>` (GitHub merges it in `merge` mode; you do in `pr` mode) |
| `devkit` skill | `/devkit change <request>` runs one change from the owner's words to its archive: it opens the change in its own git worktree, asks `hooks/change-loop.mjs` what comes next, hands each stage to its agent, asks the owner only at owner gates, and waits on GitHub with no time limit; `/devkit change` alone continues the unfinished change. `/devkit roadmap [<n>]` runs the roadmap's ready changes, several at once, and `/devkit status` shows where everything is. `/devkit train` departs the boarded changes of a project with a delivery train, together on one train. The language of its replies is this pack's `language` setting (`pt-BR` or `en`; set the same value in `devkit-panel`), and `load_limit` is the processor load per core, in percent, at or above which `/devkit roadmap` holds new starts (80 by default), and `machines` is a JSON list of the other machines (SSH connection, folder and places) a roadmap run may open changes on (empty by default: everything runs here). See [the change coordinator](../../docs/openspec-flow.md#the-change-coordinator-devkit-change) and [the roadmap coordinator](../../docs/openspec-flow.md#the-roadmap-coordinator-devkit-roadmap-and-devkit-status) |
| [`hooks/change-loop.mjs`](hooks/change-loop.mjs) | The decisions of `/devkit change`: `start`, `open`, `script`, `accept-decisions`, `merge-check`, `next`, `wait` and `reply`, each printing a versioned JSON. `next` asks `flow-check` which stage the change is in (the unit and E2E tests come from `flow-check` alone, and a drawn mock-up waits for the owner) and, from the implementation on, `deliver-check` which step comes next. It writes nothing but the change it opens and, with `accept-decisions`, the status of the decision records the approved plan lists, with `merge-check`, its record in the git common directory, and calls no model |
| [`hooks/project-loop.mjs`](hooks/project-loop.mjs) | The decisions of `/devkit project`: `start`, `open` (which claims the slice on origin when there is one), `next`, `status`, `rounds`, `record-review`, `archive` and `wait`. It reads the slice's stage records and git, and says what comes next: a phase conversation, the roadmap rounds, the ADR review, the archive or the pull request. `/devkit project <slice>` runs it in the owner's session |
| [`hooks/roadmap-loop.mjs`](hooks/roadmap-loop.mjs) | The decisions of `/devkit roadmap` and `/devkit status`: `run`, `next`, `hold`, `status` (with `--json`, which another machine's run asks over SSH), `checkout`, `draft` and `reply`, and for a change session of a run that opens every change at its start `session-next`, `session-wait`, `merge-base`, `push`, `schedule-check` and `delete-check`. It reads `openspec/roadmap.md`, the open changes and the processor load, keeps one run's bookkeeping (the start tickets, the places, the periodic check) in the git directory, and prints the actions, the event lines and the board. It calls no model |
| [`hooks/train-loop.mjs`](hooks/train-loop.mjs) | The decisions of `/devkit train`, for a project that sets `devkit.delivery.train`: `next`, `depart` and `wait`. It reads git and GitHub, keeps no state of its own but the departure lock, and says what comes next: the departure of the boarded changes on one `train/<n>` branch with its record in `openspec/trains/<n>.md`, the train's pull request, its merge and the close of each boarded change's own pull request. It runs the project's whole suite once per train and calls no model. See [the delivery train](../../docs/openspec-flow.md#the-delivery-train) |
| [`hooks/machine-probe.mjs`](hooks/machine-probe.mjs) | Runs on another machine when `roadmap-loop.mjs` asks it over SSH: prints that machine's changes and their state for the same repository as one JSON, using the pack installed there. Node built-ins only; read-only |
| [`hooks/conduct-check.mjs`](hooks/conduct-check.mjs) | Answers "what does the change (or every change of the round) do next?" with a versioned JSON (`version: 2`: `mode`, `change`, `dispatch`, `owner`, `github`, `stopped`, `end`, `unfinished` per row, and a `session` descriptor for each `implement` row in the app). `--change <id>` conducts one change; `--round <n>` a round. Read-only; reuses `deliver-check` per worktree. The side panel and the CompozyOS loop read it; `/devkit change` uses its `deliveryRow` |
| [`hooks/release-merge.mjs`](hooks/release-merge.mjs) | Merges the default branch into a change and resolves conflicts in release files (versions, `CHANGELOG.md`, catalog) and the CI pin in `docs/openspec-flow.md` by rule, then commits the merge; any other conflicting path aborts and leaves the branch as it was. Never pushes |
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
| Stop | During a `/devkit change` or `/devkit roadmap` run, refuses to let the session stop while the loop still has an action to carry out, and says the command that gives it (`change-loop.mjs next`); an owner gate, a wait on GitHub and an end let it stop |
| Skill (before the call) | The `devkit-session` skill, the entry of a change session a roadmap run started, runs only when the session's first message is the host's started form carrying a ticket the run recorded for that change and no other session claimed (`guard.mjs skill`); any other call is refused, and the typed `/devkit change <id>` still works |
| Subagent stop | During a run, refuses to let a stage agent stop before its stage's file is delivered |
| Agent (before the call) | During a run, lets the session hand off only the agent the loop named; any other hand-off is refused |
| Edit / Write, during a run | In a `/devkit change` or `/devkit roadmap` run the main session edits no product code, in either script; only the stage agents do (the run lock) |

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
- **Tests**: `node scripts/test-suite.mjs`, from the repository root (every test file in a process of its own).

Hooks veto; they can't make a step happen. The flow's guarantee is that code doesn't start before an approved plan and a PR doesn't open without an approved review and evidence. For a guarantee that doesn't depend on the agent at all, run the same checks in CI ([docs/openspec-flow.md](../../docs/openspec-flow.md#ci)).

## Assets

<!-- catalog:begin -->
**Agents**

| Agent | Model | Tools | What it does / when to use |
|---|---|---|---|
| [`change-coordinator`](agents/change-coordinator.md) | sonnet | Read, Write, Edit, Bash, Glob, Grep | The coordinator's hands for drivers outside Claude Code, such as the CompozyOS loop `devkit-change`: opens a change, runs one grill turn, carries out the delivery and retro steps of the ship-change rows, records the retro answers and writes the review bench's steps for `devkit-review`. Use when a loop outside Claude Code hands it one step of a change, never in a Claude Code session, where the main session coordinates. |
| [`openspec-validator`](agents/openspec-validator.md) | haiku | Read, Glob, Grep, Bash | Runs structural validation on an OpenSpec change - openspec validate --strict, markdown link resolution, WHEN/THEN scenario presence, and consistency across proposal, design, tasks and spec deltas. Mechanical; does not review content. Use before reviewing, applying or archiving a change, or when the user says "validate the change" or "is this change well-formed?". |

**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`devkit`](skills/devkit/SKILL.md) | Runs one change from the owner's request to its archive in this session: /devkit change <what to do> opens the change in its own worktree and carries it, stage by stage, asking the owner only at the owner's gates (the grill, the mock-up, the plan approval, the retro answers) and waiting on GitHub with no time limit; /devkit change alone continues the unfinished change. /devkit change <Jira key or link> opens the change from that task, read through the session's Atlassian connector, and asks once, when the pull request opens, whether to write its link back. /devkit roadmap [<n>] runs the roadmap's ready changes, several at once, and /devkit status shows where everything is. /devkit train departs the boarded changes of a project with a delivery train, together on one train. /devkit project [<name>] plans a new project or slice phase by phase with the owner (business, domain model, architecture, implementation plan, roadmap), then delivers it as one pull request. Every decision comes from the change-loop, roadmap-loop and project-loop scripts, never from this text. Use when the owner types /devkit, /devkit change <what to do>, /devkit change <Jira key or link>, /devkit change to continue, /devkit roadmap [<n> \| stop], /devkit status, /devkit train or /devkit project [<name>]. |
| [`devkit-session`](skills/devkit-session/SKILL.md) | Runs the change of a session a /devkit roadmap run started, from its first turn, with no command typed. Use only when this session's first message is the started-session form whose task is /devkit change <id> followed by a devkit-start line; the devkit guard refuses it anywhere else. |
| [`openspec-setup`](skills/openspec-setup/SKILL.md) | Sets up a project to run the devkit flow on OpenSpec - opts the project into devkit in its .claude/settings.json, runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow. |
| [`ship-change`](skills/ship-change/SKILL.md) | Drives one approved change to a ready pull request (ship pr) or, with ship merge in the project's openspec/config.yaml, to a PR that GitHub merges once the delivery contract is 8/8, and on to its archive after the merge (retro, the owner's answer to each proposal, `openspec archive`, an archive PR) - implements phase by phase, verifies, reviews, opens the PR, answers its conversation and waits for checks, always asking `deliver-check` what is next. Enables auto-merge only at the step that says so (`merge` ship mode); never merges directly. Use when the owner says "ship this change", "apply and ship <id>", "/ship-change <id>", or when Auto-fix wakes the session about that change's PR. |
<!-- catalog:end -->
