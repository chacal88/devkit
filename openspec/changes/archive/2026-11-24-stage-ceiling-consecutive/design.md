<!-- devkit-stage design result=passed attempt=3 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Design

Change: `stage-ceiling-consecutive` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `proposal.md`, `specs/change-stages/spec.md`,
`specs/project-definition/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `6fce972` (devkit-openspec 0.33.0, flow version 2 of
`devkit` and `devkit-lite`).

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/flow-check.mjs#collectFlow` | The only function that starts programs (git, openspec, gh). Builds `facts`: `files[stage]` from `stageFiles` (path relative to the change folder, parsed header, mtime), and the lazy functions `staleness`, `staleReviewers`, `delivery` |
| `flow-check.mjs#artifactState` | Takes the worst result of a stage's files and the header `h` of the first file with that result. A failed stage with a numeric ceiling returns `header-failed` with params `{ attempt, ceiling }` and `fixed` (stale since the failure) |
| `flow-check.mjs#computeFlow` | Pure. For the current failed stage: `ceiling: "owner"` offers the stage again; else `raw.attempt >= ceiling` ends `blocked` / `ceiling-reached` `{ stage, attempt, ceiling }`; else `rerun-after-fix` when fixed; else `fix-after-failure` `{ failed, attempt, ceiling }` for `onFail ?? stage` |
| `flow-check.mjs#TEXT` | `header-failed`, `fix-after-failure`, `ceiling-reached` say "failed at attempt N of C" (en and pt-BR); `renderText` prints `header-failed` as the stage line as is |
| `plugins/openspec/hooks/change-loop.mjs` | `MESSAGES` `blocked-why.ceiling` (en line 297, pt-BR line 552) is `{stage} failed {attempt} times, which is its limit`. `blockedEnd` (line ~1166) builds `{ stage, attempt, error, number }` from the end's params. The `fix-after-failure` briefs at lines 1119-1121 (plan stages) and 1157-1160 (`fix-tests`) read `{ failed, attempt, ceiling }`. `render` (line 662) expands the special names `stage`, `inStage`, `Stage`, `why`; any other name missing from params throws `LoopUsageError` |
| `change-loop.mjs#blockedReason` | Renders `blocked-why.<why>` from an action's params or from a declared end recorded in the roadmap run file (`declaredEnd`) |
| `plugins/openspec/hooks/roadmap-loop.mjs` | Renders `roadmap-blocked`, `roadmap-blocked-others` and `need.blocked` with the change action's or the declared end's params, through the same `{why}` |
| `plugins/openspec/hooks/project-loop.mjs#blockedEnd` (line ~170) | Builds `{ stage, attempt }` and renders the shared `blocked-why.ceiling` (imports `render` from `change-loop.mjs`) |
| `plugins/openspec/schemas/*/flow.json` | Ceilings: `devkit` readiness 3, evidence 3, review 2, mock-up `owner`, default 3 (unit-tests, e2e-tests and every other artifact stage); `devkit-lite` evidence 3, review 2, default 3; `devkit-project` review 2, default 3 |
| `plugins/openspec/skills/ship-change/SKILL.md` line 57 (`review` row) | The `review` stage of `devkit` and `devkit-lite` writes `attempt=<the round>`, and `deliver-check.mjs` line 1587 gives round 1 unless the last consensus was `FAIL` at round 1 with a reviewer that rejected again; a review redone after a pass or after stale `Commit:` lines is round 1 again. So `attempt` is not "one more on every rewrite" for this stage: it restarts. Every other writer (and the `devkit-project` review, `project-loop.mjs` line 549) gives one more than the file it replaces |
| `flow-check.mjs#collectFlow` line 259 → `deliver-check.mjs#gitFacts` / `dirtyPaths` (lines 250-251) | `git status` runs outside any `try`: outside a git repository or with no `git` on `PATH`, `collectFlow` throws and `flow-check` exits 3 with `flow-check: Command failed ...` and no report (`flow-check.mjs` lines 707-710). The checker never walks a change it cannot read with git |

Constraints:

- A test never reads the repository's own git history (`openspec/config.yaml`, "Test history"); every
  history in a test is a fixture repository the test builds in `tmpFolder` (`test-tmp.mjs`).
- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are the files the `devkit-reviews` CI job
  downloads; this change leaves all three untouched. `STAGE_HEADER` and `parseStageHeader` (in
  `guard.mjs`) are only imported.
- No `flow.json`, `flows/<n>.json`, template, agent or skill changes (AC-5), so `scripts/released-flows.json`
  and the flow version stay as they are.
- `computeFlow` stays pure: every git read happens in `collectFlow`'s lazy functions.

## Goals / Non-Goals

**Goals:**

- One reader of a stage file's earlier headers (`stageHistory`, D-2) and one pure count
  (`failuresInARow`, D-3), both exported by `flow-check.mjs`.
- The count reaches every reader of the three reason codes: the stage line, the next stage's reason,
  the blocked end, the loop's briefs and the loop's blocked reply (D-5, D-6).
- Every history case the plan declares has a test and a real-run proof (D-4, D-8, D-9).

**Non-Goals:**

- No merge detection: a take redone because main moved is simply a passed take in the history.
- No cache of the count anywhere (ADR 0017 decision 1: derived on every read, stored nowhere).
- No change to `conduct-check.mjs` or `deliver-check.mjs`: neither reads a ceiling.

## Decisions

### D-1 The count is derived from git, in `collectFlow`; `computeFlow` stays pure

