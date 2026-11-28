<!-- devkit-stage design result=passed attempt=3 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Design

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md` at attempt 4 with its field facts 1 to 11 and AC-14 to AC-22, `decisions.md`, `release.md`,
the record `docs/adr/helper-conductor.md` with its 13 decisions, cited `ADR [helper-conductor]`). Base: `origin/main` at
`6f03a57`.

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
  `update_…`) starts a session of the project on a schedule. Whether that session loads the devkit
  plugin, fires its hooks, expands a slash command in its prompt, lets a subagent dispatch subagents,
  and what an empty firing costs is not documented: `ADR [helper-conductor]` decision 3 and ADR 0010
  decision 8 (nesting proved live before it is trusted) make phase 1 a real run before the rest.
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
- A phase-1 real run that settles the helper and the tick's prompt form before any code (D-1).
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

### D-1 Phase 1: the real run and its decision point (AC-1)

Phase 1 runs before any product code, in a scratch project outside the repository:
`/var/tmp/devkit-hc-probe/project`, a `git clone` of this repository at the branch's head with
`openspec/` intact (an opted-in devkit project), using the devkit packs as installed on the machine.
Its `.claude/settings.local.json` holds one probe hook, `UserPromptSubmit`, whose script lives in
`/var/tmp/devkit-hc-probe/bin/probe-gate.mjs` (scratch, never committed): it appends the hook's whole
stdin to `/var/tmp/devkit-hc-probe/log/prompt.jsonl` and, when the file
`/var/tmp/devkit-hc-probe/empty` exists and the prompt is the probe task's envelope, prints
`{"decision":"block","reason":"probe: nothing ready"}`. The probe sets `DEVKIT_HOOK_LOG` in that
settings file's `env` so the devkit locks record their decisions.

The probes, each a file under `openspec/changes/helper-conductor/proof/`:

| Id | What it proves | How | Kept as |
|---|---|---|---|
| P-0 | The session can delete what it creates | `list_scheduled_tasks`, then the tool that removes a task (delete, or `update_scheduled_task` with `enabled: false` when no delete exists) on a throwaway task `devkit-hc-probe-0` | `proof/p0-delete.md` |
| P-1 | A scheduled session loads the plugin and its hooks fire | a task `devkit-hc-probe-1` (one firing) whose prompt asks the session to run `git clean -n` and `git stash list` and report the refusals; the devkit `SessionStart` report and the `bash` guard's refusal appear in its transcript; `prompt.jsonl` holds the payload | `proof/p1-hooks.md`, the payload's first 400 characters with the session id masked |
| P-2 | The envelope the host gives a task's prompt | the payload of P-1: does `prompt` begin with `<scheduled-task name="…">`, and with what id | in `p1-hooks.md` |
| P-3 | A slash command in a task's prompt runs as typed | a task whose prompt's second line is `/devkit-openspec:devkit status`; the transcript holds `<command-name>` and the board | `proof/p3-slash.md` |
| P-4a | An agent helper can dispatch a stage agent and the review bench with the hooks active | in a P-3-style session, one `Agent` call to a probe agent (`/var/tmp/devkit-hc-probe/project/.claude/agents/probe-helper.md`, tools `Agent, Bash, Read`) that hands `devkit-openspec:openspec-validator` one validation of a scratch change and then runs one `review-change` round on a two-file scratch change; `DEVKIT_HOOK_LOG` shows `subagent-stop` decisions for the nested agents | `proof/p4-helper.md` |
| P-4b | A Workflow helper can do the same | the same session runs a scratch Workflow script that starts the validator and the `review-round.workflow.js` stages for the same scratch change | in `p4-helper.md` |
| P-5 | What an empty tick costs | with `/var/tmp/devkit-hc-probe/empty` present, three firings of a task with the probe envelope; their transcripts hold no assistant message and the host's usage reads 0 tokens; one firing without the file, for comparison, with its tokens | `proof/p5-empty-tick.md` |
| P-6 | Overlap and background | while a firing's session runs a background `sleep 900` (`run_in_background`), the next firing still opens a session; the first one's turn ended | `proof/p6-overlap.md` |
| P-7 | The notification tool | `ToolSearch` for the host's push tool (`select:PushNotification`, else the query `notification`): its name, or none | in `p6-overlap.md` |

Every probe task is deleted at the probe's end with P-0's tool, and `list_scheduled_tasks` shows
none (memory rule: check the delete before creating).

The decision point, `proof/decision.md`, written by the conducting session from P-0 to P-7:

- **Helper A (agent)** when P-4a passes: the helper is `plugins/openspec/agents/roadmap-helper.md`
  (D-7). ADR 0008 is unchanged.
- **Helper B (Workflow)** when P-4a fails and P-4b passes: the helper is
  `plugins/openspec/skills/devkit/scripts/change-helper.workflow.js`, which runs the same loop as D-7
  with `agent()` steps; `ADR [helper-conductor]`'s amendment of ADR 0008 decision 1 applies. What
  changes in the later phases: task 4.1 writes the Workflow file in place of the agent file and its
  test map entry; D-11's hand-off rule names the Workflow's stage agents as the tick session's own
  hand-offs (the hook sees them with no `agent_type`); D-10's `AskUserQuestion` refusal still holds;
  the tick's stop rule "a helper in the background" reads the Workflow's background task.
- **Prompt S-A** when P-3 passes: the task's prompt is two lines, `devkit-roadmap-tick: <root>` then
  `/devkit-openspec:devkit roadmap tick`; `roadmapRunOf` reads it as a typed `/devkit roadmap tick`
  with no change.
- **Stop and revise** (no later phase starts; the plan goes back to the planner, the readiness review
  and the owner's approval, as a revision of the specs) when any of these holds: P-1 shows no devkit
  hook firing; P-5 shows a model call on a blocked firing; P-0 finds no way to remove a task; P-3
  fails (the tick would need a model-invocable skill and a guarded entry, which changes
  `coordination-locks`); both P-4a and P-4b fail (the candidate then is the tick's own session
  conducting its claimed change on its main thread, which `ADR [helper-conductor]` decision 3 does not
  allow without a revision). `decision.md` names which case holds.

The record is revised with the pick (its decision 3 names the helper, and with Helper B its ADR 0008
amendment stands) before the plan's approval is recorded again: the adr-author's work, not the
planner's.

### D-2 The run file of a conducted run

`plugins/openspec/hooks/run-file.mjs`. `emptyRun()` loses the six fields `ADR [helper-conductor]`
decision 8 removes (`tickets`, `changeSessions`, `startedSessions`, `turn`, `cron`, `check`) and
gains:

```js
task: null,        // { id, cron, at } once the scheduled task is installed; null otherwise
queue: [],         // the change ids of the run's roadmap lines, in file order, as `run` built them
claims: {},        // { <id>: { session, at, heartbeat, helper } }; helper: null | 'started' | 'ended'
holds: {},         // { <id>: { kind, at, recheckAt, params } } the wait each item ended its helper at
ownerWaits: {},    // { <id>: { gate, questions, request, summary, at, shown, pushedAt } } the lines for the owner
train: null,       // { claim: { session, at, heartbeat, helper } | null, hold: { kind, at, recheckAt } | null } (D-21)
capacity: null,    // { suites: 1, gates, concurrency, at } the machine's test caps, recorded by `run` (D-25)
```

- `holds[id].kind` is one of `github`, `place`, `load`, `after`, `owner`, `blocked`, `delegated`,
  `archived`, `boarded`, `escalated`, `skipped`, `elsewhere` (D-18 to D-23). `recheckAt` (ISO time or null) is when the item is worth a new look without any local
  change: 10 minutes after `at` for `github`, 30 minutes for `after` and `elsewhere`, null for the others. `params`
  holds the gate (`owner`, `delegated`), the dependency (`after`) or the reason (`blocked`).
- `ownerWaits[id].gate` is one of `grill`, `mockup`, `approval`, `retro`, `review-round`,
  `pr-decision`, `merge`, `decision`, `budget`, the gates of `gate.*` in the message table;
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
  and add `task`, `queue`, `claims`, `holds`, `ownerWaits`, `train` and `capacity`.` The test reads
  decision 4's list, removes the Note's removed fields and adds its added ones before it compares.
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
  `<commonDirOf(root)>/devkit/roadmap-run.json`, null with no common dir. `runFilePath` (`git rev-parse
  --git-common-dir`, `run-file.mjs:24-28`) stays for every other caller.
