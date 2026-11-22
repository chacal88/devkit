<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `project-phases-followups` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, `specs/reviews-check/spec.md`,
`specs/project-definition/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `c561553` (devkit-openspec 0.21.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/guard.mjs#sliceProblems` (lines 208 to 262) | Judges an archived slice folder. Per record: missing, `parseStageHeader` null (`has no stage header on its first line`), `{ malformed }` (`has a malformed stage header`), wrong stage, wrong result. The verdict: missing file, `Verdict` not `APPROVED`/`DECLINED`, no `Commit:` line, then `rev-parse --verify <sha>^{commit}` (`does not resolve to a commit`), `merge-base --is-ancestor` (`is not an ancestor of HEAD`), `sliceReviewStale`. `parseCommitLine` returns `{ sha, uncommitted }`; `uncommitted` is never read. Then `merge-base <base> <head>` and `diff <base>...<head>` in one `try`, whose `catch` names `<base> is not available to compare the slice with; fetch the full history` |
| `guard.mjs#sliceReviewStale` (lines 193 to 205) | Walks `rev-list <sha>..<head>`; each commit's paths against its first parent (`commitPaths`); the first path under `docs/design/<slice>/`, `docs/adr/` or `docs/decisions/` gives `the ADR review is behind <short>, which changes <path>`. Its comment says only that a merge bringing none of those files keeps the review current |
| Callers of `sliceProblems` | `deliver-check.mjs#archivePrCheck` (line 1582; both CI entries, `deliver-check.mjs --ci` and `guard.mjs ci`), and the `gh pr create` branch of `guard.mjs` (line 697) with `defaultRef(root)` as base |
| `deliver-check.mjs#archivePrCheck` / `archiveChanges` (line 866) | Before any slice is judged: no `origin/<base>`, or no merge base with `HEAD`, throws a usage error (exit 3, `... fetch the full history`). So the CI entries never reach `sliceProblems`' own "not available" branch |
| `plugins/openspec/hooks/project-loop.mjs#readVerdict` (lines 64 to 72) | `{ exists, word, sha, full, uncommitted, isHead, usable }`; `usable` is `word && commit && full`, so a marked verdict is usable |
| `project-loop.mjs#decideSlice` | Active slice (`reviewPart`, line 207) and archived slice (`archivedPart`, lines 221 and 222): a usable verdict for `HEAD` not yet in `review.md` is recorded (`record-review` session action); an unusable one, a stale one, or no passed `review.md` hands the review to `devkit-core:adr-reviewer` |
| `project-loop.mjs#recordReviewCommand` (lines 523 to 544) | Refuses with exit 2, `result: 'verdict-unusable'`, `why` `no-verdict-file`, `no-verdict`, `no-commit`, `other-commit`; else writes `review.md` |
| `plugins/openspec/hooks/change-loop.mjs#MESSAGES` | `verdict-unusable` and its `why.*` codes in `en` (lines 263 to 266) and `pt-BR` (lines 439 to 442); `render` resolves `{why}` to `why.<code>` |

Reproduced while planning on a scratch slice built as the test helper `sliceRepo` builds it (the
scratchpad, nothing in the tree): an ADR verdict `Commit: <docSha> (uncommitted changes)` gives
`slice billing: passed the slice contract` and exit 0 from `deliver-check.mjs --ci`; with
`origin/main` moved to a root commit that shares no history, `deliver-check.mjs --ci` exits 3
(`origin/main and HEAD share no history`) and the `gh pr create` hook exits 2 with `origin/main is
not available to compare the slice with; fetch the full history`; `sliceProblems(root, folder,
{ base: 'origin/nope' })` returns exactly that one problem for `origin/nope`.

Constraints:

- `guard.mjs` is one of the three files a project's `devkit-reviews` workflow downloads
  (`docs/openspec-flow.md`, CI section): no new import.
