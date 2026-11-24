Verdict: approved
Commit: 22230be382d0c7f9cbb7f18c6abd865125b602e1

## Spec review — run-status-bar

### Findings
- [nit] openspec/changes/run-status-bar/specs/status-line/spec.md, requirement "The line is at most 100 columns", scenario "The reason is dropped"; plugins/openspec/hooks/status-line.mjs:93-99 — The spec says the reason is cut "to its first word" and ends in an ellipsis. The code never tries `<word>…` for a one-word reason and drops it at once. The spec does not say which is meant; flagged, not interpreted.

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
- I ran the two new test files once: `status-line.test.mjs` and `change-state-stages.test.mjs`, 181 of 181 pass. I did not re-run the full suite.
- No scope creep. The `readStdin` wait parameter, the `notApplicableOf` extraction, the move of `OFFLINE_GH` and the release pins all appear in the proposal or design.
- No decision, ADR or spec conflict is at play; `decisions.md` records no new ADR.
- `evidence.md` says the repository's own roadmap line is unproven because `state` exited 0 where D-12 expected 3. That is dogfood left to the next roadmap run, not a spec gap.

### Summary
- 1 finding (0 scope creep, 0 gaps).
