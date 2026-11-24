<!-- devkit-stage tasks result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Tasks

Change: `fresh-base-check` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch, and do not fetch: the coordinating session keeps
`origin/main` current. Every rule, function, text, file and test name is in `design.md`: D-1 the
fetch helper, D-2 `nextAction`, D-3 the callers, D-4 the wait's key, D-5 the reply line, D-6 the
checkers' headers, D-7 docs and skills, D-8 the new tests, D-9 the existing tests, D-10 the release.
The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. The hook gates set
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a pull-request run on CI does. They run one entry file
with `--test-concurrency=1` and the private `TMPDIR` `/var/tmp/devkit-fbc` (this machine's `/tmp`
runs out of inodes). The entry files load their imports: `change-loop.test.mjs` registers the
deliver-check, conduct-check and release-merge suites, and `roadmap-loop.test.mjs` registers those
and the change-loop suite. So the phase gates filter by test name. The tests need the `openspec` CLI
2.x on `PATH`. The whole suite (`guard.test.mjs`, 13 to 21 minutes) runs once, in 3.2, as a
background command of the tool, never with a shell `&`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first: tasks 1.1 and 2.1 write the tests of `design.md` D-8 and run them before the code they
test exists. The output, as printed, goes under `openspec/changes/fresh-base-check/proof/`. That run
is the task's check, never a gate. An existing test is edited only as D-9 says (none is rewritten).
Name the invariant of any test you touch in the commit message. Leave no backup or scratch file in
the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `next-fetches-before-judging` | 1.1, 1.2, 1.3, 1.5 |
| AC-2 | `wait-and-roadmap-fetch` | 1.1, 1.3, 1.5, 2.1, 2.2, 2.4 |
| AC-3 | `checkers-stay-pure` | 1.1, 1.4, 1.5 |
| AC-4 | `fetch-failure-does-not-block` | 1.1, 1.2, 1.5, 2.1, 2.2, 2.4 |
| AC-5 | `fetch-writes-only-the-base` | 1.1, 1.2, 1.5 |
| AC-6 | `one-fetch-per-process` | 1.1, 1.2, 2.1, 2.2, 2.4 |
| AC-7 | `docs-state-the-rule` | 2.1, 2.3, 2.4, 3.2 |

## 1. The change loop fetches the base before it judges (AC-1 to AC-6)

- [x] 1.1 Check that `git merge-base --is-ancestor origin/main HEAD` exits 0 (no merge, no fetch).
  Re-run the three searches of D-9 and confirm the table still lists every hit; settle a new hit
  here, in `design.md` D-9, before 1.2. In `plugins/openspec/hooks/conduct-check.test.mjs`, export
  `MERGE_CONFIG`, `MERGE_FILES` and `presetMerge`, unchanged. In
  `plugins/openspec/hooks/change-loop.test.mjs`, add the helpers of D-8 (`gitShim`, the new options
  of `deliveredChange` and its export, `staleBase`, `implementingChange`), and tests
  `fresh-base-check 1` to `fresh-base-check 10`, `fresh-base-check 16` and `fresh-base-check 17`,
  exactly as the D-8 table says: one test per row, each guard and label with its own test. The new
  tests reach the new exports as `changeLoopModule.refreshBase` and `changeLoopModule.baseFetches`
  (D-8, import form); add no named import of either to this file. Run
  `node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " plugins/openspec/hooks/change-loop.test.mjs`
  and save its output to `openspec/changes/fresh-base-check/proof/red-1.txt`. Check: the file holds
  the twelve names (the file loads and every test runs); 1, 2, 3, 4, 5, 6, 8, 10, 16 and 17 fail
  (16 on its `refreshBase` call, 17 on its self-check), 9 fails on its header assertion only, and 7
  passes, as D-8 expects. If test 1 shows that a D-8 assumption does not hold (merge mode reaching
  item 5), settle it here, in `design.md`, before 1.2. Also check that
  `node --test --test-concurrency=1 --test-name-pattern="^change-loop next" plugins/openspec/hooks/change-loop.test.mjs`
  still passes with the new `deliveredChange` defaults.
- [x] 1.2 In `plugins/openspec/hooks/change-loop.mjs`, add `baseFetches` and `refreshBase` (D-1)
  above `nextAction`, the `fetchBase` option and the `baseFetch` field with its reply line (D-2),
  `ownReply` and the new `decisionKey` (D-4), and the `base-unfetched` key in both languages after
  `waiting-github` (D-5). Do not add a top-level `const` that reads `LS_REMOTE_TIMEOUT_MS` or
  `gitPasses` above their declarations (D-1). Update the comment above `nextAction` to name the
  option. Check (the phase table of D-8): tests 3, 10 and 16 pass and 7 still passes; test 8 fails
  on its two-`next` assertion only; 1, 2, 4, 5, 6 and 17 still fail, because they drive the `next`
  or `wait` command, which passes no record until 1.3. And
  `node --test --test-concurrency=1 --test-name-pattern="^change-loop replies" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 1.3 In `change-loop.mjs`, pass `fetchBase: baseFetches()` from `runNext`, and a new
  `baseFetches()` in each call of `runWait`'s `poll` (D-3). Leave `stateEntries` and `stopDecision`
  as they are. Add one sentence to the file's header comment: `next` and `wait` fetch the base of a
  change in delivery before they judge, and `state` and the locks never do. Check: tests 1, 2, 4, 5,
  6, 7, 8 and 17 pass, and 3, 10 and 16 still pass; and the code lines (not comment lines) that
  `git grep -n "fetchBase" -- plugins/openspec/hooks/change-loop.mjs` prints are in `nextAction`,
  `runNext` and `runWait` only.
- [x] 1.4 In `plugins/openspec/hooks/deliver-check.mjs`, change line 3 to the comment of D-6 and
  nothing else. Check: test 9 passes, and `git diff --stat -- plugins/openspec/hooks/deliver-check.mjs`
  shows one line changed.
- [x] 1.5 Gate: `mkdir -p /var/tmp/devkit-fbc && env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2 (change loop), AC-3, AC-4, AC-5 and the one-fetch rule.

