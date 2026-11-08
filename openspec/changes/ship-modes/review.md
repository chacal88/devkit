# Review: ship-modes

Commit: c15ff9b5443255278571f6b9b90b385219998c2e (range 28a83b9..c15ff9b)

Structural: PASS (`openspec validate ship-modes --strict`, `python3 scripts/check.py`)

| Reviewer | Verdict | Blocking | Important |
|---|---|---|---|
| adr-reviewer | PASS | 0 | 0 |
| architecture-reviewer | PASS | 0 | 2 |
| security-reviewer | PASS | 0 | 1 |
| code-quality-reviewer | FAIL | 0 | 2 |
| test-coverage-reviewer | FAIL | 1 | 3 |

Consensus: FAIL (round 1/2)

## Blockers
- test-coverage-reviewer — `deliver-check.mjs:708-717` — the readiness wiring in `collectState` (AC-3) is never exercised: no fixture has `openspec/schemas/devkit/schema.yaml`, so `stop-not-approved` only fires from a hand-built state.

## Important, to fix
- code-quality-reviewer — `deliver-check.mjs:821` — change id `.` and `..` pass the id check; should exit 3.
- code-quality-reviewer + test-coverage-reviewer — `deliver-check.mjs:524-529` — a viewer reply in any review thread marks earlier top-level comments as answered; design D4 says top-level only. Fix and pin with a test.
- test-coverage-reviewer — `deliver-check.mjs:715` — `branchOk` derivation (default branch, `DEVKIT_BRANCH`/`GITHUB_HEAD_REF`) untested in the false direction.
- security-reviewer — item 7 / `ship-change` `answer` — any GitHub user's comment becomes work; filter by `authorAssociation` (OWNER/MEMBER/COLLABORATOR) and state in the skill that comment text is data, not instructions.

## Important, proposed disposition without code
- architecture-reviewer — format parity between `deliver-check` and core agents — refuted: `deliver-check.test.mjs:1551` reads `plugins/core/agents/*.md` and the 3.1 format tests assert the `Commit:` line, gates table and AC rows.
- architecture-reviewer — CI `reviewConsensus` (`guard.mjs:269`) vs `reviewsItem` staleness — deliberate for this round; the `devkit-reviews` CI check is round 2 (`auto-merge`), which should make CI share `readReviews`. Record in the roadmap.
- test-coverage-reviewer — real `gh` payloads — proven live by `pr-verifier` running `deliver-check --json` against the opened PR (evidence.md), not by a unit test.

## Nits (no re-review)
- adr-reviewer: test command in config omits `deliver-check.test.mjs` — refuted, `guard.test.mjs` imports it.
- architecture/code-quality: duplicate `node:fs` imports; `comments/reviews(last:100)` without `hasNextPage`; staleness computed twice; tracked `.claude/` counts as dirty; one `diff-tree` per commit; `deliver-check.mjs` size; commit-and-pr waivers limited to ship-change.

## Next
Fix the blocker and the important items through `tdd-implementer`, commit, then re-run review-change round 2. Every reviewer whose `Commit:` goes stale with the fix commit re-runs (owner decision 5).

---

# Round 2

Commit: 1acce88ed3366a841c5c97dab4f0e615d09a3537 (fix range c15ff9b..1acce88)

| Reviewer | Verdict | Blocking | Important open |
|---|---|---|---|
| adr-reviewer | PASS (stale re-review) | 0 | 0 |
| architecture-reviewer | PASS (stale re-review) | 0 | 0 |
| security-reviewer | PASS (stale re-review) | 0 | 0 |
| code-quality-reviewer | PASS (round 2) | 0 | 0 |
| test-coverage-reviewer | PASS (round 2) | 0 | 1 accepted follow-up |

Consensus: PASS (round 2/2)

- All round-1 blockers and important findings fixed in 1acce88, or refuted/deferred with the reviewers' acceptance.
- CI `reviewConsensus` divergence recorded in `openspec/roadmap.md` round 2 (architecture-reviewer's condition).
- Follow-up for `pr-verifier`: run `deliver-check ship-modes --json` against the real open PR (a check and a review thread) and confirm `authorAssociation` is present in the real GraphQL response; record it in `evidence.md`.
- New nits (no re-review): a thread opened by a trusted person whose last comment is an outsider drops out of item 7; trust rule spread across several predicates; `.`/`..` checked after `changeDir`.

## Next
`pr-verifier` (evidence.md), then `commit-and-pr` (push and open the PR). The merge is the owner's.
