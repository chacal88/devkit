<!-- devkit-stage readiness result=passed attempt=1 commit=0421f488610ba57ef538ee71e19a25db6d16c7eb -->
# Readiness review: forced-merge-release-edit

## Decision

- Status: APPROVED

Blockers: 0. An implementer can build every task from `design.md` without asking a question, and each
AC (AC-1 to AC-6) has a task and a command that proves it before the pull request merges.

## Package

Change `forced-merge-release-edit`, folder `openspec/changes/forced-merge-release-edit/`: proposal,
design, tasks, requirements, decisions (not-applicable), `release.md`, one delta
(`specs/change-delivery/spec.md`). Stage: ready for implementation. Scope: correct (one function
`gatesAtHead`, one shared helper's reader, one test file, one doc sentence).

## Validation

- `openspec validate forced-merge-release-edit --strict`: valid.
- Delta against `openspec/specs/change-delivery/spec.md`: both MODIFIED blocks keep every existing
  scenario (checked by name); six scenarios are added to the forced-merge requirement.
- Release note: `release.md` has `packs:` with `devkit-openspec: patch`, a title and a body, fences
  closed. No task bumps a version, edits a CHANGELOG line or a CI pin, or numbers an ADR.
  `decisions.md` is `not-applicable` and lists no record.
- Gates run on the base: `python3 scripts/check.py` passes; `python3 scripts/gen-catalog.py --check`
  exits 0; `node scripts/test-suite.mjs --own-files` selects no test file (the branch changes only
  change-folder files). `claude plugin validate .` could not run in this session (permission
  denied); the caller runs it. The long own-files run of task 1.7 is the caller's.

## Claims checked against the code (at `0421f488`)

- `gatesAtHead` at `deliver-check.mjs:969`, inner `behind(recorded, allowed)` with a compare per sha
  and the `<sha> is behind the merged head, which changes <path>` text: confirmed (`:975`-`:1000`).
- `releaseOnlyEdit(root, before, after, path, ctx)` at `:2254` has exactly one hard-wired
  `repoReader(root)` (`:2258`); `releaseContext(root, file)` at `:2298` builds a second one for
  `adrsAt`; `releaseEdit` at `:2303` and the train check at `:3653`/`:3662` are the other callers.
  D-5's default parameter keeps their reads unchanged: confirmed.
- `readContents` (`:1767`) gives `{ json } | { notFound } | { error }`; `ghJson` (`:1806`) and `isSha`
  (`:1812`) exist as D-2 and D-4 use them. `releaseTagSetting` and `parseDevkitBlock` are already
  imported (`:19`) and `releaseTagSetting` returns `{ file: null }` for an absent or refused value.
- `RELEASE_FILE`, `PIN_FILE = docs/openspec-flow.md` and `ADR_DIRS` exist as D-1 and the fixture
  assume; the evidence and review items pass `releaseEditOf` only for an approved verdict with no
  undisposed finding (`:491`), as D-3 mirrors.
- G15 and `STEP_FILES` at `deliver-check-archive.test.mjs:2597`-`2598`; `gatesAt` at `:2262`;
  `scripts/test-map.json` maps `deliver-check.mjs` to the archive test file, so no map edit.
- The `release-note AC-3/4/5` rows named in tasks 1.3 exist in `deliver-check.test.mjs` and
  `delivery-train-after.test.mjs`; the `--test-name-pattern` and `--own-files` options exist in
  `scripts/test-suite.mjs`.
- Spec text quoted in the proposal (the forced-merge sentence, the "The step's commit" THEN) is at
  `openspec/specs/change-delivery/spec.md` as stated; the flow-page anchor sentence occurs once.

## Findings

Scope, proposal, design, specs, tasks, omissions: no findings with a Mandatory fix.

- Low, Nice to have, `design.md` Context: some anchors are a few lines off (`readReviews` is cited
  at `:487`, which is a `const dir` line inside it; `forcedMerge` at `:1054` is its declaration).
  The names are right and the design says line numbers move with task 1.1. No action needed.
- Low, Fix during implementation, `tasks.md` 1.3: `^release-note AC-[345] ` also selects the
  `AC-4 row N5/N6` and `AC-5 departure` tests, which is wider than the "staleness and trainCheck"
  rows the text names. It only widens the check, and it must pass.

## Mandatory questions

1. Problem defined: yes, the forced-merge read over-reports the step's commit.
2. Measurable: yes, T-1 to T-9 and the AC commands.
3. Error behaviour: yes, a failed or empty read is `blocked` (D-2, spec scenario, T-8, T-9).
4. Edge cases: yes (short sha, no `base_commit`, no note, bad or absent config, rejected review,
   undisposed finding, sentence edit, product commit, 300-file limit unchanged).
5. Dependencies: clear; `fast-suite` first, task 1.1 handles the merge and stops if it touched the
   helpers.
6. Contracts: yes (reader shape, memo, `readError`, `exempt`, texts).
7. Two readings: no material divergence; names, texts and fixtures are given.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes, including the spec delta and the flow sentence.
10. Found too late: the real GitHub behaviour of a forced merge, declared in the Workflow follow-up
    (retro of the first real case); not provable here.

## Top production risks (grounded)

1. A `fast-suite` merge moves `gatesAtHead` or the helpers: task 1.1 edits the plan files in the
   same commit and stops for the coordinator if the helpers changed.
2. GitHub answers no `content` for a file over 1 MB: blocks naming the file (accepted, Risks).
3. Aggregate compare accepts a product edit later undone: accepted, as today for every file.
4. A merge of the base between R and H still opens items: an over-report, never a pass.
5. A rename's `previous_filename` is not judged: unchanged and out of scope.
