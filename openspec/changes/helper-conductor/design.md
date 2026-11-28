<!-- devkit-stage design result=passed attempt=5 commit=0c64ce1bf67c10215f0db9357142192c2b28fcdd -->
# Design

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md` at attempt 7 with its field facts 1 to 12 and AC-14 to AC-22, `decisions.md`, `release.md`,
the record `docs/adr/helper-conductor.md` with its 13 decisions, cited `ADR [helper-conductor]`, and the phase 1 proof:
`proof/p0-delete.md`, `proof/p1-hooks.md`, `proof/decision.md`, `proof/probe-2-prompt.md`). Base: `origin/main` at
`6f03a57`. This is the revision that phase 1's decision point asked for (`proof/decision.md`, "Stop and revise").

## Context

See `proposal.md` (Why) for the motivation. The code this design changes, at `6f03a57`:

- `plugins/openspec/hooks/roadmap-loop.mjs` (1972 lines): the roadmap decision core (`classifyLines`,
  `decideRoadmap`, `boardOf`), the verbs `run`, `next`, `status`, `draft`, `reply`, `wait`, `hold`,
  `checkout`, `push`, `merge-base`, `session-next`, `session-wait`, `check`, and the change-session
  parts: `sessionStartOf`/`remoteSessionStartOf` (about lines 259-286), `CHECK_CRON` and the
  `devkit-roadmap-check:` prompt (about 310-313), the ticket block of `decide` that sets
  `run.tickets[a.change]` (about 1389-1424), `mintTicket`, `withTicket`, `ticketLabel`,
  `entryDecision`, `ENTRY_REFUSALS` (about 1257-1311), `changeSessionStopDecision`,
  `sessionNextCmd`/`sessionWaitCmd` (about 1790-1870) and `checkCmd` (about 1871).
- `plugins/openspec/hooks/run-file.mjs`: `emptyRun`, `readRun`, `readUpfront` (the fields `tickets`,
  `occupied`, `queued`, `anyway`, `waits`, `cron`, `check`), `TICKET_FORM`.
- `plugins/openspec/hooks/guard.mjs`: `roadmapRunOf` (the run detection), `ENTRY_SKILL`,
  `namesEntrySkill`, `skillEntry` (about 1440-1462), `START_LINE`, and the `lock` dispatcher that
  calls `changeSessionStopDecision`; `hooks.json` routes `PreToolUse` `Skill` to `guard.mjs skill`.
- `plugins/openspec/skills/devkit/SKILL.md` `## Roadmap` (lines 263-331): the "A session per change"
  part, the "Every change in this session" part and "The periodic check".
- `plugins/openspec/skills/devkit-session/SKILL.md`: the entry skill of a change session.
- The message table of `plugins/openspec/hooks/change-loop.mjs` (`roadmap-session-*`,
  `roadmap-waits-turn*`, `roadmap-check-*`, `session-held-*`, `roadmap-woken`, `roadmap-waits-refused`
  keys, in `en` and `pt-BR`), and `runFactsOf` (its `sessionMode` and `started` facts).

Constraints that shape the approach:

- The host's scheduled-tasks tool (`mcp__scheduled-tasks__create_scheduled_task`, `list_…`,
  `update_…`, `delete_…`, `run_…`) starts a session of the project on a schedule. Phase 1 showed
  (`proof/p0-delete.md`, `proof/p1-hooks.md`): a task runs on the owner's own computer, never on an
  SSH host; its session starts at the project root with the devkit plugin, its `SessionStart` hook,
  its skills and agents, and can run the loop script and hand a stage to an agent through the Agent
  tool; it has the Workflow tool and cannot start sessions; a task created on a turn the owner did
  not type runs in the default mode; and delete, pause and run need the owner's click in the app and
  are refused in auto and bypass mode, so no task removes itself unattended. Probe 2
  (`proof/p2-result.md`) showed the prompt's envelope, that a slash command in the prompt does not
  run, that agents and Workflows run only in the background and return by a completion notice, that
  an agent can hand an agent one level below, and that a run reads `succeeded` while a background
  command it started lives. Not shown yet: what a blocked firing costs, the hook's note in the
  session, the cron and the notification tool (task 3.6).
- The model of the empty-tick refusal is the genesi unstick gate
  (`~/.claude/plugins/cache/genesi/genesi/0.451.0/bin/genesi-unstick-gate.sh`, mode `prompt`): a
  `UserPromptSubmit` hook, first of its list, matches only the envelope `<scheduled-task
  name="genesi-unstick…">` at the start of the payload's `prompt` field (a `[{,]` before the key, so
  the same text escaped inside a human prompt never matches), exits 0 always, and prints
  `{"decision":"block","reason":…}` when nothing is offered. The task's prompt names its root on its
  first line (`genesi-root: <root>`), and the command it runs never asks the owner.
- `<name>` and `round <k>` belong to the change `multi-roadmaps` (not merged); the queue is built from
  `classifyLines` of the default roadmap until it lands.
- The CompozyOS verbs (`compozy-start`, `compozy-tick`, `compozy-state`) and `.compozy/` stay as they
  are (decision 11).

## Goals / Non-Goals

**Goals:**
- Phase 1's real runs, which settled the tick's prompt form and the review round's path before any
  code, and a phase-3 real run that measures a blocked firing with the real hook (D-1).
- One run file shape for a conducted run (D-2), one readiness rule shared by the hook and the tick
  (D-3), and every owner gate in one place (D-8).
- The removal of every ticket, entry, change-session and session-cron path (D-12), with each test
  that pins removed text a row of the test table (D-15).
- The machine's test capacity owned by the conductor: one whole suite at a time, the train first,
  capped gates and files, the caps in the run file and in every brief (D-25).

**Non-Goals:**
- Removing `decideRoadmap`, `next`, `wait`, `hold` and the legacy stop and hand-off rules for a run
  file that records no task: the tick reuses the decision core, and an old run file still exists on
  machines that ran `/devkit roadmap` before this change. A follow-up may remove what the tick does
  not call.
- A daemon, an SSH start, or a second schedule per run.

## Decisions

### D-1 Phase 1: the real runs and their decision points (AC-1)

Phase 1 ran on 2026-11-28 (`proof/p0-delete.md`, `proof/p1-hooks.md`, then probe 2,
`proof/p2-result.md`). Its first decision point, `proof/decision.md`, picked **stop and revise**;
this design is that revision, with probe 2's answers folded in as settled facts. What phase 1 found,
case by case:

| Case | Value | Source | What this design does with it |
|---|---|---|---|
| P-0: the session removes a task it created | false unattended: delete, pause and run need the owner's click in the app and are refused in auto and bypass mode; an SSH-host session creates nothing | `proof/p0-delete.md`, "What the host's tool descriptions state" | The task never removes itself: the run records its end, the hook blocks every later firing, and the owner list says once that the owner deletes the task with one click (D-5, D-6). A machine the app reaches as an SSH host holds no task and runs no conductor (D-13) |
| P-1: a scheduled session loads the plugin and its hooks fire | true for `SessionStart`, the skills, the agents and the loop script | `proof/p1-hooks.md`, `session_start_hook`, `loop_script`; `proof/p2-result.md`, `session_start_seen` | The tick runs the loop scripts in the task's session |
| P-2: the envelope of a task's prompt | the first user message holds the host's notes, then `[SCHEDULED TASK - AUTOMATED FIRING OF A CONFIGURED PROMPT]` and a short preamble, then `<scheduled-task name="<taskId>" file="<path>/SKILL.md">` wrapping a host sentence and the stored prompt | `proof/p2-result.md`, `envelope`, `envelope_tag` | D-4's regex and D-11's run detection read the tag and the line `devkit-roadmap-tick: <root>` inside it; the hook's own payload form is logged in task 3.6 |
| P-3: a slash command in a task's prompt runs as typed | false: it reaches the session as plain text inside the tag, and `devkit-openspec:devkit` is not model-invocable | `proof/p2-result.md`, `slash_command`, `slash_board: none` | Prompt form S-B, with no entry skill (below) |
| P-4a: an agent dispatches an agent one level below | true (the nested validator answered `VERDICT: PASS`) | `proof/p2-result.md`, `nested_agent` | Not used: the tick's own session hands each stage one level below it (D-7); no agent helper |
| P-4b: the Workflow tool in a task's session | true: it ran in the background and returned its result | `proof/p2-result.md`, `workflow_ran` | The review round takes the `workflow` path in a tick's session (D-7, task 4.1) |
| Foreground agents | none: the Agent tool has no foreground option in a task's session; a result comes by a completion notice (about 22 s for the probe's) | `proof/p2-result.md`, `nested_agent` | Every hand-off of a tick is in the background; the session ends its turn and each notice wakes it, so one drive spans several turns (D-7) |
| A stop hook while an agent runs | no devkit stop hook refused a turn that ended while the agent ran | `proof/p2-result.md`, `stop_hook_seen` | The tick's stop rule refuses only a turn's end with a live claim, no wait recorded and nothing of the claim in flight (D-11); its refusal is proved in task 6.1 |
| P-6: a run's status while a background command lives | the run read `succeeded` while the `sleep 600` it started still lived | `proof/p2-result.md`, `list_task_runs` | A run's status is no lock: overlap is guarded only by the run file's claims under its lock (D-2, D-6); task 3.6 records two runs at once |
| P-5: a blocked firing makes no model call | not measured | `proof/p1-hooks.md`, conclusions | Task 3.6, with the real `tick-gate.mjs` in a scratch project |
| P-7: the notification tool | not measured | none | Task 3.6 |
| The task keeps the creating session's permission mode | false: a task created on a turn the owner did not type runs in the default mode; the task is created on the owner's typed turn and its approvals live on the task; no permission prompt held either probe | `proof/p1-hooks.md`, "Host facts known before the probe"; `proof/p2-result.md`, consequences | `install-task` is given only on a typed `run` (D-5) |
| A task's session can start sessions | false (`mcp__ccd_session__start_session` absent) | `proof/p1-hooks.md`, `tools` | Nothing starts a session (decision 8) |

