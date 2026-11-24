<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

Change: `compozy-driver` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Grill: held on 2026-11-22 in the owner's session on the Mac where CompozyOS 0.6.2 is installed
(the change was opened on the Linux worker, which has no CompozyOS, and moved here for the live
proof). Ten questions (Questions asked). This is round 21 of `openspec/roadmap.md`, step 9 of the
build order in `docs/coordination-design.md` (section 11), from sections 2, 3 and 10 (D-2, D-3,
D-10).

Classification: domain=process type=feature flags=[architecture, contract] (confirmed: a second
driver of the whole flow, the kit's agents and loop that installed projects rely on are replaced,
and `/devkit change` and `/devkit roadmap` gain a new path).

## Request

> CompozyOS runs the same short loop (ask the checker, run the role, check the gate) in place of the twelve-stage loop, `/devkit` starts the run when the project's driver is CompozyOS, and the kit's planning role is renamed from `tech-lead` to `planner` (D-2, D-3, D-10)

## Live check before the grill (the open point of D-10)

Can CompozyOS choose the role on each turn? **Yes**, checked live on 2026-11-22 with CompozyOS
0.6.2. A probe loop `devkit-role-probe` had a `run-agent` node `pick` (agent `general`) returning
`{ "role": "qa" }` through its `output_schema`, and a second `run-agent` node `use` with
`params.agent: "{{ .nodes.pick.output.role }}"`. `compozy loop validate` accepted it; run
`looprun-51f6f97521863670` ended `done`, and the session of node `use`
(`sess_fdb927a13acd1c43507e84f04a1454db`) ran as agent `qa`. The probe loop was deleted after.
Also seen: a loop needs `start: - kind: uds` to be started by `compozy loop run` from the command
line; a node's `kind` is a registry tool id (`compozy tool list`) or `run-agent`, `gate`, `branch`;
gate criteria of `type: command` run a shell command.

## Assumptions

- A-1. The driver is chosen by the existing setting `devkit.driver: compozy` in the project's
  `openspec/config.yaml`. In `plugins/openspec/hooks/change-loop.mjs` the table `DRIVER_ROUND`
  stops answering `driver-not-built` for `compozy` (`script` keeps it, round 22).
- A-2. Where the owner answers (question 1): with the CompozyOS driver, `/devkit change <id>` typed
  in Claude Code only starts the CompozyOS run and says, in one reply, where to follow it. Every
  question of the change (the grill, the plan approval, the retro answers) reaches the owner as a
  CompozyOS human request and is answered there; no Claude session has to stay open or remember
  anything. The owner's answers are still the only source of `approval.md` and the retro answers.
- A-3. One agent per role (questions 3 and 4): the kit installs one CompozyOS agent for each role
  the devkit stages name (`docs/roles.md`), named exactly as the role (`change-planner`,
  `plan-readiness-reviewer`, `tdd-implementer`, `pr-verifier`, `commit-and-pr`, each reviewer, ...).
  The loop runs the agent whose name the checker returns for the next stage, with no translation
  table. The request's `planner` therefore becomes `change-planner`: the owner chose the role's own
  name over the short one (question 4). Which roles that have no agent file today
  (`change-coordinator`, `owner`, `review-bench`) are played by the loop itself or by an agent is
  the planner's.
- A-4. Same text, generated (question 5): each CompozyOS agent's instructions are generated from
  the same file as the Claude agent of the same name (`plugins/core/agents/<role>.md`), and a check
  run in CI turns red when a generated agent differs from its source, as
  `python3 scripts/gen-catalog.py --check` does for the catalog.
- A-5. The review round (question 6) runs in CompozyOS as it does in Claude Code: each reviewer
  the change needs as its own agent in its own session, at the same time; each blocking or
  important finding gets three refuting verifiers in their own sessions; the verdict follows the
  same rule (any open blocking finding rejects).