- Product code (`plugins/`) is closed until readiness is approved (the `guard.mjs` edit lock).
- Every new test takes its env from the file's helpers (`ENV` with `BLANKS`; `ciEnv` for the CI
  entries), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`,
  `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` before setting what the test needs.

## Goals / Non-Goals

**Goals:**

- One rule for the uncommitted marker across the three places a slice's verdict is read: the
  contract, `record-review` and `next`, each with its own test.
- Each fail-closed branch of `sliceProblems` that has no test gets one, through the entry that
  reaches it.
- No existing test is edited, except the CI pin assertion of the release (D-5, D-7).

**Non-Goals:**

- Changing `parseCommitLine`, `parseStageHeader`, `commitPaths` or the walk of `sliceReviewStale`.
- Making the CI entries reach `sliceProblems` with no base (they stop earlier with exit 3, by
  design of `archiveChanges`; unchanged).
- Changing `plugins/core/agents/adr-reviewer.md`: it already writes the marker in the shape the
  checkers read.

## D-1 The slice contract refuses the uncommitted marker (AC-4, spec `reviews-check`)

In `guard.mjs#sliceProblems`, inside the branch where `parseCommitLine` returned a line, the first
test becomes the marker; the existing chain follows unchanged:

- `recorded.uncommitted` → `reviews/adr-reviewer.md: Commit ${short} was recorded with uncommitted
  changes` (the wording of `deliver-check.mjs#staleness`, line 204, with the file prefix every other
  verdict problem of `sliceProblems` carries);
- else unresolved → `does not resolve to a commit`; else not an ancestor; else `sliceReviewStale`.

One problem per `Commit:` line, as today. The marker comes first, as in `staleness()`: a verdict
recorded over uncommitted work judges no commit, whatever sha it names, so the marker on a sha that
does not resolve is named as the marker (test 6 pins both). Both CI entries and the hook follow with
no change of their own, since all three call `sliceProblems`.

**Parsers.** The plan writes and moves no parser. It pins what today's parsers answer for
unterminated or odd input: an empty record and a header on line 2 have no stage header (a first
line that does not start with `<!-- devkit-stage` is not a header); a header with no closing `-->`
is malformed (`STAGE_HEADER` is anchored at both ends); a `Commit:` line under a heading is not read
(`parseCommitLine` stops at the first heading), which the existing test "an ADR verdict with no
Commit line is named" covers for the missing line.

**Alternatives.**

- *Treat the marker as stale inside `sliceReviewStale`.* Rejected: that function judges later
  commits and is shared with the loop's archived branch, which already skips it for an unusable
  verdict (D-2); the marker is a property of the verdict line, judged where the line is read.
- *Name the marker as well as the other problems of the same line.* Rejected: every other verdict
  check is one problem per line, and `staleness()` returns the first reason.

## D-2 The loop treats the marked verdict as unusable (AC-4, spec `project-definition`)

`project-loop.mjs`:

- `readVerdict`: `usable` becomes `Boolean(word && commit && full && !commit.uncommitted)`; the
  `uncommitted` field stays. Effect, with no other change to `decideSlice`: in `reviewPart` the
  verdict is not recorded and `reviewAgent` hands the review to `devkit-core:adr-reviewer`; in
  `archivedPart` `!v.usable` hands it back the same way; the archived facts skip
  `sliceReviewStale` for it, as for any unusable verdict.
- `recordReviewCommand`: after the `no-commit` refusal and before `other-commit`, `if
  (v.uncommitted) return unusable('uncommitted')`. Exit 2, `result: 'verdict-unusable'`, nothing
  written. The order matches D-1: a marked verdict is refused as marked even when it names another
  commit (test 8 pins both).

`change-loop.mjs#MESSAGES`, beside `why.other-commit` in each language:

- `en`: `'why.uncommitted': 'the verdict was written with changes that were not committed'`
- `pt-BR`: `'why.uncommitted': 'o veredito foi escrito com alterações que não estavam commitadas'`

