<!-- devkit-stage proposal result=passed attempt=2 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Proposal

Change: `compozy-driver` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 2, 3, 10, 11 and 13,
`docs/adr/0009-compozy-loop-as-a-second-driver.md`, `docs/adr/0010-openspec-as-the-harness.md`
decisions 2, 3, 4 and 8, `docs/adr/0008-reviews-as-a-workflow.md`,
`docs/adr/0016-stage-roles-write-their-own-files.md` decision 3). Round 21 of
`openspec/roadmap.md`, step 9 of the build order. Revised on 2026-11-22 for `main` at `77b15b1`
(`design.md`, "Revision 2026-11-22 (main at 77b15b1)").

## Why

A project whose `openspec/config.yaml` sets `devkit.driver: compozy` cannot run a change today:
`/devkit` answers that the driver is not built (round 21), and the only CompozyOS path is the
twelve-stage loop of `devkit-compozy`, started by hand, with four role shells (`tech-lead`, `dev`,
`qa`, `design`) that duplicate the stage order the checker already owns and, since round 16,
dispatch the four new stage roles themselves. The live check of
2026-11-22 answered D-10's open point (CompozyOS can choose the agent of a node from an earlier
node's output), so the short loop ADR 0010 decision 4 promised can now be built.

## What Changes

- `/devkit change` and `/devkit roadmap` run on the CompozyOS driver: typed in Claude Code, they
  only start a CompozyOS run and say, in one reply, where to follow it. Every owner question of the
  change (the grill, one question at a time; the mock-up approval of a change with screens; the
  plan approval; the retro answers) becomes a CompozyOS human request, and the run records each
  answer by script in the form the Claude driver writes. `/devkit project` on this driver says it does not run there yet. When
  CompozyOS is missing, stopped, or does not know the project, the reply says so with the command
  that fixes it and nothing runs. The `script` driver keeps its "not built" reply (round 22).
- **BREAKING** for projects on the old kit: `compozy-setup` installs three short loops
  (`devkit-change`, `devkit-review`, `devkit-roadmap`) and one CompozyOS agent per devkit role that
  has a Claude agent file, named exactly as the role (`change-planner`, `tdd-implementer`, each
  reviewer, ...). Each agent is generated from that Claude agent and hands its stage to it, so the
  hooks see the same agent in both drivers; a CI check turns red when a generated agent differs from
  its source. A re-run removes the old loop `openspec-change` and the shells `tech-lead`, `dev`,
  `qa` and `design`, and keeps and names any of them the project edited.
- The change loop asks the checker (`change-loop.mjs`) which stage is next, runs the agent named
  after that stage's role, checks the stage's gate, and asks again until the change is archived.
  The steps that only run a command the checker built (accepting the plan's decision records
  right after the recorded approval, switching the script) are run by the loop itself, with no
  agent; a refusal reaches the owner with the command's own reason. A red test run, a refused push
  or an escalated plan is a stage result the checker judges, not a failure of the run.
  The review round runs each reviewer as its own agent in its own session at once, three refuting
  verifiers per blocking or important finding, and the same verdict rule. The roadmap loop starts
  up to the number the owner typed, holds starts above `load_limit`, and starts the next change when
  an archive frees it, with Claude Code closed.
- A new Claude agent, `devkit-openspec:change-coordinator`, carries the coordinator's steps on
  CompozyOS (the grill's next question, the opening, the retro, the delivery steps the Claude session
  does itself, the facts an approved mock-up settled). In Claude Code the session stays the coordinator and the agent is never handed work.
- In a CompozyOS session the hooks refuse every tool write of `approval.md`: only the kit's record
  step writes it, from the owner's own answer.
