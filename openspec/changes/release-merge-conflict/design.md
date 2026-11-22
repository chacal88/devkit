<!-- devkit-stage design result=passed attempt=1 commit=8c8b7b89ca898242699b60e964e74a183e98258f -->
# Design

Change: `release-merge-conflict` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, `specs/change-coordination/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `8c8b7b8` (devkit-openspec 0.21.0). `origin/main` is one
commit ahead, at `c561553` (#59, the archive of `review-writer-prompt`, devkit-openspec 0.21.1). That
commit moves the CI pin to `v0.21.1`, adds `assert.doesNotMatch(flow, /v0\.21\.0/, …)` to the pin
block of `change-loop.test.mjs`, and touches none of this change's code files.

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/release-rebase.mjs#main` | Aborts a rebase left in progress. Exits 0 when `origin/<base>` is already an ancestor. Runs `git rebase origin/<base>`, and at every stop keeps the base's side of each conflicted release file (`checkout --ours`, the upstream during a rebase) or merges the pin file with the pins masked. Then rewrites the manifests, `CHANGELOG.md` and every pin from the version rule, runs `scripts/gen-catalog.py`, and leaves those edits uncommitted. Exit 2 calls `restore()` (`rebase --abort`, or `checkout HEAD -- <written>` then `reset --keep <oldHead>`) |
| `release-rebase.mjs` exports | `bumpKind`, `applyBump`, `resolveVersion`, `resolveManifest`, `manifestEditsBeyondVersion`, `resolveChangelog`, `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `setPins`, `mergePins`, `classifyConflict`, `ReleaseError`, `main`. `conduct-check.mjs` imports `PIN_FILE` and `classifyConflict`; `release-rebase.test.mjs` imports the rest; `conduct-check.test.mjs` imports `pinDoc` from `release-rebase.test.mjs`; `guard.test.mjs` imports `release-rebase.test.mjs` |
| `plugins/openspec/hooks/conduct-check.mjs#deliveryRow` | After `disable-auto-merge`, tries `rewrittenBranch` (override 2), then `releaseConflict` (override 1). `rewrittenBranch` hands `push-rebased` with `git push --force-with-lease=<branch>:<prHead> origin <branch>` when the PR head is not an ancestor of `HEAD` but is in the branch's reflog. `releaseConflict` acts on `blocked` item 5 with `conflict: true`, or on `stop-archive`/`archive-pr` with `conflict: true`. It classifies the conflict with `git merge-tree --write-tree` and `classifyConflict`, and hands `resolve-release-conflict` with `node <hooks>/release-rebase.mjs --base <base> --json`, `blocked` for other paths, or `update-branch` (merge mode) when the merge is clean |
| `conduct-check.mjs#SUBAGENT` | `'push-rebased': COMMIT`, `'resolve-release-conflict': TDD` |
| `plugins/openspec/hooks/change-loop.mjs#ROWS` | `'resolve-release-conflict': handOff('implementation', 'tdd-implementer')`, `'push-rebased': handOff('delivery', 'commit-and-pr')`, `push: handOff('delivery', 'commit-and-pr')`, `'open-archive-pr': handOff('delivery', 'commit-and-pr')` |
| `plugins/openspec/hooks/deliver-check.mjs#prItem`, archive steps | Item 5 returns `blocked` with `conflict: true` for `mergeable === 'CONFLICTING'` before it compares the PR head with the local head. The archive path checks `conflicts` before `headRel === 'ahead'` (`open-archive-pr`). So while GitHub still reports the conflict, a local head ahead of the PR head is never offered a push by `deliver-check` alone |
| `plugins/openspec/skills/devkit/SKILL.md` | Line 75: the `resolve-release-conflict` sentence. Line 76: the `push-rebased` sentence (force-with-lease). Line 136: `push-rebased` in the list of steps a roadmap run carries out as a session |
| `docs/openspec-flow.md` | "Delivery rows" (three overrides), the "Release-file conflict" and "A branch we rewrote" bullets, the "Release-file conflicts: `release-rebase.mjs`" section, the Troubleshooting row `blocked: item 5` ("the flow never resolves conflicts"), and the CI pins (three lines) |
| `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the answers" | The CI-pin block: `assert.match(flow, /v0\.21\.0/, …)` (`v0\.21\.1` on `origin/main`), a `staleV20` filter, the slice-merge floor (`moves this pin to \`v0\.20\.0\` or later first`) and seven `doesNotMatch` lines for older releases (eight on `origin/main`) |

The merge behaviour this design relies on was checked on a scratch repository while planning (Git
2.50.1). The facts:

- During `git merge --no-commit`, stage `:2` is the branch (`HEAD`) and stage `:3` is the merged
  `origin/<base>`.
- After the merge commit, `git merge-tree --write-tree origin/<base> HEAD` exits 0.
- A plain `git push origin <branch>` of the merge commit over the pushed PR head is accepted.
- `git merge --abort` resets the files the run staged. It keeps unstaged edits and untracked files.

Constraints:

