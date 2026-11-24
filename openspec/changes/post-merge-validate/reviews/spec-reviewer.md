Verdict: rejected
Commit: 24725d7f44ce1297d6729258875fd5a93e126a32

## Spec review — post-merge-validate

### Findings
- [important] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, 'A merge of the base is checked before the evidence' vs openspec/specs/change-coordination/spec.md 'From the implementation on,… — The delta only ADDs a requirement whose scenarios say that, with an unchecked merge, verify, review, wait-checks and ready give merge-check instead. The canonical scenarios 'The demonstration', 'The code review', 'Waiting on GitHub' and 'Other owner gates' still say those steps give the verifier, the review session step, a wait or an owner end. After archive the two read as contradicting unless the reader knows the new requirement takes precedence, and the delta states no precedence. Either MODIFY those scenarios or state the precedence in the requirement.
- [nit] plugins/openspec/hooks/change-loop.mjs:1371 and :1670 — Scenario 'The planner's fix is checked again' says 'the change's files have changed since', but the code compares fingerprint(), which covers HEAD, the whole worktree status and diff, and untracked files; conservative, but wider than the spec's wording.
- [nit] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, scenario 'The command with no merge' — The spec says the command 'prints result: none'; the implementation prints JSON with result none, like every other change-loop command; the wording is looser than what runs and no test pins the exact form.

## Spec review — post-merge-validate

All requirements of the delta are covered (6 ADDED requirements, AC-1..AC-10), no scope creep; 19 post-merge-validate tests pass.

### Summary
- 3 findings (0 scope creep, 0 gaps), none blocking by the reviewer's own recommendation.
