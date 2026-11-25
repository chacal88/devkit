<!-- devkit-stage retro result=passed attempt=1 commit=071bb74fd22d55d6f258048c29f4fbfd4ea5da51 -->
# Retro: stage-ceiling-consecutive

Change PR: https://github.com/chacal88/devkit/pull/113, boarded at `071bb74` and merged with train 9 (PR #129, merge commit `c09860c`) on 2026-11-24.

## Retro: stage-ceiling-consecutive

1. Went wrong:
   - AC-8 (`roadmap-ticks-both`) was first written as an archive-time criterion: "at archive both `stage-ceiling-consecutive` and `evidence-attempts-by-failure` are ticked in `openspec/roadmap.md`". The plan passed the grill, three readiness rounds and the owner's approval with it. The evidence (attempts 1 and 2, `e7494d1` and `849d5c7`) could only record it as `no proof: the ticks happen at archive`. `deliver-check` item 4 then reads `blocked` (`acceptanceItem`, "no proof for AC-8 (the owner weighs it)"), and a change is boardable only when items 1 to 4 are met (`deliver-check.mjs`, `boardable`). Review round 2 passed at 10:06, but the PR could not board. AC-8 had to be reworded to what is true before archive (`96f7a76`). That took a fourth readiness round (`ee5c9bc`), a second owner approval (`733ee8c`), and new evidence and review takes. Trains 2 to 4 left while this went on.
   - The fix itself was right first time. Phases 1 to 3 were green, and the 13 real runs (P-1 to P-13 in `proof/real-run.txt`) matched D-8. Review round 1 found one important gap: `project-loop.mjs` passes `failures` beside `attempt`, but the only test (S12) had `attempt == failures`, so dropping the param left every test green. Round 2 fixed it with tests only. The bench worked as intended. One case, so no new rule.
   - The branch merged `origin/main` four times during delivery (`62f2ed0`, `c7367ab`, `451dcfe`, `709070d`) while other changes landed (the suite-speed split of the test files, then trains 1 to 6). Each merge renumbered the release, and the last three were followed by fresh evidence and review takes. The delivery spanned trains 1 to 9. The cost on this machine is the one the existing memory `avell-remerge-cost` already describes.
   - The `pr-verifier`'s first evidence take ran about 33 minutes (`a2de7d5` 09:10 to `e7494d1` 09:43), on filtered whole-file runs at concurrency 1 on a loaded machine (change-loop and change-loop-compozy alone are about 4 minutes each). This is environment, and the existing memories already cover it.
2. Better next time:
   - Write every acceptance criterion so it can be proven before the change's pull request merges. Work that only happens at archive (roadmap ticks, closing a fused line's worktree) goes in `tasks.md`'s `## Workflow follow-up`, as the tasks schema already says for tasks. The criterion can then say that the follow-up names it.
   - The readiness review should treat such a criterion as Mandatory, because it will block the delivery contract no matter how good the code is.3. Remember: an acceptance criterion only the archive can prove reads `no proof` and keeps the PR off the train; archive work belongs in the workflow follow-up.

Note for the coordinator: the roadmap line `post-merge-validate` (`openspec/roadmap.md`, "counting an evidence attempt that a base merge made stale or red moved to `evidence-attempts-by-failure`") can now say that this count was delivered by `stage-ceiling-consecutive`. A take retaken after a merge is not counted. A red caused by the merge itself stays on `post-merge-validate`'s merge-defect path, and this change did not touch it. At archive, both roadmap lines are ticked (`tasks.md`, `## Workflow follow-up`), and the `evidence-attempts-by-failure` worktree and session are closed without a change of their own.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | An acceptance criterion must be provable before the PR merges; archive work goes in the workflow follow-up, and readiness flags a criterion that only the archive can prove | doc-gap | doc-update | project |
| 2 | A plan-time check could catch a criterion worded for the archive before readiness and approval spend a round on it | tooling | followup | project |
| 3 | Repeated merges of a busy main each cost an evidence and review take on this machine (already in memory `avell-remerge-cost`; no new proposal) | environment | memory-only | user |

## Proposed updates

### `plugins/core/skills/requirements-grill/SKILL.md`, `plugins/core/skills/plan-readiness-review/SKILL.md` (doc-gap)
The grill never writes a criterion that only the archive or a later step can prove, and the readiness review flags one as Mandatory. Neither line is asserted by a test (`grep` over the test files finds neither text). Applying this is a devkit-core patch release (version bump, CHANGELOG, catalog), as `CONTRIBUTING.md` requires.
- before: `- Write an acceptance criterion with no observable effect (\`success: true\`).` (requirements-grill, `## Never`)
+ after: `- Write an acceptance criterion with no observable effect (\`success: true\`), or one that only the archive or a later step can prove ("at archive both lines are ticked"): every criterion is provable before the change's pull request merges, and archive work goes in the plan's \`## Workflow follow-up\`.` (requirements-grill, `## Never`)
- before: `... small enough to map to issues; dependencies explicit or obvious; acceptance criteria specific and testable; no decision hidden behind ...` (plan-readiness-review, `### 7. Review the tasks`)
+ after: `... small enough to map to issues; dependencies explicit or obvious; acceptance criteria specific and testable before the change's pull request merges (a criterion that only the archive or a later step can prove reads \`no proof\` in the evidence and blocks the delivery contract, so it is a Mandatory finding: the work moves to the \`## Workflow follow-up\` of tasks.md); no decision hidden behind ...` (plan-readiness-review, `### 7. Review the tasks`)
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
A follow-up line for a mechanical check, so the next archive-worded criterion is caught when the plan is written, not at the evidence. It is based on one case. The owner may prefer to wait for a second case after the skill text of the proposal above.
- before: `## Round 27: debts` followed by `- [ ] lean-pr-template — ...`
+ after: `## Round 27: debts`, then `- [ ] lean-pr-template — ...`, then `- [ ] ac-provable-before-merge — a plan-time check (its home settled in the grill: the readiness stage of \`flow-check.mjs\` or a check the readiness reviewer runs) that flags an acceptance criterion in \`requirements.md\` or \`proposal.md\` whose text ties it to the archive or a later step ("at archive", "after the archive", "when archived"), since \`deliver-check\` item 4 can only read it as \`no proof\` and keeps the PR off the train (stage-ceiling-consecutive retro, item 2: AC-8 cost a fourth readiness round, a second approval and new evidence and review takes)`
- Answer: rejected: the owner left this one to the session ("o que voce achar melhor"); proposal 1 puts the rule where the criterion is written, so wait for a second case before adding a mechanical check
