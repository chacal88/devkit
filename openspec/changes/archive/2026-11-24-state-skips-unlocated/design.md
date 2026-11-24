<!-- devkit-stage design result=passed attempt=1 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Design

Change: `state-skips-unlocated` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the spec deltas `specs/change-state/spec.md` and
`specs/roadmap-coordination/spec.md`, `decisions.md`).

## Context

See `proposal.md` (Why). The path that fails today, in `plugins/openspec/hooks/`:

- `change-loop.mjs` `locate(start, id)` (line 1247) returns the worktree on `chore/archive-<id>`,
  else the worktree on branch `<id>`, else `mainRoot(start)` with its branch. It never looks at the
  caller's own checkout.
- `knownChange(start, id)` (line 1602) tries `locate`'s checkout, then every checkout of
  `checkoutsOf(start)` (line 1508), and returns the first that holds the change's folder, active or
  archived (`locateChange`, `deliver-check.mjs` line 314).
- `stateEntries` (line 1644) calls `nextAction(start, cid)` whenever `knownChange` finds the folder.
  `nextAction` (line 1275) reads the change at `locate`'s root, and `collectFlow` throws
  `no change named <id>, active or archived` (`flow-check.mjs` line 240) when that root does not
  hold it. Nothing catches it: `failure()` (line 2537) exits 3 and no other change is printed.
- `roadmap-loop.mjs` `collectRoadmap` (line 680) calls `nextAction(start, line.id)` per open line at
  line 728, with no catch. `collectRoadmap` feeds `/devkit status` (`statusCmd`),
  `roadmap-loop.mjs next` (`nextCmd`) and the roadmap run's stop lock (`roadmapStopDecision`,
  which turns any throw into `allow('error')`). `status --json` (`statusJson`) already catches
  around its own `nextAction` call. A line `collectRoadmap` classes `archived` (`classifyLines`,
  from `archivedOnDefault`) or declared in the run file is skipped before any action is read.

Line numbers in this design are those of the base commit and shift with the edits; the function
names are the anchors.
- The change run's stop lock (`stopDecision`, `change-loop.mjs` line 2273) calls
  `nextAction(input.cwd, change)` and turns a throw into `allow('error')`, so from a worktree on
  another branch it lets every stop through today.

ADR 0017 decision 1: the state is derived in one place, the board and the state command read it;
blocked is one of ADR 0010's four ends, with a reason. The `blocked-why.*` codes are an open message
table (`MESSAGES`, `change-loop.mjs` lines 297-320 in English and the matching block in Brazilian
Portuguese). No ADR or spec pins `locate`'s order (`decisions.md`).

## Goals / Non-Goals

**Goals:**

