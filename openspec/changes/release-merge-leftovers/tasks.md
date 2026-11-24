<!-- devkit-stage tasks result=passed attempt=1 commit=8432791edc714cfd226a61a0fab66ee1afe3ccd0 -->
# Tasks

Change: `release-merge-leftovers` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, the delta `specs/commit-attribution/spec.md`). Plan base: `c1ac8c4`.

Work only in this change's worktree, on its branch. devkit-lite has no `design.md`: the edits, the
new tests and the release are fixed in "How it is built" below, and the implementer copies them and
makes no design choice. No behaviour changes (AC-4): no hook, skill, agent, schema or panel module
changes what it answers; the panel edits remove one table entry that no checker returns any more.
If a new test of phase 2 is red on the plan base's code, that is a defect of the override: stop the
phase, leave the override as it is, and report the failing assertion to the conducting session for
the owner; do not fix it in this change.

Every gate is one backticked command, run as written; the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. The panel suite runs only with the
desktop app's bundled Claude Code: before a run, `<that binary> plugin test --help` must print
`Run a mod's tests`; when it prints the rollout-switch refusal, run `<that binary> -p "ok" --max-turns 1
--model haiku` once and check again (`CONTRIBUTING.md`, "Testing a mod pack"). The whole guard suite
(13 to 21 minutes) runs once, in 3.4, as a background command of the tool, never with a shell `&`.
The hook gates run with the CI branch variables set and an empty `TMPDIR` under `/private/tmp`, which
`rmdir` proves still empty at the end; when `rmdir` fails, list that folder, fix the test that left
something, and remove that exact folder before the gate runs again. The marketplace check of 3.4
uses the app's binary as well. Leave no backup or scratch file in the tree, and end every task with `git status --short`.

Every commit that edits a test names, in its message, the test's invariant, the layer that owns it and
the suite it lives in (the rows of "Existing tests" and "The new tests" below give all three).

| AC | Tasks |
| --- | --- |
| AC-1 | 3.3 (archive of the delta in a scratch copy), 3.4 (`openspec validate --strict`) |
| AC-2 | 1.1, 1.2 |
| AC-3 | 2.1, 2.2, 2.3 |
| AC-4 | 1.2, 2.3, 3.4 (every suite keeps its result) |

## How it is built

### The panel step vocabulary (AC-2)

- `plugins/panel/hooks/steps.ts` line 133, the `pr` group of `STEP_OF`: remove the element
  `'push-rebased'`; the group becomes `['open-pr', 'push', 'update-branch', 'edit-pr-body', 'answer',
  'resolve-release-conflict', 'wait-checks', 'fix-checks']`.
- `plugins/panel/hooks/i18n.ts` line 182, the `STEPS` table: remove the whole `'push-rebased'` line
  (its label pair). `STEP_IDS` (`Object.keys(STEPS)`) loses the id with it.
- `plugins/panel/hooks/report.test.tsx` line 702, the list `ACTOR_STEPS`: remove the element
  `'push-rebased'`. Its comment already says the list is every step `conduct-check`'s `actorOf`
  names, and `actorOf` names no `push-rebased` at the plan base, so the list comes back in line with
  its comment.

The two tables stay in agreement because they lose the same id together: the test
`AC-14 flow-steps-you-are-here: every step id of the i18n step table is placed, ...` requires every
`STEP_IDS` entry to be in a step group of `steps.ts` (or in `NOT_IN_TABLE`), and the test
`2.1: every step of actorOf has a short label ...` requires every `ACTOR_STEPS` entry to be in
`STEP_IDS`. Removing the id from `i18n.ts` alone would fail the second; from `steps.ts` alone would
leave the first true but a label with no step; all three files change in one commit.

### The two-PR override tests (AC-3)

**Update at the merge of main (suite-speed, ADR 0026).** Main moved the shared helpers, `CONFIG`,
`roundRepo` and `TWO_PRS` among them, into `plugins/openspec/hooks/test-fixtures.mjs`, and no test
file may import another test file. So the move below is superseded: task 2.1's end state is that
`conduct-check.test.mjs` imports `TWO_PRS` from `./test-fixtures.mjs` and `delivery-models.test.mjs`
and `release-tags.test.mjs` keep main's own imports; no `TWO_PRS` line is added or changed in either
of the other two files. The text that follows records the original plan.

