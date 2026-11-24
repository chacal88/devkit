Verdict: approved
Commit: 80ae28772aebdd569cf6209a0a6de6a669ef18a3

## Quality review — loop-place-and-evidence (round 1)

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-5 row, Acceptance criteria table) — AC-5 is marked pass on fixture test 13 only; the criterion requires the real review round's Commit lines and the S and V0-V4 real-run proof, which the evidence itself defers and does not contain. · refuted: design.md:293-295 and tasks.md:134-136 prescribe AC-5 pass on loop-evidence 13 with the real round lines to follow in a later pr-verifier rewrite (tasks.md:142-146); evidence.md:45 does exactly that and reviews/ does not exist yet / design.md:293-295 and tasks.md:134-136 prescribe AC-5 pass on loop-evidence 13 with the real round lines to follow in a later pr-verifier rewrite (tasks.md:142-146); evidence.md:45 does exactly that and reviews/ does not exist yet / design.md:293-295 and tasks.md:134-136 prescribe AC-5 pass on loop-evidence 13 with the real round lines to follow in a later pr-verifier rewrite (tasks.md:142-146); evidence.md:45 does exactly that and reviews/ does not exist yet
- [nit] openspec/changes/loop-place-and-evidence/evidence.md (Gates row 3.3 part 1, Findings) — Row and finding cite the old gate 3.3 part 1 (guard.test.mjs); tasks.md now says node scripts/test-suite.mjs, so the row and the 'fix the gate text' recommendation are stale.
- [nit] openspec/changes/loop-place-and-evidence/tasks.md:66,92 — Gates 1.5 part 2 and 2.4 part 1 still target guard.test.mjs and run 1 and 8 unrelated tests; only gate 3.3 was edited after approval, so the plan gates are inconsistent.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1811 — One guarded early return in the toReview block, after verify and fix-* and before review, reusing the existing commit step and hand-off with no new step, row or end; tests 4 and 11 pin the order.
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs:1917 — Test 13 shows a round recorded after the commit step reads as current and one marked uncommitted reads stale; E1-E9 were adjusted without dropping an assertion.

### Phase 1: context
- Scope matches the proposal: deliver-check.mjs (+6 lines), skill rows, flow doc, tests, release files and the change folder. The place-wait code and tests (AC-7) are untouched.
- Release numbers are consistent: 0.40.0 and 0.44.0, CI pin moved to v0.40.0, no v0.39.0 left in docs/openspec-flow.md.
- Tests 1 to 14 cover modified, staged, untracked and renamed paths, product-dirty-first, the three-path cap, and the cases where the answer must not change.

### Phase 2: architecture
- The rule sits in nextStep's toReview block and reuses the commit step and the ROWS.commit hand-off; paths: [] is consumed correctly and tests 16 and 17 pin the skill and doc text.
- One extra scoped git status per collectState call; cheap.

### Phase 3: line by line
- changedUnder handles the rename and copy second entry and is the helper item 5 already uses (reuse, no duplication). The optional chaining keeps hand-built states on today's answer (test 2).
- E1-E9 edits only add commitAll or the commit step to recorded sequences; no assertion was removed.
- The fixture move (state, open, blocked, rejectedState, BOTH) into deliver-check-fixtures.mjs is a pure move imported by name.

### Phase 4: acceptance with real output
- AC-1 to AC-4, AC-6, AC-7: backed by test output and a recorded real deliver-check --json run; the 15 loop-evidence tests re-run under TMPDIR=/var/tmp/devkit-loop-place-and-evidence all pass (15 tests, 15 pass, 0 fail). The tree stayed clean.
- AC-5: see F1.

### Summary
- 5 findings (0 blocking, 1 important, 2 nit) + 2 praise.
- Justification: the checker change is minimal, correctly placed and well covered; the texts and release are consistent. The one open important is the missing real-run proof for AC-5, which the plan schedules after this round and which stays open until evidence.md carries it.