- One helper decides "this known change cannot be placed" and builds its blocked stand-in action;
  the state command and `collectRoadmap` both call it, so the board and the command agree by
  construction (ADR 0017 decision 1; ADR 0017's rejected alternative "Each surface keeps its own
  reading" stays rejected).
- `locate` reads a change in the caller's worktree when that worktree is the only place its active
  folder is, without changing any result for a caller in the main checkout or in the change's own
  worktree.

**Non-Goals:**

- `nextAction` keeps throwing for an unplaced change called from a checkout that cannot place it
  (`next`, `wait`, `session-next` keep their exit 3); only the state command and the roadmap facts
  stop dying on it.
- `status --json` (`statusJson`) keeps its own catch and output; it is not routed through the
  helper.
- `roadmap-loop.mjs draft` (`draftCmd`) also calls `nextAction` per unfinished change; it keeps its
  exit 3 on an unplaced one and is not routed through the helper.
- No new message, no new reason code, no new ADR, no parser change (no parser is moved or written).

## Decisions

### D-1 The reason is the existing `wrong-branch` (AC-1, AC-2, AC-3)

The blocked stand-in carries `end: { state: 'blocked', why: 'wrong-branch' }`. Its English text,
"its folder is on a branch with another name", and its Brazilian Portuguese text are already in
`MESSAGES` and already rendered in both languages by `change-loop.test.mjs` (`renderings`, lines
100-117) and `roadmap-loop.test.mjs` ("roadmap-loop replies: a blocked line renders every blocked
reason in both languages", line 563). The code means the same thing it means for the delivery
checker's `stop-branch` (`BLOCKED_STEP`, line 941): the change's folder sits on a branch not named
after it, and the remedy is the same (switch to, or create, the branch `<id>`). The `root` and
`branch` fields of the entry name the checkout that holds the folder, so the owner sees where.

Alternatives considered:

| Option | Pros | Cons |
|---|---|---|
| Reuse `wrong-branch` (chosen) | No message, no test token, same remedy as `stop-branch` | The phrase does not name the branch (the entry's `branch` does) |
| New `blocked-why.unplaced` with `{branch}` | The phrase names the branch | Two codes for one fact; new texts in two languages; `BLOCKED_PARAMS` tokens in two suites change |
| Reuse `unreadable` | Existing | Needs an `{error}` text; `exitCodeOf` maps it to exit 3 ("cannot be read"), which is the wrong story: the change is readable where it is |

### D-2 The shared helper: `unplacedAction(start, id)` (AC-1, AC-2, AC-3)

Search done before naming it: `grep -n "knownChange\|locate(" plugins/openspec/hooks/*.mjs` shows
no function that says a known change is not where `locate` reads it; `knownChange` answers "is it
anywhere" and `locate` answers "where would the loop read it". The helper composes the two and is
the one place this fact is decided. New export in `plugins/openspec/hooks/change-loop.mjs`, in the
"checkouts and unfinished work" section right after `knownChange`:

```
// The blocked stand-in of change `id` when some checkout holds its folder but the checkout `locate` reads it in does not
// (state-skips-unlocated D-2); null when the loop can place it, or when no checkout holds it.
export function unplacedAction(start, id) {
  const found = locate(start, id);
  if (found.branch === `chore/archive-${id}` || locateChange(found.root, id)) return null;
  const holder = knownChange(start, id);
  if (!holder) return null;
  return { kind: 'end', change: id, script: null, root: holder.root, branch: holder.branch, stage: null, stageTitle: null,
    end: { state: 'blocked', why: 'wrong-branch' }, params: { id } };
}
```

The stand-in has the shape of the existing archived stand-in in `stateEntries` (line 1661), so
`changeState` gives `state: 'blocked'`, `reason: { code: 'wrong-branch', text }` through
`endOfAction` and `blockedReason`, `stage`/`stageTitle`/`phase`/`stageIcon` null, `stateIcon` ⛔
and `title` `⛔ <id>`. `isPlanStage` is false for it (its kind is `end`). The run file's facts weigh
first as for any change (ADR 0017 decision 2): `changeState` applies them unchanged.

Guards, each with its own test (D-7): (a) `locate`'s root holds the folder, active or archived ->
null; (b) `locate`'s branch is `chore/archive-<id>` -> null (the archive worktree is the change's
place even before its folder is moved); (c) no checkout holds the folder (`knownChange` null) ->
null, the callers keep their own paths (archived on the default branch, named by the run file, or
exit 3); (d) otherwise the stand-in with the holder's real root and branch.

One case of (d) gives a phrase that reads oddly but is accepted: a worktree on branch `<id>` exists
but lacks the folder while another checkout (on a branch with another name) holds it. `locate` picks
the worktree on `<id>` (its step 2), which does not hold the folder, so the helper gives the stand-in
with `wrong-branch` and the holder's root and branch. Before this change the state command exited 3
on it. Accepted (R-3): the phrase stays literally true (the folder sits on a branch not named
`<id>`), the entry's `root` and `branch` name where it is, the remedy (move the folder to the
branch `<id>`) is the same, the case is rare, and every other change is still listed.

### D-3 The state command (AC-1, AC-2, AC-4, AC-6)

`stateEntries` asks the helper first, and for an id the helper stands in for, the archived-on-default
check comes before the stand-in is used:

```
let days = null; // archivedDates(start, ...), read at most once per command, only when an id is unplaced
const archivedStandIn = (cid) => ({ kind: 'end', change: cid, script: null, root: null, branch: null, stage: null, stageTitle: null, end: { state: 'archived', why: 'archived' }, params: { id: cid } });
...
const unplaced = unplacedAction(start, cid);
if (unplaced && (days ??= archivedDates(start, { env, gh })).has(cid) && !createdAfter(unplaced.root, cid, days.get(cid))) action = archivedStandIn(cid);
else if (unplaced) action = unplaced;
else if (knownChange(start, cid)) action = nextAction(start, cid, { env, lang: l, openspec, gh }); // unchanged
else if ((archived ??= archivedOnDefault(start, { env, gh })).has(cid)) action = archivedStandIn(cid); // unchanged behaviour: the existing object, hoisted
else if (named.has(cid)) ... // unchanged
else throw new LoopUsageError(`no change named ${cid}`); // unchanged: AC-4
```

The order, in words: (1) the helper; (2) if it stands in for the id and the id is archived on the
default branch (`archivedDates`, the same sources `unfinished` reads) and the holder's active folder
records no creation day after the archive day (`createdAfter`, the same test `unfinished` uses to tell
a stale copy from a new change that reuses the id), the entry is the existing archived stand-in; (3)
else the blocked stand-in; (4) the existing branches, unchanged. So a change archived on `origin`
while the main checkout is behind and a stale active copy sits in a worktree on another branch (the
"field-fixes 1 archived: a main checkout whose default branch is behind ..." setup) reads `archived`,
not `blocked wrong-branch` (before this change, `state --change` exited 3 on it). The archived check
is limited to ids the helper stands in for: a change the loop can place keeps its `nextAction` result
exactly as today (AC-6), archived or not. `createdAfter` is module-private in the same file and is
called as it is; the archived stand-in object is hoisted unchanged so both branches give the same
entry.

`collectRoadmap` needs no copy of step (2): a line archived on the default branch is classed
`archived` by `classifyLines` before any action is read, so it never reaches the helper.

`runState` keeps exit 0. `--change x` goes through the same `ids.map`, so its one entry equals the
list's (AC-2). `knownChange` and `locate` may run twice per id; each is a `git worktree list` and a
few `existsSync` calls, accepted.

### D-4 The roadmap facts (AC-3)

`collectRoadmap` line 728 becomes
`const action = unplacedAction(start, line.id) ?? nextAction(start, line.id, { env, lang: l, after: progress, openspec, gh });`
and `roadmap-loop.mjs` imports `unplacedAction` from `./change-loop.mjs`. `entriesOf` already
turns a blocked end into a `blocked` entry with `why` and `params`; `stateRow` places it under "Blocked" with `changeState(...).reason.text`, the same call the state command
makes, so the row text equals the command's `reason.text` (AC-3).

The run file weighs first on the board as in the command (ADR 0017 decision 2): a line the run file
declares an end for is skipped before the helper (`run.declared[line.id]`), so `stateRow` gives the
declared end; a line with a stage in flight is read with `readFlying` on the board, gets the stand-in,
and `changeState` turns it into `running` with the in-flight stage, exactly as `stateEntries` does
with the same `runFactsOf` facts. Tests 1.18 and 2.8 pin both.

Because `collectRoadmap` is the one fact collector, two other callers see the line too; this is a
consequence of the fix, flagged for the owner at plan approval:

- `roadmap-loop.mjs next` no longer exits 3 on such a line: `decideRoadmap` says once
  `roadmap-blocked` or `roadmap-blocked-others` with the reason, and the other lines go on, as for
  any blocked change (spec `roadmap-coordination`, "A blocked change keeps its place").
- `roadmapStopDecision` no longer lets the stop through as `error`: it refuses for another line's
  ready stage, or lets the stop through as `nothing-ready`.

Rejected: a flag on `collectRoadmap` that applies the helper only for the board (`wheres ===
'board'`). The board and the run would then disagree on the same line, which ADR 0017 decision 1
rules out, and the run would still die on it.

### D-5 `locate`'s order (AC-5)

```
export function locate(start, id) {
  const worktrees = listWorktrees(start);
  const own = worktrees.find((w) => w.branch === `chore/archive-${id}`) ?? worktrees.find((w) => w.branch === id);
  if (own) return { root: realpathSync(own.path), branch: own.branch };
  const root = mainRoot(start);
  const here = realpathSync(start);
  if (here !== realpathSync(root) && locateChange(here, id)?.archived === false && !locateChange(root, id)) {
    return { root: here, branch: tryGit(here, ['symbolic-ref', '--short', '-q', 'HEAD']) };
  }
  return { root, branch: tryGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']) };
}
```

The comment above `locate` is updated to name the four steps. The new step applies only when (1)
the caller is not the main checkout, (2) the caller holds the change's active folder, and (3) the
main checkout holds no folder of it, active or archived. Conditions (2) and (3) keep today's result
in the cases the requirements did not ask to change: a caller worktree holding only an archived
copy, and a main checkout that already holds the change (its merged active folder, or its archived
one while an old worktree still carries a stale active copy, the `field-fixes 1` situation). A
caller in the main checkout returns exactly `{ root: mainRoot(start), branch }` as today (no
`realpath` of its own), and a caller in the worktree on branch `<id>` is found by the first step as
today. `locateChange` already refuses an id that is not a change id (`.`, `..`, `archive`, any
character outside `[\w.-]`).

Every `locate` caller follows: `nextAction`, `isPlanStage`, `knownChange`, `taskChangeOf`,
`acceptDecisions`, `placeChange`, `switchScript`, `moveFlow`, `subagentStopFor`, `handOffFor`
(`change-loop.mjs`) and `isPreviousScript`, `isRequirementsHelper`, `sessionFacts`,
`mergeBaseCmd`, `pushCmd` (`roadmap-loop.mjs`). Each
gets the new root only in the new case; the change run's stop lock (`stopDecision`) therefore reads
the change's real action from a worktree on another branch (AC-5, "the hooks work there").

Alternatives considered: prefer the caller's checkout over the worktree on `<id>` (rejected: AC-5
keeps the archive and `<id>` worktrees first, and a stale caller copy would win over the live one);
drop condition (3) (rejected: it changes the main checkout's result for a merged-but-not-archived
change and for an archived change with a stale copy, against AC-6).