- A new ADR (next free number at merge; `0017` today) amends ADR 0009 (the gates and the loop),
  ADR 0008 decision 5 (a third path for the review round's three stages) and ADR 0016 decision 3's
  CompozyOS sentence (the records are accepted by the loop's step, not by the implementer shell
  that leaves). The planning role is named
  `change-planner`, the owner's choice over `planner` (grill question 4);
  `docs/coordination-design.md`, `docs/roles.md`, the `coordination-cleanup` roadmap line and the
  build order stop listing the old loop, which leaves here (A-7).

Non-goals: `/devkit project` on CompozyOS (A-9); the script driver (round 22); the panels (round
23) and the rest of the cleanup (round 24), the `screen-design` and `screen-demo` skills included;
running a change end to end on GitHub inside this change (AC-6 and AC-10 are dogfood).

## Acceptance criteria

Copied from `requirements.md`, with their ids. "Proved here": this change's tests and its local
proof on this Mac with CompozyOS 0.6.2; "dogfood": the first real change on this driver.

- AC-1 `compozy-change-starts-run` — In a project whose `openspec/config.yaml` sets `devkit.driver: compozy`, typing `/devkit change <id>` in Claude Code starts a CompozyOS run for that change and replies with where to follow it; Claude Code asks no question of the change. Proved here.
- AC-2 `short-loop-picks-role` — The CompozyOS run asks the checker which stage is next, runs the agent named after that stage's role, checks the stage's gate and asks again; the agent of each stage is the one the checker named, read from the run's node sessions. Proved here.
- AC-3 `owner-answers-in-compozy` — The grill's questions, one at a time, the plan approval and the retro answers reach the owner as CompozyOS human requests; answering them there moves the run on, and `approval.md` records the owner's own answer. Grill and plan approval proved here; the retro answers proved in dogfood.
- AC-4 `local-proof-to-review` — In a local test project, one small change runs on CompozyOS from the grill through the plan approval, the implementation, the verification and the review round, with no Claude Code session open after the start. Proved here.
- AC-5 `review-round-as-claude` — The review round runs each needed reviewer as its own agent in its own session at the same time, three refuting verifiers per blocking or important finding, and rejects while a blocking finding stays open. Proved here (in the AC-4 run; a blocking finding is seeded if the run raises none).
- AC-6 `github-steps` — Pull request, required checks, merge and archive run on CompozyOS. Proved in dogfood.
- AC-7 `agents-follow-source` — Every CompozyOS agent the kit ships is generated from the Claude agent of the same name; changing one source line and running the check turns it red until the agents are regenerated. Proved here.
- AC-8 `reinstall-renames` — Reinstalling the kit over a project that has the old kit leaves the new agents and the new loop and removes `tech-lead`, `dev`, `qa`, `design` and the old loop; a hand-edited old file stays and is named in the re-run's output. Proved here, in a scratch copy of the old kit.
- AC-9 `roadmap-starts-runs` — With the CompozyOS driver, `/devkit roadmap <n>` starts up to `<n>` change runs at once on a test roadmap and holds new starts above the load limit. Proved here.
- AC-10 `roadmap-starts-next` — When a change of a CompozyOS roadmap run archives, the run starts the next change its `after:` freed, with Claude Code closed. Proved in dogfood (archiving needs GitHub).
- AC-11 `not-running-says-so` — With CompozyOS not installed or its daemon stopped, `/devkit change` and `/devkit roadmap` on this driver reply with one sentence and the fixing command and run nothing; `/devkit project` on this driver says it does not run there yet. Proved here.
- AC-12 `claude-driver-unchanged` — On the Claude driver, `/devkit change`, `/devkit roadmap` and `/devkit project` behave as before: no behaviour changes. Proved here by the existing hook suite.

The mock-up approval, an owner gate `main` gained after the grill (round 16), falls under A-2's
"every question of the change"; AC-3's wording is unchanged: the mock-up is proved here by the
tests of the view, the record step and the loop, and live in dogfood with the retro answers.

## Capabilities

### New Capabilities

- `compozy-driver`: how a change and its review round run on CompozyOS: the loop that asks the
  checker and runs the named agent, the owner's gates as human requests (the grill, the mock-up,
  the plan approval, the retro answers), the recorded approval and mock-up, the decision records
  accepted by script, the phase gate, the wait on GitHub, a blocked change, and the review round's
  parallel sessions.

### Modified Capabilities

- `change-coordination`: the driver setting runs `compozy` (it starts a CompozyOS run and says where
  to follow it) and says when CompozyOS cannot run; only `script` stays not built.
- `roadmap-coordination`: `/devkit roadmap` and `/devkit status` on the CompozyOS driver; the
  roadmap run in CompozyOS (places, the load hold, the next start, stop).
- `project-definition`: `/devkit project` on the CompozyOS driver says it does not run there yet.
- `compozy-kit-setup`: the installed file set (generated agents, three loops), retired files
  removed or kept, unused recorded inputs dropped, the agents' CI check; the grill requirement of
  the old loop and the requirement that the four shells run the round-16 stages are removed.
- `change-stages`: `change-coordinator` gains an agent file; only `review-bench` and `owner` have
  none (main's block, with the four round-16 roles, kept).
- `coordination-locks`: `approval.md` is refused to every tool write in a CompozyOS session.

## Impact

- devkit-openspec: `plugins/openspec/hooks/change-loop.mjs`, `roadmap-loop.mjs`, `project-loop.mjs`,
  `guard.mjs`, a new `compozy-driver.mjs` with its tests, their suites and `guard.test.mjs`; the
  `devkit` skill; the new agent `plugins/openspec/agents/change-coordinator.md`.
- devkit-compozy: `compozy-setup` (skill, `install-kit.mjs`, a new `gen-agents.mjs`, the templates,
  the resolver `bin/devkit-kit`) and its tests, now run by the hook suite; the two screen skills'
  sentences that name the removed loop.
- This repository: `.compozy/` reinstalled; `.github/workflows/ci.yml` gains the agents check;
  docs (`docs/compozy-kit.md`, `docs/roles.md`, `docs/coordination-design.md`,
  `docs/openspec-flow.md`, `docs/conventions.md`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`),
  ADRs 0008, 0009, 0010 and 0016 (Notes) and the new ADR, `openspec/config.yaml`,
  `openspec/roadmap.md`; versions, from 0.22.1, 0.3.1 and 0.26.1 today: devkit-openspec 0.23.0
  (tagged `v0.23.0` after the merge), devkit-compozy 0.4.0, marketplace 0.27.0.
- devkit-core: unchanged; its agents are the sources the kit's agents are generated from.
- Dependencies: CompozyOS 0.6.2 (`compozy` CLI and daemon) on the machine that runs the driver;
  round 15 (`change-coordinator`), round 16 (`stage-roles`, ADR 0016) and round 18
  (`roadmap-coordinator`), all archived. No open
  decision of `docs/coordination-design.md` is touched except D-10's, which this change answers.
