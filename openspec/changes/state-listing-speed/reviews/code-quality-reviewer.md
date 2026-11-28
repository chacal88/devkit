Verdict: approved
Commit: bf3ac7187ecbf45d038e79c94dd4f04b1cbb8a15

## Quality review: state-listing-speed (round 2)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:3463 — r === null branch in the stateListing entry loop is unreachable by construction; if reached, r.id would throw a TypeError. Document the invariant or guard it (round-1 nit, unchanged).
- [praise] plugins/openspec/hooks/change-state-listing.test.mjs:209 — Table-driven test covers every way a read gives no entry and asserts the exact error text and no changes key.
- [praise] plugins/openspec/hooks/change-state-listing.test.mjs:234 — Test pins that the first failure in id order is the one named when two reads fail.

### Summary
- 3 findings (0 blocking, 0 important, 1 nit) + 2 praise.
- Justification: I checked the round-1 nit against the current stateListing and it is unchanged. I read the review-fix diff (0e3bb9f plus the merge's two train-empty message keys). I ran change-state-listing.test.mjs once under node v26.13.1 with TMPDIR=/var/tmp, load about 4: 29 of 29 pass. I did not run the --own-files gate, check the merge's other files beyond the stat, or re-check the proof files. Only a nit is open.
