<!-- devkit-stage tasks result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Tasks

Change: `merge-setup-field-fixes` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, message, function, file and test
name is in `design.md`: D-1 the watch, D-2 the setup line, D-3 the verdict readers, D-4 the proof,
D-5 the existing tests, D-6 documents and release. The implementer copies them and makes no design
choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`field-fixes <item> ` (D-4). Every new hook test takes its env from the file's existing fixtures
(`shipRepo`/`mergeReady` env, `CI_ENV`), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. Every hook gate runs
with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does: a new test that
passes only without them is not done. The tests need the `openspec` CLI 2.x on `PATH`. The whole
suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes) runs once, in 4.3, as a
background command. The marketplace check is written `command claude plugin validate .`, so that a
shell function named `claude` is skipped.

Test first in every phase. The phase's first task writes its tests, runs them on the unchanged code
and saves the output, as printed, under `openspec/changes/merge-setup-field-fixes/proof/` (D-4).
That run is the task's check, never a gate. An existing test is changed only where `design.md` D-5
names it, in the task that changes its rule, with its invariant named in the commit message. Leave
no backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `watch-waits-during-merge-setup` | 1.1, 1.2, 1.3, 1.4, 4.3 |
| AC-2 | `setup-lists-required-checks` | 2.1, 2.2, 2.3, 2.4, 4.3 |
| AC-3 | `first-verdict-line-wins` | 3.1, 3.2, 3.3, 3.4, 4.3 |
| AC-4 | `red-before-fix` | 1.1, 2.1, 3.1, 4.2 |

## 1. The checks watch at stop-merge-setup (AC-1, AC-4)

- [x] 1.1 Write the `field-fixes 9 watch` tests in `plugins/openspec/hooks/deliver-check.test.mjs`
  (spec `change-delivery`, every scenario; D-1). The fixture is `mergeReady()` with
  `presetSetup(t.gh, { rules: [] })` (no rule requires `devkit-reviews`) and the pull request's checks
  pending, as `pendingChecks()` sets them. Four tests. (a) The watch fixture ends and the checks then
  pass: exactly one watch call, with the argument list the existing "CLI --watch: one gh pr checks
  --watch …" test asserts; item 6 met; `next: stop-merge-setup: …`; `blocked: merge setup`; exit 2;
  `watch: ended`; and in `--json`, `next.step` is `stop-merge-setup` and `watch` is
  `{ minutes: 1, timedOut: false }`. (b) The watch sleeps past `--watch=0.02`: the run returns near
  the cap with `watch: stopped after 0.02 minutes`, item 6 still names the pending check, and the
  step is `stop-merge-setup`. (c) No pending check, and no pull request: no watch call. (d) Without
  `--watch`: no watch call. Run
  `node --test --test-name-pattern="^field-fixes 9 " plugins/openspec/hooks/deliver-check.test.mjs`
  on the unchanged code and save its output to `proof/red-9.txt`. Check: the file shows tests (a)
  and (b) failing.
- [x] 1.2 Add `checksToWatch(state, next)` and `watchChecks(gh, target, minutes)` to
  `plugins/openspec/hooks/deliver-check.mjs` and use them in `main` in place of the inline
  `wait-checks` watch (D-1). Check: the `field-fixes 9` tests and every existing "CLI --watch:" and
  "--watch at wait-merge" test pass.
- [x] 1.3 Update the **Waiting.** paragraph and step 1 of "Preparing the repository (setup order)"
  in `docs/openspec-flow.md` (D-6). Check: `python3 scripts/check.py` passes, and both places name
  `stop-merge-setup` and the pending checks.
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-1, and AC-4 for field item 9.

## 2. The required-checks line of github-setup (AC-2, AC-4)

