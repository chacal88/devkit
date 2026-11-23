# The coordination design

This page is the design of how devkit coordinates the work of a change and of a roadmap. [ADR
0010](adr/0010-openspec-as-the-harness.md) governs it: OpenSpec is the harness, and two coordinators
drive the flow as a loop over files. The page is written so that a reader who never saw the planning
conversation can plan the second step of the build order (section 11) from it alone. The first step
is the change `orchestrator-replan`, which recorded this design; it builds none of it.

Every item below is marked with who decided it:

- **decided**: the owner said it, or the owner delegated it and the item names who decided it.
- **proposed**: shown to the owner and not objected to.
- **open**: nobody decided it yet.

On 2026-11-19, after this page first shipped, the owner answered most of its open points; the
change `design-open-points` recorded the answers, and each answered item says who decided it and
when.

Tense: a sentence in the present tense is about what exists at the commit that ships this page. The
`devkit` and `devkit-lite` schemas (each with its `flow.json`), the stage header and the checker `flow-check` (built by the change `flow-script-checker`), `openspec/config.yaml`, `openspec/roadmap.md`, the hooks and
their locks, `ship-change`, `conduct-check`, `deliver-check`, the review Workflow script,
the panel and the CompozyOS loop exist today. So do, since the change `change-coordinator` (round 15),
the command `/devkit change`, the change coordinator of the Claude driver (the owner's session, run by
the script `change-loop.mjs`), its two stop locks and its edit and hand-off locks
([ADR 0011](adr/0011-the-change-coordinator-is-the-owners-session.md)), and the two settings
`devkit.language` and `devkit.driver`. So do, since the change `roadmap-coordinator` (round 18), the
commands `/devkit roadmap` and `/devkit status`, the roadmap coordinator of the Claude driver (the
owner's session, run by the script `roadmap-loop.mjs`, in the desktop app each change in a session of its own
([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)), each stage a subagent in the background;
[ADR 0013](adr/0013-the-roadmap-coordinator-is-the-owners-session.md)), its run locks and the pack
setting `load_limit`. So do, since the change `project-phases` (round 19), the command `/devkit project`,
the `devkit-project` schema (with its `flow.json`), the script `project-loop.mjs` and the slice contract
the `devkit-reviews` check applies to a slice's pull request
([ADR 0015](adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)), and, since the change
`stage-roles` (round 16), the roles `screen-designer`, `adr-author`, `test-runner` and `e2e-tester` with the
skills `screen-mockup`, `adr-authoring` and `e2e-testing`, the demonstration as text, and the settings
`devkit.tests.unit`, `devkit.tests.coverage.command`, `devkit.tests.coverage.target` and `devkit.tests.e2e`
([ADR 0016](adr/0016-stage-roles-write-their-own-files.md)). `/conduct` no longer exists. So do, since the change `delivery-models` (round 17), the delivery
models chosen per project in `devkit.delivery`, the two-PR model and its lock, and the support branch
that solves a conflict with the test branch
([ADR 0018](adr/0018-the-delivery-model-is-chosen-per-project.md)).
Everything else (the other verbs of `/devkit`, the rest of the `devkit:`
configuration block, the other two drivers,
the new panels) is to be built, and each section names the round of `openspec/roadmap.md` that
builds it. The section "What stays shipped until its round" lists what keeps working meanwhile.

## 1. How the owner uses it (D-1)

**The need (decided).** The owner has had `muita dificuldade` using the current tools: `/conduct`
accepts only a change id, with nowhere to say what is wanted, and a CompozyOS run starts from another
command outside the session. The owner wants to open a session, type one simple command with the
content, and have it run, including when the project runs on CompozyOS. Ease of use is a first-class
requirement.

**The commands (decided by the owner on 2026-11-19: the names stay as proposed).** One `/devkit` command with
few verbs, to be built in rounds 15, 18, 19 and 20:

| Command | What it does | Round |
|---|---|---|
| `/devkit change PROJ-482` | one task, read from Jira by its key or link | 20 |
| `/devkit change <free text>` | one task, described in text | 15 |
| `/devkit roadmap` | the whole roadmap, one change at a time | 18 (built) |
| `/devkit roadmap 3` | the whole roadmap, up to three changes at once | 18 (built) |
| `/devkit project <name>` | deeper planning of a new project or slice, in the four phases | 19 (built) |
| `/devkit status` | where everything is and what waits on the owner | 18 (built) |
| `/devkit help` | opens the help panel | 23 |

**The rules behind them (proposed).**

- The same command in every project: the driver comes from the project's configuration, and the
  command starts a CompozyOS run for the owner when that is the driver.