So `record-review` replies, in English, `The ADR review of billing cannot be recorded yet: the
verdict was written with changes that were not committed.` The existing test "change-loop replies:
no internal term in either language" (`plugins/openspec/hooks/change-loop.test.mjs`) renders every
`why.*` code of both tables, so it checks the new key for internal terms, backticks, file names and
a missing translation with no edit.

**Alternatives.**

- *Record the verdict and let the contract refuse it at the pull request.* Rejected by the owner
  (grill question 2): the loop would open a pull request it knows fails.
- *A new end state for the loop.* Rejected: an unusable verdict already sends the review back to
  the reviewer; K2 (`reviewAgent`) ends the run blocked when the reviewer returns nothing usable
  twice in a row, which covers a reviewer that keeps writing the marker.

## D-3 A merge that brings an ADR (AC-5)

No code change. The comment above `guard.mjs#sliceReviewStale` replaces its last sentence with:

```js
// A merge counts what it brought into the branch (its first-parent diff): a merge of the default branch that brings none
// of those files keeps the review current, and one that brings a file under an ADR folder (another change's new ADR) makes
// it stale, because a new ADR may conflict with the slice and the ADR reviewer must read it (project-phases-followups).
```

Test 10 pins it beside "project-loop ci: a merge of a base with an unrelated product commit keeps
the review current", which stays as it is.

## D-4 The tests (AC-1 to AC-5)

All in `plugins/openspec/hooks/project-loop.test.mjs`, which `guard.test.mjs` imports. Each name
starts with its group's prefix and `followups <n>: `, so
`--test-name-pattern="followups [0-9]+:"` selects the ten. Tests 1 to 7 and 10 sit after "project-loop
ci: a merge of a base with an unrelated product commit keeps the review current" (tests 5 and 7 among
the `project-loop hook:` tests after "gh pr create in the slice's checkout is refused naming review.md
when it is missing"); test 9 after "project-loop next: S15 ..."; test 8 after "project-loop review: a
verdict that is missing, has no verdict word, no commit or another commit is refused". They use the
file's helpers only: `sliceRepo`, `failsWith`, `bothCi`, `prCreate`, `header`, `gitq`, `headOf`,
`withNewCommit`, `ARCHIVE`, `GUARD`, `loopProject`, `readySlice`, `archivedSlice`, `archivedDirOf`,
`verdictFor`, `headOf2`, `lp`, `act`, `body`, `scriptedGh`, `CL`. `<docSha7>` is the first seven
characters of the `docSha` that `sliceRepo` passes to `review`.

