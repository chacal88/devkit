Verdict: approved
Commit: 109279031bd2295a0ed1e8c83e0dd2fb28d88a3f

## Quality review — review-owner-rounds (round 1)

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js:72-87 — validateOwner checks only the shape of args.owner (round, scope, 1 to 200 characters of words). It never reads declared.json, so a hand-written args.owner passes. The skill says never to write it by hand, but nothing enforces that. Check against the record in validateArgs, or accept the gap as a documented trust boundary.
- [nit] plugins/core/skills/review-change/scripts/review-round.mjs:186-213 — declaredSteps copies the readDeclared rules from deliver-check.mjs. The comment says deliver-check.test.mjs keeps the two readings in step. That is acceptable because devkit-core installs alone, but the copy can drift if the test stops covering it.
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:69-95 — The rule sits once in the rules section, and the .mjs and workflow paths share it. The owner command refuses with exit 3 and names the missing authorization. The 200-character cap and backtick handling match change-loop's wordsOf.
- [praise] plugins/core/skills/review-change/scripts/review-round.test.mjs — Each AC-1 to AC-5 has a test, including the refusal path (no agent starts, exit 3) and the resolution scope. Rounds 1 and 2 are pinned as unchanged and as refusing an owner.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: I read the diff of the rules (`validateOwner`, `ownerLine`, `consolidate`), the new `owner` command, the SKILL.md and ship-change rows, and the tests. Scope matches the proposal. No `scripts/test-map.json` edit is needed because no file was added or moved. Every AC has a test and a real-run proof under `proof/` (rr1 to rr5). The only change after the evidence commit 8976c14 is `evidence.md` itself, so the proof was taken on the same code. The scoped run of `review-round.test.mjs` passes with 113 of 113.
- The workflow path trusts `args.owner` (F1). That leaves a gap only if a session ignores the skill. The `owner` command is the real gate, and it refuses when no words are recorded.
