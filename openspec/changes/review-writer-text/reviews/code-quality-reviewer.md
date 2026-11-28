Verdict: approved
Commit: be9ccb8ac5b4a37c72fb45c8e8a04b2db20a014c

## Quality review - review-writer-text (round 1)

### Findings
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:297 — withoutSummary is fence-aware and level-aware, so a Summary heading inside a code fence is kept and the section ends at the next heading of the same or a higher level. It is exported through the NAMES list and pinned by tests (110 pass).
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js:332 — summaryLine lists nit findings under `open:` because their status is 'open', although the verdict is approved. A reader may take `open: F2` next to an approved verdict as a blocker. Say in the SKILL.md wording that `open` includes unverified nits, or list only blocking and important ids.
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js:339 — The line prints '1 findings' for a count of one. The wording is pinned verbatim in SKILL.md and the evidence, so changing it is optional and means touching every copy.

### Summary
- 3 findings (0 blocking, 0 important, 2 nit) + 1 praise
- Justification: the diff removes the 400-character cap on dispositions and verifier evidence (`oneLine(..., Infinity)`) and adds `withoutSummary` and `summaryLine`. The writer prompt now carries both, and the new rules are exported through `review-round.mjs`. SKILL.md and `docs/openspec-flow.md` describe the same behaviour, so the copies agree. I traced `summaryLine` against `outcomeOf`: a refuted finding is counted under refuted, a finding with `fixed in` under fixed, and the others under open. A finding that already carried a `refuted:` disposition is also counted under refuted, through the regex. Praise is counted apart and never listed. The fence handling in `withoutSummary` builds a valid regex. No edge case turned up that would change the verdict.
