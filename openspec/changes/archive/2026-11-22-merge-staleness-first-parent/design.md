<!-- devkit-stage design result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Design

Change: `merge-staleness-first-parent` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, `specs/change-delivery/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `2300f84` (devkit-openspec 0.18.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/deliver-check.mjs#staleness` | After the checks on the `Commit:` line itself (uncommitted mark, dirty tree, no head, resolves, ancestor of `HEAD`), walks `git rev-list <recorded>..HEAD` and, for each commit, lists its files with `git diff-tree -m -r -z --root --name-only --no-commit-id <c>`. The first path outside `openspec/` gives `<short> is behind <c short>, which touches <path>`; none gives null. `-m` makes a merge list its files against each parent in turn |
| Callers of `staleness` | `readReviews` (item 2), `tasksItem` (item 1, `evidence.md`), `acceptanceItem` (item 4, `evidence.md`) in `deliver-check.mjs`; the `staleness` fact of `flow-check.mjs#collectFlow` (line 265), which the code-bound stages (`unit-tests`, `e2e-tests`, `evidence`, `review`) read; `deliver-check.mjs --ci` and `guard.mjs ci`, which run items 1 to 4 |
| `docs/openspec-flow.md` | "The `Commit:` staleness rule" paragraph (current when "every later commit touches only `openspec/`"); the `update-branch` row of "What `ship-change` runs" ("the update brings base commits, which makes older reviews stale and re-runs them"); the CI snippet pinned at `v0.18.1` (three lines) |

The defect, reproduced on a scratch repository while planning: `main` at a base commit, branch
`feat` with one product commit (the recorded commit), `main` then gains one `openspec/` file, and
`feat` merges `main` with `--no-ff`. `git diff-tree -m -r --name-only <merge>` prints
`openspec/other.md` and `src/a.ts` (the second against the `main` parent), so the record reads
stale. `git diff --name-only <merge>^1 <merge>` prints `openspec/other.md` only.

Constraints:

- `deliver-check.mjs` is one of the three files a project's `devkit-reviews` workflow downloads
  (`guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`; `docs/openspec-flow.md`, CI section). No new
  module and no new import.
- The CI snippet checks out the PR head with `fetch-depth: 0`, so every parent the walk asks for
  is present.
- Product code is closed until readiness is approved (the `guard.mjs` edit lock).

## Goals / Non-Goals

**Goals:**

- One place decides which files a commit counts as touching: a single helper inside
  `deliver-check.mjs`, used by the walk in `staleness()`. No second copy in `flow-check.mjs`.
- Each guard condition and each label of the new branch has its own test, negative cases included
  (D-3).
- Every existing test that pins the replaced rule is found and named with its invariant (D-4); none
  is edited (AC-4).

**Non-Goals:**

- Changing the walk (`rev-list <recorded>..HEAD` stays; no `--first-parent`).
- Changing the reason text, the dirty-tree rule, the ancestor rule or any caller.
- Changing `plugins/core/skills/review-change/SKILL.md`. Its line "a commit after it touched anything
  outside `openspec/`" stays true under the new reading (a merge now "touches" what it brought in),
  and changing it would bump devkit-core for no behaviour change.

## D-1 The rule (AC-1 to AC-4, spec `change-delivery`)

`plugins/openspec/hooks/deliver-check.mjs` gains one helper, next to `staleness`:

```js
// The paths commit `c` counts as touching: a merge (more than one parent) against its first
// parent, what it brought into the branch; any other commit as before (merge-staleness-first-parent).
function touchedPaths(root, c, parents) // -> string[]
```

- `staleness()` walks `git rev-list --parents <full>..<head>` in place of `git rev-list
  <full>..<head>`. Each line is `<c> [<parent> ...]`; the order of commits is the same, so the first
  commit reported is the same as today for every history without a merge.
- `touchedPaths(root, c, parents)`:
  - when `parents.length > 1`: `git diff-tree -r -z --name-only --no-commit-id <parents[0]> <c>`
    (`parents[0]` is `<c>^1`), split on NUL;
  - otherwise (one parent, or none for a root commit): today's command, unchanged,
    `git diff-tree -m -r -z --root --name-only --no-commit-id <c>`.
