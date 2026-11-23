Verdict: approved
Commit: 5d0700669d6728e0554f4cfd580f0a5c8711c621

## Quality review — remote-worker 69cd61c..HEAD (round 3, re-review after two merges of main and the plan revision)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1223 — placeFacts runs remoteClaims (ls-remote and gh) on every nextAction at an implementation step with no place taken and no claims passed; reuse the claims result or cache it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1216 (placeFacts) vs :1947 (placeChange) — placeFacts counts places held from stale tracking refs while placeChange counts after a fetch, so take-place can be followed by exit 2 (handled as waiting).
- [nit] plugins/openspec/hooks/machine-probe.mjs:62 — checkout joins id into a path and into git fetch without validating it; the caller validates, a name check in the probe would make it safe alone.
- [important] CHANGELOG.md:15 — The 0.34.0 entry said 'ADR 0019 (proposed)' while the ADR was accepted; the entry now reads 'ADR 0020 (accepted)'. · fixed in 8344801
- [nit] openspec/changes/remote-worker/evidence.md (AC table, L-1 to L-4) — Live proof on real SSH and GitHub is deferred until after the merge by the owner's decision; run it right after the merge, since the change is BREAKING for projects with a remote.
- [nit] plugins/openspec/hooks/run-file.mjs:2 — The header said 'Moved here unchanged' though the move also adds the placed field; it now says the functions moved from change-loop.mjs and also carry placed. · fixed in 8344801
- [praise] docs/adr/0020-a-change-can-run-on-another-machine.md (decision 8), docs/adr/0017-a-change-state-is-derived-in-one-place.md — The ADR 0017 amendment is explicit and bounded: it names the one blocked end that takes the waiting mark with no stop mark and keeps every other blocked end in ADR 0017's form.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs:191 — The two-prs open test follows the claim commit by tightening, not loosening: it still pins that the branch is cut from the remote base tip.
- [praise] plugins/openspec/hooks/change-loop.mjs:1936 — claimOnOrigin uses --force-with-lease with an empty expectation, an atomic create-only claim; a lost race is a typed ClaimRace with clean-up and a fresh read of the winner's claim.
- [praise] plugins/openspec/hooks/change-loop.mjs:1899 — writeClaimKeys before recordPin keeps the pin as the last lines of .openspec.yaml claimed or not, so main's version-pin tests pass with no edit (120/120 targeted); T-19 narrows the AC-4 no-origin regexes to the claim keys, which is the correct assertion once the pin is written.
- [nit] openspec/changes/remote-worker/evidence.md:93 — The AC-10 row says 'ADR 0019 decision 8' for the waiting-title amendment; after the renumber that is main's release-tags ADR, and it should read ADR 0020 decision 8.

### Summary
- 11 findings (0 blocking, 1 important, 5 nit) + 4 praise; the important finding and one nit are fixed in 8344801, four older nits stand, one new nit (evidence.md:93 names ADR 0019 for this change's ADR 0020).
- Conflict resolutions: change-loop.mjs differs from the previous round only by the claim-keys-before-pin reorder and the combined place/flow usage strings; roadmap-loop.mjs, roadmap-loop.test.mjs, SKILL.md, delivery-models.test.mjs, machine-probe.mjs and run-file.mjs show an identical change against main before and after the merges, apart from main's own tag/at/sha params; change-loop.test.mjs keeps main's version: 1 plus this change's params and narrows AC-4 to /x-devkit-(machine|places)/.
- Renumber and release: ADR 0020 is consistent across the ADR links, flow page, config.yaml and CHANGELOG; remaining 0019 references are main's release-tags ADR; CI snippet pin v0.32.0 matches devkit-openspec 0.32.0; marketplace 0.36.0 and the 0.36.0 entry sits above main's 0.35.1.
- Runtime: node --test with the name pattern 'remote AC-(1|4) open|pin' on guard.test.mjs, with TMPDIR=/var/tmp/devkit-remote-worker: 120 tests, 120 pass, 0 fail (includes version-pin AC-1 open against a bare origin, which asserts the pin is the last two lines). python3 scripts/check.py prints 'all checks passed'. The whole suite was not run (evidence attempt 6: 2220/2220 at this tree).
- Justification: no blocking or important finding is open. Recommended verdict: approved.