`collectFlow` adds one lazy, memoised fact, `facts.history(path)`: the parsed line-1 headers the
stage file `path` (relative to the change folder, as in `facts.files`) carried in the commits of the
checked-out history, newest first. It calls `stageHistory(root, join(relative(root, located.dir), path), env)`
once per path. `artifactState` calls it for every failed stage with a numeric ceiling (the current
stage or one after it; `computeFlow` reads the result from the raw state), so a run with no failed
stage starts no extra process. A `facts` without `history` (the synthetic facts of the tests, an
older caller) counts with no earlier header, which is today's rule (D-3: no passed header visible).

ADR 0010 decision 3 puts the ceiling count in the checker; ADR 0017 decision 1 derives state from the
change's files and git and stores it nowhere. Both are followed; `decisions.md` records that no new
ADR is needed.

Alternatives rejected:

- A new header field (`failures=<n>` or `streak=`): changes `STAGE_HEADER` in `guard.mjs` (a CI
  file), every agent that writes a header, the templates and the flow version, against the roadmap
  line's "keep `attempt` as it is" (requirements, assumption 3).
- A count file in the change folder: state stored outside the files and git, against ADR 0017
  decision 1, and one more file every writer must keep right.
- Reading the reasons of earlier takes from the evidence body (defects listed): not a contract any
  reader keeps; the header's `result` is.

### D-2 The history reader: `stageHistory(root, rel, env = process.env)`

Exported by `flow-check.mjs`. Two git processes, both `execFileSync('git', ['-C', root, ...])` with
`env`, `maxBuffer: MAX_BUFFER` and stderr ignored, as `fingerprint` does:

1. `git -C <root> log --topo-order --format=%H -- <rel>`: the commits that touched the file, newest
   first (default history simplification; merges of main that do not touch the change folder are
   skipped). `--topo-order` shows no parent before its children, so the order holds when commit
   dates tie or skew (the count of D-3 depends on the order; fixture commits share a second).
2. `git -C <root> cat-file --batch`, its stdin one line `<sha>:./<rel>` per commit. Each answer is
   `<oid> blob <size>\n<bytes>\n`, or `<name> missing\n` for a commit whose file is absent (deleted at
   that commit); the reader walks the output by the sizes, as a `Buffer`, and keeps
   `parseStageHeader(<bytes as utf8>)` for each blob, in the log's order.

`./<rel>` resolves the path against `root` (the `-C` directory), so a project whose `openspec/` folder
is below the git top level reads the right file. Any failure (git missing, not a repository, no
commit yet, a non-zero exit, an output the reader cannot walk) returns `[]`; a `missing` answer is
skipped. The first two cannot reach the reader through `flow-check` (`collectFlow` already exits 3
there, Context); the reader still returns `[]` for them, pinned by its own unit cases (D-4 F-1, F-2),
because it is exported and must not throw. Unterminated input: a batch answer whose declared size runs past the end of the output ends
the walk, keeping the headers read before it.

Alternatives rejected: `git show <sha>:<path>` once per commit (one process per take); `git log -p`
(the whole diff of every take, to read one line); `git log -L1,1:<path>` (an output format that is
harder to walk and changes with renames).

### D-3 The count: `failuresInARow(current, earlier)`

Exported by `flow-check.mjs`, pure. `current` is the failed header; `earlier` is `stageHistory`'s
list, newest first:

```
failed = an empty set of keys
for h in [current, ...earlier], in that order:
    skip h when it is null or malformed, names another stage, or says not-applicable or pending
    stop when h says passed (reached = true)
    h says failed: add the key `${h.attempt} ${h.commit}` to failed
failuresInARow = reached ? size(failed) : max(current.attempt, size(failed))
```

- The count is the number of distinct failed headers the file carried since its last passed
  version, in git order. No attempt number is subtracted: the `review` stage restarts its attempt at
  1 when a round starts over (Context, `ship-change` line 57, `deliver-check.mjs` line 1587), so
  `attempt` minus a passed attempt undercounts there (`passed 1`, `failed 1`, `failed 2` would give
  1 at a ceiling of 2). Counting headers does not read the numbers' order, so it holds for every
  writer.
- Distinct by `attempt` and `commit`: a file version carried unchanged by several commits (the
  current header committed, then a commit that changes only the body) is one take. The current header
  is always counted; when it is committed, its own commit is the first entry of `earlier` and adds
  nothing.
- Only `passed` stops the walk, whatever its attempt (a passed round 2 followed by a failed round 1
  is a reset). `not-applicable`, `pending`, a malformed or missing header and a header of another
  stage neither stop nor count.
- The `commit=` field of an earlier header is not resolved: the count trusts the file version git
  holds, not the commit that version names (D-4, H-4).
- With no passed header visible (the history is empty or unreadable, a depth-1 clone, every take
  failed), the count is at least `attempt`: today's rule. This is the only case where the ceiling is
  never looser than today; once a pass is visible, the count is the failures since it, by design.
- A take written and overwritten without a commit is unseen and not counted (H-5). After a visible
  pass that makes the count lower than the real streak; Risks names the mitigation.

The stage file the count reads is the file whose header gave the stage's `failed` result: the first
file, in `stageFiles` order, that says `failed` (the same `h` `artifactState` already takes). For a
stage of one file (every stage with a declared ceiling) that is its file.

### D-4 Which cases give the count and which give today's rule (AC-4)