### D-6 Documents and release (AC-7)

- `docs/openspec-flow.md`, the paragraph "**A change's state.**" (line 240), after the sentence
  ending "`archived` has none.", inserts, in the same paragraph (the test "change-state ADR 0017:
  the documents follow" reads the paragraph up to its first blank line and needs "ADR 0017" in it):
  "A change whose folder is only in a checkout the loop does not read it in (a worktree on a branch
  that is neither `<id>` nor `chore/archive-<id>`, seen from another checkout) is listed `blocked`
  with the reason `wrong-branch`, its `root` and `branch` those of the checkout that holds the
  folder and its stage fields null, and `/devkit status` shows it under Blocked with the same words;
  when that folder is the stale copy of a change archived on the default branch, the change is
  listed `archived`; an id that no checkout, archived folder or run file knows still exits 3. The loop reads a change
  in the worktree on `chore/archive-<id>`, else the worktree on branch `<id>`, else the checkout it
  is called from when that checkout holds the change's active folder and the main checkout holds no
  folder of it, else the main checkout."
- The test that pins these sentences (AC-7): test 3.1 of D-7, in `change-loop.test.mjs` right after
  "change-state ADR 0017: the documents follow". It reads `docs/openspec-flow.md` through the
  suite's `readRepo`, takes the paragraph that starts with "**A change's state.**" up to its first
  blank line, and asserts that it contains `wrong-branch`, `chore/archive-<id>` and "the checkout it
  is called from". None of the three is in the paragraph on the base, so the test fails without the
  new sentences.
