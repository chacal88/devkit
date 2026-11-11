# Review: release-rebase-pin

Round 1 · range `origin/main..66b6041` · structural: PASS (`openspec validate release-rebase-pin --strict` valid; `python3 scripts/check.py` all checks passed, in gate 2.9)

| Reviewer | Verdict | Blocking | Important (open) |
|---|---|---|---|
| adr-reviewer | approved | 0 | 0 |
| architecture-reviewer | approved | 0 | 0 |
| code-quality-reviewer | approved | 0 | 0 |
| test-coverage-reviewer | approved | 0 | 1 |

Consensus: FAIL (round 1/2): an `important` finding with no evidence-backed rebuttal counts as a fail whatever the verdict line says.

## Blockers
- test-coverage-reviewer — `plugins/openspec/hooks/release-rebase.test.mjs:440-520` / `plugins/openspec/hooks/release-rebase.mjs:270` — no test with two change commits that both touch `docs/openspec-flow.md`, so "resolved at every rebase stop" is not proven (a stale `pinMerged` or `baseVersion` at a second stop would stay green).

## Nits (no round)
- code-quality: `release-rebase.mjs:306-309` lists the pin file in `files` even when `setPins` changed nothing; `conduct-check.test.mjs:11` re-registers the release-rebase tests through the `pinDoc` import; `conduct-check.mjs:378-382` a comment on why a failed `git show` blocks.
- architecture: `threeVersions` duplicates the `git show` reader; the `devkit-reviews.yml` template of the openspec-setup skill is a second pin site the rule does not cover; the "never writes" comment of `conduct-check` now has the temp-folder exception (recorded).
- test-coverage: the beyond-pin conduct cases do not assert HEAD/worktree/temp folders untouched; an add/add (null `:1`) conflict is covered only at the unit level.
- adr: none beyond the temp folder note.

## Next
Fix the blocker through `tdd-implementer` (test first), commit, then round 2: `test-coverage-reviewer` only, with its previous verdict and the range `66b6041..HEAD`.

# Review: release-rebase-pin, round 2

Range `66b6041..af4055a` (one new test, review files) · structural: PASS (suite 588/588, `check.py` all checks passed on af4055a)

| Reviewer | Verdict | Blocking | Important (open) | Commit |
|---|---|---|---|---|
| adr-reviewer | approved (stale refresh) | 0 | 0 | af4055a |
| architecture-reviewer | approved (stale refresh) | 0 | 0 | af4055a |
| code-quality-reviewer | approved (stale refresh) | 0 | 0 | af4055a |
| test-coverage-reviewer | approved (round 2) | 0 | 0 | af4055a |

- test-coverage-reviewer — [important] no multi-stop test · fixed in af4055a (the reviewer confirmed two stops with `GIT_TRACE`: stop 1 kept the base's side of the three release files, stop 2 resolved only `docs/openspec-flow.md`).

Consensus: PASS (round 2/2). The nits listed in round 1 stay open as nits and go to the retro.

## Next
`pr-verifier` (evidence.md), then the PR.
