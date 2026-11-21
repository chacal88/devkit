Verdict: rejected
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## Quality review — coordinator-field-fixes (round 1)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:unfinished/note — An id archived once and reopened under the same id is hidden from the unfinished list, even from a worktree on its own branch (0.16.0 kept it); no test covers a reused id.
- [nit] plugins/openspec/hooks/deliver-check.mjs:findChangePr list path — Up to 100 per-PR file reads (N+1); same shape as before, not a regression.
- [nit] plugins/openspec/hooks/change-loop.mjs:archivedOnDefault — The main checkout working-tree archive folder counts as archived even if that checkout sits on an unmerged archive branch; same as the old read.
- [praise] plugins/openspec/hooks/deliver-check.mjs:isOwnPr/deliveryOf — Delivered is decided by the PR's own files plus tasks on the default branch, not by body or head name.
- [praise] plugins/openspec/hooks/guard.mjs:openspecCli — One shared resolver for the project's pinned OpenSpec CLI, worktree-aware, with actionable refusals.
- [praise] plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs — Manifest digests separate update from edited and fail safe without a manifest; --accept is limited to kit paths.
- [praise] docs/adr/0012-the-reviews-check-follows-the-change-script.md — Records the accepted cost of the schema-edit escape and its mitigation.

### Summary
- 7 findings (0 blocking, 1 important, 2 nit) + 4 praise
- Justification: proposal, ADR 0012, tasks (none unticked) and evidence.md read; every production change read; the evidence ties each AC to a named test and a red run on 0.16.0 and includes a real run of change-loop start in this repo. Suites were not re-run, as instructed. One open important finding (reused archived id regression in unfinished()) keeps the verdict rejected.
