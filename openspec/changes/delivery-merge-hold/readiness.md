<!-- devkit-stage readiness result=failed attempt=5 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Readiness review: delivery-merge-hold

Reviewed at `bfd5c0a` (branch head, the merge of `main` at `ea482c0`), as the caller asked: the plan is judged
against that tree. Artifacts read: `requirements.md`, `proposal.md`, `design.md`, `tasks.md`, `decisions.md`,
the three spec deltas, `docs/adr/0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md`, `openspec/config.yaml`
(`rules.*` re-read: unchanged since attempt 4), the previous round (attempt 4: M-1 and M-2), and the code the
plan cites in `deliver-check.mjs`, `conduct-check.mjs`, `change-loop.mjs`, `roadmap-loop.mjs`, `run-file.mjs`,
`guard.mjs` and the test files D-11 names. No fetch was made. One fact outside that tree matters and is
reported in M-1: the local `origin/main` ref (updated 07:54 today) is no longer `ea482c0`; it is `298c3f3`.
`openspec validate delivery-merge-hold --strict`: valid. `python3 scripts/check.py`: passes.
`python3 scripts/gen-catalog.py --check`: passes. Gates run on `bfd5c0a` with a short `TMPDIR` (see section 6):
1.5 exit 0 (11 tests, 0 fail); 3.6 green (506 pass; the 15 failures of the first run were all
`roadmap-loop compozy` tests and came from my own `TMPDIR`, a path too long for the daemon's Unix socket; the
same tests, with `change-loop compozy`, pass 90 of 90 under `TMPDIR=/var/tmp/rdy5`); 2.6 was not finished
(section 6). `4.7` reads proof files and `5.6` is the whole suite (the caller's).

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

Both Mandatory findings of attempt 4 are closed on `bfd5c0a` (section 4). At that tree the plan has no other
Mandatory finding. One new one comes from the base moving again under the plan: `origin/main` now holds
`suite-speed` (PR 98, merged at 07:17, two minutes before the plan's last edit), which replaces the repository's
test command and splits the test files this plan edits. The plan's gates would pass while testing nothing, and
its tests have no stated home on the merged base. The approach does not change; the branch has to merge `main`
and the plan has to be re-derived on it, before any code is written.

## 2. Scope validation
Classification: correct.

Problem, goal, non-goals and AC-1 to AC-8 match `requirements.md`. The non-goals now say that a project with an
accepted `devkit.delivery.train` and the CompozyOS driver keep no queue and cite ADR 0025 decision 9. The
proposal adds no behaviour the requirements do not justify.

## 3. Proposal review
- Length: under two pages. The wait mechanics, the conflict rule and the wake rules are one sentence each with
  a D-n pointer.
- Facts about the repository are true at `bfd5c0a`: "planned against `main` at `ea482c0` (merged here at
  `bfd5c0a`), ADRs 0021 to 0024, flow version 2, devkit-openspec 0.36.0" (checked: `docs/adr/` lists 0001 to
  0025 with 0025 this change's; `plugin.json` 0.36.0; `marketplace.json` 0.40.0; `CHANGELOG.md` heads at 0.40.0).
  They are false against the moved `origin/main` (M-1).
- Impact, dependencies and open decisions are explicit. "Open decisions inherited: none" holds: ADR 0025 decision
  9 settles the train and the CompozyOS driver.

## 4. Design review
Closed since attempt 4, each re-checked in the files and the code:

| Old finding | Now | Result |
|---|---|---|
| M-1 base moved to `ea482c0` | branch merged `main` at `bfd5c0a`; ADR renamed to `0025-...`; Context re-read on the merged tree; D-10/D-11 name 0.36.0/0.40.0, the pin test at `change-loop.test.mjs:2615` (`/v0\.36\.0/`), the flow page lines 731-735 and 745; tasks 5.1, 5.2, 5.4 say "the next free number on origin/main at the last merge before review" | closed at `bfd5c0a`; re-opened by the newer `origin/main` as a different kind of change (M-1 below) |
| M-2 train project alternates `join-queue` and `leave-queue` | D-4 makes `state.turn` null when `trainSuite !== null` before any listing (T0); D-4 `queueable` for `nextAction`; D-8 `keepsQueue`; ADR 0025 decision 9; requirement "A project with a delivery train keeps no merge queue" with 5 scenarios; requirement "A run of a project with a delivery train or on the CompozyOS driver records no merge queue" with 4; tests in tasks 2.1, 3.1; gate 2.6 runs every `delivery-train` test | closed |
| L-1 CompozyOS driver | D-4 and D-8: `driver: compozy` reads no queue, `compozy-start` pushes no marker; scenario "A change on the CompozyOS driver"; tests in 2.1 and 3.1 | closed |
| L-2 scenario for `trunk`, `two-prs` and train reading no queue | scenario "Projects that never read a queue" in `merge-turn` | closed |

Claims about the code re-derived at `bfd5c0a` (read in the files, not taken from the plan): `deliveryConfig`
(`deliver-check.mjs:152`) returns `train` and throws `ShipConfigError` on a refused key, `MODEL_SHIP` at 142;
`collectState` (1884) reads `train: trainSuite` at 1889 and `trainOn` at 1892; its three CLI calls at 2664,
2671, 2675; `nextStep` rows at 1677, 1681, 1784, 1785, 1788, 1849, 1850, 1853, 1854, 1857, 1858 say what D-5
says; the imports at lines 7 to 19 are `node:` modules, `./merge-setup.mjs`, `./guard.mjs`;
`readDevkitSettings` (`change-loop.mjs:120`) sets `settings.train` when the key is set or refused, so
`settings.train === undefined` is "no train key" as D-4 uses it; `nextAction` reads `settings` at 1437 and calls
`collectState` and `deliveryRow` inside `inDelivery`; `ROWS` 1018, `decide` 1156, `blockedEnd` 1323,
`buildPart` 1333, `NAME` 1947, `PUSH_RACE` 2087, `claimOnOrigin` 2252, `waitLoop` 2402, `OUTLIVES` 828;
`conduct-check.mjs` `MAIN` 62, `GITHUB` 66 (holds `on-train`, `wait-train`), `actorOf` 71, `deliver` 321,
`conflictedPaths` 355, `adrClash` 378, `releaseConflict` 406, `trainRejoin` 443, `deliveryRow` 465 (returns
the plain row for `disable-auto-merge` and `rejoin-train`, then `adrClash ?? releaseConflict ?? trainRejoin`);
`roadmap-loop.mjs` `decideRoadmap` 318, `boardOf` 552, `collectRoadmap` 746, `readyText` 864, `decide` 1386,
`compozyStartCmd` 1633, `statusJson` 1523; `run-file.mjs` `emptyRun` 14, booleans at 41; `guard.mjs`
`trainSetting` 194, `changeFlow` 524, `isChangeId` 1442. Every test line D-11 cites (`change-loop.test.mjs`
86, 125, 537, 563, 568, 2580, 2615; `deliver-check.test.mjs` 3211, 3806, 3816, 4778; `roadmap-loop.test.mjs`
581, 588, 949, 2706, 2644, 2670, 4213, 4239, 4832, 4846, 4852; `guard.test.mjs` 1223, 1239; the `ship-change`
grep list of task 2.5) is at that line at `bfd5c0a`.

New finding, on the base that moved:

- **M-1. `origin/main` is at `298c3f3` and holds `suite-speed` (PR 98, ADR 0026); the plan's gates, test files
  and numbers are written for a tree that no longer is the base.** `git log bfd5c0a..origin/main`: `cf34ff2`
  (suite-speed, 07:17:32) and four archive commits (`44ca321`, `5775191`, `32d63f6`, `298c3f3`). The plan's
  files were last written at 07:19. What that changes, each read on `origin/main`:
  - **Every gate is vacuous there.** The gates 1.5, 2.6, 3.6, the test part of 5.4 and 5.6 run
    `node --test ... plugins/openspec/hooks/guard.test.mjs`. On `origin/main` `guard.test.mjs` imports no other
    test file (its imports are `node:` modules, `./test-tmp.mjs`, `./guard.mjs`, `./test-fixtures.mjs`;
    ADR 0026 decision 3 forbids a test file importing another and `scripts/test-suite.mjs` refuses it).
    `node --test --test-name-pattern="^merge-turn" ...` over a file that holds no matching test exits 0 (probed
    with a one-test file: exit 0). So 1.5, 2.6 and 3.6 would be green with no new test run, and 5.6 would run
    only the guard's own tests, not "the whole suite once". `CLAUDE.md` of `origin/main` names the command
    `node scripts/test-suite.mjs` (accepts `--test-name-pattern=` and file arguments); the plan's own phrases
    "13 to 21 minutes" and "`guard.test.mjs`, which imports every test file" (tasks.md lines 382 and 22; `proposal.md` line 14 states the old time too)
    are false there.
  - **Test homes moved, and the plan names the old ones.** D-11, D-12 and tasks 1.2, 2.1, 3.1 name
    `deliver-check.test.mjs`, `change-loop.test.mjs`, `roadmap-loop.test.mjs` and "the existing `fakeGh` of each
    file". On `origin/main`: "format: ship-change names every next.step" and "AC-8 release-ready" are in
    `deliver-check-cli.test.mjs`; "followups AC-3 run file" in `roadmap-loop-followups.test.mjs`; `BLOCK_KEYS`
    in `roadmap-loop-upfront.test.mjs`; "change-loop docs: the design records the answers" (the pin test, task
    5.4) in `change-loop-compozy.test.mjs`; "remote AC-10 next" in `change-loop-remote.test.mjs`; the
    `delivery-train` tests are split over `delivery-train.test.mjs` (137 tests) and
    `delivery-train-after.test.mjs` (37); helpers moved to `test-fixtures.mjs` and `*-fixtures.mjs`;
    `change-loop.test.mjs`, `deliver-check.test.mjs` and `roadmap-loop.test.mjs` changed by 5,215, 3,424 and
    3,988 lines (`git diff --stat bfd5c0a origin/main`). `rules.design` ("a sentence saying a test pins a behaviour names that test file") and
    `rules.tasks` (each test file that asserts the old text) then name wrong files. The tasks say a later
    merge "only moves line numbers" and the implementer "finds the same test by name"; for these files it is a
    split, and the three tests this change edits (D-11 "changed" rows) and the new `merge-turn` tests sit in
    files whose content git cannot merge by drift: implementing first and merging after is the 1 to 2 hour
    re-merge the owner's notes warn about.
  - **Numbers.** `origin/main` holds devkit-openspec 0.38.0, marketplace 0.42.0, the flow-page pin `v0.38.0`
    (lines 731, 732, 745), ADR 0026 and a 0026 entry at the end of the `ADRs:` line (ADR 0025 stays free).
    Tasks 5.1, 5.2 and 5.4 are written to read these at the last merge, which handles the numbers; D-10's "after
    the 0024 entry, its last today" and the example values 0.37.0, 0.41.0, `/v0\.36\.0/` become wrong.
  Smallest correction: merge `origin/main` into the branch now (no product code is written yet, so the cost is
  the three test-file conflicts the plan has not made yet), then re-derive on that tree: the gate commands of 1.5,
  2.6, 3.6, 5.4 and 5.6 (`node scripts/test-suite.mjs` with the filter and files of each phase; check that
  repeated `--test-name-pattern=` is accepted, else one alternation), the file each new test goes in and the
  fixtures module it imports (D-11, D-12, tasks 1.2, 2.1, 3.1, 5.4), the "13 to 21 minutes" and `guard.test.mjs`
  sentences, the D-10 and task 5.2 `ADRs:` wording, the version examples and the pin test; then ask for a new
  round. This is the same kind of finding as M-1 of attempt 4 (the base moved after the plan was written) and
  the cure is the same; it will recur only if `main` moves again before implementation starts.

## 5. Specs review
Normative language and `#### Scenario:` form are correct; validation passes. Decision-table check: every
outcome row of D-5 (T0 to T9, the three conduct rules, the `turn` exits), D-8 (marker, end, wake, no wake,
board, the no-queue projects) and D-7 (the unreadable form, the plan-part leave and its blocked-end
exceptions) has a scenario, including the train and CompozyOS rows added since attempt 4. No requirement lives
only in `design.md`. Specs align with the proposal's capability list (new `merge-turn`; four ADDED in
`change-coordination`; seven in `roadmap-coordination`; `roadmap-coordination` carries the requirement for
the train or CompozyOS run). Nothing in the specs depends on the test layout.