- `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads (`docs/openspec-flow.md`, CI section). This change leaves all
  three untouched.
- `scripts/check.py` compares the panel's copies of `CHANGE_ID_RE` and `NOT_IDS` with
  `conduct-check.mjs` (`check_panel_parity`). Neither literal is edited.
- Product code is closed until the plan is approved (the `guard.mjs` edit lock). The release files
  are written by the implementer's hand-off (ADR 0011 decision 2).

## Goals / Non-Goals

**Goals:**

- One tool owns the release resolution: `release-merge.mjs`, the renamed `release-rebase.mjs`. The
  merge replaces the rebase, and its pure functions are kept as they are.
- One helper in `conduct-check.mjs` decides "a release merge made here, not pushed yet"
  (`unpushedMerge`, D-2). The change PR and the archive PR both use it.
- One helper reads the pins of `docs/openspec-flow.md`: `pinsIn` (D-4), exported by `release-merge.mjs`
  next to `setPins`, on the same pin-line rule. The pin assertion and its negative test both use it.
- Each new guard and each new labelled branch has its own test, negatives included (D-5).
- Every existing test that pins a replaced rule is named, with its invariant, layer and suite, in
  the table of `tasks.md` (D-6).

**Non-Goals:**

- `deliver-check.mjs` (its item 5 order, its `RELEASE_FILE` list, the archive file check), `guard.mjs`
  (its force-push rule allows `--force-with-lease` in general), `merge-setup.mjs`.
- The dependency rebase of conduct-check's planning rows (`rebase`, D-2 of the flow doc's dependency
  table). It runs before any work starts. A rebase left in progress there is still
  `blocked: rebase of <id> stopped`.
- devkit-core's `commit-and-pr` (its general rule "`--force-with-lease` only if the caller says the
  branch was rewritten" stays; the loop no longer says so) and the panel (`plugins/panel/hooks/i18n.ts`
  and `steps.ts` keep a label for `push-rebased`, which an older installed devkit-openspec can still
  send; the panel is a separate pack).
- Renumbering the code comment "Override 3: archives are serialized" (test names cite it).
- Fetching the base before judging (roadmap `fresh-base-check`). The CI pin as a release file in
  the archive check (roadmap `archive-release-pin`).

## D-1 The release tool merges the base (AC-1, AC-3, AC-5, AC-6; spec ADDED requirement)

`git mv plugins/openspec/hooks/release-rebase.mjs plugins/openspec/hooks/release-merge.mjs` (and the
test file the same way, D-6). The header comment says what the tool does now:
"release-merge: merge origin/<base> into the current branch and resolve the release-file conflicts
by rule; commit the merge, never push". Usage strings and error prefixes become `release-merge`. The
pure functions, `PIN_*`, `setPins`, `mergePins` and `classifyConflict` are unchanged.

CLI contract (unchanged form): `node release-merge.mjs --base <base> [--json]`. Exit 0 resolved (or
nothing to do), 2 not resolvable (restored), 3 setup or usage error. JSON on exit 0:
`{ resolved: true, oldHead, newHead, versions, files }`, where `newHead` is now the merge commit and
`files` the release files the rule rewrote (committed in it). On exit 2:
`{ resolved: false, oldHead, conflicts, error? }`.

`main(argv)` runs these steps in order:

1. Parse the arguments and find the root. A missing `origin/<base>` is exit 3, as today.
2. A merge left in progress (`git rev-parse -q --verify MERGE_HEAD` succeeds): `git merge --abort`,
   then go on (it replaces "a rebase left in progress is aborted and redone").
3. A rebase in progress (`rebase-merge` or `rebase-apply` under the git dir, today's
   `rebaseInProgress`): exit 3, `release-merge: a rebase is in progress in <root>; finish or abort it first`.
4. A tracked file outside `openspec/` with uncommitted changes
   (`git status --porcelain -z --untracked-files=no`, paths not starting `openspec/`): exit 3,
   `release-merge: uncommitted changes outside openspec/: <paths>; commit them first`. Release files
   live outside `openspec/`. An uncommitted edit of one would be staged into the merge by step 10,
   so the run refuses it. Unstaged edits under `openspec/` and untracked files are left alone: Git
   refuses the merge when it would overwrite them (step 6), and `git merge --abort` keeps them.
5. `oldHead`, `mergeBase` (`git merge-base oldHead origin/<base>`). `origin/<base>` already an
   ancestor of `oldHead`: exit 0, `already on origin/<base>: nothing to do`, no commit (unchanged).
6. `git -c rerere.enabled=false merge --no-ff --no-commit origin/<base>`. When it fails and no
   `MERGE_HEAD` exists (Git refused to start: staged changes, local changes the merge would
   overwrite): exit 3 with Git's message, `release-merge: git merge failed: <stderr>`.
   `rerere.enabled=false` keeps a person's recorded resolutions out of the rule.
7. `conflicts` = `git diff --name-only --diff-filter=U`. `classifyConflict(conflicts, mergeStages(root))`
   where `mergeStages(root)(path)` is `{ base: :1, ours: :3, theirs: :2 }`: `ours` is the base's
   side, the same orientation `conduct-check.mjs#threeVersions` gives (`ours` = `origin/<base>`,
   `theirs` = `HEAD`), so the tool and the loop classify a conflict the same way. A blocking path,
   or a `docs/catalog.md` conflict without `scripts/gen-catalog.py`, goes to `unresolved({ conflicts })`.
8. Each conflicted path but `PIN_FILE`: `git checkout --theirs -- <p>` (during a merge `--theirs` is
   `origin/<base>`), staged. A failure is `unresolved({ conflicts, error: 'cannot keep the base's side of <p>' })`.
