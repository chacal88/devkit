<!-- devkit-stage proposal result=passed attempt=1 commit=acacc172e3fd1e3e5b4c325674d75f11511d8af0 -->
# Proposal

Change: `test-map-hub-links` · Date: 2026-11-27 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `02713b3a`; the
branch was opened on it (`acacc172`) and has merged nothing yet. No other change is under way
(`openspec/changes/` holds only this one).

## Why

A pull request whose only own file is `openspec/roadmap.md` selects 31 test files, 23 of them slow,
and its `check` job ran 10 min 17 s (run 46024905007 of pull request 160, 10 min 19 s as a whole). The map's seed linked a
document to every test that reaches `plugins/openspec/hooks/test-fixtures.mjs`, which names three
documents, and rule S4 (a `files` key) wins over S5 and S6. The two hub modules,
`plugins/openspec/hooks/change-loop.mjs` and `plugins/openspec/hooks/deliver-check.mjs`, are linked
to 33 test files each in the same way. The owner wants a Markdown-only pull request to pass `check`
in about 2 minutes.

## What Changes

- **Document keys hold only fast readers.** In `scripts/test-map.json`, each `files` key that is a
  document (a non-code path outside `plugins/`, `design.md` D-1) and holds a slow test today keeps
  only the fast test files that are linked to it now and that read it from the real checkout,
  proven by a traced run (D-2, D-3). 56 keys are in scope:
  - 19 keep a shorter list (the eight the owner named among them);
  - 35 lose their key, because no linked fast test reads them: a Markdown file outside `plugins/`
    (20 keys) or a path under `openspec/` (15 keys) then selects no test file (S6, S5);
  - 2 (`.gitignore`, `scripts/released-flows.json`) would select the whole suite without a key
    (S7), so they are linked to the fast tests the trace shows reading them.
  No slow test is linked to a document afterwards.
- **Hub keys drop the links of tests that do not run the hub.** For `change-loop.mjs` and
  `deliver-check.mjs`, a test file that imports, reads or spawns the hub itself keeps its link. Any
  other test file, such as one whose only path to the hub is `test-fixtures.mjs` or `guard.mjs`,
  keeps it only when a V8 coverage run shows that it executes some of the hub's code beyond what
  loading the module runs (D-4). Measured on the base: `change-loop.mjs` goes from 33 test files
  (23 slow) to 24 (16 slow), and `deliver-check.mjs` from 33 (23 slow) to 29 (22 slow).
- **A test pins the result** in `plugins/openspec/hooks/test-suite.test.mjs`: no document key of
  the repository's map lists a slow test, the readers kept for the eight named documents are still
  linked, and the hub links dropped stay dropped (D-5).
- **`CONTRIBUTING.md`** gains one sentence on the linking rule of documents and hubs (D-6), so
  that later hand edits keep it.
- **No CI change.** The fixed part of the `check` job took about 13 s in run 46024905007 (D-7), so
  the 2-minute target needs no cut to it. `.github/workflows/ci.yml` is not edited.
- **No behaviour changes** in `scripts/test-suite.mjs`, rules S1 to S7, the map's check (M1 to M7),
  the whole run with no flag, the train or `push` to `main`.

Non-goals: everything under "Out of scope" in `requirements.md`. Also out: the 27 non-code keys
under `plugins/` that hold a slow test (plugin Markdown, manifests, schemas, templates, fixtures,
`plugins/panel/`). S6 already treats plugin Markdown as code, and the shipped hooks read those
files at run time (D-1 lists them). Also out: every other code key, and adding a reader that is not
linked today to a key that keeps a list (D-3).

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `doc-selects-no-slow`: for each of the eight documents the owner named, `selectTests` for a branch whose only own file is that document lists no file marked slow in `scripts/test-map.json` `slow`; the selection output (`selected <file> by <path>`) is recorded in `evidence.md` per document, with the before count (31, 23 of them slow, for `openspec/roadmap.md`) and the after count.
- AC-2 `doc-readers-stay-fast`: every fast test file that reads one of those documents from the real checkout stays linked to it, so a pull request that breaks a text a fast test pins still fails its own `check` (the plan lists each reader kept, and a test or a run proves one: edit a pinned line of a document in a scratch checkout and see the selected fast reader fail).
- AC-3 `hub-narrowed`: for `plugins/openspec/hooks/change-loop.mjs` and for `plugins/openspec/hooks/deliver-check.mjs` alone, the selection lists no test file whose only link to the hub is an import of `plugins/openspec/hooks/test-fixtures.mjs` or `plugins/openspec/hooks/guard.mjs`; the counts before (33 each) and after, and the files dropped, are recorded in `evidence.md`.
- AC-4 `map-still-checked`: `mapProblems` on the repository's map is empty (M1 to M7), every test file stays linked by at least one key (M6), no key has an empty list, and test T-16 of `plugins/openspec/hooks/test-suite.test.mjs` passes.
- AC-5 `whole-suite-unchanged`: `node scripts/test-suite.mjs` with no flag, and the same run on a train branch, run the same test files and report the same test names as before the change (ADR 0026 decision 5); the slow tests that read a document are still in that whole run.
- AC-6 `fixed-part-measured`: `evidence.md` holds the time of each non-suite step of the `check` job, read from the step timestamps of a real run of this repository's `ci` workflow, and the time of `node scripts/test-suite.mjs --own-files` for a branch whose own files are only Markdown; when their sum is above about 2 minutes, the change reduces the fixed part and the evidence shows the new step times from a run of the change's own pull request.

