<!-- devkit-stage design result=passed attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Design

Change: `train-empty-failure-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec:
n/a (`proposal.md`, `requirements.md`, `decisions.md`, `release.md`, the spec delta
`specs/delivery-train/spec.md`). Base: `origin/main` at `6f03a57`. Line numbers below are at that
base.

## Context

See `proposal.md`, "Why", for the motivation. The facts the design rests on:

- `departTrain` (`plugins/openspec/hooks/train-loop.mjs:340-418`) has four ends: `nothing`
  (`:346`, before any number or build), `empty` (`:366-369`), `base-red` (`:383-387`) and `passed`
  (`:393-412`). Only `passed` builds a record (`:394-397`), writes it under the build's worktree
  (`:401-402`) and commits it on `train/<n>`.
- The `empty` end is reached when the latest build joined nothing (`list.length === 0`): every
  boarded change was taken off `red` by the bisection (`:390`, `failure: found.output`) or by a join
  `conflict` (`build`, `:328`, `failure: null`). The `left` array already holds each `failure`; the
  output drops it through `outLeft` (`:338`), which lists `kind, id, number, why, detail`. The
  record's own mapper `leftOf` (`:336`) keeps `head` and `failure`.
- At the `empty` end the latest build `b` is a worktree at `origin/<base>` with no join, so its head
  is `baseSha` (`:348`). `runs` holds every suite run the departure made (`:356`); a train emptied
  only by conflicts made none.
- `nextNumber` (`:210-217`) counts the records on `origin/<base>` and the branches `train/*`, local
  and on `origin`; `underWay` (`:219-225`) sees a local `train/<n>` that holds its record and has
  no pull request as a train under way. A commit of an empty train on `train/<n>` would therefore
  block the next departure; a file outside every tracked tree touches neither.
- `lockFile` (`:153-156`) already places a departure's lock under the git common dir with
  `git rev-parse --path-format=absolute --git-common-dir`, run in `ctx.root`, the main checkout
  (`context`, `:133-143`).
- `writeTrainRecord` (`:75-95`) writes the Boarded header rows even when `boarded` is empty, writes
  `## Left` and `## Runs` only when they have rows, and one `## Failure of` block per entry whose
  `failure` is not `null`, fenced one backtick longer than any run of backticks in it (`fenceFor`,
  `:70`).
- `parseTrainRecord` (`plugins/openspec/hooks/deliver-check.mjs:1132`) refuses an empty Boarded
  table (`:1165`). It reads records only from train pull requests (`:1207-1213`), so it never sees
  the new file, and it is not changed (requirements, "Out of scope").
- The replies live in `MESSAGES.en` and `MESSAGES['pt-BR']` of
  `plugins/openspec/hooks/change-loop.mjs` (the train keys at `:270-273` and `:574-577`).
  `train-running` already names a path through `{where}`.
- The skill's Train section (`plugins/openspec/skills/devkit/SKILL.md:166-178`) already says to say
  the `reply` of a `depart` that exits 1 or 2 and end the turn, so it needs no edit (requirements,
  Q8).

ADRs in scope: ADR 0022 (decision 1, the train is a branch `train/<n>`; decision 7, "change `k`
leaves the train with the failure attached"); ADR 0034 (the release note, `release.md`); ADR 0036
(decision 4, the gate's selective part). None is contradicted: the change carries out decision 7 at
the one end that did not, and no rejected alternative of ADR 0022 ("A red train drops every change
and starts over" and the others) is taken up. No ADR is needed (`decisions.md`).

## Goals / Non-Goals

**Goals:**

- The empty end's output and a file outside every checkout keep every left change's reason and
  failing output (AC-1, AC-2, AC-4).
- An empty train stays invisible to Git: no branch, worktree, commit, pull request or train number
  (AC-3).
- The owner's reply names where to read the failure (AC-5).

**Non-Goals:**

- Any change to the `nothing`, `base-red` or `passed` ends, to `depart --update`, to `next`, or to
  what `devkit-reviews` and `trainFacts` read.
- A history of empty trains: one file per number, the latest one wins.
- Cleaning up `devkit-trains/`: no step deletes the files (each number's file is replaced on reuse,
  and a number is reused until a train departs green).

## Decisions

### D-1 The left entries of the empty output

A new mapper beside `outLeft` (`train-loop.mjs:338`):

```js
const outLeftFailed = (l) => ({ ...outLeft(l), failure: l.failure ?? null });
```

The `empty` end maps `left` with it; the `passed` end keeps `outLeft`. Each entry reads
`{ kind, id, number, why, detail, failure }`: for `why: 'red'` the `failure` is `found.output`, the
last 80 lines of the smallest red prefix's run (`tailOf`, `:58`); for `why: 'conflict'` it is
`null`.

Alternatives rejected: adding `failure` to `outLeft` itself (it changes the `passed` output, which
the requirements put out of scope); mapping with `leftOf` (it also adds `head`, a field the
requirements do not ask for, so a reader of the output would start to depend on it).

### D-2 Where the record goes

```js
const emptyRecordFile = (root, env, n) => join(gitOut(root, env, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'devkit-trains', `${n}.md`);
```

Called with `ctx.root` and `ctx.env`, as `lockFile` is. The folder is made with
`mkdirSync(dirname(file), { recursive: true })`; the file is written with `writeFileSync`, which
replaces an earlier file at that path (requirements, Q3). It is never staged or committed.

Alternatives rejected:

- Commit the record on `train/<n>` and stop there: `underWay` (`:219-225`) would see a local train
  under way and refuse every later departure, and `nextNumber` would count it (requirements, Q2).
- Write `openspec/trains/<n>.md` untracked in the main checkout: it changes the root's
  `git status` (AC-3) and sits in a tracked folder, where a later `git add` could commit it.
- Write it beside the lock under `<git common dir>/devkit/`: the requirements name
  `<git common dir>/devkit-trains/<n>.md` literally.
- Write it in the departure's scratch folder: the `finally` block removes that folder
  (`:413-417`).

### D-3 What the record holds

```js
writeTrainRecord({ n, base, result: 'empty', baseSha, suite: ctx.suite, ranAt: baseSha, boarded: [], left: left.map(leftOf), runs })
```

- Header line `<!-- devkit-train n=<n> base=<base> result=empty -->`, `- Result: empty`.
- `ranAt` is `baseSha`: the latest build of an empty train joined nothing, so its head is the base
  commit, and one rule serves a red train and a conflict-only one (which ran no suite).
- `## Boarded` has its header and separator rows and no data row.
- `## Left` lists every left change with its kind, id, pull request, head, `why` and `detail`.
- `## Runs` lists every run when there was one; a train emptied only by conflicts has no `## Runs`
  section, as `writeTrainRecord` already does for an empty list.
- One ``## Failure of `<id>` `` block per `red` entry, none for a `conflict` entry.

No parser reads the file (Context), so no unterminated-input rule is added; the fence rule of
`fenceFor` keeps a failure text holding backticks closed.

### D-4 The order of the empty end

At `train-loop.mjs:366-369`, inside the `try`, in this order: `drop(b)`; compute the file
(D-2); make its folder and write it (D-3); return

```js
result(1, { n, result: 'empty', record: file, boarded: [], left: left.map(outLeftFailed), runs: runs.length, reply: ctx.say('train-empty', { where: file }) })
```

The exit code stays 1. The `finally` block still prunes the worktrees and removes the scratch
folder. A write that fails (a full disk) throws from `writeFileSync` as the `passed` end's write at
`:402` does today, and `main` turns it into exit 3 (`failure`, `:624-628`); no new error path is
added.

The header comment of the file (`:10-11`, "writes the record and commits it") gains a clause: an
empty train writes its record uncommitted under the git common dir.

### D-5 The reply

A key `train-empty`, after `train-nothing`, in both tables of `change-loop.mjs`, with one parameter
`{where}` (the record's absolute path), as `train-running` names its lock:

```text
en:    The train emptied: every boarded change left it, so nothing was boarded and no train branch was created. Why each change left, with the failing output, is in {where}.
pt-BR: O trem esvaziou: toda change embarcada saiu dele, então nada foi embarcado e nenhum branch de trem foi criado. Por que cada change saiu, com a saída da falha, está em {where}.
```

The texts meet the rules of `change-loop replies: no internal term in either language`
(`plugins/openspec/hooks/change-loop.test.mjs:114-154`): no backtick, no file name in the sample
rendering (`SAMPLE.where` is `the next step`, `:76`, so the key needs no `NAMES_ITS_FILE` entry),
no hyphenated id, no option, and the two languages differ. `train-nothing` is unchanged and stays
the reply of `result: nothing` (`:346`) and of `next` with nothing boarded (`:581`).

### D-6 The tests

New or changed tests, each with its invariant, layer and suite (CLAUDE.md, "Before changing a
test"):

- **T-1, changed**: `delivery-train P8: a train that empties leaves every change with its failure
  and creates nothing` (`plugins/openspec/hooks/delivery-train.test.mjs:1708-1717`). Invariant: an
  empty train creates no train branch or worktree, and now keeps its failures; layer: the
  `train-loop.mjs` departure; suite: `delivery-train.test.mjs`. Its name becomes `delivery-train
  P8: a train that empties leaves every change with its failure, writes its record outside the
  checkout and creates no train branch`. Same fixture (`alpha`, `beta`, the suite
  `if test -e src/alpha.txt || test -e src/beta.txt; then echo not-green; exit 1; fi`). Before the
  departure it captures `git status --porcelain` of `p.t.main` and
  `git for-each-ref --format=%(refname) %(objectname) refs/heads`. It keeps its assertions on
  `[code, result]`, the `[id, why]` pairs, `refs/heads/train` and `noScratch(p)`, and adds:
  - each `left` entry's `failure` matches `/not-green/` (AC-1);
  - `r.out.record` is absolute and equals `join(<git rev-parse --path-format=absolute
    --git-common-dir in p.t.main>, 'devkit-trains', '1.md')`, and the file exists (AC-2);
  - the file's first line is `<!-- devkit-train n=1 base=main result=empty -->`; its `## Boarded`
    section has no row after the separator; its `## Left` section has a row for `alpha` and one
    for `beta`, each with `red`; it holds ``## Failure of `alpha` `` and ``## Failure of `beta` ``,
    each followed by a block matching `/not-green/`; it holds a `## Runs` section (AC-2). The test
    reads the text, not `parseTrainRecord`, which refuses an empty Boarded table;
  - `r.out.reply` equals `render('en', 'train-empty', { where: r.out.record })`, replacing the
    `train-nothing` assertion (AC-5);
  - `.claude/worktrees/train-1` does not exist, and the status and the refs captured before are
    unchanged (AC-3);
  - a second departure, after the test writes the line `stale` into the record file:
    `departIn(p, { lang: 'pt-BR' })` returns `n: 1`, the same `record` path, a file whose text no
    longer holds `stale` and whose header is again `result=empty`, and the reply
    `render('pt-BR', 'train-empty', { where: r.out.record })` (AC-3, AC-5); `noScratch(p)` again.
- **T-2, new**: `train-empty-failure-text AC-4: a train emptied only by a conflict writes its
  record, and its left entry carries no failure` (`delivery-train.test.mjs`, after T-1).
  Invariant: every empty train gets the record; layer and suite as T-1. `project({ train: 'true',
  files: CONFLICT_BASE })`; `addChange(p, 'alpha', { files: { 'plugins/x/hooks/a.mjs': 'line
  1\nalpha line 2\nline 3\n' } })`; then the base moves in a scratch worktree, as `onMain` of
  `delivery-train-after.test.mjs:342-348` does: `worktree add --detach` at `origin/main`, write
  `plugins/x/hooks/a.mjs` as `line 1\nmain line 2\nline 3\n`, `commitAll`, `push -q origin
  HEAD:main`, `worktree remove --force`. `CONFLICT_BASE` is declared at `:1720`, after T-1, so T-2
  sits after that line. The departure: `[code, result]` is `[1, 'empty']`; `left` is
  one entry with `kind: 'change'`, `id: 'alpha'`, its pull request number,
  `why: 'conflict'`, a `detail` that is the path `plugins/x/hooks/a.mjs` in backticks (as the AC-8
  test at `:1730` reads it) and `failure: null`; the record file exists with header `result=empty`, a `## Left` row for
  `alpha` with `conflict`, no `## Failure of` and no `## Runs` section; the reply is `train-empty`
  with that path; `refs/heads/train` is empty; `noScratch(p)`.
- **T-3, changed**: `delivery-train loop: the new train replies exist in both languages, each with
  its own text` (`plugins/openspec/hooks/delivery-train-after.test.mjs:177-182`). Invariant: every
  train reply exists and is translated; layer: the message table; suite:
  `delivery-train-after.test.mjs`. `'train-empty'` joins its key list after `'train-nothing'`
  (AC-5).
- **T-4, changed**: `delivery-train docs: the documents follow`
  (`delivery-train-after.test.mjs:190-202`). Invariant: the documents name the train's parts;
  layer: documents; suite: `delivery-train-after.test.mjs`. Its subsection list gains
  an entry named `the empty train's record` whose regex matches the text
  `<git common dir>/devkit-trains/<n>.md` written in backticks (AC-6).

#### Pinned rules: the tests that read what this change edits

The search covered `plugins/` and `scripts/` for `train-nothing`, `'empty'`, `empties`, `outLeft`,
`r.out.left`, `Object.keys(` on a departure's output, `.record`, `devkit-trains`, `MESSAGES` (every
test that iterates the table's keys) and the doc sentences of D-7.

| Test (file:line) | Invariant | Layer | Suite | This change |
|---|---|---|---|---|
| P8 "a train that empties" (`delivery-train.test.mjs:1708`) | an empty train creates no train branch | departure | delivery-train | T-1 |
| AC-4 "nothing boarded creates nothing" (`delivery-train.test.mjs:1750`) | `result: nothing` replies `train-nothing` | departure | delivery-train | unchanged, stays green (AC-5) |
| P9 N14 "with nothing boarded" (`delivery-train.test.mjs:2146`), P9 N13 (`:2109`), the real-run cases (`delivery-train-after.test.mjs:94`, `:127`, `:923`) | `next` with nothing boarded ends `train-nothing` | next | delivery-train, delivery-train-after | unchanged |
| P8 red-train tests (`delivery-train.test.mjs:1670`, `:1690`), AC-8 conflict (`:1730`) | the `passed` output's `left` pairs | departure | delivery-train | unchanged: `outLeft` stays for `passed` |
| "the new train replies exist" (`delivery-train-after.test.mjs:177`) | every train key in both languages | message table | delivery-train-after | T-3 |
| "the documents follow" (`delivery-train-after.test.mjs:190`) | the docs name the train's parts | documents | delivery-train-after | T-4 |
| "no internal term in either language" (`change-loop.test.mjs:114`) | every key renders clean and is translated | message table | change-loop | unchanged; D-5's texts meet it |
| the same-keys checks (`change-loop.test.mjs:121`, `project-loop.test.mjs:1621`) | both tables hold the same keys | message table | change-loop, project-loop | unchanged; the key is added to both |
| prefix filters (`roadmap-loop.test.mjs:523`, `:546`), sub-tables (`status-line.test.mjs:748`, `stage-models.test.mjs:1272`) | their own key families | message table | their own | unchanged; `train-empty` is in none of their families |

No test pins the field list of a departure's output, and no test reads `<git common dir>/devkit-trains/`.

### D-7 The documents

- `docs/openspec-flow.md:749`, the paragraph **A red train.**, gains after its first sentence:
  "A train that ends empty, every boarded change left, creates no branch, worktree or commit and
  takes no train number: its record, with `result=empty`, is written uncommitted at
  `<git common dir>/devkit-trains/<n>.md`, replaced by the next empty train of that number, and the
  departure names it in its `record` field and in its reply." The **The record.** paragraph
  (`:743`) is not edited.
- The spec delta `specs/delivery-train/spec.md` adds the requirement "A train that empties keeps its
  record outside every checkout" with three scenarios; the canonical spec is synced by the archive.

### D-8 The proof

The tests are the proof of every criterion: T-1 (AC-1, AC-2, AC-3, AC-5), T-2 (AC-2, AC-4), T-3
(AC-5), T-4 (AC-6), and `openspec validate train-empty-failure-text --strict` (AC-6's spec part).
The change alters no agent's text, so no session run is declared. `evidence.md` (written by the
pr-verifier) holds the gate's `--own-files` row with its `selected` lines and its `suite:` line.

## Risks / Trade-offs

- [A write error at the empty end loses the output, as before this change] → the folder is under
  the git common dir that the departure has just written worktrees into, so a failure there means
  Git itself fails; accepted, and exit 3 names the error.
- [Files accumulate under `devkit-trains/`] → one file per number, replaced while the number is
  reused; a number moves on only when a train departs green. Accepted (requirements, "Out of
  scope").
- [A departure run from a linked worktree writes into another folder] → `ctx.root` is the main
  checkout and every worktree shares one common dir, so the path is the same from any checkout.
- [The reply names an absolute path that holds `.md`] → the sampled reply test renders `{where}`
  with `the next step`; `train-running` already names its lock path the same way.

## Migration Plan

One commit holds the code, the message keys, the tests and the docs. Nothing is deployed beyond the
devkit-openspec patch of `release.md`. Rollback: revert that commit; files left under
`<git common dir>/devkit-trains/` are read by nothing and can be deleted by hand.

## Implementation plan

Order: tests (red) → the replies → the departure → the documents → the checks.

**Per surface.** devkit-openspec hooks: `train-loop.mjs` (D-1 to D-4), `change-loop.mjs` (D-5).
Tests: `delivery-train.test.mjs`, `delivery-train-after.test.mjs` (D-6). Docs:
`docs/openspec-flow.md` (D-7). No frontend, worker or CI surface.

**File structure.** Modify `plugins/openspec/hooks/train-loop.mjs`,
`plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/delivery-train.test.mjs`,
`plugins/openspec/hooks/delivery-train-after.test.mjs` and `docs/openspec-flow.md`. Create nothing
outside the change folder and delete nothing. `scripts/test-map.json` is not edited: no script or
test is added or moved, and `train-loop.mjs` already selects both test files.

**Estimate.** Optimistic 2 h, likely 3.5 h, pessimistic 6 h (the gate selects 31 test files, 23
slow, about 10 minutes per run).

| Component | Hours | Type | Risk |
|---|---|---|---|
| T-1 to T-4, seen red (1.1) | 1 | Testing | LOW |
| The `train-empty` key in both tables (1.2) | 0.25 | Core | LOW |
| The empty end: mapper, file, record, output (1.3) | 0.75 | Core | LOW |
| The flow sentence and the header comment (1.4) | 0.25 | Documentation | LOW |
| Gate and validation runs (1.5, 1.6) | 1.25 | Testing | MEDIUM |

**Risks** (probability × impact, mitigation):

- the conflict fixture of T-2 does not conflict (the departure fetches after the base moved, so it
  should) (LOW × LOW): T-2 is seen red first with `result` not `empty`, which shows the fixture
  before the code changes;
- a slow test of the gate flakes under load (MEDIUM × LOW): run the gate as a background command
  with no other suite on the machine and re-run a failed file alone (CONTRIBUTING.md);
- a sibling change edits `departTrain` or the train keys before this one lands (LOW × MEDIUM): the
  last base merge before review re-applies D-4 and D-5 and re-runs the gate.

**Assumptions** (where the plan breaks if reality differs):

- `departIn` passes `lang` through to `depart` (`delivery-train-fixtures.mjs:158`, `...opts`);
- the departure fetches `origin` before it builds (`boardedSet`, `train-loop.mjs:264`), so T-2's
  base move is seen;
- `writeTrainRecord` keeps the shape of `:75-95`.

**Dependencies.** The delivery train (`openspec/changes/archive/2026-11-24-delivery-train`, ADR
0022) and the own-files gate (ADR 0036). No open change is a dependency.

## Open Questions

None.