- The canonical `openspec/specs/change-state/spec.md` and `openspec/specs/roadmap-coordination/spec.md`
  take the deltas at archive (never edited by hand in this change).
- Release, one task: devkit-openspec takes the next patch version after `origin/main`'s at the last
  merge before review, in `plugins/openspec/.claude-plugin/plugin.json` and its entry in
  `.claude-plugin/marketplace.json`; the marketplace `metadata.version` takes the next patch after
  `origin/main`'s; `CHANGELOG.md` gains `## <marketplace version> — the state command and the board
  list a change they cannot place` with one **devkit-openspec** bullet (what changed, the `locate`
  order, "The CI snippet now pins `v<devkit-openspec version>`, the release's tag."); the three CI
  pin lines of `docs/openspec-flow.md` (`## CI`: "pinned to the commit of v…", "<commit sha of v…>",
  and "(`v…` above)" with `git/ref/tags/v…`) move to the new devkit-openspec version. The tests that
  pin this: `release-merge.test.mjs` "release-merge pin: the real docs/openspec-flow.md: setPins
  changes exactly its CI pin lines" (the pins equal `plugins/openspec/.claude-plugin/plugin.json`'s
  version) and `scripts/check.py` `check_changelog` (a `## <marketplace version>` entry). The tag
  `v<version>` is pushed after the merge (CONTRIBUTING step 5, ADR 0019), outside the tasks.

### D-7 Tests

