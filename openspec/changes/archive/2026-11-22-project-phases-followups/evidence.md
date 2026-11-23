<!-- devkit-stage evidence result=passed attempt=1 commit=a8b07da19dc34051fb7a6acf29c688d7a2b8f088 -->
Commit: a8b07da19dc34051fb7a6acf29c688d7a2b8f088

# Evidence

Change: `project-phases-followups` · Surfaces: hooks and docs of devkit-openspec only (no UI, API or
deploy surface; no screenshots apply).

## Verification

### Gates

Task 1.5 parts were run at this commit; the 2.4 parts come from the whole-suite run on this exact
tree just before commit a8b07da (log `/var/tmp/ppf-gate2.log`: 1397 tests, 1397 pass, 0 fail,
`Validation passed`, exit 0). The whole guard suite was not re-run; the focused runs below were.

| Gate | Command | Result |
|---|---|---|
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/project-loop.test.mjs` | pass: 134 tests, 134 pass, 0 fail (re-run at this commit) |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern=change-loop.replies plugins/openspec/hooks/change-loop.test.mjs` | pass: 4 tests, 4 pass, 0 fail (re-run at this commit) |
| 1.5 | `python3 scripts/check.py` | pass: all checks passed (re-run at this commit) |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1397 tests, 1397 pass, 0 fail (whole run on this tree, /var/tmp/ppf-gate2.log) |
| 2.4 | `python3 scripts/check.py` | pass: all checks passed (re-run at this commit; also in the whole run) |
| 2.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at this commit) |
| 2.4 | `command claude plugin validate .` | pass: Validation passed, exit 0 (whole run, /var/tmp/ppf-gate2.log) |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | commit-does-not-resolve | Test `project-loop ci: followups 1` passes in the 134-test project-loop run (`/var/tmp/ppf-v-pl.log`) | pass |
| AC-2 | record-header-missing-or-malformed | Tests `followups 2` (no header) and `followups 3` (malformed header) pass in the same run | pass |
| AC-3 | no-base-ref | Tests `followups 4` (direct `sliceProblems` call, no base ref, not thrown) and `followups 5` (`gh pr create` hook, default branch with no shared history) pass in the same run | pass |
| AC-4 | uncommitted-verdict-refused | Tests `followups 6` (CI entries), `7` (`gh pr create` hook), `8` (`record-review` refuses, no `review.md`) and `9` (`next` hands back to the ADR reviewer, active and archived) pass; `change-loop replies` 4/4 pass (new `why.uncommitted` key rendered in both languages) | pass |
| AC-5 | merge-bringing-adr-is-stale | Test `followups 10` passes beside the existing unrelated-product-commit merge test (whole project-loop run green); the comment above `sliceReviewStale` in `plugins/openspec/hooks/guard.mjs` (lines 194 to 198) says why a merge bringing an ADR file counts | pass |
| AC-6 | adr-renumbering-note | `git grep -c "shipped as ADR 0015"` over the archived `project-phases` folder prints 1 for each of `proposal.md`, `design.md`, `tasks.md`; `python3 scripts/check.py` passes | pass |
| AC-7 | dogfood-roadmap-line | `openspec/roadmap.md` line 104 is `project-slice-dogfood (after: project-phases-followups)`; it is the only line matching `dogfood`; the `project-phases-followups` line (103) does not name it | pass |
| AC-8 | suite-green | Whole guard suite 1397/1397, `check.py`, `gen-catalog.py --check` and `claude plugin validate .` all green (see Gates) | pass |

Additional checks at this commit: `git grep -n 0014 -- plugins/openspec/README.md` prints nothing;
`git grep -c "v0.21.1" -- docs/openspec-flow.md` prints nothing; plugin.json and `CHANGELOG.md`
carry 0.21.2. Red-first proof is kept in `openspec/changes/project-phases-followups/proof/red.txt`.
The tree was clean (`git status --short` empty) before this file was written.

Outcome: verified.
