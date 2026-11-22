# Study: Claude Managed Agents and devkit

Change: `managed-agents-study` · Owner: Kaue (chacal88)

Read on: 2026-11-21
Beta header: `managed-agents-2026-04-01`

An item's `ADR:` field names an ADR only when what the item proposes contradicts that ADR. An item
that keeps an ADR's decision cites the ADR in its reasoning and leaves the field at `none`.

## devkit today

This baseline is devkit at commit 2300f84 (devkit-openspec 0.18.1), the base the study was written on. devkit-openspec 0.19.0 and 0.19.1 landed on main while the study was under review; where they change a point, the item says so.

**A change's stages and the checker.** A change is a folder under `openspec/changes/<id>/` whose
stages are declared in `openspec/schemas/devkit/flow.json` (17 stages) and
`openspec/schemas/devkit-lite/flow.json` (14 stages, without design, readiness and approval), with
per-stage ceilings, `onFail` and `staleAfter`. Every stage file opens with the header
`<!-- devkit-stage <id> result=<...> attempt=<n> commit=<sha|none> -->`, and
`plugins/openspec/hooks/flow-check.mjs` reads only those headers, git and GitHub to say which
stage passed and which is next. The change's `.openspec.yaml` records only `schema` and `created`
(and `skip_specs` when set); no devkit or flow version is recorded.

**The change loop and its locks.** `plugins/openspec/hooks/change-loop.mjs` gives one action or one
end per call, reading files, git and GitHub and writing nothing (only `open` and `script` write).
The loop ends in one of four states, each with its reason: archived, waiting for the owner,
waiting on GitHub, blocked (`docs/adr/0010-openspec-as-the-harness.md`, decision 3). The session
that runs `plugins/openspec/skills/devkit/SKILL.md` keeps no state; each action carries a
`progressKey` (stage, step, a fingerprint of the tree), and a repeated key ends the run blocked.
Whether a run is under way is read from the session transcript (`plugins/openspec/hooks/guard.mjs`),
and the stop lock keeps one record per session in the system temp directory.

