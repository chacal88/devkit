Verdict: approved
Commit: 683ef5e4366ca827c78c62c48e44cf1ed7d02856

## Coverage analysis — orchestrator-replan (round 2, e6ea4e5..HEAD)

### Findings
- [important] openspec/config.yaml:35 — AC-7 quoting fix had no durable test (an unquoted ': ' in a rules item would make OpenSpec drop the design rules silently) · fixed in d3a9928
- [important] plugins/openspec/hooks/guard.test.mjs:1291-1310 — Supersession was guarded for ADR 0007 only; ADR 0001 superseded, ADR 0010 existing and accepted, and 0010 in the config ADRs line had no test · fixed in d3a9928
- [nit] plugins/openspec/hooks/guard.test.mjs:1312 — Status assertion was coupled to the ADR 0010 file name · fixed in d3a9928
- [nit] openspec/changes/orchestrator-replan/evidence.md (roadmap rows) — The roadmap rewrite (AC-3) is proved by one-off greps and one session-report row; the readRoadmap unit test uses a synthetic fixture. This is a documentation seam, acceptable as is.

In-scope surfaces: docs (ADRs, README, openspec-flow), openspec/config.yaml, release metadata, guard.test.mjs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- ADR 0010 exists and is accepted, with its four required headings -> caught by 'ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the config names it' (guard.test.mjs:1291).
- ADR 0001 and ADR 0007 'superseded by ADR 0010' -> caught by the loop over both files in the same test, using /^- Status: superseded by ADR 0010/m (no file-name coupling).
- config.yaml ADRs line names 0010 -> caught by the same test (find 'ADRs:' line, match /0010/).
- config.yaml rules quoting (AC-7) -> caught by 'config.yaml rules: no list item is an unquoted string holding ": "' (guard.test.mjs:1313). Checked against the real file: the quoted design item at config.yaml:35 is skipped as quoted, the other items hold no ': ', and the test asserts items > 0 so an empty parse cannot pass vacuously. Reintroducing the unquoted form would turn it red.
- ADR 0007 assertion moved out of the ADR 0006 test: no loss, since the new test covers 0007's status, and the 0007 structure and the ADR 0006 'Amended by' note stay asserted (the latter relaxed to a prefix match, which still goes red if the note is removed).

### Well covered
- ADR supersession chain 0001/0007 -> 0010 and config naming, in guard.test.mjs:1291-1310.
- Config rules YAML-safety, in guard.test.mjs:1313-1330.
- Duplicate ADR numbers, in the nums uniqueness assertion in the ADR 0006 test.
