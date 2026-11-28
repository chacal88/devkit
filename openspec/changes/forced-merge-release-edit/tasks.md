<!-- devkit-stage tasks result=passed attempt=1 commit=0421f488610ba57ef538ee71e19a25db6d16c7eb -->
# Tasks

Change: `forced-merge-release-edit` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main`
at `6f03a57c` (the branch was opened on it, `0421f488`, and has merged nothing yet) · PRD / tech
spec: n/a (`proposal.md`, `design.md`, `specs/change-delivery/spec.md`, `decisions.md`, `release.md`)

Work only in this change's worktree, on its branch. Every name, text, fixture and test is in
`design.md`: D-1 the mechanism, D-2 the GitHub reader, D-3 when the allowance applies, D-4 the
recorded side's ref, D-5 the shared helper's reader, D-6 the texts, D-7 the tests and the pinned
rules. The implementer copies them and makes no design choice. `staleness` is not edited (the
sibling `fast-suite` owns it). No ADR is written (`decisions.md`). The release follows the note
rule: `release.md` states it, and no task bumps a version, edits a `CHANGELOG.md` line or a CI pin
line, or numbers an ADR; the delivery writes them at the merge.

No test file is added or moved: every test goes into
`plugins/openspec/hooks/deliver-check-archive.test.mjs`, which `scripts/test-map.json` already maps
from `plugins/openspec/hooks/deliver-check.mjs`, so no task edits the map. Before a test is changed
or removed, its commit message names its invariant, the layer that owns it and the suite it lives
in; the "Pinned rules" table of `design.md` gives the three for each test this plan touches. Every
new test's name starts `forced-merge-release-edit AC-<n> ` or `forced-merge-release-edit blocked `.
End every task with `git status --short`, leaving no scratch file in the tree.

Every gate is one backticked command, run as written. Run the selective gate part as a background
command of the tool, never with a shell `&`, with no other suite on the machine, a load average
under about 20 (`uptime`) and the free disk checked (`df -h /`). `deliver-check.mjs` maps to 29 test
files, slow ones included, so the run takes several minutes.

Tests that pin the forced-merge sentence or the behaviour this plan replaces (searched in every
suite, `design.md` "Pinned rules"):

- `forced-merge-path 1: G15 forced-merge-release-edit: a noted change behind only the assign-release step's files names evidence.md and each approved review as open`
  and its comment block, `plugins/openspec/hooks/deliver-check-archive.test.mjs:2592`-`2616`:
  pins the over-report; removed and replaced by T-1 in task 1.2.
- G5, G6, G8, G11, G13, G9, G10 and the F, N and `forcedMerge` rows of the same file, through the
  `gatesAt` fixture: their expectations stay as they are; `gatesAt` gains the "no note" default
  in task 1.2.
- `release-note AC-4 staleness: ...` and `release-note AC-5 staleness: ...`
  (`plugins/openspec/hooks/deliver-check.test.mjs:2943`-`3105`) and
  `release-note AC-3 trainCheck: a join that numbers an ADR passes ...`
  (`plugins/openspec/hooks/delivery-train-after.test.mjs:465`): unchanged; they prove D-5 in task 1.3.
- No test quotes the spec sentence of `openspec/specs/change-delivery/spec.md:413`-`416`, the THEN
  of its scenario "The step's commit" (`:428`) or the flow page's forced-merge paragraph.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `release-only-compare-opens-no-gate` | 1.2, 1.4, 1.7 |
| AC-2 | `release-commit-with-sentence-opens-gates` | 1.2, 1.4, 1.7 |
| AC-3 | `product-commit-after-release-opens-evidence` | 1.2, 1.4, 1.7 |
| AC-4 | `no-note-unchanged` | 1.2, 1.3, 1.4, 1.7 |
| AC-5 | `rejected-and-open-findings-unchanged` | 1.2, 1.4, 1.7 |
| AC-6 | `spec-states-forced-merge-reads-release-edit` | 1.6, 1.7 |

## 1. The forced-merge read applies the release-edit rule (phase 1)