Every new test's name starts `unlocated <phase>: `. A test of a function this change adds reaches it
through the namespace import the suites already have (`changeLoopModule.unplacedAction`,
`loopModule`), so the red run fails test by test. Every `t.test` subtest is awaited (`await
t.test(...)`). Fixtures: `roundRepo` and `addWt(name, { branch })` (`conduct-check.test.mjs`),
`addChange` (change-loop suite), `put`, `commitAll`, `git`, and for 1.18 and 1.19 the change-loop
suite's `writeRunFile`, `stateCmd`, `archiveOnOrigin`, `archiveGh` and `withCreated` (the
"field-fixes 1 archived" helpers); in the roadmap suite `lkProject`, `projectWith`, `addOpen`,
`putRun`, `inFlight`, `changeMain`, `stopOf`, `doStatus`, `doNext`, `cmd`, `placedOn`, and
`git(root, 'worktree', 'add', '-q', '-b', 'side', side)` as in "roadmap-loop run file: its path is in
the git common directory". Test 3.1 uses the change-loop suite's `readRepo`.
The unplaced setup: change `x`'s active folder (`addChange(side, 'x', ['requirements',
'decisions'], { commit: false, flow: 2 })` or the roadmap suite's equivalent) in a worktree on branch
`side`, nothing of `x` in the main checkout. Every expected phrase comes from `render(lang,
'blocked-why.wrong-branch')`, never a literal.

New tests (layer: the unit that owns the invariant; suite: the file it lives in):

| # | Name (after the prefix) | Invariant | Layer | Suite | AC |
|---|---|---|---|---|---|
| 1.1 | `locate from a worktree on another branch that holds the active folder reads it there` | the caller's step returns `{ root: realpath(side), branch: 'side' }` | `locate` | change-loop.test.mjs | AC-5 |
| 1.2 | `locate: the archive worktree wins over the caller's` | with `chore/archive-x` also present, its worktree is returned | `locate` | change-loop.test.mjs | AC-5 |
| 1.3 | `locate: the worktree on branch x wins over the caller's` | with a worktree on `x` also present, it is returned | `locate` | change-loop.test.mjs | AC-5 |
| 1.4 | `locate from the main checkout is unchanged` | from `t.main`, with and without `x` in `side`, the result deep-equals `{ root: mainRoot(t.main), branch: 'main' }` | `locate` | change-loop.test.mjs | AC-5, AC-6 |
| 1.5 | `locate from the change's own worktree is unchanged` | from the worktree on `x`, that worktree | `locate` | change-loop.test.mjs | AC-5, AC-6 |
| 1.6 | `locate: a caller holding only an archived folder reads the main checkout` | negative of condition (2) | `locate` | change-loop.test.mjs | AC-5, AC-6 |
| 1.7 | `locate: a main checkout holding a folder of x keeps it` | negative of condition (3): two awaited subtests, main holding `x` active, main holding `x` archived | `locate` | change-loop.test.mjs | AC-5, AC-6 |
| 1.8 | `locate: a caller with no folder of x reads the main checkout` | negative of condition (2), no folder | `locate` | change-loop.test.mjs | AC-6 |
| 1.9 | `unplacedAction gives null for a change the loop can place` | guards (a) and (b): three awaited subtests (folder in main, worktree on `x`, worktree on `chore/archive-x` with no folder moved) | helper | change-loop.test.mjs | AC-6 |
| 1.10 | `unplacedAction gives null for an id no checkout holds` | guard (c) | helper | change-loop.test.mjs | AC-4 |
| 1.11 | `unplacedAction gives the blocked stand-in with the holder's root and branch` | guard (d): the exact object of D-2 | helper | change-loop.test.mjs | AC-1 |
| 1.12 | `state lists an unplaced change blocked and every other change as before` | from `t.main` with `a` open there: exit 0, `x` = blocked, `wrong-branch`, en text, stage fields null, `⛔ x`, root `side`, branch `side`; `a`'s entry deep-equals its entry in the same repository before `side` was added | state command | change-loop.test.mjs | AC-1, AC-6 |
| 1.13 | `state in Brazilian Portuguese gives the same code and the pt-BR phrase` | `--lang pt-BR` | state command | change-loop.test.mjs | AC-1 |
| 1.14 | `state --change x prints the list's entry` | exit 0, one entry deep-equal to 1.12's `x` | state command | change-loop.test.mjs | AC-2 |
| 1.15 | `state --change nope in the unplaced setup still exits 3` | exit 3, `request-unreadable` reply, `no change named nope` in `error`, no `changes` | state command | change-loop.test.mjs | AC-4 |
| 1.16 | `next --change x from the worktree on another branch gives x's action` | exit 0, the action's `root` is `side`, its stage `proposal` | `next` | change-loop.test.mjs | AC-5 |
| 1.17 | `the change run's stop lock in that worktree refuses for x's ready stage` | `stopDecision` with `cwd` `side` refuses `stage-ready` (helpers of "change-loop lock stop: T1" and following) | lock | change-loop.test.mjs | AC-5 |
| 1.18 | `state follows the run file first for an unplaced change` | two awaited subtests, from `t.main` in the unplaced setup: (i) `writeRunFile(t.main, { declared: { x: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } } })`: exit 0, `x` is `blocked` with the reason code `tests-red` and its `render('en', 'blocked-why.tests-red', ...)` text, not `wrong-branch`, root and branch `side`; (ii) `writeRunFile(t.main, { inflight: { x: { kind: 'agent', stage: 'design', agentType: 'change-planner', at: <iso> } } })`: exit 0, `x` is `running`, reason null, stage `design` | state command | change-loop.test.mjs | AC-1 (spec "The run file weighs first") |
| 1.19 | `state --change of a change archived on origin with a stale copy in a worktree on another branch reads archived` | two awaited subtests on the setup of "field-fixes 1 archived: a main checkout whose default branch is behind ..." (`addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false })`, `archiveOnOrigin(t, 'foo')`, `gh: archiveGh([])`): (i) `state --change foo` from `t.main`: exit 0, one entry `state: 'archived'`, `reason` null, `title` `📦 foo`, `root` and `branch` null; (ii) after `withCreated(<old-wt>, 'foo', '2026-11-21')` (a new change reusing the id): exit 0, `foo` is `blocked` with `wrong-branch`, branch `old-wt` | state command | change-loop.test.mjs | AC-6 (spec "A change archived on the default branch") |
| 2.1 | `the board lists an unplaced roadmap line under Blocked and the others as before` | from main: exit 0; `x` under Blocked with the en phrase; `a`'s block and words equal those on the same project without `side` | board | roadmap-loop.test.mjs | AC-3, AC-6 |
| 2.2 | `the board in Brazilian Portuguese` | pt-BR block heading and phrase | board | roadmap-loop.test.mjs | AC-3 |
| 2.3 | `the board and the state command agree on every open roadmap change, and on x's words` | block of each state = board block; `x`'s row text = state's `reason.text` | board + state | roadmap-loop.test.mjs | AC-3 |
| 2.4 | `a roadmap decision says once that x stopped and hands a's stage` | `next` exits 0; `roadmap-blocked-others` for `x` once; `a`'s agent action present; a second `next` repeats no line | roadmap decision | roadmap-loop.test.mjs | AC-3 |
| 2.5 | `the roadmap stop lock refuses for a's ready stage with x unplaced` | `roadmapStopDecision` refuses `stage-ready` naming `a` | lock | roadmap-loop.test.mjs | AC-3 |
| 2.6 | `the roadmap stop lock lets the stop through when x is the only open line` | `allow`, `nothing-ready` | lock | roadmap-loop.test.mjs | AC-3 |
| 2.7 | `a placed roadmap line reads as before` | with `x`'s folder in a worktree on branch `x` instead: the row is not under Blocked, and its block and words are those of `changeState(nextAction(root, 'x'))` | board | roadmap-loop.test.mjs | AC-6 |
| 2.8 | `the board follows the run file first for an unplaced line, as the state command does` | two awaited subtests, from main in the unplaced setup: (i) `putRun(root, { declared: { x: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } } })`: `x` under Blocked with the `tests-red` text; (ii) `putRun(root, { inflight: { x: inFlight('design') } })`: `x` under Running with the stage's words; in each, `x`'s block and words equal the block of its state and its `reason.text` (or stage) in `changeMain(['state', '--lang', 'en'], ...)` | board + state | roadmap-loop.test.mjs | AC-3 (spec "The run file weighs first") |
| 3.1 | `the state paragraph of docs/openspec-flow.md names the unplaced change and the locate order` | the paragraph "**A change's state.**" up to its first blank line contains `wrong-branch`, `chore/archive-<id>` and "the checkout it is called from" | docs | change-loop.test.mjs | AC-7 |

