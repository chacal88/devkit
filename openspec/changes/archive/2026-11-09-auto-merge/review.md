# Review: auto-merge

Commit reviewed: 55722bf6a30ec7d49ebea78efb3187222f1d0ca5 (origin/main..HEAD)

Structural: PASS (`openspec validate auto-merge --strict`, `python3 scripts/check.py`)

| Reviewer | Verdict | Blocking | Important (open) |
|---|---|---|---|
| adr-reviewer | PASS | 0 | 0 |
| architecture-reviewer | PASS (verdict) | 0 | 1 |
| security-reviewer | PASS (verdict) | 0 | 1 |
| code-quality-reviewer | FAIL | 0 | 4 |
| test-coverage-reviewer | PASS (verdict) | 0 | 2 |

Consensus: FAIL (round 1/2). No blocking finding; the round fails on `important` findings
without an evidence-backed rebuttal.

## Findings to fix

- code-quality-reviewer — deliver-check.mjs:42-52, :921-933; github-setup.mjs:39-42 — no
  timeout on `gh` calls; one stalled call outruns the capped merge wait.
- code-quality-reviewer — deliver-check.mjs:1086-1097 — `nextStep` computed twice in the
  `--watch` branches.
- code-quality-reviewer — github-setup.mjs:71 — `check-runs` read without pagination; repos
  with more than 30 checks get a weaker ruleset silently.
- architecture-reviewer — github-setup.mjs:39-43 — the `gh` runner and error formatter exist
  three times; move them into merge-setup.mjs.
- security-reviewer — templates/devkit-reviews.yml — the merge gate downloads scripts by
  mutable tag with no checksum.
- test-coverage-reviewer — deliver-check.mjs:813 — `merge_method` → preflight wire untested
  through the collector.
- test-coverage-reviewer — items 6, 7, 8 in merge mode tested only from hand-built state.

## To refute

- code-quality-reviewer — no `evidence.md` yet: the plan orders evidence after the reviews
  (tasks.md "Workflow follow-up", design D11); `pr-verifier` writes it next.

## Nits (no round)

- ADR 0002 could say it builds on ADR 0001 (adr-reviewer).
- design.md D5 still says `--ci` without `openspec/` exits 3; the code passes with a note
  (architecture-reviewer, code-quality-reviewer).
- Accepted guard.mjs ↔ deliver-check.mjs import cycle could be recorded in design.md.
- Branch name not URL-encoded in merge-setup.mjs:49.
- Tag `v0.5.0` must exist before a consumer adopts the template (owner, R-10).
- R-7 test and row 0a fixture are hand-built; `noMergeCall` asserts cannot go red.

## Next

Fix the findings above (tdd-implementer), then round 2 re-summons only the reviewers with
open findings: code-quality, architecture, security, test-coverage.

---

# Round 2

Commit reviewed: cba2f4484a9452a95615ee6eba015bb21ecc1f98 (55722bf..cba2f44)

| Reviewer | Verdict | Blocking | Important (open) |
|---|---|---|---|
| adr-reviewer (stale only) | PASS | 0 | 0 |
| architecture-reviewer | PASS | 0 | 0 (1 fixed) |
| security-reviewer | PASS | 0 | 0 (1 fixed) |
| code-quality-reviewer | PASS | 0 | 0 (3 fixed, 1 refuted) |
| test-coverage-reviewer | PASS | 0 | 0 (2 fixed) |

Consensus: PASS (round 2/2). `deliver-check --ci auto-merge`: item 2 met (5 reviews at head),
item 3 met (7 fixed, 1 refuted). The adr-reviewer's broken link is fixed; `check.py` passes.

Nits left for later (no round): branch name with a slash not asserted; `waitForMerge` stall
with time left untested; R-7 and row 0a fixtures hand-built; `noMergeCall` asserts cannot go
red; `export { makeGh }` between imports; `runGh` builds a runner per call.

## Next

`pr-verifier` writes evidence.md (AC-10 recorded as `no proof: dogfood runs after the PR
opens`), then `commit-and-pr` opens the PR, then phase 5 in the main session.
