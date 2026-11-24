# ADR 0024: CompozyOS runs the short loop of the checker, one agent per role

- Status: proposed
- Date: 2026-11-23
- Change: compozy-driver
- Amends: ADR 0009 (0009-compozy-loop-as-a-second-driver.md), the first and third bullets of its Decision and the first clause of its review trigger; ADR 0008 (0008-reviews-as-a-workflow.md), decision 5, a third path for the round's three stages on the CompozyOS driver only; ADR 0016 (0016-stage-roles-write-their-own-files.md), decision 3's last sentence ("In the CompozyOS kit the implementer sets them before its first phase, after the operator's approval.")

## Context

ADR 0010 decision 4 says the driver is chosen per project and that the same script and the same
roles run under either. The Claude driver does: `change-loop.mjs` is the checker that names each
step, and every gate is a script (`flow-check`, `conduct-check`, `deliver-check`). The CompozyOS
driver of ADR 0009 does not: the kit's twelve-stage loop and its four role shells keep a second copy
of the stage order, with role names (`tech-lead`, `dev`, `qa`, `design`) that no Claude agent has, and
since round 16 the shells also carry the new stage roles (the ADR author, the screen designer, the
test runner, the E2E tester) in prose. Two orders to keep equal is what ADR 0010 set out to end.

The owner decided, in the grill of `compozy-driver` (2026-11-22), that CompozyOS runs one short
generic loop that asks the checker each turn; that each role with a Claude agent file gets one
CompozyOS agent named as the role and generated from it, with no translation table; that the
`change-coordinator` and the planner (named `change-planner`, over the `planner` of ADR 0010's
2026-11-19 Note) are agents of the kit; that `/devkit` starts the run; and that a roadmap run on
CompozyOS starts change runs by itself, never an app session.

CompozyOS 0.6.2 was probed on 2026-11-23 (`proof/probes.md` of the change), and a live local run
(`proof/local-run.md`) then found three of its rules that the plan did not know. They are listed in
the Consequences, since the kit has to obey them.

## Decision

1. On CompozyOS a change runs as one short generic loop: each turn asks `change-loop.mjs`, the
   checker the Claude driver asks, runs the agent it names, and has every gate decided by the same
   scripts (`change-loop.mjs` reading `flow-check` and, through `conduct-check`, `deliver-check`);
   the twelve-stage loop and its four shells leave.
2. One CompozyOS agent per role that has a Claude agent file, named as the role, generated from it,
   checked in CI; each hands its stage to the Claude agent, so the hooks judge both drivers alike.
3. `/devkit` starts the run; the roadmap run starts change runs on its own, never an app session,
   and merges nothing: the ship mode decides as before (ADR 0002).
4. The owner's gates (the grill, the mock-up approval, the plan approval, the retro answers) are
   CompozyOS human requests; their answers are recorded by scripts, and no tool of a CompozyOS
   session writes `approval.md`. The session steps that run a command the checker built (accepting
   the plan's decision records after the recorded approval, switching the script, taking a place of
   the machine) are run by the loop itself, with no agent: the CompozyOS acceptance of the records is
   the `accept-decisions` step the loop runs with `run_step` right after `record-approval`. This
   replaces ADR 0016 decision 3's CompozyOS sentence, and the rest of ADR 0016 is unchanged.
5. The review round's three stages run as parallel CompozyOS sessions over `review-round.mjs`, with
   the same rules.
6. The run's state is bookkeeping: each turn re-reads the files, a killed run restarts from them.

## Consequences

- Positive: one stage order and one checker for both drivers; a role is added once, in its Claude
  agent file, and the CompozyOS agent follows by the generator and the CI check; the hooks judge a
  CompozyOS seat as they judge a Claude session; a project on the old kit reinstalls over it and
  keeps what it edited.
- Negative, accepted: the seat's work reaches the stage only through its hand-off to the Claude
  agent, so a seat that skips the hand-off and does the stage itself leaves the stage undelivered
  and the checker's K2 guard blocks it (Accepted: the hooks refuse its gate files and product code).
  The approval lock on CompozyOS rests on `COMPOZY_SESSION_ID` reaching the seat's Bash env (probe
  P-1; `plugins/openspec/hooks/guard.mjs:594` and `:601`), which CompozyOS may stop providing. The
  run record is bookkeeping: a killed run restarts from the files (decision 6).