Existing tests that pin what this change touches, from `grep -n "no change named\|active or
archived\|wrong-branch\|stop-branch\|locate(\|knownChange(" plugins/openspec/hooks/*.test.mjs` and a
read of every `addWt(` and `worktree', 'add'` fixture in `change-loop`, `roadmap-loop`, `guard`,
`conduct-check`, `delivery-models`, `deliver-check`, `project-loop` and `version-pin` tests. None
pins the rules replaced (state's exit 3 for a known unplaced change, the board's exit 3, `locate`'s
fallback to the main checkout for a caller holding the only active folder): no test calls `locate`
or `knownChange` directly, and no fixture runs `state`, `status` or `next` with a change's only
folder in a worktree on another branch. Each test below must pass as it is (AC-6); none is edited:

| Test (suite) | Invariant it keeps | Why it is near |
|---|---|---|
| "change-state AC-1 command: an unknown change exits 3 with the plain reply" (change-loop.test.mjs:5783) | an unknown id exits 3 | D-3's last branch |
| "change-state AC-1 command: one change prints its state, ...", "... the output holds no run marker", "... nothing is written" (change-loop.test.mjs:5740, 5756, 5768) | a placed change's entry, no marker, no write | D-3 |
| "change-state AC-2 command: every open change and every change the run file lists, ..." (change-loop.test.mjs:5811) | `c` in its own worktree is read there | D-2 guard (a), D-5 step 2 |
| "change-state AC-2 command: a slice, a change archived ...", "... nothing in play prints an empty list" (5827, 5837) | the list's members | D-3 |
| "change-state AC-3 cli: next and state give the same state ..." (5855) | `next` and `state` agree | D-3 |
| "upfront AC-10 state: ..." (change-loop.test.mjs:6115-6180) | held reasons in the state | D-3 |
| "change-loop start: S6 a change that lives only in a worktree resumes there", "S8 ..." (change-loop.test.mjs:1056, 1078) | `/devkit change` resumes in the worktree | `knownChange`, D-5 |
| "change-loop open: O2 an id already in use creates nothing ..." (change-loop.test.mjs:1163) | a folder in another worktree takes the id | `knownChange` |
| "field-fixes 1 archived: ..." (change-loop.test.mjs:2663-2710) | stale worktree copies of archived changes | D-5 condition (3), D-3 step (2) |
| "change-loop lock stop: T1 ..." to "T7" (change-loop.test.mjs:1753 on) | the change run's stop lock | D-5 |
| the `blocked-why.` renderings (change-loop.test.mjs:100-117 and its test), `BLOCKED_STEP` rows (change-loop.test.mjs:510), "change-loop next: DEVKIT_BRANCH ... does not stop the loop with stop-branch" (860), the `wrong-branch` case (5391) | the `wrong-branch` text and code | D-1 |
| "roadmap-loop replies: a blocked line renders every blocked reason in both languages" (roadmap-loop.test.mjs:563) | every blocked code renders in both languages | D-1 |
| "change-state AC-6 board: ...", "... board parity: ...", "... status and state agree: ..." (roadmap-loop.test.mjs:4629, 4649, 4681) | the board places rows by the state | D-4 |
| "upfront AC-10 command: the state command, session-next and the board agree ..." (roadmap-loop.test.mjs:4759) | the three readers agree | D-4 |
| "roadmap-loop status: ..." (roadmap-loop.test.mjs:664-1078) and "roadmap-loop run file: its path is in the git common directory, shared by two worktrees" (902) | the board's text, status from a worktree on `side` | D-4, D-5 |
| "roadmap-loop lock stop ..." (roadmap-loop.test.mjs:1363 on) | the roadmap stop lock | D-4 |
| "conduct-check ... stop" rows (conduct-check.test.mjs:550), the `stop-branch` tests of deliver-check.test.mjs (1439, 1951, 4985) | the delivery checker's `stop-branch` | D-1 (code unchanged) |
| "change-state ADR 0017: the documents follow" (change-loop.test.mjs:5962) | the state paragraph cites ADR 0017 within its first blank line | D-6 |
| "release-merge pin: the real docs/openspec-flow.md: ..." (release-merge.test.mjs:426) | the CI pins equal devkit-openspec's version | D-6 release |

