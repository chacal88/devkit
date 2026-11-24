<!-- devkit-stage tasks result=passed attempt=1 commit=511d3e753d1069c89bb5d35a26de195d254d0301 -->
# Tasks

Change: `own-pr-archive-paths` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

Work only in this change's worktree, on its branch. The short script has no `design.md`: the how is
fixed in "The how" below (H-1 to H-4). The implementer copies the names, texts and rules from there
and makes no design choice; a choice the section does not settle stops the phase and goes to the
owner.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|` (several name patterns are several
`--test-name-pattern` flags, never one alternation). Every hook gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does, and with `TMPDIR=/var/tmp`, because `/tmp`
on the owner's Linux worker is a small tmpfs. Every new test builds its repository and `gh` with the
file's existing helpers (`ownRepo`, `findRepo`, `fakeGh`), which blank the branch variables. The
machine is overloaded: no task runs the whole hook suite; the gates run filtered test files only, and
the whole suite is a "Workflow follow-up" bullet, run when the coordinating session gives a place.

Test first. Task 1.1 writes the new tests, runs them on the code as it is and saves the output, as
printed, to `openspec/changes/own-pr-archive-paths/proof/red-1.txt`. That run is the task's check,
never a gate. Every new test's name starts `field-fixes 4 own archive <n>: ` (H-3), so the filter
`field-fixes 4` of the gates runs them with the existing group and `field-fixes 4 own archive` runs
them alone.

Existing tests change only where H-3 names them, with the invariant, the layer that owns it and the
suite (CLAUDE.md); name them in the commit message. Leave no backup or scratch file in the tree, and
end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `own-archive-refused` | 1.1, 1.2, 1.5 |
| AC-2 | `other-archive-allowed` | 1.1, 1.2, 1.5 |
| AC-3 | `id-prefix-not-confused` | 1.1, 1.2, 1.5 |
| AC-4 | `archive-head-still-refused` | 1.1, 1.2, 1.5 |
| AC-5 | `found-after-merge` | 1.1, 1.2, 1.5 |
| AC-6 | `no-regression` | 1.3, 1.5, 2.3 |

## The how

**H-1 The predicate** (`plugins/openspec/hooks/deliver-check.mjs`, `isOwnPr` only). Its second rule,
`files.some((f) => f.startsWith('openspec/changes/archive/'))`, becomes: some file is in the
change's own archive folder. A file `f` is in it when all of these hold:

1. `f` starts with `openspec/changes/archive/`;
2. the rest of `f` after that prefix holds a `/` at a position greater than 0, so a first segment
   exists and is a folder (a file directly under `openspec/changes/archive/`, such as
   `openspec/changes/archive/README.md` or a file named `openspec/changes/archive/2026-11-09-foo`,
   and the path `openspec/changes/archive/` itself, are in no change's archive folder);
3. that first segment matches the module's existing `ARCHIVED` constant
   (`/^(\d{4}-\d{2}-\d{2})-(.+)$/`, defined above `locateChange`), so an undated folder such as
   `openspec/changes/archive/foo/` is in no change's archive folder;
4. the name it captures (`m[2]`) equals `id` by `===`. No pattern is built from `id`, so
   `2026-11-09-foo-two` is not `foo`'s and `2026-11-09-axb` is not `a.b`'s.

Write it as a small module-level helper next to `isOwnPr` (not exported) or inline; either way no new
export, no change to `ARCHIVED`, `isArchiveHead`, `archiveHeads`, `prFiles`, `mergedOnBranch` or
`findChangePr`. The first rule (`isArchiveHead(pr?.headRefName)` refuses) and the third (some file
starts with `openspec/changes/<id>/`) stay as they are, in the same order. Replace the comment above
`isOwnPr` with:

```
// The change's own pull request (field-fixes D-4, own-pr-archive-paths): not an archive head, no file in
// the change's own archive folder (openspec/changes/archive/<date>-<id>/, the exact id; another change's
// archived files do not count), and some file under the change's active folder. A body or a head name
// that names the change is never proof.
```

**H-2 The flow doc** (`docs/openspec-flow.md`, the "Finding the change PR" paragraph of "After the
merge: the archive steps"). Replace the end of its sentence that starts "From the default branch or an archive
branch",

```
and no file under `openspec/changes/archive/`.
```

with

```
and no file under its own archive folder `openspec/changes/archive/<date>-<id>/` (a file of another change's archive folder does not count).
```

Nothing else in that paragraph changes. The sentence of "Delivered" ("neither does an archive pull
request") stays true (the archive head is still refused) and does not change.

**H-3 The tests** (`plugins/openspec/hooks/deliver-check.test.mjs`, right after the existing test
`field-fixes 4 delivered: isOwnPr needs a file of the change folder, …`, and the `findChangePr` one
right after the `ownRepo` tests). `own(id, head, files)` below stands for
`DC.isOwnPr(id, { headRefName: head }, files)`; `FOLDER_TASKS` and `AUTO` are the file's constants.

| Test | Asserts | AC | Red on today's code |
|---|---|---|---|
| `field-fixes 4 own archive 1: the change's own archive folder refuses its pull request` | `own('foo', 'ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md'])` is `false`; the same with `'openspec/changes/archive/2026-11-09-foo/specs/cap/spec.md'` is `false` | AC-1 | no (pins today's answer) |
| `field-fixes 4 own archive 2: another change's archived files do not refuse its pull request` | `own('foo', 'ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md'])` is `true`; `own('foo', 'calm-badger', [...that, 'openspec/changes/archive/2026-11-01-baz/design.md'])` is `true` | AC-2 | yes |
| `field-fixes 4 own archive 3: an id that starts another change's id is not confused with it` | `own('foo', 'ship/foo', ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo-two/retro.md'])` is `true`; `own('foo-two', 'ship/foo-two', ['openspec/changes/foo-two/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md'])` is `true`; `own('foo-two', 'ship/foo-two', ['openspec/changes/foo-two/tasks.md', 'openspec/changes/archive/2026-11-09-foo-two/retro.md'])` is `false` | AC-3 | yes (the first two) |
| `field-fixes 4 own archive 4: an archive head is refused whatever its files` | for each head `chore/archive-bar` and `archive-bar`: `own('foo', head, ['openspec/changes/foo/tasks.md'])` and `own('foo', head, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md'])` are `false` | AC-4 | no (pins today's answer) |
| `field-fixes 4 own archive 5: a path in no change's archive folder does not refuse its pull request` | with `openspec/changes/foo/tasks.md` plus one of `openspec/changes/archive/README.md`, `openspec/changes/archive/2026-11-09-foo` (a file, no folder), `openspec/changes/archive/foo/retro.md` (undated): `own('foo', 'ship/foo', …)` is `true` each time; `own('a.b', 'ship/a.b', ['openspec/changes/a.b/tasks.md', 'openspec/changes/archive/2026-11-09-axb/retro.md'])` is `true` and with `2026-11-09-a.b/retro.md` instead is `false` | H-1 edges | yes (all but the last) |
| `field-fixes 4 own archive 6: findChangePr finds the change's own merged pull request that also edits another change's archive` | `ownRepo([pr], { 11: [FOLDER_TASKS, 'openspec/changes/archive/2026-11-09-bar/retro.md'] })` with `pr = { ...AUTO, number: 11, headRefName: 'calm-badger', body: '' }`; `t.find('main')` (merge ship mode, the `findRepo` default) has `pr.number` 11 and `via` `'list'`; a second repository whose PR 11 files are `[FOLDER_TASKS, 'openspec/changes/archive/2026-11-09-auto-merge/retro.md']` answers `{ none: true }` | AC-5 | yes (the first part) |

Existing tests: one test changes, the one at the head of this group, and only in words.
`field-fixes 4 delivered: isOwnPr needs a file of the change folder, no archive folder and no archive head`
becomes `field-fixes 4 delivered: isOwnPr needs a file of the change folder, no file of its own archive folder and no archive head`,
and its last assertion's message `'it brings an archive folder'` becomes `'it brings its own archive folder'`.
Its five assertions stay as they are and stay green. Invariant: a pull request is `foo`'s own only
with a file of `openspec/changes/foo/`, none of `foo`'s archive folder and no archive head; layer:
the `isOwnPr` predicate of `deliver-check.mjs`; suite: `deliver-check.test.mjs`, which
`guard.test.mjs` loads. A search of every test file for `no archive folder and no archive head`,
`it brings an archive folder` and `brings no folder under` finds only these two strings, in this
test; no other test asserts the old rule's text. The other tests that feed an archive path as a pull
request's files (`another change's archive pull request that names the change is not its own` and
`… leads to no archive step`) use an archive head, so the first rule still refuses them and they
stay green unchanged.

**H-4 The release** (task 2.1). devkit-openspec and the marketplace each take the next patch version
after `origin/main`'s at the last merge before review (today's `main` holds devkit-openspec 0.33.0 and
marketplace 0.37.0; a sibling that merges first moves both). Bump the `version` of
`plugins/openspec/.claude-plugin/plugin.json`, the devkit-openspec entry of
`.claude-plugin/marketplace.json` and the marketplace's own `version` there. Add on top of
`CHANGELOG.md` the section `## <marketplace version> — a change's own pull request may edit another change's archive`
with the line: **devkit-openspec** `<version>`: `deliver-check` counts a merged pull request as the
change's own when it also edits another change's archived files; only a file in the change's own
archive folder (`openspec/changes/archive/<date>-<id>/`) refuses it, so `/devkit change` finds such a
pull request after its merge instead of asking to open it again. The CI snippet now pins
`v<version>`. In `docs/openspec-flow.md` move every `v0.33.0` of the CI pin (the snippet's comment,
its URL placeholder and the paragraph below it, which names the tag twice) to `v<version>`.

Plan amendment (found in phase 2, settled by the session while the owner slept; 2026-11-24): the pin
also lives in `plugins/openspec/hooks/change-loop.test.mjs`, in the test `change-loop docs: the design
records the answers` (invariant: the CI snippet pins the current release; layer: the docs; suite:
`change-loop.test.mjs`). With the release, that test's `assert.match(flow, /v0\.33\.0/, …)` becomes
`/v0\.<new>/`, its message names `own-pr-archive-paths: <version>`, a `doesNotMatch(flow, /v0\.33\.0/, 'no
pin left on main\'s release before it (roadmap-sessions-upfront)')` joins the neighbouring lines, and the
invariant comment above gains `own-pr-archive-paths moves it to <version> (release <marketplace
version>), above roadmap-sessions-upfront's 0.33.0 (release 0.37.0)`. Nothing else in that test
changes. Every earlier release moved these lines the same way.

## 1. The predicate, its tests and its doc (AC-1 to AC-6)

- [x] 1.1 Write the six tests of H-3 in `plugins/openspec/hooks/deliver-check.test.mjs`, run them on
  the unchanged code with
  `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="field-fixes 4 own archive" plugins/openspec/hooks/deliver-check.test.mjs`
  and save the output, as printed, to `openspec/changes/own-pr-archive-paths/proof/red-1.txt`.
  Check: the file shows tests 2, 3, 5 and 6 failing and tests 1 and 4 passing, as the last column of
  H-3 says; a test that fails for another reason (a typo, a missing fixture) is fixed before 1.2.
- [x] 1.2 Narrow the files rule of `isOwnPr` in `plugins/openspec/hooks/deliver-check.mjs` and
  replace its comment, as H-1 says. Check: the run of 1.1 passes all six tests, and
  `git diff -U0 -- plugins/openspec/hooks/deliver-check.mjs` shows changed lines only between the
  comment above `isOwnPr` and its closing brace (plus the helper, if written apart, right next to it).
- [x] 1.3 Reword the title and the last assertion message of the existing `isOwnPr` test as H-3 says,
  with nothing else in it changed. Check:
  `git diff -U0 -- plugins/openspec/hooks/deliver-check.test.mjs` shows, outside the six new tests,
  only those two lines changed; the test passes under the gate's filter.
- [x] 1.4 Write the H-2 sentence into the "Finding the change PR" paragraph of
  `docs/openspec-flow.md`. Check: `grep -c "and no file under .openspec/changes/archive/.\." docs/openspec-flow.md`
  prints 0 and `grep -c "and no file under its own archive folder" docs/openspec-flow.md` prints 1.
- [x] 1.5 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="field-fixes 4" --test-name-pattern="findChangePr" plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-1 to AC-5 at the predicate and through `findChangePr`, and AC-6 for every `field-fixes 4` and `findChangePr` test.

## 2. Release and the last checks (AC-6)

- [x] 2.1 Release, as H-4 says (the amendment included: the pin in `change-loop.test.mjs` moves too), with the next patch versions after `origin/main`'s at the last merge
  before review (`CONTRIBUTING.md`, step 5). Check: `python3 scripts/gen-catalog.py --check` passes,
  `grep -c "v0.33.0" docs/openspec-flow.md` prints 0 when the version moved from 0.33.0, and the two
  pin tests (`the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, …`
  and `AC-8 release-ready: …`) pass under the gate of 2.3.
- [x] 2.2 Check that nothing outside the plan changed. Check:
  `git diff --stat $(git merge-base origin/main HEAD) -- plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/flow-check.mjs plugins/openspec/hooks/guard.mjs plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/project-loop.mjs plugins/openspec/schemas openspec/schemas openspec/specs plugins/panel`
  prints nothing.
- [x] 2.3 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="field-fixes 4" --test-name-pattern="findChangePr" --test-name-pattern="the pin in docs/openspec-flow.md" --test-name-pattern="AC-8 release-ready" --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green; covers AC-1 to AC-6 on the released tree.

## Workflow follow-up

- Before the delivery, once the coordinating session gives a place on the machine, run the whole hook
  suite once as a background command of the tool (never with a shell `&`):
  `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`.
- After the merge, tag `v<version>` (the devkit-openspec version task 2.1 took) on the merge commit
  and push the tag (`CONTRIBUTING.md`, step 5).
- Archive with the retro; the archive ticks the `own-pr-archive-paths` line of round 19b in
  `openspec/roadmap.md`.
