<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> from the jira-entry retro: a review round whose tree is dirty only inside the change folder records its verdicts as committed (the delivery check today treats "(uncommitted changes)" as stale, so the evidence had to be committed and the round run again); after a fix that touches only the change folder, `next` hands the re-review instead of `fix-review` again (round 2 of jira-entry was run by hand); the installed loop reads a `flow.json` newer than itself or says which release it needs (0.21.1 refused `appliesWhen`); and the review's open nits: `writeBackAsk` compares the pull request number as `nextAction` does, the skill passes a connector error through the quoted heredoc and not `--param error=`, the task-taken check runs inside the open lock, a test for the blocked half of the write-back condition, and the spec delta states the `_` to `-` mapping of the id prefix

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
