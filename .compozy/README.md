# .compozy/ - CompozyOS skeleton of this project

What CompozyOS reads to give this project an identity. It travels with the repository; the
daemon adds `workspace.toml` (a stable id for this machine) on the first registration, which is
git-ignored.

## Agents (agents/)

The devkit is the engine: OpenSpec changes, hooks that keep product code closed until the plan is
ready, reviewer agents and checkers. CompozyOS only sequences the stages, holds the human gates,
runs sessions and shows the panel. There is one agent here for every role the devkit names, twenty-one
in all. Each is a seat: a CompozyOS session that hands its work, unchanged, to the Claude agent of
the same name (`devkit-core:<role>` or `devkit-openspec:<role>`) and returns that agent's report in
the shape the loop's node asks for, so the devkit hooks judge the work exactly as they do in
Claude Code. They are generated from the Claude agent files by
`node plugins/compozy/kit/scripts/gen-agents.mjs` in the devkit repository, so a
change goes into the Claude agent, never into a copy here.

The default agent is `change-coordinator`, the hands of the loops: it opens a change, runs one
turn of the requirements grill, carries out the delivery and retro steps of the `ship-change`
skill, and writes the steps of the review loop. The agents that do the stages are the ones the
checker names each turn (`change-planner`, `tdd-implementer`, `commit-and-pr`, `pr-verifier`,
`screen-designer`, `test-runner`, `e2e-tester`, the reviewers and the rest).

## Loops (loops/)

| Loop | Does |
| --- | --- |
| `devkit-change` | carries one change from its request to archived. Every turn it asks the devkit checker what is next (`change-loop next`), has the checker confirm what it read, and runs that one step: a role, the review loop, a phase gate, a command, or a question to you. It ends when the checker says the change is archived. |
| `devkit-review` | the review round of the `review-change` skill: the bench of reviewers in parallel, three verifiers for every finding that needs one, the writers of the verdict files, and the consolidated `review.md`. `devkit-change` starts it; it needs no input from you. |
| `devkit-roadmap` | starts the changes of `openspec/roadmap.md` in roadmap order while there are free places and the machine is not loaded, and ends when every line is archived or nothing can start. |

You answer in CompozyOS, in the request the loop opens: the grill's questions, the approval of the
plan, the approval of the mock-up, the answers to the retro's proposals, and a choice to retry or
stop when a step is blocked. Nothing else asks for you, and no agent can answer for you.

## How `/devkit` starts them

On a project whose `openspec/config.yaml` says `driver: compozy` in its `devkit:` block,
`/devkit change <request>` in Claude Code starts `devkit-change` for the change and replies with
where to follow it; `/devkit roadmap <n>` starts `devkit-roadmap` for `n` places, and `/devkit
roadmap stop` stops it. Nothing starts a loop on its own, and a loop never needs Claude Code to stay
open. The checkers run through `.compozy/bin/devkit-kit`, which finds them in a repository checkout
or in the installed devkit packs, so no loop names a path that exists in only one repository.
