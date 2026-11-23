Verdict: approved
Commit: 827f66034b77129a1243860bc6016edc2f2f2e71

## Coverage analysis — project-phases-followups (origin/main...HEAD)

### Findings
- [praise] plugins/openspec/hooks/project-loop.test.mjs followups 6/7 — Uncommitted-marker refusal pinned in CI and PR-create hook, including precedence over the unresolved-commit message.
- [praise] plugins/openspec/hooks/project-loop.test.mjs followups 8/9 — record-review refusal (both languages, nothing written) and next-step routing for a marked verdict, active and archived, are pinned and were red before the fix.
- [nit] plugins/openspec/hooks/project-loop.mjs:309 — Status readout (sliceReviewStale gated on verdict.usable) with an uncommitted-marked verdict has no direct assertion; only the next/record paths are tested.
- [nit] plugins/openspec/hooks/project-loop.test.mjs followups 7 — The gh pr create hook is tested only with a resolvable commit marked uncommitted; the unresolvable plus marker precedence is asserted only via the CI path (followups 6).

In-scope surfaces: plugins/openspec hooks (guard.mjs, project-loop.mjs, change-loop.mjs messages), docs.
Blocking gaps (8-10 without a plan): 0
Seams checked: sliceProblems uncommitted branch -> caught by followups 6, 7; readVerdict.usable -> followups 9; recordReviewCommand uncommitted refusal -> followups 8; why.uncommitted message en/pt-BR -> followups 8 (+ change-loop replies); sliceReviewStale merge bringing an ADR -> followups 10 (a pin, already green before the change); unresolved Commit, malformed header and missing base ref -> followups 1 to 5 (pins of existing behavior); release pin -> change-loop docs test updated (mutation runs: 0). The commit a8b07da..827f660 adds only evidence.md; nothing else changed.

### Well covered
- Uncommitted ADR verdict refusal in the contract, the loop and record-review: followups 6 to 9.
- Fail-closed branches of sliceProblems: followups 1 to 5, using literal fixtures from sliceRepo, which is the same producer the existing contract tests use.
