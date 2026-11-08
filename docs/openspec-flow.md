# The OpenSpec flow

devkit-openspec turns the devkit workflow into something OpenSpec and a few hooks enforce, with no orchestrator session in the middle. This page explains the moving parts, how to adopt them in a project, and what to do when something blocks you.

## The three layers

| Layer | Lives in | Decides |
|---|---|---|
| **Schema** | `openspec/schemas/devkit/` (or `~/.local/share/openspec/schemas/`) | Which artifacts a change needs, in which order, and what `apply` requires |
| **Project config** | `openspec/config.yaml` | Project context, per-artifact rules, guidance for apply and archive |
| **Gates** | Claude Code hooks (from the plugin) and your CI | What must never happen, checked from file contents |

The OpenSpec CLI reads the first two and hands the result to the agent: `openspec instructions <artifact> --change <id> --json` returns the schema's instruction for that artifact, the template, the project `context` and the `rules` for that artifact. `openspec instructions apply` returns `state: blocked` and the missing artifacts until the plan is complete. The `openspec-*` skills that `openspec init` installs already read that output, so no skill needs editing for the flow to reach the agent.

## Choosing a schema

Every gate costs agent runs, so the flow scales with the change. `devkit-lite` is the default in the project template; choose `devkit` when the change needs the owner grilled, an independent plan approval and implementation by a dedicated agent.

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

For small, contained changes, with or without a spec-level behavior change.

```text
proposal ─▶ specs (optional) ─▶ tasks ─▶ apply
```

No grill and no readiness gate, and the main session may write the code itself. Write a spec delta when the proposal lists a capability; otherwise set `skip_specs: true` in the change's `.openspec.yaml`. The PR still needs the reviews (`code-quality-reviewer` and `test-coverage-reviewer` at least) and `evidence.md`. If the change turns out to meet a full-flow criterion, recreate it with `--schema devkit`.

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

