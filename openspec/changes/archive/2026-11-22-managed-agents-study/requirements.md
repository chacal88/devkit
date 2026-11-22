<!-- devkit-stage requirements result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Requirements

## Request

> a study change, in a session of its own, that reads Anthropic's Claude Managed Agents documentation in depth (the pages under `platform.claude.com/docs/<lang>/managed-agents/`, at least `overview`, `session-threads`, `multiagent-orchestration` and `workflow-runs`) and compares it with how devkit runs a change and a roadmap; it writes, in the change, what devkit can take as it is, what it should improve or fix to run the way Anthropic expects agents to run, and what does not fit, each item with the page it comes from and the devkit file it touches, and it proposes the roadmap lines that follow, for the owner to approve one by one. Starting candidates, from the owner's first read on 2026-11-21: a change pinned to the devkit version it opened with, as a session pins to its agent's version (field finding 7, a schema upgrade over changes under way); one event log per change with a small set of states (running, stopped with a reason such as waiting for the owner, ended), read alike by `/devkit status`, the panels of round 23 and the session icons, in place of state pieced together from stage files, the run file and the transcript; and a budget per change, as a session budget caps a session's spend. Also compared: outcomes and their grader against the readiness review and the review bench, permission policies and tool confirmations against the hooks and the owner gates, threads and workflow runs against the stage hand-offs and the review round, and what `remote-worker` (round 28) would need from it

Classification: domain=process type=feature flags=[] (confirmed: only Markdown under `openspec/` changes; no hook, script, schema or plugin file is edited, so the short script fits).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The study is one file, `openspec/changes/managed-agents-study/study.md`, archived with the change; no file under `docs/` is created for it.
- The pages read are, under `https://platform.claude.com/docs/en/managed-agents/`: the four of the request (`overview`, `session-threads`, `multiagent-orchestration`, `workflow-runs`); the seven the comparisons need (`agent-setup`, `events-and-streaming`, `session-operations`, `budgets`, `define-outcomes`, `permission-policies`, `environments`); and the four that say what `remote-worker` would need (the self-hosted sandboxes page, the scheduled deployments page, `webhooks` and the vaults page, at the slugs the overview's navigation gives).
- The study works from the documentation only: no call to the Claude API, no API key, no spend. A fact the pages do not state is written as "not stated in the docs" and becomes an open point for the grill of `remote-worker`, never a guess.
- The study records the date it read the pages (2026-11-21 or later) and the beta header the pages name (`managed-agents-2026-04-01`), since the feature is in beta and its pages change.
- Every study item has: a category (`take as is`, `improve or fix`, `does not fit`); the Managed Agents page and section it comes from, as a full URL; the devkit file or files it touches, as paths from the repository root; what would change in devkit; and, when it leads to work, the proposed roadmap line.
- An item that contradicts a locked ADR under `docs/adr/` names the ADR and its section, and its proposed roadmap line includes writing the ADR that would replace it; the study itself decides nothing about the ADR.
- A proposed roadmap line is either a new change (id, round, `after:` dependencies, the line's text) or an addition to a named pending line of `openspec/roadmap.md`, worded as the retros' additions are ("Carried from the managed-agents-study: ..."). Lines already ticked `[x]` are never edited.
- The owner approves the proposed lines one at a time, asked by the session after `study.md` is written and before the review stage; an approved line is written into `openspec/roadmap.md` in this change's pull request; a declined one stays in `study.md`, marked declined with the owner's reason.
- The tick of `managed-agents-study` itself in `openspec/roadmap.md` happens at its archive, as for every change, not in this delivery.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `study-file-exists`: `openspec/changes/managed-agents-study/study.md` exists, lists the pages it read with their full URLs and the date of the reading, and names the beta header the pages carry.
- AC-2 `three-categories`: `study.md` has three sections, one per category (`take as is`, `improve or fix`, `does not fit`), and every item sits in exactly one of them.
- AC-3 `items-cite-page-and-file`: every item of `study.md` cites at least one URL under `https://platform.claude.com/docs/en/managed-agents/` and at least one devkit path; every cited devkit path exists in the repository at the study's commit.
- AC-4 `starting-candidates-answered`: `study.md` has one item for each of the three starting candidates (a change pinned to the devkit version it opened with; one event log per change with a small set of states; a budget per change), each placed in a category with its reasoning.
- AC-5 `comparisons-answered`: `study.md` answers each of the four comparisons of the request (outcomes and their grader against the readiness review and the review bench; permission policies and tool confirmations against the hooks and the owner gates; threads and workflow runs against the stage hand-offs and the review round; what `remote-worker` would need), each with at least one item.
- AC-6 `unstated-facts-marked`: every point the read pages do not settle is written as "not stated in the docs" and listed in an open-points section of `study.md` addressed to the grill of `remote-worker`.
- AC-7 `adr-collisions-named`: every item that contradicts a locked ADR names the ADR file and section, and its proposed roadmap line includes the ADR that would replace it.
- AC-8 `lines-approved-one-by-one`: each proposed roadmap line is put to the owner on its own, and `study.md` records each answer (approved, or declined with the owner's reason).
- AC-9 `approved-lines-in-roadmap`: every approved line, and only those, is in `openspec/roadmap.md` in this change's pull request, as a new change line or as an addition to the named pending line; no `[x]` line changed.
- AC-10 `checks-pass`: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass on the branch.

## Out of scope

- Any change to hooks, scripts, schemas, agents, skills or plugin manifests: the study only proposes; the approved roadmap lines carry the work.
- Calling the Claude API or the Managed Agents beta, creating agents, environments or sessions, or any spend.
- Writing or amending an ADR: the study names the collision and the roadmap line carries the ADR.
- Deciding `remote-worker`'s design: the study lists what it would need and the open points for its grill.
- A permanent document under `docs/` about Managed Agents.
