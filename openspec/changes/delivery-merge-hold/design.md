<!-- devkit-stage design result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Design

Change: `delivery-merge-hold` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Decision: [ADR 0025](../../../docs/adr/0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md)
(proposed; `decisions.md`). Specs: `specs/merge-turn/spec.md` (new), `specs/change-coordination/spec.md`
and `specs/roadmap-coordination/spec.md` (ADDED requirements).

## Context

See `proposal.md` (Why). What the code does today, read at `bfd5c0a` (the merge of `main` at `ea482c0`,
which brought `delivery-train` (PR 93, ADR 0022), `stage-models` (PR 91, ADR 0023) and `compozy-driver`
(PR 94, ADR 0024) on top of `roadmap-sessions-upfront` and its ADR 0021):

| Where | Today |
|---|---|
| `plugins/openspec/hooks/deliver-check.mjs` `nextStep` (line 1669) | First match wins. A train project first disables auto-merge on a change's own pull request (1677); in merge mode `disable-auto-merge` when auto-merge is on and an item drops (1681); `blocked` item 5 with `conflict` (1784, not in a train project); `update-branch` when item 5 is open only because the PR is behind (1785, `merge && !train`); `push` (1788); `edit-pr-body`, `fix-checks`, `answer`, `wait-checks` (not in a train project, 1849); the `left` row (1850); the train's `on-train` and `boarded` (1853-1854); `enable-auto-merge` or `wait-merge` (1857-1858) |
| `deliver-check.mjs` `archiveNext` (line 1532), `archiveHeads` (line 623) | For an open archive PR in merge mode: `disable-auto-merge` (1605 for a train, 1606), the held stops, `stop-archive` on a conflict (1610, not for a train), the head rows, the failing checks, `update-branch` when behind (1619, not for a train), the train rows A1 to A5 (1620-1629: `wait-train`, `rejoin-archive`, `on-train`, `boarded`), `enable-auto-merge`, `wait-merge` (1632-1633). An archive PR is opened from `chore/archive-<id>` or `archive-<id>` (`archiveHeads`) |
| `deliver-check.mjs` `deliveryConfig` (line 152, `MODEL_SHIP` 142), `collectState` (line 1884), `listFound` (line 611) | `deliveryConfig` returns `{ model, ship, mergeMethod, base, testBranch, train }`: `trunk-auto` is `ship: 'merge'`, `train` is the accepted `devkit.delivery.train` command or null, and a refused train key throws `ShipConfigError`. `collectState(root, id, { env, gh, prNumber })` reads `train` as `trainSuite` (1889), turns the train's facts on with `trainOn` (1892, a train and a devkit script), reads files, git and GitHub, writes nothing and never fetches. The `--ci` check calls it too. CI downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` (`docs/openspec-flow.md` lines 733-735; "the job downloads the same three files", line 741), so `deliver-check.mjs` imports no new file (its imports, lines 7-19: `node:` modules, `./merge-setup.mjs`, `./guard.mjs`) |
| `conduct-check.mjs` `actorOf` (line 71, lists `MAIN` 62 and `GITHUB` 66, which now holds `on-train` and `wait-train`), `deliver` (line 321), `conflictedPaths` (line 355), `ADR_DIRS` (line 376), `adrClash` (line 378), `releaseConflict` (line 406), `trainRejoin` (line 443), `deliveryRow` (line 465) | Maps each step to an actor. `deliveryRow` returns the plain row for `disable-auto-merge` and for `rejoin-train`, else applies `adrClash` (the `renumber-adr` hand-off when the base took the branch's ADR number, ADR 0021 decision 7), then `releaseConflict` (a `blocked` item 5 conflict, or an archive conflict, becomes `resolve-release-conflict`, `push`, `open-archive-pr`, `update-branch` or stays a `blocked` stop when a path is outside the release files or `git merge-tree` cannot classify it), then `trainRejoin` (an archive that left a train). Its own `deliver` passes no turn option |
| `change-loop.mjs` `readDevkitSettings` (line 120: `driver`, and `train` when the train key is set or refused), `ROWS` (line 1018, with `renumber-adr` and the train's rows), `decide` (line 1156, `planPart` 1250 at the call 1246), `blockedEnd` (line 1323), `buildPart` (line 1333), `nextAction` (line 1432, reads `settings` at 1437, `deliveryRow` at 1472) | Each delivery step is a hand-off, a session step (runs `detail.command`) or an end; `wait-checks`/`wait-merge` end `waiting-on-github` with `what`; `decide` reads the delivery row only when `inDelivery` (line 991), which is false for a blocked end and for a stage whose flow `part` is not in `BUILD_PARTS` (line 979); `githubSilent` (line 987) turns `gh-error`/`checks-unreadable` into the wait `waiting-github` with `what: 'silent'` (line 1324). The CompozyOS driver asks the same `nextAction` through `next --view compozy` (ADR 0024) |
| `change-loop.mjs` `waitLoop` (line 2402), `isWait`/`decisionKey`/`isUnreadable` (lines 2391-2396), `runWait` (line 3129) | The session's wait on GitHub with no time limit: polls `nextAction` every 60 s until the decision key (which holds the `reply`) changes; a poll with `what: 'silent'` is a failed read, and three in a row end blocked (`failWhy`, default `github-unreadable`). `waitLoop` takes `waiting` and `failWhy` |
| `change-loop.mjs` `claimOnOrigin` (line 2252), `NAME` (line 1947), `LS_REMOTE_TIMEOUT_MS` (line 1984), `PUSH_RACE` (line 2087), the claims listing in `remoteClaims` (line 2020), `render` (lines 786-791) | The create-only push precedent; the change-id rule; the 15 s listing timeout; the lost-race pattern; `remoteClaims` lists `ls-remote --heads` only, so no ref under `refs/devkit/` reaches it; `render` throws `LoopUsageError` on a missing parameter |
| `roadmap-loop.mjs` `decideRoadmap` (line 318; `emit` 424; the place `wake` 469-486 with its `woken:<n>` key; the end 488-512; the extras 514-529), `boardOf` (line 552, its blocks at 621), `collectRoadmap` (line 746), `readyText` (line 864) | Pure decision; the place `wake` `{ change, kind: 'wake', machine, message, progressKey: 'wake' }` is the precedent of the coordinator's message; the board's blocks in order machines, owner, running, blocked, queue, outside |
| `roadmap-loop.mjs` `sessionDecide`/`sessionNext` (lines 1040, 1113), `staleWaits`/`tidyWaits` (lines 1192, 1373), `decide` (line 1386, shared by `run` 1436, `next` 1496 and `check` 1869), `waitCmd` (line 1743), `compozyStartCmd` (line 1633) | A change session the run started runs `roadmap-loop.mjs session-next` (the change loop's action through `sessionDecide`) and, at `waiting-on-github`, `roadmap-loop.mjs wait` in the background, which polls `nextAction` through `waitLoop` and is recorded in the run file's `waits` (kind `github`). The periodic check (`check`) and every end stop the stale waits: those of a change no longer open or archived, and all but the newest of one kind of one change. On the CompozyOS driver `compozy-start` starts a CompozyOS run instead of `run`, and never reaches `decide` |
| `run-file.mjs` `emptyRun` (line 14), `readRun` (booleans at line 41) | The run file's fields, each named in ADR 0013 decision 4 (now including `turn`, `tickets`, `occupied`, `queued`, `anyway`, `waits`, `cron`, `check`); `roadmap-loop.test.mjs` "followups AC-3 run file" (line 2706) pins that the two lists are equal, reading every backticked word of decision 4 as a field |
| `guard.mjs` `changeFlow` (line 524), `readTrainSetting` (line 203), `openspec/schemas/<script>/flows/<n>.json` | A change follows the flow version its `.openspec.yaml` pins (`x-devkit-flow`, version 1 when absent); `devkit` and `devkit-lite` are at version 2, which differs from 1 only in the grill's helpers |

ADRs read and applied: 0002 and 0003 (auto-merge conditions; amended by ADR 0022 for a train project
and by ADR 0025 for a run without one), 0006 decision 3 (a lone `/devkit change` schedules nothing;
amended by ADR 0021 for a roadmap run), 0010 decision 5 (hooks veto, the loop drives), 0011 (the
session waits on GitHub in the background), 0013 decision 4 (run file fields; amended), 0014 (a session
per change), 0017 (state derived in one place; ⏳ for a wait on GitHub), 0018 (delivery models;
`two-prs` enables no auto-merge), 0020 (`origin` is the only shared thing; the `wake`; its rejected
alternatives), 0021 (every change opened at the start, change sessions on the run's ticket, one periodic
check, the ADR renumber step), 0022 (the delivery train: opt-in for `trunk` and `trunk-auto`, boarded
changes never `update-branch` or enable auto-merge, decisions 2, 9 and 10), 0023 (the model by stage;
nothing of it touches the delivery rows), 0024 (the CompozyOS driver: `compozy-start`, `next --view
compozy`; proposed), 0025 (this change).

### What `main`'s newer rules mean for the turn

- **A change keeps the flow it opened with** (`flows/<n>.json`, `docs/openspec-flow.md` "The flow a change
  follows"). This change adds no stage and no stage field, so it releases no new flow version and
  `scripts/released-flows.json` is untouched. The plan-part leave (D-7) reads the stage's `part` from the
  flow the change follows, through the same `collectFlow`/`changeFlow` read `inDelivery` uses; `part`
  is identical in `flows/1.json` and `flows/2.json` of both scripts (`open`, `plan`, `build`, `after`,
  `delivery`, `close`), so a change on flow 1 and one on flow 2 get the same answer.
- **The `devkit-session` skill.** A change session the run started on this machine runs
  `roadmap-loop.mjs session-next`, carries out a `session` step as the `devkit` skill's Loop says (so
  `join-queue` and `leave-queue` run `detail.command`, D-7) and, at a `waiting-on-github` end, starts
  `roadmap-loop.mjs wait` in the background. So `wait-turn` needs no new text in `devkit-session/SKILL.md`:
  its wait is that `wait`, which polls `nextAction` and therefore reads the turn at each poll. The three
  new steps sit at the stage `delivery` (part `delivery`), which `sessionDecide` neither holds nor counts
  as a place (`LOAD_PARTS` is `build`, `after`), so a change waiting for its turn holds no place.
- **The session cron of ADR 0021 decision 4.** Its periodic check runs `roadmap-loop.mjs check`, which
  decides through the same `decide` as `next`. So the check carries the turn's `wake` (D-8) when a
  hand-over happened since the last decision, and ends the queue when the run ends; it never writes an
  entry and never grants, takes or reorders a turn (ADR 0025 decisions 4 and 7). `staleWaits` keeps the
  newest wait of each kind of an open change, so the wait of a queued change, whose pull request is open,
  is never in the stale set while the change stays open; an end `done` or `stuck` stops every wait and
  removes the queue in the same decision (D-8), and an end `stopped` keeps the waits of open changes,
  which then read no marker and get the step they get without a queue.
- **The ADR renumber of ADR 0021 decision 7.** `adrClash` compares the branch's ADR files with
  `origin/<base>` at every call, so a merge into the base can hand `renumber-adr` to any change in
  delivery. D-5 keeps it out of a waiting change's way (the renumber is done in its turn) and D-4's
  `since` counts the renumber commit as base work, so the holder keeps its turn through it.
- **The delivery train (ADR 0022).** In a project whose `devkit.delivery.train` is accepted (models
  `trunk` and `trunk-auto`; `trunk-auto` ships in the `merge` mode), a ready change ends at `boarded`,
  `on-train` or `wait-train` and never at `update-branch`, `enable-auto-merge` or `wait-merge`. A
  boarded change meets this plan's joining condition (`ready`, D-5) and its step `boarded` is no keep
  step, so with a queue it would get `join-queue`, then `leave-queue` as holder, on alternate calls until
  `no-progress`. ADR 0025 decision 9 settles it: such a project records no queue. D-4 makes `state.turn`
  null there, D-7 hands no plan-part leave there, and D-8 pushes no marker and reads no board block
  there; the train's rows and tests stay as they are.
- **The CompozyOS driver (ADR 0024).** A project with `driver: compozy` starts a roadmap with
  `roadmap-loop.mjs compozy-start`, which pushes no marker (ADR 0025 decision 9), and its loop asks
  `change-loop.mjs next --view compozy`, which is `nextAction`. D-4 has `nextAction` read the turn only
  on the Claude driver, so a stale marker on `origin` cannot hand `join-queue`, `leave-queue` or
  `wait-turn` to the CompozyOS loop, whose `change-coordinator` (`.compozy/agents/change-coordinator/AGENT.md`,
  step 3) lists none of them and needs no edit.

## Goals / Non-Goals

**Goals:** the queue and its turn on `origin`, readable from any machine; the lock inside the change's
own loop (delivery checker and change loop), with no hook; leaving and rejoining computed by each
change from its own facts; the coordinator's message only as a nudge; the board.

**Non-Goals:** everything the proposal's non-goals list; a hook that refuses `gh pr merge --auto`
(ADR 0025, rejected alternative); any change to the delivery train's rows, `train-loop.mjs` or the
CompozyOS kit; changing what the `--ci` check judges; any change to `flow-check.mjs`,
to a flow file or to `devkit-session/SKILL.md`; the turn in `conduct-check`'s own reads (D-4, reach of
AC-2).

## Decisions

### D-1 The queue is a set of refs on `origin`

- The marker: `refs/devkit/merge-run`, pointing at the commit of `origin/<default branch>` when the
  run pushed it. Its presence alone means "this repository holds a merge queue".
- An entry: `refs/devkit/merge-queue/<key>/<kind>/<id>`, where `<key>` is 13 digits (milliseconds,
  zero padded), `<kind>` is `delivery` or `archive`, and `<id>` matches the change-id rule
  (`NAME` in `change-loop.mjs`); it points at the pull request head the change joined with, a commit
  already on `origin`, so no object is pushed. Any other ref under `refs/devkit/` is ignored.
- Order: by `<key>`, then `delivery` before `archive`, then `<id>`. Two entries of one kind and id:
  the first in order counts; the change's next `turn` call deletes the other.
- Reading: one `git ls-remote origin refs/devkit/*` from the main checkout, timeout 15 s (the
  `LS_REMOTE_TIMEOUT_MS` of `change-loop.mjs`, copied as a constant into `deliver-check.mjs`). The
  parser reads `<sha>\t<ref>` lines; a line of any other form is skipped; an empty answer is "no marker".
  `remoteClaims` lists `--heads` only, so the claims of ADR 0020 never see these refs.
- Writing: only `change-loop.mjs turn` (entries) and `roadmap-loop.mjs` (marker, and every ref at the
  run's end). A create is `git push --atomic origin --force-with-lease=<ref>: <sha>:<ref>` (create only,
  as `claimOnOrigin` does); a delete is `--force-with-lease=<ref>:<sha> :<ref>`. No command holds
  `--force` and no branch is touched (the `change-coordination` scenario "No step pushes by force"
  stays true: its scan reads `deliver-check.mjs` and the release override, and these commands live in
  `change-loop.mjs`/`roadmap-loop.mjs`).
- Why refs: ADR 0025 decision 6 (see `decisions.md`) settles refs outside the branches, and its
  Alternatives set aside a file on a branch (a commit per join and leave that the `devkit` ruleset and the
  claims reader would both see, and a lost update on every race without a compare-and-swap). One ref per
  entry means each change writes only its own entry, so two writers never lose each other's write. The
  same decision records why ADR 0020's rejected "claim ref outside the branches" does not apply.
- Task 1.1 probes that GitHub accepts a create and a delete under `refs/devkit/` before anything is
  built on it; if it refuses, the work stops for a plan revision (fallback named there: the same
  layout under `refs/heads/devkit-merge-queue/`, which would be branches and so needs ADR 0025
  decision 6 revised first).

Alternatives: one JSON file on a `devkit-merge-queue` branch (a visible branch, a lost update on every
race, a commit per join); the run file (does not reach another machine, ADR 0020); GitHub labels or a
pull-request comment (needs an API write per move and an order GitHub does not keep).

### D-2 Joining, and the race

`change-loop.mjs turn <id> --join --kind <delivery|archive> --head <sha> [--lang <l>]`:

1. List the queue (D-1). No marker: remove a stale record (D-6), exit 3, "no merge queue on origin",
   nothing pushed.
2. Read each listed entry's pull request (D-3); the entries whose pull request merged, was closed or
   does not exist are dead.
3. An entry of this kind and id already listed and alive: write the record (D-6) and exit 0.
4. Key = max(now in ms, the largest listed key + 1). Push, in one `--atomic` push, the create of the
   own entry and the delete of every dead entry under its listed sha.
5. List again. When an entry that step 1 did not list sorts after the own entry (a joiner that did not
   see this one and may already act as if it were ahead), delete the own entry and go back to step 4
   with the new listing.
6. Write the record (D-6); print `{ version: 1, change, kind, ref, position, holder }`, exit 0.

Steps 1 to 5 run at most 5 times. A push refused because a ref moved (`stale info`, `already exists`,
the `PUSH_RACE` pattern) goes back to step 1 within the same 5 tries. After the fifth: exit 3, "the merge
queue kept moving", with no entry of this change left on `origin` (step 5 deleted it, or step 4 created
none) and the record unchanged. Any other failure is exit 3 with git's first line. This is the retry ADR
0025 decision 6 asks the plan to name; it never moves an entry ahead of one that was already listed, so
a holder is never displaced by a later joiner (proof: `change-loop.test.mjs`, the `merge-turn AC-1 race`
tests, with a scripted second joiner in the `beforePush` style of the open race).

`turn <id> --leave --kind <k>`: lists, deletes every entry of this kind and id under its sha (absent is
success), removes that kind from the record (the file when no kind is left); exit 0. `--kind all` (the
plan-part leave and a corrupt record) deletes both kinds. A listing with no marker is not an error for
`--leave`: nothing is pushed, the record is removed, exit 0 (this is how a stale record, D-4, goes). A
listing that fails: exit 3 with git's first line, the record kept, so the next loop call hands the
same leave again (and the loop's K1 rule ends it blocked `no-progress` if nothing changed).

A session step that exits 3 is carried out as the `devkit` skill says for any session step: the loop's
next call reads the facts again (a `join-queue` handed again after "no merge queue on origin" cannot
happen, because with no marker `state.turn` is null and T8 does not fire).

### D-3 Who holds the turn

An entry is alive while its pull request is open. Delivery: `gh pr list --head <id> --base <default>
--state all --limit 10 --json number,state,url`. Archive: the same call once per name of
`archiveHeads(id)` (`chore/archive-<id>`, then `archive-<id>`, `deliver-check.mjs` line 623), the
results joined. The pull request read is the open one when the list holds one, else the newest by number
(the rule of `listFound`, `deliver-check.mjs` line 611). Merged, closed or none: dead, skipped by every
reader. A `gh` that fails: alive, marked `unread` (a holder is never skipped on a silence). The holder is
the first alive entry. A change reads the entries in order and stops at the first alive one (the holder),
or at its own entry when every entry ahead is dead, so a waiting change makes one `gh` call per poll
(two for an archive entry ahead) when no dead entry sits ahead of it (dead entries are pruned by the next
join, D-2 step 4). `ahead` is the nearest entry before the change's own that was not read dead. The board
reads all of them.

### D-4 The turn facts in the delivery checker

`collectState(root, id, { env, gh, prNumber, turn = false })` (today's options are `env`, `gh` and
`prNumber`, line 1884). Only `change-loop.mjs nextAction` and the non-`--ci` `deliver-check <id>`
command (its `collectState` calls in `main`, line 2664 and the two after a `--watch`, 2671 and 2675) pass
`turn: true`, and `nextAction` only on the Claude driver: it passes `turn: queueable`, with
`queueable = settings.driver === 'claude' && settings.train === undefined` read from the
`readDevkitSettings` it already calls (line 1437), so a project with `driver: compozy` (ADR 0024) or with
a train key, accepted or refused, reads no queue through the loop. The `--ci` check and every other
caller keep `false`, so they read no queue (AC-7, and the CI check is unchanged).

**Reach of the lock (AC-2).** `nextAction` is the read of `change-loop.mjs next` and `wait`, of
`roadmap-loop.mjs session-next`, `session-wait`, `wait`, `next`, `check` and `status`, of the stop lock and
of `change-loop.mjs state`; with `deliver-check <id>` and `ship-change` they are every driver of a change
in a roadmap run on the Claude driver, and all of them read the turn. `conduct-check.mjs` keeps `turn`
false in its own `deliver` (line 321): its CLI and the panel's reads of it read no queue, so they can
still name `enable-auto-merge` for a queued change. That is the honest reach of AC-2's "never":
auto-merge is never enabled out of turn by the devkit loops and `ship-change`. The CompozyOS driver asks
`nextAction` too (`next --view compozy`), but in a project whose driver is `compozy` `queueable` is false
and its roadmap starts with `compozy-start`, which pushes no marker (D-8), so it never holds a queue
(ADR 0025 decision 9); its `change-coordinator` is never handed the three steps, and its step 3 list needs
no edit. When auto-merge was turned on out of turn all the same, the change's own next loop call disables
it (T5) once the change is queued. Passing `turn: true` from `conduct-check` is not done: it would add a
listing of `origin` to every conduct row and panel refresh for readers that drive nothing.

`state.turn` is `null`, decided in this order before any listing of `origin`, when `turn` is false,
`ship !== 'merge'` (this excludes `trunk` and `two-prs`, ADR 0018 decision 2), the project's delivery
settings carry a train (`trainSuite !== null`, the `train` of `deliveryConfig` that `collectState`
already reads at line 1889; any change of the project, whether or not its script makes `trainOn` true;
ADR 0025 decision 9, ADR 0022 governs that project), the project's `devkit.driver` is `compozy` (read
with `parseDevkitBlock`, which `deliver-check.mjs` already imports from `guard.mjs`, so `deliver-check
<id>` and `ship-change` run in a CompozyOS project read no queue either), or there is no `origin`; and
after the listing when
it is readable and holds no marker, whatever the change's record (D-6) says. In a train project nothing
is listed and no record is read, so the three unreadable cases below never apply there, and the train's
rows (`boarded`, `on-train`, `wait-train`, `rejoin-train`, the archive rows A1 to A5) come out of
`plainStep` exactly as today. A refused train key never reaches this point: `deliveryConfig` throws
`ShipConfigError` first, and the checker exits 3 with the setting's text as today. A record with no
marker is **stale** (left by a run that ended while
the change was open, D-8) and is ignored. `own` is always read from the listing, never from the
record, so a stale record from an earlier run, in a later run with a new marker, gives `own: null` and
T8 `join-queue`. A listing that fails gives `readable: false` in exactly three cases: the record shows
an entry, the record is corrupt, or this clone's run file records `mergeQueue: true`; otherwise `null`
(below). The run file is read by a local reader in `deliver-check.mjs`, never through `run-file.mjs`:
the `devkit-reviews` CI job downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`
(`docs/openspec-flow.md` lines 733-735), so a static import of a fourth file fails the check at load time.
The reader resolves `git rev-parse --path-format=absolute --git-common-dir`, reads
`<git common dir>/devkit/roadmap-run.json` and returns `mergeQueue === true`; any error (no git, no file,
not JSON, not an object, a field that is not a boolean) reads as false. A test in `deliver-check.test.mjs`
(task 2.1) asserts that the `import` lines of `deliver-check.mjs` name only `node:` modules,
`./merge-setup.mjs` and `./guard.mjs`. Otherwise:

```
{ readable: true, kind, own: { key, sha, ref } | null, holder: { id, kind, number, url } | null,
  holds: boolean, ahead: { id, kind } | null, position, total,
  since: { ok: boolean, commit: <short sha> | null },
  join: [<command>], leave: [<command>] }
| { readable: false, error, leave: [<command>] }   // only in the three cases above
```

`kind` is `archive` on the archive branch or in the post-merge phase, else `delivery`. `since` walks
`git rev-list --first-parent --parents <own.sha>..HEAD`: `HEAD` must descend from `own.sha`; a commit
with two or more parents is a merge of the base when its second parent is an ancestor of
`origin/<base>`; a one-parent commit is allowed when `git diff-tree --no-commit-id --name-only -r` lists
only paths under `openspec/`, or when `git diff-tree -M --no-commit-id --name-status -r` lists at least
one rename of a file under `docs/adr/` or `docs/decisions/` from `<nnnn>-<slug>.md` to `<mmmm>-<slug>.md`
with the same slug (the `renumber-adr` commit of ADR 0021 decision 7, whose reference rewrites may touch
any file; `ADR_DIRS` of `conduct-check.mjs`, copied as a constant because `deliver-check.mjs` imports no
new file); the first other commit makes `ok` false and is named. The commands are
`node <hooks dir>/change-loop.mjs turn <id> --join --kind <k> --head <sha>` and `... --leave --kind <k>`,
built from `deliver-check.mjs`'s own folder (both files ship side by side in `plugins/openspec/hooks/`).
A listing that fails outside the three cases is read as no queue (as every lock lets an action through
when it cannot read; GitHub's own `gh pr merge` fails too then).

### D-5 The rows

`nextStep(state)` becomes `turnStep(state, plainStep(state))`; `plainStep` is today's function with one
mask. **Mask:** when `state.turn` is readable and the change does not hold the turn, item 5 open only
because the PR is behind, or blocked only by a conflict, does not fire the `blocked` conflict row
(1784), `update-branch` (1785) or `push` (1788), and the `left` row (1850) skips item 5. So a change
outside the queue or waiting in it never merges the base. With `state.turn` null the mask is off and
`turnStep` returns the plain step (row T0 below).

**Ready at its head** (`ready(state)`): the PR is open; items 1, 2, 3, 4, 7 and 8 are met; item 5 is met,
or open only because the PR is behind, or blocked only by a conflict, with nothing local ahead of the PR
head and nothing uncommitted; item 6 has no failing check and is not blocked (pending checks allowed).
**Still ready to wait** (`waitable(state)`): `ready` without its clause "nothing local ahead of the PR
head and nothing uncommitted". It is used only for a change already queued (T6): a local commit or an
uncommitted file does not by itself lose a place; a committed product change does, through `since`
(which walks to the local `HEAD`), and the holder pushes what is local through its keep step `push`.
`ready` keeps the clause for joining (T8). A conflict counts as ready here; which conflicts may join is
decided in `deliveryRow` below, where the classification lives.

**Keep steps of the holder:** `update-branch`, `push`, `verify`, `review`, `edit-pr-body`, `answer`,
`wait-checks`, `enable-auto-merge`, `wait-merge`, `disable-auto-merge`, and `blocked` item 5 with
`conflict` (the release override decides it, below). `renumber-adr` and `resolve-release-conflict` are
overrides of `deliveryRow` applied on top of a keep step, so they keep the turn too.

| Row | When | Step |
|---|---|---|
| T0 | `state.turn` null: `turn` false, no marker, no `origin`, `ship` not `merge` (`trunk`, `two-prs`, `plan`), a project with a train, or `driver: compozy` (D-4) | the plain step, unmasked: today's step; in a train project `boarded`, `on-train`, `wait-train`, `rejoin-train` and the archive rows A1 to A5 as ADR 0022 has them, never `join-queue`, `leave-queue` or `wait-turn` |
| T1 | not readable, the plain step is `update-branch` or `enable-auto-merge` | `wait-turn` with `unreadable: true` and `error` (no `holder`) |
| T2 | not readable, any other plain step | the plain step |
| T3 | own entry, holds the turn: the plain step is a keep step and `since.ok` | the plain step |
| T4 | own entry, holds the turn: otherwise | `leave-queue` (`kind`, `command`) |
| T5 | own entry, waits, auto-merge on | `disable-auto-merge`, reason "auto-merge is on out of turn; <holder> holds the merge turn" |
| T6 | own entry, waits, `waitable` and `since.ok` | `wait-turn` (`holder`, `number`, `url`, `ahead`, `position`, `total`, and `conflict: true` when item 5 is blocked by a conflict) |
| T7 | own entry, waits, otherwise | `leave-queue` |
| T8 | no own entry, `ready` | `join-queue` (`kind`, `head`, `command`, and `conflict: true` when item 5 is blocked by a conflict) |
| T9 | no own entry, not ready | the plain step (masked) |

`archiveNext` gets the same rows for an open archive PR in merge mode (T0 in a train project, whose
archive boards as ADR 0022 says), with **ready** = answers and
files checked (`held` null), no failing check, head `same`, nothing uncommitted (behind and a conflict
allowed; for T6 `waitable` drops "nothing uncommitted"), the mask on its conflict stop and its
`update-branch`, and the keep steps `update-branch`, `open-archive-pr` (the push), `stop-archive` with
`conflict`, `enable-auto-merge`, `wait-merge`, `disable-auto-merge`. An archive entry that holds the turn
and is behind gets `update-branch`, then `enable-auto-merge` (T3); one whose check fails, whose answers
or files stop being checked (`held` not null), or whose `since` is not ok, gets `leave-queue` (T4); a
waiting one gets `wait-turn` (T6) or `leave-queue` (T7), as a delivery does. Its conflicts follow the
conflict rule below, as a delivery's do.

**`conduct-check.mjs`.** `actorOf` puts `join-queue` and `leave-queue` in `MAIN` and `wait-turn` in
`GITHUB` (beside `on-train` and `wait-train`). `deliveryRow` decides, in this order, after its existing
`disable-auto-merge` and `rejoin-train` returns (line 465); none of the three rules fires when
`d.state.turn` is null (T0), so a train project's rows, `trainRejoin` included, are as today:

1. **A waiting change does not act on the moving base.** When the delivered step is `wait-turn` or
   `leave-queue`, `adrClash` is not applied (the renumber comes in the change's turn, after its base
   merge); a `wait-turn` with `conflict: true` goes through the conflict rule (3).
2. **The holder and every other step**: `adrClash`, then `releaseConflict`, then `trainRejoin`, as today.
   When the result is the `blocked` stop of `releaseConflict` (a path outside the release files, a
   conflict `git merge-tree` cannot classify, or a PR head not in local history) and
   `d.state.turn?.own` is not null, the row is
   `leave-queue` with `d.state.turn.leave` as its command and the stop's message as its reason.
3. **The conflict rule (old M-1).** For `join-queue` (after `adrClash`, which renumbers before joining)
   and `wait-turn` with `conflict: true`, `releaseConflict` is asked as if the delivered step were the
   plain conflict step (`blocked` item 5 with `conflict`, or `stop-archive` at `archive-pr` with
   `conflict` for an archive). Its `blocked` stop gives: for `join-queue`, that stop itself (the step the
   change gets without a queue); for `wait-turn`, `leave-queue` with the stop's message. Any other answer
   (`resolve-release-conflict`, `push`, `open-archive-pr`, `update-branch`, none) keeps the delivered
   step: the change joins or keeps waiting, and the release-file conflict is resolved in its turn.

So only a change whose conflict is release-only (or that GitHub reports in conflict but that merges
cleanly) joins or stays queued. A change in a conflict the release override cannot resolve never gets
`join-queue`; after a `leave-queue` its next call gets the plain `blocked` stop, and every call after that
the same stop until the conflict is resolved by hand, so `join-queue` and `leave-queue` cannot alternate
(K1 compares only with the action just before, so this is what ends it, not K1). The classification is
the same at the first join and after a leave.

`ship-change` run alone reads `deliver-check` without `conduct-check`, so it has no classification: its
`join-queue` row stops with `blocked: item 5 (conflict with the base)` when `next.conflict` is true, and
the change loop classifies the conflict on its next call.

`describeNext`/`summaryOf` (deliver-check) gain the three steps: `wait-turn` reads
`waiting for the merge turn behind <holder> (PR #<n>)`, and with `unreadable` `waiting for the merge
turn: the queue on origin cannot be read`.

The settled point of ADR 0025 decision 5: **(b)**, only `enable-auto-merge` (and the base merge that
precedes it) is held. In `trunk` the step `ready` is a report to the owner, who merges by hand whatever
devkit says; holding it would hide a ready pull request without preventing a merge, as ADR 0018
decision 2 says of `two-prs`. So the queue exists only where devkit itself enables auto-merge, and a
`trunk` project behaves as today.

### D-6 The change's own record

`<git common dir>/devkit/merge-queue/<id>.json`, written by `turn` only:
`{ "version": 1, "entries": { "<kind>": { "ref", "sha", "key", "at" } } }`. It lets the loop know,
without reading `origin`, that the change is queued when it is back at its plan. A file that is not
JSON, is truncated, has no `entries` object, or an entry without a string `ref`: **corrupt**, read as
"queued, entries unknown" (the leave then deletes every entry of the id it lists, `--kind all`). An
empty file is corrupt too. A missing file: not queued.

The record is a hint, never the truth: the delivery checker reads `own` from `origin` (D-4), and the
record only decides (a) the plan-part leave of D-7, which `nextAction` hands without reading `origin`,
and (b) whether a failing listing reads as `readable: false`. A **stale** record (no marker on
`origin`) is removed by: the run's end on the clone that ran it (D-8 deletes every file under
`<git common dir>/devkit/merge-queue/` of that clone, and the folder); on any other clone, the change's
next `turn` call (`--leave` of the plan-part leave, or a `--join`), both of which remove it when they
list no marker. A stale record on a change that goes on in delivery with no new run is ignored while
`origin` can be listed (D-4); its one effect is that, while `origin` cannot be listed, the change gets T1
(`wait-turn` with `unreadable`) instead of `update-branch` or `enable-auto-merge`, which ends at the first
readable listing. It is removed at the change's next `turn` call, or stays as an inert file. The run
file stays the only file the run itself keeps there (`roadmap-loop.test.mjs` line 949 reads a folder in
which no record is written). In a project with a train, or on the CompozyOS driver, the record is never
read (D-4's `queueable`, D-7's condition 6): one left from before the train was turned on stays an inert
file.

### D-7 The change loop

- `ROWS`: `join-queue` and `leave-queue` are `session('delivery')` (the session runs `detail.command`,
  as the `devkit` skill's `session` item says); `wait-turn` is `{ end: 'github' }`.
- `buildPart`, case `github`, for `wait-turn`: the end is `waiting-on-github`, `why` stays
  `waiting-github`, and:
  - with `holder` (T6): `params.what` is `turn` and the reply is the new key `turn-waits` with
    `{ id, holder, number }`;
  - with `unreadable` (T1, no `holder`): exactly the end `blockedEnd` gives a silent GitHub (line 1324):
    `params.what` is `silent`, the reply is the existing key `waiting-github`, and the detail is
    `{ error }`. `turn-waits` is never rendered without a `holder`, so `render` cannot throw there, and
    `waitLoop`'s `isUnreadable` counts the poll as a failed read: three in a row end the wait blocked
    (`github-unreadable` for `change-loop.mjs wait`, `unreadable` for `session-wait`, which never sees
    this end).

  The key `turn-waits` does not start with `waiting-`, because `roadmap-loop.test.mjs` (the test listing
  every `waiting-` key as an owner gate, line 581, filter at 588) pins that set. `changeState` then reads `what.turn`;
  the title is ⏳ with the stage icon, as for any wait on GitHub (ADR 0017 decision 4; ADR 0021 decision
  5 changes only a held change session's title, and a change waiting for its turn is not held).
- `decide`, before `planPart`: the action is the session step `leave-queue` with `--kind all` (the
  "back to the plan" case of AC-4), at the stage `delivery`, exactly when all of these hold, and never
  otherwise:
  1. the record (read by `nextAction` as `facts.queued`, D-6) holds an entry or is corrupt;
  2. the change is not `archiving`;
  3. `report.script !== 'previous'`;
  4. `report.end?.state` is not `blocked` (whatever its `reasonCode`);
  5. the current stage, `report.next?.stage ?? report.end?.stage`, has a `part` of `open` or `plan` in
     the flow the change follows (the parts before `build`; `BUILD_PARTS` is `build`, `after`,
     `delivery`, `close`);
  6. the project is `queueable` (D-4: the Claude driver and no train key). `nextAction` reads the
     record into `facts.queued` only then, and sets it false otherwise, so a project with a train or on
     the CompozyOS driver is never handed this leave (ADR 0025 decision 9).

  This is a new pure helper `backAtPlan(report, flow, archiving)` beside `inDelivery` (line 991; it
  checks conditions 2 to 5, and `decide` calls it only when `facts.queued` holds conditions 1 and 6), not
  `!inDelivery`: `inDelivery` is also false for every blocked end, and those keep the entry. The
  blocked ends that keep the entry, named: `gh-error` and `checks-unreadable` (`githubSilent`, a wait
  on GitHub), `no-progress`, `ceiling`, `gh-too-old`, and `pr-closed` (the entry of a closed pull request
  is dead by D-3 anyway, and the next join prunes it). A change sent back to its implementation (a
  rejected review, a red check) is in the `build` or `after` part, so `inDelivery` holds and the
  delivery checker's own rows give `leave-queue` (T4, T7). The stage `delivery` keeps the step out of
  `sessionDecide`'s plan holds (its `part` is `delivery`).
- `turn` subcommand in `main`, with usage errors exit 3 as the other subcommands. The name does not
  collide with the run file's `turn` field (`typed` or `event`, the kind of the coordinator's turn) nor
  with `roadmap-loop.mjs next --turn`: those name the coordinating session's turn, this one the merge
  turn, and neither reads the other.

**The wait.** A change that waits ends `waiting-on-github`, so its session starts the wait on GitHub
it already starts for `wait-checks`: `change-loop.mjs wait` from the `devkit` skill (a lone change, or a
change on another machine typed with `/devkit-openspec:devkit change <id>`), or `roadmap-loop.mjs wait`
from the `devkit-session` skill (a change session of this machine on the run's ticket). Both poll
`nextAction` through `waitLoop`. The wait ends when the decision changes: the turn arrives (the step
becomes `update-branch` or `enable-auto-merge`), the holder changes (the reply names another), or the
change must leave. This is the "session reading the turn when its loop runs" of the requirements, and
it is ADR 0025 decision 7 (see `decisions.md`): nothing passes the turn by time (ADR 0025 decision 4 and
its rejected "A timer or the run's periodic check (ADR 0021 decision 4) passes the turn"); the turn passes
only when a pull request merges or closes or an entry leaves. Decision 7 records why ADR 0020 decision
5's rejected background poll of a machine's places does not apply (a change waiting for a place counted
from `origin` has no pull request and no wait on GitHub; a change waiting for the turn already keeps one
for its own checks and merge, so none is added). `roadmap-loop.mjs wait` is recorded in the run file's
`waits` as kind `github`, the newest of its kind for an open change, so the periodic check's
`staleWaits` never stops it while the change is open (ADR 0025 decision 7). Cost per poll of a waiting
change: one `ls-remote` and, by D-3's stop at the first alive entry, one `gh pr list` (two for an
archive ahead) when no dead entry sits ahead, beside the reads `nextAction` already makes; linear in the
number of waiting changes.

The CLI host and `ship-change` run alone (outside `/devkit change`) do not hold this wait: at
`wait-turn`, `ship-change` reports `waiting for the merge turn behind <holder> (pull request #<n>)`
(or that the queue cannot be read) and stops, on both hosts, as it stops at `ready`;
`deliver-check --watch` is not run there, because its `main` waits only at `wait-checks` and `wait-merge`
(`checksToWatch` at line 2632 and the `wait-merge` branch, `deliver-check.mjs` lines 2666-2676) and
returns at once at any other step. The next invocation, or the
coordinator's `wake`, reads the turn again. `deliver-check.mjs`'s `--watch` is unchanged.

### D-8 The roadmap run

- `run-file.mjs`: `emptyRun()` gains `mergeQueue: false` after `check`; `readRun` reads it with the
  other booleans (line 41). It is not in `OUTLIVES` (`change-loop.mjs` line 828): `run` sets it from the
  marker push every time. ADR 0013 decision 4 gains the bullet "whether the run keeps a merge queue on
  origin (`mergeQueue`), as ADR 0025 decides", with `origin` not in backticks, because the "followups
  AC-3 run file" test (`roadmap-loop.test.mjs` line 2706) reads every backticked word of decision 4 as
  a field; that test then passes unchanged.
- **Which project keeps a queue.** One helper in `roadmap-loop.mjs`, `keepsQueue(root)`, true exactly
  when all of these hold for the main checkout: `readDevkitSettings(root).driver` is `claude` and its
  `train` is undefined (no train key, accepted or refused: ADR 0025 decision 9, ADR 0022 governs a train
  project); `deliveryConfig(root, s).ship` is `merge` for `devkit` or `devkit-lite` (a
  `ShipConfigError` reads as not merge, so `trunk` and `two-prs` are out, ADR 0018 decision 2); and the
  repository has an `origin`. `deliveryConfig` is imported from `deliver-check.mjs` beside
  `locateChange` and `readPhases` (line 47), `readDevkitSettings` from `change-loop.mjs` (line 48). The
  same helper, not a copy, decides the marker, the board's read and the wake, so `run`, `status` and
  `next` agree on a project.
- `run` (not `run` with `stop`): when `keepsQueue`, push the marker (D-1, create only; one already there
  is kept) and set `mergeQueue: true`; a refused push sets `false` and prints the line
  `roadmap-turn-off` with git's first line. When not `keepsQueue` (no `origin`, no script in merge
  mode, a train key, the CompozyOS driver): nothing pushed, nothing listed, `mergeQueue: false`, no
  line; a marker already on `origin` (a train turned on during an earlier run) is left as it is and read
  by no change (D-4). `compozy-start` (line 1633) is not `run` and never reaches this code, so a
  CompozyOS run pushes no marker (ADR 0024 decision 3, ADR 0025 decision 9). (No existing
  `roadmap-loop.test.mjs` fixture sets a merge mode, and the `delivery-train` and `compozy-driver`
  fixtures are train or CompozyOS projects, so their `run` output is unchanged.)
- The end, in `roadmap-loop.mjs`'s `decide` (line 1386), so on `run`, `next` and `check` alike: when the
  decision has an `end` (`done`, `stopped` or `stuck`) and the run file records `mergeQueue: true`, one
  `--atomic` push deletes the marker and every listed entry under its sha, outside the run file's lock;
  then every record file under this clone's `<git common dir>/devkit/merge-queue/` is deleted with the
  folder (D-6; records on other clones are stale from then on and ignored, D-4), and the same
  `updateRun` that records the decision sets `mergeQueue: false`. A refused delete prints
  `roadmap-turn-left` with git's first line and keeps `mergeQueue: true` and the records, so the next
  decision that ends tries again.
- `collectRoadmap` (line 746) reads `mergeTurn: { readable, error, entries: [{ id, kind, alive, holds,
  ahead }] }` (D-1, D-3) whenever a roadmap exists and `keepsQueue` holds, and `mergeTurn: null` with no
  listing otherwise, so a `trunk`, `two-prs`, train or CompozyOS project reads no queue on the board
  whatever refs `origin` holds; `status` reads it the same way and writes nothing.
- `decideRoadmap`, the turn's `wake` (beside the place `wake` at lines 469-486): in a run with a session
  per change, not stopping, `mergeQueue` true, the holder's `<kind>:<id>` (or null) is compared with
  `announced['turn:merge']`. The key has a colon, as `machine:<host>`, `~later:<id>` and
  `~archived:<id>` do, so it can never be a change id (`NAME`, `change-loop.mjs` line 1947; `isChangeId`,
  `guard.mjs` line 1442) and never collides with the place wake's `woken:<n>`, which is a value under a
  change id's key. When the holder differs from the recorded one and the recorded one was not null (a
  hand-over, not a first entry):
  - when the new holder is open in this clone and the run file's `waits` lists a wait of kind `github`
    for it, no wake is sent: its own wait sees the turn (ADR 0025 decision 7, "whose turn arrived and is
    not waiting");
  - otherwise the action `{ change, kind: 'wake', why: 'turn', machine, session, message:
    '/devkit-openspec:devkit change <id>', progressKey: 'wake' }` is added (machine: this machine when
    the change is open in this clone, else its claim's machine; `session`: `sessionName(id)`, the name
    the run gave its session, which the `devkit` skill's `wake` item finds by the title ending in the
    change id), and the line `roadmap-turn` is emitted.

  In both cases the new holder (or null) is written to `announced['turn:merge']` in the decision's
  state, so each hand-over is handled once. No wake for a first entry, and none in a run without a
  session per change (its coordinator runs each change's GitHub wait itself, `kind: 'wait'`). A wait
  recorded for a process that died is a risk named below. The periodic check, deciding through the same
  `decide`, carries the same wake when the hand-over happened since the last decision.
- `readyText`: a `wake` with `why: 'turn'` reads "the merge turn of the change <id> arrived: tell it to
  go on"; the place wake keeps its text (the `roadmap-loop.test.mjs` assertion at line 4846 holds).
- `boardOf`: the block `status-merge-turn` goes between `status-blocked` and `status-queue` (the block
  list at line 621); one row per
  alive entry in order. Row id: the change id; text: `turn.holds` / `turn.waits` (`{ ahead }`), or
  `turn.archive-holds` / `turn.archive-waits` for an archive; `ahead` is the id, or `turn.archive-of`
  (`{ id }`) when the entry ahead is an archive. With `readable: false`: no block, the intro line
  `status-turn-unreadable`. No marker, or `mergeTurn` null (not `keepsQueue`): nothing.

### D-9 The messages (`MESSAGES` of `change-loop.mjs`, both languages)

| Key | en | pt-BR |
|---|---|---|
| `turn-waits` | `{id} waits for its turn to merge: {holder} merges first (pull request #{number}). I keep waiting with no time limit and go on by myself when the turn comes; calling /devkit change again is safe.` | `{id} espera a sua vez de fazer merge: {holder} entra antes (pull request #{number}). Eu continuo esperando, sem limite de tempo, e sigo sozinho quando chegar a vez; chamar /devkit change de novo é seguro.` |
| `what.turn` | `its turn to merge` | `a sua vez de fazer merge` |
| `roadmap-turn` | `The merge turn passed to {id}: I told it to go on.` | `A vez de merge passou para {id}: avisei para seguir.` |
| `roadmap-turn-off` | `The merge turn is off for this run: origin could not be written ({error}).` | `A vez de merge está desligada nesta rodada: não consegui escrever no origin ({error}).` |
| `roadmap-turn-left` | `The merge queue could not be removed from origin ({error}); I try again at the next end.` | `Não consegui tirar a fila de merge do origin ({error}); tento de novo no próximo fim.` |
| `status-merge-turn` | `Merge turn` | `Vez de merge` |
| `turn.holds` | `holds the merge turn` | `tem a vez de merge` |
| `turn.waits` | `waits behind {ahead}` | `espera atrás de {ahead}` |
| `turn.archive-holds` | `its archive holds the merge turn` | `o arquivo dela tem a vez de merge` |
| `turn.archive-waits` | `its archive waits behind {ahead}` | `o arquivo dela espera atrás de {ahead}` |
| `turn.archive-of` | `the archive of {id}` | `o arquivo de {id}` |
| `status-turn-unreadable` | `GitHub could not be read: the merge turn is not shown.` | `Não consegui ler o GitHub: a vez de merge não aparece.` |

None holds a backtick, a file name, an option, a hyphenated step name (`join-queue`, `leave-queue` and
`wait-turn` join the refused words by themselves, read from `deliver-check.mjs`) or a checker name, and
every key differs between the languages, as `change-loop.test.mjs` "change-loop replies: no internal term
in either language" (line 125) requires; `origin` is one word and allowed there. That test renders every
key with its `SAMPLE` parameters (line 86), and `render` throws `LoopUsageError` on a missing one
(`change-loop.mjs` lines 786-791); `holder` (`turn-waits`) and `ahead` (`turn.waits`,
`turn.archive-waits`) are not in `SAMPLE`, so the test changes (D-11). The other new parameters (`id`,
`number`, `error`) are there already. The unreadable wait reuses `waiting-github` and `what.silent`, so it
adds no key.

### D-10 Documents and records

- ADR 0002 and ADR 0003: the header line `- Amended by ADR 0025 (0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md)`
  after their ADR 0022 line (`- Amended by ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md)`,
  line 7 of each), and a dated Note in Context after the delivery-train Note (ADR 0002 line 20, ADR 0003
  line 26), written as those Notes are, saying that in a roadmap run of a project without a train the
  turn is one more condition before auto-merge, and that a train project follows ADR 0022 alone.
- ADR 0013: the same header line after its ADR 0021 line (line 6), a Note after the
  roadmap-sessions-upfront Note (line 26), and the decision 4 bullet of D-8.
- `openspec/config.yaml` `context` (the `ADRs:` line, line 32): the list gains "0025 a roadmap run grants
  one merge turn at a time in a project without a delivery train, amends 0002, 0003 and 0013" after the
  0024 entry, its last today; the 0022, 0023 and 0024 entries are not touched (`stage-models.test.mjs`
  line 1394 pins the 0023 entry's words).
- `docs/openspec-flow.md`: the delivery steps list (merge mode, "**Steps**", line 484); the
  `waiting-on-github` codes of "A change's state" (line 240) gain `turn`; the `ship-change` merge-mode
  steps table (lines 607-623); in "The delivery train" (line 672), one sentence that a project with the
  key keeps no merge queue in a roadmap run (ADR 0025 decision 9); in the roadmap coordinator section
  (line 332), the periodic check paragraph (line 344: it carries a turn's wake and grants no turn), the
  run-file paragraph (line 346, `mergeQueue`), "What it decides and says" (line 354, the turn's wake, the
  board's merge-turn block) and a new paragraph "**The merge turn.**", which names the projects that keep
  no queue (`trunk`, `two-prs`, a train, the CompozyOS driver); the CI pin (lines 731-732 and the "Pin
  the commit sha" paragraph, line 745) moves with the release.
- `docs/coordination-design.md`: a section "The merge turn" after "Where a change runs" (line 577).
- `CONTRIBUTING.md` lines 17 and 58: the sentences that ask the coordinator to "hold other merges" and
  for a "merge window" by hand say that a roadmap run holds them by itself (ADR 0025) and keep the
  version-number advice.
- `plugins/openspec/skills/ship-change/SKILL.md`: rows `join-queue` (run `next.command`, then continue the
  loop; with `next.conflict` stop `blocked: item 5 (conflict with the base)`), `leave-queue` (run
  `next.command`, then continue), `wait-turn` (report `waiting for the merge turn behind <holder> (pull
  request #<n>)`, or `waiting for the merge turn: the queue on origin cannot be read`, and stop, on both
  hosts; no `--watch`, D-7); the Report list gains those lines; Hosts says the merge turn is not waited on
  there.
- `plugins/openspec/skills/devkit/SKILL.md`: the `wake` item (line 195) also covers "a change whose
  merge turn arrived", on the same line (the `roadmap-loop.test.mjs` tests at lines 2670 and 4239 pin
  one `SendMessage` line). `devkit-session/SKILL.md` is unchanged (its test at line 3253 forbids a
  message tool there, and it needs no new row, see Context). The CompozyOS kit
  (`plugins/compozy/`, `.compozy/`) is unchanged: its loop is never handed the three steps (D-4).
- `plugins/openspec/README.md`: the `change-loop.mjs` row (line 29) names `place` and `turn`; the
  `roadmap-loop.mjs` row (line 31) says it keeps the run's merge queue on `origin`.
- `CHANGELOG.md`, `plugin.json`, `marketplace.json`: a devkit-openspec minor release, the next after the
  one on `origin/main` at the last merge before review (devkit-openspec 0.37.0 and marketplace 0.41.0
  at `ea482c0`, which holds 0.36.0 and 0.40.0).

### D-11 Existing tests (the grep the project rules ask for)

Grepped at `bfd5c0a` (the merge of `main` at `ea482c0`) for every step, key, field and doc sentence this
change touches:

| Test (file:line) | Asserts | Effect |
|---|---|---|
| `change-loop.test.mjs:125` (with `SAMPLE`, line 86) | every reply key renders in both languages with no internal term | **changed** (task 2.4): `SAMPLE` gains `holder: 'add-csv-import'` and `ahead: 'add-csv-import'`; the invariant (no internal term, keys differ between languages) and the test's assertions are untouched; it belongs to the replies layer and lives in `change-loop.test.mjs` |
| `change-loop.test.mjs:537` | every step `deliver-check.mjs` and the conduct overrides can return has a row, and every row is returnable | unchanged; passes once `ROWS` has the three steps (task 2.4); the conflict rule of D-5 adds no new step name |
| `change-loop.test.mjs:563` (line 568 builds each row) | the loop's agents match `actorOf` for every `ROW_STEPS` row | **changed** (task 2.4): the fixed detail of `rowOf(step, { phase: 1, number: 12, paths: [], branch: 'develop', base: 'main', list: '#12 to main' })` gains `holder: 'add-csv-import'`, because the `wait-turn` row renders `turn-waits`, which needs `holder`; `buildPart` does not fall back on a missing `holder` (a `wait-turn` without it is the unreadable form, which carries `unreadable: true`). The invariant (agents match `actorOf`) and its assertions are untouched; the three new steps are not hand-offs |
| `deliver-check.test.mjs:3211` | `ship-change` has a table row for every step `deliver-check.mjs` emits | unchanged; passes once task 2.5 adds the three rows |
| `deliver-check.test.mjs:4778` (line 4789) | `ship-change`'s Hosts section names the archive PR and the two waits | unchanged; task 2.5's Hosts sentence keeps both |
| `release-tags.test.mjs:538` (line 545) | `ship-change`'s Report section keeps the `tagged <tag> at <short sha>` sentence | unchanged; task 2.5 adds Report lines and keeps it |
| `release-tags.test.mjs:567` | CONTRIBUTING step 5 names `release_tag`, `tag-release`, the ADR 0019 link, `` `git tag v<x> <merge sha>` ``, "lightweight", "merge commit" | unchanged; task 5.3 edits line 58 inside step 5 and keeps every one of those parts |
| `roadmap-loop.test.mjs:581` (filter at 588) | every `waiting-` key but `waiting-github` and `waiting-place` is an owner gate | unchanged; the new reply key is `turn-waits` (D-7) and the unreadable wait reuses `waiting-github` |
| `roadmap-loop.test.mjs:949` | the run file's folder holds only `roadmap-run.json` after two writers | unchanged; no record is written there by `updateRun` (D-6) |
| `roadmap-loop.test.mjs:2706` | run-file keys = the backticked words of ADR 0013 decision 4 | unchanged; passes once ADR 0013 names `mergeQueue` with `origin` unquoted (task 3.3) |
| `roadmap-loop.test.mjs:2644` (line 2670), `:4213` (lines 4239-4240) | the `devkit` skill names `SendMessage` on one `wake` line only; the periodic check names `wake` but no message tool | unchanged; the wording is added on that line (task 3.5) |
| `roadmap-loop.test.mjs:3225` (line 3253) | `devkit-session/SKILL.md` names no message tool and no schedule | unchanged; that file is not edited |
| `roadmap-loop.test.mjs:4846` (inside the test at 4832) | the place `wake`'s ready text | unchanged (D-8) |
| `roadmap-loop.test.mjs:4852` `BLOCK_KEYS` | board headings | unchanged; no existing fixture has a queue, so no merge-turn block is printed there |
| `roadmap-loop.test.mjs` fixtures with an `origin` (`upBase` 3367, `upPushed` 3800, `remoteProject` 4365, `d18Project` 5447) | `run`/`next` output with an `origin` | unchanged; none sets a merge mode, so `keepsQueue` is false, `run` pushes no marker and prints no line, and `collectRoadmap` lists nothing (D-8) |
| `delivery-models.test.mjs:2130` (in the test at 2116), `guard.test.mjs:482` (line 499) | ADR 0002/0003 headers and links | unchanged; the ADR 0018 and ADR 0022 lines and the links stay |
| `guard.test.mjs:1199` (line 1223), `:1226` (line 1239) | no duplicate ADR number | unchanged; 0025 is free on `main` at `ea482c0` (0022 to 0024 are taken there), and task 5.1 re-checks it |
| ADR-line tests of `openspec/config.yaml` (`stage-models.test.mjs:1394`, `delivery-models.test.mjs:2133`, `guard.test.mjs:1175`, `release-tags.test.mjs:597`, `roadmap-loop.test.mjs` 1958, 2752 and 5369, `change-loop.test.mjs` 2610 and 3391, `project-loop.test.mjs:1888`) | each names its own ADR entry | unchanged; task 5.2 appends the 0025 entry and edits no other |
| `deliver-check.test.mjs:2688` (line 2729), `:4678` (line 4731) | the merge-mode step sequences | unchanged: no marker in those fixtures, so `state.turn` is null |
| `delivery-train.test.mjs` (every test: the config rows, the change rows P3 to P11, the archive rows, the loop, the roadmap ticks, the departure) | the train's rows and loop in `trunk` and `trunk-auto` projects with `devkit.delivery.train` | unchanged: a train project has `state.turn` null before any listing (D-4, T0), `nextAction` is not `queueable` (no record read, no plan-part leave, D-7) and `keepsQueue` is false (D-8); gate 2.6 runs them |
| `change-loop.test.mjs` "change-loop compozy" tests (from line 3596; the `--view compozy` ones at 4047, 4062, 4121, 4521), `compozy-driver.test.mjs`, `roadmap-loop.test.mjs` "roadmap-loop compozy" tests | the CompozyOS driver's start, view, confirm and record steps | unchanged: a `driver: compozy` project is not `queueable` and `compozy-start` pushes no marker (D-4, D-8); gates 2.6 and 3.6 run the `change-loop compozy` and `roadmap-loop compozy` ones |
| `change-loop.test.mjs:2615` (in the test at 2580; comment at 2614, `doesNotMatch` lines from 2616) | the CI snippet of `docs/openspec-flow.md` pins the current release, and no older pin is left | **changed** (task 5.4), as every earlier release changed it: the `assert.match` moves from `/v0\.36\.0/` ("compozy-driver: 0.36.0") to the new release's tag (the next devkit-openspec minor after the one on `origin/main` at the last merge before review; `v0.37.0` at `ea482c0`), a `doesNotMatch` for `/v0\.36\.0/` (compozy-driver) is added at the top of the `doesNotMatch` lines, above the one for `/v0\.35\.0/`, and the comment's history names this change and its release. The invariant (the flow page pins the current release) is untouched; it belongs to the docs layer and lives in `change-loop.test.mjs` |
| `deliver-check.test.mjs:3816` (in the test at 3806, "AC-8 release-ready"), and `change-loop.test.mjs:2642-2644` (inside the test above, unedited lines) | the pin in the flow page matches the manifest's version | unchanged; they take the version from `plugin.json`, which task 5.4 bumps with the pin |

The three tests marked **changed** are the only existing tests this change edits; every other existing
test runs unchanged, and one that fails and is not in this table stops the work for a plan revision.

### D-12 Proof

- Automated, in the files that own each layer (each new test named `merge-turn <AC-n> <area>: ...`):
  `deliver-check.test.mjs` (reading, order, liveness with both archive head names, `since` with the
  renumber rule, rows T0 to T9 and the archive rows, AC-1 to AC-4, AC-7, and T0 in a `trunk-auto`
  project with a train: a boarded change and a boarded archive with the marker, an entry and a record
  present, and with an `origin` that cannot be listed), `change-loop.test.mjs` (the
  `turn` command, its race and its exit 3 cases, the record and its corrupt forms, the rows, the
  unreadable wait's reply, the plan-part leave on flow 1 and flow 2, the wait ending on the turn, two
  clones of one bare `origin` for AC-5, and no queue step and no plan-part leave in a train project or a
  `driver: compozy` project), `conduct-check.test.mjs` (actors; the conflict rule at the join,
  at the wait and for the holder, with two consecutive calls that never alternate; no `adrClash` for a
  waiting change; a train project's rows unchanged with a marker on `origin`), `roadmap-loop.test.mjs`
  (marker at `run` only when `keepsQueue`, none in a `pr`, `two-prs`, train or `driver: compozy`
  project, none from `compozy-start`, removal at the end and its refusal, the wake once per hand-over and
  none for a holder with a recorded wait, the periodic check's wake, the board, and no board block and no
  listing where `keepsQueue` is false, AC-5, AC-6). Fixtures: a bare repository as `origin` and the existing `fakeGh`
  of each file for pull-request states; no test reaches GitHub, and every env blanks `DEVKIT_BYPASS`,
  `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`.
- Real run (AC-8), by the conducting session, on a private scratch repository on the owner's GitHub
  account prepared with the `openspec-setup` GitHub step (merge mode, the `devkit` ruleset with the
  strict up-to-date rule), two clones of it standing for two machines, and the hooks of this worktree.
  Three changes, `p1`, `p2`, `p3`, on `devkit-lite`, each touching one product file and carrying its
  own evidence and reviews; `roadmap-loop.mjs run`/`next`/`status` for the coordinator's part, and
  `change-loop.mjs next` per change with each step done as the `devkit` skill's rows say (session steps,
  `gh pr update-branch`, `gh pr merge --auto`, the background wait), every command and output kept in
  `openspec/changes/delivery-merge-hold/proof/`. L-1 a delivery behind a delivery: `p2` waits while `p1`
  holds, then merges with one `update-branch` and one `verify`; L-2 an archive behind a delivery: `p1`'s
  archive waits behind `p2`; L-3 a head that leaves: `p3` holds, a product commit pushed to its branch
  after its entry makes it leave (deterministic, with no hand-written review; the rejected-review leave
  is proved by the automated tests of task 2.1), and the next takes the turn with no message. Every
  hand-off of the scratch changes is done by the agent the loop names; `gh repo delete` needs the
  `delete_repo` scope, asked of the owner with the plan approval (task 4.1). The app's delivery of a
  `wake` message to a session is not re-proved here (remote-worker proved `SendMessage` to a change
  session); the decision that sends it is. The scratch repository is deleted after the proof (task 4.6).

## Implementation plan

Order: the record on `origin` (data) → the delivery checker's rows and the conduct rule (rules) → the
change loop → the roadmap run and the board → the real run → documents and release.

**File structure** (modify only; no file created outside the change folder and its `proof/`):
`plugins/openspec/hooks/deliver-check.mjs`, `change-loop.mjs`, `conduct-check.mjs`, `roadmap-loop.mjs`,
`run-file.mjs`; tests `deliver-check.test.mjs`, `change-loop.test.mjs`, `conduct-check.test.mjs`,
`roadmap-loop.test.mjs`; skills `plugins/openspec/skills/devkit/SKILL.md`, `ship-change/SKILL.md`;
docs as D-10; release files. Nothing deleted.

**Estimate:** optimistic 31 h, likely 43 h, pessimistic 61 h.

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| D-1/D-3 reading the queue and liveness | 3 | Core | LOW |
| D-2/D-6 `turn` command, race, record | 5 | Core | MEDIUM |
| D-4/D-5 turn facts, `since` with the renumber rule, rows T0-T9 (the train and driver exclusions), archive rows | 8 | Core | HIGH |
| D-5 conduct-check: actors, the conflict rule, `adrClash` for a waiting change | 3 | Core | MEDIUM |
| D-7 change loop rows, the unreadable reply, plan-part leave (with `queueable`), wait | 3 | Core | MEDIUM |
| D-8 `keepsQueue`, marker, end clean-up, wake, board | 6 | Core | MEDIUM |
| Tests of phases 1-3 (red first), the train and CompozyOS cases included | 7 | Testing | MEDIUM |
| D-12 real run on a scratch repository | 6 | Integration | HIGH |
| D-10 documents, ADR notes, skills | 3 | Documentation | LOW |
| Release and whole-suite gate | 1 | Migration | LOW |

**Dependencies:** ADR 0025 (accepted with the plan); ADR 0020 and its `wake`, built by `remote-worker`
(archived, `openspec/changes/archive/2026-11-23-remote-worker/`); ADR 0021 and its session cron,
`devkit-session` skill and `renumber-adr` step, built by `roadmap-sessions-upfront` (archived,
`openspec/changes/archive/2026-11-23-roadmap-sessions-upfront/`); ADR 0022 and its train setting
(`deliveryConfig(...).train`, `readDevkitSettings(...).train`), built by `delivery-train` (PR 93, merged
into `main` at `ea482c0`); ADR 0024 and `compozy-start`/`next --view compozy`, built by
`compozy-driver` (PR 94, merged at `ea482c0`); the merge-mode preflight of `merge-setup.mjs` for the
scratch repository.

**Assumptions** (where the plan breaks if reality differs):
- GitHub accepts pushes that create and delete refs under `refs/devkit/` and lists them in
  `ls-remote` (unverified; task 1.1 probes it; else plan revision, D-1).
- `gh pr list --head <branch> --state all` returns merged and closed pull requests (used today by
  `deliver-check.mjs` line 1310).
- The ruleset's `strict_required_status_checks_policy: true` holds on `main` (ADR 0025 Context;
  `merge-setup.mjs` reads it), which makes one turn per run, not per pack, the right grain.
- A `renumber-adr` commit shows its ADR move as a rename in `git diff-tree -M` (the step uses `git mv`,
  `devkit` skill line 116); a renumber whose content also changed past git's rename threshold would read
  as a product commit and make the holder leave once (it rejoins after its review).
- A project's train setting is project-wide: `devkit.delivery.train` sits in the one `devkit:` block of
  `openspec/config.yaml` (ADR 0022 decision 9; `trainSetting`, `guard.mjs` line 194), so "this project
  has a train" means the same thing in `collectState`, `nextAction` and `keepsQueue`.
- The owner accepts a private scratch repository on their account for the real run (asked with the
  plan approval; without it, AC-8 moves to the first real roadmap run after the merge, as remote-worker
  did, and that is a plan revision).

## Risks / Trade-offs

| Risk | P × I | Mitigation |
|---|---|---|
| GitHub refuses refs outside `refs/heads`/`refs/tags` | LOW × HIGH | Task 1.1 probe before any code; fallback layout named in D-1 |
| Two joiners and skewed clocks put a late joiner ahead of a holder that already acted | LOW × HIGH | D-2 step 5 re-keys the joiner that sees an unseen entry behind it; `disable-auto-merge` out of turn (T5) as the backstop |
| A holder whose session died, or whose CI hangs without turning red, holds everyone | MEDIUM × MEDIUM | Accepted by ADR 0025; the board names the holder; closing its pull request or sending it back to its plan frees the turn |
| A recorded wait whose process died keeps the coordinator from waking the new holder (D-8) | LOW × MEDIUM | The holder's session is then idle like any session whose wait died; the board names the holder, and typing `/devkit change <id>` there goes on; the periodic check prunes the dead record at its next firing |
| A stale marker after a run that died makes a later lone change join a queue | MEDIUM × LOW | A queue with no other alive entry gives the turn at once (one join step more); the next run's end removes it |
| Every loop call in merge mode adds an `ls-remote` (and a `gh` call per entry ahead), also in the stop hook, the periodic check and another machine's `status --json` probe (`roadmap-loop.mjs` `statusJson`, line 1523, reached from `status` at line 1562, asked over SSH with `ASK_TIMEOUT_MS.state`, line 123, 20 s) | MEDIUM × LOW | Only with `turn: true`, merge mode and no train; none on the CompozyOS driver; with no marker the listing is one round trip and no `gh` call; 15 s timeout; failure reads as no queue outside D-4's three cases; a probe that times out is the existing "no answer" row of that machine |
| Waiting changes get release-file conflicts each time the holder merges | HIGH × LOW | A release-only conflict counts as ready (D-5); it is resolved once, in the change's own turn, by the existing release override |
| A change in a conflict outside the release files cycles in and out of the queue | LOW × MEDIUM | The conflict rule of D-5: it never gets `join-queue`, and a queued one leaves once and then gets the plain stop on every call (tests in 2.1 call twice and assert no alternation) |
| `ship-change` run alone holds the turn while its holder is stopped by a non-release conflict | LOW × LOW | Its `join-queue` row refuses to join with `next.conflict`; a holder whose base merge conflicts stops there until the change loop's next call hands `leave-queue` |
| `conduct-check`'s readers (its CLI, the panel) name `enable-auto-merge` out of turn | LOW × MEDIUM | They drive nothing (D-4); the change's next loop call disables auto-merge out of turn (T5) |
| A train project boarded change, or a CompozyOS loop, is handed a queue step and alternates `join-queue` and `leave-queue` until `no-progress` (ADR 0025 decision 9, its review trigger) | LOW × HIGH | `state.turn` null before any listing in a train project (D-4, T0), `queueable` false in `nextAction` for a train key or `driver: compozy` (D-4, D-7), `keepsQueue` false for both (D-8); tests in 2.1 and 3.1, and gate 2.6 runs every `delivery-train` test |
| The train is turned on while a run keeps a queue, leaving refs on `origin` | LOW × LOW | Accepted by ADR 0025 (Consequences): no change of a train project reads them; `git push origin --delete <ref>` or the next run of a project without a train clears them |
| GitHub calls of waiting changes add up while a holder's CI runs for an hour | LOW × MEDIUM | D-3 stops at the first alive entry, so each waiting change adds one `ls-remote` and about one `gh pr list` per 60 s poll (linear in waiting changes); ADR 0025 decision 7 accepts it and its review trigger names the rate limit |
| The real run costs reviews and evidence of three scratch changes | MEDIUM × LOW | One product file each; reviews and evidence kept minimal; the scratch repository is deleted |

**Rollback:** revert the release; refs under `refs/devkit/` left on `origin` are inert for older
versions (they read no such refs) and can be deleted with `git push origin --delete <ref>`.

## Open Questions

None that changes the specs, the approach or the tasks. The owner confirms with the plan approval the
three choices this plan made: (b) for `trunk` (D-5), the background wait as the turn's arrival (D-7,
recorded as ADR 0025 decision 7), and the scratch repository for the real run (D-12). ADR 0025 is
proposed and is accepted with the plan; decisions 6 and 7 settle the two points ADR 0020 rejected for
its own subject (a ref outside the branches, a background poll), decision 7 states how the turn sits
beside ADR 0021's periodic check, and decision 9 states which project ADR 0022's train governs and that
a CompozyOS run keeps no queue, so no further ADR is pending.