- `archived`: the ids `<id>` of the folders `openspec/changes/archive/<date>-<id>/` of the main
  checkout (the parent of the common dir when its name is `.git`, else `root`).
- `open`: the change folders `openspec/changes/<id>/` (not `archive`, change ids only) of the main
  checkout and of every linked worktree, a linked worktree being the parent folder of the path that
  `<common dir>/worktrees/<name>/gitdir` names, skipped when that path does not exist: the same list
  as `git worktree list --porcelain` minus prunable and bare entries (`listWorktrees`,
  `deliver-check.mjs:244`), which the tick keeps using for everything but these facts.
- `load` from `os.loadavg()[0] / os.cpus().length * 100`; `limit` from
  `limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT)`, as `roadmap-loop.mjs:891` reads it. `limitOf` and
  `DEFAULT_LIMIT` move from `roadmap-loop.mjs:62-71` to `run-file.mjs`, and `roadmap-loop.mjs`
  re-exports `limitOf` as it re-exports `readRun` and `runFilePath`, so its importers are unchanged.
- `heldPlaces`: the count of the ids of `run.occupied` that are in `open`. `run.occupied` is the
  record the place rule already writes: `sessionDecide`'s `placeDecision` (`roadmap-loop.mjs:1070-1079`)
  adds a change when it reaches a part of `LOAD_PARTS` (`build`, `after`: the implementation, a test
  stage, the evidence, the review) and deletes it when the change leaves those parts or is archived;
  `helper-next` keeps that rule (D-7). The count leaves out an id no longer open, as the prune of
  `roadmap-loop.mjs:1240` does, without writing. No stage header is read for it. `helper-next`'s own
  place check (`placeDecision`) counts the same entries, so the hook and the tick agree.

It returns `{ ready: <id> | null, why }`:

