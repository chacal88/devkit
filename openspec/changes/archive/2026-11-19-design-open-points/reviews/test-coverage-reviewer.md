Verdict: approved
Commit: b589e357de07a7d2ef1f1264625772700a8770c8

## Coverage analysis — design-open-points (origin/main...HEAD)

### Findings
- [nit] openspec/roadmap.md:78 (Round 27) and plugins/openspec/hooks/guard.test.mjs:313 — The AC-2 claim that the new `- [ ] lean-pr-template` line parses in the grammar `guard.mjs session` reads, and that round 14 stays current, is pinned only by a synthetic-roadmap test. Nothing reads the real roadmap. Edits to the real file, such as a malformed line or a stray `(after:`, would not turn any test red. I ran `guard.mjs session` by hand and it still reports round 14 as current, so the claim holds today. Backlog item at most; no new test is needed for this change.
- [praise] plugins/openspec/hooks/guard.test.mjs:1291 — The ADR 0010 test pins `- Status: accepted` and the four headings. The new Note sits under `## Context` and leaves both intact, so a regression that stripped them would turn the suite red.

In-scope surfaces: documents only (`docs/coordination-design.md`, `docs/adr/0010-openspec-as-the-harness.md`, `openspec/roadmap.md`). No file under `plugins/` changes.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- ADR 0010 accepted status and headings: caught by the ADR 0010 test at guard.test.mjs:1291.
- Docs sweep over `docs/*.md` for the "never merges" and "the merge is the owner's" phrases: caught by deliver-check.test.mjs:3318. The new text adds neither phrase.
- English-only prose and links in the changed Markdown: caught by `scripts/check.py`, which the caller reports as passing.
- Roadmap grammar and session reading: the parser is covered by the synthetic fixture at guard.test.mjs:313. I ran `guard.mjs session` on the real roadmap and it still reports round 14 as current (0/1 done), so the AC-2 claim holds today. The real file itself has no test (see F1).
- Sentences the answers make false: I grepped `docs/*.md`, `openspec/roadmap.md` and the skills for "Jira" next to "read-only" or "only reads" and found no hits. The remaining `proposed` and `(open)` markers in `docs/coordination-design.md` belong to points nobody answered, and the "All proposed" line in section 13 is amended.

Assessment: the change adds no behaviour, so the remaining statements in the documents (the answers recorded, who decided each, the round 27 debt) are plain statements, not behaviours a test could break. They are held in place by the proof rows in `evidence.md` and the checkers above, and there is no cross-process flow to prove.

### Well covered
- ADR 0010 acceptance and structure: guard.test.mjs:1291.
- English prose, links and catalog freshness: `scripts/check.py` and `scripts/gen-catalog.py --check`.
- The "never merges" and "the merge is the owner's" phrases: the deliver-check docs sweep at deliver-check.test.mjs:3318.