**The pick (coordinator's decision of 2026-11-28, `ADR [helper-conductor]` decision 3).** The helper
is the tick's own session: it drives its claimed change through `change-loop.mjs` and hands each
stage to its role as an agent one level below it, as a lone `/devkit change` session does today, and
runs the review bench as the `review-change` Workflow (D-7). No agent sits between the tick's session
and the stage agents: no `plugins/openspec/agents/roadmap-helper.md`, no change-helper Workflow. In
this design "the helper" and "a helper in flight" name that drive of one claimed change by a tick's
session (a live claim); the verbs keep their names (`helper-next`, `helper-release`).

**Prompt form S-B (coordinator's decision on probe 2).** The tick's prompt carries no slash command
and no entry skill is added (the change removes `devkit-session` and adds no other). It is two lines:
`devkit-roadmap-tick: <root>`, then `Run the devkit roadmap tick as the devkit tick note of this
prompt says, and follow its output. With no note, change nothing and end the turn.` The note is the
tick hook's own output on a firing it lets through (D-4): it names the session id, the pack's live
paths (so a pack update never leaves a stale path in a task no session may edit) and the exact
`roadmap-loop.mjs tick` call, and points to the part "A tick" of the `devkit` skill, which the
session reads as a file. What coordination-locks needs: `roadmapRunOf` counts a session whose first
user message carries the scheduler's header, a `<scheduled-task name="devkit-roadmap-tick-…">` tag
and, inside it, the line `devkit-roadmap-tick: <root>` for this project's root, as a typed
`/devkit roadmap tick`; the run then starts with the `devkit-roadmap:` line `tick` prints, as for a
typed command (D-11). An owner who types `/devkit roadmap tick` gets the same tick through the skill.

**The second decision point, task 3.6.** Stop and revise (no later phase starts; the plan goes back
to the planner, the readiness review and the owner's approval) when task 3.6 shows a model call or
tokens on a blocked firing (decision 2 fails), or shows that the hook's note does not reach the
firing's session (S-B then has no way to name the session and the paths). A refused `*/5 * * * *` is
no stop: the shortest interval the host accepts is recorded in `proof/decision.md` and brought to the
owner as a revision of AC-15 before phase 4.

### D-2 The run file of a conducted run

`plugins/openspec/hooks/run-file.mjs`. `emptyRun()` loses the six fields `ADR [helper-conductor]`
decision 8 removes (`tickets`, `changeSessions`, `startedSessions`, `turn`, `cron`, `check`) and
gains:

```js
task: null,        // { id, cron, at } once the scheduled task is installed; null otherwise, and null again at the end
ended: null,       // { why: 'done' | 'stopped', at, task } once the run ended; `task` the id the owner deletes in the app
queue: [],         // the change ids of the run's roadmap lines, in file order, as `run` built them
claims: {},        // { <id>: { session, at, heartbeat } }: the tick session driving <id>
holds: {},         // { <id>: { kind, at, recheckAt, params } } the wait each item's drive ended at
ownerWaits: {},    // { <id> | '@train' | '@run': { gate, questions, request, summary, at, shown, pushedAt } } the lines for the owner
train: null,       // { claim: { session, at, heartbeat } | null, hold: { kind, at, recheckAt } | null } (D-21)
capacity: null,    // { suites: 1, gates, concurrency, at } the machine's test caps, recorded by `run` (D-25)
```

- `holds[id].kind` is one of `github`, `place`, `load`, `after`, `owner`, `blocked`, `delegated`,
  `archived`, `boarded`, `escalated`, `skipped`, `elsewhere` (D-18 to D-23). `recheckAt` (ISO time or null) is when the item is worth a new look without any local
  change: 10 minutes after `at` for `github`, 30 minutes for `after` and `elsewhere`, null for the others. `params`
  holds the gate (`owner`, `delegated`), the dependency (`after`) or the reason (`blocked`).
- `ownerWaits[id].gate` is one of `grill`, `mockup`, `approval`, `retro`, `review-round`,
  `pr-decision`, `merge`, `decision`, `budget`, `task-left`, the gates of `gate.*` in the message
  table (`gate.task-left` is new, D-9); `task-left` is written only under the key `@run` (D-6 rule 3);
  `questions` is a list of strings (the grill's), empty for the other gates; `shown` is the list of
  session ids that showed it; `pushedAt` is null until its push.
- `readRun` keeps an entry only when it is whole and of the right type, as `readUpfront` does today;
  a run file with `tickets`, `changeSessions`, `startedSessions`, `cron`, `check` or `turn` reads as
  if they were absent (the spec's "a run file written before the run had a task").
- The stale bound `CLAIM_STALE_MS = 2 * 60 * 60 * 1000` (two hours), exported. `DEVKIT_CLAIM_STALE_MS`
  (a whole number of milliseconds from 1000 up) overrides it, for the tests and the real-run proof of
  a takeover only; any other value is ignored. A claim is live while
  `Date.now() - Date.parse(heartbeat) < CLAIM_STALE_MS`; a heartbeat that does not parse is stale.
- ADR 0013 decision 4 lists the run file's fields, and `roadmap-loop-followups.test.mjs` "followups
  AC-3 run file" compares that list with the file's keys. A dated Note is added under ADR 0013's
  Decision: `Note (helper-conductor, <the date of the task>): ADR [helper-conductor] decisions 8 and
  13 remove the fields `tickets`, `changeSessions`, `startedSessions`, `turn`, `cron` and `check`,
  and add `task`, `ended`, `queue`, `claims`, `holds`, `ownerWaits`, `train` and `capacity`.` The test reads
  decision 4's list, removes the Note's removed fields and adds its added ones before it compares.
- `readRun` keeps `ended` only when `why` is `done` or `stopped` and `at` and `task` are strings, and
  the `@train` and `@run` keys of `ownerWaits` beside the change ids.
- `readRun` keeps `capacity` only when `suites` is 1 and `gates` and `concurrency` are whole numbers
  in D-25's ranges; any other value reads as `null`, and a `null` capacity is read as D-25's
  defaults wherever a cap is needed.

Writes go through the existing `updateRun` lock (`roadmap-run.lock`, `LOCK = { stepMs: 100, waitMs:
3_000, staleMs: 60_000 }`): a claim, a heartbeat, a hold, a release and an owner line are each one
`updateRun` call, read and written under that lock, so two ticks claiming the last item at once
leave one claim (the spec's "Two ticks at once").

### D-3 What is ready: `tickReady(run, facts, now)`

A pure function exported from `run-file.mjs`, the one rule the hook (D-4) and the `tick` verb (D-6)
share. `facts` is `{ archived: Set<id>, open: Set<id>, load, limit, heldPlaces }`, built by
`localFacts(root, run, env)`, also exported from `run-file.mjs`, which reads files with `node:fs` only
and starts no process (no `git`, no `gh`), so the hook and the tick build the same facts:

- **The common git directory**, `commonDirOf(root)`: `<root>/.git` a folder → that folder; a file
  `gitdir: <path>` → `<path>/commondir` resolved against `<path>` when that file exists, else
  `<path>`; anything unreadable → null. `localRunFilePath(root)` is
  `<commonDirOf(root)>/devkit/roadmap-run.json`, null with no common dir. Both live in
  `plugins/openspec/hooks/guard.mjs`, which `run-file.mjs` (`run-file.mjs:8`) and `deliver-check.mjs`
  (`deliver-check.mjs:19`) already import, and `run-file.mjs` re-exports them, so `deliver-check.mjs`
  reads whether a run is conducted with no import cycle (D-25). `runFilePath` (`git rev-parse
  --git-common-dir`, `run-file.mjs:24-28`) stays for every other caller.
- `archived`: the ids `<id>` of the folders `openspec/changes/archive/<date>-<id>/` of the main
  checkout (the parent of the common dir when its name is `.git`, else `root`).
- `open`: the change folders `openspec/changes/<id>/` (not `archive`, change ids only) of the main
  checkout and of every linked worktree, a linked worktree being the parent folder of the path that
  `<common dir>/worktrees/<name>/gitdir` names, skipped when that path does not exist: the same list
  as `git worktree list --porcelain` minus prunable and bare entries (`listWorktrees`,
  `deliver-check.mjs:246`), which the tick keeps using for everything but these facts.
- `load` from `os.loadavg()[0] / os.cpus().length * 100`; `limit` from
  `limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT)`, as `roadmap-loop.mjs:891` reads it. `limitOf` and
  `DEFAULT_LIMIT` move from `roadmap-loop.mjs:62-71` to `run-file.mjs`, and `roadmap-loop.mjs`
  re-exports `limitOf` as it re-exports `readRun` and `runFilePath`, so its importers are unchanged.
- `heldPlaces`: the count of the ids of `run.occupied` that are in `open`. `run.occupied` is the
  record the place rule already writes: `sessionDecide`'s `placeDecision` (`roadmap-loop.mjs:1070-1079`)
  adds a change when it reaches a part of `LOAD_PARTS` (`build`, `after`: the implementation, a test
  stage, the evidence, the review) and deletes it when the change leaves those parts or is archived;
  `helper-next` keeps that rule (D-7). The count leaves out an id no longer open, as the prune of
  `roadmap-loop.mjs:1240` does, without writing. No stage header is read for it. `placeDecision`
  counts every `occupied` entry (`roadmap-loop.mjs:1024`) and `pruneRecords` (`:1236`) runs today only
  for `run.changeSessions`, which this change removes; so `tick` and `helper-next` prune
  `run.occupied` to the open ids, in the same `updateRun` and before `placeDecision`, the one place
  the rule lives (readiness finding of attempt 2). The hook's count and the tick's then agree.

It returns `{ ready: <id> | null, why }`:

1. `run.task` null → `{ ready: null, why: 'no-task' }`. This holds before the task is installed and
   after the run's end (D-6 rule 3), so every firing after the end is blocked before the model.
2. `run.stopping` with a live claim or a live `train.claim` → `{ ready: null, why: 'stopping-busy' }`
   (the hook blocks: the drive in flight releases its claim itself); `run.stopping` with neither →
   `{ ready: null, why: 'stopping' }` (the hook passes, for the tick to record the end, D-6 rule 3).
3. Every id of `run.queue` in `archived`, or held `archived` or `skipped` → `{ ready: null, why:
   'done' }` (the hook passes).
4. Live claims ≥ `run.places` → `{ ready: null, why: 'helpers-full' }`.
5. The first id of `run.queue`, in order, not archived, with no live claim, whose hold is ready:
   - no hold, or `kind` `delegated` → ready;
   - `github` or `after` with `recheckAt <= now` → ready;
   - `place` with `heldPlaces < run.places` → ready; `load` with `load < limit` or the id in
     `run.anyway` → ready;
   - `owner` → ready only once `ownerWaits[id]` is gone (the typed session answered, D-8);
   - `escalated` → ready once its request has its answer file and `requirements.md` the item naming it (D-23);
   - `elsewhere` → ready at `recheckAt` (30 minutes), for the tick to read the claim on `origin` again;
   - `boarded` → never for the change itself; the train is ready instead (rule 4a);
   - `blocked` → never while the hold stands; the owner's answer to its line deletes it (D-7, D-8);
   - `archived`, `skipped` → never.
   4a. Before rule 5: a `boarded` hold anywhere, no live `train.claim`, and `train.hold` null, or
   `github` with `recheckAt <= now`, or `owner` with `ownerWaits['@train']` gone → `{ ready: '@train' }`
   (D-21).
   An item of the queue with no folder in any worktree and no hold is ready (it is to be opened, or
   fetched from its pushed branch, D-13), so the tick, which may use the network, decides.
6. None → `{ ready: null, why: 'nothing-ready' }`.

Unterminated input: a missing, empty or non-JSON run file is `emptyRun()` (no task, rule 1); a queue
id that is not a change id is skipped.

### D-4 The tick's prompt hook: `plugins/openspec/hooks/tick-gate.mjs` (AC-3)

`hooks.json` gains, first in a new `UserPromptSubmit` list:
`{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tick-gate.mjs\"", "timeout": 10 }`.

- It reads stdin (at most 64 KiB) and tests the raw text first, with no import, for the envelope
  probe 2 recorded (`proof/p2-result.md`, `envelope`, `envelope_tag`): the payload's `prompt` field,
  anchored on `[{,]\s*"prompt"\s*:\s*"` as genesi's is, holds the tag `<scheduled-task
  name="devkit-roadmap-tick-<slug>-<hash>"` (D-5's task id for `findRoot(payload.cwd)`), and after
  it, at the start of a line, `devkit-roadmap-tick: <root>` with that same root. Probe 2 read the
  envelope as the model sees the first message; whether the hook's payload holds the tag or only the
  stored prompt is not known, so the regex also accepts a `prompt` whose first line is exactly
  `devkit-roadmap-tick: <root>`. Task 3.6 logs the payload of real firings; the form it does not
  see is dropped in that task, with its test. The test fixtures copy probe 2's text.
- Anything else, any parse error, a project that has not opted in, or a root that does not match:
  exit 0, print nothing.
- For the envelope: `readRun(localRunFilePath(root))` (a null path → print nothing),
  `localFacts(root, run, process.env)` and `tickReady` of D-3. `ready` not null, or `why` in `done`,
  `stopping`: exit 0 and print the tick's note (below). Otherwise (`no-task`, `stopping-busy`, `helpers-full`,
  `nothing-ready`) print `{"decision":"block","reason":"devkit roadmap: nothing is ready (<why>)"}`
  and exit 0; after the run's end (`run.ended` set, `why` `no-task`) the reason reads `devkit roadmap:
  the run is over; delete its scheduled task in the app`.
- **The tick's note** (prompt form S-B, D-1): on a firing it lets through, the hook prints
  `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"<note>"}}`, the
  note being, in English: `devkit tick note: session <payload.session_id>. Run: node
  "<CLAUDE_PLUGIN_ROOT>/hooks/roadmap-loop.mjs" tick --session <payload.session_id> --lang <l>
  --load-limit <x> --machines '<m>'. Then read the part "A tick" of
  <CLAUDE_PLUGIN_ROOT>/skills/devkit/SKILL.md and carry out the tick's output as it says; never ask
  anything.`, where `<l>`, `<x>` and `<m>` are the pack's settings as the hook's process receives
  them (`CLAUDE_PLUGIN_OPTION_LANGUAGE`, `CLAUDE_PLUGIN_OPTION_LOAD_LIMIT`,
  `CLAUDE_PLUGIN_OPTION_MACHINES`, each as `roadmap-loop.mjs:891` reads the load limit; an unset one
  is left out of the call, and the script takes its default). The note is built from the hook's own
  `CLAUDE_PLUGIN_ROOT`, so it names the installed pack version at each firing. Every prompt that is
  not the envelope still gets no output.
- Its imports: Node built-ins at the top; `guard.mjs` (`findRoot`, `optedIn`) and `run-file.mjs`
  (`readRun`, `localRunFilePath`, `localFacts`, `tickReady`) by a dynamic `import()` only once the raw
  text matched, so any other prompt loads nothing. `run-file.mjs` imports `change-loop.mjs`
  (`run-file.mjs:9`), and through it that module's imports (`flow-check.mjs`, `deliver-check.mjs`,
  `compozy-driver.mjs` and the others of `change-loop.mjs:43-50`); `change-loop.mjs` "runs nothing
  when imported" (`change-loop.mjs:6`), and no function of D-3 that the hook calls starts a process.
  The hook never runs `git`, `gh` or a model: with a `PATH` whose `git` and `gh` exit 1, the
  envelope with nothing ready still blocks (task 3.1). With `DEVKIT_HOOK_LOG` set it appends one JSON
  line `{ at, mode: 'prompt', session, change: null, decision: 'block'|'allow', why }` (the spec's "A
  recorded tick").

### D-5 The typed command and the scheduled task (AC-2, AC-9)

- Task id: `devkit-roadmap-tick-<basename of root, lowercased, outside [a-z0-9-] made `-`, cut to 24>-<first
  8 hex of sha256(root)>`. Cron: `*/5 * * * *` (`ADR [helper-conductor]` decision 1, AC-15), unless
  task 3.6 shows the host refuses it: then the shortest interval it accepts, recorded in
  `decision.md` and brought to the owner as a revision of AC-15 before phase 4 starts.
  `notifyOnCompletion: false`.
- Prompt, exactly two lines (S-B, D-1): `devkit-roadmap-tick: <root>`, then `Run the devkit roadmap
  tick as the devkit tick note of this prompt says, and follow its output. With no note, change
  nothing and end the turn.` It names no path and no version, so a pack update needs no change to
  the task.
- The task is created only on the owner's typed turn, so that it keeps the session's permission mode
  and its tool approvals are stored on the task (`proof/p1-hooks.md`, host fact 2): `install-task` is
  printed only by `run` (the verb behind a typed `/devkit roadmap [<n>]`), never by `tick`, `next` or
  a firing; the skill carries it out in the same turn, before the turn's end, and never on a
  continuation or a task notification.
- `roadmap-loop.mjs run --test-gates <g> --test-concurrency <c>` (no `--change-sessions`, no
  `--cron`; both flags are now unknown options) records `places`, `queue` (from `classifyLines`: the
  unticked, unarchived lines, in file order), `session` and `capacity` (D-25), every typed `run`
  writing `capacity` again from the settings, as it writes `places`, and clears `ended` and the
  `@run` line of a run that ended; it prints `devkit-roadmap: <n>` then the decision JSON with one
  action: `{ kind: 'install-task', input: { taskId, title, description, cronExpression, prompt,
  notifyOnCompletion } }` when `run.task` is null, else none. `--after task=installed:<id>` or
  `--after task=exists:<id>` (a new key of `run`'s `--after`) records `task: { id, cron, at }`;
  `--after task=refused` records nothing and prints the reply `roadmap-no-task`.
- The skill (D-9): before `run`, load the host's tools with `ToolSearch`
  (`select:mcp__scheduled-tasks__list_scheduled_tasks,mcp__scheduled-tasks__create_scheduled_task`);
  when none loads, run `roadmap-loop.mjs reply roadmap-no-scheduler`, say it, end the turn (nothing is
  written). For `install-task`: `list_scheduled_tasks`; a task with the action's `taskId` (the task
  a finished run left, which the owner did not delete yet, included) → `--after task=exists:<id>`,
  so a run typed again after its end reuses that task and creates no second one; else
  `create_scheduled_task` with `input` exactly → `--after task=installed:<id>`, or `task=refused` on
  an error (an SSH-host session's refusal, `proof/p0-delete.md`, included).
- No session of the conductor calls `delete_scheduled_task`, `update_scheduled_task` or
  `run_scheduled_task`: the host takes them only with the owner's click and refuses them in auto and
  bypass mode (`proof/p0-delete.md`). There is no `delete-task` action and no `--after task=deleted`.
- `stop`: `run` with `stop` sets `stopping`. With no live claim and no live `train.claim` it records
  the end at once, as D-6 rule 3 does (`why: 'stopped'`), and prints the reply `roadmap-ended-stopped`
  and the `@run` line's words, which the typed session says and marks shown (`owner-waits --session`),
  so the owner reads them once, in that session. With a claim live it prints the stopping reply; the
  hook then blocks the firings (`stopping-busy`) until the drive in flight releases its claim, and
  the next firing's tick records the end (D-6 rule 3), even when the typed session closed.

### D-6 The tick: `roadmap-loop.mjs tick --session <id>` (AC-4, AC-5, AC-9, AC-11)

Reached from a firing through the hook's note (D-4), whose call the session runs, or from the
owner's typed `/devkit roadmap tick` through the `devkit` skill (D-9). It prints `devkit-roadmap:
<places>` then one JSON:

1. No `run.task` → `{ end: { reply: 'roadmap-no-run' } }`, nothing written (after the run's end the
   hook blocks the firing before this point; an owner who types `/devkit roadmap tick` gets the reply).
2. A hold of kind `delegated` whose item has no live claim → `{ action: { kind: 'record-delegated',
   change, gate, quote, line, who } }`: this tick's session records it (D-8), calls `tick-recorded
   --change <id> --gate <g>`, which clears the hold, and runs `tick` again. This sweep is the only
   place a tick writes a gate file or an answer: never in the drive that reached the gate
   (`ADR [helper-conductor]` decision 3), so a drive that ends at a delegated gate ends there, and
   a later tick records it.
3. The end. `tickReady` says `done`, or `stopping` (no live claim left): in one `updateRun`, `ended =
   { why: 'done' | 'stopped', at: now, task: run.task.id }`, `task = null`, `stopping` cleared, and
   the line `ownerWaits['@run'] = { gate: 'task-left', questions: [<task id>], request: null, at: now,
   shown: [], pushedAt: null }`; it prints `{ end: { reply: 'roadmap-ended-done' |
   'roadmap-ended-stopped', task: <id> } }`. No call removes, pauses or runs the task (D-5): from
   then on rule 1 of D-3 holds and the hook blocks every later firing before the model. The `@run`
   line is the one place the owner reads, once, that the task is to be deleted with one click in the
   app (`roadmap-task-left`, D-9): the typed session's watch shows it and marks it shown, the push
   sends it once (D-8), and `/devkit status` lists it under the owner's block until a typed
   `/devkit roadmap` starts a run again (D-5) or the owner says the task is deleted (`answered
   --change @run --gate task-left`). `stopping-busy` → nothing to claim, `{ end: null }` (the hook
   blocks those firings, so they cost no model call). A `stopping` run is bounded: the drive in
   flight releases its claim at its next `helper-next` (D-7), and a drive that died leaves a claim
   stale after `CLAIM_STALE_MS`, after which the next firing passes the hook and its tick records the
   end.
4. Otherwise the decision core runs as `next` does (`decideRoadmap` over the facts, with its fetch of
   the base, `fresh-base` rule), and the tick takes the first item of `run.queue`, in order, that
   `tickReady` would accept and whose decided action is not a wait; under `updateRun` it prunes
   `run.occupied` to the open ids (D-3), re-reads the run file, checks that item still has no live
   claim and that live claims are below `places`, and writes `claims[id] = { session, at: now,
   heartbeat: now }` and deletes `holds[id]`. It prints `{ claim: { change, root } }`: `root` the
   change's worktree (or the main checkout when the change is not open yet).
5. Nothing claimable → `{ claim: null, why }`.

On a claim, the tick's session drives the claimed change itself (D-7), over as many turns as its
background hand-offs need: it starts no helper agent and no session. When the drive ends, it runs
the pushes of new owner lines (D-8) and ends its turn; a delegated gate the drive reached waits for a
later tick's rule 2. Two firings at once are told apart only by the claims: a run's status reads
`succeeded` while its session still waits for a notice (`proof/p2-result.md`), so the next firing's
tick may start while a drive goes on, and its claim under `updateRun` skips the claimed item.

### D-7 The helper is the tick's own session: `roadmap-loop.mjs helper-next` (AC-4 to AC-6, AC-11)

`helper-next --change <id> --session <tick session> [--after <key>]` replaces `session-next`: the
same reading of `change-loop.mjs next` for the change in its worktree, the same place, load and
dependency holds (`held` with `why` `place`, `load`, `after`), the same `merge-base` step before the
first plan file, the same budget end; minus the ticket, the session title and the session-model
switch. Every call renews `claims[id].heartbeat` and prunes `run.occupied` to the open ids before
`placeDecision` (D-3). It prints `devkit-run: <id>` and the action, or, when the action is a wait or
an end, records it and releases the claim in one `updateRun`:

| Action from the change loop | Recorded | Printed |
|---|---|---|
| `held` place / load / after | `holds[id] = { kind: 'place'|'load'|'after', … }` | `{ kind: 'end', state: 'running', why }` |
| end `waiting-on-github` | `holds[id] = { kind: 'github', recheckAt: now + 10 min }` | `{ kind: 'end', state: 'waiting-on-github' }` |
| end `waiting-for-owner` at a gate the standing answers delegate (D-8) | `holds[id] = { kind: 'delegated', params: { gate, quote, line, who } }` | `{ kind: 'end', delegated: { … } }` |
| end `waiting-for-owner` at any other gate | `ownerWaits[id] = { gate, questions: [], … }`, `holds[id] = { kind: 'owner' }` | `{ kind: 'end', state: 'waiting-for-owner', gate }` |
| end `blocked` | `holds[id] = { kind: 'blocked', params: { why } }` and `ownerWaits[id] = { gate: 'decision', questions: [<why>], … }` | `{ kind: 'end', state: 'blocked', why }` |
| end `archived` | `holds[id] = { kind: 'archived' }`; no owner line | `{ kind: 'end', state: 'archived' }` |
| `run.stopping` set, before any new action | no hold | `{ kind: 'end', state: 'stopping' }` |
| `grill` | nothing | the action, with `standing` (D-8's parse) and `conducted: true` |
| any other stage or step | nothing | the action, unchanged but for the dropped `sessionTitle` and, on an `agent` action, D-25's cap sentence appended to its `brief` |

A `blocked` end needs the owner (AC-7: "anything not delegated"), so it is a line like any gate's:
gate `decision` (the message table's `gate.decision`, "a decision only you can take"), its one
question the end's `why` with the loop's reply for it, shown in the typed session and pushed once
(D-8). The owner's answer there is the owner's own turn: the typed session carries out what the owner
says (remove a taken branch, retry, drop the item from the roadmap) and runs `answered --change <id>
--gate decision`, which deletes the line and the `blocked` hold; the next tick claims the item and
`helper-next` reads its files again (a cause left in place gives a new `blocked` end and a new line).
An `archived` end writes no line and no push: the tick's reply names it, `/devkit status` lists it,
and once every queued item is archived or held `archived` the tick ends the run (D-6 rule 3).

`owner-wait --change <id> --gate grill --question <q>...` (repeatable) is the grill's exit for the
questions nothing settles: it writes the owner line with those questions and the `owner` hold, and
releases the claim. `helper-release --change <id>` releases a claim with no hold: the stop lock names
it (D-11) for a drive that cannot go on (its worktree unreadable, the loop exiting 3).

**The drive.** There is no helper agent (`proof/decision.md`, "Pick"; `ADR [helper-conductor]`
decision 3). The tick's session carries out the loop of `## Loop` item 2 of the devkit skill for its
one claimed change, as a lone `/devkit change` session does, with these differences, written into
the "A tick" part of the skill (D-9):

- Every `next` is `helper-next`; a stage action is handed to its role with the Agent tool, the
  action's `brief` as the prompt and the action's model with any `[1m]` dropped (D-14), one level
  below the tick's session. No agent it hands dispatches the stage further for it.
- Every hand-off is in the background: a task's session has no foreground Agent call, and the
  agent's result comes as a completion notice (`proof/p2-result.md`, `nested_agent`). After a
  hand-off the session ends its turn; the notice wakes it, and it calls `helper-next --after <key>`
  as the Loop says. One drive therefore spans several turns of the same session, and the claim's
  heartbeat is renewed at each `helper-next` call.
- The grill runs in the tick's session through the requirements-grill skill's conducted branch
  (D-9): the triage agent, then the standing answers, each answer with its source, and `owner-wait`
  for the rest.
- The review round runs in the tick's session as `review-change` says (the `review` step of
  `ship-change`): on the `workflow` path, `plugins/core/skills/review-change/scripts/review-round.workflow.js`
  (probe 2's step 4 ran the Workflow in a task's session, in the background), so `review-change`'s
  "Which path runs" counts the turn a conducted run's scheduled prompt began (task 4.1); on the
  `agents` path whenever the skill's own rows send it there (the tool refuses, the result is invalid,
  the round is lost). The
  reviewers' files are written by their own agent types, as ADR 0008 decision 4 keeps.
- The session steps the loop gives (the commits and pushes of the delivery, `merge-base`, the
  answer of a review thread) are the tick's session's own, as for a lone change. A step that needs
  the owner is never attempted: the loop gives it as an end, which `helper-next` turns into a line.
- It never calls AskUserQuestion (D-10), starts no session, writes no gate file (`approval.md`, a
  retro answer) and no request answer, and writes no product code. A gate the standing answers
  delegate ends the drive with its `delegated` hold; a later tick's sweep records it (D-6 rule 2).
- Every test command it runs itself goes through `test-run` as D-25 says, and the cap sentence of
  D-25 is on every brief it hands.
- Its drive ends at the `end` of `helper-next` (a `stopping` end included).

### D-8 The owner's one place: lines, the typed session, the push, the delegations (AC-6 to AC-8)

- **The standing answers**, `plugins/openspec/hooks/standing-answers.mjs`, `readStandingAnswers(root)
  → { answers: [{ line, topic, text }], delegations: { <gate>: { line, who, quote } } }`. The file is
  `openspec/standing-answers.md`, read from the main checkout; the conductor never writes it (the guard
  refuses a write to it by any session but the owner's typed edit: `classify` gains it as an
  owner-only path, refused to subagents and to a tick's session). Grammar: lines of the form
  `- <topic>: <text>` under `## Answers`; lines of the form `- <gate>: delegated to <who>: "<quote>"`
  under `## Delegations`, where `<gate>` is a gate id of D-2 (`grill` delegates the grill's
  conservative reading). Headings other than those two end a section. A line inside a fenced block
  (` ``` ` or `~~~`) is ignored, and an unclosed fence ignores every line after it. Missing file, empty
  file, unreadable file → no answers, no delegations. A delegation line with no quote or an unknown
  gate is ignored.
- **A line for the owner** is written only by `helper-next` and `owner-wait` (D-7), by `train-end`
  (D-21), and by the end of the run (`@run`, D-6 rule 3). `owner-waits
  [--session <id>]` prints the lines as JSON, in roadmap order, each with the message of
  `roadmap-gate` and its questions; with `--session` it adds the id to each line's `shown`.
- **The typed session** (D-9): after `run`, it starts `roadmap-loop.mjs owner-watch --session
  ${CLAUDE_SESSION_ID}` with the Bash tool's background option: a loop that every 60 seconds reads the
  run file and exits 0 when a line exists whose `shown` lacks that session, or when `run.task` is null.
  The session then runs `owner-waits --session …`, shows the lines, asks the head line (roadmap order)
  as the owner's gate, one change at a time, and records the owner's own answer as `## Owner gates`
  of the skill says for that gate (the `ship-change` row of the gate, the grill answers into
  `requirements.md`), then `answered --change <id> --gate <g>`, which deletes `ownerWaits[id]` and
  `holds[id]`; it starts the watch again. The `@run` line asks nothing: the session says its words
  once (`roadmap-task-left`) and the watch ends, since `run.task` is null. The watch is recorded in
  `waits` with kind `watch`.
- **The push**: at the drive's end (D-6) and after a tick that recorded the run's end, the tick's
  session runs `owner-waits` and, for each line whose `pushedAt` is null, when task 3.6 named a
  notification tool, sends one notification (`<id>: <gate phrase>`) and runs
  `pushed --change <id> --gate <g>`, which sets `pushedAt`. A line is pushed once.
- **A delegated gate** is recorded by a tick's session in its sweep (`record-delegated`, D-6 rule 2),
  never in the drive that reached it and never by a stage agent: for `approval`, the `ship-change` row `stop-plan-approval` with the owner's words replaced
  by `delegated to <who> in openspec/standing-answers.md:<line>: "<quote>"`; for `retro`, the
  `stop-retro-answers` row the same way; for the other gates, the reply the skill's `## Owner gates`
  names with the same words. A gate with no delegation is never recorded by a tick (the hook rule of
  D-11 refuses an `approval.md` or `retro.md` answer written by a tick's session with no
  `record-delegated` action for that change and gate in its transcript).

### D-9 The texts: the devkit skill, the grill, the rule

- `plugins/openspec/skills/devkit/SKILL.md` `## Roadmap` is rewritten as three parts: "The typed
  command" (D-5's tool loading and `install-task`, the owner watch and the lines of D-8, `stop`, the
  start-anyway, the `@run` line said once after the end), "A tick" (run `tick` as the hook's note
  or the typed `/devkit roadmap tick` gives it; carry out `record-delegated` in the sweep and run
  `tick` again; on an end, the pushes and end the turn; on a claim, drive the change as D-7's "The
  drive" says, every hand-off in the background, ending the turn after each and going on at its
  notice, then the pushes; never ask the owner, never call AskUserQuestion, never write a gate file
  but in the sweep, never call `delete_scheduled_task`, `update_scheduled_task` or
  `run_scheduled_task`; every test command through `test-run`, D-25), and "What stays" (the places,
  the load, the machines, and the test caps with their two settings). A tick's session reads "A
  tick" as a file, at the path the hook's note names: the skill stays not model-invocable and no
  entry skill is added (D-1). "A tick" is written so it reads whole on its own, with every path
  given relative to the note's pack root. The settings list at the skill's top gains `test_gates` and
  `test_concurrency` beside `load_limit`, and `run`'s call carries `--test-gates` and
  `--test-concurrency` (D-25). "A session per change", "Every change in this session" and "The
  periodic check" are deleted, and so is item 1a of `## Loop`, the `session-next` mention of the grill
  item, and the `Never` items about change sessions, the session-start tool and the periodic check;
  the `Never` item about crons becomes: "Create a cron or any scheduled wake-up, except the one
  scheduled task of a roadmap run that `roadmap-loop.mjs run` asks for on the owner's typed
  `/devkit roadmap`; never delete, pause or run a task: at the run's end the owner deletes it in the
  app." The frontmatter's `argument-hint` reads `roadmap [<n> | stop | tick]`.
- `plugins/core/skills/review-change/SKILL.md`, "Which path runs" (`:77`; probe 2's step 4 ran the
  Workflow, D-1): the condition "the current turn began with the owner's own typed message
  (not ... a scheduled prompt)" gains "or with the scheduled prompt of a conducted `/devkit roadmap`
  run (its first line `devkit-roadmap-tick: <root>`), in that run's tick session"; the skill's
  `Never` item "Use the Workflow tool for anything but this round" stays as written.
- `plugins/core/skills/requirements-grill/SKILL.md` gains, at the end of step 2b, "### 2c. A
  conducted grill": when the action carries `conducted: true`, the questions the triage leaves go to
  the action's `standing.answers` (each answer quoted with `openspec/standing-answers.md:<line>` as
  its source), then, when `standing.delegations.grill` exists, are answered by the most conservative
  reading of the request with that line as the source, else are passed to `owner-wait` and the grill
  ends; no question is asked with AskUserQuestion. Its `Never` list keeps "- Answer a question
  yourself" and adds "outside a conducted grill (step 2c)".
- The rule of `openspec/config.yaml` `rules.requirements` and of the four `schema.yaml` copies
  (`plugins/openspec/schemas/{devkit,devkit-lite}/schema.yaml`,
  `openspec/schemas/{devkit,devkit-lite}/schema.yaml`): "Ask the owner every question that nothing
  written settles; the requirements-triage agent answers the others first, each with its source. Never
  answer a question yourself, except in a roadmap run: there a question the triage leaves goes to
  openspec/standing-answers.md, then to the run's line for the owner, and is answered by its most
  conservative reading only when the standing answers delegate the grill, each answer naming its
  source."
- Messages (`change-loop.mjs`, both languages, the same keys): removed `roadmap-session-started`,
  `roadmap-waits-turn`, `roadmap-session-opened`, `roadmap-check-refused`, `roadmap-check-idle`,
  `roadmap-check-stopped-waits`, `roadmap-check-session-archived`, `roadmap-check-archive-later`,
  `roadmap-session-started-on`, `roadmap-waits-turn-on`, `roadmap-woken`, `roadmap-waits-refused`,
  `session-held-owner`; kept `session-held-place`, `session-held-load`, `session-held-after` (the
  helper's held words); added `roadmap-no-scheduler` ("/devkit roadmap needs the app's scheduled
  tasks, which this session does not have: nothing was started."), `roadmap-no-task` ("The app
  refused the run's scheduled task: nothing was started."), `roadmap-task-installed` ("The run is
  under way: a scheduled task of this project moves each change by itself, and what needs you is
  asked here."), `roadmap-no-run` ("No roadmap run is under way here: type /devkit roadmap to start
  one."), `roadmap-task-left` ("The run is over. Delete its scheduled task {task} with one click in
  the app's scheduled tasks; until then each of its firings is refused before the model and costs
  nothing."), `gate.task-left` ("the run's scheduled task, to delete in the app"), `roadmap-owner-line` ("{id} waits for {gate}:
  answer here, and the run goes on."),
  `status-owner-here` ("answer in the session the run was typed in"), each with its `pt-BR` text
  written in the same plain register as its neighbours.

### D-10 A tick's session never asks (AC-6)

`hooks.json` gains a `PreToolUse` matcher `AskUserQuestion` →
`guard.mjs ask`: in a session whose run is a tick (`roadmapRunOf` gives `command: 'roadmap tick'`),
from the main thread, a stage agent it handed or an agent of the review round's Workflow, the call is
refused with "a roadmap tick never asks the owner:
write the question as a line for the owner (owner-wait)". Every other session passes. It fails open
as every lock does.

### D-11 The locks (coordination-locks)

- Run detection of a tick's session (prompt form S-B, D-1). `roadmapRunOf` (`guard.mjs:1302`) gains
  one event: the session's first user message, read as `firstMessageOf` reads the started form,
  counts as a typed `/devkit roadmap tick` when it holds the scheduler's header line `[SCHEDULED TASK
  - AUTOMATED FIRING OF A CONFIGURED PROMPT]`, then a `<scheduled-task name="devkit-roadmap-tick-…"`
  tag, and inside it, at the start of a line, `devkit-roadmap-tick: <root>` with `<root>` the
  session's own `findRoot(cwd)` (`proof/p2-result.md`, `envelope`). As for a typed command, the run
  starts only once the `devkit-roadmap:` line that `tick` prints follows it. Another scheduled task,
  a tag of another name, or a line naming another root is no roadmap run; a typed later message
  replaces it as today. An owner's typed `/devkit roadmap tick` is read as before. The new read
  fails open as every lock does (an unreadable transcript is no run). No `Skill` entry is added.
- `roadmapStopDecision`, the tick's stop rule: when the run file records `task` (or `ended`), the
  typed session (command not `roadmap tick`) is allowed. A tick's session is refused once (progress
  key `tick:<id>:<the claim's heartbeat>`) while it holds a live claim (`claims[id].session` is its
  session id) and the stop's input lists no background task: the drive must reach a wait, and the
  reason names `helper-next --change <id>` (which records the wait or the `stopping` end and releases
  the claim) and `helper-release` for a drive that cannot go on. Otherwise it is allowed: while a
  background stage agent or review round of its claim runs (every hand-off of a tick is in the
  background, and its completion notice wakes the session; probe 2 saw no stop hook refuse such a
  turn's end, `stop_hook_seen`), after a drive that ended at a delegated gate (a later tick's sweep
  records it), with nothing claimed, and on a repeat with nothing changed.
  With no `task` and no `ended` the existing rules hold unchanged.
- `roadmapAgentDecision`: with `task` recorded, the typed session's hand-offs are refused (reason
  `conducted`); a tick's session is allowed a role of its claimed change's script (the triage, the
  stage roles, the review round's reviewers and verifiers on the `agents` path), or
  `devkit-core:codebase-researcher` for the precheck (D-22), the brief naming that change, else
  refused naming the claimed change; a tick's session with no live claim hands nothing. There is no
  helper agent to allow. Subagents' own hand-offs stay allowed, and `roadmapSubagentStopDecision`
  judges each stage agent against its change as today, so a stage agent that stops without its stage
  file is refused once, handed again a model up, then ends `role-failed` (ADR 0023 decision 5).
- `guard.mjs`: `ENTRY_SKILL`, `namesEntrySkill`, `skillEntry`, `START_LINE` and the `skill` mode go,
  with the `PreToolUse` `Skill` entry of `hooks.json`; the `lock` dispatcher's
  `changeSessionStopDecision` branch goes (a stop outside a roadmap run is the change loop's).
  `startedTaskOf`, `STARTED_BY_SESSION` and `firstMessageOf` stay (ADR 0014 decision 4 and the child
  phase sessions of ADR 0006 still read the started form). `classify` gains
  `openspec/standing-answers.md` as owner-only (D-8), and the rule that a tick's session writes a gate
  file or a delegated answer only after its sweep's `record-delegated` action for that change and
  gate.

### D-12 What is removed (AC-10)

| Removed | Where | Replaced by |
|---|---|---|
| `mintTicket`, `withTicket`, `ticketLabel`, `entryDecision`, `ENTRY_REFUSALS`, the ticket block of `decide` | `roadmap-loop.mjs` | the claims (D-2, D-6) |
| `tickets`, `changeSessions`, `startedSessions`, `turn`, `cron`, `check`, `TICKET_FORM`, `readUpfront`'s ticket and check parts | `run-file.mjs` | `task`, `queue`, `claims`, `holds`, `ownerWaits` |
| `sessionStartOf`, `remoteSessionStartOf`, `sessionBackground` (`roadmap-loop.mjs:247-256`, the brief that tells a change session to call `devkit-session`), the `session-start`, `session-found`, `session-refused`, `session-archived`, `session-archive-later`, `session-model`, `session-model-refused` keys, the `archive-session`, `stop-own-tasks`, `wake` and `session-model` actions, `--turn` | `roadmap-loop.mjs` | none |
| `CHECK_CRON`, the `devkit-roadmap-check:` prompt, `schedule-check`, `delete-check`, `checkCmd`, the verb `check`, `--cron`, `--check-id`, `--check-refused`, `--check-deleted`, `--check-gone` | `roadmap-loop.mjs` | the scheduled task (D-5) |
| `session-next`, `session-wait`, `sessionNextCmd`, `sessionWaitCmd`, `changeSessionStopDecision`, `--change-sessions` | `roadmap-loop.mjs` | `helper-next` (D-7) |
| `sessionMode` and `started` of `runFactsOf`, the `own` entry state | `change-loop.mjs`, `roadmap-loop.mjs` | the claims and holds |
| the message keys of D-9 | `change-loop.mjs` | D-9's new keys |
| `ENTRY_SKILL`, `namesEntrySkill`, `skillEntry`, `START_LINE`, mode `skill`, `PreToolUse` `Skill` | `guard.mjs`, `hooks.json` | none |
| `plugins/openspec/skills/devkit-session/` | the skill | the tick's drive (D-7) |
| "A session per change", "Every change in this session", "The periodic check", item 1a | `skills/devkit/SKILL.md` | D-9's parts |

`placed`, `checkout`, `occupied`, `queued`, `anyway`, `waits` (its kind `session` goes, `github` stays,
`watch` is new), `holding`, `inflight`, `declared`, `announced`, `starting`, `stopping`, `asking`,
`held`, `session`, `places`, `version`, `updatedAt` stay. After the task, `grep -rn
'devkit-start:\|ticket-unknown\|devkit-roadmap-check:' plugins/` prints nothing, test files included
(the tests that held those literals are rows of D-15), and so does `grep -rln 'devkit-session'
plugins/` (today: `roadmap-loop.mjs`, `guard.mjs`, `roadmap-loop-fixtures.mjs`, `README.md`, the
devkit skill, the `devkit-session` skill and four test files, each a row above, of D-9, D-15 or D-16).

### D-13 The machines: the split by the pushed branch (ADR 0020, AC-21)

Conservative by design (`ADR [helper-conductor]` decision 10 as revised; `proof/p0-delete.md`): a
machine the app reaches as an SSH host (`avel`) cannot hold a scheduled task, so it runs no
conductor. Its changes are claimed and driven by the conductor on the owner's machine through the
pushed branch, or not at all; no step ever runs on another machine from this one.

- **A tick opens every item on this machine.** In a conducted run, `open` never takes `--machine`:
  the placement of ADR 0020 decision 3 over the `machines` setting (the fewest open changes) is not
  used, and a loaded machine holds the item (the `load` hold) instead of placing it elsewhere. The
  `machines` setting is still read, for the board's machines block and for the claims on `origin`.
  `remoteSessionStartOf` goes, and the conductor no longer calls `checkout`; the verb stays for the
  owner's own use (requirements, question 2).
- **The push after open.** Right after `open` the drive's first step pushes the change's branch
  (`git push -u origin <id>`, the `push` step with `--what open`, a new value beside `grill` and
  `plan`); a failed push is said once and tried at the next tick. The claim on `origin` (ADR 0020
  decision 1) names this machine.
- **A change claimed by another machine.** An item of the queue with no local folder whose claim on
  `origin` names another machine (a change opened there by hand, or by an earlier run) gets the hold
  `elsewhere` with `recheckAt` 30 minutes, which the tick writes itself: no drive, no worktree, no
  place taken. At `recheckAt` the hook passes (D-3 rule 5) and the tick fetches and reads the claim
  again: still that machine's → a new `elsewhere` hold; released (no claim keys on the branch) or
  stale as ADR 0020 reads it → this machine claims it, fetches `origin/<id>`, runs `git worktree add
  .claude/worktrees/<id> <id>` from it (the `checkout` code's local part, `worktreeOn`, reused) and
  drives it as its own.
- **Another conductor.** A second machine that can hold a task (the owner's other desktop, where the
  owner typed `/devkit roadmap`) runs the same rules: it opens only unclaimed items and takes over a
  released or stale claim from the pushed branch; the claims on `origin` keep the two apart.
- The places of this machine are counted over its run file's held places; a change claimed by
  another machine fills none of them.

### D-14 The models of a tick (stage-models)

There is no helper agent to start on a model, so the session floor function and `helperModel` are
not written, and the step-down actions go (D-12). The tick's session runs on the model the host
starts the task's session on (the task's own setting in the app); the stages it performs itself
(`SESSION_RUN_STAGES` of `change-loop.mjs`: requirements, approval, review, delivery, retro) run on
it, and task 3.6 records which model that is. Each stage agent it hands gets its stage's model from
the action, as a lone change's Loop passes it, with any `[1m]` dropped on the Agent call (ADR 0023
decision 5's retry a model up unchanged). No action of a conducted run switches a session's model.
`SESSION_RUN_STAGES`' comment stays as it is.

### D-15 Tests

New test files, each in `scripts/test-map.json` (`files` keys for the new modules, and the new
scripts linked; `slow` for `roadmap-loop-conductor.test.mjs`):

| File | Covers | Names start |
|---|---|---|
| `plugins/openspec/hooks/roadmap-loop-conductor.test.mjs` | D-2, D-3 (with `localFacts` against `runFilePath` and `listWorktrees` on a fixture repository: a main checkout, two worktrees, one removed folder), D-5, D-6 (the end recorded, no removal call), D-7, D-8 (verbs), D-11 (the tick's stop and hand-off with `task`), D-13, D-14, D-18 to D-23, D-25 (the caps recorded, the brief sentence, the places, the train's hold of the gates) | `conductor AC-<n> ` |
| `plugins/openspec/hooks/tick-gate.test.mjs` | D-4, the hook run as a process with a fixture payload copied from `proof/p2-result.md`, on a fixture repository with a main checkout and a linked worktree, with a `PATH` whose `git` and `gh` exit 1 | `tick-gate AC-3 ` |
| `plugins/openspec/hooks/request-file.test.mjs` | D-17's shape, the refusals, the 12-line summary, the answer's parse | `request AC-14 `, `request AC-16 ` |
| `plugins/openspec/hooks/standing-answers.test.mjs` | D-8's parser: no file, empty, two sections, an unknown gate, a delegation with no quote, a closed fence, an unclosed fence | `standing AC-6 `, `standing AC-8 ` |
| `plugins/openspec/hooks/test-slots.test.mjs` | D-25's ledger and `test-run`: one whole suite at a time, the train first, the gates cap, a dead pid dropped, a broken ledger, two clones sharing the ledger, no slot outside a conducted run, the exit code and the release on a signal | `capacity AC-22 ` |

D-25's pull request whose files are all under `openspec/` is tested in the existing
`plugins/openspec/hooks/delivery-train.test.mjs` (names `train AC-22 openspec-only `), on its
fixtures of a train project, and D-9's `review-change` sentence in
`plugins/core/skills/review-change/scripts/review-round.test.mjs` (names `review-round conductor `),
after a grep of that file for the "Which path runs" sentence it may pin.

`scripts/test-suite.mjs`'s ceiling (D-25) is tested in the existing
`plugins/openspec/hooks/test-suite.test.mjs` (names `suite-capacity AC-22 `), and the caps' recording,
the brief's sentence and the places' count in `roadmap-loop-conductor.test.mjs` (`conductor AC-22 `).

Every new test is written first and seen failing. Each new fixture builds its run file and folders in
the test's temporary folder (ADR 0026) and reads no git history.

The pinned tests. Rule per class: **R** the test's subject is removed (D-12): delete the test;
**M** the subject survives under the conductor (place, load, dependency, merge of the base, push,
budget, held words): rewrite it to drive `helper-next` or `tick` with the same invariant; **E** the
test builds a removed field or names removed text only in a fixture or a list: edit the fixture or
the list; **K** the grep matched `sessionTitle`, which stays for a lone change (ADR 0017): keep as it
is. Each commit that touches a test names its invariant, its layer and its suite (CLAUDE.md). A test
the implementer's own grep finds that this table lacks is classified by the same rule and added to
the table in the same commit.

| File | Test | Class |
|---|---|---|
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: a stale wait is killed and the newest of each kind kept | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: a freed place goes to the first queued change, and one with no live wait gets its idle line | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: its actions are only triage, archive-session, push and delete-check, and it starts no session on its event turn | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: nothing changed prints no line and no end reply | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 decide: an archived line with a recorded session kills its recorded waits, then gives archive-session with its reason until session-archived is reported | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 next: --after <id>=session-archive-later keeps the entry, asks no second archive in that decision, says the line once, and a later decision asks again | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-15 decide: the end done gives delete-check, archive-session per kept session and stop-own-tasks, and decide kills every recorded wait | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-15 decide: a stop kills only stale waits and keeps the sessions of changes that go on | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-15 lock stop: a cleanup action left refuses the end of the turn once | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-9 next: start anyway records the changes queued by the load now, and a change queued later is held again | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-13 skill: the periodic check names CronCreate, CronList, CronDelete, archive_session and TaskStop, re-creates a missing check, and approves nothing | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-16 skill: no section before the Roadmap names a scheduling tool | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-4 lock agent: the coordinating session may hand requirements-triage with a brief naming an open change, and marks nothing under way | E |
| `roadmap-loop-upfront.test.mjs` | upfront AC-4 lock agent: a helper of the requirements stage is read from the flow the change is pinned to | E |
| `roadmap-loop-upfront.test.mjs` | upfront AC-4 lock agent: the triage with no brief is refused own-sessions | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-4 lock agent: the triage for a change not open is refused not-open | E |
| `roadmap-loop-upfront.test.mjs` | upfront AC-4 lock agent: the coordinating session's triage for a change on flow 1 is refused own-sessions | R |
| `roadmap-loop-upfront.test.mjs` | remote AC-12 probe: the probe itself answers with an error and exit 3 when the pack is missing, the file unreadable or the status fails | E |
| `roadmap-loop-upfront.test.mjs` | remote AC-8 next: this machine is skipped while loaded, and a start is held only when nothing can take it | M |
| `roadmap-loop-upfront.test.mjs` | remote AC-9 next: a placed change gets a session-start with its checkout, target ssh, host and the remote cwd, only on a typed turn | R |
| `roadmap-loop-upfront.test.mjs` | remote AC-9 next: the run file keeps placed, which another session keeps and --fresh clears | M |
| `roadmap-loop-upfront.test.mjs` | remote AC-11 next: a freed place gives one wake per state for the first waiting change | R |
| `roadmap-loop-upfront.test.mjs` | remote AC-11 next: no wake without session mode | R |
| `roadmap-loop-upfront.test.mjs` | remote AC-12 next: a silent machine gets no change, and its placed change no session | M |
| `roadmap-loop-upfront.test.mjs` | remote locks stop: no ssh from the stop hook, and a start only another machine could take does not refuse the stop | E |
| `roadmap-loop-upfront.test.mjs` | change-state AC-6 board parity: every entry kind of entriesOf keeps its block and its words | E |
| `roadmap-loop-upfront.test.mjs` | change-state AC-7 start: a change session starts with its state's title | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-10 session-next: every held action carries the state changeState derives, and its title and icon come from it | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-10 status: a held row is placed by the state's reason, in the queue with its words | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-10 command: the state command, session-next and the board agree on a change held for a place and one held for a dependency | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-12 next: ticks of tasks.md after the plan was pushed ask no second plan push, and an approval written again does | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-2 guard: guard.mjs skill lets another skill through without loading roadmap-loop.mjs, and refuses devkit-session when it cannot load | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 isWaitProcess: only a process started as roadmap-loop.mjs wait or session-wait is a wait loop | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: a live process that is not a wait loop, recorded as a stale wait, is spared and forgotten | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-15 decide: the end done spares a recorded pid that is not a wait loop and forgets it | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-9 check: a change that left the roadmap or was archived frees its place and its queue entry, and the change queued behind it takes the place | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-9 next: a coordinating decision prunes the places and queue entries of lines no longer open, and a run without a session per change keeps them | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: a triage heading inside a fence or with words after it gives the triage action, and a plain heading does not | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-9 lock stop: guard.mjs stop lets a claimed change session held for a place stop with a held log line, and refuses a session that did not claim the ticket | R |
| `roadmap-loop-upfront.test.mjs` | upfront AC-9 session-next: the place is decided again on the run file as read under its lock, so of two sessions only one takes the last place | M |
| `roadmap-loop-upfront.test.mjs` | upfront AC-1 entry: the real first message of a started session is read through its host note, background, Task line and task, refused for its hand-written task, and with the run's task put in refused for want of a start line and claimed with one | R |
| `roadmap-loop-upfront.test.mjs` | upfront ADR 0021: the documents follow | E |
| `roadmap-loop-upfront.test.mjs` | upfront merge placement: with the machines setting set a run with a session per change opens the waiting lines with the ready ones, a loaded machine opens none | M |
| `roadmap-loop-upfront.test.mjs` | upfront merge ticket: a session start for a change opened on another machine carries no ticket and the run records none | R |
| `roadmap-loop-upfront.test.mjs` | upfront merge check: the periodic check carries the machines setting it was scheduled with and refuses an unreadable one | R |
| `roadmap-loop-upfront.test.mjs` | upfront D-18 place: a change session of this machine on the run's ticket takes its place from occupied only, before and after its plan push | R |
| `roadmap-loop-upfront.test.mjs` | upfront D-18 place: a place of this machine frees when its change leaves the load stages, whatever its claim on origin, and nothing of it counts once archived | M |
| `roadmap-loop-upfront.test.mjs` | upfront D-18 place: a change of this machine whose ticket no session claimed keeps the remote-worker gate | R |
| `roadmap-loop-upfront.test.mjs` | upfront D-18 place: a claimed change does not wait for an unclaimed one, and the board's row then reads above the number | M |
| `roadmap-loop-upfront.test.mjs` | upfront D-18 docs: ADR 0021 names ADR 0020 in its Amends and a Note, ADR 0020 is amended by ADR 0021, and ADR 0010's Note and the config rule qualify the triage by flow | E |
| `roadmap-loop-followups.test.mjs` | followups AC-8 next: start anyway starts what is held now, and a change ready later is held and said again | M |
| `roadmap-loop-followups.test.mjs` | followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change's session in its worktree | R |
| `roadmap-loop-followups.test.mjs` | followups AC-13 run: --change-sessions is recorded, and a run without it keeps the stages in the session | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 run: a run from another session keeps the started change sessions and gives them no second session, and --fresh forgets them | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 next: a reported session start is recorded once, said once and never started again, and a change no longer open leaves the record | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 decide: a change in its own session counts as under way for the end of the run, and a stop ends the run with each change staying in its session | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 decide: a change archived in its session frees its place, and on the event turn its report starts, the next ready line gets its line and waits for the owner's next message | M |
| `roadmap-loop-followups.test.mjs` | followups AC-13 background: the brief names the change, its worktree and branch, the coordinating session, the person's language, the title rule and the archive line, and has at least 80 characters | R |
| `test-fixtures.mjs` | `putRun` (`test-fixtures.mjs:790-796`, a `shared` file of `scripts/test-map.json`): its run carries `changeSessions`, `startedSessions` and `turn` | E |
| `roadmap-loop-fixtures.mjs` | `SESSION_SKILL_PATH` and `SKILL_INPUT` (`roadmap-loop-fixtures.mjs:126`, `:145`), which name `devkit-session` for the class R tests only | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 lock agent: in a run with a session per change every hand-off of the coordinating session is refused and nothing is marked under way | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 lock stop: a change session to start on a typed turn is refused once, and every change in its own session lets the stop through | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 decide: on a turn nobody typed a start and a session start become one line each, said once, and on the owner's next turn they start | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 decide: the load eases on a turn nobody typed and the held change waits for the owner's next message with its line | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 next: a refused session start gives its line, records the turn as event and asks for no other start on that turn | E |
| `roadmap-loop-followups.test.mjs` | followups AC-15 next: a start that gave no session id is reported as session-refused, the line shows once and the change starts on the owner's next typed turn | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 next: --turn takes typed or event, refuses any other word (message and an empty word included) with exit 3 and the run file's bytes unchanged, and no --turn reads as event | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 decide: every withheld start has its line in the same decision or an announced one | M |
| `roadmap-loop-followups.test.mjs` | followups AC-15 lock stop: after a decision on a turn nobody typed the stop is let through | R |
| `roadmap-loop-followups.test.mjs` | followups AC-15 status: a line left for the owner's next message reads so in the queue, and an open change with no session says it starts at the next message | E |
| `roadmap-loop-followups.test.mjs` | followups AC-13 skill: the session-per-change part names the tools, the list check, the session keys and the turn, and hands nothing | E |
| `roadmap-loop-followups.test.mjs` | followups AC-14 skill: a change session renames its title from the sessionTitle of each next | K |
| `roadmap-loop-followups.test.mjs` | followups AC-15 skill: the turn's two words, event when in doubt or on another session's note, and next first on a typed turn | R |
| `roadmap-loop-followups.test.mjs` | followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4, and every field named there is held | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 entry: the run's own start of the change is claimed by the first session | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 entry: the session that claimed the ticket is let through again | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 entry: another skill is let through | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 entry: a started session with no start line for its change is refused | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 entry: a ticket the run does not record is refused | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 entry: a ticket another session claimed is refused | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 entry: an unreadable transcript or run file is refused | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-2 guard: guard.mjs skill exits 2 on a refusal, 0 on a claim, 0 under DEVKIT_BYPASS=1, and logs one line under DEVKIT_HOOK_LOG | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 ticket: decide gives each session start a fresh ticket recorded before it prints, keeps a claimed one, and withTicket adds the start line | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 run file: readRun reads tickets, occupied, queued, anyway, waits, cron and check, and drops a field of the wrong type | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 run file: decide keeps the tickets and started sessions of an archived line, and drops those of a line that left the roadmap | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 skill: devkit-session is model-invocable, names its change from the start line, and keeps the title rule and the archive line | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-7 session-next: the grill, the plan approval and the retro answers are held for the coordinating session with their stage icon | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-7 session-next: every other gate stays in the change session | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-7 session-next: the held approval goes on once approval.md is written | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-8 session-next: a plan stage waits for an unarchived dependency with ⏳ | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-8 session-next: the roadmap of the main checkout says which dependency is still unarchived | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-8 session-next: once the dependency is archived and not merged, the step merges the default branch | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-next: an implementation step claims a place and the delivery releases it | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-next: a blocked change in its implementation keeps its place | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-next: the archived end releases the place | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-next: no free place or a loaded machine holds the change with why place or load | M |
| `roadmap-loop-followups.test.mjs` | upfront budget session-next: at the cap a change session's session-next prints the budget end and keeps its place | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-next: a change outside a session-mode run gets the change loop's action unchanged | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-10 session-next: a held change is titled ⏳ <id> and a claimed one its stage icon again | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-1 session-next: prints devkit-run first, so runOf reads a change run | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 session-wait: exits with the new action when a place frees, records and clears its wait | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 lock stop: a claimed change session held for a place may stop | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 lock stop: with its place and a stage ready the stop is refused once | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 lock stop: a session that did not claim the ticket is judged as any change run | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-9 messages: the held and base-conflict messages exist in both languages and name no stage or step | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-3 decide: every pending line opens on a typed turn whatever the number, the load and the dependencies, each with its session | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-3 decide: on a turn nobody typed a pending line not open waits for the owner's next message with its line | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-3 decide: the line of a session just started names no count of places | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-3 status: the board lists every opened change, with held-place, held-load and held-after rows | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-4 decide: the grills of change sessions are asked in roadmap order, one change at a time, with their gate line | E |
| `roadmap-loop-followups.test.mjs` | upfront AC-7 decide: a plan approval and the retro answers of a change session are asked here, and a merge left to the owner is not | E |
| `roadmap-loop-followups.test.mjs` | upfront AC-12 next: a passed grill not on origin gives a push, the push commits and pushes requirements.md, and a plan approved gives the push of the plan files | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-12 next: after --after <id>=push the same decision asks no push, and a failed push exits 3 with its reply | M |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 decide: with cron and no check the decision asks for one, on any turn, and none while stopping or after a refusal | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 decide: the check's cron expression avoids minutes 00 and 30, recurring is true and no durable field is passed | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 decide: every end and a stop give delete-check when a check is recorded | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 next: --check-id records the check, --check-refused records the refusal with its line, --check-deleted clears it, also for a job already gone | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 next: --check-gone clears a recorded check and the same decision asks for a new one, but not after a refusal | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 run: --cron is recorded and asks for the check, and a run from another session asks for its own | R |
| `roadmap-loop-followups.test.mjs` | upfront AC-13 messages: the check's messages exist in both languages and name no mechanism | R |
| `stage-models.test.mjs` | stage-models AC-9 no action of the change loop has a kind that switches a session, and the loop names no session-model tool | R |
| `stage-models.test.mjs` | stage-models AC-9 the skill change sections name no session-model tool | R |
| `stage-models.test.mjs` | stage-models AC-10 with a session per change next reads no subagent folder and no transcript | R |
| `stage-models.test.mjs` | stage-models AC-6 a new change session starts on the model of its grill, the start input holding it beside context fresh | R |
| `stage-models.test.mjs` | stage-models AC-6 a change resumed at its implementation starts on sonnet, and an action with no model adds no model field | R |
| `stage-models.test.mjs` | stage-models AC-6 a reported session start records the model of the change stage, a reported found session records none | R |
| `stage-models.test.mjs` | stage-models AC-6 a session found running is the change own: no second start, no stage of its, one started line, at the three sites | R |
| `stage-models.test.mjs` | stage-models AC-6 a run file entry written before this change reads back as { at }, a model or a refused one is kept only when it is a model | R |
| `stage-models.test.mjs` | stage-models AC-7 a session on opus with its change at the approval gets one session-model to sonnet, on an event turn and on a typed one | R |
| `stage-models.test.mjs` | stage-models AC-7 after a reported switch the record holds the target and no switch follows, after a refused one the same target is not returned again | R |
| `stage-models.test.mjs` | stage-models AC-7 a session whose record holds no model is never switched | R |
| `stage-models.test.mjs` | stage-models AC-7 collectRoadmap reads the stage, the table and the script order of a change recorded with a model, only when asked to | R |
| `stage-models.test.mjs` | stage-models AC-7 next returns one switch for a session recorded on opus[1m] at its grill, takes the report as done and the refusal as final | R |
| `stage-models.test.mjs` | stage-models AC-7 a stopping run and the stop lock return no switch | R |
| `stage-models.test.mjs` | stage-models AC-7 the session-per-change part of the skill names session-model, session-found, session-model-refused and set_session_model | R |
| `stage-models.test.mjs` | stage-models AC-10 the flow document Troubleshooting table has the four model rows | E |
| `guard.test.mjs` | upfront AC-2 guard: startedTaskOf and firstMessageOf read only the first message's started form | R |
| `guard.test.mjs` | upfront AC-2 guard: namesEntrySkill reads the entry skill's name from any string field and nothing else | R |
| `change-loop-compozy.test.mjs` | change-loop skill: the sections of D-3 to D-9 and the modes of start | E |
| `change-loop-compozy.test.mjs` | upfront AC-1 guard: a started task followed by a start line still makes a change run | R |
| `change-loop-compozy.test.mjs` | upfront AC-1 guard: a started task after a note of the host makes a change run | R |
| `change-loop-compozy.test.mjs` | followups AC-14 next: every action of change-loop next carries the icon of its stage and its session title | K |
| `change-loop-compozy.test.mjs` | followups AC-14 title: sessionTitle is the icon and the id, cut under 60 code points | K |
| `change-loop-compozy.test.mjs` | upfront AC-16 next: no action of a change run asks for a schedule | E |
| `change-loop-compozy.test.mjs` | upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when the grill action's helpers name it | E |
| `change-loop-declared.test.mjs` | coordinator-loop-fixes AC-1 T12 the skills name reply waiting-pause and waiting-owner-decision, the decision never as what | E |
| `change-loop-declared.test.mjs` | coordinator-loop-fixes AC-6 T81 next with the unsubstituted language gives the pt-BR reply of the same action | E |
| `change-loop-declared.test.mjs` | coordinator-loop-fixes AC-11 T82 Waiting on GitHub holds the host-monitor paragraph after its first one; devkit-session item 3 the same exception | M |
| `roadmap-loop.test.mjs` | roadmap-loop run: U4 the same session keeps what is under way and changes the number; another session or --fresh starts from empty | E |
| `change-loop-remote-state.test.mjs` | change-budget AC-10 docs/openspec-flow.md describes the budget | K |
| `change-loop-remote-state.test.mjs` | change-state AC-4 facts: runFactsOf reads each field of the run file | E |
| `change-loop-remote-state.test.mjs` | change-state AC-7 next: every action carries its state and its sessionTitle is the state's title | K |
| `change-loop-remote-state.test.mjs` | change-state AC-1 command: nothing is written | E |
| `change-loop-remote-state.test.mjs` | change-state AC-4 command: a roadmap change with no session of its own is running, ready | E |
| `change-loop-remote-state.test.mjs` | change-state AC-4 command: a change off the roadmap gets no ready reason in a session-per-change run | E |
| `change-loop-remote-state.test.mjs` | upfront AC-10 facts: runFactsOf reads the change's queue entry, its place and its waitsFor, and no other change's | M |
| `change-loop-remote-state.test.mjs` | upfront AC-10 state: outside a run with a session per change a queue entry or a waitsFor gives no held reason | M |
| `change-loop-remote.test.mjs` | remote AC-10 next: with no free place the change ends waiting for a place, icon ⏳ | K |
| `guard.test.mjs` | upfront AC-5 skill: the grill rule of config.yaml and of the four schema files names the triage and forbids answering yourself | E: its `RULE` becomes D-9's rule; the grill skill's `- Answer a question yourself` assertion stays, the line now ending with D-9's words |
| `roadmap-loop-upfront.test.mjs` | upfront ADR 0021: the documents follow | E: `^- Status: accepted$` becomes `^- Status: superseded by ADR `, with no number (test files are outside the citation rewrite, `CITATION_PATHSPEC`) |
| `roadmap-loop-upfront.test.mjs` | the test at line 1715 that reads ADR 0021's two Notes and ADR 0020 | K: the Notes stay as written |
| `roadmap-loop-followups.test.mjs` | followups ADR 0014: the documents follow | K: the new `- Amended by` lines go after the existing ones, so its line matches hold; checked by running it |
| `roadmap-loop.test.mjs` | every `roadmap-loop lock stop: RS…` and `roadmap-loop lock agent: RH…` test | K: their run files record no task, so the legacy rules hold (D-11) |
| `change-loop-compozy.test.mjs` | every test of `compozy-start`, `compozy-tick`, `compozy-state` | K (AC-13): unchanged and run in the phase 5 gate |
| `guard.test.mjs` | stage-roles gates: an approved mock-up sets result=passed with the same attempt and the current commit, and records the owner's words | K: D-19 edits the `stop-plan-approval` and `stop-retro-answers` rows, not the mock-up row it reads; grepped for `up to 200 characters` and `cron-started run` at `6f03a57`, this is the one test that reads a `ship-change` row's words |
| `roadmap-loop-followups.test.mjs` | roadmap-loop setting: the load_limit user setting | E (D-25): the `userConfig` key list becomes `['language', 'load_limit', 'machines', 'test_gates', 'test_concurrency']`, and the two new entries are asserted as `load_limit` is (type, default `2` and `4`, a title, a description naming a whole number, `gatesOf`/`concurrencyOf` of the default); the skill-uses-a-declared-key loop holds |
| `test-suite.test.mjs` | the `BLANK_ENV` of `start` (every test that runs the script) | E (D-25): `BLANK_ENV` gains `DEVKIT_TEST_CONCURRENCY: ''`, so a suite run capped from outside changes no inner run; an empty value is ignored by the ceiling's rule |
| `test-suite.test.mjs` | suite-speed AC-1 files run at the same time up to --concurrency | K: with `BLANK_ENV` blanking the ceiling, `--concurrency=2` and `=1` behave as before |
| `guard.test.mjs` | setup AC-2 records: ADR 0026 notes the two moved suite folders and is amended by the setup record | K: the new `- Amended by ADR [helper-conductor]` line of ADR 0026 goes after its two lines; the test looks the setup line up among the header's lines, and the record's Amends line it matches is the setup record's |
| `release-note.test.mjs` | release-note AC-14 texts: …, its subtest "records: ADR 0022 and ADR 0025 are amended, ADR 0003, 0027 and 0030 are not" | K: its `^- Amended by <ADR 0034> \(...\)$` match is multiline over the header and finds its line among the others |

The pin rule for the records (D-16): before a task adds a `- Amended by` or `- Status:` line to an
ADR, it greps the test files for that ADR's file name and for anchored patterns on its header
(`^- Amended by`, `^- Status:`, a regex ending in `$`); the rows above are the result at `6f03a57`,
ADR 0022's and ADR 0026's file names included (`guard.test.mjs`, `release-note.test.mjs`,
`change-loop-declared.test.mjs`, the last citing ADR 0022 decision 8 in a fixture string only: K).
`openspec/config.yaml`'s ADR list is not edited by this change (its `amended by <n>;` entries are the
delivery's, once the record has its number), so the guard test that reads ADR 0026's entry there holds.

### D-16 The records and the docs (AC-12)

- `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`: `- Status: superseded by ADR
  [helper-conductor] (helper-conductor.md)`.
- `- Amended by ADR [helper-conductor] (helper-conductor.md)`, after the last `- Amended by` line of
  the header, in ADR 0004, 0006, 0010, 0011, 0013, 0014, 0017, 0020, 0022, 0023 and 0026 (the
  record's Amends list), and in ADR 0008 (decision 1 for a roadmap run: the review round's Workflow
  from the tick's session, D-1); ADR 0013 also
  gets D-2's Note.
  ADR 0022 is amended in decision 4 (the tick dispatches the train, D-21) and ADR 0026 in decision 1
  and its Negative consequence's mitigation (the cap, D-25).
- `docs/openspec-flow.md`: the roadmap paragraphs "Opening every change at the start", "The periodic
  check and the cleanup", "What it decides and says" and "The locks" are rewritten for the conductor
  (the task, the tick, the gate, the tick's drive, the lines, the standing answers, the end the owner
  deletes the task at); `docs/coordination-design.md`'s
  paragraph "Opening every change at the start" gets a dated line saying `ADR [helper-conductor]`
  supersedes it and how a run goes now; `docs/roles.md`'s coordinator row names the tick's session
  and its drive of one claimed change; `plugins/openspec/README.md` drops the `devkit-session` rows and the `Skill` hook row and
  adds `tick-gate.mjs`, `standing-answers.mjs`, `test-slots.mjs`, the two settings of D-25 and the
  tick's drive (the hook's note, the run detection by the envelope); `docs/openspec-flow.md` also gains the test capacity (the caps, their settings, `test-run`,
  the ledger) in its roadmap part; `docs/catalog.md` is regenerated with
  `python3 scripts/gen-catalog.py`.
- No task numbers the record, bumps a version, writes `CHANGELOG.md` or moves a CI pin: `release.md`
  holds the release, and the delivery writes them at the merge (ADR 0034).

### D-17 The request files (AC-14)

`openspec/changes/<id>/requests/<n>-<slug>.md`, `<n>` counting from 1 in the folder, `<slug>` the
gate id or `decision`. Written by the helper through `roadmap-loop.mjs request --change <id> --gate
<g> --file <scratch path>` (the CLI copies a file the helper drafted in the session's scratch folder,
checks its shape and writes it), never by hand. Shape, each heading required:

```
<!-- devkit-request gate=<g> at=<ISO time> -->
# Request <n>: <one line>

## Question
## Facts
## Recommendation
```

The answer is `requests/<n>-<slug>.answer.md`: `<!-- devkit-answer by=<owner|delegated> line=<the
standing answer's line, or none> at=<ISO time> -->`, then `## Answer` and the words. It is written by
`roadmap-loop.mjs answer --change <id> --request <n> --by owner|delegated [--line <k>] --words <text>`
only: the owner's typed answer in the typed session, or a tick's delegated answer (D-8). The guard
classes `requests/*.answer.md` as main-session only, as it classes `approval.md`. `owner-wait` (D-7)
becomes `request` plus the owner line: every line for the owner names its request (`ownerWaits[id].request`),
and the grill's questions are the request's `## Question` list. A request whose gate the standing
answers delegate gets no owner line: the hold is `delegated`. A request file never leaves the
change's folder; on another machine it reaches this one only through the change's pushed branch
(the board reads it there with the claims). Parser: a request missing a heading, or with an
unclosed fence, is refused by `request` with exit 3 and the heading it lacks; an answer file that does
not parse reads as no answer.

### D-18 The sweep of a tick (AC-15)

`tick` (D-6) gains a step before its rule 2, in one call: for each id of `run.queue` with no live
claim, read its state with `change-loop.mjs`'s `changeState` (the state command's function, with the
GitHub reads the state command makes) and update its hold: a `github` hold whose wait ended is
dropped, a change archived gets `archived`, a boarded one `boarded`, a stale claim is deleted (the
change then has no hold and is claimable). Then every request with no answer whose gate is
delegated is answered (`record-delegated`, D-8). Then the claim. "Resumes one that stopped with work
left": a change with no claim, no hold and a ready next action is claimable by rule 5 of D-3.

### D-19 The plan approval's summary and its words (AC-16)

When `helper-next` reaches `stop-plan-approval`, the helper writes the request of D-17 with a
`## Summary` section in place of `## Facts`: at most 12 non-blank lines, naming what is built, the
acceptance criteria ids, the records of `decisions.md`, the files, and the risks. `request` refuses a
summary of more lines (exit 3, `summary-too-long`, the count), so the helper writes it again. The
typed session shows the summary as the approval's question; `answered` writes `approval.md` through
the `stop-plan-approval` row with the owner's words (or the delegated words of D-8) cut at 200
characters, as the row already says ("up to 200 characters"); `answer` cuts its `--words` at 200 for
the approval gate too. The `ship-change` rows `stop-plan-approval` and `stop-retro-answers` gain: "In
a conducted roadmap run the summary is the request's `## Summary`; a delegated gate is written by the
tick's session with the words `delegated to <who> in openspec/standing-answers.md:<line>:
"<quote>"`", and the row's sentence "Never write it ... from a cron-started run without the owner's
message" ends "..., except a gate the standing answers delegate by name, recorded by the tick's
session as above".

### D-20 The sibling order (AC-17)

`roadmap-loop.mjs siblings --change <id>` prints the queued changes whose `tasks.md` names, in
backticks, a repository path that `<id>`'s `tasks.md` also names (paths that exist at the base, or
under `plugins/`, `docs/`, `scripts/`, `openspec/specs/`), with the shared paths. Unterminated input:
a missing `tasks.md` names no path; an unclosed backtick ends the line's scan. When it prints any,
the approval (typed or delegated) adds one line after `- Owner's words:`: `- Siblings: <b> (<first
shared path>[, +<k> more]); order: <the owner's order, else "the second to reach its pull request
merges the base first">`, cut at 200 characters. `approval.md`'s readers (`deliver-check.mjs`, the
`approval` header check) read only the lines they name, so one more line changes no checker answer;
a conductor test pins that.

