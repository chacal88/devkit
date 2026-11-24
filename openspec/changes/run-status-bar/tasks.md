<!-- devkit-stage tasks result=passed attempt=1 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Tasks

Change: `run-status-bar` · Date: 2026-11-24 · Owner: Kaue (chacal88)

Work only in this change's worktree, on branch `run-status-bar`. Every rule, key, text and test is in
`design.md`: D-1 the command and the settings entry, D-2 the input, D-3 which line, D-4 the `state`
additions and the shared helper, D-5 the change's line, D-6 the width and cut rule, D-7 the counts,
D-8 the words, D-9 bounds, D-10 read-only, D-11 the tests (H-, S-, B- and E- ids), D-12 the proof
split, D-13 documents and release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written; each `&&` part runs on its own, no part holds a
`|`, and every gate exits 0 when its phase is done. Every gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does, except the suite part of 3.4, which since the
merge of main d917ae0 is the delivery train's own text (see 3.4). The whole suite runs once, in 3.4, as a
background command of the tool, never with a shell `&`. Test first: each phase's test task comes
before its code tasks and its new tests fail on the phase's base (the check says how; a test file that
imports an export or a module not written yet fails as a whole at load, before any of its tests runs). An existing
test changes only where D-11 names it: E-1 (in 1.2), E-4 (in 1.6), E-5 (in 2.3) and E-6 (in the merge
of `origin/main` `c09860c`, commit `4c25ecc`: `stages: null` at the end of the expected entry of
`unlocated 1: state lists an unplaced change blocked and every other change as before` in
`plugins/openspec/hooks/change-loop-remote-state.test.mjs`; invariant: an unplaced change is listed
blocked, with the root and branch of the checkout that holds it and null stage fields; layer: the
`state` command; suite: change-loop-remote-state). E-3 (in 3.1, with
the bump, in the approved plan) is superseded by ADR 0030 at the merge of `origin/main` `d917ae0`: no
release edits `change-loop-compozy.test.mjs` any more. The review fixes add the new tests S-9b (in
`change-state-stages.test.mjs`, finding F10) and B14b (in `change-loop.test.mjs`, finding F11), both
under 1.5, and edit no existing test. Any other existing
test that fails is a stop: report it and change nothing. The two release-pin tests of
`deliver-check-cli.test.mjs` (D-13), the real-doc pin test of `release-merge.test.mjs` and, since ADR
0030, `change-loop docs: the design records the answers` of `change-loop-compozy.test.mjs` do not change:
they read the version from `plugin.json`, and 3.1 moves the doc's pins with the version, so they keep passing. End every task with `git status --short` and leave no scratch file in the tree.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `lone-change-bar` | 1.2, 1.4, 2.1, 2.2, 2.3, 3.3 |
| AC-2 | `no-budget` | 2.1, 2.2, 3.3 |
| AC-3 | `roadmap-counts` | 1.2, 1.5, 2.1, 2.2, 2.3, 3.3 |
| AC-4 | `nothing-conducted` | 2.1, 2.2, 3.3 |
| AC-5 | `read-only` | 1.5, 2.1, 2.2, 3.3 |
| AC-6 | `person-language` | 2.1, 2.3, 3.3 |
| AC-7 | `mock-matches` | 2.1, 2.3, 3.3 |

## 1. The stages that apply and the offline read in `state` (AC-1, AC-3, AC-5)