**The `TWO_PRS` constant moves, unchanged.** `plugins/openspec/hooks/delivery-models.test.mjs`
already imports `roundRepo` from `conduct-check.test.mjs` and calls it at load (`hookRepo()`), so
`conduct-check.test.mjs` cannot import from `delivery-models.test.mjs`: the cycle would run
`hookRepo()` before `conduct-check.test.mjs` defines the constants `roundRepo` reads, and the guard
suite would fail at load. So:

- In `plugins/openspec/hooks/conduct-check.test.mjs`, right after the line `const CONFIG = ...`
  (line 17), add, byte for byte the text of `delivery-models.test.mjs` line 24:
  `export const TWO_PRS = 'devkit:\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n';`
  with the comment line above it: `// The two-PR delivery model's settings (delivery-models), shared with delivery-models.test.mjs, which re-exports it.`
- In `plugins/openspec/hooks/delivery-models.test.mjs`, line 12 becomes
  `import { roundRepo, TWO_PRS } from './conduct-check.test.mjs';`, and line 24
  (`export const TWO_PRS = ...`) becomes `export { TWO_PRS }; // defined in conduct-check.test.mjs, which this file already imports (no import cycle)`.
  `plugins/openspec/hooks/release-tags.test.mjs` keeps its import from `delivery-models.test.mjs`
  unchanged. No assertion changes in either file.

