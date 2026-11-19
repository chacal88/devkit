## Retro: design-open-points

1. Went wrong: the plan quoted, as examples, the roadmap lines to write, and `deliver-check` read
   those quoted lines as unticked tasks of the last phase, although they sat inside fenced blocks;
   it asked to implement a phase that had nothing left to implement. The session had to notice it
   and mark the lines. Twice in one day the flow then stood still at green checks until the owner
   wrote again ("ta e parou?"): green checks wake nothing, and the session may not poll them.
2. Better next time: never let an example line in `tasks.md` start with a checkbox. And design the
   wait on GitHub so that it needs nobody's message.
3. Remember: the checker reads every checkbox line of `tasks.md` as a task, fenced or not.

What worked: applying the retro of the previous change paid off at once. The evidence was
committed before the review, so no reviewer went stale; the verifier counted its numbers; the
reviewers were told a disposition names one sha; the implementer was told how to undo an edit
without destructive Git. The review passed at round 1 with nits only, and the two gates ran the
whole suite once each (671 tests).

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `deliver-check` reads a checkbox line of `tasks.md` as a task even inside a fenced example, and gives a wrong next step | bug-class | followup: round 14's checker reads headers, not prose; until then, proposal 2 | project |
| 2 | Green checks do not wake the session; the owner had to write for the flow to go on, on both changes of the day | environment | doc-update (proposal 1): an open point for round 15 | project |
| 3 | Between rounds 15 and 21 two roles are called `tech-lead`: the new change coordinator and the CompozyOS kit's planner, renamed only in round 21 (a reviewer's nit) | doc-gap | doc-update (proposal 1) | project |
| 4 | Two wording nits of the review: the command table of section 1 is still headed "Example", and the lead-in of section 13 mixes "all proposed" with one decided point | doc-gap | doc-update (proposal 1) | project |
| 5 | `review-round.mjs outcomes` gave no writer prompt again | tooling | none new: roadmap round 25 | project |

## Proposed updates

### `docs/coordination-design.md` (doc-gap)
Two open points the day revealed, and two wording nits of the review.
- before: "Open points" does not mention the wait on GitHub nor the two roles called `tech-lead`; the command table of section 1 is headed `| Example | What it does | Round |`; section 13 opens with "All proposed, except how the points below are proved (decided)."
+ after: "Open points" gains two items: "How the change coordinator waits on GitHub without anybody's message: today green checks wake nothing, and on 2026-11-19 the owner had to write twice for the flow to go on; settled in the grill of round 15 (section 10)." and "How the two roles called `tech-lead` are told apart between round 15, which builds the change coordinator, and round 21, which renames the CompozyOS kit's planner; settled in the grill of round 15 (section 2)."; the table of section 1 is headed `| Command | What it does | Round |`; section 13 opens with "All proposed." and the sentence that the points are proved together, in one test session, stands on its own line marked decided.
- Answer: approved
- Applied: yes

### user memory (memory-only)
In `tasks.md`, never let an example line start with a checkbox, even inside a fenced block: `deliver-check` reads it as a task. Prefix it with a marker such as `(line) `.
- Answer: approved
- Applied: yes
