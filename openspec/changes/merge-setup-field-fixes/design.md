<!-- devkit-stage design result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Design

Change: `merge-setup-field-fixes` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the specs of this change).

## Context

See `proposal.md` (Why) for the three field items. The code each one lives in, read at `6e803eb`
(devkit-openspec 0.18.0):

| Item | Where | What it does today |
|---|---|---|
| 9 (defect 1) | `plugins/openspec/hooks/deliver-check.mjs#main`, the `opts.watch` branch | Watches only when `nextStep(state).step` is `wait-checks` (one `gh pr checks <n> --watch --interval 30 [--required]`, cut at the cap) or `wait-merge` (`waitForMerge`). `nextStep` returns `stop-merge-setup` before the phases and the eight items whenever `merge` mode's preflight (`merge-setup.mjs#mergeSetup`) is not ok, so a change pull request with pending checks in a repository without the `devkit` ruleset never reaches `wait-checks` |
| 11 (defect 2) | `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs#render` and `#plan` | The line "the ruleset will require these checks, reported on the newest pull requests (confirm them, or pass --checks): …" prints `result.contexts`: the proposed checks without `devkit-reviews`, or "none: no pull request has a check reported yet; pass --checks" when the list is empty. `--checks ""` gives an empty list (`parseArgs` drops empty names) and skips discovery, so the line says "none" and "pass --checks" right after `--checks` was passed, above a payload that `desiredRuleset` always completes with `devkit-reviews` |
| 10 (defect 3) | `plugins/openspec/hooks/guard.mjs#readValue` | `String.prototype.match` with a non-global multiline regex: the first matching line wins. A first line that holds a template (`a | b`) gives `null` and does not fall through to a later line |

The verdict readers in the repository, found with
`git grep -ln "readValue\|'Verdict'\|Verdict:" -- '*.mjs' '*.js' '*.ts' '*.tsx' '*.py' ':!*.test.*' ':!openspec/changes'`
and read one by one:

| Reader | Code | How it reads the verdict |
|---|---|---|
| The delivery checker, item 2 (also behind `change-loop.mjs`, `flow-check.mjs` and the panel) | `deliver-check.mjs#readReviews`, `#reviewsItem` | `readValue(file, 'Verdict')` |
| The `devkit-reviews` check, `deliver-check.mjs --ci` and `guard.mjs ci` | `deliver-check.mjs#runCi` → `#reviewsItem`; `guard.mjs ci` calls `deliver-check.mjs#ciMain` | the same `readReviews` |
| The hook on `gh pr create` | `guard.mjs#prViolation` → `#reviewConsensus` | `readValue(join(rdir, f), 'Verdict')` |
| The plan audit (`audit.md`, by `plan-reality-auditor`) | `conduct-check.mjs` (the `audit` facts and `planStep`) | `readValue(auditFile, 'Verdict')` |
| The panel | `plugins/panel/hooks/register.tsx` runs `conduct-check --json --change <id>` (line 91) and `deliver-check <id> --json` (line 107) | none of its own: `git grep -n -e "Verdict" -e "reviews/" -- plugins/panel/hooks ':!*.test.tsx' ':!plugins/panel/hooks/fixtures'` prints nothing |
| The review round's file check | `plugins/core/skills/review-change/scripts/review-round.mjs#checkFileCommand` | not a reader: it compares line 1 with the verdict the round computed, and ignores the rest of the file |
| `changes-under-way.mjs` | `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs` | reads `Status:` of `readiness.md` only, no verdict |

Constraints that shape every decision below:

- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads (`docs/openspec-flow.md`, CI). No new module and no new import
  between them.
- `--ci` refuses `--watch` (`deliver-check.mjs#parseArgs`), so D-1 cannot change what the required
  check judges (ADR 0012, decision 4).
- Product code is closed until readiness is approved (the `guard.mjs` edit lock).

## Goals / Non-Goals

**Goals:**

- One mechanism per rule: one checks watch in `deliver-check.mjs`, one desired-ruleset computation
  in `github-setup.mjs`, one verdict reader (`readValue`).
- Each defect reproduced by a test on a scratch repository before its fix (AC-4), with the run
  recorded under `proof/`.
- Every existing test that pins a replaced rule is changed in the task that replaces the rule, with
  its invariant named (D-5).

**Non-Goals:**

- A wait at `stop-merge-setup` on the archive pull request (D-1, "Alternatives").
- A new `deliver-check` step, a new exit code, or a new field in the `deliver-check --json` report.
- Teaching `ship-change`, `/devkit change` (`change-loop.mjs`) or `conduct-check` to wait at
  `stop-merge-setup`: they still end `blocked: merge setup` at once.
