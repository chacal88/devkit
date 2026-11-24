Verdict: approved
Commit: a46bf795f7bb603ae110183d20a8cd1f5630596a

## ADR review — run-status-bar (round 3, re-check after the merge of origin/main d917ae0)

### Findings

ADRs reviewed: ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`), ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`), with ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0023 (`docs/adr/0023-the-model-is-chosen-by-stage.md`) and ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`) carried from round 2. The rest of `docs/adr/` was scanned by title through the ADR line of `openspec/config.yaml`, and none touches the lines in scope.

Re-review scope: my round 2 findings (none), how merge `aa8a685` of `origin/main` `d917ae0` was resolved in the files both parents touched, and the change folder edits `83650a5` and `a46bf79` (plus `009b455`, the round 2 record). Main's own commits are out of scope.

ADR review: pass. 5 ADRs reviewed: ADR 0017, ADR 0022, ADR 0023, ADR 0026, ADR 0030.

- Release files (`.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`, `CHANGELOG.md`): devkit-openspec 0.43.0 and marketplace 0.48.0, one above main's 0.42.0 / 0.47.0. The entry is headed `## 0.48.0`, and main's 0.45.0 to 0.47.0 entries stay below it.
- `docs/openspec-flow.md`: the four CI pin spots (comment, URL, the `(`v...` above)` sentence, the `gh api` tag command) all name `v0.43.0` and follow the manifest, which is the only pin rule left after ADR 0030 decision 1.
- `plugins/openspec/hooks/change-loop-compozy.test.mjs`: byte-identical to main's `d917ae0` (`git diff aa8a685^2 aa8a685` is empty). The literal pin, its comment and its `doesNotMatch` history are gone, and the release edits no test line (ADR 0030 decision 1). The approved plan's E-3 edit is correctly dropped.
- `plugins/openspec/hooks/change-loop.mjs`: the one conflicted hunk (`USAGE`) keeps main's `merge-check <id>` and this change's `state [--change <id>] [--offline]`. The branch's own hunks in `plugins/openspec/README.md`, `change-loop.test.mjs`, `change-loop-remote-state.test.mjs` and `flow-check.test.mjs` match exactly what it brought before the merge.
- `openspec/changes/run-status-bar/design.md` and `tasks.md` (`83650a5`, `a46bf79`): E-3 is marked superseded by ADR 0030, and the allowed edits of existing tests drop to E-1, E-4 and E-5. `archive-release-pin` (ADR 0030) is now a dependency. Gate 3.4's suite part changes to `node scripts/test-suite.mjs`, which equals the train's whole-suite command in `openspec/config.yaml` (ADR 0022) and the flow page's "Gate parts proven by the train" rule. `evidence.md` says openly that nobody ran the whole suite at this head and that the train proves it. None of this contradicts an ADR.
- Every commit in the range has a conventional message.

No open decision is touched (the project keeps no open-decisions log), and the change adds no ADR. No tests were run in this round: the conducting session reports the seven touched test files green at the merge head (935/935), and the commits after the merge touch only `openspec/changes/run-status-bar/`.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
