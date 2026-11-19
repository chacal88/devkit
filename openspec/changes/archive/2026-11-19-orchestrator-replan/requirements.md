# Requirements

Change: `orchestrator-replan` · Date: 2026-11-19 · Owner: Kaue (chacal88)

Grill: held on 2026-11-19 in the owner's own session, across one planning conversation. The owner
stated each requirement in their own words and answered every open question as it came up; the two
questions that collide with recorded decisions were asked last, one at a time (Questions asked, 15
and 16). The design below was drawn for the owner as a page and approved before this change was
opened ("Sim, registrar").

Classification: domain=process type=feature flags=[architecture] (confirmed: the change supersedes
two ADRs and ships documents only; no agent, skill, hook or schema changes behaviour in it).

This change is the first step of the build order the owner approved: **record the design in the
repository**. It builds none of the design.

## Request

(The owner's words, translated from Portuguese.)

> Our plugin is not working. I want to replan it. I want to keep the skills we defined, the
> agents, but the whole coordination, conduction part is not working. I need something that works.
> The Orchestrator project worked well, but we tied it to those Claude modules and it did not turn
> out well. So I want to rethink it and see a way to organize the DevKit so it works well. I want
> an orchestrator agent that keeps following the roadmap and knows how to identify which changes
> it must start. That start is done through OpenSpec, as usual, like the whole flow we have been
> doing. Inside it I want subagents for each stage: planning, implementation, tests, code review,
> everything that makes up development from the specification and the grill to the delivery. So
> first I want to draw a flowchart or something like it, for us to plan first. In that flowchart I
> want the agents, the subagents and the skills of each subagent. And the idea is that the
> coordinator does everything needed so the other agents do not stop their work. Let's start by
> analysing what the DevKit has today, what is missing and how we will do it. Then we plan what
> the harness of all this will be. I want a harness so it does not leave the script and things
> work well.

Later in the same conversation, on keeping the result:

> Another detail is to keep this planning of ours, this design, well. I do not know whether we
> will keep that artifact, but inside the repository the current documentation has to be updated;
> everything will be redone or not, right? But we need good documentation.

And, asked whether the plan was approved so the design could be recorded in the repository:
"Sim, registrar" ("Yes, record it").

## The design agreed with the owner

This section is the input the plan and the design document are written from. Each item says who
decided it. "Owner" means the owner said it; "proposed" means it was proposed to the owner, shown
on the page and not objected to; "open" means nobody decided it yet.

### D-1. How the owner uses it (owner: the need; proposed: the commands)

The owner has had "muita dificuldade" using the current tools: `/conduct` accepts only a change id,
with nowhere to say what is wanted, and a CompozyOS run starts from another command outside the
session. The owner wants to open a session, type one simple command with the content, and have it
run, including when the project runs on CompozyOS. Ease of use is a first-class requirement.

Proposed, with example names that are not confirmed: one `/devkit` command with few verbs.

| Example | What it does |
|---|---|
| `/devkit change PROJ-482` | one task, read from Jira by its key or link |
| `/devkit change <free text>` | one task, described in text |
| `/devkit roadmap` | the whole roadmap, one change at a time |
| `/devkit roadmap 3` | the whole roadmap, up to three changes at once |
| `/devkit project <name>` | deeper planning of a new project or slice, in the four phases |
| `/devkit status` | where everything is and what waits on the owner |
| `/devkit help` | opens the help panel |

Rules behind them: the same command in every project (the driver comes from the project's
configuration, and the command starts a CompozyOS run for the owner when that is the driver); the
request travels with the command; a Jira task becomes the request, and the grill asks only what
the task does not answer; calling the command again resumes where it stopped; every reply says
what happened and what comes next, without internal terms. Whether devkit writes back to Jira is
open (assumed read-only).

### D-2. Two coordinators and three entries (owner)

- A **roadmap orchestrator** (proposed name: `manager`) reads `openspec/roadmap.md`, sees what is
  ready to start and what waits on another change, and starts the next changes on its own,
  without asking first. It may have several change coordinators running at once, one per change,
  only among changes that do not depend on each other. How many is not a project setting: the
  owner chooses it per run and can change it mid-run, because it depends on the task, on the
  machine at that moment and on the other projects running. Lowering it never interrupts a change
  under way. Proposed and open: hold the start of a change while the machine is loaded.
- A **change coordinator** (proposed name: `tech lead`) takes one change from its opening to its
  archive. It asks OpenSpec which stage comes next, hands that stage to its subagent, checks the
  gate and asks again. It writes no code and does not decide the order. It replaces the `/conduct`
  skill.
- Three entries: define a project (D-7), call the manager for the whole roadmap, or call the tech
  lead directly for one task.
- Names are open: the owner suggested team-like names and said naming is not important. The
  CompozyOS kit already uses `tech-lead` for its planner role, so one of the two is renamed.

### D-3. What the orchestrator is (proposed, on the owner's failure report)

The owner's past failure: "the session stopped following; the sub-session finished and did not
notify, so the communication was lost." The orchestrator is therefore a command the owner starts
and a loop behind it, never a session that has to remember where it is. Each turn of the loop
reads the files, runs the stage that is ready and checks its gate. A lost notification or a dead
session costs nothing: the next turn reads the files again.

Three layers, so the same flow serves several projects and platforms (owner: "it has to work
wherever we are running", with Codex as the example):

- **Script**: the OpenSpec schema and configuration (stages, order, the role of each stage, gates,
  the delivery model). The same on every platform.
- **Roles**: the manager, the tech lead and the stage agents with their skills, as plain text.
  Each platform receives the same roles in its own format.
- **Driver**: who runs the loop, chosen per project: a Claude session, CompozyOS, or a script that
  calls another AI from the command line. CompozyOS is not frozen; it becomes one of the drivers
  (owner).

Rule that follows: the script names roles, never one platform's tool. Today the `devkit` schema
names Claude's Agent tool and `devkit-core:*` subagent types.

Sub-sessions: each stage is a subagent of the tech lead (decided by the assistant, because the
owner asked only for "something that works"). The owner likes a parent session with grouped child
sessions; that stays as an optional way to watch the work in the Claude driver if a live test
shows it holds. The flow never depends on it.

### D-4. The stages of one change (owner: the stages; proposed: the agents and gates)

`new` marks what does not exist today.

| # | Stage | Who and skills | Produces | Gate |
|---|---|---|---|---|
| 0 | Choose the next change (manager entry only) | manager (new) | the start request | its `after:` dependencies are archived |
| 1 | Open the change | tech lead (new) | `openspec new change`, worktree and branch named after the change, cut from the base the delivery model names | schema confirmed |
| 2 | Requirements (grill) | tech lead with the owner; `requirements-grill`; `codebase-researcher` | `requirements.md` | the owner answered |
| 3 | Mock-up, only when the change alters a screen, before any plan | `screen-designer` (new), skill `screen-mockup` (new), `screen-design` | the screens drawn with real example data, saved in the change's `mock/` | the owner approves; what the mock reveals goes back into the requirements |
| 4 | Decisions and ADRs | `adr-author` (new), skill `adr-authoring` (new) | proposed ADRs in the project's ADR folder, when the change needs them | the agent first analyses whether an ADR is needed; if not, it leaves one line saying so |
| 5 | Plan | `change-planner`, `openspec-validator` | proposal, specs, design, tasks | `openspec validate --strict` |
| 6 | Plan readiness | `plan-readiness-reviewer`, `plan-reality-auditor`, `adr-reviewer`; `plan-readiness-review` | `readiness.md` | approved; a rejection returns to the plan, three times at most |
| 7 | The owner's approval | the owner | `approval.md`, of the plan and the ADRs together | it came from the owner's own message |
| 8 | Implementation, one subagent per phase | `tdd-implementer`; `test-driven-development`, `systematic-debugging` | code, tests, ticked tasks | the phase's test command is green |
| 9 | Unit tests | `test-runner` (new); `test-and-coverage`, `systematic-debugging` | the whole suite and its coverage | suite green, coverage within the project's target |
| 10 | E2E tests, only where the project has E2E configured | `e2e-tester` (new), skill `e2e-testing` (new) | E2E tests written from the acceptance criteria, apart from the implementer, and their result | green; it is a delivery condition |
| 11 | Demonstration | `pr-verifier` | `evidence.md`, as text, inside the change: per acceptance criterion, what the agent did, what it observed and whether it passed | every criterion demonstrated and recorded |
| 12 | Code review | the six reviewers, `finding-verifier` x3; `review-change` | `reviews/*.md`, `review.md` | consensus; two rounds at most |
| 13 | Delivery | `commit-and-pr`; `commit-message-guidelines` | commit, push, the pull request to the base of the delivery model | GitHub checks green and the merge the model defines |
| 14 | Second pull request, two-PR model only (new) | `commit-and-pr` | the pull request from the same branch to `master` | the first one was approved on `develop`; checks green; merged |
| 15 | Retro and archive | tech lead with the owner; `retro` | `retro.md`, `openspec archive`, the roadmap line ticked | the owner answered each proposal |

Owner decisions inside this table:

- **Mock-up** (stage 3): "whenever a change alters a screen, before anything else, before
  planning". Today no agent draws one: `screen-design` only records screen-map rows that point at
  a mock made elsewhere, runs after the plan, and ships only in the CompozyOS pack.
- **ADRs** (stage 4): every feature has an agent responsible for analysing what will be done and
  defining the ADRs; it analyses first, writes when needed, does not when not.
- **Tests** (stages 8 to 10): strong focus on tests, a specialist for each kind. The owner accepts
  that the implementer's TDD covers unit tests; E2E matters "even for the delivery". A project
  without E2E structure does not run stage 10; adding E2E tests as new tasks are done is each
  project's choice. Decided by the assistant: no second author of unit tests.
- **Demonstration** (stage 11): the agent, not the owner, demonstrates what was delivered and
  records it as text inside the change, which is archived afterwards. No screenshots and no videos
  are kept. The pull request is not the place for that record. Where a project accepts automatic
  merge, the agent's validation is the validation and the merge goes on without the owner.
- A lean pull-request template "with less text" is an idea of the owner's for later. Today
  `deliver-check` requires the PR body to name the change, every acceptance criterion and the
  evidence path.

### D-5. Delivery models (owner)

Chosen per project, in configuration.

- **Two pull requests from the same branch** (how one of the owner's projects works; new in devkit): every
  task branch is cut from `master`/`main`; a first pull request goes to `develop`, for testing;
  once approved, a second pull request from the same task branch goes to `master`. `develop` never
  goes to `master`, so the task branch never receives `develop` either, not even to solve a
  conflict. What to do when the task branch conflicts with `develop` is open.
- **Trunk-based**: a short branch, a pull request to the main branch, the owner merges.
- **Trunk-based with automatic merge**: the same, GitHub merges when the gates are green.

devkit knows only the last two today.

### D-6. Panels (owner; mock approved)

Read-only panels to follow the work; the owner does not want to start anything from a panel. One
for the manager, one for the tech lead (the change, the stage it is in, the subagents), and a
small help panel showing how to use the project and its commands. The mock was drawn as a Claude
Design canvas with five screens (manager, tech lead, the detail of one stage, the band above the
prompt box, help) and approved on 2026-11-19 ("Ficou perfeito"). No button starts, sends or
changes anything; the only presses open a detail or a document, or refresh. The panels' language
comes from the plugin's own configuration, per person.

### D-7. Defining a project: the four phases (owner)

A flow for the four phases the owner usually runs (the `devkit-design` skills: business, domain
model, architecture with ADRs, implementation plan), from which the roadmap comes out for the
manager to orchestrate. It serves any project, new or ongoing, whenever the owner judges that a
new slice deserves deeper planning before starting, including as research on how to do it. What
already exists in a project does not go through it. Today the five skills exist, each only points
at the next, and phase 4 ends in a change backlog inside `docs/design/4-implementation-plan.md`,
not in `openspec/roadmap.md`. Proposed: declare the phases as an OpenSpec flow and add a fifth
stage that writes the roadmap (appending to an existing one). The phases are conversations with
the owner, so they run in the owner's session.

How a small one-off feature enters an existing roadmap is open.

### D-8. The harness (owner: OpenSpec is the harness; proposed: how)

The owner: "we will use OpenSpec as the harness: through OpenSpec's configuration it runs this
approach of sub-sessions and subagents; if the two orchestrators have to stay outside OpenSpec,
fine. The idea is to centralise on OpenSpec so it is more compatible with other projects and other
people, without depending so much on our library."

Tested on 2026-11-19 against OpenSpec 2.0.0 with a throwaway schema:

- It accepts every stage as an artifact, the ones after implementation included; `openspec status
  --json` answers ready, blocked or done per stage; `openspec instructions <stage> --json` returns
  the stage's instruction text together with the project's `context` and `rules`; `openspec
  instructions apply --json` reports task progress; a custom top-level block in
  `openspec/config.yaml` is tolerated by `status` and `validate`.
- It does not cover: a file that exists counts as a stage done (a `readiness.md` saying
  NEEDS-REVISION unlocked the next stage); stages after implementation became ready with zero
  tasks done; it knows nothing of pull requests, checks or the owner's approval; it has no
  retries, attempt limits or way back to an earlier stage; extra keys on an artifact (`agent`,
  `skills`) pass validation and are dropped from the output.
- OpenSpec prints that its `schema` commands are experimental and may change.

Proposed harness:

- Everything that defines the flow lives under the project's `openspec/`: `config.yaml` (language
  of the files, driver, delivery model, test commands, task source), `roadmap.md`, and the schemas
  `devkit` (one change), `devkit-lite` (a small change) and `devkit-project` (the four phases).
- A small checker, without AI, travels with the script and says whether each stage really passed
  and which is next. It replaces `conduct-check.mjs` and `deliver-check.mjs` as the next-step
  oracle (about 2,300 lines that parse prose today).
- Every stage file opens with a fixed header: the status (passed, failed, not applicable), the
  attempt, and the commit it was produced at. The checker reads only the header, never the prose.
- Stages after implementation unlock only when OpenSpec reports zero pending tasks.
- A stage that does not apply (a mock-up with no screen, an ADR not needed, E2E with no structure)
  still leaves its file, saying so and why.
- Stale work: when the code changed after a stage, the commit in its header no longer matches and
  only that stage runs again.
- Attempt ceilings, counted by the checker, moved from skill prose to configuration: a plan
  rejected at readiness three times; two review rounds; three fixes of the same item; the same
  stage coming back twice with nothing changed stops.
- The loop ends in exactly one of four states, each with its reason: archived, waiting for the
  owner, waiting on GitHub, blocked.

Locks, and how each is enforced:

| Lock | In the Claude driver | In other drivers |
|---|---|---|
| Product code closed until the plan is approved | the edit is refused before it happens (exists) | the GitHub check refuses the pull request |
| One writer per gate file | the edit is refused by the writer's role (exists) | only where the driver can refuse |
| Destructive Git refused | the command is refused (exists) | the driver's own rule |
| The tech lead does not stop while a stage is ready | refused when it tries to stop, with the next stage named (new) | not needed: the loop is a program |
| A subagent does not stop without delivering | refused when it tries to stop and its stage file is missing (new) | the program checks the file before going on |
| The tech lead calls only the listed roles and edits no code | from the role's definition: it has no edit tool (new) | the role's definition in the driver |
| The task branch never receives `develop` | the command is refused (new) | a GitHub check on the pull request to `master` |
| Approval only from the owner's message | the file is writable only by the main session (exists; the weakest lock) | the driver's human-review step |

Checked on 2026-11-19 in the Claude Code hooks reference: `Stop` and `SubagentStop` hooks can
refuse a stop with a reason, receive `stop_hook_active`, and hold at most eight consecutive
continuations; a `PreToolUse` hook on the `Agent` tool sees `subagent_type` and `prompt`; hook
input carries `agent_type` inside a subagent and under `--agent`; no hook field marks a prompt as
typed by a person, which is why the approval lock stays the weakest.

An example of the project configuration (field names not final):

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
    e2e: "npm run e2e"      # without this line the E2E stage does not run
  tasks:
    source: jira
```

### D-9. Language and documentation (owner)

- Two language settings in two places. The language of the project's files lives in the project's
  OpenSpec configuration and holds for everyone. The person's language lives in the plugin's own
  configuration, per person, and drives the conversation and the panels. The owner works in
  Portuguese on projects whose files are in English; other people may use the same project in
  English.
- All documentation in English. The repository's English-only rule stays.
- The design is recorded inside the repository and the documentation is updated as the work is
  redone.
- Mock-ups are saved in the project, in the change's `mock/` folder, to be viewed or edited later.

### D-10. The drivers (proposed)

- **Claude**: the owner types `/devkit` in the session. For one task the session is the tech lead
  and each stage is a subagent. For the roadmap the session is the manager and each change has its
  tech lead as a subagent, which in turn calls the stage subagents (Claude Code documents nesting
  three levels below the main conversation). When a change needs the owner, the question goes up
  and the manager asks it in the session.
- **CompozyOS**: one short, generic loop (ask, run the role, check) in place of the 619-line flow
  written apart. `/devkit` starts the run. Not verified: whether CompozyOS can choose the role at
  each turn.
- **Script**: a small program running the same loop and calling the AI from the command line.
  Documented for Claude (`claude -p`); not verified for any other AI.

### D-11. Build order (approved by the owner with the plan)

Small changes, each proved live on the next one. Until the third is ready they are driven by the
`ship-change` skill in one session, which is the part of today's conduction that does not depend
on child sessions.

1. Record the design in the repository (this change).
2. The script and the checker: the schema with every stage, the fixed header, the checker; roles
   in place of Claude tool names.
3. The tech lead and `/devkit change`: the loop, the new locks, skills wired into the agents, the
   language settings. Retires `/conduct`.
4. The new roles: ADRs, the unit-test suite, E2E, mock-up, the demonstration as text.
5. The delivery models: two pull requests from the same branch and the `develop` lock.
6. The manager and `/devkit roadmap`.
7. The four phases and `/devkit project`.
8. The Jira entry.
9. The CompozyOS driver.
10. The script driver, for another AI, when the owner needs it.
11. The panels: manager, tech lead and help, read-only, from the approved mock.
12. The cleanup: the old scripts, the child-session code, the old panel, the final documentation.

### D-12. What the survey found (context for the ADR)

Read on 2026-11-19: the 14 archived retros, the coordination scripts and the earlier
`chacal88/orchestrator` plugin.

- 13 of the 14 archived changes fixed the coordination machinery itself or its view; the conduct
  model changed three times in three releases.
- The gates work: the readiness review, the review bench with its three refuting verifiers, the
  proof per acceptance criterion and the automatic merge caught real defects and draw no
  complaint.
- Starting child sessions is what breaks: the app starts a session only on a turn the owner typed
  or on the unbroken chain that follows a child's end; each phase cost a retyped `/conduct`. In
  the earlier orchestrator plugin, six of its last seven fixes were workarounds for the same
  thing, and its last version replaced app sessions with subagents.
- The rules live in prose: the conducting skill is 157 lines the model is expected to follow, and
  nine retros record a rule that existed and that nothing enforced.
- The next step is guessed: the two checkers derive it by parsing prose, and six retros record a
  wrong step.
- What was solid in the earlier orchestrator: a declared flow and a coordinator that asks for the
  next step instead of deciding it. That part never needed a fix.

### D-13. Still to prove live, and risks (proposed)

To prove before trusting: a subagent inside a subagent reports its end, many times in a row (the
owner's past failure); the two stop locks hold without looping; CompozyOS accepts the generic
loop; Jira can be read on each platform; grouped sessions work as a view.

Risks: OpenSpec's schema commands are experimental (pin the OpenSpec version per project); more
stages cost more time per change (the short script serves the small change); several tech leads
at once produce conflicts and stale reviews (seen in 7 of the 14 archived changes).

## Assumptions

- A-1. The decision is `docs/adr/0010-<slug>.md`, in the format the existing ADRs use (Status,
  Date, Change, Context, Decision, Consequences, Review trigger, Alternatives considered). It
  supersedes `docs/adr/0001-coordination-without-a-harness.md` and
  `docs/adr/0007-one-change-on-request.md` (owner, question 15). ADRs 0006, 0008 and 0009 are not
  superseded by this change: each gains a note that points at ADR 0010 and says what of it still
  holds until the change that removes it.
- A-2. The design document is one English Markdown file under `docs/`, written so that a reader
  who never saw the planning conversation can plan change 2 of D-11 from it. The planner picks the
  file name. It carries every decision of D-1 to D-13, each marked decided, proposed or open.
- A-3. `openspec/roadmap.md` after this change: the ticked lines stay as they are; the six
  unticked lines (`commit-and-pr-trailer`, `conventions-trailer`, `review-writer-prompt`,
  `ac-clause-coverage`, `compozy-loop-v2-dogfood`, `release-pin-in-release-files`) are removed
  (owner, question 16: "Tirar as antigas"); steps 2 to 12 of D-11 are added as rounds, each line a
  change id with its `after:` dependency and a one-line description, in the grammar the session
  hook reads today.
- A-4. Nothing that runs changes: no agent, skill, hook, checker or schema is edited, so
  `/conduct` and `ship-change` keep working exactly as today until their own round. There are
  two exceptions: AC-7, and test code in `plugins/openspec/hooks/guard.test.mjs`: the ADR 0007
  status assertion, because the suite pins that line, and the two tests the review of round 1
  asked for (the ADR 0010 supersession and the `rules:` entries of `openspec/config.yaml`).
- A-5. Truthfulness at the commit that ships: every sentence in `README.md`, `CLAUDE.md`,
  `CONTRIBUTING.md`, `docs/*.md`, the pack READMEs and `openspec/config.yaml` that states ADR 0001
  or ADR 0007 as the rule in force (for example README's "Why no harness" section and "Coordination
  is allowed; a harness is not") is rewritten to say that ADR 0010 replaced it and that the
  current machinery stays shipped until the round that removes it. The planner lists every file
  that repeats the claim.
- A-6. The proposed names `manager` and `tech lead` are used in the documents and marked as
  proposed; the clash with the CompozyOS kit's `tech-lead` role is recorded as open.
- A-7. The panel mock (five `.dc.html` files and `canvas.json`) and the planning page (one HTML
  file, in Portuguese, the owner's working copy) are kept in
  `openspec/changes/orchestrator-replan/mock/`, as the archived `panel-conduct-view` change keeps
  its mock. They are working files of the change, not documentation.
- A-8. The change follows the `devkit` schema and is delivered in the repository's own mode
  (`ship: devkit: merge`): a pull request that GitHub merges when the contract is met.
- A-9. Whether a pack version is bumped follows `CONTRIBUTING.md` (step 5 of "Adding or changing an asset"): a pack whose files change
  gets a bump and a CHANGELOG line; a change that touches no pack file bumps none.

## Acceptance criteria

Every criterion is proved in this change. The one thing only the next change can show, whether the
design document is enough to plan from, is named in AC-2 as a check the readiness reviewer of this
change makes on the plan, and is confirmed for real by change 2 of D-11.

- AC-1 `adr-0010-recorded` — `docs/adr/0010-<slug>.md` exists with `- Status: accepted` and states
  the decision of D-2, D-3 and D-8: OpenSpec is the harness; a manager drives the roadmap and a
  tech lead drives one change; the flow is a loop over files; the driver is chosen per project;
  the script names roles, not a platform's tool. Its Alternatives table carries the options this
  conversation rejected (app child sessions per stage, a session that remembers, a single-platform
  design). ADR 0001 and ADR 0007 read `superseded by ADR 0010`; ADRs 0006, 0008 and 0009 each
  carry the note of A-1.
- AC-2 `design-document-complete` — the design document of A-2 exists, is linked from the
  "Where the rules are" table of `CLAUDE.md` and from the Documentation list of `README.md`, and
  contains a section for each of D-1 to D-13 with every item marked decided, proposed or open. A
  reader finds in it, without any other source: the stage table of D-4 with the role, skills,
  product and gate of every stage; the three delivery models of D-5; the harness rules and the
  lock table of D-8; the build order of D-11; the list of open points.
- AC-3 `roadmap-rewritten` — `openspec/roadmap.md` holds no unticked line of the six ids of A-3,
  keeps every ticked line unchanged, and lists steps 2 to 12 of D-11 as rounds in the grammar
  `guard.mjs session` reads; a new session's start report shows the first new round as the
  current one.
- AC-4 `claims-true-at-the-commit` — no file of A-5 states ADR 0001 or ADR 0007 as the rule in
  force; each place that did now names ADR 0010 and says the current machinery stays until its
  round. `openspec/config.yaml`'s `context: ADRs:` line lists ADR 0010 and the two supersessions.
- AC-5 `mock-and-page-kept` — `openspec/changes/orchestrator-replan/mock/` holds the five panel
  screens, `canvas.json` and the planning page, and the design document names that folder as
  where the approved mock lives.
- AC-6 `gates-green` — `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
  `claude plugin validate .` and `node --test plugins/openspec/hooks/guard.test.mjs` pass at the
  delivered commit, and `git diff --stat origin/main...HEAD` shows no change under any
  `plugins/*/agents`, `plugins/*/skills` or `plugins/*/schemas` path, and under `plugins/*/hooks`
  only test code in `plugins/openspec/hooks/guard.test.mjs` (the ADR status assertions and the
  two tests the review of round 1 asked for). The delivered
  commit carries the `devkit-openspec` 0.14.2 release (marketplace 0.18.1, `CHANGELOG.md` entry, CI
  pin at `v0.14.2`).
- AC-7 `design-rules-load` — `openspec instructions design --change orchestrator-replan --json`
  prints no "ignoring this artifact's rules" warning and returns the three `rules.design` entries
  of `openspec/config.yaml`. Today OpenSpec 2.0.0 drops all three, because the third entry holds
  an unquoted `: ` that YAML reads as a mapping; found while opening this change.

## Out of scope

- Steps 2 to 12 of D-11: no schema, checker, agent, skill, hook, command, panel or driver is built
  or changed here.
- Removing `/conduct`, `conduct-check.mjs`, the child-session rules, the Workflow path of the
  reviews, the current panel or the CompozyOS loop.
- Renaming anything in the CompozyOS kit.
- Deciding the open points (the command names, the role names, the conflict with `develop`, the
  machine-load guard, writing back to Jira, how a one-off feature enters a roadmap, the lean
  pull-request template). The documents record them as open.
- A Portuguese copy of the documentation.

## Questions asked

1. [scope] What stays and what is redone? → Skills and agents stay; only coordination is redone.
2. [scope] One orchestrator or two? → Two: one for the roadmap, one that takes a task and
   coordinates it and creates the sub-sessions.
3. [project rules] Where does the flow live? → OpenSpec is the harness; the orchestrators may stay
   outside it.
4. [end effect] Sub-session: a subagent or an app session? → "I do not know which is best, but it
   has to be something that works. I like the grouping where a parent session creates
   sub-sessions. I like it, but it is not working."
5. [scope] Does the roadmap orchestrator start the next change alone or ask first? → Alone; "it is
   its role". For a single task the owner calls the coordinator directly.
6. [scope] Does the ADR stage run on a small change? → It analyses whether one is needed; if so it
   does it, if not it does not.
7. [scope] Is the CompozyOS loop frozen meanwhile? → No. The library is installed and configured
   per project; some run on Claude, some on CompozyOS, some on another AI platform.
8. [edges] How does the two-branch delivery work? → Work is cut from master; a PR goes to develop
   for testing; when approved, a PR from the same task branch goes to master; develop never goes
   to master.
9. [edges] May the manager run several tech leads? → Yes; how many varies with the task, with the
   machine at the moment and with the other projects running.
10. [scope] Does an existing project go through the four phases? → Not the project itself; any
    new slice of any project that deserves deeper planning does.
11. [end effect] Is the owner's validation of the demonstration required before an automatic
    merge? → No: where the project accepts automatic merge the validation is done, and it is
    automatic.
12. [end effect] Where is the proof kept, and are screenshots and videos kept? → As text, in the
    change, archived afterwards; no images, no videos; not attached to the PR.
13. [edges] What about a project with no E2E structure? → It does not run that stage; adding tests
    is each project's choice.
14. [scope] Documentation in Portuguese too? → All in English, no problem. And the panels'
    language comes from the plugin's configuration.
15. [project rules] ADR 0001 forbids a harness and ADR 0007 forbids conducting from the roadmap;
    does the new decision replace both? → "Sim, substitui."
16. [scope] The roadmap has six pending changes of the old model; what should the roadmap show
    after this change? → "Tirar as antigas."

## Escalations

None open. The two collisions with recorded decisions (ADR 0001, ADR 0007) were decided by the
owner in question 15.
