Verdict: rejected
Commit: 22230be382d0c7f9cbb7f18c6abd865125b602e1

## Quality review — run-status-bar (round 1)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:158-172 — On abort or the 20 s bound only the state child is killed (SIGTERM); its synchronous openspec/gh grandchildren (60 s timeouts) are orphaned and keep running (reproduced with a spawnSync child), contradicting the design's no-piling-up claim; the abort test uses a fixture with no grandchild. Fix: spawn state detached and kill the process group, with a test whose fixture spawns its own child, or narrow the claim.
- [nit] CHANGELOG.md (0.44.0 entry) — Claims the bar starts no process but node and git; the state it runs starts openspec and gh. Say the bar itself starts only node and git.
- [nit] docs/openspec-flow.md and plugins/openspec/README.md (statusLine snippet) — The snippet hardcodes --lang pt-BR in English docs; add a note that --lang en gives English.
- [praise] plugins/openspec/hooks/flow-check.mjs (notApplicableOf, appliedStages) — One shared helper for the stage-applies rule used by artifactState and the new stages field; refactor is behaviour-preserving and pinned per code.
- [praise] plugins/openspec/hooks/merge-setup.mjs, roadmap-loop.mjs — OFFLINE_GH has a single home and a test asserts roadmap-loop defines no copy.
- [praise] plugins/openspec/hooks/status-line.test.mjs — Every declared variant (states, strip positions, each cut step, the 100-column boundary, archive branch, mismatched entry, abort, open stdin) has its own test, plus a source scan pinning read-only and mock-up lines checked against the mock files.

### Summary
- 4 findings (0 blocking, 1 important, 2 nit) + 3 praise. The count excludes the praise.
- Justification: the diff matches the proposal and the spec deltas. The `state` change keeps `next`'s shape (`stages` is added only for `state`, and `NEXT_ONLY` was updated in the same diff). The bar only reads, always exits 0, and checks the entry's root and branch before drawing. The one real defect is the orphaned `openspec`/`gh` grandchildren when a refresh is aborted or hits the 20 s bound, which the design presents as handled. Evidence has a real run for the running and approval lines, both languages, counts, nothing-conducted and a budget cap. The blocked, GitHub-wait, archived, cut-at-100-columns and abort-with-real-state variants are proven by tests only, and the repository's real-run rule targets changes to what an agent writes, so no finding was raised for it.
- Ran `status-line.test.mjs` and `change-state-stages.test.mjs` together: 181 tests, 0 fail. The whole suite and `guard.test.mjs` were not re-run, as instructed.
