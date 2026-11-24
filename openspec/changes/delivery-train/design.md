<!-- devkit-stage design result=passed attempt=3 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Design

Change: `delivery-train` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`, `proposal.md`, the five spec deltas under `specs/`, ADR 0022 listed in
`decisions.md`).

## Context

See `proposal.md` (Why). The code, read at `19c0196` (devkit-openspec 0.29.0, devkit-core 0.13.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/guard.mjs` `parseDevkitBlock`, `DELIVERY_KEYS`, `deliverySettings`, `readDeliverySettings`, `plainValue` | The one reader of the `devkit:` block; `delivery` keeps `model`, `base`, `test_branch`. `plainValue` of an unclosed quote returns the rest of the line |
| `guard.mjs` `roadmapRunOf`, `isDevkitVerb` | A typed `/devkit status` neither starts nor ends a roadmap run; any other typed slash command ends it |
| `plugins/openspec/hooks/deliver-check.mjs` `deliveryConfig`, `collectState`, `nextStep`, `archiveNext` | The model next to `ship:`; the eight items; in `merge` mode `update-branch` when the PR is only behind, then `enable-auto-merge` at 8/8; after the merge the archive rows P0-P14 (P3f `update-branch`, P3g `enable-auto-merge`, P3i `archive-pr-ready`) |
| `deliver-check.mjs` `tasksItem`, `parseTasks`, `fencedLines`, `staleness`, `autoMergeTree` | Item 1 needs a `pass` row in `evidence.md` for each `&&` part of each gate; the `Commit:` staleness rule lets later `openspec/`-only commits through; `fencedLines` ignores an unclosed fence; `autoMergeTree` gives Git's automatic merge of two commits |
| `deliver-check.mjs` `findChangePr`, `isOwnPr`, `deliveryOf`, `readContents` | The change's own PR (archive heads excluded); delivered = own PR `MERGED` and every task ticked on the default branch |
| `deliver-check.mjs` `runCi`, `selectCiChange`, `checkOne`, `archivePrCheck`, `ciSettingsRef` | `devkit-reviews`: selects the change by branch or diff, judges readiness and items 1-4 at the PR head; an archive PR by its folders; reads `devkit.delivery` from the default branch (ADR 0018 decision 3) |
| `plugins/openspec/hooks/release-merge.mjs` `main`, `resolveVersions`, `resolveManifest`, `resolveChangelog`, `classifyConflict`, `mergePins` | `--base <base>`: merges `origin/<base>` into the current branch, renumbers the branch's release above the base's, commits, never pushes; exit 0 / 2 (undone) / 3 |
| `plugins/openspec/hooks/conduct-check.mjs` `deliveryRow`, `releaseConflict`, `serializeArchives` | Override 1: a conflict in release files only gives `resolve-release-conflict`; override 3: one archive branch at a time |
| `plugins/openspec/hooks/change-loop.mjs` `ROWS`, `OWNER_STEP`, `GATE_OF_WHY`, `MESSAGES`, `startMode`, `readDevkitSettings`, `projectGate`, `withLockFile` | Each checker step mapped to a hand-off, a session step or an end; the verbs `change`, `roadmap`, `status`, `project`; one message table in `en` and `pt-BR` |
| `plugins/openspec/hooks/flow-check.mjs` `readDelivery` | The stage readout of the delivery stage |
| `.github/workflows/devkit-reviews.yml`, `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml` | `actions/checkout` at the PR head with `fetch-depth: 0`; a project's job downloads `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs` |

Constraints:

- Everything `devkit-reviews` runs stays in `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs`: no
  new module and no new import in them (ADR 0018 rejected "a fourth downloaded checker file"). The
  train record's reader therefore lives in `deliver-check.mjs`; the new `train-loop.mjs` imports it.
- `deliver-check` reads and never writes, fetches or pushes. The departure writes (fetch, branches,
  merges, the record commit) in its own script; pushes and GitHub writes are session steps, as every
  other push of the flow is (ADR 0010 decision 6: the state is in the repository and GitHub).
- A change's state is derived on each read and stored nowhere (ADR 0017 decision 1). Boarding and its
  order are derived from the change's branch and GitHub; the train record is a committed file of the
  train, read like `evidence.md`, not a state log.
- `scripts/check.py` refuses Portuguese prose in Markdown; the message table carries both languages.
- The sessions run the installed pack (`CONTRIBUTING.md`): a key this release adds is read only after
  `claude plugin update`, which is why this repository switches the train on in a follow-up (D-12).

## Goals / Non-Goals

**Goals:**

- Without `devkit.delivery.train`, every function this plan touches returns what it returns today; the
  train code is reached only through `state.train` (D-2), a `train/<n>` head (D-10), the train parts
  (D-10, D-11; an empty list without the key) or the `mergeFields` option (D-2; today's value without
  the key).
- One reader per fact: the setting (D-1), the train facts of a change (D-2), the record (D-4), the join
  (D-6). The departure reuses `collectState` to decide boarding, so boarding means the same thing in
  the change's worktree, in the departure and in CI.
- Each new predicate has a test per condition and per label, negatives included (D-13).

**Non-Goals:**

- The coordinating session's periodic departure (`roadmap-sessions-upfront`); a stop lock or a
  hand-off lock for a train run.
- `devkit-project` slices on a train: in a train project a slice still delivers through its own pull
  request as today (its schema never reaches the boarding rows, D-2).
- A real GitHub run inside the suite; the first train of this repository is the first real use (D-13).

## D-1 The setting (AC-1; spec `delivery-train`)

The key is `devkit.delivery.train`, and its value is the whole-suite command (the requirements'
AMBIGUOUS option (b)). One key both switches the train on and names what the train runs, so there is
no second setting to disagree with it, and a value of `true` is not needed by anything.

```yaml
devkit:
  delivery:
    model: trunk-auto
    train: "node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py"
```

- `guard.mjs`: `DELIVERY_KEYS` gains `train`. `parseDevkitBlock` stores `delivery.train` with
  `plainValue` and, for that key only, `delivery.trainUnclosed = true` when the raw value starts with
  `"` or `'` and has no second quote of the same kind. New export `trainSetting(block)` returns
  `{ suite, problem }`:

  | Block | `suite` | `problem` |
  |---|---|---|
  | no `train`, or an empty value | `null` | `null` |
  | `trainUnclosed` | `null` | `{ kind: 'unknown', setting: 'delivery-train', value: <raw> }` |
  | a value and model `trunk` or `trunk-auto` | the value | `null` |
  | a value and model `two-prs` | `null` | `{ kind: 'train-model', model: 'two-prs' }` |
  | a value and no model (or an unknown one, already a model problem) | `null` | `{ kind: 'train-model', model: null }` |

  `deliverySettings` and its return shape stay as they are (five tests of
  `plugins/openspec/hooks/delivery-models.test.mjs` assert that shape with `deepEqual`); new export
  `readTrainSetting(root)` reads the file like `readDeliverySettings`.
- `deliver-check.mjs#deliveryConfig` adds `train: <suite | null>` to its result and throws
  `ShipConfigError` on a problem: `devkit.delivery.train: the train runs only with the model trunk or
  trunk-auto (two-prs delivers each change through pull requests of its own)`, `... needs
  devkit.delivery.model trunk or trunk-auto`, `... "<raw>" opens a quote it never closes`. Exit 3, as
  every configuration error.