- [x] 1.1 Conductor: the base. When `fast-suite` has merged into `origin/main`, merge `origin/main`
  into the branch before any other task. If the merge moved or renamed a function, a line range or a
  test this plan names (`gatesAtHead`, `releaseOnlyEdit`, `releaseContext`, the G rows,
  `scripts/test-map.json`'s entry for `deliver-check.mjs`), edit `proposal.md`, `design.md` and
  `tasks.md` in the same commit. If `fast-suite` changed `releaseOnlyEdit` or `releaseContext`
  themselves, stop and ask the coordinator before task 1.3. Check: when `fast-suite` has merged,
  `git merge-base --is-ancestor origin/main HEAD` exits 0; when it has not, the commit of task 1.2
  says so; `git status --short` is empty.
- [ ] 1.2 Tests first (D-7), in `plugins/openspec/hooks/deliver-check-archive.test.mjs`. Give
  `gatesAt` the default `release.md` `NOT_FOUND` answer. Add the helper `releaseStepAt` and T-1 to T-9
  at G15's place, and remove G15 and its comment block, keeping `STEP_FILES`. The commit message
  names G15's invariant (a noted change's step commit at a forced merge reads as the over-report),
  its layer (`gatesAtHead`) and its suite (`deliver-check-archive.test.mjs`). Check, on the code
  before task 1.3:
  `node scripts/test-suite.mjs --test-name-pattern="^forced-merge-release-edit "` fails, with T-1,
  T-2, T-3, T-6, T-7, T-8 and T-9 failing and T-4 and T-5 passing (they pin today's answer).
  `node scripts/test-suite.mjs --test-name-pattern="^forced-merge-path 1: "` passes, so the
  `gatesAt` default changes no G, F or N row.
- [ ] 1.3 The shared helper's reader (D-5), in `plugins/openspec/hooks/deliver-check.mjs`:
  `releaseContext(root, file = null, reader = repoReader(root))` returns `{ file, reader, adrsAt }`,
  `adrsAt` reading through `reader`, and `releaseOnlyEdit` reads through `ctx.reader`. No other
  caller changes. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^release-note AC-[345] "` passes, covering the
  `deliver-check.test.mjs` staleness rows and the `delivery-train-after.test.mjs` trainCheck row
  (AC-4: the normal path and the train read as before), and `git diff --stat` lists only
  `deliver-check.mjs` for this task.
- [ ] 1.4 The forced-merge read (D-1 to D-4), in `gatesAtHead` of
  `plugins/openspec/hooks/deliver-check.mjs`: the GitHub reader closure with its memo and
  `readError`, the lazy note and config read, `behind`'s `exempt` argument (the evidence `true`, an
  approved review `!open`), the recorded side's ref from `base_commit.sha`, and the comments of D-6.
  Check: `node scripts/test-suite.mjs --test-name-pattern="^forced-merge-release-edit "` passes
  (T-1 to T-9: AC-1, AC-2, AC-3, AC-4, AC-5 and the blocked path), and
  `node scripts/test-suite.mjs --test-name-pattern="^forced-merge-path 1: "` passes.
- [ ] 1.5 The flow page (D-6): insert D-6's sentence into the "An owner's forced merge." paragraph
  of `docs/openspec-flow.md`, after the sentence ending
  `read through GitHub so the count is the same from every checkout.` Check:
  `grep -c "read through GitHub, are equal once the" docs/openspec-flow.md` prints 1, and
  `python3 scripts/check.py` passes (English prose, links).
- [ ] 1.6 The spec delta (AC-6): `openspec/changes/forced-merge-release-edit/specs/change-delivery/spec.md`
  holds the two MODIFIED blocks of the plan unchanged. Check:
  `grep -c "SHALL be read by the requirement" openspec/changes/forced-merge-release-edit/specs/change-delivery/spec.md`
  prints 0. `grep -c "and an owner's forced merge of that head read them as current" openspec/changes/forced-merge-release-edit/specs/change-delivery/spec.md`
  prints 1. `openspec validate forced-merge-release-edit --strict` passes.
- [ ] 1.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; covers
  AC-1, AC-2, AC-3, AC-4, AC-5 (T-1 to T-9 and the pinned rows of task 1.3) and AC-6 (task 1.6).

## Workflow follow-up

- `claude plugin validate .` and `python3 scripts/gen-catalog.py --check` before the review round (no
  manifest or catalog line is edited by hand; the delivery writes the release at the merge).
- A real forced merge on GitHub is not run here: the retro of the first real change force-merged
  after an `assign-release` step checks that its gate items hold no `evidence.md` or approved
  review behind only that step's commit.
- Archive the change after the review bench approves it; the archive ticks the roadmap line
  `forced-merge-release-edit`.
