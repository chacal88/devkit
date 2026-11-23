<!-- devkit-stage design result=passed attempt=4 commit=ccb3dfbe2170e76a9b17224e8dcc98db8ca8ee74 -->
# Design

Change: `remote-worker` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the three spec deltas of this change, ADRs 0006, 0010,
0011, 0013 and 0014, ADRs 0017 and 0018 from the release merge of `origin/main` at `212d007`, the
design of the archived `roadmap-coordinator-followups` for the host's session tools, and two probes
run while planning, recorded under Context). Revised 2026-11-23 after that merge: D-13's number and
its amendment of ADR 0017, D-14 T-10, T-14 and T-15, D-15's release numbers, and the
`roadmap-coordination` delta.

## Context

See `proposal.md` (Why). The code each item touches, at `c561553`:

| Item | Where | What it does today |
|---|---|---|
| AC-1, AC-2, AC-3, AC-4 | `plugins/openspec/hooks/change-loop.mjs#openChange`, `#openCheckout`, `#openUnderLock`, `#nameTaken` | `open` takes the per-clone open lock, fetches `origin`, refuses an id taken locally or as `refs/remotes/origin/<id>` (`name-taken`), adds the worktree from `origin/<default>`, runs `openspec new change`, writes `requirements.md`. Nothing is committed or pushed. `openCheckout` is shared with `project-loop.mjs` (slices) |
| AC-5, AC-6 | `plugins/openspec/hooks/roadmap-loop.mjs#collectRoadmap`, `#classifyLines`, `#boardOf`; `change-loop.mjs#unfinished` | A line is `open` only when a checkout of this clone holds its folder or branch. A change open only on another machine reads `ready` |
| AC-7 | `plugins/openspec/.claude-plugin/plugin.json` `userConfig` | Two settings, `language` and `load_limit`; no machine list |
| AC-8 | `roadmap-loop.mjs#decideRoadmap` | `free = places - open`; starts the first `free` ready lines; `holdNow` when the load is at or above the limit |
| AC-9 | `roadmap-loop.mjs#sessionStartOf` | The `session-start` input has `cwd` = the local worktree; no SSH target |
| AC-10, AC-11 | `change-loop.mjs#decide` (`buildPart`) | Every open change fills a place from its open; nothing checks a place before the implementation |
| AC-12 | none | No machine is ever reached |
| icons | `change-loop.mjs#stageIcon` | Six icons; a blocked end has none |
| run file | `roadmap-loop.mjs#emptyRun`, `#readRun`; ADR 0013 decision 4 | The fields of ADR 0013 decision 4, pinned by the test `followups AC-3 run file: ...` of `roadmap-loop.test.mjs` |

Probes run while planning (2026-11-22, on this machine, in the scratchpad):

- **OpenSpec and an extra key.** With OpenSpec 2.0.0, a key `machine` in a change's `.openspec.yaml`
  makes `openspec status` and `openspec validate` print "Unrecognized key name(s) ... prefix a key
  with x-". A key `x-devkit-machine` gives no warning, and `openspec validate <id> --strict` passes.
  This resolves the AMBIGUOUS point of `requirements.md`: option (a), with the `x-` prefix.
- **A push that only creates.** With git 2.53, `git push --force-with-lease=refs/heads/x: origin
  HEAD:refs/heads/x` is refused ("stale info", exit 1) when `x` exists on the remote, even when the
  push would be a fast-forward, and creates `x` when it does not exist. The lease's empty expected
  value is sent as the old value of the ref update, so the remote's compare-and-swap decides the
  race.

Facts about the host this design relies on (sources: `requirements.md`, assumptions confirmed by
the owner; the design of `roadmap-coordinator-followups`, Context, for the tool fields):

- The session-start tool `mcp__ccd_session__start_session` takes `target: "ssh"` and `host` (the app's
  SSH connection name), besides the fields ADR 0014's run uses. A session it starts this way runs on
  that machine, nested under the starting session. The Mac's coordinating session started this
  planning session that way, on the connection `avel`, folder `/home/kaue/repos/devkit`.
- `SendMessage` with `to` set to a session's `local_…` id reaches a started session, a remote one
  included: the Mac's coordinating session reached this session by message.
- `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }` lists the sessions this session
  started, with `sessionId`, `title`, `cwd` and `isArchived`.

Constraints:

- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are downloaded by a project's
  `devkit-reviews` workflow: nothing new becomes a static import of them. This design changes none
  of the three.
- Product code, `docs/adr/` included, is closed until readiness is approved: ADR 0019 and the ADR
  edits are drafted here (D-13) and written by phase tasks.
- A Node script cannot start a session or send a message: the script decides and gives each host
  call's exact input; the session carries it out (ADR 0014).
- The hooks fail open (ADR 0011, a lock that fails closed was rejected), and the stop hook has 60 s.

## Goals / Non-Goals

**Goals:** one claim rule in the open path, used by `/devkit change` and the roadmap alike; one reader
of the claims for every caller; with `machines` unset, every existing roadmap test passes unchanged;
every new behaviour pinned by a test that fails at `c561553`; the driver boundary kept (the script
names every host call, with its input).

**Non-Goals:** a claim for a `/devkit project` slice (its open goes through `project-loop.mjs`,
outside the request: `openCheckout` takes the claim as an option only `openChange` passes); moving a
change between machines; a remote machine without the desktop app; Managed Agents; Windows as a
remote machine (the remote folder is a POSIX path); a poll or a timer for a place (ADR 0006 decision
3, grill answer 6); listing changes open on other machines that are not on the roadmap.

## D-1 The claim at open (AC-1, AC-2, AC-3, AC-4)

`openChange` passes `claim: { machine, places }` to `openCheckout`, which passes it to
`openUnderLock`. `openUnderLock`, while it holds the open lock, does, in order:

1. `hasOrigin` and the fetch, as today.
2. Local reasons first: a change folder in any checkout, `refs/heads/<id>`,
   `refs/heads/chore/archive-<id>`, the worktree folder. Any of them refuses with `name-taken`, as
   today. Then the remote: when `refs/remotes/origin/<id>` exists, `claimOfRef(main,
   'refs/remotes/origin/<id>', id)` (D-3) reads it. A branch holding `openspec/changes/<id>/` is a
   claim: refuse with `claimed` (`{ id, machine }`), or `claimed-elsewhere` (`{ id }`) when its
   `.openspec.yaml` names no machine. A branch without that folder refuses with `name-taken`, as
   today. `nameTaken` keeps its local checks; its `refs/remotes/origin/<id>` check moves into this
   step.
