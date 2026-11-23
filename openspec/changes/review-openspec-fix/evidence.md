<!-- devkit-stage evidence result=passed attempt=2 commit=5ed6b3bcc9d7f30c6cd54e089a2576482ff26850 -->
Commit: 5ed6b3bcc9d7f30c6cd54e089a2576482ff26850

# Evidence

Change: `review-openspec-fix`. Verified on branch `review-openspec-fix`, clean tree, re-run at the merge of origin/main (release 0.26.1, devkit-openspec 0.22.1, devkit-core 0.10.1); run with TMPDIR=/var/tmp.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs` | pass: 677 tests, 677 pass, 0 fail (includes the deliver-check suite and tests 1 to 20) |
| 1.4 | `python3 scripts/check.py` | pass: all checks passed |
| 2.2 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1542 tests, 1542 pass, 0 fail |
| 2.2 | `python3 scripts/check.py` | pass: all checks passed |
| 2.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.2 | `command claude plugin validate .` | pass: Validation passed |

### Acceptance criteria

Proof: scratch-repository tests `review-openspec-fix 1` to `20` in `plugins/openspec/hooks/deliver-check.test.mjs` (1 to 18) and `plugins/openspec/hooks/flow-check.test.mjs` (19, 20), all passing in the two gate runs above. The unchanged-code run is saved in `openspec/changes/review-openspec-fix/proof/red.txt` (11 of the 20 fail there, 9 pass, as design D-3 expects).

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | A rejected review fixed by an `openspec/`-only commit gets `review` from `next`, naming the rejecting reviewer | tests 1, 5, 6, 7, 8, 9, 13, 14 (round 2, only the rejecting reviewer), 18 and 19 (check and readout); red in `proof/red.txt`, green in both gate runs | pass |
| AC-2 | A rejected review followed only by a commit of the review record still gets `fix-review` | tests 2, 3, 4 (reviews/, review.md, evidence.md alone), 15 (record committed twice), 20 (readout keeps the fix); pass both on unchanged and changed code | pass |
| AC-3 | Approved review after an `openspec/`-only commit stays current; a test-spared approved verdict after a test-only commit stays current | tests 10 and 11, green in both gate runs | pass |
| AC-4 | A reviewer still rejecting after round 2 stops on `stop-review-deadlock` | tests 16 (round-2 stop) and 17 (round 1 reopens after the stop), green in both gate runs | pass |

### Task checks

- `git grep -n "function reviewRecord\|function verdictAllowed\|const approved =" -- plugins ':!*.test.*'` prints three lines, all in `plugins/openspec/hooks/deliver-check.mjs`.
- Against the merge base with `origin/main` (no fetch), `deliver-check.test.mjs` and `flow-check.test.mjs` each have 0 deleted lines (218 and 38 added). The CI pin now reads `v0.22.1` after the merge.
- `git grep -c "v0.21.1" -- docs/openspec-flow.md` prints nothing (the docs pin `v0.22.1`).

No UI, API or deploy surface is touched; no screenshots apply.