- The rest of the loop is unchanged: the first path for which `isOpenspec` is false gives
  `${short} is behind ${c.slice(0, 7)}, which touches ${product}`.
- The comment above `staleness` says that a merge counts what it brought in (its first-parent diff)
  and that every commit in the range is still checked; the `-m` comment in the loop goes.

What the owner sees: after `gh pr update-branch` that brings only `openspec/` files, items 1, 2 and
4 of `deliver-check` and the `evidence`/`review` stages of the stage readout stay as they were. When
the base brings product code, the reason names the merge commit (it is `HEAD`, the first commit the
walk prints) and the first product path it brought, as before.

Why the rule leaves no gap. A file outside `openspec/` whose content at the merge differs from the
branch before it is in the first-parent diff, whether it came from the base, from a resolution, or
from a move. A commit of the base that changed product code and was later undone is still in
`<recorded>..HEAD` and judged on its own files. A shallow history where a parent is missing makes
`rev-list --parents` print the commit with no parent, so it takes the root path and lists every
file: stale, the safe side.

**Alternatives.**

- *`rev-list --first-parent`.* Rejected by the owner (requirements, Out of scope): the base's
  commits would no longer be checked one by one.
- *Judge only the files the change itself touches.* Rejected by the owner (question 1): product
  code from the base keeps making the record stale.
- *Keep `-m` and drop the paths that equal the second parent.* Rejected: it is the first-parent
  diff computed the long way, and an octopus merge would need one pass per parent.
- *A `git rev-parse --verify <c>^2` call per commit to find merges.* Rejected: one extra process per
  commit, where `rev-list --parents` gives the parents in the call the walk already makes.

## D-2 The diff command: `diff-tree` with two trees, not `git diff`

`requirements.md` names `git diff --name-only -z <c>^1 <c>`. The plan uses
`git diff-tree -r -z --name-only --no-commit-id <c>^1 <c>`: the same comparison (first parent
against the merge), through the plumbing command.

- `git diff` detects renames by default (`diff.renames`, on since Git 2.9) and prints only the new
  path of a move. Checked while planning on a scratch repository: a merge that moves `src/a.ts` to
  `openspec/a.md` gives `openspec/a.md` alone with `git diff --name-only`, so the record would read
  current with product code gone from `src/`. `git diff-tree` does no rename detection unless asked
  and prints both `openspec/a.md` and `src/a.ts`.
- `git diff-tree` is what the walk already runs, and it reads no porcelain setting
  (`diff.renames`, `diff.relative`) from a project's or a person's Git config.
- `dirtyPaths` already counts a rename's source path; this keeps the same rule for commits.

Test `merge-staleness 4` (D-3) pins it. `proposal.md` ("Open decisions inherited") records the
refinement for the owner at approval.

## D-3 The tests (AC-1 to AC-4)

Every new test's name starts `merge-staleness <n>: `, so
`--test-name-pattern="^merge-staleness "` selects them all. In
`plugins/openspec/hooks/deliver-check.test.mjs`, under the "staleness and item 2" section, with the
section's fixtures (`base()`, `head()`, `stale()`, `review()`, `reviews()`, `withReviews()`,
`put()`, `commitAll()`, `git()`). Each test builds this history unless it says otherwise: `base()`
on `main`; `git switch -q -c feat`; `src/a.ts` changed and committed (the product commit, `R`);
both required reviews (`withReviews(reviews(R))`) and `openspec/changes/feat/evidence.md` holding
`Commit: <R>` committed (an `openspec/` commit); `git switch -q main`; the base's commits as the test
says; `git switch -q feat`; the merge as the test says. "Exact reason" means `assert.equal` on the
whole string.