- Changing what the review writer puts in a verdict file (round 25, `review-writer-prompt`).
- Reading only line 1 of a verdict file. The owner's rule is the first `Verdict:` line, and a file
  whose first line is not a verdict is read today; changing that is outside this change.

## D-1 The checks watch at `stop-merge-setup` (field item 9, AC-1, spec `change-delivery`)

`deliver-check.mjs` gains two functions, and its `main` uses them in place of the inline watch:

```js
// The pull request whose checks `--watch` waits on, or null: at `wait-checks` the change PR (as
// before); at `stop-merge-setup` the change PR when it is open with checks pending (field item 9).
export function checksToWatch(state, next) // -> { number, required } | null
// The single capped `gh pr checks <n> --watch --interval 30 [--required]`, killed at the cap.
function watchChecks(gh, target, minutes) // -> { minutes, timedOut }
```

- `checksToWatch` returns `{ number: state.pr.number, required: state.items[5].details.required }`
  when `next.step === 'wait-checks' && state.pr`, or when `next.step === 'stop-merge-setup'`,
  `!state.archive`, `state.pr?.state === 'OPEN'` and `(state.items[5].details.pending ?? []).length > 0`.
  It returns `null` otherwise.
- `watchChecks` is the body of today's inline branch, moved without change: the same arguments
  (`--required` when `required`), `timeout: minutes * 60000`, `killSignal: 'SIGTERM'`, and
  `{ minutes, timedOut: r.timedOut }`.
- `main`: `const target = next ? checksToWatch(state, next) : null;`. When `target` is set,
  `watch = watchChecks(gh, target, opts.watch)` and the state is collected again exactly as after
  today's `wait-checks` watch. Otherwise the `wait-merge` branch runs unchanged.

What the owner sees after the watch comes from code that already exists: `collectState` reads the
checks again, item 6's line shows their final state (met, `failing …` or `pending …`), `nextStep`
answers `stop-merge-setup` again with its `missing` list, the summary is `blocked: merge setup`,
the exit code is 2, and the human report ends with `watch: ended` or
`watch: stopped after <n> minutes`. A failing check is shown in item 6 and the step stays
`stop-merge-setup`: the stop comes first in `nextStep`. That order is not changed.

ADR 0002: without the rule that requires `devkit-reviews`, merge mode is "blocked, not downgraded".
The watch only reads; nothing enables auto-merge, and the step stays a stop.

**Alternatives.**

- *Make `nextStep` answer `wait-checks` before `stop-merge-setup`.* Rejected. It changes the step
  every caller sees (`ship-change`, `change-loop.mjs`, `conduct-check.mjs`, the panel, whose
  `NOT_IN_TABLE` lists `stop-merge-setup`), which is the "other behaviour" the requirements put out
  of scope.
- *Also wait on the archive pull request at `stop-merge-setup`.* Rejected for this change.
  `archiveReport` carries no checks for the archive pull request and `archiveNext` returns the stop
  before its checks are looked at, so the report could not show the final state (AC-1) without a new
  JSON field. `requirements.md` asks for the wait "as it does for `wait-checks`", which watches only
  the change pull request. The case comes up only when a project's first archive pull request still
  runs without the ruleset. The owner may widen the change at plan approval.
- *A second copy of the watch for the new case.* Rejected: one helper, `watchChecks`, serves both.

## D-2 The required-checks line of `github-setup.mjs` (field item 11, AC-2, spec `project-setup`)

One computation of the desired ruleset, used by the payload and by the line:

```js
// The ruleset devkit wants for `contexts`, keeping what `stored` already requires.
function wantedRuleset(contexts, stored) // -> desiredRuleset(stored ? [...new Set([...contextsOf(stored), ...contexts])] : contexts)
```

- `rulesetItem` replaces its inline `desiredRuleset(stored ? … : contexts)` with
  `wantedRuleset(contexts, stored)`. Every return after `want` is computed (`ok`, `deferred`,
  `create`, `update`) also carries `requires: contextsOf(want)`.
- `plan` takes `requires` off the ruleset item before storing it, so `items[3]` keeps today's
  fields. It sets `result.requires = rs.requires ?? contextsOf(wantedRuleset(contexts, null))`: the
  fallback covers a ruleset read that failed or was refused, and a discovery error. It also sets
  `result.checksFrom`: `'option'` when `--checks` was given, `'pull-requests'` when discovery
  answered, and `'unreadable'` when discovery failed. `result.contexts` is unchanged.