- A-6. Reinstalling the kit (questions 2 and 8): the kit re-run in
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs` installs the new agents and the
  new loop and removes the old ones: `.compozy/agents/tech-lead/`, `.compozy/agents/dev/`,
  `.compozy/agents/qa/`, `.compozy/agents/design/` and `.compozy/loops/openspec-change/loop.yaml`.
  A file the project edited by hand (its hash differs from `.compozy/kit-manifest.json`) is never
  deleted: it stays, and the re-run names it for the owner to decide.
- A-7. The old twelve-stage loop leaves in this change (question 8), not in `coordination-cleanup`:
  its agents leave here, so it could not run anyway. This change edits the `coordination-cleanup`
  line of `openspec/roadmap.md` and the build-order rows of `docs/coordination-design.md` so the
  cleanup no longer lists the old CompozyOS loop.
- A-8. The roadmap runs on CompozyOS too (questions 7 and 9): with the CompozyOS driver,
  `/devkit roadmap [<n>]` starts one CompozyOS roadmap run, which starts one change run per ready
  change up to `<n>`, holds new starts above the person's `load_limit` as the Claude driver does,
  and, when a change archives, starts the next change its `after:` dependencies freed, on its own,
  with Claude Code closed. `/devkit roadmap stop` and `/devkit status` keep their meaning on this
  driver. Whether the roadmap run is a parent loop starting child runs (the tool
  `compozy__loop_run` exists) or another shape is the planner's.
- A-9. `/devkit project` on the CompozyOS driver is not in this change: it answers with one plain
  sentence that it does not run on CompozyOS yet and runs nothing.
- A-10. When CompozyOS is not installed or its daemon is not running, `/devkit change` and
  `/devkit roadmap` on this driver say so in one plain sentence, with the command that fixes it,
  and run nothing.
- A-11. A decision record: the change amends ADR 0009
  (`docs/adr/0009-compozy-loop-as-a-second-driver.md`); the new ADR takes the next free number on
  `origin/main` when the change merges main.

## Acceptance criteria

Each criterion says where it is proved: **here** (in this change's evidence, in a local test
project on this Mac with CompozyOS 0.6.2) or **dogfood** (in the first real change run on the
CompozyOS driver, which the roadmap records).

- AC-1 `compozy-change-starts-run` — In a project whose `openspec/config.yaml` sets
  `devkit.driver: compozy`, typing `/devkit change <id>` in Claude Code starts a CompozyOS run for
  that change and replies with where to follow it; Claude Code asks no question of the change.
  Proved here.
- AC-2 `short-loop-picks-role` — The CompozyOS run asks the checker which stage is next, runs the
  agent named after that stage's role, checks the stage's gate and asks again; the agent of each
  stage is the one the checker named, read from the run's node sessions. Proved here.
- AC-3 `owner-answers-in-compozy` — The grill's questions, one at a time, the plan approval and
  the retro answers reach the owner as CompozyOS human requests; answering them there moves the
  run on, and `approval.md` records the owner's own answer. Grill and plan approval proved here;
  the retro answers proved in dogfood.
- AC-4 `local-proof-to-review` — In a local test project, one small change runs on CompozyOS from
  the grill through the plan approval, the implementation, the verification and the review round,
  with no Claude Code session open after the start. Proved here.
- AC-5 `review-round-as-claude` — The review round runs each needed reviewer as its own agent in
  its own session at the same time, three refuting verifiers per blocking or important finding,
  and rejects while a blocking finding stays open. Proved here (in the AC-4 run; a blocking finding
  is seeded if the run raises none).
- AC-6 `github-steps` — Pull request, required checks, merge and archive run on CompozyOS. Proved
  in dogfood.
- AC-7 `agents-follow-source` — Every CompozyOS agent the kit ships is generated from the Claude
  agent of the same name; changing one source line and running the check turns it red until the
  agents are regenerated. Proved here.
- AC-8 `reinstall-renames` — Reinstalling the kit over a project that has the old kit leaves the
  new agents and the new loop and removes `tech-lead`, `dev`, `qa`, `design` and the old loop; a
  hand-edited old file stays and is named in the re-run's output. Proved here, in a scratch copy
  of the old kit.
- AC-9 `roadmap-starts-runs` — With the CompozyOS driver, `/devkit roadmap <n>` starts up to `<n>`
  change runs at once on a test roadmap and holds new starts above the load limit. Proved here.
- AC-10 `roadmap-starts-next` — When a change of a CompozyOS roadmap run archives, the run starts
  the next change its `after:` freed, with Claude Code closed. Proved in dogfood (archiving needs
  GitHub).
- AC-11 `not-running-says-so` — With CompozyOS not installed or its daemon stopped, `/devkit change`
  and `/devkit roadmap` on this driver reply with one sentence and the fixing command and run
  nothing; `/devkit project` on this driver says it does not run there yet. Proved here.
- AC-12 `claude-driver-unchanged` — On the Claude driver, `/devkit change`, `/devkit roadmap` and
  `/devkit project` behave as before: no behaviour changes. Proved here by the existing hook suite.

## Out of scope

- `/devkit project` on CompozyOS (A-9).
- The script driver (round 22).
- The panels (round 23) and the rest of the cleanup (round 24), except the old CompozyOS loop (A-7).
- Running a real change end to end on GitHub inside this change (AC-6 and AC-10 are dogfood).

## Questions asked

1. [end effect] Where does the owner answer the change's questions on the CompozyOS driver? →
   In CompozyOS; Claude Code only starts the run (A-2).
2. [edges] A project with the old kit reinstalls it: what does it see? → The planning agent is
   renamed; a hand-edited old file stays, with a warning (A-6).
3. [scope] Which agents appear in CompozyOS? → One per devkit role (A-3).
4. [scope] Their names? → Exactly the role names, so `tech-lead` becomes `change-planner`, and
   `dev`, `qa` and `design` leave by the same rule (A-3).
5. [project rules] When a role changes in Claude Code, does the CompozyOS agent follow? → Yes,
   generated from the same file, checked in CI (A-4).
6. [project rules] How does the review round run on CompozyOS? → As in Claude Code: parallel
   reviewers, three refuting verifiers, same verdict rule (A-5).
7. [end effect] What proof before the change is ready? → A local test project from the grill to
   the review round; the GitHub steps in the first real change (AC-4, AC-6).
8. [scope] Which commands work on CompozyOS in this change? → `/devkit change` and
   `/devkit roadmap` (A-8, A-9).
9. [end effect] When a roadmap change finishes on CompozyOS, who starts the next? → CompozyOS, on
   its own (A-8).
10. [project rules] The old loop uses the agents that leave, and the roadmap left its removal to
    `coordination-cleanup`: keep it or remove it? → Removed in this change; the roadmap and the
    design's build order are adjusted (A-7).

## Escalations

- The roadmap line and D-2/D-10 name the renamed role `planner`; the owner chose `change-planner`
  (question 4). The plan updates `docs/coordination-design.md` and `docs/roles.md` to match.