9. A conflicted `PIN_FILE`: with no devkit-openspec version on `origin/<base>`,
   `unresolved({ conflicts, error: 'cannot set the pin: …' })` (today's text). Otherwise the masked
   merge (`pinMerged`) is written with `setPins(pinMerged, baseVersion)` and staged.
10. The rule, unchanged from today's post-replay block: `resolveVersions` (an edit beyond a version
    is `unresolved`), each changed manifest rewritten from the base's text, the `CHANGELOG.md` entry
    placed by `resolveChangelog`, every pin set by `setPins` to the resolved devkit-openspec version
    (the base's when the change did not bump it), and `scripts/gen-catalog.py` run when the catalog
    conflicted or a manifest was rewritten. Every file is written through one helper,
    `writeStaged(root, path, text)`, which writes and then `git add -- <path>`. The catalog path is
    staged after the generator. A throw in this step is `unresolved({ conflicts: [], error })`, as
    today.
11. Any path still unmerged (`git diff --name-only --diff-filter=U` not empty) is `unresolved`.
12. `git commit -q -m "chore(release): merge origin/<base> and renumber the release above it"`. No
    `--no-verify`. A failure (a hook, a signing setup) is `unresolved({ conflicts: [], error: 'git commit failed: <stderr>' })`.
13. Exit 0. Text: `resolved: merged origin/<base> at <newHead7>; renumbered <files> (<pack> <version>, …)`,
    or `no release file changed`.

`unresolved(extra)` calls `restore(root, touched)`. `touched` lists every path the run wrote or
regenerated. `restore` runs `git merge --abort` when `MERGE_HEAD` exists. Then, for each path of
`touched` that exists at `HEAD` and differs from it, it runs `git checkout HEAD -- <path>`. That is
the net for a write whose `git add` never ran. Step 4 ensures those paths held no edit of the
person's. The new `restore` replaces today's (rebase abort, `reset --keep`), which goes.

What the owner sees: the loop hands `resolve-release-conflict` to `tdd-implementer`, which runs the
command and then the project's test command. The branch gains one merge commit named
`chore(release): merge origin/main …`, holding the renumbered release. Nothing is pushed yet.

**Alternatives.**

- *Keep the rebase and add a `--merge` mode.* Rejected by the owner (question 1): the rebase path
  leaves entirely.
- *Leave the merge uncommitted (`MERGE_HEAD` set) for `commit-and-pr`.* Rejected. AC-1 wants the
  merge commit right after the command. An agent that does not know a merge is in progress can
  commit only part of it, and a red test run would leave a merge in progress across hand-offs.
- *Resolve on GitHub (`gh pr update-branch`).* Rejected: GitHub cannot update a branch that
  conflicts; the update is the step the conflict blocks.
- *Count `change-loop.test.mjs` as a release file.* Rejected by the owner (question 2): the test
  reads the version instead (D-4).

## D-2 The loop's override: a plain push after the merge (AC-1, AC-2, AC-5; spec MODIFIED requirement)

In `plugins/openspec/hooks/conduct-check.mjs`:

- `rewrittenBranch` (override 2) and its comment go. `deliveryRow` calls
  `releaseConflict(ctx, row, d.state, d.report)` alone after the `disable-auto-merge` check. Its comment
  says "after the override that needs git (D9): the release-file conflict, except that auto-merge
  is switched off before anything else".
- `SUBAGENT` loses `'push-rebased': COMMIT`. `RELEASE_REBASE` becomes
  `RELEASE_MERGE = join(dirname(fileURLToPath(import.meta.url)), 'release-merge.mjs')`. The import
  becomes `import { PIN_FILE, classifyConflict } from './release-merge.mjs'`. The comment of
  `threeVersions` says "before the merge" in place of "before any rebase".
- One new helper, next to `openPrOf`:

  ```js
  // A release merge made in this checkout and not pushed yet: GitHub still reports the PR in conflict, but HEAD
  // already holds origin/<base> and is ahead of the PR head (release-merge-conflict D-2).
  function unpushedMerge(root, ref, pr) // -> boolean
  ```

  It is true when `pr?.headRefOid` is set, differs from `git rev-parse HEAD`,
  `git merge-base --is-ancestor <ref> HEAD` succeeds, and
  `git merge-base --is-ancestor <pr.headRefOid> HEAD` succeeds.
- In `releaseConflict`, right after the `onChange`/`onArchive` test and before `conflictedPaths`:

  ```js
  const pr = openPrOf(state);
  if (unpushedMerge(row.worktree, ctx.ref, pr)) {
    const command = ['git', 'push', 'origin', state.branch];
    return onChange
      ? step('push', `the release merge is not pushed yet; PR #${pr.number} still has ${pr.headRefOid.slice(0, 7)}`, { number: pr.number, branch: state.branch, command })
      : step('open-archive-pr', `the release merge is not pushed yet; archive PR #${pr.number} still has ${pr.headRefOid.slice(0, 7)}; push it`, { number: pr.number, branch: state.branch, command });
  }
  ```

  The step `resolve-release-conflict` carries `command: ['node', RELEASE_MERGE, '--base', ctx.base, '--json']`.
  The second `const pr = openPrOf(state)` further down reuses the first one.
- In the `found.clean` branch of `releaseConflict`, before `update-branch`: when the PR has a head
  and `git merge-base --is-ancestor <pr.headRefOid> HEAD` fails, the PR head is not in the local
  history. Someone else pushed, or an earlier version's release step rebased the branch. The step is
  `stop(onChange ? \`item 5 (PR #${pr.number} head ${short} is not in local history)\` : \`archive (archive-pr): PR #${pr.number} head ${short} is not in local history\`)`.
  Today that state gives `update-branch` in merge mode. That is a GitHub merge onto a head the local
  branch does not hold, so the branch diverges. In `pr` mode it gives `deliver-check`'s
  "has merge conflicts", which names the wrong cause. The rest of `releaseConflict` is unchanged.

Why this branch is needed. `deliver-check` reports item 5 `blocked` with `conflict: true` before it
compares heads (Context table). After the merge, GitHub keeps reporting the conflict until the push.
Without this branch the override would see a clean `merge-tree` and hand `update-branch` in merge
mode. A GitHub-side merge onto a PR head that the local branch has moved past would diverge the
branch, and the next plain push would be refused.

The order the owner sees. The renumbered files are outside `openspec/`, so the first-parent rule of
merge-staleness-first-parent (`deliver-check.mjs#staleness`) makes `evidence.md` and every review
stale. `deliver-check`'s own order then gives `verify`, then `review`. Only when items 1 to 4 are
met again does item 5 (still `CONFLICTING`) reach the override, which gives `push`. The push goes
up with reviews and evidence current at its head, so `devkit-reviews` runs on current files. On an
archive PR there is no evidence or review: the next step is `open-archive-pr` at once. Auto-merge
still on is switched off first (`deliveryRow` returns `disable-auto-merge` before any override).

The guard's conditions, each with a test (D-5): HEAD equal to the PR head (test 9, `update-branch`
stays), `origin/<base>` not in HEAD (test 10), the PR head not in HEAD's history (test 11, the new
stop, in `pr` and in `merge` mode), and the positive cases on a change PR (8) and on an archive PR
(12).

**Alternatives.**

- *Reorder `deliver-check`'s item 5 so "ahead" wins over `CONFLICTING`.* Rejected:
  `deliver-check.mjs` is downloaded by every project's `devkit-reviews` workflow and read by
  `ship-change` and the panel. The override keeps the change inside the loop's layer.
- *Push right after the merge, before `verify` and `review`.* Rejected: the push would put a head
  with stale reviews before `devkit-reviews`, which fails until the reviews land. The `push`
  dispatch sentence of `ship-change` presumes current reviews.
- *A new step name (`push-merged`).* Rejected: `push` and `open-archive-pr` already have rows, agents
  and `ship-change` sentences that do a plain push. A new step would need a row in the loop, the
  panel and the skill for the same action.

## D-3 The loop's rows and the skill (AC-2, AC-7)

- `plugins/openspec/hooks/change-loop.mjs`: the `'push-rebased'` row goes. The comment above `ROWS`
  says "the override of conduct-check" in place of "the two overrides of conduct-check".
- `plugins/openspec/skills/devkit/SKILL.md`:
  - Line 75 keeps its sentence word for word ("Run `detail.command` in the worktree, then the
    project's test command; report the JSON and the result; change nothing else. `Outcome: failure`
    ends the run blocked.") and gains one sentence after it: "The command merges `origin/<base>`
    into the branch and commits the merge with the release renumbered above the base's; then the
    loop hands `verify`, `review` and a plain `push` (`open-archive-pr` on an archive branch) with
    `detail.command` `git push origin <branch>`, never a force push."
  - Line 76 (`push-rebased`) is deleted.
  - Line 136: "(its `review`, `gate`, `resolve-release-conflict`, `push-rebased` and `switch-script`
    steps too)" becomes "(its `review`, `gate`, `resolve-release-conflict` and `switch-script` steps
    too)".

