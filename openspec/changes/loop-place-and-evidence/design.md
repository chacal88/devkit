<!-- devkit-stage design result=passed attempt=2 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Design

Change: `loop-place-and-evidence` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `proposal.md`, `specs/change-delivery/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `2aea5d9` (devkit-openspec 0.33.0, marketplace 0.37.0,
the same as `origin/main` at `c1ac8c4` for every file this change touches):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/deliver-check.mjs#dirtyPaths` (line 250) | `git status --porcelain -z -uall`. It keeps only paths outside `openspec/`, and drops untracked paths under `.claude/`. `gitFacts()` returns it as `facts.dirty` |
| `deliver-check.mjs#changedUnder(root, pathspec)` (line 851) | `git status --porcelain -z -uall -- <pathspec>`. Every modified, staged, untracked, deleted or renamed path under the pathspec (for a rename, the new path). Used today only by `prItem` (item 5, `details.uncommitted`), and only once a PR exists |
| `deliver-check.mjs#collectState` (line 1700) | The pre-merge return spreads `common` (`dirty: facts.dirty`) and adds the items, reviews, phases and so on. The post-merge return has its own shape. Neither one holds the change folder's uncommitted paths |
| `deliver-check.mjs#nextStep` (line 1510) | Order: stops, phases (`implement`, `gate`), then line 1551 `if (state.dirty.length) return step('commit', 'uncommitted changes outside openspec/: …', { paths: state.dirty })`, then `stop-review-deadlock`, `fix-review`, `fix-defect`, `verify`, then `review` (lines 1582 to 1588, `toReview` from item 2 missing or stale plus item 3 undisposed, `round` from `review.md`), then `blocked` and the PR rows |
| `deliver-check.mjs#describeNext` (line 1905) | `commit` has no detail entry, so the human line is `next: commit: <reason>` |
| `plugins/openspec/hooks/change-loop.mjs` `ROWS.commit` (line 894) | `handOff('delivery', 'commit-and-pr')`. The K1 guard (line 1043) ends the run `no-progress` when the same `progressKey` (`<stage>/<step>@<fingerprint>`, the fingerprint covering HEAD and `git status`) is handed twice |
| `plugins/openspec/skills/ship-change/SKILL.md` row `commit` (line 56) | Dispatches `commit-and-pr`: stage `next.paths` plus every modified or untracked file under `openspec/` from `git status`; commit and push, no PR. It ends: "`next.paths` lists only the paths outside `openspec/`; …" |
| `ship-change/SKILL.md` row `review` (line 57) | Starts with the prose "Commit every modified or untracked file under the change folder first (`tasks.md` ticks, `evidence.md`), so the round runs on a clean tree; then run the `review-change` skill …" |
| `docs/openspec-flow.md` line 462 | "**Order of the delivery steps.**" lists the rows after the phases and the `commit` |
| `plugins/core/agents/commit-and-pr.md` | A commit-only call may derive the files from `git status` (Receives); precondition 2 refuses a clean tree; precondition 3 is waived when the caller says the review comes next |

Constraints:

- `deliver-check.mjs` is one of the files that a project's `devkit-reviews` workflow downloads
  (`docs/openspec-flow.md`, CI section). No new module and no new import.
- `--ci` (`checkOne`) checks items 1 to 4 and never calls `nextStep`
  (`grep -n "nextStep(" plugins/openspec/hooks/*.mjs` lists only `buildReport` and the `--watch` loop).
  CI is unaffected.
- ADR 0010 decision 2: the change coordinator "does not decide the order". This change moves an
  ordering rule out of the session's prose and into the checker, which is where that decision puts it.
- ADR 0008 decision 4 and ADR 0016: the review gates, the `Commit:` lines and the writer of each
  file stay as they are. The commit role only commits files that their own roles wrote.

## Goals / Non-Goals

**Goals:**

- One condition in `nextStep` and one field in `collectState`. Every other answer of the checker
  stays as it is, and the tests show it for each row the condition could shadow.
- Every existing test that the condition turns red is named below, with its invariant, the layer
  that owns it and its suite (CLAUDE.md working rules). None is weakened.
- The real-run proof covers each case that AC-1 to AC-4 list, and the conducting session's own part
  (CLAUDE.md working rules).

**Non-Goals:**

- No change to `change-loop.mjs`, `conduct-check.mjs`, `flow-check.mjs`, `guard.mjs`,
  `roadmap-loop.mjs`, the schemas, the panel or devkit-core.
- No change to `dirtyPaths`, `staleness()` or what a reviewer marks as `(uncommitted changes)`
  (`jira-entry-followups`).
