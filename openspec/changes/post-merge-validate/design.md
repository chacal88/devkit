<!-- devkit-stage design result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Design

Change: `post-merge-validate` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the spec delta `specs/change-coordination/spec.md`, and
`decisions.md`, which lists the adr-author's proposed Note on ADR 0017, accepted by the owner's
approval of this plan; see "ADR 0017: a proposed Note" below).

## Context

See `proposal.md` (Why). The code, read at `02208a3` (devkit-openspec 0.32.0, marketplace 0.36.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/change-loop.mjs` `nextAction` (line 1143) | Reads the flow (`collectFlow`, which itself runs `openspec status` and `openspec instructions apply`, so `next` already needs the CLI), and in the delivery part (`inDelivery`) builds `row` with `deliveryRow({ ref: 'origin/<base>', base }, ...)`, `baseBranch` from `defaultBase(found.root)` inside the `try`. Then calls the pure `decide(facts)` |
| `change-loop.mjs` `decide` / `buildPart` (line 1062) | Order: the stage checker's blocked end, the unit/E2E test stages, the row (`unknown-step`, `unreadable`), the place (D-9 of remote-worker, implementation rows only), then the row's hand-off, session step or end. `agent()` and `sessionAction()` pass through `guard` (K1 no-progress: `after === progressKey`; K2 not-delivered) and `hold` (budget). `progressKey` is `<stage>/<step>@<fingerprint>` |
| `change-loop.mjs` `ROWS` (line 832), `ROW_STEPS` | One row per step a checker returns; `change-loop.test.mjs:546` asserts that `ROW_STEPS` equals the steps the checkers can return, so a step of the loop's own (`take-place`, `accept-decisions`, `switch-script`) is not a row |
| `change-loop.mjs` `writeBackFile`, `readWriteBack`, `saveWriteBack` (line 1231) | A record in `<git common dir>/devkit/write-back/<id>.json`, written to a temporary file and renamed; a damaged one reads as `{ corrupt: true }` |
| `plugins/openspec/hooks/flow-check.mjs` `makeOpenspec` (line 41), `fingerprint` (line 165) | `makeOpenspec(cwd, env)` runs the project's pinned CLI or the `PATH` one, with a 60 s timeout, and answers `{ status, stdout, stderr, missing, timedOut }` or `{ refused }`. `fingerprint(root, head)` hashes the head, `git status`, the diff and the untracked files outside `.claude/` |
| `flow-check.mjs` `artifactState` (line 412) | A plan stage is stale by `staleAfter` (file times) only while no task is ticked (`started`) and not after the merge; the evidence and the review are `codeBound` (stale by their header's commit) |
| `plugins/openspec/hooks/deliver-check.mjs` `staleness` (line 289) | A commit since the recorded one that touches only `openspec/` keeps a verdict current; a merge counts what it brought in (its first-parent diff) |
| `deliver-check.mjs` `nextStep` (line 1510) | `verify` comes before `review`, `push`, `update-branch` and the GitHub waits; `stop-plan-approval` is skipped once `started`; `approvalState` (line 1496) hashes `readiness.md` only |
| `openspec validate <id> --strict --json` (CLI 2.0.0) | Valid: exit 0, `items[0].valid: true`. Invalid: exit 1, `items[0].valid: false`, `issues[]` of `{ level, path, message }`; a MODIFIED block that omits a scenario of the current spec gives `MODIFIED "<requirement>" omits scenario(s) the current spec still has: "<scenario>"` (probed in a scratch project on 2026-11-23). An unknown change: exit 1 with `{ status: [{ severity, code: "unknown_item", message }] }`, no `items` |
| `plugins/openspec/skills/devkit/SKILL.md` Loop, `session` item (line 91) | Says how the session runs each loop-own session step (`take-place`: run `detail.command`, then `next`, whatever its exit code) |
| `docs/openspec-flow.md` line 316 | The by-hand rule this change automates: "After every merge of the base, before the evidence, run `openspec validate <id> --strict`; copy any scenario main added ..." |

Constraints:

- `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` are the files a project's `devkit-reviews`
  job downloads; this change edits none of them, and nothing of it runs in CI.
- `next` stays read-only: only the step's command writes, and only its record in the git common
  directory (as `write-back` does).
- Tests never read the repository's git history; every merge is made in a temporary repository.
- No `flow.json` changes, so no flow version is raised (`change-stages` "A flow change raises its
  version" does not apply).

## Goals / Non-Goals

**Goals:** the loop runs the post-merge validation as its own step, ahead of the evidence and of the
pushes and waits of the delivery; a red result is the planner's, with no stage attempt spent; the
hand-offs are bounded; a check that cannot run stops the run.

**Non-Goals (design level):** changing `deliver-check`'s step order or rows; reading or writing any
stage header; a ship-change row (the step is the loop's own, like `take-place`); a panel label (the
panel shows a session step by its stage); cleaning old records (one small file per change id, rewritten
by the next merge); the support-branch rows of `two-prs`; a rebase of the task branch (for example the
dependency row D-2, `git -C <worktree> rebase --autostash origin/<base>`, `docs/openspec-flow.md`
"Dependency rows"), which leaves no merge commit on the branch, so D-1 does not see it and no check is
offered for it.

## Decisions

### D-1 Which merge is checked (AC-1, AC-5)

`baseMergeOf(root, ref)`, exported from `change-loop.mjs`, gives the sha of the newest merge commit
on the first-parent line of `HEAD` that is not reachable from `ref` (`origin/<base>`), or `null`:

1. `null` when `git rev-parse --verify --quiet <ref>^{commit}` fails.
2. `git rev-list --first-parent --merges -n 1 HEAD ^<ref>`; its one line, or `null` when empty.

Every merge on the branch's own line counts, whatever its second parent: a local
`git merge origin/<base>`, the merge `release-merge.mjs` commits, and GitHub's "update branch" merge
that `git pull --ff-only` brings in all have the branch as first parent. The task branch receives no
other merge (the `two-prs` lock refuses the test branch; support-branch merges happen on the support
branch). Not testing that the second parent is on `ref` keeps the rule right when the local
`origin/<base>` is older than the merged base (this change does not fetch; `fresh-base-check` will).
Once the change's pull request is merged into the fetched base, its merges are reachable from `ref`
and the answer is `null`.

### D-2 The record (AC-2, AC-6, AC-7)

`mergeCheckFile(root, id)` is `<git common dir>/devkit/merge-check/<id>.json` (the common dir as
`writeBackFile` reads it). The command writes it with `saveWriteBack` (reused unchanged: temporary
file, then rename). Shape:

```json
{ "version": 1, "change": "<id>", "merge": "<40-hex sha>", "result": "green|red|cannot-run",
  "reds": 0, "fingerprint": "<12 hex>", "errors": "<text or null>", "error": "<text or null>", "at": "<ISO time>" }
```

`readMergeCheck(file, id)` returns the object, or `null` when the file is missing, empty, truncated
or not JSON, when `version !== 1`, `change !== id`, `merge` is not 40 hex characters, `result` is not
one of the three, `reds` is not a whole number ≥ 0, or `fingerprint` is not a string. Unterminated or
damaged input is therefore "no record": the loop offers the check again, and a damaged file can never
read as green.

`reds` counts the red checks of that merge since its last green: on red it is the previous record's
`reds` plus one when the previous record is for the same merge, else 1; on green it is 0; on
cannot-run it keeps the previous record's `reds` for the same merge, else 0.

The record is a check's result, kept beside the run file and the write-back record. It is not the
change's state: the state is still derived on every read by `decide` (ADR 0017 decision 1); the
record is one more input of that decision by a proposed Note on ADR 0017, see "ADR 0017: a proposed
Note".

### D-3 The command `merge-check <id> --lang <l>` (AC-2, AC-3, AC-4, AC-7)

`main` dispatches `merge-check` to `runMergeCheck`, and the usage line and the header comment of
`change-loop.mjs` name it (`merge-check <id> --lang <l>`; the comment's list of commands that write
gains it: "only its record in the git common directory"). Steps:

1. Locate the change (`findRoot`, `locate`, `locateChange`): an unknown id or a missing `<id>` is a
   `LoopUsageError` (exit 3 through `failure`).
2. `base = defaultBase(root)`, `merge = baseMergeOf(root, 'origin/' + base)`. No merge: print
   `{ version: 1, change, base, merge: null, result: "none" }`, write nothing, exit 0.
3. `fp = fingerprint(root, <git rev-parse HEAD>)`, before the CLI runs.
4. `r = (openspec ?? makeOpenspec(root, cleanOf(env)))(['validate', id, '--strict', '--json'])`, where
   `openspec` is the runner `main` already accepts and passes on (the pattern of `nextAction`,
   `change-loop.mjs:1160`), so a test can hand it a timeout or a pin refusal without waiting 60 s.
5. Classify:
   - `r.refused` → cannot-run, `error = r.refused`; `r.missing` → cannot-run, `error = "the openspec CLI is not installed or not on PATH"` (the sentence `openspecJson` already uses); `r.timedOut` → cannot-run, `error = "openspec validate timed out"`.
   - `stdout` parses as JSON and has an `items` entry whose `id` is the change: `valid === true` and `status === 0` → green; `valid === false` → red, `errors` = one line per issue, `- <level> <path>: <message>`, joined by `\n` and cut to 4000 characters (with `…` at the cut).
   - Anything else (no JSON, no such item, `valid: true` with a non-zero exit) → cannot-run, `error` = the first `status[].message`, else the first non-empty line of stderr or stdout, else `exit <status>`.
6. Write the record (D-2), print `{ version: 1, change, base, merge, result, reds, errors, error }`,
   exit 0. The session runs `next` whatever the exit code (D-8), as for `take-place`.

The command changes no file in the worktree and no stage header.

### D-4 The decision (AC-1, AC-2, AC-3, AC-5, AC-6, AC-7)

New fact for `decide`: `facts.mergeCheck = { base, merge, record } | null` (D-5). New constant:

```js
const CHECK_BEFORE = ['verify', 'review', 'push', 'open-pr', 'open-prs', 'open-test-pr', 'push-support', 'move-test-pr',
  'edit-pr-body', 'enable-auto-merge', 'update-branch', 'rerun-checks', 'wait-checks', 'wait-merge', 'ready',
  'ready-test-branch', 'ready-base'];
```

These are the evidence and review steps and every delivery step that pushes or waits on the change's
pull requests. Left out on purpose: the implementation rows (a red check sends nothing to the
implementer), `commit` (the implementer's leftovers come first), `disable-auto-merge` (its safety
comes first), the support-branch session rows (`checkout-support`, `merge-into-support`,
`review-resolution`), every end that is `blocked` or `archived`, the plan ends, and every row while
`facts.archiving` (the archive branch; `openspec archive` validates there itself).

In `buildPart`, after the place block and before `const detail = detailOf(row.next)`:

```text
mc = facts.mergeCheck
if mc?.merge and step in CHECK_BEFORE and not facts.archiving and the flow has an `evidence` stage:
  rec  = mc.record when mc.record.merge === mc.merge, else null
  if rec?.result !== 'green':
    checkKey = key('evidence', 'merge-check')
    ceiling  = flow.ceilings?.default ?? 3
    if rec?.result === 'cannot-run' and facts.after === checkKey:
      return blocked('merge-check-failed', { error: rec.error }, 'evidence')
    if rec?.result === 'red' and rec.fingerprint === facts.fingerprint:
      if rec.reds >= ceiling: return blocked('merge-defect', { sha: first 7 of rec.merge, attempt: rec.reds }, 'evidence')
      return agent('specs', 'change-planner', 'merge-defect', <the brief below>, { base, merge, reds, ceiling, errors })
    return sessionAction('evidence', 'merge-check', { command: ['node', <HOOKS_DIR>/change-loop.mjs, 'merge-check', id, '--lang', lang], merge, base })
```

The cannot-run rule sits before `guard`, so the run right after the step ends with the cause, not
with K1's `no-progress`; called again without that `--after` (a new `/devkit change` after the owner
fixed the CLI), the step is offered again. A red record whose fingerprint differs (the planner changed
files) offers the check again; a red record whose fingerprint is the same hands the planner, and a
planner that changed nothing comes back with the same key and ends `no-progress` through `guard`
(unchanged). The planner's hand-off carries the stage `specs` (the role `change-planner` in both
flows; the subagent-stop lock lets it stop because the stage checker's current stage is not a plan
stage). Its brief (the `what` that `brief()` wraps; `<reds>` and `<ceiling>` are numbers, `<sha7>`
the first 7 characters):

```text
merge defect: the merge of origin/<base> at <sha7> left `openspec validate <id> --strict` failing (red check <reds> of <ceiling>). Its errors:
<errors>
Fix only what the errors name, in this change's plan files under openspec/changes/<id>/ (proposal.md, design.md, tasks.md, specs/): where the base changed a requirement that a delta modifies, copy the base's requirement text and every one of its scenarios into the delta verbatim, then apply the change's own edits to it again. Leave every stage header line and every task checkbox exactly as they are, change no file outside openspec/changes/<id>/, and finish when `openspec validate <id> --strict` passes
```

No stage header is read or written by any of this; the stage checker's `attempt=` and `ceiling` are
untouched (requirements, scope line). The ceiling of three reds is `ceilings.default`, read as a
number, not as a stage's ceiling.

### D-5 What `next` reads (AC-1, AC-5)

In `nextAction`, `baseBranch = defaultBase(found.root)` moves before the `try` (same value). After
`row` is built:

```text
mergeCheck = row && row.error === undefined && !archiving && flow?.stages.some(s => s.id === 'evidence')
  ? { base: baseBranch, merge: baseMergeOf(found.root, `origin/${baseBranch}`), record: readMergeCheck(mergeCheckFile(found.root, id), id) }
  : null
```

and `decide` receives it. Two git calls per `next` in the delivery part; nothing in the plan part.
`decide`'s comment listing `facts` gains `mergeCheck`. `devkit-project` slices run through
`project-loop.mjs`, which has its own `decideSlice` and no evidence stage: untouched.

### D-6 The replies (AC-6, AC-7)

Two keys in `MESSAGES`, both languages, no internal term (the `change-loop replies` test renders them):

| Key | en | pt-BR |
|---|---|---|
| `blocked-why.merge-defect` | `the merge of the base at {sha} left the plan failing its check {attempt} times in a row; fix the plan by hand, then resume` | `o merge da base em {sha} deixou o plano falhando na verificação {attempt} vezes seguidas; corrija o plano à mão e retome` |
| `blocked-why.merge-check-failed` | `the check of the plan after the merge of the base could not run ({error})` | `a verificação do plano após o merge da base não pôde rodar ({error})` |

`changeState` reads them through `blockedReason` like every blocked reason; `roadmap-loop.test.mjs`'s
`BLOCKED_PARAMS` already holds `sha`, `attempt` and `error`.

### D-7 The plan gate stays as it is (AC-9)

The planner's fix edits plan files after the implementation started. Today's rules, unchanged:
`flow-check.mjs` `artifactState` skips `staleAfter` once a task is ticked (`started`), so readiness
and approval keep their state; `deliver-check.mjs` `approvalState` hashes `readiness.md`, which the
fix does not touch, and `nextStep` skips `stop-plan-approval` once `started`; `specs` is not
`codeBound`, and a commit touching only `openspec/` keeps the evidence and the reviews current
(`staleness`). This change adds no code to any of these; the test T-14 pins that a merge-defect fix
and an ordinary design edit get the same answer.

### D-8 Skill and documents (AC-10)

- `plugins/openspec/skills/devkit/SKILL.md`, Loop, the `- \`session\`` item: after the `take-place`
  sentence, add: "A `merge-check` step runs `detail.command` the same way, then `next`, whatever its
  exit code: it checks the plan after a merge of the base, and a failed check goes to the planner as
  a merge defect." The sentences that `guard.test.mjs:1578` pins stay.
- `docs/openspec-flow.md`:
  - "**The loop.**" paragraph (line 230), after the sentence on `accept-decisions`: "After a merge of
    the base, from the implementation on, the loop has the session run `merge-check`, which runs
    `openspec validate <id> --strict` once per merge before the evidence and before any push or wait
    on the pull request; a failure goes to the planner as a merge defect, spends no stage attempt, and
    three in a row on the same merge end the run blocked; a check that cannot run ends it blocked too.
    The result is recorded in `<git common dir>/devkit/merge-check/<id>.json`."
  - Line 316: replace "After every merge of the base, before the evidence, run
    `openspec validate <id> --strict`; copy any scenario main added to a requirement the change
    modifies into the delta verbatim; and search" with "After every merge of the base the loop runs
    `openspec validate <id> --strict` before the evidence (the `merge-check` step of "The loop"
    above), and the planner copies any scenario main added to a requirement the change modifies into
    the delta verbatim; the session still searches". The rest of the paragraph is unchanged.
  - Troubleshooting: two rows, after the `blocked: item 5` row: "`/devkit change` ends blocked: the
    plan fails its check after the merge of the base N times in a row" (cause: a merge defect the
    planner could not fix; fix: fix the delta by hand against the base's spec, run
    `openspec validate <id> --strict`, then `/devkit change`), and "`/devkit change` ends blocked: the
    check of the plan after the merge of the base could not run" (cause: the CLI is missing, timed
    out or refused by the pin; fix: install or fix it, then `/devkit change`).
