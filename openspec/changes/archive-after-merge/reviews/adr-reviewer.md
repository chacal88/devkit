Verdict: approved
Commit: 1286cfb50d6b8269bf6eea653be6bdc52fbc5f96

## ADR review — archive-after-merge (re-review, round 3, range d50ffb1..1286cfb)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`). Suite not re-run (green at 1286cfb, 381/381, per the caller).

### Findings
- [important] `docs/adr/0003-auto-merge-the-archive-pr.md` § Consequences and § Decision — text stale against the CI archive check and the exempt paths · fixed in 1286cfb50d6b8269bf6eea653be6bdc52fbc5f96

### Verification of the fix
- Context and Consequences now state that `devkit-reviews --ci` checks archive PRs, detected by the archived folder in the diff, and fails on a missing retro, an unanswered proposal or an unnamed file. This matches `archivePrCheck` and the `runCi` problems list in `plugins/openspec/hooks/deliver-check.mjs` (folders from `openspec/changes/archive/<date>-<id>/`; `noRetro`, `unanswered`, `unnamed`; exit 1 on any).
- The Decision's exempt list (`openspec/changes/**`, `openspec/roadmap.md`, version manifests, CHANGELOG, generated catalog) matches `isArchiveRecord` and `RELEASE_FILE`. The old "outside `openspec/`" wording is gone; `openspec/config.yaml` and `openspec/schemas/**` are no longer exempt, in both the ADR and the code.
- The auto-merge conditions (open, no conflict, no failing check, head equal to local head, clean tree, not behind, `--match-head-commit`, disable on drop) agree with the `archiveNext` description in design D8/D10. ADR 0003 and design D10 are consistent.
- ADR 0001 and ADR 0002 are untouched in the range. No new coordinator or state outside the repo and GitHub. No open decisions touched.

### Summary
- 1 finding (0 blocking, 1 important, 0 nit); the important one is fixed. No open findings.
