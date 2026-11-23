Verdict: approved
Commit: 5d0700669d6728e0554f4cfd580f0a5c8711c621

## Coverage analysis: remote-worker (69cd61c..HEAD, round 1 of 2 of this staged review)

### Findings
- [important] plugins/openspec/hooks/machine-probe.mjs installationFor — Previous finding: pack installation choice is covered by the scope and path test in roadmap-loop.test.mjs · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/machine-probe.mjs state error paths — Previous finding: the probe's error replies are asserted by the exit 3 test · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/change-loop.mjs claimThroughGh — Previous finding: the gh read parse is asserted by the listing test in change-loop.test.mjs · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [nit] plugins/openspec/hooks/change-loop.mjs placeChange — Previous nit, still open: a fetch failure in place is untested (the refused push is covered by the two-changes-at-once place test)
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs ssh test — Previous nit, still open: the test asserts exact ssh timeouts and the argv prefix (implementation-coupled)
- [nit] plugins/openspec/hooks/change-loop.mjs:754-756,1504 — Previous nit, still open: the place-wait stateIcon null and no-place reason text are asserted only through decide's sessionTitle; changeState with facts and the status row have no no-place test
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md header — Previous nit, still open: no test pins the ADR 0020 amendment chain (Amended by lines in ADRs 0010, 0011, 0013, 0014, 0017); check.py only verifies the links resolve
- [nit] plugins/openspec/hooks/change-loop.test.mjs:3636-3649 — remote AC-4 open (T-19) no longer asserts anything about the pin on a no-origin open; the pin is main's coverage, so only a note, no action needed
- [praise] plugins/openspec/hooks/version-pin.test.mjs:553-565 — version-pin AC-1 open runs with a real bare origin and default claim, so its endsWith pin assertion catches a swap of the claim keys and the pin

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, roadmap-loop.mjs and their tests), devkit SKILL.md, and the ADR 0020 renumbering. Main's own changes in the merges are not under review.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): claim keys before the pin (caught by version-pin AC-1 open, endsWith pin, and by remote AC-2 open for the keys); claimOnOrigin only commits and pushes (remote AC-2/AC-3 open and the two-clones race); T-19 narrowed no-origin regex (remote AC-4 open, both cases); roadmap-loop.mjs conflict resolution (stageTitleOf/isPreviousScript exports, remote entry state, elsewhere, --machines plumbing, BLOCKED_PARAMS with tag/at/sha); change-loop.mjs conflict resolution (place-wait next to tag-elsewhere in decide, flow subcommand in the skill test, accept-decisions status lines); SKILL.md session bullet (take-place, tag-release and the rest kept together; release-tags 3 pins the tag-release sentence); ADR 0019 to 0020 rename (all links resolve, main's release-tags 4 tests keep pinning main's ADR 0019). Targeted run: remote AC-1..4 open, version-pin AC-1 open, change-state AC-3 state and stage-roles accept-decisions: 68/68 pass. Not run: the whole suite.
No new finding changes the verdict. The three important findings of the previous round stay fixed in 7b9c499; its four nits stay open as they stand.

### Well covered
- Claim keys before the pin: version-pin AC-1 open goes red on the endsWith pin assertion if the order is swapped; it runs with a real origin.
- Claim commit and push only: remote AC-2 open, the lost-race remote AC-3 open and the two-clones test, on real clones and a bare origin.
- No origin means no claim keys and no commit: remote AC-4 open, with the key regex now correctly narrowed.
- tag-elsewhere next to place-wait: change-state AC-3 state and the sessionTitle tests.
