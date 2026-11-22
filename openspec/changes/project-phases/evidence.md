<!-- devkit-stage evidence result=passed attempt=1 commit=d4d3448f4c04c9af87cd23cbb5ca7386aad3bad6 -->
Commit: d4d3448f4c04c9af87cd23cbb5ca7386aad3bad6

# Evidence: project-phases

Verified on branch `project-phases` at the commit above (tree clean). The conducting session ran the
13-minute suite on this exact tree; the short gates and checks below were re-run here and say so.

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop schema" --test-name-pattern="^flow-check" --test-name-pattern="install-schemas" --test-name-pattern="field-fixes 7" --test-name-pattern="^ship-entry" --test-name-pattern="instructions-follow" plugins/openspec/hooks/guard.test.mjs` | pass: reported green by the conducting session on this tree |
| 1.5 | `python3 scripts/check.py` | pass: all checks passed (re-run here, exit 0) |
| 2.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="reviews-check" --test-name-pattern="^flow-check" plugins/openspec/hooks/guard.test.mjs` | pass: reported green by the conducting session on this tree |
| 2.3 | `python3 scripts/check.py` | pass: all checks passed (re-run here, exit 0) |
| 3.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs` | pass: reported green by the conducting session on this tree |
| 3.4 | `python3 scripts/check.py` | pass: all checks passed (re-run here, exit 0) |
| 4.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop skill" plugins/openspec/hooks/guard.test.mjs` | pass: reported green by the conducting session on this tree |
| 4.4 | `python3 scripts/check.py` | pass: all checks passed (re-run here, exit 0) |
| 4.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run here) |
| 4.4 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-project-phases/phase-4.txt"` | pass: file holds `Validation passed` (checked here) |
| 5.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop scripted" plugins/openspec/hooks/guard.test.mjs` | pass: reported green by the conducting session on this tree; `^project-loop scripted` re-run here: 2 tests, 2 pass, 0 fail |
| 5.4 | `test -s openspec/changes/project-phases/proof/scripted-run.txt` | pass: file is non-empty (checked here) |
| 5.4 | `test -s openspec/changes/project-phases/proof/scripted-run-no-rounds.txt` | pass: file is non-empty (checked here) |
| 5.4 | `test -s openspec/changes/project-phases/proof/live-l1.txt` | pass: file is non-empty (checked here) |
| 5.4 | `test -s openspec/changes/project-phases/proof/live-l2.txt` | pass: file is non-empty (checked here) |
| 6.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1263 tests, 1263 pass, 0 fail (conducting session, same tree) |
| 6.8 | `python3 scripts/check.py` | pass: all checks passed (re-run here, exit 0) |
| 6.8 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run here) |
| 6.8 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-project-phases/phase-6.txt"` | pass: phase-6.txt holds `Validation passed` (checked here) |

Also re-run here: `openspec validate project-phases --strict` passes. `claude plugin validate .`
(bundled Claude Code 2.1.326, run by the conducting session) printed "Validation passed" in
`phase-4.txt` and `phase-6.txt`; both files were checked here.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `/devkit project <slice>` opens the slice in a worktree and resumes at the stopped stage | `project-loop scripted` tests (2/2 re-run here); `proof/scripted-run.txt`; live check `proof/live-l1.txt` (session 1 opened worktree and asked first question, session 2 resumed at domain model) | pass |
| AC-2 | `devkit-project` schema installed by `openspec-setup`; readout lists five stages with states | `project-loop schema`, `install-schemas` and readout tests inside the 1263-test suite; `proof/scripted-run.txt` | pass |
| AC-3 | Each phase writes its document under `docs/design/<slice>/`, ADRs to `docs/adr/`; passes only with explicit approval | `project-loop` phase-row tests in the suite; `proof/scripted-run.txt` (files and order). Conversation quality is the dogfood | pass |
| AC-4 | A not-applicable phase leaves its file with the reason; next stage ready | `project-loop` phase-row tests; `proof/scripted-run-no-rounds.txt` | pass |
| AC-5 | Roadmap proposed, written only after approval, appended; `/devkit roadmap` reads it | `project-loop` round tests and `roadmap-loop` tests in the suite; `proof/scripted-run.txt` | pass |
| AC-6 | Roadmap not applicable: reason recorded, `openspec/roadmap.md` unchanged | `proof/scripted-run-no-rounds.txt`; `project-loop scripted` tests (re-run here) | pass |
| AC-7 | One pull request with documents, ADRs and rounds; ADR review is the only review; auto-merge enabled | `project-loop` review/archive/pull-request tests and CI-rule tests in the suite; scripted run on a scratch repository in `proof/scripted-run.txt` | pass |
| AC-8 | Flat `docs/design/` files byte for byte unchanged | `project-loop` flat-layout tests in the suite; `proof/scripted-run.txt` | pass |
| AC-9 | Each `devkit-design` skill called alone asks for the slice, writes only under `docs/design/<slice>/`, no roadmap, no PR | skill text tests (`^change-loop skill`, `^roadmap-loop skill`, project-loop skill tests) in the suite; live check `proof/live-l2.txt` (asked for the slice, changed nothing) | pass |

Limits: the quality of each phase's conversation and the real GitHub auto-merge are the dogfood of the
next change (first real slice in a project); the live checks L1 and L2 cover only the session halves of
AC-1 and AC-9. No screenshots (no UI surface).
