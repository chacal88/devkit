<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> forced-merge-release-edit: on an owner's forced merge, `gatesAtHead` reads each gate file through a GitHub compare whose files must all be under `openspec/` or allowed by `verdictAllowed`, so the commit of the `assign-release` step lists `evidence.md` and each approved review as open items. Give `gatesAtHead` the release-edit allowance (allow the files of a commit that carries `Release-change: <id>`, or apply the release mask), drop the forced-merge sentence release-at-merge wrote into that requirement, and add a test: a noted change whose compare from the evidence commit lists only the step's release files opens no gate.

Classification: domain=process type=bug flags=[] (confirmed by the grill: the change alters how one checker reads gate currency, no screen, no new contract)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Only the forced-merge read changes: `plugins/openspec/hooks/deliver-check.mjs#gatesAtHead`, whose one caller is `forcedMerge`. The local delivery checker, the stage checker and `deliver-check --ci` already read the step's commit as current and stay as they are (answered by triage).
- The forced-merge read gives the same answer as the normal delivery path for a release edit. A commit after the recorded `Commit:` leaves the evidence and an approved or declined review current only when every path it changes differs from its parent only in release lines, by the release-edit rule of ADR 0034 decision 5. A commit that carries `Release-change: <id>` but also changes another line (a sentence of `docs/openspec-flow.md` that is not a citation) still makes them open items. The coordinator's session took the option that matches the normal path; ADR 0035 decision 2 (a trailer counts for nothing on its own) points the same way.
- The mechanism is the planner's. It has to work through GitHub alone, with no local clone. ADR 0035 decision 7 already lets a reader without the branch's history judge staleness by the masked comparison. The planner checks the review trigger of ADR 0035 ("a reader without the branch's history starts computing the release state") and states in the plan why the chosen mechanism does or does not trip it.
- A product commit after the step's release commit still makes `evidence.md` an open item naming that file (answered by triage: `openspec/specs/change-delivery/spec.md`, scenario "Evidence recorded before a product change").
- A change with no release note, and every change of a project with no `devkit.release_tag`, keeps today's forced-merge read (answered by triage: requirement "A plain commit on the branch keeps its rule"; ADR 0034 decision 5).
- A rejected review, and an approved review that still lists an undisposed finding, get no release allowance and are judged as before (answered by triage).
- `gatesAtHead` keeps reading against the pull request's branch head (`headRefOid`), so the step's commit is inside each compare after a squash merge too (answered by triage).
- Spec text in `openspec/specs/change-delivery/spec.md`. The requirement "A plain commit on the branch keeps its rule" loses its last sentence ("On an owner's forced merge the evidence and the reviews SHALL be read by ..."). Its scenario "The step's commit" says the forced-merge read also reads them as current. The scenario "Evidence recorded before a product change" of "The open items of a forced merge are named" gains the release-edit exception for a noted change, so it no longer says that only an `openspec/`-only diff keeps the evidence current. The forced-merge paragraph of `docs/openspec-flow.md` is checked against the new behaviour.
- Proof: tests with a fake `gh`, beside the forced-merge G-rows of `plugins/openspec/hooks/deliver-check-archive.test.mjs`, one per acceptance criterion, are enough for this change. A real forced merge on GitHub is not run here; it is checked in the retro of the first real change that is force-merged after a release step. The coordinator's session took this option.
- Order against the other changes that edit `deliver-check.mjs`: `fast-suite` lands first (it changes `staleness`), then this change, then `loop-place-and-evidence-followups`. The base is merged before the implementation if `fast-suite` has merged by then.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `release-only-compare-opens-no-gate`: For a noted change whose evidence and approved reviews record commit R, where the only commit after R on the merged head is the `assign-release` step's commit with release-line changes only (manifests, `CHANGELOG.md`, CI pins, the ADR renamed to its number with its citations), `forcedMerge` lists no `evidence.md` and no `reviews/<reviewer>.md` among its items.
- AC-2 `release-commit-with-sentence-opens-gates`: Same setup, but the step's commit also changes a sentence of `docs/openspec-flow.md` that is not a citation: `evidence.md` and each approved review are open items, and each reason names that file.
- AC-3 `product-commit-after-release-opens-evidence`: Same setup plus a later commit that changes a product file (`plugins/x.mjs`): `evidence.md` is an open item, and its reason names that file.
- AC-4 `no-note-unchanged`: A change with no release note, and a project with no `devkit.release_tag`, whose compare from R lists the same release files, gets the same items as before this change (`evidence.md` and the approved reviews open).
- AC-5 `rejected-and-open-findings-unchanged`: With the AC-1 compare, a `REJECTED` review, and an approved review that lists an undisposed finding, are still open items.
- AC-6 `spec-states-forced-merge-reads-release-edit`: `openspec/specs/change-delivery/spec.md`, after the change's delta is applied, no longer holds the sentence "On an owner's forced merge the evidence and the reviews SHALL be read by the requirement \"The open items of a forced merge are named\"". The scenario "The step's commit" says the forced merge reads the records as current. `openspec validate --strict` passes on the change.