**The roadmap loop and its run file.** `plugins/openspec/hooks/roadmap-loop.mjs` starts every line
of `openspec/roadmap.md` whose `after:` dependencies are archived, up to a number of places the
owner sets, and holds a start while the processor load is at or above the `load_limit` setting.
It keeps one bookkeeping file, `<git common dir>/devkit/roadmap-run.json`, held by no commit
(`docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, decision 4). `/devkit status`
prints the owner queue, what runs, what is blocked and what waits, and writes nothing.

**The review round.** `plugins/core/skills/review-change/SKILL.md` runs a round in three stages:
the reviewers return findings, three `finding-verifier` agents vote on each blocking or important
finding (two refutations with evidence refute it), and each reviewer writes its own verdict file.
On a turn the owner typed it runs as one Workflow script
(`plugins/core/skills/review-change/scripts/review-round.workflow.js`, ADR 0008); otherwise on the
Agent tool through `review-round.mjs`. At most two rounds; then the owner decides.

**The owner gates.** The plan approval (`approval.md`, tied by hash to `readiness.md`) and the retro
answers are written only from the owner's own message
(`plugins/openspec/skills/ship-change/SKILL.md`, rows `stop-plan-approval` and
`stop-retro-answers`); `plugins/openspec/hooks/deliver-check.mjs` makes an approval stale when the
readiness review changes. `readiness.md` is written only by `plan-readiness-reviewer`
(`plugins/core/agents/plan-readiness-reviewer.md`).

**The hooks.** `plugins/openspec/hooks/hooks.json` registers `guard.mjs` on SessionStart,
PreToolUse (edits, Bash, Agent), Stop and SubagentStop. The guard only vetoes, with a reason: one
writer per gate file, product code closed until the plan is ready, destructive Git refused, a pull
request only with the reviews and the evidence present, and, during a run, no product edit by the
conducting session and no hand-off outside the script's roles (ADR 0011).

**The version and the setup of a project.** `plugins/openspec/skills/openspec-setup/SKILL.md`
copies the schemas into the project's `openspec/schemas/`, versioned with the repository. Field
finding 7 (`openspec/changes/archive/2026-11-21-coordinator-field-fixes/requirements.md`, item 7)
recorded that upgrading the scripts started to require an approval record from full-script
changes already under way; the fix was a setup step that lists the changes under way and asks the
owner, not a version recorded per change.

**Spend.** devkit counts attempts, rounds and places, never tokens or cost
(`docs/openspec-flow.md`, section "Cost", is advice only). The CompozyOS loop template
(`plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml`) has a `budget`
block with tokens and wall clock, set to 0 (no cap). The Claude Code transcripts the guard already
reads record a `usage` object (input, cache and output tokens) on every model message, for the
session and for each subagent.

**The panel and the session icons.** `plugins/panel/README.md` describes the old panel, which reads
the retired `conduct-check`, `deliver-check`, the transcript and the app's session list; round 23
of `openspec/roadmap.md` (`coordination-panels`) replaces it with read-only panels. When the study was written, the stage icon in a session's title (❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery, 📦 archive) was written only in the brief a coordinating session gives; devkit-openspec 0.19.0 maps it per stage in `plugins/openspec/hooks/change-loop.mjs` (ADR 0014).

## Pages read

All pages were read with a web fetch on 2026-11-21. The long pages (`multiagent-orchestration`,
`workflow-runs`, `permission-policies`, `events-and-streaming`) came back in two parts and were
read again from the cut, through the same URL with `.md` appended.

| Id | Page | URL |
|---|---|---|
| P-1 | Claude Managed Agents overview | https://platform.claude.com/docs/en/managed-agents/overview |
| P-2 | Session threads | https://platform.claude.com/docs/en/managed-agents/session-threads |
| P-3 | Multiagent orchestration | https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration |
| P-4 | Workflow runs | https://platform.claude.com/docs/en/managed-agents/workflow-runs |
| P-5 | Agent setup | https://platform.claude.com/docs/en/managed-agents/agent-setup |
| P-6 | Event stream | https://platform.claude.com/docs/en/managed-agents/events-and-streaming |
| P-7 | Session operations | https://platform.claude.com/docs/en/managed-agents/session-operations |
| P-8 | Budgets | https://platform.claude.com/docs/en/managed-agents/budgets |
| P-9 | Define outcomes | https://platform.claude.com/docs/en/managed-agents/define-outcomes |
| P-10 | Permission policies | https://platform.claude.com/docs/en/managed-agents/permission-policies |
| P-11 | Environments | https://platform.claude.com/docs/en/managed-agents/environments |
| P-12 | Subscribe to webhooks | https://platform.claude.com/docs/en/managed-agents/webhooks |
| P-13 | Self-hosted sandboxes | https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes |
| P-14 | Self-hosted Claude Managed Agents | https://platform.claude.com/docs/en/managed-agents/self-hosted |
| P-15 | Scheduled deployments | https://platform.claude.com/docs/en/managed-agents/scheduled-deployments |
| P-16 | Authenticate with vaults | https://platform.claude.com/docs/en/managed-agents/vaults |
| P-17 | Start a session | https://platform.claude.com/docs/en/managed-agents/sessions |
| P-18 | Reference | https://platform.claude.com/docs/en/managed-agents/reference |

## Questions

- S-1 A change pinned to the devkit version it opened with, as a session pins to its agent's version (field finding 7, a schema upgrade over changes under way).
- S-2 One event log per change with a small set of states (running, stopped with a reason such as waiting for the owner, ended), read alike by `/devkit status`, the panels of round 23 and the session icons.
- S-3 A budget per change, as a session budget caps a session's spend.
- C-1 Outcomes and their grader against the readiness review and the review bench.
- C-2 Permission policies and tool confirmations against the hooks and the owner gates.
- C-3 Threads and workflow runs against the stage hand-offs and the review round.
- C-4 What `remote-worker` (round 28) would need from Managed Agents.

## Take as is

### A-1 A version pinned when the work starts, moved only on purpose
- Page: https://platform.claude.com/docs/en/managed-agents/sessions, https://platform.claude.com/docs/en/managed-agents/agent-setup, https://platform.claude.com/docs/en/managed-agents/scheduled-deployments, https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration
- Devkit: `openspec/changes/archive/2026-11-21-coordinator-field-fixes/requirements.md`, `plugins/openspec/hooks/flow-check.mjs`, `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/skills/openspec-setup/SKILL.md`
- Answers: S-1
- Reasoning: A session takes `"agent": {"type": "agent", "id": ..., "version": N}` (a bare id means the latest version at creation), a running session keeps the toolset configuration it was created with, an agent's `predefined_agents` stay pinned to the versions resolved at its last update, and a scheduled deployment "runs one version of its agent and keeps it even when the agent changes" until the deployment is updated. The idea transfers unchanged: field finding 7 is exactly an upgrade that changed the rules for changes already under way, and devkit's `.openspec.yaml` records only `schema` and `created`, so the checker can only judge every change by the flow installed today.
- What changes in devkit: `open` writes the devkit version and the `flow.json` version into the change's `.openspec.yaml`; `flow-check` and the loop judge a change by the flow it opened with, so a stage a later flow adds does not apply to it; a change moves to the new flow only through an explicit command, as `script` already switches a change's script.
- ADR: none
- Roadmap line: L-1

### A-2 The grader works in its own context, never the author
- Page: https://platform.claude.com/docs/en/managed-agents/define-outcomes
- Devkit: `plugins/core/agents/plan-readiness-reviewer.md`, `plugins/core/skills/review-change/SKILL.md`, `CLAUDE.md`
- Answers: C-1
- Reasoning: An outcome's grader "evaluates the artifact against the rubric in a separate context window" and hands its explanation back to the agent for the next iteration. devkit already does this with more independence: the readiness review is written by `plan-readiness-reviewer`, which is not the plan's author, and the review bench's reviewers and verifiers are agents of their own; the project rule is that the implementer never approves its own work.
- What changes in devkit: nothing; the page confirms the design.
- ADR: none
- Roadmap line: none

### A-3 A ceiling on iterations and a distinct result for a rubric that does not apply
- Page: https://platform.claude.com/docs/en/managed-agents/define-outcomes
- Devkit: `openspec/schemas/devkit/flow.json`, `plugins/core/agents/plan-readiness-reviewer.md`
- Answers: C-1
- Reasoning: An outcome has `max_iterations` (default 3, at most 20) and five results: `satisfied`, `needs_revision`, `max_iterations_reached`, `failed` (the rubric does not apply to the deliverables) and `interrupted`. devkit's readiness stage has a ceiling of 3 with `onFail: proposal`, the review stage a ceiling of 2, and the readiness verdict already separates `NEEDS-REVISION` (revise and try again) from `BLOCKED` (cannot be judged as it stands), the same split as `needs_revision` against `failed`.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### A-4 A human checkpoint is a recorded answer, never a model's judgment
- Page: https://platform.claude.com/docs/en/managed-agents/permission-policies, https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration
- Devkit: `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/hooks/deliver-check.mjs`
- Answers: C-2
- Reasoning: The permission page warns that "`auto` is not a human checkpoint" and sends calls that need review to `always_ask`, answered by `user.tool_confirmation`; the orchestration page says there is no approval step before a workflow run starts, so a "wait for my go-ahead" instruction is a prompt that nothing enforces. devkit's owner gates are already the enforced kind: `approval.md` and the retro answers come only from the owner's own message, the guard refuses product code until the plan is ready, and the approval goes stale by hash when the readiness review changes.
- What changes in devkit: nothing; the pages confirm that a gate written in a prompt is not a gate.
- ADR: none
- Roadmap line: none

### A-5 Blocking questions come up in one place, one at a time
- Page: https://platform.claude.com/docs/en/managed-agents/session-threads, https://platform.claude.com/docs/en/managed-agents/events-and-streaming
- Devkit: `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/skills/devkit/SKILL.md`
- Answers: C-2
- Reasoning: A subagent's blocking calls are cross-posted to the primary thread with `session_thread_id` set, and the client answers them there; the server routes each answer to its thread. devkit's roadmap coordinator does the same: stages run in background subagents, and the owner is asked in the coordinating session, one change at a time, each question naming its change.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### A-6 The review round is a phased program whose end does not mean a pass
- Page: https://platform.claude.com/docs/en/managed-agents/workflow-runs
- Devkit: `plugins/core/skills/review-change/scripts/review-round.workflow.js`, `plugins/core/skills/review-change/SKILL.md`, `docs/adr/0008-reviews-as-a-workflow.md`
- Answers: C-3
- Reasoning: A workflow run is a program the agent writes, with named phases that run in order, agents fanned out inside a phase, results passed to the program rather than to the lead agent, a failed agent usually retried once, and a run that can end `completed` while work on its threads failed. devkit's review round is the same shape on Claude Code's Workflow tool: reviewers, then three verifiers per finding, then the writers, and the skill already treats a Workflow result as untrusted until `review-round.mjs` checks it (`Workflow result invalid`).
- What changes in devkit: nothing for the round; if a stage ever runs on Managed Agents, the round's program would be written for that runtime, whose language the page does not show (not stated in the docs, O-5).
- ADR: none
- Roadmap line: none

### A-7 A notification names the object; the state comes from reading it
- Page: https://platform.claude.com/docs/en/managed-agents/webhooks, https://platform.claude.com/docs/en/managed-agents/events-and-streaming
- Devkit: `docs/adr/0010-openspec-as-the-harness.md`, `plugins/openspec/hooks/change-loop.mjs`
- Answers: S-2, C-4
- Reasoning: A webhook carries only the event type and the object's id, delivery order is not guaranteed, a delivery is tried three times and then dropped, and the page says to drive state from the fetched resource; after a reconnect the stream does not replay, so the client lists past events to rebuild. This is devkit's rule already (ADR 0010, decision 3: a lost notification costs nothing because the next turn reads the files again), and the loop's `wait` re-reads GitHub until the decision changes.
- What changes in devkit: nothing; `remote-worker` keeps the rule by reading a remote session's status, never by trusting a pushed event alone.
- ADR: none
- Roadmap line: none

### A-8 An interrupt stops the turn, not the work under way
- Page: https://platform.claude.com/docs/en/managed-agents/workflow-runs, https://platform.claude.com/docs/en/managed-agents/events-and-streaming
- Devkit: `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/skills/devkit/SKILL.md`
- Answers: C-3
- Reasoning: `user.interrupt` stops the agent's turn but ends no workflow run; runs end only when the agent is asked to stop them, and then end `stopped`. `/devkit roadmap stop` has the same meaning: it starts nothing new and lets each change finish the stage it is in.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

## Improve or fix

### F-1 One state per change, derived once and read by every surface
- Page: https://platform.claude.com/docs/en/managed-agents/session-operations, https://platform.claude.com/docs/en/managed-agents/events-and-streaming, https://platform.claude.com/docs/en/managed-agents/session-threads, https://platform.claude.com/docs/en/managed-agents/budgets
- Devkit: `docs/adr/0010-openspec-as-the-harness.md`, `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/skills/devkit/SKILL.md`, `plugins/panel/README.md`, `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`
- Answers: S-2
- Reasoning: A session has four statuses (`idle`, `running`, `rescheduling`, `terminated`), an idle session carries one `stop_reason` (`end_turn`, `requires_action`, `budget_reached`; `retries_exhausted` and `refusal` appear in examples without a definition, not stated in the docs, O-4), the session status aggregates its threads, and the budget page tells the client to treat the session-level stop reason as the signal. devkit already has the small set: the loop's four ends with a reason (ADR 0010, decision 3) plus a stage under way. What it lacks is one reader: `/devkit status` assembles the state in `roadmap-loop.mjs`, a run under way is read from the transcript in `guard.mjs`, the old panel reads the retired `conduct-check`, and the session icons, mapped per stage in `change-loop.mjs` since devkit-openspec 0.19.0, read no state. A stored event log as the source of truth is not proposed: ADR 0010 keeps the state in the repository and GitHub (decisions 3 and 6) and rejected "a session that remembers where it is"; a derived state keeps that decision and gives the surfaces one answer.
- What changes in devkit: a read-only command of the change loop prints, for one change or all, the state (`running`, `waiting-for-owner`, `waiting-on-github`, `blocked` or `archived`), its reason and the stage, derived from the files, GitHub and the roadmap run file; `/devkit status`, the session title's icon (beside the stage icons of `change-loop.mjs`) and the round 23 panels read it.
- ADR: none
- Roadmap line: L-2, L-3

### F-2 A budget per run of a change, checked between hand-offs
- Page: https://platform.claude.com/docs/en/managed-agents/budgets, https://platform.claude.com/docs/en/managed-agents/scheduled-deployments, https://platform.claude.com/docs/en/managed-agents/workflow-runs
- Devkit: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/guard.mjs`, `docs/openspec-flow.md`, `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml`, `openspec/config.yaml`
- Answers: S-3
- Reasoning: A session budget is a cap on list cost (tokens at list price, web searches, and running time at $0.08 per hour), checked between model requests, so the request that crosses it completes; at the cap every thread pauses and the session goes idle with `budget_reached`, history and sandbox kept, and raising or removing the budget resumes it with no further event. A deployment copies its cap to each session it starts, so each run has its own cap, not a cumulative one. devkit has no spend control at all, only attempt ceilings, rounds and places; the CompozyOS template's `budget` block is set to no cap. Dollars at list price would need a price table devkit does not keep, while the transcripts the guard already reads carry a `usage` object on every model message, for the session and for each subagent, so tokens are countable today. A change can span sessions and machines, so the cap is per run, as a deployment's is.
- What changes in devkit: a token budget per run of a change, set in the `devkit:` block of `openspec/config.yaml` and overridable in the change's `.openspec.yaml`, counted from the usage the run's transcript and its subagents' transcripts record, checked by the loop between hand-offs; at the cap the run ends waiting for the owner with the reason budget reached, and a raised budget lets `/devkit change` resume.
- ADR: none
- Roadmap line: L-4

### F-3 What `remote-worker` needs if it runs on Managed Agents
- Page: https://platform.claude.com/docs/en/managed-agents/overview, https://platform.claude.com/docs/en/managed-agents/sessions, https://platform.claude.com/docs/en/managed-agents/vaults, https://platform.claude.com/docs/en/managed-agents/environments, https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes, https://platform.claude.com/docs/en/managed-agents/budgets, https://platform.claude.com/docs/en/managed-agents/session-operations
- Devkit: `openspec/roadmap.md`, `docs/coordination-design.md`, `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, `plugins/openspec/hooks/hooks.json`
- Answers: C-4
- Reasoning: The pages settle three of the four open points of the `remote-worker` line and leave one partly open. Sessions are seen through the API and the Console (whether any other client lists them is not stated in the docs, O-7). The owner reaches a session only through `user.message`, `user.tool_confirmation` and `user.interrupt` sent through the API. Runtime is billed: list cost counts running time at $0.08 per hour on top of tokens (whether that applies to a self-hosted sandbox is not stated in the docs, O-6). For the repository and credentials, a `github_repository` resource and vault credentials exist, with secrets substituted only at egress, but both are refused on a self-hosted sandbox, and whether `git` and `gh` work with an egress-substituted token is not stated in the docs (O-2); the devkit packs are Claude Code plugins, and the pages describe agent skills, not plugins or hooks, so whether they can run in a sandbox is not stated in the docs (O-3). Two facts reshape the line: a cloud sandbox takes the processor load off the owner's machine, while a self-hosted sandbox runs the tools (tests included) on a machine the owner operates, so it does not; and a Managed Agents session runs none of devkit's hooks, so the locks hold there only through the pull request's checks (ADR 0010, decision 5: where a driver cannot refuse an action, a GitHub check is the lock). Running the change coordinator itself in such a session contradicts ADR 0011, whose coordinator is the owner's session held by hooks, and ADR 0013 for the roadmap; running only stages there (an implementation phase, a review round) keeps both, with the stage's result read back from the branch.
- What changes in devkit: nothing now; the `remote-worker` grill takes this item and the open points as its input, and the change writes the ADR that amends ADR 0011 if it moves the coordinator itself.
- ADR: `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, section "Decision", only if the change coordinator itself moves into a Managed Agents session
- Roadmap line: L-5

## Does not fit

### X-1 Stage agents as persistent threads that take follow-ups
- Page: https://platform.claude.com/docs/en/managed-agents/session-threads, https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration
- Devkit: `docs/adr/0010-openspec-as-the-harness.md`, `plugins/openspec/hooks/change-loop.mjs`
- Answers: C-3
- Reasoning: A subagent thread persists until archived, keeps its history and takes follow-up messages, up to 25 child threads per session. devkit hands each stage to a fresh agent with a brief and keeps the only memory in the stage files, so a lost session costs nothing (ADR 0010, decision 3, and its rejected alternative "A session that remembers where it is"). A thread's history would be a second record beside the files, which is what ADR 0010 chose not to have.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### X-2 A model-judged permission (`auto`) in place of the hooks
- Page: https://platform.claude.com/docs/en/managed-agents/permission-policies
- Devkit: `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/hooks.json`
- Answers: C-2
- Reasoning: Under `auto` the server judges each call and allows, denies or asks; it reads intent from `user.message` and the page itself says it is not a human checkpoint. devkit's guard is deterministic: the same file, role and state always get the same answer, with a reason the agent can act on (ADR 0010, decision 5). A judged policy would make a gate depend on wording.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### X-3 Scheduled deployments to start changes on a clock
- Page: https://platform.claude.com/docs/en/managed-agents/scheduled-deployments
- Devkit: `plugins/openspec/skills/devkit/SKILL.md`, `docs/adr/0010-openspec-as-the-harness.md`
- Answers: C-4
- Reasoning: A deployment starts a session on a cron schedule, with its budget copied to each run. devkit starts a roadmap only on the owner's call, and its skill forbids any cron or scheduled wake-up; ADR 0010 keeps the loop driven by the owner's call and the files; the cron wake-up of ADR 0005 went with that ADR's supersession. A clock would start work no one asked for in that turn.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### X-4 An advisor consulted inside the author's turn
- Page: https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration
- Devkit: `plugins/core/skills/review-change/SKILL.md`, `CLAUDE.md`
- Answers: C-3
- Reasoning: The primary thread consults a stronger model mid-turn and keeps doing the work itself; the advice returns into the author's context. devkit's checks are independent of the author by rule (the implementer never approves its own work; every delivery passes the independent review bench), so advice the author absorbs cannot stand in for a reviewer.
- What changes in devkit: nothing.
- ADR: none
- Roadmap line: none

### X-5 devkit's hooks inside a Managed Agents session
- Page: https://platform.claude.com/docs/en/managed-agents/permission-policies, https://platform.claude.com/docs/en/managed-agents/reference, https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
- Devkit: `plugins/openspec/hooks/hooks.json`, `plugins/openspec/hooks/guard.mjs`
- Answers: C-2, C-4
- Reasoning: The only controls a Managed Agents session puts on a tool call are its permission policy per tool (`always_allow`, `always_ask`, `auto`) and custom tools the client runs; there is no hook that sees a call's content and refuses it with a reason, as devkit's PreToolUse guard does for gate files and product code. A self-hosted worker runs the tool calls on its own host and posts the results back, but whether a worker can refuse a call before running it is not stated in the docs (O-1).
- What changes in devkit: nothing; `remote-worker` relies on the pull request's checks for any stage it runs remotely, as F-3 says.
- ADR: none
- Roadmap line: L-5

## Proposed roadmap lines

### L-1 A change pinned to its devkit version
- Kind: new
- Id: change-version-pin
- Round: 25c: a change pinned to its devkit version
- Place: before the heading ## Round 16: the new stage roles
- From: A-1
- Text: change-version-pin (after: managed-agents-study) — a change records, when it opens, the devkit version and the flow version it opened with in its `.openspec.yaml`, and the checker and the loop judge it by that flow: a stage a later version adds does not apply to a change opened before it, and a change moves to the new flow only through an explicit command, as a Managed Agents session keeps the agent version it was created with and a deployment moves only when updated (field finding 7; managed-agents-study A-1)
- Answer: approved

### L-2 One state per change
- Kind: new
- Id: change-state
- Round: 25d: one state per change
- Place: before the heading ## Round 16: the new stage roles
- From: F-1
- Text: change-state (after: managed-agents-study) — one read-only command of the change loop derives a change's state from the files, GitHub and the roadmap run file: running, or one of the loop's four ends with its reason (waiting for the owner, waiting on GitHub, blocked, archived), and the stage; `/devkit status`, the session title's icon (beside the stage icons of `change-loop.mjs`, ADR 0014) and the panels read it alike, as a Managed Agents session reports one status with one stop reason (managed-agents-study F-1)
- Answer: approved
- Revised: after devkit-openspec 0.19.0 put the stage icons in `change-loop.mjs` (ADR 0014), the owner chose, on 2026-11-22, to drop the move of the icons from this line, and approved the new wording.

### L-3 The panels read the change's state
- Kind: addition
- Adds to: coordination-panels
- From: F-1
- Text: Carried from the managed-agents-study: the panels read each change's state from the `change-state` command, not from the stage files, the run file and the transcript one by one (study item F-1).
- Answer: approved
- Revised: after review round 1 the owner chose, on 2026-11-21, this wording and the dependency `change-state` added to the host line's `after:` list, and approved both.

### L-4 A budget per run of a change
- Kind: new
- Id: change-budget
- Round: 25e: a budget per run of a change
- Place: before the heading ## Round 16: the new stage roles
- From: F-2
- Text: change-budget (after: managed-agents-study) — a token budget per run of a change, set in the `devkit:` block of `openspec/config.yaml` and overridable in the change's `.openspec.yaml`, counted from the usage the run's transcript and its subagents' transcripts record and checked by the loop between hand-offs; at the cap the run ends waiting for the owner with the reason budget reached, and a raised budget lets `/devkit change` resume, as a Managed Agents session budget pauses the session between model requests and a deployment copies its cap to each run (managed-agents-study F-2)
- Answer: approved

### L-5 What remote-worker takes from the study
- Kind: addition
- Adds to: remote-worker
- From: F-3, X-5
- Text: Carried from the managed-agents-study: its items F-3 and X-5 and its open points O-1 to O-7 are the grill's input. A Managed Agents session runs none of devkit's hooks, so a stage run there is held only by the pull request's checks (ADR 0010, decision 5); a cloud sandbox takes the processor load off the owner's machine and a self-hosted sandbox does not; running only stages remotely keeps the coordinator in the owner's session, while moving the coordinator itself means the change writes the ADR that amends ADR 0011 (and ADR 0013 for the roadmap).
- Answer: approved

## Open points for the grill of remote-worker

- O-1 Can a self-hosted environment worker refuse a tool call before running it, so devkit's guard could run there: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes).
- O-2 Do `git push` and `gh` work with a GitHub token held as a vault `environment_variable` credential and substituted only at egress, given the warning that clients that check a secret's format or sign requests locally fail: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/vaults).
- O-3 Can Claude Code plugins, with their hooks, be installed and run inside a sandbox, or only agent skills: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/agent-setup).
- O-4 What is the full list of `stop_reason` types, and what do `retries_exhausted` and `refusal` mean: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/events-and-streaming).
- O-5 In what language and with what calls does an agent write a workflow, so the review round could be written for it: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/workflow-runs).
- O-6 Does the running-time charge of list cost ($0.08 per hour) apply to a session on a self-hosted sandbox: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/budgets).
- O-7 Does any client other than the Console and the API list a workspace's sessions, so the owner could see them beside the app's sidebar: not stated in the docs (https://platform.claude.com/docs/en/managed-agents/session-operations).
