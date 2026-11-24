<!-- devkit-stage tasks result=passed attempt=1 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Tasks

Change: `state-skips-unlocated` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. The how is fixed in `design.md` (D-1 to D-8): the
implementer copies the names, code shapes, texts and rules from there and makes no design choice; a
choice the design does not settle stops the phase and goes to the owner. No behaviour changes
beyond what `design.md` names.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate runs with
`TMPDIR=/private/tmp`, `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does:
a new test that passes only without them is not done. Every new test takes its env from its file's
existing helpers (`cleanEnv`, `LK_ENV`), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. The tests need the
`openspec` CLI 2.x on `PATH`. The change-loop and roadmap-loop suites import the deliver-check and
conduct-check suites and take several minutes; the whole suite (`guard.test.mjs`, 13 to 21 minutes)
runs once, in 3.5. Each runs as a background command of the tool, never with a shell `&`, and its
end is the run's `exit N` line.

Test first. The first task of phases 1, 2 and 3 writes that phase's tests, runs them on the code as it
is and saves the output, as printed, to `openspec/changes/state-skips-unlocated/proof/red-<phase>.txt`.
That run is the task's check, never a gate. Every new test's name starts `unlocated <phase>: `
followed by the name in `design.md` D-7. A test of a function this change adds reaches it through the
namespace import its suite already has (`changeLoopModule.unplacedAction`), so the red run fails test
by test instead of failing the file at load. Every `t.test` subtest is awaited. No test reads this
repository's git history; every expected phrase comes from `render(lang, 'blocked-why.wrong-branch')`.

Existing tests are not edited: the ones `design.md` D-7 lists under "Existing tests that pin what
this change touches" must pass as they are (AC-6); a failing one stops the phase and goes to the owner
with its invariant, its layer and its suite. Leave no backup or scratch file in the tree, and end
every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `state-lists-unlocated` | 1.1, 1.3, 1.4, 3.4, 3.5 |
| AC-2 | `state-change-flag-unlocated` | 1.1, 1.3, 1.4, 3.4, 3.5 |
| AC-3 | `board-lists-unlocated` | 2.1, 2.2, 2.3, 3.4, 3.5 |
| AC-4 | `unknown-id-keeps-exit-3` | 1.1, 1.3, 1.4, 3.4, 3.5 |
| AC-5 | `locate-prefers-caller` | 1.1, 1.2, 1.4, 3.4, 3.5 |
| AC-6 | `no-behaviour-change-elsewhere` | 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 3.5 |
| AC-7 | `docs-follow` | 3.1, 3.2, 3.5 |

## 1. Where the loop reads a change, and the state command

- [x] 1.1 Merge `origin/main` into the branch, then add to `plugins/openspec/hooks/change-loop.test.mjs`
  the tests 1.1 to 1.19 of `design.md` D-7 (a new section `state-skips-unlocated: locate, the helper
  and the state command` after the change-state AC-4 tests), with the fixtures D-7 names. Run
  `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test
  --test-name-pattern="^unlocated 1" plugins/openspec/hooks/change-loop.test.mjs` on the code as it
  is. Check: `proof/red-1.txt` holds that run, with 1.1, 1.9 to 1.14 and 1.16 to 1.19 failing, and
  1.2 to 1.8 and 1.15 passing (they pin unchanged behaviour: the archive worktree and the worktree on
  `x` already win today, 1.2 and 1.3).
- [x] 1.2 In `plugins/openspec/hooks/change-loop.mjs`, give `locate` the order of D-5 (the caller's
  step with its three conditions) and update its comment to name the four steps. Check: tests
  `unlocated 1:` 1.1 to 1.8, 1.16 and 1.17 pass; the change-state tests of D-7's existing table
  pass.
- [x] 1.3 In `plugins/openspec/hooks/change-loop.mjs`, add the exported `unplacedAction(start, id)`
  of D-2 right after `knownChange`, and make `stateEntries` follow D-3's order: the helper, then the
  archived step for an id it stands in for (`archivedDates` read lazily once, `createdAfter`, the
  archived stand-in hoisted unchanged), then the blocked stand-in, leaving the `knownChange`,
  archived, run-file and `no change named` branches as they are. Check: tests `unlocated 1:` 1.9 to
  1.15, 1.18 and 1.19 pass, and "change-state AC-1 command: an unknown change exits 3 with the plain
  reply" and every "field-fixes 1 archived" test pass unchanged.
- [x] 1.4 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green (a background command); covers AC-1, AC-2, AC-4, AC-5 and the change-loop half of AC-6.

## 2. The roadmap facts: the board, the run and its stop lock

- [x] 2.1 Add to `plugins/openspec/hooks/roadmap-loop.test.mjs` the tests 2.1 to 2.8 of `design.md`
  D-7 (a new section `state-skips-unlocated: the board` after the change-state AC-6 tests), built on
  `lkProject`, `projectWith`, `addOpen`, `putRun`, `inFlight`, `changeMain`, a worktree on branch
  `side` holding `x`'s active folder, `doStatus`, `cmd`, `doNext`, `stopOf` and `placedOn`. Run
  `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test
  --test-name-pattern="^unlocated 2" plugins/openspec/hooks/roadmap-loop.test.mjs` on the code as it
  is. Check: `proof/red-2.txt` holds that run, with 2.1 to 2.6 and 2.8 failing (2.8's in-flight
  board exits 3, and both its subtests compare with the state command, which exits 3 on the old
  code) and 2.7 passing.
- [x] 2.2 In `plugins/openspec/hooks/roadmap-loop.mjs`, import `unplacedAction` from
  `./change-loop.mjs` and make `collectRoadmap` ask it before `nextAction` for each open line (D-4);
  `statusJson` and `draftCmd` stay as they are. Check: tests `unlocated 2:` 2.1 to 2.8 pass.
- [x] 2.3 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green (a background command); covers AC-3 and the roadmap-loop half of AC-6.

## 3. Documents, release, the real run and the whole suite

- [x] 3.1 Add to `plugins/openspec/hooks/change-loop.test.mjs`, right after "change-state ADR 0017:
  the documents follow", the test 3.1 of `design.md` D-7 (`unlocated 3: the state paragraph of
  docs/openspec-flow.md names the unplaced change and the locate order`, reading the file with
  `readRepo`). Run `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node
  --test --test-name-pattern="^unlocated 3" plugins/openspec/hooks/change-loop.test.mjs` on the
  docs as they are. Check: `proof/red-3.txt` holds that run, with 3.1 failing (none of
  `wrong-branch`, `chore/archive-<id>` and "the checkout it is called from" is in the paragraph yet).
- [x] 3.2 In `docs/openspec-flow.md`, the paragraph "**A change's state.**", insert the sentences of
  `design.md` D-6 after the sentence ending "`archived` has none.", in the same paragraph. Check:
  `unlocated 3:` 3.1 and "change-state ADR 0017: the documents follow" (change-loop.test.mjs) pass
  with `--test-name-pattern="^(unlocated 3|change-state ADR 0017)"`, and `python3 scripts/check.py`
  is green; covers AC-7 with the spec delta `specs/change-state/spec.md`.
- [ ] 3.3 Release, as one task: merge `origin/main` into the branch first; set devkit-openspec to the
  next patch version after `origin/main`'s at the last merge before review, in
  `plugins/openspec/.claude-plugin/plugin.json` and in its entry of `.claude-plugin/marketplace.json`;
  set the marketplace `metadata.version` to the next patch after `origin/main`'s; add the
  `CHANGELOG.md` entry of D-6 at the top; move the three CI pin lines of `docs/openspec-flow.md`
  (`## CI`) to `v<the new devkit-openspec version>`. Check: "release-merge pin: the real
  docs/openspec-flow.md: setPins changes exactly its CI pin lines" (release-merge.test.mjs) passes
  with `--test-name-pattern="^release-merge pin: the real"`, `python3 scripts/check.py` is green,
  and `command claude plugin validate .` passes.