## 6. Tasks review
- One `## N.` group per phase (1, 2, 3, 4, 5), each ending with a gate task with one backticked command; every
  AC id is in the table; tests first with a saved red run (with the stated exception for the exclusion guards);
  paths are real directories; 5.1 and 5.4 say "the next free number on origin/main at the last merge before
  review"; no check line carries a count that was not run (the anchors of 2.5, 5.2, 5.3 were checked above).
- Gates run on `bfd5c0a` with `TMPDIR` short: 1.5 green; 3.6 green once the 15 `roadmap-loop compozy` tests
  were run with a short `TMPDIR`; `python3 scripts/check.py` and `gen-catalog.py --check` pass. Gate 2.6 selects
  about a quarter of the suite; started twice (once per `TMPDIR`), it produced output for 25 minutes and was
  still working through the `deliver-check` tests (new `devkit-deliver-*` folders kept appearing) when I stopped
  it at 43 minutes with the machine at load average 12 (other sessions run the suite on it). I did not
  judge it red or green; nothing in it failed. Run it once on the merged tree, in the background, after M-1.
- Low, Fix during implementation: the preface of `tasks.md` says to use `TMPDIR=/var/tmp` where the temporary
  folder lacks inodes; the `compozy` tests of gates 2.6 and 3.6 listen on a Unix socket under `TMPDIR`
  (`compozy-driver.test.mjs:49`, `listen EINVAL` on a path of 130 characters). One clause "keep the path under
  about 80 characters" would stop a gate failing for that cause.

