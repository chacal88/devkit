<!-- devkit-stage design result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Design

Change: `forced-merge-path` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Decision: ADR 0028 (`proposed`, [decisions.md](decisions.md)) · Specs: [change-delivery](specs/change-delivery/spec.md),
[change-coordination](specs/change-coordination/spec.md), [reviews-check](specs/reviews-check/spec.md)

## Context

See [proposal.md](proposal.md) for the why. The facts that shape the how:

- **Where PR 88 was lost (reproduced read-only, 2026-11-24).** A scratch repository holding the tree
  of PR 88's head `3929274`, its remote set to this repository, with a `gh` wrapper that answers every
  `contents/...?ref=main` read at the merge commit `6999a04` and refuses any write, gave with today's
  hooks: on branch `roadmap-sessions-upfront`, `deliver-check` next `implement` ("phase 9 has
  unticked tasks: 9.6") and item 5 "no pull request for this branch yet"; on `main`, `stop-branch`
  ("PR #88 of roadmap-sessions-upfront merged with tasks left (9.6); continue on branch ...");
  on another branch, `implement` (the single-active-change fallback of `resolveChange`).
  `change-loop.mjs next` answered `implement` and `blocked wrong-branch` for the first two. Every
  lookup found PR 88 with the branch deleted: `gh pr view` on the branch, `gh pr list --head
  roadmap-sessions-upfront --state all`, the newest-100 merged list with its files, and
  `gh api repos/{owner}/{repo}/commits/<sha>/pulls`. The pull request is lost by the rule:
  `deliver-check.mjs#mergedOnBranch` returns `{ none: true, mergedBefore }` when tasks are left and no
  open pull request shares the head, and `#nextStep` reads `mergedLeft` only when `branchOk` is false,
  so on the change's branch the phases answer first.
- `deliveryOf` is the one place that decides delivered (field-fixes D-4); `collectState` enters the
  post-merge rows (`archiveNext`) only when `delivery.delivered`; `change-loop.mjs#nextAction` asks
  `collectState` + `buildReport` through `conduct-check.mjs#deliveryRow` whenever the stage checker's
  walk is in the build part (`inDelivery`), and maps the step through `ROWS`.
- PR 88's head: `check` `SUCCESS`, `devkit-reviews` `FAILURE`; the `main` ruleset requires exactly
  `check` and `devkit-reviews` (`gh api repos/{owner}/{repo}/rules/branches/main`).
- `openspec archive <id> --yes` (CLI 2.0.0, the version `.github/workflows/ci.yml` installs) on a
  scratch copy of PR 88's tree with stdin closed printed `Task status: 55/56 tasks` and `Warning: 1
  incomplete task(s) found. Continuing due to --yes flag.`, archived the folder and exited 0.
- PR 92 (the hand-made archive of `roadmap-sessions-upfront`, task 9.6 unticked in the archived
  `tasks.md`) passed `check` and `devkit-reviews`: `deliver-check.mjs#archivePrCheck` reads only the
  retro and the files the proposals name.

## Goals / Non-Goals

**Goals:** the forced merge reaches the archive through the loop from any checkout, with its open
items named once (in the answer and in the retro); the partial pull request of today keeps every
behaviour; one helper per mechanism.

**Non-Goals:**
- The stage readout `flow-check.mjs` keeps its code and text: its walk stops at the pending
  implementation of a forced merge, and the loop reads the delivery checker from there (ADR 0017
  decision 1: the loop's next action decides). Only fixtures of `flow-check.test.mjs` change.
- A merge with every task ticked and a red check stays delivered, with today's retro reason; its
  checks are not read (no new `gh` call on the delivered path).
- `plugins/core/skills/retro/SKILL.md`, the retro template and `readRetro` stay as they are.
- No new step name: the panel, `conduct-check` and the `ROWS` table keep their step lists.

## D-1 Finding the merged pull request (AC-3; open point 1)

Resolution of the requirements' first AMBIGUOUS point: neither (a) nor (b) is the primary path,
because the reproduction shows the current lookups find the pull request with its branch deleted
(on the branch: `gh pr view`, then `gh pr list --head <branch> --state all`; elsewhere: the newest-100
merged list with each candidate's files). Every later read uses the found pull request's number
(`gh pr view <n>`, `pulls/<n>`). Option (a) becomes the third arm of `findChangePr`'s list path,
read only when `gh pr list --state merged --limit 100` returned exactly 100 entries and none is the
change's own (a shorter list was complete, so a miss there is final and no extra call is made):

1. `ghJson(gh, 'commits?sha=<base>&path=openspec/changes/<id>/tasks.md&per_page=10')`, newest first
   (`base` is the configured base in `two-prs`, else `default_branch` from `readRepoSettings`).
2. For each commit sha: `ghJson(gh, 'commits/<sha>/pulls')`; keep the entries with `merged_at`, base
   `ref` equal to `base` and a head `ref` that `isArchiveHead` rejects; for each, `prFiles` and
   `isOwnPr`. The first own one is normalized to the shape `gh pr list` gives (`number`, `url` from
   `html_url`, `state: 'MERGED'`, `headRefOid` from `head.sha`, `headRefName`, `baseRefName`,
   `mergedAt`) and returned as `{ pr, via: 'commit' }`; none gives `{ none: true }`; a failed read
   (either route, or an answer that is not a list) gives `{ error, arm: 'commit' }`. The `arm` field
   is what D-4 reads to tell this read from the other `findChangePr` errors.

Option (b) (a `(#<n>)` or `Merge pull request #<n>` subject on `origin/<base>`) is rejected: a rebase
merge has no such subject, and `origin/<base>` is the local copy `deliver-check` never fetches.

`mergedOnBranch` changes one return: with tasks left and no open pull request of the head it returns
`{ none: true, mergedBefore, merged: <the merged pr object>, ...known }`, so `deliveryOf` can judge
the merged pull request without a second lookup. The open further pull request still wins
(spec scenario "A further pull request is open").

## D-2 The forced signal (AC-1, AC-2; ADR 0028 decision 1)

New helper in `deliver-check.mjs`, exported for the tests:

- `notGreen(rollup, required)`, pure: `rollup` is the `statusCheckRollup` list, each entry a CheckRun
  (`name`, `conclusion`) or a StatusContext (`context`, `state`); `required` the context names. It
  returns `[{ name, conclusion }]` in `required` order, then `devkit-reviews` when it is not required
  but has an entry: a name with no entry gives `conclusion: 'absent'`; a name whose entries are not
  all `SUCCESS` gives the first non-`SUCCESS` value (`FAILURE`, `SKIPPED`, `NEUTRAL`, `null` read as
  `PENDING`, ...).
- `forcedChecks(gh, number, base)`: `requiredChecks(gh, base)` (the existing `merge-setup.mjs`
  helper: active rulesets plus classic protection) and one `gh pr view <number> --json
  statusCheckRollup`. An answer without a `statusCheckRollup` array is `{ error: 'gh pr view
  <n> returned no statusCheckRollup' }`, never "absent"; either read failing is `{ error }`. Else
  `{ checks: notGreen(...) }`.

The merge is forced when `checks` is not empty. `forcedChecks` runs only for a merged own pull
request, change not archived, with at least one unticked task on the default branch (spec "An
owner's forced merge is told by the required checks").

## D-3 The open items (AC-1, AC-5; ADR 0028 decision 3)

`gatesAtHead(gh, id, head)` reads the gate files at the merged head through GitHub, so the count is
the same from every checkout and after a squash merge:

- `readContents(gh, 'openspec/changes/<id>/evidence.md', head)`: not found is `{ file: 'evidence.md',
  why: 'missing' }`; a first line `parseStageHeader` (guard.mjs) does not read, or whose result is
  not `passed`, is `why: 'no stage header'` or `why: 'result <r>'`; else its `parseCommitLine`
  (guard.mjs) must be current (below).
- `readContents(gh, 'openspec/changes/<id>/reviews', head)`: the `*.md` entries (a 404 is an empty
  folder). Each `REQUIRED_REVIEWERS` name without a file is `{ file: 'reviews/<name>.md', why:
  'missing' }`. Each file read: `valueIn(text, 'Verdict')` not `APPROVED` or `DECLINED` is `why:
  'verdict <v>'` (or `'no verdict line'`); else its `Commit:` must be current under
  `verdictAllowed(id, name, verdict)`.
- Current: no `Commit:` line is `'no Commit: line'`; `(uncommitted changes)` is `'<short> was recorded
  with uncommitted changes'`; a recorded sha that `head` starts with is current with no call; else
  one `ghJson(gh, 'compare/<sha>...<head>')`, cached per sha within the run: `status` other than
  `ahead` or `identical` is `'<short> is not an ancestor of the merged head'`; a `files` list of 300
  or more is `'<short> is too far behind the merged head to read'`; a file the predicate rejects is
  `'<short> is behind the merged head, which changes <file>'`; else current. The compare is the net
  diff of the range, where local `staleness` walks commit by commit (a product file added and
  removed inside the range is not seen); accepted, see Risks.
- Answers of an unexpected shape, as `tasksOnDefault` treats them: a contents answer for
  `evidence.md` or a verdict file that is not an object with a `content` string (a folder answers a
  list) is `{ error: '<path> at <short head> has no content' }`; a `reviews` answer that is not a
  list (a file where the folder should be) is `{ error: 'openspec/changes/<id>/reviews at <short head>
  is not a folder' }`. Every error of `gatesAtHead` (these, a contents or compare read that fails
  with anything but a 404, unreadable JSON) ends the read and is returned as `{ error }`.

`valueIn(text, key)` is split out of `guard.mjs#readValue`, which becomes `existsSync ? valueIn(read)
: null` with no behaviour changes; an empty text gives `null`.

`forcedMerge(gh, id, pr, { base, unticked })` combines them in one place: `forcedChecks` first; not
forced is `{ forced: null }`; forced reads `gatesAtHead(gh, id, pr.headRefOid)` and returns
`{ forced: { number, url, head, items, count } }`, `items` in the order tasks (`{ kind: 'task', id,
text: 'task <id>' }`), checks (`{ kind: 'check', name, conclusion, text: '<name> (<conclusion>)' }`),
gates (`{ kind: 'gate', file, why, text: '<file> (<why>)' }`); `count = items.length` (at least 2).

## D-4 The delivery and the state (AC-1, AC-2, AC-4)

- `deliveryOf`: after `left` is known, when `ship !== 'plan'`, not archived, `left.length > 0`, and
  the merged own pull request is `fetched.pr` (state `MERGED`) or `fetched.merged` (D-1), call
  `forcedMerge(gh, id, <merged pr>, { base: base ?? tasks.repo.settings.default_branch, unticked:
  left })`. The base: in `two-prs` it is the configured base `deliveryOf` already receives (the
  `nextStep` row on `two.defaultOk` guarantees it is the default branch); outside `two-prs`
  `deliveryOf` gets no `base`, and the forced read takes the default branch from the repository
  settings `defaultTasks` read to find the tasks (`tasks.repo`; `left` is not empty only when that
  read gave a default branch). When forced, `fetched` becomes `{ pr: <merged pr>, via: fetched.via
  ?? 'branch', tasks }`, and the answer gains `forced` (else `forced: null`). `delivered` keeps its
  rule.
- **An unreadable forced or commit read.** The fact that carries it is a new field of `deliveryOf`'s
  answer, `unreadMerge: { number, error } | null`:
  - `forcedMerge` returns `{ error }` (the rules or the rollup read of D-2, a missing
    `statusCheckRollup`, any `gatesAtHead` error of D-3): `unreadMerge = { number: <merged pr>.number,
    error }`, `fetched = { error }` (so items 5 to 8 say `cannot read the PR: <error>`, as for any
    other `fetched` error), `forced: null`.
  - `findChangePr` returns `{ error, arm: 'commit' }` (D-1): `unreadMerge = { number: null, error }`,
    `fetched` stays that error.
  - Every other read error keeps today's answer and sets no `unreadMerge`: a tasks read that fails
    (`fetched = { error }`, item 5 `blocked`; the test at `deliver-check.test.mjs:5066` is
    unchanged), a `gh pr view`, `gh pr list` or `prFiles` read of `findChangePr`, the open-PR read of
    `mergedOnBranch`. The row below is limited to the forced and commit reads.
  - The stage readout reads the same `fetched`: `flow-check.mjs#readDelivery` ends its walk `blocked` with the
    reason code `gh-error`, quoting the error, for an unreadable forced read, as for any `fetched` error
    (a `flow-check.test.mjs` assertion beside the partial-merge fixture pins it).
- `collectState`: `postMerge = ship !== 'plan' && (delivery.delivered || Boolean(delivery.forced))`;
  `mergedLeft` is set only when `forced` is null and `unreadMerge` is null, so a failed forced read
  never yields `PR #undefined`; `common.forced = delivery.forced`; `common.unreadMerge =
  delivery.unreadMerge`. In the post-merge items, when forced: item 1 `open` with reason `not done at
  the merge: <texts of task and gate items>` (details `{ unticked, missingGates: [], evidence:
  'forced' }`), item 6 `open` with reason `not green at the merge: <check texts>` (details
  `{ required: true, failing: [], pending: [] }`, so `checksToWatch` never starts a watch); the other
  six as today. `main` then exits 1 (not 8/8).
- `nextStep` gains one row, placed after `if (state.archive) return archiveNext(state);` and before
  the `!state.branchOk` row (so before `stop-branch` from any other checkout and before the phases on
  the change's own branch): when `state.unreadMerge` is set, `step('blocked', reason, { number })`
  with the reason `cannot tell whether PR #<number> of <id> was merged by the owner: <error>`, or,
  when `number` is null, `cannot find the merged pull request of <id>: <error>`; `<error>` is the
  read's error as given (it quotes `gh`). The rows above it are unchanged: `disable-auto-merge`,
  `stop-plan-mode`, the `two-prs` default-branch row; `state.archive` is null here (not delivered,
  not forced). On a forced merge read without error, `state.archive` is set and `archiveNext`
  answers before the phases and before `stop-branch`, as before.
- The commit arm runs only on the list path of `findChangePr`, which the change's own branch never
  takes (the branch arm finds the pull request there), so its error is reached from the default
  branch and any other branch only; the forced read's error is reached from every checkout.
- `two-prs`: covered with no extra code. The change's own pull request there is the base pull
  request to the configured base (the default branch), and `deliveryOf` already judges only it; an
  owner's forced merge of the base pull request with tasks left is read as above. The pull request to
  the test branch is never judged as forced: it is not merged to the base (`delivery-models.test.mjs`
  `:749`, `:761`, `:877` are unchanged).

## D-5 The rows after a forced merge (AC-1, AC-6; ADR 0019)

`archiveNext` changes one row. `step('retro', ...)` gives, when `state.forced` is set, the reason
`PR #<n> merged by the owner with <count> items open: <texts joined by '; '>; run the retro` and the
extra field `forced` (the D-3 object); otherwise today's reason. The release rows R1 to R3 still come
first: `archiveBaseFacts` gets `changePr: fetched.pr`, the merged pull request, so
`releaseTagFacts(... merged: 'change')` runs as for a delivered change. `stop-retro-answers`,
`archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr` are the delivered rows unchanged.
Once `openspec archive` moved the folder, `locateChange` reports it archived, `delivered` is true and
`forced` is no longer computed.

## D-6 The loop (AC-1; spec `change-coordination`)

In `change-loop.mjs#decide`, `buildPart`:
- `const testStage = facts.row?.next?.forced ? null : testStageStep();`: a forced row is never
  replaced by a unit-tests or e2e-tests hand-off.
- The `spec.session` branch passes `{ reply: say('forced-merge', { id: ctx.id, number:
  row.next.number, count: row.next.forced.count }) }` as `sessionAction`'s `extra` when
  `row.next.forced` is set.
- Message table, beside `waiting-retro`, key `forced-merge` in `en`: `You merged pull request
  #{number} of {id} with {count} items still open. I write them into its retro, and then the change
  is archived.`, and the same sentence in the `pt-BR` table (written by the implementer in that
  table's style). The table test of "Replies use no internal term" covers it.

`plugins/openspec/skills/devkit/SKILL.md`, the `- \`session\`` item, gains: "A `retro` step that
carries `reply` (an owner's forced merge) keeps `reply` for the message that ends the turn."

## D-7 The retro (AC-5; open point 2)

Resolution of the second AMBIGUOUS point: (b). The retro skill's Output already has "Went wrong", the
PR 88 retro wrote the forced merge there as prose, and `readRetro` reads only `## Proposed updates`,
so a new section would add a format without a reader, in a devkit-core skill other flows share. The
`ship-change` row `retro` gains, after its current text: "When `next.forced` is present (the owner
merged with items open), item 1, Went wrong, opens with one line, written in the files' language
(`filesLanguage`), saying the owner merged with `next.forced.count` items open (in English: `Merged
by the owner with <count> items open:`), followed by one line per entry of `next.forced.items`, its
`text` as given; tick no task and change no file but `retro.md`."

The opening line follows `filesLanguage` because the owner confirmed that files are written in it
(`requirements.md` Assumptions, the "N items open" bullet), and `plugins/openspec/skills/devkit/SKILL.md`
already tells every session to write the change's files in it. The `text` of each item is a fact the
checker writes (a task id, a check name and conclusion, a gate file and its `why`, in English as
every checker reason is) and is carried as given, never translated, so the retro names the same item
the answer names. The D2 test matches `next.forced`, "Went wrong", `items` and "files' language" in
the row; the real retro runs of D-13 run in English (this repository's `filesLanguage`), and one
fixture case runs in a scratch clone whose `devkit:` block sets `language: pt-BR`, recording that the opening
line is in that language and the item texts are unchanged.

## D-8 The archive command (AC-6; open point 3)

Resolution of the third point: nothing changes. The `ship-change` `archive` row already runs
`openspec archive <id> --yes`; the pinned CLI warns about incomplete tasks and continues (Context).
The evidence re-runs it on a scratch copy of PR 88's head with stdin closed.

## D-9 The archive pull request's check (ADR 0028 risk; spec `reviews-check`)

No code changes: `archivePrCheck` never reads the archived `tasks.md`, evidence or reviews (PR 92
passed with 9.6 unticked). A new test pins it (D-12, R1).

## D-10 Documents, ADR and release (AC-7)

- `docs/openspec-flow.md`: the delivery paragraph ("A change is delivered when ..."), "The
  post-merge phase" (a forced merge enters it; items 1 and 6 open), and "Finding the change PR" (the
  commit arm replaces "The 100 is the cap ...").
- After the owner approves the plan: ADR 0028 in the `ADRs:` list of `openspec/config.yaml` `context:`
  ("0028 an owner's forced merge leads the change to the archive, amends 0003"), and in ADR 0003 an
  `- Amended by ADR <n> (<file>)` header line plus a Context note in the style of its 2026-11-20
  note. `<n>` is the next free number on `origin/main` at the last merge before review; the file
  and every reference are renamed if a sibling took 0028. The loop's `accept-decisions` step sets
  the ADR's status after the approval.
- Release: devkit-openspec's `plugin.json` and its `marketplace.json` entry, plus the marketplace
  version, each to the next free version after `origin/main`'s at the last merge before review; the
  CHANGELOG entry; the CI pin lines of `docs/openspec-flow.md` to that devkit-openspec version (the
  pin tests). The tag is pushed by the loop's `tag-release` after the merge (ADR 0019).

## D-11 Shared helpers

One helper per mechanism: `forcedMerge` (the only caller of `forcedChecks` and `gatesAtHead`, called
only by `deliveryOf`); `requiredChecks` (merge-setup.mjs, reused, not copied); `readContents`,
`ghJson`, `prFiles`, `isOwnPr`, `isArchiveHead`, `parseCommitLine`, `parseStageHeader`,
`verdictAllowed`, `REQUIRED_REVIEWERS` reused; `valueIn` split from `readValue`, not duplicated. The
replay (D-13) imports the hooks; it copies no rule.

## D-12 Tests

Every new test name starts `forced-merge-path <phase>: `. Fixtures are `fakeGh` keys (no git history
is read): the rollup is `pr-view-<n>` (`{ stdout: { statusCheckRollup: [...] } }`), the rules are
`presetSetup`'s, contents at a sha are `api-GET-repos__owner___repo__contents_<path>_ref=<sha>`,
compare and commits keys follow the same rule. A test of a new export reaches it through
`import * as deliver from './deliver-check.mjs'`.

New tests, one per guard and label, negatives included:

| # | Suite | Case | Expected |
|---|---|---|---|
| F1 | deliver-check | `devkit-reviews` FAILURE, `check` SUCCESS | forced, `devkit-reviews (FAILURE)` |
| F2 | deliver-check | `check` FAILURE alone | forced, `check (FAILURE)` |
| F3 | deliver-check | required `check` has no entry | forced, `check (absent)` |
| F4 | deliver-check | required `devkit-reviews` has no entry | forced, `devkit-reviews (absent)` |
| F5 | deliver-check | every required check SUCCESS | not forced (`[]`) |
| F6 | deliver-check | `devkit-reviews` not required: absent / reported FAILURE | not forced / forced |
| F7 | deliver-check | a StatusContext `context`/`state` entry | read like a CheckRun |
| F8 | deliver-check | two entries of one name, one FAILURE | not green |
| F9 | deliver-check | SKIPPED, NEUTRAL, null conclusion | not green (`SKIPPED`, `NEUTRAL`, `PENDING`) |
| F10 | deliver-check | from `main`: rollup answer without the field; rules read fails; rollup read fails | `unreadMerge` `{ number: 12, error }`; step `blocked`, reason `cannot tell whether PR #12 of feat was merged by the owner: <error>`; `mergedLeft` null; never `stop-branch`, no `undefined` in the answer |
| F11 | deliver-check | same rollup failure on the change's own branch (`pr view` MERGED, no open PR) | step `blocked` with F10's reason, never `implement` |
| G1-G3 | deliver-check | evidence: missing; header `result=failed`; no header | one gate item each, its `why` |
| G4 | deliver-check | evidence Commit equals head | current, no compare call (calls log) |
| G5 | deliver-check | compare lists only `openspec/` files | current |
| G6 | deliver-check | compare lists `src/a.ts` | stale, names `src/a.ts` |
| G7 | deliver-check | compare `status: diverged` | not an ancestor |
| G8 | deliver-check | required reviewer missing; `REJECTED`; approved and stale; a test-spared reviewer behind a test file only | three gate items; the last current |
| G9 | deliver-check | from `main`: contents read fails (not 404); evidence answer is a list (a folder); evidence answer has no `content` string; `reviews` answer is an object | `gatesAtHead` `{ error }` each, its text; step `blocked` with F10's reason form |
| G10 | deliver-check | G9's contents failure on the change's own branch | step `blocked`, never `implement` |
| E1 | deliver-check | the tasks read fails (the `:5066` shape) | no `unreadMerge`; item 5 `blocked` as today, the step that test gets today unchanged |
| N1 | deliver-check | PR 88 shape from `main` (list arm) | `retro`, exact reason, `forced.count`, items order |
| N2 | deliver-check | same on the change's branch, no open PR | `retro`, never `implement` |
| N3 | deliver-check | same on another change's branch | `retro` |
| N4 | deliver-check | same, branch deleted (`pr view` "no pull requests found", list --head MERGED) | `retro` (AC-3) |
| N5 | deliver-check | forced: items 1 and 6 open, others checked, exit 1, summary `merged: archive step retro` | as stated |
| N6 | deliver-check | every task ticked, `devkit-reviews` FAILURE | `retro`, today's reason, no `pr view <n>` call |
| N7 | deliver-check | forced, release file bumped, no tag | `tag-release` first |
| N8 | deliver-check | forced, every proposal answered, active; then archived on `chore/archive-feat` with roadmap unticked | `archive`; then `tick-roadmap`; then `open-archive-pr` |
| N9 | deliver-check | forced, retro with an unanswered proposal | `stop-retro-answers` |
| N10 | deliver-check | bytes of `tasks.md`, `readiness.md`, `approval.md`, `evidence.md`, `reviews/*` before and after `main([id, '--json'])` | identical (AC-4) |
| N11 | delivery-models | `two-prs`: the base pull request merged with a task left and `devkit-reviews` FAILURE | `retro`, `forced` set; the test-branch pull request never read as forced |
| L1 | deliver-check | full list of 100 without own, commit arm finds #12 | `via: 'commit'` |
| L2 | deliver-check | commit arm: archive head, other base, then none | skipped; `{ none: true }` |
| L3 | deliver-check | commit arm read fails (`commits?sha=`, then `commits/<sha>/pulls`), from `main` and from another change's branch | `{ error, arm: 'commit' }`; step `blocked`, reason `cannot find the merged pull request of feat: <error>`; never `stop-branch` |
| L4 | deliver-check | list of 3, none own | no `commits?` call |
| V1 | guard | `valueIn` on text equals `readValue` on the same file, empty text null | equal |
| R1 | deliver-check | `--ci` on an archive branch, archived folder with `- [ ] 9.6`, no evidence, retro answered | exit 0; with an unanswered proposal exit 1 |
| C1 | change-loop | row `retro` with `forced` | session `retro`, `detail.forced`, reply `forced-merge` (en, pt-BR), exit 0 |
| C2 | change-loop | stage checker next `unit-tests`, row forced retro | the retro session step |
| C3 | change-loop | row `retro` without `forced` | no reply, as today |
| D1 | change-loop | the devkit skill's `session` item names the forced retro reply | matches |
| D2 | deliver-check | the `ship-change` `retro` row names `next.forced`, "Went wrong", `items` and "files' language" | matches |

Existing tests that assert a rule this change touches (grep of every `*.test.mjs`, `scripts/` and
the specs for `mergedLeft`, `mergedBefore`, `stop-branch`, `merged with tasks left`,
`tasks-left-after-merge`, `postMerge`, `every task ticked`, `run the retro`):

| Test (file:line at `def8637`) | Invariant | Layer | Change |
|---|---|---|---|
| `deliver-check.test.mjs:4985` "with tasks left ... stop-branch names the PR" | partial merge from `main` answers `stop-branch` with today's reason | `deliver-check` `deliveryOf`/`nextStep`, spec `change-delivery` "The work left" | add `pr-view-12` rollup green; assertions unchanged |
| `deliver-check.test.mjs:5016` "on the change's branch with the work ticked ... open-pr" | own branch after a partial merge leads to a further PR | same | add `pr-view-12` rollup green |
| `deliver-check.test.mjs:5041` "with no open pull request on the head ... names the merged one" | `findChangePr` answers `none` + `mergedBefore` + tasks | `findChangePr`/`mergedOnBranch` | unchanged: `findChangePr` does not judge forced; assert the new `merged.number` 12 too |
| `deliver-check.test.mjs:4998`, `:5008`, `:5028`, `:5054`, `:5066` | not own / open further PR / every task ticked / absent or unreadable tasks | same | unchanged (no forced read reached; `:5066`'s tasks read error sets no `unreadMerge`, E1) |
| `deliver-check.test.mjs:1439`, `:1954-1970`, `:2311`, `:3213` | `stop-branch` from `branchOk: false` | `nextStep` | unchanged (no `forced` in those states) |
| `flow-check.test.mjs:998` "merged pull request with tasks left ... implementation" | the readout's partial merge | `flow-check` `readDelivery` | add rules and `pr-view-12` rollup green fixtures |
| `delivery-models.test.mjs:749`, `:761`, `:877` | a test-branch merge alone does not deliver | `deliveryOf` with base | unchanged (no own merged PR with tasks left) |
| `change-loop.test.mjs:510`, `:865`; `conduct-check.test.mjs:550`; `plugins/panel/hooks/report.test.tsx:705`, `:1027` | `stop-branch` maps to `wrong-branch`; step lists | loop rows, panel | unchanged (no new step) |
| `deliver-check.test.mjs` "format: ship-change archive rows ..." (`skillRow(md, 'retro')` matches `devkit-core:retro`) | the retro row names the skill | skill text | unchanged; D2 adds the forced sentence |
| `change-loop.test.mjs:2463` "every reply not yet shown ends the turn" | `- \`session\`` item keeps `reply` | skill text | unchanged; D1 extends it |
| spec `change-delivery` "A partial pull request merged", "From the default branch", "On the change's own branch", "The last task ticked in a further pull request" | partial merge rules | spec | MODIFIED in the delta, meaning kept for green checks |
| spec `change-stages` "A merged pull request with tasks left" | the readout | spec | unchanged (non-goal) |

The fixture `pr-view-12` is new in each of those tests; a test that already sets a plain `pr-view`
fixture keeps it (the branch lookup reads `pr view` without a number).

## D-13 Replay and real-run proof (AC-8, AC-5, AC-4)

`openspec/changes/forced-merge-path/proof/replay.mjs` (written in phase 2; run by the pr-verifier):

- Input: `--case <name>` from a table in the file: PR 88 (`roadmap-sessions-upfront`, merge
  `6999a043f0e94b76ea42a3ae77392dc67af6855e`, head `3929274b8e752ad78ef4a9253bba5b193cd02310`), PR 91
  and live case 3 when merged (read with `gh pr view <n> --json mergeCommit,headRefOid,headRefName`),
  and fixture cases (`--fixture <file>`) for those not merged yet, shaped from the requirements'
  live cases: a pull request opened by hand and merged with `devkit-reviews` FAILURE; a merge without
  evidence and without reviews; a required check absent; a rollup read that fails (replayed for its
  `blocked` answer from `main` and the change's branch, with no retro run). `--dry-run` prints the
  cases and checkouts it would build and calls nothing.
- Setup, all under a fresh `mktemp -d`: `git clone --quiet --no-hardlinks <repo root>` (local, no
  network), `git remote set-url origin <real url>` and `git remote set-url --push origin
  no-push`, `git checkout -B <branch> <sha>` for each checkout of AC-3 (the change's branch at the
  head, `main` at the merge commit, `other-change` at the merge commit); "before" hooks from `git
  archive origin/main plugins/openspec/hooks` at the last merged base, "after" hooks from this
  worktree; a `gh` shim first on `PATH` (`proof/gh-shim.mjs`) that rewrites `?ref=<default>` to
  `?ref=<merge sha>` and refuses every call that is not `pr view|list|checks|diff` or a GET `api`
  call or a `graphql` query without `mutation`, or, in fixture mode, answers from the fixture file and
  refuses any call it does not hold.
- Output, per case and checkout: the before and after `deliver-check` `next.step` and reason, and the
  after `change-loop.mjs next` kind, stage, step and `reply`; the partial case of AC-2 (the PR 88
  fixture with every check green) before and after.
- Real retro runs (the conducting session's part): one for each case of the table that reaches the
  retro, live once merged, else from its fixture (PR 91 and live case 3 run whichever way they
  stand when the evidence runs, so no case is left without a run), plus the `pt-BR` run of D-7; each a
  `claude -p` session in the clone, loaded with `--plugin-dir <worktree>/plugins/openspec
  --plugin-dir <worktree>/plugins/core` and the shim on `PATH`, told to run `/devkit change
  <id>` until the turn ends. Recorded: the reply it showed, `retro.md` (the "Went wrong" lines and
  `readRetro`'s `readable` and proposals), no `- Answer:` line, the next `change-loop.mjs next`
  (`stop-retro-answers`), and `git status --porcelain` listing only `retro.md` (AC-4).
- Every new GitHub route gets one live read-only call in `evidence.md` (CONTRIBUTING step 4):
  `pr view <n> --json statusCheckRollup`, `commits?sha=&path=`, `commits/<sha>/pulls`,
  `compare/<a>...<b>`, contents at a commit sha.

## Implementation plan

Dependency order: guard helper, then the delivery checker's facts, then its rows, then the loop and
the skills, then documents and release.

**Per surface.** Hooks (`plugins/openspec/hooks/`): `guard.mjs` (`valueIn`), `deliver-check.mjs`
(D-1 to D-5, the `unreadMerge` row of D-4 included), `change-loop.mjs` (D-6). Skills: `ship-change/SKILL.md`, `devkit/SKILL.md`. Docs:
`docs/openspec-flow.md`, ADR 0003, `openspec/config.yaml`. Release: `plugins/openspec/.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, `CHANGELOG.md`. No worker, frontend or schema surface changes.

**File structure.**
- Modify: `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/deliver-check.mjs`,
  `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/deliver-check.test.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/flow-check.test.mjs`,
  `plugins/openspec/hooks/guard.test.mjs` (V1, beside the `readValue` tests),
  `plugins/openspec/hooks/delivery-models.test.mjs` (N11), `plugins/openspec/skills/ship-change/SKILL.md`,
  `plugins/openspec/skills/devkit/SKILL.md`, `docs/openspec-flow.md`,
  `docs/adr/0003-auto-merge-the-archive-pr.md`, `openspec/config.yaml`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- Create: `openspec/changes/forced-merge-path/proof/replay.mjs`, `proof/gh-shim.mjs`,
  `proof/fixtures/*.json`, `proof/red-<phase>.txt`.
- Delete: none.

**Estimate:** optimistic 17 h, likely 24 h, pessimistic 35 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| `valueIn` split, `notGreen`, `forcedChecks` + F tests | 3 | Core | LOW |
| `gatesAtHead` + G tests | 4 | Core | MEDIUM |
| commit arm + `mergedOnBranch` return + L tests | 2.5 | Core | LOW |
| `deliveryOf`/`collectState`/retro row, the `unreadMerge` fact and its `blocked` row + N, F10-F11, G9-G10, E1 tests, fixture updates | 5 | Core | MEDIUM |
| R1 archive-check test | 0.5 | Testing | LOW |
| change-loop reply and precedence + C tests | 2 | Integration | LOW |
| skills text + D tests | 1 | Documentation | LOW |
| `docs/openspec-flow.md`, ADR records, release | 2 | Documentation | LOW |
| replay harness, shim, fixtures | 3 | Testing | MEDIUM |
| evidence: replays, real retro runs, live route calls | 1 | Testing | MEDIUM |

## Risks / Trade-offs

| Risk | P × I | Mitigation |
|---|---|---|
| A partial pull request merged while a check was red (or before a required check reported) reads as final | LOW × MEDIUM | ADR 0028 accepts it; the retro names the checks; F3/F4/F9 pin exactly what counts |
| The compare net diff misses a product file added and removed within the range, so a gate counts as current | LOW × LOW | Only the count shifts, never the step; documented in D-3 and `docs/openspec-flow.md` |
| Existing tests reach the new `pr view <n>` read and fail at the fake's missing fixture | HIGH × LOW | The D-12 table names each one; a missing field is an error, never "absent", so a forgotten fixture fails loudly |
| The rules route is unreadable for the caller's token | LOW × MEDIUM | Fail closed (`blocked`, quoting `gh`), as `mergeSetup` does; classic protection 403/404 stays "none" |
| A stage of the walk ended blocked at its attempt ceiling on the change's branch: the loop never reads the row (`inDelivery` is false) | LOW × MEDIUM | Out of scope; the end names the failed stage; from the default branch the walk stops at the pending implementation and the row decides; noted in the retro |
| The replayed default branch today holds the archive (PR 92) | HIGH × HIGH | The shim answers `ref=main` at the merge commit; the reproduction above proved it |
| A real `claude -p` run pushes or writes on GitHub | LOW × HIGH | The clone's push URL is `no-push`; the shim refuses every write |
| Sibling changes take ADR 0028 or the version | MEDIUM × LOW | Tasks name "the next free number/version on `origin/main` at the last merge before review"; `renumber-adr` handles a clash |

## Assumptions

- `gh pr view <n> --json statusCheckRollup` answers for a merged pull request after its branch is
  deleted (checked on PR 88, 2026-11-24).
- GitHub serves contents and compare at a pull request's head sha after a squash merge (the head
  commit object stays reachable through `refs/pull/<n>/head`; to be confirmed by a live call in the
  evidence).
- `openspec archive --yes` continues past incomplete tasks in CLI 2.x (checked with 2.0.0).
- The required checks are read when the loop runs, not as they were at the merge (rules rarely
  change between the two; ADR 0028 decision 1 names the merged head's checks).

## Dependencies

- ADR 0019 and the release rows (`release-tags`, on `main`); the post-merge rows of
  `archive-after-merge` and field-fixes D-4 (on `main`); `merge-setup.mjs#requiredChecks` (on `main`).
- ADR 0028 accepted at the plan approval (owner); no open-decisions log exists.

## Migration Plan

No data migration. The installed devkit-openspec drives the loop, so a project gets the path after
`claude plugin update devkit-openspec@devkit`. Rollback: revert the pull request; a change already
archived through the path stays archived, and its retro names what was open.
