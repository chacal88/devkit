# Review: review-workflow

Round 1 · range `origin/main..4955dcf` · path: agents (the installed devkit-core 0.5.3 round; the new round ships with this change) · structural: PASS (`openspec validate review-workflow --strict` valid; `python3 scripts/check.py` all checks passed, in gate 2.8)

| Reviewer | Verdict | Blocking | Important (open) |
|---|---|---|---|
| adr-reviewer | approved | 0 | 0 |
| architecture-reviewer | approved | 0 | 1 |
| code-quality-reviewer | approved | 0 | 0 |
| security-reviewer | approved | 0 | 0 |
| test-coverage-reviewer | approved | 0 | 1 |

Consensus: FAIL (round 1/2): two `important` findings with no evidence-backed rebuttal.

## Blockers
- test-coverage-reviewer — `plugins/core/skills/review-change/scripts/review-round.workflow.js` (writer stage, near :329-333) / `review-round.test.mjs:428` — the script never compares a writer's returned `verdict` or `commit` with the computed outcome; a writer that writes `Verdict: approved` for a rejected outcome returns `written: true` and the round reports success. Only `check-file` would catch it, and the session's call to it is prose in `SKILL.md` matched by a text test.
- architecture-reviewer — `review-round.workflow.js:249,308` / `review-round.mjs:78` — the verifier count (3), the job construction, the vote grouping and the `>= 2` majority live outside the marked rules section, once in the script and once in the CLI; only the AC-5 parity test catches drift. Recommended: a `VERIFIERS` constant and a `verifyJobs` function in the rules section, with `>= 2` and `of N` derived from it.

## Nits (no round)
- code-quality: a fallback finding id can collide with a given one (`review-round.workflow.js:98`); `readStage1` swallows the validation message (`review-round.mjs:78`); a syntax error in the rules section reads "rules section not found" (`review-round.mjs:28`); after round 2 an approved verdict with an undisposed finding can cycle `fix-review`/`review`, since the deadlock stop counts only rejected reviewers (`deliver-check.mjs:1006`).
- test-coverage: the fallback rows are checked only by text matches; the harness assumes `parallel` never rejects (a dogfood item).
- security: the workflow path does not re-check the written file (same root as the test-coverage blocker); `finding-verifier` is not in the guard's role lists, so "writes no file" rests on its tool list.
- architecture: `finding-verifier` absent from `REVIEWERS` in `guard.mjs`; the "Staged round" paragraph copied in six agents; core's test runs only through openspec's `guard.test.mjs`.
- adr: the ADR 0001 Note wrapping; ADR 0008's Review trigger could cite ADR 0001's.

## Next
Fix both blockers through `tdd-implementer` (test first), commit, then round 2: `test-coverage-reviewer` and `architecture-reviewer` with their previous verdicts and the range `4955dcf..HEAD`; the three others refresh their stale verdicts (round 1).

# Review: review-workflow, round 2

Range `4955dcf..01ee296` · path: agents · structural: PASS (suite 648/648, `check.py` all checks passed on 01ee296)

| Reviewer | Verdict | Blocking | Important (open) | Commit |
|---|---|---|---|---|
| adr-reviewer | approved (stale refresh) | 0 | 0 | 01ee296 |
| architecture-reviewer | approved (round 2) | 0 | 0 | 01ee296 |
| code-quality-reviewer | approved (stale refresh) | 0 | 0 | 01ee296 |
| security-reviewer | approved (stale refresh) | 0 | 0 | 01ee296 |
| test-coverage-reviewer | approved (round 2) | 0 | 0 | 01ee296 |

- test-coverage-reviewer — [important] the workflow path never compared the writer's verdict/commit with the outcome · fixed in 01ee296 (`writeMismatch`, with tests for a wrong verdict and a wrong commit)
- architecture-reviewer — [important] verifier count, jobs, grouping and majority outside the rules section · fixed in 01ee296 (`VERIFIERS`, `MAJORITY`, `verifyJobs`, `groupVotes` in the rules section; a `VERIFIERS = 5` test)

Consensus: PASS (round 2/2). New nit: `meta.description` still says "three refuting verifiers" outside the rules section (code-quality). Nits go to the retro.

## Next
`pr-verifier` (evidence.md), then the PR.
