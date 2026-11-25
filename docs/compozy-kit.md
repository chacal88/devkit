# The CompozyOS kit: devkit-compozy

`devkit-compozy` (`plugins/compozy/`) ships the CompozyOS driver of the devkit flow as a pack: twenty-one
agents, three loops, the `bin/devkit-kit` resolver, a workspace `config.toml`, and the
kit installer (`kit/scripts/install-kit.mjs`) that `/devkit setup` runs to install them into a project
as `.compozy/`. CompozyOS runs the loops and
holds the owner's questions; the devkit itself (OpenSpec change files, the hooks that keep product
code closed until the plan is ready, the reviewer agents and the checkers) decides every step and
does the work inside it. A project installs the kit only when it runs CompozyOS: a project that does
not never pays for its skill descriptions.

The design is [ADR 0024](adr/0024-compozy-runs-the-short-loop.md), which amends
[ADR 0009](adr/0009-compozy-loop-as-a-second-driver.md): the twelve-stage loop and its four role
shells of the first kit are gone.

## The three loops

| Loop | Does |
|---|---|
| `devkit-change` | carries one change from its request to archived. Every turn is one generation: `read` asks the devkit checker what is next (`change-loop.mjs next --view compozy`), `confirm` has the checker agree with what was read, and one step runs: a role, the review loop, a phase gate, a command, or a question to the owner. It ends when the checker says the change is archived. |
| `devkit-review` | the review round of the `review-change` skill as parallel sessions: the bench of reviewers, three verifiers for each finding that needs them, the writers of the verdict files and the consolidated `review.md`, all through `review-round.mjs`. `devkit-change` starts it. |
| `devkit-roadmap` | starts the changes of `openspec/roadmap.md` in roadmap order while there are free places and the machine is not loaded, and ends when every line is finished or nothing can start. It merges nothing. |

Nothing in a loop knows a stage, a role or a rule: the checker's view names the step, and every gate
(the plan's readiness, the tests of each phase, the review, the delivery, the archive) is decided by
the scripts the Claude driver already uses: `change-loop.mjs`, reading `flow-check` and, through
`conduct-check`, `deliver-check`. What "ready" means stays one checker anyone can run, whichever
driver started the run.

## The agents and the seat

There is one CompozyOS agent for every role that has a Claude agent file, twenty-one in all, named as the
role (`change-planner`, `tdd-implementer`, `commit-and-pr`, `pr-verifier`, `screen-designer`,
`test-runner`, `e2e-tester`, the reviewers and the rest). Each is a **seat**: a CompozyOS session that
hands its work, unchanged, to the Claude agent of the same name (`devkit-core:<role>` or
`devkit-openspec:<role>`) and returns that agent's report in the shape the loop's node asks for. The
devkit hooks therefore judge the work exactly as they do in Claude Code. The agents are generated
from the Claude agent files by `plugins/compozy/kit/scripts/gen-agents.mjs`, and CI
fails when one is out of date, so a change goes into the Claude agent, never into the copy. A
description is shortened to the 280 characters CompozyOS accepts; the body is the source's.

The default agent of the workspace is `change-coordinator`, the hands of the loops: it opens a change,
runs one turn of the requirements grill, carries out the delivery and retro steps of the
`ship-change` skill, and writes the review loop's files.

## What the owner answers, and where

A question to the owner is a CompozyOS request, shown in the run's page; only a human answers it, and
the answer is recorded by a script of the checker (`record-approval`, `record-mockup`,
`record-answer`) before the turn ends. No tool of a CompozyOS session writes `approval.md`. The
requests are:

- the requirements grill's questions;
- the approval of the mock-up, for a change flagged `ui`;
- the approval of the plan, with notes when the owner does not approve (the planner revises);
- the answers to the retro's proposals;
- a choice to retry or stop, with a note, when a step is blocked (a red phase gate, a role that failed,
  a refusal of `accept-decisions`).

Accepting the plan's decision records is not a question: the loop runs the checker's
`accept-decisions` command itself, with no agent, right after the recorded approval.

## How `/devkit` starts a run

On a project whose `openspec/config.yaml` says `driver: compozy` in its `devkit:` block,
`/devkit change <request>` in Claude Code starts `devkit-change` for the change and replies with
where to follow it; `/devkit roadmap <n>` starts `devkit-roadmap` for `n` places, and `/devkit
roadmap stop` stops it. The session runs no loop and asks nothing of the change. Nothing starts a loop
on its own, and a loop never needs Claude Code to stay open. Without CompozyOS installed or its daemon
running, or without the workspace or the kit, the call says which of them is missing and starts
nothing.

## What a project must provide

- `driver: compozy` in the `devkit:` block of `openspec/config.yaml`.
- The project's own test commands (`devkit.tests.unit`, and `devkit.tests.e2e` when it has end-to-end
  tests), which the test stages and the phase gates run.
