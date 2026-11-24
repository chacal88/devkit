# Review: state-skips-unlocated, round 1

Path: agents · range `cf34ff2..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 65f22c4 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 65f22c4 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 65f22c4 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 65f22c4 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- The seven files the code-quality reviewer first left unread were read in a second answer; the round did not change.
- The suite ran in two steps, as evidence.md records: the whole suite at 0602907, then the two files that held four missing imports, at a273745.
- The writers read their stage-3 prompts from files in the scratch folder, with the text the script gave.

## Next
Ready to ship.

# Review: state-skips-unlocated, round 1

Path: agents · range `9dff573..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 7e305e2 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 7e305e2 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 7e305e2 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 7e305e2 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round redone only because the branch merged origin/main twice (the delivery train turned on, the release renumbered to 0.39.1 / 0.43.1) and the flow marked evidence and reviews stale; the product and test files are byte-identical to the first round at 65f22c4.
- The whole suite is proven by the delivery train (devkit.delivery.train), not run here; evidence.md records the filtered and per-file runs at this head.
- The writers read their stage-3 prompts from files in the scratch folder, with the text the script gave.

## Next
Ready to ship.

# Review: state-skips-unlocated, round 1

Path: agents · range `946e3e8..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 63c5eac |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 63c5eac |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 63c5eac |
| test-coverage-reviewer | approved | 0 | 0 | 1 | 1 | 63c5eac |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/openspec-flow.md:240; openspec/changes/state-skips-unlocated/decisions.md — Drift from ADR 0017 decision 1 (docs/adr/0017-a-change-state-is-derived-in-one-place.md): the state of an unplaced change is derived outside nextAction, so state and board say blocked wrong-branch while change-loop next, wait and session-next still exit 3; the docs sentence 'one function that next, this command and /devkit status share' is no longer true for it and decisions.md records no divergence. Fix: state in the docs that those commands keep exit 3 for such a change and acknowledge it in decisions.md (optionally a dated Note in ADR 0017).

## Refuted by verification
- test-coverage-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:1531 — [5] status --json and the line 1710 classify call nextAction on unfinished() items without unplacedAction; the unplaced setup is not exercised there, only the board, the decision and the stop lock are. · refuted: design.md:57-60 declares statusJson (roadmap-loop.mjs:1531, own try/catch) and draftCmd (line 1710, keeps exit 3) non-goals not routed through unplacedAction; unplacedAction is wired only at roadmap-loop.mjs:807 and change-loop.mjs:1850, and the AC table (design.md:293-312) has no row for the two sites, so no plan-required coverage is missing / design.md:57-60 Non-Goals and tasks.md:81 keep statusJson and draftCmd unchanged and unrouted through unplacedAction; the diff 946e3e8..HEAD of roadmap-loop.mjs touches neither (2 lines changed, only the line 807 call site), so no AC requires a test of them in the unplaced setup (2 of 3)

## Notes
- The round was called because the branch merged origin/main again (train 1, release renumbered to 0.39.2 / 0.43.2) and the flow marked evidence and reviews stale; the product and test files are byte-identical to the first round at 65f22c4.
- The adr-reviewer finding F1 was confirmed by the three verifiers (not refuted); the test-coverage-reviewer finding F3 (important) was refuted by two of three verifiers, with evidence that design D-1 and tasks.md put statusJson and draftCmd out of scope.
- The fix of adr-reviewer F1 is in f636733 (the state paragraph of docs/openspec-flow.md names the exception, ADR 0017 gets a dated note); the other nits are left open on purpose (plan files are not edited after approval).
- The whole suite is proven by the delivery train, not run here.
- The writers read their stage-3 prompts from files in the scratch folder, with the text the script gave.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: state-skips-unlocated, round 2

Path: agents · range `946e3e8..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | cb79a38 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | cb79a38 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | cb79a38 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | cb79a38 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 2 is a scoped call: each reviewer re-checked its previous findings and the range 63c5eac..HEAD, which holds f636733 (the state paragraph of docs/openspec-flow.md and a dated Note in ADR 0017), the refreshed evidence and the round-1 record; no product or test file changed.
- The adr-reviewer F1 is fixed in f636733; its nit F2 is marked fixed in the same commit by the reviewer, who found design.md already cites ADR 0017 decision 1.
- The other nits stay open on purpose: the plan files are not edited after approval, and the code nits are inherited or accepted risks.
- The whole suite is proven by the delivery train, not run here.
- The writers read their stage-3 prompts from files in the scratch folder, with the text the script gave.

## Next
Ready to ship.

# Review: state-skips-unlocated, round 1

Path: agents · range `c663f21..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | faddf80 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | faddf80 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | faddf80 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | faddf80 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Scoped call because the branch merged origin/main (train 4: devkit-openspec 0.40.0, the pin test reads plugin.json, the archive check of PR 107) and the flow marked evidence and reviews stale; each reviewer re-checked its previous findings and cb79a38..HEAD. The product and test files of this change are unchanged since cb79a38.
- The release of this change is devkit-openspec 0.40.1 / marketplace 0.45.1; the ADR 0017 Note and the docs sentence are intact after the merge.
- The test-coverage nit about the release-pin test is cleared as a fact of main (commit 0e76c41, ADR 0030), not by this change.
- The whole suite is proven by the delivery train, not run here.
- The writers read their stage-3 prompts from files in the scratch folder, with the text the script gave.

## Next
Ready to ship.