- `plugins/openspec/README.md`, the `hooks/change-loop.mjs` row: the command list gains
  `merge-check`, and "It writes nothing but ..." gains ", with `merge-check`, its record in the git
  common directory".
- `openspec/roadmap.md` line 74 becomes: "- [ ] post-merge-validate — after a merge from the base,
  the delivery loop runs `openspec validate <id> --strict` before the evidence and sends a failure to
  the planner as a merge defect (stage-roles retro, item 3); counting an evidence attempt that a base
  merge made stale or red moved to `evidence-attempts-by-failure`".

Grep made for the texts this change edits: no test asserts the line-316 sentence, the README row's
"writes nothing but" or the roadmap line; `guard.test.mjs:1578` asserts the `session` item's
`accept-decisions` parts and `change-loop.test.mjs:3166-3167` asserts `accept-decisions <id>` in the
usage, both kept.

### D-9 Tests

Every new test is in `plugins/openspec/hooks/change-loop.test.mjs`, named `post-merge-validate <phase>: ...`,
reaching new exports through `changeLoopModule` (the file's namespace import) so a red run fails test
by test. Fixtures: `gitRepo`/`put`/`commitAll` (deliver-check.test.mjs), `roundRepo` with `addWt`,
`commitOrigin` and `ghAt` (conduct-check.test.mjs), the file's `deliveredChange`, `build`/`rowOf`/`run`
for `decide`. The tests need the `openspec` CLI 2.x on `PATH`, as the suites already do.

| T | Phase | Test | AC |
|---|---|---|---|
| T-1 | 1 | `baseMergeOf`: no merge → null; `git merge --no-ff origin/main` on the branch → its sha; two merges → the newer; a plain commit after it → still the merge; a merge made in another clone, pushed and brought by `git pull --ff-only` → its sha; `origin/main` absent → null; the branch merged into `origin/main` → null | AC-1, AC-5 |
| T-2 | 1 | `readMergeCheck`: missing, empty, `{"version":1,` (truncated), not JSON, version 2, another change id, a short sha, an unknown result, `reds` -1 or 1.5, no fingerprint → null; a whole record → itself | AC-2 |
| T-3 | 1 | The command, green: a valid change after a merge → exit 0, `result: green`, `reds: 0`, the record holds the merge and the fingerprint; `git status --porcelain` and every stage header line are the same before and after | AC-2 |
| T-4 | 1 | The command, the stage-roles case: a canonical spec `openspec/specs/cap/spec.md` with one requirement and one scenario, the change's delta MODIFIES it keeping that scenario, and a proposal with `## Why` (one sentence of 50 characters or more) and `## What Changes`; the command on a first merge that changes nothing of the spec → `green` (the fixture validates); then `origin/main` adds a second scenario and the branch merges it; `git diff --name-only HEAD^1 HEAD` lists nothing under `openspec/changes/<id>/`; the command → `red`, `reds: 1`, `errors` names the requirement and the scenario; run again → `reds: 2`; after the delta carries both scenarios → `green`, `reds: 0` | AC-4, AC-6 |
| T-5 | 1 | The command, cannot run: called in process as `main(['merge-check', ...], { env })` with `env.PATH` an empty temporary folder (not the folder of `node`: fnm and a global npm install put `openspec` beside `node`, so that folder would find the CLI); the test needs no program from that `PATH`, since it runs in `process.execPath` and the command's git calls (`baseMergeOf`, `fingerprint`) take no `env` and use the process's own `PATH`, and only `makeOpenspec` receives `env` → `cannot-run`, `error` names the openspec CLI, never green; an `openspec` stub printing the `unknown_item` answer → `cannot-run` with its message; a stub printing no JSON → `cannot-run`; an injected runner answering `{ timedOut: true }` → `cannot-run`, `error` `openspec validate timed out`; one answering `{ refused: <text> }` → `cannot-run` with that text; one answering status 1 with `items[0].valid: true` for the change → `cannot-run`, never green; in every case no record reads green; a later red after a cannot-run counts on from the earlier `reds` | AC-7 |
| T-6 | 1 | The command: no merge → exit 0, `result: none`, no record file; an unknown change → exit 3, no record file | AC-5 |
| T-7 | 2 | `decide`: `mergeCheck` with no record and each step of `CHECK_BEFORE` → session `merge-check`, stage `evidence`, `detail.command` `['node', <HOOKS_DIR>/change-loop.mjs, 'merge-check', 'feat', '--lang', 'en']`, `detail.merge`, exit code 0; each step outside the list (`implement`, `fix-review`, `resolve-release-conflict`, `gate`, `commit`, `disable-auto-merge`, `blocked`, `stop-archive`), `archiving: true`, `merge: null`, and a flow without `evidence` → the same action as with `mergeCheck: null` | AC-1, AC-5 |
| T-8 | 2 | `decide`: a green record for the merge → the action without the check (`verify` to the verifier's agent); a green record for another sha → `merge-check` | AC-2 |
| T-9 | 2 | `decide`: a red record with the current fingerprint → `agent` `devkit-core:change-planner`, step `merge-defect`, stage `specs`, the brief holds `merge defect`, `origin/main`, the errors, `Leave every stage header line`; a red record with another fingerprint → `merge-check`; that hand-off's key given back as `after` → `no-progress` | AC-3 |
| T-10 | 2 | `decide`: red `reds: 2` → the planner; red `reds: 3` → blocked `merge-defect`, exit 2, reply holds the sha's 7 characters and `3`; a flow copy with `ceilings.default: 2` and `reds: 2` → blocked; the evidence stage's report entry is not read for it | AC-6 |
| T-11 | 2 | `decide`: a cannot-run record with `after` equal to the step's key → blocked `merge-check-failed`, reply holds the error; without that `after` → `merge-check` again | AC-7 |
| T-12 | 2 | `next` end to end on `deliveredChange`, given two new optional parameters (`files` added to the main checkout before the worktree, default `{}`; `delta`, the text of `specs/s/spec.md` and the proposal of T-4, default today's text, so every existing caller builds the same repository) carrying T-4's canonical spec (as `openspec/specs/s/spec.md`), delta and proposal, with a merge of `origin/main` that adds a scenario to the requirement the delta modifies: `next` → `merge-check`; `main(['merge-check', 'feat', ...])` → red; `next --after <key>` → the planner; every `devkit-stage` line of the change folder is byte-identical before the first `next` and after the third; the delta then fixed by the test → `next` → `merge-check`; the command → green; `next` → the action `deliveredChange` gives with no merge in its history (the same `end.why`, or the same `step`) | AC-1, AC-2, AC-3 |
| T-13 | 2 | `next` end to end, cannot run: the command run as in T-5 (`env.PATH` an empty temporary folder), then `next --after <key>` (its own CLI working) → exit 2, blocked `merge-check-failed` naming the openspec CLI; `next` with no openspec at all → exit 3 and an `error` naming the CLI (today's behaviour), never an action past the check | AC-7 |
| T-14 | 2 | AC-9: a `devkit` change with a ticked task, `readiness.md` APPROVED and a current `approval.md`; (a) its spec delta edited as a merge-defect fix, (b) its `design.md` edited instead, each file's time 10 s after `readiness.md`; `computeFlow(collectFlow(...))`'s entries for `readiness` and `approval` are equal between (a) and (b) and `passed`, and `approvalState(dir).ok` is true in both | AC-9 |
| T-15 | 2 | `change-state AC-3 state: each blocked reason decide gives is the reason, with its phrase and details` (existing test, `change-loop.test.mjs:4942` at `02208a3`): two more `cases`, `merge-defect` and `merge-check-failed`, built with `build(rowOf('verify'))` plus the record of T-10 and T-11 | AC-6, AC-7 |
| T-16 | 3 | Documents: the skill's `session` item names `merge-check` and "whatever its exit code"; `docs/openspec-flow.md` holds "the loop has the session run `merge-check`" and the two Troubleshooting rows and no longer holds "before the evidence, run `openspec validate <id> --strict`;"; the pack README's change-loop row names `merge-check`; the roadmap's `post-merge-validate` line names `evidence-attempts-by-failure` | AC-10 |

Existing tests that assert what this change touches: `change-state AC-3 state` (T-15: its invariant
is "every blocked reason `decide` gives renders its phrase in the state"; the layer is the loop's
state; the suite is `change-loop.test.mjs`; two cases are added, none changed); `change-loop replies:
no internal term` renders the two new keys with no edit. The fixture helper `deliveredChange` (`change-loop.test.mjs:819`) gains
the two optional parameters of T-12 with defaults that build today's repository, so its 20-odd
existing callers are unchanged. `ROW_STEPS` is unchanged, so
`change-loop.test.mjs:546` and the actor test do not move. Any other existing test whose fixture holds
a merge on the task branch and now gets `merge-check` is a stop for the phase and a plan revision,
not an edit of that test (the grep found none: the merges in `project-loop.test.mjs` are on slices,
which this change does not touch, and those in `delivery-models.test.mjs` are on the support branch).

### D-10 The real run (AC-8)

Run outside this repository, in `S=$(mktemp -d /var/tmp/pmv-XXXX)`; the outputs go to
`openspec/changes/post-merge-validate/proof/`. `<wt>` is this worktree.

1. `git init -q --bare $S/origin.git`; `git init -q -b main $S/work`; in `$S/work`: `git config
   user.name Scratch`, `git config user.email scratch@example.invalid`, `git remote add origin
   $S/origin.git`; copy `<wt>/plugins/openspec/schemas/devkit-lite` to `openspec/schemas/devkit-lite`;
   `openspec/config.yaml` with `schema: devkit-lite`, `ship:` `devkit-lite: pr`, and a `devkit:` block
   with `language: en`; `openspec/specs/cap/spec.md` with the requirement "Thing works" and one
   scenario "First"; commit, `git push -q -u origin main`.
2. `git switch -q -c probe`; the change folder `openspec/changes/probe/` with `.openspec.yaml`
   (`schema: devkit-lite`), `requirements.md`, `proposal.md` (with `## Acceptance criteria` and
   `- AC-1: a thing`), `specs/cap/spec.md` (a MODIFIED "Thing works" with scenario "First" and new
   text), `tasks.md` with one ticked task, each with a passed stage header; `src/a.txt`; commit, push.
3. In a second clone, on `main`, add the scenario "Second added on main" to "Thing works"; commit,
   push. In `$S/work`: `git fetch -q origin`, `git merge --no-ff --no-edit origin/main`.
4. A fake `gh` first on `PATH`: the script `roundRepo().ghAt(<path>)` writes in
   `conduct-check.test.mjs`, with no pull request set (the run makes no call to GitHub).
5. Red case: in `$S/work`, `command claude -p --plugin-dir <wt>/plugins/openspec --plugin-dir
   <wt>/plugins/core --output-format stream-json --verbose` with the prompt: "You are the conducting
   session of change probe. Read <wt>/plugins/openspec/skills/devkit/SKILL.md, section `## Loop`, and
   follow it in this folder, with `node <wt>/plugins/openspec/hooks/change-loop.mjs` as the script and
   `--lang en`. Carry out each action until `next` gives the `verify` hand-off or an end; do not carry
   that one out. Print every JSON action `next` printed." → `proof/real-run-red.jsonl`. When the run
   shows a permission denial, run it again with `--permission-mode bypassPermissions` (the scratch
   folder only) and say so in the proof.
6. Green case: a second scratch built the same way, where the base adds a new requirement "Other
   thing" and the delta is untouched by it; the same prompt → `proof/real-run-green.jsonl`.
7. `proof/real-run-summary.txt`: the `step`/`agent`/`end` of each `next` in order, from each stream;
   `git -C $S/work diff -- openspec/changes/probe/specs` (the scenario copied); the `devkit-stage`
   lines of the change folder before step 5 and after it (`diff` empty); the record
   `$S/work/.git/devkit/merge-check/probe.json` after each case.
8. Trust a stream only when its `system`/`init` event lists devkit-openspec and devkit-core with paths
   under `<wt>/plugins/` and it holds a Bash call of the `merge-check` command made by the session.

Pass: the red stream shows `merge-check` → the session's command → an Agent call to
`devkit-core:change-planner` whose prompt holds `merge defect` → `merge-check` → the command → the
`verify` hand-off; the green stream shows `merge-check` → the command → `verify`; header lines
unchanged. Any other sequence stops the evidence and goes back to the plan.

### D-11 Release

CONTRIBUTING.md step 5, against `origin/main` at the last merge before review: devkit-openspec takes
the next minor after `main`'s (0.33.0 at `02208a3`), the marketplace `metadata.version` the next minor
(0.37.0 at `02208a3`); both in `plugins/openspec/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`; a CHANGELOG entry `## <marketplace version> — post-merge validate`
with the devkit-openspec line; the three CI pin lines of `docs/openspec-flow.md` (`pinned to the
commit of v…`, `<commit sha of v…>`, `` (`v…` above) ``) moved to the new devkit-openspec version,
which `change-loop.test.mjs:2573` checks against the manifest. devkit-core is not touched.

### Alternatives considered

| Option | Why not |
|---|---|
| `next` runs `openspec validate` itself, with no step | AC-1 and AC-8 ask for a step the session runs; `next` stays read-only, and `/devkit status` and the roadmap call `next`'s code for every change, which would then run the CLI each time |
| Record the result in the change folder (a stage-like `merge-check.md`) | A new stage file is a `flow.json` change (a flow version bump) and a stage attempt by another name; writing it changes the fingerprint the red rule compares; it lands in the pull request |
| Decide "since the last green check" from the evidence header's commit | The check must run even when the evidence stays current (requirements: `stale-only-on-own-files` will keep it current across such merges) |
| Check only before `verify` | A merge that leaves the evidence current would reach `push` and the merge unchecked |
| Teach the merge defect in `plugins/core/agents/change-planner.md` | The brief carries the whole instruction; editing the agent bumps devkit-core for one hand-off; the real run (D-10) proves the brief alone is followed |
| Count the merge-defect hand-offs with a stage attempt | Out of scope by the owner (requirements, scope line): no attempt counter is touched |
| Require the second parent to be on `origin/<base>` | Wrong when the local `origin/<base>` is older than the merged base, which this change does not fetch |

### ADR 0017: a proposed Note

ADR 0017 decision 1 says a change's state is derived "from the change's files, git, GitHub and the
roadmap run file, by the code that decides the loop's next action, and stored nowhere". The record of
D-2 adds one input to that derivation: the blocked reasons `merge-defect` and `merge-check-failed`
come from it. ADR 0020 amended ADR 0017 by a dated Note when a new state came in (`no-place`,
`docs/adr/0017-a-change-state-is-derived-in-one-place.md`, Context), and the project rule for design
(`openspec/config.yaml`) records any decision that changes an ADR as an ADR proposal, never as a
silent deviation.

The answer: the owner chose, on 2026-11-23 (answer A), that the record stays in
`<git common dir>/devkit/merge-check/<id>.json`. The adr-author drafted a Note on ADR 0017 (Context,
`Note (post-merge-validate, 2026-11-23, status: proposed; ...)`) naming the record as one more input
of decision 1: a fact (what `openspec validate <id> --strict` answered for one merge), not stored
state. `decisions.md` lists that Note with ADR 0017 among the checked records, and the owner's
approval of this plan accepts it, as it accepts every record `decisions.md` lists
(`docs/openspec-flow.md`, the `decisions.md` row).

The design follows the Note: the record is read on every `next` and the state is still derived in one
place (`decide`), as the write-back record of jira-entry already is. No task of this plan writes or
edits the Note; task 3.3 adds no ADR text. No task keeps the Note's status line in step at the retro
or the archive either, since no project rule asks for it (`openspec/config.yaml` rules,
`CONTRIBUTING.md`, the adr-author's role). The loop's `accept-decisions` reads ADR 0017's own
`- Status: accepted` line and leaves the file as it is; the Note's own words say the plan approval
accepts it.

## Implementation plan

**Order** (dependency): the merge, the record and the command (phase 1) → the decision, the facts and
the replies (phase 2) → skill, documents, roadmap, release and the real run (phase 3). No data,
endpoint, frontend or worker surface.

**Per surface.** Hooks: `plugins/openspec/hooks/change-loop.mjs` only (D-1 to D-6). Skill:
`plugins/openspec/skills/devkit/SKILL.md` (D-8). Docs and release: `docs/openspec-flow.md`,
`plugins/openspec/README.md`, `openspec/roadmap.md`, `CHANGELOG.md`,
`plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (D-8, D-11).

**File structure.**

- Create: `openspec/changes/post-merge-validate/proof/red-1.txt`, `red-2.txt`, `red-3.txt`,
  `real-run-red.jsonl`, `real-run-green.jsonl`, `real-run-summary.txt`.
- Modify: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/change-loop.test.mjs`,
  the skill, docs, roadmap and release files above.
- Delete: none.

**Estimate.** Optimistic 12 h · likely 18 h · pessimistic 28 h (the likely figure is the table's sum).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 `baseMergeOf`; T-1 | 1.5 | Core | LOW |
| D-2 record path, reader, counting; T-2 | 1.5 | Core | LOW |
| D-3 `merge-check` command and classification; T-3 to T-6 | 3 | Core | MEDIUM |
| D-4 the decision, `CHECK_BEFORE`, brief; T-7 to T-11 | 3 | Core | MEDIUM |
| D-5 wiring in `nextAction`; T-12, T-13 | 2 | Integration | MEDIUM |
| D-6 replies; T-15 | 0.5 | Core | LOW |
| D-7 the plan-gate test; T-14 | 1 | Testing | LOW |
| D-8 skill, docs, README, roadmap; T-16 | 1 | Documentation | LOW |
| D-10 real run and proof | 3 | Testing | MEDIUM |
| D-11 release | 0.5 | Documentation | LOW |
| Whole suite and evidence | 1 | Testing | LOW |

## Risks / Trade-offs

| ID | Risk | Probability × impact | Mitigation |
|---|---|---|---|
| R-1 | An existing fixture with a merge on the task branch now gets `merge-check` and its test fails | LOW × MEDIUM | Grep found none (D-9); the phase-2 gate runs the whole change-loop suite; a hit stops the phase for a plan revision, never a silent test edit |
| R-2 | The planner raises a stage header's attempt anyway (its own instructions say so on a rewrite) | MEDIUM × MEDIUM | The brief says to leave every header line; the loop never reads those attempts for this; the real run (D-10 step 7) diffs the header lines; a raised attempt is a defect of the evidence |
| R-3 | `openspec validate` output changes in a later CLI (field names, message text) | LOW × MEDIUM | Anything not matching D-3's valid/invalid shapes is cannot-run, never green; T-4 asserts the requirement name, not the CLI's full sentence |
| R-4 | A stale local `origin/<base>` makes an old merge look new | LOW × LOW | One extra check of a valid change costs about a second; it never blocks a green change |
| R-5 | A merge left uncommitted (a conflict in progress) is not seen | LOW × LOW | Conflicts are the release-conflict path's (it commits its merge); the next `next` after the commit sees the merge |
| R-6 | Siblings in flight (`stale-only-on-own-files`, `delivery-merge-hold`) collide in `change-loop.mjs`, `docs/openspec-flow.md` and the release numbers | HIGH × LOW | Additive edits in one place of `buildPart`; merge `origin/main` before phase 1 and before the release task; re-read the version numbers there |
| R-7 | The installed devkit-openspec, not this worktree, runs this change's own loop, so this change's own post-merge merges are checked by hand | HIGH × LOW | CLAUDE.md: drive with the worktree's `change-loop.mjs` when needed; the by-hand sentence stays true until release |
| R-8 | The record is a new input of ADR 0017 decision 1 and is approved without a written answer | LOW × MEDIUM | Answered (section "ADR 0017: a proposed Note"): `decisions.md` lists the adr-author's Note on ADR 0017, status proposed, and the owner's plan approval accepts it; the code follows the Note |
| R-9 | The real run needs a `claude -p` session and its permissions | MEDIUM × LOW | The scratch folder only; `--permission-mode bypassPermissions` there when denied, recorded in the proof (the commit-attribution precedent) |

## Assumptions

- `openspec validate <id> --strict --json` answers as probed with CLI 2.0.0 (Context table); the
  dropped-scenario error names the requirement in quotes. If not, T-4 fails in phase 1 and the plan
  is revised before phase 2.
- GitHub's "update branch" merge has the branch head as first parent (the shape `release-merge.mjs`
  also commits, `docs/openspec-flow.md` "The merge is committed, never pushed").
- `fingerprint` is stable between the command and the next `next` when nothing in the worktree
  changed: the record lives in the git directory, outside `git status` (flow-check.mjs line 165).
- The session runs the step's command and `next` with the same `PATH`, so in practice "cannot run"
  comes from a timeout, the pin or an unexpected answer; with no CLI at all `next` already exits 3
  naming it (T-13).

## Dependencies

- ADR 0010 decision 3 (a loop over files; ends in four states) and decision 6 (the gates unchanged);
  ADR 0011 decision 2 (the session writes no product code: the step's command writes only its
  record); ADR 0016 (the planner writes its own plan files); ADR 0017 decision 1 (with the proposed Note, see "ADR 0017: a proposed Note").
- `decisions.md` (the adr-author's; it lists the Note on ADR 0017, which the plan approval accepts). No sibling change is a prerequisite; `fresh-base-check`,
  `stale-only-on-own-files` and `evidence-attempts-by-failure` are independent roadmap lines.
- No open-decisions log in the repository.

## Migration Plan

Nothing to migrate: a change already in delivery whose branch holds a merge gets one `merge-check`
on its next `next`, then goes on. Rollback: revert the release; the records in
`<git common dir>/devkit/merge-check/` are then unread and can be deleted by hand.

## Open Questions

None. The ADR 0017 question is answered: the owner chose the record's place on 2026-11-23 (answer
A), and `decisions.md` lists the proposed Note on ADR 0017, which the owner's plan approval accepts
(section "ADR 0017: a proposed Note").
