Verdict: approved
Commit: 224bba238de37259d7daa6e183ba6477a3052c07

## Quality review — fresh-base-check (round 3)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1465-1489 — refreshBase is a small, well-bounded unit. It fetches one refspec with --no-tags and --no-write-fetch-head, and sets GIT_TERMINAL_PROMPT=0 and a timeout. It memoizes per (git common dir, base) and returns null when there is no origin. A failure becomes a diagnosable { ok:false, error } instead of a throw.
- [praise] plugins/openspec/hooks/change-loop.mjs:2576-2587 — ownReply keeps the unfetched line out of decisionKey, so a failing fetch does not make every poll of a wait look like a new decision. The wait still ends on a real change.
- [nit] plugins/openspec/hooks/change-loop.mjs:1549 — New: `const baseBranch = defaultBase(found.root)` is declared again inside the inDelivery block and shadows the identical outer one at line 1547. This costs a second git call. Drop the inner declaration.
- [nit] plugins/openspec/hooks/change-loop.mjs:1511-1550 — Round 1, still standing: fetchBase is documented as a baseFetches() record but typed as a bare truthy flag. Passing `true` would throw at memo.has. Guard with instanceof Map or rename.
- [nit] plugins/openspec/hooks/change-loop.mjs:1483 — Round 1, still standing: any e.signal is reported as 'timed out after N s'. Test e.code === 'ETIMEDOUT' or SIGTERM to keep the message honest.
- [nit] openspec/changes/fresh-base-check/proposal.md (Impact) — Round 1, still standing: Impact says MERGE_CONFIG, MERGE_FILES and presetMerge are exported from conduct-check.test.mjs, but they moved to test-fixtures.mjs. It also lists docs/catalog.md as regenerated, but the diff does not touch it.
- [nit] plugins/openspec/hooks/change-loop.mjs:1476 — Round 1, still standing: on git older than 2.29, --no-write-fetch-head makes every fetch fail, so every action carries the unfetched line. A one-line CHANGELOG or flow-doc mention would help diagnosis.

### Summary
- 7 findings (0 blocking, 0 important, 5 nit) + 2 praise
- Justification: Round 3 reviews only this change's own lines against origin/main. The fetch code in change-loop.mjs and its wiring in roadmap-loop.mjs are consistent. nextAction fetches only when `fetchBase` is given. `next`, `wait`, `roadmap run` and `roadmap next` pass a fresh baseFetches() per call or per poll, while `state`, `status` and the locks pass nothing, which matches the 'checkers stay offline' claim. The deliver-check header comment was updated to say it never fetches.
- Release numbering checks out. devkit-openspec is 0.45.0 in plugin.json and marketplace.json, the marketplace is 0.50.0 with a matching CHANGELOG 0.50.0 entry, and origin/main's last release (as of my last fetch) is 0.44.1 / 0.49.1, so the renumbering sits above it.
- The only new nit is the redundant shadowed `baseBranch`, which is harmless. The four round-1 nits are unchanged because the production logic has not changed. The round-2 praise on tests 19 and 20 still holds, and I did not re-run those tests.
- Rationale vs diff: the proposal says the checkers are untouched. The diff touches only a comment in deliver-check.mjs, so the claim holds.
