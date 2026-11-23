<!-- devkit-stage review result=failed attempt=1 commit=52fb4faab60c31831cbeeb138b5e340f9df76392 -->

# Review: commit-attribution, round 1

Path: agents · range `c56155334749cdc46bad077ba8f53c4bbec5d140..52fb4faab60c31831cbeeb138b5e340f9df76392` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 52fb4fa |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 52fb4fa |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/core/agents/commit-and-pr.md (Attribution); openspec/changes/commit-attribution/proof/ac3-* — [6] The agent's behaviour was proved live only for the commit trailer. With the block giving a PR footer, with the block giving no footer, and with `none`, a wrong body or message would turn no test red. T27-T30 only check that the prose contains certain phrases. Failure: the agent ignores `none`, or appends its own footer to the PR body, and the suite stays green. Add the AC-3 proof for those cases as real-evidence items (a scratch-project commit with `none`, and a PR body or `gh pr create` dry-run with a footer line); do not add more string-includes tests.
- test-coverage-reviewer — [important] plugins/openspec/skills/ship-change/SKILL.md (Attribution); plugins/openspec/hooks/change-loop.mjs:511-513 — [5] The step where the session actually appends the block is covered only by prose checks (T16-T19, T33-T36 assert that sentences exist). Nothing observes a real dispatch whose prompt ends with the block. Hooks cannot see it, so the gap is that real-evidence item. Evidence: one loop run showing the Agent prompt for `commit` and for `open-pr` ending with the block. The proof folder holds only the isolated agent run.

## Refuted by verification
None.

## Notes
- Code quality first answered with the three test files in notRead; asked once to open them, it answered again with notRead empty and one more nit.

## Next
Fix the open findings, then run review-change again (round 2).