## 7. Omission detection
- Validation, parsers (the listing parser, the record's corrupt forms, an unclosed or empty input), error
  handling, retries (five tries, then exit 3), idempotency (a second `--join`, an absent `--leave`),
  permissions (the refs are written by pushes the user already can do), rollback (revert the release; refs are
  inert), observability (the board, `status`), compatibility with `trunk`, `two-prs`, the train and the
  CompozyOS driver, legacy records (stale record), migration (no flow version; no stage change): defined.
- Test strategy: automated tests per layer plus the AC-8 real run; both are defined. The test layout is the
  one thing the merged base changes (M-1).

## 8. Execution risks (top 5 failures)
1. Cause: gates written for `guard.test.mjs` run after the merge of `main` (M-1). Impact: 1.5, 2.6 and 3.6 exit
   0 with no new test selected; the first real failure shows at the whole-suite gate 5.6 after its 10 to 20
   minutes, or never, if 5.6 is run as written. Prevention: re-derive the gates on the merged tree.
2. Cause: new tests added to the three big test files before the merge of `main` that splits them. Impact: a
   conflict in files of 3,000 to 5,000 changed lines, solved by hand with no plan guidance, then evidence and
   review again. Prevention: merge now, write tests in the files `origin/main` has.
3. Cause: GitHub refuses refs under `refs/devkit/` (task 1.1 probes first, fallback named). No new finding.
4. Cause: a waiting change polls `ls-remote` and `gh` every 60 s (ADR 0025 decision 7 accepts it with a review
   trigger on the rate limit). No new finding.
5. Cause: a recorded wait whose process died keeps the coordinator from waking the new holder (named in the
   Risks table; the periodic check prunes it). No new finding.

## 9. Mandatory fixes before implementation
- [ ] High (M-1) — `tasks.md` lines 22, 87, 215, 284, 376 and 381 (every gate), 382, and tasks 1.2, 2.1, 3.1, 5.4 (the files
  tests go in, the pin test's file), `design.md` D-10 (the `ADRs:` wording and the version example), D-11 (every
  row's file and line), D-12, `proposal.md` lines 7-8 — `origin/main` is at `298c3f3` with ADR 0026 and the
  suite split into per-area files run by `node scripts/test-suite.mjs`; the plan's gates select nothing there
  and its test files hold other tests. Smallest correction: merge `origin/main` into the branch, then re-derive
  the gate commands, the test homes and fixtures, D-11, the numbers and the "planned against" lines on it, and
  ask for a new round.

## 10. Optional improvements (within scope)
- [ ] L-1 Fix during implementation — `tasks.md` preface: a clause that `TMPDIR` stays short (about 80
  characters), because the CompozyOS tests open a Unix socket in it (section 6).

## 11. Explicitly out of scope
- [ ] Per-pack or per-file holding, `stale-only-on-own-files`, GitHub's merge queue, a timer or command to
  reorder (the proposal's non-goals).
- [ ] The turn in `conduct-check`'s own reads and the CompozyOS `tech-lead` (proposal and D-4).
- [ ] Making the queue and the train work in one project (ADR 0025 decision 9 says a combined mode would need
  its own record).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes (AC-1 to AC-8, each with tests and the AC-8 proof files).
3. Are error behaviors defined? Yes: exit 3 forms, unreadable queue, refused marker, refused removal.
4. Are edge cases covered? Yes, including the train, `trunk`, `two-prs` and the CompozyOS driver.
5. Are dependencies clear? At `bfd5c0a` yes (ADR 0020, 0021, 0022, 0024). Not against `origin/main`: ADR 0026
   and the new test command are not known to the plan (M-1).
6. Are contracts defined? Yes for refs, record, `turn` output, rows, replies and messages.
7. Can two developers interpret this differently? Only at M-1: which command a gate runs and which file a new
   test goes in on the merged base.
8. Are any decisions implicit instead of written? The gate command and test files after the merge of `main`.
9. Do the tasks fully deliver the intended outcome? Yes at `bfd5c0a`; on `origin/main` the gates would pass
   without testing (M-1).
10. What will be discovered too late? Vacuous gates and the test-file conflicts at the merge of `main` before
    review.

## 13. Final conclusion
- Can we start? No, not yet: one merge and one re-derivation away.
- What must be fixed? M-1: merge `origin/main` (`298c3f3` in the local ref), then re-derive the gate commands,
  test homes, numbers and the "planned against" lines on that tree. Nothing else is open at `bfd5c0a`; both
  Mandatory findings of attempt 4 are closed.
- Main risk if ignored? Gates that exit 0 while selecting no test, and a hand-resolved merge of three split
  test files after the code is written.
