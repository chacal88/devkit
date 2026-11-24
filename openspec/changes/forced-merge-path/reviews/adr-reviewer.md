Verdict: approved
Commit: 470a8ca1785f800a8d4ee4d5858be00edc9e6d61

## ADR review — forced-merge-path (round 3, stale-only re-review)

### Findings
- [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 (Note on the checks) — Round-2 finding: ADR 0028 decision 1 named check and devkit-reviews while the checker and spec use the checks the default branch requires plus devkit-reviews when it reported; a dated Note now states the specced rule. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 (Number line) — Round-2 finding: the Number line did not say that 0027 is held by the sibling archive-release-pin; it now names 0025/0026 on origin/main and 0027 on the sibling. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md:14 — The Number line is now out of date: 0027 and 0030 are on main after the merges and 0029 is free, so 0028 does not collide. Say so at the last merge of main, as the line already asks.

ADRs reviewed: ADR 0028 (`docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), plus ADR 0027 and 0030 as they arrived from main.

Scope: d0a2b37..470a8ca, which holds the two merges of origin/main (train 4 and train 6) and the re-recorded evidence. I ran no tests; the suite is the train's job. `python3 scripts/check.py` passes.

What the merges changed in my remit:
- ADR numbering: ADR 0028 keeps its number. 0027 and 0030 arrived from main, and no file shares a number with another.
- ADR 0003: the header lists the amendments by ADR 0018, 0027, 0028 and 0030. The 0028 amendment I reviewed earlier is intact, and no conflict marker remains in any file I opened.
- Release numbers: the manifest is at 0.43.0 and the marketplace at 0.48.0. `docs/openspec-flow.md` pins `v0.43.0` and the CHANGELOG entry for 0.48.0 matches the renumbered release. That is consistent with ADR 0027 and 0030, which let only the CI pin lines pass unnamed.
- ADR 0017: the Note from post-merge-validate adds the merge-check record as an input of decision 1. It is a fact derived on every read, and the loop still derives state in one place. The forced-merge `reply` in `change-loop.mjs` (lines 1349, 1386-1388) works from the row's `next.forced`, so it adds no second derivation and writes no gate file (ADR 0016).
- Composition: main's new `merge-check` step and `forced` do not conflict. The forced path skips the test stage and leads to the retro and then the archive, as ADR 0028 decides.

Summary: 3 findings (0 blocking, 1 important fixed, 2 nit of which 1 fixed and 1 open); the verdict stands as approved.
