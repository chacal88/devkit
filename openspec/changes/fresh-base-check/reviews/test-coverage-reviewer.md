Verdict: rejected
Commit: 6c053994f35e0f0b873fb34923d4c8d28a811723

## Coverage analysis — fresh-base-check (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs ownReply/decisionKey; change-loop.test.mjs test 10 — [6] No test sends a real failed fetch through a wait: test 10 uses hand-written replies, so a change in how the line is appended (or the reply-less cut<0 branch) would leave it green while a real wait returns early. Write in change-loop.test.mjs next to test 6: runCommand wait with the origin made unreachable at one poll, assert it keeps polling.
- [important] plugins/openspec/hooks/change-loop.mjs nextAction (action.reply append); change-loop.test.mjs test 2 — [5] Only the empty-reply case of the appended line is covered by a real producer; reply = line (dropping an existing reply) stays green. Add a failed-fetch case for an action with a non-empty reply asserting `${local.reply}\n${line}`.
- [nit] plugins/openspec/hooks/change-loop.mjs:1420 — [3] Test 3 overrides timeoutMs; nothing asserts the production default is 15 s (LS_REMOTE_TIMEOUT_MS).
- [nit] plugins/openspec/hooks/change-loop.test.mjs test 11 — Implementation-coupled: pins whole doc and skill sentences with includes; assert the key facts instead.
- [nit] change-loop.test.mjs test 7; roadmap-loop.test.mjs test 14 — [4] The lock checks assert only why !== 'no-run' and no fetches; nothing proves the lock reached nextAction for a change in delivery.
- [nit] plugins/openspec/hooks/change-loop.test.mjs test 9 — [2] The two checker spawns' status and output are not asserted; a future argument change would make the no-fetch check vacuous.
- [praise] plugins/openspec/hooks/change-loop.test.mjs test 5 — Strong seam test: only origin/main moves; tags, other branches, index, tree and FETCH_HEAD are checked, with a self-check that a plain fetch writes FETCH_HEAD.
- [praise] plugins/openspec/hooks/change-loop-fixtures.mjs gitShim — The PATH git shim counts real fetch calls, making once-per-call, per-poll and never-in-state/locks claims observable on both loops with no mocks.

Blocking gaps (8-10 without a plan): 0
Red proof: proof/red-1.txt shows 11 of 12 change-loop tests red before the code and green after (test 7 asserts a negative); proof/red-2.txt shows the same for the roadmap tests.
The 18 fresh-base-check tests were run filtered in the foreground and all pass; the whole suite was not run.
