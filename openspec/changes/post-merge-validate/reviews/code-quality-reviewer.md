Verdict: rejected
Commit: 24725d7f44ce1297d6729258875fd5a93e126a32

## Quality review — post-merge-validate (round 1)

### Findings
- [blocking] plugins/openspec/hooks/change-loop.mjs:1672 — run(['validate', id, '--strict', '--json']) has no --type change. When the change id equals a canonical spec capability name, openspec answers ambiguous_item and the check is cannot-run; the loop then ends blocked as merge-check-failed on every retry and the session cannot fix it. This repo has 7 archived change ids equal to spec names. Reproduced with openspec: validate x --strict --json gives ambiguous_item (Pass --type change|spec.), and --type change gives valid:true. Fix: add --type change and a test with a spec and a change of the same name.
- [nit] openspec/changes/post-merge-validate/evidence.md (AC-8) and proof/real-run-red.jsonl — The stream's init line reports devkit-openspec 0.32.0 for this worktree's plugin folder, while the manifest says 0.40.0; the evidence admits it did not find out why. The merge-check step in the run shows the new code ran, so it is only an unexplained label; note the cause or drop the claim.
- [praise] plugins/openspec/hooks/change-loop.mjs:1611-1630 — The record lives in the git common directory; readMergeCheck takes only a whole record, so a damaged file can never read as green; a table-driven test covers each bad shape.
- [praise] plugins/openspec/hooks/change-loop.test.mjs (post-merge-validate 2 end-to-end tests) — The end-to-end tests use real temporary repositories with a real merge and a real openspec, cover the red-planner-green path, stage headers unchanged, cannot-run with an empty PATH and next exiting 3.
- [praise] plugins/openspec/hooks/change-loop.mjs:1361-1380 — Termination is bounded: reds counted per merge and kept across cannot-run; a fingerprint mismatch re-offers the check; the ceiling is the flow default.

### Summary
- 5 findings (1 blocking, 0 important, 1 nit) + 3 praise
- The decision logic holds up under reading and the phase 1 to 3 tests pass; the one defect is the missing --type change, a one-flag fix that no test or real-run case covers.
