Verdict: approved
Commit: e05787469f3a59a3de0a574a325a230566707b5e

## Coverage analysis — stage-models (19c0196..HEAD)

### Findings
- [nit] plugins/openspec/hooks/flow-check.mjs capOf (spend block cap) — [4] The change's own .openspec.yaml budget winning over the project's, and an invalid value showing no cap, is asserted by no test; the spend tests set the cap only in the project file, so reading the project's file only would stay green. Write in stage-models.test.mjs beside the AC-12 flow-check test, with spendRoot plus a change-level .openspec.yaml.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:851 — [4] The /devkit status spend block in a project with no roadmap file (the hasRoadmap === false branch) and for a change in another worktree root is untested; replacing the branch with [] leaves the suite green. Write in stage-models.test.mjs beside the AC-12 roadmap status test, without roadmap.md.
- [nit] plugins/openspec/hooks/stage-models.test.mjs AC-9 / AC-5 / AC-7 skill and source tests — Implementation-coupled: a grep of change-loop.mjs source for session-model names and exact skill-prose regexes go red on a comment or a reworded sentence while the contract holds; spec-mandated, so keep, but expect noise on legitimate rewording.
- [praise] stage-models.test.mjs AC-10 retry tests — The retry chain is tested on real subagent transcript files: failure count, window from the newest typed /devkit, same brief and progress key, and the no-progress end it replaces, with real-run proof in the proof folder.
- [praise] stage-models.test.mjs AC-7 step-down tests — stepDownOf is checked as a pure function and through next and the run file, including the default-table never-haiku invariant and the refused-switch memory.

In-scope surfaces: plugins/openspec/hooks (guard, change-loop, roadmap-loop, flow-check), the devkit skill text, ADR 0020 and the flow docs. Runner: node:test, aggregated by guard.test.mjs; the new stage-models.test.mjs builds real temp folders, a real Git repo and real session/subagent transcript files, and mocks only gh (OFFLINE) and read counters.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0, none needed): table lookup (change, project, default) to every action's model -> caught by AC-2 'next at the design stage carries the project entry, and the change entry over it' and the AC-5 'every action next prints' test; bad table to setting-unknown -> AC-3 tests (start creates nothing, next exits 3 with no hand-off, lenient read in locks and roadmap); failed subagent transcript to retry one model up or role-failed end -> AC-10 tests (haiku to sonnet, sonnet[1m] to opus[1m], two failures, failure on opus, success resets, typed command window, status and other-change in between); hand-offs read only on next --after -> countReads assertions (0 reads without --after, 1 with it; locks and status read none); retry counted against the budget -> AC-11 retry-at-the-cap test; roadmap session-start carries the stage model -> AC-6 tests; stepDownOf to session-model action to run-file record -> AC-7 pure and end-to-end tests; spend readout via flow-check and /devkit status -> AC-12 tests (known numbers 3210, 1105, 4315); skill tells the session to pass model on the Agent call -> text-level test plus the real-run probe proof/probe-agent-model.* (an Agent call with model haiku from a sonnet parent produced a claude-haiku-5-5 subagent message); cross-process flow (session, subagent, retry, readout) -> real-run evidence (lone-run, road-run, lone-spend, road-spend), not only unit tests.

I did not complete a run of stage-models.test.mjs: it passed the 120 s tool limit and I killed it. I rely on the green whole-suite run in evidence.md (2180 of 2180). That run names commit f37bcad, one commit before HEAD.

### Well covered
- A failed stage subagent becomes a retry one model up, or a blocked end: AC-10 'a failure on haiku ...', 'two failures in a row ...', 'a failure on opus ...', 'a success between two failures ...', all on real subagent transcript files.
- A lock or status read never reads hand-offs: AC-10 'a next with no --after ...' and 'the stop lock and /devkit status decide and print the same ...'.
- A bad change table stops only that change's own loop: AC-3 'nextAction and the stop lock read a bad change table leniently ...'.
- A retry is held by the token cap and its tokens are counted: AC-11 'a retry at the cap is held ...'.
- The old session-declared role-failed path is gone and its replacement is pinned by the updated skill assertions in change-loop.test.mjs and roadmap-loop.test.mjs.
