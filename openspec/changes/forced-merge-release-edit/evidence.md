<!-- devkit-stage evidence result=passed attempt=1 commit=8343b78fccf44c5106fe896cd59525f86a978797 -->
Commit: 8343b78fccf44c5106fe896cd59525f86a978797

# Evidence

Change: `forced-merge-release-edit` · Verified on the branch `forced-merge-release-edit` at the merge
of `origin/main` (clean tree apart from the `proof/` folder this run wrote).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 | `node scripts/test-suite.mjs --own-files` | pass: selective run, not a whole-suite pass. 30 `selected` lines, every file `pass`, none `FAIL` or `LEFT`. `suite: 30 files, 3647 tests, 3647 pass, 0 fail, 3072.5s, concurrency 5` (run with `--concurrency=5`, `TMPDIR=/var/tmp/devkit-suite`, under a machine load of 25 to 100). Lines kept in `openspec/changes/forced-merge-release-edit/proof/own-files-run.txt` |
| 1.7 | `python3 scripts/check.py` | train: proven by the train record (the change does not touch the `devkit.delivery.train` key). A local run also exited 0: `all checks passed` (`proof/check-py.txt`) |

Other checks run: `openspec validate forced-merge-release-edit --strict` exit 0;
`python3 scripts/gen-catalog.py --check` exit 0; `claude plugin validate .` could not run here:
`claude:5: permission denied` (no proof: the environment refuses the claude binary).

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `release-only-compare-opens-no-gate`: a noted change behind only the assign-release step's commit lists no `evidence.md` and no approved review in `forcedMerge` | `node --test --test-name-pattern="^forced-merge-release-edit " plugins/openspec/hooks/deliver-check-archive.test.mjs`: the two `AC-1` tests (no gate opened; the compare's `base_commit` sha is the recorded side's ref) pass. Also in the own-files run (`deliver-check-archive.test.mjs: pass`) | pass |
| AC-2 | the step's commit that also edits a sentence of `docs/openspec-flow.md` opens the evidence and each approved review, naming that file | test `forced-merge-release-edit AC-2 ...` passes | pass |
| AC-3 | a later product commit (`plugins/x.mjs`) opens the evidence, naming that file | test `forced-merge-release-edit AC-3 ...` passes | pass |
| AC-4 | no note, no config, no `release_tag`: same items as before | the two `AC-4` tests pass (also the compare of only `openspec/` files reads no release note) | pass |
| AC-5 | a `REJECTED` review and an approved review with an undisposed finding stay open | test `forced-merge-release-edit AC-5 ...` passes | pass |
| AC-6 | the spec no longer states the forced-merge sentence; the scenario says the forced merge reads the records as current; `openspec validate --strict` passes | the delta holds 0 matches of `SHALL be read by the requirement` and 1 of `and an owner's forced merge of that head read them as current`; `openspec/specs/change-delivery/spec.md` still holds the old sentence until the archive applies the delta (0 matches of its full text with the current wording); `openspec validate forced-merge-release-edit --strict` exits 0 | pass |
| AC-blocked | a failed read of a file the comparison needs is `blocked`, quoting the error (proposal "What Changes") | the two `forced-merge-release-edit blocked ...` tests pass (failed or empty release comparison ends `gatesAtHead` with the error; from the default branch it blocks naming pull request 12 and never forces) | pass |

Nine `forced-merge-release-edit ` tests ran and passed (`node --test`, 9 lines `✔`).
