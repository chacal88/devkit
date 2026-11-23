Verdict: rejected
Commit: 52fb4faab60c31831cbeeb138b5e340f9df76392

## Coverage analysis — commit-attribution (c561553..52fb4fa)

### Findings
- [important] plugins/core/agents/commit-and-pr.md (Attribution); openspec/changes/commit-attribution/proof/ac3-* — [6] The agent's behaviour was proved live only for the commit trailer. With the block giving a PR footer, with the block giving no footer, and with `none`, a wrong body or message would turn no test red. T27-T30 only check that the prose contains certain phrases. Failure: the agent ignores `none`, or appends its own footer to the PR body, and the suite stays green. Add the AC-3 proof for those cases as real-evidence items (a scratch-project commit with `none`, and a PR body or `gh pr create` dry-run with a footer line); do not add more string-includes tests.
- [important] plugins/openspec/skills/ship-change/SKILL.md (Attribution); plugins/openspec/hooks/change-loop.mjs:511-513 — [5] The step where the session actually appends the block is covered only by prose checks (T16-T19, T33-T36 assert that sentences exist). Nothing observes a real dispatch whose prompt ends with the block. Hooks cannot see it, so the gap is that real-evidence item. Evidence: one loop run showing the Agent prompt for `commit` and for `open-pr` ending with the block. The proof folder holds only the isolated agent run.
- [nit] plugins/openspec/hooks/change-loop.test.mjs (commit-attribution section, roadmap scenario) — The spec scenario 'A roadmap run hands the change loop's brief unchanged' has no test of its own. Only the devkit skill's roadmap `agent` line is checked (T18). The loop code is shared, so the risk is low.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs T27-T32, T36 — These tests assert exact prose substrings of the agent and skill Markdown. A harmless rewording turns them red, and a semantic regression with the words kept stays green. They are acceptable as a drift guard against the shared block format (T20 is the better one), but they are not behaviour tests.
- [praise] plugins/openspec/hooks/change-loop.test.mjs T1-T15, project-loop.test.mjs T21-T25 — The seam is tested end to end through `build` and `act`, not through the helper alone. Every commit step (`commit`, `open-pr`, `push`, `open-archive-pr`, `push-rebased`) is checked, and the request appears exactly once. The negative cases are covered: other agents, a row that names another agent, and the ADR reviewer. T15 checks the request names no model line.

In-scope surfaces: plugins/openspec hooks (change-loop, project-loop), plugins/core agent commit-and-pr, skills devkit and ship-change.
Blocking gaps (8-10 without a plan): 0
Seams checked:
- change-loop `agent()` seam -> `withAttribution`: caught by T1-T5 (the `commit`, `open-pr`, `push`, `open-archive-pr` and `push-rebased` hand-offs end with the request exactly once) and by the generic brief test.
- project-loop `agent()` seam: caught by T21-T24; the ADR reviewer is checked negatively by T25.
- Another agent named by the row: caught by T11.
- Agent identity string used in both loops: caught by T1-T5, which assert `a.agent === COMMIT`. The duplicate constant in conduct-check cannot drift without a red test.
- Block format shared by the request, the ship-change skill and the agent: caught by T20.
- Session appends the block, and the agent honours it: gap, see F1 and F2. Prompt-level, cross-process, not unit-testable. Only the commit-trailer case has live proof.
(mutation runs: 0)

### Well covered
- The loop's brief ends with the attribution request, once and only for the commit agent: T1-T15, T21-T25.
- The request holds no model name, e-mail address or footer text: T15.