- The request travels with the command.
- A Jira task becomes the request, and the grill asks only what the task does not answer.
- Calling the command again resumes where it stopped.
- Every reply says what happened and what comes next, without internal terms.

**Writing back to Jira (decided by the owner on 2026-11-19).** devkit reads Jira by default and
writes back (a comment with the pull request link, a status change) only when the developer asks:
the developer decides.

## 2. Two coordinators and three entries (D-2)

**The roadmap coordinator, `manager` (decided; the name decided by the assistant on the owner's delegation, 2026-11-19).** Built in round 18
(`roadmap-coordinator`). It
reads `openspec/roadmap.md`, sees what is ready to start and what waits on another change, and
starts the next changes on its own, without asking first. It may have several change coordinators
running at once, one per change, only among changes that do not depend on each other. How many is
not a project setting: the owner chooses it per run and can change it mid-run, because it depends on
the task, on the machine at that moment and on the other projects running. Lowering it never
interrupts a change under way.

**Holding a start while the machine is loaded (decided by the owner on 2026-11-19).** The roadmap
coordinator holds the start of a new change while the machine is loaded, and what is under way
finishes first. **Decided by
`roadmap-coordinator` on 2026-11-21 (A-6, grill questions 8 and 9):** it measures the processor load of
the last minute per logical core against the per-person `load_limit` (80 by default); memory is not
measured; a held start is announced once and checked every minute. The owner may tell the session to start the held changes anyway, once; the next start is held again. In the desktop app a change session is started only on a turn the owner typed: on any other turn the change waits for the owner's next message, with a line that says so ([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)).

**The change coordinator, `tech-lead` (decided; the name decided by the assistant on the owner's delegation, 2026-11-19).** Built in round 15
(`change-coordinator`). It takes one change from its opening to its archive. It asks the script which
stage comes next, hands that stage to its subagent, checks the gate and asks again. It writes no code
and does not decide the order. It replaced the `/conduct` skill in round 15. In the Claude driver it is
the session the owner typed `/devkit change` in, held by hooks ([ADR
0011](adr/0011-the-change-coordinator-is-the-owners-session.md)).

**The ADR 0007 rules the coordinator keeps. Decided by the owner on 2026-11-20 (round 15 grill, question 2), and by A-4.** Unfinished work is named with where it stopped, and the owner is asked
before anything is created or run: a new request while another change is unfinished asks to continue
or to start the new one. Typing `/devkit change <text>` is the owner's answer that creates the change:
the session names the id and the script and says why, without a question. Resuming a named or the only
unfinished change asks nothing.

**Three entries (decided).** The owner defines a project (section 7), calls the roadmap coordinator
for the whole roadmap, or calls the change coordinator directly for one task.

**Names (decided by the assistant on the owner's delegation, 2026-11-19).** The owner suggested
team-like names, said naming is not important, and left the choice to the assistant, noting that
the CompozyOS kit's `tech-lead` role is a planner today. `manager` is the roadmap coordinator and
`tech-lead` the change coordinator; the CompozyOS kit's present `tech-lead` role, which plans, is
renamed `planner`, so every driver uses the same role names: `manager`, `tech-lead`, `planner`,
`dev`, `qa` and `design`. The rename is to be built in round 21 (CompozyOS driver); until then the
kit's planner keeps the name `tech-lead`.

**The two roles called `tech-lead`. Decided on 2026-11-20 (A-7).** The script, the agents and
`docs/roles.md` use the role id `change-coordinator`; `tech-lead` stays the team name of that role in
this document. The CompozyOS kit's `tech-lead` (its planner) is untouched until round 21.

## 3. What the orchestrator is (D-3)

**A command and a loop, never a session that remembers (proposed, on the owner's failure report).**
The owner's past failure, in the owner's words:
`a sessão parou de acompanhar; a sub-sessão terminou e não avisou, então a comunicação se perdeu`
("the session stopped following; the sub-session finished and did not notify, so the communication
was lost"). The orchestrator is therefore a command the owner starts and a loop
behind it, never a session that has to remember where it is. Each turn of the loop reads the files,
runs the stage that is ready and checks its gate. A lost notification or a dead session costs
nothing: the next turn reads the files again. The checker exists (`flow-check`, built by the change
`flow-script-checker`), and the loop is built (`change-loop.mjs`, round 15).

**Three layers (proposed).** They let the same flow serve several projects and platforms (the owner:
it has to work wherever we are running, with Codex as the example):

- **Script**: the OpenSpec schema and configuration (stages, order, the role of each stage, gates,
  the delivery model). The same on every platform.
- **Roles**: the roadmap coordinator, the change coordinator and the stage agents with their skills,
  as plain text. Each platform receives the same roles in its own format.
- **Driver**: who runs the loop, chosen per project: a Claude session, CompozyOS, or a script that
  calls another AI from the command line. CompozyOS is not frozen; it becomes one of the drivers
  (decided by the owner).

**The script names roles (built).** The script names roles, never one platform's tool. The `flow-script-checker`
change replaced the Claude names in both schemas with roles; [roles.md](roles.md) says what each role
does and who plays it in Claude Code today.

**Stages are subagents (proposed; decided by the assistant, because the owner asked only for
something that works).** Each stage is a subagent of the change coordinator. The owner likes a parent
session with grouped child sessions; that stays as an optional way to watch the work in the Claude
driver if a live test shows it holds (open until that test). The flow never depends on it.

## 4. The stages of one change (D-4)

The stages are the owner's (decided); the agents, skills and gates are proposed. `new` marks what
does not exist today. The new roles and skills are to be built in round 16 (the change coordinator
exists since round 15), the roadmap coordinator in round 18; the second pull request exists since round 17.

| # | Stage | Who and skills | Produces | Gate |
|---|---|---|---|---|
| 0 | Choose the next change (roadmap coordinator entry only) | roadmap coordinator (built, round 18) | the start request | its `after:` dependencies are archived |
| 1 | Open the change | change coordinator (new, round 15) | `openspec new change`, a worktree and branch named after the change, cut from the base the delivery model names | schema confirmed |
| 2 | Requirements (grill) | change coordinator with the owner; `requirements-grill`; `codebase-researcher` | `requirements.md` | the owner answered |
| 3 | Mock-up, only when the change alters a screen, before any plan | `screen-designer` (built, round 16), skill `screen-mockup` (built, round 16), `screen-design` | the screens drawn with real example data, saved in the change's `mock/` | the owner approves; what the mock reveals goes back into the requirements |
| 4 | Decisions and ADRs | `adr-author` (built, round 16), skill `adr-authoring` (built, round 16) | proposed ADRs in the project's ADR folder, when the change needs them | the agent first analyses whether an ADR is needed; if not, it leaves one line saying so |
| 5 | Plan | `change-planner`, `openspec-validator` | proposal, specs, design, tasks | `openspec validate --strict` |
| 6 | Plan readiness | `plan-readiness-reviewer`, `plan-reality-auditor`, `adr-reviewer`; `plan-readiness-review` | `readiness.md` | approved; a rejection returns to the plan, three times at most |
| 7 | The owner's approval | the owner | `approval.md`, of the plan and the ADRs together | it came from the owner's own message |
| 8 | Implementation, one subagent per phase | `tdd-implementer`; `test-driven-development`, `systematic-debugging` | code, tests, ticked tasks | the phase's test command is green |
| 9 | Unit tests | `test-runner` (built, round 16); `test-and-coverage`, `systematic-debugging` | the whole suite and its coverage | suite green, coverage within the project's target |
| 10 | E2E tests, only where the project has E2E configured | `e2e-tester` (built, round 16), skill `e2e-testing` (built, round 16) | E2E tests written from the acceptance criteria, apart from the implementer, and their result | green; it is a delivery condition |
| 11 | Demonstration | `pr-verifier` (built, round 16) | `evidence.md`, as text, inside the change: per acceptance criterion, what the agent did, what it observed and whether it passed | every criterion demonstrated and recorded |
| 12 | Code review | the six reviewers, `finding-verifier` x3; `review-change` | `reviews/*.md`, `review.md` | consensus; two rounds at most |
| 13 | Delivery | `commit-and-pr`; `commit-message-guidelines` | commit, push, the pull request to the base of the delivery model (in the two-PR model, both pull requests open together) | GitHub checks green and the merge the model defines |
| 14 | Second pull request, two-PR model only (built, round 17) | `commit-and-pr` | the pull request from the same branch to `master`, opened together with the one to `develop` | the owner merges the one to `develop` first; the check on the one to `master` then turns green; the owner merges it |
| 15 | Retro and archive | change coordinator with the owner; `retro` | `retro.md`, `openspec archive`, the roadmap line ticked | the owner answered each proposal |

Owner decisions inside this table (decided unless marked):

- **Mock-up** (stage 3): whenever a change alters a screen, before anything else, before planning.
  Since `stage-roles` (round 16) `screen-designer` draws it, only when the grill's classification lists
  `ui`, and the owner approves it before the plan; `screen-design` still records the screen-map rows
  that point at the drawn files, after the plan, in the CompozyOS pack.
- **ADRs** (stage 4): every feature has an agent responsible for analysing what will be done and
  defining the ADRs; it analyses first, writes when needed, does not when not.
- **Tests** (stages 8 to 10): a strong focus on tests, a specialist for each kind. The owner accepts
  that the implementer's TDD covers unit tests; E2E matters even for the delivery. A project without
  E2E structure does not run stage 10; adding E2E tests as new tasks are done is each project's
  choice. Decided by the assistant: no second author of unit tests.
- **Demonstration** (stage 11): the agent, not the owner, demonstrates what was delivered and
  records it as text inside the change, which is archived afterwards. No screenshots and no videos
  are kept. The pull request is not the place for that record. Where a project accepts automatic
  merge, the agent's validation is the validation and the merge goes on without the owner.
- **A lean pull-request template (decided by the owner on 2026-11-19: a debt for later)**: an idea
  of the owner's, with less text. It is a debt item on `openspec/roadmap.md` (round 27), and the
  owner researches models of a template first. Today `deliver-check` requires the PR body to name
  the change, every acceptance criterion and the evidence path, so that rule changes with the
  template.

## 5. Delivery models (D-5)

Chosen per project, in configuration (decided by the owner; built in round 17 by the change
`delivery-models`, key `devkit.delivery.model`):

- **Two pull requests from the same branch (decided; built in round 17).** How one of the owner's
  projects works. Every task branch is cut from `master` or `main`; a first pull request goes to
  `develop`, for testing; once approved, a second pull request from the same task branch goes to
  `master`. `develop` never goes to `master`, so the task branch never receives `develop` either,
  not even to solve a conflict. Both pull requests open together and the owner merges both. The lock
  that keeps `develop` out of the task branch is in section 8.
- **Trunk-based (decided; exists today).** A short branch, a pull request to the main branch, the
  owner merges.
- **Trunk-based with automatic merge (decided; exists today).** The same, and GitHub merges when the
  gates are green.

devkit knows all three since round 17; trunk-based with automatic merge is ADR 0002's `merge` mode
under a second spelling.

**The conflict with `develop` (answered by the owner on 2026-11-21, round 17 grill, questions 3 to 5).**
A support branch `<task-branch>-develop`, cut from the task branch, alone receives `develop`; the
conflict is solved there, and the pull request to `develop` is closed and opened again from it. The pull
request to `master` stays red until the one to `develop` is merged. The resolution, read as the support
branch's own work, goes through the review bench again before the branch is pushed, and the change is
archived through two archive pull requests, one to each branch
([ADR 0018](adr/0018-the-delivery-model-is-chosen-per-project.md)).

## 6. Panels (D-6)

**Read-only panels (decided; to be built in round 23).** The panels follow the work; the owner does
not want to start anything from a panel. There is one for the roadmap coordinator, one for the change
coordinator (the change, the stage it is in, the subagents), and a small help panel showing how to
use the project and its commands.

**The mock (decided).** The mock was drawn as a Claude Design canvas with five screens (roadmap
coordinator, change coordinator, the detail of one stage, the band above the prompt box, help) and
approved on 2026-11-19 (`Ficou perfeito`, "it came out perfect"). No button starts, sends or changes
anything; the only presses open a detail or a document, or refresh.

**Where the approved mock lives.** In the `mock/` folder of the change `orchestrator-replan`:
`openspec/changes/orchestrator-replan/mock/` until the change is archived, then under
`openspec/changes/archive/`. It holds the five `.dc.html` screens, `canvas.json` and the owner's
planning page (`planning-page.pt-BR.html`, in Portuguese). They are working files, not
documentation.

**Language (decided).** The panels' language comes from the plugin's own configuration, per person
(section 9).

## 7. Defining a project: the four phases (D-7)

**The flow (decided; built in round 19).** A flow for the four phases the owner usually runs
(the `devkit-design` skills: business, domain model, architecture with ADRs, implementation plan),
from which the roadmap comes out for the roadmap coordinator to orchestrate. It serves any project,
new or ongoing, whenever the owner judges that a new slice deserves deeper planning before starting,
including as research on how to do it. What already exists in a project does not go through it.

**What exists (built by `project-phases`, round 19).** The `devkit-project` schema declares the
stages `open`, the four phases, the roadmap, the review and the delivery; `/devkit project <slice>`
opens the slice as an OpenSpec change in its own worktree, and the script `project-loop.mjs` says what comes
next. The phases are conversations with the owner, so they run in the owner's session. Each slice's
documents live in `docs/design/<slice>/`, its ADRs in `docs/adr/`, and it reaches the default branch in one
pull request that the ADR reviewer clears
([ADR 0015](adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)).

**Decided by `project-phases` on 2026-11-21 (the grill's nine answers).**

1. Each slice's documents are in `docs/design/<slice>/`, one folder per slice (grill question 1).
2. Any of the four phases may be marked not applicable, with its reason (grill question 2).
3. The fifth stage shows the proposed rounds, the owner approves them, and only then it appends them to
   `openspec/roadmap.md` and names `/devkit roadmap` without starting it (grill question 3).
4. One pull request at the end, cleared by the ADR reviewer alone and merged by GitHub once the checks pass
   (grill question 4).
5. The phases run in the session where the command was typed, in a worktree named after the slice; typing
   it again resumes (grill question 5).
6. A flat `docs/design/` stays untouched (grill question 6).
7. The five `devkit-design` skills still work by name, asking for the slice and writing no roadmap and no
   pull request (grill question 7).
8. A slice may end with no new change: the fifth stage is then not applicable and the roadmap does not
   change (grill question 8).
9. The change proves the flow with a scripted run; the first real slice is the dogfood of a next change
   (grill question 9).

**The roadmap and small work (decided by the owner on 2026-11-19).** The four phases are one
optional way to produce a roadmap, never a prerequisite. A developer who knows what they want
writes `openspec/roadmap.md` directly, and a one-off feature goes straight onto it.

## 8. The harness (D-8)

**Decided by the owner.** OpenSpec is the harness: through OpenSpec's configuration it runs this
approach of sub-sessions and subagents. If the two coordinators have to stay outside OpenSpec, that
is fine. The idea is to centralise on OpenSpec so it is more compatible with other projects and other
people, without depending so much on devkit's own library.

**The OpenSpec 2.0.0 test (decided as a finding, tested on 2026-11-19 with a throwaway schema).**

It covers:

- Every stage as an artifact, the ones after implementation included.
- `openspec status --json` answers ready, blocked or done per stage.
- `openspec instructions <stage> --json` returns the stage's instruction text together with the
  project's `context` and `rules`.
- `openspec instructions apply --json` reports task progress.
- A custom top-level block in `openspec/config.yaml` is tolerated by `status` and `validate`.

It does not cover:

- A file that exists counts as a stage done (a `readiness.md` saying NEEDS-REVISION unlocked the next
  stage).
- Stages after implementation became ready with zero tasks done.
- Pull requests, checks and the owner's approval.
- Retries, attempt limits and a way back to an earlier stage.
- Extra keys on an artifact (`agent`, `skills`) pass validation and are dropped from the output.

OpenSpec prints that its `schema` commands are experimental and may change.

**The harness rules (the checker and the header are built by `flow-script-checker`; the rest is to be built in the rounds named).**

- Everything that defines the flow lives under the project's `openspec/`: `config.yaml` (language of
  the files, driver, delivery model, test commands, task source), `roadmap.md`, and the schemas
  `devkit` (one change), `devkit-lite` (a small change) and `devkit-project` (the four phases, built in round
  19). The configuration block is filled by the rounds that need it: the language and the driver in
  round 15, the test commands in round 16, the delivery model in round 17, the task source in round
  20.
- A small checker, without AI, travels with the script and says whether each stage really passed and
  which is next (built: `flow-check`). It will replace `conduct-check.mjs` and `deliver-check.mjs` as the next-step
  oracle (about 2,300 lines that parse prose today); those two stay until round 24.
- Every stage file opens with a fixed header (built): the status (passed, failed, not applicable), the
  attempt, and the commit it was produced at. The checker reads only the header, never the prose.
- Stages after implementation unlock only when OpenSpec reports zero pending tasks (lines inside fenced
  examples of `tasks.md` are not tasks; see the ADR 0010 Note, flow-script-checker).
- A stage that does not apply (a mock-up with no screen, an ADR not needed, E2E with no structure)
  still leaves its file, saying so and why. (Amended by [ADR 0016](adr/0016-stage-roles-write-their-own-files.md):
  a stage whose declared condition does not hold, or that the change had already passed, leaves no
  file; the checker says why in the stage's line.)
- Stale work: when the code changed after a stage, the commit in its header no longer matches and
  only that stage runs again.
- Attempt ceilings, counted by the checker, move from skill prose to configuration: a plan rejected
  at readiness three times; two review rounds; three fixes of the same item; the same stage coming
  back twice with nothing changed stops.
- The loop ends in exactly one of four states, each with its reason: archived, waiting for the owner,
  waiting on GitHub, blocked.
  The change loop's `state` command gives each change's state, read by `/devkit status`, the session
  titles and the panels ([ADR 0017](adr/0017-a-change-state-is-derived-in-one-place.md)).

**The locks and how each is enforced (proposed).** "Exists" marks a lock that ships today (the two stop
locks and the coordinator's lock since round 15, and the `develop` lock since round 17); "new" marks
one to be built.

| Lock | In the Claude driver | In other drivers |
|---|---|---|
| Product code closed until the plan is approved | the edit is refused before it happens (exists) | the GitHub check refuses the pull request |
| One writer per gate file | the edit is refused by the writer's role (exists) | only where the driver can refuse |
| Destructive Git refused | the command is refused (exists) | the driver's own rule |
| The change coordinator does not stop while a stage is ready | refused when it tries to stop, with the next stage named (exists) | not needed: the loop is a program |
| A subagent does not stop without delivering | refused when it tries to stop and its stage file is missing (exists) | the program checks the file before going on |
| The change coordinator calls only the listed roles and edits no code | refused when it edits product code or hands work to a role the script does not list: the coordinator is the owner's session, held by a hook (ADR 0011) (exists) | the role's definition in the driver |
| The task branch never receives `develop` | the command is refused (exists) | a GitHub check on the pull request to `master` |
| Approval only from the owner's message | the file is writable only by the main session (exists; the weakest lock) | the driver's human-review step |

**What the hooks can do (checked on 2026-11-19 in the Claude Code hooks reference).** `Stop` and
`SubagentStop` hooks can refuse a stop with a reason, receive `stop_hook_active`, and hold at most
eight consecutive continuations. A `PreToolUse` hook on the `Agent` tool sees `subagent_type` and
`prompt`. Hook input carries `agent_type` inside a subagent and under `--agent`. No hook field marks a
prompt as typed by a person, which is why the approval lock stays the weakest.

**An example of the project configuration (proposed; field names not final, so open).** To be built
in rounds 15 to 20:

```yaml
devkit:
  driver: claude            # claude | compozy | script
  language: en              # the language of the project's files
  delivery:
    model: two-prs          # two-prs | trunk | trunk-auto
    base: master
    test_branch: develop
  tests:
    unit: "npm test"
    coverage:
      command: "npm run coverage"
      target: 80            # a whole number from 0 to 100
    e2e: "npm run e2e"      # without this line the E2E stage does not run
  tasks:
    source: jira
```

**The configuration's field names. Decided by `change-coordinator` on 2026-11-20 (A-8).**
`devkit.language` (the language of the project's files; default `en`) and `devkit.driver` (`claude`,
`compozy` or `script`; default `claude`) are final. Decided by `stage-roles` on
2026-11-21: `devkit.tests.unit`, `devkit.tests.coverage.command`, `devkit.tests.coverage.target`,
`devkit.tests.e2e`. Decided by `delivery-models` (round 17): `devkit.delivery.model` (`two-prs`, `trunk` or
`trunk-auto`), `devkit.delivery.base` and `devkit.delivery.test_branch`. The other fields stay proposed,
for round 20.

**The header's field names (decided by `flow-script-checker`).** The three facts are `result`, `attempt` and
`commit`, in one comment line at the top of each stage file:
`<!-- devkit-stage <stage> result=<result> attempt=<n> commit=<sha> -->`.

## 9. Language and documentation (D-9)

All decided by the owner.

- Two language settings in two places (built in round 15). The language of the project's files
  lives in the project's OpenSpec configuration and holds for everyone. The person's language lives in
  the plugin's own configuration, per person, and drives the conversation and the panels. The owner
  works in Portuguese on projects whose files are in English; other people may use the same project
  in English.
- All documentation is in English. The repository's English-only rule stays.
- The design is recorded inside the repository (this page) and the documentation is updated as the
  work is redone.
- Mock-ups are saved in the project, in the change's `mock/` folder, to be viewed or edited later.

## 10. The drivers (D-10)

All proposed. The three drivers are to be built in rounds 15, 21 and 22.

- **Claude (round 15).** The owner types `/devkit` in the session. For one task the session is the
  change coordinator and each stage is a subagent. For the roadmap the session is the roadmap coordinator. In the desktop app each change of the
  run has an app session of its own, started by the roadmap coordinator in the change's worktree
  and nested under it, which is that change's coordinator
  ([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)); where the host
  cannot start sessions, the session is also the coordinator of every open change. Either way
  each stage runs as a subagent in the
  background ([ADR 0013](adr/0013-the-roadmap-coordinator-is-the-owners-session.md)). When a change
  needs the owner, its coordinator asks it, one change at a time.
  **Waiting on GitHub. Decided by the owner on 2026-11-20 (round 15 grill, question 1): wait with no
  time limit and go on alone.** Built as a background command of the session that ends when GitHub
  answers; the session is called back, runs the loop again and goes on. The command holds no state.
- **CompozyOS (round 21).** One short, generic loop (ask, run the role, check) in place of the
  619-line flow written apart. `/devkit` starts the run. The kit's planning role is renamed from
  `tech-lead` to `planner` (section 2). Not verified: whether CompozyOS can choose the role at each
  turn (open).
- **Script (round 22).** A small program running the same loop and calling the AI from the command
  line. Documented for Claude (`claude -p`); not verified for any other AI (open). Built when the
  owner needs it.

## 11. Build order (D-11)

Approved by the owner with the plan (decided). The steps are small changes, each proved live on the
next one. Until step 3 is ready they are driven by the `ship-change` skill in one session, which is
the part of today's conduction that does not depend on child sessions. Between round 15 and round 18
changes run one at a time.

| Step | What | Round | Change id | `after:` |
|---|---|---|---|---|
| 1 | Record the design in the repository | none (recorded) | `orchestrator-replan` | none |
| 2 | The script and the checker: the schema with every stage, the fixed header, the checker; roles in place of Claude tool names | 14 | `flow-script-checker` | none |
| 3 | The change coordinator and `/devkit change`: the loop, the new locks, skills wired into the agents, the language settings; retires `/conduct` | 15 | `change-coordinator` | `flow-script-checker` |
| 4 | The new roles: ADRs, the unit-test suite, E2E, mock-up, the demonstration as text | 16 | `stage-roles` | `change-coordinator` |
| 5 | The delivery models: two pull requests from the same branch and the `develop` lock | 17 | `delivery-models` | `change-coordinator` |
| 6 | The roadmap coordinator and `/devkit roadmap` | 18 | `roadmap-coordinator` | `change-coordinator` |
| 7 | The four phases and `/devkit project` | 19 | `project-phases` | `roadmap-coordinator` |
| 8 | The Jira entry | 20 | `jira-entry` | `change-coordinator` |
| 9 | The CompozyOS driver, and the kit's planning role renamed `planner` | 21 | `compozy-driver` | `change-coordinator` |
| 10 | The script driver, for another AI, when the owner needs it | 22 | `script-driver` | `change-coordinator` |
| 11 | The panels: roadmap coordinator, change coordinator and help, read-only, from the approved mock | 23 | `coordination-panels` | `roadmap-coordinator` |
| 12 | The cleanup: the old scripts, the child-session code, the old panel, the final documentation | 24 | `coordination-cleanup` | `coordination-panels`, `compozy-driver` |

Step 1 has no round of its own in `openspec/roadmap.md`: listing it unticked would make it the
current round. Each `after:` is the real dependency of the step: round 15 asks round 14's checker;
rounds 16, 17, 20, 21 and 22 are stages, entries or drivers of round 15's loop; round 18 starts
round 15's coordinators; round 19 writes the roadmap round 18 reads; round 23 shows the state of
rounds 18 and 15; round 24 removes the old panel once round 23 replaces it and the old loop once
round 21 replaces it.

## 12. What the survey found (D-12)

Read on 2026-11-19: the 14 archived retros, the coordination scripts and the earlier
`chacal88/orchestrator` plugin. This is the context ADR 0010 gives in short form (decided as
findings).

- 13 of the 14 archived changes fixed the coordination machinery itself or its view; the conduct
  model changed three times in three releases.
- The gates work: the readiness review, the review bench with its three refuting verifiers, the
  proof per acceptance criterion and the automatic merge caught real defects and draw no complaint.
- Starting child sessions is what breaks: the app starts a session only on a turn the owner typed or
  on the unbroken chain that follows a child's end; each phase cost a retyped `/conduct`. In the
  earlier orchestrator plugin, six of its last seven fixes were workarounds for the same thing, and
  its last version replaced app sessions with subagents.
- The rules live in prose: the conducting skill is 157 lines the model is expected to follow, and
  nine retros record a rule that existed and that nothing enforced.
- The next step is guessed: the two checkers derive it by parsing prose, and six retros record a
  wrong step.
- What was solid in the earlier orchestrator: a declared flow and a coordinator that asks for the
  next step instead of deciding it. That part never needed a fix.

## 13. Still to prove live, and risks (D-13)

All proposed.

**To prove before trusting:**

- Many background subagent ends in a row over whole changes (not proved by round 19, whose phases run in the session; the first `/devkit roadmap` run that carries several changes to their ends records it).
- The two stop locks hold without looping (shown live by the live test of `change-coordinator`, with the
  hook log it records; the interrupt case rests on the documented fact that an interrupt fires no stop event).
- CompozyOS accepts the generic loop.
- Jira can be read on each platform.
- Grouped sessions work as a view.

The points still to prove are proved together, in one live test session, when their round comes
(decided by the owner on 2026-11-19: testing several things at once saves time).

**Risks and their mitigations:**

- OpenSpec's schema commands are experimental. Mitigation: pin the OpenSpec version per project.
- More stages cost more time per change. Mitigation: the short script (`devkit-lite`) serves the
  small change.
- Several change coordinators at once produce conflicts and stale reviews, seen in 7 of the 14
  archived changes. Mitigation: only changes that do not depend on each other run at once, the owner
  sets how many, and a stale stage runs again alone.

## Open points

Every item nobody has decided yet. The command names, the role names, holding a start while the
machine is loaded (and how the load is measured, answered by the change `roadmap-coordinator` on 2026-11-21, section 2), writing back to Jira, small work and the roadmap, and the lean pull-request
template were answered on 2026-11-19 and are recorded in their sections; the header's field names were answered by the change `flow-script-checker`; what to do when the task branch conflicts with `develop` was answered by the change `delivery-models` on 2026-11-21 (section 5); and four points were answered by the change `change-coordinator` on 2026-11-20: the ADR 0007 rules the change coordinator keeps, the configuration's field names, how it waits on GitHub and how the two roles called `tech-lead` are told apart (sections 2, 8 and 10).

- Whether the review stage keeps the Workflow path in the Claude driver (ADR 0008, ADR 0010).
- Whether CompozyOS can choose the role at each turn (section 10).
- The script driver for an AI other than Claude (section 10).
- Project setup (proposed; to be built in round 26): one setup step per project writes the `devkit:`
  block of `openspec/config.yaml` (driver, language of the files, delivery model, test commands, task
  source), installs the schemas and the checker under the project's `openspec/` and wires the chosen
  driver. It replaces what `openspec-setup` and `compozy-setup` do today.

## What stays shipped until its round

What was built under ADRs 0001, 0006, 0007, 0008 and 0009 stays shipped and documented as it is until
the round that replaces it:

| What exists today | Replaced or removed in |
|---|---|
| `ship-change` (drives the build order until step 3 is ready) | stays; the change coordinator takes over its loop in round 15 |
| `/conduct`, round mode included | retired in round 15 (`change-coordinator`) |
| `conduct-check.mjs` | round 24 (cleanup), after the checker `flow-check` |
| `deliver-check.mjs` as the next-step oracle | round 24 (cleanup), after the checker `flow-check` |
| The child-session rules and code (ADR 0006) | round 24 (cleanup) |
| The review Workflow script (ADR 0008) | stays; whether it stays is open |
| `devkit-panel`, the current panel | round 24 (cleanup), after round 23's panels |
| The CompozyOS twelve-stage loop (ADR 0009) | round 21 (CompozyOS driver) replaces it; round 24 removes the old loop |

## Where a change runs (proposed)

Proposed, not built; requested by the owner on 2026-11-20. It is planned as round 28 (`remote-worker`,
after `roadmap-coordinator`) and changes nothing today.

**Any machine.** A change can run on another machine. The project configures one command that starts
a change there and one that asks its state, and the roadmap coordinator chooses where each change
runs. The loop keeps no memory, so where its session runs does not matter.

**State by asking.** State is read by asking `flow-check --json` over the connection, never by
reading the other machine's screen.

**The owner's gates.** No session types the owner's gates on the owner's behalf. Either the owner
answers in the remote session, or planning and approval happen locally and only the part after the
approval runs remotely. The second way needs the approved plan pushed to the branch first, which the
flow does not do today.

**What the worker needs.** The same devkit plugin version, the same OpenSpec CLI and a restricted
GitHub credential.

**Load.** It also answers the open point of how the roadmap coordinator holds a start while the
machine is loaded: it can send the start to another machine.

## Withdrawn roadmap items

The owner withdrew six unticked lines of the old model from `openspec/roadmap.md` (decided: `Tirar as antigas`,
"take out the old ones"). Each came from a retro of the model ADR 0010 replaces:

- `commit-and-pr-trailer` and `conventions-trailer` (round 5).
- `review-writer-prompt` (round 11); it returned as round 25 (see below).
- `ac-clause-coverage`, `compozy-loop-v2-dogfood` and `release-pin-in-release-files` (round 13).

Five lines stay withdrawn. `review-writer-prompt` returned as round 25 (review round tooling): the
defect it names was hit in both review rounds of `orchestrator-replan`, and the review stage stays in
the new flow.