| Test | Fixture | Expected | Today | AC |
|---|---|---|---|---|
| `project-loop ci: followups 1: an ADR verdict whose Commit resolves to no commit is named` | `sliceRepo({ review: () => 'Verdict: APPROVED\nCommit: ' + 'ab12'.repeat(10) + '\n\n# ADR review\n' })` | `failsWith(root, /reviews\/adr-reviewer\.md: Commit ab12ab1 does not resolve to a commit/)` | pass | AC-1 |
| `project-loop ci: followups 2: a record whose first line is not a stage header is named` | three repos, `records: { 'business.md': X }` with X each of `'# business\n'`, `''` (empty file), `'\n' + header('business')` (header on line 2) | each `failsWith(root, /business\.md has no stage header on its first line/)` | pass | AC-2 |
| `project-loop ci: followups 3: a record whose first line starts like a stage header and is not one is named malformed` | two repos, `records: { 'architecture.md': X }` with X each of `'<!-- devkit-stage architecture result=done attempt=1 commit=none -->\n# a\n'` and `'<!-- devkit-stage architecture result=passed attempt=1 commit=none\n# a\n'` (no closing `-->`) | each `failsWith(root, /architecture\.md has a malformed stage header/)` | pass | AC-2 |
| `project-loop ci: followups 4: the slice contract with no base ref names it and does not throw` | `sliceRepo()` | `assert.deepEqual(GUARD.sliceProblems(root, ARCHIVE, { base: 'origin/nope' }), ['origin/nope is not available to compare the slice with; fetch the full history'])`, the call inside `assert.doesNotThrow` | pass | AC-3 |
| `project-loop hook: followups 5: gh pr create is refused when the default branch shares no history with the slice` | `sliceRepo({ after: (r) => gitq(r, 'update-ref', 'refs/remotes/origin/main', gitq(r, 'commit-tree', 'HEAD^{tree}', '-m', 'unrelated').trim()) })` (a root commit: no common ancestor) | `prCreate(root)`: code 2, `err` matches `/origin\/main is not available to compare the slice with; fetch the full history/` | pass | AC-3 |
| `project-loop ci: followups 6: an ADR verdict recorded with uncommitted changes is named, whatever its commit` | (a) `review: ({ docSha }) => 'Verdict: APPROVED\nCommit: ' + docSha + ' (uncommitted changes)\n\n# ADR review\n'`; (b) the same with `'ab12'.repeat(10)` in place of `docSha` | (a) `failsWith(root, /reviews\/adr-reviewer\.md: Commit <docSha7> was recorded with uncommitted changes/)`; (b) `failsWith(root, /Commit ab12ab1 was recorded with uncommitted changes/)` and neither entry's output matches `/does not resolve/` | fail | AC-4 |
| `project-loop hook: followups 7: gh pr create is refused for an ADR verdict recorded with uncommitted changes` | fixture (a) of test 6 | `prCreate(root)`: code 2, `err` matches `/reviews\/adr-reviewer\.md: Commit <docSha7> was recorded with uncommitted changes/` | fail | AC-4 |
| `project-loop review: followups 8: a verdict recorded with uncommitted changes is refused and nothing is recorded` | `loopProject()`, `readySlice(t)`; (a) `verdictFor(wt, 'billing', headOf2(wt) + ' (uncommitted changes)')`; (b) the same with `'1'.repeat(40)` | for (a) and (b): `lp(wt, ['record-review', 'billing'])` code 2, `body(r).result` `verdict-unusable`, `body(r).reply` equal to `CL.render('en', 'verdict-unusable', { id: 'billing', why: 'uncommitted' })`, and `openspec/changes/billing/review.md` absent; with `{ lang: 'pt-BR' }`, the reply equals `CL.render('pt-BR', ...)` and differs from the English one | fail | AC-4 |
| `project-loop next: followups 9: a verdict for HEAD recorded with uncommitted changes goes back to the ADR reviewer, active or archived` | active: `loopProject()`, `readySlice(t)`, `verdictFor(wt, 'billing', headOf2(wt) + ' (uncommitted changes)')`; archived: a second `loopProject()`, `archivedSlice(t, 'billing', { commit: true })`, then `verdictFor` with the same marker into `openspec/changes/archive/<archivedDirOf(wt) name>` | each `act(t.main, 'billing', { gh: scriptedGh() })` gives `[kind, agent, step, stage]` equal to `['agent', 'devkit-core:adr-reviewer', 'review', 'review']` | fail (today a `record-review` session action) | AC-4 |
| `project-loop ci: followups 10: a merge of a base that brings an ADR makes the review stale` | `sliceRepo({ after })`, `after` as in "a merge of a base with an unrelated product commit ..." but `withNewCommit(r, 'docs/adr/0002-other.md')` on `main` | `failsWith(root, new RegExp('the ADR review is behind ' + headOf(root).slice(0, 7) + ', which changes docs/adr/0002-other\\.md'))` (the merge, `HEAD`, is the first commit the walk prints) | pass | AC-5 |

**Test first.** Task 1.1 writes the ten tests and runs
`node --test --test-name-pattern="followups [0-9]+:" plugins/openspec/hooks/project-loop.test.mjs`
on the unchanged code, saving the output as printed to
`openspec/changes/project-phases-followups/proof/red.txt`. Expected: 6, 7, 8 and 9 fail (the gap);
1, 2, 3, 4, 5 and 10 pass (they pin branches the fix must keep). That run is the task's check,
never a gate. A result that differs is looked at before the fix: either the fixture does not build
what the table says, or this analysis is wrong, and `design.md` is corrected in the same task.

