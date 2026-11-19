Verdict: rejected
Commit: e6ea4e53955bdd5d53848413ba381083bec4ce7d

## Coverage analysis — orchestrator-replan (origin/main...HEAD)

### Findings
- [important] openspec/config.yaml:35 (rules.design third entry, now quoted) — [6] AC-7 fix has no durable test: if the unquoted `: ` returns, OpenSpec silently drops all three design rules and no test in guard.test.mjs or check.py goes red. Only the one-off evidence row (openspec instructions ... | grep 'ignoring this artifact') proves it. Write in: a follow-up test in guard.test.mjs or a check.py check that parses config.yaml rules as strings. This is outside this change's AC-6 scope, so it is a follow-up and not a gate.
- [important] plugins/openspec/hooks/guard.test.mjs:1296-1316 — [5] The supersession seam is guarded for ADR 0007 only. ADR 0001 `superseded by ADR 0010`, the existence and `accepted` status of ADR 0010, and `0010` in the config.yaml ADRs line are checked only by one-off greps in evidence.md. Deleting ADR 0010 or reverting ADR 0001 to `accepted` leaves the suite green; the existing test still checks only that ADR 0001 names ADR 0006. Follow-up: add the assertions to the existing 'ADR 0006 supersedes ADR 0005...' test, or a sibling ADR 0010 test, in the style of ADR 0004's test at line 592.
- [nit] plugins/openspec/hooks/guard.test.mjs:1312 — Implementation-coupled: the assertion pins the status line plus the ADR 0010 file name, so renaming the ADR file breaks it. `/^- Status: superseded by ADR 0010/m` would keep the contract with less coupling.
- [nit] openspec/changes/orchestrator-replan/evidence.md (roadmap rows) — The roadmap rewrite (AC-3) is proved by a grep for no unticked ids, a count of 11 ticked lines, and one session-report row. The `readRoadmap` unit test at guard.test.mjs:312 covers only a synthetic fixture. The session-report row does exercise the real file, but only once.

In-scope surfaces: docs (ADRs, README, CLAUDE.md, coordination-design.md), openspec/config.yaml and roadmap.md, release metadata (plugin.json, marketplace.json, CHANGELOG), one assertion in guard.test.mjs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- ADR 0007 status line -> caught by the modified assertion at guard.test.mjs:1312, which fails if the status reverts to accepted.
- ADR 0007 keeps its Decision, Consequences, Review trigger and Alternatives headings -> caught by the loop at guard.test.mjs:1313-1315.
- ADR 0006 `Amended by ADR 0007` note -> caught by guard.test.mjs:1316.
- Version 0.14.2 / 0.18.1 / CHANGELOG / CI pin -> the evidence greps plus the existing 'AC-8 release-ready', 'the pin in docs' and 'release-rebase pin' tests that the filtered gate row runs. I did not confirm each of these reads the bumped values, so treat this seam as likely covered, not confirmed.
- config.yaml ADRs line naming 0010 -> gap (F2).
- config.yaml quoting fix -> gap (F1).
- ADR 0001 superseded and ADR 0010 accepted -> gap (F2).
- No agents, skills or schemas touched -> the evidence row `git diff --quiet origin/main -- plugins/*/agents ...` passed.

The gaps are scored important and not blocking for two reasons. First, the change is documents and metadata. Second, AC-6 and A-4 deliberately forbid test additions beyond the single ADR 0007 assertion, so adding tests here would breach the change's own scope. Route F1 and F2 to the roadmap as follow-ups.

### Well covered
- ADR 0007 supersession and its structure -> guard.test.mjs:1312-1316.
- Duplicate ADR numbers -> the `nums` uniqueness assertion at guard.test.mjs:1317-1318 would catch a clash with 0010.
- Docs links, language and catalog -> `scripts/check.py` and `gen-catalog.py --check`, both green at HEAD.
