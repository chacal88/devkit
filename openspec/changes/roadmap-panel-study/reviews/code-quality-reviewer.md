Verdict: rejected
Commit: 9396c3575d5b5eb2891b1c8dcb1e6ea7d846937f

## Quality review: roadmap-panel-study (round 1)

### Findings
- [important] openspec/changes/roadmap-panel-study/design.md:133,231,279 — R-12 (stage dots) is taken from flow-check per change, while D-5 says never from stage files one by one citing ADR 0017 decision 1 (which only says the panels read the state command); D-4 and D-5 contradict each other as copyable lines.
- [important] openspec/changes/roadmap-panel-study/design.md:280,283,297,301 — D-6 (5 min timer, one read at a time) and D-9 are stated as decisions though the measured whole-run read (36 s + 60-75 s + per-change flow-check + 20 s per machine) exceeds the old 60 s limit and O-12 and O-18 leave both open.
- [nit] openspec/changes/roadmap-panel-study/design.md:41-63 — Pasted board keeps the owner's machine names (MacBook-Pro-2, avell) while the personal path in root is scrubbed; inconsistent for a public repo. No e-mail, path or reference project name found.
- [nit] openspec/changes/roadmap-panel-study/design.md:124,302 — R-3 is marked given but O-19 says it is unknown whether the reference's ready excludes changes waiting for a dependency.
- [nit] openspec/changes/roadmap-panel-study/design.md:86,237 — Whole-clone state timings (60 s, 75 s) and the 10-entry count are not reproduced in evidence.md; disclosed as a single loaded-machine measurement.
- [praise] openspec/changes/roadmap-panel-study/design.md:31,86 — Discloses that the print differs from the planning snapshot and turns the two unexplained board facts into open points O-14 and O-15 instead of guessing.
- [praise] openspec/changes/roadmap-panel-study/design.md:195-211 — One fate row per entry of plugins/panel/hooks/ (15 of 15), each with a reason tied to D-6 or D-9.
- [praise] openspec/changes/roadmap-panel-study/design.md:144-150 — Every dropped field has a stated reason and every gap id is cited in a field row and traced to an open-point line.

### Summary
- 8 findings (0 blocking, 2 important, 3 nit) + 3 praise.
- Justification: the change is a study; the diff adds files only under openspec/changes/roadmap-panel-study/ and nothing under plugins/ or scripts/. Code and ADR citations were spot-checked and hold. Every AC has real output in evidence.md. The two important findings are internal contradictions in the grill input (D-4 against D-5, and decisions D-6 and D-9 that rest on open points), not false claims about the code.