### D-21 The train's dispatch (AC-18)

`helper-next` maps the boarded end (`waiting-for-owner` with the reason `boarded`, which the loop
gives in a train project) to the hold `boarded`, not to an owner line. `tickReady` gives `@train`
before any change (D-3 rule 4a); `tick` then claims `train.claim` (same live and stale rules) and
prints `{ claim: { train: true, root } }`. The tick's session drives `train-loop.mjs` itself, as the
`## Train` part of the devkit skill does for `/devkit train`, up to the train's end, records it
with `train-end --kind <k> [--change <id> --why <w>]...` and releases the claim in that one
`updateRun`. The train's ends (`train-loop.mjs`'s `result` and `left`, `train-loop.mjs:346-400`):

| Train end | Recorded | Next |
|---|---|---|
| departed, its pull request's checks running | `train.hold = { kind: 'github', at, recheckAt: now + 10 min }` | the sweep (D-18) reads the pull request; its merge archives the boarded changes |
| merged | `train.hold = null`; the boarded changes get `archived` from the sweep | rule 4a dispatches again only for a change boarded since |
| needs the owner (a `trunk` model's merge) | `ownerWaits['@train'] = { gate: 'merge', … }`, `train.hold = { kind: 'owner', at }` | `answered --change @train --gate merge` clears both, as for a change (D-8) |
| `base-red` (the base itself fails) | `ownerWaits['@train'] = { gate: 'decision', questions: ['the base is red'] }`, `train.hold = { kind: 'owner', at }` | the same; no train is dispatched while it stands |
| a change left with `why: red` (the bisection named it) | that change's `boarded` hold becomes `blocked` with `params.why: 'train-red'`, and its owner line of gate `decision` (D-7) | the others depart on the train as `train-loop.mjs` builds it |
| a change left with `why: conflict` | that change's `boarded` hold is deleted | the next tick claims it, and `helper-next` merges the base as for any change |

`readRun` keeps the `@train` key of `ownerWaits` beside the change ids; `answered` and `pushed` accept
`--change @train`. The tick
dispatches a train only while no `train.claim` is live, so "a change that boards while a train runs
waits for the next" (ADR 0022 decision 4) holds. `ADR [helper-conductor]` decision 12 amends ADR 0022
decision 4 for a conducted run only: a run file with no `task` dispatches nothing, and outside a
conducted run the train departs only on a typed `/devkit train`. The train's `depart` and
`update-train` commands run inside the whole-suite slot of D-25 with the train's priority: the tick's
session runs `detail.command` as `roadmap-loop.mjs test-run --train --kind suite -- <detail.command>`, with the
Bash tool's background option as the `## Train` part says.

### D-22 The check before an opening (AC-19)

When the decided action of a queued item is its opening (`start`), the helper's first steps are
`roadmap-loop.mjs precheck --change <id>`, which runs locally `git branch --list <id>` and, with the
network, `git ls-remote --heads origin <id>`:

- A branch here or on `origin` holding `openspec/changes/<id>/` → `{ reuse: <ref> }`: the helper adds
  the worktree from it (the `worktreeOn` path) and goes on from its files; no `open` runs.
- A branch with no change folder → `{ blocked: 'branch-taken' }`, the existing blocked reason.
- None → `{ check: 'delivered' }`: the helper hands `devkit-core:codebase-researcher` the roadmap
  line's text with the brief "Does the code at the base already deliver this? Answer `delivered` with
  the file and line that show it, or `not-delivered`". On `delivered`: `roadmap-loop.mjs skip --change
  <id> --source <file:line>` records the hold `skipped` and a request with gate `decision` (the owner
  confirms, then ticks or removes the line; dependents wait for the archive, as `after:` reads only
  the archive). On `not-delivered`: `open` as today, then the push of D-13.

### D-23 The escalation's re-hand (AC-20)

When a planning stage agent ends with an escalation (the stage file not delivered, its report naming
the question, the existing `blocked` end with the reason `not-delivered`), `helper-next` records the
hold `escalated` and the helper writes the request of D-17 with gate `decision`, the escalation's
question, the facts it cites and the planner's recommendation; the hold names the request. Its answer
(the owner's, or a delegated one) is written by the answering session into the answer file and, as a
new item, into `requirements.md` under `## Reopened` (`- <question> → <answer> (source: requests/<n>-…
.answer.md)`), both in one `answer` call. `tickReady` makes the item ready once the answer file exists and
`requirements.md` holds the `## Reopened` item that names it (`ADR [helper-conductor]` decision 3); the tick deletes the hold
and its helper's first call is `helper-next` with no `--after`, which hands the stage again from the
files (the loop's plain `next`, as the field fact 9 observed).

### D-24 What the host still has to show

Probe 2 (task 1.3, `proof/p2-result.md`) settled the envelope, the prompt form, the background
hand-offs, the Workflow and the run's status; the phase 3 real run (task 3.6) measures what D-1's
table still leaves open (the blocked firing's cost, the hook's note in the session, the hook's
payload form, two runs at once); the cron, the notification tool and the model of the task's session come from task 3.6.
Nothing else of D-17 to D-23 and D-25 depends on the host.

### D-25 The machine's test capacity (AC-22)

`ADR [helper-conductor]` decision 13 (field fact 11: load 124 on a 14-core machine, from two whole
suites at concurrency 14 and four gates; field fact 12: train 22 ran two 25-minute whole suites for an
archive pull request of `openspec/` files only, ended red with no failure text while five gates
loaded the machine). It amends ADR 0026 decision 1 and its mitigation "the runner's concurrency
follows the core count", and ADR 0022 decisions 2 and 5 for an `openspec/`-only pull request, for a
conducted run only.

- **The caps and their defaults.** `capacity = { suites: 1, gates, concurrency, at }`. `suites` is
  always 1: decision 13 fixes it, and no setting changes it. `gates`, the selective runs in flight at
  once, defaults to 2 (a whole number from 1 to 16); `concurrency`, the files at once of each run,
  whole suite and gate alike, defaults to 4 (a whole number from 1 to 64). At the defaults at most
  (1 + 2) × 4 = 12 test files run at once on the machine, below the 14 logical cores of field fact
  11's machine and about one per core on the 8-core machine `CLAUDE.md` times the suite on.
- **How the owner changes them.** Two new settings of the devkit-openspec pack beside `load_limit`, in
  `plugins/openspec/.claude-plugin/plugin.json` `userConfig`, strings as `load_limit` is:
  `test_gates` (title `Test gates at once`, description `How many selective test runs (gates) of a
  /devkit roadmap run may run at once on this machine: a whole number from 1 to 16`, default `2`) and
  `test_concurrency` (title `Test files at once`, description `How many test files each test run of a
  /devkit roadmap run may run at once (its --concurrency): a whole number from 1 to 64`, default
  `4`). `gatesOf(value)` and `concurrencyOf(value)` are exported from `run-file.mjs`, beside
  `limitOf`, which this change moves there from `roadmap-loop.mjs:66` (D-3; `roadmap-loop.mjs`
  re-exports it), and follow its rule: they give the default for anything else, an unfilled `${user_config…}` included, with no word to
  the owner. The devkit skill's `run` call carries `--test-gates ${user_config.test_gates}
  --test-concurrency ${user_config.test_concurrency}`, and the skill's settings list names both. The
  owner changes a cap in the app's plugin settings and types `/devkit roadmap` again in any session of
  the clone; `run` writes the new `capacity` and the next tick reads it. Not a run argument: the run's
  words are `multi-roadmaps`' (`<name> [round <k>] [<n>]`), and a cap is a fact of the machine, not of
  one run.
- **The slots ledger.** One per machine, not per run file, so two clones on one machine (field fact
  10's second clone) share it: `$XDG_STATE_HOME/devkit/test-slots.json`, under
  `~/.local/state/devkit/` when `XDG_STATE_HOME` is unset (`DEVKIT_STATE_DIR` names the folder instead,
  for the tests and the proofs), read and written by the new module
  `plugins/openspec/hooks/test-slots.mjs` under `withLockFile` (`change-loop.mjs`) with the lock
  `test-slots.lock` beside it, `{ stepMs: 100, waitMs: 5_000, staleMs: 60_000 }`. Shape:
  `{ version: 1, suite: { owner, pid, clone, at } | null, trainWaiting: { pid, clone, at } | null,
  gates: [{ owner, pid, clone, at }] }`, `owner` a change id or `@train`, `clone` the main root.
  Every read drops an entry whose `pid` is not alive (`process.kill(pid, 0)` throws `ESRCH`); a
  missing ledger, or one that does not parse, is an empty ledger.
- **`roadmap-loop.mjs test-run (--change <id> | --train) --kind suite|gate -- <command>`.** It reads
  the clone's run file: with no run file, or one with no `task`, it runs the command at once with no
  slot (a lone `/devkit change` is not capped, as decision 13 scopes the cap to a conducted run).
  Otherwise it reads `capacity` (D-25's defaults when null) and, every 15 seconds until a slot is
  taken, under the ledger's lock:
  - `--kind gate`: takes a slot when the live gates are fewer than `capacity.gates`, no live
    `trainWaiting` is recorded and `suite` is not the train's (`suite.owner` `@train`): while a train
    departs, no gate starts on the machine (field fact 12);
  - `--train --kind suite`: takes the slot when `suite` is null and no live gate is recorded; else
    writes `trainWaiting` with its own pid, so no change's whole suite and no gate starts meanwhile,
    and waits only for the runs already started to end;
  - `--change <id> --kind suite`: takes the slot when `suite` is null and no live `trainWaiting` is
    recorded.
  Its first wait prints one line on stderr, `devkit-test: waiting for a whole-suite slot (<owner>)`,
  `devkit-test: waiting for a gate slot (<n> of <g> in flight)`, `devkit-test: waiting for the
  train's suite` (a gate or a change's suite held by the train) or `devkit-test: the train waits for
  <n> test runs to end`, and later rounds print nothing. With
  the slot taken (its entry's `pid` is `test-run`'s own, which lives as long as its child), it clears
  its `trainWaiting`, runs `sh -c <command>` in its cwd with `DEVKIT_TEST_CONCURRENCY=<concurrency>`
  added to the environment and stdio inherited, removes its entry under the lock when the child exits
  or on `SIGINT`/`SIGTERM`, and exits with the child's code (128 plus the signal's number for a
  signal). A `test-run` killed with `SIGKILL` leaves a dead pid, which the next read drops.
  Unterminated input: no `--` or an empty command is a usage error, exit 3, nothing taken.
