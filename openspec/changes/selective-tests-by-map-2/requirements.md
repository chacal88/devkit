<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> os portões, a prova e cada mescla da main rodam só os testes ligados aos arquivos que a change mexeu (um mapa de teste para script); os testes lentos só rodam quando a change toca no que eles cobrem; a suíte inteira roda uma vez, no trem

## Classification

domain=process type=feature flags=[architecture, contract] (strict-assumed; the owner confirms it with the assumptions below)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- A change's touched files are its own files as ADR 0025 decision 1 defines them: the paths `git diff origin/<base>...HEAD` shows, minus the release files (`RELEASE_FILE` of `plugins/openspec/hooks/deliver-check.mjs`: plugin manifests, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`) and minus `openspec/changes/<id>/`.
- The map is a file committed in the repository that links each script or source file to the test files that cover it, and marks each slow test file by hand (the owner chose a marked list over a measured time). Its path and format are the planner's; AMBIGUOUS: (a) one map file at the repository root or under `scripts/` | (b) one map per plugin folder; the planner resolves.
- Selection is a mode of the repository's one test command, `node scripts/test-suite.mjs` (ADR 0026 decision 1 keeps one command); with no selection argument it still runs every file of the four suite folders, as today. The spelling of the mode is the planner's.
- Where a gate, the proof or the step after a merge of the base runs tests, it runs the selected files only. `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `node plugins/compozy/kit/scripts/gen-agents.mjs --check` stay whole and unchanged.
- The `check` job on `push` to `main` keeps running `node scripts/test-suite.mjs` whole; only the `check` job of a change's own pull request becomes selective.
- A selective gate command is a gate part of its own: it is not equal to a part of the train's whole-suite command, so it needs its own passing row in `evidence.md` (source: `openspec/specs/change-delivery/spec.md:322-323`, `plugins/openspec/hooks/deliver-check.mjs:538-539`, `plugins/openspec/hooks/deliver-check.mjs:1056`) (answered by triage).
- The change amends ADR 0025 decision 6 (CI `check` on the merged ref as the backstop) and touches ADR 0022 decision 5 and ADR 0026 decision 1; the owner chose the selective CI, so the plan carries a new ADR for it, which the owner approves with the plan (`openspec/config.yaml:55-56`).
- The map cannot rot unnoticed: a check fails when the map names a file that does not exist; the planner decides whether it also fails on a script or test the map lacks.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `gate-runs-mapped-tests`: for a branch whose own files are a set X, the selective run executes exactly the test files the map links to X (plus the fast tests that use a touched shared helper, AC-3) and its output lists each selected file and the touched file that selected it; no other test file runs.
- AC-2 `slow-only-when-linked`: a test file the map marks slow does not run unless the branch touches a file the map links to it directly; touching a shared helper such as `plugins/openspec/hooks/test-fixtures.mjs` runs the fast tests that use it and no slow test the map does not link to that helper.
- AC-3 `shared-helper-fast-only`: when a branch touches a shared helper, every fast test file that imports it runs.
- AC-4 `unmapped-code-runs-all`: a touched code file that no map entry covers selects the whole suite; a branch whose own files are only docs or files under `openspec/` selects no test file.
- AC-5 `base-merge-selective`: after a merge of `origin/<base>` into a change branch, the test run the loop asks for is the selective run for the branch's own files (ADR 0025 decision 1), not the whole suite.
- AC-6 `proof-selective`: the `evidence.md` of a change shows a passing row for the selective gate command with the files it selected; a gate that selects no test file is recorded as such, not as a pass of the whole suite.
- AC-7 `pr-ci-selective-train-whole`: the `check` job of a change's own pull request runs the selective run and the same job on a train's pull request, on `push` to `main` and under a lone `node scripts/test-suite.mjs` runs the whole suite once; a train whose head is red on the whole suite is still found by bisection as ADR 0022 decision 7 says.
- AC-8 `whole-suite-unchanged`: `node scripts/test-suite.mjs` with no selection argument runs the same files and reports the same test names as before the change (ADR 0026 decision 5).
- AC-9 `map-checked`: a check fails, naming the entry, when the map links a file that does not exist.

## Answered by triage

1. [end effect] Does the rule that a gate part equal to a train-command part needs no passing row cover a selective gate command? → no; a selective command is declared separately and needs its own passing row (source: `openspec/specs/change-delivery/spec.md:322-323`, `plugins/openspec/hooks/deliver-check.mjs:538-539`)

## Questions asked

1. [project rules] What should the `check` job run on a change's own pull request? → only the tests linked to its files; the whole suite runs once, on the train's pull request. (An ADR amending 0025 decision 6 follows.)
2. [edges] A touched file no map entry covers: what runs? → code with no mapped test runs the whole suite; docs and `openspec/`-only files select no test.
3. [scope] How are slow tests known? → marked in the map by hand.
4. [edges] A touched shared helper that most tests use: what runs? → the fast tests that use it; a slow test only when the map links it to that helper explicitly.

## Escalations

- REQUIRES HUMAN DECISION — none open: the owner's answer to question 1 amends ADR 0025 decision 6, so the plan carries a new ADR for the owner to approve.

## Out of scope

- Selecting `python3 scripts/check.py`, `gen-catalog.py --check` or `gen-agents.mjs --check`: they stay whole.
- The test folders outside the suite's four (the panel's tests and the rest of `plugins/compozy/`), as in ADR 0026 decision 6.
- Making the suite itself faster (concurrency, splitting files) and any timing record of the files.
- Changing the train's own command (`openspec/config.yaml` `devkit.delivery.train`) or the train's bisection.
