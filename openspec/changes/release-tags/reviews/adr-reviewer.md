Verdict: rejected
Commit: 0bf76b45f9360e60d58bae1d927a5475b914dc2b

## ADR review — release-tags

### Findings
- [important] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md § Decision 3 and Consequences — Decision 3 promises the archive merge's tag before `archived`, but the design (R-3) and flow page say a run from a checkout other than chore/archive-<id> ends archived without asking it; the ADR does not record this limit.
- [nit] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md:3-4 — Header has two `Status:` lines (the second `Status: Accepted by: ...`); ADR 0017 and 0018 use a separate `Accepted by:` line.

ADRs reviewed: ADR 0019, 0002, 0003, 0004, 0010, 0017, 0018.

### Conformance checks that passed
Opt-in (ADR 0004): the key is read in guard.mjs, change-loop.mjs and deliver-check.mjs, and no extra gh call is made without it. Bump and merge rules: first-parent comparison, only merges into base, change PR and archive PR both checked. Step and rows: R1 to R3 ahead of P0, a session(delivery) row, one of the four end states, unreadable is the existing stop-archive. Tag handling: a tag at the merge commit is done, a tag elsewhere is blocked tag-elsewhere, ship-change never forces or uses --tags. Facts come through gh. Not an amendment: a tag push is not a push to the default branch. Docs cite ADR 0019. The test suite was not run.

### Summary
- 2 findings (0 blocking, 1 important, 1 nit)
