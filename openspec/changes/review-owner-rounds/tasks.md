<!-- devkit-stage tasks result=passed attempt=3 commit=a0e9efb9e046bf0cfe6f88199fbe8d334ea0b11b -->
# Tasks

Change: `review-owner-rounds` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main` at
`6f03a57` as last fetched (the branch has merged nothing yet) · PRD / tech spec: n/a (`proposal.md`,
`design.md`, `decisions.md`, `release.md`, `specs/review-round/spec.md`)

Work only in this change's worktree, on its branch. Every name, message, line and test is in
`design.md`: D-1 `args.owner` and its messages, D-2 the `owner` command, D-3 the quoted line, D-4 the
skill's part, D-5 the five text edits, D-6 the tests and the pinned rules, D-7 the delivered half and
T41, D-8 the real runs. The implementer copies them and makes no design choice.

The release follows the note rule (`proposal.md`, "Release rule"): no task bumps a version, edits a
`CHANGELOG.md` line or a CI pin line, or numbers an ADR. No task adds or moves a script or a test
under the suite's folders, so `scripts/test-map.json` is not edited; a task that would add one edits
the map in the same commit (CLAUDE.md).

Test first in every task that adds a test: write it, see it fail on the code before the task, then
make it pass. Every new test's name starts `review-owner-rounds AC-<n> ` and its block opens with a
comment naming its invariant, its layer and its suite (D-6). Before T41 is changed, its commit message
names its invariant, layer and suite (D-7). Leave no scratch file in the tree, and end every task with
`git status --short`.

Every gate is one backticked command, run as written. Run a long test run as a background command of
the tool, never with a shell `&`, with no other suite on the machine, and record `uptime` next to it.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `owner-words-printed` | 1.1, 1.2, 1.4, 1.6, 1.7, 2.1, 3.1, 3.2, 3.3, 3.5 |
| AC-2 | `one-line-per-round` | 1.1, 1.2, 2.2, 3.1, 3.2, 3.5 |
| AC-3 | `no-words-no-round` | 1.1, 1.2, 1.3, 1.6, 2.2 |
| AC-4 | `rounds-one-two-unchanged` | 1.1, 1.2, 1.5, 2.2, 3.4 |
| AC-5 | `resolution-scope` | 1.1, 1.2, 1.3, 2.2, 3.1, 3.2, 3.5 |

## 1. The owner's words in the round's rules, its CLI and its texts (phase 1)

- [x] 1.1 Write the `review-owner-rounds AC-1` to `AC-5` tests of D-6 in
  `plugins/core/skills/review-change/scripts/review-round.test.mjs`, except the text test (task 1.7),
  and run them on the code before task 1.2. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^review-owner-rounds " plugins/core/skills/review-change/scripts/review-round.test.mjs`
  fails, each new test failing for the missing rule or command, not for a syntax or import error:
  the owner-command tests drive the CLI by process (`spawnSync` of `review-round.mjs owner`, as the
  file's existing CLI tests do) and import nothing new, so the file still loads before task 1.3 adds
  `recordedOwner`.
- [x] 1.2 In the rules section of `plugins/core/skills/review-change/scripts/review-round.workflow.js`,
  add D-1's checks to `validateArgs` (after the round range check, D-1's order and messages), the
  helper `ownerLine(args)` and its line in `consolidate` (D-3); add `ownerLine` to `NAMES` and to the
  exported names in `plugins/core/skills/review-change/scripts/review-round.mjs`. Check: the
  `review-owner-rounds AC-1`, `AC-2`, `AC-4` and the `validateArgs` / Workflow / CLI `AC-3` and
  `AC-5` tests pass with the command of 1.1.