## D-5 Existing tests that pin the changed behaviour

Searched with `git grep -n "uncommitted changes" -- '*.test.mjs'` and
`git grep -ln "sliceProblems\|record-review\|readVerdict" -- '*.test.mjs'`. None is edited.

- `project-loop.test.mjs`, "project-loop review: a verdict that is missing, has no verdict word, no
  commit or another commit is refused". Invariant: each unusable verdict is refused with its reason
  and nothing is recorded. None of its cases carries the marker; unaffected.
- `project-loop.test.mjs`, "project-loop next: S9 ...", "S10 ...", "S11 ...", "S15 ...", the archived
  rows S16 to S26 and "project-loop scripted: ...": their verdicts come from `verdictFor` with a
  plain sha. Invariant: a usable verdict for `HEAD` is recorded and the slice moves on. Unaffected.
- `project-loop.test.mjs`, every "project-loop ci:" and "project-loop hook:" test, among them "a
  merge of a base with an unrelated product commit keeps the review current" and the three "a later
  commit touching ... makes the ADR review stale". Invariant: the contract's other problems and
  messages. Their verdicts carry no marker; unaffected.
- `change-loop.test.mjs`, "change-loop replies: no internal term in either language", and
  `project-loop.test.mjs`, "project-loop start: every new message key renders in both languages with
  no internal term". Invariant: both tables hold the same keys and every rendering is clean and
  translated. They read the new key (D-2) and pass with it; not edited.
- `plugins/core/skills/review-change/scripts/review-round.test.mjs`, "uncommitted marker": the
  review round of a change (devkit-core). Not a slice path; unaffected.
- `change-loop.test.mjs` line 2478, `assert.match(flow, /v0\.21\.1/, 'the CI snippet pins the
  current release (review-writer-prompt retro: 0.21.1)')` and line 2479, `assert.doesNotMatch(flow,
  /v0\.21\.0/, ...)`. Invariant: the CI snippet pins the current release. It changes with the
  release (D-7).

## D-6 Documents (AC-6, AC-7)

- The three archived plan files, `openspec/changes/archive/2026-11-22-project-phases/proposal.md`,
  `design.md` and `tasks.md`: after line 2 (the `# Proposal`, `# Design` or `# Tasks` title) and its
  blank line, one blockquote line and one blank line; line 1 (the stage header) and every other line
  stay byte for byte. The line, with `<date>` the date it is written (`YYYY-MM-DD`):

  > Note (project-phases-followups, \<date\>): the slice ADR this plan calls ADR 0014 shipped as ADR 0015 (`docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`), because another change took the number 0014 first (`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`). The approved text below is unchanged.

  Paths in backticks, not links, so `scripts/check.py` resolves nothing from the archive.
- `plugins/openspec/README.md` line 20: `Not an opt-in schema (ADR 0014)` becomes `Not an opt-in
  schema (ADR 0015)` (`proposal.md`, "Open decisions inherited").
- `openspec/roadmap.md`, `## Round 19b: follow-ups of the project flow`: the
  `project-phases-followups` line drops the dogfood and a new line follows it; the two lines read
  exactly:

  ```
  - [ ] project-phases-followups (after: project-phases) — tests for the fail-closed branches of `sliceProblems` (a Commit that does not resolve, a missing or malformed record header, no base ref, the verdict's uncommitted marker), `sliceReviewStale` judging a merge by its first parent, and the plan's ADR 0014 mentions
  - [ ] project-slice-dogfood (after: project-phases-followups) — the first real slice in one of the owner's projects through `/devkit project` (the phases' conversations with the owner, the real GitHub auto-merge)
  ```

  No other roadmap line changes; the archive of this change ticks its own line.
