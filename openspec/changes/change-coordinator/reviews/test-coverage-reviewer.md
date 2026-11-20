Verdict: rejected
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## Coverage analysis — change-coordinator (origin/main...HEAD, round 1)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:888,927 — [7] subagentStopDecision and agentDecision find the change through locate(); no lock test puts the change in a worktree while cwd is the main checkout (the topology open creates). Mutation run: both locate calls replaced by the start root, and all 36 'change-loop lock' tests stayed green. Add a worktree case to the lock subagent-stop and lock agent blocks in change-loop.test.mjs.
- [important] plugins/openspec/hooks/change-loop.mjs:761-765 — [6] The rollback of openChange (worktree and branch removed when openspec new change or the template step fails) has no test; a broken rollback would leave a half-made change that makes the retry answer name-taken. Write it in change-loop.test.mjs, change-loop open: block, with a fake openspec runner and a snapshot().
- [nit] plugins/openspec/hooks/guard.mjs runOf — [3] The toolUseResult.stdout fallback and the array form of tool_result content are never exercised alone: the runLine fixture carries both, so removing either leaves the suite green.
- [nit] plugins/openspec/hooks/change-loop.mjs:852 — [2] hasTasks: the object form of background_tasks is untested (T2 uses an array).

Verdict: approved
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

In-scope surfaces: plugins/openspec/hooks (change-loop, guard, hooks.json, flow-check and conduct-check exports), plugins/openspec/skills/devkit, plugins/core agents and review-round text test, plugins/panel/hooks (conducted, commands, i18n), docs and settings text tests.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 1): transcript to runOf to run lock (caught by the lock run tests); guard stop, subagent-stop and agent as subprocesses to exit 2 and reason (caught by T1-T7, U1-U7, H1-H5); refuse-once record per session and per agent (T6, U6); edit and Bash lock on product code, main session only (lock edit); bypass and opt-in (bypass test); loop to agent or session hand-off (decide K1, K2, B rows); panel /devkit change forms, buttons and fill text (report.test.tsx, panel.test.tsx); locks finding a change that lives in a worktree while cwd is the main checkout (GAP F1, mutation survived); openChange rollback (GAP F2).

Well covered: stop lock refuses once with the language from CLAUDE_PLUGIN_OPTION_LANGUAGE and the recorded key equal to next's progressKey (T5, T6); fail-open on every error (T7, U7, H5); per-script role list for the hand-off lock (H3, H4); run-lock negatives (readiness.md stays the reviewer's, subagents keep the existing rules); the decision log; open's name-taken reasons one by one with a snapshot of nothing created; heredoc injection test (S11); wait with no limit and three failed reads in a row as blocked (W1-W9); the conduct skill's invariants re-pinned in change-loop skill text tests after about 200 lines of conduct tests were deleted; the panel keeps reading the old /conduct forms and the new test proves free text names no id.

Files read: plugins/openspec/hooks/change-loop.mjs; plugins/openspec/hooks/change-loop.test.mjs (test list, parts of 175-1340, 1336-1775 whole); diffs of plugins/openspec/hooks/guard.mjs, hooks.json, guard.test.mjs, flow-check.mjs, flow-check.test.mjs, conduct-check.mjs, deliver-check.test.mjs; plugins/core/skills/review-change/scripts/review-round.test.mjs; plugins/panel/hooks/conducted.ts, commands.ts, i18n.ts, project.ts, panel.test.tsx, report.test.tsx; openspec/changes/change-coordinator/evidence.md (live-run lines). Not opened: docs, the ADR, agent frontmatter diffs, spec deltas and the skill file, apart from what the text tests assert about them. The working tree is clean; the scratch copy for the mutation is under the session scratchpad (mut1), outside the repository.