## 2. The roadmap fetches too, and the docs state the rule (AC-2, AC-6, AC-7)

- [x] 2.1 In `plugins/openspec/hooks/change-loop.test.mjs`, add test `fresh-base-check 11` (D-8).
  In `plugins/openspec/hooks/roadmap-loop.test.mjs`, import `gitShim`, `deliveredChange` and
  `implementingChange` from `./change-loop.test.mjs`, and add `baseFetches` to the existing named
  import from `./change-loop.mjs` (allowed here only because 1.2 has landed; D-8, import form). Add
  tests `fresh-base-check 12` to `fresh-base-check 15` and `fresh-base-check 18`, exactly as the D-8
  table says. Run
  `node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " plugins/openspec/hooks/roadmap-loop.test.mjs`
  and save its output to `openspec/changes/fresh-base-check/proof/red-2.txt`. Check: the file holds
  the eighteen names; 11, 12, 13, 15 and 18 fail, 14 passes, and 1 to 10, 16 and 17 pass. If test 12's change is not
  read as `implementation` without `gh` (D-8 assumptions), settle the fixture here, in `design.md`,
  before 2.2.
- [x] 2.2 In `plugins/openspec/hooks/roadmap-loop.mjs`, import `baseFetches`, add the
  `fetchBase = false` option to `collectRoadmap` and hand it to its `nextAction` call. Pass
  `fetchBase: baseFetches()` from `runCmd` and `nextCmd`, and a new `baseFetches()` in each call of
  `waitCmd`'s `poll` (D-3). Leave `statusCmd`, `statusJson`, `draftCmd` and `roadmapStopDecision`
  as they are. Update the comment above `collectRoadmap` to name the option. Check: tests 12, 13, 14,
  15 and 18 pass, and the code lines (not comment lines) that
  `git grep -n "fetchBase" -- plugins/openspec/hooks/roadmap-loop.mjs` prints are in
  `collectRoadmap`, `runCmd`, `nextCmd` and `waitCmd` only.
- [x] 2.3 Edit `docs/openspec-flow.md` (the five texts of D-7, and not the CI pins),
  `plugins/openspec/skills/ship-change/SKILL.md` (the `update-branch` row) and
  `plugins/openspec/skills/devkit/SKILL.md` (the `## Loop` paragraph), word for word as D-7 says.
  Check: test 11 passes; `python3 scripts/check.py` passes (language and links);
  `git grep -n "never fetches (run" -- docs/openspec-flow.md` prints nothing; and
  `node --test --test-concurrency=1 --test-name-pattern="^format: ship-change" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop docs" plugins/openspec/hooks/change-loop.test.mjs`
  passes (D-9).
- [ ] 2.4 Gate: `mkdir -p /var/tmp/devkit-fbc && env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-2 (roadmap), AC-6 and AC-7.

## 3. Release and the whole suite (AC-1 to AC-7)

- [ ] 3.1 Release as D-10 says. Bump devkit-openspec, minor, to the next free number on
  `origin/main` at the last merge before review, in `plugins/openspec/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`. Bump the marketplace `metadata.version`, minor, the same
  way. Add the `CHANGELOG.md` section of D-10. Move every CI pin of `docs/openspec-flow.md` (the
  lines of the CI example that name the devkit-openspec version the manifest held before the bump,
  whatever `origin/main` carries then; `git grep -n 'v[0-9]*\.[0-9]*\.[0-9]*' -- docs/openspec-flow.md`
  lists them) to the new devkit-openspec tag. Run `python3 scripts/gen-catalog.py`. Check:
  `python3 scripts/gen-catalog.py --check` passes; `git grep -n -F "v<new devkit-openspec version>" -- docs/openspec-flow.md`
  lists every pin line of the CI example; and
  `node --test --test-concurrency=1 --test-name-pattern="design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [ ] 3.2 Gate: `mkdir -p /var/tmp/devkit-fbc && env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate fresh-base-check --strict` green (the guard suite as a background command of the tool); covers AC-1 to AC-7 and every other suite at once.

## Workflow follow-up

- Before each push of the delivery and before `enable-auto-merge`, the coordinating session fetches
  `main`. When a sibling (`stale-only-on-own-files`, `delivery-merge-hold`) released first, it
  merges `main` and renumbers the release (`CONTRIBUTING.md`, step 5), then runs verify and review
  again.
- After the merge, the loop's own `tag-release` step (ADR 0019) tags the new devkit-openspec
  version on the merge commit; nothing is added for it here.
- Archive with the retro; the archive ticks this change's line of `openspec/roadmap.md`.
