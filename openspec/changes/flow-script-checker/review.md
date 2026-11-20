# Review: flow-script-checker, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 07a85c4 |
| spec-reviewer | rejected | 0 | 3 | 3 | 0 | 07a85c4 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 07a85c4 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 07a85c4 |
| architecture-reviewer | rejected | 0 | 1 | 1 | 0 | 07a85c4 |

Consensus: FAIL (round 1/2)

## Open findings
- spec-reviewer — [important] specs/change-stages/spec.md (Requirement: A stale stage runs again alone); plugins/openspec/hooks/flow-check.mjs (staleAfter handling) — The spec delta defines staleness only for a stage after the implementation (header commit behind a product commit) and for the approval after a new readiness. Readiness going stale when a plan file is newer, and the decision to skip that mtime check once any task is ticked, appear in no requirement or scenario. The change resolved this silently, so extend the delta with a plan-stage staleness requirement or drop the behaviour.
- spec-reviewer — [important] specs/change-stages/spec.md (Requirement: Every run ends in one of four states); flow-check.mjs delivery rows and flow-check.test.mjs DELIVERY_ROWS — The spec delta has one delivery scenario (pending checks wait on GitHub). The checker implements and tests much more: ship plan, pr and merge modes, no PR, a head not pushed, failing and unreadable checks, owner merges, auto-merge, closed PR blocks, and resuming at the retro after a squash merge with staleness checks skipped (decision 5). Requirements A-5 names the delivery models but no spec scenario states these behaviours.
- spec-reviewer — [important] requirements.md A-8; specs/change-stages/spec.md (Requirement: The readout is plain text); flow-check.mjs checkOpenspecVersion — The checker refuses an OpenSpec other than 2.x with exit 3, and a missing CLI or an OpenSpec answer without artifacts also gives exit 3. This lives only in the A-8 assumption and the tests; the spec delta's exit-code scenario says only 'a usage error'. The four install lines moved to `@2` (decision 7) are likewise outside the delta. Add the version rule to the spec or state that it is design only.
- test-coverage-reviewer — [important] plugins/openspec/hooks/flow-check.mjs:366-371 — [6] header validation in artifactState (no-header, bad-header, header-other-stage) is never asserted through the walk: swapping the h.stage !== stage.id check or the null-header check leaves every test green; a file copied with another stage's header would read as passed. Write in plugins/openspec/hooks/flow-check.test.mjs with walk({ review: { header: { stage: 'proposal', result: 'passed', attempt: 1, commit: 'c000000' } } }), { header: { malformed: true } } and { header: null } on a non-first stage, asserting state pending, reasonCode and that next.stage is that stage.
- test-coverage-reviewer — [important] plugins/openspec/hooks/flow-check.mjs:372-376 — [5] a multi-file stage (specs/**/*.md) is only tested with one file: the worst-of rule (failed > pending > passed, mixed not-applicable) and the stale loop over every file would survive a mutation that reads files[0] only. Every fixture (synth at test:421, liveChange at test:666) has exactly one spec file. Write in flow-check.test.mjs: a walk with two spec files (passed plus pending, passed plus failed, passed plus not-applicable, all not-applicable) and a staleness stub that is stale only for the second file.
- architecture-reviewer — [important] plugins/openspec/hooks/flow-check.mjs:179-191 — branchOf and offOwnBranch copy deliver-check's currentBranch, defaultBranches and archiveHeads (deliver-check.mjs:452, 1069, 1074), so the 'own branch' rule now exists twice and has already diverged (flow-check hardcodes main/master and the archive heads, deliver-check also reads origin/HEAD); export the three from deliver-check (or guard) and import them, which is the cut, not a copy.

## Refuted by verification
None.

## Notes
- The code-quality-reviewer and the test-coverage-reviewer returned a commit padded from the short sha at stage 1; the session replaced it with the full sha of HEAD (07a85c411ee58cafd43ddd663a9176eb821b5c65) before the verify stage.
- The code-quality-reviewer first reviewed only flow-check.mjs; it was asked to finish over the whole diff and its second stage-1 answer is the one used.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: flow-script-checker, round 2

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | eb37166 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | eb37166 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | eb37166 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | eb37166 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | eb37166 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 2 re-ran all five reviewers: the three that rejected in round 1, and the two that had approved, whose reviews went stale when the fix commit 7013137 changed product code.

## Next
Ready to ship.

# Review: flow-script-checker, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 19d8c27 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 19d8c27 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 19d8c27 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 19d8c27 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 19d8c27 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- This call is a re-review made only because the five reviews went stale: the check job of PR 36 failed at eb4ebc2 (11 flow-check delivery tests read GITHUB_HEAD_REF from the CI run) and c38d327 fixed the test fixtures. It consumes no round budget.

## Next
Ready to ship.