### D-8 The real-run proof

A scratch repository under `$TMPDIR` (`TMPDIR=/private/tmp/devkit-state-skips-unlocated`), never in
this worktree: `git init -q -b main`; `openspec/config.yaml` with `schema: devkit`;
`openspec/changes/.gitkeep`; `openspec/roadmap.md` with one round holding `- [ ] a` and `- [ ] x`;
`plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh <scratch>`; one commit. Then,
with this worktree's hooks (`node <worktree>/plugins/openspec/hooks/change-loop.mjs open <id>
--script devkit --why doubt --lang en`, the request on standard input), open `a` and `x`, and rename
`x`'s worktree branch (`git -C <scratch>/.claude/worktrees/x branch -m x side`): the failing setup,
a worktree on a branch not named after the change. From the main checkout run `change-loop.mjs state
--lang en`, `state --lang pt-BR`, `state --change x --lang en`, `state --change nope --lang en`,
`roadmap-loop.mjs status --lang en --load-limit 80` and `status --lang pt-BR --load-limit 80`; from
`x`'s worktree run `change-loop.mjs next --change x --lang en`. Run the same seven commands first
with the base's hooks (`git archive origin/main plugins/openspec` extracted under `$TMPDIR`) to show
the exit 3 before. Each command's line, exit code and output go to
`openspec/changes/state-skips-unlocated/proof/real-run.txt`, with the absolute path of this worktree
written as `<worktree>` and the scratch path as `<scratch>`.

## Implementation plan

**Order** (dependency): `locate`, the helper and the state command (phase 1) -> the roadmap facts
(phase 2) -> documents, release, real-run proof and the whole suite (phase 3). No data, endpoint,
frontend or worker surface.

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): `change-loop.mjs` (D-2, D-3, D-5), `roadmap-loop.mjs` (D-4).
- Docs and release: `docs/openspec-flow.md`, `CHANGELOG.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (D-6).

**File structure.**

- Create: `openspec/changes/state-skips-unlocated/proof/red-1.txt`, `proof/red-2.txt`,
  `proof/red-3.txt`, `proof/real-run.txt`.
