Verdict: approved
Commit: 16eee42c701ec79197e5af5aa57cad84867e9a95

## Coverage analysis — commit-attribution (re-review, 52fb4fa..16eee42)

### Findings
- [important] plugins/core/agents/commit-and-pr.md (Attribution); proof/ac3-none-*, proof/ac3-pr-* — Agent behaviour with `none` and with a PR footer had no real-run proof; only string-includes tests existed. · fixed in 16eee42c701ec79197e5af5aa57cad84867e9a95
- [important] plugins/openspec/skills/ship-change/SKILL.md; plugins/openspec/hooks/change-loop.mjs:511-513 — No observation that a real dispatch prompt for `commit` and `open-pr` ends with the block. · fixed in 16eee42c701ec79197e5af5aa57cad84867e9a95
- [nit] plugins/openspec/hooks/change-loop.test.mjs (roadmap scenario) — The 'roadmap run hands the brief unchanged' scenario still has no test of its own; the loop code is shared, so the risk is low.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs T27-T32, T36 — These tests assert exact prose substrings of Markdown files, so a harmless rewording turns them red. They work as a drift guard, not as behaviour tests.
- [praise] plugins/openspec/hooks/change-loop.test.mjs T1-T15, project-loop.test.mjs T21-T25 — The seam is tested end to end through build and act. Every commit step is checked, the request appears exactly once, and the negative cases are covered.
- [nit] openspec/changes/commit-attribution/evidence.md — The evidence file is stamped at 52fb4fa and does not list the new AC-3 proof files (none, PR, loop). They are described in proof/ac3-checks.txt, so the gap is only in the evidence table.

In-scope surfaces: plugins/openspec hooks (change-loop, project-loop), plugins/core agent commit-and-pr, skills devkit and ship-change, and the proof folder of the change.
Blocking gaps (8-10 without a plan): 0

Seams checked:
- Agent honours `none`: caught by proof/ac3-none-message.txt, a real run whose commit message holds 0 `Co-Authored-By` lines (confirmed by grep).
- Agent writes the PR footer once and no extra attribution: caught by proof/ac3-pr-message.txt and proof/ac3-pr-gh-record.txt. The message ends with the Opus trailer once and has 0 Sonnet mentions. The `gh pr create` body, recorded from a fake `gh`, ends with exactly the footer line.
- Session appends the block to the real Agent prompt: caught by proof/ac3-loop-extract.txt, which shows two Agent calls to devkit-core:commit-and-pr with `prompt ends with the block: True`. The conducting session ran on Opus, the agent is Sonnet, and the commits carry the Opus trailer (proof/ac3-loop-messages.txt). The PR body ends with the footer once (proof/ac3-loop-gh-record.txt).
- change-loop and project-loop `agent()` seam: still caught by T1-T5 and T21-T25 (unchanged since round 1).
- No new test strings were added in this round, in line with the round-1 advice. (mutation runs: 0)

Reading note: the proof is saved transcripts, not re-run by me. Each file has a one-line PASS check in proof/ac3-checks.txt, and I confirmed those checks by reading the files.

### Well covered
- The loop's brief ends with the attribution request, once and only for the commit agent: T1-T15, T21-T25.
- The agent honours `none`, a trailer plus PR footer, and a trailer only, each with a real-run artifact.
- A real dispatch carries the block end to end (loop action, Agent prompt, commit message, PR body).
