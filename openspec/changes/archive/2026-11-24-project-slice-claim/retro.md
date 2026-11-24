<!-- devkit-stage retro result=passed attempt=1 commit=db6c8688d50a08cee4ba00bed9a2981234f6bb08 -->
## Retro: project-slice-claim

1. Went wrong: `main` took ADR 0022 while the change was in delivery, so the release merge renumbered
   the ADR to 0029. The docs and the ADR file were updated, but `proposal.md` and `design.md` still
   said "ADR 0022", and review round 1 rejected the change for it (finding F2). Separately, the spec
   delta's MODIFIED block dropped the scenario "The CompozyOS driver" that `main` had added meanwhile,
   so evidence attempt 1 failed on `openspec validate --strict`. The change also took five merges of
   `main` and was left behind by trains 3 and 6. Each re-board redid the release numbers, the
   evidence and a stale-only review round.
2. Better next time: when another change takes the ADR number, renumber the plan files of the change
   as well. Or write one `Numbering:` line in `decisions.md` that maps the old number to the new one.
   The review reads the plan files as claims about the code. The dropped-scenario case is already
   gated on `main`: the loop's `merge-check` step runs `openspec validate --strict` after every merge
   of the base.
3. Remember: an ADR renumbering reaches the plan files too, not only the code and docs.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A renumbered ADR left the plan files citing the old number, which cost a review round | doc-gap | doc-update | project |
| 2 | A MODIFIED spec block dropped a scenario `main` added after the plan | bug-class | memory-only (already gated by `merge-check` on `main`, nothing to propose) | project |
| 3 | Code-review nits left open: a refused claim push replies `project-unreadable` (a `claim-push-failed` key would be clearer); `claimMachineOf` swallows every error; AC-9 asserts on source text | tooling | followup (not proposed here; a change of its own if wanted) | project |

## Proposed updates

### `CONTRIBUTING.md` (doc-gap)
Say that the renumbering of an ADR reaches the change's plan files too, or a single mapping line in
`decisions.md`, so the review does not read the old number as a claim.
- before: and renumber your ADR and every reference your change made to it when another change took its number first.
+ after: and renumber your ADR and every reference your change made to it when another change took its number first, the plan files included (`proposal.md`, `design.md`, `tasks.md`, `readiness.md`), or write one `Numbering:` line in the change's `decisions.md` that maps the old number to the new one.
- Answer: approved
- Applied: yes
