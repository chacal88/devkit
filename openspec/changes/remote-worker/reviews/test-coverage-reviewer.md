Verdict: approved
Commit: 0187ac5c256f95f11156fa0df78a14c03c9d1801

## Coverage analysis — remote-worker (7b9c499..HEAD, re-review round 1 of 2)

### Findings
- [important] plugins/openspec/hooks/machine-probe.mjs installationFor — Previous finding: the pack installation choice is covered by the scope and path test in roadmap-loop.test.mjs · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/machine-probe.mjs state error paths — Previous finding: the probe's error replies are asserted by the exit 3 test · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/change-loop.mjs claimThroughGh — Previous finding: the gh read parse is asserted by the listing test in change-loop.test.mjs · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [nit] plugins/openspec/hooks/change-loop.mjs placeChange — Previous nit, still open: a fetch failure in place is untested (the refused push is covered by the two-changes-at-once place test)
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs ssh test — Previous nit, still open: the test asserts exact ssh timeouts and the argv prefix (implementation-coupled)
- [nit] plugins/openspec/hooks/change-loop.mjs:754-756,1504 — The place-wait stateIcon null and the no-place reason text are asserted only through decide's sessionTitle; changeState with facts and the status row have no no-place test. Write in change-loop.test.mjs, change-state AC family.
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md header — No test pins the ADR 0019 amendment chain (Amended by lines in ADRs 0010, 0011, 0013, 0014, 0017 and the 0017 Note); earlier changes pinned theirs.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs:191 — T-14 edit is stricter than the old assertion: HEAD^ must equal origin/main, so a missing claim commit or a wrong base tip turns it red.

## Coverage analysis — remote-worker (7b9c499..HEAD, re-review round 1 of 2)

In-scope surfaces: plugins/openspec hooks (change-loop, roadmap-loop, machine-probe, run-file, delivery-models test), docs/adr.
Blocking gaps (8-10 without a plan): 0
Seams checked: place-wait title (changeState stateIcon null for no-place) -> caught by `remote AC-10 next: with no free place the change ends waiting for a place, icon ⏳` (asserts a.sessionTitle '⏳ mine', which comes from changeState().title); T-14 two-prs open from origin/<base> -> caught by `delivery-models open: a two-prs change starts from origin/<base>` (HEAD^ equals origin/main); run-file move and re-export -> caught by `followups AC-3 run file` and the `remote AC-10` tests that read places from the run file; wake of a waiting change -> caught by `remote AC-11`; place race of two changes -> caught by `remote AC-10 place: two changes of one machine at once`; probe and claim seams from round 2 -> unchanged and green. Mutation runs: 0.

Targeted runs with TMPDIR=/var/tmp: `delivery-models open`, `change-state AC-3`, `change-state AC-7`, `remote AC-10` (83/83 pass); `followups AC-3`, `remote AC-9`, `remote AC-11`, `remote AC-12` (12/12 pass). The whole suite was not run (evidence.md attempt 4 and gate 5.10 report 2106/2106).

### Well covered
- Two-prs open starting from origin/<base> with the claim commit on top (T-14).
- The place-wait title with no stop icon, through the real decide path.
- The claim race of two clones and the place race of two changes, on real clones and a real origin.
- Wake of changes waiting for a place, on this machine and on another, in session mode only.
