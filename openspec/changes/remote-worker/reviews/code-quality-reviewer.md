Verdict: approved
Commit: 69cd61c53948ec3344b33b7433411914d0298480

## Quality review — remote-worker 7b9c499..HEAD (round 2 of 2, scoped re-review)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1198 — placeFacts runs remoteClaims (ls-remote up to 15 s plus gh calls up to 10 s) on every nextAction at an implementation step with no place taken; reuse the claims result or cache it. Out of the scoped range, stands.
- [nit] plugins/openspec/hooks/change-loop.mjs:1198 (placeFacts) vs placeChange — placeFacts counts places held from stale tracking refs while placeChange counts after a fetch, so take-place can be followed by exit 2 (handled as waiting); a declared no-place end with no action would give a bare id title (line 755), no path declares it today. Stands.
- [nit] plugins/openspec/hooks/machine-probe.mjs:62 — checkout joins id into a path and into git fetch without validating it; the caller validates, but a name check in the probe would make it safe alone. Stands.
- [important] CHANGELOG.md:15 — The 0.34.0 entry said 'ADR 0019 (proposed)' while the diff set ADR 0019 to Status: accepted. Now reads 'ADR 0019 (accepted)', matching the ADR header. · fixed in 8344801
- [nit] openspec/changes/remote-worker/evidence.md (AC table, L-1 to L-4) — Live proof on real SSH and GitHub is deferred until after the merge by the owner's decision; run it right after the merge, since the change is BREAKING for projects with a remote. Stands.
- [nit] plugins/openspec/hooks/run-file.mjs:2 — The header said 'Moved here unchanged' though the move also adds the placed field; now says moved from change-loop.mjs where they now also carry placed. · fixed in 8344801
- [praise] docs/adr/0019-a-change-can-run-on-another-machine.md (decision 8) and docs/adr/0017-a-change-state-is-derived-in-one-place.md — The ADR 0017 amendment is explicit and bounded: it names the one blocked end that takes the waiting mark with no stop mark and keeps every other blocked end in ADR 0017's form.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs:191 — The two-prs open test follows the claim commit by tightening, not loosening: it still pins that the branch is cut from the remote base tip.
- [praise] plugins/openspec/hooks/change-loop.mjs:1346 — claimOnOrigin uses --force-with-lease with an empty expectation, an atomic create-only claim, and a lost race is a typed ClaimRace with clean-up and a fresh read of the winner's claim.

### Summary
- 9 findings (0 blocking, 1 important, 5 nit) + 3 praise; the important finding and one nit are fixed in 8344801, four nits stand.
- Justification: scoped re-review of 0187ac5..69cd61c. The only non-openspec changes are the CHANGELOG word (proposed to accepted, matching Status: accepted in ADR 0019) and a comment-only reword of the run-file.mjs header; node --check and scripts/check.py pass. No open blocking or important finding remains. Whole-suite evidence is evidence.md attempt 5 (2106 of 2106), not rerun here. Recommended verdict: approved.
