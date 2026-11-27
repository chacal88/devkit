<!-- devkit-stage proposal result=passed attempt=2 commit=22f70c31f9bcbba9c8e6babe685dd4b07de05725 -->
# Proposal

Change: `selective-tests-by-map-2` · Date: 2026-11-26 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`, the record
`docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`). Base: `origin/main` at `e8991d6d`;
the branch was opened on it (`22f70c31`) and has merged nothing yet. That base already holds
`release-at-merge` (merged in PR 155, archived in PR 156). "The record" in these files is the
change's own unnumbered record ("Release rule" below).

## Why

Every gate, every real-run proof and every step after a merge of `main` runs `node scripts/test-suite.mjs`, the
whole suite (44 files at `e8991d6d`, about 10 minutes on an idle 8-core machine), and CI's `check` runs it again on
every push of every change's pull request. The train runs it once more anyway (ADR 0022 decision 5).
The owner asked that a change pay only for the tests its own files map to, slow tests only when it
touches what they cover, and that the whole suite run once, on the train.

## What Changes

- **A test map**, `scripts/test-map.json`, committed and kept by hand: each script, module or folder
  is linked to the suite test files that cover it. It also lists the shared test helpers and marks
  the slow test files (the record, decision 1).
- **A selection mode of the one command** (ADR 0026 decision 1, the record's decision 3):
  `node scripts/test-suite.mjs --own-files` reads the branch's own files (ADR 0025 decision 1:
  committed against `origin/<base>`, plus the uncommitted ones outside `openspec/`, release files
  left out) and runs only the test files the map selects. It prints one `selected` line per file,
  naming the own file that selected it. Unmapped code, or a map entry with an empty list, selects the
  whole suite. Unmapped docs and `openspec/` files select no
  test, and the run passes saying so. A train branch, or a checkout that cannot tell its own files
  (no base, no `origin/<base>`, no commit, no merge base, or git itself failing, as in a folder that
  is not a git repository), selects the whole suite (fail safe, ADR 0025 decision 4).
- **The map cannot rot unnoticed**: before it selects, `--own-files` refuses a map that names a
  missing file, links a non-suite file, or leaves a suite script or a suite test uncovered. A suite
  script is a file git tracks under a suite folder: a stray untracked or ignored file (a `.DS_Store`)
  is not one, and when git cannot tell, every file on disk counts (`design.md` D-3). A suite
  test is covered only when a map entry names it; importing a shared helper does not count. It names
  each entry and runs nothing. A test pins the repository's own map.
- **A link is a real use**: the map's first content is built by rules (`design.md` D-4) that link a
  test to a file it imports, or to a file it names on a code line. A file named only in a comment,
  such as the "Run by `node scripts/test-suite.mjs`" header of most tests, is not linked.
- **Gates, proof and base merges go selective**: `openspec/config.yaml` (`Test command:`, `Gates:`) and
  `CLAUDE.md` name `node scripts/test-suite.mjs --own-files`. Its gate part has its own passing row in
  `evidence.md`; it is not a part of the train's command (`openspec/specs/change-delivery/spec.md`,
  "a gate part equal to a part of the train's whole-suite command").
- **CI**: the `check` job runs `--own-files` on a pull request, with the full history so that
  `origin/<base>` resolves, and the whole suite on `push` to `main`. A train's pull request runs the
  whole suite through the train-branch rule. The job's id and its required place are unchanged.
- **No behaviour changes for `node scripts/test-suite.mjs` without a selection argument**: same
  files, same test names, same output, and the map is not read (AC-8).
- `plugins/openspec/hooks/deliver-check.mjs` exports the own-files computation it already has, so
  that the selection and the staleness rule share one helper. No checker answer changes.
- **Docs and records**: `CONTRIBUTING.md`, `docs/openspec-flow.md` (one sentence), the `Amended by`
  lines of ADRs 0022, 0025 and 0026, the ADR list of `openspec/config.yaml`.

Non-goals: everything under "Out of scope" in `requirements.md`. Also out: a timing record of the
files, a change to `devkit.delivery.train`, the panel, and the generic agents
(`plugins/core/agents/*.md`) and skills, which keep saying "the project's test command".

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `gate-runs-mapped-tests`: for a branch whose own files are a set X, the selective run executes exactly the test files the map links to X (plus the fast tests that use a touched shared helper, AC-3) and its output lists each selected file and the touched file that selected it; no other test file runs.
- AC-2 `slow-only-when-linked`: a test file the map marks slow does not run unless the branch touches a file the map links to it directly; touching a shared helper such as `plugins/openspec/hooks/test-fixtures.mjs` runs the fast tests that use it and no slow test the map does not link to that helper.
- AC-3 `shared-helper-fast-only`: when a branch touches a shared helper, every fast test file that imports it runs.
- AC-4 `unmapped-code-runs-all`: a touched code file that no map entry covers selects the whole suite; a branch whose own files are only docs or files under `openspec/` selects no test file.
- AC-5 `base-merge-selective`: after a merge of `origin/<base>` into a change branch, the test run the loop asks for is the selective run for the branch's own files (ADR 0025 decision 1), not the whole suite.
- AC-6 `proof-selective`: the `evidence.md` of a change shows a passing row for the selective gate command with the files it selected; a gate that selects no test file is recorded as such, not as a pass of the whole suite.
- AC-7 `pr-ci-selective-train-whole`: the `check` job of a change's own pull request runs the selective run and the same job on a train's pull request, on `push` to `main` and under a lone `node scripts/test-suite.mjs` runs the whole suite once; a train whose head is red on the whole suite is still found by bisection as ADR 0022 decision 7 says.
- AC-8 `whole-suite-unchanged`: `node scripts/test-suite.mjs` with no selection argument runs the same files and reports the same test names as before the change (ADR 0026 decision 5).
- AC-9 `map-checked`: a check fails, naming the entry, when the map links a file that does not exist.

Exit criteria: every phase gate of `tasks.md` green; `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`,
`claude plugin validate .` and `openspec validate selective-tests-by-map-2 --strict` pass; the
pull request's `check` job runs `--own-files` and is green (a workflow follow-up).

## Capabilities

None. The change alters how this repository selects its own tests, one CI step and the texts that
quote the command. No behaviour of a shipped hook, skill, agent or schema changes:
`deliver-check.mjs` only exports what it computes, and its gate rule already treats a part that is
not the train's as needing a row. So `.openspec.yaml` sets `skip_specs: true`, as `suite-speed`
did.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- Repository: `scripts/test-suite.mjs`, `scripts/test-map.json` (new), `.github/workflows/ci.yml`,
  `openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/openspec-flow.md` (one sentence),
  `docs/adr/0022-*`, `0025-*`, `0026-*` (an `Amended by` line each), the new ADR (accepted at plan
  approval). The release files (`CHANGELOG.md`, the manifests, `docs/catalog.md`, the CI pin lines
  of `docs/openspec-flow.md`) are written by the delivery, not by this branch ("Release rule").
- devkit-openspec (patch, in `release.md`): `hooks/deliver-check.mjs` (two exports, no answer changes); tests in
  `hooks/test-suite.test.mjs`, `hooks/deliver-check.test.mjs`, `hooks/delivery-train.test.mjs`,
  `hooks/test-tmp.test.mjs`; comment-only fixes in `hooks/change-loop-compozy.test.mjs` and
  `hooks/deliver-check.test.mjs` (they state that CI checks out shallow, which stays true only for
  a push). Also `hooks/release-note.test.mjs`, a base test this change had to extend: the
  `openspec/config.yaml` ADR list entry of the record is the first entry after the release-at-merge
  pair, and the test required that pair to end the line. Since commit `02eb93ed` it keeps the two
  records linked and lets later records follow them, with one test of its own (`design.md`
  "Pinned rules", `tasks.md` 2.6).
- Revised after round 1 of the code review (`review.md`), with no AC changed: M5 checks the files
  git tracks (`design.md` D-3); the head branch is read by `deliver-check.mjs`'s `currentBranch`, so
  `DEVKIT_BRANCH` counts as it does for every train-branch caller (D-5); a test pins the CI base
  (D-2). Tasks 2.6 to 2.9 and 3.7 carry them.
- Unchanged: devkit-core, devkit-compozy, devkit-panel (`commandLabel` reads the gate as
  `test-suite --own-files`), the train's command and its bisection, `check.py`, `gen-catalog.py`,
  `gen-agents.mjs`.

**Release rule.** This change follows the note rule. It was opened at `22f70c31` on `e8991d6d`,
after `release-at-merge` merged (PR 155) and was archived (PR 156). The old rule belongs only to "a
change opened before the release note" (`CONTRIBUTING.md` step 5; `openspec/config.yaml`
Conventions), and decision 8 of `0034-release-at-merge.md` keeps it for those changes alone. So the
change carries `openspec/changes/selective-tests-by-map-2/release.md`, written with the plan:
`packs:` with `devkit-openspec: patch` (the one pack whose files it changes, `hooks/deliver-check.mjs`
and its tests), the default marketplace bump (the largest pack bump), a changelog title and
a body. As decisions 1, 2 and 7 of `0034-release-at-merge.md` say, the branch bumps no version, adds
no `CHANGELOG.md` line, moves no CI pin line of `docs/openspec-flow.md`, regenerates no
`docs/catalog.md` for a release, and numbers no ADR by hand: the delivery (the `assign-release`
step, or a train's join) writes the release once, at the merge. The approval records the note's hash
(decision 2), so an edit of `release.md` after approval asks the owner again.

The record is unnumbered: `docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`, listed in
that form by `decisions.md`. Every file the branch writes cites it as
`ADR [a-change-runs-only-the-tests-its-files-map-to]` and, where a file name follows, as
`(a-change-runs-only-the-tests-its-files-map-to.md)`; no file writes a number for it. The same
release step (`assign-release`, or the train's join) gives it the next free number on the base and
rewrites those two forms in tracked text outside `openspec/changes/` (decision 3 of
`0034-release-at-merge.md`; `rewriteCitations` in `plugins/openspec/hooks/release-merge.mjs`).
`decisions.md` is not rewritten: the loop's `numberedRecord` resolves its unnumbered path to the
numbered file after the step. Test and fixture files are not rewritten (`CITATION_PATHSPEC` in
`deliver-check.mjs`), so no test or fixture cites the record (`design.md` D-9).

**Dependencies.** None under way. ADR 0025's own-files rule, ADR 0026's suite script, ADR 0022's
train and `release-at-merge`'s release rule are all in the base `e8991d6d`. `release-at-merge` also
edited `deliver-check.mjs` (about 700 lines, `releaseEditOf` beside `ownFiles` among them) and the
ADR list of `openspec/config.yaml`; `ownFiles` itself is unchanged, and the anchors of `design.md`
are those of `e8991d6d` (the branch's tree at `22f70c31` holds no code change on top of it).

**Decisions cited.** `ADR [a-change-runs-only-the-tests-its-files-map-to]` (proposed, `decisions.md`), ADR 0026 (decisions 1, 2, 5, 6), ADR 0025
(decisions 1, 4, 6; its rejected dependency closure), ADR 0022 (decisions 5, 7, 11),
`0034-release-at-merge.md` (decisions 1, 2, 5, 7 and 8: the note rule this change follows, and who
keeps the old one), ADR 0002 and ADR 0003 (the required `check` job).

**Open decisions inherited.** None: no point of `docs/coordination-design.md` "Open points" is
touched.

**Flagged for the owner at plan approval.**

- AC-4 is read with question 2 of the grill ("a touched file no map entry covers"): an unmapped doc or
  `openspec/` file selects nothing. A doc or `openspec/` file the map names (`CLAUDE.md`, pinned by
  `test-suite.test.mjs`; `openspec/config.yaml`) selects its tests. "Docs" means a Markdown file
  outside `plugins/`. Plugin Markdown (skills, agents) counts as code, because tests pin its text.
- AC-1 "the test files the map links to X" includes a touched suite test file itself, slow or fast:
  a change that edits a test runs it.
- AC-5 and AC-6 are proven here by the texts the loop's agents read (`Test command:` and `Gates:` of
  `openspec/config.yaml`, `CLAUDE.md`), and by this change's own evidence after its last base
  merge. The pr-verifier's row for a "selected no test file" gate is next-change dogfood: this
  change's own gate always selects tests.
- AC-5's evidence row is `pass` only for what is proven here: the texts the loop reads, the
  selective run on the head (`proof/base-merge.txt`; task 3.1's merge of `origin/main` was already
  up to date, so no real base merge happened) and case (h)'s run on a merge commit in a scratch clone
  (`proof/case-h.txt`). The loop asking for the selective run after a real base merge is next-change
  dogfood. The pr-verifier words the row that way (task 3.6).
- The release follows the note rule (above): `release.md` names `devkit-openspec: patch`, and the
  delivery writes the versions, the changelog entry and the CI pins, and numbers the unnumbered
  record; no task does.
- The record's slug, `a-change-runs-only-the-tests-its-files-map-to`, names its rule, while ADR
  `0034-release-at-merge.md` decision 3 names the change id as the slug; no checker enforces that
  wording (`scripts/check.py` asks only for a unique slug listed by an active change), and the owner
  accepts the descriptive slug at plan approval.
