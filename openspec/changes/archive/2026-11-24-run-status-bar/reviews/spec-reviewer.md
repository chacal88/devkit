Verdict: approved
Commit: 796ac2cb75448c7596cc45f0cbe6851d2ccce58f

## Spec review — run-status-bar

### Findings
- [nit] openspec/changes/run-status-bar/specs/status-line/spec.md:89-91; plugins/openspec/hooks/status-line.mjs:93-99 — Requirement "The line is at most 100 columns", scenario "The reason is dropped": the spec says the reason is cut "to its first word" and ends in an ellipsis, but the code drops a one-word reason at once without trying `<word>…`. The spec does not say which is meant (open since round 1; status-line.mjs unchanged in 9ad0f6f..HEAD; flagged, not interpreted).
- [nit] openspec/changes/run-status-bar/tasks.md:13-15 against tasks.md gate 3.4 — The preamble said every gate runs with GITHUB_HEAD_REF and GITHUB_BASE_REF set, while the amended gate 3.4 runs the train's text with no CI branch variables. · fixed in 3198a0303ca618e8645e4135503c32f34e4099c0
- [nit] openspec/changes/run-status-bar/design.md D-11 test table and D-4; tasks.md — The design's test list (D-11) and the tasks did not record S-9b or the offline merge-setup route added in accaace. · fixed in 0983bd2d744c303640062cd95a66f0bfc0122074
- [nit] openspec/changes/run-status-bar/specs/change-state/spec.md:7-11 and scenario "No flow read" (:29-31); plugins/openspec/hooks/change-loop.mjs:2031,2039 — Requirement "Each entry lists the stages that apply to the change": since the merge 4c25ecc the unplaced change's entry (state-skips-unlocated's `unplacedAction`) carries `stages: null`, which fits the main clause (no flow read) and the other spec's "its stage fields null", but the spec delta's list of null cases and its scenario "No flow read" still name only the archived change, the start with no folder and the previous-script change; only design.md D-4/E-6 and tasks.md record the fourth case.

In-scope specs: `openspec/changes/run-status-bar/specs/status-line/spec.md`, `openspec/changes/run-status-bar/specs/change-state/spec.md`; baseline `openspec/specs/change-state/spec.md` (requirement "A GitHub that does not answer reads as a wait on GitHub"); cross-checked against `openspec/changes/state-skips-unlocated/specs/change-state/spec.md` (requirement "A change the loop cannot place is listed blocked"), whose code this branch merged.

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
- **Range.** This is a re-review of `9ad0f6f..HEAD`. The change's own commits are `62bd607` (test B14b plus a doc-comment line in `decide`), `0983bd2` and `41caadc` (design.md and tasks.md), and `b892d4f` and `796ac2c` (evidence). The merge resolutions are `4c25ecc` (origin/main `c09860c`) and `e14e1fa` (origin/main `74f2444`). No file under `specs/`, and neither `proposal.md` nor `requirements.md`, changed in this range.
- **B14b adds no scope.** It pins that with `offline: true` only `stop-merge-setup` reads `waiting-on-github`/`silent`, and that `stop-branch`, `stop-archive`, `stop-not-approved` and `blocked` stay `blocked` with their own reasons. This matches "The state is read without GitHub on request" together with the baseline "A GitHub that does not answer reads as a wait on GitHub": only the merge-setup stop is a GitHub read. I ran it once with TMPDIR, the CI branch variables and `--concurrency=2`, filtered to `^change-loop decide: B14` in `change-loop.test.mjs`: 2 of 2 passed.
- **The merge resolutions.** In `4c25ecc`, `stateEntries` keeps main's unplaced and archived stand-ins and this change's `stages: true` and `stages: action.stages ?? null`. The USAGE line keeps main's `[--stdin <name>]` and this change's `[--offline]`. `decide`'s silent branch uses this change's `silent()` helper. E-6 adds `stages: null` to main's `unlocated 1` expected entry. This agrees with state-skips-unlocated's "its stage fields null", so the two specs do not disagree. In `e14e1fa`, `nextAction` keeps main's `fetchBase` and this change's `stages` option, and `roadmap-loop.mjs` keeps the `OFFLINE_GH` import. Both merges move the release above main: devkit-openspec 0.46.0, marketplace 0.51.0, `## 0.51.0` in CHANGELOG.md, and the doc's pins at `v0.46.0`. The other files that differ from both parents show an empty combined diff, so they merged without a manual hunk.
- **Offline and the unplaced path.** `archivedDates` and `archivedOnDefault`, reached for unplaced ids, take the injected `gh`, so `state --offline` makes no GitHub call on that path either. That keeps scenario "No call at all".
- **AC-3 on this repository.** The real coordinator listing takes 37 to 45 s for 11 changes, so the bar prints nothing after its 20 s bound. That is the spec's own scenario "The state cannot be read", not a departure from it. The owner accepted it as a known limit (`Entregar e seguir`), recorded in design.md D-12 and the risk table, with the follow-up `state-listing-speed`. That follow-up needs its own change; nothing in this change claims it.
- **origin/main moved.** The local `origin/main` is now `d6d7f6a` (train 12, archives only; nothing under `plugins/` changed, and main is still 0.45.0/0.50.0). The branch's release stays above it. evidence.md records this, and the delivery train handles it.
- **ADRs and decisions.** No ADR or open decision is touched in this range.

### Summary
- 4 findings (0 scope creep, 0 gaps), all nits. F1 is carried open from round 1. F2 was fixed in 3198a03 and F3 in 0983bd2. F4 is new: the spec delta's list of null-`stages` cases does not name the unplaced stand-in the merge brought. Nothing blocking or important.
