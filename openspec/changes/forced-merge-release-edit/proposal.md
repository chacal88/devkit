<!-- devkit-stage proposal result=passed attempt=1 commit=0421f488610ba57ef538ee71e19a25db6d16c7eb -->
# Proposal

Change: `forced-merge-release-edit` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`; the roadmap line `forced-merge-release-edit
(after: release-at-merge)` of `openspec/roadmap.md`; D-29 of
`openspec/changes/archive/2026-11-26-release-at-merge/design.md`). Base: `origin/main` at `6f03a57c`;
the branch was opened on it (`0421f488`) and has merged nothing yet. The sibling change `fast-suite`
(it edits `staleness` in `plugins/openspec/hooks/deliver-check.mjs`) lands first; the base is merged
before the implementation when it has landed (task 1.1).

## Why

On an owner's forced merge, `gatesAtHead` judges each gate file through a GitHub compare whose files
must all be under `openspec/` (or pass `verdictAllowed`). The commit of the `assign-release` step
always changes the manifests, `CHANGELOG.md`, the ADR file name and its citations, so a noted change
merged by force lists `evidence.md` and every approved review as open items. The normal delivery
path reads that same commit as current (ADR 0034 decision 5). Release-at-merge left this
over-report on purpose (its D-29, the owner's answer 2b) and put it on the roadmap as this change.

## What Changes

- **The forced-merge read applies the release-edit rule.** For a change with a release note in a
  project that names `devkit.release_tag`, a path in the compare from a record's `Commit:` to the
  merged head that the reader's rule rejects still leaves the record current when its two texts are
  equal once the release lines are masked. These are the texts at the recorded commit and at the
  merged head, read through GitHub. This is the comparison ADR 0034 decision 5 defines and the normal
  path already runs (`releaseOnlyEdit`, `maskRelease`). The same helper runs on a reader of GitHub
  contents in place of `git show`, so no second copy of the mask is written.
- **Only the verdicts that get the rule on the normal path get it here**: a passed `evidence.md`, and
  an approved or declined review that lists no undisposed finding. A rejected review, an approved
  review with an undisposed finding, a change with no note and a project with no
  `devkit.release_tag` are read exactly as today.
- **A failed read of a file the comparison needs is `blocked`**, quoting the error. The same rule
  applies to the release note, the project config, a release file at either commit and an ADR
  folder. It is never read as "current" and never as "not forced", as for every other gate read today.
- **Spec**: the requirement "A plain commit on the branch keeps its rule" drops its last sentence
  (the forced-merge carve-out) and its scenario "The step's commit" says the forced merge reads the
  records as current. "The open items of a forced merge are named" states the release-edit exception
  and gains scenarios for the step's commit, a sentence edit, a later product commit and a failed read.
- **Docs**: the "An owner's forced merge" paragraph of `docs/openspec-flow.md` says a release edit
  leaves a gate file current there too.
- No new ADR (`decisions.md`). The trailer `Release-change: <id>` is not read: a trailer counts for
  nothing on its own (ADR 0035 decision 2), and the step record is read only where the branch's
  history is present (ADR 0035 decision 3). No release state is computed, so ADR 0035's review
  trigger ("a reader without the branch's history starts computing the release state") does not
  fire (`design.md` D-1).

## Non-goals

- The local delivery checker, the stage checker and `deliver-check --ci`: their release-edit
  reading is unchanged.
- `forcedChecks`, the unticked-task part of a forced merge, and `staleness` (edited by `fast-suite`).
- The forced merge's other gaps, which stay as they are: no own-files rule for a merge of the base,
  and a rename's `previous_filename` is not judged (`design.md`, Risks).
- A real forced merge on GitHub (checked in the retro of the first real change force-merged after a
  release step).
- The roadmap items `release-at-merge-nits`, `forced-merge-path-followups` and
  `loop-place-and-evidence-followups`.

## Acceptance criteria

- AC-1 `release-only-compare-opens-no-gate`: For a noted change whose evidence and approved reviews record commit R, where the only commit after R on the merged head is the `assign-release` step's commit with release-line changes only (manifests, `CHANGELOG.md`, CI pins, the ADR renamed to its number with its citations), `forcedMerge` lists no `evidence.md` and no `reviews/<reviewer>.md` among its items.
- AC-2 `release-commit-with-sentence-opens-gates`: Same setup, but the step's commit also changes a sentence of `docs/openspec-flow.md` that is not a citation: `evidence.md` and each approved review are open items, and each reason names that file.
- AC-3 `product-commit-after-release-opens-evidence`: Same setup plus a later commit that changes a product file (`plugins/x.mjs`): `evidence.md` is an open item, and its reason names that file.
- AC-4 `no-note-unchanged`: A change with no release note, and a project with no `devkit.release_tag`, whose compare from R lists the same release files, gets the same items as before this change (`evidence.md` and the approved reviews open).
- AC-5 `rejected-and-open-findings-unchanged`: With the AC-1 compare, a `REJECTED` review, and an approved review that lists an undisposed finding, are still open items.
- AC-6 `spec-states-forced-merge-reads-release-edit`: `openspec/specs/change-delivery/spec.md`, after the change's delta is applied, no longer holds the sentence "On an owner's forced merge the evidence and the reviews SHALL be read by the requirement \"The open items of a forced merge are named\"". The scenario "The step's commit" says the forced merge reads the records as current. `openspec validate --strict` passes on the change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: "A plain commit on the branch keeps its rule" loses its forced-merge sentence
  and its scenario "The step's commit" covers the forced merge. "The open items of a forced merge
  are named" reads a release edit as current for a noted change and blocks on a failed read of a
  file the comparison needs.

## Impact

- `plugins/openspec/hooks/deliver-check.mjs` (pack `devkit-openspec`): `gatesAtHead` gains the
  release-edit judgement. `releaseContext` and `releaseOnlyEdit` take their file reader from the
  context, `repoReader(root)` by default, so every caller today keeps its reads.
- `plugins/openspec/hooks/deliver-check-archive.test.mjs`: the `gatesAt` fixture answers "not found"
  for `release.md` by default, G15 is replaced by the AC tests, and new tests are added. No test file
  is added or moved, so `scripts/test-map.json` is unchanged.
- `openspec/specs/change-delivery/spec.md` through the delta; `docs/openspec-flow.md`, one paragraph.
- A forced merge of a noted change makes a few more GitHub reads: the note, the config, two texts
  per rejected path and the ADR folders at both commits, memoized per call.
- Dependencies: ADR 0034 decision 5, ADR 0035 decisions 2, 3 and 7, ADR 0028 decision 3
  (unchanged); the sibling `fast-suite` lands first. No open decision is touched.
- Exit criteria: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green,
  `openspec validate forced-merge-release-edit --strict` passes, and `claude plugin validate .`
  passes.
- Release: `release.md` (devkit-openspec patch). No task bumps a version, edits a `CHANGELOG.md`
  line or a CI pin, or numbers an ADR.
