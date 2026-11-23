Verdict: rejected
Commit: 0187ac5c256f95f11156fa0df78a14c03c9d1801

## Quality review — remote-worker 7b9c499..HEAD (round 1 of 2, after two merges of main)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1198 (placeFacts, called from nextAction) — placeFacts runs remoteClaims (ls-remote up to 15 s plus gh calls up to 10 s) on every nextAction at an implementation step with no place taken; reuse the claims result or cache it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1198 (placeFacts) vs placeChange — placeFacts counts places held from stale tracking refs while placeChange counts after a fetch, so a change can show take-place and then exit 2 (handled as waiting). Also, changeState with a declared no-place end and no action would give a bare id title (line 755); no path declares it today.
- [nit] plugins/openspec/hooks/machine-probe.mjs:62 (checkout) — The probe joins id into a path and into git fetch without validating it; the caller validates, but a name check in the probe would make it safe on its own.
- [important] CHANGELOG.md:15 — The 0.34.0 entry says 'ADR 0019 (proposed)', but 7b21aad set ADR 0019 to Status: accepted with the owner's acceptance. The shipped release note contradicts the same diff. Fix: write 'ADR 0019 (accepted)' or drop the status word.
- [nit] openspec/changes/remote-worker/evidence.md (AC table, L-1 to L-4) — Live proof on real SSH and GitHub is deferred until after the merge by the owner's decision; run it right after the merge, since the change is BREAKING for projects with a remote.
- [nit] plugins/openspec/hooks/run-file.mjs:2 — The header says the helpers were 'Moved here unchanged', but the move also adds the `placed` field and its reading; say 'moved, plus placed' so the comment does not mislead a later diff reader.
- [praise] docs/adr/0019-a-change-can-run-on-another-machine.md (decision 8) and docs/adr/0017-a-change-state-is-derived-in-one-place.md — The ADR 0017 amendment is explicit and bounded: it names the one blocked end that takes ⏳ with no ⛔ and states that every other blocked end keeps ADR 0017's form. It is reflected in 0017's header line and Note, and in the code at change-loop.mjs:674 and :755 with a test on the title.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs:191 — The two-prs open test follows the claim commit by tightening, not loosening: the parent of HEAD is origin/main and origin/main is an ancestor of HEAD, so the test still pins that the branch is cut from the remote base tip. The name and the exit-code assertions are kept.
- [praise] plugins/openspec/hooks/change-loop.mjs:1346 — claimOnOrigin uses --force-with-lease with an empty expectation, so the push is an atomic create-only claim, and a lost race is a typed ClaimRace with clean-up and a fresh read of the winner's claim.

### Summary
- 9 findings (0 blocking, 1 important, 5 nit) + 3 praise
- Justification: the previous round approved at 7b9c499 with four nits, all unchanged in substance (F1 to F3 plus the deferred live proof F5). Since then the branch merged origin/main twice and added the place-wait title, the T-14 edit of the two-prs open test and the ADR 0019 amendment of ADR 0017 decision 4. The ⏳ rule matches ADR 0019 decision 8, the amendment is recorded in the ADRs, the run-file move and its re-exports are consistent, the release numbers agree (devkit-openspec 0.30.0, marketplace 0.34.0), and the targeted tests pass (19 of 19). One new important finding: the CHANGELOG calls ADR 0019 'proposed' while the same diff accepts it. That is a one-line fix; with it, the verdict is approved. Whole-suite evidence is evidence.md attempt 4 (2106 of 2106 at 7b21aad). Recommended verdict: rejected until F4 is fixed, then approved.