Exit criteria: every phase gate of `tasks.md` green; `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`,
`claude plugin validate .` and `openspec validate test-map-hub-links --strict` pass. The
`check` job of this change's pull request runs `--own-files` and is green, and the first
Markdown-only pull request after the merge (this change's archive pull request) shows the job's
time. Both are workflow follow-ups, because only CI can show them.

## Capabilities

None. The change edits the data of this repository's own test map, one test and one paragraph of
`CONTRIBUTING.md`. No behaviour of a shipped hook, skill, agent or schema changes, and no
capability spec under `openspec/specs/` describes the repository's test selection. So
`.openspec.yaml` sets `skip_specs: true`, as `selective-tests-by-map-2` and `suite-speed` did.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- Repository data: `scripts/test-map.json` (56 document keys narrowed, removed or relinked; the
  two hub keys narrowed).
- Repository tests: `plugins/openspec/hooks/test-suite.test.mjs` (one new test beside T-16; no
  existing test changes).
- Docs: `CONTRIBUTING.md` (one sentence in the paragraph of `--own-files`, line 44).
- Packs: none. No file under `plugins/` other than the test file changes, so `release.md` reads
  `packs: []`.
- CI: none. `.github/workflows/ci.yml` stays as it is.

**Dependencies.** `selective-tests-by-map-2` (archived on 2026-11-27, PR 157 and PR 159) delivered
the map, the selection and ADR 0036. Its retro proposed this change (learning 5). Nothing is under
way.

**Decisions cited.** ADR 0036 (decisions 1, 2, 4, 5 and 6; its Consequences on the train as the
backstop), ADR 0026 (decision 5), ADR 0025 (decision 1, the own files; its rejected dependency
closure), ADR 0034 (the release note), and `decisions.md` (no record needed).

**Open decisions inherited.** None. No point of `docs/coordination-design.md` "Open points" is
touched.

**Flagged for the owner at plan approval.**

- The list of document keys (`design.md` D-3, 56 rows) and the 27 keys under `plugins/` left as
  they are (D-1). The owner approves both lists with the plan (requirements, assumption 2).
- Slow tests that read a document leave its key and run only on the train and on `push` to
  `main`, as answer 1 says. Among them, `CONTRIBUTING.md` loses `deliver-check-cli`,
  `delivery-train-after`, `release-tags` and `release-note`, and `scripts/released-flows.json`
  loses `version-pin` and `change-loop-compozy`.
- A key whose list would be empty is removed, not emptied: an empty list selects the whole suite
  (S7). This applies to 35 keys (D-3).
- The hub narrowing is real but small. The request line asked that an edit of a hub such as
  `deliver-check.mjs` select few tests and almost no slow ones. Under answer 2, `deliver-check.mjs`
  still selects 29 files (22 slow) and `change-loop.mjs` 24 (16 slow), because each slow test left
  runs the hub's code (26 to 375 of its functions, D-4). AC-3 holds as written. A smaller hub
  selection needs a split of those slow test files or a per-function map, which the requirements
  put out of scope; that would be a follow-up change.
- Answer 2 drops the tests that reach a hub only through `test-fixtures.mjs` or `guard.mjs` and
  run none of its code. The plan applies the same measure to the other tests that do not import,
  read or spawn the hub. That adds five drops: `conduct-check`, `flow-check` and `release-note`
  from `change-loop.mjs`, and `compozy-driver` and `devkit-kit` from `deliver-check.mjs`. If the
  owner wants only the two modules the answer names, the lists stay at 27 and 31 (D-4,
  "Alternatives rejected").
- No ADR is needed (`decisions.md`): the rules S1 to S7, the check and ADR 0036 decision 2 stay as
  they are, and the change is one revertible commit of data, one test and one sentence.
