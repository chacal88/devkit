<!-- devkit-stage tasks result=passed attempt=1 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Tasks

Change: `state-listing-speed` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main`
at `6f03a57c` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `specs/change-state/spec.md`, `decisions.md`, `release.md`)

Work only in this change's worktree, on its branch. Every name, signature, rule, text and test is in
`design.md`: D-1 the routing in `runCommand`, D-2 the child read, D-3 `listingIds`, D-4 the bound and
the pool, D-5 the join and the failures, D-6 small listings, D-7 the tests and the pinned existing
tests, D-8 the signatures, the document sentence and the release, D-9 the real run. The implementer
copies them and makes no design choice; a choice the design does not settle stops the phase and goes
to the owner. No file under `plugins/` changes other than `plugins/openspec/hooks/change-loop.mjs`
and the new `plugins/openspec/hooks/change-state-listing.test.mjs`; `status-line.mjs`,
`machine-probe.mjs` and `roadmap-loop.mjs` are not edited.

The release follows the note rule (`docs/adr/0034-release-at-merge.md`; `CONTRIBUTING.md` step 5):
`release.md` reads `devkit-openspec: patch`, and no task bumps a version, edits a `CHANGELOG.md`
line or a CI pin line, or numbers an ADR. This change has no ADR (`decisions.md`).

Test first: task 1.1 writes the new tests and sees them red on the code as it is; that run is the
task's check, never a gate. Every new test's name starts `state-listing-speed AC-<n> `. A test of a
function this change adds reaches it through a namespace import (`import * as changeLoopModule from
'./change-loop.mjs'`), so the red run fails test by test instead of failing the file at load. Every
`t.test` subtest is awaited. No existing test is edited: the second table of `design.md` D-7 names
the invariant, layer and suite of each test that reads what this change touches; a failing one stops
the phase and goes to the owner. The new test file and its `scripts/test-map.json` entry land in one
commit (`CLAUDE.md`). Leave no scratch file in the tree, and end every task with `git status --short`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. The `node scripts/test-suite.mjs --own-files` part is not
a part of the train's command, so it has its own passing row in `evidence.md` after the last merge of
the base (`openspec/config.yaml`, `Gates:`), with the run's `selected` lines and its `suite:` line.
Run each suite run as a background command of the tool, never with a shell `&`, with no other suite
on the machine. On the avel machine run the tests with `TMPDIR` under `/var/tmp`. The tests need the
`openspec` CLI 2.x on `PATH`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `listing-reads-in-parallel` | 1.1, 1.3, 1.4, 1.7, 2.3 |
| AC-2 | `listing-output-unchanged` | 1.1, 1.2, 1.3, 1.4, 1.7, 2.1, 2.3 |
| AC-3 | `listing-concurrency-bound` | 1.1, 1.2, 1.7, 2.3 |
| AC-4 | `listing-failures-unchanged` | 1.1, 1.3, 1.5, 1.7, 2.3 |
| AC-5 | `eleven-changes-under-ten-seconds` | 2.1 |
| AC-6 | `single-change-and-next-unchanged` | 1.1, 1.3, 1.4, 1.5, 1.7, 2.3 |

## 1. The parallel listing, its tests and its document (phase 1)

- [ ] 1.1 Write `plugins/openspec/hooks/change-state-listing.test.mjs` with the stand-in `openspec`,
  the `listing()` fixture and the eleven tests of `design.md` D-7, and add it to
  `files["plugins/openspec/hooks/change-loop.mjs"]` in `scripts/test-map.json` in sorted place
  (D-7), in the same commit. Run `node scripts/test-suite.mjs plugins/openspec/hooks/change-state-listing.test.mjs`
  on the code as it is and save its output, as printed, to
  `openspec/changes/state-listing-speed/proof/red-1.txt`. Check: `AC-1 the reads of the listing overlap` fails (the reads run one after another), and
  the two AC-3 tests, the three AC-4 tests and the AC-6 small-listing test that call `boundedMap`,
  `listingBound` or `stateListing` fail (the exports are missing); the two AC-2 tests,
  `AC-4 a child that fails in a checkout of its own fails the listing as one after another` and
  `AC-6 in-process state stays synchronous` pass, since they pin what must not change (AC-1 to AC-4,
  AC-6).
- [ ] 1.2 In `plugins/openspec/hooks/change-loop.mjs`, move the id computation of `stateEntries` into
  `listingIds(start, run, { env, gh })` and call it from `stateEntries` (D-3), and add
  `listingBound()` and `boundedMap(items, limit, run, { stopWhen })` with the `availableParallelism`
  import (D-4). Check: the two AC-3 pool tests pass;
  `node scripts/test-suite.mjs plugins/openspec/hooks/change-state-stages.test.mjs` passes unedited
  (AC-2, AC-3).
- [ ] 1.3 In the same file, add `LOOP_SCRIPT`, `childRead(id, { argv, env, cwd })` with the `spawn`
  import and the child's `GIT_OPTIONAL_LOCKS=0` (D-2), and `stateListing(argv, { env, cwd, readOne })`
  with the join, the failure rules and the small-listing rule of D-5 and D-6. Check: the three AC-4
  tests that call `stateListing` with a stand-in `readOne` (`an unreadable change is listed blocked`,
  `a read that fails the command fails the listing`, `a child that dies is a usage failure`) and
  `AC-6 a listing of one change or none starts no read process` pass; the two AC-2 tests and
  `AC-4 a child that fails in a checkout of its own fails the listing as one after another`, which
  run the process or `main`, still pass (AC-2, AC-4, AC-6).
- [ ] 1.4 In the same file, add `STATE_ARGS`, use it in `runState`, and add the `runCommand` branch
  of D-1. Check: `AC-1 the reads of the listing overlap` and every other test of
  `change-state-listing.test.mjs` pass; `node plugins/openspec/hooks/change-loop.mjs state --offline --lang en`
  in this worktree exits 0, and its stdout, saved to a file in the session's scratch folder, is
  byte-identical (`cmp`) to that of
  `node --input-type=module -e "import('./plugins/openspec/hooks/change-loop.mjs').then((m) => process.stdout.write(m.main(['state', '--offline', '--lang', 'en']).stdout))"`
  run from the worktree's root (AC-1, AC-2, AC-6).
- [ ] 1.5 Check the pinned tests of `design.md` D-7's second table by name, unedited:
  `node scripts/test-suite.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/status-line.test.mjs`
  passes, and `grep -nE "set_session_model|session-model|start_session" plugins/openspec/hooks/change-loop.mjs`
  prints nothing; the rows of `change-loop-remote-state.test.mjs`, `change-loop.test.mjs` and
  `roadmap-loop-upfront.test.mjs` (among them the two `state --change nope` tests of AC-4's
  `--change` case) run in the gate of 1.7, which the map selects for `change-loop.mjs` (AC-4, AC-6).
- [ ] 1.6 In `docs/openspec-flow.md`, add the sentence of `design.md` D-8 to the "A change's state."
  paragraph, after "one per unfinished change without it.", with no blank line. Check:
  `python3 scripts/check.py` passes, and the paragraph still holds `ADR 0017`, `wrong-branch`,
  `chore/archive-<id>` and `the checkout it is called from` (the `change-state ADR 0017` and
  `unlocated 3` tests of `change-loop-remote-state.test.mjs`, which the gate's selection runs).
- [ ] 1.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-3, AC-4, AC-6).

## 2. The real run and the delivery checks (phase 2)

- [ ] 2.1 Conductor: the real run of `design.md` D-9 on the avel machine, with no test suite
  running: the deletion check, the scratch clone under `/var/tmp` with 11 changes in play, the two
  pack copies from `origin/main` and `HEAD`, `uptime`, the two timed
  `state --offline --lang en` runs in the clone, `uptime` again and `cmp` of the two outputs; commit
  the commands, the count of entries, both times, both loads and the `cmp` result as
  `openspec/changes/state-listing-speed/proof/listing-11.txt`, and remove the clone and the copies.
  Check: the file shows 11 entries, the branch's run under 10 s and an empty `cmp`; a run at or above
  10 s stops here and goes back to the owner with the split D-9 names (AC-5, AC-2).
- [ ] 2.2 The release note stays the only release record. Check:
  `python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`,
  `claude plugin validate .` and `openspec validate state-listing-speed --strict` pass;
  `git diff --name-only origin/main...HEAD -- CHANGELOG.md .claude-plugin/marketplace.json plugins/openspec/.claude-plugin/plugin.json plugins/openspec/hooks/status-line.mjs plugins/openspec/hooks/machine-probe.mjs plugins/openspec/hooks/roadmap-loop.mjs .github/workflows/ci.yml`
  prints nothing; `node plugins/openspec/hooks/deliver-check.mjs state-listing-speed` prints no
  `no release:` line and no `release.md:` line.
- [ ] 2.3 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1 to
  AC-4, AC-6), after the last merge of the base. The pr-verifier copies the run's `selected` lines
  into its row, and writes the AC-5 row from `proof/listing-11.txt`.

## Workflow follow-up

- The `check` job of this change's pull request runs `node scripts/test-suite.mjs --own-files`
  green; the next train's pull request and `push` to `main` run the whole suite.
- Before `enable-auto-merge`, the delivery reads `release.md` (`devkit-openspec: patch`) and writes
  the version, the `CHANGELOG.md` entry and the CI pins once, at the merge.
- After the merge, the coordinator's status bar is checked in a real roadmap session: it prints the
  counts line.
