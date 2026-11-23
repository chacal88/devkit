<!-- devkit-stage tasks result=passed attempt=1 commit=8c8b7b89ca898242699b60e964e74a183e98258f -->
# Tasks

Change: `release-merge-conflict` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, command, function, file and test
name is in `design.md`: D-1 the tool, D-2 the override, D-3 the loop rows and the skill, D-4 the pin
assertion, D-5 the new tests, D-6 the search for existing tests, D-7 documents and release. The
implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate:

- sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a pull-request run on CI does (a new test that
  passes only without them is not done);
- runs one entry file with `--test-concurrency=1` and the private `TMPDIR` `/tmp/devkit-rmc`, so
  the "leaves no temporary folder" tests of `release-merge.test.mjs` do not race with another run.

The entry files load their imports: `conduct-check.test.mjs` runs the deliver-check and release-merge
suites too, and `change-loop.test.mjs` runs those and the conduct-check suite. The tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`guard.test.mjs`, 13 to 21 minutes) runs once, in
3.3, as a background command of the tool, never with a shell `&`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Every new test's name starts `release-merge-conflict <n>: ` (D-5). A new conduct-check or
change-loop test takes its env from that file's existing helpers. Test first: tasks 1.3 and 2.1
write the tests, run them on the code before the fix and save the output, as printed, under
`openspec/changes/release-merge-conflict/proof/`. That run is the task's check, never a gate. An
existing test is edited only as the table "Existing tests that pin the replaced rules" below says;
name its invariant in the commit message. Leave no backup or scratch file in the tree, and end every
task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `release-only-conflict-merges` | 1.3, 1.4, 1.5, 2.1, 2.2, 2.5, 3.3 |
| AC-2 | `plain-push-after-merge` | 2.1, 2.2, 2.4, 2.5, 3.3 |
| AC-3 | `renumber-above-base` | 1.3, 1.4, 1.5, 3.1, 3.3 |
| AC-4 | `pin-test-reads-manifest` | 2.1, 2.3, 2.5, 3.1, 3.3 |
| AC-5 | `other-conflicts-stay-blocked` | 1.3, 1.4, 1.5, 2.1, 2.2, 2.5, 3.3 |
| AC-6 | `scratch-repo-proof` | 1.3, 1.4, 1.5, 3.3 |
| AC-7 | `docs-follow` | 2.1, 2.4, 2.5, 3.3 |
| AC-8 | `dogfood-owed` | 3.2 (the line); the live check itself is the roadmap line's change (Workflow follow-up) |

## Existing tests that pin the replaced rules

Found by the searches of `design.md` D-6. The layer is the code the test exercises. "Prefix only"
means the name's `release-rebase` becomes `release-merge` (`release-rebase pin` becomes
`release-merge pin`) and nothing else changes. "+ `noMerge`" means one assertion,
`assert.ok(noMerge(root))`, is added after the existing ones.

