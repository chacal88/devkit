Verdict: approved
Commit: 4f6d958d353b78c317244ddf0763268d7829e5bd

## ADR review — coordinator-field-fixes (round 2)

### Findings

ADRs reviewed: ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`), ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`).

Round 1 had no blocking or important findings, so there is nothing to re-list. Its three nits still stand and the range does not touch them: the ADR 0012 header citations on ADRs 0002 to 0004, the ADR 0003 Note on when the archive starts, and the D-7 citation of ADR 0002 and ADR 0010 decision 6.

The range is `403b38c..HEAD`. `fb91e5f` changes only `change-loop.mjs` and its tests: a reused archived id is listed again when its active folder was created after the archive. `createdAfter` reads only the change's own `.openspec.yaml` and fails soft, which conforms to ADR 0010 and ADR 0011 (state in the repo and GitHub, fail-open). The ADR 0012 CI path is untouched. `4f6d958` is evidence only. No open decision is touched.

### Summary
- 0 findings in this range (0 blocking, 0 important, 0 new nits)