## D-4 The CI-pin assertion reads the manifest (AC-4)

`release-merge.mjs` exports one helper next to `setPins`, on the same `PIN_MARKER` and `PIN_TOKEN`:

```js
// Every pin (`v<x.y.z>`) on every pin line of `text`, in order; [] for a text with no pin line.
export function pinsIn(text) // -> string[]
```

Input it does not expect: an empty text, or a text with no pin line, gives `[]`. A pin line that
holds no pin adds nothing (as `setPins` leaves it alone). CRLF endings are read like LF ones. The
assertion below fails on `[]`, so a doc that lost its pins does not pass.

In `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the
answers", the pin block keeps only the slice-merge floor line
(`assert.match(flow, /moves this pin to \`v0\.20\.0\` or later first/, …)`). Every other line of the
block that names a release goes: the `v0\.21\.1` match, the `staleV20` filter and its `deepEqual`,
and every `doesNotMatch` for `v0.21.0`, `v0.19.1`, `v0.19.0`, `v0.18.0`, `v0.18.1`, `v0.17.1`,
`v0.16.0` and `v0.15.1`. In their place:

```js
const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;
assert.ok(pinsIn(flow).length >= 3, 'the CI snippet holds its pins');
assert.deepEqual(pinMismatches(flow, version), [], 'every CI pin names the devkit-openspec version of its manifest');
```

`pinMismatches(text, version)` is a test-local helper of `change-loop.test.mjs`,
`pinsIn(text).filter((p) => p !== \`v${version}\`)`. Test 15 (D-5) uses it too. The invariant stays
"the CI snippet pins the current devkit-openspec release", and the suite stays
`change-loop.test.mjs`. The `doesNotMatch` lines for older releases are covered by the new
assertion: an older pin is a mismatch.

## D-5 The tests (AC-1 to AC-7)

Every new test's name starts `release-merge-conflict <n>: `, so
`--test-name-pattern="^release-merge-conflict "` selects them all.

In `plugins/openspec/hooks/release-merge.test.mjs`, section "the CLI", with the file's fixtures
(`releaseRepo` with its bare `origin`, `bump`, `write`, `commit`, `run`, `read`, `versionOf`, `meta`,
`A_MINOR`, `B_PATCH`, and the pin fixtures `pinSide`, `pinPack`, `pinDoc`, `pinInitial`). Two new
test-local helpers serve every test that needs them: `noMerge(root)` (true when
`git rev-parse -q --verify MERGE_HEAD` fails) and `PIN_FIXTURE`. `PIN_FIXTURE` is the release of test
"both sides move the pin and add text apart": `a: pinSide('0.7.0', '0.11.0')`,
`b: pinSide('0.6.1', '0.10.1')`, `initial: pinInitial`, `extraA` with `pinPack('0.11.0')` and
`pinDoc('0.11.0', { top: 'TOP A' })`, `extraB` with `pinPack('0.10.1')` and
`pinDoc('0.10.1', { bottom: 'BOTTOM B' })`.

| Test | Guard or label | Fixture | Expected | AC |
|---|---|---|---|---|
| `release-merge-conflict 1: a base that released after the branch forked is merged, renumbered and committed, and a plain push of the result is accepted` | the merge commit (positive) | `releaseRepo({ ...PIN_FIXTURE, gen: true })`; then `git push -q origin feature` (the PR head, `oldHead`) | exit 0; `HEAD^1` is `oldHead`, `HEAD^2` is `origin/main`, `out.newHead` is `HEAD`; `git merge-base --is-ancestor oldHead HEAD`; `git status --porcelain` empty; at `HEAD`: devkit-openspec `0.11.1` in its `plugin.json` and in the marketplace, `metadata.version` `0.7.1`, `CHANGELOG.md` with `## 0.7.1 — at 0.10.1` above `## 0.7.0 — at 0.11.0` above `## 0.6.0 — first` and no `<<<<<<<`, `pinsIn` all `v0.11.1` with `TOP A` and `BOTTOM B` kept, `docs/catalog.md` `regenerated\n`; subject `chore(release): merge origin/main and renumber the release above it`; `origin`'s `feature` still `oldHead`; then `git push origin feature` (no flag) exits 0 and `origin`'s `feature` is `HEAD` | AC-1, AC-3, AC-6 |
| `release-merge-conflict 2: an aborted merge leaves an untracked file and an unstaged openspec/ edit as they were` | abort restores the working tree (negative) | `releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'openspec/notes.md': 'n\n' }, extraA: { 'README.md': 'theirs\n' }, extraB: { 'README.md': 'mine\n' } })`; then `notes.txt` written untracked and `openspec/notes.md` edited, unstaged | exit 2; `conflicts` holds `README.md`; `HEAD` is `oldHead`; `noMerge`; `git status --porcelain` equals the status taken before the run; both files hold their text | AC-5 |
| `release-merge-conflict 3: an unstaged openspec/ edit stays out of the merge commit` | unstaged edit under `openspec/` (positive) | `releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'openspec/notes.md': 'n\n' } })`; `openspec/notes.md` edited, unstaged | exit 0; `HEAD:openspec/notes.md` is `n\n`; the file still holds the edit and shows ` M` | AC-1 |
| `release-merge-conflict 4: a tracked change outside openspec/ stops the run with exit 3 and touches nothing` | tracked change outside `openspec/` (negative) | `releaseRepo({ a: A_MINOR, b: B_PATCH })`; `README.md` edited, unstaged | exit 3; stderr names `README.md`; `HEAD` is `oldHead`; `noMerge`; status unchanged | AC-5 |
| `release-merge-conflict 5: a rebase in progress stops the run with exit 3` | rebase in progress (negative) | `releaseRepo({ a: A_MINOR, b: B_PATCH })`; `git rebase origin/main` (throws on its conflict) | exit 3; stderr matches `/a rebase is in progress/`; `.git/rebase-merge` still exists | AC-5 |
| `release-merge-conflict 6: a generator that fails after the files are rewritten aborts the merge and restores every file` | failure after the writes (negative) | `releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'scripts/gen-catalog.py': 'import sys\nsys.exit(1)\n' } })` | exit 2; `error` matches `/gen-catalog\.py failed/`; `HEAD` is `oldHead`; `noMerge`; status empty | AC-5 |
| `release-merge-conflict 7: a branch that already holds origin/<base> is left alone with exit 0` | base already an ancestor | `releaseRepo({ a: A_MINOR, b: B_PATCH })`; `git merge -q -s ours --no-edit origin/main` | exit 0; `out.files` `[]`; `out.newHead` and `HEAD` equal the head before the run | AC-1 |