- No change to `plugins/openspec/skills/devkit/SKILL.md` line 95 ("then the loop hands `verify`,
  `review` and a plain `push`"). It stays true, because the new step sits between them only when the
  folder is dirty, and `change-loop.test.mjs` "change-loop docs: the design records the answers"
  pins that sentence verbatim. The same holds for `docs/openspec-flow.md` line 316.

## Decisions

### D-1 The fact: the change folder's uncommitted paths (AC-1, AC-3)

In `collectState`'s pre-merge return (the second `return`, after `items`), add:

```
folderDirty: changedUnder(root, `openspec/changes/${id}`),
```

with the comment `// The change folder's uncommitted paths (loop-place-and-evidence D-1): the review round waits for their commit.`

- This reuses `changedUnder` as it is: modified, staged, untracked (with `-uall`, each file in a new
  folder), deleted and renamed paths (the new path). Git's pathspec matches whole path components,
  so `openspec/changes/featx/` and `openspec/config.yaml` do not count.
- The post-merge return does not get the field. Its next step comes from `archiveNext` before any
  row reads it.
- `buildReport`'s JSON does not print the field, so the report's keys stay as they are (the test
  "… buildReport keys …" at `deliver-check.test.mjs` line 2221 does not change).

**Alternatives.**

- *Widen `dirtyPaths` to the change folder.* Rejected. `staleness()` reads `facts.dirty`, so every
  evidence and every approved verdict would go stale while `evidence.md` is uncommitted, and line
  1551 would hand the commit before `verify` with folder paths in `paths`. That is a different rule
  from the one the requirements chose (assumption 4), and it is the reviewer-side question of
  `jira-entry-followups`.
- *Read `items[4].details.uncommitted` (item 5).* Rejected. Item 5 fills it only once a PR exists,
  and the first round runs before the PR.

### D-2 The rule: `commit` before `review` (AC-1, AC-2, AC-4)

In `nextStep`, inside `if (toReview.length) {` and before the `round` is computed, add:

```
if (state.folderDirty?.length) {
  return step('commit', `uncommitted files in the change folder before the review round: ${state.folderDirty.slice(0, 3).join(', ')}`, { paths: [] });
}
```

with the comment `// The review round runs on a clean change folder (loop-place-and-evidence D-2): its commit first, with no product path.`

What follows from where it sits, with no further code:

- It runs only after `verify` would not fire, and only when some reviewer is missing, stale or has
  an undisposed finding, which is exactly when `review` would be the answer. `stop-review-deadlock`,
  `fix-review` and `fix-defect` sit above it and keep their place. So do `verify` (assumption 4) and
  line 1551 (AC-4): when product paths are dirty, the call returns line 1551's step, whose
  `commit-and-pr` dispatch also stages the folder from `git status`. One call returns one step, so
  there is never a second `commit` in the same answer.
- `paths: []`. The `commit` row stages `next.paths` plus the change folder and
  `openspec/config.yaml` from `git status`, so an empty list commits exactly the folder (assumption 5).
- Once the folder is committed, `folderDirty` is empty, and the same `toReview` and `round` are
  computed as before (AC-2). The commit touches only `openspec/`, so `staleness()` keeps the
  evidence and every approved or declined verdict current. A rejected verdict cannot be in
  `toReview` while it is current (it went to `fix-review`), and its narrower rule (the review record
  only) is not consulted here.
- `state.folderDirty?.length`: a state with no field (every synthetic `state()` and `twoState()`
  fixture of the existing suites) behaves as before (AC-3).
- In `two-prs`, `review-resolution` is a different step and is untouched. The rule applies to the
  task branch's `review` only.
- The change loop: `ROWS.commit` hands it to `devkit-core:commit-and-pr` at stage `delivery`, as
  today. A commit that changes nothing leaves the fingerprint as it was, so K1 ends the run
  `no-progress` instead of looping.

**Alternatives.**

- *A new step name (`commit-folder`).* Rejected. It needs a new row in `ship-change`, in `ROWS`,
  in `conduct-check`'s actor map and in the panel's step lists, for a hand-off that is the same as
  `commit`'s (requirements, assumption 2).
- *Fire it before `verify` too.* Rejected by assumption 4: the pr-verifier writes `evidence.md`
  first, and committing before it would only add a commit.
- *Let the `review` row keep committing by prose.* That is the defect: prose can be skipped.

### D-3 The texts (AC-6)

`plugins/openspec/skills/ship-change/SKILL.md`:

- Row `commit`. In the quoted dispatch, replace "This is a pre-review commit: precondition 3 does
  not apply, verify and review run next." with "This is a pre-review commit: precondition 3 does not
  apply; verify, when the evidence is not current, and review run next." Replace the row's last
  sentence with: "`next.paths` lists only the paths outside `openspec/`, and may be empty: before a
  review round the loop hands `commit` with no paths while only the change folder is uncommitted.
  The change folder and `openspec/config.yaml` are still staged from `git status`."
- Row `review`. Replace its opening "Commit every modified or untracked file under the change folder
  first (`tasks.md` ticks, `evidence.md`), so the round runs on a clean tree; then run" with "The loop
  hands the `commit` step first while anything under the change folder is uncommitted (`tasks.md`
  ticks, `evidence.md`), so the round runs on a clean tree. Run". The rest of the row stays
  byte for byte.

`docs/openspec-flow.md`, paragraph "**Order of the delivery steps.**" (line 462):

- In the first sentence, between the `verify` item and the `review` item, insert: "`commit` (a
  reviewer missing or stale while a path under `openspec/changes/<id>/` is uncommitted: the folder
  is committed first, with `paths` empty),".
