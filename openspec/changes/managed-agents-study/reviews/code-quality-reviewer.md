Verdict: rejected
Commit: 2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34

## Quality review — managed-agents-study (round 1)

### Findings
- [important] openspec/roadmap.md (coordination-panels addition) and study.md L-3 — The sentence says the panels read each change's state 'once that change is archived'. It should name `change-state` as the one archived first. As written it says the opposite of what F-1 means, and `coordination-panels` has no `after: change-state`, so round 23 can start before the command exists. Reword it to 'once change-state is archived', or add the dependency. The owner approved the old text, so the fix needs re-approval.
- [nit] study.md F-3 (ADR field) vs the preface — The preface says the ADR field is filled only when an item contradicts an ADR. F-3 fills it with ADR 0011 although its own 'What changes' says 'nothing now'. The collision only arises if the coordinator itself moves. Say so in the field, or leave it at none and keep the point in L-5.
- [nit] study.md X-3 — The item leans on ADR 0006 for 'no cron'. ADR 0006 is itself superseded (by ADR 0010 via ADR 0007). The live rule is in the `devkit` skill, line 131, and ADR 0010. Cite those.
- [nit] evidence.md AC-7 and AC-8 rows — AC-7 says 'not independently judged' for the `ADR: none` items. AC-8 says it 'cannot be replayed'. Neither has real output. Both are accepted because the study is documentation and the owner answers were given live.
- [praise] study.md F-1 and F-2 — Both items reject a stored event log, citing ADR 0010 decisions 3 and 6 and the rejected alternative 'A session that remembers where it is'. They propose a derived state and a budget counted from the transcripts' `usage` fields.
- [praise] study.md Open points O-1 to O-7 — Every unverifiable fact is marked 'not stated in the docs' and tied to an open point for the `remote-worker` grill.

### Summary
- 6 findings (0 blocking, 1 important, 3 nit) + 2 praise.
- I read the whole of `study.md` and the roadmap diff. Scope matches the proposal: only Markdown under `openspec/`, and no `[x]` line changed. `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `openspec validate managed-agents-study --strict` pass. The Managed Agents page facts could not be re-checked offline and rest on the author's reading on 2026-11-21.
