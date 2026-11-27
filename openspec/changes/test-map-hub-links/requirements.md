<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> test-map-hub-links: estreitar o mapa de testes para que editar um documento (roadmap.md, config.yaml, CHANGELOG.md, CONTRIBUTING.md, README.md, docs/openspec-flow.md, docs/catalog.md, marketplace.json) ou um módulo de hub como deliver-check.mjs selecione poucos testes e quase nenhum lento; um PR que só mexe em Markdown deve passar o CI em cerca de 2 minutos

## Classification

domain=process type=feature flags=[contract] (strict-assumed; the owner confirms it with the assumptions below). The map `scripts/test-map.json` is a contract the gates, the proof and the pull request `check` rely on: a link dropped by mistake hides a red test until the train.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The problem is measured, not guessed: a pull request whose own files are only `openspec/roadmap.md` selects 31 test files, 23 of them marked slow in `scripts/test-map.json` `slow`, and its `check` job ran 10 min 17 s (run 46024905007 of pull request 160, 10 min 19 s as a whole); the archive pull request 159 ran 12 min 16 s (run 45993291609). The cause is rule S4 of `scripts/test-suite.mjs` (a `files` key of the map wins over S5, a path under `openspec/`, and S6, a Markdown file outside `plugins/`): each document key lists the tests that name the document on a code line of the test or of a module it imports (the seed rule D-4 rule 4 of `openspec/changes/archive/2026-11-27-selective-tests-by-map-2/design.md`), and `plugins/openspec/hooks/test-fixtures.mjs` names `openspec/roadmap.md`, `openspec/config.yaml` and `CONTRIBUTING.md`, so every test that reaches it is linked.
- A "document" is a `files` key of `scripts/test-map.json` that is not code: the eight the owner named (`openspec/roadmap.md`, `openspec/config.yaml`, `CHANGELOG.md`, `CONTRIBUTING.md`, `README.md`, `docs/openspec-flow.md`, `docs/catalog.md`, `.claude-plugin/marketplace.json`) and, by the same rule, any other non-code key whose list holds a slow test (for example `.github/workflows/devkit-reviews.yml`, the ADRs, `openspec/specs/*`, `openspec/trains/*`, `openspec/schemas/*`). The plan lists each such key it narrows, and the owner approves that list with the plan.
- The owner's answer 1: on a pull request, a document key selects only the fast test files that read that document from the real checkout (not from a temp project a test builds); no slow test file is linked to a document. A slow test that reads a document still runs on the train and on `push` to `main`, which run the whole suite; a pinned text of a document broken by a pull request and checked only by a slow test is found at the train, as ADR 0036 already accepts (`docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md:77-84`).
- The owner's answer 2: the hub modules are `plugins/openspec/hooks/change-loop.mjs` and `plugins/openspec/hooks/deliver-check.mjs` (33 linked test files each today). A hub's list keeps the test files that import, spawn or call it themselves; it drops the test files that reach it only through `plugins/openspec/hooks/test-fixtures.mjs` or `plugins/openspec/hooks/guard.mjs`. An import chain is not proof that a test runs the module, so the plan decides each dropped link by what the test executes. A pull request on a hub still runs the slow tests that cover it (it is code, not a document).
- The owner's answer 3: the 2-minute target is the whole `check` job of a pull request whose own files are only Markdown, not only its suite step. The fixed part of that job (checkout, `python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`, `python3 scripts/check.py`, `npm i -g @fission-ai/openspec@2.0.0`, the two `openspec schema validate` steps of `.github/workflows/ci.yml`) has no recorded time; the plan measures it from a real run's step timestamps. When the fixed part plus the selective run exceed about 2 minutes, the change also reduces the fixed part (for example by caching the OpenSpec install).
- `CHANGELOG.md`, `docs/catalog.md` and `.claude-plugin/marketplace.json` are release files: `ownDiffPaths` in `plugins/openspec/hooks/deliver-check.mjs` drops them (`RELEASE_FILE`), so their keys never select anything on a pull request and only matter to the map check (M5, M6) and to the whole suite. The plan narrows or empties their lists in the same pass without changing what a pull request selects; no key is left with an empty list, because an empty list selects the whole suite (S7).
- The change edits the map's data and, when needed, the map's check; it does not change rules S1 to S7 or what ADR 0036 decision 2 says (a mapped file selects the tests the map links to it). Whether a rule must change is not decided here: if the plan needs it, it is an escalation to the owner before the plan is approved, with an amending record.
- The map keeps its upkeep rule (`CONTRIBUTING.md:44`, `CLAUDE.md`): the change edits `scripts/test-map.json` in the same commit as any script or test it adds or moves. The test `plugins/openspec/hooks/test-suite.test.mjs` T-16 (the repository's own map has no problem) stays green, and the plan names the invariant, the layer and the suite of any test it changes.
- The train, a train branch and `push` to `main` keep running the whole suite (ADR 0036 decisions 5 and 6); `node scripts/test-suite.mjs` with no flag is unchanged (ADR 0026 decision 5).

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `doc-selects-no-slow`: for each of the eight documents the owner named, `selectTests` for a branch whose only own file is that document lists no file marked slow in `scripts/test-map.json` `slow`; the selection output (`selected <file> by <path>`) is recorded in `evidence.md` per document, with the before count (31, 23 of them slow, for `openspec/roadmap.md`) and the after count.
- AC-2 `doc-readers-stay-fast`: every fast test file that reads one of those documents from the real checkout stays linked to it, so a pull request that breaks a text a fast test pins still fails its own `check` (the plan lists each reader kept, and a test or a run proves one: edit a pinned line of a document in a scratch checkout and see the selected fast reader fail).
- AC-3 `hub-narrowed`: for `plugins/openspec/hooks/change-loop.mjs` and for `plugins/openspec/hooks/deliver-check.mjs` alone, the selection lists no test file whose only link to the hub is an import of `plugins/openspec/hooks/test-fixtures.mjs` or `plugins/openspec/hooks/guard.mjs`; the counts before (33 each) and after, and the files dropped, are recorded in `evidence.md`.
- AC-4 `map-still-checked`: `mapProblems` on the repository's map is empty (M1 to M7), every test file stays linked by at least one key (M6), no key has an empty list, and test T-16 of `plugins/openspec/hooks/test-suite.test.mjs` passes.
- AC-5 `whole-suite-unchanged`: `node scripts/test-suite.mjs` with no flag, and the same run on a train branch, run the same test files and report the same test names as before the change (ADR 0026 decision 5); the slow tests that read a document are still in that whole run.
- AC-6 `fixed-part-measured`: `evidence.md` holds the time of each non-suite step of the `check` job, read from the step timestamps of a real run of this repository's `ci` workflow, and the time of `node scripts/test-suite.mjs --own-files` for a branch whose own files are only Markdown; when their sum is above about 2 minutes, the change reduces the fixed part and the evidence shows the new step times from a run of the change's own pull request.

## Answered by triage

1. [project rules] What does the project require when `scripts/test-map.json` or the suite's tests change? → the map is edited in the same commit as any script or test added or moved; a bad map is refused before any file runs (M1 to M7); T-16 pins the repository's own map; the selective gate has its own passing row after each base merge (source: `CONTRIBUTING.md:44`, `plugins/openspec/hooks/test-suite.test.mjs:1023-1029`, `openspec/config.yaml:43`).
2. [edges] What runs on a push to `main` and on a train pull request? → the whole suite on both; a pull request runs `--own-files`; a narrowed map changes none of this (source: `.github/workflows/ci.yml:11,28`, `CONTRIBUTING.md:44`, `docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md:63-69`).
3. [project rules] What must happen when the narrowing hides a test that would fail? → the train's whole-suite `check` is the backstop, accepted by the owner; the review trigger is a train red on a test the map should have selected (source: `docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md:77-84,90-94`).

## Questions asked

1. [end effect] A pull request that edits a document: do the slow tests that read it still run on it? → no: only the fast tests that read the document; the slow ones run on the train, which may go red on a broken pinned text.
2. [scope] Which hub modules does the narrowing cover? → both `change-loop.mjs` and `deliver-check.mjs`.
3. [end effect] Is the 2-minute target the whole `check` job or only the suite step? → the whole job; the change reduces the fixed part too when it exceeds the target.
4. [scope, answered by the owner after the triage found two written texts that disagree] Does the wish cover hub modules other than `deliver-check.mjs`? → see question 2 (the roadmap line names one, the retro of selective-tests-by-map-2 says "such as").

## Escalations

- REQUIRES HUMAN DECISION — none open: the owner's answers need only edits to the map's data and, if the plan needs it, its check. A change to rules S1 to S7 or to ADR 0036 decision 2 would stop here and come back to the owner.

## Out of scope

- Changing rules S1 to S7 of `scripts/test-suite.mjs` or the meaning of "a mapped file selects its tests" (an escalation if the plan needs it).
- Making any slow test faster, splitting a test file, or moving a pinned-text check out of a slow test into a fast one (the owner chose to leave the slow readers to the train).
- Narrowing the whole suite on the train, on `push` to `main` or under a lone `node scripts/test-suite.mjs`.
- `python3 scripts/check.py`, `gen-catalog.py --check` and `gen-agents.mjs --check`: they stay whole and unchanged (only their place in the measured fixed part is recorded).
- Pull requests whose own files include code outside the hub modules: their selection is not narrowed beyond what the map already says.
