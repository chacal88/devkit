<!-- devkit-stage retro result=passed attempt=1 commit=4ea5da663436d38de24a09eed92d8895a5393cf1 -->
## Retro: roadmap-panel-study

1. Went wrong: review round 1 rejected the study on two important findings, both inside the grill input of `design.md`. D-4 took the stage dots from `flow-check.mjs` while D-5 said state is never read from the stage files one by one, and D-6 and D-9 were worded as decisions while O-12 and O-18 left them open. The plan's design check (gate 1.9) enforced the shape of the file (headings, 21 rows, 15 file fates, each gap in an open point) but not that the lines agree with each other, so the gate was green with the contradiction in it. A smaller slip: the pasted state JSON first carried the owner's absolute home path in a public repository; it was redacted before the evidence run, and the machine names in the pasted board stay a nit. The loop's `fix-review` step hands a fix to the implementer, and the coordinating session edited `design.md` itself; the file is the study's own deliverable and round 2 reviewed the edit, but it is a departure from the step.
2. Better next time: when a plan fixes the form of a study, the form says that a decision line resting on an open point carries `(provisional until O-n)`, and the check compares the decision lines with the table they summarise (D-4 against the taken and dropped cells). Real command output pasted into a public file is scrubbed of personal paths in the task that pastes it, not after. A fix to the study's own file goes through the hand-off the step names.
3. Remember: in a study, a decision that depends on an open point is marked provisional on its own line.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A form check proves shape, not agreement between lines; decisions resting on open points were written as firm | process-friction | doc-update | project |
| 2 | Pasted command output carried a personal path into a public file | environment | doc-update | project |
| 3 | A study's decision depends on an open point: say so on the decision line | process-friction | memory-only | user |

## Proposed updates

### `docs/conventions.md` (doc-gap)
Studies that end in a written recommendation get two rules in the conventions: a decision line that rests on an open point is marked provisional on that line, and real command output pasted into a file of this public repository is scrubbed of personal paths and e-mails in the task that pastes it.
- before: the `## Content` section has no rule for a study's recommendation or for pasted command output.
+ after: the `## Content` section gains "A study's recommendation marks each decision that rests on an open point as `(provisional until O-n)`, and any command output pasted into it is scrubbed of personal paths and e-mails when it is pasted."
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a study lists decisions beside open points, mark a decision that depends on an open point provisional on its own line before the review round.
- Answer: approved
- Applied: yes