The count is at least `attempt` whenever no `passed` header of the stage is visible in the file's
history. The cases the plan declares; each has a test (D-9), and each the checker can reach has a
real-run case (D-8):

| Id | Case | What the reader sees | Count |
|---|---|---|---|
| H-1 | Full history, a passed take before the failure (AC-1, AC-3, AC-7) | every committed take | the distinct failed headers since the newest passed one: 1 for passed 1, passed 2, failed 3 |
| H-2 | Full history, every take failed (AC-2) | every committed take, none passed | `max(attempt, distinct failed)` = `attempt` (the count and today's rule agree) |
| H-3 | A shallow clone deep enough to hold the last passed take (`--depth 2` over passed 1, passed 2, failed 3) | the visible commits | from what it shows: 1 |
| H-4 | A committed passed header whose `commit=` names a sha not in the history (a rebased-away commit, or a made-up one) | the committed file version | counts the pass: 1 |
| H-5 | A take written and overwritten without a commit (passed 1 committed, failed 2 never committed, failed 3 committed) | failed 3, passed 1 | 1: the unseen take is not counted |
| H-6 | A restarted round (AC-2): the `review` committed `passed attempt=1`, then `failed attempt=1` (a fresh round after the pass), then `failed attempt=2`, ceiling 2 | every committed take | 2: `ceiling-reached` (no attempt is subtracted; D-3) |
| F-1 | The reader called on a folder that is not a git repository | `[]` (git log fails) | `attempt`. Unit case of `FC.stageHistory` only: through `flow-check` the run exits 3 before the walk (Context) |
| F-2 | The reader called with no `git` on `PATH` | `[]` (spawn fails) | `attempt`. Unit case of `FC.stageHistory` only, as F-1 |
| F-3 | A depth-1 clone (CI's default checkout) | one commit, holding the current header | `attempt` |
| F-4 | The stage file was never committed | `[]` (git log lists nothing) | `attempt` |

The "header whose commit is not in history" of the request is H-4: it gives the count, because the
reader takes file versions from git's own history and never resolves the header's `commit=` field.
The current failed header whose `commit=` is not in history is still staleness's case: it makes the
failed stage `fixed`, so under the ceiling the next stage is `rerun-after-fix`, as today.

### D-5 The params and the walk

- `artifactState`: for `result === 'failed'` and a numeric ceiling, `failures =
  failuresInARow(h, facts.history?.(f.path) ?? [])` where `f` is the file of D-3; the raw state gains
  `failures`, and `header-failed`'s params become `{ attempt, failures, ceiling }`. The owner-ceiling
  branch (`changes-asked`) and every other branch are unchanged and read no history.
- `computeFlow`: `if (raw.failures >= ceiling)` ends `blocked` / `ceiling-reached` with
  `{ stage, attempt, failures, ceiling }`; `fix-after-failure` carries `{ failed, attempt, failures, ceiling }`.
  The order of the checks (owner ceiling, ceiling, `rerun-after-fix`, fix) is unchanged.
- `stageEntry`, the report's top-level keys and the stage-entry keys are unchanged: `failures` lives
  in `params` only (the JSON key lists pinned by `flow-check readout: --json carries the same facts`
  hold).

### D-6 The sentences

`flow-check.mjs#TEXT`:

| Code | en | pt-BR |
|---|---|---|
| `header-failed` | `failed at attempt ${attempt}; failures in a row: ${failures} of ${ceiling}` | `falhou na tentativa ${attempt}; falhas seguidas: ${failures} de ${ceiling}` |
| `fix-after-failure` | `the ${failed} failed at attempt ${attempt} (failures in a row: ${failures} of ${ceiling}) and the code has not changed since; the fix comes before another review` | `a ${failed} falhou na tentativa ${attempt} (falhas seguidas: ${failures} de ${ceiling}) e nada mudou no código desde então; a correção vem antes de uma nova revisão` |
| `ceiling-reached` | `the ${stage} failed at attempt ${attempt}; its failures in a row (${failures}) reached its ceiling of ${ceiling}` | `a etapa ${stage} falhou na tentativa ${attempt}; as falhas seguidas (${failures}) chegaram ao limite de ${ceiling}` |

(`${failed}` and `${stage}` are `nameOf(n, …)` as today.)

`change-loop.mjs#MESSAGES`:

- en `blocked-why.ceiling`: `{stage} reached its limit of failures in a row ({failures})`
- pt-BR `blocked-why.ceiling`: `{stage} chegou ao limite de falhas seguidas ({failures})`

The number sits in parentheses so a ceiling of 1 reads right in both languages (today's "failed 1
times" does not).

`change-loop.mjs#render` gains one special name beside `stage`, `inStage`, `Stage` and `why`:
`{failures}` is `params.failures` when given, else `params.attempt` (else the usual
`LoopUsageError`). That one rule keeps every renderer of a ceiling reason working on params that
carry no `failures`: a declared end a roadmap run file recorded before this release, a roadmap line,
the `state` command. `blockedEnd` in `change-loop.mjs` and in `project-loop.mjs` pass
`failures: e.params?.failures` beside `attempt`.

The two briefs of `change-loop.mjs` read `failures` (`n.params.failures ?? attempt`):

- line 1121: `${failed} failed at attempt ${attempt} (failures in a row: ${failures} of ${ceiling}): revise the plan from its findings`
- line 1160: `${failed} failed at attempt ${attempt} (failures in a row: ${failures} of ${ceiling}): fix the code from ${file}, test first, within the approved tasks`

### D-7 Documents

- `docs/openspec-flow.md` line 109: "how many failed attempts they get" becomes "how many failures in
  a row they get", followed by one sentence: the checker counts a failed stage's failures in a row as
  the distinct `result=failed` headers its file carried in the commits since the file last carried
  `result=passed`, read from git history newest first, and as at least `attempt` when no passed
  header is visible (a depth-1 clone, a file never committed); a take written and overwritten
  without a commit is not seen, so commit each take.
- `plugins/openspec/README.md` line 21: "failed-attempt ceilings" becomes "ceilings of failures in a row".
- `docs/coordination-design.md` line 348-349: "a plan rejected at readiness three times" becomes "a
  plan rejected at readiness three times in a row (counted since it last passed)".
- No test pins any of the three sentences (searched: `failed attempts they get`, `failed-attempt
  ceilings`, `at readiness three times`).
- `CHANGELOG.md`: one entry; devkit-openspec takes a patch bump (D-10).

### D-8 The real-run proof

Built by hand in scratch repositories under the private `TMPDIR`, never inside the worktree, with
the real `openspec` CLI and the worktree's `node plugins/openspec/hooks/flow-check.mjs` and
`node plugins/openspec/hooks/change-loop.mjs`. Each scratch repository is made like `sampleChange`
of `flow-check.test.mjs`: `git init -b main`, `openspec init --tools none --no-animation .`, the
worktree's `plugins/openspec/schemas/devkit` copied to `openspec/schemas/devkit`, `openspec/config.yaml`
`schema: devkit`, a change `feat` whose plan stages, approval and tasks (all ticked) are passed at
the first commit, and whose stage under test has no file at that commit: the evidence for every
run but P-3, P-9 and P-13; for P-3 and P-9 that stage is `review`, and `evidence.md` is committed
passed at the first commit. Then the stage's file is written and committed once per take with the
header the case names. P-13 alone is a plan-only change (below). Every command and its output, as printed, goes to
`openspec/changes/stage-ceiling-consecutive/proof/real-run.txt`, one section per case.

The environment of every run is the one the change-loop CLI tests use (`cleanEnv` of
`change-loop.test.mjs`): `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF`, `GITHUB_EVENT_PATH` and `CLAUDE_CODE_SESSION_ID` set empty, `TMPDIR` the private
`/var/tmp/devkit-stage-ceiling-consecutive`. The scratch `openspec/config.yaml` has no `ship:` key, so
the ship mode is `plan` (`deliver-check.mjs#deliveryConfig`, line 154): `collectFlow`'s post-merge
check (`config.ship !== 'plan' && …`) never calls `delivery()`, the walk stops at the failed stage
before the delivery stage, and no run starts a real `gh` lookup on branch `main`. The
`change-loop.mjs next` runs (P-2, P-13) are made on branch `main` of the scratch repository's own
checkout, as `planChange` of `change-loop.test.mjs` does; P-5, on branch `feat`, runs `flow-check`
only.

Which runs can show a brief: `change-loop.mjs next` prints one of the two D-6 briefs only where
the stage checker's step reaches it. A failed evidence (P-1) does not: its next stage is
`implementation`, so the change is `inDelivery` (`change-loop.mjs:867-874`), `buildPart` runs, and
`testStageStep` takes only `unit-tests` and `e2e-tests` as the failed stage (`:856`, `:1157`);
every other failure goes to the delivery checker's row (`:1180-1196`), whose brief is
`step <step> <detail JSON>` and carries nothing of the stage checker. P-1 therefore runs
`flow-check` only. The plan brief (`:1119-1121`) is proven by P-13: a failed `readiness` goes back
to its `onFail` stage `proposal` (`plugins/openspec/schemas/devkit/flow.json`, `readiness`), a
plan-part stage, so `inDelivery` is false and no delivery row is read.

The `fix-tests` brief (`:1157-1160`) is proven by its unit test alone (D-9,
`stage-roles loop: fix-tests ...` and `stage-ceiling-consecutive AC-6 loop: the fix briefs name the
failures in a row`), not by a real run. A failed `unit-tests` stage also sends the change to
`implementation`, so `next` reads the delivery checker before `decide` (`collectState` with a real
`gh`, `defaultBase`, `change-loop.mjs:1298-1308`): on a scratch repository with no remote that is
the real GitHub lookup this environment rules out, and its outcome is not this change's. The brief
itself is built by `testStageStep` from the stage checker's params alone, before the row is
looked at (`:1176-1178`), and those params come from the same `fix-after-failure` line of
`computeFlow` (`flow-check.mjs`, `offer(s.onFail ?? s.id, 'fix-after-failure', …)`) whose
`failures` P-1 and P-13 show on real runs; the unit test feeds that shape and pins the sentence.

| Run | Case | Commands | Expected |
|---|---|---|---|
| P-1 | H-1 / AC-1: passed 1, passed 2, failed 3 | `flow-check.mjs feat --json`, `flow-check.mjs feat --lang en`, `flow-check.mjs feat --lang pt-BR` | next `implementation`, `fix-after-failure`, `failures: 1`; the readout names "failures in a row: 1 of 3" in both languages |
| P-2 | H-2 / AC-2: failed 1, 2, 3 | the same three, `change-loop.mjs next --change feat --lang en` and `change-loop.mjs next --change feat --lang pt-BR` | `blocked`, `ceiling-reached`, `failures: 3`, exit 2; the `next` reply (a blocked end goes through `blockedEnd`) says the limit of failures in a row (3) in both languages. P-12 is the run that reads the end the loop recorded |
| P-3 | AC-2, review ceiling 2: review failed 1, failed 2 | `flow-check.mjs feat --json` | `ceiling-reached`, `failures: 2` |
| P-4 | AC-3: failed 1, passed 2, failed 3; then failed 1, failed 2, passed 3, failed 4 | `flow-check.mjs feat --json` after each last take | `failures: 1`; the passed take 3 reads `passed` |
| P-5 | AC-7: on branch `feat`, passed 1, `git merge --no-ff main` (main moved a product file), passed 2, merge, passed 3, merge, failed 4 | `flow-check.mjs feat --json` | `fix-after-failure`, `failures: 1`, not blocked |
| P-6 | H-3: `git clone --depth 2 file://<P-1 repo>` | `flow-check.mjs feat --json` in the clone | `failures: 1` |
| P-7 | H-4: passed 2 committed with `commit=` a sha not in history | `flow-check.mjs feat --json` | `failures: 1` |
| P-8 | H-5: passed 1 committed, failed 2 written and never committed, failed 3 committed | `flow-check.mjs feat --json` | `failures: 1`, `fix-after-failure` |
| P-9 | H-6 / AC-2: review `passed attempt=1`, `failed attempt=1`, `failed attempt=2`, each committed (ceiling 2) | `flow-check.mjs feat --json` | `blocked`, `ceiling-reached`, `failures: 2`, exit 2 |
| P-10 | F-3: `git clone --depth 1 file://<P-1 repo>` | `flow-check.mjs feat --json` in the clone | `ceiling-reached`, `failures: 3` (P-1 itself gives 1) |
| P-11 | F-4: passed 1 and passed 2 only written, failed 3 written, none of the three committed | `flow-check.mjs feat --json` | `ceiling-reached`, `failures: 3` |
| P-12 | The conducting session's part: the loop's `state` on P-2 | `change-loop.mjs state --lang en` and `--lang pt-BR` from P-2's folder | the reason text is the new `blocked-why.ceiling` sentence |
| P-13 | AC-1 / AC-6, the plan brief: a plan-only change made as `planChange` of `change-loop.test.mjs` does (requirements to tasks passed at the first commit, no approval), `readiness.md` committed as `passed attempt=1`, `passed attempt=2`, `failed attempt=3` (ceiling 3), its `commit=` the commit that holds the plan files, no plan file changed after it | `flow-check.mjs feat --json`, `change-loop.mjs next --change feat --lang en` | `flow-check`: next `proposal`, `fix-after-failure`, `failures: 1`, not blocked; `next`: the `agent` action on stage `proposal`, role `change-planner`, exit 0, whose brief is `readiness failed at attempt 3 (failures in a row: 1 of 3): revise the plan from its findings` |

Not a real run: the reader's F-1 and F-2 (no git repository, no `git`). `flow-check` exits 3 there
with `flow-check: Command failed ...` before any walk (Context), today and after this change, so no
`failures` can be observed end to end; the unit cases of D-9 are their proof.

`project-loop.mjs` renders the same `blocked-why.ceiling` template through the same `render`; its
`project-loop next: S12 a review at its ceiling ends blocked` test drives the real CLI on a scratch
slice, and that test's output is its proof; no separate slice run is declared.

### D-9 Tests

Every new test's name starts `stage-ceiling-consecutive ` and reaches a new export through the `FC`
namespace (`FC.stageHistory`, `FC.failuresInARow`), never a named import, so on today's code each new
test fails on its own instead of the whole file failing to load.

Fixtures: the history tests build their own repositories with the helpers `flow-check.test.mjs`
already imports from `deliver-check.test.mjs` (`gitRepo`, `put`, `commitAll`, `git`) and its own
`liveChange`, `liveReport`, `fakeOpenspec`. One new helper in `flow-check.test.mjs`:

- `takesChange(stage, takes, { merges = false } = {})`: `liveChange({ skip: [stage] })` (so the
  stage's file is in no commit before the first take: `liveChange` otherwise commits every stage
  passed at attempt 1, which would reset every count), then for each take `i` (a result, or
  `{ result, attempt, commit, commitIt = true }`) writes `openspec/changes/feat/<stage>.md` with
  `<!-- devkit-stage <stage> result=<result> attempt=<attempt ?? i+1> commit=<commit ?? HEAD> -->` and, when
  `commitIt`, `commitAll(root, 'take <i+1>')`. With `merges`, right after `liveChange` it runs
  `git branch main-moves` and `git checkout -q -b feat`; before each take after the first it checks
  out `main-moves`, commits `src/main-<i>.ts`, checks out `feat` and runs
  `git merge --no-ff --no-edit -q main-moves`, a real merge commit. Returns the root.
- The shallow clones use `git clone -q --depth <n> file://<root> <clone>` into a `tmpFolder`, as the
  deliver-check test `--ci preflight: a shallow clone is exit 3 naming fetch-depth: 0` does.

New tests in `plugins/openspec/hooks/flow-check.test.mjs`:

| Test | Pins |
|---|---|
| `stage-ceiling-consecutive AC-1: a failure after two passed takes is offered its fix` | evidence `[passed, passed, failed]`: next `implementation`, `fix-after-failure`, params `{ failed: 'evidence', attempt: 3, failures: 1, ceiling: 3 }`; the stage line's params `{ attempt: 3, failures: 1, ceiling: 3 }` |
| `stage-ceiling-consecutive AC-2: failures in a row still end blocked` | evidence `[failed, failed, failed]`: `ceiling-reached` `{ stage: 'evidence', attempt: 3, failures: 3, ceiling: 3 }`; review `[failed, failed]`: `ceiling-reached`, `failures: 2`, `ceiling: 2`; H-6, a restarted round, review `[{ result: 'passed', attempt: 1 }, { result: 'failed', attempt: 1 }, { result: 'failed', attempt: 2 }]`: `ceiling-reached` `{ stage: 'review', attempt: 2, failures: 2, ceiling: 2 }` |
| `stage-ceiling-consecutive AC-3: a pass between failures resets the count` | `[failed, passed, failed]`: `failures: 1`; `[failed, failed, passed]`: the evidence's state is `passed` and no end or next stage names it; `[failed, failed, passed, failed]`: `failures: 1` |
| `stage-ceiling-consecutive AC-4: history that cannot be read keeps the attempt` (subtests F-1 to F-4, and the synthetic walk) | F-1 `FC.stageHistory` on a `tmpFolder` with no `.git` is `[]` (the reader alone: `flow-check` exits 3 there before the walk); F-2 `FC.stageHistory` with `env.PATH` an empty `tmpFolder` is `[]` (the reader alone, as F-1); F-3 a depth-1 clone of the AC-1 fixture ends `ceiling-reached`, `failures: 3`; F-4 the AC-1 takes written and never committed end `ceiling-reached`, `failures: 3`; `walk` with no `history` fact: `failures` equals `attempt` and the end is `ceiling-reached` exactly when `attempt >= ceiling` |
| `stage-ceiling-consecutive AC-4: what the history shows is counted` (subtests H-3 to H-5) | H-3 a depth-2 clone of the AC-1 fixture: `failures: 1`; H-4 a passed take 2 with `commit=` forty hex digits not in the repository: `failures: 1`; H-5 `[passed, { result: 'failed', commitIt: false }, failed]`: `failures: 1` (the unseen take is not counted) |
| `stage-ceiling-consecutive AC-7: takes retaken after merges of main do not count` | with `merges`: `[passed, passed, failed]` gives `failures: 1`; `[passed, passed, passed, failed]` gives `fix-after-failure`, `failures: 1`, `end` null |
| `stage-ceiling-consecutive: failuresInARow counts the distinct failed headers since the last pass` | pure, `earlier` newest first: `null`, `{ malformed: true }`, another stage, `not-applicable` and `pending` neither stop nor count; the first `passed` stops the walk whatever its attempt (current `failed 1` over `[passed 2]` gives 1); current `failed 2` over `[failed 1, passed 1]` gives 2 (a restarted round, no subtraction); the current header repeated as the first earlier entry, and one failed header carried by two commits, count once; with no passed header the count is `max(attempt, distinct failed)` (`failed 3` over `[]` gives 3; `failed 1` over `[failed 2, failed 1 (another commit)]` gives 3) |
| `stage-ceiling-consecutive: the history is read only for a failed stage with a numeric ceiling` | `walk` with a `history` function that counts its calls: all stages passed, 0 calls; a mock-up `result=failed` (ceiling `owner`), 0 calls; a failed evidence, 1 call with `evidence.md` (the call is `artifactState`'s, D-1) |
| `stage-ceiling-consecutive AC-6: the readout says the failures in a row in both languages` | `renderText` of the AC-1 fixture's report, `en` and `pt-BR`: the evidence line ends with D-6's `header-failed` sentence and the `Why:` / `Por quê:` line with D-6's `fix-after-failure`; the AC-2 fixture's end line is D-6's `ceiling-reached` |

New tests in `plugins/openspec/hooks/change-loop.test.mjs`:

| Test | Pins |
|---|---|
| `stage-ceiling-consecutive AC-6 loop: the ceiling reply says the failures in a row, in both languages` | `ceiling-reached` `{ stage: 'evidence', attempt: 5, failures: 3, ceiling: 3 }`: the reply is `render(lang, 'blocked', …)` with D-6's sentence and `(3)`, not 5, in `en` and `pt-BR`; params with no `failures` render `attempt` |
| `stage-ceiling-consecutive AC-6 loop: the fix briefs name the failures in a row` | `fix-after-failure` `{ failed: 'readiness', attempt: 3, failures: 1, ceiling: 3 }` gives D-6's plan brief; `{ failed: 'unit-tests', attempt: 3, failures: 1, ceiling: 3 }` gives D-6's `fix-tests` brief |

AC-9's "red on today's code": the AC-1, AC-2, AC-3, AC-4 (both), AC-6 and AC-7 tests of
`flow-check.test.mjs` and the two of `change-loop.test.mjs` are written first and run on the code
before the fix; each fails (AC-2 and F-1 to F-4 by the missing `failures` param or the missing
`FC.stageHistory`, the others by the ceiling end or the old sentence). The output is saved under
`proof/`.

Existing tests that assert a changed text or param (searched: `failed at attempt`, `falhou na
tentativa`, `which is its limit`, `que é o limite`, `ceiling-reached`, `attempt: `, `ceiling: ` in
every `*.test.mjs` of `plugins/`):

| Suite | Layer | Test | Invariant | Action |
|---|---|---|---|---|
| `flow-check.test.mjs` | the walk | `flow-check stages: a failed header does not pass its stage` | a failed header is a failed stage with its params | params gain `failures: 1` |
| same | the walk | `flow-check stages: a failed stage past its ceiling ends blocked` | the ceiling blocks (here with no history: today's rule) | end params gain `failures: 2` |
| same | the walk | `flow-check stages: a failed stage offers its fix, then itself after the fix` | the fix first, then the stage | next params gain `failures: 1` |
| same | the readout | `flow-check readout: both languages cover every reason code` | every code is said in both languages with no `undefined` | the `P` table gains `failures` for `header-failed`, `fix-after-failure`, `ceiling-reached` |
| same | the readout | `flow-check readout: the sample change prints the approved text` (`SAMPLE_PT`, `SAMPLE_EN`) | the approved readout | the review line and the `Por quê:` / `Why:` line take D-6's sentences with `failures` 1 of 2 |
| same | the CLI | `flow-check readout: exit codes` | a ceiling exits 2 | kept: its fixture commits one failed header at attempt 2, so the count is 2 |
| same | the walk | `stage-roles flow owner: a mock-up sent back at attempt 3 and at attempt 40 is never blocked by a ceiling` | the owner ceiling never blocks; a numeric one does | kept (synthetic, no history: count = attempt) |
| `version-pin.test.mjs` | the readout | `version-pin AC-2 readout: the version-1 ceiling holds after the upgrade` | the recorded version's ceiling holds | the regex `/failed at attempt 1 of 2/` becomes `/failed at attempt 1; failures in a row: 1 of 2/` |
| same | the walk | `version-pin AC-3 readout: the version-2 ceiling blocks` | the new version's ceiling blocks | kept (one failed take, count 1, ceiling 1) |
| `change-loop.test.mjs` | the replies | `change-loop replies: a stage reads as a noun phrase in each language` | the stage phrase inside a reply | the pt-BR ceiling reply becomes `A change x parou: a etapa Revisão do plano chegou ao limite de falhas seguidas (3). Nada mais roda até isso ser resolvido.` (params still `attempt: 3`: the `{failures}` fallback) |
| same | decide | `change-loop decide: P5 a stage offered because the readiness failed goes to the planner, naming the failure` | the plan brief names the failure | the regex becomes `readiness failed at attempt 1 \(failures in a row: 1 of 3\): revise the plan from its findings` (its params gain `failures: 1`) |
| same | decide | `change-loop decide: P9 a ceiling and the other blocked ends of the plan` | a ceiling ends blocked with its reply | kept: `says(...)` renders the same template |
| same | the CLI | `change-loop next: a readiness failed at its ceiling exits 2`, `change-loop next: a blocked change called again ends blocked again` | a ceiling exits 2, stably | kept (one committed failed take at attempt 3) |
| same | decide | `stage-roles loop: fix-tests a red test stage goes back to the implementer, naming the failed stage and its file` | the `fix-tests` brief | the regex becomes `${failed} failed at attempt 2 \(failures in a row: 2 of 3\): fix the code from …` (params gain `failures: 2`) |
| same | state | `change-state AC-3 state: each blocked reason decide gives is the reason, with its phrase and details` | the blocked reason text | `the plan readiness reached its limit of failures in a row (3)` |
| same | state | `change-state AC-4 state: S1 to S8 each give their state` (S1) | a declared end is the state; here one recorded without `failures` | `the plan readiness reached its limit of failures in a row (3)`; the declared params stay `{ stage, attempt: 3 }` (pins the fallback) |
| `project-loop.test.mjs` | the CLI | `project-loop next: S12 a review at its ceiling ends blocked` | a slice at its ceiling ends blocked | the regex becomes `/reached its limit of failures in a row \(2\)/` |
| `roadmap-loop.test.mjs` | decide | `roadmap-loop decide: per change N7 a blocked end is blocked with its own reason, and no action` and the fillers test | the roadmap line of a blocked change | kept: `say(...)` renders the same template, and `{ attempt: 3 }` renders through the fallback |

### D-10 Release

devkit-openspec takes a patch bump in `plugins/openspec/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`, the marketplace `metadata.version` its patch too, one
`CHANGELOG.md` entry, the CI pin in `docs/openspec-flow.md` and its assertion in
`change-loop docs: the design records the answers` (`change-loop.test.mjs`) moved to the new
devkit-openspec version, and `docs/catalog.md` regenerated. The numbers are the next free ones on
`origin/main` at the last merge before review, never the ones read today.

## Implementation plan

Dependency order: the reader and the count (pure, then git) → the walk's params → the sentences →
the loops → documents → release → proof.

**Per surface**

- devkit-openspec hooks: `flow-check.mjs` (D-1 to D-6), `change-loop.mjs` (D-6), `project-loop.mjs`
  (D-6). No backend, frontend or worker surface exists in this repository.
- Docs: `docs/openspec-flow.md`, `plugins/openspec/README.md`, `docs/coordination-design.md`,
  `CHANGELOG.md`, `docs/catalog.md` (generated), `openspec/roadmap.md`.

**File structure**

- Modify: `plugins/openspec/hooks/flow-check.mjs`, `plugins/openspec/hooks/flow-check.test.mjs`,
  `plugins/openspec/hooks/version-pin.test.mjs`, `plugins/openspec/hooks/change-loop.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/project-loop.mjs`,
  `plugins/openspec/hooks/project-loop.test.mjs`, `docs/openspec-flow.md`,
  `plugins/openspec/README.md`, `docs/coordination-design.md`, `CHANGELOG.md`, `docs/catalog.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `openspec/roadmap.md`.
- Create: `openspec/changes/stage-ceiling-consecutive/proof/` (red runs and `real-run.txt`).
- Delete: none.

**Estimate**: optimistic 5 h, likely 8 h, pessimistic 13 h (the pessimistic case is two full-suite
runs on the loaded machine and one re-merge for the release number).

| Component | Hours | Type | Risk |
|---|---|---|---|
| `stageHistory` and `failuresInARow` (D-2, D-3) | 1.5 | Core | LOW |
| The walk's params and the sentences in `flow-check.mjs` (D-5, D-6) | 1 | Core | LOW |
| New and updated tests of `flow-check.test.mjs`, `version-pin.test.mjs` (D-9), red proof | 2 | Testing | MEDIUM |
| `change-loop.mjs` and `project-loop.mjs` (D-6) and their tests | 1 | Integration | LOW |
| Documents (D-7) | 0.5 | Documentation | LOW |
| Release (D-10) | 0.5 | Documentation | MEDIUM |
| Real-run proof (D-8) | 1.5 | Testing | MEDIUM |

**Risks**

| Risk | P × I | Mitigation |
|---|---|---|
| A made-up passed header committed to dodge the ceiling | LOW × MEDIUM | The trust is the same as today's current header (agents write it under hooks); the reset needs a commit, which the reviews and the owner see in the pull request; with no passed header committed the count is never below `attempt` (D-3) |
| A failed take overwritten without a commit after a pass is not counted, so the count is lower than the real streak (H-5) | LOW × MEDIUM | The delivery loop's `commit` row stages every modified file under `openspec/` with the fix that follows a failure, and its `review` row commits the change folder (the evidence included) before each round (`ship-change` lines 56-57), so evidence and review takes are committed; the no-progress rule still stops a stage that comes back with nothing changed; the D-7 sentence tells the reader to commit each take; H-5 pins the behaviour so a change to it is visible |
| The `review` stage's restarting attempt is miscounted | LOW × HIGH | D-3 subtracts no attempt and counts headers in git order; H-6 is a test (AC-2) and a real run (P-9) |
| git lists the file's commits out of order (equal or skewed commit dates, merges) | LOW × MEDIUM | `--topo-order` (D-2); the AC-7 merge fixture and the fixtures' same-second commits exercise it |
| The reader is slow on a long history | LOW × LOW | Two processes, only for a failed stage with a numeric ceiling (pinned by the "read only for a failed stage" test); the log is limited to one path |
| A recorded end without `failures` breaks a reply | MEDIUM × MEDIUM | The `{failures}` fallback in `render` (D-6), pinned by `change-state AC-4 state` S1 and the AC-6 loop test |
| CI and a local run disagree (depth-1 checkout) | LOW × LOW | The `devkit-reviews` job does not run `flow-check`; `deliver-check --ci` already refuses a shallow clone; a depth-1 local clone shows no pass and falls back to today's rule (F-3) |
| The suite's 13-45 minutes on the loaded machine | HIGH × LOW | Filtered gates per phase; the whole suite once, in the last phase, as a background command |
| A sibling release takes the version first | MEDIUM × LOW | D-10: the next free numbers on `origin/main` at the last merge before review |

**Assumptions**

- `git cat-file --batch` and the `<rev>:./<path>` form behave as D-2 says on the git the project's
  machines run (both exist since git 1.7; `deliver-check.mjs` already relies on `git log`,
  `merge-tree` and `diff-tree` from the same installs).
- Every stage with a declared ceiling has one file (`readiness.md`, `evidence.md`, `review.md` in
  `plugins/openspec/schemas/*/flow.json`); a default-ceiling stage of several files (`specs`) counts
  from its failed file (D-3).
- Stage files are committed between takes in practice (`ship-change` line 56 stages every modified file under
  `openspec/` with each fix commit; line 57 commits the change folder before each review round), so H-5's lower count is rare; where it is not,
  a failed take overwritten without a commit after a pass goes uncounted (Risks).
- `attempt` is not assumed to rise by one per rewrite: the count reads only each header's `result`,
  its key (`attempt`, `commit`) for de-duplication, and git's order (D-3), so it holds for the `review`
  stage's restarting rounds as for every other writer.

**Dependencies**

- `requirements.md` (owner-confirmed assumptions) and `decisions.md` (no ADR).
- ADR 0010 decision 3 and ADR 0017 decision 1 (`docs/adr/`).
- The `post-merge-validate` roadmap line is independent: this change neither waits for it nor
  touches it.

## Risks / Trade-offs

- [An unseen take is not counted] → stated in the docs (D-7) and the spec (scenario "A take never
  committed is not counted"); with no pass visible the count is still at least `attempt`.
- [A restarting attempt (the `review` round)] → the count reads headers, not attempt numbers
  (D-3, H-6); the scenario "A restarted round does not reset the count" pins it.
- [`not-applicable` does not reset the count] → a stage that stopped applying and failed again is
  rare; resetting on it would let a stage dodge its ceiling by declaring itself not applicable once.
- [The count reads the checked-out history, not the remote's] → a fresh full clone gives the same
  count; a depth-1 one gives today's rule.
- [Outside a git repository or without git the checker exits 3, as today] → unchanged by this change
  (`deliver-check.mjs` is a CI-downloaded file left untouched); the reader's own `[]` for those cases is
  pinned by unit tests only (D-4 F-1, F-2).

## Migration Plan

None. No header, field or file changes form; a change already under way is read with the new count
on the next run. Rollback: revert the pull request; no data to migrate.