| Test | Guard or label | Base's commits | The merge | Expected | AC |
|---|---|---|---|---|---|
| `merge-staleness 1: a merge of main that brings only openspec/ into a branch with product commits before the record is current` | merge, nothing outside `openspec/` brought (positive) | `openspec/changes/other.md` | `git merge -q --no-ff -m "merge main" main` | `stale(root, R)` is null; `reviewsItem(root, 'feat')` is `met` with `details.stale` `[]`; `tasksItem` and `acceptanceItem` give `details.evidence` `current`. Fixture check: `git diff --name-only HEAD^2 HEAD` lists `src/a.ts` (the history that broke `-m`) | AC-1 |
| `merge-staleness 2: a merge of main that brings a product file is stale and names it` | merge, product file brought (negative) | `src/base.ts` | as 1 | exact reason `<R7> is behind <merge7>, which touches src/base.ts`; `reviewsItem` lists both reviewers in `details.stale`; `tasksItem` gives `details.evidence` `stale` | AC-2 |
| `merge-staleness 3: a merge commit that changes a product file while resolving is stale and names it` | merge, product edit in the resolution (negative) | `openspec/changes/other.md` | `git merge -q --no-ff --no-commit main`, then `src/a.ts` edited, staged by name and committed | exact reason `<R7> is behind <merge7>, which touches src/a.ts` | AC-3 |
| `merge-staleness 4: a merge that moves a product file under openspec/ is stale and names the old path` | merge, move out of product (D-2) | `openspec/changes/other.md` | `git merge -q --no-ff --no-commit main`, then `git mv src/a.ts openspec/a.md`, committed | exact reason `<R7> is behind <merge7>, which touches src/a.ts` | AC-3 |
| `merge-staleness 5: a product commit the merge brings in is stale even when the merge itself brings only openspec/` | the walk still checks each brought commit (negative) | `X` adds `src/base.ts`; `Y` removes it and adds `openspec/changes/other.md` | as 1 | the reason matches `^<R7> is behind (<X7>\|<Y7>), which touches src/base\.ts$` and does not hold `<merge7>`; fixture check: `git diff --name-only HEAD^1 HEAD` lists only `openspec/changes/other.md` | AC-2 |
| `merge-staleness 6: a merge whose first parent is the base is read against that parent` | merge, first parent not the branch (negative, requirements assumption 4) | `openspec/changes/other.md`; then on `main`, `git merge -q --no-ff -m "merge feat" feat` | none on `feat`: `git switch -q -C feat main` moves the branch onto that merge | exact reason `<R7> is behind <merge7>, which touches src/a.ts` | AC-2 |
| `merge-staleness 7: a root commit a merge brings in is judged by its own files` | no parent (root) keeps `--root` (negative) | none; an orphan branch `other` (`git switch -q --orphan other`, which starts with an empty tree) commits `src/x.ts` and `openspec/y.md` as its root `O` | on `feat`: `git merge -q --no-commit --allow-unrelated-histories other`, `git rm -q -f src/x.ts`, committed | exact reason `<R7> is behind <O7>, which touches src/x.ts`; fixture check: `git diff --name-only HEAD^1 HEAD` lists only `openspec/y.md` | AC-4 |
| `merge-staleness 8: a plain product commit after an openspec-only merge is still stale` | one parent after a merge (negative) | `openspec/changes/other.md` | as 1; then `stale(root, R)` is null; then `src/a.ts` changed again and committed (`P`) | exact reason `<R7> is behind <P7>, which touches src/a.ts` | AC-4 |

In `plugins/openspec/hooks/flow-check.test.mjs`, under "fixtures over a real repository", with
`liveChange()` (ship `plan`, so nothing is read from GitHub), `fakeOpenspec()`, `fakeGh()`,
`SHIP_ENV`, `collectFlow` and `computeFlow`, built as the test "flow-check delivery: a merged pull
request seen from the change's own branch keeps the staleness checks" builds them: `liveChange()`;
`git switch -q -c feat`; `src/a.ts` committed (`R`); the `commit=` of the stage headers of
`evidence.md` and `review.md` rewritten to `R` and committed; `git switch -q main`; the base's
commit; `git switch -q feat`; `git merge -q --no-ff -m "merge main" main`.