1. `run.task` null → `{ ready: null, why: 'no-task' }`.
2. `run.stopping` with a live claim or a live `train.claim` → `{ ready: null, why: 'stopping-busy' }`
   (the hook blocks: the helper in flight releases its claim itself); `run.stopping` with neither →
   `{ ready: null, why: 'stopping' }` (the hook passes, for the tick to delete the task, D-6 rule 3).
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

- It reads stdin (at most 64 KiB) and tests the raw text first, with no import: the payload's
  `prompt` field begins (after blanks) with the envelope P-2 recorded, followed by a line
  `devkit-roadmap-tick: <root>` where `<root>` is `findRoot(payload.cwd)`. The regex is anchored on
  `[{,]\s*"prompt"\s*:\s*"` as genesi's is. Until P-2 records the wrapper, the plan's form is
  `<scheduled-task name="devkit-roadmap-<slug>">` (D-5's id); task 3.1 writes the regex from
  `proof/p1-hooks.md`, and the test fixtures copy that payload.
- Anything else, any parse error, a project that has not opted in, or a root that does not match:
  exit 0, print nothing.
- For the envelope: `readRun(localRunFilePath(root))` (a null path → print nothing),
  `localFacts(root, run, process.env)` and `tickReady` of D-3. `ready` not null, or `why` in `done`,
  `stopping`: exit 0, print nothing. Otherwise (`no-task`, `stopping-busy`, `helpers-full`,
  `nothing-ready`) print `{"decision":"block","reason":"devkit roadmap: nothing is ready (<why>)"}`
  and exit 0.
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

- Task id: `devkit-roadmap-<basename of root, lowercased, outside [a-z0-9-] made `-`, cut to 24>-<first
  8 hex of sha256(root)>`. Cron: `*/5 * * * *` (`ADR [helper-conductor]` decision 1, AC-15), unless P-6 shows the host refuses
  it: then the shortest interval it accepts, recorded in `decision.md` and brought to the owner as a
  revision of AC-15 before phase 2 starts. `notifyOnCompletion: false`.
- Prompt (S-A), exactly two lines: `devkit-roadmap-tick: <root>` and
  `/devkit-openspec:devkit roadmap tick`.
- `roadmap-loop.mjs run --test-gates <g> --test-concurrency <c>` (no `--change-sessions`, no
  `--cron`; both flags are now unknown options) records `places`, `queue` (from `classifyLines`: the
  unticked, unarchived lines, in file order), `session` and `capacity` (D-25), every typed `run`
  writing `capacity` again from the settings, as it writes `places`; and prints `devkit-roadmap: <n>` then the decision JSON with one action:
  `{ kind: 'install-task', input: { taskId, title, description, cronExpression, prompt,
  notifyOnCompletion } }` when `run.task` is null, else none. `--after task=installed:<id>` or
  `--after task=exists:<id>` (a new key of `run`'s and `next`'s `--after`) records
  `task: { id, cron, at }`; `--after task=refused` records nothing and prints the reply
  `roadmap-no-task`.
- The skill (D-9): before `run`, load the host's tools with `ToolSearch`
  (`select:mcp__scheduled-tasks__list_scheduled_tasks,mcp__scheduled-tasks__create_scheduled_task`);
  when none loads, run `roadmap-loop.mjs reply roadmap-no-scheduler`, say it, end the turn (nothing is
  written). For `install-task`: `list_scheduled_tasks`; a task with the action's `taskId` →
  `--after task=exists:<id>`; else `create_scheduled_task` with `input` exactly →
  `--after task=installed:<id>`, or `task=refused` on an error.
- `stop`: `run` with `stop` sets `stopping` and prints `{ kind: 'delete-task', id }`; the skill
  removes it with P-0's tool and reports `--after task=deleted`, which sets `task: null`. A task
  already gone is no error. The `tick` that finds `done`, or `stopping` with no live claim, prints
  the same action and the end reply `roadmap-ended-done` or `roadmap-ended-stopped` (D-6 rule 3), so
  the task is deleted even when the typed session closed before it removed it. `tick`'s own
  `--after` takes `task=deleted` and `task=delete-refused` (D-6).

### D-6 The tick: `roadmap-loop.mjs tick --session <id>` (AC-4, AC-5, AC-11)

Reached through `/devkit roadmap tick` (the `devkit` skill's `## Roadmap`, D-9). It prints
`devkit-roadmap: <places>` then one JSON:

1. No `run.task` → `{ end: { reply: 'roadmap-no-run' } }`, nothing written.
2. A hold of kind `delegated` whose item has no live claim → `{ action: { kind: 'record-delegated',
   change, gate, quote, line, who } }`: the tick's own session records it (D-8) and calls
   `tick-recorded --change <id> --gate <g>`, which clears the hold.
3. `tickReady` says `done` → `{ action: { kind: 'delete-task', id }, end: { reply:
   'roadmap-ended-done' } }`; `stopping` (no live claim left) → `{ action: { kind: 'delete-task', id },
   end: { reply: 'roadmap-ended-stopped' } }`, so a run whose typed session closed before it deleted
   the task (D-5's `stop`) still loses it; `stopping-busy` → nothing to claim, `{ end: null }` (the
   hook blocks those ticks, so they cost no model call). A `stopping` run is bounded: the helper's
   next `helper-next` releases its claim (D-7), and a helper that died leaves a claim stale after
   `CLAIM_STALE_MS`, after which the next tick finds `stopping`. The tick's session carries out
   `delete-task` as the typed session does (D-5) and reports `tick --session <id> --after
   task=deleted`, which sets `task: null`; a task already gone reports the same. Any other error of the
   tool reports `--after task=delete-refused`, which also sets `task: null` (so every later firing is
   blocked by the hook on `no-task` with no model call) and prints the reply `roadmap-task-left` naming
   the task id for the owner to remove by hand; `stopping` and `done` keep their reply after it.
4. Otherwise the decision core runs as `next` does (`decideRoadmap` over the facts, with its fetch of
   the base, `fresh-base` rule), and the tick takes the first item of `run.queue`, in order, that
   `tickReady` would accept and whose decided action is not a wait; under `updateRun` it re-reads the
   run file, checks that item still has no live claim and that live claims are below `places`, and
   writes `claims[id] = { session, at: now, heartbeat: now, helper: null }` and deletes `holds[id]`.
   It prints `{ claim: { change, root, model, brief } }`: `root` the change's worktree (or the main
   checkout when the change is not open yet), `model` from D-14, `brief` the helper's prompt (D-7).
5. Nothing claimable → `{ claim: null, why }`.

`tick-started --change <id>` sets `claims[id].helper = 'started'` (the stop lock's fact, D-11). The
tick's session starts the helper in the background, ends its turn, and on the helper's end runs
`tick-ended --change <id>`, then carries out a `record-delegated` the helper's end named, then the
pushes of new owner lines (D-8).

### D-7 The helper's loop: `roadmap-loop.mjs helper-next` (AC-4 to AC-6, AC-11)

`helper-next --change <id> --session <tick session> [--after <key>]` replaces `session-next`: the
same reading of `change-loop.mjs next` for the change in its worktree, the same place, load and
dependency holds (`held` with `why` `place`, `load`, `after`), the same `merge-base` step before the
first plan file, the same budget end; minus the ticket, the session title and the session-model
switch. Every call renews `claims[id].heartbeat`. It prints `devkit-run: <id>` and the action, or,
when the action is a wait or an end, records it and releases the claim in one `updateRun`:

| Action from the change loop | Recorded | Printed |
|---|---|---|
| `held` place / load / after | `holds[id] = { kind: 'place'|'load'|'after', … }` | `{ kind: 'end', state: 'running', why }` |
| end `waiting-on-github` | `holds[id] = { kind: 'github', recheckAt: now + 10 min }` | `{ kind: 'end', state: 'waiting-on-github' }` |
| end `waiting-for-owner` at a gate the standing answers delegate (D-8) | `holds[id] = { kind: 'delegated', params: { gate, quote, line, who } }` | `{ kind: 'end', delegated: { … } }` |
| end `waiting-for-owner` at any other gate | `ownerWaits[id] = { gate, questions: [], … }`, `holds[id] = { kind: 'owner' }` | `{ kind: 'end', state: 'waiting-for-owner', gate }` |
| end `blocked` | `holds[id] = { kind: 'blocked', params: { why } }` and `ownerWaits[id] = { gate: 'decision', questions: [<why>], … }` | `{ kind: 'end', state: 'blocked', why }` |
| end `archived` | `holds[id] = { kind: 'archived' }`; no owner line | `{ kind: 'end', state: 'archived' }` |
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
releases the claim. `helper-release --change <id>` releases a claim with no hold (the helper's last
call when it was stopped by `stopping`).

The helper, Helper A (`plugins/openspec/agents/roadmap-helper.md`):

```yaml
name: roadmap-helper
description: "Drives one change of a /devkit roadmap run to its next wait, for the tick of the run's scheduled task that claimed it: runs helper-next, hands each stage to its role, runs the grill from the files and the standing answers, never asks the owner. Use only when a tick's brief names a claimed change."
tools: Agent, Bash, Read, Write, Edit, Glob, Grep
model: sonnet
skills:
  - requirements-grill
```

Its body: the loop of `## Loop` item 2 of the devkit skill, carried out for one change, with these
differences: every `next` is `helper-next`; the grill runs the requirements-grill skill's conducted
branch (D-9), writing triage answers and standing answers with their sources and calling
`owner-wait` for the rest; a session step it cannot carry out without the owner is never attempted
(the loop gives it as an end); it writes no `approval.md`, no retro answer and no file the guard
reserves to the main session; it calls no AskUserQuestion (not in its tools) and starts no session;
every test command it runs itself goes through `test-run` as D-25 says, and the cap sentence of
D-25 is on every brief it hands; its last call is the `end` of `helper-next`, or `helper-release`
when `stopping`. Its final message is
one JSON line `{ "change": <id>, "end": <the end's state>, "delegated": <the delegated object or
null> }`. The model passed on its Agent call is the tick's `claim.model` with any `[1m]` dropped
(D-14).

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
- **A line for the owner** is written only by `helper-next` and `owner-wait` (D-7). `owner-waits
  [--session <id>]` prints the lines as JSON, in roadmap order, each with the message of
  `roadmap-gate` and its questions; with `--session` it adds the id to each line's `shown`.
- **The typed session** (D-9): after `run`, it starts `roadmap-loop.mjs owner-watch --session
  ${CLAUDE_SESSION_ID}` with the Bash tool's background option: a loop that every 60 seconds reads the
  run file and exits 0 when a line exists whose `shown` lacks that session, or when `run.task` is null.
  The session then runs `owner-waits --session …`, shows the lines, asks the head line (roadmap order)
  as the owner's gate, one change at a time, and records the owner's own answer as `## Owner gates`
  of the skill says for that gate (the `ship-change` row of the gate, the grill answers into
  `requirements.md`), then `answered --change <id> --gate <g>`, which deletes `ownerWaits[id]` and
  `holds[id]`; it starts the watch again. The watch is recorded in `waits` with kind `watch`.
- **The push**: after `tick-ended`, the tick's session runs `owner-waits` and, for each line whose
  `pushedAt` is null, when P-7 named a tool, sends one notification (`<id>: <gate phrase>`) and runs
  `pushed --change <id> --gate <g>`, which sets `pushedAt`. A line is pushed once.
- **A delegated gate** is recorded by the tick's session (`record-delegated`, D-6), never by the
  helper: for `approval`, the `ship-change` row `stop-plan-approval` with the owner's words replaced
  by `delegated to <who> in openspec/standing-answers.md:<line>: "<quote>"`; for `retro`, the
  `stop-retro-answers` row the same way; for the other gates, the reply the skill's `## Owner gates`
  names with the same words. A gate with no delegation is never recorded by a tick (the hook rule of
  D-11 refuses an `approval.md` or `retro.md` answer written by a tick's session with no
  `record-delegated` action for that change and gate in its transcript).

### D-9 The texts: the devkit skill, the grill, the rule

- `plugins/openspec/skills/devkit/SKILL.md` `## Roadmap` is rewritten as three parts: "The typed
  command" (D-5's tool loading and `install-task`, the owner watch and the lines of D-8, `stop`, the
  start-anyway), "A tick" (`/devkit roadmap tick`: run `tick`, carry out `record-delegated` and
  `delete-task`, start the helper in the background with the claim's brief and model, `tick-started`,
  end the turn; on the helper's end `tick-ended`, the delegated gate, the pushes; never ask the owner,
  never call AskUserQuestion, never write a gate file but a delegated one; every test command through
  `test-run`, D-25), and "What stays" (the places, the load, the machines, and the test caps with
  their two settings). The settings list at the skill's top gains `test_gates` and
  `test_concurrency` beside `load_limit`, and `run`'s call carries `--test-gates` and
  `--test-concurrency` (D-25). "A session per change", "Every change in this session" and "The
  periodic check" are deleted, and so is item 1a of `## Loop`, the `session-next` mention of the grill
  item, and the `Never` items about change sessions, the session-start tool and the periodic check;
  the `Never` item about crons becomes: "Create a cron or any scheduled wake-up, except the one
  scheduled task of a roadmap run that `roadmap-loop.mjs` asks for, which `stop` and the run's end
  delete." The frontmatter's `argument-hint` reads `roadmap [<n> | stop | tick]`.
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
  one."), `roadmap-task-left` ("The app would not remove the run's scheduled task {task}: remove it
  in the app's scheduled tasks; the run is over."), `roadmap-owner-line` ("{id} waits for {gate}:
  answer here, and the run goes on."),
  `status-owner-here` ("answer in the session the run was typed in"), each with its `pt-BR` text
  written in the same plain register as its neighbours.

### D-10 The helper never asks (AC-6)

Besides the helper's tools, `hooks.json` gains a `PreToolUse` matcher `AskUserQuestion` →
`guard.mjs ask`: in a session whose run is a tick (`roadmapRunOf` gives `command: 'roadmap tick'`),
from the main thread or a subagent, the call is refused with "a roadmap tick never asks the owner:
write the question as a line for the owner (owner-wait)". Every other session passes. It fails open
as every lock does.

### D-11 The locks (coordination-locks)

- `roadmapRunOf` is unchanged under S-A: `/devkit roadmap tick` is a typed `/devkit roadmap` with the
  argument `tick`, and `tick` prints its `devkit-roadmap:` line.
- `roadmapStopDecision`: when the run file records `task`, the typed session (command not `roadmap
  tick`) is allowed; a tick's session is refused once (progress key `tick:<id>:<helper>`) while it
  holds a claim with `helper: null`, or with `helper: 'ended'` and a `delegated` hold still on that
  item; otherwise allowed. With no `task` the existing rules hold unchanged.
- `roadmapAgentDecision`: with `task` recorded, the typed session's hand-offs are refused (reason
  `conducted`); a tick's session is allowed the helper (`devkit-openspec:roadmap-helper`) or a role of
  its claimed change's script, the brief naming that change, else refused naming the claimed change.
  Subagents' own hand-offs stay allowed, and `roadmapSubagentStopDecision` judges each stage agent
  against its change as today. The helper's own stop: a `subagent-stop` of `roadmap-helper` is
  refused once while its claim has no hold and the run is not stopping (it must end at a wait).