- The CompozyOS driver does not carry these features of the Claude driver. They are accepted limits,
  each named with the line that shows it at the commit of this record; a later change may carry one
  over.
  - The token budget: `nextAction` counts the session's spend only with `budget: true`
    (`plugins/openspec/hooks/change-loop.mjs:1167`, `:1177`), and only `next` passes it (`:2667`);
    `compozyState` calls it without (`:2449`), so a CompozyOS run is never held at the cap.
  - The Jira entry and write-back: `open --task` (`change-loop.mjs:2756`, `openChange` at `:1840`)
    and `write-back` (`:2864`) are not reachable from `compozy-start` (`:2698`) or from the loops; a
    CompozyOS change is opened from its request, and no write-back question is asked.
  - The `state` subcommand (`change-loop.mjs:2861`, `runState` at `:2671`) reports the Claude
    driver's runs; it reads no CompozyOS run.
  - `testBranchViolation` (`plugins/openspec/hooks/guard.mjs:725`, called at `:1001`) judges a Bash
    command by the session root the hook finds; nothing here adds to it for a CompozyOS seat (no use
    of `compozySession`, `guard.mjs:594`, in that rule) and it is not proved to apply there: the rule
    "the task branch never receives the test branch" is held on that path by the briefs and the
    checker's rows.
  - The run markers: the typed-command lock reads `devkit-run:` and `devkit-end:` lines in the
    transcript (`guard.mjs:771`); `compozy-start` prints none, so a Claude Code session that started
    a CompozyOS run holds no run lock, and the end line is never written for a CompozyOS run.
  - The `no-place` end and the wake-up: the end a change makes when its machine has no free place
    (`change-loop.mjs:1099`) is shown in a CompozyOS view as the blocked kind, and nothing wakes the
    waiting change when a place is freed; the `wake` action belongs to the Claude driver's roadmap
    run (`plugins/openspec/hooks/roadmap-loop.mjs:413`).
  - Remote machines: the CompozyOS roadmap commands (`compozy-start`, `compozy-tick`,
    `compozy-state`, `roadmap-loop.mjs:1070`, `:1095`, `:1119`) read no `machines` setting and never
    call `checkout` (`roadmap-loop.mjs:263`, `:987`), so a CompozyOS roadmap run places every change
    on its own machine.
  - The `flow` subcommand (`change-loop.mjs:2871`, `runFlow` at `:2818`) and the `flow-newer`
    notice (`:1626`, in the reply of `start`): a CompozyOS view has no field for the notice, so a
    change that follows an older flow is moved to the installed one only by the owner's `flow` call
    in a Claude session.
  - The `open` step now commits the change folder and pushes the branch when the project has an
    `origin` (`change-loop.mjs:1932`, `claimOnOrigin` at `:1961`). A CompozyOS run pushes the change
    branch at open, and the push may be refused as `claimed` when another machine holds the id
    (`:1779`).
- Three rules of CompozyOS 0.6.2, found by the live proof, that the kit obeys:
  - An agent description is at most 280 characters (`compozy agent list` refuses a longer one). The
    Claude sources hold 274 to 508, so the generator shortens the description to whole sentences that
    fit, and the body stays the exact source text.
  - An `ask` node must have exactly one predecessor: with several, CompozyOS opens its request as
    soon as a gate turn reads, though the route did not reach it, and the run stalls. The loops hold
    one `ask` per source, and a structural test pins the rule for every ask of every shipped loop.
  - The record steps read the checker's view without the earlier handed key: a step that reads the
    state with the handed key of the step about to run meets the checker's no-progress guard (K1) and
    answers `blocked`. Only `next --view compozy` and `confirm` keep the key.

### Review trigger

CompozyOS drops `params.agent` templating or the `provider: claude` seat, so a role's agent can no
longer be named by the loop; the hooks stop seeing the seat's subagent (a CompozyOS session reaches
product code, a gate file or `approval.md` without the hooks judging it); a gate on the CompozyOS
path decides readiness outside the scripts; or one of the accepted limits above is asked for by an
owner.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the twelve-stage loop with the renamed roles | Two stage orders to keep equal; the checker already owns the order (ADR 0010 decision 3) |
| A translation table from roles to the four shells | The owner chose one agent per role, named as the role, with no table |
| The seat does the stage itself and the hooks trust `COMPOZY_AGENT` | A lock relaxed on an environment variable; product code and gate files would rest on it; the seat keeps the hooks exactly as on the Claude driver |
| The loop reads the checker through `compozy__terminal_exec` and templates | Templates have no JSON parsing and `params.agent` needs a string; the agent read plus a deterministic `confirm` gives typed fields that cannot be wrong when a stage runs |
| CompozyOS's `general` agent for the read | Its provider and permissions are the user's defaults, not the kit's; a `Bash` call may wait for an approval |
| `change-coordinator` played by the loop alone, no agent | The grill, the retro and the delivery steps need an AI with the devkit's skills and hooks; an agent with no Claude source would break the one-agent-per-role rule |
| The review round in one seat through the skill's `agents` path | Reviewers would share one CompozyOS session; the round asks for a session each |
| The roadmap as one long CompozyOS session | A session that remembers is what ADR 0010 decision 3 rejects |
| `accept-decisions` and `switch-script` carried by the `change-coordinator` agent, which runs `detail.command` | An AI would run a deterministic command, and a refusal would come back as the agent's `failure`, which the next turn can only report as "no progress", losing the command's own reason (`cannot-accept` naming the file); the `run_step` gate runs it with no AI and keeps the reason for the owner's question |
| The mock-up approval as a free `owner` request that records nothing | The run would wait forever: the checker moves on only when `mockup.md`'s header is passed or failed, which the session writes on the Claude driver |
| A record step that also writes the mock-up's facts into `requirements.md` | Choosing which facts the mock-up settled is a judgement; the script records the owner's answer and the `change-coordinator` agent writes the facts, as the approval notes go to `change-planner` |
| An ADR-free change | It changes ADR 0009's gates and review trigger, ADR 0008 decision 5 and ADR 0016 decision 3's CompozyOS sentence (config rule) |