In `plugins/openspec/hooks/conduct-check.test.mjs`, section "the overrides", with the file's
fixtures (`roundRepo`, `readyChange`, `writeReviews`, `openPr`, `presetMerge`, `archiveRepo`,
`archiveGh`, `ARCHIVE_PR`, `prJson`, `byId`, `planStep`, `headOf`, `put`, `commitAll`, `git`). Two
new fixtures replace `rebasedChange` and `rebasedArchive`, which go:

- `mergedChange({ config = CONFIG } = {})`: `roundRepo` with `CHANGELOG.md` `# c\n` (plus
  `MERGE_FILES` in merge mode); `readyChange(b, 'b', { files: { 'CHANGELOG.md': '# c\nb entry\n' } })`;
  `oldHead = headOf(b)`; `t.commitOrigin({ 'CHANGELOG.md': '# c\norigin entry\n' })`;
  `openPr(t, b, 'b', { mergeable: 'CONFLICTING' })`, so the PR head is `oldHead`. In `b`:
  `git merge -q --no-ff --no-commit origin/main` (exit 1 on its conflict), `CHANGELOG.md` written
  `# c\nb entry\norigin entry\n`, `git add -- CHANGELOG.md`, `git commit -q --no-edit`. Returns
  `{ t, b, oldHead }`.
- `mergedArchive({ config = CONFIG } = {})`: `archiveRepo({ config, archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n' } })`;
  `oldHead`; `origin` edits `CHANGELOG.md`; the same merge, resolution and commit in `wt`;
  `archiveGh(t, wt, 'b', [ARCHIVE_PR({ headRefOid: oldHead, mergeable: 'CONFLICTING' })])`.

