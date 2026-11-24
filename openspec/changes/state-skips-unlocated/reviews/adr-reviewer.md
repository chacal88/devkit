Verdict: approved
Commit: 7e305e2e4151ffd509180328b4a05b3f339cb2ae

## ADR review — state-skips-unlocated

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790 (unplacedAction); openspec/changes/state-skips-unlocated/requirements.md:35 — nextAction does not use unplacedAction, so next --change x still exits 3 where state lists x blocked; an owner-approved non-goal, drift from ADR 0017 decision 1's one-place intent only; cite the ADR if a later change makes next succeed for an unplaced change.

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`) with its amendments from ADR 0020 and ADR 0021; ADR 0020 (`docs/adr/0020-a-change-can-run-on-another-machine.md`); ADR 0021 (`docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`); ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`); ADR 0010, ADR 0014 and ADR 0019 as cited from ADR 0017 and for the release; ADR 0002 and ADR 0003 for the pull request and CI constraints.

### Conformance
- ADR 0017 decision 1: `unplacedAction` is the one place that decides a known change cannot be placed; `stateEntries` and `collectRoadmap` both call it, so the board and the command agree by construction. The blocked end uses the existing `wrong-branch` reason, so ADR 0010's four ends are unchanged and the reason table stays open.
- ADR 0017 decision 2: the roadmap path skips run-file declared lines before the helper; the state command applies the run-file facts to the stand-in through `changeState`; tests 1.18 and 2.8 pin both paths.
- ADR 0017 decision 3 and the locks: the GitHub-wait rule is untouched; the stop locks still read the transcript and only see a placed or blocked action.
- ADR 0020 and ADR 0021: the remote-wait and upfront-wait reasons are not touched; the helper returns null whenever the loop can place the change.
- ADR 0026 decision 3: no test file imports another test file; the shared helpers (`archiveGh`, `archivedFolder`, `archiveOnOrigin`, `withCreated`) live in `plugins/openspec/hooks/change-loop-fixtures.mjs`.
- Release and CI pin (ADR 0002, ADR 0003, ADR 0019): plugin 0.39.1, marketplace entry 0.39.1, marketplace metadata 0.43.1, CHANGELOG heading 0.43.1, and the three CI pin lines of `docs/openspec-flow.md` say v0.39.1; no stale 0.39.0 pin remains outside historical notes. The tag v0.39.1 is owed after merge (CONTRIBUTING step 5), outside the diff.
- `openspec/specs/` and `docs/adr/` are untouched; the deltas live in the change folder and take effect at archive. `decisions.md` records no new ADR, which holds: the new reason code is one key in an open table and no ADR pins `locate`'s order.
- The repository keeps no open-decisions log, and none is touched. No REQUIRES SUPERSEDER case.
- No tests were run by this review, as instructed; the evidence file's results are the history and the delivery train proves the whole suite.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
