Verdict: approved
Commit: c4df82e6540e9124d8278304a948ddac922d7d39

## Quality review — archive-release-pin, delivered head after train 4 (round 6, stage 1)

### Findings
- [important] openspec/changes/archive-release-pin/proof/real-run-head.txt; evidence.md — Real-run proof was on the old pin file path; shipped-path proof re-run · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md — Pin-only CI scenario named the wrong test file · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/design.md; tasks.md; requirements.md — Plan records still name change-loop.test.mjs in 33 places (mostly history, unamended)
- [nit] docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md:6-14 — Accepted ADR edited after acceptance (header line and dated Note); Decision text still states the test-file rule, marked only by the Note
- [nit] openspec/changes/archive-release-pin/evidence.md:23-28 — Gate commands 1.5 and 2.4 select only 10 and 2 tests as written; backed by runs A and B on the files that hold the tests
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1060,1078-1090,1128-1148 — Stale LOOP_PATH comment says the file holds the Invariant pin block; tests 3 and 4 only re-prove the early path return
- [praise] plugins/openspec/hooks/deliver-check.mjs:1359-1370 — Test-file half removed whole; pinLinesOnly stays pure and fail-closed, RELEASE_FILE and unnamedFiles untouched so both callers keep one rule
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs:1273-1300 — Test 12 makes 'no release edits the pin test' an executable check (no version literal outside the v0.20.0 floor, no change name, manifest read kept)

### Re-check since 207e06e
- `git diff --stat 207e06e..HEAD -- . ':!openspec'` is empty (confirmed). The 8 changed files are all under `openspec/`: `trains/4.md`, `evidence.md` (attempt 8), `review.md` and the five reviewer files. The pin code, the tests, ADR 0027 and the plan files are byte-identical to 207e06e.
- `openspec/trains/4.md` records train 4 as passed: `archive-release-pin` boarded as #107, run 1 passed at 039f648. `forced-merge-path` (#118) left on a conflict in files this change also touches; that is another change and is not under review.
- Previous findings: both `important` stay fixed in 211c1eb; the 4 `nit` are unchanged and open (counts and line ranges re-verified: 33 stale mentions, ADR 0027 lines 6-14, LOOP_PATH comment at test line 1060).
- Filtered foreground run (TMPDIR=/var/tmp/devkit-archive-release-pin): `deliver-check-archive.test.mjs` with pattern `archive-release-pin` gives 11 of 11 pass (tests 1-9, 11, 12). Test 10 lives in the release-merge file and was not re-run. Whole suite not run, by instruction (last full run is proof/full-suite.txt, and train 4 ran it at 039f648: passed). Tree clean afterwards.

### Summary
- 8 findings (0 blocking, 0 important open, 4 nit open) + 2 praise; both previous important findings are fixed in 211c1eb.
- Justification: the code is unchanged against the previously approved Commit, the only deltas are the train record, evidence attempt 8 and review files, and the filtered tests pass at the delivered head. Suggested verdict: approved.