| Test | Guard or label | Expected | AC |
|---|---|---|---|
| `release-merge-conflict 8: after a release merge that is not pushed, verify and review run again, then push hands a plain git push` | `unpushedMerge` true on a change PR (positive) | `mergedChange()`: `planStep` `['verify', 'subagent']`. Then `writeReviews(b, 'b', headOf(b))` and `commitAll`: `c.deliver.next.step` `blocked` with `conflict: true`; `planStep` `['push', 'subagent']`; `c.next.agent` `devkit-core:commit-and-pr`; `c.next.command` `['git', 'push', 'origin', 'b']`; `c.next.number` 12; `JSON.stringify(c.next)` does not match `/--force/` | AC-1, AC-2 |
| `release-merge-conflict 9: a merge already pushed while GitHub still reports the conflict keeps update-branch in merge mode` | HEAD equals the PR head (negative) | `mergedChange({ config: MERGE_CONFIG })`, `presetMerge`, reviews written and committed as in 8, PR set to `headRefOid: headOf(b)`, `mergeable: 'CONFLICTING'` | `[c.next.step, c.next.actor]` `['update-branch', 'main']` | AC-2 |
| `release-merge-conflict 10: a local commit ahead of the PR head without origin/<base> is not pushed by the override` | `origin/<base>` not in HEAD (negative) | `readyChange`; `oldHead`; `origin` commits `other.txt` (no conflict); a local commit of `openspec/changes/b/notes.md`; PR head `oldHead`, `mergeable: 'CONFLICTING'`; `pr` mode | `c.next.step` `blocked`; `c.state` matches `/merge conflicts/` | AC-5 |
| `release-merge-conflict 11: a PR head that is not in the local history is stopped, neither pushed nor updated, in pr and in merge mode` | PR head not in HEAD's history (negative; the new stop) | `mergedChange()` and `mergedChange({ config: MERGE_CONFIG })` with `presetMerge`, reviews as in 8, PR `headRefOid: 'f'.repeat(40)`, `mergeable: 'CONFLICTING'` | both: `c.next.step` `blocked`, `c.next.actor` `stop`, `c.state` matches `/not in local history/` | AC-5 |
| `release-merge-conflict 12: an archive PR after its release merge hands open-archive-pr with a plain push; a foreign head stays stopped` | `unpushedMerge` on an archive PR (positive), foreign head (negative) | `mergedArchive()`; then the archive PR at `headRefOid: 'f'.repeat(40)` | first: `planStep` `['open-archive-pr', 'subagent']`, `c.next.command` `['git', 'push', 'origin', 'chore/archive-b']`, no `--force`; then: `c.next.step` `blocked` (the override's own stop, as for a conflict in README.md; corrected in task 2.1), `c.next.actor` `stop`, `c.state` matches `/^blocked: archive \(archive-pr\): .*not in local history/` | AC-1, AC-2 |
| `release-merge-conflict 13: auto-merge still on is switched off before the push, on a change PR and on an archive PR` | auto-merge first (negative) | `mergedChange({ config: MERGE_CONFIG })` with `autoMergeRequest: { enabledAt: 'x' }`; `mergedArchive({ config: MERGE_CONFIG })` with the same on its PR | both `c.next.step` `disable-auto-merge` | AC-2 |

In `plugins/openspec/hooks/change-loop.test.mjs`:

| Test | Guard or label | Expected | AC |
|---|---|---|---|
| `release-merge-conflict 14: a push row with a plain command goes to the commit agent` (section "decide", in place of B2a) | the `push` row with a command | `build(rowOf('push', { number: 12, branch: 'feat', command: ['git', 'push', 'origin', 'feat'] }))`: `[kind, agent, step, stage]` `['agent', COMMIT, 'push', 'delivery']`; `detail.command` as given | AC-2 |
| `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` (section "docs") | pin mismatch (negative of AC-4) | the real `docs/openspec-flow.md`, its first `<commit sha of v<x>>` changed to `<commit sha of v9.9.9>`: `pinMismatches(text, version)` is `['v9.9.9']`; `pinMismatches('', version)` is `[]` and `pinsIn('')` is `[]` | AC-4 |
| `release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push` (section "docs") | AC-7 | `docs/openspec-flow.md` includes `**Release-file conflicts: \`release-merge.mjs\`.**`, `git merge --no-ff --no-commit origin/<base>` and `git push origin <branch>`, and matches none of `/push-rebased/`, `/release-rebase\.mjs/`, `/force-with-lease/`; `plugins/openspec/skills/devkit/SKILL.md` includes the new sentence of D-3 and matches neither `/push-rebased/`, `/rebase/` nor `/--force/`; `plugins/openspec/README.md` links `hooks/release-merge.mjs` | AC-2, AC-7 |

**Test first.** Each phase writes its tests first and runs them on the code before its fix, saving
the output as printed. That run is the task's check, never a gate.

- Phase 1 (task 1.3) runs
  `node --test --test-name-pattern="^release-merge" plugins/openspec/hooks/release-merge.test.mjs`
  after the rename and before the merge mode, into `proof/red-1.txt`. Expected: fail 1 (no merge
  commit), 2 and 3 (the rebase refuses an unstaged edit, exit 3), 4 (the rebase refuses a tracked
  edit with exit 3, but its message does not name the path), 5 (the rebase code aborts the rebase
  and redoes it, exit 0), and the rewritten tests that expect a merge commit (D-6). Pass: 6 (today's
  restore) and 7 (already an ancestor). Those two pin guards the new code keeps (corrected in task
  1.3: the red run showed 4 fails on the missing path in stderr).
- Phase 2 (task 2.1) runs
  `node --test --test-name-pattern="^release-merge-conflict " plugins/openspec/hooks/change-loop.test.mjs`
  (which loads the conduct-check and release-merge suites) before the override, into
  `proof/red-2.txt`. Expected: fail 8 and 12 (no override hands the push; 8 ends `blocked`, 12
  `stop-archive`), 11 (today `pr` mode says "has merge conflicts" and `merge` mode says
  `update-branch`) and 16 (the docs still describe the rebase). Pass: 9, 10, 13 and 14 (guards and
  rows that exist today), 15 (`pinsIn` exists after phase 1), and tests 1 to 7 (phase 1 done).

A result that differs from these lists is looked at before the fix. Either the fixture does not
build the state the table says, or the analysis is wrong. `design.md` is corrected in the same task.

## D-6 Existing tests that pin the replaced rules

The searches, run while planning:
`git grep -n "push-rebased\|release-rebase\|force-with-lease\|rewritten\|rewrote\|rebase" -- '*.test.mjs' '*.test.ts' '*.test.tsx' 'scripts/*.py'`
and `git grep -n "v0\.[0-9]*\.[0-9]" -- '*.test.mjs'`. The table of `tasks.md` ("Existing tests
that pin the replaced rules") names each test found: its invariant, its layer, its suite, and
whether it is kept, rewritten or removed. Tests the searches found that pin no replaced rule, and
stay untouched:

- `conduct-check.test.mjs`: the dependency rebase tests ("after A's tick lands on origin/main, B's
  worktree without the tick gives rebase; after the rebase, audit", the `rebased()` fixture users,
  "a rebase left in progress is blocked, and the worktree is still found"). They cover the planning
  rows, which this change leaves alone.
- `deliver-check.test.mjs`: the `merge_method: rebase` tests (the GitHub merge method, not a branch
  rewrite), `REAL_ROUND1_LINE` (a quoted review line, data), and the two pin tests that already read
  the manifest ("the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec
  version, …", "AC-8 release-ready: …").
- `guard.test.mjs` line 211: `git push --force-with-lease` stays an allowed command of the guard.
- `project-loop.test.mjs` and `ship-entry.test.mjs`: the slice-merge floor `v0.20.0`, a fixed
  release that no bump moves.
- `merge-setup.test.mjs`, `github-setup.test.mjs`, `flow-check.test.mjs`, `roadmap-loop.test.mjs`,
  `project-loop.test.mjs`: "rebase" is the merge method, and "rewritten"/"rewrote" are unrelated words.
- `plugins/panel/hooks/report.test.tsx`: `ACTOR_STEPS` lists `push-rebased`, and the test checks the
  panel has a label for each listed step. The panel keeps that label (Non-Goals), so the test still
  holds. Its comment ("every step conduct-check's actorOf names") becomes a superset; left for the
  panel's next change, recorded in the Workflow follow-up.

## D-7 Documents and release (AC-2, AC-3, AC-7, AC-8)

- `docs/openspec-flow.md`:
  - "Delivery rows": "Three overrides sit in front of that mapping:" becomes "Two overrides sit in
    front of that mapping:".
  - "Release-file conflict" bullet: one sentence added after "gives `resolve-release-conflict`
    (with `paths`)": "Once that merge is committed and not pushed (the local head holds
    `origin/<base>` and is ahead of the PR head, which GitHub still reports in conflict), the same
    override gives `push` on a change PR and `open-archive-pr` on an archive PR, with the command
    `git push origin <branch>`: a plain push, never a force push." And after the clause on a clean
    merge: "A clean merge whose PR head is not in the local history (someone else pushed, or an
    earlier version rebased the branch) is `blocked: item 5 (PR #<n> head <sha> is not in local
    history)`, or `blocked: archive (archive-pr): …` on an archive PR, never `update-branch`."
  - The "A branch we rewrote" bullet is deleted.
  - The section "Release-file conflicts: `release-rebase.mjs`" becomes "Release-file conflicts:
    `release-merge.mjs`", with the command `node <plugin>/hooks/release-merge.mjs --base <base> [--json]`.
    - "Classification": "aborts: the branch is back at its old head, the worktree is clean, the exit
      code is 2" becomes "aborts: the merge is undone, the branch is at its old head with no merge in
      progress, the working tree is as it was, the exit code is 2". The sentence "The check repeats at
      every stop of the replay, and a conflict in the file beyond the pin aborts like any other path"
      becomes "A conflict in the file beyond the pin aborts like any other path". "the base, the
      upstream and the change's side" becomes "the merge base, the base's side and the change's side".
    - "The replay keeps the base" becomes "**The merge keeps the base's side.**", text: the script
      refuses to start (exit 3) with an uncommitted change to a tracked file outside `openspec/` or a
      rebase in progress, and aborts a merge an earlier run left in progress and starts again. It runs
      `git merge --no-ff --no-commit origin/<base>` and keeps the base's side of each conflicted
      release file. During a merge that is `git checkout --theirs`: `--theirs` is `origin/<base>`,
      `--ours` the branch. The change's side is not lost: it is read from the old head. The merged
      pin file takes the resolved devkit-openspec version. When the base has none, a conflicting pin
      aborts with an `error` starting `cannot set the pin:`.
    - "The version rule", "CHANGELOG", "Catalog": unchanged.
    - "The edits stay uncommitted" becomes "**The merge is committed, never pushed.**", text: the
      script stages each file it rewrites and commits the merge as
      `chore(release): merge origin/<base> and renumber the release above it`. The new head is a merge
      commit whose parents are the old head and `origin/<base>`, and the PR's head stays an ancestor of
      it. A failure before the commit (a hook, the generator) aborts as in "Classification". The
      subagent runs the project's test command and stops on red. Every pin in the doc is rewritten to
      the resolved devkit-openspec version and the file is listed in `files` (kept from today's text);
      a project without a devkit-openspec pack gets no rewrite. The renumbered files are outside
      `openspec/`, so the evidence and every review are stale after the merge (the first-parent rule
      of "The `Commit:` staleness rule"). `verify` and `review` run again, then the plain push of
      "Release-file conflict" above. ADR 0002 accepts that cost ("Strict up-to-date re-runs stale
      reviews").
  - Troubleshooting row `blocked: item 5`: "Resolve the conflict (or reopen) and run it again; the
    flow never resolves conflicts" becomes "Resolve the conflict (or reopen) and run it again; the
    loop resolves only a conflict in release files, by a merge of the base (see "Release-file
    conflicts")".
  - The CI pins: every `v0.21.1` of the CI snippet, its comment and its by-hand command (three lines)
    becomes `v0.22.0`.
- `plugins/openspec/README.md`, the tool's row: link `[hooks/release-merge.mjs](hooks/release-merge.mjs)`,
  text "Merges the default branch into a change and resolves conflicts in release files (versions,
  `CHANGELOG.md`, catalog) and the CI pin in `docs/openspec-flow.md` by rule, then commits the merge;
  any other conflicting path aborts and leaves the branch as it was. Never pushes".
- `CONTRIBUTING.md` line 17: "When a change is rebased onto a base that merged a sibling while the
  change was in review (`resolve-release-conflict`, or by hand), re-read what the change consumes from
  that sibling before pushing the rebased head" becomes "When a change merges a base that merged a
  sibling while the change was in review (`resolve-release-conflict`, `update-branch`, or by hand),
  re-read what the change consumes from that sibling before pushing the merged head"; the rest of
  the paragraph stays.
- `openspec/roadmap.md`: a new round after "Round 17h: delivery against a moving base":

  `## Round 17i: the release merge, live` and
  `- [ ] release-merge-live-check (after: release-merge-conflict) — with devkit-openspec 0.22.0 or later installed, the next change whose pull request falls behind another change's release has its release conflict resolved by the loop alone: the loop hands resolve-release-conflict, the merge commit and a plain push land, and no step ends blocked with a pull-request problem; the result is recorded in that change's retro (release-merge-conflict, AC-8)`.
- Release (`CONTRIBUTING.md`, step 5): devkit-openspec 0.21.1 to 0.22.0 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the marketplace
  `metadata.version` 0.25.1 to 0.26.0, and a `CHANGELOG.md` section
  `## 0.26.0 — release conflicts resolved by a merge` with two bullets.
  - **devkit-openspec** 0.22.0: when a pull request conflicts with its base only in release files, the
    release-conflict step merges `origin/<base>` into the branch with `hooks/release-merge.mjs`
    (was `release-rebase.mjs`, which rebased), renumbers the release above the base's and commits the
    merge, never pushing. After the evidence and the review run again, the loop hands a plain
    `git push`. The `push-rebased` step and its force-with-lease push are gone. The CI-pin assertion
    of the hook tests reads the version from the manifest. "The CI snippet now pins `v0.22.0`, the
    release's tag."
  - Docs: the flow document, the `devkit` skill, the pack's README and CONTRIBUTING follow, and the
    roadmap gains a line for the live check.

  `python3 scripts/gen-catalog.py --check` must still pass. The tag `v0.22.0` is pushed after the
  merge (Workflow follow-up). When a sibling releases first, the numbers move at this change's merge
  of `main` (`CONTRIBUTING.md`, step 5). The pin test needs no edit then (D-4).

## Decisions and ADRs

No ADR is needed. The change replaces how one tool resolves a release conflict and how the loop
pushes the result. It keeps every recorded decision:

- ADR 0002: the `devkit-reviews` check still recomputes review currency at the PR head. Its
  consequence "Strict up-to-date re-runs stale reviews after each base update" is what D-2 relies on:
  the merge stales them and they run again before the push. None of its rejected alternatives (the
  owner's merge everywhere, the skill merging at 8/8, a required approval, a merge queue, a
  label-triggered Action) is taken.
- ADR 0003: the release files an archive PR may change without a proposal are unchanged. After the
  merge, `deliver-check.mjs#archiveChanges` diffs `merge-base(origin/<base>, HEAD)..HEAD`, whose merge
  base is `origin/<base>` itself, so the base's own files never enter the archive's file check. The
  rejected "ruleset bypass" alternative is not touched: nothing pushes to the default branch.
- ADR 0011 decision 2: the coordinating session writes no product file. The release files are
  rewritten by the tool inside the `tdd-implementer` hand-off.
- ADR 0012 decision 4: the check still recomputes reviews, findings, gates and acceptance proof at
  the PR head.

No ADR names the rebase or the force push (`requirements.md`, Escalations). The alternatives rejected
in D-1 to D-4 were rejected by the owner's answers or by the reasons given there, not by an ADR.

## Implementation plan

**Per surface.** Hooks (`plugins/openspec/hooks/`): `release-merge.mjs` (D-1, D-4),
`conduct-check.mjs` (D-2), `change-loop.mjs` (D-3), and the tests of D-5 and D-6. Skill:
`plugins/openspec/skills/devkit/SKILL.md` (D-3). Docs and release: D-7. No backend, frontend, worker
or panel surface.

**File structure.**

| Action | Path |
|---|---|
| rename + modify | `plugins/openspec/hooks/release-rebase.mjs` to `plugins/openspec/hooks/release-merge.mjs` (merge mode, `pinsIn`, `writeStaged`, `restore`) |
| rename + modify | `plugins/openspec/hooks/release-rebase.test.mjs` to `plugins/openspec/hooks/release-merge.test.mjs` (tests 1 to 7, the rewrites of D-6) |
| modify | `plugins/openspec/hooks/conduct-check.mjs` (import, `RELEASE_MERGE`, `unpushedMerge`, `releaseConflict`, `deliveryRow`, `SUBAGENT`; `rewrittenBranch` removed) |
| modify | `plugins/openspec/hooks/conduct-check.test.mjs` (import, tests 8 to 13, `mergedChange`, `mergedArchive`; the rewrites and removals of D-6) |
| modify | `plugins/openspec/hooks/change-loop.mjs` (the `push-rebased` row, a comment) |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (tests 14 to 16, the pin block, the rewrites of D-6) |
| modify | `plugins/openspec/hooks/guard.test.mjs` (the import line only) |
| modify | `plugins/openspec/skills/devkit/SKILL.md`, `plugins/openspec/README.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `openspec/roadmap.md` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| create | `openspec/changes/release-merge-conflict/proof/red-1.txt`, `openspec/changes/release-merge-conflict/proof/red-2.txt` |
| delete | none (the two renames keep their history) |

**Estimate.** Optimistic 6 h, likely 9 h, pessimistic 14 h. The pessimistic case is a fixture whose
merge does not build the state a table says (each table names what to check first), a red run that
differs from D-5, and one rerun of the whole suite (13 to 21 minutes).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Setup: merge of `origin/main`, the two renames and their importers | 0.5 | Core | LOW |
| Tests 1 to 7 and the tool rewrites of D-6, red run | 2.0 | Testing | MEDIUM |
| The merge mode of `release-merge.mjs` (`main`, `writeStaged`, `restore`, `pinsIn`) | 1.5 | Core | MEDIUM |
| Tests 8 to 16 and the loop rewrites of D-6, red run | 2.0 | Testing | MEDIUM |
| `unpushedMerge`, `releaseConflict`, `deliveryRow`, `SUBAGENT`, the loop row | 0.75 | Core | MEDIUM |
| The pin assertion (D-4) | 0.25 | Testing | LOW |
| Flow doc, skill, README, CONTRIBUTING (D-3, D-7) | 0.75 | Documentation | LOW |
| Release: versions, CHANGELOG, three pins, roadmap line, catalog check | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.75 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The tool stages a person's uncommitted edit into the merge commit, or an abort loses one | LOW × HIGH | Step 4 refuses tracked edits outside `openspec/`, the only place release files live. `writeStaged` stages only the tool's own writes. `restore` aborts the merge and checks out only the paths the run wrote. Tests 2, 3, 4 and 6 |
| A local merge not pushed meets `update-branch`, and GitHub merges onto a head the branch has moved past | MEDIUM × HIGH | `unpushedMerge` comes before the clean-merge branch (D-2). Test 8 positive, tests 9 to 11 for each condition of the guard |
| The tool and the loop classify a pin conflict differently (stage orientation) | LOW × MEDIUM | `mergeStages` maps `ours` to the base's side, as `threeVersions` does (D-1 step 7). Test 1 conflicts in the pin file |
| A project's pre-commit hook or commit signing makes the tool's commit fail | LOW × MEDIUM | Step 12 aborts and restores. The error names `git commit failed`, and the run ends blocked for the owner (`Outcome: failure`) |
| A branch rewritten by an older devkit-openspec (its PR head only in the reflog) loses override 2 | LOW × LOW | Migration Plan: the change stays `blocked: item 5 … not in local history`, and the owner pushes it by hand once |
| `release-rebase.test.mjs` "leaves no temporary folder" tests race when suites run in parallel | MEDIUM × LOW | Every gate runs one entry file with `--test-concurrency=1` and a private `TMPDIR` (`/tmp/devkit-rmc`) |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | Every hook gate sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`. The new conduct and loop tests use the files' existing env helpers |
| A sibling in flight (`stage-roles`, `delivery-models`) edits the same files (`conduct-check.mjs#SUBAGENT`, `change-loop.mjs#ROWS`, the change-coordination spec, the flow doc) | MEDIUM × MEDIUM | The branch merges `main` before the last verify and review. Those files hold no release lines, so a conflict there is resolved by hand and named in `evidence.md` |
| An existing test pins a replaced rule outside the `tasks.md` table | LOW × MEDIUM | D-6's searches covered every suite. The whole suite runs in task 3.3 before any review |

**Assumptions.**

- A-1: Git 2.38 or later (the loop already needs `merge-tree --write-tree`). `git merge --abort`
  resets the files the run staged and keeps unstaged edits and untracked files. Checked on Git 2.50.1
  while planning (Context). If a Git version behaved otherwise, test 2 would fail.
- A-2: `deliver-check` reports item 5 `CONFLICTING` before comparing heads, and the archive path checks
  `conflicts` before `headRel` (`deliver-check.mjs#prItem` and the archive steps, read at `8c8b7b8`).
  If that order changed, D-2's branch would be dead code, not wrong.
- A-3: the renumbered files are outside `openspec/`, so `deliver-check.mjs#staleness` makes evidence
  and reviews stale after the merge (merge-staleness-first-parent, `openspec/specs/change-delivery/spec.md`,
  "A merge commit is judged by what it brings into the branch").
- A-4: `state.branch` is the checkout's branch for a change and for an archive. Today's
  `rewrittenBranch` uses it for both, and its archive test expects `chore/archive-b`.
- A-5: `devkit-core:commit-and-pr` pushes plainly unless the caller says the branch was rewritten
  (`plugins/core/agents/commit-and-pr.md`, step 4). The `push` row of `ship-change` says nothing of a
  rewrite.
- A-6: `git merge` refuses to start with staged changes or local changes it would overwrite (Git's
  documented behaviour), so step 6's exit 3 leaves the tree untouched.

**Dependencies.** `merge-staleness-first-parent` (archived, `openspec/specs/change-delivery/spec.md`):
the staleness after the merge. The archive of `review-writer-prompt` (#59, `c561553` on
`origin/main`): the base this branch merges first (task 1.1). ADR 0002, 0003, 0011 and 0012 as cited.

## Migration Plan

No file format or exit code changes. The JSON of `conduct-check` and the loop no longer gives
`push-rebased`. `push` and `open-archive-pr` gain `branch` and `command` fields when they come from
the override. A session gets the new step when it updates devkit-openspec
(`claude plugin update devkit-openspec@devkit`, `CONTRIBUTING.md`). A branch that an older version
rebased, with its PR head only in the reflog, is `blocked: item 5 (… not in local history)` after the
update. The owner pushes it once by hand, with the lease the old step named. Rollback: revert the
change's pull request. The rebase tool and override 2 come back together.