- After the sentence that ends "makes both stale again: `verify`, then `review`.", insert: "A review
  round never starts on an uncommitted change folder: once the evidence is current, the `commit`
  step comes first whenever `tasks.md`, `evidence.md` or any other file under the folder is
  modified, staged or untracked, so no verdict of the round carries `(uncommitted changes)` for it."

None of the phrases in `OLD_ORDER` (`deliver-check.test.mjs` line 3143) appears in these texts.

### D-4 The tests (AC-1 to AC-7)

Every new test's name starts `loop-evidence <n>: `, so `--test-name-pattern="^loop-evidence "`
selects them all. The tests use the files' existing helpers: in `deliver-check.test.mjs`
`state()`, `open()`, `shipRepo()`, `committedChange()`, `tick()`, `fullEvidence()`, `ev()`,
`reviewAt()`, `review()`, `put()`, `commitAll()`, `git()`, `head()`, `BOTH`, and in
`change-loop.test.mjs` `build()`, `rowOf()`, `COMMIT`. These helpers blank the branch variables.
No new export is needed, so a red run fails test by test.

**New tests in `plugins/openspec/hooks/deliver-check.test.mjs`**, in a new section at the end of the
file, `// ---- loop-place-and-evidence: the change folder is committed before a review round (spec change-delivery)`:

The column "Red before D-1/D-2" says whether the test fails on the code as it is (task 1.1's red
run). A test that reads `collectState(...).folderDirty` (7, 12, 14) is red before D-1, because the
field is `undefined` there and `deepEqual` against an array fails; the others are red only when
they expect the step of D-2.

