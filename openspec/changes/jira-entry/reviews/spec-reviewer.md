Verdict: approved
Commit: 2fd34f861706ff18a2a88efbd0981eef44ff8505

## Spec review — jira-entry (round 1, re-review after the fourth merge of main)

### Findings
- [nit] openspec/changes/jira-entry/design.md:238 (D-6); openspec/changes/jira-entry/specs/jira-tasks/spec.md, requirement 'The write-back question is asked once when the pull request opens' — e147d74 also withholds writeBack on the budget end (waiting-budget), and the AC-6 test at change-loop.test.mjs:3627 covers it. D-6 still says only 'the action is not a blocked end' and the spec delta is silent. Update D-6 (and the spec scenario if the owner wants it contractual) to say the question is held on a blocked end and on the budget end.
- [nit] plugins/openspec/hooks/jira-task.mjs:taskIdPrefix; openspec/changes/jira-entry/specs/jira-tasks/spec.md, requirement 'A change opened from a task records the task' — Previous nit, still open: the code maps '_' to '-' in the id prefix and the spec says nothing about it.
- [nit] docs/openspec-flow.md ('The forms' paragraph and the roadmap/status bullet) — Previous nit, still open: the change also rewrites 'project and help are not built' to 'project is built, only help is not', which no jira-tasks requirement asks for. Keep it or move it to its own change.
- [nit] openspec/changes/jira-entry/evidence.md — Previous nit: evidence.md was uncommitted; it is now tracked and was refreshed in 2fd34f8. · fixed in 484a8a7

## Spec review — jira-entry (round 1, re-review after the fourth merge of main)

In-scope specs: openspec/changes/jira-entry/specs/jira-tasks/spec.md.

### Coverage
| Requirement | Status |
|---|---|
| A Jira key or link typed alone is read as a task | covered |
| Jira is reached only through the session's connector | covered |
| A task that cannot be read opens nothing | covered |
| A change opened from a task records the task | covered |
| The key resumes its unfinished change | covered |
| The grill asks only what the task leaves open | covered |
| The write-back question is asked once when the pull request opens | covered |
| Jira is written only on the developer's yes | covered |

The conflict resolution of e147d74 keeps the change's side intact beside #72's budget code: nextAction keeps the budget end, adds task after it, and withholds writeBack on a blocked end, on waiting-budget and on the archive branch (task still attaches); versions (0.30.0, 0.12.0, 0.26.0), CHANGELOG order and the v0.26.0 pins agree. The budget-end withholding is a refinement no jira-tasks requirement states; it is tested (AC-6) but unrecorded in D-6 and the spec delta.

### Summary
- 3 open findings, all nits (1 new, 2 carried over); 0 blocking, 0 gaps.
