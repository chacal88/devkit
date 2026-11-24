Verdict: approved
Commit: 796ac2cb75448c7596cc45f0cbe6851d2ccce58f

## ADR review — run-status-bar (round 2 of 2, third round, re-review of 9ad0f6f..HEAD)

### Findings

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`, including its note from state-skips-unlocated, which this branch got from main), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`), ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`) and ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`). I checked the rest of `docs/adr/` by title, including ADR 0029, which main added in this range. No other ADR covers the lines in scope.

Re-review scope: my previous verdict at `9ad0f6f` had no findings, so there was nothing to carry forward. This round covers the change's own commits since then (`9b3da81`, `62bd607`, `0983bd2`, `b892d4f`, `41caadc`, `796ac2c`) and how the merges `4c25ecc` (origin/main `c09860c`) and `e14e1fa` (origin/main `74f2444`) resolved conflicts, compared with both parents. It does not cover main's own commits.

ADR review: pass. 5 ADRs reviewed: ADR 0017, ADR 0002, ADR 0022, ADR 0030, ADR 0026.

- `plugins/openspec/hooks/change-loop.test.mjs:487-501` (`62bd607`, B14b): the test pins ADR 0017 decision 3 to the merge-setup read only. With `offline: true`, the stops `stop-branch`, `stop-archive`, `stop-not-approved` and `blocked` still end `blocked` with their own reasons, and only `stop-merge-setup` ends `waiting-on-github`, `silent`, with the checker's reason as the error. Online, the merge setup still blocks (S-9b), so ADR 0002's merge setup is not weakened. The rest of the commit is a comment in `decide`'s doc block (`change-loop.mjs:1182`). I ran it with the required environment variables and `--concurrency=2`, scoped to `B14`: 2/2 pass (B14 and B14b).
- `plugins/openspec/hooks/change-loop.mjs:2028-2039` (merge `4c25ecc`): the listing tries main's `unplacedAction` stand-in and the archived-date check before `knownChange`. The normal read keeps this change's `stages: true`. That follows ADR 0017's state-skips-unlocated note: one helper outside `nextAction`, shared by the state command and the board. The stand-in carries no `stages`, so its entry reads `stages: null` (E-6 in `change-loop-remote-state.test.mjs`, declared in the plan as D-11 E-6 and in the tasks preamble). The usage line keeps both `--offline` and main's `--stdin`.
- `plugins/openspec/hooks/change-loop.mjs:1525-1527, 1564, 3170, 3178, 3363` (merge `e14e1fa`): `nextAction` takes both main's `fetchBase` and this change's `stages`. Only `next` and `wait` pass `fetchBase`. `state`, which the status bar calls, passes none, so the state is still derived on every read and stored nowhere (ADR 0017 decision 1), and `--offline` adds no network read. `plugins/openspec/hooks/roadmap-loop.mjs:45-48` keeps both imports (`OFFLINE_GH` and `baseFetches`).
- `plugins/openspec/hooks/flow-check.test.mjs` (merge `4c25ecc`): main's stage-ceiling tests sit after this change's helper tests, and neither set changes the other.
- Release (both merges): devkit-openspec 0.46.0 and marketplace 0.51.0, one above main's 0.45.0 and 0.50.0. The `CHANGELOG.md` heading and the four pin lines of `docs/openspec-flow.md` (`v0.46.0`) moved together. The branch keeps its own number for the train to renumber (ADR 0022 decision 3). The pins follow the manifest, and this change does not edit `change-loop-compozy.test.mjs` (ADR 0030 decision 1).
- `openspec/changes/run-status-bar/design.md` and `tasks.md` (`0983bd2`, `41caadc`): they record F10, F11, S-9b, B14b, E-6, the new release target and the owner's accepted limit (`Entregar e seguir`: the coordinator bar prints nothing on this repository because the 11-change offline listing takes 37 to 45 s against the 20 s bound), with the follow-up `state-listing-speed`. For a call past the bound, the bar prints nothing and leaves no process, so no ADR is crossed. The project keeps no open-decisions log.
- `evidence.md`, `review.md` and `reviews/*.md` (`9b3da81`, `b892d4f`, `796ac2c`): these are records. They contradict no ADR. The evidence states that `state` passes no base fetch, which matches the code.
- Every commit on the first-parent line has a conventional message (the merge commits use git's default text, as in earlier rounds).

No open decision is touched, and the change adds no ADR.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