| Test | Build | Expected | Red before D-1/D-2 | AC |
|---|---|---|---|---|
| `loop-evidence 1: a dirty change folder before review answers commit with no paths` | `state({ folderDirty: ['openspec/changes/feat/evidence.md'], items: { 2: open({ missing: ['code-quality-reviewer'] }) } })` | `[step, paths]` `['commit', []]`; `reason` is exactly `uncommitted files in the change folder before the review round: openspec/changes/feat/evidence.md` | yes | AC-1 |
| `loop-evidence 2: with the folder clean or the field absent the review answer is unchanged` | the state of 1 with `folderDirty: []`, and with no `folderDirty` key; then the same pair for a FAIL round 1 with the rejected reviewer stale (`reviewMd: { consensus: 'FAIL', round: 1 }`, `reviews` rejected and `current: false`, item 2 `stale`) | each pair `deepEqual`; steps `review` with `[reviewers, round]` `[['code-quality-reviewer'], 1]` and `[['code-quality-reviewer'], 2]` | no | AC-2, AC-3 |
| `loop-evidence 3: product paths dirty with the folder answer the product commit once` | `state({ dirty: ['src/a.ts'], folderDirty: ['openspec/changes/feat/evidence.md'], items: { 2: open({ missing: ['code-quality-reviewer'] }) } })` | `[step, paths]` `['commit', ['src/a.ts']]`; `reason` starts `uncommitted changes outside openspec/` | no | AC-4 |
| `loop-evidence 4: a dirty folder never comes before verify, fix-defect, fix-review or the round-2 stop` | `folderDirty: ['openspec/changes/feat/tasks.md']` on: item 1 open with evidence `stale`; item 4 with `defects: ['AC-1']`; `rejectedState()`; `rejectedState({ reviewMd: { consensus: 'FAIL', round: 2 } })` | `verify`, `fix-defect`, `fix-review`, `stop-review-deadlock` | no | AC-3 |
| `loop-evidence 5: a dirty folder with no reviewer to run changes nothing` | `folderDirty: ['openspec/changes/feat/reviews/code-quality-reviewer.md']` on `state()` (all met), and on item 5 `{ none: true }` open | `ready`; `open-pr` | no | AC-3 |
| `loop-evidence 6: the reason names at most three folder paths` | four paths `a.md` … `d.md` under `openspec/changes/feat/` | `reason` names `a.md`, `b.md`, `c.md` and not `d.md`; `paths` `[]` | yes | AC-1 |
| `loop-evidence 7: evidence.md uncommitted alone answers commit, and once committed review with the same reviewers and round` | `t = committedChange()`; `fullEvidence(t.root, t.env)` | `collectState(...).folderDirty` `['openspec/changes/feat/evidence.md']`; `t.next()` `[step, paths]` `['commit', []]`; then `commitAll`; `t.next()` `[step, reviewers, round]` `['review', BOTH, 1]` | yes | AC-1, AC-2 |
| `loop-evidence 8: a modified evidence.md alone answers commit` | `t = committedChange()`; `fullEvidence(t.root, t.env)`; `commitAll` (7's builds, none of 7's assertions); then `ev(t.root, <the same text> + '\n')` | `t.next().step` `commit`, `paths` `[]` | yes | AC-1 |
| `loop-evidence 9: a ticked tasks.md uncommitted alone answers commit` | `t = shipRepo()`; `tick(t.root, '1.1', '1.2', '2.1', '2.2')`; `commitAll`; `tick(t.root, '2.3')`; `fullEvidence`; `git(t.root, 'add', '--', 'openspec/changes/feat/evidence.md')`; `git(t.root, 'commit', '-q', '-m', 'evidence')` | fixture check: `git status --porcelain` lists only `openspec/changes/feat/tasks.md`; `t.next()` `[step, paths]` `['commit', []]`; after `commitAll`, `review` with `BOTH`, round 1 | yes | AC-1, AC-2 |
| `loop-evidence 10: an untracked file, then the same file staged, answer commit and are named` | `t = committedChange()`; `fullEvidence`; `commitAll`; `put(t.root, { 'openspec/changes/feat/proof/red-1.txt': 'red\n' })` | `t.next()` `commit`, reason ends `openspec/changes/feat/proof/red-1.txt`; after `git add` of it, still `commit`; after `commitAll`, `review` | yes | AC-1, AC-2 |
| `loop-evidence 11: product code dirty with the folder: the product commit, verify, the folder commit, then review` | `t = committedChange()`; `fullEvidence`; `put(t.root, { 'src/a.ts': 'changed\n' })` | `t.next()` `[step, paths]` `['commit', ['src/a.ts']]`; `commitAll`; `verify`; `fullEvidence`; `['commit', []]`; `commitAll`; `review` with `BOTH` | yes (the third step) | AC-4, AC-1 |
| `loop-evidence 12: paths outside the change folder do not count` | `t = committedChange()`; `fullEvidence`; `commitAll`; `put(t.root, { 'openspec/changes/featx/tasks.md': 'x\n', 'openspec/config.yaml': <its text> + '# x\n' })` | `collectState(...).folderDirty` `[]`; `t.next().step` `review` | yes (D-1: the field is `undefined` before it; `t.next().step` is `review` before and after) | AC-3 |
| `loop-evidence 13: a round recorded after the commit step is current; one marked uncommitted is not` | `t = committedChange()`; `fullEvidence(t.root, t.env)`; `commitAll` (7's builds, none of 7's assertions: no `t.next()` and no `folderDirty` read before the round); `reviewAt(t.root, BOTH)` | item 2 `met`, `t.next().step` `open-pr`; control: the two files rewritten with `review('approved', head(t.root), ' (uncommitted changes)')`, so item 2 is `open` with both in `details.stale` | no (it reads neither the field nor a step of D-2) | AC-5 |
| `loop-evidence 14: collectState lists the folder's modified, staged, untracked and renamed paths` | `t = committedChange()`; `fullEvidence`; `commitAll`; modify `tasks.md`, `git add` a new `notes.md`, `put` an untracked `proof/x.txt`, `git mv` `proposal.md` to `proposal-old.md`, all under `openspec/changes/feat/` | `folderDirty` sorted is exactly those four paths (the rename by its new path) | yes (D-1) | AC-1 |

**New tests in `plugins/openspec/hooks/change-loop.test.mjs`**, right after "change-loop decide: B2
commits and pull requests go to the commit agent":