shows what's done and what's next. A new session starts by printing the same, from the session hook, plus the current round of `openspec/roadmap.md` if the project has one (see [Grouping changes](#grouping-changes-the-roadmap)).

Name the branch after the change: the hooks use it to know which change you're working on.

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

- Each `## ` heading is a round; each `- [ ] <change-id>` line is a change, optionally with `(after: a, b)`. Anything else in the file is ignored.
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
- It only reports. Nothing is gated by it, and the hook never writes it: tick a line by hand (or let the agent do it) when the change is archived. Run each change of a round in its own session and branch; the roadmap is the shared checklist between them.

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

## The delivery contract

`deliver-check` answers one question about a change: is it a ready PR? It reads files, git and GitHub (through `gh`); it never writes, pushes or posts, and `DEVKIT_BYPASS` changes nothing.

```text
node plugins/openspec/hooks/deliver-check.mjs <change-id> [--json] [--watch[=<minutes>]]
```

Run it from anywhere inside the repository. It prints one line per item (`met`, `open` or `blocked`, with the reason), then `N/8 met: <summary>` and `next: <step>`. The summary is `ready` only at 8/8, else `blocked: item N` (lowest blocked item) or `in progress: item N` (lowest open item).

| # | Item | Read from | `open` means the flow can fix it | `blocked` means it needs someone outside the flow |
|---|---|---|---|---|
| 1 | Tasks and gates | `tasks.md`, `evidence.md` | unticked tasks; a gate command without a `pass` row in `evidence.md`; evidence missing or stale | no `tasks.md`; a gate task with no backticked command |
| 2 | Reviews approved at head | `reviews/*.md` | a required reviewer missing, `rejected`, or its `Commit:` stale | none |
| 3 | Findings disposed | `reviews/*.md` | a `[blocking]` or `[important]` line without `· fixed in <sha>` or `· refuted: <evidence>` | none |
| 4 | Acceptance criteria proven | `proposal.md` (else `requirements.md`), `evidence.md` | evidence missing or stale; a criterion without a `pass`/`verified` row; a `fail`/`defect` row | a criterion with only `no proof` rows; no criteria ids at all |
| 5 | PR open at local head | `gh pr view`, git | no PR yet; local commits not pushed; uncommitted files in the change folder | PR closed or merged; its head not in local history; a merge conflict; `gh` missing or failing |
| 6 | Required checks green | `gh pr checks` (`--required`, else all checks) | a check pending, failing or cancelled | `gh` error; an unknown check state |
| 7 | Conversation answered | `gh api graphql` | an unresolved review thread, a person's newer comment, or a `CHANGES_REQUESTED` not yet replied to | a `CHANGES_REQUESTED` already replied to; more than 100 threads |
| 8 | PR body complete | the PR body | the change id, an acceptance criterion id or the `evidence.md` link is missing | none |

For item 7, a bot's top-level comments and review bodies (deploy previews, coverage and CI summaries) ask nothing and are ignored. A bot's unresolved review thread and its `CHANGES_REQUESTED` count like a person's.

For item 7, a person counts only when GitHub reports their `authorAssociation` as `OWNER`, `MEMBER` or `COLLABORATOR`. Comments, review bodies, review threads and "changes requested" from anyone else (`CONTRIBUTOR`, `NONE`, first-timers) are ignored, so an outside commenter cannot hand the agent work. "Answered" for a top-level comment or review body means newer than the viewer's latest top-level comment or review; a reply inside a review thread answers only that thread.

The rule goes by author type, not by intent: the checker cannot tell whether a bot's top-level comment asks for something, so it ignores every bot top-level comment and review body. A bot that wants a change must say it in an inline review thread or a "changes requested" review.

**Exit codes.** `0` only when all eight are met; `1` when something is open and nothing is blocked; `2` when something is blocked; `3` for a usage or preflight error (unknown change, no `openspec/`, or an invalid `ship` setting, including `merge`, which arrives in a later round).

**JSON.** `--json` prints `{ "version": 1, "change", "schema", "ship", "host", "head", "pr", "phases", "items", "met", "summary", "next" }`. `version` changes only when a field is removed or changes meaning. On exit 3 it prints `{ "version": 1, "error": "<message>" }`. `host` is `app` in the Claude desktop app and `cli` otherwise (`DEVKIT_HOST=app|cli` overrides it).

**The `Commit:` staleness rule.** A reviewer's verdict file and `evidence.md` start with a `Commit: <sha>` line, placed before the first markdown heading (a line under a heading is not read). It is current when the sha resolves, is an ancestor of `HEAD`, every later commit touches only `openspec/`, the line has no `(uncommitted changes)` marker, and the working tree has no change outside `openspec/` and `.claude/`. A later commit to product code (or to a path such as `openspecx/`) makes it stale, and only the reviews or evidence that carry that sha are redone.

**Waiting.** `--watch[=<minutes>]` runs one `gh pr checks <n> --watch --interval 30` (default 9 minutes, at most 30) when the next step is waiting for checks, then computes the contract again. A watch that outlives the cap is stopped and the result is `in progress: item 6`.

## Shipping a change: ship modes

By default (`plan`) the flow is the one above: you give the go-ahead at each step and the agents stop at each gate. A project can opt in, per schema, to letting one skill drive an approved change to a ready PR. The setting lives in `openspec/config.yaml`, in either YAML form:

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
| `pr` | The `ship-change` skill takes the change to a PR that `deliver-check` reports as `ready`, and stops there |
| `merge` | Reserved for round 2 (auto-merge). It is a config error today (exit 3) |

Any other value, a scalar (`ship: pr`), a nested map or a duplicate schema key is also an error that names the key. The hooks do not read `ship`: with or without it, every gate behaves the same.

**What `ship-change` runs.** `/ship-change <id>` (or "ship this change") loops on `deliver-check --json` and does the step it names: `tdd-implementer` per phase, the phase gate command itself, `commit-and-pr` for a commit, `review-change` for only the reviewers that went stale, `pr-verifier`, the PR, then answering the PR's review threads and waiting for checks. It holds no state: a killed session starts again from the files and GitHub, so resuming is just running it again. It reports `ready` only when `deliver-check` exits 0, else `in progress: item N` or `blocked: item N`. Fixes always go through `tdd-implementer`, and it never merges.

**Go-ahead.** In `devkit`, `readiness.md` must say `- Status: APPROVED`. In `devkit-lite`, the go-ahead is your message asking to ship or apply the change.

**App and CLI.** At the "wait for checks" step it runs one capped watch (9 minutes by default). In the CLI it then reports the state and stops; a red check is fixed the next time you run it. In the Claude desktop app a red check after the watch is fixed in the same run, and when it stops `in progress` the app's Auto-fix wakes the session on a CI failure, a merge conflict or a review comment; that session runs `ship-change` again. Auto-fix does not wake on green checks, which is why the watch exists.

**The `tdd-implementer` gate report applies in every mode.** The agent now reports the phase gate's command and output in its Validation section instead of writing `evidence.md` (the hook already blocked that write; `pr-verifier` is the only writer, and its `### Gates` table is the durable record). That is a bug fix, not `ship` behavior, and the go-ahead may come from you or from a skill that re-ran the gate green.

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
      - run: curl -fsSL https://raw.githubusercontent.com/chacal88/devkit/v0.4.0/plugins/openspec/hooks/guard.mjs -o "$RUNNER_TEMP/guard.mjs"
      - run: node "$RUNNER_TEMP/guard.mjs" ci
```

Pin the tag (`v0.4.0` above) and bump it on purpose.

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
| `deliver-check` exits 3 | Unknown change, no `openspec/`, or an invalid `ship` in `openspec/config.yaml` (including `merge`) | Read the message on stderr; fix the id or the config |
| `blocked: item 5` | The PR has a merge conflict, was closed or merged, or its head isn't in your history | Resolve the conflict (or reopen) and run it again; the flow never resolves conflicts |
| `in progress: item 6` | Required checks are still running, or failing | Run `deliver-check <id> --watch` or `ship-change` again; a failing check is fixed through `tdd-implementer` |
| The hooks don't fire at all | `devkit-openspec` isn't installed or enabled | `/plugin` → enable `devkit-openspec@devkit` |

## Cost

Every agent run costs time and tokens, so the defaults keep runs few and cheap:

- `devkit-lite` is the default schema; the full flow is for the changes that need it.
- All reviewers and the readiness reviewer run on Sonnet; only `change-planner` uses Opus. To change a model for one project, copy the agent into the project's `.claude/agents/` and edit its `model:`.
- Reviewers scale to the diff (each has a Budget section), run the test suite at most once, and read tests instead of running mutations unless asked.
- `review-change` summons only the reviewers the diff needs, re-runs only the ones that rejected, checks only their previous findings, and stops after two rounds.
- In the full flow, tasks use as few phases as the work needs: each phase is one implementer run.

## Limits

- Ship mode never merges: the merge is always yours. In `devkit-lite` the hooks allow the main session to edit product code, so only the `ship-change` skill keeps it off product code.
- `openspec/roadmap.md` reports the order between changes; it does not enforce it. A change can be started before the ones it is `after:`.
- Hooks can veto an action; they can't make a step happen. The guarantee is "no code before an independently approved plan, no PR without approved reviews and evidence", not "the review was thorough".
- Shell writes are detected from the command (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `install`, `touch`, `truncate`). A path built from a variable (`"$TMP"/x`) or a script that writes from inside an interpreter (`python -c`, `node -e`) is not resolved, so it isn't gated; CI is the backstop.
- OpenSpec's schema commands are marked experimental by the CLI and may change between versions. The schemas here are validated against OpenSpec 1.16.
- `readiness.md` approval is not invalidated automatically when the plan changes later; the schema tells the agent to re-run it, and review in the PR is the backstop.
