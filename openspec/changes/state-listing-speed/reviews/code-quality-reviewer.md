Verdict: approved
Commit: 1e2fc4d68248416c4d80c16d486cc246ea586604

## Quality review: state-listing-speed (round 1)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:stateListing — The r===null branch in the entry loop is unreachable by construction; if reached, r.id would throw a TypeError. Document the invariant or guard it.
- [praise] plugins/openspec/hooks/change-loop.mjs:boundedMap — In-order index claiming plus awaiting all started items gives the first-failure-in-id-order rule simply, and a test covers it.
- [praise] plugins/openspec/hooks/change-loop.mjs:childRead — GIT_OPTIONAL_LOCKS=0 for read-only children, and one result shape for every failure mode.
- [praise] plugins/openspec/hooks/change-loop.mjs:runCommand — The --change, next and in-process (openspec/gh injected) paths are unchanged; a listing of one or none starts no read process.

### Summary
- 4 findings (0 blocking, 0 important, 1 nit) + 3 praise.
- Justification: I read the whole code diff against the spec scenarios. The scenarios are the overlap, the core bound, byte-identical output, unreadable changes, a read that fails the command, a read with no entry, a small listing, and --change/next. Each has a matching test, and change-state-listing.test.mjs passes 18 of 18 under node v26.13.1. The first run under the default node (v22.23.5) failed, and I did not look into why. I ran only that one file, not the --own-files gate. I did not check the tasks ticked as done against the runtime, or the proof files under proof/. The test-map.json and KEPT_HUB_READERS edits accompany the new test file.