| Test | Build | Expected | Red before D-1/D-2 | AC |
|---|---|---|---|---|
| `loop-evidence 15: a commit row with no paths goes to the commit agent, as one with paths does` | `build(rowOf('commit', { paths: [] }))` and `build(rowOf('commit', { paths: ['src/a.ts'] }))` | both `[kind, agent, step, stage, role]` `['agent', COMMIT, 'commit', 'delivery', 'commit-and-pr']` and `skills` `['commit-message-guidelines']`; the first's `detail.paths` is `[]` | no (pins the hand-off) | AC-1 |

**New text pins in `plugins/openspec/hooks/deliver-check.test.mjs`**, after "format: ship-change
names every next.step the checker can return" (phase 2):

| Test | Expected | Red before D-3 | AC |
|---|---|---|---|
| `loop-evidence 16: the ship-change review row leaves the commit to the loop and the commit row allows empty paths` | the `| \`review\`` row does not contain `Commit every modified or untracked file under the change folder first` and contains `The loop hands the \`commit\` step first while anything under the change folder is uncommitted`; the `| \`commit\`` row contains `` `next.paths` lists only the paths outside `openspec/`, and may be empty`` and `are still staged from \`git status\`` | yes | AC-6 |
| `loop-evidence 17: the flow doc's order of the delivery steps names the commit before the review round` | the paragraph that starts `**Order of the delivery steps.**` contains `` `commit` (a reviewer missing or stale while a path under `openspec/changes/<id>/` is uncommitted`` and `A review round never starts on an uncommitted change folder` | yes | AC-6 |

**Existing tests that D-2 turns red, and their edit.** Each one writes `evidence.md` with
`fullEvidence()` (untracked) and expects `review` from a real repository. Its invariant is about
which reviewers and which round come after the evidence, not about the evidence being uncommitted.
So the edit commits the evidence before the call (`commitAll(t.root, 'evidence')`), or adds the
`commit` step to a recorded sequence. The expected reviewers and rounds stay as they are.

| Test (suite) | Invariant | Layer | Edit |
|---|---|---|---|
| E1 "resume: code committed with one review current runs only the other reviewer (AC-5, AC-7)" (`deliver-check.test.mjs`) | on resume, only the reviewers that are not current run | `deliver-check` `nextStep` through `collectState` | `commitAll(t.root, 'evidence')` after each of its two `fullEvidence` calls |
| E2 "walkthrough: a devkit-lite change goes from no ticked task to ready without a stop step (AC-2)" (`deliver-check.test.mjs`) | the walk reaches `ready` with no stop step | same | the expected list becomes `['implement', 'gate', 'implement', 'gate', 'commit', 'verify', 'commit', 'review', 'open-pr', 'ready']`; `driveToReady` is unchanged (its `commit` case commits all) |
| E3 "resume: a round-2 deadlock on disk stops while current and re-reviews as round 1 after the owner's product commit (AC-4, AC-5)" (`deliver-check.test.mjs`) | after the owner's product commit, the run resumes at round 1 with both reviewers | same | `commitAll` after `fullEvidence` |
| E4 "AC-3 fix-restales-both (a): after a rejected review and its fix commit, verify comes first and then review at round 2" (`deliver-check.test.mjs`) | after a fix commit, `verify` and then `review` at round 2 | same | `commitAll` after `fullEvidence` |
| E5 "AC-3 fix-restales-both (b): after a fail row and its fix commit, verify comes first and then review" (`deliver-check.test.mjs`) | same, after a fail row | same | `commitAll` after `fullEvidence` |
| E6 "AC-3 fix-restales-both (c): after a failing check and its fix commit, verify, then review, then push" (`deliver-check.test.mjs`) | same, after a failing check; `push` once reviewed | same | `commitAll` after `fullEvidence` |
| E7 "walkthrough (merge): enable at 8/8, wait, a product commit disables first, the loop re-runs, enable again, then the retro" (`deliver-check.test.mjs`) | the merge walk: enable, wait, disable on a product commit, enable again, retro; the checker never merges | same | `taken` gains `'commit'` after `'verify'`; after the second `fullEvidence`, push `step().step` (`commit`) to `seen`, `commitAll`, then the existing `review` call; `seen` becomes `['enable-auto-merge', 'wait-merge', 'disable-auto-merge', 'verify', 'commit', 'review', 'push', 'enable-auto-merge', 'wait-merge', 'retro']` |
| E8 "review-writer-prompt AC-8 after a test-only commit the evidence goes stale first, then the review step names the two reviewers" (`deliver-check.test.mjs`) | after a test-only commit, `verify` and then `review` of the two test readers | same | `commitAll` after the second `fullEvidence` |
| E9 "flow-check AC-6: deliver-check gives the same step with and without stage headers" (`flow-check.test.mjs`) | the stage header changes no step of the checker | `deliver-check` through `flow-check`'s fixture | in `fixture()`, after the `rank >= 5` evidence write, add `if (kind === 'review') commitAll(root, 'evidence');` so the `review` kind is still `review` |

The grep behind the table: `grep -n "fullEvidence(" plugins/openspec/hooks/deliver-check.test.mjs`
(16 calls) and every `collectState`/`nextStep` caller in the other suites. `delivery-models`,
`release-tags`, `conduct-check` and `change-loop` commit their evidence together with the reviews
(`prove()`, `readyChange()`, `deliveredChange()`), and their synthetic states have no `folderDirty`.
The two "AC-4 no-mutual-staleness" tests of `deliver-check.test.mjs` (lines 2132 and 2141) read
items, not `next`, so they stay as they are. Task 1.3's red
run is the proof: a test it shows red that is not E1 to E9 stops the phase and goes back to the plan.

**Unchanged tests that pin texts this change edits**, run by the phase 2 gate: "format: ship-change
names every next.step the checker can return" and "AC-6 instructions-follow: …" (both tests) in
`deliver-check.test.mjs`; "flow-check AC-3: every writer of a stage file names the stage header" in
`flow-check.test.mjs` (the `review` row keeps `<!-- devkit-stage` and `review`); "stage-roles gates:
the verify row allows no pull-request comment" in `guard.test.mjs`.

**AC-7, the place wait, untouched.** These tests are run by the gates of phases 1 and 3 and are not
edited: "remote AC-10 stop: the blocked end no-place lets a /devkit change run stop" in
`change-loop.test.mjs`, and "upfront AC-7 session-next: …", "upfront AC-8 session-next: …" and the
"upfront AC-9 …" tests, among them "upfront AC-9 lock stop: a claimed change session held for a place
may stop", in `roadmap-loop.test.mjs`. Task 3.2 checks that `change-loop.mjs`, `roadmap-loop.mjs`
and `roadmap-loop.test.mjs` have no diff.

### D-5 The real-run proof and AC-5 (the conducting session's part)

The installed devkit-openspec (0.33.0) does not have D-2. From gate 1.5 on, the conducting session
therefore reads `next` from the worktree's own checkers: `node
<worktree>/plugins/openspec/hooks/change-loop.mjs next --change loop-place-and-evidence …`, with the
same arguments that the `devkit` skill gives (CLAUDE.md working rules, the installed-plugin rule).

**S, the conducting session's own part, on the real tree.** When `pr-verifier` returns after
`verify`, the session records, in a file in its scratchpad, `git status --short --
openspec/changes/loop-place-and-evidence/`, which is expected to show `evidence.md`, and `tasks.md`
too when the last gate tick is uncommitted. Then it records the `next` JSON, which is expected to be
an `agent` action for `devkit-core:commit-and-pr`, step `commit`, `detail.paths` `[]`. It dispatches
that action as the `commit` row says, records the commit's sha (called F below) and an empty
`git status --short -- openspec/changes/loop-place-and-evidence/`, and runs `next` again, which is
expected to be the session step `review`. After the round, it records line 2 of every
`reviews/*.md`, none of which may carry `(uncommitted changes)`, and item 2 of
`deliver-check.mjs loop-place-and-evidence --json`, which must be `met` (AC-5).

**V, the variant cases, on throwaway clones of the worktree at F**, made by the conducting
session after S, before the round. Each case gets its own clone, in a folder of the session's
scratchpad (`/var/tmp` on the Avell):
`git clone -q <worktree> <dir>`, `git -C <dir> switch -q -c loop-place-and-evidence <sha>`,
`git -C <dir> remote set-url origin <the worktree's origin URL>`, so that `gh` reads GitHub
(read-only) as it does in the worktree. In each clone the session runs `env -u DEVKIT_BRANCH -u
DEVKIT_CHANGE -u GITHUB_HEAD_REF -u GITHUB_BASE_REF -u DEVKIT_BYPASS node
<dir>/plugins/openspec/hooks/deliver-check.mjs loop-place-and-evidence --json` from `<dir>`, and
records `next.step`, `next.paths`, `next.reason`, `next.reviewers` and `next.round`. Only
`deliver-check.mjs` runs in the clones, never `change-loop.mjs`, because `next` there could take a
place on this machine (ADR 0020). The hand-off of the `commit` row is proven by S and by test 15.

| Case | Clone at | Made with | Expected |
|---|---|---|---|
| V0 clean folder | F | nothing | `review`, reviewers R0 and round 1, called R below |
| V1 `evidence.md` dirty only | F~1 | for each other path that `git diff --name-only F~1 F` lists: `git restore --source=F -- <path>`, `git add -- <path>`, then, when that list is not empty, one `git commit -q -m probe`; last, `git restore --source=F -- openspec/changes/loop-place-and-evidence/evidence.md` | `commit`, `paths` `[]`, the reason names `evidence.md`; after `git add` and `git commit`: R |
| V2 a ticked `tasks.md` only | F | the Edit tool unticks one ticked gate line of the clone's `tasks.md`, `git add` and `git commit`, then the Edit tool ticks it again | `commit`, `paths` `[]`; after `git add` and `git commit`: R |
| V3 an untracked file, then staged | F | the Write tool creates `openspec/changes/loop-place-and-evidence/proof/probe.txt`; then `git add` of it | `commit` both times, the reason names `proof/probe.txt`; after `git commit`: R |
| V4 product code dirty with the folder | F | `git restore --source=$(git merge-base origin/main F) -- CHANGELOG.md`, and the Write tool creates `proof/probe.txt` as in V3 | `commit` with `paths` `["CHANGELOG.md"]` and the reason `uncommitted changes outside openspec/: CHANGELOG.md`, the only step of the answer |

The files that V1 and V4 restore are bytes that their own roles committed (the pr-verifier's
evidence and `main`'s `CHANGELOG.md`). No role writes another role's file, and nothing is written
in the change's worktree. The owner's plan approval authorizes these `git restore --source` calls
in the throwaway clones and nowhere else (CLAUDE.md, destructive Git). The session removes the
clone folder by its name when V is recorded.

**AC-5 in `evidence.md`.** The first `verify` cannot see the round, which runs after it. Its AC-5
row is `pass` on test 13 (the fixture round), and its proof cell says that the real round's lines
follow. After the round, and before the next call to `next`, the conducting session dispatches
`devkit-core:pr-verifier` once more with the two scratchpad records (S and V). The pr-verifier
rewrites `evidence.md` (one more attempt) with a "Real-run proof" table, one
row per case S and V0 to V4, and with AC-5's proof taken from S's post-round lines. A line that
carries the mark makes the row `fail`, which is a defect (`fix-defect`). The dispatch names the
`Commit:` sha, so the rewrite is deterministic: `git rev-parse HEAD` at the dispatch, which is what
`plugins/core/agents/pr-verifier.md` records ("the full `git rev-parse HEAD` of the code you
verified"); it is F when nothing was committed after S. Under `staleness()` it is current either
way, because only `openspec/` changed since the first `verify`. The rewrite touches only
the change folder, which runs after the round, so it stales nothing, and the `open-pr` commit takes
it in. If the round fails and a fix follows, S and V run again before the next round, and the last
run is the one recorded.

## Implementation plan

**Order.** The checker (D-1, D-2) and its tests come first, then the texts (D-3), then the release
and the whole suite, then S and V around the delivery (D-5).

**Per surface.**

- devkit-openspec hooks: `deliver-check.mjs` (one field, one condition); no other hook.
- devkit-openspec skill: `ship-change/SKILL.md` rows `commit` and `review`.
- Docs: `docs/openspec-flow.md` (the order paragraph; the four `v0.33.0` pins, at lines 661, 662
  and 675, two on 675; line 123's "devkit-openspec 0.33.0" is a release fact and stays),
  `CHANGELOG.md`.
- Release files: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`.

**File structure.**

| Action | Path |
|---|---|
| Modify | `plugins/openspec/hooks/deliver-check.mjs` |
| Modify | `plugins/openspec/hooks/deliver-check.test.mjs` (tests 1 to 14, 16, 17; E1 to E8) |
| Modify | `plugins/openspec/hooks/change-loop.test.mjs` (test 15; the CI pin assertion of "change-loop docs: the design records the answers") |
| Modify | `plugins/openspec/hooks/flow-check.test.mjs` (E9) |
| Modify | `plugins/openspec/skills/ship-change/SKILL.md` |
| Modify | `docs/openspec-flow.md` |
| Modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| Create | `openspec/changes/loop-place-and-evidence/proof/red-1.txt`, `proof/red-1b.txt`, `proof/red-2.txt` (the red runs) |
| Delete | none |

`docs/catalog.md` does not change: no description changes. Task 3.1 checks it with
`gen-catalog.py --check`.

**Estimate.** Optimistic 3 h, likely 5 h, pessimistic 9 h. The whole suite takes 13 to 21 minutes,
and up to 45 on the Avell. A sibling merge that takes the release costs one re-merge, evidence and
review (1 to 2 h, CONTRIBUTING step 5).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1/D-2 the field and the condition | 0.5 | Core | LOW |
| Tests 1 to 15 and their red run | 1.5 | Testing | LOW |
| E1 to E9 and the red run that names them | 1 | Testing | MEDIUM |
| D-3 skill rows and flow doc, tests 16 and 17 | 0.5 | Documentation | LOW |
| Release (versions, changelog, CI pin and its test) | 0.5 | Migration | MEDIUM |
| Whole-suite gate (background) | 0.5 | Testing | MEDIUM |
| S and V real-run proof, the pr-verifier's second pass | 0.5 | Integration | MEDIUM |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A test beyond E1 to E9 turns red under D-2 | MEDIUM × LOW | Task 1.3 runs the whole deliver-check suite and the flow-check AC-6 test after D-2 and before any edit. A red test outside the table stops the phase and goes back to the plan |
| The commit role commits nothing (a path it refuses, a hook), so `commit` is handed again | LOW × MEDIUM | The fingerprint does not move, so K1 in `change-loop.mjs` ends the run `no-progress` instead of looping. `ship-change`'s loop shows the same step and reason, which names the path |
| A file written in the folder between the commit and the round (a proof file, a note) brings `commit` back | MEDIUM × LOW | That is the rule working: one more commit of the folder. S and V keep their records in the scratchpad, not in the folder, until the pr-verifier's second pass after the round |
| `jira-entry-followups` merges first and edits the same rows or lines | MEDIUM × MEDIUM | Merge `origin/main`, re-read the `review` and `commit` rows and `nextStep` around `review`, renumber the release above `main`'s, and run the whole suite again (CONTRIBUTING step 5) |
| The conducting session drives with the installed 0.33.0, which hands `review` on a dirty folder, so AC-5 is not shown | MEDIUM × HIGH | D-5: from gate 1.5 on, `next` comes from the worktree's `change-loop.mjs` |
| The readiness review reads V4's `git restore` of a product file in a clone as a session product edit (ADR 0011) | LOW × LOW | The file is `main`'s committed bytes, in a throwaway clone, never in the project's worktree. If the review objects, V4's setup moves to one `devkit-core:tdd-implementer` hand-off with the same commands, and the session only runs `deliver-check` |
| A hook refuses the session's Edit or Write of `tasks.md` or `proof/probe.txt` in a clone | LOW × LOW | The session stops V, reports the refusal and makes no workaround. The case is then proven only by tests 9 and 10, and the evidence row says `no proof: <the refusal>` |

## Migration Plan

No data and no settings. A project picks up the rule with the devkit-openspec release. A change
under way at that moment gets one extra `commit` step before its next round if its folder is dirty.
Rollback: revert the field and the condition (two hunks of `deliver-check.mjs`), tests 1 to 17,
E1 to E9 and the two texts. The `review` row's prose then becomes the only guard again, as on 0.33.0.

## Assumptions

- `changedUnder` lists staged, unstaged, untracked (`-uall`), deleted and renamed paths. Source:
  `deliver-check.mjs` line 851; test 14 pins it for this use.
- `commit-and-pr` accepts a commit-only call whose files come only from `git status`. Source:
  `plugins/core/agents/commit-and-pr.md`, Receives ("permission to derive them from `git status`")
  and precondition 2. If it refused an empty `next.paths`, the `commit` row's text would need to
  change, not the checker.
- `staleness()` keeps the evidence and the approved verdicts current after a commit of `openspec/`
  only. Source: `deliver-check.mjs` line 289 and `docs/openspec-flow.md` "The `Commit:` staleness
  rule"; E1 to E8 after their edit rely on it.
- `origin/main` is at devkit-openspec 0.33.0 and marketplace 0.37.0 (`git show
  origin/main:.claude-plugin/marketplace.json`, read on 2026-11-23 without a fetch). Task 3.1 fetches
  again before it bumps.

## Dependencies

- None to build on: `remote-worker` and `roadmap-sessions-upfront` (both on `main`) delivered the
  place wait that AC-7 keeps.
- Sibling in flight on the same files: `jira-entry-followups` (`origin/jira-entry-followups`).
  Neither change needs the other (requirements, assumptions).
