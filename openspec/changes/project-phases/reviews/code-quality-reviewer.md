Verdict: rejected
Commit: 42e107d26510be9337224cc5f8297260b1488fa4

## Quality review — project-phases (round 1)

### Findings
- [important] plugins/openspec/hooks/guard.mjs:262-266 — sliceProblems throws when a slice PR deletes openspec/roadmap.md. The path is in the diff and the roadmap stage is not not-applicable, so `git show ${head}:openspec/roadmap.md` runs outside any try and exits 128. The exception escapes into deliver-check runCi (line 1525) and the gh-pr-create guard instead of becoming a diagnosable problem. No test covers a deleted roadmap.
- [nit] plugins/openspec/hooks/guard.mjs:190-197 — sliceReviewStale diffs each commit against its first parent. A merge of the default branch that brings someone else's docs/adr/ change marks the ADR review stale, although the slice itself did not change. The comment at line 188 says only that a merge that brings none of those files keeps the review current, so this may be intended; document it, or ignore commits that are not first-parent.
- [nit] openspec/changes/project-phases/proposal.md:28 — The proposal says ADR 0014 is `proposed`, but docs/adr/0014-*.md ships `Status: accepted` with the owner's approval recorded. Align the two texts so the proposal does not contradict the diff.
- [praise] plugins/openspec/hooks/change-loop.mjs, guard.mjs — project-loop reuses the existing helpers by exporting them (tryGit, mainRoot, checkoutsOf, NAME, stagePhrase). parseCommitLine moved to guard.mjs and is re-exported from deliver-check, so no second copy exists. One stage-header parser and one slice contract serve both the CI job and the local hook.
- [praise] plugins/openspec/hooks/project-loop.test.mjs — The 1751-line test file covers the scripted runs, the not-applicable path and the flat-layout invariance. Proof files for the scripted and live runs are recorded in the change and match the evidence table.

### Summary
- 5 findings (0 blocking, 1 important, 2 nit) + 2 praise
- Justification: I read project-loop.mjs, the slice contract in guard.mjs (sliceProblems, sliceReviewStale, archivedSliceOf), the guard and deliver-check wiring, the change-loop message and export changes, ADR 0014, config.yaml and evidence.md. I did not re-run the suite: the 1263/1263 result was supplied, and evidence.md and the proof files record real outputs for each AC. No ADR conflict: ADR 0014 amends 0010 and 0012 explicitly, and the owner's approval is recorded. Scope matches the proposal, and the version bumps and CHANGELOG are present. The one important finding is an uncovered edge in the contract function that turns a deleted roadmap into an uncaught exception instead of a diagnosable problem. It fails closed in CI but gives no message. Fix: wrap the `git show` of the head roadmap in try/catch and push a problem such as 'openspec/roadmap.md may not be deleted by a slice', then add one test for the deletion. I did not verify how the hook runner treats the exception in guardBash.
