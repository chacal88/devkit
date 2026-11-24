<!-- devkit-stage retro result=passed attempt=1 commit=235089acb29b669e11985fcc1e444fae4b004dfd -->
# Retro: loop-place-and-evidence

## Retro: loop-place-and-evidence (PR #112, merged by train 6 in PR #123 at d917ae0, tagged v0.42.0)

1. Went wrong: the plan was written overnight against main c1ac8c4, and main then moved by more than a hundred commits before delivery. Four merges of main followed: suite-speed split `deliver-check.test.mjs` into three files (the change's tests had to be moved by hand), #97 (stale-only-on-own-files) edited `deliver-check.mjs` and took the release number, the train came on, and archive-release-pin removed the pin literal. Each merge redid the evidence (four attempts) and the review (three rounds). Three smaller frictions came with it. The plan's gates 1.5 and 2.4 filtered `guard.test.mjs`, which suite-speed had emptied, so they exited 0 while running 1 and 8 tests; the adr-reviewer caught it in round 1. The plan put the real-run proof (S, V0 to V4) after the review round, so round 1 failed by design on three `important` findings that only said the proof was not there yet, and cost a round and twelve verifiers. And after a fix inside the change folder `next` answered `fix-review` again (the jira-entry-followups gap), so round 2 was run by hand.
2. Better next time: record the real-run proof in `evidence.md` before the first review round; name in a gate the files that hold its tests, never an aggregator; and let a filtered gate that matches no test fail instead of passing.
3. Remember: a gate whose name filter matches nothing in the file it names is green and proves nothing.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Four merges of main between the plan and the delivery; each redid the evidence and the review | process-friction | memory-only (already the subject of the delivery train and of the project memory on re-merge cost) | project |
| 2 | Gates 1.5 and 2.4 filtered `guard.test.mjs` after suite-speed emptied it: a false green on 1 and 8 tests | tooling | followup | project |
| 3 | The plan scheduled the real-run proof after the review round, so round 1 failed by design | project-rule | rule | project |
| 4 | After a fix only inside the change folder, `next` answered `fix-review` again; round 2 was run by hand | tooling | followup (already in `jira-entry-followups`; this change adds a second case) | project |
| 5 | During the merge resolution the guard refused `sed -i` on a test file but let `patch -p1` write the test files | bug-class | followup | project |
| 6 | On the `agents` path of review-change the session retypes every stage-1 answer as JSON for `review-round.mjs` (thousands of characters per round) | process-friction | followup | project |
| 7 | Open nits of the review: the spec delta does not state the three-path cap of the `commit` reason; no test pairs a dirty folder with a stale reviewer or an undisposed finding | doc-gap | followup | project |

## Proposed updates

### `CLAUDE.md` (project-rule)
The real-run proof goes into the evidence before the first review round, so the round does not fail on a proof that is only scheduled.
- before: "- When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests."
+ after: "- When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests, and is in `evidence.md` before the first review round; only a line the round itself produces is added after it."
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (doc-update)
A new round at the end of the roadmap for the follow-ups of this change.
- before: "## Round 28j: private temp folders in tests"
+ after: "## Round 28k: follow-ups of loop-place-and-evidence\n- [ ] loop-place-and-evidence-followups (after: loop-place-and-evidence) — from the loop-place-and-evidence retro: a filtered gate (`--test-name-pattern`) that matches no test in the files it names fails instead of passing (gates 1.5 and 2.4 ran 1 and 8 tests on `guard.test.mjs` after suite-speed); the guard's refusal of product writes through the shell also covers `patch` (it stopped `sed -i` but let `patch -p1` write test files during a merge); the `agents` path of review-change reads each agent's stage-1 answer from a file instead of the session retyping it as JSON; and the review's open nits: the spec delta states the three-path cap of the `commit` reason, and a test pairs a dirty change folder with a stale reviewer and with an undisposed finding\n\n## Round 28j: private temp folders in tests"
- Answer: approved
- Applied: yes