| Suite | Layer | Test (current name) | Invariant | Action |
|---|---|---|---|---|
| `release-rebase.test.mjs`, renamed `release-merge.test.mjs` | the release tool's rules | the seven pure-function tests (`bumpKind`, `applyBump`, `resolveVersion`, `resolveManifest`, `manifestEditsBeyondVersion`, the two `resolveChangelog`) | the version and changelog rule | kept, prefix only |
| same | the pin rule | the four `setPins` tests (the real-doc one included), the two `mergePins` tests, the three `classifyConflict` tests | the pin-line rule and the masked pin merge | kept, prefix only |
| same | the release tool's CLI | `release-rebase: a minor bump on main and a patch on the branch resolve to one linear history, uncommitted` | a release-only conflict resolves to the base's version plus the change's bump, and the tool never pushes | rewritten, renamed `release-merge: a minor bump on main and a patch on the branch resolve to a merge commit holding the renumbered release`: `HEAD^1` is the old head, `HEAD^2` is `origin/main`, `git rev-list --merges --count origin/main..HEAD` is `1`, the values are read at `HEAD`, `git status --porcelain` is empty, and `origin`'s `main` is unchanged |
| same | same | `release-rebase: the base side is kept during the replay and the final values come from oldHead` | the change's own bump is read from the old head, not lost to the base's side | rewritten, renamed `release-merge: the base side is kept during the merge and the final values come from oldHead`: at `HEAD`, pack `a` is `0.7.1` and `CHANGELOG.md` holds `## 0.7.1 — mine` |
| same | same | `release-rebase: a branch that bumps another pack resolves only metadata.version and its own pack` | only bumped packs and the metadata move | kept, prefix only |
| same | same | `release-rebase: only CHANGELOG and marketplace conflict, the clean-merged plugin.json is still resolved` | a manifest that merged cleanly is still renumbered | rewritten, prefix and its last assertion: `HEAD:.claude-plugin/marketplace.json` has `metadata.version` `0.7.1` (was the intermediate rebase commit's `0.7.0`) |
| same | same | `release-rebase: a conflict outside the release files aborts to oldHead with the conflicts listed` | AC-5: a non-release conflict aborts and restores | rewritten, prefix and `existsSync(join(root, '.git', 'rebase-merge'))` replaced by `noMerge(root)` |
| same | same | `release-rebase: a manifest edited beyond its version aborts to oldHead` | an edit beyond a version is not resolved by rule | kept, prefix + `noMerge` |
| same | same | `release-rebase: an invalid JSON manifest on the branch restores to oldHead with exit 2` | a failure after the replay restores | rewritten, prefix and the `rebase-merge` check replaced by `noMerge(root)` |
| same | same | `release-rebase: a docs/catalog.md conflict runs scripts/gen-catalog.py, and aborts without it` | the catalog is regenerated, never merged by hand | kept, prefix + `noMerge` in the second half |
| same | same | `release-rebase: a rebase left in progress is aborted and redone` | a run killed midway does not wedge the next one | rewritten, renamed `release-merge: a merge left in progress is aborted and redone`: `git merge --no-commit origin/main` (throws on its conflict) leaves `MERGE_HEAD`; the run exits 0, `out.oldHead` is the branch's head and `HEAD^2` is `origin/main` |
| same | same | `release-rebase: two new CHANGELOG entries abort to oldHead` | one new entry per change | kept, prefix + `noMerge` |
| same | same | `release-rebase: a missing origin/<base> and an unknown option are setup errors (exit 3)` | setup errors are exit 3 | kept, prefix only |
| same | the release tool's CLI, the pin | `release-rebase pin: both sides move the pin and add text apart, the rebase merges them and the worktree takes the resolved version (AC-4)` | a pin-only conflict keeps both texts and takes the resolved version | rewritten, renamed `release-merge pin: both sides move the pin and add text apart, the merge keeps both texts and commits the resolved version (AC-4)`: at `HEAD` the doc holds `TOP A` and `BOTTOM B` with every pin `v0.11.1`, and `git status --porcelain` is empty |
| same | same | `release-rebase pin: both sides edit the same paragraph, the run aborts to the old head (AC-5)` | a conflict beyond the pin aborts | rewritten, prefix and the `rebase-merge` check replaced by `noMerge(root)` |
| same | same | `release-rebase pin: a renumbered pack with no conflict in the doc keeps the change commit and rewrites the worktree (AC-6)` | the pins follow the renumbered pack without a conflict in the doc | rewritten, renamed `release-merge pin: a renumbered pack with no conflict in the doc commits the resolved pins in the merge (AC-6)`: `HEAD^1` pins `v0.10.1`, `HEAD` pins `v0.11.1` |
| same | same | `release-rebase pin: a change that did not bump devkit-openspec takes the base version for every pin (AC-6)` | the base's version when the change did not bump the pack | kept, prefix only |
| same | same | `release-rebase pin: without a devkit-openspec pack a pin conflict stops with "cannot set the pin:", and no conflict leaves the file alone` | no pack, no pin rewrite | kept, prefix + `noMerge` in the first half |
| same | same | `release-rebase pin: two change commits that both touch the pin file are resolved at each stop` | several change commits touching the pin file resolve together | rewritten, renamed `release-merge pin: two change commits that both touch the pin file are resolved in the one merge`: the doc at `HEAD` holds `TOP A`, `BOTTOM B` and `body 2 edited C` with every pin `v0.11.1`; `git rev-list --count origin/main..HEAD` is `3` |
| `conduct-check.test.mjs` | the loop's override | import of `pinDoc` from `./release-rebase.test.mjs` | the shared pin fixture | rewritten: `./release-merge.test.mjs` |
| same | same | `conduct: a change PR in conflict only in release files is resolve-release-conflict with the paths (AC-6)` | a release-only conflict gives the step, its paths and its command | rewritten: `/release-rebase\.mjs$/` becomes `/release-merge\.mjs$/` |
| same | same | `conduct: right after release-rebase deliver-check says commit, conduct-check says push-rebased with oldHead, paths and a lease (override 2a)` and `conduct: killed after the commit and before the push is push-rebased with no paths (override 2b)` | after a rebase the push is forced with a lease | removed with the `rebasedChange` fixture: the rule is gone; test 8 states the new one |
| same | same | `conduct: after the force push both are stale: verify, then review (override 2c)` | after the release resolution the evidence and the reviews run again | removed; the invariant moves to test 8 |
| same | same | `conduct: auto-merge still on gives disable-auto-merge first (override 2d)` | auto-merge is switched off before anything | removed; the invariant moves to test 13 (change PR half) |
| same | same | `conduct: a PR head that is not in the local reflog stays blocked, not in local history (override 2e)` | a push by someone else stays blocked | kept: `deliver-check`'s own rule holds it without override 2 |
| same | same | `conduct: the same push-rebased override holds on an archive PR (override 2f, P3c)` | the archive PR gets the same push, and a foreign head stays stopped | removed with the `rebasedArchive` fixture; the invariant moves to test 12 |
| same | same | `conduct: auto-merge on an archive PR whose head we rewrote is disabled first (override 2f, P3a)` | auto-merge is switched off before anything, on an archive PR | removed; the invariant moves to test 13 (archive half) |
| same | same | `conduct: git merge-tree exit 0 (GitHub is stale) keeps what deliver-check says in pr mode` and `conduct: git merge-tree exit 0 gives update-branch in merge mode (GitHub's conflict view is stale)` | a clean merge at the PR head keeps today's answer | kept: the negative of `unpushedMerge` when `HEAD` is the PR head |
| `change-loop.test.mjs` | the loop's rows | `change-loop decide: B1a a conflict only in release files goes to the implementer with the command and the paths` | the row passes the command and paths through | rewritten: the literal `'/hooks/release-rebase.mjs'` becomes `'/hooks/release-merge.mjs'` |
| same | same | `change-loop decide: B2a a branch the loop rebased goes to the commit agent with the old head` | `push-rebased` goes to `commit-and-pr` | removed; test 14 states the plain push |
| same | same | `change-loop decide: the B rows are exactly the steps the checkers can return` | the rows equal the returnable steps | rewritten: `'push-rebased'` leaves the "the scan sees" list; add `assert.equal(returnable.has('push-rebased'), false)` and `assert.doesNotMatch(overrides, /--force/)` |
| same | same | `change-loop decide: the agent of a delivery hand-off is the one the checker's row names, and the loop's own map only when the row names none` | the row's agent wins | rewritten: `'push-rebased'` in its list becomes `'push'` |
| same | the loop, end to end | `change-loop next: a pull request conflicting only in release files hands resolve-release-conflict to the implementer` | a release-only conflict reaches the implementer | rewritten: `/release-rebase\.mjs$/` becomes `/release-merge\.mjs$/` |
| same | the skill | `change-loop skill: the two override sentences of the release conflict and the rebased branch` | the skill carries the release step's dispatch sentence | rewritten, renamed `change-loop skill: the release-conflict sentence`: keeps the `resolve-release-conflict` and `Outcome: failure` assertions, drops the two `push-rebased` assertions (test 16 asserts they are gone) |
| same | the docs | `change-loop docs: the design records the answers` | the CI snippet pins the current devkit-openspec release | rewritten: the pin block as `design.md` D-4 says; the slice-merge floor line stays |
| `guard.test.mjs` | the suite's entry | `import './release-rebase.test.mjs'` | the whole suite runs the release tool's tests | rewritten: `import './release-merge.test.mjs'` |

## 1. The release tool merges the base (AC-1, AC-3, AC-5, AC-6)

- [x] 1.1 Bring the branch up to `origin/main` with a plain merge (`git merge --no-edit origin/main`,
  never a rebase; no fetch: `origin/main` is what the coordinating session fetched, `c561553` or
  later). Skip the merge when `origin/main` is already an ancestor of `HEAD`. Check:
  `git merge-base --is-ancestor origin/main HEAD` exits 0; `plugins/openspec/.claude-plugin/plugin.json`
  has `version` `0.21.1`; `git grep -c "v0.21.1" -- docs/openspec-flow.md` prints `docs/openspec-flow.md:3`.
- [x] 1.2 Rename the tool and its tests and update every importer, with no behaviour change yet:
  `git mv plugins/openspec/hooks/release-rebase.mjs plugins/openspec/hooks/release-merge.mjs` and
  `git mv plugins/openspec/hooks/release-rebase.test.mjs plugins/openspec/hooks/release-merge.test.mjs`.
  Then make every edit the table above marks "prefix only", every import and path row (the
  `conduct-check.test.mjs` import, the `guard.test.mjs` import, the two `/release-merge\.mjs$/`
  regexes, the B1a literal), and in `plugins/openspec/hooks/conduct-check.mjs` the import and
  `RELEASE_REBASE` renamed `RELEASE_MERGE` pointing at `release-merge.mjs` (D-2). The tool's usage
  and error strings say `release-merge` (D-1), and the first comment line of each renamed file names
  it `release-merge` (1.4 rewrites the tool's header text). Comments that cite the archived change
  `release-rebase-pin` stay. Check:
  `git grep -n -E "release-rebase(\.mjs|\.test\.mjs|:| pin:)|RELEASE_REBASE" -- plugins/openspec/hooks ':!plugins/openspec/hooks/deliver-check.test.mjs'`
  prints only the comment above the `rebasedChange` fixture in `conduct-check.test.mjs` (that fixture
  goes in 2.1; `deliver-check.test.mjs` holds only the quoted review line `REAL_ROUND1_LINE`); and
  `node --test --test-concurrency=1 plugins/openspec/hooks/release-merge.test.mjs` passes on the
  unchanged rebase code.
- [x] 1.3 In `plugins/openspec/hooks/release-merge.test.mjs`, add the helpers `noMerge(root)` and
  `PIN_FIXTURE` and tests `release-merge-conflict 1` to `release-merge-conflict 7`, exactly as the
  first table of `design.md` D-5 says: one test per guard and label. The positive cases are 1 (the
  merge commit, the renumbering and an accepted plain push to the bare remote), 3 (an unstaged
  `openspec/` edit stays out of the commit) and 7 (a branch that already holds the base). The
  negative cases are 2 (an aborted merge keeps an untracked file and an unstaged edit), 4 (a
  tracked edit outside `openspec/` is exit 3), 5 (a rebase in progress is exit 3) and 6 (a failing
  generator restores every file). Make every "rewritten" edit of the table above for this suite.
  Run `node --test --test-name-pattern="^release-merge" plugins/openspec/hooks/release-merge.test.mjs`
  on the unchanged rebase code and save its output to
  `openspec/changes/release-merge-conflict/proof/red-1.txt`. Check: the file holds all seven new
  names; 1, 2, 3 and 5 and the rewritten tests that expect a merge commit fail, and 4, 6 and 7 pass,
  as D-5 expects. A different result is settled in this task, before 1.4, as D-5 says.
  Note (phase 2): the red run showed test 4 failing (the rebase's message did not name the path), so "4, 6 and 7 pass" above is stale; `design.md` D-5 was corrected and test 4 passes after 1.4.
- [x] 1.4 In `plugins/openspec/hooks/release-merge.mjs`, replace the rebase with the merge, as D-1
  steps 1 to 13 say: `writeStaged`, the new `restore`, the stage reader `mergeStages`, the commit
  message, the refusals, and the export `pinsIn` (D-4). Remove `rebaseInProgress`'s
  `rebase --abort` use and today's `restore`; keep `rebaseInProgress` only for step 3. Update the
  header comment. Check: every test of `release-merge.test.mjs` passes; and
  `git grep -n "rebase" -- plugins/openspec/hooks/release-merge.mjs` prints only the step 3 guard
  (`rebaseInProgress`, its call and its message) and the comment citing the `release-rebase-pin`
  design above `PIN_FILE`.
- [x] 1.5 Gate: `mkdir -p /tmp/devkit-rmc && env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/conduct-check.test.mjs && python3 scripts/check.py` green (the conduct-check suite loads the deliver-check and release-merge suites); covers AC-1, AC-3, AC-5 and AC-6.

## 2. The loop pushes the merge plainly, and the docs follow (AC-1, AC-2, AC-4, AC-5, AC-7)

- [x] 2.1 Write the tests of the second and third tables of `design.md` D-5: in
  `plugins/openspec/hooks/conduct-check.test.mjs` the fixtures `mergedChange` and `mergedArchive` and
  tests `release-merge-conflict 8` to `release-merge-conflict 13`; in
  `plugins/openspec/hooks/change-loop.test.mjs` tests `release-merge-conflict 14` to
  `release-merge-conflict 16` and the test-local helper `pinMismatches` (D-4). One test per guard and
  label. The positive cases are 8 (a change PR's unpushed merge gives `verify`, then `push` with
  `git push origin b`), 12 (an archive PR's gives `open-archive-pr` with a plain push), 14 (the
  `push` row) and 16 (the docs). The negative cases are 9 (the PR head is `HEAD`: `update-branch`
  stays), 10 (`origin/<base>` not in `HEAD`), 11 (a foreign PR head is stopped, in `pr` and in
  `merge` mode), the second half of 12 (a
  foreign archive head stays stopped), 13 (auto-merge first) and 15 (a pin that differs from the
  manifest). Make every "removed" and "rewritten" edit of the table above for these two suites,
  except the pin block of "change-loop docs: the design records the answers" (task 2.3). Run
  `node --test --test-name-pattern="^release-merge-conflict " plugins/openspec/hooks/change-loop.test.mjs`
  on the code before 2.2 and save its output to
  `openspec/changes/release-merge-conflict/proof/red-2.txt`. Check: the file holds all sixteen
  names; 8, 11, 12 and 16 fail and the others pass, as D-5 expects. A different result is settled in
  this task, before 2.2.
- [x] 2.2 In `plugins/openspec/hooks/conduct-check.mjs`, remove `rewrittenBranch` and
  `'push-rebased'` from `SUBAGENT`, add `unpushedMerge` and its branch in `releaseConflict`, add the
  "not in local history" stop to the clean-merge branch, and update `deliveryRow`, its comment and
  the `threeVersions` comment, as D-2 says. Leave the
  `CHANGE_ID_RE` literal and the `NOT_IDS` list as they are. In `plugins/openspec/hooks/change-loop.mjs`,
  remove the `'push-rebased'` row and update the comment above `ROWS` (D-3). Check: tests 8 to 14
  pass; every test the table above names for these two suites passes; and
  `git grep -n "push-rebased\|force-with-lease" -- plugins/openspec/hooks ':!*.test.mjs'` prints only
  the force-push rule of `guard.mjs`.
- [x] 2.3 In `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records
  the answers", replace the pin block as D-4 says: the manifest read, `pinsIn` (imported from
  `./release-merge.mjs`) and `pinMismatches`; the slice-merge floor line stays. Check: that test and
  test 15 pass; and `git grep -c -F 'v0\.' -- plugins/openspec/hooks/change-loop.test.mjs` prints
  `plugins/openspec/hooks/change-loop.test.mjs:1` (the floor line only).
- [x] 2.4 Edit `plugins/openspec/skills/devkit/SKILL.md` (D-3), and `docs/openspec-flow.md` (every
  bullet of D-7 except the CI pins), `plugins/openspec/README.md` and `CONTRIBUTING.md` (D-7).
  Check: test 16 and `change-loop skill: the release-conflict sentence` pass;
  `python3 scripts/check.py` passes (language and links);
  `git grep -n "push-rebased\|release-rebase\|force-with-lease" -- docs/openspec-flow.md plugins/openspec/skills CONTRIBUTING.md`
  prints nothing; and `git grep -n "release-rebase" -- plugins/openspec/README.md` prints nothing.
- [x] 2.5 Gate: `mkdir -p /tmp/devkit-rmc && env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green (the change-loop suite loads the deliver-check, conduct-check and release-merge suites); covers AC-1, AC-2, AC-4, AC-5 and AC-7.

## 3. Release, roadmap and the whole suite (AC-1 to AC-8)

- [x] 3.1 Release as D-7 says. Bump devkit-openspec to 0.22.0 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace `metadata.version` to 0.26.0. Add the `CHANGELOG.md` section
  `## 0.26.0 — release conflicts resolved by a merge` with its two bullets. Turn every `v0.21.1` of
  `docs/openspec-flow.md` (three lines) into `v0.22.0`. This task edits no line of
  `change-loop.test.mjs` (AC-4: the bump alone must keep its docs test green). Check:
  `python3 scripts/gen-catalog.py --check` passes;
  `git grep -c "v0.21.1" -- docs/openspec-flow.md` prints nothing; and
  `node --test --test-concurrency=1 --test-name-pattern="design records the answers|the pin in docs/openspec-flow.md|AC-8 release-ready|the real docs/openspec-flow.md" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 3.2 In `openspec/roadmap.md`, add the round `## Round 17i: the release merge, live` and its line
  `release-merge-live-check (after: release-merge-conflict)` after "Round 17h", word for word as D-7
  says (AC-8). Check: `python3 scripts/check.py` passes; and
  `git grep -n "release-merge-live-check (after: release-merge-conflict)" -- openspec/roadmap.md`
  prints one line.
- [x] 3.3 Gate: `mkdir -p /tmp/devkit-rmc && env TMPDIR=/tmp/devkit-rmc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate release-merge-conflict --strict` green (the guard suite as a background command); covers AC-1 to AC-7 and every other suite at once, and AC-8's line.

## Workflow follow-up

- After the merge, tag `v0.22.0` on the merge commit and push the tag (`CONTRIBUTING.md`, step 5).
  When a sibling released first, the numbers were moved at the merge of `main` before the last
  verify and review, and the tag follows the number that merged.
- Archive with the retro; the archive ticks the round 17e line of `openspec/roadmap.md`.
- AC-8: the live check is the roadmap line `release-merge-live-check`. With devkit-openspec 0.22.0
  installed (`claude plugin update devkit-openspec@devkit`), the next change whose pull request falls
  behind another release runs the loop alone through the release conflict, and its retro records
  the result.
- For the retro: `plugins/panel/hooks/report.test.tsx` (`ACTOR_STEPS`, "every step conduct-check's
  actorOf names") and the panel's `push-rebased` label outlive the step. Propose dropping them in the
  panel's next change, once no supported devkit-openspec sends it.