- [x] 1.1 Merge `origin/main` (at least `3af3655`, the plan's base) into the branch, with no conflict left in
  a file of this change's folder. Check: `git merge-base --is-ancestor 3af3655 HEAD` exits 0, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs`
  passes before any code changes.
- [x] 1.2 Write the tests H-1 to H-8 in `plugins/openspec/hooks/flow-check.test.mjs` and S-1 to S-12 in
  the new `plugins/openspec/hooks/change-state-stages.test.mjs` (D-11; fixtures from `test-fixtures.mjs`
  and `change-loop-fixtures.mjs`, folders through `tmpFolder`), and update E-1 in
  `plugins/openspec/hooks/change-loop-remote-state.test.mjs` (invariant: the exact contract of one
  `state` entry; layer: the `state` command; suite: the change loop's) to expect `stages` at the end of
  the entry. S-11 reads the two sources as text and imports nothing new, so
  `change-state-stages.test.mjs` loads before 1.5. Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^run-status-bar" plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs`
  fails: `flow-check.test.mjs` at load, its error naming the missing export `notApplicableOf` or
  `appliedStages`, and each test of `change-state-stages.test.mjs` but S-6 and S-10 for the missing
  `stages` field, `--offline` flag or shared stub, none for a fixture or syntax error. S-6 and S-10
  pass on the base: they are negatives that already hold there (`next` prints no `stages` key today,
  and `--offline` is an unknown option, so `--offline yes` already exits 3 with the plain reply).
- [x] 1.3 Add `notApplicableOf` and `appliedStages` to `plugins/openspec/hooks/flow-check.mjs` and make
  `artifactState` call `notApplicableOf` (D-4), with no behaviour change to the walk. Check: H-1 to
  H-8 pass and every other test of `plugins/openspec/hooks/flow-check.test.mjs` passes unchanged.
- [x] 1.4 Add the `stages` option of `nextAction`, the `stages` field of `stateEntries` and the `null`
  of the entries it builds itself, in `plugins/openspec/hooks/change-loop.mjs` (D-4). Check: S-1 to S-6,
  S-12 and E-1 pass; `next` output carries no `stages` (S-6).
- [x] 1.5 Move the offline stub to `plugins/openspec/hooks/merge-setup.mjs` as the exported
  `OFFLINE_GH`, import it in `plugins/openspec/hooks/roadmap-loop.mjs` (its own copy removed) and in
  `change-loop.mjs`, and add `--offline` to `runState` and to `USAGE` (D-4). Check: S-7 to S-11 pass,
  and `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs`
  passes unchanged. Added after review (findings F10 and F11): the `offline` fact set by `nextAction`
  and the `silent` helper of `decide`, which route `stop-merge-setup` to `waiting-on-github`, `silent`
  only offline (D-4, commit `accaace`), with S-9b in `change-state-stages.test.mjs` and B14b beside
  `B14` in `plugins/openspec/hooks/change-loop.test.mjs` (D-11). Check: S-9b passes, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop decide: " plugins/openspec/hooks/change-loop.test.mjs`
  passes, `B14` and B14b among them.
- [x] 1.6 Update the "A change's state" paragraph of `docs/openspec-flow.md` (D-13): `[--offline]` in
  the command and `stages` in the list of fields, the paragraph still after "**Waiting on GitHub.**" and
  still citing ADR 0017 (E-2, in `plugins/openspec/hooks/change-loop-remote-state.test.mjs`, asserts
  both). In the same task edit E-4 (D-11), the third allowed edit beside E-1 and E-3 (E-3 since superseded by ADR 0030 at the merge
  of `d917ae0`): add `'stages'`
  to the `NEXT_ONLY` list of the helper `lessIdentity` in
  `plugins/openspec/hooks/change-loop-remote-state.test.mjs`, and change no other line of the file
  (invariant: `state` and `next` agree on a change's identity apart from the next-only fields; layer:
  the change loop's state; suite: change-loop-remote-state). Check: E-2 passes, `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs`
  passes (the three tests of E-4 among them), and `python3 scripts/check.py` exits 0.
- [x] 1.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs && python3 scripts/check.py`
  green (AC-1, AC-3, AC-5: the data the bar reads).

## 2. The status line command (AC-1 to AC-7)

- [x] 2.1 Write B-1 to B-46 in the new `plugins/openspec/hooks/status-line.test.mjs` (D-11): one test
  or awaited `t.test` per guard and label, negatives included; B-42 to B-44 take each expected line
  verbatim from `openspec/changes/run-status-bar/mock/` as constants in the test file (a test reads no
  git history). Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs`
  fails at load, its error naming the missing module `status-line.mjs`, not a syntax or fixture error.
- [x] 2.2 Write `plugins/openspec/hooks/status-line.mjs`: the input (D-2) read through `readStdin(1000)`,
  with the optional wait parameter added to `readStdin` in `plugins/openspec/hooks/change-loop.mjs`
  (default unchanged), the choice of line and its calls (D-3), the exported `main` with its injection
  points and the `state` call with its bound and the child kill (D-9), read-only (D-10), the empty line
  on every failure. The file already exports `lineOfChange`, `countsLine` and `columns` with the
  signatures of D-11, so the test file loads; until 2.3 writes them they return `''`, `''` and the code
  point count. Check: B-1 to B-6, B-8, B-11 to B-19, B-36, B-39 to B-41 and B-44 to B-46 pass.
- [x] 2.3 Add the drawing: `lineOfChange` with the strip and progress (D-5), `columns` and the cut rule
  (D-6), `countsLine` (D-7), and the four `bar.*` keys in both languages of `MESSAGES` in
  `plugins/openspec/hooks/change-loop.mjs` (D-8). In the same task edit E-5 (D-11), the fourth allowed
  edit beside E-1, E-3 and E-4 (E-3 since superseded by ADR 0030 at the merge of `d917ae0`): add `total: 15, all: 6, running: 3, waiting: 2, blocked: 1,
  blockedWord: 'blocked'` to the `SAMPLE` constant of `plugins/openspec/hooks/change-loop.test.mjs`, and
  change no other line of the file (invariant: every reply key renders in both languages with its
  sample parameters and no internal term shows; layer: the change loop's replies; suite: change-loop).
  Check: B-7, B-9, B-10, B-20 to B-35, B-37, B-38,
  B-42 and B-43 pass (B-7, B-9 and B-10 print the counts line and the change's line, drawn here), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs`
  passes (`change-loop replies: no internal term in either language` among them).
- [x] 2.4 Add the paragraph "**The status line.**" to `docs/openspec-flow.md` after the state paragraph
  and the `hooks/status-line.mjs` row to "What's inside" of `plugins/openspec/README.md` (D-1, D-13),
  each with the settings entry of D-1 copied exactly. Check: `python3 scripts/check.py` exits 0 and the
  entry in both files is the same text as in `design.md` D-1.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py`
  green (AC-1 to AC-7). The second part runs the reply tests of
  `plugins/openspec/hooks/change-loop.test.mjs` (E-5 among them) on their own, since a name pattern
  would filter the first part's files too.

## 3. Release and validation

- [x] 3.1 Bump devkit-openspec's `version` in `plugins/openspec/.claude-plugin/plugin.json` and in
  `.claude-plugin/marketplace.json` to the next minor after `origin/main`'s at the last merge before
  review, and the marketplace's own version to the next after `origin/main`'s at that merge (at the merge
  of `c09860c`: devkit-openspec 0.44.1 to 0.45.0, marketplace 0.49.1 to 0.50.0, the heading `## 0.50.0`
  and the doc's pins `v0.45.0`; at the earlier merge of `d917ae0` it was 0.43.0 and 0.48.0); in the same
  task add the `CHANGELOG.md` entry headed `## <that marketplace version>` (the status line command, the
  settings entry, the `stages` field and `--offline` of `state`, the offline stub's one place), since
  `check_changelog` of `scripts/check.py` refuses a marketplace version with no such heading; and move
  every release pin of `docs/openspec-flow.md` to the new devkit-openspec version: the
  `<commit sha of v...>` URL line, the `pinned to the commit of v...` comment, the `` (`v...` above) ``
  sentence and the `git/ref/tags/v...` command, the set `PIN_MARKER` of
  `plugins/openspec/hooks/release-merge.mjs` names (D-13). The approved plan's E-3 edit in this task
  (the literal `assert.match(flow, /v0\.39\.0/, ...)` line of `change-loop docs: the design records the
  answers` in `plugins/openspec/hooks/change-loop-compozy.test.mjs` moved to the new version, with one
  `assert.doesNotMatch` line and the comment's release history) is superseded by ADR 0030 at the merge
  of `origin/main` `d917ae0`: `main`'s test reads the version from `plugin.json` only, its literal pin
  line and `doesNotMatch` history are gone, and the merge kept `main`'s file unchanged, so this task
  does not edit that file (D-11 E-3). The tests that read the version from
  the manifest, `the pin in docs/openspec-flow.md is the commit sha of v + ...` and
  `AC-8 release-ready: ...` in `plugins/openspec/hooks/deliver-check-cli.test.mjs`,
  `release-merge pin: the real docs/openspec-flow.md: ...` in
  `plugins/openspec/hooks/release-merge.test.mjs` and `change-loop docs: the design records the answers`
  in `plugins/openspec/hooks/change-loop-compozy.test.mjs`, are not edited. If a later merge of `origin/main`
  renumbers the release, the versions, the `CHANGELOG.md` heading and the doc's pins move together.
  Check: `python3 scripts/check.py`
  exits 0, the two devkit-openspec versions are equal,
  `git diff --quiet c09860c HEAD -- plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0 (the
  last merge's `origin/main` commit; `d917ae0` before the merge of `c09860c`, and after a later merge
  that merge's commit), and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/release-merge.test.mjs`
  passes, those four tests included.
- [x] 3.2 Check the generated catalog and the marketplace. Check: `python3 scripts/gen-catalog.py --check`
  exits 0 and `claude plugin validate .` passes.
- [x] 3.3 Make the real runs of D-12, for the pr-verifier to record in
  `openspec/changes/run-status-bar/evidence.md` (D-12: the real runs are recorded there; the implementer
  does not write that file): in this worktree, at its real stage, with
  `--lang en` and `--lang pt-BR` (AC-1, AC-6, AC-7); from the main checkout with an unrecorded session
  id (AC-4); in fixture projects for the approval moment, the `budget` cap (AC-2) and a run file that
  records the input's session (AC-3); each with `git status --short`, the run file and
  `git worktree list` captured before and after (AC-5). Standard input is the JSON D-2 names. Check:
  each run exits 0 and prints the line D-12 expects; the before and after captures are equal.
- [x] 3.4 Gate: `node scripts/test-suite.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check`
  green, run as a background command of the tool (AC-1 to AC-7). The whole suite takes every test
  file, `plugins/openspec/hooks/change-loop.test.mjs` (E-5) among them. Amended after the merge of
  main d917ae0: the suite part is the delivery train's own text, so the train proves it on the joined
  heads (docs/openspec-flow.md "Gate parts proven by the train"); the run with the CI branch
  variables set (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`) passed at 0528b85.

## Workflow follow-up

- At archive (not part of this change's delivery): the archive step rewords the `run-status-bar` line of
  `openspec/roadmap.md` when it ticks it, since the line still names the budget share the owner dropped
  (requirements, question 3; D-13). No task of this change edits the roadmap.
- The owner adds the `statusLine` entry of D-1 to a `settings.json` after the release is installed, and
  checks the dogfood column of D-12 in the next change and the next roadmap run.