- **The ceiling in the repository's runner.** `scripts/test-suite.mjs` reads
  `DEVKIT_TEST_CONCURRENCY`: a whole number from 1 makes the run's concurrency the smaller of it and
  the `--concurrency` given (or `availableParallelism()`); any other value, the empty one included, is
  ignored. The `suite:` line already prints the concurrency used, so the evidence row shows the cap.
  A project whose runner reads no such variable gets the cap from the brief's flag alone.
- **The brief's cap.** In a conducted run, `helper-next` appends one sentence to every `agent`
  action's `brief`: `Tests on this machine are capped by its devkit roadmap run: run every test
  command through node <hooks>/roadmap-loop.mjs test-run --change <id> --kind gate -- <command>, a
  whole-suite run with --kind suite, and give the test runner at most <c> files at once
  (--concurrency=<c>).`, `<hooks>` the pack's hooks folder and `<c>` the capacity's concurrency. The
  drive's rules (D-7), the train's drive (D-21) and the tick's part of the skill (D-9) carry the
  same rule. The sentence is fixed for fixed caps, so `handOffKey` of a retried brief stays stable
  while the caps do.
- **An `openspec/`-only pull request boards no train.** In a conducted run of a project with a
  delivery train, a pull request whose every changed file is under `openspec/` (an archive, a roadmap
  edit, a change with no file outside `openspec/`) does not board: `collectState` of
  `plugins/openspec/hooks/deliver-check.mjs` leaves the `train` facts out (`deliver-check.mjs:3099`
  for the archive, `:3152` for the change) when the run is conducted and `prFiles` (`:788`, paginated)
  of the open pull request lists no path outside `openspec/`, and records `openspecOnly: true`. The
  conducted fact is `conductedOf(root)`, new in `guard.mjs`: the file at `localRunFilePath(root)`
  (D-3) parses and holds an object `task`, read with `node:fs` only; any error is `false` (the train
  path, as today). `nextStep` then takes the path of a project with no train: under `trunk-auto`,
  `enable-auto-merge` then `wait-merge`, so GitHub merges it on its required checks (`check`,
  `devkit-reviews`); under `trunk`, `archive-pr-ready` (or the change's merge step) for the owner, a
  line like any gate's. No step sends it to `update-branch` beyond what that path already does.
  `boardedSet` (`train-loop.mjs:261`) reads each pull request's step through the same `nextStep`, in a
  scratch worktree of the same clone (so `localRunFilePath` finds the same run file), and never
  boards one either. Outside a conducted run nothing changes: such a pull request boards as
  ADR 0022 decision 2 says.
- **The places count test load.** The run's places already count only the changes whose stage holds
  a place (D-3's `heldPlaces`, the `run.occupied` entries of open changes, written for the parts of
  `LOAD_PARTS`: the implementation, a test stage, the evidence, the review), whether a
  helper runs or not: a change at its review waiting on GitHub with no helper holds its place, and a
  helper at a grill or a plan holds none. Decision 13 makes this count the capacity's count of
  changes; no field is added, and a conductor test pins both sides.

### Alternatives considered

| Option | Why not |
|---|---|
| A model-invocable `devkit-tick` skill with a guarded entry (no slash command in the prompt) | The `devkit-session` pattern this change removes; the coordinator's decision on probe 2 adds no entry skill (D-1) |
| The prompt naming the pack's absolute path and the `tick` call | The path changes with each pack version, and no session may edit the task (`proof/p0-delete.md`); the hook's note names the live path at each firing |
| A nested agent helper (`roadmap-helper`) between the tick and the stage agents | Nesting works (`proof/p2-result.md`, `nested_agent`) but is not needed, and every hop is one more background notice: the tick's session hands each stage one level below it, as a lone change session does (`proof/decision.md`) |
| A Workflow helper driving the whole change | ADR 0008 keeps the Workflow tool to the review bench; a long-lived script would hold the change's state in one session |
| The task deletes or pauses itself at the end | The host refuses an unattended delete, pause or run (`proof/p0-delete.md`); the hook's block after the end costs nothing, and the owner deletes the task with one click |
| Every `openspec/`-only pull request skips the train, conducted or not | `ADR [helper-conductor]` decision 13 scopes it to a conducted run; outside one ADR 0022 decision 2 stands |
| The hook writes a "tick passed" record that the `tick` verb checks | `ADR [helper-conductor]` decision 2: the hook reads only; the `tick` verb's rules (no task, no claim) already make an owner-typed tick harmless |
| A background keepalive process renewing the heartbeat | A process that outlives a killed helper keeps its claim live; a heartbeat per `helper-next` call with a two-hour bound is simpler and loses at most two hours |
| Remove `decideRoadmap`, `next` and the legacy locks now | The tick reuses the decision core; the legacy rules serve a run file from before the change; removing them doubles the test churn |
| The typed session runs the first tick itself | The tick's session is the one place hooks scope a claim to; the first firing comes within five minutes |
| One line per grill question | AC-7 asks for one line per gate; the questions are the line's list |
| The caps as words of `/devkit roadmap` (`gates=2`) | The run's words are `multi-roadmaps`' grammar; a cap is the machine's, and a setting outlives the run |
| The caps scaled from the core count (half the cores) | Field fact 11 is a machine at its core count crawling; fixed conservative defaults the owner raises are the safer start, and the record names "values the run file records" |
| The slots kept in the run file | A run file is per clone; two clones on one machine (field fact 10) would each allow a whole suite |
| A `bash` guard refusing a test command not run through `test-run` | A project's test command cannot be matched reliably in a shell line (prefixes, pipes, scripts); the wrapper, the brief and the runner's ceiling instead |

## Risks / Trade-offs

- [A scheduled session does not load the plugin or its hooks] → P-1 and probe 2 showed it does
  (`session_start_hook`, `session_start_seen`).
- [The block does not prevent the model call] → task 3.6 measures three blocked firings with the real
  hook; a model call is a stop-and-revise case before phase 4; the record's review trigger.
- [The hook's note does not reach the firing's session (the host drops a `UserPromptSubmit`
  `additionalContext` in a task's session)] → task 3.6 checks it before phase 4; a note that does not
  arrive is a stop-and-revise case (D-1), and the prompt's second line makes such a session end at
  once (one model call per firing, no wrong step).
- [A firing while an earlier tick's session still drives] → a run's status is no lock
  (`proof/p2-result.md`); the claims under `updateRun` keep the two apart, and a conductor test runs
  two `tick` processes at once.
- [A drive's turns wait on notices] → every hand-off is in the background (probe 2); the claim's
  heartbeat is renewed at each `helper-next`, and a notice that never comes leaves a claim stale
  after `CLAIM_STALE_MS`, which the next tick takes over (AC-5).
- [A tick's session grows a long context over one drive (a grill and a plan, or an implementation,
  its review and its pull request)] → every drive ends at its next wait (the plan approval, GitHub's
  checks), the stages' work stays in their agents, and the next drive is a new session reading the
  files; the host's compaction keeps a long drive going.
- [The Workflow does not run in a task's session, or its notice never comes] → the review round's
  `agents` path, `review-change`'s own fallback rows.
- [A task's session pauses for a tool approval] → the task is created on the owner's typed turn, so
  its approvals live on the task (`proof/p1-hooks.md`, host fact 2); task 3.6 records any pause.
- [A stage longer than two hours makes a live claim stale] → the heartbeat renews at every
  `helper-next` call, between stages; an implementation phase is one hand-off, so the bound is set
  above the longest phase the repository's evidence records (about 70 minutes); a takeover hands the
  stage again from the files, which the stage file headers make idempotent.
- [Two ticks take one claim] → every claim is one `updateRun` read and write under the lock (D-2); a
  conductor test runs two `tick` processes at once.
- [The owner never opens the typed session again] → `/devkit status` and the push show the lines; the
  task keeps ticking and costs nothing while idle.
- [The owner never deletes the ended run's task] → every firing is blocked by the hook before the
  model (D-3 rule 1); a later typed `/devkit roadmap` finds and reuses it (D-5).
- [A delegation recorded where none was meant] → only the owner writes the file (D-8's owner-only
  path); the gate file quotes the line; D-11 refuses a gate file a tick writes without its action.
- [Other plugins' prompt hooks call a model on the tick's prompt] → a block from any hook stops the
  prompt; task 3.6 measures with the machine's real plugin set, genesi included.
- [An agent runs its tests without `test-run`] → the brief says it at every hand-off; in this
  repository the runner's ceiling still caps its files when the variable is set by an outer
  `test-run`, and the evidence's `suite:` line shows the concurrency; the record's review trigger
  names a gate above the cap.
- [A capped gate is slower] → the defaults are the owner's to raise (D-25's settings); a whole suite
  at 4 files on an idle machine takes longer than at the core count, measured in phase 6.
- [The task fires in a project whose clone moved] → the hook compares the envelope's root with the
  payload's root and passes when they differ; the tick reply then says no run is under way.

## Migration Plan

- A run file from before the change keeps working: its removed fields are not read (D-2), its stop
  and hand-off rules are the legacy ones until `/devkit roadmap` is typed again, which installs the
  task.
- A change session still open from an older run stays a plain session: typing `/devkit change <id>`
  in it runs the change as any lone change.
- Rollback: revert the merge; the owner deletes the scheduled task a run left with one click in the
  app (no session can, `proof/p0-delete.md`), and the run file's new fields are ignored by the old
  `readRun`. Until it is deleted the old packs' hooks do not know its envelope, so each firing reaches
  the model once and the old `/devkit roadmap tick` answers it as an unknown argument.

## Implementation plan

Order: the proof (phase 1, probe 2 still owed); the data and the verbs (phase 2); the hook, the locks
and the blocked firing's real run (phase 3); the tick's drive and the texts (phase 4); the removal
(phase 5); the real run and the checks (phase 6).

**Per surface.**
- `plugins/openspec/hooks`: D-2 to D-8, D-10 to D-14, D-25 (`test-slots.mjs`, `test-run`, the
  `openspec/`-only pull request in `deliver-check.mjs`, `conductedOf` in `guard.mjs`).
- `plugins/openspec/.claude-plugin/plugin.json`: the two settings of D-25.
- `scripts/test-suite.mjs`: D-25's ceiling.
- `plugins/openspec/skills`: D-9's skill text (the tick's drive of D-7), the removed
  `devkit-session`. No agent file and no skill is added.
- `plugins/core/skills/requirements-grill`: D-9; `plugins/core/skills/review-change`: D-9's sentence.
- Repository: `openspec/config.yaml`, `openspec/schemas/*/schema.yaml`, `scripts/test-map.json`,
  `docs/`, the ADRs (D-16).

**File structure.**
- Create: `plugins/openspec/hooks/tick-gate.mjs`, `plugins/openspec/hooks/standing-answers.mjs`,
  `plugins/openspec/hooks/request-file.mjs` (D-17's writer and parser),
  `plugins/openspec/hooks/test-slots.mjs` and `plugins/openspec/hooks/test-slots.test.mjs` (D-25),
  the other new test files of D-15,
  `openspec/changes/helper-conductor/proof/*` (`p2-result.md`, `p5-empty-tick.md`, `run-1.md` to
  `run-5.md`).
- Modify: `plugins/openspec/hooks/{roadmap-loop,run-file,guard,change-loop,deliver-check}.mjs`,
  `plugins/openspec/hooks/delivery-train.test.mjs`,
  `plugins/core/skills/review-change/SKILL.md` and `scripts/review-round.test.mjs`,
  `plugins/openspec/hooks/hooks.json`, `plugins/openspec/hooks/roadmap-loop-fixtures.mjs`,
  `plugins/openspec/.claude-plugin/plugin.json` (`userConfig`), `scripts/test-suite.mjs`, the test
  files of D-15's table, `plugins/openspec/skills/devkit/SKILL.md`,
  `plugins/openspec/schemas/{devkit,devkit-lite}/schema.yaml`,
  `plugins/core/skills/requirements-grill/SKILL.md`, `plugins/openspec/skills/ship-change/SKILL.md`,
  `plugins/openspec/README.md`,
  `openspec/config.yaml`, `openspec/schemas/{devkit,devkit-lite}/schema.yaml`,
  `scripts/test-map.json`, `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/roles.md`,
  `docs/catalog.md`, the ADRs of D-16.
- Delete: `plugins/openspec/skills/devkit-session/SKILL.md`.

**Estimate.** Optimistic 60 h · likely 91.5 h (the sum of the table below) · pessimistic 130 h (a
stop-and-revise at task 3.6, or a host behaviour found only in phase 6).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Phase 1: P-0, P-1 (done), probe 2 and `decision.md` | 3 | Integration | HIGH |
| Run file fields, `tickReady`, `localFacts` and `commonDirOf` with no process, `limitOf` moved, `CLAIM_STALE_MS` (D-2, D-3) | 5.5 | Core | MEDIUM |
| `run` with the task, `stop`, `tick`, `tick-*` verbs (D-5, D-6) | 6 | Core | MEDIUM |
| `helper-next`, `owner-wait`, `helper-release`, `owner-waits`, `owner-watch`, `answered`, `pushed` (D-7, D-8) | 6 | Core | MEDIUM |
| `standing-answers.mjs` and its tests (D-8) | 2 | Core | LOW |
| `tick-gate.mjs` with its note, `hooks.json`, its tests (D-4) | 4 | Core | MEDIUM |
| Locks: the tick's run detection by its envelope, stop, hand-off, `ask` mode, owner-only path (D-10, D-11) | 6 | Core | MEDIUM |
| Conductor tests (`roadmap-loop-conductor.test.mjs`) | 6 | Testing | MEDIUM |
| The devkit skill's Roadmap rewrite with the tick's drive (D-7, D-9), the `review-change` sentence | 4.5 | Core | MEDIUM |
| Phase 3 real run: three blocked firings, the note, the payload's form, two runs at once, cron, notification tool, model (task 3.6) | 3 | Integration | HIGH |
| The `openspec/`-only pull request: `conductedOf`, `collectState`, its tests (D-25) | 2 | Core | MEDIUM |
| Grill skill, rule in five files, messages, status board, change-state facts (D-9) | 3 | Core | LOW |
| Removal and the pinned tests of D-15 (171 rows) | 8 | Migration | HIGH |
| Docs and records (D-16), catalog, test map | 2 | Documentation | LOW |
| Request files, `request`, `answer`, guard class (D-17) | 3 | Core | MEDIUM |
| The sweep (D-18) | 2 | Core | MEDIUM |
| Approval summary, words cut, ship-change rows (D-19) | 1.5 | Core | LOW |
| `siblings` and the approval line (D-20) | 1.5 | Core | LOW |
| Train dispatch and its ends, `train-end` (D-21) | 4 | Integration | HIGH |
| `precheck`, `skip`, the delivered check (D-22) | 2 | Core | MEDIUM |
| Escalation re-hand (D-23) | 1.5 | Core | LOW |
| Machine split by the pushed branch (D-13) | 2 | Integration | MEDIUM |
| Test capacity: settings, `capacity`, `test-slots.mjs`, `test-run` with the train's hold of the gates, the runner's ceiling, the brief's sentence (D-25) | 6 | Core | MEDIUM |
| Phase 6 real run and the whole suite | 7 | Integration | HIGH |

**Risks** (probability × impact, mitigation):
- Host behaviour differs from the plan (MEDIUM × HIGH): probe 2 settled the prompt form and the
  background hand-offs before phase 2; task 3.6 before phase 4 has its stop-and-revise cases named
  (D-1).
- The removal breaks a test outside the table (MEDIUM × MEDIUM): the class rule of D-15 and the
  implementer's own grep in the same commit; the phase 5 gate runs every mapped test.
- `roadmap-loop.mjs` grows further (HIGH × LOW): the conductor verbs go in the same file beside the
  decision core, as ADR 0021 decision 8 allowed; a split stays a follow-up.
- `multi-roadmaps` lands first and changes `run`'s arguments (MEDIUM × MEDIUM): merge the base before
  phase 2 if it merged; the queue then comes from its roadmap and round, and `tick` stays a reserved
  word beside `stop`.
- The slots ledger leaks a slot (LOW × MEDIUM): an entry is kept only while its pid lives, and every
  read drops a dead one; a conductor real run kills a `test-run` and sees its slot freed (task 6.5).
- The owner watch is a sleeping process per typed session (LOW × LOW): recorded in `waits` with kind
  `watch` and ended when the task goes.
- The hook's file-only facts differ from git's (LOW × HIGH: the places and the readiness would
  disagree between the hook and the tick): `localFacts` is tested against `runFilePath` and
  `listWorktrees` on one fixture repository (D-15), and a layout it cannot read gives no run file
  path, so the hook prints nothing and the tick decides (one model call, never a wrong block).
- A stopping run outlives its typed session (MEDIUM × MEDIUM: a model call every five minutes): the
  tick that finds `stopping` with no live claim records the end (D-6 rule 3), `stopping-busy` firings
  are blocked by the hook, and after the end `task` is null, so the hook blocks every later firing.
- A tick's session ends its turn mid-drive with nothing in flight (MEDIUM × MEDIUM: the claim stays
  live for up to two hours): D-11's stop rule refuses that once; a drive that still dies leaves a
  stale claim the next tick takes over (AC-5).
- Loading `run-file.mjs`'s import graph in the hook is slow (LOW × LOW): it loads only for the
  envelope, once per five minutes; the hook's test records the envelope run's time under the
  10-second timeout.

**Assumptions** (each the place the plan breaks if reality differs):
- The scheduled-tasks tool's names are `mcp__scheduled-tasks__{create,list}_scheduled_task`, and
  `delete_`, `update_` and `run_` need the owner's click (`proof/p0-delete.md`); the conductor calls
  only the first two.
- A `UserPromptSubmit` block stops the prompt before the model (genesi's measured 0 tokens,
  `commands/unstick.md`; task 3.6 again here).
- A scheduled session's `cwd` is the project root the task was created from (`proof/p1-hooks.md`,
  `start_cwd`).
- A task created on the owner's typed turn runs its firings without pausing for the tools a tick
  uses (`proof/p1-hooks.md`, host fact 2 and `permission_mode`); task 3.6 records it.
- The host starts a firing of the task while an earlier run's session still waits on a notice (a
  run reads `succeeded` then, `proof/p2-result.md`; task 3.6 records it).
- A `UserPromptSubmit` hook's `additionalContext` reaches a task's session, and a hook's process
  gets every pack setting as `CLAUDE_PLUGIN_OPTION_<KEY>`, as it gets `load_limit` (task 3.6 checks
  both).
- `updateRun`'s lock serializes writers across processes of one clone (`roadmap-loop.mjs`, the lock
  of `roadmap-run.lock`; requirements triage item 3).
- The phases of this repository's own changes stay under two hours each (the evidence files of the
  archived changes).
- `process.kill(pid, 0)` tells a live process from a dead one on the machines that run the
  conductor (Linux and macOS, Node's documented behaviour); a reused pid keeps a slot until that
  process ends, which only delays a run.
- The pack's `userConfig` strings reach the skill as `${user_config.<key>}`, as `load_limit` does
  (`plugins/openspec/skills/devkit/SKILL.md:17`), and a hook's process as
  `CLAUDE_PLUGIN_OPTION_LOAD_LIMIT`, which `roadmap-loop.mjs:891` already reads.
- A linked worktree's `.git` file is `gitdir: <common>/worktrees/<name>`, and that folder holds
  `commondir` and `gitdir` (git's documented layout since 2.5, `git help repository-layout`); the
  conductor test checks `commonDirOf` against `git rev-parse --git-common-dir` on the machine.

**Dependencies:**
- `multi-roadmaps` (roadmap Round 29, not merged): `<name>` and `round <k>`.
- `ADR [helper-conductor]` (13 decisions): revised by the adr-author with this revision's decisions
  (decision 1, the task that does not remove itself; decision 3, the tick's own session as the
  helper; decision 13, field fact 12; the ADR 0008 and ADR 0022 amendments) before the plan's approval
  is recorded again.
- Probe 2's result, `proof/p2-result.md` (task 1.3), run by the coordinator's session on the owner's
  Mac.
- ADR 0034 and ADR 0035 (`release.md`, the merge numbering); ADR 0036 (the gates).

## Open Questions

- Whether the hook's payload holds the scheduler's tag or only the stored prompt: task 3.6 logs it,
  and the regex keeps the form seen (D-4).
- The cron interval is `*/5` unless task 3.6 shows the host needs another; that would revise AC-15.
- A blocked firing's cost and the note's arrival are measured in task 3.6; either failing stops the
  plan before phase 4 (D-1).
