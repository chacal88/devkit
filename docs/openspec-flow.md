# The OpenSpec flow

devkit-openspec turns the devkit workflow into something OpenSpec and a few hooks enforce, with one command, `/devkit change`, that runs a change as a loop over the checker while the hooks still veto (ADR 0010 adds the roadmap coordinator in a later round). This page explains the moving parts, how to adopt them in a project, and what to do when something blocks you.

How changes are coordinated is being redone: [ADR 0010](adr/0010-openspec-as-the-harness.md) supersedes ADR 0001 and ADR 0007, and [the coordination design](coordination-design.md) holds the design and its build order. This page describes what ships today; each part stays as described here until the round of `openspec/roadmap.md` that replaces it. The change coordinator, `/devkit change`, exists since round 15 (see [The change coordinator: `/devkit change`](#the-change-coordinator-devkit-change)).

## The three layers

| Layer | Lives in | Decides |
|---|---|---|
| **Schema** | `openspec/schemas/devkit/` (or `~/.local/share/openspec/schemas/`) | Which artifacts a change needs, in which order, and what `apply` requires |
| **Project config** | `openspec/config.yaml` | Project context, per-artifact rules, guidance for apply and archive |
| **Gates** | Claude Code hooks (from the plugin) and your CI | What must never happen, checked from file contents |

The OpenSpec CLI reads the first two and hands the result to the agent: `openspec instructions <artifact> --change <id> --json` returns the schema's instruction for that artifact, the template, the project `context` and the `rules` for that artifact. `openspec instructions apply` returns `state: blocked` and the missing artifacts until the plan is complete. The `openspec-*` skills that `openspec init` installs already read that output, so no skill needs editing for the flow to reach the agent.

## Choosing a schema

Every gate costs agent runs, so the flow scales with the change. `devkit-lite` is the default in the project template; both schemas start with the requirements grill, and you choose `devkit` when the change also needs an independent plan review, the owner's plan approval and implementation by a dedicated agent.

| Use `devkit` (full) when ANY holds | Otherwise `devkit-lite` (default) |
|---|---|
| A new capability, or behavior changes in more than one area | One area, a few files |
| A public contract changes: API, event, shared schema, data model, migration | Internal change |
| Auth, permissions, money, personal data or secrets | None of those |
| Hard to roll back | Easy to revert |
| The request is ambiguous | The request is clear |

```bash
openspec new change add-csv-export --schema devkit
```

```bash
openspec new change greet-language
```

## The `devkit` schema

Every stage the flow runs is declared in the schema, in order, and each stage names a role, not a tool (see [roles.md](roles.md)).

```text
requirements ─▶ (mockup, decisions) ─▶ proposal ─▶ specs ─┐
                                            └──▶ design ──┴─▶ tasks ─▶ readiness ─▶ approval ─▶ apply
apply (implementation ─▶ unit-tests, e2e-tests ─▶ evidence ─▶ review) ─▶ delivery ─▶ retro
```

| Artifact | Role | Contents |
|---|---|---|
| `requirements.md` | `change-coordinator` with the owner (`requirements-grill`) | The request in the owner's words, confirmed assumptions, acceptance criteria with ids (`AC-1`...), out of scope. If the owner skips the grill: the derived criteria and `Grill: skipped by owner` |
| `mockup.md` | `screen-designer` | The screen mock-up, drawn only when the grill's classification lists `ui` and before the proposal exists; the owner approves it |
| `decisions.md` | `adr-author` | The decisions and ADRs the change needs, proposed before the proposal exists; the owner's plan approval accepts them |
| `proposal.md` | `change-planner` | Why, what changes, acceptance criteria (copied with their ids), capabilities, impact |
| `specs/**/spec.md` | `change-planner` | Requirement deltas with WHEN/THEN scenarios |
| `design.md` | `change-planner` | Context, decisions with alternatives, risks, migration |
| `tasks.md` | `change-planner` | One `## N.` group per phase, each ending with a gate task naming the test command; every AC id covered |
| `readiness.md` | `plan-readiness-reviewer` (never written by the author) | The readiness report; its Decision section has exactly one `- Status: APPROVED`, `NEEDS-REVISION` or `BLOCKED` |
| `approval.md` | the owner | The owner's plan approval, written by the main session from the owner's message |
| `unit-tests.md`, `e2e-tests.md` | `test-runner`, `e2e-tester` | The test runs, only when the project declares `devkit.tests.unit` or `devkit.tests.e2e`, and not once `evidence.md` exists |
| `evidence.md` | `pr-verifier` | The gates and criteria proof, with its `Commit:` line |
| `review.md` | `review-bench` | The summary of each review round |
| `retro.md` | `change-coordinator` with the owner | What the change taught and the proposed updates |

`apply` requires `approval`. Its instruction tells the main session to dispatch the `tdd-implementer` agent once per phase, run `pr-verifier` (it writes `evidence.md`; a defect it records is fixed by `tdd-implementer` and verified again), then run `review-change` (each reviewer agent writes `reviews/<reviewer>.md`) and finally `commit-and-pr`. The main session coordinates; the subagents do the work, and the hooks make sure of it. A stage may declare when it applies: a flag of the grill's classification, a setting of the `devkit:` block, or a later stage the change has not reached. A stage whose condition does not hold, or that the change had already passed, leaves no file, `flow-check` says why in the stage's line, and a change under way is never sent back to it.

**Test settings.** The unit and E2E stages run only when the project declares their commands in the `devkit:` block of `openspec/config.yaml`; a stage whose command is absent does not run, and the phase gates of `tasks.md` carry the proof.

```yaml
devkit:
  language: en
  driver: claude
  tests:
    unit: "npm test"                 # the whole unit suite
    coverage:
      command: "npm run coverage"    # prints the total coverage
      target: 80                     # whole number, percent; absent: coverage is recorded, never fails
    e2e: "npm run e2e"               # absent: the E2E stage does not run
```

`/openspec-setup` asks for the values. The E2E tests the `e2e-tester` writes are a product commit, so the unit and E2E stages run once more after it; the rerun finds the tests present, and it is bounded.

## The `devkit-lite` schema

For small, contained changes, with or without a spec-level behavior change.

```text
requirements ─▶ proposal ─▶ specs (optional) ─▶ tasks ─▶ apply
```

The same stages as `devkit` without `mockup`, `decisions`, `design`, `readiness` and `approval`: it has no mock-up and no decisions stage, runs the unit and E2E tests when the project declares their commands, starts with the requirements grill, has no readiness gate and no separate plan approval (the go-ahead is the owner's message to ship), and the main session may write the code itself. Write a spec delta when the proposal lists a capability; otherwise set `skip_specs: true` in the change's `.openspec.yaml`. The PR still needs `evidence.md` and the reviews (`code-quality-reviewer` and `test-coverage-reviewer` at least). If the change turns out to meet a full-flow criterion, recreate it with `--schema devkit`.

## The `devkit-project` schema

For defining a new project, or one slice of it, before building it. It is not a change flow and not an opt-in schema: a project still opts the hooks in by selecting `devkit` or `devkit-lite`.

```text
open ─▶ business ─▶ domain-model ─▶ architecture ─▶ implementation-plan ─▶ roadmap ─▶ review ─▶ delivery
```

Each stage record (`business.md`, `domain-model.md`, `architecture.md`, `implementation-plan.md`, `roadmap.md`, `review.md`) opens with the stage header and is `passed` only from the owner's own words, or `not-applicable` with its reason. The documents themselves live in `docs/design/<slice>/` and the new ADRs in the ADR folder. The `review` stage is the `adr-reviewer`'s verdict on the new ADRs. There is no readiness, approval or tasks stage, and no spec delta: OpenSpec marks the change `skip_specs`.

## The stage header and `flow-check`

Line 1 of every stage file is a comment, so OpenSpec's strict validation and GitHub's rendering ignore it:

```text
<!-- devkit-stage <stage> result=<passed|failed|not-applicable|pending> attempt=<n> commit=<sha|none> -->
```

`<stage>` is the stage id of the schema; `pending` is what a template says (written, not judged yet); `attempt` is 1 on the first write and one more on each rewrite; `commit` is `git rev-parse HEAD` when the stage was produced. The reviewers' own files under `reviews/` keep `Verdict:` on line 1 and carry no header; `review.md` does. Each schema folder also holds `flow.json`, which declares the stages in order with their role, their file or source, and how many failed attempts they get, and `flows/<n>.json`, a copy of every released version of that declaration (`flows/<version>.json` holds the same bytes as `flow.json`).

`flow-check` is a script that reads those headers, OpenSpec's own status, the task list and git, and says which stage passed and which comes next. It runs no model and no network call except `gh`:

```bash
node <devkit>/plugins/openspec/hooks/flow-check.mjs add-csv-export
```

The output is a line per stage, then the next stage, who runs it and why, or one of four ends (archived, waiting for the owner, waiting on GitHub, blocked). `--json` prints the same facts (`version` 1, with a `flow` key: the version the change follows, the installed one and whether the change is pinned), `--lang pt-BR|en` picks the language (default `pt-BR`), and `--after <progressKey>` stops a loop that changed nothing. Exit codes: `0` next stage, archived or previous script; `1` waiting; `2` blocked; `3` usage error or an OpenSpec other than 2.x. A change began under the previous script when the earliest stage file it has (the first stage of the script that has any file) carries no header: the readout says so and today's flow (`ship-change`, led by `deliver-check`) finishes it. One headed file added later, such as a `readiness.md` written by a current agent, does not change that. The checker runs the project's own OpenSpec CLI (see below). The tested OpenSpec version is 2.0.0. The checker counts the task list as OpenSpec does, less the lines inside fenced examples, which are not tasks.

**The flow a change follows.** A change opened from devkit-openspec 0.31.0 on records two keys in its `.openspec.yaml`, after OpenSpec's own lines: `x-devkit-version`, the pack version that opened it (information only), and `x-devkit-flow`, the version of its script's `flow.json` that the change follows. Only `x-devkit-flow` decides: every reader of the change's stages (the readout, the change, roadmap and project loops, the edit hook, the CI check, the conductor and the locks) reads `flows/<x-devkit-flow>.json` of the script folder. A change with no `x-devkit-flow` (opened before this release, or on a script with no `flow.json`) follows version 1, the declaration that shipped when the key did not exist; `flows/1.json` keeps that content, so replacing the schemas with a newer release does not change the stages such a change is asked. When the installed `flow.json` is newer than the one a change follows, the readout adds one line under its title (`Flow: this change follows version 1 of the devkit script; version 2 is installed. To move it: change-loop.mjs flow add-csv-export.`, or its `pt-BR` form), and `--json` says it with `"flow": { "version": 1, "installed": 2, "pinned": true }`. A recorded version that is not a whole number from 1, or whose `flows/<n>.json` is not installed, stops the checker with a usage error (exit 3) that names the value and the file.

A change to a `flow.json` raises its `version`: the new bytes are copied to `flows/<n>.json` and their digest is recorded in `scripts/released-flows.json`. `scripts/check.py` refuses a `flow.json` that differs from `flows/<its version>.json`, a kept file whose digest is not recorded or does not match, and a digest with no kept file, so a released version cannot change under the changes that follow it (see CONTRIBUTING.md).

**Released flow versions.** `devkit` and `devkit-lite` are at version 2 from devkit-openspec 0.33.0 on: version 2 adds the `requirements-triage` helper to the grill (the `helpers` of the `requirements` stage), and every other stage is as in version 1. A change opened from that release on records `x-devkit-flow: 2` and has the triage answer first the grill questions the project's files settle; a change on version 1 keeps its grill with no triage until it is moved with `change-loop.mjs flow <id>`, which is run on the owner's request only (a change on version 1 is one opened before that release, or with no recorded flow), and the `helpers` of the loop's grill action tell the skills which of the two it is. `devkit-project` stays at version 1: its stages did not change.

## Adopting it in a project

The `openspec-setup` skill does all of this; here is what it does, if you prefer by hand.

1. Install the OpenSpec CLI and initialize the project. devkit supports OpenSpec 2.x only. If the project pins `@fission-ai/openspec` (in `package.json`), the pinned copy in `node_modules/.bin/openspec` is the one every devkit script and hook starts, never the one on `PATH`; a declared pin that is not installed is refused with "install it", and a pin that is not 2.x is refused with the move to 2.x (`npm i -D @fission-ai/openspec@2`). With no pin, the global CLI is used:

   ```bash
   npm i -g @fission-ai/openspec@2
   ```

   ```bash
   openspec init --tools claude
   ```

2. Install the schemas into the project, so the team and CI share them (run it inside the project, no argument needed):

   ```bash
   bash <devkit>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh
   ```

   Or, for every project on this machine, add `--user`: the same command with `--user` installs under `$XDG_DATA_HOME/openspec/schemas/` and leaves the project untouched.

   A re-run replaces each schema folder with the release's, which holds every released `flows/<n>.json`, so a change opened before it keeps the flow it was opened with until you ask to move it (see [Moving to a newer flow](#the-change-coordinator-devkit-change)).

3. Copy [`templates/config.yaml`](../plugins/openspec/skills/openspec-setup/templates/config.yaml) to `openspec/config.yaml` and fill in `context` with the real stack, test command and conventions.

4. Opt the project in: enable the packs `devkit-core` and `devkit-openspec` per project, in its `.claude/settings.json` (see [getting-started.md](getting-started.md)).

## Running a change

The short way: type `/devkit change <what you want>` in a Claude Code session of the project (see [The change coordinator: `/devkit change`](#the-change-coordinator-devkit-change)); it opens the change in its own worktree and carries it to the archive. The manual path below stays as the alternative.

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

shows what is done. To know what is next, run the checker, which reads each stage file's header (see [The stage header and `flow-check`](#the-stage-header-and-flow-check)):

```bash
node <devkit>/plugins/openspec/hooks/flow-check.mjs add-csv-export
```

A new session starts by printing the same, from the session hook, plus the current round of `openspec/roadmap.md` if the project has one (see [Grouping changes](#grouping-changes-the-roadmap)).

Name the branch after the change: the hooks use it to know which change you're working on.

A change is delivered when its own pull request is merged and every task of its `tasks.md` is ticked on the default branch. A pull request that only names the change in its body or in its branch name does not count, and neither does an archive pull request. A task that can only be done after the merge is ticked in a further pull request of the same change, opened before the archive. A checkout that is not the change's branch then stops with the `stop-branch` step, whose reason says `PR #<n> of <id> merged with tasks left (<ids>); continue on branch <id> and open a further pull request`. A change whose archived folder is already on the default branch is not listed as unfinished, whatever checkout still holds its branch; a new change that reuses the id, created on a later day than the archive, is listed.

## Grouping changes: the roadmap

OpenSpec lists changes flat. To keep rounds, the order between them and "where are we in the plan", write `openspec/roadmap.md`:

```markdown
# Roadmap

## Round 1: auth
- [x] auth-scopes

## Round 2: exports
- [ ] add-csv-export (after: auth-scopes)
- [ ] export-audit-log
```

- Each `## ` heading is a round; each `- [ ] <change-id>` line is a change, optionally with `(after: a, b)` and a description after it (`- [ ] add-csv-export (after: auth-scopes) - export the table as CSV`). Indented lines under a change are its notes. The description and the notes are what a reader of the roadmap (the panel, `conduct-check`) shows for a change; the session report ignores them. Anything else in the file is ignored.
- The current round is the first one with an unticked line.
- At session start, after the active change, the hook prints the current round, `done/total`, and the state of each unticked change, read from disk:

  | State | Means |
  |---|---|
  | `archived, tick it` | The change is only in `openspec/changes/archive/`; tick its line |
  | `waiting on <ids>` | A change in its `after:` list is not ticked yet |
  | `open` | The change folder exists |
  | `not started` | No folder under `openspec/changes/` yet |

  When more than one applies, the first row wins: an open change whose dependency isn't ticked shows as `waiting on`.

- It is printed with one active change, several, or none, so a fresh session on `main` sees the plan too.
- The session report only reports. The hook never writes the roadmap: tick a line by hand (or let the agent do it) when the change is archived. `/devkit roadmap` starts the ready changes by `after:` and the tick only reports; `/devkit change` and `/ship-change` on their own enforce no `after:`. Run each change of a round in its own session and branch, or let `/devkit change` open each in its own worktree; the roadmap is the shared checklist between them.

## The change coordinator: `/devkit change`

`/devkit change <what you want>` runs one change from your request to its archive, in your own Claude Code session. It is one of two ways to drive this flow from gate to gate: the other is the CompozyOS delivery loop (`devkit-compozy`), a supervised multi-agent run over the same artifacts, checkers and owner gates (see [docs/compozy-kit.md](compozy-kit.md)). Neither replaces the other. The decision is [ADR 0010](adr/0010-openspec-as-the-harness.md), and [ADR 0011](adr/0011-the-change-coordinator-is-the-owners-session.md) says why the coordinator is your session, held by hooks. `/devkit change` replaced the `/conduct` skill (ADR 0005, ADR 0006 and ADR 0007 describe the older design); a change begun under the previous script is still finished with `ship-change`.

**The verb and its forms.** The `devkit` skill of devkit-openspec (`plugins/openspec/skills/devkit/SKILL.md`) reads its arguments through a quoted heredoc and hands them to `node <devkit>/plugins/openspec/hooks/change-loop.mjs start`, which decides and creates nothing. A model never starts a run by its own choice (`disable-model-invocation`). The forms:

- `/devkit change <free text>`: a new change from your request. With another change unfinished, you are asked first whether to continue it or start the new one.
- `/devkit change <Jira key or link>`: a new change from that Jira task (`PROJ-482`, a browse link or a board link), or the unfinished change that already records the key.
- `/devkit change <id>`: continue that change, whether its folder is active or already archived.
- `/devkit change`: continue the only unfinished change, or ask which when there are several.
- `/devkit roadmap` and `/devkit status` run the roadmap coordinator (see [the roadmap coordinator](#the-roadmap-coordinator-devkit-roadmap-and-devkit-status)); `project` is built and only `help` is not (round 23, which says so); any other verb is refused.

A project that is not set up (no `openspec/`, or a schema other than `devkit` or `devkit-lite`), and a `devkit:` setting outside its accepted values, are answered in one line and nothing is created. The driver `compozy` or `script` says its round (21 or 22): only `claude` runs today.

**A Jira task.** A key typed alone (`PROJ-482`) or a Jira browse or board link naming one is read as a task, not as free text. The session reads the task through its own Atlassian connector; `change-loop.mjs` makes no call and keeps no token, and the project keeps no Jira setting. `open --task <KEY>` writes a `Jira: <KEY> <link>` line and the quoted title, description and acceptance-criteria field under `## Request` in `requirements.md`, and nothing else of the task, so the grill asks only what the task leaves open. Typing the key again resumes the unfinished change that records it, and a second change for the same key is refused. When the pull request opens, the session asks once whether to write its link on the task: a comment, a comment and a move to one of the task's transitions, or no. Nothing is written to Jira until you answer, the delivery goes on meanwhile, and the question and its answer are recorded in the git common directory, so it is never asked twice for the same pull request and nothing is written after the archive.

**Opening a change.** Typing `/devkit change <text>` is the go-ahead: the session names the id (kebab-case, at most five words) and chooses the script with one rule (`devkit-lite` only for a small, easy-to-undo change that touches no screen, no boundary and no contract; `devkit` whenever in doubt), saying why, without a question. `change-loop.mjs open` then creates the worktree `<main checkout>/.claude/worktrees/<id>` on the branch `<id>`, cut from `origin/<default branch>` after a fetch (from `HEAD` when there is no remote), writes `.openspec.yaml` naming the script and `requirements.md` with a pending header and your request under `## Request`, and refuses an id already taken or a project not set up. With an `origin` remote it then commits the change's folder (the request and the machine's name) and pushes the branch at once; an id whose branch is already on `origin` with a change folder is refused, naming the machine it is open on. `change-loop.mjs script <id> <script>` switches the script until the plan is written; the grill may also correct a wrong guess.

**The loop.** `node <devkit>/plugins/openspec/hooks/change-loop.mjs next --change <id>` prints `devkit-run: <id>`, then `devkit-end: <id> <state>` when the action is an end, and one JSON action: an `agent` hand-off (the role, a brief naming the role, the change and the stage, and the language of the files), a `session` step the coordinator does itself (a review round, a gate command, a rebase), the `grill`, or an `end` in one of four states (archived, waiting for the owner, waiting on GitHub, blocked), each with its reason and a reply in your language. Every action also carries `state`, the change's state (see [A change's state](#a-changes-state) below). Which checker decides what: [`flow-check`](#the-stage-header-and-flow-check) decides the stages up to the plan's approval (the owner's `approval.md` included) from the stage headers, and, from the implementation on, the same engine as `deliver-check` and the delivery rows of the `conduct-check` section below decide the step, except the unit and E2E tests, which `flow-check` alone decides (the loop reads their commands from the `devkit.tests` settings); the loop copies their decision and adds none. A drawn mock-up ends the run waiting for the owner, who approves it or asks for changes (which send it back to its designer), and once the plan approval is recorded the loop has the session run `accept-decisions`, which marks the records `decisions.md` lists as accepted. The stages run in the foreground, one per hand-off, and the loop calls `next` again after each. A stage that fails, a gate that stays red or a stage the same state hands twice ends the run `blocked`, with the reason in plain words. Every reply is written without internal terms, in the person's language, a usage error included: a command the script cannot read (an unknown option, a missing argument) exits 3 and answers with one plain sentence asking for the request again, and keeps its raw message in the JSON's `error` field, which the session does not show. An end the session itself declares (a stage agent's failure, a red gate, a pull-request decision left to the owner) goes through `change-loop.mjs reply`, whose first line is the same `devkit-end:` marker.

**Attribution.** A hand-off to `commit-and-pr`, from `/devkit change`, `/devkit roadmap` or `/devkit project`, ends with a request that the session append its own attribution lines: the commit trailer and the pull-request footer it would write itself, verbatim, or `none`. The `ship-change` skill's Attribution section gives the block; the commit agent writes exactly those lines over the ones its own environment gives it, so a commit names the model of the session that did the work. A caller that sends no block gets the agent's earlier behaviour.

**Resuming and the unfinished question.** Nothing is remembered between runs: `next` re-reads the change's folder, the stage headers, git and GitHub, and the session's transcripts when a token budget is set, on every call, so a session killed at any stage resumes at the same action by `/devkit change` or `/devkit change <id>`. A dirty worktree in the middle of a run is expected and not asked about. Of ADR 0007's rules the coordinator keeps the question about unfinished work for a new request (it names each unfinished change and where it stopped, and asks before anything is created or run); a missing change is created by your typed command, not by an answer.

**Waiting on GitHub.** When the change waits on checks or on the merge, the session starts `change-loop.mjs wait --change <id>` as a background command and ends its turn. The command polls with no time limit of its own, holds no state and exits as soon as GitHub's answer changes the decision; its end calls the session back, which runs `next` and goes on. A GitHub that does not answer is itself a wait on GitHub ("GitHub did not answer"), not a block; a failed read is retried, and three in a row end the wait blocked, quoting GitHub's error. If the session is gone, `/devkit change` starts a new wait: nothing was lost.

**A change's state.** `node <devkit>/plugins/openspec/hooks/change-loop.mjs state [--change <id>] --lang <pt-BR|en>` prints one JSON, `{"version": 1, "changes": [...]}`, with one entry for `--change` and one per unfinished change without it. Each entry holds `change`, `state`, `reason`, `stage`, `stageTitle`, `phase`, `stageIcon`, `stateIcon`, `title`, `script`, `root` and `branch`. The `state` is `running`, `waiting-for-owner`, `waiting-on-github`, `blocked` or `archived`, and `reason` is `null` or a `code` with its `text` in the person's language: `running` has the reason `ready` (nobody works on the change yet) or none; `waiting-for-owner` has `grill`, or the end's reason (`waiting-approval`, `waiting-approval-again`, `waiting-mockup`, `waiting-retro`, `waiting-merge`, `waiting-archive-merge`, `waiting-review-dispute`, `waiting-unrun-stage`, `waiting-by-hand`, `waiting-pr-decision`); `waiting-on-github` has what it waits for (`checks`, `merge`, `archive-merge`, `silent`); `blocked` has the blocked end's reason; `archived` has none. The state is derived on every read, in one function that `next`, this command and `/devkit status` share, from the change's files, git, GitHub and the roadmap run file, and it is stored nowhere. In a roadmap run the run file weighs first: an end the session declared, a stage or wait in flight, and, in a run with a session per change, a change with no session of its own, which reads `running` with the reason `ready`; otherwise the state is the loop's action. The command writes nothing, calls no AI and prints no `devkit-run:` marker, so it never counts as a run; `/devkit status` places its rows by it, and the side panels read this command. [ADR 0017](adr/0017-a-change-state-is-derived-in-one-place.md) records the decision.

**The locks (devkit-openspec 0.16.0).** Three more modes of `guard.mjs` hold a run. A run is under way when the newest slash command typed in the session is `/devkit change` and the loop has printed its `devkit-run:` line after it, both read from the session's transcript. In a run: `stop` refuses the session's attempt to end its turn while a stage is ready, once per unchanged state, naming the stage and the command that gives the next action (it lets the turn end for the grill, an end state, an end the run already recorded, a background command still running, or an interrupt; the record is the `devkit-end:` line the loop or the session's own `reply` printed, and it lasts until a later `devkit-run:` line, so a stage that failed or a gate that went red costs no refusal after the session declared the run blocked); `subagent-stop` refuses a stage agent's stop while its stage file is missing or still pending; the edit and shell-write locks refuse the main session's product code (the implementation goes to `tdd-implementer` by the loop), and the `agent` lock refuses a hand-off with no agent type, to a general-purpose agent, to another plugin's agent even when it is named like a role, and to a devkit pack that does not ship that role; it accepts a role or helper of the script by its bare name or under the prefix of the pack that ships it. Every lock lets the action through when it cannot read the transcript, the checker, git or GitHub, and none acts in a project that has not opted in. With `DEVKIT_HOOK_LOG=<file>` in Claude Code's environment each decision of the three new modes is appended to that file as one JSON line.

**The settings.** The language of the project's files lives in the `devkit:` block of `openspec/config.yaml` (`language`, default `en`; a language tag) and the driver in the same block (`driver`: `claude`, `compozy` or `script`; default `claude`). The person's language is the `language` option of the devkit-openspec plugin (`pt-BR` by default, or `en`): replies, the grill's questions and the stage readout use it, while every file of the change is written in the project's language. The script prints its replies from one message table in both languages, with no internal term.

**The token budget.** A run can carry a cap on the tokens it spends: `budget:` in the `devkit:` block of `openspec/config.yaml` for the whole project, or the same key in a `devkit:` block of a change's own `.openspec.yaml` for that change, which wins. The value is a whole number of tokens above zero, digits only (`2000000`, not `2e6` or `2_000_000`); an invalid value is refused with the settings reply before anything is created or run, and with no key, or an empty one, there is no cap and nothing is read. The project value is the one in the change's own checkout. The spend is counted from the session's transcript: the sum of `input_tokens`, `output_tokens` and `cache_creation_input_tokens` of each model message recorded after the change's first run line, plus the same sum over each subagent transcript of the session that started after that line; `cache_read_input_tokens` is left out, and a message recorded on several lines counts once. A new session counts from zero. The loop checks the cap between hand-offs only, in `next` and in the `session-next` of a roadmap change session (never in the poll of `session-wait` or in the stop lock's read): at or above the cap, the next hand-off or session step becomes an end waiting for the owner, whose reply says the tokens spent, the cap and the absolute path of the change's `.openspec.yaml`, where `budget` is raised; the turn can then end. Nothing stops an agent that crosses the cap while it works. To go on, raise `budget` in that file and type `/devkit change` again: the next call gives back the hand-off the stop held, and with the cap unchanged the run stops again. The count fails open: with no session id in the host's environment, or a transcript that cannot be read, no cap applies. Only `/devkit change` runs count, those a roadmap run starts included; the roadmap coordinator's own reading does not.

**Owner gates.** The session asks you only at the owner's gates: the grill's questions, the plan approval (`approval.md`, written only from your own message) and the answer to each retro proposal. Nothing else asks you: a change moves from `not started` to `archived` on its own, except for a pull request merge in `pr` mode and the decisions the checker lists as not askable.

**Moving to a newer flow.** A change keeps the flow it was opened with until you ask for the move. When `/devkit change <id>` resumes a change whose script has a newer installed flow, the reply holds a second line saying so (and that the change moves only if you ask). When you ask, the session runs `node <devkit>/plugins/openspec/hooks/change-loop.mjs flow <id> --lang <l>`: it records the installed flow's version in the change's `x-devkit-flow` (and the pack version in `x-devkit-version`), leaves every other line alone and says which version the change followed and which it follows now. A change already on the installed flow is left as it is; a change on a flow newer than the installed one is refused (update devkit in the project first). No stage, proposal or task state refuses the move: your request is the gate, and the stages the new flow adds or removes show in the next readout. No other command writes the pin: `next`, `wait`, a setup re-run and a pack update leave it as it is. The one other writer is the `script` switch before the plan is written (`change-loop.mjs script`), which records the new script's installed flow.

### `conduct-check` (kept until round 24)

`conduct-check` (`plugins/openspec/hooks/conduct-check.mjs`) answers, for every change of the current round, what happens next and who does it. The loop of `/devkit change` reuses its delivery rows, its release-conflict classification and its worktree listing; the panel and the CompozyOS loop read it. It is read-only like `deliver-check`: it never writes files, refs or GitHub objects, and never fetches (run `git fetch origin --prune --quiet` first). It reuses `deliver-check` in-process, in each change's worktree, for everything from `implement` to `archived`. Its round mode and its child-session rows are kept for those readers and are removed in round 24.

```
node conduct-check.mjs [--json] [--round <n>] [--change <id>] [--busy <id,id>] [--watch[=<minutes>]]
```

Run it from any checkout of the repository. Exit 0 is a report (a blocked change is a state, not an exit code); exit 3 is a setup or usage error: no `openspec/`, no git, an unreadable default branch, a missing `origin/<base>` (the message says `git fetch origin <base>`), an unknown option or a `--round` out of range.

**One change.** `--change <id>` conducts that one change with the same engine and the same row: it never reads the roadmap, so a repository without one works, and `--round` does not combine with it (exit 3). The change must exist, else exit 3 with a prefix that says what is missing: `no change <id>:` (no worktree, branch or folder anywhere), `change <id> has a worktree without a folder:` or `change <id> is on another branch:` (the active folder is in a checkout on another branch). A change archived on `origin/<base>` with no worktree reads `archived`.

**The round (round mode).** The default branch is `default_branch` from GitHub. The roadmap is read from `origin/<base>`, never from the working tree, so a tick counts only once its archive PR landed. The current round is the first with an unticked line; with it fully ticked the next unticked round is current in the same call, and with none left `roadmapDone` is true. `--round <n>` starts at round `n`; earlier rounds with unticked lines are listed in `skipped` and never conducted. An `after:` id that is not ticked on `origin/<base>` (missing from the roadmap, or in a skipped round, included) keeps its dependent waiting.

**Worktrees.** Every change runs in its own git worktree on the branch named after it. A worktree is found by branch (`<id>` or `chore/archive-<id>`) at whatever path, so one created earlier, by hand or by the session, is reused and a second one is never made; prunable entries are ignored, and a worktree stopped in the middle of a rebase is still found. Without one:

| Facts | `next.step` | What the main session runs |
|---|---|---|
| local branch `<id>` | `worktree` | `git worktree add <path> <id>` |
| only `origin/<id>` | `worktree` | `git worktree add --track -b <id> <path> origin/<id>` |
| `openspec/changes/<id>/` on `origin/<base>` | `worktree` | `git worktree add -b <id> <path> origin/<base>` |
| nothing | `create` | ask the schema, then the same `-b` command |

The path is `<main checkout>/.claude/worktrees/<id>`, whichever worktree `/devkit change` was typed in.

**Planning rows**, first match wins, before any delivery row and only while no task is ticked (once work has started the planning gates were passed):

| Row | Condition | `next.step` | Who |
|---|---|---|---|
| C1 | no worktree, no branch, no folder on `origin/<base>` | `create` | owner, askable |
| C2 | worktree without a change folder | `new-change` | owner, askable |
| P-1 | schema has `requirements`, `requirements.md` missing | `grill` | owner, askable |
| P-2 | a plan file (`proposal.md`, `design.md`, `tasks.md`) missing | `plan` | `change-planner` |
| P-3 | `readiness.md` missing or older than the newest plan file by more than 2 s | `readiness` | `plan-readiness-reviewer` |
| P-4 | readiness `NEEDS-REVISION` | `revise-plan` | `change-planner` |
| P-4b | readiness `BLOCKED` | `stop-readiness-blocked` | owner, not askable |
| P-5 | `devkit`, no current `approval.md` | `approve` | owner, askable |

Every new change, `devkit-lite` included, first asks the owner to confirm its schema: `create` and `new-change` carry `proposedSchema` and a one-line `reason`, computed from the roadmap line's description against the criteria in the `openspec/config.yaml` header (a line with no description is proposed `devkit`, the strictest track). The answer is recorded by the change folder itself (its `.openspec.yaml`), so a resumed run never asks twice. After that a `devkit-lite` change has no owner row before its first `implement`.

**Dependency rows**, after the planning rows and before delivery, while no task is ticked, for a change with `after:` ids:

| Row | Condition | `next.step` | Who |
|---|---|---|---|
| D-1 | an `after:` id not ticked on `origin/<base>` | `wait-dependencies` (state `waiting on <ids>`) | none |
| D-2 | every dependency ticked on `origin/<base>`, but the roadmap at the worktree's `HEAD` lacks a tick | `rebase` (`git -C <worktree> rebase --autostash origin/<base>`) | main session |
| D-3 | no `audit.md`, or its `Base:` commit lacks a tick, or a plan file is newer than it by more than 2 s | `audit` | `plan-reality-auditor` |
| D-4 | `audit.md` `OUTDATED` | `revise-plan` | `change-planner` |
| D-5 | `audit.md` `UNVERIFIABLE` | `stop-audit-unverifiable` | owner, not askable |

Planning of a dependent change (grill, plan, readiness, approval) runs while its dependency is still in progress; only the delivery rows wait. A rebase left in progress is `blocked: rebase of <id> stopped`.

**Delivery rows.** Once planning and dependencies pass, `deliver-check`'s `next` is mapped to an actor and passes through unchanged: `implement`, `fix-*`, `apply-proposals` go to `tdd-implementer`; `commit`, `open-pr`, `push`, `open-archive-pr` to `commit-and-pr`; `verify` to `pr-verifier`; `retro` to a `general-purpose` subagent running the retro skill; `review` and `gate` to the main session; the small PR steps (`edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `archive`, `tick-roadmap`, `tag-release`) to the main session; `wait-checks` and `wait-merge` to GitHub; `ready`, `archive-pr-ready`, `stop-review-deadlock` and `answer` to the owner (not askable); the `stop-*` rows and `blocked` stop the change. Two overrides sit in front of that mapping:

- **Release-file conflict.** A change PR (item 5) or an archive PR that conflicts with its base is classified with `git merge-tree --write-tree --name-only --no-messages origin/<base> HEAD`. Only release files (`plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`) gives `resolve-release-conflict` (with `paths`). Once that merge is committed and not pushed (the local head holds `origin/<base>` and is ahead of the PR head, which GitHub still reports in conflict), the same override gives `push` on a change PR and `open-archive-pr` on an archive PR, with the command `git push origin <branch>`: a plain push, never a force push. Any other path is `blocked: item 5 (conflict in <paths>)` or `blocked: archive (archive-pr): conflict in <paths>`; a clean merge (GitHub's view is stale) is `update-branch` in `merge` mode. A clean merge whose PR head is not in the local history (someone else pushed, or an earlier version rebased the branch) is `blocked: item 5 (PR #<n> head <sha> is not in local history)`, or `blocked: archive (archive-pr): …` on an archive PR, never `update-branch`. A conflict in `docs/openspec-flow.md` counts as a release conflict when its only conflict is the CI pin (the three versions, pins masked, merge cleanly with `git merge-file -p`); any other conflict in that file is blocked like any other path.
- **Archives are serialized.** A change at `archive` waits (`waiting on <id> (archive)`) while another conducted change has an archive branch, and the later of two changes that both want to archive waits for the earlier one, so two archive PRs never tick adjacent roadmap lines. Retro and answers still run in parallel.

**Release-file conflicts: `release-merge.mjs`.** When a change PR (or an archive PR) conflicts only in release files, the `resolve-release-conflict` step runs, in the change's worktree, `node <plugin>/hooks/release-merge.mjs --base <base> [--json]`. Several changes bump the same version lines, so the resolution is a rule, not a merge:

- **Classification.** The conflicted paths must all be in the release list (`plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`, the same list ADR 0003 exempts). Any other path, a manifest edited beyond its version fields (a `description`, a new pack), a catalog conflict without `scripts/gen-catalog.py`, or a CHANGELOG that does not hold exactly one new entry, aborts: the merge is undone, the branch is at its old head with no merge in progress, the working tree is as it was, the exit code is 2 and `conflicts` (or `error`) says why. The change then stays `blocked: item 5`. The one addition to the list is `docs/openspec-flow.md` when its only conflict is the CI pin: a pin line is a line holding one of the markers `pinned to the commit of v`, `<commit sha of v`, `git/ref/tags/v` or the prose form (`v<version>` above), and a pin is every `v<version>` on such a line (a marker line may hold none). The script merges the merge base, the base's side and the change's side of the file with every pin masked, using `git merge-file -p` in a temporary folder it removes, and the file is resolved when that merge is clean. A conflict in the file beyond the pin aborts like any other path. The release list itself, and the ADR 0003 exemption, do not change.
- **The merge keeps the base's side.** The script refuses to start (exit 3) with an uncommitted change to a tracked file outside `openspec/` or a rebase in progress, and aborts a merge an earlier run left in progress and starts again. It runs `git merge --no-ff --no-commit origin/<base>` and keeps the base's side of each conflicted release file. During a merge that is `git checkout --theirs`: `--theirs` is `origin/<base>`, `--ours` the branch. The change's side is not lost: it is read from the old head. The merged pin file takes the resolved devkit-openspec version. When the base has none, a conflicting pin aborts with an `error` starting `cannot set the pin:`.
- **The version rule.** For each pack whose `plugin.json` version differs between the merge base and the old head, and for `metadata.version`, the final version is the base's version with the change's own bump applied: base 0.7.0 over a change that went 0.6.0 to 0.6.1 gives 0.7.1; a change 0.6.0 to 0.7.0 gives 0.8.0; a change that did not touch a version keeps the base's. The manifests are rewritten from the base's text (key order and 2-space JSON kept), whichever file happened to conflict.
- **CHANGELOG.** The change's own entry (the one not in the merge base) is renumbered to the new `metadata.version` and placed above the base's newest entry; every base entry is kept.
- **Catalog.** With a catalog conflict, or any manifest rewritten, `scripts/gen-catalog.py` runs.
- **The merge is committed, never pushed.** The script stages each file it rewrites and commits the merge as `chore(release): merge origin/<base> and renumber the release above it`. The new head is a merge commit whose parents are the old head and `origin/<base>`, and the PR's head stays an ancestor of it. A failure before the commit (a hook, the generator) aborts as in "Classification". The subagent runs the project's test command and stops on red. Every pin in the doc is rewritten to the resolved devkit-openspec version (the base's version when the change did not bump the pack) and the file is listed in `files`; a project without a devkit-openspec pack gets no rewrite. The renumbered files are outside `openspec/`, so the evidence and every review are stale after the merge (the first-parent rule of "The `Commit:` staleness rule"). `verify` and `review` run again, then the plain push of "Release-file conflict" above. ADR 0002 accepts that cost ("Strict up-to-date re-runs stale reviews").

A merge of `main` that only resolves release-file collisions runs `check.py`, `gen-catalog.py --check`, `claude plugin validate .` and the suites of the conflicted test files; the whole guard suite runs once, in the evidence stage that follows. After every merge of the base, before the evidence, run `openspec validate <id> --strict`; copy any scenario main added to a requirement the change modifies into the delta verbatim; and search the canonical specs and the tests again for the names of the steps and rules the plan removes. While a change is in delivery, every merge of the base that touches a file outside `openspec/` makes its evidence and all its reviews stale and can take the release numbers it picked: from the first stale cycle the coordinating session holds the other merges to the base until the change's pull request lands, and the change takes its release numbers at its last merge of the base.

**The result.** `--json` (`version: 2`; version 1 had `wake`, now removed) carries `base`, `mode` (`round`, or `change` with `--change <id>`), `change` (the id, or null in the round mode), `round` (`n`, `title`, `done`, `total`; null in single-change mode, where no roadmap is read and `startedAt` is null too), `startedAt`, `skipped`, `roadmapDone`, and one entry per conducted change: `id`, `round`, `after`, `text`, `notes`, `schema`, `worktree`, `branch`, `base`, `sessionPrefix`, `unfinished` (null, or `dirty` (uncommitted paths outside `openspec/`), `phases` (half-done phase numbers) and a `summary`, on a row with a worktree), `next` (always `step`, `actor` and `reason`, plus the step's own fields; `agent` for a subagent or a session, `askable` for an owner row), `state` and `deliver` (`deliver-check`'s `summary`, `met` and `next`, or null before delivery); a row whose `next.actor` is `session` also carries `session`. Then `dispatch`, `owner`, `github`, `stopped` and `busy` (ids) and `end`. Every change has exactly one `state`: `ready to run: <step>`, `running` (it is in `--busy`), or, when nothing can move, one of `archived`, `waiting on <ids>`, `waiting for the owner: <gate>`, `waiting on GitHub: <what>`, `blocked: <reason>`. The human output is one `<id>: <state>` line per change, then `dispatch:`, `owner:` and `github:`.

- **`dispatch`** lists the changes whose actor is a subagent, the review, a gate or the main session, in roadmap order, without the `--busy` ids, at most 3 minus the busy ones (the main session's steps take seconds and are not capped). A change has one next step, so two dispatched steps never belong to the same change. A blocked change does not stop the others: its dependents read `waiting on <id>` and independent changes keep their rows.
- **`end`** is true when `dispatch`, `owner` (the askable gates) and `busy` are empty: nothing can move without GitHub or the owner.
- **The watch.** `--watch[=<minutes>]` (default 9, at most 30) applies only at `end` with a change waiting on GitHub. It polls the waiting changes every `DEVKIT_POLL_SECONDS` (default 60) until one of them moves or the cap is reached, then returns the recomputed round with `watch: { minutes, timedOut }`.
- **`session` and `sessionPrefix`.** In the Claude desktop app (`DEVKIT_HOST=app`, or `CLAUDE_CODE_ENTRYPOINT=claude-desktop`) a change at `implement` has `next.actor: "session"` (the `tdd-implementer` runs in a child session); in the CLI it stays a `subagent`. A `session` row carries `session: { title, name, cwd, branch, phase, brief, background }`: `title` is `<id>: phase <n>`, `name` is `<prefix><n>` (at most 24 characters of `[a-z0-9-]`), `cwd` the change's worktree, `brief` the prompt the child receives and `background` the round and roadmap context. `sessionPrefix` is on every change row, whatever its step: the `name` without its phase number (`<id cut to 20>-p`, or the id cut to 18 plus two hex characters of its SHA-1 when two conducted ids collide), the same for every phase, so a caller finds a change's children with `^<prefix>[0-9]+$`. A session counts against the cap of three like a subagent.

## The roadmap coordinator: `/devkit roadmap` and `/devkit status`

`/devkit roadmap [<n>]` runs the changes of `openspec/roadmap.md` from your own Claude Code session, which coordinates the roadmap: it starts every change whose `after:` dependencies are archived, up to `<n>` at once (1 when you give no number), and keeps going until the roadmap is done, nothing can move without you, or you stop it. `/devkit status` shows where everything is. The decision is [ADR 0013](adr/0013-the-roadmap-coordinator-is-the-owners-session.md), which amends ADR 0010 and ADR 0011: the session is the roadmap coordinator. In the desktop app each change runs in a session of its own, nested under yours ([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)), and your gates are asked there. Where the host cannot start sessions, the session is also the change coordinator of every open change, and each stage runs as a subagent in the background, one level deep, as in `/devkit change`; your gates (the grill, the plan approval, each retro proposal) are then asked in the session, one change at a time, while the changes that do not wait on you keep running.

**The forms.** `/devkit roadmap` runs with one place; `/devkit roadmap 3` with up to three changes at once (a whole number from 1 to 99, written in digits); `/devkit roadmap stop` asks the run to stop (below); `/devkit status` prints the board. Calling `/devkit roadmap` again resumes: the changes under way are found again from their files and none is opened twice, and a number typed again replaces the old one (lowering it never interrupts a change under way). A number that is not a whole number from 1 to 99 is answered in one line and nothing starts. The commands are routed by `change-loop.mjs start`, which returns the mode `roadmap` or `status`; the skill then calls `node <devkit>/plugins/openspec/hooks/roadmap-loop.mjs`. `project` is built (see below) and only `help` is not.

**The lines.** Each unticked line of the roadmap is read once per call, the first match winning: archived and ticked, archived and not ticked (listed as "archived, its line not ticked yet"), ticked and not archived (listed, never started), open on the previous script (left alone and announced once as skipped), open on the current script (it fills a place), a change that could not be opened (blocked, it keeps its place), not open with every `after:` change archived (ready; the board says it waits for a place only when the places are taken), and not open with an `after:` change not archived (waits for it). Archived means what `/devkit change` already counts: the archive folder or the default branch; the tick reports and gates nothing. Changes that are not on the roadmap are listed on the board and never touched.

**Opening every change at the start ([ADR 0021](adr/0021-a-roadmap-run-opens-every-change-at-its-start.md)).** Where the host can start sessions, the first decision on your typed turn opens every unticked, unarchived line of the roadmap and starts its session; the places count only the changes whose current stage is the implementation, a test stage, the evidence or the review, so plans and grills go on while others build. The run writes a one-use ticket for each change into its own file and into the session's task, below `/devkit change <id>`. The entry is the skill `devkit-session`, which the model may call: a hook on the Skill tool lets it run only when the session's first message is the host's started form carrying a ticket the run recorded for that change and no other session claimed, and refuses in every other case, even when it cannot read; your typed `/devkit change <id>` still works. The `devkit` skill stays yours alone. A change session waits in itself, through a background wait, for a place, for the load or for its `after:` dependencies, and no plan file is written before those dependencies are archived: the change merges the default branch (`roadmap-loop.mjs merge-base`) and then plans. While it waits, its state is `running` with the reason of the wait, and its title is `⏳` and the id; once it goes on, the title is its stage's again. A wait on GitHub keeps `⏳` beside the stage icon, and your gates keep `🙋` beside it. With the `machines` setting set the load picks the machine ([ADR 0020](adr/0020-a-change-can-run-on-another-machine.md)): a loaded machine opens no change, each opening goes to a machine that answers and is held only when none does; a change opened for another machine starts there with the typed form and no ticket, so its grill is asked in its own session. With the `machines` setting set, a change session of this machine on the run's ticket takes its place from the run's own count, and its plan on `origin` is no place taken; a change counted from `origin` (another machine's, or one of this machine whose session claimed no ticket) keeps ADR 0020's places, so with both kinds at once this machine can hold more places than the run's number, and the board's row of this machine then reads above it. `/devkit change` alone never schedules anything.

**The gates in the coordinating session.** The grill, the plan approval and the retro answers of every change session are asked in your session, one change at a time, in roadmap order, and each answer is written into that change's files; the change session goes on when its wait sees the file change. Every other gate stays in the change session. The coordinating session hands no stage: it may hand the grill's triage agent `requirements-triage`, which answers the questions the change's own files settle and never writes a file, so only the questions nothing settles reach you. After each grill the change's branch is pushed (`roadmap-loop.mjs push`, by path, retried on the next decision when an index lock stops it). A change whose plan names an ADR number a sibling took on the default branch is renumbered by the release step (`renumber-adr`), with no question.

**The periodic check and the cleanup.** While a run lasts, the coordinating session holds one session cron, about every 30 minutes (`schedule-check`, `delete-check`). A firing has the triage answer ahead, hands a freed place to the first waiting change, stops the run's stale wait loops, archives the sessions of archived changes, and speaks only when something changed; it never writes a plan approval or a retro answer, hands a stage or starts a session. The host expires a recurring cron after 7 days, so the run reads the cron list on every typed turn and every firing and creates the check again when it is gone. The run's end deletes the cron (one already gone is no error), stops its wait loops and archives the sessions of archived changes; an archive that is refused or pending is tried again later.

**The run file.** The number the run was given (`places`), whether a stop was asked (`stopping`), which change's gate you are being asked (`asking`), which stages and waits are under way (`inflight`), the starts handed and not yet open (`starting`), whether a held start was announced and which process watches the load (`held`, `holding`), the ends the session declared and the events already announced (`declared`, `announced`), the session that runs the run (`session`), whether each change runs in a session of its own, which change sessions were started and what started the last turn (`changeSessions`, `startedSessions`, `turn`), which changes the run opened for another machine (`placed`), and the form of the file and its last write (`version`, `updatedAt`) live in one file, `<git directory>/devkit/roadmap-run.json`, outside every working tree and never committed. A watch of the load whose process ended counts as none, so a killed watch holds nothing. Nothing else is remembered: a session that is compacted or new reads the files, GitHub and this file again. A run started from another session starts the file from empty, so what a dead session left under way is not trusted. There is one roadmap run per repository: two sessions running `/devkit roadmap` in it would share the file.

**The load.** A start is held while the processor load of the last minute, per logical core, is at or above the limit: the `load_limit` option of the devkit-openspec plugin (a whole number of percent, 80 by default; a limit above 100 lets a start through a heavier load, which is how you force one). Memory is not measured. A held start is announced once and checked every minute in the background, and it begins by itself when the load falls; you can also tell the session to start anyway, and the held starts begin at once (the next start is held again); a change under way is never touched by the load. On Windows the system reports no load, so the machine never counts as loaded and no start is held.

**A session per change.** In the desktop app, the session you typed `/devkit roadmap` in coordinates the roadmap only: it picks what starts, opens the change, holds for the load and shows the lines and the board. Each change it starts or resumes runs in a session of its own, started in the change's worktree with `/devkit change` for that change and nested under yours; that session is the change's coordinator, so the grill, the plan approval and the retro questions are asked there, and each session writes in its own worktree. The coordinating session hands no stage. A change session's title is the icon of the stage it is in and the change id while the change runs: ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery, 📦 archive. While the change is stopped the title also carries its state icon first, 🙋 waiting for you, ⏳ waiting on GitHub or for a place on its machine, or ⛔ blocked, as `🙋 📝 feat`, and an archived change is `📦 feat`; the session renames itself when the stage or the state changes. The app starts a session only on a turn you typed: when a change becomes ready on any other turn (another change's archive, a background task's end), a line and the board say it starts at your next message, and nothing is scheduled and no subagent takes its place. A change session you close is not restarted by the run; `/devkit change` resumes it anywhere.

**Other machines.** A run may open changes on other machines you list, so a loaded machine sends new changes elsewhere instead of holding them ([ADR 0020](adr/0020-a-change-can-run-on-another-machine.md)). Opening a change commits its folder with your request and the machine's name and pushes its branch at once, by a push that only creates the branch: the branches on `origin` are the one record of which change is open where, so no machine opens an id already open on another one, and two machines opening one id at the same time leave exactly one winner. The machines are the `machines` option of the devkit-openspec plugin, per person and never a project file: a JSON list such as `[{"host": "avel", "folder": "/home/me/repos/project", "places": 1}]`, where `host` is the name of the app's SSH connection, `folder` is the repository folder there and `places` is how many changes may implement there at once; empty (the default) runs everything on this machine. With it set, a change opens on the machine with the fewest open changes (this machine first on a tie, and skipped while its load is at or above the limit), and a start is held only when no machine can take it. A change stays on its machine until its archive. Its worktree is made there from its branch over SSH, and its session is started on that machine's connection in that worktree, nested under yours, under the same turn rules. A change takes one of its machine's places only from its implementation on, by pushing its approved plan; the grill and the plan wait for none. With no place free it ends waiting, titled ⏳; when a place frees, the coordinating session sends one message to one waiting change, which checks again. Nothing polls and nothing is scheduled. `/devkit status` lists what is open on each machine, and a machine that does not answer (asleep, its network down) reads "no answer" with its changes, which are kept as they are; the run starts no change there and opens the next ready line elsewhere. Every machine needs the same devkit-openspec version: one that answers in another form counts as not answering.

**What it decides and says.** `roadmap-loop.mjs next` prints `devkit-roadmap: <n>` (or `stop`), then one JSON: the actions (`agent` hand-offs, `session` steps, `wait`, `start`, `session-start`, `hold`; `--turn <typed|event>` says what began the turn, and a gate or blocked line says "the others go on" only when another change is under way), the owner's question (the head of the queue only), the event lines and the end. It announces one line per event: a change started, resumed, at a gate, blocked or archived, a skipped change, a held start. Moving from one stage to the next is no event: the board shows it. The run ends `done` (every line archived), `stopped`, or `stuck`, which names what each open change and each waiting line needs from you. `/devkit status` writes nothing: it prints the count of open, queued and archived changes and the places, then what waits on you, what runs (with its phase), what is blocked and why, the queue, and the changes outside the roadmap; with no roadmap it lists the unfinished changes. A first `/devkit roadmap` in a project with no `openspec/roadmap.md` offers to draft one from the unfinished changes of the current script, with no `after:`, and writes it only on your yes.

**Stopping.** `/devkit roadmap stop` hands nothing new: each change under way finishes its stage, the session lists the open changes where they stay, and the run ends. The stop lock lets the session end its turn then.

**The locks.** The three locks of `/devkit change` hold a roadmap run for every change it holds open. A change session a run started gets the entry's lock too: `guard.mjs skill` (a fourth mode) lets the `devkit-session` skill through only with the run's unclaimed ticket, and the change session's `stop` is allowed while its decision is to wait (`held`). A run is under way when the newest slash command typed in the session, `/devkit status` aside, is `/devkit roadmap` and the loop printed its `devkit-roadmap:` line after it, both read from the transcript. In it: `stop` refuses the session's attempt to end its turn while any change has a stage ready that is not under way, or a start could happen, once per unchanged state (a run whose every change is under way, waiting, blocked or at your gate ends its turn freely, and the ends call it back); a hand-off must start with the brief that names its change, name an open roadmap change and a role of that change's script, and it marks the stage as under way, which that subagent's stop clears; and the main session's product edits are refused. The end of one change releases no other. A change session a roadmap run started is a change run too: the app delivers its task in a form the run detection reads as a typed command ([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)), so the three locks hold it. In a run with a session per change the coordinating session hands nothing. Every lock lets the action through when it cannot read what it needs.

**What the live test showed.** Run on a scratch project: `/devkit roadmap 2` opened two independent changes and left the third waiting for its dependency; both went from the proposal to the review at once, each stage a background subagent (20 hand-offs allowed, 20 subagent ends recorded, none lost); the stop lock refused once while a stage was ready; a new session resumed both changes and opened none twice; the session's product edit was refused; and on a loaded machine the first start was held and began by itself when the load fell. No change reached the delivery part there (a scratch project has no remote), so a run through the pull request and the archive, many ends in a row over whole changes, and a project with many old changes are still to be proved in the first real run.

## Defining a project: `/devkit project`

`/devkit project <slice>` takes a new project, or one slice of an ongoing one, from your words through its four design phases (business, domain model, architecture, implementation plan) to one pull request, in your own session. The decision is [ADR 0015](adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md): a slice is a change on the `devkit-project` script, named after the slice, in its own worktree and branch. `project-loop.mjs` decides each call and the session carries it out; the session keeps no state, so typing the command again after the session stops resumes from the files.

**The phases.** Each phase is a conversation with you in the session; its document goes to `docs/design/<slice>/` and its record to the slice's folder. You approve each phase, or you and the session agree that it does not apply and say why. A flat `docs/design/` (today's `1-` to `4-` files and `STATE.md`) is read as context and never written. The five `devkit-design` skills still work by name; called alone they ask for the slice, write under `docs/design/<slice>/`, write no roadmap and open no pull request.

**The roadmap.** The fifth stage shows you the rounds and changes it proposes (each with its id, description and `after:`). Only after you approve them does the script append them to `openspec/roadmap.md`; a slice that ends with no change to build marks the stage not applicable, and the roadmap keeps its bytes. The flow then names `/devkit roadmap` as what runs the rounds and never starts it.

**The delivery.** The ADR reviewer checks the new ADRs against the existing ones; its verdict is the slice's only review. The slice's folder is then archived on its branch, and one pull request carries the documents, the ADRs, the appended rounds and the archived folder. It follows `ship: devkit-project:` as any script follows its entry: in `merge` mode GitHub merges it once the checks pass. No archive pull request or retro follows.

**The slice contract.** `devkit-reviews` and the `gh pr create` hook judge a slice's pull request by one contract: every stage record passed or not applicable, the ADR reviewer's verdict approved or declined, recorded with no uncommitted changes, and current (no later commit changes, against its first parent, a file under the slice's design folder or an ADR folder, so a merge of the default branch that brings another change's ADR sends the slice back to the ADR reviewer), only the slice's documents, the ADR folders, the roadmap (appended to, or untouched when the roadmap stage does not apply) and the archived folder in the diff. A selected active slice fails the check. `/devkit status` shows each slice's readout: its five stages, then the review and the pull request.

## The panel: devkit-panel

`devkit-panel` (`plugins/panel/`) is a Claude Code mod for the desktop app: a side pane that draws the change this session conducts, from what `conduct-check` and `deliver-check` answer, so you see its next step without typing `/devkit change`. It is read-only by construction: it starts no session, writes no file, submits no prompt and schedules nothing beyond its own 60 s refresh while the pane is open; `claude plugin validate plugins/panel` lists what the module calls, and no `prompt.submit`, `fs.write`, `store`, `clock.after` or `session.send` is among them. It needs `devkit-openspec` 0.10.0 or newer. Install it beside `devkit-openspec`:

```bash
claude plugin install devkit-panel@devkit --scope project
```

**Which change is conducted.** The newest `/devkit change <id>` of this session's transcript (a command text or a first line, also as `/<plugin>:devkit change <id>`; an older `/conduct <id>` still counts) names it when its arguments are `change` and one id. With free text, no id or a compacted transcript, the pane looks at this session's own child sessions (`<sessionPrefix><n>`, from the app's `mcp__ccd_session_mgmt__list_sessions`, read only when its permission is `allow`) and takes the change of the most recently active one. With neither, the pane says no change is conducted. Two changes with the same prefix are not told apart by the children, and a line says so.

**What it shows.** In an OpenSpec devkit project (the hooks' own opt-in) the main pane draws, as the owner's approved mock does: the conducted change (id, summary, repository and branch), the `Agora` box (the current step, what is left, who acts, `Continuar aqui`), ten `Passos` with where the change stands, the open tasks as `Pendências`, the change's `Documentos`, its child sessions and, folded, the other open changes with their progress. A press on a step, a pending row, a document, another change or an error line opens a second pane, the detail (Escape, `✕` or `Fechar painel` closes it; `Copiar` copies the open tasks' text on your press, and a phase whose heading says `owner-run` reads as you acting). The footer has the report's age and the next tick. The conducted change refreshes at session start, when the pane opens, at the end of each of your turns, every 60 s while the pane is open and on `Refresh`; the others at most every 5 minutes while the pane is open. A `gh` rate-limit line pauses the checkers for 15 minutes. Outside a devkit project the pane is one line and nothing runs. A one-line band above the prompt carries the conducted change (else the count in progress) and an `Abrir painel` / `Fechar painel` button; `/devkit-panel` toggles the pane, `/devkit-panel status` prints it as text, and the `mcp__devkit-panel__status` tool gives the model the same text.

**Which checker runs.** In the devkit repository and its worktrees (a root whose `.claude-plugin/marketplace.json` lists `devkit-openspec`) the pane runs the repository's own `plugins/openspec/hooks/` and the footer says `repo`. Anywhere else it runs the `devkit-openspec` installed for the project (the project-scope entry of `~/.claude/plugins/installed_plugins.json` whose `projectPath` is the root or the project above a `.claude/worktrees/<name>` checkout; a user-scope install as the fallback). Without either, the one line says to install `devkit-openspec@devkit --scope project`; a checker below 0.10.0 is one line and nothing runs.

**The buttons fill the prompt box; you press Enter.** The app accepts a session start only on a turn you typed, and a prompt a mod submits counts as automated, so every owner button only puts its text in the prompt box (`prompt.fill`), marks itself as filled with a toast, and toasts the command where no box can take it. `Conduct` always fills `/devkit change <id>`; `Ship` (on a delivery step) fills `/ship-change <id>`; `Approve` (on `stop-plan-approval` or `approve`) fills `I approve the plan of <id>` (its pt-BR form in the default language); `Answer` (on `stop-retro-answers`) fills `Approve proposal 1 of <id>` for you to edit. A press on a child session row opens it through `mcp__ccd_window__open_session_in`, only on your press and under its permission. The pack's `language` option (`pt-BR` by default, `en`) selects the texts. Details: [the pack's README](../plugins/panel/README.md).

## The gates

| Gate | Checked by | Passes when |
|---|---|---|
| Plan complete before apply | OpenSpec CLI | All artifacts that `apply` requires exist |
| Plan approved before product code | Hook on Edit/Write and shell writes | `readiness.md` contains `- Status: APPROVED` (schemas with a `readiness` artifact only) |
| Code written by the implementer | Same hook | In the `devkit` schema, the writer is the `tdd-implementer` agent |
| One writer per gate file | Same hook | `readiness.md` ← `plan-readiness-reviewer`; `reviews/<reviewer>.md` ← that reviewer; `evidence.md` ← `pr-verifier`; `finding-verifier` writes nothing; `approval.md` ← the main session only, from your own message (no subagent writes it) |
| Review and evidence before the PR | Hook on `gh pr create` | `reviews/` has `code-quality-reviewer.md` and `test-coverage-reviewer.md`, every review there says `Verdict: approved` (or `declined`), and `evidence.md` has content |
| The coordinator does not stop early | `Stop` and `SubagentStop` hooks (`guard.mjs stop`, `subagent-stop`) | In a `/devkit change` run: the session's stop is refused, once per unchanged state, while a stage is ready; a stage agent's stop is refused while its stage file is missing or pending |
| The coordinator writes no code | Same edit and shell-write hooks, and a hook on the `Agent` tool (`guard.mjs agent`) | In a `/devkit change` run the main session's product edits are refused, and so is a hand-off with no agent type or to an agent whose role the script does not list, under any prefix but its pack's (ADR 0011) |
| No destructive git | Hook on Bash | The command isn't a force push, `--no-verify`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .`, `add -A` / `add .`, or `gh pr merge --admin` |

Planning files under `openspec/`, anything under `.claude/`, and anything outside the repository stay open: you can always fix the plan.

**How roles work.** When a subagent calls a tool, Claude Code passes its type (for example `devkit-core:tdd-implementer`) to the hook; the main session has none. The guard compares that with the file's owner. A subagent can still be given a misleading prompt, so each reviewer is told to ignore verdicts suggested by its caller; the separation makes self-approval impossible by accident and visible on purpose, not impossible.

**Worktrees.** The hooks resolve the root and the change from the path being written, not from the session's directory: a file in a linked worktree (`git worktree add`) is gated by that worktree's change, `cd <worktree> && echo x > f` is judged against the worktree, and `gh pr create` after `cd <worktree>` is checked against the worktree's reviews. A session started in the main checkout therefore cannot write a worktree's product code before its readiness is approved.

**Which change is active.** `DEVKIT_CHANGE` if set; else, on a branch `chore/archive-<id>` for a known change `<id>`, that change while it is open (and none once it moved to `openspec/changes/archive/`); else the open change whose name the branch ends with, or contains; else the only open change. With several open changes and no branch match, code edits are blocked until you name the branch. With no open change, nothing is gated. On an archive branch whose change has moved, the hooks gate nothing, even while other changes are open: the archive PR is never held to another change's readiness or reviews.

**Bypass.** Start Claude Code with `DEVKIT_BYPASS=1` in its environment. A prefix inside a command (`DEVKIT_BYPASS=1 git push --force`) does not work, so the agent can't bypass on its own.

### Where the hooks act

The hooks (`session`, `edit`, `bash`) act only in a project that opted in: its `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema (`schema:` at the top level). The guard looks for that file from the session's folder upward, next to the `openspec/changes/` it finds, so a subfolder and a `.claude/worktrees/<name>` checkout use their own project's config. Elsewhere the three hooks print nothing and block nothing, destructive git included, even when the pack is loaded at user scope. `guard.mjs ci` and `deliver-check --ci` do not depend on it. A change's own `.openspec.yaml` does not opt a project in or out. The decision and its limits: [ADR 0004](adr/0004-devkit-per-project.md).

## The review round

The `review-change` skill runs the reviewer round in three stages, each with all its agents in parallel:

1. **review**: every reviewer of the bench reviews and returns its findings, the commit `git rev-parse HEAD` printed and the files it read and those of its remit it did not read. It writes no file. An answer at another commit than the round's `head`, or a partial one, fails its review stage before the verify stage.
2. **verify**: for each `blocking` or `important` finding with no disposition, three `finding-verifier` agents try to refute it, each in its own context. `nit` and `praise` are never verified. A finding is refuted when at least 2 of 3 refute it with evidence; it stays in the verdict file as ` · refuted: <evidence>` and does not count as open.
3. **write**: each reviewer writes its own `reviews/<reviewer>.md`, the verdict by its own rules from the lines it is given.

There are two paths that run the same stages and rules (one rules section, in `plugins/core/skills/review-change/scripts/review-round.workflow.js`, read by `review-round.mjs` on the second path):

- the `workflow` path runs the stages as one Workflow script in the background of your session. It runs only on a turn you typed, through a skill that names the Workflow tool, and only where the host has the tool;
- the `agents` path runs the same stages with the Agent tool, one message per stage. It runs on any other turn (a continuation turn, an Auto-fix wake, a task notification) and wherever the Workflow tool is missing or refuses. In a `/devkit change` run the review step usually lands on a turn started by a background command ending, so it usually runs here.

The files have the same shape on both paths. After the round the session checks every written file (`review-round.mjs check-file`: the verdict line, the commit line, every blocking or important line, and no `Verdict:` or `Commit:` line after line 2) and appends one section to `review.md`: the path, a table with each reviewer's verdict, open and verified counts, the `Consensus: PASS | FAIL (round N/2)` line, the open findings, the refuted ones with their evidence, and the notes. The gate does not read `review.md`, except the `Consensus:` line for the deadlock stop.

An approved review that still lists an undisposed `blocking` or `important` finding is not a clean review: `deliver-check` answers `fix-review` for it, with that finding. The decision and its review trigger: [ADR 0008](adr/0008-reviews-as-a-workflow.md).

## The delivery contract

`deliver-check` answers one question about a change: is it a ready PR? It reads files, git and GitHub (through `gh`); it never writes, pushes or posts, and `DEVKIT_BYPASS` changes nothing.

```text
node plugins/openspec/hooks/deliver-check.mjs <change-id> [--json] [--watch[=<minutes>]]
```

Run it from anywhere inside the repository. It prints one line per item (`met`, `open` or `blocked`, with the reason), then `N/8 met: <summary>` and `next: <step>`. The summary is `ready` only at 8/8, else `blocked: item N` (lowest blocked item) or `in progress: item N` (lowest open item).

| # | Item | Read from | `open` means the flow can fix it | `blocked` means it needs someone outside the flow |
|---|---|---|---|---|
| 1 | Tasks and gates | `tasks.md`, `evidence.md` | unticked tasks (a checkbox inside a fenced block is not a task); a gate command without a `pass` row in `evidence.md`; evidence missing or stale | no `tasks.md`; a gate task with no backticked command |
| 2 | Reviews approved at head | `reviews/*.md` | a required reviewer missing, `rejected`, or its `Commit:` stale (a commit of test files only stales only `code-quality-reviewer` and `test-coverage-reviewer`); only the first `Verdict:` line of a file counts, and any later one is ignored without a message | none |
| 3 | Findings disposed | `reviews/*.md` | a `[blocking]` or `[important]` line without `· fixed in <sha>` or `· refuted: <evidence>` | none |
| 4 | Acceptance criteria proven | `proposal.md` (else `requirements.md`), `evidence.md` | evidence missing or stale; a criterion without a `pass`/`verified` row; a `fail`/`defect` row | a criterion with only `no proof` rows; no criteria ids at all |
| 5 | PR open at local head | `gh pr view`, git | no PR yet; local commits not pushed; uncommitted files in the change folder | PR closed; its head not in local history; a merge conflict; `gh` missing or failing (a PR merged at your local head is not blocked: it leads to the archive steps, below) |
| 6 | Required checks green | `gh pr checks` (`--required`, else all checks) | a check pending, failing or cancelled | `gh` error; an unknown check state; a `gh` older than 2.50.0, which has no `gh pr checks --json` (the reason names the installed version) |
| 7 | Conversation answered | `gh api graphql` | an unresolved review thread, a person's newer comment, or a `CHANGES_REQUESTED` not yet replied to | a `CHANGES_REQUESTED` already replied to; more than 100 threads |
| 8 | PR body complete | the PR body | the change id, an acceptance criterion id or the `evidence.md` link is missing | none |

For item 7, a bot's top-level comments and review bodies (deploy previews, coverage and CI summaries) ask nothing and are ignored. A bot's unresolved review thread and its `CHANGES_REQUESTED` count like a person's.

For item 7, a person counts only when GitHub reports their `authorAssociation` as `OWNER`, `MEMBER` or `COLLABORATOR`. Comments, review bodies, review threads and "changes requested" from anyone else (`CONTRIBUTOR`, `NONE`, first-timers) are ignored, so an outside commenter cannot hand the agent work. "Answered" for a top-level comment or review body means newer than the viewer's latest top-level comment or review; a reply inside a review thread answers only that thread.

The rule goes by author type, not by intent: the checker cannot tell whether a bot's top-level comment asks for something, so it ignores every bot top-level comment and review body. A bot that wants a change must say it in an inline review thread or a "changes requested" review.

**Exit codes.** `0` only when all eight are met (after the merge the eight items are met by definition, see below); `1` when something is open and nothing is blocked; `2` when something is blocked (also `blocked: merge setup` in `merge` mode, and any `blocked: archive (<step>)` after the merge); `3` for a usage or preflight error (an id found neither in `openspec/changes/` nor in `openspec/changes/archive/`, no `openspec/`, or an invalid `ship` or `merge_method` setting).

**JSON.** `--json` prints `{ "version": 1, "change", "schema", "ship", "host", "head", "pr", "phases", "items", "met", "summary", "next" }`. `version` changes only when a field is removed or changes meaning. On exit 3 it prints `{ "version": 1, "error": "<message>" }`. `host` is `app` in the Claude desktop app and `cli` otherwise (`DEVKIT_HOST=app|cli` overrides it). In `merge` mode only, the report also has a `merge` object (below), and after the merge an `archive` object (below); `version` stays `1` because both fields are additive.

**The `Commit:` staleness rule.** A reviewer's verdict file starts with a `Commit: <sha>` line, and `evidence.md` has it right after its stage header line; both are placed before the first markdown heading (a line under a heading is not read). It is current when the sha resolves, is an ancestor of `HEAD`, every later commit touches only `openspec/` (a merge commit counts the files that differ between its first parent and itself, that is, what it brought into the branch, with the edits made while resolving and the files moved out of product code; the commits it brings in are still checked one by one, so an update of the branch that brings only `openspec/` files leaves the evidence and the approved or declined reviews current), the line has no `(uncommitted changes)` marker, and the working tree has no change outside `openspec/` and `.claude/`. A later commit to product code (or to a path such as `openspecx/`) makes it stale, and only the reviews or evidence that carry that sha are redone. A commit that touches only `openspec/` paths and test files (a file name with `.test.` or `.spec.`, or a folder named `test`, `tests`, `__tests__` or `fixtures`, a fixed pattern with no setting) leaves the verdict files of `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` current; it stales the others, `code-quality-reviewer` and `test-coverage-reviewer` among them, and the evidence. A verdict that is neither approved nor declined (rejected, or no `Verdict:` line) has a narrower rule: it stays current only while every later commit touches nothing but the change's own review record (`openspec/changes/<id>/reviews/`, `review.md` and `evidence.md`). A fix committed in the plan files, any other file under `openspec/` (a merge of the base that brings one included) or a test file makes it stale, so the rejecting reviewer runs again at the next round; committing the rejecting round's verdicts, `review.md` or the evidence leaves it current, and `next` stays on `fix-review`. Commit a rejecting round's record on its own: any other file committed with it counts as a fix. Each commit after the recorded one is judged on its own, so one product commit stales all of them. `flow-check` reports the review stage stale while any reviewer's file is stale.

**Order of the delivery steps.** After the phases and the `commit`, `deliver-check` returns the first row that matches: `stop-review-deadlock` (the owner's stop: a current rejected review at `FAIL (round 2/2)`), `fix-review` (a current rejected review, or an approved one with an undisposed finding), `fix-defect` (a `fail` or `defect` row on current evidence), `verify` (evidence missing or stale, a gate or criterion row missing), `review` (a reviewer missing or stale) and, last, `blocked`. The evidence comes before the reviews, so a review round never runs on code with a known failing criterion, and a fix outside `openspec/` makes both stale again: `verify`, then `review`. A rejected review is fixed before the evidence is recorded, because the fix commit would stale it. Reviews and evidence never stale each other: both live under `openspec/changes/<id>/`, so writing either one, committed or not, leaves the other current; only a later commit outside `openspec/` stales both (a commit of test files only stales the evidence and the two reviewers that read tests); a rejected review also goes stale after a commit of any file outside the change's review record, so a fix made in the plan files gets the next round with no new evidence. The PR gate still needs both, approved reviews and evidence.

**Waiting.** `--watch[=<minutes>]` runs one `gh pr checks <n> --watch --interval 30` (default 9 minutes, at most 30) when the next step is waiting for checks, then computes the contract again. A watch that outlives the cap is stopped and the result is `in progress: item 6`. In `merge` mode it also waits at `stop-merge-setup` when the change's open pull request has pending checks (the first pull request, merged by hand before the ruleset exists); the step stays `stop-merge-setup` and the report shows the checks' final state.

**Merge mode.** With `ship: merge` the contract ends differently: GitHub merges the PR, and the repository must be prepared first. A merged PR is not the end in `pr` or `merge` mode: it leads to the archive steps ("After the merge", below). `plan` mode is unchanged: it asks `gh pr view` for the same fields as before and stops at `stop-plan-mode` whatever the PR says.

- **Items.** `merge` mode also reads `autoMergeRequest` and `mergeStateStatus`. Item 5 is `met` for a PR merged at the local head (`PR #n merged`) and `blocked` for one merged at another head. An open PR whose `mergeStateStatus` is `BEHIND` is `open` (`branch is behind <base>; update it`). Once the PR is merged, the archive steps take over and items 6 and 7 are `met` without calling `gh`. The PR is found by its number once known, else by the branch; when the branch no longer finds it (merged, branch deleted) `gh pr list --head <branch> --state all` finds it among open, merged and closed PRs, preferring an open one. That lookup now runs in `pr` mode too.
- **Preflight (read-only).** Before any work, merge mode checks that the repository can merge on its own. A missing piece is `blocked: merge setup (...)`, never a silent downgrade to `pr`, and the reason names the `openspec-setup` skill (GitHub step).

  | Fact | Read with | Missing when |
  |---|---|---|
  | Auto-merge allowed | `gh api repos/{owner}/{repo}` (`allow_auto_merge`) | not `true` |
  | The merge method allowed | same call (`allow_squash_merge`, `allow_merge_commit` or `allow_rebase_merge`, by `merge_method`) | not `true` |
  | `devkit-reviews` required | `gh api repos/{owner}/{repo}/rules/branches/<default branch>`, then `.../branches/<default branch>/protection/required_status_checks` | no `required_status_checks` rule of an active ruleset, and no classic protection context, names `devkit-reviews` |
  | The workflow is committed | `git cat-file -e HEAD:.github/workflows/devkit-reviews.yml` | absent at `HEAD` (a file only in the working tree does not count) |

  "Required" means a rule that is active on the default branch (the rules endpoint lists only active rules, repository and organization rulesets alike) or classic branch protection; an `evaluate`-mode or disabled ruleset does not count. A 404 or 403 from classic protection means none. Any other `gh` error is `cannot read the repository settings: ...` and also blocks: the preflight fails closed.
- **Steps** (`next.step`, merge mode only): `disable-auto-merge` (auto-merge is on and an item is no longer met; ahead of every stop and of `push`); `stop-merge-setup` (`missing` lists what the preflight found); `update-branch` (item 5 is open only because the PR is behind its base); `enable-auto-merge` (all eight met and auto-merge off; carries `number`, `method` from `merge_method`, default `squash`, and `head`, the commit that was checked); `wait-merge` (all eight met and auto-merge on; carries `waitingFor`). In every mode, `devkit-reviews` failing in CI while items 1-4 are met locally is `blocked: item 6`, because no code fix applies.
- **Summaries.** `auto-merge on: waiting for <what>` (`GitHub to merge`, `branch rules outside the delivery contract (for example a required approval)`, `GitHub to compute mergeability`, or `GitHub (mergeStateStatus <value>)`); `blocked: merge setup`. Otherwise the summary is the usual one, including `ready` at 8/8 with auto-merge off.
- **`merge` object.** `{ "method", "setup": { "ok", "missing" }, "autoMerge", "state", "mergeStateStatus", "waitingFor" }`, present only when `ship` is `merge`.
- **The wait.** With `--watch[=<minutes>]` at `wait-merge`, the checker polls `gh pr view <n>` every `DEVKIT_POLL_SECONDS` (default 30) until the PR is not open, auto-merge goes off, the head changes, `gh` fails or the cap (default 9 minutes, at most 30) is reached, then computes the contract again: the result is the first archive step (the retro) once GitHub merged, or `auto-merge on: waiting for <what>`.

- **Plan approval on disk.** For schemas with a `readiness` artifact, a new step `stop-plan-approval` sits right after `stop-not-approved`: readiness is `APPROVED`, no task is ticked yet, and `approval.md` is missing or records an earlier `readiness.md`. The summary is `waiting for the owner's plan approval`, the exit code 1, and `next` carries `readiness` (`sha256:` and the first 12 hex of the hash of `readiness.md`), `file` and `reason`. `approval.md` is written by the main session only, from your own message, in the form `- Status: APPROVED`, `- Readiness: sha256:<12 hex>`, `- Date`, `- Owner's words`. A new readiness round changes the hash, so you are asked again; a change that already has a ticked task keeps running. The JSON gains an additive `approval` object (`status`, `recorded`, `readiness`, `ok`) for these schemas; `version` stays 1, and `--ci` is unchanged. `devkit-lite` never gets this step.

### After the merge: the archive steps

A change whose PR merged is not done: its retro, the owner's answers, `openspec archive` and the roadmap tick still have to land, and they land through a pull request, because the ruleset refuses pushes to the default branch. `deliver-check` leads that work in `pr` and `merge` mode (never in `plan` mode, which stops at `stop-plan-mode`). It adds no state: it recomputes the step from the working tree, the default branch as GitHub serves it, and the archive PR.

**The post-merge phase** starts when the change is delivered: its PR is `MERGED` and every task of `tasks.md` is ticked on the default branch (read with `gh api .../contents/openspec/changes/<id>/tasks.md?ref=<base>`), or the change folder is already archived in the working tree. A PR merged with tasks left is not delivered: the ordinary items apply on the change's branch (`implement` for the tasks, then `open-pr` for a further pull request), and `stop-branch` elsewhere. If a further PR of the change is open on the branch, that PR is the one found. All eight items are then `met` (item 5 reads `PR #n merged`, the others `checked before PR #n merged`), and none of them reads files or `gh`: the staleness rule cannot hold after a squash merge and `tasks.md` may have moved. The one exception: on the change's own branch, a PR merged at a head other than the local head is `blocked: item 5`, because local commits would be lost.

**Finding the change PR.** On the change branch, as before (`gh pr view`, then `gh pr list --head <branch> --state all` once the branch was deleted). From the default branch or an archive branch: `gh pr list --state merged --limit 100`, dropping every archive head (`chore/archive-<any id>` and `archive-<any id>`), then, newest first, the first PR that is the change's own: it touches a file under `openspec/changes/<id>/` (read with `gh api repos/{owner}/{repo}/pulls/<n>/files --paginate`, which is not capped at 100 files) and no file under `openspec/changes/archive/`. A body that names the change or a head that ends with its id is never proof of ownership. The list asks for light fields. The 100 is the cap: a change merged more than 100 merged PRs ago is not found.

**The default branch is read from GitHub**, never from the local checkout or `origin/<base>`: the local one is behind whenever GitHub merged on its own, and `deliver-check` does not fetch. The branch name is `default_branch` from `gh api repos/{owner}/{repo}` (the same call `merge` mode already makes for its preflight). Then `gh api repos/{owner}/{repo}/contents/openspec/changes/archive?ref=<base>`: an entry named `<YYYY-MM-DD>-<id>` means the change is `archived`. Otherwise `.../contents/openspec/changes/<id>?ref=<base>` is `active` (200) or `absent` (`HTTP 404`). Any other error, or a `gh` that stalls past 60 seconds, is `stop-archive` (`read-default-branch`): the check fails closed. The contents API lists at most 1,000 entries per directory.

**The release tag.** A project that sets `devkit.release_tag` in `openspec/config.yaml` to a path from the repository root to a JSON file (for this repository, `plugins/openspec/.claude-plugin/plugin.json`) has the tag of each release pushed by the delivery loop. Without the key nothing below runs and the checker makes no extra `gh` call. With it, rows R1 to R3 sit ahead of P0 and read, for the change's PR and then, once the change is archived on the default branch, for the archive PR that merged, whether that merge bumped the file's top-level `version`. The facts are six `gh` reads, each stopping at the first decisive answer: `pulls/<n>` (merged, its merge commit, its base), the file at the merge commit and at that commit's first parent (`contents`, `git/commits/<sha>` for the parent), then `git/ref/tags/v<version>` and, for an annotated tag, `git/tags/<sha>`. A version that did not change, a file that is absent at the merge, a PR that is not merged or that was not merged into the default branch asks nothing; a tag already on the merge commit (lightweight or annotated) is the step done. A tag missing is R3, the `tag-release` step, a session step that runs `git tag v<version> <merge commit>` and pushes that one tag, and the loop runs again; a tag at another commit is R2, which never moves it and stops for the owner; a fact GitHub does not answer is R1, never a pass. The tag comes before the retro, and the archive's own before `archived`. In `two-prs` only merges into the base branch count (ADR 0018). The loop in `/devkit change` reads the archive PR's tag only on `chore/archive-<id>`: from another checkout, once the change is archived there, the run ends `archived` without asking it. The decision and its review trigger are in [ADR 0019](adr/0019-the-delivery-loop-tags-the-release-it-merged.md).

**Rows**, in order, first match wins (the steps `ship-change` runs are in "Shipping a change"):

| # | Condition | `next.step` | Fields |
|---|---|---|---|
| R1 | `release_tag` is set and a fact of the release of a merged PR (the change's, then the archive's) could not be read from GitHub | `stop-archive` | `archiveStep: tag-release`, `reason`, `number` |
| R2 | the tag `v<version>` is on `origin` at a commit other than the merge commit | `stop-archive` | `archiveStep: tag-release`, `tag`, `at`, `sha`, `number` |
| R3 | the merge bumped the version of the release file and `origin` has no tag `v<version>` | `tag-release` | `tag`, `sha`, `number`, `merged` (`change` or `archive`), `version`, `file`, `base` |
| P0 | the default branch has the archived folder | `archived` | `folder` |
| P1 | the default branch is unreadable | `stop-archive` | `archiveStep: read-default-branch`, `reason` |
| P1b | item 5 blocked (merged at another head, on the change branch) | `blocked` | `item: 5` |
| P2 | `merge` mode and the repository setup is missing | `stop-merge-setup` | `missing` |
| P3a | archive PR open, auto-merge on, and a conflict, a failing check, a PR head that is not the local head, uncommitted files, an unanswered proposal or an unnamed file | `disable-auto-merge` | `number` |
| P3b | archive PR open, merge conflict | `stop-archive` | `archive-pr` |
| P3c | archive PR open, head not in local history | `stop-archive` | `archive-pr` |
| P3d | archive PR open, local ahead of it or uncommitted files | `open-archive-pr` | `branch`, `number` |
| P3e | archive PR open, a check failing or cancelled (or unreadable) | `stop-archive` | `archive-pr` |
| P3f | `merge`, archive PR behind its base | `update-branch` | `number` |
| P3g | `merge`, auto-merge off | `enable-auto-merge` | `number`, `method`, `head` |
| P3h | `merge`, auto-merge on | `wait-merge` | `number`, `head`, `waitingFor` |
| P3i | `pr` | `archive-pr-ready` | `number`, `url` |
| P4 | archive PR merged, the default branch still has the active folder | `stop-archive` | `archive-pr` |
| P5 | archive PR closed, none open | `stop-archive` | `archive-pr` |
| P6 | no `retro.md` in the change folder | `retro` | `number` (the change PR), `base` |
| P7 | `retro.md` without `## Proposed updates` | `stop-archive` | `retro` |
| P8 | a proposal without an `Answer:` line | `stop-retro-answers` | `proposals` |
| P9 | the folder is still active locally | `archive` | `branch: chore/archive-<id>`, `base`, `create` |
| P10 | the folder is archived, but this is not `chore/archive-<id>` | `stop-archive` | `archive` |
| P11 | `openspec/roadmap.md` lists the change unticked | `tick-roadmap` | `line` |
| P12 | an approved proposal without `Applied: yes` | `apply-proposals` | `proposals` (approved and unapplied only) |
| P13 | a changed file that no approved proposal names (`openspec/changes/**`, `openspec/roadmap.md`, the release files and `openspec/specs/<capability>/spec.md` for each capability the archived change has a spec delta for are exempt; `openspec/config.yaml` and `openspec/schemas/**` are not). Also checked, with the answers, while the archive PR is open | `stop-archive` | `apply-proposals` |
| P14 | otherwise | `open-archive-pr` | `branch`, `base`, `title` |

No archive PR can exist before every proposal is answered: the only rows that open one sit after P8. `merged` is no longer a `next.step`: it is a state now, and the first archive step takes its place.

**The owner's answers** live in the change's `retro.md`, one `- Answer: approved` or `- Answer: rejected[: why]` line under each proposal (`### ` heading under `## Proposed updates`, targets as backticked repository paths or `user memory`, and `None.` when there are no proposals). They stay uncommitted until the archive PR, so a session killed and resumed in the same checkout does not ask again; if the checkout itself is lost, the retro runs again and the owner is asked again. `deliver-check` reads the last `- Answer:` and the last `- Applied:` line of each block, and never a `- before:` or `+ after:` diff line.

**The file check (P13, AC-3).** Changed paths are `git diff --name-only <merge-base of origin/<base> and HEAD>` plus `git status --porcelain -uall`, except `openspec/changes/**` and `openspec/roadmap.md` (the archive's own record; `openspec/config.yaml` and `openspec/schemas/` are checked). Each must equal, as a repository-relative path with a leading `./` removed, a target of an approved proposal, or be a release file: `plugins/<pack>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`. There is no directory, prefix or glob matching, so `docs/` does not cover `docs/x.md` and `docs/*.md` matches nothing. A regression gate's test file that its proposal did not name stops the run too. The fix is to amend the proposal's targets in `retro.md` and answer again; the checker never guesses. If `origin/<base>` does not resolve, the run stops with `git fetch origin <base>`. While the archive PR is open the check also runs, and an open archive PR whose folder is not archived in the working tree, or whose archived `retro.md` is unreadable, is a `stop-archive` (and `disable-auto-merge` first if auto-merge is on), never `enable-auto-merge`.

**Summaries and exit codes.** `archived` (0); `archive PR open: waiting for <what>` (0); `archive PR ready` (0); `archive: waiting for the owner's answers` (0); `blocked: archive (<archiveStep>)` for every `stop-archive` (2); `blocked: merge setup` (2); `blocked: item 5` (2); otherwise `merged: archive step <step>` (0).

**`archive` object** (JSON, present only after the merge): `{ "base", "branch", "changePr": { "number", "url" }, "onDefault": "active" | "archived" | "absent", "folder", "local": "active" | "archived", "retro": { "exists", "readable", "proposals": [{ "n", "targets", "kind", "answer", "applied" }] }, "roadmap": { "listed", "ticked" }, "pr": { "number", "url", "state", "autoMerge", "mergeStateStatus", "headRefOid" } | null, "waitingFor" }`. In the post-merge phase `next.number` of `disable-auto-merge`, `update-branch`, `enable-auto-merge` and `wait-merge` is the archive PR.

**The wait on the archive PR.** `--watch[=<minutes>]` at `wait-merge` polls `gh pr view <archive PR>` as it does for the change PR (same defaults and cap), then reads the state again: `archived` once the default branch lists the folder, else `archive PR open: waiting for <what>`. A `merge`-mode run may therefore wait twice, once for each PR, each capped.

**Why the archive PR can auto-merge without 8/8:** the owner answered each proposal by name, the file check refuses any file they did not approve (locally, also while the archive PR is open, and again in the required `devkit-reviews` check), and the ruleset's required checks still run. The decision and its review trigger are recorded in [ADR 0003](adr/0003-auto-merge-the-archive-pr.md).

## Shipping a change: ship modes

By default (`plan`) the flow is the one above: you give the go-ahead at each step and the agents stop at each gate. A project can opt in, per schema, to letting one skill drive an approved change to a ready PR, or on to a merge by GitHub. The setting lives in `openspec/config.yaml`, in either YAML form:

```yaml
ship:
  devkit-lite: pr
  devkit: plan
```

```yaml
ship: { devkit-lite: pr }
```

| Mode | Meaning |
|---|---|
| `plan` | Today's flow. The default: no `ship` key, an empty one, or a schema missing from the map |
| `pr` | The `ship-change` skill takes the change to a PR that `deliver-check` reports as `ready`, and stops there; in `pr` mode the merge is yours |
| `merge` | The skill takes the change to 8/8, then enables GitHub auto-merge (`gh pr merge <n> --auto --<merge_method> --match-head-commit <head>`) and GitHub merges once its rules pass. `merge_method` is `squash` (default), `merge` or `rebase`, written next to `ship`. The repository has to be prepared first (below), or the run stops with `blocked: merge setup` |

Why `merge` exists, what it costs and when to revisit it: [ADR 0002](adr/0002-merge-without-the-owner-opt-in.md). Why the archive PR that follows a merge is auto-merged without 8/8: [ADR 0003](adr/0003-auto-merge-the-archive-pr.md).

Any other value, a scalar (`ship: pr`), a nested map or a duplicate schema key is also an error that names the key. The hooks do not read `ship`: with or without it, every gate behaves the same.

**What `ship-change` runs.** `/ship-change <id>` (or "ship this change") loops on `deliver-check --json` and does the step it names: `tdd-implementer` per phase, the phase gate command itself, `commit-and-pr` for a commit, `pr-verifier`, then `review-change` for only the reviewers that went stale, the PR, then answering the PR's review threads and waiting for checks. It holds no state: a killed session starts again from the files and GitHub, so resuming is just running it again. It reports `ready` (`pr` mode) only when `deliver-check` exits 0, else `in progress: item N` or `blocked: item N`; in `merge` mode it reports `auto-merge on: waiting for <what>`, `blocked: merge setup` or, after the archive, `archived`. After the change PR merges it goes on to the archive steps (below): `pr` mode ends at `archive PR ready` (you merge the archive PR; run it again to see `archived`), `merge` mode at `archived`. `merged` is no longer a final report. Fixes always go through `tdd-implementer`. It never merges directly and never uses `--admin`: it runs `gh pr merge` at exactly two steps, `enable-auto-merge` (`--auto`, only at 8/8) and `disable-auto-merge` (`--disable-auto`, as soon as the contract drops below 8/8: a push, a stale review, a new comment, a pending re-run).

**What the skill runs in `merge` mode.** The same loop, with these steps added (`next.step` of `deliver-check --json`):

| `next.step` | What the skill does |
|---|---|
| `stop-merge-setup` | Stops: `blocked: merge setup (<missing>)`. Run the GitHub step of `openspec-setup` |
| `disable-auto-merge` | `gh pr merge <n> --disable-auto`, then continues |
| `update-branch` | `gh pr update-branch <n>`, then `git pull --ff-only`. The ruleset requires the branch to be up to date, so a PR behind its base waits; the update brings base commits; when they or the merge change a file outside `openspec/`, the older reviews and evidence go stale and run again, and an update that brings only `openspec/` files leaves the evidence and the approved reviews current (a rejected review goes stale and runs again) |
| `enable-auto-merge` | `gh pr merge <n> --auto --<method> --match-head-commit <head>`: GitHub refuses it if the head moved since the check |
| `wait-merge` | One capped `deliver-check <id> --json --watch`, then reports `archived` or `auto-merge on: waiting for <what>` (`archive PR open: waiting for <what>` for the archive PR) |
| `retro` | Runs the `retro` skill on the merged PR and writes `retro.md` in the change folder |
| `stop-retro-answers` | Stops and asks the owner to approve or reject each proposal; writes each `Answer:` from the owner's own message, never its own |
| `archive` | `git switch -c chore/archive-<id> origin/<base>`, then `openspec archive <id> --yes` |
| `tick-roadmap` | Ticks the change's line in `openspec/roadmap.md` |
| `tag-release` | `git fetch origin <base>`, then `git tag <tag> <sha>` (lightweight) and `git push origin refs/tags/<tag>`, alone: never a force push, never `--tags`; a local tag at another commit, or a refused push, stops as `blocked: archive (tag-release)` |
| `apply-proposals` | `tdd-implementer` applies exactly the approved proposals (test-first for a regression gate, version bump, CHANGELOG), writes `Applied: yes` |
| `open-archive-pr` | `commit-and-pr` (archive call) commits the moved folder, the roadmap and the applied files, and opens the archive PR |
| `archive-pr-ready` | Reports `archive PR ready` (`pr` mode): you merge it |
| `stop-archive` | Stops: `blocked: archive (<step>): <reason>` |
| `archived` | Reports `archived` |

**Preparing the repository (setup order).** In the project, run the GitHub step of `/openspec-setup` (`scripts/github-setup.mjs`). It prints a plan of four items (`workflow`, `auto-merge`, `delete-branch`, `ruleset`), applies nothing until you confirm each one, and is safe to run again.

1. Write the workflow (`.github/workflows/devkit-reviews.yml`); commit it and merge it through a normal PR, so `devkit-reviews` reports at least once (`--watch` waits for that pull request's pending checks at `stop-merge-setup`). The `ruleset` item stays `deferred` until then, because a required check that never reports blocks every PR.
2. Apply `auto-merge` (allow auto-merge and the merge method) and `delete-branch`.
3. Apply the `ruleset` `devkit`: a pull request with zero approvals, the existing checks plus `devkit-reviews`, branch up to date, no force pushes, no bypass actors. **From then on, `main` refuses direct pushes from everyone, you included**; every change, archive commits too, goes through a PR. Other open PRs wait for `devkit-reviews` until updated with the default branch.
4. Add `ship: { <schema>: merge }` (and `merge_method`) to `openspec/config.yaml`.

**Limits of `merge` mode.** Zero approvals are required, so a `CHANGES_REQUESTED` review does not stop GitHub's merge on its own; item 7 covers it while the skill runs, and `disable-auto-merge` fires when a review lands before the merge. Between skill runs GitHub merges on its required checks alone: a comment posted after auto-merge was enabled does not stop the merge unless someone disables it. A PR can edit `devkit-reviews.yml` (or, in this repository, `deliver-check.mjs`), and the edited version runs on that PR; reviewers see those diffs. Organization-level required workflows are out of scope.

**Go-ahead.** In `devkit`, `readiness.md` must say `- Status: APPROVED`, and then your approval of that plan must be recorded in `approval.md` (the skill writes it from your own message at `stop-plan-approval`). In `devkit-lite`, the go-ahead is your message asking to ship or apply the change.

**App and CLI.** At the "wait for checks" step it runs one capped watch (9 minutes by default). In the CLI it then reports the state and stops; a red check is fixed the next time you run it. In the Claude desktop app a red check after the watch is fixed in the same run, and when it stops `in progress` the app's Auto-fix wakes the session on a CI failure, a merge conflict or a review comment; that session runs `ship-change` again. Auto-fix does not wake on green checks, which is why the watch exists.

**The `tdd-implementer` gate report applies in every mode.** The agent now reports the phase gate's command and output in its Validation section instead of writing `evidence.md` (the hook already blocked that write; `pr-verifier` is the only writer, and its `### Gates` table is the durable record). That is a bug fix, not `ship` behavior, and the go-ahead may come from you or from a skill that re-ran the gate green.

### Delivery models

A project can choose how a change reaches its branches, in the `devkit:` block of `openspec/config.yaml`:

```yaml
devkit:
  delivery:
    model: two-prs        # two-prs | trunk | trunk-auto
    base: master          # two-prs only: the repository's default branch
    test_branch: develop  # two-prs only
```

Without `devkit.delivery.model`, the `ship:` map above decides, as before. With it, every `ship:` entry must agree, or the configuration is refused and nothing runs:

| Model | Meaning | `ship:` entries that agree |
|---|---|---|
| `trunk` | The `pr` mode: a short branch, one pull request, the owner merges | none, or `pr` |
| `trunk-auto` | The `merge` mode under a second spelling, with every condition of [ADR 0002](adr/0002-merge-without-the-owner-opt-in.md) | none, or `merge` |
| `two-prs` | Two pull requests from one branch (below) | none (any entry is refused; `plan` too) |

`two-prs` names `base` and `test_branch`, both required and different; a missing or unknown value stops `/devkit change` with `setting-missing` or `setting-unknown`. Why the model is chosen per project and how it amends the earlier ADRs: [ADR 0018](adr/0018-the-delivery-model-is-chosen-per-project.md).

**`two-prs`, from opening to the archive.**

1. `/devkit change <id>` cuts the task branch from `origin/<base>`. The base branch must be the repository's default branch and the test branch must exist on the remote, or the change does not open (`base-not-default`, `test-branch-missing`); a change id ending in `-<test_branch>` is refused (`name-test-suffix`), because that suffix names the support branches.
2. `ship-change` opens both pull requests together from the task branch (`open-prs`): one to the base branch, one to the test branch. The owner merges both pull requests, the one to the test branch first; devkit enables auto-merge on neither. The state names both (`ready-test-branch`, then `ready-base`).
3. The pull request to the base branch stays red in `devkit-reviews` until the one to the test branch is merged (`rerun-checks` runs the failed check again after that merge).
4. The test branch never enters the task branch. When the pull request to the test branch has a conflict, the flow cuts the support branch `<id>-<test_branch>` from the task branch, merges the test branch there (`merge-into-support`) and a `tdd-implementer` call resolves the conflict. The resolution, read as the support branch's own work, goes through `review-change` again (`review-resolution`, verdicts in `reviews/resolution/`) before the support branch is pushed (`push-support`). The pull request to the test branch is then closed and opened again from the support branch (`move-test-pr`); the pull request to the base branch stays as it is. A later fix on the task branch reaches the support branch by a merge into it.
5. After both are merged, the change is archived through two archive pull requests, `chore/archive-<id>` to the base branch and `chore/archive-<id>-<test_branch>` to the test branch, with the same commits (`open-archive-pr`, `open-test-archive-pr`); the owner merges both (`archive-prs-ready`), and the change counts as archived when both branches hold it.

**The lock, in the Claude driver.** A `git merge`, `rebase` or `pull` that would bring the test branch into any branch other than the test branch or a branch named `<name>-<test_branch>` is refused, naming the support branch. The limits, accepted: a ref inside quotes is not read, and `git cherry-pick`, `git reset <ref>` and `git merge FETCH_HEAD` are not read. The `devkit-reviews` check (below) is the backstop for all three, in every driver.

## CI

Hooks run only inside Claude Code. To make the gates independent of the agent, run them in CI as well. The `devkit-reviews` workflow runs `deliver-check --ci`: it checks readiness (in `devkit`) and the first four items of the delivery contract (tasks and gates, reviews current at head, findings disposed, acceptance criteria proven) for the change the PR is about. Unlike the review consensus `guard.mjs ci` checked before 0.5.0, it applies the same staleness rule as `deliver-check` and the agent: a review or `evidence.md` recorded before a later product commit fails the job (after a commit of test files only, the reviews of `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` stay current). It ignores `DEVKIT_BYPASS` and does not read `ship` or `merge_method`; it reads `devkit.delivery` from the default branch, and applies rules only in `two-prs` (see "Delivery models" and "The `two-prs` rules" below). A change is never selected through an archive branch (`chore/archive-<id>`) once its folder has moved, so an archive PR is never held to another change's reviews even while other changes are open. It is checked as an archive PR instead: when the PR (against `GITHUB_BASE_REF`) brings an `openspec/changes/archive/<date>-<id>/` folder, `devkit-reviews` runs the same exact-path file check as P13 on the PR's changed files, and requires its `retro.md` to be readable with every proposal answered. A file no approved proposal names, an unanswered proposal or a missing retro fails the job. A PR that archives nothing passes with the "nothing to check" note. The check applies only to changes on a devkit script (ADR 0012): the change's own `.openspec.yaml` (else `openspec/config.yaml`) names the schema `devkit` or `devkit-lite`. For a change on any other schema the job passes and prints `devkit-reviews: <id> is on the <schema> script, not a devkit script (devkit, devkit-lite); nothing was checked`; an archive PR judges each archived folder by its own schema, so a folder of another schema is a note. A devkit folder with no `retro.md` still fails, and the message names the file, what it must hold (a `## Proposed updates` section with each proposal and the owner's answer) and the retro step of the archive that writes it.

```yaml
# .github/workflows/devkit-reviews.yml (templates/devkit-reviews.yml in the openspec-setup skill)
name: devkit-reviews
on:
  pull_request:
permissions:
  contents: read
  pull-requests: read
jobs:
  devkit-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: Download the checker (outside the workspace, so no review goes stale)
        run: |
          # pinned to the commit of v0.33.0 (a tag can move; a commit cannot)
          base=https://raw.githubusercontent.com/chacal88/devkit/<commit sha of v0.33.0>/plugins/openspec/hooks
          curl -fsSL "$base/guard.mjs" -o "$RUNNER_TEMP/guard.mjs"
          curl -fsSL "$base/deliver-check.mjs" -o "$RUNNER_TEMP/deliver-check.mjs"
          curl -fsSL "$base/merge-setup.mjs" -o "$RUNNER_TEMP/merge-setup.mjs"
      - run: node "$RUNNER_TEMP/deliver-check.mjs" --ci
        env:
          GH_TOKEN: ${{ github.token }}
```

The readiness is asked of a change when the flow it follows declares it, read from the checkout's `openspec/schemas/<script>/`; the job downloads the same three files, because the flow files come from the checkout, not from the pin.

The check also judges the archived folder of a `devkit-project` slice by the slice contract (see "Defining a project"); a project that sets `ship: devkit-project: merge` moves this pin to `v0.20.0` or later first, because older releases pass a slice with a note.

Pin the commit sha of the release tag (`v0.33.0` above), not the tag: a tag can be moved, and this job's output gates the merge. The openspec-setup script resolves the tag to its sha for you (and defers the workflow if the tag does not exist yet); by hand, run `gh api repos/chacal88/devkit/git/ref/tags/v0.33.0` (for an annotated tag, follow `object.sha` through `git/tags/<sha>`). Bump it on purpose. The job id is the check's name (`devkit-reviews`), so give the job no `name:`; and keep the trigger `pull_request` with no `paths:` filter, because a required check that is filtered out never reports. The files are downloaded into `$RUNNER_TEMP`, never into the workspace: a file added to the repository would make every review stale.

If your CI also validates the OpenSpec files, keep that step in a job of its own (for example `npm i -g @fission-ai/openspec@2` then `openspec validate --all --strict`); `deliver-check --ci` does not call the OpenSpec CLI, so the snippet this section used to show for it is unchanged and still valid:

```yaml
# .github/workflows/devkit.yml (optional, unchanged from 0.4.0 apart from the missing guard step)
name: devkit
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm i -g @fission-ai/openspec@2
      - run: openspec validate --all --strict
```

**Which change is checked.** The first rule that matches wins:

1. The id on the command line (`deliver-check --ci <id>`), or `DEVKIT_CHANGE`. Not an active change: exit 3.
2. The branch (`GITHUB_HEAD_REF`, else the git branch): the active change the branch name ends with, else the only one it contains. Several contained: the job fails (`several changes match branch ...`).
3. With `GITHUB_BASE_REF` (always set on a `pull_request` run): the active changes whose folders the PR changes (`openspec/changes/<id>/`, the archive excluded). One: it is checked. Several: each one on a devkit script that the PR delivers (at least one ticked task in its `tasks.md`) is checked, and the output says `devkit-reviews: <n> changes touched by this PR (<ids>)` with one block per change; a touched change that holds only a plan, or is on another schema, is a note and fails nothing. When the PR touches devkit changes and delivers none, the job fails: `this PR delivers no change: <ids> hold only a plan (no ticked task in tasks.md)`. With `--json`, `change` is `null` and `changes` lists the reports.
4. Without `GITHUB_BASE_REF` (a local run): the only open change. Several: the job fails.
5. Otherwise (a PR that brings an archived folder was checked as an archive PR before this, see above) there is nothing to check and the job passes with a note (`no change selected by branch ... or touched by this PR; nothing to check`).

A change that was squash-merged but not archived yet is therefore not checked by an unrelated PR: its reviews point at commits that are not in the base's history. A repository without an `openspec/` folder passes too (`no openspec/ folder; nothing to check`), so adding the workflow never breaks a project that has not adopted OpenSpec. Locally, `deliver-check <id>` (without `--ci`) still exits 3 there.

**What the checkout must be.** The check reads every commit since a review was recorded, and compares the recorded sha with the PR head. `deliver-check --ci` refuses to guess and exits 3 when:

| Message | Fix |
|---|---|
| `fetch the full history (actions/checkout with fetch-depth: 0)` | The clone is shallow (the default `actions/checkout` depth is 1). Set `fetch-depth: 0` |
| `check out the PR head (actions/checkout with ref: ${{ github.event.pull_request.head.sha }}), not the merge commit` | `actions/checkout` defaulted to the synthetic merge commit of the PR. Set `ref:` to the PR head sha |

Exit codes: `0` pass, `1` something failed, `3` setup or usage error. `--json` prints `{ version: 1, mode: "ci", change, schema, head, readiness, items, pass }`; `--ci --watch` is a usage error.

**`guard.mjs ci`.** Projects that already run `node guard.mjs ci` keep working: it now runs the same `deliver-check --ci` and prints its output and exit code. It needs `deliver-check.mjs` and `merge-setup.mjs` in the same folder as `guard.mjs` (download all three, as the template does) and the same full-history, PR-head checkout; without them it prints `devkit ci: guard.mjs ci needs deliver-check.mjs and merge-setup.mjs in the same folder` and exits 1. The local `gh pr create` hook is unchanged: it still checks verdict values only.

**The `two-prs` rules.** In a project whose default branch's `openspec/config.yaml` names `model: two-prs`, `devkit-reviews` also judges, on a pull request to the base branch, that the head holds no commit of the test branch's first-parent history that the base branch lacks, and that the pull request to the test branch from the same branch (or its support branch) is merged; the failures read `two-prs  open  <sha> (<subject>) is on <test_branch> and not on <base>`, `waits for pull request #<n> to <test_branch> to merge` and `the base branch <base> is not the repository's default branch <default>`. On a pull request to the test branch it does not judge the delivery contract, which the pull request to the base branch carries; from a support branch it judges the resolution's verdicts. The settings are read from the repository's default branch, never from the pull request's head or from the test branch: from the event payload's `repository.default_branch`, else `origin/HEAD`, else, outside GitHub Actions in a clone without `origin/HEAD`, from the pull request's base branch, where a pull request to the test branch whose own copy names no model is judged as before. The job needs `pull-requests: read` and `GH_TOKEN` (both in the template above). After the test-branch pull request merges, GitHub does not run the check of the base pull request again: outside the Claude driver, re-run it by hand or with `gh run rerun --failed`.

## Customizing

- **Rules for one project**: add them under `rules.<artifact>` in `openspec/config.yaml`. They reach the agent with that artifact's instructions.
- **Change the flow itself**: copy the schema into the project (`openspec/schemas/devkit/`) and edit it; project schemas take precedence over the machine-wide ones. Validate with `openspec schema validate devkit`. Keep the artifact id `readiness` if you want the code gate. Keep the name too: the hooks act only where `openspec/config.yaml` selects `devkit` or `devkit-lite`, so a renamed schema turns them off, and the `devkit-reviews` check turns into a note on that pull request (`nothing was checked`).
- **A different gate**: the hooks only look for the `readiness` artifact id and the `Status:` / `Verdict:` lines, so a renamed or reworded artifact must keep those. The first `Verdict:` line of a file counts; every reader ignores a later one.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `devkit guard: change "x" has no approved readiness` | The plan isn't approved yet | Finish the plan and dispatch `plan-readiness-reviewer` until `- Status: APPROVED`. Planning files stay editable |
| `... is written only by the <agent> agent, not by the main session` | A gate file was written by the wrong role | Dispatch that agent with the Agent tool (`subagent_type: devkit-core:<agent>`) |
| `product code is written by the tdd-implementer agent` | The main session tried to edit code in a `devkit` change | Dispatch `devkit-core:tdd-implementer` for the phase, or use `devkit-lite` for small changes |
| `devkit guard: several active OpenSpec changes` | More than one open change and the branch doesn't name one | `git switch -c feat/<change>`, or start Claude Code with `DEVKIT_CHANGE=<change>` |
| `gh pr create` refused | A required review is missing or not approved, or `evidence.md` is missing | Dispatch `pr-verifier`, then run `review-change` for the change |
| `openspec instructions apply` says `blocked` | An artifact `apply` requires is missing | `openspec status --change <id>` lists it |
| `schema 'devkit' not found` | Schemas not installed where OpenSpec looks | Run `/openspec-setup`, or check `openspec schema which devkit` |
| `deliver-check` exits 3 | Unknown change, no `openspec/`, or an invalid `ship` or `merge_method` in `openspec/config.yaml` | Read the message on stderr; fix the id or the config |
| `devkit-reviews` passes with `nothing was checked` | The change is on a schema that is not `devkit` or `devkit-lite` (a renamed copy counts), so the devkit contract does not apply to it (ADR 0012) | Nothing to fix if that is intended; to have it checked, keep the schema name `devkit` or `devkit-lite` |
| `devkit-reviews` fails: `this PR delivers no change` | The PR touches devkit changes and none has a ticked task in `tasks.md` at its head | Tick a finished task in the change the PR delivers, or move the plan-only folders to their own PR |
| `deliver-check --ci` exits 3: `fetch the full history (actions/checkout with fetch-depth: 0)` | The `devkit-reviews` job cloned with depth 1, so no recorded review sha resolves | Set `fetch-depth: 0` on `actions/checkout` |
| `deliver-check --ci` exits 3: `check out the PR head (actions/checkout with ref: ...)` | The job checked out the PR's merge commit, which makes every review look stale | Set `ref: ${{ github.event.pull_request.head.sha }}` on `actions/checkout` |
| `github-setup` says `rulesets refused` | GitHub refuses rulesets for this repository's plan (a private repository on a plan without them); merge mode needs the ruleset (ADR 0002), so auto-merge is deferred too | Make the repository public or move it to a plan with rulesets; `plan` and `pr` modes still work |
| `github-setup` says `Actions disabled`, or the newest runs failed without starting | GitHub Actions is off for the repository, or runs fail before any step (one possible cause is billing: a failed payment or a spending limit; the API does not say which) | Settings > Actions > General, or Settings > Billing and plans; no check runs until it is fixed |
| `the project pins @fission-ai/openspec ... but it is not installed`, or `... is not supported: devkit needs OpenSpec 2.x` | The project's `package.json` declares the CLI and the install is missing, or the installed pin is not 2.x | Run the project's install, or move the pin to 2.x (`npm i -D @fission-ai/openspec@2`) |
| `blocked: merge setup (...)` | `ship: merge`, but the repository lacks a piece: auto-merge or the merge method not allowed, no active rule requiring `devkit-reviews` on the default branch, or the workflow not committed (the message lists which) | Run the GitHub step of `/openspec-setup` and confirm the items; commit the workflow |
| `auto-merge on: waiting for <what>` | All eight items are met and auto-merge is enabled; GitHub has not merged yet (`GitHub to merge`, `branch rules outside the delivery contract (for example a required approval)`, `GitHub to compute mergeability`) | Run `deliver-check <id> --watch` or `ship-change` again; if the wait is a rule outside the contract, satisfy it or adjust the ruleset |
| `blocked: item 6` with `devkit-reviews fails in CI while items 1-4 are met locally` | The CI check and the local view disagree: a file not pushed, or a checkout that is not the PR head | Read the CI log of `devkit-reviews`; push what is missing or fix the checkout (see the two `--ci` exit 3 rows) |
| `blocked: item 5` | The PR has a merge conflict, was closed, or its head isn't in your history (or it was merged at a head other than your local one) | Resolve the conflict (or reopen) and run it again; the loop resolves only a conflict in release files, by a merge of the base (see "Release-file conflicts") |
| `blocked: archive (<step>)` | An archive step cannot go on: the default branch could not be read (`read-default-branch`), the archive PR conflicts, has a failing check, was closed or is not in your history (`archive-pr`), `retro.md` has no `## Proposed updates` (`retro`), the change is archived on another branch or `origin/<base>` is missing (`archive`), or a changed file is named by no approved proposal (`apply-proposals`) | Read the reason after the step name; fix it and run it again. The flow opens no second archive PR |
| `blocked: archive (tag-release)` | `devkit.release_tag` is set and the tag of a merged release could not be pushed or read: `origin` has the tag at another commit than the merge, a local tag of that name is at another commit, the push was refused, or GitHub did not answer a read | The loop never moves a tag: for a tag at another commit, move or delete it by hand (`git push origin :refs/tags/<tag>` once you are sure) and run `ship-change` again; for an unreadable fact, run it again |
| `archive: waiting for the owner's answers` | Every retro proposal needs an `- Answer:` line in `retro.md` before the archive PR exists | Approve or reject each proposal listed, then run `ship-change` again |
| `archive PR open: waiting for <what>` | The archive PR has auto-merge on and GitHub has not merged yet | Run `deliver-check <id> --watch` or `ship-change` again |
| `deliver-check` exits 3: `no openspec/changes/<id>/ and no openspec/changes/archive/<date>-<id>/` | The id is in neither place in this checkout | Switch to the default branch and pull, or to the change's branch |
| `/devkit change` says `setting-missing`, or the settings problem for `two-prs` | `devkit.delivery.model` is `two-prs` without `base` or `test_branch` | Write both names under `devkit.delivery` in `openspec/config.yaml` |
| `/devkit change` says the test branch does not exist on the remote (`test-branch-missing`) | The `test_branch` of `two-prs` has not been pushed | Create it on the remote, then call `/devkit change` again |
| `/devkit change` says the base branch is not the repository's default branch (`base-not-default`) | `devkit.delivery.base` differs from the default branch | Make them the same branch; a base other than the default branch is not supported |
| A `git merge` of the test branch was refused: "the task branch never receives `<test>`" | The lock of `two-prs` | Merge it into the support branch `<change>-<test>` the message names, never into the task branch |
| `devkit-reviews` fails with `waits for pull request #<n> to <test>` | The pull request to the test branch is open or missing | The owner merges it first, then the check runs again (`gh run rerun --failed`) |
| `devkit-reviews` fails with `<sha> (<subject>) is on <test> and not on <base>` | The head holds a test-branch commit | Remove it from the task branch; solve a conflict on the support branch |
| `in progress: item 6` | Required checks are still running, or failing | Run `deliver-check <id> --watch` or `ship-change` again; a failing check is fixed through `tdd-implementer` |
| `blocked: rebase of <id> stopped: resolve or abort it in <worktree>` | A rebase left in progress in the change's worktree (a conflict outside the release files) | Resolve it there, or `git -C <worktree> rebase --abort`, then run `/devkit change <id>` again; the session aborts only when you ask |
| `git worktree list` shows a worktree whose folder is gone (`prunable`) | A change's worktree was deleted by hand | `git worktree prune`; `/devkit change <id>` finds the change's branch and reuses it |
| The stop was refused: "the change <id> has the stage <stage> ready" | A `/devkit change` run is under way and its next action is a stage, not an end | Run the stage the message names (the command it prints gives the next action), or end the run as blocked and say why; the lock refuses once per unchanged state |
| A stage agent's stop was refused: "<file> of stage <stage> does not exist" | The agent tried to end without writing its stage file or its header | Write the file with its stage header (`result=passed`, or the result the stage has) before stopping; a second stop with nothing changed goes through and the run ends blocked |
| `claimed`: "<id> is already open on <machine>" | The branch of that id is on `origin` with a change folder: another machine opened it first | Continue it there, or choose another id |
| `/devkit status` reads "no answer" for a machine and its changes | The machine did not answer the SSH call within 20 s (asleep, network down), or has another devkit-openspec version | Wake it or fix its connection; its changes are kept, and the run opens other lines elsewhere. Install the same pack version on both |
| "<id> is ready to start, but the machine is loaded (processor at <n>%, limit <m>%)" | `/devkit roadmap` holds new starts while the load per core is at or above `load_limit` (80 by default) | Wait: the start begins by itself when the load falls; or tell the session to start anyway; or raise the `load_limit` option above 100 to force it |
| The stop was refused in a roadmap run: "the change <id> has the stage <stage> ready" | A `/devkit roadmap` run is under way and some change has a stage ready that is not under way, or a start could happen | Run the command the message names (`roadmap-loop.mjs next`) and carry out what it prints; the lock refuses once per unchanged state |
| A change shows "waits for your next message" | The app starts a change session only on a turn you typed, and the change became ready on another turn | Send any message in the session that coordinates the roadmap: the change's session starts then |
| A change shows under way in `/devkit status` but nothing runs | The session that handed its stage died, so the run file still holds it | Call `/devkit roadmap` from a new session: it starts the file from empty and hands the stage again |
| The session refused to edit code in a `/devkit change` run | The coordinator is your session and writes no product code (ADR 0011) | Nothing to fix: the loop hands the implementation to `tdd-implementer`; to edit by hand, type another slash command first (it ends the run for the hooks) |
| A `/devkit change` run stopped with "reached its token budget" | The session's spend, counted from the change's first run line, is at or above `budget` (the stop is a wait for the owner) | Raise `budget` in the `devkit:` block of the `.openspec.yaml` the reply names, then type `/devkit change` again; the loop gives back the held hand-off |
| A token budget is set and a run never stops at it | The count fails open: the host's environment holds no session id, or the session's transcript cannot be read; or the run is not a `/devkit change` run | Check that the host sets `CLAUDE_CODE_SESSION_ID` and that the transcript is under `~/.claude/projects`; a cap applies only to `/devkit change` |
| `/devkit change` says the driver is not built | `devkit.driver` in `openspec/config.yaml` is `compozy` or `script`; only `claude` runs in round 15 | Set `driver: claude`, or drop the block |
| `review.md` says `Path: agents` on a typed turn | The host has no Workflow tool, or the tool refused or the result was unusable | Read the Notes line of that `review.md` section (`Workflow refused`, `Workflow result invalid`, `Workflow lost`); the files are the same on both paths |
| The hooks don't fire at all | `devkit-openspec` isn't installed or enabled, or the project isn't opted in: `openspec/config.yaml` doesn't select `devkit` or `devkit-lite` (a renamed schema counts) | `/plugin` → enable `devkit-openspec@devkit`; set `schema: devkit` or `devkit-lite` in `openspec/config.yaml` |
| Every role runs as a general-purpose subagent "following" an agent file, and the one-writer rule is not enforced on the gate files | The conducting session was started in another folder (the app cannot move it), so the packs installed at project scope are not loaded in it | Start the conducting session on the project's folder (a worktree under it counts). If you go on anyway, keep the one-line deviation in `readiness.md`, every `reviews/<name>.md` and `evidence.md`, as devkit-panel did |

## Cost

Every agent run costs time and tokens, so the defaults keep runs few and cheap:

- `devkit-lite` is the default schema; the full flow is for the changes that need it.
- All reviewers and the readiness reviewer run on Sonnet; only `change-planner` uses Opus. To change a model for one project, copy the agent into the project's `.claude/agents/` and edit its `model:`.
- Reviewers scale to the diff (each has a Budget section), run the test suite at most once, and read tests instead of running mutations unless asked.
- `review-change` summons only the reviewers the diff needs, re-runs only the ones that rejected, checks only their previous findings, and stops after two rounds.
- A review round runs R reviewers, then 3 verifiers per open `blocking` or `important` finding, then the R reviewers again to write their files. A refuted finding saves a fix round; `nit` and `praise` are never verified.
- In the full flow, tasks use as few phases as the work needs: each phase is one implementer run.
- A token budget (`budget:` in the `devkit:` block) stops a `/devkit change` run between hand-offs at a cap you choose; with none set, nothing is counted.

## Limits

- Who merges depends on the ship mode: in `plan` and `pr` mode the merge is always yours; in `merge` mode GitHub merges, but only after `ship-change` enabled auto-merge at 8/8 on a prepared repository (see the limits above). In `devkit-lite` the hooks allow the main session to edit product code, so only the `ship-change` skill keeps it off product code.
- `openspec/roadmap.md` reports the order between changes; `/devkit roadmap` enforces `after:` for what it starts, while `/devkit change` and `/ship-change <id>` still do not: a change can be started before the ones it is `after:`.
- The `workflow` path of the review round runs only on a turn you typed; any other turn runs the `agents` path, with the same files.
- Hooks can veto an action; they can't make a step happen. The guarantee is "no code before an independently approved plan, no PR without approved reviews and evidence", not "the review was thorough".
- Shell writes are detected from the command (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `install`, `touch`, `truncate`). A path built from a variable (`"$TMP"/x`) or a script that writes from inside an interpreter (`python -c`, `node -e`) is not resolved, so it isn't gated; CI is the backstop.
- OpenSpec's schema commands are marked experimental by the CLI and may change between versions. The schemas here are validated against OpenSpec 2.x; devkit refuses a 1.x CLI.
- CI does not check `approval.md`: the main session writes it, so CI could see only that the file exists, not that you gave it, and it would fail every open `devkit` PR made before it existed. The recorded approval is a local gate (`deliver-check` and the skill).
- `readiness.md` approval is not invalidated automatically when the plan changes later; the schema tells the agent to re-run it, and review in the PR is the backstop.
