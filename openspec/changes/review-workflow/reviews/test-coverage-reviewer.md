Verdict: approved
Commit: 4955dcf7d55dd2206b54ce7c6f0ebeb940343195

## Coverage analysis — origin/main..HEAD, change review-workflow (round 1)

In-scope surfaces: plugins/core (review-round.workflow.js, review-round.mjs, agents, review-change skill), plugins/openspec (deliver-check, guard.test import, skill text), docs/ADR
Blocking gaps (8-10 without a plan): 0
Seams checked: reviewers started before any returns -> review-round.test.mjs:318 (hold harness; deleting parallelism or awaiting serially fails calls.length==3); 3 verifier jobs per blocking/important, none for nit/praise/disposed -> :336 (count, labels, prompt exclusion); majority-with-evidence rule through the script -> :347 (2/3, blank evidence, null vote); writer agentType + verbatim lines + commit + no verdict -> :366; verdict/consensus/path in reviewMd -> :381, :388; stage 1 failure and malformed return drop the reviewer from later stages -> :411, :421; writer null or written:false -> :428; invalid args before any agent -> :437; CLI chain equals workflow output -> :587 (compares outcomes, reviewMd, consensus, job count); check-file line 1, line 2, uncommitted marker, missing refuted line, reworded blocking line, nit not checked -> :567; deliver-check approved+undisposed -> fix-review -> deliver-check.test.mjs (AC-6, real round-1 line from release-rebase-pin via findingsItem, both severities, mixed rejected+approved, stale approved stays `review`); findingLine output read back by findingsItem as refuted/undisposed -> deliver-check.test.mjs (round trip); readReviewMd reads consolidate's real output -> deliver-check.test.mjs; ADR 0008/0001/config pointers -> guard.test.mjs (mutation runs: 0)
Targeted run: review-round.test.mjs 51/51 pass.

### Findings
- [important] [5] The writer's returned verdict is never compared with the outcome's verdict in the script. workflow.js (write stage) fails a writer only when `written !== true`. A writer that writes `Verdict: approved` for an outcome of `rejected` (the prompt leaves the verdict to "your own rules") returns `written:true` and the script reports success with `reviewMd` built. Only `check-file` catches it, and the session's call to it is prose in SKILL.md, tested only by `assert.match(s, /check-file/)` (review-round.test.mjs:640). The script is covered for `null` and `written:false` (:428) but not for a divergent `verdict`/`commit` in the return. Either assert in the script (and test it in the harness with `writes: { [cq]: { written: true, verdict: 'approved', commit: SHA } }` against a rejected outcome) or record that check-file is the sole control · write in: review-round.test.mjs, next to :428, using `responder({ writes })`
- [nit] prose-only fallbacks: the refused/errored call, invalid result and lost-notice rows (AC-1, AC-5) are checked by text matches (review-round.test.mjs:656, :663, :671) that go red if the sentence is deleted, not if the behaviour is wrong. Nothing executable exists for them; acceptable, covered by the dogfood item.
- [nit] harness assumption: `harness()` (:275-293) assumes `parallel` never rejects, the body is wrapped as an async function and `agent` opts are `{agentType, schema, label, phase}`. If the real Workflow tool differs, AC-1..AC-3 stay green while the live run fails. Already scoped to the next change's dogfood in the rewording of AC-1..AC-3; keep it in the retro.
- [nit] impossible fixture risk: `stage1Of`/`votes` are hand-written, but they match STAGE1_SCHEMA/VOTE_SCHEMA and the CLI path also exercises fenced-text input (:478, :487), so no producer-impossible state found.

### Well covered
- 2-of-3 refutation rule with blank-evidence and null votes — :63, :70, :347
- Verifier isolation (only its finding, no other finding or verdict) — :209, :336
- Already-disposed findings neither open nor verified — :123, :336 (F5)
- Workflow/agents parity (same outcomes and review.md except the path) — :587
- fix-review for an approved verdict with an open finding, built from a real prior line, with stale and mixed cases — deliver-check.test.mjs
- Script purity constraints (no import, clock, process) — :260