- Modify: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
  `docs/openspec-flow.md`, `CHANGELOG.md`, `plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`.
- Delete: none.

**Estimate.** Optimistic 5.5 h · likely 9 h · pessimistic 14 h (the likely figure is the table's sum).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-5 `locate` order; tests 1.1 to 1.8 | 1.5 | Core | MEDIUM |
| D-2 helper, D-3 state command with its archived step; tests 1.9 to 1.19 | 2.5 | Core | MEDIUM |
| D-4 roadmap facts; tests 2.1 to 2.8 | 1.75 | Integration | MEDIUM |
| D-6 docs and release; test 3.1 | 0.75 | Documentation | LOW |
| D-8 real-run proof, both languages | 1 | Testing | LOW |
| Phase gates and the whole suite (background) | 1.5 | Testing | LOW |

## Risks / Trade-offs

| ID | Risk | Probability × impact | Mitigation |
|---|---|---|---|
| R-1 | A `locate` caller somewhere depends on the main-checkout fallback from a worktree on another branch | LOW × MEDIUM | The new step needs the caller's active folder and an empty main checkout; tests 1.4 to 1.8 pin every unchanged case; the whole suite (guard.test.mjs, which imports every hook suite) runs in phase 3 |
| R-2 | `roadmap-loop.mjs next` and the roadmap stop lock change behaviour on an unplaced line (D-4) | MEDIUM × LOW | Flagged in the plan's return for the owner's approval; the new behaviour is the existing blocked path (tests 2.4 to 2.6); the old one was an exit 3 or a stop let through as an error |
| R-3 | `wrong-branch`'s phrase does not name the branch; and a worktree on branch `<id>` that lacks the folder while another checkout holds it now gets `wrong-branch` (before: exit 3), a phrase written for a folder on a branch with another name | MEDIUM × LOW | The entry's `branch` and `root` name it; the remedy matches `stop-branch`; the second case is accepted (D-2): the phrase stays literally true, it is rare, and every other change stays listed; a new code is a later change if the owner asks |
| R-4 | Two `locate`/`knownChange` passes per id slow `state` on repositories with many worktrees; the Stop hook, which runs `collectRoadmap` at every turn's end of a roadmap run, also pays the helper's extra `locate` (one `git worktree list`) and `locateChange` per open line; `state` reads `archivedDates` once more when an id is unplaced | LOW × LOW | One `git worktree list` per pass; the board already reads every checkout; the extra `archivedDates` read is lazy (at most once per command, only for an unplaced id) |
| R-7 | The archived step (D-3 step 2) misreads a new change that reuses an archived id | LOW × MEDIUM | It uses `createdAfter`, the same test `unfinished` already uses for the same question; test 1.19 (ii) pins the reuse case |
| R-5 | `realpath` differences (`/tmp` and `/private/tmp`) make the main-checkout comparison miss | LOW × MEDIUM | Both sides go through `realpathSync`; the main-checkout return keeps `mainRoot(start)` untouched; gates run with `TMPDIR=/private/tmp` |
| R-6 | Sibling changes collide on `change-loop.mjs`, `roadmap-loop.mjs` or the release numbers | MEDIUM × LOW | Narrow edits; merge `origin/main` before phase 1 and before the release task; numbers re-read at the last merge before review (CONTRIBUTING step 5) |

## Assumptions

- `git worktree list --porcelain` names every linked worktree with its branch (`listWorktrees`,
  `deliver-check.mjs` line 198); a detached worktree has no branch and matches neither `<id>` nor the archive branch,
  so it can only be the caller's step or a holder.
- `findRoot(cwd)` returns the checkout root that holds `openspec/changes` (`guard.mjs` line 78), so
  `start` is the caller's checkout root for every `locate` call made through it.
- The state command's entry shape (`change`, `state`, `reason`, `stage`, `stageTitle`, `phase`,
  `stageIcon`, `stateIcon`, `title`, `script`, `root`, `branch`) is the one the side panels read
  (`docs/openspec-flow.md` line 240); a blocked entry with null stage fields is already possible
  (a run-file declared end).

## Dependencies

- ADR 0017 decisions 1 and 2 (one place derives the state; the run file weighs first), ADR 0010
  decision 3 (four ends). `decisions.md`: no new record.
- Specs `change-state` and `roadmap-coordination` (the deltas of this change).
- No entry of an open-decisions log (the repository keeps none).

## Migration Plan

Nothing to migrate: no stored state, no setting. Rollback: revert the two hook edits (the helper
call in `stateEntries` and `collectRoadmap`, the new step of `locate`) or the release; each is one
edit and the old behaviour returns.

## Open Questions

None.