**The fixture.** In `conduct-check.test.mjs`, right after the test
`conduct: a conflict that also has README.md is blocked, and an independent change in the round is still dispatched`,
add (the helpers `conflictRepo`, `prJson`, `headOf`, `byId`, `planStep`, `git` and `TDD` are the
file's own):

```js
// Invariant (release-merge-leftovers AC-3): under the two-PR delivery model the release-merge override merges the
// base branch (the repository's default branch, ADR 0018 decision 2), never the test branch, and a conflict outside
// the release files stays blocked. Layer: conduct-check's releaseConflict over deliver-check's two-prs item 5.
// Suite: conduct-check.test.mjs (loaded by guard.test.mjs).
const TWO_PRS_CONFIG = `schema: devkit-lite\n${TWO_PRS}`;
function twoPrsConflict(conflicts) {
  const { t, b } = conflictRepo(conflicts, { config: TWO_PRS_CONFIG });
  // The test branch exists on origin, at the base's tip, as in a two-prs project.
  git(t.main, 'push', '-q', 'origin', 'main:refs/heads/develop');
  // In two-prs deliver-check finds the change PR with `gh pr list --head b --base main` (never `gh pr view`).
  t.ghAt(b).set('pr-list-head-b', { stdout: [prJson('b', { headRefOid: headOf(b), mergeable: 'CONFLICTING' })] });
  return { t, b };
}
// The --base of every `gh pr list` call deliver-check made in worktree b.
const listedBases = (t, b) => t.ghAt(b).calls()
  .filter((a) => a[0] === 'pr' && a[1] === 'list' && a.includes('--base'))
  .map((a) => a[a.indexOf('--base') + 1]);
```

Why each fixture step is needed, read from the code at the plan base:

- `conflictRepo(..., { config })` writes `openspec/config.yaml` as given and, because the config is
  not `CONFIG`, adds `MERGE_FILES` (a `devkit-reviews.yml`); a two-prs config needs nothing more: `deliveryConfig` maps `two-prs` to ship mode `pr` and refuses only a `ship:` entry,
  which `TWO_PRS_CONFIG` has none of (`deliver-check.mjs` `MODEL_SHIP`, `shipConfig`).
- The base is read from the fake GitHub's `default_branch` (`main`, set by `roundRepo`), and two-prs
  requires it to equal `devkit.delivery.base` (`main`), or deliver-check stops before item 5.
- `fetchPr` with a base lists the PRs (`listFound`), so `conflictRepo`'s `pr-view` fixture is not
  read; without the `pr-list-head-b` fixture item 5 would be "no pull request" (`open-prs`). The fake
  `gh` keys a list by `--head`, not `--base`, so the test-branch lookup with head `b` reads the same
  list; that only makes a test PR look open, and no row before item 5 reads an open test PR (only a
  `CLOSED` one stops), so the step is unchanged.
- Pushing `develop` gives `origin/develop` at the base's tip, so the "test branch inside the task
  branch" row finds no commit and stays silent, as in a real two-prs project.

### The new tests (AC-3)

Two tests, one per guard, after the fixture. Both are characterization tests of code that already
exists: they are expected green at once; red is the stop of the preamble.

```js
test('conduct: under two-prs, a change PR in conflict only in release files is resolve-release-conflict on the base branch, never the test branch (release-merge-leftovers AC-3)', () => {
  const { t, b } = twoPrsConflict(['CHANGELOG.md', '.claude-plugin/marketplace.json']);
  const c = byId(t.state(), 'b');
  assert.deepEqual(new Set(listedBases(t, b)), new Set(['main', 'develop']), 'deliver-check read the PRs to main and to develop: the two-prs model is in force');
  assert.deepEqual(planStep(c), ['resolve-release-conflict', 'subagent']);
  assert.equal(c.next.agent, TDD);
  assert.deepEqual(c.next.paths, ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
  assert.equal(c.next.base, 'main');
  assert.match(c.next.command[1], /release-merge\.mjs$/);
  assert.equal(c.next.command[c.next.command.indexOf('--base') + 1], 'main', c.next.command.join(' '));
  assert.ok(!c.next.command.includes('develop'), `the merge command never names the test branch: ${c.next.command.join(' ')}`);
  assert.equal(c.deliver.next.step, 'blocked', 'deliver-check alone says blocked');
  assert.equal(c.deliver.next.conflict, true);
});

test('conduct: under two-prs, a conflict that also has README.md is blocked (release-merge-leftovers AC-3)', () => {
  const { t, b } = twoPrsConflict(['CHANGELOG.md', 'README.md']);
  const c = byId(t.state(), 'b');
  assert.ok(listedBases(t, b).includes('develop'), 'the two-prs model is in force');
  assert.deepEqual(planStep(c), ['blocked', 'stop']);
  assert.equal(c.state, 'blocked: item 5 (conflict in README.md)');
});
```

The first assertion of each test is the positive control: only the two-prs model lists the PRs to
`develop`, so a fixture that fell back to the `pr` ship mode fails it instead of passing vacuously.
AC-3's "a command ending in `--base main`" is asserted as the value after `--base` being `main`: the
command at the plan base is `node <hooks>/release-merge.mjs --base main --json`, and it does not
change (AC-4; flagged in `proposal.md`).

### Existing tests (the grep)

`grep -rn "push-rebased"` over `plugins/**/*.test.*`, `openspec/specs/` and `docs/` at the plan base,
and the tests that read the edited lines or the moved constant:

| Test | File | Invariant · layer | This change |
| --- | --- | --- | --- |
| `2.1: every step of actorOf has a short label ...` (list `ACTOR_STEPS`) | `plugins/panel/hooks/report.test.tsx` | every step `actorOf` names has a label · panel i18n step table | drops `'push-rebased'` from `ACTOR_STEPS` (1.1) |
| `AC-14 flow-steps-you-are-here: every step id of the i18n step table is placed, ...` | `plugins/panel/hooks/report.test.tsx` | the label table and the step table agree · panel steps | unchanged; stays green (1.2) |
| `change-loop decide: the B rows are exactly the steps the checkers can return` (`returnable.has('push-rebased')` is false) | `plugins/openspec/hooks/change-loop.test.mjs` | the step stays gone · change loop | unchanged |
| `release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push` | `plugins/openspec/hooks/change-loop.test.mjs` | no `push-rebased` in the flow doc or the skill · docs | unchanged |
| `commit-attribution AC-1 T1` to `T5` (`/--force\|push-rebased/` never in a commit hand-off) | `plugins/openspec/hooks/change-loop.test.mjs` | a plain push, never a rewrite · change loop | unchanged |
| scenario "No step pushes by force" | `openspec/specs/change-coordination/spec.md` | no step is `push-rebased` · spec | unchanged |
| `change-loop docs: the design records the answers` (the CI-pin assertions, lines 2577 to 2601) | `plugins/openspec/hooks/change-loop.test.mjs` | the CI snippet pins the current release · docs | follows the pin (3.2) |
| `the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, ...` and `AC-8 release-ready: every pack version matches its marketplace entry, ...` | `plugins/openspec/hooks/deliver-check.test.mjs` | the pin and every marketplace entry follow the manifests · release | unchanged; green when 3.1 and 3.2 land together |
| `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` and the `pinMismatches` assertion | `plugins/openspec/hooks/change-loop.test.mjs` | same · release | unchanged; reads the version from the manifest |
| every test that reads `TWO_PRS` | `plugins/openspec/hooks/delivery-models.test.mjs`, `plugins/openspec/hooks/release-tags.test.mjs` | the two-prs settings text · test fixture | same text, now defined in `conduct-check.test.mjs` (2.1) |

No test reads the text of `openspec/specs/commit-attribution/spec.md`
(`grep -rn "commit-attribution" plugins --include='*.test.*'` finds only test names), so the delta
moves no test.

### The release (AC-4's suites, and `CONTRIBUTING.md` step 5)

devkit-panel and devkit-openspec both change (a panel module and a hook test file each ship in their
pack), so each takes a patch, and the marketplace a patch; the devkit-openspec patch moves the CI pin
of `docs/openspec-flow.md`, and after the merge the loop answers `tag-release` for it
(`devkit.release_tag`, ADR 0019). Every number is "the next free number on origin/main at the last
merge before review"; the numbers at the plan base are given only to locate the lines.

## 1. The panel step vocabulary (AC-2, AC-4)

- [x] 1.1 Remove `push-rebased` from `plugins/panel/hooks/steps.ts` (the `pr` group),
  `plugins/panel/hooks/i18n.ts` (the `STEPS` line) and `plugins/panel/hooks/report.test.tsx`
  (`ACTOR_STEPS`), as "The panel step vocabulary" says, in one commit whose message names the
  invariant (every step `actorOf` names has a label, and every label's step is placed), the layer
  (the panel's step and label tables) and the suite (`plugin test plugins/panel`). Check:
  `grep -rn "push-rebased" plugins/panel` prints nothing, and `git diff --stat` shows these three
  files only, each with one line changed or removed.
- [x] 1.2 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` green; covers AC-2 and, for the panel, AC-4.

## 2. The two-PR override tests (AC-3, AC-4)

- [x] 2.1 Superseded at the merge of main (suite-speed, ADR 0026; see the update in "The two-PR
  override tests (AC-3)"): `TWO_PRS` lives in `plugins/openspec/hooks/test-fixtures.mjs`, `conduct-check.test.mjs`
  imports it from there, and `delivery-models.test.mjs` and `release-tags.test.mjs` keep main's imports; the
  move below was not made and its Check does not apply. Original text: Move `TWO_PRS` into `plugins/openspec/hooks/conduct-check.test.mjs` and make
  `plugins/openspec/hooks/delivery-models.test.mjs` import and re-export it, as "The `TWO_PRS`
  constant moves, unchanged" says; commit message: invariant "the two-prs settings text is one
  constant, unchanged", layer "test fixture", suite "the guard suite (delivery-models and
  release-tags)". Check: `git diff` shows the constant's text identical on both sides, no assertion
  line changed, and `grep -n "TWO_PRS" plugins/openspec/hooks/release-tags.test.mjs` still shows the
  import from `./delivery-models.test.mjs`.
- [x] 2.2 Add the fixture (`TWO_PRS_CONFIG`, `twoPrsConflict`, `listedBases`) and the two tests of
  "The new tests" to `plugins/openspec/hooks/conduct-check.test.mjs`, after the README test. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="under two-prs" plugins/openspec/hooks/conduct-check.test.mjs`:
  both pass. Then prove they are not vacuous: change `twoPrsConflict`'s `{ config: TWO_PRS_CONFIG }`
  to `{ config: CONFIG }` for one run of the same command, see both tests fail on their first
  assertion ("the two-prs model is in force"), and restore the line (`git diff` shows only the
  additions of this task). If a test fails on the real fixture, stop as the preamble says. Commit
  message: invariant, layer and suite of the comment above the fixture.
- [x] 2.3 Gate: `mkdir -p /private/tmp/devkit-rml-p2 && env TMPDIR=/private/tmp/devkit-rml-p2 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/release-tags.test.mjs && rmdir /private/tmp/devkit-rml-p2` green (`release-tags.test.mjs` imports `delivery-models.test.mjs`, which imports `conduct-check.test.mjs`, so this one process runs the three files' tests and the deliver-check and release-merge tests they load); covers AC-3 and, for these suites, AC-4.

## 3. Release, the spec proof and the whole suite (AC-1, AC-4)

- [x] 3.1 Bump devkit-panel (`plugins/panel/.claude-plugin/plugin.json`) and devkit-openspec
  (`plugins/openspec/.claude-plugin/plugin.json`) each by a patch, to the next free number on
  origin/main at the last merge before review, the same two in `.claude-plugin/marketplace.json`, and
  the marketplace's `metadata.version` by a patch, likewise. Add at the top of `CHANGELOG.md` a section
  `## <marketplace version> — release-merge leftovers` with one bullet for devkit-openspec (a
  conduct-check test runs the release-merge override under the two-PR delivery model, base and test
  branch apart; the CI snippet now pins `v<devkit-openspec version>`, the release's tag), one for
  devkit-panel (the step table and the label table drop `push-rebased`, which no checker returns
  since devkit-openspec 0.29.0), and one for the spec (`commit-attribution` drops the scenario and the
  mention of `push-rebased`). Check: `python3 scripts/check.py` and
  `python3 scripts/gen-catalog.py --check` pass.
- [x] 3.2 Move the CI pin to the new devkit-openspec version: the `v0.33.0` of
  `docs/openspec-flow.md` (lines 661, 662 and 675 at the plan base, four occurrences) become
  `v<devkit-openspec version>`. In the same commit, in `plugins/openspec/hooks/change-loop.test.mjs`,
  test `change-loop docs: the design records the answers`: the invariant comment (line 2577) says
  release-merge-leftovers moves the pin to that version, above roadmap-sessions-upfront's 0.33.0
  (release 0.37.0); the `assert.match(flow, /v0\.33\.0/, ...)` (line 2578) matches the new version
  with the message `the CI snippet pins the current release (release-merge-leftovers: <version>)`; and
  a new line after it, `assert.doesNotMatch(flow, /v0\.33\.0/, 'no pin left on main\'s release before it (roadmap-sessions-upfront)');`.
  Commit message: invariant "the CI snippet pins the current release", layer "documentation test",
  suite "the guard suite". Check: `grep -c "v0.33.0" docs/openspec-flow.md` prints 0, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="change-loop docs: the design records the answers|release-merge-conflict 15" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 3.3 Prove AC-1 before the pull request: copy `openspec/` into a fresh folder
  (`d="$(mktemp -d)" && cp -R openspec "$d/"`), run `openspec archive release-merge-leftovers --yes`
  inside `$d`, and read `$d/openspec/specs/commit-attribution/spec.md`: `grep -c "push-rebased"` prints
  0, `grep -c "own rebase rewrote"` prints 0, `grep -c "^#### Scenario:"` prints 17 (18 at the plan
  base, less the one removed), the requirement "Every hand-off to the commit agent asks the session
  for its attribution lines" holds the nine scenarios of the removed one other than "A branch the
  loop's own rebase rewrote", and the scenario "Every dispatch of the commit agent names the block"
  reads "and the devkit skill's `agent` items, are read". Record the outputs for `pr-verifier`, then
  remove `$d`. The repository's own `openspec/specs/` is not edited (the delta
  applies at the real archive). If the scratch archive refuses for a reason other than the delta,
  report it to the conducting session instead of working around it.
- [x] 3.4 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && mkdir -p /private/tmp/devkit-rml-p3 && env TMPDIR=/private/tmp/devkit-rml-p3 GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && rmdir /private/tmp/devkit-rml-p3 && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && openspec validate release-merge-leftovers --strict` green (the guard suite as a background command; record its duration); covers AC-1 (with 3.3), AC-2 and AC-3 again, and AC-4: every suite keeps its result.

## Workflow follow-up

- After the merge the loop answers `tag-release` for the new devkit-openspec version (ADR 0019);
  the session pushes the tag before the retro.
- Archive with the retro: the archive applies the delta to `openspec/specs/commit-attribution/spec.md`
  and ticks the `release-merge-leftovers` line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-openspec and devkit-panel, and move the pinned
  `devkit-reviews` workflow to the new tag through each project's own pull request.