3. The worktree, `openspec new change`, `prepare`, as today.
4. Only with `hasOrigin` and a `claim`: append `x-devkit-machine: <machine>` and, when given,
   `x-devkit-places: <places>` to the folder's `.openspec.yaml`. Then `git add --
   openspec/changes/<id>` and `git commit -q -m "chore(openspec): open <id>"` in the worktree, then
   `git push --force-with-lease=refs/heads/<id>: origin <id>:refs/heads/<id>`.
5. A push refused because the ref exists (git's "stale info", or "already exists", or "fetch first"
   in its stderr) is the lost race: the cleanup of step O5 runs (worktree, folder, prune, local
   branch), then a fresh `git fetch origin <id>` and `claimOfRef` name the winner, and the open is
   refused with `claimed` or `claimed-elsewhere`. Any other push failure runs the same cleanup and
   throws the original `LoopUsageError` (exit 3, `request-unreadable` reply), as a fetch failure does
   today.
6. With `remote: true` (D-8), after a successful push: `git worktree remove --force <worktree>`, `git
   worktree prune`, `git branch -D <id>`; the result's `worktree` is `null`.

The machine of a plain open is `thisMachine()`: `os.hostname()` up to its first dot, every run of
characters outside `[A-Za-z0-9._-]` made one `-`, cut to 64 characters, `machine` when nothing is
left. `open` gains `--machine <name>`, `--places <n|run>` and `--remote`; each is checked
(`MACHINE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/`, places a whole number from 1 to 99 or `run`)
before anything is created. A value that fails its check (a machine name such as `-avel`, `my
mac` or 65 characters; places `0`, `100`, `1.5` or any word but `run`; `--remote` without
`--machine`) is a usage error, as a missing request is today: exit 3, the `request-unreadable`
reply, no worktree, folder, branch, commit or push. The reply of a remote open is `opened-on`
(D-12).

**"GitHub `origin`" read as "an `origin` remote" (owner to confirm).** The push that only creates
works on every git remote, and the open already fetches any `origin`. Restricting the claim to a
github.com URL would leave a GitLab or a self-hosted remote without the owner's rule, and the race
test of AC-3 needs a local bare remote. AC-4 is tested with no `origin` remote. Alternative rejected:
a URL test for `github.com` (the rule would not hold on other hosts, and the tests would need a seam
that production never uses).

**Commit at open.** The claim needs a commit; with no `origin` nothing is committed, so AC-4's "as
today" holds byte for byte. Alternative rejected: pushing an empty commit and leaving the folder
uncommitted (the claim would not hold `requirements.md`, which AC-2 asks for).

**Test seam.** `openChange` takes an injectable `beforePush` (called after the commit, before the
push; default none), used only by the deterministic race test (D-16).

## D-2 The claim's form

The claim is the change's own branch on `origin` and two keys in its `.openspec.yaml`, appended by
the open after `openspec new change` wrote the file:

```yaml
schema: devkit
created: 2026-11-22
x-devkit-machine: avel
x-devkit-places: 2
```

- `x-devkit-machine`: the machine's name (D-1). Always written when claimed.
- `x-devkit-places`: written only when a roadmap run with `machines` set opens the change (D-7): the
  entry's `places` for another machine, `run` for this machine (its places are the run file's
  `places`, D-9). Its presence is what turns the place check on (D-9).

`parseClaim(text)` reads both with `/^x-devkit-machine:[ \t]*["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?[ \t]*\r?$/m`
and `/^x-devkit-places:[ \t]*["']?(run|[1-9]\d?)["']?[ \t]*\r?$/m`; a value that does not match is
absent. An empty or missing file, or one without a final newline, reads as no claim keys (the regexes
need no line end). `switchScript` rewrites only the `schema:` line, so the keys survive it.

## D-3 Reading the claims

Two readers, one parser (`parseClaim`), both in `change-loop.mjs`:

- `claimOfRef(main, ref, id)`: after a fetch, from local objects only. `git cat-file -e
  <ref>:openspec/changes/<id>` (folder present?), `git show <ref>:openspec/changes/<id>/.openspec.yaml`
  (machine, places), `git cat-file -e <ref>:openspec/changes/<id>/approval.md` (`placed`, D-9).
  Returns `null` (no such folder) or `{ id, machine, places, placed }`. Used by `open` and `place`.
- `remoteClaims(start, { env, gh, ids })`: without writing anything. One `git ls-remote --heads
  origin` (a 15 s timeout) lists every branch and its sha. For each branch whose name is in `ids`
  (or, with `ids` absent, matches `NAME`) and is not archived on the default branch: when
  `refs/remotes/origin/<name>` resolves to that same sha, `claimOfRef` on it; else `gh api
  repos/{owner}/{repo}/contents/openspec/changes/<name>?ref=<sha>` (the folder's listing: present,
  `approval.md` present) and, when present, `.../.openspec.yaml?ref=<sha>` (base64 content, then
  `parseClaim`). A `gh` call that fails gives `{ machine: null, places: null, placed: null }` for
  that branch. Returns `{ readable: true, claims: Map<id, claim> }`, or `{ readable: false, claims:
  empty }` when there is no `origin` or `ls-remote` fails.

**The `gh` budget of `remoteClaims`.** `nextAction` runs in the stop hook (60 s) and `status --json`
runs under the 20 s SSH timeout of D-6, so one call is bounded:

- With `ids` absent, the default branch (`defaultBase`'s name) and every name that fails `NAME` are
  skipped before any read, as are branches archived on the default branch.
- A branch whose `refs/remotes/origin/<name>` holds its sha costs no `gh` call. At most 4 branches
  per call are read through `gh` (`CLAIM_GH_BRANCHES = 4`, so at most 8 `gh` calls), in the
  `ls-remote` order; each `gh` call passes `{ timeout: 4000 }` to the runner (`makeGh` takes a
  per-call `timeout`), and no `gh` call starts once 10 s have passed since `remoteClaims` began
  (`CLAIM_DEADLINE_MS = 10000`). The worst case is 15 s (the `ls-remote` timeout, after which no
  `gh` call is made) or 10 s plus one 4 s call.
- A branch left unread by the budget reads as a `gh` failure does: `{ machine: null, places: null,
  placed: null }`. In `placeFacts` it is not counted as held, so the decision may give `take-place`
  where the place is taken; the `place` subcommand is the authority (it fetches, then counts from
  local refs only, D-9 step 3), and after its fetch every tracking ref is current, so the next
  `nextAction` reads every branch with no `gh` call and ends `no-place`.
- One read per command: `nextAction` takes an optional `claims` (a `remoteClaims` result) that
  `placeFacts` uses instead of its own read; `status --json` reads the claims once and passes them to
  the `nextAction` of each of its changes. No cache outlives the call that made it.

Test: `remote locks claims: the claims of a stale clone cost at most 8 gh calls, and none for the
default branch` (`change-loop.test.mjs`; `remoteClaims` with `ids` absent, a `gh` fake that counts
its calls, six claim branches pushed from a second clone after the first one's fetch, and the default
branch moved on the bare remote).

Callers: `collectRoadmap` (`ids` = the roadmap's line ids; D-5), `status --json` and the place facts of
`nextAction` (`ids` absent, D-9). `collectRoadmap` takes a `claimsGh` option (default: its `gh`);
`roadmapStopDecision` passes `claimsGh: OFFLINE_GH`, so the roadmap stop hook makes one `ls-remote`
and no `gh` call for the claims, while its other reads keep the `gh` they use today (D-11). The agent
and subagent-stop hooks of a roadmap run read no claims (`openOnRoadmap` keeps its classes: a line
open elsewhere is not open, as today). Alternative rejected: a `git fetch` in `next` and `status`
(`/devkit status` writes nothing, by its requirement, and a fetch writes remote-tracking refs).

## D-4 The `machines` setting (AC-7)

`plugin.json` gains, after `load_limit`:

```json
"machines": {
  "type": "string",
  "title": "Machines",
  "description": "Other machines /devkit roadmap may open changes on, as a JSON list: [{\"host\": \"<the app's SSH connection name>\", \"folder\": \"<the repository folder there>\", \"places\": <how many changes may implement there at once>}]. Empty runs every change on this machine",
  "default": "[]"
}
```

`parseMachines(text)` in `roadmap-loop.mjs`, pure:

- Unset: `undefined`, empty after trim, `[]`, or a value starting with `${` (a placeholder never
  substituted) → `{ machines: [] }`.
- Not JSON, or JSON that is not an array → `{ error: { key: 'machines-unreadable', params: {} } }`.
- Each entry, in order: not an object, or `host` not a string matching `MACHINE_NAME` (D-1) →
  `machine-incomplete` with `{ entry: <host if a string, else "#<1-based index>">, field: 'host' }`;
  `folder` not a string starting with `/` → field `folder`; `places` not an integer from 1 to 99 →
  field `places`. The first problem wins.
- Two entries with one `host` → `machine-duplicate` `{ entry }`.
- Else `{ machines: [{ host, folder, places }] }`.

The skill passes `--machines '${user_config.machines}'` to `roadmap-loop.mjs run`, `next`, `status`
and `checkout`. The hooks read `CLAUDE_PLUGIN_OPTION_MACHINES`. An error makes `run`, `next` and
`status` print its reply (D-12) and exit 0 having read and written nothing else, as `roadmap-invalid`
does; the hooks treat an error as unset (fail open).

**This machine** is implicit and first: `{ name: thisMachine(), self: true, places: <run file
places> }`. Listing it in `machines` is not supported (documented: a listed host is another machine).

**`machines` set means at least one entry.** With none, every function below takes its path of
today: `decideRoadmap` and `boardOf` branch on `f.machines.length > 0`, and no fixture of the
existing tests sets it.

**Format.** JSON was chosen over a `host:folder:places` string: a folder may hold `:` or spaces, and
the setting is a single string field (`load_limit` is one too). Alternative rejected: the committed
`devkit:` block of `openspec/config.yaml` (grill answer 8: the repository is public, and the list
holds the owner's own data).

## D-5 Lines open on another machine, and the board (AC-5, AC-6, AC-12)

`collectRoadmap` calls `remoteClaims(start, { env, gh, ids: <roadmap ids> })` (hooks: `gh:
OFFLINE_GH`). The set `elsewhere` holds the ids with a claim that are not in `open` (this clone's
unfinished) and not archived. `classifyLines(rounds, { archived, open, previous, declared, elsewhere
})` gains one class, checked after `open` and before `declared`: `elsewhere` (with `machine`, the
claim's or `null`). It fills no place of the run's number, never starts, and a line whose `after:`
names it waits (its id is not archived). Checked before `declared`, a declared `cannot-open` end of a
line that turns out claimed elsewhere is overridden; `decide` drops that declared entry from the
run file (`state.clearDeclared`).

Facts gain `claimsReadable`, `claims` (id → claim), `thisMachine`, `machines` (D-6) and `placed`
(D-8). `entriesOf` gives each `elsewhere` line an entry `{ id, state: 'remote', machine, line }`,
with, when its machine answered a probe (D-6), `where` and `waitsForPlace` from the probe. A `remote`
entry fills no place of `places - open` (with `machines` unset) and counts in its machine's open
changes (with `machines` set).

The board (`boardOf`):

- `showMachine = f.machines.length > 0 || entries.some((e) => e.state === 'remote')`. When true, each
  row of an open change ends with ` · <machine>`: `thisMachine` for a local entry, the claim's machine
  or the text of `machine.unknown` for a remote one.
- A `remote` entry's row is in "Under way": `where` when its machine answered, `machine.no-answer`
  when the machine is listed and did not answer, `remote.open` when the machine is not listed (no
  probe).
- With `machines` set the count line is `status-count-machines` (`{open}`, `{queue}`, `{archived}`)
  and a block `status-machines` comes first, one row per machine, this machine first: `machine.row`
  (`{taken}`, `{places}`, `{open}`) or `machine.no-answer`; this machine's id column reads
  `machine.this` (`<name> (this one)`).
- `claimsReadable === false` adds the line `status-claims-unreadable` after the count line.
- A ready line with `machines` set and no machine able to take it (D-7) reads `queue.no-machine`.
- With `machines` unset and no `remote` entry, the board is byte for byte today's, so the existing
  board tests (D-14) pass unchanged.

AC-5 "each with its machine": with `machines` unset and every open change in this clone, the rows
carry no machine. Every change is then on this machine, and the board stays today's for that case
(AC-7). The spec scenario "A change open only on another machine" pins the case where it matters.

## D-6 Asking a machine (AC-12, and the facts of D-7, D-10)

`plugins/openspec/hooks/machine-probe.mjs` (new, Node built-ins only, no import of the pack) is the
program sent over SSH. It is never run from its path on the remote machine: the coordinator reads
its text and pipes it to `node --input-type=module -`. Verbs (process arguments after `-`):

- `state <folder> <lang>`: reads `~/.claude/plugins/installed_plugins.json`. It takes the first
  installation of a plugin whose key starts with `devkit-openspec@`: one of `scope: project` whose
  `projectPath` is `<folder>` or a folder above it, else one of `scope: user`. It runs `node
  <installPath>/hooks/roadmap-loop.mjs status --json --lang <lang>` with `cwd` `<folder>`. It prints
  that output, or `{ "version": 1, "error": "<why>" }` and exits 3 when no installation is found or
  the call fails.
- `checkout <folder> <id>`: `git -C <folder> fetch origin <id> --quiet`. When a worktree of that
  clone is on branch `<id>`, prints its path. Else `git -C <folder> worktree add -q
  <folder>/.claude/worktrees/<id> <id>` (git makes the local branch from `origin/<id>`) and prints
  `{ "version": 1, "worktree": "<folder>/.claude/worktrees/<id>" }`. A failure prints `{ "version":
  1, "error": "<git's stderr, first line>" }` and exits 3.

`roadmap-loop.mjs` gains `askMachine(machine, verb, args, { ssh })`. The default `ssh` runs
`execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', host, 'node',
'--input-type=module', '-', verb, ...args], { input: <probe text>, timeout })`: 20 s for `state`,
120 s for `checkout`. A non-zero exit, a timeout, or output that is not one JSON object with
`version: 1` and no `error` is "no answer" for `state`, and an error with the reason for `checkout`.
Tests inject `ssh` (D-16).

`status --json` (new form of `roadmap-loop.mjs status`): reads nothing of the roadmap or the run
file and probes nothing; it reads the claims once (D-3, `ids` absent, within its `gh` budget) for
every change it lists. It prints `{ version: 1, machine: thisMachine(), changes: [{ id, where,
icon, waitsForPlace }] }`, one entry per `unfinished(start)` change. `where` is `whereOf` in
`--lang`, `icon` and `waitsForPlace` come from `nextAction` (`waitsForPlace` is true for the blocked
end `no-place`). A change that cannot be read has `where: ""`, `icon: null`, `waitsForPlace: false`.

`collectRoadmap` gains `probe` (default `true`; the hooks pass `false`) and `ssh`. With `machines`
set and `probe`, it asks `state` of each listed machine once per call, in order. Each gives `{ name:
host, host, folder, places, answered, changes }`, and an unanswered or un-probed machine has
`answered: false` and `changes: []`.

Cost: one SSH round per listed machine per decision, bounded by 20 s each. Alternative rejected:
asking `flow-check --json` per change over SSH (the "Where a change runs (proposed)" section's
idea): the coordinator would need each change's worktree path there and one call per change.

## D-7 Where a change opens (AC-8)

With `machines` set, `decideRoadmap` replaces `free`/`wanted` by placement:

- Candidates, in order: this machine, unless `f.load >= f.limit && !f.startAnyway`; then each listed
  machine with `answered`.
- Open changes per machine: this machine counts its local entries that are not archived plus `remote`
  entries whose claim names `thisMachine`. A listed machine counts `remote` entries whose claim names
  its `host`.
- Every ready line, in file order, goes to the candidate with the fewest open changes, the first
  candidate in order winning a tie, and that machine's count goes up by one before the next line.
  Grill and plan take no place (D-9), so every ready line is opened in the decision, subject to the
  turn rules of ADR 0014 (a `start` is withheld on a turn nobody typed, as today).
- No candidate: the first ready line is held (`hold` action and `roadmap-held` line, as today).
  The other ready lines read `queue.no-machine` when nothing at all answers and this machine is
  loaded.
- Each `start` action gains `machine`, `remote` (true for a listed machine), and `places` (`run` for
  this machine, the entry's `places` for another). The skill passes them to `open` as `--machine`,
  `--places` and `--remote`.

With `machines` unset none of this runs: `free`, `wanted` and the hold are today's, and a `start` has
no machine fields; `open` then claims with `thisMachine()` and no places.

## D-8 A session on another machine (AC-9)

- **Open.** `open <id> ... --machine avel --places 2 --remote` claims the change for `avel` and
  removes its local worktree and branch (D-1, step 6). The skill then runs `next --after
  <id>=start`, as for any start.
- **Bookkeeping.** `decide` records in the run file's new field `placed` (`{ <id>: { machine, at }
  }`) every `start` with `remote: true` that the next call finds claimed on `origin` naming that
  machine. A `placed` id leaves the record when its line is archived or no longer `elsewhere`.
  `placed`, like `startedSessions`, outlives the session that wrote it (a `run` from another session
  keeps it; `--fresh` clears it). `readRun` keeps only change-id keys whose value is an object with a
  string `machine`.
- **The session start.** In session mode, a `remote` entry whose id is in `placed` and not in
  `startedSessions`, whose machine is listed and answered, gets a `session-start` action. Its fields
  are the local one's, plus `machine` and `checkout`. `checkout` is `['node', '<HOOKS_DIR>/roadmap-loop.mjs', 'checkout', '--change', <id>, '--machines', <the setting as given>, '--lang', <lang>]`. In `input`, `cwd` is
  `<folder>/.claude/worktrees/<id>`, plus `target: 'ssh'` and `host: <host>`. The `background` text
  is `sessionBackground` with that `root` and the branch `<id>`. The skill runs `checkout` first;
  on exit 0 it calls the start tool with `input` exactly; on exit 3 it declares `reply blocked
  --param id=<id> --param why=cannot-check-out --param machine=<machine> --param error=<the reply>`.
  The turn rules are ADR 0014's: only on a typed turn, one at a time, the same `--after` keys
  (`session-start`, `session-refused`), and the same check of `list_sessions` first (a row with
  that `cwd` or a title ending in the id).
- **A machine that does not answer.** A placed change of a silent machine gets no `session-start`;
  the line `roadmap-machine-silent` (once per machine per silence, D-10) says so.
- **`checkout` subcommand.** `roadmap-loop.mjs checkout --change <id> --machines <json> --lang <l>`:
  finds the change's claim with `remoteClaims` and the listed machine its `machine` names. It asks
  `checkout <folder> <id>` there and prints `{ version: 1, change, machine, worktree }`. It refuses
  (exit 3, `checkout-failed` reply) when the claim is missing, names no listed machine, or the probe
  fails. It writes nothing locally.
- **Where the host cannot start sessions** (no `--change-sessions`): no candidate but this machine
  (D-7), since a change on another machine can only run in a session there (ADR 0014 decision 6).

Alternative rejected: opening the change over SSH on the other machine (`ssh avel node
<pack>/hooks/change-loop.mjs open ...`). The open needs the pack's path, the openspec CLI and the
requirements template there, and the coordinator would read the refusal of a race through SSH. The
open here plus a plain `git worktree add` there needs only git on the other machine.

## D-9 The place (AC-10)

**When it applies.** Only to a change whose `.openspec.yaml` holds `x-devkit-places`, which only a
roadmap run with `machines` set writes (D-2, D-7). A change opened by `/devkit change`, or with
`machines` unset, never waits: AC-7's "exactly as today" holds when the setting is unset. **Reading
of AC-10 and AC-11 (owner to confirm):** AC-10 does not name the setting, but applying it with
`machines` unset would change "Every open change of the roadmap fills a place" for every project
and contradict AC-7. Grill question 9 asked only whether the claim holds without `machines`, which
reads the rest of the machinery as tied to the setting. Alternative (the other reading): a place
taken from the implementation on in every run. It is one predicate in `decideRoadmap` and
`nextAction`, plus a MODIFIED scenario "No number" of the roadmap command (one ready change would no
longer leave the others in the queue).

**The facts.** `nextAction` reads `placeFacts(found, id, dir, { env, gh, claims })` only when
`inDelivery(...)` is true and the folder's `.openspec.yaml` has `x-devkit-places`:

- `machine`, `places` (a number; `run` resolves to `readRun(runFilePath(found.root)).places`).
  `roadmap-loop.mjs` imports `change-loop.mjs`, so `change-loop.mjs` cannot import it back: `emptyRun`,
  `readRun` and `runFilePath` move unchanged to a new module, `plugins/openspec/hooks/run-file.mjs`
  (imports: Node built-ins and `guard.mjs#isChangeId`), which both loops import, and
  `roadmap-loop.mjs` re-exports `readRun` and `runFilePath` so every existing import of them still
  works;
- `taken`: `git cat-file -e refs/remotes/origin/<id>:openspec/changes/<id>/approval.md` succeeds;
- `held` (only when not `taken`): the number of entries other than `id` of `claims` (or, when the
  caller passed none, of one `remoteClaims(...)` read, D-3 with its `gh` budget) whose `machine` is
  this change's and whose `placed` is true; `free = held < places`.

**The decision.** In `buildPart`, before the row's step: `place && !place.taken` gives either
`sessionAction('implementation', 'take-place', { command: ['node', <HOOKS_DIR>/change-loop.mjs,
'place', id, '--lang', lang] })` when free, or `finish('blocked', 'no-place', 'waiting-place', {
machine, taken: held, places }, 'implementation')` when not. Its `progressKey` follows the other
session steps, so a `take-place` that comes back with nothing changed ends `no-progress` (K1).

**The `place` subcommand** (`change-loop.mjs place <id> --lang <l>`), under a lock file
`<git common dir>/devkit-place.lock` with the open lock's timings (`withLockFile`):

1. `git fetch origin --prune --quiet`.
2. When the change folder holds uncommitted files, `git add -- openspec/changes/<id>` and `git commit
   -q -m "chore(openspec): plan of <id>"`. Only the change folder: nothing else is staged.
3. `held` = the remote-tracking branches other than `<id>` matching `NAME`, not archived, whose
   `claimOfRef` names this machine and has `placed`.
4. `held >= places`: exit 2, `{ version: 1, change, taken: false, machine, held, places }`.
5. Else `git push origin <id>:refs/heads/<id>` (a fast-forward of the claim; a rejection is exit 3).
   Exit 0, `{ version: 1, change, taken: true, machine, held, places }`.

The skill runs `detail.command` for a `take-place` step and then `next`, whatever the exit: `next`
reads the place again (taken, waiting, or `no-progress`).

**A place is held** by a change whose branch on `origin` names the machine and holds `approval.md`,
until its id is archived on the default branch or the branch leaves `origin`. When the project deletes
merged branches, the place frees at the merge; otherwise at the archive.

**The waiting end.** A blocked end, why `no-place`, with its own reply key `waiting-place`.
`stageIcon` gives ⏳ for it, and the title carries no state icon: `⏳ <id>`, not ADR 0017's blocked
form `⛔ <stage icon> <id>` (⏳ is ADR 0017's waiting icon, here waiting for a place; AC-10). ADR
0019 decision 8 records that exception as an amendment of ADR 0017 decision 4 (D-13), and the
`roadmap-coordination` delta writes it into the title requirement it modifies. Alternatives rejected: a fifth end state (ADR 0010 decision 3 fixes four,
and the guard's end markers, the roadmap's entries and the skill would all change); a wait on GitHub
(its background poll is the option the owner rejected at grill answer 6).

## D-10 The wake (AC-11)

With `machines` set, `decideRoadmap` gives at most one `wake` action per machine per decision:

- A machine's waiting changes: local entries whose action is the blocked end `no-place`, and
  `remote` entries with `waitsForPlace`. In session mode the local `own` entries are read for this,
  as `readFlying` reads them, only when `machines` is set.
- For the first waiting change `c` in file order: `free_c = places_c - held(machine)`, with
  `places_c` from `c`'s claim (`run` = the run's `places`) and `held` from the claims. When `free_c
  > 0` and `announced[c] !== 'woken:<held>'`, the action is `{ change: c, kind: 'wake', machine,
  message: '/devkit-openspec:devkit change <c>', progressKey: 'wake' }`, and `announced[c]` becomes
  `woken:<held>` with the line `roadmap-woken`. A waiting change is woken again only after `held` on
  its machine changed, which bounds the messages: never two for one state.
- A `wake` is not withheld on a turn nobody typed: it starts no session.
- The skill carries it out. It calls `list_sessions` (`{ "linked": true }`), takes the row not
  archived whose title ends with the id or whose `cwd` is the change's worktree, and calls
  `SendMessage` with `to` that row's id and `message` the action's text. It then runs `next --after
  <id>=wake`. With no such row, it sends nothing; the line already says a place is free.
- Without session mode (the coordinating session runs every change), no `wake` is given: the next
  decision reads the change's action again and hands `take-place` itself.

On the change's side nothing new: the message is `/devkit change <id>` in its own session, which
resumes the loop, and `next` checks the place (D-9).

## D-11 The locks (coordination-locks)

- `roadmapStopDecision` calls `collectRoadmap` with `probe: false` and `claimsGh: OFFLINE_GH`, and
  reads the setting from `CLAUDE_PLUGIN_OPTION_MACHINES` (an unreadable setting is unset). Every
  listed machine is unanswered there, so the only candidate is this machine (D-7). It never asks for
  a `session-start` or a `wake` of another machine, and it never refuses a stop over work only
  another machine could take.
- `remoteClaims` in the stop hook: one `ls-remote`; on failure `claimsReadable: false` and no line is
  `elsewhere`, and the hook judges as it does today.
- `stopDecision` (`/devkit change`): the blocked end `no-place` is an end, so the stop is allowed. A
  ready `take-place` is a `session` step and is refused once per state, like any step; `nextAction`
  in that hook reads the place facts with the same `gh` it uses today for the delivery part.
- No hook runs `ssh`.

## D-12 Messages

New keys of `MESSAGES` in `change-loop.mjs`, both languages, no internal term (the existing test of
the table checks both languages carry the same keys):

| Key | en | pt-BR |
|---|---|---|
| `claimed` | `{id} is already open on {machine}: I opened nothing here. Continue it there, or choose another name.` | `{id} já está aberta em {machine}: não abri nada aqui. Continue lá, ou escolha outro nome.` |
| `claimed-elsewhere` | `{id} is already open on another machine: I opened nothing here. Continue it there, or choose another name.` | `{id} já está aberta em outra máquina: não abri nada aqui. Continue lá, ou escolha outro nome.` |
| `opened-on` | `I opened the change {id} for {machine}, on the {script}, because {why}. Its questions come in its own session there.` | `Abri a change {id} para {machine}, no {script}, porque {why}. As perguntas vêm na sessão dela lá.` |
| `waiting-place` | `{id} waits for a free place on {machine} ({taken} of {places} taken): it goes on when one frees, and the roadmap session tells it.` | `{id} espera um lugar livre em {machine} ({taken} de {places} ocupados): segue quando um liberar, e a sessão do roadmap avisa.` |
| `blocked-why.no-place` | `it waits for a free place on {machine} ({taken} of {places} taken)` | `espera um lugar livre em {machine} ({taken} de {places} ocupados)` |
| `blocked-why.cannot-check-out` | `its folder could not be made on {machine} ({error})` | `a pasta dela não pôde ser criada em {machine} ({error})` |
| `machines-unreadable` | `The machines setting is not a list I can read. Write it as [{"host": "avel", "folder": "/home/me/repo", "places": 2}]. Nothing was started.` | `A configuração de máquinas não é uma lista que eu consiga ler. Escreva assim: [{"host": "avel", "folder": "/home/eu/repo", "places": 2}]. Nada foi iniciado.` |
| `machine-incomplete` | `The machine {entry} in the machines setting has no valid {field}. Nothing was started.` | `A máquina {entry} na configuração de máquinas não tem {field} válido. Nada foi iniciado.` |
| `machine-duplicate` | `The machine {entry} appears twice in the machines setting. Nothing was started.` | `A máquina {entry} aparece duas vezes na configuração de máquinas. Nada foi iniciado.` |
| `checkout-failed` | `I could not make the folder of {id} on {machine}: {error}.` | `Não consegui criar a pasta de {id} em {machine}: {error}.` |
| `roadmap-session-started-on` | `Started {id} on {machine}, in a session of its own.` | `Comecei {id} em {machine}, numa sessão própria.` |
| `roadmap-waits-turn-on` | `{id} is open for {machine} and starts in a session of its own there at your next message: the app starts a session only on a turn you typed.` | `{id} está aberta para {machine} e começa numa sessão própria lá na sua próxima mensagem: o app só abre sessão num turno que você digitou.` |
| `roadmap-woken` | `A place freed on {machine}: I told {id} to go on.` | `Liberou um lugar em {machine}: avisei {id} para seguir.` |
| `roadmap-machine-silent` | `{machine} does not answer: no new change goes there, and its changes keep their places.` | `{machine} não responde: nenhuma change nova vai para lá, e as changes dela mantêm os lugares.` |
| `status-count-machines` | `Roadmap: {open} open · {queue} in the queue · {archived} archived` | `Roadmap: {open} abertas · {queue} na fila · {archived} arquivadas` |
| `status-machines` | `Machines` | `Máquinas` |
| `status-claims-unreadable` | `GitHub could not be read: changes open on other machines are not shown.` | `Não consegui ler o GitHub: as changes abertas em outras máquinas não aparecem.` |
| `machine.row` | `{taken} of {places} places taken · {open} open` | `{taken} de {places} lugares ocupados · {open} abertas` |
| `machine.this` | `{name} (this one)` | `{name} (esta)` |
| `machine.no-answer` | `no answer` | `sem resposta` |
| `machine.unknown` | `another machine` | `outra máquina` |
| `remote.open` | `open on {machine}` | `aberta em {machine}` |
| `queue.no-machine` | `ready, no machine can take it now (this one is loaded, the others do not answer)` | `pronta, nenhuma máquina pode recebê-la agora (esta está carregada, as outras não respondem)` |

The row suffix ` · <machine>` is literal, not a key. `waiting-place` is the reply of the `no-place`
end; `blocked-why.no-place` is what the board and a roadmap line say.

## D-13 The ADRs

**ADR 0019 (new, proposed)** `docs/adr/0019-a-change-can-run-on-another-machine.md`, written by task
5.1 exactly as below (the ADR 0013 decision 4 bullet comes earlier, with the field, in task 4.4). It
was drafted as ADR 0016. Other changes took 0016 to 0018 on `main` first (ADR 0016 is stage roles,
0017 the change state, 0018 the delivery model), so the release merge of `origin/main` at `212d007`
renumbered it to the next free number, 0019, with every reference this change made to it
(CONTRIBUTING.md, step 5). Main's ADR 0016 keeps its number; this design names it only here.

```markdown
# ADR 0019: A change can run on another machine, claimed on GitHub when it opens

- Status: proposed
- Date: 2026-11-22
- Change: remote-worker
- Amends: ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), the hold of a start by
  this machine's load and decision 4; ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md),
  decision 1, the change's worktree on this machine; ADR 0017
  (0017-a-change-state-is-derived-in-one-place.md), decision 4, the title of a change waiting for a
  place

## Context

On 2026-11-21 three changes were opened on a second machine, a Linux worker reached over SSH, each
in an app session of its own. Their folders and branches lived only there: `/devkit status` on the
Mac listed them as ready, and a `/devkit roadmap` run on the Mac would have opened them again. The
owner required that no machine opens a change already open on another one. The owner also chose
SSH, with one app session per change, as the way a run uses another machine, and left Claude
Managed Agents to a roadmap line of its own (grill of `remote-worker`, answers 1 and 3).

ADR 0013 holds a start only by this machine's processor load. ADR 0014 starts each change session in
the change's worktree, which today is always on this machine. Every open change fills one place of
the run's number. Nothing is shared between machines but the repository on GitHub.

## Decision

1. Opening a change in a repository with an `origin` remote commits its folder, with the request and
   the machine's name, and pushes its branch at once, by a push that only creates the branch. A
   branch already on `origin` with the change's folder refuses the open and names the machine. The
   branches on `origin` are the one record of which change is open where.
2. The machines a roadmap run may use are a per-person setting of the pack (`machines`), never a
   project file. This machine is implicit and first. With the setting unset, ADR 0013 and ADR 0014
   hold unchanged.
3. With the setting set, a change opens on the machine that answers with the fewest open changes,
   this machine first on a tie. This machine is skipped while its load is at or above the limit,
   and a start is held only when no machine can take it. A change stays on its machine until its
   archive.
4. A change on another machine gets its worktree there from its branch, over SSH. It runs in an app
   session the coordinating session starts on that machine's SSH connection, in that worktree,
   nested under it, under ADR 0014's turn rules.
5. With the setting set, a change takes a place only from its implementation on, by pushing its
   approved plan. The change script counts the places from GitHub under a lock of the clone. With
   none free, the change ends blocked, waiting for a place (⏳, decision 8). When a place frees, the coordinating
   session sends one message to one waiting change, which checks again. Nothing polls and nothing
   is scheduled (ADR 0006 decision 3).
6. The run's bookkeeping also holds which changes it opened for another machine (`placed`); ADR 0013
   decision 4 names it.
7. No hook reaches another machine. A stage on another machine is held by that machine's own hooks
   (the same pack, installed there) and by the pull request's checks (ADR 0010 decision 5).
8. ADR 0017 decision 4, amended: a change waiting for a place is the one blocked end whose session
   title is `⏳ <id>`, ADR 0017's waiting icon with no ⛔ and no stage icon. A place wait is not a
   fault but a wait for a resource, which frees on its own when another change of the machine is
   archived, so it takes the waiting icon, not the blocked one. Its state stays `blocked` with the
   reason `no-place`; every other blocked end keeps ADR 0017's form.
9. ADR 0010 decisions 1 to 8 (the loop's four ends included: waiting for a place is a blocked end
   with its reason), ADR 0011, and the rest of ADR 0013, ADR 0014 and ADR 0017 are unchanged.

## Consequences

- Positive: no machine opens a change open on another one. `/devkit status` shows where each change
  is. A loaded machine sends new changes elsewhere instead of holding them. The owner's gates stay
  in each change's own session, wherever it runs.
- Negative: every change's branch is public from its open (Accepted by the owner with the plan of
  `remote-worker`). A change opened directly on a machine carries its hostname, which may differ
  from its SSH connection name (Accepted: the board shows it; the owner can name the connection
  after the hostname). Each decision of a run with machines asks every listed machine over SSH,
  20 s at most each (Accepted). Every machine needs the same pack version (Mitigated: one that
  answers in another form counts as not answering, and the documentation says so). The number of
  places of another machine is recorded in each change when it opens (Accepted: a change of the
  setting applies to the changes opened after it).

### Review trigger

The app stops starting sessions on an SSH connection, or stops returning their end-of-turn reports;
`SendMessage` stops reaching a remote session; GitHub stops honouring a push's expected old value; a
change is found open on two machines; the owner asks for Managed Agents or a machine without the
app.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A draft pull request opened at open as the claim (grill answer 2, B) | Visible on GitHub's pull request list | A pull request before any plan; ADR 0012's check and ADR 0002's merge rules would judge it; the owner chose the branch | medium |
| A claim ref outside the branches, `refs/devkit/claims/<id>` (grill answer 2, C) | No public branch at open | A second record beside the branch, invisible on GitHub's pages; the owner chose the branch | medium |
| A shell command per machine, `ssh <host> 'claude -p ...'` (grill answer 3, B) | No desktop app needed | No session in the sidebar and no way for the owner to answer a gate there; the owner chose the app | medium |
| The machine list in `openspec/config.yaml` (the request's words; grill answer 8, B) | Shared by everyone on the project | The repository is public, and the list holds the owner's connection, folders and places | low |
| Every open change fills a place on its machine (grill answer 5, A) | Today's rule | A grill or a plan waits for a machine's place, which the owner rejected | low |
| A background poll of a machine's places (grill answer 6, B) | No message between sessions | A wait that holds a process per waiting change; the owner chose the message | low |
| The coordinator moves the changes of a silent machine (grill answer 7, B) | Work goes on | Two copies of one change when the machine wakes; the owner chose to keep them | high |
| Claude Managed Agents as a machine (grill answer 1, C) | No processor load on the owner's machines | No hooks, sessions outside the app; the owner made it a roadmap line of its own | high |
```

**ADR 0013 decision 4** (task 4.4): a bullet is added after the `changeSessions` bullet, exactly:

```markdown
   - which changes the run opened for another machine (`placed`), as ADR 0019 decides;
```

Task 5.1 adds the rest of the ADR edits below. In each Note, `ADR 0019` is a Markdown link to
`0019-a-change-can-run-on-another-machine.md` (written as the earlier Notes write theirs). The test
`followups AC-3 run file: ...` reads decision 4 and passes after task 4.4 (D-14).

ADR 0013, a header line after its `Amended by ADR 0014` line, and a Note after the Note of
`roadmap-coordinator-followups`:

```markdown
- Amended by ADR 0019 (0019-a-change-can-run-on-another-machine.md)

Note (remote-worker, 2026-11-22): with the person's machines setting set, a start is held only when
no machine can take it, and the run file also holds the changes opened for another machine
([ADR 0019](0019-a-change-can-run-on-another-machine.md)). Decisions 1 to 3 and 5 are otherwise
unchanged.
```

ADR 0014, a header line after `- Date:`, and a first paragraph of its Context:

```markdown
- Amended by ADR 0019 (0019-a-change-can-run-on-another-machine.md)

Note (remote-worker, 2026-11-22): a change of a run may run on another machine; its session is
started on that machine's SSH connection, in its worktree there
([ADR 0019](0019-a-change-can-run-on-another-machine.md)). Decisions 2 to 6 are otherwise unchanged.
```

ADR 0010, a Note after the Note of `project-phases` (no header line: ADR 0019 does not amend it):

```markdown
Note (remote-worker, 2026-11-22): opening a change pushes its branch at once with the machine's
name, and a roadmap run may open changes on other machines the person lists
([ADR 0019](0019-a-change-can-run-on-another-machine.md)). Waiting for a place is a blocked end with
its reason. Decisions 1 to 8 are otherwise unchanged.
```

ADR 0011, a Note after the Note of `roadmap-coordinator-followups` (no header line):

```markdown
Note (remote-worker, 2026-11-22): a change session on another machine is held by these locks there,
by the pack installed on that machine ([ADR 0019](0019-a-change-can-run-on-another-machine.md)).
Decisions 1 to 3 are unchanged.
```

ADR 0017, a header line after `- Status:` (as ADR 0014 carries `Amended by ADR 0017`), and a first
paragraph of its Context (added by task 5.9, from the plan revision of 2026-11-23; the Note only
points to ADR 0019, and ADR 0017's decision text does not change):

```markdown
- Amended by ADR 0019 (0019-a-change-can-run-on-another-machine.md)

Note (remote-worker, 2026-11-23): a change waiting for a free place on its machine is the one
blocked end titled `⏳ <id>`, with no ⛔ ([ADR 0019](0019-a-change-can-run-on-another-machine.md)).
Decisions 1 to 4 are otherwise unchanged.
```

**`openspec/config.yaml`**, the ADRs line of `context`: append `; 0019 a change can run on another
machine, claimed on GitHub when it opens, amends 0013, 0014 and 0017` before the closing parenthesis,
keeping the 0014 text the test `followups ADR 0014: the documents follow` matches.

Accepting ADR 0019 is the owner's, with the plan; on approval the session that records
`approval.md` sets its `Status: accepted` and adds `Accepted by:`, as ADR 0014 records it. The draft
above keeps `Status: proposed`, and so does the file at `ccb3dfb`: the plan revision of 2026-11-23
goes back to the owner, and the session that records the approval of the revised plan sets
`Status: accepted` and `Accepted by:` with that approval's date and the owner's words. No phase
task sets the status.

The plan revision of 2026-11-23 (the coordinator's choice on the escalation about ADR 0017; the
owner accepts it with the revised plan) adds ADR 0017 to the `Amends:` line, decision 8, decision
9's list, ADR 0017's header line and Note, and `0017` in the config line. Task 5.9 writes these into
the files task 5.1 wrote.

## D-14 Existing tests this change touches

Each is named with its invariant, the layer that owns it and its suite. Every other existing test
runs unchanged; one not named here that fails stops the phase for a plan revision.

| Id | Test (file) | Invariant · layer · suite | Change |
|---|---|---|---|
| T-1 | `change-loop open: O4 starts from origin/<default> after a fetch` (`change-loop.test.mjs`) | the branch starts from the fetched `origin/<default>` · change-loop open · `change-loop.test.mjs` through `guard.test.mjs` | `git rev-parse HEAD` == the fetched sha becomes `git rev-parse HEAD~1` == that sha, plus: `HEAD`'s message is `chore(openspec): open add-csv-export` and `git ls-remote origin refs/heads/add-csv-export` gives `HEAD` (the claim, AC-2) |
| T-2 | `roadmap-loop setting: the load_limit user setting` (`roadmap-loop.test.mjs`) | the pack declares exactly the user settings the skill uses · the manifest · `roadmap-loop.test.mjs` | `['language', 'load_limit']` becomes `['language', 'load_limit', 'machines']`; the skill-uses loop also sees `machines` |
| T-3 | `followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4, ...` (`roadmap-loop.test.mjs`) | the run file's fields are the ADR's · the documents · `roadmap-loop.test.mjs` | none: task 4.4, which adds `placed` to the run file, adds its bullet to decision 4 in the same task, so the test is never red at a gate (every gate from phase 1 on runs it) |
| T-4 | `change-loop open: O2 an id already in use creates nothing and says the name is taken` (`change-loop.test.mjs`) | a taken id creates nothing · change-loop open · `change-loop.test.mjs` | none: its "a remote branch" case pushes a branch holding no change folder, which stays `name-taken` (D-1 step 2); named because D-1 moves that check |
| T-5 | `change-loop open: two opens at once for two ids both open their change, and for one id open it once` (`change-loop.test.mjs`) | one id opens once per clone · change-loop open · `change-loop.test.mjs` | none: the second open of one id is refused by the local branch, before the remote is read |

Plan revision (2026-11-22, approved by the owner): the whole-suite gate of phase 5 (then 5.7, now
5.10) ran 1425 tests with 8 failures, all existing tests this table did not name. Each failure comes
from behaviour this plan specifies (D-4, D-8, D-9, D-10, D-12, D-15), not from a fault in the code.
Task 5.7 changes them as T-6 to T-13 say. Each change keeps the test's invariant and widens only what
the new behaviour requires. Every test is run through `guard.test.mjs`.

| Id | Test (file) | Invariant · layer · suite | Change |
|---|---|---|---|
| T-6 | `change-loop replies: no internal term in either language` (`change-loop.test.mjs`) | every key of the message table renders in both languages with sample parameters and holds no internal term, file, option, backtick, `name=value` or untranslated text · message table · `change-loop.test.mjs` | its `SAMPLE` constant gains `entry: 'avel'`, `field: 'folder'` and `name: 'avel'`: `machine-incomplete` needs `{entry}` and `{field}`, `machine-duplicate` needs `{entry}`, and `machine.this` needs `{name}` (D-12). `SAMPLE` also keeps `machine: 'avel'` and `taken: 1`, which phase 2 added for `waiting-place` and `blocked-why.no-place` without this table naming it; this row records that change. Nothing else in the test changes |
| T-7 | `roadmap-loop replies: a blocked line renders every blocked reason in both languages` (`roadmap-loop.test.mjs`) | every key with a blocked `{why}` renders every `blocked-why.` reason in both languages · message table · `roadmap-loop.test.mjs` | its `BLOCKED_PARAMS` constant gains `machine: 'avel'`, `taken: 1` and `places: 1`: `blocked-why.no-place` needs all three and `blocked-why.cannot-check-out` needs `{machine}` (D-12). The loop and its assertions stay as they are |
| T-8 | `roadmap-loop replies: every owner wait has a gate` (`roadmap-loop.test.mjs`) | every `waiting-` key that is an owner wait maps to a gate with a phrase in both languages, and `gateOf` refuses anything else · `gateOf` of `roadmap-loop.mjs` · `roadmap-loop.test.mjs` | `waiting-place` is the reply key of the blocked end `no-place` (D-9), not an owner wait, so it gets no gate. The `waits` filter leaves it out, as it already leaves out `waiting-github`: `k !== 'waiting-github' && k !== 'waiting-place'`. The `expected` map does not change. Two assertions follow the `waiting-github` one: `MESSAGES.en['waiting-place']` and `MESSAGES['pt-BR']['waiting-place']` exist, and `gateOf(endAct('x', 'blocked', 'no-place'))` throws `LoopUsageError` ("waiting for a place is a blocked end, not a gate") |
| T-9 | `followups AC-8 next: start anyway starts what is held now, and a change ready later is held and said again` (`roadmap-loop.test.mjs`) | start anyway keeps no permission: the run file gains no field except the time of its write · `next --start-anyway` and the run file · `roadmap-loop.test.mjs` | the fixture writes a run file of this release, which always holds `placed`: `readRun` returns `placed: {}` when the field is missing, and every write keeps it (D-8, Migration Plan). `putRun(root, { places: 3 })` becomes `putRun(root, { places: 3, placed: {} })`. The key-list assertion stays exact and unchanged |
| T-10 | `change-loop docs: the design records the answers` (`change-loop.test.mjs`) | the CI snippet pins the current release and no earlier one · documents · `change-loop.test.mjs` | `assert.match(flow, /v0\.28\.2/, ...)` (main's pin at `212d007`) becomes `assert.match(flow, /v0\.29\.0/, 'the CI snippet pins the current release (remote-worker: 0.29.0)')`, followed by `assert.doesNotMatch(flow, /v0\.28\.2/, 'no pin left on the previous release (change-state-retro-fixes)')`, and the comment above them names remote-worker's 0.29.0 first, as earlier releases did. The refusals of the earlier pins stay. When a later release rebase renumbers (D-15), this pin follows it |
| T-11 | `followups F-2 skill: start anyway only on the owner's own message, with both flags` (`roadmap-loop.test.mjs`) | `--start-anyway` is passed only on the owner's own typed message, on a `next` call that carries every setting · skill text · `roadmap-loop.test.mjs` | D-15 puts `--machines` on every `next`, between the settings and `--start-anyway`. A constant `SK_MACHINES = "--machines '${user_config.machines}'"` goes beside `SK_LIMIT`. The expected text becomes `` `roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} ${SK_MACHINES} --start-anyway` `` with the message 'the call carries the settings and --start-anyway'. The test's name and its other assertions stay |
| T-12 | `followups AC-15 skill: the turn's two words, event when in doubt or on another session's note, and next first on a typed turn` (`roadmap-loop.test.mjs`) | every `next` of a run with a session per change names its turn, with every setting · skill text · `roadmap-loop.test.mjs` | for the same reason, the expected text becomes `` `roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} ${SK_MACHINES} --turn <typed\|event>` `` with the message 'with the settings'. The other assertions stay |
| T-13 | `followups AC-13 skill: the session-per-change part names the tools, the list check, the session keys and the turn, and hands nothing` (`roadmap-loop.test.mjs`) | in a run with a session per change the coordinating session hands nothing (no stage, no gate, no wait on GitHub) and names its tools as the app names them; the skill uses no wake-up field and sends no message except the ones `next` returns · skill text · `roadmap-loop.test.mjs` | `assert.doesNotMatch(md, /wake_when_done\|SendMessage/, ...)` is split in two, and the Never assertion grows by D-15's two items. Both are given in full below |

T-13 in full. The single assertion becomes these four:

- `assert.doesNotMatch(md, /wake_when_done/, 'no wake field')`, over the whole skill (ADR 0006's
  wake-up stays retired).
- `const wake = part.split('\n').filter((l) => /SendMessage/.test(l))` and
  `assert.equal(wake.length, 1, 'the message tool is named on one line only')`.
- That line starts with `` - `wake`: ``, includes `select:SendMessage` and includes
  `` the action's `message` exactly as given ``.
- `assert.doesNotMatch(md.replace(wake[0], ''), /SendMessage/, 'no message tool outside the wake item')`.

The Never assertion's expected text becomes, exactly:

```text
In a run with a session per change: hand a stage, ask a change's gate or start a wait on GitHub from this session, start a change session `next` did not return, call the session-start tool with any input but the action's `input`, start a session for a change on another machine the run did not open, or send a `wake` message `next` did not return
```

Why the wake is allowed. ADR 0019 decision 5 (grill answer 6, A) adds one message from the
coordinating session to one waiting change session when a place frees. No decision of ADR 0014
forbids that message. ADR 0014 rejected a different option, "A change session messages the
coordinating session when its change is archived", which runs the other way. It was rejected
because every brief would need the coordinating session's id and because the message's turn could
not start a session. Neither reason applies to the wake. The coordinating session finds the change
session through `list_sessions`. The wake starts no session: it resumes one that already exists,
with the same `/devkit-openspec:devkit change <id>` its start used.

The archived design of `roadmap-coordinator-followups` left `SendMessage` out of the skill as not
needed, because the archive report already comes back as an end-of-turn report. That still holds,
and the archive report is still not sent as a message. ADR 0014 decision 1 (the coordinating session
hands no stage) still holds: the message is the change's own resume command. ADR 0014 decision 2
(nothing is scheduled) and ADR 0006 decision 3 also hold: the wake is sent on an event, never on a
timer. ADR 0019 therefore adds a decision without amending any decision of ADR 0014 on this point,
and its `Amends:` line stays as D-13 gives it.

A dry run of T-6 to T-13 in a copy of the tree, with exactly these edits, ran the 8 tests and all 8
passed.

Plan revision (2026-11-23, the owner's yes in their own message): the release step merged
`origin/main` at `212d007` into the branch (merge commit `ccb3dfb`). At that commit the whole-suite
gate (then 5.8, now 5.10) ran 2097 tests with 1 failure (`evidence.md`, attempt 3, D-1): a test that
main's change `delivery-models` (#73) added after this plan was written, and that this table did not
name. It fails because of behaviour this plan specifies (D-1 step 4, the claim commit), not because
of a fault in the code: with an `origin` and a claim, `open` commits `requirements.md` and
`.openspec.yaml` on top of the base, so HEAD is one commit past `origin/<base>`. The branch still
starts from `origin/<base>`, which is what the test's name and its other assertion (base
`origin/main`) state. Task 5.8 changes it as T-14 says, in the shape T-1 already uses for the
default branch.

| Id | Test (file) | Invariant · layer · suite | Change |
|---|---|---|---|
| T-14 | `delivery-models open: a two-prs change starts from origin/<base>` (`delivery-models.test.mjs`) | a two-prs change branches from the remote's base tip, not from the local default branch · the `open` command of `change-loop.mjs` (`openUnderLock`) · `delivery-models.test.mjs`, loaded by `guard.test.mjs` | the last assertion, `assert.equal(git(worktreeOf(t, 'add-export'), 'rev-parse', 'HEAD'), git(t.main, 'rev-parse', 'origin/main'))`, becomes two: `assert.equal(git(worktreeOf(t, 'add-export'), 'rev-parse', 'HEAD^'), git(t.main, 'rev-parse', 'origin/main'), 'the new HEAD\'s parent is origin/main: the claim commit sits on the base tip')` and `assert.equal(spawnSync('git', ['-C', worktreeOf(t, 'add-export'), 'merge-base', '--is-ancestor', 'origin/main', 'HEAD']).status, 0, 'origin/main is an ancestor of HEAD')`. `spawnSync` is already imported by the file. The test's name, its exit-code assertion and its `[b.branch, b.base]` assertion stay. Edited by task 5.8; gate 5.10 (the whole suite) never leaves it red |

The amendment of ADR 0017 (D-13, task 5.9) edits a file an existing test reads. The tests were
searched for every reader of ADR 0017's text or header (`git grep -n "0017" -- 'plugins/**/*.test.mjs'`);
there is one, and a reader of ADR 0019 (none) would be new to this change.

| Id | Test (file) | Invariant · layer · suite | Change |
|---|---|---|---|
| T-15 | `change-state ADR 0017: the documents follow` (`change-loop.test.mjs`) | ADR 0017 keeps its title line, its five headings, `Status: accepted`, `Change: change-state`, its exact `Amends:` line, its `Accepted by:` line matching the approval of `change-state`, and names 🙋, ⏳, ⛔ and 📦; ADR 0014 and ADR 0010 carry its header line and Notes · the documents · `change-loop.test.mjs`, loaded by `guard.test.mjs` | none: task 5.9 adds a separate `- Amended by ADR 0019 (...)` line after `- Status:` and a Note as the first paragraph of the Context. Every assertion is anchored to its own line (`/m`) or to a heading, so none of them reads the added lines, and the `Amends:` line and decision 4's text stay as they are. Named because task 5.9 edits the file it reads. Task 5.9's check runs it; gate 5.10 never leaves it red |

The other tests main added since `c561553` were read for the same cause (`git diff
c561553..212d007 --stat -- 'plugins/openspec/hooks/*.test.mjs'`: `change-loop`, `conduct-check`,
`deliver-check`, `delivery-models`, `flow-check`, `guard`, `jira-task`, `merge-setup`,
`project-loop`, `release-rebase`, `roadmap-loop` and `test-tmp`). None other asserts something the
claim commit changes. The ones that run `open` with an `origin` (the `jira-entry` open tests, the
`change-budget AC-8` open, and the other `delivery-models open` tests) assert the reply, the
requirements file's text, a refusal that comes before the claim, or that a refused open leaves the
main checkout's status, worktrees and run file as they were; none reads the new branch's commits or
its refs on `origin`. The tests that read commits (`review-openspec-fix 15`, the `delivery-models`
archive and scenario fixtures) build their branches with `addWt`, `worktree add` or `switch -c`,
never with `open`. The whole suite at `ccb3dfb` agrees: T-14's test is its only failure.

## D-15 Documents, the skill and the release

- `plugins/openspec/skills/devkit/SKILL.md`:
  - path line: every `roadmap-loop.mjs` call of `run`, `next`, `status` and `checkout` also carries
    `--machines '${user_config.machines}'`.
  - Loop, `session` item: "A `take-place` step runs `detail.command`, then `next`, whatever its exit
    code."
  - Loop, item 1a: a message from the coordinating session that reads `/devkit-openspec:devkit
    change <id>` resumes the loop like the owner's command.
  - A session per change: `start` passes the action's `machine`, `places` and `remote` to `open` as
    `--machine`, `--places` and `--remote` when present. `session-start` with a `checkout`: run it
    first, then the start tool only on exit 0, else declare `cannot-check-out`. A new `wake` item:
    `list_sessions`, then `SendMessage` (loaded with ToolSearch `select:SendMessage`), then `next
    --after <id>=wake`.
  - Status: unchanged text (the board carries the machines itself).
  - Never: "start a session for a change on another machine the run did not open", "send a `wake`
    message `next` did not return".
- `docs/openspec-flow.md`, section "The roadmap coordinator": a paragraph `**Other machines.**`
  (the claim, the setting with its JSON form, placement, the session over SSH, places from the
  implementation on, the ⏳ title, the wake, a silent machine, the same pack version on every
  machine). It also adds `placed` to the run-file paragraph and ⏳ to the icons of "A session per
  change". It does not write the words "(ready, waits for a place)" in parentheses (the test
  `followups ADR 0014: the documents follow` refuses them). In the change coordinator section, one
  sentence says opening pushes the branch. Troubleshooting: rows for `claimed` and for "no answer".
  The CI pins move to `v0.29.0` (T-10 of D-14 follows them).
- `docs/coordination-design.md`: the section "Where a change runs (proposed)" becomes "Where a change
  runs" and describes what is built. Its two claims are corrected: "The project configures one
  command that starts a change there and one that asks its state" becomes the per-person `machines`
  setting, and "State is read by asking `flow-check --json`" becomes `roadmap-loop.mjs status --json`
  over SSH. The opening "Tense" paragraph adds the change `remote-worker` to what exists. Section 2's
  hold paragraph says a loaded machine sends the start to another one when the setting lists one. No
  other file repeats the two corrected claims: `openspec/roadmap.md` line 129 quotes the request,
  which stays as written.
- `plugins/openspec/README.md`: the `devkit` skill row names the `machines` setting; the
  `roadmap-loop.mjs` row names `checkout` and `status --json`; a row for `machine-probe.mjs`.
- Release: devkit-openspec `0.28.2` → `0.29.0` in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`; marketplace `metadata.version` `0.32.2` → `0.33.0`;
  `CHANGELOG.md` gains `## 0.33.0 — remote worker`; `docs/catalog.md` regenerated by `python3
  scripts/gen-catalog.py`. When `main` moved first, the release rebase renumbers. It did once:
  drafted as devkit-openspec `0.22.0` and marketplace `0.26.0`, the release took `0.29.0` and
  `0.33.0` at the merge of `origin/main` at `212d007` (merge commit `ccb3dfb`).

## D-16 Proof

Every new test is named `remote <AC-n> <area>: ...`. Tests of the open and the place live in
`plugins/openspec/hooks/change-loop.test.mjs`; tests of the roadmap, the board, the probe and
`checkout` in `plugins/openspec/hooks/roadmap-loop.test.mjs`. Both are run through
`plugins/openspec/hooks/guard.test.mjs`.

- Remotes are local bare repositories (the existing `roundRepo` and `projectWith` fixtures have one,
  or gain one). The "other machine" is a second clone of the same bare remote, with `os.hostname()`
  replaced by an injected `machine` (`openChange`'s option `machine`, default `thisMachine()`).
- `ssh` is injected: a fake that runs `node --input-type=module - <verb> ...` locally, with the probe
  text as input, `HOME` set to a fixture holding `.claude/plugins/installed_plugins.json` whose
  `devkit-openspec@devkit` installation points at this tree's `plugins/openspec`, and `<folder>` the
  second clone. A silent machine is a fake that exits 255.
- `gh` is injected as today; the claims are mostly read from the remote-tracking refs after a fetch
  (D-3), so most tests need no `gh` fake.
- No test starts a session, lists sessions or sends a message: those host calls are proved by the
  exact `input` and `message` the decision gives. They are seen live only after the merge (below).

**This change's verification.** The automated tests of phases 1 to 5 of `tasks.md` are this change's
verification, and gate 5.10 is its last gate. The live record on two machines is not part of it: the
owner decided on 2026-11-23 (`B: depois do merge`, "B: after the merge") that it runs after the
merge, on the merged version, the next time the owner uses two machines. It is the live check L-1 to
L-4 of the Workflow follow-up of `tasks.md`, recorded by the roadmap line
`remote-worker-live-checks` that this change's retro proposes, in that change's own folder.

What the tests cover in its place:

- the claim and the race: a local bare repository as `origin`, two clones of it, the `beforePush`
  seam, and two child processes of `change-loop.mjs open` started at once against that bare remote;
- the other machine: a second clone of the same bare remote with an injected `machine` name;
- SSH: an injected `ssh` that runs `machine-probe.mjs` locally on the second clone, or exits 255 for
  a silent machine;
- the session start and the wake: the exact `session-start` action (its `checkout` and its `input`
  with `target: 'ssh'`, `host` and the remote `cwd`) and the exact `wake` message the decision
  returns, never a real session or message;
- the place: two child processes of `change-loop.mjs place` on one clone.

What they cannot cover, and so is proven live only after the change reaches `main` (R-10): a real
push race against GitHub (its "create only" lease), a real SSH session start through the app's SSH
target on `avel`, a real wake reaching a remote change session (on a turn nobody typed too), a real
silent machine (asleep, or its Tailscale down), the real `ssh avel` destination (R-2) and the real
`installed_plugins.json` of the worker.

## Proof map

The last column names the live check after the merge (Workflow follow-up of `tasks.md`) that
re-checks the criterion across real machines; it is not part of this change's verification.

| AC | Tests (file) | Live, after the merge |
|---|---|---|
| AC-1 | `remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing`; `remote AC-1 open: a claim with no machine says another machine` (`change-loop.test.mjs`) | L-1 |
| AC-2 | `remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset`; `remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch`; `remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing` (`change-loop.test.mjs`) | L-1 |
| AC-3 | `remote AC-3 open: the clone that pushes second is refused and leaves nothing` (the `beforePush` seam); `remote AC-3 open: two clones opening one id at once, exactly one wins` (two child processes) (`change-loop.test.mjs`) | L-1 |
| AC-4 | `remote AC-4 open: with no origin nothing is committed or pushed` (`change-loop.test.mjs`); `change-loop open: O4 with no remote starts from HEAD` unchanged | — |
| AC-5 | `remote AC-5 status: a line open only on another machine is listed under way with its machine, never in the queue`; `remote AC-5 status: GitHub unreadable prints the board with its line`; `remote AC-5 status: the machines block and the machine of each row` (`roadmap-loop.test.mjs`) | L-1 |
| AC-6 | `remote AC-6 next: a line claimed on origin is never started, and its dependent waits`; `remote AC-6 next: a declared cannot-open of a line claimed elsewhere is dropped` (`roadmap-loop.test.mjs`) | L-1 |
| AC-7 | `remote AC-7 machines: unset, empty, [] and a placeholder read as unset`; `remote AC-7 machines: an entry without a field is refused naming it, and nothing is written`; `remote AC-7 next: with machines unset the decision is today's` (`roadmap-loop.test.mjs`) | — |
| AC-8 | `remote AC-8 next: each ready line goes to the answering machine with the fewest open changes`; `remote AC-8 next: this machine is skipped while loaded, and a start is held only when nothing can take it` (`roadmap-loop.test.mjs`) | L-2 |
| AC-9 | `remote AC-9 next: a placed change gets a session-start with its checkout, target ssh, host and the remote cwd, only on a typed turn`; `remote AC-9 checkout: the worktree is made on the other clone from its branch` (`roadmap-loop.test.mjs`) | L-2 |
| AC-10 | `remote AC-10 next: with no free place the change ends waiting for a place, icon ⏳`; `remote AC-10 next: a free place gives take-place, and after it the implementation step`; `remote AC-10 place: two changes of one machine at once, one takes the place`; `remote AC-10 next: a change without x-devkit-places never waits` (`change-loop.test.mjs`) | L-3 |
| AC-11 | `remote AC-11 next: a freed place gives one wake per state for the first waiting change`; `remote AC-11 next: no wake without session mode` (`roadmap-loop.test.mjs`); `remote AC-11 place: a wake that comes too early leaves the change waiting` (`change-loop.test.mjs`) | L-3 |
| AC-12 | `remote AC-12 next: a silent machine gets no change, and its placed change no session`; `remote AC-12 status: a silent machine and its changes read no answer` (`roadmap-loop.test.mjs`) | L-4 |
| locks | `remote locks stop: no ssh from the stop hook, and a start only another machine could take does not refuse the stop` (`roadmap-loop.test.mjs`); `remote locks claims: the claims of a stale clone cost at most 8 gh calls, and none for the default branch` (`change-loop.test.mjs`) | — |

## Risks / Trade-offs

- [R-1 A branch public from the request on] → the owner's escalation in `requirements.md`, accepted
  with the plan; the open's reply does not change, and `docs/openspec-flow.md` says it.
- [R-2 The SSH connection name is not an SSH destination] → the app's connection `avel` is assumed
  to resolve with `ssh avel` (the owner's `~/.ssh/config`). If it does not, the machine reads "no
  answer" on the board at once, so the owner sees it; the live check after the merge tries it
  first (L-2).
- [R-3 Different pack versions on two machines] → a `state` answer in another form is "no answer";
  documented in the flow page.
- [R-4 A hostname that differs from the connection name] (the Linux worker is `avell` by hostname and
  `avel` by connection) → a change opened there by `/devkit change` names `avell`. The board shows
  it with that name, and `avel`'s places do not count it. Accepted (ADR 0019 Negative); no alias
  setting (not requested).
- [R-5 Every ready line opens at once with machines set] → grill answer 5 (grill and plan never
  wait); the session starts still need a typed turn, one at a time.
- [R-6 The commit of the plan at `take-place` stales a stage] → the test `remote AC-10 next: a free
  place gives take-place, and after it the implementation step` asserts the next action after
  `place` is the implementation step, not a plan rerun.
- [R-7 `SendMessage` refused on a turn nobody typed] → the change session resumes on the owner's
  next `/devkit change`; the wake line already names the change; seen live after the merge (L-3).
- [R-8 SSH time in each decision] → 20 s per machine at most, none in the hooks.
- [R-9 Places recorded at open go stale] → a change of the setting applies to changes opened after
  it (ADR 0019 Negative); this machine's places stay live through `run`.
- [R-10 Cross-machine behavior is proven live only after it reaches `main`] (the owner's decision of
  2026-11-23, `B: depois do merge`) → a real push race against GitHub, a real SSH session start on
  `avel`, a real wake and a real silent machine are first seen on the merged release, so a defect
  there reaches every project that updates before the live check runs. Mitigation: the automated
  tests of D-16 cover each path against a local bare remote, two child processes and an injected
  `ssh` and session input; with `machines` unset (every project that does not set it) no SSH,
  placement, place or wake runs (AC-7, D-9), so what acts on every project with an `origin` is the
  claim at open and the reading of the claims (AC-1 to AC-6), tested with real `git` against a real
  bare remote, the race with two real processes; the live
  check L-1 to L-4 is the first thing done the next time the owner uses two machines, and a defect
  it finds is fixed in its own change with a red test.

## Migration Plan

- Changes open before the release carry no `x-devkit-machine`: their branches, once pushed, read as
  open on "another machine" on a clone that does not hold them, and they never wait for a place.
- Nothing to migrate in the run file: `readRun` gives `placed: {}` when the field is absent.
- Rollback: revert the release commit. A branch already pushed at open stays on `origin` (it is the
  change's own branch and is used by its delivery anyway). Keys `x-*` in `.openspec.yaml` are
  ignored by OpenSpec and by the earlier pack.

## Implementation plan

Order: the claim (phase 1), then the place on the change's side (phase 2), then the claims and the
setting in the roadmap with the board and the probe (phase 3), then placement, the remote session
and the wake (phase 4), then the skill, the ADRs, the documents and the release (phase 5). The live
record on two machines is not a phase: it runs after the merge (D-16, the Workflow follow-up of
`tasks.md`).

**Per surface.**

- Hooks: `change-loop.mjs` (D-1, D-2, D-3, D-9, D-12), `roadmap-loop.mjs` (D-4 to D-8, D-10, D-11),
  `machine-probe.mjs` (new, D-6), `run-file.mjs` (new, D-9).
- Skill and manifest: `SKILL.md`, `plugin.json` (D-4, D-15).
- Documents: D-13, D-15.
- No frontend, no CI file, no worker process.

**Files.**

- Modify: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
  `plugins/openspec/hooks/delivery-models.test.mjs` (T-14 only),
  `plugins/openspec/skills/devkit/SKILL.md`, `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/openspec/README.md`, `docs/adr/0010-openspec-as-the-harness.md`,
  `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`,
  `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`,
  `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`,
  `docs/adr/0017-a-change-state-is-derived-in-one-place.md` (header line and Note only),
  `docs/openspec-flow.md`,
  `docs/coordination-design.md`, `openspec/config.yaml`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, `docs/catalog.md`.
- Create: `plugins/openspec/hooks/machine-probe.mjs`, `plugins/openspec/hooks/run-file.mjs`,
  `docs/adr/0019-a-change-can-run-on-another-machine.md`,
  `openspec/changes/remote-worker/proof/red-<n>.txt`.
- Delete: none.

**Estimate:** optimistic 28 h · likely 40 h · pessimistic 58 h (the plan revision of 2026-11-22 added
1 h for D-14 T-6 to T-13; the one of 2026-11-23 moved the 3 h of the live record out of this change,
to the live check after the merge; the second one of 2026-11-23 adds 0.5 h for D-14 T-14 and the
re-run of tasks 5.5, 5.6 and gate 5.10 after the release merge, and 0.5 h for the amendment of ADR
0017, task 5.9).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 the claim in the open path, its cleanup and the lost race | 5 | Core | HIGH |
| D-2, D-3 the claim's keys, `parseClaim`, `claimOfRef`, `remoteClaims` | 4 | Core | MEDIUM |
| Phase 1 tests (AC-1 to AC-4, T-1) | 3 | Testing | MEDIUM |
| D-9 place facts, `take-place`, `place` subcommand, `run-file.mjs`, ⏳ | 5 | Core | HIGH |
| Phase 2 tests (AC-10, AC-11 change side) | 3 | Testing | MEDIUM |
| D-4 `parseMachines`, the manifest, T-2 | 2 | Core | LOW |
| D-5 the `elsewhere` class, entries, the board and its keys | 4 | Core | MEDIUM |
| D-6 `machine-probe.mjs`, `askMachine`, `status --json` | 4 | Integration | HIGH |
| Phase 3 tests (AC-5, AC-6, AC-7, AC-12 board) | 3 | Testing | MEDIUM |
| D-7 placement | 2 | Core | MEDIUM |
| D-8 `placed`, the remote `session-start`, `checkout` | 3 | Core | HIGH |
| D-10 the wake | 2 | Core | MEDIUM |
| D-11 the locks without SSH | 1 | Core | LOW |
| Phase 4 tests (AC-8, AC-9, AC-11, AC-12, locks) | 3 | Testing | MEDIUM |
| D-13 ADR 0019 and the four ADR edits, config | 1.5 | Documentation | MEDIUM |
| D-13 ADR 0019 amends ADR 0017: decision 8, ADR 0017's header line and Note, config (task 5.9) | 0.5 | Documentation | LOW |
| D-15 the skill, the documents and the release | 3 | Documentation | MEDIUM |
| D-14 T-6 to T-13, the existing tests found at the whole-suite gate | 1 | Testing | LOW |
| D-14 T-14, the test main added that the claim commit moves | 0.5 | Testing | LOW |
| Whole suite, marketplace validation | 1 | Testing | LOW |

**Risks** (probability × impact):

- The claim breaks an existing open test beyond D-14 (MEDIUM × MEDIUM) → phase 1's gate runs every
  `change-loop open` test and the slice opens of `project-loop start: open`; the whole suite runs in
  gate 5.10. A failure not in D-14, at a phase gate or at 5.10, stops for a plan revision (the one of
  2026-11-22 added T-6 to T-13, the second one of 2026-11-23 added T-14).
- A test `main` adds after this plan asserts what the claim changes (MEDIUM × MEDIUM) → the release
  merge is followed by the whole suite (gate 5.10) before the reviews; a failure stops for a plan
  revision, as `delivery-models` (#73) did (T-14), and D-14 records the read of every test `main`
  added since `c561553`.
- A phase gate read as red while still running (MEDIUM × MEDIUM) → the phase gates run only the new
  `remote` tests and the existing groups the phase touches, each named in `tasks.md` with its
  measured duration on the base; every node gate runs as a background command of the tool and is
  judged by its exit code, never by a foreground timeout.
- `remoteClaims` with `ids` absent outruns the stop hook on a clone with many stale branches
  (MEDIUM × MEDIUM) → the `gh` budget of D-3 (at most 4 branches and 8 calls, a 10 s deadline, the
  default branch skipped); `place` stays the authority after its fetch.
- `ls-remote` in `collectRoadmap` slows the existing roadmap tests (MEDIUM × LOW) → one local call
  per decision against a bare remote; fixtures without an `origin` skip it.
- The probe's plugin lookup finds no installation on the real machine (MEDIUM × HIGH) → it reads
  `installed_plugins.json`, whose shape this machine shows (version 2, `plugins` keyed
  `<name>@<marketplace>`, entries with `scope`, `projectPath`, `installPath`); the test fixture of
  D-16 has that shape, and the live check after the merge (L-2) reads it on the real worker (R-10).
- A remote session start with `target: "ssh"` is refused (LOW × HIGH) → the refusal path of ADR 0014
  (a line, the owner's next message); the test asserts the exact input, and the live check after the
  merge (L-2) proves the start (R-10).
- R-1 to R-9 above, each with its mitigation.

**Assumptions** (each is where the plan breaks if reality differs):

- The session-start tool takes `target: "ssh"` and `host` and starts a nested session on that machine
  (source: `requirements.md`, assumptions confirmed by the owner; this session was started so).
- `SendMessage` reaches a remote started session, on a turn nobody typed too (source:
  `requirements.md`, "This run is live input"; the second half is checked after the merge, L-3).
- `ssh <connection name>` reaches the machine without a prompt (`BatchMode=yes`), with `node` and
  `git` on its `PATH` (source: the live run of 2026-11-21 over Tailscale; checked after the merge,
  L-2).
- GitHub honours a push's expected old value of zero as "create only" (source: git's documentation of
  `--force-with-lease=<ref>:` and the probe in Context, run against a local bare remote; checked
  against GitHub by the simultaneous open of L-1, after the merge).
- `~/.claude/plugins/installed_plugins.json` lists the pack's installation path (source: this
  machine's file, read on 2026-11-22).
- OpenSpec ignores `x-` keys of `.openspec.yaml` silently (source: the probe in Context).

**Dependencies.** `roadmap-coordinator` and `roadmap-coordinator-followups` (archived):
`roadmap-loop.mjs`, the session per change, `withLockFile`. The OpenSpec CLI 2.x on `PATH` for the
suite. The owner's acceptance of ADR 0019 and of the two readings (D-1, D-9) with the plan. The
Linux worker `avel`, with the merged release installed, for the live check after the merge; this
change's verification does not depend on it (D-16).

## Decisions cited

- ADR 0006: decision 3 (no cron): the wake is a message on an event, never a timer.
- ADR 0010: decision 3 (four ends: waiting for a place is a blocked end), decision 5 (hooks veto;
  where a driver cannot refuse, the pull request's check is the lock), decision 8 (one run's
  bookkeeping: `placed`).
- ADR 0011: decision 2 (run detection, unchanged); a lock that fails closed was rejected (D-11).
- ADR 0013: decision 3 (the stop lock, judged without SSH), decision 4 (gains `placed`), the hold by
  the load (amended by ADR 0019).
- ADR 0017: decision 4 (the title of a stopped change: state icon, then the stage icon), amended by
  ADR 0019 decision 8: the place wait is the one blocked end titled `⏳ <id>`; the
  `roadmap-coordination` delta keeps decision 4's form for everything else (D-9, D-13).
- ADR 0018: decision 2 (in `two-prs` every task branch is cut from the base): the claim commit sits
  on `origin/<base>`, so the branch is still cut from it (D-14 T-14).
- ADR 0014: decision 1 (the change's worktree, now possibly on another machine), decision 2 (a
  session only on a typed turn, unchanged for remote sessions), decision 5 (the bookkeeping), its
  rejected "A change session messages the coordinating session" (not taken up: the wake goes the
  other way, from the coordinating session to a change session, and needs no id in any brief; D-14
  T-13) and "A retry on a timer" (not taken up).

## Open Questions

None that changes the specs, the approach or the tasks. The owner confirms at approval: ADR 0019,
the two escalations of `requirements.md`, the reading of "GitHub `origin`" (D-1), the reading of
AC-10 and AC-11 as tied to the `machines` setting (D-9), and the slice claim left out (Non-Goals).