- `docs/openspec-flow.md` line 323 ("The slice contract"): `the ADR reviewer's verdict approved or
  declined and current` becomes `the ADR reviewer's verdict approved or declined, recorded with no
  uncommitted changes, and current (no later commit changes, against its first parent, a file under
  the slice's design folder or an ADR folder, so a merge of the default branch that brings another
  change's ADR sends the slice back to the ADR reviewer)`.

## D-7 Release

`CONTRIBUTING.md` step 5. devkit-openspec 0.21.1 to 0.21.2 in
`plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the marketplace
0.25.1 to 0.25.2 (or the next patch after `origin/main`'s on the day of the merge; the release rebase
settles a sibling's bump). `CHANGELOG.md` gets, above `## 0.25.1`:

```
## 0.25.2 — follow-ups of the project phases

- **devkit-openspec** 0.21.2: the slice contract refuses an ADR verdict recorded with uncommitted
  changes, from `devkit-reviews` and the `gh pr create` hook, and `/devkit project` neither records
  it nor moves on: it hands the review back to the ADR reviewer. New tests pin the contract's
  fail-closed branches and a merge that brings an ADR. The CI snippet now pins `v0.21.2`, the
  release's tag.
- Docs: the slice contract says what a current ADR verdict is; the archived `project-phases` plan
  and the pack README name ADR 0015 for the slice decision; the roadmap gives the dogfood of the
  first real slice a line of its own (`project-slice-dogfood`).
```

Every `v0.21.1` of `docs/openspec-flow.md` (lines 578, 579 and 588) becomes `v0.21.2`. In
`plugins/openspec/hooks/change-loop.test.mjs` line 2478 the pin assertion becomes `/v0\.21\.2/`
with the message `'the CI snippet pins the current release (project-phases-followups: 0.21.2)'`,
and line 2479's `doesNotMatch` becomes `/v0\.21\.1/` (invariant: the CI snippet pins the current
release; named in the commit message). The tag `v0.21.2` is pushed after the merge (Workflow
follow-up).

## Decisions and ADRs

No ADR is needed. The change makes the slice contract's "current" (ADR 0015 decision 5) mean what it
means for a change's review, pins existing branches, and fixes records:

- ADR 0015: decision 5 keeps its words ("approved and current"); the refusal closes the case its
  Review trigger names ("a slice's pull request merges with ... a review not current"). None of its
  rejected alternatives is taken (the slice stays an OpenSpec change, archived in its one pull
  request, judged by the light contract, no run locks).
- ADR 0008 decision 4: the `Verdict:` and `Commit:` lines and the writer rules stay as they are;
  the marker is the one the reviewer agents already write (`plugins/core/agents/adr-reviewer.md`).
- ADR 0012 decision 4 and ADR 0002: the check still recomputes the review at the PR head; it now
  refuses one more stale shape. None of their rejected alternatives is taken.

The alternatives rejected in D-1 and D-2 were rejected by the owner's answers or by the code's
existing shape, not by an ADR.

## Implementation plan

**Per surface.** Hooks of devkit-openspec (`plugins/openspec/hooks/`): `guard.mjs` (D-1, D-3),
`project-loop.mjs` (D-2), `change-loop.mjs` (D-2, one key in two tables), the tests (D-4), the pin
assertion (D-7). Docs and records (D-6, D-7). No backend, frontend, worker or panel surface.

**File structure.**

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/guard.mjs` (`sliceProblems`, the comment of `sliceReviewStale`) |
| modify | `plugins/openspec/hooks/project-loop.mjs` (`readVerdict`, `recordReviewCommand`) |
| modify | `plugins/openspec/hooks/change-loop.mjs` (`why.uncommitted` in `en` and `pt-BR`) |
| modify | `plugins/openspec/hooks/project-loop.test.mjs` (tests 1 to 10 added) |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (the pin assertion only) |
| modify | `plugins/openspec/README.md` (one ADR number) |
| modify | `docs/openspec-flow.md`, `CHANGELOG.md`, `openspec/roadmap.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| modify | `openspec/changes/archive/2026-11-22-project-phases/proposal.md`, `design.md`, `tasks.md` (one note each) |
| create | `openspec/changes/project-phases-followups/proof/red.txt` |
| delete | none |