- `guard.mjs`: `ENTRY_SKILL`, `namesEntrySkill`, `skillEntry`, `START_LINE` and the `skill` mode go,
  with the `PreToolUse` `Skill` entry of `hooks.json`; the `lock` dispatcher's
  `changeSessionStopDecision` branch goes (a stop outside a roadmap run is the change loop's).
  `startedTaskOf`, `STARTED_BY_SESSION` and `firstMessageOf` stay (ADR 0014 decision 4 and the child
  phase sessions of ADR 0006 still read the started form). `classify` gains
  `openspec/standing-answers.md` as owner-only (D-8), and the rule that a tick's session writes a gate
  file only after its `record-delegated` action.

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
| `plugins/openspec/skills/devkit-session/` | the skill | the helper (D-7) |
| "A session per change", "Every change in this session", "The periodic check", item 1a | `skills/devkit/SKILL.md` | D-9's parts |

`placed`, `checkout`, `occupied`, `queued`, `anyway`, `waits` (its kind `session` goes, `github` stays,
`watch` is new), `holding`, `inflight`, `declared`, `announced`, `starting`, `stopping`, `asking`,
`held`, `session`, `places`, `version`, `updatedAt` stay. After the task, `grep -rn
'devkit-start:\|ticket-unknown\|devkit-roadmap-check:' plugins/` prints nothing, test files included
(the tests that held those literals are rows of D-15), and so does `grep -rln 'devkit-session'
plugins/` (today: `roadmap-loop.mjs`, `guard.mjs`, `roadmap-loop-fixtures.mjs`, `README.md`, the
devkit skill, the `devkit-session` skill and four test files, each a row above, of D-9, D-15 or D-16).

### D-13 The machines: the split by the pushed branch (ADR 0020, AC-21)

A tick may open an item for another machine as ADR 0020 places it (`placed`, the claim naming that
machine, as `change-loop.mjs open --machine` writes it). Right after `open`, on every machine, the
helper's first step pushes the change's branch (`git push -u origin <id>`, the `push` step with
`--what open`, a new value beside `grill` and `plan`); a failed push is said once and tried at the
next tick. No session is started on the other machine and no step runs there from this one:
`remoteSessionStartOf` goes, and the conductor no longer calls `checkout`; the verb stays for the
owner's own use (`ADR [helper-conductor]` decision 10; requirements, question 2).

On the other machine, its own run (its owner typed `/devkit roadmap` there, with its own task and run
file) finds the item in its queue with no local folder and no hold: the hook passes (D-3), the tick
fetches `origin/<id>`, reads the claim; a claim naming `thisMachine()` with no worktree here →
`git worktree add .claude/worktrees/<id> <id>` from the fetched branch (the `checkout` code's
local part, `worktreeOn`, reused), then the usual claim and helper. A claim naming another machine →
hold `elsewhere` with `recheckAt` 30 minutes, which the tick writes itself (no helper is started,
no worktree added, no place taken); at `recheckAt` the hook passes (D-3 rule 5), the tick fetches and
reads the claim again: still another machine's → a new `elsewhere` hold; released or stale → the
claim is this machine's to take, as for any item. The places of this machine are counted over its run
file's held places; another machine's from the claims on `origin`, as today. Every change of this
machine is conducted, so the old split between a change on the run's ticket and one counted from
`origin` goes.

### D-14 The helper's model (stage-models)

`helperModel(stage, table)`: the strongest of `table[stage]` and the table's model of every stage of
`SESSION_RUN_STAGES` (`change-loop.mjs`: requirements, approval, review, delivery, retro) from that
stage on up to the next stage where the change waits (approval for the stages before it, the
review's end for the build stages, the archive after it), `[1m]` kept on the value and dropped on the
Agent call. It replaces the session floor function; the step-down actions go (D-12).
`SESSION_RUN_STAGES`' comment is reworded: "the stages a helper performs itself".

### D-15 Tests

New test files, each in `scripts/test-map.json` (`files` keys for the new modules, and the new
scripts linked; `slow` for `roadmap-loop-conductor.test.mjs`):

| File | Covers | Names start |
|---|---|---|
| `plugins/openspec/hooks/roadmap-loop-conductor.test.mjs` | D-2, D-3 (with `localFacts` against `runFilePath` and `listWorktrees` on a fixture repository: a main checkout, two worktrees, one removed folder), D-5, D-6, D-7, D-8 (verbs), D-11 (stop and hand-off with `task`), D-13, D-14, D-18 to D-23, D-25 (the caps recorded, the brief sentence, the places) | `conductor AC-<n> ` |
| `plugins/openspec/hooks/tick-gate.test.mjs` | D-4, the hook run as a process with a fixture payload copied from `proof/p1-hooks.md`, on a fixture repository with a main checkout and a linked worktree, with a `PATH` whose `git` and `gh` exit 1 | `tick-gate AC-3 ` |
| `plugins/openspec/hooks/request-file.test.mjs` | D-17's shape, the refusals, the 12-line summary, the answer's parse | `request AC-14 `, `request AC-16 ` |
| `plugins/openspec/hooks/standing-answers.test.mjs` | D-8's parser: no file, empty, two sections, an unknown gate, a delegation with no quote, a closed fence, an unclosed fence | `standing AC-6 `, `standing AC-8 ` |
| `plugins/openspec/hooks/test-slots.test.mjs` | D-25's ledger and `test-run`: one whole suite at a time, the train first, the gates cap, a dead pid dropped, a broken ledger, two clones sharing the ledger, no slot outside a conducted run, the exit code and the release on a signal | `capacity AC-22 ` |

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
  record's Amends list), and in ADR 0008 only with Helper B (D-1); ADR 0013 also gets D-2's Note.
  ADR 0022 is amended in decision 4 (the tick dispatches the train, D-21) and ADR 0026 in decision 1
  and its Negative consequence's mitigation (the cap, D-25).
- `docs/openspec-flow.md`: the roadmap paragraphs "Opening every change at the start", "The periodic
  check and the cleanup", "What it decides and says" and "The locks" are rewritten for the conductor
  (the task, the tick, the gate, the helper, the lines, the standing answers); `docs/coordination-design.md`'s
  paragraph "Opening every change at the start" gets a dated line saying `ADR [helper-conductor]`
  supersedes it and how a run goes now; `docs/roles.md`'s coordinator row names the tick's session and
  the helper; `plugins/openspec/README.md` drops the `devkit-session` rows and the `Skill` hook row and
  adds `tick-gate.mjs`, `standing-answers.mjs`, `test-slots.mjs`, the two settings of D-25 and the
  helper; `docs/openspec-flow.md` also gains the test capacity (the caps, their settings, `test-run`,
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
prints `{ claim: { train: true, root, model: 'sonnet', brief } }`. The helper drives `train-loop.mjs`
as the `## Train` part of the devkit skill does for `/devkit train`, up to the train's end, records it
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
`update-train` commands run inside the whole-suite slot of D-25 with the train's priority: the helper
runs `detail.command` as `roadmap-loop.mjs test-run --train --kind suite -- <detail.command>`, with the
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

### D-24 Phase-1 additions

P-6 also checks that `*/5 * * * *` is accepted. Nothing else of D-17 to D-23 and D-25 depends on the
host.

### D-25 The machine's test capacity (AC-22)

`ADR [helper-conductor]` decision 13 (field fact 11: load 124 on a 14-core machine, from two whole
suites at concurrency 14 and four gates). It amends ADR 0026 decision 1 and its mitigation "the
runner's concurrency follows the core count" for a conducted run only.

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
  - `--kind gate`: takes a slot when the live gates are fewer than `capacity.gates`;
  - `--train --kind suite`: takes the slot when `suite` is null; else writes `trainWaiting` with its
    own pid, so no change's whole suite starts meanwhile, and waits only for the run already started;
  - `--change <id> --kind suite`: takes the slot when `suite` is null and no live `trainWaiting` is
    recorded.
  Its first wait prints one line on stderr, `devkit-test: waiting for a whole-suite slot (<owner>)` or
  `devkit-test: waiting for a gate slot (<n> of <g> in flight)`, and later rounds print nothing. With
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
  helper's own text (D-7), the train's helper (D-21) and the tick's part of the skill (D-9) carry the
  same rule. The sentence is fixed for fixed caps, so `handOffKey` of a retried brief stays stable
  while the caps do.
- **The places count test load.** The run's places already count only the changes whose stage holds
  a place (D-3's `heldPlaces`, the `run.occupied` entries of open changes, written for the parts of
  `LOAD_PARTS`: the implementation, a test stage, the evidence, the review), whether a
  helper runs or not: a change at its review waiting on GitHub with no helper holds its place, and a
  helper at a grill or a plan holds none. Decision 13 makes this count the capacity's count of
  changes; no field is added, and a conductor test pins both sides.

### Alternatives considered

| Option | Why not |
|---|---|
| A model-invocable `devkit-tick` skill with a guarded entry (no slash command in the prompt) | The `devkit-session` pattern this change removes; only if P-3 fails, through a revision (D-1) |
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

- [A scheduled session does not load the plugin or its hooks] → P-1; the stop-and-revise case of D-1.
- [The block does not prevent the model call] → P-5; stop and revise; the record's review trigger.
- [A helper cannot dispatch subagents (no `Agent` inside a subagent)] → P-4a/P-4b pick the helper;
  both failing stops the plan.
- [A stage longer than two hours makes a live claim stale] → the heartbeat renews at every
  `helper-next` call, between stages; an implementation phase is one hand-off, so the bound is set
  above the longest phase the repository's evidence records (about 70 minutes); a takeover hands the
  stage again from the files, which the stage file headers make idempotent.
- [Two ticks take one claim] → every claim is one `updateRun` read and write under the lock (D-2); a
  conductor test runs two `tick` processes at once.
- [The owner never opens the typed session again] → `/devkit status` and the push show the lines; the
  task keeps ticking and costs nothing while idle.
- [A delegation recorded where none was meant] → only the owner writes the file (D-8's owner-only
  path); the gate file quotes the line; D-11 refuses a gate file a tick writes without its action.
- [Other plugins' prompt hooks call a model on the tick's prompt] → a block from any hook stops the
  prompt; P-5 measures with the machine's real plugin set, genesi included.
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
- Rollback: revert the merge; the scheduled task left by a run is deleted with
  `list_scheduled_tasks` and its remove tool (P-0), and the run file's new fields are ignored by the
  old `readRun`.

## Implementation plan

Order: the proof (phase 1); the data and the verbs (phase 2); the hook and the locks (phase 3); the
helper and the texts (phase 4); the removal (phase 5); the real run and the checks (phase 6).

**Per surface.**
- `plugins/openspec/hooks`: D-2 to D-8, D-10 to D-14, D-25 (`test-slots.mjs`, `test-run`).
- `plugins/openspec/.claude-plugin/plugin.json`: the two settings of D-25.
- `scripts/test-suite.mjs`: D-25's ceiling.
- `plugins/openspec/agents`, `plugins/openspec/skills`: D-7's helper, D-9's skill text, the removed
  `devkit-session`.
- `plugins/core/skills/requirements-grill`: D-9.
- Repository: `openspec/config.yaml`, `openspec/schemas/*/schema.yaml`, `scripts/test-map.json`,
  `docs/`, the ADRs (D-16).

**File structure.**
- Create: `plugins/openspec/hooks/tick-gate.mjs`, `plugins/openspec/hooks/standing-answers.mjs`,
  `plugins/openspec/hooks/request-file.mjs` (D-17's writer and parser),
  `plugins/openspec/hooks/test-slots.mjs` and `plugins/openspec/hooks/test-slots.test.mjs` (D-25),
  `plugins/openspec/agents/roadmap-helper.md` (Helper A) or
  `plugins/openspec/skills/devkit/scripts/change-helper.workflow.js` (Helper B), the other new test files
  of D-15, `openspec/changes/helper-conductor/proof/*`.
- Modify: `plugins/openspec/hooks/{roadmap-loop,run-file,guard,change-loop}.mjs`,
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

**Estimate.** Optimistic 58 h · likely 84 h (the sum of the table below) · pessimistic 125 h (a revision at D-1's decision point,
or a host behaviour found only in phase 6).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Phase 1 probes P-0 to P-7 and `decision.md` | 5 | Integration | HIGH |
| Run file fields, `tickReady`, `localFacts` and `commonDirOf` with no process, `limitOf` moved, `CLAIM_STALE_MS` (D-2, D-3) | 5.5 | Core | MEDIUM |
| `run` with the task, `stop`, `tick`, `tick-*` verbs (D-5, D-6) | 6 | Core | MEDIUM |
| `helper-next`, `owner-wait`, `helper-release`, `owner-waits`, `owner-watch`, `answered`, `pushed` (D-7, D-8) | 6 | Core | MEDIUM |
| `standing-answers.mjs` and its tests (D-8) | 2 | Core | LOW |
| `tick-gate.mjs`, `hooks.json`, its tests (D-4) | 3 | Core | MEDIUM |
| Locks: stop, hand-off, helper stop, `ask` mode, owner-only path (D-10, D-11) | 4 | Core | MEDIUM |
| Conductor tests (`roadmap-loop-conductor.test.mjs`) | 6 | Testing | MEDIUM |
| Helper file and the devkit skill's Roadmap rewrite (D-7, D-9) | 4 | Core | MEDIUM |
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
| Test capacity: settings, `capacity`, `test-slots.mjs`, `test-run`, the runner's ceiling, the brief's sentence (D-25) | 5 | Core | MEDIUM |
| Phase 6 real run and the whole suite | 7 | Integration | HIGH |

**Risks** (probability × impact, mitigation):
- Host behaviour differs from the plan (MEDIUM × HIGH): phase 1 first, stop-and-revise cases named.
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
  tick that finds `stopping` with no live claim deletes the task (D-6 rule 3), `stopping-busy` ticks
  are blocked by the hook, and a refused deletion clears `task` so the hook blocks every later firing.
- Loading `run-file.mjs`'s import graph in the hook is slow (LOW × LOW): it loads only for the
  envelope, once per five minutes; the hook's test records the envelope run's time under the
  10-second timeout.

**Assumptions** (each the place the plan breaks if reality differs):
- The scheduled-tasks tool's names are `mcp__scheduled-tasks__{create,list,update}_scheduled_task`
  (the genesi hooks' matchers, `~/.claude/plugins/cache/genesi/genesi/0.451.0/hooks/hooks.json`); a
  remove tool exists or `enabled: false` removes the task from the list (P-0).
- A `UserPromptSubmit` block stops the prompt before the model (genesi's measured 0 tokens,
  `commands/unstick.md`; P-5 again here).
- A scheduled session's `cwd` is the project root the task was created from (genesi reads it the
  same way; P-1).
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
- `ADR [helper-conductor]` (proposed, 13 decisions): revised with D-1's pick before the plan's
  approval stands; its amendments of ADR 0022 (decision 12) and ADR 0026 (decision 13) are already in
  it.
- ADR 0034 and ADR 0035 (`release.md`, the merge numbering); ADR 0036 (the gates).

## Open Questions

- The exact envelope text and the task's id form come from P-2; they change the hook's regex and the
  test fixtures, not the specs or the task list.
- The cron interval is `*/5` unless P-6 shows the host needs another; that would revise AC-15.
