# Review: conduct-sessions

Round 2 · Commit: e2ad4823e10fbce86c81484cf807a94b9d562e3b · Date: 2026-11-10

| Reviewer | Verdict | Blocking findings |
|---|---|---|
| code-quality-reviewer | PASS (round-1 important · fixed in e2ad482) | 0 |
| test-coverage-reviewer | PASS (round-1 important · fixed in e2ad482) | 0 |

Consensus: PASS (round 2/2). No new blocking or important findings in `5f0caeb..e2ad482` (one SKILL.md sentence, two tests). Nits carried over, no re-review.

## Next

Ready to ship: `pr-verifier`, then `commit-and-pr`.

---

## Round 1 (historical) · Commit: 5f0caebbe70e088a52e3cc90d96ca093c1160b58

Structural: PASS (`openspec validate conduct-sessions --strict` valid; `python3 scripts/check.py` all checks passed, links resolve)

| Reviewer | Verdict | Blocking findings |
|---|---|---|
| code-quality-reviewer | FAIL (rejected; 1 important open) | 0 blocking, 1 important |
| test-coverage-reviewer | FAIL (approved line, but 1 important open without rebuttal) | 0 blocking, 1 important |

Consensus: FAIL (round 1/2)

## Blockers

- code-quality-reviewer — plugins/openspec/skills/conduct/SKILL.md (Archive paragraph) — the archive rule names `session.name`, which exists only on a row whose `next.actor` is `session`; once the phase's gate is ticked the row has no descriptor for the finished phase. Fix: the name to archive is `<sessionPrefix><n>` with `n` the phase whose gate just ticked, as the Busy paragraph already defines it.
- test-coverage-reviewer — plugins/openspec/hooks/conduct-check.test.mjs ("sessions" block) — every descriptor test uses phase 1; a mis-derived `c.next.phase` would leave `name`, `title`, `session.phase` and the brief wrong for phase 2 with nothing red. Fix: a fixture with phase 1 ticked and phase 2 open under `appEnv`, asserting `session.name === 'a-p2'`, `session.phase === 2`, title and brief naming phase 2.

## Nits (no re-review)

- code-quality: 2-hex collision suffix (1/256 residual, left as designed D3); unquoted `cd ${worktree}` in `briefOf` (consistent with ship-change's preamble); names ≤ 24 chars only for phases 1-99 (out of scope per D3).
- test-coverage: the two-digit-phase assertion only concatenates in the test; the collision test recomputes the SHA-1 formula; skill-text pins check sentences, not flow (by design, dogfood after merge); `docs/openspec-flow.md` has no pin beyond the link check.

## Next

Fix the blockers (through `tdd-implementer`) and run review-change again at round 2, scoped to both reviewers.

Each reviewer's full findings are in `reviews/<reviewer>.md`.