- `change-loop.mjs#readDevkitSettings` adds `settings.train = { suite, problem }` only when `suite` or
  `problem` is not null, as it adds `settings.delivery` only when a model is set; without the key the
  object keeps its shape `{ driver, language, unknown }`, which four `deepEqual` tests of
  `change-loop.test.mjs` pin (lines 52, 216, 3216, 4124; rows of D-13). `projectGate` (after the
  unknown and missing checks) returns mode `setting-unknown` with key `train-model` (param `model`),
  `train-no-model`, or `setting-unknown` with setting `delivery-train`. `projectGate` serves every verb
  that runs (`change`, `roadmap`, `status`, `project`, `train`, and `project-loop.mjs`), so a refused
  train setting stops each of them, as a refused delivery model does today. New messages in both
  languages: `train-model`, `train-no-model`, `setting.delivery-train` ("delivery train" / "trem de
  entrega"). `DELIVERY_ACCEPTED['delivery-train']` is `a command whose quotes are closed`.

Parser decisions: an empty value is unset (the rule `plainValue` already applies); an unclosed quote is
refused, never read as "the rest of the line"; a `#` inside an unquoted value starts a comment as for
every key (a command holding `#` must be quoted); the value is never split or run by the parser.

## D-2 Boarding in the delivery checker (AC-1, AC-2, AC-3, AC-9, AC-10; spec `delivery-train`)

`collectState` reads `train` from `deliveryConfig`. When it is `null`, or the change is not on
`devkit` or `devkit-lite` (`isDevkitScript`; a `devkit-project` slice delivers as today), nothing below
runs and `state` has no `train` key, so the JSON of every other project keeps its keys. Otherwise
`state.train` is
`trainFacts(gh, root, id, { head, prHead, kind })`:

- `suite`: the command; `parts`: its `&&` parts, trimmed.
- `records`: the five newest pull requests whose head is `train/<n>` (`gh pr list --state all --limit 100
  --json number,url,state,headRefName,headRefOid,mergedAt,mergeCommit`, filtered on `^train/\d+$`), each
  with its record read by `readContents(gh, 'openspec/trains/<n>.md', <headRefOid>)` and parsed by
  `parseTrainRecord` (D-4). An unreadable answer is `{ error }`, which the rows below turn into a wait on
  GitHub as ADR 0017 decision 3 says.
- `onTrain`: the open train whose record lists this change (or archive) as boarded at `prHead`, as
  `{ n, number, url }`, else `null`.
- `carried`: the merged train whose record lists it as boarded at `prHead`, as `{ n, number, mergeCommit }`.
- `left`: the newest train whose record lists it as left at `prHead`, as `{ n, number, state, why,
  detail, failure }`.

`collectState` also computes `setup`, as today only when `ship` is `merge` (`trunk-auto`), with the
merge method `merge` in place of `merge_method` when the train is on (the train's pull request merges
with a merge commit, ADR 0022 decision 10).

**The pull request fields in `trunk`.** In `trunk` `ship` is `pr`, so today `findChangePr`, `fetchPr`,
`mergedOnBranch` and the open-PR lookup ask `PR_FIELDS`, which lacks `autoMergeRequest` and
`mergeStateStatus`, and `prFacts` reads `autoMerge` only `if (merge)`. Each of them gains an option
`mergeFields` (default `ship === 'merge'`, today's value); `deliveryOf` and `collectState` pass
`mergeFields: ship === 'merge' || train !== null`, and `prFacts` reads `autoMerge` and
`mergeStateStatus` when `merge || train !== null`. So a change of a `trunk` project with the train asks
`MERGE_FIELDS` and can find auto-merge on (T1), and a project without the key asks exactly today's
fields (AC-1; a P3 test records every `gh` argument list of a `trunk` project without the key and
compares it with today's, and another asserts `MERGE_FIELDS` in `trunk` with the key). `ship` itself
does not change, so no `merge`-mode row (`update-branch`, `enable-auto-merge`, `wait-merge`) opens up
in `trunk`.

**Rows of `nextStep`** for a change, in a train project only. Every row before item 5 is unchanged, so
a change is never boarded before its tasks, gates, evidence, findings and reviews are met at its head.

| # | Where | Condition | `next.step` |
|---|---|---|---|
| T1 | first row, before `stop-plan-mode` | `state.train`, PR open, `autoMerge` on | `disable-auto-merge` |
| T2 | after the `fix-review` ... `blocked` rows of items 1-4, before `open-pr` | `train.left` and its train still open | `wait-train` (end on GitHub, `number` of the train PR) |
| T3 | same place | `train.left` and its train merged or closed | `rejoin-train` (hand-off to `tdd-implementer`, detail D-7) |
| T4 | item 5 | no PR | `open-pr`, as today |
| T5 | item 5 | blocked only for a conflict, or open only for being behind | not a stop and not `update-branch`: go on |
| T6 | item 5 | open for local commits or uncommitted files; blocked for any other reason | `push` / `blocked`, as today |
| T7 | item 8 open; item 6 failing; item 7 to answer | | `edit-pr-body`, `fix-checks`, `answer`, as today |
| T8 | otherwise, `train.onTrain` | | `on-train` (end on GitHub, `number`) |
| T9 | otherwise | | `boarded` (end waiting for the owner) |

Pending checks never reach `wait-checks` in a train project (they are the CI wait ADR 0022 decision 2
excludes); `ready`, `update-branch`, `enable-auto-merge` and `wait-merge` are never returned for a change
of a train project. Because items 1-4 are read at the change's own head and the base's moves do not move
that head, a merge of a sibling changes none of the rows above (AC-3).

**Delivered by a train** (`deliveryOf`): with the train on, a change whose own PR is not `MERGED` is
delivered when `train.carried` is set and every task is ticked on the default branch. A PR still `OPEN`
then gives, before the archive rows, `close-boarded-pr` (session step; detail `{ number, train: n,
trainNumber, comment }`, the comment `Delivered by train <n> in #<trainNumber> (merge commit
<sha7>).`). `isOwnPr` returns `false` for a head matching `^train/\d+$`, as it does for archive heads.

**Archive rows** (`archiveNext`) in a train project: P3a disables auto-merge whenever it is on; P3b
(conflict) is not a stop; P3f (`update-branch`) is never returned. `collectState` computes `state.train`
for the archive phase too, with `kind: 'archive'` and `prHead` the archive PR's head, so `onTrain`,
`carried` and `left` read the record's rows of kind `archive` for this change. In place of P3g-P3i, an
open archive PR that passes P3a-P3e takes the first of:

| # | Condition | `next.step` |
|---|---|---|
| A1 | `train.left` (kind `archive`, at the archive PR's head) and its train still open | `wait-train` (end on GitHub, `number` of the train PR) |
| A2 | `train.left` with `why: red` and its train merged or closed | `stop-archive` with `archiveStep: 'train-left'`, the reason naming the train and the record's failure (an archive moves files under `openspec/` and the proposals the owner approved; a red one needs the owner) |
| A3 | `train.left` with `why: conflict` and its train merged or closed | `rejoin-archive` (detail `{ number, branch, base, paths, train }`; `conduct-check` completes it, below) |
| A4 | `train.onTrain` | `on-train` (end on GitHub, `number`) |
| A5 | otherwise | `boarded` (end waiting for the owner) |

No row returns `boarded` while a left entry applies at the archive PR's head, so an archive that cannot
join never departs and leaves again on each train.

**Override 4, the archive that left** (`conduct-check.mjs#trainRejoin`, called by `deliveryRow` after
`releaseConflict`, in the same form, because the classification needs `release-merge.mjs`, which
`deliver-check.mjs` cannot import). On `rejoin-archive`:

1. An unpushed merge (`unpushedMerge`, as override 1): `open-archive-pr` with `command` `git push origin
   <branch>`, as override 1 returns it today.
2. `conflictedPaths(worktree, origin/<base>)` (`git merge-tree --write-tree`), classified by
   `classifyConflict(paths, versions, { roadmap: resolveRoadmapTicks })`. Any blocking path (for
   example two archives that edit the same canonical `openspec/specs/<capability>/spec.md`):
   `stop-archive` with `archiveStep: 'train-left'` and the reason `archive of <id> left train <n> and
   conflicts with <base> in <paths>; resolve them on <branch>`, a stop for the owner, as a conflict of
   an archive PR is today.
3. Otherwise (clean, or release files, the CI pin and roadmap ticks only): `rejoin-archive` as a
   session step of the main session with `command` `['node', RELEASE_MERGE, '--base', <base>,
   '--roadmap-ticks', '--json']`, run in the archive branch's worktree.

`--roadmap-ticks` turns on the roadmap resolver of D-6 in `--base` mode (`resolveRoadmapTicks` with
`change` = the archive branch's side, `base` = `origin/<base>`); without the flag `--base` is unchanged
byte for byte (AC-1; `release-merge.test.mjs` passes unchanged), and only override 4 passes the flag.
After the command, step 1 pushes; the new head makes the left entry stop applying and the archive boards
again at its next run. `conduct-check.mjs#actorOf`: `rejoin-archive` to `MAIN`; `change-loop.mjs`
`ROWS`: `rejoin-archive: session('delivery')`. `flow-check.mjs#readDelivery`: `rejoin-archive` is
`next('delivery', 'rejoin-archive', { train })`.

`conduct-check.mjs#serializeArchives` returns the rows unchanged when the project's train is on, so
archives no longer wait on each other (AC-9); `releaseConflict` needs no change, because in a train
project no row it overrides is returned. "The project's train is on" has one reader in
`conduct-check.mjs`: `compute` calls `readTrainSetting(root)` (D-1) once, keeps the suite it returns in `ctx` as
`ctx.train` (`null` without the key or when the setting has a problem), and both `serializeArchives` and
`trainRejoin` read `ctx.train`, never the file again. In a project without the key `ctx.train` is
`null` and `serializeArchives` keeps today's serialization (P3b negative).

**The loop** (`change-loop.mjs`): `ROWS` gains `boarded: { end: 'owner' }`, `on-train` and `wait-train`
as `{ end: 'github' }`, `rejoin-train: handOff('implementation', 'tdd-implementer')`,
`close-boarded-pr: session('delivery')`, `rejoin-archive: session('delivery')` (six new steps with
`boarded`); `OWNER_STEP.boarded = 'waiting-train'`; the GitHub end's
`what` is `train` for `on-train` and `wait-train`; `GATE_OF_WHY['waiting-train'] = 'train'`. New
messages: `waiting-train` ("{id} is boarded: it leaves with the next train, which /devkit train
departs." and its Portuguese), `what.train`, `gate.train`. `conduct-check.mjs#actorOf`: `rejoin-train`
to `TDD`, `close-boarded-pr` and `rejoin-archive` to `MAIN`, `boarded` to `OWNER`, `on-train` and
`wait-train` to `GITHUB`.

**Other readers of the checkouts.** `change-loop.mjs#unfinished` lists the active change folders of
every checkout; the train's worktree `.claude/worktrees/train-<n>` holds every boarded change's folder
until N13 cleans it. `unfinished` skips a checkout whose branch matches `^train/\d+$`, so a change is
never reported from the train's checkout (one P13 test).
`flow-check.mjs#readDelivery` takes the same train facts: `rejoin-train` is
`next('implementation', 'left-train', { train })`, `on-train` and `wait-train` are
`end('waiting-on-github', 'on-train', { number })`, `boarded` is `end('waiting-for-owner', 'boarded')`,
each with its `TEXT` line in both languages.

## D-3 The boarded set and its order (AC-2, AC-4, AC-9; spec `delivery-train`)

The departure (D-5) computes the boarded set from GitHub and Git, never from a stored queue:

1. `git fetch origin` (all branches) and `gh pr list --base <base> --state open --limit 100 --json
   number,url,headRefName,headRefOid`.
2. A candidate is a PR whose head is `chore/archive-<id>`, or whose head branch names an active change
   at its head: `openspec/changes/<id>/` exists at `headRefOid` and `branchNamesChange(headRefName, id)`
   holds, the predicate `findChangePr` already uses to take a branch as a change's own (the last path
   segment equals the id, or the name contains it). When several active ids match one branch, the one
   equal to the last path segment wins; when none is equal, the PR is not a candidate and the departure
   lists it in its reply as skipped. So a change reported `boarded` in its own run is the one the
   departure takes.
3. For each candidate, `git worktree add --detach <scratch>/board-<number> <headRefOid>` and
   `collectState(<that worktree>, id, { env: { ...cleanOf(env), DEVKIT_BRANCH: <headRefName> }, gh })`,
   then `nextStep`: the candidate is boarded when the step is `boarded`. The worktree is removed in a
   `finally` (`git worktree remove --force`, then `git worktree prune`). `<scratch>` is a fresh
   `mkdtemp` under the system temporary folder.
4. Order: a change's boarding time is the committer time of the newest commit in its head's history
   that touches `openspec/changes/<id>/reviews/` (`git log -1 --format=%cI <head> -- <path>`), the time
   its review became approved at that head; an archive's is its head's committer time. Ties go to the
   lower PR number.

A change whose head moved after boarding is judged at its new head, so it boards again only once its
evidence and reviews are current there (ADR 0022 Consequences, "A change pushed after boarding").

## D-4 The train record (AC-5, AC-6, AC-7, AC-8; specs `delivery-train`, `reviews-check`)

`openspec/trains/<n>.md`, written by the departure and committed on `train/<n>` (a path under
`openspec/`, so the `Commit:` rule lets it follow the suite's run without staling it):

````text
<!-- devkit-train n=4 base=main result=passed -->
# Train 4

- Base: `main` at `<40 hex>`
- Suite: `<the command>`
- Ran at: `<40 hex>`
- Result: passed

## Boarded

| Order | Kind | Change | Pull request | Head | Boarded at |
|---|---|---|---|---|---|
| 1 | change | `alpha` | #81 | `<40 hex>` | 2026-11-23T10:00:00Z |
| 2 | archive | `gamma` | #85 | `<40 hex>` | 2026-11-23T10:05:00Z |

## Left

| Kind | Change | Pull request | Head | Why | Detail |
|---|---|---|---|---|---|
| change | `beta` | #83 | `<40 hex>` | conflict | `plugins/x/hooks/a.mjs` |
| change | `delta` | #84 | `<40 hex>` | red | Failure of `delta`, below |

## Runs

| Run | Changes | Head | Result |
|---|---|---|---|
| 1 | alpha, gamma, delta | `<40 hex>` | failed |

## Failure of `delta`

```text
<the last 80 lines of the red run's output>
```
````

- `deliver-check.mjs#parseTrainRecord(text)` returns `{ n, base, result, baseSha, suite, ranAt, boarded:
  [{ order, kind, id, number, head, at }], left: [{ kind, id, number, head, why, detail, failure }] }`
  or `{ error }`. Errors: an empty file; a first line that is not the `devkit-train` header; a fence
  that opens and never closes (a fence-opening line `fencedLines` leaves outside every block); no
  `## Boarded` table or an empty one; a head that is not 40 hex; a kind other than `change` or
  `archive`; orders that are not 1 to m; a `why` other than `conflict` or `red`. Tables are read
  outside fenced blocks only; `failure` is the text of the fenced block under `## Failure of \`<id>\``.
- `train-loop.mjs#writeTrainRecord(record)` writes that form; the failure's fence is one backtick
  longer than the longest backtick run that starts a line of the output (at least three), so the
  writer never produces an unclosed fence. `parseTrainRecord(writeTrainRecord(r))` gives `r` back (a
  test).

## D-5 The departure: `/devkit train` and `train-loop.mjs` (AC-4, AC-12; specs `delivery-train`, `change-coordination`)

**The verb.** `change-loop.mjs#startMode`: `train` joins the verbs (`if (!['change', 'roadmap',
'status', 'project', 'train'].includes(verb))`); `projectGate` runs first; text after `train` gives mode
`train-args` with its message; otherwise mode `train`, which the skill hands to `train-loop.mjs`.
`verb-unknown` names `/devkit train` in both languages.

**The script** `plugins/openspec/hooks/train-loop.mjs` (new; no dependencies; imports
`deliver-check.mjs`, `release-merge.mjs`, `merge-setup.mjs` and the message table of `change-loop.mjs`):

```text
node train-loop.mjs next   --lang <l> [--after <progressKey>]
node train-loop.mjs depart --lang <l> [--update]
node train-loop.mjs wait   --lang <l>
```

`next` prints one JSON action `{ version: 1, kind: 'session' | 'end', step, detail, reply, end?:
{ state, why }, progressKey }`; exit 0 an action, 1 a wait, 2 blocked, 3 unreadable, as the change loop.
It derives everything on each call. First match wins:

| # | Fact | Action |
|---|---|---|
| N0 | the train setting is off or refused | end blocked with `train-off` ("this project has no delivery train; `devkit.delivery.train` switches it on") or the setting's refusal (D-1) |
| N1 | the departure lock `<git common dir>/devkit/train.lock` exists and is younger than six hours | end waiting for the owner `train-running` ("a train is departing"), exit 1 |
| N2 | a local `train/<n>` branch with a record and no PR, not on `origin` | session `push-train` (`git -C <worktree> push origin train/<n>`) |
| N3 | `train/<n>` on `origin` with no PR | session `open-train-pr` (`gh pr create --base <base> --head train/<n> --title "train <n>: <ids>" --body-file <worktree>/openspec/trains/<n>.md`) |
| N4 | open train PR, `mergeStateStatus` `BEHIND` | session `update-train` (`detail.command` = `node train-loop.mjs depart --update`, run in the background) |
| N5 | open train PR, a check failing | end blocked `train-blocked`, naming the check and its link |
| N6 | open train PR, record not passed or not current at its head | end blocked `train-blocked`, naming the record's problem |
| N7 | open train PR, `trunk-auto`, merge setup with method `merge` missing | end blocked `train-blocked` naming the missing setting and `github-setup.mjs --method merge` |
| N8 | open train PR, `trunk-auto`, auto-merge off | session `enable-auto-merge` (`gh pr merge <n> --auto --merge --match-head-commit <head>`) |
| N9 | open train PR, `trunk-auto`, auto-merge on | end waiting on GitHub `train-auto-merge-on` |
| N10 | open train PR, `trunk`, checks pending | end waiting on GitHub `train-checks` |
| N11 | open train PR, `trunk`, checks green | end waiting for the owner `train-ready` (the owner merges it) |
| N12 | the newest train PR merged and a PR its record lists as boarded still open | session `close-boarded-pr` |
| N13 | the newest train PR merged, its worktree or local branch still there | session `clean-train` (`git worktree remove <worktree>`, `git branch -d train/<n>`) |
| N14 | nothing boarded (D-3) | end waiting for the owner `train-nothing`, exit 1 |
| N15 | otherwise | session `depart` (`detail.command` = `node train-loop.mjs depart`, run in the background) |

N1 reads "waiting for the owner" because only a second request reaches it and there is nothing to wait
on GitHub for; the reply says the departure under way will end by itself, and that when no departure
runs (a session that died mid-run) the owner may delete the lock file, whose path `detail.lock` holds,
or wait six hours for the takeover. A train whose PR was closed
without merging is not under way: its leavers go back to their cycle (D-7) and its boarded changes
board again.

`depart` takes the lock with an exclusive create (`O_EXCL`; one older than six hours is taken over),
releases it in a `finally`, and prints `{ n, branch, worktree, boarded, left, runs, result }`:

1. Fetch, compute the boarded set (D-3). None: exit 1 with `train-nothing`.
2. `n` = one more than the highest number among `openspec/trains/*.md` on `origin/<base>`, the
   branches `origin/train/*` and the local `train/*`.
3. Build: `git worktree add --detach <scratch>/train-<n>-run-<k> origin/<base>`, then for each boarded
   head in order `node release-merge.mjs --merge <head> --json` there (D-6). Exit 2 with conflicts:
   that change leaves (`why: conflict`, the paths), the build goes on with the next.
4. Run the suite (D-7). Red: bisect, take the culprit off, build again without it, run again.
5. Green: write the record, commit `chore(train): record train <n>` in the build, create the branch
   `train/<n>` at that commit and the worktree `.claude/worktrees/train-<n>` on it, remove every scratch
   worktree. Nothing is pushed.

`depart --update` (N4) works in `.claude/worktrees/train-<n>`: `node release-merge.mjs --base <base>`
(today's mode: the train's releases renumbered above the base's), the suite once, the record rewritten
with the new `Ran at` and a new run row, one commit; a red run ends blocked naming the base's merge (the
boarded changes passed together; what broke is what the base brought).

`wait` polls `next` every `DEVKIT_POLL_SECONDS` (30) with no limit and prints the action once it differs
from the first one, as `change-loop.mjs wait` does.

**The skill.** `plugins/openspec/skills/devkit/SKILL.md` gains the verb in its description and
`argument-hint`, the modes `train` and `train-args` in `## Start`, and a `## Train` section: run `next`;
carry out `depart` and `update-train` with the Bash tool's background option and run `next` when they
end; run each other session step's `detail.command` alone; an end says its `reply`, and a wait on GitHub
starts `train-loop.mjs wait` in the background. The coordinating session of a roadmap run may run the
same calls; when it does so on its own is `roadmap-sessions-upfront`'s.

Where the skill's new text sits (each place chosen so that the tests that slice the skill by its
headings keep reading the same text; the rows of D-13 list them):

- `## Train` goes between `## Waiting on GitHub` and `## Roadmap`. The headings become `## Settings`,
  `## Start`, `## A new change`, `## Loop`, `## Owner gates`, `## Waiting on GitHub`, `## Train`,
  `## Roadmap`, `## Status`, `## Project`, `## Never`. So the last three stay Status, Project, Never
  (`project-loop.test.mjs:1570`), the Roadmap-to-Status slices of `roadmap-loop.test.mjs` (lines 1836,
  1882, 2274, 2282, 2597) and the Owner-gates-to-Waiting slice of `guard.test.mjs:1580` hold no train
  text, and the Waiting-to-Never slice of `change-loop.test.mjs:2420` only gains text its positive
  assertions ignore. Only the exact list at `change-loop.test.mjs:2439` changes.
- `argument-hint` gains `| train` between `status` and `project`: `change [<request> | <change-id> |
  <Jira key or link>] | roadmap [<n> | stop] | status | train | project [<name>]`, so it still ends with
  `| project [<name>]` (`project-loop.test.mjs:1572`); the exact hint at `roadmap-loop.test.mjs:1823`
  changes.
- The description gains, after the sentence that ends "and /devkit status shows where everything is.",
  the sentence "/devkit train departs the boarded changes of a project with a delivery train, together
  on one train." and its closing list becomes "... /devkit roadmap [<n> | stop], /devkit status, /devkit
  train or /devkit project [<name>]." The phrases pinned by `roadmap-loop.test.mjs:1825-1826`,
  `project-loop.test.mjs:1573` and `guard.test.mjs:1579` stay as they are.
- `verb-unknown`: English "So far /devkit change, /devkit roadmap, /devkit status, /devkit project and
  /devkit train exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap,
  /devkit status to see where everything is, /devkit project and a name to plan a new project or slice,
  or /devkit train to send the boarded changes on one train."; the Portuguese text, in the message
  table of `change-loop.mjs`, is today's with the same two edits: its list becomes `... /devkit status,
  /devkit project e /devkit train`, and its last clause is followed by the Portuguese of "or /devkit
  train to send the boarded changes on one train". The English regexes (`change-loop.test.mjs:976`,
  `roadmap-loop.test.mjs:807`) still match; the two Portuguese prefixes (`change-loop.test.mjs:975`,
  `roadmap-loop.test.mjs:808`) change.

**The lock record.** `guard.mjs#roadmapRunOf` treats a typed `/devkit train` like `/devkit status`
(`!isDevkitVerb(event.typed, 'status') && !isDevkitVerb(event.typed, 'train')`); `runOf` is unchanged,
so the change run ends (spec `coordination-locks`).

## D-6 The join: `release-merge.mjs --merge <rev>` and the roadmap tick (AC-4, AC-8; spec `delivery-train`)

`release-merge.mjs` gains a second mode; `--base <base>` is unchanged byte for byte in what it does.

```text
node release-merge.mjs --merge <rev> [--json]
```

It merges `<rev>` into the current branch (`git merge --no-ff --no-commit <rev>`) and renumbers what
`<rev>` released above the current branch's numbers: the same computation as `--base` with the roles
swapped. With `M = merge-base(HEAD, <rev>)`, `resolveVersions` runs with `oldHead = <rev>` (the side whose
bumps are kept by kind) and `ref = HEAD` (the side numbered above); the conflicted release files keep the
current branch's side (`checkout --ours`, the train's tip) before `resolveManifest`, `resolveChangelog`
and the pin are written; the pin's three stages are read with `ours = :2` and `theirs = :3`
(`mergeStages` gains an orientation argument). The commit message is `chore(train): join <rev7> and
renumber its release above the train`. `<rev>` already an ancestor of HEAD: exit 0, nothing to do. The
JSON gains `mode: 'merge'` and `conflicts` (the paths it resolved by rule).

The roadmap tick, in `--merge` mode only (so no project without the train sees a new resolution): a
conflict in `openspec/roadmap.md` is resolved by `resolveRoadmapTicks({ mergeBase, change, base })` when
every line that differs between `mergeBase` and `change` differs only by `- [ ]` becoming `- [x]`, with
the same rest of the line, and each such line exists unticked or ticked in `base`: the result is `base`
with those lines ticked. Anything else (a line added, removed or reworded; a ticked line `base` lacks)
throws, and the path counts as blocking. The texts are split on `\n`; a missing final newline is kept
as `base` has it. `classifyConflict` gains an optional `{ roadmap }` resolver, passed only by `--merge`,
by `--base` under the flag `--roadmap-ticks`, and by `conduct-check`'s override 4 (D-2), which alone
passes that flag. Its return grows from `{ blocking, pinMerged }` to `{ blocking, pinMerged,
roadmapMerged }`: `roadmapMerged` is the resolved text of `openspec/roadmap.md` (or `null` when the
roadmap is not in conflict or no resolver was passed), so `release-merge.mjs#main` has the bytes to
write, as it writes `pinMerged` today, and `conduct-check` uses only `blocking` for the classification.

Rejected: resolving the tick in `--base` mode by default. It would change what `resolve-release-conflict`
returns for projects without the train, which AC-1 forbids; the flag keeps it to the archive that left a
train.

## D-7 The suite, the bisection and the red train (AC-5, AC-7; spec `delivery-train`)

`runSuite(worktree, suite)`: `spawnSync('sh', ['-c', suite], { cwd: worktree, env: process.env,
encoding: 'utf8', maxBuffer: 256 MiB })`, no timeout; green when it exits 0; the record keeps the last
80 lines of stdout and stderr of a red run.

Bisection over the joined list `L` (conflict leavers already out), `m = |L|`, known red at `m - 1`:
`lo = 0, hi = m - 1`; while `lo < hi`: build the prefix `L[0..mid]` (`mid = floor((lo + hi) / 2)`) in a
new scratch worktree, run the suite, `hi = mid` when red else `lo = mid + 1`. The culprit is `L[lo]`.
When `lo` is 0 the suite also runs on `origin/<base>` alone: red there ends the departure blocked with
`train-base-red` and nobody leaves. Otherwise the culprit leaves (`why: red`, its failure being the
output of the smallest red prefix), and the train is rebuilt without it and run again: one more run
(AC-7). The loop ends green or with an empty train (`train-nothing`, every boarded change listed as
left in the reply). Runs per red train: `ceil(log2 m)` plus one, plus one when the culprit is first.

The culprit's "own cycle against the train's tip" (ADR 0022 decision 7) is read as: against the base
branch once the train it left has landed, which is that train's tip. While the train is open the change
waits on GitHub (T2); then `rejoin-train` hands `tdd-implementer` the brief "merge `origin/<base>` into
the branch with `node release-merge.mjs --base <base>` when only release files conflict, else `git merge
origin/<base>` and resolve `<paths>` / fix the failure below, test first", with the record's failure or
paths in `detail`. Its next commit changes its head, so the left entry stops applying and the ordinary
rows (verify, review) follow. Merging the open train's branch instead was rejected: a train that is
rebuilt or closed would leave commits of an abandoned branch in the change.

## D-8 The train's pull request (AC-4, AC-10; spec `delivery-train`)

- Opened by the session (N3) from `train/<n>`, its body the record, so the owner reads which changes
  ride, which left and why.
- `trunk-auto`: auto-merge with `--merge`, pinned to the head `next` checked (N8), whatever the
  project's `merge_method`; GitHub merges once `check` and `devkit-reviews` pass (ADR 0022 decision 9).
  `trunk`: the owner merges (N11), and the reply asks for a merge commit.
- The ruleset is unchanged: the train is up to date when it departs (cut from a fresh `origin/<base>`);
  when an unboarded PR merges meanwhile, N4 brings the base in and runs the suite once more.
- Auto-merge on a boarded PR: never enabled (no row returns `enable-auto-merge` for a change of a train
  project) and disabled when found (T1, P3a).

## D-9 After the merge (AC-10; specs `delivery-train`, `change-delivery`)

GitHub marks a pull request merged when its head commit reaches its base branch; the train's merge
commit brings every boarded head unchanged, so each boarded PR is expected to read `MERGED` (the
requirements' option (a)). The code does not depend on it: a boarded PR still open after its train
merged is delivered by the train (D-2) and closed with a comment (N12 in the train's run, and
`close-boarded-pr` in the change's own run, whichever runs first; the second finds it closed and goes
on). The post-merge phase then runs as today: retro, archive, and the archive boards the next train.

The tag: a train whose release changes devkit-openspec's version is tagged `v<the train's version>` on
the train's merge commit; the intermediate versions of the boarded changes get no tag
(`CONTRIBUTING.md`, D-11).

## D-10 `devkit-reviews` on a train (AC-5, AC-6, AC-9; spec `reviews-check`)

In `runCi`, before `selectCiChange`: when the head branch (`currentBranch`) matches `^train/(\d+)$`,
`trainCheck(root, n, env, facts)` decides the whole run. It reads `openspec/trains/<n>.md` at the PR
head and fails, with one line per problem, when:

1. the record is missing ("the departure writes it: /devkit train") or `parseTrainRecord` gives an error;
2. `result` is not `passed`, or `staleness(root, { sha: ranAt }, facts)` is not null (a commit outside
   `openspec/` after the run);
3. a boarded head is not an ancestor of the PR head (`merge-base --is-ancestor`);
4. a commit of `origin/<GITHUB_BASE_REF>..HEAD` reachable from no boarded head changes a path outside
   `RELEASE_FILE`, `TRAIN_PIN_FILE`, `openspec/roadmap.md` and `openspec/trains/<n>.md`: for a merge
   commit the paths that differ from `autoMergeTree(first, second)`, for any other commit its own paths;
5. a boarded change fails at its own head: a scratch worktree at that head, then `checkOne(<worktree>,
   id, gitFacts(<worktree>), null, { trainParts })` with `trainParts` from `ciTrainParts` (below), as
   the check judges a change's own PR;
6. a boarded archive fails at its own head: the same scratch worktree, then the archive judgement of
   today on the folders its head brings against `origin/<base>` (`archivePrCheck`).

It prints one result line per boarded entry and passes only when every one passes. It reads no
`ship`, no `merge_method`, makes no GitHub call, and ignores `DEVKIT_BYPASS`, as today. The template
`devkit-reviews.yml` needs no change: `fetch-depth: 0` already brings every boarded head.

**The train parts on every `devkit-reviews` run, not only the train's** (a change's own pull request
in a train project included). New `ciTrainParts(root, env)` in `deliver-check.mjs`: with
`ciSettingsRef(root, env)`'s `ref`, `git show <ref>:openspec/config.yaml`, then
`trainSetting(parseDevkitBlock(text))` (D-1) and the `&&` parts of `suite`, trimmed; `[]` when there is
no ref, no file or no key; a `problem` is a `UsageError` (exit 3), as `twoPrsContext` treats a refused
delivery setting. `runCi` calls it once, after `ciPreflight`, for every devkit change, and passes `{
trainParts }` to `checkOne` (the single change), to `runSeveral` (which passes it to each `checkOne`)
and to `trainCheck`. `checkOne(root, id, facts, two = null, { trainParts = [] } = {})` hands it to
`tasksItem`. So the change's own pull request in a train project passes item 1 with no evidence row for
a train part, and a project without the key judges item 1 exactly as today (`trainParts` empty).

The local reader and CI agree on one rule: locally `collectState` takes the parts from
`deliveryConfig` (the checkout's `openspec/config.yaml`, as every delivery setting today), CI from the
default branch's file (ADR 0018 decision 3). They differ only for a change that itself adds, edits or
removes the key; such a change proves every part of its gates in `evidence.md`, which both readers
accept (a `pass` row satisfies a part whether or not it is a train part). The row `pr-verifier` writes
for a train part (D-11) ends in a cell that starts with `train:`, never `pass`, so neither reader takes
it for a pass: the part is met only by being a train part of the settings that reader reads.

**No new import** (ADR 0018: the job downloads `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`
only). `trainSetting` joins the existing import from `./guard.mjs`. The CI pin's path is a constant of
`deliver-check.mjs`, `TRAIN_PIN_FILE = 'docs/openspec-flow.md'`, never `release-merge.mjs`'s
`PIN_FILE` (`release-merge.mjs` imports `deliver-check.mjs`, and the job does not download it); a P11
test asserts `TRAIN_PIN_FILE === PIN_FILE`, and another runs `deliver-check.mjs --ci` on a train PR in
a folder that holds only the three downloaded files.

## D-11 The tasks item in a train project, the evidence and the release notes (AC-5; spec `change-delivery`)

- `tasksItem(root, id, facts, { trainParts = [] } = {})`: a gate part equal to one of `trainParts`
  (trimmed text) is not in `missingGates`; `details.trainParts` lists the ones it skipped and the met
  reason adds `; <k> proven by the train`. `collectState` passes `state.train.parts`; `checkOne` passes
  the parts `ciTrainParts` read (D-10); without the train the list is empty and the item is today's.
- `plugins/core/agents/pr-verifier.md`: in a project whose `devkit.delivery.train` is set on the
  default branch, a gate part equal to a part of that command is not run; its row reads `| <gate> |
  \`<part>\` | train: proven by the train record |`. The last cell starts with `train:`, so the
  `/^pass/i` reading of `tasksItem` never takes it for a pass (D-10, "The local reader and CI agree").
  A change that adds, edits or removes the key runs every part. The new text names neither screenshots
  nor pull-request comments (`change-loop.test.mjs:2845-2854` pins both out of the agent).
- `CONTRIBUTING.md`: the paragraph on merging a base during review and the release step (lines 17 and
  56 at `19c0196`) gain the train case (a boarded change takes its numbers on the train and never merges
  `main` for a sibling); the tag paragraph (line 58) gains the train's tag (D-9).

## D-12 ADR 0022, documents, skills and release (AC-11)

- ADR 0022 is the adr-author's (`decisions.md`). After the owner's approval names it: status `accepted`,
  an `Accepted by:` line in ADR 0012's form, and `- Amended by ADR 0022 (...)` header lines plus a dated
  Note (`Note (delivery-train, <date>): ...`, one sentence on what is amended, "The Decision is otherwise
  unchanged.") in ADRs 0002, 0003, 0012 and 0018; the `ADRs:` line of `openspec/config.yaml` gains
  `0019 reviewed changes leave on a delivery train, amends 0002, 0003, 0012 and 0018`. When a sibling
  took the number 0019 on `origin/main` at the last merge before review, the ADR and every reference
  move to the next free number.
- `docs/openspec-flow.md`: a `### The delivery train` subsection after `### Delivery models` (the key,
  boarding, `/devkit train`, the record, the red train, the join rules, the tag); the delivery-contract
  rows T1-T9 and the archive changes; the CI section's train mode. `docs/coordination-design.md`
  section 5 gains the train paragraph. `docs/roles.md`: the change-coordinator and
  roadmap-coordinator entries gain "departs the train on `/devkit train`". `plugins/openspec/README.md`:
  one line for `train-loop.mjs`. `plugins/openspec/skills/ship-change/SKILL.md`: rows `boarded`,
  `on-train`, `wait-train`, `rejoin-train`, `close-boarded-pr`, `rejoin-archive`, after `ready-base`.
- Release: devkit-openspec minor, devkit-core patch, the marketplace metadata, one `CHANGELOG.md` entry,
  `docs/catalog.md` regenerated, the CI pins of `docs/openspec-flow.md` moved to the new tag; each
  number is the next one after `origin/main`'s at the last merge before review.
- This repository switches the train on in a follow-up pull request once the release is installed
  (`devkit.delivery.model: trunk-auto` and the key, the `ship:` entries agreeing; `github-setup.mjs
  --method merge` for merge commits). Doing it in this change would make the change's own delivery
  board a train the installed pack cannot depart.

## D-13 Tests and the real-run proof (AC-1 to AC-12)

All new tests live in `plugins/openspec/hooks/delivery-train.test.mjs` (imported by
`plugins/openspec/hooks/guard.test.mjs`, one line), names starting `delivery-train `. Scenarios run on
real Git in temporary folders from `test-tmp.mjs` (a bare origin, a main checkout, worktrees), with the
simulated GitHub of `delivery-models.test.mjs` (`simGitHub`, exported from there, extended with
`headRefName` filters, `mergeCommit`, a train PR, `gh pr close`, `gh pr comment`, `gh pr merge --auto
--merge --match-head-commit` and `gh pr merge --merge`, an `autoMergeRequest` and a `mergeStateStatus`
set per PR in place of today's fixed `null` and `'CLEAN'` (whose defaults stay those two values, so the
existing `delivery-models` tests read the same answers), and a log of every argument list it received)
and `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF`, `DEVKIT_*` blanked.

**The test that proves each criterion.**

| AC | Test |
|---|---|
| AC-1 | `delivery-train AC-1: without the key the delivery rows and the loop's actions are today's` (one fixture per delivery row run under `ship: merge`, under `model: trunk-auto` and under `model: trunk-auto` with an empty `train:`, each giving the same JSON and exit code); `delivery-train config: ...` (P1, P2); every existing suite unchanged (6.9) |
| AC-2 | `delivery-train AC-2: a change approved at its head is boarded behind main, with pending checks, in its order` |
| AC-3 | `delivery-train AC-3: a sibling's merge into main leaves the boarded change's evidence, reviews and action as they were` |
| AC-4 | `delivery-train AC-4: one departure cuts train/<n>, joins in order, renumbers on the train only, opens one pull request; a second request starts none` |
| AC-5 | `delivery-train AC-5: the suite runs once at the train's head into the record; the tasks item skips the train's parts` |
| AC-6 | `delivery-train AC-6: devkit-reviews judges each boarded change at its own head, its containment, the train's own commits and the record` |
| AC-7 | `delivery-train AC-7: two changes that pass alone and fail together: the later leaves with the failure, the rest departs after one more run` |
| AC-8 | `delivery-train AC-8: a release-only conflict is resolved by rule; a product conflict takes the change off with its path` |
| AC-9 | `delivery-train AC-9: two archives board together, no archive branch is updated, each folder is judged in the train's check` |
| AC-10 | `delivery-train AC-10: after the merge every boarded change is delivered, merged or closed with a comment; trunk-auto enables auto-merge with --merge, trunk waits for the owner` |
| AC-11 | `delivery-train docs: the documents follow` (P10) and the gates `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` |
| AC-12 | `delivery-train AC-12: the real run` (below), and `proof/real-run.md` |

**One test per condition and label of each new predicate** (each bullet is one test; "neg" marks a
negative):

- P1 `trainSetting`: no key (neg); empty value (neg); `trunk`; `trunk-auto`; `two-prs`; no model; an
  unknown model; double and single unclosed quotes; a quoted command with `&&` and `#`; nested under
  another key (neg).
- P2 `deliveryConfig` and `projectGate` with the train: `train` added; three refusals with their
  messages in both languages; a refused train setting stops `/devkit roadmap`, `/devkit status` and
  `/devkit project` as it stops `/devkit change` and `/devkit train`; `readDevkitSettings` with a train
  value holds `train: { suite, problem: null }`, and without the key keeps `{ driver, language, unknown }`
  (neg); the five shape tests of `delivery-models.test.mjs` unchanged (neg).
- P3 boarding rows T1-T9 and the archive rows A1-A5: one per row, plus "pending checks board", "a
  failing check does not", "behind and in conflict board", "a push after boarding unboards", "auto-merge
  on an archive PR is disabled, then the archive boards"; the fields in `trunk`: with the key, `fetchPr`
  and `findChangePr` ask `MERGE_FIELDS` and T1 disables auto-merge found on; without the key, every
  `gh` argument list of a `trunk` project equals today's (neg); in `trunk-auto` the fields are today's
  either way (neg).
- P3b override 4 (`trainRejoin`): a clean merge with the base gives `rejoin-archive` with the
  `--roadmap-ticks` command; release files and a roadmap tick give the same; a canonical spec conflict
  gives `stop-archive` with `train-left` and the path; an unpushed merge gives the push; a change row
  (not an archive) is left alone (neg); `--base` without `--roadmap-ticks` on a roadmap tick conflict
  still exits 2 (neg); in a project without the key (`ctx.train` null) `serializeArchives` still holds
  the second archive back (neg); `classifyConflict` without a resolver returns `roadmapMerged: null`
  (neg).
- P4 `trainFacts`: on an open train; carried by a merged one; left on an open one; left on a closed one;
  a record at another head (neg); GitHub silent.
- P5 `parseTrainRecord`: a full record; empty file; no header; an unclosed fence; an empty boarded
  table; a bad head, kind, order or `why`; the round trip with `writeTrainRecord` including an output
  that holds a fence of four backticks.
- P6 `release-merge --merge`: no release file; two identical minor bumps (0.30.0 then 0.31.0, the
  CHANGELOG order); a patch above a minor; a product conflict (exit 2, the tree as it was); the pin; an
  ancestor (nothing to do); `--base` unchanged (the existing `release-merge.test.mjs` suite passes
  unchanged, neg).
- P7 `resolveRoadmapTicks`: two neighbouring ticks; a tick of a line the base already ticked; a reworded
  line (throws); an added line (throws); no final newline.
- P8 the bisection: culprit last, culprit in the middle of four, culprit first with a green base,
  culprit first with a red base (blocked), a train that empties.
- P9 `train-loop.mjs next` rows N0-N15, one each; the lock taken over after six hours; `depart --update`;
  the candidate rule of D-3 step 2: a branch `feat/alpha-beta` whose name contains the active ids
  `alpha` and `beta` with neither equal to its last segment is skipped and listed (neg), and
  `feat/alpha-beta/beta` is taken as `beta`.
- P10 docs: `docs/openspec-flow.md` names `devkit.delivery.train`, `/devkit train` and
  `openspec/trains/`, and its CI section names the train mode (written once 4.3 lands; the assertion is
  added in 4.3); `plugins/openspec/skills/devkit/SKILL.md` has a `## Train` section;
  `plugins/openspec/skills/ship-change/SKILL.md` has one row per new step.
- P11 `runCi` train mode: each failure of D-10 (1-6), failure 2 once with `result=failed` and once with
  a later commit outside `openspec/`, and a pass. The train parts on a change's own PR: in a train
  project (key on the default branch) with the whole-suite part absent from `evidence.md`, `--ci` on
  the change's PR passes and its report lists the part under `details.trainParts`; the same PR without
  the key fails on item 1 naming that part (neg); `runSeveral` passes the parts to each change; a
  refused key on the default branch exits 3. `TRAIN_PIN_FILE === PIN_FILE`; `--ci` on a train PR run
  from a folder holding only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` loads and judges
  (no missing import).
- P12 `roadmapRunOf`: `/devkit train` keeps the roadmap run; `/devkit change` after it still ends it (neg).
- P13 `/devkit train` start: mode `train`; `train now` gives `train-args`; the refusals; `unfinished`
  skips a checkout on `train/4` holding an active change folder, and still lists the same change from
  its own worktree (neg).

**Existing tests this plan touches.** Grep of `plugins/openspec/hooks/*.test.mjs` at `19c0196`, as
`openspec/config.yaml` ("Existing tests") asks, for every message, key and text this plan changes:
`verb-unknown`, `Por enquanto existem`, `/devkit project`, `argument-hint`, `^description`, the skill's
`## ` headings (`heads`, `'## Status'`, `'## Roadmap'`, `'## Waiting on GitHub'`, `'## Owner gates'`),
`readDevkitSettings`, `deliverySettings`, `GATE_OF_WHY`, `ROWS`, `actorOf`, `RELEASE_FILE`, `PIN_FILE`,
`ship-change`, `pr-verifier.md`, `roles.md`, `openspec-flow.md` and `serializeArchives` (no test names
it). Every hit is a row:

| Test (file:line) | What pins it | What happens | Task |
|---|---|---|---|
| `change-loop start: S2 ...`, `change-loop.test.mjs:975` | `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status e \/devkit project` | changes to `... \/devkit status, \/devkit project e \/devkit train`; invariant: the reply names every verb that runs, in order | 3.5 |
| same test, `change-loop.test.mjs:973, 976-977` | `render('en', 'verb-unknown')` equality, the English list in order, the placeholder language | unchanged: the English text keeps the order and appends `/devkit train` | 3.5 |
| `roadmap-loop.test.mjs:807` | the English list in order | unchanged | 3.5 |
| `roadmap-loop.test.mjs:808` | the Portuguese prefix, as line 975 | changes as line 975; same invariant | 3.5 |
| `change-loop skill: the sections of D-3 to D-9 ...`, `change-loop.test.mjs:2436-2445` | the exact list of the skill's `## ` headings and the start modes | the list gains `'## Train'` after `'## Waiting on GitHub'`, the modes gain `'train'` and `'train-args'`; invariant: the skill keeps its sections and start modes | 3.6 |
| `project-loop skill: the section sits between Status and Never ...`, `project-loop.test.mjs:1570` | `heads.slice(-3)` is Status, Project, Never | unchanged: `## Train` sits before `## Roadmap` | 3.6 |
| same test, `project-loop.test.mjs:1572-1573` | `argument-hint` ends with `\| project [<name>]`; the description names `/devkit project` | unchanged: `train` sits before `project` in the hint | 3.6 |
| `roadmap-loop skill: the frontmatter ...`, `roadmap-loop.test.mjs:1823` | the whole `argument-hint` | changes to the hint of D-5; invariant: the hint lists every verb with its arguments | 3.6 |
| same test, `roadmap-loop.test.mjs:1824-1829` | the description's roadmap and status phrases; the `## Start` items | unchanged: the new sentence comes after them | 3.6 |
| `roadmap-loop.test.mjs:1836, 1882, 2274, 2282, 2597` | the text between `## Roadmap` and `## Status` | unchanged: no train text in that slice | 3.6 |
| `change-loop skill: the wait is started in the background ...`, `change-loop.test.mjs:2420` | positive matches in the slice `## Waiting on GitHub` to `## Never` | unchanged: the slice gains `## Train`, which none of its matches excludes | 3.6 |
| `stage-roles gates: the devkit skill names the mock-up ...`, `guard.test.mjs:1578-1580` | the description's gates phrase; the slice `## Owner gates` to `## Waiting on GitHub` | unchanged | 3.6 |
| `project-loop.test.mjs:1550` | `/\/devkit project/` | unchanged | 3.5 |
| `change-loop.test.mjs:52, 216, 3216, 4124` | `readDevkitSettings` `deepEqual` `{ driver, language, unknown: [] }` | unchanged: `train` is added only when set (D-1) | 1.3 |
| the gate table, `roadmap-loop.test.mjs:578` (`expected`) | every `waiting-` key has its gate | gains `'waiting-train': 'train'`; invariant unchanged | 2.5 |
| the step scan, `change-loop.test.mjs:538-546` | every returnable step has a row and every row a step | unchanged; it fails until `ROWS` has the six new steps, which is its job | 2.5 |
| the actor test, `change-loop.test.mjs:562` | the loop's agent equals `actorOf`'s | unchanged | 2.5 |
| the five shape tests, `delivery-models.test.mjs:45-106` | `deliverySettings`' return shape | unchanged: the train is read by `trainSetting` (D-1) | 1.2 |
| `delivery-models docs ...`, `delivery-models.test.mjs:2118-2134` | the flow page's `### Delivery models` and the sentence "reads `devkit.delivery` from the default branch, and applies rules only in `two-prs`"; one `ship-change` row per two-prs step | unchanged: the train mode is a new sentence after that one, the new rows are other steps | 4.3, 3.6 |
| `ship-change` rows, `guard.test.mjs:1076, 1521-1535`, `flow-check.test.mjs:1385-1392` | the `stop-plan-approval`, `stop-mockup-approval`, `review`, `retro` rows and their order | unchanged: the new rows go after `ready-base`, before `archived`, and no pinned row changes | 3.6 |
| `stage-roles roles verifier ...`, `change-loop.test.mjs:2845-2854` | `pr-verifier.md` names no screenshot outside its Never line and no `gh pr comment` | unchanged: the train paragraph names neither | 5.3 |
| `docs/roles.md` headings, `flow-check.test.mjs:247-257`, `project-loop.test.mjs:148-153`, `roadmap-loop.test.mjs:1927, 2704`, `change-loop.test.mjs:2145` | a `## <role>` per role; the accepted packs | unchanged: two entries gain a sentence, no heading changes | 6.4 |
| `release list: RELEASE_FILE is unchanged ...`, `deliver-check.test.mjs:1938, 4875-4877` | `RELEASE_FILE`'s source | unchanged: `TRAIN_PIN_FILE` is a new constant | 4.2 |
| the `release-merge.test.mjs` suite | `--base` mode | unchanged: `--merge` and `--roadmap-ticks` are new | 1.4, 1.5 |

**The real run (AC-12).** `delivery-train AC-12: the real run` spawns the real command lines in a scratch
repository (a bare origin, a main checkout, worktrees), with a stub `gh` on `PATH` that answers from the
simulated GitHub's state file: `change-loop.mjs start` with `train` on standard input (the coordinating
session's request), then `train-loop.mjs next` and each action's command in turn, until the train's
pull request merges. The plan declares two departure-to-merge variants (AC-10: `trunk-auto`, where
GitHub merges, and `trunk`, where the owner merges), the red train, the join conflict, and the archive
that leaves; each case names its model and each variant has its own case, each from a fresh scratch
repository:

| Case | Model | What runs | Ends with |
|---|---|---|---|
| 1 | `trunk-auto` | changes `alpha` and `beta` and the archive of `gamma` board, depart (N15), push (N2), open the train PR (N3); `next` gives `enable-auto-merge` with `--merge` (N8), then `train-auto-merge-on` (N9); the stub merges the train PR with a merge commit, marking `alpha` merged and leaving `beta`'s PR open; `close-boarded-pr` (N12), `clean-train` (N13) | the train PR merged by the stub's auto-merge, `beta`'s PR closed with its comment, every boarded change's next action its retro (archive delivered) |
| 2 | `trunk` | `alpha` and `beta` board, depart, push, open the train PR; with the stub's checks pending `next` gives `train-checks` (N10), with them green `train-ready` (N11); the owner's merge is the stub's `gh pr merge <n> --merge` typed as the owner's step; `close-boarded-pr` and `clean-train` as in case 1 | the train PR merged by the owner's step, no auto-merge ever enabled on any PR (the stub's log holds no `--auto` call), both changes at their retro |
| 3 | `trunk-auto` | `alpha` and `beta` each add a test file; they pass alone and fail together; the departure bisects, `beta` leaves with the failure, the train runs once more and departs | the train PR merged as in case 1; `beta`'s next action `wait-train` while the train is open, then `rejoin-train` once it merged |
| 4 | `trunk-auto` | `beta` conflicts with `alpha` in a product file; the archives of `gamma` and `delta` edit the same canonical spec; the departure takes `beta` and the archive of `delta` off with their paths | the train PR merged as in case 1; `beta` at `rejoin-train`; the archive of `delta` at `stop-archive` (`train-left`) naming the spec path after override 4 classifies it |

Every case starts with `change-loop.mjs start` with `train` on standard input, as the coordinating
session sends it (the conducting session's own part). The implementer runs the same four cases by hand
(task 6.8) and records each command, its output and its exit code in
`openspec/changes/delivery-train/proof/real-run.md`; `pr-verifier` re-runs them for its evidence and
cites that file, and never writes it.

## Where the siblings meet

| Sibling | Its files | This plan's files nearby | How they meet |
|---|---|---|---|
| `roadmap-sessions-upfront` (open, not started) | `roadmap-loop.mjs`, `change-loop.mjs`, the skill | the skill's `## Train` and the verb | it calls `train-loop.mjs`; no shared edit planned |
| `stage-models` (open) | `change-loop.mjs` (`brief`, the model per stage), the skill | `ROWS`, messages, `startMode` | textual merges only; merge `origin/main` before phase 1 and before the release |
| `release-merge-conflict` (merged in #65, folder not archived) | `release-merge.mjs` | the `--merge` mode | this plan builds on its code at `19c0196` |

## Implementation plan

**Order** (dependency): the setting and the join (phase 1) → the record, the train facts and the
boarding rows in the checker and the loop (phase 2) → the departure script, the verb and the skill
(phase 3) → the CI train mode (phase 4) → after the merge: delivered by a train, the close step, the
archives (phase 5) → ADR, documents, release, the real run and the whole suite (phase 6).

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): `guard.mjs` (D-1, D-5 lock record), `deliver-check.mjs` (D-1, D-2,
  D-4, D-9, D-10, D-11), `release-merge.mjs` (D-6), `train-loop.mjs` (new; D-3, D-5, D-7, D-8),
  `change-loop.mjs` (D-1, D-2, D-5), `conduct-check.mjs` (D-2), `flow-check.mjs` (D-2).
- Skills and agents: `plugins/openspec/skills/devkit/SKILL.md`, `plugins/openspec/skills/ship-change/SKILL.md`,
  `plugins/core/agents/pr-verifier.md`.
- No worker or frontend surface; no CI workflow file changes.

**File structure.**

- Create: `plugins/openspec/hooks/train-loop.mjs`, `plugins/openspec/hooks/delivery-train.test.mjs`,
  `openspec/changes/delivery-train/proof/real-run.md` (evidence), `openspec/changes/delivery-train/proof/ac-map.md`.
- Modify: the hooks, skills and agent above; `plugins/openspec/hooks/guard.test.mjs` (one import),
  `plugins/openspec/hooks/delivery-models.test.mjs` (export `simGitHub`), `plugins/openspec/hooks/roadmap-loop.test.mjs`
  (`expected`, the `verb-unknown` regex); `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`,
  `docs/adr/0002-…`, `0003-…`, `0012-…`, `0018-…`, `docs/openspec-flow.md`, `docs/coordination-design.md`,
  `docs/roles.md`, `CONTRIBUTING.md`, `openspec/config.yaml` (the `ADRs:` line only),
  `plugins/openspec/README.md`, `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`.
- Delete: none.

**Estimate.** Optimistic 54 h · likely 76 h · pessimistic 110 h (the likely figure is the table's sum).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 `trainSetting`, `deliveryConfig`, `projectGate`, messages; P1, P2 | 4 | Core | LOW |
| D-6 `release-merge --merge`, `resolveRoadmapTicks`; P6, P7 | 7 | Core | MEDIUM |
| D-4 `parseTrainRecord`, `writeTrainRecord`; P5 | 4 | Core | LOW |
| `simGitHub` extensions and the scenario fixture | 5 | Testing | MEDIUM |
| D-2 `trainFacts`, rows T1-T9, archive rows A1-A5, the fields in `trunk`, `serializeArchives`, loop rows, `flow-check`, `unfinished`; P3, P4 | 12 | Core | HIGH |
| D-2 override 4 (`trainRejoin`), `--roadmap-ticks`; P3b | 3 | Core | MEDIUM |
| D-3, D-5 `train-loop.mjs` (`next`, `depart`, `wait`, lock), the verb, the skill; P9, P12, P13 | 12 | Core | HIGH |
| D-7 suite runner and bisection; P8 | 5 | Core | MEDIUM |
| D-10 CI train mode, `ciTrainParts` on every run, `TRAIN_PIN_FILE`; P11 | 8 | Core | MEDIUM |
| D-9, D-11 delivered by a train, `close-boarded-pr`, `isOwnPr`, tasks item, `pr-verifier` | 5 | Integration | MEDIUM |
| D-12 ADR acceptance and notes, documents, skills, release; P10 | 4 | Documentation | LOW |
| D-13 the real run, four cases (test and `proof/real-run.md`) | 5 | Testing | MEDIUM |
| Whole suite, evidence | 2 | Testing | LOW |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A flaky test makes a red train and the bisection names a change that did nothing wrong | MEDIUM × MEDIUM | The record keeps every run (head, result) and the culprit's output; the culprit's own cycle runs its tests again before it boards; ADR 0022's review trigger names a wrong culprit |
| Two departures race on two machines | LOW × MEDIUM | The lock covers one clone; on two clones the second `git push origin train/<n>` of the same `n` is refused by the remote (no force push), and its `next` reads the first train as under way |
| GitHub does not mark a boarded PR merged | MEDIUM × LOW | Delivered by the train record either way, and the PR is closed with a comment (D-9) |
| `deliver-check.mjs` grows further (2,264 lines at `19c0196`) | HIGH × LOW | The train code sits in one section with its own header; the CI constraint forbids a new module |
| GitHub reads per `deliver-check` call grow in a train project (five records) | MEDIUM × LOW | Only when the train is on and only once items 1-4 are met; the five newest train PRs only |
| A suite that needs more than the train's worktree (a network, a service) behaves differently there | LOW × MEDIUM | The suite runs with the session's environment in a full checkout; the record names the command, so a project sees what ran |
| A change that edits the train key is judged with different train parts locally and in CI | LOW × LOW | D-10: such a change proves every part in `evidence.md`, which both readers accept; `pr-verifier` runs every part for it |
| Two archives that edit one canonical spec keep one of them off the train | MEDIUM × LOW | A3 and override 4 stop it for the owner with the path after its train lands, never re-board it at the same head; the other archive leaves |
| Boarding time from the review commit's committer date is skewed by a wrong clock | LOW × LOW | Order only decides release numbers and the bisection's order; ties go to the PR number |
| Sibling merges conflict in `change-loop.mjs` and the skill | HIGH × LOW | Narrow edits listed in "Where the siblings meet"; merge `origin/main` before phase 1 and before the release |

## Assumptions

- GitHub marks a pull request merged when its head commit reaches its base branch through a push or a
  merge commit (GitHub documentation, "About pull request merges"); D-9 does not depend on it.
- `gh pr merge --auto --merge --match-head-commit` is accepted on a repository that allows merge commits
  and auto-merge (gh manual; `merge-setup.mjs#MERGE_METHODS` already maps `merge` to `allow_merge_commit`).
- `actions/checkout` with `fetch-depth: 0` fetches every branch, so every boarded head reachable from the
  train's head is in the CI clone (`docs/openspec-flow.md`, CI; the job already relies on it).
- `git merge-tree --write-tree` (git 2.38) is available, as `conduct-check.mjs` already needs.
- The suite of a project passes in a fresh worktree of the project (this repository's runs in worktrees
  every day, `CLAUDE.md`).

## Dependencies

- `release-merge-conflict` (code merged in #65 at `78b6cd7`; the folder is not archived): `release-merge.mjs`.
- `delivery-models` (archived): `devkit.delivery`, `trunk`, `trunk-auto` (ADR 0018).
- `change-state` (archived): the state derived in one place (ADR 0017), which the new ends follow.

## Migration Plan

Nothing changes in a project until it writes `devkit.delivery.train`. A project turning it on sets the
model to `trunk` or `trunk-auto`, allows merge commits (`github-setup.mjs --method merge`), installs the
release, and from then on its reviewed changes board instead of merging. Changes already auto-merging
when the key lands get auto-merge disabled at their next `next` (T1) and board. Rollback: remove the key
(boarded changes go back to `update-branch` and `enable-auto-merge` at their next run; an open train's
pull request can be merged by the owner or closed), or revert the release; no data migrates.

## Open Questions

- Which ending a boarded pull request gets on GitHub after a train merges (merged by GitHub, or left
  open and closed by the train): the code handles both (D-9), and the first train of this repository
  records which one GitHub gives in that change's retro. Neither answer changes the specs or the tasks.
