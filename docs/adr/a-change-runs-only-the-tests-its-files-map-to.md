# ADR [a-change-runs-only-the-tests-its-files-map-to]: A change runs only the tests its own files map to, and the whole suite runs once, on the train

- Status: accepted
- Accepted by: the owner, on 2026-11-26, in the approval of the plan of change selective-tests-by-map-2 (openspec/changes/selective-tests-by-map-2/approval.md)
- Date: 2026-11-26
- Change: selective-tests-by-map-2
- Number: none; this record follows the release-note rule (ADR 0034
  (0034-release-at-merge.md), decision 3), so the delivery of its change gives it the next free number
  on the base and rewrites its citations outside `openspec/changes/`
- Relies on: ADR 0025 (0025-a-base-merge-stales-only-on-the-changes-own-files.md), decision 1, the
  change's own files; ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md), decision 7, the
  bisection of a red train
- Amends: ADR 0025 (0025-a-base-merge-stales-only-on-the-changes-own-files.md), decision 6: the
  backstop for a base change that breaks the change without touching its own files is no longer the
  `check` CI of the change's own pull request, which becomes selective, but the whole-suite `check`
  of the train's pull request and of `push` to `main`. ADR 0022
  (0022-reviewed-changes-leave-on-a-delivery-train.md), decision 5: "the tests of the area it touches"
  becomes the test files the map selects for the change's own files. ADR 0026
  (0026-the-devkit-test-suite-runs-by-file-in-parallel.md), decision 1: the one test command gains a
  selection mode; with no selection argument it runs what decision 1 says, unchanged

## Context

ADR 0026 made `node scripts/test-suite.mjs` the repository's one test command: every `*.test.mjs` of
its four folders, by file, in parallel, about 10 minutes on an idle 8-core machine. ADR 0022 decision
5 already says a change's `evidence.md` proves the tests of the area it touches, not the whole suite,
and that the whole suite runs once, at the train's head. In practice the gates, the proof and the
step after each merge of the base still name the whole command, because nothing says which test
files a change's area is. ADR 0025 decision 6 keeps the `check` CI of every change's pull request on
the whole suite as the backstop for a base change that breaks a change without touching its files,
so each change pays the whole suite on every push of its pull request as well as at the train.

The owner asked (requirements of `selective-tests-by-map-2`, question 1) that the gates, the proof and
each merge of the base run only the tests linked to the files the change touched, that the slow
tests run only when the change touches what they cover, and that the whole suite run once, on the
train. The owner chose a map written by hand over a measured time to know which tests are slow
(question 3), and a whole-suite run for code no map entry covers (question 2). ADR 0025's own
alternatives rejected an import graph per language as the way to find what a change depends on.

## Decision

1. A file committed in the repository maps each script or source file to the test files that cover
   it, and marks each slow test file by hand. Its path, its format and whether it is one file or one
   per plugin folder are the plan's. A check fails, naming the entry, when the map names a file that
   does not exist; whether it also fails on a script or a test the map lacks is the plan's.
2. The selection reads the change's own files as ADR 0025 decision 1 defines them (release files and
   `openspec/changes/<id>/` excluded) and selects:
   - for a mapped file, the test files the map links to it, slow or fast;
   - for a shared helper (such as `plugins/openspec/hooks/test-fixtures.mjs`), every fast test file
     that imports it, and a slow test file only when the map links it to that helper directly;
   - for a code file no map entry covers, the whole suite;
   - for documentation and files under `openspec/` only, no test file.
   Its output lists each selected file and the own file that selected it.
3. Selection is a mode of the one command of ADR 0026 decision 1, not a second command; the mode's
   spelling is the plan's. With no selection argument the command runs the same files and reports the
   same test names as before (ADR 0026 decision 5).
4. Where a gate, the real-run proof or the step after a merge of the base runs tests, it runs the
   selective mode. The selective command is a gate part of its own, not equal to a part of the
   train's whole-suite command, so it needs its own passing row in `evidence.md`; a selection of no
   test file is recorded as such, not as a pass of the whole suite. `python3 scripts/check.py`,
   `python3 scripts/gen-catalog.py --check` and `node plugins/compozy/kit/scripts/gen-agents.mjs
   --check` stay whole.
5. The `check` job of CI runs the selective mode on a change's own pull request, and the whole suite
   on a train's pull request and on `push` to `main`. How the job tells a train's pull request from a
   change's is the plan's. The job's name and its place among the required checks of the `devkit`
   ruleset are unchanged.
6. The train's command (`devkit.delivery.train` in `openspec/config.yaml`) and its bisection (ADR 0022
   decision 7) are unchanged: a train whose head is red on the whole suite still finds its culprit
   by bisection.

## Consequences

- Positive: a change's gates, proof, base merges and pull request CI cost the tests of its own files
  instead of the whole suite; a docs-only change runs no test; the slow files run only for the
  changes that touch what they cover. ADR 0022 decision 5's "tests of the area it touches" becomes a
  rule a checker can apply.
- Negative: a green `check` on a change's own pull request no longer proves the whole suite on the
  merged ref, so a base change that breaks the change, or a test the map does not link to a file it
  covers, is found only at the train (Accepted by the owner, question 1 of the requirements:
  the train's whole-suite `check` is the backstop and decision 6 isolates the culprit; a red train
  costs one whole-suite run per bisection step).
- Negative: the map is kept by hand and can be wrong (Mitigated: a code file it does not cover runs
  the whole suite, the check of decision 1 refuses entries naming missing files, and the train runs
  everything).
- Negative: open changes' gate rows that name the whole command keep running it until their next plan
  or evidence (Accepted: they stay correct, only slower).
- Neutral: the selective and the whole runs share one script, so the four folders, the per-file
  `TMPDIR` and the import check of ADR 0026 stay in one place.

### Review trigger

A train goes red on a test the map should have selected for one of its changes; the map's check is
bypassed or turned off; a change's pull request merges outside a train with only the selective run;
the whole run under no selection argument stops matching ADR 0026 decision 5.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the change's pull request `check` on the whole suite (ADR 0025 decision 6 as it is) | Strongest proof per pull request | The whole suite on every push of every change, the cost the owner refused in question 1 | low |
| Derive the selection from an import graph | No map to keep | Needs a graph per language; ADR 0025 rejected the dependency closure for the same reason; the slow mark still needs a hand list | medium |
| Mark slow tests by a measured time | No hand marks | Times move with the machine's load; the owner chose a marked list (question 3); timing records are out of scope | low |
| A second command for the selective run | Leaves the whole command untouched | Two commands the docs, CI and gate rows must quote; ADR 0026 decision 1 keeps one | low |
| Skip `check` with GitHub `paths` filters | Built into Actions | A required check that never reports blocks the pull request; it filters by path globs, not by the tests a file maps to | low |
| Run nothing for unmapped code | Fastest | A map gap would hide every test of that code until the train (refused in question 2) | low |