- `render` prints, in place of today's line:
  `the ruleset will require these checks (confirm them, or pass --checks): <requires joined by ", "> (<sources joined by "; ">)`.
  The sources, in this order:
  1. `devkit-reviews always`
  2. by `checksFrom`: `<contexts> reported on the newest pull requests`. With no context found:
     `no other check reported on the newest pull requests yet; pass --checks to add one`. With
     `option`: `<contexts> given with --checks`, or `no other check given with --checks` when the
     option was empty. With `unreadable`: `the newest pull requests could not be read`.
  3. the kept checks, `requires` minus `contexts` minus `devkit-reviews`, when there are any:
     `<kept> already required by ruleset devkit`.

  The field case, `--checks ""` with no ruleset yet, prints:
  `the ruleset will require these checks (confirm them, or pass --checks): devkit-reviews (devkit-reviews always; no other check given with --checks)`.
- Exit codes, items, states, payloads and the writes under `--apply` are unchanged.

`plugins/openspec/skills/openspec-setup/SKILL.md`, step 7: the sentence on the proposed checks says
that the printed list adds `devkit-reviews`, which the ruleset always requires, and any check the
existing ruleset already requires, and names the JSON field `requires`.

**Alternatives.** Keep the line and only drop the "none" text. Rejected: the list would still leave
out `devkit-reviews`, the one check the owner most needs to see before confirming. Put
`devkit-reviews` into `contexts`. Rejected: `contexts` is the proposed list that `--checks` replaces
and that the "proposed required checks" requirement defines without `devkit-reviews`; five tests
pin it (D-5).

## D-3 The first `Verdict:` line (field item 10, AC-3, spec `verdict-files`)

Every reader goes through `guard.mjs#readValue` (the table in Context), and `readValue` already
returns the first match. No production code changes for this item: what is new is a test per
reader, each with two disagreeing `Verdict:` lines, both orders:

- `guard.test.mjs`: `readValue` directly; `reviewConsensus`; the hook on `gh pr create` through
  the existing `bash(root, 'gh pr create …')` harness.
- `deliver-check.test.mjs`: item 2 through `collectState`/`deliver-check.mjs <id>` (the `review()`
  fixture with a second `Verdict:` line in its `extra` text, after a blank line and a `### Findings`
  heading); the `devkit-reviews` check through `bothEntries` (`deliver-check.mjs --ci` and
  `guard.mjs ci`), using `ciRepo`/`ciProve` with one reviewer file rewritten and committed.
- `conduct-check.test.mjs`: the plan audit through `auditMd`-style content with
  `- Verdict: ACCURATE` then `- Verdict: OUTDATED`, and the reverse, read by `conduct-check`'s
  round (`planStep`).

Each test also asserts that no output line names the second line (no message), as the owner
decided. The panel is covered by the checkers' tests (Context). If any of these tests fails on the
unchanged code, that reader is fixed to call `readValue`, and the failing run is that item's red
proof.

**Alternatives.** Make the review writer refuse a second `Verdict:` line. Rejected: the owner chose
"ignored without a message", and the writer's text belongs to round 25.

## D-4 The proof (AC-4)

Test names start with the field item, continuing the numbering of `coordinator-field-fixes`:
`field-fixes 9 watch: …`, `field-fixes 10 verdict: …`, `field-fixes 11 setup: …`. Each phase writes
its tests first and runs them on the unchanged code with
`node --test --test-name-pattern="^field-fixes <n> " <test file>`, saving the output as printed:

- `proof/red-9.txt`: the `field-fixes 9` tests failing (no watch call at `stop-merge-setup`).
- `proof/red-11.txt`: the `field-fixes 11` tests failing (the line says "none" and leaves out
  `devkit-reviews`).
- `proof/base-10.txt`: the `field-fixes 10` run on the unchanged code. Per D-3 it is expected to
  pass. If it does, the file is the record that no reader is wrong at `6e803eb`, which is what
  `proposal.md` ("Open decisions inherited") asks the owner to accept as AC-4's proof for item 10.
  If a test fails, the file is named `red-10.txt` instead.
- `proof/README.txt` lists, per defect, its test names and its proof file. The prior change used the
  same layout (`openspec/changes/archive/2026-11-21-coordinator-field-fixes/proof/README.txt`).

A run on the unchanged code that is expected to fail is a task with its own check, never a gate.

## D-5 Existing tests that pin a replaced rule

Every suite was searched for the two behaviours this plan replaces. Searches:
`grep -n "watch" plugins/openspec/hooks/*.test.mjs`,
`grep -rn "stop-merge-setup" plugins`, and
`grep -rn "will require these checks\|no pull request has a check\|found on main" plugins`.

