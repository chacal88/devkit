Verdict: approved
Commit: 3a53ac94b3676d8063672b1a3b9887f806956424

## Spec review — run-status-bar

### Findings
- [nit] openspec/changes/run-status-bar/specs/status-line/spec.md, requirement "The line is at most 100 columns", scenario "The reason is dropped"; plugins/openspec/hooks/status-line.mjs:93-99 — The spec says the reason is cut "to its first word" and ends in an ellipsis, but the code never tries `<word>…` for a one-word reason and drops it at once; the spec does not say which is meant (round 1 nit, left as is; flagged, not interpreted).

In-scope specs: `openspec/changes/run-status-bar/specs/status-line/spec.md`, `openspec/changes/run-status-bar/specs/change-state/spec.md`; baseline `openspec/specs/change-state/spec.md`.

### Coverage
| Requirement | Status |
|---|---|
| status-line: The session's line is chosen from its input | covered |
| status-line: The change's line | covered |
| status-line: The line is at most 100 columns | covered |
| status-line: The coordinator's counts | covered |
| status-line: The line is in the person's language | covered |
| status-line: The command only reads | covered |
| change-state: Each entry lists the stages that apply to the change | covered |
| change-state: The state is read without GitHub on request | covered |

### Notes
- This re-review covers my round 1 finding and the lines changed since `22230be`: `792fde6` (status-line.mjs, its tests, CHANGELOG, README, docs/openspec-flow.md), `0528b85` (tests only), `ec1b00b` (`.openspec.yaml` models table) and `3a53ac9` (design D-1/D-9, evidence). From the merge `f4bad47` it covers only the resolution in the release files and `change-loop-compozy.test.mjs`. At the coordinator's request I also opened the files of the change that did not change since round 1. For the source and test files I read the change's own diff (`git diff a347ac0...HEAD`), and I read `change-state-stages.test.mjs` whole. They confirm the round 1 coverage. Each edit traces to a requirement: `stages`/`appliedStages`/`notApplicableOf` to "Each entry lists the stages that apply to the change"; `--offline`/`OFFLINE_GH` to "The state is read without GitHub on request"; the `readStdin(waitMs)` parameter to the 1-second wait of "The session's line is chosen from its input"; the `bar.*` messages to "The line is in the person's language". The requirements' AC-1 to AC-7 and the approved mock-up's lines and cutting order match the spec deltas.
- Requirement "The command only reads", scenarios "The state cannot be read" and "The run is aborted": the `state` child now leads its own process group, and the bar stops the whole group at the bound and on a signal (`status-line.mjs` `stateText`). This meets "no state process is left running", which now also covers what `state` starts. The design records it (D-9) and the CHANGELOG states it, so it is not a silent resolution and not scope creep.
- New tests since round 1 cover the real signal wiring (SIGTERM, SIGINT, SIGHUP on the real bar with a fake `openspec` on `PATH`), the `--lang` hand-off to the state call (scenario "The same change in Portuguese" and the coordinator's), and the README `statusLine` command. `status-line.mjs` gained no test-only option for them.
- The `statusLine` snippet now ends `[ -z "$f" ] || node ...` in the README, docs/openspec-flow.md and design D-1, so with no installed copy it prints nothing and exits 0. The `--lang en` note was added to both documents. Both are documentation of existing behaviour, not new behaviour.
- Merge resolution: devkit-openspec 0.40.0 and marketplace 0.45.0 sit above main's 0.39.2/0.44.0. The CHANGELOG entry is on top, docs/openspec-flow.md pins `v0.40.0`, and `change-loop-compozy.test.mjs` asserts `v0.40.0` and refuses `v0.39.2`, as design E-3 prescribes.
- I ran `plugins/openspec/hooks/status-line.test.mjs` once in the foreground (TMPDIR=/private/tmp/devkit-run-status-bar, GITHUB_HEAD_REF=probe-branch, concurrency 2): 184 of 184 pass. I did not run the whole suite; per the caller, it passed at `0528b85` (3165 tests, 0 fail).
- No ADR, open decision or spec conflict is at play; `decisions.md` records no new ADR, with its reason.

### Summary
- 1 finding (0 scope creep, 0 gaps): the round 1 nit, still open.