- [x] 3.4 Real-run proof (D-8; the changes are `aa` and `xx` because `open` refuses one-letter ids, and only `xx` is blocked since `aa` stays in its own worktree), with `TMPDIR=/private/tmp/devkit-state-skips-unlocated`: build the
  scratch repository, open `a` and `x` with this worktree's `change-loop.mjs open`, rename `x`'s
  worktree branch to `side`, and from the main checkout run `state` in `en` and `pt-BR`, `state
  --change x`, `state --change nope` and `roadmap-loop.mjs status` in `en` and `pt-BR`, then `next
  --change x` from `x`'s worktree; run the same seven commands first with the hooks of
  `origin/main` extracted under `$TMPDIR`. Check: `openspec/changes/state-skips-unlocated/proof/real-run.txt`
  holds every command with its exit code and output (paths written `<worktree>` and `<scratch>`):
  before, `state` and `status` exit 3; after, `state` exits 0 listing `a` and `x` blocked with
  `wrong-branch` and its phrase in each language, `--change x` gives the same entry, `nope` exits 3
  with `no change named nope`, the board shows `x` under the blocked block in each language and `a`
  as before, and `next --change x` exits 0 with `x`'s action; covers AC-1 to AC-5 for real.
- [ ] 3.5 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate state-skips-unlocated --strict` green (the guard suite as a background command); covers AC-1 to AC-7 and every other suite at once (AC-6).

## Workflow follow-up

- After the merge, push the tag `v<the new devkit-openspec version>` on the merge commit (CONTRIBUTING
  step 5, ADR 0019), or let the delivery loop's tag step do it.
- Archive the change: the deltas of `change-state` and `roadmap-coordination` land in
  `openspec/specs/`, and the roadmap line is ticked.
