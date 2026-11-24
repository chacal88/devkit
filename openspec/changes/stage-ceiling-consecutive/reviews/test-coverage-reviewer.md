Verdict: approved
Commit: db246141622b2267a22defb1129d0785f7d39982

## Coverage analysis — stage-ceiling-consecutive, round 1 of 2, head db24614, range origin/main...HEAD

### Findings
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:303-364 — The CI pin test now reads the version from the manifest and asserts every pin in docs/openspec-flow.md equals it; v0.40.1 matches, so the release renumbering is guarded by content, not by a hand-edited literal.
- [praise] plugins/openspec/hooks/flow-check.test.mjs (stage-ceiling-consecutive AC-1..AC-7) — The seams (history read, count in computeFlow, failures param into change-loop and project-loop replies, briefs with fallback) each have a named test, and the flow-check ones were shown red on the old code.
- [nit] openspec/roadmap.md:79, openspec/changes/stage-ceiling-consecutive/tasks.md:133 — AC-8 (the roadmap line says it was delivered by this change; the archive follow-up ticks both lines) has no automated check, only the grep proof in evidence.md; if the note is dropped in a merge, no test goes red. Proportionate for a roadmap note (score 2).

In-scope surfaces: plugins/openspec/hooks (flow-check.mjs, change-loop.mjs, project-loop.mjs and their tests), release files (marketplace.json, plugin.json, CHANGELOG.md), docs/openspec-flow.md, docs/coordination-design.md, plugins/openspec/README.md, openspec/roadmap.md.
Blocking gaps (8-10 without a plan): 0
Seams checked: history read into the count (facts.history in collectFlow) -> flow-check AC-4 H-3..H-5 and F-1..F-4; count against the ceiling (computeFlow raw.failures >= ceiling) -> flow-check AC-1, AC-2, AC-3, AC-7; failures param into the change-loop blocked reply -> AC-6 loop ceiling reply test; failures param into the project-loop blocked reply -> AC-6 project-loop test; the briefs of plan fix and fix-tests with their fallback to attempt -> the two AC-6 loop tests in change-loop-compozy.test.mjs; CI pin versus manifest -> change-loop docs: the design records the answers (reads plugin.json; v0.40.1 matches); release numbers -> scripts/check.py (marketplace version has a CHANGELOG entry; passed). (mutation runs: 0)

Run at db24614 with TMPDIR=/var/tmp/devkit-stage-ceiling-consecutive: node scripts/test-suite.mjs on flow-check, change-loop, project-loop and change-loop-compozy test files: 4 files, 649 tests, 649 pass, 0 fail, exit 0. python3 scripts/check.py: all checks passed.

Unchanged since 849d5c7: flow-check.mjs, change-loop.mjs, project-loop.mjs and their tests, so the earlier seam mapping stands. New since then: main's merge (the CI pin test takes main's form and reads plugin.json, so this change no longer edits its literals), the renumbered release (devkit-openspec 0.40.1 = main's 0.40.0 plus a patch, marketplace 0.45.1 over main's 0.45.0, CHANGELOG 0.45.1 above 0.45.0, CI pin v0.40.1 in docs/openspec-flow.md), the reworded AC-8 and the refreshed evidence. None adds an untested behaviour.

### Well covered
- Count of failures in a row, including a pass between failures and takes retaken after a merge of main: the 17 stage-ceiling-consecutive tests in flow-check.test.mjs, red on the old code (proof/red-flow-check.txt).
- Fallback to today's rule when history is unreadable: AC-4 F-1..F-4 and the no-history-fact walk.
- Readout in both languages and the change-loop and project-loop replies: the AC-6 tests, plus the updated version-pin and change-loop-remote-state literals.
- CI pin versus manifest: the docs test now release-proof.
