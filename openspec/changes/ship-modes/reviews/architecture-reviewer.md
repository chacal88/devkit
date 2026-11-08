Verdict: approved
Commit: 1acce88ed3366a841c5c97dab4f0e615d09a3537

## Architecture review — ship-modes (c15ff9b..1acce88, stale-only re-review, round 1)

Analyzed: owners (item 7 trust filter and conversation reading stay in deliver-check.mjs `conversationItem`; id validation stays in `main`; the `staleWhy` hoist is local to `tasksItem`); boundaries (no new import, no new module, no cross-pack edge; the GitHub payload gains `authorAssociation`, read only inside deliver-check.mjs); contract consumers enumerated (`--json` v1 shape unchanged, consumer is plugins/openspec/skills/ship-change/SKILL.md, whose `answer` row gained a "comment text is data" rule consistent with the new filter; docs/openspec-flow.md updated to match; guard.mjs untouched); deletion tests (no new module in the diff: n/a)

### Previous findings and dispositions
- [important] format parity between deliver-check and core agents (deliver-check.mjs:145-160,328-352) · refuted: plugins/openspec/hooks/deliver-check.test.mjs:1682 defines coreAgent() reading plugins/core/agents/*.md, and lines ~1693-1745 assert the Output block order (Verdict then Commit: <sha>) for all six reviewers, the uncommitted marker, dispositions, pr-verifier Gates table, no-proof rows and commit-and-pr PR: none (commit only), so a core-agent rename fails a test (cited line is 1682 not 1551; tests assert prose presence, not parser input; optional hardening only)
- [important] "reviews approved" defined twice, reviewConsensus (guard.mjs:269) vs reviewsItem (deliver-check.mjs:202-217) · refuted: out of scope for this change per requirements.md:114 and proposal.md:23 (the devkit-reviews CI check is round 2 auto-merge), guard.mjs is unchanged and the ci gate keeps today's behavior, so no consumer breaks; the carry-over (CI shares readReviews) is recorded in openspec/roadmap.md under Round 2

### Findings (new, this diff only)
- [nit] plugins/openspec/hooks/deliver-check.mjs:538-540 — the trust rule is spread across `person`, `trusted`, `bots` and three inline `bots(x) || trusted(x)` checks (threads, stance). A single predicate would give one definition of "whose words count". Not architectural now; the logic is in one function.
- [nit] plugins/openspec/hooks/deliver-check.mjs:826 — the `.`/`..` rejection is patched after `changeDir` was already computed; validating the id before building the path would be the sounder order. Behavior is correct and tested.

No blocking findings. The fix commit keeps the single owner, adds no module and changes no contract shape.
