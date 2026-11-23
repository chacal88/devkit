Verdict: approved
Commit: 043b8e02184136a0b8de618114b3c2c0d53a5bda

## ADR review — change-version-pin

### Findings
- [nit] openspec/changes/change-version-pin/design.md § Decisions and ADRs (no new ADR); docs/adr/0010-openspec-as-the-harness.md; docs/adr/0012-the-reviews-check-follows-the-change-script.md — Earlier changes that altered how a locked ADR's mechanism behaves added a dated Note to the ADR. This change makes the devkit-reviews check and the loop judge a change by its recorded flow, but adds no Note to ADR 0010 or ADR 0012, and the design does not say why none is needed. No decision sentence is contradicted. Still open: design.md is unchanged since the previous round.
- [nit] openspec/changes/change-version-pin/design.md § D-1 and § Decisions and ADRs; plugins/openspec/hooks/deliver-check.mjs checkOne — A pull request can lower its own change's x-devkit-flow to an older kept flow and be judged by it. The design never records that as accepted; ADR 0012 accepts the analogous schema edit because the diff is visible to reviewers, so the design should say the same and cite ADR 0012. Still open: design.md is unchanged since the previous round.

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`), ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`). These are the ADRs the changed lines touch, and I confirmed from the previous round's verdict, the diff stat and design.md that no ADR changed since `c1dc403`. The project has no open-decisions log.

Scope of this re-review: `git diff c1dc403..HEAD`.
- `git diff --stat` shows `plugins/`, `scripts/` and `.claude-plugin/` unchanged, so the conformance results of the previous round still hold.
- `docs/openspec-flow.md`: the one added sentence runs `openspec validate <id> --strict`, copies scenarios main added to a requirement the change modifies, and searches again for removed rules. No ADR decision is touched, and the merge-staleness cost it sits beside is the one ADR 0002 accepts.
- `openspec/specs/change-coordination/spec.md` and `openspec/roadmap.md`: the diff brings in the archived `release-merge-conflict` change from main, which is not this change's work. It does not contradict any ADR in scope.
- `openspec/changes/archive/2026-11-23-release-merge-conflict/retro.md` has no ADR mention.
- `evidence.md` has no ADR mention.

The previous round's two nits (F1, F2) stand with no disposition. Neither blocks.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