- [x] 1.3 In `plugins/core/skills/review-change/scripts/review-round.mjs`, add the `owner` subcommand
  and the exported `recordedOwner({ changeDir, scope, round })` (D-2: input checks, the copy of
  `readDeclared`'s reading, the last match, the messages), add `owner` to `SUBCOMMANDS`, `COMMANDS`
  and the CLI header comment. Check: the owner-command `AC-3` and `AC-5` tests pass with the command
  of 1.1.
- [x] 1.4 Change `coordinator-loop-fixes AC-7 T41` in `review-round.test.mjs` as D-7 says (its
  arguments gain the owner's words of round 3, its name gains `with the owner's words`); the commit
  message names its invariant ("`args.limit` bounds `args.round`"), its layer (the round's rules) and
  its suite (`review-round`). Check: `node scripts/test-suite.mjs --test-name-pattern="^coordinator-loop-fixes AC-7 " plugins/core/skills/review-change/scripts/review-round.test.mjs`
  passes, with T42 and T43 unchanged (`git diff` touches no line of theirs).
- [x] 1.5 Rounds 1 and 2 unchanged (AC-4): `git diff origin/main -- plugins/core/skills/review-change/scripts/review-round.test.mjs`
  shows no removed or edited line outside T41, and the whole file passes. Check:
  `node scripts/test-suite.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` exits 0.
- [x] 1.6 Write the two `deliver-check.test.mjs` tests of D-6 (the parity of `recordedOwner` with
  `readDeclared`, and `readReviewMd` on a section quoting `Consensus: PASS (round 9/9)`) in
  `plugins/openspec/hooks/deliver-check.test.mjs`, importing `recordedOwner` beside the file's
  existing import of `review-round.mjs`. Check: `node scripts/test-suite.mjs --test-name-pattern="^review-owner-rounds " plugins/openspec/hooks/deliver-check.test.mjs`
  passes; it fails when `recordedOwner`'s reading of an empty record is changed to read as no entry
  (seen once, then restored).
- [x] 1.7 Make D-5's five text edits in `plugins/core/skills/review-change/SKILL.md` (the `args`
  sentence and the rounds bullet), `plugins/openspec/skills/ship-change/SKILL.md` (the `review` and
  `review-resolution` rows) and `docs/openspec-flow.md` (the paragraph of "The review round"), and
  write the text test of D-6 (`review-owner-rounds AC-1 text ...`) in `review-round.test.mjs` first.
  Check: the text test passes with the command of 1.1; `grep -c "quoting the owner's words" plugins/core/skills/review-change/SKILL.md`
  prints 0; `python3 scripts/check.py` exits 0.
- [x] 1.8 Run every test file that reads a text this phase edits, by name (D-6, "Pinned rules"; the
  map does not select all of them, Risks). Check:
  `node scripts/test-suite.mjs --concurrency=3 plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/status-line.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs`
  exits 0; its `suite:` line and `uptime` go in the phase's report.
- [x] 1.9 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-3, AC-4, AC-5).

## 2. The real runs and the validation (phase 2)

- [x] 2.1 Conductor: RR1 of D-8 on the phase-1 head. Build the scratch project with
  `/var/tmp/devkit-ror/fixture.mjs` (outside the repository; it records the round-3 authorization
  through this worktree's `change-loop.mjs` `recordDeclared` and writes no `declared.json` by hand),
  then run the `review-change` skill's `agents` path on its change `demo`, scoped to
  `code-quality-reviewer`, round 3, limit 3, with `args.owner` from `review-round.mjs owner`, and
  append the section to its `review.md`. Copy and scrub the run's files into
  `openspec/changes/review-owner-rounds/proof/` as D-8 names them and append `rr1 ...: pass` to
  `proof/checks.txt` when D-8's check holds. Check:
  `grep -c "^rr1 .*: pass$" openspec/changes/review-owner-rounds/proof/checks.txt` prints 1 (AC-1).
- [x] 2.2 Conductor: RR2 to RR5 of D-8 on the same scratch project, with this worktree's
  `review-round.mjs` and, for RR4, the base's two round files copied to `/var/tmp/devkit-ror/base/`
  by `git show origin/main:<path>`. Copy and scrub each run's files into `proof/` and append one
  `rr<n> ...: pass` line per run. Check: `grep -c "^rr[2-5] .*: pass$" openspec/changes/review-owner-rounds/proof/checks.txt`
  prints 4, and `grep -rlE "/var/tmp/devkit-ror|$HOME" openspec/changes/review-owner-rounds/proof/`
  prints nothing (AC-2, AC-3, AC-4, AC-5).
- [x] 2.3 Validate the change and the packs. Check: `openspec validate review-owner-rounds --strict`,
  `python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`
  and `claude plugin validate .` each exit 0.
- [x] 2.4 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1 to
  AC-5).

## 3. The owner's words in a backtick span (phase 3, plan attempt 3)

Gate 2.4 failed on `proof/rr2-review.md:35: non-English text`: the plain-quoted line of attempt 2
leaves the owner's Portuguese outside a backtick span, which `scripts/check.py#check_language`
refuses. This phase moves the line to D-3's form, `` Owner's words for round N: "`<words>`" ``, each
backtick of the words printed as `'`, and nothing else; `scripts/check.py` is not edited. Task 2.4 is
ticked together with 3.7, when the same command passes. No script or test is added or moved, so
`scripts/test-map.json` is not edited.

- [x] 3.1 Change the tests of D-6's table "The line's form, attempt 3" to the new literal, test first:
  in `plugins/core/skills/review-change/scripts/review-round.test.mjs` the `review-owner-rounds AC-1
  consolidate ...`, `AC-1 the Workflow script ...`, `AC-2 ...` and `AC-5 ...` assertions of the line,
  the backtick case added to `AC-1 consolidate ...` (words `` a `b` c `` print `` "`a 'b' c`" ``), and
  the rounds bullet's clause in `AC-1 text ...` (D-5 2's block); in
  `plugins/openspec/hooks/deliver-check.test.mjs` the line asserted by `review-owner-rounds AC-1
  readReviewMd ...`. Names, invariants, layers and suites stay. Check: on the code of phase 1,
  `node scripts/test-suite.mjs --test-name-pattern="^review-owner-rounds " plugins/core/skills/review-change/scripts/review-round.test.mjs`
  and `node scripts/test-suite.mjs --test-name-pattern="^review-owner-rounds " plugins/openspec/hooks/deliver-check.test.mjs`
  each fail, every failing test failing on an assertion of the line (no syntax or import error).
- [x] 3.2 In the rules section of `plugins/core/skills/review-change/scripts/review-round.workflow.js`,
  change `ownerLine(args)` to D-3's expression (the backtick span, each backtick printed as `'`).
  Check: `node scripts/test-suite.mjs --test-name-pattern="^review-owner-rounds AC-(1 consolidate|1 the Workflow|2|5) " plugins/core/skills/review-change/scripts/review-round.test.mjs`
  and the `deliver-check.test.mjs` command of 3.1 pass.
- [x] 3.3 In `plugins/core/skills/review-change/SKILL.md`, change the rounds bullet's clause to D-5
  2's block. `plugins/openspec/skills/ship-change/SKILL.md` and `docs/openspec-flow.md` state no
  literal of the line (D-6, "The line's form, attempt 3") and keep their phase-1 text. Check: the
  `review-round.test.mjs` command of 3.1 passes (the text test included), and
  `` grep -rn "Owner's words for round" plugins docs | grep -v ': "`' `` prints nothing.
- [x] 3.4 Run every test file that reads a text or a line this phase edits, by name: the command of
  task 1.8. Check: it exits 0 (rounds 1 and 2 unchanged, AC-4); its `suite:` line and `uptime` go in
  the phase's report.
- [x] 3.5 Conductor: re-run RR1, RR2 and RR5 of D-8 on the head of 3.3, on a scratch project
  `/var/tmp/devkit-ror/fixture.mjs` builds again (its resolution authorization's words now holding one
  pair of backticks, D-8), RR1 again on the `review-change` skill's `agents` path. Copy and scrub
  their files into `openspec/changes/review-owner-rounds/proof/` over the old ones and replace their
  `rr1`, `rr2` and `rr5` lines in `proof/checks.txt` (RR3 and RR4 stay). Check:
  `grep -c "^rr[1-5] .*: pass$" openspec/changes/review-owner-rounds/proof/checks.txt` prints 5;
  `` grep -c "^Owner's words for round [0-9]*: \"\`" `` prints 1 for `proof/rr1-review.md` and
  `proof/rr5-resolution.md` and 2 for `proof/rr2-review.md`;
  `` grep -rn "Owner's words for round" openspec/changes/review-owner-rounds/proof | grep -v ': "`' ``
  prints nothing; `grep -rlE "/var/tmp/devkit-ror|$HOME" openspec/changes/review-owner-rounds/proof/`
  prints nothing; `python3 scripts/check.py` exits 0.
- [x] 3.6 Validate the change and the packs again: the four commands of task 2.3. Check: each exits 0.
- [x] 3.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-4, AC-5).

## Workflow follow-up

- `devkit-core:pr-verifier` writes `evidence.md` (the selective gate part as its own `pass` row, with
  its `selected` lines and its `suite:` line), then the `review-change` bench reviews the change.
- Report to the owner the map gap of `design.md`, Risks: `scripts/test-map.json` links
  `plugins/core/skills/review-change/SKILL.md` and `plugins/openspec/skills/ship-change/SKILL.md`
  to fewer test files than read them.
- The release, the changelog entry and the CI pins are written by the delivery at the merge
  (`release.md`).