## Out of scope

- The local delivery checker, the stage checker and `deliver-check --ci`: their release-edit reading is unchanged.
- The checks part of a forced merge (`forcedChecks`) and the unticked-task part.
- A real forced merge on GitHub in this change (checked in a later change's retro).
- The other `deliver-check.mjs` items of the roadmap (`release-at-merge-nits`, `forced-merge-path-followups`, `loop-place-and-evidence-followups`).

### Answered by triage

1. [scope] Does the change touch only the forced-merge read (`gatesAtHead`), leaving the local delivery checker, the stage checker and `deliver-check --ci` as they are? → Yes; `gatesAtHead` has one caller, `forcedMerge`, and the scenario "The step's commit" already has the other three read the step's commit as current. (source: `openspec/specs/change-delivery/spec.md:428`, `plugins/openspec/hooks/deliver-check.mjs:1058`)
2. [edges] A product commit after the step's release commit: does the evidence still open as an item at the forced merge? → Yes. (source: `openspec/specs/change-delivery/spec.md:603`)
3. [edges] A change with no release note, or a project with no `release_tag`: does the forced-merge read stay exactly as today? → Yes. (source: `openspec/specs/change-delivery/spec.md:413`, `docs/adr/0034-release-at-merge.md:88-90`)
4. [edges] A rejected review, or an approved review that still lists an undisposed finding: does the release allowance not apply? → It does not apply to either. (source: `openspec/specs/change-delivery/spec.md:413`, `plugins/openspec/hooks/deliver-check.mjs:490-492`)
5. [edges] Is the head `gatesAtHead` reads always the PR's branch head (`headRefOid`), so the step's commit is inside the compare? → Yes. (source: `plugins/openspec/hooks/deliver-check.mjs:1058`)
6. [project rules] Does any ADR or design decision of release-at-merge constrain the mechanism? → Yes, but none picks one of the two. D-29 names both; ADR 0035 decisions 2, 3 and 7 and its review trigger bear on it. (source: `openspec/changes/archive/2026-11-26-release-at-merge/design.md:1252-1254`, `docs/adr/0035-release-at-merge-step-record.md:59-67`, `:96-100`, `:131-133`)

### Questions asked

1. [end effect] On an owner's forced merge, when the step's release commit also changes an ordinary sentence, should the evidence and the reviews be listed as open? → Open, as on the normal delivery path (ADR 0034 decision 5, ADR 0035 decision 2) (answered by the coordinator's session on the owner's delegation of 2026-11-28).
2. [project rules] Is a test with a fake GitHub enough proof, or is a real forced merge wanted in this change? → Fake-GitHub tests beside the forced-merge G-rows are enough; a real forced merge is checked in a later change's retro (answered by the coordinator's session on the owner's delegation of 2026-11-28).
3. [project rules] Order against other `deliver-check.mjs` changes? → `fast-suite` first, then this change, then `loop-place-and-evidence-followups` (answered by the coordinator's session on the owner's delegation of 2026-11-28).
