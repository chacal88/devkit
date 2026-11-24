Verdict: approved
Commit: 9ad0f6fa551bb7269b21fd0240956c91e0bb15cc

## Spec review — run-status-bar

### Findings
- [nit] openspec/changes/run-status-bar/specs/status-line/spec.md:89-91; plugins/openspec/hooks/status-line.mjs:93-99 — Requirement "The line is at most 100 columns", scenario "The reason is dropped": the spec says the reason is cut "to its first word" and ends in an ellipsis, but the code drops a one-word reason at once without trying `<word>…`. The spec does not say which is meant (open since round 1; status-line.mjs unchanged in a46bf79..HEAD; flagged, not interpreted).
- [nit] openspec/changes/run-status-bar/tasks.md:13-15 against tasks.md gate 3.4 — The preamble said every gate runs with GITHUB_HEAD_REF and GITHUB_BASE_REF set, while the amended gate 3.4 runs the train's text with no CI branch variables. · fixed in 3198a0303ca618e8645e4135503c32f34e4099c0
- [nit] openspec/changes/run-status-bar/design.md D-11 test table (S-1..S-11, around line 330) and D-4; tasks.md — The design's test list (D-11, S-1 to S-11) and the tasks do not record S-9b or the offline merge-setup route added in accaace (`offline: gh === OFFLINE_GH`, stop-merge-setup read as silent). Only evidence.md and review.md describe it, so the plan's verification metadata no longer lists every test that proves "The state is read without GitHub on request".

In-scope specs: `openspec/changes/run-status-bar/specs/status-line/spec.md`, `openspec/changes/run-status-bar/specs/change-state/spec.md`; baseline `openspec/specs/change-state/spec.md` (requirement "A GitHub that does not answer reads as a wait on GitHub").

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
- This round reviews only `a46bf79..9ad0f6f` (the re-review rule). The commits are `deb9835` (review record), `accaace` (the fix for code-quality F10), `3198a03` (the tasks preamble) and `9ad0f6f` (evidence). No file under `specs/`, `proposal.md`, `requirements.md` or `openspec/specs/` changed in this range.
- **The F10 fix closes a gap against the spec delta and adds no scope.** Requirement "The state is read without GitHub on request" says that with `--offline` GitHub reads as not answering, so the state follows the baseline "A GitHub that does not answer reads as a wait on GitHub": a stage that needs GitHub reads `waiting-on-github` with the reason `silent`. In merge mode the code review stage needs GitHub to read the merge setup. Before accaace, `--offline` read `blocked`, `merge-setup` there; now `decide` sends `stop-merge-setup` to the shared `silent()` helper only when `facts.offline` is set. Design D-4 already claimed this ("a stage that needs it reads `waiting-on-github` / `silent`"). Online the stop stays `blocked`, `merge-setup`, which keeps "Without `--offline` nothing changes".
- **The new route is confined to `state --offline`.** `facts.offline` is true only when `nextAction` gets the `OFFLINE_GH` stub. In non-test code that happens only through `runState` with `--offline` (change-loop.mjs:3102). The other users of `OFFLINE_GH` (`roadmapAgentDecision` through `openOnRoadmap`/`unfinished`, and `roadmapStopDecision` as `claimsGh`) never reach `decide`, so `next` and the guard hooks behave as before.
- **The refactor of `blockedEnd` changes no behaviour.** It is the same `waiting(...)` call, now through `silent()`.
- **Tests: I ran one test command.** It ran the offline tests of `plugins/openspec/hooks/change-state-stages.test.mjs`, selected with `--test-name-pattern="run-status-bar AC-(3|5) offline"`, with TMPDIR and the CI branch variables set and `--concurrency=2`: 11 of 11 passed, S-9b among them. For the four touched test files and `change-loop.test.mjs` I rely on the caller's runs and the evidence (515/515 and 182/182).
- **Evidence.** AC-3 now records real runs F1 to F7 on the S-9b fixture. Online the change is blocked/merge-setup with 5 `gh` calls. Offline it reads waiting-on-github/silent with 0 calls. The coordinator bar counts it in play and not as blocked. On the code before the fix (`83650a5`) F6 and F7 reproduce the defect.
- **Outside this change.** Online, a `gh` that fails on every call still makes the merge-setup step block rather than read as silent. That predates this change and is not in its delta, so I do not raise it as a finding.
- **ADRs and decisions.** No ADR or open decision is touched in this range, and no two specs disagree.

### Summary
- 3 findings (0 scope creep, 0 gaps), all nits: F1 carried open from round 1; F2 fixed in 3198a03; F3 new (the design's test list and the tasks do not record S-9b). Nothing blocking or important.