| Test | Base's commit | Expected | AC |
|---|---|---|---|
| `merge-staleness 9: the stage readout keeps evidence and review passed after a merge of main that brings only openspec/` | `openspec/changes/other/notes.md` | the `evidence` and `review` stages are `passed` | AC-1 |
| `merge-staleness 10: the stage readout reports evidence stale after a merge of main that brings a product file` | `src/base.ts` | the `evidence` stage is `stale` with `reasonCode` `stale-code`, and `next.stage` is `evidence` | AC-2 |

Tests 9 and 10 live in the flow-check suite because the stage readout's fixtures (`liveChange`,
`fakeOpenspec`) live there and that suite owns the readout; every case of `staleness()` itself is
in the deliver-check suite, as `requirements.md` says. The guard suite imports both files, so the
whole-suite gate runs all ten.

Every new test takes its git env from the file's existing helpers (`git()` with `GIT_ENV`; the
flow tests' `{ ...gh.env, ...SHIP_ENV }`), which blank the branch variables.

**Test first.** Task 1.1 writes the ten tests and runs
`node --test --test-name-pattern="^merge-staleness " plugins/openspec/hooks/flow-check.test.mjs`
(which loads the deliver-check suite too) on the unchanged code, saving the output as printed to
`openspec/changes/merge-staleness-first-parent/proof/red.txt`. Expected, from how `-m` lists a
merge against its first parent and then its second:

- fail: 1 and 9 (the defect itself), 8 (its `null` step is the defect), 5 and 7 (today the merge's
  second-parent list names the merge and `src/a.ts` before the walk reaches the base's or the
  root's commit);
- pass: 2, 3, 4, 6 and 10, whose product path is already in the merge's first-parent list, which
  `-m` prints first. They pin guards the new code must keep.

That run is the task's check, never a gate. A test whose result differs from this list is looked at
before the fix: either the fixture does not build the history the table says, or the analysis is
wrong, and `design.md` is corrected in the same task.

## D-4 Existing tests that pin the replaced rule

Every suite was searched for tests that build a merge commit or pin `-m`:
`git grep -n "'merge', '\|--no-ff\|diff-tree\|each parent" -- '*.test.mjs' '*.test.tsx' '*.test.ts' '*.py'`
and `git grep -n "^test(.*\(stale\|current\)" -- '*.test.mjs'`. None is edited.

- `plugins/openspec/hooks/deliver-check.test.mjs`, "staleness: a merge from the base branch that
  brings product code is stale; openspec-only is current". Invariant: a merge of the base that
  brings a product file makes the record stale, and one that brings only `openspec/` keeps it
  current. Its branch has no product commit after the branch point, so `-m` against the `main`
  parent lists only `openspec/` files and the test passes today and after the change. It stays as
  it is; tests 1 and 2 add the history it does not build.
- `plugins/openspec/hooks/deliver-check.test.mjs`, the one-parent staleness tests: "staleness: the
  head, and later commits touching only openspec/, are current (AC-7)", "staleness: a later commit
  touching src/ or openspecx/ makes it stale (AC-7)", "staleness: a commit mixing openspec/ and src/
  is stale", "staleness: an unresolvable, non-ancestor or non-sha value is stale", "staleness:
  uncommitted work outside openspec/ and .claude/ makes everything stale", and the item tests that
  read them ("item 2: …", "item 1: missing or stale evidence is open", "item 4: missing or stale
  evidence is open", "AC-4 no-mutual-staleness: …", "--ci: a product commit after the reviews makes
  them stale and fails with exit 1 (AC-5)"). Invariant: one-parent commits and the `Commit:` line
  checks give the same answer and reason. They are AC-4's proof.
- `plugins/openspec/hooks/deliver-check.test.mjs`, "walkthrough (merge): …": merges with
  `--ff-only`, so no merge commit is made. Unaffected.
- `plugins/openspec/hooks/guard.test.mjs`, "ci mode runs the devkit-reviews check: current reviews
  and evidence pass, a later product commit makes them stale, bypass is ignored (AC-5)". Invariant:
  `guard.mjs ci` reads currency through the same rule. One-parent history. Unaffected.
- `plugins/openspec/hooks/flow-check.test.mjs`: the stage tests that pass a synthetic `staleness`
  fact ("flow-check stages: a stale stage is the only one offered again", "flow-check stages:
  staleness is read for every file of a stage, not the first", and the rows that build facts with
  `staleness: (sha) => …`) do not reach git. The real-repository tests ("flow-check delivery: a
  merged pull request seen from the change's own branch keeps the staleness checks", "field-fixes 4
  delivered: a pull request that only links the evidence does not switch to the walk after the
  merge", "flow-check stages: a code-bound stage whose header records no commit is stale") make
  headers that do not resolve or record no commit. Invariant: the readout reports what
  `staleness()` answers. Unaffected.
- `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs`, "field-fixes 7
  upgrade: …": two worktrees merge `main` (`git merge -q --no-edit main`). Invariant: after the
  schema upgrade the started change is not stopped for a plan approval and the plan-ready one is,
  once. It asserts steps that a review's or the evidence's currency does not decide
  (`stop-plan-approval` comes before the delivery items). Unaffected.
- `plugins/openspec/hooks/change-loop.test.mjs`, the docs test asserting
  `assert.match(flow, /v0\.18\.1/, 'the CI snippet pins the current release (merge-setup-field-fixes: 0.18.1)')`.
  Invariant: the CI snippet pins the current release. Not a staleness test; it changes with the
  release in task 2.1 (D-5).

## D-5 Documents and release

- `docs/openspec-flow.md`:
  - "The `Commit:` staleness rule": after "every later commit touches only `openspec/`", one
    sentence: a merge commit counts the files that differ between its first parent and itself
    (what it brought into the branch, edits made while resolving and moved files included), and
    the commits it brings in are still checked one by one; so an update of the branch that brings
    only `openspec/` files leaves reviews and evidence current.
  - The `update-branch` row: "the update brings base commits, which makes older reviews stale and
    re-runs them" becomes "the update brings base commits; when they or the merge change a file
    outside `openspec/`, the older reviews and evidence go stale and run again, and an update that
    brings only `openspec/` files leaves them current".
  - Every `v0.18.1` of the CI snippet, its comment and its by-hand command (three lines) becomes `v0.18.2`.
- `plugins/openspec/hooks/change-loop.test.mjs`: the pin assertion becomes `v0.18\.2` with the
  message `(merge-staleness-first-parent: 0.18.2)`, and a `doesNotMatch` for `v0\.18\.1` is added
  beside the existing ones (D-4).
- Release (`CONTRIBUTING.md`, step 5): devkit-openspec 0.18.1 to 0.18.2 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the
  marketplace from 0.22.1 to 0.22.2, and a `CHANGELOG.md` section
  `## 0.22.2 — merge staleness by the first parent`: one **devkit-openspec** 0.18.2 bullet (a merge
  commit counts what it brought into the branch; the commits it brings in are still checked; an
  update of the branch that brings only `openspec/` files leaves reviews and evidence current; "The
  CI snippet now pins `v0.18.2`, the release's tag.") and one Docs bullet (the staleness rule and
  the `update-branch` row). `python3 scripts/gen-catalog.py --check` must still pass. The tag
  `v0.18.2` is pushed after the merge (Workflow follow-up).
- `openspec/roadmap.md`: unchanged; the archive ticks the round 17d line.

## Decisions and ADRs

No ADR is needed. The change refines how one checker reads a merge commit; it keeps every recorded
decision:

- ADR 0002: the `devkit-reviews` check still recomputes review currency at the PR head, and its
  Consequence "strict up-to-date re-runs stale reviews after each base update" stays true: a base
  update that brings product code still makes them stale. None of ADR 0002's rejected alternatives
  is taken.
- ADR 0008 decision 4: the `Verdict:` and `Commit:` lines and the writer rules stay as they are.
- ADR 0012 decision 4: the check recomputes reviews, findings, gates and acceptance proof at the PR
  head, as before.

The alternatives rejected in D-1 were rejected by the owner's answers, not by an ADR.

## Implementation plan

**Per surface.** Hooks (`plugins/openspec/hooks/`): `deliver-check.mjs` (D-1, D-2), new tests in
`deliver-check.test.mjs` and `flow-check.test.mjs` (D-3), the pin assertion in
`change-loop.test.mjs` (D-5). Docs and release: D-5. No backend, frontend, worker or panel surface.

**File structure.**

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/deliver-check.mjs` (`staleness`, new `touchedPaths`) |
| modify | `plugins/openspec/hooks/deliver-check.test.mjs` (tests 1 to 8 added) |
| modify | `plugins/openspec/hooks/flow-check.test.mjs` (tests 9 and 10 added) |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (the pin assertion only) |
| modify | `docs/openspec-flow.md`, `CHANGELOG.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| create | `openspec/changes/merge-staleness-first-parent/proof/red.txt` |
| delete | none |

**Estimate.** Optimistic 2 h, likely 3 h, pessimistic 5 h. The pessimistic case is a fixture whose
merge does not build the history the table says (checked by the fixture assertions) plus a red run
under the CI branch variables.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Tests 1 to 8 (deliver-check suite) and the red run | 1.0 | Testing | LOW |
| Tests 9 and 10 (flow-check suite) | 0.5 | Testing | MEDIUM |
| `touchedPaths` and the `rev-list --parents` walk | 0.25 | Core | LOW |
| `docs/openspec-flow.md` staleness rule and `update-branch` row | 0.25 | Documentation | LOW |
| Release: versions, CHANGELOG, three doc pins, pin test, catalog check | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The rule reads a record current while product code changed (a hole in the first-parent reading) | LOW × HIGH | D-1 "Why the rule leaves no gap"; tests 2 to 8 each pin one way product code can arrive (brought, resolved, moved, brought and undone, merged on the base, root of another history, plain commit after) |
| An implementation with `git diff` folds a move into its new path | MEDIUM × HIGH | D-2 chooses `diff-tree`; test 4 fails on a `git diff` implementation |
| A project's `devkit-reviews` workflow keeps the old rule until its pin moves | HIGH × LOW | The CHANGELOG and the CI snippet name `v0.18.2`; the old rule is stricter, never looser, so nothing merges that should not |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | New tests use the files' existing env helpers; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| An existing test pins the replaced rule outside D-4's list | LOW × MEDIUM | D-4's searches covered every suite; the whole suite runs in phase 2 before any review |
| A sibling change bumps devkit-openspec too | MEDIUM × LOW | The release rebase settles it (`CONTRIBUTING.md`); this change plans its bump normally |
| `rev-list --parents` prints a different order from `rev-list` | LOW × MEDIUM | Both use the same default walk; AC-4's existing tests assert the commit each reason names |

**Assumptions.**

- A-1: every caller reads currency through `staleness()` (Context table; `git grep -n "staleness("
  -- plugins ':!*.test.*'` is the check). If one did not, AC-1 would not hold for it.
- A-2: a merge commit's first parent is the branch it was made on for `gh pr update-branch` and for
  `git merge` run on the branch (Git's documented parent order). Requirements assumption 4 covers
  the other case.
- A-3: the CI snippet's `fetch-depth: 0` (`docs/openspec-flow.md`, CI section) gives every parent
  the walk reads; a shallow history fails stale (D-1).
- A-4: `git diff-tree` with two tree-ish arguments does no rename detection unless `-M` is given
  (checked on Git 2.50.1 while planning, D-2).

**Dependencies.** `merge-setup-field-fixes` (archived 2026-11-21, devkit-openspec 0.18.1): the
version this change bumps and the retro item it answers. ADR 0002, 0008 and 0012 as cited.

## Migration Plan

Nothing to migrate: no file format, JSON field or exit code changes. A session gets the new rule
when it updates devkit-openspec; a project's `devkit-reviews` workflow gets it when its pin moves
to `v0.18.2`. Rollback: revert the change's pull request; the old rule is stricter, so a revert
only makes more records stale.