- **`deliver-check --watch` returning at once at `stop-merge-setup`: no test pins it.** The watch
  tests (`deliver-check.test.mjs`: "CLI --watch: …", "--watch at wait-merge: …", "--watch outside
  wait-merge never polls …", "--watch at wait-merge on the archive PR …") build either a `pr`-mode
  repository (`shipRepo()`, `pendingChecks()`) or a `merge`-mode repository whose setup is complete
  (`mergeReady()`, `waiting()`, `waitingArchive()`). The `stop-merge-setup` tests ("merge setup
  stops: …", "P2: …") run without `--watch`. `conduct-check.test.mjs`'s watch tests use
  `conductState`, not `deliver-check`'s `main`. They all stay as they are and must stay green.
- **The required-checks line: three assertions in
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` pin today's wording.** Each
  is changed in task 2.2 to the D-2 wording, and its invariant stays the same:
  - "plan: check runs of each head are read across pages (--paginate) …": the human line lists every
    discovered check (`job-0, job-1` … `job-44`). The new pattern also expects `devkit-reviews` and
    the `reported on the newest pull requests` source.
  - "field-fixes 5 checks: the proposed checks are the ones reported on pull request heads …": the
    line lists `test, lint` and not `publish`. Its `$`-anchored pattern becomes the full D-2 line
    (`test, lint, devkit-reviews (devkit-reviews always; test, lint reported on the newest pull requests)`).
  - "field-fixes 5 checks: with no pull request check reported the list is empty and the plan says to
    pass --checks": `contexts` stays `[]` (unchanged assertion), and the plan still says to pass
    `--checks`. The `none: …` pattern becomes
    `no other check reported on the newest pull requests yet; pass --checks to add one`.

  The JSON `contexts` assertions in that file ("plan: contexts come from …", the 45-check test, and
  the three `field-fixes 5 checks` tests) are unchanged: `contexts` keeps its meaning.
- **The version pin:** `plugins/openspec/hooks/change-loop.test.mjs`, the docs test that asserts
  `assert.match(flow, /v0\.18\.0/, 'the CI snippet pins the current release …')`. Its invariant is
  that the CI snippet pins the current release. It changes in task 4.1 to `v0.18.1`, and a
  `doesNotMatch` for `v0.18.0` is added beside the existing ones for `v0.17.1` and `v0.16.0`. The
  `deliver-check.test.mjs` pin tests ("the pin in docs/openspec-flow.md is the commit sha …",
  "AC-8 release-ready: …") read the version from `plugin.json` and need no edit.

## D-6 Documents and release

- `docs/openspec-flow.md`:
  - the **Waiting.** paragraph: `--watch` also waits at `stop-merge-setup` when the change's open
    pull request has pending checks (setup order step 1: the first pull request, merged by hand),
    and the step stays `stop-merge-setup`;
  - the "Preparing the repository (setup order)" step 1: the same, in one clause;
  - the item-2 row of the delivery table (`reviews/*.md`): the first `Verdict:` line of each file
    counts, and a later one is ignored;
  - the "A different gate" bullet: the same, in one clause;
  - every `v0.18.0` in the CI snippet, its comment and its by-hand command (three lines) becomes
    `v0.18.1`.
- `plugins/openspec/skills/openspec-setup/SKILL.md`, step 7: D-2.
- `openspec/roadmap.md`: the round 17c line also names field item 10 (the verdict readers), so the
  line matches this change's scope.
- Release (`CONTRIBUTING.md`, step 5): devkit-openspec 0.18.0 to 0.18.1 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace from 0.22.0 to 0.22.1. A `CHANGELOG.md` section `## 0.22.1 — field fixes of 0.16.0,
  the rest` with one bullet per item and the line "The CI snippet now pins `v0.18.1`, the release's
  tag." `python3 scripts/gen-catalog.py --check` must still pass (the catalog lists no version). The sibling `roadmap-coordinator-followups` bumps the
  same pack; the release rebase settles the collision. The tag `v0.18.1` is pushed after the merge
  (Workflow follow-up).

## Decisions and ADRs

No ADR is needed. D-1 keeps ADR 0002's rule: merge mode stays blocked without the rule that requires
`devkit-reviews`, and the watch only reads. D-3 keeps ADR 0008 decision 4 (the `Verdict:` and
`Commit:` lines stay as they are) and ADR 0012 decision 4 (the check recomputes what it did). D-2
touches no decision: ADR 0002 already says the ruleset requires `devkit-reviews`. None of the
alternatives above was rejected by an ADR.

## Implementation plan

**Per surface.** Hooks (`plugins/openspec/hooks/`): `deliver-check.mjs` (D-1) and new tests in
`deliver-check.test.mjs`, `guard.test.mjs` and `conduct-check.test.mjs` (D-3). Setup skill
(`plugins/openspec/skills/openspec-setup/`): `scripts/github-setup.mjs`, its test and `SKILL.md`
(D-2). Docs and release: D-6. No backend, frontend or worker surface; the panel is unchanged.

**File structure.**

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/deliver-check.mjs` |
| modify | `plugins/openspec/hooks/deliver-check.test.mjs` |
| modify | `plugins/openspec/hooks/guard.test.mjs` |
| modify | `plugins/openspec/hooks/conduct-check.test.mjs` |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (the version pin only) |
| modify | `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` |
| modify | `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` |
| modify | `plugins/openspec/skills/openspec-setup/SKILL.md` |
| modify | `docs/openspec-flow.md`, `openspec/roadmap.md`, `CHANGELOG.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| create | `openspec/changes/merge-setup-field-fixes/proof/red-9.txt`, `red-11.txt`, `base-10.txt` (or `red-10.txt`), `README.txt` |
| delete | none |

**Estimate.** Optimistic 4 h, likely 6 h, pessimistic 9 h. The pessimistic case is a field item 10
reader that does fail, plus a red CI run under the branch variables.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 tests (`field-fixes 9`) and red run | 1.0 | Testing | LOW |
| D-1 `checksToWatch` / `watchChecks` | 0.5 | Core | LOW |
| D-1 docs (Waiting, setup order) | 0.25 | Documentation | LOW |
| D-2 tests (`field-fixes 11`) and red run | 1.0 | Testing | LOW |
| D-2 `wantedRuleset`, `requires`, `checksFrom`, the line; the three pinned assertions | 1.0 | Core | LOW |
| D-2 `SKILL.md` step 7 | 0.25 | Documentation | LOW |
| D-3 tests (`field-fixes 10`) over five readers and the base run | 1.25 | Testing | MEDIUM |
| D-3 docs (item 2 row, "A different gate") | 0.25 | Documentation | LOW |
| Proof `README.txt` | 0.25 | Documentation | LOW |
| Release: versions, CHANGELOG, doc pin, pin test, catalog, roadmap line | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The field item 10 tests pass on the unchanged code, so AC-4 has no red test for that item | HIGH × MEDIUM | Raised to the owner in `proposal.md` before approval; D-4 records the base run as `proof/base-10.txt`; the tests still pin the rule against regressions |
| A watch at `stop-merge-setup` on a pull request behind the local head waits on the old head's checks | LOW × LOW | The state is collected again afterwards: item 5 still says to push, and the stop is unchanged |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | New tests take their env from the existing fixtures (`shipRepo`, `CI_ENV`), which blank the branch variables; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| An existing test pins a replaced rule outside the list in D-5 | LOW × MEDIUM | D-5's searches covered every suite; the whole suite runs in phase 4 before any review |
| The sibling change bumps devkit-openspec too | MEDIUM × LOW | The release rebase settles it (`CONTRIBUTING.md`); this change plans its bump normally |
| The fake `gh` gives the same answer to `pr checks` with and without `--required`, so the watch tests cannot tell the two apart | MEDIUM × LOW | The new tests assert the same argument list the existing `CLI --watch` test asserts for the same fixtures, which is what "as at `wait-checks`" means |

**Assumptions.**

- A-1: `nextStep` returns `stop-merge-setup` before `implement` and the items, so a change pull
  request in a repository without the ruleset sits at that step whatever its checks are
  (`deliver-check.mjs#nextStep`, read at `6e803eb`). If it did not, the field case would already
  reach `wait-checks`.
- A-2: the change pull request's item 6 is computed (with `pending`) even when the step is a stop
  (`deliver-check.mjs#collectState` builds every item before `nextStep` runs).
- A-3: every verdict reader goes through `readValue` (Context table; the `git grep` there is the
  check).
- A-4: `--checks ""` reaches `plan` as an empty list and skips discovery (`github-setup.mjs#parseArgs`,
  `#plan`).

**Dependencies.** `coordinator-field-fixes` (archived 2026-11-21, devkit-openspec 0.17.0): the
pull-request-based check discovery and the `github-setup` states that D-2 builds on, and the
`field-fixes` test naming that D-4 continues. ADR 0002, 0008 and 0012 as cited.

## Migration Plan

Nothing to migrate. A project gets the new wait and the new setup line when it updates
devkit-openspec. Its pinned `devkit-reviews` workflow behaves the same before and after (D-1
touches only `--watch`, and D-3 changes no code). Rollback: revert the change pull request. No file
format or JSON field is removed, so nothing that reads the outputs breaks.
