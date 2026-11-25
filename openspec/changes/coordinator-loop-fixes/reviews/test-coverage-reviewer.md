Verdict: rejected
Commit: 73e159c2acfac2959d8f6f84b099c538b0eafc54

## Coverage analysis — coordinator-loop-fixes (3ca2e47..73e159c)

### Findings
- [important] plugins/openspec/hooks/conduct-check.mjs:64 — [5] The conduct-check side of conductor-task is untested. Removing 'conductor-task' from MAIN makes actorOf return { actor: 'stop', reason: 'unknown step conductor-task' }. deliveryStep then replaces next.reason with that text, the row's state reads 'blocked: ...: unknown step conductor-task', and selectDispatch never dispatches it; the change loop also passes that reason on in the action's detail. No test fails: T68 builds the row with rowOf, which skips actorOf, and the 'loop's step agents match conduct-check's actorOf' test only checks agents, so a session step with no agent is never checked. Real run r9 would also stay green, because ROWS still holds the step. Write in: conduct-check.test.mjs next to T45: assert.deepEqual(actorOf('conductor-task'), { actor: 'main' }), and a deliveryStep row for conductor-task whose state is not blocked and whose reason is deliver-check's.
- [nit] plugins/openspec/hooks/guard.mjs:745 — [3] The DECLARE_CALL boundary is pinned only for the bare, quoted and cd-prefixed forms (T98, T99). A node option between `node` and the script gets through: I called declareViolation read-only, and `node --no-warnings plugins/openspec/hooks/change-loop.mjs declare feat gate-red --param phase=1` from tdd-implementer returns null. The regex is exactly what D-1 specifies, so this belongs to the security reviewer's view of the design rather than to a missing test.
- [nit] plugins/openspec/hooks/change-loop.mjs:3249 — [3] `round = REVIEW_ROUNDS + authorizedRounds(dir, scope) + 1` is tested only at round 3 (T38, T96), so a hard-coded 3 would pass. A second authorization, at the deadlock after round 3, must record round 4 and say 'round 4' in declared.reply; only that text and the record's round field depend on it. Write in: change-loop-declared.test.mjs after T111: run declare review-round again at the round-3 deadlock and assert round 4 in the record and in the reply.
- [nit] plugins/openspec/hooks/flow-check.mjs:562 — [2] No test covers a plan revised before the start. Every devkit test of plan-revised has a ticked task (T57-T59, T133), and T93 is devkit-lite, which has no approval stage. Removing `started &&` would mark the readiness stale on a design edit made after the approval and before the first tick, and the suite would stay green. Write in: flow-check.test.mjs next to T58: a revisedChange variant with no task ticked and the design edited, whose readiness stays passed.
- [praise] plugins/openspec/hooks/change-loop-declared.test.mjs — The new links between parts are tested where the behaviour shows, not only in the extracted helpers. The declare CLI is followed by the stop hook on its real output (T25-T30, T38-T40, T111). The resolution deadlock goes through push, commit and fix-resolution (T96). The plan digest is followed through next, record-approval and the CompozyOS view (T60, T115, T116, T134). The archive-x and advanced-branch fixes reach the retro through next (T124, T130). The flows that cross processes also have real runs recorded in proof/.

In-scope surfaces: plugins/openspec/hooks (change-loop, deliver-check, flow-check, conduct-check, guard, roadmap-loop, project-loop), plugins/core/skills/review-change/scripts (review-round.workflow.js), the schemas' tasks and review text, and the skills' text tests.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0; read-only probes of declareViolation and actorOf only):
- reply waiting-pause / waiting-owner-decision, end line then reply → T1, T2; stop hook allows → T3, T4; refuses without the line → T5
- DECLARED table to roadmap-loop replyCmd gate → T7, T8; to RECORDED_KEYS → T114; GATE_OF_WHY to changeState → T6
- runOf end id must equal the run's change → T20-T23
- declare gate-red to nextAction redGate to fix-gate, then blocked tests-red → T25, T26; next never gives fix-gate → T27; one fix per phase → T28; refused away from the gate, nothing recorded → T29; unreadable record → T17
- declare review-round to deadlockScope, record, then fix-review → T38-T40, T112; round 3 through the loop with detail.limit 3, deadlock again after it → T111; resolution scope → T95-T97, T36
- authorizedRounds to collectState roundLimit / resolution.limit → T37, T97; to collectFlow authorizedReviewRounds and ceilingOf → T105-T110, T132
- review-round.workflow.js args.limit to validateArgs, prompts and consolidate → T41-T43
- planDigest / planRevision to nextStep stop-plan-approval → T51-T56; to flow-check plan-revised → T57-T59, T133; to decide PLAN_REASONS and detail.plan → T60; approvalText and record-approval → T115; CompozyOS view → T116; merge-defect fix → T134
- parseTasks Conductor: to readPhases to nextStep conductor-task / stopAt → T62-T67; decide session step → T68; conduct-check actorOf('conductor-task') → gap (F1)
- conduct-check releaseConflict to resolve-base-conflict → T45-T48, T117, T118, and the change-loop next test 'hands resolve-base-conflict to the implementer'; decide → T49; CompozyOS hand-off list → compozy view test
- foreignArchiveHead to isOwnPr, findChangePr list and commit arms → T119-T123, T142; to next → T124
- headInBase to flow-check postMerge → T127-T129; to prItem merged arm → T131; to next retro → T130
- guard declared.json gate → T18, T19, T104; declareViolation → T98-T103 (option boundary F2); inProofFolder for pr-verifier → T70-T73
- changeDevkitBlock to budgetOf / modelsOf / capOf → T135-T138
- planDirty leaves out declared.json → T141
- agentOf / AGENT / PACKS and project-loop's ADR reviewer → T75-T77

### Well covered
- The steps the session declares (reply and declare): the CLI output is fed to the real stop hook (T3-T5, T30), so the stop lock is protected beyond the marker text.
- One more review round: the full loop after the authorization runs fix, commit, round 3 with limit 3, then the deadlock again (T111), and the resolution path includes the push of the uncommitted record (T96).
- Plan revised after the start: both drivers (next and the CompozyOS view) and record-approval write and read the same digest (T60, T115, T116); a tick and evidence leave it unchanged (T51, T58, T59).
- Field bug fixes AC-17 and AC-18: reproduced as loop-level fixtures (T124, T130) and as real runs on the real repository (r16, r17) that show the old hooks failing and the new ones passing.
- Conflict outside the release files: every older conduct-check test that pinned the blocked end was updated to the new hand-off, and the archive-left-train exceptions are kept (T117, T118).