- [x] 2.1 Write the `field-fixes 11 setup` tests in
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` with the `world()` fixture
  (spec `project-setup`, every scenario; D-2). `--checks ""` with no ruleset prints exactly the
  D-2 field line, holds no `none`, and its `--json` has `requires` `['devkit-reviews']` and
  `checksFrom` `option`. Discovered `test`, `lint` give the line
  `test, lint, devkit-reviews (devkit-reviews always; test, lint reported on the newest pull requests)`.
  No check reported gives the `no other check reported … pass --checks to add one` source. A stored
  ruleset `devkit` requiring `e2e`, with `--checks test`, gives `requires` `['e2e', 'test',
  'devkit-reviews']` and the source `e2e already required by ruleset devkit`. With the rulesets
  refused (the existing `REFUSED` fixture) the line still lists `devkit-reviews`. In every case
  `--json` `requires` equals the printed list and `contexts` keeps today's value. Run
  `node --test --test-name-pattern="^field-fixes 11 " plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs`
  on the unchanged code and save its output to `proof/red-11.txt`. Check: the file shows the
  `--checks ""` test failing.
- [x] 2.2 Add `wantedRuleset(contexts, stored)` to
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs`, use it in `rulesetItem`, set
  `result.requires` and `result.checksFrom` in `plan`, and print the D-2 line in `render`. In the
  same task, change the three assertions D-5 lists in `github-setup.test.mjs` ("plan: check runs of
  each head are read across pages …", "field-fixes 5 checks: the proposed checks are the ones
  reported on pull request heads …", "field-fixes 5 checks: with no pull request check reported …")
  to the D-2 wording, naming each invariant in the commit message. Check: every test of
  `github-setup.test.mjs` passes, and no `contexts` assertion in it changed.
- [x] 2.3 Rewrite the proposed-checks sentence of step 7 of
  `plugins/openspec/skills/openspec-setup/SKILL.md` as D-2 says. Check: `python3 scripts/check.py`
  passes, and the step names `devkit-reviews` as always required and the JSON field `requires`.
- [x] 2.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs && python3 scripts/check.py` green; covers AC-2, and AC-4 for field item 11.

## 3. The first Verdict line (AC-3, AC-4)

- [x] 3.1 Write the `field-fixes 10 verdict` tests (spec `verdict-files`, every scenario; D-3). Each
  test uses a file with two disagreeing `Verdict:` lines, in both orders, and asserts that no output
  line names the second one. In `plugins/openspec/hooks/guard.test.mjs`: `readValue`,
  `reviewConsensus`, and the hook on `gh pr create`. In `plugins/openspec/hooks/deliver-check.test.mjs`:
  item 2 through `deliver-check.mjs <id>`, and the `devkit-reviews` check through `bothEntries` with
  `ciRepo`/`ciProve`. In `plugins/openspec/hooks/conduct-check.test.mjs`: the plan audit (no
  `revise-plan` for `ACCURATE` then `OUTDATED`, `revise-plan` for the reverse). Run
  `node --test --test-name-pattern="^field-fixes 10 " plugins/openspec/hooks/guard.test.mjs` on the
  unchanged code and save its output to `proof/base-10.txt`, or to `proof/red-10.txt` when a test
  fails (D-4). Check: the file holds every `field-fixes 10` test name with its result.
- [x] 3.2 Settle the readers (D-3). When 3.1's run failed for a reader, make that reader read
  through `readValue` in its own file. When it passed, change no production file. Check: the
  `field-fixes 10` tests pass;
  `git grep -ln "readValue\|'Verdict'\|Verdict:" -- '*.mjs' '*.js' '*.ts' '*.tsx' '*.py' ':!*.test.*' ':!openspec/changes'`
  lists only the files of the reader table in `design.md` Context; and
  `git grep -n -e "Verdict" -e "reviews/" -- plugins/panel/hooks ':!*.test.tsx' ':!plugins/panel/hooks/fixtures'`
  prints nothing.
- [x] 3.3 Update the item-2 row of the delivery table and the "A different gate" bullet of
  `docs/openspec-flow.md` (D-6). Check: `python3 scripts/check.py` passes, and both places say
  that the first `Verdict:` line counts.
- [x] 3.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes 10 " --test-name-pattern="^readValue" --test-name-pattern="^reviewConsensus" --test-name-pattern="^gh pr create" --test-name-pattern="^conduct" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3, and AC-4 for field item 10 as D-4 records it.

## 4. Release and the whole suite (AC-1 to AC-4)

- [x] 4.1 Release as D-6 says. Bump devkit-openspec to 0.18.1 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace to 0.22.1. Add the `CHANGELOG.md` section. Turn the three `v0.18.0` lines of
  `docs/openspec-flow.md` into `v0.18.1`. Change the pin assertion of
  `plugins/openspec/hooks/change-loop.test.mjs` to `v0.18.1` and add a `doesNotMatch` for `v0.18.0`
  (D-5, invariant: the CI snippet pins the current release). Extend the round 17c line of
  `openspec/roadmap.md` with field item 10. Check: `python3 scripts/gen-catalog.py --check` passes,
  `git grep -c "v0.18.0" -- docs/openspec-flow.md` prints nothing, and the change-loop docs test and
  the two `deliver-check.test.mjs` pin tests pass.
- [x] 4.2 Write `openspec/changes/merge-setup-field-fixes/proof/README.txt`, listing for field items
  9, 10 and 11 their test names, their proof file and the command that selects them (D-4). Check:
  each item has at least one test name, and the proof file it names holds that name.
- [x] 4.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command); covers AC-1 to AC-4 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.18.1` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 17c line of `openspec/roadmap.md`.
- In the projects that reported the field items, update devkit-openspec and check items 9 and 11
  there on the next real setup or first merge-mode pull request.