- A `design:` block in `openspec/config.yaml` (`screen_map:`, optionally `mockup:`), only for a
  project that has screens to track.

See [the pack's README](../plugins/compozy/README.md) for the contract.

## How to adopt it

1. **Install the pack and type `/devkit setup`.** On the owner's yes to the kit, or with the driver
   `compozy`, it runs the kit installer, which writes `.compozy/` into the project: `config.toml`,
   `README.md`, the twenty-one agents (`agents/<role>/AGENT.md`), the three loops
   (`loops/<name>/loop.yaml`) and the resolver `bin/devkit-kit`; the `design:` block of
   `openspec/config.yaml` is set by hand, only when the project has screens. It never starts a run or writes
   product code. A loop file in the workspace's `.compozy/loops/` is listed and run by name; there is
   no step to publish it.

   The files are installed by a script, `install-kit.mjs`, which records the inputs and a digest of
   every file in `.compozy/kit-manifest.json`. Running it again updates the files the project did not
   edit and reports a file already equal to its rendering as `same`. A file the project edited is
   shown and kept until the owner says yes for that file, one question per file; the run is then
   repeated with `--accept <path>` for it.
2. **Register the project in CompozyOS** (`compozy workspace add`) and set `driver: compozy`.
3. **Run it** with `/devkit change <what you want>`, or `compozy loop run --name devkit-change` with
   `change_id` and `request`.

### Reinstalling over the first kit

A project on the first kit (four role shells and the `openspec-change` loop) types `/devkit setup`
again, which runs the kit installer again. Each file of the old kit that is still equal to its recorded digest is removed (`remove`); one
the project edited is kept and named (`kept`), and is removed only when it is named in `--accept`. The
inputs the old templates recorded and the new ones no longer have are dropped from the manifest
(`dropped`). The twenty-one agents and the three loops are created. Runs of the old loop under way finish
on the loop definition CompozyOS already holds. A workspace whose default agent was `tech-lead` needs
another one: `compozy workspace edit <name> --default-agent change-coordinator`.

## How it relates to `/devkit change`

`/devkit change` ([ADR 0010](adr/0010-openspec-as-the-harness.md),
[ADR 0011](adr/0011-the-change-coordinator-is-the-owners-session.md)) and the CompozyOS loop are
**two ways to drive the same devkit flow**, not two flows: the same checker, the same artifacts
(`proposal.md`, `design.md`, `tasks.md`, `reviews/`, `evidence.md`), the same hooks and the same
owner gates. `/devkit change` runs the flow from the owner's own Claude Code session; the CompozyOS
loop runs it as a supervised multi-agent run that outlives the session, with the owner's decisions as
CompozyOS requests. A project picks the one that fits how it works, and a change runs on one of them.
The merge itself stays the owner's unless the project's ship mode says `merge`
([ADR 0002](adr/0002-merge-without-the-owner-opt-in.md)); the loop merges nothing by hand.

The CompozyOS driver does not carry every feature of the Claude driver: the token budget, the Jira
entry and write-back, the `state` command's view of a run, and the machines of a remote roadmap are not
reached from a CompozyOS run. [ADR 0024](adr/0024-compozy-runs-the-short-loop.md) lists each limit.

### Not carried yet

What the Claude driver gained after the kit's loops were written, and the CompozyOS driver does not
run yet. Each line is a later change (`compozy-driver-gaps` in `openspec/roadmap.md`):

- The delivery train: the steps `on-train` and `wait-train`, the `boarded` end and the `train` verb
  ([ADR 0022](adr/0022-reviewed-changes-leave-on-a-delivery-train.md)). The view turns the first two
  into the `github` kind and `boarded` into an owner question; no loop departs a train.
- The model chosen by stage and the retry one model up
  ([ADR 0023](adr/0023-the-model-is-chosen-by-stage.md)): the CompozyOS agents choose their own
  models, and the view has no `model` field.
- The `requirements-triage` seat is installed with the other agents, but no loop dispatches it, so
  every grill question goes to the owner.

## Checker portability

Every shipped loop calls the devkit checkers through `.compozy/bin/devkit-kit`, a resolver that finds
them at `$DEVKIT_HOOKS`, in a repository checkout, or in the installed `devkit-openspec` with the
highest version, so no loop holds a path that exists in only one repository. `screens-check` resolves
inside this pack itself, since it ships with it.