**Estimate.** Optimistic 2.5 h, likely 3.5 h, pessimistic 6 h. The pessimistic case is a fixture
that does not build what D-4 says (the archived row of test 9, the root-commit base of test 5) plus
a whole-suite run that has to be repeated.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Tests 1 to 10 and the red run | 1.5 | Testing | MEDIUM |
| `sliceProblems` marker refusal and the `sliceReviewStale` comment | 0.25 | Core | LOW |
| `readVerdict`, `recordReviewCommand`, `why.uncommitted` | 0.25 | Core | LOW |
| `docs/openspec-flow.md` sentence, README number | 0.25 | Documentation | LOW |
| Archived notes and the roadmap lines | 0.25 | Documentation | LOW |
| Release: versions, CHANGELOG, three pins, pin test, catalog check | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A real slice's review loops: the ADR reviewer, run on a tree with uncommitted work outside `openspec/`, writes the marker again and again | LOW × MEDIUM | In an active slice the loop commits dirty files before it hands the review (`reviewPart` checks `facts.dirty` first); K2 ends a repeated hand-off blocked, fail-closed, and `/devkit project <slice>` called again after a commit runs the reviewer on a clean tree |
| A project's `devkit-reviews` keeps passing a marked verdict until its pin moves | HIGH × LOW | The CHANGELOG and the CI snippet name `v0.21.2`; the old rule is looser only for this one shape, and the loop no longer records such a verdict from the release the session installs |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | The tests use the file's env helpers; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| The root-commit base of test 5 is resolved differently by another Git | LOW × LOW | `commit-tree` with no `-p` makes a root commit on every Git; `merge-base` exits 1 for unrelated histories (checked on the machine while planning) |
| A sibling change bumps devkit-openspec or edits round 19b of the roadmap | MEDIUM × LOW | The release rebase settles the version (`CONTRIBUTING.md`); the roadmap edit touches two lines of round 19b only |
| An existing test pins the changed behaviour outside D-5's list | LOW × MEDIUM | D-5's searches covered every suite; the whole suite runs in phase 2 before any review |

**Assumptions.**

- A-1: every reader of the slice contract calls `sliceProblems` (`git grep -n "sliceProblems(" --
  plugins ':!*.test.*'` lists `deliver-check.mjs` line 1582 and `guard.mjs` line 697). If another
  did, AC-4 would not hold for it.
- A-2: every loop decision on the verdict reads `usable`, or the four refusals of
  `recordReviewCommand` (`project-loop.mjs` lines 207, 221, 222, 309 and 535 to 538).
- A-3: the reviewer agents write the marker as ` (uncommitted changes)` after the sha on the
  `Commit:` line (`plugins/core/agents/adr-reviewer.md` line 68), which `parseCommitLine` reads
  case-insensitively.
- A-4: `deliver-check.mjs#archiveChanges` stops the CI entries before `sliceProblems` when the base
  is missing or shares no history (Context; reproduced while planning), so AC-3 is pinned at the
  function and the hook.

**Dependencies.** `project-phases` (archived 2026-11-22; devkit-openspec 0.20.0: the slice contract,
the loop and the tests' helpers); `review-writer-prompt` (archived 2026-11-22; devkit-openspec 0.21.1,
the version this change bumps). ADR 0015, 0008, 0012 and 0002 as cited.

## Migration Plan

Nothing to migrate: no file format, JSON field or exit code changes; `record-review` gains one
`why` code under the existing `verdict-unusable` result. A session gets the new loop when it updates
devkit-openspec; a project's `devkit-reviews` gets the refusal when its pin moves to `v0.21.2`.
Rollback: revert the change's pull request; the old rule accepts a marked verdict again, and the
notes and the roadmap line are text only.
